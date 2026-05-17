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
	svc    *service.PaymentService
	logger zerolog.Logger
}

func NewPaymentHandler(svc *service.PaymentService) *PaymentHandler {
	return &PaymentHandler{svc: svc, logger: logger.NewHandlerLogger("Payment")}
}

func (h *PaymentHandler) CreateOrder(rw http.ResponseWriter, req *http.Request) {
	userID := req.Context().Value(middleware.UserIDKey).(string)

	var createReq service.CreateOrderRequest
	if err := decodeJSON(req.Body, &createReq); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}

	order, err := h.svc.CreateOrder(req.Context(), userID, &createReq)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPaymentUnauthorized):
			http.Error(rw, err.Error(), http.StatusUnauthorized)
		case errors.Is(err, service.ErrPaymentAmountTooSmall):
			http.Error(rw, err.Error(), http.StatusBadRequest)
		default:
			h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to create Razorpay order")
			http.Error(rw, "Failed to create Razorpay order", http.StatusInternalServerError)
		}
		return
	}

	_ = json.NewEncoder(rw).Encode(order)
}

func (h *PaymentHandler) VerifyPayment(rw http.ResponseWriter, req *http.Request) {
	userID := req.Context().Value(middleware.UserIDKey).(string)

	var verifyReq service.VerifyPaymentRequest
	if err := decodeJSON(req.Body, &verifyReq); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.svc.VerifyPayment(req.Context(), userID, &verifyReq); err != nil {
		switch {
		case errors.Is(err, service.ErrPaymentMissingFields):
			http.Error(rw, err.Error(), http.StatusBadRequest)
		case errors.Is(err, service.ErrPaymentSignatureMismatch):
			http.Error(rw, err.Error(), http.StatusBadRequest)
		case errors.Is(err, service.ErrPaymentUnauthorized):
			http.Error(rw, err.Error(), http.StatusUnauthorized)
		default:
			h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to verify Razorpay payment")
			http.Error(rw, "Failed to verify Razorpay payment", http.StatusInternalServerError)
		}
		return
	}

	_ = json.NewEncoder(rw).Encode(map[string]bool{"success": true})
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
