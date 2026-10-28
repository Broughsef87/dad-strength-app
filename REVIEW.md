# Launch-readiness review — 2026-10-26

Scope: correctness, security and launch readiness, with extra attention to
progression carry-over, duplicate saves, the morning routine, sign-in and payments.

**Nothing in production was touched.** No production data, settings or keys were
read or changed, and no migration was applied anywhere but a throwaway local
database. The two new migrations in this branch and the one file in
`supabase/pending/` still need to be applied by hand, in the order below.

## How it was tested

- **Database.** A local Postgres 16 with `supabase/revival.sql` and every
  migration replayed on top. A small shim provides Supabase's `anon`,
  `authenticated` and `service_role` roles, its default table grants, and
  `auth.uid()`.
- **App.** The real production build (`next build`, `next start`) ran against
  that database. A local stand-in served the slice of the Supabase API the app
  uses: the REST queries, email sign-in, token refresh, and Google sign-in via
  PKCE with a fake consent step.
- **Browser.** Playwright drove the app. Stripe webhooks were sent with valid
  signatures made from a dummy local secret.
- **Seed data.** It was produced by the real program engine, so every session is
  what the app would prescribe. Users train the next unfinished day of their
  current program week, the same queue the app uses.

| Seeded | Count |
|---|---|
| Users | 15 |
| Calendar span | 2026-07-27 to 2026-10-25 (13 weeks) |
| Session rows | 805 |
| Set logs | 11,441 |
| Morning check-ins | 632 |

The 15 users include:
- a user who switches Dad Built → Power Dad mid-week-6, then back to Dad Built;
- a time-crunch user;
- a Google sign-in user;
- a user carrying the known duplicate-session-row defect;
- a brand-new user;
- a founder, a past-due subscriber, and a mix of free and Pro.

**Baseline on master:** `tsc` clean, `npm run build` passes, and all 38 check
suites pass. On this branch: `tsc` clean, the build passes, and all 39 suites
pass. Lint reports the same 13 existing problems before and after.

## Fixed in this PR

Each fix was reproduced on master first and re-run on this branch.

### P0 — any user can grant himself Pro, or take over another member's billing

`user_profiles` has one policy, "manage own profile", covering every column, and
Supabase grants `authenticated` UPDATE on the whole table. With only his own
session and the public anon key, a free user could do three things (proven over
HTTP against the local stack):
- **Lifetime Pro.** Setting `founder_pass = true` is trusted by `is_premium()`,
  `entitlements.ts` and the client.
- **Switch programs on the free tier.** Clearing `claimed_program_slug` makes the
  tier trigger treat him as never having claimed one.
- **Act on someone else's billing.** Setting `stripe_customer_id` and
  `stripe_subscription_id` to another member's ids means
  `/api/billing-portal` opens that member's Stripe portal, and
  `/api/account/delete` cancels that member's subscription and deletes their
  Stripe customer.

**Fix:** `supabase/migrations/20261026_protect_billing_columns.sql` adds a
trigger that refuses changes to the billing and claim columns from the
`authenticated` and `anon` roles, plus direct profile deletes. The webhook
(service role), the tier trigger (security definer) and account deletion
(cascade) are unaffected. The checkout route now writes the customer link with
the server key and refuses to send the user to Stripe if that write fails.
`scripts/checks/billing-columns-proof.sql` fails on master and passes after the
migration. Removing any one guarded column from the trigger makes it fail again.

### P0 — a paying subscriber can be left on the free tier for good

The webhook recorded an event as processed before handling it, and ignored the
result of every write it made afterwards. Locally, one injected database blip
during `customer.subscription.created`:
- returned 200, so Stripe never retried;
- dropped the manual re-send as a duplicate;
- left the subscriber on free.

A subscription whose customer id never reached the profile was also dropped
silently.

**Fix:**
- The claim is released on any failure and the webhook answers 500, so Stripe's
  retry does the work.
- Every write is checked.
- Checkout puts the user id on the subscription's metadata, and the webhook falls
  back to it, repairing the link, when the customer id is unknown.
- The Founder's Pass write is an upsert.

**Result after the fix:** the first delivery gets 500, the retry gets 200, and
the user is `pro/active`.

**Checkout** also no longer lets the client choose payment vs subscription (the
mode follows the price), and no longer returns raw error text.

### P0 — the auth middleware never ran

The app is in `src/app`, but `middleware.ts` sat at the repo root, where Next
does not look. The production build's middleware manifest was empty and a
signed-out request to `/dashboard` got a 200. Every page relied on its own
client-side redirect, and the Google `?signin=oauth` handoff was dead code.
`fuel-solve`'s assertion that `/fuel` "is protected server-side" passed the whole
time, because it read the file instead of the build.

**Fix:**
- The file moved to `src/middleware.ts`.
- A signed-out redirect now drops the deep link's own query string and keeps any
  session cookies the auth check refreshed.
- New check `scripts/checks/middleware-wired.mjs` reads the built manifest, not
  the source.

**After the fix:** the build prints `ƒ Proxy (Middleware)`, and signed-out
`/dashboard` returns 307 to `/`. Google sign-in completes through the handoff,
for a brand-new user and for the seeded Google user.

### P0 — new users can never reach the dashboard

Since the legacy `/onboarding` page became a redirect (commit 4a954cd), nothing
sets `onboarding_complete`, in the database or in local storage. The dashboard
sends anyone without it to `/build`. In the browser on master:
- a brand-new Google user signed in, started Dad Built, opened the dashboard, and
  was sent back to `/build`;
- the seeded Google user, with three weeks of training, was too.

Existing accounts only work because their flag was set by the old flow.

**Fix:** the dashboard treats an active program as onboarded and records the
flag, and `/build` sets it when a program starts. Both users now land on
`/dashboard`.

### P1 — Power Dad's top single is overwritten by its own back-off sets

Set logs were unique on name + set number. Power Dad lists the top single and the
back-offs under one name ("Snatch", "Power Clean") on 14 days of the 13-week
macro, 7 of them in time-crunch mode.

**In the browser on master:**
- logging the 180 lb top single and then a back-off left one row, the back-off;
- after a reload, the top card showed 170.

During seeding, the same key overwrote 89 set logs across the four Power Dad
users. From reading the code, removing a set on one card also deleted the other
card's rows, because the delete was keyed by name.

**Fix, in two steps because of deploy order:**
1. **This PR.** The page writes with a key that includes the slot. If the
   database answers that no such index exists (42P10), it falls back to the old
   key, so it is safe to merge first. Cards read, and set removal deletes, by slot.
2. **After this PR is deployed.** Apply
   `supabase/pending/20261026_set_log_key_includes_slot.sql`, which swaps the
   unique index. **Applied before the deploy, it breaks every set save.** That is
   why it is outside `supabase/migrations/`.

**With both applied locally:** both rows are kept, and the top card shows 180
after a reload.

### P1 — two devices opening one session create two session rows

The only guard was an in-memory map inside one browser tab. In the browser on
master, a phone and a laptop opening week 10 day 5 together made two rows 12 ms
apart. That is the production symptom described in `sessionLookup.ts`: sets
split across rows, and autoreg reads only the first.

**Fix:** `supabase/migrations/20261026_one_session_row_per_run.sql` adds a
trigger that refuses a second row for the same session within the current run,
with the unique-violation code. A per-session advisory lock serialises
concurrent inserts. The page's existing "already exists" path now adopts this
run's earliest row (it used to order by id, which picks a random one).
- `scripts/checks/session-row-proof.sql` fails without the trigger.
- A two-connection race was run, and the second insert was refused.
- Two browsers now share one row.

### P1 — progression carry-over after a program switch

Double progression ranked its history by week number across every run ever. The
seeded user who restarted Dad Built is in week 3 of the new run, and his day 6
showed loads from the abandoned run's week 5.

| Exercise | Shown on master | This run's last session |
|---|---|---|
| Leg extension | 85 | 80 |
| Front squat | 70 | 80 |
| Seated calf raise | 85 | 80 |

This would last until the new run's week numbers passed the old ones. The
run-scope check missed it because it only inspects reads of `generated_workouts`.

**Fix:** the history read is scoped to the current run and sorted newest first,
so the 2,000-row cap drops only the oldest rows. The run-scope check now covers
progression reads by slot, and fails on master's page. The branch build shows
80 / 80 / 80.

### P1 — morning routine

- **Failed builds used up the day.** The free user's one daily build was charged
  before the request was even parsed. On master in the browser, a failed build
  returned 500, and "Try again" returned 402, the paywall.
- **Fixes applied:**
  - The daily quota is now only checked up front and charged after the model
    succeeds.
  - The burst limit runs first, so a 429 costs nothing.
  - The request body is validated: minutes are a number, at most three
    objectives of 200 characters, and a real weekday. Free text is reduced to
    one line before it reaches the prompt.
  - The model call has a 25 s timeout and a 2,000-token output cap, and the
    function has a 30 s limit (no cap was set before).
  - "Per day" is a 20-hour window, so an earlier start the next morning is not
    refused.
  - Between midnight and 4 am the weekday sent to the model now matches the day
    the routine is filed under.
- **On the branch,** two failed builds both return 500, and no quota row is
  written.

### P2 — finishing a session could fail silently

The completion record's write was unchecked: the cleared screen showed even when
nothing was saved, and the week never advanced. It now reports the failure and
stops.

## Not fixed — ranked

Each item is labelled as verified (reproduced or measured) or read only.

### Payments
1. **Read only.** One failed renewal removes Pro immediately. The webhook sets
   `past_due`, and entitlements require `active`. The old comment promised a
   grace period while Stripe retries. Decide on the policy (for example, treat
   `past_due` as Pro for 7 days) before launch.
2. **Read only.** Subscription events are applied in arrival order, not by
   `event.created`. An older `past_due` arriving after a newer `active` would
   downgrade a paid user. Compare timestamps, or fetch the subscription from
   Stripe in the handler.
3. **Read only.** Two checkouts started in parallel can create two
   subscriptions. There is no idempotency key and no check for an existing open
   subscription.
4. **Read only.** A `trialing` subscription maps to free. That is harmless
   today, but wrong if trials are turned on.
5. **Read only.** `stripe_webhook_events` is never purged. The migration only
   suggests a cron job.

### Sign-in
6. **Verified in library source by a reviewer.** Forgot-password never lets the
   user set a new password. The link lands on `/dashboard`, and nothing calls
   `updateUser`. Add an update-password page that handles `PASSWORD_RECOVERY`.
7. **Read only.** The OAuth return URL is built from the browser's current
   origin. If someone signs in on the bare domain or a preview URL that is not
   on the Supabase allowed list, the PKCE code is never exchanged and nothing
   explains why. Build it from `NEXT_PUBLIC_APP_URL`, and redirect the bare
   domain to www.
8. **Verified by running the middleware.** A deep link opened while signed out
   is lost after sign-in. Add a `next` parameter, allowing only paths that start
   with `/` and not `//`.
9. **Verified in library source.** A failed `signOut()` is ignored, and
   `dad-strength-active-program` and `activeWorkoutId` survive in local storage
   on shared devices.
10. **Read only.** There are no security headers. Without
    `frame-ancestors 'none'`, account deletion can be framed by another site
    (clickjacking).
11. **Measured in the build.** Next 16 warns that `middleware.ts` is deprecated
    in favour of `proxy.ts`. It works today; rename it in a follow-up. The
    matcher also runs an auth call on every request, including `/api/*` and
    static files such as `sw.js`.

### Training
12. **Measured.** A missed day stalls the program week forever: the week
    advances only when every scheduled session is done. On 13 calendar weeks of
    seeded data, two users who miss often are on program week 7. Decide whether
    the app should offer "skip" or move on after a set number of days. This is a
    product decision.
13. **Read only.** Production already holds duplicate session rows (the
    `sessionLookup.ts` comment cites the owner's week 6 and 7 Mondays) and
    overwritten Power Dad top singles. Both need a one-off audit, and the
    duplicates a merge. That is a data-rewriting migration, so it was not
    written here.
14. **Read only.** `/build` sets `started_at` from the phone's clock, while
    session rows use the database clock. A phone running fast hides the first
    rows of a new run from every run-scoped read for the size of the skew. Set
    it on the server instead.
15. **Observed once.** Reopening a completed day showed "week progress" as 1 of
    6 for a user with 5 of 6 done. Not investigated.

### Morning routine
16. **Verified by grep.** Objectives never reach the model: the dashboard does
    not pass them. The latest commit's "one goal after a rough night" rule can
    never fire.
17. **Verified by a reviewer.** The rate limiter counts, then inserts, and fails
    open on errors. Five parallel free-user requests all ran. Charging only on
    success keeps this race; it is bounded by the per-minute burst limit. The
    real fix is one SQL function that locks, counts and inserts in a single
    transaction.
18. **Verified in SQL.** With two tabs or devices, ticks made in one land on the
    routine the other rebuilt. Give each entry an id and check it on partial
    updates.
19. **Verified by a reviewer.** Model output is not checked for one step per
    pillar or for minutes adding up. A malformed reply fails rather than falling
    back to a fixed routine.
20. **Read only.**
    - "Rebuild" clears the screen before the paywall check, so a free user at
      the cap is left with nothing on screen.
    - A home-screen app resumed the next morning shows yesterday's routine until
      it is reloaded.
    - A model refusal becomes a 500.

### Platform
21. **Measured.** `npm audit --omit=dev` reports 26 vulnerabilities: 2 critical,
    17 high, 1 moderate and 6 low. The critical ones are `next` (16.1.6;
    non-major fix in 16.4.3, including request smuggling in rewrites) and
    `@sentry/nextjs` (a tunnel-route middleware bypass; fix available). Upgrade
    both before launch.
22. **Read only.** Repo clean-up:
    - `fix.js` at the root is a one-off script with a hard-coded Windows path.
    - `.claude/launch.json` has Windows paths.
    - The README is the create-next-app template.
    - There are 13 lint problems (4 errors), the same before and after this
      branch.
23. **Read only.** Several checks assert by reading source with regexes
    (`fuel-solve`, `onboarding-check`, `session-plan`). Two of the three P0
    launch blockers above passed every such check. Where a behaviour can be
    executed — the build manifest, a database proof, a browser run — prefer
    that.

## Deploy order

0. `supabase/migrations/20261027_webhook_event_processed.sql` (additive): already
   applied to production on 2026-10-27, before the merge, as the new webhook
   needs it.
1. Review and merge this PR. It is safe without any further database change:
   the set-log writer falls back, and the other code paths need nothing new.
2. **Once step 1 is live,** apply
   `supabase/migrations/20261026_protect_billing_columns.sql`. Before then the
   live checkout links the Stripe customer with the user's own client, and the
   lock would refuse it: a payment with no Pro. Run
   `scripts/checks/billing-columns-proof.sql` against a replayed copy only.
   **Do not run either proof against production.**
3. **Hold** `supabase/migrations/20261026_one_session_row_per_run.sql` and
   `supabase/pending/20261026_set_log_key_includes_slot.sql` until a follow-up
   ships that forces tabs and installed apps on an older build to reload.
   Waiting does not guarantee every open tab reloads, and an old tab has no
   fallback for the key swap: every set save in it would fail.
5. Before launch: decide items 1 and 12, fix item 6, upgrade per item 21.

Per CLAUDE.md, items touching Stripe, billing, auth or secrets are gated on
Andrew. That covers every P0 here. This PR is a draft for that reason and has
not been merged.
