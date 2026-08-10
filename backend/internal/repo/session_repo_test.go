package repo

import (
	"context"
	"database/sql"
	"regexp"
	"testing"

	"github.com/sheoranravi/focus-flow/backend/internal/entities"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestUpdateAndAppendEventRollsBackSessionWhenRevisionInsertFails(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	sessionRepo := NewSessionRepo(db)
	eventRepo := NewEventRepo(db)
	s := &entities.Session{Id: 4, UserId: "user-1", State: entities.SessionPaused, TimeLeft: 100, SessionDuration: 100}
	mock.ExpectBegin()
	mock.ExpectExec("(?s)WITH updated AS").WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery("SELECT id FROM users WHERE id=\\$1 FOR UPDATE").WithArgs("user-1").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("user-1"))
	mock.ExpectQuery("UPDATE users SET event_revision").WithArgs("user-1").WillReturnError(sql.ErrNoRows)
	mock.ExpectRollback()

	if _, err := sessionRepo.UpdateAndAppendEvent(context.Background(), s, false, eventRepo, "pause", s, ""); err == nil {
		t.Fatal("expected event allocation failure")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestResetProgressClearsRunningTimerState(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() failed: %v", err)
	}
	defer db.Close()

	repo := NewSessionRepo(db)
	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id, focus_seconds, daily_goal_minutes").
		WithArgs("user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "focus_seconds", "daily_goal_minutes"}).
			AddRow(int64(1), 60, 0).
			AddRow(int64(7), 120, 30))
	mock.ExpectExec("INSERT INTO task_daily_time").
		WithArgs(int64(1), "2026-08-10", 60, 0).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("INSERT INTO task_daily_time").
		WithArgs(int64(7), "2026-08-10", 120, 30).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(regexp.QuoteMeta("UPDATE sessions") + `(?s).*state = 0.*target_time_ms = 0`).
		WithArgs("user-1").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	if err := repo.ResetProgress(context.Background(), "user-1", "2026-08-10"); err != nil {
		t.Fatalf("ResetProgress() failed: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("reset transaction did not perform the expected lifecycle reset: %v", err)
	}
}
