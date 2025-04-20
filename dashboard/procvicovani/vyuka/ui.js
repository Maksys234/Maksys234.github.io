// ui.js - Кэш DOM-элементов интерфейса Vyuka
// Verze: 3.9.8 - Opraveno hledání micBtn, přidána kontrola ID v konzoli

console.log("[UI Cache] Initializing UI element cache...");

export const ui = {
    // Loaders & Overlays
    initialLoader: document.getElementById('initial-loader'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    offlineBanner: document.getElementById('offline-banner'),
    loadingOverlayUser: document.getElementById('loading-overlay-user'),
    loadingOverlayCurrentTopic: document.getElementById('loading-overlay-currentTopic'),
    loadingOverlayNotifications: document.getElementById('loading-overlay-notifications'),

    // Sidebar & User Info
    sidebar: document.getElementById('sidebar'), // <<< Использует id="sidebar"
    mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
    sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
    sidebarAvatar: document.getElementById('user-avatar'),
    sidebarName: document.getElementById('user-name'),
    currentYearSidebar: document.getElementById('currentYearSidebar'),

    // Header & Notifications
    dashboardHeader: document.querySelector('.dashboard-header'),
    notificationBell: document.getElementById('notification-bell'),
    notificationCount: document.getElementById('notification-badge'),
    notificationsDropdown: document.getElementById('notifications-dropdown'),
    notificationsList: document.getElementById('notifications-list'),
    noNotificationsMsg: document.getElementById('no-notifications-msg'),
    markAllReadBtn: document.getElementById('mark-all-read-btn'),

    // Main Content & Vyuka specific elements
    mainContent: document.getElementById('main-content'), // <<< Использует id="main-content"
    topicBar: document.querySelector('.topic-bar'),
    currentTopicDisplay: document.getElementById('current-topic-display'),
    continueBtn: document.getElementById('continue-btn'),
    learningInterface: document.querySelector('.call-interface'), // Поиск по классу
    aiPresenterArea: document.querySelector('.ai-presenter-area'),
    aiPresenterHeader: document.querySelector('.ai-presenter-header'),
    aiAvatarPlaceholder: document.querySelector('.ai-avatar-placeholder'),
    aiStatusText: document.getElementById('ai-status-text'), // Добавьте этот ID, если нужен статус
    clearBoardBtn: document.getElementById('clear-board-btn'),
    whiteboardContainer: document.getElementById('whiteboard-container'),
    whiteboardContent: document.getElementById('whiteboard-content'),
    boardSpeakingIndicator: document.getElementById('board-speaking-indicator'),

    // Interaction Panel (Chat)
    interactionPanel: document.querySelector('.interaction-panel'),
    interactionTabs: document.querySelector('.interaction-tabs'),
    chatTabContent: document.getElementById('chat-tab-content'),
    chatTabButton: document.querySelector('.interaction-tab[data-tab="chat-tab"]'),
    chatHeader: document.querySelector('.chat-header'),
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendButton: document.getElementById('send-button'), // Использует id="send-button"
    micBtn: document.getElementById('speech-to-text-button'), // <<< ИСПРАВЛЕН ID на 'speech-to-text-button'
    stopSpeechBtn: document.getElementById('stop-speech-btn'),

    // Feedback & Footer
    toastContainer: document.getElementById('toast-container'),
    globalError: document.getElementById('global-error'),
    dashboardFooter: document.querySelector('.dashboard-footer'),
    currentYearFooter: document.getElementById('currentYearFooter'),

    // Mouse Follower
    mouseFollower: document.getElementById('mouse-follower')
};

// --- DEBUGGING: Проверка найденных элементов ---
console.log("[UI Cache Debug] mainContent found:", !!ui.mainContent);
console.log("[UI Cache Debug] sidebar found:", !!ui.sidebar);
console.log("[UI Cache Debug] learningInterface found:", !!ui.learningInterface);
console.log("[UI Cache Debug] chatInput found:", !!ui.chatInput);
console.log("[UI Cache Debug] micBtn found (using #speech-to-text-button):", !!ui.micBtn);
// --------------------------------------------

// Проверка наличия ключевых элементов при загрузке модуля
if (!ui.mainContent || !ui.sidebar || !ui.learningInterface || !ui.chatInput || !ui.micBtn) {
    console.error("UI Cache Error: Core layout elements not found! Check IDs in vyuka.html and ui.js. See debug logs above.");
} else {
    console.log("UI elements cache created successfully (v3.9.8).");
}