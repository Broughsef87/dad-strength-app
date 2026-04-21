-- Migration: 20260408_ai_request_logs
-- Replaces in-memory rate-limit Maps (broken in serverless — each cold start
-- gets a fresh map) with a Supabase-backed per-user request log.
-- Rate limiting is now per authenticated user, not per IP.

create table if not exists ai_request_logs (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  route       text        not null,
  created_at  timestamptz default now() not null
);

-- Fast lookup: count recent requests per user+route
create index if not exists idx_ai_request_logs_user_route_time
  on ai_request_logs (user_id, route, created_at desc);

alter table ai_request_logs enable row level security;

-- Server-side inserts use the service-role key (bypasses RLS).
-- Users can read their own logs (useful for future quota UI).
create policy "Users read own ai logs"
  on ai_request_logs for select
  using (auth.uid() = user_id);

-- Auto-prune rows older than 24 hours to keep the table lean.
-- Run this periodically via pg_cron or Supabase scheduled functions:
-- delete from ai_request_logs where created_at < now() - interval '24 hours';
