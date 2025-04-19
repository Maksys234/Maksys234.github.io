// vyukaApp.js - Основной файл приложения Vyuka, инициализация и координация модулей

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

/**
 * Главная функция инициализации приложения.
 */
async function initializeApp() {
    console.log("🚀 [Init Vyuka - Kyber] Starting App Initialization...");
    let initializationError = null; // Store error for later display

    // Show loader immediately
    if (ui.initialLoader) {
        ui.initialLoader.style.display = 'flex';
        ui.initialLoader.classList.remove('hidden');
    }
    if (ui.mainContent) ui.mainContent.style.display = 'none';
    hideError(); // Hide any previous global errors

    try {
        // Initialize Supabase
        const supabaseInitialized = initializeSupabase();
        if (!supabaseInitialized) {
            throw new Error("Kritická chyba: Nepodařilo se připojit k databázi.");
        }
        state.supabase = supabaseInitialized;
        console.log("[INIT] Supabase Initialized.");

        // Check Auth Session
        console.log("[INIT] Checking auth session...");
        const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
        if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);
        if (!session || !session.user) {
            console.log('[Init Vyuka - Kyber] Not logged in. Redirecting...');
            window.location.href = '/auth/index.html';
            // Stop further execution, loader will stay visible until redirect
            return;
        }
        state.currentUser = session.user;
        console.log(`[INIT] User authenticated (ID: ${state.currentUser.id}). Fetching profile...`);

        // Fetch User Profile
        setLoadingState('user', true);
        state.currentProfile = await fetchUserProfile(state.currentUser.id);
        setLoadingState('user', false); // Set loading false regardless of success/fail here

        if (!state.currentProfile) {
            // Specific handling if profile is not found (might be first login or DB issue)
            console.warn(`Profile not found for user ${state.currentUser.id}. Displaying warning.`);
            // Store the error, but continue to initialize basic UI
            initializationError = new Error("Profil nenalezen nebo se nepodařilo načíst. Zkuste obnovit stránku.");
            manageUIState('error', { errorMessage: initializationError.message });
        } else {
            console.log("[INIT] Profile fetched successfully.");
        }

        // Initialize Basic UI (even if profile fetch failed, to show error message)
        console.log("[INIT] Initializing base UI...");
        initializeUI(); // Sets up listeners, theme etc.
        updateUserInfoUI(); // Update sidebar even if profile fetch failed (shows default)

        // Load Initial Data (Notifications and Topic) - Only if profile exists
        if (state.currentProfile && !initializationError) {
            console.log("[INIT] Loading initial topic and notifications...");
            setLoadingState('currentTopic', true); // Indicate loading start
            setLoadingState('notifications', true);

            const loadNotificationsPromise = fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
                .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                .catch(err => {
                    console.error("Chyba při úvodním načítání notifikací:", err);
                    renderNotifications(0, []); // Render empty on error
                    showToast('Chyba Notifikací', 'Nepodařilo se načíst signály.', 'error');
                })
                .finally(() => setLoadingState('notifications', false));

            // Load topic flow handles its own loading state internally and calls manageUIState
            const loadTopicPromise = loadNextTopicFlow()
                 .catch(err => {
                    console.error("Chyba při načítání úvodního tématu:", err);
                    // loadNextTopicFlow should handle its own UI state on error
                 });

            await Promise.all([loadNotificationsPromise, loadTopicPromise]);
            console.log("[INIT] Initial data loading complete (or errors handled).");

        } else if (initializationError) {
             // Profile fetch failed earlier, ensure loading states are off
             setLoadingState('currentTopic', false);
             setLoadingState('notifications', false);
        }

    } catch (error) {
        console.error("❌ [Init Vyuka - Kyber] Critical initialization error:", error);
        initializationError = error; // Store the critical error
        // Ensure UI is initialized enough to show the error
        if (!document.getElementById('main-mobile-menu-toggle')) { // Basic UI check
            try { initializeUI(); } catch (uiError) { console.error("Failed to initialize UI during error handling:", uiError); }
        }
        // Set UI state to error
        manageUIState('error', { errorMessage: error.message });
    } finally {
        // --- This block ALWAYS runs ---
        console.log("[INIT] Finalizing initialization (finally block)...");
        // Hide the main initial loader
        if (ui.initialLoader) {
             ui.initialLoader.classList.add('hidden');
             // Use timeout to ensure transition completes before setting display: none
             setTimeout(() => {
                 if (ui.initialLoader) ui.initialLoader.style.display = 'none';
             }, 500); // Adjust time to match CSS transition if needed
        }

        // Show the main content container (will show error message if init failed)
        if (ui.mainContent) {
            ui.mainContent.style.display = 'flex'; // Use flex as per layout
            // Add 'loaded' class for potential fade-in/animations
            requestAnimationFrame(() => {
                if (ui.mainContent) ui.mainContent.classList.add('loaded');
                initScrollAnimations(); // Initialize animations now that content is potentially visible
            });
        }

        // Ensure all loading states are false if something went wrong
        if (initializationError) {
            setLoadingState('all', false);
            showError(`Chyba inicializace: ${initializationError.message}`, true); // Show global error if init failed critically
        }

        console.log("✅ [Init Vyuka - Kyber] App Initialization Finished (finally block).");
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

        initializeSpeechRecognition(); // Initialize STT

        initMouseFollower();
        initHeaderScrollDetection();
        updateCopyrightYear();
        updateOnlineStatus();

        // manageUIState('initial'); // Set initial state (will be updated after data load)
        console.log("UI Initialized successfully.");
    } catch (error) {
        console.error("UI Init failed:", error); // Error will be caught here
        // Show error, but let initializeApp handle the final state
        showError(`Chyba inicializace UI: ${error.message}`, false);
        // Log the original error stack trace if available
        if (error.stack) {
            console.error("Original stack trace:", error.stack);
        }
         // Re-throw the error so initializeApp knows UI setup failed partially
         // throw error; // Optional: re-throw if critical
    }
}


/**
 * Настройка основных обработчиков событий.
 */
function setupEventListeners() {
    console.log("[SETUP] Setting up event listeners...");

    // Mobile Menu Toggle
    if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
    else console.warn("Element 'main-mobile-menu-toggle' not found.");

    // Sidebar Close/Overlay
    if(ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
    else console.warn("Element 'sidebar-close-toggle' not found.");
    if(ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
    else console.warn("Element 'sidebar-overlay' not found.");

    // Chat Input & Buttons
    if(ui.chatInput) ui.chatInput.addEventListener('input', () => autoResizeTextarea(ui.chatInput));
    else console.warn("Element 'chat-input' not found.");
    if(ui.sendButton) ui.sendButton.addEventListener('click', handleSendMessage);
    else console.warn("Element 'send-button' not found.");
    if(ui.chatInput) ui.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    if(ui.clearChatBtn) ui.clearChatBtn.addEventListener('click', () => confirmClearChat());
    else console.warn("Element 'clear-chat-btn' not found.");
    if(ui.saveChatBtn) ui.saveChatBtn.addEventListener('click', saveChatToPDF);
    else console.warn("Element 'save-chat-btn' not found.");
    if(ui.micBtn) ui.micBtn.addEventListener('click', handleMicClick);
    else console.warn("Element 'mic-btn' not found.");

    // Whiteboard & Speech Controls
    if(ui.clearBoardBtn) ui.clearBoardBtn.addEventListener('click', () => {
         clearWhiteboard(false);
         showToast('Vymazáno', "Tabule vymazána.", "info");
    });
    else console.warn("Element 'clear-board-btn' not found.");
    if(ui.stopSpeechBtn) ui.stopSpeechBtn.addEventListener('click', stopSpeech);
    else console.warn("Element 'stop-speech-btn' not found.");

    // Learning Flow Controls
    if(ui.continueBtn) ui.continueBtn.addEventListener('click', requestContinue);
    else console.warn("Element 'continue-btn' not found.");
    if(ui.markCompleteBtn) ui.markCompleteBtn.addEventListener('click', handleMarkTopicCompleteFlow);
    else console.warn("Element 'mark-complete-btn' not found.");

    // Dynamic TTS Buttons (Event Delegation on Chat & Whiteboard)
    if(ui.chatMessages) ui.chatMessages.addEventListener('click', handleDynamicTTSClick);
    else console.warn("Element 'chat-messages' not found for TTS delegation.");
    if(ui.whiteboardContent) ui.whiteboardContent.addEventListener('click', handleDynamicTTSClick);
    else console.warn("Element 'whiteboard-content' not found for TTS delegation.");

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
            try {
                const success = await markAllNotificationsRead(state.currentUser.id);
                if(success) {
                    const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT);
                    renderNotifications(unreadCount, notifications);
                    showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení označena.', 'success');
                } else {
                    showToast('CHYBA PŘENOSU', 'Nepodařilo se označit oznámení.', 'error');
                }
            } catch (err) {
                 console.error("Error marking all notifications read:", err);
                 showToast('CHYBA SYSTÉMU', 'Při označování nastala chyba.', 'error');
            } finally {
                setLoadingState('notifications', false);
            }
        });
    } else {
        console.warn("Mark all read button not found.");
    }

    if (ui.notificationsList) {
        ui.notificationsList.addEventListener('click', async (event) => {
            const item = event.target.closest('.notification-item');
            if (item && !isLoading.notifications) { // Prevent action while loading
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
                if (link) {
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
    // ... (kód beze změn) ...
    if (!ui.sidebarName || !ui.sidebarAvatar) return;
    if (state.currentUser && state.currentProfile) {
        const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot';
        ui.sidebarName.textContent = sanitizeHTML(displayName);
        const initials = getInitials(state.currentProfile, state.currentUser.email);
        const avatarUrl = state.currentProfile.avatar_url;

        let finalUrl = avatarUrl;
        if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('//')) {
             finalUrl = sanitizeHTML(avatarUrl);
        } else if (avatarUrl) {
             finalUrl = `${sanitizeHTML(avatarUrl)}?t=${Date.now()}`;
        } else {
             finalUrl = null;
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
 */
 function renderNotifications(count, notifications) {
    // ... (kód beze změn) ...
     console.log("[Render Notifications] Count:", count, "Notifications:", notifications);
     if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
         console.error("[Render Notifications] Missing UI elements.");
         return;
     }
      const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, vyuka_start: { icon: 'fa-chalkboard-teacher', class: 'lesson'}, vyuka_complete: { icon: 'fa-flag-checkered', class: 'test'}, achievement: { icon: 'fa-trophy', class: 'badge'}, info: { icon: 'fa-info-circle', class: 'info' }, warning: { icon: 'fa-exclamation-triangle', class: 'warning' }, error: { icon: 'fa-exclamation-circle', class: 'danger' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

     ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
     ui.notificationCount.classList.toggle('visible', count > 0);

     if (notifications && notifications.length > 0) {
         ui.notificationsList.innerHTML = notifications.map(n => {
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
 * Управляет общим состоянием интерфейса (Co se zobrazuje).
 * @param {'initial'|'loadingTopic'|'learning'|'chatting'|'requestingExplanation'|'waitingForAnswer'|'noPlan'|'planComplete'|'error'|'loggedOut'} mode - Текущий режим UI.
 * @param {object} options - Дополнительные опции (např. errorMessage).
 */
 function manageUIState(mode, options = {}) {
    console.log("[UI State]:", mode, options);

    const isLearningActive = state.currentTopic && ['learning', 'chatting', 'requestingExplanation', 'waitingForAnswer'].includes(mode);
    const isLoading = mode === 'loadingTopic' || mode === 'initial' || state.isLoading.currentTopic || state.isLoading.chat;
    const isEmptyState = ['noPlan', 'planComplete', 'error', 'loggedOut'].includes(mode);

    // --- Zobrazení Hlavního Rozhraní ---
    if (ui.learningInterface) {
        const shouldShowInterface = !isEmptyState && mode !== 'initial'; // Zobrazit, pokud není prázdný stav nebo počáteční načítání
        ui.learningInterface.style.display = shouldShowInterface ? 'flex' : 'none';
    }

    // --- Zobrazení Prázdných Stavů / Chyb v Chat Oblasti ---
    if (ui.chatMessages) {
        let emptyStateHTML = '';
        if (isEmptyState || mode === 'initial' || mode === 'loadingTopic') {
            ui.chatMessages.innerHTML = ''; // Clear previous messages first

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
                    // Zde také zobrazit globální chybu, pokud ještě nebyla
                    if (options.errorMessage && !document.getElementById('global-error')?.offsetParent) {
                        showError(options.errorMessage, true);
                    }
                    break;
                case 'initial': // Fallback if loader fails to hide
                    emptyStateHTML = '<div class="empty-state"><i class="fas fa-cog fa-spin"></i><h3>Inicializace...</h3></div>';
                    break;
                 case 'loadingTopic':
                    emptyStateHTML = '<div class="empty-state initial-load-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; color: var(--text-muted);"><i class="fas fa-book-open" style="font-size: 2rem; margin-bottom: 1rem;"></i><p>Načítání tématu...</p></div>';
                    break;
            }
            if (emptyStateHTML) {
                ui.chatMessages.innerHTML = emptyStateHTML;
            }
        } else if (isLearningActive && !ui.chatMessages.hasChildNodes()) {
             // Add initial prompt if chat is empty but learning started
            ui.chatMessages.innerHTML = `<div class='empty-state'><i class='fas fa-comments'></i><h3>Chat připraven</h3><p>Zeptejte se na cokoliv k tématu nebo počkejte na pokyny AI.</p></div>`;
        }
    }

    // --- Zobrazení Prázdných Stavů v Whiteboard ---
    if (ui.whiteboardContent) {
        if (isEmptyState || mode === 'loadingTopic') {
             ui.whiteboardContent.innerHTML = `<div class="empty-state initial-load-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; color: var(--text-muted);">
                                                  <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                                                  <p>${mode === 'loadingTopic' ? 'Načítání první lekce...' : 'Systém není připraven.'}</p>
                                                </div>`;
        } else if (isLearningActive && !ui.whiteboardContent.hasChildNodes()) {
            ui.whiteboardContent.innerHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule připravena</h3><p>Zde se bude zobrazovat vysvětlení od AI.</p></div>`;
        }
    }

    // Update button states based on the current mode and state flags
    manageButtonStates(); // Always update buttons after state change
}


/**
 * Управляет активностью/неактивностью кнопок.
 */
function manageButtonStates() {
    // ... (kód beze změn) ...
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
        ui.clearBoardBtn.disabled = !ui.whiteboardContent?.hasChildNodes() || ui.whiteboardContent?.querySelector('.empty-state') || state.geminiIsThinking; // Disable also if showing empty state
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

// --- Handle Dynamic TTS Click ---
function handleDynamicTTSClick(event) {
    const button = event.target.closest('.tts-listen-btn');
    if (button && button.dataset.textToSpeak) {
        // Find the parent chunk/message to potentially highlight
        const chunkElement = button.closest('.whiteboard-chunk');
        // For chat, highlighting is less common, but could be added if needed
        // const messageElement = button.closest('.chat-message');
        speakText(button.dataset.textToSpeak, chunkElement); // Pass chunkElement for highlighting
    }
}

// --- Обработчики Действий ---

/**
 * Обрабатывает отправку сообщения из чата.
 */
async function handleSendMessage() {
    // ... (kód beze změn v logice, ale přidejme kontrolu canChat) ...
    if (!state.currentTopic || !canChat) { // Použijeme canChat flag
        showToast('Nelze odeslat', 'Nejprve musí být načteno téma a AI musí být připravena.', 'warning');
        return;
    }
    const text = ui.chatInput?.value.trim();
    if (!text || state.geminiIsThinking || state.isListening) return;

    const inputBeforeSend = ui.chatInput?.value;
    if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }

    try {
         await addChatMessage(text, 'user');
         initTooltips();
         state.geminiChatContext.push({ role: "user", parts: [{ text }] });

         setLoadingState('chat', true);
         addThinkingIndicator();
         manageButtonStates();

         let promptForGemini = `Student píše do chatu: "${text}". Téma je "${state.currentTopic.name}". Odpověz relevantně v rámci tématu a konverzace. Použij POUZE text do chatu. Nepřidávej bloky [BOARD_MARKDOWN] ani [TTS_COMMENTARY].`;

         if (state.aiIsWaitingForAnswer) {
            promptForGemini = `Student odpověděl na předchozí otázku: "${text}". Téma je "${state.currentTopic.name}". Vyhodnoť odpověď a pokračuj v konverzaci POUZE textem do chatu. Můžeš položit další otázku nebo navrhnout pokračování výkladu.`;
            state.aiIsWaitingForAnswer = false;
         }

         const response = await sendToGemini(promptForGemini, true);

         removeThinkingIndicator();
         if (response.success && response.data) {
             const { chatText, ttsCommentary } = response.data;

             if (chatText) {
                 await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                 initTooltips();
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
             if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
         }

    } catch (error) {
         console.error("Error in handleSendMessage:", error);
         showError("Došlo k chybě při odesílání zprávy.", false);
         removeThinkingIndicator();
         state.aiIsWaitingForAnswer = false;
         manageUIState('learning');
         if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
    } finally {
         setLoadingState('chat', false);
         manageButtonStates();
    }
}

/**
 * Запрашивает следующую часть объяснения у AI.
 */
async function requestContinue() {
    // ... (kód beze změn v logice) ...
    if (state.geminiIsThinking || !state.currentTopic || state.aiIsWaitingForAnswer) return;

    setLoadingState('chat', true);
    addThinkingIndicator();
    manageButtonStates();

    const prompt = `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Naváž na předchozí část. Vygeneruj další logickou část výkladu.\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`;

    try {
        const response = await sendToGemini(prompt, false);

        removeThinkingIndicator();
        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            let domChanged = false;

            if (boardMarkdown) {
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                domChanged = true;
            }
            if (chatText) {
                await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                domChanged = true;
                const lowerChatText = chatText.toLowerCase();
                state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
            } else if (ttsCommentary && !boardMarkdown) {
                await addChatMessage("(Poslechněte si další část komentáře)", 'gemini', true, new Date(), ttsCommentary);
                domChanged = true;
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

            if (domChanged) { initTooltips(); }

        } else {
            console.error("Error response from Gemini on continue:", response.error);
            await addChatMessage(`Promiňte, nastala chyba při pokračování: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
            state.aiIsWaitingForAnswer = false;
            manageUIState('learning');
        }
    } catch (error) {
        console.error("Error in requestContinue:", error);
        showError("Došlo k chybě při žádosti o pokračování.", false);
        removeThinkingIndicator();
        state.aiIsWaitingForAnswer = false;
        manageUIState('learning');
    } finally {
        setLoadingState('chat', false);
        manageButtonStates();
    }
}


/**
 * Запускает сессию обучения для текущей темы.
 */
async function startLearningSession() {
    // ... (kód beze změn v logice, ale přidáme catch blok a reset aiIsWaitingForAnswer) ...
     if (!state.currentTopic) {
        console.error("Cannot start learning session: no current topic.");
        manageUIState('error', {errorMessage: 'Chyba: Téma není definováno.'});
        return;
    }
    state.currentSessionId = generateSessionId();
    state.aiIsWaitingForAnswer = false; // Ensure reset at start
    manageUIState('requestingExplanation');
    setLoadingState('chat', true);
    addThinkingIndicator();
    manageButtonStates();

    const prompt = `Jsi AI Tutor "Justax". Vysvětli ZÁKLADY tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Rozděl vysvětlení na menší logické části. Pro PRVNÍ ČÁST:\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`;

    try {
        const response = await sendToGemini(prompt, false);
        removeThinkingIndicator();
        if (response.success && response.data) {
             const { boardMarkdown, ttsCommentary, chatText } = response.data;
             let domChanged = false;
             if (boardMarkdown) {
                 appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                 domChanged = true;
             }
             if (chatText) {
                 await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                 domChanged = true;
                 const lowerChatText = chatText.toLowerCase();
                 state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                 manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
             } else if (ttsCommentary && !boardMarkdown){
                 await addChatMessage("(Poslechněte si úvodní komentář)", 'gemini', true, new Date(), ttsCommentary);
                 domChanged = true;
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
             if(domChanged) { initTooltips(); }
        } else {
             console.error("Error response from Gemini on initial explanation:", response.error);
             await addChatMessage(`Promiňte, nastala chyba při zahájení výkladu: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
             // Zde nezobrazujeme manageUIState('error'), protože to by skrylo rozhraní.
             // Chyba se zobrazí v chatu. Ponecháme stav 'learning', aby uživatel mohl interagovat.
             state.aiIsWaitingForAnswer = false;
             manageUIState('learning'); // Ponechat learning stav
             showError(`Chyba AI: ${response.error}`, false); // Zobrazit toast
        }
    } catch(error) {
        console.error("Error in startLearningSession:", error);
        showError("Došlo k chybě při zahájení výkladu.", false);
        removeThinkingIndicator(); // Ensure indicator is removed
        // manageUIState('error', { errorMessage: `Chyba: ${error.message}` }); // Zobrazí chybu v chat oblasti
        // Ponecháme raději stav 'learning' a zobrazíme chybu v chatu
        await addChatMessage(`Systémová chyba: ${error.message}`, 'gemini', false);
        state.aiIsWaitingForAnswer = false;
        manageUIState('learning');
    } finally {
        setLoadingState('chat', false);
        manageButtonStates();
    }
}


/**
 * Поток действий при нажатии "Označit jako dokončené".
 */
async function handleMarkTopicCompleteFlow() {
    // ... (kód beze změn v logice, ale přidáme kontrolu isLoading.points) ...
     if (!state.currentTopic || state.topicLoadInProgress || state.isLoading.points) return;

     if (!confirm(`Opravdu označit téma "${state.currentTopic.name}" jako dokončené?`)) return;

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
              await loadNextTopicFlow(); // Loads next topic

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
          setLoadingState('points', false); // Ensure points loading is off on error too
          manageButtonStates();
     }
}

/**
 * Поток действий для загрузки следующей темы.
 * Vylepšeno: Zajistí, že stav currentTopic je nastaven na null PŘED zahájením načítání.
 * Vylepšeno: Lépe zpracovává chyby a zajišťuje reset stavů.
 */
async function loadNextTopicFlow() {
     if (!state.currentUser || state.topicLoadInProgress) {
         console.log("[Flow] Load next topic skipped (no user or load in progress).");
         return;
     }
     console.log("[Flow] Loading next topic flow started.");
     state.topicLoadInProgress = true;
     setLoadingState('currentTopic', true);
     state.currentTopic = null; // Clear current topic *before* loading starts
     state.geminiChatContext = []; // Reset Gemini context for the new topic
     state.aiIsWaitingForAnswer = false; // Reset AI waiting state

     // Update UI immediately to show loading state
     if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám další téma...</span>';
     clearWhiteboard(false); // Clear whiteboard without toast
     if (ui.chatMessages) ui.chatMessages.innerHTML = ''; // Clear previous chat messages
     manageUIState('loadingTopic'); // Set overall UI state to loading
     manageButtonStates(); // Disable interactions

     try {
          console.log("[Flow] Calling loadNextUncompletedTopic...");
          const result = await loadNextUncompletedTopic(state.currentUser.id);
          console.log("[Flow] loadNextUncompletedTopic result:", result);

          if (result.success && result.topic) {
              // Topic found
              state.currentTopic = result.topic;
              if (ui.currentTopicDisplay) { ui.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(state.currentTopic.name)}</strong>`; }
              await startLearningSession(); // Start the session for the new topic
              // manageUIState('learning') is called within startLearningSession or its error handling
          } else {
              // No topic found or error during fetch
              state.currentTopic = null; // Ensure current topic is null
              if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(${result.message || 'Není další téma'})</span>`;
              // Manage UI based on the specific reason (no_plan, plan_complete, load_error)
              manageUIState(result.reason || 'error', { errorMessage: result.message });
              // Ensure loading is stopped if we land here
              setLoadingState('currentTopic', false);
          }
     } catch(error) {
          // Handle unexpected errors during the flow itself
          console.error("Error in loadNextTopicFlow execution:", error);
          state.currentTopic = null;
          if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(Chyba načítání)</span>`;
          manageUIState('error', { errorMessage: `Chyba při načítání dalšího tématu: ${error.message}` });
          setLoadingState('currentTopic', false); // Ensure loading is stopped
     } finally {
          // This runs regardless of success or failure within the try block
          state.topicLoadInProgress = false;
          // Loading state for 'currentTopic' should be managed by the success/error paths above or by startLearningSession
          // setLoadingState('currentTopic', false); // Removed from here
          manageButtonStates(); // Re-enable interactions based on the final state
          console.log("[Flow] Loading next topic flow finished.");
     }
}


// --- Запуск Приложения ---
// Event listener remains the same - it calls initializeApp
document.addEventListener('DOMContentLoaded', initializeApp);