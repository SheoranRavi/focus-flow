package service

import (
	"context"

	"github.com/sheoranravi/focus-flow/backend/internal/entities"
)

type EventService struct {
	userSvc *UserService
}

func NewEventService(userSvc *UserService) *EventService {
	return &EventService{userSvc: userSvc}
}

func (svc *EventService) ReceiveEvent(
	ctx context.Context,
	userId string,
	sessionId int64,
	t EventType,
	s *entities.Session) error {
	var err error
	if t == EventStart || t == EventPause {
		patch := entities.UserPatchInput{
			ActiveSessionId: &sessionId,
		}
		if t == EventPause {
			patch.ActiveSessionId = nil
		}
		err = svc.userSvc.Update(ctx, &patch)
	}
	return err
}
