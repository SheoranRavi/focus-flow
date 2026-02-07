package service

type CreateInput struct {
	UserId           string
	Title            string
	InitialDuration  int
	DailyGoalMinutes int
	TimeLeft         int
	NoGoal           bool
	GroupId          int
}
