// backend/internal/logger/logger.go
package logger

import (
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var (
	appLogger zerolog.Logger
	logFile   *os.File
)

// Initialize sets up the logger with file and console output
func Initialize() error {
	// Create logs directory if it doesn't exist
	if err := os.MkdirAll("logs", 0755); err != nil {
		return err
	}

	// Open log file with rotation-friendly name
	logPath := filepath.Join("logs", "app.log")
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return err
	}
	logFile = file

	// Determine if we should use console writer based on environment
	var writers []io.Writer

	// Always write to file
	writers = append(writers, file)

	// Add console output in development
	if os.Getenv("APP_ENV") != "production" {
		consoleWriter := zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
		}
		writers = append(writers, consoleWriter)
	}

	multiWriter := zerolog.MultiLevelWriter(writers...)

	// Set global log level
	zerolog.SetGlobalLevel(getLogLevel())

	// Create base logger
	appLogger = zerolog.New(multiWriter).
		With().
		Timestamp().
		Caller().
		Logger()

	// Update global logger too
	log.Logger = appLogger

	return nil
}

// getLogLevel returns the log level based on environment
func getLogLevel() zerolog.Level {
	switch os.Getenv("LOG_LEVEL") {
	case "debug":
		return zerolog.DebugLevel
	case "info":
		return zerolog.InfoLevel
	case "warn":
		return zerolog.WarnLevel
	case "error":
		return zerolog.ErrorLevel
	default:
		return zerolog.InfoLevel
	}
}

// Close closes the log file
func Close() error {
	if logFile != nil {
		return logFile.Close()
	}
	return nil
}

// GetLogger returns the base application logger
func GetLogger() zerolog.Logger {
	return appLogger
}

// NewServiceLogger returns a logger with service context
func NewServiceLogger(serviceName string) zerolog.Logger {
	return appLogger.With().
		Str("layer", "service").
		Str("service", serviceName).
		Logger()
}

// NewHandlerLogger returns a logger with handler context
func NewHandlerLogger(handlerName string) zerolog.Logger {
	return appLogger.With().
		Str("layer", "handler").
		Str("handler", handlerName).
		Logger()
}

// NewRepoLogger returns a logger with repository context
func NewRepoLogger(repoName string) zerolog.Logger {
	return appLogger.With().
		Str("layer", "repo").
		Str("repo", repoName).
		Logger()
}

// WithContext adds request-specific context fields
func WithContext(logger zerolog.Logger, userID string) zerolog.Logger {
	return logger.With().Str("user_id", userID).Logger()
}
