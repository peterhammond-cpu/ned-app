# Ned App - Feature Parking Lot

## Current MVP Status
✅ Basic daily checklist  
✅ Weekly view  
✅ Test tracking  
✅ Manual homework entry  
✅ Dad jokes & soccer trivia  
✅ Progress tracking  
✅ Personalized for Willy  
✅ Refactored codebase (HTML/CSS/JS separated)

---

## Phase 2 - Core Automations (IN PROGRESS)

### Canvas Integration
- [ ] Auto-pull homework assignments from Canvas API
- [ ] Poll Canvas during school day (10am, 12pm, 2pm)
- [ ] Detect new assignments and send notifications
- [ ] Parse assignment descriptions for due dates
- [ ] Flag missing/late assignments

### Database Setup
- [ ] Supabase PostgreSQL database
- [ ] Store homework assignments
- [ ] Track completion history
- [ ] User profiles for multi-child support

### Backend Infrastructure
- [ ] Vercel serverless functions
- [ ] Secure API key storage
- [ ] Canvas sync scheduler

### Smart Due Date Parsing (Future Enhancement)
- [ ] Parse actual due dates from homework descriptions
- [ ] Detect patterns: "due tomorrow", "due Wed", "due Friday", "due 12/5"
- [ ] Override assigned date with parsed due date when found
- [ ] Handle edge cases: "Quiz Friday" vs "due Friday"
---

## Phase 3 - Soccer Features (High Engagement for Willy)

### Why Move This Up?
- Willy specifically requested this
- Keeps him engaged with the app daily
- Motivational tool for homework completion
- Low technical complexity = quick win

### Week View & Tests Tab (Future Enhancement)
- [ ] Connect Week tab to Supabase homework data
- [ ] Add sports schedule integration (TeamSnap API)
- [ ] Add family Google Calendar sync
- [ ] Tests tab: Auto-detect quizzes/tests from homework descriptions
- [ ] Parse "quiz tomorrow", "test Friday" from assignment text

### FC Barcelona Game Schedule
- [ ] Auto-pull Barca game schedules (La Liga, Champions League, Copa del Rey)
- [ ] Game day reminders ("Barca plays Real Madrid tonight at 3pm!")
- [ ] Add games to weekly calendar view
- [ ] Countdown to next match
- [ ] Post-game summaries

### Player Stats Tracking
- [ ] **Track favorite Barca players** (Willy requested: Messi, Raphinha, Lamine Yamal)
- [ ] Display as "trading card" style with photos
- [ ] Show key stats:
  - [ ] Goals this season
  - [ ] Assists
  - [ ] Minutes played
  - [ ] Recent form (last 5 games)
- [ ] **Let Willy add/remove players himself**
- [ ] Update stats automatically (daily or after each game)
- [ ] News/highlights about his favorite players

### Display Options for Stats
- [ ] **Option 1: Player Cards** - Trading card style on Today tab
- [ ] **Option 2: Stats Ticker** - Scrolling bar at top with live updates
- [ ] **Option 3: "My Players" Tab** - Dedicated tab for player tracking
- [ ] Let Willy choose which display he prefers

### Gamification via Soccer
- [ ] Complete tasks = unlock Barca highlights/stats
- [ ] Streak rewards themed around soccer (7-day streak = "Hat trick!")
- [ ] Points system tied to soccer achievements
- [ ] "You've completed homework 5 days in a row - that's a clean sheet! ⚽"
- [ ] Match predictions (earn points for correct predictions)

---

## Phase 4 - Smart Notifications

### Timing & Delivery
- [ ] 7:30am - Morning checklist (what to pack)
- [ ] 10am, 12pm, 2pm - New homework alerts (during school)
- [ ] 2:45pm - "What to bring home" reminder
- [ ] 7:00pm - Evening homework check-in
- [ ] Progressive notifications (start gentle, escalate if ignored)

### Notification Types
- [ ] Push notifications (web push for iPhone)
- [ ] SMS backup option
- [ ] Parent alerts if Willy doesn't respond
- [ ] **CRITICAL: Medical reminders**
  - [ ] Saturday 8am: Growth hormone shot (11mg) - MUST BE AUDIBLE
  - [ ] Require manual dismissal (can't auto-dismiss)
  - [ ] Escalate to parent if not acknowledged within 15 minutes
  - [ ] Track completion history
  - [ ] Cannot be snoozed/ignored

---

## Phase 5 - Activity-Specific Checklists

### Sports/Activities
- [ ] Soccer practice checklist (cleats, water bottle, shin guards, uniform)
- [ ] Basketball game checklist
- [ ] Customize by activity type
- [ ] Location-based reminders (geo-fence school/home)

### School-Specific
- [ ] Gym day checklist (gym clothes, sneakers)
- [ ] Lab day checklist (goggles, notebook)
- [ ] Project presentation day (poster, flash drive, notes)

---

## Phase 6 - Multi-Source Aggregation

### Email Parsing
- [ ] Monitor school email for teacher updates
- [ ] Extract actionable items from teacher emails
- [ ] Auto-add to task list
- [ ] Prioritize urgent emails (tests, missing work)
- [ ] **AI filtering of weekly school newsletters:**
  - [ ] Parse long weekly emails from school
  - [ ] Filter OUT: PTA meetings, volunteer requests, donation drives
  - [ ] Filter IN: Schedule changes, field trips, picture day, forms needed
  - [ ] Translate school-speak into teen language
  - [ ] Add relevant items to calendar automatically

### Sports & Activities
- [ ] TeamSnap integration (sports schedules)
- [ ] GameChanger integration (game times, locations)
- [ ] Family Google Calendar sync
- [ ] Consolidate everything into one timeline

---

## Phase 7 - AI Executive Function Coaching

### Real-Time Coaching
- [ ] Conversational AI using Claude API
- [ ] "Which homework should you start with?" (prioritization)
- [ ] "Math usually takes 30 min - when will you start?" (time awareness)
- [ ] "You've been avoiding this for 20 min - what's making it hard?" (task initiation)

### Pattern Recognition
- [ ] Track what he forgets most often
- [ ] Identify difficult subjects/days
- [ ] Personalize reminders based on patterns
- [ ] Streak tracking (motivational)

### Metacognitive Prompts
- [ ] "Before you say you're done - did you check Canvas for all classes?"
- [ ] "Last time you crammed, how did that go? Want to try spreading it out?"
- [ ] Self-monitoring check-ins

---

## Phase 8 - Learning Support

### Homework Help
- [ ] Detect struggling topics (takes long, marks incomplete)
- [ ] Offer Khan Academy links
- [ ] YouTube explainer videos
- [ ] "Ask Ned" - AI explains concepts in simple terms
- [ ] Step-by-step problem walkthroughs

### Study Resources
- [ ] Auto-generate study guides from Canvas materials
- [ ] Flashcard creator
- [ ] Quiz yourself feature
- [ ] Spaced repetition for test prep

---

## Phase 9 - Parent Dashboard

### Monitoring & Insights
- [ ] What Willy saw today
- [ ] What he checked off vs. ignored
- [ ] Pattern insights (always forgets stuff on Wednesdays)
- [ ] Which executive function skills improving/struggling
- [ ] Data to share with counselor/teachers

### Parent Controls
- [ ] Add/edit tasks manually
- [ ] Adjust notification timing
- [ ] Set tone/personality (serious vs. funny)
- [ ] Emergency alerts (failing grade, missing assignment)

### Student Input
- [ ] **Allow Willy to add his own tasks**
  - [ ] Quick "Add homework" button
  - [ ] **Voice input (HIGH PRIORITY for ADD)** 
    - [ ] "Hey Ned, I have a book report due Friday"
    - [ ] Tap-and-hold to record
    - [ ] Transcribe automatically
    - [ ] Much lower friction than typing
    - [ ] Captures thoughts before he forgets
  - [ ] Photo of assignment sheet/whiteboard
  - [ ] Simple form: Subject, Assignment, Due Date (backup to voice)
  - [ ] Tasks sync to parent view

---

## Phase 10 - Personality & Engagement

### Tone Options
- [ ] Straight-up helpful mode
- [ ] Sarcastic mode
- [ ] Family Guy humor mode
- [ ] **STEWIE MODE** ← Willy's request!
  - [ ] British accent (in tone)
  - [ ] Condescending but motivating
  - [ ] Calls out procrastination brutally
  - [ ] "Oh brilliant, you've forgotten your lunchbox AGAIN"
  - [ ] "Good God, man! Science quiz tomorrow and you STILL haven't studied?"
- [ ] Let Willy customize personality
- [ ] Different tones for different times (serious for tests, funny for routine)

### Gamification
- [ ] Points for completing tasks
- [ ] Streak tracking (days in a row)
- [ ] Unlock achievements
- [ ] Leaderboard (if multiple kids use it)
- [ ] Rewards system

---

## Phase 11 - Family Connection Features (Co-Parenting Support)

### Stay Connected Across Households
The vision: Ned helps you stay involved in your kids' lives even when they're at their mom's house.

### Real-Time Activity Sharing
- [ ] You can see when Willy checks off homework (even at mom's house)
- [ ] Celebrate his progress remotely ("Great job finishing math homework!")
- [ ] Send encouragement when you see he's working on something
- [ ] Track patterns across both households

### Collaborative Planning
- [ ] **Weekend meal planning** 
  - [ ] Post this week's dinner menu when they're with you
  - [ ] Kids can see it and get excited about what's coming
  - [ ] They can add requests/ideas ("Can we do tacos Friday?")
  - [ ] Vote on meal options
  - [ ] Shopping list generated from menu
  
- [ ] **Weekend activity ideas**
  - [ ] Share fun activity suggestions for your time together
  - [ ] Kids can add things they want to do ("Can we go to the arcade?")
  - [ ] Collaborative bucket list for your weekends
  - [ ] Track which activities you've done together
  
- [ ] **Things to do with Dad**
  - [ ] Running wishlist of activities/projects
  - [ ] Kids add ideas throughout the week
  - [ ] You can see what they're excited about
  - [ ] Plan your time together based on their interests

### Communication Without Disruption
- [ ] Leave encouraging notes they see when they check Ned
- [ ] Non-intrusive way to stay present in their daily routine
- [ ] Doesn't require texting during homework time
- [ ] Respects mom's household while staying connected

### Transition Support
- [ ] "Coming to Dad's this weekend" checklist
  - [ ] What to pack
  - [ ] Homework to bring
  - [ ] Sports gear needed
- [ ] Countdown to next visit ("3 days until you're at Dad's!")

---

## Phase 12 - Multi-Platform LMS Support

### Support for Multiple Platforms
- [ ] Canvas (Willy's school) ✓
- [ ] Google Classroom
- [ ] Schoology
- [ ] PowerSchool
- [ ] Infinite Campus
- [ ] Blackboard
- [ ] Brightspace
- [ ] ClassLink
- [ ] Seesaw (elementary)

### Multi-Child, Multi-School Support
- [ ] Each kid has their own profile
- [ ] Different schools = different LMS integrations
- [ ] Parent dashboard shows all kids
- [ ] Switch between kids' views

### Universal Parser/Adapter Pattern
- [ ] Build adapters for each LMS
- [ ] Normalize data into common format
- [ ] One interface, many sources

### Fallback Options
- [ ] Email parsing (many schools email daily digests)
- [ ] Manual entry
- [ ] Parent portal scraping (last resort)
- [ ] Photo of assignment sheet

---

## Phase 13 - Polish & UX

### Mobile Optimization
- [ ] Native iOS app (better notifications)
- [ ] PWA optimization
- [ ] Offline mode
- [ ] Lock screen widget

### Accessibility
- [ ] Voice interface ("Hey Ned, what's my homework?")
- [ ] Text-to-speech for reading assignments
- [ ] Dark mode
- [ ] Larger text options

---

## Phase 14 - Product Vision

### Beyond Willy
- [ ] Multi-user support (other families)
- [ ] Share with other parents (productize)
- [ ] School district partnerships
- [ ] ADHD/ADD focused features
- [ ] Integration with executive function counselors

### Technical Infrastructure
- [ ] Proper authentication system
- [ ] Data backup/sync across devices
- [ ] Security/privacy compliance (FERPA, COPPA)
- [ ] Analytics (what features actually help)
- [ ] Rate limiting and API management

---

## Random Ideas (Unsorted)

- [ ] "Forgot lunchbox" pattern detection
- [ ] Photo upload (take pic of whiteboard/assignment sheet)
- [ ] Voice memo assignments ("Remind me to ask teacher about #5")
- [ ] Friend coordination ("Does anyone know what the math homework is?")
- [ ] Reward milestones (5 days perfect = pizza night?)
- [ ] Morning routine timer (visual countdown to leave time)
- [ ] "You seem stressed" detection (offer break suggestions)
- [ ] Integration with Pomodoro technique for homework
- [ ] "Phone away" mode during homework time
- [ ] Weekly recap/reflection ("What went well this week?")

---

## Known Issues / Bug Fixes

- [x] Barcelona game info was outdated (removed - will add back dynamically in Phase 3)

---

## Questions to Answer

- Does Willy actually check his phone in the morning?
- What time does he realistically wake up?
- Does he have any extracurriculars this week?
- What's his reaction to dad jokes vs. sarcasm vs. straight talk?
- Would he prefer voice or text interface?
- Does he use Khan Academy regularly?

---

**Last Updated:** November 24, 2024  
**Current Phase:** Phase 2 - Canvas Integration (In Progress)  
**Recent Changes:** 
- Moved Soccer Features from Phase 12 → Phase 3 (high engagement for Willy)
- Removed outdated Barcelona game from MVP (will add back dynamically)
- Completed code refactoring (HTML/CSS/JS separation)
