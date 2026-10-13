# School email + custody sync — one-time setup

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
     (Sheets is **not** needed here — see the custody section below)
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
| `GOOGLE_REFRESH_TOKEN` | from step 2 |

Optional, only if the custody sheet moves or the tab picker guesses wrong:
`CUSTODY_SHEET_ID`, `CUSTODY_TAB`.

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


---

## Custody schedule

**No OAuth setup required.** This uses the service account that already powers
the calendar sync (`GOOGLE_SERVICE_ACCOUNT_KEY`). A service account can read any
Sheet shared with its email address, so the only step is:

1. Run the sync once. It prints `Reading as: <service-account-email>`.
2. In the custody sheet, **Share** -> paste that address -> **Viewer** -> Send.
3. Re-run.

If the account cannot open the sheet, the run says so explicitly rather than
failing opaquely. Note `life-companion` already reads this same sheet with the
service account `lifecompanion@ned-app-480920.iam.gserviceaccount.com`; if Ned's
is the same one, it may already have access.

Lives in the shared **Kids Schedule/Finance Tracker** sheet, owned by the other
household. The schedule is **not text** — the grid holds day numbers, and who
has the kids is the cell's *background colour*. A legend row pairs a colour
swatch with "Pete" and "Julia", so `sync-custody-schedule.js` reads the legend
at run time and matches each day cell against it. Recolouring the sheet does
not break it; restructuring it will.

**Privacy:** the same workbook has an `Expense Tracker` tab with financial
detail between the two households. The sync reads only the custody tab and
refuses any tab matching `expense|finance|owed`. Nothing financial enters Ned,
and none of it is ever shared with the tutor.

**Fragility:** we do not own this sheet. There are ~17 revision tabs
(`Rev 3/17`, `Rev_5/6`, `2026 - Rev9.01`...). The picker prefers a tab naming
the current year, else the first non-financial tab. If the legend cannot be
found, or no day cell matches it, the sync fails loudly rather than guessing
which parent is which — reporting the wrong household is worse than reporting
nothing.
