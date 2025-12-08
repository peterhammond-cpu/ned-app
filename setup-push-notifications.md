# Push Notifications Setup

## 1. Generate VAPID Keys

Run this command locally to generate your VAPID keys:

```bash
npx web-push generate-vapid-keys
```

This will output something like:
```
Public Key: BNxxx...
Private Key: abc123...
```

## 2. Add Environment Variables to Netlify

Go to Netlify Dashboard > Site settings > Environment variables and add:

| Variable | Value |
|----------|-------|
| `VAPID_PUBLIC_KEY` | Your public key from step 1 |
| `VAPID_PRIVATE_KEY` | Your private key from step 1 |
| `SUPABASE_SERVICE_KEY` | Your Supabase service role key (not anon key) |

## 3. Create Supabase Table

Run this SQL in Supabase SQL Editor:

```sql
-- Push notification subscriptions table
CREATE TABLE push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by student
CREATE INDEX idx_push_subscriptions_student_id ON push_subscriptions(student_id);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert/update via service key only (server-side)
CREATE POLICY "Service role can manage subscriptions" ON push_subscriptions
    FOR ALL USING (true);
```

## 4. Update Frontend VAPID Key

In `index.html`, replace `YOUR_VAPID_PUBLIC_KEY_HERE` with your actual public key:

```javascript
const VAPID_PUBLIC_KEY = 'BNxxx...your-actual-public-key...';
```

## 5. Deploy and Test

1. Deploy to Netlify: `git push`
2. Open the app on Willy's phone
3. Click "Enable" when prompted for notifications
4. Test by manually calling the notification endpoint:

```bash
curl -X POST https://your-site.netlify.app/api/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "8021ff47-1a41-4341-a2e0-9c4fa53cc389",
    "title": "Test Notification",
    "body": "This is a test!"
  }'
```

## Scheduled Notifications (CST)

| Time | Day | Notification |
|------|-----|--------------|
| 3:10 PM | Mon-Fri | Homework due today |
| 7:00 PM | Mon-Fri | Nag if homework incomplete |
| 7:00 PM | Saturday | Shot reminder |

These are configured in `netlify.toml` and run automatically via Netlify Scheduled Functions.

## Files Created

- `service-worker.js` - Handles push events
- `push-notifications.js` - Frontend subscription logic
- `netlify/functions/save-subscription.js` - Saves subscription to DB
- `netlify/functions/send-notification.js` - Sends push to device
- `netlify/functions/notify-homework-daily.js` - 3:10 PM reminder
- `netlify/functions/notify-homework-nag.js` - 7:00 PM nag
- `netlify/functions/notify-saturday-shot.js` - Saturday shot reminder
