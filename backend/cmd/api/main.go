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
	"github.com/sheoranravi/focus-flow/backend/internal/middleware"
	"github.com/sheoranravi/focus-flow/backend/internal/repo"
	"github.com/sheoranravi/focus-flow/backend/internal/server"
	"github.com/sheoranravi/focus-flow/backend/internal/service"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found or error loading it")
	}
	ctx := context.Background()
	firebaseApp, err := firebase.NewApp(ctx, nil)
	if err != nil {
		log.Fatalf("Failed to initialize Firebase app: %v", err)
	}
	// Initialize database
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
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

	// Initialize services
	eventService := &service.EventService{}
	sessionService := service.NewSessionService(sessionRepo, eventService)

	// Initialize auth middleware
	authMiddleware := middleware.FirebaseAuth(firebaseApp)

	// Initialize router
	r := server.NewRouter(
		sessionService,
		authMiddleware,
	)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
