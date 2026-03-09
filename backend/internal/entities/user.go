package entities

import (
	"time"
)

type User struct {
	Id                string
	Name              string
	Email             string
	CreatedAt         time.Time
	SessionsResetTime time.Time
	ActiveSessionId   int64
}

type UserPatchInput struct {
	ActiveSessionId  *int64
	SessionResetTime *time.Time
	UserId           string
}

func (user *User) ApplyPatch(in *UserPatchInput) {
	if in.ActiveSessionId != nil {
		user.ActiveSessionId = *in.ActiveSessionId
	}

	if in.SessionResetTime != nil {
		user.SessionsResetTime = *in.SessionResetTime
	}
}
