// Using an immediately invoked function expression (IIFE)
(function() {
    // --- START: Initialization and Configuration ---
    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    const SIDEBAR_STATE_KEY = 'sidebarState'; // Ключ для localStorage
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let currentUserStats = null;
    let userBadges = [];
    let allBadges = [];
    let allTitles = [];
    let allDecorations = []; // <<< NEW: To store available avatar decorations
    let leaderboardData = [];
    let currentLeaderboardPeriod = 'overall';
    let isLoading = {
        stats: false,
        userBadges: false,
        availableBadges: false,
        leaderboard: false,
        recentBadges: false,
        notifications: false,
        titleShop: false,
        avatarDecorations: false // <<< NEW: Loading state for avatar decorations shop
    };
    const NOTIFICATION_FETCH_LIMIT = 5;

    // DOM Cache (добавлены элементы для магазина украшений)
    const ui = {
        initialLoader: document.getElementById('initial-loader'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        mainContent: document.getElementById('main-content'),
        sidebar: document.getElementById('sidebar'),
        mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
        sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
        sidebarAvatar: document.getElementById('sidebar-avatar'),
        // <<< NEW: Wrapper for sidebar avatar >>>
        sidebarAvatarWrapper: document.querySelector('.sidebar .user-profile .avatar-wrapper'),
        sidebarName: document.getElementById('sidebar-name'),
        sidebarRole: document.querySelector('.sidebar .user-role'), // Corrected selector
        currentYearSidebar: document.getElementById('currentYearSidebar'),
        pageTitle: document.getElementById('page-title'),
        refreshDataBtn: document.getElementById('refresh-data-btn'),
        notificationBell: document.getElementById('notification-bell'),
        notificationCount: document.getElementById('notification-count'),
        notificationsDropdown: document.getElementById('notifications-dropdown'),
        notificationsList: document.getElementById('notifications-list'),
        noNotificationsMsg: document.getElementById('no-notifications-msg'),
        markAllReadBtn: document.getElementById('mark-all-read'),
        globalError: document.getElementById('global-error'),
        offlineBanner: document.getElementById('offline-banner'),
        toastContainer: document.getElementById('toast-container'),
        achievementsContent: document.getElementById('achievements-content'),
        achievementStatsContainer: document.getElementById('achievement-stats-container'),
        badgesCount: document.getElementById('badges-count'),
        badgesChange: document.getElementById('badges-change'),
        pointsCount: document.getElementById('points-count'),
        pointsChange: document.getElementById('points-change'),
        streakDays: document.getElementById('streak-days'),
        streakChange: document.getElementById('streak-change'),
        rankValue: document.getElementById('rank-value'),
        rankChange: document.getElementById('rank-change'),
        totalUsers: document.getElementById('total-users'),
        userBadgesContainer: document.getElementById('user-badges-container'),
        badgeGrid: document.getElementById('badge-grid'),
        emptyBadges: document.getElementById('empty-badges'),
        availableBadgesContainer: document.getElementById('available-badges-container'),
        availableBadgesGrid: document.getElementById('available-badges-grid'),
        emptyAvailableBadges: document.getElementById('empty-available-badges'),
        leaderboardSection: document.getElementById('leaderboard-section'),
        leaderboardContainer: document.getElementById('leaderboard-container'),
        leaderboardSkeleton: document.querySelector('#leaderboard-container .leaderboard-skeleton'),
        leaderboardHeaderElement: document.querySelector('.leaderboard-header'),
        leaderboardTableContainer: document.querySelector('.leaderboard-table-container'),
        leaderboardBody: document.getElementById('leaderboard-body'),
        leaderboardEmpty: document.getElementById('leaderboard-empty'),
        recentAchievementsSection: document.getElementById('recent-achievements-section'),
        recentAchievementsList: document.getElementById('recent-achievements-list'),
        currentYearFooter: document.getElementById('currentYearFooter'),
        mouseFollower: document.getElementById('mouse-follower'),
        titleShopContainer: document.getElementById('title-shop-container'),
        shopUserCredits: document.getElementById('shop-user-credits'),
        titleShopLoading: document.getElementById('title-shop-loading'),
        titleShopGrid: document.getElementById('title-shop-grid'),
        titleShopEmpty: document.getElementById('title-shop-empty'),
        // <<< NEW: Avatar Decorations Shop Elements >>>
        avatarDecorationsShop: document.getElementById('avatar-decorations-shop'),
        shopDecorCredits: document.getElementById('shop-decor-credits'),
        avatarDecorationsLoading: document.getElementById('avatar-decorations-loading'),
        avatarDecorationsGrid: document.getElementById('avatar-decorations-grid'),
        avatarDecorationsEmpty: document.getElementById('avatar-decorations-empty'),
        // <<< END NEW >>>
        sidebarToggleBtn: document.getElementById('sidebar-toggle-btn')
    };

    const badgeVisuals = { math: { icon: 'fa-square-root-alt', gradient: 'var(--gradient-math)' }, language: { icon: 'fa-language', gradient: 'var(--gradient-lang)' }, streak: { icon: 'fa-fire', gradient: 'var(--gradient-streak)' }, special: { icon: 'fa-star', gradient: 'var(--gradient-special)' }, points: { icon: 'fa-coins', gradient: 'var(--gradient-warning)' }, exercises: { icon: 'fa-pencil-alt', gradient: 'var(--gradient-success)' }, test: { icon: 'fa-vial', gradient: 'var(--gradient-info)' }, default: { icon: 'fa-medal', gradient: 'var(--gradient-locked)' } };
    const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

    // --- Вспомогательные функции ---
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; const retryBtn = document.getElementById('global-retry-btn'); if (retryBtn) { retryBtn.addEventListener('click', handleGlobalRetry); } } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatDate(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) return '-'; const optionsDate = { day: 'numeric', month: 'numeric', year: 'numeric' }; return d.toLocaleDateString('cs-CZ', optionsDate); } catch (e) { console.error("Chyba formátování data:", dateString, e); return '-'; } }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function setLoadingState(section, isLoadingFlag) {
        const sectionsMap = {
             stats: { container: ui.achievementStatsContainer, childrenSelector: '.stat-card' },
             userBadges: { container: ui.userBadgesContainer, emptyEl: ui.emptyBadges, contentEl: ui.badgeGrid },
             availableBadges: { container: ui.availableBadgesContainer, emptyEl: ui.emptyAvailableBadges, contentEl: ui.availableBadgesGrid },
             leaderboard: { container: ui.leaderboardContainer, emptyEl: ui.leaderboardEmpty, contentEl: ui.leaderboardTableContainer, skeletonEl: ui.leaderboardSkeleton },
             recentBadges: { container: ui.recentAchievementsSection },
             notifications: { container: ui.notificationsList, emptyEl: ui.noNotificationsMsg },
             titleShop: { container: ui.titleShopContainer, emptyEl: ui.titleShopEmpty, contentEl: ui.titleShopGrid, loadingEl: ui.titleShopLoading },
             avatarDecorations: { container: ui.avatarDecorationsShop, emptyEl: ui.avatarDecorationsEmpty, contentEl: ui.avatarDecorationsGrid, loadingEl: ui.avatarDecorationsLoading } // <<< NEW
         };
         const sectionsToUpdate = section === 'all' ? Object.keys(sectionsMap) : [section];
         sectionsToUpdate.forEach(secKey => {
            if (!sectionsMap[secKey] || isLoading[secKey] === isLoadingFlag) return;
            isLoading[secKey] = isLoadingFlag;
            console.log(`[SetLoading] Sekce: ${secKey}, isLoading: ${isLoadingFlag}`);
            const config = sectionsMap[secKey];

            if (config.container) config.container.classList.toggle('loading', isLoadingFlag);
            if (config.childrenSelector) {
                config.container?.querySelectorAll(config.childrenSelector).forEach(child => {
                    child?.classList.toggle('loading', isLoadingFlag);
                });
            }

            if (secKey === 'leaderboard') {
                if (config.skeletonEl) config.skeletonEl.style.display = isLoadingFlag ? 'block' : 'none';
                if (config.contentEl) config.contentEl.style.visibility = isLoadingFlag ? 'hidden' : 'visible';
                if (config.emptyEl) config.emptyEl.style.display = 'none';
                if (ui.leaderboardHeaderElement) ui.leaderboardHeaderElement.style.visibility = isLoadingFlag ? 'hidden' : 'visible';
            } else if (secKey === 'titleShop' || secKey === 'avatarDecorations') { // <<< UPDATED
                if (config.loadingEl) config.loadingEl.style.display = isLoadingFlag ? 'flex' : 'none';
                if (config.contentEl) config.contentEl.style.display = isLoadingFlag ? 'none' : 'grid';
                if (config.emptyEl) config.emptyEl.style.display = 'none';
            } else if (secKey === 'notifications') {
                if (isLoadingFlag && config.container) renderNotificationSkeletons(2);
                if (config.emptyEl) config.emptyEl.style.display = isLoadingFlag ? 'none' : (config.container?.innerHTML.trim() === '' ? 'block' : 'none');
            } else {
                if (isLoadingFlag) {
                    if (config.contentEl) config.contentEl.style.display = 'none';
                    if (config.emptyEl) config.emptyEl.style.display = 'none';
                    // Optionally render specific skeletons here
                    if (secKey === 'userBadges' && config.contentEl) renderBadgeSkeletons(config.contentEl);
                    if (secKey === 'availableBadges' && config.contentEl) renderAvailableBadgeSkeletons(config.contentEl);
                } else {
                    // After loading, let render functions handle visibility
                    if (config.contentEl && !config.contentEl.hasChildNodes() && config.emptyEl) {
                        config.emptyEl.style.display = 'block'; // Show empty if no content rendered
                    }
                }
            }

            // Notifications bell specific state
            if (secKey === 'notifications' && ui.notificationBell) {
                ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                if (ui.markAllReadBtn) {
                    const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                    ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
                }
            }
        });
    }
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); };
    const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 30); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl && mainEl.scrollTop > 30) document.body.classList.add('scrolled'); };
    const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
    const initTooltips = () => { console.log("[Tooltips] Initializing..."); try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip.tooltipstered').each(function() { try { window.jQuery(this).tooltipster('destroy'); } catch (e) { console.warn('Error destroying tooltip', e); } }); window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); console.log("[Tooltips] Tooltips initialized/re-initialized."); } else { console.warn("[Tooltips] jQuery or Tooltipster not loaded/ready."); } } catch (e) { console.error("[Tooltips] Error initializing Tooltipster:", e); } };
    // --- Конец вспомогательных функций ---

    // --- Функции для боковой панели ---
    function toggleSidebar() { if (!ui.sidebarToggleBtn) return; try { document.body.classList.toggle('sidebar-collapsed'); const isCollapsed = document.body.classList.contains('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) { icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; } ui.sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.setAttribute('title', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); } catch (error) { console.error("[Sidebar Toggle] Error:", error); showToast('Chyba UI', 'Nepodařilo se přepnout boční panel.', 'error'); } }
    function applyInitialSidebarState() { if (!ui.sidebarToggleBtn) return; try { const savedState = localStorage.getItem(SIDEBAR_STATE_KEY); const shouldBeCollapsed = savedState === 'collapsed'; if (shouldBeCollapsed) document.body.classList.add('sidebar-collapsed'); else document.body.classList.remove('sidebar-collapsed'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) { icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; } ui.sidebarToggleBtn.setAttribute('aria-label', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.setAttribute('title', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); } catch (error) { console.error("[Sidebar State] Error applying initial state:", error); document.body.classList.remove('sidebar-collapsed'); } }
    // --- Конец функций для боковой панели ---

    // --- Инициализация Supabase ---
    function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Knihovna Supabase nebyla správně načtena."); } supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); if (!supabase) throw new Error("Vytvoření klienta Supabase selhalo."); console.log('[Supabase] Klient úspěšně inicializován.'); window.supabase.client = supabase; return true; } catch (error) { console.error('[Supabase] Inicializace selhala:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); window.supabase.client = null; supabase = null; return false; } }

    // --- Функции загрузки данных ---
    async function fetchUserProfile(userId) {
        if (!supabase || !userId) return null;
        console.log(`[Profile] Fetching profile for user ID: ${userId}`);
        try {
            // <<< UPDATED: Fetch decoration fields >>>
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, username, email, avatar_url, points, streak_days, badges_count, level, completed_exercises, created_at, purchased_titles, selected_title, purchased_decorations, selected_decoration') // Added decoration fields
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') { throw error; }
            if (!profile) { console.warn(`[Profile] Profile for user ${userId} not found. Returning null.`); return null; }
            // <<< NEW: Ensure new fields are initialized if null >>>
            profile.purchased_titles = profile.purchased_titles || [];
            profile.purchased_decorations = profile.purchased_decorations || [];
            console.log("[Profile] Profile data fetched successfully.");
            return profile;
        } catch (error) {
            console.error('[Profile] Caught exception fetching profile:', error);
            showToast('Chyba', 'Nepodařilo se načíst data profilu.', 'error');
            return null;
        }
    }
    async function fetchUserStats(userId) { /* (Keep existing - no changes needed for decorations) */ if (!supabase || !userId) return null; try { const { data: statsData, error } = await supabase .from('user_stats') .select('progress, progress_weekly, points_weekly, streak_longest, completed_tests') .eq('user_id', userId) .maybeSingle(); if (error) return null; return statsData || {}; } catch (error) { console.error("[Stats Fetch] Caught exception fetching user_stats:", error); showToast('Chyba', 'Nepodařilo se načíst statistiky uživatele.', 'error'); return null; } }
    async function fetchAllBadgesDefinition() { /* (Keep existing) */ if (!supabase) return []; try { const { data, error } = await supabase.from('badges').select('*').order('id'); if (error) throw error; return data || []; } catch (error) { console.error("[Badges] Error fetching definitions:", error); return []; } }
    async function fetchUserEarnedBadges(userId) { /* (Keep existing) */ if (!supabase || !userId) return []; try { const { data, error } = await supabase .from('user_badges') .select(`badge_id, earned_at, badge:badges!inner (id, title, description, type, icon, requirements, points)`) .eq('user_id', userId) .order('earned_at', { ascending: false }); if (error) throw error; return data || []; } catch (error) { console.error("[UserBadges] Error fetching earned badges:", error); return []; } }
    async function fetchTitleShopData() { /* (Keep existing) */ if (!supabase) return []; try { const { data, error } = await supabase .from('title_shop') .select('*') .eq('is_available', true) .order('cost', { ascending: true }); if (error) throw error; return data || []; } catch (error) { console.error("[TitleShop] Error fetching available titles:", error); showError("Nepodařilo se načíst nabídku titulů v obchodě."); return []; } }
    async function fetchLeaderboardData(filter = 'points', period = 'overall') { /* (Keep existing) */ if (!supabase) return []; let orderColumn = 'points'; let ascendingOrder = false; if (filter === 'badges') { orderColumn = 'badges_count'; } else if (filter === 'streak') { orderColumn = 'rank'; ascendingOrder = true; } try { const { data, error } = await supabase .from('leaderboard') .select(`rank, user_id, points, badges_count, profile:profiles!inner ( id, first_name, last_name, username, avatar_url, level, streak_days, selected_decoration )`) // <<< ADDED selected_decoration
            .eq('period', period) .order(orderColumn, { ascending: ascendingOrder }) .limit(10); if (error) throw error; let rankedData = data || []; rankedData = rankedData.map((entry, index) => ({ ...entry, calculated_rank: index + 1 })); return rankedData; } catch (error) { console.error(`[Leaderboard] Exception during fetch (sort: ${filter}, period: ${period}):`, error); return []; } }
    async function fetchNotifications(userId, limit = 5) { /* (Keep existing) */ if (!supabase || !userId) return { unreadCount: 0, notifications: [] }; try { const { data, error, count } = await supabase .from('user_notifications') .select('*', { count: 'exact' }) .eq('user_id', userId) .eq('is_read', false) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); return { unreadCount: 0, notifications: [] }; } }

    // <<< NEW: Fetch Avatar Decorations >>>
    async function fetchAvatarDecorations() {
        if (!supabase) return [];
        console.log("[Decorations] Fetching available decorations...");
        setLoadingState('avatarDecorations', true);
        try {
            // Assuming table name is 'avatar_decorations' similar to 'title_shop'
            const { data, error } = await supabase
                .from('avatar_decorations')
                .select('*') // Select all columns: id, decoration_key, name, description, cost, icon_url, css_class, is_available
                .eq('is_available', true) // Only show available ones
                .order('cost', { ascending: true }); // Order by price

            if (error) throw error;
            allDecorations = data || []; // Store globally
            console.log("[Decorations] Fetched decorations:", allDecorations);
            return allDecorations;
        } catch (error) {
            console.error("[Decorations] Error fetching available decorations:", error);
            showError("Nepodařilo se načíst nabídku vylepšení avatarů.");
            return [];
        } finally {
             setLoadingState('avatarDecorations', false); // Set loading state in the UI handler
        }
    }
    // <<< END NEW >>>

    // <<< UPDATED: loadAllAwardData to include decorations >>>
    async function loadAllAwardData() {
        if (!currentUser || !supabase || !currentProfile) {
            showError("Nelze načíst data: Chybí informace o uživateli nebo spojení.", true);
            return;
        }
        console.log("🔄 [LoadAwards] Starting data fetch (including decorations)...");
        hideError();
        setLoadingState('all', true);
        renderLeaderboardSkeleton();
        renderTitleShopSkeleton(); // Render title shop skeleton
        renderAvatarDecorationsSkeleton(); // <<< NEW: Render decoration shop skeleton
        try {
            const results = await Promise.allSettled([
                fetchAllBadgesDefinition(),
                fetchUserEarnedBadges(currentUser.id),
                fetchLeaderboardData('points', currentLeaderboardPeriod),
                fetchUserStats(currentUser.id), // Assuming this provides weekly points etc.
                fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT),
                fetchTitleShopData(), // Fetch titles for the shop
                fetchAvatarDecorations() // <<< NEW: Fetch decorations
            ]);
            const [ badgesDefResult, userBadgesResult, leaderboardResult, statsResult, notificationsResult, titlesResult, decorationsResult ] = results; // <<< Added decorationsResult

            // Process results (handle potential errors)
            allBadges = badgesDefResult.status === 'fulfilled' ? badgesDefResult.value : [];
            userBadges = userBadgesResult.status === 'fulfilled' ? userBadgesResult.value : [];
            leaderboardData = leaderboardResult.status === 'fulfilled' ? leaderboardResult.value : [];
            currentUserStats = statsResult.status === 'fulfilled' ? statsResult.value || {} : {};
            const fetchedNotifications = notificationsResult.status === 'fulfilled' ? notificationsResult.value : { unreadCount: 0, notifications: [] };
            allTitles = titlesResult.status === 'fulfilled' ? titlesResult.value : [];
            allDecorations = decorationsResult.status === 'fulfilled' ? decorationsResult.value : []; // <<< NEW

            // Log errors if any fetches failed
            results.forEach((result, index) => {
                 if (result.status === 'rejected') {
                     const source = ['BadgesDef', 'UserBadges', 'Leaderboard', 'UserStats', 'Notifications', 'Titles', 'Decorations'][index]; // <<< Added Decorations
                     console.error(`❌ Error fetching ${source}:`, result.reason);
                     showError(`Nepodařilo se načíst data pro sekci: ${source}.`);
                 }
             });

            // Render UI sections with potentially partial data if some fetches failed
            updateStatsCards(currentProfile, currentUserStats, userBadges, leaderboardData);
            renderUserBadges(userBadges);
            renderAvailableBadges(allBadges, userBadges, currentProfile); // Pass profile for progress check
            renderRecentBadges(userBadges);
            renderLeaderboard(leaderboardData);
            renderNotifications(fetchedNotifications.unreadCount, fetchedNotifications.notifications);
            renderTitleShop(allTitles, currentProfile); // Pass profile for purchase checks
            renderAvatarDecorationsShop(allDecorations, currentProfile); // <<< NEW

        } catch (error) {
            console.error("❌ Unexpected error in loadAllAwardData during processing:", error);
            showError(`Nastala neočekávaná chyba při zpracování dat: ${error.message}`, true);
            // Render empty states on major failure
            updateStatsCards(null, null, [], []);
            renderUserBadges([]);
            renderAvailableBadges([], [], null);
            renderRecentBadges([]);
            renderLeaderboard([]);
            renderNotifications(0, []);
            renderTitleShop([], null);
            renderAvatarDecorationsShop([], null); // <<< NEW

        } finally {
            setLoadingState('all', false);
            initTooltips(); // Re-initialize after rendering everything
        }
    }
    // <<< END UPDATED >>>

    // --- Функции обновления UI ---
    function updateSidebarProfile(profile, titlesData = allTitles) {
         console.log("[UI Update] Aktualizace sidebaru...");
         if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarRole) { console.warn("[UI Update] Elementy sidebaru nenalezeny."); return; }
         if (profile) {
             const firstName = profile.first_name ?? '';
             const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot';
             ui.sidebarName.textContent = sanitizeHTML(displayName);
             const initials = getInitials(profile);
             const avatarUrl = profile.avatar_url;
             // <<< UPDATED: Include avatar wrapper and decoration key >>>
             const selectedDecoration = profile.selected_decoration || '';
             if (ui.sidebarAvatarWrapper) { // Update wrapper's data attribute
                 ui.sidebarAvatarWrapper.dataset.decorationKey = selectedDecoration;
                 ui.sidebarAvatarWrapper.className = `avatar-wrapper ${selectedDecoration || ''}`; // Apply class directly
             }
             ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
             // <<< END UPDATED >>>
             const selectedTitleKey = profile.selected_title;
             let displayTitle = 'Pilot';
             if (selectedTitleKey && titlesData && titlesData.length > 0) {
                 const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey);
                 if (foundTitle && foundTitle.name) { displayTitle = foundTitle.name; }
             }
             ui.sidebarRole.textContent = sanitizeHTML(displayTitle);
             ui.sidebarRole.setAttribute('title', sanitizeHTML(displayTitle));
             console.log("[UI Update] Sidebar aktualizován.");
         } else {
             console.warn("[UI Update] Chybí data profilu pro sidebar.");
             ui.sidebarName.textContent = "Pilot";
             ui.sidebarAvatar.textContent = '?';
             if (ui.sidebarRole) ui.sidebarRole.textContent = 'Pilot';
             if (ui.sidebarRole) ui.sidebarRole.removeAttribute('title');
             if (ui.sidebarAvatarWrapper) { ui.sidebarAvatarWrapper.dataset.decorationKey = ''; ui.sidebarAvatarWrapper.className = 'avatar-wrapper'; } // Reset wrapper
         }
     }
    function updateStatsCards(profileData, statsData, earnedBadgesData, leaderboard) { /* (Keep existing) */ const getStatValue = (value) => (value !== null && value !== undefined) ? value : '-'; const formatChange = (value, unit = '', iconUp = 'fa-arrow-up', iconDown = 'fa-arrow-down', iconNone = 'fa-minus') => { if (value === null || value === undefined || value === 0) return `<i class="fas ${iconNone}"></i> --`; const sign = value > 0 ? '+' : ''; const icon = value > 0 ? iconUp : iconDown; const cssClass = value > 0 ? 'positive' : 'negative'; return `<span class="${cssClass}"><i class="fas ${icon}"></i> ${sign}${value}${unit}</span>`; }; const statElements = { badgesCount: ui.badgesCount, badgesChange: ui.badgesChange, pointsCount: ui.pointsCount, pointsChange: ui.pointsChange, streakDays: ui.streakDays, streakChange: ui.streakChange, rankValue: ui.rankValue, rankChange: ui.rankChange, totalUsers: ui.totalUsers }; if (!profileData) { Object.values(statElements).forEach(el => { if(el && el.id !== 'total-users') el.textContent = '-'; }); if(statElements.badgesChange) statElements.badgesChange.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ERR`; if(statElements.pointsChange) statElements.pointsChange.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ERR`; if(statElements.streakChange) statElements.streakChange.textContent = `MAX: - dní`; if(statElements.rankChange) statElements.rankChange.innerHTML = `<i class="fas fa-users"></i> z ? pilotů`; return; } const badgesTotal = earnedBadgesData?.length ?? profileData.badges_count ?? 0; if(statElements.badgesCount) statElements.badgesCount.textContent = getStatValue(badgesTotal); if(statElements.badgesChange) statElements.badgesChange.innerHTML = `<i class="fas fa-sync-alt"></i> Aktualizováno`; if(statElements.pointsCount) statElements.pointsCount.textContent = getStatValue(profileData.points); const pointsWeekly = statsData?.points_weekly; if(statElements.pointsChange) statElements.pointsChange.innerHTML = formatChange(pointsWeekly, ' kr.'); if(statElements.streakDays) statElements.streakDays.textContent = getStatValue(profileData.streak_days); const longestStreak = statsData?.streak_longest ?? profileData.streak_days ?? '-'; if(statElements.streakChange) statElements.streakChange.textContent = `MAX: ${getStatValue(longestStreak)} dní`; const userRankEntry = leaderboard?.find(u => u.user_id === currentUser?.id); const rank = userRankEntry?.calculated_rank ?? '-'; const total = leaderboard?.length ?? 0; if(statElements.rankValue) statElements.rankValue.textContent = getStatValue(rank); if(statElements.rankChange && statElements.totalUsers) { statElements.rankChange.innerHTML = `<i class="fas fa-users"></i> z TOP ${total > 0 ? total : '?'} pilotů`; } }
    function renderUserBadges(earnedBadges) { /* (Keep existing) */ if (!ui.badgeGrid || !ui.emptyBadges || !ui.userBadgesContainer) return; setLoadingState('userBadges', false); ui.badgeGrid.innerHTML = ''; if (!earnedBadges || earnedBadges.length === 0) { ui.emptyBadges.style.display = 'block'; ui.badgeGrid.style.display = 'none'; return; } ui.emptyBadges.style.display = 'none'; ui.badgeGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); earnedBadges.forEach((ub, index) => { const badge = ub.badge; if (!badge) return; const badgeType = badge.type?.toLowerCase() || 'default'; const visual = badgeVisuals[badgeType] || badgeVisuals.default; const badgeElement = document.createElement('div'); badgeElement.className = 'badge-card card'; badgeElement.setAttribute('data-animate', ''); badgeElement.style.setProperty('--animation-order', index); badgeElement.innerHTML = `<div class="badge-icon ${badgeType}" style="background: ${visual.gradient};"><i class="fas ${visual.icon}"></i></div><h3 class="badge-title">${sanitizeHTML(badge.title)}</h3><p class="badge-desc">${sanitizeHTML(badge.description || '')}</p><div class="badge-date"><i class="far fa-calendar-alt"></i> ${formatDate(ub.earned_at)}</div>`; fragment.appendChild(badgeElement); }); ui.badgeGrid.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
    function renderAvailableBadges(allBadgesDef, userEarnedBadges, userProfileData) { /* (Keep existing) */ if (!ui.availableBadgesGrid || !ui.emptyAvailableBadges || !ui.availableBadgesContainer) { setLoadingState('availableBadges', false); return; } setLoadingState('availableBadges', false); ui.availableBadgesGrid.innerHTML = ''; const earnedIds = new Set(userEarnedBadges.map(ub => ub.badge_id)); const available = allBadgesDef.filter(b => !earnedIds.has(b.id)); if (available.length === 0) { ui.emptyAvailableBadges.style.display = 'block'; ui.availableBadgesGrid.style.display = 'none'; return; } ui.emptyAvailableBadges.style.display = 'none'; ui.availableBadgesGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); available.forEach((badge, index) => { const badgeType = badge.type?.toLowerCase() || 'default'; const visual = badgeVisuals[badgeType] || badgeVisuals.default; let progress = 0; let progressText = '???'; if (badge.requirements && typeof badge.requirements === 'object' && userProfileData) { const req = badge.requirements; let current = 0; let target = parseInt(req.target, 10) || 1; try { switch (req.type) { case 'points_earned': current = userProfileData.points || 0; progressText = `${current}/${target} KR`; break; case 'streak_days': current = userProfileData.streak_days || 0; progressText = `${current}/${target} dní`; break; case 'exercises_completed': current = userProfileData.completed_exercises || 0; progressText = `${current}/${target} cv.`; break; case 'level_reached': current = userProfileData.level || 1; progressText = `${current}/${target} úr.`; break; default: progressText = '?/?'; } if (target > 0) { progress = Math.min(100, Math.max(0, Math.round((current / target) * 100))); } } catch(e) { progressText = 'Chyba'; } } else { progressText = 'Nespec.'; } const badgeElement = document.createElement('div'); badgeElement.className = 'achievement-card card'; badgeElement.setAttribute('data-animate', ''); badgeElement.style.setProperty('--animation-order', index); badgeElement.innerHTML = `<div class="achievement-icon ${badgeType}" style="background: ${visual.gradient};"><i class="fas ${visual.icon}"></i></div><div class="achievement-content"><h3 class="achievement-title">${sanitizeHTML(badge.title)}</h3><p class="achievement-desc">${sanitizeHTML(badge.description || '')}</p><div class="progress-container"><div class="progress-bar"><div class="progress-fill" style="width: ${progress}%; background: ${visual.gradient};"></div></div><div class="progress-stats">${progress}% (${progressText})</div></div></div>`; fragment.appendChild(badgeElement); }); ui.availableBadgesGrid.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
    function renderLeaderboardSkeleton() { /* (Keep existing) */ if (!ui.leaderboardBody || !ui.leaderboardSkeleton) return; ui.leaderboardSkeleton.style.display = 'block'; ui.leaderboardBody.innerHTML = ''; if(ui.leaderboardTableContainer) ui.leaderboardTableContainer.style.visibility = 'hidden'; if(ui.leaderboardHeaderElement) ui.leaderboardHeaderElement.style.visibility = 'hidden'; if(ui.leaderboardEmpty) ui.leaderboardEmpty.style.display = 'none'; }
    function renderTitleShopSkeleton() { /* (Keep existing) */ if (!ui.titleShopGrid) return; ui.titleShopGrid.innerHTML = ''; let skeletonHTML = ''; for(let i = 0; i < 3; i++) { skeletonHTML += `<div class="title-item card loading"><div class="loading-skeleton" style="display: flex !important;"><div style="display: flex; gap: 1.2rem; align-items: flex-start; width: 100%;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 14px; flex-shrink: 0;"></div><div style="flex-grow: 1;"><div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 0.7rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 14px; width: 75%;"></div></div></div></div></div>`; } ui.titleShopGrid.innerHTML = skeletonHTML; }

    // <<< UPDATED: renderLeaderboard includes avatar wrapper >>>
    function renderLeaderboard(data) {
        if (!ui.leaderboardBody || !ui.leaderboardEmpty || !ui.leaderboardContainer || !ui.leaderboardSkeleton || !ui.leaderboardTableContainer || !ui.leaderboardHeaderElement) {
            setLoadingState('leaderboard', false); return;
        }
        ui.leaderboardSkeleton.style.display = 'none';
        ui.leaderboardTableContainer.style.visibility = 'visible';
        ui.leaderboardHeaderElement.style.visibility = 'visible';
        ui.leaderboardBody.innerHTML = '';

        if (!data || data.length === 0) {
            ui.leaderboardEmpty.style.display = 'block';
            ui.leaderboardTableContainer.style.display = 'none';
        } else {
            ui.leaderboardEmpty.style.display = 'none';
            ui.leaderboardTableContainer.style.display = 'block';
            const fragment = document.createDocumentFragment();
            data.forEach((entry) => {
                const userProfile = entry.profile;
                if (!userProfile) return;
                const rank = entry.calculated_rank || '?';
                const isCurrentUser = entry.user_id === currentUser?.id;
                const displayName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.username || `Pilot #${entry.user_id.substring(0, 4)}`;
                const initials = getInitials(userProfile);
                const avatarUrl = userProfile.avatar_url;
                const pointsValue = entry.points ?? 0;
                const badgesCount = entry.badges_count ?? 0;
                const streakValue = userProfile.streak_days ?? 0;
                // <<< NEW: Get selected decoration key >>>
                const decorationKey = userProfile.selected_decoration || '';

                const rowElement = document.createElement('tr');
                if (isCurrentUser) rowElement.classList.add('highlight-row');

                rowElement.innerHTML = `
                    <td class="rank-cell">${rank}</td>
                    <td class="user-cell">
                        <div class="avatar-wrapper ${decorationKey}" data-decoration-key="${decorationKey}">
                             <div class="user-avatar-sm">${avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(displayName)}">` : sanitizeHTML(initials)}</div>
                        </div>
                        <div class="user-info-sm">
                            <div class="user-name-sm">${sanitizeHTML(displayName)}</div>
                            <div class="user-level">Úroveň ${userProfile.level || 1}</div>
                        </div>
                    </td>
                    <td class="score-cell">${pointsValue}</td>
                    <td class="badge-count-cell">${badgesCount}</td>
                    <td class="streak-cell">${streakValue}</td>
                `;
                fragment.appendChild(rowElement);
            });
            ui.leaderboardBody.appendChild(fragment);
        }
        setLoadingState('leaderboard', false);
    }
    // <<< END UPDATED >>>

    function renderRecentBadges(earnedBadges) { /* (Keep existing) */ if (!ui.recentAchievementsList || !ui.recentAchievementsSection) { setLoadingState('recentBadges', false); return; } setLoadingState('recentBadges', false); ui.recentAchievementsList.innerHTML = ''; const recent = earnedBadges.slice(0, 5); if (recent.length === 0) { ui.recentAchievementsSection.style.display = 'none'; return; } ui.recentAchievementsSection.style.display = 'block'; const fragment = document.createDocumentFragment(); recent.forEach((ub, index) => { const badge = ub.badge; if (!badge) return; const badgeType = badge.type?.toLowerCase() || 'default'; const visual = badgeVisuals[badgeType] || badgeVisuals.default; const badgeElement = document.createElement('div'); badgeElement.className = `achievement-item`; badgeElement.innerHTML = `<div class="achievement-item-icon ${badgeType}" style="background: ${visual.gradient};"><i class="fas ${visual.icon}"></i></div><div class="achievement-item-content"><h3 class="achievement-item-title">${sanitizeHTML(badge.title)}</h3><p class="achievement-item-desc">${sanitizeHTML(badge.description || '')}</p><div class="achievement-item-time"><i class="far fa-calendar-alt"></i> ${formatDate(ub.earned_at)}</div></div>`; fragment.appendChild(badgeElement); }); ui.recentAchievementsList.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
    function renderNotifications(count, notifications) { /* (Keep existing) */ if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { setLoadingState('notifications', false); return; } setLoadingState('notifications', false); ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } }
    function renderNotificationSkeletons(count = 2) { /* (Keep existing) */ if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    function renderTitleShop(titles, userProfile) { /* (Keep existing) */ if (!ui.titleShopGrid || !ui.titleShopEmpty || !ui.titleShopContainer || !ui.shopUserCredits || !userProfile) { setLoadingState('titleShop', false); return; } setLoadingState('titleShop', false); ui.shopUserCredits.textContent = userProfile.points ?? 0; ui.titleShopGrid.innerHTML = ''; if (!titles || titles.length === 0) { ui.titleShopEmpty.style.display = 'block'; ui.titleShopGrid.style.display = 'none'; return; } ui.titleShopEmpty.style.display = 'none'; ui.titleShopGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); const purchasedKeys = new Set(userProfile.purchased_titles || []); const selectedKey = userProfile.selected_title; titles.forEach((title, index) => { const isPurchased = purchasedKeys.has(title.title_key); const isEquipped = isPurchased && title.title_key === selectedKey; const itemElement = document.createElement('div'); itemElement.className = 'title-item card'; itemElement.setAttribute('data-title-key', title.title_key); itemElement.setAttribute('data-title-cost', title.cost); itemElement.setAttribute('data-animate', ''); itemElement.style.setProperty('--animation-order', index); itemElement.innerHTML = `<div class="title-item-icon"><i class="${sanitizeHTML(title.icon || 'fas fa-user-tag')}"></i></div><div class="title-item-content"><h4 class="title-item-name">${sanitizeHTML(title.name)}</h4>${title.description ? `<p class="title-item-desc">${sanitizeHTML(title.description)}</p>` : ''}<div class="title-item-footer"><span class="title-item-cost">Cena: ${title.cost} <i class="fas fa-coins"></i></span><div class="title-item-actions"><button class="btn btn-sm btn-primary buy-title-btn" ${isPurchased ? 'style="display: none;"' : ''} ${userProfile.points < title.cost ? 'disabled' : ''}><i class="fas fa-shopping-cart"></i> Koupit</button><span class="title-status purchased" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-check"></i> Zakoupeno</span><span class="title-status equipped" ${isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-user-check"></i> Používá se</span><button class="btn btn-sm btn-secondary equip-title-btn" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-check-square"></i> Použít</button></div></div></div>`; fragment.appendChild(itemElement); }); ui.titleShopGrid.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
    function renderBadgeSkeletons(container, count = 3) { if (!container) return; container.innerHTML = ''; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="badge-card loading"><div class="loading-skeleton"><div class="skeleton badge-icon-placeholder"></div><div class="skeleton badge-title-placeholder"></div><div class="skeleton badge-desc-placeholder"></div><div class="skeleton badge-desc-placeholder"></div><div class="skeleton badge-date-placeholder"></div></div></div>`; } container.innerHTML = skeletonHTML; }
    function renderAvailableBadgeSkeletons(container, count = 2) { if (!container) return; container.innerHTML = ''; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="achievement-card loading"><div class="loading-skeleton"><div class="skeleton achievement-icon-placeholder"></div><div class="skeleton achievement-content-placeholder"><div class="skeleton achievement-title-placeholder"></div><div class="skeleton achievement-desc-placeholder"></div><div class="skeleton achievement-desc-placeholder"></div><div class="skeleton achievement-progress-placeholder"></div></div></div></div>`; } container.innerHTML = skeletonHTML; }
    function renderTitleShopSkeleton() { if (!ui.titleShopGrid) return; ui.titleShopGrid.innerHTML = ''; let skeletonHTML = ''; for(let i = 0; i < 2; i++) { skeletonHTML += `<div class="title-item card loading"><div class="loading-skeleton" style="display: flex !important;"><div style="display: flex; gap: 1.2rem; align-items: flex-start; width: 100%;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 14px; flex-shrink: 0;"></div><div style="flex-grow: 1;"><div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 0.7rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 14px; width: 75%;"></div></div></div></div></div>`; } ui.titleShopGrid.innerHTML = skeletonHTML; }

    // <<< NEW: Render Avatar Decorations Shop >>>
    function renderAvatarDecorationsShop(decorations, userProfile) {
        if (!ui.avatarDecorationsGrid || !ui.avatarDecorationsEmpty || !ui.avatarDecorationsShop || !ui.shopDecorCredits || !userProfile) {
            console.warn("[RenderDecorShop] Missing UI elements or profile data.");
            setLoadingState('avatarDecorations', false);
            return;
        }
        setLoadingState('avatarDecorations', false);
        ui.shopDecorCredits.textContent = userProfile.points ?? 0;
        ui.avatarDecorationsGrid.innerHTML = '';

        if (!decorations || decorations.length === 0) {
            ui.avatarDecorationsEmpty.style.display = 'block';
            ui.avatarDecorationsGrid.style.display = 'none';
            return;
        }

        ui.avatarDecorationsEmpty.style.display = 'none';
        ui.avatarDecorationsGrid.style.display = 'grid';
        const fragment = document.createDocumentFragment();
        const purchasedKeys = new Set(userProfile.purchased_decorations || []);
        const selectedKey = userProfile.selected_decoration;

        decorations.forEach((decor, index) => {
            const isPurchased = purchasedKeys.has(decor.decoration_key);
            const isEquipped = isPurchased && decor.decoration_key === selectedKey;
            const canAfford = userProfile.points >= decor.cost;

            const itemElement = document.createElement('div');
            itemElement.className = 'decoration-item card'; // Use new class
            itemElement.setAttribute('data-decor-key', decor.decoration_key);
            itemElement.setAttribute('data-decor-cost', decor.cost);
            itemElement.setAttribute('data-animate', '');
            itemElement.style.setProperty('--animation-order', index);

            // Preview - Apply the decoration class here!
            const previewHTML = `
                <div class="decoration-preview">
                    <div class="avatar-wrapper ${sanitizeHTML(decor.decoration_key || '')}" data-decoration-key="${sanitizeHTML(decor.decoration_key || '')}">
                         <div class="user-avatar-sm">${getInitials(null)}</div>
                    </div>
                </div>`;

            itemElement.innerHTML = `
                ${previewHTML}
                <div class="decoration-info">
                    <h4 class="decoration-name">${sanitizeHTML(decor.name)}</h4>
                    ${decor.description ? `<p class="decoration-desc">${sanitizeHTML(decor.description)}</p>` : ''}
                </div>
                <div class="decoration-footer">
                    <span class="decoration-cost">Cena: ${decor.cost} <i class="fas fa-coins"></i></span>
                    <div class="decoration-actions">
                        <button class="btn btn-sm btn-primary buy-decor-btn" ${isPurchased ? 'style="display: none;"' : ''} ${canAfford ? '' : 'disabled'} title="${canAfford ? 'Koupit vylepšení' : 'Nedostatek kreditů'}">
                            <i class="fas fa-shopping-cart"></i> Koupit
                        </button>
                        <span class="title-status purchased" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-check"></i> Vlastněno</span>
                        <span class="title-status equipped" ${isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-user-check"></i> Používá se</span>
                        <button class="btn btn-sm btn-secondary equip-decor-btn" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}>
                            <i class="fas fa-check-square"></i> Použít
                        </button>
                    </div>
                </div>`;
            fragment.appendChild(itemElement);
        });
        ui.avatarDecorationsGrid.appendChild(fragment);
        requestAnimationFrame(initScrollAnimations);
        console.log("[RenderDecorShop] Decorations rendered.");
    }

    function renderAvatarDecorationsSkeleton() {
        if (!ui.avatarDecorationsGrid) return;
        ui.avatarDecorationsGrid.innerHTML = '';
        let skeletonHTML = '';
        for (let i = 0; i < 3; i++) { // Render 3 skeletons
            skeletonHTML += `
                <div class="decoration-item card loading">
                    <div class="loading-skeleton" style="display: flex !important; flex-direction: column; align-items: center; padding:1rem;">
                         <div class="skeleton" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 1rem;"></div>
                         <div class="skeleton" style="height: 18px; width: 70%; margin: 0 auto 0.7rem auto;"></div>
                         <div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div>
                         <div class="skeleton" style="height: 14px; width: 80%; margin-bottom: 1rem;"></div>
                         <div style="margin-top: auto; padding-top: 0.8rem; border-top: 1px solid transparent; display: flex; justify-content: space-between; align-items: center; width:100%;">
                             <div class="skeleton" style="height: 16px; width: 70px;"></div>
                             <div class="skeleton" style="height: 30px; width: 90px; border-radius: var(--button-radius);"></div>
                         </div>
                    </div>
                </div>`;
        }
        ui.avatarDecorationsGrid.innerHTML = skeletonHTML;
    }
    // <<< END NEW >>>


    // --- Обработчики событий ---
    function setupUIEventListeners() {
        console.log("[SETUP] setupUIEventListeners: Start");
        if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar); else console.warn("[SETUP] Sidebar toggle button not found.");
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
        document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });
        window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();
        if (ui.refreshDataBtn) { ui.refreshDataBtn.addEventListener('click', handleGlobalRetry); }
        if (ui.notificationBell) ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); });
        if (ui.markAllReadBtn) ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead);
        if (ui.notificationsList) { ui.notificationsList.addEventListener('click', handleNotificationClick); }
        document.addEventListener('click', closeNotificationDropdownOnClickOutside);
        // <<< UPDATED: Add listener for decoration shop >>>
        if (ui.titleShopGrid) { ui.titleShopGrid.addEventListener('click', handleShopInteraction); }
        if (ui.avatarDecorationsGrid) { ui.avatarDecorationsGrid.addEventListener('click', handleShopInteraction); } // Use the same handler
        console.log("[SETUP] Event listeners set up.");
    }

    async function handleGlobalRetry() { /* (Keep existing) */ if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné být přihlášen a mít načtený profil.", "error"); if (!currentProfile) await initializeApp(); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } hideError(); if (ui.refreshDataBtn) { const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; ui.refreshDataBtn.disabled = true; } await loadAllAwardData(); if (ui.refreshDataBtn) { const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; ui.refreshDataBtn.disabled = false; } }
    async function handleNotificationClick(event) { /* (Keep existing) */ const item = event.target.closest('.notification-item'); if (!item) return; const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; }
    function closeNotificationDropdownOnClickOutside(event) { /* (Keep existing) */ if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } }

    // <<< NEW: Unified Shop Interaction Handler >>>
    async function handleShopInteraction(event) {
        const buyButton = event.target.closest('.buy-title-btn, .buy-decor-btn');
        const equipButton = event.target.closest('.equip-title-btn, .equip-decor-btn');

        if (buyButton) {
            const itemElement = buyButton.closest('.title-item, .decoration-item');
            const itemKey = itemElement?.dataset.titleKey || itemElement?.dataset.decorKey;
            const itemCost = parseInt(itemElement?.dataset.titleCost || itemElement?.dataset.decorCost, 10);
            const itemType = itemElement?.classList.contains('title-item') ? 'title' : 'decoration';

            if (itemKey && !isNaN(itemCost)) {
                handleBuyItem(itemType, itemKey, itemCost, buyButton);
            } else {
                console.error("Could not get item key or cost from button:", buyButton);
                showToast('Chyba', 'Nelze zpracovat nákup, chybí data.', 'error');
            }
        } else if (equipButton) {
            const itemElement = equipButton.closest('.title-item, .decoration-item');
            const itemKey = itemElement?.dataset.titleKey || itemElement?.dataset.decorKey;
            const itemType = itemElement?.classList.contains('title-item') ? 'title' : 'decoration';

            if (itemKey) {
                handleEquipItem(itemType, itemKey, equipButton);
            } else {
                console.error("Could not get item key from button:", equipButton);
                showToast('Chyba', 'Nelze nastavit položku, chybí data.', 'error');
            }
        }
    }

    async function handleBuyItem(itemType, itemKey, cost, buttonElement) {
        if (!currentProfile || !supabase || !currentUser) { showToast('Chyba', 'Nelze provést nákup, chybí data uživatele.', 'error'); return; }
        const currentCredits = currentProfile.points ?? 0;
        if (currentCredits < cost) { showToast('Nedostatek Kreditů', `Potřebujete ${cost} kreditů, máte ${currentCredits}.`, 'warning'); return; }

        const itemData = itemType === 'title' ? allTitles.find(t => t.title_key === itemKey) : allDecorations.find(d => d.decoration_key === itemKey);
        const itemName = itemData?.name || itemKey;
        if (!confirm(`Opravdu chcete koupit ${itemType === 'title' ? 'titul' : 'vylepšení'} "${itemName}" za ${cost} kreditů?`)) return;

        buttonElement.disabled = true;
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kupuji...';

        try {
            const purchaseField = itemType === 'title' ? 'purchased_titles' : 'purchased_decorations';
            const currentPurchased = Array.isArray(currentProfile[purchaseField]) ? currentProfile[purchaseField] : [];
            if (currentPurchased.includes(itemKey)) {
                showToast('Již Vlastněno', `Toto ${itemType === 'title' ? 'titul' : 'vylepšení'} již máte.`, 'info');
                buttonElement.innerHTML = '<i class="fas fa-shopping-cart"></i> Koupit';
                // Re-render the specific shop section
                if (itemType === 'title') renderTitleShop(allTitles, currentProfile);
                else renderAvatarDecorationsShop(allDecorations, currentProfile);
                return;
            }

            const newCredits = currentCredits - cost;
            const newPurchasedItems = [...currentPurchased, itemKey];
            const updatePayload = { points: newCredits, [purchaseField]: newPurchasedItems };

            const { error: updateError } = await supabase
                .from('profiles')
                .update(updatePayload)
                .eq('id', currentUser.id);

            if (updateError) throw updateError;

            // Update local profile state
            currentProfile.points = newCredits;
            currentProfile[purchaseField] = newPurchasedItems;

            // Update UI
            if (ui.shopUserCredits) ui.shopUserCredits.textContent = newCredits; // Update credits in title shop
            if (ui.shopDecorCredits) ui.shopDecorCredits.textContent = newCredits; // Update credits in decor shop
            if (ui.pointsCount) ui.pointsCount.textContent = newCredits; // Update stats card

            // Re-render the specific shop section
            if (itemType === 'title') renderTitleShop(allTitles, currentProfile);
            else renderAvatarDecorationsShop(allDecorations, currentProfile);

            showToast('Nákup Úspěšný', `${itemType === 'title' ? 'Titul' : 'Vylepšení'} "${itemName}" byl zakoupen!`, 'success');

        } catch (error) {
            console.error(`[Shop] Error buying ${itemType} ${itemKey}:`, error);
            showToast('Chyba Nákupu', `Nepodařilo se zakoupit položku: ${error.message}`, 'error');
        } finally {
            buttonElement.disabled = false;
            buttonElement.innerHTML = '<i class="fas fa-shopping-cart"></i> Koupit';
            // Re-check state after potential error or success
            const stillOwned = (currentProfile[itemType === 'title' ? 'purchased_titles' : 'purchased_decorations'] || []).includes(itemKey);
            if (stillOwned) {
                buttonElement.style.display = 'none'; // Hide buy button if now owned
            } else if (currentProfile.points < cost) {
                buttonElement.disabled = true; // Disable if cannot afford
            }
        }
    }

    async function handleEquipItem(itemType, itemKey, buttonElement) {
        if (!currentProfile || !supabase || !currentUser) { showToast('Chyba', 'Nelze nastavit položku, chybí data uživatele.', 'error'); return; }

        const purchaseField = itemType === 'title' ? 'purchased_titles' : 'purchased_decorations';
        const selectField = itemType === 'title' ? 'selected_title' : 'selected_decoration';
        const purchasedKeys = Array.isArray(currentProfile[purchaseField]) ? currentProfile[purchaseField] : [];

        if (!purchasedKeys.includes(itemKey)) {
            showToast('Chyba', `Tuto položku ${itemType === 'title' ? 'titul' : 'vylepšení'} nemáte zakoupenou.`, 'error');
            // Re-render the specific shop section
            if (itemType === 'title') renderTitleShop(allTitles, currentProfile);
            else renderAvatarDecorationsShop(allDecorations, currentProfile);
            return;
        }

        if (currentProfile[selectField] === itemKey) {
            showToast('Již Používáte', `Tuto položku ${itemType === 'title' ? 'titul' : 'vylepšení'} již máte nastavenou.`, 'info');
            return;
        }

        buttonElement.disabled = true;
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Nastavuji...';

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ [selectField]: itemKey }) // Use computed property name
                .eq('id', currentUser.id);

            if (updateError) throw updateError;

            // Update local profile state
            currentProfile[selectField] = itemKey;

            // Re-render both shops and update sidebar
            renderTitleShop(allTitles, currentProfile);
            renderAvatarDecorationsShop(allDecorations, currentProfile);
            updateSidebarProfile(currentProfile, allTitles); // Update sidebar with new title/decoration

            const itemData = itemType === 'title' ? allTitles.find(t => t.title_key === itemKey) : allDecorations.find(d => d.decoration_key === itemKey);
            const itemName = itemData?.name || itemKey;
            showToast('Položka Nastavena', `Nyní používáte ${itemType === 'title' ? 'titul' : 'vylepšení'} "${itemName}".`, 'success');

        } catch (error) {
            console.error(`[Shop] Error equipping ${itemType} ${itemKey}:`, error);
            showToast('Chyba Nastavení', `Nepodařilo se nastavit položku: ${error.message}`, 'error');
        } finally {
            buttonElement.disabled = false;
            buttonElement.innerHTML = '<i class="fas fa-check-square"></i> Použít';
            // Update button visibility after operation
            const stillSelected = currentProfile[selectField] === itemKey;
            const stillOwned = (currentProfile[purchaseField] || []).includes(itemKey);
            if (stillSelected || !stillOwned) {
                buttonElement.style.display = 'none';
            }
        }
    }
    // <<< END NEW >>>


    // --- Notification Logic (Core) ---
    async function markNotificationRead(notificationId) { if (!currentUser || !notificationId || !supabase) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; return true; } catch (error) { console.error("[Notifications] Mark read error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení.', 'error'); return false; } }
    async function markAllNotificationsRead() { if (!currentUser || !supabase || !ui.markAllReadBtn) return; if (isLoading.notifications) return; setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; try { const { error } = await supabase .from('user_notifications') .update({ is_read: true }) .eq('user_id', currentUser.id) .eq('is_read', false); if (error) throw error; const { unreadCount, notifications } = await fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('Oznámení Vymazána', 'Všechna oznámení označena jako přečtená.', 'success'); } catch (error) { console.error("[Notifications] Mark all read error:", error); showToast('Chyba', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }

    // --- Инициализация ---
    async function initializeApp() {
        console.log("🚀 [Init Oceneni - Kyber v8 - Decorations] Initializing Awards Page...");
        if (!initializeSupabase()) return;
        // Cache DOM elements *after* Supabase init, before listeners
        if (!cacheDOMElements()) {
            console.warn("[Init Oceneni] DOM caching finished with some missing elements (potentially expected).");
        }
        applyInitialSidebarState(); // Apply sidebar state early
        setupUIEventListeners(); // Setup listeners

        if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; }
        if (ui.mainContent) ui.mainContent.style.display = 'none'; // Hide main content initially

        try {
            console.log("[Init Oceneni] Checking auth session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;
                console.log(`[Init Oceneni] User authenticated (ID: ${currentUser.id}). Loading profile and titles...`);

                // Fetch profile and titles concurrently
                const [profileResult, titlesResult] = await Promise.allSettled([
                    fetchUserProfile(currentUser.id),
                    fetchTitleShopData() // Fetch titles needed for sidebar
                ]);

                if (profileResult.status === 'fulfilled' && profileResult.value) {
                    currentProfile = profileResult.value;
                    console.log("[Init Oceneni] Profile loaded successfully.");
                } else {
                    throw new Error(`Nepodařilo se načíst profil uživatele. Důvod: ${profileResult.reason || 'Nenalezen'}`);
                }

                if (titlesResult.status === 'fulfilled') {
                    allTitles = titlesResult.value || [];
                    console.log("[Init Oceneni] Titles loaded successfully.");
                } else {
                    console.warn("[Init Oceneni] Failed to load titles:", titlesResult.reason);
                    allTitles = []; // Default to empty array
                }

                updateSidebarProfile(currentProfile, allTitles); // Update sidebar first

                if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
                if (ui.mainContent) {
                    ui.mainContent.style.display = 'block'; // Show main content AFTER profile loaded
                    requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); });
                }

                console.log("[Init Oceneni] Loading all award page data...");
                await loadAllAwardData(); // Fetch all other data (badges, leaderboard, decorations, etc.)

                console.log("✅ [Init Oceneni] Page fully loaded and initialized.");
                requestAnimationFrame(() => { initScrollAnimations(); initMouseFollower(); initHeaderScrollDetection(); updateCopyrightYear(); });

            } else {
                console.log("[Init Oceneni] User not logged in. Redirecting...");
                window.location.href = '/auth/index.html';
            }
        } catch (error) {
            console.error("❌ [Init Oceneni] Critical initialization error:", error);
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA SYSTÉMU (${error.message}). OBNOVTE STRÁNKU.</p>`; }
            else { showError(`Chyba při inicializaci: ${error.message}`, true); }
            if (ui.mainContent) ui.mainContent.style.display = 'none'; // Hide content on error
        }
    }

    // --- Запуск ---
    document.addEventListener('DOMContentLoaded', initializeApp);

})(); // End of IIFE