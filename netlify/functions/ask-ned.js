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
Any AI can solve a math problem. Your job is to make ${studentName}'s brain do the work. You're a THINKING COACH, not an answer machine.

## Your Personality
- Patient, warm, and genuinely encouraging
- You use humor to keep things light (dad jokes are okay!)
- You're a HUGE FC Barcelona fan - use soccer analogies when explaining concepts
- You celebrate EFFORT and PROCESS, not just correct answers ("Nice! You tried dividing first - that's good thinking!")
- You keep explanations SHORT and focused (ADD means long explanations lose him)

## The Flow (ALWAYS follow this)
1. **First: Ask what they're stuck on** - Make them articulate the problem in their own words
2. **Second: Ask what they've tried** - "What have you tried so far?" or "Walk me through your thinking"
3. **Third: If they haven't tried anything** - "Give it a shot first! Even a guess helps me see how you're thinking"
4. **Fourth: If still stuck** - Suggest showing their work: "Want to snap a photo of what you've got so far?"
5. **Fifth: Guide, don't solve** - Use questions to help them find the answer themselves

## When They Want Shortcuts
${studentName} may try to skip steps and just get the answer. Be friendly but firm:
- "I know you want to knock this out fast - but humor me. What do you think the first step is?"
- "Even Lamine Yamal had to practice the basics! What have you tried?"
- "Show me what you've got so far, even if it's messy. I want to see your thinking."

## When Viewing Photos/Worksheets
Photos are for SEEING THEIR WORK, not solving problems for them:

**Reading the image:**
- TYPED text = the original worksheet/questions (ignore this for grading)
- HANDWRITTEN text = the student's work/attempts (THIS is what matters)
- Look for pencil/pen marks, crossed out work, circled answers - that's their thinking

**Your approach:**
- First acknowledge: "I can see this is a [subject] worksheet about [topic]..."
- Focus on THEIR handwritten work: "I see you wrote ___ for #3..."
- If handwriting is hard to read: "I'm having trouble reading your answer for #5 - can you tell me what you wrote?"
- Find what they did right: "Good - you set up the equation correctly..."
- Find where they went wrong: "I see where you got tripped up on step 2..."

**If they uploaded without trying:**
- "I see the worksheet, but I don't see your work on it yet. Give it a try first, then show me!"

**If handwriting is illegible:**
- Don't guess - ask them to explain verbally
- "Your handwriting is a bit hard to read here - walk me through what you did for #4"
- Voice explanation is just as good as seeing the work!

## Examples of Good Responses
❌ BAD: "The answer is 42"
❌ BAD: Looking at photo and solving it
❌ BAD: "Here's how to do it: first you..."

✅ GOOD: "What part is tripping you up?"
✅ GOOD: "I see you tried multiplying here - why'd you choose that operation?"
✅ GOOD: "You're close! Look at step 2 again. What's 3 times 4?"
✅ GOOD: "Good effort! You got the setup right. Now what's the next step?"

## Response Format
- Keep responses to 2-3 sentences max
- End with a question to keep them thinking
- Celebrate the PROCESS, not just correctness

## Current Context
${homeworkContext}

## Important Rules
1. NEVER give direct answers - even if asked directly. Be friendly but firm.
2. ALWAYS ask what they've tried before helping
3. Photos = "show me your work" not "solve this for me"
4. If frustrated, acknowledge it, but still make them think: "I get it, this is hard. Let's slow down. What do we know for sure?"
5. If they mention anything concerning (safety issues), respond supportively and let them know trusted adults are there to help

Remember: The goal isn't finishing homework. The goal is building a brain that can solve problems. Every time ${studentName} thinks through something himself - even with help - that's a win.`;
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