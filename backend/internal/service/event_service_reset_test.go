package service

import (
	"testing"

	"github.com/sheoranravi/focus-flow/backend/internal/entities"
)

func TestCalculateResetTotalsSumsGeneralAndGoalTimeOnce(t *testing.T) {
	// Represents a timer that ran for two minutes under General, then four
	// minutes after focus was switched to a specific goal.
	sessions := []*entities.Session{
		{Title: "General", FocusSeconds: 120},
		{Title: "Writing", FocusSeconds: 240, DailyGoalMinutes: 30},
	}

	totalFocusSeconds, totalGoalMinutes, totalTimeOnGoal := calculateResetTotals(sessions)

	if totalFocusSeconds != 360 {
		t.Fatalf("total focus seconds = %d, want 360", totalFocusSeconds)
	}
	if totalGoalMinutes != 30 {
		t.Fatalf("total goal minutes = %d, want 30", totalGoalMinutes)
	}
	if totalTimeOnGoal != 240 {
		t.Fatalf("total time on goal = %d, want 240", totalTimeOnGoal)
	}
}
