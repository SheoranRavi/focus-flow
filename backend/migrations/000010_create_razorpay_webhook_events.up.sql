CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    subscription_id VARCHAR(255) NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_subscription_id
ON razorpay_webhook_events(subscription_id)
WHERE subscription_id IS NOT NULL;
