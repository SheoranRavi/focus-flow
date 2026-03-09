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
		SELECT id, name, email, created_at, sessions_reset_time, active_session_id from users 
		WHERE id = $1
	`
	var user entities.User
	var sessionsResetTime sql.NullTime
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
		&sessionsResetTime,
		&activeSessionId,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	// ToDo: This will still set 00:00 as the time in else case I think. Handle it. Set it to user's midnight.
	if sessionsResetTime.Valid {
		user.SessionsResetTime = sessionsResetTime.Time
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

func (repo *UserRepo) Update(ctx context.Context, u *entities.User) error {
	query := `
		UPDATE users
		SET
			sessions_reset_time = $1,
			active_session_id  = $2
		WHERE id = $3
	`

	_, err := repo.db.ExecContext(
		ctx,
		query,
		u.SessionsResetTime,
		u.ActiveSessionId,
		u.Id,
	)

	if err != nil {
		repo.logger.Error().Err(err).Str("user_id", u.Id).Msg("Failed to update user")
	}
	return err
}

func (repo *UserRepo) EnsureUserExists(ctx context.Context, userId string) error {
	query := `
		INSERT INTO users (id, name, email, created_at)
		VALUES ($1, '', '', now())
		ON CONFLICT (id) DO NOTHING
	`
	_, err := repo.db.ExecContext(ctx, query, userId)
	if err != nil {
		repo.logger.Error().Err(err).Str("user_id", userId).Msg("Failed to ensure user exists")
	}
	return err
}
