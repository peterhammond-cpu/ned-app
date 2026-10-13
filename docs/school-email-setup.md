# School email sync — one-time setup

Automates what used to be manual: Ned reads school email from Gmail, extracts
dated events with Claude, and saves them. Replaces open-app-find-email-copy-paste,
which is why the feature lapsed in Dec 2025.

**Senders watched** (both `@alphonsusacademy.org`):
- `kkey@` — Katie Key, Willy's homeroom teacher. Dated, 8th-grade specific. High signal.
- `info@` — school-wide "Week N" newsletter. Only forward-dated items are kept.

Access is **read-only Gmail**. The credential cannot send, delete or modify mail.

---

## 1. Google Cloud — create an OAuth client (~15 min, once)

1. https://console.cloud.google.com/ → create a project, e.g. `ned-app`
2. **APIs & Services → Library** → search "Gmail API" → **Enable**
3. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name `Ned App`, your email for both support and developer contact
   - Scopes: add `.../auth/gmail.readonly`
   - Test users: **add your own Gmail address** (required while unpublished)
   - Leave it in **Testing**. Publishing invites Google verification you do not need.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Type: **Desktop app**, name `Ned App CLI`
   - Copy the **Client ID** and **Client secret**

> Testing-mode refresh tokens expire after 7 days *only* for apps using
> sensitive scopes without verification. `gmail.readonly` is sensitive, so if
> the sync starts failing weekly, that is why — publishing the app (still
> unverified, just not in Testing) issues long-lived refresh tokens.

## 2. Mint a refresh token (once, on your laptop)

```bash
cd ~/Desktop/ned-app/test-scripts
npm ci
GOOGLE_CLIENT_ID='...' GOOGLE_CLIENT_SECRET='...' node mint-gmail-token.js
```

Opens a consent screen. Approve (click through the "unverified app" warning —
it is your own app). The refresh token prints to the terminal.

## 3. GitHub Secrets

https://github.com/peterhammond-cpu/ned-app/settings/secrets/actions

| Secret | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from step 1 |
| `GOOGLE_CLIENT_SECRET` | from step 1 |
| `GMAIL_REFRESH_TOKEN` | from step 2 |

`ANTHROPIC_API_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` already exist.

## 4. Run it

The sync step runs with the daily job. To test immediately:
Actions → **Ned App Sync** → **Run workflow**.

Look for the annotation:
`School email sync: N email(s), M event row(s) upserted.`

---

## Notes

- **Idempotent.** `school_events` upserts on `(student_id, event_date, title)`
  with `ignoreDuplicates`, so re-reading the same newsletter changes nothing.
- **Year inference.** These emails write "Thurs, Nov 5" with no year. The prompt
  anchors to the email's *send date*, not today — otherwise every December a
  "Jan 5" event lands twelve months late.
- **Missing credentials are a warning, not a failure.** Until the secrets exist
  the step logs a warning and skips, so it cannot break the Canvas sync.
- **Lookback** defaults to 10 days; override with `SCHOOL_EMAIL_LOOKBACK_DAYS`.
- If AACA ever puts event details *inside* an image, the text parser goes blind
  to them. `netlify/functions/parse-newsletter.js` supports image input as a
  manual fallback.
