// dashboard.js
// Verze: 27.0.11 - Načítání konfigurace odměn a milníků ze Supabase.
// EDIT LOG: Developer Goal -> Modify dashboard.js to fetch Monthly Rewards and Streak Milestones configurations from Supabase tables.
// EDIT LOG: Stage ->
// EDIT LOG: 1. Added new functions: fetchActiveMonthlyRewardsCalendarFromDB, fetchAllStreakMilestonesFromDB.
// EDIT LOG: 2. Modified initializeApp to call these new fetching functions and store their results.
// EDIT LOG: 3. Modified renderMonthlyCalendar to use data fetched from Supabase.
// EDIT LOG: 4. Modified renderStreakMilestones to use data fetched from Supabase.
// EDIT LOG: 5. Commented out old hardcoded mayRewardsConfig and STREAK_MILESTONES_CONFIG.
// EDIT LOG: 6. Ensured loading states for modals are handled.
// EDIT LOG: (Zachovány všechny předchozí opravy a funkce z v27.0.10)

(function() {
    'use strict';

    // --- START: Constants and Configuration ---
    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = [];
    let userStatsData = null;

    // Nové globální proměnné pro konfigurace načtené z DB
    let activeMonthlyRewardsCalendar = null; // Bude obsahovat { config: {}, days: [], bundles: {} }
    let allConfiguredStreakMilestones = null; // Bude obsahovat pole milníků s jejich odměnami

    const AUTH_TIMEOUT = 30000;
    const DATA_FETCH_TIMEOUT = 20000; // Pro standardní data
    const CONFIG_FETCH_TIMEOUT = 30000; // Delší timeout pro konfigurace

    const PROFILE_COLUMNS_TO_SELECT = 'id, username, first_name, last_name, email, avatar_url, bio, school, grade, level, completed_exercises, streak_days, last_login, badges_count, points, preferences, notifications, experience, purchased_titles, selected_title, monthly_claims, last_milestone_claimed, longest_streak_days, created_at, updated_at';

    let isLoading = {
        stats: false,
        activities: false,
        creditHistory: false,
        notifications: false,
        titles: false,
        monthlyRewards: false, // Pro načítání obsahu modálu
        streakMilestones: false, // Pro načítání obsahu modálu
        all: false,
        session: false,
        welcomeBanner: false,
        shortcuts: false,
        rewardsConfig: false, // Nový stav pro načítání konfigurací odměn
    };
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
    const MONTHLY_REWARD_DAYS = 31; // Maximální počet dní pro zobrazení, i když měsíc má méně
    // --- END: Constants and Configuration ---

    // --- START: UI Elements Cache (to be populated by cacheDOMElements) ---
    let ui = {};
    // --- END: UI Elements Cache ---

    // --- START: Reward Configurations (STARÉ, BUDOU ZAKOMENTOVÁNY) ---
    /*
    const STREAK_MILESTONES_CONFIG = {
        3: {
            name: "Ohnivý Začátek",
            description: "Udržte studijní sérii po dobu 3 dnů.",
            icon: "fas fa-fire-alt",
            rewards: [
                { type: 'xp', value: 25, name: '+25 ZK', icon_reward: 'fas fa-star' }
            ],
            reward_key: "streak_3_days"
        },
        // ... (zbytek STREAK_MILESTONES_CONFIG)
    };
    const sortedMilestoneDays = Object.keys(STREAK_MILESTONES_CONFIG).map(Number).sort((a, b) => a - b);

    const mayRewardsConfig = { // Květen = 4 (index od 0)
        1: { type: 'title', key: 'majovy_poutnik', name: 'Májový Poutník', icon: 'fas fa-hiking', description: "Začněte květen s exkluzivním titulem!" },
        // ... (zbytek mayRewardsConfig)
    };
    */
    // --- END: Reward Configurations (STARÉ) ---


    const activityVisuals = {
        exercise: { name: 'Trénink', icon: 'fa-laptop-code', class: 'exercise' },
        test: { name: 'Test', icon: 'fa-vial', class: 'test' },
        test_diagnostic_completed: { name: 'Diagnostický Test Dokončen', icon: 'fa-microscope', class: 'diagnostic' },
        vyuka_topic_started: { name: 'Výuka Zahájena', icon: 'fa-chalkboard-teacher', class: 'lesson' },
        vyuka_topic_finished: { name: 'Výuka Dokončena', icon: 'fa-graduation-cap', class: 'lesson' },
        badge: { name: 'Odznak Získán', icon: 'fa-medal', class: 'badge' },
        diagnostic: { name: 'Diagnostika', icon: 'fa-microscope', class: 'diagnostic' },
        lesson: { name: 'Nová Data', icon: 'fa-book-open', class: 'lesson' },
        plan_generated: { name: 'Plán Aktualizován', icon: 'fa-route', class: 'plan_generated' },
        level_up: { name: 'Level UP!', icon: 'fa-angle-double-up', class: 'level_up' },
        streak_milestone_claimed: { name: 'Milník Série', icon: 'fa-meteor', class: 'streak' },
        monthly_reward_claimed: { name: 'Měsíční Odměna', icon: 'fa-gift', class: 'badge' },
        title_awarded: { name: 'Titul Získán', icon: 'fa-crown', class: 'badge' },
        profile_updated: { name: 'Profil Aktualizován', icon: 'fa-user-edit', class: 'other' },
        custom_task_completed: { name: 'Úkol Dokončen', icon: 'fa-check-square', class: 'exercise' },
        points_earned: { name: 'Kredity Získány', icon: 'fa-arrow-up', class: 'points_earned' },
        points_spent: { name: 'Kredity Utraceny', icon: 'fa-arrow-down', class: 'points_spent' },
        other: { name: 'Systémová Zpráva', icon: 'fa-info-circle', class: 'other' },
        default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
    };

    // --- START: Helper Functions (bez změn oproti v27.0.10, pro úplnost ponechány) ---
    function cacheDOMElements() {
        const startTime = performance.now();
        console.log("[CACHE DOM] Caching elements...");
        const elementDefinitions = [
            { key: 'initialLoader', id: 'initial-loader', critical: true },
            { key: 'sidebar', id: 'sidebar', critical: true },
            { key: 'mainContent', id: 'main-content', critical: true },
            { key: 'dashboardHeader', query: '.dashboard-header', critical: true },
            { key: 'globalError', id: 'global-error', critical: true },
            { key: 'sidebarAvatar', id: 'sidebar-avatar', critical: true },
            { key: 'sidebarName', id: 'sidebar-name', critical: true },
            { key: 'sidebarUserTitle', id: 'sidebar-user-title', critical: true },
            { key: 'sidebarToggleBtn', id: 'sidebar-toggle-btn', critical: true },
            { key: 'welcomeTitle', id: 'welcome-title', critical: true },
            { key: 'statsCardsContainer', id: 'stats-cards-container', critical: true },
            { key: 'activityListContainerWrapper', id: 'recent-activities-container-wrapper', critical: true },
            { key: 'creditHistoryContainerWrapper', id: 'credit-history-container-wrapper', critical: true },
            { key: 'mainContentAreaPlaceholder', id: 'main-content-area-placeholder', critical: true },
            { key: 'sidebarOverlay', id: 'sidebar-overlay', critical: false },
            { key: 'mainMobileMenuToggle', id: 'main-mobile-menu-toggle', critical: false },
            { key: 'sidebarCloseToggle', id: 'sidebar-close-toggle', critical: false },
            { key: 'currentYearSidebar', id: 'currentYearSidebar', critical: false },
            { key: 'dashboardTitle', id: 'dashboard-title', critical: false },
            { key: 'refreshDataBtn', id: 'refresh-data-btn', critical: false },
            { key: 'notificationBell', id: 'notification-bell', critical: false },
            { key: 'notificationCount', id: 'notification-count', critical: false },
            { key: 'notificationsDropdown', id: 'notifications-dropdown', critical: false },
            { key: 'notificationsList', id: 'notifications-list', critical: false },
            { key: 'noNotificationsMsg', id: 'no-notifications-msg', critical: false },
            { key: 'markAllReadBtn', id: 'mark-all-read', critical: false },
            { key: 'startPracticeBtn', id: 'start-practice-btn', critical: false },
            { key: 'openMonthlyModalBtn', id: 'open-monthly-modal-btn', critical: false },
            { key: 'openStreakModalBtn', id: 'open-streak-modal-btn', critical: false },
            { key: 'progressCard', id: 'progress-card', critical: false },
            { key: 'dashboardLevelWidget', id: 'dashboard-level-widget', critical: false },
            { key: 'dashboardExpProgressBar', id: 'dashboard-exp-progress-bar', critical: false },
            { key: 'dashboardExpCurrent', id: 'dashboard-exp-current', critical: false },
            { key: 'dashboardExpRequired', id: 'dashboard-exp-required', critical: false },
            { key: 'dashboardExpPercentage', id: 'dashboard-exp-percentage', critical: false },
            { key: 'overallProgressValue', id: 'overall-progress-value', critical: false },
            { key: 'overallProgressDesc', id: 'overall-progress-desc', critical: false },
            { key: 'overallProgressFooter', id: 'overall-progress-footer', critical: false },
            { key: 'pointsCard', id: 'points-card', critical: false },
            { key: 'totalPointsValue', id: 'total-points-value', critical: false },
            { key: 'latestCreditChange', id: 'latest-credit-change', critical: false },
            { key: 'totalPointsFooter', id: 'total-points-footer', critical: false },
            { key: 'streakCard', id: 'streak-card', critical: false },
            { key: 'streakValue', id: 'streak-value', critical: false },
            { key: 'streakFooter', id: 'streak-footer', critical: false },
            { key: 'monthlyRewardModal', id: 'monthly-reward-modal', critical: false },
            { key: 'modalMonthlyCalendarGrid', id: 'modal-monthly-calendar-grid', critical: false },
            { key: 'modalMonthlyCalendarEmpty', id: 'modal-monthly-calendar-empty', critical: false },
            { key: 'modalCurrentMonthYearSpan', id: 'modal-current-month-year', critical: false },
            { key: 'closeMonthlyModalBtn', id: 'close-monthly-modal-btn', critical: false },
            { key: 'streakMilestonesModal', id: 'streak-milestones-modal', critical: false },
            { key: 'modalMilestonesGrid', id: 'modal-milestones-grid', critical: false },
            { key: 'modalMilestonesEmpty', id: 'modal-milestones-empty', critical: false },
            { key: 'modalCurrentStreakValue', id: 'modal-current-streak-value', critical: false },
            { key: 'modalLongestStreakValue', id: 'modal-longest-streak-value', critical: false},
            { key: 'closeStreakModalBtn', id: 'close-streak-modal-btn', critical: false },
            { key: 'toastContainer', id: 'toast-container', critical: false },
            { key: 'offlineBanner', id: 'offline-banner', critical: false },
            { key: 'mouseFollower', id: 'mouse-follower', critical: false },
            { key: 'currentYearFooter', id: 'currentYearFooter', critical: false },
            { key: 'welcomeBannerReal', id: 'welcome-banner-real', critical: false },
            { key: 'welcomeBannerSkeleton', id: 'welcome-banner-skeleton', critical: false },
            { key: 'statsCardsSkeletonContainer', id: 'stats-cards-skeleton-container', critical: false },
            { key: 'shortcutGridReal', id: 'shortcut-grid-real', critical: false },
            { key: 'shortcutGridSkeletonContainer', id: 'shortcut-grid-skeleton-container', critical: false },
            { key: 'activityListContainer', id: 'activity-list-container', critical: false },
            { key: 'activityListSkeletonContainer', id: 'activity-list-skeleton-container', critical: false },
            { key: 'creditHistoryListContainer', id: 'credit-history-list-container', critical: false },
            { key: 'creditHistorySkeletonContainer', id: 'credit-history-skeleton-container', critical: false },
        ];
        const notFoundCritical = [];
        ui = {};
        elementDefinitions.forEach(def => {
            const element = def.id ? document.getElementById(def.id) : document.querySelector(def.query);
            if (element) {
                ui[def.key] = element;
            } else {
                ui[def.key] = null;
                if (def.critical) notFoundCritical.push(`${def.key} (ID/Query: ${def.id || def.query})`);
                else console.warn(`[CACHE DOM] Non-critical element not found: ${def.key}`);
            }
        });
        ui.activityList = document.getElementById('activity-list');
        ui.activityListEmptyState = document.getElementById('activity-list-empty-state');
        ui.activityListErrorState = document.getElementById('activity-list-error-state');
        ui.creditHistoryList = document.getElementById('credit-history-list');
        ui.creditHistoryEmptyState = document.getElementById('credit-history-empty-state');
        ui.creditHistoryErrorState = document.getElementById('credit-history-error-state');

        if (notFoundCritical.length > 0) {
            console.error(`[CACHE DOM] CRITICAL elements not found: (${notFoundCritical.length})`, notFoundCritical);
            throw new Error(`Chyba načítání stránky: Kritické komponenty chybí (${notFoundCritical.join(', ')}).`);
        } else {
            console.log("[CACHE DOM] All critical elements found.");
        }
        const endTime = performance.now();
        console.log(`[CACHE DOM] Caching complete. UI object:`, ui, `Time: ${(endTime - startTime).toFixed(2)}ms`);
    }
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) { console.warn("Toast container not found."); return; } try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Error displaying toast:", e); } }
    function showError(message, isGlobal = false, targetElement = ui.globalError) { console.error("Error:", message); const errorDisplayElement = isGlobal ? ui.globalError : targetElement; if (errorDisplayElement) { if (targetElement === ui.mainContentAreaPlaceholder && !isGlobal) { errorDisplayElement.innerHTML = `<div class="error-message card" style="margin: 2rem; padding: 2rem; text-align: center;"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="content-retry-btn" style="margin-top:1rem;">Zkusit znovu</button></div>`; errorDisplayElement.style.display = 'flex'; const retryBtn = errorDisplayElement.querySelector('#content-retry-btn'); if (retryBtn) { retryBtn.onclick = () => { hideError(errorDisplayElement); initializeApp(); }; } } else { errorDisplayElement.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Obnovit Stránku</button></div>`; errorDisplayElement.style.display = 'block'; const retryBtn = errorDisplayElement.querySelector('#global-retry-btn'); if (retryBtn) { retryBtn.onclick = () => location.reload(); } } } else { showToast('CHYBA', message, 'error', 10000); } }
    function hideError(targetElement = ui.globalError) { if (targetElement) { targetElement.style.display = 'none'; targetElement.innerHTML = ''; } }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || 'P'; }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Error formatting time:", e, "Timestamp:", timestamp); return '-'; } }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }
    function isSameDate(date1, date2) { if (!date1 || !date2) return false; const d1 = new Date(date1); const d2 = new Date(date2); return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate(); }
    function isYesterday(date1, date2) { if (!date1 || !date2) return false; const yesterday = new Date(date2); yesterday.setDate(yesterday.getDate() - 1); return isSameDate(date1, yesterday); }
    function getCurrentMonthYearString() { const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); return `${year}-${month}`; }
    function showModal(modalId) { const modal = document.getElementById(modalId); if (modal) { console.log(`[Modal] Opening modal: ${modalId}`); modal.style.display = 'flex'; if (modalId === 'monthly-reward-modal' && typeof renderMonthlyCalendar === 'function') { setLoadingState('monthlyRewards', true); renderMonthlyCalendar().finally(() => setLoadingState('monthlyRewards', false)); } else if (modalId === 'streak-milestones-modal' && typeof renderStreakMilestones === 'function') { setLoadingState('streakMilestones', true); renderStreakMilestones().finally(() => setLoadingState('streakMilestones', false)); } requestAnimationFrame(() => { modal.classList.add('active'); }); } else { console.error(`Modal element not found: #${modalId}`); } }
    function hideModal(modalId) { const modal = document.getElementById(modalId); if (modal) { console.log(`[Modal] Closing modal: ${modalId}`); modal.classList.remove('active'); setTimeout(() => { modal.style.display = 'none'; }, 300); } }
    function withTimeout(promise, ms, timeoutError = new Error('Operace vypršela')) { const timeoutPromise = new Promise((_, reject) => { setTimeout(() => reject(timeoutError), ms); }); return Promise.race([promise, timeoutPromise]); }
    function updateCopyrightYear() { const currentYearSpan = ui.currentYearFooter; const currentYearSidebar = ui.currentYearSidebar; const year = new Date().getFullYear(); if (currentYearSpan) { currentYearSpan.textContent = year; } else { console.warn("[Copyright] Element currentYearFooter nenalezen.");} if (currentYearSidebar) { currentYearSidebar.textContent = year; } }
    function initTooltips() { try { if (window.jQuery && typeof window.jQuery.fn.tooltipster === 'function') { window.jQuery('.btn-tooltip.tooltipstered').each(function() { if (document.body.contains(this)) { try { window.jQuery(this).tooltipster('destroy'); } catch (destroyError) { console.warn("Tooltipster destroy error:", destroyError); } } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); console.log("[Tooltips] Initialized/Re-initialized."); } else { console.warn("[Tooltips] jQuery or Tooltipster library not loaded."); } } catch (e) { console.error("[Tooltips] Error initializing Tooltipster:", e); } }
    function initMouseFollower() { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    function initHeaderScrollDetection() { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 50); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl && mainEl.scrollTop > 50) document.body.classList.add('scrolled'); };
    function initScrollAnimations() { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }); animatedElements.forEach(element => observer.observe(element)); };
    // --- END: Helper Functions ---

    // --- START: Skeleton and Loading State Management ---
    function toggleSkeletonUI(sectionKey, showSkeleton) {
        console.log(`[Skeleton Toggle] Section: ${sectionKey}, Show Skeleton: ${showSkeleton}`);
        let skeletonContainer, realContainer;
        switch (sectionKey) {
            case 'welcomeBanner': skeletonContainer = ui.welcomeBannerSkeleton; realContainer = ui.welcomeBannerReal; break;
            case 'stats': skeletonContainer = ui.statsCardsSkeletonContainer; realContainer = ui.statsCardsContainer; break;
            case 'shortcuts': skeletonContainer = ui.shortcutGridSkeletonContainer; realContainer = ui.shortcutGridReal; break;
            case 'activities': skeletonContainer = ui.activityListSkeletonContainer; realContainer = ui.activityListContainer; break;
            case 'creditHistory': skeletonContainer = ui.creditHistorySkeletonContainer; realContainer = ui.creditHistoryListContainer; break;
            default: console.warn(`[Skeleton Toggle] Unknown sectionKey: ${sectionKey}`); return;
        }
        const sectionParent = skeletonContainer?.closest('section') || realContainer?.closest('section');
        if (skeletonContainer) {
            skeletonContainer.style.display = showSkeleton ? (skeletonContainer.classList.contains('stat-cards') || skeletonContainer.classList.contains('shortcut-grid') ? 'grid' : 'block') : 'none';
            if(showSkeleton && sectionParent) sectionParent.classList.add('skeleton-active');
        }
        if (realContainer) {
            realContainer.style.display = showSkeleton ? 'none' : (realContainer.classList.contains('stat-cards') || realContainer.classList.contains('shortcut-grid') ? 'grid' : 'block');
            if(!showSkeleton && sectionParent) sectionParent.classList.remove('skeleton-active');
        }
    }
    function setLoadingState(sectionKey, isLoadingFlag) {
        if (!ui || Object.keys(ui).length === 0) { console.error("[SetLoadingState] UI cache not ready."); return; }
        if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;

        if (sectionKey === 'all') {
            Object.keys(isLoading).forEach(key => {
                if (key !== 'all') setLoadingState(key, isLoadingFlag);
            });
            isLoading.all = isLoadingFlag;
            console.log(`[SetLoadingState v26.0.16] Section: all, isLoading: ${isLoadingFlag}`);
            return;
        }

        isLoading[sectionKey] = isLoadingFlag;
        console.log(`[SetLoadingState v26.0.16] Section: ${sectionKey}, isLoading: ${isLoadingFlag}`);

        if (sectionKey === 'session') {
            if (ui.mainContentAreaPlaceholder) {
                ui.mainContentAreaPlaceholder.classList.toggle('loading', isLoadingFlag);
                 if(isLoadingFlag) {
                     ui.mainContentAreaPlaceholder.innerHTML = '<div class="loading-spinner" style="margin: auto;"></div><p>Ověřování sezení...</p>';
                     ui.mainContentAreaPlaceholder.style.display = 'flex';
                 }
            }
            return;
        }
         if (sectionKey === 'rewardsConfig') { // Speciální handling pro načítání konfigurací
            console.log(`[SetLoadingState] Konfigurace odměn se načítá: ${isLoadingFlag}`);
            // Zde můžeš přidat např. zobrazení globálního malého spinneru někde v UI, pokud chceš
            // Nebo jen ponechat loading stavy pro jednotlivé modály ('monthlyRewards', 'streakMilestones')
            return;
        }


        const skeletonMap = {
            welcomeBanner: { skeleton: ui.welcomeBannerSkeleton, real: ui.welcomeBannerReal, display: 'block' },
            stats: { skeleton: ui.statsCardsSkeletonContainer, real: ui.statsCardsContainer, display: 'grid' },
            shortcuts: { skeleton: ui.shortcutGridSkeletonContainer, real: ui.shortcutGridReal, display: 'grid' },
            activities: { skeleton: ui.activityListSkeletonContainer, real: ui.activityListContainer, display: 'block' },
            creditHistory: { skeleton: ui.creditHistorySkeletonContainer, real: ui.creditHistoryListContainer, display: 'block' }
        };

        if (skeletonMap[sectionKey]) {
            toggleSkeletonUI(sectionKey, isLoadingFlag);
        } else if (sectionKey === 'notifications') {
            if (ui.notificationBell) ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
            if (ui.markAllReadBtn) {
                const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
            }
            if (isLoadingFlag && ui.notificationsList && typeof renderNotificationSkeletons === 'function') {
                renderNotificationSkeletons(2);
                if(ui.noNotificationsMsg) ui.noNotificationsMsg.style.display = 'none';
            } else if (!isLoadingFlag && ui.notificationsList && ui.noNotificationsMsg && ui.notificationsList.children.length === 0) {
                 if(ui.noNotificationsMsg) ui.noNotificationsMsg.style.display = 'block';
            }
        } else if (sectionKey === 'monthlyRewards' || sectionKey === 'streakMilestones') {
            const modal = sectionKey === 'monthlyRewards' ? ui.monthlyRewardModal : ui.streakMilestonesModal;
            if (!modal) {
                console.warn(`[SetLoadingState] Modál pro ${sectionKey} nenalezen.`);
                return;
            }
            const modalBody = modal.querySelector('.modal-body');
            const loaderOverlay = modalBody?.querySelector('.loading-overlay'); // Předpokládá, že existuje .loading-overlay v HTML modálu

            if (loaderOverlay) { // Pokud existuje dedikovaný overlay
                loaderOverlay.classList.toggle('hidden', !isLoadingFlag);
                if (modalBody) modalBody.classList.toggle('loading', isLoadingFlag); // Třída na tělo modálu pro další styly
            } else if (modalBody) { // Fallback - zobrazí spinner přímo v těle modálu
                if (isLoadingFlag) {
                    modalBody.innerHTML = '<div class="loading-overlay" style="position: absolute; inset: 0; background-color: rgba(var(--card-solid-rgb), 0.92); display: flex; justify-content: center; align-items: center; z-index: 20; border-radius: 0; backdrop-filter: blur(4px);"><div class="loading-spinner" style="width: 38px; height: 38px; border: 4px solid var(--accent-primary); border-radius: 50%; border-top-color: transparent; border-right-color: transparent; animation: loading-spinner-anim 0.8s linear infinite;"></div></div>';
                } else {
                    const existingOverlay = modalBody.querySelector('.loading-overlay');
                    if (existingOverlay) existingOverlay.remove();
                }
            }
        } else if (sectionKey === 'titles') {
            console.log(`[SetLoadingState] Loading state for 'titles' is now ${isLoadingFlag}.`);
        } else {
            console.warn(`[SetLoadingState] Unknown section key or unhandled UI in dashboard.js: ${sectionKey}`);
        }
    }
    function applyInitialSidebarState() { const startTime = performance.now(); if (!ui.sidebarToggleBtn) { console.warn("[Sidebar State] Sidebar toggle button (#sidebar-toggle-btn) not found for initial state application."); return; } try { const savedState = localStorage.getItem(SIDEBAR_STATE_KEY); const shouldBeCollapsed = savedState === 'collapsed'; console.log(`[Sidebar State] Initial read state from localStorage: '${savedState}', Applying collapsed: ${shouldBeCollapsed}`); document.body.classList.toggle('sidebar-collapsed', shouldBeCollapsed); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) { icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.setAttribute('title', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); const endTime = performance.now(); console.log(`[Sidebar State] Initial icon and attributes set. Icon class: ${icon.className}. Time: ${(endTime - startTime).toFixed(2)}ms`); } else { console.warn("[Sidebar State] Sidebar toggle button icon not found for initial state update."); } } catch (error) { console.error("[Sidebar State] Error applying initial state:", error); document.body.classList.remove('sidebar-collapsed'); } }
    function toggleSidebar() { try { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) { icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.setAttribute('title', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); } console.log(`[Sidebar Toggle] Sidebar toggled. New state: ${isCollapsed ? 'collapsed' : 'expanded'}`); } catch(e){console.error("[Sidebar Toggle] Error:",e);}}
    // --- END: Skeleton and Loading State Management ---

    // --- START: Supabase Interaction Functions ---
    function initializeSupabase() { const startTime = performance.now(); console.log("[Supabase] Attempting initialization..."); try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded or createClient is not a function."); } supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); if (!supabase) { throw new Error("Supabase client creation failed (returned null/undefined)."); } window.supabaseClient = supabase; const endTime = performance.now(); console.log(`[Supabase] Klient úspěšně inicializován a globálně dostupný. Time: ${(endTime - startTime).toFixed(2)}ms`); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi. Zkuste obnovit stránku.", true); return false; } }
    async function fetchUserProfile(userId) { const startTime = performance.now(); console.log(`[Profile] Fetching profile for user ID: ${userId}`); if (!supabase || !userId) return null; try { const { data: profile, error } = await withTimeout(supabase.from('profiles').select(PROFILE_COLUMNS_TO_SELECT).eq('id', userId).single(), DATA_FETCH_TIMEOUT, new Error('Načítání profilu vypršelo.')); if (error && error.code !== 'PGRST116') { throw error; } if (!profile) { console.warn(`[Profile] Profile for ${userId} not found. Returning null.`); return null; } profile.monthly_claims = profile.monthly_claims || {}; profile.last_milestone_claimed = profile.last_milestone_claimed || 0; profile.purchased_titles = profile.purchased_titles || []; const endTime = performance.now(); console.log(`[Profile] Profile data fetched successfully. Time: ${(endTime - startTime).toFixed(2)}ms`); return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); return null; } }
    async function createDefaultProfile(userId, userEmail) { const startTime = performance.now(); if (!supabase || !userId || !userEmail) return null; console.log(`[Profile Create] Creating default profile for user ${userId}`); try { const defaultData = { id: userId, email: userEmail, username: userEmail.split('@')[0] || `user_${userId.substring(0, 6)}`, level: 1, points: 0, experience: 0, badges_count: 0, streak_days: 0, longest_streak_days: 0, last_login: new Date().toISOString(), monthly_claims: {}, last_milestone_claimed: 0, purchased_titles: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), preferences: { dark_mode: window.matchMedia('(prefers-color-scheme: dark)').matches, language: 'cs' }, notifications: { email: true, study_tips: true, content_updates: true, practice_reminders: true } }; const { data: newProfile, error } = await withTimeout(supabase.from('profiles').insert(defaultData).select(PROFILE_COLUMNS_TO_SELECT).single(), DATA_FETCH_TIMEOUT, new Error('Vytváření profilu vypršelo.')); if (error) { if (error.code === '23505') { console.warn("[Profile Create] Profile likely already exists, fetching again."); return await fetchUserProfile(userId); } throw error; } const endTime = performance.now(); console.log(`[Profile Create] Default profile created. Time: ${(endTime - startTime).toFixed(2)}ms`); return newProfile; } catch (error) { console.error("[Profile Create] Failed to create default profile:", error); return null; } }
    async function fetchTitles() { const startTime = performance.now(); if (!supabase) return []; console.log("[Titles] Fetching available titles..."); setLoadingState('titles', true); try { const { data, error } = await withTimeout(supabase.from('title_shop').select('title_key, name'), DATA_FETCH_TIMEOUT, new Error('Načítání titulů vypršelo.')); if (error) throw error; const endTime = performance.now(); console.log(`[Titles] Fetched titles. Time: ${(endTime - startTime).toFixed(2)}ms`); return data || []; } catch (error) { console.error("[Titles] Error fetching titles:", error); return []; } finally { setLoadingState('titles', false); } }
    async function fetchUserStats(userId, profileData) { const startTime = performance.now(); if (!supabase || !userId || !profileData) { console.error("[Stats] Chybí Supabase klient, ID uživatele nebo data profilu."); return null; } console.log(`[Stats] Načítání statistik pro uživatele ${userId}...`); let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats] Chyba Supabase při načítání user_stats:", statsError.message); } } catch (error) { console.error("[Stats] Neočekávaná chyba při načítání user_stats:", error); statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, longest_streak_days: profileData.longest_streak_days ?? Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0 }; const endTime = performance.now(); if (statsError) { console.warn(`[Stats] Vracení statistik primárně z profilu kvůli chybě načítání. Time: ${(endTime - startTime).toFixed(2)}ms`); } else { console.log(`[Stats] Statistiky úspěšně načteny/sestaveny. Time: ${(endTime - startTime).toFixed(2)}ms`); } return finalStats; }
    async function fetchAndDisplayLatestCreditChange(userId) { console.log(`[CreditChange] Fetching latest credit change for user ${userId}...`); if (ui.latestCreditChange) { ui.latestCreditChange.innerHTML = ''; ui.latestCreditChange.style.display = 'none'; } if (!supabase || !userId ) { console.warn("[CreditChange] Missing Supabase or userId."); return null; } try { const { data, error } = await supabase.from('credit_transactions').select('amount, description, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single(); if (error && error.code !== 'PGRST116') { throw error; } if (data && data.amount !== undefined) { console.log(`[CreditChange] Latest change: ${data.amount}, Description: ${data.description}`); fetchAndDisplayLatestCreditChange.latestTxData = { amount: data.amount, description: data.description }; return { amount: data.amount, description: data.description }; } else { console.log('[CreditChange] No credit transactions found.'); fetchAndDisplayLatestCreditChange.latestTxData = null; return null; } } catch (error) { console.error('[CreditChange] Error fetching latest credit change:', error); fetchAndDisplayLatestCreditChange.latestTxData = null; return null; } }
    async function checkAndUpdateLoginStreak() { const startTime = performance.now(); if (!currentUser || !currentProfile || !supabase) { console.warn("[StreakCheck] Cannot perform check: missing user, profile, or supabase."); return false; } console.log("[StreakCheck] Performing daily login check/update..."); const today = new Date(); const lastLogin = currentProfile.last_login ? new Date(currentProfile.last_login) : null; let currentStreak = currentProfile.streak_days || 0; let longestStreak = currentProfile.longest_streak_days || 0; let needsDbUpdate = false; let updateData = { updated_at: today.toISOString() }; const currentMonthYear = getCurrentMonthYearString(); if (!lastLogin || !isSameDate(today, lastLogin)) { needsDbUpdate = true; console.log("[StreakCheck] First login of the day detected."); if (lastLogin && isYesterday(lastLogin, today)) { currentStreak++; console.log(`[StreakCheck] Streak continued! New current streak: ${currentStreak}`); } else if (lastLogin) { currentStreak = 1; console.log("[StreakCheck] Streak broken. Resetting to 1."); } else { currentStreak = 1; console.log("[StreakCheck] First login ever. Setting streak to 1."); } updateData.streak_days = currentStreak; updateData.last_login = today.toISOString(); if (currentStreak > longestStreak) { longestStreak = currentStreak; updateData.longest_streak_days = longestStreak; console.log(`[StreakCheck] New longest streak: ${longestStreak}!`); } } else { console.log("[StreakCheck] Already logged in today."); if (currentProfile.streak_days > (currentProfile.longest_streak_days || 0) ) { updateData.longest_streak_days = currentProfile.streak_days; longestStreak = currentProfile.streak_days; needsDbUpdate = true; } } currentProfile.streak_days = currentStreak; currentProfile.longest_streak_days = longestStreak; if (ui.modalCurrentStreakValue) ui.modalCurrentStreakValue.textContent = currentStreak; if (ui.modalLongestStreakValue) ui.modalLongestStreakValue.textContent = longestStreak; currentProfile.monthly_claims = currentProfile.monthly_claims || {}; if (!currentProfile.monthly_claims[currentMonthYear]) { console.log(`[StreakCheck] Initializing claims for new month: ${currentMonthYear}`); updateData.monthly_claims = { ...currentProfile.monthly_claims, [currentMonthYear]: [] }; needsDbUpdate = true; } else { console.log(`[StreakCheck] Monthly claims for ${currentMonthYear} already exist:`, currentProfile.monthly_claims[currentMonthYear]); } if (needsDbUpdate) { console.log("[StreakCheck] Updating profile in DB with:", JSON.stringify(updateData)); try { const { error: updateError } = await supabase.from('profiles').update(updateData).eq('id', currentUser.id); if (updateError) throw updateError; const refreshedProfile = await fetchUserProfile(currentUser.id); if (refreshedProfile) { currentProfile = refreshedProfile; } else { console.warn("[StreakCheck] Could not re-fetch profile after update, local currentProfile might be partially stale for non-updated fields."); if (updateData.last_login) currentProfile.last_login = updateData.last_login; if (updateData.monthly_claims) currentProfile.monthly_claims = updateData.monthly_claims; if (updateData.streak_days !== undefined) currentProfile.streak_days = updateData.streak_days; if (updateData.longest_streak_days !== undefined) currentProfile.longest_streak_days = updateData.longest_streak_days; } const endTime = performance.now(); console.log(`[StreakCheck] Profile updated successfully in DB. Time: ${(endTime - startTime).toFixed(2)}ms`); return true; } catch (error) { console.error("[StreakCheck] Error updating profile:", error); showToast('Chyba', `Nepodařilo se aktualizovat data přihlášení: ${error.message}`, 'error'); return false; } } const endTimeUnchanged = performance.now(); console.log(`[StreakCheck] No DB update needed. Time: ${(endTimeUnchanged - startTime).toFixed(2)}ms`); return false; }
    async function updateMonthlyClaimsInDB(newClaimsData) { if (!currentUser || !supabase) { console.error("[DB Update] Pre-condition failed: No user or supabase client."); return false; } const functionStartTime = performance.now(); console.log(`[DB Update] Attempting to update monthly_claims in DB for user ${currentUser.id} with:`, JSON.parse(JSON.stringify(newClaimsData))); try { const { data: updateResult, error: dbUpdateError } = await supabase.from('profiles').update({ monthly_claims: newClaimsData, updated_at: new Date().toISOString() }).eq('id', currentUser.id).select('monthly_claims'); if (dbUpdateError) { console.error("[DB Update] Supabase UPDATE error:", dbUpdateError); throw dbUpdateError; } if (!updateResult || updateResult.length === 0) { console.warn("[DB Update] Supabase update operation returned 0 rows or no data. Monthly claims might not have been saved to DB."); currentProfile.monthly_claims = newClaimsData; } else { currentProfile.monthly_claims = updateResult[0].monthly_claims; } console.log(`[DB Update] Database update successful. Local currentProfile.monthly_claims updated:`, JSON.parse(JSON.stringify(currentProfile.monthly_claims))); const functionEndTime = performance.now(); console.log(`[DB Update] updateMonthlyClaimsInDB finished successfully. Total time: ${(functionEndTime - functionStartTime).toFixed(2)}ms`); return true; } catch (error) { console.error("[DB Update] Catch block: Error updating monthly_claims in DB or locally:", error); showToast('Chyba databáze', `Nepodařilo se uložit vyzvednutí měsíční odměny: ${error.message}`, 'error'); return false; } }
    async function awardPoints(pointsValue, reason = "Nespecifikováno", transactionType = 'points_earned', referenceActivityId = null, suppressActivityLog = false) { if (!currentUser || !currentProfile || !supabase) { console.warn("Cannot award points: User, profile, or Supabase missing."); return; } if (pointsValue === 0) { console.log("No points to award (value is 0)."); return; } console.log(`[Points] Awarding/deducting ${pointsValue} points for: ${reason}. Type: ${transactionType}, SuppressLog: ${suppressActivityLog}`); setLoadingState('stats', true); const currentPoints = currentProfile.points || 0; const newPoints = currentPoints + pointsValue; try { const { error: profileUpdateError } = await supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (profileUpdateError) throw profileUpdateError; console.log("[Points] Points successfully updated in DB."); currentProfile.points = newPoints; currentProfile.updated_at = new Date().toISOString(); console.log("[Points] Local currentProfile.points updated:", currentProfile.points); const { error: transactionError } = await supabase.from('credit_transactions').insert({ user_id: currentUser.id, transaction_type: transactionType, amount: pointsValue, description: reason, balance_after_transaction: newPoints, reference_activity_id: referenceActivityId }); if (transactionError) { console.error("[Points] Error logging credit transaction:", transactionError); showToast('Varování', 'Kredity připsány, ale záznam transakce selhal.', 'warning'); } else { console.log(`[Points] Credit transaction logged: ${pointsValue} for ${reason}`); } if (pointsValue > 0) { showToast('Kredity Získány!', `+${pointsValue} kreditů za: ${reason}`, 'success', 2500); } else if (pointsValue < 0) { showToast('Kredity Utraceny!', `${pointsValue} kreditů za: ${reason}`, 'info', 2500); } userStatsData = await fetchUserStats(currentUser.id, currentProfile); const latestTxData = await fetchAndDisplayLatestCreditChange(currentUser.id); updateStatsCards(userStatsData); if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderCreditHistory === 'function') { await DashboardLists.loadAndRenderCreditHistory(currentUser.id, 5); } if (pointsValue > 0 && !suppressActivityLog) { await logActivity( currentUser.id, 'points_earned', `Získáno ${pointsValue} kreditů`, `Důvod: ${reason}`, { points_change: pointsValue, new_total_points: newPoints, source: transactionType }, null, referenceActivityId, 'fa-coins' ); } } catch (error) { console.error(`[Points] Error awarding/deducting points:`, error); showToast('Chyba', 'Nepodařilo se upravit kredity.', 'error'); } finally { setLoadingState('stats', false); } }
    async function awardUserTitle(titleKey, titleName, reason = "Měsíční odměna") { if (!currentProfile || !currentUser || !supabase) { console.error("Cannot award title: Missing profile, user or supabase."); return false; } if (currentProfile.purchased_titles && currentProfile.purchased_titles.includes(titleKey)) { showToast("Titul již vlastněn", `Titul "${titleName}" již máte.`, "info"); return true; } const newTitles = [...(currentProfile.purchased_titles || []), titleKey]; let newSelectedTitle = currentProfile.selected_title; if (!newSelectedTitle) { newSelectedTitle = titleKey; } try { const { data: updatedData, error } = await supabase.from('profiles').update({ purchased_titles: newTitles, selected_title: newSelectedTitle, updated_at: new Date().toISOString() }).eq('id', currentUser.id).select('purchased_titles, selected_title'); if (error) throw error; if (updatedData && updatedData.length > 0) { currentProfile.purchased_titles = updatedData[0].purchased_titles; currentProfile.selected_title = updatedData[0].selected_title; } else { currentProfile.purchased_titles = newTitles; currentProfile.selected_title = newSelectedTitle; } currentProfile.updated_at = new Date().toISOString(); await logActivity(currentUser.id, 'title_awarded', `Získán titul: ${titleName}`, `Důvod: ${reason}. Klíč: ${titleKey}`); showToast("Nový titul získán!", `Gratulujeme k titulu: "${titleName}"!`, 'success'); updateSidebarProfile(currentProfile); return true; } catch (error) { console.error("Error awarding title:", error); showToast("Chyba", "Nepodařilo se udělit titul.", "error"); return false; } }
    async function logActivity(userId, type, title, description = null, details = null, link_url = null, reference_id = null, icon = null) { if (!supabase || !userId) { console.error("Cannot log activity: Supabase client or user ID is missing."); return; } console.log(`[Log Activity] Logging: User ${userId}, Type: ${type}, Title: ${title}`); try { const { error } = await supabase.from('activities').insert({ user_id: userId, type: type, title: title, description: description, details: details, link_url: link_url, reference_id: reference_id, icon: icon || activityVisuals[type]?.icon || activityVisuals.default.icon }); if (error) { console.error("Error logging activity:", error); } else { console.log("Activity logged successfully."); if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderRecentActivities === 'function' && window.location.pathname.includes('dashboard.html')) { await DashboardLists.loadAndRenderRecentActivities(userId, 5); } } } catch (err) { console.error("Exception during activity logging:", err); } }
    async function fetchNotifications(userId, limit = 5) { const startTime = performance.now(); if (!supabase || !userId) { console.error("[Notifications] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await withTimeout(supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit), DATA_FETCH_TIMEOUT, new Error('Načítání notifikací vypršelo.')); if (error) throw error; const endTime = performance.now(); console.log(`[Notifications] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}. Time: ${(endTime - startTime).toFixed(2)}ms`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; } }
    function renderNotifications(count, notifications) { const startTime = performance.now(); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.warn("[Render Notifications] Chybí UI elementy pro notifikace."); return; } console.log("[Render Notifications] Start, Počet:", count, "Oznámení:", notifications); ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class || 'default'}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; } ui.markAllReadBtn.disabled = count === 0; const endTime = performance.now(); console.log(`[Render Notifications] Hotovo. Time: ${(endTime - startTime).toFixed(2)}ms`); }
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) { console.warn("[Render Notifications Skeletons] Chybí UI elementy."); return; } let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    async function markNotificationRead(notificationId) { console.log("[FUNC] markNotificationRead: Označení ID:", notificationId); if (!currentUser || !notificationId || !supabase) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[FUNC] markNotificationRead: Úspěch pro ID:", notificationId); return true; } catch (error) { console.error("[FUNC] markNotificationRead: Chyba:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { console.log("[FUNC] markAllNotificationsRead: Start pro uživatele:", currentUser?.id); if (!currentUser || !ui.markAllReadBtn || !supabase) { console.warn("Cannot mark all read: Missing user, button, or supabase."); return; } if (isLoading.notifications) return; setLoadingState('notifications', true); try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false); if (error) throw error; console.log("[FUNC] markAllNotificationsRead: Úspěch"); const { unreadCount, notifications } = await fetchNotifications(currentUser.id, 5); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[FUNC] markAllNotificationsRead: Chyba:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }
    async function updateLastMilestoneClaimedInDB(milestoneDay, rewardKey, rewardName) { if (!currentUser || !supabase) return false; console.log(`[DB Update Milestones] Záznam vyzvednutí: Den ${milestoneDay}, Klíč ${rewardKey}`); try { const { error: insertError } = await supabase .from('claimed_streak_milestones') .insert({ user_id: currentUser.id, milestone_day: milestoneDay, reward_key: rewardKey, reward_name: rewardName }); if (insertError && insertError.code !== '23505') { throw insertError; } else if (insertError && insertError.code === '23505') { console.warn(`[DB Update Milestones] Milník ${rewardKey} pro den ${milestoneDay} již byl zaznamenán v claimed_streak_milestones.`); } else { console.log(`[DB Update Milestones] Milník ${rewardKey} pro den ${milestoneDay} úspěšně zaznamenán do claimed_streak_milestones.`); } if (currentProfile && milestoneDay > (currentProfile.last_milestone_claimed || 0)) { const { error: profileUpdateError } = await supabase .from('profiles') .update({ last_milestone_claimed: milestoneDay, updated_at: new Date().toISOString() }) .eq('id', currentUser.id); if (profileUpdateError) { console.error(`[DB Update Milestones] Chyba aktualizace profiles.last_milestone_claimed na ${milestoneDay}:`, profileUpdateError); } else { console.log(`[DB Update Milestones] profiles.last_milestone_claimed aktualizováno na ${milestoneDay}.`); } } return true; } catch (error) { console.error(`[DB Update Milestones] Obecná chyba pro milník ${rewardKey}, den ${milestoneDay}:`, error); showToast('Chyba Databáze', 'Nepodařilo se uložit záznam o vyzvednutí milníku.', 'error'); return false; } }
    // --- END: Supabase Interaction Functions ---

    // --- START: NOVÉ FUNKCE PRO NAČÍTÁNÍ KONFIGURACÍ ODMĚN Z DATABÁZE ---
    async function fetchActiveMonthlyRewardsCalendarFromDB() {
        console.log("[DB Rewards] Načítání aktivní konfigurace měsíčních odměn...");
        if (!supabase) return null;
        try {
            // 1. Najdi aktivní konfiguraci měsíce
            const { data: activeConfig, error: configError } = await withTimeout(
                supabase.from('monthly_rewards_config')
                .select('*')
                .eq('is_active', true)
                .limit(1)
                .single(),
                CONFIG_FETCH_TIMEOUT
            );
            if (configError) throw configError;
            if (!activeConfig) {
                console.warn("[DB Rewards] Žádná aktivní konfigurace měsíčních odměn nebyla nalezena.");
                return null;
            }
            console.log("[DB Rewards] Aktivní konfigurace měsíce:", activeConfig);

            // 2. Načti všechny dny pro tuto konfiguraci
            const { data: rewardDays, error: daysError } = await withTimeout(
                supabase.from('monthly_reward_days')
                .select('*')
                .eq('config_id', activeConfig.id)
                .order('day_number', { ascending: true }),
                CONFIG_FETCH_TIMEOUT
            );
            if (daysError) throw daysError;
            console.log(`[DB Rewards] Načteno ${rewardDays.length} dní s odměnami.`);

            // 3. Pro dny typu 'bundle', načti jejich položky
            const bundleDayIds = rewardDays.filter(day => day.reward_type === 'bundle').map(day => day.id);
            let bundleItemsMap = {}; // Mapa pro ukládání položek balíčků { reward_day_id: [items] }

            if (bundleDayIds.length > 0) {
                const { data: bundleItems, error: bundleItemsError } = await withTimeout(
                    supabase.from('monthly_reward_bundle_items')
                    .select('*')
                    .in('reward_day_id', bundleDayIds),
                    CONFIG_FETCH_TIMEOUT
                );
                if (bundleItemsError) throw bundleItemsError;

                bundleItems.forEach(item => {
                    if (!bundleItemsMap[item.reward_day_id]) {
                        bundleItemsMap[item.reward_day_id] = [];
                    }
                    bundleItemsMap[item.reward_day_id].push(item);
                });
                console.log(`[DB Rewards] Načteno ${bundleItems.length} položek balíčků pro ${bundleDayIds.length} dní.`);
            }

            return {
                config: activeConfig,
                days: rewardDays || [],
                bundles: bundleItemsMap // Mapa položek balíčků
            };

        } catch (error) {
            console.error("[DB Rewards] Chyba při načítání konfigurace měsíčních odměn z DB:", error);
            showToast('Chyba konfigurace', 'Nepodařilo se načíst data pro měsíční odměny.', 'error');
            return null;
        }
    }

    async function fetchAllStreakMilestonesFromDB() {
        console.log("[DB Rewards] Načítání konfigurace milníků série...");
        if (!supabase) return [];
        try {
            // 1. Načti všechny aktivní konfigurace milníků
            const { data: milestonesConfig, error: configError } = await withTimeout(
                supabase.from('streak_milestones_config')
                .select('*')
                .eq('is_active', true)
                .order('milestone_day', { ascending: true }), // Řadit podle dne milníku
                CONFIG_FETCH_TIMEOUT
            );
            if (configError) throw configError;
            if (!milestonesConfig || milestonesConfig.length === 0) {
                console.warn("[DB Rewards] Nebyly nalezeny žádné aktivní konfigurace milníků série.");
                return [];
            }
            console.log(`[DB Rewards] Načteno ${milestonesConfig.length} konfigurací milníků.`);

            // 2. Pro každý milník načti jeho odměny
            const milestoneIds = milestonesConfig.map(m => m.id);
            const { data: milestoneRewards, error: rewardsError } = await withTimeout(
                supabase.from('streak_milestone_rewards')
                .select('*')
                .in('milestone_config_id', milestoneIds),
                CONFIG_FETCH_TIMEOUT
            );
            if (rewardsError) throw rewardsError;
            console.log(`[DB Rewards] Načteno ${milestoneRewards.length} odměn pro milníky.`);

            // 3. Sestav finální strukturu: pole milníků, kde každý milník obsahuje pole svých odměn
            const finalMilestones = milestonesConfig.map(config => {
                return {
                    ...config, // Všechny sloupce z streak_milestones_config
                    rewards: milestoneRewards.filter(reward => reward.milestone_config_id === config.id) || []
                };
            });

            console.log("[DB Rewards] Finální struktura milníků série:", finalMilestones);
            return finalMilestones;

        } catch (error) {
            console.error("[DB Rewards] Chyba při načítání konfigurace milníků série z DB:", error);
            showToast('Chyba konfigurace', 'Nepodařilo se načíst data pro milníky série.', 'error');
            return [];
        }
    }
    // --- END: NOVÉ FUNKCE PRO NAČÍTÁNÍ KONFIGURACÍ ODMĚN Z DATABÁZE ---


    // --- START: UI Update Functions ---
    function updateSidebarProfile(profile) { if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { cacheDOMElements(); if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[UI Update Sidebar] Sidebar elements not found in cache."); return; } } console.log("[UI Update] Aktualizace sidebaru..."); if (profile) { const firstName = profile.first_name ?? ''; const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(profile); const avatarUrl = profile.avatar_url; ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const sidebarImg = ui.sidebarAvatar.querySelector('img'); if (sidebarImg) { sidebarImg.onerror = () => { ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; } const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot'; if (selectedTitleKey && allTitles && allTitles.length > 0) { const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) displayTitle = foundTitle.name; else console.warn(`[UI Update Sidebar] Title key "${selectedTitleKey}" not found in titles list.`); } else if (selectedTitleKey) { console.warn(`[UI Update Sidebar] Selected title key present, but titles list is empty or not loaded.`); } ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`; console.log("[UI Update] Sidebar aktualizován."); } else { console.warn("[UI Update Sidebar] Missing profile data. Setting defaults."); ui.sidebarName.textContent = "Nepřihlášen"; ui.sidebarAvatar.textContent = '?'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title'); if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítejte!`; } }

    function updateStatsCards(stats) {
        console.log("[UI Update] Aktualizace karet statistik:", stats);
        const statElements = {
            progress: { value: ui.overallProgressValue, footer: ui.overallProgressFooter },
            points: { value: ui.totalPointsValue, footer: ui.totalPointsFooter },
            streak: { value: ui.streakValue, footer: ui.streakFooter }
        };
        const cards = [ui.progressCard, ui.pointsCard, ui.streakCard];

        let criticalElementsMissing = false;
        if (!statElements.points.value || !statElements.points.footer) {
            console.warn("[UI Update Stats] Chybějící elementy pro 'points'.");
            criticalElementsMissing = true;
        }
        if (!statElements.streak.value || !statElements.streak.footer) {
            console.warn("[UI Update Stats] Chybějící elementy pro 'streak'.");
            criticalElementsMissing = true;
        }

        if (!statElements.progress.value) {
            console.log("[UI Update Stats] Element 'overallProgressValue' nenalezen, tato část se neaktualizuje.");
            statElements.progress.value = null;
        }
        if (!statElements.progress.footer) {
            console.log("[UI Update Stats] Element 'overallProgressFooter' nenalezen, tato část se neaktualizuje.");
            statElements.progress.footer = null;
        }


        if (criticalElementsMissing && !statElements.progress.value) {
            console.error("[UI Update Stats] Kritické elementy statistik chybí. Aktualizace přerušena.");
            cards.forEach(card => card?.classList.remove('loading'));
            return;
        }

        cards.forEach(card => card?.classList.remove('loading'));

        if (ui.latestCreditChange) {
            ui.latestCreditChange.innerHTML = '';
            ui.latestCreditChange.style.display = 'none';
        }

        if (!stats) {
            console.warn("[UI Update Stats] Chybí data statistik, zobrazuji placeholder.");
            if(statElements.progress.value) statElements.progress.value.textContent = '- %';
            if(ui.totalPointsValue) { ui.totalPointsValue.innerHTML = `- <span id="latest-credit-change" style="font-size: 0.5em; color: var(--text-medium); vertical-align: middle; margin-left: 0.5em; display: none;"></span>`; } else { console.warn("totalPointsValue is null in UI cache"); }
            if(statElements.streak.value) statElements.streak.value.textContent = '-';
            if(statElements.progress.footer) statElements.progress.footer.innerHTML = `<i class="fas fa-minus"></i> Načítání...`;
            if(statElements.points.footer) statElements.points.footer.innerHTML = `<i class="fas fa-minus"></i> Načítání...`; else { console.warn("totalPointsFooter is null in UI cache"); }
            if(statElements.streak.footer) statElements.streak.footer.innerHTML = `MAX: - dní`; else { console.warn("streakFooter is null in UI cache"); }
            return;
        }

        if (statElements.progress.value && statElements.progress.footer) {
            statElements.progress.value.textContent = `${stats.progress ?? 0}%`;
            const weeklyProgress = stats.progress_weekly ?? 0;
            statElements.progress.footer.classList.remove('positive', 'negative');
            let progressFooterHTML = '';
            if (weeklyProgress > 0) {
                progressFooterHTML = `<i class="fas fa-arrow-up"></i> +${weeklyProgress}% týdně`;
                statElements.progress.footer.classList.add('positive');
            } else if (weeklyProgress < 0) {
                progressFooterHTML = `<i class="fas fa-arrow-down"></i> ${weeklyProgress}% týdně`;
                statElements.progress.footer.classList.add('negative');
            } else {
                progressFooterHTML = `<i class="fas fa-minus"></i> ±0% týdně`;
            }
            statElements.progress.footer.innerHTML = progressFooterHTML;
        }

        if (ui.totalPointsValue && statElements.points.footer) {
            const pointsValue = stats.points ?? 0;
            ui.totalPointsValue.textContent = `${pointsValue} `;

            const latestTx = fetchAndDisplayLatestCreditChange.latestTxData;
            if (latestTx && latestTx.amount !== undefined) {
                const amount = latestTx.amount;
                const description = latestTx.description || `Transakce`;
                const sign = amount > 0 ? '+' : (amount < 0 ? '' : '');
                const amountColorClass = amount > 0 ? 'positive' : (amount < 0 ? 'negative' : '');
                let displayDescription = description;
                const maxDescLengthFooter = 20;
                if (displayDescription.length > maxDescLengthFooter) {
                    displayDescription = displayDescription.substring(0, maxDescLengthFooter - 3) + "...";
                }
                let iconClassFooter = 'fa-history';
                if (amount > 0) iconClassFooter = 'fa-arrow-up';
                else if (amount < 0) iconClassFooter = 'fa-arrow-down';

                statElements.points.footer.innerHTML = `<i class="fas ${iconClassFooter}"></i> <span title="${sanitizeHTML(description)}: ${sign}${amount}">${sanitizeHTML(displayDescription)}: <span style="font-weight:bold;" class="${amountColorClass}">${sign}${amount}</span></span>`;
                statElements.points.footer.classList.remove('positive', 'negative');
                if (amount > 0) statElements.points.footer.classList.add('positive');
                if (amount < 0) statElements.points.footer.classList.add('negative');
            } else {
                const weeklyPoints = stats.points_weekly ?? 0;
                statElements.points.footer.classList.remove('positive', 'negative');
                if (weeklyPoints !== 0 && weeklyPoints != null) {
                    statElements.points.footer.innerHTML = weeklyPoints > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyPoints} týdně` : `<i class="fas fa-arrow-down"></i> ${weeklyPoints} týdně`;
                    if (weeklyPoints > 0) statElements.points.footer.classList.add('positive');
                    else statElements.points.footer.classList.add('negative');
                } else {
                    statElements.points.footer.innerHTML = `<i class="fas fa-minus"></i> Žádná změna bodů`;
                }
            }
        }

        if (statElements.streak.value && statElements.streak.footer) {
            statElements.streak.value.textContent = stats.streak_current ?? 0;
            statElements.streak.footer.innerHTML = `MAX: ${stats.longest_streak_days ?? 0} dní`;
            if ((stats.streak_current ?? 0) > 0 && (stats.streak_current !== stats.longest_streak_days)) {
                 statElements.streak.footer.innerHTML += ` <span style="color:var(--text-muted); font-size:0.9em;">(Aktuální: ${stats.streak_current ?? 0})</span>`;
            }
        }
        console.log("[UI Update] Karty statistik aktualizovány.");
    }


    function updateWelcomeBannerAndLevel(profile) {
        console.log("[UI Update] Aktualizace uvítacího banneru a úrovně XP...");
        if (!profile) { console.warn("[UI Update Welcome] Chybí data profilu."); return; }

        if (ui.welcomeTitle) {
            const displayName = `${profile.first_name || ''}`.trim() || profile.username || currentUser?.email?.split('@')[0] || 'Pilote';
            ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`;
        }

        const currentLevel = profile.level ?? 1;
        const currentExperience = profile.experience ?? 0;

        function getExpForLevel(level) {
            if (level <= 0) return 0;
            const BASE_XP = 100;
            const INCREMENT_XP = 25;
            return BASE_XP + (INCREMENT_XP * (level - 1));
        }

        function getTotalExpThreshold(targetLevel) {
            if (targetLevel <= 1) return 0;
            let totalExp = 0;
            for (let level = 1; level < targetLevel; level++) {
                totalExp += getExpForLevel(level);
            }
            return totalExp;
        }

        const expForCurrentLevel = getTotalExpThreshold(currentLevel);
        const expForNextLevel = getTotalExpThreshold(currentLevel + 1);
        const expNeededForSpan = expForNextLevel - expForCurrentLevel;
        const currentExpInLevelSpan = Math.max(0, currentExperience - expForCurrentLevel);
        let percentage = 0;

        if (expNeededForSpan > 0) {
            percentage = Math.min(100, Math.max(0, Math.round((currentExpInLevelSpan / expNeededForSpan) * 100)));
        } else if (currentLevel > 0) {
            percentage = 100;
        }

        console.log(`[UI Update Level] Level: ${currentLevel}, XP: ${currentExperience}`);
        console.log(`[UI Update Level] XP Práh aktuální: ${expForCurrentLevel}, XP Práh další: ${expForNextLevel}`);
        console.log(`[UI Update Level] XP v rámci úrovně: ${currentExpInLevelSpan} / ${expNeededForSpan > 0 ? expNeededForSpan : 'MAX'}, Procento: ${percentage}%`);

        if (ui.dashboardLevelWidget) ui.dashboardLevelWidget.textContent = currentLevel;
        if (ui.dashboardExpProgressBar) ui.dashboardExpProgressBar.style.width = `${percentage}%`;
        if (ui.dashboardExpCurrent) ui.dashboardExpCurrent.textContent = currentExpInLevelSpan;
        if (ui.dashboardExpRequired) ui.dashboardExpRequired.textContent = expNeededForSpan > 0 ? expNeededForSpan : 'MAX';
        if (ui.dashboardExpPercentage) ui.dashboardExpPercentage.textContent = percentage;

        console.log("[UI Update] Uvítací banner a úroveň XP aktualizovány.");
    }

    // --- END: UI Update Functions ---

    // --- START: Rewards Logic (UPRAVENO PRO DATABÁZI) ---
    async function renderMonthlyCalendar() {
        console.log("[Render Monthly Calendar] Start. Načítání dat z DB...");
        if (!ui.modalMonthlyCalendarGrid || !currentProfile || !activeMonthlyRewardsCalendar) {
            console.error("[Render Monthly Calendar] Chybí UI elementy, profil nebo načtená konfigurace odměn.");
            if (ui.modalMonthlyCalendarEmpty) ui.modalMonthlyCalendarEmpty.style.display = 'block';
            if (ui.modalMonthlyCalendarGrid) ui.modalMonthlyCalendarGrid.innerHTML = '';
            return;
        }

        const { config, days: rewardDays, bundles: bundleItemsMap } = activeMonthlyRewardsCalendar;
        if (!config || !rewardDays) {
            console.error("[Render Monthly Calendar] Data měsíčních odměn nejsou kompletní.");
            if (ui.modalMonthlyCalendarEmpty) {
                ui.modalMonthlyCalendarEmpty.innerHTML = '<i class="fas fa-exclamation-triangle"></i><p>Konfigurace měsíčních odměn nebyla nalezena nebo je neplatná.</p>';
                ui.modalMonthlyCalendarEmpty.style.display = 'block';
            }
            if (ui.modalMonthlyCalendarGrid) ui.modalMonthlyCalendarGrid.innerHTML = '';
            return;
        }

        if (ui.modalCurrentMonthYearSpan) ui.modalCurrentMonthYearSpan.textContent = config.month_display_name || "Měsíční Odměny";
        ui.modalMonthlyCalendarGrid.innerHTML = '';
        ui.modalMonthlyCalendarEmpty.style.display = 'none';

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-11
        const [configYear, configMonthZeroBased] = config.month_year_key.split('-').map(Number);
        const isCurrentCalendarMonth = (currentYear === configYear && (currentMonth + 1) === configMonthZeroBased);
        const todayDate = isCurrentCalendarMonth ? today.getDate() : -1; // -1 if not current display month

        const userClaimsForThisMonth = currentProfile.monthly_claims?.[config.month_year_key] || [];

        const calendarFragment = document.createDocumentFragment();

        for (let day = 1; day <= MONTHLY_REWARD_DAYS; day++) { // Vždy zobrazíme 31 pozic pro konzistenci UI
            const dayData = rewardDays.find(d => d.day_number === day);
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';

            let dayStatus = 'no-reward'; // Default if no specific reward for this day cell (e.g. day 31 in June)
            let isClaimable = false;
            let isClaimed = false;
            let isMissed = false;
            let isToday = (day === todayDate && isCurrentCalendarMonth);

            if (dayData) { // Pokud pro tento den existuje záznam o odměně
                 dayStatus = 'upcoming-reward'; // Default pro existující odměnu
                if (userClaimsForThisMonth.includes(day)) {
                    isClaimed = true;
                    dayStatus = 'claimed';
                } else if (isCurrentCalendarMonth && day <= todayDate) {
                    isClaimable = true;
                    dayStatus = 'claimable';
                } else if (isCurrentCalendarMonth && day > todayDate) {
                    dayStatus = 'upcoming-reward';
                } else if (configYear < currentYear || (configYear === currentYear && configMonthZeroBased < (currentMonth + 1))) {
                    // Měsíc je v minulosti a den nebyl vyzvednut
                    isMissed = true;
                    dayStatus = 'missed';
                }
            }


            dayCell.classList.add(dayStatus);
            if (isToday) dayCell.classList.add('today');

            dayCell.innerHTML = `
                <span class="day-number">${day}</span>
                <div class="reward-icon">
                    <i class="${dayData?.reward_icon || 'fas fa-question-circle'} reward-type-${dayData?.reward_type || 'unknown'}"></i>
                </div>
                <div class="reward-name">${sanitizeHTML(dayData?.reward_name || (dayData ? 'Odměna' : 'Žádná odměna'))}</div>
                ${dayData?.reward_value ? `<div class="reward-value">${dayData.reward_type === 'xp' ? dayData.reward_value + ' ZK' : dayData.reward_value + ' Kr.'}</div>` : ''}
                ${dayData?.reward_type === 'bundle' && bundleItemsMap[dayData.id] ? `
                    <div class="reward-bundle-details">
                        ${bundleItemsMap[dayData.id].map(item => `<span class="bundle-reward-item"><i class="${item.item_reward_icon || ''} reward-type-${item.item_reward_type}"></i> ${sanitizeHTML(item.item_reward_name)}</span>`).join('')}
                    </div>` : ''
                }
                <div class="reward-status">${dayStatus.replace('-', ' ').toUpperCase()}</div>
                ${isClaimable ? `<button class="btn btn-claim-month-reward" data-day="${day}"><i class="fas fa-gift"></i> Vyzvednout</button>` : ''}
            `;

            if (isClaimable) {
                const claimButton = dayCell.querySelector('.btn-claim-month-reward');
                if (claimButton) {
                    claimButton.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const dayToClaim = parseInt(e.currentTarget.dataset.day);
                        const rewardToClaim = rewardDays.find(d => d.day_number === dayToClaim);
                        if (rewardToClaim) {
                            await handleMonthlyRewardClaim(dayToClaim, rewardToClaim, bundleItemsMap[rewardToClaim.id] || []);
                        }
                    });
                }
            }
            calendarFragment.appendChild(dayCell);
        }
        ui.modalMonthlyCalendarGrid.appendChild(calendarFragment);
        console.log("[Render Monthly Calendar] Kalendář vykreslen s daty z DB.");
    }

    async function handleMonthlyRewardClaim(day, rewardData, bundleItems = []) {
        console.log(`[Claim Monthly] Pokus o vyzvednutí odměny za den ${day}:`, rewardData);
        if (!currentProfile || !currentUser || !supabase || !activeMonthlyRewardsCalendar) return;

        const { config } = activeMonthlyRewardsCalendar;
        const monthYearKey = config.month_year_key;
        currentProfile.monthly_claims = currentProfile.monthly_claims || {};
        currentProfile.monthly_claims[monthYearKey] = currentProfile.monthly_claims[monthYearKey] || [];

        if (currentProfile.monthly_claims[monthYearKey].includes(day)) {
            showToast('Již vyzvednuto', 'Odměna za tento den již byla vyzvednuta.', 'info');
            return;
        }

        setLoadingState('monthlyRewards', true); // Začátek načítání pro modál

        let activityTitle = `Vyzvednuta měsíční odměna (Den ${day})`;
        let activityDesc = `Odměna: ${rewardData.reward_name}`;
        let allAwardsSuccessful = true;

        try {
            if (rewardData.reward_type === 'bundle') {
                 activityDesc += " (Balíček):";
                for (const item of bundleItems) {
                    activityDesc += ` ${item.item_reward_name},`;
                    if (item.item_reward_type === 'xp' && item.item_reward_value) {
                        // TODO: Implement addExperience function if it exists
                        console.log(`[Claim Monthly] Přidání ${item.item_reward_value} XP (z balíčku)`);
                        // await addExperience(item.item_reward_value, `Měsíční odměna: ${item.item_reward_name}`);
                    } else if (item.item_reward_type === 'credits' && item.item_reward_value) {
                        await awardPoints(item.item_reward_value, `Měsíční odměna: ${item.item_reward_name} (balíček den ${day})`, 'monthly_reward', null, true);
                    } else if (item.item_reward_type === 'title' && item.item_reward_key) {
                        await awardUserTitle(item.item_reward_key, item.item_reward_name, `Měsíční odměna (balíček den ${day})`);
                    }
                }
                activityDesc = activityDesc.slice(0, -1); // Remove last comma
            } else {
                if (rewardData.reward_type === 'xp' && rewardData.reward_value) {
                     console.log(`[Claim Monthly] Přidání ${rewardData.reward_value} XP`);
                    // await addExperience(rewardData.reward_value, `Měsíční odměna: ${rewardData.reward_name}`);
                } else if (rewardData.reward_type === 'credits' && rewardData.reward_value) {
                    await awardPoints(rewardData.reward_value, `Měsíční odměna: ${rewardData.reward_name} (den ${day})`, 'monthly_reward', null, true);
                } else if (rewardData.reward_type === 'title' && rewardData.reward_key) {
                    await awardUserTitle(rewardData.reward_key, rewardData.reward_name, `Měsíční odměna (den ${day})`);
                }
            }

            currentProfile.monthly_claims[monthYearKey].push(day);
            const dbUpdateSuccess = await updateMonthlyClaimsInDB(currentProfile.monthly_claims);

            if (dbUpdateSuccess) {
                showToast('Odměna vyzvednuta!', `${rewardData.reward_name} byla úspěšně vyzvednuta.`, 'success');
                await logActivity(currentUser.id, 'monthly_reward_claimed', activityTitle, activityDesc, { day: day, reward: rewardData.reward_name });
                renderMonthlyCalendar(); // Překreslí kalendář s aktualizovaným stavem
            } else {
                allAwardsSuccessful = false; // DB update failed
                currentProfile.monthly_claims[monthYearKey] = currentProfile.monthly_claims[monthYearKey].filter(d => d !== day); // Rollback local claim
                showToast('Chyba', 'Nepodařilo se uložit vyzvednutí odměny do databáze.', 'error');
            }
        } catch (error) {
            allAwardsSuccessful = false;
            console.error("[Claim Monthly] Chyba při udělování odměny:", error);
            showToast('Chyba', `Při udělování odměny nastala chyba: ${error.message}`, 'error');
        } finally {
            setLoadingState('monthlyRewards', false);
        }
    }

    async function renderStreakMilestones() {
        console.log("[Render Streak Milestones] Start. Načítání dat z DB...");
        if (!ui.modalMilestonesGrid || !currentProfile || !allConfiguredStreakMilestones) {
            console.error("[Render Streak Milestones] Chybí UI elementy, profil nebo načtená konfigurace milníků.");
            if (ui.modalMilestonesEmpty) ui.modalMilestonesEmpty.style.display = 'block';
            if (ui.modalMilestonesGrid) ui.modalMilestonesGrid.innerHTML = '';
            return;
        }

        if (allConfiguredStreakMilestones.length === 0) {
            console.log("[Render Streak Milestones] Žádné milníky nejsou nakonfigurovány v DB.");
            if (ui.modalMilestonesEmpty) {
                ui.modalMilestonesEmpty.innerHTML = '<i class="fas fa-road"></i><p>Zatím nejsou definovány žádné milníky studijní série.</p>';
                ui.modalMilestonesEmpty.style.display = 'block';
            }
            if (ui.modalMilestonesGrid) ui.modalMilestonesGrid.innerHTML = '';
            return;
        }

        if (ui.modalCurrentStreakValue) ui.modalCurrentStreakValue.textContent = currentProfile.streak_days || 0;
        if (ui.modalLongestStreakValue) ui.modalLongestStreakValue.textContent = currentProfile.longest_streak_days || 0;

        ui.modalMilestonesGrid.innerHTML = '';
        ui.modalMilestonesEmpty.style.display = 'none';
        const milestonesFragment = document.createDocumentFragment();

        const claimedMilestoneKeys = (currentProfile.claimed_streak_milestones || []).map(cm => cm.reward_key);

        allConfiguredStreakMilestones.forEach(milestone => {
            const isClaimed = claimedMilestoneKeys.includes(milestone.reward_key_internal);
            const isAvailable = !isClaimed && (currentProfile.streak_days || 0) >= milestone.milestone_day;
            const isLocked = !isClaimed && !isAvailable;

            let statusClass = '';
            let statusText = '';
            let statusIcon = 'fa-ellipsis-h';

            if (isClaimed) { statusClass = 'claimed'; statusText = 'Vyzvednuto'; statusIcon = 'fa-check-circle'; }
            else if (isAvailable) { statusClass = 'available'; statusText = 'Vyzvednout'; statusIcon = 'fa-gift';}
            else if (isLocked) { statusClass = 'locked'; statusText = `Uzamčeno (Série ${milestone.milestone_day} dní)`; statusIcon = 'fa-lock';}

            const card = document.createElement('div');
            card.className = `milestone-card ${statusClass}`;
            card.innerHTML = `
                <div class="milestone-header">
                    <i class="milestone-icon-indicator ${milestone.milestone_icon || 'fas fa-star'}"></i>
                    <span class="milestone-days">${milestone.milestone_day} Dní Série</span>
                </div>
                <h3 class="milestone-name">${sanitizeHTML(milestone.milestone_name)}</h3>
                <p class="milestone-desc">${sanitizeHTML(milestone.milestone_description || '')}</p>
                ${milestone.rewards && milestone.rewards.length > 0 ? `
                    <ul class="milestone-rewards-list">
                        ${milestone.rewards.map(reward => `
                            <li>
                                <i class="${reward.reward_icon_item || 'fas fa-medal'} reward-type-${reward.reward_type}"></i>
                                ${sanitizeHTML(reward.reward_name)}
                                ${reward.reward_value && (reward.reward_type === 'xp' || reward.reward_type === 'credits') ? ` (${reward.reward_value})` : ''}
                            </li>`).join('')}
                    </ul>` : '<p>Žádné konkrétní odměny.</p>'
                }
                <div class="milestone-actions">
                    ${isAvailable ?
                        `<button class="btn claim-milestone-btn" data-milestone-day="${milestone.milestone_day}" data-reward-key="${milestone.reward_key_internal}">
                            <i class="fas fa-gift"></i> Vyzvednout Odměnu
                         </button>` :
                        `<span class="reward-status ${statusClass}">
                            <i class="fas ${statusIcon}"></i> ${statusText}
                         </span>`
                    }
                </div>
            `;
            if (isAvailable) {
                const claimBtn = card.querySelector('.claim-milestone-btn');
                if (claimBtn) {
                    claimBtn.addEventListener('click', async (e) => {
                        const day = parseInt(e.currentTarget.dataset.milestoneDay);
                        const key = e.currentTarget.dataset.rewardKey;
                        await handleStreakMilestoneClaim(day, key);
                    });
                }
            }
            milestonesFragment.appendChild(card);
        });
        ui.modalMilestonesGrid.appendChild(milestonesFragment);
        console.log("[Render Streak Milestones] Milníky vykresleny s daty z DB.");
    }

    async function handleStreakMilestoneClaim(milestoneDay, rewardKeyInternal) {
        console.log(`[Claim Milestone] Pokus o vyzvednutí milníku za ${milestoneDay} dní, klíč: ${rewardKeyInternal}`);
        if (!currentProfile || !currentUser || !supabase || !allConfiguredStreakMilestones) return;

        const milestoneConfig = allConfiguredStreakMilestones.find(m => m.milestone_day === milestoneDay && m.reward_key_internal === rewardKeyInternal);
        if (!milestoneConfig) {
            showToast('Chyba', 'Konfigurace milníku nebyla nalezena.', 'error');
            return;
        }

        const isClaimed = (currentProfile.claimed_streak_milestones || []).some(cm => cm.reward_key === rewardKeyInternal);
        if (isClaimed) {
            showToast('Již vyzvednuto', 'Tento milník již byl vyzvednut.', 'info');
            return;
        }
        if ((currentProfile.streak_days || 0) < milestoneConfig.milestone_day) {
            showToast('Nedostatečná série', 'Pro vyzvednutí tohoto milníku ještě nemáte dostatečně dlouhou sérii.', 'warning');
            return;
        }

        setLoadingState('streakMilestones', true);
        let allRewardsAwarded = true;

        try {
            for (const reward of milestoneConfig.rewards) {
                if (reward.reward_type === 'xp' && reward.reward_value) {
                    // await addExperience(reward.reward_value, `Milník série (${milestoneDay} dní): ${reward.reward_name}`);
                    console.log(`[Claim Milestone] Přidání ${reward.reward_value} XP`);
                } else if (reward.reward_type === 'credits' && reward.reward_value) {
                    await awardPoints(reward.reward_value, `Milník série (${milestoneDay} dní): ${reward.reward_name}`, 'streak_milestone', null, true);
                } else if (reward.reward_type === 'title' && reward.reward_key) {
                    await awardUserTitle(reward.reward_key, reward.reward_name, `Milník série (${milestoneDay} dní)`);
                }
            }

            // Zaznamenání vyzvednutí do DB
            const recordSuccess = await updateLastMilestoneClaimedInDB(milestoneConfig.milestone_day, milestoneConfig.reward_key_internal, milestoneConfig.milestone_name);

            if (recordSuccess) {
                 // Aktualizace lokálního profilu (pokud DB nevrací celý profil)
                if (!currentProfile.claimed_streak_milestones) currentProfile.claimed_streak_milestones = [];
                currentProfile.claimed_streak_milestones.push({
                    milestone_day: milestoneConfig.milestone_day,
                    reward_key: milestoneConfig.reward_key_internal,
                    claimed_at: new Date().toISOString(),
                    reward_name: milestoneConfig.milestone_name
                });
                if(milestoneConfig.milestone_day > (currentProfile.last_milestone_claimed || 0)){
                    currentProfile.last_milestone_claimed = milestoneConfig.milestone_day;
                }


                showToast('Milník dosažen!', `Odměny za ${milestoneConfig.milestone_name} byly uděleny.`, 'success');
                await logActivity(currentUser.id, 'streak_milestone_claimed', `Dosažen milník série: ${milestoneConfig.milestone_name}`, `Série ${milestoneConfig.milestone_day} dní.`, { milestone_day: milestoneConfig.milestone_day });
                renderStreakMilestones(); // Překreslí milníky
            } else {
                 allRewardsAwarded = false; // DB record failed
                 showToast('Chyba ukládání', 'Odměny uděleny, ale nepodařilo se uložit záznam o vyzvednutí.', 'error');
            }

        } catch (error) {
            allRewardsAwarded = false;
            console.error("[Claim Milestone] Chyba při udělování odměn za milník:", error);
            showToast('Chyba', `Při udělování odměn za milník nastala chyba: ${error.message}`, 'error');
        } finally {
            setLoadingState('streakMilestones', false);
        }
    }

    // --- END: Rewards Logic (UPRAVENO PRO DATABÁZI) ---


    // --- START: Event Listeners Setup (bez změn oproti v27.0.10, pro úplnost ponechány) ---
    function setupEventListeners() { const startTime = performance.now(); console.log("[SETUP] setupEventListeners: Start"); if (!ui || Object.keys(ui).length === 0) { console.error("[SETUP] UI cache is empty! Cannot setup listeners."); return; } const listenersAdded = new Set(); const safeAddListener = (element, eventType, handler, key) => { if (element) { element.removeEventListener(eventType, handler); element.addEventListener(eventType, handler); listenersAdded.add(key); } else { console.warn(`[SETUP] Element not found for listener: ${key}`); } }; safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle'); safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle'); safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay'); safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn'); document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); }); safeAddListener(ui.startPracticeBtn, 'click', () => { window.location.href = '/dashboard/procvicovani/main.html'; }, 'startPracticeBtn'); safeAddListener(ui.openMonthlyModalBtn, 'click', () => showModal('monthly-reward-modal'), 'openMonthlyModalBtn'); safeAddListener(ui.openStreakModalBtn, 'click', () => showModal('streak-milestones-modal'), 'openStreakModalBtn'); safeAddListener(ui.refreshDataBtn, 'click', async () => { if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; ui.refreshDataBtn.disabled = true; await initializeApp(); /* Changed from loadDashboardData to full re-init for configs */ if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; ui.refreshDataBtn.disabled = false; }, 'refreshDataBtn'); safeAddListener(ui.notificationBell, 'click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell'); safeAddListener(ui.markAllReadBtn, 'click', markAllNotificationsRead, 'markAllReadBtn'); safeAddListener(ui.notificationsList, 'click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount?.textContent?.replace('+', '') || '0'; const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); if(ui.notificationCount) { ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); } if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }, 'notificationsList'); document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown?.classList.remove('active'); } }); safeAddListener(ui.closeMonthlyModalBtn, 'click', () => hideModal('monthly-reward-modal'), 'closeMonthlyModalBtn'); safeAddListener(ui.monthlyRewardModal, 'click', (event) => { if (event.target === ui.monthlyRewardModal) { hideModal('monthly-reward-modal'); } }, 'monthlyRewardModal'); safeAddListener(ui.closeStreakModalBtn, 'click', () => hideModal('streak-milestones-modal'), 'closeStreakModalBtn'); safeAddListener(ui.streakMilestonesModal, 'click', (event) => { if (event.target === ui.streakMilestonesModal) { hideModal('streak-milestones-modal'); } }, 'streakMilestonesModal'); window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus); if (ui.mainContent) ui.mainContent.addEventListener('scroll', initHeaderScrollDetection, { passive: true }); const endTime = performance.now(); console.log(`[SETUP] Event listeners set up. Added: ${[...listenersAdded].length}. Time: ${(endTime - startTime).toFixed(2)}ms`); }
    // --- END: Event Listeners Setup ---

    // --- START: App Initialization (UPRAVENO PRO NAČÍTÁNÍ KONFIGURACÍ Z DB) ---
    async function fetchClaimedStreakMilestones(userId) { if (!supabase || !userId) { console.error("[ClaimedMilestones] Supabase client or User ID missing."); return []; } console.log(`[ClaimedMilestones] Fetching claimed streak milestones for user ${userId}`); try { const { data, error } = await supabase .from('claimed_streak_milestones') .select('milestone_day, reward_key, claimed_at, reward_name') .eq('user_id', userId); if (error) throw error; console.log(`[ClaimedMilestones] Fetched ${data?.length || 0} claimed milestones.`); return data || []; } catch (e) { console.error('[ClaimedMilestones] Exception fetching claimed streak milestones:', e); showToast('Chyba', 'Nepodařilo se načíst získané milníky série.', 'error'); return []; } }

    async function loadDashboardData(user, profile) {
        const startTime = performance.now();
        if (!user || !profile) {
            showError("Chyba: Nelze načíst data bez profilu uživatele.", true);
            setLoadingState('all', false);
            return;
        }
        console.log("[MAIN] loadDashboardData: Start pro uživatele:", user.id);
        hideError();

        setLoadingState('welcomeBanner', true);
        setLoadingState('stats', true);
        setLoadingState('shortcuts', true);
        setLoadingState('notifications', true);
        setLoadingState('activities', true);
        setLoadingState('creditHistory', true);

        try {
            await checkAndUpdateLoginStreak();
             // Načtení user-specific claimed milestones se přesunulo do initializeApp
             // aby bylo dostupné i pro renderStreakMilestones volané z showModal

            updateSidebarProfile(currentProfile); // Profil je již načtený v initializeApp
            updateWelcomeBannerAndLevel(currentProfile);

            console.log("[MAIN] loadDashboardData: Paralelní načítání...");

            const statsResultPromise = fetchUserStats(user.id, currentProfile);
            const notificationsResultPromise = fetchNotifications(user.id, 5);
            const dashboardListsResultPromise = (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderAll === 'function')
                ? DashboardLists.loadAndRenderAll(user.id, 5)
                : Promise.resolve({ status: 'fulfilled', value: console.warn("DashboardLists.loadAndRenderAll not found.") });
            const latestCreditDataPromise = fetchAndDisplayLatestCreditChange(user.id);

            const [statsResult, notificationsResult, dashboardListsResult, latestCreditDataResult] = await Promise.allSettled([
                statsResultPromise,
                notificationsResultPromise,
                dashboardListsResultPromise,
                latestCreditDataPromise
            ]);

            console.log("[MAIN] loadDashboardData: Hlavní data načtena.");

            if (statsResult.status === 'fulfilled' && statsResult.value) {
                userStatsData = statsResult.value;
                updateStatsCards(userStatsData);
            } else {
                console.error("❌ Chyba při načítání statistik:", statsResult.reason);
                showError("Nepodařilo se načíst statistiky.", false);
                updateStatsCards(currentProfile);
            }

            if (notificationsResult.status === 'fulfilled' && notificationsResult.value) {
                const { unreadCount, notifications } = notificationsResult.value;
                renderNotifications(unreadCount, notifications);
            } else {
                console.error("❌ Chyba při načítání oznámení:", notificationsResult.reason);
                renderNotifications(0, []);
            }

            if (dashboardListsResult.status === 'rejected') {
                console.error("❌ Chyba при DashboardLists.loadAndRenderAll:", dashboardListsResult.reason);
            }

            const endTime = performance.now();
            console.log(`[MAIN] loadDashboardData: Data načtena a zobrazena. Time: ${(endTime - startTime).toFixed(2)}ms`);
        } catch (error) {
            console.error('[MAIN] loadDashboardData: Zachycena hlavní chyba:', error);
            showError('Nepodařilo se kompletně načíst data nástěnky: ' + error.message);
            updateStatsCards(currentProfile);
            renderNotifications(0, []);
            if (typeof DashboardLists !== 'undefined') {
                if (typeof DashboardLists.renderActivities === 'function') DashboardLists.renderActivities(null);
                if (typeof DashboardLists.renderCreditHistory === 'function') DashboardLists.renderCreditHistory(null);
            }
            if (ui.latestCreditChange) ui.latestCreditChange.style.display = 'none';
            if (ui.totalPointsFooter) ui.totalPointsFooter.innerHTML = `<i class="fas fa-exclamation-circle"></i> Chyba`;

        } finally {
            setLoadingState('welcomeBanner', false);
            setLoadingState('stats', false);
            setLoadingState('shortcuts', false);
            setLoadingState('notifications', false);
            setLoadingState('activities', false);
            setLoadingState('creditHistory', false);
            if (typeof initTooltips === 'function') initTooltips();
            console.log("[MAIN] loadDashboardData: Blok finally dokončen.");
        }
    }


    async function initializeApp() {
        const totalStartTime = performance.now();
        console.log("[INIT Dashboard] initializeApp: Start v27.0.11");
        let stepStartTime = performance.now();

        cacheDOMElements();
        console.log(`[INIT Dashboard] cacheDOMElements Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
        stepStartTime = performance.now();

        const initialLoaderElement = ui.initialLoader;
        const mainContentElement = ui.mainContent;
        const sidebarElement = ui.sidebar;
        const headerElement = ui.dashboardHeader;

        try {
            if (sidebarElement) sidebarElement.style.display = 'flex';
            if (headerElement) headerElement.style.display = 'flex';
            if (mainContentElement) mainContentElement.style.display = 'block';

            if (ui.mainContentAreaPlaceholder) {
                ui.mainContentAreaPlaceholder.innerHTML = '<div class="loading-spinner" style="margin:auto;"></div><p>Načítání palubní desky...</p>';
                ui.mainContentAreaPlaceholder.style.display = 'flex';
                 setLoadingState('welcomeBanner', true);
                 setLoadingState('stats', true);
                 setLoadingState('shortcuts', true);
                 if (ui.activityListContainerWrapper) ui.activityListContainerWrapper.classList.add('loading-section');
                 if (ui.creditHistoryContainerWrapper) ui.creditHistoryContainerWrapper.classList.add('loading-section');
            } else {
                console.warn("[INIT Dashboard] mainContentAreaPlaceholder NOT FOUND in DOM after cache. Layout might be affected.");
            }

            if (initialLoaderElement) {
                initialLoaderElement.classList.add('hidden');
                setTimeout(() => { if (initialLoaderElement) initialLoaderElement.style.display = 'none'; }, 50);
            }
            console.log(`[INIT Dashboard] Basic UI visible, initialLoader hidden. Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
            stepStartTime = performance.now();

            const waitForSupabase = new Promise((resolve, reject) => { const maxAttempts = 10; let attempts = 0; const intervalId = setInterval(() => { attempts++; if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') { console.log(`[INIT Dashboard] Supabase library found after ${attempts} attempts.`); clearInterval(intervalId); resolve(); } else if (attempts >= maxAttempts) { console.error("[INIT Dashboard] Supabase library not found after waiting. Aborting."); clearInterval(intervalId); reject(new Error("Knihovna Supabase nebyla nalezena včas.")); } else { console.log(`[INIT Dashboard] Waiting for Supabase library... (Attempt ${attempts}/${maxAttempts})`); } }, 200); });
            await waitForSupabase;
            console.log(`[INIT Dashboard] waitForSupabase Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
            stepStartTime = performance.now();

            if (!initializeSupabase()) { console.error("[INIT Dashboard] Supabase init function failed. Aborting."); return; }
            console.log(`[INIT Dashboard] initializeSupabase Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
            stepStartTime = performance.now();

            applyInitialSidebarState();
            console.log(`[INIT Dashboard] applyInitialSidebarState Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
            stepStartTime = performance.now();

            setupEventListeners();
            console.log(`[INIT Dashboard] setupEventListeners Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
            stepStartTime = performance.now();

            setLoadingState('session', true);
            setLoadingState('rewardsConfig', true); // Začátek načítání konfigurací odměn
            console.log("[INIT Dashboard] Checking auth session (async)...");

            try {
                const { data: { session }, error: sessionError } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT, new Error('Ověření sezení vypršelo.'));
                 console.log(`[INIT Dashboard] getSession Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
                 stepStartTime = performance.now();
                setLoadingState('session', false);

                if (sessionError) {
                    if (sessionError.message.toLowerCase().includes('networkerror')) {
                         throw new Error('Chyba sítě při ověřování sezení. Zkontrolujte své připojení k internetu.');
                    }
                     throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);
                }

                if (session?.user) {
                    currentUser = session.user;
                    console.log(`[INIT Dashboard] User authenticated (ID: ${currentUser.id}). Loading profile, titles, and reward configs...`);
                    if (ui.mainContentAreaPlaceholder) ui.mainContentAreaPlaceholder.style.display = 'none';

                    // Načtení všech konfigurací paralelně s profilem atd.
                    const [
                        profileResult,
                        titlesResult,
                        claimedMilestonesResult,
                        monthlyRewardsConfigResult,
                        streakMilestonesConfigResult
                    ] = await Promise.allSettled([
                        fetchUserProfile(currentUser.id),
                        fetchTitles(),
                        fetchClaimedStreakMilestones(currentUser.id),
                        fetchActiveMonthlyRewardsCalendarFromDB(), // NOVÉ
                        fetchAllStreakMilestonesFromDB()          // NOVÉ
                    ]);
                     setLoadingState('rewardsConfig', false); // Konec načítání konfigurací odměn
                    console.log(`[INIT Dashboard] Core data fetch (Profile, Titles, Claims, Reward Configs) Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
                    stepStartTime = performance.now();


                    if (profileResult.status === 'fulfilled' && profileResult.value) {
                        currentProfile = profileResult.value;
                        console.log("[INIT Dashboard] Profile loaded:", currentProfile);
                    } else {
                        const profileErrorReason = profileResult.reason || 'Neznámá chyba při načítání profilu.';
                        console.warn(`[INIT Dashboard] Profile not found or fetch failed (${profileErrorReason}), attempting to create default...`);
                        currentProfile = await createDefaultProfile(currentUser.id, currentUser.email);
                        if (!currentProfile) throw new Error(`Nepodařilo se vytvořit/načíst profil uživatele. Důvod: ${profileErrorReason}`);
                        console.log("[INIT Dashboard] Default profile created/retrieved.");
                    }

                    if (titlesResult.status === 'fulfilled') {
                        allTitles = titlesResult.value || [];
                        console.log("[INIT Dashboard] Titles loaded:", allTitles.length);
                    } else {
                        console.warn("[INIT Dashboard] Failed to load titles:", titlesResult.reason);
                        allTitles = [];
                        showToast('Varování', 'Nepodařilo se načíst seznam titulů.', 'warning');
                    }

                    if (claimedMilestonesResult.status === 'fulfilled') {
                        currentProfile.claimed_streak_milestones = claimedMilestonesResult.value || [];
                        console.log("[INIT Dashboard] Claimed streak milestones loaded:", currentProfile.claimed_streak_milestones.length);
                    } else {
                        console.warn("[INIT Dashboard] Failed to load claimed streak milestones:", claimedMilestonesResult.reason);
                        currentProfile.claimed_streak_milestones = [];
                        showToast('Varování', 'Nepodařilo se načíst získané milníky série.', 'warning');
                    }

                    // Uložení načtených konfigurací odměn
                    if (monthlyRewardsConfigResult.status === 'fulfilled' && monthlyRewardsConfigResult.value) {
                        activeMonthlyRewardsCalendar = monthlyRewardsConfigResult.value;
                        console.log("[INIT Dashboard] Active Monthly Rewards Calendar loaded from DB:", activeMonthlyRewardsCalendar);
                    } else {
                        console.error("[INIT Dashboard] Failed to load monthly rewards config from DB:", monthlyRewardsConfigResult.reason);
                        activeMonthlyRewardsCalendar = null; // Zajistí, že render funkce zobrazí chybu nebo prázdný stav
                    }

                    if (streakMilestonesConfigResult.status === 'fulfilled' && streakMilestonesConfigResult.value) {
                        allConfiguredStreakMilestones = streakMilestonesConfigResult.value;
                        console.log("[INIT Dashboard] Streak Milestones Config loaded from DB:", allConfiguredStreakMilestones);
                    } else {
                        console.error("[INIT Dashboard] Failed to load streak milestones config from DB:", streakMilestonesConfigResult.reason);
                        allConfiguredStreakMilestones = []; // Zajistí, že render funkce zobrazí chybu nebo prázdný stav
                    }


                    updateSidebarProfile(currentProfile);
                    updateCopyrightYear();
                    updateOnlineStatus();

                    if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.initialize === 'function') {
                        DashboardLists.initialize({
                            supabaseClient: supabase,
                            currentUser: currentUser,
                            activityVisuals: activityVisuals,
                            formatRelativeTime: formatRelativeTime,
                            sanitizeHTML: sanitizeHTML,
                        });
                    } else {
                        console.error("Modul DashboardLists není definován nebo nemá funkci initialize!");
                        setLoadingState('activities', false); setLoadingState('creditHistory', false);
                    }

                    await loadDashboardData(currentUser, currentProfile);
                    console.log(`[INIT Dashboard] loadDashboardData Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);

                    requestAnimationFrame(() => {
                        if (ui.mainContent) ui.mainContent.classList.add('loaded');
                        initScrollAnimations();
                    });

                    initMouseFollower();
                    initHeaderScrollDetection();
                    initTooltips();

                    const readyEvent = new CustomEvent('dashboardReady', { detail: { user: currentUser, profile: currentProfile, client: supabase, titles: allTitles } });
                    document.dispatchEvent(readyEvent);
                    console.log("[INIT Dashboard] Dispatching 'dashboardReady' event.");

                } else {
                    console.log('[INIT Dashboard] V sezení není uživatel, přesměrování.');
                    if (ui.mainContentAreaPlaceholder) ui.mainContentAreaPlaceholder.style.display = 'none';
                    showError("Nejste přihlášeni. Přesměrovávám na přihlašovací stránku...", false, ui.mainContentAreaPlaceholder);
                    setTimeout(() => { window.location.href = '/auth/index.html'; }, 3000);
                }

            } catch (authError) {
                console.error("❌ [INIT Dashboard] Auth/Session Check Error:", authError);
                setLoadingState('session', false);
                setLoadingState('rewardsConfig', false);
                let userFriendlyMessage = `Chyba ověření: ${authError.message}`;
                if (authError.message.toLowerCase().includes('ověření sezení vypršelo')) {
                    userFriendlyMessage = "Ověření sezení vypršelo. Zkuste prosím obnovit stránku, nebo zkontrolujte své internetové připojení.";
                } else if (authError.message.toLowerCase().includes('networkerror')) {
                    userFriendlyMessage = "Chyba sítě. Zkontrolujte své internetové připojení a zkuste to znovu.";
                }
                showError(userFriendlyMessage, false, ui.mainContentAreaPlaceholder);
                if (ui.mainContent) ui.mainContent.style.display = 'block';
            }

            const totalEndTime = performance.now();
            console.log(`✅ [INIT Dashboard] App initializeApp function finished. Total Time: ${(totalEndTime - totalStartTime).toFixed(2)}ms`);

        } catch (error) {
            console.error("❌ [INIT Dashboard] Kritická chyba PŘED ověřením sezení:", error);
            const endTime = performance.now();
            console.log(`[INIT Dashboard] Initialization failed. Time: ${(endTime - totalStartTime).toFixed(2)}ms`);
            const initialLoaderElementForError = document.getElementById('initial-loader');
            if (initialLoaderElementForError && !initialLoaderElementForError.classList.contains('hidden')) {
                initialLoaderElementForError.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE STRÁNKU.</p>`;
            } else {
                const globalErrorElement = document.getElementById('global-error');
                 if (globalErrorElement) {
                     globalErrorElement.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>Kritická chyba inicializace: ${sanitizeHTML(error.message)}</div><button class="retry-button btn" onclick="location.reload()">Obnovit Stránku</button></div>`;
                     globalErrorElement.style.display = 'block';
                 } else {
                    alert(`Kritická chyba inicializace: ${error.message}`);
                 }
            }
            const mainContentForError = document.getElementById('main-content');
            if (mainContentForError) mainContentForError.style.display = 'none';
            if (typeof setLoadingState === 'function') setLoadingState('all', false);
        }
    }
    // --- END: App Initialization ---

    // --- START THE APP ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }
    // --- END THE APP ---

    window.DashboardApp = {
        showToast,
    };
})();