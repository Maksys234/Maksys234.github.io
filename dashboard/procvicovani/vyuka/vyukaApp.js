// vyukaApp.js - Основной файл приложения Vyuka
// Версия с обработкой AI-предложения о завершении и улучшенным логгингом баллов

// --- Импорт Модулей ---
import { MAX_GEMINI_HISTORY_TURNS, NOTIFICATION_FETCH_LIMIT, POINTS_TOPIC_COMPLETE } from './config.js';
import { state } from './state.js'; // Включает state.aiProposedCompletion
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

const activityVisuals = { // Иконки для уведомлений (остаются без изменений)
    test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' },
    diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' },
    level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, vyuka_start: { icon: 'fa-chalkboard-teacher', class: 'lesson'}, vyuka_complete: { icon: 'fa-flag-checkered', class: 'test'},
    achievement: { icon: 'fa-trophy', class: 'badge'}, info: { icon: 'fa-info-circle', class: 'info' }, warning: { icon: 'fa-exclamation-triangle', class: 'warning' },
    error: { icon: 'fa-exclamation-circle', class: 'danger' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' }
};

/** Главная функция инициализации приложения. */
async function initializeApp() {
    console.log("🚀 [Init Vyuka] Starting App Initialization...");
    let initializationError = null;
    if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
    if (ui.mainContent) ui.mainContent.style.display = 'none';
    hideError();

    try {
        // 1. Инициализация Supabase
        const supabaseInitialized = initializeSupabase();
        if (!supabaseInitialized) throw new Error("Kritická chyba: Nepodařilo se připojit k databázi.");
        state.supabase = supabaseInitialized;
        console.log("[INIT] Supabase Initialized.");

        // 2. Проверка сессии пользователя
        console.log("[INIT] Checking auth session...");
        const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
        if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);
        if (!session || !session.user) {
            console.log('[INIT] Not logged in. Redirecting...');
            window.location.href = '/auth/index.html';
            return;
        }
        state.currentUser = session.user;
        console.log(`[INIT] User authenticated (ID: ${state.currentUser.id}). Fetching profile...`);

        // 3. Загрузка профиля пользователя
        setLoadingState('user', true);
        state.currentProfile = await fetchUserProfile(state.currentUser.id);
        setLoadingState('user', false);
        if (!state.currentProfile) {
            console.warn(`Profile not found for user ${state.currentUser.id}. Displaying error state.`);
            initializationError = new Error("Profil nenalezen nebo se nepodařilo načíst. Zkuste obnovit stránku.");
            try { initializeUI(); updateUserInfoUI(); }
            catch (uiError) { console.error("UI Init failed during profile error:", uiError); }
            manageUIState('error', { errorMessage: initializationError.message });
        } else {
            console.log("[INIT] Profile fetched successfully.");
        }

        // 4. Инициализация базового UI
        console.log("[INIT] Initializing base UI...");
        initializeUI();
        updateUserInfoUI();

        // 5. Загрузка начальных данных (тема, уведомления) - только если профиль загружен
        if (state.currentProfile && !initializationError) {
            console.log("[INIT] Loading initial topic and notifications...");
            setLoadingState('currentTopic', true);
            setLoadingState('notifications', true);

            const loadNotificationsPromise = fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
                .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                .catch(err => {
                    console.error("Chyba při úvodním načítání notifikací:", err);
                    renderNotifications(0, []);
                    showToast('Chyba Notifikací', 'Nepodařilo se načíst signály.', 'error');
                })
                .finally(() => {
                    setLoadingState('notifications', false);
                    manageButtonStates();
                });

            const loadTopicPromise = loadNextTopicFlow()
                .catch(err => {
                    console.error("Chyba při načítání úvodního tématu:", err);
                    manageUIState('error', { errorMessage: `Chyba načítání tématu: ${err.message}` });
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
        console.error("❌ [Init Vyuka] Critical initialization error:", error);
        initializationError = error;
        if (!document.getElementById('main-mobile-menu-toggle')) {
            try { initializeUI(); }
            catch (uiError) { console.error("Failed to initialize UI during critical error handling:", uiError); }
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
        manageButtonStates();
        console.log("✅ [Init Vyuka] App Initialization Finished (finally block).");
    }
}

/** Инициализация базового UI и обработчиков. */
function initializeUI() {
    console.log("[UI Init] Initializing UI elements and handlers...");
    try {
        updateTheme();
        setupEventListeners();
        initTooltips();
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
        showError(`Chyba inicializace UI: ${error.message}`, false);
    }
}

/** Настройка основных обработчиков событий. */
function setupEventListeners() {
    console.log("[SETUP] Setting up event listeners...");
    let listenersAttached = 0;

    function addListener(element, event, handler, elementName) {
        if (element) {
            element.addEventListener(event, handler);
            listenersAttached++;
        } else {
            console.warn(`[SETUP] Element '${elementName}' not found. Listener not attached.`);
        }
    }

    // Основные элементы управления
    addListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
    addListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
    addListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');

    // Чат
    addListener(ui.chatInput, 'input', () => autoResizeTextarea(ui.chatInput), 'chatInput (input)');
    addListener(ui.sendButton, 'click', handleSendMessage, 'sendButton');
    addListener(ui.chatInput, 'keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }, 'chatInput (keypress)');
    addListener(ui.clearChatBtn, 'click', () => confirmClearChat(), 'clearChatBtn');
    addListener(ui.saveChatBtn, 'click', saveChatToPDF, 'saveChatBtn');
    addListener(ui.micBtn, 'click', handleMicClick, 'micBtn');

    // Доска и TTS
    addListener(ui.clearBoardBtn, 'click', () => {
        clearWhiteboard(false);
        showToast('Vymazáno', "Tabule vymazána.", "info");
    }, 'clearBoardBtn');
    addListener(ui.stopSpeechBtn, 'click', stopSpeech, 'stopSpeechBtn');

    // Управление темой
    addListener(ui.continueBtn, 'click', requestContinue, 'continueBtn');
    addListener(ui.markCompleteBtn, 'click', handleMarkTopicCompleteFlow, 'markCompleteBtn');

    // Динамические TTS кнопки (делегирование событий)
    addListener(ui.chatMessages, 'click', handleDynamicTTSClick, 'chatMessages (TTS Delegation)');
    addListener(ui.whiteboardContent, 'click', handleDynamicTTSClick, 'whiteboardContent (TTS Delegation)');

    // Системные события
    const darkModeMatcher = window.matchMedia('(prefers-color-scheme: dark)');
    if (darkModeMatcher && typeof darkModeMatcher.addEventListener === 'function') {
        darkModeMatcher.addEventListener('change', event => {
            state.isDarkMode = event.matches;
            updateTheme();
        });
        listenersAttached++;
    } else {
        console.warn("[SETUP] Cannot add theme change listener.");
    }
    window.addEventListener('resize', () => {
        if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) { closeMenu(); }
    }); listenersAttached++;
    window.addEventListener('online', updateOnlineStatus); listenersAttached++;
    window.addEventListener('offline', updateOnlineStatus); listenersAttached++;

    // Уведомления
    addListener(ui.notificationBell, 'click', (event) => {
        event.stopPropagation();
        ui.notificationsDropdown?.classList.toggle('active');
    }, 'notificationBell');

    addListener(ui.markAllReadBtn, 'click', async () => {
        // Логика без изменений
        if (state.isLoading.notifications || !state.currentUser) return;
        setLoadingState('notifications', true); manageButtonStates();
        try {
            const success = await markAllNotificationsRead(state.currentUser.id);
            if(success) {
                const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT);
                renderNotifications(unreadCount, notifications);
                showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení označena.', 'success');
            } else { showToast('CHYBA PŘENOSU', 'Nepodařilo se označit oznámení.', 'error'); }
        } catch (err) { console.error("Error marking all notifications read:", err); showToast('CHYBA SYSTÉMU', 'Při označování nastala chyba.', 'error');
        } finally { setLoadingState('notifications', false); manageButtonStates(); }
    }, 'markAllReadBtn');

    addListener(ui.notificationsList, 'click', async (event) => {
        // Логика без изменений
        const item = event.target.closest('.notification-item');
        if (item && !state.isLoading.notifications && state.currentUser) {
            const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read');
            if (!isRead && notificationId) {
                item.style.opacity = '0.5';
                const success = await markNotificationRead(notificationId, state.currentUser.id);
                item.style.opacity = '';
                if (success) {
                    item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove();
                    const countEl = ui.notificationCount;
                    if (countEl) {
                        const currentCount = parseInt(countEl.textContent.replace('+', '') || '0'); const newCount = Math.max(0, currentCount - 1);
                        countEl.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); countEl.classList.toggle('visible', newCount > 0);
                    }
                    manageButtonStates();
                } else { showToast('Chyba', 'Nepodařilo se označit oznámení.', 'error'); }
            }
            if (link) { ui.notificationsDropdown?.classList.remove('active'); window.location.href = link; }
        }
    }, 'notificationsList');

    document.addEventListener('click', (event) => {
        if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) {
            ui.notificationsDropdown.classList.remove('active');
        }
    }); listenersAttached++;

    console.log(`[SETUP] Event listeners setup complete. Total attached (approx): ${listenersAttached}`);
}

// --- Обновление UI ---

/** Обновляет информацию о пользователе в UI (сайдбар). */
function updateUserInfoUI() {
    // Логика без изменений
    if (!ui.sidebarName || !ui.sidebarAvatar) { console.warn("updateUserInfoUI: Sidebar elements not found."); return; }
    if (state.currentUser && state.currentProfile) {
        const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot';
        ui.sidebarName.textContent = sanitizeHTML(displayName);
        const initials = getInitials(state.currentProfile, state.currentUser.email);
        const avatarUrl = state.currentProfile.avatar_url; let finalUrl = avatarUrl;
        if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('//') && !avatarUrl.startsWith('data:')) { finalUrl = null; console.warn("Invalid avatar URL:", avatarUrl); }
        else if (avatarUrl) { finalUrl = sanitizeHTML(avatarUrl); }
        ui.sidebarAvatar.innerHTML = finalUrl ? `<img src="${finalUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
        const sidebarImg = ui.sidebarAvatar.querySelector('img');
        if (sidebarImg) { sidebarImg.onerror = function() { console.warn(`Failed to load avatar: ${this.src}`); ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; }
    } else { ui.sidebarName.textContent = 'Nepřihlášen'; ui.sidebarAvatar.textContent = '?'; }
}

/** Отображает уведомления в выпадающем списке. */
 function renderNotifications(count, notifications) {
    // Логика без изменений
    console.log("[Render Notifications] Count:", count, "Notifications:", notifications ? notifications.length : 0);
    if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements."); return; }
    ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0);
    if (notifications && notifications.length > 0) {
        ui.notificationsList.innerHTML = notifications.map(n => {
            const visual = activityVisuals[(n.type || 'default').toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; const title = n.title || 'Nové oznámení'; const message = n.message || ''; const timeAgo = formatRelativeTime(n.created_at);
            return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
                        ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
                        <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div>
                        <div class="notification-content"><div class="notification-title">${sanitizeHTML(title)}</div><div class="notification-message">${sanitizeHTML(message)}</div><div class="notification-time">${timeAgo}</div></div>
                    </div>`;
        }).join('');
        ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.add('has-content');
    } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.remove('has-content'); }
    const currentUnreadCount = parseInt(ui.notificationCount.textContent.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentUnreadCount === 0 || state.isLoading.notifications;
    console.log("[Render Notifications] Finished rendering.");
 }

/** Управляет общим состоянием интерфейса (что отображается). */
function manageUIState(mode, options = {}) {
    // Добавляем новый режим 'aiProposingCompletion'
    const isLearningActive = state.currentTopic && ['learning', 'chatting', 'requestingExplanation', 'waitingForAnswer', 'aiProposingCompletion'].includes(mode);
    const isEmptyState = ['noPlan', 'planComplete', 'error', 'loggedOut', 'initial', 'loadingTopic'].includes(mode);

    // Показать/Скрыть основной интерфейс обучения
    if (ui.learningInterface) {
        const shouldShowInterface = !isEmptyState;
        ui.learningInterface.style.display = shouldShowInterface ? 'flex' : 'none';
    }

    // Обновить содержимое чата (или показать заглушку)
    if (ui.chatMessages) {
        let emptyStateHTML = '';
        if (isEmptyState || (isLearningActive && !ui.chatMessages.querySelector('.chat-message'))) {
            if (isEmptyState && ui.chatMessages.innerHTML !== '') { ui.chatMessages.innerHTML = ''; }
            else if (isLearningActive && ui.chatMessages.querySelector('.empty-state')) { ui.chatMessages.innerHTML = ''; }

            switch (mode) {
                case 'loggedOut': emptyStateHTML = `<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPŘIHLÁŠEN</h3><p>Pro přístup k výuce se prosím <a href="/auth/index.html" style="color: var(--accent-primary)">přihlaste</a>.</p></div>`; break;
                case 'noPlan': emptyStateHTML = `<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ŽÁDNÝ AKTIVNÍ PLÁN</h3><p>Nemáte aktivní studijní plán. Nejprve prosím dokončete <a href="/dashboard/procvicovani/test1.html" style="color: var(--accent-primary)">diagnostický test</a>.</p></div>`; break;
                case 'planComplete': emptyStateHTML = `<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLÁN DOKONČEN!</h3><p>Všechny naplánované aktivity jsou hotové. Skvělá práce! Můžete si <a href="/dashboard/procvicovani/plan.html" style="color: var(--accent-primary)">vytvořit nový plán</a>.</p></div>`; break;
                case 'error': emptyStateHTML = `<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA SYSTÉMU</h3><p>${sanitizeHTML(options.errorMessage || 'Nastala chyba při načítání dat.')}</p></div>`; if (options.errorMessage && !document.getElementById('global-error')?.offsetParent) { showError(options.errorMessage, true); } break;
                case 'initial': emptyStateHTML = '<div class="empty-state"><i class="fas fa-cog fa-spin"></i><h3>Inicializace...</h3></div>'; break;
                case 'loadingTopic': if (!ui.chatMessages.querySelector('.chat-message')) { emptyStateHTML = '<div class="empty-state initial-load-placeholder"><i class="fas fa-book-open" style="font-size: 2rem; margin-bottom: 1rem;"></i><p>Načítání tématu...</p></div>'; } break;
                // Обновляем заглушки для learning и waitingForAnswer
                case 'learning': if (!ui.chatMessages.querySelector('.chat-message')) { emptyStateHTML = `<div class='empty-state'><i class='fas fa-comments'></i><h3>Chat připraven</h3><p>AI vám vysvětlí téma. Můžete klást otázky nebo požádat o příklad.</p></div>`; } break;
                case 'waitingForAnswer': if (!ui.chatMessages.querySelector('.chat-message')) { emptyStateHTML = `<div class='empty-state'><i class='fas fa-question-circle'></i><h3>AI čeká na odpověď</h3><p>Odpovězte na otázku AI nebo položte vlastní dotaz.</p></div>`; } break;
                case 'aiProposingCompletion': if (!ui.chatMessages.querySelector('.chat-message')) { emptyStateHTML = `<div class='empty-state'><i class='fas fa-flag-checkered'></i><h3>Návrh na ukončení</h3><p>AI navrhuje ukončit téma. Odpovězte v chatu nebo použijte tlačítko.</p></div>`; } break;
            }
            if (emptyStateHTML) { ui.chatMessages.innerHTML = emptyStateHTML; console.log(`[UI State] Chat set to state: ${mode}`); }
        } else if (isLearningActive && ui.chatMessages.querySelector('.empty-state')) {
             ui.chatMessages.querySelector('.empty-state').remove();
             console.log("[UI State] Removed chat placeholder as learning is active and messages should appear.");
        }
    }

    // Обновить содержимое доски (или показать заглушку)
    if (ui.whiteboardContent) {
         const existingPlaceholder = ui.whiteboardContent.querySelector('.initial-load-placeholder, .empty-state');
         if (isEmptyState || (isLearningActive && !ui.whiteboardContent.querySelector('.whiteboard-chunk'))) {
            let emptyBoardHTML = '';
             if (isEmptyState && ui.whiteboardContent.innerHTML !== '') { ui.whiteboardContent.innerHTML = ''; }
             else if (isLearningActive && ui.whiteboardContent.querySelector('.empty-state')) { ui.whiteboardContent.innerHTML = ''; }

            switch (mode) {
                case 'loadingTopic': emptyBoardHTML = '<div class="empty-state initial-load-placeholder"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i><p>Načítání první lekce...</p></div>'; break;
                case 'error': emptyBoardHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba Tabule</h3><p>${sanitizeHTML(options.errorMessage || 'Obsah nelze zobrazit.')}</p></div>`; break;
                case 'noPlan': case 'planComplete': case 'loggedOut': emptyBoardHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule</h3><p>Nejprve vyberte nebo načtěte téma.</p></div>`; break;
                case 'initial': emptyBoardHTML = `<div class='empty-state'><i class='fas fa-spinner fa-spin'></i><h3>Inicializace...</h3></div>`; break;
                case 'learning': case 'waitingForAnswer': case 'aiProposingCompletion': if (!ui.whiteboardContent.querySelector('.whiteboard-chunk')) { emptyBoardHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule připravena</h3><p>Zde se bude zobrazovat vysvětlení od AI.</p></div>`; } break;
            }
            if (emptyBoardHTML) { ui.whiteboardContent.innerHTML = emptyBoardHTML; console.log(`[UI State] Whiteboard set to state: ${mode}`); }
        } else if (isLearningActive && existingPlaceholder) {
            existingPlaceholder.remove();
            console.log("[UI State] Removed whiteboard placeholder as learning is active and chunks should appear.");
        }
    }

    manageButtonStates();
}

/**
 * Управляет активностью/неактивностью кнопок на основе текущего состояния.
 */
function manageButtonStates() {
    const hasTopic = !!state.currentTopic;
    const isThinking = state.geminiIsThinking;
    const isLoadingTopic = state.topicLoadInProgress;
    const isWaitingForAnswer = state.aiIsWaitingForAnswer; // Ожидание ответа от пользователя
    const isProposingCompletion = state.aiProposedCompletion; // ИИ предложил завершение
    const isListening = state.isListening;
    const isSpeaking = state.speechSynthesisSupported && window.speechSynthesis.speaking;
    const isLoadingPoints = state.isLoading.points;
    const notificationsLoading = state.isLoading.notifications;
    const chatInputHasText = ui.chatInput?.value.trim().length > 0;
    const chatIsEmpty = !ui.chatMessages?.hasChildNodes() || !!ui.chatMessages?.querySelector('.empty-state');
    const boardIsEmpty = !ui.whiteboardContent?.hasChildNodes() || !!ui.whiteboardContent?.querySelector('.empty-state');
    const unreadNotifCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');

    // --- Комбинированные флаги ---
    const isBusyProcessing = isThinking || isLoadingTopic || isListening || isLoadingPoints;
    // Можно ли взаимодействовать (если есть тема и система не занята)? Говорение не блокирует.
    const canInteract = hasTopic && !isBusyProcessing;
    // Можно ли завершить тему? (Если есть тема, не занят ИЛИ если ИИ предложил завершение)
    const canComplete = hasTopic && (!isBusyProcessing || isProposingCompletion) && !isSpeaking; // Нельзя завершать, если ИИ говорит
     // Можно ли использовать микрофон? (Нельзя, если говорит или занят)
    const canUseMic = hasTopic && !isBusyProcessing && !isSpeaking && state.speechRecognitionSupported;

    // --- Применение состояний к кнопкам ---
    const setButtonState = (button, isDisabled, reason) => {
        if (button && button.disabled !== isDisabled) { button.disabled = isDisabled; }
    };

    // Кнопка Отправить: зависит от canInteract и наличия текста
    setButtonState(ui.sendButton, !canInteract || !chatInputHasText, `canInteract=${canInteract}, hasText=${chatInputHasText}`);
    if (ui.sendButton) ui.sendButton.innerHTML = isThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';

    // Поле ввода: зависит от canInteract
    setButtonState(ui.chatInput, !canInteract, `canInteract=${canInteract}`);
    if (ui.chatInput) {
        let placeholder = "Zeptejte se nebo odpovězte...";
        if (isListening) placeholder = "Poslouchám...";
        else if (ui.chatInput.disabled) {
             if (isThinking) placeholder = "AI přemýšlí...";
             else if (isLoadingTopic) placeholder = "Načítám téma...";
             else placeholder = "Akce není dostupná...";
        } else if (isProposingCompletion) {
            placeholder = "AI navrhuje ukončení. Odpovězte 'Ano'/'Ne' nebo pokračujte...";
        } else if (isWaitingForAnswer) {
            placeholder = "Odpovězte AI nebo položte otázku...";
        }
        ui.chatInput.placeholder = placeholder;
    }

    // Кнопка Pokracovat: зависит от canInteract, но скрыта, если ИИ ждет ответа или предлагает завершение
    const shouldShowContinue = hasTopic && !isWaitingForAnswer && !isProposingCompletion;
    setButtonState(ui.continueBtn, !canInteract || isWaitingForAnswer || isProposingCompletion, `canInteract=${canInteract}, waiting=${isWaitingForAnswer}, proposing=${isProposingCompletion}`);
    if (ui.continueBtn) ui.continueBtn.style.display = shouldShowContinue ? 'inline-flex' : 'none';

    // Кнопка Dokončit: зависит от canComplete
    setButtonState(ui.markCompleteBtn, !canComplete, `canComplete=${canComplete}`);
    if (ui.markCompleteBtn) {
        ui.markCompleteBtn.style.display = hasTopic ? 'inline-flex' : 'none';
        // Добавляем/убираем класс подсветки
        ui.markCompleteBtn.classList.toggle('suggested', isProposingCompletion);
        ui.markCompleteBtn.title = isProposingCompletion
            ? "AI navrhuje ukončit téma. Kliknutím potvrdíte."
            : "Označit aktuální téma jako probrané";
        initTooltips(); // Обновить тултипы после изменения title
    }


    // Кнопка Zastavit: зависит от isSpeaking
    setButtonState(ui.stopSpeechBtn, !isSpeaking, `isSpeaking=${isSpeaking}`);

    // Остальные кнопки
    setButtonState(ui.clearBoardBtn, boardIsEmpty || isBusyProcessing || isSpeaking, `boardEmpty=${boardIsEmpty}, isBusy=${isBusyProcessing}, isSpeaking=${isSpeaking}`);
    setButtonState(ui.micBtn, !canUseMic, `canUseMic=${canUseMic}`);
    if (ui.micBtn) {
        ui.micBtn.classList.toggle('listening', isListening);
        ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporováno" : (isListening ? "Zastavit hlasový vstup" : (ui.micBtn.disabled ? (isSpeaking ? "Hlasový vstup nedostupný (AI mluví)" : "Hlasový vstup nedostupný") : "Zahájit hlasový vstup"));
         initTooltips(); // Обновить тултипы
    }
    setButtonState(ui.clearChatBtn, isBusyProcessing || chatIsEmpty || isSpeaking, `isBusy=${isBusyProcessing}, chatEmpty=${chatIsEmpty}, isSpeaking=${isSpeaking}`);
    setButtonState(ui.saveChatBtn, isBusyProcessing || chatIsEmpty || isSpeaking, `isBusy=${isBusyProcessing}, chatEmpty=${chatIsEmpty}, isSpeaking=${isSpeaking}`);
    setButtonState(ui.markAllReadBtn, unreadNotifCount === 0 || notificationsLoading, `unread=${unreadNotifCount}, loading=${notificationsLoading}`);
}


/**
 * Обработчик клика для динамических TTS кнопок (в чате и на доске).
 */
function handleDynamicTTSClick(event) {
    // Логика без изменений
    const button = event.target.closest('.tts-listen-btn');
    if (button && button.dataset.textToSpeak && !button.disabled) {
        const textToSpeak = button.dataset.textToSpeak;
        const chunkElement = button.closest('.whiteboard-chunk'); // Ищем подсветку только для доски
        speakText(textToSpeak, chunkElement);
    }
}

// --- Обработчики Действий ---

/**
 * Обрабатывает отправку сообщения из чата.
 * Включает проверку на подтверждение завершения темы.
 */
async function handleSendMessage() {
    const text = ui.chatInput?.value.trim();
    const affirmativeResponses = ['ano', 'jo', 'ok', 'dobře', 'souhlasím', 'potvrdit', 'uzavřít', 'dokončit', 'jiste']; // Список подтверждающих ответов

    // --- Проверка на подтверждение завершения темы ---
    if (state.aiProposedCompletion && text && affirmativeResponses.includes(text.toLowerCase().replace(/[.,!?]/g, ''))) { // Удаляем знаки препинания перед проверкой
        console.log("[AI Action] User confirmed topic completion via chat.");
        const confirmationText = ui.chatInput?.value; // Сохраняем оригинальный текст для отображения
        if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }
        await addChatMessage(confirmationText, 'user'); // Отображаем подтверждение пользователя
        state.aiIsWaitingForAnswer = false; // Больше не ждем ответа на предложение
        state.aiProposedCompletion = false; // Сбрасываем флаг предложения
        ui.markCompleteBtn?.classList.remove('suggested');
        manageButtonStates(); // Обновить кнопки перед запуском завершения
        await handleMarkTopicCompleteFlow(); // Запускаем процесс завершения ТЕМЫ
        return; // Прерываем дальнейшую обработку этого сообщения
    }
    // --- Конец проверки на подтверждение ---

    // --- Стандартная отправка сообщения ---
    if (!state.currentUser || !state.currentProfile) { showError("Nelze odeslat zprávu, chybí data uživatele.", false); return; }
    console.log("[ACTION] handleSendMessage triggered.");

    const canSendNow = state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening;

    console.log(`[ACTION] handleSendMessage: Check canSend=${canSendNow}, hasText=${!!text}`);

    if (!canSendNow || !text) {
        if (!canSendNow) showToast('Počkejte prosím', 'Systém je zaneprázdněn.', 'warning');
        if (!text) console.log("[ACTION] handleSendMessage: No text to send.");
        return;
    }

    // Сохраняем текст и очищаем поле ввода
    const inputBeforeSend = ui.chatInput?.value;
    if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }

    // Сбрасываем флаг предложения, если пользователь ответил что-то другое
    let wasProposingCompletion = false;
    if (state.aiProposedCompletion && text && !affirmativeResponses.includes(text.toLowerCase().replace(/[.,!?]/g, ''))) {
         console.log("[State Change] User responded differently to completion proposal. Resetting aiProposedCompletion.");
         state.aiProposedCompletion = false;
         wasProposingCompletion = true; // Запоминаем, что предложение было активно
         ui.markCompleteBtn?.classList.remove('suggested');
         // state.aiIsWaitingForAnswer будет установлено ниже в зависимости от ответа ИИ
    }

    try {
        // 1. Добавить сообщение пользователя в UI и контекст Gemini
        await addChatMessage(text, 'user');
        initTooltips();
        state.geminiChatContext.push({ role: "user", parts: [{ text }] });

        // 2. Установить состояние "AI думает"
        console.log("[ACTION] handleSendMessage: Setting isThinking=true, aiWaiting=false");
        state.geminiIsThinking = true;
        state.aiIsWaitingForAnswer = false; // Отправка пользователем сбрасывает ожидание AI (кроме случая ответа на предложение, который обработан выше)
        addThinkingIndicator();
        manageButtonStates();

        // 3. Сформировать промпт для Gemini (теперь он создается внутри _buildGeminiPayloadContents)
        let promptForGemini = text; // Передаем текст пользователя

        // 4. Отправить запрос к Gemini (как чат)
        console.log("[ACTION] handleSendMessage: Calling sendToGemini (isChatInteraction=true)...");
        const response = await sendToGemini(promptForGemini, true);
        console.log("[ACTION] handleSendMessage: Gemini response received:", response);

        // 5. Обработать ответ Gemini
        if (response.success && response.data) {
            const { chatText, ttsCommentary } = response.data; // Доска здесь не ожидается
            const completionMarker = "[PROPOSE_COMPLETION]";
            let finalChatText = chatText;
            let proposedCompletion = false;

            // Проверяем наличие маркера предложения завершения
            if (chatText && chatText.includes(completionMarker)) {
                finalChatText = chatText.replace(completionMarker, "").trim();
                proposedCompletion = true;
                console.log("[AI Action] AI proposed topic completion in response.");
            }

            const isMeaningfulChatText = finalChatText && finalChatText.trim() !== '?';

            if (isMeaningfulChatText) {
                await addChatMessage(finalChatText, 'gemini', true, new Date(), ttsCommentary);
                initTooltips();

                // Устанавливаем флаг ожидания ответа, *только если* это не предложение завершения
                if (!proposedCompletion) {
                     const lowerChatText = finalChatText.toLowerCase();
                     const isNowWaiting = finalChatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                     state.aiIsWaitingForAnswer = isNowWaiting;
                     console.log(`[STATE CHANGE] aiIsWaitingForAnswer evaluated to ${isNowWaiting} based on Gemini response.`);
                 } else {
                      state.aiIsWaitingForAnswer = true; // Ждем ответа на предложение (ano/ne)
                      console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to true (waiting for completion confirmation).`);
                 }

            } else {
                // Если Gemini не вернул текст для чата (или только "?")
                console.warn("Gemini chat response missing or only '?'. Not setting aiIsWaitingForAnswer=true.");
                 state.aiIsWaitingForAnswer = false; // Убедимся, что сброшено
                 if (!chatText) {
                     // Можно добавить сообщение об отсутствии ответа, если нужно
                 }
            }
             // Если вернулся только ttsCommentary (маловероятно для чата)
             if (ttsCommentary && !isMeaningfulChatText) {
                  speakText(ttsCommentary); // Просто воспроизвести звук
                  state.aiIsWaitingForAnswer = false; // Только TTS, не ждем
             }

             // Обновляем глобальный флаг предложения и UI кнопки
             state.aiProposedCompletion = proposedCompletion;
             if (proposedCompletion) {
                  ui.markCompleteBtn?.classList.add('suggested');
                  showToast("Návrh AI", "AI navrhuje ukončit téma. Můžete potvrdit tlačítkem 'Dokončit' nebo odpovědět v chatu.", "info", 6000);
             } else if (!wasProposingCompletion) { // Убираем подсветку, только если она не была только что сброшена ответом пользователя
                 ui.markCompleteBtn?.classList.remove('suggested');
             }
             if (domChanged) initTooltips(); // Обновить тултипы


        } else {
            // Ошибка от Gemini
            console.error("Error response from Gemini:", response.error);
            await addChatMessage(`Promiňte, nastala chyba: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
            state.aiIsWaitingForAnswer = false; // Сбросить ожидание при ошибке
            state.aiProposedCompletion = false; // Сбросить предложение при ошибке
            ui.markCompleteBtn?.classList.remove('suggested');
            console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (Gemini error).`);
            if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); } // Восстановить текст
        }
    } catch (error) {
        // Другие ошибки
        console.error("Error in handleSendMessage catch block:", error);
        showError(`Došlo k chybě při odesílání zprávy: ${error.message}`, false);
        state.aiIsWaitingForAnswer = false;
        state.aiProposedCompletion = false;
        ui.markCompleteBtn?.classList.remove('suggested');
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (exception).`);
        if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
    } finally {
        // 6. Убрать индикатор загрузки и обновить состояние кнопок
        console.log("[ACTION] handleSendMessage: Entering finally block.");
        removeThinkingIndicator();
        console.log("[ACTION] handleSendMessage: Setting isThinking=false in finally.");
        state.geminiIsThinking = false;
        setLoadingState('chat', false);
        // Определяем UI state в зависимости от флагов
        let nextUiState = 'learning';
        if(state.aiProposedCompletion) nextUiState = 'aiProposingCompletion';
        else if (state.aiIsWaitingForAnswer) nextUiState = 'waitingForAnswer';
        manageUIState(nextUiState);
        manageButtonStates();
        console.log("[ACTION] handleSendMessage: Exiting finally block.");
    }
}


/**
 * Запрашивает следующую часть объяснения у AI (кнопка "Pokračuj").
 */
async function requestContinue() {
    console.log("[ACTION] requestContinue triggered.");
    const canContinueNow = state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening && !state.aiIsWaitingForAnswer && !state.aiProposedCompletion; // Нельзя, если ждем ответа или предложили завершить
    console.log(`[ACTION] requestContinue: Check canContinue=${canContinueNow}`);

    if (!canContinueNow) {
        console.warn(`Cannot request continue: thinking=${state.geminiIsThinking}, loading=${state.topicLoadInProgress}, listening=${state.isListening}, waiting=${state.aiIsWaitingForAnswer}, proposing=${state.aiProposedCompletion}`);
        let reason = 'Systém je zaneprázdněn.';
        if(state.aiIsWaitingForAnswer) reason = 'AI čeká na vaši odpověď.';
        if(state.aiProposedCompletion) reason = 'AI navrhlo ukončení tématu.';
        showToast('Nelze pokračovat', reason, 'warning');
        return;
    }

    // 1. Установить состояние "AI думает"
    console.log("[ACTION] requestContinue: Setting isThinking=true, aiWaiting=false, proposing=false");
    state.geminiIsThinking = true;
    state.aiIsWaitingForAnswer = false; // "Продолжить" всегда сбрасывает ожидание
    state.aiProposedCompletion = false; // "Продолжить" сбрасывает предложение
    ui.markCompleteBtn?.classList.remove('suggested'); // Убрать подсветку кнопки
    addThinkingIndicator();
    manageButtonStates();

    // 2. Сформировать промпт (теперь через _buildGeminiPayloadContents)
    const prompt = `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}". Naváž na předchozí část. Vygeneruj další logickou část výkladu.`;

    try {
        // 3. Отправить запрос к Gemini (не как чат)
        console.log("[ACTION] requestContinue: Calling sendToGemini (isChatInteraction=false)...");
        const response = await sendToGemini(prompt, false);
        console.log("[ACTION] requestContinue: Gemini response received:", response);

        // 4. Обработать ответ
        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            let domChanged = false;
            const completionMarker = "[PROPOSE_COMPLETION]";
            let finalChatText = chatText;
            let proposedCompletion = false;

             // Проверяем наличие маркера предложения завершения
             if (chatText && chatText.includes(completionMarker)) {
                 finalChatText = chatText.replace(completionMarker, "").trim();
                 proposedCompletion = true;
                 console.log("[AI Action] AI proposed topic completion in response.");
             }

            const isMeaningfulChatText = finalChatText && finalChatText.trim() !== '?';

            // Добавить контент на доску
            if (boardMarkdown) {
                const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
                if (placeholder) placeholder.remove();
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                domChanged = true;
            }

            // Добавить сообщение в чат (если есть)
            if (isMeaningfulChatText) {
                await addChatMessage(finalChatText, 'gemini', true, new Date(), ttsCommentary);
                domChanged = true;
                 // Устанавливаем флаг ожидания ответа, *только если* это не предложение завершения
                 if (!proposedCompletion) {
                      const lowerChatText = finalChatText.toLowerCase();
                      const isNowWaiting = finalChatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                      state.aiIsWaitingForAnswer = isNowWaiting;
                      console.log(`[STATE CHANGE] aiIsWaitingForAnswer evaluated to ${isNowWaiting} based on Gemini response.`);
                  } else {
                       state.aiIsWaitingForAnswer = true; // Ждем ответа на предложение (ano/ne)
                       console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to true (waiting for completion confirmation).`);
                  }
            } else if (ttsCommentary && !boardMarkdown){
                // Только TTS
                await addChatMessage("(Poslechněte si další část komentáře)", 'gemini', true, new Date(), ttsCommentary); domChanged = true;
                state.aiIsWaitingForAnswer = false; // Не ждем ответа
                console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (only TTS).`);
            } else if (!boardMarkdown && !isMeaningfulChatText && !ttsCommentary){
                // Пустой ответ
                console.warn("Gemini continue request returned empty/meaningless content.");
                await addChatMessage("(AI neposkytlo další obsah, zkuste pokračovat znovu nebo položte otázku.)", 'gemini', false);
                state.aiIsWaitingForAnswer = false;
                console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (empty response).`);
            } else {
                 // Есть доска, нет текста в чате -> не ждем ответа
                 state.aiIsWaitingForAnswer = false;
                 console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (no meaningful chat text).`);
            }

            // Обновляем глобальный флаг предложения и UI кнопки
             state.aiProposedCompletion = proposedCompletion;
             if (proposedCompletion) {
                  ui.markCompleteBtn?.classList.add('suggested');
                  showToast("Návrh AI", "AI navrhuje ukončit téma. Můžete potvrdit tlačítkem 'Dokončit' nebo odpovědět v chatu.", "info", 6000);
             } else {
                  ui.markCompleteBtn?.classList.remove('suggested');
             }
             if (domChanged) initTooltips();

        } else {
             // Ошибка от Gemini
             console.error("Error response from Gemini:", response.error);
             await addChatMessage(`Promiňte, nastala chyba při pokračování: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
             state.aiIsWaitingForAnswer = false;
             state.aiProposedCompletion = false;
             ui.markCompleteBtn?.classList.remove('suggested');
             console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (Gemini error).`);
        }
    } catch (error) {
        // Другие ошибки
        console.error("Error in requestContinue catch block:", error);
        showError(`Došlo k chybě při žádosti o pokračování: ${error.message}`, false);
        state.aiIsWaitingForAnswer = false;
        state.aiProposedCompletion = false;
        ui.markCompleteBtn?.classList.remove('suggested');
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (exception).`);
    } finally {
        // 5. Убрать индикатор и обновить кнопки
        console.log("[ACTION] requestContinue: Entering finally block.");
        removeThinkingIndicator();
        console.log("[ACTION] requestContinue: Setting isThinking=false in finally.");
        state.geminiIsThinking = false;
        setLoadingState('chat', false);
        // Определяем UI state
        let nextUiState = 'learning';
        if(state.aiProposedCompletion) nextUiState = 'aiProposingCompletion';
        else if (state.aiIsWaitingForAnswer) nextUiState = 'waitingForAnswer';
        manageUIState(nextUiState);
        manageButtonStates();
        console.log("[ACTION] requestContinue: Exiting finally block.");
    }
}

/**
 * Запускает сессию обучения для текущей темы (при загрузке или выборе новой темы).
 */
async function startLearningSession() {
    if (!state.currentTopic) {
        console.error("[ACTION] startLearningSession: No current topic defined!");
        manageUIState('error', {errorMessage: 'Chyba: Téma není definováno.'});
        return;
    }
    console.log("[ACTION] startLearningSession triggered for topic:", state.currentTopic.name);

    // Сброс состояния перед началом новой сессии
    state.currentSessionId = generateSessionId();
    state.geminiChatContext = [];
    state.boardContentHistory = [];
    if (ui.chatMessages) ui.chatMessages.innerHTML = '';
    if (ui.whiteboardContent) ui.whiteboardContent.innerHTML = '';
    state.aiIsWaitingForAnswer = false; // Сброс ожидания
    state.aiProposedCompletion = false; // Сброс предложения
    ui.markCompleteBtn?.classList.remove('suggested'); // Убрать подсветку

    // 1. Установить состояние "AI думает" и обновить UI
    console.log("[ACTION] startLearningSession: Setting isThinking=true, aiWaiting=false, proposing=false");
    state.geminiIsThinking = true;
    manageUIState('requestingExplanation');
    addThinkingIndicator();
    manageButtonStates();

    // 2. Сформировать начальный промпт (теперь через _buildGeminiPayloadContents)
    const prompt = `Vysvětli ZÁKLADY tématu "${state.currentTopic.name}". Začni PRVNÍ částí výkladu.`;

    try {
        // 3. Отправить запрос к Gemini
        console.log("[ACTION] startLearningSession: Calling sendToGemini (isChatInteraction=false)...");
        const response = await sendToGemini(prompt, false);
        console.log("[ACTION] startLearningSession: Gemini response received:", response);

        // Убираем заглушки после получения ответа (если ответ не пустой)
        if (response.success && response.data && (response.data.boardMarkdown || response.data.chatText || response.data.ttsCommentary)) {
            const boardPlaceholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
            if (boardPlaceholder) { boardPlaceholder.remove(); console.log("Initial whiteboard placeholder removed."); }
            else if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = ''; }
            const chatPlaceholder = ui.chatMessages?.querySelector('.empty-state, .initial-load-placeholder');
             if (chatPlaceholder) { chatPlaceholder.remove(); console.log("Initial chat placeholder removed.");}
        } else {
             // Если ответ пустой, меняем заглушки на "ожидание"
             const boardPlaceholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
             if(boardPlaceholder) boardPlaceholder.innerHTML = `<i class='fas fa-chalkboard'></i><h3>Tabule připravena</h3><p>AI neposkytlo úvodní obsah.</p>`;
             const chatPlaceholder = ui.chatMessages?.querySelector('.empty-state, .initial-load-placeholder');
             if(chatPlaceholder) chatPlaceholder.innerHTML = `<i class='fas fa-comments'></i><h3>Chat připraven</h3><p>AI neposkytlo úvodní obsah. Zkuste položit otázku.</p>`;
        }


        // 4. Обработать ответ
        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            let domChanged = false;
            const completionMarker = "[PROPOSE_COMPLETION]";
            let finalChatText = chatText;
            let proposedCompletion = false; // Предложение не ожидается в первом сообщении, но проверяем

            // Проверяем наличие маркера предложения завершения (маловероятно здесь)
            if (chatText && chatText.includes(completionMarker)) {
                finalChatText = chatText.replace(completionMarker, "").trim();
                proposedCompletion = true;
                console.log("[AI Action] AI proposed topic completion unexpectedly in initial response.");
            }

            const isMeaningfulChatText = finalChatText && finalChatText.trim() !== '?';

            // Добавить контент на доску
            if (boardMarkdown) {
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                domChanged = true;
            }

            // Добавить сообщение в чат
            if (isMeaningfulChatText) {
                await addChatMessage(finalChatText, 'gemini', true, new Date(), ttsCommentary);
                domChanged = true;
                 // Устанавливаем флаг ожидания ответа, *только если* это не предложение завершения
                 if (!proposedCompletion) {
                      const lowerChatText = finalChatText.toLowerCase();
                      const isNowWaiting = finalChatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                      state.aiIsWaitingForAnswer = isNowWaiting;
                      console.log(`[STATE CHANGE] aiIsWaitingForAnswer evaluated to ${isNowWaiting} based on Gemini response.`);
                  } else {
                       state.aiIsWaitingForAnswer = true; // Ждем ответа на предложение
                       console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to true (waiting for completion confirmation).`);
                  }
            } else if (ttsCommentary && !boardMarkdown){
                // Только TTS
                await addChatMessage("(Poslechněte si úvodní komentář)", 'gemini', true, new Date(), ttsCommentary); domChanged = true;
                state.aiIsWaitingForAnswer = false;
                console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (only TTS).`);
            } else if (!boardMarkdown && !isMeaningfulChatText && !ttsCommentary){
                // Пустой ответ
                console.warn("Gemini initial response was empty/meaningless.");
                await addChatMessage("(AI neposkytlo úvodní obsah. Zkuste položit otázku nebo požádat o pokračování.)", 'gemini', false);
                if (!boardMarkdown && ui.whiteboardContent && !ui.whiteboardContent.hasChildNodes()) { ui.whiteboardContent.innerHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule prázdná</h3><p>AI neposkytlo obsah.</p></div>`; }
                state.aiIsWaitingForAnswer = false; // Не ждем ответа
                console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (empty response).`);
            } else {
                 // Есть доска, нет чата
                 state.aiIsWaitingForAnswer = false; // Не ждем ответа
                 console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (no meaningful chat text).`);
            }

             // Обновляем глобальный флаг предложения (маловероятно, что он будет true здесь)
             state.aiProposedCompletion = proposedCompletion;
             if (proposedCompletion) {
                  ui.markCompleteBtn?.classList.add('suggested');
                  showToast("Návrh AI", "AI navrhuje ukončit téma. Můžete potvrdit tlačítkem 'Dokončit' nebo odpovědět v chatu.", "info", 6000);
             } else {
                  ui.markCompleteBtn?.classList.remove('suggested');
             }
             if(domChanged) { initTooltips(); }

        } else {
             // Ошибка от Gemini
             console.error("Error response from Gemini:", response.error);
             await addChatMessage(`Promiňte, nastala chyba při zahájení výkladu: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
             if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba načítání</h3><p>Obsah pro tabuli nelze zobrazit.</p></div>`; }
             state.aiIsWaitingForAnswer = false;
             state.aiProposedCompletion = false;
             ui.markCompleteBtn?.classList.remove('suggested');
             console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (Gemini error).`);
             showError(`Chyba AI při startu: ${response.error}`, false);
        }
    } catch(error) {
        // Другие ошибки
        console.error("Error in startLearningSession catch block:", error);
        showError(`Došlo k chybě při zahájení výkladu: ${error.message}`, false);
        if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba systému</h3><p>Nelze zahájit výuku.</p></div>`; }
        await addChatMessage(`Systémová chyba při startu: ${error.message}`, 'gemini', false);
        state.aiIsWaitingForAnswer = false;
        state.aiProposedCompletion = false;
        ui.markCompleteBtn?.classList.remove('suggested');
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (exception).`);
    } finally {
        // 5. Убрать индикатор и обновить кнопки
        console.log("[ACTION] startLearningSession: Entering finally block.");
        removeThinkingIndicator();
        console.log("[ACTION] startLearningSession: Setting isThinking=false in finally.");
        state.geminiIsThinking = false;
        setLoadingState('chat', false);
        // Определяем UI state
        let nextUiState = 'learning';
        if(state.aiProposedCompletion) nextUiState = 'aiProposingCompletion';
        else if (state.aiIsWaitingForAnswer) nextUiState = 'waitingForAnswer';
        manageUIState(nextUiState);
        manageButtonStates();
        console.log("[ACTION] startLearningSession: Exiting finally block.");
    }
}


/** Поток действий при нажатии "Označit jako dokončené". */
async function handleMarkTopicCompleteFlow() {
    // Перепроверяем возможность завершения (учитываем !isSpeaking)
    const canCompleteNow = !!state.currentTopic && !state.topicLoadInProgress && !state.isLoading.points && !state.geminiIsThinking && !window.speechSynthesis.speaking;
    console.log(`[ACTION] handleMarkTopicCompleteFlow: Check canComplete=${canCompleteNow}`);

    if (!canCompleteNow) {
        showToast("Nelze dokončit", "Počkejte na dokončení předchozí akce nebo přehrávání zvuku.", "warning");
        return;
    }

    // Запрашиваем подтверждение, адаптируя сообщение
    let confirmationMessage = `Opravdu označit téma "${state.currentTopic.name}" jako dokončené? Získáte ${POINTS_TOPIC_COMPLETE} kreditů.`;
    if (!state.aiProposedCompletion) { // Если ИИ не предлагал, спрашиваем строже
         confirmationMessage = `AI ještě nenavrhlo ukončení. Jste si jisti, že chcete téma "${state.currentTopic.name}" označit jako dokončené?\n\nZískáte ${POINTS_TOPIC_COMPLETE} kreditů.`;
    }

    // Используем setTimeout, чтобы дать UI время обновиться перед блокирующим confirm
    setTimeout(async () => {
        if (!confirm(confirmationMessage)) {
            console.log("[Flow] Topic completion cancelled by user.");
            return; // Пользователь отменил
        }

        console.log(`[Flow] Marking topic ${state.currentTopic.activity_id} as complete. Setting flags...`);
        // Устанавливаем флаги загрузки СРАЗУ ПОСЛЕ подтверждения
        state.topicLoadInProgress = true; // Используем этот флаг, т.к. он блокирует почти все
        state.aiProposedCompletion = false; // Сбрасываем флаг предложения
        ui.markCompleteBtn?.classList.remove('suggested'); // Убираем подсветку
        setLoadingState('points', true);
        manageButtonStates(); // Блокируем кнопки

        try {
            // 1. Отметить тему как завершенную в БД
            console.log(`[Flow] Calling markTopicComplete for activity ${state.currentTopic.activity_id}`);
            const successMark = await markTopicComplete(state.currentTopic.activity_id, state.currentUser.id);

            if (successMark) {
                console.log(`[Flow] Topic marked complete in DB. Awarding points...`);

                // 2. Начислить очки (если тема успешно отмечена)
                console.log(`[Flow] --> Calling awardPoints(userId: ${state.currentUser.id}, points: ${POINTS_TOPIC_COMPLETE})`);
                setLoadingState('points', true); // Убедимся, что флаг установлен
                manageButtonStates(); // Обновить кнопки на время начисления

                const pointsAwarded = await awardPoints(state.currentUser.id, POINTS_TOPIC_COMPLETE);

                setLoadingState('points', false); // Снимаем флаг загрузки очков
                manageButtonStates(); // Обновить кнопки после начисления
                console.log(`[Flow] <-- awardPoints returned: ${pointsAwarded}`); // Логируем результат

                // Показать уведомления
                if (pointsAwarded) { // Проверяем, вернула ли функция true
                    showToast('+', `${POINTS_TOPIC_COMPLETE} kreditů získáno!`, 'success', 3000);
                    // Обновить очки в профиле локально
                    if(state.currentProfile) {
                        const oldPoints = state.currentProfile.points || 0;
                        state.currentProfile.points = oldPoints + POINTS_TOPIC_COMPLETE; // Прибавляем очки
                        console.log(`[Profile Update] Local points updated from ${oldPoints} to ${state.currentProfile.points}`);
                        updateUserInfoUI(); // Обновить UI сайдбара
                    } else {
                         console.warn("[Profile Update] Cannot update local points, profile data missing.");
                    }
                } else {
                    showToast('Varování', 'Téma dokončeno, ale body se nepodařilo připsat (chyba RPC?).', 'warning');
                    console.warn(`[Flow] Points awarding failed or returned false for user ${state.currentUser.id}. Check Supabase RPC function 'increment_user_points'.`);
                }
                showToast(`Téma "${state.currentTopic.name}" dokončeno!`, "success");

                // 3. Загрузить следующую тему
                console.log("[Flow] Topic completion success. Resetting topicLoadInProgress=false and loading next topic.");
                state.topicLoadInProgress = false; // Снимаем общий флаг блокировки ПЕРЕД загрузкой следующей темы
                await loadNextTopicFlow(); // <<<=== Запускаем загрузку следующей темы

            } else {
                // Если не удалось отметить тему
                showToast("Chyba", "Chyba při označování tématu jako dokončeného.", "error");
                console.error(`[Flow] Topic completion failed (markTopicComplete returned false for activity ${state.currentTopic.activity_id}). Resetting flags.`);
                state.topicLoadInProgress = false; // Сбросить флаги
                setLoadingState('points', false);
                manageButtonStates(); // Разблокировать кнопки
            }
        } catch (error) {
            // Обработка других ошибок
            console.error("[Flow] Error in handleMarkTopicCompleteFlow catch block:", error);
            showToast("Chyba", `Neočekávaná chyba při dokončování tématu: ${error.message}`, "error");
            console.log("[Flow] Topic completion exception. Resetting flags.");
            state.topicLoadInProgress = false; // Сбросить флаги
            setLoadingState('points', false);
            manageButtonStates(); // Разблокировать кнопки
        }
        // Больше не нужно сбрасывать topicLoadInProgress здесь
    }, 50); // Небольшая задержка перед confirm
}

/** Поток действий для загрузки следующей темы. */
async function loadNextTopicFlow() {
    if (!state.currentUser) { console.log(`[Flow] Load next topic skipped: No user.`); return; }
    if (state.topicLoadInProgress) { console.log(`[Flow] Load next topic skipped: Already in progress.`); return; }

    console.log("[Flow] Loading next topic flow STARTED. Setting topicLoadInProgress=true.");
    state.topicLoadInProgress = true;
    setLoadingState('currentTopic', true);
    state.currentTopic = null;
    state.geminiChatContext = [];
    state.aiIsWaitingForAnswer = false;
    state.aiProposedCompletion = false; // Сброс предложения при загрузке новой темы
    ui.markCompleteBtn?.classList.remove('suggested'); // Убрать подсветку
    console.log("[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false by loadNextTopicFlow start.");

    // Обновляем UI для отображения загрузки
    if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám další téma...</span>';
    clearWhiteboard(false);
    if (ui.chatMessages) ui.chatMessages.innerHTML = '';
    manageUIState('loadingTopic');
    manageButtonStates();

    try {
        console.log("[Flow] Calling loadNextUncompletedTopic...");
        const result = await loadNextUncompletedTopic(state.currentUser.id);
        console.log("[Flow] loadNextUncompletedTopic result:", result);

        if (result.success && result.topic) {
            // Тема успешно загружена
            state.currentTopic = result.topic;
            if (ui.currentTopicDisplay) {
                ui.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(state.currentTopic.name)}</strong>`;
            }
            console.log("[Flow] Topic loaded successfully. Resetting topicLoadInProgress=false. Starting session...");
            state.topicLoadInProgress = false; // Сбрасываем флаг ПЕРЕД запуском сессии
            setLoadingState('currentTopic', false);
            await startLearningSession();

        } else {
            // Не удалось загрузить тему (план завершен или ошибка)
            state.currentTopic = null;
            const message = result.message || 'Není další téma nebo nastala chyba.';
            if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(${sanitizeHTML(message)})</span>`;
            console.log(`[Flow] No topic loaded or error. Reason: ${result.reason}. Resetting topicLoadInProgress=false.`);
            state.topicLoadInProgress = false;
            setLoadingState('currentTopic', false);
            manageUIState(result.reason || 'error', { errorMessage: message });
            manageButtonStates();
        }
    } catch(error) {
        console.error("Error in loadNextTopicFlow execution:", error);
        state.currentTopic = null;
        if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(Chyba načítání)</span>`;
        console.log("[Flow] Exception loading topic. Resetting topicLoadInProgress=false.");
        state.topicLoadInProgress = false;
        setLoadingState('currentTopic', false);
        manageUIState('error', { errorMessage: `Chyba při načítání dalšího tématu: ${error.message}` });
        manageButtonStates();
    } finally {
         if (state.topicLoadInProgress) {
              console.warn("[Flow] topicLoadInProgress was still true in finally block. Resetting.");
              state.topicLoadInProgress = false;
              setLoadingState('currentTopic', false);
              manageButtonStates();
         }
    }
    console.log("[Flow] Loading next topic flow FINISHED.");
}

// --- Запуск Приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);