// vyukaApp.js - Основной файл приложения Vyuka (Версия 3.6 - Исправление Zastavit, Размера UI)

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
// Убедимся, что импортируем stopSpeech
import { loadVoices, speakText, stopSpeech, handleMicClick, initializeSpeechRecognition, removeBoardHighlight } from './speechService.js';
import { renderMarkdown, clearWhiteboard, appendToWhiteboard } from './whiteboardController.js';
import { addChatMessage, addThinkingIndicator, removeThinkingIndicator, confirmClearChat, saveChatToPDF, updateGeminiThinkingState /* Добавлен импорт */ } from './chatController.js';

// --- Основная Логика Приложения ---

const activityVisuals = { // Иконки для уведомлений
    test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' },
    diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' },
    level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, vyuka_start: { icon: 'fa-chalkboard-teacher', class: 'lesson'}, vyuka_complete: { icon: 'fa-flag-checkered', class: 'test'},
    achievement: { icon: 'fa-trophy', class: 'badge'}, info: { icon: 'fa-info-circle', class: 'info' }, warning: { icon: 'fa-exclamation-triangle', class: 'warning' },
    error: { icon: 'fa-exclamation-circle', class: 'danger' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' }
};

/** Главная функция инициализации приложения. */
async function initializeApp() {
    console.log("🚀 [Init Vyuka - Kyber V3.6] Starting App Initialization...");
    let initializationError = null;
    if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
    if (ui.mainContent) ui.mainContent.style.display = 'none';
    hideError(); // Скрыть предыдущие ошибки

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
            window.location.href = '/auth/index.html'; // Редирект на страницу входа
            return; // Прерываем инициализацию
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
            try { initializeUI(); updateUserInfoUI(); } // Попытка инициализировать UI даже при ошибке профиля
            catch (uiError) { console.error("UI Init failed during profile error:", uiError); }
            manageUIState('error', { errorMessage: initializationError.message });
            // Не прерываем полностью, позволяем отобразить ошибку
        } else {
            console.log("[INIT] Profile fetched successfully.");
        }

        // 4. Инициализация базового UI
        console.log("[INIT] Initializing base UI...");
        initializeUI(); // Инициализация обработчиков, темы и т.д.
        updateUserInfoUI(); // Обновление данных пользователя в сайдбаре

        // 5. Загрузка начальных данных (тема, уведомления) - только если профиль загружен
        if (state.currentProfile && !initializationError) {
            console.log("[INIT] Loading initial topic and notifications...");
            setLoadingState('currentTopic', true);
            setLoadingState('notifications', true);

            const loadNotificationsPromise = fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
                .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                .catch(err => {
                    console.error("Chyba při úvodním načítání notifikací:", err);
                    renderNotifications(0, []); // Отобразить пустой список
                    showToast('Chyba Notifikací', 'Nepodařilo se načíst signály.', 'error');
                })
                .finally(() => {
                    setLoadingState('notifications', false);
                    manageButtonStates(); // Обновить кнопки после загрузки уведомлений
                });

            const loadTopicPromise = loadNextTopicFlow() // Загрузка и запуск первой темы
                .catch(err => {
                    console.error("Chyba při načítání úvodního tématu:", err);
                    manageUIState('error', { errorMessage: `Chyba načítání tématu: ${err.message}` });
                    state.topicLoadInProgress = false; // Сбросить флаг загрузки
                    setLoadingState('currentTopic', false);
                });

            await Promise.all([loadNotificationsPromise, loadTopicPromise]);
            console.log("[INIT] Initial data loading complete (or errors handled).");
        } else {
            // Если была ошибка профиля или нет профиля, сбрасываем флаги загрузки
             setLoadingState('currentTopic', false);
             setLoadingState('notifications', false);
             manageButtonStates();
        }

    } catch (error) {
        console.error("❌ [Init Vyuka - Kyber V3.6] Critical initialization error:", error);
        initializationError = error;
        // Попытка инициализировать UI, если оно еще не было инициализировано, чтобы показать ошибку
        if (!document.getElementById('main-mobile-menu-toggle')) {
            try { initializeUI(); }
            catch (uiError) { console.error("Failed to initialize UI during critical error handling:", uiError); }
        }
        manageUIState('error', { errorMessage: error.message }); // Отобразить состояние ошибки
        setLoadingState('all', false); // Сбросить все флаги загрузки
        showError(`Chyba inicializace: ${error.message}`, true); // Показать глобальную ошибку
    } finally {
        console.log("[INIT] Finalizing initialization (finally block)...");
        // Скрыть индикатор загрузки и показать основной контент
        if (ui.initialLoader) {
            ui.initialLoader.classList.add('hidden');
            setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); // Задержка для анимации
        }
        if (ui.mainContent) {
            ui.mainContent.style.display = 'flex'; // Используем flex, т.к. основной layout на flexbox
            // Запускаем анимации после отображения контента
            requestAnimationFrame(() => {
                if (ui.mainContent) ui.mainContent.classList.add('loaded');
                initScrollAnimations(); // Инициализация анимаций прокрутки
            });
        }
        manageButtonStates(); // Установить финальное состояние кнопок
        console.log("✅ [Init Vyuka - Kyber V3.6] App Initialization Finished (finally block).");
    }
}

/** Инициализация базового UI и обработчиков. */
function initializeUI() {
    console.log("[UI Init] Initializing UI elements and handlers...");
    try {
        updateTheme();              // Установить тему (dark/light)
        setupEventListeners();      // Настроить обработчики событий
        initTooltips();             // Инициализировать всплывающие подсказки
        if (ui.chatTabButton) ui.chatTabButton.classList.add('active'); // Активировать вкладку чата
        if (ui.chatTabContent) ui.chatTabContent.classList.add('active');
        initializeSpeechRecognition(); // Инициализировать распознавание речи
        loadVoices(); // Начать загрузку голосов TTS
        initMouseFollower();         // Инициализировать эффект мыши
        initHeaderScrollDetection(); // Инициализировать эффект шапки при скролле
        updateCopyrightYear();       // Обновить год в футере
        updateOnlineStatus();        // Проверить онлайн-статус
        manageUIState('initial');   // Установить начальное состояние UI
        console.log("[UI Init] UI Initialized successfully.");
    } catch (error) {
        console.error("UI Init failed:", error);
        showError(`Chyba inicializace UI: ${error.message}`, false); // Показать ошибку (не глобальную)
        if (error.stack) console.error("Original stack trace:", error.stack);
    }
}

/** Настройка основных обработчиков событий. */
function setupEventListeners() {
    console.log("[SETUP] Setting up event listeners...");
    let listenersAttached = 0;

    // Вспомогательная функция для добавления слушателя с проверкой элемента
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
        if (e.key === 'Enter' && !e.shiftKey) { // Отправка по Enter (без Shift)
            e.preventDefault();
            handleSendMessage();
        }
    }, 'chatInput (keypress)');
    addListener(ui.clearChatBtn, 'click', () => confirmClearChat(), 'clearChatBtn');
    addListener(ui.saveChatBtn, 'click', saveChatToPDF, 'saveChatBtn');
    addListener(ui.micBtn, 'click', handleMicClick, 'micBtn'); // Микрофон

    // Доска и TTS
    addListener(ui.clearBoardBtn, 'click', () => {
        clearWhiteboard(false); // Очистить доску без уведомления (оно ниже)
        showToast('Vymazáno', "Tabule vymazána.", "info");
    }, 'clearBoardBtn');
    addListener(ui.stopSpeechBtn, 'click', stopSpeech, 'stopSpeechBtn'); // <<<=== Важно: Кнопка остановки TTS

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
    window.addEventListener('resize', () => { // Закрытие сайдбара при ресайзе окна
        if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) {
            closeMenu();
        }
    }); listenersAttached++;
    window.addEventListener('online', updateOnlineStatus); listenersAttached++;
    window.addEventListener('offline', updateOnlineStatus); listenersAttached++;

    // Уведомления
    addListener(ui.notificationBell, 'click', (event) => {
        event.stopPropagation(); // Предотвратить всплытие, чтобы не закрыть сразу по клику на document
        ui.notificationsDropdown?.classList.toggle('active');
    }, 'notificationBell');

    addListener(ui.markAllReadBtn, 'click', async () => {
        if (state.isLoading.notifications || !state.currentUser) return;
        setLoadingState('notifications', true);
        manageButtonStates();
        try {
            const success = await markAllNotificationsRead(state.currentUser.id);
            if(success) {
                const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT);
                renderNotifications(unreadCount, notifications); // Обновить UI
                showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení označena.', 'success');
            } else {
                showToast('CHYBA PŘENOSU', 'Nepodařilo se označit oznámení.', 'error');
            }
        } catch (err) {
            console.error("Error marking all notifications read:", err);
            showToast('CHYBA SYSTÉMU', 'Při označování nastala chyba.', 'error');
        } finally {
            setLoadingState('notifications', false);
            manageButtonStates();
        }
    }, 'markAllReadBtn');

    addListener(ui.notificationsList, 'click', async (event) => {
        const item = event.target.closest('.notification-item');
        if (item && !state.isLoading.notifications && state.currentUser) {
            const notificationId = item.dataset.id;
            const link = item.dataset.link;
            const isRead = item.classList.contains('is-read');

            // Отметить как прочитанное, если еще не прочитано
            if (!isRead && notificationId) {
                item.style.opacity = '0.5'; // Визуальный фидбек на время запроса
                const success = await markNotificationRead(notificationId, state.currentUser.id);
                item.style.opacity = ''; // Убрать фидбек
                if (success) {
                    item.classList.add('is-read');
                    item.querySelector('.unread-dot')?.remove();
                    // Обновить счетчик в шапке
                    const countEl = ui.notificationCount;
                    if (countEl) {
                        const currentCount = parseInt(countEl.textContent.replace('+', '') || '0');
                        const newCount = Math.max(0, currentCount - 1);
                        countEl.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                        countEl.classList.toggle('visible', newCount > 0);
                    }
                    manageButtonStates(); // Обновить состояние кнопки "Vymazat vše"
                } else {
                    showToast('Chyba', 'Nepodařilo se označit oznámení.', 'error');
                }
            }
            // Переход по ссылке, если она есть
            if (link) {
                ui.notificationsDropdown?.classList.remove('active'); // Закрыть дропдаун перед переходом
                window.location.href = link;
            }
        }
    }, 'notificationsList');

    // Закрытие дропдауна уведомлений при клике вне его
    document.addEventListener('click', (event) => {
        if (ui.notificationsDropdown?.classList.contains('active') &&
            !ui.notificationsDropdown.contains(event.target) &&
            !ui.notificationBell?.contains(event.target)) {
            ui.notificationsDropdown.classList.remove('active');
        }
    }); listenersAttached++;

    console.log(`[SETUP] Event listeners setup complete. Total attached (approx): ${listenersAttached}`);
}

// --- Обновление UI ---

/** Обновляет информацию о пользователе в UI (сайдбар). */
function updateUserInfoUI() {
    if (!ui.sidebarName || !ui.sidebarAvatar) { console.warn("updateUserInfoUI: Sidebar elements not found."); return; }
    if (state.currentUser && state.currentProfile) {
        // Имя пользователя
        const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot';
        ui.sidebarName.textContent = sanitizeHTML(displayName);

        // Аватар
        const initials = getInitials(state.currentProfile, state.currentUser.email);
        const avatarUrl = state.currentProfile.avatar_url;
        let finalUrl = avatarUrl;
        // Проверка валидности URL (простейшая)
        if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('//') && !avatarUrl.startsWith('data:')) {
            finalUrl = null; // Считаем URL невалидным, если он не абсолютный или data URI
            console.warn("Invalid avatar URL:", avatarUrl);
        } else if (avatarUrl) {
            finalUrl = sanitizeHTML(avatarUrl); // Очистка валидного URL
        }
        // Отображение аватара или инициалов
        ui.sidebarAvatar.innerHTML = finalUrl ? `<img src="${finalUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
        // Обработчик ошибки загрузки изображения
        const sidebarImg = ui.sidebarAvatar.querySelector('img');
        if (sidebarImg) {
            sidebarImg.onerror = function() {
                console.warn(`Failed to load avatar: ${this.src}`);
                ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); // Показать инициалы при ошибке
            };
        }
    } else {
        // Если данных нет
        ui.sidebarName.textContent = 'Nepřihlášen';
        ui.sidebarAvatar.textContent = '?';
    }
}

/** Отображает уведомления в выпадающем списке. */
 function renderNotifications(count, notifications) {
    console.log("[Render Notifications] Count:", count, "Notifications:", notifications ? notifications.length : 0);
    if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
        console.error("[Render Notifications] Missing UI elements.");
        return;
    }

    // Обновляем счетчик
    ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
    ui.notificationCount.classList.toggle('visible', count > 0);

    // Обновляем список
    if (notifications && notifications.length > 0) {
        ui.notificationsList.innerHTML = notifications.map(n => {
            const visual = activityVisuals[(n.type || 'default').toLowerCase()] || activityVisuals.default;
            const isReadClass = n.is_read ? 'is-read' : '';
            const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; // Ссылка для перехода
            const title = n.title || 'Nové oznámení';
            const message = n.message || '';
            const timeAgo = formatRelativeTime(n.created_at); // Относительное время

            return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
                        ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
                        <div class="notification-icon ${visual.class}">
                            <i class="fas ${visual.icon}"></i>
                        </div>
                        <div class="notification-content">
                            <div class="notification-title">${sanitizeHTML(title)}</div>
                            <div class="notification-message">${sanitizeHTML(message)}</div>
                            <div class="notification-time">${timeAgo}</div>
                        </div>
                    </div>`;
        }).join('');
        ui.noNotificationsMsg.style.display = 'none';
        ui.notificationsList.style.display = 'block';
        ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.add('has-content');
    } else {
        // Если уведомлений нет
        ui.notificationsList.innerHTML = '';
        ui.noNotificationsMsg.style.display = 'block';
        ui.notificationsList.style.display = 'none';
        ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.remove('has-content');
    }

    // Обновляем состояние кнопки "Vymazat vše"
    const currentUnreadCount = parseInt(ui.notificationCount.textContent.replace('+', '') || '0');
    ui.markAllReadBtn.disabled = currentUnreadCount === 0 || state.isLoading.notifications;
    console.log("[Render Notifications] Finished rendering.");
 }

/** Управляет общим состоянием интерфейса (что отображается). */
function manageUIState(mode, options = {}) {
    console.log("[UI State Change]:", mode, options);
    const isLearningActive = state.currentTopic && ['learning', 'chatting', 'requestingExplanation', 'waitingForAnswer'].includes(mode);
    const isEmptyState = ['noPlan', 'planComplete', 'error', 'loggedOut', 'initial', 'loadingTopic'].includes(mode);

    // Показать/Скрыть основной интерфейс обучения (доска + чат)
    if (ui.learningInterface) {
        const shouldShowInterface = !isEmptyState;
        ui.learningInterface.style.display = shouldShowInterface ? 'flex' : 'none';
        console.log(`[UI State] Learning interface display: ${shouldShowInterface ? 'flex' : 'none'}`);
    }

    // Обновить содержимое чата (или показать заглушку)
    if (ui.chatMessages) {
        let emptyStateHTML = '';
        // Показываем заглушку, если это пустой стейт ИЛИ если это активное обучение, но сообщений еще нет
        if (isEmptyState || (isLearningActive && !ui.chatMessages.querySelector('.chat-message'))) {
            // Очищаем, только если есть что очищать и нужно показать новую заглушку
             if (isEmptyState && ui.chatMessages.innerHTML !== '') {
                 ui.chatMessages.innerHTML = '';
             } else if (isLearningActive && ui.chatMessages.querySelector('.empty-state')) {
                 ui.chatMessages.innerHTML = ''; // Убираем предыдущую заглушку перед добавлением сообщения
             }

            switch (mode) {
                case 'loggedOut':
                    emptyStateHTML = `<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPŘIHLÁŠEN</h3><p>Pro přístup k výuce se prosím <a href="/auth/index.html" style="color: var(--accent-primary)">přihlaste</a>.</p></div>`;
                    break;
                case 'noPlan':
                    emptyStateHTML = `<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ŽÁDNÝ AKTIVNÍ PLÁN</h3><p>Nemáte aktivní studijní plán. Nejprve prosím dokončete <a href="/dashboard/procvicovani/test1.html" style="color: var(--accent-primary)">diagnostický test</a>.</p></div>`;
                    break;
                case 'planComplete':
                    emptyStateHTML = `<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLÁN DOKONČEN!</h3><p>Všechny naplánované aktivity jsou hotové. Skvělá práce! Můžete si <a href="/dashboard/procvicovani/plan.html" style="color: var(--accent-primary)">vytvořit nový plán</a>.</p></div>`;
                    break;
                case 'error':
                    emptyStateHTML = `<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA SYSTÉMU</h3><p>${sanitizeHTML(options.errorMessage || 'Nastala chyba při načítání dat.')}</p></div>`;
                    // Показываем глобальную ошибку, если она еще не видна
                    if (options.errorMessage && !document.getElementById('global-error')?.offsetParent) {
                        showError(options.errorMessage, true);
                    }
                    break;
                case 'initial':
                    emptyStateHTML = '<div class="empty-state"><i class="fas fa-cog fa-spin"></i><h3>Inicializace...</h3></div>';
                    break;
                case 'loadingTopic':
                    // Отображается, если chatMessages еще не содержит сообщений
                    if (!ui.chatMessages.querySelector('.chat-message')) {
                       emptyStateHTML = '<div class="empty-state initial-load-placeholder"><i class="fas fa-book-open" style="font-size: 2rem; margin-bottom: 1rem;"></i><p>Načítání tématu...</p></div>';
                    }
                    break;
                case 'learning':
                    // Отображается, только если еще нет сообщений
                    if (!ui.chatMessages.querySelector('.chat-message')) {
                        emptyStateHTML = `<div class='empty-state'><i class='fas fa-comments'></i><h3>Chat připraven</h3><p>Počkejte na první vysvětlení od AI nebo položte otázku.</p></div>`;
                    }
                    break;
            }
            if (emptyStateHTML) {
                ui.chatMessages.innerHTML = emptyStateHTML;
                console.log(`[UI State] Chat set to state: ${mode}`);
            }
        } else if (isLearningActive && ui.chatMessages.querySelector('.empty-state')) {
             // Если режим обучения активен и в чате есть заглушка, но должны быть сообщения (не попали в if выше), убираем заглушку
             ui.chatMessages.querySelector('.empty-state').remove();
             console.log("[UI State] Removed chat placeholder as learning is active and messages should appear.");
        }
    }

    // Обновить содержимое доски (или показать заглушку)
    if (ui.whiteboardContent) {
        const existingPlaceholder = ui.whiteboardContent.querySelector('.initial-load-placeholder, .empty-state');
         // Показываем заглушку, если это пустой стейт ИЛИ если это активное обучение, но кусков контента еще нет
        if (isEmptyState || (isLearningActive && !ui.whiteboardContent.querySelector('.whiteboard-chunk'))) {
            let emptyBoardHTML = '';
             // Очищаем, только если есть что очищать и нужно показать новую заглушку
             if (isEmptyState && ui.whiteboardContent.innerHTML !== '') {
                ui.whiteboardContent.innerHTML = '';
             } else if (isLearningActive && ui.whiteboardContent.querySelector('.empty-state')) {
                 ui.whiteboardContent.innerHTML = ''; // Убираем предыдущую заглушку
             }

            switch (mode) {
                case 'loadingTopic':
                    emptyBoardHTML = '<div class="empty-state initial-load-placeholder"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i><p>Načítání první lekce...</p></div>';
                    break;
                case 'error':
                    emptyBoardHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba Tabule</h3><p>${sanitizeHTML(options.errorMessage || 'Obsah nelze zobrazit.')}</p></div>`;
                    break;
                case 'noPlan':
                case 'planComplete':
                case 'loggedOut':
                    emptyBoardHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule</h3><p>Nejprve vyberte nebo načtěte téma.</p></div>`;
                    break;
                case 'initial':
                     emptyBoardHTML = `<div class='empty-state'><i class='fas fa-spinner fa-spin'></i><h3>Inicializace...</h3></div>`;
                    break;
                case 'learning':
                    // Показываем, только если еще нет кусков контента
                    if (!ui.whiteboardContent.querySelector('.whiteboard-chunk')) {
                        emptyBoardHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule připravena</h3><p>Zde se bude zobrazovat vysvětlení od AI.</p></div>`;
                    }
                    break;
            }
            if (emptyBoardHTML) {
                ui.whiteboardContent.innerHTML = emptyBoardHTML;
                console.log(`[UI State] Whiteboard set to state: ${mode}`);
            }
        } else if (isLearningActive && existingPlaceholder) {
            // Если режим обучения активен и на доске есть заглушка, но должны быть куски (не попали в if выше), убираем заглушку
            existingPlaceholder.remove();
            console.log("[UI State] Removed whiteboard placeholder as learning is active and chunks should appear.");
        }
    }

    manageButtonStates(); // Обновить состояние кнопок в соответствии с новым UI state
}

/**
 * Управляет активностью/неактивностью кнопок на основе текущего состояния.
 * Версия 3.6: Исправлено управление кнопкой Zastavit.
 */
function manageButtonStates() {
    // --- Состояния ---
    const hasTopic = !!state.currentTopic;
    const isThinking = state.geminiIsThinking;
    const isLoadingTopic = state.topicLoadInProgress;
    const isWaitingForAnswer = state.aiIsWaitingForAnswer;
    const isListening = state.isListening;
    // *** ИЗМЕНЕНИЕ v3.6: Прямая проверка статуса speechSynthesis ***
    const isSpeaking = state.speechSynthesisSupported && window.speechSynthesis.speaking;
    const isLoadingPoints = state.isLoading.points;
    const notificationsLoading = state.isLoading.notifications;
    const chatInputHasText = ui.chatInput?.value.trim().length > 0;
    const chatIsEmpty = !ui.chatMessages?.hasChildNodes() || !!ui.chatMessages?.querySelector('.empty-state');
    const boardIsEmpty = !ui.whiteboardContent?.hasChildNodes() || !!ui.whiteboardContent?.querySelector('.empty-state');
    const unreadNotifCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');

    // --- Комбинированные флаги ---
    // Заблокировано ли взаимодействие (кроме ожидания ответа и говорения)?
    const isBusyProcessing = isThinking || isLoadingTopic || isListening || isLoadingPoints;
    // Можно ли взаимодействовать (если есть тема и система не занята обработкой)?
    // Говорение (isSpeaking) НЕ должно блокировать основные взаимодействия (отправку, продолжение).
    const canInteract = hasTopic && !isBusyProcessing;
    // Можно ли завершить тему? (Говорение тоже не должно блокировать)
    const canComplete = hasTopic && !isBusyProcessing;
     // Можно ли использовать микрофон? (Нельзя, если говорит или занят)
     const canUseMic = hasTopic && !isBusyProcessing && !isSpeaking && state.speechRecognitionSupported;

    // --- Логирование текущего состояния ---
    // console.log(`[BTN STATE CHECK v3.6] Flags: hasTopic=${hasTopic}, isThinking=${isThinking}, isLoadingTopic=${isLoadingTopic}, isWaiting=${isWaitingForAnswer}, isListening=${isListening}, isSpeaking=${isSpeaking}, isLoadingPoints=${isLoadingPoints}`);
    // console.log(`[BTN STATE CHECK v3.6] Derived: isBusyProcessing=${isBusyProcessing}, canInteract=${canInteract}, canComplete=${canComplete}, canUseMic=${canUseMic}`);

    // --- Применение состояний к кнопкам ---
    const setButtonState = (button, isDisabled, reason) => {
        if (button && button.disabled !== isDisabled) {
            // console.log(`[BTN STATE] ${button.id || button.tagName}: ${isDisabled ? 'DISABLED' : 'ENABLED'} (Reason: ${reason})`);
            button.disabled = isDisabled;
        } else if (!button) {
             // console.warn(`[BTN STATE] Attempted to set state for non-existent button.`);
        }
    };

    // Кнопка Отправить: зависит от canInteract и наличия текста
    setButtonState(ui.sendButton, !canInteract || !chatInputHasText, `canInteract=${canInteract}, hasText=${chatInputHasText}`);
    if (ui.sendButton) ui.sendButton.innerHTML = isThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';

    // Поле ввода: зависит от canInteract
    setButtonState(ui.chatInput, !canInteract, `canInteract=${canInteract}`);
    if (ui.chatInput) {
        ui.chatInput.placeholder = isListening ? "Poslouchám..."
                                 : (ui.chatInput.disabled ? (isThinking ? "AI přemýšlí..." : (isLoadingTopic ? "Načítám téma..." : "Akce není dostupná..."))
                                 : (isWaitingForAnswer ? "Odpovězte AI nebo pokračujte..." : "Zeptejte se nebo odpovězte..."));
    }

    // Кнопка Pokracovat: зависит от canInteract
    setButtonState(ui.continueBtn, !canInteract, `canInteract=${canInteract}`);
    if (ui.continueBtn) ui.continueBtn.style.display = hasTopic ? 'inline-flex' : 'none';

    // Кнопка Dokončit: зависит от canComplete
    setButtonState(ui.markCompleteBtn, !canComplete, `canComplete=${canComplete}`);
    if (ui.markCompleteBtn) ui.markCompleteBtn.style.display = hasTopic ? 'inline-flex' : 'none';

    // *** ИЗМЕНЕНИЕ v3.6: Кнопка Zastavit управляется напрямую isSpeaking ***
    setButtonState(ui.stopSpeechBtn, !isSpeaking, `isSpeaking=${isSpeaking}`);

    // Остальные кнопки
    setButtonState(ui.clearBoardBtn, boardIsEmpty || isBusyProcessing || isSpeaking, `boardEmpty=${boardIsEmpty}, isBusy=${isBusyProcessing}, isSpeaking=${isSpeaking}`);
    setButtonState(ui.micBtn, !canUseMic, `canUseMic=${canUseMic}`);
    if (ui.micBtn) {
        ui.micBtn.classList.toggle('listening', isListening);
        ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporováno" : (isListening ? "Zastavit hlasový vstup" : (ui.micBtn.disabled ? (isSpeaking ? "Hlasový vstup nedostupný (AI mluví)" : "Hlasový vstup nedostupný") : "Zahájit hlasový vstup"));
    }
    setButtonState(ui.clearChatBtn, isBusyProcessing || chatIsEmpty || isSpeaking, `isBusy=${isBusyProcessing}, chatEmpty=${chatIsEmpty}, isSpeaking=${isSpeaking}`);
    setButtonState(ui.saveChatBtn, isBusyProcessing || chatIsEmpty || isSpeaking, `isBusy=${isBusyProcessing}, chatEmpty=${chatIsEmpty}, isSpeaking=${isSpeaking}`);
    setButtonState(ui.markAllReadBtn, unreadNotifCount === 0 || notificationsLoading, `unread=${unreadNotifCount}, loading=${notificationsLoading}`);
}


/**
 * Обработчик клика для динамических TTS кнопок (в чате и на доске).
 */
function handleDynamicTTSClick(event) {
    const button = event.target.closest('.tts-listen-btn');
    // Проверяем, есть ли у кнопки текст и не отключена ли она (на всякий случай)
    if (button && button.dataset.textToSpeak && !button.disabled) {
        const textToSpeak = button.dataset.textToSpeak;
        // Ищем родительский блок для возможной подсветки (только для доски)
        const chunkElement = button.closest('.whiteboard-chunk');
        speakText(textToSpeak, chunkElement); // Вызываем TTS
    }
}

// --- Обработчики Действий ---

/**
 * Обрабатывает отправку сообщения из чата.
 * !!! Здесь будут исправления для проблемы одного сообщения.
 */
async function handleSendMessage() {
    if (!state.currentUser || !state.currentProfile) { showError("Nelze odeslat zprávu, chybí data uživatele.", false); return; }
    console.log("[ACTION] handleSendMessage triggered.");

    // Перепроверяем возможность отправки здесь, так как состояние могло измениться
    const canSendNow = state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening;
    const text = ui.chatInput?.value.trim();

    console.log(`[ACTION] handleSendMessage: Check canSend=${canSendNow}, hasText=${!!text}`);

    if (!canSendNow || !text) {
        if (!canSendNow) showToast('Počkejte prosím', 'Systém je zaneprázdněn.', 'warning');
        if (!text) console.log("[ACTION] handleSendMessage: No text to send.");
        return; // Прерываем, если нельзя отправить или нет текста
    }

    // Сохраняем текст на случай ошибки, чтобы восстановить
    const inputBeforeSend = ui.chatInput?.value;
    // Очищаем поле ввода СРАЗУ для лучшего UX
    if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }

    try {
        // 1. Добавить сообщение пользователя в UI и контекст Gemini
        await addChatMessage(text, 'user'); // Сохранение в БД внутри addChatMessage
        initTooltips(); // Переинициализировать тултипы, если в сообщении есть элементы с ними
        state.geminiChatContext.push({ role: "user", parts: [{ text }] });

        // 2. Установить состояние "AI думает"
        console.log("[ACTION] handleSendMessage: Setting isThinking=true, aiWaiting=false");
        state.geminiIsThinking = true;
        state.aiIsWaitingForAnswer = false; // Отправка пользователем сбрасывает ожидание AI
        addThinkingIndicator();
        manageButtonStates(); // Обновить UI немедленно (заблокировать ввод и кнопку)

        // 3. Сформировать промпт для Gemini
        // Промпт теперь формируется внутри _buildGeminiPayloadContents
        let promptForGemini = text; // Передаем просто текст пользователя

        // 4. Отправить запрос к Gemini
        console.log("[ACTION] handleSendMessage: Calling sendToGemini...");
        // Указываем, что это взаимодействие в чате (isChatInteraction = true)
        const response = await sendToGemini(promptForGemini, true);
        console.log("[ACTION] handleSendMessage: Gemini response received:", response);

        // 5. Обработать ответ Gemini
        if (response.success && response.data) {
            const { chatText, ttsCommentary } = response.data; // Доска здесь не ожидается
            const isMeaningfulChatText = chatText && chatText.trim() !== '?';

            if (isMeaningfulChatText) {
                await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary); // Добавляем ответ AI
                initTooltips(); // Обновить тултипы для кнопки TTS в сообщении AI
                // Проверяем, содержит ли ответ AI вопрос, чтобы установить флаг ожидания
                const lowerChatText = chatText.toLowerCase();
                const isNowWaiting = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                console.log(`[STATE CHANGE] aiIsWaitingForAnswer evaluated to ${isNowWaiting} based on Gemini chat response.`);
                state.aiIsWaitingForAnswer = isNowWaiting;
            } else {
                // Если Gemini не вернул текст для чата (или только "?")
                console.warn("Gemini chat response missing or only '?'. Not setting aiIsWaitingForAnswer=true.");
                 state.aiIsWaitingForAnswer = false; // Убедимся, что сброшено
                 if (!chatText) {
                     // Можно добавить сообщение об отсутствии ответа, если нужно
                     // await addChatMessage("(AI neodpovědělo textem)", 'gemini', false);
                 }
            }
             // Если вернулся только ttsCommentary (маловероятно для чата, но возможно)
             if (ttsCommentary && !isMeaningfulChatText) {
                  speakText(ttsCommentary); // Просто воспроизвести звук
             }

        } else {
            // Ошибка от Gemini
            console.error("Error response from Gemini:", response.error);
            await addChatMessage(`Promiňte, nastala chyba: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
            state.aiIsWaitingForAnswer = false; // Сбросить ожидание при ошибке
            console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (Gemini error).`);
            // Восстановить текст в поле ввода при ошибке
            if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
        }
    } catch (error) {
        // Другие ошибки (сеть, javascript)
        console.error("Error in handleSendMessage catch block:", error);
        showError(`Došlo k chybě při odesílání zprávy: ${error.message}`, false);
        state.aiIsWaitingForAnswer = false; // Сбросить ожидание при ошибке
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (exception).`);
        // Восстановить текст в поле ввода при ошибке
        if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
    } finally {
        // 6. Убрать индикатор загрузки и обновить состояние кнопок
        console.log("[ACTION] handleSendMessage: Entering finally block.");
        removeThinkingIndicator();
        console.log("[ACTION] handleSendMessage: Setting isThinking=false in finally.");
        state.geminiIsThinking = false; // <<<=== Важно: Сбросить флаг "думает"
        setLoadingState('chat', false); // Обновить общий стейт загрузки чата
        manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning'); // Обновить общий UI state
        manageButtonStates(); // <<<=== Важно: Обновить состояние кнопок (разблокировать ввод/отправку)
        console.log("[ACTION] handleSendMessage: Exiting finally block.");
    }
}


/**
 * Запрашивает следующую часть объяснения у AI (кнопка "Pokračuj").
 */
async function requestContinue() {
    console.log("[ACTION] requestContinue triggered.");
    // Перепроверяем возможность
    const canContinueNow = state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening;
    console.log(`[ACTION] requestContinue: Check canContinue=${canContinueNow}`);

    if (!canContinueNow) {
        console.warn(`Cannot request continue: thinking=${state.geminiIsThinking}, loading=${state.topicLoadInProgress}, listening=${state.isListening}`);
        showToast('Nelze pokračovat', 'Systém je zaneprázdněn.', 'warning');
        return;
    }

    // 1. Установить состояние "AI думает"
    console.log("[ACTION] requestContinue: Setting isThinking=true, aiWaiting=false");
    state.geminiIsThinking = true;
    state.aiIsWaitingForAnswer = false; // "Продолжить" всегда сбрасывает ожидание
    addThinkingIndicator(); // Показать индикатор в чате
    manageButtonStates(); // Обновить кнопки

    // 2. Сформировать промпт
    // Промпт теперь формируется внутри _buildGeminiPayloadContents
    const prompt = `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}". Naváž na předchozí část. Vygeneruj další logickou část výkladu.`;

    try {
        // 3. Отправить запрос к Gemini (не как чат)
        console.log("[ACTION] requestContinue: Calling sendToGemini...");
        const response = await sendToGemini(prompt, false); // isChatInteraction = false
        console.log("[ACTION] requestContinue: Gemini response received:", response);

        // 4. Обработать ответ
        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            let domChanged = false; // Флаг для переинициализации тултипов
            const isMeaningfulChatText = chatText && chatText.trim() !== '?';

            // Добавить контент на доску
            if (boardMarkdown) {
                const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
                if (placeholder) placeholder.remove(); // Убрать заглушку, если была
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); // TTS передается сразу сюда
                domChanged = true;
            }

            // Добавить сообщение в чат (если есть)
            if (isMeaningfulChatText) {
                 // Передаем ttsCommentary сюда, чтобы кнопка TTS в чате использовала его, если он есть
                await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                domChanged = true;
                // Проверяем, содержит ли ответ вопрос
                const lowerChatText = chatText.toLowerCase();
                const isNowWaiting = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                console.log(`[STATE CHANGE] aiIsWaitingForAnswer evaluated to ${isNowWaiting} based on Gemini response.`);
                state.aiIsWaitingForAnswer = isNowWaiting;
            } else if (ttsCommentary && !boardMarkdown){
                 // Если есть только TTS (маловероятно при "продолжить", но возможно)
                 await addChatMessage("(Poslechněte si další část komentáře)", 'gemini', true, new Date(), ttsCommentary); domChanged = true;
                 state.aiIsWaitingForAnswer = false; // Нет текста в чате -> не ждем ответа
                 console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (only TTS).`);
            } else if (!boardMarkdown && !isMeaningfulChatText && !ttsCommentary){
                // Если ответ совсем пустой
                console.warn("Gemini continue request returned empty/meaningless content.");
                await addChatMessage("(AI neposkytlo další obsah, zkuste pokračovat znovu nebo položte otázku.)", 'gemini', false);
                state.aiIsWaitingForAnswer = false;
                console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (empty response).`);
            } else {
                 // Если есть доска, но нет текста в чате
                 state.aiIsWaitingForAnswer = false; // Не ждем ответа
                 console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (no meaningful chat text).`);
            }
            if (domChanged) initTooltips(); // Обновить тултипы
        } else {
             // Ошибка от Gemini
             console.error("Error response from Gemini:", response.error);
             await addChatMessage(`Promiňte, nastala chyba při pokračování: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
             state.aiIsWaitingForAnswer = false;
             console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (Gemini error).`);
        }
    } catch (error) {
        // Другие ошибки
        console.error("Error in requestContinue catch block:", error);
        showError(`Došlo k chybě při žádosti o pokračování: ${error.message}`, false);
        state.aiIsWaitingForAnswer = false;
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (exception).`);
    } finally {
        // 5. Убрать индикатор и обновить кнопки
        console.log("[ACTION] requestContinue: Entering finally block.");
        removeThinkingIndicator();
        console.log("[ACTION] requestContinue: Setting isThinking=false in finally.");
        state.geminiIsThinking = false; // <<<=== Важно: Сбросить флаг
        setLoadingState('chat', false);
        manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning'); // Обновить UI
        manageButtonStates(); // <<<=== Важно: Обновить кнопки
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
    state.geminiChatContext = []; // Очищаем историю для Gemini
    state.boardContentHistory = []; // Очищаем историю доски
    if (ui.chatMessages) ui.chatMessages.innerHTML = ''; // Очищаем чат
    if (ui.whiteboardContent) ui.whiteboardContent.innerHTML = ''; // Очищаем доску

    // 1. Установить состояние "AI думает" и обновить UI
    console.log("[ACTION] startLearningSession: Setting isThinking=true, aiWaiting=false");
    state.geminiIsThinking = true;
    state.aiIsWaitingForAnswer = false;
    manageUIState('requestingExplanation'); // Показываем заглушки "Запрос объяснения..."
    addThinkingIndicator(); // Индикатор в чате
    manageButtonStates(); // Обновить кнопки

    // 2. Сформировать начальный промпт
    // Промпт теперь формируется внутри _buildGeminiPayloadContents
    const prompt = `Vysvětli ZÁKLADY tématu "${state.currentTopic.name}". Začni PRVNÍ částí výkladu.`;

    try {
        // 3. Отправить запрос к Gemini
        console.log("[ACTION] startLearningSession: Calling sendToGemini...");
        const response = await sendToGemini(prompt, false); // isChatInteraction = false
        console.log("[ACTION] startLearningSession: Gemini response received:", response);

        // Убираем заглушки после получения ответа
        const boardPlaceholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
        if (boardPlaceholder) { boardPlaceholder.remove(); console.log("Initial whiteboard placeholder removed."); }
        else if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = ''; } // На всякий случай очищаем
        const chatPlaceholder = ui.chatMessages?.querySelector('.empty-state, .initial-load-placeholder');
        // Убираем заглушку чата, только если ответ не пустой
        if (response.success && response.data && (response.data.boardMarkdown || response.data.chatText || response.data.ttsCommentary)) {
            if (chatPlaceholder) { chatPlaceholder.remove(); console.log("Initial chat placeholder removed.");}
        } else if (chatPlaceholder) {
            // Если ответ пустой, меняем заглушку чата на "ожидание"
             chatPlaceholder.innerHTML = `<i class='fas fa-comments'></i><h3>Chat připraven</h3><p>Počkejte na první vysvětlení od AI nebo položte otázku.</p>`;
        }

        // 4. Обработать ответ
        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            let domChanged = false;
            const isMeaningfulChatText = chatText && chatText.trim() !== '?';

            // Добавить контент на доску
            if (boardMarkdown) {
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                domChanged = true;
            }

            // Добавить сообщение в чат
            if (isMeaningfulChatText) {
                await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                domChanged = true;
                 // Проверяем, содержит ли ответ вопрос
                const lowerChatText = chatText.toLowerCase();
                const isNowWaiting = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                console.log(`[STATE CHANGE] aiIsWaitingForAnswer evaluated to ${isNowWaiting} based on Gemini response.`);
                state.aiIsWaitingForAnswer = isNowWaiting;
            } else if (ttsCommentary && !boardMarkdown){
                 // Только TTS
                await addChatMessage("(Poslechněte si úvodní komentář)", 'gemini', true, new Date(), ttsCommentary); domChanged = true;
                state.aiIsWaitingForAnswer = false;
                console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (only TTS).`);
            } else if (!boardMarkdown && !isMeaningfulChatText && !ttsCommentary){
                 // Совсем пустой ответ
                 console.warn("Gemini initial response was empty/meaningless.");
                 await addChatMessage("(AI neposkytlo úvodní obsah. Zkuste položit otázku nebo požádat o pokračování.)", 'gemini', false);
                 // Показать заглушку на доске, если она пуста
                 if (!boardMarkdown && ui.whiteboardContent && !ui.whiteboardContent.hasChildNodes()) {
                      ui.whiteboardContent.innerHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule prázdná</h3><p>AI neposkytlo obsah.</p></div>`;
                 }
                 state.aiIsWaitingForAnswer = false; // Не ждем ответа
                 console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (empty response).`);
            } else {
                 // Есть доска, нет чата
                 state.aiIsWaitingForAnswer = false; // Не ждем ответа
                 console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (no meaningful chat text).`);
            }
            if(domChanged) { initTooltips(); } // Обновить тултипы
        } else {
             // Ошибка от Gemini
             console.error("Error response from Gemini:", response.error);
             await addChatMessage(`Promiňte, nastala chyba při zahájení výkladu: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
             // Показать ошибку на доске
             if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba načítání</h3><p>Obsah pro tabuli nelze zobrazit.</p></div>`; }
             state.aiIsWaitingForAnswer = false;
             console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (Gemini error).`);
             showError(`Chyba AI při startu: ${response.error}`, false);
        }
    } catch(error) {
        // Другие ошибки
        console.error("Error in startLearningSession catch block:", error);
        showError(`Došlo k chybě při zahájení výkladu: ${error.message}`, false);
        // Показать ошибку на доске и в чате
        if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba systému</h3><p>Nelze zahájit výuku.</p></div>`; }
        await addChatMessage(`Systémová chyba při startu: ${error.message}`, 'gemini', false);
        state.aiIsWaitingForAnswer = false;
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer set to false (exception).`);
    } finally {
        // 5. Убрать индикатор и обновить кнопки
        console.log("[ACTION] startLearningSession: Entering finally block.");
        removeThinkingIndicator();
        console.log("[ACTION] startLearningSession: Setting isThinking=false in finally.");
        state.geminiIsThinking = false; // <<<=== Важно: Сбросить флаг
        setLoadingState('chat', false);
        manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning'); // Обновить UI
        manageButtonStates(); // <<<=== Важно: Обновить кнопки
        console.log("[ACTION] startLearningSession: Exiting finally block.");
    }
}


/** Поток действий при нажатии "Označit jako dokončené". */
async function handleMarkTopicCompleteFlow() {
    // Перепроверяем возможность
    const canCompleteNow = !!state.currentTopic && !state.topicLoadInProgress && !state.isLoading.points && !state.geminiIsThinking && !window.speechSynthesis.speaking;
    console.log(`[ACTION] handleMarkTopicCompleteFlow: Check canComplete=${canCompleteNow}`);

    if (!canCompleteNow) {
        showToast("Nelze dokončit", "Počkejte na dokončení předchozí akce nebo přehrávání zvuku.", "warning");
        return;
    }

    // Запрашиваем подтверждение
    if (!confirm(`Opravdu označit téma "${state.currentTopic.name}" jako dokončené? Získáte ${POINTS_TOPIC_COMPLETE} kreditů.`)) {
        return; // Пользователь отменил
    }

    console.log(`[Flow] Marking topic ${state.currentTopic.activity_id} as complete. Setting flags...`);
    // Устанавливаем флаги загрузки
    state.topicLoadInProgress = true; // Используем этот флаг, т.к. он блокирует почти все
    setLoadingState('points', true);
    manageButtonStates(); // Блокируем кнопки

    try {
        // 1. Отметить тему как завершенную в БД
        const successMark = await markTopicComplete(state.currentTopic.activity_id, state.currentUser.id);

        if (successMark) {
            console.log(`[Flow] Topic marked complete. Awarding points...`);
            // 2. Начислить очки (если тема успешно отмечена)
            const pointsAwarded = await awardPoints(state.currentUser.id, POINTS_TOPIC_COMPLETE);
            setLoadingState('points', false); // Снимаем флаг загрузки очков
            console.log(`[Flow] Points awarding finished (Awarded: ${pointsAwarded}). Reset isLoading.points=false`);

            // Показать уведомления
            if (pointsAwarded) {
                showToast('+', `${POINTS_TOPIC_COMPLETE} kreditů získáno!`, 'success', 3000);
                // Обновить очки в профиле локально
                if(state.currentProfile) {
                    state.currentProfile.points = (state.currentProfile.points || 0) + POINTS_TOPIC_COMPLETE;
                    updateUserInfoUI(); // Обновить UI сайдбара
                }
            } else {
                showToast('Varování', 'Téma dokončeno, ale body se nepodařilo připsat.', 'warning');
            }
            showToast(`Téma "${state.currentTopic.name}" dokončeno!`, "success");

            // 3. Загрузить следующую тему
            console.log("[Flow] Topic completion success. Resetting topicLoadInProgress=false and loading next topic.");
            state.topicLoadInProgress = false; // Снимаем общий флаг блокировки ПЕРЕД загрузкой следующей темы
            await loadNextTopicFlow(); // <<<=== Запускаем загрузку следующей темы

        } else {
            // Если не удалось отметить тему
            showToast("Chyba při označování tématu jako dokončeného.", "error");
            console.log("[Flow] Topic completion failed (markTopicComplete returned false). Resetting flags.");
            state.topicLoadInProgress = false;
            setLoadingState('points', false);
            manageButtonStates(); // Разблокировать кнопки
        }
    } catch (error) {
        // Обработка других ошибок
        console.error("Error in handleMarkTopicCompleteFlow catch block:", error);
        showToast(`Neočekávaná chyba při dokončování tématu: ${error.message}`, "error");
        console.log("[Flow] Topic completion exception. Resetting flags.");
        state.topicLoadInProgress = false;
        setLoadingState('points', false);
        manageButtonStates(); // Разблокировать кнопки
    }
    // Больше не нужно сбрасывать topicLoadInProgress здесь, т.к. он сбрасывается перед loadNextTopicFlow или в catch/else
}

/** Поток действий для загрузки следующей темы. */
async function loadNextTopicFlow() {
    if (!state.currentUser) { console.log(`[Flow] Load next topic skipped: No user.`); return; }
    // Добавим проверку на state.topicLoadInProgress, чтобы избежать двойного запуска
    if (state.topicLoadInProgress) { console.log(`[Flow] Load next topic skipped: Already in progress.`); return; }

    console.log("[Flow] Loading next topic flow STARTED. Setting topicLoadInProgress=true.");
    state.topicLoadInProgress = true; // Устанавливаем флаг в начале
    setLoadingState('currentTopic', true); // Устанавливаем флаг для UI
    state.currentTopic = null; // Сбрасываем текущую тему
    state.geminiChatContext = []; // Сбрасываем контекст
    state.aiIsWaitingForAnswer = false; // Сбрасываем ожидание
    console.log("[STATE CHANGE] aiIsWaitingForAnswer set to false by loadNextTopicFlow start.");

    // Обновляем UI для отображения загрузки
    if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám další téma...</span>';
    clearWhiteboard(false); // Очищаем доску
    if (ui.chatMessages) ui.chatMessages.innerHTML = ''; // Очищаем чат
    manageUIState('loadingTopic'); // Показываем заглушки загрузки
    manageButtonStates(); // Блокируем кнопки на время загрузки

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
            setLoadingState('currentTopic', false); // Сбрасываем флаг UI
            await startLearningSession(); // Запускаем объяснение новой темы

        } else {
            // Не удалось загрузить тему (план завершен или ошибка)
            state.currentTopic = null;
            const message = result.message || 'Není další téma nebo nastala chyba.';
            if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(${sanitizeHTML(message)})</span>`;
            console.log(`[Flow] No topic loaded or error. Reason: ${result.reason}. Resetting topicLoadInProgress=false.`);
            state.topicLoadInProgress = false; // Сбрасываем флаг
            setLoadingState('currentTopic', false); // Сбрасываем флаг UI
            manageUIState(result.reason || 'error', { errorMessage: message }); // Показываем соответствующее состояние UI
            manageButtonStates(); // Обновляем кнопки
        }
    } catch(error) {
        // Обработка других ошибок при загрузке
        console.error("Error in loadNextTopicFlow execution:", error);
        state.currentTopic = null;
        if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(Chyba načítání)</span>`;
        console.log("[Flow] Exception loading topic. Resetting topicLoadInProgress=false.");
        state.topicLoadInProgress = false; // Сбрасываем флаг
        setLoadingState('currentTopic', false); // Сбрасываем флаг UI
        manageUIState('error', { errorMessage: `Chyba při načítání dalšího tématu: ${error.message}` });
        manageButtonStates(); // Обновляем кнопки
    } finally {
         // Убедимся, что флаг точно сброшен в конце, если вдруг что-то пошло не так
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