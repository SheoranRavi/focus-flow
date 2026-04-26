package entities

import (
	"database/sql"
	"errors"
	"time"
)

type Session struct {
	Id               int64         `json:"id"`
	Title            string        `json:"title"`
	SessionDuration  int           `json:"sessionDuration"`
	IsCompleted      bool          `json:"isCompleted"`
	DailyGoalMinutes int           `json:"dailyGoalMinutes"`
	NoGoal           bool          `json:"noGoal"`
	IsDeleted        bool          `json:"isDeleted"`
	FocusSeconds     int           `json:"focusSeconds"` // Number of seconds spent on it so far in current day
	TargetTimeMs     int64         `json:"targetTimeMs"` // ms since epoch
	State            SessionState  `json:"state"`
	GroupId          sql.NullInt32 `json:"groupId,omitempty"`
	UserId           string        `json:"userId"`
	TimeLeft         int           `json:"timeLeft"` // in seconds
	CreatedAt        time.Time     `json:"createdAt"`
}

type SessionState int16

const (
	SessionPaused  SessionState = 0
	SessionRunning SessionState = 1
)

type PatchInput struct {
	State            *SessionState
	DailyGoalMinutes *int
	SessionDuration  *int
	TimeLeft         *int
	NoGoal           *bool
	TargetTimeMs     *int64
	FocusSeconds     *int
	IsCompleted      *bool
}

func (s *Session) ApplyPatch(in *PatchInput) {
	if in.DailyGoalMinutes != nil {
		s.DailyGoalMinutes = *in.DailyGoalMinutes
	}

	if in.SessionDuration != nil {
		s.SessionDuration = *in.SessionDuration
	}

	if in.TimeLeft != nil {
		s.TimeLeft = *in.TimeLeft
	}

	if in.TargetTimeMs != nil {
		s.TargetTimeMs = *in.TargetTimeMs
	}

	if in.FocusSeconds != nil {
		s.FocusSeconds = *in.FocusSeconds
	}

	if in.NoGoal != nil {
		s.NoGoal = *in.NoGoal
	}

	if in.State != nil {
		s.State = *in.State
	}
	if in.IsCompleted != nil {
		s.IsCompleted = *in.IsCompleted
	}
}

func NewSession(
	userId string,
	title string,
	dailyGoalMinutes int,
	sessionDuration int,
	timeLeft int,
	noGoal bool,
	groupId int,
) (*Session, error) {

	if title == "" {
		return nil, errors.New("session title cannot be empty")
	}
	var sqlGroupId sql.NullInt32
	if groupId != 0 {
		sqlGroupId.Valid = true
		sqlGroupId.Int32 = int32(groupId)
	}
	return &Session{
		UserId:           userId,
		Title:            title,
		GroupId:          sqlGroupId,
		DailyGoalMinutes: dailyGoalMinutes,
		State:            SessionPaused,
		TimeLeft:         timeLeft,
		FocusSeconds:     0,
		SessionDuration:  sessionDuration,
		IsCompleted:      false,
		TargetTimeMs:     0,
		NoGoal:           noGoal,
		IsDeleted:        false,
	}, nil
}
