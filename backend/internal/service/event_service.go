package service

import (
	"context"

	"github.com/sheoranravi/focus-flow/backend/internal/entities"
)

type EventService struct {
}

func (svc *EventService) ReceiveEvent(
	ctx context.Context,
	userId string,
	sessionId int64,
	t EventType,
	s *entities.Session) error {
	return nil
}
