// vyukaApp.js - Основной файл приложения Vyuka, инициализация и координация модулей (Версия 3.2 - Усиленная отладка и сброс состояния)

// --- Импорт Модулей ---
import { MAX_GEMINI_HISTORY_TURNS, NOTIFICATION_FETCH_LIMIT, POINTS_TOPIC_COMPLETE } from './config.js';
import { state } from './state.js';
import { ui } from './ui.js';
import {
    sanitizeHTML, getInitials, formatTimestamp, formatRelativeTime, autoResizeTextarea,
    generateSessionId, initTooltips, updateOnlineStatus, updateCopyrightYear,
    initMouseFollower, initScrollAnimations, initHeaderScrollDetection,
    openMenu, closeMenu
} from './utils.js';
import { showToast, showError, hideError, setLoadingState, updateTheme } from './uiHelpers.js';
import {
    initializeSupabase, fetchUserProfile, fetchNotifications, markNotificationRead,
    markAllNotificationsRead, loadNextUncompletedTopic, markTopicComplete,
    saveChatMessage, deleteChatSessionHistory, awardPoints
} from './supabaseService.js';
import { sendToGemini, parseGeminiResponse } from './geminiService.js';
import { loadVoices, speakText, stopSpeech, handleMicClick, initializeSpeechRecognition, removeBoardHighlight } from './speechService.js';
import { renderMarkdown, clearWhiteboard, appendToWhiteboard } from './whiteboardController.js';
import { addChatMessage, addThinkingIndicator, removeThinkingIndicator, confirmClearChat, saveChatToPDF } from './chatController.js';

// --- Основная Логика Приложения ---

const activityVisuals = {
    test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' },
    diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' },
    level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, vyuka_start: { icon: 'fa-chalkboard-teacher', class: 'lesson'}, vyuka_complete: { icon: 'fa-flag-checkered', class: 'test'},
    achievement: { icon: 'fa-trophy', class: 'badge'}, info: { icon: 'fa-info-circle', class: 'info' }, warning: { icon: 'fa-exclamation-triangle', class: 'warning' },
    error: { icon: 'fa-exclamation-circle', class: 'danger' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' }
};

/** Главная функция инициализации приложения. */
async function initializeApp() {
    console.log("🚀 [Init Vyuka - Kyber V3.2] Starting App Initialization...");
    let initializationError = null;
    // ...(остальной код initializeApp без изменений из предыдущей версии)...
    try {
        const supabaseInitialized = initializeSupabase();
        if (!supabaseInitialized) throw new Error("Kritická chyba: Nepodařilo se připojit k databázi.");
        state.supabase = supabaseInitialized;
        console.log("[INIT] Supabase Initialized.");

        console.log("[INIT] Checking auth session...");
        const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
        if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);
        if (!session || !session.user) { console.log('[INIT] Not logged in. Redirecting...'); window.location.href = '/auth/index.html'; return; }
        state.currentUser = session.user;
        console.log(`[INIT] User authenticated (ID: ${state.currentUser.id}). Fetching profile...`);

        setLoadingState('user', true);
        state.currentProfile = await fetchUserProfile(state.currentUser.id);
        setLoadingState('user', false);

        if (!state.currentProfile) {
            console.warn(`Profile not found for user ${state.currentUser.id}.`);
            initializationError = new Error("Profil nenalezen nebo se nepodařilo načíst. Zkuste obnovit stránku.");
            try { initializeUI(); updateUserInfoUI(); } catch (uiError) { console.error("UI Init failed during profile error:", uiError); }
            manageUIState('error', { errorMessage: initializationError.message });
        } else {
            console.log("[INIT] Profile fetched successfully.");
        }

        console.log("[INIT] Initializing base UI...");
        initializeUI();
        updateUserInfoUI();

        if (state.currentProfile && !initializationError) {
            console.log("[INIT] Loading initial topic and notifications...");
            setLoadingState('currentTopic', true);
            setLoadingState('notifications', true);

            const loadNotificationsPromise = fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
                .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                .catch(err => { console.error("Chyba při úvodním načítání notifikací:", err); renderNotifications(0, []); showToast('Chyba Notifikací', 'Nepodařilo se načíst signály.', 'error'); })
                .finally(() => {
                    setLoadingState('notifications', false);
                    manageButtonStates();
                });

            const loadTopicPromise = loadNextTopicFlow()
                 .catch(err => {
                     console.error("Chyba při načítání úvodního tématu:", err);
                     manageUIState('error', { errorMessage: `Chyba načítání tématu: ${err.message}` });
                     // Ensure loading state is off even if loadNextTopicFlow failed internally
                     state.topicLoadInProgress = false;
                     setLoadingState('currentTopic', false);
                 });

            await Promise.all([loadNotificationsPromise, loadTopicPromise]);
            console.log("[INIT] Initial data loading complete (or errors handled).");

        } else {
             setLoadingState('currentTopic', false);
             setLoadingState('notifications', false);
             manageButtonStates();
        }

    } catch (error) {
        console.error("❌ [Init Vyuka - Kyber V3.2] Critical initialization error:", error);
        initializationError = error;
        if (!document.getElementById('main-mobile-menu-toggle')) {
            try { initializeUI(); } catch (uiError) { console.error("Failed to initialize UI during critical error handling:", uiError); }
        }
        manageUIState('error', { errorMessage: error.message });
        setLoadingState('all', false);
        showError(`Chyba inicializace: ${error.message}`, true);
    } finally {
        console.log("[INIT] Finalizing initialization (finally block)...");
        if (ui.initialLoader) {
             ui.initialLoader.classList.add('hidden');
             setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500);
        }
        if (ui.mainContent) {
            ui.mainContent.style.display = 'flex';
            requestAnimationFrame(() => {
                if (ui.mainContent) ui.mainContent.classList.add('loaded');
                initScrollAnimations();
            });
        }
        manageButtonStates(); // Final check
        console.log("✅ [Init Vyuka - Kyber V3.2] App Initialization Finished (finally block).");
    }
}

/** Инициализация базового UI. */
function initializeUI() { /* ... (без изменений из v3.1) ... */
    console.log("[UI Init] Initializing UI elements and handlers...");
    try {
        updateTheme();
        setupEventListeners();
        initTooltips();
        if (ui.chatTabButton) ui.chatTabButton.classList.add('active');
        if (ui.chatTabContent) ui.chatTabContent.classList.add('active');
        initializeSpeechRecognition(); // Initialize STT service
        initMouseFollower();
        initHeaderScrollDetection();
        updateCopyrightYear();
        updateOnlineStatus();
        manageUIState('initial'); // Set initial screen state
        console.log("[UI Init] UI Initialized successfully.");
    } catch (error) {
        console.error("UI Init failed:", error);
        showError(`Chyba inicializace UI: ${error.message}`, false);
        // If you have a stack trace, log it for more detailed debugging
        if (error.stack) console.error("Original stack trace:", error.stack);
    }
}

/** Настройка основных обработчиков событий. */
function setupEventListeners() { /* ... (без изменений из v3.1) ... */
    console.log("[SETUP] Setting up event listeners...");
    let listenersAttached = 0; // Counter for attached listeners
    function addListener(element, event, handler, elementName) {
        if (element) { element.addEventListener(event, handler); listenersAttached++; } else { console.warn(`[SETUP] Element '${elementName}' not found. Listener not attached.`); }
    }
    addListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
    addListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
    addListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');
    addListener(ui.chatInput, 'input', () => autoResizeTextarea(ui.chatInput), 'chatInput (input)');
    addListener(ui.sendButton, 'click', handleSendMessage, 'sendButton');
    addListener(ui.chatInput, 'keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }, 'chatInput (keypress)');
    addListener(ui.clearChatBtn, 'click', () => confirmClearChat(), 'clearChatBtn');
    addListener(ui.saveChatBtn, 'click', saveChatToPDF, 'saveChatBtn');
    addListener(ui.micBtn, 'click', handleMicClick, 'micBtn');
    addListener(ui.clearBoardBtn, 'click', () => { clearWhiteboard(false); showToast('Vymazáno', "Tabule vymazána.", "info"); }, 'clearBoardBtn');
    addListener(ui.stopSpeechBtn, 'click', stopSpeech, 'stopSpeechBtn');
    addListener(ui.continueBtn, 'click', requestContinue, 'continueBtn');
    addListener(ui.markCompleteBtn, 'click', handleMarkTopicCompleteFlow, 'markCompleteBtn');
    addListener(ui.chatMessages, 'click', handleDynamicTTSClick, 'chatMessages (TTS Delegation)');
    addListener(ui.whiteboardContent, 'click', handleDynamicTTSClick, 'whiteboardContent (TTS Delegation)');
    const darkModeMatcher = window.matchMedia('(prefers-color-scheme: dark)');
    if (darkModeMatcher && typeof darkModeMatcher.addEventListener === 'function') { darkModeMatcher.addEventListener('change', event => { state.isDarkMode = event.matches; updateTheme(); }); listenersAttached++; } else { console.warn("[SETUP] Cannot add theme change listener."); }
    window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) { closeMenu(); } }); listenersAttached++;
    window.addEventListener('online', updateOnlineStatus); listenersAttached++;
    window.addEventListener('offline', updateOnlineStatus); listenersAttached++;
    addListener(ui.notificationBell, 'click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell');
    addListener(ui.markAllReadBtn, 'click', async () => { /* ... */ try { /* ... */ } catch (err) { /* ... */ } finally { setLoadingState('notifications', false); manageButtonStates(); } }, 'markAllReadBtn');
    addListener(ui.notificationsList, 'click', async (event) => { /* ... */ if (item && !state.isLoading.notifications && state.currentUser) { /* ... */ if (!isRead && notificationId) { /* ... */ manageButtonStates(); /* Update button state */ } } }, 'notificationsList');
    document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } }); listenersAttached++;
    console.log(`[SETUP] Event listeners setup complete. Total attached (approx): ${listenersAttached}`);
}

// --- Обновление UI ---

/** Обновляет информацию о пользователе в UI (сайдбар). */
function updateUserInfoUI() { /* ... (без изменений из v3.1) ... */
    if (!ui.sidebarName || !ui.sidebarAvatar) { console.warn("updateUserInfoUI: Sidebar elements not found."); return; }
    if (state.currentUser && state.currentProfile) { const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(state.currentProfile, state.currentUser.email); const avatarUrl = state.currentProfile.avatar_url; let finalUrl = avatarUrl; if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('//') && !avatarUrl.startsWith('data:')) { finalUrl = null; console.warn("Invalid avatar URL:", avatarUrl); } else if (avatarUrl) { finalUrl = sanitizeHTML(avatarUrl); } ui.sidebarAvatar.innerHTML = finalUrl ? `<img src="${finalUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const sidebarImg = ui.sidebarAvatar.querySelector('img'); if (sidebarImg) { sidebarImg.onerror = function() { console.warn(`Failed to load avatar: ${this.src}`); ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; } } else { ui.sidebarName.textContent = 'Nepřihlášen'; ui.sidebarAvatar.textContent = '?'; }
}

/** Отображает уведомления в выпадающем списке. */
 function renderNotifications(count, notifications) { /* ... (без изменений из v3.1) ... */
    console.log("[Render Notifications V3.1] Count:", count, "Notifications:", notifications);
    if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements."); return; }
    ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
    ui.notificationCount.classList.toggle('visible', count > 0);
    if (notifications && notifications.length > 0) {
        ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[(n.type || 'default').toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join('');
        ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.add('has-content');
    } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.remove('has-content'); }
    const currentUnreadCount = parseInt(ui.notificationCount.textContent.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentUnreadCount === 0 || state.isLoading.notifications;
    console.log("[Render Notifications V3.1] Finished rendering.");
 }

/** Управляет общим состоянием интерфейса (Co se zobrazuje). */
function manageUIState(mode, options = {}) { /* ... (без изменений из v3.1) ... */
    console.log("[UI State Change]:", mode, options);
    const isLearningActive = state.currentTopic && ['learning', 'chatting', 'requestingExplanation', 'waitingForAnswer'].includes(mode);
    const isEmptyState = ['noPlan', 'planComplete', 'error', 'loggedOut', 'initial', 'loadingTopic'].includes(mode);
    if (ui.learningInterface) { const shouldShowInterface = !isEmptyState; ui.learningInterface.style.display = shouldShowInterface ? 'flex' : 'none'; console.log(`[UI State] Learning interface display: ${shouldShowInterface ? 'flex' : 'none'}`); }
    if (ui.chatMessages) { let emptyStateHTML = ''; if (isEmptyState || (isLearningActive && !ui.chatMessages.querySelector('.chat-message'))) { if (ui.chatMessages.innerHTML !== '') { ui.chatMessages.innerHTML = ''; } switch (mode) { case 'loggedOut': emptyStateHTML = `<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPŘIHLÁŠEN</h3><p>Pro přístup k výuce se prosím <a href="/auth/index.html" style="color: var(--accent-primary)">přihlaste</a>.</p></div>`; break; case 'noPlan': emptyStateHTML = `<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ŽÁDNÝ AKTIVNÍ PLÁN</h3><p>Nemáte aktivní studijní plán. Nejprve prosím dokončete <a href="/dashboard/procvicovani/test1.html" style="color: var(--accent-primary)">diagnostický test</a>.</p></div>`; break; case 'planComplete': emptyStateHTML = `<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLÁN DOKONČEN!</h3><p>Všechny naplánované aktivity jsou hotové. Skvělá práce! Můžete si <a href="/dashboard/procvicovani/plan.html" style="color: var(--accent-primary)">vytvořit nový plán</a>.</p></div>`; break; case 'error': emptyStateHTML = `<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA SYSTÉMU</h3><p>${sanitizeHTML(options.errorMessage || 'Nastala chyba při načítání dat.')}</p></div>`; if (options.errorMessage && !document.getElementById('global-error')?.offsetParent) { showError(options.errorMessage, true); } break; case 'initial': emptyStateHTML = '<div class="empty-state"><i class="fas fa-cog fa-spin"></i><h3>Inicializace...</h3></div>'; break; case 'loadingTopic': emptyStateHTML = '<div class="empty-state initial-load-placeholder"><i class="fas fa-book-open" style="font-size: 2rem; margin-bottom: 1rem;"></i><p>Načítání tématu...</p></div>'; break; case 'learning': emptyStateHTML = `<div class='empty-state'><i class='fas fa-comments'></i><h3>Chat připraven</h3><p>Počkejte na první vysvětlení od AI nebo položte otázku.</p></div>`; break; } if (emptyStateHTML) { ui.chatMessages.innerHTML = emptyStateHTML; console.log(`[UI State] Chat set to state: ${mode}`); } } }
    if (ui.whiteboardContent) { const existingPlaceholder = ui.whiteboardContent.querySelector('.initial-load-placeholder, .empty-state'); if (isEmptyState || (isLearningActive && !ui.whiteboardContent.querySelector('.whiteboard-chunk'))) { let emptyBoardHTML = ''; switch (mode) { case 'loadingTopic': emptyBoardHTML = '<div class="empty-state initial-load-placeholder"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i><p>Načítání první lekce...</p></div>'; break; case 'error': emptyBoardHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba Tabule</h3><p>${sanitizeHTML(options.errorMessage || 'Obsah nelze zobrazit.')}</p></div>`; break; case 'noPlan': case 'planComplete': case 'loggedOut': emptyBoardHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule</h3><p>Nejprve vyberte nebo načtěte téma.</p></div>`; break; case 'initial': emptyBoardHTML = `<div class='empty-state'><i class='fas fa-spinner fa-spin'></i><h3>Inicializace...</h3></div>`; break; case 'learning': emptyBoardHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule připravena</h3><p>Zde se bude zobrazovat vysvětlení od AI.</p></div>`; break; } if (emptyBoardHTML && (!existingPlaceholder || (mode === 'loadingTopic' || mode === 'error'))) { ui.whiteboardContent.innerHTML = emptyBoardHTML; console.log(`[UI State] Whiteboard set to state: ${mode}`); } else if (isLearningActive && existingPlaceholder) { existingPlaceholder.remove(); console.log("[UI State] Removed whiteboard placeholder as learning is active."); } } }
    manageButtonStates();
}

/**
 * Управляет активностью/неактивностью кнопок на основе текущего состояния.
 * Версия 3.2: Усиленное логирование для отладки.
 */
function manageButtonStates() {
    // --- Состояния ---
    const hasTopic = !!state.currentTopic;
    const isThinking = state.geminiIsThinking;
    const isLoadingTopic = state.topicLoadInProgress;
    const isWaitingForAnswer = state.aiIsWaitingForAnswer;
    const isListening = state.isListening;
    const isSpeaking = state.speechSynthesisSupported && window.speechSynthesis.speaking;
    const isLoadingPoints = state.isLoading.points;
    const notificationsLoading = state.isLoading.notifications;
    const chatInputHasText = ui.chatInput?.value.trim().length > 0;
    const chatIsEmpty = !ui.chatMessages?.hasChildNodes() || !!ui.chatMessages?.querySelector('.empty-state');
    const boardIsEmpty = !ui.whiteboardContent?.hasChildNodes() || !!ui.whiteboardContent?.querySelector('.empty-state');
    const unreadNotifCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');

    // --- Комбинированные флаги ---
    // Заблокировано ли взаимодействие чем-либо, кроме ожидания ответа?
    const isBusyProcessing = isThinking || isLoadingTopic || isListening || isLoadingPoints;
    // Можно ли вообще взаимодействовать (отправить сообщение, продолжить)?
    const canInteract = hasTopic && !isBusyProcessing && !isWaitingForAnswer;
    // Можно ли завершить тему? (Разрешаем, даже если AI ждет ответа)
    const canComplete = hasTopic && !isBusyProcessing;
    // Можно ли использовать микрофон?
    const canUseMic = hasTopic && !isBusyProcessing && !isWaitingForAnswer && state.speechRecognitionSupported; // Добавил !isWaitingForAnswer

    // --- Логирование текущего состояния ---
    console.log(`[BTN STATE CHECK] Flags: hasTopic=${hasTopic}, isThinking=${isThinking}, isLoadingTopic=${isLoadingTopic}, isWaiting=${isWaitingForAnswer}, isListening=${isListening}, isSpeaking=${isSpeaking}, isLoadingPoints=${isLoadingPoints}`);
    console.log(`[BTN STATE CHECK] Derived: isBusyProcessing=${isBusyProcessing}, canInteract=${canInteract}, canComplete=${canComplete}, canUseMic=${canUseMic}`);

    // --- Применение состояний к кнопкам ---
    const setButtonState = (button, isDisabled, reason) => {
        if (button && button.disabled !== isDisabled) {
            console.log(`[BTN STATE] ${button.id || button.tagName}: ${isDisabled ? 'DISABLED' : 'ENABLED'} (Reason: ${reason})`);
            button.disabled = isDisabled;
        }
    };

    setButtonState(ui.sendButton, !canInteract || !chatInputHasText, `canInteract=${canInteract}, hasText=${chatInputHasText}`);
    if (ui.sendButton) ui.sendButton.innerHTML = isThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';

    setButtonState(ui.chatInput, !hasTopic || isBusyProcessing || isWaitingForAnswer, `hasTopic=${hasTopic}, isBusy=${isBusyProcessing}, isWaiting=${isWaitingForAnswer}`);
    if (ui.chatInput) {
        ui.chatInput.placeholder = isListening ? "Poslouchám..."
                                 : (ui.chatInput.disabled ? (isThinking ? "AI přemýšlí..." : (isLoadingTopic ? "Načítám téma..." : (isWaitingForAnswer ? "Odpovězte na otázku AI..." : "Akce není dostupná...")))
                                 : "Zeptejte se nebo odpovězte...");
    }

    setButtonState(ui.continueBtn, !canInteract, `canInteract=${canInteract}`);
    if (ui.continueBtn) ui.continueBtn.style.display = hasTopic ? 'inline-flex' : 'none';

    setButtonState(ui.markCompleteBtn, !canComplete, `canComplete=${canComplete}`);
    if (ui.markCompleteBtn) ui.markCompleteBtn.style.display = hasTopic ? 'inline-flex' : 'none';

    setButtonState(ui.clearBoardBtn, boardIsEmpty || isBusyProcessing, `boardEmpty=${boardIsEmpty}, isBusy=${isBusyProcessing}`);
    setButtonState(ui.stopSpeechBtn, !isSpeaking, `isSpeaking=${isSpeaking}`);
    setButtonState(ui.micBtn, !canUseMic, `canUseMic=${canUseMic}`);
    if (ui.micBtn) {
        ui.micBtn.classList.toggle('listening', isListening);
        ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporováno" : (isListening ? "Zastavit hlasový vstup" : (ui.micBtn.disabled ? "Hlasový vstup nedostupný" : "Zahájit hlasový vstup"));
    }
    setButtonState(ui.clearChatBtn, isThinking || chatIsEmpty, `isThinking=${isThinking}, chatEmpty=${chatIsEmpty}`);
    setButtonState(ui.saveChatBtn, isThinking || chatIsEmpty, `isThinking=${isThinking}, chatEmpty=${chatIsEmpty}`);
    setButtonState(ui.markAllReadBtn, unreadNotifCount === 0 || notificationsLoading, `unread=${unreadNotifCount}, loading=${notificationsLoading}`);
}

/** Обработчик клика для динамических TTS кнопок */
function handleDynamicTTSClick(event) { /* ... (без изменений из v3.1) ... */
    const button = event.target.closest('.tts-listen-btn');
    if (button && button.dataset.textToSpeak) { const chunkElement = button.closest('.whiteboard-chunk'); speakText(button.dataset.textToSpeak, chunkElement); }
}

// --- Обработчики Действий ---

/** Обрабатывает отправку сообщения из чата. */
async function handleSendMessage() {
    if (!state.currentUser || !state.currentProfile) { showError("Nelze odeslat zprávu, chybí data uživatele.", false); return; }

    console.log("[ACTION] handleSendMessage triggered.");
    const canSend = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening;
    const text = ui.chatInput?.value.trim();
    console.log(`[ACTION] handleSendMessage: canSend=${canSend}, text='${text}'`);

    if (!canSend || !text) { if (!canSend) showToast('Počkejte prosím', 'AI přemýšlí nebo se načítá téma.', 'warning'); return; }

    const inputBeforeSend = ui.chatInput?.value;
    if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }
    let wasWaiting = state.aiIsWaitingForAnswer;

    try {
        await addChatMessage(text, 'user');
        initTooltips();
        state.geminiChatContext.push({ role: "user", parts: [{ text }] });

        console.log("[ACTION] handleSendMessage: Setting isThinking=true");
        state.geminiIsThinking = true;
        state.aiIsWaitingForAnswer = false; // Sending always resets waiting
        console.log("[STATE CHANGE] aiIsWaitingForAnswer set to false by handleSendMessage.");
        addThinkingIndicator();
        manageButtonStates();

        let promptForGemini = wasWaiting
            ? `Student odpověděl na předchozí otázku: "${text}". Téma je "${state.currentTopic.name}". Vyhodnoť stručně odpověď a pokračuj v konverzaci POUZE textem do chatu. Můžeš položit další otázku nebo navrhnout pokračování výkladu.`
            : `Student píše do chatu: "${text}". Téma je "${state.currentTopic.name}". Odpověz relevantně v rámci tématu a konverzace. Použij POUZE text do chatu. Nepřidávej bloky [BOARD_MARKDOWN] ani [TTS_COMMENTARY].`;

        console.log("[ACTION] handleSendMessage: Calling sendToGemini...");
        const response = await sendToGemini(promptForGemini, true);
        console.log("[ACTION] handleSendMessage: Gemini response received:", response);

        if (response.success && response.data) {
            const { chatText, ttsCommentary } = response.data;
            if (chatText) {
                await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                initTooltips();
                const lowerChatText = chatText.toLowerCase();
                const isNowWaiting = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                console.log(`[STATE CHANGE] aiIsWaitingForAnswer evaluated to ${isNowWaiting} based on Gemini response.`);
                state.aiIsWaitingForAnswer = isNowWaiting;
            } else {
                console.warn("Gemini chat response missing chatText.");
                await addChatMessage("(AI neodpovědělo textem)", 'gemini', false);
                state.aiIsWaitingForAnswer = false; // Explicitly reset
            }
        } else {
            console.error("Error response from Gemini:", response.error);
            await addChatMessage(`Promiňte, nastala chyba: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
            state.aiIsWaitingForAnswer = false; // Reset on error
            if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
        }
    } catch (error) {
        console.error("Error in handleSendMessage catch block:", error);
        showError("Došlo k chybě při odesílání zprávy.", false);
        state.aiIsWaitingForAnswer = false; // Reset on error
        if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
    } finally {
        console.log("[ACTION] handleSendMessage: Entering finally block.");
        removeThinkingIndicator();
        console.log("[ACTION] handleSendMessage: Setting isThinking=false in finally.");
        state.geminiIsThinking = false;
        setLoadingState('chat', false);
        manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
        manageButtonStates(); // Crucial final call
        console.log("[ACTION] handleSendMessage: Exiting finally block.");
    }
}

/** Запрашивает следующую часть объяснения у AI. */
async function requestContinue() {
    console.log("[ACTION] requestContinue triggered.");
    const canContinue = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening && !state.aiIsWaitingForAnswer;
    console.log(`[ACTION] requestContinue: canContinue=${canContinue}`);
    if (!canContinue) { showToast('Nelze pokračovat', 'AI přemýšlí, načítá téma nebo čeká na odpověď.', 'warning'); return; }

    console.log("[ACTION] requestContinue: Setting isThinking=true");
    state.geminiIsThinking = true;
    state.aiIsWaitingForAnswer = false; // Continue overrides waiting
    console.log("[STATE CHANGE] aiIsWaitingForAnswer set to false by requestContinue.");
    addThinkingIndicator();
    manageButtonStates();

    const prompt = `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Naváž na předchozí část. Vygeneruj další logickou část výkladu.\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`;

    try {
        console.log("[ACTION] requestContinue: Calling sendToGemini...");
        const response = await sendToGemini(prompt, false);
        console.log("[ACTION] requestContinue: Gemini response received:", response);

        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data; let domChanged = false;
            if (boardMarkdown) { const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state'); if (placeholder) placeholder.remove(); appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); domChanged = true; }
            if (chatText) { await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary); domChanged = true; const lowerChatText = chatText.toLowerCase(); const isNowWaiting = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste'); console.log(`[STATE CHANGE] aiIsWaitingForAnswer evaluated to ${isNowWaiting} based on Gemini response.`); state.aiIsWaitingForAnswer = isNowWaiting;
            } else if (ttsCommentary && !boardMarkdown){ await addChatMessage("(Poslechněte si další část komentáře)", 'gemini', true, new Date(), ttsCommentary); domChanged = true; state.aiIsWaitingForAnswer = false; }
            else if (!boardMarkdown && !chatText && !ttsCommentary){ console.warn("Gemini continue request returned empty content."); await addChatMessage("(AI neposkytlo další obsah, zkuste se zeptat jinak nebo pokračovat znovu.)", 'gemini', false); state.aiIsWaitingForAnswer = false;
            } else { state.aiIsWaitingForAnswer = false; }
            if (domChanged) initTooltips();
        } else { console.error("Error response from Gemini:", response.error); await addChatMessage(`Promiňte, nastala chyba při pokračování: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false); state.aiIsWaitingForAnswer = false; }
    } catch (error) {
        console.error("Error in requestContinue catch block:", error); showError("Došlo k chybě při žádosti o pokračování.", false); state.aiIsWaitingForAnswer = false;
    } finally {
        console.log("[ACTION] requestContinue: Entering finally block.");
        removeThinkingIndicator();
        console.log("[ACTION] requestContinue: Setting isThinking=false in finally.");
        state.geminiIsThinking = false;
        setLoadingState('chat', false);
        manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
        manageButtonStates(); // Crucial final call
        console.log("[ACTION] requestContinue: Exiting finally block.");
    }
}

/** Запускает сессию обучения для текущей темы. */
async function startLearningSession() {
    if (!state.currentTopic) { manageUIState('error', {errorMessage: 'Chyba: Téma není definováno.'}); return; }
    console.log("[ACTION] startLearningSession triggered for topic:", state.currentTopic.name);
    state.currentSessionId = generateSessionId();
    state.geminiChatContext = [];

    console.log("[ACTION] startLearningSession: Setting isThinking=true");
    state.geminiIsThinking = true;
    state.aiIsWaitingForAnswer = false;
    manageUIState('requestingExplanation');
    addThinkingIndicator();
    manageButtonStates();

    const prompt = `Jsi AI Tutor "Justax". Vysvětli ZÁKLADY tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Rozděl vysvětlení na menší logické části. Pro PRVNÍ ČÁST:\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`;

    try {
        console.log("[ACTION] startLearningSession: Calling sendToGemini...");
        const response = await sendToGemini(prompt, false);
        console.log("[ACTION] startLearningSession: Gemini response received:", response);

        const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
        if (placeholder) { placeholder.remove(); console.log("Initial whiteboard placeholder removed."); } else if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = ''; }
        const chatPlaceholder = ui.chatMessages?.querySelector('.empty-state');
        if (chatPlaceholder && chatPlaceholder.textContent.includes("Chat připraven")) { chatPlaceholder.remove(); }

        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data; let domChanged = false;
            if (boardMarkdown) { appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); domChanged = true; }
            if (chatText) { await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary); domChanged = true; const lowerChatText = chatText.toLowerCase(); const isNowWaiting = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste'); console.log(`[STATE CHANGE] aiIsWaitingForAnswer evaluated to ${isNowWaiting} based on Gemini response.`); state.aiIsWaitingForAnswer = isNowWaiting;
            } else if (ttsCommentary && !boardMarkdown){ await addChatMessage("(Poslechněte si úvodní komentář)", 'gemini', true, new Date(), ttsCommentary); domChanged = true; state.aiIsWaitingForAnswer = false; }
            else if (!boardMarkdown && !chatText && !ttsCommentary){ console.warn("Gemini initial empty."); await addChatMessage("(AI neposkytlo úvodní obsah. Zkuste položit otázku.)", 'gemini', false); if (!boardMarkdown && ui.whiteboardContent && !ui.whiteboardContent.hasChildNodes()) { ui.whiteboardContent.innerHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule prázdná</h3><p>AI neposkytlo obsah.</p></div>`; } state.aiIsWaitingForAnswer = false;
            } else { state.aiIsWaitingForAnswer = false; }
            if(domChanged) { initTooltips(); }
        } else {
             console.error("Error response from Gemini:", response.error);
             await addChatMessage(`Promiňte, nastala chyba při zahájení výkladu: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
             if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba načítání</h3><p>Obsah pro tabuli nelze zobrazit.</p></div>`; }
             state.aiIsWaitingForAnswer = false; showError(`Chyba AI: ${response.error}`, false);
        }
    } catch(error) {
        console.error("Error in startLearningSession catch block:", error);
        showError("Došlo k chybě při zahájení výkladu.", false);
        if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba systému</h3><p>Nelze zahájit výuku.</p></div>`; }
        await addChatMessage(`Systémová chyba: ${error.message}`, 'gemini', false);
        state.aiIsWaitingForAnswer = false;
    } finally {
        console.log("[ACTION] startLearningSession: Entering finally block.");
        removeThinkingIndicator();
        console.log("[ACTION] startLearningSession: Setting isThinking=false in finally.");
        state.geminiIsThinking = false;
        setLoadingState('chat', false);
        manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
        manageButtonStates(); // Crucial final call
        console.log("[ACTION] startLearningSession: Exiting finally block.");
    }
}


/** Поток действий при нажатии "Označit jako dokončené". */
async function handleMarkTopicCompleteFlow() {
    const canComplete = !!state.currentTopic && !state.topicLoadInProgress && !state.isLoading.points && !state.geminiIsThinking;
    console.log(`[ACTION] handleMarkTopicCompleteFlow: canComplete=${canComplete}`);
    if (!canComplete) { showToast("Nelze dokončit", "Počkejte na dokončení předchozí akce.", "warning"); return; }
    if (!confirm(`Opravdu označit téma "${state.currentTopic.name}" jako dokončené? Získáte ${POINTS_TOPIC_COMPLETE} kreditů.`)) return;

    console.log(`[Flow] Marking topic ${state.currentTopic.activity_id} as complete. Setting topicLoadInProgress=true, isLoading.points=true`);
    state.topicLoadInProgress = true;
    setLoadingState('points', true);
    manageButtonStates();

    try {
        const successMark = await markTopicComplete(state.currentTopic.activity_id, state.currentUser.id);
        if (successMark) {
            console.log(`[Flow] Topic marked complete. Awarding points...`);
            const pointsAwarded = await awardPoints(state.currentUser.id, POINTS_TOPIC_COMPLETE);
            // Points loading state is reset *after* award attempt
            setLoadingState('points', false); // <-- Reset points loading here
            console.log(`[Flow] Points awarding finished (Awarded: ${pointsAwarded}). Reset isLoading.points=false`);

            if (pointsAwarded) {
                showToast('+', `${POINTS_TOPIC_COMPLETE} kreditů získáno!`, 'success', 3000);
                if(state.currentProfile) { state.currentProfile.points = (state.currentProfile.points || 0) + POINTS_TOPIC_COMPLETE; updateUserInfoUI(); }
            } else { showToast('Varování', 'Téma dokončeno, ale body se nepodařilo připsat.', 'warning'); }
            showToast(`Téma "${state.currentTopic.name}" dokončeno.`, "success");

            console.log("[Flow] Topic completion success. Resetting topicLoadInProgress=false and loading next topic.");
            state.topicLoadInProgress = false; // Allow next topic load
            await loadNextTopicFlow(); // Load next

        } else {
            showToast("Chyba při označování tématu jako dokončeného.", "error");
            console.log("[Flow] Topic completion failed (markTopicComplete returned false). Resetting flags.");
            state.topicLoadInProgress = false;
            setLoadingState('points', false);
            manageButtonStates(); // Update buttons on failure
        }
    } catch (error) {
        console.error("Error in handleMarkTopicCompleteFlow catch block:", error);
        showToast("Neočekávaná chyba při dokončování tématu.", "error");
        console.log("[Flow] Topic completion exception. Resetting flags.");
        state.topicLoadInProgress = false;
        setLoadingState('points', false);
        manageButtonStates(); // Update buttons on exception
    }
    // No finally needed, state managed in try/catch
}

/** Поток действий для загрузки следующей темы. */
async function loadNextTopicFlow() {
    if (!state.currentUser || state.topicLoadInProgress) { console.log(`[Flow] Load next topic skipped: User=${!!state.currentUser}, Loading=${state.topicLoadInProgress}`); return; }

    console.log("[Flow] Loading next topic flow STARTED. Setting topicLoadInProgress=true.");
    state.topicLoadInProgress = true;
    setLoadingState('currentTopic', true);
    state.currentTopic = null; state.geminiChatContext = []; state.aiIsWaitingForAnswer = false;
    if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám další téma...</span>';
    clearWhiteboard(false); if (ui.chatMessages) ui.chatMessages.innerHTML = '';
    manageUIState('loadingTopic'); manageButtonStates();

    try {
        console.log("[Flow] Calling loadNextUncompletedTopic...");
        const result = await loadNextUncompletedTopic(state.currentUser.id);
        console.log("[Flow] loadNextUncompletedTopic result:", result);

        if (result.success && result.topic) {
            state.currentTopic = result.topic;
            if (ui.currentTopicDisplay) { ui.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(state.currentTopic.name)}</strong>`; }
            console.log("[Flow] Topic loaded successfully. Resetting topicLoadInProgress=false. Starting session...");
            state.topicLoadInProgress = false; // Reset flag BEFORE starting session
            await startLearningSession(); // Starts its own loading/thinking states
        } else {
            state.currentTopic = null;
            const message = result.message || 'Není další téma nebo nastala chyba.';
            if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(${sanitizeHTML(message)})</span>`;
            console.log(`[Flow] No topic loaded or error. Reason: ${result.reason}. Resetting topicLoadInProgress=false.`);
            state.topicLoadInProgress = false; // Reset flag
            manageUIState(result.reason || 'error', { errorMessage: message });
            setLoadingState('currentTopic', false);
            manageButtonStates(); // Update buttons as no topic is active
        }
    } catch(error) {
        console.error("Error in loadNextTopicFlow execution:", error);
        state.currentTopic = null;
        if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(Chyba načítání)</span>`;
        console.log("[Flow] Exception loading topic. Resetting topicLoadInProgress=false.");
        state.topicLoadInProgress = false; // Reset flag on exception
        manageUIState('error', { errorMessage: `Chyba při načítání dalšího tématu: ${error.message}` });
        setLoadingState('currentTopic', false);
        manageButtonStates(); // Update buttons after exception
    }
    console.log("[Flow] Loading next topic flow FINISHED.");
}


// --- Запуск Приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);