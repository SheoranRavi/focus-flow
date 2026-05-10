package entities

import "time"

type SessionAnalytics struct {
	SessionId        int64     `json:"id"`
	SessionName      string    `json:"name"`
	Date             time.Time `json:"date"`
	TimeSpentMinutes int       `json:"timeSpentMinutes"`
	GoalMinutes      int       `json:"goalMinutes"`
}
