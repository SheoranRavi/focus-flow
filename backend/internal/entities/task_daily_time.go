package entities

import "time"

type TaskDailyTime struct {
	Id              int
	SessionId       int64
	Date            time.Time
	NumMinutesSpent int
	GoalMinutes     int
}
