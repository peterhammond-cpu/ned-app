# Ned App - Architecture & Product Vision

**Last Updated:** November 26, 2025
**Status:** Phase 2 - Building Canvas Integration

---

## Product Vision

**Ned App = Universal Homework Hub for Families with ADD/ADHD Kids**

---

## Current Family Setup

Hammond Family
- Peter & Julia (Parents)  
- Willy (13, 7th grade, Canvas, ADD) ⚡ PRIORITY
- Simone (10, 5th grade, Aspen) - After Willy stable

---

## Development Priorities

### Tier 1: Willy NOW ⚡
- [x] Canvas API working
- [ ] Homework in database
- [ ] App shows real Canvas data
- [ ] Willy uses daily

### Tier 2: Polish (Next Week)
- [ ] Notifications
- [ ] Barcelona updates
- [ ] Dad jokes

### Tier 3: Add Simone (2-3 weeks)
- [ ] Aspen integration

### Tier 4: Scale (Later)
- [ ] Beta families
- [ ] Authentication
- [ ] Monetization

---

## Key Technical Decisions

1. **Multi-tenant from Day 1** - Database supports multiple families now
2. **LMS Adapter Pattern** - Easy to add new school platforms
3. **Canvas Pages API** - Parse "7th Grade HW" page instead of filtering assignments
4. **Security First** - .env files, never commit tokens

---

## Current Stack

- Frontend: HTML/CSS/JS on Netlify (PWA on Willy's iPhone)
- Backend: Supabase (PostgreSQL) + Vercel (scheduled sync)
- LMS: Canvas API (aaca.instructure.com)
- Repo: https://github.com/peterhammond-cpu/ned-app

---

## Canvas Integration

- Domain: aaca.instructure.com
- Student: Charles Hammond (ID: 1504)
- Key Discovery: School maintains "7th Grade HW" page (Course 520)
- Teachers manually curate daily homework by subject
- Uses "NH" for No Homework
- We parse this page instead of filtering all assignments

---

## Next Milestones

1. TODAY: Database + Canvas parser
2. TOMORROW: Frontend pulls from database
3. THIS WEEK: Willy uses daily
4. NEXT WEEK: Notifications + polish
5. 2-3 WEEKS: Add Simone (Aspen)

