package entities

import "time"

type Session struct {
	Id               int64
	Title            string
	InitialDuration  int
	IsCompleted      bool
	DailyGoalMinutes int
	NoGoal           bool
	IsDeleted        bool
	FocusSeconds     int   // Number of seconds spent on it so far
	TargetTimeMs     int64 // ms since epoch
	State            SessionState
	GroupId          int
	UserId           string
	CreatedAt        time.Time
}

type SessionState int16

const (
	Running SessionState = 0
	Paused  SessionState = 1
)
