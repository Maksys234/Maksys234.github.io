// vyukaApp.js - Основной файл приложения Vyuka
// Версия 3.8: Блокировка ручного завершения, фокус на доску, адаптация UI

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
import { sendToGemini, parseGeminiResponse } from './geminiService.js'; // v3.8
import { loadVoices, speakText, stopSpeech, handleMicClick, initializeSpeechRecognition, removeBoardHighlight } from './speechService.js';
import { renderMarkdown, clearWhiteboard, appendToWhiteboard } from './whiteboardController.js';
import { addChatMessage, addThinkingIndicator, removeThinkingIndicator, confirmClearChat, saveChatToPDF } from './chatController.js';

// --- Основная Логика Приложения ---

const activityVisuals = { // Иконки для уведомлений (без изменений)
    test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' },
    diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' },
    level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, vyuka_start: { icon: 'fa-chalkboard-teacher', class: 'lesson'}, vyuka_complete: { icon: 'fa-flag-checkered', class: 'test'},
    achievement: { icon: 'fa-trophy', class: 'badge'}, info: { icon: 'fa-info-circle', class: 'info' }, warning: { icon: 'fa-exclamation-triangle', class: 'warning' },
    error: { icon: 'fa-exclamation-circle', class: 'danger' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' }
};

/** Главная функция инициализации приложения. */
async function initializeApp() {
    console.log("🚀 [Init Vyuka v3.8] Starting App Initialization...");
    let initializationError = null;
    if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
    if (ui.mainContent) ui.mainContent.style.display = 'none';
    hideError();

    try {
        // 1. Инициализация Supabase
        const supabaseInitialized = initializeSupabase();
        if (!supabaseInitialized) throw new Error("Kriticka chyba Nepodarilo se pripojit k databazi"); // Bez interpunkce
        state.supabase = supabaseInitialized;
        console.log("[INIT] Supabase Initialized.");

        // 2. Проверка сессии пользователя
        console.log("[INIT] Checking auth session...");
        const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
        if (sessionError) throw new Error(`Nepodarilo se overit sezeni ${sessionError.message.replace(/[.,!?;:]/g, '')}`);
        if (!session || !session.user) {
            console.log('[INIT] Not logged in Redirecting');
            window.location.href = '/auth/index.html';
            return;
        }
        state.currentUser = session.user;
        console.log(`[INIT] User authenticated (ID: ${state.currentUser.id}) Fetching profile`);

        // 3. Загрузка профиля пользователя
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
            console.log("[INIT] Profile fetched successfully.");
        }

        // 4. Инициализация базового UI
        console.log("[INIT] Initializing base UI");
        initializeUI();
        updateUserInfoUI();

        // 5. Загрузка начальных данных (тема, уведомления)
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
                    manageButtonStates();
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
             manageButtonStates();
        }

    } catch (error) {
        console.error("❌ [Init Vyuka v3.8] Critical initialization error:", error);
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
                initScrollAnimations();
            });
        }
        manageButtonStates(); // Ensure buttons are correct at the very end
        console.log("✅ [Init Vyuka v3.8] App Initialization Finished finally block");
    }
}

/** Инициализация базового UI и обработчиков. */
function initializeUI() {
    console.log("[UI Init] Initializing UI elements and handlers");
    try {
        updateTheme();
        setupEventListeners();
        // initTooltips(); // Убрал отсюда, вызываем реже
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
        showError(`Chyba inicializace UI ${error.message.replace(/[.,!?;:]/g, '')}`, false);
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
            console.warn(`[SETUP] Element '${elementName}' not found Listener not attached`);
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
        showToast('Vymazano', "Tabule vymazana", "info"); // Bez interpunkce
    }, 'clearBoardBtn');
    addListener(ui.stopSpeechBtn, 'click', stopSpeech, 'stopSpeechBtn');

    // Управление темой
    addListener(ui.continueBtn, 'click', requestContinue, 'continueBtn');
    // Listener for markCompleteBtn удален ранее

    // Динамические TTS кнопки
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
        console.warn("[SETUP] Cannot add theme change listener");
    }
    window.addEventListener('resize', () => {
        if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) { closeMenu(); }
    }); listenersAttached++;
    window.addEventListener('online', updateOnlineStatus); listenersAttached++;
    window.addEventListener('offline', updateOnlineStatus); listenersAttached++;

    // Уведомления (логика без изменений)
    addListener(ui.notificationBell, 'click', (event) => {
        event.stopPropagation();
        ui.notificationsDropdown?.classList.toggle('active');
    }, 'notificationBell');
    addListener(ui.markAllReadBtn, 'click', async () => {
        if (state.isLoading.notifications || !state.currentUser) return;
        setLoadingState('notifications', true); manageButtonStates();
        try {
            const success = await markAllNotificationsRead(state.currentUser.id);
            if(success) {
                const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT);
                renderNotifications(unreadCount, notifications);
                showToast('SIGNALY VYMAZANY', 'Vsechna oznameni oznacena', 'success'); // Bez interpunkce
            } else { showToast('CHYBA PRENOSU', 'Nepodarilo se oznacit oznameni', 'error'); }
        } catch (err) { console.error("Error marking all notifications read:", err); showToast('CHYBA SYSTEMU', 'Pri oznacovani nastala chyba', 'error');
        } finally { setLoadingState('notifications', false); manageButtonStates(); }
    }, 'markAllReadBtn');
    addListener(ui.notificationsList, 'click', async (event) => {
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
                } else { showToast('Chyba', 'Nepodarilo se oznacit oznameni', 'error'); }
            }
            if (link) { ui.notificationsDropdown?.classList.remove('active'); window.location.href = link; }
        }
    }, 'notificationsList');
    document.addEventListener('click', (event) => {
        if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) {
            ui.notificationsDropdown.classList.remove('active');
        }
    }); listenersAttached++;

    console.log(`[SETUP] Event listeners setup complete Total attached approx ${listenersAttached}`);
}

// --- Обновление UI ---

/** Обновляет информацию о пользователе в UI (сайдбар). */
function updateUserInfoUI() {
    // Логика без изменений, но убираем лишние пробелы
    if (!ui.sidebarName || !ui.sidebarAvatar) { console.warn("updateUserInfoUI Sidebar elements not found"); return; }
    if (state.currentUser && state.currentProfile) {
        const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot';
        ui.sidebarName.textContent = sanitizeHTML(displayName);
        const initials = getInitials(state.currentProfile, state.currentUser.email);
        const avatarUrl = state.currentProfile.avatar_url; let finalUrl = avatarUrl;
        if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('//') && !avatarUrl.startsWith('data:')) { finalUrl = null; console.warn("Invalid avatar URL", avatarUrl); }
        else if (avatarUrl) { finalUrl = sanitizeHTML(avatarUrl); }
        ui.sidebarAvatar.innerHTML = finalUrl ? `<img src="${finalUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
        const sidebarImg = ui.sidebarAvatar.querySelector('img');
        if (sidebarImg) { sidebarImg.onerror = function() { console.warn(`Failed to load avatar ${this.src}`); ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; }
    } else { ui.sidebarName.textContent = 'Neprihlasen'; ui.sidebarAvatar.textContent = '?'; }
}

/** Отображает уведомления в выпадающем списке. */
 function renderNotifications(count, notifications) {
    // Логика без изменений, но убираем пунктуацию из сообщений
    console.log("[Render Notifications] Count", count, "Notifications", notifications ? notifications.length : 0);
    if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements"); return; }
    ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0);
    if (notifications && notifications.length > 0) {
        ui.notificationsList.innerHTML = notifications.map(n => {
            const visual = activityVisuals[(n.type || 'default').toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; const title = (n.title || 'Nove oznameni').replace(/[.,!?;:]/g, ''); const message = (n.message || '').replace(/[.,!?;:]/g, ''); const timeAgo = formatRelativeTime(n.created_at);
            return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
                        ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
                        <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div>
                        <div class="notification-content"><div class="notification-title">${sanitizeHTML(title)}</div><div class="notification-message">${sanitizeHTML(message)}</div><div class="notification-time">${timeAgo}</div></div>
                    </div>`;
        }).join('');
        ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.add('has-content');
    } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.remove('has-content'); }
    const currentUnreadCount = parseInt(ui.notificationCount.textContent.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentUnreadCount === 0 || state.isLoading.notifications;
    console.log("[Render Notifications] Finished rendering");
    // initTooltips(); // Не нужно здесь
 }

/** Управляет общим состоянием интерфейса (адаптировано под доску). */
function manageUIState(mode, options = {}) {
    const isLearningActive = state.currentTopic && ['learning', 'chatting', 'requestingExplanation', 'waitingForAction', 'aiProposingCompletion'].includes(mode); // 'waitingForAnswer' -> 'waitingForAction'
    const isEmptyState = ['noPlan', 'planComplete', 'error', 'loggedOut', 'initial', 'loadingTopic'].includes(mode);

    // Интерфейс обучения (без изменений)
    if (ui.learningInterface) { ui.learningInterface.style.display = !isEmptyState ? 'flex' : 'none'; }

    // Чат: теперь почти всегда пустой или с однословными сообщениями
    if (ui.chatMessages) {
        let chatHTML = '';
        const hasMessages = ui.chatMessages.querySelector('.chat-message');

        if (isEmptyState) {
            ui.chatMessages.innerHTML = ''; // Очищаем при пустых состояниях
            switch (mode) {
                case 'loggedOut': chatHTML = `<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPRIHLASEN</h3></div>`; break;
                case 'noPlan': chatHTML = `<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ZADNY PLAN</h3></div>`; break;
                case 'planComplete': chatHTML = `<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLAN HOTOV</h3></div>`; break;
                case 'error': chatHTML = `<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA</h3><p>${sanitizeHTML(options.errorMessage || 'Chyba systemu').replace(/[.,!?;:]/g, '')}</p></div>`; if (options.errorMessage && !document.getElementById('global-error')?.offsetParent) { showError(options.errorMessage, true); } break;
                case 'initial': chatHTML = '<div class="empty-state"><i class="fas fa-cog fa-spin"></i><h3>Inicializace</h3></div>'; break;
                case 'loadingTopic': chatHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><p>Nacitam tema</p></div>'; break;
            }
             if (chatHTML) ui.chatMessages.innerHTML = chatHTML;
        } else if (isLearningActive && !hasMessages && ui.chatMessages.querySelector('.empty-state')) {
            // Удаляем заглушку, если начинается обучение, но пока нет сообщений (ожидаем первое сообщение)
             ui.chatMessages.innerHTML = '';
             console.log("[UI State] Removed chat placeholder learning started")
        }
        // НЕ добавляем стандартные фразы типа "Chat připraven", т.к. чат минималистичен
        console.log(`[UI State] Chat set to state ${mode}`);
    }

    // Доска: отображение состояния
    if (ui.whiteboardContent) {
         const existingPlaceholder = ui.whiteboardContent.querySelector('.initial-load-placeholder, .empty-state');
         const hasChunks = ui.whiteboardContent.querySelector('.whiteboard-chunk');

         if (isEmptyState) {
            ui.whiteboardContent.innerHTML = ''; // Очищаем
            let boardHTML = '';
            switch (mode) {
                case 'loadingTopic': boardHTML = '<div class="empty-state initial-load-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Nacitam prvni lekci</p></div>'; break;
                case 'error': boardHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba Tabule</h3><p>${sanitizeHTML(options.errorMessage || 'Obsah nelze zobrazit').replace(/[.,!?;:]/g, '')}</p></div>`; break;
                case 'noPlan': case 'planComplete': case 'loggedOut': boardHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule</h3><p>Vyberte tema</p></div>`; break;
                case 'initial': boardHTML = `<div class='empty-state'><i class='fas fa-spinner fa-spin'></i><h3>Inicializace</h3></div>`; break;
            }
             if (boardHTML) ui.whiteboardContent.innerHTML = boardHTML;
        } else if (isLearningActive && existingPlaceholder && !hasChunks) {
             // Оставляем заглушку "Tabule pripravena", если обучение активно, но контента еще нет
             if (!existingPlaceholder.textContent.includes("pripravena")) {
                  ui.whiteboardContent.innerHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule pripravena</h3></div>`;
             }
        } else if (isLearningActive && existingPlaceholder && hasChunks) {
             // Удаляем заглушку, как только появился первый контент
             existingPlaceholder.remove();
             console.log("[UI State] Removed whiteboard placeholder content received");
        }
         console.log(`[UI State] Whiteboard set to state ${mode}`);
    }

    manageButtonStates();
}

/**
 * Управляет активностью/неактивностью кнопок (адаптировано под доску).
 */
function manageButtonStates() {
    const hasTopic = !!state.currentTopic;
    const isThinking = state.geminiIsThinking;
    const isLoadingTopic = state.topicLoadInProgress;
    const isWaitingForAction = state.aiIsWaitingForAnswer; // Используем старый флаг, но смысл меняется: ждем действия от юзера (решить задачу, ответить да/нет)
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
        let placeholder = "Odpovez nebo poloz otazku"; // Кратко
        if (isListening) placeholder = "Posloucham";
        else if (ui.chatInput.disabled) {
             if (isThinking) placeholder = "AI premysli";
             else if (isLoadingTopic) placeholder = "Nacitam tema";
             else if (isLoadingPoints) placeholder = "Zpracovavam dokonceni";
             else placeholder = "Akce nedostupna";
        } else if (isProposingCompletion) {
            placeholder = "AI navrhuje ukonceni Odpovez Ano Ne"; // Без пунктуации
        } else if (isWaitingForAction) {
            placeholder = "Odpovez nebo se zeptej"; // Ждем реакции на доску/задачу
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
    setButtonState(ui.saveChatBtn, isBusyProcessing || chatIsEmpty || isSpeaking); // Сохранение чата теперь менее полезно
    setButtonState(ui.markAllReadBtn, unreadNotifCount === 0 || notificationsLoading);
}


/**
 * Обработчик клика для динамических TTS кнопок.
 */
function handleDynamicTTSClick(event) {
    // Логика без изменений
    const button = event.target.closest('.tts-listen-btn');
    if (button && button.dataset.textToSpeak && !button.disabled) {
        const textToSpeak = button.dataset.textToSpeak;
        const chunkElement = button.closest('.whiteboard-chunk');
        speakText(textToSpeak, chunkElement);
    }
}

// --- Обработчики Действий ---

/**
 * Обрабатывает отправку сообщения из чата.
 * Включает проверку на подтверждение завершения и блокировку ручного завершения.
 */
async function handleSendMessage() {
    const text = ui.chatInput?.value.trim();
    const affirmativeResponses = ['ano', 'jo', 'ok', 'dobře', 'dobre', 'souhlasim', 'potvrdit', 'uzavrit', 'dokoncit', 'jiste']; // Без пунктуации
    const negativeResponses = ['ne', 'nechci', 'stop', 'nemyslim', 'nesouhlasim', 'zrusit', 'neukoncovat'];
    const forceCompleteKeywords = ['ukonci', 'dokonci', 'zavri', 'konec', 'skonci', 'hotovo']; // Ключевые слова для попытки ручного завершения

    // --- Блокировка ручного завершения ---
    if (!state.aiProposedCompletion && text) {
        const lowerText = text.toLowerCase();
        if (forceCompleteKeywords.some(keyword => lowerText.includes(keyword))) {
            console.warn("[ACTION] User attempted to force topic completion");
            if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); } // Очищаем ввод

            // Отправляем AI команду объяснить, почему нельзя завершить
            state.geminiIsThinking = true;
            addThinkingIndicator();
            manageButtonStates();
            try {
                const prompt = `Student se pokusil ukončit téma "${state.currentTopic?.name || 'toto'}". Vysvětli na TABULI stručně, že téma ukončuje AI až po důkladném probrání a ověření znalostí. Do CHATU napiš pouze "Info na tabuli".`;
                const response = await sendToGemini(prompt, true); // Отправляем как чат, но ожидаем ответ на доске
                if (response.success && response.data) {
                    if (response.data.boardMarkdown) appendToWhiteboard(response.data.boardMarkdown, response.data.ttsCommentary);
                    // Ожидаем короткий ответ в чате от AI
                    if (response.data.chatText) await addChatMessage(response.data.chatText, 'gemini', false, new Date(), response.data.ttsCommentary);
                    else await addChatMessage("Info na tabuli", 'gemini', false); // Запасной вариант
                } else {
                    await addChatMessage("Chyba nelze dokoncit", 'gemini', false); // Ошибка без пунктуации
                }
            } catch (e) {
                 await addChatMessage("Chyba zpracovani", 'gemini', false);
            } finally {
                removeThinkingIndicator();
                state.geminiIsThinking = false;
                manageButtonStates();
                 initTooltips(); // Обновить тултипы после добавления сообщений/доски
            }
            return; // Прерываем выполнение
        }
    }
    // --- Конец блокировки ---


    // --- Проверка на подтверждение/отказ AI-предложенного завершения ---
    if (state.aiProposedCompletion && text) {
        const lowerText = text.toLowerCase().replace(/[.,!?]/g, '');
        if (affirmativeResponses.includes(lowerText)) {
            console.log("[AI Action] User confirmed topic completion via chat.");
            const confirmationText = ui.chatInput?.value; // Сохраняем для лога
            if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }
            await addChatMessage(confirmationText, 'user'); // Добавляем ответ пользователя в UI
            state.aiIsWaitingForAnswer = false;
            state.aiProposedCompletion = false;
            manageButtonStates();
            await completeTopicFlow(); // Запускаем процесс завершения
            return;
        } else if (negativeResponses.includes(lowerText)) {
            console.log("[AI Action] User rejected topic completion via chat.");
            const rejectionText = ui.chatInput?.value;
            if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }
            await addChatMessage(rejectionText, 'user');
            state.aiIsWaitingForAnswer = false;
            state.aiProposedCompletion = false;

            // Просим AI продолжить (он ответит на доске)
            state.geminiIsThinking = true;
            addThinkingIndicator();
            manageButtonStates();
            try {
                const prompt = `Student odmítl ukončení tématu "${state.currentTopic?.name || 'toto'}". Pokračuj ve výkladu další logickou částí nebo zadej další úkol na TABULI. Do CHATU napiš pouze "Pokracujeme".`;
                const response = await sendToGemini(prompt, true);
                 if (response.success && response.data) {
                     if (response.data.boardMarkdown) appendToWhiteboard(response.data.boardMarkdown, response.data.ttsCommentary);
                     if (response.data.chatText) await addChatMessage(response.data.chatText, 'gemini', false, new Date(), response.data.ttsCommentary);
                     else await addChatMessage("Pokracujeme", 'gemini', false);
                 } else {
                      await addChatMessage("Chyba pokracovani", 'gemini', false);
                 }
            } catch(e) {
                 await addChatMessage("Chyba zpracovani", 'gemini', false);
            } finally {
                 removeThinkingIndicator();
                 state.geminiIsThinking = false;
                 // AI должен задать вопрос/задачу на доске, поэтому ждем действия
                 state.aiIsWaitingForAnswer = true; // Предполагаем, что AI задаст вопрос/задачу на доске
                 manageUIState('waitingForAction');
                 manageButtonStates();
                  initTooltips();
            }
            return;
        }
        // Если ответ не "Ano" или "Ne", обрабатываем как обычное сообщение ниже
    }
    // --- Конец проверки на подтверждение/отказ ---

    // --- Стандартная отправка сообщения ---
    if (!state.currentUser || !state.currentProfile) { showError("Nelze odeslat zpravu chybi data uzivatele", false); return; }
    console.log("[ACTION] handleSendMessage triggered.");

    const canSendNow = state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening;
    console.log(`[ACTION] handleSendMessage Check canSend=${canSendNow} hasText=${!!text}`);

    if (!canSendNow || !text) {
        if (!canSendNow) showToast('Pockejte prosim', 'System je zaneprazdnen', 'warning');
        if (!text) console.log("[ACTION] handleSendMessage No text to send");
        return;
    }

    const inputBeforeSend = ui.chatInput?.value;
    if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }

    // Сброс флага предложения, если пользователь ответил что-то другое
     if (state.aiProposedCompletion && text && !affirmativeResponses.includes(text.toLowerCase().replace(/[.,!?]/g, '')) && !negativeResponses.includes(text.toLowerCase().replace(/[.,!?]/g, ''))) {
          console.log("[State Change] User responded differently to completion proposal Resetting aiProposedCompletion");
          state.aiProposedCompletion = false;
     }

    let domChangedInTry = false;

    try {
        // 1. Добавить сообщение пользователя
        await addChatMessage(text, 'user');
        domChangedInTry = true;
        state.geminiChatContext.push({ role: "user", parts: [{ text }] });

        // 2. Установить состояние "AI думает"
        console.log("[ACTION] handleSendMessage Setting isThinking=true aiWaiting=false");
        state.geminiIsThinking = true;
        state.aiIsWaitingForAnswer = false; // Сбрасываем ожидание
        addThinkingIndicator();
        domChangedInTry = true;
        manageButtonStates();

        // 3. Отправить запрос к Gemini (как чат)
        console.log("[ACTION] handleSendMessage Calling sendToGemini v3.8 isChatInteraction=true");
        const response = await sendToGemini(text, true); // 'text' - это промпт
        console.log("[ACTION] handleSendMessage Gemini response received:", response);

        // 4. Обработать ответ Gemini (ожидаем ответ на доске)
        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data; // chatText должен быть минимальным
            const completionMarker = "[PROPOSE_COMPLETION]";
            let finalChatText = chatText;
            let proposedCompletion = false;

            // Проверяем маркер завершения (может прийти в ответе на вопрос юзера)
             if (chatText && chatText.includes(completionMarker)) {
                 finalChatText = chatText.replace(completionMarker, "").trim();
                 proposedCompletion = true;
                 console.log("[AI Action] AI proposed topic completion in response");
             }

            // Добавить контент на доску (основной ответ здесь)
            if (boardMarkdown) {
                const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
                if (placeholder) placeholder.remove();
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                domChangedInTry = true;
            } else {
                 console.warn("Gemini response has no board content for chat interaction")
                 // Если доски нет, но есть TTS, покажем его в чате (как исключение)
                 if(ttsCommentary && !finalChatText) {
                     await addChatMessage(ttsCommentary, 'gemini', true, new Date(), ttsCommentary);
                     domChangedInTry = true;
                 }
            }

            // Добавить минимальное сообщение в чат (если есть)
            if (finalChatText) {
                await addChatMessage(finalChatText, 'gemini', false, new Date(), ttsCommentary); // Не сохраняем короткие статусы в БД? false
                domChangedInTry = true;
            }

            // Воспроизвести TTS, если есть и если это не только чат-сообщение
            if (ttsCommentary && boardMarkdown) {
                 speakText(ttsCommentary, ui.whiteboardContent?.lastElementChild);
            }

            // Обновляем флаг предложения
            state.aiProposedCompletion = proposedCompletion;
            if (proposedCompletion) {
                 showToast("Navrh AI", "AI navrhuje ukonceni Odpovezte Ano Ne", "info", 6000);
                  state.aiIsWaitingForAnswer = true; // Ждем Ano/Ne
                  console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true waiting for completion confirmation");
            } else {
                 // Если AI ответил на доске, он скорее всего ожидает реакции/решения задачи
                 state.aiIsWaitingForAnswer = true; // Предполагаем, что теперь ждем действия пользователя
                 console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true waiting for user action after board update");
            }

            if (domChangedInTry) {
                 initTooltips(); // Обновить тултипы
            }

        } else {
            // Ошибка от Gemini
            console.error("Error response from Gemini:", response.error);
             const errorMsg = (response.error || "Neznama chyba AI").replace(/[.,!?;:]/g, '');
            await addChatMessage(errorMsg, 'gemini', false); // Ошибка без пунктуации
            domChangedInTry = true;
            state.aiIsWaitingForAnswer = false;
            state.aiProposedCompletion = false;
            console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false Gemini error`);
            if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
             if (domChangedInTry) initTooltips();
        }
    } catch (error) {
        console.error("Error in handleSendMessage catch block:", error);
        const errorMsg = `Chyba odesilani zpravy ${error.message}`.replace(/[.,!?;:]/g, '');
        showError(errorMsg, false);
        await addChatMessage("Chyba systemu", 'gemini', false); // Кратко в чат
        domChangedInTry = true;
        state.aiIsWaitingForAnswer = false;
        state.aiProposedCompletion = false;
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false exception`);
        if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
         if (domChangedInTry) initTooltips();
    } finally {
        console.log("[ACTION] handleSendMessage Entering finally block");
        const indicatorRemoved = removeThinkingIndicator();
        console.log("[ACTION] handleSendMessage Setting isThinking=false in finally");
        state.geminiIsThinking = false;
        setLoadingState('chat', false);

        let nextUiState = 'learning';
        if(state.aiProposedCompletion) nextUiState = 'aiProposingCompletion';
        else if (state.aiIsWaitingForAnswer) nextUiState = 'waitingForAction'; // Теперь ждем действия
        manageUIState(nextUiState);
        manageButtonStates();

        if (indicatorRemoved) initTooltips();
        console.log("[ACTION] handleSendMessage Exiting finally block");
    }
}


/**
 * Запрашивает следующую часть объяснения у AI (кнопка "Pokračuj").
 * Ожидает контент на доске.
 */
async function requestContinue() {
    console.log("[ACTION] requestContinue triggered.");
    const canContinueNow = state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening && !state.aiIsWaitingForAnswer && !state.aiProposedCompletion;
    console.log(`[ACTION] requestContinue Check canContinue=${canContinueNow}`);

    if (!canContinueNow) {
        console.warn(`Cannot request continue thinking=${state.geminiIsThinking} loading=${state.topicLoadInProgress} listening=${state.isListening} waiting=${state.aiIsWaitingForAnswer} proposing=${state.aiProposedCompletion}`);
        let reason = 'System je zaneprazdnen';
        if(state.aiIsWaitingForAnswer) reason = 'AI ceka na vasi akci';
        if(state.aiProposedCompletion) reason = 'AI navrhlo ukonceni tematu';
        showToast('Nelze pokracovat', reason, 'warning');
        return;
    }

    console.log("[ACTION] requestContinue Setting isThinking=true aiWaiting=false proposing=false");
    state.geminiIsThinking = true;
    state.aiIsWaitingForAnswer = false;
    state.aiProposedCompletion = false;
    addThinkingIndicator();
    let domChangedInTry = true;
    manageButtonStates();

    // Промпт для продолжения
    const prompt = `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}" na úrovni Přijímaček. Naváž na PŘEDCHOZÍ OBSAH TABULE. Připrav další logickou část výkladu nebo komplexnější příklad na TABULI. Do CHATU napiš pouze "Na tabuli".`;

    try {
        console.log("[ACTION] requestContinue Calling sendToGemini v3.8 isChatInteraction=false");
        const response = await sendToGemini(prompt, false); // Не чат-интеракция
        console.log("[ACTION] requestContinue Gemini response received:", response);

        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data; // Ожидаем boardMarkdown
            const completionMarker = "[PROPOSE_COMPLETION]";
            let finalChatText = chatText;
            let proposedCompletion = false;

            if (chatText && chatText.includes(completionMarker)) {
                 finalChatText = chatText.replace(completionMarker, "").trim();
                 proposedCompletion = true;
                 console.log("[AI Action] AI proposed topic completion in response");
             }

            // Добавить контент на доску (основное)
            if (boardMarkdown) {
                const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
                if (placeholder) placeholder.remove();
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                domChangedInTry = true;
            } else {
                 // Если доски нет, это проблема
                 console.error("Gemini did not return board content for continue request");
                 await addChatMessage("Chyba AI zadny obsah", 'gemini', false);
                 domChangedInTry = true;
            }

            // Добавить минимальный чат (если есть)
            if (finalChatText) {
                await addChatMessage(finalChatText, 'gemini', false, new Date(), ttsCommentary);
                domChangedInTry = true;
            } else if (boardMarkdown) {
                 // Если есть доска, но нет чата, добавим стандартный
                 await addChatMessage("Na tabuli", 'gemini', false);
                 domChangedInTry = true;
            }

            // TTS
            if (ttsCommentary && boardMarkdown) {
                 speakText(ttsCommentary, ui.whiteboardContent?.lastElementChild);
            }

            // Обновляем флаг предложения
             state.aiProposedCompletion = proposedCompletion;
             if (proposedCompletion) {
                  showToast("Navrh AI", "AI navrhuje ukonceni Odpovezte Ano Ne", "info", 6000);
                  state.aiIsWaitingForAnswer = true; // Ждем Ano/Ne
                  console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true waiting for completion confirmation");
             } else if (boardMarkdown) {
                  // Если есть доска, предполагаем, что AI ждет реакции/решения
                  state.aiIsWaitingForAnswer = true;
                  console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true waiting for user action after board update");
             } else {
                  // Если доски нет (ошибка выше), не ждем
                  state.aiIsWaitingForAnswer = false;
                  console.log("[STATE CHANGE] aiIsWaitingForAnswer set to false due to missing board content");
             }

             if (domChangedInTry) {
                 initTooltips();
             }

        } else {
             console.error("Error response from Gemini:", response.error);
             const errorMsg = (response.error || "Neznama chyba AI").replace(/[.,!?;:]/g, '');
             await addChatMessage(errorMsg, 'gemini', false);
             domChangedInTry = true;
             state.aiIsWaitingForAnswer = false;
             state.aiProposedCompletion = false;
             console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false Gemini error`);
              if (domChangedInTry) initTooltips();
        }
    } catch (error) {
        console.error("Error in requestContinue catch block:", error);
        const errorMsg = `Chyba pokracovani ${error.message}`.replace(/[.,!?;:]/g, '');
        showError(errorMsg, false);
         await addChatMessage("Chyba systemu", 'gemini', false);
         domChangedInTry = true;
        state.aiIsWaitingForAnswer = false;
        state.aiProposedCompletion = false;
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false exception`);
         if (domChangedInTry) initTooltips();
    } finally {
        console.log("[ACTION] requestContinue Entering finally block");
        const indicatorRemoved = removeThinkingIndicator();
        console.log("[ACTION] requestContinue Setting isThinking=false in finally");
        state.geminiIsThinking = false;
        setLoadingState('chat', false);

        let nextUiState = 'learning';
        if(state.aiProposedCompletion) nextUiState = 'aiProposingCompletion';
        else if (state.aiIsWaitingForAnswer) nextUiState = 'waitingForAction';
        manageUIState(nextUiState);
        manageButtonStates();

        if (indicatorRemoved) initTooltips();
        console.log("[ACTION] requestContinue Exiting finally block");
    }
}


/**
 * Запускает сессию обучения для текущей темы (ожидает контент на доске).
 */
async function startLearningSession() {
    if (!state.currentTopic) {
        console.error("[ACTION] startLearningSession No current topic defined");
        manageUIState('error', {errorMessage: 'Chyba Tema neni definovano'});
        return;
    }
    console.log("[ACTION] startLearningSession triggered for topic:", state.currentTopic.name);

    // Сброс состояния
    state.currentSessionId = generateSessionId();
    state.geminiChatContext = [];
    state.boardContentHistory = [];
    if (ui.chatMessages) ui.chatMessages.innerHTML = '';
    if (ui.whiteboardContent) ui.whiteboardContent.innerHTML = '';
    state.aiIsWaitingForAnswer = false;
    state.aiProposedCompletion = false;

    console.log("[ACTION] startLearningSession Setting isThinking=true aiWaiting=false proposing=false");
    state.geminiIsThinking = true;
    manageUIState('requestingExplanation'); // Показываем заглушки загрузки
    addThinkingIndicator();
    let domChangedInTry = true;
    manageButtonStates();

    // Начальный промпт
    const prompt = `Vysvětli ZÁKLADY tématu "${state.currentTopic.name}" na úrovni Přijímaček. Začni PRVNÍ částí výkladu na TABULI. Do CHATU napiš pouze "Start".`;

    try {
        console.log("[ACTION] startLearningSession Calling sendToGemini v3.8 isChatInteraction=false");
        const response = await sendToGemini(prompt, false);
        console.log("[ACTION] startLearningSession Gemini response received:", response);

        // Убираем заглушки (если есть ответ)
        if (response.success && response.data && response.data.boardMarkdown) {
            const boardPlaceholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
            if (boardPlaceholder) { boardPlaceholder.remove(); console.log("Initial whiteboard placeholder removed"); }
            const chatPlaceholder = ui.chatMessages?.querySelector('.empty-state, .initial-load-placeholder');
             if (chatPlaceholder) { chatPlaceholder.remove(); console.log("Initial chat placeholder removed");}
        } else if (response.success && response.data && !response.data.boardMarkdown) {
             // Если нет доски, показываем сообщение об этом
             const boardPlaceholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
             if(boardPlaceholder) boardPlaceholder.innerHTML = `<i class='fas fa-chalkboard'></i><h3>Tabule prazdna</h3><p>AI neposkytlo uvodni obsah</p>`;
             const chatPlaceholder = ui.chatMessages?.querySelector('.empty-state, .initial-load-placeholder');
             if(chatPlaceholder) chatPlaceholder.innerHTML = `<i class='fas fa-comments'></i><h3>Chat</h3><p>AI neposkytlo uvodni obsah</p>`;
        }


        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data; // Ожидаем boardMarkdown
            const completionMarker = "[PROPOSE_COMPLETION]"; // Маловероятно здесь
            let finalChatText = chatText;
            let proposedCompletion = false;

            if (chatText && chatText.includes(completionMarker)) {
                 finalChatText = chatText.replace(completionMarker, "").trim();
                 proposedCompletion = true;
                 console.log("[AI Action] AI proposed topic completion unexpectedly in initial response");
             }

            // Добавить контент на доску
            if (boardMarkdown) {
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                domChangedInTry = true;
            } else {
                console.error("Gemini initial response missing board content");
                await addChatMessage("Chyba AI zadny obsah", 'gemini', false);
                domChangedInTry = true;
            }

            // Добавить минимальный чат
            if (finalChatText) {
                await addChatMessage(finalChatText, 'gemini', false, new Date(), ttsCommentary);
                domChangedInTry = true;
            } else if (boardMarkdown) {
                 await addChatMessage("Start", 'gemini', false); // Ожидаемый ответ по промпту
                 domChangedInTry = true;
            }

            // TTS
            if (ttsCommentary && boardMarkdown) {
                 speakText(ttsCommentary, ui.whiteboardContent?.lastElementChild);
            }

            // Обновляем флаги
             state.aiProposedCompletion = proposedCompletion; // Скорее всего false
             if (proposedCompletion) {
                  showToast("Navrh AI", "AI navrhuje ukonceni Odpovezte Ano Ne", "info", 6000);
                  state.aiIsWaitingForAnswer = true;
                  console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true waiting for completion confirmation");
             } else if (boardMarkdown) {
                   // После первого объяснения ждем действия пользователя
                   state.aiIsWaitingForAnswer = true;
                   console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true waiting for user action after initial explanation");
             } else {
                   state.aiIsWaitingForAnswer = false; // Ошибка -> не ждем
                   console.log("[STATE CHANGE] aiIsWaitingForAnswer set to false due to missing initial board content");
             }

             if (domChangedInTry) {
                 initTooltips();
             }

        } else {
             console.error("Error response from Gemini:", response.error);
             const errorMsg = (response.error || "Neznama chyba AI").replace(/[.,!?;:]/g, '');
             await addChatMessage(errorMsg, 'gemini', false);
             domChangedInTry = true;
             if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba nacitani</h3></div>`; }
             state.aiIsWaitingForAnswer = false;
             state.aiProposedCompletion = false;
             console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false Gemini error`);
             showError(`Chyba AI pri startu ${errorMsg}`, false);
              if (domChangedInTry) initTooltips();
        }
    } catch(error) {
        console.error("Error in startLearningSession catch block:", error);
        const errorMsg = `Chyba zahajeni vykladu ${error.message}`.replace(/[.,!?;:]/g, '');
        showError(errorMsg, false);
        if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba systemu</h3></div>`; }
        await addChatMessage("Chyba systemu start", 'gemini', false);
        domChangedInTry = true;
        state.aiIsWaitingForAnswer = false;
        state.aiProposedCompletion = false;
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false exception`);
         if (domChangedInTry) initTooltips();
    } finally {
        console.log("[ACTION] startLearningSession Entering finally block");
        const indicatorRemoved = removeThinkingIndicator();
        console.log("[ACTION] startLearningSession Setting isThinking=false in finally");
        state.geminiIsThinking = false;
        setLoadingState('chat', false);

        let nextUiState = 'learning';
        if(state.aiProposedCompletion) nextUiState = 'aiProposingCompletion';
        else if (state.aiIsWaitingForAnswer) nextUiState = 'waitingForAction';
        manageUIState(nextUiState);
        manageButtonStates();

        if (indicatorRemoved) initTooltips();
        console.log("[ACTION] startLearningSession Exiting finally block");
    }
}


/**
 * Поток действий при подтверждении завершения темы пользователем.
 */
async function completeTopicFlow() {
    if (!state.currentTopic || !state.currentUser) {
        console.error("[Flow] Cannot complete topic missing topic or user data");
        showToast("Chyba", "Nelze dokoncit tema chybi data", "error");
        return;
    }
    if (state.topicLoadInProgress || state.isLoading.points) {
         console.warn("[Flow] Completion already in progress or points being loaded");
         return;
    }

    console.log(`[Flow] Starting topic completion flow for activity ${state.currentTopic.activity_id}`);
    state.topicLoadInProgress = true;
    setLoadingState('points', true);
    manageButtonStates(); // Блокируем кнопки

    try {
        // 1. Отметить тему как завершенную в БД
        console.log(`[Flow] Calling markTopicComplete for activity ${state.currentTopic.activity_id}`);
        const successMark = await markTopicComplete(state.currentTopic.activity_id, state.currentUser.id);

        if (!successMark) {
             throw new Error("Nepodarilo se oznacit tema jako dokoncene v databazi");
        }
        console.log(`[Flow] Topic marked complete in DB`);

        // 2. Начислить очки
        console.log(`[Flow] --> Calling awardPoints userId ${state.currentUser.id} points ${POINTS_TOPIC_COMPLETE}`);
        const pointsAwarded = await awardPoints(state.currentUser.id, POINTS_TOPIC_COMPLETE);
        setLoadingState('points', false); // Снимаем флаг загрузки очков СРАЗУ после вызова
        console.log(`[Flow] <-- awardPoints returned ${pointsAwarded}`);

        // Показать уведомления об очках (улучшенная обратная связь)
        if (pointsAwarded) {
            showToast('BODY PRIPSANY', `${POINTS_TOPIC_COMPLETE} kreditu ziskano`, 'success', 3500);
            updateUserInfoUI(); // Обновить UI (например, сайдбар)
        } else {
            // Ошибка уже залогирована в awardPoints
            showToast('CHYBA BODU', 'Tema dokonceno ale body se nepodarilo pripsat Zkontrolujte konzoli', 'warning', 5000);
        }

        // 3. Сообщить пользователю и подготовиться к редиректу
        showToast('Tema dokonceno', `Tema ${state.currentTopic.name} uzavreno`, "success", 4000);
        await addChatMessage("Tema uzavreno", 'gemini', false); // Кратко в чат, не сохраняем

        // 4. Редирект на главную страницу раздела
        console.log("[Flow] Redirecting to /dashboard/procvicovani/main.html in 3 seconds");
        showToast("Presmerovani", "Za chvili budete presmerovani", "info", 3000);
        setTimeout(() => {
            window.location.href = '/dashboard/procvicovani/main.html';
        }, 3000); // Задержка 3 секунды

    } catch (error) {
        console.error("[Flow] Error in completeTopicFlow:", error);
        const errorMsg = `Nepodarilo se dokoncit tema ${error.message}`.replace(/[.,!?;:]/g, '');
        showToast("Chyba dokonceni", errorMsg, "error");
        state.topicLoadInProgress = false;
        setLoadingState('points', false);
        manageButtonStates(); // Разблокировать кнопки
    }
}

/** Поток действий для загрузки следующей темы. */
async function loadNextTopicFlow() {
    if (!state.currentUser) { console.log(`[Flow] Load next topic skipped No user`); return; }
    if (state.topicLoadInProgress) { console.log(`[Flow] Load next topic skipped Already in progress`); return; }

    console.log("[Flow] Loading next topic flow STARTED Setting topicLoadInProgress=true");
    state.topicLoadInProgress = true;
    setLoadingState('currentTopic', true);
    state.currentTopic = null;
    state.geminiChatContext = [];
    state.boardContentHistory = []; // Сброс истории доски
    state.aiIsWaitingForAnswer = false;
    state.aiProposedCompletion = false;
    console.log("[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false by loadNextTopicFlow start");

    // Обновляем UI для отображения загрузки
    if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Nacitam dalsi tema</span>';
    clearWhiteboard(true); // Полная очистка доски
    if (ui.chatMessages) ui.chatMessages.innerHTML = ''; // Полная очистка чата
    manageUIState('loadingTopic');
    manageButtonStates();

    try {
        console.log("[Flow] Calling loadNextUncompletedTopic");
        const result = await loadNextUncompletedTopic(state.currentUser.id);
        console.log("[Flow] loadNextUncompletedTopic result:", result);

        if (result.success && result.topic) {
            // Тема успешно загружена
            state.currentTopic = result.topic;
            if (ui.currentTopicDisplay) {
                ui.currentTopicDisplay.innerHTML = `Tema <strong>${sanitizeHTML(state.currentTopic.name)}</strong>`;
            }
            console.log("[Flow] Topic loaded successfully Resetting topicLoadInProgress=false Starting session");
            state.topicLoadInProgress = false;
            setLoadingState('currentTopic', false);
            await startLearningSession(); // Запускаем новую сессию

        } else {
            // Не удалось загрузить тему
            state.currentTopic = null;
            const message = (result.message || 'Neni dalsi tema nebo nastala chyba').replace(/[.,!?;:]/g, '');
            if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(${sanitizeHTML(message)})</span>`;
            console.log(`[Flow] No topic loaded or error Reason ${result.reason} Resetting topicLoadInProgress=false`);
            state.topicLoadInProgress = false;
            setLoadingState('currentTopic', false);
            manageUIState(result.reason || 'error', { errorMessage: message });
            manageButtonStates();
        }
    } catch(error) {
        console.error("Error in loadNextTopicFlow execution:", error);
        state.currentTopic = null;
        const errorMsg = `Chyba pri nacitani dalsiho tematu ${error.message}`.replace(/[.,!?;:]/g, '');
        if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(Chyba nacitani)</span>`;
        console.log("[Flow] Exception loading topic Resetting topicLoadInProgress=false");
        state.topicLoadInProgress = false;
        setLoadingState('currentTopic', false);
        manageUIState('error', { errorMessage: errorMsg });
        manageButtonStates();
    } finally {
         if (state.topicLoadInProgress) {
              console.warn("[Flow] topicLoadInProgress was still true in finally block Resetting");
              state.topicLoadInProgress = false;
              setLoadingState('currentTopic', false);
              manageButtonStates();
         }
          initTooltips(); // Обновить тултипы в конце загрузки темы
    }
    console.log("[Flow] Loading next topic flow FINISHED");
}

// --- Запуск Приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);