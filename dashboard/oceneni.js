// dashboard/oceneni.js
// Version: 23.23.5 - Enhanced achievement checking and progress display
(function() { // IIFE for scope isolation
    'use strict';

    // --- START: Configuration ---
    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    const NOTIFICATION_FETCH_LIMIT = 5;
    const LEADERBOARD_LIMIT = 10;
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
    const DAILY_TITLE_SHOP_COUNT = 6;
    const PROFILE_COLUMNS_TO_SELECT_FOR_ACHIEVEMENTS = 'id, username, first_name, last_name, email, avatar_url, bio, school, grade, level, completed_exercises, streak_days, longest_streak_days, badges_count, points, experience, purchased_titles, selected_title, selected_decoration'; // Added more fields

    // --- END: Configuration ---

    // --- START: State Variables ---
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let userBadges = [];
    let allBadges = [];
    let allTitlesFromDB = [];
    let titleShopTitles = [];
    let allDecorations = [];
    let leaderboardData = [];
    let currentLeaderboardPeriod = 'overall';

    // NEW: State for additional data needed for achievements
    let userDiagnosticTestsCount = 0;
    let userLearningLogsCount = 0;
    let userTopicProgressList = [];
    let allExamTopics = [];
    let userStudyPlansCount = 0;
    let userAiLessonsCompletedCount = 0;


    let isLoading = {
        stats: false, userBadges: false, availableBadges: false,
        leaderboard: false, titleShop: false, avatarDecorations: false,
        notifications: false, buyEquip: false, all: false, titles: false,
        userTitlesInventory: false,
        // NEW loading states
        userDiagnostics: false, userLearningLogs: false, userTopicProgress: false, examTopics: false,
        userStudyPlans: false, userAiLessons: false
    };
    // --- END: State Variables ---

    // --- START: UI Elements Cache ---
    const ui = {};

    function cacheDOMElements() {
        console.log("[Oceneni Cache DOM] Caching elements...");
        const ids = [
            'initial-loader', 'sidebar-overlay', 'main-content', 'sidebar', 'main-mobile-menu-toggle',
            'sidebar-close-toggle', 'sidebar-avatar', 'sidebar-name', 'sidebar-user-title',
            'currentYearSidebar', 'page-title', 'refresh-data-btn', 'notification-bell',
            'notification-count', 'notifications-dropdown', 'notifications-list', 'no-notifications-msg',
            'mark-all-read',
            'global-error', 'offline-banner', 'toast-container',
            'achievements-content', 'achievement-stats-container',
            'badges-count', 'badges-change', 'points-count', 'points-change',
            'streak-days', 'streak-change', 'rank-value', 'rank-change', 'total-users',
            'user-badges-container', 'badge-grid', 'empty-badges',
            'available-badges-container', 'available-badges-grid', 'empty-available-badges',
            'leaderboard-container', 'leaderboard-body', 'leaderboard-empty',
            'title-shop-container', 'shop-user-credits', 'title-shop-loading',
            'title-shop-grid', 'title-shop-empty',
            'avatar-decorations-shop', 'shop-decor-credits', 'avatar-decorations-loading',
            'avatar-decorations-grid', 'avatar-decorations-empty',
            'currentYearFooter', 'mouse-follower',
            'sidebar-toggle-btn',
            'badges-card', 'points-card', 'streak-card', 'rank-card',
            'leaderboard-skeleton', 'leaderboard-header', 'leaderboard-table-container',
            'user-titles-inventory-container', 'user-titles-inventory-grid',
            'user-titles-inventory-empty', 'user-titles-inventory-loading',
            'toggle-user-badges-section', 'toggle-available-badges-section',
            'toggle-user-titles-section', 'toggle-title-shop-section',
            'toggle-avatar-decorations-section', 'toggle-leaderboard-section'
        ];
        const notFound = [];
        ids.forEach(id => {
            const element = document.getElementById(id);
            const key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
            if (element) {
                ui[key] = element;
            } else {
                notFound.push(id);
                ui[key] = null;
            }
        });

        ui.userBadgesContent = ui.userBadgesContainer?.querySelector('.section-collapsible-content');
        ui.availableBadgesContent = ui.availableBadgesContainer?.querySelector('.section-collapsible-content');
        ui.userTitlesInventoryContent = ui.userTitlesInventoryContainer?.querySelector('.section-collapsible-content');
        ui.titleShopContent = ui.titleShopContainer?.querySelector('.section-collapsible-content');
        ui.avatarDecorationsContent = ui.avatarDecorationsShop?.querySelector('.section-collapsible-content');
        ui.leaderboardContent = ui.leaderboardContainer?.querySelector('.section-collapsible-content');


        if (!ui.sidebarUserTitle) {
            const roleEl = document.getElementById('sidebar-user-role');
            if(roleEl) ui.sidebarUserTitle = roleEl;
            else if (!notFound.includes('sidebar-user-title')) notFound.push('sidebar-user-title/role');
        }
        if (notFound.length > 0) {
            console.warn(`[Oceneni Cache DOM] Elements not found: (${notFound.length})`, notFound);
        }
        console.log("[Oceneni Cache DOM] Caching complete.");
    }
    // --- END: UI Elements Cache ---

    // --- START: Helper Functions ---
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatDate(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) return '-'; return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return '-'; } }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function initTooltips() { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip.tooltipstered').each(function() { try { window.jQuery(this).tooltipster('destroy'); } catch (e) { /* ignore */ } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } }
    const initMouseFollower = () => { const f = ui.mouseFollower; if (!f || window.innerWidth <= 576) return; let hM = false; const uP = (e) => { if (!hM) { document.body.classList.add('mouse-has-moved'); hM = true; } requestAnimationFrame(() => { f.style.left = `${e.clientX}px`; f.style.top = `${e.clientY}px`; }); }; window.addEventListener('mousemove', uP, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hM) f.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hM) f.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(f) f.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const els = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!els.length || !('IntersectionObserver' in window)) return; const obs = new IntersectionObserver((e, o) => { e.forEach(en => { if (en.isIntersecting) { en.target.classList.add('animated'); o.unobserve(en.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); els.forEach(el => obs.observe(el)); };
    const initHeaderScrollDetection = () => { let lSY = window.scrollY; const mE = ui.mainContent; if (!mE) return; mE.addEventListener('scroll', () => { const cSY = mE.scrollTop; document.body.classList.toggle('scrolled', cSY > 10); lSY = cSY <= 0 ? 0 : cSY; }, { passive: true }); if (mE.scrollTop > 10) document.body.classList.add('scrolled'); };
    const updateOnlineStatus = () => { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); };
    const updateCopyrightYear = () => { const y = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = y; if (ui.currentYearFooter) ui.currentYearFooter.textContent = y; };
    function toggleSidebar() { if (!ui.sidebarToggleBtn) return; try { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (error) { console.error("[Sidebar Toggle] Error:", error); } }
    function applyInitialSidebarState() { if (!ui.sidebarToggleBtn) return; try { const savedState = localStorage.getItem(SIDEBAR_STATE_KEY); const shouldBeCollapsed = savedState === 'collapsed'; if (shouldBeCollapsed) document.body.classList.add('sidebar-collapsed'); else document.body.classList.remove('sidebar-collapsed'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.title = shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (error) { console.error("[Sidebar State] Error applying initial state:", error); document.body.classList.remove('sidebar-collapsed'); } }
    function getSeededSortValue(seedString) { let hash = 0; if (!seedString || seedString.length === 0) return hash; for (let i = 0; i < seedString.length; i++) { const char = seedString.charCodeAt(i); hash = ((hash << 5) - hash) + char; hash |= 0; } return Math.abs(hash); }
    // --- END: Helper Functions ---

    // --- START: Loading State Management ---
    function setLoadingState(sectionKey, isLoadingFlag) {
        if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;

        const updateSingleSection = (key, loading) => {
            if (isLoading[key] === loading && key !== 'all') return;
            isLoading[key] = loading;
            console.log(`[SetLoading Oceneni] ${key}: ${loading}`);

            const sectionMap = {
                stats: { container: ui.achievementStatsContainer, childrenSelector: '.stat-card' },
                userBadges: { container: ui.userBadgesContainer, emptyEl: ui.emptyBadges, contentEl: ui.badgeGrid, skeletonFn: renderBadgeSkeletons, skeletonCount: 6 },
                availableBadges: { container: ui.availableBadgesContainer, emptyEl: ui.emptyAvailableBadges, contentEl: ui.availableBadgesGrid, skeletonFn: renderAvailableBadgeSkeletons, skeletonCount: 4 },
                leaderboard: { container: ui.leaderboardContainer, emptyEl: ui.leaderboardEmpty, contentEl: ui.leaderboardTableContainer, skeletonEl: ui.leaderboardSkeleton, headerEl: ui.leaderboardHeader, skeletonFn: renderLeaderboardSkeleton },
                titleShop: { container: ui.titleShopContainer, emptyEl: ui.titleShopEmpty, contentEl: ui.titleShopGrid, loadingEl: ui.titleShopLoading, skeletonFn: renderTitleShopSkeleton, skeletonCount: DAILY_TITLE_SHOP_COUNT },
                avatarDecorations: { container: ui.avatarDecorationsShop, emptyEl: ui.avatarDecorationsEmpty, contentEl: ui.avatarDecorationsGrid, loadingEl: ui.avatarDecorationsLoading, skeletonFn: renderAvatarDecorationsSkeleton, skeletonCount: 4 },
                notifications: { container: ui.notificationsList, emptyEl: ui.noNotificationsMsg, skeletonFn: renderNotificationSkeletons, skeletonCount: 2 },
                userTitlesInventory: { container: ui.userTitlesInventoryContainer, emptyEl: ui.userTitlesInventoryEmpty, contentEl: ui.userTitlesInventoryGrid, loadingEl: ui.userTitlesInventoryLoading, skeletonFn: renderUserTitlesInventorySkeletons, skeletonCount: 4 },
                buyEquip: {}, titles: {}, userDiagnostics: {}, userLearningLogs: {}, userTopicProgress: {}, examTopics: {}, userStudyPlans: {}, userAiLessons: {}
            };

            const config = sectionMap[key];
            if (!config) return;

            if (config.container) config.container.classList.toggle('loading', loading);
            if (config.childrenSelector && config.container) { config.container.querySelectorAll(config.childrenSelector).forEach(child => child.classList.toggle('loading', loading)); }

            const loaderEl = config.loadingEl || config.skeletonEl;
            const contentEl = config.contentEl;
            const emptyEl = config.emptyEl;
            const headerEl = config.headerEl;

            if (loaderEl) loaderEl.style.display = loading ? (key === 'leaderboard' ? 'block' : 'flex') : 'none';
            if (headerEl) headerEl.style.visibility = loading ? 'hidden' : 'visible';

            if (loading) {
                if (contentEl) contentEl.style.display = 'none';
                if (emptyEl) emptyEl.style.display = 'none';
                if (config.skeletonFn) {
                    const targetContainer = contentEl || (key === 'leaderboard' ? null : config.container);
                    if (targetContainer || key === 'leaderboard') {
                         config.skeletonFn(targetContainer, config.skeletonCount);
                    }
                }
            }
             if (key === 'notifications' && ui.notificationBell) {
                 ui.notificationBell.style.opacity = loading ? 0.5 : 1;
                 if (ui.markAllRead) {
                     const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                     ui.markAllRead.disabled = loading || currentUnreadCount === 0;
                 }
             }
        };

        if (sectionKey === 'all') {
            Object.keys(isLoading).forEach(key => {
                if (key !== 'all') updateSingleSection(key, isLoadingFlag);
            });
            isLoading.all = isLoadingFlag;
        } else {
            updateSingleSection(sectionKey, isLoadingFlag);
        }
    }
    // --- END: Loading State Management ---

    // --- START: Skeleton Rendering Functions ---
    function renderStatsSkeletons(container) { /* Only toggles class on parent */ }
    function renderBadgeSkeletons(container = ui.badgeGrid, count = 6) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let s = ''; for (let i = 0; i < count; i++) s += `<div class="badge-card card loading"><div class="loading-skeleton" style="display: flex !important; flex-direction: column; align-items: center; padding: 1.8rem 1.2rem;"><div class="skeleton badge-icon-placeholder" style="width: 70px; height: 70px; border-radius: 50%; margin-bottom: 1.2rem;"></div><div class="skeleton badge-title-placeholder" style="height: 16px; width: 70%; margin-bottom: 0.5rem;"></div><div class="skeleton badge-desc-placeholder" style="height: 12px; width: 90%; margin-bottom: 0.4rem;"></div><div class="skeleton badge-desc-placeholder" style="height: 12px; width: 80%; margin-bottom: 0.8rem;"></div><div class="skeleton badge-date-placeholder" style="height: 12px; width: 50%; margin-top: auto;"></div></div></div>`; container.innerHTML = s; }
    function renderAvailableBadgeSkeletons(container = ui.availableBadgesGrid, count = 4) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let s = ''; for (let i = 0; i < count; i++) s += `<div class="achievement-card card loading"><div class="loading-skeleton" style="display: flex !important;"><div class="skeleton achievement-icon-placeholder" style="width: 60px; height: 60px; border-radius: 16px; flex-shrink: 0;"></div><div class="skeleton achievement-content-placeholder" style="flex-grow: 1;"><div class="skeleton achievement-title-placeholder" style="height: 18px; width: 60%; margin-bottom: 0.6rem;"></div><div class="skeleton achievement-desc-placeholder" style="height: 14px; width: 95%; margin-bottom: 0.4rem;"></div><div class="skeleton achievement-desc-placeholder" style="height: 14px; width: 80%; margin-bottom: 0.8rem;"></div><div class="skeleton achievement-progress-placeholder" style="height: 20px; width: 100%;"></div></div></div></div>`; container.innerHTML = s; }
    function renderLeaderboardSkeleton() { if (ui.leaderboardSkeleton) ui.leaderboardSkeleton.style.display = 'block'; }
    function renderTitleShopSkeleton(container = ui.titleShopGrid, count = DAILY_TITLE_SHOP_COUNT) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let s = ''; for(let i = 0; i < count; i++) s += `<div class="title-item card loading"><div class="loading-skeleton" style="display: flex !important;"><div style="display: flex; gap: 1.2rem; align-items: flex-start; width: 100%;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 14px; flex-shrink: 0;"></div><div style="flex-grow: 1;"><div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 0.7rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 14px; width: 75%;"></div></div></div></div></div>`; container.innerHTML = s; }
    function renderAvatarDecorationsSkeleton(container = ui.avatarDecorationsGrid, count = 4) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let s = ''; for(let i = 0; i < count; i++) s += `<div class="decoration-item card loading"><div class="loading-skeleton" style="display: flex !important; flex-direction: column; align-items: center; padding:1rem;"><div class="skeleton" style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 1rem auto;"></div><div class="skeleton" style="height: 18px; width: 70%; margin: 0 auto 0.7rem auto;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 14px; width: 80%;"></div><div style="margin-top: 1rem; padding-top: 0.8rem; border-top: 1px solid transparent; display: flex; justify-content: space-between; align-items: center; width:100%;"><div class="skeleton" style="height: 16px; width: 70px;"></div><div class="skeleton" style="height: 30px; width: 90px; border-radius: var(--button-radius);"></div></div></div></div>`; container.innerHTML = s; }
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) {console.warn("[Skeletons] Notifications list or no-message element not found."); return;} let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height:16px;width:70%;margin-bottom:6px;"></div><div class="skeleton" style="height:12px;width:90%;"></div><div class="skeleton" style="height:10px;width:40%;margin-top:6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    function renderUserTitlesInventorySkeletons(container = ui.userTitlesInventoryGrid, count = 4) { if (!container) { console.warn("[Skeletons] User Titles Inventory container not found."); return; } container.innerHTML = ''; container.style.display = 'grid'; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += ` <div class="title-item card loading"> <div class="loading-skeleton" style="display: flex !important;"> <div style="display: flex; gap: 1.2rem; align-items: flex-start; width: 100%;"> <div class="skeleton" style="width: 60px; height: 60px; border-radius: 14px; flex-shrink: 0;"></div> <div style="flex-grow: 1;"> <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 0.7rem;"></div> <div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div> <div class="skeleton" style="height: 14px; width: 75%;"></div> </div> </div> </div> </div>`; } container.innerHTML = skeletonHTML; }
    // --- END: Skeleton Rendering Functions ---

    // --- START: Data Fetching Functions (with new fetches) ---
    async function fetchUserFullProfile(userId) { // Renamed for clarity
        if (!supabase || !userId) return null;
        console.log(`[Profile Full] Fetching FULL profile for achievements, user ID: ${userId}`);
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select(PROFILE_COLUMNS_TO_SELECT_FOR_ACHIEVEMENTS)
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (!profile) {
                console.warn(`[Profile Full] Profile for ${userId} not found. Returning null.`);
                return null;
            }
            console.log("[Profile Full] Full profile data for achievements fetched successfully.");
            return profile;
        } catch (error) {
            console.error('[Profile Full] Caught exception fetching full profile:', error);
            return null;
        }
    }

    async function fetchUserStats(userId, profileData) {
        if (!supabase || !userId ) return {}; // Removed profileData dependency for this specific fetch
        console.log(`[UserStats] Fetching user_stats for user ${userId}`);
        try {
            const { data: stats, error} = await supabase
                .from('user_stats')
                .select('progress, progress_weekly, points_weekly, streak_longest, completed_tests')
                .eq('user_id', userId)
                .maybeSingle();
            if (error) {
                console.warn("[UserStats] Error fetching user_stats from DB:", error.message);
                return {}; // Return empty object on error to allow graceful degradation
            }
            return stats || {};
        } catch (e) {
            console.error("[UserStats] Exception fetching user_stats:", e);
            return {};
        }
    }

    async function fetchAllBadgesDefinition() {
        if (!supabase) return [];
        setLoadingState('userBadges', true); // Use userBadges as it's about displaying them
        try {
            const { data, error } = await supabase.from('badges').select('*').order('id');
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error("Error fetching badge definitions:", e);
            return [];
        } finally {
            // setLoadingState('userBadges', false); // This will be turned off after rendering
        }
    }

    async function fetchUserEarnedBadges(userId) {
        if (!supabase || !userId) return [];
        // setLoadingState('userBadges', true); // Loading state handled by calling function or render
        try {
            const { data, error } = await supabase
                .from('user_badges')
                .select(`badge_id, earned_at, badge:badges!inner (id, title, description, type, icon, requirements, points)`)
                .eq('user_id', userId)
                .order('earned_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error("Error fetching earned badges:", e);
            return [];
        }
    }
    async function fetchAllPurchasableTitles() {
        if (!supabase) return [];
        console.log("[Titles] Fetching ALL available & purchasable titles from DB...");
        setLoadingState('titles', true);
        try {
            const { data, error } = await supabase
                .from('title_shop')
                .select('*')
                .eq('is_available', true); // Fetch all available, purchasable status checked later
            if (error) throw error;
            allTitlesFromDB = data || []; // Update global allTitlesFromDB
            console.log(`[Titles] Fetched all titles from DB: ${allTitlesFromDB.length}.`);
            return allTitlesFromDB;
        } catch (error) {
            console.error("[Titles] Error fetching all titles:", error);
            showToast("Chyba", "Chyba načítání titulů z obchodu.", "error");
            allTitlesFromDB = [];
            return [];
        } finally {
            setLoadingState('titles', false);
        }
    }

    async function fetchAvatarDecorationsData() { console.warn("Avatar decorations fetching skipped: Table 'avatar_decorations_shop' does not exist or feature is disabled."); setLoadingState('avatarDecorations', false); return []; } // Kept as is

    async function fetchLeaderboardData() {
        if (!supabase) return [];
        setLoadingState('leaderboard', true);
        try {
            const { data, error } = await supabase
                .from('leaderboard')
                .select(`rank, user_id, points, badges_count, profile:profiles!inner(id, first_name, last_name, username, avatar_url, level, streak_days, selected_title, selected_decoration)`)
                .eq('period', 'overall') // Assuming 'overall' is the main leaderboard
                .order('rank', { ascending: true })
                .limit(LEADERBOARD_LIMIT);
            if (error) throw error;
            const rankedData = (data || []).map((entry, index) => ({
                ...entry,
                calculated_rank: entry.rank ?? (index + 1) // Fallback rank if DB rank is null
            }));
            return rankedData;
        } catch (e) {
            console.error("Error fetching leaderboard:", e);
            return [];
        } finally {
            // setLoadingState('leaderboard', false); // Turned off after rendering
        }
    }
    async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) {
        if (!supabase || !userId) return { unreadCount: 0, notifications: [] };
        setLoadingState('notifications', true);
        try {
            const { data, error, count } = await supabase
                .from('user_notifications')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return { unreadCount: count ?? 0, notifications: data || [] };
        } catch (e) {
            console.error("Error fetching notifications:", e);
            return { unreadCount: 0, notifications: [] };
        } finally {
            // setLoadingState('notifications', false); // Turned off after rendering
        }
    }

    async function fetchUserDiagnosticTestCount(userId) {
        if (!supabase || !userId) return 0;
        setLoadingState('userDiagnostics', true);
        try {
            const { count, error } = await supabase
                .from('user_diagnostics')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId);
            if (error) throw error;
            console.log(`[FetchData] Diagnostic tests count for user ${userId}: ${count || 0}`);
            return count || 0;
        } catch (e) {
            console.error("Error fetching user diagnostic test count:", e);
            return 0;
        } finally {
            setLoadingState('userDiagnostics', false);
        }
    }

    async function fetchUserLearningLogsCount(userId) {
        if (!supabase || !userId) return 0;
        setLoadingState('userLearningLogs', true);
        try {
            const { count, error } = await supabase
                .from('learning_logs_detailed')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId);
            if (error) throw error;
            console.log(`[FetchData] Learning logs count for user ${userId}: ${count || 0}`);
            return count || 0;
        } catch (e) {
            console.error("Error fetching user learning logs count:", e);
            return 0;
        } finally {
            setLoadingState('userLearningLogs', false);
        }
    }

    async function fetchUserTopicProgressList(userId) {
        if (!supabase || !userId) return [];
        setLoadingState('userTopicProgress', true);
        try {
            const { data, error } = await supabase
                .from('user_topic_progress')
                .select('topic_id, progress_percentage')
                .eq('user_id', userId);
            if (error) throw error;
            console.log(`[FetchData] User topic progress for user ${userId}:`, data);
            return data || [];
        } catch (e) {
            console.error("Error fetching user topic progress list:", e);
            return [];
        } finally {
            setLoadingState('userTopicProgress', false);
        }
    }

    async function fetchAllExamTopics() {
        if (!supabase) return [];
        setLoadingState('examTopics', true);
        try {
            const { data, error } = await supabase
                .from('exam_topics')
                .select('id, name');
            if (error) throw error;
            console.log(`[FetchData] All exam topics:`, data);
            return data || [];
        } catch (e) {
            console.error("Error fetching all exam topics:", e);
            return [];
        } finally {
            setLoadingState('examTopics', false);
        }
    }

    async function fetchUserStudyPlansCount(userId) {
        if (!supabase || !userId) return 0;
        setLoadingState('userStudyPlans', true);
        try {
            const { count, error } = await supabase
                .from('study_plans')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId);
            if (error) throw error;
            console.log(`[FetchData] Study plans count for user ${userId}: ${count || 0}`);
            return count || 0;
        } catch (e) {
            console.error("Error fetching user study plans count:", e);
            return 0;
        } finally {
            setLoadingState('userStudyPlans', false);
        }
    }

    async function fetchUserAiLessonsCompletedCount(userId) {
        // This is a placeholder as the schema for AI lesson completion isn't fully defined yet.
        // You'll need to adapt this to your actual table and criteria for "completed".
        if (!supabase || !userId) return 0;
        setLoadingState('userAiLessons', true);
        try {
            // EXAMPLE: Assuming 'ai_sessions' has a 'status' column that can be 'completed'
            const { count, error } = await supabase
                .from('ai_sessions')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('status', 'ended'); // Or 'completed', depending on your schema
            if (error) throw error;
            console.log(`[FetchData] AI lessons completed count for user ${userId}: ${count || 0}`);
            return count || 0;
        } catch (e) {
            console.error("Error fetching user AI lessons completed count:", e);
            return 0;
        } finally {
            setLoadingState('userAiLessons', false);
        }
    }


    // --- END: Data Fetching Functions ---

    // --- START: Achievement Logic ---
    function checkRequirements(profileData, requirements, otherData = {}) {
        if (!profileData || !requirements || typeof requirements !== 'object') {
            console.warn("[Achievements CheckReq] Invalid input for checking requirements.", profileData, requirements);
            return { met: false, current: 0, target: requirements.target || requirements.count || 1, progressText: "Chyba" };
        }

        const reqType = requirements.type;
        const reqTarget = parseInt(requirements.target, 10);
        const reqCount = parseInt(requirements.count, 10);
        let currentValue = 0;
        let targetValue = requirements.target || requirements.count || 1;
        let progressText = "";

        try {
            switch (reqType) {
                case 'profile_fields_filled':
                    const fields = requirements.fields_required || [];
                    let filledCount = 0;
                    fields.forEach(fieldKey => {
                        if (profileData[fieldKey] && String(profileData[fieldKey]).trim() !== '') {
                            filledCount++;
                        }
                    });
                    currentValue = filledCount;
                    targetValue = requirements.min_fields_to_fill || fields.length;
                    progressText = `${currentValue}/${targetValue} polí`;
                    break;
                case 'avatar_set':
                    currentValue = (profileData.avatar_url && profileData.avatar_url.trim() !== '') ? 1 : 0;
                    targetValue = 1;
                    progressText = currentValue >= targetValue ? "Nastaven" : "Nenastaven";
                    break;
                case 'level_reached':
                    currentValue = profileData.level ?? 1;
                    targetValue = reqTarget;
                    progressText = `${currentValue}/${targetValue} úr.`;
                    break;
                case 'experience_earned':
                    currentValue = profileData.experience ?? 0;
                    targetValue = reqTarget;
                    progressText = `${currentValue}/${targetValue} XP`;
                    break;
                case 'points_earned_total':
                    currentValue = profileData.points ?? 0;
                    targetValue = reqTarget;
                    progressText = `${currentValue}/${targetValue} kr.`;
                    break;
                case 'streak_days_reached':
                    currentValue = profileData.streak_days ?? 0;
                    targetValue = reqTarget;
                    progressText = `${currentValue}/${targetValue} dní`;
                    break;
                case 'diagnostic_test_completed':
                    currentValue = otherData.userDiagnosticTestsCount || 0;
                    targetValue = reqCount || 1;
                    progressText = `${currentValue}/${targetValue} testů`;
                    break;
                case 'study_plan_created':
                    currentValue = otherData.userStudyPlansCount || 0;
                    targetValue = reqCount || 1;
                    progressText = `${currentValue}/${targetValue} plánů`;
                    break;
                case 'ai_lesson_completed':
                    currentValue = otherData.userAiLessonsCompletedCount || 0;
                    targetValue = reqCount || 1;
                    progressText = `${currentValue}/${targetValue} lekcí`;
                    break;
                case 'learning_logs_created':
                    currentValue = otherData.userLearningLogsCount || 0;
                    targetValue = reqTarget;
                    progressText = `${currentValue}/${targetValue} záznamů`;
                    break;
                case 'topic_progress_reached':
                    const topicProgress = (otherData.userTopicProgressList || []).find(tp => tp.topic_id === requirements.topic_id);
                    currentValue = topicProgress ? topicProgress.progress_percentage : 0;
                    targetValue = requirements.min_progress_percentage || 100;
                    const topicName = (otherData.allExamTopics || []).find(et => et.id === requirements.topic_id)?.name || `Téma ID ${requirements.topic_id}`;
                    progressText = `${currentValue}% v "${topicName}" (Cíl: ${targetValue}%)`;
                    break;
                case 'avatar_decoration_equipped':
                    currentValue = (profileData.selected_decoration && profileData.selected_decoration.trim() !== '') ? 1 : 0;
                    targetValue = 1;
                    progressText = currentValue >= targetValue ? "Vylepšeno" : "Nevylepšeno";
                    break;
                case 'title_equipped':
                    currentValue = (profileData.selected_title && profileData.selected_title.trim() !== '') ? 1 : 0;
                    targetValue = 1;
                    progressText = currentValue >= targetValue ? "Vyzbrojen" : "Nevyzbrojen";
                    break;
                case 'exercises_completed_total':
                     currentValue = profileData.completed_exercises ?? 0;
                     targetValue = reqTarget;
                     progressText = `${currentValue}/${targetValue} cvičení`;
                     break;
                default:
                    console.warn(`[Achievements CheckReq] Unknown requirement type: ${reqType}`);
                    progressText = "Neznámý typ";
                    return { met: false, current: 0, target: targetValue, progressText };
            }
            return { met: currentValue >= targetValue, current: currentValue, target: targetValue, progressText };
        } catch (e) {
            console.error("[Achievements CheckReq] Error evaluating requirement:", e, requirements, profileData);
            return { met: false, current: 0, target: targetValue, progressText: "Chyba hodnocení" };
        }
    }

    async function awardBadge(userId, badgeId, badgeTitle, pointsAwarded = 0) {
        const supabaseInstance = supabase;
        if (!supabaseInstance || !userId || !badgeId) { console.error("[AwardBadge] Missing Supabase client, userId, or badgeId."); return; }
        console.log(`[AwardBadge] Attempting to award badge ${badgeId} (${badgeTitle}) to user ${userId}...`);
        try {
            const { data: existing, error: checkError } = await supabaseInstance.from('user_badges').select('badge_id').eq('user_id', userId).eq('badge_id', badgeId).limit(1);
            if (checkError) throw checkError;
            if (existing && existing.length > 0) { console.log(`[AwardBadge] Badge ${badgeId} already awarded to user ${userId}. Skipping.`); return; }

            const { error: insertError } = await supabaseInstance.from('user_badges').insert({ user_id: userId, badge_id: badgeId });
            if (insertError) throw insertError;
            console.log(`[AwardBadge] Badge ${badgeId} inserted for user ${userId}.`);

            const { data: currentProfileData, error: fetchProfileError } = await supabaseInstance.from('profiles').select('badges_count, points').eq('id', userId).single();
            if (fetchProfileError) { console.error("[AwardBadge] Error fetching current profile stats for update:", fetchProfileError); }
            else if (currentProfileData) {
                const currentBadgeCount = currentProfileData.badges_count ?? 0;
                let currentPoints = currentProfileData.points ?? 0; // Use let for points
                const updates = { badges_count: currentBadgeCount + 1, updated_at: new Date().toISOString() };
                if (pointsAwarded > 0) {
                    updates.points = currentPoints + pointsAwarded;
                    currentPoints = updates.points; // Update local currentPoints if awarding
                }
                const { error: updateProfileError } = await supabaseInstance.from('profiles').update(updates).eq('id', userId);
                if (updateProfileError) { console.error("[AwardBadge] Error updating profile stats:", updateProfileError); }
                else {
                    console.log(`[AwardBadge] Profile stats updated for user ${userId}: badges_count=${updates.badges_count}` + (updates.points ? `, points=${updates.points}` : ''));
                    if (currentProfile && currentProfile.id === userId) { // Update global currentProfile
                        currentProfile.badges_count = updates.badges_count;
                        if (updates.points) currentProfile.points = updates.points;
                        updateSidebarProfile(currentProfile, allTitlesFromDB); // Refresh sidebar with new points/badges
                        updateStatsCards({ // Also update stats cards on the page
                            badges: currentProfile.badges_count,
                            points: currentProfile.points,
                            streak_current: currentProfile.streak_days,
                            streak_longest: currentProfile.longest_streak_days,
                            rank: leaderboardData.find(u => u.user_id === currentUser.id)?.rank,
                            totalUsers: leaderboardData.length > 0 ? leaderboardData.length : (await supabase.from('profiles').select('id', {count: 'exact', head: true})).count
                        });
                    }
                }
            }

            const notificationTitle = `🏆 Nový Odznak!`;
            const notificationMessage = `Získali jste odznak: "${badgeTitle}"! ${pointsAwarded > 0 ? `(+${pointsAwarded} kreditů)` : ''}`;
            const { error: notifyError } = await supabaseInstance.from('user_notifications').insert({ user_id: userId, title: notificationTitle, message: notificationMessage, type: 'badge', link: '/dashboard/oceneni.html' });
            if (notifyError) console.error("[AwardBadge] Error creating notification:", notifyError);
            else console.log(`[AwardBadge] Notification created for badge ${badgeId}`);

            showToast(notificationTitle, notificationMessage, 'success', 6000);
        } catch (error) {
            console.error(`[AwardBadge] Error awarding badge ${badgeId} to user ${userId}:`, error);
        }
    }

    async function checkAndAwardAchievements(userId) {
        const supabaseInstance = supabase;
        if (!supabaseInstance || !userId || !currentProfile) {
            console.error("[Achievements Check] Missing Supabase client, userId, or currentProfile.");
            return;
        }
        console.log(`[Achievements Check] Starting check for user ${userId}...`);
        setLoadingState('availableBadges', true); // Show loading for available badges during check
        try {
            const profileDataForCheck = currentProfile;

            const { data: allBadgesData, error: badgesError } = await supabaseInstance.from('badges').select('id, title, requirements, points').order('id');
            if (badgesError) throw badgesError;
            if (!allBadgesData || allBadgesData.length === 0) { console.log("[Achievements Check] No badge definitions found."); return; }

            const { data: earnedBadgesData, error: earnedError } = await supabaseInstance.from('user_badges').select('badge_id').eq('user_id', userId);
            if (earnedError) throw earnedError;

            const earnedBadgeIds = new Set((earnedBadgesData || []).map(b => b.badge_id));
            const unearnedBadges = allBadgesData.filter(b => !earnedBadgeIds.has(b.id));
            console.log(`[Achievements Check] Found ${unearnedBadges.length} unearned badges to check.`);

            const otherDataForAchievements = {
                userDiagnosticTestsCount,
                userLearningLogsCount,
                userTopicProgressList,
                userStudyPlansCount,
                userAiLessonsCompletedCount,
                allExamTopics
            };

            let newBadgeAwarded = false;
            for (const badge of unearnedBadges) {
                const progressResult = checkRequirements(profileDataForCheck, badge.requirements, otherDataForAchievements);
                if (progressResult.met) {
                    console.log(`[Achievements Check] Criteria MET for badge ID: ${badge.id} (${badge.title})! Triggering award...`);
                    await awardBadge(userId, badge.id, badge.title, badge.points || 0);
                    newBadgeAwarded = true;
                }
            }
            console.log(`[Achievements Check] Finished checking for user ${userId}. New badges awarded: ${newBadgeAwarded}`);

            if (newBadgeAwarded) { // If any badge was awarded, re-fetch user's badges
                userBadges = await fetchUserEarnedBadges(userId);
                renderUserBadges(userBadges); // Re-render "Vaše Odznaky"
            }
            // Always re-render available badges to update progress
            renderAvailableBadges(allBadgesData, userBadges, currentProfile, otherDataForAchievements);

        } catch (error) {
            console.error(`[Achievements Check] Error during check/award process for user ${userId}:`, error);
        } finally {
            setLoadingState('availableBadges', false);
        }
    }
    // --- END: Achievement Logic ---

    // --- START: Data Rendering Functions ---
    function updateSidebarProfile(profile, titlesData = allTitlesFromDB) {
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) return;
        if (profile) {
            const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || currentUser?.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(profile);
            const avatarUrl = profile.avatar_url;
            const selectedDecorationKey = profile.selected_decoration || '';

            const avatarWrapper = ui.sidebarAvatar.closest('.avatar-wrapper');
            if (avatarWrapper) {
                // Remove all potential decoration classes first
                const decorationClasses = (allDecorations || []).map(d => d.decoration_key).filter(Boolean);
                decorationClasses.forEach(cls => avatarWrapper.classList.remove(cls));
                // Add the new one if it exists
                if (selectedDecorationKey) {
                    avatarWrapper.classList.add(sanitizeHTML(selectedDecorationKey));
                }
                avatarWrapper.dataset.decorationKey = selectedDecorationKey;
            }


            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
            const sidebarImg = ui.sidebarAvatar.querySelector('img');
            if(sidebarImg) { sidebarImg.onerror = () => { ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; }

            const selectedTitleKey = profile.selected_title;
            let displayTitle = 'Pilot';
            if (selectedTitleKey && titlesData && titlesData.length > 0) {
                const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) displayTitle = foundTitle.name;
            }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.title = sanitizeHTML(displayTitle);
        } else {
            ui.sidebarName.textContent = "Pilot"; ui.sidebarAvatar.textContent = '?';
            ui.sidebarUserTitle.textContent = 'Pilot'; ui.sidebarUserTitle.removeAttribute('title');
             const avatarWrapper = ui.sidebarAvatar?.closest('.avatar-wrapper');
            if (avatarWrapper) {
                const decorationClasses = (allDecorations || []).map(d => d.decoration_key).filter(Boolean);
                decorationClasses.forEach(cls => avatarWrapper.classList.remove(cls));
                avatarWrapper.dataset.decorationKey = '';
            }
        }
    }

    function updateStatsCards(stats) {
        if (!stats) { console.warn("No stats data to update cards."); return; }
        const getVal = (v) => (v !== null && v !== undefined) ? v : '-';

        if (ui.badgesCount) ui.badgesCount.textContent = getVal(stats.badges);
        if (ui.pointsCount) ui.pointsCount.textContent = getVal(stats.points);
        if (ui.streakDays) ui.streakDays.textContent = getVal(stats.streak_current);
        if (ui.streakChange) ui.streakChange.textContent = `MAX: ${getVal(stats.streak_longest)} dní`;
        if (ui.rankValue) ui.rankValue.textContent = getVal(stats.rank);
        if (ui.rankChange && ui.totalUsers) ui.rankChange.innerHTML = `<i class="fas fa-users"></i> z ${getVal(stats.totalUsers)} pilotů`;

        if (ui.badgesCard) ui.badgesCard.classList.remove('loading');
        if (ui.pointsCard) ui.pointsCard.classList.remove('loading');
        if (ui.streakCard) ui.streakCard.classList.remove('loading');
        if (ui.rankCard) ui.rankCard.classList.remove('loading');
    }

    function renderUserBadges(earnedBadges) {
        setLoadingState('userBadges', false);
        if (!ui.badgeGrid || !ui.emptyBadges) return;
        ui.badgeGrid.innerHTML = '';
        if (!earnedBadges || earnedBadges.length === 0) {
            ui.emptyBadges.style.display = 'block';
            ui.badgeGrid.style.display = 'none';
            return;
        }
        ui.emptyBadges.style.display = 'none';
        ui.badgeGrid.style.display = 'grid';
        const fragment = document.createDocumentFragment();
        earnedBadges.forEach((ub, index) => {
            const badge = ub.badge;
            if (!badge) return;
            const badgeType = badge.type?.toLowerCase() || 'default';
            const visual = badgeVisuals[badgeType] || badgeVisuals.default; // badgeVisuals defined in oceneni.js global scope
            const badgeElement = document.createElement('div');
            badgeElement.className = 'badge-card card';
            badgeElement.setAttribute('data-animate', '');
            badgeElement.style.setProperty('--animation-order', index);
            badgeElement.innerHTML = `
                <div class="badge-icon ${badgeType}" style="background: ${visual.gradient};">
                    <i class="fas ${sanitizeHTML(visual.icon)}"></i>
                </div>
                <h3 class="badge-title">${sanitizeHTML(badge.title)}</h3>
                <p class="badge-desc">${sanitizeHTML(badge.description || '')}</p>
                <div class="badge-date">
                    <i class="far fa-calendar-alt"></i> ${formatDate(ub.earned_at)}
                </div>`;
            fragment.appendChild(badgeElement);
        });
        ui.badgeGrid.appendChild(fragment);
        requestAnimationFrame(initScrollAnimations);
    }

    function renderAvailableBadges(allBadgesDef, userBadgesData, profile, otherData = {}) {
        setLoadingState('availableBadges', false);
        if (!ui.availableBadgesGrid || !ui.emptyAvailableBadges) {
            console.warn("[Render AvailableBadges] UI elements missing.");
            return;
        }
        const earnedIds = new Set((userBadgesData || []).map(ub => ub.badge_id));
        const available = (allBadgesDef || []).filter(b => !earnedIds.has(b.id));

        ui.availableBadgesGrid.innerHTML = '';
        if (available.length === 0) {
            ui.emptyAvailableBadges.style.display = 'block';
            ui.availableBadgesGrid.style.display = 'none';
            ui.emptyAvailableBadges.innerHTML = `
                <i class="fas fa-check-double empty-state-icon" style="color: var(--accent-lime);"></i>
                <h3 class="empty-state-title">VŠECHNY VÝZVY SPLNĚNY!</h3>
                <p class="empty-state-desc"> Gratulace, pilote! Získal jsi všechna dostupná ocenění. Nové výzvy brzy dorazí.</p>`;
            return;
        }
        ui.emptyAvailableBadges.style.display = 'none';
        ui.availableBadgesGrid.style.display = 'grid';

        const fragment = document.createDocumentFragment();
        available.forEach((badge, index) => {
            const badgeType = badge.type?.toLowerCase() || 'default';
            const visual = badgeVisuals[badgeType] || badgeVisuals.default;

            const progressResult = checkRequirements(profile, badge.requirements, otherData);
            const currentValue = progressResult.current;
            const targetValue = progressResult.target;
            const progressPercent = targetValue > 0 ? Math.min(100, Math.round((currentValue / targetValue) * 100)) : 0;
            // Použijeme progressText z checkRequirements, pokud je k dispozici, jinak standardní formát
            const displayProgressText = progressResult.progressText || `${currentValue}/${targetValue}`;


            const badgeElement = document.createElement('div');
            badgeElement.className = 'achievement-card card';
            badgeElement.setAttribute('data-animate', '');
            badgeElement.style.setProperty('--animation-order', index);
            badgeElement.innerHTML = `
                <div class="achievement-icon ${badgeType}" style="background: ${visual.gradient};">
                    <i class="fas ${sanitizeHTML(visual.icon)}"></i>
                </div>
                <div class="achievement-content">
                    <h3 class="achievement-title">${sanitizeHTML(badge.title)}</h3>
                    <p class="achievement-desc">${sanitizeHTML(badge.description || '')}</p>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%; background: ${visual.gradient};"></div>
                        </div>
                        <div class="progress-stats">${progressPercent}% (${displayProgressText})</div>
                    </div>
                </div>`;
            fragment.appendChild(badgeElement);
        });
        ui.availableBadgesGrid.appendChild(fragment);
        requestAnimationFrame(initScrollAnimations);
    }

    function renderLeaderboard(data) { /* ... */ }
    function selectDailyUserSpecificTitles(allPurchasable, purchasedKeys, userId) { /* ... */ return [];}
    function renderTitleShop(titlesToDisplay, profile) { /* ... */ }
    function renderUserTitlesInventory(profile, allTitlesData) { /* ... */ }
    function renderAvatarDecorationsShop(decorations, profile) { /* ... */ }
    function renderNotifications(count, notifications) { /* ... */ }
    // --- END: Data Rendering Functions ---

    // --- START: Shop Interaction Logic (Placeholders) ---
    async function handleShopInteraction(event) { console.log("Shop interaction triggered"); }
    async function handleBuyItem(itemType, itemKey, cost, buttonElement) { console.log("Buy item:", itemType, itemKey); }
    async function handleEquipItem(itemType, itemKey, buttonElement) { console.log("Equip item:", itemType, itemKey); }
    // --- END: Shop Interaction Logic ---

    // --- START: Notification Logic (Placeholders) ---
    async function handleNotificationClick(event) { console.log("Notification clicked"); }
    async function handleMarkAllReadClick() { console.log("Mark all read clicked"); }
    // --- END: Notification Logic ---

    // --- START: Load All Data ---
    async function loadAllAwardData() {
        if (!currentUser || !supabase) {
            showError("Chyba: Nelze načíst data ocenění bez přihlášení.", true);
            setLoadingState('all', false); return;
        }
        console.log("🔄 [LoadAwards] Loading all award page data...");
        hideError();
        setLoadingState('all', true);
        try {
            // Fetch all necessary data in parallel
            const results = await Promise.allSettled([
                fetchUserFullProfile(currentUser.id),
                fetchAllBadgesDefinition(),
                fetchUserEarnedBadges(currentUser.id),
                fetchAllPurchasableTitles(),
                fetchAvatarDecorationsData(),
                fetchLeaderboardData(),
                fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT),
                fetchUserDiagnosticTestCount(currentUser.id),
                fetchUserLearningLogsCount(currentUser.id),
                fetchUserTopicProgressList(currentUser.id),
                fetchAllExamTopics(),
                fetchUserStudyPlansCount(currentUser.id),
                fetchUserAiLessonsCompletedCount(currentUser.id),
                fetchUserStats(currentUser.id) // Fetch user_stats data too
            ]);
            console.log("[LoadAwards] Data fetch results:", results);

            const [
                profileResult, allBadgesResult, userBadgesResult,
                allTitlesResult, avatarShopResult, leaderboardResult,
                notificationsResult, diagnosticCountResult, learningLogsCountResult,
                topicProgressResult, examTopicsResult, studyPlansCountResult,
                aiLessonsCountResult, userStatsResult
            ] = results;

            if (profileResult.status === 'fulfilled' && profileResult.value) {
                currentProfile = profileResult.value;
                 if (!currentProfile.preferences) currentProfile.preferences = {};
            } else {
                console.error("CRITICAL: Profile fetch failed:", profileResult.reason);
                showError("Nepodařilo se načíst váš profil. Některé funkce nemusí být dostupné.", true);
                currentProfile = currentProfile || { id: currentUser.id, email: currentUser.email, points: 0, badges_count: 0, streak_days: 0, longest_streak_days:0 };
            }

            allBadges = (allBadgesResult.status === 'fulfilled') ? allBadgesResult.value : [];
            userBadges = (userBadgesResult.status === 'fulfilled') ? userBadgesResult.value : [];
            allTitlesFromDB = (allTitlesResult.status === 'fulfilled') ? allTitlesResult.value : [];
            allDecorations = (avatarShopResult.status === 'fulfilled') ? avatarShopResult.value : [];
            leaderboardData = (leaderboardResult.status === 'fulfilled') ? leaderboardResult.value : [];
            const { unreadCount, notifications: fetchedNotifications } = (notificationsResult.status === 'fulfilled') ? notificationsResult.value : { unreadCount: 0, notifications: [] };

            userDiagnosticTestsCount = (diagnosticCountResult.status === 'fulfilled') ? diagnosticCountResult.value : 0;
            userLearningLogsCount = (learningLogsCountResult.status === 'fulfilled') ? learningLogsCountResult.value : 0;
            userTopicProgressList = (topicProgressResult.status === 'fulfilled') ? topicProgressResult.value : [];
            allExamTopics = (examTopicsResult.status === 'fulfilled') ? examTopicsResult.value : [];
            userStudyPlansCount = (studyPlansCountResult.status === 'fulfilled') ? studyPlansCountResult.value : 0;
            userAiLessonsCompletedCount = (aiLessonsCountResult.status === 'fulfilled') ? aiLessonsCountResult.value : 0;

            const fetchedUserStats = (userStatsResult.status === 'fulfilled' && userStatsResult.value) ? userStatsResult.value : {};

            updateSidebarProfile(currentProfile, allTitlesFromDB);
            updateStatsCards({
                badges: currentProfile.badges_count,
                points: currentProfile.points,
                streak_current: currentProfile.streak_days,
                streak_longest: currentProfile.longest_streak_days, // Corrected to use profile's longest_streak_days
                rank: leaderboardData.find(u => u.user_id === currentUser.id)?.rank,
                totalUsers: leaderboardData.length > 0 ? leaderboardData.length : (await supabase.from('profiles').select('id', {count: 'exact', head: true})).count
            });

            renderUserBadges(userBadges);
            const otherDataForAchievements = {
                userDiagnosticTestsCount,
                userLearningLogsCount,
                userTopicProgressList,
                userStudyPlansCount,
                userAiLessonsCompletedCount,
                allExamTopics
            };
            renderAvailableBadges(allBadges, userBadges, currentProfile, otherDataForAchievements);
            renderLeaderboard(leaderboardData);
            titleShopTitles = selectDailyUserSpecificTitles(allTitlesFromDB, currentProfile.purchased_titles || [], currentUser.id);
            renderTitleShop(titleShopTitles, currentProfile);
            renderUserTitlesInventory(currentProfile, allTitlesFromDB);
            renderAvatarDecorationsShop(allDecorations, currentProfile);
            renderNotifications(unreadCount, fetchedNotifications);

            await checkAndAwardAchievements(currentUser.id);

            console.log("✅ [LoadAwards] All award page data loaded and rendered.");
        } catch (error) {
            console.error("❌ [LoadAwards] Unexpected error during loading award data:", error);
            showError(`Nepodařilo se načíst data pro stránku Ocenění: ${error.message}`, true);
        } finally {
            setLoadingState('all', false);
            initTooltips();
        }
    }
    // --- END: Load All Data ---

    // --- START: Event Listeners Setup ---
    function setupEventListeners() {
        console.log("[Oceneni SETUP] Setting up event listeners...");
        const safeAddListener = (el, ev, fn, key) => {
            if (el) {
                if (el._eventHandlers && el._eventHandlers[key]) {
                    el.removeEventListener(ev, el._eventHandlers[key]);
                }
                el.addEventListener(ev, fn);
                if (!el._eventHandlers) el._eventHandlers = {};
                el._eventHandlers[key] = fn;
            } else {
                if(key.startsWith('toggle')) console.warn(`[SETUP] Non-critical toggle button element not found: ${key}`);
                else console.warn(`[SETUP] Element not found for listener: ${key}`);
            }
        };
        safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
        safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
        safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');
        safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn');
        safeAddListener(ui.refreshDataBtn, 'click', loadAllAwardData, 'refreshDataBtn');
        safeAddListener(ui.notificationBell, 'click', (e) => { e.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell');
        safeAddListener(ui.markAllRead, 'click', handleMarkAllReadClick, 'markAllRead');
        safeAddListener(ui.notificationsList, 'click', handleNotificationClick, 'notificationsList');
        safeAddListener(ui.titleShopGrid, 'click', handleShopInteraction, 'titleShopGrid');
        safeAddListener(ui.avatarDecorationsGrid, 'click', handleShopInteraction, 'avatarDecorationsGrid');
        if(ui.userTitlesInventoryGrid) safeAddListener(ui.userTitlesInventoryGrid, 'click', handleShopInteraction, 'userTitlesInventoryGrid');
        document.querySelectorAll('.sidebar-link').forEach(l => l.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }));
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        document.addEventListener('click', (e) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(e.target) && !ui.notificationBell?.contains(e.target)) { ui.notificationsDropdown.classList.remove('active'); } });

        const sectionToggleMap = {
            'toggleUserBadgesSection': ui.userBadgesContent,
            'toggleAvailableBadgesSection': ui.availableBadgesContent,
            'toggleUserTitlesSection': ui.userTitlesInventoryContent,
            'toggleTitleShopSection': ui.titleShopContent,
            'toggleAvatarDecorationsSection': ui.avatarDecorationsContent,
            'toggleLeaderboardSection': ui.leaderboardContent
        };

        Object.keys(sectionToggleMap).forEach(buttonKey => {
            const button = ui[buttonKey];
            const contentElement = sectionToggleMap[buttonKey];

            if (button && contentElement) {
                const sectionCard = button.closest('.card-section'); // Updated selector
                const storedState = localStorage.getItem(`section-${buttonKey}-collapsed`);
                let isInitiallyCollapsed = storedState === 'true';

                if (storedState === null && sectionCard) {
                    isInitiallyCollapsed = sectionCard.classList.contains('collapsed-section');
                }

                const icon = button.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-chevron-down', isInitiallyCollapsed);
                    icon.classList.toggle('fa-chevron-up', !isInitiallyCollapsed);
                }
                if (sectionCard) {
                     sectionCard.classList.toggle('collapsed-section', isInitiallyCollapsed);
                }
                if(isInitiallyCollapsed) {
                    contentElement.style.maxHeight = '0px';
                    contentElement.style.paddingTop = '0px';
                    contentElement.style.paddingBottom = '0px';
                    contentElement.style.marginTop = '0px';
                    contentElement.style.marginBottom = '0px';
                    contentElement.style.opacity = '0';
                    contentElement.style.visibility = 'hidden';
                } else {
                    // Ensure it's visible and has appropriate padding if not collapsed
                    contentElement.style.maxHeight = contentElement.scrollHeight + "px"; // Or a large enough value
                    contentElement.style.paddingTop = ''; // Reset to CSS default
                    contentElement.style.paddingBottom = ''; // Reset to CSS default
                    contentElement.style.marginTop = '';
                    contentElement.style.marginBottom = '';
                    contentElement.style.opacity = '1';
                    contentElement.style.visibility = 'visible';
                }


                safeAddListener(button, 'click', () => {
                    const isCurrentlyCollapsed = sectionCard ? sectionCard.classList.contains('collapsed-section') : (contentElement.style.maxHeight === '0px');
                    const isCollapsing = !isCurrentlyCollapsed; // If it's not collapsed, it's about to collapse

                    if(isCollapsing) {
                        contentElement.style.maxHeight = '0px';
                        contentElement.style.paddingTop = '0px';
                        contentElement.style.paddingBottom = '0px';
                        contentElement.style.marginTop = '0px';
                        contentElement.style.marginBottom = '0px';
                        contentElement.style.opacity = '0';
                        setTimeout(() => { contentElement.style.visibility = 'hidden';}, 450); // Match transition
                        sectionCard?.classList.add('collapsed-section');
                        localStorage.setItem(`section-${buttonKey}-collapsed`, 'true');
                    } else {
                        contentElement.style.visibility = 'visible';
                        contentElement.style.opacity = '1';
                        contentElement.style.paddingTop = ''; // Reset to CSS default
                        contentElement.style.paddingBottom = '';
                        contentElement.style.marginTop = '';
                        contentElement.style.marginBottom = '';
                        contentElement.style.maxHeight = contentElement.scrollHeight + "px";
                        sectionCard?.classList.remove('collapsed-section');
                        localStorage.setItem(`section-${buttonKey}-collapsed`, 'false');
                        // Ensure proper height recalculation if content was dynamic
                        setTimeout(() => {
                            if (contentElement.style.maxHeight !== '0px') { // Check if it's still supposed to be open
                                contentElement.style.maxHeight = contentElement.scrollHeight + "px";
                            }
                        }, 460); // After transition
                    }
                    const icon = button.querySelector('i');
                    if (icon) {
                        icon.classList.toggle('fa-chevron-down', isCollapsing);
                        icon.classList.toggle('fa-chevron-up', !isCollapsing);
                    }
                    console.log(`Toggled section for button ${buttonKey}. Collapsed: ${isCollapsing}`);
                }, buttonKey);
            } else {
                 if(!button) console.warn(`[SETUP] Toggle button with key '${buttonKey}' not found in ui cache.`);
                 if(!contentElement && button) console.warn(`[SETUP] Content element for toggle button '${buttonKey}' not found.`);
            }
        });
        console.log("[Oceneni SETUP] Event listeners setup complete.");
    }
    // --- END: Event Listeners Setup ---

    // --- START: Initialization ---
    async function initializeApp() {
        console.log("🚀 [Init Oceneni v23.23.5] Starting...");
        cacheDOMElements(); // Call this first
        if (!initializeSupabase()) return;
        applyInitialSidebarState();
        if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
        if (ui.mainContent) ui.mainContent.style.display = 'none';
        hideError();
        try {
            console.log("[Init Oceneni] Checking auth session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);
            if (!session || !session.user) { window.location.href = '/auth/index.html'; return; }
            currentUser = session.user;
            console.log(`[Init Oceneni] User authenticated (ID: ${currentUser.id}).`);

            // Initial profile load simplified here, full load in loadAllAwardData
            currentProfile = await fetchUserProfile(currentUser.id); // Basic profile for sidebar
            if (!currentProfile) {
                console.log("[Init Oceneni] Profile not found, attempting to create default (basic info for now)...");
                currentProfile = { id: currentUser.id, email: currentUser.email, points:0, badges_count:0, streak_days:0, longest_streak_days:0 }; // Minimal for sidebar
            }
            allTitlesFromDB = await fetchAllPurchasableTitles(); // Fetch titles for sidebar

            updateSidebarProfile(currentProfile, allTitlesFromDB);
            setupEventListeners(); // Setup basic listeners

            // Initialize UI features that don't depend on full data load
            initMouseFollower();
            initHeaderScrollDetection();
            updateCopyrightYear();
            updateOnlineStatus();

            // Load the main content for the awards page
            await loadAllAwardData();

            if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
            if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
            initTooltips(); // Init tooltips after content is loaded

            console.log("✅ [Init Oceneni] Page initialized.");
        } catch (error) {
            console.error("❌ [Init Oceneni] Kritická chyba inicializace:", error);
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE.</p>`; }
            else { showError(`Chyba inicializace: ${error.message}`, true); }
            if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show main content even on error for global error message
            setLoadingState('all', false);
        }
    }

    function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded."); } supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); if (!supabase) throw new Error("Supabase client creation failed."); console.log('[Supabase] Client initialized.'); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }
    // --- END: Initialization ---

    // --- Run ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }

})(); // End IIFE