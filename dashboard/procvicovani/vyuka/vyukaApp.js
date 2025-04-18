// vyukaApp.js - Основной файл приложения Vyuka, инициализация и координация модулей

// --- Импорт Модулей ---
import { MAX_GEMINI_HISTORY_TURNS, NOTIFICATION_FETCH_LIMIT, POINTS_TOPIC_COMPLETE } from './config.js';
import { state } from './state.js';
import { ui } from './ui.js';
import {
    sanitizeHTML, getInitials, formatTimestamp, formatRelativeTime, autoResizeTextarea,
    generateSessionId, initTooltips, // <-- initTooltips je nyní importován zde
    updateOnlineStatus, updateCopyrightYear,
    initMouseFollower, initScrollAnimations, initHeaderScrollDetection
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

    const supabaseInitialized = initializeSupabase();
    if (!supabaseInitialized) {
        showError("Kritická chyba: Nepodařilo se připojit k databázi.", true);
        if (ui.initialLoader) ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">Chyba připojení.</p>`;
        return;
    }
    state.supabase = supabaseInitialized;

    try {
        console.log("[INIT] Checking auth session...");
        const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
        if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);
        if (!session || !session.user) {
            console.log('[Init Vyuka - Kyber] Not logged in. Redirecting...');
            window.location.href = '/auth/index.html';
            return;
        }
        state.currentUser = session.user;
        console.log(`[INIT] User authenticated (ID: ${state.currentUser.id}).`);

        setLoadingState('user', true);
        state.currentProfile = await fetchUserProfile(state.currentUser.id);
        if (!state.currentProfile) {
            console.warn(`Profile not found for user ${state.currentUser.id}. Handling potential first login or error.`);
            showError("Profil nenalezen nebo se nepodařilo načíst. Zkuste obnovit stránku.", true);
            manageUIState('error', { errorMessage: 'Profil nenalezen.' });
            if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
            if (ui.mainContent) ui.mainContent.style.display = 'flex';
            setLoadingState('user', false);
            return;
        }
        updateUserInfoUI();
        setLoadingState('user', false);

        initializeUI(); // UI se inicializuje zde, včetně prvního volání initTooltips

        console.log("[INIT] Loading initial topic and notifications...");
        const loadNotificationsPromise = fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
            .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
            .catch(err => { console.error("Chyba při úvodním načítání notifikací:", err); renderNotifications(0, []); });

        const loadTopicPromise = loadNextTopicFlow();

        await Promise.all([loadNotificationsPromise, loadTopicPromise]);

        if (ui.initialLoader) {
             ui.initialLoader.classList.add('hidden');
             setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500);
        }
        if (ui.mainContent) {
            ui.mainContent.style.display = 'flex';
            requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); });
        }
        requestAnimationFrame(initScrollAnimations);

        console.log("✅ [Init Vyuka - Kyber] Page Initialized.");

    } catch (error) {
        console.error("❌ [Init Vyuka - Kyber] Critical initialization error:", error);
        if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) {
            ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). Obnovte.</p>`;
        } else {
            showError(`Chyba inicializace: ${error.message}`, true);
        }
        if (ui.mainContent) ui.mainContent.style.display = 'flex';
        setLoadingState('all', false);
    }
}

/**
 * Инициализация базового UI.
 */
function initializeUI() {
    try {
        updateTheme();
        setupEventListeners();
        initTooltips(); // <-- PRVNÍ VOLÁNÍ ZDE

        if (ui.chatTabButton) ui.chatTabButton.classList.add('active');
        if (ui.chatTabContent) ui.chatTabContent.classList.add('active');

        initializeSpeechRecognition();

        initMouseFollower();
        initHeaderScrollDetection();
        updateCopyrightYear();
        updateOnlineStatus();

        manageUIState('initial');
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
    const mainMobileToggle = document.getElementById('main-mobile-menu-toggle'); // Získání reference zde
    mainMobileToggle?.addEventListener('click', openMenu); // Použití získané reference
    ui.sidebarCloseToggle?.addEventListener('click', closeMenu);
    ui.sidebarOverlay?.addEventListener('click', closeMenu);

    // Chat
    ui.chatInput?.addEventListener('input', () => autoResizeTextarea(ui.chatInput)); // Přidán argument ui.chatInput
    ui.sendButton?.addEventListener('click', handleSendMessage);
    ui.chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    ui.clearChatBtn?.addEventListener('click', () => confirmClearChat()); // Voláme funkci přímo
    ui.saveChatBtn?.addEventListener('click', saveChatToPDF);
    ui.micBtn?.addEventListener('click', handleMicClick);

    // Whiteboard / TTS
    ui.clearBoardBtn?.addEventListener('click', () => {
         clearWhiteboard(false); // Clear without internal toast
         showToast('Vymazáno', "Tabule vymazána.", "info"); // Show toast here
    });
    ui.stopSpeechBtn?.addEventListener('click', stopSpeech);

    // Topic Control
    ui.continueBtn?.addEventListener('click', requestContinue);
    ui.markCompleteBtn?.addEventListener('click', handleMarkTopicCompleteFlow);

    // Chat Messages Area (Event Delegation pro TTS tlačítka)
    ui.chatMessages?.addEventListener('click', (event) => {
        const button = event.target.closest('.tts-listen-btn');
        if (button && button.dataset.textToSpeak) {
            speakText(button.dataset.textToSpeak);
        }
    });
    // Whiteboard Area (Event Delegation pro TTS tlačítka se nyní řeší v appendToWhiteboard)

    // Theme Change
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        state.isDarkMode = event.matches;
        console.log("Theme changed, isDarkMode:", state.isDarkMode);
        updateTheme();
    });

    // Window Resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) {
            closeMenu();
        }
    });

    // Online/Offline Status
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

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
            showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success');
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
            if (!isRead && notificationId && state.currentUser) { // Přidána kontrola currentUser
                const success = await markNotificationRead(notificationId, state.currentUser.id); // Předáno ID uživatele
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
            if(link) {
                 ui.notificationsDropdown?.classList.remove('active');
                 window.location.href = link;
             } else {
                  // Pokud není link, možná dropdown nechceme zavírat automaticky
                  // ui.notificationsDropdown?.classList.remove('active');
             }
        }
    });
    // Close dropdown on outside click
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
        const initials = getInitials(state.currentProfile, state.currentUser.email);
        const avatarUrl = state.currentProfile.avatar_url;
        // Correct path check for local assets
        const isLocalAsset = avatarUrl && avatarUrl.startsWith('assets/');
        const finalUrl = isLocalAsset ? avatarUrl : (avatarUrl ? `${avatarUrl}?t=${Date.now()}` : null); // Add cache busting only for external URLs

        ui.sidebarAvatar.innerHTML = finalUrl ? `<img src="${sanitizeHTML(finalUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);

        // Add error handler for the image in the sidebar
        const sidebarImg = ui.sidebarAvatar.querySelector('img');
        if (sidebarImg) {
            sidebarImg.onerror = function() {
                console.warn(`Failed to load sidebar avatar: ${this.src}. Falling back to initials.`);
                ui.sidebarAvatar.innerHTML = sanitizeHTML(initials);
            };
        }
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
      // Definice vizuálů pro notifikace (přesunuto sem pro přehlednost)
      const activityVisuals = {
         test: { icon: 'fa-vial', class: 'test' },
         exercise: { icon: 'fa-pencil-alt', class: 'exercise' },
         badge: { icon: 'fa-medal', class: 'badge' },
         diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' },
         lesson: { icon: 'fa-book-open', class: 'lesson' },
         plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' },
         level_up: { icon: 'fa-level-up-alt', class: 'level_up' },
         vyuka_start: { icon: 'fa-chalkboard-teacher', class: 'lesson'}, // Příklad pro výuku
         vyuka_complete: { icon: 'fa-flag-checkered', class: 'test'}, // Příklad pro výuku
         other: { icon: 'fa-info-circle', class: 'other' },
         default: { icon: 'fa-check-circle', class: 'default' }
     };

     ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
     ui.notificationCount.classList.toggle('visible', count > 0);

     if (notifications && notifications.length > 0) {
         ui.notificationsList.innerHTML = notifications.map(n => {
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
 * Управляет общим состоянием интерфейса.
 * @param {'initial'|'loadingTopic'|'learning'|'chatting'|'requestingExplanation'|'waitingForAnswer'|'noPlan'|'planComplete'|'error'|'loggedOut'} mode - Текущий режим UI.
 * @param {object} options - Дополнительные опции.
 */
function manageUIState(mode, options = {}) {
    console.log("[UI State]:", mode, options);
    const isLearningActive = ['learning', 'chatting', 'requestingExplanation', 'waitingForAnswer', 'loadingTopic', 'initial'].includes(mode);

    if (ui.learningInterface) {
        const showInterface = !!state.currentTopic || ['loadingTopic', 'requestingExplanation', 'noPlan', 'planComplete', 'error', 'initial'].includes(mode);
        ui.learningInterface.style.display = showInterface ? 'flex' : 'none';
    }

    if (ui.chatMessages && !isLearningActive) {
        let emptyStateHTML = '';
        switch (mode) {
            case 'loggedOut': emptyStateHTML = `<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPŘIHLÁŠEN</h3><p>Pro přístup k výuce se prosím <a href="/auth/index.html" style="color: var(--accent-primary)">přihlaste</a>.</p></div>`; break;
            case 'noPlan': emptyStateHTML = `<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ŽÁDNÝ AKTIVNÍ PLÁN</h3><p>Nemáte aktivní studijní plán. Nejprve prosím dokončete <a href="/dashboard/procvicovani/test1.html" style="color: var(--accent-primary)">diagnostický test</a>.</p></div>`; break;
            case 'planComplete': emptyStateHTML = `<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLÁN DOKONČEN!</h3><p>Všechny naplánované aktivity jsou hotové. Skvělá práce! Můžete si <a href="/dashboard/procvicovani/plan.html" style="color: var(--accent-primary)">vytvořit nový plán</a>.</p></div>`; break;
            case 'error': emptyStateHTML = `<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA SYSTÉMU</h3><p>${sanitizeHTML(options.errorMessage || 'Nastala chyba při načítání dat.')}</p></div>`; break;
            case 'initial': emptyStateHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Inicializace...</h3></div>'; break;
            default: emptyStateHTML = '';
        }
        if (emptyStateHTML) { ui.chatMessages.innerHTML = emptyStateHTML; }
    } else if (ui.chatMessages && mode === 'loadingTopic') {
        ui.chatMessages.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>NAČÍTÁNÍ TÉMATU...</h3></div>';
    }

    manageButtonStates();
}

/**
 * Управляет активностью/неактивностью кнопок.
 */
function manageButtonStates() {
    const canInteractNormally = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.aiIsWaitingForAnswer;
    const canContinueOrComplete = canInteractNormally;
    const canChat = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress;

    if (ui.sendButton) {
        ui.sendButton.disabled = !canChat || state.isListening || !ui.chatInput?.value.trim(); // Disable if input is empty too
        ui.sendButton.innerHTML = state.geminiIsThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
    }
    if (ui.chatInput) {
        ui.chatInput.disabled = !canChat || state.isListening;
        ui.chatInput.placeholder = state.isListening ? "Poslouchám..." : (canChat ? (state.aiIsWaitingForAnswer ? "Odpovězte na otázku AI..." : "Zeptejte se nebo odpovězte...") : "Počkejte prosím...");
    }
    if (ui.continueBtn) {
        ui.continueBtn.disabled = !canContinueOrComplete;
        ui.continueBtn.style.display = state.currentTopic ? 'inline-flex' : 'none';
    }
    if (ui.markCompleteBtn) {
        ui.markCompleteBtn.disabled = !canContinueOrComplete;
        ui.markCompleteBtn.style.display = state.currentTopic ? 'inline-flex' : 'none';
    }
    if (ui.clearBoardBtn) { ui.clearBoardBtn.disabled = !ui.whiteboardContent?.hasChildNodes() || state.geminiIsThinking; } // Check if board has content
    if (ui.stopSpeechBtn) { ui.stopSpeechBtn.disabled = !state.speechSynthesisSupported || !window.speechSynthesis.speaking; } // Disable if not speaking
    if (ui.micBtn) {
        const canUseMic = canChat && state.speechRecognitionSupported;
        ui.micBtn.disabled = !canUseMic || state.geminiIsThinking; // Also disable if Gemini is thinking
        ui.micBtn.classList.toggle('listening', state.isListening);
        ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporováno" : state.isListening ? "Zastavit hlasový vstup" : "Zahájit hlasový vstup";
    }
    if (ui.clearChatBtn) ui.clearChatBtn.disabled = state.geminiIsThinking || !ui.chatMessages?.hasChildNodes() || ui.chatMessages?.querySelector('.empty-state'); // Disable if chat empty
    if (ui.saveChatBtn) ui.saveChatBtn.disabled = state.geminiIsThinking || !ui.chatMessages?.hasChildNodes() || ui.chatMessages?.querySelector('.empty-state'); // Disable if chat empty
}


// --- Обработчики Действий ---

/**
 * Обрабатывает отправку сообщения из чата.
 */
async function handleSendMessage() {
    const text = ui.chatInput?.value.trim();
    if (!text || state.geminiIsThinking || !state.currentTopic || state.isListening) return;

    const inputBeforeSend = ui.chatInput?.value; // Uložíme hodnotu před vymazáním
    if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); } // Vymazat a přizpůsobit

    try {
         // 1. Add user message to UI and context
         await addChatMessage(text, 'user');
         initTooltips(); // <-- Inicializace tooltipů po přidání zprávy
         state.geminiChatContext.push({ role: "user", parts: [{ text }] });

         // 2. Set thinking state
         setLoadingState('chat', true);
         addThinkingIndicator();
         manageButtonStates();

         // 3. Define prompt
         let promptForGemini = `Student píše do chatu: "${text}". Téma je "${state.currentTopic.name}". Odpověz relevantně v rámci tématu a konverzace. Použij POUZE text do chatu. Nepřidávej bloky [BOARD_MARKDOWN] ani [TTS_COMMENTARY].`;
         if (state.aiIsWaitingForAnswer) {
            promptForGemini = `Student odpověděl na předchozí otázku: "${text}". Téma je "${state.currentTopic.name}". Vyhodnoť odpověď a pokračuj v konverzaci POUZE textem do chatu. Můžeš položit další otázku nebo navrhnout pokračování výkladu.`;
            state.aiIsWaitingForAnswer = false;
         }

         // 4. Send request
         const response = await sendToGemini(promptForGemini, true); // true = chat interaction

         // 5. Process response
         removeThinkingIndicator();
         if (response.success && response.data) {
             const { chatText, ttsCommentary } = response.data; // Expecting mostly chatText
             if (chatText) {
                 await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                 initTooltips(); // <-- Inicializace tooltipů po přidání zprávy AI
                 const lowerChatText = chatText.toLowerCase();
                 state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                 manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
             } else {
                 console.warn("Gemini chat response missing chatText.");
                 await addChatMessage("(AI neodpovědělo textem)", 'gemini', false);
                 state.aiIsWaitingForAnswer = false;
                 manageUIState('learning');
             }
         } else {
             console.error("Error response from Gemini:", response.error);
             await addChatMessage(`Promiňte, nastala chyba: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
             state.aiIsWaitingForAnswer = false;
             manageUIState('learning');
             // V případě chyby vrátíme původní text do inputu
             if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
         }

    } catch (error) {
         console.error("Error in handleSendMessage:", error);
         showError("Došlo k chybě při odesílání zprávy.", false);
         removeThinkingIndicator(); // Ensure indicator is removed on exception
         state.aiIsWaitingForAnswer = false;
         manageUIState('learning');
         // V případě chyby vrátíme původní text do inputu
         if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
    } finally {
         setLoadingState('chat', false);
         manageButtonStates(); // Ensure buttons are updated
    }
}

/**
 * Запрашивает следующую часть объяснения у AI.
 */
async function requestContinue() {
    if (state.geminiIsThinking || !state.currentTopic || state.aiIsWaitingForAnswer) return;

    setLoadingState('chat', true);
    addThinkingIndicator();
    manageButtonStates();

    const prompt = `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Naváž na předchozí část. Vygeneruj další logickou část výkladu.\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`;

    const response = await sendToGemini(prompt, false); // false = explanation request

    removeThinkingIndicator();
    if (response.success && response.data) {
        const { boardMarkdown, ttsCommentary, chatText } = response.data;
        if (boardMarkdown) {
            appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
            initTooltips(); // <-- Inicializace tooltipů po přidání na tabuli
        }
        if (chatText) {
            await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
            initTooltips(); // <-- Inicializace tooltipů po přidání zprávy
            const lowerChatText = chatText.toLowerCase();
            state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
            manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
        } else if (ttsCommentary && !boardMarkdown) {
            await addChatMessage("(Poslechněte si další část komentáře)", 'gemini', true, new Date(), ttsCommentary);
            initTooltips(); // <-- Inicializace tooltipů
            state.aiIsWaitingForAnswer = false;
            manageUIState('learning');
        } else if (!boardMarkdown && !chatText && !ttsCommentary) {
            console.warn("Gemini continue request returned empty content.");
            await addChatMessage("(AI neposkytlo další obsah)", 'gemini', false);
            state.aiIsWaitingForAnswer = false;
            manageUIState('learning');
        } else {
            state.aiIsWaitingForAnswer = false;
            manageUIState('learning');
        }
        if (ttsCommentary) { speakText(ttsCommentary); }

    } else {
        console.error("Error response from Gemini on continue:", response.error);
        await addChatMessage(`Promiňte, nastala chyba při pokračování: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
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
    state.currentSessionId = generateSessionId();
    manageUIState('requestingExplanation');
    setLoadingState('chat', true);
    addThinkingIndicator();
    manageButtonStates();

    const prompt = `Jsi AI Tutor "Justax". Vysvětli ZÁKLADY tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Rozděl vysvětlení na menší logické části. Pro PRVNÍ ČÁST:\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`;

    const response = await sendToGemini(prompt, false);

    removeThinkingIndicator();
    if (response.success && response.data) {
         const { boardMarkdown, ttsCommentary, chatText } = response.data;
         if (boardMarkdown) {
             appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
             initTooltips(); // <-- Inicializace tooltipů po přidání na tabuli
         }
         if (chatText) {
             await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
             initTooltips(); // <-- Inicializace tooltipů po přidání zprávy
             const lowerChatText = chatText.toLowerCase();
             state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
             manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
         } else if (ttsCommentary && !boardMarkdown){
             await addChatMessage("(Poslechněte si úvodní komentář)", 'gemini', true, new Date(), ttsCommentary);
             initTooltips(); // <-- Inicializace tooltipů
             state.aiIsWaitingForAnswer = false;
             manageUIState('learning');
         } else if (!boardMarkdown && !chatText && !ttsCommentary){
             console.warn("Gemini initial request returned empty content.");
             await addChatMessage("(AI neposkytlo úvodní obsah)", 'gemini', false);
             state.aiIsWaitingForAnswer = false;
             manageUIState('learning');
         } else {
             state.aiIsWaitingForAnswer = false;
             manageUIState('learning');
         }
         if (ttsCommentary) { speakText(ttsCommentary); }
    } else {
         console.error("Error response from Gemini on initial explanation:", response.error);
         await addChatMessage(`Promiňte, nastala chyba při zahájení výkladu: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
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

     if (!confirm(`Opravdu označit téma "${state.currentTopic.name}" jako dokončené?`)) {
          return;
     }

     console.log(`[Flow] Marking topic ${state.currentTopic.activity_id} as complete.`);
     setLoadingState('currentTopic', true);
     state.topicLoadInProgress = true;
     manageButtonStates();

     try {
          const successMark = await markTopicComplete(state.currentTopic.activity_id, state.currentUser.id);

          if (successMark) {
              console.log(`[Flow] Topic marked complete. Awarding points...`);
              setLoadingState('points', true);
              const pointsAwarded = await awardPoints(state.currentUser.id, POINTS_TOPIC_COMPLETE);
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
              state.topicLoadInProgress = false;
              setLoadingState('currentTopic', false);
              manageButtonStates();
          }
     } catch (error) {
          console.error("Error in handleMarkTopicCompleteFlow:", error);
          showToast("Neočekávaná chyba při dokončování tématu.", "error");
          state.topicLoadInProgress = false;
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
     state.currentTopic = null;
     if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám téma...</span>';
     if (ui.chatMessages) ui.chatMessages.innerHTML = '';
     clearWhiteboard(false);
     state.geminiChatContext = [];
     state.aiIsWaitingForAnswer = false;
     manageUIState('loadingTopic');
     manageButtonStates();

     try {
          const result = await loadNextUncompletedTopic(state.currentUser.id);

          if (result.success && result.topic) { // Přidána kontrola result.topic
              state.currentTopic = result.topic;
              if (ui.currentTopicDisplay) { ui.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(state.currentTopic.name)}</strong>`; }
              await startLearningSession(); // Запускаем объяснение nové темы
          } else {
              state.currentTopic = null;
              if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(${result.message || 'Není další téma'})</span>`;
              manageUIState(result.reason || 'error', { errorMessage: result.message });
          }
     } catch(error) {
          console.error("Error in loadNextTopicFlow:", error);
          state.currentTopic = null;
           if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(Chyba načítání)</span>`;
          manageUIState('error', { errorMessage: `Chyba při načítání dalšího tématu: ${error.message}` });
     } finally {
          state.topicLoadInProgress = false;
          setLoadingState('currentTopic', false);
          manageButtonStates();
          console.log("[Flow] Loading next topic flow finished.");
     }
}


// --- Запуск Приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);