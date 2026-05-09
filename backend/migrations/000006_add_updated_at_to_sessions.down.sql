DROP INDEX IF EXISTS idx_sessions_updated_at;
ALTER TABLE sessions
DROP COLUMN updated_at;
