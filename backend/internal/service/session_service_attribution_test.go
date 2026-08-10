package service

import "testing"

func TestAttributionDeltaAddsOnlyNewElapsedTime(t *testing.T) {
	previousTotal := 0
	totalAdded := 0
	for _, elapsed := range []int{1, 2, 3, 360} {
		var delta int
		previousTotal, delta = attributionDelta(elapsed, 0, previousTotal)
		totalAdded += delta
	}

	if totalAdded != 360 {
		t.Fatalf("attribution added %d seconds; want 360", totalAdded)
	}
}

func TestAttributionDeltaExcludesTimeAlreadyStoredOnGeneral(t *testing.T) {
	previousTotal := 0
	for _, elapsed := range []int{1, 2, 3, 360} {
		var delta int
		previousTotal, delta = attributionDelta(elapsed, elapsed, previousTotal)
		if delta != 0 {
			t.Fatalf("attribution added %d seconds for General timer time", delta)
		}
	}
}
