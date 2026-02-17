// ned-core.js -- Shared utilities for all Ned App student pages
// Loaded after Supabase CDN, before app.js or abby-lee.js

const NedCore = (function() {
    // === PRIVATE STATE ===
    let _client = null;
    let _studentConfig = null;

    // === STUDENT CONFIGS ===
    const SUPABASE_URL = 'https://jzmivepzevgqlmxirlmk.supabase.co';

    const STUDENTS = {
        willy: {
            id: '8021ff47-1a41-4341-a2e0-9c4fa53cc389',
            name: 'Willy',
            grade: 7,
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6bWl2ZXB6ZXZncWxteGlybG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODQ2MTAsImV4cCI6MjA3OTY2MDYxMH0.RTfSV7jMgyc1bpcDCZFtVoX9MjBYo0KElC0S16O6_og'
        },
        simone: {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            name: 'Simone',
            grade: 5,
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6bWl2ZXB6ZXZncWxteGlybG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MDY2NDcsImV4cCI6MjA2NDM4MjY0N30.tPMNwpWyj7wqAexEgNg3zJxPdKSXBSvhKSHhpfPLdCk'
        }
    };

    // === INITIALIZATION ===
    function init(studentKey) {
        const config = STUDENTS[studentKey];
        if (!config) {
            console.error('Unknown student key:', studentKey);
            return;
        }
        _studentConfig = config;
        _client = window.supabase.createClient(SUPABASE_URL, config.anonKey);
        console.log(`Ned Core initialized for ${config.name}`);
    }

    function getClient() { return _client; }
    function getStudentId() { return _studentConfig?.id; }
    function getStudentConfig() { return _studentConfig; }

    // === DATE HELPERS ===
    function toDateStr(date) {
        return (date || new Date()).toISOString().split('T')[0];
    }

    function isToday(dateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkDate = new Date(dateStr + 'T00:00:00');
        return checkDate.getTime() === today.getTime();
    }

    function isTomorrow(dateStr) {
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const checkDate = new Date(dateStr + 'T00:00:00');
        return checkDate.getTime() === tomorrow.getTime();
    }

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

    // === HOMEWORK CRUD ===
    async function checkOffHomework(homeworkId) {
        const { error } = await _client
            .from('homework_items')
            .update({ checked_off: true, checked_at: new Date().toISOString() })
            .eq('id', homeworkId);

        if (error) {
            console.error('Error checking off homework:', error);
            throw error;
        }
        return true;
    }

    async function uncheckHomework(homeworkId) {
        const { error } = await _client
            .from('homework_items')
            .update({ checked_off: false, checked_at: null })
            .eq('id', homeworkId);

        if (error) {
            console.error('Error unchecking homework:', error);
            throw error;
        }
        return true;
    }

    // === MISSION TOGGLE ===
    async function toggleMission(element, onStatsUpdate) {
        const id = element.dataset.id;
        const isNowCompleted = !element.classList.contains('completed');

        // Toggle visual state immediately
        element.classList.toggle('completed');
        if (onStatsUpdate) onStatsUpdate();

        // If homework item, persist to Supabase
        if (id && id.startsWith('hw-')) {
            const homeworkId = id.replace('hw-', '');
            try {
                if (isNowCompleted) {
                    await checkOffHomework(homeworkId);
                    console.log('Homework marked complete:', homeworkId);
                } else {
                    await uncheckHomework(homeworkId);
                    console.log('Homework unmarked:', homeworkId);
                }
            } catch (err) {
                console.error('Failed to update homework:', err);
                element.classList.toggle('completed');
                if (onStatsUpdate) onStatsUpdate();
            }
        }

        saveProgress();
    }

    // === PROGRESS ===
    function saveProgress() {
        const missions = document.querySelectorAll('.mission-item');
        const progress = {};

        missions.forEach(mission => {
            const id = mission.dataset.id;
            if (id) {
                progress[id] = mission.classList.contains('completed');
            }
        });

        const today = toDateStr();
        localStorage.setItem('nedProgress', JSON.stringify({ date: today, items: progress }));
    }

    function loadProgress() {
        const saved = localStorage.getItem('nedProgress');
        if (!saved) return;

        try {
            const data = JSON.parse(saved);
            const today = toDateStr();

            if (data.date !== today) {
                console.log('New day - resetting progress');
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

    // === TAB NAVIGATION ===
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

    // === PUBLIC API ===
    return {
        init, getClient, getStudentId, getStudentConfig,
        STUDENTS, SUPABASE_URL,
        toDateStr, isToday, isTomorrow, formatRelativeDate,
        checkOffHomework, uncheckHomework,
        toggleMission, saveProgress, loadProgress,
        switchTab
    };
})();
