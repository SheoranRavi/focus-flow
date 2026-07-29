# Focus Flow

Focus Flow is a task-based focus timer for organizing work into separate sessions and tracking progress over time.

## What it does

- Create and manage multiple focus sessions, each with its own duration and daily goal.
- Track focused time, completed sessions, daily progress, and streaks.
- Continue using the app as a guest with local storage, or sign in to sync data across devices.
- View productivity analytics by task and date range.
- Receive notifications when a focus session finishes.

## Architecture

The project uses a React and TypeScript frontend with a Go backend and PostgreSQL database.

- Firebase Authentication manages user sign-in and provides ID tokens for authenticated API requests.
- The Go API is organized into handlers, services, repositories, and database entities.
- PostgreSQL stores users, sessions, daily time records, and subscription state. Schema changes are managed with SQL migrations.
- Server-Sent Events (SSE) notify a user's connected clients when sessions are started, paused, reset, edited, deleted, or completed.
- The frontend uses a reducer for timer and session state, with local storage as a guest-mode store and fallback when server synchronization fails.

```mermaid
flowchart LR
    Client[React client\nTimer and session UI]
    API[Go API]
    DB[(PostgreSQL)]
    Scheduler[Backend running-session\nscheduler]
    SSE[SSE event stream]

    Client -->|Authenticated actions| API
    API -->|Read and write session state| DB
    DB --> Scheduler
    Scheduler -->|Persist progress and completion| DB
    API --> SSE
    Scheduler -->|Completion events| SSE
    SSE -->|Notify connected clients| Client
```

## Design choices

### The backend tracks running sessions

The backend keeps track of which session is running, persists its progress to the database each second, and schedules its completion. Persisting the current state keeps the session independent of a single browser tab: if the user closes a tab, switches devices, or reconnects later, every client can read the same server-side state.

It also allows the backend to recover running sessions after a restart, keeps progress durable for analytics and daily resets, and lets completion handling happen centrally. The tradeoff is additional database writes, which could be optimized at larger scale by persisting timestamps and accumulated progress less frequently while calculating the remaining time from those timestamps.

### Clients are notified through events

Session actions are sent to the API. After the backend updates the database, it broadcasts an event to the user's connected clients through SSE. This keeps multiple tabs and devices synchronized without requiring constant polling. The frontend also reconnects and performs a fresh sync when an SSE connection is restored.

### Local-first guest experience

Unauthenticated users can create and run sessions immediately using local storage. When a user signs in, the app loads their server-side sessions and progress, while retaining local fallback behavior for temporary network or API failures.

### Time is calculated from timestamps

Running sessions use a target completion timestamp rather than relying only on browser intervals. This allows the client and backend to recover the correct remaining time after delays, background tabs, or reconnects.

## Technology

React, TypeScript, Vite, Tailwind CSS, Go, PostgreSQL, Firebase Authentication, Server-Sent Events, and Razorpay.

The frontend also includes automated tests with Vitest and React Testing Library, plus SEO-prerendered marketing pages.

## Run locally

### Prerequisites

- Node.js and npm
- Go
- Docker and Docker Compose
- A Firebase project with Authentication enabled
- Razorpay credentials if you want to test subscriptions

### 1. Configure the frontend

From the project root:

```bash
cp .env.example .env
```

Fill in the Firebase values. The default API URL points to `http://localhost:8080`.

### 2. Start PostgreSQL

From the `backend` directory:

```bash
POSTGRES_PASSWORD=focus_password_strong123 docker compose up -d db
```

### 3. Configure and migrate the backend

Create `backend/.env` with `FIREBASE_CREDENTIALS_JSON`, `DATABASE_URL`, and any Razorpay settings such as `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. For local development, the database URL is:

```text
DATABASE_URL=postgres://focus_app:focus_password_strong123@localhost:5432/focus_db?sslmode=disable
```

Run the migrations from the `backend` directory:

```bash
make migrate-up
```

Start the API in a separate terminal:

```bash
make run
```

The backend runs on `http://localhost:8080` by default.

### 4. Start the frontend

From the project root:

```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

Useful commands include:

```bash
npm run type-check
npm run lint
npm test -- --run
npm run build
```
