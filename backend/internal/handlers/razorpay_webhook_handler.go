package handlers

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/repo"
	"github.com/sheoranravi/focus-flow/backend/internal/service"
)

type RazorpayWebhookHandler struct {
	paymentSvc *service.PaymentService
	userSvc    *service.UserService
	eventRepo  *repo.RazorpayWebhookEventRepo
	logger     zerolog.Logger
}

func NewRazorpayWebhookHandler(paymentSvc *service.PaymentService, userSvc *service.UserService, eventRepo *repo.RazorpayWebhookEventRepo) *RazorpayWebhookHandler {
	return &RazorpayWebhookHandler{
		paymentSvc: paymentSvc,
		userSvc:    userSvc,
		eventRepo:  eventRepo,
		logger:     logger.NewHandlerLogger("RazorpayWebhook"),
	}
}

func (h *RazorpayWebhookHandler) Handle(rw http.ResponseWriter, req *http.Request) {
	rawBody, err := io.ReadAll(req.Body)
	if err != nil {
		http.Error(rw, "Failed to read webhook body", http.StatusBadRequest)
		return
	}

	signature := req.Header.Get("X-Razorpay-Signature")
	if !h.paymentSvc.VerifyWebhookSignature(rawBody, signature) {
		http.Error(rw, "Invalid webhook signature", http.StatusBadRequest)
		return
	}

	event, err := h.paymentSvc.ParseWebhookEvent(rawBody)
	if err != nil {
		http.Error(rw, "Failed to parse webhook payload", http.StatusBadRequest)
		return
	}

	subscription := event.Payload.Subscription.Entity
	if strings.TrimSpace(subscription.ID) == "" {
		http.Error(rw, "Missing subscription id in webhook payload", http.StatusBadRequest)
		return
	}

	eventID := strings.TrimSpace(event.ID)
	if eventID == "" {
		eventID = strings.TrimSpace(event.Event) + ":" + subscription.ID + ":" + time.Unix(event.CreatedAt, 0).UTC().Format(time.RFC3339Nano)
	}

	if err := h.eventRepo.Record(req.Context(), eventID, event.Event, subscription.ID, event); err != nil {
		if errors.Is(err, repo.ErrWebhookEventAlreadyProcessed) {
			rw.WriteHeader(http.StatusOK)
			return
		}
		h.logger.Error().Err(err).Str("event_id", eventID).Msg("Failed to persist webhook event")
		http.Error(rw, "Failed to record webhook event", http.StatusInternalServerError)
		return
	}

	user, err := h.userSvc.GetUserByRazorpaySubscriptionID(req.Context(), subscription.ID)
	if err != nil {
		h.logger.Error().Err(err).Str("subscription_id", subscription.ID).Msg("Failed to load user for webhook")
		http.Error(rw, "Failed to load subscription state", http.StatusInternalServerError)
		return
	}
	if user == nil {
		h.logger.Warn().Str("subscription_id", subscription.ID).Msg("Ignoring webhook for unknown subscription")
		rw.WriteHeader(http.StatusOK)
		return
	}

	cancelAtPeriodEnd := user.SubscriptionCancelAtPeriodEnd
	if event.Event == "subscription.cancelled" {
		cancelAtPeriodEnd = false
	}
	currency := user.SubscriptionCurrency
	if currency == nil || strings.TrimSpace(*currency) == "" {
		currencyValue := h.paymentSvc.CurrencyForPlan(subscription.PlanID)
		if currencyValue != "" {
			currency = &currencyValue
		}
	}

	patch := service.SubscriptionPatchFromEntity(user.Id, derefString(currency), &subscription, time.Now().UTC(), &cancelAtPeriodEnd)
	if event.Event == "subscription.cancelled" {
		now := time.Now().UTC()
		patch.SubscriptionCancelledAt = &now
	}

	if err := h.userSvc.Update(req.Context(), patch); err != nil {
		h.logger.Error().Err(err).Str("subscription_id", subscription.ID).Msg("Failed to apply webhook update")
		http.Error(rw, "Failed to update subscription state", http.StatusInternalServerError)
		return
	}

	rw.WriteHeader(http.StatusOK)
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
