// ==========================================
// NED APP - Willy's Command Center
// Uses NedCore for shared utilities
// ==========================================

// ==========================================
// DATA FETCHING: Homework
// ==========================================
async function fetchHomeworkFromDB() {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // After 3:30 PM, start showing tomorrow's homework instead of today's
    const schoolEndHour = 15; // 3 PM
    const schoolEndMinute = 30;
    const isAfterSchool = now.getHours() > schoolEndHour ||
        (now.getHours() === schoolEndHour && now.getMinutes() >= schoolEndMinute);

    // If after school, filter to items due AFTER today (tomorrow+)
    const filterDate = isAfterSchool
        ? new Date(today.getTime() + 24 * 60 * 60 * 1000) // tomorrow
        : today;
    const filterDateISO = filterDate.toISOString();

    console.log('Fetching homework from Supabase...');
    console.log(`After school: ${isAfterSchool}, showing items due on or after: ${NedCore.toDateStr(filterDate)}`);

    const { data, error } = await NedCore.getClient()
        .from('homework_items')
        .select('*')
        .eq('student_id', NedCore.getStudentId())
        .gte('date_due', filterDateISO)
        .order('date_due', { ascending: true });

    if (error) {
        console.error('Error fetching homework:', error);
        return [];
    }

    console.log('Fetched homework items:', data?.length || 0);
    return data || [];
}

// ==========================================
// DATA FETCHING: School Events
// ==========================================
async function fetchSchoolEventsFromDB() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = NedCore.toDateStr(today);

    const twoWeeksOut = new Date(today);
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
    const twoWeeksISO = NedCore.toDateStr(twoWeeksOut);

    console.log('Fetching school events from Supabase...');

    const { data, error } = await NedCore.getClient()
        .from('school_events')
        .select('*')
        .eq('student_id', NedCore.getStudentId())
        .eq('dismissed', false)
        .or(`grade.is.null,grade.eq.${NedCore.getStudentConfig().grade}`)
        .gte('event_date', todayISO)
        .lte('event_date', twoWeeksISO)
        .order('event_date', { ascending: true });

    if (error) {
        console.error('Error fetching school events:', error);
        return [];
    }

    console.log('Fetched school events:', data?.length || 0);
    return data || [];
}

// ==========================================
// DATA FETCHING: Calendar Events
// ==========================================
async function fetchCalendarEventsFromDB() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = NedCore.toDateStr(today);

    const twoWeeksOut = new Date(today);
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
    const twoWeeksISO = NedCore.toDateStr(twoWeeksOut);

    console.log('Fetching calendar events from Supabase...');

    const { data, error } = await NedCore.getClient()
        .from('calendar_events')
        .select('*')
        .eq('student_id', NedCore.getStudentId())
        .gte('start_date', todayISO)
        .lte('start_date', twoWeeksISO)
        .order('start_date', { ascending: true });

    if (error) {
        if (error.code === '42P01') {
            console.log('calendar_events table does not exist yet');
            return [];
        }
        console.error('Error fetching calendar events:', error);
        return [];
    }

    console.log('Fetched calendar events:', data?.length || 0);
    return data || [];
}

// ==========================================
// DATA FETCHING: Match Data
// ==========================================
async function fetchMatchDataFromDB() {
    console.log('Fetching Barcelona match data from Supabase...');

    const { data, error } = await NedCore.getClient()
        .from('match_data')
        .select('*')
        .eq('team_id', 81)  // Barcelona
        .single();

    if (error) {
        console.error('Error fetching match data:', error);
        return null;
    }

    console.log('Fetched match data:', data);
    return data;
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
            /^(quiz|test|exam|assessment)\b/i.test(item.title || '') ||
            /\b(quiz|test|exam):/i.test(item.title || '') ||
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
// HELPER: Get emoji for calendar event type
// ==========================================
function getCalendarEventEmoji(eventType, title) {
    const titleLower = (title || '').toLowerCase();

    if (eventType === 'parenting') {
        if (titleLower.includes('pete') || titleLower.includes('dad')) return '🏠';
        if (titleLower.includes('julia') || titleLower.includes('mom')) return '🏡';
        return '👨‍👩‍👦';
    }

    if (eventType === 'sports' || eventType === 'sports_game') return '⚽';
    if (eventType === 'sports_practice') return '🏃';
    if (eventType === 'no_school') return '🎉';
    if (eventType === 'early_dismissal') return '⏰';
    if (eventType === 'school') return '🏫';

    if (titleLower.includes('game') || titleLower.includes('match')) return '⚽';
    if (titleLower.includes('practice')) return '🏃';
    if (titleLower.includes('doctor') || titleLower.includes('appointment')) return '🏥';
    if (titleLower.includes('birthday')) return '🎂';
    if (titleLower.includes('party')) return '🎉';

    return '📅';
}

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
// GLOBAL STATE
// ==========================================
let matchData = null;
let schoolEvents = [];
let homeworkMissions = [];
let calendarEvents = [];

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
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    NedCore.init('willy');
    initializeApp();
});

async function initializeApp() {
    console.log('Initializing Ned App...');

    // Set static content first
    setGreeting();
    setRandomJoke();
    setRandomTrivia();
    setHomeworkSectionTitle();

    // Fetch data from Supabase
    console.log('Fetching data from Supabase...');
    const [homeworkData, eventsData, matchDataResult, calendarData] = await Promise.all([
        fetchHomeworkFromDB(),
        fetchSchoolEventsFromDB(),
        fetchMatchDataFromDB(),
        fetchCalendarEventsFromDB()
    ]);

    // Store globally for use in multiple renders
    schoolEvents = eventsData;
    homeworkMissions = convertToMissions(homeworkData);
    matchData = matchDataResult;
    calendarEvents = calendarData;

    // Render dynamic content
    renderHeadsUp(schoolEvents);
    renderMissions(homeworkMissions);
    renderMorningChecklist(schoolEvents);
    renderWeekView(homeworkMissions, schoolEvents, calendarEvents);
    renderPlayerCards();
    renderMatchSection();

    // Load saved progress and update stats
    NedCore.loadProgress();
    updateStats();
    checkSaturdayReminder();

    console.log('App initialization complete');
}

// ==========================================
// HEADS UP: School Events Display
// ==========================================
function renderHeadsUp(events) {
    const card = document.getElementById('heads-up-card');
    const container = document.getElementById('heads-up-container');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fiveDaysOut = new Date(today);
    fiveDaysOut.setDate(fiveDaysOut.getDate() + 5);

    const upcomingEvents = (events || []).filter(event => {
        const eventDate = new Date(event.event_date + 'T00:00:00');
        return eventDate <= fiveDaysOut;
    });

    if (upcomingEvents.length === 0) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';

    container.innerHTML = upcomingEvents.map(event => {
        const emoji = getEventEmoji(event.event_type, event.title);
        const relativeDate = NedCore.formatRelativeDate(event.event_date);

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

    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = NedCore.toDateStr(tomorrow);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = NedCore.toDateStr(today);

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
            badge: NedCore.isToday(event.event_date) ? 'TODAY' : 'TOMORROW',
            badgeType: 'warning'
        }));

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
// WEEK VIEW: Homework + Events + Calendar Combined
// ==========================================
function renderWeekView(missions, events, calEvents) {
    const container = document.getElementById('week-view');
    const titleEl = document.getElementById('week-title');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        days.push({
            date: date,
            dateStr: NedCore.toDateStr(date),
            dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
            displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            isToday: i === 0,
            items: [],
            household: null
        });
    }

    titleEl.textContent = `📅 ${days[0].displayDate} - ${days[6].displayDate}`;

    (calEvents || []).forEach(calEvent => {
        if (calEvent.household && calEvent.event_type === 'parenting') {
            const eventStart = new Date(calEvent.start_date + 'T00:00:00');
            const eventEnd = new Date(calEvent.end_date + 'T00:00:00');
            days.forEach(day => {
                if (day.date >= eventStart && day.date < eventEnd) {
                    day.household = calEvent.household;
                }
            });
        }
    });

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

    (calEvents || []).forEach(calEvent => {
        const day = days.find(d => d.dateStr === calEvent.start_date);
        if (day) {
            const emoji = getCalendarEventEmoji(calEvent.event_type, calEvent.title);

            let timeStr = '';
            if (calEvent.start_time && !calEvent.is_all_day) {
                const startTime = new Date(calEvent.start_time);
                timeStr = startTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
            }

            const displayText = timeStr
                ? `${emoji} ${calEvent.title} @ ${timeStr}`
                : `${emoji} ${calEvent.title}`;

            day.items.push({
                text: displayText,
                subject: calEvent.location || '',
                type: 'calendar',
                calendarSource: calEvent.calendar_source,
                eventType: calEvent.event_type,
                household: calEvent.household,
                isTest: false
            });
        }
    });

    container.innerHTML = days.map(day => {
        const householdClass = day.household ? `household-${day.household}` : '';

        const itemsHtml = day.items.length > 0
            ? day.items.map(item => {
                const classes = [
                    'day-item',
                    item.isTest ? 'test' : '',
                    item.type === 'event' ? 'event-item' : '',
                    item.type === 'calendar' ? 'calendar-item' : '',
                    item.household ? `household-${item.household}` : ''
                ].filter(Boolean).join(' ');

                return `
                    <div class="${classes}">
                        ${item.text}
                        ${item.subject ? `<span class="day-item-detail">${item.subject}</span>` : ''}
                    </div>
                `;
            }).join('')
            : '<div class="day-item empty">Nothing scheduled</div>';

        const householdIndicator = day.household
            ? `<span class="household-badge ${day.household}">${day.household === 'dad' ? "Dad's" : "Mom's"}</span>`
            : '';

        return `
            <div class="day-card ${day.isToday ? 'today' : ''} ${householdClass}">
                <div class="day-header">
                    <span class="day-name">${day.dayName}, ${day.displayDate}</span>
                    <div class="day-badges">
                        ${householdIndicator}
                        ${day.isToday ? '<span class="day-badge">TODAY</span>' : ''}
                    </div>
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
// MATCH SECTION (Last Result + Next Match)
// ==========================================
function renderMatchSection() {
    const container = document.getElementById('match-section');
    if (!container) return;

    if (!matchData) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚽</div>
                <div class="empty-text">No match data available</div>
            </div>
        `;
        return;
    }

    const lastMatchDate = matchData.last_match_date
        ? new Date(matchData.last_match_date).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric'
          })
        : '';

    let nextMatchDate = '';
    let nextMatchTime = '';
    if (matchData.next_match_date) {
        const nextDate = new Date(matchData.next_match_date);
        nextMatchDate = nextDate.toLocaleDateString('en-US', {
            weekday: 'long', month: 'short', day: 'numeric'
        });
        nextMatchTime = nextDate.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
        });
    }

    const resultClass = matchData.last_result === 'WIN' ? 'win'
        : matchData.last_result === 'LOSS' ? 'loss' : 'draw';
    const resultEmoji = matchData.last_result === 'WIN' ? '🎉'
        : matchData.last_result === 'LOSS' ? '😤' : '🤝';

    let barcaScore, oppScore;
    if (matchData.last_home_or_away === 'HOME') {
        barcaScore = matchData.last_score_home;
        oppScore = matchData.last_score_away;
    } else {
        barcaScore = matchData.last_score_away;
        oppScore = matchData.last_score_home;
    }

    container.innerHTML = `
        <div class="match-result-card ${resultClass}">
            <div class="match-result-header">
                <span class="result-label">Last Match ${resultEmoji}</span>
                <span class="result-competition">${matchData.last_competition || ''}</span>
            </div>
            <div class="match-result-content">
                <div class="match-result-teams">
                    <span class="team-name barca">Barcelona</span>
                    <span class="match-score">${barcaScore} - ${oppScore}</span>
                    <span class="team-name">${matchData.last_opponent || 'Unknown'}</span>
                </div>
                <div class="match-result-date">${lastMatchDate} • ${matchData.last_home_or_away || ''}</div>
            </div>
        </div>

        <div class="next-match-card">
            <div class="next-match-header">
                <span class="next-label">Next Match</span>
                <span class="next-competition">${matchData.next_competition || ''}</span>
            </div>
            <div class="next-match-content">
                <div class="next-match-teams">
                    <div class="team">
                        <div class="team-crest">🔵🔴</div>
                        <span class="team-name">Barcelona</span>
                    </div>
                    <div class="match-vs">VS</div>
                    <div class="team">
                        <div class="team-crest">⚪</div>
                        <span class="team-name">${matchData.next_opponent || 'TBD'}</span>
                    </div>
                </div>
                <div class="next-match-datetime">
                    <span class="next-date">📅 ${nextMatchDate || 'TBD'}</span>
                    <span class="next-time">⏰ ${nextMatchTime || ''}</span>
                    <span class="next-venue">${matchData.next_home_or_away === 'HOME' ? '🏟️ Home' : '✈️ Away'}</span>
                </div>
            </div>
        </div>

        <div class="match-motivation">
            <span>💡</span>
            <span>${voiceMessages[currentVoice].matchMotivation}</span>
        </div>
    `;
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
// MISSION TOGGLE (delegates to NedCore)
// ==========================================
function toggleMission(element) {
    NedCore.toggleMission(element, updateStats);
}

// ==========================================
// STATS & STADIUM GAMIFICATION
// ==========================================

const BARCA_FACTS = [
    "Lamine Yamal became the youngest La Liga scorer at 16 years old!",
    "Camp Nou holds 99,354 fans - the largest stadium in Europe!",
    "Messi scored 672 goals for Barcelona in 778 games.",
    "Barcelona's motto 'Mes que un club' means 'More than a club'.",
    "Pedri made 73 appearances in his first full season - the most of any Barca player!",
    "Xavi completed over 28,000 passes in his Barcelona career.",
    "Raphinha scored a hat-trick against Real Betis in 2024!",
    "Barcelona won 6 trophies in 2009 - the only club to achieve the sextuple.",
    "La Masia has produced more first-team players than any other academy in Europe.",
    "Robert Lewandowski scored 23 La Liga goals in his debut Barca season."
];

function updateStats() {
    const allMissions = document.querySelectorAll('#today-tab .mission-item');
    const completedMissions = document.querySelectorAll('#today-tab .mission-item.completed');

    const total = allMissions.length;
    const completed = completedMissions.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Update progress bar
    const countEl = document.getElementById('mission-count');
    const fillEl = document.getElementById('progress-fill');
    const textEl = document.getElementById('progress-text');

    if (countEl) countEl.textContent = `${completed}/${total}`;
    if (fillEl) fillEl.style.width = `${percentage}%`;
    if (textEl) textEl.textContent = `${percentage}% Complete`;

    // Update stadium
    updateStadium(percentage);
    updateStreakDisplay();

    // Track today's completion for streak
    const today = NedCore.toDateStr();
    if (total > 0 && completed === total) {
        const streakData = JSON.parse(localStorage.getItem('nedStreak') || '{}');
        streakData[today] = true;
        localStorage.setItem('nedStreak', JSON.stringify(streakData));
        showPlayerUnlock();
    }
}

function updateStadium(percentage) {
    // Fill tiers based on percentage (4 tiers = 25% each)
    const tiers = [
        { el: document.getElementById('crowd-tier-1'), threshold: 25 },
        { el: document.getElementById('crowd-tier-2'), threshold: 50 },
        { el: document.getElementById('crowd-tier-3'), threshold: 75 },
        { el: document.getElementById('crowd-tier-4'), threshold: 100 }
    ];

    tiers.forEach(tier => {
        if (!tier.el) return;
        if (percentage >= tier.threshold) {
            if (!tier.el.classList.contains('filled')) {
                tier.el.classList.add('filled');
            }
        } else {
            tier.el.classList.remove('filled');
        }
    });

    // Update field display
    const percentEl = document.getElementById('stadium-percentage');
    const milestoneEl = document.getElementById('stadium-milestone');
    if (percentEl) percentEl.textContent = `${percentage}%`;

    if (milestoneEl) {
        let milestone = 'Fill the stadium!';
        let isMilestone = false;

        if (percentage === 100) {
            milestone = 'GOOOOOL! 100% complete!';
            isMilestone = true;
        } else if (percentage >= 75) {
            milestone = 'Final push!';
            isMilestone = true;
        } else if (percentage >= 50) {
            milestone = 'Half-time! Keep going!';
            isMilestone = true;
        } else if (percentage >= 25) {
            milestone = 'Crowd is building!';
            isMilestone = true;
        }

        milestoneEl.textContent = milestone;
        milestoneEl.classList.toggle('milestone', isMilestone);
    }
}

function updateStreakDisplay() {
    const resultsEl = document.getElementById('streak-results');
    if (!resultsEl) return;

    const streakData = JSON.parse(localStorage.getItem('nedStreak') || '{}');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Show last 7 days
    const badges = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = NedCore.toDateStr(date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'narrow' });

        if (i === 0) {
            // Today - show as pending unless complete
            badges.push(`<div class="form-badge ${streakData[dateStr] ? 'win' : 'pending'}" title="${dayName}">${streakData[dateStr] ? 'W' : dayName}</div>`);
        } else if (streakData[dateStr]) {
            badges.push(`<div class="form-badge win" title="${dayName}">W</div>`);
        } else {
            badges.push(`<div class="form-badge loss" title="${dayName}">L</div>`);
        }
    }

    resultsEl.innerHTML = badges.join('');
}

function showPlayerUnlock() {
    const unlockEl = document.getElementById('player-unlock');
    const textEl = document.getElementById('unlock-text');
    if (!unlockEl || !textEl) return;

    // Only show once per day
    const today = NedCore.toDateStr();
    if (localStorage.getItem('nedUnlockShown') === today) {
        unlockEl.style.display = 'flex';
        textEl.textContent = localStorage.getItem('nedUnlockFact') || BARCA_FACTS[0];
        return;
    }

    const fact = BARCA_FACTS[Math.floor(Math.random() * BARCA_FACTS.length)];
    textEl.textContent = fact;
    unlockEl.style.display = 'flex';
    localStorage.setItem('nedUnlockShown', today);
    localStorage.setItem('nedUnlockFact', fact);
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
// TAB NAVIGATION (delegates to NedCore)
// ==========================================
function switchTab(tabName) {
    NedCore.switchTab(tabName);
}
