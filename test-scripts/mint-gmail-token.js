// ONE-TIME: mint a Gmail refresh token for the automated school-email sync.
//
// Run this on your laptop, once. It opens a Google consent screen, you approve,
// and it prints a refresh token to paste into GitHub Secrets. After that the
// GitHub Action refreshes its own access tokens and this is never needed again
// (unless the refresh token is revoked or unused for ~6 months).
//
//   cd test-scripts
//   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node mint-gmail-token.js
//
// Read-only Gmail scope: this can read mail and nothing else. It cannot send,
// delete, or modify anything.

const http = require('http');
const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = 5858;
const REDIRECT = `http://localhost:${PORT}/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. See docs/school-email-setup.md');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);

const url = oauth2.generateAuthUrl({
  access_type: 'offline',        // required to get a refresh token
  prompt: 'consent',             // force a refresh token even on re-auth
  scope: ['https://www.googleapis.com/auth/gmail.readonly']
});

console.log('\nOpen this URL in your browser and approve:\n');
console.log(url);
console.log(`\nWaiting on ${REDIRECT} ...\n`);

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/callback')) { res.end('waiting'); return; }
  const code = new URL(req.url, `http://localhost:${PORT}`).searchParams.get('code');
  if (!code) { res.end('No code in callback.'); return; }

  try {
    const { tokens } = await oauth2.getToken(code);
    res.end('Done. You can close this tab and return to the terminal.');
    console.log('='.repeat(64));
    if (tokens.refresh_token) {
      console.log('GMAIL_REFRESH_TOKEN:\n');
      console.log(tokens.refresh_token);
      console.log('\nAdd that to GitHub Secrets, along with GOOGLE_CLIENT_ID and');
      console.log('GOOGLE_CLIENT_SECRET. Do not commit it anywhere.');
    } else {
      console.log('No refresh token returned. Revoke prior access at');
      console.log('https://myaccount.google.com/permissions and run this again.');
    }
    console.log('='.repeat(64));
  } catch (e) {
    console.error('Token exchange failed:', e.message);
  }
  server.close();
});

server.listen(PORT);
