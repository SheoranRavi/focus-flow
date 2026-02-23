package service

import (
	"time"

	"github.com/sheoranravi/focus-flow/backend/internal/entities"
)

type EventType string

const (
	EventStart               EventType = "start"
	EventPause               EventType = "pause"
	EventEdit                EventType = "edit"
	EventSessionComplete     EventType = "session_complete"
	EventNewSession          EventType = "new_session"
	EventDeleteSession       EventType = "delete_session"
	EventResetSession        EventType = "reset_session"
	EventResetProgress       EventType = "reset_progress"
	EventAutoResetTimeChange EventType = "auto_reset_time_change"
)

func (t EventType) IsValid() bool {
	switch t {
	case EventStart, EventPause, EventEdit, EventSessionComplete,
		EventNewSession, EventDeleteSession, EventResetSession,
		EventResetProgress, EventAutoResetTimeChange:
		return true
	}
	return false
}

type SessionEvent struct {
	Session *entities.Session
	Type    EventType
}

// for the auto_reset_time_change event
type AutoResetEvent struct {
	ResetTime time.Time
}
