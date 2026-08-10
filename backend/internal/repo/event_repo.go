package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// UserEvent is the durable, server-ordered change log entry for one user.
type UserEvent struct {
	EventID          uuid.UUID       `json:"eventId"`
	UserID           string          `json:"userId"`
	Revision         int64           `json:"revision"`
	EventType        string          `json:"eventType"`
	SessionID        *int64          `json:"sessionId,omitempty"`
	Payload          json.RawMessage `json:"payload"`
	ClientMutationID *string         `json:"clientMutationId,omitempty"`
	CreatedAt        time.Time       `json:"createdAt"`
}

type EventRepo struct{ db *sql.DB }

func NewEventRepo(db *sql.DB) *EventRepo { return &EventRepo{db: db} }

// Append allocates a revision while holding the user's row lock. The counter
// and log insert are one transaction, so concurrent writers cannot share or
// reorder a revision.
func (r *EventRepo) Append(ctx context.Context, userID, eventType string, sessionID *int64, payload any, clientMutationID string) (*UserEvent, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	event, err := r.AppendTx(ctx, tx, userID, eventType, sessionID, payload, clientMutationID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return event, nil
}

// AppendTx appends an event to an existing transaction. This is the primitive
// used by domain repositories to make state and its revision inseparable.
func (r *EventRepo) AppendTx(ctx context.Context, tx *sql.Tx, userID, eventType string, sessionID *int64, payload any, clientMutationID string) (*UserEvent, error) {
	var err error
	// Serialize all mutations for a user before checking idempotency or
	// allocating the next revision. This also makes concurrent retries with
	// the same client mutation ID deterministic.
	var lockedUser string
	if err := tx.QueryRowContext(ctx, `SELECT id FROM users WHERE id=$1 FOR UPDATE`, userID).Scan(&lockedUser); err != nil {
		return nil, err
	}
	if clientMutationID != "" {
		var existing UserEvent
		err = tx.QueryRowContext(ctx, `SELECT event_id,user_id,revision,event_type,session_id,payload,client_mutation_id,created_at FROM user_events WHERE user_id=$1 AND client_mutation_id=$2`, userID, clientMutationID).Scan(&existing.EventID, &existing.UserID, &existing.Revision, &existing.EventType, &existing.SessionID, &existing.Payload, &existing.ClientMutationID, &existing.CreatedAt)
		if err == nil {
			return &existing, nil
		}
		if err != sql.ErrNoRows {
			return nil, err
		}
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	var revision int64
	err = tx.QueryRowContext(ctx, `UPDATE users SET event_revision=event_revision+1 WHERE id=$1 RETURNING event_revision`, userID).Scan(&revision)
	if err != nil {
		return nil, fmt.Errorf("allocate user revision: %w", err)
	}
	id := uuid.New()
	var event UserEvent
	err = tx.QueryRowContext(ctx, `INSERT INTO user_events(event_id,user_id,revision,event_type,session_id,payload,client_mutation_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING created_at`, id, userID, revision, eventType, sessionID, data, nullableMutationID(clientMutationID)).Scan(&event.CreatedAt)
	if err != nil {
		return nil, err
	}
	event.EventID, event.UserID, event.Revision, event.EventType, event.SessionID, event.Payload = id, userID, revision, eventType, sessionID, data
	if clientMutationID != "" {
		event.ClientMutationID = &clientMutationID
	}
	return &event, nil
}

func nullableMutationID(id string) any {
	if id == "" {
		return nil
	}
	return id
}

func (r *EventRepo) Replay(ctx context.Context, userID string, after int64) ([]UserEvent, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT event_id,user_id,revision,event_type,session_id,payload,client_mutation_id,created_at FROM user_events WHERE user_id=$1 AND revision>$2 ORDER BY revision ASC`, userID, after)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]UserEvent, 0)
	for rows.Next() {
		var e UserEvent
		if err := rows.Scan(&e.EventID, &e.UserID, &e.Revision, &e.EventType, &e.SessionID, &e.Payload, &e.ClientMutationID, &e.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, e)
	}
	return result, rows.Err()
}

func (r *EventRepo) CurrentRevision(ctx context.Context, userID string) (int64, error) {
	var revision int64
	err := r.db.QueryRowContext(ctx, `SELECT event_revision FROM users WHERE id=$1`, userID).Scan(&revision)
	return revision, err
}
