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

func (repo *SessionRepo) GetAllForUser(ctx context.Context, userId string) ([]*entities.Session, error) {
	query := `
		SELECT id, user_id, title, daily_goal_minutes, state, focus_seconds, group_id, session_duration, 
			is_completed, target_time_ms, no_goal, created_at, is_deleted, time_left
		FROM sessions
		WHERE user_id = $1
		AND is_deleted = FALSE
		ORDER BY created_at DESC
	`
	rows, err := repo.db.QueryContext(ctx, query, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sessions := make([]*entities.Session, 0)

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
			&s.SessionDuration,
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

func (repo *SessionRepo) Create(ctx context.Context, session *entities.Session) (*entities.Session, error) {
	query := `
		INSERT INTO sessions (user_id, title, daily_goal_minutes, session_duration, time_left, no_goal, group_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, now())
		RETURNING id, created_at
	`
	err := repo.db.QueryRowContext(
		ctx,
		query,
		session.UserId,
		session.Title,
		session.DailyGoalMinutes,
		session.SessionDuration,
		session.TimeLeft,
		session.NoGoal,
		session.GroupId,
	).Scan(&session.Id, &session.CreatedAt)

	if err != nil {
		return nil, err
	}
	return session, nil
}

func (repo *SessionRepo) GetForUser(ctx context.Context, userId string, sessionId int64) (*entities.Session, error) {
	query := `
		SELECT id, user_id, title, daily_goal_minutes, state, focus_seconds, group_id, session_duration, time_left,
		       is_completed, target_time_ms, no_goal, created_at, is_deleted
		FROM sessions
		WHERE id = $1
		  AND user_id = $2
		  AND is_deleted = FALSE
	`

	var s entities.Session

	err := repo.db.QueryRowContext(ctx, query, sessionId, userId).Scan(
		&s.Id,
		&s.UserId,
		&s.Title,
		&s.DailyGoalMinutes,
		&s.State,
		&s.FocusSeconds,
		&s.GroupId,
		&s.SessionDuration,
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

func (repo *SessionRepo) Delete(ctx context.Context, sessionId int64, userId string) error {
	query := `
		Update sessions
		SET is_deleted = TRUE
		Where id = $1
			AND user_id = $2
			AND is_deleted = FALSE
	`
	res, err := repo.db.ExecContext(ctx, query, sessionId, userId)
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

func (repo *SessionRepo) Update(ctx context.Context, s *entities.Session) error {
	query := `
		UPDATE sessions
		SET
			daily_goal_minutes = $1,
			state              = $2,
			focus_seconds      = $3,
			session_duration   = $4,
			time_left          = $5,
			is_completed       = $6,
			target_time_ms     = $7,
			no_goal            = $8,
			is_deleted         = $9
		WHERE id = $9
		  AND user_id = $10
	`

	_, err := repo.db.ExecContext(
		ctx,
		query,
		s.DailyGoalMinutes,
		s.State,
		s.FocusSeconds,
		s.SessionDuration,
		s.TimeLeft,
		s.IsCompleted,
		s.TargetTimeMs,
		s.NoGoal,
		s.IsDeleted,
		s.Id,
		s.UserId,
	)

	return err
}

func (repo *SessionRepo) ResetProgress(ctx context.Context, userId string) error {
	query := `
		UPDATE sessions
		SET
			focus_seconds = 0,
			is_completed = FALSE,
			time_left = session_duration
		WHERE user_id = $1
			AND is_deleted = FALSE
	`
	_, err := repo.db.ExecContext(ctx, query, userId)
	return err
}
