package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/repo"
)

type SessionService struct {
	repo       *repo.SessionRepo
	eventSvc   *EventService
	userSvc    *UserService
	userTimers map[string]*TickerChan // store the timer corresponding to a user
	timerMu    sync.Mutex
	logger     zerolog.Logger
}

func NewSessionService(repo *repo.SessionRepo, eventSvc *EventService, userSvc *UserService) *SessionService {
	return &SessionService{
		repo:       repo,
		eventSvc:   eventSvc,
		userSvc:    userSvc,
		userTimers: make(map[string]*TickerChan),
		logger:     logger.NewServiceLogger("session")}
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

func (svc *SessionService) GetAllActiveSessions(ctx context.Context) ([]*entities.Session, error) {
	sessions, err := svc.repo.GetAllActiveSessions(ctx)
	if err != nil {
		svc.logger.Error().Msg(err.Error())
		return nil, err
	}

	return sessions, err
}

func (svc *SessionService) Add(ctx context.Context, sessionInput CreateInput) (*entities.Session, error) {
	session, newSessionErr := entities.NewSession(sessionInput.UserId,
		sessionInput.Title,
		sessionInput.DailyGoalMinutes,
		sessionInput.SessionDuration,
		sessionInput.TimeLeft,
		sessionInput.NoGoal,
		sessionInput.GroupId,
	)
	if newSessionErr != nil {
		svc.logger.Error().Msg(newSessionErr.Error())
		return nil, newSessionErr
	}
	session, err := svc.repo.Create(ctx, session)
	if err == nil {
		svc.logger.Info().Int64("session_id", session.Id).Str("user_id", session.UserId).Msg("Created Session")
		err = svc.processEvent(ctx, sessionInput.UserId, session.Id, EventNewSession, session)
	} else {
		svc.logger.Error().Msg(err.Error())
	}
	return session, err
}

func (svc *SessionService) Delete(ctx context.Context, sessionId int64, userId string) error {
	err := svc.repo.Delete(ctx, sessionId, userId)
	if err == nil {
		err = svc.processEvent(ctx, userId, sessionId, EventDeleteSession, nil)
	}
	return err
}

func (svc *SessionService) HandleEvent(ctx context.Context, patchInput *entities.PatchInput, t EventType, userId string, sessionId int64) error {
	session, err := svc.repo.GetForUser(ctx, userId, sessionId)
	if err != nil {
		return err
	}
	if session == nil {
		svc.logger.Info().Int64("session_id", sessionId).Str("user_id", userId).Msg("Session not found")
		return errors.New("session not found")
	}
	applyPatch := true
	switch t {
	case EventStart:
		patchInput.State = new(entities.SessionState)
		*(patchInput.State) = entities.SessionRunning
		patchInput.IsCompleted = new(bool)
		*(patchInput.IsCompleted) = false
	case EventPause:
		patchInput.State = new(entities.SessionState)
		*(patchInput).State = entities.SessionPaused
	case EventResetSession:
		patchInput.TimeLeft = new(int)
		*(patchInput).TimeLeft = session.SessionDuration
		patchInput.IsCompleted = new(bool)
		*(patchInput.IsCompleted) = false
		patchInput.State = new(entities.SessionState)
		*patchInput.State = entities.SessionPaused
		// cancel if already running timer
		if session.State == entities.SessionRunning {
			svc.CancelEvent(session)
		}
	case EventEdit:
		// if this is a running session, then cancel the existing timer and set it's state to paused
		if session.State == entities.SessionRunning {
			svc.CancelEvent(session)
			patchInput.State = new(entities.SessionState)
			*patchInput.State = entities.SessionPaused
		}
	}

	// don't apply patch to individual session if flag not set
	if applyPatch {
		session.ApplyPatch(patchInput)
		err = svc.repo.Update(ctx, session)
	}

	if err == nil {
		err = svc.processEvent(ctx, userId, sessionId, t, session)
	}
	return err
}

// schedule send for all given sessions
func (svc *SessionService) ScheduleEvents(ctx context.Context) error {
	errCount := 0
	numSched := 0
	sessions, err := svc.GetAllActiveSessions(ctx)
	if err != nil {
		return err
	}
	for _, sess := range sessions {
		err := svc.ScheduleEvent(ctx, sess)
		if err != nil {
			svc.logger.Error().Msg(err.Error())
			errCount++
		} else {
			numSched++
		}
	}
	svc.logger.Info().Msgf("numScheduled: %d, num error: %d", numSched, errCount)
	return nil
}

func (svc *SessionService) ScheduleEvent(ctx context.Context, session *entities.Session) error {
	svc.timerMu.Lock()
	// can't start already running session
	if t, ok := svc.userTimers[session.UserId]; ok && t.SessionId == session.Id {
		svc.logger.Info().Msgf("User session already running: %s:%d", session.UserId, t.SessionId)
		svc.timerMu.Unlock()
		return fmt.Errorf("User session already running: %s:%d", session.UserId, t.SessionId)
	}
	svc.timerMu.Unlock()
	// pause any session currently running
	svc.CancelEvent(session)

	// schedule this event to fire at target time
	delay := time.Until(time.UnixMilli(session.TargetTimeMs))
	if delay < 0 {
		// update the DB state at this point
		// ToDo: make a subroutine for updating these three state values
		session.State = entities.SessionPaused
		session.FocusSeconds += session.TimeLeft   // we can assume that timeLeft seconds passed
		session.TimeLeft = session.SessionDuration // reset
		svc.repo.Update(ctx, session)
		return fmt.Errorf("Target time passed for user: %s, session: %d", session.UserId, session.Id)
	}
	ticker := time.NewTicker(time.Second)
	tickerChan := &TickerChan{
		SessionId:  session.Id,
		Ticker:     ticker,
		CancelChan: make(chan bool), // unbuffered channel, this is fine to block
	}
	// tick handler runs in its own goroutine
	go svc.tickHandler(tickerChan, session)
	svc.timerMu.Lock()
	// add t to the map
	svc.userTimers[session.UserId] = tickerChan
	svc.timerMu.Unlock()
	return nil
}

func (svc *SessionService) CancelEvent(session *entities.Session) bool {
	key := session.UserId
	svc.timerMu.Lock()
	t, ok := svc.userTimers[key]
	delete(svc.userTimers, key)
	svc.timerMu.Unlock()
	if !ok {
		svc.logger.Info().Msgf("No timer event found for key: %s", key)
		return false
	}
	close(t.CancelChan)
	svc.logger.Info().Msgf("Ticker deleted for key: %s", key)
	return true
}

func (svc *SessionService) tickHandler(t *TickerChan, session *entities.Session) {
	var timeLeft int
	initTimeLeft := session.TimeLeft
	initFocusSeconds := session.FocusSeconds
	targetTimeMs := session.TargetTimeMs

	ctx := context.Background()
	for {
		select {
		case <-t.Ticker.C:
			// update timeLeft, focusSeconds, check if TargetTimeMs is reached
			remaining := time.Until(time.UnixMilli(targetTimeMs))
			if remaining <= 0 {
				timeLeft = 0
			} else {
				// Round up partial seconds so the timer does not complete early.
				timeLeft = int((remaining + time.Second - 1) / time.Second)
			}
			focusSeconds := initFocusSeconds + initTimeLeft - timeLeft
			maxFocusSeconds := initFocusSeconds + initTimeLeft
			if focusSeconds > maxFocusSeconds {
				focusSeconds = maxFocusSeconds
			}
			if focusSeconds < 0 {
				focusSeconds = 0
			}

			session.TimeLeft = timeLeft
			session.FocusSeconds = focusSeconds
			if timeLeft == 0 {
				t.Ticker.Stop()
				svc.handleCompletion(ctx, session)
				return
			}
			svc.repo.Update(ctx, session)
		case <-t.CancelChan:
			t.Ticker.Stop()
			svc.logger.Info().Msgf("Stopping ticker for session %d", session.Id)
			return
		}
	}
}

func (svc *SessionService) handleCompletion(ctx context.Context, session *entities.Session) {
	// set session to completed and time left to session duration
	session.TimeLeft = session.SessionDuration
	session.IsCompleted = true
	session.State = entities.SessionPaused
	sessionSched := &SessionSchedule{
		UserId:       session.UserId,
		SessionId:    session.Id,
		TargetTimeMs: session.TargetTimeMs,
		FocusSeconds: session.FocusSeconds,
	}
	// broadcast the session completion to clients
	svc.logger.Info().Msgf("Session %d is complete, updating DB and clients.", session.Id)
	userPatch := &entities.UserPatchInput{ClearActiveSession: true, UserId: session.UserId}
	svc.userSvc.Update(ctx, userPatch)
	svc.repo.Update(ctx, session)
	svc.eventSvc.SendCompletion(sessionSched)
	// remove this ticker from map
	svc.timerMu.Lock()
	delete(svc.userTimers, session.UserId)
	svc.timerMu.Unlock()
}

// Called to propagate a session event
func (svc *SessionService) processEvent(ctx context.Context,
	userId string,
	sessionId int64,
	t EventType,
	s *entities.Session) error {
	if !t.IsValid() {
		return errors.New("event type not valid")
	}
	// schedule the event for regular updates
	switch t {
	case EventStart:
		// ToDo: Handle error
		svc.ScheduleEvent(ctx, s)
	case EventPause:
		svc.CancelEvent(s)
	}
	// send out the event to all connections
	return svc.eventSvc.ReceiveEvent(ctx, userId, sessionId, t, s)
}

type TickerChan struct {
	Ticker     *time.Ticker
	SessionId  int64
	CancelChan chan bool
}
