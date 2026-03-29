# Dad Strength — Product Plan

---

## North Star

> **"Strong dads raise strong kids."**

Fatherhood is not the obstacle. It is the mission.

Every feature in this app must answer one question: *does this help a dad be stronger for his family?* If it can't answer that, it doesn't belong here.

This is not a fitness app with a dad theme. This is a **Dad OS** — the daily operating system for a man who refuses to let the weight of responsibility make him weak. It covers the four things that make a man complete: how he trains, how he thinks, how he lives, and who he's accountable to.

---

## What This App Is

A daily operating system for fathers who want to be the strongest version of themselves — physically, mentally, and relationally. Built for the dad who wakes up early, moves with purpose, and understands that showing up for himself *is* showing up for his family.

**Connected ecosystem:**
- The app is the daily tool
- The Skool community is the accountability layer (Brotherhood)
- The YouTube channel is the top-of-funnel that feeds both

The flywheel: content → community → app → retention → content.

---

## Brand Identity

**Keep and protect:**
- **The Squeeze** — the 18-min workout format. Brand name stays. Add "18-min workout" subtitle in-app for clarity on first use.
- **Brotherhood** — the community layer. Not "Accountability." Brotherhood is the reason men join.
- **Spirit** — the fourth pillar. Not "Life," not "Family." Spirit is intentional. The guy turned off by it was never the customer. The guy who sees it and thinks "this was built for me" — that's who we're building for. Features inside must work for religious and non-religious dads alike.
- **Dad Score** — the gamified whole-man metric. Trains, thinks, shows up for family. Measures all of it.
- **Iron Path / At Home** — program track names. Keep them.

---

## The Four Pillars

| Pillar | Tab | What It Covers |
|--------|-----|----------------|
| Body | Body | Training, programs, The Squeeze, vitals, strength |
| Mind | Mind | Daily objectives, deep work, journaling, morning protocol |
| Spirit | Spirit | Prayer/meditation (optional), habits, family pulse, relationships |
| Brotherhood | Community | Skool integration, leaderboard, accountability, Dad Score rankings |

**Navigation:** HQ (dashboard) + four pillar tabs. Clean. No confusion.

---

## Product Philosophy

1. **Fatherhood is the reason, not the obstacle.** The baby didn't derail you — it's why you're here. The app adapts to your life (sleep quality, time available, energy) and serves you accordingly.
2. **Strong brands have edges.** Don't sand off the language to appeal to everyone. The men this is built for will recognize it immediately.
3. **One job per screen.** Every page should have one primary action. The user should never wonder what to do next.
4. **AI earns its place.** AI features should make the dad feel seen and served — not generic. If an AI feature could exist in any app, it shouldn't be in this one.
5. **The app never goes silent.** Every day — training day or not — the app has something for you.

---

## What We're Cutting / Changing

### Cut Entirely
- **Hardcoded Empire metrics** (YouTube subs, SaaS MRR, "Operation: Freedom") — personal dashboard masquerading as a product feature
- **Automation Hook** — undefined, unbuilt, remove from UI immediately
- **Hardcoded "Pro Member" badge** — everyone being Pro means no one is Pro. Remove until real tiers exist.
- **"Dad of Month" badge** — if not earned via real criteria, it's fake. Cut until it's real.
- **Multiple redundant AI endpoints** — Weekly Debrief, Personalized Debrief, Mission Brief, Quarterly Review, Mind Sprint all do roughly the same thing. Consolidate to one.

### Replace / Rebuild
- **Empire → My Mission** — user sets their own #1 life goal (business, family, health — their choice). Simple text field + milestone tracker. Universal, not personal.
- **Baby Sleep Tracker → Life Context** — reframe entirely. Not "track baby sleep" but "how are you showing up today?" Inputs: sleep quality, energy level, time available. The app uses this to adapt the day's protocol. A dad with a newborn and a dad with a 10-year-old both use it.
- **5 AI summaries → 1 Weekly Check-In** — one AI that covers training, habits, and family in a single pull. Grades, wins, gaps, one adjustment to focus on. Cached per week, manual refresh available.

### Rename / Clarify in UI
- **The Squeeze** — add "18-min workout" subtitle on first in-app appearance
- **Morning Protocol** — keep name, simplify execution

---

## Dashboard — The Fix

**Current problem:** 9+ widgets. Users don't know what to do.

**New dashboard — 3 cards only:**
1. **Today's Mission** — active workout CTA (training day) or rest day content (recovery/family challenge)
2. **Daily Objectives** — today's 3 checkboxes + completion state
3. **Dad Score** — current score with one-line context ("Up 12 pts this week")

Everything else lives in its pillar tab. The dashboard has one job: **tell the dad what to do today.**

**Rest day card:** On non-training days, replace the workout CTA with a recovery tip, mobility suggestion, or a family challenge. The app never goes silent.

---

## Day-1 Experience — The Fix

**Current problem:** Onboarding ends, user lands on a cluttered dashboard with no direction.

**New Day-1 flow:**
1. Existing 4-step onboarding wizard (keep it)
2. Land on a **"Your First Week" checklist** — not the full dashboard yet:
   - Complete your first workout
   - Set your #1 goal (My Mission)
   - Log your morning protocol once
   - Join the Brotherhood (Skool link)
3. Once checklist complete (or dismissed after 7 days), unlock full dashboard
4. Persistent "setup % complete" on profile until done

---

## Free vs Premium

### Free Forever
- 1 training program (Dad Strong 3-day or 5-day)
- The Squeeze (3 free sessions/month to preview the feature)
- Daily objectives (3/day)
- Morning Protocol (basic checklist format, no AI generation)
- Workout history (last 30 days)
- Dad Score
- Streak tracking
- Exercise library (browse only)

### Dad Strong+ — $9.99/mo or $79/year
- All 5 training programs + full program builder
- The Squeeze (unlimited, AI-generated sessions)
- AI Weekly Check-In (debrief, grades, personalized feedback)
- AI Morning Protocol (personalized generation based on life context)
- Body composition tracking + nutrition periodization
- Unlimited workout history + full heatmap
- My Mission tracker + milestone check-ins
- Streak shields (1/month — miss a day, keep your streak)
- Brotherhood leaderboard + Dad Score rankings
- Priority AI generation
- Founder badge (launch-period subscribers)

### Launch Offer (time-limited)
- $47 one-time Founder's Pass → lifetime Dad Strong+ access
- Keep the offer, but enforce it in the backend — no more fake Pro badges

### Stripe Integration Required
- Full flow: Checkout → webhook → Supabase `subscription_tier` → gating logic
- Gate premium features at the component and API level
- Contextual upgrade prompts (e.g., free user hits Squeeze session 4 → upgrade modal)

---

## Missing Features to Build

| Feature | Priority | Why |
|---------|----------|-----|
| Day-1 first-week checklist | P0 | Retention starts on day 1 |
| Stripe subscription + real tier gating | P0 | Revenue — everything else depends on this |
| Push notifications (workout reminder, streak alert) | P1 | Biggest single retention lever |
| Rest day content card | P1 | App goes silent = churn |
| Streak shields | P1 | Reduces abandonment after missed days |
| My Mission (user-configurable goal) | P1 | Replaces hardcoded Empire |
| AI Weekly Check-In (consolidated) | P2 | Replace 5 AI features with 1 great one |
| Progress photos | P2 | Body comp tracking, high retention feature |
| Skool community deep link / integration | P2 | Completes the content → community → app flywheel |
| Real Dad Score criteria + leaderboard | P3 | Makes gamification meaningful |
| Brotherhood social feed / accountability pairs | P3 | Community layer |

---

## Build Priority Order

### Phase 1 — Foundation
1. Fix Day-1 experience (first-week checklist)
2. Simplify dashboard to 3 cards + rest day content
3. Build Stripe subscription + enforce premium gating
4. Replace Empire with My Mission (user-configurable)
5. Remove hardcoded badges + all unbuilt placeholder components

### Phase 2 — Retention
6. Push notifications (workout reminders, streak alerts)
7. Streak shields
8. AI Weekly Check-In (consolidate all AI summaries into one)
9. Life Context input (replaces baby sleep tracker framing)

### Phase 3 — Growth
10. Progress photos
11. Skool / Brotherhood integration
12. Real Dad Score criteria + public leaderboard
13. Brotherhood accountability pairs

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Day-7 retention | >40% |
| Day-30 retention | >20% |
| Free → Premium conversion | >8% |
| Weekly actives logging a workout | >60% of WAU |
| Morning protocol completion | >3x/week for actives |
| Dad Score avg weekly delta | Positive trending |

---

## The One-Liner

**Dad Strength is the daily operating system for fathers who train, think, and lead — because strong dads raise strong kids.**
