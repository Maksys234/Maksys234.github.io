// vyukaApp.js - Основной файл приложения Vyuka
// Verze 3.9.5 (beze změn, potvrzení stavu)

// --- Import Modulů ---
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
import { loadVoices, speakText, stopSpeech, handleMicClick, initializeSpeechRecognition, removeBoardHighlight, setManageButtonStatesCallback } from './speechService.js';
// Import POUZE appendToWhiteboard a clearWhiteboard z whiteboardController
import { appendToWhiteboard, clearWhiteboard } from './whiteboardController.js';
// Import z chatController
import { addChatMessage, addThinkingIndicator, removeThinkingIndicator } from './chatController.js';

// --- Основная Логика Приложения ---

// Mapování typů aktivit pro notifikace
const activityVisuals = {
    test: { icon: 'fa-vial', class: 'test' },
    exercise: { icon: 'fa-pencil-alt', class: 'exercise' },
    badge: { icon: 'fa-medal', class: 'badge' },
    diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' },
    lesson: { icon: 'fa-book-open', class: 'lesson' },
    plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' },
    level_up: { icon: 'fa-level-up-alt', class: 'level_up' },
    vyuka_start: { icon: 'fa-chalkboard-teacher', class: 'lesson'},
    vyuka_complete: { icon: 'fa-flag-checkered', class: 'test'},
    achievement: { icon: 'fa-trophy', class: 'badge'},
    info: { icon: 'fa-info-circle', class: 'info' },
    warning: { icon: 'fa-exclamation-triangle', class: 'warning' },
    error: { icon: 'fa-exclamation-circle', class: 'danger' },
    other: { icon: 'fa-info-circle', class: 'other' },
    default: { icon: 'fa-check-circle', class: 'default' }
};

/**
 * Komplexní funkce pro správu stavu VŠECH interaktivních tlačítek.
 * Verze 3.9.5: Finální logika pro input/continue.
 */
function manageButtonStates() {
    // --- 1. Získání aktuálního stavu aplikace ---
    const hasTopic = !!state.currentTopic;
    const isThinking = state.geminiIsThinking;
    const isLoadingTopic = state.topicLoadInProgress;
    const isWaitingForAction = state.aiIsWaitingForAnswer; // Jen pro info
    const isProposingCompletion = state.aiProposedCompletion; // BLOKUJE vstup
    const isListening = state.isListening;
    const isSpeaking = state.isSpeakingTTS;
    const isLoadingPoints = state.isLoading.points;
    const isLoadingNotifications = state.isLoading.notifications;
    const chatInputHasText = ui.chatInput?.value.trim().length > 0;
    const boardIsEmpty = !ui.whiteboardContent?.hasChildNodes() || !!ui.whiteboardContent?.querySelector('.empty-state');
    const unreadNotifCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');

    // --- 2. Odvozené stavy pro zjednodušení logiky ---
    const isBusyProcessing = isThinking || isLoadingTopic || isLoadingPoints;
    const isBusyUI = isListening || isSpeaking;

    // Lze psát/odeslat, pokud není busy a AI nenavrhuje ukončení.
    const canTypeInChat = hasTopic && !isBusyProcessing && !isBusyUI && !isProposingCompletion;
    const canSendChatMessage = canTypeInChat && chatInputHasText;

    // Lze použít mikrofon, pokud není busy (včetně mluvení) a je podpora.
    const canUseMic = hasTopic && !isBusyProcessing && !isSpeaking && state.speechRecognitionSupported;

    // Lze zobrazit Pokračuj, pokud je téma a AI nenavrhuje ukončení. Lze kliknout, pokud zobrazeno a není busy.
    const shouldShowContinue = hasTopic && !isProposingCompletion;
    const canClickContinue = shouldShowContinue && !isBusyProcessing && !isBusyUI;

    // Ostatní
    const canClearBoard = !isBusyProcessing && !isBusyUI && !boardIsEmpty;
    const canStopSpeech = isSpeaking;
    const canMarkAllRead = unreadNotifCount > 0 && !isLoadingNotifications;

    // --- 3. Pomocná funkce pro nastavení stavu tlačítka ---
    const setButtonState = (button, isDisabled, isHidden = false) => {
        if (!button) return;
        if (button.disabled !== isDisabled) { button.disabled = isDisabled; }
        const currentDisplay = button.style.display || window.getComputedStyle(button).display;
        const defaultVisibleDisplay = (button.tagName === 'TEXTAREA' || button.tagName === 'INPUT') ? 'block' : 'inline-flex';
        const targetDisplay = isHidden ? 'none' : defaultVisibleDisplay;
        if (currentDisplay !== targetDisplay) { button.style.display = targetDisplay; }
    };

    // --- 4. Nastavení stavu jednotlivých tlačítek ---
    setButtonState(ui.sendButton, !canSendChatMessage);
    if (ui.sendButton) { ui.sendButton.innerHTML = isThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>'; }

    setButtonState(ui.chatInput, !canTypeInChat);
    if (ui.chatInput) {
        let placeholder = "Zadej text nebo otázku...";
        if (isListening) placeholder = "Poslouchám...";
        else if (!canTypeInChat) {
             if (isThinking) placeholder = "AI přemýšlí...";
             else if (isLoadingTopic) placeholder = "Načítám téma...";
             else if (isSpeaking) placeholder = "AI mluví...";
             else if (isLoadingPoints) placeholder = "Zpracovávám dokončení...";
             else if (isProposingCompletion) placeholder = "AI navrhuje ukončení. Odpověz Ano/Ne.";
             else placeholder = "Akce nedostupná";
        }
        if (ui.chatInput.placeholder !== placeholder) { ui.chatInput.placeholder = placeholder; }
    }

    setButtonState(ui.continueBtn, !canClickContinue, !shouldShowContinue);
    setButtonState(ui.stopSpeechBtn, !canStopSpeech);
    setButtonState(ui.clearBoardBtn, !canClearBoard);
    setButtonState(ui.micBtn, !canUseMic);
    if (ui.micBtn) {
        ui.micBtn.classList.toggle('listening', isListening);
        let micTitle = "Hlasový vstup";
        if (!state.speechRecognitionSupported) micTitle = "Rozpoznávání řeči není podporováno";
        else if (isListening) micTitle = "Zastavit hlasový vstup";
        else if (!canUseMic) micTitle = "Hlasový vstup nedostupný (systém zaneprázdněn)";
        else micTitle = "Zahájit hlasový vstup";
        if (ui.micBtn.title !== micTitle) { ui.micBtn.title = micTitle; }
    }
    setButtonState(ui.markAllReadBtn, !canMarkAllRead);
}


/** Hlavní funkce inicializace aplikace. */
async function initializeApp() {
    console.log("🚀 [Init Vyuka v3.9.5] Starting App Initialization...");
    let initializationError = null;
    if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
    if (ui.mainContent) ui.mainContent.style.display = 'none';
    hideError();

    setManageButtonStatesCallback(manageButtonStates);

    try {
        const supabaseInitialized = initializeSupabase();
        if (!supabaseInitialized) throw new Error("Kritická chyba: Nepodařilo se připojit k databázi.");
        state.supabase = supabaseInitialized;
        console.log("[INIT] Supabase Initialized");

        console.log("[INIT] Checking auth session");
        const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
        if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message.replace(/[.,!?;:]/g, '')}`);
        if (!session || !session.user) { console.log('[INIT] Not logged in. Redirecting...'); window.location.href = '/auth/index.html'; return; }
        state.currentUser = session.user;
        console.log(`[INIT] User authenticated (ID: ${state.currentUser.id}). Fetching profile...`);

        setLoadingState('user', true);
        state.currentProfile = await fetchUserProfile(state.currentUser.id);
        setLoadingState('user', false);
        if (!state.currentProfile) {
            console.warn(`Profile not found for user ${state.currentUser.id}. Displaying error state.`);
            initializationError = new Error("Profil nenalezen nebo se nepodařilo načíst. Zkuste obnovit stránku.");
            try { initializeUI(); updateUserInfoUI(); } catch (uiError) { console.error("UI Init failed during profile error:", uiError); }
            manageUIState('error', { errorMessage: initializationError.message });
        } else { console.log("[INIT] Profile fetched successfully."); }

        console.log("[INIT] Initializing base UI...");
        initializeUI();
        updateUserInfoUI();

        if (state.currentProfile && !initializationError) {
            console.log("[INIT] Loading initial topic and notifications...");
            setLoadingState('currentTopic', true); setLoadingState('notifications', true);
            const loadNotificationsPromise = fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
                .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                .catch(err => { console.error("Chyba při úvodním načítání notifikací:", err); renderNotifications(0, []); showToast('Chyba Notifikací', 'Nepodařilo se načíst signály.', 'error'); })
                .finally(() => { setLoadingState('notifications', false); manageButtonStates(); });
            const loadTopicPromise = loadNextTopicFlow()
                .catch(err => { console.error("Chyba při načítání úvodního tématu:", err); manageUIState('error', { errorMessage: `Chyba načítání tématu: ${err.message.replace(/[.,!?;:]/g, '')}` }); state.topicLoadInProgress = false; setLoadingState('currentTopic', false); });
            await Promise.all([loadNotificationsPromise, loadTopicPromise]);
            console.log("[INIT] Initial data loading complete or errors handled.");
        } else { setLoadingState('currentTopic', false); setLoadingState('notifications', false); manageButtonStates(); }
    } catch (error) {
        console.error("❌ [Init Vyuka v3.9.5] Critical initialization error:", error); initializationError = error;
        if (!document.getElementById('main-mobile-menu-toggle')) { try { initializeUI(); } catch (uiError) { console.error("Failed to initialize UI during critical error handling:", uiError); } }
        manageUIState('error', { errorMessage: error.message.replace(/[.,!?;:]/g, '') }); setLoadingState('all', false); showError(`Chyba inicializace: ${error.message.replace(/[.,!?;:]/g, '')}`, true);
    } finally {
        console.log("[INIT] Finalizing initialization (finally block)...");
        if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
        if (ui.mainContent) { ui.mainContent.style.display = 'flex'; requestAnimationFrame(() => { if (ui.mainContent) ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
        manageButtonStates(); initTooltips();
        console.log("✅ [Init Vyuka v3.9.5] App Initialization Finished (finally block).");
    }
}

/** Инициализация базового UI и обработчиков. */
function initializeUI() {
    console.log("[UI Init] Initializing UI elements and handlers...");
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
        console.log("[UI Init] UI Initialized successfully.");
    } catch (error) {
        console.error("UI Init failed:", error);
        showError(`Chyba inicializace UI: ${error.message.replace(/[.,!?;:]/g, '')}`, false);
    }
}

/** Настройка основных обработчиков событий. */
function setupEventListeners() {
    console.log("[SETUP] Setting up event listeners...");
    let listenersAttached = 0;
    function addListener(element, event, handler, elementName) {
        if (element) { element.removeEventListener(event, handler); element.addEventListener(event, handler); listenersAttached++; }
        else { if (!state[`listener_warn_${elementName}`]) { console.warn(`[SETUP] Element '${elementName}' not found. Listener not attached.`); state[`listener_warn_${elementName}`] = true; } }
    }
    addListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
    addListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
    addListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');
    addListener(ui.chatInput, 'input', () => autoResizeTextarea(ui.chatInput), 'chatInput (input)');
    addListener(ui.sendButton, 'click', handleSendMessage, 'sendButton');
    addListener(ui.chatInput, 'keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }, 'chatInput (keypress)');
    addListener(ui.clearBoardBtn, 'click', () => { clearWhiteboard(false); showToast('Vymazáno', "Tabule byla vymazána.", "info"); manageButtonStates(); }, 'clearBoardBtn');
    addListener(ui.continueBtn, 'click', requestContinue, 'continueBtn');
    addListener(ui.micBtn, 'click', handleMicClick, 'micBtn');
    addListener(ui.stopSpeechBtn, 'click', stopSpeech, 'stopSpeechBtn');
    addListener(ui.chatMessages, 'click', handleDynamicTTSClick, 'chatMessages (TTS Delegation)');
    addListener(ui.whiteboardContent, 'click', handleDynamicTTSClick, 'whiteboardContent (TTS Delegation)');
    const darkModeMatcher = window.matchMedia('(prefers-color-scheme: dark)');
    function handleThemeChange(event) { state.isDarkMode = event.matches; updateTheme(); }
    function handleResize() { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) { closeMenu(); } }
    if (darkModeMatcher && typeof darkModeMatcher.addEventListener === 'function') { darkModeMatcher.removeEventListener('change', handleThemeChange); darkModeMatcher.addEventListener('change', handleThemeChange); listenersAttached++; } else { console.warn("[SETUP] Cannot add theme change listener."); }
    window.removeEventListener('resize', handleResize); window.addEventListener('resize', handleResize); listenersAttached++;
    window.removeEventListener('online', updateOnlineStatus); window.addEventListener('online', updateOnlineStatus); listenersAttached++;
    window.removeEventListener('offline', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus); listenersAttached++;
    function handleNotificationBellClick(event) { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }
    async function handleMarkAllReadClick() { if(ui.markAllReadBtn.disabled) return; setLoadingState('notifications', true); const success = await markAllNotificationsRead(state.currentUser.id); if (success) { renderNotifications(0, []); showToast('Hotovo', 'Všechna oznámení označena jako přečtená.', 'success'); } else { showToast('Chyba', 'Nepodařilo se označit oznámení.', 'error'); } setLoadingState('notifications', false); manageButtonStates(); }
    async function handleNotificationItemClick(event) { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId, state.currentUser.id); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); manageButtonStates(); } } if (link) window.location.href = link; } }
    function handleOutsideNotificationClick(event) { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } }
    addListener(ui.notificationBell, 'click', handleNotificationBellClick, 'notificationBell');
    addListener(ui.markAllReadBtn, 'click', handleMarkAllReadClick, 'markAllReadBtn');
    addListener(ui.notificationsList, 'click', handleNotificationItemClick, 'notificationsList (Delegation)');
    document.removeEventListener('click', handleOutsideNotificationClick); document.addEventListener('click', handleOutsideNotificationClick); listenersAttached++;
    console.log(`[SETUP] Event listeners setup complete. Total attached approx: ${listenersAttached}`);
}

/** Обновляет информацию о пользователе в UI (сайдбар). */
function updateUserInfoUI() {
    if (!ui.sidebarName || !ui.sidebarAvatar) { console.warn("updateUserInfoUI: Sidebar elements not found."); return; }
    if (state.currentUser && state.currentProfile) {
        const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot';
        ui.sidebarName.textContent = sanitizeHTML(displayName);
        const initials = getInitials(state.currentProfile, state.currentUser.email);
        const avatarUrl = state.currentProfile.avatar_url;
        let finalUrl = avatarUrl;
        if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('//') && !avatarUrl.startsWith('data:') && !avatarUrl.startsWith('assets/')) { finalUrl = null; console.warn("Invalid avatar URL format detected:", avatarUrl); }
        else if (avatarUrl) { finalUrl = sanitizeHTML(avatarUrl); if (finalUrl.startsWith('http')) { finalUrl += `?t=${new Date().getTime()}`; } }
        ui.sidebarAvatar.innerHTML = finalUrl ? `<img src="${finalUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
        const sidebarImg = ui.sidebarAvatar.querySelector('img');
        if (sidebarImg) { sidebarImg.onerror = function() { console.warn(`Failed to load avatar image: ${this.src}. Falling back to initials.`); ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; }
    } else { ui.sidebarName.textContent = 'Nepřihlášen'; ui.sidebarAvatar.textContent = '?'; }
}

/** Отображает уведомления в выпадающем списке. */
 function renderNotifications(count, notifications) {
    if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements for notifications."); return; }
    ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
    ui.notificationCount.classList.toggle('visible', count > 0);
    if (notifications && notifications.length > 0) {
        ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[(n.type || 'default').toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; const title = (n.title || 'Nové oznámení').replace(/[.,!?;:]/g, ''); const message = (n.message || '').replace(/[.,!?;:]/g, ''); const timeAgo = formatRelativeTime(n.created_at); return ` <div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"> <i class="fas ${visual.icon}"></i> </div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(title)}</div> <div class="notification-message">${sanitizeHTML(message)}</div> <div class="notification-time">${timeAgo}</div> </div> </div>`; }).join('');
        ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.add('has-content');
    } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.remove('has-content'); }
    const currentUnreadCount = parseInt(ui.notificationCount.textContent.replace('+', '') || '0');
    ui.markAllReadBtn.disabled = currentUnreadCount === 0 || state.isLoading.notifications;
 }

/** Управляет общим состоянием интерфейса (заглушки, видимость). */
function manageUIState(mode, options = {}) {
    const isLearningActive = state.currentTopic && ['learning', 'chatting', 'requestingExplanation', 'waitingForAction', 'aiProposingCompletion'].includes(mode);
    const isEmptyState = ['noPlan', 'planComplete', 'error', 'loggedOut', 'initial', 'loadingTopic'].includes(mode);
    if (ui.learningInterface) { ui.learningInterface.style.display = !isEmptyState ? 'flex' : 'none'; }
    if (ui.chatMessages) { const hasMessages = ui.chatMessages.querySelector('.chat-message'); if (isEmptyState) { ui.chatMessages.innerHTML = ''; let chatHTML = ''; switch (mode) { case 'loggedOut': chatHTML = `<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPŘIHLÁŠEN</h3></div>`; break; case 'noPlan': chatHTML = `<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ŽÁDNÝ PLÁN</h3></div>`; break; case 'planComplete': chatHTML = `<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLÁN HOTOV</h3></div>`; break; case 'error': chatHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA SYSTÉMU</h3><p>${sanitizeHTML(options.errorMessage || 'Nastala neočekávaná chyba.').replace(/[.,!?;:]/g, '')}</p></div>`; if (options.errorMessage && !document.getElementById('global-error')?.offsetParent) { showError(options.errorMessage, true); } break; case 'initial': chatHTML = '<div class="empty-state"><i class="fas fa-cog fa-spin"></i><h3>Inicializace...</h3></div>'; break; case 'loadingTopic': chatHTML = '<div class="empty-state"><i class="fas fa-book-open fa-spin"></i><p>Načítám téma...</p></div>'; break; default: chatHTML = ''; } if (chatHTML) ui.chatMessages.innerHTML = chatHTML; } else if (isLearningActive && !hasMessages && ui.chatMessages.querySelector('.empty-state')) { ui.chatMessages.innerHTML = ''; console.log("[UI State] Removed chat placeholder as learning started."); } }
    if (ui.whiteboardContent) { const existingPlaceholder = ui.whiteboardContent.querySelector('.initial-load-placeholder, .empty-state'); const hasChunks = ui.whiteboardContent.querySelector('.whiteboard-chunk'); if (isEmptyState) { ui.whiteboardContent.innerHTML = ''; let boardHTML = ''; switch (mode) { case 'loadingTopic': boardHTML = '<div class="empty-state initial-load-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Načítám první lekci...</p></div>'; break; case 'error': boardHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba Tabule</h3><p>${sanitizeHTML(options.errorMessage || 'Obsah nelze zobrazit').replace(/[.,!?;:]/g, '')}</p></div>`; break; case 'noPlan': case 'planComplete': case 'loggedOut': boardHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule</h3><p>Vyberte téma pro zahájení výuky.</p></div>`; break; case 'initial': boardHTML = `<div class='empty-state'><i class='fas fa-spinner fa-spin'></i><h3>Inicializace Tabule...</h3></div>`; break; default: boardHTML = ''; } if (boardHTML) ui.whiteboardContent.innerHTML = boardHTML; } else if (isLearningActive && existingPlaceholder && !hasChunks) { if (!existingPlaceholder.textContent.includes("připravena")) { ui.whiteboardContent.innerHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule připravena</h3></div>`; } } else if (isLearningActive && existingPlaceholder && hasChunks) { existingPlaceholder.remove(); console.log("[UI State] Removed whiteboard placeholder as content received."); } }
    manageButtonStates();
}

/** Обработчик клика для динамических TTS кнопок (делегирование). */
function handleDynamicTTSClick(event) {
    const button = event.target.closest('.tts-listen-btn');
    if (button && button.dataset.textToSpeak && !button.disabled) {
        const textToSpeak = button.dataset.textToSpeak;
        const chunkElement = button.closest('.whiteboard-chunk, .chat-message');
        speakText(textToSpeak, chunkElement);
    }
}

// --- Обработчики Действий ---

/** Vykreslí Markdown na tabuli (používá appendToWhiteboard, který volá MathJax). */
async function renderBoardAndMath(markdown, tts) {
     appendToWhiteboard(markdown, tts); // appendToWhiteboard nyní řeší MathJax
 }

/**
 * Обрабатывает отправку сообщения из чата.
 * Verze 3.9.5: Opravena logika aiIsWaitingForAnswer.
 */
async function handleSendMessage() {
    if (!state.currentUser || !state.currentProfile) { showError("Nelze odeslat zprávu, chybí data uživatele.", false); return; }
    const text = ui.chatInput?.value.trim();
    if (!text) return;
    console.log("[ACTION] handleSendMessage triggered with text:", text);
    const affirmativeResponses = ['ano', 'jo', 'ok', 'dobře', 'dobre', 'souhlasim', 'potvrdit', 'uzavrit', 'dokoncit', 'jiste', 'jistě'];
    const negativeResponses = ['ne', 'nechci', 'stop', 'nemyslim', 'nesouhlasim', 'zrusit', 'neukoncovat'];
    const forceCompleteKeywords = ['ukonci', 'dokonci', 'zavri', 'konec', 'skonci', 'hotovo', 'заверши', 'укончи', 'конец', 'стоп'];
    if (!state.aiProposedCompletion && text) { const lowerText = text.toLowerCase(); if (forceCompleteKeywords.some(keyword => lowerText.includes(keyword))) { console.warn("[ACTION] User attempted to force topic completion"); if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); } state.geminiIsThinking = true; addThinkingIndicator(); manageButtonStates(); let domChanged = true; try { const prompt = `Student se pokusil ukončit téma "${state.currentTopic?.name || 'toto'}". Vysvětli na TABULI stručně, že téma ukončuje AI až po důkladném probrání a ověření znalostí, a že student má pokračovat v učení nebo požádat o další krok. Do CHATU napiš pouze "Info".`; const response = await sendToGemini(prompt, true); if (response.success && response.data) { if (response.data.boardMarkdown) { await renderBoardAndMath(response.data.boardMarkdown, response.data.ttsCommentary); domChanged = true; } if (response.data.chatText) { await addChatMessage(response.data.chatText, 'gemini', false, new Date(), response.data.ttsCommentary); domChanged = true; } else await addChatMessage("Info", 'gemini', false); } else { await addChatMessage("Chyba", 'gemini', false); domChanged = true; } } catch (e) { await addChatMessage("Chyba", 'gemini', false); domChanged = true; } finally { removeThinkingIndicator(); state.geminiIsThinking = false; state.aiIsWaitingForAnswer = false; manageButtonStates(); if (domChanged) initTooltips(); } return; } }
    if (state.aiProposedCompletion && text) { const lowerText = text.toLowerCase().replace(/[.,!?]/g, ''); if (affirmativeResponses.includes(lowerText)) { console.log("[AI Action] User confirmed topic completion via chat"); const confirmationText = ui.chatInput?.value; if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); } await addChatMessage(confirmationText, 'user'); state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false; manageButtonStates(); await completeTopicFlow(); return; } else if (negativeResponses.includes(lowerText)) { console.log("[AI Action] User rejected topic completion via chat"); const rejectionText = ui.chatInput?.value; if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); } await addChatMessage(rejectionText, 'user'); state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false; state.geminiIsThinking = true; addThinkingIndicator(); manageButtonStates(); let domChanged = true; try { const prompt = `Student odmítl ukončení tématu "${state.currentTopic?.name || 'toto'}". Pokračuj ve výkladu další logickou částí nebo zadej další úkol na TABULI. Do CHATU napiš pouze "Pokracujeme".`; const response = await sendToGemini(prompt, true); if (response.success && response.data) { if (response.data.boardMarkdown) { await renderBoardAndMath(response.data.boardMarkdown, response.data.ttsCommentary); domChanged = true; } if (response.data.chatText) { await addChatMessage(response.data.chatText, 'gemini', false, new Date(), response.data.ttsCommentary); domChanged = true; } else await addChatMessage("Pokracujeme", 'gemini', false); } else { await addChatMessage("Chyba", 'gemini', false); domChanged = true; } } catch(e) { await addChatMessage("Chyba", 'gemini', false); domChanged = true; } finally { removeThinkingIndicator(); state.geminiIsThinking = false; state.aiIsWaitingForAnswer = false; manageUIState('learning'); manageButtonStates(); if (domChanged) initTooltips(); } return; } state.aiProposedCompletion = false; console.log("[State Change] User response is not direct yes/no to completion proposal. Resetting aiProposedCompletion and proceeding."); }
    const isBusyProcessing = state.geminiIsThinking || state.topicLoadInProgress || state.isLoading.points; const isBusyUI = state.isListening || state.isSpeakingTTS; const canSendNow = state.currentTopic && !isBusyProcessing && !isBusyUI && !state.aiProposedCompletion; const inputHasTextNow = ui.chatInput?.value.trim().length > 0; console.log(`[ACTION] handleSendMessage Check: canSendNow=${canSendNow}, inputHasTextNow=${inputHasTextNow}`); if (!canSendNow || !inputHasTextNow) { if (!canSendNow) { if (state.geminiIsThinking) showToast('Počkejte prosím', 'AI zpracovává předchozí požadavek.', 'warning'); else if(state.isSpeakingTTS) showToast('Počkejte prosím', 'AI právě mluví.', 'warning'); else if(state.isListening) showToast('Počkejte prosím', 'Probíhá hlasový vstup.', 'warning'); else if(state.aiProposedCompletion) showToast('Počkejte prosím', 'Odpovězte na návrh AI (Ano/Ne).', 'warning'); else showToast('Počkejte prosím', 'Systém je zaneprázdněn.', 'warning'); } return; }
    const inputBeforeSend = ui.chatInput?.value; if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }
    let domChangedInTry = false;
    try {
        await addChatMessage(text, 'user'); domChangedInTry = true;
        state.geminiChatContext.push({ role: "user", parts: [{ text }] });
        console.log("[ACTION] handleSendMessage Setting isThinking=true, aiWaiting=false, proposing=false");
        state.geminiIsThinking = true; state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
        addThinkingIndicator(); domChangedInTry = true;
        manageButtonStates();
        console.log("[ACTION] handleSendMessage Calling sendToGemini (isChatInteraction=true)");
        const response = await sendToGemini(text, true);
        console.log("[ACTION] handleSendMessage Gemini response received:", response);
        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data; const completionMarker = "[PROPOSE_COMPLETION]"; let finalChatText = chatText; let proposedCompletion = false;
             if (finalChatText && finalChatText.includes(completionMarker)) { finalChatText = finalChatText.replace(completionMarker, "").trim(); proposedCompletion = true; console.log("[AI Action] AI proposed topic completion in response."); }
            if (boardMarkdown) { const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state'); if (placeholder) placeholder.remove(); await renderBoardAndMath(boardMarkdown, ttsCommentary || boardMarkdown); domChangedInTry = true; }
            else { console.warn("Gemini response has no board content for chat interaction."); if(ttsCommentary && !finalChatText) { await addChatMessage(ttsCommentary, 'gemini', true, new Date(), ttsCommentary); domChangedInTry = true; } }
            if (finalChatText) { await addChatMessage(finalChatText, 'gemini', false, new Date(), ttsCommentary); domChangedInTry = true; }
            if (ttsCommentary && boardMarkdown) { speakText(ttsCommentary, ui.whiteboardContent?.lastElementChild); }
            // **OPRAVA: Nastavení aiIsWaitingForAnswer**
            state.aiProposedCompletion = proposedCompletion;
            if (proposedCompletion) { showToast("Návrh AI", "AI navrhuje ukončení tématu. Odpovězte Ano/Ne.", "info", 6000); state.aiIsWaitingForAnswer = true; console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true (waiting for completion confirmation)."); }
            else { state.aiIsWaitingForAnswer = false; console.log("[STATE CHANGE] aiIsWaitingForAnswer set to FALSE (after normal AI response)."); }
            if (domChangedInTry) { initTooltips(); }
        } else { console.error("Error response from Gemini:", response.error); const errorMsg = (response.error || "Neznámá chyba AI").replace(/[.,!?;:]/g, ''); await addChatMessage(`Chyba: ${errorMsg}`, 'gemini', false); domChangedInTry = true; state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false; console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (Gemini error).`); if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); } if (domChangedInTry) initTooltips(); }
    } catch (error) { console.error("Error in handleSendMessage catch block:", error); const errorMsg = `Chyba odesílání zprávy: ${error.message}`.replace(/[.,!?;:]/g, ''); showError(errorMsg, false); await addChatMessage("Chyba systému.", 'gemini', false); domChangedInTry = true; state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false; console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (exception).`); if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); } if (domChangedInTry) initTooltips();
    } finally {
         console.log("[ACTION] handleSendMessage Entering finally block."); const indicatorRemoved = removeThinkingIndicator(); domChangedInTry = domChangedInTry || indicatorRemoved; console.log("[ACTION] handleSendMessage Setting isThinking=false in finally."); state.geminiIsThinking = false; setLoadingState('chat', false);
         let nextUiState = state.aiProposedCompletion ? 'aiProposingCompletion' : 'learning'; manageUIState(nextUiState); manageButtonStates(); if (domChangedInTry) initTooltips(); console.log("[ACTION] handleSendMessage Exiting finally block.");
    }
}

/** Zpracuje požadavek na pokračování ve výkladu (kliknutí na "Pokračuj"). */
async function requestContinue() {
    console.log("[ACTION] requestContinue triggered");
    const isBusyProcessing = state.geminiIsThinking || state.topicLoadInProgress || state.isLoading.points; const isBusyUI = state.isListening || state.isSpeakingTTS; const canContinueNow = state.currentTopic && !state.aiProposedCompletion && !isBusyProcessing && !isBusyUI;
    if (!canContinueNow) { console.warn(`Cannot request continue: thinking=${state.geminiIsThinking}, loadingTopic=${state.topicLoadInProgress}, listening=${state.isListening}, speaking=${state.isSpeakingTTS}, proposing=${state.aiProposedCompletion}`); let reason = 'Systém je zaneprázdněn'; if(state.isSpeakingTTS) reason = 'AI právě mluví.'; if(state.isListening) reason = 'Probíhá hlasový vstup.'; showToast('Nelze pokračovat', reason, 'warning'); return; }
    let domChangedInTry = false;
    try {
        console.log("[ACTION] requestContinue: Setting isThinking=true, aiWaiting=false, proposing=false");
        state.geminiIsThinking = true; state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
        addThinkingIndicator(); domChangedInTry = true;
        manageButtonStates();
        const prompt = `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}" na úrovni Přijímaček. Naváž na PŘEDCHOZÍ OBSAH TABULE. Připrav další logickou část výkladu nebo komplexnější příklad na TABULI. Do CHATU napiš pouze "Na tabuli".`;
        console.log("[ACTION] requestContinue: Calling sendToGemini (isChatInteraction=false)");
        const response = await sendToGemini(prompt, false);
        console.log("[ACTION] requestContinue: Gemini response received:", response);
        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data; const completionMarker = "[PROPOSE_COMPLETION]"; let finalChatText = chatText; let proposedCompletion = false;
             if (finalChatText && finalChatText.includes(completionMarker)) { finalChatText = finalChatText.replace(completionMarker, "").trim(); proposedCompletion = true; console.log("[AI Action] AI proposed topic completion in response."); }
            if (boardMarkdown) { const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state'); if (placeholder) placeholder.remove(); await renderBoardAndMath(boardMarkdown, ttsCommentary || boardMarkdown); domChangedInTry = true; }
            else { console.error("Gemini did not return board content for 'continue' request."); await addChatMessage("Chyba: AI neposkytlo žádný obsah pro tabuli.", 'gemini', false); domChangedInTry = true; }
            if (finalChatText) { await addChatMessage(finalChatText, 'gemini', false, new Date(), ttsCommentary); domChangedInTry = true; }
            else if (boardMarkdown) { await addChatMessage("Na tabuli", 'gemini', false); domChangedInTry = true; }
            if (ttsCommentary && boardMarkdown) { speakText(ttsCommentary, ui.whiteboardContent?.lastElementChild); }
            // **OPRAVA: Nastavení aiIsWaitingForAnswer**
            state.aiProposedCompletion = proposedCompletion;
            if (proposedCompletion) { showToast("Návrh AI", "AI navrhuje ukončení tématu. Odpovězte Ano/Ne.", "info", 6000); state.aiIsWaitingForAnswer = true; console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true (waiting for completion confirmation)."); }
            else { state.aiIsWaitingForAnswer = false; console.log("[STATE CHANGE] aiIsWaitingForAnswer set to FALSE (after 'continue' action)."); }
            if (domChangedInTry) { initTooltips(); }
        } else { console.error("Error response from Gemini (continue):", response.error); const errorMsg = (response.error || "Neznámá chyba AI").replace(/[.,!?;:]/g, ''); await addChatMessage(`Chyba: ${errorMsg}`, 'gemini', false); domChangedInTry = true; state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false; console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (Gemini error during continue).`); if (domChangedInTry) initTooltips(); }
    } catch (error) { console.error("Error in requestContinue catch block:", error); const errorMsg = `Chyba při pokračování: ${error.message}`.replace(/[.,!?;:]/g, ''); showError(errorMsg, false); await addChatMessage("Chyba systému.", 'gemini', false); domChangedInTry = true; state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false; console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (exception during continue).`); if (domChangedInTry) initTooltips();
    } finally {
         console.log("[ACTION] requestContinue: Entering finally block."); const indicatorRemoved = removeThinkingIndicator(); domChangedInTry = domChangedInTry || indicatorRemoved; console.log("[ACTION] requestContinue: Setting isThinking=false in finally."); state.geminiIsThinking = false; setLoadingState('chat', false);
         let nextUiState = state.aiProposedCompletion ? 'aiProposingCompletion' : 'learning'; manageUIState(nextUiState); manageButtonStates(); if (domChangedInTry) initTooltips(); console.log("[ACTION] requestContinue: Exiting finally block.");
    }
}

/** Запускает сессию обучения для текущей темы. */
async function startLearningSession() {
     if (!state.currentTopic) { console.error("[ACTION] startLearningSession: No current topic defined."); manageUIState('error', {errorMessage: 'Chyba: Téma není definováno.'}); return; }
     console.log("[ACTION] startLearningSession triggered for topic:", state.currentTopic.name);
     state.currentSessionId = generateSessionId(); state.geminiChatContext = []; state.boardContentHistory = []; if (ui.chatMessages) ui.chatMessages.innerHTML = ''; if (ui.whiteboardContent) ui.whiteboardContent.innerHTML = ''; state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
    console.log("[ACTION] startLearningSession: Setting isThinking=true, aiWaiting=false, proposing=false");
    state.geminiIsThinking = true;
    manageUIState('requestingExplanation');
    addThinkingIndicator(); let domChangedInTry = true;
    manageButtonStates();
    const prompt = `Vysvětli ZÁKLADY tématu "${state.currentTopic.name}" na úrovni Přijímaček. Začni PRVNÍ částí výkladu na TABULI. Do CHATU napiš pouze "Téma zahájeno.".`;
    try {
        console.log("[ACTION] startLearningSession: Calling sendToGemini (isChatInteraction=false)");
        const response = await sendToGemini(prompt, false);
        console.log("[ACTION] startLearningSession: Gemini response received:", response);
        if (response.success && response.data && response.data.boardMarkdown) { const boardPlaceholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state'); if (boardPlaceholder) { boardPlaceholder.remove(); console.log("Initial whiteboard placeholder removed."); } const chatPlaceholder = ui.chatMessages?.querySelector('.empty-state, .initial-load-placeholder'); if (chatPlaceholder) { chatPlaceholder.remove(); console.log("Initial chat placeholder removed.");} } else if (response.success && response.data && !response.data.boardMarkdown) { const boardPlaceholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state'); if(boardPlaceholder) boardPlaceholder.innerHTML = `<i class='fas fa-chalkboard'></i><h3>Tabule prázdná</h3><p>AI neposkytlo úvodní obsah.</p>`; const chatPlaceholder = ui.chatMessages?.querySelector('.empty-state, .initial-load-placeholder'); if(chatPlaceholder) chatPlaceholder.innerHTML = `<i class='fas fa-comments'></i><h3>Chat</h3><p>AI neposkytlo úvodní obsah.</p>`; }
        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data; const completionMarker = "[PROPOSE_COMPLETION]"; let finalChatText = chatText; let proposedCompletion = false;
             if (finalChatText && finalChatText.includes(completionMarker)) { finalChatText = finalChatText.replace(completionMarker, "").trim(); proposedCompletion = true; console.log("[AI Action] AI proposed topic completion unexpectedly in initial response."); }
            if (boardMarkdown) { await renderBoardAndMath(boardMarkdown, ttsCommentary || boardMarkdown); domChangedInTry = true; }
            else { console.error("Gemini initial response missing board content."); await addChatMessage("Chyba: AI neposkytlo úvodní obsah.", 'gemini', false); domChangedInTry = true; }
            if (finalChatText) { await addChatMessage(finalChatText, 'gemini', false, new Date(), ttsCommentary); domChangedInTry = true; }
            else if (boardMarkdown) { await addChatMessage("Téma zahájeno.", 'gemini', false); domChangedInTry = true; } // Fallback, pokud Gemini nedodá chat text
            if (ttsCommentary && boardMarkdown) { speakText(ttsCommentary, ui.whiteboardContent?.lastElementChild); }
            // **OPRAVA: Nastavení aiIsWaitingForAnswer**
            state.aiProposedCompletion = proposedCompletion;
            if (proposedCompletion) { showToast("Návrh AI", "AI navrhuje ukončení tématu. Odpovězte Ano/Ne.", "info", 6000); state.aiIsWaitingForAnswer = true; console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true (waiting for completion confirmation)."); }
            else { state.aiIsWaitingForAnswer = false; console.log("[STATE CHANGE] aiIsWaitingForAnswer set to FALSE (after initial explanation)."); }
            if (domChangedInTry) { initTooltips(); }
        } else { console.error("Error response from Gemini (start session):", response.error); const errorMsg = (response.error || "Neznámá chyba AI").replace(/[.,!?;:]/g, ''); await addChatMessage(`Chyba: ${errorMsg}`, 'gemini', false); domChangedInTry = true; if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba načítání</h3><p>Nepodařilo se získat úvodní obsah od AI.</p></div>`; } state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false; console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (Gemini error during start).`); showError(`Chyba AI při startu: ${errorMsg}`, false); if (domChangedInTry) initTooltips(); }
    } catch(error) { console.error("Error in startLearningSession catch block:", error); const errorMsg = `Chyba zahájení výkladu: ${error.message}`.replace(/[.,!?;:]/g, ''); showError(errorMsg, false); if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba systému</h3></div>`; } await addChatMessage("Chyba systému při startu.", 'gemini', false); domChangedInTry = true; state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false; console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (exception during start).`); if (domChangedInTry) initTooltips();
    } finally {
         console.log("[ACTION] startLearningSession: Entering finally block."); const indicatorRemoved = removeThinkingIndicator(); domChangedInTry = domChangedInTry || indicatorRemoved; console.log("[ACTION] startLearningSession: Setting isThinking=false in finally."); state.geminiIsThinking = false; setLoadingState('chat', false);
         let nextUiState = state.aiProposedCompletion ? 'aiProposingCompletion' : 'learning'; manageUIState(nextUiState); manageButtonStates(); if (domChangedInTry) initTooltips(); console.log("[ACTION] startLearningSession: Exiting finally block.");
    }
}

/** Поток действий при подтверждении завершения темы пользователем. */
async function completeTopicFlow() {
    if (!state.currentTopic || !state.currentUser) { console.error("[Flow] Cannot complete topic: missing topic or user data."); showToast("Chyba", "Nelze dokončit téma, chybí potřebná data.", "error"); return; }
    if (state.isLoading.points || state.topicLoadInProgress) { console.warn("[Flow] Completion already in progress or points being loaded."); return; }
    console.log(`[Flow] Starting topic completion flow for activity: ${state.currentTopic.activity_id}`);
    setLoadingState('points', true); state.topicLoadInProgress = true; manageButtonStates();
    try {
        console.log(`[Flow] Calling markTopicComplete for activity ${state.currentTopic.activity_id}`);
        const successMark = await markTopicComplete(state.currentTopic.activity_id, state.currentUser.id);
        if (!successMark) { throw new Error("Nepodařilo se označit téma jako dokončené v databázi."); }
        console.log(`[Flow] Topic marked complete in DB.`);
        console.log(`[Flow] --> Calling awardPoints for userId ${state.currentUser.id} (Points: ${POINTS_TOPIC_COMPLETE})`);
        const pointsAwarded = await awardPoints(state.currentUser.id, POINTS_TOPIC_COMPLETE);
        setLoadingState('points', false);
        if (pointsAwarded) { showToast('BODY PŘIPSÁNY', `${POINTS_TOPIC_COMPLETE} kreditů získáno!`, 'success', 3500); if (state.currentProfile) { updateUserInfoUI(); } }
        else { showToast('CHYBA BODŮ', 'Téma dokončeno, ale body se nepodařilo připsat. Zkontrolujte konzoli.', 'warning', 5000); }
        showToast('Téma dokončeno', `Téma "${state.currentTopic.name}" bylo úspěšně uzavřeno.`, "success", 4000);
        await addChatMessage("Téma uzavřeno.", 'gemini', false);
        console.log("[Flow] Redirecting to /dashboard/procvicovani/main.html in 3 seconds...");
        showToast("Přesměrování", "Za chvíli budete přesměrováni zpět.", "info", 3000);
        setTimeout(() => { window.location.href = '/dashboard/procvicovani/main.html'; }, 3000);
    } catch (error) { console.error("[Flow] Error in completeTopicFlow:", error); const errorMsg = `Nepodařilo se dokončit téma: ${error.message}`.replace(/[.,!?;:]/g, ''); showToast("Chyba dokončení", errorMsg, "error"); state.topicLoadInProgress = false; setLoadingState('points', false); manageButtonStates(); }
}

/** Поток действий для загрузки следующей темы. */
async function loadNextTopicFlow() {
     if (!state.currentUser) { console.log(`[Flow] Load next topic skipped: No user.`); return; }
     if (state.topicLoadInProgress) { console.log(`[Flow] Load next topic skipped: Already in progress.`); return; }
     console.log("[Flow] Loading next topic flow: STARTED. Setting topicLoadInProgress=true");
     state.topicLoadInProgress = true; setLoadingState('currentTopic', true);
     state.currentTopic = null; state.geminiChatContext = []; state.boardContentHistory = [];
     state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
     console.log("[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false by loadNextTopicFlow start.");
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
            console.log("[Flow] Topic loaded successfully. Resetting topicLoadInProgress=false. Starting learning session...");
            state.topicLoadInProgress = false; setLoadingState('currentTopic', false);
            await startLearningSession();
        } else {
            state.currentTopic = null; const message = (result.message || 'Není další téma nebo nastala chyba.').replace(/[.,!?;:]/g, '');
            if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(${sanitizeHTML(message)})</span>`;
            console.log(`[Flow] No topic loaded or error. Reason: ${result.reason}. Resetting topicLoadInProgress=false.`);
            state.topicLoadInProgress = false; setLoadingState('currentTopic', false);
            manageUIState(result.reason || 'error', { errorMessage: message });
        }
    } catch(error) {
        console.error("Error in loadNextTopicFlow execution:", error); state.currentTopic = null; const errorMsg = `Chyba při načítání dalšího tématu: ${error.message}`.replace(/[.,!?;:]/g, ''); if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(Chyba načítání)</span>`; console.log("[Flow] Exception loading topic. Resetting topicLoadInProgress=false."); state.topicLoadInProgress = false; setLoadingState('currentTopic', false); manageUIState('error', { errorMessage: errorMsg });
    } finally {
        if (state.topicLoadInProgress) { console.warn("[Flow] topicLoadInProgress was still true in finally block. Resetting."); state.topicLoadInProgress = false; }
        if (state.isLoading.currentTopic) { console.warn("[Flow] isLoading.currentTopic was still true in finally block. Resetting."); setLoadingState('currentTopic', false); }
        manageButtonStates();
        initTooltips();
    }
    console.log("[Flow] Loading next topic flow: FINISHED.");
}

// --- Запуск Приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);