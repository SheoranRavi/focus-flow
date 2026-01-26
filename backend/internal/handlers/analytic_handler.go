package handlers

import "net/http"

type AnalyticHandler struct {
	// AnalyticService
	// AuthService
}

func NewAnalyticHandler() *AnalyticHandler {
	return &AnalyticHandler{}
}

func (this *AnalyticHandler) Get(rw http.ResponseWriter, req *http.Request) {

}
