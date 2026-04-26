ALTER TABLE users ALTER COLUMN sessions_reset_time TYPE TIME USING sessions_reset_time::TIME;
