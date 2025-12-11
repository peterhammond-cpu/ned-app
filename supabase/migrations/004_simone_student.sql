-- Migration: Add Simone as a student
-- Run this in Supabase SQL Editor

-- Insert Simone's student record
INSERT INTO students (id, name, grade, school, created_at)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Simone Hammond',
    6,  -- Adjust grade as needed
    'CPS School',
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    grade = EXCLUDED.grade,
    school = EXCLUDED.school;

-- Note: Simone's student_id for all queries:
-- 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
