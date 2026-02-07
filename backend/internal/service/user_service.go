package service

import (
	"context"

	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/repo"
)

type UserService struct {
	repo *repo.UserRepo
}

func NewUserService(usrRepo *repo.UserRepo) *UserService {
	return &UserService{
		repo: usrRepo,
	}
}

func (svc *UserService) Update(ctx context.Context, patch *entities.UserPatchInput) error {
	user, err := svc.repo.Get(ctx, patch.UserId)
	if err != nil {
		return err
	}
	user.ApplyPatch(patch)
	err = svc.repo.Update(ctx, user)
	return err
}
