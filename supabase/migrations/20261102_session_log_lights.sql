-- FOR-337: competition lights on the classic lifts (snatch, clean & jerk).
-- 3 = three white lights (clean), 2 = good, 1 = barely made it, 0 = a miss.
-- Null on every other lift, which keeps logging RPE. Additive: no row changes.
alter table public.ares_session_logs
  add column if not exists lights smallint
  constraint ares_session_logs_lights_range check (lights between 0 and 3);
