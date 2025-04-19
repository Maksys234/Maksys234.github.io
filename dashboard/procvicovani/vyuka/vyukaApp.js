// vyukaApp.js - Основной файл приложения Vyuka
// Версия 3.8.1: Улучшен placeholder для состояния waitingForAction

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
import { sendToGemini, parseGeminiResponse } from './geminiService.js'; // v3.8.8
import { loadVoices, speakText, stopSpeech, handleMicClick, initializeSpeechRecognition, removeBoardHighlight } from './speechService.js';
import { renderMarkdown, clearWhiteboard, appendToWhiteboard } from './whiteboardController.js';
import { addChatMessage, addThinkingIndicator, removeThinkingIndicator, confirmClearChat, saveChatToPDF } from './chatController.js';

// --- Основная Логика Приложения ---

const activityVisuals = { /* ... без изменений ... */
    test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' },
    diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' },
    level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, vyuka_start: { icon: 'fa-chalkboard-teacher', class: 'lesson'}, vyuka_complete: { icon: 'fa-flag-checkered', class: 'test'},
    achievement: { icon: 'fa-trophy', class: 'badge'}, info: { icon: 'fa-info-circle', class: 'info' }, warning: { icon: 'fa-exclamation-triangle', class: 'warning' },
    error: { icon: 'fa-exclamation-circle', class: 'danger' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' }
};

/** Главная функция инициализации приложения. */
async function initializeApp() {
    console.log("🚀 [Init Vyuka v3.8.1] Starting App Initialization..."); // Обновлена версия лога
    let initializationError = null;
    // ... (остальная логика инициализации без изменений до manageButtonStates) ...
    if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
    if (ui.mainContent) ui.mainContent.style.display = 'none';
    hideError();

    try {
        const supabaseInitialized = initializeSupabase();
        if (!supabaseInitialized) throw new Error("Kriticka chyba Nepodarilo se pripojit k databazi");
        state.supabase = supabaseInitialized;
        console.log("[INIT] Supabase Initialized");

        console.log("[INIT] Checking auth session");
        const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
        if (sessionError) throw new Error(`Nepodarilo se overit sezeni ${sessionError.message.replace(/[.,!?;:]/g, '')}`);
        if (!session || !session.user) {
            console.log('[INIT] Not logged in Redirecting');
            window.location.href = '/auth/index.html';
            return;
        }
        state.currentUser = session.user;
        console.log(`[INIT] User authenticated ID ${state.currentUser.id} Fetching profile`);

        setLoadingState('user', true);
        state.currentProfile = await fetchUserProfile(state.currentUser.id);
        setLoadingState('user', false);
        if (!state.currentProfile) {
            console.warn(`Profile not found for user ${state.currentUser.id} Displaying error state`);
            initializationError = new Error("Profil nenalezen nebo se nepodarilo nacist Zkuste obnovit stranku");
            try { initializeUI(); updateUserInfoUI(); }
            catch (uiError) { console.error("UI Init failed during profile error:", uiError); }
            manageUIState('error', { errorMessage: initializationError.message });
        } else {
            console.log("[INIT] Profile fetched successfully");
        }

        console.log("[INIT] Initializing base UI");
        initializeUI();
        updateUserInfoUI();

        if (state.currentProfile && !initializationError) {
            console.log("[INIT] Loading initial topic and notifications");
            setLoadingState('currentTopic', true);
            setLoadingState('notifications', true);

            const loadNotificationsPromise = fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
                .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                .catch(err => {
                    console.error("Chyba pri uvodnim nacitani notifikaci:", err);
                    renderNotifications(0, []);
                    showToast('Chyba Notifikaci', 'Nepodarilo se nacist signaly', 'error');
                })
                .finally(() => {
                    setLoadingState('notifications', false);
                    manageButtonStates(); // <- Обновить состояние кнопок после загрузки уведомлений
                });

            const loadTopicPromise = loadNextTopicFlow()
                .catch(err => {
                    console.error("Chyba pri nacitani uvodniho tematu:", err);
                    manageUIState('error', { errorMessage: `Chyba nacitani tematu ${err.message.replace(/[.,!?;:]/g, '')}` });
                    state.topicLoadInProgress = false;
                    setLoadingState('currentTopic', false);
                });

            await Promise.all([loadNotificationsPromise, loadTopicPromise]);
            console.log("[INIT] Initial data loading complete or errors handled");
        } else {
             setLoadingState('currentTopic', false);
             setLoadingState('notifications', false);
             manageButtonStates(); // <- Обновить состояние кнопок если не грузили данные
        }

    } catch (error) {
        console.error("❌ [Init Vyuka v3.8.1] Critical initialization error:", error);
        initializationError = error;
        if (!document.getElementById('main-mobile-menu-toggle')) {
            try { initializeUI(); }
            catch (uiError) { console.error("Failed to initialize UI during critical error handling:", uiError); }
        }
        manageUIState('error', { errorMessage: error.message.replace(/[.,!?;:]/g, '') });
        setLoadingState('all', false);
        showError(`Chyba inicializace ${error.message.replace(/[.,!?;:]/g, '')}`, true);
    } finally {
        console.log("[INIT] Finalizing initialization finally block");
        if (ui.initialLoader) {
            ui.initialLoader.classList.add('hidden');
            setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500);
        }
        if (ui.mainContent) {
            ui.mainContent.style.display = 'flex';
            requestAnimationFrame(() => {
                if (ui.mainContent) ui.mainContent.classList.add('loaded');
                // initScrollAnimations(); // Вызываем только если нужно
            });
        }
        manageButtonStates(); // Ensure buttons are correct at the very end
        initTooltips(); // Инициализируем тултипы один раз в конце загрузки
        console.log("✅ [Init Vyuka v3.8.1] App Initialization Finished finally block");
    }
}

/** Инициализация базового UI и обработчиков. */
function initializeUI() {
    // ... (без изменений с v3.8) ...
    console.log("[UI Init] Initializing UI elements and handlers");
    try {
        updateTheme();
        setupEventListeners();
        if (ui.chatTabButton) ui.chatTabButton.classList.add('active');
        if (ui.chatTabContent) ui.chatTabContent.classList.add('active');
        initializeSpeechRecognition();
        loadVoices();
        initMouseFollower();
        initHeaderScrollDetection();
        updateCopyrightYear();
        updateOnlineStatus();
        manageUIState('initial');
        console.log("[UI Init] UI Initialized successfully");
    } catch (error) {
        console.error("UI Init failed:", error);
        showError(`Chyba inicializace UI ${error.message.replace(/[.,!?;:]/g, '')}`, false);
    }
}

/** Настройка основных обработчиков событий. */
function setupEventListeners() {
    // ... (без изменений с v3.8) ...
    console.log("[SETUP] Setting up event listeners");
    let listenersAttached = 0;
    function addListener(element, event, handler, elementName) {
        if (element) { element.addEventListener(event, handler); listenersAttached++; }
        else { console.warn(`[SETUP] Element '${elementName}' not found Listener not attached`); }
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
    addListener(ui.clearBoardBtn, 'click', () => { clearWhiteboard(false); showToast('Vymazano', "Tabule vymazana", "info"); }, 'clearBoardBtn');
    addListener(ui.stopSpeechBtn, 'click', stopSpeech, 'stopSpeechBtn');
    addListener(ui.continueBtn, 'click', requestContinue, 'continueBtn');
    addListener(ui.chatMessages, 'click', handleDynamicTTSClick, 'chatMessages (TTS Delegation)');
    addListener(ui.whiteboardContent, 'click', handleDynamicTTSClick, 'whiteboardContent (TTS Delegation)');
    const darkModeMatcher = window.matchMedia('(prefers-color-scheme: dark)');
    if (darkModeMatcher && typeof darkModeMatcher.addEventListener === 'function') { darkModeMatcher.addEventListener('change', event => { state.isDarkMode = event.matches; updateTheme(); }); listenersAttached++; }
    else { console.warn("[SETUP] Cannot add theme change listener"); }
    window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) { closeMenu(); } }); listenersAttached++;
    window.addEventListener('online', updateOnlineStatus); listenersAttached++;
    window.addEventListener('offline', updateOnlineStatus); listenersAttached++;
    addListener(ui.notificationBell, 'click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell');
    addListener(ui.markAllReadBtn, 'click', async () => { /* ... */ }, 'markAllReadBtn'); // Сокращено, без изменений
    addListener(ui.notificationsList, 'click', async (event) => { /* ... */ }, 'notificationsList'); // Сокращено, без изменений
    document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } }); listenersAttached++;
    console.log(`[SETUP] Event listeners setup complete Total attached approx ${listenersAttached}`);
}

// --- Обновление UI ---

/** Обновляет информацию о пользователе в UI (сайдбар). */
function updateUserInfoUI() {
    // ... (без изменений с v3.8) ...
    if (!ui.sidebarName || !ui.sidebarAvatar) { console.warn("updateUserInfoUI Sidebar elements not found"); return; }
    if (state.currentUser && state.currentProfile) { const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(state.currentProfile, state.currentUser.email); const avatarUrl = state.currentProfile.avatar_url; let finalUrl = avatarUrl; if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('//') && !avatarUrl.startsWith('data:')) { finalUrl = null; console.warn("Invalid avatar URL", avatarUrl); } else if (avatarUrl) { finalUrl = sanitizeHTML(avatarUrl); } ui.sidebarAvatar.innerHTML = finalUrl ? `<img src="${finalUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const sidebarImg = ui.sidebarAvatar.querySelector('img'); if (sidebarImg) { sidebarImg.onerror = function() { console.warn(`Failed to load avatar ${this.src}`); ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; } } else { ui.sidebarName.textContent = 'Neprihlasen'; ui.sidebarAvatar.textContent = '?'; }
}

/** Отображает уведомления в выпадающем списке. */
 function renderNotifications(count, notifications) {
    // ... (без изменений с v3.8) ...
    console.log("[Render Notifications] Count", count, "Notifications", notifications ? notifications.length : 0);
    if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements"); return; }
    ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0);
    if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[(n.type || 'default').toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; const title = (n.title || 'Nove oznameni').replace(/[.,!?;:]/g, ''); const message = (n.message || '').replace(/[.,!?;:]/g, ''); const timeAgo = formatRelativeTime(n.created_at); return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"><div class="notification-title">${sanitizeHTML(title)}</div><div class="notification-message">${sanitizeHTML(message)}</div><div class="notification-time">${timeAgo}</div></div> </div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.add('has-content'); } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.remove('has-content'); } const currentUnreadCount = parseInt(ui.notificationCount.textContent.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentUnreadCount === 0 || state.isLoading.notifications; console.log("[Render Notifications] Finished rendering");
 }

/** Управляет общим состоянием интерфейса. */
function manageUIState(mode, options = {}) {
    // ... (логика отображения learningInterface, очистки и заглушек чата/доски без изменений с v3.8) ...
    const isLearningActive = state.currentTopic && ['learning', 'chatting', 'requestingExplanation', 'waitingForAction', 'aiProposingCompletion'].includes(mode);
    const isEmptyState = ['noPlan', 'planComplete', 'error', 'loggedOut', 'initial', 'loadingTopic'].includes(mode);
    if (ui.learningInterface) { ui.learningInterface.style.display = !isEmptyState ? 'flex' : 'none'; }
    if (ui.chatMessages) { let chatHTML = ''; const hasMessages = ui.chatMessages.querySelector('.chat-message'); if (isEmptyState) { ui.chatMessages.innerHTML = ''; switch (mode) { case 'loggedOut': chatHTML = `<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPRIHLASEN</h3></div>`; break; case 'noPlan': chatHTML = `<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ZADNY PLAN</h3></div>`; break; case 'planComplete': chatHTML = `<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLAN HOTOV</h3></div>`; break; case 'error': chatHTML = `<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA</h3><p>${sanitizeHTML(options.errorMessage || 'Chyba systemu').replace(/[.,!?;:]/g, '')}</p></div>`; if (options.errorMessage && !document.getElementById('global-error')?.offsetParent) { showError(options.errorMessage, true); } break; case 'initial': chatHTML = '<div class="empty-state"><i class="fas fa-cog fa-spin"></i><h3>Inicializace</h3></div>'; break; case 'loadingTopic': chatHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><p>Nacitam tema</p></div>'; break; } if (chatHTML) ui.chatMessages.innerHTML = chatHTML; } else if (isLearningActive && !hasMessages && ui.chatMessages.querySelector('.empty-state')) { ui.chatMessages.innerHTML = ''; console.log("[UI State] Removed chat placeholder learning started") } console.log(`[UI State] Chat set to state ${mode}`); }
    if (ui.whiteboardContent) { const existingPlaceholder = ui.whiteboardContent.querySelector('.initial-load-placeholder, .empty-state'); const hasChunks = ui.whiteboardContent.querySelector('.whiteboard-chunk'); if (isEmptyState) { ui.whiteboardContent.innerHTML = ''; let boardHTML = ''; switch (mode) { case 'loadingTopic': boardHTML = '<div class="empty-state initial-load-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Nacitam prvni lekci</p></div>'; break; case 'error': boardHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba Tabule</h3><p>${sanitizeHTML(options.errorMessage || 'Obsah nelze zobrazit').replace(/[.,!?;:]/g, '')}</p></div>`; break; case 'noPlan': case 'planComplete': case 'loggedOut': boardHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule</h3><p>Vyberte tema</p></div>`; break; case 'initial': boardHTML = `<div class='empty-state'><i class='fas fa-spinner fa-spin'></i><h3>Inicializace</h3></div>`; break; } if (boardHTML) ui.whiteboardContent.innerHTML = boardHTML; } else if (isLearningActive && existingPlaceholder && !hasChunks) { if (!existingPlaceholder.textContent.includes("pripravena")) { ui.whiteboardContent.innerHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule pripravena</h3></div>`; } } else if (isLearningActive && existingPlaceholder && hasChunks) { existingPlaceholder.remove(); console.log("[UI State] Removed whiteboard placeholder content received"); } console.log(`[UI State] Whiteboard set to state ${mode}`); }

    manageButtonStates(); // Вызываем в конце для обновления кнопок
}

/**
 * Управляет активностью/неактивностью кнопок.
 * Версия 3.8.1: Изменен placeholder для waitingForAction.
 */
function manageButtonStates() {
    const hasTopic = !!state.currentTopic;
    const isThinking = state.geminiIsThinking;
    const isLoadingTopic = state.topicLoadInProgress;
    const isWaitingForAction = state.aiIsWaitingForAnswer;
    const isProposingCompletion = state.aiProposedCompletion;
    const isListening = state.isListening;
    const isSpeaking = state.speechSynthesisSupported && window.speechSynthesis.speaking;
    const isLoadingPoints = state.isLoading.points;
    const notificationsLoading = state.isLoading.notifications;
    const chatInputHasText = ui.chatInput?.value.trim().length > 0;
    const chatIsEmpty = !ui.chatMessages?.hasChildNodes() || !!ui.chatMessages?.querySelector('.empty-state');
    const boardIsEmpty = !ui.whiteboardContent?.hasChildNodes() || !!ui.whiteboardContent?.querySelector('.empty-state');
    const unreadNotifCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');

    const isBusyProcessing = isThinking || isLoadingTopic || isListening || isLoadingPoints;
    const canInteract = hasTopic && !isBusyProcessing;
    const canUseMic = hasTopic && !isBusyProcessing && !isSpeaking && state.speechRecognitionSupported;

    const setButtonState = (button, isDisabled) => {
        if (button && button.disabled !== isDisabled) { button.disabled = isDisabled; }
    };

    // Кнопка Отправить
    setButtonState(ui.sendButton, !canInteract || !chatInputHasText);
    if (ui.sendButton) ui.sendButton.innerHTML = isThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';

    // Поле ввода
    setButtonState(ui.chatInput, !canInteract);
    if (ui.chatInput) {
        let placeholder = "Zadej text"; // Стандартный
        if (isListening) placeholder = "Posloucham";
        else if (ui.chatInput.disabled) {
             if (isThinking) placeholder = "AI premysli";
             else if (isLoadingTopic) placeholder = "Nacitam tema";
             else if (isLoadingPoints) placeholder = "Zpracovavam dokonceni";
             else placeholder = "Akce nedostupna";
        } else if (isProposingCompletion) {
            placeholder = "AI navrhuje ukonceni Odpovez Ano Ne";
        } else if (isWaitingForAction) {
            // ИЗМЕНЕНИЕ: Более понятный плейсхолдер
            placeholder = "Reaguj nebo akce na tabuli";
        }
        ui.chatInput.placeholder = placeholder;
    }

    // Кнопка Pokracovat
    const shouldShowContinue = hasTopic && !isWaitingForAction && !isProposingCompletion;
    setButtonState(ui.continueBtn, !canInteract || isWaitingForAction || isProposingCompletion);
    if (ui.continueBtn) ui.continueBtn.style.display = shouldShowContinue ? 'inline-flex' : 'none';

    // Кнопка Zastavit
    setButtonState(ui.stopSpeechBtn, !isSpeaking);

    // Остальные кнопки
    setButtonState(ui.clearBoardBtn, boardIsEmpty || isBusyProcessing || isSpeaking);
    setButtonState(ui.micBtn, !canUseMic);
    if (ui.micBtn) {
        ui.micBtn.classList.toggle('listening', isListening);
        ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporovano" : (isListening ? "Zastavit hlasovy vstup" : (ui.micBtn.disabled ? (isSpeaking ? "Hlasovy vstup nedostupny AI mluvi" : "Hlasovy vstup nedostupny") : "Zahajit hlasovy vstup"));
    }
    setButtonState(ui.clearChatBtn, isBusyProcessing || chatIsEmpty || isSpeaking);
    setButtonState(ui.saveChatBtn, isBusyProcessing || chatIsEmpty || isSpeaking);
    setButtonState(ui.markAllReadBtn, unreadNotifCount === 0 || notificationsLoading);
}


/**
 * Обработчик клика для динамических TTS кнопок.
 */
function handleDynamicTTSClick(event) {
    // ... (без изменений) ...
    const button = event.target.closest('.tts-listen-btn'); if (button && button.dataset.textToSpeak && !button.disabled) { const textToSpeak = button.dataset.textToSpeak; const chunkElement = button.closest('.whiteboard-chunk'); speakText(textToSpeak, chunkElement); }
}

// --- Обработчики Действий ---

/**
 * Обрабатывает отправку сообщения из чата.
 * Версия 3.8.1: Добавлена блокировка "заверши тему".
 */
async function handleSendMessage() {
    const text = ui.chatInput?.value.trim();
    const affirmativeResponses = ['ano', 'jo', 'ok', 'dobře', 'dobre', 'souhlasim', 'potvrdit', 'uzavrit', 'dokoncit', 'jiste'];
    const negativeResponses = ['ne', 'nechci', 'stop', 'nemyslim', 'nesouhlasim', 'zrusit', 'neukoncovat'];
    const forceCompleteKeywords = ['ukonci', 'dokonci', 'zavri', 'konec', 'skonci', 'hotovo', 'заверши', 'укончи', 'конец', 'стоп']; // Добавил русские варианты

    // --- Блокировка ручного завершения ---
    if (!state.aiProposedCompletion && text) {
        const lowerText = text.toLowerCase();
        if (forceCompleteKeywords.some(keyword => lowerText.includes(keyword))) {
            console.warn("[ACTION] User attempted to force topic completion");
            if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }

            state.geminiIsThinking = true;
            addThinkingIndicator();
            manageButtonStates();
            let domChanged = true; // Индикатор добавлен
            try {
                const prompt = `Student se pokusil ukončit téma "${state.currentTopic?.name || 'toto'}". Vysvětli na TABULI stručně, že téma ukončuje AI až po důkladném probrání a ověření znalostí, a že student má pokračovat v učení nebo požádat o další krok. Do CHATU napiš pouze "Info na tabuli".`;
                const response = await sendToGemini(prompt, true);
                if (response.success && response.data) {
                    if (response.data.boardMarkdown) {
                        appendToWhiteboard(response.data.boardMarkdown, response.data.ttsCommentary);
                        domChanged = true;
                    }
                    if (response.data.chatText) {
                        await addChatMessage(response.data.chatText, 'gemini', false, new Date(), response.data.ttsCommentary);
                         domChanged = true;
                    } else await addChatMessage("Info na tabuli", 'gemini', false);
                } else {
                    await addChatMessage("Chyba nelze dokoncit", 'gemini', false);
                    domChanged = true;
                }
            } catch (e) {
                 await addChatMessage("Chyba zpracovani", 'gemini', false);
                 domChanged = true;
            } finally {
                removeThinkingIndicator(); domChanged = true;
                state.geminiIsThinking = false;
                // Не меняем state.aiIsWaitingForAnswer, так как AI должен был дать инструкцию на доске
                manageButtonStates();
                if (domChanged) initTooltips(); // Обновить тултипы
            }
            return; // Прерываем выполнение
        }
    }
    // --- Конец блокировки ---


    // --- Проверка на подтверждение/отказ AI-предложенного завершения ---
    if (state.aiProposedCompletion && text) {
        const lowerText = text.toLowerCase().replace(/[.,!?]/g, '');
        if (affirmativeResponses.includes(lowerText)) {
            // ... (Логика подтверждения без изменений) ...
            console.log("[AI Action] User confirmed topic completion via chat");
            const confirmationText = ui.chatInput?.value;
            if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }
            await addChatMessage(confirmationText, 'user');
            state.aiIsWaitingForAnswer = false;
            state.aiProposedCompletion = false;
            manageButtonStates();
            await completeTopicFlow();
            return;
        } else if (negativeResponses.includes(lowerText)) {
            // ... (Логика отказа без изменений) ...
            console.log("[AI Action] User rejected topic completion via chat");
            const rejectionText = ui.chatInput?.value;
            if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }
            await addChatMessage(rejectionText, 'user');
            state.aiIsWaitingForAnswer = false;
            state.aiProposedCompletion = false;
            state.geminiIsThinking = true;
            addThinkingIndicator();
            manageButtonStates();
            let domChanged = true;
            try {
                const prompt = `Student odmítl ukončení tématu "${state.currentTopic?.name || 'toto'}". Pokračuj ve výkladu další logickou částí nebo zadej další úkol na TABULI. Do CHATU napiš pouze "Pokracujeme".`;
                const response = await sendToGemini(prompt, true);
                 if (response.success && response.data) {
                     if (response.data.boardMarkdown) {appendToWhiteboard(response.data.boardMarkdown, response.data.ttsCommentary); domChanged = true; }
                     if (response.data.chatText) { await addChatMessage(response.data.chatText, 'gemini', false, new Date(), response.data.ttsCommentary); domChanged = true; }
                     else await addChatMessage("Pokracujeme", 'gemini', false);
                 } else { await addChatMessage("Chyba pokracovani", 'gemini', false); domChanged = true; }
            } catch(e) { await addChatMessage("Chyba zpracovani", 'gemini', false); domChanged = true; }
            finally {
                 removeThinkingIndicator(); domChanged = true;
                 state.geminiIsThinking = false;
                 state.aiIsWaitingForAnswer = true; // Ожидаем реакции на новый контент
                 manageUIState('waitingForAction');
                 manageButtonStates();
                 if (domChanged) initTooltips();
            }
            return;
        }
    }
    // --- Конец проверки на подтверждение/отказ ---

    // --- Стандартная отправка сообщения ---
    if (!state.currentUser || !state.currentProfile) { showError("Nelze odeslat zpravu chybi data uzivatele", false); return; }
    console.log("[ACTION] handleSendMessage triggered");

    const canSendNow = state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening;
    console.log(`[ACTION] handleSendMessage Check canSend=${canSendNow} hasText=${!!text}`);

    if (!canSendNow || !text) {
        if (!canSendNow) showToast('Pockejte prosim', 'System je zaneprazdnen', 'warning');
        if (!text) console.log("[ACTION] handleSendMessage No text to send");
        return;
    }

    const inputBeforeSend = ui.chatInput?.value;
    if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }

    if (state.aiProposedCompletion && text && !affirmativeResponses.includes(text.toLowerCase().replace(/[.,!?]/g, '')) && !negativeResponses.includes(text.toLowerCase().replace(/[.,!?]/g, ''))) {
         console.log("[State Change] User responded differently to completion proposal Resetting aiProposedCompletion");
         state.aiProposedCompletion = false;
    }

    let domChangedInTry = false;

    try {
        await addChatMessage(text, 'user'); domChangedInTry = true;
        state.geminiChatContext.push({ role: "user", parts: [{ text }] });

        console.log("[ACTION] handleSendMessage Setting isThinking=true aiWaiting=false");
        state.geminiIsThinking = true; state.aiIsWaitingForAnswer = false;
        addThinkingIndicator(); domChangedInTry = true;
        manageButtonStates();

        console.log("[ACTION] handleSendMessage Calling sendToGemini v3.8.8 isChatInteraction=true");
        const response = await sendToGemini(text, true);
        console.log("[ACTION] handleSendMessage Gemini response received:", response);

        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            const completionMarker = "[PROPOSE_COMPLETION]";
            let finalChatText = chatText;
            let proposedCompletion = false;

             if (chatText && chatText.includes(completionMarker)) {
                 finalChatText = chatText.replace(completionMarker, "").trim();
                 proposedCompletion = true;
                 console.log("[AI Action] AI proposed topic completion in response");
             }

            if (boardMarkdown) {
                const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state'); if (placeholder) placeholder.remove();
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); domChangedInTry = true;
            } else { console.warn("Gemini response has no board content for chat interaction"); if(ttsCommentary && !finalChatText) { await addChatMessage(ttsCommentary, 'gemini', true, new Date(), ttsCommentary); domChangedInTry = true; } }
            if (finalChatText) { await addChatMessage(finalChatText, 'gemini', false, new Date(), ttsCommentary); domChangedInTry = true; }
            if (ttsCommentary && boardMarkdown) { speakText(ttsCommentary, ui.whiteboardContent?.lastElementChild); }

            state.aiProposedCompletion = proposedCompletion;
            if (proposedCompletion) {
                 showToast("Navrh AI", "AI navrhuje ukonceni Odpovezte Ano Ne", "info", 6000);
                 state.aiIsWaitingForAnswer = true;
                 console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true waiting for completion confirmation");
            } else {
                 state.aiIsWaitingForAnswer = true;
                 console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true waiting for user action after board update");
            }

            if (domChangedInTry) { initTooltips(); }

        } else {
            console.error("Error response from Gemini:", response.error);
            const errorMsg = (response.error || "Neznama chyba AI").replace(/[.,!?;:]/g, '');
            await addChatMessage(errorMsg, 'gemini', false); domChangedInTry = true;
            state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
            console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false Gemini error`);
            if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
             if (domChangedInTry) initTooltips();
        }
    } catch (error) {
        console.error("Error in handleSendMessage catch block:", error);
        const errorMsg = `Chyba odesilani zpravy ${error.message}`.replace(/[.,!?;:]/g, '');
        showError(errorMsg, false); await addChatMessage("Chyba systemu", 'gemini', false); domChangedInTry = true;
        state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false exception`);
        if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
         if (domChangedInTry) initTooltips();
    } finally {
        console.log("[ACTION] handleSendMessage Entering finally block");
        const indicatorRemoved = removeThinkingIndicator(); domChangedInTry = domChangedInTry || indicatorRemoved; // Учитываем удаление индикатора
        console.log("[ACTION] handleSendMessage Setting isThinking=false in finally");
        state.geminiIsThinking = false; setLoadingState('chat', false);
        let nextUiState = 'learning';
        if(state.aiProposedCompletion) nextUiState = 'aiProposingCompletion';
        else if (state.aiIsWaitingForAnswer) nextUiState = 'waitingForAction';
        manageUIState(nextUiState);
        manageButtonStates();
        if (domChangedInTry) initTooltips(); // Вызываем, если что-то менялось в try или удалили индикатор
        console.log("[ACTION] handleSendMessage Exiting finally block");
    }
}


/**
 * Запрашивает следующую часть объяснения у AI (кнопка "Pokračuj").
 */
async function requestContinue() {
    // ... (логика проверки canContinueNow без изменений) ...
    console.log("[ACTION] requestContinue triggered");
    const canContinueNow = state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening && !state.aiIsWaitingForAnswer && !state.aiProposedCompletion;
    console.log(`[ACTION] requestContinue Check canContinue=${canContinueNow}`);
    if (!canContinueNow) { console.warn(`Cannot request continue thinking=${state.geminiIsThinking} loading=${state.topicLoadInProgress} listening=${state.isListening} waiting=${state.aiIsWaitingForAnswer} proposing=${state.aiProposedCompletion}`); let reason = 'System je zaneprazdnen'; if(state.aiIsWaitingForAnswer) reason = 'AI ceka na vasi akci'; if(state.aiProposedCompletion) reason = 'AI navrhlo ukonceni tematu'; showToast('Nelze pokracovat', reason, 'warning'); return; }

    console.log("[ACTION] requestContinue Setting isThinking=true aiWaiting=false proposing=false");
    state.geminiIsThinking = true; state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
    addThinkingIndicator(); let domChangedInTry = true;
    manageButtonStates();

    const prompt = `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}" na úrovni Přijímaček. Naváž na PŘEDCHOZÍ OBSAH TABULE. Připrav další logickou část výkladu nebo komplexnější příklad na TABULI. Do CHATU napiš pouze "Na tabuli".`;

    try {
        console.log("[ACTION] requestContinue Calling sendToGemini v3.8.8 isChatInteraction=false");
        const response = await sendToGemini(prompt, false);
        console.log("[ACTION] requestContinue Gemini response received:", response);

        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            const completionMarker = "[PROPOSE_COMPLETION]";
            let finalChatText = chatText;
            let proposedCompletion = false;

             if (chatText && chatText.includes(completionMarker)) {
                 finalChatText = chatText.replace(completionMarker, "").trim();
                 proposedCompletion = true;
                 console.log("[AI Action] AI proposed topic completion in response");
             }

            if (boardMarkdown) {
                const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state'); if (placeholder) placeholder.remove();
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); domChangedInTry = true;
            } else { console.error("Gemini did not return board content for continue request"); await addChatMessage("Chyba AI zadny obsah", 'gemini', false); domChangedInTry = true; }
            if (finalChatText) { await addChatMessage(finalChatText, 'gemini', false, new Date(), ttsCommentary); domChangedInTry = true; }
            else if (boardMarkdown) { await addChatMessage("Na tabuli", 'gemini', false); domChangedInTry = true; }
            if (ttsCommentary && boardMarkdown) { speakText(ttsCommentary, ui.whiteboardContent?.lastElementChild); }

            state.aiProposedCompletion = proposedCompletion;
            if (proposedCompletion) {
                 showToast("Navrh AI", "AI navrhuje ukonceni Odpovezte Ano Ne", "info", 6000);
                 state.aiIsWaitingForAnswer = true;
                 console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true waiting for completion confirmation");
            } else if (boardMarkdown) {
                  state.aiIsWaitingForAnswer = true;
                  console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true waiting for user action after board update");
             } else {
                  state.aiIsWaitingForAnswer = false;
                  console.log("[STATE CHANGE] aiIsWaitingForAnswer set to false due to missing board content");
             }

             if (domChangedInTry) { initTooltips(); }

        } else {
             console.error("Error response from Gemini:", response.error);
             const errorMsg = (response.error || "Neznama chyba AI").replace(/[.,!?;:]/g, '');
             await addChatMessage(errorMsg, 'gemini', false); domChangedInTry = true;
             state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
             console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false Gemini error`);
              if (domChangedInTry) initTooltips();
        }
    } catch (error) {
        console.error("Error in requestContinue catch block:", error);
        const errorMsg = `Chyba pokracovani ${error.message}`.replace(/[.,!?;:]/g, '');
        showError(errorMsg, false); await addChatMessage("Chyba systemu", 'gemini', false); domChangedInTry = true;
        state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false exception`);
         if (domChangedInTry) initTooltips();
    } finally {
        console.log("[ACTION] requestContinue Entering finally block");
        const indicatorRemoved = removeThinkingIndicator(); domChangedInTry = domChangedInTry || indicatorRemoved;
        console.log("[ACTION] requestContinue Setting isThinking=false in finally");
        state.geminiIsThinking = false; setLoadingState('chat', false);
        let nextUiState = 'learning';
        if(state.aiProposedCompletion) nextUiState = 'aiProposingCompletion';
        else if (state.aiIsWaitingForAnswer) nextUiState = 'waitingForAction';
        manageUIState(nextUiState);
        manageButtonStates();
        if (domChangedInTry) initTooltips();
        console.log("[ACTION] requestContinue Exiting finally block");
    }
}


/**
 * Запускает сессию обучения для текущей темы.
 */
async function startLearningSession() {
    // ... (логика проверки currentTopic и сброса состояния без изменений) ...
    if (!state.currentTopic) { console.error("[ACTION] startLearningSession No current topic defined"); manageUIState('error', {errorMessage: 'Chyba Tema neni definovano'}); return; }
    console.log("[ACTION] startLearningSession triggered for topic:", state.currentTopic.name);
    state.currentSessionId = generateSessionId(); state.geminiChatContext = []; state.boardContentHistory = [];
    if (ui.chatMessages) ui.chatMessages.innerHTML = ''; if (ui.whiteboardContent) ui.whiteboardContent.innerHTML = '';
    state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;

    console.log("[ACTION] startLearningSession Setting isThinking=true aiWaiting=false proposing=false");
    state.geminiIsThinking = true;
    manageUIState('requestingExplanation');
    addThinkingIndicator(); let domChangedInTry = true;
    manageButtonStates();

    const prompt = `Vysvětli ZÁKLADY tématu "${state.currentTopic.name}" na úrovni Přijímaček. Začni PRVNÍ částí výkladu na TABULI. Do CHATU napiš pouze "Start".`;

    try {
        console.log("[ACTION] startLearningSession Calling sendToGemini v3.8.8 isChatInteraction=false");
        const response = await sendToGemini(prompt, false);
        console.log("[ACTION] startLearningSession Gemini response received:", response);

        // Убираем заглушки (если есть ответ)
        if (response.success && response.data && response.data.boardMarkdown) {
            const boardPlaceholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state'); if (boardPlaceholder) { boardPlaceholder.remove(); console.log("Initial whiteboard placeholder removed"); }
            const chatPlaceholder = ui.chatMessages?.querySelector('.empty-state, .initial-load-placeholder'); if (chatPlaceholder) { chatPlaceholder.remove(); console.log("Initial chat placeholder removed");}
        } else if (response.success && response.data && !response.data.boardMarkdown) {
             const boardPlaceholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state'); if(boardPlaceholder) boardPlaceholder.innerHTML = `<i class='fas fa-chalkboard'></i><h3>Tabule prazdna</h3><p>AI neposkytlo uvodni obsah</p>`;
             const chatPlaceholder = ui.chatMessages?.querySelector('.empty-state, .initial-load-placeholder'); if(chatPlaceholder) chatPlaceholder.innerHTML = `<i class='fas fa-comments'></i><h3>Chat</h3><p>AI neposkytlo uvodni obsah</p>`;
        }

        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            const completionMarker = "[PROPOSE_COMPLETION]";
            let finalChatText = chatText;
            let proposedCompletion = false;

             if (chatText && chatText.includes(completionMarker)) {
                 finalChatText = chatText.replace(completionMarker, "").trim();
                 proposedCompletion = true;
                 console.log("[AI Action] AI proposed topic completion unexpectedly in initial response");
             }

            if (boardMarkdown) { appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); domChangedInTry = true; }
            else { console.error("Gemini initial response missing board content"); await addChatMessage("Chyba AI zadny obsah", 'gemini', false); domChangedInTry = true; }
            if (finalChatText) { await addChatMessage(finalChatText, 'gemini', false, new Date(), ttsCommentary); domChangedInTry = true; }
            else if (boardMarkdown) { await addChatMessage("Start", 'gemini', false); domChangedInTry = true; }
            if (ttsCommentary && boardMarkdown) { speakText(ttsCommentary, ui.whiteboardContent?.lastElementChild); }

             state.aiProposedCompletion = proposedCompletion;
             if (proposedCompletion) {
                  showToast("Navrh AI", "AI navrhuje ukonceni Odpovezte Ano Ne", "info", 6000);
                  state.aiIsWaitingForAnswer = true;
                  console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true waiting for completion confirmation");
             } else if (boardMarkdown) {
                   state.aiIsWaitingForAnswer = true;
                   console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true waiting for user action after initial explanation");
             } else {
                   state.aiIsWaitingForAnswer = false;
                   console.log("[STATE CHANGE] aiIsWaitingForAnswer set to false due to missing initial board content");
             }

             if (domChangedInTry) { initTooltips(); }

        } else {
             console.error("Error response from Gemini:", response.error);
             const errorMsg = (response.error || "Neznama chyba AI").replace(/[.,!?;:]/g, '');
             await addChatMessage(errorMsg, 'gemini', false); domChangedInTry = true;
             if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba nacitani</h3></div>`; }
             state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
             console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false Gemini error`);
             showError(`Chyba AI pri startu ${errorMsg}`, false);
              if (domChangedInTry) initTooltips();
        }
    } catch(error) {
        console.error("Error in startLearningSession catch block:", error);
        const errorMsg = `Chyba zahajeni vykladu ${error.message}`.replace(/[.,!?;:]/g, '');
        showError(errorMsg, false);
        if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba systemu</h3></div>`; }
        await addChatMessage("Chyba systemu start", 'gemini', false); domChangedInTry = true;
        state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false exception`);
         if (domChangedInTry) initTooltips();
    } finally {
        console.log("[ACTION] startLearningSession Entering finally block");
        const indicatorRemoved = removeThinkingIndicator(); domChangedInTry = domChangedInTry || indicatorRemoved;
        console.log("[ACTION] startLearningSession Setting isThinking=false in finally");
        state.geminiIsThinking = false; setLoadingState('chat', false);
        let nextUiState = 'learning';
        if(state.aiProposedCompletion) nextUiState = 'aiProposingCompletion';
        else if (state.aiIsWaitingForAnswer) nextUiState = 'waitingForAction';
        manageUIState(nextUiState);
        manageButtonStates();
        if (domChangedInTry) initTooltips();
        console.log("[ACTION] startLearningSession Exiting finally block");
    }
}


/**
 * Поток действий при подтверждении завершения темы пользователем.
 */
async function completeTopicFlow() {
    // ... (логика проверки и установки флагов без изменений) ...
    if (!state.currentTopic || !state.currentUser) { console.error("[Flow] Cannot complete topic missing topic or user data"); showToast("Chyba", "Nelze dokoncit tema chybi data", "error"); return; }
    if (state.topicLoadInProgress || state.isLoading.points) { console.warn("[Flow] Completion already in progress or points being loaded"); return; }
    console.log(`[Flow] Starting topic completion flow for activity ${state.currentTopic.activity_id}`);
    state.topicLoadInProgress = true; setLoadingState('points', true); manageButtonStates();

    try {
        console.log(`[Flow] Calling markTopicComplete for activity ${state.currentTopic.activity_id}`);
        const successMark = await markTopicComplete(state.currentTopic.activity_id, state.currentUser.id);
        if (!successMark) { throw new Error("Nepodarilo se oznacit tema jako dokoncene v databazi"); }
        console.log(`[Flow] Topic marked complete in DB`);

        console.log(`[Flow] --> Calling awardPoints userId ${state.currentUser.id} points ${POINTS_TOPIC_COMPLETE}`);
        const pointsAwarded = await awardPoints(state.currentUser.id, POINTS_TOPIC_COMPLETE);
        setLoadingState('points', false);
        console.log(`[Flow] <-- awardPoints returned ${pointsAwarded}`);

        if (pointsAwarded) { showToast('BODY PRIPSANY', `${POINTS_TOPIC_COMPLETE} kreditu ziskano`, 'success', 3500); updateUserInfoUI(); }
        else { showToast('CHYBA BODU', 'Tema dokonceno ale body se nepodarilo pripsat Zkontrolujte konzoli', 'warning', 5000); }

        showToast('Tema dokonceno', `Tema ${state.currentTopic.name} uzavreno`, "success", 4000);
        await addChatMessage("Tema uzavreno", 'gemini', false);

        console.log("[Flow] Redirecting to /dashboard/procvicovani/main.html in 3 seconds");
        showToast("Presmerovani", "Za chvili budete presmerovani", "info", 3000);
        setTimeout(() => { window.location.href = '/dashboard/procvicovani/main.html'; }, 3000);

    } catch (error) {
        console.error("[Flow] Error in completeTopicFlow:", error);
        const errorMsg = `Nepodarilo se dokoncit tema ${error.message}`.replace(/[.,!?;:]/g, '');
        showToast("Chyba dokonceni", errorMsg, "error");
        state.topicLoadInProgress = false; setLoadingState('points', false); manageButtonStates();
    }
}

/** Поток действий для загрузки следующей темы. */
async function loadNextTopicFlow() {
    // ... (логика проверок, сброса состояния и UI без изменений) ...
     if (!state.currentUser) { console.log(`[Flow] Load next topic skipped No user`); return; }
     if (state.topicLoadInProgress) { console.log(`[Flow] Load next topic skipped Already in progress`); return; }
     console.log("[Flow] Loading next topic flow STARTED Setting topicLoadInProgress=true");
     state.topicLoadInProgress = true; setLoadingState('currentTopic', true);
     state.currentTopic = null; state.geminiChatContext = []; state.boardContentHistory = [];
     state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
     console.log("[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false by loadNextTopicFlow start");
     if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Nacitam dalsi tema</span>';
     clearWhiteboard(true); if (ui.chatMessages) ui.chatMessages.innerHTML = '';
     manageUIState('loadingTopic'); manageButtonStates();

    try {
        console.log("[Flow] Calling loadNextUncompletedTopic");
        const result = await loadNextUncompletedTopic(state.currentUser.id);
        console.log("[Flow] loadNextUncompletedTopic result:", result);

        if (result.success && result.topic) {
            state.currentTopic = result.topic;
            if (ui.currentTopicDisplay) { ui.currentTopicDisplay.innerHTML = `Tema <strong>${sanitizeHTML(state.currentTopic.name)}</strong>`; }
            console.log("[Flow] Topic loaded successfully Resetting topicLoadInProgress=false Starting session");
            state.topicLoadInProgress = false; setLoadingState('currentTopic', false);
            await startLearningSession(); // Запускаем сессию для новой темы
        } else {
            state.currentTopic = null;
            const message = (result.message || 'Neni dalsi tema nebo nastala chyba').replace(/[.,!?;:]/g, '');
            if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(${sanitizeHTML(message)})</span>`;
            console.log(`[Flow] No topic loaded or error Reason ${result.reason} Resetting topicLoadInProgress=false`);
            state.topicLoadInProgress = false; setLoadingState('currentTopic', false);
            manageUIState(result.reason || 'error', { errorMessage: message }); manageButtonStates();
        }
    } catch(error) {
        console.error("Error in loadNextTopicFlow execution:", error);
        state.currentTopic = null;
        const errorMsg = `Chyba pri nacitani dalsiho tematu ${error.message}`.replace(/[.,!?;:]/g, '');
        if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(Chyba nacitani)</span>`;
        console.log("[Flow] Exception loading topic Resetting topicLoadInProgress=false");
        state.topicLoadInProgress = false; setLoadingState('currentTopic', false);
        manageUIState('error', { errorMessage: errorMsg }); manageButtonStates();
    } finally {
         if (state.topicLoadInProgress) { console.warn("[Flow] topicLoadInProgress was still true in finally block Resetting"); state.topicLoadInProgress = false; setLoadingState('currentTopic', false); manageButtonStates(); }
         // initTooltips(); // Убрал отсюда, вызываем в конце initializeApp
    }
    console.log("[Flow] Loading next topic flow FINISHED");
}

// --- Запуск Приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);