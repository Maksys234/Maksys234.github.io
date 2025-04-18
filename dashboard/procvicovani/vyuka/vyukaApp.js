// vyukaApp.js - Основной файл приложения Vyuka, инициализация и координация модулей

// --- Импорт Модулей ---
import { MAX_GEMINI_HISTORY_TURNS, NOTIFICATION_FETCH_LIMIT, POINTS_TOPIC_COMPLETE } from './config.js';
import { state } from './state.js';
import { ui } from './ui.js';
// ***** CORRECTED IMPORT LINE *****
import {
    sanitizeHTML, getInitials, formatTimestamp, formatRelativeTime, autoResizeTextarea,
    generateSessionId, initTooltips, updateOnlineStatus, updateCopyrightYear,
    initMouseFollower, initScrollAnimations, initHeaderScrollDetection,
    openMenu, closeMenu // <--- IMPORTED HERE
} from './utils.js';
// *********************************
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
    hideError();

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

        initializeUI(); // <-- This will now call the corrected setupEventListeners

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
        setupEventListeners(); // Call the function that sets up listeners
        initTooltips(); // První volání

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
        console.error("UI Init failed:", error); // Error will be caught here
        showError(`Chyba inicializace UI: ${error.message}`, true);
        // Log the original error stack trace if available
        if (error.stack) {
            console.error("Original stack trace:", error.stack);
        }
    }
}


/**
 * Настройка основных обработчиков событий.
 */
function setupEventListeners() {
    console.log("[SETUP] Setting up event listeners...");

    // Mobile Menu Toggle
    const mainMobileToggle = document.getElementById('main-mobile-menu-toggle');
    if (mainMobileToggle) {
        mainMobileToggle.addEventListener('click', openMenu); // Uses imported openMenu
    } else {
        console.warn("Element with ID 'main-mobile-menu-toggle' not found.");
    }

    // Sidebar Close/Overlay
    if(ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu); // Uses imported closeMenu
    else console.warn("Element with ID 'sidebar-close-toggle' not found.");
    if(ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
     else console.warn("Element with ID 'sidebar-overlay' not found.");

    // Chat Input & Buttons
    if(ui.chatInput) ui.chatInput.addEventListener('input', () => autoResizeTextarea(ui.chatInput));
    if(ui.sendButton) ui.sendButton.addEventListener('click', handleSendMessage);
    if(ui.chatInput) ui.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    if(ui.clearChatBtn) ui.clearChatBtn.addEventListener('click', () => confirmClearChat());
    if(ui.saveChatBtn) ui.saveChatBtn.addEventListener('click', saveChatToPDF);
    if(ui.micBtn) ui.micBtn.addEventListener('click', handleMicClick);

    // Whiteboard & Speech Controls
    if(ui.clearBoardBtn) ui.clearBoardBtn.addEventListener('click', () => {
         clearWhiteboard(false);
         showToast('Vymazáno', "Tabule vymazána.", "info");
    });
    if(ui.stopSpeechBtn) ui.stopSpeechBtn.addEventListener('click', stopSpeech);

    // Learning Flow Controls
    if(ui.continueBtn) ui.continueBtn.addEventListener('click', requestContinue);
    if(ui.markCompleteBtn) ui.markCompleteBtn.addEventListener('click', handleMarkTopicCompleteFlow);

    // Dynamic TTS Buttons (Event Delegation on Chat Messages Container)
    if(ui.chatMessages) ui.chatMessages.addEventListener('click', (event) => {
        const button = event.target.closest('.tts-listen-btn');
        if (button && button.dataset.textToSpeak) {
            speakText(button.dataset.textToSpeak); // Use the text stored in the button
        }
    });

    // Theme Change Listener
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        state.isDarkMode = event.matches;
        updateTheme();
    });

    // Resize Listener (for sidebar auto-close)
    window.addEventListener('resize', () => {
        if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) {
            closeMenu();
        }
    });

    // Online/Offline Status
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // --- Notification Listeners ---
    if (ui.notificationBell) {
        ui.notificationBell.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent document click handler from closing immediately
            ui.notificationsDropdown?.classList.toggle('active');
        });
    } else {
        console.warn("Notification bell element not found.");
    }

    if (ui.markAllReadBtn) {
        ui.markAllReadBtn.addEventListener('click', async () => {
            setLoadingState('notifications', true);
            const success = await markAllNotificationsRead(state.currentUser.id);
            if(success) {
                const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT);
                renderNotifications(unreadCount, notifications);
                showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení označena.', 'success');
            } else {
                 showToast('CHYBA PŘENOSU', 'Nepodařilo se označit oznámení.', 'error');
            }
            setLoadingState('notifications', false);
        });
    } else {
        console.warn("Mark all read button not found.");
    }

    if (ui.notificationsList) {
        ui.notificationsList.addEventListener('click', async (event) => {
            const item = event.target.closest('.notification-item');
            if (item) {
                const notificationId = item.dataset.id;
                const link = item.dataset.link;
                const isRead = item.classList.contains('is-read');

                if (!isRead && notificationId && state.currentUser) {
                    const success = await markNotificationRead(notificationId, state.currentUser.id);
                    if (success) {
                        item.classList.add('is-read');
                        item.querySelector('.unread-dot')?.remove(); // Remove dot visually
                        const countEl = ui.notificationCount;
                        if (countEl) {
                            const currentCount = parseInt(countEl.textContent.replace('+', '') || '0');
                            const newCount = Math.max(0, currentCount - 1);
                            countEl.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                            countEl.classList.toggle('visible', newCount > 0);
                        }
                         if (ui.markAllReadBtn) { // Disable 'Mark All Read' if count reaches 0
                              const currentCountAfterUpdate = parseInt(ui.notificationCount.textContent.replace('+', '') || '0');
                              ui.markAllReadBtn.disabled = currentCountAfterUpdate === 0;
                          }
                    } else {
                         showToast('Chyba', 'Nepodařilo se označit oznámení.', 'error');
                    }
                }
                if(link) {
                     ui.notificationsDropdown?.classList.remove('active'); // Close dropdown before navigating
                     window.location.href = link; // Navigate if link exists
                 }
            }
        });
    } else {
         console.warn("Notifications list element not found.");
    }

    // Close notifications dropdown on outside click
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

        // Handle both external URLs and local asset paths
        let finalUrl = avatarUrl;
        if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('//')) {
             // Assuming relative path from HTML file's perspective (adjust if needed)
             finalUrl = sanitizeHTML(avatarUrl);
        } else if (avatarUrl) {
             // External URL, add cache busting
             finalUrl = `${sanitizeHTML(avatarUrl)}?t=${Date.now()}`;
        } else {
             finalUrl = null; // No avatar URL
        }

        ui.sidebarAvatar.innerHTML = finalUrl ? `<img src="${finalUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
        const sidebarImg = ui.sidebarAvatar.querySelector('img');
        if (sidebarImg) {
            sidebarImg.onerror = function() {
                console.warn(`Failed to load sidebar avatar image: ${this.src}`);
                ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); // Fallback to initials
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
      // Define visuals more comprehensively
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
         achievement: { icon: 'fa-trophy', class: 'badge'}, // Added for generic achievement
         info: { icon: 'fa-info-circle', class: 'info' }, // Added for info
         warning: { icon: 'fa-exclamation-triangle', class: 'warning' }, // Added for warning
         error: { icon: 'fa-exclamation-circle', class: 'danger' }, // Added for error
         other: { icon: 'fa-info-circle', class: 'other' }, // Default 'other' type
         default: { icon: 'fa-check-circle', class: 'default' } // Overall default
     };

     ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
     ui.notificationCount.classList.toggle('visible', count > 0);

     if (notifications && notifications.length > 0) {
         ui.notificationsList.innerHTML = notifications.map(n => {
             // Use notification type, fallback to default
             const visual = activityVisuals[(n.type || 'default').toLowerCase()] || activityVisuals.default;
             const isReadClass = n.is_read ? 'is-read' : '';
             const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : '';
             return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
                         ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
                         <div class="notification-icon ${visual.class}"> <i class="fas ${visual.icon}"></i> </div>
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

    // Show/hide main learning interface container
    if (ui.learningInterface) {
        // Determine if the interface should be visible based on state
        const showInterface = !!state.currentTopic || ['loadingTopic', 'requestingExplanation', 'noPlan', 'planComplete', 'error', 'initial'].includes(mode);
        ui.learningInterface.style.display = showInterface ? 'flex' : 'none';
    } else {
        console.warn("manageUIState: Learning interface container not found.");
    }

    // Display empty states or loading message in chat area when not actively learning/loading
    if (ui.chatMessages && !isLearningActive) {
        let emptyStateHTML = '';
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
                break;
            case 'initial':
                emptyStateHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Inicializace...</h3></div>';
                break;
            default:
                emptyStateHTML = ''; // Clear if no specific empty state applies
        }
        if (emptyStateHTML) {
            ui.chatMessages.innerHTML = emptyStateHTML;
        }
    } else if (ui.chatMessages && mode === 'loadingTopic') {
        ui.chatMessages.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>NAČÍTÁNÍ TÉMATU...</h3></div>';
    }

    // Update button states based on the current mode and state flags
    manageButtonStates();
}

/**
 * Управляет активностью/неактивностью кнопок.
 */
function manageButtonStates() {
    const canInteractNormally = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.aiIsWaitingForAnswer;
    const canContinueOrComplete = canInteractNormally;
    const canChat = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress;
    const isSpeaking = state.speechSynthesisSupported && window.speechSynthesis.speaking;

    if (ui.sendButton) {
        const chatInputHasText = ui.chatInput?.value.trim().length > 0;
        ui.sendButton.disabled = !canChat || state.isListening || !chatInputHasText || state.geminiIsThinking;
        ui.sendButton.innerHTML = state.geminiIsThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
    }
    if (ui.chatInput) {
        ui.chatInput.disabled = !canChat || state.isListening || state.geminiIsThinking;
        ui.chatInput.placeholder = state.isListening ? "Poslouchám..." : (canChat ? (state.aiIsWaitingForAnswer ? "Odpovězte na otázku AI..." : "Zeptejte se nebo odpovězte...") : "Počkejte prosím...");
    }
    if (ui.continueBtn) {
        ui.continueBtn.disabled = !canContinueOrComplete || state.geminiIsThinking; // Disable also when thinking
        ui.continueBtn.style.display = state.currentTopic ? 'inline-flex' : 'none';
    }
    if (ui.markCompleteBtn) {
        ui.markCompleteBtn.disabled = !canContinueOrComplete || state.geminiIsThinking; // Disable also when thinking
        ui.markCompleteBtn.style.display = state.currentTopic ? 'inline-flex' : 'none';
    }
    if (ui.clearBoardBtn) {
        ui.clearBoardBtn.disabled = !ui.whiteboardContent?.hasChildNodes() || state.geminiIsThinking;
    }
    if (ui.stopSpeechBtn) {
        ui.stopSpeechBtn.disabled = !isSpeaking; // Disable if not speaking
    }
    if (ui.micBtn) {
        const canUseMic = canChat && state.speechRecognitionSupported;
        ui.micBtn.disabled = !canUseMic || state.geminiIsThinking; // Also disable when thinking
        ui.micBtn.classList.toggle('listening', state.isListening);
        ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporováno" : (state.isListening ? "Zastavit hlasový vstup" : "Zahájit hlasový vstup");
    }
    if (ui.clearChatBtn) {
        ui.clearChatBtn.disabled = state.geminiIsThinking || !ui.chatMessages?.hasChildNodes() || !!ui.chatMessages?.querySelector('.empty-state');
    }
    if (ui.saveChatBtn) {
        ui.saveChatBtn.disabled = state.geminiIsThinking || !ui.chatMessages?.hasChildNodes() || !!ui.chatMessages?.querySelector('.empty-state');
    }
}


// --- Обработчики Действий ---

/**
 * Обрабатывает отправку сообщения из чата.
 */
async function handleSendMessage() {
    const text = ui.chatInput?.value.trim();
    if (!text || state.geminiIsThinking || !state.currentTopic || state.isListening) return;

    const inputBeforeSend = ui.chatInput?.value; // Save input in case of error
    if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); } // Clear input

    try {
         // Add user message to UI immediately
         await addChatMessage(text, 'user');
         initTooltips(); // Re-init tooltips if needed (though unlikely for user message)
         state.geminiChatContext.push({ role: "user", parts: [{ text }] }); // Add to Gemini context

         // Update UI state: show thinking indicator, disable inputs
         setLoadingState('chat', true);
         addThinkingIndicator();
         manageButtonStates(); // Update button states (e.g., disable send)

         let promptForGemini = `Student píše do chatu: "${text}". Téma je "${state.currentTopic.name}". Odpověz relevantně v rámci tématu a konverzace. Použij POUZE text do chatu. Nepřidávej bloky [BOARD_MARKDOWN] ani [TTS_COMMENTARY].`;

         if (state.aiIsWaitingForAnswer) {
            // Modify prompt if AI was waiting for a specific answer
            promptForGemini = `Student odpověděl na předchozí otázku: "${text}". Téma je "${state.currentTopic.name}". Vyhodnoť odpověď a pokračuj v konverzaci POUZE textem do chatu. Můžeš položit další otázku nebo navrhnout pokračování výkladu.`;
            state.aiIsWaitingForAnswer = false; // Reset the flag as the answer is being processed
         }

         // Send to Gemini Service
         const response = await sendToGemini(promptForGemini, true); // true indicates chat interaction

         // Process Gemini Response
         removeThinkingIndicator(); // Remove thinking indicator first
         if (response.success && response.data) {
             const { chatText, ttsCommentary } = response.data; // Extract relevant parts

             if (chatText) {
                 // Add Gemini's message to UI
                 await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                 initTooltips(); // Re-init tooltips for the new AI message

                 // Check if the AI asked a question, update state
                 const lowerChatText = chatText.toLowerCase();
                 state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                 manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
             } else {
                 // Handle case where Gemini response is missing chat text
                 console.warn("Gemini chat response missing chatText.");
                 await addChatMessage("(AI neodpovědělo textem)", 'gemini', false);
                 state.aiIsWaitingForAnswer = false; // Ensure flag is reset
                 manageUIState('learning');
             }
         } else {
             // Handle error from Gemini Service
             console.error("Error response from Gemini:", response.error);
             await addChatMessage(`Promiňte, nastala chyba: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
             state.aiIsWaitingForAnswer = false; // Ensure flag is reset
             manageUIState('learning');
             // Restore user input on error
             if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
         }

    } catch (error) {
         // Handle unexpected errors during the process
         console.error("Error in handleSendMessage:", error);
         showError("Došlo k chybě při odesílání zprávy.", false);
         removeThinkingIndicator(); // Ensure indicator is removed
         state.aiIsWaitingForAnswer = false; // Ensure flag is reset
         manageUIState('learning');
         // Restore user input on error
         if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
    } finally {
         // Always re-enable inputs and update button states
         setLoadingState('chat', false);
         manageButtonStates();
    }
}

/**
 * Запрашивает следующую часть объяснения у AI.
 */
async function requestContinue() {
    // Prevent action if AI is busy, no topic, or waiting for an answer
    if (state.geminiIsThinking || !state.currentTopic || state.aiIsWaitingForAnswer) return;

    // Update UI state: show thinking indicator, disable inputs
    setLoadingState('chat', true);
    addThinkingIndicator();
    manageButtonStates(); // Update button states

    // Construct the prompt for Gemini
    const prompt = `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Naváž na předchozí část. Vygeneruj další logickou část výkladu.\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`;

    try {
        // Send prompt to Gemini Service (false indicates not a direct chat reply)
        const response = await sendToGemini(prompt, false);

        removeThinkingIndicator(); // Remove thinking indicator first
        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            let domChanged = false; // Flag to check if DOM was updated for tooltips

            // Add content to whiteboard if provided
            if (boardMarkdown) {
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                domChanged = true;
            }

            // Add chat message if provided
            if (chatText) {
                await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                domChanged = true;
                // Check if AI asked a question
                const lowerChatText = chatText.toLowerCase();
                state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
            } else if (ttsCommentary && !boardMarkdown) {
                // Handle case with only TTS commentary
                await addChatMessage("(Poslechněte si další část komentáře)", 'gemini', true, new Date(), ttsCommentary);
                domChanged = true;
                state.aiIsWaitingForAnswer = false; // Reset flag
                manageUIState('learning');
            } else if (!boardMarkdown && !chatText && !ttsCommentary) {
                // Handle case where Gemini returned no content
                console.warn("Gemini continue request returned empty content.");
                await addChatMessage("(AI neposkytlo další obsah)", 'gemini', false);
                state.aiIsWaitingForAnswer = false; // Reset flag
                manageUIState('learning');
            } else {
                 // Default case if only board markdown was provided, or other combinations
                state.aiIsWaitingForAnswer = false; // Reset flag
                manageUIState('learning');
            }

            // Initialize tooltips only if DOM actually changed
            if (domChanged) { initTooltips(); }

            // *** DO NOT AUTO-PLAY TTS HERE ***
            // if (ttsCommentary) { speakText(ttsCommentary); }
            // TTS should be triggered by user clicking the button on the message/board

        } else {
            // Handle error from Gemini Service
            console.error("Error response from Gemini on continue:", response.error);
            await addChatMessage(`Promiňte, nastala chyba při pokračování: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
            state.aiIsWaitingForAnswer = false; // Ensure flag is reset
            manageUIState('learning');
        }
    } catch (error) {
        // Handle unexpected errors during the process
        console.error("Error in requestContinue:", error);
        showError("Došlo k chybě při žádosti o pokračování.", false);
        removeThinkingIndicator(); // Ensure indicator is removed
        state.aiIsWaitingForAnswer = false; // Ensure flag is reset
        manageUIState('learning');
    } finally {
        // Always re-enable inputs and update button states
        setLoadingState('chat', false);
        manageButtonStates();
    }
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
    state.currentSessionId = generateSessionId(); // Generate a unique ID for this session
    manageUIState('requestingExplanation'); // Update UI state
    setLoadingState('chat', true); // Show loading state
    addThinkingIndicator(); // Add visual thinking indicator
    manageButtonStates(); // Update button states (disable inputs etc.)

    // Construct the initial prompt for Gemini
    const prompt = `Jsi AI Tutor "Justax". Vysvětli ZÁKLADY tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Rozděl vysvětlení na menší logické části. Pro PRVNÍ ČÁST:\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`;

    try {
        // Send prompt to Gemini Service
        const response = await sendToGemini(prompt, false); // false indicates not a direct chat interaction

        removeThinkingIndicator(); // Remove thinking indicator first
        if (response.success && response.data) {
             const { boardMarkdown, ttsCommentary, chatText } = response.data;
             let domChanged = false; // Flag to check if DOM was updated

             // Add content to whiteboard if provided
             if (boardMarkdown) {
                 appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                 domChanged = true;
             }
             // Add chat message if provided
             if (chatText) {
                 await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                 domChanged = true;
                 // Check if AI asked a question
                 const lowerChatText = chatText.toLowerCase();
                 state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                 manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
             } else if (ttsCommentary && !boardMarkdown){
                 // Handle case with only TTS commentary
                 await addChatMessage("(Poslechněte si úvodní komentář)", 'gemini', true, new Date(), ttsCommentary);
                 domChanged = true;
                 state.aiIsWaitingForAnswer = false; // Reset flag
                 manageUIState('learning');
             } else if (!boardMarkdown && !chatText && !ttsCommentary){
                 // Handle case where Gemini returned no content
                 console.warn("Gemini initial request returned empty content.");
                 await addChatMessage("(AI neposkytlo úvodní obsah)", 'gemini', false);
                 state.aiIsWaitingForAnswer = false; // Reset flag
                 manageUIState('learning');
             } else {
                 // Default case (e.g., only board markdown provided)
                 state.aiIsWaitingForAnswer = false; // Reset flag
                 manageUIState('learning');
             }

             // Initialize tooltips only if DOM actually changed
             if(domChanged) { initTooltips(); }

            // ***** DO NOT AUTO-PLAY TTS HERE *****
            // Initial explanation should be listened to via the TTS button by the user
            // if (ttsCommentary) { speakText(ttsCommentary); }
            // *************************************

        } else {
             // Handle error from Gemini Service
             console.error("Error response from Gemini on initial explanation:", response.error);
             await addChatMessage(`Promiňte, nastala chyba při zahájení výkladu: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
             manageUIState('error', { errorMessage: `Chyba AI: ${response.error}` });
        }
    } catch(error) {
        // Handle unexpected errors during the process
        console.error("Error in startLearningSession:", error);
        showError("Došlo k chybě při zahájení výkladu.", false);
        removeThinkingIndicator(); // Ensure indicator is removed
        manageUIState('error', { errorMessage: `Chyba: ${error.message}` });
    } finally {
        // Always re-enable inputs and update button states
        setLoadingState('chat', false);
        manageButtonStates();
    }
}


/**
 * Поток действий при нажатии "Označit jako dokončené".
 */
async function handleMarkTopicCompleteFlow() {
     if (!state.currentTopic || state.topicLoadInProgress || state.isLoading.points) return;

     // Confirmation dialog
     if (!confirm(`Opravdu označit téma "${state.currentTopic.name}" jako dokončené?`)) {
          return;
     }

     console.log(`[Flow] Marking topic ${state.currentTopic.activity_id} as complete.`);
     setLoadingState('currentTopic', true); // Indicate topic state change
     state.topicLoadInProgress = true; // Prevent other topic actions
     manageButtonStates(); // Update button states (disable complete/continue)

     try {
          // Mark the topic/activity as complete in the database
          const successMark = await markTopicComplete(state.currentTopic.activity_id, state.currentUser.id);

          if (successMark) {
              console.log(`[Flow] Topic marked complete. Awarding points...`);
              setLoadingState('points', true); // Indicate points operation
              const pointsAwarded = await awardPoints(state.currentUser.id, POINTS_TOPIC_COMPLETE);
              setLoadingState('points', false); // Finish points operation

              if (pointsAwarded) {
                   showToast('+', `${POINTS_TOPIC_COMPLETE} kreditů získáno!`, 'success', 3000);
              } else {
                   showToast('Varování', 'Téma dokončeno, ale body se nepodařilo připsat.', 'warning');
              }

              showToast(`Téma "${state.currentTopic.name}" dokončeno.`, "success");
              // Load the next topic automatically
              await loadNextTopicFlow();

          } else {
              // Handle failure to mark topic complete
              showToast("Chyba při označování tématu jako dokončeného.", "error");
              state.topicLoadInProgress = false; // Allow topic actions again
              setLoadingState('currentTopic', false); // Finish topic state change
              manageButtonStates(); // Re-enable buttons
          }
     } catch (error) {
          // Handle unexpected errors
          console.error("Error in handleMarkTopicCompleteFlow:", error);
          showToast("Neočekávaná chyba při dokončování tématu.", "error");
          state.topicLoadInProgress = false; // Allow topic actions again
          setLoadingState('currentTopic', false); // Finish topic state change
          manageButtonStates(); // Re-enable buttons
     }
     // Note: setLoadingState('currentTopic', false) is handled within loadNextTopicFlow or the error paths
}

/**
 * Поток действий для загрузки следующей темы.
 */
async function loadNextTopicFlow() {
     if (!state.currentUser || state.topicLoadInProgress) return; // Prevent concurrent loads
     console.log("[Flow] Loading next topic flow started.");
     state.topicLoadInProgress = true;
     setLoadingState('currentTopic', true); // Indicate topic loading
     state.currentTopic = null; // Clear current topic first

     // Update UI to show loading state
     if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám téma...</span>';
     if (ui.chatMessages) ui.chatMessages.innerHTML = ''; // Clear chat messages
     clearWhiteboard(false); // Clear whiteboard without toast
     state.geminiChatContext = []; // Reset Gemini context
     state.aiIsWaitingForAnswer = false; // Reset AI waiting state
     manageUIState('loadingTopic'); // Set overall UI state to loading topic
     manageButtonStates(); // Disable interactions

     try {
          // Fetch the next uncompleted topic from the database
          const result = await loadNextUncompletedTopic(state.currentUser.id);

          if (result.success && result.topic) {
              // Topic found successfully
              state.currentTopic = result.topic;
              if (ui.currentTopicDisplay) { ui.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(state.currentTopic.name)}</strong>`; }
              // Start the learning session for the new topic
              await startLearningSession(); // This function will manage its own loading states and UI updates
          } else {
              // No topic found or error occurred
              state.currentTopic = null; // Ensure current topic is null
              if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(${result.message || 'Není další téma'})</span>`;
              // Manage UI based on the reason provided by loadNextUncompletedTopic
              manageUIState(result.reason || 'error', { errorMessage: result.message });
          }
     } catch(error) {
          // Handle unexpected errors during the topic loading flow
          console.error("Error in loadNextTopicFlow:", error);
          state.currentTopic = null; // Ensure current topic is null
           if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(Chyba načítání)</span>`;
          manageUIState('error', { errorMessage: `Chyba při načítání dalšího tématu: ${error.message}` });
     } finally {
          // Finish the loading state for the topic flow
          state.topicLoadInProgress = false;
          setLoadingState('currentTopic', false);
          manageButtonStates(); // Re-enable interactions based on the final state
          console.log("[Flow] Loading next topic flow finished.");
     }
}


// --- Запуск Приложения ---
// Event listener remains the same
// document.addEventListener('DOMContentLoaded', initializeApp);