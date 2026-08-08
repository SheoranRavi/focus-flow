package repo

import (
	"context"
	"database/sql"
	"time"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
)

type SessionRepo struct {
	db     *sql.DB
	logger zerolog.Logger
}

func NewSessionRepo(db *sql.DB) *SessionRepo {
	return &SessionRepo{
		db:     db,
		logger: logger.NewRepoLogger("session"),
	}
}

func (repo *SessionRepo) GetAllForUser(ctx context.Context, userId string) ([]*entities.Session, error) {
	query := `
		SELECT id, user_id, title, daily_goal_minutes, state, focus_seconds, group_id, session_duration, 
			is_completed, target_time_ms, no_goal, created_at, updated_at, is_deleted, time_left
		FROM sessions
		WHERE user_id = $1
		AND is_deleted = FALSE
		ORDER BY updated_at DESC, created_at DESC
	`
	rows, err := repo.db.QueryContext(ctx, query, userId)
	if err != nil {
		repo.logger.Error().Err(err).Str("user_id", userId).Msg("Failed to query sessions")
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
			&s.UpdatedAt,
			&s.IsDeleted,
			&s.TimeLeft,
		); err != nil {
			repo.logger.Error().Err(err).Msg("Failed to scan session row")
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
		RETURNING id, created_at, updated_at
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
	).Scan(&session.Id, &session.CreatedAt, &session.UpdatedAt)

	if err != nil {
		repo.logger.Error().Err(err).Str("user_id", session.UserId).Str("title", session.Title).Msg("Failed to create session")
		return nil, err
	}
	return session, nil
}

func (repo *SessionRepo) GetAllActiveSessions(ctx context.Context) ([]*entities.Session, error) {
	query := `
		SELECT id, user_id, title, daily_goal_minutes, state, focus_seconds, group_id, session_duration, 
			is_completed, target_time_ms, no_goal, created_at, updated_at, is_deleted, time_left
		FROM sessions
		WHERE state= 1
		AND is_deleted = FALSE
		ORDER BY updated_at DESC, created_at DESC
	`

	rows, err := repo.db.QueryContext(ctx, query)
	if err != nil {
		repo.logger.Error().Err(err).Msg("Failed to get all active sessions.")
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
			&s.UpdatedAt,
			&s.IsDeleted,
			&s.TimeLeft,
		); err != nil {
			repo.logger.Error().Err(err).Msg("Failed to scan session row")
			return nil, err
		}
		sessions = append(sessions, &s)
	}
	return sessions, rows.Err()
}

func (repo *SessionRepo) GetForUser(ctx context.Context, userId string, sessionId int64) (*entities.Session, error) {
	query := `
		SELECT id, user_id, title, daily_goal_minutes, state, focus_seconds, group_id, session_duration, time_left,
		       is_completed, target_time_ms, no_goal, created_at, updated_at, is_deleted
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
		&s.TimeLeft,
		&s.IsCompleted,
		&s.TargetTimeMs,
		&s.NoGoal,
		&s.CreatedAt,
		&s.UpdatedAt,
		&s.IsDeleted,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		repo.logger.Error().Err(err).Int64("session_id", sessionId).Str("user_id", userId).Msg("Failed to get session")
		return nil, err
	}

	return &s, nil

}

func (repo *SessionRepo) Delete(ctx context.Context, sessionId int64, userId string) error {
	// ToDo: On delete, update the daily time for this session
	// ToDo: Running session can't be deleted
	query := `
		Update sessions
		SET is_deleted = TRUE
		Where id = $1
			AND user_id = $2
			AND is_deleted = FALSE
	`
	res, err := repo.db.ExecContext(ctx, query, sessionId, userId)
	if err != nil {
		repo.logger.Error().Err(err).Int64("session_id", sessionId).Str("user_id", userId).Msg("Failed to delete session")
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		repo.logger.Error().Err(err).Int64("session_id", sessionId).Msg("Failed to get rows affected")
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

func (repo *SessionRepo) Update(ctx context.Context, s *entities.Session, touchUpdatedAt bool) error {
	query := `
		WITH updated AS (
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
            is_deleted         = $9,
            updated_at         = CASE WHEN $12 THEN now() ELSE updated_at END
        WHERE id = $10
          AND user_id = $11
				RETURNING id, user_id, state
    )
    UPDATE sessions
    SET state = 0
    WHERE user_id = (SELECT user_id FROM updated)
      AND id != (SELECT id FROM updated)
      AND state = 1
	  AND (SELECT state FROM updated) = 1
	`

	res, err := repo.db.ExecContext(
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
		touchUpdatedAt,
	)
	if err != nil {
		repo.logger.Error().Err(err).Int64("session_id", s.Id).Str("user_id", s.UserId).Msg("Failed to update session")
		return err
	}
	if touchUpdatedAt {
		s.UpdatedAt = time.Now().UTC()
	}
	numAffected, rowsErr := res.RowsAffected()
	if rowsErr != nil {
		repo.logger.Warn().Err(err).Msg("SessionUpdate: could not get rows affected")
	} else {
		repo.logger.Info().Msgf("SessionUpdate number of rows impacted: %d", numAffected)
	}

	return err
}

// UpdateTimerProgress prevents an in-flight ticker from overwriting a pause
// or a newer start. The target deadline acts as the timer generation.
func (repo *SessionRepo) UpdateTimerProgress(ctx context.Context, s *entities.Session) error {
	_, err := repo.db.ExecContext(ctx, `
		UPDATE sessions
		SET focus_seconds = $1, time_left = $2
		WHERE id = $3 AND user_id = $4 AND state = 1 AND target_time_ms = $5
	`, s.FocusSeconds, s.TimeLeft, s.Id, s.UserId, s.TargetTimeMs)
	return err
}

func (repo *SessionRepo) ResetProgress(ctx context.Context, userId string, resetDate string) error {
	tx, err := repo.db.BeginTx(ctx, nil)
	if err != nil {
		repo.logger.Error().Err(err).Str("user_id", userId).Msg("Failed to begin reset transaction")
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	rows, err := tx.QueryContext(
		ctx,
		`
			SELECT id, focus_seconds, daily_goal_minutes
			FROM sessions
			WHERE user_id = $1
				AND is_deleted = FALSE
			FOR UPDATE
		`,
		userId,
	)
	if err != nil {
		repo.logger.Error().Err(err).Str("user_id", userId).Msg("Failed to load sessions for reset")
		return err
	}
	defer rows.Close()

	type dailyTimeRow struct {
		sessionId    int64
		focusSeconds int
		goalMinutes  int
	}

	sessionRows := make([]dailyTimeRow, 0)
	for rows.Next() {
		var row dailyTimeRow
		if err := rows.Scan(&row.sessionId, &row.focusSeconds, &row.goalMinutes); err != nil {
			repo.logger.Error().Err(err).Str("user_id", userId).Msg("Failed to scan session row for reset")
			return err
		}
		sessionRows = append(sessionRows, row)
	}
	if err := rows.Err(); err != nil {
		repo.logger.Error().Err(err).Str("user_id", userId).Msg("Failed to iterate session rows for reset")
		return err
	}

	const upsertDailyTimeQuery = `
		INSERT INTO task_daily_time (session_id, date, num_seconds_spent, goal_minutes)
		VALUES ($1, $2::date, $3, $4)
		ON CONFLICT (session_id, date)
		DO UPDATE SET
			num_seconds_spent = task_daily_time.num_seconds_spent + EXCLUDED.num_seconds_spent,
			goal_minutes = EXCLUDED.goal_minutes
	`
	for _, row := range sessionRows {
		_, err = tx.ExecContext(
			ctx,
			upsertDailyTimeQuery,
			row.sessionId,
			resetDate,
			row.focusSeconds,
			row.goalMinutes,
		)
		if err != nil {
			repo.logger.Error().Err(err).Int64("session_id", row.sessionId).Str("user_id", userId).Msg("Failed to upsert task daily time")
			return err
		}
	}

	_, err = tx.ExecContext(
		ctx,
		`
			UPDATE sessions
			SET
				focus_seconds = 0,
				is_completed = FALSE,
				time_left = session_duration
			WHERE user_id = $1
				AND is_deleted = FALSE
		`,
		userId,
	)
	if err != nil {
		repo.logger.Error().Err(err).Str("user_id", userId).Msg("Failed to reset progress")
		return err
	}

	if err = tx.Commit(); err != nil {
		repo.logger.Error().Err(err).Str("user_id", userId).Msg("Failed to commit reset transaction")
		return err
	}
	return nil
}

func (repo *SessionRepo) UpdateTaskDailyTimeGoal(ctx context.Context, sessionId int64, date string, goalMinutes int) error {
	res, err := repo.db.ExecContext(
		ctx,
		`
			UPDATE task_daily_time
			SET goal_minutes = $1
			WHERE session_id = $2
				AND date = $3::date
		`,
		goalMinutes,
		sessionId,
		date,
	)
	if err != nil {
		repo.logger.Error().Err(err).Int64("session_id", sessionId).Str("date", date).Msg("Failed to update task daily time goal")
		return err
	}

	rowsAffected, rowsErr := res.RowsAffected()
	if rowsErr != nil {
		repo.logger.Warn().Err(rowsErr).Int64("session_id", sessionId).Msg("Failed to read rows affected for task daily time goal update")
		return nil
	}
	if rowsAffected == 0 {
		repo.logger.Debug().Int64("session_id", sessionId).Str("date", date).Msg("No task daily time row found to update")
	}
	return nil
}

// IncrementFocusSeconds records attribution separately from the General timer
// row. The timer itself remains owned by General.
func (repo *SessionRepo) IncrementFocusSeconds(ctx context.Context, sessionId int64, userId string, seconds int) error {
	if seconds <= 0 {
		return nil
	}
	_, err := repo.db.ExecContext(ctx, `
		UPDATE sessions
		SET focus_seconds = focus_seconds + $1
		WHERE id = $2 AND user_id = $3 AND is_deleted = FALSE AND title <> 'General'
	`, seconds, sessionId, userId)
	return err
}
