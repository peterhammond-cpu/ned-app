-- HSPT practice: sessions and per-question attempts from the HSPT tab.
--
-- WHY: Willy practises 10-15 minutes a day for the HSPT (5 Dec 2026). The
-- scheduling (what to review, what is due) runs on his phone from
-- localStorage. This is the log Peter and Alex read: sessions completed this
-- week (the allowance target) and accuracy by question type.
--
-- ACCESS: same reasoning as migration 007. The anon key is public, so:
--   - his phone can only WRITE, through record_hspt_session(), and only for a
--     student that exists. It cannot read anything back.
--   - adults READ through get_hspt_progress(), which checks the same
--     access key as the Mastery tab.

CREATE TABLE IF NOT EXISTS hspt_sessions (
    id           UUID PRIMARY KEY,          -- generated on the phone, so retries are idempotent
    student_id   UUID NOT NULL REFERENCES students(id),
    mode         TEXT NOT NULL,             -- 'diagnostic' | 'practice'
    section      TEXT,                      -- diagnostic only
    started_at   TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,               -- NULL = stopped early (does not count toward the week)
    n_items      INT NOT NULL DEFAULT 0,
    n_correct    INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hspt_attempts (
    id          BIGSERIAL PRIMARY KEY,
    session_id  UUID NOT NULL REFERENCES hspt_sessions(id) ON DELETE CASCADE,
    student_id  UUID NOT NULL REFERENCES students(id),
    item_id     TEXT NOT NULL,
    section     TEXT NOT NULL,
    type        TEXT NOT NULL,
    phase       TEXT NOT NULL,              -- 'diagnostic' | 'review' | 'new' | 'sprint'
    correct     BOOLEAN NOT NULL,
    chosen      INT,
    ms          INT,                        -- time to answer
    answered_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hspt_attempts_student_time ON hspt_attempts (student_id, answered_at DESC);
CREATE INDEX IF NOT EXISTS idx_hspt_sessions_student_time ON hspt_sessions (student_id, started_at DESC);

ALTER TABLE hspt_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hspt_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access" ON hspt_sessions;
CREATE POLICY "Allow service role full access" ON hspt_sessions
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow service role full access" ON hspt_attempts;
CREATE POLICY "Allow service role full access" ON hspt_attempts
    FOR ALL USING (auth.role() = 'service_role');

-- Write-only from the phone. Re-sending the same session id is a no-op, so
-- the app can retry uploads that failed offline without double counting.
CREATE OR REPLACE FUNCTION record_hspt_session(p_student_id UUID, p_session JSONB, p_attempts JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inserted INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id) THEN
        RAISE EXCEPTION 'unknown student';
    END IF;
    IF jsonb_array_length(p_attempts) > 200 THEN
        RAISE EXCEPTION 'too many attempts';
    END IF;

    INSERT INTO hspt_sessions (id, student_id, mode, section, started_at, completed_at, n_items, n_correct)
    VALUES (
        (p_session->>'id')::UUID, p_student_id, p_session->>'mode', p_session->>'section',
        (p_session->>'started_at')::TIMESTAMPTZ, (p_session->>'completed_at')::TIMESTAMPTZ,
        COALESCE((p_session->>'n_items')::INT, 0), COALESCE((p_session->>'n_correct')::INT, 0)
    )
    ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS inserted = ROW_COUNT;
    IF inserted = 0 THEN
        RETURN 'duplicate';
    END IF;

    INSERT INTO hspt_attempts (session_id, student_id, item_id, section, type, phase, correct, chosen, ms, answered_at)
    SELECT (p_session->>'id')::UUID, p_student_id,
           a->>'item_id', a->>'section', a->>'type', a->>'phase',
           (a->>'correct')::BOOLEAN, (a->>'chosen')::INT, (a->>'ms')::INT, (a->>'answered_at')::TIMESTAMPTZ
    FROM jsonb_array_elements(p_attempts) a;

    RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION record_hspt_session(UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_hspt_session(UUID, JSONB, JSONB) TO anon, authenticated;

-- Adult read: sessions and attempts since a date, behind the Mastery key.
CREATE OR REPLACE FUNCTION get_hspt_progress(p_student_id UUID, p_key TEXT, p_since TIMESTAMPTZ)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM access_keys
        WHERE student_id = p_student_id AND scope = 'mastery' AND key = p_key
    ) THEN
        RAISE EXCEPTION 'invalid mastery key';
    END IF;

    RETURN json_build_object(
        'sessions', COALESCE((
            SELECT json_agg(s ORDER BY s.started_at)
            FROM hspt_sessions s
            WHERE s.student_id = p_student_id AND s.started_at >= p_since
        ), '[]'::json),
        'attempts', COALESCE((
            SELECT json_agg(json_build_object(
                'item_id', a.item_id, 'section', a.section, 'type', a.type, 'phase', a.phase,
                'correct', a.correct, 'ms', a.ms, 'answered_at', a.answered_at) ORDER BY a.answered_at)
            FROM hspt_attempts a
            WHERE a.student_id = p_student_id AND a.answered_at >= p_since
        ), '[]'::json)
    );
END;
$$;

REVOKE ALL ON FUNCTION get_hspt_progress(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hspt_progress(UUID, TEXT, TIMESTAMPTZ) TO anon, authenticated;
