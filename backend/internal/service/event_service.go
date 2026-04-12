package service

import (
	"context"
	"fmt"
	"regexp"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/repo"
)

type EventService struct {
	userSvc     *UserService
	sessionRepo *repo.SessionRepo
	// each user can have n number of connections, so one channel per connection would be there
	// userId -> connectionId -> Connection
	userConnections map[string]map[string]*Connection
	userTimers      map[string]*time.Timer
	timerMu         sync.Mutex
	logger          zerolog.Logger
	connectionMu    sync.Mutex
}

func NewEventService(userSvc *UserService, sessRepo *repo.SessionRepo) *EventService {
	return &EventService{userSvc: userSvc,
		sessionRepo:     sessRepo,
		userConnections: make(map[string]map[string]*Connection),
		userTimers:      make(map[string]*time.Timer),
		logger:          logger.NewServiceLogger("event_service")}
}

func (svc *EventService) HandleEvent(ctx context.Context, t EventType, userId string, userPatch *entities.UserPatchInput) error {
	svc.logger.Info().Msgf("Handling event %s for user %s", t, userId)
	user, err := svc.userSvc.GetUserDetails(ctx, userId)
	if err != nil {
		return err
	}
	var userData UserEventData
	switch t {
	case EventResetProgress:
		// return yesterdayMins, streak.
		sessions, err := svc.sessionRepo.GetAllForUser(ctx, userId)
		if err != nil {
			return err
		}
		// calculate yesterdayMins and streak
		totalFocusSeconds := 0
		totalGoalMinutes := 0
		totalTimeOnGoal := 0
		for _, s := range sessions {
			totalFocusSeconds += s.FocusSeconds
			totalGoalMinutes += s.DailyGoalMinutes
			totalTimeOnGoal += min(s.DailyGoalMinutes*60, s.FocusSeconds)
		}
		// ToDo
		userPatch.Streak = new(int)
		*(userPatch.Streak) = user.Streak
		if totalTimeOnGoal >= totalGoalMinutes*60 {
			*(userPatch.Streak)++
		} else {
			*(userPatch.Streak) = 0
		}
		userPatch.YesterdayMins = new(int)
		*(userPatch.YesterdayMins) = totalFocusSeconds / 60
		svc.userSvc.Update(ctx, userPatch)
		err = svc.sessionRepo.ResetProgress(ctx, userId)
		if err != nil {
			return err
		}
		userData.YesterdayMins = *userPatch.YesterdayMins
		userData.Streak = *userPatch.Streak
		userData.TotalGoalMinutes = totalGoalMinutes
	case EventAutoResetTimeChange:
		if userPatch.SessionsResetTime == nil || userPatch.Timezone == nil {
			return fmt.Errorf("SessionsResetTime and Timezone needs to be supplied")
		}
		re := regexp.MustCompile(`\d{2}:\d{2}`)
		matched := re.MatchString(*userPatch.SessionsResetTime)
		if !matched {
			return fmt.Errorf("session reset time %s should be of the form 'xy:ab'", *userPatch.SessionsResetTime)
		}
		_, locationErr := time.LoadLocation(*userPatch.Timezone)
		if locationErr != nil {
			return fmt.Errorf("timezone not correct")
		}
		err := svc.userSvc.Update(ctx, userPatch)
		if err != nil {
			return err
		}
		userData.SessionResetTime = *userPatch.SessionsResetTime
		userData.Timezone = *userPatch.Timezone
		// refresh user
		user, err = svc.userSvc.GetUserDetails(ctx, user.Id)
		svc.scheduleSessionResetForUser(ctx, user)
	case EventRegistration:
		if userPatch.Timezone == nil {
			return fmt.Errorf("Timezone needs to be supplied")
		}
		_, locationErr := time.LoadLocation(*userPatch.Timezone)
		if locationErr != nil {
			return fmt.Errorf("timezone not correct")
		}
		err := svc.userSvc.Update(ctx, userPatch)
		if err != nil {
			return err
		}
		// Schedule session reset for the new user
		user, _ = svc.userSvc.GetUserDetails(ctx, user.Id)
		svc.scheduleSessionResetForUser(ctx, user)
		return nil // No broadcast needed for registration
	}
	svc.ReceiveUserEvent(ctx, userId, &userData, t)
	return nil
}

func (svc *EventService) ReceiveEvent(
	ctx context.Context,
	userId string,
	sessionId int64,
	t EventType,
	s *entities.Session) error {
	var err error
	// Create the message object
	msg := svc.constructMessage(t, sessionId, s)
	if t == EventStart || t == EventPause {
		patch := entities.UserPatchInput{
			ActiveSessionId: &sessionId,
			UserId:          userId,
		}
		if t == EventPause {
			patch.ActiveSessionId = nil
		}
		err = svc.userSvc.Update(ctx, &patch)
	}

	svc.BroadcastToUserConnections(userId, msg)
	// ToDo: Should we return err here?
	return err
}

func (svc *EventService) ReceiveUserEvent(ctx context.Context, userId string, userData *UserEventData, t EventType) {
	msg := Message{
		EventType: t,
	}
	switch t {
	case EventResetProgress:
		msg.Object = struct {
			YesterdayMins    int `json:"yesterdayMins"`
			Streak           int `json:"streak"`
			TotalGoalMinutes int `json:"totalGoalMinutes"`
		}{
			YesterdayMins:    userData.YesterdayMins,
			Streak:           userData.Streak,
			TotalGoalMinutes: userData.TotalGoalMinutes,
		}
	case EventAutoResetTimeChange:
		msg.Object = struct {
			ResetTime string `json:"resetTime"`
			Timezone  string `json:"timezone"`
		}{
			ResetTime: userData.SessionResetTime,
			Timezone:  userData.Timezone,
		}
	}
	svc.BroadcastToUserConnections(userId, msg)
}

// ToDo: Improve thread safety
func (svc *EventService) AddUserConnection(userId string) *Connection {
	svc.connectionMu.Lock()
	defer svc.connectionMu.Unlock()
	svc.logger.Info().Str("userId", userId).Msg("New connection for user")
	_, ok := svc.userConnections[userId]
	if !ok {
		svc.userConnections[userId] = make(map[string]*Connection, 0)
	}
	eventChan := make(chan Message, 10)

	connId := uuid.New().String()
	newConnection := &Connection{EventC: eventChan, ConnId: connId}

	svc.userConnections[userId][connId] = newConnection
	return newConnection
}

func (svc *EventService) BroadcastToUserConnections(userId string, msg Message) {
	svc.connectionMu.Lock()
	defer svc.connectionMu.Unlock()
	svc.logger.Info().Str("userId", userId).Msg("Broadcasting event to all connections")
	// get connections for this user
	_, ok := svc.userConnections[userId]
	if !ok {
		// no connections for this user
		svc.logger.Info().Str("userId", userId).Msg("No connections found for user")
		return
	}
	conns := svc.userConnections[userId]
	for _, conn := range conns {
		select {
		case conn.EventC <- msg:
		default:
			svc.logger.Debug().Msg("The event channel is not receiving it seems...")
			// drop if client slow...
		}
	}
}

func (svc *EventService) RemoveClientConnection(connId string, userId string) {
	svc.connectionMu.Lock()
	defer svc.connectionMu.Unlock()
	delete(svc.userConnections[userId], connId)
}

func (svc *EventService) SendCompletion(session *SessionSchedule) {
	msg := Message{
		EventType: EventSessionComplete,
		Object:    session.SessionId,
	}
	svc.BroadcastToUserConnections(session.UserId, msg)
}

func (svc *EventService) ScheduleSessionReset(ctx context.Context) error {
	// get all session reset times for all users
	// schedule triggers
	users, err := svc.userSvc.GetAllUsers(ctx)
	if err != nil {
		return err
	}
	for _, user := range users {
		err := svc.scheduleSessionResetForUser(ctx, user)
		if err != nil {
			return err
		}
	}
	return nil
}

func (svc *EventService) handleResetTrigger(userId string) {
	ctx := context.Background()
	svc.logger.Info().Msgf("Reset triggered for user: %s", userId)
	svc.HandleEvent(ctx, EventResetProgress, userId, &entities.UserPatchInput{})
	user, err := svc.userSvc.GetUserDetails(ctx, userId)
	if err != nil {
		svc.logger.Error().Msgf("Error retreiving user: %s", userId)
		return
	}
	svc.scheduleSessionResetForUser(ctx, user)
}

func (svc *EventService) scheduleSessionResetForUser(ctx context.Context, user *entities.User) error {
	// delete if already exists
	if _, ok := svc.userTimers[user.Id]; ok {
		svc.timerMu.Lock()
		delete(svc.userTimers, user.Id)
		svc.timerMu.Unlock()
	}
	loc, err := time.LoadLocation(user.Timezone)
	if err != nil {
		svc.logger.Error().Msgf("Timezone info incorrect for user: %s", user.Id)
		return err
	}
	parsed, err := time.Parse("15:04", user.SessionsResetTime)
	if err != nil {
		svc.logger.Error().Msgf("Not able to parse reset time for user: %s", user.Id)
		return err
	}
	now := time.Now().In(loc)
	target := time.Date(now.Year(), now.Month(), now.Day(), parsed.Hour(), parsed.Minute(), 0, 0, loc)
	if target.Before(time.Now()) {
		target = target.Add(24 * time.Hour)
	}
	targetUTC := target.UTC()
	delay := time.Until(targetUTC)
	t := time.AfterFunc(delay, func() {
		svc.handleResetTrigger(user.Id)
	})
	svc.timerMu.Lock()
	svc.userTimers[user.Id] = t
	svc.timerMu.Unlock()
	return nil
}

func (svc *EventService) constructMessage(t EventType, sessionId int64, s *entities.Session) Message {
	msg := Message{
		EventType: t,
	}
	switch t {
	case EventStart:
		msg.Object = struct {
			Id           int64 `json:"id"`
			TargetTimeMs int64 `json:"targetTimeMs"`
		}{
			Id:           sessionId,
			TargetTimeMs: s.TargetTimeMs,
		}
	case EventPause, EventSessionComplete, EventDeleteSession, EventResetSession:
		msg.Object = sessionId
	default:
		msg.Object = s
	}
	return msg
}

type Connection struct {
	EventC chan Message
	ConnId string
}

type Message struct {
	EventType EventType
	Object    any
}

type SessionSchedule struct {
	UserId       string
	SessionId    int64
	TargetTimeMs int64
}

type UserEventData struct {
	YesterdayMins    int
	Streak           int
	SessionResetTime string
	Timezone         string
	TotalGoalMinutes int
}
