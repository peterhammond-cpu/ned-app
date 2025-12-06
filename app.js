// ==========================================
// SUPABASE CONNECTION
// ==========================================
const SUPABASE_URL = 'https://jzmivepzevgqlmxirlmk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6bWl2ZXB6ZXZncWxteGlybG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODQ2MTAsImV4cCI6MjA3OTY2MDYxMH0.RTfSV7jMgyc1bpcDCZFtVoX9MjBYo0KElC0S16O6_og';
const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// DATA FETCHING: Homework
// ==========================================
async function fetchHomeworkFromDB() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    
    console.log('📝 Fetching homework from Supabase...');
    console.log('📅 Looking for items due on or after:', todayISO);
    
    const { data, error } = await supabase
        .from('homework_items')
        .select('*')
        .eq('student_id', WILLY_STUDENT_ID)
        .gte('date_due', todayISO)
        .order('date_due', { ascending: true });
    
    if (error) {
        console.error('❌ Error fetching homework:', error);
        return [];
    }
    
    console.log('✅ Fetched homework items:', data?.length || 0);
    return data || [];
}

// ==========================================
// DATA FETCHING: School Events
// ==========================================
async function fetchSchoolEventsFromDB() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString().split('T')[0]; // Just the date part
    
    // Get events for the next 14 days
    const twoWeeksOut = new Date(today);
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
    const twoWeeksISO = twoWeeksOut.toISOString().split('T')[0];
    
    console.log('📅 Fetching school events from Supabase...');
    console.log('📅 Date range:', todayISO, 'to', twoWeeksISO);
    
    const { data, error } = await supabase
        .from('school_events')
        .select('*')
        .eq('student_id', WILLY_STUDENT_ID)
        .eq('dismissed', false)
        .or('grade.is.null,grade.eq.7')  // Show events with no grade OR grade = 7
        .gte('event_date', todayISO)
        .lte('event_date', twoWeeksISO)
        .order('event_date', { ascending: true });
    
    if (error) {
        console.error('❌ Error fetching school events:', error);
        return [];
    }
    
    console.log('✅ Fetched school events:', data?.length || 0);
    console.log('📋 Events:', data);
    return data || [];
}

// ==========================================
// DATA CONVERSION: Homework to Missions
// ==========================================
function convertToMissions(homeworkItems) {
    if (!homeworkItems || homeworkItems.length === 0) {
        return [];
    }
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return homeworkItems.map((item) => {
        const dueDate = new Date(item.date_due + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        // Smarter test detection - only flag if it's THE test, not homework mentioning a test
        const titleLower = (item.title || '').toLowerCase();
        const isTest = (
            // Title starts with test/quiz/exam
            /^(quiz|test|exam|assessment)\b/i.test(item.title || '') ||
            // Or contains "Quiz:" or "Test:" pattern
            /\b(quiz|test|exam):/i.test(item.title || '') ||
            // Or is a short title that's just the test name
            (titleLower.length < 30 && /\b(quiz|test|exam)\b/.test(titleLower) && !titleLower.includes('study'))
        );
        
        let badge = 'upcoming';
        let badgeType = 'normal';
        
        if (daysUntilDue <= 0) {
            badge = 'TODAY';
            badgeType = 'urgent';
        } else if (daysUntilDue === 1) {
            const tomorrowDay = new Date(today);
            tomorrowDay.setDate(tomorrowDay.getDate() + 1);
            const dayName = dayNames[tomorrowDay.getDay()];
            badge = `due ${dayName}`;
            badgeType = 'urgent';
        } else if (daysUntilDue <= 5) {
            const dayName = dayNames[dueDate.getDay()];
            badge = `due ${dayName}`;
            badgeType = daysUntilDue <= 2 ? 'warning' : 'normal';
        } else {
            const month = dueDate.getMonth() + 1;
            const day = dueDate.getDate();
            badge = `${month}/${day}`;
            badgeType = 'normal';
        }
        
        // If it's a test, add the 📝 prefix to badge
        if (isTest) {
            badge = `📝 ${badge}`;
        }
        
        return {
            id: `hw-${item.id}`,
            subject: item.subject || 'Assignment',
            text: item.title || item.description || 'No title',
            badge: badge,
            badgeType: badgeType,
            link: item.link || null,
            completed: item.checked_off || false,
            dueDate: item.date_due,
            isTest: isTest
        };
    });
}

// ==========================================
// HELPER: Get emoji for event type
// ==========================================
function getEventEmoji(eventType, title) {
    const titleLower = (title || '').toLowerCase();
    
    // Check title for common keywords
    if (titleLower.includes('field trip')) return '🚌';
    if (titleLower.includes('picture') || titleLower.includes('photo')) return '📸';
    if (titleLower.includes('book fair')) return '📚';
    if (titleLower.includes('spirit') || titleLower.includes('dress')) return '👕';
    if (titleLower.includes('concert') || titleLower.includes('music')) return '🎵';
    if (titleLower.includes('game') || titleLower.includes('sports')) return '🏆';
    if (titleLower.includes('meeting') || titleLower.includes('conference')) return '👨‍👩‍👧‍👦';
    if (titleLower.includes('test') || titleLower.includes('exam')) return '📝';
    if (titleLower.includes('project')) return '🎨';
    if (titleLower.includes('break') || titleLower.includes('no school')) return '🎉';
    if (titleLower.includes('early') && titleLower.includes('dismiss')) return '⏰';
    
    // Fall back to event type
    switch (eventType) {
        case 'closure': return '🏠';
        case 'early_dismissal': return '⏰';
        case 'event': return '📅';
        case 'action_required': return '⚠️';
        case 'deadline': return '📋';
        default: return '📌';
    }
}

// ==========================================
// HELPER: Check if date is today
// ==========================================
function isToday(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(dateStr + 'T00:00:00');
    return checkDate.getTime() === today.getTime();
}

// ==========================================
// HELPER: Check if date is tomorrow
// ==========================================
function isTomorrow(dateStr) {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const checkDate = new Date(dateStr + 'T00:00:00');
    return checkDate.getTime() === tomorrow.getTime();
}

// ==========================================
// HELPER: Format relative date
// ==========================================
function formatRelativeDate(dateStr) {
    if (isToday(dateStr)) return 'Today';
    if (isTomorrow(dateStr)) return 'Tomorrow';
    
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysAway = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    
    if (daysAway <= 7) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return dayNames[date.getDay()];
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ==========================================
// NED APP - PHASE 3+
// Barcelona-themed Command Center with School Events
// ==========================================

// ==========================================
// DATA: Player Stats
// ==========================================
const playerData = [
    {
        name: "Lamine Yamal",
        position: "Right Winger",
        number: 19,
        emoji: "⚡",
        stats: { goals: 8, assists: 12, rating: 8.2, matches: 18 },
        form: ["W", "W", "D", "W", "W"]
    },
    {
        name: "Raphinha",
        position: "Left Winger",
        number: 11,
        emoji: "🔥",
        stats: { goals: 14, assists: 8, rating: 7.9, matches: 20 },
        form: ["W", "W", "W", "L", "W"]
    },
    {
        name: "Robert Lewandowski",
        position: "Striker",
        number: 9,
        emoji: "🎯",
        stats: { goals: 19, assists: 4, rating: 8.0, matches: 19 },
        form: ["W", "D", "W", "W", "W"]
    }
];

// ==========================================
// DATA: Next Match (will connect to football API)
// ==========================================
const nextMatch = {
    opponent: "Atlético Madrid",
    opponentCrest: "🔴⚪",
    competition: "La Liga",
    date: "Saturday, Dec 21",
    time: "3:00 PM EST",
    venue: "Spotify Camp Nou"
};

// ==========================================
// DATA: Dad Jokes
// ==========================================
const jokes = [
    "Why don't scientists trust atoms? Because they make up everything!",
    "What do you call a fake noodle? An impasta!",
    "Why did the scarecrow win an award? He was outstanding in his field!",
    "What do you call a bear with no teeth? A gummy bear!",
    "Why don't eggs tell jokes? They'd crack each other up!",
    "What do you call a fish with no eyes? Fsh!",
    "Why did the math book look sad? Because it had too many problems!",
    "What's orange and sounds like a parrot? A carrot!",
    "Why did the student eat his homework? Because the teacher said it was a piece of cake!",
    "What's the best thing about Switzerland? I don't know, but the flag is a big plus!",
    "Why don't skeletons fight each other? They don't have the guts!",
    "What did the ocean say to the beach? Nothing, it just waved.",
    "Why did the bicycle fall over? Because it was two-tired!",
    "What do you call cheese that isn't yours? Nacho cheese!"
];

// ==========================================
// DATA: Soccer Trivia
// ==========================================
const soccerTrivia = [
    "Who do you think will win the Ballon d'Or this year?",
    "What's your prediction: Will Barça win La Liga this season?",
    "Who's your favorite Barça player right now and why?",
    "Messi or Ronaldo - who's the GOAT?",
    "Which Champions League team should Barça worry about most?",
    "If you could add any player to Barça's squad, who would it be?",
    "What's the best goal you've ever seen?",
    "Who's the most underrated player on Barça right now?",
    "Will Lamine Yamal win the Ballon d'Or before he's 21?",
    "What formation should Barça play in El Clásico?"
];

// ==========================================
// DATA: Voice/Personality Settings
// ==========================================
const voiceMessages = {
    normal: {
        greetings: ["What's good, Willy!", "Hey Willy! Let's do this!", "Ready to crush it, Willy?"],
        motivation: ["Let's crush it today! Your homework missions await.", "You've got this! Time to tackle those missions.", "Another day, another chance to be awesome!"],
        matchMotivation: "Finish your missions early to catch kickoff!"
    },
    stewie: {
        greetings: ["Ah, Willy. I see you've finally arrived.", "Good evening, Willy. Do try to keep up.", "Willy! Excellent. Let's get this over with."],
        motivation: ["Victory demands discipline, you insufferable child. Now get to work!", "The world won't dominate itself. Complete your missions!", "Blast! These missions won't complete themselves, you know."],
        matchMotivation: "Complete your pathetic homework and perhaps I'll allow you to watch football."
    },
    french: {
        greetings: ["Bonjour, Willy! C'est magnifique!", "Ah, Willy! Mon ami!", "Salut, Willy! Ready for excellence?"],
        motivation: ["Ooh la la! Your missions await, mon ami! Allez!", "Magnifique! Today we conquer zee homework together!", "C'est parti! Let us show zese missions who is boss!"],
        matchMotivation: "Finish your work and zen we watch ze beautiful football, non?"
    }
};

let currentVoice = localStorage.getItem('nedVoice') || 'normal';

// ==========================================
// DATA: Default Morning Checklist Items
// ==========================================
const defaultMorningItems = [
    { id: "item-chromebook", subject: "Gear", text: "💻 Chromebook + charger" },
    { id: "item-papers", subject: "Gear", text: "🎒 Check desk - any loose papers?" },
    { id: "item-homework", subject: "Gear", text: "📚 Homework in backpack?" },
    { id: "item-lunch", subject: "Gear", text: "🍎 Lunchbox" },
    { id: "item-water", subject: "Gear", text: "💧 Water bottle" }
];

// ==========================================
// GLOBAL STATE
// ==========================================
let schoolEvents = [];
let homeworkMissions = [];

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    console.log('🚀 Initializing Ned App...');
    
    // Set static content first
    setGreeting();
    setRandomJoke();
    setRandomTrivia();
    renderMatchCard();
    setHomeworkSectionTitle();
    
    // Fetch data from Supabase
    console.log('📡 Fetching data from Supabase...');
    const [homeworkData, eventsData] = await Promise.all([
        fetchHomeworkFromDB(),
        fetchSchoolEventsFromDB()
    ]);
    
    // Store globally for use in multiple renders
    schoolEvents = eventsData;
    homeworkMissions = convertToMissions(homeworkData);
    
    // Render dynamic content
    renderHeadsUp(schoolEvents);
    renderMissions(homeworkMissions);
    renderMorningChecklist(schoolEvents);
    renderWeekView(homeworkMissions, schoolEvents);
    renderPlayerCards();
    
    // Load saved progress and update stats
    loadProgress();
    updateStats();
    checkSaturdayReminder();
    
    console.log('✅ App initialization complete');
}

// ==========================================
// HEADS UP: School Events Display
// ==========================================
function renderHeadsUp(events) {
    const card = document.getElementById('heads-up-card');
    const container = document.getElementById('heads-up-container');
    
    // Filter to events in the next 5 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fiveDaysOut = new Date(today);
    fiveDaysOut.setDate(fiveDaysOut.getDate() + 5);
    
    const upcomingEvents = (events || []).filter(event => {
        const eventDate = new Date(event.event_date + 'T00:00:00');
        return eventDate <= fiveDaysOut;
    });
    
    // No events? Hide the card
    if (upcomingEvents.length === 0) {
        card.style.display = 'none';
        return;
    }
    
    card.style.display = 'block';
    
    // Render school events only (tests are already in homework section)
    container.innerHTML = upcomingEvents.map(event => {
        const emoji = getEventEmoji(event.event_type, event.title);
        const relativeDate = formatRelativeDate(event.event_date);
        
        let actionHtml = '';
        if (event.action_required && event.action_text) {
            actionHtml = `<div class="alert-action">👉 ${event.action_text}</div>`;
        }
        
        return `
            <div class="alert info">
                <div class="alert-title">${emoji} ${relativeDate}: ${event.title}</div>
                ${event.description ? `<div class="alert-text">${event.description}</div>` : ''}
                ${actionHtml}
            </div>
        `;
    }).join('');
}

// ==========================================
// MISSIONS (Homework) Rendering
// ==========================================
function renderMissions(missions) {
    const container = document.getElementById('tonight-homework');
    
    if (!missions || missions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔭</div>
                <div class="empty-text">No homework found!</div>
                <div class="empty-subtext">Either you're all caught up, or we need to sync with Canvas.</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = missions.map(mission => `
        <div class="mission-item ${mission.completed ? 'completed' : ''} ${mission.isTest ? 'is-test' : ''}" data-id="${mission.id}" onclick="toggleMission(this)">
            <div class="mission-checkbox"></div>
            <div class="mission-content">
                <div class="mission-text">${mission.text}</div>
                <div class="mission-subject">${mission.subject}</div>
            </div>
            ${mission.badge ? `<span class="mission-badge ${mission.badgeType}">${mission.badge}</span>` : ''}
        </div>
    `).join('');
}

// ==========================================
// MORNING CHECKLIST: With Event Action Items
// ==========================================
function renderMorningChecklist(events) {
    const container = document.getElementById('morning-checklist');
    
    // Get tomorrow's date for morning checklist
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Also check today's events (in case viewing in morning)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    // Find events with action items for today or tomorrow
    const actionItems = (events || [])
        .filter(event => {
            const hasAction = event.action_required && event.action_text && event.action_text.trim();
            const isRelevant = event.event_date === todayStr || event.event_date === tomorrowStr;
            return hasAction && isRelevant;
        })
        .map(event => ({
            id: `event-action-${event.id}`,
            subject: 'School Event',
            text: `${getEventEmoji(event.event_type, event.title)} ${event.action_text}`,
            badge: isToday(event.event_date) ? 'TODAY' : 'TOMORROW',
            badgeType: 'warning'
        }));
    
    // Combine action items with default morning items
    const allItems = [...actionItems, ...defaultMorningItems];
    
    container.innerHTML = allItems.map(item => `
        <div class="mission-item" data-id="${item.id}" onclick="toggleMission(this)">
            <div class="mission-checkbox"></div>
            <div class="mission-content">
                <div class="mission-text">${item.text}</div>
                <div class="mission-subject">${item.subject}</div>
            </div>
            ${item.badge ? `<span class="mission-badge ${item.badgeType}">${item.badge}</span>` : ''}
        </div>
    `).join('');
}

// ==========================================
// WEEK VIEW: Homework + Events Combined
// ==========================================
function renderWeekView(missions, events) {
    const container = document.getElementById('week-view');
    const titleEl = document.getElementById('week-title');
    
    // Build a week starting from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        days.push({
            date: date,
            dateStr: date.toISOString().split('T')[0],
            dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
            displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            isToday: i === 0,
            items: []
        });
    }
    
    // Set week title
    const endDate = days[6].date;
    titleEl.textContent = `📅 ${days[0].displayDate} - ${days[6].displayDate}`;
    
    // Add homework to appropriate days
    (missions || []).forEach(mission => {
        const day = days.find(d => d.dateStr === mission.dueDate);
        if (day) {
            day.items.push({
                text: mission.text,
                subject: mission.subject,
                type: 'homework',
                isTest: mission.isTest
            });
        }
    });
    
    // Add events to appropriate days
    (events || []).forEach(event => {
        const day = days.find(d => d.dateStr === event.event_date);
        if (day) {
            const emoji = getEventEmoji(event.event_type, event.title);
            day.items.push({
                text: `${emoji} ${event.title}`,
                subject: event.action_text || '',
                type: 'event',
                eventType: event.event_type,
                isTest: false
            });
        }
    });
    
    // Render the week
    container.innerHTML = days.map(day => {
        const itemsHtml = day.items.length > 0 
            ? day.items.map(item => `
                <div class="day-item ${item.isTest ? 'test' : ''} ${item.type === 'event' ? 'event-item' : ''}">
                    ${item.text}
                    ${item.subject ? `<span class="day-item-detail">${item.subject}</span>` : ''}
                </div>
            `).join('')
            : '<div class="day-item empty">Nothing scheduled</div>';
        
        return `
            <div class="day-card ${day.isToday ? 'today' : ''}">
                <div class="day-header">
                    <span class="day-name">${day.dayName}, ${day.displayDate}</span>
                    ${day.isToday ? '<span class="day-badge">TODAY</span>' : ''}
                </div>
                <div class="day-items">
                    ${itemsHtml}
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// HOMEWORK SECTION TITLE
// ==========================================
function setHomeworkSectionTitle() {
    const titleEl = document.getElementById('homework-section-title');
    const subtitleEl = document.getElementById('homework-subtitle');
    if (!titleEl) return;
    
    const day = new Date().getDay();
    const hour = new Date().getHours();
    
    if (day === 6) {
        titleEl.textContent = "📚 Homework for Next Week";
        if (subtitleEl) subtitleEl.textContent = "Get ahead this weekend!";
    } else if (day === 0) {
        titleEl.textContent = "📚 Homework for This Week";
        if (subtitleEl) subtitleEl.textContent = "Plan your week ahead";
    } else if (day === 5 && hour >= 15) {
        titleEl.textContent = "📚 Weekend Homework";
        if (subtitleEl) subtitleEl.textContent = "Finish early, enjoy your weekend!";
    } else {
        titleEl.textContent = "📚 Tonight's Missions";
        if (subtitleEl) subtitleEl.textContent = "Check off as you complete each one";
    }
}

// ==========================================
// GREETING
// ==========================================
function setGreeting() {
    const hour = new Date().getHours();
    const messages = voiceMessages[currentVoice].greetings;
    const randomIndex = Math.floor(Math.random() * messages.length);
    
    let timePrefix = "";
    if (hour < 12) timePrefix = "☀️ ";
    else if (hour < 18) timePrefix = "👋 ";
    else timePrefix = "🌙 ";
    
    document.getElementById('greeting').textContent = timePrefix + messages[randomIndex];
}

// ==========================================
// JOKES & TRIVIA
// ==========================================
function setRandomJoke() {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    document.getElementById('joke').textContent = randomJoke;
}

function setRandomTrivia() {
    const randomTrivia = soccerTrivia[Math.floor(Math.random() * soccerTrivia.length)];
    const triviaText = document.querySelector('.trivia-text');
    if (triviaText) {
        triviaText.textContent = randomTrivia;
    }
}

// ==========================================
// MATCH CARD
// ==========================================
function renderMatchCard() {
    const elements = {
        'opponent-name': nextMatch.opponent,
        'opponent-crest': nextMatch.opponentCrest,
        'match-competition': nextMatch.competition,
        'match-date': nextMatch.date,
        'match-time': nextMatch.time,
        'match-motivation-text': voiceMessages[currentVoice].matchMotivation
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

// ==========================================
// PLAYER CARDS
// ==========================================
function renderPlayerCards() {
    const container = document.getElementById('player-cards');
    if (!container) return;
    
    container.innerHTML = playerData.map(player => `
        <div class="player-card" data-number="${player.number}">
            <div class="player-header">
                <div class="player-avatar">${player.emoji}</div>
                <div class="player-info">
                    <h3>${player.name}</h3>
                    <span class="player-position">#${player.number} • ${player.position}</span>
                </div>
            </div>
            <div class="player-stats">
                <div class="player-stat">
                    <span class="stat-value">${player.stats.goals}</span>
                    <span class="stat-label">Goals</span>
                </div>
                <div class="player-stat">
                    <span class="stat-value">${player.stats.assists}</span>
                    <span class="stat-label">Assists</span>
                </div>
                <div class="player-stat">
                    <span class="stat-value">${player.stats.rating}</span>
                    <span class="stat-label">Rating</span>
                </div>
                <div class="player-stat">
                    <span class="stat-value">${player.stats.matches}</span>
                    <span class="stat-label">Games</span>
                </div>
            </div>
            <div class="player-form">
                <span class="form-label">Last 5:</span>
                <div class="form-icons">
                    ${player.form.map(result => `
                        <span class="form-icon ${result.toLowerCase() === 'w' ? 'win' : result.toLowerCase() === 'd' ? 'draw' : 'loss'}">
                            ${result}
                        </span>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');
    
    // Update season summary
    const totalGoals = playerData.reduce((sum, p) => sum + p.stats.goals, 0);
    const totalAssists = playerData.reduce((sum, p) => sum + p.stats.assists, 0);
    const avgRating = (playerData.reduce((sum, p) => sum + p.stats.rating, 0) / playerData.length).toFixed(1);
    
    const goalsEl = document.getElementById('total-goals');
    const assistsEl = document.getElementById('total-assists');
    const ratingEl = document.getElementById('avg-rating');
    
    if (goalsEl) goalsEl.textContent = totalGoals;
    if (assistsEl) assistsEl.textContent = totalAssists;
    if (ratingEl) ratingEl.textContent = avgRating;
}

// ==========================================
// MISSION TOGGLE & PROGRESS
// ==========================================
function toggleMission(element) {
    element.classList.toggle('completed');
    updateStats();
    saveProgress();
}

function updateStats() {
    const allMissions = document.querySelectorAll('#today-tab .mission-item');
    const completedMissions = document.querySelectorAll('#today-tab .mission-item.completed');
    
    const total = allMissions.length;
    const completed = completedMissions.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    const countEl = document.getElementById('mission-count');
    const fillEl = document.getElementById('progress-fill');
    const textEl = document.getElementById('progress-text');
    const completedCountEl = document.getElementById('completed-count');
    
    if (countEl) countEl.textContent = `${completed}/${total}`;
    if (fillEl) fillEl.style.width = `${percentage}%`;
    if (textEl) textEl.textContent = `${percentage}% Complete`;
    if (completedCountEl) completedCountEl.textContent = completed;
}

// ==========================================
// SATURDAY SHOT REMINDER
// ==========================================
function checkSaturdayReminder() {
    const day = new Date().getDay();
    if (day === 6) {
        showSaturdayReminder();
    }
}

function showSaturdayReminder() {
    const container = document.getElementById('shot-reminder-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="shot-reminder">
            <h3>💉 IMPORTANT REMINDER</h3>
            <div class="shot-details">Growth Hormone Shot (11mg)</div>
            <div class="shot-time">⏰ Time: 8:00 AM</div>
            <div class="mission-item" data-id="shot-reminder" onclick="toggleMission(this)">
                <div class="mission-checkbox"></div>
                <div class="mission-content">
                    <div class="mission-text">✅ I took my shot</div>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// TAB NAVIGATION
// ==========================================
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.closest('.nav-tab').classList.add('active');
}

// ==========================================
// LOCAL STORAGE
// ==========================================
function saveProgress() {
    const missions = document.querySelectorAll('.mission-item');
    const progress = {};
    
    missions.forEach(mission => {
        const id = mission.dataset.id;
        if (id) {
            progress[id] = mission.classList.contains('completed');
        }
    });
    
    // Save with today's date so we can reset daily
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('nedProgress', JSON.stringify({ date: today, items: progress }));
}

function loadProgress() {
    const saved = localStorage.getItem('nedProgress');
    if (!saved) return;
    
    try {
        const data = JSON.parse(saved);
        const today = new Date().toISOString().split('T')[0];
        
        // Only restore if saved today (reset daily)
        if (data.date !== today) {
            console.log('📅 New day - resetting progress');
            localStorage.removeItem('nedProgress');
            return;
        }
        
        const progress = data.items || {};
        Object.keys(progress).forEach(id => {
            const mission = document.querySelector(`.mission-item[data-id="${id}"]`);
            if (mission && progress[id]) {
                mission.classList.add('completed');
            }
        });
    } catch (e) {
        console.error('Error loading progress:', e);
    }
}