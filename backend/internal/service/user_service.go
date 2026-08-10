package service

import (
	"context"
	"fmt"

	"firebase.google.com/go/v4/auth"
	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/middleware"
	"github.com/sheoranravi/focus-flow/backend/internal/repo"
)

type UserService struct {
	repo       *repo.UserRepo
	authClient *auth.Client
	logger     zerolog.Logger
	eventRepo  *repo.EventRepo
}

func NewUserService(usrRepo *repo.UserRepo, authClient *auth.Client, eventRepos ...*repo.EventRepo) *UserService {
	var eventRepo *repo.EventRepo
	if len(eventRepos) > 0 {
		eventRepo = eventRepos[0]
	}
	return &UserService{
		repo:       usrRepo,
		authClient: authClient,
		logger:     logger.NewServiceLogger("user_service"),
		eventRepo:  eventRepo,
	}
}

func (svc *UserService) UpdateAndAppendEvent(ctx context.Context, patch *entities.UserPatchInput, eventType string, payload any) error {
	if svc.eventRepo == nil {
		return svc.Update(ctx, patch)
	}
	if err := svc.EnsureUserExists(ctx, patch.UserId); err != nil {
		return err
	}
	user, err := svc.repo.Get(ctx, patch.UserId)
	if err != nil {
		return err
	}
	if user == nil {
		return fmt.Errorf("No user for id:%s", patch.UserId)
	}
	user.ApplyPatch(patch)
	_, err = svc.repo.UpdateAndAppendEvent(ctx, user, patch.HasSubscriptionChanges(), svc.eventRepo, eventType, payload, patch.ClientMutationID)
	return err
}

func (svc *UserService) Update(ctx context.Context, patch *entities.UserPatchInput) error {
	err := svc.EnsureUserExists(ctx, patch.UserId)
	if err != nil {
		return err
	}
	user, err := svc.repo.Get(ctx, patch.UserId)
	if err != nil {
		return err
	}
	if user == nil {
		svc.logger.Error().Msg("User is nil")
		return fmt.Errorf("No user for id:%s", patch.UserId)
	}
	touchSubscriptionUpdatedAt := patch.HasSubscriptionChanges()
	user.ApplyPatch(patch)
	err = svc.repo.Update(ctx, user, touchSubscriptionUpdatedAt)
	return err
}

func (svc *UserService) GetUserDetails(ctx context.Context, userId string) (*entities.User, error) {
	svc.logger.Debug().Str("user_id", userId).Msg("Getting user details")
	err := svc.EnsureUserExists(ctx, userId)
	if err != nil {
		return nil, err
	}
	user, err := svc.repo.Get(ctx, userId)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (svc *UserService) GetUserByRazorpaySubscriptionID(ctx context.Context, subscriptionID string) (*entities.User, error) {
	user, err := svc.repo.GetByRazorpaySubscriptionID(ctx, subscriptionID)
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
	var email, name string

	if v := ctx.Value(middleware.AuthUserKey); v != nil {
		if authUser, ok := v.(middleware.AuthUser); ok {
			email = authUser.Email
			name = authUser.Name
		}
	}

	if (email == "" || name == "") && svc.authClient != nil {
		firebaseUser, err := svc.authClient.GetUser(ctx, userId)
		if err != nil {
			svc.logger.Warn().Err(err).Str("user_id", userId).Msg("Failed to fetch firebase user")
		} else {
			if email == "" {
				email = firebaseUser.Email
			}
			if name == "" {
				name = firebaseUser.DisplayName
			}
		}
	}

	if email == "" {
		email = userId + "@unknown.local"
	}
	if name == "" {
		name = "Unknown"
	}

	return svc.repo.EnsureUserExists(ctx, userId, name, email)
}
