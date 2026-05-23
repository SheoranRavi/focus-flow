package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
)

var ErrWebhookEventAlreadyProcessed = errors.New("webhook event already processed")

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

func (repo *RazorpayWebhookEventRepo) Record(ctx context.Context, eventID, eventType, subscriptionID string, payload any) error {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO razorpay_webhook_events (event_id, event_type, subscription_id, payload)
		VALUES ($1, $2, $3, $4)
	`
	_, err = repo.db.ExecContext(ctx, query, eventID, eventType, nullableString(subscriptionID), payloadBytes)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrWebhookEventAlreadyProcessed
		}
		repo.logger.Error().Err(err).Str("event_id", eventID).Msg("Failed to record webhook event")
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
