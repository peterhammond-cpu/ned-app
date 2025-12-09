// ==========================================
// NEWSLETTER PARSER - UI Component
// For parents to paste school emails
// ==========================================

class NewsletterParser {
    constructor(options = {}) {
        this.studentId = options.studentId;
        this.studentGrade = options.studentGrade || '7';  // Default grade for this student
        this.apiEndpoint = '/.netlify/functions/parse-newsletter';
        this.elements = {};
        this.isProcessing = false;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="newsletter-parser">
                <div class="parser-header">
                    <h3>📧 Add School Events</h3>
                    <p>Paste a school newsletter or upload a screenshot</p>
                    <button class="parser-close" id="parser-close">×</button>
                </div>

                <div class="parser-content">
                    <div class="parser-tabs">
                        <button class="parser-tab active" data-tab="text">Paste Text</button>
                        <button class="parser-tab" data-tab="image">Upload Image</button>
                    </div>

                    <div class="parser-tab-content active" id="text-tab">
                        <textarea
                            id="newsletter-text"
                            placeholder="Paste the school newsletter or email here..."
                            rows="10"
                        ></textarea>
                    </div>

                    <div class="parser-tab-content" id="image-tab">
                        <div class="image-upload-area" id="image-upload-area">
                            <span>📷</span>
                            <p>Click to upload or drag image here</p>
                            <input type="file" id="newsletter-image" accept="image/*" />
                        </div>
                        <div class="image-preview" id="image-preview" style="display:none;">
                            <img id="preview-img" src="" alt="Preview" />
                            <button class="remove-image" id="remove-image">×</button>
                        </div>
                    </div>

                    <button class="parser-submit" id="parser-submit">
                        <span id="submit-text">Find Events</span>
                        <span id="submit-loading" style="display:none;">Processing...</span>
                    </button>
                </div>

                <div class="parser-results" id="parser-results" style="display:none;">
                    <h4>Found Events:</h4>
                    <div id="events-list"></div>
                    <button class="parser-done" id="parser-done">Done</button>
                </div>
            </div>
        `;

        this.elements = {
            container: container.querySelector('.newsletter-parser'),
            closeBtn: document.getElementById('parser-close'),
            textTab: document.querySelector('[data-tab="text"]'),
            imageTab: document.querySelector('[data-tab="image"]'),
            textContent: document.getElementById('text-tab'),
            imageContent: document.getElementById('image-tab'),
            textarea: document.getElementById('newsletter-text'),
            fileInput: document.getElementById('newsletter-image'),
            uploadArea: document.getElementById('image-upload-area'),
            imagePreview: document.getElementById('image-preview'),
            previewImg: document.getElementById('preview-img'),
            removeImage: document.getElementById('remove-image'),
            submitBtn: document.getElementById('parser-submit'),
            submitText: document.getElementById('submit-text'),
            submitLoading: document.getElementById('submit-loading'),
            results: document.getElementById('parser-results'),
            eventsList: document.getElementById('events-list'),
            doneBtn: document.getElementById('parser-done')
        };

        this.pendingImage = null;
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Close button
        this.elements.closeBtn.addEventListener('click', () => this.hide());

        // Tab switching
        this.elements.textTab.addEventListener('click', () => this.switchTab('text'));
        this.elements.imageTab.addEventListener('click', () => this.switchTab('image'));

        // File input
        this.elements.uploadArea.addEventListener('click', () => {
            this.elements.fileInput.click();
        });

        this.elements.fileInput.addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });

        // Drag and drop
        this.elements.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.add('dragover');
        });

        this.elements.uploadArea.addEventListener('dragleave', () => {
            this.elements.uploadArea.classList.remove('dragover');
        });

        this.elements.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.processFile(file);
        });

        // Remove image
        this.elements.removeImage.addEventListener('click', () => {
            this.clearImage();
        });

        // Submit
        this.elements.submitBtn.addEventListener('click', () => this.submit());
    }

    switchTab(tab) {
        this.elements.textTab.classList.toggle('active', tab === 'text');
        this.elements.imageTab.classList.toggle('active', tab === 'image');
        this.elements.textContent.classList.toggle('active', tab === 'text');
        this.elements.imageContent.classList.toggle('active', tab === 'image');
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (file) this.processFile(file);
    }

    processFile(file) {
        if (file.size > 5 * 1024 * 1024) {
            alert('Image too large! Please use an image under 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.pendingImage = {
                base64: e.target.result.split(',')[1],
                mediaType: file.type
            };
            this.elements.previewImg.src = e.target.result;
            this.elements.uploadArea.style.display = 'none';
            this.elements.imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    clearImage() {
        this.pendingImage = null;
        this.elements.previewImg.src = '';
        this.elements.uploadArea.style.display = 'flex';
        this.elements.imagePreview.style.display = 'none';
        this.elements.fileInput.value = '';
    }

    async submit() {
        if (this.isProcessing) return;

        const text = this.elements.textarea.value.trim();
        const hasImage = this.pendingImage !== null;

        if (!text && !hasImage) {
            alert('Please paste newsletter text or upload an image.');
            return;
        }

        this.isProcessing = true;
        this.elements.submitText.style.display = 'none';
        this.elements.submitLoading.style.display = 'inline';
        this.elements.submitBtn.disabled = true;

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text || null,
                    image: hasImage ? this.pendingImage : null,
                    studentId: this.studentId,
                    studentGrade: this.studentGrade  // Pass grade to backend
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showResults(data.events);
            } else {
                alert('Could not parse newsletter. Try again or paste as text.');
            }
        } catch (error) {
            console.error('Parse error:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            this.isProcessing = false;
            this.elements.submitText.style.display = 'inline';
            this.elements.submitLoading.style.display = 'none';
            this.elements.submitBtn.disabled = false;
        }
    }

    showResults(events) {
        this.elements.results.style.display = 'block';
        this.parsedEvents = events; // Store for saving

        if (events.length === 0) {
            this.elements.eventsList.innerHTML = `
                <p class="no-events">No student-relevant events found in this newsletter.</p>
            `;
            this.elements.doneBtn.textContent = 'Done';
            this.elements.doneBtn.onclick = () => this.hide();
        } else {
            this.elements.eventsList.innerHTML = events.map((e, i) => `
                <div class="parsed-event ${e.event_type}">
                    <input type="checkbox" class="event-checkbox" data-index="${i}" checked />
                    <div class="event-date">${this.formatDate(e.event_date)}</div>
                    <div class="event-info">
                        <strong>${e.title}</strong>
                        ${e.grade ? `<span class="grade-tag">Grade ${e.grade}</span>` : ''}
                        ${e.description ? `<p>${e.description}</p>` : ''}
                        ${e.action_required ? `<span class="action-tag">⚡ ${e.action_text}</span>` : ''}
                    </div>
                </div>
            `).join('');

            // Change button to Save Selected
            this.elements.doneBtn.textContent = 'Save Selected';
            this.elements.doneBtn.onclick = () => this.saveSelected();
        }

        // Clear inputs
        this.elements.textarea.value = '';
        this.clearImage();
    }

    async saveSelected() {
        const checkboxes = this.elements.eventsList.querySelectorAll('.event-checkbox:checked');
        const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
        const selectedEvents = selectedIndices.map(i => this.parsedEvents[i]);

        if (selectedEvents.length === 0) {
            this.hide();
            return;
        }

        this.elements.doneBtn.textContent = 'Saving...';
        this.elements.doneBtn.disabled = true;

        try {
            // Save to Supabase using the existing client
            const eventsToInsert = selectedEvents.map(e => ({
                student_id: this.studentId,
                event_date: e.event_date,
                event_type: e.event_type,
                title: e.title,
                description: e.description || null,
                action_required: e.action_required || false,
                action_text: e.action_text || null,
                grade: e.grade || this.studentGrade,  // Use parsed grade or default to student's grade
                source: 'email'
            }));

            const { error } = await supabase
                .from('school_events')
                .upsert(eventsToInsert, {
                    onConflict: 'student_id,event_date,title',
                    ignoreDuplicates: true
                });

            if (error) {
                console.error('Error saving events:', error);
                alert('Failed to save events. Try again.');
                this.elements.doneBtn.textContent = 'Save Selected';
                this.elements.doneBtn.disabled = false;
                return;
            }

            alert(`✅ Saved ${selectedEvents.length} event(s)!`);
            this.hide();

            // Refresh the page to show new events (or trigger a refresh function)
            if (typeof loadSchoolEvents === 'function') {
                loadSchoolEvents();
            }
        } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save events. Try again.');
            this.elements.doneBtn.textContent = 'Save Selected';
            this.elements.doneBtn.disabled = false;
        }
    }

    formatDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }

    show() {
        this.elements.container.classList.add('visible');
        this.elements.results.style.display = 'none';
    }

    hide() {
        this.elements.container.classList.remove('visible');
    }

    toggle() {
        this.elements.container.classList.toggle('visible');
    }
}

window.NewsletterParser = NewsletterParser;
