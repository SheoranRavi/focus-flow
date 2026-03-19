package service

import (
	"context"
	"sync"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
)

type EventService struct {
	userSvc *UserService
	// each user can have n number of connections, so one channel per connection would be there
	// userId -> connectionId -> Connection
	userConnections map[string]map[string]*Connection
	logger          zerolog.Logger
	connectionMu    sync.Mutex
}

func NewEventService(userSvc *UserService) *EventService {
	return &EventService{userSvc: userSvc,
		userConnections: make(map[string]map[string]*Connection),
		logger:          logger.NewServiceLogger("event_service")}
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

func (svc *EventService) constructMessage(t EventType, sessionId int64, s *entities.Session) Message {
	msg := Message{
		EventType: t,
	}
	switch t {
	case EventStart, EventPause, EventSessionComplete, EventDeleteSession, EventResetSession:
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
