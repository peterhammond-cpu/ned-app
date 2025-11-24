# Ned App

A homework organization app designed to help students with executive function challenges stay organized and on top of their schoolwork.

## Overview

Ned is a Progressive Web App (PWA) that helps students manage:
- Daily homework checklists
- Weekly calendar views
- Test tracking
- Morning preparation lists
- Personalized engagement (dad jokes, soccer trivia)

Created for my 13-year-old son who has ADD challenges. The goal is to provide a single source of truth that aggregates information from multiple platforms (Canvas, school emails, sports schedules) into one easy-to-use interface.

## Current Status

**v1.0 MVP - Working!**
- ✅ Basic daily checklist
- ✅ Weekly view
- ✅ Test tracking
- ✅ Manual homework entry
- ✅ Dad jokes & engagement features
- ✅ Deployed on Netlify
- ✅ Installed as PWA on iPhone

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (single-file MVP)
- **Database:** Supabase (PostgreSQL)
- **Backend:** Vercel Serverless Functions (planned)
- **Deployment:** Netlify
- **APIs:** Canvas LMS (in progress)

## Project Structure
```
ned-app/
├── index.html           # MVP - all code in one file
├── docs/               # Project documentation
├── src/                # Future: organized code structure
│   ├── frontend/
│   ├── backend/
│   └── database/
└── .env.example        # Environment variable template
```

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and add your Supabase credentials
3. Open `index.html` in a browser or deploy to Netlify

## Roadmap

See `docs/feature-parking-lot.md` for detailed feature planning.

**Phase 2 (In Progress):**
- Canvas API integration for automatic homework sync
- Multi-platform LMS support
- Email parsing for teacher updates
- Smart notifications

**Future Phases:**
- AI executive function coaching
- Parent dashboard
- Co-parenting features
- Learning support tools

## Why This Project?

Two goals:
1. **Practical:** Help my son stay organized and succeed in school
2. **Learning:** Understand professional software development practices and build career skills

## License

Private project - Family use only (for now)

---

**Last Updated:** November 24, 2024
