// ui.js - Кэш DOM-элементов интерфейса Vyuka
// Verze: 3.9.7 - Opraveno hledání #main-content, #sidebar, #mic-btn; přidány/aktualizovány další prvky

export const ui = {
    // Loaders & Overlays
    initialLoader: document.getElementById('initial-loader'),
    sidebarOverlay: document.getElementById('sidebar-overlay'), // Предполагается наличие в HTML для моб. меню
    offlineBanner: document.getElementById('offline-banner'), // Если используется
    loadingOverlayUser: document.getElementById('loading-overlay-user'),
    loadingOverlayCurrentTopic: document.getElementById('loading-overlay-currentTopic'),
    loadingOverlayNotifications: document.getElementById('loading-overlay-notifications'),

    // Sidebar & User Info
    sidebar: document.getElementById('sidebar'), // Использует новый ID <aside>
    mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'), // Кнопка гамбургера
    sidebarCloseToggle: document.getElementById('sidebar-close-toggle'), // Кнопка X в сайдбаре
    sidebarAvatar: document.getElementById('user-avatar'),   // Аватар в сайдбаре
    sidebarName: document.getElementById('user-name'),     // Имя в сайдбаре
    currentYearSidebar: document.getElementById('currentYearSidebar'), // Год в футере сайдбара

    // Header & Notifications (Добавлены элементы уведомлений)
    dashboardHeader: document.querySelector('.dashboard-header'),
    notificationBell: document.getElementById('notification-bell'),
    notificationCount: document.getElementById('notification-badge'), // Используем ID из HTML
    notificationsDropdown: document.getElementById('notifications-dropdown'), // Используем ID из HTML
    notificationsList: document.getElementById('notifications-list'),
    noNotificationsMsg: document.getElementById('no-notifications-msg'),
    markAllReadBtn: document.getElementById('mark-all-read-btn'), // Используем ID из HTML

    // Main Content & Vyuka specific elements
    mainContent: document.getElementById('main-content'), // Использует новый ID <main>
    topicBar: document.querySelector('.topic-bar'),
    currentTopicDisplay: document.getElementById('current-topic-display'),
    continueBtn: document.getElementById('continue-btn'), // Кнопка "Dokončit Téma"
    learningInterface: document.querySelector('.call-interface'), // Контейнер с презентером и чатом
    aiPresenterArea: document.querySelector('.ai-presenter-area'),
    aiPresenterHeader: document.querySelector('.ai-presenter-header'),
    aiAvatarPlaceholder: document.querySelector('.ai-avatar-placeholder'),
    aiStatusText: document.getElementById('ai-status-text'), // Если есть статус AI
    clearBoardBtn: document.getElementById('clear-board-btn'), // Кнопка очистки доски
    whiteboardContainer: document.getElementById('whiteboard-container'),
    whiteboardContent: document.getElementById('whiteboard-content'),
    boardSpeakingIndicator: document.getElementById('board-speaking-indicator'), // Индикатор речи на доске

    // Interaction Panel (Chat)
    interactionPanel: document.querySelector('.interaction-panel'),
    interactionTabs: document.querySelector('.interaction-tabs'),
    chatTabContent: document.getElementById('chat-tab-content'),
    chatTabButton: document.querySelector('.interaction-tab[data-tab="chat-tab"]'), // Кнопка вкладки чата
    chatHeader: document.querySelector('.chat-header'),
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendButton: document.getElementById('send-button'), // Кнопка отправки сообщения
    micBtn: document.getElementById('speech-to-text-button'), // <<< ИЗМЕНЕН ID для кнопки микрофона
    stopSpeechBtn: document.getElementById('stop-speech-btn'), // Кнопка "Stop TTS"

    // Feedback & Footer
    toastContainer: document.getElementById('toast-container'),
    globalError: document.getElementById('global-error'),
    dashboardFooter: document.querySelector('.dashboard-footer'), // Если есть общий футер
    currentYearFooter: document.getElementById('currentYearFooter'), // Год в общем футере

    // Mouse Follower
    mouseFollower: document.getElementById('mouse-follower')
};

// Проверка наличия ключевых элементов при загрузке модуля
if (!ui.mainContent || !ui.sidebar || !ui.chatInput || !ui.micBtn || !ui.sendButton) {
    console.error("UI Cache Error: Core layout elements not found! Check IDs in vyuka.html and ui.js");
} else {
    console.log("UI elements cache created successfully (v3.9.7).");
}