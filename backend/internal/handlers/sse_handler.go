package handlers

import (
	"fmt"
	"net/http"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/middleware"
	"github.com/sheoranravi/focus-flow/backend/internal/service"
)

type SSEHandler struct {
	eventSvc *service.EventService
	logger   zerolog.Logger
}

func NewSSEHandler(eventSvc *service.EventService) *SSEHandler {
	return &SSEHandler{eventSvc: eventSvc, logger: logger.NewHandlerLogger("sse_handler")}
}

func (h *SSEHandler) Handle(rw http.ResponseWriter, r *http.Request) {
	userId := r.Context().Value(middleware.UserIDKey).(string)
	h.logger.Info().Str("user_id", userId).Msg("Subscribing to events")
	// 1. Required headers
	rw.Header().Set("Content-Type", "text/event-stream")
	rw.Header().Set("Cache-Control", "no-cache")
	rw.Header().Set("Connection", "keep-alive")

	// 2. Make sure writer supports flushing
	flusher, ok := rw.(http.Flusher)
	if !ok {
		h.logger.Error().Msg("Streaming unsupported")
		http.Error(rw, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// 3. Optional: detect client disconnect
	ctx := r.Context()

	// add connection for user
	eventChan := h.eventSvc.AddClient(userId)

	for {
		select {
		case <-ctx.Done():
			h.logger.Info().Msg("client disconnected")
			// ToDo: remove this connection
			return // client disconnected
		case msg := <-eventChan:
			fmt.Fprintf(rw, "event: ping\n")
			fmt.Fprintf(rw, "data: %s\n\n", msg)
			flusher.Flush()
		}
	}
}
