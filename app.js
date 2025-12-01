// app.js - Enhanced with Supabase integration
// Keeps all existing functionality + adds live database connection

// ============= EXISTING FEATURES (PRESERVED) =============

// Soccer trivia array
const soccerTrivia = [
    "Who do you think will win the Ballon d'Or this year?",
    "What's your prediction: Will Barca win La Liga this season?",
    "Who's your favorite Barca player right now and why?",
    "Messi or Ronaldo - who's the GOAT?",
    "Which Champions League team do you think Barca should worry about most?",
    "If you could add any player to Barca's squad, who would it be?",
    "What's the best goal you've ever seen? (Barca or any team)",
    "Who's the most underrated player on Barca right now?"
];

// Dad jokes array
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
    "What's the best thing about Switzerland? I don't know, but the flag is a big plus!"
];

// Set greeting based on time
function setGreeting() {
    const hour = new Date().getHours();
    const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    let greeting;
    
    if (hour < 12) greeting = "Good morning, Willy! ☀️";
    else if (hour < 18) greeting = "Hey Willy! 👋";
    else greeting = "Evening, Willy! 🌙";
    
    document.getElementById('greeting').textContent = greeting;
    
    // Show Saturday shot reminder if it's Saturday
    if (day === 6) {
        showSaturdayReminder();
    }
}

// Show Saturday shot reminder
function showSaturdayReminder() {
    const todayTab = document.getElementById('today-tab');
    const firstCard = todayTab.querySelector('.card');
    
    const shotReminder = document.createElement('div');
    shotReminder.className = 'card';
    shotReminder.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)';
    shotReminder.style.color = 'white';
    shotReminder.innerHTML = `
        <h2 style="color: white;">💉 IMPORTANT REMINDER</h2>
        <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; margin-bottom: 15px;">
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">
                Growth Hormone Shot (11mg)
            </div>
            <div style="font-size: 18px;">
                ⏰ Time: 8:00 AM
            </div>
        </div>
        <div class="checklist-item" onclick="toggleItem(this)" style="background: rgba(255,255,255,0.9);">
            <input type="checkbox" id="shot-reminder">
            <label for="shot-reminder" style="color: #333; font-weight: bold;">✅ I took my shot</label>
        </div>
    `;
    
    todayTab.insertBefore(shotReminder, firstCard);
}

// Random joke and soccer trivia on load
function setRandomJoke() {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    document.getElementById('joke').textContent = randomJoke;
    
    const randomTrivia = soccerTrivia[Math.floor(Math.random() * soccerTrivia.length)];
    const triviaElement = document.getElementById('soccer-trivia');
    if (triviaElement) {
        triviaElement.innerHTML = '<strong>⚽ Soccer Question:</strong> ' + randomTrivia;
    }
}

// Toggle checklist item
function toggleItem(element) {
    const checkbox = element.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    
    if (checkbox.checked) {
        element.classList.add('completed');
    } else {
        element.classList.remove('completed');
    }
    
    updateStats();
    saveProgress();
}

// Update completion stats
function updateStats() {
    const allCheckboxes = document.querySelectorAll('#today-tab input[type="checkbox"]');
    const completedCheckboxes = document.querySelectorAll('#today-tab input[type="checkbox"]:checked');
    
    document.getElementById('completed-count').textContent = completedCheckboxes.length + '/' + allCheckboxes.length;
}

// Switch between tabs
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active from all nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + '-tab').classList.add('active');
    
    // Activate nav button
    event.target.classList.add('active');
}

// Save progress to localStorage
function saveProgress() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    const progress = {};
    
    checkboxes.forEach(checkbox => {
        progress[checkbox.id] = checkbox.checked;
    });
    
    localStorage.setItem('nedProgress', JSON.stringify(progress));
}

// Load progress from localStorage
function loadProgress() {
    const saved = localStorage.getItem('nedProgress');
    if (saved) {
        const progress = JSON.parse(saved);
        
        Object.keys(progress).forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox && progress[id]) {
                checkbox.checked = true;
                checkbox.closest('.checklist-item').classList.add('completed');
            }
        });
    }
}

// ============= NEW: SUPABASE INTEGRATION =============

// Check if Supabase is available
function isSupabaseEnabled() {
    return window.NedSupabase !== undefined;
}

// Load homework from Supabase
async function loadHomeworkFromSupabase() {
    if (!isSupabaseEnabled()) {
        console.log('📝 Supabase not enabled, using hardcoded homework');
        return;
    }

    try {
        console.log('📚 Loading homework from Supabase...');
        
        // Fetch today's homework
        const todaysHomework = await window.NedSupabase.fetchUpcomingHomework();
        console.log(`✅ Loaded ${todaysHomework.length} items for today`);
        
        // If we have homework from database, replace hardcoded content
        if (todaysHomework.length > 0) {
            displaySupabaseHomework(todaysHomework);
        }
        
    } catch (error) {
        console.error('❌ Error loading from Supabase:', error);
        console.log('📝 Falling back to hardcoded homework');
    }
}

// Display homework from Supabase
function displaySupabaseHomework(homework) {
    const container = document.getElementById('tonight-homework');
    if (!container) {
        console.warn('⚠️ Homework container not found');
        return;
    }
    
    // Clear existing hardcoded homework
    container.innerHTML = '';
    
    if (homework.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #10b981;">
                <div style="font-size: 48px;">🎉</div>
                <p style="font-size: 18px; margin-top: 10px;">No homework due today!</p>
            </div>
        `;
        return;
    }
    
    // Group by subject
    const grouped = {};
    homework.forEach(item => {
        const subject = item.subject || 'Other';
        if (!grouped[subject]) grouped[subject] = [];
        grouped[subject].push(item);
    });
    
    // Render each subject's homework
    Object.keys(grouped).sort().forEach(subject => {
        grouped[subject].forEach((item, index) => {
            const emoji = getSubjectEmoji(subject);
            const urgency = getUrgencyBadge(item.date_due);
            
            const homeworkDiv = document.createElement('div');
            homeworkDiv.className = 'checklist-item';
            homeworkDiv.onclick = function() { toggleSupabaseItem(this, item.id); };
            
            // Check if already completed from localStorage or database
            const isChecked = item.checked_off ? 'checked' : '';
            const isCompleted = item.checked_off ? 'completed' : '';
            
            if (isCompleted) homeworkDiv.classList.add(isCompleted);
            homeworkDiv.innerHTML = `
                <input type="checkbox" id="hw-${item.id}" ${isChecked} data-homework-id="${item.id}">
                <label for="hw-${item.id}">${emoji} ${subject}: ${item.title}</label>
                ${urgency}
            `;
            
            // Add description if exists
            if (item.description) {
                const desc = document.createElement('p');
                desc.style.fontSize = '14px';
                desc.style.color = '#666';
                desc.style.marginTop = '5px';
                desc.style.marginLeft = '39px';
                desc.textContent = item.description;
                homeworkDiv.appendChild(desc);
            }
            
            // Add Canvas link if exists
            if (item.link) {
                const link = document.createElement('a');
                link.href = item.link;
                link.target = '_blank';
                link.style.marginLeft = '39px';
                link.style.fontSize = '13px';
                link.style.color = '#667eea';
                link.textContent = '📎 View in Canvas';
                link.onclick = function(e) { e.stopPropagation(); };
                homeworkDiv.appendChild(link);
            }
            
            container.appendChild(homeworkDiv);
        });
    });
}

// Toggle Supabase homework item
async function toggleSupabaseItem(element, homeworkId) {
    const checkbox = element.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    
    if (checkbox.checked) {
        element.classList.add('completed');
    } else {
        element.classList.remove('completed');
    }
    
    // Save to Supabase if available
    if (isSupabaseEnabled()) {
        try {
            if (checkbox.checked) {
                await window.NedSupabase.checkOffHomework(homeworkId);
                console.log(`✅ Marked homework #${homeworkId} as complete`);
            } else {
                await window.NedSupabase.uncheckHomework(homeworkId);
                console.log(`↩️ Marked homework #${homeworkId} as incomplete`);
            }
        } catch (error) {
            console.error('Error updating homework:', error);
            // Revert checkbox state if save failed
            checkbox.checked = !checkbox.checked;
            element.classList.toggle('completed');
        }
    }
    
    updateStats();
    saveProgress();
}

// Get emoji for subject
function getSubjectEmoji(subject) {
    const emojiMap = {
        'Math': '📊',
        'Science': '🔬',
        'ELA': '✍️',
        'English': '📚',
        'Social Studies': '🌍',
        'SS': '🌍',
        'Spanish': '🇪🇸',
        'History': '📜',
        'Reading': '📖',
        'Writing': '✏️'
    };
    return emojiMap[subject] || '📝';
}

// Get urgency badge
function getUrgencyBadge(dueDate) {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    if (dueDate === today) {
        return '<span class="time-badge urgent">DUE TODAY</span>';
    } else if (dueDate === tomorrowStr) {
        return '<span class="time-badge urgent">DUE TOMORROW</span>';
    } else {
        const due = new Date(dueDate);
        const dayName = due.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        return `<span class="time-badge">DUE ${dayName}</span>`;
    }
}

// ============= INITIALIZATION =============

// Initialize on load
window.onload = async function() {
    console.log('🚀 Ned App starting...');
    
    // Original functionality
    setGreeting();
    setRandomJoke();
    loadProgress();
    updateStats();
    
    // Try to load from Supabase
    await loadHomeworkFromSupabase();
    
    console.log('✅ Ned App initialized');
};
```

5. **Save the file** (Cmd+S or Ctrl+S)

---

**Once you've replaced app.js and saved it, tell me:**
```
"app.js replaced and saved!"