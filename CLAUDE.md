# CLAUDE.md - Ned App

## What This Is
Ned is an AI-powered homework companion for kids with ADD/ADHD. Built specifically for Willy (7th grade, ADD), it syncs homework from Canvas LMS, provides Socratic tutoring via Claude API, and uses Barcelona soccer theming for engagement. Designed for divorced/co-parenting families who need shared visibility into homework progress.

## Working With Me
I'm a solo developer vibe-coding with Claude Code. Prefer simple, working code over elegant abstractions. When in doubt, choose the approach that's easier to debug at 10pm. No over-engineering—this is a family project, not enterprise software.

## Current Stack
- **Frontend:** Vanilla HTML/CSS/JS (PWA, no framework - intentional)
- **Hosting:** Netlify (free tier, auto-deploy from main)
- **Database:** Supabase PostgreSQL (multi-tenant, RLS enabled)
- **LMS Sync:** Canvas API via GitHub Actions (12pm & 3:15pm daily)
- **AI Tutor:** Claude API (Phase 2 - in progress)
- **Football Data:** football-data.org (7am daily sync)

## Project Structure
```
/
├── index.html          # Main app (single page)
├── styles.css          # Barcelona dark theme
├── app.js              # Core logic, Supabase queries
├── manifest.json       # PWA config
├── netlify/functions/  # Serverless functions (ask-ned coming)
├── .github/workflows/  # Canvas sync automation
└── docs/
    ├── DECISIONS.md    # Architecture rationale
    ├── ROADMAP.md      # What's next
    └── ARCHITECTURE.md # Technical details
```

## Commands
```bash
# Local dev (just open index.html or use live server)
npx serve .

# Deploy (auto on push to main)
git push origin main

# Netlify CLI (if needed)
netlify dev           # Local with functions
netlify deploy --prod # Manual deploy
```

## Conventions
- No React - Vanilla JS is intentional, keeps it simple
- Single HTML file - PWA, all tabs in one page
- CSS variables - Use `--barca-blue`, `--barca-red`, etc.
- Supabase queries - Always filter by `student_id`
- Error handling - Log to console, show user-friendly empty states
- Voice personalities - Normal, Stewie, French (stored in localStorage)

## Architecture Decisions
See `docs/DECISIONS.md` for full rationale. Key choices:
- Multi-tenant DB from day 1 (ready for Simone, beta families)
- PWA over native app (works on iOS, no App Store)
- GitHub Actions over webhooks (simpler, free, good enough)
- Adapter pattern for LMS (Canvas now, Aspen later)
- Socratic method enforced in AI tutor (guide, don't give answers)

## Current State

**Working:**
- Canvas → Supabase sync (automated)
- Homework display with smart due dates
- Barcelona player cards (live stats)
- Voice personalities
- PWA on Willy's iPhone
- Saturday shot reminder (push notification + UI)

**In Progress (Phase 2):**
- `ask-ned` Netlify function (Claude API)
- Chat interface for tutoring
- Conversation logging to Supabase

## Key URLs
```
Live App:     https://polite-dasik-8c85da.netlify.app/
GitHub:       https://github.com/peterhammond-cpu/ned-app
Supabase:     jzmivepzevgqlmxirlmk.supabase.co
Canvas:       aaca.instructure.com
```
Note: Student IDs are in Supabase `students` table. Check dashboard when needed.

## Active Warnings
⚠️ Supabase anon key is in `app.js` - fine for read-only, but functions needing write should use service role key in env vars

⚠️ Canvas API token expires - stored in GitHub Secrets, check if sync fails

⚠️ football-data.org free tier = 10 requests/min - sync is fine, don't spam

⚠️ Netlify free tier = 300 build minutes/month - batch changes, don't push constantly

## Before Committing
Run `/review` to check for:
- Supabase queries missing `student_id` filter
- Exposed keys or credentials
- Error handling gaps
- Any TODO comments that need addressing

## When Modifying Sensitive Areas

**Canvas Sync (`sync-canvas.yml`):**
- Test locally first with `CANVAS_API_TOKEN` env var
- Sync uses UPSERT - safe to re-run
- Check `sync_log` table for history

**Database Schema:**
- All changes via Supabase migrations
- Never drop tables without backup
- RLS policies exist - test with anon key

**AI Tutor (when built):**
- Log ALL conversations to `tutor_sessions`
- Never bypass Socratic method guardrails
- Include safety monitoring for concerning content
