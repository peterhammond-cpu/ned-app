-- Migration: Add calendar_events and data_quality_log tables
-- Run this in Supabase SQL Editor

-- ==========================================
-- CALENDAR EVENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id),
    external_id TEXT NOT NULL,                    -- {calendarType}-{googleEventId}
    calendar_source TEXT NOT NULL,                -- 'parenting', 'school', 'sports'
    google_event_id TEXT,                         -- Original Google Calendar event ID

    title TEXT NOT NULL,
    description TEXT,
    location TEXT,

    start_date DATE NOT NULL,
    start_time TIMESTAMPTZ,                       -- NULL for all-day events
    end_date DATE NOT NULL,
    end_time TIMESTAMPTZ,
    is_all_day BOOLEAN DEFAULT false,

    event_type TEXT DEFAULT 'general',            -- 'parenting', 'school', 'sports', 'sports_practice', 'sports_game', 'no_school', 'early_dismissal', 'general'
    household TEXT,                               -- 'dad', 'mom', or NULL

    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicates
    UNIQUE(student_id, external_id)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_student_date
ON calendar_events(student_id, start_date);

CREATE INDEX IF NOT EXISTS idx_calendar_events_household
ON calendar_events(student_id, household)
WHERE household IS NOT NULL;

-- RLS Policy (read-only for anon)
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all" ON calendar_events
    FOR SELECT USING (true);

CREATE POLICY "Allow service role full access" ON calendar_events
    FOR ALL USING (auth.role() = 'service_role');


-- ==========================================
-- DATA QUALITY LOG TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS data_quality_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_at TIMESTAMPTZ DEFAULT NOW(),
    issues_found INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    warnings INTEGER DEFAULT 0,
    details JSONB,                               -- Array of issue objects
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keep only last 30 days of logs
CREATE INDEX IF NOT EXISTS idx_data_quality_log_run_at
ON data_quality_log(run_at);

-- RLS Policy
ALTER TABLE data_quality_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all" ON data_quality_log
    FOR SELECT USING (true);

CREATE POLICY "Allow service role full access" ON data_quality_log
    FOR ALL USING (auth.role() = 'service_role');


-- ==========================================
-- HELPFUL VIEWS
-- ==========================================

-- View: Current week's schedule with household
CREATE OR REPLACE VIEW current_week_schedule AS
SELECT
    ce.start_date,
    ce.title,
    ce.event_type,
    ce.household,
    ce.start_time,
    ce.end_time,
    ce.is_all_day,
    ce.location,
    ce.calendar_source
FROM calendar_events ce
WHERE ce.start_date >= CURRENT_DATE
  AND ce.start_date < CURRENT_DATE + INTERVAL '7 days'
ORDER BY ce.start_date, ce.start_time NULLS FIRST;

-- View: Today's household (who has the kids today)
CREATE OR REPLACE VIEW todays_household AS
SELECT
    household,
    title
FROM calendar_events
WHERE start_date <= CURRENT_DATE
  AND end_date >= CURRENT_DATE
  AND event_type = 'parenting'
  AND household IS NOT NULL
LIMIT 1;
