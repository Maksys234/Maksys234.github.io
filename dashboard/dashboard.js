// dashboard.js
// Версия: 22.1 - Полная версия с Модальным Календарем, Этапами Серии и Ожиданием Supabase
(function() {
    'use strict';

    // --- START: Initialization and Configuration ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = []; // Хранилище для доступных титулов

    // Состояния загрузки для разных секций
    let isLoading = {
        stats: false,
        activities: false,
        notifications: false,
        titles: false,
        monthlyRewards: false, // Загрузка данных/рендеринг для модального окна
        streakMilestones: false // Загрузка данных/рендеринг для этапов
    };
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState'; // Ключ для localStorage

    // Конфигурация Наград
    const MONTHLY_REWARD_DAYS = 31; // Макс. дней в месяце
    const MILESTONE_REWARDS_CONFIG = { // Пример этапов и наград (пока пустые)
        10: { name: "10 Дней Серии!", description: "Маленький бонус за первую веху.", icon: "fa-star", reward_type: "placeholder", reward_value: 10 },
        30: { name: "Месяц Без Пропусков!", description: "Стабильность вознаграждается.", icon: "fa-calendar-check", reward_type: "placeholder", reward_value: 30 },
        50: { name: "Полсотни Дней!", description: "Вы на полпути к сотне!", icon: "fa-award", reward_type: "placeholder", reward_value: 50 },
        100: { name: "Легендарная Сотня!", description: "Впечатляющая преданность!", icon: "fa-crown", reward_type: "placeholder", reward_value: 100 },
        150: { name: "Ветеран Системы", description: "Вы знаете все ходы!", icon: "fa-shield-alt", reward_type: "placeholder", reward_value: 150 },
        200: { name: "Двойная Сотня!", description: "Продолжайте в том же духе!", icon: "fa-gem", reward_type: "placeholder", reward_value: 200 },
        300: { name: "Почти Год!", description: "Невероятная выдержка!", icon: "fa-trophy", reward_type: "placeholder", reward_value: 300 },
        365: { name: "Годовщина Входа!", description: "Вы истинный пилот Justax!", icon: "fa-rocket", reward_type: "placeholder", reward_value: 365 }
        // Можно добавить больше этапов
    };
    const milestoneDays = Object.keys(MILESTONE_REWARDS_CONFIG).map(Number).sort((a, b) => a - b);

    // DOM Elements Cache
    const ui = {
        initialLoader: document.getElementById('initial-loader'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        mainContent: document.getElementById('main-content'),
        sidebar: document.getElementById('sidebar'),
        mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
        sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
        sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
        sidebarAvatar: document.getElementById('sidebar-avatar'),
        sidebarName: document.getElementById('sidebar-name'),
        sidebarUserTitle: document.getElementById('sidebar-user-title'),
        dashboardTitle: document.getElementById('dashboard-title'),
        refreshDataBtn: document.getElementById('refresh-data-btn'),
        notificationBell: document.getElementById('notification-bell'),
        notificationCount: document.getElementById('notification-count'),
        notificationsDropdown: document.getElementById('notifications-dropdown'),
        notificationsList: document.getElementById('notifications-list'),
        noNotificationsMsg: document.getElementById('no-notifications-msg'),
        markAllReadBtn: document.getElementById('mark-all-read'),
        welcomeTitle: document.getElementById('welcome-title'),
        startPracticeBtn: document.getElementById('start-practice-btn'),
        openMonthlyModalBtn: document.getElementById('open-monthly-modal-btn'), // Кнопка для открытия модалки календаря
        progressCard: document.getElementById('progress-card'),
        pointsCard: document.getElementById('points-card'),
        streakCard: document.getElementById('streak-card'),
        activityListContainer: document.getElementById('activity-list-container'),
        activityList: document.getElementById('activity-list'),
        activityListEmptyState: document.querySelector('#activity-list-container .empty-state'),
        activityListErrorState: document.querySelector('#activity-list-container .card-error-state'),
        toastContainer: document.getElementById('toast-container'),
        globalError: document.getElementById('global-error'),
        offlineBanner: document.getElementById('offline-banner'),
        mouseFollower: document.getElementById('mouse-follower'),
        currentYearSidebar: document.getElementById('currentYearSidebar'),
        currentYearFooter: document.getElementById('currentYearFooter'),
        // Monthly Reward Modal Elements
        monthlyRewardModal: document.getElementById('monthly-reward-modal'),
        modalMonthlyCalendarGrid: document.getElementById('modal-monthly-calendar-grid'),
        modalMonthlyCalendarEmpty: document.getElementById('modal-monthly-calendar-empty'),
        modalCurrentMonthYearSpan: document.getElementById('modal-current-month-year'),
        closeMonthlyModalBtn: document.getElementById('close-monthly-modal-btn'),
        // Streak Milestones Elements
        streakMilestonesSection: document.getElementById('streak-milestones-section'),
        streakMilestonesList: document.getElementById('streak-milestones-list'),
        streakMilestonesEmpty: document.getElementById('streak-milestones-empty'),
        currentStreakValueSpan: document.getElementById('current-streak-value')
    };

    // Visual settings for activities & notifications
    const activityVisuals = {
        exercise: { name: 'Trénink', icon: 'fa-laptop-code', class: 'exercise' },
        test: { name: 'Test', icon: 'fa-vial', class: 'test' },
        badge: { name: 'Odznak Získán', icon: 'fa-medal', class: 'badge' },
        diagnostic: { name: 'Diagnostika', icon: 'fa-microscope', class: 'diagnostic' },
        lesson: { name: 'Nová Data', icon: 'fa-book-open', class: 'lesson' },
        plan_generated: { name: 'Plán Aktualizován', icon: 'fa-route', class: 'plan_generated' },
        level_up: { name: 'Level UP!', icon: 'fa-angle-double-up', class: 'level_up' },
        other: { name: 'Systémová Zpráva', icon: 'fa-info-circle', class: 'other' },
        default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
    };
    // --- END: Initialization and Configuration ---

    // --- START: Helper Functions ---
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Obnovit Stránku</button></div>`; ui.globalError.style.display = 'block'; const retryBtn = document.getElementById('global-retry-btn'); if (retryBtn) { retryBtn.addEventListener('click', () => { location.reload(); }); } } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }
    function setLoadingState(section, isLoadingFlag) {
        const sections = section === 'all' ? Object.keys(isLoading) : [section];
        sections.forEach(sec => {
            if (isLoading[sec] === isLoadingFlag && section !== 'all') return;
            isLoading[sec] = isLoadingFlag;
            console.log(`[setLoadingState] Section: ${sec}, isLoading: ${isLoadingFlag}`);

            const loaderOverlay = {
                monthlyRewards: ui.monthlyRewardModal?.querySelector('.loading-overlay'),
                streakMilestones: ui.streakMilestonesSection?.querySelector('.loading-overlay'),
                activities: ui.activityListContainer,
                stats: null, notifications: null, titles: null
            }[sec];

            const contentContainer = {
                monthlyRewards: ui.modalMonthlyCalendarGrid,
                streakMilestones: ui.streakMilestonesList,
                activities: ui.activityList,
                stats: null, notifications: ui.notificationsList, titles: null
            }[sec];

             const emptyStateContainer = {
                 monthlyRewards: ui.modalMonthlyCalendarEmpty,
                 streakMilestones: ui.streakMilestonesEmpty,
                 activities: ui.activityListEmptyState,
                 notifications: ui.noNotificationsMsg
             }[sec];

             const parentSection = {
                 monthlyRewards: ui.monthlyRewardModal?.querySelector('.modal-body'),
                 streakMilestones: ui.streakMilestonesSection,
                 activities: ui.activityListContainer,
                 stats: null, notifications: null, titles: null
             }[sec];

            // Handle general cards (stats)
            if (sec === 'stats') {
                [ui.progressCard, ui.pointsCard, ui.streakCard].forEach(card => card?.classList.toggle('loading', isLoadingFlag));
            }
            // Handle sections with overlays/skeletons
            else if (loaderOverlay || parentSection) {
                parentSection?.classList.toggle('loading', isLoadingFlag);
                if (loaderOverlay) loaderOverlay.classList.toggle('hidden', !isLoadingFlag);

                if (isLoadingFlag) {
                    if(contentContainer) contentContainer.innerHTML = ''; // Clear content
                    if(emptyStateContainer) emptyStateContainer.style.display = 'none';
                    // Render skeletons
                    if (sec === 'activities') renderActivitySkeletons(5);
                    else if (sec === 'monthlyRewards') renderMonthlyCalendarSkeletons();
                    else if (sec === 'streakMilestones') renderMilestoneSkeletons();
                    else if (sec === 'notifications') renderNotificationSkeletons(2);
                } else {
                     if (contentContainer && !contentContainer.hasChildNodes() && emptyStateContainer) {
                         emptyStateContainer.style.display = 'block';
                     }
                }
            }
            // Handle notifications bell/button separately
            else if (sec === 'notifications' && ui.notificationBell) {
                 ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                 if(ui.markAllReadBtn) { const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0; }
                 if(isLoadingFlag && ui.notificationsList) { renderNotificationSkeletons(2); }
            }
        });
    }
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }); animatedElements.forEach(element => observer.observe(element)); };
    const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 50); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl && mainEl.scrollTop > 50) document.body.classList.add('scrolled'); };
    const updateCopyrightYear = () => { const currentYearSpan = document.getElementById('currentYearFooter'); const currentYearSidebar = document.getElementById('currentYearSidebar'); const year = new Date().getFullYear(); if (currentYearSpan) { currentYearSpan.textContent = year; } if (currentYearSidebar) { currentYearSidebar.textContent = year; } };
    function applyInitialSidebarState() { const savedState = localStorage.getItem(SIDEBAR_STATE_KEY); const shouldBeCollapsed = savedState === 'collapsed'; if (shouldBeCollapsed) { document.body.classList.add('sidebar-collapsed'); } else { document.body.classList.remove('sidebar-collapsed'); } const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) { icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; } console.log(`[Sidebar State] Initial state applied: ${shouldBeCollapsed ? 'collapsed' : 'expanded'}`); }
    function toggleSidebar() { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) { icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; } console.log(`[Sidebar Toggle] Sidebar toggled. New state: ${isCollapsed ? 'collapsed' : 'expanded'}`); }
    function initTooltips() { try { if (window.jQuery && typeof window.jQuery.fn.tooltipster === 'function') { window.jQuery('.btn-tooltip.tooltipstered').each(function() { if (document.body.contains(this)) { try { window.jQuery(this).tooltipster('destroy'); } catch (destroyError) { console.warn("Tooltipster destroy error:", destroyError); } } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); console.log("[Tooltips] Initialized/Re-initialized."); } else { console.warn("[Tooltips] jQuery or Tooltipster library not loaded."); } } catch (e) { console.error("[Tooltips] Error initializing Tooltipster:", e); } }
    function isSameDate(date1, date2) { if (!date1 || !date2) return false; const d1 = new Date(date1); const d2 = new Date(date2); return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate(); }
    function isYesterday(date1, date2) { if (!date1 || !date2) return false; const yesterday = new Date(date2); yesterday.setDate(yesterday.getDate() - 1); return isSameDate(date1, yesterday); }
    function getCurrentMonthYearString() { const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); return `${year}-${month}`; }

    // --- Modal Helpers ---
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            console.log(`[Modal] Opening modal: ${modalId}`);
            modal.style.display = 'flex';
            if (modalId === 'monthly-reward-modal') {
                renderMonthlyCalendar(); // Render fresh content when opened
            }
            requestAnimationFrame(() => { modal.classList.add('active'); });
        } else { console.error(`[Modal] Modal element not found: #${modalId}`); }
    }
    function hideModal(modalId) {
         const modal = document.getElementById(modalId);
         if (modal) {
             console.log(`[Modal] Closing modal: ${modalId}`);
             modal.classList.remove('active');
             setTimeout(() => { modal.style.display = 'none'; }, 300); // Match CSS
         }
     }
    // --- END: Helper Functions ---

    // --- START: Data Loading and Processing ---
    function initializeSupabase() {
        try {
            if (typeof window.supabase === 'undefined') { throw new Error("Knihovna Supabase nebyla nalezena (window.supabase je undefined)."); }
            if (typeof window.supabase.createClient !== 'function') { throw new Error("Funkce createClient v knihovně Supabase nebyla nalezena."); }
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            if (!supabase) { throw new Error("Vytvoření klienta Supabase selhalo (vrátilo null/undefined)."); }
            console.log('[Supabase] Klient úspěšně inicializován.');
            return true;
        } catch (error) {
            console.error('[Supabase] Inicializace selhala:', error);
            showError(`Kritická chyba: Nepodařilo se připojit k databázi. (${error.message})`, true);
            return false;
        }
    }

    async function fetchUserProfile(userId) {
        if (!supabase || !userId) return null;
        console.log(`[Profile] Fetching profile for user ID: ${userId}`);
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*, selected_title, last_login, streak_days, monthly_claims, last_milestone_claimed')
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') { throw error; }
            if (!profile) { console.warn(`[Profile] Profile for ${userId} not found. Returning null.`); return null; }
            profile.monthly_claims = profile.monthly_claims || {};
            profile.last_milestone_claimed = profile.last_milestone_claimed || 0;
            console.log("[Profile] Profile data fetched successfully.");
            return profile;
        } catch (error) { console.error('[Profile] Exception fetching profile:', error); return null; }
    }

    async function createDefaultProfile(userId, userEmail) {
        if (!supabase || !userId || !userEmail) return null;
        console.log(`[Profile Create] Creating default profile for user ${userId}`);
        try {
            const defaultData = {
                 id: userId, email: userEmail, username: userEmail.split('@')[0] || `user_${userId.substring(0, 6)}`,
                 level: 1, points: 0, experience: 0, badges_count: 0, streak_days: 0,
                 last_login: new Date().toISOString(),
                 monthly_claims: {}, // Default empty object
                 last_milestone_claimed: 0, // Default 0
                 created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                 preferences: { dark_mode: window.matchMedia('(prefers-color-scheme: dark)').matches, language: 'cs' },
                 notifications: { email: true, study_tips: true, content_updates: true, practice_reminders: true }
            };
            const { data: newProfile, error } = await supabase
                .from('profiles')
                .insert(defaultData)
                .select('*, selected_title, last_login, streak_days, monthly_claims, last_milestone_claimed')
                .single();
            if (error) { if (error.code === '23505') { console.warn("[Profile Create] Profile likely already exists, fetching again."); return await fetchUserProfile(userId); } throw error; }
            console.log("[Profile Create] Default profile created:", newProfile);
            return newProfile;
        } catch (error) { console.error("[Profile Create] Failed to create default profile:", error); return null; }
    }

    async function fetchTitles() {
        if (!supabase) return [];
        console.log("[Titles] Fetching available titles...");
        // setLoadingState('titles', true); // Titles loading is usually fast, maybe skip visual loader
        try {
            const { data, error } = await supabase.from('title_shop').select('title_key, name');
            if (error) throw error;
            console.log("[Titles] Fetched titles:", data);
            return data || [];
        } catch (error) { console.error("[Titles] Error fetching titles:", error); return []; }
        // finally { setLoadingState('titles', false); }
    }
    async function fetchUserStats(userId, profileData) { if (!supabase || !userId || !profileData) { console.error("[Stats] Chybí Supabase klient, ID uživatele nebo data profilu."); return null; } console.log(`[Stats] Načítání statistik pro uživatele ${userId}...`); let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats] Chyba Supabase při načítání user_stats:", statsError.message); } } catch (error) { console.error("[Stats] Neočekávaná chyba při načítání user_stats:", error); statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0 }; if (statsError) { console.warn("[Stats] Vracení statistik primárně z profilu kvůli chybě načítání."); } else { console.log("[Stats] Statistiky úspěšně načteny/sestaveny:", finalStats); } return finalStats; }
    async function fetchRecentActivities(userId, limit = 5) { if (!supabase || !userId) { console.error("[Activities] Chybí Supabase nebo ID uživatele."); return []; } console.log(`[Activities] Načítání posledních ${limit} aktivit pro uživatele ${userId}`); try { const { data, error } = await supabase .from('activities') .select('*') .eq('user_id', userId) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; console.log(`[Activities] Načteno ${data?.length || 0} aktivit.`); return data || []; } catch (error) { console.error('[Activities] Výjimka při načítání aktivit:', error); return []; } }
    async function fetchNotifications(userId, limit = 5) { if (!supabase || !userId) { console.error("[Notifications] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await supabase .from('user_notifications') .select('*', { count: 'exact' }) .eq('user_id', userId) .eq('is_read', false) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; console.log(`[Notifications] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; } }

    // --- Check/Update Streak and Login ---
    async function checkAndUpdateLoginStreak() {
        if (!currentUser || !currentProfile || !supabase) { console.warn("[StreakCheck] Cannot perform check: missing user, profile, or supabase."); return false; }
        console.log("[StreakCheck] Performing daily login check/update...");
        const today = new Date();
        const lastLogin = currentProfile.last_login ? new Date(currentProfile.last_login) : null;
        let currentStreak = currentProfile.streak_days || 0;
        let needsDbUpdate = false;
        let updateData = {};
        let currentMonth = getCurrentMonthYearString();

        if (!lastLogin || !isSameDate(today, lastLogin)) {
            needsDbUpdate = true;
            console.log("[StreakCheck] First login of the day detected.");
            if (lastLogin && isYesterday(lastLogin, today)) {
                currentStreak++;
                console.log(`[StreakCheck] Streak continued! New streak: ${currentStreak}`);
            } else if (lastLogin) {
                currentStreak = 1;
                console.log("[StreakCheck] Streak broken. Resetting to 1.");
            } else {
                currentStreak = 1;
                console.log("[StreakCheck] First login ever. Setting streak to 1.");
            }
            updateData.streak_days = currentStreak;
            updateData.last_login = today.toISOString();
        } else {
            console.log("[StreakCheck] Already logged in today. No streak update needed.");
            currentStreak = currentProfile.streak_days || 0;
        }

        // Update current streak display immediately
        if (ui.currentStreakValueSpan) ui.currentStreakValueSpan.textContent = currentStreak;
        // Update local profile state for immediate UI consistency
        currentProfile.streak_days = currentStreak;

        // Check and Initialize Monthly Claims
        currentProfile.monthly_claims = currentProfile.monthly_claims || {};
        if (!currentProfile.monthly_claims[currentMonth]) {
            console.log(`[StreakCheck] Initializing claims for new month: ${currentMonth}`);
            const updatedClaims = { ...currentProfile.monthly_claims, [currentMonth]: [] };
            currentProfile.monthly_claims = updatedClaims;
            updateData.monthly_claims = updatedClaims;
            needsDbUpdate = true;
        } else {
            console.log(`[StreakCheck] Monthly claims for ${currentMonth} already exist.`);
        }

        if (needsDbUpdate) {
            console.log("[StreakCheck] Updating profile in DB with:", updateData);
            try {
                const { error: updateError } = await supabase.from('profiles').update(updateData).eq('id', currentUser.id);
                if (updateError) throw updateError;
                if (updateData.last_login) currentProfile.last_login = updateData.last_login;
                console.log("[StreakCheck] Profile updated successfully in DB.");
                return true;
            } catch (error) {
                console.error("[StreakCheck] Error updating profile:", error);
                showToast('Chyba', 'Nepodařilo se aktualizovat data přihlášení.', 'error');
                return false;
            }
        }
        return false;
    }

    // --- Database update functions (Placeholders for now) ---
    async function updateMonthlyClaimsInDB(newClaimsData) {
        if (!currentUser || !supabase) return false;
        console.log("[DB Update] Simulating update for monthly claims:", newClaimsData);
        // **** Реальный код для обновления ****
        // try {
        //     const { error } = await supabase.from('profiles')
        //         .update({ monthly_claims: newClaimsData })
        //         .eq('id', currentUser.id);
        //     if (error) throw error;
        //     console.log("[DB Update] Monthly claims updated successfully.");
        //     return true;
        // } catch (error) {
        //     console.error("[DB Update] Error updating monthly claims:", error);
        //     showToast('Chyba Ukládání', 'Nepodařilo se uložit postup měsíčních odměn.', 'error');
        //     return false;
        // }
        // **********************************
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
        console.log("[DB Update] Placeholder: Monthly claims update simulated.");
        return true; // Assume success for placeholder
    }

    async function updateLastMilestoneClaimedInDB(milestoneDay) {
        if (!currentUser || !supabase) return false;
        console.log(`[DB Update] Simulating update for last_milestone_claimed: ${milestoneDay}`);
        // **** Реальный код для обновления ****
        // try {
        //     const { error } = await supabase.from('profiles')
        //         .update({ last_milestone_claimed: milestoneDay })
        //         .eq('id', currentUser.id);
        //     if (error) throw error;
        //     console.log(`[DB Update] Last claimed milestone updated to: ${milestoneDay}`);
        //     return true;
        // } catch (error) {
        //     console.error("[DB Update] Error updating last claimed milestone:", error);
        //     showToast('Chyba Ukládání', 'Nepodařilo se uložit postup milníkových odměn.', 'error');
        //     return false;
        // }
        // **********************************
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
        console.log(`[DB Update] Placeholder: Last claimed milestone update simulated.`);
        return true; // Assume success for placeholder
    }

    // --- Main Data Loading Orchestration ---
    async function loadDashboardData(user, profile) {
        if (!user || !profile) { showError("Chyba: Nelze načíst data bez profilu uživatele."); setLoadingState('all', false); return; }
        console.log("[MAIN] loadDashboardData: Start pro uživatele:", user.id);
        hideError();
        setLoadingState('stats', true);
        setLoadingState('activities', true);
        setLoadingState('notifications', true);
        setLoadingState('streakMilestones', true);
        // Monthly rewards loading state is handled when modal opens

        renderActivitySkeletons(5);
        renderMilestoneSkeletons();

        try {
            await checkAndUpdateLoginStreak();
            updateSidebarProfile(profile);

            console.log("[MAIN] loadDashboardData: Načítání statistik, aktivit, oznámení...");
            const results = await Promise.allSettled([
                fetchUserStats(user.id, profile),
                fetchRecentActivities(user.id, 5),
                fetchNotifications(user.id, 5)
            ]);
            console.log("[MAIN] loadDashboardData: Souběžné načítání dokončeno:", results);

            // Process stats
            if (results[0].status === 'fulfilled') { updateStatsCards(results[0].value || profile); }
            else { console.error("❌ Chyba při načítání statistik:", results[0].reason); updateStatsCards(profile); }
            setLoadingState('stats', false);

            // Process activities
            if (results[1].status === 'fulfilled') { renderActivities(results[1].value || []); }
            else { console.error("❌ Chyba při načítání aktivit:", results[1].reason); renderActivities(null); }
            setLoadingState('activities', false);

            // Process notifications
            if (results[2].status === 'fulfilled') { const { unreadCount, notifications } = results[2].value || { unreadCount: 0, notifications: [] }; renderNotifications(unreadCount, notifications); }
            else { console.error("❌ Chyba při načítání oznámení:", results[2].reason); renderNotifications(0, []); }
            setLoadingState('notifications', false);

            // Render Streak Milestones section (not the modal calendar yet)
            renderStreakMilestones();

            console.log("[MAIN] loadDashboardData: Všechna data zpracována.");

        } catch (error) {
             console.error('[MAIN] loadDashboardData: Zachycena hlavní chyba:', error);
             showError('Nepodařilo se kompletně načíst data nástěnky: ' + error.message);
             updateStatsCards(profile);
             renderActivities(null);
             renderNotifications(0, []);
             renderStreakMilestones(); // Render empty/error state
        } finally {
            setLoadingState('all', false); // Ensure all general loaders are off
            initTooltips();
        }
    }
    // --- END: Data Loading ---

    // --- START: UI Update Functions ---
    function updateSidebarProfile(profile) {
        console.log("[UI Update] Aktualizace sidebaru...");
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[UI Update] Elementy sidebaru nenalezeny."); return; }
        if (profile) {
            const firstName = profile.first_name ?? '';
            const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(profile);
            const avatarUrl = profile.avatar_url;
            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
            // Title Logic
            const selectedTitleKey = profile.selected_title;
            let displayTitle = 'Pilot';
            if (selectedTitleKey && allTitles && allTitles.length > 0) {
                const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) displayTitle = foundTitle.name;
            }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle));
            if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`;
            console.log("[UI Update] Sidebar aktualizován.");
        } else {
            console.warn("[UI Update] Chybí data profilu pro sidebar.");
            ui.sidebarName.textContent = "Pilot";
            ui.sidebarAvatar.textContent = '?';
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot';
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title');
            if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítejte!`;
        }
    }
    function updateStatsCards(stats) { console.log("[UI Update] Aktualizace karet statistik:", stats); const statElements = { progress: ui.progressCard?.querySelector('.stat-card-value'), progressChange: ui.progressCard?.querySelector('.stat-card-change'), points: ui.pointsCard?.querySelector('.stat-card-value'), pointsChange: ui.pointsCard?.querySelector('.stat-card-change'), streak: ui.streakCard?.querySelector('.stat-card-value'), streakLongest: ui.streakCard?.querySelector('.stat-card-change') }; const cards = [ui.progressCard, ui.pointsCard, ui.streakCard]; const displayError = (cardElement) => { if (cardElement) { const skel = cardElement.querySelector('.loading-skeleton'); const cont = cardElement.querySelector('.stat-card-content'); if(skel) skel.style.display='none'; if(cont) cont.style.visibility='hidden'; cardElement.classList.remove('loading'); /* Optional: Add error indicator */ } }; if (!stats) { cards.forEach(displayError); return; } cards.forEach(card => { if (card) { card.classList.remove('loading'); const skel = card.querySelector('.loading-skeleton'); const cont = card.querySelector('.stat-card-content'); if(skel) skel.style.display = 'none'; if(cont) cont.style.visibility = 'visible'; } }); /* ... (update values as before) ... */ }
    function renderActivities(activities) { if (!ui.activityList || !ui.activityListContainer || !ui.activityListEmptyState || !ui.activityListErrorState) { console.error("[Render Activities] Chybí UI elementy."); setLoadingState('activities', false); return; } ui.activityList.innerHTML = ''; ui.activityListEmptyState.style.display = 'none'; ui.activityListErrorState.style.display = 'none'; if (activities === null) { ui.activityListErrorState.style.display = 'block'; ui.activityListContainer.classList.remove('loading'); setLoadingState('activities', false); return; } if (activities.length === 0) { ui.activityListEmptyState.style.display = 'block'; ui.activityListContainer.classList.remove('loading'); setLoadingState('activities', false); return; } const fragment = document.createDocumentFragment(); activities.forEach(activity => { const visual = activityVisuals[activity.type?.toLowerCase()] || activityVisuals.default; const title = sanitizeHTML(activity.title || 'Neznámá aktivita'); const description = sanitizeHTML(activity.description || ''); const timeAgo = formatRelativeTime(activity.created_at); const item = document.createElement('div'); item.className = 'activity-item'; item.innerHTML = `<div class="activity-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="activity-content"><div class="activity-title">${title}</div><div class="activity-desc">${description}</div><div class="activity-time"><i class="far fa-clock"></i> ${timeAgo}</div></div>`; fragment.appendChild(item); }); ui.activityList.appendChild(fragment); ui.activityListContainer.classList.remove('loading'); console.log(`[Render Activities] Vykresleno ${activities.length} položek.`); setLoadingState('activities', false); }
    function renderActivitySkeletons(count = 5) { if (!ui.activityList || !ui.activityListContainer) return; ui.activityListContainer.classList.add('loading'); ui.activityList.innerHTML = ''; let skeletonHTML = '<div class="loading-placeholder">'; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="skeleton-activity-item"> <div class="skeleton icon-placeholder"></div> <div style="flex-grow: 1;"> <div class="skeleton activity-line"></div> <div class="skeleton activity-line text-short"></div> <div class="skeleton activity-line-short"></div> </div> </div>`; } skeletonHTML += '</div>'; ui.activityList.innerHTML = skeletonHTML; }
    function renderNotifications(count, notifications) { /* ... (keep as is) ... */ }
    function renderNotificationSkeletons(count = 2) { /* ... (keep as is) ... */ }

    // --- Render Monthly Calendar (Targets MODAL grid) ---
    function renderMonthlyCalendar() {
        const gridContainer = ui.modalMonthlyCalendarGrid;
        const modalTitleSpan = ui.modalCurrentMonthYearSpan;
        const emptyState = ui.modalMonthlyCalendarEmpty;

        if (!gridContainer || !modalTitleSpan || !emptyState) { console.error("Monthly calendar MODAL UI elements missing."); setLoadingState('monthlyRewards', false); return; }
        console.log("[RenderMonthly] Rendering calendar INSIDE MODAL...");
        setLoadingState('monthlyRewards', true);

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const today = now.getDate();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthString = getCurrentMonthYearString();
        const monthName = now.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });

        const claimedDaysThisMonth = currentProfile?.monthly_claims?.[monthString] || [];
        console.log(`[RenderMonthly] Claimed days for ${monthString}:`, claimedDaysThisMonth);

        modalTitleSpan.textContent = monthName;
        gridContainer.innerHTML = '';
        emptyState.style.display = 'none';
        const fragment = document.createDocumentFragment();
        let daysRendered = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.classList.add('calendar-day');
            dayElement.dataset.day = day;

            const isClaimed = claimedDaysThisMonth.includes(day);
            const isClaimable = (day === today && !isClaimed);
            const isUpcoming = day > today;
            const isMissed = day < today && !isClaimed;

            let rewardIconHtml = '<i class="fas fa-gift"></i>'; // Default gift
            let rewardText = `Den ${day}`; // Placeholder text

            // --- Placeholder: Add specific reward info if available ---
            // Example: Fetch reward info for 'day' from a config/DB
            // let rewardInfo = getMonthlyRewardConfigForDay(day);
            // if (rewardInfo) {
            //     rewardIconHtml = `<i class="${rewardInfo.icon || 'fas fa-gift'}"></i>`;
            //     rewardText = rewardInfo.name || `Odměna ${day}`;
            // }
            // --- End Placeholder ---

            dayElement.innerHTML = `
                <span class="day-number">${day}</span>
                <div class="reward-icon">${rewardIconHtml}</div>
                <span class="reward-text">${rewardText}</span>
                <span class="reward-status"></span>
                <button class="claim-button btn btn-sm" style="display: none;">
                    <i class="fas fa-check"></i> Vyzvednout
                </button>
            `;
            const statusSpan = dayElement.querySelector('.reward-status');
            const claimButton = dayElement.querySelector('.claim-button');

            if (isClaimed) {
                dayElement.classList.add('claimed');
                if (statusSpan) statusSpan.textContent = 'Získáno';
            } else if (isClaimable) {
                dayElement.classList.add('available');
                if (statusSpan) statusSpan.textContent = 'Dostupné';
                if (claimButton) {
                    claimButton.style.display = 'block';
                    claimButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        claimMonthlyReward(day, claimButton);
                    });
                }
            } else if (isUpcoming) {
                dayElement.classList.add('upcoming');
                if (statusSpan) statusSpan.textContent = 'Připravuje se';
            } else { // Missed
                dayElement.classList.add('missed');
                if (statusSpan) statusSpan.textContent = 'Zmeškáno';
            }
             if(day === today) { dayElement.classList.add('today'); }

            fragment.appendChild(dayElement);
            daysRendered++;
        }

        if (daysRendered > 0) {
            gridContainer.appendChild(fragment);
            gridContainer.style.display = 'grid';
        } else {
            emptyState.style.display = 'block';
            gridContainer.style.display = 'none';
        }

        ui.monthlyRewardModal?.querySelector('.modal-body')?.classList.remove('loading');
        console.log("[RenderMonthly] Modal calendar rendered.");
        setLoadingState('monthlyRewards', false);
        initTooltips();
    }

    function renderMonthlyCalendarSkeletons() {
        const gridContainer = ui.modalMonthlyCalendarGrid;
        if (!gridContainer) return;
        gridContainer.innerHTML = '';
        gridContainer.style.display = 'grid';
        const skeletonCount = 21;
        let skeletonHTML = '';
        for(let i=0; i < skeletonCount; i++) {
            skeletonHTML += '<div class="calendar-day skeleton"></div>';
        }
        gridContainer.innerHTML = skeletonHTML;
    }


    // --- Render Streak Milestones ---
    function renderStreakMilestones() {
        if (!ui.streakMilestonesList || !ui.streakMilestonesSection || !ui.currentStreakValueSpan) { console.error("Streak milestones UI elements missing."); setLoadingState('streakMilestones', false); return; }
        console.log("[RenderMilestones] Rendering streak milestones...");

        const currentStreak = currentProfile?.streak_days || 0;
        const lastClaimed = currentProfile?.last_milestone_claimed || 0;

        ui.currentStreakValueSpan.textContent = currentStreak;
        ui.streakMilestonesList.innerHTML = '';
        const fragment = document.createDocumentFragment();
        let milestonesToShow = 0;

        milestoneDays.forEach(milestoneDay => {
            const config = MILESTONE_REWARDS_CONFIG[milestoneDay];
            if (!config) return;

            const milestoneElement = document.createElement('div');
            milestoneElement.classList.add('milestone-item');
            milestoneElement.dataset.milestone = milestoneDay;

            const isClaimed = lastClaimed >= milestoneDay;
            const isClaimable = currentStreak >= milestoneDay && !isClaimed;
            const isLocked = currentStreak < milestoneDay;

            let statusHTML = '';
            let buttonHTML = '';

            if (isClaimed) {
                milestoneElement.classList.add('claimed');
                statusHTML = `<span class="milestone-status claimed"><i class="fas fa-check-circle"></i> Získáno</span>`;
            } else if (isClaimable) {
                milestoneElement.classList.add('available');
                statusHTML = `<span class="milestone-status available"><i class="fas fa-gift"></i> Dostupné!</span>`;
                buttonHTML = `<button class="claim-button btn btn-sm btn-success"><i class="fas fa-check"></i> Vyzvednout</button>`;
            } else { // Locked
                milestoneElement.classList.add('locked');
                const daysNeeded = milestoneDay - currentStreak;
                statusHTML = `<span class="milestone-status locked"><i class="fas fa-lock"></i> Ještě ${daysNeeded} ${daysNeeded === 1 ? 'den' : (daysNeeded < 5 ? 'dny' : 'dní')}</span>`;
            }

            milestoneElement.innerHTML = `
                <div class="milestone-icon">
                    <i class="fas ${config.icon || 'fa-award'}"></i>
                </div>
                <div class="milestone-info">
                    <h4 class="milestone-title">${sanitizeHTML(config.name)}</h4>
                    <p class="milestone-desc">${sanitizeHTML(config.description)}</p>
                    <div class="milestone-req">Požadavek: ${milestoneDay} dní série</div>
                </div>
                <div class="milestone-status-action">
                    ${statusHTML}
                    ${buttonHTML}
                </div>
            `;

            const claimButton = milestoneElement.querySelector('.claim-button');
            if (claimButton) {
                claimButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    claimMilestoneReward(milestoneDay, claimButton);
                });
            }

            fragment.appendChild(milestoneElement);
            milestonesToShow++;
        });

        ui.streakMilestonesList.appendChild(fragment);
        ui.streakMilestonesEmpty.style.display = milestonesToShow === 0 ? 'block' : 'none';
        ui.streakMilestonesSection.classList.remove('loading');
        console.log("[RenderMilestones] Milestones rendered.");
        setLoadingState('streakMilestones', false);
        initTooltips();
    }

     function renderMilestoneSkeletons() {
          if (!ui.streakMilestonesList) return;
          ui.streakMilestonesList.innerHTML = '';
          const skeletonCount = 3;
          let skeletonHTML = '';
          for(let i=0; i < skeletonCount; i++) {
              skeletonHTML += '<div class="milestone-item skeleton"></div>';
          }
          ui.streakMilestonesList.innerHTML = skeletonHTML;
      }
    // --- END: UI Update ---

    // --- START: Claim Reward Logic (Placeholders) ---
    async function claimMonthlyReward(day, buttonElement) {
        console.log(`[ClaimMonthly] Attempting claim for day ${day}`);
        if (!currentUser || !currentProfile || !supabase || isLoading.monthlyRewards) return;

        isLoading.monthlyRewards = true; // Prevent double clicks while processing
        if (buttonElement) {
            buttonElement.disabled = true;
            buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        const currentMonth = getCurrentMonthYearString();
        currentProfile.monthly_claims = currentProfile.monthly_claims || {};
        currentProfile.monthly_claims[currentMonth] = currentProfile.monthly_claims[currentMonth] || [];

        if (currentProfile.monthly_claims[currentMonth].includes(day)) {
            console.warn(`[ClaimMonthly] Day ${day} already claimed for ${currentMonth}.`);
            showToast('Info', 'Tato odměna již byla vyzvednuta.', 'info');
            isLoading.monthlyRewards = false;
            renderMonthlyCalendar();
            return;
        }

        // Update local state optimistically
        const updatedClaimsForMonth = [...currentProfile.monthly_claims[currentMonth], day];
        const updatedFullClaims = { ...currentProfile.monthly_claims, [currentMonth]: updatedClaimsForMonth };

        // --- Placeholder DB Update ---
        const dbSuccess = await updateMonthlyClaimsInDB(updatedFullClaims);
        // --- End Placeholder ---

        if (dbSuccess) {
             currentProfile.monthly_claims = updatedFullClaims; // Confirm local state change
             console.log(`[ClaimMonthly] Reward for day ${day} claimed successfully. New claims obj:`, currentProfile.monthly_claims);
             showToast('Odměna Získána!', `Získali jste odměnu za ${day}. den měsíce! (Placeholder)`, 'success');
             // **TODO (Future):** Grant actual reward (e.g., points) here
             // e.g., grantReward({ type: 'monthly', day: day });
         } else {
              showToast('Chyba', 'Nepodařilo se uložit vyzvednutí odměny.', 'error');
             // No need to rollback local state, as render will fix it based on failed save
         }

        isLoading.monthlyRewards = false;
        renderMonthlyCalendar(); // Re-render to show final state
    }

    async function claimMilestoneReward(milestoneDay, buttonElement) {
        console.log(`[ClaimMilestone] Attempting claim for milestone ${milestoneDay}`);
        if (!currentUser || !currentProfile || !supabase || isLoading.streakMilestones) return;

        isLoading.streakMilestones = true;
        if (buttonElement) {
             buttonElement.disabled = true;
             buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
         }

        if ((currentProfile?.last_milestone_claimed || 0) >= milestoneDay) {
            console.warn(`[ClaimMilestone] Milestone ${milestoneDay} already claimed.`);
            showToast('Info', 'Tato milníková odměna již byla vyzvednuta.', 'info');
            isLoading.streakMilestones = false;
            renderStreakMilestones();
            return;
        }

        const rewardConfig = MILESTONE_REWARDS_CONFIG[milestoneDay];
        const rewardName = rewardConfig?.name || `Odměna za ${milestoneDay} dní`;
        const previousMilestone = currentProfile.last_milestone_claimed;

        // --- Placeholder DB Update ---
        const dbSuccess = await updateLastMilestoneClaimedInDB(milestoneDay);
        // --- End Placeholder ---

        if(dbSuccess) {
             currentProfile.last_milestone_claimed = milestoneDay; // Update local state *after* DB success
             console.log(`[ClaimMilestone] Reward for ${milestoneDay} days claimed successfully. Last claimed now: ${currentProfile.last_milestone_claimed}`);
             showToast('Milník Dosažen!', `Získali jste: ${rewardName} (Placeholder)`, 'success');
             console.log(`Placeholder: Grant reward for milestone ${milestoneDay}:`, rewardConfig);
             // **TODO (Future):** Grant actual reward here
             // e.g., grantReward({ type: 'milestone', milestone: milestoneDay, config: rewardConfig });
         } else {
              showToast('Chyba', 'Nepodařilo se uložit vyzvednutí milníkové odměny.', 'error');
              // No need to rollback local state (last_milestone_claimed wasn't updated)
         }

        isLoading.streakMilestones = false;
        renderStreakMilestones(); // Re-render to show final state
    }
    // --- END: Claim Reward Logic ---

    // --- Notification Logic ---
    async function markNotificationRead(notificationId) { console.log("[FUNC] markNotificationRead: Označení ID:", notificationId); if (!currentUser || !notificationId || !supabase) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[FUNC] markNotificationRead: Úspěch pro ID:", notificationId); return true; } catch (error) { console.error("[FUNC] markNotificationRead: Chyba:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { console.log("[FUNC] markAllNotificationsRead: Start pro uživatele:", currentUser?.id); if (!currentUser || !ui.markAllReadBtn || !supabase) return; setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; ui.markAllReadBtn.textContent = 'MAŽU...'; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false); if (error) throw error; console.log("[FUNC] markAllNotificationsRead: Úspěch"); const { unreadCount, notifications } = await fetchNotifications(currentUser.id, 5); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[FUNC] markAllNotificationsRead: Chyba:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); } finally { setLoadingState('notifications', false); if(ui.markAllReadBtn) ui.markAllReadBtn.textContent = 'Vymazat vše'; } }
    // --- END: Notification Logic ---

    // --- START: Event Listeners Setup ---
    function setupUIEventListeners() {
        console.log("[SETUP] setupUIEventListeners: Start");
        // Sidebar/Menu
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
        if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);
        document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });
        // Core Actions
        if (ui.startPracticeBtn) ui.startPracticeBtn.addEventListener('click', () => { window.location.href = '/dashboard/procvicovani/main.html'; });
        // --- Use the CORRECT button ID for opening the modal ---
        if (ui.openMonthlyModalBtn) {
             ui.openMonthlyModalBtn.addEventListener('click', () => showModal('monthly-reward-modal'));
        } else { console.warn("Button #open-monthly-modal-btn not found."); }
        // --- End Corrected Button ID ---
        if (ui.refreshDataBtn) { ui.refreshDataBtn.addEventListener('click', async () => { /* ... (keep refresh logic) ... */ }); }
        // Notifications
        if(ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
        if(ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); }
        if(ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { /* ... (keep notification item logic) ... */ }); }
        document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown?.classList.remove('active'); } });
        // Modal Listeners
        if (ui.closeMonthlyModalBtn) {
             ui.closeMonthlyModalBtn.addEventListener('click', () => hideModal('monthly-reward-modal'));
        } else { console.warn("Close button for monthly modal not found."); }
        if (ui.monthlyRewardModal) {
            ui.monthlyRewardModal.addEventListener('click', (event) => { if (event.target === ui.monthlyRewardModal) { hideModal('monthly-reward-modal'); } });
        } else { console.warn("Monthly reward modal element not found."); }
        // Other
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        if (ui.mainContent) ui.mainContent.addEventListener('scroll', initHeaderScrollDetection, { passive: true });

        console.log("[SETUP] Event listeners set up.");
    }
    // --- END: Event Listeners ---

    // --- START THE APP ---
    async function initializeApp() {
        console.log("[INIT Dashboard] initializeApp: Start v22.1 - Waiting for Supabase");

        // --- Wait for Supabase library ---
        const waitForSupabase = new Promise((resolve, reject) => {
            const maxAttempts = 20; // Wait up to 10 seconds
            let attempts = 0;
            const intervalId = setInterval(() => {
                attempts++;
                if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
                    console.log(`[INIT Dashboard] Supabase library found after ${attempts} attempts.`);
                    clearInterval(intervalId);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.error("[INIT Dashboard] Supabase library not found after waiting. Aborting.");
                    clearInterval(intervalId);
                    reject(new Error("Knihovna Supabase nebyla nalezena včas."));
                } else {
                     console.log(`[INIT Dashboard] Waiting for Supabase library... (Attempt ${attempts}/${maxAttempts})`);
                }
            }, 500);
        });

        try {
            await waitForSupabase;
        } catch (waitError) {
             if (typeof showError === 'function') { showError(waitError.message, true); }
             else { alert(`Kritická chyba: ${waitError.message}`); }
             if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if(ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
             return;
        }
        // --- End Wait ---

        if (!initializeSupabase()) { console.error("[INIT Dashboard] Supabase initialization function failed after wait. Aborting."); return; }

        applyInitialSidebarState();
        setupUIEventListeners();

        if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; }
        if (ui.mainContent) ui.mainContent.style.display = 'none';

        try {
            console.log("[INIT Dashboard] Checking auth session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;
                console.log(`[INIT Dashboard] User authenticated (ID: ${currentUser.id}). Loading profile and titles...`);

                const [profileResult, titlesResult] = await Promise.allSettled([ fetchUserProfile(currentUser.id), fetchTitles() ]);

                if (profileResult.status === 'fulfilled' && profileResult.value) { currentProfile = profileResult.value; console.log("[INIT Dashboard] Profile loaded:", currentProfile); }
                else { console.warn("[INIT Dashboard] Profile not found or fetch failed, attempting to create default..."); currentProfile = await createDefaultProfile(currentUser.id, currentUser.email); if (!currentProfile) throw new Error("Nepodařilo se vytvořit/načíst profil uživatele."); console.log("[INIT Dashboard] Default profile created/retrieved."); }

                if (titlesResult.status === 'fulfilled') { allTitles = titlesResult.value || []; console.log("[INIT Dashboard] Titles loaded:", allTitles.length); }
                else { console.warn("[INIT Dashboard] Failed to load titles:", titlesResult.reason); allTitles = []; }

                updateSidebarProfile(currentProfile);
                initHeaderScrollDetection();
                updateCopyrightYear();

                await loadDashboardData(currentUser, currentProfile);

                if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
                if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
                initMouseFollower();
                initTooltips();

                console.log("✅ [INIT Dashboard] Page fully loaded and initialized.");

            } else { console.log('[INIT Dashboard] V sezení není uživatel, přesměrování.'); window.location.href = '/auth/index.html'; }
        } catch (error) { console.error("❌ [INIT Dashboard] Kritická chyba inicializace:", error); if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE STRÁNKU.</p>`; } else { if(typeof showError === 'function') showError(`Chyba inicializace: ${error.message}`, true); } if (ui.mainContent) ui.mainContent.style.display = 'none'; if(typeof setLoadingState === 'function') setLoadingState('all', false); }
    }

    document.addEventListener('DOMContentLoaded', initializeApp);

})(); // End of IIFE