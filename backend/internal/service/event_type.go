package service

import (
	"time"
)

type EventType string

const (
	EventStart                 EventType = "start"
	EventPause                 EventType = "pause"
	EventEdit                  EventType = "edit"
	EventSessionComplete       EventType = "session_complete"
	EventNewSession            EventType = "new_session"
	EventDeleteSession         EventType = "delete_session"
	EventResetSession          EventType = "reset_session"
	EventResetProgress         EventType = "reset_progress"
	EventAutoResetTimeChange   EventType = "auto_reset_time_change"
	EventRegistration          EventType = "registration"
	EventSelectedSessionChange EventType = "selected_session_change"
)

func (t EventType) IsValid() bool {
	switch t {
	case EventStart, EventPause, EventEdit, EventSessionComplete,
		EventNewSession, EventDeleteSession, EventResetSession,
		EventResetProgress, EventAutoResetTimeChange, EventRegistration, EventSelectedSessionChange:
		return true
	}
	return false
}

// for the auto_reset_time_change event
type AutoResetEvent struct {
	ResetTime time.Time
}
