package service

type CreateInput struct {
	UserId           string
	Title            string
	SessionDuration  int
	DailyGoalMinutes int
	TimeLeft         int
	NoGoal           bool
	GroupId          int
}
