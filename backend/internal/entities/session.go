package entities

import (
	"time"
)

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
	SessionRunning SessionState = 0
	SessionPaused  SessionState = 1
)

type PatchInput struct {
	State            *SessionState
	DailyGoalMinutes *int
	InitialDuration  *int
	NoGoal           *bool
	UserId           string
	SessionId        int64
}

func (s *Session) ApplyPatch(in *PatchInput) {
	if in.DailyGoalMinutes != nil {
		s.DailyGoalMinutes = *in.DailyGoalMinutes
	}

	if in.InitialDuration != nil {
		s.InitialDuration = *in.InitialDuration
	}

	if in.NoGoal != nil {
		s.NoGoal = *in.NoGoal
	}

	if in.State != nil {
		s.State = *in.State
	}
}

func NewSession(
	userId string,
	title string,
	dailyGoalMinutes int,
	initialDuration int,
	noGoal bool,
	groupId int,
) *Session {

	if title == "" {
		panic("session title cannot be empty")
	}

	return &Session{
		UserId:           userId,
		Title:            title,
		GroupId:          groupId,
		DailyGoalMinutes: dailyGoalMinutes,
		State:            SessionPaused,
		FocusSeconds:     0,
		InitialDuration:  initialDuration,
		IsCompleted:      false,
		TargetTimeMs:     0,
		NoGoal:           noGoal,
		IsDeleted:        false,
	}
}
