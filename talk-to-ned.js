// ==========================================
// TALK TO NED - AI Tutor Frontend Component
// Voice interface for homework help
// ==========================================

class TalkToNed {
    constructor(options = {}) {
        this.studentId = options.studentId || null;
        this.studentName = options.studentName || 'Willy';
        this.apiEndpoint = '/.netlify/functions/ask-ned';
        
        // Conversation state
        this.sessionId = this.generateSessionId();
        this.conversationHistory = [];
        this.isListening = false;
        this.isProcessing = false;
        
        // Speech recognition setup
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.setupSpeechRecognition();
        
        // DOM elements (set after render)
        this.elements = {};
    }

    generateSessionId() {
        return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported in this browser');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateMicButton(true);
            this.setStatus('Listening...');
        };

        this.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join('');
            
            this.elements.input.value = transcript;
            
            // If final result, auto-send
            if (event.results[0].isFinal) {
                this.sendMessage(transcript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.updateMicButton(false);
            
            if (event.error === 'not-allowed') {
                this.setStatus('Mic access denied. Click to try again.');
            } else {
                this.setStatus('Voice error. Try typing instead.');
            }
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateMicButton(false);
        };
    }

    // Render the chat UI
    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Container not found:', containerId);
            return;
        }

        container.innerHTML = `
            <div class="ned-chat-container">
                <div class="ned-chat-header">
                    <div class="ned-avatar">🎯</div>
                    <div class="ned-header-info">
                        <h3>Talk to Ned</h3>
                        <span class="ned-status" id="ned-status">Ready to help!</span>
                    </div>
                    <button class="ned-close-btn" id="ned-close" title="Close">×</button>
                </div>
                
                <div class="ned-messages" id="ned-messages">
                    <div class="ned-message ned-message-assistant">
                        <div class="ned-message-content">
                            Hey ${this.studentName}! 👋 Need help with homework? Just ask me anything - I'm here to help you figure it out (not give you the answers though! 😄). What are you working on?
                        </div>
                    </div>
                </div>
                
                <div class="ned-input-area">
                    <button class="ned-mic-btn" id="ned-mic" title="Voice input">
                        <span class="mic-icon">🎤</span>
                        <span class="mic-waves"></span>
                    </button>
                    <input 
                        type="text" 
                        id="ned-input" 
                        placeholder="Type or tap mic to talk..."
                        autocomplete="off"
                    />
                    <button class="ned-send-btn" id="ned-send" title="Send">
                        <span>➤</span>
                    </button>
                </div>
            </div>
        `;

        // Cache DOM elements
        this.elements = {
            container: container.querySelector('.ned-chat-container'),
            messages: document.getElementById('ned-messages'),
            input: document.getElementById('ned-input'),
            micBtn: document.getElementById('ned-mic'),
            sendBtn: document.getElementById('ned-send'),
            closeBtn: document.getElementById('ned-close'),
            status: document.getElementById('ned-status')
        };

        // Attach event listeners
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Mic button
        this.elements.micBtn.addEventListener('click', () => this.toggleVoiceInput());
        
        // Send button
        this.elements.sendBtn.addEventListener('click', () => {
            const message = this.elements.input.value.trim();
            if (message) this.sendMessage(message);
        });
        
        // Enter key
        this.elements.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const message = this.elements.input.value.trim();
                if (message) this.sendMessage(message);
            }
        });
        
        // Close button
        this.elements.closeBtn.addEventListener('click', () => this.hide());
    }

    toggleVoiceInput() {
        if (!this.recognition) {
            alert('Voice input not supported in this browser. Try Chrome!');
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    }

    updateMicButton(isActive) {
        if (isActive) {
            this.elements.micBtn.classList.add('listening');
        } else {
            this.elements.micBtn.classList.remove('listening');
        }
    }

    setStatus(message) {
        if (this.elements.status) {
            this.elements.status.textContent = message;
        }
    }

    async sendMessage(message) {
        if (this.isProcessing || !message.trim()) return;
        
        this.isProcessing = true;
        this.setStatus('Thinking...');
        
        // Clear input
        this.elements.input.value = '';
        
        // Add user message to UI
        this.addMessage(message, 'user');
        
        // Add to conversation history
        this.conversationHistory.push({ role: 'user', content: message });

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    conversationHistory: this.conversationHistory.slice(-10), // Last 10 messages
                    studentId: this.studentId,
                    studentName: this.studentName,
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();
            
            // Add Ned's response to UI
            this.addMessage(data.reply, 'assistant');
            
            // Add to conversation history
            this.conversationHistory.push({ role: 'assistant', content: data.reply });
            
            // Optionally speak the response
            // this.speak(data.reply);
            
            this.setStatus('Ready to help!');
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessage("Oops! Something went wrong. Try again?", 'assistant', true);
            this.setStatus('Error - try again');
        } finally {
            this.isProcessing = false;
        }
    }

    addMessage(content, role, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `ned-message ned-message-${role}${isError ? ' ned-error' : ''}`;
        
        messageDiv.innerHTML = `
            <div class="ned-message-content">${this.formatMessage(content)}</div>
        `;
        
        this.elements.messages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    }

    formatMessage(content) {
        // Basic markdown-like formatting
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    speak(text) {
        if (!this.synthesis) return;
        
        // Cancel any ongoing speech
        this.synthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        this.synthesis.speak(utterance);
    }

    show() {
        if (this.elements.container) {
            this.elements.container.classList.add('visible');
            this.elements.input.focus();
        }
    }

    hide() {
        if (this.elements.container) {
            this.elements.container.classList.remove('visible');
        }
    }

    toggle() {
        if (this.elements.container) {
            this.elements.container.classList.toggle('visible');
            if (this.elements.container.classList.contains('visible')) {
                this.elements.input.focus();
            }
        }
    }

    // Start a new conversation
    newSession() {
        this.sessionId = this.generateSessionId();
        this.conversationHistory = [];
        
        // Clear messages except the intro
        if (this.elements.messages) {
            this.elements.messages.innerHTML = `
                <div class="ned-message ned-message-assistant">
                    <div class="ned-message-content">
                        Hey ${this.studentName}! 👋 New conversation started. What can I help you with?
                    </div>
                </div>
            `;
        }
    }
}

// Export for use in app.js
window.TalkToNed = TalkToNed;
