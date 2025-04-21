// Файл: procvicovani/vyuka/vyuka.js
// Версия 7: Улучшены промпты для сложности и профессионализма, изменена логика 'Pokračovat'.

(function() { // IIFE для изоляции области видимости
    'use strict';

    try {
        // --- Constants & Configuration ---
        const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
        const GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // !!! Production: Use a secure method !!!
        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const MAX_GEMINI_HISTORY_TURNS = 10; // Keep history concise
        const NOTIFICATION_FETCH_LIMIT = 5;
        const POINTS_TOPIC_COMPLETE = 25;

        // --- DOM Elements Cache ---
        const ui = {
            initialLoader: document.getElementById('initial-loader'),
            sidebarOverlay: document.getElementById('sidebar-overlay'),
            offlineBanner: document.getElementById('offline-banner'),
            sidebar: document.getElementById('sidebar'),
            mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
            sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
            sidebarAvatar: document.getElementById('sidebar-avatar'),
            sidebarName: document.getElementById('sidebar-name'),
            currentYearSidebar: document.getElementById('currentYearSidebar'),
            dashboardHeader: document.querySelector('.dashboard-header'),
            notificationBell: document.getElementById('notification-bell'),
            notificationCount: document.getElementById('notification-count'),
            notificationsDropdown: document.getElementById('notifications-dropdown'),
            notificationsList: document.getElementById('notifications-list'),
            noNotificationsMsg: document.getElementById('no-notifications-msg'),
            markAllReadBtn: document.getElementById('mark-all-read'),
            mainContent: document.getElementById('main-content'),
            topicBar: document.querySelector('.topic-bar'),
            currentTopicDisplay: document.getElementById('current-topic-display'),
            continueBtn: document.getElementById('continue-btn'),
            learningInterface: document.querySelector('.call-interface'),
            aiPresenterArea: document.querySelector('.ai-presenter-area'),
            aiPresenterHeader: document.querySelector('.ai-presenter-header'),
            aiAvatarPlaceholder: document.querySelector('.ai-avatar-placeholder'),
            aiStatusText: document.getElementById('ai-status-text'),
            clearBoardBtn: document.getElementById('clear-board-btn'),
            whiteboardContainer: document.getElementById('whiteboard-container'),
            whiteboardContent: document.getElementById('whiteboard-content'),
            boardSpeakingIndicator: document.getElementById('board-speaking-indicator'),
            interactionPanel: document.querySelector('.interaction-panel'),
            interactionTabs: document.querySelector('.interaction-tabs'),
            chatTabContent: document.getElementById('chat-tab-content'),
            chatTabButton: document.querySelector('.interaction-tab[data-tab="chat-tab"]'),
            chatHeader: document.querySelector('.chat-header'),
            chatMessages: document.getElementById('chat-messages'),
            chatInput: document.getElementById('chat-input'),
            sendButton: document.getElementById('send-button'),
            chatControls: document.querySelector('.chat-controls'),
            micBtn: document.getElementById('mic-btn'),
            clearChatBtn: document.getElementById('clear-chat-btn'),
            saveChatBtn: document.getElementById('save-chat-btn'),
            aiAvatarCorner: document.getElementById('ai-avatar-corner'),
            stopSpeechBtn: document.getElementById('stop-speech-btn'),
            markCompleteBtn: document.getElementById('mark-complete-btn'),
            toastContainer: document.getElementById('toast-container'),
            globalError: document.getElementById('global-error'),
            dashboardFooter: document.querySelector('.dashboard-footer'),
            currentYearFooter: document.getElementById('currentYearFooter'),
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
            isLoading: { currentTopic: false, chat: false, user: false, notifications: false, points: false },
            // ---- NEW/MODIFIED STATE ----
            aiIsWaitingForAnswer: false, // True ONLY if AI explicitly asked a question on the board REQUIRING user answer
            lastInteractionTime: Date.now() // Track interaction time
            // --------------------------
        };

        // Visuals for notification types
        const activityVisuals = { /* ... (no changes needed here) ... */ test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

        // --- Helper Functions ---
        // showToast, showError, hideError, sanitizeHTML, getInitials, formatTimestamp, formatRelativeTime,
        // openMenu, closeMenu, renderMarkdown, autoResizeTextarea, generateSessionId, initTooltips,
        // updateOnlineStatus, updateCopyrightYear, initMouseFollower, initScrollAnimations,
        // initHeaderScrollDetection, cleanChatMessage, clearInitialChatState, setLoadingState
        // --- (Existing helper functions remain largely the same, only minor adjustments if needed) ---
        function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
        function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
        function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
        const sanitizeHTML = (str) => { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; };
        const getInitials = (profileData, email) => { if (!profileData && !email) return '?'; let initials = ''; if (profileData?.first_name) initials += profileData.first_name[0]; if (profileData?.last_name) initials += profileData.last_name[0]; if (initials) return initials.toUpperCase(); if (profileData?.username) return profileData.username[0].toUpperCase(); if (email) return email[0].toUpperCase(); return 'Pilot'; };
        const formatTimestamp = (d = new Date()) => d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        const formatRelativeTime = (timestamp) => { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } };
        const openMenu = () => { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } };
        const closeMenu = () => { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } };
        const renderMarkdown = (el, text) => { if (!el) return; const originalText = text || ''; try { if (typeof marked === 'undefined') { console.error("Marked library not loaded!"); el.innerHTML = `<p>${sanitizeHTML(originalText)}</p>`; return; } marked.setOptions({ gfm: true, breaks: true, sanitize: false }); const htmlContent = marked.parse(originalText); if (htmlContent === originalText && originalText.trim() !== '') { console.warn("[RenderMarkdown] marked.parse() did not change the input text.", originalText.substring(0, 100) + "..."); el.innerHTML = `<p>${sanitizeHTML(originalText)}</p>`; } else { el.innerHTML = htmlContent; } if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { setTimeout(() => { window.MathJax.typesetPromise([el]).catch(e => console.error("MathJax typesetting error:", e)); }, 0); } } catch (e) { console.error("Markdown rendering error:", e); el.innerHTML = `<p style="color:var(--accent-pink);">Chyba renderování Markdown.</p><pre><code>${sanitizeHTML(originalText)}</code></pre>`; } };
        const autoResizeTextarea = () => { if (!ui.chatInput) return; ui.chatInput.style.height = 'auto'; const scrollHeight = ui.chatInput.scrollHeight; const maxHeight = 110; ui.chatInput.style.height = `${Math.min(scrollHeight, maxHeight)}px`; ui.chatInput.style.overflowY = scrollHeight > maxHeight ? 'scroll' : 'hidden'; };
        const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const initTooltips = () => { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Tooltipster error:", e); } };
        const updateOnlineStatus = () => { if (ui.offlineBanner) { ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; } if (!navigator.onLine) { showToast('Offline', 'Spojení bylo ztraceno. Některé funkce nemusí být dostupné.', 'warning'); } };
        const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
        const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
        const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) { console.log("Scroll animations not initialized."); return; } const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
        const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); };
        function cleanChatMessage(text) { if (typeof text !== 'string') return text; let cleanedText = text.replace(/``/g, ''); const lines = cleanedText.split('\n'); const filteredLines = lines.filter(line => { const trimmedLine = line.trim(); return trimmedLine !== '.' && trimmedLine !== '?'; }); cleanedText = filteredLines.join('\n'); if (cleanedText.trim() === "(Poslechněte si komentář)") { console.log("[Clean] Removing placeholder text."); return ""; } cleanedText = cleanedText.trim(); return cleanedText; }
        const clearInitialChatState = () => { const initialElement = ui.chatMessages?.querySelector('.initial-chat-interface'); if (initialElement) { initialElement.remove(); console.log("Initial chat state cleared."); } };
        const setLoadingState = (sectionKey, isLoadingFlag) => { if (state.isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return; if (sectionKey === 'all') { Object.keys(state.isLoading).forEach(key => state.isLoading[key] = isLoadingFlag); } else { state.isLoading[sectionKey] = isLoadingFlag; } console.log(`[SetLoading] ${sectionKey}: ${isLoadingFlag}`); if (sectionKey === 'chat') { if (ui.sendButton) { ui.sendButton.disabled = isLoadingFlag || state.geminiIsThinking || state.topicLoadInProgress || state.isListening; ui.sendButton.innerHTML = state.geminiIsThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>'; } } if (sectionKey === 'currentTopic') { if (ui.currentTopicDisplay) { if (isLoadingFlag) { ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám téma...</span>'; } } } if (sectionKey === 'notifications') { if (ui.notificationBell) ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1; if (ui.markAllReadBtn) { const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0; } if (isLoadingFlag && ui.notificationsList) { renderNotificationSkeletons(2); } } manageButtonStates(); };

        // --- TTS/STT Functions ---
        // loadVoices, removeBoardHighlight, speakText, stopSpeech, initializeSpeechRecognition,
        // startListening, stopListening, handleMicClick
        // --- (No major changes needed, keeping existing functions) ---
        const loadVoices = () => { if (!state.speechSynthesisSupported) return; try { const voices = window.speechSynthesis.getVoices(); if (!voices || voices.length === 0) { console.warn("No voices available yet."); setTimeout(loadVoices, 100); return; } console.log('Available voices:', voices.length, voices.map(v=>({name:v.name, lang:v.lang}))); let preferredVoice = voices.find(voice => voice.lang === 'cs-CZ' && /female|žena|ženský|iveta|zuzana/i.test(voice.name)); if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang === 'cs-CZ'); if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang.startsWith('cs')); if (!preferredVoice) preferredVoice = voices.find(v => v.default) || voices[0]; state.czechVoice = preferredVoice; console.log("Selected voice:", state.czechVoice?.name, state.czechVoice?.lang); } catch (e) { console.error("Error loading voices:", e); state.czechVoice = null; } };
        const removeBoardHighlight = () => { if (state.currentlyHighlightedChunk) { state.currentlyHighlightedChunk.classList.remove('speaking-highlight'); state.currentlyHighlightedChunk = null; } };
        const speakText = (text, targetChunkElement = null) => { if (!state.speechSynthesisSupported) { showToast("Syntéza řeči není podporována.", "warning"); return; } if (!text) { console.warn("TTS: No text provided."); return; } const plainText = text.replace(/<[^>]*>/g, ' ').replace(/[`*#_~[\]()]/g, '').replace(/\$\$(.*?)\$\$/g, 'matematický vzorec').replace(/\$(.*?)\$/g, 'vzorec').replace(/\s+/g, ' ').trim(); if (!plainText) { console.warn("TTS: Text empty after cleaning, skipping speech."); return; } window.speechSynthesis.cancel(); removeBoardHighlight(); const utterance = new SpeechSynthesisUtterance(plainText); utterance.lang = 'cs-CZ'; utterance.rate = 0.9; utterance.pitch = 1.0; if (state.czechVoice) { utterance.voice = state.czechVoice; } else { loadVoices(); if (state.czechVoice) { utterance.voice = state.czechVoice; } else { console.warn("Czech voice not found, using default."); } } utterance.onstart = () => { console.log("TTS started."); ui.aiAvatarCorner?.classList.add('speaking'); ui.boardSpeakingIndicator?.classList.add('active'); if (targetChunkElement) { targetChunkElement.classList.add('speaking-highlight'); state.currentlyHighlightedChunk = targetChunkElement; } manageButtonStates(); }; utterance.onend = () => { console.log("TTS finished."); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); removeBoardHighlight(); manageButtonStates(); }; utterance.onerror = (event) => { console.error(`SpeechSynthesisUtterance.onerror -> Error: ${event.error}. Utterance text (start): ${plainText.substring(0, 50)}...`); let toastMessage = `Chyba při čtení: ${event.error}`; if (event.error === 'not-allowed') { toastMessage += ". Prosím, klikněte na stránku pro povolení zvuku."; } else if (event.error === 'interrupted') { console.warn("TTS interrupted, likely by new speech request."); return; } showToast(toastMessage, 'error'); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); removeBoardHighlight(); manageButtonStates(); }; console.log(`TTS: Attempting to speak. Voice: ${utterance.voice?.name}, lang: ${utterance.lang}`); try { window.speechSynthesis.speak(utterance); } catch (speakError) { console.error("Error calling window.speechSynthesis.speak():", speakError); showToast('Chyba spuštění hlasového výstupu.', 'error'); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); removeBoardHighlight(); manageButtonStates(); } };
        const stopSpeech = () => { if (state.speechSynthesisSupported) { window.speechSynthesis.cancel(); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); removeBoardHighlight(); console.log("Speech cancelled."); manageButtonStates(); } };
        const initializeSpeechRecognition = () => { if (!state.speechRecognitionSupported) { console.warn("Speech Recognition not supported."); if(ui.micBtn) { ui.micBtn.disabled = true; ui.micBtn.title = "Rozpoznávání řeči není podporováno"; } return; } const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; state.speechRecognition = new SpeechRecognition(); state.speechRecognition.lang = 'cs-CZ'; state.speechRecognition.interimResults = false; state.speechRecognition.maxAlternatives = 1; state.speechRecognition.continuous = false; state.speechRecognition.onresult = (event) => { const transcript = event.results[0][0].transcript; console.log('Speech recognized:', transcript); if (ui.chatInput) { ui.chatInput.value = transcript; autoResizeTextarea(); } }; state.speechRecognition.onerror = (event) => { console.error('Speech recognition error:', event.error); let errorMsg = "Chyba rozpoznávání řeči"; if (event.error === 'no-speech') errorMsg = "Nerozpoznal jsem žádnou řeč."; else if (event.error === 'audio-capture') errorMsg = "Chyba mikrofonu."; else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { errorMsg = "Přístup k mikrofonu zamítnut."; if(ui.micBtn) ui.micBtn.disabled = true; } showToast(errorMsg, 'error'); stopListening(); }; state.speechRecognition.onend = () => { console.log('Speech recognition ended.'); stopListening(); }; console.log("Speech Recognition initialized."); };
        const startListening = () => { if (!state.speechRecognitionSupported || !state.speechRecognition || state.isListening) return; navigator.mediaDevices.getUserMedia({ audio: true }) .then(() => { try { state.speechRecognition.start(); state.isListening = true; ui.micBtn?.classList.add('listening'); if(ui.micBtn) ui.micBtn.title = "Zastavit hlasový vstup"; console.log('Speech recognition started.'); manageButtonStates(); } catch (e) { console.error("Error starting speech recognition:", e); showToast("Nepodařilo se spustit rozpoznávání.", "error"); stopListening(); } }) .catch(err => { console.error("Microphone access denied:", err); showToast("Přístup k mikrofonu je nutný pro hlasový vstup.", "warning"); if(ui.micBtn) ui.micBtn.disabled = true; stopListening(); }); };
        const stopListening = () => { if (!state.speechRecognitionSupported || !state.speechRecognition || !state.isListening) return; try { state.speechRecognition.stop(); } catch (e) {} finally { state.isListening = false; ui.micBtn?.classList.remove('listening'); if(ui.micBtn) ui.micBtn.title = "Zahájit hlasový vstup"; console.log('Speech recognition stopped.'); manageButtonStates(); } };
        const handleMicClick = () => { if (!state.speechRecognitionSupported) { showToast("Rozpoznávání řeči není podporováno.", "warning"); return; } if (state.isListening) { stopListening(); } else { startListening(); } };

        // --- Initialization ---
        const initializeSupabase = () => { try { if (!window.supabase) throw new Error("Supabase library not loaded."); state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); if (!state.supabase) throw new Error("Client creation failed."); console.log("Supabase initialized."); return true; } catch (error) { console.error("Supabase init failed:", error); showToast("Chyba DB.", "error", 10000); return false; } };
        const initializeUI = () => { try { updateTheme(); setupEventListeners(); initTooltips(); if (ui.chatTabButton) ui.chatTabButton.classList.add('active'); if (ui.chatTabContent) ui.chatTabContent.classList.add('active'); if (state.speechSynthesisSupported) { if (window.speechSynthesis.getVoices().length > 0) { loadVoices(); } else if (window.speechSynthesis.onvoiceschanged !== undefined) { window.speechSynthesis.onvoiceschanged = loadVoices; } } else { console.warn("Speech Synthesis not supported."); } initializeSpeechRecognition(); initMouseFollower(); initHeaderScrollDetection(); updateCopyrightYear(); updateOnlineStatus(); manageUIState('initial'); console.log("UI Initialized successfully."); return true; } catch(error) { console.error("UI Init failed:", error); showError(`Chyba inicializace UI: ${error.message}`, true); return false; } };
        const initializeApp = async () => { console.log("🚀 [Init Vyuka - Kyber v7] Starting..."); if (!initializeSupabase()) return; if (typeof marked === 'undefined') { showError("Kritická chyba: Knihovna 'marked.js' se nepodařilo načíst. Obnovte stránku.", true); if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); } return; } console.log("✅ Marked library found."); if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); } if (ui.mainContent) ui.mainContent.style.display = 'none'; try { console.log("[INIT] Checking auth session..."); const { data: { session }, error: sessionError } = await state.supabase.auth.getSession(); if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`); if (!session || !session.user) { console.log('[Init Vyuka - Kyber] Not logged in. Redirecting...'); window.location.href = '/auth/index.html'; return; } state.currentUser = session.user; console.log(`[INIT] User authenticated (ID: ${state.currentUser.id}).`); setLoadingState('user', true); state.currentProfile = await fetchUserProfile(state.currentUser.id); updateUserInfoUI(); setLoadingState('user', false); if (!state.currentProfile) { showError("Profil nenalezen nebo se nepodařilo načíst.", true); if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); } if (ui.mainContent) ui.mainContent.style.display = 'flex'; manageUIState('error', { errorMessage: 'Profil nenalezen.' }); return; } if (!initializeUI()) return; console.log("[INIT] Loading initial topic and notifications..."); const loadNotificationsPromise = fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT).then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications)).catch(err => { console.error("Chyba při úvodním načítání notifikací:", err); renderNotifications(0, []); }); await loadNotificationsPromise; const loadTopicPromise = loadNextUncompletedTopic(); await loadTopicPromise; if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); } if (ui.mainContent) { ui.mainContent.style.display = 'flex'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); }); } requestAnimationFrame(initScrollAnimations); console.log("✅ [Init Vyuka - Kyber v7] Page Initialized."); } catch (error) { console.error("❌ [Init Vyuka - Kyber] Critical initialization error:", error); if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). Obnovte.</p>`; } else { showError(`Chyba inicializace: ${error.message}`, true); } if (ui.mainContent) ui.mainContent.style.display = 'flex'; setLoadingState('all', false); } };

        // --- User Profile & Auth ---
        const fetchUserProfile = async (userId) => { if (!state.supabase || !userId) return null; console.log(`[Profile] Fetching profile for user ID: ${userId}`); try { const { data: profile, error } = await state.supabase.from('profiles').select('*').eq('id', userId).single(); if (error && error.code !== 'PGRST116') throw error; if (!profile) { console.warn(`[Profile] Profile not found for user ${userId}.`); return null; } console.log("[Profile] Profile data fetched."); return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error'); return null; } };
        const updateUserInfoUI = () => { if (!ui.sidebarName || !ui.sidebarAvatar) return; if (state.currentUser && state.currentProfile) { const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(state.currentProfile, state.currentUser.email); const avatarUrl = state.currentProfile.avatar_url ? `${state.currentProfile.avatar_url}?t=${new Date().getTime()}` : null; ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${initials}">` : initials; } else { ui.sidebarName.textContent = 'Nepřihlášen'; ui.sidebarAvatar.textContent = '?'; } };
        const handleLoggedOutUser = () => { console.warn("User not logged in."); if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder">Nejste přihlášeni</span>'; showToast("Prosím, přihlaste se.", "warning"); manageUIState('loggedOut'); };

        // --- Event Listeners Setup ---
        const setupEventListeners = () => { console.log("[SETUP] Setting up event listeners..."); if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu); if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu); if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu); if (ui.chatInput) ui.chatInput.addEventListener('input', autoResizeTextarea); if (ui.sendButton) ui.sendButton.addEventListener('click', handleSendMessage); if (ui.chatInput) ui.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }); if (ui.clearChatBtn) ui.clearChatBtn.addEventListener('click', confirmClearChat); if (ui.saveChatBtn) ui.saveChatBtn.addEventListener('click', saveChatToPDF); if (ui.continueBtn) ui.continueBtn.addEventListener('click', requestContinue); if (ui.markCompleteBtn) ui.markCompleteBtn.addEventListener('click', handleMarkTopicComplete); if (ui.clearBoardBtn) ui.clearBoardBtn.addEventListener('click', () => clearWhiteboard(true)); if (ui.stopSpeechBtn) ui.stopSpeechBtn.addEventListener('click', stopSpeech); if (ui.micBtn) ui.micBtn.addEventListener('click', handleMicClick); if (ui.chatMessages) { ui.chatMessages.addEventListener('click', (event) => { const button = event.target.closest('.tts-listen-btn'); if (button) { const text = button.dataset.textToSpeak; if (text) { speakText(text); } else { console.warn("No text found for TTS button in chat."); } } }); } window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => { state.isDarkMode = event.matches; console.log("Theme changed, isDarkMode:", state.isDarkMode); updateTheme(); }); window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) { closeMenu(); } }); window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus); if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); } if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); } if (ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }); } document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } }); console.log("Event listeners setup complete."); };

        // --- UI State & Button Management ---
        // *** MODIFIED manageUIState & manageButtonStates ***
        const manageUIState = (mode, options = {}) => {
            console.log("[UI State]:", mode, options);
            state.lastInteractionTime = Date.now(); // Update interaction time on state change

            if (ui.learningInterface) ui.learningInterface.style.display = 'flex';

            // Update Topic Display
            if (state.currentTopic) {
                 if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(state.currentTopic.name)}</strong>`;
            } else if (mode === 'loadingTopic') {
                 if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám téma...</span>';
            } else if (mode === 'noPlan'){
                 if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder">Žádný aktivní plán</span>';
            } else if (mode === 'planComplete'){
                 if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder">Plán dokončen!</span>';
            } else if (mode === 'error'){
                 if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder error">Chyba načítání</span>';
            } else if (!state.currentUser) {
                 if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder">Nepřihlášen</span>';
            } else {
                 if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder">Připraven...</span>';
            }

            // Handle Empty/Initial States in Chat
            const isChatInitial = !!ui.chatMessages?.querySelector('.initial-chat-interface');
            if (isChatInitial || mode === 'error' || mode === 'noPlan' || mode === 'planComplete' || mode === 'loggedOut') {
                 let emptyStateHTML = '';
                 switch (mode) {
                     case 'loggedOut': emptyStateHTML = `<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPŘIHLÁŠEN</h3><p>Pro přístup k výuce se prosím <a href="/auth/index.html" style="color: var(--accent-primary)">přihlaste</a>.</p></div>`; break;
                     case 'noPlan': emptyStateHTML = `<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ŽÁDNÝ AKTIVNÍ PLÁN</h3><p>Nemáte aktivní studijní plán. Nejprve prosím dokončete <a href="/dashboard/procvicovani/test1.html" style="color: var(--accent-primary)">diagnostický test</a>.</p></div>`; break;
                     case 'planComplete': emptyStateHTML = `<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLÁN DOKONČEN!</h3><p>Všechny naplánované aktivity jsou hotové. Skvělá práce! Můžete si <a href="/dashboard/procvicovani/plan.html" style="color: var(--accent-primary)">vytvořit nový plán</a>.</p></div>`; break;
                     case 'error': emptyStateHTML = `<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA SYSTÉMU</h3><p>${options.errorMessage || 'Nastala chyba při načítání dat.'}</p></div>`; break;
                     case 'loadingTopic': emptyStateHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>NAČÍTÁNÍ TÉMATU...</h3></div>'; break;
                     // Add a default initial state if none of the above match but chat is empty
                     default: if (isChatInitial) {
                         emptyStateHTML = `<div class="initial-chat-interface"><div class="ai-greeting-avatar"><i class="fas fa-robot"></i></div><h3 class="initial-chat-title">AI Tutor Justax je připraven</h3><p class="initial-chat-message">Čekám na načtení tématu nebo vaši zprávu.</p><div class="initial-chat-status"><span class="status-dot online"></span> Online</div></div>`;
                     }
                 }
                 if (emptyStateHTML && ui.chatMessages) {
                     ui.chatMessages.innerHTML = emptyStateHTML;
                 }
            }
            manageButtonStates(); // Update buttons based on the new state
        };

        const manageButtonStates = () => {
            const canInteractBase = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress;
            const canChat = canInteractBase || (!!state.currentTopic && state.aiIsWaitingForAnswer); // Allow chat if AI is waiting
            const canContinueOrComplete = canInteractBase && !state.aiIsWaitingForAnswer; // Only allow continue/complete if AI is *not* waiting

            // Send Button
            if (ui.sendButton) {
                ui.sendButton.disabled = !canChat || state.isListening || state.geminiIsThinking;
                ui.sendButton.innerHTML = state.geminiIsThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
            }

            // Chat Input
            if (ui.chatInput) {
                ui.chatInput.disabled = !canChat || state.isListening || state.geminiIsThinking;
                ui.chatInput.placeholder = state.isListening ? "Poslouchám..." : (canChat ? "Zeptejte se nebo odpovězte..." : "Počkejte prosím...");
            }

            // Continue Button
            if (ui.continueBtn) {
                ui.continueBtn.disabled = !canContinueOrComplete;
                ui.continueBtn.style.display = state.currentTopic ? 'inline-flex' : 'none';
            }

            // Mark Complete Button
            if (ui.markCompleteBtn) {
                ui.markCompleteBtn.disabled = !canContinueOrComplete;
                ui.markCompleteBtn.style.display = state.currentTopic ? 'inline-flex' : 'none';
            }

            // Clear Board Button
            if (ui.clearBoardBtn) {
                ui.clearBoardBtn.disabled = !ui.whiteboardContent || ui.whiteboardContent.children.length === 0 || state.geminiIsThinking;
            }

            // Stop Speech Button
            if (ui.stopSpeechBtn) {
                ui.stopSpeechBtn.disabled = !state.speechSynthesisSupported || !window.speechSynthesis.speaking;
            }

            // Mic Button
            if (ui.micBtn) {
                const canUseMic = canChat && state.speechRecognitionSupported && !state.geminiIsThinking; // Disable mic while AI is thinking
                ui.micBtn.disabled = !canUseMic;
                ui.micBtn.classList.toggle('listening', state.isListening);
                ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporováno" : state.isListening ? "Zastavit hlasový vstup" : "Zahájit hlasový vstup";
            }

            // Chat Controls (Clear/Save)
            const isChatEmptyOrInitial = ui.chatMessages?.children.length === 0 || !!ui.chatMessages?.querySelector('.initial-chat-interface');
            if (ui.clearChatBtn) { ui.clearChatBtn.disabled = state.geminiIsThinking || isChatEmptyOrInitial; }
            if (ui.saveChatBtn) { ui.saveChatBtn.disabled = state.geminiIsThinking || isChatEmptyOrInitial; }

            // AI Status Text
            let statusText = "Připraven...";
            if (state.isLoading.currentTopic || state.topicLoadInProgress) statusText = "Načítám téma...";
            else if (state.geminiIsThinking) statusText = "Přemýšlím...";
            else if (state.isListening) statusText = "Poslouchám...";
            else if (window.speechSynthesis.speaking) statusText = "Mluvím...";
            else if (state.aiIsWaitingForAnswer) statusText = "Čekám na vaši odpověď...";
            else if (!state.currentTopic) statusText = "Žádné téma...";
            if (ui.aiStatusText) ui.aiStatusText.textContent = statusText;
        };
        // --------------------------

        // --- Whiteboard ---
        const updateTheme = () => { console.log("Updating theme, isDarkMode:", state.isDarkMode); document.documentElement.classList.toggle('dark', state.isDarkMode); document.documentElement.classList.toggle('light', !state.isDarkMode); document.documentElement.style.setProperty('--board-highlight-color', state.isDarkMode ? 'var(--board-highlight-dark)' : 'var(--board-highlight-light)'); };
        const clearWhiteboard = (showToastMsg = true) => { if (!ui.whiteboardContent) return; ui.whiteboardContent.innerHTML = ''; state.boardContentHistory = []; console.log("Whiteboard cleared."); if (showToastMsg) showToast('Vymazáno', "Tabule vymazána.", "info"); manageButtonStates(); };
        const appendToWhiteboard = (markdownContent, commentaryText) => { if (!ui.whiteboardContent || !ui.whiteboardContainer) return; const chunkDiv = document.createElement('div'); chunkDiv.className = 'whiteboard-chunk'; const contentDiv = document.createElement('div'); const originalText = markdownContent || ''; try { if (typeof marked === 'undefined') { throw new Error("Marked library not loaded"); } marked.setOptions({ gfm: true, breaks: true, sanitize: false }); const htmlContent = marked.parse(originalText); if (htmlContent === originalText && originalText.trim() !== '') { console.warn("[AppendToWhiteboard] marked.parse() did not change the input text. Rendering as <p>."); contentDiv.innerHTML = `<p>${sanitizeHTML(originalText)}</p>`; } else { contentDiv.innerHTML = htmlContent; } if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { setTimeout(() => { window.MathJax.typesetPromise([contentDiv]).catch(e => console.error("MathJax typesetting error in append:", e)); }, 0); } } catch (e) { console.error("Markdown rendering error in append:", e); contentDiv.innerHTML = `<p style="color:var(--accent-pink);">Chyba renderování Markdown.</p><pre><code>${sanitizeHTML(originalText)}</code></pre>`; } const ttsButton = document.createElement('button'); ttsButton.className = 'tts-listen-btn btn-tooltip'; ttsButton.title = 'Poslechnout komentář'; ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>'; const textForSpeech = commentaryText || originalText; ttsButton.dataset.textToSpeak = textForSpeech; if (state.speechSynthesisSupported) { ttsButton.addEventListener('click', (e) => { e.stopPropagation(); speakText(textForSpeech, chunkDiv); }); chunkDiv.appendChild(ttsButton); } chunkDiv.appendChild(contentDiv); ui.whiteboardContent.appendChild(chunkDiv); state.boardContentHistory.push(originalText); ui.whiteboardContainer.scrollTop = ui.whiteboardContainer.scrollHeight; console.log("Appended content to whiteboard."); initTooltips(); manageButtonStates(); };

        // --- Topic Loading and Progress ---
        const loadNextUncompletedTopic = async () => { if (!state.currentUser || state.topicLoadInProgress || !state.supabase) return; state.topicLoadInProgress = true; setLoadingState('currentTopic', true); state.currentTopic = null; if (ui.chatMessages) { ui.chatMessages.innerHTML = ''; } // Clear chat always when loading topic
        clearWhiteboard(false); state.geminiChatContext = []; state.aiIsWaitingForAnswer = false; manageUIState('loadingTopic'); try { const { data: plans, error: planError } = await state.supabase.from('study_plans').select('id').eq('user_id', state.currentUser.id).eq('status', 'active').limit(1); if (planError) throw planError; if (!plans || plans.length === 0) { manageUIState('noPlan'); return; } state.currentPlanId = plans[0].id; const { data: activities, error: activityError } = await state.supabase.from('plan_activities').select('id, title, description, topic_id').eq('plan_id', state.currentPlanId).eq('completed', false).order('day_of_week').order('time_slot').limit(1); if (activityError) throw activityError; if (activities && activities.length > 0) { const activity = activities[0]; let name = activity.title || 'N/A'; let desc = activity.description || ''; if (activity.topic_id) { try { const { data: topic, error: topicError } = await state.supabase.from('exam_topics').select('name, description').eq('id', activity.topic_id).single(); if (topicError && topicError.code !== 'PGRST116') throw topicError; if (topic) { name = topic.name || name; desc = topic.description || desc; } } catch(e) { console.warn("Could not fetch topic details:", e); } } state.currentTopic = { activity_id: activity.id, plan_id: state.currentPlanId, name: name, description: desc, user_id: state.currentUser.id, topic_id: activity.topic_id }; if (ui.currentTopicDisplay) { ui.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(name)}</strong>`; } await startLearningSession(); } else { manageUIState('planComplete'); } } catch (error) { console.error('Error loading next topic:', error); showToast(`Chyba načítání tématu: ${error.message}`, "error"); manageUIState('error', { errorMessage: error.message }); } finally { state.topicLoadInProgress = false; setLoadingState('currentTopic', false); } };
        const handleMarkTopicComplete = async () => { if (!state.currentTopic || !state.supabase || state.topicLoadInProgress) return; state.topicLoadInProgress = true; manageButtonStates(); try { const { error } = await state.supabase.from('plan_activities').update({ completed: true, updated_at: new Date().toISOString() }).eq('id', state.currentTopic.activity_id); if (error) throw error; await awardPoints(POINTS_TOPIC_COMPLETE); showToast(`Téma "${state.currentTopic.name}" dokončeno.`, "success"); await loadNextUncompletedTopic(); } catch (error) { console.error(`Error marking topic complete:`, error); showToast("Chyba při označování tématu jako dokončeného.", "error"); state.topicLoadInProgress = false; manageButtonStates(); } };

        // --- Points System ---
        async function awardPoints(pointsValue) { if (!state.currentUser || !state.currentProfile || !state.supabase || pointsValue <= 0) { console.log("[Points] Skipping point award:", { userId: state.currentUser?.id, profileExists: !!state.currentProfile, pointsValue }); return; } setLoadingState('points', true); console.log(`[Points] Awarding ${pointsValue} points to user ${state.currentUser.id}`); const currentPoints = state.currentProfile.points || 0; const newPoints = currentPoints + pointsValue; try { const { error } = await state.supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', state.currentUser.id); if (error) throw error; state.currentProfile.points = newPoints; console.log(`[Points] User points updated to ${newPoints}`); showToast('+', `${pointsValue} kreditů získáno!`, 'success', 3000); } catch (error) { console.error(`[Points] Error updating user points:`, error); showToast('Chyba', 'Nepodařilo se aktualizovat kredity.', 'error'); } finally { setLoadingState('points', false); } }

        // --- Learning Session & Chat ---
        const startLearningSession = async () => { if (!state.currentTopic) return; state.currentSessionId = generateSessionId(); clearInitialChatState(); // Ensure initial message is gone
        manageUIState('requestingExplanation'); const prompt = _buildInitialPrompt(); await sendToGemini(prompt); };
        const requestContinue = async () => { if (state.geminiIsThinking || !state.currentTopic || state.aiIsWaitingForAnswer) return; const prompt = _buildContinuePrompt(); await sendToGemini(prompt); };
        const addChatMessage = async (displayMessage, sender, saveToDb = true, timestamp = new Date(), ttsText = null, originalContent = null) => { if (!ui.chatMessages) return; clearInitialChatState(); const id = `msg-${Date.now()}`; const avatarText = sender === 'user' ? getInitials(state.currentProfile, state.currentUser?.email) : 'AI'; const div = document.createElement('div'); div.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`; div.id = id; const avatarDiv = `<div class="message-avatar">${avatarText}</div>`; const bubbleDiv = document.createElement('div'); bubbleDiv.className = 'message-bubble'; const bubbleContentDiv = document.createElement('div'); bubbleContentDiv.className = 'message-bubble-content'; const textContentSpan = document.createElement('span'); textContentSpan.className = 'message-text-content'; renderMarkdown(textContentSpan, displayMessage); /* Uses renderMarkdown */ bubbleContentDiv.appendChild(textContentSpan); if (sender === 'gemini' && state.speechSynthesisSupported) { const ttsButton = document.createElement('button'); ttsButton.className = 'tts-listen-btn btn-tooltip'; ttsButton.title = 'Poslechnout'; ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>'; const textForSpeech = ttsText || displayMessage; ttsButton.dataset.textToSpeak = textForSpeech; ttsButton.addEventListener('click', (e) => { e.stopPropagation(); speakText(textForSpeech); }); bubbleContentDiv.appendChild(ttsButton); } bubbleDiv.appendChild(bubbleContentDiv); const timeDiv = `<div class="message-timestamp">${formatTimestamp(timestamp)}</div>`; div.innerHTML = avatarDiv + bubbleDiv.outerHTML + timeDiv; ui.chatMessages.appendChild(div); div.scrollIntoView({ behavior: 'smooth', block: 'end' }); initTooltips(); const contentToSave = originalContent !== null ? originalContent : displayMessage; if (saveToDb && state.supabase && state.currentUser && state.currentTopic && state.currentSessionId) { try { await state.supabase.from('chat_history').insert({ user_id: state.currentUser.id, session_id: state.currentSessionId, topic_id: state.currentTopic.topic_id, topic_name: state.currentTopic.name, role: sender === 'gemini' ? 'model' : 'user', content: contentToSave }); } catch (e) { console.error("Chat save error:", e); showToast("Chyba ukládání chatu.", "error"); } } manageButtonStates(); };
        const addThinkingIndicator = () => { if (state.thinkingIndicatorId || !ui.chatMessages) return; clearInitialChatState(); const id = `thinking-${Date.now()}`; const div = document.createElement('div'); div.className = 'chat-message model'; div.id = id; div.innerHTML = `<div class="message-avatar">AI</div><div class="message-thinking-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`; ui.chatMessages.appendChild(div); div.scrollIntoView({ behavior: 'smooth', block: 'end' }); state.thinkingIndicatorId = id; manageButtonStates(); };
        const removeThinkingIndicator = () => { if (state.thinkingIndicatorId) { document.getElementById(state.thinkingIndicatorId)?.remove(); state.thinkingIndicatorId = null; } };
        const updateGeminiThinkingState = (isThinking) => { state.geminiIsThinking = isThinking; setLoadingState('chat', isThinking); ui.aiAvatarCorner?.classList.toggle('thinking', isThinking); if (!isThinking) ui.aiAvatarCorner?.classList.remove('speaking'); if (isThinking) addThinkingIndicator(); else removeThinkingIndicator(); };
        const handleSendMessage = async () => { const text = ui.chatInput?.value.trim(); if (!text || state.geminiIsThinking || !state.currentTopic || state.isListening) return; state.lastInteractionTime = Date.now(); if (state.aiIsWaitingForAnswer) { console.log("[HandleSend] Resetting aiIsWaitingForAnswer state."); state.aiIsWaitingForAnswer = false; manageUIState('learning'); } if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(); } await addChatMessage(text, 'user', true, new Date(), null, text); state.geminiChatContext.push({ role: "user", parts: [{ text }] }); updateGeminiThinkingState(true); let promptForGemini = _buildChatInteractionPrompt(text); await sendToGemini(promptForGemini, true); };
        const confirmClearChat = () => { if (confirm("Opravdu vymazat historii této konverzace? Tato akce je nevratná.")) { clearCurrentChatSessionHistory(); } };
        const clearCurrentChatSessionHistory = async () => { if (ui.chatMessages) { ui.chatMessages.innerHTML = `<div class="initial-chat-interface"><div class="ai-greeting-avatar"><i class="fas fa-robot"></i></div><h3 class="initial-chat-title">AI Tutor Justax je připraven</h3><p class="initial-chat-message">Chat vymazán. Čekám na načtení tématu nebo vaši zprávu.</p><div class="initial-chat-status"><span class="status-dot online"></span> Online</div></div>`; } state.geminiChatContext = []; showToast("Historie chatu vymazána.", "info"); if (state.supabase && state.currentUser && state.currentSessionId) { try { const { error } = await state.supabase.from('chat_history').delete().match({ user_id: state.currentUser.id, session_id: state.currentSessionId }); if (error) throw error; console.log(`Chat history deleted from DB for session: ${state.currentSessionId}`); } catch (e) { console.error("DB clear chat error:", e); showToast("Chyba při mazání historie chatu z databáze.", "error"); } } manageButtonStates(); };
        const saveChatToPDF = async () => { if (!ui.chatMessages || ui.chatMessages.children.length === 0 || !!ui.chatMessages.querySelector('.initial-chat-interface')) { showToast("Není co uložit.", "warning"); return; } if (typeof html2pdf === 'undefined') { showToast("Chyba: PDF knihovna nenalezena.", "error"); return; } showToast("Generuji PDF...", "info", 4000); const elementToExport = document.createElement('div'); elementToExport.style.padding="15mm"; elementToExport.innerHTML = `<style>body { font-family: 'Poppins', sans-serif; font-size: 10pt; line-height: 1.5; color: #333; } .chat-message { margin-bottom: 12px; max-width: 90%; page-break-inside: avoid; } .user { margin-left: 10%; } .model { margin-right: 10%; } .message-bubble { display: inline-block; padding: 8px 14px; border-radius: 15px; background-color: #e9ecef; } .user .message-bubble { background-color: #d1e7dd; } .message-timestamp { font-size: 8pt; color: #6c757d; margin-top: 4px; display: block; } .user .message-timestamp { text-align: right; } h1 { font-size: 16pt; color: #0d6efd; text-align: center; margin-bottom: 5px; } p.subtitle { font-size: 9pt; color: #6c757d; text-align: center; margin: 0 0 15px 0; } hr { border: 0; border-top: 1px solid #ccc; margin: 15px 0; } .tts-listen-btn { display: none; } mjx-math { font-size: 1em; } pre { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 0.8em; border-radius: 6px; overflow-x: auto; font-size: 0.9em; } code { background-color: #e9ecef; padding: 0.1em 0.3em; border-radius: 3px; } pre code { background: none; padding: 0; }</style><h1>Chat s AI Tutorem - ${sanitizeHTML(state.currentTopic?.name || 'Neznámé téma')}</h1><p class="subtitle">Vygenerováno: ${new Date().toLocaleString('cs-CZ')}</p><hr>`; Array.from(ui.chatMessages.children).forEach(msgElement => { if (msgElement.classList.contains('chat-message') && !msgElement.id.startsWith('thinking-')) { const clone = msgElement.cloneNode(true); clone.querySelector('.message-avatar')?.remove(); clone.querySelector('.tts-listen-btn')?.remove(); clone.classList.add('msg'); if(msgElement.classList.contains('user')) clone.classList.add('user'); else clone.classList.add('model'); clone.querySelector('.message-bubble')?.classList.add('bubble'); clone.querySelector('.message-timestamp')?.classList.add('time'); elementToExport.appendChild(clone); } }); const filename = `chat-${state.currentTopic?.name?.replace(/[^a-z0-9]/gi, '_') || 'vyuka'}-${Date.now()}.pdf`; const pdfOptions = { margin: 15, filename: filename, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, logging: false }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }; try { await html2pdf().set(pdfOptions).from(elementToExport).save(); showToast("Chat uložen jako PDF!", "success"); } catch (e) { console.error("PDF Generation Error:", e); showToast("Chyba při generování PDF.", "error"); } };

        // --- Gemini Interaction & Parsing ---
        // *** parseGeminiResponse needs careful review for symbols ***
        const parseGeminiResponse = (rawText) => {
            const boardMarker = "[BOARD_MARKDOWN]:";
            const ttsMarker = "[TTS_COMMENTARY]:";
            let boardMarkdown = "";
            let ttsCommentary = "";
            let chatText = "";

            // Robustly find content blocks, accounting for potential missing markers or code blocks
            const findContent = (marker, text) => {
                const markerIndex = text.indexOf(marker);
                if (markerIndex === -1) return { content: "", remainingText: text };

                let contentStart = markerIndex + marker.length;
                let content = "";
                let remainingText = text.substring(0, markerIndex); // Text before the marker

                // Find the start of the markdown block, if present
                const blockStartMatch = text.substring(contentStart).match(/^\s*```(markdown)?\s*\n/);
                if (blockStartMatch) {
                    contentStart += blockStartMatch[0].length;
                    const blockEndIndex = text.indexOf("```", contentStart);
                    if (blockEndIndex !== -1) {
                        content = text.substring(contentStart, blockEndIndex).trim();
                        remainingText += text.substring(blockEndIndex + 3); // Text after the block
                    } else {
                        content = text.substring(contentStart).trim(); // Take rest if closing ``` missing
                        console.warn("parseGeminiResponse: Missing closing ``` for marker:", marker);
                    }
                } else {
                    // If no code block, find the *next* marker or end of string
                    const nextBoard = text.indexOf(boardMarker, contentStart);
                    const nextTTS = text.indexOf(ttsMarker, contentStart);
                    let endPos = text.length;
                    if (nextBoard !== -1) endPos = Math.min(endPos, nextBoard);
                    if (nextTTS !== -1) endPos = Math.min(endPos, nextTTS);
                    content = text.substring(contentStart, endPos).trim();
                    remainingText += text.substring(endPos); // Add remaining text
                }
                return { content, remainingText };
            };

            let remaining = rawText;
            let boardResult = findContent(boardMarker, remaining);
            boardMarkdown = boardResult.content;
            remaining = boardResult.remainingText;

            let ttsResult = findContent(ttsMarker, remaining);
            ttsCommentary = ttsResult.content;
            remaining = ttsResult.remainingText;

            chatText = remaining.trim(); // Whatever is left is chat text

            // Basic check for stray markers that might indicate parsing issues
            if (chatText.includes(boardMarker) || chatText.includes(ttsMarker)) {
                console.warn("[ParseGemini] Potential parsing issue: Markers found in chatText:", chatText.substring(0, 100));
            }
            // Attempt to clean potential stray backticks or markdown formatting from chat text
            chatText = chatText.replace(/```(markdown)?\s*|\s*```/g, '').trim();

            console.log("[ParseGemini] Board:", boardMarkdown ? boardMarkdown.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini] TTS:", ttsCommentary ? ttsCommentary.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini] Chat (before clean):", chatText ? chatText.substring(0, 50) + "..." : "None");

            return { boardMarkdown, ttsCommentary, chatText };
        };
        // *** processGeminiResponse MODIFIED to handle aiIsWaitingForAnswer and enable continueBtn ***
        const processGeminiResponse = (rawText, timestamp) => {
            removeThinkingIndicator();
            state.lastInteractionTime = Date.now();
            console.log("Raw Gemini Response Received:", rawText ? rawText.substring(0, 100) + "..." : "Empty Response");

            if (!rawText) {
                handleGeminiError("AI vrátilo prázdnou odpověď.", timestamp);
                manageButtonStates(); // Ensure buttons are re-enabled on empty response
                return;
            }

            const { boardMarkdown, ttsCommentary, chatText } = parseGeminiResponse(rawText);
            let aiResponded = false;
            const cleanedChatText = cleanChatMessage(chatText);
            console.log(`[ProcessGemini] Cleaned chat text to be added: "${cleanedChatText}"`);

            // Handle board content
            if (boardMarkdown) {
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                if (ttsCommentary) {
                    speakText(ttsCommentary);
                }
                aiResponded = true;
                // --- MODIFICATION: Reset waiting state when board content is added ---
                state.aiIsWaitingForAnswer = false;
                // Check if the board content itself contains a clear question marker
                const lowerBoard = boardMarkdown.toLowerCase();
                if (lowerBoard.includes("otázka k řešení:") || lowerBoard.includes("vyřešte:") || lowerBoard.includes("úloha:") || lowerBoard.includes("zodpovězte:")) {
                     state.aiIsWaitingForAnswer = true; // Set waiting ONLY if a task is explicitly given on board
                     console.log("[ProcessGemini] Task found on board, setting aiIsWaitingForAnswer = true.");
                }
                // ---------------------------------------------------------------------
            }

            // Handle chat content
            const lowerOriginalChat = chatText.toLowerCase();
            const aiAskingQuestionInChat = lowerOriginalChat.includes('zkuste') || lowerOriginalChat.includes('jak byste') || lowerOriginalChat.includes('vypočítejte') || lowerOriginalChat.includes('otázka:') || lowerOriginalChat.includes('co si myslíte') || lowerOriginalChat.includes('co myslíš') || chatText.trim().endsWith('?');

            if (cleanedChatText) {
                const ttsForChat = (!boardMarkdown && ttsCommentary) ? ttsCommentary : null;
                addChatMessage(cleanedChatText, 'gemini', true, timestamp, ttsForChat, chatText);
                aiResponded = true;
                // --- MODIFICATION: Only set waiting if it's a direct question in chat AND board didn't already set it ---
                if (aiAskingQuestionInChat && !state.aiIsWaitingForAnswer) {
                     state.aiIsWaitingForAnswer = true;
                     console.log("[ProcessGemini] Question found in chat, setting aiIsWaitingForAnswer = true.");
                }
                // --------------------------------------------------------------------------------------------------------
            } else if (ttsCommentary && !boardMarkdown) {
                // If only TTS commentary exists, speak it
                speakText(ttsCommentary);
                aiResponded = true;
                // --- MODIFICATION: Don't set waiting just for TTS commentary ---
                // state.aiIsWaitingForAnswer = false; // (Ensure it's false unless board/chat explicitly asks)
                // -------------------------------------------------------------
            }

            // Fallback if nothing was processed
            if (!aiResponded && !boardMarkdown && !ttsCommentary && !cleanedChatText) {
                addChatMessage("(AI neodpovědělo očekávaným formátem nebo odpověď byla prázdná)", 'gemini', false, timestamp, null, rawText || "(Prázdná/neplatná odpověď)");
                console.warn("AI sent no usable content.");
                state.aiIsWaitingForAnswer = false; // Ensure not waiting if AI failed
            }

            // Update UI based on final waiting state
            if (state.aiIsWaitingForAnswer) {
                 manageUIState('waitingForAnswer');
            } else {
                 manageUIState('learning'); // Update to regular learning state if not waiting
            }
             // manageButtonStates is called within manageUIState, so no need to call it separately here.
        };

        // --- Prompts and Gemini Calls ---
        // *** MODIFIED PROMPTS v7 ***
        const _buildInitialPrompt = () => {
            const level = state.currentProfile?.skill_level || 'středně pokročilá'; // Default level
            const topicName = state.currentTopic?.name || 'Neznámé téma';
            return `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. Tvé vysvětlení musí být strukturované, přesné a profesionální. Téma lekce: "${topicName}". Cílová úroveň studenta: "${level}".

KLÍČOVÁ PRAVIDLA (DODRŽUJ VŽDY):
1.  **Obsah na tabuli:** Všechny klíčové informace (definice, věty, vzorce), řešené příklady a ÚLOHY K ŘEŠENÍ MUSÍ být ve formátu Markdown v sekci [BOARD_MARKDOWN]. Tabule je HLAVNÍ výukový prostor.
2.  **Hlasový komentář:** Sekce [TTS_COMMENTARY] slouží pro DOPLŇUJÍCÍ hlasový komentář k obsahu na tabuli (např. shrnutí, kontext, důraz na klíčové body). NEOPAKUJ doslova text z tabule.
3.  **Chat:** Text mimo značky (přímý chat) používej MINIMÁLNĚ – jen pro krátké pozdravy nebo jednoduché dotazy typu "Můžeme pokračovat?". NIKDY v chatu nezadávej nové úlohy nebo vysvětlení.
4.  **Struktura a Náročnost:** Postupuj logicky od základů ke složitějším konceptům. Po vysvětlení VŽDY zařaď řešený příklad a NÁSLEDNĚ úlohu k řešení studentem (na tabuli!). Postupně zvyšuj náročnost úloh. Zařaď i příklady s více kroky, zlomky, desetinnými čísly, nebo slovní úlohy relevantní k tématu.
5.  **Interakce:** Po zadání ÚLOHY K ŘEŠENÍ na tabuli jasně uveď, že očekáváš odpověď studenta (např. "Nyní zkuste tento příklad vypočítat vy." v [TTS_COMMENTARY]). V tomto případě NEPOKLÁDEJ další otázku v chatu. Tlačítko "Pokračuj" bude pro studenta neaktivní, dokud neodpoví v chatu. V ostatních případech (po vysvětlení, řešeném příkladu) NEČEKEJ na odpověď a NEPOKLÁDEJ zbytečné otázky typu "Je to jasné?". Student může kliknout na "Pokračuj" sám.

PRVNÍ KROK: Začni se ZÁKLADNÍ DEFINICÍ nebo klíčovým konceptem tématu "${topicName}".
POŽADOVANÝ FORMÁT ODPOVĚDI:
[BOARD_MARKDOWN]:
\`\`\`markdown
## ${topicName} - Základy
### [Krátký, výstižný podnadpis, např. Definice]
(Zde napiš stručnou, přesnou definici nebo úvodní koncept. Použij formátování jako **tučné písmo** pro důležité termíny a $$...$$ pro matematické vzorce/výrazy.)

### První řešený příklad
(Zde uveď první JEDNODUCHÝ řešený příklad ilustrující definici. Jasně odděl zadání a řešení.)
**Zadání:** ...
**Řešení:** ...
\`\`\`
[TTS_COMMENTARY]:
(Zde napiš hlasový komentář: Stručné přivítání, představení tématu a shrnutí toho, co je na tabuli – definice a první příklad. Zdůrazni klíčový bod.)

(Krátký text do chatu - VOLITELNÉ, např. "Začněme.")`;
        };

        const _buildContinuePrompt = () => {
            const level = state.currentProfile?.skill_level || 'středně pokročilá';
            const topicName = state.currentTopic?.name || 'Neznámé téma';
            return `Pokračuj ve výkladu tématu "${topicName}" pro studenta s úrovní "${level}". Naváž logicky na PŘEDCHOZÍ OBSAH NA TABULI.
KLÍČOVÁ PRAVIDLA (PŘIPOMENUTÍ):
- Všechny NOVÉ informace, řešené příklady a ÚLOHY K ŘEŠENÍ patří do [BOARD_MARKDOWN].
- Komentář k NOVÉMU obsahu tabule patří do [TTS_COMMENTARY].
- Postupuj systematicky, zvyšuj náročnost. Zařaď RŮZNÉ TYPY příkladů (výpočty, slovní úlohy...).
- Po zadání ÚLOHY K ŘEŠENÍ na tabuli jasně instruuj studenta, aby ji vyřešil (v TTS). NEPOKLÁDEJ další otázku v chatu.
- Po běžném vysvětlení nebo řešeném příkladu NEČEKEJ na odpověď a NEPOKLÁDEJ zbytečné otázky. Student klikne na "Pokračuj".

DALŠÍ KROK: Vygeneruj JEDEN z následujících kroků:
A) Další část teorie/vysvětlení navazující na předchozí.
B) Další ŘEŠENÝ příklad (složitější než předchozí).
C) ÚLOHU K ŘEŠENÍ pro studenta (složitější než předchozí řešený příklad).

POŽADOVANÝ FORMÁT ODPOVĚDI:
[BOARD_MARKDOWN]:
\`\`\`markdown
### [Nadpis další části / Řešený příklad / Úloha k řešení]
(Zde uveď text vysvětlení NEBO zadání a řešení příkladu NEBO POUZE ZADÁNÍ úlohy k řešení. Používej Markdown a $$...$$ pro matematiku.)
\`\`\`
[TTS_COMMENTARY]:
(Zde napiš hlasový komentář k NOVÉMU obsahu na tabuli. Pokud jsi zadal ÚLOHU K ŘEŠENÍ, jasně řekni: "Nyní zkuste tento příklad vyřešit vy a napište mi výsledek do chatu." Pokud jde o teorii/řešený příklad, stručně shrň hlavní myšlenku.)

(Text do chatu - VOLITELNÉ, pouze pokud NEZADÁVÁŠ úlohu k řešení, např. "Dobře, podívejme se na další krok.")`;
        };

        const _buildChatInteractionPrompt = (userText) => {
            const level = state.currentProfile?.skill_level || 'středně pokročilá';
            const topicName = state.currentTopic?.name || 'Neznámé téma';
            let baseInstruction;

            if (state.aiIsWaitingForAnswer) {
                baseInstruction = `Student dodal odpověď/řešení k předchozí úloze na tabuli k tématu "${topicName}": "${userText}".
TVŮJ ÚKOL:
1.  **Stručně vyhodnoť** správnost studentovy odpovědi.
2.  Pokud je špatně, **jemně oprav a VYSVĚTLI chybu**.
3.  Pokud je správně, **pochval**.
4.  **NEPOKLÁDEJ novou otázku ani nezadávej další úkol v chatu**. Jen potvrď/oprav odpověď. Student sám klikne na "Pokračuj" pro další krok na tabuli.`;
            } else {
                baseInstruction = `Student položil otázku nebo komentář k probíranému tématu "${topicName}": "${userText}".
TVŮJ ÚKOL:
1.  **Odpověz stručně a PŘÍMO k dotazu studenta.** Využij kontext toho, co je aktuálně na TABULI.
2.  **NEVYSVĚTLUJ novou látku** ani nezadávej nové příklady v chatu. Odkazuj na tabuli nebo počkej na další krok po kliknutí "Pokračuj".
3.  **Udržuj profesionální, ale nápomocný tón** (úroveň "${level}").
4.  Ukonči odpověď neutrálně, např. "Jasné?", "Stačí takto?". Nechej iniciativu dalšího kroku na studentovi (tlačítko "Pokračuj").`;
            }

            return `${baseInstruction}
PRAVIDLA CHATU (PŘIPOMENUTÍ): Odpovídej POUZE běžným textem do chatu. Nepoužívej [BOARD_MARKDOWN] ani [TTS_COMMENTARY]. Buď stručný a věcný.`;
        };
        // --------------------------

        // _buildGeminiPayloadContents, sendToGemini, handleGeminiError remain mostly the same
        const _buildGeminiPayloadContents = (userPrompt, isChatInteraction = false) => { const level = state.currentProfile?.skill_level || 'středně pokročilá'; const topicName = state.currentTopic?.name || 'Neznámé téma'; const systemInstruction = `Jsi expertní AI Tutor "Justax". Vyučuješ téma: "${topicName}" studenta s úrovní "${level}" pro přípravu na PŘIJÍMACÍ ZKOUŠKY 9. třídy ZŠ v ČR. Komunikuješ v ČEŠTINĚ. VŽDY dodržuj tato pravidla: 1. VŠECHNY definice, vzorce, vysvětlení, ŘEŠENÉ PŘÍKLADY a ÚLOHY K ŘEŠENÍ patří VÝHRADNĚ do [BOARD_MARKDOWN]: \`\`\`markdown ... \`\`\`. 2. [TTS_COMMENTARY]: ... používej pro DOPLNĚNÍ k tabuli, NEOPAKUJ text doslova. 3. Přímý chat (mimo značky) používej MINIMÁLNĚ. NIKDY v něm nezadávej nové úlohy/příklady. 4. Postupuj logicky, zvyšuj náročnost úloh na tabuli. Zařaď RŮZNÉ typy úloh. 5. Po zadání ÚLOHY K ŘEŠENÍ na tabuli, v [TTS_COMMENTARY] jasně řekni, že čekáš na odpověď studenta v chatu. V JINÝCH případech NEČEKEJ na odpověď a NEPOKLÁDEJ zbytečné dotazy. 6. Pokud student ODPOVÍDÁ na úlohu, nebo POKLÁDÁ OTÁZKU, odpovídej POUZE textem do CHATU podle instrukcí v promptu.`; const history = state.geminiChatContext.slice(-MAX_GEMINI_HISTORY_TURNS * 2); const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] }; const contents = [ { role: "user", parts: [{ text: systemInstruction }] }, { role: "model", parts: [{ text: `Rozumím. Budu se řídit pravidly a formátem [BOARD_MARKDOWN] a [TTS_COMMENTARY]. Výklad a úlohy budou na tabuli. Chat využiji minimálně nebo pro odpovědi na studentovy otázky/řešení.` }] }, ...history, currentUserMessage ]; return contents; };
        const sendToGemini = async (prompt, isChatInteraction = false) => { if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) { showToast("Chyba Konfigurace", "Chybí API klíč pro AI.", "error"); updateGeminiThinkingState(false); return; } if (!state.currentTopic) { showToast("Chyba", "Není vybráno téma.", "error"); updateGeminiThinkingState(false); return; } if (!navigator.onLine) { showToast("Offline", "Nelze komunikovat s AI bez připojení.", "warning"); updateGeminiThinkingState(false); return; } console.log(`Sending to Gemini (Chat Interaction: ${isChatInteraction}): "${prompt.substring(0, 80)}..."`); const timestamp = new Date(); updateGeminiThinkingState(true); const contents = _buildGeminiPayloadContents(prompt, isChatInteraction); const body = { contents, generationConfig: { temperature: 0.6, topP: 0.95, topK: 40, maxOutputTokens: 8192 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ] }; try { const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!response.ok) { let errorText = `Chyba API (${response.status})`; try { const errData = await response.json(); errorText += `: ${errData?.error?.message || 'Neznámá chyba'}`; } catch (e) { errorText += `: ${await response.text()}`; } throw new Error(errorText); } const data = await response.json(); if (data.promptFeedback?.blockReason) { throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}. Zkuste přeformulovat.`); } const candidate = data.candidates?.[0]; if (!candidate) { throw new Error('AI neposkytlo platnou odpověď.'); } if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) { console.warn(`Gemini finishReason: ${candidate.finishReason}.`); if (candidate.finishReason === 'SAFETY') throw new Error('Odpověď blokována bezpečnostním filtrem AI.'); } const text = candidate.content?.parts?.[0]?.text; if (!text && candidate.finishReason !== 'STOP') { if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Odpověď AI byla příliš dlouhá (Max Tokens).'); else throw new Error('AI vrátilo prázdnou odpověď (Důvod: '+(candidate.finishReason || 'Neznámý')+').'); } state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] }); state.geminiChatContext.push({ role: "model", parts: [{ text: text || "" }] }); if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2 + 2) { state.geminiChatContext.splice(2, state.geminiChatContext.length - (MAX_GEMINI_HISTORY_TURNS * 2 + 2)); } processGeminiResponse(text || "", timestamp); } catch (error) { console.error('Chyba komunikace s Gemini:', error); showToast(`Chyba AI: ${error.message}`, "error"); handleGeminiError(error.message, timestamp); } finally { updateGeminiThinkingState(false); } };
        const handleGeminiError = (msg, time) => { removeThinkingIndicator(); addChatMessage(`Nastala chyba při komunikaci s AI: ${msg}`, 'gemini', false, time, null, `(Chyba: ${msg})`); state.aiIsWaitingForAnswer = false; manageUIState('learning'); };

        // --- Notification Logic ---
        // fetchNotifications, renderNotifications, renderNotificationSkeletons, markNotificationRead, markAllNotificationsRead
        // --- (No changes needed, keeping existing functions) ---
        async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) { if (!state.supabase || !userId) { console.error("[Notifications] Missing Supabase or User ID."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Fetching unread notifications for user ${userId}`); setLoadingState('notifications', true); try { const { data, error, count } = await state.supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; console.log(`[Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } finally { setLoadingState('notifications', false); } }
        function renderNotifications(count, notifications) { console.log("[Render Notifications] Start, Count:", count, "Notifications:", notifications); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements for notifications."); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } console.log("[Render Notifications] Finished rendering."); }
        function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
        async function markNotificationRead(notificationId) { console.log("[Notifications] Marking notification as read:", notificationId); if (!state.currentUser || !notificationId || !state.supabase) return false; try { const { error } = await state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[Notifications] Mark as read successful for ID:", notificationId); return true; } catch (error) { console.error("[Notifications] Mark as read error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
        async function markAllNotificationsRead() { console.log("[Notifications] Marking all as read for user:", state.currentUser?.id); if (!state.currentUser || !ui.markAllReadBtn || !state.supabase) return; setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; try { const { error } = await state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('is_read', false); if (error) throw error; console.log("[Notifications] Mark all as read successful in DB."); const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[Notifications] Mark all as read error:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }

        // --- Run Application ---
        document.addEventListener('DOMContentLoaded', initializeApp);

    } catch (e) {
        // --- Fatal Error Handling ---
        console.error("FATAL SCRIPT ERROR:", e);
        document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--accent-pink,#ff33a8);color:var(--white,#fff);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky.</p><p style="margin-top:15px;"><a href="#" onclick="location.reload()" style="color:var(--accent-cyan,#00e0ff); text-decoration:underline; font-weight:bold;">Obnovit stránku</a></p><details style="margin-top: 20px; color: #f0f0f0;"><summary style="cursor:pointer; color: var(--white,#fff);">Detaily</summary><pre style="margin-top:10px;padding:15px;background:rgba(0, 0, 0, 0.4);border:1px solid rgba(255, 255, 255, 0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;max-height: 300px; overflow-y: auto; border-radius: 8px;">${e.message}\n${e.stack}</pre></details></div>`;
    }

})(); // End IIFE