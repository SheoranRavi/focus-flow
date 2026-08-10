package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/middleware"
	"github.com/sheoranravi/focus-flow/backend/internal/service"
)

type UserHandler struct {
	svc      *service.UserService
	eventSvc *service.EventService
	logger   zerolog.Logger
}

func NewUserHandler(svc *service.UserService, eventSvc *service.EventService) *UserHandler {
	return &UserHandler{svc: svc, eventSvc: eventSvc, logger: logger.NewHandlerLogger("User")}
}

func (h *UserHandler) Get(rw http.ResponseWriter, req *http.Request) {
	userId := req.Context().Value(middleware.UserIDKey).(string)
	user, err := h.svc.GetUserDetails(req.Context(), userId)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	if revision, revErr := h.eventSvc.CurrentRevision(req.Context(), userId); revErr == nil {
		rw.Header().Set("X-State-Revision", strconv.FormatInt(revision, 10))
	}
	_ = json.NewEncoder(rw).Encode(user)
}

func (h *UserHandler) Event(rw http.ResponseWriter, req *http.Request) {
	userId := req.Context().Value(middleware.UserIDKey).(string)

	var userPatch entities.UserPatchInput
	// try decoding to UserPatch
	err := json.NewDecoder(req.Body).Decode(&userPatch)
	if err != nil {
		h.logger.Error().Msg("Unable to decode to PatchInput")
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}
	userPatch.UserId = userId
	h.logger.Info().Msgf("Decoded patchInput: %+v", userPatch)

	eventTypeStr := service.EventType(req.URL.Query().Get("type"))
	eventType := service.EventType(eventTypeStr)
	if !eventType.IsValid() {
		http.Error(rw, errors.New("Event type is not valid").Error(), http.StatusBadRequest)
		return
	}

	if eventType == service.EventResetProgress || eventType == service.EventAutoResetTimeChange || eventType == service.EventRegistration || eventType == service.EventSelectedSessionChange || eventType == service.EventTimerDurationChange {
		err := h.eventSvc.HandleEvent(req.Context(), eventType, userId, &userPatch)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		http.Error(rw, "Incorrect event for this route", http.StatusBadRequest)
		return
	}

	if revision, revErr := h.eventSvc.CurrentRevision(req.Context(), userId); revErr == nil {
		rw.Header().Set("X-State-Revision", strconv.FormatInt(revision, 10))
	}
	_ = json.NewEncoder(rw).Encode(map[string]int64{"revision": userRevisionFromHeader(rw)})
}

func userRevisionFromHeader(rw http.ResponseWriter) int64 {
	value, _ := strconv.ParseInt(rw.Header().Get("X-State-Revision"), 10, 64)
	return value
}
