-- Stripe webhook idempotency table
-- Prevents double-processing of retried/replayed webhook events

create table if not exists stripe_webhook_events (
  event_id   text primary key,
  event_type text not null,
  created_at timestamptz default now()
);

-- Auto-purge events older than 30 days (Stripe retries window is 3 days)
-- Run this periodically via pg_cron or a scheduled function
-- delete from stripe_webhook_events where created_at < now() - interval '30 days';
