package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/middleware"
	"github.com/sheoranravi/focus-flow/backend/internal/service"
)

type AnalyticsHandler struct {
	svc    *service.AnalyticsService
	logger zerolog.Logger
}

func NewAnalyticHandler(svc *service.AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{svc: svc, logger: logger.NewHandlerLogger("AnalyticsHandler")}
}

func (h *AnalyticsHandler) Get(rw http.ResponseWriter, req *http.Request) {
	userId := req.Context().Value(middleware.UserIDKey).(string)
	startDate, err := parseDateQueryParam(req, "startDate")
	if err != nil {
		h.logger.Error().Str("userId", userId).Msg("startDate not formatted correctly")
		http.Error(rw, "startDate not formatted correctly", http.StatusBadRequest)
		return
	}
	endDate, err := parseDateQueryParam(req, "endDate")
	if err != nil {
		h.logger.Error().Str("userId", userId).Msg("endDate not formatted correctly")
		http.Error(rw, "endDate not formatted correctly", http.StatusBadRequest)
		return
	}
	includeDeleted := false
	if includeDeletedRaw := req.URL.Query().Get("includeDeleted"); includeDeletedRaw != "" {
		includeDeleted, err = strconv.ParseBool(includeDeletedRaw)
		if err != nil {
			h.logger.Error().Str("userId", userId).Msg("includeDeleted not formatted correctly")
			http.Error(rw, "includeDeleted must be a boolean", http.StatusBadRequest)
			return
		}
	}
	analytics, err := h.svc.GetAnalytics(req.Context(), userId, startDate, endDate, includeDeleted)
	if err != nil {
		if errors.Is(err, service.ErrAnalyticsInvalidRange) || errors.Is(err, service.ErrAnalyticsRangeTooLarge) {
			http.Error(rw, err.Error(), http.StatusBadRequest)
			return
		}
		h.logger.Error().Str("userId", userId).Err(err).Msg("Error getting analytic events")
		http.Error(rw, "Not able to get analytic events", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(rw).Encode(analytics)
}

func parseDateQueryParam(req *http.Request, key string) (time.Time, error) {
	raw := req.URL.Query().Get(key)
	if raw == "" {
		return time.Time{}, errors.New(key + " is required")
	}

	parsed, err := time.ParseInLocation("2006-01-02", raw, time.UTC)
	if err != nil {
		return time.Time{}, err
	}

	return parsed.UTC(), nil
}
