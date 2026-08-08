ALTER TABLE users
ADD COLUMN session_duration INTEGER NOT NULL DEFAULT 1500;

-- Existing goal rows keep their historical value; the user-level value is
-- used for all newly started shared timers.
