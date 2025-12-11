# Ned App - Roadmap

**Last Updated:** December 5, 2024

---

## The Principle

Build for Willy first. Validate it works. Then expand.

---

## Phase 1: Foundation ✅ COMPLETE

**Goal:** App displays real homework from Canvas

- [x] Canvas API integration
- [x] Supabase database (multi-tenant ready)
- [x] Homework syncs automatically (GitHub Actions)
- [x] Smart due date parsing ("due Wednesday" → actual date)
- [x] PWA on Willy's iPhone
- [x] Barcelona theme with player cards
- [x] Voice personalities (Normal, Stewie, French)
- [x] Saturday shot reminder (push + UI)
- [x] Live match data from football-data.org

**Status:** Willy has real app with real data ✅

---

## Phase 2: AI Tutor 🔄 CURRENT

**Goal:** "Talk to Ned" - voice/text tutoring with Claude

- [ ] `ask-ned` Netlify function (Claude API)
- [ ] Chat interface in app
- [ ] Voice input (Web Speech API)
- [ ] Socratic method (guide, don't give answers)
- [ ] Barcelona analogies in explanations
- [ ] Conversation logging to Supabase
- [ ] Basic safety guardrails

**Key Files to Create:**
- `netlify/functions/ask-ned.js`
- `talk-to-ned.js` (frontend)
- `talk-to-ned.css` (styling)
- Supabase migration for `tutor_sessions` table

**Success Metric:** Willy uses it for homework help 2+ times/week

---

## Phase 3: Photo & Voice Input

**Goal:** Reduce friction - typing is hard for ADD

- [ ] Photo upload of worksheets
- [ ] Image sent to Claude for context
- [ ] Voice input improvements
- [ ] "Just talk to Ned" as primary interface

**Why This Matters:** Brainly's killer feature is photo scan. Typing is friction. Voice/photo = zero friction.

---

## Phase 4: Learning Profile

**Goal:** Ned remembers what works for Willy

- [ ] Track struggle patterns (which subjects, which concepts)
- [ ] Track what explanations click
- [ ] Track time-of-day patterns
- [ ] Surface insights over time
- [ ] Profile informs tutoring responses

**The Moat:** ChatGPT starts fresh every time. Ned accumulates knowledge.

---

## Phase 5: Parent Dashboard

**Goal:** Visibility without surveillance

- [ ] Weekly summary (patterns, not transcripts)
- [ ] Alerts for concerning patterns
- [ ] Co-parent shared access
- [ ] "Send encouragement" feature
- [ ] Learning profile view

**Key Principle:** Parents see insights, not conversations.

---

## Phase 6: Simone (Multi-Child)

**Goal:** Add daughter, different school/LMS

- [ ] Aspen LMS adapter
- [ ] Different skin/theme for Simone
- [ ] Profile switching
- [ ] Family dashboard view

**Why Wait:** Willy validates core value. Simone proves multi-child works.

---

## Phase 7: Notifications (Polish)

**Goal:** Proactive reminders without nagging

- [x] PWA push notifications (free)
- [ ] Smart timing (not annoying)
- [ ] Escalation to parent if ignored

**Why Backlogged:** Notifications make a good app better. They don't make the app good.

---

## Phase 8: Test Prep Mode

**Goal:** HSAT and other high-stakes prep

- [ ] Personalized practice based on learning profile
- [ ] Timed sessions
- [ ] Weak area focus
- [ ] Progress tracking toward test date

---

## Phase 9: Scale

**Goal:** Beta families, then product

- [ ] Authentication system
- [ ] Onboarding flow
- [ ] Pricing/subscription
- [ ] Coach integration features
- [ ] More LMS adapters

---

## Backlog (Ideas for Later)

### High Value
- TeamSnap integration (sports schedule conflicts)
- IEP/504 report export
- Executive function coach dashboard
- Pomodoro/study timer
- Tutor personality per student (Stewie, Ted Lasso, etc. - stored on student_id)

### Medium Value
- Gamification (completing homework "trains" Barcelona players)
- Morning routine visual checklist
- Activity-specific checklists (soccer practice gear)
- Email parsing for school newsletters

### Exploration
- Native iOS app (only if PWA push notifications insufficient)
- School district partnerships
- Insurance reimbursement for "digital EF support"

---

## Questions We're Still Answering

- Does Willy actually use the tutor? (Phase 2 will tell us)
- Is Socratic method too slow? (May need "quick answer" mode)
- What's Simone's thing? (Taylor Swift? Gymnastics? Horses?)
- Will EF coaches actually use reports? (Talk to some)

---

## Success = Willy Uses It

Every feature should answer: "Does this make Willy more likely to open Ned?"

If no → backlog
If yes → build it

---

## Documents in This Project

| Document | Purpose |
|----------|---------|
| NED_PRODUCT_VISION.md | Why we're building, stakeholder value, north star |
| ARCHITECTURE.md | Technical stack, what's live, how it works |
| ROADMAP.md | What's done, what's next, what's later (this file) |

That's it. Three docs. Keep it simple.
