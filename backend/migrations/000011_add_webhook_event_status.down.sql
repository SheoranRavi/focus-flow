ALTER TABLE razorpay_webhook_events
    DROP COLUMN IF EXISTS last_error,
    DROP COLUMN IF EXISTS failed_at,
    DROP COLUMN IF EXISTS processed_at,
    DROP COLUMN IF EXISTS status_updated_at,
    DROP COLUMN IF EXISTS status;
