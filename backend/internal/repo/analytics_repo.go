package repo

import (
	"context"
	"database/sql"
	"time"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
)

type AnalyticsRepo struct {
	db     *sql.DB
	logger zerolog.Logger
}

func NewAnalyticRepo(db *sql.DB) *AnalyticsRepo {
	return &AnalyticsRepo{db: db, logger: logger.NewRepoLogger("AnalyticsRepo")}
}

func (repo *AnalyticsRepo) ComputeAnalytics(ctx context.Context, userId string, startDate, endDate time.Time, includeDeleted bool) ([]*entities.SessionAnalytics, error) {
	query := `
		SELECT
			t.session_id,
			s.title,
			t.date,
			ROUND(t.num_seconds_spent / 60.0)::int,
			t.goal_minutes
		FROM task_daily_time t
		INNER JOIN sessions s ON s.id = t.session_id
		WHERE s.user_id = $1
			AND t.date BETWEEN $2::date AND $3::date
			AND ($4::bool OR s.is_deleted = FALSE)
		ORDER BY t.date ASC, s.id ASC
	`

	rows, err := repo.db.QueryContext(ctx, query, userId, startDate, endDate, includeDeleted)
	if err != nil {
		repo.logger.Error().Err(err).Str("user_id", userId).Time("start_date", startDate).Time("end_date", endDate).Msg("Failed to query analytics")
		return nil, err
	}
	defer rows.Close()

	analytics := make([]*entities.SessionAnalytics, 0)
	for rows.Next() {
		var item entities.SessionAnalytics
		if err := rows.Scan(
			&item.SessionId,
			&item.SessionName,
			&item.Date,
			&item.TimeSpentMinutes,
			&item.GoalMinutes,
		); err != nil {
			repo.logger.Error().Err(err).Str("user_id", userId).Msg("Failed to scan analytics row")
			return nil, err
		}
		analytics = append(analytics, &item)
	}
	if err := rows.Err(); err != nil {
		repo.logger.Error().Err(err).Str("user_id", userId).Msg("Failed to iterate analytics rows")
		return nil, err
	}

	return analytics, nil
}
