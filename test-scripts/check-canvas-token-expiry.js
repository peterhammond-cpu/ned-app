// Warn before the Canvas token expires, rather than after.
//
// Canvas caps access tokens at 90 days. The sync going dark for 171 days in
// 2026 taught us that silent expiry is the expensive failure: by the time
// anyone notices, a term's worth of homework is missing. This runs with the
// daily sync and escalates as the date approaches.

const fs = require('fs');
const path = require('path');

const EXPIRY_FILE = path.join(__dirname, '..', '.github', 'CANVAS_TOKEN_EXPIRY');
const WARN_DAYS = 14;

function readExpiry() {
  const raw = fs.readFileSync(EXPIRY_FILE, 'utf8');
  const line = raw.split('\n').map(l => l.trim())
                  .find(l => l && !l.startsWith('#'));
  if (!line || !/^\d{4}-\d{2}-\d{2}$/.test(line)) {
    throw new Error(`No YYYY-MM-DD date found in ${EXPIRY_FILE}`);
  }
  return line;
}

try {
  const expiry = readExpiry();

  // Compare whole days in UTC so a run near midnight cannot drift a day.
  const today = new Date();
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [y, m, d] = expiry.split('-').map(Number);
  const expiryUTC = Date.UTC(y, m - 1, d);
  const daysLeft = Math.round((expiryUTC - todayUTC) / 86400000);

  const renew = 'Remint at aaca.instructure.com -> Account -> Settings -> ' +
                '+ New Access Token, update the CANVAS_API_TOKEN secret, then ' +
                'update .github/CANVAS_TOKEN_EXPIRY with the new date.';

  if (daysLeft < 0) {
    console.log(`::error::Canvas token expired ${Math.abs(daysLeft)} day(s) ago (${expiry}). ${renew}`);
    process.exitCode = 1;
  } else if (daysLeft === 0) {
    console.log(`::error::Canvas token expires TODAY (${expiry}). ${renew}`);
    process.exitCode = 1;
  } else if (daysLeft <= WARN_DAYS) {
    console.log(`::warning::Canvas token expires in ${daysLeft} day(s), on ${expiry}. ${renew}`);
  } else {
    console.log(`Canvas token OK — ${daysLeft} days left (expires ${expiry}).`);
  }
} catch (err) {
  // A missing or malformed file is itself worth surfacing: it means the
  // tripwire is not armed.
  console.log(`::warning::Canvas token expiry check could not run: ${err.message}`);
}
