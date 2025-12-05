// ==========================================
// PARSE-NEWSLETTER: Extract school events from emails
// Netlify Function calling Claude API
// ==========================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SYSTEM_PROMPT = `You are a helpful assistant that extracts school events from newsletters and emails. Your job is to find information that is relevant to a STUDENT (not parents).

## Extract these types of events:
- **no_school**: Days off, holidays, teacher conferences, breaks
- **early_dismissal**: Early release days
- **field_trip**: Field trips, excursions (note if money or permission slip needed)
- **form_due**: Permission slips, forms that need signatures
- **picture_day**: Photo days
- **event**: Special events at school (book fair, spirit week, assemblies)
- **reminder**: Other student-relevant reminders

## IGNORE these (parent-only stuff):
- PTA meetings
- Parent volunteer opportunities
- Fundraiser requests
- Donation drives
- Board meetings
- Parent education nights

## Response Format:
Return ONLY valid JSON array. No markdown, no explanation. Each event:
{
  "event_date": "YYYY-MM-DD",
  "event_type": "no_school|early_dismissal|field_trip|form_due|picture_day|event|reminder",
  "title": "Short title",
  "description": "Brief description if needed",
  "action_required": true/false,
  "action_text": "What the student needs to do (if action_required)"
}

## Rules:
- If a date range, create separate events for each day
- If year not specified, assume current school year (use upcoming date)
- If no relevant student events found, return empty array: []
- Today's date for reference: ${new Date().toISOString().split('T')[0]}

Example output:
[
  {"event_date": "2024-12-20", "event_type": "no_school", "title": "Winter Break Begins", "description": "No school through Jan 2", "action_required": false, "action_text": null},
  {"event_date": "2024-12-18", "event_type": "field_trip", "title": "Museum Field Trip", "description": "Science museum visit", "action_required": true, "action_text": "Bring $15 and signed permission slip"}
]`;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { 
      text,           // Pasted newsletter text
      image,          // Or image: { base64, mediaType }
      studentId 
    } = JSON.parse(event.body);

    if (!text && !image) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Provide newsletter text or image' })
      };
    }

    if (!studentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'studentId is required' })
      };
    }

    // Build message content
    let messageContent;
    
    if (image && image.base64) {
      messageContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: image.mediaType || 'image/jpeg',
            data: image.base64
          }
        },
        {
          type: 'text',
          text: 'Extract all student-relevant events from this school newsletter/email. Return as JSON array.'
        }
      ];
    } else {
      messageContent = `Extract all student-relevant events from this school newsletter/email. Return as JSON array.\n\n---\n\n${text}`;
    }

    // Call Claude
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: messageContent }]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Claude API error:', errorData);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const claudeResponse = await response.json();
    const responseText = claudeResponse.content[0].text;

    // Parse JSON from response
    let events = [];
    try {
      // Try to extract JSON from response (in case Claude adds extra text)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        events = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse events JSON:', parseError);
      console.log('Raw response:', responseText);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          message: 'Could not parse events from newsletter',
          rawResponse: responseText
        })
      };
    }

    // Save events to Supabase
    if (events.length > 0) {
      const eventsToInsert = events.map(e => ({
        student_id: studentId,
        event_date: e.event_date,
        event_type: e.event_type,
        title: e.title,
        description: e.description || null,
        action_required: e.action_required || false,
        action_text: e.action_text || null,
        source: 'email'
      }));

      const { error: insertError } = await supabase
        .from('school_events')
        .insert(eventsToInsert);

      if (insertError) {
        console.error('Error saving events:', insertError);
        // Don't fail - still return what we found
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        eventsFound: events.length,
        events: events
      })
    };

  } catch (error) {
    console.error('Error in parse-newsletter:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to parse newsletter',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};