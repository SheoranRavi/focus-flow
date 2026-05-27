package repo

import (
	"context"
	"database/sql"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
)

type UserRepo struct {
	db     *sql.DB
	logger zerolog.Logger
}

func NewUserRepo(db *sql.DB) *UserRepo {
	return &UserRepo{
		db:     db,
		logger: logger.NewRepoLogger("user"),
	}
}

func (repo *UserRepo) Create(ctx context.Context, user *entities.User) (*entities.User, error) {
	query := `
		INSERT INTO users (
			id, name, email, created_at, sessions_reset_time, last_reset_date, last_auto_reset_date,
			active_session_id, yesterday_mins, streak, timezone, subscription_tier, subscription_status,
			subscription_interval, subscription_currency, razorpay_plan_id, razorpay_customer_id, razorpay_subscription_id,
			subscription_started_at, subscription_current_period_end, subscription_cancel_at_period_end, subscription_cancelled_at
		)
		VALUES (
			$1, $2, $3, now(), $4, $5, $6,
			$7, $8, $9, $10, $11, $12,
			$13, $14, $15, $16, $17, $18,
			$19, $20, $21
		)
		RETURNING id, created_at, subscription_updated_at
	`
	err := repo.db.QueryRowContext(
		ctx,
		query,
		user.Id,
		user.Name,
		user.Email,
		user.SessionsResetTime,
		user.LastResetDate,
		user.LastAutoResetDate,
		user.ActiveSessionId,
		user.YesterdayMins,
		user.Streak,
		user.Timezone,
		user.SubscriptionTier,
		user.SubscriptionStatus,
		user.SubscriptionInterval,
		user.SubscriptionCurrency,
		user.RazorpayPlanId,
		user.RazorpayCustomerId,
		user.RazorpaySubscriptionId,
		user.SubscriptionStartedAt,
		user.SubscriptionCurrentPeriodEnd,
		user.SubscriptionCancelAtPeriodEnd,
		user.SubscriptionCancelledAt,
	).Scan(&user.Id, &user.CreatedAt, &user.SubscriptionUpdatedAt)

	if err != nil {
		repo.logger.Error().Err(err).Str("email", user.Email).Msg("Failed to create user")
		return nil, err
	}
	return user, nil
}

func (repo *UserRepo) Get(ctx context.Context, userId string) (*entities.User, error) {
	query := `
		SELECT
			id, name, email, created_at, sessions_reset_time, last_reset_date, last_auto_reset_date,
			active_session_id, yesterday_mins, streak, timezone, subscription_tier, subscription_status,
			subscription_interval, subscription_currency, razorpay_plan_id, razorpay_customer_id, razorpay_subscription_id,
			subscription_started_at, subscription_current_period_end, subscription_cancel_at_period_end, subscription_cancelled_at,
			subscription_updated_at
		FROM users
		WHERE id = $1
	`
	var user entities.User
	var activeSessionId sql.NullInt64
	var subscriptionInterval sql.NullString
	var subscriptionCurrency sql.NullString
	var razorpayPlanId sql.NullString
	var razorpayCustomerId sql.NullString
	var razorpaySubscriptionId sql.NullString
	var subscriptionStartedAt sql.NullTime
	var subscriptionCurrentPeriodEnd sql.NullTime
	var subscriptionCancelledAt sql.NullTime
	err := repo.db.QueryRowContext(
		ctx,
		query,
		userId,
	).Scan(
		&user.Id,
		&user.Name,
		&user.Email,
		&user.CreatedAt,
		&user.SessionsResetTime,
		&user.LastResetDate,
		&user.LastAutoResetDate,
		&activeSessionId,
		&user.YesterdayMins,
		&user.Streak,
		&user.Timezone,
		&user.SubscriptionTier,
		&user.SubscriptionStatus,
		&subscriptionInterval,
		&subscriptionCurrency,
		&razorpayPlanId,
		&razorpayCustomerId,
		&razorpaySubscriptionId,
		&subscriptionStartedAt,
		&subscriptionCurrentPeriodEnd,
		&user.SubscriptionCancelAtPeriodEnd,
		&subscriptionCancelledAt,
		&user.SubscriptionUpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if activeSessionId.Valid {
		user.ActiveSessionId = new(int64)
		*user.ActiveSessionId = activeSessionId.Int64
	}
	if subscriptionInterval.Valid {
		user.SubscriptionInterval = &subscriptionInterval.String
	}
	if subscriptionCurrency.Valid {
		user.SubscriptionCurrency = &subscriptionCurrency.String
	}
	if razorpayPlanId.Valid {
		user.RazorpayPlanId = &razorpayPlanId.String
	}
	if razorpayCustomerId.Valid {
		user.RazorpayCustomerId = &razorpayCustomerId.String
	}
	if razorpaySubscriptionId.Valid {
		user.RazorpaySubscriptionId = &razorpaySubscriptionId.String
	}
	if subscriptionStartedAt.Valid {
		user.SubscriptionStartedAt = &subscriptionStartedAt.Time
	}
	if subscriptionCurrentPeriodEnd.Valid {
		user.SubscriptionCurrentPeriodEnd = &subscriptionCurrentPeriodEnd.Time
	}
	if subscriptionCancelledAt.Valid {
		user.SubscriptionCancelledAt = &subscriptionCancelledAt.Time
	}

	if err != nil {
		repo.logger.Error().Err(err).Str("user_id", userId).Msg("Failed to get user")
		return nil, err
	}
	return &user, nil
}

func (repo *UserRepo) GetByRazorpaySubscriptionID(ctx context.Context, subscriptionID string) (*entities.User, error) {
	query := `
		SELECT
			id, name, email, created_at, sessions_reset_time, last_reset_date, last_auto_reset_date,
			active_session_id, yesterday_mins, streak, timezone, subscription_tier, subscription_status,
			subscription_interval, subscription_currency, razorpay_plan_id, razorpay_customer_id, razorpay_subscription_id,
			subscription_started_at, subscription_current_period_end, subscription_cancel_at_period_end, subscription_cancelled_at,
			subscription_updated_at
		FROM users
		WHERE razorpay_subscription_id = $1
	`
	var user entities.User
	var activeSessionId sql.NullInt64
	var subscriptionInterval sql.NullString
	var subscriptionCurrency sql.NullString
	var razorpayPlanId sql.NullString
	var razorpayCustomerId sql.NullString
	var razorpaySubscriptionId sql.NullString
	var subscriptionStartedAt sql.NullTime
	var subscriptionCurrentPeriodEnd sql.NullTime
	var subscriptionCancelledAt sql.NullTime
	err := repo.db.QueryRowContext(ctx, query, subscriptionID).Scan(
		&user.Id,
		&user.Name,
		&user.Email,
		&user.CreatedAt,
		&user.SessionsResetTime,
		&user.LastResetDate,
		&user.LastAutoResetDate,
		&activeSessionId,
		&user.YesterdayMins,
		&user.Streak,
		&user.Timezone,
		&user.SubscriptionTier,
		&user.SubscriptionStatus,
		&subscriptionInterval,
		&subscriptionCurrency,
		&razorpayPlanId,
		&razorpayCustomerId,
		&razorpaySubscriptionId,
		&subscriptionStartedAt,
		&subscriptionCurrentPeriodEnd,
		&user.SubscriptionCancelAtPeriodEnd,
		&subscriptionCancelledAt,
		&user.SubscriptionUpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if activeSessionId.Valid {
		user.ActiveSessionId = new(int64)
		*user.ActiveSessionId = activeSessionId.Int64
	}
	if subscriptionInterval.Valid {
		user.SubscriptionInterval = &subscriptionInterval.String
	}
	if subscriptionCurrency.Valid {
		user.SubscriptionCurrency = &subscriptionCurrency.String
	}
	if razorpayPlanId.Valid {
		user.RazorpayPlanId = &razorpayPlanId.String
	}
	if razorpayCustomerId.Valid {
		user.RazorpayCustomerId = &razorpayCustomerId.String
	}
	if razorpaySubscriptionId.Valid {
		user.RazorpaySubscriptionId = &razorpaySubscriptionId.String
	}
	if subscriptionStartedAt.Valid {
		user.SubscriptionStartedAt = &subscriptionStartedAt.Time
	}
	if subscriptionCurrentPeriodEnd.Valid {
		user.SubscriptionCurrentPeriodEnd = &subscriptionCurrentPeriodEnd.Time
	}
	if subscriptionCancelledAt.Valid {
		user.SubscriptionCancelledAt = &subscriptionCancelledAt.Time
	}
	if err != nil {
		repo.logger.Error().Err(err).Str("subscription_id", subscriptionID).Msg("Failed to get user by subscription id")
		return nil, err
	}
	return &user, nil
}

func (repo *UserRepo) GetAll(ctx context.Context) ([]*entities.User, error) {
	query := `
		SELECT
			id, name, email, created_at, sessions_reset_time, last_reset_date, last_auto_reset_date,
			active_session_id, yesterday_mins, streak, timezone, subscription_tier, subscription_status,
			subscription_interval, subscription_currency, razorpay_plan_id, razorpay_customer_id, razorpay_subscription_id,
			subscription_started_at, subscription_current_period_end, subscription_cancel_at_period_end, subscription_cancelled_at,
			subscription_updated_at
		FROM users
	`
	rows, err := repo.db.QueryContext(ctx, query)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := make([]*entities.User, 0)
	for rows.Next() {
		var user entities.User
		var activeSessionId sql.NullInt64
		var subscriptionInterval sql.NullString
		var subscriptionCurrency sql.NullString
		var razorpayPlanId sql.NullString
		var razorpayCustomerId sql.NullString
		var razorpaySubscriptionId sql.NullString
		var subscriptionStartedAt sql.NullTime
		var subscriptionCurrentPeriodEnd sql.NullTime
		var subscriptionCancelledAt sql.NullTime
		if err = rows.Scan(
			&user.Id,
			&user.Name,
			&user.Email,
			&user.CreatedAt,
			&user.SessionsResetTime,
			&user.LastResetDate,
			&user.LastAutoResetDate,
			&activeSessionId,
			&user.YesterdayMins,
			&user.Streak,
			&user.Timezone,
			&user.SubscriptionTier,
			&user.SubscriptionStatus,
			&subscriptionInterval,
			&subscriptionCurrency,
			&razorpayPlanId,
			&razorpayCustomerId,
			&razorpaySubscriptionId,
			&subscriptionStartedAt,
			&subscriptionCurrentPeriodEnd,
			&user.SubscriptionCancelAtPeriodEnd,
			&subscriptionCancelledAt,
			&user.SubscriptionUpdatedAt,
		); err != nil {
			repo.logger.Error().Msg("Failed to scan row into User object")
			return nil, err
		}
		if activeSessionId.Valid {
			user.ActiveSessionId = new(int64)
			*user.ActiveSessionId = activeSessionId.Int64
		}
		if subscriptionInterval.Valid {
			user.SubscriptionInterval = &subscriptionInterval.String
		}
		if subscriptionCurrency.Valid {
			user.SubscriptionCurrency = &subscriptionCurrency.String
		}
		if razorpayPlanId.Valid {
			user.RazorpayPlanId = &razorpayPlanId.String
		}
		if razorpayCustomerId.Valid {
			user.RazorpayCustomerId = &razorpayCustomerId.String
		}
		if razorpaySubscriptionId.Valid {
			user.RazorpaySubscriptionId = &razorpaySubscriptionId.String
		}
		if subscriptionStartedAt.Valid {
			user.SubscriptionStartedAt = &subscriptionStartedAt.Time
		}
		if subscriptionCurrentPeriodEnd.Valid {
			user.SubscriptionCurrentPeriodEnd = &subscriptionCurrentPeriodEnd.Time
		}
		if subscriptionCancelledAt.Valid {
			user.SubscriptionCancelledAt = &subscriptionCancelledAt.Time
		}
		users = append(users, &user)
	}

	return users, rows.Err()
}

func (repo *UserRepo) Update(ctx context.Context, u *entities.User, touchSubscriptionUpdatedAt bool) error {
	query := `
		UPDATE users
		SET
			sessions_reset_time = $1,
			last_reset_date = $2,
			last_auto_reset_date = $3,
			active_session_id  = $4,
			yesterday_mins = $5,
			streak = $6,
			timezone = $7,
			subscription_tier = $8,
			subscription_status = $9,
			subscription_interval = $10,
			subscription_currency = $11,
			razorpay_plan_id = $12,
			razorpay_customer_id = $13,
			razorpay_subscription_id = $14,
			subscription_started_at = $15,
			subscription_current_period_end = $16,
			subscription_cancel_at_period_end = $17,
			subscription_cancelled_at = $18,
			subscription_updated_at = CASE WHEN $20 THEN now() ELSE subscription_updated_at END
		WHERE id = $19
	`

	_, err := repo.db.ExecContext(
		ctx,
		query,
		u.SessionsResetTime,
		u.LastResetDate,
		u.LastAutoResetDate,
		u.ActiveSessionId,
		u.YesterdayMins,
		u.Streak,
		u.Timezone,
		u.SubscriptionTier,
		u.SubscriptionStatus,
		u.SubscriptionInterval,
		u.SubscriptionCurrency,
		u.RazorpayPlanId,
		u.RazorpayCustomerId,
		u.RazorpaySubscriptionId,
		u.SubscriptionStartedAt,
			u.SubscriptionCurrentPeriodEnd,
			u.SubscriptionCancelAtPeriodEnd,
			u.SubscriptionCancelledAt,
			u.Id,
			touchSubscriptionUpdatedAt,
		)

	if err != nil {
		repo.logger.Error().Err(err).Str("user_id", u.Id).Msg("Failed to update user")
	}
	return err
}

func (repo *UserRepo) EnsureUserExists(ctx context.Context, userId, name, email string) error {
	query := `
		INSERT INTO users (id, name, email, created_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (id) DO UPDATE
		SET
			name = EXCLUDED.name,
			email = EXCLUDED.email
	`
	_, err := repo.db.ExecContext(ctx, query, userId, name, email)
	if err != nil {
		repo.logger.Error().Err(err).Str("user_id", userId).Msg("Failed to ensure user exists")
	}
	return err
}
