-- Let the app read homework_items and students.
--
-- WHY: the sync reports "12 inserted, 0 failed" using the service role key,
-- but the anon key — which is the ONLY key the app uses (ned-core.js:35,
-- no sign-in anywhere) — reads zero rows from both tables. calendar_events
-- and school_events read fine, because migration 003 gave them an explicit
-- "Allow read access for all" policy. homework_items and students predate
-- that migration and never got one.
--
-- The effect is silent: app.js:28 returns [] on both an RLS-filtered result
-- and a genuinely empty table, so Willy's app showed an empty homework list
-- with no error. That is a strong candidate for why he stopped opening it.
--
-- Mirrors the pattern already used for calendar_events in migration 003.
-- Read-only for anon; writes stay service-role, which is how the syncs work.

ALTER TABLE homework_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for all" ON homework_items;
CREATE POLICY "Allow read access for all" ON homework_items
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service role full access" ON homework_items;
CREATE POLICY "Allow service role full access" ON homework_items
    FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for all" ON students;
CREATE POLICY "Allow read access for all" ON students
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service role full access" ON students;
CREATE POLICY "Allow service role full access" ON students
    FOR ALL USING (auth.role() = 'service_role');

-- NOTE: "read access for all" means anyone with the anon key, which is
-- embedded in the client. The app has no authentication, so the URL is
-- effectively the access control. That is a deliberate trade-off for a
-- family app and matches what migration 003 already did -- but it is worth
-- revisiting before the app is shared more widely.
