package service

import (
	"context"
	"errors"
	"time"

	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/repo"
)

type SessionService struct {
	repo     *repo.SessionRepo
	eventSvc *EventService
}

func NewSessionService(repo *repo.SessionRepo, eventSvc *EventService) *SessionService {
	return &SessionService{repo: repo, eventSvc: eventSvc}
}

func (svc *SessionService) GetAll(ctx context.Context, userId string) ([]*entities.Session, error) {
	sessions, err := svc.repo.GetAllForUser(ctx, userId)
	if err != nil {
		return nil, err
	}
	return sessions, err
}

func (svc *SessionService) Add(ctx context.Context, sessionInput CreateInput) (*entities.Session, error) {
	session := entities.NewSession(sessionInput.UserId,
		sessionInput.Title,
		sessionInput.DailyGoalMinutes,
		sessionInput.InitialDuration,
		sessionInput.NoGoal,
		sessionInput.GroupId,
	)
	session, err := svc.repo.Create(ctx, session)
	if err == nil {
		err = svc.PropagateEvent(ctx, sessionInput.UserId, session.Id, EventNewSession, session)
	}
	return session, err
}

func (svc *SessionService) Delete(ctx context.Context, sessionId int64, userId string) error {
	err := svc.repo.Delete(ctx, sessionId, userId)
	if err == nil {
		err = svc.PropagateEvent(ctx, userId, sessionId, EventDeleteSession, nil)
	}
	return err
}

// ToDo: when handling start and pause events, need to update the TargetTimeMs
func (svc *SessionService) HandleEvent(ctx context.Context, patchInput *entities.PatchInput, t EventType) error {
	session, err := svc.repo.GetForUser(ctx, patchInput.UserId, patchInput.SessionId)
	if err != nil {
		return err
	}
	if session == nil {
		return errors.New("session not found")
	}
	switch t {
	case EventStart:
		*(patchInput.TargetTimeMs) = time.Now().UnixMilli() + int64(session.TimeLeft)*1000
	case EventPause:
		*(patchInput.State) = entities.SessionPaused
	}

	session.ApplyPatch(patchInput)

	err = svc.repo.Update(ctx, session)
	if err == nil {
		err = svc.PropagateEvent(ctx, patchInput.UserId, patchInput.SessionId, t, session)
	}
	return err
}

// Called to propagate a session event
func (svc *SessionService) PropagateEvent(ctx context.Context,
	userId string,
	sessionId int64,
	t EventType,
	s *entities.Session) error {
	if !t.IsValid() {
		return errors.New("event type not valid")
	}
	return svc.eventSvc.ReceiveEvent(ctx, userId, sessionId, t, s)
}
