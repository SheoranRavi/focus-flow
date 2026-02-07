package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/sheoranravi/focus-flow/backend/internal/handlers"
	"github.com/sheoranravi/focus-flow/backend/internal/service"
)

func NewRouter(
	sessionSvc *service.SessionService,
	authMiddleware func(http.Handler) http.Handler,
	loggingMiddleware func(http.Handler) http.Handler,
) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(loggingMiddleware)

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	sessionHandler := handlers.NewSessionHandler(sessionSvc)

	r.Route("/sessions", func(r chi.Router) {
		r.Use(authMiddleware)

		r.Get("/", sessionHandler.GetAll)
		r.Post("/", sessionHandler.Create)

		r.Route("/{sessionId}", func(r chi.Router) {
			r.Delete("/", sessionHandler.Delete)
		})

		r.Post("/event", sessionHandler.Event)
	})

	return r
}
