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
            // Sidebar & User Info (NEW IDs)
            sidebar: document.getElementById('sidebar'),
            mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'), // Header toggle
            sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),   // Sidebar close button
            sidebarAvatar: document.getElementById('sidebar-avatar'),
            sidebarName: document.getElementById('sidebar-name'),
             currentYearSidebar: document.getElementById('currentYearSidebar'),
            // Header & Notifications (NEW Elements/IDs)
            dashboardHeader: document.querySelector('.dashboard-header'),
            notificationBell: document.getElementById('notification-bell'),
            notificationCount: document.getElementById('notification-count'),
            notificationsDropdown: document.getElementById('notifications-dropdown'),
            notificationsList: document.getElementById('notifications-list'),
            noNotificationsMsg: document.getElementById('no-notifications-msg'),
            markAllReadBtn: document.getElementById('mark-all-read'),
            // Main Content & Vyuka specific
            mainContent: document.getElementById('main-content'),
            topicBar: document.querySelector('.topic-bar'),
            currentTopicDisplay: document.getElementById('current-topic-display'),
            continueBtn: document.getElementById('continue-btn'), // Keep continue button for topic
            learningInterface: document.querySelector('.call-interface'),
            aiPresenterArea: document.querySelector('.ai-presenter-area'),
            aiPresenterHeader: document.querySelector('.ai-presenter-header'), // Added for potential styling
            aiAvatarPlaceholder: document.querySelector('.ai-avatar-placeholder'), // Added
            aiStatusText: document.getElementById('ai-status-text'), // Added
            clearBoardBtn: document.getElementById('clear-board-btn'),
            whiteboardContainer: document.getElementById('whiteboard-container'),
            whiteboardContent: document.getElementById('whiteboard-content'),
            boardSpeakingIndicator: document.getElementById('board-speaking-indicator'),
            interactionPanel: document.querySelector('.interaction-panel'),
            interactionTabs: document.querySelector('.interaction-tabs'),
            chatTabContent: document.getElementById('chat-tab-content'),
            chatTabButton: document.querySelector('.interaction-tab[data-tab="chat-tab"]'),
            chatHeader: document.querySelector('.chat-header'), // Added
            chatMessages: document.getElementById('chat-messages'),
            chatInput: document.getElementById('chat-input'),
            sendButton: document.getElementById('send-button'),
            chatControls: document.querySelector('.chat-controls'), // Added
            micBtn: document.getElementById('mic-btn'),
            clearChatBtn: document.getElementById('clear-chat-btn'),
            saveChatBtn: document.getElementById('save-chat-btn'),
            aiAvatarCorner: document.getElementById('ai-avatar-corner'),
            stopSpeechBtn: document.getElementById('stop-speech-btn'),
            markCompleteBtn: document.getElementById('mark-complete-btn'),
            // Feedback & Footer
            toastContainer: document.getElementById('toast-container'),
            globalError: document.getElementById('global-error'),
            dashboardFooter: document.querySelector('.dashboard-footer'),
            currentYearFooter: document.getElementById('currentYearFooter'),
            // Mouse Follower
            mouseFollower: document.getElementById('mouse-follower')
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
            isLoading: { // Added loading state management
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
        const sanitizeHTML = (str) => { const t = document.createElement('div'); t.textContent = str || ''; return t.innerHTML; };
        const getInitials = (profileData, email) => { /* ... (Copied from test1.js) ... */ if (!profileData && !email) return '?'; let i = ''; if (profileData?.first_name) i += profileData.first_name[0]; if (profileData?.last_name) i += profileData.last_name[0]; if (i) return i.toUpperCase(); if (profileData?.username) return profileData.username[0].toUpperCase(); if (email) return email[0].toUpperCase(); return 'Pilot'; }; // Changed fallback to Pilot
        const formatTimestamp = (d = new Date()) => d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        const formatRelativeTime = (timestamp) => { /* ... (Copied from test1.js) ... */ if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } };
        const openMenu = () => { /* ... (Copied from test1.js) ... */ if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } };
        const closeMenu = () => { /* ... (Copied from test1.js) ... */ if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } };
        const renderMarkdown = (el, text) => { if (!el) return; try { marked.setOptions({ gfm: true, breaks: true }); el.innerHTML = marked.parse(text || ''); if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { setTimeout(() => { window.MathJax.typesetPromise([el]).catch(e => console.error("MathJax typesetting error:", e)); }, 0); } } catch (e) { console.error("Markdown rendering error:", e); el.innerHTML = `<p style="color:var(--accent-pink);">Chyba renderování.</p>`; } };
        const autoResizeTextarea = () => { if (!ui.chatInput) return; ui.chatInput.style.height = 'auto'; const sh = ui.chatInput.scrollHeight; const mh = 110; ui.chatInput.style.height = `${Math.min(sh, mh)}px`; ui.chatInput.style.overflowY = sh > mh ? 'scroll' : 'hidden'; };
        const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const getBoardBackgroundColor = () => state.isDarkMode ? 'var(--board-bg-dark)' : 'var(--board-bg-light)';
        const initTooltips = () => { /* ... (Copied from test1.js) ... */ try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Tooltipster error:", e); } };
        const updateOnlineStatus = () => { /* ... (Copied from test1.js) ... */ if (ui.offlineBanner) { ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; } if (!navigator.onLine) { showToast('Offline', 'Spojení bylo ztraceno. Některé funkce nemusí být dostupné.', 'warning'); } };
        const updateCopyrightYear = () => { /* ... (Copied from test1.js) ... */ const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
        const initMouseFollower = () => { /* ... (Copied from test1.js) ... */ const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
        const initScrollAnimations = () => { /* ... (Copied from test1.js) ... */ const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) { console.log("Scroll animations not initialized."); return; } const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
        const initHeaderScrollDetection = () => { /* ... (Copied from test1.js) ... */ let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); };
        // Added loading state management function
        const setLoadingState = (sectionKey, isLoadingFlag) => {
             if (state.isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;
             if (sectionKey === 'all') { Object.keys(state.isLoading).forEach(key => state.isLoading[key] = isLoadingFlag); }
             else { state.isLoading[sectionKey] = isLoadingFlag; }
             console.log(`[SetLoading] ${sectionKey}: ${isLoadingFlag}`);

             // Handle notification bell state
             if (sectionKey === 'notifications' && ui.notificationBell) {
                 ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                 if (ui.markAllReadBtn) {
                     const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                     ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
                 }
             }
             // Add more specific UI updates based on sectionKey if needed
         };

        // --- TTS/STT Functions (Mostly Unchanged, added Dark Mode awareness for highlighting) ---
        const loadVoices = () => { /* ... (no changes) ... */ if (!state.speechSynthesisSupported) return; try { const voices = window.speechSynthesis.getVoices(); if (!voices || voices.length === 0) { console.warn("No voices available yet."); return; } console.log('Available voices:', voices.map(v => ({ name: v.name, lang: v.lang, default: v.default }))); let preferredVoice = voices.find(voice => voice.lang === 'cs-CZ' && /female|žena|ženský|iveta|zuzana/i.test(voice.name)); if (!preferredVoice) { preferredVoice = voices.find(voice => voice.lang === 'cs-CZ'); } if (!preferredVoice) { preferredVoice = voices.find(voice => voice.lang.startsWith('cs')); } if (!preferredVoice) { preferredVoice = voices.find(v => v.default) || voices[0]; } state.czechVoice = preferredVoice; console.log("Selected voice:", state.czechVoice?.name, state.czechVoice?.lang); } catch (e) { console.error("Error loading voices:", e); state.czechVoice = null; } };
        const removeBoardHighlight = () => { if (state.currentlyHighlightedChunk) { state.currentlyHighlightedChunk.classList.remove('speaking-highlight'); state.currentlyHighlightedChunk = null; } };
        const speakText = (text, targetChunkElement = null) => { /* ... (Added highlight handling logic) ... */
            if (!state.speechSynthesisSupported) { showToast("Syntéza řeči není podporována.", "warning"); return; }
            if (!text) { console.warn("TTS: No text provided."); return; }
            const plainText = text.replace(/<[^>]*>/g, ' ').replace(/[`*#_~[\]()]/g, '').replace(/\$\$(.*?)\$\$/g, 'matematický vzorec').replace(/\$(.*?)\$/g, 'vzorec').replace(/\s+/g, ' ').trim();
            if (!plainText) { console.warn("TTS: Text empty after cleaning."); return; }
            window.speechSynthesis.cancel(); removeBoardHighlight();
            const utterance = new SpeechSynthesisUtterance(plainText);
            utterance.lang = 'cs-CZ'; utterance.rate = 0.9; utterance.pitch = 1.0;
            if (state.czechVoice) { utterance.voice = state.czechVoice; }
            else { loadVoices(); if (state.czechVoice) utterance.voice = state.czechVoice; else console.warn("Czech voice not found, using default."); }
            utterance.onstart = () => { console.log("TTS started."); ui.aiAvatarCorner?.classList.add('speaking'); ui.boardSpeakingIndicator?.classList.add('active'); if (targetChunkElement) { targetChunkElement.classList.add('speaking-highlight'); state.currentlyHighlightedChunk = targetChunkElement; } };
            utterance.onend = () => { console.log("TTS finished."); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); removeBoardHighlight(); };
            utterance.onerror = (event) => { console.error('SpeechSynthesisUtterance.onerror', event); showToast(`Chyba při čtení: ${event.error}`, 'error'); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); removeBoardHighlight(); };
            console.log(`TTS: Speaking with voice: ${utterance.voice?.name}, lang: ${utterance.lang}`);
            window.speechSynthesis.speak(utterance);
        };
        const stopSpeech = () => { /* ... (no changes) ... */ if (state.speechSynthesisSupported) { window.speechSynthesis.cancel(); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); removeBoardHighlight(); console.log("Speech cancelled."); } };
        const initializeSpeechRecognition = () => { /* ... (no changes) ... */ if (!state.speechRecognitionSupported) { console.warn("Speech Recognition not supported."); if(ui.micBtn) { ui.micBtn.disabled = true; ui.micBtn.title = "Rozpoznávání řeči není podporováno"; } return; } const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; state.speechRecognition = new SpeechRecognition(); state.speechRecognition.lang = 'cs-CZ'; state.speechRecognition.interimResults = false; state.speechRecognition.maxAlternatives = 1; state.speechRecognition.continuous = false; state.speechRecognition.onresult = (event) => { const transcript = event.results[0][0].transcript; console.log('Speech recognized:', transcript); if (ui.chatInput) { ui.chatInput.value = transcript; autoResizeTextarea(); } }; state.speechRecognition.onerror = (event) => { console.error('Speech recognition error:', event.error); let errorMsg = "Chyba rozpoznávání řeči"; if (event.error === 'no-speech') errorMsg = "Nerozpoznal jsem žádnou řeč."; else if (event.error === 'audio-capture') errorMsg = "Chyba mikrofonu."; else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { errorMsg = "Přístup k mikrofonu zamítnut."; if(ui.micBtn) ui.micBtn.disabled = true; } showToast(errorMsg, 'error'); stopListening(); }; state.speechRecognition.onend = () => { console.log('Speech recognition ended.'); stopListening(); }; state.speechRecognition.onaudiostart = () => console.log('Audio capture started.'); state.speechRecognition.onaudioend = () => console.log('Audio capture ended.'); state.speechRecognition.onspeechstart = () => console.log('Speech detected.'); state.speechRecognition.onspeechend = () => console.log('Speech ended.'); console.log("Speech Recognition initialized."); };
        const startListening = () => { /* ... (no changes) ... */ if (!state.speechRecognitionSupported || !state.speechRecognition || state.isListening) return; navigator.mediaDevices.getUserMedia({ audio: true }) .then(() => { try { state.speechRecognition.start(); state.isListening = true; ui.micBtn?.classList.add('listening'); if(ui.micBtn) ui.micBtn.title = "Zastavit hlasový vstup"; console.log('Speech recognition started.'); } catch (e) { console.error("Error starting speech recognition:", e); showToast("Nepodařilo se spustit rozpoznávání.", "error"); stopListening(); } }) .catch(err => { console.error("Microphone access denied:", err); showToast("Přístup k mikrofonu je nutný pro hlasový vstup.", "warning"); if(ui.micBtn) ui.micBtn.disabled = true; stopListening(); }); };
        const stopListening = () => { /* ... (no changes) ... */ if (!state.speechRecognitionSupported || !state.speechRecognition || !state.isListening) return; try { state.speechRecognition.stop(); } catch (e) {} finally { state.isListening = false; ui.micBtn?.classList.remove('listening'); if(ui.micBtn) ui.micBtn.title = "Zahájit hlasový vstup"; console.log('Speech recognition stopped.'); } };
        const handleMicClick = () => { /* ... (no changes) ... */ if (!state.speechRecognitionSupported) { showToast("Rozpoznávání řeči není podporováno.", "warning"); return; } if (state.isListening) stopListening(); else startListening(); };

        // --- Initialization ---
        const initializeSupabase = () => { /* ... (no changes) ... */ try { if (!window.supabase) throw new Error("Supabase library not loaded."); state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); if (!state.supabase) throw new Error("Client creation failed."); console.log("Supabase initialized."); return true; } catch (error) { console.error("Supabase init failed:", error); showToast("Chyba DB.", "error", 10000); return false; } };
        const initializeUI = () => { // Integrate Cyberpunk UI setup
            try {
                updateTheme(); // Apply theme to board
                setupEventListeners(); // Setup all listeners
                initTooltips(); // Initialize tooltips
                // Ensure only chat tab is active/visible (if applicable, might be removed)
                if (ui.chatTabButton) ui.chatTabButton.classList.add('active');
                if (ui.chatTabContent) ui.chatTabContent.classList.add('active');
                // Load TTS voices
                if (state.speechSynthesisSupported) { if (window.speechSynthesis.getVoices().length > 0) loadVoices(); else if (window.speechSynthesis.onvoiceschanged !== undefined) window.speechSynthesis.onvoiceschanged = loadVoices; }
                else console.warn("Speech Synthesis not supported.");
                // Initialize STT
                initializeSpeechRecognition();
                // Initialize Cyberpunk specific UI
                initMouseFollower();
                initHeaderScrollDetection();
                updateCopyrightYear();
                updateOnlineStatus(); // Initial online status check

                manageUIState('initial'); // Set initial UI state for buttons etc.
                console.log("UI Initialized successfully.");
                return true;
            } catch(error) {
                console.error("UI Init failed:", error);
                showError(`Chyba inicializace UI: ${error.message}`, true);
                return false;
            }
        };
        // Updated initializeApp
        const initializeApp = async () => {
            console.log("🚀 [Init Vyuka - Kyber] Starting...");
            if (!initializeSupabase()) return;

            if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
            if (ui.mainContent) ui.mainContent.style.display = 'none';

            try {
                const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
                if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);

                if (!session || !session.user) {
                    console.log('[Init Vyuka - Kyber] Not logged in. Redirecting...');
                    window.location.href = '/auth/index.html'; // <-- REDIRECT
                    return;
                }
                state.currentUser = session.user;
                setLoadingState('user', true);
                state.currentProfile = await fetchUserProfile(state.currentUser.id); // Fetch profile
                updateUserInfoUI(); // Update sidebar info
                setLoadingState('user', false);

                if (!state.currentProfile) {
                    showError("Profil nenalezen.", true);
                    if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }
                    if (ui.mainContent) ui.mainContent.style.display = 'block';
                    return;
                }

                if (!initializeUI()) return; // Initialize UI AFTER profile load attempt

                // Load notifications concurrently with topic loading
                const loadNotificationsPromise = fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
                    .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                    .catch(err => {
                        console.error("Chyba při úvodním načítání notifikací:", err);
                        renderNotifications(0, []); // Render empty state on error
                    });

                // Load first topic
                const loadTopicPromise = loadNextUncompletedTopic();

                await Promise.all([loadNotificationsPromise, loadTopicPromise]); // Wait for both

                 // Hide loader and show content AFTER initial data load attempt
                 if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
                 if (ui.mainContent) { ui.mainContent.style.display = 'flex'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); }); } // Use flex for main

                 requestAnimationFrame(initScrollAnimations); // Start animations

                console.log("✅ [Init Vyuka - Kyber] Page Initialized.");

            } catch (error) {
                console.error("❌ [Init Vyuka - Kyber] Error:", error);
                if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">Chyba (${error.message}). Obnovte.</p>`; }
                else { showError(`Chyba inicializace: ${error.message}`, true); }
                if (ui.mainContent) ui.mainContent.style.display = 'block';
                setLoadingState('all', false);
            }
        };


        // --- UI State & Button Management (Minor adjustments for consistency) ---
        const manageUIState = (mode, options = {}) => {
            console.log("[UI State]:", mode, options);
            const isLearning = ['learning', 'chatting', 'requestingExplanation'].includes(mode);
            const showLearningInterface = !!state.currentTopic || ['loadingTopic', 'requestingExplanation', 'noPlan', 'planComplete', 'error'].includes(mode) || mode.startsWith('initial');

            if (ui.learningInterface) {
                ui.learningInterface.style.display = showLearningInterface ? 'flex' : 'none';
            }

            if (ui.chatMessages && !isLearning && !['initial', 'loadingUser', 'loadingTopic'].includes(mode)) {
                let emptyStateHTML = '';
                switch (mode) {
                    case 'loggedOut': emptyStateHTML = "<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPŘIHLÁŠEN</h3><p>Pro přístup se prosím přihlaste.</p></div>"; break;
                    case 'noPlan': emptyStateHTML = "<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ŽÁDNÝ AKTIVNÍ PLÁN</h3><p>Nemáte aktivní studijní plán. Nejprve dokončete diagnostický test.</p></div>"; break;
                    case 'planComplete': emptyStateHTML = "<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLÁN DOKONČEN!</h3><p>Všechny naplánované aktivity jsou hotové. Skvělá práce!</p></div>"; break;
                    case 'error': emptyStateHTML = `<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA SYSTÉMU</h3><p>${options.errorMessage || 'Nastala chyba při načítání dat.'}</p></div>`; break;
                    case 'initial': emptyStateHTML = `<div class='empty-state'><i class="fas fa-user-circle"></i><h3>AUTENTIZACE...</h3></div>`; break;
                    case 'loadingUser': emptyStateHTML = `<div class='empty-state'><i class="fas fa-user-circle"></i><h3>NAČÍTÁNÍ PROFILU...</h3></div>`; break;
                    case 'loadingTopic': emptyStateHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>NAČÍTÁNÍ TÉMATU...</h3></div>'; break;
                    default: emptyStateHTML = '';
                }
                if (emptyStateHTML || ui.chatMessages.children.length === 0 || ['loggedOut', 'noPlan', 'planComplete', 'error'].includes(mode)) {
                    ui.chatMessages.innerHTML = emptyStateHTML;
                }
            }
            manageButtonStates(); // Update buttons based on the new state
        };
        const manageButtonStates = () => { // Added mic button state
             const canInteractNormally = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress;
             const canContinue = state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress; // Specific condition for continue/complete

             if (ui.sendButton) { ui.sendButton.disabled = !canInteractNormally; ui.sendButton.innerHTML = state.geminiIsThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>'; }
             if (ui.chatInput) { ui.chatInput.disabled = !canInteractNormally; ui.chatInput.placeholder = canInteractNormally ? "Zeptejte se na cokoliv..." : "Počkejte prosím..."; }
             if (ui.continueBtn) { ui.continueBtn.disabled = !canContinue; ui.continueBtn.style.display = canContinue ? 'inline-flex' : 'none'; }
             if (ui.markCompleteBtn) { ui.markCompleteBtn.disabled = !canContinue; ui.markCompleteBtn.style.display = canContinue ? 'inline-flex' : 'none'; }
             if (ui.clearBoardBtn) { ui.clearBoardBtn.disabled = !ui.whiteboardContent || state.geminiIsThinking; }
             if (ui.stopSpeechBtn) { ui.stopSpeechBtn.disabled = !state.speechSynthesisSupported; } // Always enabled if supported for now

             // Mic button state
             if (ui.micBtn) {
                 const canUseMic = canInteractNormally && state.speechRecognitionSupported;
                 ui.micBtn.disabled = !canUseMic || state.isListening;
                 ui.micBtn.classList.toggle('listening', state.isListening);
                 ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporováno" : state.isListening ? "Zastavit hlasový vstup" : "Zahájit hlasový vstup";
             }
        };

        // --- Whiteboard Div Functions (Added Dark Mode awareness) ---
        const updateTheme = () => {
            console.log("Updating theme, isDarkMode:", state.isDarkMode);
            // No longer needed to set background/border/text color via JS, CSS handles it
            // Update highlight class for board based on theme - CSS handles this now with vars
            document.documentElement.style.setProperty('--board-highlight-color', state.isDarkMode ? 'var(--board-highlight-dark)' : 'var(--board-highlight-light)');
            // Re-apply highlight if necessary (CSS variable change should handle it)
            if (state.currentlyHighlightedChunk) {
                 // The class 'speaking-highlight' is now theme-agnostic
                 // state.currentlyHighlightedChunk.classList.remove(state.isDarkMode ? 'speaking-highlight-light' : 'speaking-highlight-dark');
                 // state.currentlyHighlightedChunk.classList.add(state.isDarkMode ? 'speaking-highlight-dark' : 'speaking-highlight-light');
             }
        };
        const clearWhiteboard = (showToastMsg = true) => { /* ... (no changes) ... */ if (!ui.whiteboardContent) return; ui.whiteboardContent.innerHTML = ''; state.boardContentHistory = []; console.log("Whiteboard cleared."); if (showToastMsg) showToast('Vymazáno', "Tabule vymazána.", "info"); };
        const appendToWhiteboard = (markdownContent, commentaryText) => { /* ... (no changes) ... */
             if (!ui.whiteboardContent || !ui.whiteboardContainer) return;
             const chunkDiv = document.createElement('div'); chunkDiv.className = 'whiteboard-chunk';
             const contentDiv = document.createElement('div'); renderMarkdown(contentDiv, markdownContent);
             const ttsButton = document.createElement('button'); ttsButton.className = 'tts-listen-btn btn-tooltip'; ttsButton.title = 'Poslechnout komentář'; ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
             const textForSpeech = commentaryText || markdownContent; ttsButton.dataset.textToSpeak = textForSpeech;
             if (state.speechSynthesisSupported) { ttsButton.addEventListener('click', () => { speakText(textForSpeech, chunkDiv); }); }
             chunkDiv.appendChild(contentDiv);
             if (state.speechSynthesisSupported) { chunkDiv.appendChild(ttsButton); }
             ui.whiteboardContent.appendChild(chunkDiv); state.boardContentHistory.push(markdownContent);
             ui.whiteboardContainer.scrollTop = ui.whiteboardContainer.scrollHeight;
             console.log("Appended content to whiteboard."); initTooltips();
        };

        // --- User Profile & Auth (Using Cyberpunk Theme IDs) ---
        const loadUserProfile = async () => { // Integrated with state.currentUser/Profile
            if (!state.supabase || !state.currentUser) return null;
            console.log(`[Profile] Fetching profile for user ID: ${state.currentUser.id}`);
            setLoadingState('user', true);
            try {
                const { data: profile, error } = await state.supabase.from('profiles').select('*').eq('id', state.currentUser.id).single();
                if (error && error.code !== 'PGRST116') throw error;
                if (!profile) { console.warn(`[Profile] Profile not found for user ${state.currentUser.id}.`); return null; }
                console.log("[Profile] Profile data fetched.");
                return profile;
            } catch (error) {
                console.error('[Profile] Exception fetching profile:', error);
                showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error');
                return null;
            } finally {
                setLoadingState('user', false);
            }
        };
        const updateUserInfoUI = () => { // Updated for Cyberpunk IDs
             if (!ui.sidebarName || !ui.sidebarAvatar) return;
             if (state.currentUser && state.currentProfile) {
                 const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot';
                 ui.sidebarName.textContent = sanitizeHTML(displayName);
                 const initials = getInitials(state.currentProfile, state.currentUser.email);
                 ui.sidebarAvatar.innerHTML = state.currentProfile.avatar_url ? `<img src="${state.currentProfile.avatar_url}" alt="${initials}">` : initials;
             } else {
                 ui.sidebarName.textContent = 'Nepřihlášen';
                 ui.sidebarAvatar.textContent = '?';
             }
         };
        const handleLoggedOutUser = () => { console.warn("User not logged in."); if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder">Nejste přihlášeni</span>'; showToast("Prosím, přihlaste se.", "warning"); manageUIState('loggedOut'); };

        // --- Event Listeners Setup (Updated for Cyberpunk Theme) ---
        const setupEventListeners = () => {
            console.log("[SETUP] Setting up event listeners...");
            // Sidebar/Menu (NEW IDs)
            if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
            if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
            if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
            // Keep original Vyuka listeners
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
            if (ui.chatMessages) { ui.chatMessages.addEventListener('click', (event) => { const button = event.target.closest('.tts-listen-btn'); if (button) { const text = button.dataset.textToSpeak; if (text) { speakText(text); } else { console.warn("No text found for TTS button in chat."); } } }); }
            // Event delegation for TTS on whiteboard (now handled directly in appendToWhiteboard)
            // Theme change listener
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => { state.isDarkMode = event.matches; console.log("Theme changed, isDarkMode:", state.isDarkMode); updateTheme(); });
            // Resize listener
            window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) closeMenu(); });
            // Online/Offline listeners
            window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus);
             // Notification listeners (NEW)
             if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
             if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); }
             if (ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }); }
             document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } });
            console.log("Event listeners setup complete.");
        };

        // --- Topic Loading and Progress (Minor changes for state flags) ---
        const loadNextUncompletedTopic = async () => {
            if (!state.currentUser || state.topicLoadInProgress || !state.supabase) return;
            state.topicLoadInProgress = true; setLoadingState('currentTopic', true); // Use loading state
            state.currentTopic = null;
            if (ui.chatMessages) ui.chatMessages.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>NAČÍTÁM DALŠÍ TÉMA...</h3></div>';
            clearWhiteboard(false); state.geminiChatContext = [];
            if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> HLEDÁM...</span>';
            manageUIState('loadingTopic');
            try {
                // ... (rest of the Supabase query logic remains the same) ...
                 const { data: plans } = await state.supabase.from('study_plans').select('id').eq('user_id', state.currentUser.id).eq('status', 'active').limit(1); if (!plans || plans.length === 0) { manageUIState('noPlan'); return; } state.currentPlanId = plans[0].id; const { data: activities } = await state.supabase.from('plan_activities').select('id, title, description, topic_id').eq('plan_id', state.currentPlanId).eq('completed', false).order('day_of_week').order('time_slot').limit(1); if (activities && activities.length > 0) { const activity = activities[0]; let name = activity.title || 'N/A', desc = activity.description || ''; if (activity.topic_id) { try { const { data: topic } = await state.supabase.from('exam_topics').select('name, description').eq('id', activity.topic_id).single(); if (topic) { name = topic.name || name; desc = topic.description || desc; } } catch(e){ console.warn("Could not fetch topic details", e) } } state.currentTopic = { activity_id: activity.id, plan_id: state.currentPlanId, name, description: desc, user_id: state.currentUser.id, topic_id: activity.topic_id }; if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(name)}</strong>`; await startLearningSession(); } else { manageUIState('planComplete'); }
            } catch (error) {
                console.error('Error loading topic:', error);
                showToast(`Chyba načítání tématu: ${error.message}`, "error");
                manageUIState('error', { errorMessage: error.message });
            } finally {
                state.topicLoadInProgress = false; setLoadingState('currentTopic', false); // Stop loading state
                manageButtonStates();
            }
        };
        const handleMarkTopicComplete = async () => { /* ... (no changes needed) ... */ if (!state.currentTopic || !state.supabase || state.topicLoadInProgress) return; state.topicLoadInProgress = true; manageButtonStates(); try { await state.supabase.from('plan_activities').update({ completed: true, updated_at: new Date().toISOString() }).eq('id', state.currentTopic.activity_id); showToast(`Téma "${state.currentTopic.name}" dokončeno.`, "success"); await loadNextUncompletedTopic(); } catch (error) { console.error(`Error marking complete:`, error); showToast("Chyba při označování tématu.", "error"); state.topicLoadInProgress = false; manageButtonStates(); } };

        // --- Learning Session & Chat (Minor UI adjustments) ---
        const startLearningSession = async () => { if (!state.currentTopic) return; state.currentSessionId = generateSessionId(); manageUIState('requestingExplanation'); const prompt = _buildInitialPrompt(); await sendToGemini(prompt); };
        const requestContinue = async () => { if (state.geminiIsThinking || !state.currentTopic) return; const prompt = _buildContinuePrompt(); await sendToGemini(prompt); };
        const addChatMessage = async (message, sender, saveToDb = true, timestamp = new Date(), ttsText = null) => { /* ... (No functional changes, uses cyberpunk CSS now) ... */
             if (!ui.chatMessages) return;
             const id = `msg-${Date.now()}`;
             const avatarText = sender === 'user' ? getInitials(state.currentProfile, state.currentUser?.email) : 'AI'; // Use Pilot/Initials
             const div = document.createElement('div');
             div.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`;
             div.id = id;
             const avatarDiv = `<div class="message-avatar">${avatarText}</div>`; // Use updated getInitials
             const bubbleDiv = document.createElement('div'); bubbleDiv.className = 'message-bubble';
             const bubbleContentDiv = document.createElement('div'); bubbleContentDiv.className = 'message-bubble-content';
             const textContentSpan = document.createElement('span'); textContentSpan.className = 'message-text-content';
             renderMarkdown(textContentSpan, message);
             bubbleContentDiv.appendChild(textContentSpan);
             if (sender === 'gemini' && state.speechSynthesisSupported) { const ttsButton = document.createElement('button'); ttsButton.className = 'tts-listen-btn btn-tooltip'; ttsButton.title = 'Poslechnout'; ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>'; const textForSpeech = ttsText || message; ttsButton.dataset.textToSpeak = textForSpeech; ttsButton.addEventListener('click', () => speakText(textForSpeech)); bubbleContentDiv.appendChild(ttsButton); }
             bubbleDiv.appendChild(bubbleContentDiv);
             const timeDiv = `<div class="message-timestamp">${formatTimestamp(timestamp)}</div>`;
             div.innerHTML = avatarDiv + bubbleDiv.outerHTML + timeDiv;
             const empty = ui.chatMessages.querySelector('.empty-state'); if(empty) empty.remove();
             ui.chatMessages.appendChild(div);
             div.scrollIntoView({ behavior: 'smooth', block: 'end' });
             initTooltips(); // Re-init for new buttons
             if (saveToDb && state.supabase && state.currentUser && state.currentTopic && state.currentSessionId) { try { await state.supabase.from('chat_history').insert({ user_id: state.currentUser.id, session_id: state.currentSessionId, topic_id: state.currentTopic.topic_id, topic_name: state.currentTopic.name, role: sender === 'gemini' ? 'model' : 'user', content: message }); } catch (e) { console.error("Chat save error:", e); showToast("Chyba ukládání chatu.", "error"); } }
         };
        const updateGeminiThinkingState = (isThinking) => { /* ... (no changes) ... */ state.geminiIsThinking = isThinking; manageButtonStates(); ui.aiAvatarCorner?.classList.toggle('thinking', isThinking); if (!isThinking) ui.aiAvatarCorner?.classList.remove('speaking'); if (isThinking) addThinkingIndicator(); else removeThinkingIndicator(); };
        const addThinkingIndicator = () => { /* ... (no changes) ... */ if (state.thinkingIndicatorId || !ui.chatMessages) return; const id = `thinking-${Date.now()}`; const div = document.createElement('div'); div.className = 'chat-message model'; div.id = id; div.innerHTML = `<div class="message-avatar">AI</div><div class="message-thinking-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`; const empty = ui.chatMessages.querySelector('.empty-state'); if(empty) empty.remove(); ui.chatMessages.appendChild(div); div.scrollIntoView({ behavior: 'smooth', block: 'end' }); state.thinkingIndicatorId = id; };
        const removeThinkingIndicator = () => { /* ... (no changes) ... */ if (state.thinkingIndicatorId) { document.getElementById(state.thinkingIndicatorId)?.remove(); state.thinkingIndicatorId = null; } };
        const handleSendMessage = async () => { /* ... (no changes) ... */ const text = ui.chatInput?.value.trim(); if (!text || state.geminiIsThinking || !state.currentTopic) return; if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(); } await addChatMessage(text, 'user'); state.geminiChatContext.push({ role: "user", parts: [{ text }] }); manageUIState('chatting'); updateGeminiThinkingState(true); const prompt = `Student píše do chatu: "${text}". Odpověz textem v chatu k tématu "${state.currentTopic.name}". Měj na paměti, co už bylo vysvětleno na tabuli (poslední části jsou na konci historie). Odpovídej pouze textem do chatu. Neposílej žádný Markdown pro tabuli, pokud to není explicitně vyžádáno pro opravu nebo doplnění tabule.`; await sendToGemini(prompt); };
        const confirmClearChat = () => { /* ... (no changes) ... */ if (confirm("Opravdu vymazat historii této konverzace?")) clearCurrentChatSessionHistory(); };
        const clearCurrentChatSessionHistory = async () => { /* ... (no changes) ... */ if (ui.chatMessages) ui.chatMessages.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><h3>Chat vymazán</h3></div>'; state.geminiChatContext = []; showToast("Historie chatu vymazána.", "info"); if (state.supabase && state.currentUser && state.currentSessionId) { try { await state.supabase.from('chat_history').delete().match({ user_id: state.currentUser.id, session_id: state.currentSessionId }); } catch (e) { console.error("DB clear chat error:", e); } } };
        const saveChatToPDF = async () => { /* ... (no changes) ... */ if (!ui.chatMessages || ui.chatMessages.children.length === 0) { showToast("Není co uložit.", "warning"); return; } if (typeof html2pdf === 'undefined') { showToast("Chyba: PDF knihovna.", "error"); return; } showToast("Generuji PDF...", "info", 3000); const el = document.createElement('div'); el.style.padding="20mm"; el.innerHTML=`<style>body{font-family:Poppins,sans-serif;font-size:10pt;line-height:1.5;color:#333}.user{margin-left:10%}.model{margin-right:10%}.msg{margin-bottom:10px;max-width:90%;page-break-inside:avoid}.bubble{padding:8px 12px;border-radius:12px;background:#eee;display:inline-block;}.user .bubble{background:#dcf8c6;}.time{font-size:8pt;color:#888;margin-top:3px;display:block;}.user .time{text-align:right;}h1{font-size:16pt;color:#3f37c9;text-align:center;margin-bottom:5px}p{font-size:9pt;color:#6c757d;text-align:center;margin:0 0 10px}hr{border:0;border-top:1px solid #ccc;margin:10px 0}</style><h1>Chat - ${sanitizeHTML(state.currentTopic?.name||'Neznámé')}</h1><p>${new Date().toLocaleString('cs-CZ')}</p><hr>`; Array.from(ui.chatMessages.children).forEach(m=>{if(m.classList.contains('chat-message')&&!m.id.startsWith('thinking-')){const c=m.cloneNode(true);c.querySelector('.message-avatar')?.remove();c.classList.add(m.classList.contains('user')?'user':'model','msg');c.querySelector('.message-bubble').classList.add('bubble');c.querySelector('.message-timestamp').classList.add('time');el.appendChild(c);}}); const fn=`chat-${state.currentTopic?.name?.replace(/[^a-z0-9]/gi,'_')||'vyuka'}.pdf`; try{await html2pdf().set({margin:15,filename:fn,jsPDF:{unit:'mm',format:'a4'}}).from(el).save();showToast("Chat uložen!", "success");}catch(e){console.error("PDF Error:",e);showToast("Chyba PDF.", "error");} };

        // --- Gemini Interaction & Parsing (No functional changes needed) ---
        const parseGeminiResponse = (rawText) => { /* ... (no changes) ... */ const boardMarker = "[BOARD_MARKDOWN]:"; const ttsMarker = "[TTS_COMMENTARY]:"; let boardMarkdown = ""; let ttsCommentary = ""; let chatText = ""; const boardStart = rawText.indexOf(boardMarker); const ttsStart = rawText.indexOf(ttsMarker); if (boardStart !== -1) { let blockStart = rawText.indexOf("```", boardStart + boardMarker.length); if (blockStart !== -1) { let blockEnd = rawText.indexOf("```", blockStart + 3); if (blockEnd !== -1) boardMarkdown = rawText.substring(blockStart + 3, blockEnd).trim(); else boardMarkdown = rawText.substring(blockStart + 3).trim(); } } if (ttsStart !== -1) { let commentaryEnd = rawText.indexOf("[", ttsStart + ttsMarker.length); if (commentaryEnd === -1 || (boardStart !== -1 && commentaryEnd > boardStart && ttsStart < boardStart)) { commentaryEnd = (boardStart !== -1 && ttsStart < boardStart) ? boardStart : rawText.length; } ttsCommentary = rawText.substring(ttsStart + ttsMarker.length, commentaryEnd).trim(); } if (boardStart === -1 && ttsStart === -1) { chatText = rawText.trim(); } else { let currentPos = 0; let textParts = []; const markers = []; if (boardStart !== -1) markers.push({ type: 'board', start: boardStart, end: rawText.indexOf("```", rawText.indexOf("```", boardStart) + 3) + 3 }); if (ttsStart !== -1) markers.push({ type: 'tts', start: ttsStart, end: ttsStart + ttsMarker.length + ttsCommentary.length }); markers.sort((a, b) => a.start - b.start); markers.forEach(marker => { if (marker.start > currentPos) textParts.push(rawText.substring(currentPos, marker.start)); currentPos = marker.end; }); if (currentPos < rawText.length) textParts.push(rawText.substring(currentPos)); chatText = textParts.map(p => p.trim()).filter(p => p.length > 0).join("\n\n"); } console.log("[parseGeminiResponse] Board Markdown:", boardMarkdown.substring(0,100)+"..."); console.log("[parseGeminiResponse] TTS Commentary:", ttsCommentary.substring(0,100)+"..."); console.log("[parseGeminiResponse] Chat Text:", chatText.substring(0,100)+"..."); return { boardMarkdown, ttsCommentary, chatText }; };
        const processGeminiResponse = (rawText, timestamp) => { /* ... (no changes) ... */ removeThinkingIndicator(); console.log("Raw Gemini Response Received:", rawText.substring(0, 200) + "..."); const { boardMarkdown, ttsCommentary, chatText } = parseGeminiResponse(rawText); let aiResponded = false; if (boardMarkdown) { appendToWhiteboard(boardMarkdown, ttsCommentary); console.log("Appended markdown to whiteboard."); aiResponded = true; } if (chatText) { const ttsForChat = ttsCommentary && !boardMarkdown ? ttsCommentary : null; addChatMessage(chatText, 'gemini', true, timestamp, ttsForChat); console.log("Displayed text in chat."); aiResponded = true; } else if (ttsCommentary && !boardMarkdown) { addChatMessage("(Poslechněte si komentář)", 'gemini', true, timestamp, ttsCommentary); aiResponded = true; } if (!aiResponded) { addChatMessage("(AI neodpovědělo očekávaným způsobem)", 'gemini', false, timestamp); console.log("AI sent no usable content."); } manageUIState('learning'); };
        const _buildInitialPrompt = () => { /* ... (no changes) ... */ const level = state.currentProfile?.skill_level || 'neznámá'; return `Jako AI Tutor vysvětli ZÁKLADY tématu "${state.currentTopic.name}" pro studenta s úrovní "${level}". Rozděl vysvětlení na menší logické části. Pro první část:\nFormát odpovědi:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n(Zde napiš KRÁTKÝ A STRUČNÝ Markdown text pro první část vysvětlení na tabuli - klíčové body, vzorec, jednoduchý diagram. Použij nadpisy, seznamy, zvýraznění, LaTeX pro vzorce.)\n\`\`\`\n[TTS_COMMENTARY]:\n(Zde napiš PODROBNĚJŠÍ konverzační komentář k první části na tabuli, jako bys mluvil/a k studentovi na úrovni "${level}". Rozveď myšlenky z tabule, přidej kontext nebo jednoduchý příklad. Tento text bude přečten nahlas.)`; };
        const _buildContinuePrompt = () => { /* ... (no changes) ... */ const level = state.currentProfile?.skill_level || 'neznámá'; return `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}" pro studenta s úrovní "${level}". Naváž na předchozí vysvětlení (poslední část historie chatu a tabule je relevantní). Vygeneruj další logickou část.\nFormát odpovědi:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n(Zde napiš další stručnou část Markdown textu pro tabuli.)\n\`\`\`\n[TTS_COMMENTARY]:\n(Zde napiš podrobnější konverzační komentář k NOVÉMU obsahu tabule pro hlasový výstup, přizpůsobený úrovni "${level}".)`; };
        const _buildGeminiPayloadContents = (userPrompt) => { /* ... (no changes) ... */ const level = state.currentProfile?.skill_level || 'neznámá'; const system = `Jsi AI Tutor "Justax". Vyučuješ téma: "${state.currentTopic.name}" studenta s úrovní "${level}". Vždy odpovídej ve formátu s bloky [BOARD_MARKDOWN]: \`\`\`markdown ... \`\`\` a [TTS_COMMENTARY]: .... Text pro tabuli má být stručný a strukturovaný (nadpisy, seznamy, vzorce v LaTeXu). Komentář pro TTS má být podrobnější, konverzační a doplňující k textu na tabuli (jako bys mluvil), přizpůsobený úrovni studenta. Pokud odpovídáš na dotaz studenta v chatu, odpověz pouze běžným textem bez těchto bloků.`; const history = state.geminiChatContext.slice(-MAX_GEMINI_HISTORY_TURNS * 2); const current = { role: "user", parts: [{ text: userPrompt }] }; const modelAck = { role: "model", parts: [{ text: `Rozumím. Vygeneruji stručný obsah pro tabuli a podrobnější TTS komentář ve specifikovaném formátu pro téma "${state.currentTopic.name}" a úroveň "${level}", nebo odpovím na dotaz v chatu.` }]}; return [{ role: "user", parts:[{text:system}] }, modelAck, ...history, current]; };
        const sendToGemini = async (prompt) => { /* ... (no changes) ... */ if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR_')) {showToast("Chyba: AI Key.", "error"); updateGeminiThinkingState(false); return;} if (!state.currentTopic) {showToast("Chyba: Není téma.", "error"); updateGeminiThinkingState(false); return;} if (!navigator.onLine) {showToast("Chyba: Offline.", "error"); updateGeminiThinkingState(false); return;} console.log(`Sending: "${prompt.substring(0, 100)}..."`); const timestamp = new Date(); updateGeminiThinkingState(true); setLoadingState('chat', true); const contents = _buildGeminiPayloadContents(prompt); const body = { contents, generationConfig: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 4096 }, safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }] }; try { const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!response.ok) { let errorText = `API Chyba (${response.status})`; try { const errData = await response.json(); errorText += `: ${errData?.error?.message || 'Neznámá'}`; } catch (e) { errorText += `: ${await response.text()}`; } throw new Error(errorText); } const data = await response.json(); const candidate = data.candidates?.[0]; if (data.promptFeedback?.blockReason) throw new Error(`Blokováno: ${data.promptFeedback.blockReason}.`); if (!candidate) throw new Error('Chybná odpověď AI.'); if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) { if(candidate.finishReason === 'SAFETY') throw new Error('Blokováno filtrem AI.'); console.warn(`Gemini finishReason: ${candidate.finishReason}.`); } const text = candidate.content?.parts?.[0]?.text; if (!text) { if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Max. délka odpovědi.'); else throw new Error('Prázdná odpověď AI.'); } state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] }); state.geminiChatContext.push({ role: "model", parts: [{ text }] }); if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2) state.geminiChatContext.splice(0, state.geminiChatContext.length - MAX_GEMINI_HISTORY_TURNS * 2); processGeminiResponse(text, timestamp); } catch (error) { console.error('Gemini Chyba:', error); showToast(`Chyba AI: ${error.message}`, "error"); handleGeminiError(error.message, timestamp); } finally { updateGeminiThinkingState(false); setLoadingState('chat', false); } };
        const handleGeminiError = (msg, time) => { /* ... (no changes) ... */ addChatMessage(`Chyba: ${msg}`, 'gemini', false, time); updateGeminiThinkingState(false); manageUIState('learning'); };

         // --- START: Notification Logic (Copied from test1.js) ---
         async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) {
             if (!state.supabase || !userId) { console.error("[Notifications] Missing Supabase or User ID."); return { unreadCount: 0, notifications: [] }; }
             console.log(`[Notifications] Fetching unread notifications for user ${userId}`);
             setLoadingState('notifications', true);
             try {
                 const { data, error, count } = await state.supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit);
                 if (error) throw error;
                 console.log(`[Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`);
                 return { unreadCount: count ?? 0, notifications: data || [] };
             } catch (error) {
                 console.error("[Notifications] Exception fetching notifications:", error);
                 showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error');
                 return { unreadCount: 0, notifications: [] };
             } finally {
                 setLoadingState('notifications', false);
             }
         }
         function renderNotifications(count, notifications) {
             console.log("[Render Notifications] Start, Count:", count, "Notifications:", notifications);
             if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements."); return; }
             ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
             ui.notificationCount.classList.toggle('visible', count > 0);
             const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } }; // Local copy for safety
             if (notifications && notifications.length > 0) {
                 ui.notificationsList.innerHTML = notifications.map(n => {
                      const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default;
                      const isReadClass = n.is_read ? 'is-read' : '';
                      const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : '';
                     return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join('');
                 ui.noNotificationsMsg.style.display = 'none';
                 ui.notificationsList.style.display = 'block';
                 ui.markAllReadBtn.disabled = count === 0;
             } else {
                 ui.notificationsList.innerHTML = '';
                 ui.noNotificationsMsg.style.display = 'block';
                 ui.notificationsList.style.display = 'none';
                 ui.markAllReadBtn.disabled = true;
             }
             console.log("[Render Notifications] Finished");
         }
         async function markNotificationRead(notificationId) { console.log("[Notifications] Marking notification as read:", notificationId); if (!state.currentUser || !notificationId) return false; try { const { error } = await state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[Notifications] Mark as read successful for ID:", notificationId); return true; } catch (error) { console.error("[Notifications] Mark as read error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
         async function markAllNotificationsRead() { console.log("[Notifications] Marking all as read for user:", state.currentUser?.id); if (!state.currentUser || !ui.markAllReadBtn) return; setLoadingState('notifications', true); try { const { error } = await state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('is_read', false); if (error) throw error; console.log("[Notifications] Mark all as read successful"); const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[Notifications] Mark all as read error:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); } finally { setLoadingState('notifications', false); } }
        // --- END: Notification Logic ---

        // --- Run Application ---
        document.addEventListener('DOMContentLoaded', initializeApp);

    } catch (e) {
        // --- Fatal Error Handling ---
        console.error("FATAL SCRIPT ERROR:", e);
        document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--accent-pink);color:var(--white);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky.</p><p><a href="#" onclick="location.reload()" style="color:var(--accent-cyan); text-decoration:underline;">Obnovit stránku</a></p><details style="margin-top: 20px;"><summary style="cursor:pointer;">Detaily chyby</summary><pre style="margin-top:10px;padding:15px;background:rgba(var(--black), 0.3);border:1px solid rgba(var(--white-rgb), 0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;color: var(--text-medium);max-height: 300px; overflow-y: auto;">${e.message}\n${e.stack}</pre></details></div>`;
    }

})(); // End IIFE