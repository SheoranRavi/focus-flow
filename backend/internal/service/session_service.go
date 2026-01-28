package service

import "github.com/sheoranravi/focus-flow/backend/internal/entities"

type SessionService struct {
	// SessionRepo
	// EventService
}

func NewSessionService() *SessionService {
	return &SessionService{}
}

func (this *SessionService) GetAll() []entities.Session {

}

func (this *SessionService) Add(sessionInput CreateInput) (*entities.Session, error) {

}

func (this *SessionService) Delete(sessionId int) (*entities.Session, error) {

}

func (this *SessionService) Patch(patchInput PatchInput) (*entities.Session, error) {

}
