// abby-lee.js - Homework Command Center for Simone
// Dance Moms / Theater themed homework tracker

// Supabase config (same instance, different student)
const SUPABASE_URL = 'https://jzmivepzevgqlmxirlmk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6bWl2ZXB6ZXZncWxteGlybG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MDY2NDcsImV4cCI6MjA2NDM4MjY0N30.tPMNwpWyj7wqAexEgNg3zJxPdKSXBSvhKSHhpfPLdCk';
const SIMONE_STUDENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let homeworkItems = [];
let currentTab = 'today';
let parsedHomework = [];

// Abby Lee quotes
const abbyQuotes = [
    "Everyone's replaceable. Do your homework!",
    "Save your tears for the pillow!",
    "Second place is the first loser.",
    "I don't want to hear excuses. I want to see results!",
    "You need to practice like you've never won and perform like you've never lost.",
    "Homework is your audition for life!",
    "I see potential, but potential doesn't mean anything without hard work.",
    "Stop the whining and start the grinding!",
    "Excellence is not a skill, it's an attitude.",
    "The only thing standing between you and your goal is the homework you're not doing!"
];

const motivationSubtitles = [
    "Let's crush it today!",
    "Time to slay, queen!",
    "Make Abby proud!",
    "Work hard, shine bright!",
    "You've got this!",
    "Show them what you're made of!",
    "Be a star, not a backup dancer!"
];

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    setGreeting();
    setRandomQuote();
    setRandomMotivation();
    await loadHomework();
    updateStreak();
    renderTodayHomework();
    renderWeekView();
    updatePyramid();

    // Set default due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('manual-due').value = tomorrow.toISOString().split('T')[0];
});

function setGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Hey Simone!';

    if (hour < 12) {
        greeting = 'Good morning, Simone!';
    } else if (hour < 17) {
        greeting = 'Hey Simone!';
    } else if (hour < 21) {
        greeting = 'Evening, superstar!';
    } else {
        greeting = 'Night owl mode, Simone!';
    }

    document.getElementById('greeting').textContent = greeting;
}

function setRandomQuote() {
    const quote = abbyQuotes[Math.floor(Math.random() * abbyQuotes.length)];
    document.getElementById('abby-quote').textContent = `"${quote}"`;

    // Also set the motivation card quote
    document.getElementById('motivation-quote').textContent = `"${quote}"`;
}

function setRandomMotivation() {
    const subtitle = motivationSubtitles[Math.floor(Math.random() * motivationSubtitles.length)];
    document.getElementById('motivation-subtitle').textContent = subtitle;
}

// Tab switching
function switchTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`.nav-tab[onclick="switchTab('${tabName}')"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Refresh content
    if (tabName === 'today') {
        renderTodayHomework();
    } else if (tabName === 'week') {
        renderWeekView();
    } else if (tabName === 'pyramid') {
        updatePyramid();
    }
}

// Load homework from Supabase
async function loadHomework() {
    const { data, error } = await supabaseClient
        .from('homework_items')
        .select('*')
        .eq('student_id', SIMONE_STUDENT_ID)
        .gte('date_due', new Date().toISOString().split('T')[0])
        .order('date_due', { ascending: true });

    if (error) {
        console.error('Error loading homework:', error);
        homeworkItems = [];
    } else {
        homeworkItems = data || [];
    }
}

// Render today's homework
function renderTodayHomework() {
    const container = document.getElementById('tonight-homework');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get homework due today or tomorrow
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const todaysHomework = homeworkItems.filter(item =>
        item.date_due === todayStr || item.date_due === tomorrowStr
    );

    // Update counts
    const completed = todaysHomework.filter(item => item.checked_off).length;
    const total = todaysHomework.length;

    document.getElementById('mission-count').textContent = `${completed}/${total}`;

    // Update progress
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    document.getElementById('progress-fill').style.width = `${progressPercent}%`;
    document.getElementById('progress-text').textContent = `${progressPercent}% Complete`;

    if (todaysHomework.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🌟</div>
                <div class="empty-text">No homework tonight!</div>
                <div class="empty-subtext">Time to practice your dance moves!</div>
            </div>
        `;
        return;
    }

    container.innerHTML = todaysHomework.map(item => `
        <div class="mission-item ${item.checked_off ? 'completed' : ''}" onclick="toggleHomework('${item.id}')">
            <div class="mission-checkbox ${item.checked_off ? 'checked' : ''}">
                ${item.checked_off ? '✓' : ''}
            </div>
            <div class="mission-content">
                <div class="mission-title">${item.title}</div>
                <div class="mission-meta">
                    <span class="subject-tag">${getSubjectEmoji(item.subject)} ${item.subject}</span>
                    <span class="due-tag">${item.date_due === todayStr ? 'Due Today' : 'Due Tomorrow'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function getSubjectEmoji(subject) {
    const emojis = {
        'Math': '📐',
        'ELA': '📚',
        'Reading': '📖',
        'Science': '🔬',
        'Social Studies': '🌍',
        'Spanish': '🇪🇸',
        'Art': '🎨',
        'Music': '🎵',
        'PE': '🏃',
        'Other': '📝'
    };
    return emojis[subject] || '📝';
}

// Toggle homework completion
async function toggleHomework(id) {
    const item = homeworkItems.find(h => h.id === id);
    if (!item) return;

    const newStatus = !item.checked_off;

    // Optimistic update
    item.checked_off = newStatus;
    renderTodayHomework();
    updatePyramid();

    // Save to Supabase
    const { error } = await supabaseClient
        .from('homework_items')
        .update({ checked_off: newStatus })
        .eq('id', id);

    if (error) {
        console.error('Error updating homework:', error);
        // Revert on error
        item.checked_off = !newStatus;
        renderTodayHomework();
    } else if (newStatus) {
        // Show celebration
        showCelebration();
    }
}

function showCelebration() {
    // Quick sparkle effect
    const sparkle = document.createElement('div');
    sparkle.innerHTML = '✨💃✨';
    sparkle.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 48px;
        z-index: 1000;
        animation: popIn 0.5s ease-out forwards;
    `;
    document.body.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 500);
}

// Week view
function renderWeekView() {
    const container = document.getElementById('week-view');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get current week (Sunday to Saturday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const days = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        days.push({
            date,
            dateStr: date.toISOString().split('T')[0],
            dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNum: date.getDate(),
            isToday: date.toDateString() === today.toDateString()
        });
    }

    container.innerHTML = days.map(day => {
        const dayHomework = homeworkItems.filter(h => h.date_due === day.dateStr);
        const completed = dayHomework.filter(h => h.checked_off).length;
        const total = dayHomework.length;

        return `
            <div class="week-day ${day.isToday ? 'today' : ''} ${day.date < today ? 'past' : ''}">
                <div class="week-day-header">
                    <span class="week-day-name">${day.dayName}</span>
                    <span class="week-day-num">${day.dayNum}</span>
                </div>
                <div class="week-day-content">
                    ${total > 0 ? `
                        <div class="week-count">${completed}/${total}</div>
                        <div class="week-items">
                            ${dayHomework.slice(0, 3).map(h => `
                                <div class="week-item ${h.checked_off ? 'done' : ''}">${h.subject}</div>
                            `).join('')}
                            ${total > 3 ? `<div class="week-more">+${total - 3} more</div>` : ''}
                        </div>
                    ` : '<div class="week-empty">Free!</div>'}
                </div>
            </div>
        `;
    }).join('');
}

// Pyramid progress
function updatePyramid() {
    // Count completed homework this week
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startStr = startOfWeek.toISOString().split('T')[0];

    const weeklyCompleted = homeworkItems.filter(h =>
        h.checked_off && h.date_due >= startStr
    ).length;

    const weeklyPending = homeworkItems.filter(h =>
        !h.checked_off && h.date_due >= startStr
    ).length;

    // Update stats
    document.getElementById('completed-count').textContent = weeklyCompleted;
    document.getElementById('pending-count').textContent = weeklyPending;

    // Update pyramid spots (light up based on completions)
    const pyramidSpots = [1, 2, 3, 4, 5, 6];
    pyramidSpots.forEach(spot => {
        const el = document.getElementById(`pyramid-${spot}`);
        if (weeklyCompleted >= (7 - spot)) {
            el.classList.add('lit');
        } else {
            el.classList.remove('lit');
        }
    });

    // Update needed count
    const needed = Math.max(0, 6 - weeklyCompleted);
    document.getElementById('pyramid-needed').textContent = needed;
}

// Streak tracking
function updateStreak() {
    // Simple streak based on localStorage
    const lastActive = localStorage.getItem('simone_last_active');
    let streak = parseInt(localStorage.getItem('simone_streak') || '0');

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (lastActive === today) {
        // Already counted today
    } else if (lastActive === yesterday) {
        // Continue streak
        streak++;
        localStorage.setItem('simone_streak', streak);
        localStorage.setItem('simone_last_active', today);
    } else if (lastActive) {
        // Streak broken
        streak = 1;
        localStorage.setItem('simone_streak', streak);
        localStorage.setItem('simone_last_active', today);
    } else {
        // First time
        streak = 1;
        localStorage.setItem('simone_streak', streak);
        localStorage.setItem('simone_last_active', today);
    }

    document.getElementById('streak-count').textContent = streak;
    document.getElementById('streak-display').textContent = streak;
}

// Parse Aspen homework (basic text parsing)
function parseAspenHomework() {
    const input = document.getElementById('paste-input').value.trim();
    if (!input) {
        alert('Please paste your homework from Aspen first!');
        return;
    }

    // Basic parsing - try to extract subject and assignment info
    // Aspen format varies, so we'll do simple line-by-line parsing
    const lines = input.split('\n').filter(line => line.trim());
    parsedHomework = [];

    let currentSubject = '';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDue = tomorrow.toISOString().split('T')[0];

    for (const line of lines) {
        const trimmed = line.trim();

        // Check if this is a subject header
        const subjectMatch = trimmed.match(/^(Math|ELA|Reading|Science|Social Studies|Spanish|English|History|Geography|Art|Music|PE)/i);
        if (subjectMatch) {
            currentSubject = subjectMatch[1];
            // If there's more on this line after the subject, treat it as an assignment
            const afterSubject = trimmed.substring(subjectMatch[0].length).trim();
            if (afterSubject && afterSubject.length > 3) {
                parsedHomework.push({
                    subject: normalizeSubject(currentSubject),
                    title: afterSubject.replace(/^[:\-–]\s*/, ''),
                    date_due: defaultDue
                });
            }
        } else if (currentSubject && trimmed.length > 3 && !trimmed.match(/^(page|pg|p\.|due|assign)/i)) {
            // This looks like an assignment
            parsedHomework.push({
                subject: normalizeSubject(currentSubject),
                title: trimmed,
                date_due: defaultDue
            });
        } else if (trimmed.length > 10) {
            // No subject context, add as general
            parsedHomework.push({
                subject: 'Other',
                title: trimmed,
                date_due: defaultDue
            });
        }
    }

    if (parsedHomework.length === 0) {
        alert('Could not parse any homework. Try adding manually!');
        return;
    }

    // Show preview
    renderParsedPreview();
}

function normalizeSubject(subject) {
    const normalized = {
        'english': 'ELA',
        'reading': 'ELA',
        'history': 'Social Studies',
        'geography': 'Social Studies'
    };
    const lower = subject.toLowerCase();
    return normalized[lower] || subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase();
}

function renderParsedPreview() {
    const container = document.getElementById('parsed-items');
    document.getElementById('parsed-preview').style.display = 'block';

    container.innerHTML = parsedHomework.map((item, index) => `
        <div class="parsed-item" style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span class="subject-tag">${getSubjectEmoji(item.subject)} ${item.subject}</span>
                    <div style="margin-top: 4px; color: white;">${item.title}</div>
                </div>
                <button onclick="removeParsedItem(${index})" style="background: none; border: none; color: var(--al-pink); cursor: pointer; font-size: 18px;">✕</button>
            </div>
        </div>
    `).join('');
}

function removeParsedItem(index) {
    parsedHomework.splice(index, 1);
    if (parsedHomework.length === 0) {
        cancelParsed();
    } else {
        renderParsedPreview();
    }
}

async function saveParsedHomework() {
    if (parsedHomework.length === 0) return;

    const items = parsedHomework.map(item => ({
        student_id: SIMONE_STUDENT_ID,
        subject: item.subject,
        title: item.title,
        date_due: item.date_due,
        checked_off: false,
        source: 'aspen_paste'
    }));

    const { error } = await supabaseClient
        .from('homework_items')
        .insert(items);

    if (error) {
        console.error('Error saving homework:', error);
        alert('Error saving homework. Please try again.');
        return;
    }

    // Refresh
    await loadHomework();
    renderTodayHomework();
    renderWeekView();
    updatePyramid();

    // Clear form
    cancelParsed();
    clearPasteArea();

    alert(`Saved ${items.length} homework item${items.length > 1 ? 's' : ''}!`);
}

function cancelParsed() {
    parsedHomework = [];
    document.getElementById('parsed-preview').style.display = 'none';
    document.getElementById('parsed-items').innerHTML = '';
}

function clearPasteArea() {
    document.getElementById('paste-input').value = '';
    cancelParsed();
}

// Manual homework entry
async function saveManualHomework() {
    const subject = document.getElementById('manual-subject').value;
    const title = document.getElementById('manual-title').value.trim();
    const dueDate = document.getElementById('manual-due').value;

    if (!subject || !title || !dueDate) {
        alert('Please fill in all fields!');
        return;
    }

    const { error } = await supabaseClient
        .from('homework_items')
        .insert({
            student_id: SIMONE_STUDENT_ID,
            subject,
            title,
            date_due: dueDate,
            checked_off: false,
            source: 'manual'
        });

    if (error) {
        console.error('Error saving homework:', error);
        alert('Error saving homework. Please try again.');
        return;
    }

    // Refresh
    await loadHomework();
    renderTodayHomework();
    renderWeekView();
    updatePyramid();

    // Clear form
    clearManualForm();

    alert('Homework saved!');
}

function clearManualForm() {
    document.getElementById('manual-subject').value = '';
    document.getElementById('manual-title').value = '';

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('manual-due').value = tomorrow.toISOString().split('T')[0];
}

// Make functions available globally
window.switchTab = switchTab;
window.toggleHomework = toggleHomework;
window.parseAspenHomework = parseAspenHomework;
window.saveParsedHomework = saveParsedHomework;
window.cancelParsed = cancelParsed;
window.clearPasteArea = clearPasteArea;
window.saveManualHomework = saveManualHomework;
window.clearManualForm = clearManualForm;
window.removeParsedItem = removeParsedItem;
