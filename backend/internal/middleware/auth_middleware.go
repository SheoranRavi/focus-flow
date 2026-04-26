package middleware

import (
	"context"
	"net/http"
	"strings"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
)

type contextKey string

type AuthUser struct {
	UID   string
	Email string
	Name  string
}

const (
	UserIDKey   contextKey = "userId"
	AuthUserKey contextKey = "authUser"
)

func claimAsString(claims map[string]interface{}, key string) string {
	value, ok := claims[key]
	if !ok {
		return ""
	}

	stringValue, ok := value.(string)
	if !ok {
		return ""
	}

	return stringValue
}

func FirebaseAuth(app *firebase.App) func(http.Handler) http.Handler {
	authClient, err := app.Auth(context.Background())
	if err != nil {
		panic("failed to init firebase auth client: " + err.Error())
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
			var tokenString string

			authHeader := req.Header.Get("Authorization")
			if authHeader == "" {
				// check token query string param
				tokenString = req.URL.Query().Get("token")
				if tokenString == "" {
					http.Error(rw, "missing Authorization header or token query parameter", http.StatusUnauthorized)
					return
				}
			} else {
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) != 2 || parts[0] != "Bearer" {
					http.Error(rw, "invalid Authorization header", http.StatusUnauthorized)
					return
				}
				tokenString = parts[1]
			}

			token, err := verifyToken(req.Context(), authClient, tokenString)
			if err != nil {
				http.Error(rw, "invalid auth token", http.StatusUnauthorized)
				return
			}

			authUser := AuthUser{
				UID:   token.UID,
				Email: claimAsString(token.Claims, "email"),
				Name:  claimAsString(token.Claims, "name"),
			}

			ctx := context.WithValue(req.Context(), UserIDKey, token.UID)
			ctx = context.WithValue(ctx, AuthUserKey, authUser)
			next.ServeHTTP(rw, req.WithContext(ctx))
		})
	}
}

func verifyToken(ctx context.Context, client *auth.Client, token string) (*auth.Token, error) {
	return client.VerifyIDToken(ctx, token)
}
