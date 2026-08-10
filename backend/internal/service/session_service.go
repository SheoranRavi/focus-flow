package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
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
	eventRepo  *repo.EventRepo
}

func NewSessionService(sessionRepo *repo.SessionRepo, eventSvc *EventService, userSvc *UserService, eventRepos ...*repo.EventRepo) *SessionService {
	var eventRepo *repo.EventRepo
	if len(eventRepos) > 0 {
		eventRepo = eventRepos[0]
	}
	return &SessionService{
		repo:       sessionRepo,
		eventSvc:   eventSvc,
		userSvc:    userSvc,
		userTimers: make(map[string]*TickerChan),
		logger:     logger.NewServiceLogger("session"),
		eventRepo:  eventRepo,
	}
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

func (svc *SessionService) GetAllWithRevision(ctx context.Context, userId string) ([]*entities.Session, int64, error) {
	_ = svc.userSvc.EnsureUserExists(ctx, userId)
	return svc.repo.GetAllForUserWithRevision(ctx, userId)
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
	mutationID := uuid.NewString()
	var err error
	if svc.eventRepo != nil {
		session, _, err = svc.repo.CreateAndAppendEvent(ctx, session, svc.eventRepo, string(EventNewSession), session, mutationID)
	} else {
		session, err = svc.repo.Create(ctx, session)
	}
	if err == nil {
		svc.logger.Info().Int64("session_id", session.Id).Str("user_id", session.UserId).Msg("Created Session")
		err = svc.processEvent(ctx, sessionInput.UserId, session.Id, EventNewSession, session, mutationID)
	} else {
		svc.logger.Error().Msg(err.Error())
	}
	return session, err
}

func (svc *SessionService) Delete(ctx context.Context, sessionId int64, userId string) error {
	mutationID := uuid.NewString()
	var err error
	if svc.eventRepo != nil {
		_, err = svc.repo.DeleteAndAppendEvent(ctx, sessionId, userId, svc.eventRepo, mutationID)
	} else {
		err = svc.repo.Delete(ctx, sessionId, userId)
	}
	if err == nil {
		err = svc.processEvent(ctx, userId, sessionId, EventDeleteSession, nil, mutationID)
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
	// Goal rows are attribution records only. All timer lifecycle events are
	// applied to the user's single General row.
	if (t == EventStart || t == EventPause || t == EventResetSession) && session.Title != "General" {
		allSessions, listErr := svc.repo.GetAllForUser(ctx, userId)
		if listErr != nil {
			return listErr
		}
		for _, candidate := range allSessions {
			if candidate.Title == "General" {
				session = candidate
				break
			}
		}
	}
	applyPatch := true
	switch t {
	case EventStart:
		user, userErr := svc.userSvc.GetUserDetails(ctx, userId)
		if userErr != nil {
			return userErr
		}
		if user != nil && user.SessionDuration > 0 {
			session.SessionDuration = user.SessionDuration
		}
		// A goal can be selected while the shared timer is already running.
		// Carry the shared deadline onto the attributed row and persist the
		// current remaining time; otherwise that row keeps its old timeLeft.
		if patchInput.TargetTimeMs != nil && *patchInput.TargetTimeMs > 0 {
			// The client computes this from the paused General timeLeft. Preserve
			// it exactly so the SSE start event echoes the same deadline.
			remaining := time.Until(time.UnixMilli(*patchInput.TargetTimeMs))
			if remaining < 0 {
				remaining = 0
			}
			patchInput.TimeLeft = new(int)
			*patchInput.TimeLeft = int((remaining + time.Second - 1) / time.Second)
		} else if session.TargetTimeMs == 0 {
			target := time.Now().Add(time.Duration(session.TimeLeft) * time.Second).UnixMilli()
			patchInput.TargetTimeMs = new(int64)
			*patchInput.TargetTimeMs = target
		}
		patchInput.State = new(entities.SessionState)
		*(patchInput.State) = entities.SessionRunning
		patchInput.IsCompleted = new(bool)
		*(patchInput.IsCompleted) = false
	case EventPause:
		patchInput.State = new(entities.SessionState)
		*(patchInput).State = entities.SessionPaused
		patchInput.TargetTimeMs = new(int64)
		*patchInput.TargetTimeMs = 0
	case EventResetSession:
		user, userErr := svc.userSvc.GetUserDetails(ctx, userId)
		if userErr != nil {
			return userErr
		}
		if user != nil && user.SessionDuration > 0 {
			session.SessionDuration = user.SessionDuration
		}
		patchInput.TimeLeft = new(int)
		*(patchInput).TimeLeft = session.SessionDuration
		patchInput.IsCompleted = new(bool)
		*(patchInput.IsCompleted) = false
		patchInput.State = new(entities.SessionState)
		*patchInput.State = entities.SessionPaused
		patchInput.TargetTimeMs = new(int64)
		*patchInput.TargetTimeMs = 0
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
		touchUpdatedAt := t == EventStart
		mutationID := patchInput.ClientMutationID
		if mutationID == "" {
			mutationID = uuid.NewString()
		}
		patchInput.ClientMutationID = mutationID
		if svc.eventRepo != nil {
			_, err = svc.repo.UpdateAndAppendEvent(ctx, session, touchUpdatedAt, svc.eventRepo, string(t), session, mutationID)
		} else {
			err = svc.repo.Update(ctx, session, touchUpdatedAt)
		}
		if err == nil && t == EventEdit && patchInput.DailyGoalMinutes != nil {
			user, userErr := svc.userSvc.GetUserDetails(ctx, userId)
			if userErr != nil {
				return userErr
			}
			today := dateInTimezone(user.Timezone).Format("2006-01-02")
			err = svc.repo.UpdateTaskDailyTimeGoal(ctx, session.Id, today, *patchInput.DailyGoalMinutes)
		}
	}

	if err == nil {
		err = svc.processEvent(ctx, userId, sessionId, t, session, patchInput.ClientMutationID)
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
	// There is one timer per user. Prefer the explicit General row when old
	// data contains more than one running session; the goal rows remain usable
	// for goal-attributed focus when the client explicitly selects one.
	selected := make(map[string]*entities.Session)
	for _, sess := range sessions {
		current, exists := selected[sess.UserId]
		if !exists || (sess.Title == "General" && current.Title != "General") {
			selected[sess.UserId] = sess
		}
	}
	for _, sess := range selected {
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
		svc.logger.Info().Msgf("User timer already running: %s:%d", session.UserId, t.SessionId)
		svc.timerMu.Unlock()
		return nil
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
		if err := svc.repo.Update(ctx, session, false); err != nil {
			svc.logger.Error().Err(err).Msgf("Not able to update session state for user: %s, session: %d", session.UserId, session.Id)
			return err
		}
		// also need to set active session id to null here
		userPatch := &entities.UserPatchInput{ClearActiveSession: true, UserId: session.UserId}
		err := svc.userSvc.Update(ctx, userPatch)
		if err != nil {
			svc.logger.Error().
				Err(err).
				Str("user_id", session.UserId).
				Interface("session_id", session.Id).
				Msg("Not able to update the user active session id")
			return err
		}
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
	svc.logger.Info().
		Str("user_id", session.UserId).
		Int64("session_id", session.Id).
		Int64("target_time_ms", session.TargetTimeMs).
		Int("time_left", session.TimeLeft).
		Msg("Started timer")
	return nil
}

func (svc *SessionService) CancelEvent(session *entities.Session) bool {
	return svc.CancelUserTimer(session.UserId)
}

// CancelUserTimer stops and removes the single in-memory timer for a user.
// Auto-reset uses this directly because it does not operate on one session.
func (svc *SessionService) CancelUserTimer(userId string) bool {
	key := userId
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
	lastAttributedTotal := 0

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
			elapsedSeconds := initTimeLeft - timeLeft
			focusSeconds := initFocusSeconds + elapsedSeconds
			attributedTotal, attributedSeconds := attributionDelta(
				elapsedSeconds,
				session.FocusSeconds-initFocusSeconds,
				lastAttributedTotal,
			)
			lastAttributedTotal = attributedTotal
			maxFocusSeconds := initFocusSeconds + initTimeLeft
			if focusSeconds > maxFocusSeconds {
				focusSeconds = maxFocusSeconds
			}
			if focusSeconds < 0 {
				focusSeconds = 0
			}

			session.TimeLeft = timeLeft
			user, userErr := svc.userSvc.GetUserDetails(ctx, session.UserId)
			activeSessionId := int64(0)
			if userErr == nil && user != nil && user.ActiveSessionId != nil {
				activeSessionId = *user.ActiveSessionId
			}
			// General is the timer row, but it is also a valid attribution target.
			// Only write its focus seconds when General is selected. If another
			// goal is selected, persist the elapsed seconds only on that goal row;
			// otherwise General and the goal would both receive the same time.
			if activeSessionId == 0 || activeSessionId == session.Id {
				session.FocusSeconds = focusSeconds
				attributedSeconds = 0
			} else {
				session.FocusSeconds = initFocusSeconds
				if err := svc.repo.IncrementFocusSeconds(ctx, activeSessionId, session.UserId, attributedSeconds); err != nil {
					svc.logger.Error().Err(err).Msg("Unable to attribute focus time to active goal")
				}
			}
			if timeLeft == 0 {
				t.Ticker.Stop()
				svc.handleCompletion(ctx, t, session)
				return
			}
			if err := svc.repo.UpdateTimerProgress(ctx, session); err != nil {
				svc.logger.Error().Err(err).Msg("Unable to persist timer progress")
			}
		case <-t.CancelChan:
			t.Ticker.Stop()
			svc.logger.Info().Msgf("Stopping ticker for session %d", session.Id)
			return
		}
	}
}

// attributionDelta returns the cumulative time that is not already represented
// by the timer row and the new amount to add since the previous tick. The
// ticker must persist only the delta; adding the cumulative value on every tick
// causes focus time to grow quadratically.
func attributionDelta(elapsedSeconds, timerRowDelta, previousAttributedTotal int) (int, int) {
	attributedTotal := elapsedSeconds - timerRowDelta
	if attributedTotal < 0 {
		attributedTotal = 0
	}
	delta := attributedTotal - previousAttributedTotal
	if delta < 0 {
		delta = 0
	}
	return attributedTotal, delta
}

func (svc *SessionService) handleCompletion(ctx context.Context, ticker *TickerChan, session *entities.Session) {
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
	completed, err := svc.repo.CompleteTimerIfCurrent(ctx, session)
	if err != nil {
		svc.logger.Error().Err(err).Msg("Unable to persist timer completion")
		return
	}
	if !completed {
		// This ticker lost ownership of the timer to a newer lifecycle action.
		return
	}
	// broadcast the session completion to clients
	svc.logger.Info().Msgf("Session %d is complete, updating DB and clients.", session.Id)
	svc.eventSvc.SendCompletion(sessionSched)
	// remove this ticker from map
	svc.timerMu.Lock()
	if current, ok := svc.userTimers[session.UserId]; ok && current == ticker {
		delete(svc.userTimers, session.UserId)
	}
	svc.timerMu.Unlock()
}

// Called to propagate a session event
func (svc *SessionService) processEvent(ctx context.Context,
	userId string,
	sessionId int64,
	t EventType,
	s *entities.Session,
	clientMutationID ...string) error {
	if !t.IsValid() {
		return errors.New("event type not valid")
	}
	// schedule the event for regular updates
	switch t {
	case EventStart:
		err := svc.ScheduleEvent(ctx, s)
		if err != nil {
			svc.logger.Error().Err(err).Msg("Unable to start event")
			return err
		}
	case EventPause:
		svc.CancelEvent(s)
	}
	// send out the event to all connections
	mutationID := ""
	if len(clientMutationID) > 0 {
		mutationID = clientMutationID[0]
	}
	_, err := svc.eventSvc.ReceiveEventWithMutation(ctx, userId, sessionId, t, s, mutationID)
	return err
}

type TickerChan struct {
	Ticker     *time.Ticker
	SessionId  int64
	CancelChan chan bool
}
