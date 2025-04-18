// ui.js - Кэш DOM-элементов интерфейса Vyuka

// Экспортируем объект ui, чтобы получить доступ к элементам из других модулей.
// Важно, чтобы этот скрипт выполнялся после того, как DOM будет полностью загружен,
// либо чтобы доступ к ui объекту происходил внутри `DOMContentLoaded` или подобных обработчиков.
// В нашем случае, так как мы используем type="module", это будет работать корректно.
export const ui = {
    // Loaders & Overlays
    initialLoader: document.getElementById('initial-loader'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    offlineBanner: document.getElementById('offline-banner'),

    // Sidebar & User Info
    sidebar: document.getElementById('sidebar'),
    mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'), // Используем ID из HTML
    sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
    sidebarAvatar: document.getElementById('sidebar-avatar'), // ID в HTML: user-avatar
    sidebarName: document.getElementById('sidebar-name'),   // ID в HTML: user-name
    currentYearSidebar: document.getElementById('currentYearSidebar'),

    // Header & Notifications
    dashboardHeader: document.querySelector('.dashboard-header'), // Используем класс, т.к. ID нет
    notificationBell: document.getElementById('notification-bell'),
    notificationCount: document.getElementById('notification-count'),
    notificationsDropdown: document.getElementById('notifications-dropdown'),
    notificationsList: document.getElementById('notifications-list'),
    noNotificationsMsg: document.getElementById('no-notifications-msg'),
    markAllReadBtn: document.getElementById('mark-all-read'),

    // Main Content & Vyuka specific elements
    mainContent: document.getElementById('main-content'),
    topicBar: document.querySelector('.topic-bar'), // Используем класс
    currentTopicDisplay: document.getElementById('current-topic-display'),
    continueBtn: document.getElementById('continue-btn'),
    learningInterface: document.querySelector('.call-interface'), // Главный контейнер обучения
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
    chatTabButton: document.querySelector('.interaction-tab[data-tab="chat-tab"]'), // Выбираем по атрибуту
    chatHeader: document.querySelector('.chat-header'),
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendButton: document.getElementById('send-button'),
    chatControls: document.querySelector('.chat-controls'),
    micBtn: document.getElementById('mic-btn'),
    clearChatBtn: document.getElementById('clear-chat-btn'),
    saveChatBtn: document.getElementById('save-chat-btn'),
    aiAvatarCorner: document.getElementById('ai-avatar-corner'),
    stopSpeechBtn: document.getElementById('stop-speech-btn'),
    markCompleteBtn: document.getElementById('mark-complete-btn'),

    // Feedback & Footer
    toastContainer: document.getElementById('toast-container'),
    globalError: document.getElementById('global-error'),
    dashboardFooter: document.querySelector('.dashboard-footer'), // Используем класс
    currentYearFooter: document.getElementById('currentYearFooter'),

    // Mouse Follower
    mouseFollower: document.getElementById('mouse-follower')
};

// Проверка наличия ключевых элементов при загрузке модуля
if (!ui.mainContent || !ui.sidebar || !ui.learningInterface) {
    console.error("UI Cache Error: Core layout elements not found! Check IDs in vyuka.html");
} else {
    console.log("UI elements cache created.");
}