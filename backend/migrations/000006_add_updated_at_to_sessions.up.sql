ALTER TABLE sessions
ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW();

CREATE INDEX idx_sessions_updated_at ON sessions(updated_at DESC);
