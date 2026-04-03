package service

import (
	"context"
	"fmt"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/repo"
)

type UserService struct {
	repo   *repo.UserRepo
	logger zerolog.Logger
}

func NewUserService(usrRepo *repo.UserRepo) *UserService {
	return &UserService{
		repo:   usrRepo,
		logger: logger.NewServiceLogger("user_service"),
	}
}

func (svc *UserService) Update(ctx context.Context, patch *entities.UserPatchInput) error {
	user, err := svc.repo.Get(ctx, patch.UserId)
	if err != nil {
		return err
	}
	if user == nil {
		svc.logger.Error().Msg("User is nil")
		return fmt.Errorf("No user for id:%s", patch.UserId)
	}
	user.ApplyPatch(patch)
	err = svc.repo.Update(ctx, user)
	return err
}

func (svc *UserService) GetUserDetails(ctx context.Context, userId string) (*entities.User, error) {
	user, err := svc.repo.Get(ctx, userId)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (svc *UserService) GetAllUsers(ctx context.Context) ([]*entities.User, error) {
	users, err := svc.repo.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	return users, nil
}

func (svc *UserService) EnsureUserExists(ctx context.Context, userId string) error {
	return svc.repo.EnsureUserExists(ctx, userId)
}
