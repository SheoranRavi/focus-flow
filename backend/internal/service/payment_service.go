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
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
)

var (
	ErrPaymentAmountTooSmall    = errors.New("amount must be at least 100 paise")
	ErrPaymentMissingFields     = errors.New("missing payment fields")
	ErrPaymentSignatureMismatch = errors.New("razorpay signature mismatch")
	ErrPaymentUnauthorized      = errors.New("razorpay authentication failed")
)

type SubscriptionUpdater interface {
	Update(ctx context.Context, patch *entities.UserPatchInput) error
}

type PaymentConfig struct {
	KeyID               string
	KeySecret           string
	CheckoutAmountPaise int
	Currency            string
	APIBaseURL          string
	Client              *http.Client
}

type PaymentService struct {
	userUpdater    SubscriptionUpdater
	keyID          string
	keySecret      string
	checkoutAmount int
	currency       string
	apiBaseURL     string
	client         *http.Client
	logger         zerolog.Logger
}

type CreateOrderRequest struct {
	Amount   int    `json:"amount,omitempty"`
	Currency string `json:"currency,omitempty"`
	Receipt  string `json:"receipt,omitempty"`
}

type CreateOrderResponse struct {
	OrderID  string `json:"order_id"`
	Amount   int    `json:"amount"`
	Currency string `json:"currency"`
}

type VerifyPaymentRequest struct {
	RazorpayOrderID   string `json:"razorpay_order_id"`
	RazorpayPaymentID string `json:"razorpay_payment_id"`
	RazorpaySignature string `json:"razorpay_signature"`
}

type verifyPaymentResponse struct {
	Success bool `json:"success"`
}

type razorpayOrderPayload struct {
	Amount   int    `json:"amount"`
	Currency string `json:"currency"`
	Receipt  string `json:"receipt"`
}

type razorpayOrderResponse struct {
	ID       string `json:"id"`
	Amount   int    `json:"amount"`
	Currency string `json:"currency"`
}

func NewPaymentService(userUpdater SubscriptionUpdater, cfg PaymentConfig) *PaymentService {
	client := cfg.Client
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	currency := strings.TrimSpace(cfg.Currency)
	if currency == "" {
		currency = "INR"
	}

	apiBaseURL := strings.TrimRight(strings.TrimSpace(cfg.APIBaseURL), "/")
	if apiBaseURL == "" {
		apiBaseURL = "https://api.razorpay.com"
	}

	amount := cfg.CheckoutAmountPaise
	if amount < 100 {
		amount = 19900
	}

	return &PaymentService{
		userUpdater:    userUpdater,
		keyID:          strings.TrimSpace(cfg.KeyID),
		keySecret:      strings.TrimSpace(cfg.KeySecret),
		checkoutAmount: amount,
		currency:       currency,
		apiBaseURL:     apiBaseURL,
		client:         client,
		logger:         logger.NewServiceLogger("PaymentService"),
	}
}

func (svc *PaymentService) CreateOrder(ctx context.Context, userID string, req *CreateOrderRequest) (*CreateOrderResponse, error) {
	if svc.keyID == "" || svc.keySecret == "" {
		return nil, ErrPaymentUnauthorized
	}

	amount := svc.checkoutAmount
	if req != nil && req.Amount >= 100 {
		amount = req.Amount
	}
	if amount < 100 {
		return nil, ErrPaymentAmountTooSmall
	}

	currency := svc.currency
	if req != nil && strings.TrimSpace(req.Currency) != "" {
		currency = strings.TrimSpace(req.Currency)
	}
	if currency == "" {
		currency = "INR"
	}

	receipt := ""
	if req != nil {
		receipt = strings.TrimSpace(req.Receipt)
	}
	if receipt == "" {
		receipt = buildReceipt(userID)
	}

	body := razorpayOrderPayload{
		Amount:   amount,
		Currency: currency,
		Receipt:  receipt,
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	orderURL := svc.apiBaseURL + "/v1/orders"
	svc.logger.Info().Msgf("orderURL:%s", orderURL)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, orderURL, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	request.SetBasicAuth(svc.keyID, svc.keySecret)
	svc.logger.Info().Msgf("keyId and secret: %s, %s", svc.keyID, svc.keySecret)
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
			Msg("Failed to create Razorpay order")
		return nil, fmt.Errorf("razorpay order creation failed: %s", response.Status)
	}

	var razorpayOrder razorpayOrderResponse
	if err := json.NewDecoder(response.Body).Decode(&razorpayOrder); err != nil {
		return nil, err
	}

	return &CreateOrderResponse{
		OrderID:  razorpayOrder.ID,
		Amount:   razorpayOrder.Amount,
		Currency: razorpayOrder.Currency,
	}, nil
}

func (svc *PaymentService) VerifyPayment(ctx context.Context, userID string, req *VerifyPaymentRequest) error {
	if req == nil {
		return ErrPaymentMissingFields
	}
	if strings.TrimSpace(req.RazorpayOrderID) == "" ||
		strings.TrimSpace(req.RazorpayPaymentID) == "" ||
		strings.TrimSpace(req.RazorpaySignature) == "" {
		return ErrPaymentMissingFields
	}
	if svc.keySecret == "" {
		return ErrPaymentUnauthorized
	}

	expected := buildSignature(req.RazorpayOrderID, req.RazorpayPaymentID, svc.keySecret)
	if !hmac.Equal([]byte(expected), []byte(strings.TrimSpace(req.RazorpaySignature))) {
		return ErrPaymentSignatureMismatch
	}

	interval := "one_time"
	status := "active"
	tier := "pro"
	now := time.Now().UTC()

	return svc.userUpdater.Update(ctx, &entities.UserPatchInput{
		UserId:                        userID,
		SubscriptionTier:              &tier,
		SubscriptionStatus:            &status,
		SubscriptionInterval:          &interval,
		SubscriptionStartedAt:         &now,
		SubscriptionUpdatedAt:         &now,
		SubscriptionCancelAtPeriodEnd: ptrBool(false),
	})
}

func buildReceipt(userID string) string {
	cleaned := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			return r
		case r >= 'A' && r <= 'Z':
			return r
		case r >= '0' && r <= '9':
			return r
		default:
			return '-'
		}
	}, userID)

	shortUserID := strings.Trim(cleaned, "-")
	if shortUserID == "" {
		shortUserID = "anon"
	}
	if len(shortUserID) > 16 {
		shortUserID = shortUserID[:16]
	}

	return fmt.Sprintf("ff-%s-%s", shortUserID, strings.ToLower(strconv.FormatInt(time.Now().UTC().UnixMilli(), 36)))
}

func buildSignature(orderID, paymentID, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(orderID))
	mac.Write([]byte("|"))
	mac.Write([]byte(paymentID))
	return hex.EncodeToString(mac.Sum(nil))
}

func ptrBool(value bool) *bool {
	return &value
}
