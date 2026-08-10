package service

import (
	"testing"
	"time"
)

func TestCancelUserTimerStopsAndRemovesTimer(t *testing.T) {
	svc := &SessionService{
		userTimers: make(map[string]*TickerChan),
	}
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	cancel := make(chan bool)
	svc.userTimers["user-1"] = &TickerChan{
		Ticker:     ticker,
		SessionId:  42,
		CancelChan: cancel,
	}

	if !svc.CancelUserTimer("user-1") {
		t.Fatal("CancelUserTimer() returned false for an active timer")
	}

	select {
	case <-cancel:
		// The timer worker received its cancellation signal.
	default:
		t.Fatal("CancelUserTimer() did not close the timer cancellation channel")
	}

	if _, ok := svc.userTimers["user-1"]; ok {
		t.Fatal("CancelUserTimer() left the timer in the map")
	}
	if svc.CancelUserTimer("user-1") {
		t.Fatal("CancelUserTimer() returned true after the timer was removed")
	}
}
