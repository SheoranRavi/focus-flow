package repo

import (
	"context"
	"database/sql"

	"github.com/sheoranravi/focus-flow/backend/internal/entities"
)

type SessionRepo struct {
	db *sql.DB
}

func NewSessionRepo(db *sql.DB) *SessionRepo {
	return &SessionRepo{db: db}
}

func (this *SessionRepo) GetAllForUser(ctx context.Context, userId string) ([]*entities.Session, error) {
	query := `
		SELECT id, user_id, title, daily_goal_minutes, state, focus_seconds, group_id, initial_duration, 
			is_completed, target_time_ms, no_goal, created_at, is_deleted
		FROM sessions
		WHERE user_id = $1
		AND is_deleted = 0
		ORDER BY created_at DESC
	`
	rows, err := this.db.QueryContext(ctx, query, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []*entities.Session

	for rows.Next() {
		var s entities.Session
		if err := rows.Scan(
			&s.Id,
			&s.UserId,
			&s.Title,
			&s.DailyGoalMinutes,
			&s.State,
			&s.FocusSeconds,
			&s.GroupId,
			&s.InitialDuration,
			&s.IsCompleted,
			&s.TargetTimeMs,
			&s.NoGoal,
			&s.CreatedAt,
			&s.IsDeleted,
		); err != nil {
			return nil, err
		}
		sessions = append(sessions, &s)
	}
	return sessions, rows.Err()
}

func (this *SessionRepo) Create(ctx context.Context, session *entities.Session) (*entities.Session, error) {
	query := `
		INSERT INTO sessions (user_id, title, daily_goal_minutes, initial_duration, no_goal, group_id created_at)
		VALUES ($1, $2, $3, $4, $5, $6, now())
		RETURNING id, created_at
	`
	err := this.db.QueryRowContext(
		ctx,
		query,
		session.UserId,
		session.Title,
		session.DailyGoalMinutes,
		session.InitialDuration,
		session.NoGoal,
		session.GroupId,
	).Scan(&session.Id, &session.CreatedAt)

	if err != nil {
		return nil, err
	}
	return session, nil
}

func (this *SessionRepo) GetForUser(ctx context.Context, userId string, sessionId int64) (*entities.Session, error) {
	query := `
		SELECT id, user_id, title, daily_goal_minutes, state, focus_seconds, group_id, initial_duration,
		       is_completed, target_time_ms, no_goal, created_at, is_deleted
		FROM sessions
		WHERE id = $1
		  AND user_id = $2
		  AND is_deleted = 0
	`

	var s entities.Session

	err := this.db.QueryRowContext(ctx, query, sessionId, userId).Scan(
		&s.Id,
		&s.UserId,
		&s.Title,
		&s.DailyGoalMinutes,
		&s.State,
		&s.FocusSeconds,
		&s.GroupId,
		&s.InitialDuration,
		&s.IsCompleted,
		&s.TargetTimeMs,
		&s.NoGoal,
		&s.CreatedAt,
		&s.IsDeleted,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &s, nil

}

func (this *SessionRepo) Delete(ctx context.Context, sessionId int, userId int) error {
	query := `
		Update sessions
		SET is_deleted = 1
		Where id = $1
			AND user_id = $2
			AND is_deleted = 0
	`
	res, err := this.db.ExecContext(ctx, query, sessionId, userId)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		// Either:
		// - session does not exist
		// - does not belong to user
		// - already deleted
		return sql.ErrNoRows
	}

	return nil
}

func (this *SessionRepo) Update(ctx context.Context, s *entities.Session) error {
	query := `
		UPDATE sessions
		SET
			daily_goal_minutes = $1,
			state              = $2,
			focus_seconds      = $3,
			initial_duration   = $4,
			is_completed       = $5,
			target_time_ms     = $6,
			no_goal            = $7,
			is_deleted         = $8
		WHERE id = $9
		  AND user_id = $10
	`

	_, err := this.db.ExecContext(
		ctx,
		query,
		s.DailyGoalMinutes,
		s.State,
		s.FocusSeconds,
		s.InitialDuration,
		s.IsCompleted,
		s.TargetTimeMs,
		s.NoGoal,
		s.IsDeleted,
		s.Id,
		s.UserId,
	)

	return err
}
