package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/sheoranravi/focus-flow/backend/internal/handlers"
	"github.com/sheoranravi/focus-flow/backend/internal/service"
)

func NewRouter(
	sessionSvc *service.SessionService,
	eventSvc *service.EventService,
	userSvc *service.UserService,
	authMiddleware func(http.Handler) http.Handler,
	loggingMiddleware func(http.Handler) http.Handler,
) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(loggingMiddleware)

	// cors
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300, // Maximum value not ignored by any of major browsers
	}))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	sessionHandler := handlers.NewSessionHandler(sessionSvc, eventSvc)

	r.Route("/sessions", func(r chi.Router) {
		r.Use(authMiddleware)

		r.Get("/", sessionHandler.GetAll)
		r.Post("/", sessionHandler.Create)

		r.Route("/{sessionId}", func(r chi.Router) {
			r.Delete("/", sessionHandler.Delete)
		})

		r.Post("/event", sessionHandler.Event)
	})

	sseHandler := handlers.NewSSEHandler(eventSvc)
	r.Route("/events", func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/", sseHandler.Handle)
	})

	userHandler := handlers.NewUserHandler(userSvc, eventSvc)
	r.Route("/users", func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/{userId}", userHandler.Get)
		r.Post("/event", userHandler.Event)
	})

	return r
}
