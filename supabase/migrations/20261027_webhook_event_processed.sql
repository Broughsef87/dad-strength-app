-- Additive. A webhook claim is no longer "done" the moment it is inserted:
-- the handler stamps processed_at when it finishes. A redelivered event whose
-- claim was never stamped (the handler failed and the claim could not be
-- released, e.g. the database was down) is processed again instead of being
-- answered "duplicate" forever. Existing rows keep NULL; Stripe only
-- redelivers events it saw fail, so none of them will come back.
alter table stripe_webhook_events add column if not exists processed_at timestamptz;
