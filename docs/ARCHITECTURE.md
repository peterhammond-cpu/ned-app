# Ned App - Architecture & Technical Status

**Last Updated:** December 5, 2024  
**Current Phase:** Phase 2 - AI Tutor (Starting)

---

## What Ned Is

An AI-powered homework companion for kids with ADD/ADHD. Syncs with school LMS, provides Socratic tutoring, builds learning profiles over time, gives parents visibility without surveillance.

---

## Current Stack

| Layer | Technology | Status |
|-------|------------|--------|
| Frontend | HTML/CSS/JS (vanilla) | ✅ Live |
| Hosting | Netlify (free tier) | ✅ Live |
| Database | Supabase PostgreSQL | ✅ Live |
| LMS Sync | Canvas API | ✅ Automated |
| Automation | GitHub Actions | ✅ Running |
| Voice Calls | Twilio | ✅ Working |
| AI Tutor | Claude API | 🔄 Next |

---

## What's Working Today

### Canvas → Supabase → App Pipeline
```
Canvas LMS ──► GitHub Action ──► Supabase ──► Ned App
              (12pm, 3:15pm)     (PostgreSQL)   (PWA)
```

- **Sync runs:** 12pm (lunch), 3:15pm (after school)
- **Smart parsing:** Handles "due Wednesday", "quiz Friday", natural language dates
- **Homework displays:** Real assignments from Canvas, not hardcoded

### Barcelona Theme & Engagement
- Player trading cards (Yamal, Raphinha, Lewandowski)
- Live match data via football-data.org (syncs 7am daily)
- Three voice personalities: Normal, Stewie, French

### Notifications
- Twilio voice calls in Stewie's voice
- Saturday shot reminder functional

### PWA
- Installed on Willy's iPhone home screen
- Works offline (cached)
- Feels like native app

---

## Database Schema (Supabase)

### Core Tables
```sql
families          -- Multi-tenant support
users             -- Parents and students
students          -- School/LMS config per child
courses           -- Classes tracked
homework_items    -- Assignments synced from Canvas
sync_log          -- Automation history
```

### Coming Soon
```sql
tutor_sessions    -- AI conversation logs
learning_profiles -- Accumulated patterns over time
```

### Key IDs
- Willy's student_id: `8021ff47-1a41-4341-a2e0-9c4fa53cc389`
- Supabase URL: `jzmivepzevgqlmxirlmk.supabase.co`

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Multi-tenant DB from day 1 | Hardest to change later; ready for Simone + beta families |
| Vanilla JS (no React) | Simple enough for now; revisit if painful |
| PWA not native app | Works on iOS, no App Store hassle, free |
| Netlify + Supabase | Generous free tiers, scales when needed |
| GitHub Actions for sync | Free, reliable, easy to adjust timing |
| LMS adapter pattern | Easy to add Aspen (Simone) or other platforms later |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      USER DEVICES                           │
├─────────────────────────────────────────────────────────────┤
│  Willy's iPhone        Simone (future)      Parent Dashboard│
│      (PWA)                (PWA)                 (future)    │
└──────────────┬─────────────────────────────────┬────────────┘
               │                                 │
               ▼                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    NETLIFY                                  │
├─────────────────────────────────────────────────────────────┤
│  Static Frontend          Serverless Functions              │
│  - index.html             - ask-ned (AI tutor) [coming]     │
│  - app.js                 - webhook handlers                │
│  - styles.css                                               │
└──────────────────────────────┬──────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   SUPABASE      │  │   CLAUDE API    │  │  EXTERNAL APIs  │
│                 │  │                 │  │                 │
│  - PostgreSQL   │  │  - AI tutoring  │  │  - Canvas LMS   │
│  - Row-level    │  │  - Socratic     │  │  - Football API │
│    security     │  │    method       │  │  - Twilio       │
│  - Auth (later) │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         ▲
         │
┌─────────────────┐
│  GITHUB ACTIONS │
│                 │
│  - Canvas sync  │
│    (12pm/3:15pm)│
│  - Football     │
│    (7am)        │
└─────────────────┘
```

---

## URLs & Resources

| Resource | URL |
|----------|-----|
| Live App | https://polite-dasik-8c85da.netlify.app/ |
| GitHub Repo | https://github.com/peterhammond-cpu/ned-app |
| Supabase Dashboard | https://supabase.com/dashboard/project/jzmivepzevgqlmxirlmk |
| Canvas Domain | aaca.instructure.com |

---

## Cost (Current)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Netlify | Free | $0 |
| Supabase | Free | $0 |
| GitHub Actions | Free | $0 |
| Football API | Free | $0 |
| Twilio | Pay-as-go | ~$1-2 |
| Claude API | Not yet | $0 |
| **Total** | | **~$1-2/month** |

---

## Next Technical Milestone

**AI Tutor (ask-ned function)**
- Netlify serverless function
- Claude API integration (Haiku for cost)
- Conversation logging to Supabase
- Barcelona personality in system prompt
- Socratic method enforcement

See ROADMAP.md for full phase breakdown.
