package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
)

var ErrWebhookEventAlreadyProcessed = errors.New("webhook event already processed")
var ErrWebhookEventInProgress = errors.New("webhook event already processing")

const webhookProcessingLease = 5 * time.Minute

type WebhookEventStatus string

const (
	WebhookEventStatusProcessing WebhookEventStatus = "processing"
	WebhookEventStatusProcessed  WebhookEventStatus = "processed"
	WebhookEventStatusFailed     WebhookEventStatus = "failed"
)

type RazorpayWebhookEventRepo struct {
	db     *sql.DB
	logger zerolog.Logger
}

func NewRazorpayWebhookEventRepo(db *sql.DB) *RazorpayWebhookEventRepo {
	return &RazorpayWebhookEventRepo{
		db:     db,
		logger: logger.NewRepoLogger("razorpay_webhook_event"),
	}
}

func (repo *RazorpayWebhookEventRepo) Acquire(ctx context.Context, eventID, eventType, subscriptionID string, payload any) (bool, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return false, err
	}

	query := `
		INSERT INTO razorpay_webhook_events (
			event_id,
			event_type,
			subscription_id,
			payload,
			status,
			status_updated_at
		)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`
	_, err = repo.db.ExecContext(ctx, query, eventID, eventType, nullableString(subscriptionID), string(payloadBytes), WebhookEventStatusProcessing)
	if err != nil {
		if isUniqueViolation(err) {
			return repo.resolveExistingEvent(ctx, eventID)
		}
		repo.logger.Error().Err(err).Str("event_id", eventID).Msg("Failed to record webhook event")
		return false, err
	}
	return true, nil
}

func (repo *RazorpayWebhookEventRepo) MarkProcessed(ctx context.Context, eventID string) error {
	return repo.updateStatus(ctx, eventID, WebhookEventStatusProcessed, nil)
}

func (repo *RazorpayWebhookEventRepo) MarkFailed(ctx context.Context, eventID string, reason error) error {
	return repo.updateStatus(ctx, eventID, WebhookEventStatusFailed, reason)
}

func (repo *RazorpayWebhookEventRepo) resolveExistingEvent(ctx context.Context, eventID string) (bool, error) {
	var status WebhookEventStatus
	var updatedAt time.Time
	query := `
		SELECT status, status_updated_at
		FROM razorpay_webhook_events
		WHERE event_id = $1
	`
	if err := repo.db.QueryRowContext(ctx, query, eventID).Scan(&status, &updatedAt); err != nil {
		repo.logger.Error().Err(err).Str("event_id", eventID).Msg("Failed to load webhook event status")
		return false, err
	}

	switch status {
	case WebhookEventStatusProcessed:
		return false, ErrWebhookEventAlreadyProcessed
	case WebhookEventStatusProcessing:
		if time.Since(updatedAt) <= webhookProcessingLease {
			return false, ErrWebhookEventInProgress
		}
		if err := repo.updateStatus(ctx, eventID, WebhookEventStatusProcessing, nil); err != nil {
			return false, err
		}
		return true, nil
	case WebhookEventStatusFailed:
		if err := repo.updateStatus(ctx, eventID, WebhookEventStatusProcessing, nil); err != nil {
			return false, err
		}
		return true, nil
	default:
		repo.logger.Error().Str("event_id", eventID).Str("status", string(status)).Msg("Unknown webhook event status")
		return false, errors.New("unknown webhook event status")
	}
}

func (repo *RazorpayWebhookEventRepo) updateStatus(ctx context.Context, eventID string, status WebhookEventStatus, reason error) error {
	query := `
		UPDATE razorpay_webhook_events
		SET
			status = $2,
			status_updated_at = NOW(),
			processed_at = $3,
			failed_at = $4,
			last_error = $5
		WHERE event_id = $1
	`
	var processedAt any
	var failedAt any
	var errorText any

	switch status {
	case WebhookEventStatusProcessing:
		processedAt = nil
		failedAt = nil
		errorText = nil
	case WebhookEventStatusProcessed:
		processedAt = time.Now().UTC()
		failedAt = nil
		errorText = nil
	case WebhookEventStatusFailed:
		processedAt = nil
		failedAt = time.Now().UTC()
		if reason != nil {
			errorText = reason.Error()
		}
	default:
		return errors.New("unknown webhook event status")
	}

	_, err := repo.db.ExecContext(ctx, query, eventID, status, processedAt, failedAt, errorText)
	if err != nil {
		repo.logger.Error().Err(err).Str("event_id", eventID).Str("status", string(status)).Msg("Failed to update webhook event status")
		return err
	}
	return nil
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}
