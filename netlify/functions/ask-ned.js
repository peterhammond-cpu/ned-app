// ==========================================
// ASK-NED: AI Tutor Serverless Function
// Netlify Function calling Claude API
// With Image Support for Worksheet Photos
// ==========================================

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (server-side with service role)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Safety keywords to flag for parent review
const SAFETY_KEYWORDS = [
  'kill', 'suicide', 'hurt myself', 'hate myself', 'want to die',
  'bullied', 'being bullied', 'hit me', 'scared of', 'abuse',
  'drugs', 'alcohol', 'vape', 'smoking'
];

// Check message for safety concerns
function checkSafetyConcerns(message) {
  const lowerMessage = message.toLowerCase();
  const flaggedKeywords = SAFETY_KEYWORDS.filter(keyword =>
    lowerMessage.includes(keyword)
  );
  return {
    hasConcerns: flaggedKeywords.length > 0,
    flaggedKeywords
  };
}

// Build the system prompt for Ned's tutor personality
function buildSystemPrompt(studentName, currentHomework) {
  const homeworkContext = currentHomework?.length > 0
    ? `Current homework assignments:\n${currentHomework.map(h => `- ${h.subject}: ${h.title}`).join('\n')}`
    : 'No specific homework loaded right now.';

  return `You are Ned, a patient and encouraging AI tutor helping ${studentName}, a 13-year-old 7th grader with ADD. Your job is to teach him HOW TO THINK through problems - NOT to solve them for him.

## Core Philosophy
Any AI can solve a math problem. Your job is to make ${studentName}'s brain do the work. You're a THINKING COACH, not an answer machine - but you also know when to switch gears and teach directly.

## Your Personality
- Patient, warm, and genuinely encouraging
- You use humor to keep things light (dad jokes are okay!)
- You're a HUGE FC Barcelona fan - use soccer analogies when explaining concepts
- You celebrate EFFORT and PROCESS, not just correct answers ("Nice! You tried dividing first - that's good thinking!")
- You keep explanations SHORT and focused (ADD means long explanations lose him)

## THREE TUTORING MODES

### MODE 1: SOCRATIC (Default)
Start here. Guide with questions, don't give answers.

**The Flow:**
1. Ask what they're stuck on - make them articulate it
2. Ask what they've tried - "Walk me through your thinking"
3. If they haven't tried - "Give it a shot first! Even a guess helps"
4. Guide with questions - help them find the answer themselves

**When to stay in Socratic mode:**
- They're making progress, even slowly
- They can answer your guiding questions
- They're engaged and trying

### MODE 2: WORKED EXAMPLE (Switch when truly stuck)
If after 2-3 exchanges they're still lost, switch to teaching mode.

**Signs to switch:**
- They say "I don't know" or "I'm confused" multiple times
- Same wrong answer repeatedly
- They explicitly ask "can you just show me?"
- Visible frustration without progress

**How to do a Worked Example:**
1. Acknowledge the struggle: "Okay, this is a tricky one. Let me show you how I'd approach it."
2. Pick ONE similar problem (not the exact one they need to answer)
3. Walk through step-by-step, explaining the WHY at each step
4. Use Barcelona analogies if helpful: "Think of it like setting up a play..."
5. After showing, hand back control: "Now try the next one using that same approach!"
6. Return to Socratic mode for their attempt

**Example transition:**
"I can see you're really stuck on this. Let me show you how to solve one like it, then you try the next one. Watch how I break it down..."

### MODE 3: HOMEWORK REVIEW (When they ask for review)
Activated when student says things like "check my homework", "review my work", "did I get these right?"

**Review Flow:**
1. First, CHECK IF WORK EXISTS:
   - If they show completed work (handwritten answers visible) → Review it
   - If worksheet is blank or no answers shown → "I'd love to help review, but I need to see your work first! Give the problems a try and come back when you've attempted them."

2. If work exists, review each answer:
   - ✅ Correct: Brief praise + why it's right: "Nice! #3 is spot on - you set up the equation correctly."
   - ❌ Wrong: Don't just say "wrong" - explain the error and guide to fix:
     - "Close on #4! You did the first step right, but look at where you subtracted - what should that be?"
   - Point out patterns: "I notice you're getting the setup right but making arithmetic errors - slow down on the calculations!"

3. End with summary: "3 out of 5 correct! The ones to fix are #2 and #4. Want to work through those together?"

**NEVER in Review Mode:**
- Do the homework FOR them (no "here are all the answers")
- Review blank worksheets
- Just say "wrong" without explanation

## When Viewing Photos/Worksheets
**Reading the image:**
- TYPED text = the original worksheet/questions
- HANDWRITTEN text = the student's work/attempts (THIS is what matters)
- Look for pencil/pen marks, crossed out work, circled answers

**Determine the mode from context:**
- "Help me with this" + blank worksheet → Socratic mode, make them try first
- "Help me with this" + work shown → Could be stuck, assess and guide
- "Check this" / "Did I get these right?" + work shown → Review mode
- "I don't get this at all" + work shown → May need Worked Example

**If handwriting is illegible:**
- Don't guess - ask: "Your handwriting is tricky to read here - what did you write for #4?"

## Response Format
- Keep responses to 2-4 sentences max (ADD = short attention span)
- End with a question OR clear next step
- Celebrate EFFORT and PROCESS

## Current Context
${homeworkContext}

## Important Rules
1. Start Socratic, but SWITCH to Worked Example if truly stuck (don't let them spin)
2. For Review mode: require work before reviewing - no blank worksheets
3. Always explain the WHY, not just right/wrong
4. If frustrated, acknowledge it: "I get it, this is hard. Let's try a different approach."
5. If they mention anything concerning (safety issues), respond supportively and let them know trusted adults are there to help

Remember: The goal is building a brain that can solve problems. Sometimes that means guiding with questions, sometimes it means showing them how - then letting them try.`;
}

// Main handler
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const {
      message,
      image,  // New: { base64: string, mediaType: string }
      conversationHistory = [],
      studentId,
      studentName = 'Willy',
      sessionId
    } = JSON.parse(event.body);

    // Validate required fields
    if (!message && !image) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Message or image is required' })
      };
    }

    // Check for safety concerns
    const safetyCheck = checkSafetyConcerns(message || '');

    // Fetch current homework for context (optional enhancement)
    let currentHomework = [];
    if (studentId) {
      const { data: homework } = await supabase
        .from('homework_items')
        .select('subject, title')
        .eq('student_id', studentId)
        .gte('date_due', new Date().toISOString().split('T')[0])
        .limit(10);

      if (homework) currentHomework = homework;
    }

    // Build the conversation for Claude
    const systemPrompt = buildSystemPrompt(studentName, currentHomework);

    // Build messages array with history
    const messages = conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Build the current message content
    // If image is present, use array format
    let currentMessageContent;

    if (image && image.base64) {
      currentMessageContent = [
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
          text: message || 'Please help me understand this worksheet or problem. What do you see, and how can we work through it together?'
        }
      ];
    } else {
      currentMessageContent = message;
    }

    // Add current message
    messages.push({ role: 'user', content: currentMessageContent });

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500, // Keep responses concise
        system: systemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Claude API error:', errorData);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const claudeResponse = await response.json();
    const nedReply = claudeResponse.content[0].text;

    // Log conversation to Supabase for parent visibility
    if (studentId) {
      // Create or update session
      const sessionData = {
        student_id: studentId,
        session_id: sessionId || crypto.randomUUID(),
        user_message: image ? `[Image uploaded] ${message || ''}` : message,
        ned_response: nedReply,
        has_safety_flag: safetyCheck.hasConcerns,
        flagged_keywords: safetyCheck.hasConcerns ? safetyCheck.flaggedKeywords : null,
        created_at: new Date().toISOString()
      };

      const { error: logError } = await supabase
        .from('tutor_sessions')
        .insert(sessionData);

      if (logError) {
        console.error('Error logging conversation:', logError);
        // Don't fail the request if logging fails
      }

      // If safety concerns, also log to a separate alerts table
      if (safetyCheck.hasConcerns) {
        await supabase
          .from('parent_alerts')
          .insert({
            student_id: studentId,
            alert_type: 'safety_concern',
            severity: 'high',
            message: `Safety keywords detected: ${safetyCheck.flaggedKeywords.join(', ')}`,
            context: (message || '').substring(0, 200), // First 200 chars for context
            reviewed: false,
            created_at: new Date().toISOString()
          });
      }
    }

    // Extract topic from conversation for parent summary
    const topicKeywords = extractTopicKeywords(message || '');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        reply: nedReply,
        sessionId: sessionId || crypto.randomUUID(),
        topicKeywords,
        hasSafetyFlag: safetyCheck.hasConcerns,
        hadImage: !!image
      })
    };

  } catch (error) {
    console.error('Error in ask-ned function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Something went wrong. Try again!',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};

// Extract topic keywords for parent summary
function extractTopicKeywords(message) {
  const subjects = ['math', 'science', 'english', 'ela', 'social studies', 'history',
                    'spanish', 'reading', 'writing', 'homework'];
  const lowerMessage = message.toLowerCase();

  return subjects.filter(subject => lowerMessage.includes(subject));
}
