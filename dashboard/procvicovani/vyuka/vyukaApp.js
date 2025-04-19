// vyukaApp.js - Основной файл приложения Vyuka
// Verze 3.9.0: Přidáno tlačítko Pokračuj a zásadně revidována správa stavů tlačítek.

// --- Импорт Модулей ---
import { MAX_GEMINI_HISTORY_TURNS, NOTIFICATION_FETCH_LIMIT, POINTS_TOPIC_COMPLETE } from './config.js';
import { state } from './state.js';
import { ui } from './ui.js'; // Nyní obsahuje continueBtn
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

/** Hlavní funkce inicializace aplikace. */
async function initializeApp() {
    console.log("🚀 [Init Vyuka v3.9.0] Starting App Initialization...");
    let initializationError = null;
    if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
    if (ui.mainContent) ui.mainContent.style.display = 'none';
    hideError();

    try {
        // 1. Inicializace Supabase
        const supabaseInitialized = initializeSupabase();
        if (!supabaseInitialized) throw new Error("Kritická chyba: Nepodařilo se připojit k databázi.");
        state.supabase = supabaseInitialized;
        console.log("[INIT] Supabase Initialized");

        // 2. Ověření sezení uživatele
        console.log("[INIT] Checking auth session");
        const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
        if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message.replace(/[.,!?;:]/g, '')}`);
        if (!session || !session.user) {
            console.log('[INIT] Not logged in. Redirecting...');
            window.location.href = '/auth/index.html';
            return;
        }
        state.currentUser = session.user;
        console.log(`[INIT] User authenticated (ID: ${state.currentUser.id}). Fetching profile...`);

        // 3. Načtení profilu uživatele
        setLoadingState('user', true);
        state.currentProfile = await fetchUserProfile(state.currentUser.id);
        setLoadingState('user', false);
        if (!state.currentProfile) {
            console.warn(`Profile not found for user ${state.currentUser.id}. Displaying error state.`);
            initializationError = new Error("Profil nenalezen nebo se nepodařilo načíst. Zkuste obnovit stránku.");
            // Try to initialize base UI even on profile error to show something
            try { initializeUI(); updateUserInfoUI(); }
            catch (uiError) { console.error("UI Init failed during profile error:", uiError); }
            manageUIState('error', { errorMessage: initializationError.message });
        } else {
            console.log("[INIT] Profile fetched successfully.");
        }

        // 4. Inicializace základního UI (až po načtení profilu, pokud možno)
        console.log("[INIT] Initializing base UI...");
        initializeUI();
        updateUserInfoUI(); // Update sidebar with profile info

        // 5. Načtení úvodních dat (pokud profil existuje a není chyba)
        if (state.currentProfile && !initializationError) {
            console.log("[INIT] Loading initial topic and notifications...");
            setLoadingState('currentTopic', true);
            setLoadingState('notifications', true);

            const loadNotificationsPromise = fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
                .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                .catch(err => {
                    console.error("Chyba při úvodním načítání notifikací:", err);
                    renderNotifications(0, []); // Show empty notifications on error
                    showToast('Chyba Notifikací', 'Nepodařilo se načíst signály.', 'error');
                })
                .finally(() => {
                    setLoadingState('notifications', false);
                    manageButtonStates(); // Update button states after notifications load
                });

            const loadTopicPromise = loadNextTopicFlow()
                .catch(err => {
                    console.error("Chyba při načítání úvodního tématu:", err);
                    manageUIState('error', { errorMessage: `Chyba načítání tématu: ${err.message.replace(/[.,!?;:]/g, '')}` });
                    state.topicLoadInProgress = false; // Ensure flag is reset
                    setLoadingState('currentTopic', false);
                });

            await Promise.all([loadNotificationsPromise, loadTopicPromise]);
            console.log("[INIT] Initial data loading complete or errors handled.");
        } else {
            // If profile failed or error occurred, reset loading flags
             setLoadingState('currentTopic', false);
             setLoadingState('notifications', false);
             manageButtonStates(); // Update button states even if data didn't load
        }

    } catch (error) {
        console.error("❌ [Init Vyuka v3.9.0] Critical initialization error:", error);
        initializationError = error;
        // Ensure basic UI is initialized to display the error
        if (!document.getElementById('main-mobile-menu-toggle')) {
            try { initializeUI(); }
            catch (uiError) { console.error("Failed to initialize UI during critical error handling:", uiError); }
        }
        manageUIState('error', { errorMessage: error.message.replace(/[.,!?;:]/g, '') });
        setLoadingState('all', false); // Stop all loading indicators
        showError(`Chyba inicializace: ${error.message.replace(/[.,!?;:]/g, '')}`, true); // Show global error
    } finally {
        console.log("[INIT] Finalizing initialization (finally block)...");
        if (ui.initialLoader) {
            ui.initialLoader.classList.add('hidden');
            setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500);
        }
        if (ui.mainContent) {
            ui.mainContent.style.display = 'flex'; // Ensure main content is flex container
            requestAnimationFrame(() => {
                if (ui.mainContent) ui.mainContent.classList.add('loaded');
                initScrollAnimations(); // Initialize scroll animations after content is visible
            });
        }
        manageButtonStates(); // Ensure buttons are in the correct state at the very end
        initTooltips(); // Initialize tooltips once at the end of loading
        console.log("✅ [Init Vyuka v3.9.0] App Initialization Finished (finally block).");
    }
}

/** Инициализация базового UI и обработчиков. */
function initializeUI() {
    console.log("[UI Init] Initializing UI elements and handlers...");
    try {
        updateTheme(); // Set initial theme
        setupEventListeners(); // Attach event listeners
        // Default active tab
        if (ui.chatTabButton) ui.chatTabButton.classList.add('active');
        if (ui.chatTabContent) ui.chatTabContent.classList.add('active');
        // Speech services
        initializeSpeechRecognition();
        loadVoices();
        // Visual enhancements
        initMouseFollower();
        initHeaderScrollDetection();
        updateCopyrightYear();
        updateOnlineStatus(); // Initial check
        // Set initial UI state (placeholders etc.)
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
        if (element) {
            element.addEventListener(event, handler);
            listenersAttached++;
            // console.log(`[SETUP] Listener '${event}' added to '${elementName}'`);
        } else {
            console.warn(`[SETUP] Element '${elementName}' not found. Listener not attached.`);
        }
    }

    // Sidebar & Menu
    addListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
    addListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
    addListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');

    // Chat Input & Send
    addListener(ui.chatInput, 'input', () => autoResizeTextarea(ui.chatInput), 'chatInput (input)');
    addListener(ui.sendButton, 'click', handleSendMessage, 'sendButton');
    addListener(ui.chatInput, 'keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }, 'chatInput (keypress)');

    // Chat & Board Controls
    addListener(ui.clearChatBtn, 'click', () => confirmClearChat(), 'clearChatBtn');
    addListener(ui.saveChatBtn, 'click', saveChatToPDF, 'saveChatBtn');
    addListener(ui.clearBoardBtn, 'click', () => {
        clearWhiteboard(false); // false = don't show internal toast
        showToast('Vymazáno', "Tabule byla vymazána.", "info"); // Show app-level toast
        manageButtonStates(); // Update state after clearing
    }, 'clearBoardBtn');

    // --- PŘIDÁNO TOTO ---
    addListener(ui.continueBtn, 'click', requestContinue, 'continueBtn');
    // --- KONEC PŘIDÁNÍ ---

    // Speech Controls
    addListener(ui.micBtn, 'click', handleMicClick, 'micBtn');
    addListener(ui.stopSpeechBtn, 'click', stopSpeech, 'stopSpeechBtn');

    // Dynamic TTS Click Handlers (Event Delegation)
    addListener(ui.chatMessages, 'click', handleDynamicTTSClick, 'chatMessages (TTS Delegation)');
    addListener(ui.whiteboardContent, 'click', handleDynamicTTSClick, 'whiteboardContent (TTS Delegation)');

    // Theme & Window Events
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
    window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) { closeMenu(); } });
    listenersAttached++;
    window.addEventListener('online', updateOnlineStatus); listenersAttached++;
    window.addEventListener('offline', updateOnlineStatus); listenersAttached++;

    // Notification Handlers
    addListener(ui.notificationBell, 'click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell');
    addListener(ui.markAllReadBtn, 'click', async () => {
        if(ui.markAllReadBtn.disabled) return;
        setLoadingState('notifications', true); // Indicate loading
        const success = await markAllNotificationsRead(state.currentUser.id);
        if (success) {
             renderNotifications(0, []); // Update UI to show no unread
             showToast('Hotovo', 'Všechna oznámení označena jako přečtená.', 'success');
        } else {
             showToast('Chyba', 'Nepodařilo se označit oznámení.', 'error');
        }
        setLoadingState('notifications', false); // Stop loading
        manageButtonStates(); // Update button state
    }, 'markAllReadBtn');
    addListener(ui.notificationsList, 'click', async (event) => {
         const item = event.target.closest('.notification-item');
         if (item) {
             const notificationId = item.dataset.id;
             const link = item.dataset.link;
             const isRead = item.classList.contains('is-read');

             if (!isRead && notificationId) {
                 // setLoadingState('notifications', true); // Optional: show loading for single mark
                 const success = await markNotificationRead(notificationId, state.currentUser.id);
                 // setLoadingState('notifications', false);
                 if (success) {
                     item.classList.add('is-read');
                     item.querySelector('.unread-dot')?.remove();
                     // Update the main badge count
                     const currentCountText = ui.notificationCount.textContent.replace('+', '');
                     const currentCount = parseInt(currentCountText) || 0;
                     const newCount = Math.max(0, currentCount - 1);
                     ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                     ui.notificationCount.classList.toggle('visible', newCount > 0);
                     manageButtonStates(); // Update the mark all read button state
                 }
             }
             // Navigate if link exists
             if (link) window.location.href = link;
             // Optionally close dropdown after click
             // ui.notificationsDropdown?.classList.remove('active');
         }
     }, 'notificationsList (Delegation)');
    // Close dropdown on outside click
    document.addEventListener('click', (event) => {
        if (ui.notificationsDropdown?.classList.contains('active') &&
            !ui.notificationsDropdown.contains(event.target) &&
            !ui.notificationBell?.contains(event.target)) {
            ui.notificationsDropdown.classList.remove('active');
        }
    });
    listenersAttached++;

    console.log(`[SETUP] Event listeners setup complete. Total attached approx: ${listenersAttached}`);
}

// --- Обновление UI ---

/** Обновляет информацию о пользователе в UI (сайдбар). */
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
        // Validate URL - prevent relative paths from breaking if not intended
        if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('//') && !avatarUrl.startsWith('data:') && !avatarUrl.startsWith('assets/')) {
            finalUrl = null; // Consider it invalid if it's not a full URL, data URL, or expected asset path
            console.warn("Invalid avatar URL format detected:", avatarUrl);
        } else if (avatarUrl) {
             // Sanitize potentially valid URLs (full or asset paths)
             finalUrl = sanitizeHTML(avatarUrl);
             // Add cache buster only for external URLs
             if (finalUrl.startsWith('http')) {
                 finalUrl += `?t=${new Date().getTime()}`;
             }
        }

        ui.sidebarAvatar.innerHTML = finalUrl ? `<img src="${finalUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);

        // Add error handling for the loaded image
        const sidebarImg = ui.sidebarAvatar.querySelector('img');
        if (sidebarImg) {
            sidebarImg.onerror = function() {
                console.warn(`Failed to load avatar image: ${this.src}. Falling back to initials.`);
                ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); // Fallback to initials
            };
        }
    } else {
        ui.sidebarName.textContent = 'Nepřihlášen';
        ui.sidebarAvatar.textContent = '?';
    }
}

/** Отображает уведомления в выпадающем списке. */
 function renderNotifications(count, notifications) {
    console.log("[Render Notifications] Count:", count, "Notifications:", notifications ? notifications.length : 0);
    if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
        console.error("[Render Notifications] Missing UI elements for notifications.");
        return;
    }

    ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
    ui.notificationCount.classList.toggle('visible', count > 0);

    if (notifications && notifications.length > 0) {
        ui.notificationsList.innerHTML = notifications.map(n => {
            const visual = activityVisuals[(n.type || 'default').toLowerCase()] || activityVisuals.default;
            const isReadClass = n.is_read ? 'is-read' : '';
            const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : '';
            const title = (n.title || 'Nové oznámení').replace(/[.,!?;:]/g, ''); // Basic sanitization
            const message = (n.message || '').replace(/[.,!?;:]/g, ''); // Basic sanitization
            const timeAgo = formatRelativeTime(n.created_at);
            return `
                <div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
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
        ui.notificationsList.innerHTML = '';
        ui.noNotificationsMsg.style.display = 'block';
        ui.notificationsList.style.display = 'none';
         ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.remove('has-content');
    }

    // Ensure the "Mark All Read" button state is correct based on the actual count
    const currentUnreadCount = parseInt(ui.notificationCount.textContent.replace('+', '') || '0');
    ui.markAllReadBtn.disabled = currentUnreadCount === 0 || state.isLoading.notifications;

    console.log("[Render Notifications] Finished rendering.");
 }

/** Управляет общим состоянием интерфейса (заглушки, видимость). */
function manageUIState(mode, options = {}) {
    const isLearningActive = state.currentTopic && ['learning', 'chatting', 'requestingExplanation', 'waitingForAction', 'aiProposingCompletion'].includes(mode);
    const isEmptyState = ['noPlan', 'planComplete', 'error', 'loggedOut', 'initial', 'loadingTopic'].includes(mode);

    // --- Zobrazení hlavního rozhraní vs. prázdných stavů ---
    if (ui.learningInterface) {
        ui.learningInterface.style.display = !isEmptyState ? 'flex' : 'none';
    }

    // --- Správa obsahu Chatu ---
    if (ui.chatMessages) {
        const hasMessages = ui.chatMessages.querySelector('.chat-message');
        if (isEmptyState) {
             ui.chatMessages.innerHTML = ''; // Clear previous messages
             let chatHTML = '';
             switch (mode) {
                 case 'loggedOut': chatHTML = `<div class='empty-state'><i class='fas fa-sign-in-alt'></i><h3>NEPŘIHLÁŠEN</h3></div>`; break;
                 case 'noPlan': chatHTML = `<div class='empty-state'><i class='fas fa-calendar-times'></i><h3>ŽÁDNÝ PLÁN</h3></div>`; break;
                 case 'planComplete': chatHTML = `<div class='empty-state'><i class='fas fa-check-circle'></i><h3>PLÁN HOTOV</h3></div>`; break;
                 case 'error':
                     chatHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>CHYBA SYSTÉMU</h3><p>${sanitizeHTML(options.errorMessage || 'Nastala neočekávaná chyba.').replace(/[.,!?;:]/g, '')}</p></div>`;
                     // Optionally display the global error banner too if not already visible
                     if (options.errorMessage && !document.getElementById('global-error')?.offsetParent) {
                         showError(options.errorMessage, true);
                     }
                     break;
                 case 'initial': chatHTML = '<div class="empty-state"><i class="fas fa-cog fa-spin"></i><h3>Inicializace...</h3></div>'; break;
                 case 'loadingTopic': chatHTML = '<div class="empty-state"><i class="fas fa-book-open fa-spin"></i><p>Načítám téma...</p></div>'; break;
             }
             if (chatHTML) ui.chatMessages.innerHTML = chatHTML;
        } else if (isLearningActive && !hasMessages && ui.chatMessages.querySelector('.empty-state')) {
             // Remove placeholder only if learning is active and no real messages exist
             ui.chatMessages.innerHTML = '';
             console.log("[UI State] Removed chat placeholder as learning started.");
        }
        console.log(`[UI State] Chat set to state: ${mode}`);
    }

    // --- Správa obsahu Tabule ---
    if (ui.whiteboardContent) {
        const existingPlaceholder = ui.whiteboardContent.querySelector('.initial-load-placeholder, .empty-state');
        const hasChunks = ui.whiteboardContent.querySelector('.whiteboard-chunk');

        if (isEmptyState) {
            ui.whiteboardContent.innerHTML = ''; // Clear previous content
            let boardHTML = '';
            switch (mode) {
                case 'loadingTopic': boardHTML = '<div class="empty-state initial-load-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Načítám první lekci...</p></div>'; break;
                case 'error': boardHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba Tabule</h3><p>${sanitizeHTML(options.errorMessage || 'Obsah nelze zobrazit').replace(/[.,!?;:]/g, '')}</p></div>`; break;
                case 'noPlan':
                case 'planComplete':
                case 'loggedOut': boardHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule</h3><p>Vyberte téma pro zahájení výuky.</p></div>`; break;
                case 'initial': boardHTML = `<div class='empty-state'><i class='fas fa-spinner fa-spin'></i><h3>Inicializace Tabule...</h3></div>`; break;
            }
            if (boardHTML) ui.whiteboardContent.innerHTML = boardHTML;
        } else if (isLearningActive && existingPlaceholder && !hasChunks) {
            // If learning started but no chunks yet, show a 'ready' state
            if (!existingPlaceholder.textContent.includes("připravena")) {
                ui.whiteboardContent.innerHTML = `<div class='empty-state'><i class='fas fa-chalkboard'></i><h3>Tabule připravena</h3></div>`;
            }
        } else if (isLearningActive && existingPlaceholder && hasChunks) {
             // If learning and content has arrived, remove the placeholder
             existingPlaceholder.remove();
             console.log("[UI State] Removed whiteboard placeholder as content received.");
        }
         console.log(`[UI State] Whiteboard set to state: ${mode}`);
    }

    manageButtonStates(); // Вызываем в конце для обновления кнопок
}

/**
 * Komplexní funkce pro správu stavu VŠECH interaktivních tlačítek.
 * ZAJIŠŤUJE SPRÁVNOU (DE)AKTIVACI A VIDITELNOST.
 */
function manageButtonStates() {
    // --- 1. Získání aktuálního stavu aplikace ---
    const hasTopic = !!state.currentTopic;
    const isThinking = state.geminiIsThinking;
    const isLoadingTopic = state.topicLoadInProgress;
    const isWaitingForAction = state.aiIsWaitingForAnswer; // AI čeká na reakci/potvrzení
    const isProposingCompletion = state.aiProposedCompletion; // AI navrhlo ukončení
    const isListening = state.isListening; // Mikrofon poslouchá
    const isSpeaking = state.speechSynthesisSupported && window.speechSynthesis.speaking; // AI mluví (TTS)
    const isLoadingPoints = state.isLoading.points; // Načítání bodů (během dokončování)
    const isLoadingNotifications = state.isLoading.notifications; // Načítání notifikací
    const chatInputHasText = ui.chatInput?.value.trim().length > 0;
    const chatIsEmpty = !ui.chatMessages?.hasChildNodes() || !!ui.chatMessages?.querySelector('.empty-state');
    const boardIsEmpty = !ui.whiteboardContent?.hasChildNodes() || !!ui.whiteboardContent?.querySelector('.empty-state');
    const unreadNotifCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');

    // --- 2. Odvozené stavy pro zjednodušení logiky ---
    const isBusyProcessing = isThinking || isLoadingTopic || isLoadingPoints; // AI/Systém něco zpracovává
    const isBusyUI = isListening || isSpeaking; // UI je zaneprázdněno (mikrofon/řeč)
    const canInteractGenerally = hasTopic && !isBusyProcessing && !isBusyUI; // Může uživatel obecně interagovat?
    const canSendChatMessage = canInteractGenerally && chatInputHasText; // Může odeslat zprávu?
    const canUseMic = hasTopic && !isBusyProcessing && !isSpeaking && state.speechRecognitionSupported; // Může použít mikrofon? (TTS má přednost)
    const canContinueTopic = hasTopic && !isBusyProcessing && !isBusyUI && !isWaitingForAction && !isProposingCompletion; // Může explicitně požádat o pokračování?
    const canClearChat = !isBusyProcessing && !isBusyUI && !chatIsEmpty;
    const canSaveChat = !isBusyProcessing && !isBusyUI && !chatIsEmpty;
    const canClearBoard = !isBusyProcessing && !isBusyUI && !boardIsEmpty;
    const canStopSpeech = isSpeaking; // Může zastavit TTS?
    const canMarkAllRead = unreadNotifCount > 0 && !isLoadingNotifications;

    // --- 3. Pomocná funkce pro nastavení stavu tlačítka ---
    const setButtonState = (button, isDisabled, isHidden = false) => {
        if (button) {
            // Změníme disabled pouze pokud se stav liší
            if (button.disabled !== isDisabled) {
                button.disabled = isDisabled;
            }
            // Změníme display pouze pokud se stav liší
            const currentDisplay = button.style.display || window.getComputedStyle(button).display;
            const targetDisplay = isHidden ? 'none' : (button.tagName === 'TEXTAREA' || button.tagName === 'INPUT' ? 'block' : 'inline-flex'); // default display
            if (currentDisplay !== targetDisplay) {
                button.style.display = targetDisplay;
            }
        }
    };

    // --- 4. Nastavení stavu jednotlivých tlačítek ---

    // Odeslat zprávu
    setButtonState(ui.sendButton, !canSendChatMessage);
    if (ui.sendButton) {
         // Dynamicky měníme ikonu tlačítka Odeslat
         ui.sendButton.innerHTML = isThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
    }

    // Pole pro zadání textu
    setButtonState(ui.chatInput, !canInteractGenerally);
    if (ui.chatInput) {
        let placeholder = "Zadej text..."; // Standardní
        if (isListening) placeholder = "Poslouchám...";
        else if (!canInteractGenerally) { // Pokud je interakce obecně blokována
             if (isThinking) placeholder = "AI přemýšlí...";
             else if (isLoadingTopic) placeholder = "Načítám téma...";
             else if (isSpeaking) placeholder = "AI mluví...";
             else if (isLoadingPoints) placeholder = "Zpracovávám dokončení...";
             else placeholder = "Akce nedostupná"; // Obecná blokace
        } else if (isProposingCompletion) {
            placeholder = "AI navrhuje ukončení. Odpověz Ano/Ne.";
        } else if (isWaitingForAction) {
            placeholder = "Reaguj na otázku nebo akci na tabuli.";
        }
        ui.chatInput.placeholder = placeholder;
    }

    // Pokračovat ve výkladu
    setButtonState(ui.continueBtn, !canContinueTopic, !canContinueTopic); // Skrýt, pokud není aktivní

    // Zastavit řeč (TTS)
    setButtonState(ui.stopSpeechBtn, !canStopSpeech);

    // Vymazat tabuli
    setButtonState(ui.clearBoardBtn, !canClearBoard);

    // Mikrofon (STT)
    setButtonState(ui.micBtn, !canUseMic);
    if (ui.micBtn) {
        ui.micBtn.classList.toggle('listening', isListening);
        let micTitle = "Hlasový vstup";
        if (!state.speechRecognitionSupported) micTitle = "Rozpoznávání řeči není podporováno";
        else if (isListening) micTitle = "Zastavit hlasový vstup";
        else if (!canUseMic) micTitle = "Hlasový vstup nedostupný (systém zaneprázdněn)";
        else micTitle = "Zahájit hlasový vstup";
        ui.micBtn.title = micTitle; // Aktualizujeme tooltip
    }

    // Vymazat chat
    setButtonState(ui.clearChatBtn, !canClearChat);

    // Uložit chat
    setButtonState(ui.saveChatBtn, !canSaveChat);

    // Označit všechna oznámení jako přečtená
    setButtonState(ui.markAllReadBtn, !canMarkAllRead);

    // console.log(`[Button States] Send: ${!canSendChatMessage}, Input: ${!canInteractGenerally}, Continue: ${!canContinueTopic}, Mic: ${!canUseMic}, StopTTS: ${!canStopSpeech}, ClearBoard: ${!canClearBoard}, ClearChat: ${!canClearChat}, SaveChat: ${!canSaveChat}, MarkAllRead: ${!canMarkAllRead}`);
}


/**
 * Обработчик клика для динамических TTS кнопок (делегирование).
 */
function handleDynamicTTSClick(event) {
    const button = event.target.closest('.tts-listen-btn');
    if (button && button.dataset.textToSpeak && !button.disabled) {
        const textToSpeak = button.dataset.textToSpeak;
        // Najdeme nejbližší rodičovský prvek, který reprezentuje blok obsahu
        const chunkElement = button.closest('.whiteboard-chunk, .chat-message');
        speakText(textToSpeak, chunkElement);
    }
}

// --- Обработчики Действий ---

/**
 * Обрабатывает отправку сообщения из чата.
 * Verze 3.9.0: Zachovává blokaci ručního ukončení a logiku potvrzení/odmítnutí.
 */
async function handleSendMessage() {
    const text = ui.chatInput?.value.trim();
    if (!text) return; // Neodesílat prázdné zprávy

    const affirmativeResponses = ['ano', 'jo', 'ok', 'dobře', 'dobre', 'souhlasim', 'potvrdit', 'uzavrit', 'dokoncit', 'jiste', 'jistě'];
    const negativeResponses = ['ne', 'nechci', 'stop', 'nemyslim', 'nesouhlasim', 'zrusit', 'neukoncovat'];
    const forceCompleteKeywords = ['ukonci', 'dokonci', 'zavri', 'konec', 'skonci', 'hotovo', 'заверши', 'укончи', 'конец', 'стоп'];

    // --- Blokace ručního ukončení (zachováno) ---
    if (!state.aiProposedCompletion && text) {
        const lowerText = text.toLowerCase();
        if (forceCompleteKeywords.some(keyword => lowerText.includes(keyword))) {
            console.warn("[ACTION] User attempted to force topic completion");
            if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }
            state.geminiIsThinking = true; addThinkingIndicator(); manageButtonStates();
            let domChanged = true;
            try {
                const prompt = `Student se pokusil ukončit téma "${state.currentTopic?.name || 'toto'}". Vysvětli na TABULI stručně, že téma ukončuje AI až po důkladném probrání a ověření znalostí, a že student má pokračovat v učení nebo požádat o další krok. Do CHATU napiš pouze "Info".`;
                const response = await sendToGemini(prompt, true);
                if (response.success && response.data) {
                    if (response.data.boardMarkdown) { appendToWhiteboard(response.data.boardMarkdown, response.data.ttsCommentary); domChanged = true; }
                    if (response.data.chatText) { await addChatMessage(response.data.chatText, 'gemini', false, new Date(), response.data.ttsCommentary); domChanged = true; }
                    else await addChatMessage("Info", 'gemini', false);
                } else { await addChatMessage("Chyba", 'gemini', false); domChanged = true; }
            } catch (e) { await addChatMessage("Chyba", 'gemini', false); domChanged = true; }
            finally { removeThinkingIndicator(); state.geminiIsThinking = false; state.aiIsWaitingForAnswer = true; manageButtonStates(); if (domChanged) initTooltips(); }
            return;
        }
    }
    // --- Konec blokace ---

    // --- Zpracování potvrzení/odmítnutí AI návrhu na ukončení (zachováno) ---
    if (state.aiProposedCompletion && text) {
        const lowerText = text.toLowerCase().replace(/[.,!?]/g, '');
        if (affirmativeResponses.includes(lowerText)) {
            console.log("[AI Action] User confirmed topic completion via chat");
            const confirmationText = ui.chatInput?.value;
            if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }
            await addChatMessage(confirmationText, 'user');
            state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false; manageButtonStates();
            await completeTopicFlow();
            return;
        } else if (negativeResponses.includes(lowerText)) {
            console.log("[AI Action] User rejected topic completion via chat");
            const rejectionText = ui.chatInput?.value;
            if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }
            await addChatMessage(rejectionText, 'user');
            state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
            state.geminiIsThinking = true; addThinkingIndicator(); manageButtonStates();
            let domChanged = true;
            try {
                const prompt = `Student odmítl ukončení tématu "${state.currentTopic?.name || 'toto'}". Pokračuj ve výkladu další logickou částí nebo zadej další úkol na TABULI. Do CHATU napiš pouze "Pokracujeme".`;
                const response = await sendToGemini(prompt, true);
                 if (response.success && response.data) {
                     if (response.data.boardMarkdown) { appendToWhiteboard(response.data.boardMarkdown, response.data.ttsCommentary); domChanged = true; }
                     if (response.data.chatText) { await addChatMessage(response.data.chatText, 'gemini', false, new Date(), response.data.ttsCommentary); domChanged = true; }
                     else await addChatMessage("Pokracujeme", 'gemini', false);
                 } else { await addChatMessage("Chyba", 'gemini', false); domChanged = true; }
            } catch(e) { await addChatMessage("Chyba", 'gemini', false); domChanged = true; }
            finally { removeThinkingIndicator(); state.geminiIsThinking = false; state.aiIsWaitingForAnswer = true; manageUIState('waitingForAction'); manageButtonStates(); if (domChanged) initTooltips(); }
            return;
        }
        // Pokud odpověď není ani ano ani ne, budeme ji brát jako normální zprávu níže
        state.aiProposedCompletion = false; // Resetujeme návrh, pokud uživatel napsal něco jiného
    }
    // --- Konec zpracování potvrzení/odmítnutí ---


    // --- Standardní odeslání zprávy ---
    if (!state.currentUser || !state.currentProfile) { showError("Nelze odeslat zprávu, chybí data uživatele.", false); return; }
    console.log("[ACTION] handleSendMessage triggered");

    const canSendNow = state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening && !state.isSpeaking;
    console.log(`[ACTION] handleSendMessage Check canSend=${canSendNow}`);

    if (!canSendNow) {
        if (state.geminiIsThinking) showToast('Počkejte prosím', 'AI zpracovává předchozí požadavek.', 'warning');
        else if(state.isSpeaking) showToast('Počkejte prosím', 'AI právě mluví.', 'warning');
        else showToast('Počkejte prosím', 'Systém je zaneprázdněn.', 'warning');
        return;
    }

    const inputBeforeSend = ui.chatInput?.value; // Uložíme pro případ chyby
    if (ui.chatInput) { ui.chatInput.value = ''; autoResizeTextarea(ui.chatInput); }

    let domChangedInTry = false;

    try {
        // 1. Zobrazit zprávu uživatele
        await addChatMessage(text, 'user'); domChangedInTry = true;
        state.geminiChatContext.push({ role: "user", parts: [{ text }] });

        // 2. Nastavit stav "AI přemýšlí"
        console.log("[ACTION] handleSendMessage Setting isThinking=true, aiWaiting=false, proposing=false");
        state.geminiIsThinking = true; state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
        addThinkingIndicator(); domChangedInTry = true;
        manageButtonStates();

        // 3. Odeslat požadavek na Gemini
        console.log("[ACTION] handleSendMessage Calling sendToGemini (isChatInteraction=true)");
        const response = await sendToGemini(text, true);
        console.log("[ACTION] handleSendMessage Gemini response received:", response);

        // 4. Zpracovat odpověď Gemini
        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            const completionMarker = "[PROPOSE_COMPLETION]";
            let finalChatText = chatText;
            let proposedCompletion = false;

             // Detekce návrhu na ukončení
             if (chatText && chatText.includes(completionMarker)) {
                 finalChatText = chatText.replace(completionMarker, "").trim();
                 proposedCompletion = true;
                 console.log("[AI Action] AI proposed topic completion in response.");
             }

            // Zobrazit obsah na tabuli
            if (boardMarkdown) {
                const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
                if (placeholder) placeholder.remove(); // Odebrat placeholder, pokud existuje
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); domChangedInTry = true;
            } else {
                 console.warn("Gemini response has no board content for chat interaction.");
                 // Pokud není obsah na tabuli, ale je TTS, přehrajeme TTS a zobrazíme v chatu
                 if(ttsCommentary && !finalChatText) {
                     await addChatMessage(ttsCommentary, 'gemini', true, new Date(), ttsCommentary); domChangedInTry = true;
                 }
            }
            // Zobrazit text v chatu
            if (finalChatText) { await addChatMessage(finalChatText, 'gemini', false, new Date(), ttsCommentary); domChangedInTry = true; }

            // Přehrát TTS komentář, pokud existuje A byl obsah na tabuli
            if (ttsCommentary && boardMarkdown) { speakText(ttsCommentary, ui.whiteboardContent?.lastElementChild); }

            // Aktualizovat stav AI podle odpovědi
            state.aiProposedCompletion = proposedCompletion;
            if (proposedCompletion) {
                 showToast("Návrh AI", "AI navrhuje ukončení tématu. Odpovězte Ano/Ne.", "info", 6000);
                 state.aiIsWaitingForAnswer = true; // Čekáme na Ano/Ne
                 console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true (waiting for completion confirmation).");
            } else if (boardMarkdown) {
                 // Pokud AI něco dala na tabuli, očekáváme reakci nebo další krok
                 state.aiIsWaitingForAnswer = true;
                 console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true (waiting for user action after board update).");
            } else {
                 // Pokud AI nedala nic na tabuli ani nenavrhla ukončení, nečekáme aktivně
                 state.aiIsWaitingForAnswer = false;
                  console.log("[STATE CHANGE] aiIsWaitingForAnswer set to false (no board content, no proposal).");
            }

            if (domChangedInTry) { initTooltips(); } // Aktualizovat tooltips, pokud se DOM změnil

        } else {
            // Chyba při komunikaci s Gemini
            console.error("Error response from Gemini:", response.error);
            const errorMsg = (response.error || "Neznámá chyba AI").replace(/[.,!?;:]/g, '');
            await addChatMessage(`Chyba: ${errorMsg}`, 'gemini', false); domChangedInTry = true;
            state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
            console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (Gemini error).`);
            if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); } // Vrátit text
             if (domChangedInTry) initTooltips();
        }
    } catch (error) {
        // Obecná chyba v bloku try
        console.error("Error in handleSendMessage catch block:", error);
        const errorMsg = `Chyba odesílání zprávy: ${error.message}`.replace(/[.,!?;:]/g, '');
        showError(errorMsg, false);
        await addChatMessage("Chyba systému.", 'gemini', false); domChangedInTry = true;
        state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (exception).`);
        if (ui.chatInput) { ui.chatInput.value = inputBeforeSend; autoResizeTextarea(ui.chatInput); } // Vrátit text
        if (domChangedInTry) initTooltips();
    } finally {
        console.log("[ACTION] handleSendMessage Entering finally block.");
        const indicatorRemoved = removeThinkingIndicator();
        domChangedInTry = domChangedInTry || indicatorRemoved; // Zaznamenáme, pokud se odstranil indikátor
        console.log("[ACTION] handleSendMessage Setting isThinking=false in finally.");
        state.geminiIsThinking = false;
        setLoadingState('chat', false); // Ukončit indikátor načítání chatu

        // Určení správného stavu UI po dokončení akce
        let nextUiState = 'learning'; // Default
        if(state.aiProposedCompletion) nextUiState = 'aiProposingCompletion';
        else if (state.aiIsWaitingForAnswer) nextUiState = 'waitingForAction';
        manageUIState(nextUiState); // Nastavit správný stav (např. placeholder)

        manageButtonStates(); // VELMI DŮLEŽITÉ: Aktualizovat stav tlačítek na konci
        if (domChangedInTry) initTooltips(); // Aktualizovat tooltips, pokud došlo ke změně DOM
        console.log("[ACTION] handleSendMessage Exiting finally block.");
    }
}


/**
 * Zpracuje požadavek na pokračování ve výkladu (kliknutí na "Pokračuj").
 */
async function requestContinue() {
    console.log("[ACTION] requestContinue triggered");

    // Zkontrolujeme, zda lze pokračovat (stejná logika jako v manageButtonStates pro aktivaci tlačítka)
    const canContinueNow = state.currentTopic && !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening && !state.isSpeaking && !state.aiIsWaitingForAnswer && !state.aiProposedCompletion;

    if (!canContinueNow) {
        console.warn(`Cannot request continue: thinking=${state.geminiIsThinking}, loadingTopic=${state.topicLoadInProgress}, listening=${state.isListening}, speaking=${state.isSpeaking}, waiting=${state.aiIsWaitingForAnswer}, proposing=${state.aiProposedCompletion}`);
        let reason = 'Systém je zaneprázdněn';
        if(state.aiIsWaitingForAnswer) reason = 'AI čeká na vaši akci/odpověď.';
        if(state.aiProposedCompletion) reason = 'AI navrhlo ukončení tématu.';
        if(state.isSpeaking) reason = 'AI právě mluví.';
        showToast('Nelze pokračovat', reason, 'warning');
        return;
    }

    // --- Stejná logika jako v handleSendMessage pro odeslání ---
    let domChangedInTry = false;
    try {
        // 1. Nastavit stav "AI přemýšlí"
        console.log("[ACTION] requestContinue: Setting isThinking=true, aiWaiting=false, proposing=false");
        state.geminiIsThinking = true; state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
        addThinkingIndicator(); domChangedInTry = true;
        manageButtonStates();

        // 2. Připravit prompt pro Gemini
        const prompt = `Pokračuj ve vysvětlování tématu "${state.currentTopic.name}" na úrovni Přijímaček. Naváž na PŘEDCHOZÍ OBSAH TABULE. Připrav další logickou část výkladu nebo komplexnější příklad na TABULI. Do CHATU napiš pouze "Na tabuli".`;

        // 3. Odeslat požadavek na Gemini (isChatInteraction = false, protože to není přímá reakce na text uživatele)
        console.log("[ACTION] requestContinue: Calling sendToGemini (isChatInteraction=false)");
        const response = await sendToGemini(prompt, false);
        console.log("[ACTION] requestContinue: Gemini response received:", response);

        // 4. Zpracovat odpověď Gemini
        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            const completionMarker = "[PROPOSE_COMPLETION]";
            let finalChatText = chatText;
            let proposedCompletion = false;

             if (chatText && chatText.includes(completionMarker)) {
                 finalChatText = chatText.replace(completionMarker, "").trim();
                 proposedCompletion = true;
                 console.log("[AI Action] AI proposed topic completion in response.");
             }

            // Zobrazit obsah na tabuli
            if (boardMarkdown) {
                const placeholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
                if (placeholder) placeholder.remove();
                appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); domChangedInTry = true;
            } else {
                 console.error("Gemini did not return board content for 'continue' request.");
                 await addChatMessage("Chyba: AI neposkytlo žádný obsah pro tabuli.", 'gemini', false); domChangedInTry = true;
            }
            // Zobrazit text v chatu (očekáváme "Na tabuli" nebo návrh na ukončení)
            if (finalChatText) { await addChatMessage(finalChatText, 'gemini', false, new Date(), ttsCommentary); domChangedInTry = true; }
            else if (boardMarkdown) { await addChatMessage("Na tabuli", 'gemini', false); domChangedInTry = true; } // Fallback, pokud AI nedodrží instrukci

            // Přehrát TTS komentář
            if (ttsCommentary && boardMarkdown) { speakText(ttsCommentary, ui.whiteboardContent?.lastElementChild); }

            // Aktualizovat stav AI
            state.aiProposedCompletion = proposedCompletion;
            if (proposedCompletion) {
                 showToast("Návrh AI", "AI navrhuje ukončení tématu. Odpovězte Ano/Ne.", "info", 6000);
                 state.aiIsWaitingForAnswer = true;
                 console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true (waiting for completion confirmation).");
            } else if (boardMarkdown) {
                  // Pokud AI dala něco na tabuli, čekáme na akci
                  state.aiIsWaitingForAnswer = true;
                  console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true (waiting for user action after continue).");
            } else {
                 // Pokud AI nedala nic na tabuli, nečekáme
                 state.aiIsWaitingForAnswer = false;
                 console.log("[STATE CHANGE] aiIsWaitingForAnswer set to false (no board content, no proposal after continue).");
            }

             if (domChangedInTry) { initTooltips(); }

        } else {
            // Chyba při komunikaci s Gemini
             console.error("Error response from Gemini (continue):", response.error);
             const errorMsg = (response.error || "Neznámá chyba AI").replace(/[.,!?;:]/g, '');
             await addChatMessage(`Chyba: ${errorMsg}`, 'gemini', false); domChangedInTry = true;
             state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
             console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (Gemini error during continue).`);
             if (domChangedInTry) initTooltips();
        }
    } catch (error) {
        // Obecná chyba v bloku try
        console.error("Error in requestContinue catch block:", error);
        const errorMsg = `Chyba při pokračování: ${error.message}`.replace(/[.,!?;:]/g, '');
        showError(errorMsg, false);
        await addChatMessage("Chyba systému.", 'gemini', false); domChangedInTry = true;
        state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (exception during continue).`);
        if (domChangedInTry) initTooltips();
    } finally {
        console.log("[ACTION] requestContinue: Entering finally block.");
        const indicatorRemoved = removeThinkingIndicator();
        domChangedInTry = domChangedInTry || indicatorRemoved;
        console.log("[ACTION] requestContinue: Setting isThinking=false in finally.");
        state.geminiIsThinking = false;
        setLoadingState('chat', false);

        // Určení správného stavu UI
        let nextUiState = 'learning';
        if(state.aiProposedCompletion) nextUiState = 'aiProposingCompletion';
        else if (state.aiIsWaitingForAnswer) nextUiState = 'waitingForAction';
        manageUIState(nextUiState);

        manageButtonStates(); // Aktualizovat tlačítka
        if (domChangedInTry) initTooltips();
        console.log("[ACTION] requestContinue: Exiting finally block.");
    }
}


/**
 * Запускает сессию обучения для текущей темы.
 * Verze 3.9.0: Bez zásadních změn, používá revidované `manageButtonStates`.
 */
async function startLearningSession() {
    if (!state.currentTopic) {
        console.error("[ACTION] startLearningSession: No current topic defined.");
        manageUIState('error', {errorMessage: 'Chyba: Téma není definováno.'});
        return;
    }
    console.log("[ACTION] startLearningSession triggered for topic:", state.currentTopic.name);

    // Reset stavu pro novou session
    state.currentSessionId = generateSessionId();
    state.geminiChatContext = [];
    state.boardContentHistory = [];
    if (ui.chatMessages) ui.chatMessages.innerHTML = '';
    if (ui.whiteboardContent) ui.whiteboardContent.innerHTML = '';
    state.aiIsWaitingForAnswer = false;
    state.aiProposedCompletion = false;

    console.log("[ACTION] startLearningSession: Setting isThinking=true, aiWaiting=false, proposing=false");
    state.geminiIsThinking = true;
    manageUIState('requestingExplanation'); // Ukázat stav "Žádám vysvětlení"
    addThinkingIndicator();
    let domChangedInTry = true;
    manageButtonStates(); // Aktualizovat tlačítka

    // Prompt pro zahájení výkladu
    const prompt = `Vysvětli ZÁKLADY tématu "${state.currentTopic.name}" na úrovni Přijímaček. Začni PRVNÍ částí výkladu na TABULI. Do CHATU napiš pouze "Start".`;

    try {
        console.log("[ACTION] startLearningSession: Calling sendToGemini (isChatInteraction=false)");
        const response = await sendToGemini(prompt, false);
        console.log("[ACTION] startLearningSession: Gemini response received:", response);

        // Odebrat placeholdery, pokud odpověď přišla
        if (response.success && response.data && response.data.boardMarkdown) {
            const boardPlaceholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
            if (boardPlaceholder) { boardPlaceholder.remove(); console.log("Initial whiteboard placeholder removed."); }
            const chatPlaceholder = ui.chatMessages?.querySelector('.empty-state, .initial-load-placeholder');
            if (chatPlaceholder) { chatPlaceholder.remove(); console.log("Initial chat placeholder removed.");}
        } else if (response.success && response.data && !response.data.boardMarkdown) {
             // Pokud AI odpověděla, ale bez obsahu na tabuli, zobrazíme info
             const boardPlaceholder = ui.whiteboardContent?.querySelector('.initial-load-placeholder, .empty-state');
             if(boardPlaceholder) boardPlaceholder.innerHTML = `<i class='fas fa-chalkboard'></i><h3>Tabule prázdná</h3><p>AI neposkytlo úvodní obsah.</p>`;
             const chatPlaceholder = ui.chatMessages?.querySelector('.empty-state, .initial-load-placeholder');
             if(chatPlaceholder) chatPlaceholder.innerHTML = `<i class='fas fa-comments'></i><h3>Chat</h3><p>AI neposkytlo úvodní obsah.</p>`;
        }

        // Zpracovat úspěšnou odpověď
        if (response.success && response.data) {
            const { boardMarkdown, ttsCommentary, chatText } = response.data;
            const completionMarker = "[PROPOSE_COMPLETION]";
            let finalChatText = chatText;
            let proposedCompletion = false;

             if (chatText && chatText.includes(completionMarker)) {
                 finalChatText = chatText.replace(completionMarker, "").trim();
                 proposedCompletion = true;
                 console.log("[AI Action] AI proposed topic completion unexpectedly in initial response.");
             }

            // Zobrazit obsah
            if (boardMarkdown) { appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); domChangedInTry = true; }
            else { console.error("Gemini initial response missing board content."); await addChatMessage("Chyba: AI neposkytlo úvodní obsah.", 'gemini', false); domChangedInTry = true; }
            if (finalChatText) { await addChatMessage(finalChatText, 'gemini', false, new Date(), ttsCommentary); domChangedInTry = true; }
            else if (boardMarkdown) { await addChatMessage("Start", 'gemini', false); domChangedInTry = true; } // Fallback chat text
            if (ttsCommentary && boardMarkdown) { speakText(ttsCommentary, ui.whiteboardContent?.lastElementChild); }

            // Aktualizovat stav AI
             state.aiProposedCompletion = proposedCompletion;
             if (proposedCompletion) {
                  showToast("Návrh AI", "AI navrhuje ukončení tématu. Odpovězte Ano/Ne.", "info", 6000);
                  state.aiIsWaitingForAnswer = true;
                  console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true (waiting for completion confirmation).");
             } else if (boardMarkdown) {
                   // Po úvodním výkladu čekáme na reakci
                   state.aiIsWaitingForAnswer = true;
                   console.log("[STATE CHANGE] aiIsWaitingForAnswer set to true (waiting for user action after initial explanation).");
             } else {
                   state.aiIsWaitingForAnswer = false;
                   console.log("[STATE CHANGE] aiIsWaitingForAnswer set to false (due to missing initial board content).");
             }

             if (domChangedInTry) { initTooltips(); }

        } else {
            // Chyba odpovědi od Gemini
             console.error("Error response from Gemini (start session):", response.error);
             const errorMsg = (response.error || "Neznámá chyba AI").replace(/[.,!?;:]/g, '');
             await addChatMessage(`Chyba: ${errorMsg}`, 'gemini', false); domChangedInTry = true;
             // Zobrazit chybu i na tabuli
             if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba načítání</h3><p>Nepodařilo se získat úvodní obsah od AI.</p></div>`; }
             state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
             console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (Gemini error during start).`);
             showError(`Chyba AI při startu: ${errorMsg}`, false);
             if (domChangedInTry) initTooltips();
        }
    } catch(error) {
        // Obecná chyba v bloku try
        console.error("Error in startLearningSession catch block:", error);
        const errorMsg = `Chyba zahájení výkladu: ${error.message}`.replace(/[.,!?;:]/g, '');
        showError(errorMsg, false);
        if (ui.whiteboardContent) { ui.whiteboardContent.innerHTML = `<div class='empty-state error'><i class='fas fa-exclamation-triangle'></i><h3>Chyba systému</h3></div>`; }
        await addChatMessage("Chyba systému při startu.", 'gemini', false); domChangedInTry = true;
        state.aiIsWaitingForAnswer = false; state.aiProposedCompletion = false;
        console.log(`[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false (exception during start).`);
        if (domChangedInTry) initTooltips();
    } finally {
        console.log("[ACTION] startLearningSession: Entering finally block.");
        const indicatorRemoved = removeThinkingIndicator();
        domChangedInTry = domChangedInTry || indicatorRemoved;
        console.log("[ACTION] startLearningSession: Setting isThinking=false in finally.");
        state.geminiIsThinking = false;
        setLoadingState('chat', false);

        // Nastavit správný stav UI
        let nextUiState = 'learning';
        if(state.aiProposedCompletion) nextUiState = 'aiProposingCompletion';
        else if (state.aiIsWaitingForAnswer) nextUiState = 'waitingForAction';
        manageUIState(nextUiState);

        manageButtonStates(); // Aktualizovat tlačítka
        if (domChangedInTry) initTooltips();
        console.log("[ACTION] startLearningSession: Exiting finally block.");
    }
}


/**
 * Поток действий при подтверждении завершения темы пользователем.
 * Verze 3.9.0: Přidáno správné zacházení s isLoading.points.
 */
async function completeTopicFlow() {
    if (!state.currentTopic || !state.currentUser) {
        console.error("[Flow] Cannot complete topic: missing topic or user data.");
        showToast("Chyba", "Nelze dokončit téma, chybí potřebná data.", "error");
        return;
    }
    if (state.isLoading.points || state.topicLoadInProgress) { // Prevent multiple completions
        console.warn("[Flow] Completion already in progress or points being loaded.");
        return;
    }
    console.log(`[Flow] Starting topic completion flow for activity: ${state.currentTopic.activity_id}`);
    setLoadingState('points', true); // Start points loading indicator
    state.topicLoadInProgress = true; // Block other topic actions
    manageButtonStates();

    try {
        console.log(`[Flow] Calling markTopicComplete for activity ${state.currentTopic.activity_id}`);
        const successMark = await markTopicComplete(state.currentTopic.activity_id, state.currentUser.id);
        if (!successMark) { throw new Error("Nepodařilo se označit téma jako dokončené v databázi."); }
        console.log(`[Flow] Topic marked complete in DB.`);

        console.log(`[Flow] --> Calling awardPoints for userId ${state.currentUser.id} (Points: ${POINTS_TOPIC_COMPLETE})`);
        const pointsAwarded = await awardPoints(state.currentUser.id, POINTS_TOPIC_COMPLETE);
        // Points loading handled internally by awardPoints? Assuming yes. If not, stop loading here.
        // setLoadingState('points', false); // Stop points loading indicator

        if (pointsAwarded) {
            showToast('BODY PŘIPSÁNY', `${POINTS_TOPIC_COMPLETE} kreditů získáno!`, 'success', 3500);
            // Refresh user info in sidebar to show new points (if profile was updated)
             if (state.currentProfile) { // Check if profile exists before updating UI
                  updateUserInfoUI();
             }
        } else {
            showToast('CHYBA BODŮ', 'Téma dokončeno, ale body se nepodařilo připsat. Zkontrolujte konzoli.', 'warning', 5000);
        }

        showToast('Téma dokončeno', `Téma "${state.currentTopic.name}" bylo úspěšně uzavřeno.`, "success", 4000);
        await addChatMessage("Téma uzavřeno.", 'gemini', false);

        console.log("[Flow] Redirecting to /dashboard/procvicovani/main.html in 3 seconds...");
        showToast("Přesměrování", "Za chvíli budete přesměrováni zpět.", "info", 3000);
        setTimeout(() => { window.location.href = '/dashboard/procvicovani/main.html'; }, 3000);

        // Keep loading state until redirect happens
    } catch (error) {
        console.error("[Flow] Error in completeTopicFlow:", error);
        const errorMsg = `Nepodařilo se dokončit téma: ${error.message}`.replace(/[.,!?;:]/g, '');
        showToast("Chyba dokončení", errorMsg, "error");
        state.topicLoadInProgress = false; // Reset flags on error
        setLoadingState('points', false);
        manageButtonStates(); // Re-enable buttons if completion failed
    }
    // No finally block needed here, state remains loading until redirect or error.
}

/** Поток действий для загрузки следующей темы.
 * Verze 3.9.0: Bez zásadních změn. */
async function loadNextTopicFlow() {
     if (!state.currentUser) { console.log(`[Flow] Load next topic skipped: No user.`); return; }
     if (state.topicLoadInProgress) { console.log(`[Flow] Load next topic skipped: Already in progress.`); return; }

     console.log("[Flow] Loading next topic flow: STARTED. Setting topicLoadInProgress=true");
     state.topicLoadInProgress = true;
     setLoadingState('currentTopic', true);
     state.currentTopic = null; // Clear previous topic
     state.geminiChatContext = []; // Reset context
     state.boardContentHistory = [];
     state.aiIsWaitingForAnswer = false;
     state.aiProposedCompletion = false;
     console.log("[STATE CHANGE] aiIsWaitingForAnswer/aiProposedCompletion set to false by loadNextTopicFlow start.");

     // Update UI to show loading state
     if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám další téma...</span>';
     clearWhiteboard(false); // Clear board without toast
     if (ui.chatMessages) ui.chatMessages.innerHTML = ''; // Clear chat
     manageUIState('loadingTopic'); // Show loading placeholders
     manageButtonStates(); // Disable buttons during load

    try {
        console.log("[Flow] Calling loadNextUncompletedTopic...");
        const result = await loadNextUncompletedTopic(state.currentUser.id);
        console.log("[Flow] loadNextUncompletedTopic result:", result);

        if (result.success && result.topic) {
            state.currentTopic = result.topic;
            if (ui.currentTopicDisplay) { ui.currentTopicDisplay.innerHTML = `Téma: <strong>${sanitizeHTML(state.currentTopic.name)}</strong>`; }
            console.log("[Flow] Topic loaded successfully. Resetting topicLoadInProgress=false. Starting learning session...");
            state.topicLoadInProgress = false; // Reset flag BEFORE starting session
            setLoadingState('currentTopic', false);
            await startLearningSession(); // Start the session for the new topic
        } else {
            // No topic found or error occurred
            state.currentTopic = null;
            const message = (result.message || 'Není další téma nebo nastala chyba.').replace(/[.,!?;:]/g, '');
            if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(${sanitizeHTML(message)})</span>`;
            console.log(`[Flow] No topic loaded or error. Reason: ${result.reason}. Resetting topicLoadInProgress=false.`);
            state.topicLoadInProgress = false;
            setLoadingState('currentTopic', false);
            manageUIState(result.reason || 'error', { errorMessage: message });
            manageButtonStates(); // Update buttons for the final state (no topic)
        }
    } catch(error) {
        console.error("Error in loadNextTopicFlow execution:", error);
        state.currentTopic = null;
        const errorMsg = `Chyba při načítání dalšího tématu: ${error.message}`.replace(/[.,!?;:]/g, '');
        if (ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `<span class="placeholder">(Chyba načítání)</span>`;
        console.log("[Flow] Exception loading topic. Resetting topicLoadInProgress=false.");
        state.topicLoadInProgress = false;
        setLoadingState('currentTopic', false);
        manageUIState('error', { errorMessage: errorMsg });
        manageButtonStates();
    } finally {
         // Ensure flags are always reset, even if an unexpected error occurred before setting them
         if (state.topicLoadInProgress) {
             console.warn("[Flow] topicLoadInProgress was still true in finally block. Resetting.");
             state.topicLoadInProgress = false;
             setLoadingState('currentTopic', false);
             manageButtonStates();
         }
         initTooltips(); // Ensure tooltips are initialized after potential DOM changes
    }
    console.log("[Flow] Loading next topic flow: FINISHED.");
}

// --- Запуск Приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);