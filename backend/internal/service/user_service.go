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
	repo        *repo.UserRepo
	sessionRepo *repo.SessionRepo
	logger      zerolog.Logger
}

func NewUserService(usrRepo *repo.UserRepo, sessRepo *repo.SessionRepo) *UserService {
	return &UserService{
		repo:        usrRepo,
		sessionRepo: sessRepo,
		logger:      logger.NewServiceLogger("user_service"),
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

func (svc *UserService) EnsureUserExists(ctx context.Context, userId string) error {
	return svc.repo.EnsureUserExists(ctx, userId)
}

func (svc *UserService) HandleEvent(ctx context.Context, t EventType, userId string) error {
	switch t {
	case EventResetProgress:
		// return yesterdayMins, streak.
		sessions, err := svc.sessionRepo.GetAllForUser(ctx, userId)
		if err != nil {
			return err
		}
		// calculate yesterdayMins and streak
		err = svc.sessionRepo.ResetProgress(ctx, userId)
		if err != nil {
			return err
		}
	}
}
