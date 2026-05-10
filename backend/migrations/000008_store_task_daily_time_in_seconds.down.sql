UPDATE task_daily_time
SET num_seconds_spent = num_seconds_spent / 60;

ALTER TABLE task_daily_time
RENAME COLUMN num_seconds_spent TO num_minutes_spent;
