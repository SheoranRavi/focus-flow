package entities

import (
	"time"
)

type User struct {
	Id                string    `json:"id"`
	Name              string    `json:"name"`
	Email             string    `json:"email"`
	CreatedAt         time.Time `json:"createdAt"`
	SessionsResetTime string    `json:"sessionsResetTime"`
	LastResetDate     string    `json:"lastResetDate"`
	LastAutoResetDate string    `json:"lastAutoResetDate"`
	ActiveSessionId   *int64    `json:"activeSessionId"`
	YesterdayMins     int       `json:"yesterdayMins"`
	Streak            int       `json:"streak"`
	Timezone          string    `json:"timezone"`
}

type UserPatchInput struct {
	ActiveSessionId    *int64
	SessionsResetTime  *string
	LastResetDate      *string
	LastAutoResetDate  *string
	YesterdayMins      *int
	Streak             *int
	Timezone           *string
	Name               *string
	Email              *string
	ManualReset        *bool
	UserId             string
	ClearActiveSession bool
}

func (user *User) ApplyPatch(in *UserPatchInput) {
	if in.ClearActiveSession {
		user.ActiveSessionId = nil
	} else if in.ActiveSessionId != nil {
		user.ActiveSessionId = in.ActiveSessionId
	}

	if in.SessionsResetTime != nil {
		user.SessionsResetTime = *in.SessionsResetTime
	}

	if in.LastResetDate != nil {
		user.LastResetDate = *in.LastResetDate
	}

	if in.LastAutoResetDate != nil {
		user.LastAutoResetDate = *in.LastAutoResetDate
	}

	if in.YesterdayMins != nil {
		user.YesterdayMins = *in.YesterdayMins
	}

	if in.Streak != nil {
		user.Streak = *in.Streak
	}

	if in.Timezone != nil {
		user.Timezone = *in.Timezone
	}

	if in.Name != nil {
		user.Name = *in.Name
	}

	if in.Email != nil {
		user.Email = *in.Email
	}
}
