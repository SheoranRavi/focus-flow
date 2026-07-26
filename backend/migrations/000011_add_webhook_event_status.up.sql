ALTER TABLE razorpay_webhook_events
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'processing',
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS last_error TEXT NULL,
    ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE razorpay_webhook_events
SET
    status = 'processed',
    processed_at = COALESCE(processed_at, created_at),
    status_updated_at = COALESCE(processed_at, created_at)
WHERE status = 'processing';
