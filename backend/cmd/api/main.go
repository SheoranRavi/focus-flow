package main

import (
	"context"
	"log"
	"net/http"
	"os"

	firebase "firebase.google.com/go/v4"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"github.com/sheoranravi/focus-flow/backend/internal/db"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/middleware"
	"github.com/sheoranravi/focus-flow/backend/internal/repo"
	"github.com/sheoranravi/focus-flow/backend/internal/server"
	"github.com/sheoranravi/focus-flow/backend/internal/service"
	"google.golang.org/api/option"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found or error loading it")
	}

	// initialize the logger
	if err := logger.Initialize(); err != nil {
		log.Fatal("Failed to initialize logger")
	}
	defer logger.Close()

	ctx := context.Background()
	var firebaseOptions []option.ClientOption
	if credentialsJSON := os.Getenv("FIREBASE_CREDENTIALS_JSON"); credentialsJSON != "" {
		firebaseOptions = append(firebaseOptions, option.WithCredentialsJSON([]byte(credentialsJSON)))
	} else {
		log.Default().Println("credentialsJSON not loaded")
	}

	firebaseApp, err := firebase.NewApp(ctx, nil, firebaseOptions...)
	if err != nil {
		log.Fatalf("Failed to initialize Firebase app: %v", err)
	}

	authClient, err := firebaseApp.Auth(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize Firebase auth client: %v", err)
	}

	// Initialize database
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Default().Println("Trying default DB URL")
		dsn = "postgres://postgres:postgres@localhost:5432/focusflow?sslmode=disable"
	}

	database, err := db.NewDB(dsn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()
	log.Println("Database connection established")

	// Initialize repositories
	sessionRepo := repo.NewSessionRepo(database)
	analyticsRepo := repo.NewAnalyticRepo(database)
	userRepo := repo.NewUserRepo(database)
	webhookRepo := repo.NewRazorpayWebhookEventRepo(database)
	eventRepo := repo.NewEventRepo(database)

	// Initialize services
	userService := service.NewUserService(userRepo, authClient, eventRepo)
	paymentService := service.NewPaymentService(userService, service.PaymentConfig{
		KeyID:         os.Getenv("RAZORPAY_KEY_ID"),
		KeySecret:     os.Getenv("RAZORPAY_KEY_SECRET"),
		PlanIDINR:     os.Getenv("RAZORPAY_PLAN_ID_INR"),
		PlanIDUSD:     os.Getenv("RAZORPAY_PLAN_ID_USD"),
		WebhookSecret: os.Getenv("RAZORPAY_WEBHOOK_SECRET"),
		APIBaseURL:    os.Getenv("RAZORPAY_API_BASE_URL"),
	})
	eventService := service.NewEventService(userService, sessionRepo, eventRepo)
	sessionService := service.NewSessionService(sessionRepo, eventService, userService, eventRepo)
	eventService.SetTimerCanceler(sessionService)
	analyticsService := service.NewAnalyticService(sessionService, analyticsRepo)

	// Schedule events
	schedErr := sessionService.ScheduleEvents(ctx)
	if schedErr != nil {
		log.Fatalf("Not able to schedule events: %s", schedErr)
	}
	// Schedule User resets
	userSchedErr := eventService.ScheduleSessionReset(ctx)
	if userSchedErr != nil {
		log.Fatalf("Not able to schedule user reset events: %s", userSchedErr)
	}

	// Initialize auth middleware
	authMiddleware := middleware.FirebaseAuth(firebaseApp)
	loggingMiddleware := middleware.Logging()

	// Initialize router
	r := server.NewRouter(
		sessionService,
		analyticsService,
		paymentService,
		eventService,
		userService,
		webhookRepo,
		eventRepo,
		authMiddleware,
		loggingMiddleware,
	)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe("0.0.0.0:"+port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
