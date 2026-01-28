package service

type CreateInput struct {
	Title            string
	InitialDuration  int
	DailyGoalMinutes int
	NoGoal           bool
	GroupId          int
}

type PatchInput struct {
	DailyGoalMinutes int
	InitialDuration  int
	NoGoal           int
}
