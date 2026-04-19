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
		INSERT INTO users (name, email, created_at, sessions_reset_time, active_session_id)
		VALUES ($1, $2, now(), $3, $4)
		RETURNING id, created_at
	`
	err := repo.db.QueryRowContext(
		ctx,
		query,
		user.Name,
		user.Email,
		user.SessionsResetTime,
		user.ActiveSessionId,
	).Scan(&user.Id, &user.CreatedAt)

	if err != nil {
		repo.logger.Error().Err(err).Str("email", user.Email).Msg("Failed to create user")
		return nil, err
	}
	return user, nil
}

func (repo *UserRepo) Get(ctx context.Context, userId string) (*entities.User, error) {
	query := `
		SELECT id, name, email, created_at, sessions_reset_time, active_session_id, yesterday_mins, streak, timezone from users 
		WHERE id = $1
	`
	var user entities.User
	var activeSessionId sql.NullInt64
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
		&activeSessionId,
		&user.YesterdayMins,
		&user.Streak,
		&user.Timezone,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if activeSessionId.Valid {
		user.ActiveSessionId = activeSessionId.Int64
	}

	if err != nil {
		repo.logger.Error().Err(err).Str("user_id", userId).Msg("Failed to get user")
		return nil, err
	}
	return &user, nil
}

func (repo *UserRepo) GetAll(ctx context.Context) ([]*entities.User, error) {
	query := `
		SELECT id, name, email, created_at, sessions_reset_time, active_session_id, yesterday_mins, streak, timezone from users 
	`
	rows, err := repo.db.QueryContext(ctx, query)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	users := make([]*entities.User, 0)
	for rows.Next() {
		var user entities.User
		var activeSessionId sql.NullInt64
		if err = rows.Scan(
			&user.Id,
			&user.Name,
			&user.Email,
			&user.CreatedAt,
			&user.SessionsResetTime,
			&activeSessionId,
			&user.YesterdayMins,
			&user.Streak,
			&user.Timezone,
		); err != nil {
			repo.logger.Error().Msg("Failed to scan row into User object")
			return nil, err
		}
		if activeSessionId.Valid {
			user.ActiveSessionId = activeSessionId.Int64
		}
		users = append(users, &user)
	}

	return users, nil
}

func (repo *UserRepo) Update(ctx context.Context, u *entities.User) error {
	query := `
		UPDATE users
		SET
			sessions_reset_time = $1,
			active_session_id  = $2,
			yesterday_mins = $3,
			streak = $4,
			timezone = $5
		WHERE id = $6
	`

	_, err := repo.db.ExecContext(
		ctx,
		query,
		u.SessionsResetTime,
		u.ActiveSessionId,
		u.YesterdayMins,
		u.Streak,
		u.Timezone,
		u.Id,
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
