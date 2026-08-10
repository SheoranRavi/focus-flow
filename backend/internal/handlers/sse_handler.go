package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

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
	lastRevision := int64(0)
	if value := r.Header.Get("Last-Event-ID"); value != "" {
		lastRevision, _ = strconv.ParseInt(value, 10, 64)
	}
	if lastRevision == 0 {
		lastRevision, _ = strconv.ParseInt(r.URL.Query().Get("after_revision"), 10, 64)
	}
	if lastRevision > 0 {
		if missed, err := h.eventSvc.Replay(r.Context(), userId, lastRevision); err == nil {
			for _, event := range missed {
				h.writeEvent(rw, flusher, service.Message{EventType: service.EventType(event.EventType), Object: json.RawMessage(event.Payload), EventID: event.EventID.String(), Revision: event.Revision})
			}
		}
	}
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
			h.writeEvent(rw, flusher, msg)
		}
	}
}

func (h *SSEHandler) writeEvent(rw http.ResponseWriter, flusher http.Flusher, msg service.Message) {
	msgStr, err := objectToString(msg.Object)
	if err != nil {
		h.logger.Error().Err(err).Msg("Unable to convert event")
		return
	}
	if msg.Revision > 0 {
		fmt.Fprintf(rw, "id: %d\n", msg.Revision)
	}
	fmt.Fprintf(rw, "event: %s\n", msg.EventType)
	fmt.Fprintf(rw, "data: %s\n\n", msgStr)
	flusher.Flush()
}

func (h *SSEHandler) Replay(rw http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(string)
	after, err := strconv.ParseInt(r.URL.Query().Get("after_revision"), 10, 64)
	if err != nil {
		http.Error(rw, "after_revision must be an integer", http.StatusBadRequest)
		return
	}
	events, err := h.eventSvc.Replay(r.Context(), userID, after)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	rw.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(rw).Encode(events)
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
