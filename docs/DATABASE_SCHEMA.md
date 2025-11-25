# Ned App - Database Schema

**Last Updated:** November 26, 2025

---

## Design Principles

1. Multi-tenant (supports multiple families)
2. LMS Agnostic (works with any school system)
3. Secure (encrypted credentials, RLS)
4. Scalable (thousands of families)

---

## Core Tables

### families
```sql
id, name, subscription_tier, subscription_status, created_at
```

### users  
```sql
id, family_id, email, name, role (parent/student), auth_id, created_at
```

### students
```sql
id, user_id, family_id, name, grade, school_name, school_type,
lms_type, lms_domain, lms_credentials (encrypted), active, settings, created_at
```

### courses
```sql
id, student_id, external_course_id, name, subject, teacher_name,
track_homework, lms_metadata, created_at
```

### homework_items
```sql
id, student_id, course_id, source_lms, external_id,
date_assigned, date_due, subject, title, description, link,
points_possible, status, checked_off, checked_at, synced_at, created_at
```

### sync_log
```sql
id, student_id, lms_type, status, items_found, error_message, synced_at
```

---

## Example: Willy's Data

Student: Willy Hammond
- Grade: 7th
- School: All Angels Catholic Academy
- LMS: canvas (aaca.instructure.com)
- Courses: 10 active courses

Homework Item Example:
- Subject: Math
- Title: HW 11.20.25 Buzz Math 'Number Properties'
- Description: quiz tomorrow on properties and factoring
- Link: https://aaca.instructure.com/courses/526/assignments/17514
- Date Due: 2025-11-20

