-- Mastery Connect snapshots, readable only with a key.
--
-- WHY: Mastery Connect has no API, no export and no notification email. We
-- read it through Claude in Chrome using Peter's own logged-in session, then
-- save one snapshot per pull, so the app can show Alex (the Wednesday tutor)
-- where Willy sits below mastery, and later what changed since last week.
--
-- WHY A KEY: every other table is "read access for all" via the anon key
-- (migration 005). That key sits in ned-core.js in a PUBLIC GitHub repo, so
-- anyone could read those tables. Homework is low-stakes; standards-level
-- grades are not. So these tables get NO anon policy at all. The app reads
-- them only through get_latest_mastery(), which checks a key stored in
-- access_keys. That key is never committed: it is inserted with the service
-- role key and shared as a link (?k=...).

CREATE TABLE IF NOT EXISTS mastery_snapshots (
    id            BIGSERIAL PRIMARY KEY,
    student_id    UUID NOT NULL REFERENCES students(id),
    snapshot_date DATE NOT NULL,
    note          TEXT,           -- the "for Alex" read, written at pull time
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, snapshot_date)
);

-- One row per class per snapshot. Standards live in a jsonb array of
-- {score, code, description}, where score is '4' | '3' | '2' | '1' | 'NS'.
-- mastery_pct is the SITE'S figure: ELA's % leaves out some child standards,
-- so recomputing it from the rows gives a different (wrong) number.
CREATE TABLE IF NOT EXISTS mastery_classes (
    id           BIGSERIAL PRIMARY KEY,
    snapshot_id  BIGINT NOT NULL REFERENCES mastery_snapshots(id) ON DELETE CASCADE,
    class_name   TEXT NOT NULL,
    section      TEXT,
    teacher      TEXT,
    mastery_pct  INT,             -- NULL when nothing is scored yet
    assessed_pct INT,
    standards    JSONB NOT NULL DEFAULT '[]',
    UNIQUE (snapshot_id, class_name)
);

CREATE TABLE IF NOT EXISTS access_keys (
    student_id UUID NOT NULL REFERENCES students(id),
    scope      TEXT NOT NULL,
    key        TEXT NOT NULL,
    PRIMARY KEY (student_id, scope)
);

-- RLS on, no anon policy: anon reads zero rows (and the app is designed
-- around that). Writes are service-role, like every sync.
ALTER TABLE mastery_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery_classes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_keys       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access" ON mastery_snapshots;
CREATE POLICY "Allow service role full access" ON mastery_snapshots
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow service role full access" ON mastery_classes;
CREATE POLICY "Allow service role full access" ON mastery_classes
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow service role full access" ON access_keys;
CREATE POLICY "Allow service role full access" ON access_keys
    FOR ALL USING (auth.role() = 'service_role');

-- Returns the newest snapshot as JSON, or NULL if there is none.
-- A wrong key RAISES rather than returning NULL, so the app can tell
-- "bad link" apart from "no data yet" -- no silent empty states.
CREATE OR REPLACE FUNCTION get_latest_mastery(p_student_id UUID, p_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    snap mastery_snapshots;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM access_keys
        WHERE student_id = p_student_id AND scope = 'mastery' AND key = p_key
    ) THEN
        RAISE EXCEPTION 'invalid mastery key';
    END IF;

    SELECT * INTO snap FROM mastery_snapshots
    WHERE student_id = p_student_id
    ORDER BY snapshot_date DESC
    LIMIT 1;

    IF snap.id IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN json_build_object(
        'snapshot_date', snap.snapshot_date,
        'note', snap.note,
        'classes', COALESCE((
            SELECT json_agg(c ORDER BY c.class_name)
            FROM mastery_classes c
            WHERE c.snapshot_id = snap.id
        ), '[]'::json)
    );
END;
$$;

REVOKE ALL ON FUNCTION get_latest_mastery(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_latest_mastery(UUID, TEXT) TO anon, authenticated;
