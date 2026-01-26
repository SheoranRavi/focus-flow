package service

import "github.com/sheoranravi/focus-flow/backend/internal/entities"

type SessionService struct {
	// SessionRepo

}

func NewSessionHandler() *SessionService {
	return &SessionService{}
}

func (this *SessionService) GetAll() []entities.Session {

}

func (this *SessionService) Add(sessionInput CreateInput) (*entities.Session, error) {

}
