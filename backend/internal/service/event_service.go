package service

import (
	"context"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
)

type EventService struct {
	userSvc *UserService
	// each user can have n number of connections, so one channel per connection would be there
	userConnections map[string][]*Connection
	logger          zerolog.Logger
}

func NewEventService(userSvc *UserService) *EventService {
	return &EventService{userSvc: userSvc,
		userConnections: make(map[string][]*Connection),
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
	return err
}

// ToDo: Add RemoveClient logic on disconnect. Need to generate some clientId for that.
// So, create a map of map for it. map[string]map[string]*Connection
func (svc *EventService) AddClient(userId string) chan string {
	svc.logger.Info().Str("userId", userId).Msg("New connection for user")
	_, ok := svc.userConnections[userId]
	if !ok {
		svc.userConnections[userId] = make([]*Connection, 0)
	}
	conns := svc.userConnections[userId]
	eventChan := make(chan string)
	conns = append(conns, &Connection{eventC: eventChan})
	return eventChan
}

func (svc *EventService) BroadcastToClientConnections(userId string, msg string) {
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
		case conn.eventC <- msg:
		default:
			// drop if client slow...
		}
	}
}

type Connection struct {
	eventC chan string
}
