(function() { // Используем IIFE для изоляции
    'use strict';

    try {
        // --- Constants & Configuration ---
        const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
        const GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // !!! Production: Use a secure method !!!
        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const MAX_GEMINI_HISTORY_TURNS = 8; // Max message pairs in history for Gemini
        const NOTIFICATION_FETCH_LIMIT = 5; // Max notifications to show in dropdown

        // --- DOM Elements Cache (Updated for Cyberpunk theme) ---
        const ui = {
            // Loaders & Overlays
            initialLoader: document.getElementById('initial-loader'),
            sidebarOverlay: document.getElementById('sidebar-overlay'),
            offlineBanner: document.getElementById('offline-banner'),
            // Sidebar & User Info (NEW IDs from dashboard.html)
            sidebar: document.getElementById('sidebar'),
            mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'), // Header toggle button
            sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),   // Sidebar close button (inside sidebar)
            sidebarAvatar: document.getElementById('sidebar-avatar'),              // Sidebar user avatar
            sidebarName: document.getElementById('sidebar-name'),                // Sidebar user name
             currentYearSidebar: document.getElementById('currentYearSidebar'),       // Sidebar footer year
            // Header & Notifications (NEW Elements/IDs from dashboard.html)
            dashboardHeader: document.querySelector('.dashboard-header'),
            notificationBell: document.getElementById('notification-bell'),          // Notification bell icon
            notificationCount: document.getElementById('notification-count'),         // Notification badge count
            notificationsDropdown: document.getElementById('notifications-dropdown'), // Notification dropdown container
            notificationsList: document.getElementById('notifications-list'),       // List inside dropdown
            noNotificationsMsg: document.getElementById('no-notifications-msg'),      // "No notifications" message
            markAllReadBtn: document.getElementById('mark-all-read'),             // "Mark all read" button
            // Main Content & Vyuka specific elements
            mainContent: document.getElementById('main-content'),
            topicBar: document.querySelector('.topic-bar'),                         // Original topic bar
            currentTopicDisplay: document.getElementById('current-topic-display'),   // Display for current topic
            continueBtn: document.getElementById('continue-btn'),                   // Original continue button
            learningInterface: document.querySelector('.call-interface'),            // Main container for whiteboard/chat
            aiPresenterArea: document.querySelector('.ai-presenter-area'),
            aiPresenterHeader: document.querySelector('.ai-presenter-header'),
            aiAvatarPlaceholder: document.querySelector('.ai-avatar-placeholder'),
            aiStatusText: document.getElementById('ai-status-text'),
            clearBoardBtn: document.getElementById('clear-board-btn'),               // Original clear board button
            whiteboardContainer: document.getElementById('whiteboard-container'),
            whiteboardContent: document.getElementById('whiteboard-content'),
            boardSpeakingIndicator: document.getElementById('board-speaking-indicator'),// Original speaking indicator
            interactionPanel: document.querySelector('.interaction-panel'),
            interactionTabs: document.querySelector('.interaction-tabs'),
            chatTabContent: document.getElementById('chat-tab-content'),
            chatTabButton: document.querySelector('.interaction-tab[data-tab="chat-tab"]'),
            chatHeader: document.querySelector('.chat-header'),
            chatMessages: document.getElementById('chat-messages'),
            chatInput: document.getElementById('chat-input'),
            sendButton: document.getElementById('send-button'),
            chatControls: document.querySelector('.chat-controls'),
            micBtn: document.getElementById('mic-btn'),                            // Original mic button
            clearChatBtn: document.getElementById('clear-chat-btn'),              // Original clear chat button
            saveChatBtn: document.getElementById('save-chat-btn'),                 // Original save chat button
            aiAvatarCorner: document.getElementById('ai-avatar-corner'),              // Original floating AI avatar
            stopSpeechBtn: document.getElementById('stop-speech-btn'),               // Original stop speech button
            markCompleteBtn: document.getElementById('mark-complete-btn'),           // Original mark complete button
            // Feedback & Footer
            toastContainer: document.getElementById('toast-container'),             // Toast notification container
            globalError: document.getElementById('global-error'),                   // Global error message container
            dashboardFooter: document.querySelector('.dashboard-footer'),           // Footer element
            currentYearFooter: document.getElementById('currentYearFooter'),        // Footer year span
            // Mouse Follower
            mouseFollower: document.getElementById('mouse-follower')                // Cyberpunk mouse effect
        };

        // --- Global State ---
        let state = {
            supabase: null, currentUser: null, currentProfile: null,
            currentTopic: null, currentPlanId: null, currentSessionId: null,
            geminiChatContext: [], geminiIsThinking: false, thinkingIndicatorId: null,
            topicLoadInProgress: false,
            isDarkMode: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
            boardContentHistory: [],
            speechSynthesisSupported: ('speechSynthesis' in window),
            czechVoice: null,
            speechRecognitionSupported: ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
            speechRecognition: null, isListening: false, currentlyHighlightedChunk: null,
            isLoading: { // Added loading state management compatible with cyberpunk theme
                currentTopic: false, chat: false, user: false, notifications: false
            }
        };

        // --- Cyberpunk Helper Functions (Integrated/Updated) ---
        function showToast(title, message, type = 'info', duration = 4500) {
            if (!ui.toastContainer) return;
            try {
                const toastId = `toast-${Date.now()}`;
                const toastElement = document.createElement('div');
                toastElement.className = `toast ${type}`;
                toastElement.id = toastId;
                toastElement.setAttribute('role', 'alert');
                toastElement.setAttribute('aria-live', 'assertive');
                toastElement.innerHTML = `
                    <i class="toast-icon"></i>
                    <div class="toast-content">
                        ${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}
                        <div class="toast-message">${sanitizeHTML(message)}</div>
                    </div>
                    <button type="button" class="toast-close" aria-label="Zavřít">&times;</button>
                `;
                const icon = toastElement.querySelector('.toast-icon');
                icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`;
                toastElement.querySelector('.toast-close').addEventListener('click', () => {
                    toastElement.classList.remove('show');
                    setTimeout(() => toastElement.remove(), 400);
                });
                ui.toastContainer.appendChild(toastElement);
                requestAnimationFrame(() => { toastElement.classList.add('show'); });
                setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration);
            } catch (e) { console.error("Chyba při zobrazování toastu:", e); }
        }

        function showError(message, isGlobal = false) {
            console.error("Došlo k chybě:", message);
            if (isGlobal && ui.globalError) {
                ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Zkusit Znovu</button></div>`;
                ui.globalError.style.display = 'block';
            } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); }
        }

        function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }

        const sanitizeHTML = (str) => {
            const temp = document.createElement('div');
            temp.textContent = str || '';
            return temp.innerHTML;
        };

        const getInitials = (profileData, email) => {
            if (!profileData && !email) return '?';
            let initials = '';
            if (profileData?.first_name) initials += profileData.first_name[0];
            if (profileData?.last_name) initials += profileData.last_name[0];
            if (initials) return initials.toUpperCase();
            if (profileData?.username) return profileData.username[0].toUpperCase();
            if (email) return email[0].toUpperCase();
            return 'Pilot'; // Default to Pilot
        };

        const formatTimestamp = (d = new Date()) => {
            return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        };

        const formatRelativeTime = (timestamp) => {
             if (!timestamp) return '';
             try {
                 const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-';
                 const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7);
                 if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`;
                 return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
             } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; }
         };

        const openMenu = () => {
            if (ui.sidebar && ui.sidebarOverlay) {
                ui.sidebar.classList.add('active');
                ui.sidebarOverlay.classList.add('active');
            }
        };

        const closeMenu = () => {
            if (ui.sidebar && ui.sidebarOverlay) {
                ui.sidebar.classList.remove('active');
                ui.sidebarOverlay.classList.remove('active');
            }
        };

        const renderMarkdown = (el, text) => {
             if (!el) return;
             try {
                 marked.setOptions({ gfm: true, breaks: true });
                 el.innerHTML = marked.parse(text || '');
                 if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
                     setTimeout(() => {
                         window.MathJax.typesetPromise([el]).catch(e => console.error("MathJax typesetting error:", e));
                     }, 0);
                 }
             } catch (e) {
                 console.error("Markdown rendering error:", e);
                 el.innerHTML = `<p style="color:var(--accent-pink);">Chyba renderování.</p>`;
             }
         };

        const autoResizeTextarea = () => {
            if (!ui.chatInput) return;
            ui.chatInput.style.height = 'auto';
            const scrollHeight = ui.chatInput.scrollHeight;
            const maxHeight = 110; // Maximum height in pixels
            ui.chatInput.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
            ui.chatInput.style.overflowY = scrollHeight > maxHeight ? 'scroll' : 'hidden';
        };

        const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        const getBoardBackgroundColor = () => { // Still needed for direct style manipulation if any remains
            return state.isDarkMode ? 'var(--board-bg-dark)' : 'var(--board-bg-light)';
        };

        const initTooltips = () => {
             try {
                 if (window.jQuery?.fn.tooltipster) {
                     // Initialize new tooltips, ignore already initialized ones
                     window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({
                         theme: 'tooltipster-shadow', // Or a cyberpunk theme if available
                         animation: 'fade',
                         delay: 100,
                         side: 'top'
                     });
                 }
             } catch (e) { console.error("Tooltipster error:", e); }
         };

        const updateOnlineStatus = () => {
             if (ui.offlineBanner) {
                 ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block';
             }
             if (!navigator.onLine) {
                 showToast('Offline', 'Spojení bylo ztraceno. Některé funkce nemusí být dostupné.', 'warning');
             }
         };

        const updateCopyrightYear = () => {
            const year = new Date().getFullYear();
            if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year;
            if (ui.currentYearFooter) ui.currentYearFooter.textContent = year;
        };

        const initMouseFollower = () => {
             const follower = ui.mouseFollower;
             if (!follower || window.innerWidth <= 576) return; // Don't show on mobile
             let hasMoved = false;
             const updatePosition = (event) => {
                 if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; }
                 requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; });
              };
             window.addEventListener('mousemove', updatePosition, { passive: true });
             document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; });
             document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; });
             window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true });
         };

        const initScrollAnimations = () => {
            const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); // Assuming animations are within this wrapper
            if (!animatedElements.length || !('IntersectionObserver' in window)) {
                console.log("Scroll animations not initialized (no elements or IntersectionObserver not supported).");
                return;
            }
            const observer = new IntersectionObserver((entries, observerInstance) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animated');
                        observerInstance.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
            animatedElements.forEach(element => observer.observe(element));
            console.log(`Scroll animations initialized for ${animatedElements.length} elements.`);
        };

        const initHeaderScrollDetection = () => {
             let lastScrollY = window.scrollY;
             const mainEl = ui.mainContent; // Scroll within main
             if (!mainEl) return;

             mainEl.addEventListener('scroll', () => {
                 const currentScrollY = mainEl.scrollTop;
                 document.body.classList.toggle('scrolled', currentScrollY > 10);
                 lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
             }, { passive: true });
             // Initial check
             if (mainEl.scrollTop > 10) document.body.classList.add('scrolled');
         };

        const setLoadingState = (sectionKey, isLoadingFlag) => {
             if (state.isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;
             if (sectionKey === 'all') { Object.keys(state.isLoading).forEach(key => state.isLoading[key] = isLoadingFlag); }
             else { state.isLoading[sectionKey] = isLoadingFlag; }
             console.log(`[SetLoading] ${sectionKey}: ${isLoadingFlag}`);

             // --- Handle UI based on loading state ---

             // Example: Disable/Enable Send Button during chat loading
             if (sectionKey === 'chat' && ui.sendButton) {
                const canInteract = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress;
                ui.sendButton.disabled = isLoadingFlag || !canInteract;
                ui.sendButton.innerHTML = state.geminiIsThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
             }
             // Example: Show loading text for topic display
              if (sectionKey === 'currentTopic' && ui.currentTopicDisplay) {
                  if (isLoadingFlag) {
                      ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám téma...</span>';
                  }
              }

             // Handle notification bell state
             if (sectionKey === 'notifications' && ui.notificationBell) {
                 ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                 if (ui.markAllReadBtn) {
                     const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                     ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
                 }
             }
             // Manage overall button states which depend on multiple loading flags
             manageButtonStates();
         };

        // --- TTS/STT Functions ---
        const loadVoices = () => {
            if (!state.speechSynthesisSupported) return;
            try {
                const voices = window.speechSynthesis.getVoices();
                if (!voices || voices.length === 0) {
                    console.warn("No voices available yet or API error.");
                    // Consider adding a small delay and retry, or rely solely on onvoiceschanged
                    return; // Wait for voiceschanged event or retry
                }
                console.log('Available voices:', voices.map(v => ({ name: v.name, lang: v.lang, default: v.default })));

                let preferredVoice = voices.find(voice => voice.lang === 'cs-CZ' && /female|žena|ženský|iveta|zuzana/i.test(voice.name));
                if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang === 'cs-CZ');
                if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang.startsWith('cs'));
                if (!preferredVoice) preferredVoice = voices.find(v => v.default) || voices[0];

                state.czechVoice = preferredVoice;
                console.log("Selected voice:", state.czechVoice?.name, state.czechVoice?.lang);
            } catch (e) {
                console.error("Error loading voices:", e);
                state.czechVoice = null;
            }
        };

        const removeBoardHighlight = () => {
            if (state.currentlyHighlightedChunk) {
                state.currentlyHighlightedChunk.classList.remove('speaking-highlight');
                state.currentlyHighlightedChunk = null;
            }
        };

        const speakText = (text, targetChunkElement = null) => {
            if (!state.speechSynthesisSupported) {
                showToast("Syntéza řeči není podporována.", "warning");
                return;
            }
            if (!text) {
                console.warn("TTS: No text provided.");
                return;
            }

            const plainText = text
                .replace(/<[^>]*>/g, ' ') // Remove HTML tags
                .replace(/[`*#_~[\]()]/g, '') // Remove common markdown chars
                .replace(/\$\$(.*?)\$\$/g, 'matematický vzorec') // Replace display math
                .replace(/\$(.*?)\$/g, 'vzorec') // Replace inline math
                .replace(/\s+/g, ' ') // Collapse multiple whitespace
                .trim();

            if (!plainText) {
                console.warn("TTS: Text empty after cleaning.");
                return;
            }

            window.speechSynthesis.cancel(); // Stop previous speech
            removeBoardHighlight(); // Remove previous highlight

            const utterance = new SpeechSynthesisUtterance(plainText);
            utterance.lang = 'cs-CZ';
            utterance.rate = 0.9;
            utterance.pitch = 1.0;

            if (state.czechVoice) {
                utterance.voice = state.czechVoice;
            } else {
                loadVoices(); // Attempt to load voices again if not found initially
                if (state.czechVoice) {
                    utterance.voice = state.czechVoice;
                } else {
                    console.warn("Czech voice not found, using default.");
                    // Optionally find *any* voice as a last resort
                    // if (!utterance.voice) utterance.voice = window.speechSynthesis.getVoices()[0];
                }
            }

            utterance.onstart = () => {
                console.log("TTS started.");
                ui.aiAvatarCorner?.classList.add('speaking');
                ui.boardSpeakingIndicator?.classList.add('active');
                if (targetChunkElement) {
                    targetChunkElement.classList.add('speaking-highlight'); // CSS will handle theme
                    state.currentlyHighlightedChunk = targetChunkElement;
                }
            };

            utterance.onend = () => {
                console.log("TTS finished.");
                ui.aiAvatarCorner?.classList.remove('speaking');
                ui.boardSpeakingIndicator?.classList.remove('active');
                removeBoardHighlight();
            };

            utterance.onerror = (event) => {
                console.error('SpeechSynthesisUtterance.onerror', event);
                showToast(`Chyba při čtení: ${event.error}`, 'error');
                ui.aiAvatarCorner?.classList.remove('speaking');
                ui.boardSpeakingIndicator?.classList.remove('active');
                removeBoardHighlight();
            };

            console.log(`TTS: Speaking with voice: ${utterance.voice?.name}, lang: ${utterance.lang}`);
            window.speechSynthesis.speak(utterance);
        };

        const stopSpeech = () => {
            if (state.speechSynthesisSupported) {
                window.speechSynthesis.cancel();
                ui.aiAvatarCorner?.classList.remove('speaking');
                ui.boardSpeakingIndicator?.classList.remove('active');
                removeBoardHighlight();
                console.log("Speech cancelled.");
            }
        };

        const initializeSpeechRecognition = () => {
            if (!state.speechRecognitionSupported) {
                console.warn("Speech Recognition not supported.");
                if(ui.micBtn) { ui.micBtn.disabled = true; ui.micBtn.title = "Rozpoznávání řeči není podporováno"; }
                return;
            }

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            state.speechRecognition = new SpeechRecognition();
            state.speechRecognition.lang = 'cs-CZ';
            state.speechRecognition.interimResults = false;
            state.speechRecognition.maxAlternatives = 1;
            state.speechRecognition.continuous = false;

            state.speechRecognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                console.log('Speech recognized:', transcript);
                if (ui.chatInput) {
                    ui.chatInput.value = transcript;
                    autoResizeTextarea();
                    // Optional: handleSendMessage(); // Automatically send?
                }
            };

            state.speechRecognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                let errorMsg = "Chyba rozpoznávání řeči";
                if (event.error === 'no-speech') errorMsg = "Nerozpoznal jsem žádnou řeč.";
                else if (event.error === 'audio-capture') errorMsg = "Chyba mikrofonu.";
                else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    errorMsg = "Přístup k mikrofonu zamítnut.";
                    if(ui.micBtn) ui.micBtn.disabled = true; // Permanently disable if denied
                }
                showToast(errorMsg, 'error');
                stopListening(); // Reset state
            };

            state.speechRecognition.onend = () => {
                console.log('Speech recognition ended.');
                stopListening(); // Ensure UI/state is reset
            };

            // Optional diagnostic listeners
            state.speechRecognition.onaudiostart = () => console.log('Audio capture started.');
            state.speechRecognition.onaudioend = () => console.log('Audio capture ended.');
            state.speechRecognition.onspeechstart = () => console.log('Speech detected.');
            state.speechRecognition.onspeechend = () => console.log('Speech ended.');

            console.log("Speech Recognition initialized.");
        };

        const startListening = () => {
            if (!state.speechRecognitionSupported || !state.speechRecognition || state.isListening) return;
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(() => {
                    try {
                        state.speechRecognition.start();
                        state.isListening = true;
                        ui.micBtn?.classList.add('listening');
                        if(ui.micBtn) ui.micBtn.title = "Zastavit hlasový vstup";
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
                    if(ui.micBtn) ui.micBtn.disabled = true; // Disable if denied
                    stopListening();
                });
        };

        const stopListening = () => {
            if (!state.speechRecognitionSupported || !state.speechRecognition || !state.isListening) return;
            try {
                state.speechRecognition.stop();
            } catch (e) {
                // Ignore errors here, might be called multiple times
            } finally {
                state.isListening = false;
                ui.micBtn?.classList.remove('listening');
                if(ui.micBtn) ui.micBtn.title = "Zahájit hlasový vstup";
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
        const initializeSupabase = () => {
            try {
                if (!window.supabase) throw new Error("Supabase library not loaded.");
                state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                if (!state.supabase) throw new Error("Client creation failed.");
                console.log("Supabase initialized.");
                return true;
            } catch (error) {
                console.error("Supabase init failed:", error);
                showToast("Chyba DB.", "error", 10000);
                return false;
            }
        };

        // Updated initializeUI to include Cyberpunk features
        const initializeUI = () => {
            try {
                updateTheme(); // Apply theme to board initially
                setupEventListeners(); // Setup all listeners including new ones
                initTooltips(); // Initialize tooltips

                // Ensure only chat tab is active/visible (if applicable, might be removed if only one tab)
                if (ui.chatTabButton) ui.chatTabButton.classList.add('active');
                if (ui.chatTabContent) ui.chatTabContent.classList.add('active');

                // Load TTS voices
                if (state.speechSynthesisSupported) {
                    if (window.speechSynthesis.getVoices().length > 0) { loadVoices(); }
                    else if (window.speechSynthesis.onvoiceschanged !== undefined) { window.speechSynthesis.onvoiceschanged = loadVoices; }
                } else { console.warn("Speech Synthesis not supported."); }

                // Initialize STT
                initializeSpeechRecognition();

                // Initialize Cyberpunk specific UI enhancements
                initMouseFollower();
                initHeaderScrollDetection();
                updateCopyrightYear();
                updateOnlineStatus(); // Initial online status check

                manageUIState('initial'); // Set initial UI state for buttons etc.
                console.log("UI Initialized successfully.");
                return true;
            } catch(error) {
                console.error("UI Init failed:", error);
                showError(`Chyba inicializace UI: ${error.message}`, true); // Show global error
                return false;
            }
        };

        // Updated initializeApp flow
        const initializeApp = async () => {
            console.log("🚀 [Init Vyuka - Kyber] Starting...");
            if (!initializeSupabase()) return;

            if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
            if (ui.mainContent) ui.mainContent.style.display = 'none'; // Hide main content initially

            try {
                // 1. Check Auth Session
                console.log("[INIT] Checking auth session...");
                const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
                if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);

                if (!session || !session.user) {
                    console.log('[Init Vyuka - Kyber] Not logged in. Redirecting...');
                    window.location.href = '/auth/index.html'; // Redirect to login
                    return; // Stop execution here
                }
                state.currentUser = session.user;
                console.log(`[INIT] User authenticated (ID: ${state.currentUser.id}).`);

                // 2. Fetch User Profile
                setLoadingState('user', true);
                state.currentProfile = await fetchUserProfile(state.currentUser.id); // Fetch profile
                updateUserInfoUI(); // Update sidebar with fetched or default info
                setLoadingState('user', false);

                if (!state.currentProfile) {
                     // Handle case where profile fetch failed but user is logged in
                    showError("Profil nenalezen nebo se nepodařilo načíst.", true);
                    // Hide loader and show main content to display the error message
                    if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }
                    if (ui.mainContent) ui.mainContent.style.display = 'flex'; // Show main to display error
                    manageUIState('error', { errorMessage: 'Profil nenalezen.' });
                    return;
                }

                // 3. Initialize UI Elements & Base Functionality
                if (!initializeUI()) return; // Setup listeners, tooltips, theme, STT, etc.

                // 4. Load Initial Data (Notifications and Topic concurrently)
                console.log("[INIT] Loading initial topic and notifications...");
                const loadNotificationsPromise = fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
                    .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                    .catch(err => {
                        console.error("Chyba při úvodním načítání notifikací:", err);
                        renderNotifications(0, []); // Render empty state on error
                    });

                const loadTopicPromise = loadNextUncompletedTopic(); // This sets its own loading state

                await Promise.all([loadNotificationsPromise, loadTopicPromise]); // Wait for both to finish

                 // 5. Finalize UI Display
                 if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); } // Fade out loader
                 if (ui.mainContent) { ui.mainContent.style.display = 'flex'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); }); } // Fade in main content
                 requestAnimationFrame(initScrollAnimations); // Start scroll animations after content is potentially loaded

                console.log("✅ [Init Vyuka - Kyber] Page Initialized.");

            } catch (error) {
                console.error("❌ [Init Vyuka - Kyber] Critical initialization error:", error);
                // Show error message, possibly in the loader area if it's still visible
                if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). Obnovte.</p>`; }
                else { showError(`Chyba inicializace: ${error.message}`, true); }
                if (ui.mainContent) ui.mainContent.style.display = 'flex'; // Show main to potentially display global error
                setLoadingState('all', false); // Ensure all loading flags are reset
            }
        };


        // --- User Profile & Auth ---
        const fetchUserProfile = async (userId) => {
             if (!state.supabase || !userId) return null;
             console.log(`[Profile] Fetching profile for user ID: ${userId}`);
             // setLoadingState('user', true); // Managed by initializeApp now
             try {
                 const { data: profile, error } = await state.supabase.from('profiles').select('*').eq('id', userId).single();
                 if (error && error.code !== 'PGRST116') throw error;
                 if (!profile) { console.warn(`[Profile] Profile not found for user ${userId}.`); return null; }
                 console.log("[Profile] Profile data fetched.");
                 return profile;
             } catch (error) {
                 console.error('[Profile] Exception fetching profile:', error);
                 showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error');
                 return null;
             } // finally { setLoadingState('user', false); } // Managed by initializeApp now
         };

        const updateUserInfoUI = () => { // Uses cyberpunk sidebar IDs
             if (!ui.sidebarName || !ui.sidebarAvatar) return;
             if (state.currentUser && state.currentProfile) {
                 const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot';
                 ui.sidebarName.textContent = sanitizeHTML(displayName);
                 const initials = getInitials(state.currentProfile, state.currentUser.email);
                 // Add cache busting to avatar URL if present
                 const avatarUrl = state.currentProfile.avatar_url ? `${state.currentProfile.avatar_url}?t=${new Date().getTime()}` : null;
                 ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${initials}">` : initials;
             } else {
                 ui.sidebarName.textContent = 'Nepřihlášen';
                 ui.sidebarAvatar.textContent = '?';
             }
         };

        const handleLoggedOutUser = () => {
            console.warn("User not logged in.");
            if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder">Nejste přihlášeni</span>';
            showToast("Prosím, přihlaste se.", "warning");
            manageUIState('loggedOut');
        };

        // --- Event Listeners Setup (Includes new Cyberpunk elements) ---
        const setupEventListeners = () => {
            console.log("[SETUP] Setting up event listeners...");
            // Sidebar/Menu (NEW IDs from dashboard.html)
            if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
            if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
            if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);

            // Original Vyuka listeners (unchanged core functionality)
            if (ui.chatInput) ui.chatInput.addEventListener('input', autoResizeTextarea);
            if (ui.sendButton) ui.sendButton.addEventListener('click', handleSendMessage);
            if (ui.chatInput) ui.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } });
            if (ui.clearChatBtn) ui.clearChatBtn.addEventListener('click', confirmClearChat);
            if (ui.saveChatBtn) ui.saveChatBtn.addEventListener('click', saveChatToPDF);
            if (ui.continueBtn) ui.continueBtn.addEventListener('click', requestContinue);
            if (ui.markCompleteBtn) ui.markCompleteBtn.addEventListener('click', handleMarkTopicComplete);
            if (ui.clearBoardBtn) ui.clearBoardBtn.addEventListener('click', () => clearWhiteboard(true));
            if (ui.stopSpeechBtn) ui.stopSpeechBtn.addEventListener('click', stopSpeech);
            if (ui.micBtn) ui.micBtn.addEventListener('click', handleMicClick);

            // Event delegation for TTS buttons in chat
            if (ui.chatMessages) {
                ui.chatMessages.addEventListener('click', (event) => {
                    const button = event.target.closest('.tts-listen-btn');
                    if (button) {
                        const text = button.dataset.textToSpeak;
                        if (text) { speakText(text); } // Don't highlight chat messages
                        else { console.warn("No text found for TTS button in chat."); }
                    }
                });
            }

            // Theme change listener
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
                state.isDarkMode = event.matches;
                console.log("Theme changed, isDarkMode:", state.isDarkMode);
                updateTheme(); // Update board theme/highlighting
            });

            // Resize listener (for mobile menu cleanup)
            window.addEventListener('resize', () => {
                if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) {
                    closeMenu();
                }
            });

            // Online/Offline listeners
            window.addEventListener('online', updateOnlineStatus);
            window.addEventListener('offline', updateOnlineStatus);

             // Notification listeners (NEW - Copied from test1.js/plan.js)
             if (ui.notificationBell) {
                 ui.notificationBell.addEventListener('click', (event) => {
                     event.stopPropagation(); // Prevent closing immediately if clicking outside
                     ui.notificationsDropdown?.classList.toggle('active');
                 });
             }
             if (ui.markAllReadBtn) {
                 ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead);
             }
             if (ui.notificationsList) {
                 ui.notificationsList.addEventListener('click', async (event) => {
                     const item = event.target.closest('.notification-item');
                     if (item) {
                         const notificationId = item.dataset.id;
                         const link = item.dataset.link;
                         const isRead = item.classList.contains('is-read');
                         if (!isRead && notificationId) {
                             const success = await markNotificationRead(notificationId);
                             if (success) {
                                 item.classList.add('is-read');
                                 item.querySelector('.unread-dot')?.remove();
                                 // Update badge count
                                 const currentCountText = ui.notificationCount.textContent.replace('+', '');
                                 const currentCount = parseInt(currentCountText) || 0;
                                 const newCount = Math.max(0, currentCount - 1);
                                 ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                                 ui.notificationCount.classList.toggle('visible', newCount > 0);
                                 if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0;
                             }
                         }
                         if (link) {
                             window.location.href = link; // Navigate if link exists
                         }
                         // Optionally close dropdown after click
                         // ui.notificationsDropdown?.classList.remove('active');
                     }
                 });
             }
              // Close dropdown on outside click
              document.addEventListener('click', (event) => {
                 if (ui.notificationsDropdown?.classList.contains('active') &&
                     !ui.notificationsDropdown.contains(event.target) &&
                     !ui.notificationBell?.contains(event.target)) {
                     ui.notificationsDropdown.classList.remove('active');
                 }
             });

            console.log("Event listeners setup complete.");
        };

        // --- UI State & Button Management ---
        const manageUIState = (mode, options = {}) => {
             console.log("[UI State]:", mode, options);
             const isLearning = ['learning', 'chatting', 'requestingExplanation'].includes(mode);
             // Determine if the main learning interface should be shown
             const showLearningInterface = !!state.currentTopic || ['loadingTopic', 'requestingExplanation', 'noPlan', 'planComplete', 'error'].includes(mode) || mode.startsWith('initial') || mode === 'loadingUser';

             if (ui.learningInterface) {
                 ui.learningInterface.style.display = showLearningInterface ? 'flex' : 'none';
             }

             // Show appropriate message in chat area when not actively learning/loading
             if (ui.chatMessages && !isLearning && !['initial', 'loadingUser', 'loadingTopic'].includes(mode)) {
                 let emptyStateHTML = '';
                 switch (mode) {
                     case 'loggedOut': emptyStateHTML = `<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPŘIHLÁŠEN</h3><p>Pro přístup k výuce se prosím <a href="/auth/index.html" style="color: var(--accent-primary)">přihlaste</a>.</p></div>`; break;
                     case 'noPlan': emptyStateHTML = `<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ŽÁDNÝ AKTIVNÍ PLÁN</h3><p>Nemáte aktivní studijní plán. Nejprve prosím dokončete <a href="/dashboard/procvicovani/test1.html" style="color: var(--accent-primary)">diagnostický test</a> v sekci Procvičování.</p></div>`; break;
                     case 'planComplete': emptyStateHTML = `<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLÁN DOKONČEN!</h3><p>Všechny naplánované aktivity jsou hotové. Skvělá práce! Můžete si <a href="/dashboard/procvicovani/plan.html" style="color: var(--accent-primary)">vytvořit nový plán</a>.</p></div>`; break;
                     case 'error': emptyStateHTML = `<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA SYSTÉMU</h3><p>${options.errorMessage || 'Nastala chyba při načítání dat.'}</p></div>`; break;
                     // Keep initial states silent or simple
                     // case 'initial': emptyStateHTML = `<div class='empty-state'><i class="fas fa-user-circle"></i><h3>AUTENTIZACE...</h3></div>`; break;
                     // case 'loadingUser': emptyStateHTML = `<div class='empty-state'><i class="fas fa-user-circle"></i><h3>NAČÍTÁNÍ PROFILU...</h3></div>`; break;
                     // case 'loadingTopic': emptyStateHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>NAČÍTÁNÍ TÉMATU...</h3></div>'; break;
                     default: emptyStateHTML = '';
                 }
                 // Render the message if one exists or if the chat is currently empty during these states
                 if (emptyStateHTML || (ui.chatMessages.children.length === 0 && ['loggedOut', 'noPlan', 'planComplete', 'error'].includes(mode))) {
                     ui.chatMessages.innerHTML = emptyStateHTML;
                 }
             } else if (ui.chatMessages && mode === 'loadingTopic'){
                 ui.chatMessages.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>NAČÍTÁNÍ TÉMATU...</h3></div>';
             }

             manageButtonStates(); // Update buttons based on the new state
         };

        const manageButtonStates = () => {
            const canInteractNormally = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress;
            const canContinueOrComplete = canInteractNormally; // Same condition for now

            // Chat Send Button
            if (ui.sendButton) {
                ui.sendButton.disabled = !canInteractNormally || state.isListening; // Also disable while listening
                ui.sendButton.innerHTML = state.geminiIsThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
            }
            // Chat Input
            if (ui.chatInput) {
                ui.chatInput.disabled = !canInteractNormally || state.isListening; // Disable while listening
                ui.chatInput.placeholder = canInteractNormally ? "Zeptejte se na cokoliv..." : "Počkejte prosím...";
            }
            // Topic Control Buttons
            if (ui.continueBtn) {
                ui.continueBtn.disabled = !canContinueOrComplete;
                ui.continueBtn.style.display = state.currentTopic ? 'inline-flex' : 'none'; // Show if topic exists
            }
            if (ui.markCompleteBtn) {
                ui.markCompleteBtn.disabled = !canContinueOrComplete;
                ui.markCompleteBtn.style.display = state.currentTopic ? 'inline-flex' : 'none'; // Show if topic exists
            }
            // Board/Speech Buttons
            if (ui.clearBoardBtn) { ui.clearBoardBtn.disabled = !ui.whiteboardContent || state.geminiIsThinking; }
            if (ui.stopSpeechBtn) { ui.stopSpeechBtn.disabled = !state.speechSynthesisSupported; } // Always enabled if supported? Or disable if not speaking?

            // Mic Button
            if (ui.micBtn) {
                const canUseMic = canInteractNormally && state.speechRecognitionSupported;
                ui.micBtn.disabled = !canUseMic || state.isListening;
                ui.micBtn.classList.toggle('listening', state.isListening);
                ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporováno" : state.isListening ? "Zastavit hlasový vstup" : "Zahájit hlasový vstup";
            }
            // Chat Utility Buttons
            if (ui.clearChatBtn) ui.clearChatBtn.disabled = state.geminiIsThinking; // Disable while thinking
            if (ui.saveChatBtn) ui.saveChatBtn.disabled = state.geminiIsThinking; // Disable while thinking
        };

        // --- Whiteboard ---
        const updateTheme = () => {
            console.log("Updating theme, isDarkMode:", state.isDarkMode);
            // CSS variables handle background/text color switching automatically
            // We just need to ensure the correct highlight color is set via CSS var
            document.documentElement.style.setProperty(
                '--board-highlight-color',
                state.isDarkMode ? 'var(--board-highlight-dark)' : 'var(--board-highlight-light)'
            );
            // The class 'speaking-highlight' on the chunk will now use this CSS variable
        };

        const clearWhiteboard = (showToastMsg = true) => {
            if (!ui.whiteboardContent) return;
            ui.whiteboardContent.innerHTML = '';
            state.boardContentHistory = [];
            console.log("Whiteboard cleared.");
            if (showToastMsg) showToast('Vymazáno', "Tabule vymazána.", "info");
        };

        const appendToWhiteboard = (markdownContent, commentaryText) => {
            if (!ui.whiteboardContent || !ui.whiteboardContainer) return;
            const chunkDiv = document.createElement('div');
            chunkDiv.className = 'whiteboard-chunk'; // Class for styling and targetting

            // Create content div
            const contentDiv = document.createElement('div');
            renderMarkdown(contentDiv, markdownContent); // Render markdown into the content div

            // Create TTS button
            const ttsButton = document.createElement('button');
            ttsButton.className = 'tts-listen-btn btn-tooltip';
            ttsButton.title = 'Poslechnout komentář';
            ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
            const textForSpeech = commentaryText || markdownContent; // Fallback to markdown if no commentary
            ttsButton.dataset.textToSpeak = textForSpeech;

            // Add click listener specifically for this button to handle highlighting
            if (state.speechSynthesisSupported) {
                ttsButton.addEventListener('click', (e) => {
                     e.stopPropagation(); // Prevent triggering potential listeners on the chunk itself
                    speakText(textForSpeech, chunkDiv); // Pass the chunk element for highlighting
                });
            }

            // Append content and button to the chunk div
            chunkDiv.appendChild(contentDiv);
            if (state.speechSynthesisSupported) { // Only add button if supported
                chunkDiv.appendChild(ttsButton);
            }

            ui.whiteboardContent.appendChild(chunkDiv); // Append the new chunk
            state.boardContentHistory.push(markdownContent); // Store the markdown chunk

            // Scroll to the bottom of the whiteboard container
            ui.whiteboardContainer.scrollTop = ui.whiteboardContainer.scrollHeight;
            console.log("Appended content to whiteboard.");
            initTooltips(); // Re-initialize tooltips for the new button
        };

        // --- Topic Loading and Progress ---
        const loadNextUncompletedTopic = async () => {
            if (!state.currentUser || state.topicLoadInProgress || !state.supabase) return;
            state.topicLoadInProgress = true;
            setLoadingState('currentTopic', true); // Use loading state manager
            state.currentTopic = null;
            if (ui.chatMessages) ui.chatMessages.innerHTML = ''; // Clear chat messages as well
            clearWhiteboard(false); // Clear whiteboard for new topic
            state.geminiChatContext = []; // Clear Gemini context
            manageUIState('loadingTopic'); // Show loading message in chat area

            try {
                // Fetch active plan
                const { data: plans, error: planError } = await state.supabase
                    .from('study_plans')
                    .select('id')
                    .eq('user_id', state.currentUser.id)
                    .eq('status', 'active')
                    .limit(1);

                if (planError) throw planError;
                if (!plans || plans.length === 0) {
                    manageUIState('noPlan');
                    return;
                }
                state.currentPlanId = plans[0].id;

                // Fetch next uncompleted activity
                const { data: activities, error: activityError } = await state.supabase
                    .from('plan_activities')
                    .select('id, title, description, topic_id')
                    .eq('plan_id', state.currentPlanId)
                    .eq('completed', false)
                    .order('day_of_week') // Assuming ordering is defined in DB or needed here
                    .order('time_slot')
                    .limit(1);

                if (activityError) throw activityError;

                if (activities && activities.length > 0) {
                    const activity = activities[0];
                    let name = activity.title || 'N/A';
                    let desc = activity.description || '';

                    // Fetch topic details if topic_id exists
                    if (activity.topic_id) {
                        try {
                            const { data: topic, error: topicError } = await state.supabase
                                .from('exam_topics')
                                .select('name, description')
                                .eq('id', activity.topic_id)
                                .single();
                            if (topicError && topicError.code !== 'PGRST116') throw topicError;
                            if (topic) {
                                name = topic.name || name;
                                desc = topic.description || desc; // Use topic description if available?
                            }
                        } catch(e) { console.warn("Could not fetch topic details:", e); }
                    }

                    state.currentTopic = {
                        activity_id: activity.id,
                        plan_id: state.currentPlanId,
                        name: name,
                        description: desc, // Description might be from activity or topic
                        user_id: state.currentUser.id,
                        topic_id: activity.topic_id // Store topic_id if available
                    };

                    if (ui.currentTopicDisplay) {
                        ui.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(name)}</strong>`;
                    }
                    await startLearningSession(); // Start interaction with AI for this topic
                } else {
                    manageUIState('planComplete'); // No more activities in the plan
                }
            } catch (error) {
                console.error('Error loading next topic:', error);
                showToast(`Chyba načítání tématu: ${error.message}`, "error");
                manageUIState('error', { errorMessage: error.message });
            } finally {
                state.topicLoadInProgress = false;
                setLoadingState('currentTopic', false); // Stop loading state
                manageButtonStates(); // Re-enable buttons if needed
            }
        };

        const handleMarkTopicComplete = async () => {
            if (!state.currentTopic || !state.supabase || state.topicLoadInProgress) return;
            state.topicLoadInProgress = true; // Prevent further actions
            manageButtonStates(); // Disable buttons

            try {
                const { error } = await state.supabase
                    .from('plan_activities')
                    .update({ completed: true, updated_at: new Date().toISOString() })
                    .eq('id', state.currentTopic.activity_id);

                if (error) throw error;

                showToast(`Téma "${state.currentTopic.name}" dokončeno.`, "success");
                await loadNextUncompletedTopic(); // Load the next one automatically
            } catch (error) {
                console.error(`Error marking topic complete:`, error);
                showToast("Chyba při označování tématu jako dokončeného.", "error");
                state.topicLoadInProgress = false; // Re-enable actions on error
                manageButtonStates();
            }
            // No finally needed here as loadNextUncompletedTopic handles it
        };


        // --- Learning Session & Chat ---
        const startLearningSession = async () => {
            if (!state.currentTopic) return;
            state.currentSessionId = generateSessionId();
            manageUIState('requestingExplanation'); // Show initial message?
            const prompt = _buildInitialPrompt();
            await sendToGemini(prompt);
        };

        const requestContinue = async () => {
            if (state.geminiIsThinking || !state.currentTopic) return;
            const prompt = _buildContinuePrompt();
            await sendToGemini(prompt);
        };

        const addChatMessage = async (message, sender, saveToDb = true, timestamp = new Date(), ttsText = null) => {
            if (!ui.chatMessages) return;
            const id = `msg-${Date.now()}`;
            const avatarText = sender === 'user'
                ? getInitials(state.currentProfile, state.currentUser?.email)
                : 'AI'; // Consistent avatar text
            const div = document.createElement('div');
            div.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`;
            div.id = id;

            const avatarDiv = `<div class="message-avatar">${avatarText}</div>`;
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'message-bubble';
            const bubbleContentDiv = document.createElement('div');
            bubbleContentDiv.className = 'message-bubble-content';
            const textContentSpan = document.createElement('span');
            textContentSpan.className = 'message-text-content';

            renderMarkdown(textContentSpan, message); // Render markdown inside span

            bubbleContentDiv.appendChild(textContentSpan);

            // Add TTS button for AI messages
            if (sender === 'gemini' && state.speechSynthesisSupported) {
                const ttsButton = document.createElement('button');
                ttsButton.className = 'tts-listen-btn btn-tooltip';
                ttsButton.title = 'Poslechnout'; // Simpler tooltip
                ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
                const textForSpeech = ttsText || message; // Use specific TTS text if provided
                ttsButton.dataset.textToSpeak = textForSpeech;
                ttsButton.addEventListener('click', (e) => {
                     e.stopPropagation(); // Prevent potential bubble click listeners
                     speakText(textForSpeech); // Speak the text
                 });
                bubbleContentDiv.appendChild(ttsButton); // Append button inside content div
            }

            bubbleDiv.appendChild(bubbleContentDiv); // Add content wrapper to bubble
            const timeDiv = `<div class="message-timestamp">${formatTimestamp(timestamp)}</div>`;

            div.innerHTML = avatarDiv + bubbleDiv.outerHTML + timeDiv;

            const empty = ui.chatMessages.querySelector('.empty-state');
            if(empty) empty.remove(); // Remove any placeholder message

            ui.chatMessages.appendChild(div);
            div.scrollIntoView({ behavior: 'smooth', block: 'end' });
            initTooltips(); // Re-initialize tooltips for any new buttons

            // Save to database
            if (saveToDb && state.supabase && state.currentUser && state.currentTopic && state.currentSessionId) {
                try {
                    await state.supabase.from('chat_history').insert({
                        user_id: state.currentUser.id,
                        session_id: state.currentSessionId,
                        topic_id: state.currentTopic.topic_id, // Store topic_id if available
                        topic_name: state.currentTopic.name,
                        role: sender === 'gemini' ? 'model' : 'user',
                        content: message // Store the raw message content
                    });
                } catch (e) {
                    console.error("Chat save error:", e);
                    showToast("Chyba ukládání chatu.", "error");
                }
            }
        };

        const updateGeminiThinkingState = (isThinking) => {
            state.geminiIsThinking = isThinking;
            setLoadingState('chat', isThinking); // Link to loading state manager
            ui.aiAvatarCorner?.classList.toggle('thinking', isThinking);
            if (!isThinking) ui.aiAvatarCorner?.classList.remove('speaking'); // Ensure speaking stops if thinking stops
            if (isThinking) addThinkingIndicator();
            else removeThinkingIndicator();
            // manageButtonStates(); // setLoadingState calls manageButtonStates
        };

        const addThinkingIndicator = () => {
            if (state.thinkingIndicatorId || !ui.chatMessages) return;
            const id = `thinking-${Date.now()}`;
            const div = document.createElement('div');
            div.className = 'chat-message model'; // Style as model message
            div.id = id;
            div.innerHTML = `
                <div class="message-avatar">AI</div>
                <div class="message-thinking-indicator">
                    <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
                </div>`;
            const empty = ui.chatMessages.querySelector('.empty-state');
            if(empty) empty.remove();
            ui.chatMessages.appendChild(div);
            div.scrollIntoView({ behavior: 'smooth', block: 'end' });
            state.thinkingIndicatorId = id;
        };

        const removeThinkingIndicator = () => {
            if (state.thinkingIndicatorId) {
                document.getElementById(state.thinkingIndicatorId)?.remove();
                state.thinkingIndicatorId = null;
            }
        };

        const handleSendMessage = async () => {
            const text = ui.chatInput?.value.trim();
            if (!text || state.geminiIsThinking || !state.currentTopic || state.isListening) return;

            if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(); }
            await addChatMessage(text, 'user');
            state.geminiChatContext.push({ role: "user", parts: [{ text }] });
            // manageUIState('chatting'); // State handled by loading/thinking state
            updateGeminiThinkingState(true);

            const prompt = `Student píše do chatu: "${text}". Odpověz textem v chatu k tématu "${state.currentTopic.name}". Měj na paměti, co už bylo vysvětleno na tabuli (poslední části jsou na konci historie). Odpovídej pouze textem do chatu. Neposílej žádný Markdown pro tabuli, pokud to není explicitně vyžádáno pro opravu nebo doplnění tabule.`;
            await sendToGemini(prompt);
        };

        const confirmClearChat = () => {
            if (confirm("Opravdu vymazat historii této konverzace? Tato akce je nevratná.")) {
                clearCurrentChatSessionHistory();
            }
        };

        const clearCurrentChatSessionHistory = async () => {
            if (ui.chatMessages) {
                 ui.chatMessages.innerHTML = `<div class="empty-state"><i class="fas fa-comments"></i><h3>Chat vymazán</h3><p>Můžete začít novou konverzaci.</p></div>`;
             }
            state.geminiChatContext = []; // Clear local context
            showToast("Historie chatu vymazána.", "info");
            if (state.supabase && state.currentUser && state.currentSessionId) {
                try {
                     // Delete records from the database for this session
                     const { error } = await state.supabase
                         .from('chat_history')
                         .delete()
                         .match({ user_id: state.currentUser.id, session_id: state.currentSessionId });
                     if (error) throw error;
                     console.log(`Chat history deleted from DB for session: ${state.currentSessionId}`);
                 } catch (e) {
                     console.error("DB clear chat error:", e);
                     showToast("Chyba při mazání historie chatu z databáze.", "error");
                 }
            }
        };

        const saveChatToPDF = async () => {
            if (!ui.chatMessages || ui.chatMessages.children.length === 0 || (ui.chatMessages.children.length === 1 && ui.chatMessages.querySelector('.empty-state'))) {
                showToast("Není co uložit.", "warning"); return;
             }
            if (typeof html2pdf === 'undefined') { showToast("Chyba: PDF knihovna nenalezena.", "error"); return; }

            showToast("Generuji PDF...", "info", 4000);
            const elementToExport = document.createElement('div');
            elementToExport.style.padding="15mm"; // Add padding for PDF margins
            // Basic Styling for PDF - Can be expanded
             elementToExport.innerHTML = `<style>
                body { font-family: 'Poppins', sans-serif; font-size: 10pt; line-height: 1.5; color: #333; }
                .chat-message { margin-bottom: 12px; max-width: 90%; page-break-inside: avoid; }
                .user { margin-left: 10%; }
                .model { margin-right: 10%; }
                .message-bubble { display: inline-block; padding: 8px 14px; border-radius: 15px; background-color: #e9ecef; }
                .user .message-bubble { background-color: #d1e7dd; } /* Light green for user */
                .message-timestamp { font-size: 8pt; color: #6c757d; margin-top: 4px; display: block; }
                .user .message-timestamp { text-align: right; }
                h1 { font-size: 16pt; color: #0d6efd; text-align: center; margin-bottom: 5px; }
                p.subtitle { font-size: 9pt; color: #6c757d; text-align: center; margin: 0 0 15px 0; }
                hr { border: 0; border-top: 1px solid #ccc; margin: 15px 0; }
                .tts-listen-btn { display: none; } /* Hide TTS buttons in PDF */
                mjx-math { font-size: 1em; } /* Reset MathJax size for PDF */
                pre { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 0.8em; border-radius: 6px; overflow-x: auto; font-size: 0.9em; }
                code { background-color: #e9ecef; padding: 0.1em 0.3em; border-radius: 3px; }
                pre code { background: none; padding: 0; }
             </style>
             <h1>Chat s AI Tutorem - ${sanitizeHTML(state.currentTopic?.name || 'Neznámé téma')}</h1>
             <p class="subtitle">Vygenerováno: ${new Date().toLocaleString('cs-CZ')}</p>
             <hr>`;

             // Clone messages, remove avatar, add basic classes for PDF styling
             Array.from(ui.chatMessages.children).forEach(msgElement => {
                if (msgElement.classList.contains('chat-message') && !msgElement.id.startsWith('thinking-')) {
                    const clone = msgElement.cloneNode(true);
                    clone.querySelector('.message-avatar')?.remove(); // Remove avatar div
                    clone.querySelector('.tts-listen-btn')?.remove(); // Remove TTS button
                    clone.classList.add('msg'); // Add generic message class
                    // Add user/model class based on original
                    if(msgElement.classList.contains('user')) clone.classList.add('user');
                    else clone.classList.add('model');
                    clone.querySelector('.message-bubble')?.classList.add('bubble');
                    clone.querySelector('.message-timestamp')?.classList.add('time');
                    elementToExport.appendChild(clone);
                }
            });

            const filename = `chat-${state.currentTopic?.name?.replace(/[^a-z0-9]/gi, '_') || 'vyuka'}-${Date.now()}.pdf`;
            const pdfOptions = { margin: 15, filename: filename, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, logging: false }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };

            try {
                await html2pdf().set(pdfOptions).from(elementToExport).save();
                showToast("Chat uložen jako PDF!", "success");
            } catch (e) {
                console.error("PDF Generation Error:", e);
                showToast("Chyba při generování PDF.", "error");
            }
        };


        // --- Gemini Interaction & Parsing ---
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
                     } else { // Assume rest is markdown if end ``` is missing (less robust)
                         boardMarkdown = rawText.substring(blockStart + 3).trim();
                         console.warn("parseGeminiResponse: Missing closing ``` for board markdown.");
                     }
                 }
             }

             // Extract TTS Commentary
             if (ttsStart !== -1) {
                 // Find the start of the next block or end of string
                 let commentaryEnd = rawText.length; // Default to end of string
                 let nextMarkerPos = -1;

                 // Find the position of the next potential marker AFTER the TTS marker starts
                 if (boardStart > ttsStart + ttsMarker.length) {
                      nextMarkerPos = boardStart;
                 }
                 // Add checks for other potential future markers here if needed

                 if (nextMarkerPos !== -1) {
                      commentaryEnd = nextMarkerPos;
                 }

                 ttsCommentary = rawText.substring(ttsStart + ttsMarker.length, commentaryEnd).trim();
             }


             // Determine Chat Text (more robust extraction)
             let lastIndex = 0;
             let textSegments = [];

             const markers = [];
             if (boardStart !== -1) markers.push({ start: boardStart, end: boardStart + boardMarker.length + (boardMarkdown.length > 0 ? boardMarkdown.length + 6 : 0) }); // +6 for ```\n and \n```
             if (ttsStart !== -1) markers.push({ start: ttsStart, end: ttsStart + ttsMarker.length + ttsCommentary.length });

             markers.sort((a, b) => a.start - b.start);

             markers.forEach(marker => {
                 if (marker.start > lastIndex) {
                     textSegments.push(rawText.substring(lastIndex, marker.start));
                 }
                 lastIndex = marker.end;
             });

             // Add any remaining text after the last marker
             if (lastIndex < rawText.length) {
                 textSegments.push(rawText.substring(lastIndex));
             }

             // Join segments, trim whitespace, and filter empty lines
             chatText = textSegments.map(s => s.trim()).filter(s => s.length > 0).join("\n\n").trim();


             console.log("[parseGeminiResponse] Board Markdown:", boardMarkdown ? boardMarkdown.substring(0,100)+"..." : "None");
             console.log("[parseGeminiResponse] TTS Commentary:", ttsCommentary ? ttsCommentary.substring(0,100)+"..." : "None");
             console.log("[parseGeminiResponse] Chat Text:", chatText ? chatText.substring(0,100)+"..." : "None");

             return { boardMarkdown, ttsCommentary, chatText };
          };

        const processGeminiResponse = (rawText, timestamp) => {
            removeThinkingIndicator();
            console.log("Raw Gemini Response Received:", rawText ? rawText.substring(0, 200) + "..." : "Empty Response");
            if (!rawText) {
                handleGeminiError("AI vrátilo prázdnou odpověď.", timestamp);
                return;
            }

            const { boardMarkdown, ttsCommentary, chatText } = parseGeminiResponse(rawText);
            let aiResponded = false;

            // 1. Append content to the whiteboard if present
            if (boardMarkdown) {
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); // Pass commentary or fallback to markdown for TTS button
                console.log("Appended markdown to whiteboard.");
                aiResponded = true;
            }

            // 2. Add chat text if present
            if (chatText) {
                // Pass commentary for TTS only if it exists AND no board content was added (to avoid duplicate TTS trigger)
                const ttsForChat = (ttsCommentary && !boardMarkdown) ? ttsCommentary : null;
                addChatMessage(chatText, 'gemini', true, timestamp, ttsForChat);
                console.log("Displayed text in chat.");
                aiResponded = true;
            }
            // 3. Handle case where ONLY TTS commentary exists (e.g., direct answer to chat question)
            else if (ttsCommentary && !boardMarkdown) {
                // Show a generic message in chat, but make the TTS button speak the commentary
                addChatMessage("(Poslechněte si komentář)", 'gemini', true, timestamp, ttsCommentary);
                console.log("Displayed TTS placeholder in chat.");
                aiResponded = true;
            }

            // 4. Handle cases where AI might not have sent expected content
            if (!aiResponded) {
                 addChatMessage("(AI neodpovědělo očekávaným formátem)", 'gemini', false, timestamp);
                 console.warn("AI sent no usable content for whiteboard or chat according to markers.");
            }

            manageUIState('learning'); // Go back to learning state after response
        };

        // --- Prompts and Gemini Calls ---
        const _buildInitialPrompt = () => {
            const level = state.currentProfile?.skill_level || 'neznámá';
            // Use the description from the current topic (which comes from plan_activities)
            const topicDescription = state.currentTopic?.description || ''; // Use description from plan
            const topicName = state.currentTopic?.name || 'Téma';
            return `Jako AI Tutor vysvětli ZÁKLADY pro aktivitu "${topicName}", která má tento popis: "${topicDescription}". Student má úroveň "${level}". Rozděl vysvětlení na menší logické části. Pro první část:
Formát odpovědi:
[BOARD_MARKDOWN]:
\`\`\`markdown
(Zde napiš KRÁTKÝ A STRUČNÝ Markdown text pro první část vysvětlení na tabuli - klíčové body, vzorec, jednoduchý diagram PŘÍMO K POPISU AKTIVITY. Použij nadpisy, seznamy, zvýraznění, LaTeX pro vzorce \$\$. Používej POUZE nadpisy úrovně ## nebo ###.)
\`\`\`
[TTS_COMMENTARY]:
(Zde napiš PODROBNĚJŠÍ konverzační komentář k první části na tabuli, jako bys mluvil/a k studentovi na úrovni "${level}". Rozveď myšlenky z tabule související s popisem aktivity, přidej kontext nebo jednoduchý příklad.)`;
        };

        const _buildContinuePrompt = () => {
            const level = state.currentProfile?.skill_level || 'neznámá';
            const topicName = state.currentTopic?.name || 'Téma';
            const topicDescription = state.currentTopic?.description || ''; // Use description from plan
            // Consider sending last few board content pieces for context? Limited by token count.
            // const boardContext = state.boardContentHistory.slice(-1).join("\n---\n"); // Last piece only
            return `Pokračuj ve vysvětlování aktivity "${topicName}" (popis: "${topicDescription}") pro studenta s úrovní "${level}". Naváž na předchozí vysvětlení (poslední část historie chatu a tabule je relevantní). Vygeneruj další logickou část.
Formát odpovědi:
[BOARD_MARKDOWN]:
\`\`\`markdown
(Zde napiš další stručnou část Markdown textu pro tabuli. Používej POUZE nadpisy úrovně ## nebo ###.)
\`\`\`
[TTS_COMMENTARY]:
(Zde napiš podrobnější konverzační komentář k NOVÉMU obsahu tabule pro hlasový výstup, přizpůsobený úrovni "${level}" a související s aktivitou.)`;
        };

        const _buildGeminiPayloadContents = (userPrompt) => {
            const level = state.currentProfile?.skill_level || 'neznámá';
            // System instruction defines the expected output format.
            const systemInstruction = `Jsi AI Tutor "Justax". Vyučuješ aktivitu: "${state.currentTopic.name}" (popis: "${state.currentTopic.description}") studenta s úrovní "${level}". Vždy odpovídej ve formátu s bloky [BOARD_MARKDOWN]: \`\`\`markdown ... \`\`\` a [TTS_COMMENTARY]: .... Text pro tabuli má být stručný a strukturovaný (nadpisy ## nebo ###, seznamy, LaTeX $\$). Komentář pro TTS má být podrobnější, konverzační a doplňující k textu na tabuli (jako bys mluvil), přizpůsobený úrovni studenta. Pokud odpovídáš na dotaz studenta v chatu, odpověz pouze běžným textem bez těchto bloků.`;

            // Build the conversation history, limiting its size.
            const history = state.geminiChatContext.slice(-MAX_GEMINI_HISTORY_TURNS * 2); // Get last N turns

            // Current user message
            const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };

            // Construct the full payload contents array
             // Start with the system instruction (as the first user message)
             // Then a model ack to confirm understanding
             // Then the recent history
             // Finally, the current user message
             const contents = [
                 { role: "user", parts: [{ text: systemInstruction }] },
                 { role: "model", parts: [{ text: `Rozumím. Vygeneruji stručný obsah pro tabuli pomocí nadpisů ## nebo ### a podrobnější TTS komentář ve specifikovaném formátu pro aktivitu "${state.currentTopic.name}" a úroveň "${level}", nebo odpovím na dotaz v chatu.` }] },
                 ...history,
                 currentUserMessage
             ];

            return contents;
        };

        const sendToGemini = async (prompt) => {
            if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('AIzaSy') === false) { // Simple check
                showToast("Chyba Konfigurace", "Nebyl nalezen platný API klíč pro AI.", "error");
                updateGeminiThinkingState(false);
                return;
            }
            if (!state.currentTopic) { showToast("Chyba", "Není vybráno žádné téma.", "error"); updateGeminiThinkingState(false); return; }
            if (!navigator.onLine) { showToast("Offline", "Nelze komunikovat s AI bez připojení k internetu.", "warning"); updateGeminiThinkingState(false); return; }

            console.log(`Sending to Gemini: "${prompt.substring(0, 100)}..."`);
            const timestamp = new Date();
            updateGeminiThinkingState(true); // Sets loading state via manager

            const contents = _buildGeminiPayloadContents(prompt);
            const body = {
                contents,
                generationConfig: {
                    temperature: 0.6, // Slightly lower for more focused output
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 4096 // Reduced slightly? Or keep high? Let's keep high for now.
                },
                safetySettings: [ // Adjust as needed, BLOCK_NONE is permissive
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            };

            try {
                const response = await fetch(GEMINI_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    let errorText = `Chyba API (${response.status})`;
                    try { const errData = await response.json(); errorText += `: ${errData?.error?.message || 'Neznámá chyba serveru'}`; }
                    catch (e) { errorText += `: ${await response.text()}`; }
                    throw new Error(errorText);
                }

                const data = await response.json();

                // Check for safety blocks or other issues
                if (data.promptFeedback?.blockReason) {
                    throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}. Zkuste přeformulovat.`);
                }

                const candidate = data.candidates?.[0];
                if (!candidate) {
                     throw new Error('AI neposkytlo platnou odpověď.');
                }

                // Log finish reason for debugging
                if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
                    console.warn(`Gemini finishReason: ${candidate.finishReason}.`);
                    if (candidate.finishReason === 'SAFETY') {
                        throw new Error('Odpověď blokována bezpečnostním filtrem AI.');
                    }
                    // Consider other reasons like RECITATION, OTHER as potential issues
                }

                const text = candidate.content?.parts?.[0]?.text;
                if (!text && candidate.finishReason !== 'STOP') {
                    // If no text AND finishReason is not STOP, it's likely an issue.
                    if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Odpověď AI byla příliš dlouhá (Max Tokens).');
                    else throw new Error('AI vrátilo prázdnou odpověď (Důvod: '+(candidate.finishReason || 'Neznámý')+').');
                }

                // Store context BEFORE processing (important for history)
                state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] });
                state.geminiChatContext.push({ role: "model", parts: [{ text: text || "" }] }); // Store even if empty, for context

                // Limit chat history size
                if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2) {
                    state.geminiChatContext.splice(0, state.geminiChatContext.length - (MAX_GEMINI_HISTORY_TURNS * 2));
                }

                processGeminiResponse(text || "", timestamp); // Process the response (handles empty string)

            } catch (error) {
                console.error('Chyba komunikace s Gemini:', error);
                showToast(`Chyba AI: ${error.message}`, "error");
                handleGeminiError(error.message, timestamp); // Add error message to chat
            } finally {
                updateGeminiThinkingState(false); // Ensure thinking state is reset
            }
        };

        const handleGeminiError = (msg, time) => {
            addChatMessage(`Nastala chyba při komunikaci s AI: ${msg}`, 'gemini', false, time);
            // Don't call updateGeminiThinkingState(false) here, it's called in sendToGemini's finally block
            manageUIState('learning'); // Keep the user in the learning interface
        };

        // --- Notification Logic ---
         // Visual map for icons based on type
         const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

         async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) {
             if (!state.supabase || !userId) { console.error("[Notifications] Missing Supabase or User ID."); return { unreadCount: 0, notifications: [] }; }
             console.log(`[Notifications] Fetching unread notifications for user ${userId}`);
             setLoadingState('notifications', true);
             try {
                 // Fetch unread notifications, ordered by creation date descending
                 const { data, error, count } = await state.supabase
                     .from('user_notifications')
                     .select('*', { count: 'exact' }) // Request the total count of matching rows
                     .eq('user_id', userId)
                     .eq('is_read', false)
                     .order('created_at', { ascending: false })
                     .limit(limit);

                 if (error) throw error;
                 console.log(`[Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`);
                 return { unreadCount: count ?? 0, notifications: data || [] }; // Return count and limited data
             } catch (error) {
                 console.error("[Notifications] Exception fetching notifications:", error);
                 showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error');
                 return { unreadCount: 0, notifications: [] };
             } finally {
                 setLoadingState('notifications', false); // Stop loading indicator
             }
         }

         function renderNotifications(count, notifications) {
             console.log("[Render Notifications] Start, Count:", count, "Notifications:", notifications);
             // Ensure all necessary UI elements exist
             if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
                 console.error("[Render Notifications] Missing UI elements for notifications.");
                 return;
             }

             // Update badge count display
             ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
             ui.notificationCount.classList.toggle('visible', count > 0);

             // Populate the list or show the "no notifications" message
             if (notifications && notifications.length > 0) {
                 ui.notificationsList.innerHTML = notifications.map(n => {
                      const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default;
                      const isReadClass = n.is_read ? 'is-read' : '';
                      const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; // Add data attribute for link
                     // Generate HTML for each notification item
                     return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
                                 ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
                                 <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div>
                                 <div class="notification-content">
                                     <div class="notification-title">${sanitizeHTML(n.title)}</div>
                                     <div class="notification-message">${sanitizeHTML(n.message)}</div>
                                     <div class="notification-time">${formatRelativeTime(n.created_at)}</div>
                                 </div>
                             </div>`;
                 }).join('');
                 ui.noNotificationsMsg.style.display = 'none'; // Hide "no message" text
                 ui.notificationsList.style.display = 'block'; // Show the list
                 ui.markAllReadBtn.disabled = count === 0; // Enable/disable "mark all read"
             } else {
                 ui.notificationsList.innerHTML = ''; // Clear list
                 ui.noNotificationsMsg.style.display = 'block'; // Show "no message" text
                 ui.notificationsList.style.display = 'none'; // Hide the list container
                 ui.markAllReadBtn.disabled = true; // Disable "mark all read"
             }
             console.log("[Render Notifications] Finished rendering.");
         }

         async function markNotificationRead(notificationId) {
             console.log("[Notifications] Marking notification as read:", notificationId);
             if (!state.currentUser || !notificationId || !state.supabase) return false;
             try {
                 const { error } = await state.supabase
                     .from('user_notifications')
                     .update({ is_read: true })
                     .eq('user_id', state.currentUser.id)
                     .eq('id', notificationId);
                 if (error) throw error;
                 console.log("[Notifications] Mark as read successful for ID:", notificationId);
                 return true;
             } catch (error) {
                 console.error("[Notifications] Mark as read error:", error);
                 showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error');
                 return false;
             }
         }

         async function markAllNotificationsRead() {
             console.log("[Notifications] Marking all as read for user:", state.currentUser?.id);
             if (!state.currentUser || !ui.markAllReadBtn || !state.supabase) return;

             setLoadingState('notifications', true); // Show loading state
             try {
                 // Update all unread notifications for the current user
                 const { error } = await state.supabase
                     .from('user_notifications')
                     .update({ is_read: true })
                     .eq('user_id', state.currentUser.id)
                     .eq('is_read', false);

                 if (error) throw error;
                 console.log("[Notifications] Mark all as read successful in DB.");

                 // Refetch and re-render notifications to update the UI
                 const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT);
                 renderNotifications(unreadCount, notifications);
                 showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success');
             } catch (error) {
                 console.error("[Notifications] Mark all as read error:", error);
                 showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error');
             } finally {
                 setLoadingState('notifications', false); // Hide loading state
             }
         }
        // --- END: Notification Logic ---

        // --- Run Application ---
        document.addEventListener('DOMContentLoaded', initializeApp);

    } catch (e) {
        // --- Fatal Error Handling ---
        console.error("FATAL SCRIPT ERROR:", e);
        // Display a user-friendly error message covering the entire screen
        document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--accent-pink);color:var(--white);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky. Skript narazil na neočekávaný problém.</p><p style="margin-top:15px;"><a href="#" onclick="location.reload()" style="color:var(--accent-cyan); text-decoration:underline; font-weight:bold;">Obnovit stránku</a></p><details style="margin-top: 20px; color: #f0f0f0;"><summary style="cursor:pointer; color: var(--white);">Technické detaily</summary><pre style="margin-top:10px;padding:15px;background:rgba(var(--black), 0.4);border:1px solid rgba(var(--white-rgb), 0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;max-height: 300px; overflow-y: auto; border-radius: 8px;">${e.message}\n${e.stack}</pre></details></div>`;
    }

})(); // End IIFE