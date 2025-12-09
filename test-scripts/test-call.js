// test-call.js - Test Stewie homework reminder call
require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const willyPhone = process.env.WILLY_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

async function makeCall() {
    try {
        console.log('📞 Calling...');

        const call = await client.calls.create({
            twiml: '<Response><Say voice="Polly.Brian">Ah, Willy. It is Ned. I see you have homework tonight. Do verify you understand your assignments before leaving school. Victory demands preparation.</Say></Response>',
            to: willyPhone,
            from: twilioPhone
        });

        console.log('✅ Call initiated! SID:', call.sid);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

makeCall();
