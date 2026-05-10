package service

import (
	"context"
	"errors"
	"time"

	"github.com/rs/zerolog"
	"github.com/sheoranravi/focus-flow/backend/internal/entities"
	"github.com/sheoranravi/focus-flow/backend/internal/logger"
	"github.com/sheoranravi/focus-flow/backend/internal/repo"
)

var (
	ErrAnalyticsInvalidRange  = errors.New("start date must be on or before end date")
	ErrAnalyticsRangeTooLarge = errors.New("analytics range must not exceed 6 months")
)

type AnalyticsService struct {
	sessionSvc *SessionService
	repo       *repo.AnalyticsRepo
	logger     zerolog.Logger
}

func NewAnalyticService(sessionSvc *SessionService, repo *repo.AnalyticsRepo) *AnalyticsService {
	return &AnalyticsService{
		sessionSvc: sessionSvc,
		repo:       repo,
		logger:     logger.NewServiceLogger("AnalyticsService"),
	}
}

func (svc *AnalyticsService) GetAnalytics(ctx context.Context, userId string, startDate, endDate time.Time, includeDeleted bool) ([]*entities.SessionAnalytics, error) {
	startDate = normalizeAnalyticsDate(startDate)
	endDate = normalizeAnalyticsDate(endDate)

	if startDate.After(endDate) {
		return nil, ErrAnalyticsInvalidRange
	}
	if endDate.After(startDate.AddDate(0, 6, 0)) {
		return nil, ErrAnalyticsRangeTooLarge
	}

	sessionAnalytics, err := svc.repo.ComputeAnalytics(ctx, userId, startDate, endDate, includeDeleted)
	if err != nil {
		return nil, err
	}
	return sessionAnalytics, nil
}

func normalizeAnalyticsDate(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
