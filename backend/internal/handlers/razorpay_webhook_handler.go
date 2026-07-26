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

	claimed, err := h.eventRepo.Acquire(req.Context(), eventID, event.Event, subscription.ID, event)
	if err != nil {
		switch {
		case errors.Is(err, repo.ErrWebhookEventAlreadyProcessed):
			rw.WriteHeader(http.StatusOK)
			return
		case errors.Is(err, repo.ErrWebhookEventInProgress):
			rw.WriteHeader(http.StatusOK)
			return
		default:
			h.logger.Error().Err(err).Str("event_id", eventID).Msg("Failed to persist webhook event")
			http.Error(rw, "Failed to record webhook event", http.StatusInternalServerError)
			return
		}
	}
	if !claimed {
		rw.WriteHeader(http.StatusOK)
		return
	}

	user, err := h.userSvc.GetUserByRazorpaySubscriptionID(req.Context(), subscription.ID)
	if err != nil {
		if markErr := h.eventRepo.MarkFailed(req.Context(), eventID, err); markErr != nil {
			h.logger.Error().Err(markErr).Str("event_id", eventID).Msg("Failed to mark webhook event failed")
		}
		h.logger.Error().Err(err).Str("subscription_id", subscription.ID).Msg("Failed to load user for webhook")
		http.Error(rw, "Failed to load subscription state", http.StatusInternalServerError)
		return
	}
	if user == nil {
		markErr := h.eventRepo.MarkFailed(req.Context(), eventID, errors.New("unknown subscription"))
		if markErr != nil {
			h.logger.Error().Err(markErr).Str("subscription_id", subscription.ID).Msg("Failed to mark webhook event failed")
		}
		h.logger.Warn().Str("subscription_id", subscription.ID).Msg("Ignoring webhook for unknown subscription")
		http.Error(rw, "Unknown subscription", http.StatusUnprocessableEntity)
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
	if event.Event == "subscription.cancelled" && patch.SubscriptionCancelledAt == nil {
		now := time.Now().UTC()
		patch.SubscriptionCancelledAt = &now
	}

	if err := h.userSvc.Update(req.Context(), patch); err != nil {
		if markErr := h.eventRepo.MarkFailed(req.Context(), eventID, err); markErr != nil {
			h.logger.Error().Err(markErr).Str("event_id", eventID).Msg("Failed to mark webhook event failed")
		}
		h.logger.Error().Err(err).Str("subscription_id", subscription.ID).Msg("Failed to apply webhook update")
		http.Error(rw, "Failed to update subscription state", http.StatusInternalServerError)
		return
	}

	if err := h.eventRepo.MarkProcessed(req.Context(), eventID); err != nil {
		h.logger.Error().Err(err).Str("event_id", eventID).Msg("Failed to mark webhook event processed")
		http.Error(rw, "Failed to finalize webhook event", http.StatusInternalServerError)
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
