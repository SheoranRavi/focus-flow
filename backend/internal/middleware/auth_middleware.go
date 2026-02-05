package middleware

import (
	"context"
	"net/http"
	"strings"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
)

type contextKey string

const UserIDKey contextKey = "userId"

func FirebaseAuth(app *firebase.App) func(http.Handler) http.Handler {
	authClient, err := app.Auth(context.Background())
	if err != nil {
		panic("failed to init firebase auth client: " + err.Error())
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
			authHeader := req.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(rw, "missing Authorization header", http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(rw, "invalid Authorization header", http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]

			token, err := verifyToken(req.Context(), authClient, tokenString)
			if err != nil {
				http.Error(rw, "invalid auth token", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(req.Context(), UserIDKey, token.UID)
			next.ServeHTTP(rw, req.WithContext(ctx))
		})
	}
}

func verifyToken(ctx context.Context, client *auth.Client, token string) (*auth.Token, error) {
	return client.VerifyIDToken(ctx, token)
}
