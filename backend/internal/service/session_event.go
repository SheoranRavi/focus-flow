package service

import "github.com/sheoranravi/focus-flow/backend/internal/entities"

type EventType string

const (
	EventStart         EventType = "start"
	EventPause         EventType = "pause"
	EventEdit          EventType = "edit"
	EventNewSession    EventType = "new_session"
	EventDeleteSession EventType = "delete_session"
)

func (t EventType) IsValid() bool {
	switch t {
	case EventStart, EventPause, EventEdit, EventNewSession, EventDeleteSession:
		return true
	}
	return false
}

type SessionEvent struct {
	Session *entities.Session
	Type    EventType
}
