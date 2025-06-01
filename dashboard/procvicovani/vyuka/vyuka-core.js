// Файл: procvicovani/vyuka/vyuka-core.js
// Основная логика приложения, состояние, инициализация UI и базовые обработчики событий.
// Версия v24: Обновлено управление состоянием кнопок с учетом финального теста.

window.VyukaApp = window.VyukaApp || {};

(function(VyukaApp) {
	'use strict';

	try {
		VyukaApp.config = {
            SUPABASE_URL: 'https://qcimhjjwvsbgjsitmvuh.supabase.co',
            SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10',
            NOTIFICATION_FETCH_LIMIT: 5,
            POINTS_TOPIC_COMPLETE: 25,
            // GEMINI_API_KEY and other AI related configs are in vyuka-ai-interaction.js
		};

		VyukaApp.ui = {
			initialLoader: document.getElementById('initial-loader'),
            loadingTextAnim: document.getElementById('loading-text-anim'),
			offlineBanner: document.getElementById('offline-banner'),

            vyukaSidebarAi: document.getElementById('vyuka-sidebar-ai'),
            sidebarAiDesktopToggle: document.getElementById('sidebar-ai-desktop-toggle'),
            mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
            sidebarOverlayAi: document.getElementById('sidebar-overlay-ai'),

            vyukaHeader: document.getElementById('vyuka-header'),
            vyukaSubjectTitle: document.getElementById('vyuka-subject-title'),
            vyukaTopicSubtitle: document.getElementById('vyuka-topic-subtitle'),

            notificationBell: document.getElementById('notification-bell'),
			notificationCount: document.getElementById('notification-count'),
			notificationsDropdown: document.getElementById('notifications-dropdown'),
			notificationsList: document.getElementById('notifications-list'),
			noNotificationsMsg: document.getElementById('no-notifications-msg'),
			markAllReadBtn: document.getElementById('mark-all-read'),

            vyukaHeaderUserDisplay: document.querySelector('.vyuka-header-user-display'),
            vyukaHeaderAvatar: document.getElementById('vyuka-header-avatar'),
            vyukaHeaderUserName: document.getElementById('vyuka-header-user-name'),
            vyukaHeaderUserTitle: document.getElementById('vyuka-header-user-title'),
            userMenuContainer: document.querySelector('.user-menu-container'),
            userDropdownMenu: document.getElementById('user-dropdown-menu'),
            vyukaLogoutBtn: document.getElementById('vyuka-logout-btn'),

            vyukaPageContainer: document.getElementById('vyuka-page-container'),
            vyukaMainContent: document.getElementById('vyuka-main-content'),
			globalError: document.getElementById('global-error'),

            aiPresenterArea: document.getElementById('ai-presenter-area'),
			whiteboardContainer: document.getElementById('whiteboard-container'),
			whiteboardContent: document.getElementById('whiteboard-content'),
			boardSpeakingIndicator: document.getElementById('board-speaking-indicator'),
            vyukaLessonControls: document.querySelector('.vyuka-lesson-controls'),
            continueBtn: document.getElementById('continue-btn'),
			clearBoardBtn: document.getElementById('clear-board-btn'),
            stopSpeechBtn: document.getElementById('stop-speech-btn'),

            vyukaChatPanel: document.getElementById('vyuka-chat-panel'),
            currentTopicDisplay: document.getElementById('current-topic-display'),
            aiModelSelect: document.getElementById('ai-model-select'),
            interactionPanelContent: document.querySelector('.interaction-panel-content'),
			chatTabContent: document.getElementById('chat-tab-content'),
			chatMessages: document.getElementById('chat-messages'),
			chatInput: document.getElementById('chat-input'),
			sendButton: document.getElementById('send-button'),
			chatControls: document.querySelector('.chat-controls'),
			micBtn: document.getElementById('mic-btn'),
			clearChatBtn: document.getElementById('clear-chat-btn'),
			saveChatBtn: document.getElementById('save-chat-btn'),

			vyukaFooter: document.querySelector('.vyuka-footer'),
            currentYearFooter: document.querySelector('.vyuka-footer #currentYearFooter'),
            currentYearSidebarVyuka: document.getElementById('currentYearSidebarVyuka'),


			mouseFollower: document.getElementById('mouse-follower'),
            completionSuggestionOverlay: document.getElementById('completionSuggestionOverlay'),
            completionSuggestionModal: document.getElementById('completionSuggestionModal'),
            confirmCompleteBtn: document.getElementById('confirmCompleteBtn'),
            declineCompleteBtn: document.getElementById('declineCompleteBtn'),
            closeCompletionModalBtn: document.getElementById('closeCompletionModalBtn'),
            aiAvatarCorner: document.getElementById('ai-avatar-corner-indicator'),
		};

		VyukaApp.state = {
			 supabase: null, currentUser: null, currentProfile: null, allTitles: [],
			 currentTopic: null, currentPlanId: null, currentSessionId: null,
			 geminiChatContext: [], geminiIsThinking: false, thinkingIndicatorId: null,
             currentAiModel: 'gemini-2.0-flash',
			 topicLoadInProgress: false,
			 isDarkMode: document.documentElement.classList.contains('dark'),
			 boardContentHistory: [],
			 speechSynthesisSupported: ('speechSynthesis'in window),
			 czechVoice: null,
			 speechRecognitionSupported: ('SpeechRecognition'in window || 'webkitSpeechRecognition'in window),
			 speechRecognition: null, isListening: false, currentlyHighlightedChunk: null,
			 isLoading: { currentTopic: false, chat: false, user: false, notifications: false, points: false },
			 aiIsWaitingForAnswer: false, // ИИ ожидает ответ от пользователя
			 lastInteractionTime: Date.now(),
             aiSuggestedCompletion: false, // ИИ предложил завершить тему (перед финальным тестом)
             finalQuizActive: false,       // Активен ли финальный тест
             finalQuizAnswers: [],       // Ответы пользователя на финальный тест
             isVyukaSidebarAiExpanded: localStorage.getItem('vyukaSidebarAiState') === 'expanded',
             isVyukaSidebarAiMobileActive: false
		 };

		VyukaApp.showToast = (title, message, type = 'info', duration = 4500) => { const ui = VyukaApp.ui; if (!ui.toastContainer) { ui.toastContainer = document.getElementById('toast-container'); if(!ui.toastContainer) return;} try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${VyukaApp.sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${VyukaApp.sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } };
		VyukaApp.showError = (message, isGlobal = false) => { console.error("Došlo k chybě:", message); const ui = VyukaApp.ui; if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${VyukaApp.sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; if(VyukaApp.ui.initialLoader) VyukaApp.ui.initialLoader.style.display = 'none'; if(VyukaApp.ui.vyukaMainContent) VyukaApp.ui.vyukaMainContent.style.display = 'none'; if(VyukaApp.ui.vyukaChatPanel) VyukaApp.ui.vyukaChatPanel.style.display = 'none'; if(VyukaApp.ui.vyukaFooter) VyukaApp.ui.vyukaFooter.style.display = 'none'; } else { VyukaApp.showToast('CHYBA SYSTÉMU', message, 'error', 6000); } };
		VyukaApp.hideError = () => { if (VyukaApp.ui.globalError) VyukaApp.ui.globalError.style.display = 'none'; };
		VyukaApp.sanitizeHTML = (str) => { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; };
		VyukaApp.getInitials = (profileData, email) => { if (!profileData && !email) return '?'; let initials = ''; if (profileData?.first_name) initials += profileData.first_name[0]; if (profileData?.last_name) initials += profileData.last_name[0]; if (initials) return initials.toUpperCase(); if (profileData?.username) return profileData.username[0].toUpperCase(); if (email) return email[0].toUpperCase(); return 'U'; };
		VyukaApp.formatTimestamp = (d = new Date()) => d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        VyukaApp.formatRelativeTime = (timestamp) => { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } };

        VyukaApp.toggleVyukaSidebarAi = (forceState) => {
            const ui = VyukaApp.ui; const state = VyukaApp.state; if (!ui.vyukaSidebarAi) return;
            const shouldBeExpanded = typeof forceState === 'boolean' ? forceState : !ui.vyukaSidebarAi.classList.contains('expanded');
            ui.vyukaSidebarAi.classList.toggle('expanded', shouldBeExpanded);
            state.isVyukaSidebarAiExpanded = shouldBeExpanded;
            if (ui.sidebarAiDesktopToggle) {
                const icon = ui.sidebarAiDesktopToggle.querySelector('i');
                if (icon) icon.className = `fas fa-chevron-${shouldBeExpanded ? 'left' : 'right'}`;
                ui.sidebarAiDesktopToggle.title = shouldBeExpanded ? "Sbalit AI panel" : "Rozbalit AI panel";
                 ui.sidebarAiDesktopToggle.setAttribute('aria-expanded', shouldBeExpanded.toString());
            }
            localStorage.setItem('vyukaSidebarAiState', shouldBeExpanded ? 'expanded' : 'collapsed');
        };
        VyukaApp.toggleVyukaSidebarAiMobile = (forceState) => {
            const ui = VyukaApp.ui; const state = VyukaApp.state; if (!ui.vyukaSidebarAi || !ui.mainMobileMenuToggle) return;
            const shouldBeActive = typeof forceState === 'boolean' ? forceState : !ui.vyukaSidebarAi.classList.contains('active-mobile');
            ui.vyukaSidebarAi.classList.toggle('active-mobile', shouldBeActive);
            ui.vyukaSidebarAi.classList.toggle('expanded', shouldBeActive);
            if (ui.sidebarOverlayAi) ui.sidebarOverlayAi.classList.toggle('active', shouldBeActive);
            else if (shouldBeActive) { // Dynamicky vytvořit overlay, pokud neexistuje a je potřeba
                ui.sidebarOverlayAi = document.getElementById('sidebar-overlay-ai');
                 if (!ui.sidebarOverlayAi) {
                     ui.sidebarOverlayAi = document.createElement('div');
                     ui.sidebarOverlayAi.className = 'sidebar-overlay-ai';
                     ui.sidebarOverlayAi.id = 'sidebar-overlay-ai';
                     const pageContainer = document.querySelector('.vyuka-page-container') || document.body;
                     pageContainer.appendChild(ui.sidebarOverlayAi);
                     ui.sidebarOverlayAi.addEventListener('click', () => VyukaApp.toggleVyukaSidebarAiMobile(false));
                 }
                requestAnimationFrame(() => ui.sidebarOverlayAi.classList.add('active'));
            }
            state.isVyukaSidebarAiMobileActive = shouldBeActive;
            ui.mainMobileMenuToggle.setAttribute('aria-expanded', shouldBeActive.toString());
        };

		VyukaApp.renderMarkdown = (el, text, isChat = false) => { if (!el) return; const originalText = text || ''; try { if (typeof marked === 'undefined') { console.error("Marked library not loaded!"); el.innerHTML = `<p>${VyukaApp.sanitizeHTML(originalText)}</p>`; return; } const options = { gfm: true, breaks: true, sanitize: !isChat, smartypants: false }; marked.setOptions(options); el.innerHTML = marked.parse(originalText); } catch (e) { console.error("Markdown rendering error:", e); el.innerHTML = `<p style="color:var(--vyuka-accent-error);">Chyba renderování Markdown.</p><pre><code>${VyukaApp.sanitizeHTML(originalText)}</code></pre>`; } };
		VyukaApp.autoResizeTextarea = () => { const ui = VyukaApp.ui; if (!ui.chatInput) return; ui.chatInput.style.height = 'auto'; const scrollHeight = ui.chatInput.scrollHeight; const maxHeight = parseInt(getComputedStyle(ui.chatInput).maxHeight) || 80; ui.chatInput.style.height = `${Math.min(scrollHeight, maxHeight)}px`; ui.chatInput.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden'; };
		VyukaApp.generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
		VyukaApp.initTooltips = () => { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-vyuka', animation: 'fade', delay: 150, side: 'top', contentAsHTML: true }); } } catch (e) { console.error("Tooltipster error:", e); } };
		VyukaApp.updateOnlineStatus = () => { const ui = VyukaApp.ui; if (ui.offlineBanner) { ui.offlineBanner.classList.toggle('visible', !navigator.onLine); } if (!navigator.onLine) { VyukaApp.showToast('Offline', 'Spojení bylo ztraceno. Některé funkce nemusí být dostupné.', 'warning'); } };
		VyukaApp.updateCopyrightYear = () => { const year = new Date().getFullYear(); if (VyukaApp.ui.currentYearFooter) VyukaApp.ui.currentYearFooter.textContent = year; if (VyukaApp.ui.currentYearSidebarVyuka && VyukaApp.ui.currentYearSidebarVyuka.style.display !== 'none') VyukaApp.ui.currentYearSidebarVyuka.textContent = year;};
		VyukaApp.initMouseFollower = () => { const follower = VyukaApp.ui.mouseFollower; if (!follower || window.innerWidth <= 768) { if(follower) follower.style.display = 'none'; return; } follower.style.display = 'block'; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); follower.style.opacity = '1'; hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
		VyukaApp.initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.vyuka-main-content [data-animate], .vyuka-footer [data-animate]'); if (!animatedElements.length || !('IntersectionObserver'in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }); animatedElements.forEach(element => observer.observe(element)); };
		VyukaApp.initHeaderScrollDetection = () => { let lastScrollY = VyukaApp.ui.vyukaMainContentScrollable?.scrollTop || 0; const mainEl = VyukaApp.ui.vyukaMainContentScrollable; if (!mainEl || !VyukaApp.ui.vyukaHeader) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 20); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 20) document.body.classList.add('scrolled'); };
		VyukaApp.clearInitialChatState = () => { const ui = VyukaApp.ui; const initialElement = ui.chatMessages?.querySelector('.initial-chat-interface'); if (initialElement) { initialElement.remove(); } };
		VyukaApp.setLoadingState = (sectionKey, isLoadingFlag) => { const state = VyukaApp.state; if (state.isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return; if (sectionKey === 'all') { Object.keys(state.isLoading).forEach(key => state.isLoading[key] = isLoadingFlag); } else { state.isLoading[sectionKey] = isLoadingFlag; } console.log(`[SetLoading] ${sectionKey}: ${isLoadingFlag}`); const ui = VyukaApp.ui; if (sectionKey === 'chat') { if (ui.sendButton) { ui.sendButton.disabled = isLoadingFlag || state.geminiIsThinking || state.topicLoadInProgress || state.isListening || state.finalQuizActive; ui.sendButton.innerHTML = state.geminiIsThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>'; } } if (sectionKey === 'currentTopic') { if (ui.vyukaSubjectTitle) { ui.vyukaSubjectTitle.textContent = isLoadingFlag ? "Načítám..." : (state.currentTopic?.subject || "AI Tutor"); } if (ui.vyukaTopicSubtitle) { ui.vyukaTopicSubtitle.textContent = isLoadingFlag ? "..." : (state.currentTopic?.name || "Synapse"); } if (ui.currentTopicDisplay) { ui.currentTopicDisplay.innerHTML = isLoadingFlag ? '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám téma...</span>' : `Téma: <strong>${VyukaApp.sanitizeHTML(state.currentTopic?.name || "N/A")}</strong>`; } } if (sectionKey === 'notifications') { if (ui.notificationBell) ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1; if (ui.markAllReadBtn) { const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0; } if (isLoadingFlag && ui.notificationsList && typeof VyukaApp.renderNotificationSkeletons === 'function') { VyukaApp.renderNotificationSkeletons(2); } } if (VyukaApp.manageButtonStates) VyukaApp.manageButtonStates(); };
		VyukaApp.updateTheme = () => { const state = VyukaApp.state; document.documentElement.classList.toggle('dark', state.isDarkMode); document.documentElement.classList.toggle('light', !state.isDarkMode); };

		VyukaApp.manageUIState = (mode, options = {}) => {
            const state = VyukaApp.state;
            const ui = VyukaApp.ui;
            console.log("[UI State v24]:", mode, options);
            state.lastInteractionTime = Date.now();

            // Handle topic display
            let topicDisplayText = '<span class="placeholder">Připraven...</span>';
            let subjectTitleText = "AI Tutor";
            let topicSubtitleText = "Synapse";

            if (state.currentTopic) {
                topicDisplayText = `Téma: <strong>${VyukaApp.sanitizeHTML(state.currentTopic.name)}</strong>`;
                subjectTitleText = state.currentTopic.subject || "Předmět"; // Or keep AI Tutor if subject is not set
                topicSubtitleText = state.currentTopic.name || "Podtéma";
            }

            switch (mode) {
                case 'loadingTopic':
                    topicDisplayText = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám téma...</span>';
                    subjectTitleText = "Načítám...";
                    topicSubtitleText = "";
                    break;
                case 'noPlan':
                    topicDisplayText = '<span class="placeholder error-text">Žádný aktivní plán</span>';
                    subjectTitleText = "Chyba Plánu";
                    topicSubtitleText = "Vytvořte plán.";
                    break;
                case 'planComplete':
                    topicDisplayText = '<span class="placeholder success-text">Plán dokončen!</span>';
                    subjectTitleText = "Gratulace!";
                    topicSubtitleText = "Vše splněno.";
                    break;
                case 'error':
                    topicDisplayText = '<span class="placeholder error-text">Chyba načítání</span>';
                    subjectTitleText = "Systémová Chyba";
                    topicSubtitleText = "Kontaktujte podporu.";
                    break;
                case 'loggedOut':
                    topicDisplayText = '<span class="placeholder error-text">Nepřihlášen</span>';
                    subjectTitleText = "Nepřihlášen";
                    topicSubtitleText = "";
                    break;
                case 'finalQuizInProgress': // Nový stav pro finální test
                    topicDisplayText = `Závěrečný Test: <strong>${VyukaApp.sanitizeHTML(state.currentTopic?.name || "N/A")}</strong>`;
                    subjectTitleText = "Testování Znalostí";
                    topicSubtitleText = "Odpovězte na otázky v chatu";
                    break;
            }

            if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = topicDisplayText;
            if(ui.vyukaSubjectTitle) ui.vyukaSubjectTitle.textContent = subjectTitleText;
            if(ui.vyukaTopicSubtitle) ui.vyukaTopicSubtitle.textContent = topicSubtitleText;

            // Handle initial chat message
            const isChatEmpty = ui.chatMessages?.children.length === 0;
            const isChatInitial = !!ui.chatMessages?.querySelector('.initial-chat-interface');
            if (isChatEmpty || isChatInitial || mode === 'error' || mode === 'noPlan' || mode === 'planComplete' || mode === 'loggedOut') {
                let emptyStateHTML = '';
                switch (mode) {
                    case 'loggedOut': emptyStateHTML = `<div class='initial-chat-interface'><div class="ai-greeting-avatar"><i class='fas fa-sign-in-alt'></i></div><h3 class='initial-chat-title'>NEPŘIHLÁŠEN</h3><p class='initial-chat-message'>Pro přístup k výuce se prosím <a href="/auth/index.html" style="color: var(--vyuka-accent-primary);">přihlaste</a>.</p></div>`; break;
                    case 'noPlan': emptyStateHTML = `<div class='initial-chat-interface'><div class="ai-greeting-avatar"><i class='fas fa-calendar-times'></i></div><h3 class='initial-chat-title'>ŽÁDNÝ AKTIVNÍ PLÁN</h3><p class='initial-chat-message'>Nemáte aktivní studijní plán. Nejprve prosím dokončete diagnostický test.</p></div>`; break;
                    case 'planComplete': emptyStateHTML = `<div class='initial-chat-interface'><div class="ai-greeting-avatar"><i class='fas fa-check-circle'></i></div><h3 class='initial-chat-title'>PLÁN DOKONČEN!</h3><p class='initial-chat-message'>Všechny naplánované aktivity jsou hotové. Skvělá práce!</p></div>`; break;
                    case 'error': emptyStateHTML = `<div class='initial-chat-interface'><div class="ai-greeting-avatar"><i class='fas fa-exclamation-triangle'></i></div><h3 class='initial-chat-title'>CHYBA SYSTÉMU</h3><p class='initial-chat-message'>${options.errorMessage || 'Nastala chyba při načítání dat.'}</p></div>`; break;
                    default: if (isChatEmpty || isChatInitial) { emptyStateHTML = `<div class="initial-chat-interface"><div class="ai-greeting-avatar"><i class="fas fa-robot"></i></div><h3 class="initial-chat-title">AI Tutor Justax je připraven</h3><p class="initial-chat-message">Čekám na načtení tématu nebo vaši zprávu.</p><div class="initial-chat-status"><span class="status-dot online"></span> Online</div></div>`; }
                }
                if (emptyStateHTML && ui.chatMessages) { ui.chatMessages.innerHTML = emptyStateHTML; }
            }
            VyukaApp.manageButtonStates();
        };

		VyukaApp.manageButtonStates = () => {
            const state = VyukaApp.state;
            const ui = VyukaApp.ui;
            const baseInteractReady = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress;

            // Send Button and Chat Input
            const canChat = baseInteractReady && !state.isListening && !state.finalQuizActive; // Finální test blokuje obecný chat
            if (ui.sendButton) {
                ui.sendButton.disabled = !canChat;
                ui.sendButton.innerHTML = state.geminiIsThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
            }
            if (ui.chatInput) {
                ui.chatInput.disabled = !canChat;
                if (state.isListening) ui.chatInput.placeholder = "Poslouchám...";
                else if (state.finalQuizActive) ui.chatInput.placeholder = "Odpovězte na otázku testu..."; // Zde by měl být chat aktivní jen pro odpovědi na test
                else if (canChat) ui.chatInput.placeholder = "Zeptejte se nebo odpovězte...";
                else ui.chatInput.placeholder = "Počkejte prosím...";
            }

            // Continue Button
            if (ui.continueBtn) {
                // Deaktivovat pokud: AI přemýšlí, téma se načítá, AI čeká na odpověď, AI navrhlo dokončení, JE aktivní finální test
                const continueIsDisabled = state.geminiIsThinking ||
                                         state.topicLoadInProgress ||
                                         state.aiIsWaitingForAnswer ||
                                         state.aiSuggestedCompletion ||
                                         state.finalQuizActive;
                ui.continueBtn.disabled = continueIsDisabled;
                // Zobrazit pokud: je téma A NENÍ navrženo dokončení A NENÍ aktivní finální test
                const showContinue = !!state.currentTopic && !state.aiSuggestedCompletion && !state.finalQuizActive;
                ui.continueBtn.style.display = showContinue ? 'inline-flex' : 'none';
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
                const canUseMic = baseInteractReady && state.speechRecognitionSupported && !state.finalQuizActive; // Nelze použít během finálního testu
                ui.micBtn.disabled = !canUseMic || state.isListening;
                ui.micBtn.classList.toggle('listening', state.isListening);
                ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporováno" : (state.isListening ? "Zastavit hlasový vstup" : "Zahájit hlasový vstup");
            }

            // Chat utility buttons (Clear, Save)
            const isChatEmptyOrInitial = ui.chatMessages?.children.length === 0 || !!ui.chatMessages?.querySelector('.initial-chat-interface');
            if (ui.clearChatBtn) {
                ui.clearChatBtn.disabled = state.geminiIsThinking || isChatEmptyOrInitial;
            }
            if (ui.saveChatBtn) {
                ui.saveChatBtn.disabled = state.geminiIsThinking || isChatEmptyOrInitial;
            }

            // AI Model Select
            if (ui.aiModelSelect) {
                ui.aiModelSelect.disabled = state.geminiIsThinking || state.topicLoadInProgress;
            }
        };

		VyukaApp.initializeSupabase = () => { try { if (!window.supabase) throw new Error("Supabase library not loaded."); VyukaApp.state.supabase = window.supabase.createClient(VyukaApp.config.SUPABASE_URL, VyukaApp.config.SUPABASE_ANON_KEY); if (!VyukaApp.state.supabase) throw new Error("Client creation failed."); console.log("Supabase initialized."); return true; } catch (error) { console.error("Supabase init failed:", error); VyukaApp.showToast("Chyba DB.", "error", 10000); return false; } };
		VyukaApp.initializeUI = () => { const ui = VyukaApp.ui; const state = VyukaApp.state; try { VyukaApp.updateTheme(); VyukaApp.setupBaseEventListeners(); VyukaApp.initTooltips(); if (state.speechSynthesisSupported) { if (window.speechSynthesis.getVoices().length > 0) { VyukaApp.loadVoices(); } else if (window.speechSynthesis.onvoiceschanged !== undefined) { window.speechSynthesis.onvoiceschanged = VyukaApp.loadVoices; } } else { console.warn("Speech Synthesis not supported."); } VyukaApp.initializeSpeechRecognition(); VyukaApp.initMouseFollower(); VyukaApp.initHeaderScrollDetection(); VyukaApp.updateCopyrightYear(); VyukaApp.updateOnlineStatus(); VyukaApp.manageUIState('initial'); VyukaApp.toggleVyukaSidebarAi(state.isVyukaSidebarAiExpanded); if(ui.sidebarAiDesktopToggle) ui.sidebarAiDesktopToggle.setAttribute('aria-expanded', state.isVyukaSidebarAiExpanded.toString()); if(ui.aiAvatarCorner) ui.aiAvatarCorner.style.display = 'flex'; console.log("UI Initialized successfully."); return true; } catch(error) { console.error("UI Init failed:", error); VyukaApp.showError(`Chyba inicializace UI: ${error.message}`, true); return false; } };
		VyukaApp.initializeApp = async () => { const ui = VyukaApp.ui; const state = VyukaApp.state; console.log("🚀 [Init Vyuka - Ultimate Cyber Design v24] Starting..."); if (!VyukaApp.initializeSupabase()) return; if (typeof marked === 'undefined') { VyukaApp.showError("Kritická chyba: Knihovna 'marked.js' se nepodařilo načíst. Obnovte stránku.", true); if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); } return; } console.log("✅ Marked library found."); if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); } if (ui.vyukaPageContainer) ui.vyukaPageContainer.style.visibility = 'hidden'; try { console.log("[INIT Core] Checking auth session..."); const { data: { session }, error: sessionError } = await state.supabase.auth.getSession(); if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`); if (!session || !session.user) { console.log('[Init Vyuka - Ultimate Cyber Design] Not logged in. Redirecting...'); window.location.href = '/auth/index.html'; return; } state.currentUser = session.user; console.log(`[INIT Core] User authenticated (ID: ${state.currentUser.id}).`); VyukaApp.setLoadingState('user', true); const [profileResult, titlesResult] = await Promise.allSettled([ VyukaApp.fetchUserProfile(state.currentUser.id), VyukaApp.fetchTitles() ]); if (profileResult.status === 'fulfilled' && profileResult.value) { state.currentProfile = profileResult.value; } else { console.error("Profile fetch failed:", profileResult.reason); throw new Error(profileResult.reason || "Nepodařilo se načíst profil."); } if (titlesResult.status === 'fulfilled') { state.allTitles = titlesResult.value || []; } else { console.warn("Titles fetch failed:", titlesResult.reason); state.allTitles = []; } VyukaApp.updateUserInfoUI(); VyukaApp.setLoadingState('user', false); if (!state.currentProfile) { VyukaApp.showError("Profil nenalezen nebo se nepodařilo načíst.", true); if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); } if (ui.vyukaPageContainer) ui.vyukaPageContainer.style.visibility = 'visible'; VyukaApp.manageUIState('error', { errorMessage: 'Profil nenalezen.' }); return; } if (!VyukaApp.initializeUI()) return; if (typeof VyukaApp.setupFeatureListeners === 'function') { VyukaApp.setupFeatureListeners(); } else { console.warn("VyukaApp.setupFeatureListeners function not found."); } console.log("[INIT Core] Loading initial topic and notifications..."); const loadNotificationsPromise = typeof VyukaApp.fetchNotifications === 'function' ? VyukaApp.fetchNotifications(state.currentUser.id, VyukaApp.config.NOTIFICATION_FETCH_LIMIT) .then(({ unreadCount, notifications }) => { if (typeof VyukaApp.renderNotifications === 'function') VyukaApp.renderNotifications(unreadCount, notifications); else console.warn("renderNotifications not found"); }) .catch(err => { console.error("Chyba při úvodním načítání notifikací:", err); if(typeof VyukaApp.renderNotifications === 'function') VyukaApp.renderNotifications(0, []); }) : Promise.resolve(console.warn("VyukaApp.fetchNotifications not found.")); await loadNotificationsPromise; const loadTopicPromise = typeof VyukaApp.loadNextUncompletedTopic === 'function' ? VyukaApp.loadNextUncompletedTopic() : Promise.resolve(console.warn("VyukaApp.loadNextUncompletedTopic not found.")); await loadTopicPromise; if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); } if (ui.vyukaPageContainer) { ui.vyukaPageContainer.style.visibility = 'visible'; requestAnimationFrame(() => { ui.vyukaPageContainer.classList.add('loaded'); }); } VyukaApp.initScrollAnimations(); console.log("✅ [Init Vyuka - Ultimate Cyber Design v24] Page Initialized."); } catch (error) { console.error("❌ [Init Vyuka - Ultimate Cyber Design v24] Critical initialization error:", error); if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p class="loading-text" style="color: var(--vyuka-accent-error);">CHYBA (${error.message}). Obnovte.</p>`; } else { VyukaApp.showError(`Chyba inicializace: ${error.message}`, true); } if (ui.vyukaPageContainer) ui.vyukaPageContainer.style.visibility = 'visible'; VyukaApp.setLoadingState('all', false); } };

		VyukaApp.fetchUserProfile = async (userId) => { const state = VyukaApp.state; if (!state.supabase || !userId) return null; console.log(`[Profile] Fetching profile for user ID: ${userId}`); try { const { data: profile, error } = await state.supabase.from('profiles').select('*, selected_title, preferences->goal_details AS goal_details, learning_goal').eq('id', userId).single(); if (error && error.code !== 'PGRST116') throw error; if (!profile) { console.warn(`[Profile] Profile not found for user ${userId}.`); return null; } console.log("[Profile] Profile data fetched."); if (!profile.goal_details) profile.goal_details = {}; return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); VyukaApp.showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error'); return null; } };
		VyukaApp.fetchTitles = async () => { const state = VyukaApp.state; if (!state.supabase) return []; try { const { data, error } = await state.supabase.from('title_shop').select('title_key, name'); if (error) throw error; return data || []; } catch (e) { console.error("Error fetching titles:", e); return []; }};
		VyukaApp.updateUserInfoUI = () => { const ui = VyukaApp.ui; const state = VyukaApp.state; if (state.currentUser && state.currentProfile) { const profile = state.currentProfile; const user = state.currentUser; const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || user.email?.split('@')[0] || 'Pilot'; const initials = VyukaApp.getInitials(profile, user.email); const avatarUrl = profile.avatar_url; if (ui.vyukaHeaderUserName) ui.vyukaHeaderUserName.textContent = VyukaApp.sanitizeHTML(displayName); if (ui.sidebarNameVyuka) ui.sidebarNameVyuka.textContent = VyukaApp.sanitizeHTML(displayName); let displayTitle = 'Pilot'; const selectedTitleKey = profile.selected_title; if (selectedTitleKey && state.allTitles && state.allTitles.length > 0) { const foundTitle = state.allTitles.find(t => t.title_key === selectedTitleKey); if (foundTitle) displayTitle = foundTitle.name; } if (ui.vyukaHeaderUserTitle) ui.vyukaHeaderUserTitle.textContent = VyukaApp.sanitizeHTML(displayTitle); if (ui.sidebarUserTitleVyuka) { ui.sidebarUserTitleVyuka.textContent = VyukaApp.sanitizeHTML(displayTitle); ui.sidebarUserTitleVyuka.setAttribute('title', VyukaApp.sanitizeHTML(displayTitle)); } const updateAvatar = (imgEl, containerEl) => { if (imgEl) { if (avatarUrl) { imgEl.src = `${VyukaApp.sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`; imgEl.alt = displayName; imgEl.style.display = 'block'; if(containerEl && containerEl.querySelector('span')) containerEl.querySelector('span').style.display = 'none'; imgEl.onerror = () => { if(containerEl) containerEl.innerHTML = `<span>${initials.substring(0,1)}</span>`; else imgEl.style.display='none';}; } else { if(containerEl) containerEl.innerHTML = `<span>${initials.substring(0,1)}</span>`; else imgEl.style.display='none'; } }}; updateAvatar(ui.vyukaHeaderAvatar, ui.vyukaHeaderUserAvatarWrapper); updateAvatar(document.getElementById('sidebar-avatar-vyuka'), document.querySelector('#vyuka-sidebar-ai .user-avatar')); } else { if (ui.vyukaHeaderUserName) ui.vyukaHeaderUserName.textContent = 'Nepřihlášen'; if (ui.vyukaHeaderUserTitle) ui.vyukaHeaderUserTitle.textContent = '-'; if (ui.sidebarNameVyuka) ui.sidebarNameVyuka.textContent = 'Nepřihlášen'; if (ui.sidebarUserTitleVyuka) ui.sidebarUserTitleVyuka.textContent = '-'; const defaultAvatarContent = `<span>?</span>`; if (ui.vyukaHeaderUserAvatarWrapper) ui.vyukaHeaderUserAvatarWrapper.innerHTML = defaultAvatarContent; const sidebarAvatarContainer = document.querySelector('#vyuka-sidebar-ai .user-avatar'); if (sidebarAvatarContainer) sidebarAvatarContainer.innerHTML = defaultAvatarContent; } };
		VyukaApp.handleLoggedOutUser = () => { const ui = VyukaApp.ui; console.warn("User not logged in."); VyukaApp.manageUIState('loggedOut'); };

		VyukaApp.setupBaseEventListeners = () => {
            const ui = VyukaApp.ui;
            const state = VyukaApp.state;
            console.log("[SETUP Core] Setting up base event listeners...");

            if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', () => VyukaApp.toggleVyukaSidebarAiMobile());
            if (ui.sidebarAiDesktopToggle) ui.sidebarAiDesktopToggle.addEventListener('click', () => VyukaApp.toggleVyukaSidebarAi());

            if (ui.aiModelSelect) {
                ui.aiModelSelect.addEventListener('change', (event) => {
                    state.currentAiModel = event.target.value;
                    console.log(`[AI Model] Selected model: ${state.currentAiModel}`);
                    VyukaApp.showToast('Model AI Změněn', `Nyní používáte model: ${event.target.options[event.target.selectedIndex].text}`, 'info');
                    if (typeof VyukaApp.handleModelChange === 'function') {
                        VyukaApp.handleModelChange(state.currentAiModel);
                    }
                });
            }

            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => { VyukaApp.state.isDarkMode = event.matches; VyukaApp.updateTheme(); });
            window.addEventListener('resize', () => { if (window.innerWidth > 768 && VyukaApp.state.isVyukaSidebarAiMobileActive) { VyukaApp.toggleVyukaSidebarAiMobile(false); } });
            window.addEventListener('online', VyukaApp.updateOnlineStatus); window.addEventListener('offline', VyukaApp.updateOnlineStatus);
            document.addEventListener('click', (event) => {
                if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) {
                    ui.notificationsDropdown.classList.remove('active');
                }
                if (ui.userDropdownMenu?.classList.contains('active') && !ui.userDropdownMenu.contains(event.target) && !ui.vyukaHeaderUserDisplay?.contains(event.target)) {
                    ui.userDropdownMenu.classList.remove('active');
                     ui.userDropdownMenu.style.opacity = '0'; ui.userDropdownMenu.style.visibility = 'hidden';
                }
            });
             if(ui.vyukaHeaderUserDisplay) {
                 ui.vyukaHeaderUserDisplay.addEventListener('click', (event) => {
                     event.stopPropagation();
                     if(ui.userDropdownMenu) {
                        const isActive = ui.userDropdownMenu.classList.toggle('active');
                        ui.userDropdownMenu.style.opacity = isActive ? '1' : '0';
                        ui.userDropdownMenu.style.visibility = isActive ? 'visible' : 'hidden';
                        ui.userDropdownMenu.style.transform = isActive ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)';
                     }
                 });
             }
            console.log("[SETUP Core] Base event listeners setup complete.");
        };

		document.addEventListener('DOMContentLoaded', VyukaApp.initializeApp);

	} catch (e) {
		console.error("FATAL SCRIPT ERROR (Vyuka Core v24):", e);
		document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--vyuka-accent-error,#FF4757);color:var(--vyuka-text-primary,#E0E7FF);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky (Core).</p><p style="margin-top:15px;"><a href="#" onclick="location.reload()" style="color:var(--vyuka-accent-secondary,#00F5FF); text-decoration:underline; font-weight:bold;">Obnovit stránku</a></p><details style="margin-top: 20px; color: #f0f0f0;"><summary style="cursor:pointer; color: var(--vyuka-text-primary,#E0E7FF);">Detaily</summary><pre style="margin-top:10px;padding:15px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;max-height:300px; overflow-y:auto; border-radius:8px;">${e.message}\n${e.stack}</pre></details></div>`;
	}

})(window.VyukaApp);