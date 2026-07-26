DROP INDEX IF EXISTS idx_users_razorpay_subscription_id;
DROP INDEX IF EXISTS idx_users_razorpay_customer_id;
DROP INDEX IF EXISTS idx_users_razorpay_plan_id;

ALTER TABLE users
DROP COLUMN IF EXISTS subscription_updated_at,
DROP COLUMN IF EXISTS subscription_cancelled_at,
DROP COLUMN IF EXISTS subscription_cancel_at_period_end,
DROP COLUMN IF EXISTS subscription_current_period_end,
DROP COLUMN IF EXISTS subscription_started_at,
DROP COLUMN IF EXISTS razorpay_subscription_id,
DROP COLUMN IF EXISTS razorpay_customer_id,
DROP COLUMN IF EXISTS razorpay_plan_id,
DROP COLUMN IF EXISTS subscription_currency,
DROP COLUMN IF EXISTS subscription_interval,
DROP COLUMN IF EXISTS subscription_status,
DROP COLUMN IF EXISTS subscription_tier;
