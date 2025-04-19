// vyukaApp.js - Основной файл приложения Vyuka, инициализация и координация модулей (Версия с улучшениями)

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

// Карта визуальных стилей для уведомлений (можно вынести в config.js)
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
 * Главная функция инициализации приложения.
 */
async function initializeApp() {
    console.log("🚀 [Init Vyuka - Kyber V3.1] Starting App Initialization..."); // Version bump for clarity
    let initializationError = null;

    if (ui.initialLoader) {
        ui.initialLoader.style.display = 'flex';
        ui.initialLoader.classList.remove('hidden');
    }
    if (ui.mainContent) ui.mainContent.style.display = 'none';
    hideError();

    try {
        const supabaseInitialized = initializeSupabase();
        if (!supabaseInitialized) throw new Error("Kritická chyba: Nepodařilo se připojit k databázi.");
        state.supabase = supabaseInitialized;
        console.log("[INIT] Supabase Initialized.");

        console.log("[INIT] Checking auth session...");
        const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
        if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);
        if (!session || !session.user) { console.log('[INIT] Not logged in. Redirecting...'); window.location.href = '/auth/index.html'; return; }
        state.currentUser = session.user;
        console.log(`[INIT] User authenticated (ID: ${state.currentUser.id}). Fetching profile...`);

        setLoadingState('user', true);
        state.currentProfile = await fetchUserProfile(state.currentUser.id);
        setLoadingState('user', false);

        if (!state.currentProfile) {
            console.warn(`Profile not found for user ${state.currentUser.id}.`);
            initializationError = new Error("Profil nenalezen nebo se nepodařilo načíst. Zkuste obnovit stránku.");
            // We need UI initialized even to show the error properly
            try { initializeUI(); updateUserInfoUI(); } catch (uiError) { console.error("UI Init failed during profile error:", uiError); }
            manageUIState('error', { errorMessage: initializationError.message });
        } else {
            console.log("[INIT] Profile fetched successfully.");
        }

        console.log("[INIT] Initializing base UI...");
        initializeUI(); // Initialize UI regardless of profile outcome (needed for error display)
        updateUserInfoUI(); // Update user info based on fetched data (or lack thereof)

        if (state.currentProfile && !initializationError) {
            console.log("[INIT] Loading initial topic and notifications...");
            setLoadingState('currentTopic', true);
            setLoadingState('notifications', true);

            const loadNotificationsPromise = fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
                .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                .catch(err => { console.error("Chyba při úvodním načítání notifikací:", err); renderNotifications(0, []); showToast('Chyba Notifikací', 'Nepodařilo se načíst signály.', 'error'); })
                .finally(() => {
                    setLoadingState('notifications', false);
                    manageButtonStates(); // Explicit call after async notification load
                });

            const loadTopicPromise = loadNextTopicFlow()
                 .catch(err => {
                     console.error("Chyba při načítání úvodního tématu:", err);
                     // Ensure UI reflects the error state even if profile was fetched
                     manageUIState('error', { errorMessage: `Chyba načítání tématu: ${err.message}` });
                     setLoadingState('currentTopic', false); // Ensure loading stops on error
                 });

            await Promise.all([loadNotificationsPromise, loadTopicPromise]);
            console.log("[INIT] Initial data loading complete (or errors handled).");

        } else {
             // If profile failed or error occurred, ensure loading states are off
             setLoadingState('currentTopic', false);
             setLoadingState('notifications', false);
             // Ensure manageButtonStates is called to reflect the error/no-profile state
             manageButtonStates();
        }

    } catch (error) {
        console.error("❌ [Init Vyuka - Kyber V3.1] Critical initialization error:", error);
        initializationError = error;
        // Attempt to initialize UI for error display if not already done
        if (!document.getElementById('main-mobile-menu-toggle')) {
            try { initializeUI(); } catch (uiError) { console.error("Failed to initialize UI during critical error handling:", uiError); }
        }
        manageUIState('error', { errorMessage: error.message });
        setLoadingState('all', false); // Ensure all loading states are off
        // Show error prominently
        showError(`Chyba inicializace: ${error.message}`, true);
    } finally {
        console.log("[INIT] Finalizing initialization (finally block)...");
        if (ui.initialLoader) {
             ui.initialLoader.classList.add('hidden');
             setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500);
        }
        if (ui.mainContent) {
            ui.mainContent.style.display = 'flex'; // Use 'flex' as per layout
            requestAnimationFrame(() => {
                if (ui.mainContent) ui.mainContent.classList.add('loaded');
                initScrollAnimations(); // Initialize animations after layout is visible
            });
        }
        // Final call to ensure buttons reflect the final state
        manageButtonStates();
        console.log("✅ [Init Vyuka - Kyber V3.1] App Initialization Finished (finally block).");
    }
}

/**
 * Инициализация базового UI.
 */
function initializeUI() {
    console.log("[UI Init] Initializing UI elements and handlers...");
    try {
        updateTheme();
        setupEventListeners();
        initTooltips();
        if (ui.chatTabButton) ui.chatTabButton.classList.add('active');
        if (ui.chatTabContent) ui.chatTabContent.classList.add('active');
        initializeSpeechRecognition(); // Initialize STT service
        initMouseFollower();
        initHeaderScrollDetection();
        updateCopyrightYear();
        updateOnlineStatus();
        manageUIState('initial'); // Set initial screen state
        console.log("[UI Init] UI Initialized successfully.");
    } catch (error) {
        console.error("UI Init failed:", error);
        showError(`Chyba inicializace UI: ${error.message}`, false);
        // If you have a stack trace, log it for more detailed debugging
        if (error.stack) console.error("Original stack trace:", error.stack);
    }
}


/**
 * Настройка основных обработчиков событий.
 */
function setupEventListeners() {
    console.log("[SETUP] Setting up event listeners...");
    let listenersAttached = 0; // Counter for attached listeners

    // Helper function to attach listener and log
    function addListener(element, event, handler, elementName) {
        if (element) {
            element.addEventListener(event, handler);
            listenersAttached++;
            // console.log(`[SETUP] Listener '${event}' added to '${elementName}'.`);
        } else {
            console.warn(`[SETUP] Element '${elementName}' not found. Listener not attached.`);
        }
    }

    // Mobile Menu Toggle
    addListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
    addListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
    addListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');

    // Chat Input & Buttons
    addListener(ui.chatInput, 'input', () => autoResizeTextarea(ui.chatInput), 'chatInput (input)');
    addListener(ui.sendButton, 'click', handleSendMessage, 'sendButton');
    addListener(ui.chatInput, 'keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
    }, 'chatInput (keypress)');
    addListener(ui.clearChatBtn, 'click', () => confirmClearChat(), 'clearChatBtn');
    addListener(ui.saveChatBtn, 'click', saveChatToPDF, 'saveChatBtn');
    addListener(ui.micBtn, 'click', handleMicClick, 'micBtn');

    // Whiteboard & Speech Controls
    addListener(ui.clearBoardBtn, 'click', () => { clearWhiteboard(false); showToast('Vymazáno', "Tabule vymazána.", "info"); }, 'clearBoardBtn');
    addListener(ui.stopSpeechBtn, 'click', stopSpeech, 'stopSpeechBtn');

    // Learning Flow Controls
    addListener(ui.continueBtn, 'click', requestContinue, 'continueBtn');
    addListener(ui.markCompleteBtn, 'click', handleMarkTopicCompleteFlow, 'markCompleteBtn');

    // Dynamic TTS Buttons (Event Delegation)
    addListener(ui.chatMessages, 'click', handleDynamicTTSClick, 'chatMessages (TTS Delegation)');
    addListener(ui.whiteboardContent, 'click', handleDynamicTTSClick, 'whiteboardContent (TTS Delegation)');

    // Theme Change Listener
    const darkModeMatcher = window.matchMedia('(prefers-color-scheme: dark)');
    if (darkModeMatcher && typeof darkModeMatcher.addEventListener === 'function') {
        darkModeMatcher.addEventListener('change', event => { state.isDarkMode = event.matches; updateTheme(); });
        listenersAttached++;
    } else {
        console.warn("[SETUP] Cannot add theme change listener.");
    }

    // Resize Listener
    window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) { closeMenu(); } });
    listenersAttached++;

    // Online/Offline Status
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    listenersAttached += 2;

    // Notification Listeners
    addListener(ui.notificationBell, 'click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell');
    addListener(ui.markAllReadBtn, 'click', async () => {
        if (state.isLoading.notifications || !state.currentUser) return;
        setLoadingState('notifications', true); manageButtonStates();
        try {
            const success = await markAllNotificationsRead(state.currentUser.id);
            if(success) { const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení označena.', 'success'); }
            else { showToast('CHYBA PŘENOSU', 'Nepodařilo se označit oznámení.', 'error'); }
        } catch (err) { console.error("Error marking all notifications read:", err); showToast('CHYBA SYSTÉMU', 'Při označování nastala chyba.', 'error');
        } finally { setLoadingState('notifications', false); manageButtonStates(); }
    }, 'markAllReadBtn');

    addListener(ui.notificationsList, 'click', async (event) => {
        const item = event.target.closest('.notification-item');
        if (item && !state.isLoading.notifications && state.currentUser) {
            const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read');
            if (!isRead && notificationId) {
                item.style.opacity = '0.5'; const success = await markNotificationRead(notificationId, state.currentUser.id); item.style.opacity = '';
                if (success) {
                    item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove();
                    const countEl = ui.notificationCount;
                    if (countEl) { const currentCount = parseInt(countEl.textContent.replace('+', '') || '0'); const newCount = Math.max(0, currentCount - 1); countEl.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); countEl.classList.toggle('visible', newCount > 0); }
                    manageButtonStates(); // Update mark all read button state
                } else { showToast('Chyba', 'Nepodařilo se označit oznámení.', 'error'); }
            }
            if (link) { ui.notificationsDropdown?.classList.remove('active'); window.location.href = link; }
        }
    }, 'notificationsList');

    // Close notification dropdown on outside click
    document.addEventListener('click', (event) => {
        if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) {
            ui.notificationsDropdown.classList.remove('active');
        }
    });
    listenersAttached++; // For document click listener

    console.log(`[SETUP] Event listeners setup complete. Total attached (approx): ${listenersAttached}`);
}

// --- Обновление UI ---

/**
 * Обновляет информацию о пользователе в UI (сайдбар).
 */
function updateUserInfoUI() {
    if (!ui.sidebarName || !ui.sidebarAvatar) {
        console.warn("updateUserInfoUI: Sidebar elements not found.");
        return;
    }
    if (state.currentUser && state.currentProfile) {
        const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot';
        ui.sidebarName.textContent = sanitizeHTML(displayName);
        const initials = getInitials(state.currentProfile, state.currentUser.email);
        const avatarUrl = state.currentProfile.avatar_url;
        let finalUrl = avatarUrl;

        // Basic URL validation
        if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('//') && !avatarUrl.startsWith('data:')) {
            finalUrl = null; // Treat invalid URLs as null
            console.warn("Invalid avatar URL:", avatarUrl);
        } else if (avatarUrl) {
            finalUrl = sanitizeHTML(avatarUrl); // Sanitize potentially valid URLs
        }

        ui.sidebarAvatar.innerHTML = finalUrl ? `<img src="${finalUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);

        // Add error handling for the image itself
        const sidebarImg = ui.sidebarAvatar.querySelector('img');
        if (sidebarImg) {
            sidebarImg.onerror = function() {
                console.warn(`Failed to load avatar: ${this.src}`);
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
    console.log("[Render Notifications V3.1] Count:", count, "Notifications:", notifications);
    if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
        console.error("[Render Notifications] Missing UI elements.");
        return;
    }

    // Update count badge
    ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
    ui.notificationCount.classList.toggle('visible', count > 0);

    // Render list or empty message
    if (notifications && notifications.length > 0) {
        ui.notificationsList.innerHTML = notifications.map(n => {
            // Determine icon and class based on type (using activityVisuals map)
            const visual = activityVisuals[(n.type || 'default').toLowerCase()] || activityVisuals.default;
            const isReadClass = n.is_read ? 'is-read' : '';
            const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : '';
            // Build list item HTML
            return `
                <div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
                    ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
                    <div class="notification-icon ${visual.class}">
                        <i class="fas ${visual.icon}"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${sanitizeHTML(n.title)}</div>
                        <div class="notification-message">${sanitizeHTML(n.message)}</div>
                        <div class="notification-time">${formatRelativeTime(n.created_at)}</div>
                    </div>
                </div>
            `;
        }).join('');
        ui.noNotificationsMsg.style.display = 'none';
        ui.notificationsList.style.display = 'block';
        ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.add('has-content');
    } else {
        ui.notificationsList.innerHTML = ''; // Clear list
        ui.noNotificationsMsg.style.display = 'block';
        ui.notificationsList.style.display = 'none';
        ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.remove('has-content');
    }

    // Update "Mark All Read" button state (disabled if count is 0 or notifications are loading)
    const currentUnreadCount = parseInt(ui.notificationCount.textContent.replace('+', '') || '0');
    ui.markAllReadBtn.disabled = currentUnreadCount === 0 || state.isLoading.notifications;

    console.log("[Render Notifications V3.1] Finished rendering.");
 }

/**
 * Управляет общим состоянием интерфейса (Co se zobrazuje).
 */
function manageUIState(mode, options = {}) {
    console.log("[UI State Change]:", mode, options);

    // Determine overall activity state
    const isLearningActive = state.currentTopic && ['learning', 'chatting', 'requestingExplanation', 'waitingForAnswer'].includes(mode);
    const isEmptyState = ['noPlan', 'planComplete', 'error', 'loggedOut', 'initial', 'loadingTopic'].includes(mode);

    // Show/hide main learning interface
    if (ui.learningInterface) {
        const shouldShowInterface = !isEmptyState;
        ui.learningInterface.style.display = shouldShowInterface ? 'flex' : 'none';
        console.log(`[UI State] Learning interface display: ${shouldShowInterface ? 'flex' : 'none'}`);
    }

    // Manage Chat Area Content
    if (ui.chatMessages) {
        let emptyStateHTML = '';
        // If in an empty/error/loading state OR if learning is active but chat has no real messages yet
        if (isEmptyState || (isLearningActive && !ui.chatMessages.querySelector('.chat-message'))) {
            // Clear existing messages if necessary
            if (ui.chatMessages.innerHTML !== '') { // Avoid unnecessary clears
                ui.chatMessages.innerHTML = '';
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
                    // Optionally show global error too if not already visible
                    if (options.errorMessage && !document.getElementById('global-error')?.offsetParent) {
                        showError(options.errorMessage, true);
                    }
                    break;
                case 'initial':
                    emptyStateHTML = '<div class="empty-state"><i class="fas fa-cog fa-spin"></i><h3>Inicializace...</h3></div>';
                    break;
                case 'loadingTopic':
                    emptyStateHTML = '<div class="empty-state initial-load-placeholder"><i class="fas fa-book-open" style="font-size: 2rem; margin-bottom: 1rem;"></i><p>Načítání tématu...</p></div>';
                    break;
                 case 'learning': // When starting a topic, before AI speaks
                    emptyStateHTML = `<div class='empty-state'><i class='fas fa-comments'></i><h3>Chat připraven</h3><p>Počkejte na první vysvětlení od AI nebo položte otázku.</p></div>`;
                    break;
                // Add other cases as needed
            }
            if (emptyStateHTML) {
                ui.chatMessages.innerHTML = emptyStateHTML;
                console.log(`[UI State] Chat set to state: ${mode}`);
            }
        }
        // If learning is active and chat *already* has messages, do nothing to chat messages here.
    }

    // Manage Whiteboard Area Content
    if (ui.whiteboardContent) {
        const existingPlaceholder = ui.whiteboardContent.querySelector('.initial-load-placeholder, .empty-state');
        // If in an empty/error/loading state OR if learning is active but board has no real content yet
        if (isEmptyState || (isLearningActive && !ui.whiteboardContent.querySelector('.whiteboard-chunk'))) {
            let emptyBoardHTML = '';
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
                case 'learning': // When starting a topic, before AI puts something on board
                     emptyBoardHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule připravena</h3><p>Zde se bude zobrazovat vysvětlení od AI.</p></div>`;
                     break;
            }
            // Only update if the state requires an empty state AND either no placeholder exists or the mode requires a *specific* placeholder
            if (emptyBoardHTML && (!existingPlaceholder || (mode === 'loadingTopic' || mode === 'error'))) {
                ui.whiteboardContent.innerHTML = emptyBoardHTML;
                console.log(`[UI State] Whiteboard set to state: ${mode}`);
            } else if (isLearningActive && existingPlaceholder) {
                // If learning is active but we still have a placeholder (e.g., from initial load), remove it
                existingPlaceholder.remove();
                console.log("[UI State] Removed whiteboard placeholder as learning is active.");
            }
        }
        // If learning is active and whiteboard *already* has content, do nothing here.
    }

    // *** CRUCIAL: Call manageButtonStates AFTER updating UI content ***
    manageButtonStates();
}


/**
 * Управляет активностью/неактивностью кнопок на основе текущего состояния.
 * Версия 3.1: Добавлено детальное логирование.
 */
function manageButtonStates() {
    // Core state flags
    const hasTopic = !!state.currentTopic;
    const isThinking = state.geminiIsThinking;
    const isLoadingTopic = state.topicLoadInProgress;
    const isWaitingForAnswer = state.aiIsWaitingForAnswer;
    const isListening = state.isListening;
    const isSpeaking = state.speechSynthesisSupported && window.speechSynthesis.speaking;
    const isLoadingPoints = state.isLoading.points; // Check points loading state

    // Derived states for clarity
    const isBusyGeneral = isThinking || isLoadingTopic || isListening || isLoadingPoints; // Added points loading
    const canInteract = hasTopic && !isBusyGeneral && !isWaitingForAnswer;
    const canComplete = hasTopic && !isBusyGeneral; // Allow complete even if waiting? Yes.
    const canUseMic = canInteract && state.speechRecognitionSupported && !isBusyGeneral; // Mic requires interaction + no busy

    // UI element states
    const chatInputHasText = ui.chatInput?.value.trim().length > 0;
    const chatIsEmpty = !ui.chatMessages?.hasChildNodes() || !!ui.chatMessages?.querySelector('.empty-state');
    const boardIsEmpty = !ui.whiteboardContent?.hasChildNodes() || !!ui.whiteboardContent?.querySelector('.empty-state');
    const notificationsLoading = state.isLoading.notifications;
    const unreadNotifCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');

    // --- Button State Logic with Logging ---

    // Send Button
    const sendDisabled = !canInteract || !chatInputHasText;
    if (ui.sendButton) {
        if (ui.sendButton.disabled !== sendDisabled) {
            console.log(`[BTN STATE] Send Button: ${sendDisabled ? 'DISABLED' : 'ENABLED'} (Reason: canInteract=${canInteract}, hasText=${chatInputHasText})`);
            ui.sendButton.disabled = sendDisabled;
        }
        ui.sendButton.innerHTML = isThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
    }

    // Chat Input
    const inputDisabled = !hasTopic || isBusyGeneral || isWaitingForAnswer;
    if (ui.chatInput) {
        if (ui.chatInput.disabled !== inputDisabled) {
            console.log(`[BTN STATE] Chat Input: ${inputDisabled ? 'DISABLED' : 'ENABLED'} (Reason: hasTopic=${hasTopic}, isBusy=${isBusyGeneral}, isWaiting=${isWaitingForAnswer})`);
            ui.chatInput.disabled = inputDisabled;
        }
        ui.chatInput.placeholder = isListening ? "Poslouchám..."
                                 : (inputDisabled ? (isThinking ? "AI přemýšlí..." : (isLoadingTopic ? "Načítám téma..." : (isWaitingForAnswer ? "Odpovězte na otázku AI..." : "Akce není dostupná...")))
                                 : "Zeptejte se nebo odpovězte...");
    }

    // Continue Button
    const continueDisabled = !canInteract;
    if (ui.continueBtn) {
        if (ui.continueBtn.disabled !== continueDisabled) {
            console.log(`[BTN STATE] Continue Button: ${continueDisabled ? 'DISABLED' : 'ENABLED'} (Reason: canInteract=${canInteract})`);
            ui.continueBtn.disabled = continueDisabled;
        }
        ui.continueBtn.style.display = hasTopic ? 'inline-flex' : 'none';
    }

    // Mark Complete Button
    const completeDisabled = !canComplete || isLoadingPoints; // Also disable if awarding points
    if (ui.markCompleteBtn) {
        if (ui.markCompleteBtn.disabled !== completeDisabled) {
            console.log(`[BTN STATE] Mark Complete Button: ${completeDisabled ? 'DISABLED' : 'ENABLED'} (Reason: canComplete=${canComplete}, isLoadingPoints=${isLoadingPoints})`);
            ui.markCompleteBtn.disabled = completeDisabled;
        }
        ui.markCompleteBtn.style.display = hasTopic ? 'inline-flex' : 'none';
    }

    // Clear Board Button
    const clearBoardDisabled = boardIsEmpty || isBusyGeneral; // Disable if busy
    if (ui.clearBoardBtn) {
        if (ui.clearBoardBtn.disabled !== clearBoardDisabled) {
            console.log(`[BTN STATE] Clear Board Button: ${clearBoardDisabled ? 'DISABLED' : 'ENABLED'} (Reason: boardEmpty=${boardIsEmpty}, isBusy=${isBusyGeneral})`);
            ui.clearBoardBtn.disabled = clearBoardDisabled;
        }
    }

    // Stop Speech Button
    const stopSpeechDisabled = !isSpeaking;
    if (ui.stopSpeechBtn) {
         if (ui.stopSpeechBtn.disabled !== stopSpeechDisabled) {
            console.log(`[BTN STATE] Stop Speech Button: ${stopSpeechDisabled ? 'DISABLED' : 'ENABLED'} (Reason: isSpeaking=${isSpeaking})`);
            ui.stopSpeechBtn.disabled = stopSpeechDisabled;
         }
    }

    // Microphone Button
    const micDisabled = !canUseMic || !state.speechRecognitionSupported; // Check support too
    if (ui.micBtn) {
         if (ui.micBtn.disabled !== micDisabled) {
             console.log(`[BTN STATE] Mic Button: ${micDisabled ? 'DISABLED' : 'ENABLED'} (Reason: canUseMic=${canUseMic}, supported=${state.speechRecognitionSupported})`);
             ui.micBtn.disabled = micDisabled;
         }
         ui.micBtn.classList.toggle('listening', isListening);
         ui.micBtn.title = !state.speechRecognitionSupported ? "Nepodporováno" : (isListening ? "Zastavit hlasový vstup" : (micDisabled ? "Hlasový vstup nedostupný" : "Zahájit hlasový vstup"));
    }

    // Clear Chat Button
    const clearChatDisabled = isThinking || chatIsEmpty; // Disable if thinking
    if (ui.clearChatBtn) {
         if (ui.clearChatBtn.disabled !== clearChatDisabled) {
            console.log(`[BTN STATE] Clear Chat Button: ${clearChatDisabled ? 'DISABLED' : 'ENABLED'} (Reason: isThinking=${isThinking}, chatEmpty=${chatIsEmpty})`);
            ui.clearChatBtn.disabled = clearChatDisabled;
         }
    }

    // Save Chat Button
    const saveChatDisabled = isThinking || chatIsEmpty; // Disable if thinking
    if (ui.saveChatBtn) {
         if (ui.saveChatBtn.disabled !== saveChatDisabled) {
            console.log(`[BTN STATE] Save Chat Button: ${saveChatDisabled ? 'DISABLED' : 'ENABLED'} (Reason: isThinking=${isThinking}, chatEmpty=${chatIsEmpty})`);
            ui.saveChatBtn.disabled = saveChatDisabled;
         }
    }

    // Mark All Read Notifications Button
    const markAllReadDisabled = unreadNotifCount === 0 || notificationsLoading;
    if (ui.markAllReadBtn) {
         if (ui.markAllReadBtn.disabled !== markAllReadDisabled) {
            console.log(`[BTN STATE] Mark All Read Button: ${markAllReadDisabled ? 'DISABLED' : 'ENABLED'} (Reason: unread=${unreadNotifCount}, loading=${notificationsLoading})`);
            ui.markAllReadBtn.disabled = markAllReadDisabled;
         }
    }
}

// --- Handle Dynamic TTS Click ---
function handleDynamicTTSClick(event) {
    const button = event.target.closest('.tts-listen-btn');
    if (button && button.dataset.textToSpeak) {
        // Find the parent chunk if it's on the whiteboard
        const chunkElement = button.closest('.whiteboard-chunk');
        speakText(button.dataset.textToSpeak, chunkElement);
    }
}

// --- Обработчики Действий ---

/**
 * Обрабатывает отправку сообщения из чата.
 */
async function handleSendMessage() {
    if (!state.currentUser || !state.currentProfile) {
        showError("Nelze odeslat zprávu, chybí data uživatele.", false);
        return;
    }

    // Recalculate 'canInteract' specific to sending a message
    const canSend = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening; // Allow sending even if AI is waiting
    const text = ui.chatInput?.value.trim();

    if (!canSend || !text) {
        console.warn(`Cannot send message: canSend=${canSend}, text=${!!text}`);
        if (!canSend) showToast('Počkejte prosím', 'AI přemýšlí nebo se načítá téma.', 'warning');
        return;
    }

    const inputBeforeSend = ui.chatInput?.value;
    if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }

    let wasWaiting = state.aiIsWaitingForAnswer; // Store if AI was waiting before this message

    try {
        await addChatMessage(text, 'user'); // Display and save user message
        initTooltips(); // Re-init for potential new elements
        state.geminiChatContext.push({ role: "user", parts: [{ text }] });

        // --- Start Thinking State ---
        state.geminiIsThinking = true;
        state.aiIsWaitingForAnswer = false; // Sending a message *always* resets the waiting flag
        addThinkingIndicator();
        manageButtonStates(); // Update UI immediately
        // --------------------------

        let promptForGemini;
        if (wasWaiting) {
           promptForGemini = `Student odpověděl na předchozí otázku: "${text}". Téma je "${state.currentTopic.name}". Vyhodnoť stručně odpověď a pokračuj v konverzaci POUZE textem do chatu. Můžeš položit další otázku nebo navrhnout pokračování výkladu.`;
        } else {
            promptForGemini = `Student píše do chatu: "${text}". Téma je "${state.currentTopic.name}". Odpověz relevantně v rámci tématu a konverzace. Použij POUZE text do chatu. Nepřidávej bloky [BOARD_MARKDOWN] ani [TTS_COMMENTARY].`;
        }

        const response = await sendToGemini(promptForGemini, true); // true indicates chat interaction

        if (response.success && response.data) {
            const { chatText, ttsCommentary } = response.data;
            if (chatText) {
                await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary);
                initTooltips(); // Re-init for potential new TTS buttons
                const lowerChatText = chatText.toLowerCase();
                // Set waiting state based on the NEW AI response
                state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
            } else {
                console.warn("Gemini chat response missing chatText.");
                await addChatMessage("(AI neodpovědělo textem)", 'gemini', false);
                state.aiIsWaitingForAnswer = false; // Ensure reset if no text
            }
        } else {
            console.error("Error response from Gemini:", response.error);
            await addChatMessage(`Promiňte, nastala chyba: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
            state.aiIsWaitingForAnswer = false; // Reset on error
            // Restore input if sending failed
            if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
        }
    } catch (error) {
        console.error("Error in handleSendMessage:", error);
        showError("Došlo k chybě při odesílání zprávy.", false);
        state.aiIsWaitingForAnswer = false; // Reset on error
        // Restore input on exception
        if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); }
    } finally {
        // --- End Thinking State ---
        removeThinkingIndicator(); // Remove indicator *after* response or error
        state.geminiIsThinking = false;
        setLoadingState('chat', false); // Ensure chat loading state is off
        manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning'); // Update overall UI state
        manageButtonStates(); // Explicitly call manageButtonStates at the very end
        // --------------------------
    }
}


/**
 * Запрашивает следующую часть объяснения у AI.
 */
async function requestContinue() {
    // Allow continue ONLY if topic exists, not busy, and NOT waiting for answer
    const canContinue = !!state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening && !state.aiIsWaitingForAnswer;
    if (!canContinue) {
        console.warn(`Cannot request continue: topic=${!!state.currentTopic}, thinking=${state.geminiIsThinking}, loading=${state.topicLoadInProgress}, listening=${state.isListening}, waiting=${state.aiIsWaitingForAnswer}`);
        showToast('Nelze pokračovat', 'AI přemýšlí, načítá téma nebo čeká na odpověď.', 'warning');
        return;
    }

    // --- Start Thinking State ---
    state.geminiIsThinking = true;
    state.aiIsWaitingForAnswer = false; // Continue overrides waiting
    addThinkingIndicator();
    manageButtonStates();
    // --------------------------

    const prompt = `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Naváž na předchozí část. Vygeneruj další logickou část výkladu.\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`;

    try {
        const response = await sendToGemini(prompt, false); // false = not a direct chat interaction

        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            let domChanged = false;

            // Handle board content
            if (boardMarkdown) {
                 const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
                 if (placeholder) placeholder.remove();
                 appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); // Pass TTS text for button
                 domChanged = true;
            }

            // Handle potential chat message accompanying the explanation
            if (chatText) {
                await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary); // Save and display chat
                domChanged = true;
                const lowerChatText = chatText.toLowerCase();
                // Set waiting state based on the NEW response
                state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
            } else if (ttsCommentary && !boardMarkdown) {
                // If only TTS commentary is provided (e.g., just a spoken summary)
                await addChatMessage("(Poslechněte si další část komentáře)", 'gemini', true, new Date(), ttsCommentary);
                domChanged = true;
                state.aiIsWaitingForAnswer = false; // No explicit question
            } else if (!boardMarkdown && !chatText && !ttsCommentary) {
                // Handle case where Gemini returns nothing useful
                console.warn("Gemini continue request returned empty content.");
                await addChatMessage("(AI neposkytlo další obsah, zkuste se zeptat jinak nebo pokračovat znovu.)", 'gemini', false);
                state.aiIsWaitingForAnswer = false;
            } else {
                 // If board/TTS but no chat, AI is not waiting for a chat response
                 state.aiIsWaitingForAnswer = false;
            }

            if (domChanged) initTooltips(); // Re-initialize tooltips if new buttons were added
        } else {
            console.error("Error response from Gemini:", response.error);
            await addChatMessage(`Promiňte, nastala chyba při pokračování: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
            state.aiIsWaitingForAnswer = false; // Reset on error
        }
    } catch (error) {
        console.error("Error in requestContinue:", error);
        showError("Došlo k chybě při žádosti o pokračování.", false);
        state.aiIsWaitingForAnswer = false; // Reset on error
    } finally {
        // --- End Thinking State ---
        removeThinkingIndicator(); // Ensure removal
        state.geminiIsThinking = false;
        setLoadingState('chat', false); // Ensure chat loading state is off
        manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning'); // Update overall UI state
        manageButtonStates(); // Update buttons based on final state
        // --------------------------
    }
}

/**
 * Запускает сессию обучения для текущей темы.
 */
async function startLearningSession() {
    if (!state.currentTopic) {
        console.error("Cannot start session: no topic.");
        manageUIState('error', {errorMessage: 'Chyba: Téma není definováno.'});
        return;
    }
    state.currentSessionId = generateSessionId(); // Generate unique ID for this session
    state.geminiChatContext = []; // Reset chat history for the new topic

    // --- Start Thinking State ---
    state.geminiIsThinking = true;
    state.aiIsWaitingForAnswer = false; // Start fresh, AI isn't waiting
    manageUIState('requestingExplanation'); // Update UI to show loading/requesting
    addThinkingIndicator();
    manageButtonStates(); // Update buttons for thinking state
    // --------------------------

    const prompt = `Jsi AI Tutor "Justax". Vysvětli ZÁKLADY tématu "${state.currentTopic.name}" pro studenta s úrovní "${state.currentProfile?.skill_level || 'neznámá'}". Rozděl vysvětlení na menší logické části. Pro PRVNÍ ČÁST:\nFormát odpovědi MUSÍ být:\n[BOARD_MARKDOWN]:\n\`\`\`markdown\n...\`\`\`\n[TTS_COMMENTARY]:\n...`;

    try {
        const response = await sendToGemini(prompt, false); // false = not direct chat

        // --- Prepare UI for Response ---
        // Remove placeholder/empty state from board *before* appending new content
        const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
        if (placeholder) {
            placeholder.remove();
            console.log("Initial whiteboard placeholder removed.");
        } else if (ui.whiteboardContent) {
            ui.whiteboardContent.innerHTML = ''; // Clear if no placeholder but still has content
        }
        // Clear initial empty chat message only if AI will provide content
        if (response.success && response.data && (response.data.boardMarkdown || response.data.chatText || response.data.ttsCommentary)) {
             const chatPlaceholder = ui.chatMessages?.querySelector('.empty-state');
             if (chatPlaceholder && chatPlaceholder.textContent.includes("Chat připraven")) {
                 chatPlaceholder.remove();
             }
        }
        // --- End UI Prep ---

        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            let domChanged = false;

            if (boardMarkdown) {
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); // Pass TTS text
                domChanged = true;
            }

            if (chatText) {
                await addChatMessage(chatText, 'gemini', true, new Date(), ttsCommentary); // Save and display
                domChanged = true;
                const lowerChatText = chatText.toLowerCase();
                // Set waiting state based on the NEW response
                state.aiIsWaitingForAnswer = chatText.endsWith('?') || lowerChatText.includes('otázka:') || lowerChatText.includes('zkuste') || lowerChatText.includes('jak byste');
            } else if (ttsCommentary && !boardMarkdown) {
                // Only TTS commentary provided
                await addChatMessage("(Poslechněte si úvodní komentář)", 'gemini', true, new Date(), ttsCommentary);
                domChanged = true;
                state.aiIsWaitingForAnswer = false; // No explicit question
            } else if (!boardMarkdown && !chatText && !ttsCommentary) {
                // Handle case where Gemini returns nothing useful
                console.warn("Gemini initial explanation returned empty content.");
                await addChatMessage("(AI neposkytlo úvodní obsah. Zkuste položit otázku.)", 'gemini', false);
                // Show empty state on board if nothing was added
                 if (!boardMarkdown && ui.whiteboardContent && !ui.whiteboardContent.hasChildNodes()) {
                    ui.whiteboardContent.innerHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule prázdná</h3><p>AI neposkytlo obsah.</p></div>`;
                }
                state.aiIsWaitingForAnswer = false;
            } else {
                // Board/TTS present, but no chat text -> AI is not waiting
                state.aiIsWaitingForAnswer = false;
            }

            if (domChanged) initTooltips(); // Re-init if TTS buttons added

        } else {
            // Handle Gemini error
            console.error("Error response from Gemini:", response.error);
            await addChatMessage(`Promiňte, nastala chyba při zahájení výkladu: ${response.error || 'Neznámá chyba AI.'}`, 'gemini', false);
            // Show error state on board
            if (ui.whiteboardContent) {
                ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba načítání</h3><p>Obsah pro tabuli nelze zobrazit.</p></div>`;
            }
            state.aiIsWaitingForAnswer = false; // Reset on error
            showError(`Chyba AI: ${response.error}`, false);
        }
    } catch(error) {
        // Handle fetch/logic error
        console.error("Error in startLearningSession:", error);
        showError("Došlo k chybě při zahájení výkladu.", false);
        // Show error state on board and chat
        if (ui.whiteboardContent) {
            ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba systému</h3><p>Nelze zahájit výuku.</p></div>`;
        }
        await addChatMessage(`Systémová chyba: ${error.message}`, 'gemini', false);
        state.aiIsWaitingForAnswer = false; // Reset on error
    } finally {
        // --- End Thinking State ---
        removeThinkingIndicator(); // Ensure removal
        state.geminiIsThinking = false;
        setLoadingState('chat', false); // Ensure chat loading state is off
        manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning'); // Update overall UI state
        manageButtonStates(); // Update buttons based on final state
        // --------------------------
    }
}


/**
 * Поток действий при нажатии "Označit jako dokončené".
 */
async function handleMarkTopicCompleteFlow() {
    const canComplete = !!state.currentTopic && !state.topicLoadInProgress && !state.isLoading.points && !state.geminiIsThinking;
    if (!canComplete) {
        console.warn(`Cannot mark complete: topic=${!!state.currentTopic}, loadingTopic=${state.topicLoadInProgress}, loadingPoints=${state.isLoading.points}, thinking=${state.geminiIsThinking}`);
        showToast("Nelze dokončit", "Počkejte na dokončení předchozí akce.", "warning");
        return;
    }
    if (!confirm(`Opravdu označit téma "${state.currentTopic.name}" jako dokončené? Získáte ${POINTS_TOPIC_COMPLETE} kreditů.`)) {
        return;
    }

    console.log(`[Flow] Marking topic ${state.currentTopic.activity_id} as complete.`);
    // --- Start Completion State ---
    state.topicLoadInProgress = true; // Use this to block further actions
    setLoadingState('points', true); // Indicate points are being processed
    // setLoadingState('currentTopic', true); // Optional: visual indication for topic change
    manageButtonStates(); // Disable buttons during completion
    // ---------------------------

    try {
        const successMark = await markTopicComplete(state.currentTopic.activity_id, state.currentUser.id);

        if (successMark) {
            console.log(`[Flow] Topic marked complete. Awarding points...`);
            const pointsAwarded = await awardPoints(state.currentUser.id, POINTS_TOPIC_COMPLETE);
            setLoadingState('points', false); // Points processing finished

            if (pointsAwarded) {
                showToast('+', `${POINTS_TOPIC_COMPLETE} kreditů získáno!`, 'success', 3000);
                 // Update profile points in UI immediately if possible
                if(state.currentProfile) {
                    state.currentProfile.points = (state.currentProfile.points || 0) + POINTS_TOPIC_COMPLETE;
                    updateUserInfoUI(); // Refresh sidebar display
                }
            } else {
                showToast('Varování', 'Téma dokončeno, ale body se nepodařilo připsat.', 'warning');
            }
            showToast(`Téma "${state.currentTopic.name}" dokončeno.`, "success");

            // Load next topic
            state.topicLoadInProgress = false; // Allow next topic load
            // setLoadingState('currentTopic', false); // loadNextTopicFlow handles its own loading state
            await loadNextTopicFlow(); // Trigger loading the next topic
            // manageButtonStates will be called by loadNextTopicFlow's final state

        } else {
            showToast("Chyba při označování tématu jako dokončeného.", "error");
            state.topicLoadInProgress = false; // Reset blocking flag on failure
            setLoadingState('points', false);
            // setLoadingState('currentTopic', false);
            manageButtonStates(); // Re-enable buttons based on current state
        }
    } catch (error) {
        console.error("Error in handleMarkTopicCompleteFlow:", error);
        showToast("Neočekávaná chyba při dokončování tématu.", "error");
        state.topicLoadInProgress = false; // Reset blocking flag on exception
        setLoadingState('points', false);
        // setLoadingState('currentTopic', false);
        manageButtonStates(); // Re-enable buttons based on current state
    }
    // No finally needed, state is managed within try/catch or by loadNextTopicFlow
}

/**
 * Поток действий для загрузки следующей темы.
 */
async function loadNextTopicFlow() {
    // Prevent concurrent loads
    if (!state.currentUser || state.topicLoadInProgress) {
        console.log(`[Flow] Load next topic skipped: User=${!!state.currentUser}, Loading=${state.topicLoadInProgress}`);
        return;
    }

    console.log("[Flow] Loading next topic flow STARTED.");
    state.topicLoadInProgress = true; // START Blocking flag
    setLoadingState('currentTopic', true); // Show visual loading indicator
    state.currentTopic = null; // Reset current topic state
    state.geminiChatContext = []; // Reset Gemini context
    state.aiIsWaitingForAnswer = false; // Reset waiting state

    // Clear UI related to the previous topic
    if (ui.currentTopicDisplay) {
        ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám další téma...</span>';
    }
    clearWhiteboard(false); // Clear board silently
    if (ui.chatMessages) {
        ui.chatMessages.innerHTML = ''; // Clear chat messages
    }
    manageUIState('loadingTopic'); // Set UI to loading state
    manageButtonStates(); // Update buttons for loading state

    try {
        console.log("[Flow] Calling loadNextUncompletedTopic from Supabase service...");
        const result = await loadNextUncompletedTopic(state.currentUser.id);
        console.log("[Flow] loadNextUncompletedTopic result:", result);

        if (result.success && result.topic) {
            // Topic found
            state.currentTopic = result.topic;
            if (ui.currentTopicDisplay) {
                ui.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(state.currentTopic.name)}</strong>`;
            }
            // setLoadingState('currentTopic', false); // Visual loading stops implicitly when session starts
            state.topicLoadInProgress = false; // END Blocking flag (success path)
            await startLearningSession(); // Automatically start the session for the new topic
            // startLearningSession handles its own thinking/loading states and button updates

        } else {
            // No topic found or error loading topic details
            state.currentTopic = null;
            const message = result.message || 'Není další téma nebo nastala chyba.';
            if (ui.currentTopicDisplay) {
                ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(${sanitizeHTML(message)})</span>`;
            }
            manageUIState(result.reason || 'error', { errorMessage: message }); // Show appropriate empty/error state
            setLoadingState('currentTopic', false); // Ensure visual loading stops
            state.topicLoadInProgress = false; // END Blocking flag (no topic/error path)
            manageButtonStates(); // Update buttons as no topic is active
        }
    } catch(error) {
        // Handle exceptions during the flow
        console.error("Error in loadNextTopicFlow execution:", error);
        state.currentTopic = null;
        if (ui.currentTopicDisplay) {
            ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(Chyba načítání)</span>`;
        }
        manageUIState('error', { errorMessage: `Chyba při načítání dalšího tématu: ${error.message}` });
        setLoadingState('currentTopic', false); // Ensure visual loading stops
        state.topicLoadInProgress = false; // END Blocking flag (exception path)
        manageButtonStates(); // Update buttons after exception
    }
    // No finally needed, state and buttons are managed within try/catch paths
    console.log("[Flow] Loading next topic flow FINISHED.");
}

// --- Запуск Приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);