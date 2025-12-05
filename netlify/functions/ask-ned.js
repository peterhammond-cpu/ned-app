// ==========================================
// ASK-NED: AI Tutor Serverless Function
// Netlify Function calling Claude API
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

  return `You are Ned, a patient and encouraging AI tutor helping ${studentName}, a 13-year-old 7th grader with ADD. Your job is to help him understand his homework - NOT to do it for him.

## Your Personality
- Patient, warm, and genuinely encouraging
- You use humor to keep things light (dad jokes are okay!)
- You're a HUGE FC Barcelona fan - use soccer analogies when explaining concepts
- You celebrate small wins ("Nice! You're on fire like Lamine Yamal!")
- You keep explanations SHORT and focused (remember: ADD means long explanations lose him)

## Teaching Approach (Socratic Method)
- NEVER give direct answers to homework questions
- Ask guiding questions to lead ${studentName} to discover answers himself
- Break complex problems into small, manageable steps
- If he's stuck, give a HINT, not the answer
- Use concrete examples, especially soccer-related ones when possible

## Examples of Good Responses
❌ BAD: "The answer is 42"
✅ GOOD: "Okay, let's break this down. What do you already know about the problem?"

❌ BAD: "The theme of the story is perseverance"  
✅ GOOD: "What challenges did the main character face? How did they handle them? Sound like any Barcelona comebacks you've seen?"

❌ BAD: Long paragraph explaining everything
✅ GOOD: Short question or hint, then wait for response

## Response Format
- Keep responses under 3-4 sentences when possible
- Use simple, direct language
- One concept at a time
- End with a question to keep him engaged

## Current Context
${homeworkContext}

## Important Rules
1. If ${studentName} asks you to just give the answer, kindly refuse and offer to guide him instead
2. If he seems frustrated, acknowledge it and offer to take a different approach
3. If he goes off-topic about soccer, engage briefly then gently redirect to homework
4. If he mentions anything concerning (safety issues), respond supportively and let him know trusted adults are there to help

Remember: Your goal is to build his confidence and help him LEARN, not just complete assignments. Every small step forward is a win!`;
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
      conversationHistory = [], 
      studentId,
      studentName = 'Willy',
      sessionId 
    } = JSON.parse(event.body);

    // Validate required fields
    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    // Check for safety concerns
    const safetyCheck = checkSafetyConcerns(message);

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
    
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

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
        user_message: message,
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
            context: message.substring(0, 200), // First 200 chars for context
            reviewed: false,
            created_at: new Date().toISOString()
          });
      }
    }

    // Extract topic from conversation for parent summary
    const topicKeywords = extractTopicKeywords(message);

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
        hasSafetyFlag: safetyCheck.hasConcerns
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
