package dto

type SessionEvent struct {
}

type EventType string

const (
	Start         EventType = "start"
	Pause         EventType = "pause"
	Edit          EventType = "edit"
	AddSession    EventType = "add_session"
	DeleteSession EventType = "delete_session"
)
