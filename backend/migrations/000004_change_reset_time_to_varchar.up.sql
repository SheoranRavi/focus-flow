ALTER TABLE users ALTER COLUMN sessions_reset_time TYPE VARCHAR(8) USING TO_CHAR(sessions_reset_time, 'HH24:MI');
