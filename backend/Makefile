.PHONY: build run clean test dev install-tools migrate-up migrate-down migrate-force migrate-create help

# Variables
BINARY_NAME=focus-api
BUILD_DIR=bin
MAIN_PATH=./cmd/api
MIGRATIONS_PATH=./migrations

# Database
DATABASE_URL ?= postgres://focus_app:focus_password_strong123@localhost:5432/focus_db?sslmode=disable

## help: Display this help message
help:
	@echo "Available targets:"
	@grep -E '^##' $(MAKEFILE_LIST) | sed 's/##//'

## build: Build the application
build:
	@echo "Building..."
	@go build -o $(BUILD_DIR)/$(BINARY_NAME) $(MAIN_PATH)
	@echo "Built $(BUILD_DIR)/$(BINARY_NAME)"

## run: Build and run the application
run: build
	@echo "Running..."
	@./$(BUILD_DIR)/$(BINARY_NAME)

## dev: Run with hot reload using air
dev:
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "air not found. Install it with: make install-tools"; \
		exit 1; \
	fi

## clean: Remove build artifacts
clean:
	@echo "Cleaning..."
	@rm -rf $(BUILD_DIR)
	@go clean

## test: Run tests
test:
	@echo "Running tests..."
	@go test -v ./...

## test-coverage: Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	@go test -v -coverprofile=coverage.out ./...
	@go tool cover -html=coverage.out -o coverage.html

## install-tools: Install development tools
install-tools:
	@echo "Installing development tools..."
	@go install github.com/air-verse/air@latest
	@go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

## deps: Download dependencies
deps:
	@go mod download
	@go mod tidy

## migrate-up: Run database migrations
migrate-up:
	@migrate -path $(MIGRATIONS_PATH) -database "$(DATABASE_URL)" up

## migrate-down: Rollback database migrations
migrate-down:
	@migrate -path $(MIGRATIONS_PATH) -database "$(DATABASE_URL)" down

## migrate-force: Force the migration version (usage: make migrate-force version=4)
migrate-force:
	@if [ -z "$(version)" ]; then \
		echo "usage: make migrate-force version=4"; \
		exit 1; \
	fi
	@migrate -path $(MIGRATIONS_PATH) -database "$(DATABASE_URL)" force $(version)

## migrate-create: Create a new migration (usage: make migrate-create name=add_users)
migrate-create:
	@migrate create -ext sql -dir $(MIGRATIONS_PATH) -seq $(name)

## fmt: Format code
fmt:
	@go fmt ./...

## vet: Run go vet
vet:
	@go vet ./...
