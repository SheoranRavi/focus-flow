package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"time"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/middleware"
	"github.com/sheoranravi/focus-flow/backend/internal/service"
)

type UserHandler struct {
	svc    *service.UserService
	logger zerolog.Logger
}

func NewUserHandler(svc *service.UserService) *UserHandler {
	return &UserHandler{svc: svc, logger: logger.NewHandlerLogger("User")}
}

func (h *UserHandler) Get(rw http.ResponseWriter, req *http.Request) {
	userId := req.Context().Value(middleware.UserIDKey).(string)
	user, err := h.svc.GetUserDetails(req.Context(), userId)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(rw).Encode(user)
}

func (h *UserHandler) UpdateResetTime(rw http.ResponseWriter, req *http.Request) {
	userId := req.Context().Value(middleware.UserIDKey).(string)
	resetTime := req.URL.Query().Get("resettime")
	timezone := req.URL.Query().Get("timezone")
	// validate
	pattern := `^\d\d:\d\d$`
	matched, _ := regexp.MatchString(pattern, resetTime)
	if !matched {
		http.Error(rw, "resetTime not correct", http.StatusBadRequest)
	}
	_, err := time.LoadLocation(timezone)
	if err != nil {
		http.Error(rw, "timezone not correct", http.StatusBadRequest)
	}
	patch := entities.UserPatchInput{
		SessionResetTime: &resetTime,
		Timezone:         &timezone,
		UserId:           userId,
	}
	h.svc.Update(req.Context(), &patch)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	rw.WriteHeader(http.StatusNoContent)
}
