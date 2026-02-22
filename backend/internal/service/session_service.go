package service

import (
	"context"
	"errors"
	"time"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/repo"
)

type SessionService struct {
	repo     *repo.SessionRepo
	eventSvc *EventService
	userSvc  *UserService
	logger   zerolog.Logger
}

func NewSessionService(repo *repo.SessionRepo, eventSvc *EventService, userSvc *UserService) *SessionService {
	return &SessionService{repo: repo, eventSvc: eventSvc, userSvc: userSvc, logger: logger.NewServiceLogger("session")}
}

func (svc *SessionService) GetAll(ctx context.Context, userId string) ([]*entities.Session, error) {
	// Lazily create user if doesn't exist
	svc.logger.Info().Str("user_id", userId).Msg("Getting all")

	_ = svc.userSvc.EnsureUserExists(ctx, userId)

	sessions, err := svc.repo.GetAllForUser(ctx, userId)
	if err != nil {
		svc.logger.Error().Msg(err.Error())
		return nil, err
	}
	return sessions, err
}

func (svc *SessionService) Add(ctx context.Context, sessionInput CreateInput) (*entities.Session, error) {
	session := entities.NewSession(sessionInput.UserId,
		sessionInput.Title,
		sessionInput.DailyGoalMinutes,
		sessionInput.SessionDuration,
		sessionInput.TimeLeft,
		sessionInput.NoGoal,
		sessionInput.GroupId,
	)
	session, err := svc.repo.Create(ctx, session)
	if err == nil {
		svc.logger.Info().Int64("session_id", session.Id).Str("user_id", session.UserId).Msg("Created Session")
		err = svc.propagateEvent(ctx, sessionInput.UserId, session.Id, EventNewSession, session)
	} else {
		svc.logger.Error().Msg(err.Error())
	}
	return session, err
}

func (svc *SessionService) Delete(ctx context.Context, sessionId int64, userId string) error {
	err := svc.repo.Delete(ctx, sessionId, userId)
	if err == nil {
		err = svc.propagateEvent(ctx, userId, sessionId, EventDeleteSession, nil)
	}
	return err
}

// ToDo: handle the event reset time change
func (svc *SessionService) HandleEvent(ctx context.Context, patchInput *entities.PatchInput, t EventType) error {
	session, err := svc.repo.GetForUser(ctx, patchInput.UserId, patchInput.SessionId)
	if err != nil {
		return err
	}
	if session == nil {
		return errors.New("session not found")
	}
	applyPatch := true
	switch t {
	case EventStart:
		*(patchInput.TargetTimeMs) = time.Now().UnixMilli() + int64(session.TimeLeft)*1000
		*(patchInput.State) = entities.SessionRunning
	case EventPause:
		*(patchInput.State) = entities.SessionPaused
	case EventResetSession:
		*(patchInput.FocusSeconds) = session.SessionDuration
	case EventResetProgress:
		applyPatch = false
		err = svc.repo.ResetProgress(ctx, patchInput.UserId)
		if err != nil {
			return err
		}
	}

	// don't apply patch to individual session if flag not set
	if applyPatch {
		session.ApplyPatch(patchInput)
		err = svc.repo.Update(ctx, session)
	}

	if err == nil {
		err = svc.propagateEvent(ctx, patchInput.UserId, patchInput.SessionId, t, session)
	}
	return err
}

// Called to propagate a session event
func (svc *SessionService) propagateEvent(ctx context.Context,
	userId string,
	sessionId int64,
	t EventType,
	s *entities.Session) error {
	if !t.IsValid() {
		return errors.New("event type not valid")
	}
	return svc.eventSvc.ReceiveEvent(ctx, userId, sessionId, t, s)
}
