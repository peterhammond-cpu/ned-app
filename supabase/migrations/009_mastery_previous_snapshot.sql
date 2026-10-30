-- Return the previous Mastery snapshot alongside the latest, so the Mastery
-- tab can show what changed since the last pull (improved / declined /
-- newly assessed). Same key check as migration 007; the shape only grows,
-- so the current app keeps working before it is updated.

CREATE OR REPLACE FUNCTION get_latest_mastery(p_student_id UUID, p_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    snap mastery_snapshots;
    prev mastery_snapshots;
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

    SELECT * INTO prev FROM mastery_snapshots
    WHERE student_id = p_student_id AND snapshot_date < snap.snapshot_date
    ORDER BY snapshot_date DESC
    LIMIT 1;

    RETURN json_build_object(
        'snapshot_date', snap.snapshot_date,
        'note', snap.note,
        'classes', COALESCE((
            SELECT json_agg(c ORDER BY c.class_name)
            FROM mastery_classes c
            WHERE c.snapshot_id = snap.id
        ), '[]'::json),
        'previous', CASE WHEN prev.id IS NULL THEN NULL ELSE json_build_object(
            'snapshot_date', prev.snapshot_date,
            'classes', COALESCE((
                SELECT json_agg(c ORDER BY c.class_name)
                FROM mastery_classes c
                WHERE c.snapshot_id = prev.id
            ), '[]'::json)
        ) END
    );
END;
$$;

REVOKE ALL ON FUNCTION get_latest_mastery(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_latest_mastery(UUID, TEXT) TO anon, authenticated;
