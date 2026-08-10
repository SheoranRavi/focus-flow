ALTER TABLE users ADD COLUMN IF NOT EXISTS event_revision BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_events (
    event_id UUID PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    session_id BIGINT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    client_mutation_id UUID NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, revision),
    UNIQUE (user_id, client_mutation_id)
);

CREATE INDEX IF NOT EXISTS idx_user_events_replay ON user_events(user_id, revision);

INSERT INTO user_events (event_id, user_id, revision, event_type, payload)
SELECT (md5(id || clock_timestamp()::text || random()::text))::uuid, id, 0, 'snapshot', '{}'::jsonb FROM users
WHERE NOT EXISTS (SELECT 1 FROM user_events e WHERE e.user_id = users.id);
