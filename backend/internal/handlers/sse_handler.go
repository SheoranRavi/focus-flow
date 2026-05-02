package handlers

import (
	"encoding/json"
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
	connection := h.eventSvc.AddUserConnection(userId)
	eventChan := connection.EventC
	h.logger.Info().Str("user_id", userId).Str("conn_id", connection.ConnId).Msg("Subscribed to events")
	fmt.Fprintf(rw, "event: heartbeat\n")
	fmt.Fprintf(rw, "data: heartbeat\n\n")
	flusher.Flush()

	for {
		select {
		case <-ctx.Done():
			h.logger.Info().Str("userId", userId).Msg("client disconnected.")
			h.eventSvc.RemoveClientConnection(connection.ConnId, userId)
			return // client disconnected
		case msg := <-eventChan:
			h.logger.Info().Str("userId", userId).Msg("Sending event to client")
			msgStr, err := objectToString(msg.Object)
			if err != nil {
				h.logger.Error().Msg("Unable to convert msg to string")
			}
			fmt.Fprintf(rw, "event: %s\n", msg.EventType)
			fmt.Fprintf(rw, "data: %s\n\n", msgStr)
			flusher.Flush()
		}
	}
}

func objectToString(obj any) (string, error) {
	switch v := obj.(type) {
	case string:
		return v, nil
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return "", err
		}
		return string(b), nil
	}
}
