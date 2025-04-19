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

// Visual map for notification icons (copied from plan.js/test1.js)
const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, vyuka_start: { icon: 'fa-chalkboard-teacher', class: 'lesson'}, vyuka_complete: { icon: 'fa-flag-checkered', class: 'test'}, achievement: { icon: 'fa-trophy', class: 'badge'}, info: { icon: 'fa-info-circle', class: 'info' }, warning: { icon: 'fa-exclamation-triangle', class: 'warning' }, error: { icon: 'fa-exclamation-circle', class: 'danger' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

/**
 * Главная функция инициализации приложения.
 */
async function initializeApp() {
    console.log("🚀 [Init Vyuka - Kyber] Starting App Initialization...");
    let initializationError = null;

    if (ui.initialLoader) {
        ui.initialLoader.style.display = 'flex';
        ui.initialLoader.classList.remove('hidden');
    }
    if (ui.mainContent) ui.mainContent.style.display = 'none';
    hideError();

    try {
        const supabaseInitialized = initializeSupabase();
        if (!supabaseInitialized) {
            throw new Error("Kritická chyba: Nepodařilo se připojit k databázi.");
        }
        state.supabase = supabaseInitialized;
        console.log("[INIT] Supabase Initialized.");

        console.log("[INIT] Checking auth session...");
        const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
        if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);
        if (!session || !session.user) {
            console.log('[Init Vyuka - Kyber] Not logged in. Redirecting...');
            window.location.href = '/auth/index.html';
            return;
        }
        state.currentUser = session.user;
        console.log(`[INIT] User authenticated (ID: ${state.currentUser.id}). Fetching profile...`);

        setLoadingState('user', true);
        state.currentProfile = await fetchUserProfile(state.currentUser.id);
        setLoadingState('user', false);

        if (!state.currentProfile) {
            console.warn(`Profile not found for user ${state.currentUser.id}. Displaying warning.`);
            initializationError = new Error("Profil nenalezen nebo se nepodařilo načíst. Zkuste obnovit stránku.");
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
                .catch(err => {
                    console.error("Chyba při úvodním načítání notifikací:", err);
                    renderNotifications(0, []);
                    showToast('Chyba Notifikací', 'Nepodařilo se načíst signály.', 'error');
                })
                .finally(() => {
                    setLoadingState('notifications', false);
                    // Manage button state ONLY after notifications finished loading
                    manageButtonStates();
                });

            const loadTopicPromise = loadNextTopicFlow()
                 .catch(err => {
                    console.error("Chyba při načítání úvodního tématu:", err);
                 });

            await Promise.all([loadNotificationsPromise, loadTopicPromise]);
            console.log("[INIT] Initial data loading complete (or errors handled).");

        } else if (initializationError) {
             setLoadingState('currentTopic', false);
             setLoadingState('notifications', false);
        }

    } catch (error) {
        console.error("❌ [Init Vyuka - Kyber] Critical initialization error:", error);
        initializationError = error;
        if (!document.getElementById('main-mobile-menu-toggle')) {
            try { initializeUI(); } catch (uiError) { console.error("Failed to initialize UI during error handling:", uiError); }
        }
        manageUIState('error', { errorMessage: error.message });
    } finally {
        console.log("[INIT] Finalizing initialization (finally block)...");
        if (ui.initialLoader) {
             ui.initialLoader.classList.add('hidden');
             setTimeout(() => {
                 if (ui.initialLoader) ui.initialLoader.style.display = 'none';
             }, 500);
        }
        if (ui.mainContent) {
            ui.mainContent.style.display = 'flex';
            requestAnimationFrame(() => {
                if (ui.mainContent) ui.mainContent.classList.add('loaded');
                initScrollAnimations();
            });
        }
        if (initializationError) {
            setLoadingState('all', false);
            showError(`Chyba inicializace: ${initializationError.message}`, true);
        }
        // Final check to ensure buttons reflect the end state
        manageButtonStates();
        console.log("✅ [Init Vyuka - Kyber] App Initialization Finished (finally block).");
    }
}


/**
 * Инициализация базового UI.
 */
function initializeUI() {
    try {
        updateTheme();
        setupEventListeners();
        initTooltips();

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
        showError(`Chyba inicializace UI: ${error.message}`, false);
        if (error.stack) console.error("Original stack trace:", error.stack);
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
            event.stopPropagation();
            ui.notificationsDropdown?.classList.toggle('active');
        });
    } else {
        console.warn("Notification bell element not found.");
    }

    if (ui.markAllReadBtn) {
        ui.markAllReadBtn.addEventListener('click', async () => {
            if (state.isLoading.notifications) return;
            setLoadingState('notifications', true);
            manageButtonStates(); // Disable button immediately
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
                manageButtonStates(); // Re-enable/check state after action
            }
        });
    } else {
        console.warn("Mark all read button not found.");
    }

    if (ui.notificationsList) {
        ui.notificationsList.addEventListener('click', async (event) => {
            const item = event.target.closest('.notification-item');
            if (item && !state.isLoading.notifications) {
                const notificationId = item.dataset.id;
                const link = item.dataset.link;
                const isRead = item.classList.contains('is-read');

                if (!isRead && notificationId && state.currentUser) {
                    item.style.opacity = '0.5';
                    const success = await markNotificationRead(notificationId, state.currentUser.id);
                    item.style.opacity = '';

                    if (success) {
                        item.classList.add('is-read');
                        item.querySelector('.unread-dot')?.remove();
                        const countEl = ui.notificationCount;
                        if (countEl) {
                            const currentCount = parseInt(countEl.textContent.replace('+', '') || '0');
                            const newCount = Math.max(0, currentCount - 1);
                            countEl.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                            countEl.classList.toggle('visible', newCount > 0);
                        }
                        manageButtonStates(); // Update mark all read button state
                    } else {
                        showToast('Chyba', 'Nepodařilo se označit oznámení.', 'error');
                    }
                }
                if (link) {
                    ui.notificationsDropdown?.classList.remove('active');
                    window.location.href = link;
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
    // ... (код из предыдущего ответа без изменений) ...
    if (!ui.sidebarName || !ui.sidebarAvatar) return;
    if (state.currentUser && state.currentProfile) {
        const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot';
        ui.sidebarName.textContent = sanitizeHTML(displayName);
        const initials = getInitials(state.currentProfile, state.currentUser.email);
        const avatarUrl = state.currentProfile.avatar_url;
        let finalUrl = avatarUrl;
        if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('//') && !avatarUrl.startsWith('data:')) {
             finalUrl = null; console.warn("Invalid avatar URL:", avatarUrl);
        } else if (avatarUrl) { finalUrl = sanitizeHTML(avatarUrl); }
        ui.sidebarAvatar.innerHTML = finalUrl ? `<img src="${finalUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
        const sidebarImg = ui.sidebarAvatar.querySelector('img');
        if (sidebarImg) { sidebarImg.onerror = function() { console.warn(`Failed to load avatar: ${this.src}`); ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; }
    } else { ui.sidebarName.textContent = 'Nepřihlášen'; ui.sidebarAvatar.textContent = '?'; }
}

/**
 * Отображает уведомления в выпадающем списке.
 */
 function renderNotifications(count, notifications) {
     // ... (код из предыдущего ответа без изменений) ...
     console.log("[Render Notifications] Count:", count, "Notifications:", notifications);
     if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements."); return; }
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
         ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.add('has-content');
     } else {
         ui.notificationsList.innerHTML = '';
         ui.noNotificationsMsg.style.display = 'block';
         ui.notificationsList.style.display = 'none';
         ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.remove('has-content');
     }
     const currentUnreadCount = parseInt(ui.notificationCount.textContent.replace('+', '') || '0');
     ui.markAllReadBtn.disabled = currentUnreadCount === 0 || state.isLoading.notifications; // Ensure button state reflects loading
     console.log("[Render Notifications] Finished rendering.");
 }

/**
 * Управляет общим состоянием интерфейса (Co se zobrazuje).
 * FIX: Ensures whiteboard placeholder handling is robust.
 */
 function manageUIState(mode, options = {}) {
    console.log("[UI State]:", mode, options);

    const isLearningActive = state.currentTopic && ['learning', 'chatting', 'requestingExplanation', 'waitingForAnswer'].includes(mode);
    const isLoading = mode === 'loadingTopic' || mode === 'initial' || state.isLoading.currentTopic || state.isLoading.chat;
    const isEmptyState = ['noPlan', 'planComplete', 'error', 'loggedOut'].includes(mode);

    // --- Zobrazení Hlavního Rozhraní ---
    if (ui.learningInterface) {
        const shouldShowInterface = !isEmptyState && mode !== 'initial';
        ui.learningInterface.style.display = shouldShowInterface ? 'flex' : 'none';
    }

    // --- Zobrazení Prázdných Stavů / Chyb v Chat Oblasti ---
    if (ui.chatMessages) {
        let emptyStateHTML = '';
        if (isEmptyState || mode === 'initial' || mode === 'loadingTopic') {
            ui.chatMessages.innerHTML = ''; // Clear previous messages first
            switch (mode) {
                case 'loggedOut': emptyStateHTML = `<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPŘIHLÁŠEN</h3><p>Pro přístup k výuce se prosím <a href="/auth/index.html" style="color: var(--accent-primary)">přihlaste</a>.</p></div>`; break;
                case 'noPlan': emptyStateHTML = `<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ŽÁDNÝ AKTIVNÍ PLÁN</h3><p>Nemáte aktivní studijní plán. Nejprve prosím dokončete <a href="/dashboard/procvicovani/test1.html" style="color: var(--accent-primary)">diagnostický test</a>.</p></div>`; break;
                case 'planComplete': emptyStateHTML = `<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLÁN DOKONČEN!</h3><p>Všechny naplánované aktivity jsou hotové. Skvělá práce! Můžete si <a href="/dashboard/procvicovani/plan.html" style="color: var(--accent-primary)">vytvořit nový plán</a>.</p></div>`; break;
                case 'error': emptyStateHTML = `<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA SYSTÉMU</h3><p>${sanitizeHTML(options.errorMessage || 'Nastala chyba při načítání dat.')}</p></div>`; if (options.errorMessage && !document.getElementById('global-error')?.offsetParent) showError(options.errorMessage, true); break;
                case 'initial': emptyStateHTML = '<div class="empty-state"><i class="fas fa-cog fa-spin"></i><h3>Inicializace...</h3></div>'; break;
                case 'loadingTopic': emptyStateHTML = '<div class="empty-state initial-load-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; color: var(--text-muted);"><i class="fas fa-book-open" style="font-size: 2rem; margin-bottom: 1rem;"></i><p>Načítání tématu...</p></div>'; break;
            }
            if (emptyStateHTML) ui.chatMessages.innerHTML = emptyStateHTML;
        } else if (isLearningActive && !ui.chatMessages.hasChildNodes()) {
            ui.chatMessages.innerHTML = `<div class='empty-state'><i class='fas fa-comments'></i><h3>Chat připraven</h3><p>Zeptejte se na cokoliv k tématu nebo počkejte na pokyny AI.</p></div>`;
        }
    }

    // --- Zobrazení Prázdných Stavů v Whiteboard ---
    if (ui.whiteboardContent) {
        const existingPlaceholder = ui.whiteboardContent.querySelector('.initial-load-placeholder');
        if (isEmptyState || mode === 'loadingTopic') {
             if(!existingPlaceholder || mode !== 'loadingTopic') {
                ui.whiteboardContent.innerHTML = `<div class="empty-state initial-load-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; color: var(--text-muted);">
                                                  <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                                                  <p>${mode === 'loadingTopic' ? 'Načítání první lekce...' : 'Systém není připraven.'}</p>
                                                </div>`;
            }
        } else if (isLearningActive) {
            // If learning is active, the placeholder *should* have been removed by startLearningSession or requestContinue.
            // If it's still there, remove it now. If the board is empty after removal, show 'ready' state.
            if(existingPlaceholder) {
                 console.warn("[ManageUIState] Removing lingering whiteboard placeholder.");
                 existingPlaceholder.remove();
                 if (!ui.whiteboardContent.hasChildNodes()) {
                      ui.whiteboardContent.innerHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule připravena</h3><p>Zde se bude zobrazovat vysvětlení od AI.</p></div>`;
                 }
            } else if (!ui.whiteboardContent.hasChildNodes()) {
                 // Board is empty and learning is active (and no placeholder found)
                 ui.whiteboardContent.innerHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule připravena</h3><p>Zde se bude zobrazovat vysvětlení od AI.</p></div>`;
            }
        }
    }

    // Update button states based on the current mode and state flags
    manageButtonStates();
}


/**
 * Управляет активностью/неактивностью кнопок.
 * FIX: Refined conditions for enabling chat and continue buttons.
 */
function manageButtonStates() {
    // Core state flags
    const hasTopic = !!state.currentTopic;
    const isThinking = state.geminiIsThinking;
    const isLoadingTopic = state.topicLoadInProgress;
    const isWaitingForAnswer = state.aiIsWaitingForAnswer;
    const isListening = state.isListening;
    const isSpeaking = state.speechSynthesisSupported && window.speechSynthesis.speaking;

    // Derived states for clarity
    const isBusy = isThinking || isLoadingTopic || isListening;
    const canChat = hasTopic && !isBusy && !isWaitingForAnswer; // Can chat only if not busy AND AI isn't waiting
    const canContinue = hasTopic && !isBusy && !isWaitingForAnswer; // Can continue only if not busy AND AI isn't waiting
    const canComplete = hasTopic && !isBusy; // Can complete even if busy/waiting? Let's allow it for now.
    const canUseMic = hasTopic && !isBusy && !isWaitingForAnswer && state.speechRecognitionSupported; // Mic follows canChat logic + support

    // UI element states
    const chatInputHasText = ui.chatInput?.value.trim().length > 0;
    const chatIsEmpty = !ui.chatMessages?.hasChildNodes() || !!ui.chatMessages?.querySelector('.empty-state');
    const boardIsEmpty = !ui.whiteboardContent?.hasChildNodes() || !!ui.whiteboardContent?.querySelector('.empty-state');
    const notificationsLoading = state.isLoading.notifications;
    const unreadNotifCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');


    // --- Apply states ---
    if (ui.sendButton) {
        ui.sendButton.disabled = !canChat || !chatInputHasText;
        ui.sendButton.innerHTML = isThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
    }
    if (ui.chatInput) {
        ui.chatInput.disabled = !canChat; // Disable if cannot chat
        ui.chatInput.placeholder = isListening ? "Poslouchám..." : (canChat ? "Zeptejte se nebo odpovězte..." : (isWaitingForAnswer ? "AI čeká na odpověď..." : "Počkejte prosím..."));
    }
    if (ui.continueBtn) {
        ui.continueBtn.disabled = !canContinue;
        ui.continueBtn.style.display = hasTopic ? 'inline-flex' : 'none';
    }
    if (ui.markCompleteBtn) {
        ui.markCompleteBtn.disabled = !canComplete;
        ui.markCompleteBtn.style.display = hasTopic ? 'inline-flex' : 'none';
    }
    if (ui.clearBoardBtn) {
        ui.clearBoardBtn.disabled = boardIsEmpty || isThinking;
    }
    if (ui.stopSpeechBtn) {
        ui.stopSpeechBtn.disabled = !isSpeaking;
    }
    if (ui.micBtn) {
        ui.micBtn.disabled = !canUseMic;
        ui.micBtn.classList.toggle('listening', isListening);
        ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporováno" : (isListening ? "Zastavit hlasový vstup" : "Zahájit hlasový vstup");
    }
    if (ui.clearChatBtn) {
        ui.clearChatBtn.disabled = isThinking || chatIsEmpty;
    }
    if (ui.saveChatBtn) {
        ui.saveChatBtn.disabled = isThinking || chatIsEmpty;
    }
    if (ui.markAllReadBtn) {
        ui.markAllReadBtn.disabled = unreadNotifCount === 0 || notificationsLoading;
    }

    // Console log for debugging button states
    // console.log("Button States Updated:", { canChat, canContinue, canComplete, canUseMic, isBusy, isWaiting: isWaitingForAnswer });
}


// --- Handle Dynamic TTS Click ---
function handleDynamicTTSClick(event) {
    // ... (код из предыдущего ответа без изменений) ...
    const button = event.target.closest('.tts-listen-btn');
    if (button && button.dataset.textToSpeak) {
        const chunkElement = button.closest('.whiteboard-chunk');
        speakText(button.dataset.textToSpeak, chunkElement);
    }
}

// --- Обработчики Действий ---

/**
 * Обрабатывает отправку сообщения из чата.
 * FIX: Ensures correct state management and button updates.
 */
async function handleSendMessage() {
    if (!state.currentUser || !state.currentProfile) { showError("Nelze odeslat zprávu, chybí data uživatele.", false); return; }

    const canChat = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.aiIsWaitingForAnswer;
    if (!canChat) { showToast('Nelze odeslat', 'Počkejte prosím na AI nebo odpovězte na otázku.', 'warning'); return; }

    const text = ui.chatInput?.value.trim();
    if (!text || state.isListening) return;

    const inputBeforeSend = ui.chatInput?.value;
    if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }

    try {
        await addChatMessage(text, 'user');
        initTooltips();
        state.geminiChatContext.push({ role: "user", parts: [{ text }] });

        // --- Start Thinking State ---
        state.geminiIsThinking = true; // Set thinking BEFORE async call
        state.aiIsWaitingForAnswer = false; // User has replied, AI is no longer waiting
        addThinkingIndicator();
        manageButtonStates(); // Update UI immediately
        // --------------------------

        let promptForGemini;
        // Build prompt based on whether the *previous* state was waiting
        // Note: aiIsWaitingForAnswer is already false here
        promptForGemini = `Student píše do chatu: "${text}". Téma je "${state.currentTopic.name}". Odpověz relevantně v rámci tématu a konverzace. Použij POUZE text do chatu. Nepřidávej bloky [BOARD_MARKDOWN] ani [TTS_COMMENTARY].`;


        const response = await sendToGemini(promptForGemini, true);

        removeThinkingIndicator(); // Remove indicator after response

        if (response.success && response.data) {
            const { chatText, ttsCommentary } = response.data;
            if (chatText) {
                await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                initTooltips();
                const lowerChatText = chatText.toLowerCase();
                // Set waiting state based on the NEW response
                state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
            } else {
                console.warn("Gemini chat response missing chatText.");
                await addChatMessage("(AI neodpovědělo textem)", 'gemini', false);
                state.aiIsWaitingForAnswer = false; // Reset if no text
                manageUIState('learning');
            }
        } else {
            console.error("Error response from Gemini:", response.error);
            await addChatMessage(`Promiňte, nastala chyba: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
            state.aiIsWaitingForAnswer = false; // Reset on error
            manageUIState('learning');
            if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
        }
    } catch (error) {
        console.error("Error in handleSendMessage:", error);
        showError("Došlo k chybě při odesílání zprávy.", false);
        removeThinkingIndicator(); // Ensure removal on unexpected error
        state.aiIsWaitingForAnswer = false; // Reset on unexpected error
        manageUIState('learning');
        if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
    } finally {
        // --- End Thinking State ---
        state.geminiIsThinking = false; // Reset thinking state
        setLoadingState('chat', false); // Reset specific chat loading (if used elsewhere)
        manageButtonStates(); // Update buttons based on final state
        // --------------------------
    }
}

/**
 * Запрашивает следующую часть объяснения у AI.
 * FIX: Ensures correct state management and button updates.
 */
async function requestContinue() {
    const canContinue = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.aiIsWaitingForAnswer;
    if (!canContinue) {
        console.log("Cannot request continue:", { thinking: state.geminiIsThinking, topic: !!state.currentTopic, waiting: state.aiIsWaitingForAnswer, loading: state.topicLoadInProgress });
        showToast('Nelze pokračovat', 'Počkejte na dokončení předchozí akce nebo odpovězte AI.', 'warning');
        return;
    }

    // --- Start Thinking State ---
    state.geminiIsThinking = true; // Set thinking BEFORE async call
    state.aiIsWaitingForAnswer = false; // Explicitly not waiting when user clicks continue
    addThinkingIndicator();
    manageButtonStates(); // Update UI immediately
    // --------------------------

    const prompt = `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Naváž na předchozí část. Vygeneruj další logickou část výkladu.\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`;

    try {
        const response = await sendToGemini(prompt, false);

        removeThinkingIndicator(); // Remove indicator after response

        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            let domChanged = false;

            if (boardMarkdown) {
                 const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder');
                 if (placeholder) placeholder.remove();
                 appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                 domChanged = true;
            }
            if (chatText) {
                await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                domChanged = true;
                const lowerChatText = chatText.toLowerCase();
                // Set waiting state based on the NEW response
                state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
            } else if (ttsCommentary && !boardMarkdown) {
                await addChatMessage("(Poslechněte si další část komentáře)", 'gemini', true, new Date(), ttsCommentary);
                domChanged = true;
                state.aiIsWaitingForAnswer = false; // Not waiting
                manageUIState('learning');
            } else if (!boardMarkdown && !chatText && !ttsCommentary) {
                console.warn("Gemini continue request returned empty content.");
                await addChatMessage("(AI neposkytlo další obsah, zkuste se zeptat jinak.)", 'gemini', false);
                state.aiIsWaitingForAnswer = false; // Not waiting
                manageUIState('learning');
            } else {
                 state.aiIsWaitingForAnswer = false; // Not waiting (likely only board content)
                 manageUIState('learning');
            }

            if (domChanged) { initTooltips(); }

        } else {
            console.error("Error response from Gemini on continue:", response.error);
            await addChatMessage(`Promiňte, nastala chyba při pokračování: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
            state.aiIsWaitingForAnswer = false; // Reset on error
            manageUIState('learning');
        }
    } catch (error) {
        console.error("Error in requestContinue:", error);
        showError("Došlo k chybě při žádosti o pokračování.", false);
        removeThinkingIndicator(); // Ensure removal on unexpected error
        state.aiIsWaitingForAnswer = false; // Reset on unexpected error
        manageUIState('learning');
    } finally {
        // --- End Thinking State ---
        state.geminiIsThinking = false; // Reset thinking state
        setLoadingState('chat', false); // Reset specific chat loading (if used)
        manageButtonStates(); // Update buttons based on final state
        // --------------------------
    }
}


/**
 * Запускает сессию обучения для текущей темы.
 * FIX: Ensures correct state management and button updates.
 */
async function startLearningSession() {
     if (!state.currentTopic) { console.error("Cannot start learning session: no current topic."); manageUIState('error', {errorMessage: 'Chyba: Téma není definováno.'}); return; }

    state.currentSessionId = generateSessionId();

    // --- Start Thinking State ---
    state.geminiIsThinking = true; // Set thinking BEFORE async call
    state.aiIsWaitingForAnswer = false;
    manageUIState('requestingExplanation');
    addThinkingIndicator();
    manageButtonStates();
    // --------------------------

    const prompt = `Jsi AI Tutor "Justax". Vysvětli ZÁKLADY tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Rozděl vysvětlení na menší logické části. Pro PRVNÍ ČÁST:\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`;

    try {
        const response = await sendToGemini(prompt, false);

        removeThinkingIndicator(); // Remove after response

        if (response.success && response.data) {
             const { boardMarkdown, ttsCommentary, chatText } = response.data;
             let domChanged = false;
             const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder');
             if (placeholder) { placeholder.remove(); console.log("Initial whiteboard placeholder removed."); }
             else if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = ''; } // Clear board if no placeholder

             if (boardMarkdown) { appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); domChanged = true; }
             if (chatText) {
                 await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                 domChanged = true;
                 const lowerChatText = chatText.toLowerCase();
                 state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
                 manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
             } else if (ttsCommentary && !boardMarkdown){
                 await addChatMessage("(Poslechněte si úvodní komentář)", 'gemini', true, new Date(), ttsCommentary); domChanged = true; state.aiIsWaitingForAnswer = false; manageUIState('learning');
             } else if (!boardMarkdown && !chatText && !ttsCommentary){
                 console.warn("Gemini initial request returned empty content.");
                 await addChatMessage("(AI neposkytlo úvodní obsah. Zkuste položit otázku.)", 'gemini', false);
                 if (!boardMarkdown && ui.whiteboardContent && !ui.whiteboardContent.hasChildNodes()) { ui.whiteboardContent.innerHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule prázdná</h3><p>AI neposkytlo obsah pro tabuli.</p></div>`; }
                 state.aiIsWaitingForAnswer = false; manageUIState('learning');
             } else { state.aiIsWaitingForAnswer = false; manageUIState('learning'); }
             if(domChanged) { initTooltips(); }
        } else {
             console.error("Error response from Gemini:", response.error);
             await addChatMessage(`Promiňte, nastala chyba při zahájení výkladu: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
             ui.whiteboardContent?.querySelector('.initial-load-placeholder')?.remove();
             if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba načítání</h3><p>Obsah pro tabuli nelze zobrazit.</p></div>`; }
             state.aiIsWaitingForAnswer = false; manageUIState('learning'); showError(`Chyba AI: ${response.error}`, false);
        }
    } catch(error) {
        console.error("Error in startLearningSession:", error);
        showError("Došlo k chybě při zahájení výkladu.", false);
        removeThinkingIndicator();
        ui.whiteboardContent?.querySelector('.initial-load-placeholder')?.remove();
        if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba systému</h3><p>Nelze zahájit výuku.</p></div>`; }
        await addChatMessage(`Systémová chyba: ${error.message}`, 'gemini', false);
        state.aiIsWaitingForAnswer = false; manageUIState('learning');
    } finally {
        // --- End Thinking State ---
        state.geminiIsThinking = false; // Reset thinking state
        setLoadingState('chat', false); // Reset specific chat loading
        manageButtonStates(); // Update buttons based on final state
        // --------------------------
    }
}


/**
 * Поток действий при нажатии "Označit jako dokončené".
 * FIX: Ensures correct state management and button updates.
 */
async function handleMarkTopicCompleteFlow() {
    const canComplete = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress;
    if (!canComplete || state.isLoading.points) return;

    if (!confirm(`Opravdu označit téma "${state.currentTopic.name}" jako dokončené?`)) return;

    console.log(`[Flow] Marking topic ${state.currentTopic.activity_id} as complete.`);

    // --- Start Completion State ---
    state.topicLoadInProgress = true; // Use this flag to block other topic actions
    // setLoadingState('currentTopic', true); // Optionally use a general loading indicator
    manageButtonStates(); // Disable interactions
    // ---------------------------

    try {
        const successMark = await markTopicComplete(state.currentTopic.activity_id, state.currentUser.id);

        if (successMark) {
            console.log(`[Flow] Topic marked complete. Awarding points...`);
            setLoadingState('points', true);
            manageButtonStates(); // Reflect points loading state
            const pointsAwarded = await awardPoints(state.currentUser.id, POINTS_TOPIC_COMPLETE);
            setLoadingState('points', false);

            if (pointsAwarded) { showToast('+', `${POINTS_TOPIC_COMPLETE} kreditů získáno!`, 'success', 3000); }
            else { showToast('Varování', 'Téma dokončeno, ale body se nepodařilo připsat.', 'warning'); }

            showToast(`Téma "${state.currentTopic.name}" dokončeno.`, "success");
            // Completion state ends here, loadNextTopicFlow handles its own state
            state.topicLoadInProgress = false; // Allow next topic load to start
            // setLoadingState('currentTopic', false); // Handled by loadNextTopicFlow
            await loadNextTopicFlow(); // Load next topic

        } else {
            showToast("Chyba při označování tématu jako dokončeného.", "error");
            state.topicLoadInProgress = false; // Reset on failure
            // setLoadingState('currentTopic', false);
            manageButtonStates(); // Re-enable based on current state
        }
    } catch (error) {
        console.error("Error in handleMarkTopicCompleteFlow:", error);
        showToast("Neočekávaná chyba při dokončování tématu.", "error");
        state.topicLoadInProgress = false; // Reset on exception
        setLoadingState('points', false);
        // setLoadingState('currentTopic', false);
        manageButtonStates(); // Re-enable based on current state
    }
    // No finally needed here as success path calls loadNextTopicFlow
}


/**
 * Поток действий для загрузки следующей темы.
 * FIX: Ensures correct state management and button updates.
 */
async function loadNextTopicFlow() {
     if (!state.currentUser || state.topicLoadInProgress) { console.log("[Flow] Load next topic skipped."); return; }

     console.log("[Flow] Loading next topic flow started.");
     state.topicLoadInProgress = true; // START Blocking flag
     setLoadingState('currentTopic', true); // Show visual loading
     state.currentTopic = null;
     state.geminiChatContext = [];
     state.aiIsWaitingForAnswer = false;

     if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám další téma...</span>';
     clearWhiteboard(false);
     if (ui.chatMessages) ui.chatMessages.innerHTML = '';
     manageUIState('loadingTopic');
     manageButtonStates(); // Disable interactions

     try {
          console.log("[Flow] Calling loadNextUncompletedTopic...");
          const result = await loadNextUncompletedTopic(state.currentUser.id);
          console.log("[Flow] loadNextUncompletedTopic result:", result);

          if (result.success && result.topic) {
              state.currentTopic = result.topic;
              if (ui.currentTopicDisplay) { ui.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(state.currentTopic.name)}</strong>`; }
              // Stop visual loading HERE, session starts its own loading
              setLoadingState('currentTopic', false);
              // Release blocking flag BEFORE starting session
              state.topicLoadInProgress = false; // END Blocking flag (success)
              await startLearningSession();
          } else {
              state.currentTopic = null;
              if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(${result.message || 'Není další téma'})</span>`;
              manageUIState(result.reason || 'error', { errorMessage: result.message });
              setLoadingState('currentTopic', false); // Ensure visual loading stops
              state.topicLoadInProgress = false; // END Blocking flag (no topic/error)
              manageButtonStates(); // Update buttons as no topic is active
          }
     } catch(error) {
          console.error("Error in loadNextTopicFlow execution:", error);
          state.currentTopic = null;
          if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(Chyba načítání)</span>`;
          manageUIState('error', { errorMessage: `Chyba při načítání dalšího tématu: ${error.message}` });
          setLoadingState('currentTopic', false); // Ensure visual loading stops
          state.topicLoadInProgress = false; // END Blocking flag (exception)
          manageButtonStates(); // Update buttons after exception
     }
     // No finally needed as all paths handle state and buttons
     console.log("[Flow] Loading next topic flow finished.");
}


// --- Запуск Приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);