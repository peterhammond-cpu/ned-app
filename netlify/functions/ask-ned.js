// ==========================================
// TALK TO NED - AI Tutor Frontend Component
// Voice + Photo interface for homework help
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
        this.pendingImage = null; // Store image to send with next message
        
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
                            Hey ${this.studentName}! 👋 Stuck on something? Tell me what's tripping you up and what you've tried so far - I'm here to help you figure it out (not give you the answers though! 😄)
                        </div>
                    </div>
                </div>
                
                <!-- Image preview area -->
                <div class="ned-image-preview" id="ned-image-preview" style="display: none;">
                    <img id="ned-preview-img" src="" alt="Preview" />
                    <button class="ned-remove-image" id="ned-remove-image" title="Remove image">×</button>
                </div>
                
                <div class="ned-input-area">
                    <button class="ned-camera-btn" id="ned-camera" title="Take photo or upload">
                        <span>📷</span>
                    </button>
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
                    
                    <!-- Hidden file input -->
                    <input 
                        type="file" 
                        id="ned-file-input" 
                        accept="image/*" 
                        capture="environment"
                        style="display: none;"
                    />
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
            status: document.getElementById('ned-status'),
            cameraBtn: document.getElementById('ned-camera'),
            fileInput: document.getElementById('ned-file-input'),
            imagePreview: document.getElementById('ned-image-preview'),
            previewImg: document.getElementById('ned-preview-img'),
            removeImageBtn: document.getElementById('ned-remove-image')
        };

        // Attach event listeners
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Mic button
        this.elements.micBtn.addEventListener('click', () => this.toggleVoiceInput());
        
        // Send button
        this.elements.sendBtn.addEventListener('click', () => {
            const message = this.elements.input.value.trim() || (this.pendingImage ? "Help me with this" : "");
            if (message || this.pendingImage) this.sendMessage(message);
        });
        
        // Enter key
        this.elements.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const message = this.elements.input.value.trim() || (this.pendingImage ? "Help me with this" : "");
                if (message || this.pendingImage) this.sendMessage(message);
            }
        });
        
        // Close button
        this.elements.closeBtn.addEventListener('click', () => this.hide());
        
        // Camera button
        this.elements.cameraBtn.addEventListener('click', () => {
            this.elements.fileInput.click();
        });
        
        // File input change
        this.elements.fileInput.addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });
        
        // Remove image button
        this.elements.removeImageBtn.addEventListener('click', () => {
            this.clearPendingImage();
        });
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image too large! Please use an image under 5MB.');
            return;
        }
        
        // Check file type
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const base64 = e.target.result;
            
            // Store the image
            this.pendingImage = {
                base64: base64,
                mediaType: file.type
            };
            
            // Show preview
            this.elements.previewImg.src = base64;
            this.elements.imagePreview.style.display = 'flex';
            
            // Update placeholder
            this.elements.input.placeholder = "What do you need help with?";
            this.elements.input.focus();
            
            this.setStatus('📸 Image ready! Ask your question.');
        };
        
        reader.onerror = () => {
            alert('Failed to read image. Please try again.');
        };
        
        reader.readAsDataURL(file);
        
        // Clear the input so the same file can be selected again
        event.target.value = '';
    }

    clearPendingImage() {
        this.pendingImage = null;
        this.elements.imagePreview.style.display = 'none';
        this.elements.previewImg.src = '';
        this.elements.input.placeholder = "Type or tap mic to talk...";
        this.setStatus('Ready to help!');
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
        if (this.isProcessing) return;
        if (!message.trim() && !this.pendingImage) return;
        
        this.isProcessing = true;
        this.setStatus('Thinking...');
        
        // Clear input
        this.elements.input.value = '';
        
        // Add user message to UI (with image if present)
        if (this.pendingImage) {
            this.addMessageWithImage(message, 'user', this.pendingImage.base64);
        } else {
            this.addMessage(message, 'user');
        }
        
        // Build the message content for the API
        let messageContent = message;
        let imageData = null;
        
        if (this.pendingImage) {
            imageData = {
                base64: this.pendingImage.base64.split(',')[1], // Remove data:image/...;base64, prefix
                mediaType: this.pendingImage.mediaType
            };
        }
        
        // Add to conversation history (text only for history)
        this.conversationHistory.push({ role: 'user', content: message || "Help me with this image" });

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message || "Help me understand this worksheet/problem",
                    image: imageData,
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
            
            this.setStatus('Ready to help!');
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessage("Oops! Something went wrong. Try again?", 'assistant', true);
            this.setStatus('Error - try again');
        } finally {
            this.isProcessing = false;
            this.clearPendingImage();
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

    addMessageWithImage(content, role, imageSrc) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `ned-message ned-message-${role}`;
        
        messageDiv.innerHTML = `
            <div class="ned-message-content">
                <img src="${imageSrc}" class="ned-message-image" alt="Uploaded image" />
                ${content ? `<p>${this.formatMessage(content)}</p>` : ''}
            </div>
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
        this.clearPendingImage();
        
        // Clear messages except the intro
        if (this.elements.messages) {
            this.elements.messages.innerHTML = `
                <div class="ned-message ned-message-assistant">
                    <div class="ned-message-content">
                        Hey ${this.studentName}! 👋 New conversation. What are you working on, and where are you stuck?
                    </div>
                </div>
            `;
        }
    }
}

// Export for use in app.js
window.TalkToNed = TalkToNed;