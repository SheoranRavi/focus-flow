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
	rw.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(rw).Encode(session)
}

func (h *SessionHandler) GetAll(rw http.ResponseWriter, req *http.Request) {
	userId := req.Context().Value(middleware.UserIDKey).(string)
	sessions, err := h.SessionSvc.GetAll(req.Context(), userId)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
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
	var userPatch entities.UserPatchInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		// try decoding to UserPatch
		err = json.NewDecoder(req.Body).Decode(&userPatch)
		if err != nil {
			h.logger.Error().Msg("Unable to decode to PatchInput")
			http.Error(rw, err.Error(), http.StatusBadRequest)
			return
		}
	}

	eventTypeStr := service.EventType(req.URL.Query().Get("type"))
	eventType := service.EventType(eventTypeStr)
	if !eventType.IsValid() {
		http.Error(rw, errors.New("Event type is not valid").Error(), http.StatusBadRequest)
	}

	if eventType == service.EventResetProgress || eventType == service.EventAutoResetTimeChange {
		err := h.EventSvc.HandleEvent(req.Context(), eventType, userId, &userPatch)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}
	} else if err := h.SessionSvc.HandleEvent(req.Context(), &input, eventType, userId, sessionId); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	rw.WriteHeader(http.StatusNoContent)
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

	rw.WriteHeader(http.StatusNoContent)
}
