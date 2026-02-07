-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    sessions_reset_time TIMESTAMP NULL DEFAULT NULL,
    active_session_id BIGINT NULL DEFAULT NULL
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    daily_goal_minutes INTEGER NOT NULL DEFAULT 0,
    state SMALLINT NOT NULL DEFAULT 0,
    focus_seconds INTEGER NOT NULL DEFAULT 0,
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    initial_duration INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    target_time_ms BIGINT NOT NULL DEFAULT 0,
    time_left INTEGER NOT NULL DEFAULT 0,
    no_goal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Task daily time tracking
CREATE TABLE IF NOT EXISTS task_daily_time (
    id SERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    num_minutes_spent INTEGER NOT NULL DEFAULT 0,
    goal_minutes INTEGER NOT NULL DEFAULT 0,
    UNIQUE(session_id, date)
);

-- Indexes for performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_group_id ON sessions(group_id);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX idx_task_daily_time_session_id ON task_daily_time(session_id);
CREATE INDEX idx_task_daily_time_date ON task_daily_time(date);