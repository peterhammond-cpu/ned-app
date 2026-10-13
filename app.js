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
        motivation: ["Let's crush it today!", "You've got this.", "Another day, another chance to be awesome!"],
        matchMotivation: "Finish your homework early to catch kickoff!"
    },
    stewie: {
        greetings: ["Ah, Willy. I see you've finally arrived.", "Good evening, Willy. Do try to keep up.", "Willy! Excellent. Let's get this over with."],
        motivation: ["Victory demands discipline, you insufferable child. Now get to work!", "The world won't dominate itself. Get your homework done!", "Blast! This homework won't do itself, you know."],
        matchMotivation: "Complete your pathetic homework and perhaps I'll allow you to watch football."
    },
    french: {
        greetings: ["Bonjour, Willy! C'est magnifique!", "Ah, Willy! Mon ami!", "Salut, Willy! Ready for excellence?"],
        motivation: ["Ooh la la! Your homework awaits, mon ami! Allez!", "Magnifique! Today we conquer zee homework together!", "C'est parti! Let us show zis homework who is boss!"],
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
    renderWeekView(homeworkMissions, schoolEvents, calendarEvents);

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
                ${(() => {
                    const parts = splitHomeworkParts(mission.text);
                    return parts.length > 1
                        ? `<ul class="mission-parts">${parts.map(p => `<li>${p}</li>`).join('')}</ul>`
                        : `<div class="mission-text">${parts[0] || mission.text}</div>`;
                })()}
                <div class="mission-subject">${mission.subject}</div>
            </div>
            ${mission.badge ? `<span class="mission-badge ${mission.badgeType}">${mission.badge}</span>` : ''}
        </div>
    `).join('');
}

// ==========================================
// HISTORY: everything assigned this school year
// ==========================================
// The Today tab filters to date_due >= today, so the 80+ rows of history the
// sync now preserves were invisible in the app. This is the view a tutor
// needs: what has been covered, what keeps recurring, where the load sits.
async function fetchHomeworkHistory() {
    const today = NedCore.toDateStr(new Date());
    const { data, error } = await NedCore.getClient()
        .from('homework_items')
        .select('*')
        .eq('student_id', NedCore.getStudentId())
        .lt('date_due', today)
        .order('date_due', { ascending: false });

    if (error) { console.error('Error fetching history:', error); return []; }
    return data || [];
}

function renderHistory(items) {
    const list = document.getElementById('history-list');
    const summary = document.getElementById('history-summary');
    const subtitle = document.getElementById('history-subtitle');
    if (!list) return;

    if (!items.length) {
        list.innerHTML = '<div class="empty-state">Nothing yet.</div>';
        if (summary) summary.innerHTML = '';
        return;
    }

    // Subject counts give the at-a-glance read: which subject dominates.
    const counts = {};
    items.forEach(i => { counts[i.subject] = (counts[i.subject] || 0) + 1; });
    const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = ordered[0][1];

    const dates = items.map(i => i.date_due).sort();
    if (subtitle) {
        subtitle.textContent = `${items.length} assignments since ${NedCore.formatShortDate
            ? NedCore.formatShortDate(dates[0]) : dates[0]}`;
    }

    if (summary) {
        summary.innerHTML = ordered.map(([subject, n]) => `
            <div class="history-stat">
                <span class="history-stat-subject">${subject}</span>
                <span class="history-stat-bar"><span style="width:${Math.round(n / max * 100)}%"></span></span>
                <span class="history-stat-count">${n}</span>
            </div>
        `).join('');
    }

    // Group by due date, newest first.
    const byDate = new Map();
    items.forEach(i => {
        if (!byDate.has(i.date_due)) byDate.set(i.date_due, []);
        byDate.get(i.date_due).push(i);
    });

    list.innerHTML = [...byDate.entries()].map(([date, rows]) => {
        const d = new Date(date + 'T00:00:00');
        const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return `
            <div class="history-day">
                <div class="history-date">${label}</div>
                ${rows.map(r => {
                    const parts = splitHomeworkParts(r.description || r.title);
                    const body = parts.length > 1
                        ? `<ul class="mission-parts">${parts.map(p => `<li>${p}</li>`).join('')}</ul>`
                        : `<div class="mission-text">${parts[0] || r.title}</div>`;
                    return `<div class="history-item">
                        <span class="history-subject">${r.subject}</span>
                        <div class="history-body">${body}</div>
                    </div>`;
                }).join('')}
            </div>`;
    }).join('');
}

// ==========================================
// SPLIT MULTI-PART HOMEWORK
// ==========================================
// Teachers write several tasks into one line:
//   "1) Read Ch 21-22 (Summary, CC)  2) Grammar pg 20  3) WW L3 A"
// Rendering that as one blob is the worst shape for a kid with ADD — three
// jobs disguised as one, with no way to see progress through them. Split on
// the numbering so each part gets its own line.
//
// Conservative on purpose: only splits when there are at least two markers,
// so "1) " used as a stray prefix, or a bare sentence, is left alone.
function splitHomeworkParts(text) {
    if (!text) return [];
    const str = String(text).trim();

    // Matches "1)" "2." "3:" at a boundary — the forms that actually show up.
    const marker = /(?:^|\s)(\d{1,2})\s*[).:]\s+/g;
    const hits = [...str.matchAll(marker)];
    if (hits.length < 2) return [str];

    const parts = [];
    for (let i = 0; i < hits.length; i++) {
        const from = hits[i].index + hits[i][0].length;
        const to = (i + 1 < hits.length) ? hits[i + 1].index : str.length;
        const piece = str.slice(from, to).trim().replace(/[,;]\s*$/, '');
        if (piece) parts.push(piece);
    }
    // Anything before the first marker is a lead-in, not a task — keep it
    // attached to the first part so no instruction is lost.
    const lead = str.slice(0, hits[0].index).trim();
    if (lead && parts.length) parts[0] = lead + ' ' + parts[0];

    return parts.length ? parts : [str];
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
        titleEl.textContent = "📚 Tonight's Homework";
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

    // Track today's completion for streak
    const today = NedCore.toDateStr();
    if (total > 0 && completed === total) {
        const streakData = JSON.parse(localStorage.getItem('nedStreak') || '{}');
        streakData[today] = true;
        localStorage.setItem('nedStreak', JSON.stringify(streakData));
    }
}

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
let historyLoaded = false;

function switchTab(tabName) {
    NedCore.switchTab(tabName);

    // History is a year of rows and nobody needs it on first paint, so load
    // it the first time the tab is opened rather than on boot.
    if (tabName === 'history' && !historyLoaded) {
        historyLoaded = true;
        const list = document.getElementById('history-list');
        if (list) list.innerHTML = '<div class="empty-state">Loading…</div>';
        fetchHomeworkHistory()
            .then(renderHistory)
            .catch(err => {
                console.error('History failed:', err);
                historyLoaded = false;
                if (list) list.innerHTML = '<div class="empty-state">Could not load history.</div>';
            });
    }
}
