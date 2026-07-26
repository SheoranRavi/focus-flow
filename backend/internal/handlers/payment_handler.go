package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/middleware"
	"github.com/sheoranravi/focus-flow/backend/internal/service"
)

type PaymentHandler struct {
	svc     *service.PaymentService
	userSvc *service.UserService
	logger  zerolog.Logger
}

func NewPaymentHandler(svc *service.PaymentService, userSvc *service.UserService) *PaymentHandler {
	return &PaymentHandler{svc: svc, userSvc: userSvc, logger: logger.NewHandlerLogger("Payment")}
}

func (h *PaymentHandler) CreateSubscription(rw http.ResponseWriter, req *http.Request) {
	userID := req.Context().Value(middleware.UserIDKey).(string)

	var createReq service.CreateSubscriptionRequest
	if err := decodeJSON(req.Body, &createReq); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}

	order, err := h.svc.CreateSubscription(req.Context(), userID, &createReq)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPaymentUnauthorized):
			http.Error(rw, err.Error(), http.StatusUnauthorized)
		case errors.Is(err, service.ErrUnsupportedCurrency):
			http.Error(rw, err.Error(), http.StatusBadRequest)
		case errors.Is(err, service.ErrMissingPlanID):
			http.Error(rw, err.Error(), http.StatusBadRequest)
		default:
			h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to create Razorpay subscription")
			http.Error(rw, "Failed to create Razorpay subscription", http.StatusInternalServerError)
		}
		return
	}

	_ = json.NewEncoder(rw).Encode(order)
}

func (h *PaymentHandler) VerifySubscription(rw http.ResponseWriter, req *http.Request) {
	userID := req.Context().Value(middleware.UserIDKey).(string)

	var verifyReq service.VerifySubscriptionRequest
	if err := decodeJSON(req.Body, &verifyReq); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}

	// verify that the subscription matches
	subsUser, err := h.userSvc.GetUserByRazorpaySubscriptionID(req.Context(), verifyReq.RazorpaySubscriptionID)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to verify Razorpay subscription, error fetching user by subscription id")
		http.Error(rw, "Failed to verify Razorpay subscription", http.StatusInternalServerError)
		return
	}

	if subsUser == nil || subsUser.Id != userID {
		h.logger.Error().Str("user_id", userID).Str("subscription_id", verifyReq.RazorpaySubscriptionID).Msg("There is no user for this subscription id or it doesn't match the user.")
		http.Error(rw, "Subscription and user don't match", http.StatusBadRequest)
		return
	}

	if err := h.svc.VerifySubscription(req.Context(), userID, &verifyReq); err != nil {
		switch {
		case errors.Is(err, service.ErrPaymentMissingFields):
			http.Error(rw, err.Error(), http.StatusBadRequest)
		case errors.Is(err, service.ErrPaymentSignatureMismatch):
			http.Error(rw, err.Error(), http.StatusBadRequest)
		case errors.Is(err, service.ErrPaymentUnauthorized):
			http.Error(rw, err.Error(), http.StatusUnauthorized)
		default:
			h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to verify Razorpay subscription")
			http.Error(rw, "Failed to verify Razorpay subscription", http.StatusInternalServerError)
		}
		return
	}

	_ = json.NewEncoder(rw).Encode(map[string]bool{"success": true})
}

func (h *PaymentHandler) CancelSubscription(rw http.ResponseWriter, req *http.Request) {
	userID := req.Context().Value(middleware.UserIDKey).(string)

	var cancelReq struct{}
	if err := decodeJSON(req.Body, &cancelReq); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}

	user, err := h.userSvc.GetUserDetails(req.Context(), userID)
	if err != nil {
		http.Error(rw, "Failed to load subscription state", http.StatusInternalServerError)
		return
	}
	if user == nil || user.RazorpaySubscriptionId == nil || *user.RazorpaySubscriptionId == "" {
		http.Error(rw, "No active subscription found", http.StatusBadRequest)
		return
	}

	resp, err := h.svc.CancelSubscription(req.Context(), userID, *user.RazorpaySubscriptionId)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPaymentUnauthorized):
			http.Error(rw, err.Error(), http.StatusUnauthorized)
		case errors.Is(err, service.ErrPaymentMissingFields):
			http.Error(rw, err.Error(), http.StatusBadRequest)
		default:
			h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to cancel Razorpay subscription")
			http.Error(rw, "Failed to cancel Razorpay subscription", http.StatusInternalServerError)
		}
		return
	}

	_ = json.NewEncoder(rw).Encode(resp)
}

func decodeJSON(body io.ReadCloser, dst any) error {
	defer body.Close()

	decoder := json.NewDecoder(body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			return nil
		}
		return err
	}
	return nil
}
