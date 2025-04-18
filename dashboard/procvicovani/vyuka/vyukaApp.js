// vyukaApp.js - Основной файл приложения Vyuka, инициализация и координация модулей

// --- Импорт Модулей ---
import { MAX_GEMINI_HISTORY_TURNS, NOTIFICATION_FETCH_LIMIT, POINTS_TOPIC_COMPLETE } from './config.js';
import { state } from './state.js';
import { ui } from './ui.js';
import {
    sanitizeHTML, getInitials, formatTimestamp, formatRelativeTime, autoResizeTextarea,
    generateSessionId, initTooltips, updateOnlineStatus, updateCopyrightYear,
    initMouseFollower, initScrollAnimations, initHeaderScrollDetection
} from './utils.js';
import { showToast, showError, hideError, setLoadingState, updateTheme } from './uiHelpers.js'; // <<< НОВЫЙ ФАЙЛ ДЛЯ UI ХЕЛПЕРОВ (см. ниже)
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

/**
 * Главная функция инициализации приложения.
 */
async function initializeApp() {
    console.log("🚀 [Init Vyuka - Kyber] Starting App Initialization...");
    if (ui.initialLoader) {
        ui.initialLoader.style.display = 'flex';
        ui.initialLoader.classList.remove('hidden');
    }
    if (ui.mainContent) ui.mainContent.style.display = 'none';
    hideGlobalError();

    const supabaseInitialized = initializeSupabase(); // Инициализируем Supabase из сервиса
    if (!supabaseInitialized) {
        showError("Kritická chyba: Nepodařilo se připojit k databázi.", true);
        if (ui.initialLoader) ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">Chyba připojení.</p>`;
        return;
    }
    state.supabase = supabaseInitialized; // Сохраняем клиент в глобальное состояние

    try {
        console.log("[INIT] Checking auth session...");
        const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
        if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);
        if (!session || !session.user) {
            console.log('[Init Vyuka - Kyber] Not logged in. Redirecting...');
            window.location.href = '/auth/index.html';
            return; // Прекращаем выполнение, если не авторизован
        }
        state.currentUser = session.user;
        console.log(`[INIT] User authenticated (ID: ${state.currentUser.id}).`);

        setLoadingState('user', true);
        state.currentProfile = await fetchUserProfile(state.currentUser.id); // Загружаем профиль
        updateUserInfoUI(); // Обновляем UI с данными профиля
        setLoadingState('user', false);
        if (!state.currentProfile) {
            showError("Profil nenalezen nebo se nepodařilo načíst.", true);
            manageUIState('error', { errorMessage: 'Profil nenalezen.' });
             // Скрыть лоадер и показать основной контент с ошибкой
             if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
             if (ui.mainContent) ui.mainContent.style.display = 'flex';
            return;
        }

        // Инициализация UI и слушателей ПОСЛЕ загрузки профиля
        initializeUI();

        console.log("[INIT] Loading initial topic and notifications...");
        const loadNotificationsPromise = fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
            .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications)) // Используем новую функцию рендера
            .catch(err => {
                console.error("Chyba při úvodním načítání notifikací:", err);
                renderNotifications(0, []); // Показать 0 при ошибке
            });

        const loadTopicPromise = loadNextTopicFlow(); // Запускаем поток загрузки темы

        await Promise.all([loadNotificationsPromise, loadTopicPromise]);

        // Показываем контент и скрываем лоадер
        if (ui.initialLoader) {
             ui.initialLoader.classList.add('hidden');
             setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500);
        }
        if (ui.mainContent) {
            ui.mainContent.style.display = 'flex'; // Используем flex для layout
            requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); }); // Плавное появление
        }
        requestAnimationFrame(initScrollAnimations); // Запуск анимаций скролла

        console.log("✅ [Init Vyuka - Kyber] Page Initialized.");

    } catch (error) {
        console.error("❌ [Init Vyuka - Kyber] Critical initialization error:", error);
        if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) {
            ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). Obnovte.</p>`;
        } else {
            showError(`Chyba inicializace: ${error.message}`, true);
        }
        if (ui.mainContent) ui.mainContent.style.display = 'flex'; // Показать контент для отображения ошибки
        setLoadingState('all', false); // Сбросить все состояния загрузки
    }
}

/**
 * Инициализация базового UI.
 */
function initializeUI() {
    try {
        updateTheme(); // Применить тему (из uiHelpers.js)
        setupEventListeners(); // Настроить слушатели
        initTooltips(); // Инициализировать тултипы (из utils.js)

        // Активировать вкладку чата по умолчанию
        if (ui.chatTabButton) ui.chatTabButton.classList.add('active');
        if (ui.chatTabContent) ui.chatTabContent.classList.add('active');

        // Инициализация TTS/STT (вызов из speechService)
        // Голоса уже должны загружаться при загрузке speechService
        // Распознавание речи инициализируется там же
        initializeSpeechRecognition(); // Убедимся, что объект создан

        // Инициализация UI эффектов (из utils.js)
        initMouseFollower();
        initHeaderScrollDetection();
        updateCopyrightYear();
        updateOnlineStatus();

        manageUIState('initial'); // Установить начальное состояние UI
        console.log("UI Initialized successfully.");
    } catch (error) {
        console.error("UI Init failed:", error);
        showError(`Chyba inicializace UI: ${error.message}`, true);
    }
}

/**
 * Настройка основных обработчиков событий.
 */
function setupEventListeners() {
    console.log("[SETUP] Setting up event listeners...");

    // Sidebar/Menu
    ui.mainMobileMenuToggle?.addEventListener('click', openMenu); // из utils.js
    ui.sidebarCloseToggle?.addEventListener('click', closeMenu); // из utils.js
    ui.sidebarOverlay?.addEventListener('click', closeMenu);     // из utils.js

    // Chat
    ui.chatInput?.addEventListener('input', autoResizeTextarea); // из utils.js
    ui.sendButton?.addEventListener('click', handleSendMessage);
    ui.chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    ui.clearChatBtn?.addEventListener('click', confirmClearChat); // из chatController.js
    ui.saveChatBtn?.addEventListener('click', saveChatToPDF);   // из chatController.js
    ui.micBtn?.addEventListener('click', handleMicClick);     // из speechService.js

    // Whiteboard / TTS
    ui.clearBoardBtn?.addEventListener('click', () => {
         clearWhiteboard(); // из whiteboardController.js
         showToast('Vymazáno', "Tabule vymazána.", "info"); // Показываем тост здесь
    });
    ui.stopSpeechBtn?.addEventListener('click', stopSpeech); // из speechService.js

    // Topic Control
    ui.continueBtn?.addEventListener('click', requestContinue);
    ui.markCompleteBtn?.addEventListener('click', handleMarkTopicCompleteFlow);

    // Chat Messages Area (Event Delegation for TTS buttons in messages)
    ui.chatMessages?.addEventListener('click', (event) => {
        const button = event.target.closest('.tts-listen-btn');
        if (button && button.dataset.textToSpeak) {
            speakText(button.dataset.textToSpeak); // из speechService.js
        }
    });
     // Whiteboard Area (Event Delegation for TTS buttons in chunks - moved to whiteboardController)
     // Event delegation is now handled inside appendToWhiteboard

    // Theme Change
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        state.isDarkMode = event.matches;
        console.log("Theme changed, isDarkMode:", state.isDarkMode);
        updateTheme(); // из uiHelpers.js
    });

    // Window Resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) {
            closeMenu(); // из utils.js
        }
    });

    // Online/Offline Status
    window.addEventListener('online', updateOnlineStatus); // из utils.js
    window.addEventListener('offline', updateOnlineStatus);// из utils.js

    // Notifications Dropdown
    ui.notificationBell?.addEventListener('click', (event) => {
        event.stopPropagation();
        ui.notificationsDropdown?.classList.toggle('active');
    });
    ui.markAllReadBtn?.addEventListener('click', async () => {
        setLoadingState('notifications', true);
        const success = await markAllNotificationsRead(state.currentUser.id);
        if(success) {
            const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT);
            renderNotifications(unreadCount, notifications);
            showToast('SIGNÁLY VYMAZÁНЫ', 'Všechna oznámení byla označena jako přečtená.', 'success');
        } else {
             showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error');
        }
        setLoadingState('notifications', false);
    });
    ui.notificationsList?.addEventListener('click', async (event) => {
        const item = event.target.closest('.notification-item');
        if (item) {
            const notificationId = item.dataset.id;
            const link = item.dataset.link;
            const isRead = item.classList.contains('is-read');
            if (!isRead && notificationId) {
                const success = await markNotificationRead(notificationId, state.currentUser.id);
                if (success) {
                    item.classList.add('is-read');
                    item.querySelector('.unread-dot')?.remove();
                    const currentCountText = ui.notificationCount.textContent.replace('+', '');
                    const currentCount = parseInt(currentCountText) || 0;
                    const newCount = Math.max(0, currentCount - 1);
                    ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                    ui.notificationCount.classList.toggle('visible', newCount > 0);
                    if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0;
                } else {
                     showToast('Chyba', 'Nepodařilo se označit oznámení.', 'error');
                }
            }
            // Скрыть dropdown после клика по уведомлению (если есть ссылка)
            if(link) {
                 ui.notificationsDropdown?.classList.remove('active');
                 window.location.href = link;
             }
        }
    });
    document.addEventListener('click', (event) => {
        if (ui.notificationsDropdown?.classList.contains('active') &&
            !ui.notificationsDropdown.contains(event.target) &&
            !ui.notificationBell?.contains(event.target)) {
            ui.notificationsDropdown.classList.remove('active');
        }
    });

    console.log("Event listeners setup complete.");
}

// --- Обновление UI ---

/**
 * Обновляет информацию о пользователе в UI (сайдбар).
 */
function updateUserInfoUI() {
    if (!ui.sidebarName || !ui.sidebarAvatar) return;
    if (state.currentUser && state.currentProfile) {
        const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot';
        ui.sidebarName.textContent = sanitizeHTML(displayName);
        const initials = getInitials(state.currentProfile, state.currentUser.email); // из utils.js
        const avatarUrl = state.currentProfile.avatar_url;
        const finalUrl = avatarUrl && !avatarUrl.startsWith('assets/') ? `${avatarUrl}?t=${Date.now()}` : avatarUrl; // Cache busting for external URLs
        ui.sidebarAvatar.innerHTML = finalUrl ? `<img src="${sanitizeHTML(finalUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
    } else {
        ui.sidebarName.textContent = 'Nepřihlášen';
        ui.sidebarAvatar.textContent = '?';
    }
}

/**
 * Отображает уведомления в выпадающем списке.
 * @param {number} count - Общее количество непрочитанных уведомлений.
 * @param {Array} notifications - Массив объектов уведомлений для отображения.
 */
 function renderNotifications(count, notifications) {
     console.log("[Render Notifications] Count:", count, "Notifications:", notifications);
     if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
         console.error("[Render Notifications] Missing UI elements.");
         return;
     }
     ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
     ui.notificationCount.classList.toggle('visible', count > 0);

     if (notifications && notifications.length > 0) {
         ui.notificationsList.innerHTML = notifications.map(n => {
             // Используем activityVisuals для иконок, если тип совпадает
             const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default;
             const isReadClass = n.is_read ? 'is-read' : '';
             const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : '';
             return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
                         ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
                         <div class="notification-icon ${visual.class}">
                              <i class="fas ${visual.icon}"></i>
                         </div>
                         <div class="notification-content">
                             <div class="notification-title">${sanitizeHTML(n.title)}</div>
                             <div class="notification-message">${sanitizeHTML(n.message)}</div>
                             <div class="notification-time">${formatRelativeTime(n.created_at)}</div>
                         </div>
                     </div>`;
         }).join('');
         ui.noNotificationsMsg.style.display = 'none';
         ui.notificationsList.style.display = 'block';
         ui.markAllReadBtn.disabled = count === 0;
     } else {
         ui.notificationsList.innerHTML = '';
         ui.noNotificationsMsg.style.display = 'block';
         ui.notificationsList.style.display = 'none';
         ui.markAllReadBtn.disabled = true;
     }
     console.log("[Render Notifications] Finished rendering.");
 }

/**
 * Управляет общим состоянием интерфейса (загрузка, ошибки, пустые состояния).
 * @param {'initial'|'loadingTopic'|'learning'|'chatting'|'requestingExplanation'|'waitingForAnswer'|'noPlan'|'planComplete'|'error'|'loggedOut'} mode - Текущий режим UI.
 * @param {object} options - Дополнительные опции (напр., errorMessage).
 */
function manageUIState(mode, options = {}) {
    console.log("[UI State]:", mode, options);
    const isLearningActive = ['learning', 'chatting', 'requestingExplanation', 'waitingForAnswer', 'loadingTopic', 'initial'].includes(mode);

    // Показать/скрыть основной интерфейс обучения
    if (ui.learningInterface) {
         // Показываем, если есть тема, идет загрузка, есть ошибка или это начальное состояние
        const showInterface = !!state.currentTopic || ['loadingTopic', 'requestingExplanation', 'noPlan', 'planComplete', 'error', 'initial', 'loadingUser'].includes(mode);
        ui.learningInterface.style.display = showInterface ? 'flex' : 'none';
    }

    // Обновление состояния "AI думает..."
    // (Теперь управляется кнопками/запросами)

    // Отображение сообщений об ошибках или пустых состояниях в чате
    if (ui.chatMessages && !isLearningActive && mode !== 'loadingUser') {
        let emptyStateHTML = '';
        switch (mode) {
            case 'loggedOut': emptyStateHTML = `<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPŘIHLÁŠEN</h3><p>Pro přístup k výuce se prosím <a href="/auth/index.html" style="color: var(--accent-primary)">přihlaste</a>.</p></div>`; break;
            case 'noPlan': emptyStateHTML = `<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ŽÁDNÝ AKTIVNÍ PLÁN</h3><p>Nemáte aktivní studijní plán. Nejprve prosím dokončete <a href="/dashboard/procvicovani/test1.html" style="color: var(--accent-primary)">diagnostický test</a>.</p></div>`; break;
            case 'planComplete': emptyStateHTML = `<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLÁN DOKONČEN!</h3><p>Všechny naplánované aktivity jsou hotové. Skvělá práce! Můžete si <a href="/dashboard/procvicovani/plan.html" style="color: var(--accent-primary)">vytvořit nový plán</a>.</p></div>`; break;
            case 'error': emptyStateHTML = `<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA SYSTÉMU</h3><p>${sanitizeHTML(options.errorMessage || 'Nastala chyba při načítání dat.')}</p></div>`; break;
            case 'initial': emptyStateHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Inicializace...</h3></div>'; break;
            default: emptyStateHTML = ''; // Не очищать, если состояние learning или chatting
        }
        if (emptyStateHTML) { ui.chatMessages.innerHTML = emptyStateHTML; }
    } else if (ui.chatMessages && mode === 'loadingTopic') {
        ui.chatMessages.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>NAČÍTÁNÍ TÉMATU...</h3></div>';
    }

    manageButtonStates(); // Обновляем состояние кнопок
}

/**
 * Управляет активностью/неактивностью кнопок в зависимости от состояния приложения.
 */
function manageButtonStates() {
    const canInteractNormally = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.aiIsWaitingForAnswer;
    const canContinueOrComplete = canInteractNormally;
    const canChat = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress; // Чат доступен всегда, когда есть тема и AI не думает (даже если ждет ответ)

    // Кнопка отправки в чате
    if (ui.sendButton) {
        ui.sendButton.disabled = !canChat || state.isListening;
        ui.sendButton.innerHTML = state.geminiIsThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
    }
    // Поле ввода чата
    if (ui.chatInput) {
        ui.chatInput.disabled = !canChat || state.isListening;
        ui.chatInput.placeholder = state.isListening ? "Poslouchám..." : (canChat ? (state.aiIsWaitingForAnswer ? "Odpovězte na otázku AI..." : "Zeptejte se nebo odpovězte...") : "Počkejte prosím...");
    }
    // Кнопки управления темой
    if (ui.continueBtn) {
        ui.continueBtn.disabled = !canContinueOrComplete;
        ui.continueBtn.style.display = state.currentTopic ? 'inline-flex' : 'none';
    }
    if (ui.markCompleteBtn) {
        ui.markCompleteBtn.disabled = !canContinueOrComplete;
        ui.markCompleteBtn.style.display = state.currentTopic ? 'inline-flex' : 'none';
    }
    // Кнопки доски/речи
    if (ui.clearBoardBtn) { ui.clearBoardBtn.disabled = !ui.whiteboardContent || state.geminiIsThinking; }
    if (ui.stopSpeechBtn) { ui.stopSpeechBtn.disabled = !state.speechSynthesisSupported; }
    // Кнопка микрофона
    if (ui.micBtn) {
        const canUseMic = canChat && state.speechRecognitionSupported;
        ui.micBtn.disabled = !canUseMic; // Блокируем, только если нет темы/AI думает ИЛИ если STT не поддерживается
        ui.micBtn.classList.toggle('listening', state.isListening);
        ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporováno" : state.isListening ? "Zastavit hlasový vstup" : "Zahájit hlasový vstup";
    }
    // Утилиты чата
    if (ui.clearChatBtn) ui.clearChatBtn.disabled = state.geminiIsThinking;
    if (ui.saveChatBtn) ui.saveChatBtn.disabled = state.geminiIsThinking;
}


// --- Обработчики Действий ---

/**
 * Обрабатывает отправку сообщения из чата.
 */
async function handleSendMessage() {
    const text = ui.chatInput?.value.trim();
    if (!text || state.geminiIsThinking || !state.currentTopic || state.isListening) return;

    if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(); } // Очистка и ресайз из utils.js

    // 1. Добавляем сообщение пользователя в UI и контекст
    await addChatMessage(text, 'user'); // из chatController.js
    state.geminiChatContext.push({ role: "user", parts: [{ text }] });

    // 2. Устанавливаем состояние "AI думает"
    setLoadingState('chat', true);
    addThinkingIndicator(); // из chatController.js
    manageButtonStates(); // Обновляем кнопки

    // 3. Определяем промпт для Gemini
    let promptForGemini;
    if (state.aiIsWaitingForAnswer) {
         // AI ждал ответа
         promptForGemini = `Student odpověděl: "${text}". Téma je "${state.currentTopic.name}". Vyhodnoť prosím tuto odpověď stručně v rámci konverzace. Vysvětli případné chyby. Odpovídej POUZE textem do chatu. Poté polož další otázku NEBO navrhni pokračování ve výkladu.`;
         state.aiIsWaitingForAnswer = false; // Считаем, что AI теперь управляет потоком
    } else {
         // Общий запрос или комментарий пользователя
         promptForGemini = `Student píše do chatu: "${text}". Odpověz textem v chatu k tématu "${state.currentTopic.name}". Měj na paměti, co už bylo vysvětleno. Odpovídej POUZE textem do chatu. Neposílej žádný Markdown pro tabuli, pokud to není explicitně vyžádáno pro opravu nebo doplnění tabule.`;
    }

    // 4. Отправляем запрос в Gemini
    const response = await sendToGemini(promptForGemini, true); // true - это взаимодействие в чате

    // 5. Обрабатываем ответ
    removeThinkingIndicator(); // из chatController.js
    if (response.success && response.data) {
        const { chatText, ttsCommentary } = response.data; // Нам нужен только chatText и, возможно, TTS для него
        if (chatText) {
            await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary); // из chatController.js
             // Проверяем, задал ли ИИ вопрос снова
             const lowerChatText = chatText.toLowerCase();
             if (lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste') || lowerChatText.includes('vypočítejte') || lowerChatText.includes('otázka:') || chatText.endsWith('?') || lowerChatText.includes('můžeš mi říct') ) {
                state.aiIsWaitingForAnswer = true;
                console.log("AI is waiting for an answer.");
                manageUIState('waitingForAnswer');
             } else {
                state.aiIsWaitingForAnswer = false;
                manageUIState('learning'); // Или 'chatting'
             }
        } else {
             // Если AI ответил только TTS или ничего (что не должно быть для чата)
             console.warn("Gemini responded only with TTS/Board or empty for a chat interaction.");
             if (ttsCommentary) await addChatMessage("(Poslechněte si komentář)", 'gemini', true, new Date(), ttsCommentary);
             state.aiIsWaitingForAnswer = false; // Сбрасываем ожидание
             manageUIState('learning');
        }
    } else {
        // Ошибка от Gemini
        console.error("Error response from Gemini:", response.error);
        await addChatMessage(`Promiňte, nastala chyba: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false, new Date());
        state.aiIsWaitingForAnswer = false; // Сбрасываем ожидание при ошибке
        manageUIState('learning'); // Возвращаемся в стандартный режим
    }

    setLoadingState('chat', false);
    manageButtonStates();
}


/**
 * Запрашивает следующую часть объяснения у AI.
 */
async function requestContinue() {
    if (state.geminiIsThinking || !state.currentTopic || state.aiIsWaitingForAnswer) return;

    setLoadingState('chat', true); // Используем тот же лоадер чата
    addThinkingIndicator(); // из chatController.js
    manageButtonStates();

    const prompt = `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Naváž na předchozí část. Vygeneruj další logickou část výkladu.\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`; // Используем внутреннюю функцию _buildContinuePrompt из geminiService

    const response = await sendToGemini(prompt, false); // false - это не прямой чат, а запрос на объяснение

    removeThinkingIndicator();
    if (response.success && response.data) {
        const { boardMarkdown, ttsCommentary, chatText } = response.data;
        if (boardMarkdown) {
            appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); // из whiteboardController.js
        }
        if (chatText) {
            // Отображаем текст из ответа AI в чате, если он есть (может быть вопрос)
            await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary); // из chatController.js
            const lowerChatText = chatText.toLowerCase();
             if (lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste') || lowerChatText.includes('vypočítejte') || lowerChatText.includes('otázka:') || chatText.endsWith('?') || lowerChatText.includes('můžeš mi říct') ) {
                state.aiIsWaitingForAnswer = true;
                console.log("AI asked a question after continuing.");
                manageUIState('waitingForAnswer');
             } else {
                 state.aiIsWaitingForAnswer = false;
                 manageUIState('learning');
             }
        } else if (ttsCommentary && !boardMarkdown) {
            // Если есть только TTS, добавляем заглушку в чат
            await addChatMessage("(Poslechněte si další část komentáře)", 'gemini', true, new Date(), ttsCommentary);
             state.aiIsWaitingForAnswer = false;
             manageUIState('learning');
        } else if (!boardMarkdown && !chatText && !ttsCommentary){
            console.warn("Gemini continue request returned empty content.");
            await addChatMessage("(AI neposkytlo další obsah)", 'gemini', false, new Date());
             state.aiIsWaitingForAnswer = false;
             manageUIState('learning');
        } else {
             state.aiIsWaitingForAnswer = false;
             manageUIState('learning');
        }
        // Озвучиваем комментарий, если он был предоставлен (даже если был markdown)
        if (ttsCommentary) {
             speakText(ttsCommentary); // из speechService.js
        }

    } else {
        console.error("Error response from Gemini on continue:", response.error);
        await addChatMessage(`Promiňte, nastala chyba při pokračování: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false, new Date());
        state.aiIsWaitingForAnswer = false;
        manageUIState('learning');
    }

    setLoadingState('chat', false);
    manageButtonStates();
}

/**
 * Запускает сессию обучения для текущей темы.
 */
async function startLearningSession() {
    if (!state.currentTopic) {
        console.error("Cannot start learning session: no current topic.");
        manageUIState('error', {errorMessage: 'Chyba: Téma není definováno.'});
        return;
    }
    state.currentSessionId = generateSessionId(); // из utils.js
    manageUIState('requestingExplanation'); // Указывает, что мы ждем первое объяснение
    setLoadingState('chat', true);
    addThinkingIndicator(); // Показываем индикатор
    manageButtonStates();

    const prompt = `Jsi AI Tutor "Justax". Vysvětli ZÁKLADY tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Rozděl vysvětlení na menší logické části. Pro PRVNÍ ČÁST:\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`; // Используем _buildInitialPrompt из geminiService

    const response = await sendToGemini(prompt, false); // Не чат-взаимодействие

    removeThinkingIndicator();
    if (response.success && response.data) {
         const { boardMarkdown, ttsCommentary, chatText } = response.data;
         if (boardMarkdown) {
             appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); // из whiteboardController.js
         }
         if (chatText) { // Если AI добавило текст в чат (например, вопрос)
             await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary); // из chatController.js
             const lowerChatText = chatText.toLowerCase();
              if (lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste') || lowerChatText.includes('vypočítejte') || lowerChatText.includes('otázka:') || chatText.endsWith('?') || lowerChatText.includes('můžeš mi říct') ) {
                 state.aiIsWaitingForAnswer = true;
                 manageUIState('waitingForAnswer');
              } else {
                  state.aiIsWaitingForAnswer = false;
                  manageUIState('learning');
              }
         } else if (ttsCommentary && !boardMarkdown){ // Если есть только TTS
             await addChatMessage("(Poslechněte si úvodní komentář)", 'gemini', true, new Date(), ttsCommentary);
              state.aiIsWaitingForAnswer = false;
              manageUIState('learning');
         } else if (!boardMarkdown && !chatText && !ttsCommentary){
             console.warn("Gemini initial request returned empty content.");
             await addChatMessage("(AI neposkytlo úvodní obsah)", 'gemini', false, new Date());
              state.aiIsWaitingForAnswer = false;
              manageUIState('learning');
         } else {
              state.aiIsWaitingForAnswer = false;
              manageUIState('learning');
         }
         // Озвучиваем TTS, если есть
         if (ttsCommentary) {
              speakText(ttsCommentary); // из speechService.js
         }
    } else {
         console.error("Error response from Gemini on initial explanation:", response.error);
         await addChatMessage(`Promiňte, nastala chyba při zahájení výkladu: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false, new Date());
         manageUIState('error', { errorMessage: `Chyba AI: ${response.error}` });
    }

    setLoadingState('chat', false);
    manageButtonStates();
}

/**
 * Поток действий при нажатии "Označit jako dokončené".
 */
async function handleMarkTopicCompleteFlow() {
     if (!state.currentTopic || state.topicLoadInProgress || state.isLoading.points) return;

     // Опционально: Спросить подтверждение
     if (!confirm(`Opravdu označit téma "${state.currentTopic.name}" jako dokončené?`)) {
          return;
     }

     console.log(`[Flow] Marking topic ${state.currentTopic.activity_id} as complete.`);
     setLoadingState('currentTopic', true); // Показываем лоадер на месте темы
     state.topicLoadInProgress = true;
     manageButtonStates(); // Блокируем кнопки

     const successMark = await markTopicComplete(state.currentTopic.activity_id, state.currentUser.id); // из supabaseService

     if (successMark) {
         console.log(`[Flow] Topic marked complete. Awarding points...`);
         setLoadingState('points', true); // Показываем загрузку очков
         const pointsAwarded = await awardPoints(state.currentUser.id, POINTS_TOPIC_COMPLETE); // из supabaseService
         setLoadingState('points', false);

         if (pointsAwarded) {
              showToast('+', `${POINTS_TOPIC_COMPLETE} kreditů získáno!`, 'success', 3000);
         } else {
              showToast('Varování', 'Téma dokončeno, ale body se nepodařilo připsat.', 'warning');
         }

         showToast(`Téma "${state.currentTopic.name}" dokončeno.`, "success");
         await loadNextTopicFlow(); // Загружаем следующую тему

     } else {
         showToast("Chyba při označování tématu jako dokončeného.", "error");
         state.topicLoadInProgress = false; // Разблокируем, если не удалось
         setLoadingState('currentTopic', false);
         manageButtonStates();
     }
}

/**
 * Поток действий для загрузки следующей темы.
 */
async function loadNextTopicFlow() {
     if (!state.currentUser || state.topicLoadInProgress) return;
     console.log("[Flow] Loading next topic flow started.");
     state.topicLoadInProgress = true;
     setLoadingState('currentTopic', true);
     state.currentTopic = null; // Сбрасываем текущую тему
     if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám téma...</span>';
     if (ui.chatMessages) ui.chatMessages.innerHTML = ''; // Очищаем чат
     clearWhiteboard(false); // Очищаем доску без уведомления
     state.geminiChatContext = []; // Очищаем историю Gemini
     state.aiIsWaitingForAnswer = false; // Сбрасываем ожидание ответа
     manageUIState('loadingTopic'); // Переключаем UI в режим загрузки
     manageButtonStates();

     const result = await loadNextUncompletedTopic(state.currentUser.id); // из supabaseService

     if (result.success) {
         state.currentTopic = result.topic;
         if (ui.currentTopicDisplay) { ui.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(state.currentTopic.name)}</strong>`; }
         await startLearningSession(); // Запускаем объяснение новой темы
     } else {
         // Обработка случая, когда нет тем (no_plan, plan_complete) или ошибка (load_error)
         state.currentTopic = null; // Убедимся, что тема пуста
         if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(${result.message || 'N/A'})</span>`;
         manageUIState(result.reason || 'error', { errorMessage: result.message });
     }

     state.topicLoadInProgress = false;
     setLoadingState('currentTopic', false);
     manageButtonStates();
     console.log("[Flow] Loading next topic flow finished.");
}


// --- Запуск Приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);