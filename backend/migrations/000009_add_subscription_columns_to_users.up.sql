ALTER TABLE users
ADD COLUMN subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
ADD COLUMN subscription_status VARCHAR(20) NOT NULL DEFAULT 'inactive',
ADD COLUMN subscription_interval VARCHAR(20) NULL,
ADD COLUMN subscription_currency VARCHAR(10) NULL,
ADD COLUMN razorpay_plan_id VARCHAR(255) NULL,
ADD COLUMN razorpay_customer_id VARCHAR(255) NULL,
ADD COLUMN razorpay_subscription_id VARCHAR(255) NULL,
ADD COLUMN subscription_started_at TIMESTAMPTZ NULL,
ADD COLUMN subscription_current_period_end TIMESTAMPTZ NULL,
ADD COLUMN subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN subscription_cancelled_at TIMESTAMPTZ NULL,
ADD COLUMN subscription_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_razorpay_customer_id
ON users(razorpay_customer_id)
WHERE razorpay_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_razorpay_subscription_id
ON users(razorpay_subscription_id)
WHERE razorpay_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_razorpay_plan_id
ON users(razorpay_plan_id)
WHERE razorpay_plan_id IS NOT NULL;
