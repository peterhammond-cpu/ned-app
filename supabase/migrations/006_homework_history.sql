-- Stop destroying homework history.
--
-- sync-canvas-homework.js deletes every canvas row and reinserts only items
-- assigned in the last 7 days, so the table has never held more than a few
-- days. The Canvas page carries the whole year (88 items across 29 dated
-- sections as of 2026-10-13) — we parse it all and discard most of it.
--
-- History is what a tutor needs: what Willy has been working on, what he did
-- not finish, where the same subject keeps reappearing. It is also what makes
-- "he is behind in ELA" answerable rather than a hunch.
--
-- To switch the sync from delete-then-insert to upsert, (student_id,
-- external_id) has to be unique. Dedupe first, keeping the newest row per
-- key so any completion state already recorded survives.

DELETE FROM homework_items a
USING homework_items b
WHERE a.student_id = b.student_id
  AND a.external_id = b.external_id
  AND a.external_id IS NOT NULL
  AND a.id < b.id;

ALTER TABLE homework_items
    DROP CONSTRAINT IF EXISTS homework_items_student_external_key;

ALTER TABLE homework_items
    ADD CONSTRAINT homework_items_student_external_key
    UNIQUE (student_id, external_id);

CREATE INDEX IF NOT EXISTS idx_homework_student_due
    ON homework_items (student_id, date_due DESC);
