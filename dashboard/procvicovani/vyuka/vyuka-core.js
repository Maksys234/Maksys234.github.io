// Файл: procvicovani/vyuka/vyuka-core.js
// Основная логика, инициализация, UI, утилиты

// Создаем глобальное пространство имен, если его еще нет
window.VyukaApp = window.VyukaApp || {};

(function(VyukaApp) { // Используем IIFE для локальной области видимости, передаем VyukaApp
	'use strict';

	try {
		// --- Constants & Configuration (Core) ---
		VyukaApp.config = {
            SUPABASE_URL: 'https://qcimhjjwvsbgjsitmvuh.supabase.co',
            SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10',
            NOTIFICATION_FETCH_LIMIT: 5,
            POINTS_TOPIC_COMPLETE: 25,
            // Добавьте другие основные константы при необходимости
		};

		// --- DOM Elements Cache ---
		VyukaApp.ui = {
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
			toastContainer: document.getElementById('toast-container'),
			globalError: document.getElementById('global-error'),
			dashboardFooter: document.querySelector('.dashboard-footer'),
			currentYearFooter: document.getElementById('currentYearFooter'),
			mouseFollower: document.getElementById('mouse-follower'),
            completionSuggestionOverlay: document.getElementById('completionSuggestionOverlay'),
            completionSuggestionModal: document.getElementById('completionSuggestionModal'),
            confirmCompleteBtn: document.getElementById('confirmCompleteBtn'),
            declineCompleteBtn: document.getElementById('declineCompleteBtn'),
            closeCompletionModalBtn: document.getElementById('closeCompletionModalBtn')
		};

		// --- Global State ---
		VyukaApp.state = {
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
			 aiIsWaitingForAnswer: false,
			 lastInteractionTime: Date.now(),
             aiSuggestedCompletion: false
		 };

		// --- Helper Functions (Core) ---
		VyukaApp.showToast = (title, message, type = 'info', duration = 4500) => {
             const ui = VyukaApp.ui; // Use namespaced ui
             if (!ui.toastContainer) return;
             try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${VyukaApp.sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${VyukaApp.sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); }
        };
		VyukaApp.showError = (message, isGlobal = false) => {
             console.error("Došlo k chybě:", message);
             const ui = VyukaApp.ui;
             if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${VyukaApp.sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; }
             else { VyukaApp.showToast('CHYBA SYSTÉMU', message, 'error', 6000); }
        };
		VyukaApp.hideError = () => { if (VyukaApp.ui.globalError) VyukaApp.ui.globalError.style.display = 'none'; };
		VyukaApp.sanitizeHTML = (str) => { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; };
		VyukaApp.getInitials = (profileData, email) => { // *** MODIFIED v19 ***
             if (!profileData && !email) return '?'; // Fallback
             const avatarUrl = profileData?.avatar_url;
             if (avatarUrl) { return `<img src="${VyukaApp.sanitizeHTML(avatarUrl)}" alt="User Avatar">`; }
             else { let initials = ''; if (profileData?.first_name) initials += profileData.first_name[0]; if (profileData?.last_name) initials += profileData.last_name[0]; if (initials) return initials.toUpperCase(); if (profileData?.username) return profileData.username[0].toUpperCase(); if (email) return email[0].toUpperCase(); return 'U'; }
        };
		VyukaApp.formatTimestamp = (d = new Date()) => d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        VyukaApp.formatRelativeTime = (timestamp) => { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } };
		VyukaApp.openMenu = () => { const ui = VyukaApp.ui; if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } };
		VyukaApp.closeMenu = () => { const ui = VyukaApp.ui; if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } };
        VyukaApp.renderMarkdown = (el, text, isChat = false) => {
			if (!el) return;
			const originalText = text || '';
			try {
				if (typeof marked === 'undefined') { console.error("Marked library not loaded!"); el.innerHTML = `<p>${VyukaApp.sanitizeHTML(originalText)}</p>`; return; }
                const options = { gfm: true, breaks: true, sanitize: !isChat, smartypants: false };
				marked.setOptions(options);
				const htmlContent = marked.parse(originalText);
                const simpleTextRegex = /^[a-zA-Z0-9\s.,!?;:'"()\-–—…%€$£¥+*/=<>&^~`[\]{}čšžřďťňČŠŽŘĎŤŇáéíóúůýÁÉÍÓÚŮÝäëïöüÄËÏÖÜ]+$/;
				if (htmlContent === originalText.replace(/\n/g, '<br>') || (simpleTextRegex.test(originalText) && !originalText.includes('\n'))) { el.innerHTML = `<p>${VyukaApp.sanitizeHTML(originalText)}</p>`; }
				else { el.innerHTML = htmlContent; }
			} catch (e) { console.error("Markdown rendering error:", e); el.innerHTML = `<p style="color:var(--accent-pink);">Chyba renderování Markdown.</p><pre><code>${VyukaApp.sanitizeHTML(originalText)}</code></pre>`; }
		};
		VyukaApp.autoResizeTextarea = () => { const ui = VyukaApp.ui; if (!ui.chatInput) return; ui.chatInput.style.height = 'auto'; const scrollHeight = ui.chatInput.scrollHeight; const maxHeight = 110; ui.chatInput.style.height = `${Math.min(scrollHeight, maxHeight)}px`; ui.chatInput.style.overflowY = scrollHeight > maxHeight ? 'scroll' : 'hidden'; };
		VyukaApp.generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
		VyukaApp.initTooltips = () => { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Tooltipster error:", e); } };
		VyukaApp.updateOnlineStatus = () => { const ui = VyukaApp.ui; if (ui.offlineBanner) { ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; } if (!navigator.onLine) { VyukaApp.showToast('Offline', 'Spojení bylo ztraceno. Některé funkce nemusí být dostupné.', 'warning'); } };
		VyukaApp.updateCopyrightYear = () => { const year = new Date().getFullYear(); const ui = VyukaApp.ui; if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
		VyukaApp.initMouseFollower = () => { const follower = VyukaApp.ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
		VyukaApp.initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) { console.log("Scroll animations not initialized."); return; } const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
		VyukaApp.initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = VyukaApp.ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); };
		VyukaApp.clearInitialChatState = () => { const ui = VyukaApp.ui; const initialElement = ui.chatMessages?.querySelector('.initial-chat-interface'); if (initialElement) { initialElement.remove(); console.log("Initial chat state cleared."); } };
		VyukaApp.setLoadingState = (sectionKey, isLoadingFlag) => {
             const state = VyukaApp.state; // Use namespaced state
             if (state.isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;
             if (sectionKey === 'all') { Object.keys(state.isLoading).forEach(key => state.isLoading[key] = isLoadingFlag); }
             else { state.isLoading[sectionKey] = isLoadingFlag; }
             console.log(`[SetLoading] ${sectionKey}: ${isLoadingFlag}`);
             const ui = VyukaApp.ui; // Use namespaced ui
             if (sectionKey === 'chat') { if (ui.sendButton) { ui.sendButton.disabled = isLoadingFlag || state.geminiIsThinking || state.topicLoadInProgress || state.isListening; ui.sendButton.innerHTML = state.geminiIsThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>'; } }
             if (sectionKey === 'currentTopic') { if (ui.currentTopicDisplay) { if (isLoadingFlag) { ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám téma...</span>'; } } }
             if (sectionKey === 'notifications') { if (ui.notificationBell) ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1; if (ui.markAllReadBtn) { const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0; } if (isLoadingFlag && ui.notificationsList && VyukaApp.renderNotificationSkeletons) { VyukaApp.renderNotificationSkeletons(2); } }
             if (VyukaApp.manageButtonStates) VyukaApp.manageButtonStates(); // Call manageButtonStates if it exists
        };
		VyukaApp.updateTheme = () => { const state = VyukaApp.state; console.log("Updating theme, isDarkMode:", state.isDarkMode); document.documentElement.classList.toggle('dark', state.isDarkMode); document.documentElement.classList.toggle('light', !state.isDarkMode); document.documentElement.style.setProperty('--board-highlight-color', state.isDarkMode ? 'var(--board-highlight-dark)' : 'var(--board-highlight-light)'); };

		// --- UI State & Button Management ---
		VyukaApp.manageUIState = (mode, options = {}) => {
			const state = VyukaApp.state;
			const ui = VyukaApp.ui;
            console.log("[UI State]:", mode, options);
            state.lastInteractionTime = Date.now();
            if (ui.learningInterface) ui.learningInterface.style.display = 'flex';

            // Update topic display based on current state
            if (state.currentTopic) { if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `Téma: <strong>${VyukaApp.sanitizeHTML(state.currentTopic.name)}</strong>`; }
            else if (mode === 'loadingTopic') { if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám téma...</span>'; }
            else if (mode === 'noPlan'){ if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder">Žádný aktivní plán</span>'; }
            else if (mode === 'planComplete'){ if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder">Plán dokončen!</span>'; }
            else if (mode === 'error'){ if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder error">Chyba načítání</span>'; }
            else if (!state.currentUser) { if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder">Nepřihlášen</span>'; }
            else { if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder">Připraven...</span>'; }

            // Handle initial/empty/error states for chat area
            const isChatInitial = !!ui.chatMessages?.querySelector('.initial-chat-interface');
            if (isChatInitial || mode === 'error' || mode === 'noPlan' || mode === 'planComplete' || mode === 'loggedOut') {
                let emptyStateHTML = '';
                switch (mode) {
                    case 'loggedOut': emptyStateHTML = `<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPŘIHLÁŠEN</h3><p>Pro přístup k výuce se prosím <a href="/auth/index.html" style="color: var(--accent-primary)">přihlaste</a>.</p></div>`; break;
                    case 'noPlan': emptyStateHTML = `<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ŽÁDNÝ AKTIVNÍ PLÁN</h3><p>Nemáte aktivní studijní plán. Nejprve prosím dokončete <a href="/dashboard/procvicovani/test1.html" style="color: var(--accent-primary)">diagnostický test</a>.</p></div>`; break;
                    case 'planComplete': emptyStateHTML = `<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLÁN DOKONČEN!</h3><p>Všechny naplánované aktivity jsou hotové. Skvělá práce! Můžete si <a href="/dashboard/procvicovani/plan.html" style="color: var(--accent-primary)">vytvořit nový plán</a>.</p></div>`; break;
                    case 'error': emptyStateHTML = `<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA SYSTÉMU</h3><p>${options.errorMessage || 'Nastala chyba při načítání dat.'}</p></div>`; break;
                    case 'loadingTopic': emptyStateHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>NAČÍTÁNÍ TÉMATU...</h3></div>'; break;
                    default: if (isChatInitial) { emptyStateHTML = `<div class="initial-chat-interface"><div class="ai-greeting-avatar"><i class="fas fa-robot"></i></div><h3 class="initial-chat-title">AI Tutor Justax je připraven</h3><p class="initial-chat-message">Čekám na načtení tématu nebo vaši zprávu.</p><div class="initial-chat-status"><span class="status-dot online"></span> Online</div></div>`; }
                }
                if (emptyStateHTML && ui.chatMessages) { ui.chatMessages.innerHTML = emptyStateHTML; }
            }
            VyukaApp.manageButtonStates(); // Always update button states
       };
		VyukaApp.manageButtonStates = () => {
            const state = VyukaApp.state;
            const ui = VyukaApp.ui;
            const canInteractBase = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress;
            const canChat = canInteractBase || (!!state.currentTopic && state.aiIsWaitingForAnswer);
            const canContinue = canInteractBase && !state.aiIsWaitingForAnswer && !state.aiSuggestedCompletion;

            if (ui.sendButton) { ui.sendButton.disabled = !canChat || state.isListening || state.geminiIsThinking; ui.sendButton.innerHTML = state.geminiIsThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>'; }
            if (ui.chatInput) { ui.chatInput.disabled = !canChat || state.isListening || state.geminiIsThinking; ui.chatInput.placeholder = state.isListening ? "Poslouchám..." : (canChat ? "Zeptejte se nebo odpovězte..." : "Počkejte prosím..."); }
            if (ui.continueBtn) { ui.continueBtn.disabled = !canContinue; ui.continueBtn.style.display = state.currentTopic ? 'inline-flex' : 'none'; }
            if (ui.clearBoardBtn) { ui.clearBoardBtn.disabled = !ui.whiteboardContent || ui.whiteboardContent.children.length === 0 || state.geminiIsThinking; }
            if (ui.stopSpeechBtn) { ui.stopSpeechBtn.disabled = !state.speechSynthesisSupported || !window.speechSynthesis.speaking; }
            if (ui.micBtn) { const canUseMic = canChat && state.speechRecognitionSupported && !state.geminiIsThinking; ui.micBtn.disabled = !canUseMic; ui.micBtn.classList.toggle('listening', state.isListening); ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporováno" : state.isListening ? "Zastavit hlasový vstup" : "Zahájit hlasový vstup"; }
            const isChatEmptyOrInitial = ui.chatMessages?.children.length === 0 || !!ui.chatMessages?.querySelector('.initial-chat-interface');
            if (ui.clearChatBtn) { ui.clearChatBtn.disabled = state.geminiIsThinking || isChatEmptyOrInitial; }
            if (ui.saveChatBtn) { ui.saveChatBtn.disabled = state.geminiIsThinking || isChatEmptyOrInitial; }

            let statusText = "Připraven...";
            if (state.isLoading.currentTopic || state.topicLoadInProgress) statusText = "Načítám téma...";
            else if (state.geminiIsThinking) statusText = "Přemýšlím...";
            else if (state.isListening) statusText = "Poslouchám...";
            else if (window.speechSynthesis.speaking) statusText = "Mluvím...";
            else if (state.aiIsWaitingForAnswer) statusText = "Čekám na vaši odpověď...";
            else if (state.aiSuggestedCompletion) statusText = "Navrženo dokončení tématu...";
            else if (!state.currentTopic) statusText = "Žádné téma...";
            if (ui.aiStatusText) ui.aiStatusText.textContent = statusText;
       };

		// --- Initialization (Core) ---
		VyukaApp.initializeSupabase = () => {
            try {
                if (!window.supabase) throw new Error("Supabase library not loaded.");
                VyukaApp.state.supabase = window.supabase.createClient(VyukaApp.config.SUPABASE_URL, VyukaApp.config.SUPABASE_ANON_KEY);
                if (!VyukaApp.state.supabase) throw new Error("Client creation failed.");
                console.log("Supabase initialized.");
                return true;
            } catch (error) {
                console.error("Supabase init failed:", error);
                VyukaApp.showToast("Chyba DB.", "error", 10000);
                return false;
            }
        };
		VyukaApp.initializeUI = () => {
            const ui = VyukaApp.ui;
            const state = VyukaApp.state;
             try {
                 VyukaApp.updateTheme();
                 VyukaApp.setupBaseEventListeners(); // Setup only base listeners here
                 VyukaApp.initTooltips();
                 if (ui.chatTabButton) ui.chatTabButton.classList.add('active');
                 if (ui.chatTabContent) ui.chatTabContent.classList.add('active');
                 if (state.speechSynthesisSupported) { if (window.speechSynthesis.getVoices().length > 0) { VyukaApp.loadVoices(); } else if (window.speechSynthesis.onvoiceschanged !== undefined) { window.speechSynthesis.onvoiceschanged = VyukaApp.loadVoices; } }
                 else { console.warn("Speech Synthesis not supported."); }
                 VyukaApp.initializeSpeechRecognition(); // Assumes this function is moved to features
                 VyukaApp.initMouseFollower();
                 VyukaApp.initHeaderScrollDetection();
                 VyukaApp.updateCopyrightYear();
                 VyukaApp.updateOnlineStatus();
                 VyukaApp.manageUIState('initial');
                 console.log("UI Initialized successfully.");
                 return true;
             } catch(error) {
                 console.error("UI Init failed:", error);
                 VyukaApp.showError(`Chyba inicializace UI: ${error.message}`, true);
                 return false;
             }
        };
		VyukaApp.initializeApp = async () => {
            const ui = VyukaApp.ui;
            const state = VyukaApp.state;
            console.log("🚀 [Init Vyuka - Kyber v19 Core] Starting...");
            if (!VyukaApp.initializeSupabase()) return;
            if (typeof marked === 'undefined') { VyukaApp.showError("Kritická chyba: Knihovna 'marked.js' se nepodařilo načíst. Obnovte stránku.", true); if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); } return; }
            console.log("✅ Marked library found.");
            if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
            if (ui.mainContent) ui.mainContent.style.display = 'none';

            try {
                console.log("[INIT Core] Checking auth session...");
                const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
                if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);
                if (!session || !session.user) { console.log('[Init Vyuka - Kyber Core] Not logged in. Redirecting...'); window.location.href = '/auth/index.html'; return; }
                state.currentUser = session.user;
                console.log(`[INIT Core] User authenticated (ID: ${state.currentUser.id}).`);
                VyukaApp.setLoadingState('user', true);
                state.currentProfile = await VyukaApp.fetchUserProfile(state.currentUser.id);
                VyukaApp.updateUserInfoUI();
                VyukaApp.setLoadingState('user', false);

                if (!state.currentProfile) { VyukaApp.showError("Profil nenalezen nebo se nepodařilo načíst.", true); if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); } if (ui.mainContent) ui.mainContent.style.display = 'flex'; VyukaApp.manageUIState('error', { errorMessage: 'Profil nenalezen.' }); return; }

                if (!VyukaApp.initializeUI()) return; // Initialize core UI elements and base listeners

                // Setup feature-specific listeners (assuming this function is in vyuka-features.js)
                if (typeof VyukaApp.setupFeatureListeners === 'function') {
                    VyukaApp.setupFeatureListeners();
                } else {
                    console.warn("VyukaApp.setupFeatureListeners function not found. Feature event listeners might not be attached.");
                }

                console.log("[INIT Core] Loading initial topic and notifications...");
                // Load notifications (assuming function is in vyuka-features.js)
                const loadNotificationsPromise = typeof VyukaApp.fetchNotifications === 'function'
                    ? VyukaApp.fetchNotifications(state.currentUser.id, VyukaApp.config.NOTIFICATION_FETCH_LIMIT)
                        .then(({ unreadCount, notifications }) => VyukaApp.renderNotifications(unreadCount, notifications))
                        .catch(err => { console.error("Chyba při úvodním načítání notifikací:", err); if(VyukaApp.renderNotifications) VyukaApp.renderNotifications(0, []); })
                    : Promise.resolve(console.warn("VyukaApp.fetchNotifications not found."));

                await loadNotificationsPromise;

                // Load initial topic (assuming function is in vyuka-features.js)
                const loadTopicPromise = typeof VyukaApp.loadNextUncompletedTopic === 'function'
                     ? VyukaApp.loadNextUncompletedTopic()
                     : Promise.resolve(console.warn("VyukaApp.loadNextUncompletedTopic not found."));

                await loadTopicPromise;

                if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
                if (ui.mainContent) { ui.mainContent.style.display = 'flex'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); }); }

                VyukaApp.initScrollAnimations();
                console.log("✅ [Init Vyuka - Kyber v19 Core] Page Initialized.");

            } catch (error) {
                console.error("❌ [Init Vyuka - Kyber Core] Critical initialization error:", error);
                if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). Obnovte.</p>`; }
                else { VyukaApp.showError(`Chyba inicializace: ${error.message}`, true); }
                if (ui.mainContent) ui.mainContent.style.display = 'flex';
                VyukaApp.setLoadingState('all', false);
            }
        };

		// --- User Profile & Auth ---
		VyukaApp.fetchUserProfile = async (userId) => {
             const state = VyukaApp.state;
             if (!state.supabase || !userId) return null;
             console.log(`[Profile] Fetching profile for user ID: ${userId}`);
             try { const { data: profile, error } = await state.supabase.from('profiles').select('*').eq('id', userId).single(); if (error && error.code !== 'PGRST116') throw error; if (!profile) { console.warn(`[Profile] Profile not found for user ${userId}.`); return null; } console.log("[Profile] Profile data fetched."); return profile; }
             catch (error) { console.error('[Profile] Exception fetching profile:', error); VyukaApp.showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error'); return null; }
        };
		VyukaApp.updateUserInfoUI = () => {
             const ui = VyukaApp.ui;
             const state = VyukaApp.state;
             if (ui.sidebarName && ui.sidebarAvatar) {
                 if (state.currentUser && state.currentProfile) {
                     const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot';
                     ui.sidebarName.textContent = VyukaApp.sanitizeHTML(displayName);
                     ui.sidebarAvatar.innerHTML = VyukaApp.getInitials(state.currentProfile, state.currentUser.email);
                 } else {
                     ui.sidebarName.textContent = 'Nepřihlášen';
                     ui.sidebarAvatar.textContent = '?';
                 }
             }
        };
		VyukaApp.handleLoggedOutUser = () => { const ui = VyukaApp.ui; console.warn("User not logged in."); if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder">Nejste přihlášeni</span>'; VyukaApp.showToast("Prosím, přihlaste se.", "warning"); VyukaApp.manageUIState('loggedOut'); };

		// --- Base Event Listeners Setup ---
		VyukaApp.setupBaseEventListeners = () => {
            const ui = VyukaApp.ui;
            console.log("[SETUP Core] Setting up base event listeners...");
            if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', VyukaApp.openMenu);
            if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', VyukaApp.closeMenu);
            if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', VyukaApp.closeMenu);
            document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) VyukaApp.closeMenu(); }); });
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => { VyukaApp.state.isDarkMode = event.matches; console.log("Theme changed, isDarkMode:", VyukaApp.state.isDarkMode); VyukaApp.updateTheme(); });
            window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) { VyukaApp.closeMenu(); } });
            window.addEventListener('online', VyukaApp.updateOnlineStatus);
            window.addEventListener('offline', VyukaApp.updateOnlineStatus);
            // Close notifications dropdown on outside click
            document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } });
            console.log("[SETUP Core] Base event listeners setup complete.");
        };

		// --- Fatal Error Handling ---
		// This remains the same, defined within the main try-catch block

		// --- Run Application ---
		document.addEventListener('DOMContentLoaded', VyukaApp.initializeApp);

	} catch (e) {
		// --- Fatal Error Handling ---
		console.error("FATAL SCRIPT ERROR (Core):", e);
		document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--accent-pink,#ff33a8);color:var(--white,#fff);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky (Core).</p><p style="margin-top:15px;"><a href="#" onclick="location.reload()" style="color:var(--accent-cyan,#00e0ff); text-decoration:underline; font-weight:bold;">Obnovit stránku</a></p><details style="margin-top: 20px; color: #f0f0f0;"><summary style="cursor:pointer; color: var(--white,#fff);">Detaily</summary><pre style="margin-top:10px;padding:15px;background:rgba(0, 0, 0, 0.4);border:1px solid rgba(255, 255, 255, 0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;max-height: 300px; overflow-y: auto; border-radius: 8px;">${e.message}\n${e.stack}</pre></details></div>`;
	}

})(window.VyukaApp); // Pass the namespace object to the IIFE