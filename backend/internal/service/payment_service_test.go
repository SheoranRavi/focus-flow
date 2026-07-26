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
	got := buildSignature("payment_1", "sub_1", "secret")
	want := "8079f518e2ef1bee2bd154d13e896730f1043c5fa4aef7e353c4ea26e8837a1f"
	if got != want {
		t.Fatalf("buildSignature() = %q, want %q", got, want)
	}
}

func TestCreateSubscriptionUsesRazorpayAPI(t *testing.T) {
	var gotAuth string
	var gotPayload razorpaySubscriptionRequest

	client := &http.Client{
		Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
			gotAuth = r.Header.Get("Authorization")
			if err := json.NewDecoder(r.Body).Decode(&gotPayload); err != nil {
				t.Fatalf("failed to decode request body: %v", err)
			}
			if r.Method != http.MethodPost || !strings.HasSuffix(r.URL.Path, "/v1/subscriptions") {
				t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
			}
			payload, _ := json.Marshal(RazorpaySubscriptionEntity{
				ID:         "sub_123",
				PlanID:     gotPayload.PlanID,
				Status:     "created",
				CustomerID: "cust_123",
			})
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(string(payload))),
			}, nil
		}),
	}

	updater := &stubSubscriptionUpdater{}
	svc := NewPaymentService(updater, PaymentConfig{
		KeyID:      "key_id",
		KeySecret:  "key_secret",
		PlanIDINR:  "plan_inr",
		PlanIDUSD:  "plan_usd",
		APIBaseURL: "https://api.razorpay.com",
		Client:     client,
	})

	resp, err := svc.CreateSubscription(context.Background(), "user-1", &CreateSubscriptionRequest{Currency: "INR"})
	if err != nil {
		t.Fatalf("CreateSubscription() error = %v", err)
	}

	if resp.SubscriptionID != "sub_123" {
		t.Fatalf("resp.SubscriptionID = %q, want %q", resp.SubscriptionID, "sub_123")
	}
	if resp.PlanID != "plan_inr" {
		t.Fatalf("resp.PlanID = %q, want %q", resp.PlanID, "plan_inr")
	}
	if resp.Currency != "INR" {
		t.Fatalf("resp.Currency = %q, want %q", resp.Currency, "INR")
	}

	expectedAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte("key_id:key_secret"))
	if gotAuth != expectedAuth {
		t.Fatalf("Authorization header = %q, want %q", gotAuth, expectedAuth)
	}
	if gotPayload.PlanID != "plan_inr" {
		t.Fatalf("payload plan_id = %q, want %q", gotPayload.PlanID, "plan_inr")
	}
	if gotPayload.TotalCount != subscriptionCycleCount {
		t.Fatalf("payload total_count = %d, want %d", gotPayload.TotalCount, subscriptionCycleCount)
	}
	if gotPayload.Quantity != 1 {
		t.Fatalf("payload quantity = %d, want 1", gotPayload.Quantity)
	}
	if gotPayload.CustomerNotify != true {
		t.Fatal("expected customer_notify to be true")
	}
	if updater.patch == nil {
		t.Fatal("expected subscription patch to be applied")
	}
	if updater.patch.RazorpaySubscriptionId == nil || *updater.patch.RazorpaySubscriptionId != "sub_123" {
		t.Fatalf("expected subscription id patch, got %#v", updater.patch.RazorpaySubscriptionId)
	}
	if updater.patch.SubscriptionCurrency == nil || *updater.patch.SubscriptionCurrency != "INR" {
		t.Fatalf("expected currency patch, got %#v", updater.patch.SubscriptionCurrency)
	}
}

func TestVerifySubscriptionMarksSubscriptionActive(t *testing.T) {
	updater := &stubSubscriptionUpdater{}
	client := &http.Client{
		Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
			if r.Method != http.MethodGet || !strings.HasSuffix(r.URL.Path, "/v1/subscriptions/sub_123") {
				t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
			}
			payload, _ := json.Marshal(RazorpaySubscriptionEntity{
				ID:           "sub_123",
				PlanID:       "plan_inr",
				CustomerID:   "cust_123",
				Status:       "active",
				CurrentStart: ptrInt64(time.Now().UTC().Add(-time.Hour).Unix()),
				CurrentEnd:   ptrInt64(time.Now().UTC().Add(29 * 24 * time.Hour).Unix()),
			})
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(string(payload))),
			}, nil
		}),
	}
	svc := NewPaymentService(updater, PaymentConfig{
		KeyID:      "key_id",
		KeySecret:  "secret",
		PlanIDINR:  "plan_inr",
		PlanIDUSD:  "plan_usd",
		APIBaseURL: "https://api.razorpay.com",
		Client:     client,
	})

	err := svc.VerifySubscription(context.Background(), "user-1", &VerifySubscriptionRequest{
		RazorpaySubscriptionID: "sub_123",
		RazorpayPaymentID:      "payment_1",
		RazorpaySignature:      buildSignature("payment_1", "sub_123", "secret"),
	})
	if err != nil {
		t.Fatalf("VerifySubscription() error = %v", err)
	}

	if updater.patch == nil {
		t.Fatal("expected subscription update patch")
	}
	if updater.patch.SubscriptionTier == nil || *updater.patch.SubscriptionTier != "pro" {
		t.Fatalf("expected pro tier patch, got %#v", updater.patch.SubscriptionTier)
	}
	if updater.patch.SubscriptionStatus == nil || *updater.patch.SubscriptionStatus != "active" {
		t.Fatalf("expected active subscription status, got %#v", updater.patch.SubscriptionStatus)
	}
	if updater.patch.SubscriptionInterval == nil || *updater.patch.SubscriptionInterval != "monthly" {
		t.Fatalf("expected monthly interval, got %#v", updater.patch.SubscriptionInterval)
	}
	if updater.patch.SubscriptionStartedAt == nil || updater.patch.SubscriptionCurrentPeriodEnd == nil {
		t.Fatal("expected subscription timing fields to be set")
	}
	if updater.patch.SubscriptionCancelAtPeriodEnd == nil || *updater.patch.SubscriptionCancelAtPeriodEnd {
		t.Fatal("expected cancel-at-period-end to be false")
	}
}

func TestVerifySubscriptionRejectsBadSignature(t *testing.T) {
	svc := NewPaymentService(&stubSubscriptionUpdater{}, PaymentConfig{
		KeyID:      "key_id",
		KeySecret:  "secret",
		PlanIDINR:  "plan_inr",
		PlanIDUSD:  "plan_usd",
		APIBaseURL: "https://api.razorpay.com",
	})

	err := svc.VerifySubscription(context.Background(), "user-1", &VerifySubscriptionRequest{
		RazorpaySubscriptionID: "sub_123",
		RazorpayPaymentID:      "payment_1",
		RazorpaySignature:      "invalid",
	})
	if err != ErrPaymentSignatureMismatch {
		t.Fatalf("VerifySubscription() error = %v, want %v", err, ErrPaymentSignatureMismatch)
	}
}

func TestVerifySubscriptionRequiresFields(t *testing.T) {
	svc := NewPaymentService(&stubSubscriptionUpdater{}, PaymentConfig{
		KeyID:     "key_id",
		KeySecret: "secret",
		PlanIDINR: "plan_inr",
		PlanIDUSD: "plan_usd",
	})

	err := svc.VerifySubscription(context.Background(), "user-1", &VerifySubscriptionRequest{})
	if err != ErrPaymentMissingFields {
		t.Fatalf("VerifySubscription() error = %v, want %v", err, ErrPaymentMissingFields)
	}
}

func TestCreateSubscriptionRejectsBadAuth(t *testing.T) {
	svc := NewPaymentService(&stubSubscriptionUpdater{}, PaymentConfig{})

	_, err := svc.CreateSubscription(context.Background(), "user-1", &CreateSubscriptionRequest{})
	if err != ErrPaymentUnauthorized {
		t.Fatalf("CreateSubscription() error = %v, want %v", err, ErrPaymentUnauthorized)
	}
}

func TestCancelSubscriptionCanScheduleEnd(t *testing.T) {
	updater := &stubSubscriptionUpdater{}
	client := &http.Client{
		Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
			if r.Method != http.MethodPost || !strings.HasSuffix(r.URL.Path, "/v1/subscriptions/sub_123/cancel") {
				t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
			}
			var gotBody map[string]bool
			if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
				t.Fatalf("failed to decode request body: %v", err)
			}
			if !gotBody["cancel_at_cycle_end"] {
				t.Fatal("expected cancel_at_cycle_end to be true")
			}
			payload, _ := json.Marshal(RazorpaySubscriptionEntity{
				ID:         "sub_123",
				PlanID:     "plan_inr",
				Status:     "active",
				CustomerID: "cust_123",
			})
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(string(payload))),
			}, nil
		}),
	}
	svc := NewPaymentService(updater, PaymentConfig{
		KeyID:      "key_id",
		KeySecret:  "secret",
		PlanIDINR:  "plan_inr",
		PlanIDUSD:  "plan_usd",
		APIBaseURL: "https://api.razorpay.com",
		Client:     client,
	})

	resp, err := svc.CancelSubscription(context.Background(), "user-1", "sub_123")
	if err != nil {
		t.Fatalf("CancelSubscription() error = %v", err)
	}
	if resp.Status != "active" {
		t.Fatalf("resp.Status = %q, want %q", resp.Status, "active")
	}
	if updater.patch == nil || updater.patch.SubscriptionCancelAtPeriodEnd == nil || !*updater.patch.SubscriptionCancelAtPeriodEnd {
		t.Fatal("expected cancel-at-period-end to be true")
	}
}

func TestVerifyWebhookSignature(t *testing.T) {
	svc := NewPaymentService(&stubSubscriptionUpdater{}, PaymentConfig{
		WebhookSecret: "webhook_secret",
	})

	rawBody := []byte(`{"event":"subscription.charged"}`)
	signature := buildRawSignature(rawBody, "webhook_secret")
	if !svc.VerifyWebhookSignature(rawBody, signature) {
		t.Fatal("expected webhook signature to verify")
	}
}

func ptrInt64(v int64) *int64 {
	return &v
}
