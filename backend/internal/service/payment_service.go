package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
)

var (
	ErrPaymentMissingFields     = errors.New("missing payment fields")
	ErrPaymentSignatureMismatch = errors.New("razorpay signature mismatch")
	ErrPaymentUnauthorized      = errors.New("razorpay authentication failed")
	ErrUnsupportedCurrency      = errors.New("unsupported subscription currency")
	ErrMissingPlanID            = errors.New("missing razorpay subscription plan id")
)

const subscriptionCycleCount = 120

type SubscriptionUpdater interface {
	Update(ctx context.Context, patch *entities.UserPatchInput) error
}

type PaymentConfig struct {
	KeyID         string
	KeySecret     string
	PlanIDINR     string
	PlanIDUSD     string
	APIBaseURL    string
	WebhookSecret string
	Client        *http.Client
}

type PaymentService struct {
	userUpdater   SubscriptionUpdater
	keyID         string
	keySecret     string
	planIDINR     string
	planIDUSD     string
	apiBaseURL    string
	webhookSecret string
	client        *http.Client
	logger        zerolog.Logger
}

type CreateSubscriptionRequest struct {
	Currency string `json:"currency,omitempty"`
}

type CreateSubscriptionResponse struct {
	SubscriptionID string `json:"subscription_id"`
	PlanID         string `json:"plan_id"`
	Status         string `json:"status"`
	Currency       string `json:"currency"`
}

type VerifySubscriptionRequest struct {
	RazorpaySubscriptionID string `json:"razorpay_subscription_id"`
	RazorpayPaymentID      string `json:"razorpay_payment_id"`
	RazorpaySignature      string `json:"razorpay_signature"`
}

type razorpaySubscriptionRequest struct {
	PlanID         string            `json:"plan_id"`
	TotalCount     int               `json:"total_count"`
	Quantity       int               `json:"quantity"`
	CustomerNotify bool              `json:"customer_notify"`
	Notes          map[string]string `json:"notes,omitempty"`
}

type RazorpaySubscriptionEntity struct {
	ID                  string `json:"id"`
	PlanID              string `json:"plan_id"`
	CustomerID          string `json:"customer_id"`
	Status              string `json:"status"`
	CurrentStart        *int64 `json:"current_start"`
	CurrentEnd          *int64 `json:"current_end"`
	EndedAt             *int64 `json:"ended_at"`
	ChargeAt            *int64 `json:"charge_at"`
	StartAt             *int64 `json:"start_at"`
	EndAt               *int64 `json:"end_at"`
	AuthAttempts        int    `json:"auth_attempts"`
	TotalCount          int    `json:"total_count"`
	PaidCount           int    `json:"paid_count"`
	CustomerNotify      bool   `json:"customer_notify"`
	CreatedAt           int64  `json:"created_at"`
	ExpireBy            *int64 `json:"expire_by"`
	RemainingCount      *int64 `json:"remaining_count"`
	HasScheduledChanges bool   `json:"has_scheduled_changes"`
}

type RazorpaySubscriptionWebhook struct {
	ID        string `json:"id"`
	Event     string `json:"event"`
	CreatedAt int64  `json:"created_at"`
	Payload   struct {
		Subscription struct {
			Entity RazorpaySubscriptionEntity `json:"entity"`
		} `json:"subscription"`
	} `json:"payload"`
}

func NewPaymentService(userUpdater SubscriptionUpdater, cfg PaymentConfig) *PaymentService {
	client := cfg.Client
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	apiBaseURL := strings.TrimRight(strings.TrimSpace(cfg.APIBaseURL), "/")
	if apiBaseURL == "" {
		apiBaseURL = "https://api.razorpay.com"
	}

	return &PaymentService{
		userUpdater:   userUpdater,
		keyID:         strings.TrimSpace(cfg.KeyID),
		keySecret:     strings.TrimSpace(cfg.KeySecret),
		planIDINR:     strings.TrimSpace(cfg.PlanIDINR),
		planIDUSD:     strings.TrimSpace(cfg.PlanIDUSD),
		apiBaseURL:    apiBaseURL,
		webhookSecret: strings.TrimSpace(cfg.WebhookSecret),
		client:        client,
		logger:        logger.NewServiceLogger("PaymentService"),
	}
}

func (svc *PaymentService) CreateSubscription(ctx context.Context, userID string, req *CreateSubscriptionRequest) (*CreateSubscriptionResponse, error) {
	if svc.keyID == "" || svc.keySecret == "" {
		return nil, ErrPaymentUnauthorized
	}

	currency, planID, err := svc.planForCurrency(req)
	if err != nil {
		return nil, err
	}

	body := razorpaySubscriptionRequest{
		PlanID:         planID,
		TotalCount:     subscriptionCycleCount,
		Quantity:       1,
		CustomerNotify: true,
		Notes: map[string]string{
			"user_id":  userID,
			"currency": currency,
		},
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, svc.apiBaseURL+"/v1/subscriptions", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	request.SetBasicAuth(svc.keyID, svc.keySecret)
	request.Header.Set("Content-Type", "application/json")

	response, err := svc.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
		return nil, ErrPaymentUnauthorized
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		errorBody, _ := io.ReadAll(response.Body)
		svc.logger.Error().
			Int("status", response.StatusCode).
			Str("body", string(errorBody)).
			Msg("Failed to create Razorpay subscription")
		return nil, fmt.Errorf("razorpay subscription creation failed: %s", response.Status)
	}

	subscription, err := decodeRazorpaySubscriptionResponse(response.Body)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	if err := svc.userUpdater.Update(ctx, SubscriptionPatchFromEntity(userID, currency, &subscription, now, ptrBool(false))); err != nil {
		return nil, err
	}

	return &CreateSubscriptionResponse{
		SubscriptionID: subscription.ID,
		PlanID:         subscription.PlanID,
		Status:         subscription.Status,
		Currency:       currency,
	}, nil
}

func (svc *PaymentService) VerifySubscription(ctx context.Context, userID string, req *VerifySubscriptionRequest) error {
	if req == nil {
		return ErrPaymentMissingFields
	}
	if strings.TrimSpace(req.RazorpaySubscriptionID) == "" ||
		strings.TrimSpace(req.RazorpayPaymentID) == "" ||
		strings.TrimSpace(req.RazorpaySignature) == "" {
		return ErrPaymentMissingFields
	}
	if svc.keySecret == "" {
		return ErrPaymentUnauthorized
	}

	expected := buildSignature(req.RazorpayPaymentID, req.RazorpaySubscriptionID, svc.keySecret)
	if !hmac.Equal([]byte(expected), []byte(strings.TrimSpace(req.RazorpaySignature))) {
		return ErrPaymentSignatureMismatch
	}

	subscription, err := svc.fetchSubscription(ctx, req.RazorpaySubscriptionID)
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	if subscription.Status == "" {
		subscription.Status = "active"
	}
	return svc.userUpdater.Update(ctx, SubscriptionPatchFromEntity(userID, svc.currencyForPlan(subscription.PlanID), subscription, now, ptrBool(false)))
}

func (svc *PaymentService) CancelSubscription(ctx context.Context, userID, subscriptionID string) (*CreateSubscriptionResponse, error) {
	if svc.keyID == "" || svc.keySecret == "" {
		return nil, ErrPaymentUnauthorized
	}
	if strings.TrimSpace(subscriptionID) == "" {
		return nil, ErrPaymentMissingFields
	}

	body := map[string]bool{"cancel_at_cycle_end": true}
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, svc.apiBaseURL+"/v1/subscriptions/"+subscriptionID+"/cancel", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	request.SetBasicAuth(svc.keyID, svc.keySecret)
	request.Header.Set("Content-Type", "application/json")

	response, err := svc.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
		return nil, ErrPaymentUnauthorized
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		errorBody, _ := io.ReadAll(response.Body)
		svc.logger.Error().
			Int("status", response.StatusCode).
			Str("body", string(errorBody)).
			Msg("Failed to cancel Razorpay subscription")
		return nil, fmt.Errorf("razorpay subscription cancellation failed: %s", response.Status)
	}

	subscription, err := decodeRazorpaySubscriptionResponse(response.Body)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	if err := svc.userUpdater.Update(ctx, SubscriptionPatchFromEntity(userID, svc.currencyForPlan(subscription.PlanID), &subscription, now, ptrBool(true))); err != nil {
		return nil, err
	}

	return &CreateSubscriptionResponse{
		SubscriptionID: subscription.ID,
		PlanID:         subscription.PlanID,
		Status:         subscription.Status,
		Currency:       svc.currencyForPlan(subscription.PlanID),
	}, nil
}

func (svc *PaymentService) VerifyWebhookSignature(rawBody []byte, signature string) bool {
	if svc.webhookSecret == "" || strings.TrimSpace(signature) == "" {
		return false
	}
	expected := buildRawSignature(rawBody, svc.webhookSecret)
	return hmac.Equal([]byte(expected), []byte(strings.TrimSpace(signature)))
}

func (svc *PaymentService) ParseWebhookEvent(rawBody []byte) (*RazorpaySubscriptionWebhook, error) {
	var event RazorpaySubscriptionWebhook
	if err := json.Unmarshal(rawBody, &event); err != nil {
		return nil, err
	}
	return &event, nil
}

func (svc *PaymentService) fetchSubscription(ctx context.Context, subscriptionID string) (*RazorpaySubscriptionEntity, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, svc.apiBaseURL+"/v1/subscriptions/"+subscriptionID, nil)
	if err != nil {
		return nil, err
	}
	request.SetBasicAuth(svc.keyID, svc.keySecret)

	response, err := svc.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
		return nil, ErrPaymentUnauthorized
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("razorpay subscription fetch failed: %s", response.Status)
	}

	subscription, err := decodeRazorpaySubscriptionResponse(response.Body)
	if err != nil {
		return nil, err
	}
	return &subscription, nil
}

func (svc *PaymentService) planForCurrency(req *CreateSubscriptionRequest) (string, string, error) {
	currency := "USD"
	if req != nil && strings.TrimSpace(req.Currency) != "" {
		currency = strings.ToUpper(strings.TrimSpace(req.Currency))
	}

	switch currency {
	case "INR":
		if svc.planIDINR == "" {
			return "", "", ErrMissingPlanID
		}
		return currency, svc.planIDINR, nil
	case "USD":
		if svc.planIDUSD == "" {
			return "", "", ErrMissingPlanID
		}
		return currency, svc.planIDUSD, nil
	default:
		return "", "", ErrUnsupportedCurrency
	}
}

func (svc *PaymentService) currencyForPlan(planID string) string {
	switch strings.TrimSpace(planID) {
	case svc.planIDINR:
		return "INR"
	case svc.planIDUSD:
		return "USD"
	default:
		return ""
	}
}

func (svc *PaymentService) CurrencyForPlan(planID string) string {
	return svc.currencyForPlan(planID)
}

func decodeRazorpaySubscriptionResponse(body io.Reader) (RazorpaySubscriptionEntity, error) {
	var subscription RazorpaySubscriptionEntity
	if err := json.NewDecoder(body).Decode(&subscription); err != nil {
		return RazorpaySubscriptionEntity{}, err
	}
	return subscription, nil
}

func SubscriptionPatchFromEntity(userID, currency string, subscription *RazorpaySubscriptionEntity, now time.Time, cancelAtPeriodEnd *bool) *entities.UserPatchInput {
	tier := "pro"
	status := subscription.Status
	if status == "" {
		status = "active"
	}
	interval := "monthly"
	updatedAt := now
	patch := &entities.UserPatchInput{
		UserId:                userID,
		SubscriptionTier:      &tier,
		SubscriptionStatus:    &status,
		SubscriptionInterval:  &interval,
		SubscriptionUpdatedAt: &updatedAt,
	}

	if currency != "" {
		patch.SubscriptionCurrency = &currency
	}
	if subscription.PlanID != "" {
		patch.RazorpayPlanId = &subscription.PlanID
	}
	if subscription.CustomerID != "" {
		patch.RazorpayCustomerId = &subscription.CustomerID
	}
	if subscription.ID != "" {
		patch.RazorpaySubscriptionId = &subscription.ID
	}
	if subscription.CurrentStart != nil {
		startedAt := time.Unix(*subscription.CurrentStart, 0).UTC()
		patch.SubscriptionStartedAt = &startedAt
	}
	if subscription.CurrentEnd != nil {
		periodEnd := time.Unix(*subscription.CurrentEnd, 0).UTC()
		patch.SubscriptionCurrentPeriodEnd = &periodEnd
	}
	if subscription.EndedAt != nil {
		cancelledAt := time.Unix(*subscription.EndedAt, 0).UTC()
		patch.SubscriptionCancelledAt = &cancelledAt
	}
	if cancelAtPeriodEnd != nil {
		patch.SubscriptionCancelAtPeriodEnd = cancelAtPeriodEnd
	}

	return patch
}

func buildSignature(first, second, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(first))
	mac.Write([]byte("|"))
	mac.Write([]byte(second))
	return hex.EncodeToString(mac.Sum(nil))
}

func buildRawSignature(rawBody []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(rawBody)
	return hex.EncodeToString(mac.Sum(nil))
}

func ptrBool(value bool) *bool {
	return &value
}
