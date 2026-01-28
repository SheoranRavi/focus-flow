package repo

import (
	"context"

	"github.com/sheoranravi/focus-flow/backend/internal/entities"
)

type AnalyticsRepo struct {
}

func (this *AnalyticsRepo) ComputeAnalytics(ctx context.Context, userId string) []*entities.Session {

}
