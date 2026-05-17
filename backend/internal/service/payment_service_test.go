package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/sheoranravi/focus-flow/backend/internal/entities"
)

type stubSubscriptionUpdater struct {
	patch *entities.UserPatchInput
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (s *stubSubscriptionUpdater) Update(ctx context.Context, patch *entities.UserPatchInput) error {
	s.patch = patch
	return nil
}

func (f roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestBuildSignature(t *testing.T) {
	got := buildSignature("order_1", "payment_1", "secret")
	want := "599b3e0f4291a6073d6b7362df20d5ca3e80fbe10466b6258770e405c060abd8"
	if got != want {
		t.Fatalf("buildSignature() = %q, want %q", got, want)
	}
}

func TestVerifyPaymentMarksSubscriptionActive(t *testing.T) {
	updater := &stubSubscriptionUpdater{}
	svc := NewPaymentService(updater, PaymentConfig{
		KeyID:               "rzp_test_key",
		KeySecret:           "secret",
		CheckoutAmountPaise: 19900,
		Currency:            "INR",
	})

	err := svc.VerifyPayment(context.Background(), "user-1", &VerifyPaymentRequest{
		RazorpayOrderID:   "order_1",
		RazorpayPaymentID: "payment_1",
		RazorpaySignature: buildSignature("order_1", "payment_1", "secret"),
	})
	if err != nil {
		t.Fatalf("VerifyPayment() error = %v", err)
	}

	if updater.patch == nil {
		t.Fatal("expected subscription update patch")
	}
	if updater.patch.UserId != "user-1" {
		t.Fatalf("patch.UserId = %q, want %q", updater.patch.UserId, "user-1")
	}
	if updater.patch.SubscriptionTier == nil || *updater.patch.SubscriptionTier != "pro" {
		t.Fatalf("expected pro tier patch, got %#v", updater.patch.SubscriptionTier)
	}
	if updater.patch.SubscriptionStatus == nil || *updater.patch.SubscriptionStatus != "active" {
		t.Fatalf("expected active subscription status, got %#v", updater.patch.SubscriptionStatus)
	}
	if updater.patch.SubscriptionInterval == nil || *updater.patch.SubscriptionInterval != "one_time" {
		t.Fatalf("expected one_time interval, got %#v", updater.patch.SubscriptionInterval)
	}
	if updater.patch.SubscriptionStartedAt == nil || updater.patch.SubscriptionUpdatedAt == nil {
		t.Fatal("expected timestamps to be set")
	}
	if updater.patch.SubscriptionCancelAtPeriodEnd == nil || *updater.patch.SubscriptionCancelAtPeriodEnd {
		t.Fatal("expected cancel-at-period-end to be false")
	}
}

func TestCreateOrderUsesRazorpayAPI(t *testing.T) {
	var gotAuth string
	var gotPayload razorpayOrderPayload

	client := &http.Client{
		Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
			gotAuth = r.Header.Get("Authorization")
			if err := json.NewDecoder(r.Body).Decode(&gotPayload); err != nil {
				t.Fatalf("failed to decode request body: %v", err)
			}
			payload, _ := json.Marshal(razorpayOrderResponse{
				ID:       "order_123",
				Amount:   gotPayload.Amount,
				Currency: gotPayload.Currency,
			})
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(string(payload))),
			}, nil
		}),
	}

	svc := NewPaymentService(&stubSubscriptionUpdater{}, PaymentConfig{
		KeyID:               "key_id",
		KeySecret:           "key_secret",
		CheckoutAmountPaise: 19900,
		Currency:            "INR",
		APIBaseURL:          "https://api.razorpay.com",
		Client:              client,
	})

	resp, err := svc.CreateOrder(context.Background(), "user-1", &CreateOrderRequest{})
	if err != nil {
		t.Fatalf("CreateOrder() error = %v", err)
	}

	if resp.OrderID != "order_123" {
		t.Fatalf("resp.OrderID = %q, want %q", resp.OrderID, "order_123")
	}
	if resp.Amount != 19900 {
		t.Fatalf("resp.Amount = %d, want %d", resp.Amount, 19900)
	}
	if resp.Currency != "INR" {
		t.Fatalf("resp.Currency = %q, want %q", resp.Currency, "INR")
	}

	expectedAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte("key_id:key_secret"))
	if gotAuth != expectedAuth {
		t.Fatalf("Authorization header = %q, want %q", gotAuth, expectedAuth)
	}
	if gotPayload.Amount != 19900 {
		t.Fatalf("payload amount = %d, want %d", gotPayload.Amount, 19900)
	}
	if gotPayload.Currency != "INR" {
		t.Fatalf("payload currency = %q, want %q", gotPayload.Currency, "INR")
	}
	if gotPayload.Receipt == "" {
		t.Fatal("expected receipt to be set")
	}
}

func TestReceiptBuildsWithStablePrefix(t *testing.T) {
	receipt := buildReceipt("user-1")
	if receipt == "" {
		t.Fatal("expected receipt to be non-empty")
	}
	if len(receipt) > 40 {
		t.Fatalf("receipt is too long: %q (%d chars)", receipt, len(receipt))
	}
	if !strings.HasPrefix(receipt, "ff-user-1-") {
		t.Fatalf("receipt has unexpected prefix: %q", receipt)
	}
}

func TestVerifyPaymentRejectsBadSignature(t *testing.T) {
	svc := NewPaymentService(&stubSubscriptionUpdater{}, PaymentConfig{
		KeyID:               "key_id",
		KeySecret:           "key_secret",
		CheckoutAmountPaise: 19900,
		Currency:            "INR",
	})

	err := svc.VerifyPayment(context.Background(), "user-1", &VerifyPaymentRequest{
		RazorpayOrderID:   "order_1",
		RazorpayPaymentID: "payment_1",
		RazorpaySignature: "invalid",
	})
	if err == nil {
		t.Fatal("expected signature verification error")
	}
	if err != ErrPaymentSignatureMismatch {
		t.Fatalf("VerifyPayment() error = %v, want %v", err, ErrPaymentSignatureMismatch)
	}
}

func TestVerifyPaymentRequiresFields(t *testing.T) {
	svc := NewPaymentService(&stubSubscriptionUpdater{}, PaymentConfig{
		KeyID:               "key_id",
		KeySecret:           "key_secret",
		CheckoutAmountPaise: 19900,
		Currency:            "INR",
	})

	err := svc.VerifyPayment(context.Background(), "user-1", &VerifyPaymentRequest{})
	if err != ErrPaymentMissingFields {
		t.Fatalf("VerifyPayment() error = %v, want %v", err, ErrPaymentMissingFields)
	}
}

func TestCreateOrderRejectsBadAuth(t *testing.T) {
	svc := NewPaymentService(&stubSubscriptionUpdater{}, PaymentConfig{})

	_, err := svc.CreateOrder(context.Background(), "user-1", &CreateOrderRequest{})
	if err != ErrPaymentUnauthorized {
		t.Fatalf("CreateOrder() error = %v, want %v", err, ErrPaymentUnauthorized)
	}
}

func TestVerifyPaymentSetsUpdatedAt(t *testing.T) {
	updater := &stubSubscriptionUpdater{}
	svc := NewPaymentService(updater, PaymentConfig{
		KeyID:               "key_id",
		KeySecret:           "key_secret",
		CheckoutAmountPaise: 19900,
		Currency:            "INR",
	})

	nowBefore := time.Now().UTC()
	err := svc.VerifyPayment(context.Background(), "user-1", &VerifyPaymentRequest{
		RazorpayOrderID:   "order_1",
		RazorpayPaymentID: "payment_1",
		RazorpaySignature: buildSignature("order_1", "payment_1", "key_secret"),
	})
	if err != nil {
		t.Fatalf("VerifyPayment() error = %v", err)
	}
	if updater.patch.SubscriptionUpdatedAt == nil {
		t.Fatal("expected subscription updated at to be set")
	}
	if updater.patch.SubscriptionUpdatedAt.Before(nowBefore) {
		t.Fatalf("subscription updated at = %v, want after %v", updater.patch.SubscriptionUpdatedAt, nowBefore)
	}
}
