# Session Notes - November 26, 2025

---

## What We Accomplished Today

### Successfully Connected to Canvas API
- Created canvas-test.js script
- Retrieved Willy's profile (Charles Hammond, ID: 1504)
- Listed 10 active courses
- Fetched "7th Grade HW" page from Course 520

### Key Discovery
Teachers manually curate a daily homework page organized by:
- Date (e.g., "Friday, Nov 21, 2025")
- Subject (Science, ELA, Math, SS, etc.)
- Assignment text with Canvas links
- "NH" for No Homework

This is MUCH better than filtering all Canvas assignments!

### Decided on Product-Scale Architecture
- Build multi-tenant database from day 1
- Use LMS adapter pattern for flexibility
- Focus on Willy first, but foundation ready to scale
- Simone (5th grade, Aspen) comes after Willy is stable

### Security Implementation
- Canvas tokens in .env files (never committed)
- Added .env to .gitignore
- Created .env.example template

---

## Current Status

**Working:**
- Canvas API connection ✅
- Homework page HTML saved locally ✅
- Documentation created ✅

**Next:**
- Set up Supabase database
- Build parser to extract homework from HTML
- Save parsed homework to database

---

## Important URLs

- GitHub: https://github.com/peterhammond-cpu/ned-app
- Netlify: https://polite-dasik-8c85da.netlify.app/
- Canvas Domain: aaca.instructure.com
- Canvas Course (7th Grade HW): Course ID 520

