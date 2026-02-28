package service

import (
	"context"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
)

type EventService struct {
	userSvc *UserService
	// each user can have n number of connections, so one channel per connection would be there
	//userConnections map[string][]*Connection
	// userId -> connectionId -> Connection
	userConnections map[string]map[string]*Connection
	logger          zerolog.Logger
	mu              sync.Mutex
}

func NewEventService(userSvc *UserService) *EventService {
	return &EventService{userSvc: userSvc,
		//userConnections: make(map[string][]*Connection),
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
	if t == EventStart || t == EventPause {
		patch := entities.UserPatchInput{
			ActiveSessionId: &sessionId,
		}
		if t == EventPause {
			patch.ActiveSessionId = nil
		}
		err = svc.userSvc.Update(ctx, &patch)
	}
	svc.BroadcastToClientConnections(userId, fmt.Sprintf("Event type: %s", t))
	return err
}

// ToDo: Make it thread safe
func (svc *EventService) AddClient(userId string) *Connection {
	svc.mu.Lock()
	defer svc.mu.Unlock()
	svc.logger.Info().Str("userId", userId).Msg("New connection for user")
	_, ok := svc.userConnections[userId]
	if !ok {
		svc.userConnections[userId] = make(map[string]*Connection, 0)
	}
	eventChan := make(chan string, 10)

	connId := uuid.New().String()
	newConnection := &Connection{EventC: eventChan, ConnId: connId}

	svc.userConnections[userId][connId] = newConnection
	return newConnection
}

func (svc *EventService) BroadcastToClientConnections(userId string, msg string) {
	svc.mu.Lock()
	defer svc.mu.Unlock()
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
	svc.mu.Lock()
	defer svc.mu.Unlock()
	delete(svc.userConnections[userId], connId)
}

type Connection struct {
	EventC chan string
	ConnId string
}
