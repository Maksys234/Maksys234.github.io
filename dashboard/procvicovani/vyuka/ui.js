// ui.js - Кэш DOM-элементов интерфейса Vyuka
// Verze: 3.9.4 - Odstraněny clearChatBtn, saveChatBtn, ověřeno micBtn

export const ui = {
    // Loaders & Overlays
    initialLoader: document.getElementById('initial-loader'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    offlineBanner: document.getElementById('offline-banner'),

    // Sidebar & User Info
    sidebar: document.getElementById('sidebar'),
    mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
    sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
    sidebarAvatar: document.getElementById('sidebar-avatar'),
    sidebarName: document.getElementById('sidebar-name'),
    currentYearSidebar: document.getElementById('currentYearSidebar'),

    // Header & Notifications
    dashboardHeader: document.querySelector('.dashboard-header'),
    notificationBell: document.getElementById('notification-bell'),
    notificationCount: document.getElementById('notification-count'),
    notificationsDropdown: document.getElementById('notifications-dropdown'),
    notificationsList: document.getElementById('notifications-list'),
    noNotificationsMsg: document.getElementById('no-notifications-msg'),
    markAllReadBtn: document.getElementById('mark-all-read'),

    // Main Content & Vyuka specific elements
    mainContent: document.getElementById('main-content'),
    topicBar: document.querySelector('.topic-bar'),
    currentTopicDisplay: document.getElementById('current-topic-display'),
    continueBtn: document.getElementById('continue-btn'),
    learningInterface: document.querySelector('.call-interface'),
    aiPresenterArea: document.querySelector('.ai-presenter-area'),
    aiPresenterHeader: document.querySelector('.ai-presenter-header'),
    aiAvatarPlaceholder: document.querySelector('.ai-avatar-placeholder'),
    aiStatusText: document.getElementById('ai-status-text'),
    clearBoardBtn: document.getElementById('clear-board-btn'),
    whiteboardContainer: document.getElementById('whiteboard-container'),
    whiteboardContent: document.getElementById('whiteboard-content'),
    boardSpeakingIndicator: document.getElementById('board-speaking-indicator'),
    interactionPanel: document.querySelector('.interaction-panel'),
    interactionTabs: document.querySelector('.interaction-tabs'),
    chatTabContent: document.getElementById('chat-tab-content'),
    chatTabButton: document.querySelector('.interaction-tab[data-tab="chat-tab"]'),
    chatHeader: document.querySelector('.chat-header'),
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendButton: document.getElementById('send-button'),
    // chatControls: document.querySelector('.chat-controls'), // Odstraněno
    micBtn: document.getElementById('mic-btn'), // ID zůstává stejné, i když je na jiném místě
    // clearChatBtn: document.getElementById('clear-chat-btn'), // Odstraněno
    // saveChatBtn: document.getElementById('save-chat-btn'), // Odstraněno
    stopSpeechBtn: document.getElementById('stop-speech-btn'),

    // Feedback & Footer
    toastContainer: document.getElementById('toast-container'),
    globalError: document.getElementById('global-error'),
    dashboardFooter: document.querySelector('.dashboard-footer'),
    currentYearFooter: document.getElementById('currentYearFooter'),

    // Mouse Follower
    mouseFollower: document.getElementById('mouse-follower')
};

// Проверка наличия ключевых элементов при загрузке модуля
if (!ui.mainContent || !ui.sidebar || !ui.learningInterface || !ui.chatInput || !ui.micBtn) { // Přidána kontrola micBtn
    console.error("UI Cache Error: Core layout elements not found! Check IDs in vyuka.html and ui.js");
} else {
    console.log("UI elements cache created successfully (v3.9.4).");
}