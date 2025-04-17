        try {
            // --- Constants & Configuration ---
            const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
            const GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // !!! Production: Use a secure method !!!
            const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            const MAX_GEMINI_HISTORY_TURNS = 8; // Max message pairs in history for Gemini

            // --- DOM Elements Cache ---
            const uiElements = {
                userAvatar: document.getElementById('user-avatar'), userName: document.getElementById('user-name'),
                mobileMenuToggle: document.getElementById('mobile-menu-toggle'), sidebar: document.getElementById('sidebar'),
                sidebarOverlay: document.getElementById('sidebar-overlay'), currentTopicDisplay: document.getElementById('current-topic-display'),
                whiteboardContainer: document.getElementById('whiteboard-container'), // Changed
                whiteboardContent: document.getElementById('whiteboard-content'), // Changed
                boardSpeakingIndicator: document.getElementById('board-speaking-indicator'), // Added
                chatMessages: document.getElementById('chat-messages'), chatInput: document.getElementById('chat-input'),
                sendButton: document.getElementById('send-button'), saveChatBtn: document.getElementById('save-chat-btn'),
                clearChatBtn: document.getElementById('clear-chat-btn'), continueBtn: document.getElementById('continue-btn'),
                markCompleteBtn: document.getElementById('mark-complete-btn'), clearBoardBtn: document.getElementById('clear-board-btn'),
                stopSpeechBtn: document.getElementById('stop-speech-btn'), // Added
                micBtn: document.getElementById('mic-btn'), // Added Microphone button
                toast: document.getElementById('toast'), toastMessage: document.getElementById('toast-message'),
                learningInterface: document.querySelector('.call-interface'), chatPanel: document.querySelector('.interaction-panel'),
                aiPresenterArea: document.querySelector('.ai-presenter-area'),
                interactionTabs: document.querySelector('.interaction-tabs'),
                chatTabContent: document.getElementById('chat-tab-content'),
                chatTabButton: document.querySelector('.interaction-tab[data-tab="chat-tab"]'),
                aiAvatarCorner: document.getElementById('ai-avatar-corner') // Reference to avatar placeholder
            };

            // --- Global State ---
            let state = {
                supabase: null, currentUser: null, currentProfile: null,
                currentTopic: null, currentPlanId: null, currentSessionId: null,
                geminiChatContext: [], // Chat history for Gemini
                geminiIsThinking: false, // Flag for waiting for Gemini response
                thinkingIndicatorId: null, // ID of the "typing" indicator
                topicLoadInProgress: false, // Flag for topic loading
                isDarkMode: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches, // Current theme
                boardContentHistory: [], // Store chunks of markdown for the board
                speechSynthesisSupported: ('speechSynthesis' in window), // Check TTS support
                czechVoice: null, // To store the Czech voice object
                speechRecognitionSupported: ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window), // Check STT support
                speechRecognition: null, // SpeechRecognition instance
                isListening: false, // Flag for STT active state
                currentlyHighlightedChunk: null // Store ref to the currently highlighted board chunk
            };

            // --- Utility Functions ---
            const sanitizeHTML = (str) => { const t = document.createElement('div'); t.textContent = str || ''; return t.innerHTML; };
            const getInitials = (p, e) => { if (!p && !e) return '?'; let i = ''; if (p?.first_name) i += p.first_name[0]; if (p?.last_name) i += p.last_name[0]; if (i) return i.toUpperCase(); if (p?.username) return p.username[0].toUpperCase(); if (e) return e[0].toUpperCase(); return 'U'; };
            const showToast = (message, type = 'info', duration = 4000) => { /* ... (no changes) ... */ if (!uiElements.toast || !uiElements.toastMessage) return; console.log(`Toast (${type}): ${message}`); uiElements.toastMessage.textContent = message; const icon = uiElements.toast.querySelector('i'); uiElements.toast.className = 'toast ' + type; icon.className = `fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; uiElements.toast.style.transition = 'none'; uiElements.toast.style.transform = 'translateX(calc(100% + 30px))'; uiElements.toast.style.opacity = '0'; void uiElements.toast.offsetWidth; uiElements.toast.style.transition = 'all 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55)'; uiElements.toast.classList.add('show'); setTimeout(() => uiElements.toast.classList.remove('show'), duration); };
            const renderMarkdown = (el, text) => { /* ... (no changes) ... */ if (!el) return; try { marked.setOptions({ gfm: true, breaks: true }); el.innerHTML = marked.parse(text || ''); // Render MathJax after markdown parsing
 if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { setTimeout(() => { window.MathJax.typesetPromise([el]).catch(e => console.error("MathJax typesetting error:", e)); }, 0); } } catch (e) { console.error("Markdown rendering error:", e); el.innerHTML = `<p style="color:red;">Chyba renderování.</p>`; } };
            const autoResizeTextarea = () => { /* ... (no changes) ... */ if (!uiElements.chatInput) return; uiElements.chatInput.style.height = 'auto'; const sh = uiElements.chatInput.scrollHeight; const mh = 110; uiElements.chatInput.style.height = `${Math.min(sh, mh)}px`; uiElements.chatInput.style.overflowY = sh > mh ? 'scroll' : 'hidden'; };
            const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            const formatTimestamp = (d = new Date()) => d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
            // Returns the board background color based on theme
            const getBoardBackgroundColor = () => state.isDarkMode ? 'var(--board-bg-dark)' : 'var(--board-bg-light)';
            // Returns the element color (including text) based on theme
            const getElementColor = () => state.isDarkMode ? 'var(--board-text-dark)' : 'var(--board-text-light)';
            // Safe access to value, similar to ??
            const fallback = (value, def) => (value !== null && value !== undefined) ? value : def;

            // --- TTS Functions ---
            const loadVoices = () => {
                if (!state.speechSynthesisSupported) return;
                try {
                    const voices = window.speechSynthesis.getVoices();
                    if (!voices || voices.length === 0) {
                        console.warn("No voices available yet or API error.");
                        return; // Wait for voiceschanged event
                    }
                    console.log('Available voices:', voices.map(v => ({ name: v.name, lang: v.lang, default: v.default })));

                    // 1. Try to find a Czech voice marked as female first
                    let preferredVoice = voices.find(voice => voice.lang === 'cs-CZ' && /female|žena|ženský|iveta|zuzana/i.test(voice.name));

                    // 2. If not found, find any Czech voice
                    if (!preferredVoice) {
                        preferredVoice = voices.find(voice => voice.lang === 'cs-CZ');
                    }
                    // 3. If still not found, fallback to any Czech-related
                    if (!preferredVoice) {
                        preferredVoice = voices.find(voice => voice.lang.startsWith('cs'));
                    }
                     // 4. If still none, use browser default (might not be Czech)
                     if (!preferredVoice) {
                         preferredVoice = voices.find(v => v.default) || voices[0];
                     }

                    state.czechVoice = preferredVoice;
                    console.log("Selected voice:", state.czechVoice?.name, state.czechVoice?.lang);
                } catch (e) {
                    console.error("Error loading voices:", e);
                    state.czechVoice = null; // Reset on error
                }
            };

            // Function to remove highlight from currently highlighted chunk
            const removeBoardHighlight = () => {
                if (state.currentlyHighlightedChunk) {
                    state.currentlyHighlightedChunk.classList.remove('speaking-highlight');
                    state.currentlyHighlightedChunk = null;
                }
            };

            const speakText = (text, targetChunkElement = null) => { // Added targetChunkElement
                if (!state.speechSynthesisSupported) {
                    showToast("Syntéza řeči není podporována v tomto prohlížeči.", "warning");
                    return;
                }
                if (!text) {
                    console.warn("TTS: No text provided to speak.");
                    return;
                }

                // Clean text for speech
                const plainText = text
                    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
                    .replace(/[`*#_~[\]()]/g, '') // Remove common markdown chars
                    .replace(/\$\$(.*?)\$\$/g, 'matematický vzorec') // Replace display math
                    .replace(/\$(.*?)\$/g, 'vzorec') // Replace inline math
                    .replace(/\s+/g, ' ') // Collapse multiple whitespace
                    .trim();

                if (!plainText) {
                    console.warn("TTS: Text is empty after cleaning.");
                    return;
                }

                window.speechSynthesis.cancel(); // Stop any previous speech
                removeBoardHighlight(); // Remove previous highlight

                const utterance = new SpeechSynthesisUtterance(plainText);
                utterance.lang = 'cs-CZ';
                utterance.rate = 0.9; // Slightly slower
                utterance.pitch = 1.0; // Neutral pitch

                if (state.czechVoice) {
                    utterance.voice = state.czechVoice;
                } else {
                    loadVoices(); // Attempt to load voices again
                    if (state.czechVoice) {
                         utterance.voice = state.czechVoice;
                    } else {
                        console.warn("Czech voice not found, using default.");
                    }
                }

                utterance.onstart = () => {
                    console.log("TTS started.");
                    if (uiElements.aiAvatarCorner) uiElements.aiAvatarCorner.classList.add('speaking');
                    if (uiElements.boardSpeakingIndicator) uiElements.boardSpeakingIndicator.classList.add('active');
                    // Highlight the target chunk if provided
                    if (targetChunkElement) {
                        targetChunkElement.classList.add('speaking-highlight');
                        state.currentlyHighlightedChunk = targetChunkElement;
                    }
                };
                utterance.onend = () => {
                    console.log("TTS finished.");
                     if (uiElements.aiAvatarCorner) uiElements.aiAvatarCorner.classList.remove('speaking');
                     if (uiElements.boardSpeakingIndicator) uiElements.boardSpeakingIndicator.classList.remove('active');
                     removeBoardHighlight(); // Remove highlight on end
                };
                utterance.onerror = (event) => {
                    console.error('SpeechSynthesisUtterance.onerror', event);
                    showToast(`Chyba při čtení: ${event.error}`, 'error');
                     if (uiElements.aiAvatarCorner) uiElements.aiAvatarCorner.classList.remove('speaking');
                     if (uiElements.boardSpeakingIndicator) uiElements.boardSpeakingIndicator.classList.remove('active');
                     removeBoardHighlight(); // Remove highlight on error
                };

                console.log(`TTS: Speaking with voice: ${utterance.voice?.name}, lang: ${utterance.lang}, rate: ${utterance.rate}, pitch: ${utterance.pitch}`);
                window.speechSynthesis.speak(utterance);
            };

            const stopSpeech = () => {
                if (state.speechSynthesisSupported) {
                    window.speechSynthesis.cancel();
                    if (uiElements.aiAvatarCorner) uiElements.aiAvatarCorner.classList.remove('speaking');
                    if (uiElements.boardSpeakingIndicator) uiElements.boardSpeakingIndicator.classList.remove('active');
                    removeBoardHighlight(); // Remove highlight on stop
                    console.log("Speech cancelled.");
                }
            };

            // --- STT (Speech-to-Text) Functions ---
            const initializeSpeechRecognition = () => {
                if (!state.speechRecognitionSupported) {
                    console.warn("Speech Recognition not supported in this browser.");
                    if(uiElements.micBtn) {
                        uiElements.micBtn.disabled = true;
                        uiElements.micBtn.title = "Rozpoznávání řeči není podporováno";
                    }
                    return;
                }

                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                state.speechRecognition = new SpeechRecognition();
                state.speechRecognition.lang = 'cs-CZ';
                state.speechRecognition.interimResults = false; // We want final results
                state.speechRecognition.maxAlternatives = 1;
                state.speechRecognition.continuous = false; // Stop after first utterance

                state.speechRecognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    console.log('Speech recognized:', transcript);
                    if (uiElements.chatInput) {
                        uiElements.chatInput.value = transcript;
                        autoResizeTextarea(); // Adjust textarea size
                        // Automatically send message after recognition?
                        // handleSendMessage();
                    }
                };

                state.speechRecognition.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);
                    let errorMsg = "Chyba rozpoznávání řeči";
                    if (event.error === 'no-speech') {
                        errorMsg = "Nerozpoznal jsem žádnou řeč.";
                    } else if (event.error === 'audio-capture') {
                        errorMsg = "Chyba mikrofonu.";
                    } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                        errorMsg = "Přístup k mikrofonu zamítnut.";
                         if(uiElements.micBtn) uiElements.micBtn.disabled = true; // Disable permanently if denied
                    }
                    showToast(errorMsg, 'error');
                    stopListening(); // Ensure state is reset
                };

                state.speechRecognition.onend = () => {
                    console.log('Speech recognition ended.');
                    stopListening(); // Ensure state and UI are reset
                };

                 state.speechRecognition.onaudiostart = () => console.log('Audio capture started.');
                 state.speechRecognition.onaudioend = () => console.log('Audio capture ended.');
                 state.speechRecognition.onspeechstart = () => console.log('Speech detected.');
                 state.speechRecognition.onspeechend = () => console.log('Speech ended.');

                console.log("Speech Recognition initialized.");
            };

            const startListening = () => {
                if (!state.speechRecognitionSupported || !state.speechRecognition || state.isListening) return;
                // Request microphone permission explicitly before starting if needed (optional, browsers might handle it)
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(() => {
                        try {
                            state.speechRecognition.start();
                            state.isListening = true;
                            if(uiElements.micBtn) uiElements.micBtn.classList.add('listening');
                            if(uiElements.micBtn) uiElements.micBtn.title = "Zastavit hlasový vstup"; // Stop voice input
                            console.log('Speech recognition started.');
                        } catch (e) {
                            console.error("Error starting speech recognition:", e);
                            showToast("Nepodařilo se spustit rozpoznávání.", "error");
                            stopListening(); // Reset state
                        }
                    })
                    .catch(err => {
                         console.error("Microphone access denied:", err);
                         showToast("Přístup k mikrofonu je nutný pro hlasový vstup.", "warning");
                         if(uiElements.micBtn) uiElements.micBtn.disabled = true; // Disable if denied
                         stopListening();
                    });
            };

            const stopListening = () => {
                if (!state.speechRecognitionSupported || !state.speechRecognition || !state.isListening) return;
                try {
                    state.speechRecognition.stop();
                } catch (e) {
                    // Ignore errors here, as it might be called multiple times on end/error
                } finally {
                    state.isListening = false;
                    if(uiElements.micBtn) uiElements.micBtn.classList.remove('listening');
                    if(uiElements.micBtn) uiElements.micBtn.title = "Zahájit hlasový vstup"; // Start voice input
                    console.log('Speech recognition stopped.');
                }
            };

            const handleMicClick = () => {
                if (!state.speechRecognitionSupported) {
                    showToast("Rozpoznávání řeči není podporováno.", "warning");
                    return;
                }
                if (state.isListening) {
                    stopListening();
                } else {
                    startListening();
                }
            };


            // --- Initialization ---
            const initializeSupabase = () => { /* ... (no changes) ... */ try { if (!window.supabase) throw new Error("Supabase library not loaded."); state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); if (!state.supabase) throw new Error("Client creation failed."); console.log("Supabase initialized."); return true; } catch (error) { console.error("Supabase init failed:", error); showToast("Chyba DB.", "error", 10000); return false; } };
            const initializeUI = () => { try { // No Excalidraw/Canvas init needed
 setupEventListeners(); initTooltips(); // Ensure only chat tab is visible/active
 if(uiElements.chatTabButton) uiElements.chatTabButton.classList.add('active'); if(uiElements.chatTabContent) uiElements.chatTabContent.classList.add('active'); if(uiElements.chatTabButton) uiElements.chatTabButton.style.flex = 'none'; // Make chat tab take full width if it's the only one
 updateTheme(); // Set initial theme for whiteboard div
 // Load voices for TTS
 if (state.speechSynthesisSupported) { // Load voices immediately if available
 if (window.speechSynthesis.getVoices().length > 0) { loadVoices(); } else if (window.speechSynthesis.onvoiceschanged !== undefined) { // Otherwise wait for the event
 window.speechSynthesis.onvoiceschanged = loadVoices; } } else { console.warn("Speech Synthesis not supported."); } // Initialize Speech Recognition
 initializeSpeechRecognition(); manageUIState('initial'); return true; } catch(error) { console.error("UI Init failed:", error); showToast(`Chyba UI: ${error.message}`, "error", 10000); return false; }};
            const initializeApp = async () => { /* ... (no changes) ... */ console.log("DOM Loaded. Initializing Board Tutor..."); if (!initializeSupabase()) return; if (!initializeUI()) return; manageUIState('loadingUser'); try { await loadUserProfile(); if (state.currentUser) { await loadNextUncompletedTopic(); } else { handleLoggedOutUser(); } } catch (error) { console.error("App initialization error:", error); manageUIState('error'); showToast("Chyba při startu aplikace.", "error"); }};

            // --- UI State & Button Management ---
            const manageUIState = (mode, options = {}) => { /* ... (Simplified) ... */ console.log("UI State:", mode, options); const isLearning = ['learning', 'chatting', 'requestingExplanation'].includes(mode); const showLearningInterface = !!state.currentTopic || mode === 'loadingTopic' || mode === 'requestingExplanation' || mode === 'noPlan' || mode === 'planComplete' || mode === 'error'; if (uiElements.learningInterface) uiElements.learningInterface.style.display = showLearningInterface ? 'flex' : 'none'; if (uiElements.chatMessages && !isLearning && mode !== 'loadingUser') { let emptyStateHTML = ''; switch (mode) { case 'initial': case 'loadingUser': emptyStateHTML = "<div class='empty-state'><i class='fas fa-user-circle'></i><h3>Načítání...</h3></div>"; break; case 'loggedOut': emptyStateHTML = "<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>Nejste přihlášeni</h3></div>"; break; case 'noPlan': emptyStateHTML = "<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>Žádný aktivní plán</h3><p>Nejprve prosím dokončete diagnostický test v sekci Procvičování.</p></div>"; break; case 'planComplete': emptyStateHTML = "<div class='empty-state'><i class='fas fa-check-circle'></i><h3>Plán dokončen!</h3><p>Všechny naplánované aktivity jsou hotové.</p></div>"; break; case 'error': emptyStateHTML = "<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><h3>Chyba</h3><p>Nastala chyba při načítání dat.</p></div>"; break; default: emptyStateHTML = ''; } if (emptyStateHTML || uiElements.chatMessages.children.length === 0 || ['loggedOut', 'noPlan', 'planComplete', 'error'].includes(mode)) { uiElements.chatMessages.innerHTML = emptyStateHTML; } } manageButtonStates(); };
            const manageButtonStates = () => { /* ... (Simplified, added mic button state) ... */ const canInteractNormally = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress; if (uiElements.sendButton) { uiElements.sendButton.disabled = !canInteractNormally; uiElements.sendButton.innerHTML = state.geminiIsThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>'; } if (uiElements.continueBtn) { uiElements.continueBtn.disabled = !canInteractNormally; uiElements.continueBtn.style.display = canInteractNormally ? 'inline-flex' : 'none'; } if (uiElements.markCompleteBtn) { uiElements.markCompleteBtn.disabled = !canInteractNormally; uiElements.markCompleteBtn.style.display = canInteractNormally ? 'inline-flex' : 'none'; } if (uiElements.chatInput) { uiElements.chatInput.disabled = !canInteractNormally; } if (uiElements.clearBoardBtn) { uiElements.clearBoardBtn.disabled = !uiElements.whiteboardContent || state.geminiIsThinking; } // Mic button state
 if (uiElements.micBtn) { uiElements.micBtn.disabled = !canInteractNormally || !state.speechRecognitionSupported || state.isListening; // Disable if not supported or already listening
 uiElements.micBtn.classList.toggle('listening', state.isListening); uiElements.micBtn.title = state.isListening ? "Zastavit hlasový vstup" : "Zahájit hlasový vstup"; } };

             // --- Whiteboard Div Functions ---
            const updateTheme = () => {
                console.log("Updating theme, isDarkMode:", state.isDarkMode);
                if (uiElements.whiteboardContainer) {
                    uiElements.whiteboardContainer.style.backgroundColor = getBoardBackgroundColor();
                    uiElements.whiteboardContainer.style.borderColor = state.isDarkMode ? 'var(--board-border-dark)' : 'var(--board-border-light)';
                    uiElements.whiteboardContainer.style.color = state.isDarkMode ? 'var(--board-text-dark)' : 'var(--board-text-light)';
                }
                 // Update highlight class based on theme
                 const highlightClass = state.isDarkMode ? 'speaking-highlight-dark' : 'speaking-highlight-light';
                 const otherHighlightClass = state.isDarkMode ? 'speaking-highlight-light' : 'speaking-highlight-dark';
                 document.documentElement.style.setProperty('--board-highlight-color', state.isDarkMode ? 'var(--board-highlight-dark)' : 'var(--board-highlight-light)'); // Set CSS variable
                 if (state.currentlyHighlightedChunk) {
                     state.currentlyHighlightedChunk.classList.remove(otherHighlightClass);
                     state.currentlyHighlightedChunk.classList.add(highlightClass);
                 }

            };

            const clearWhiteboard = (showToastMsg = true) => {
                if (!uiElements.whiteboardContent) return;
                uiElements.whiteboardContent.innerHTML = ''; // Clear content
                state.boardContentHistory = []; // Clear history
                console.log("Whiteboard cleared.");
                if (showToastMsg) showToast("Tabule vymazána.", "info");
            };

            // Updated to store commentary text in button and handle highlight
            const appendToWhiteboard = (markdownContent, commentaryText) => {
                if (!uiElements.whiteboardContent || !uiElements.whiteboardContainer) return;
                const chunkDiv = document.createElement('div');
                chunkDiv.className = 'whiteboard-chunk'; // Add a class for potential future styling/separation

                // Create content div
                const contentDiv = document.createElement('div');
                renderMarkdown(contentDiv, markdownContent); // Render markdown into the content div

                // Create TTS button
                const ttsButton = document.createElement('button');
                ttsButton.className = 'tts-listen-btn btn-tooltip';
                ttsButton.title = 'Poslechnout komentář'; // Tooltip text
                ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
                // Store the COMMENTARY text for speaking, fallback to markdown if commentary is missing
                const textForSpeech = commentaryText || markdownContent;
                ttsButton.dataset.textToSpeak = textForSpeech;

                // Add click listener specifically for this button to handle highlighting
                if (state.speechSynthesisSupported) {
                    ttsButton.addEventListener('click', () => {
                        speakText(textForSpeech, chunkDiv); // Pass the chunk element
                    });
                }

                // Append content and button to the chunk div
                chunkDiv.appendChild(contentDiv);
                if (state.speechSynthesisSupported) { // Only add button if supported
                    chunkDiv.appendChild(ttsButton);
                }

                uiElements.whiteboardContent.appendChild(chunkDiv); // Append the new chunk
                state.boardContentHistory.push(markdownContent); // Store the markdown chunk

                // Scroll to the bottom of the whiteboard container
                uiElements.whiteboardContainer.scrollTop = uiElements.whiteboardContainer.scrollHeight;
                console.log("Appended content to whiteboard.");
                initTooltips(); // Re-initialize tooltips for the new button
            };


            // --- User Profile & Auth --- (No changes)
            const loadUserProfile = async () => { if (!state.supabase) return; try { const { data: { user } } = await state.supabase.auth.getUser(); if (user) { state.currentUser = user; const { data: profile } = await state.supabase.from('profiles').select('*').eq('id', user.id).single(); state.currentProfile = profile; // Fetch skill_level here if available
 // state.skillLevel = profile?.skill_level || 'beginner'; // Example
 console.log("User profile loaded:", state.currentProfile); } else { state.currentUser = null; state.currentProfile = null; } } catch (error) { console.error('Error loading profile:', error); state.currentUser = null; state.currentProfile = null; showToast("Chyba načítání profilu.", "error"); } finally { updateUserInfoUI(); } };
            const updateUserInfoUI = () => { if (uiElements.userName && uiElements.userAvatar) { if (state.currentUser) { const email = state.currentUser.email; const initials = getInitials(state.currentProfile, email); const name = `${state.currentProfile?.first_name || ''} ${state.currentProfile?.last_name || ''}`.trim() || state.currentProfile?.username || email?.split('@')[0] || 'Uživatel'; uiElements.userName.textContent = name; uiElements.userAvatar.innerHTML = state.currentProfile?.avatar_url ? `<img src="${state.currentProfile.avatar_url}" alt="${initials}">` : initials; } else { uiElements.userName.textContent = 'Nepřihlášen'; uiElements.userAvatar.innerHTML = '?'; } } };
            const handleLoggedOutUser = () => { console.warn("User not logged in."); if (uiElements.currentTopicDisplay) uiElements.currentTopicDisplay.innerHTML = '<span class="placeholder">Nejste přihlášeni</span>'; showToast("Prosím, přihlaste se.", "warning"); manageUIState('loggedOut'); };

            // --- Event Listeners Setup --- (Added Mic listener)
            const setupEventListeners = () => {
                 console.log("Setting up event listeners...");
                 if (uiElements.mobileMenuToggle) uiElements.mobileMenuToggle.addEventListener('click', (e) => { e.stopPropagation(); uiElements.sidebar?.classList.toggle('active'); uiElements.sidebarOverlay?.classList.toggle('active'); });
                 if (uiElements.sidebarOverlay) uiElements.sidebarOverlay.addEventListener('click', () => { uiElements.sidebar?.classList.remove('active'); uiElements.sidebarOverlay?.classList.remove('active'); });
                 if (uiElements.chatInput) uiElements.chatInput.addEventListener('input', autoResizeTextarea);
                 if (uiElements.sendButton) uiElements.sendButton.addEventListener('click', () => { handleSendMessage(); }); // Ensure it calls the correct function
                 if (uiElements.chatInput) uiElements.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }); // Ensure it calls the correct function
                 if (uiElements.clearChatBtn) uiElements.clearChatBtn.addEventListener('click', confirmClearChat);
                 if (uiElements.saveChatBtn) uiElements.saveChatBtn.addEventListener('click', saveChatToPDF);
                 if (uiElements.continueBtn) uiElements.continueBtn.addEventListener('click', requestContinue);
                 if (uiElements.markCompleteBtn) uiElements.markCompleteBtn.addEventListener('click', handleMarkTopicComplete);
                 if (uiElements.clearBoardBtn) uiElements.clearBoardBtn.addEventListener('click', () => clearWhiteboard(true));
                 if (uiElements.stopSpeechBtn) uiElements.stopSpeechBtn.addEventListener('click', stopSpeech);
                 if (uiElements.micBtn) uiElements.micBtn.addEventListener('click', handleMicClick); // Added Mic button listener

                 // Event delegation for TTS buttons in chat
                 if (uiElements.chatMessages) {
                     uiElements.chatMessages.addEventListener('click', (event) => {
                         const button = event.target.closest('.tts-listen-btn');
                         if (button) {
                             const text = button.dataset.textToSpeak;
                             if (text) { speakText(text); } // Don't highlight chat messages
                             else { console.warn("No text found for TTS button in chat."); }
                         }
                     });
                 }
                 // Event delegation for TTS buttons on whiteboard (now handled in appendToWhiteboard)
                 // We keep this structure in case we add other clickable elements later
                  if (uiElements.whiteboardContent) {
                     uiElements.whiteboardContent.addEventListener('click', (event) => {
                          // Find the button if clicked directly or its parent if icon is clicked
                         const button = event.target.closest('.tts-listen-btn');
                         if (button) {
                              // The actual speaking logic is now attached directly to the button
                              console.log("Whiteboard TTS button clicked (handled by direct listener).");
                         }
                     });
                 }


                 window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
                     state.isDarkMode = event.matches;
                     console.log("Theme changed, isDarkMode:", state.isDarkMode);
                     updateTheme(); // Update whiteboard theme
                 });
                 window.addEventListener('resize', () => { if (window.innerWidth > 992) { uiElements.sidebar?.classList.remove('active'); uiElements.sidebarOverlay?.classList.remove('active'); } });
             };
            const initTooltips = () => { /* ... (no changes) ... */ try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Tooltipster error:", e); } };

             // --- Topic Loading and Progress --- (No changes)
            const loadNextUncompletedTopic = async () => { if (!state.currentUser || state.topicLoadInProgress || !state.supabase) return; state.topicLoadInProgress = true; state.currentTopic = null; if (uiElements.chatMessages) uiElements.chatMessages.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>Načítám další téma...</h3></div>'; clearWhiteboard(false); // Clear whiteboard for new topic
 state.geminiChatContext = []; if (uiElements.currentTopicDisplay) uiElements.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Hledám...</span>'; manageUIState('loadingTopic'); try { const { data: plans } = await state.supabase.from('study_plans').select('id').eq('user_id', state.currentUser.id).eq('status', 'active').limit(1); if (!plans || plans.length === 0) { manageUIState('noPlan'); return; } state.currentPlanId = plans[0].id; const { data: activities } = await state.supabase.from('plan_activities').select('id, title, description, topic_id').eq('plan_id', state.currentPlanId).eq('completed', false).order('day_of_week').order('time_slot').limit(1); if (activities && activities.length > 0) { const activity = activities[0]; let name = activity.title || 'N/A', desc = activity.description || ''; if (activity.topic_id) { try { const { data: topic } = await state.supabase.from('exam_topics').select('name, description').eq('id', activity.topic_id).single(); if (topic) { name = topic.name || name; desc = topic.description || desc; } } catch(e){ console.warn("Could not fetch topic details", e) } } state.currentTopic = { activity_id: activity.id, plan_id: state.currentPlanId, name, description: desc, user_id: state.currentUser.id, topic_id: activity.topic_id }; if (uiElements.currentTopicDisplay) uiElements.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(name)}</strong>`; await startLearningSession(); } else { manageUIState('planComplete'); } } catch (error) { console.error('Error loading topic:', error); showToast(`Chyba: ${error.message}`, "error"); manageUIState('error'); } finally { state.topicLoadInProgress = false; manageButtonStates(); } };
            const handleMarkTopicComplete = async () => { /* ... (no changes) ... */ if (!state.currentTopic || !state.supabase || state.topicLoadInProgress) return; state.topicLoadInProgress = true; manageButtonStates(); try { await state.supabase.from('plan_activities').update({ completed: true, updated_at: new Date().toISOString() }).eq('id', state.currentTopic.activity_id); showToast(`Téma "${state.currentTopic.name}" dokončeno.`, "success"); await loadNextUncompletedTopic(); } catch (error) { console.error(`Error marking complete:`, error); showToast("Chyba při označování tématu.", "error"); state.topicLoadInProgress = false; manageButtonStates(); } };

            // --- Learning Session & Chat --- (Updated prompts & send logic)
            const startLearningSession = async () => { if (!state.currentTopic) return; state.currentSessionId = generateSessionId(); manageUIState('requestingExplanation'); const prompt = _buildInitialPrompt(); await sendToGemini(prompt); };
            const requestContinue = async () => { if (state.geminiIsThinking || !state.currentTopic) return; const prompt = _buildContinuePrompt(); await sendToGemini(prompt); };
            // Updated addChatMessage to include TTS button
            const addChatMessage = async (message, sender, saveToDb = true, timestamp = new Date(), ttsText = null) => {
                 // The ttsText parameter is added to potentially store a different text for TTS
                 if (!uiElements.chatMessages) return;
                 const id = `msg-${Date.now()}`;
                 const avatar = sender === 'user' ? getInitials(state.currentProfile, state.currentUser?.email) : 'AI';
                 const div = document.createElement('div');
                 div.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`;
                 div.id = id;

                 const avatarDiv = `<div class="message-avatar">${avatar}</div>`;
                 const bubbleDiv = document.createElement('div');
                 bubbleDiv.className = 'message-bubble';

                 // Create content wrapper
                 const bubbleContentDiv = document.createElement('div');
                 bubbleContentDiv.className = 'message-bubble-content';

                 // Create text content span
                 const textContentSpan = document.createElement('span');
                 textContentSpan.className = 'message-text-content';
                 renderMarkdown(textContentSpan, message); // Render markdown here

                 // Append text content
                 bubbleContentDiv.appendChild(textContentSpan);

                 // Add TTS button only for AI messages and if supported
                 if (sender === 'gemini' && state.speechSynthesisSupported) {
                     const ttsButton = document.createElement('button');
                     ttsButton.className = 'tts-listen-btn btn-tooltip';
                     ttsButton.title = 'Poslechnout komentář'; // Tooltip text
                     ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
                     // Use specific TTS text if provided, otherwise fall back to message content
                     const textForSpeech = ttsText || message;
                     ttsButton.dataset.textToSpeak = textForSpeech;
                      // Add direct listener to this button
                      ttsButton.addEventListener('click', () => speakText(textForSpeech));
                     bubbleContentDiv.appendChild(ttsButton); // Append button next to text
                 }

                 bubbleDiv.appendChild(bubbleContentDiv); // Add wrapper to bubble

                 // Add timestamp
                 const timeDiv = `<div class="message-timestamp">${formatTimestamp(timestamp)}</div>`;

                 div.innerHTML = avatarDiv + bubbleDiv.outerHTML + timeDiv;

                 const empty = uiElements.chatMessages.querySelector('.empty-state');
                 if(empty) empty.remove();
                 uiElements.chatMessages.appendChild(div);
                 div.scrollIntoView({ behavior: 'smooth', block: 'end' });
                 initTooltips(); // Re-initialize tooltips for the new button

                 // Database saving logic (unchanged)
                 if (saveToDb && state.supabase && state.currentUser && state.currentTopic && state.currentSessionId) {
                     try {
                         await state.supabase.from('chat_history').insert({
                             user_id: state.currentUser.id,
                             session_id: state.currentSessionId,
                             topic_id: state.currentTopic.topic_id,
                             topic_name: state.currentTopic.name,
                             role: sender === 'gemini' ? 'model' : 'user',
                             content: message // Save original message (chat or board content)
                         });
                     } catch (e) {
                         console.error("Chat save error:", e);
                         showToast("Chyba ukládání chatu.", "error");
                     }
                 }
            };
            const updateGeminiThinkingState = (isThinking) => {
                state.geminiIsThinking = isThinking;
                manageButtonStates();
                if (uiElements.aiAvatarCorner) {
                    uiElements.aiAvatarCorner.classList.toggle('thinking', isThinking);
                    if (!isThinking) uiElements.aiAvatarCorner.classList.remove('speaking'); // Ensure speaking stops if thinking stops
                }
                if (isThinking) addThinkingIndicator();
                else removeThinkingIndicator();
            };
            const addThinkingIndicator = () => { /* ... (no changes) ... */ if (state.thinkingIndicatorId || !uiElements.chatMessages) return; const id = `thinking-${Date.now()}`; const div = document.createElement('div'); div.className = 'chat-message model'; div.id = id; div.innerHTML = `<div class="message-avatar">AI</div><div class="message-thinking-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`; const empty = uiElements.chatMessages.querySelector('.empty-state'); if(empty) empty.remove(); uiElements.chatMessages.appendChild(div); div.scrollIntoView({ behavior: 'smooth', block: 'end' }); state.thinkingIndicatorId = id; };
            const removeThinkingIndicator = () => { /* ... (no changes) ... */ if (state.thinkingIndicatorId) { document.getElementById(state.thinkingIndicatorId)?.remove(); state.thinkingIndicatorId = null; } };
            const handleSendMessage = async () => { /* ... (Updated prompt, clears input first) ... */ const text = uiElements.chatInput?.value.trim(); if (!text || state.geminiIsThinking || !state.currentTopic) return; // Clear input immediately
 if (uiElements.chatInput) { uiElements.chatInput.value = ''; autoResizeTextarea(); } await addChatMessage(text, 'user'); state.geminiChatContext.push({ role: "user", parts: [{ text }] }); // uiElements.chatInput.focus(); // Keep focus or not? Maybe keep it.
 manageUIState('chatting'); updateGeminiThinkingState(true); // Ask AI to respond in chat, considering the board content (history)
 const prompt = `Student píše do chatu: "${text}". Odpověz textem v chatu k tématu "${state.currentTopic.name}". Měj na paměti, co už bylo vysvětleno na tabuli (poslední části jsou na konci historie). Odpovídej pouze textem do chatu. Neposílej žádný Markdown pro tabuli, pokud to není explicitně vyžádáno pro opravu nebo doplnění tabule.`; await sendToGemini(prompt); };
            const confirmClearChat = () => { /* ... (no changes) ... */ if (confirm("Opravdu vymazat chat?")) clearCurrentChatSessionHistory(); };
            const clearCurrentChatSessionHistory = async () => { /* ... (no changes) ... */ if (uiElements.chatMessages) uiElements.chatMessages.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><h3>Chat vymazán</h3></div>'; state.geminiChatContext = []; showToast("Historie chatu vymazána.", "info"); if (state.supabase && state.currentUser && state.currentSessionId) { try { await state.supabase.from('chat_history').delete().match({ user_id: state.currentUser.id, session_id: state.currentSessionId }); } catch (e) { console.error("DB clear chat error:", e); } } };
            const saveChatToPDF = async () => { /* ... (no changes) ... */ if (!uiElements.chatMessages || uiElements.chatMessages.children.length === 0) { showToast("Není co uložit.", "warning"); return; } if (typeof html2pdf === 'undefined') { showToast("Chyba: PDF knihovna.", "error"); return; } showToast("Generuji PDF...", "info", 3000); const el = document.createElement('div'); el.style.padding="20mm"; el.innerHTML=`<style>body{font-family:Poppins,sans-serif;font-size:10pt;line-height:1.5;color:#333}.user{margin-left:10%}.model{margin-right:10%}.msg{margin-bottom:10px;max-width:90%;page-break-inside:avoid}.bubble{padding:8px 12px;border-radius:12px;background:#eee;display:inline-block;}.user .bubble{background:#dcf8c6;}.time{font-size:8pt;color:#888;margin-top:3px;display:block;}.user .time{text-align:right;}h1{font-size:16pt;color:#3f37c9;text-align:center;margin-bottom:5px}p{font-size:9pt;color:#6c757d;text-align:center;margin:0 0 10px}hr{border:0;border-top:1px solid #ccc;margin:10px 0}</style><h1>Chat - ${sanitizeHTML(state.currentTopic?.name||'Neznámé')}</h1><p>${new Date().toLocaleString('cs-CZ')}</p><hr>`; Array.from(uiElements.chatMessages.children).forEach(m=>{if(m.classList.contains('chat-message')&&!m.id.startsWith('thinking-')){const c=m.cloneNode(true);c.querySelector('.message-avatar')?.remove();c.classList.add(m.classList.contains('user')?'user':'model','msg');c.querySelector('.message-bubble').classList.add('bubble');c.querySelector('.message-timestamp').classList.add('time');el.appendChild(c);}}); const fn=`chat-${state.currentTopic?.name?.replace(/[^a-z0-9]/gi,'_')||'vyuka'}.pdf`; try{await html2pdf().set({margin:15,filename:fn,jsPDF:{unit:'mm',format:'a4'}}).from(el).save();showToast("Chat uložen!", "success");}catch(e){console.error("PDF Error:",e);showToast("Chyba PDF.", "error");} };

             // --- Gemini Interaction & Parsing ---
             // Function to parse AI response for board markdown and TTS commentary
             const parseGeminiResponse = (rawText) => {
                const boardMarker = "[BOARD_MARKDOWN]:";
                const ttsMarker = "[TTS_COMMENTARY]:";
                let boardMarkdown = "";
                let ttsCommentary = "";
                let chatText = ""; // Text that is neither board nor commentary

                const boardStart = rawText.indexOf(boardMarker);
                const ttsStart = rawText.indexOf(ttsMarker);

                // Extract Board Markdown
                if (boardStart !== -1) {
                    let blockStart = rawText.indexOf("```", boardStart + boardMarker.length);
                    if (blockStart !== -1) {
                        let blockEnd = rawText.indexOf("```", blockStart + 3);
                        if (blockEnd !== -1) {
                            boardMarkdown = rawText.substring(blockStart + 3, blockEnd).trim();
                        } else {
                            boardMarkdown = rawText.substring(blockStart + 3).trim(); // Assume rest is markdown if end ``` is missing
                        }
                    }
                }

                // Extract TTS Commentary
                if (ttsStart !== -1) {
                    let commentaryEnd = rawText.indexOf("[", ttsStart + ttsMarker.length); // Look for next potential marker
                    if (commentaryEnd === -1 || (boardStart !== -1 && commentaryEnd > boardStart && ttsStart < boardStart)) {
                         // If no next marker, or if board marker comes *after* tts marker starts
                         commentaryEnd = (boardStart !== -1 && ttsStart < boardStart) ? boardStart : rawText.length;
                    }
                    ttsCommentary = rawText.substring(ttsStart + ttsMarker.length, commentaryEnd).trim();
                }

                // Determine Chat Text (anything not part of the defined blocks)
                 if (boardStart === -1 && ttsStart === -1) {
                    chatText = rawText.trim(); // If no markers, assume whole response is chat
                } else {
                     // Collect text parts outside the defined blocks more carefully
                     let currentPos = 0;
                     let textParts = [];
                     const markers = [];
                     if (boardStart !== -1) markers.push({ type: 'board', start: boardStart, end: rawText.indexOf("```", rawText.indexOf("```", boardStart) + 3) + 3 });
                     if (ttsStart !== -1) markers.push({ type: 'tts', start: ttsStart, end: ttsStart + ttsMarker.length + ttsCommentary.length }); // Use calculated end

                     markers.sort((a, b) => a.start - b.start); // Sort markers by start position

                     markers.forEach(marker => {
                         if (marker.start > currentPos) {
                             textParts.push(rawText.substring(currentPos, marker.start));
                         }
                         currentPos = marker.end;
                     });

                     // Add text after the last marker
                     if (currentPos < rawText.length) {
                         textParts.push(rawText.substring(currentPos));
                     }

                     chatText = textParts.map(p => p.trim()).filter(p => p.length > 0).join("\n\n"); // Join parts with paragraph breaks
                }


                console.log("[parseGeminiResponse] Board Markdown:", boardMarkdown.substring(0,100)+"...");
                console.log("[parseGeminiResponse] TTS Commentary:", ttsCommentary.substring(0,100)+"...");
                console.log("[parseGeminiResponse] Chat Text:", chatText.substring(0,100)+"...");

                return { boardMarkdown, ttsCommentary, chatText };
             };


             // --- processGeminiResponse - Uses updated parsing logic ---
             const processGeminiResponse = (rawText, timestamp) => {
                 removeThinkingIndicator();
                 console.log("Raw Gemini Response Received:", rawText.substring(0, 200) + "...");
                 const { boardMarkdown, ttsCommentary, chatText } = parseGeminiResponse(rawText);

                 let aiResponded = false;

                 // 1. Append content to the whiteboard if present
                 if (boardMarkdown) {
                     appendToWhiteboard(boardMarkdown, ttsCommentary); // Pass commentary for the button
                     console.log("Appended markdown to whiteboard.");
                     aiResponded = true;
                 }

                 // 2. Add chat text if present
                 if (chatText) {
                     // Pass commentary only if it exists and no board content was added (to avoid duplicate TTS)
                     const ttsForChat = ttsCommentary && !boardMarkdown ? ttsCommentary : null;
                     addChatMessage(chatText, 'gemini', true, timestamp, ttsForChat);
                     console.log("Displayed text in chat.");
                     aiResponded = true;
                 } else if (ttsCommentary && !boardMarkdown) {
                     // If only TTS commentary exists (e.g., response to chat question), add it to chat
                     // Use a generic message in chat bubble, but speak the commentary
                     addChatMessage("(Poslechněte si komentář)", 'gemini', true, timestamp, ttsCommentary); // Listen to commentary
                     aiResponded = true;
                 }


                 // 3. Handle cases where AI might not have sent expected content
                 if (!aiResponded) {
                      addChatMessage("(AI neodpovědělo očekávaným způsobem)", 'gemini', false, timestamp); // AI did not respond as expected
                      console.log("AI sent no usable content for whiteboard or chat.");
                 }

                 manageUIState('learning'); // Go back to learning state after response
             };

            // --- Prompts and Gemini Calls --- (Updated)
            const _buildInitialPrompt = () => {
                // Include skill level if available
                const level = state.currentProfile?.skill_level || 'neznámá'; // Default if not found
                return `Jako AI Tutor vysvětli ZÁKLADY tématu "${state.currentTopic.name}" pro studenta s úrovní "${level}". Rozděl vysvětlení na menší logické části. Pro první část:
Formát odpovědi:
[BOARD_MARKDOWN]:
\`\`\`markdown
(Zde napiš KRÁTKÝ A STRUČNÝ Markdown text pro první část vysvětlení na tabuli - klíčové body, vzorec, jednoduchý diagram. Použij nadpisy, seznamy, zvýraznění, LaTeX pro vzorce.)
\`\`\`
[TTS_COMMENTARY]:
(Zde napiš PODROBNĚJŠÍ konverzační komentář k první části na tabuli, jako bys mluvil/a k studentovi na úrovni "${level}". Rozveď myšlenky z tabule, přidej kontext nebo jednoduchý příklad. Tento text bude přečten nahlas.)`;
            };
            const _buildContinuePrompt = () => {
                const level = state.currentProfile?.skill_level || 'neznámá';
                // Consider sending last few board content pieces for context? For now, just rely on chat history.
                // const boardContext = state.boardContentHistory.slice(-2).join("\n---\n"); // Example context
                return `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}" pro studenta s úrovní "${level}". Naváž na předchozí vysvětlení (poslední část historie chatu a tabule je relevantní). Vygeneruj další logickou část.
Formát odpovědi:
[BOARD_MARKDOWN]:
\`\`\`markdown
(Zde napiš další stručnou část Markdown textu pro tabuli.)
\`\`\`
[TTS_COMMENTARY]:
(Zde napiš podrobnější konverzační komentář k NOVÉMU obsahu tabule pro hlasový výstup, přizpůsobený úrovni "${level}".)`;
            };
            const _buildGeminiPayloadContents = (userPrompt) => {
                const level = state.currentProfile?.skill_level || 'neznámá';
                const system = `Jsi AI Tutor "Justax". Vyučuješ téma: "${state.currentTopic.name}" studenta s úrovní "${level}". Vždy odpovídej ve formátu s bloky [BOARD_MARKDOWN]: \`\`\`markdown ... \`\`\` a [TTS_COMMENTARY]: .... Text pro tabuli má být stručný a strukturovaný (nadpisy, seznamy, vzorce v LaTeXu). Komentář pro TTS má být podrobnější, konverzační a doplňující k textu na tabuli (jako bys mluvil), přizpůsobený úrovni studenta. Pokud odpovídáš na dotaz studenta v chatu, odpověz pouze běžným textem bez těchto bloků.`;
                const history = state.geminiChatContext.slice(-MAX_GEMINI_HISTORY_TURNS * 2);
                const current = { role: "user", parts: [{ text: userPrompt }] };
                // Simplified ACK, assuming the system prompt is sufficient
                const modelAck = { role: "model", parts: [{ text: `Rozumím. Vygeneruji stručný obsah pro tabuli a podrobnější TTS komentář ve specifikovaném formátu pro téma "${state.currentTopic.name}" a úroveň "${level}", nebo odpovím na dotaz v chatu.` }]};
                return [{ role: "user", parts:[{text:system}] }, modelAck, ...history, current];
            };
            // sendToGemini and handleGeminiError remain largely the same, just use the updated build functions
            const sendToGemini = async (prompt) => { if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR_')) {showToast("Chyba: AI Key.", "error"); updateGeminiThinkingState(false); return;} if (!state.currentTopic) {showToast("Chyba: Není téma.", "error"); updateGeminiThinkingState(false); return;} if (!navigator.onLine) {showToast("Chyba: Offline.", "error"); updateGeminiThinkingState(false); return;} console.log(`Sending: "${prompt.substring(0, 100)}..."`); const timestamp = new Date(); updateGeminiThinkingState(true); const contents = _buildGeminiPayloadContents(prompt); const body = { contents, generationConfig: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 4096 }, safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }] }; try { const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!response.ok) { let errorText = `API Chyba (${response.status})`; try { const errData = await response.json(); errorText += `: ${errData?.error?.message || 'Neznámá'}`; } catch (e) { errorText += `: ${await response.text()}`; } throw new Error(errorText); } const data = await response.json(); const candidate = data.candidates?.[0]; if (data.promptFeedback?.blockReason) throw new Error(`Blokováno: ${data.promptFeedback.blockReason}.`); if (!candidate) throw new Error('Chybná odpověď AI.'); if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) { if(candidate.finishReason === 'SAFETY') throw new Error('Blokováno filtrem AI.'); console.warn(`Gemini finishReason: ${candidate.finishReason}.`); } const text = candidate.content?.parts?.[0]?.text; if (!text) { if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Max. délka odpovědi.'); else throw new Error('Prázdná odpověď AI.'); } // Store user prompt and AI response
 state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] }); state.geminiChatContext.push({ role: "model", parts: [{ text }] }); if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2) state.geminiChatContext.splice(0, state.geminiChatContext.length - MAX_GEMINI_HISTORY_TURNS * 2); processGeminiResponse(text, timestamp); } catch (error) { console.error('Gemini Chyba:', error); showToast(`Chyba AI: ${error.message}`, "error"); handleGeminiError(error.message, timestamp); } finally { updateGeminiThinkingState(false); // Always remove thinking indicator after processing
 } };
            const handleGeminiError = (msg, time) => { /* ... (no changes) ... */ addChatMessage(`Chyba: ${msg}`, 'gemini', false, time); updateGeminiThinkingState(false); manageUIState('learning'); };

            // --- Run Application ---
            document.addEventListener('DOMContentLoaded', initializeApp);

        } catch (e) {
            // --- Fatal Error Handling ---
            console.error("FATAL SCRIPT ERROR:", e);
            document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#fdd;color:#800;padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>Chyba Aplikace</h1><p>Nelze spustit.</p><p><a href="#" onclick="location.reload()">Obnovit</a></p><details><summary>Detaily</summary><pre style="margin-top:10px;padding:10px;background:#fff;border:1px solid #f5c6cb;font-size:0.8em;white-space:pre-wrap;">${e.message}\n${e.stack}</pre></details></div>`;
        }
