package handlers

import "net/http"

type SessionHandler struct {
	// SessionService
	// AuthService
}

func NewSessionHandler() *SessionHandler {
	return &SessionHandler{}
}

func (this *SessionHandler) Add(rw http.ResponseWriter, req *http.Request) {

}

func (this *SessionHandler) GetAll(rw http.ResponseWriter, req *http.Request) {
}

func (this *SessionHandler) Start(rw http.ResponseWriter, req *http.Request) {
}

func (this *SessionHandler) Pause(rw http.ResponseWriter, req *http.Request) {
}

func (this *SessionHandler) Patch(rw http.ResponseWriter, req *http.Request) {
}

func (this *SessionHandler) Delete(rw http.ResponseWriter, req *http.Request) {
}
