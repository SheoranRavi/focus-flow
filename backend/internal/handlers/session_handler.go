package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/middleware"
	"github.com/sheoranravi/focus-flow/backend/internal/service"
)

type SessionHandler struct {
	SessionSvc *service.SessionService
	EventSvc   *service.EventService
	logger     zerolog.Logger
}

func NewSessionHandler(svc *service.SessionService, eventSvc *service.EventService) *SessionHandler {
	return &SessionHandler{SessionSvc: svc, EventSvc: eventSvc, logger: logger.NewHandlerLogger("session")}
}

func (h *SessionHandler) Create(rw http.ResponseWriter, req *http.Request) {
	userId := req.Context().Value(middleware.UserIDKey).(string)
	var input service.CreateInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}
	input.UserId = userId
	h.logger.Info().Str("user_id", userId).Interface("input", input).Msg("Creating session")

	session, err := h.SessionSvc.Add(req.Context(), input)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	h.setRevision(rw, req, userId)
	rw.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(rw).Encode(session)
}

func (h *SessionHandler) GetAll(rw http.ResponseWriter, req *http.Request) {
	userId := req.Context().Value(middleware.UserIDKey).(string)
	sessions, revision, err := h.SessionSvc.GetAllWithRevision(req.Context(), userId)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	rw.Header().Set("X-State-Revision", strconv.FormatInt(revision, 10))
	_ = json.NewEncoder(rw).Encode(sessions)
}

func (h *SessionHandler) Event(rw http.ResponseWriter, req *http.Request) {
	userId := req.Context().Value(middleware.UserIDKey).(string)
	sessionIdStr := req.URL.Query().Get("id")
	if sessionIdStr == "" {
		http.Error(rw, "missing session id", http.StatusBadRequest)
		return
	}
	sessionId, err := strconv.ParseInt(sessionIdStr, 10, 64)
	if err != nil {
		http.Error(rw, "invalid session id", http.StatusBadRequest)
		return
	}
	var input entities.PatchInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		h.logger.Error().Msg("Unable to decode to PatchInput")
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}
	h.logger.Info().Msgf("Decoded patchInput: %+v", input)

	eventTypeStr := service.EventType(req.URL.Query().Get("type"))
	eventType := service.EventType(eventTypeStr)
	if !eventType.IsValid() {
		http.Error(rw, errors.New("Event type is not valid").Error(), http.StatusBadRequest)
		return
	}

	if err := h.SessionSvc.HandleEvent(req.Context(), &input, eventType, userId, sessionId); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	h.writeRevision(rw, req, userId)
}

func (h *SessionHandler) setRevision(rw http.ResponseWriter, req *http.Request, userID string) {
	if revision, err := h.EventSvc.CurrentRevision(req.Context(), userID); err == nil {
		rw.Header().Set("X-State-Revision", strconv.FormatInt(revision, 10))
	}
}

func (h *SessionHandler) writeRevision(rw http.ResponseWriter, req *http.Request, userID string) {
	h.setRevision(rw, req, userID)
	_ = json.NewEncoder(rw).Encode(map[string]int64{"revision": revisionFromHeader(rw)})
}

func revisionFromHeader(rw http.ResponseWriter) int64 {
	value, _ := strconv.ParseInt(rw.Header().Get("X-State-Revision"), 10, 64)
	return value
}

func (h *SessionHandler) Delete(rw http.ResponseWriter, req *http.Request) {
	userId := req.Context().Value(middleware.UserIDKey).(string)

	sessionIdStr := chi.URLParam(req, "sessionId")
	sessionId, err := strconv.ParseInt(sessionIdStr, 10, 64)
	if err != nil {
		http.Error(rw, "invalid session id", http.StatusBadRequest)
		return
	}

	if err := h.SessionSvc.Delete(req.Context(), sessionId, userId); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	h.writeRevision(rw, req, userId)
}
