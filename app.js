// ==========================================
// SUPABASE CONNECTION
// ==========================================
const SUPABASE_URL = 'https://jzmivepzevgqlmxirlmk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6bWl2ZXB6ZXZncWxteGlybG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODQ2MTAsImV4cCI6MjA3OTY2MDYxMH0.RTfSV7jMgyc1bpcDCZFtVoX9MjBYo0KElC0S16O6_og';
const WILLY_STUDENT_ID = '8021ff47-1a41-4341-a2e0-9c4fa53cc389';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fetch homework from database
async function fetchHomeworkFromDB() {
    // Get today's date at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    
    const { data, error } = await supabase
        .from('homework_items')
        .select('*')
        .eq('student_id', WILLY_STUDENT_ID)
        .gte('date_due', todayISO)  // Only items due today or later
        .order('date_due', { ascending: true });
    
    if (error) {
        console.error('Error fetching homework:', error);
        return null;
    }
    
    console.log('Fetched homework:', data);
    return data;
}

/// Convert database rows to mission format
function convertToMissions(homeworkItems) {
    if (!homeworkItems || homeworkItems.length === 0) {
        return tonightMissions; // Fall back to hardcoded if no data
    }
    
    return homeworkItems.map((item, index) => {
        // Determine badge type based on due date
        const dueDate = new Date(item.date_due);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        let badge = 'upcoming';
        let badgeType = 'normal';
        
        if (daysUntilDue <= 0) {
            badge = 'today';
            badgeType = 'urgent';
        } else if (daysUntilDue === 1) {
            badge = 'tomorrow';
            badgeType = 'urgent';
        } else if (daysUntilDue <= 3) {
            badge = `in ${daysUntilDue} days`;
            badgeType = 'warning';
        }
        
        return {
            id: `hw-${item.id}`,
            subject: item.subject || 'Assignment',
            text: item.title || item.description || 'No title',
            badge: badge,
            badgeType: badgeType,
            link: item.link || null,
            completed: item.checked_off || false
        };
    });
}
// ==========================================
// NED APP - PHASE 3 REDESIGN
// Barcelona-themed Command Center
// ==========================================

// ==========================================
// DATA: Player Stats (Hardcoded - will connect to API later)
// ==========================================
const playerData = [
    {
        name: "Lamine Yamal",
        position: "Right Winger",
        number: 19,
        emoji: "⚡",
        stats: {
            goals: 8,
            assists: 12,
            rating: 8.2,
            matches: 18
        },
        form: ["W", "W", "D", "W", "W"]
    },
    {
        name: "Raphinha",
        position: "Left Winger",
        number: 11,
        emoji: "🔥",
        stats: {
            goals: 14,
            assists: 8,
            rating: 7.9,
            matches: 20
        },
        form: ["W", "W", "W", "L", "W"]
    },
    {
        name: "Robert Lewandowski",
        position: "Striker",
        number: 9,
        emoji: "🎯",
        stats: {
            goals: 19,
            assists: 4,
            rating: 8.0,
            matches: 19
        },
        form: ["W", "D", "W", "W", "W"]
    }
];

// ==========================================
// DATA: Next Match (Hardcoded - will connect to API later)
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
// DATA: Alerts
// ==========================================
const alerts = [
    { type: "urgent", title: "🚨 TOMORROW (Monday):", text: "Science Chapter 3 Metabolism Quiz - did you study yet?" },
    { type: "urgent", title: "🚨 TOMORROW (Monday):", text: "Spanish slideshow due - is it done?" },
    { type: "warning", title: "⏰ This Week:", text: "Math test on Friday (Unit 3)" },
    { type: "info", title: "📚 Book Fair:", text: "Your class goes Wednesday - bring money if you want books" },
    { type: "info", title: "🎉 Coming Up:", text: "Thanksgiving break Nov 24-29!" }
];

// ==========================================
// DATA: Tonight's Homework (Missions)
// ==========================================
const tonightMissions = [
    { id: "hw1", subject: "Science", text: "Read pages P1-P4 and answer questions", badge: "study", badgeType: "urgent" },
    { id: "hw2", subject: "Science", text: "Study for Metabolism Quiz (tomorrow!)", badge: "urgent", badgeType: "urgent" },
    { id: "hw3", subject: "Spanish", text: "Finish slideshow (due tomorrow)", badge: "urgent", badgeType: "urgent" },
    { id: "hw4", subject: "Math", text: "p128 #1-8 in book", badge: "due mon", badgeType: "normal" },
    { id: "hw5", subject: "Social Studies", text: "Calculate your grade on MasteryConnect", badge: "due mon", badgeType: "normal" },
    { id: "hw6", subject: "ELA", text: "Find all evidence for essay", badge: "due mon", badgeType: "normal" },
    { id: "hw7", subject: "ELA", text: "Study for G/L", badge: "due mon", badgeType: "normal" },
    { id: "hw8", subject: "Math", text: "Practice on Khan Academy (teacher assigned)", badge: "test prep", badgeType: "warning" }
];

// ==========================================
// DATA: Morning Checklist
// ==========================================
const morningChecklist = [
    { id: "mon1", subject: "Math", text: "Math homework p128 #1-8 (completed?)", badge: "due mon", badgeType: "normal" },
    { id: "mon2", subject: "Spanish", text: "Slideshow saved and ready to present", badge: "due mon", badgeType: "normal" },
    { id: "mon3", subject: "Social Studies", text: "Bring 'The Story of Us' sheet", badge: "due mon", badgeType: "normal" },
    { id: "mon4", subject: "ELA", text: "Essay evidence (in backpack?)", badge: "due mon", badgeType: "normal" },
    { id: "item1", subject: "Gear", text: "Chromebook + charger", badge: "", badgeType: "" },
    { id: "item2", subject: "Gear", text: "Check desk - any loose papers?", badge: "", badgeType: "" },
    { id: "item3", subject: "Gear", text: "Lunchbox", badge: "", badgeType: "" },
    { id: "item4", subject: "Gear", text: "Water bottle", badge: "", badgeType: "" }
];

// ==========================================
// DATA: Week View
// ==========================================
const weekData = [
    {
        day: "Monday, Dec 2",
        isToday: true,
        items: [
            { text: "Science: Metabolism Quiz (Ch 3)", isTest: true },
            { text: "Spanish: Slideshow due" },
            { text: "SS: Bring 'Story of Us' sheet" },
            { text: "SS: Calculate grade on MasteryConnect" },
            { text: "ELA: Find all evidence for essay" },
            { text: "ELA: Study for G/L" }
        ]
    },
    {
        day: "Tuesday, Dec 3",
        items: [
            { text: "Keep working on ongoing assignments" },
            { text: "Start studying for Math test (Friday)" }
        ]
    },
    {
        day: "Wednesday, Dec 4",
        items: [
            { text: "Study for Math test (2 days away!)" },
            { text: "Book Fair with your class - bring money if you want books" }
        ]
    },
    {
        day: "Thursday, Dec 5",
        items: [
            { text: "Final review for Math test tomorrow" }
        ]
    },
    {
        day: "Friday, Dec 6",
        items: [
            { text: "Math: Unit 3 Test", isTest: true },
            { text: "End of Trimester 1 - you made it! 🎉" }
        ]
    }
];

// ==========================================
// DATA: Tests
// ==========================================
const testsData = [
    {
        date: "TOMORROW - Monday, Dec 2",
        subject: "🔬 Science: Chapter 3 Metabolism Quiz",
        details: "Study pages P1-P4 and review questions",
        urgency: "urgent"
    },
    {
        date: "Friday, Dec 6 (4 days away)",
        subject: "📊 Math: Unit 3 Test",
        details: "Start reviewing a little each night!",
        urgency: "warning"
    }
];

// ==========================================
// DATA: Study Tips
// ==========================================
const studyTips = [
    {
        title: "For Science Quiz tomorrow:",
        tips: [
            "Re-read pages P1-P4",
            "Answer the follow-up questions",
            "Make flashcards for key terms",
            "Quiz yourself tonight"
        ]
    },
    {
        title: "For Math Test (Friday):",
        tips: [
            "Practice on Khan Academy each night",
            "⚠️ Read the WHOLE question - tip OR total bill?",
            "Go to small group review in class",
            "Don't cram Thursday night!"
        ]
    }
];

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    setDateDisplay();
    setGreeting();
    setMotivation();
    initVoicePicker();
    setRandomJoke();
    setRandomTrivia();
    renderMatchCard();
    renderAlerts();
    
    // Fetch real homework from Supabase
    const homeworkData = await fetchHomeworkFromDB();
    if (homeworkData && homeworkData.length > 0) {
        const missions = convertToMissions(homeworkData);
       renderMissionsFromDB(missions);
    } else {
        renderMissions(); // Fall back to hardcoded
    }
    
    renderMorningChecklist();
    renderPlayerCards();
    renderWeekView();
    renderTests();
    renderStudyTips();
    loadProgress();
    updateStats();
    checkSaturdayReminder();
}

// ==========================================
// DATE & GREETING
// ==========================================
function setDateDisplay() {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    const today = new Date().toLocaleDateString('en-US', options);
    document.getElementById('date-display').textContent = today;
}

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

function setMotivation() {
    const messages = voiceMessages[currentVoice].motivation;
    const randomIndex = Math.floor(Math.random() * messages.length);
    document.getElementById('motivation-text').textContent = messages[randomIndex];
    document.getElementById('match-motivation-text').textContent = voiceMessages[currentVoice].matchMotivation;
}

// ==========================================
// VOICE PICKER
// ==========================================
function initVoicePicker() {
    const buttons = document.querySelectorAll('.voice-btn');
    buttons.forEach(btn => {
        if (btn.dataset.voice === currentVoice) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function setVoice(voice) {
    currentVoice = voice;
    localStorage.setItem('nedVoice', voice);
    
    const buttons = document.querySelectorAll('.voice-btn');
    buttons.forEach(btn => {
        if (btn.dataset.voice === voice) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    setGreeting();
    setMotivation();
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
    document.querySelector('.trivia-text').textContent = randomTrivia;
}

// ==========================================
// MATCH CARD
// ==========================================
function renderMatchCard() {
    document.getElementById('opponent-name').textContent = nextMatch.opponent;
    document.getElementById('opponent-crest').textContent = nextMatch.opponentCrest;
    document.getElementById('match-competition').textContent = nextMatch.competition;
    document.getElementById('match-date').textContent = nextMatch.date;
    document.getElementById('match-time').textContent = nextMatch.time;
}

// ==========================================
// ALERTS
// ==========================================
function renderAlerts() {
    const container = document.getElementById('alerts-container');
    container.innerHTML = alerts.map(alert => `
        <div class="alert ${alert.type}">
            <div class="alert-title">${alert.title}</div>
            <div class="alert-text">${alert.text}</div>
        </div>
    `).join('');
}

// ==========================================
// MISSIONS (Homework)
// ==========================================
function renderMissions() {
    const container = document.getElementById('tonight-homework');
    container.innerHTML = tonightMissions.map(mission => `
        <div class="mission-item" data-id="${mission.id}" onclick="toggleMission(this)">
            <div class="mission-checkbox"></div>
            <div class="mission-content">
                <div class="mission-text">${mission.text}</div>
                <div class="mission-subject">${mission.subject}</div>
            </div>
            ${mission.badge ? `<span class="mission-badge ${mission.badgeType}">${mission.badge}</span>` : ''}
        </div>
    `).join('');
}

function renderMissionsFromDB(missions) {
    const container = document.getElementById('tonight-homework');
    container.innerHTML = missions.map(mission => `
        <div class="mission-item ${mission.completed ? 'completed' : ''}" data-id="${mission.id}" onclick="toggleMission(this)">
            <div class="mission-checkbox"></div>
            <div class="mission-content">
                <div class="mission-text">${mission.text}</div>
                <div class="mission-subject">${mission.subject}</div>
            </div>
            ${mission.badge ? `<span class="mission-badge ${mission.badgeType}">${mission.badge}</span>` : ''}
        </div>
    `).join('');
}

function renderMorningChecklist() {
    const container = document.getElementById('morning-checklist');
    container.innerHTML = morningChecklist.map(item => `
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

function toggleMission(element) {
    element.classList.toggle('completed');
    updateStats();
    saveProgress();
}

// ==========================================
// PROGRESS & STATS
// ==========================================
function updateStats() {
    const allMissions = document.querySelectorAll('#today-tab .mission-item');
    const completedMissions = document.querySelectorAll('#today-tab .mission-item.completed');
    
    const total = allMissions.length;
    const completed = completedMissions.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('mission-count').textContent = `${completed}/${total}`;
    document.getElementById('progress-fill').style.width = `${percentage}%`;
    document.getElementById('progress-text').textContent = `${percentage}% Complete`;
}

// ==========================================
// PLAYER CARDS
// ==========================================
function renderPlayerCards() {
    const container = document.getElementById('player-cards');
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
    
    document.getElementById('total-goals').textContent = totalGoals;
    document.getElementById('total-assists').textContent = totalAssists;
    document.getElementById('avg-rating').textContent = avgRating;
}

// ==========================================
// WEEK VIEW
// ==========================================
function renderWeekView() {
    const container = document.getElementById('week-view');
    container.innerHTML = weekData.map(day => `
        <div class="day-card ${day.isToday ? 'today' : ''}">
            <div class="day-header">
                <span class="day-name">${day.day}</span>
                ${day.isToday ? '<span class="day-badge">TODAY</span>' : ''}
            </div>
            <div class="day-items">
                ${day.items.map(item => `
                    <div class="day-item ${item.isTest ? 'test' : ''}">${item.text}</div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ==========================================
// TESTS
// ==========================================
function renderTests() {
    const container = document.getElementById('tests-container');
    container.innerHTML = testsData.map(test => `
        <div class="test-card ${test.urgency}">
            <div class="test-date">${test.date}</div>
            <div class="test-subject">${test.subject}</div>
            <div class="test-details">${test.details}</div>
        </div>
    `).join('');
}

function renderStudyTips() {
    const container = document.getElementById('study-tips');
    container.innerHTML = studyTips.map(section => `
        <div class="study-section">
            <div class="study-title">${section.title}</div>
            <ul class="study-list">
                ${section.tips.map(tip => `<li>${tip}</li>`).join('')}
            </ul>
        </div>
    `).join('');
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
    
    localStorage.setItem('nedProgress', JSON.stringify(progress));
}

function loadProgress() {
    const saved = localStorage.getItem('nedProgress');
    if (saved) {
        const progress = JSON.parse(saved);
        
        Object.keys(progress).forEach(id => {
            const mission = document.querySelector(`.mission-item[data-id="${id}"]`);
            if (mission && progress[id]) {
                mission.classList.add('completed');
            }
        });
    }
}