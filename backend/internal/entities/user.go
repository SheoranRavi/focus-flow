package entities

import (
	"time"
)

type User struct {
	Id                            string     `json:"id"`
	Name                          string     `json:"name"`
	Email                         string     `json:"email"`
	CreatedAt                     time.Time  `json:"createdAt"`
	SessionsResetTime             string     `json:"sessionsResetTime"`
	LastResetDate                 string     `json:"lastResetDate"`
	LastAutoResetDate             string     `json:"lastAutoResetDate"`
	ActiveSessionId               *int64     `json:"activeSessionId"`
	YesterdayMins                 int        `json:"yesterdayMins"`
	Streak                        int        `json:"streak"`
	Timezone                      string     `json:"timezone"`
	SubscriptionTier              string     `json:"subscriptionTier"`
	SubscriptionStatus            string     `json:"subscriptionStatus"`
	SubscriptionInterval          *string    `json:"subscriptionInterval,omitempty"`
	RazorpayCustomerId            *string    `json:"razorpayCustomerId,omitempty"`
	RazorpaySubscriptionId        *string    `json:"razorpaySubscriptionId,omitempty"`
	SubscriptionStartedAt         *time.Time `json:"subscriptionStartedAt,omitempty"`
	SubscriptionCurrentPeriodEnd  *time.Time `json:"subscriptionCurrentPeriodEnd,omitempty"`
	SubscriptionCancelAtPeriodEnd bool       `json:"subscriptionCancelAtPeriodEnd"`
	SubscriptionCancelledAt       *time.Time `json:"subscriptionCancelledAt,omitempty"`
	SubscriptionUpdatedAt         time.Time  `json:"subscriptionUpdatedAt"`
}

type UserPatchInput struct {
	ActiveSessionId               *int64
	SessionsResetTime             *string
	LastResetDate                 *string
	LastAutoResetDate             *string
	YesterdayMins                 *int
	Streak                        *int
	Timezone                      *string
	Name                          *string
	Email                         *string
	SubscriptionTier              *string
	SubscriptionStatus            *string
	SubscriptionInterval          *string
	RazorpayCustomerId            *string
	RazorpaySubscriptionId        *string
	SubscriptionStartedAt         *time.Time
	SubscriptionCurrentPeriodEnd  *time.Time
	SubscriptionCancelAtPeriodEnd *bool
	SubscriptionCancelledAt       *time.Time
	SubscriptionUpdatedAt         *time.Time
	ManualReset                   *bool
	UserId                        string
	ClearActiveSession            bool
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

	if in.SubscriptionTier != nil {
		user.SubscriptionTier = *in.SubscriptionTier
	}

	if in.SubscriptionStatus != nil {
		user.SubscriptionStatus = *in.SubscriptionStatus
	}

	if in.SubscriptionInterval != nil {
		user.SubscriptionInterval = in.SubscriptionInterval
	}

	if in.RazorpayCustomerId != nil {
		user.RazorpayCustomerId = in.RazorpayCustomerId
	}

	if in.RazorpaySubscriptionId != nil {
		user.RazorpaySubscriptionId = in.RazorpaySubscriptionId
	}

	if in.SubscriptionStartedAt != nil {
		user.SubscriptionStartedAt = in.SubscriptionStartedAt
	}

	if in.SubscriptionCurrentPeriodEnd != nil {
		user.SubscriptionCurrentPeriodEnd = in.SubscriptionCurrentPeriodEnd
	}

	if in.SubscriptionCancelAtPeriodEnd != nil {
		user.SubscriptionCancelAtPeriodEnd = *in.SubscriptionCancelAtPeriodEnd
	}

	if in.SubscriptionCancelledAt != nil {
		user.SubscriptionCancelledAt = in.SubscriptionCancelledAt
	}

	if in.SubscriptionUpdatedAt != nil {
		user.SubscriptionUpdatedAt = *in.SubscriptionUpdatedAt
	}
}

func (user *User) HasAnalyticsAccess() bool {
	return user.SubscriptionTier == "pro" && user.SubscriptionStatus == "active"
}
