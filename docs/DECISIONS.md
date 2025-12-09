# Architecture Decisions Log

**Project:** Ned App
**Last Updated:** December 2025

---

## ADR-001: Multi-Tenant Database from Day 1

**Decision:** Structure database with `families`, `students`, `users` tables even though we only have one user (Willy).

**Context:** Building for one kid now, but want to add Simone (different school, Aspen LMS) and potentially beta families later.

**Rationale:**
- Database schema is the hardest thing to change later
- `student_id` foreign keys everywhere makes data isolation automatic
- Row Level Security (RLS) can enforce access control
- Migration from single-tenant to multi-tenant is painful; this is free now

**Consequences:**
- Slightly more complex queries (always filter by `student_id`)
- Need to pass IDs around in app code
- Worth it for future flexibility

---

## ADR-002: Vanilla JavaScript, No Framework

**Decision:** Build frontend with HTML/CSS/JS, no React/Vue/etc.

**Context:** Modern web apps typically use frameworks. This is a simple PWA with one page and a few tabs.

**Rationale:**
- Complexity doesn't justify framework overhead
- Faster initial load (no bundle)
- Easier to understand and modify
- Peter is learning - vanilla JS teaches fundamentals
- Can always add React later if needed

**Consequences:**
- Manual DOM manipulation
- No component reusability
- State management is ad-hoc (localStorage + DOM)
- Acceptable for current scope

**Revisit when:** App grows beyond 3-4 major features or needs complex state management.

---

## ADR-003: PWA Over Native iOS App

**Decision:** Ship as Progressive Web App installed to home screen, not native iOS app.

**Context:** Primary user (Willy) has an iPhone. Could build native with React Native or Swift.

**Rationale:**
- PWA works on iOS Safari (with limitations)
- No App Store approval, review, or fees
- Same codebase serves web and "app"
- Push notifications work on iOS 16.4+ (Willy has newer phone)
- Can always go native later if PWA insufficient

**Consequences:**
- Some iOS limitations (no background sync, limited notifications pre-16.4)
- "Add to Home Screen" friction for installation
- No App Store discoverability (fine for family use)

**Revisit when:** Push notifications prove unreliable or need native features.

---

## ADR-004: GitHub Actions for Canvas Sync

**Decision:** Sync homework via scheduled GitHub Actions (12pm, 3:15pm) rather than real-time webhooks or user-triggered fetches.

**Context:** Need to get homework from Canvas into our database. Options: webhooks, polling, manual sync.

**Rationale:**
- Canvas webhooks require institutional setup (school IT won't help)
- Real-time not needed - homework doesn't change minute-to-minute
- 12pm catches morning assignments, 3:15pm catches afternoon
- GitHub Actions are free, reliable, easy to adjust
- Keeps secrets (API tokens) server-side

**Consequences:**
- Up to 3-hour delay for new assignments
- If sync fails, data is stale until next run
- Must monitor `sync_log` table for failures

**Revisit when:** Real-time becomes critical or school enables webhooks.

---

## ADR-005: LMS Adapter Pattern

**Decision:** Abstract Canvas-specific code behind an adapter interface, anticipating other LMS platforms.

**Context:** Willy uses Canvas. Simone will use Aspen. Other families might use Google Classroom, Schoology, etc.

**Rationale:**
- Same homework schema regardless of source
- `source` field tracks where data came from
- Adding new LMS = new adapter, not app rewrite
- Normalize dates, subjects, assignment types

**Consequences:**
- Extra abstraction layer
- Must maintain adapter per LMS
- Worth it for multi-child and eventual scale

---

## ADR-006: Socratic Method in AI Tutor

**Decision:** AI tutor must guide to understanding, never give direct answers to homework.

**Context:** Easy to build ChatGPT-clone that does homework. That doesn't help kids learn.

**Rationale:**
- Willy has ADD - temptation to get quick answers is high
- Giving answers reinforces avoidance, not learning
- Socratic method builds actual understanding
- Differentiates Ned from generic AI tutors
- Logs show whether learning happened (for parents, coaches)

**Implementation:**
- System prompt enforces "guide, don't tell"
- Claude asks questions back
- Celebrates when student figures it out
- Flags if student tries to extract answers

**Consequences:**
- May feel slower/harder initially
- Some students will be frustrated
- Parents need to understand the "why"
- Long-term: actual skill building

---

## ADR-007: Conversation Logging to Database

**Decision:** Log ALL tutor conversations to Supabase `tutor_sessions` table.

**Context:** AI conversations are ephemeral by default. We need persistence for learning profiles and parent visibility.

**Rationale:**
- Build learning profile from conversation patterns
- Parents can see insights (not transcripts)
- Detect struggle patterns over time
- Safety monitoring for concerning content
- Required for EF coach integration

**Privacy considerations:**
- Parents see summaries, not raw conversations
- Student owns the conversation (Ned is THEIR tool)
- Clear data retention policy needed
- Opt-out considered but rejected (defeats purpose)

---

## ADR-008: Barcelona Theme for Engagement

**Decision:** Design entire app around FC Barcelona soccer aesthetic (colors, players, match data).

**Context:** Building for a 7th grader with ADD. Engagement is existential - if he doesn't use it, nothing else matters.

**Rationale:**
- Willy is passionate about Barcelona
- Generic homework app = boring = won't use
- Player cards, match countdowns create daily pull
- Gamification hooks (streaks = "clean sheets")
- Can swap theme for other kids (Simone → Taylor Swift?)

**Consequences:**
- Extra API integration (football-data.org)
- Theme maintenance (player stats update)
- Less "professional" looking
- Absolutely worth it for engagement

---

## ADR-009: Netlify + Supabase Stack

**Decision:** Host on Netlify (frontend + functions), use Supabase for database and auth.

**Context:** Need hosting, database, and serverless functions. Many options exist.

**Rationale:**
- Both have generous free tiers
- Netlify auto-deploys from GitHub
- Supabase provides PostgreSQL + RLS + realtime
- Both scale affordably when needed
- Well-documented, good DX

**Cost at scale:**
- Netlify Pro: $19/month (if needed)
- Supabase Pro: $25/month (if needed)
- Still cheaper than any alternative stack

---

## ADR-010: Twilio for Voice Reminders

**Decision:** Use Twilio for critical voice call reminders (Saturday growth hormone shot).

**Context:** Push notifications can be ignored. Medical reminder cannot be missed.

**Rationale:**
- Voice call is intrusive by design
- Stewie voice personality makes it memorable
- Can escalate to parent if not acknowledged
- Pay-per-use (~$0.02/call) is negligible

**Consequences:**
- Requires phone number storage
- Must handle call failures gracefully
- Twilio account management overhead

---

## Decisions Pending

- **Push notification provider** - Web Push vs. service like OneSignal
- **Authentication system** - Supabase Auth vs. Auth0 vs. custom
- **Test prep content** - Licensed vs. generated vs. open source
- **Coach dashboard access model** - Separate login vs. shared link

---

## How to Add a Decision

Copy this template:

```markdown
## ADR-XXX: [Title]

**Decision:** [One sentence]

**Context:** [Why this came up]

**Rationale:**
- [Reason 1]
- [Reason 2]

**Consequences:**
- [Tradeoff 1]
- [Tradeoff 2]

**Revisit when:** [Trigger condition]
```
