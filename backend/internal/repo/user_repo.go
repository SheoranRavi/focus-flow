package repo

import (
	"context"
	"database/sql"

	"github.com/sheoranravi/focus-flow/backend/internal/entities"
)

type UserRepo struct {
	db *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo {
	return &UserRepo{
		db: db,
	}
}

func (repo *UserRepo) Create(ctx context.Context, user *entities.User) (*entities.User, error) {
	query := `
		INSERT INTO users (name, email, created_at, session_reset_time, active_session_id)
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
		return nil, err
	}
	return user, nil
}

func (repo *UserRepo) Get(ctx context.Context, userId string) (*entities.User, error) {
	query := `
		SELECT id, name, email, created_at, session_reset_time, active_session_id from users 
		WHERE id = $1
	`
	var user entities.User
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
		&user.ActiveSessionId,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (repo *UserRepo) Update(ctx context.Context, u *entities.User) error {
	query := `
		UPDATE sessions
		SET
			session_reset_time = $1,
			active_session_id  = $2,
		WHERE id = $3
	`

	_, err := repo.db.ExecContext(
		ctx,
		query,
		u.SessionsResetTime,
		u.ActiveSessionId,
		u.Id,
	)

	return err
}

func (repo *UserRepo) EnsureUserExists(ctx context.Context, userId string) error {
	query := `
		INSERT INTO users (id, name, email, created_at)
		VALUES ($1, '', '', now())
		ON CONFLICT (id) DO NOTHING
	`
	_, err := repo.db.ExecContext(ctx, query, userId)
	return err
}
