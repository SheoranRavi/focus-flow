package entities

import "time"

type Use struct {
	Id                string
	Name              string
	Email             string
	CreatedAt         time.Time
	SessionsResetTime time.Time
}
