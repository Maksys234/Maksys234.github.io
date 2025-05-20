// dashboard.js
// Verze: 27.0.3
// Opravy: 
// 1. Milníky série se nyní správně načítají a ukládají lokálně.
// 2. Opraveno nekonečné načítání v patičce kreditů.
// 3. Přidáno načítání claimed_streak_milestones při inicializaci.
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

    const AUTH_TIMEOUT = 30000;
    const DATA_FETCH_TIMEOUT = 20000;

    const PROFILE_COLUMNS_TO_SELECT = 'id, username, first_name, last_name, email, avatar_url, bio, school, grade, level, completed_exercises, streak_days, last_login, badges_count, points, preferences, notifications, experience, purchased_titles, selected_title, monthly_claims, last_milestone_claimed, longest_streak_days, created_at, updated_at';

    let isLoading = {
        stats: false,
        activities: false,
        creditHistory: false,
        notifications: false,
        titles: false,
        monthlyRewards: false,
        streakMilestones: false,
        all: false,
        session: false,
        welcomeBanner: false,
        shortcuts: false,
        latestCreditTransaction: false,
        claimedMilestones: false // Nový stav pro načítání vyzvednutých milníků
    };
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
    const MONTHLY_REWARD_DAYS = 31;
    // --- END: Constants and Configuration ---

    // --- START: UI Elements Cache (to be populated by cacheDOMElements) ---
    let ui = {};
    // --- END: UI Elements Cache ---

    // --- START: Reward Configurations ---
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
        7: {
            name: "Týdenní Vytrvalec",
            description: "Studujte bez přestávky celý týden.",
            icon: "fas fa-calendar-week",
            rewards: [
                { type: 'xp', value: 50, name: '+50 ZK', icon_reward: 'fas fa-star' },
                { type: 'credits', value: 25, name: '+25 Kreditů', icon_reward: 'fas fa-coins' }
            ],
            reward_key: "streak_7_days"
        },
        14: {
            name: "Dvoutýdenní Hrdina",
            description: "Neuvěřitelná vytrvalost! Dva týdny studia.",
            icon: "fas fa-shield-alt",
            rewards: [
                { type: 'title', key: 'zelezná_vule', name: 'Titul: Železná Vůle', icon_reward: 'fas fa-crown' },
                { type: 'xp', value: 100, name: '+100 ZK', icon_reward: 'fas fa-star' }
            ],
            reward_key: "streak_14_days"
        },
        30: {
            name: "Měsíční Maratonec",
            description: "Celý měsíc konzistence! Jste na nejlepší cestě.",
            icon: "fas fa-award",
            rewards: [
                { type: 'title', key: 'maratonec_vedomosti', name: 'Titul: Maratonec Vědomostí', icon_reward: 'fas fa-crown' },
                { type: 'xp', value: 150, name: '+150 ZK', icon_reward: 'fas fa-star' },
                { type: 'credits', value: 75, name: '+75 Kreditů', icon_reward: 'fas fa-coins' }
            ],
            reward_key: "streak_30_days"
        },
        60: {
            name: "Diamantová Série",
            description: "Dva měsíce! Vaše odhodlání je pevné jako diamant.",
            icon: "fas fa-gem",
            rewards: [
                { type: 'title', key: 'diamantova_mysl', name: 'Titul: Diamantová Mysl', icon_reward: 'fas fa-crown' },
                { type: 'xp', value: 250, name: '+250 ZK', icon_reward: 'fas fa-star' },
                { type: 'credits', value: 150, name: '+150 Kreditů', icon_reward: 'fas fa-coins' }
            ],
            reward_key: "streak_60_days"
        },
        90: {
            name: "Nezastavitelný Učenec",
            description: "Tři měsíce nepřetržitého pokroku! Jste nezastavitelní!",
            icon: "fas fa-rocket",
            rewards: [
                { type: 'title', key: 'nezlomny_duch', name: 'Titul: Nezlomný Duch', icon_reward: 'fas fa-crown' },
                { type: 'xp', value: 500, name: '+500 ZK', icon_reward: 'fas fa-star' },
                { type: 'credits', value: 300, name: '+300 Kreditů', icon_reward: 'fas fa-coins' }
            ],
            reward_key: "streak_90_days"
        }
    };
    const sortedMilestoneDays = Object.keys(STREAK_MILESTONES_CONFIG).map(Number).sort((a, b) => a - b);

    const mayRewardsConfig = {
        1: { type: 'title', key: 'majovy_poutnik', name: 'Májový Poutník', icon: 'fas fa-hiking', description: "Začněte květen s exkluzivním titulem!" },
        3: { type: 'xp', value: 20, name: 'Bonusové ZK', icon: 'fas fa-star', description: "Malý přísun zkušeností." },
        5: { type: 'credits', value: 25, name: 'Kredity Navíc', icon: 'fas fa-coins', description: "Něco málo do kasičky." },
        7: { type: 'title', key: 'kral_majalesu', name: 'Král Majálesu', icon: 'fas fa-chess-king', description: "Oslavte týden v květnu titulem!" },
        10: { type: 'xp', value: 50, name: 'Extra ZK', icon: 'fas fa-star', description: "Pořádná dávka zkušeností." },
        12: { type: 'credits', value: 50, name: 'Balíček Kreditů', icon: 'fas fa-coins', description: "Kredity se vždycky hodí!" },
        14: { type: 'title', key: 'kvetouci_duse', name: 'Kvetoucí Duše', icon: 'fas fa-spa', description: "Uprostřed měsíce, duše kvete." },
        17: { type: 'xp', value: 75, name: 'Velký ZK Bonus', icon: 'fas fa-star', description: "ZK za vytrvalost." },
        20: { type: 'credits', value: 100, name: 'Jackpot Kreditů', icon: 'fas fa-coins', description: "Velký kreditní balíček!" },
        21: { type: 'title', key: 'majovy_vanek', name: 'Májový Vánek', icon: 'fas fa-wind', description: "Lehkost bytí v květnu." },
        24: { type: 'xp', value: 100, name: 'Masivní ZK', icon: 'fas fa-star', description: "Obrovský ZK boost!" },
        28: { type: 'title', key: 'prvni_laska', name: 'První Láska', icon: 'fas fa-heart', description: "Láska kvete v máji." },
        31: {
            type: 'bundle',
            name: 'Velká Májová Truhla',
            icon: 'fas fa-archive',
            description: "Speciální odměna na konci května!",
            rewards: [
                { type: 'title', key: 'kvetnovy_sampion', name: 'Titul: Květnový Šampion', icon_reward: 'fas fa-trophy' },
                { type: 'credits', value: 250, name: '+250 Kreditů', icon_reward: 'fas fa-coins' },
                { type: 'xp', value: 100, name: '+100 ZK', icon_reward: 'fas fa-star' }
            ]
        }
    };

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
    // --- END: Reward Configurations ---

    // --- START: Helper Functions (defined before use) ---
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
            { key: 'overallProgressValue', id: 'overall-progress-value', critical: false },
            { key: 'overallProgressFooter', id: 'overall-progress-footer', critical: false },
            { key: 'pointsCard', id: 'points-card', critical: false },
            { key: 'totalPointsValue', id: 'total-points-value', critical: false },
            { key: 'latestCreditChange', id: 'latest-credit-change', critical: false },
            { key: 'totalPointsFooter', id: 'total-points-footer', critical: true },
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
            if (element) { ui[def.key] = element; }
            else { ui[def.key] = null; if (def.critical) notFoundCritical.push(`${def.key} (ID/Query: ${def.id || def.query})`); else console.warn(`[CACHE DOM] Non-critical element not found: ${def.key}`); }
        });
        ui.activityList = document.getElementById('activity-list');
        ui.activityListEmptyState = document.getElementById('activity-list-empty-state');
        ui.activityListErrorState = document.getElementById('activity-list-error-state');
        ui.creditHistoryList = document.getElementById('credit-history-list');
        ui.creditHistoryEmptyState = document.getElementById('credit-history-empty-state');
        ui.creditHistoryErrorState = document.getElementById('credit-history-error-state');
        if (ui.statsCardsContainer && !ui.progressCard) {
            ui.progressCard = ui.statsCardsContainer.querySelector('#progress-card');
            ui.pointsCard = ui.statsCardsContainer.querySelector('#points-card');
            ui.streakCard = ui.statsCardsContainer.querySelector('#streak-card');
        }
        if (notFoundCritical.length > 0) { console.error(`[CACHE DOM] CRITICAL elements not found: (${notFoundCritical.length})`, notFoundCritical); throw new Error(`Chyba načítání stránky: Kritické komponenty chybí (${notFoundCritical.join(', ')}).`); }
        else { console.log("[CACHE DOM] All critical elements found."); }
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
    function showModal(modalId) { const modal = document.getElementById(modalId); if (modal) { console.log(`[Modal] Opening modal: ${modalId}`); modal.style.display = 'flex'; if (modalId === 'monthly-reward-modal' && typeof renderMonthlyCalendar === 'function') { renderMonthlyCalendar(); } else if (modalId === 'streak-milestones-modal' && typeof renderStreakMilestones === 'function') { renderStreakMilestones(); } requestAnimationFrame(() => { modal.classList.add('active'); }); } else { console.error(`Modal element not found: #${modalId}`); } }
    function hideModal(modalId) { const modal = document.getElementById(modalId); if (modal) { console.log(`[Modal] Closing modal: ${modalId}`); modal.classList.remove('active'); setTimeout(() => { modal.style.display = 'none'; }, 300); } }
    function withTimeout(promise, ms, timeoutError = new Error('Operace vypršela')) { const timeoutPromise = new Promise((_, reject) => { setTimeout(() => reject(timeoutError), ms); }); return Promise.race([promise, timeoutPromise]); }
    function updateCopyrightYear() { const currentYearSpan = ui.currentYearFooter; const currentYearSidebar = ui.currentYearSidebar; const year = new Date().getFullYear(); if (currentYearSpan) { currentYearSpan.textContent = year; } if (currentYearSidebar) { currentYearSidebar.textContent = year; } }
    function initTooltips() { try { if (window.jQuery && typeof window.jQuery.fn.tooltipster === 'function') { window.jQuery('.btn-tooltip.tooltipstered').each(function() { if (document.body.contains(this)) { try { window.jQuery(this).tooltipster('destroy'); } catch (destroyError) { console.warn("Tooltipster destroy error:", destroyError); } } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); console.log("[Tooltips] Initialized/Re-initialized."); } else { console.warn("[Tooltips] jQuery or Tooltipster library not loaded."); } } catch (e) { console.error("[Tooltips] Error initializing Tooltipster:", e); } }
    function initMouseFollower() { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    function initHeaderScrollDetection() { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 50); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl && mainEl.scrollTop > 50) document.body.classList.add('scrolled'); };
    function initScrollAnimations() { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }); animatedElements.forEach(element => observer.observe(element)); };
    // --- END: Helper Functions ---

    // --- START: Skeleton and Loading State Management (Moved before use) ---
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
        } else if (sectionKey === 'monthlyRewards' || sectionKey === 'streakMilestones' || sectionKey === 'claimedMilestones') {
            const modal = sectionKey === 'monthlyRewards' ? ui.monthlyRewardModal : ui.streakMilestonesModal; // claimedMilestones nemá vlastní UI, řídí se modalMilestones
            const modalBody = modal?.querySelector('.modal-body');
            const loaderOverlay = modalBody?.querySelector('.loading-overlay');

            if (loaderOverlay) loaderOverlay.classList.toggle('hidden', !isLoadingFlag);
            if (modalBody) modalBody.classList.toggle('loading', isLoadingFlag);
        } else if (sectionKey === 'titles') {
            console.log(`[SetLoadingState] Loading state for 'titles' is now ${isLoadingFlag}.`);
        } else if (sectionKey === 'latestCreditTransaction') {
            if (ui.totalPointsFooter) {
                if (isLoadingFlag) {
                    ui.totalPointsFooter.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Načítání...`;
                }
            }
        } else {
            console.warn(`[SetLoadingState] Unknown section key or unhandled UI in dashboard.js: ${sectionKey}`);
        }
    }


    function applyInitialSidebarState() { const startTime = performance.now(); if (!ui.sidebarToggleBtn) { console.warn("[Sidebar State] Sidebar toggle button (#sidebar-toggle-btn) not found for initial state application."); return; } try { const savedState = localStorage.getItem(SIDEBAR_STATE_KEY); const shouldBeCollapsed = savedState === 'collapsed'; console.log(`[Sidebar State] Initial read state from localStorage: '${savedState}', Applying collapsed: ${shouldBeCollapsed}`); document.body.classList.toggle('sidebar-collapsed', shouldBeCollapsed); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) { icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.setAttribute('title', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); const endTime = performance.now(); console.log(`[Sidebar State] Initial icon and attributes set. Icon class: ${icon.className}. Time: ${(endTime - startTime).toFixed(2)}ms`); } else { console.warn("[Sidebar State] Sidebar toggle button icon not found for initial state update."); } } catch (error) { console.error("[Sidebar State] Error applying initial state:", error); document.body.classList.remove('sidebar-collapsed'); } }
    function toggleSidebar() { try { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) { icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.setAttribute('title', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); } console.log(`[Sidebar Toggle] Sidebar toggled. New state: ${isCollapsed ? 'collapsed' : 'expanded'}`); } catch(e){console.error("[Sidebar Toggle] Error:",e);}}
    // --- END: Skeleton and Loading State Management ---

    // --- START: Supabase Interaction Functions (Moved earlier) ---
    function initializeSupabase() { const startTime = performance.now(); console.log("[Supabase] Attempting initialization..."); try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded or createClient is not a function."); } supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); if (!supabase) { throw new Error("Supabase client creation failed (returned null/undefined)."); } window.supabaseClient = supabase; const endTime = performance.now(); console.log(`[Supabase] Klient úspěšně inicializován a globálně dostupný. Time: ${(endTime - startTime).toFixed(2)}ms`); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi. Zkuste obnovit stránku.", true); return false; } }
    async function fetchUserProfile(userId) { const startTime = performance.now(); console.log(`[Profile] Fetching profile for user ID: ${userId}`); if (!supabase || !userId) return null; try { const { data: profile, error } = await withTimeout(supabase.from('profiles').select(PROFILE_COLUMNS_TO_SELECT).eq('id', userId).single(), DATA_FETCH_TIMEOUT, new Error('Načítání profilu vypršelo.')); if (error && error.code !== 'PGRST116') { throw error; } if (!profile) { console.warn(`[Profile] Profile for ${userId} not found. Returning null.`); return null; } profile.monthly_claims = profile.monthly_claims || {}; profile.last_milestone_claimed = profile.last_milestone_claimed || 0; profile.purchased_titles = profile.purchased_titles || []; profile.claimed_streak_milestones = []; // Inicializace jako prázdné pole, naplní se později const endTime = performance.now(); console.log(`[Profile] Profile data fetched successfully. Time: ${(endTime - startTime).toFixed(2)}ms`); return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); return null; } }
    async function createDefaultProfile(userId, userEmail) { const startTime = performance.now(); if (!supabase || !userId || !userEmail) return null; console.log(`[Profile Create] Creating default profile for user ${userId}`); try { const defaultData = { id: userId, email: userEmail, username: userEmail.split('@')[0] || `user_${userId.substring(0, 6)}`, level: 1, points: 0, experience: 0, badges_count: 0, streak_days: 0, longest_streak_days: 0, last_login: new Date().toISOString(), monthly_claims: {}, last_milestone_claimed: 0, purchased_titles: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), preferences: { dark_mode: window.matchMedia('(prefers-color-scheme: dark)').matches, language: 'cs' }, notifications: { email: true, study_tips: true, content_updates: true, practice_reminders: true } }; const { data: newProfile, error } = await withTimeout(supabase.from('profiles').insert(defaultData).select(PROFILE_COLUMNS_TO_SELECT).single(), DATA_FETCH_TIMEOUT, new Error('Vytváření profilu vypršelo.')); if (error) { if (error.code === '23505') { console.warn("[Profile Create] Profile likely already exists, fetching again."); return await fetchUserProfile(userId); } throw error; } if (newProfile) newProfile.claimed_streak_milestones = []; const endTime = performance.now(); console.log(`[Profile Create] Default profile created. Time: ${(endTime - startTime).toFixed(2)}ms`); return newProfile; } catch (error) { console.error("[Profile Create] Failed to create default profile:", error); return null; } }
    async function fetchTitles() { const startTime = performance.now(); if (!supabase) return []; console.log("[Titles] Fetching available titles..."); setLoadingState('titles', true); try { const { data, error } = await withTimeout(supabase.from('title_shop').select('title_key, name'), DATA_FETCH_TIMEOUT, new Error('Načítání titulů vypršelo.')); if (error) throw error; const endTime = performance.now(); console.log(`[Titles] Fetched titles. Time: ${(endTime - startTime).toFixed(2)}ms`); return data || []; } catch (error) { console.error("[Titles] Error fetching titles:", error); return []; } finally { setLoadingState('titles', false); } }
    async function fetchUserStats(userId, profileData) { const startTime = performance.now(); if (!supabase || !userId || !profileData) { console.error("[Stats] Chybí Supabase klient, ID uživatele nebo data profilu."); return null; } console.log(`[Stats] Načítání statistik pro uživatele ${userId}...`); let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats] Chyba Supabase při načítání user_stats:", statsError.message); } } catch (error) { console.error("[Stats] Neočekávaná chyba při načítání user_stats:", error); statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, longest_streak_days: profileData.longest_streak_days ?? Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0 }; const endTime = performance.now(); if (statsError) { console.warn(`[Stats] Vracení statistik primárně z profilu kvůli chybě načítání. Time: ${(endTime - startTime).toFixed(2)}ms`); } else { console.log(`[Stats] Statistiky úspěšně načteny/sestaveny. Time: ${(endTime - startTime).toFixed(2)}ms`); } return finalStats; }
    async function fetchClaimedStreakMilestones(userId) {
        if (!supabase || !userId) {
            console.error("[Milestones] Missing Supabase or userId for fetching claimed milestones.");
            return [];
        }
        console.log(`[Milestones] Fetching claimed streak milestones for user ${userId}...`);
        setLoadingState('claimedMilestones', true);
        try {
            const { data, error } = await supabase
                .from('claimed_streak_milestones')
                .select('milestone_day, reward_key, claimed_at, reward_name')
                .eq('user_id', userId);

            if (error) {
                console.error("[Milestones] Error fetching claimed streak milestones:", error);
                throw error;
            }
            console.log(`[Milestones] Fetched ${data ? data.length : 0} claimed streak milestones.`);
            return data || [];
        } catch (error) {
            showToast('Chyba', 'Nepodařilo se načíst vyzvednuté milníky série.', 'error');
            return []; // Vrátit prázdné pole v případě chyby, aby aplikace nespadla
        } finally {
            setLoadingState('claimedMilestones', false);
        }
    }


    async function fetchAndDisplayLatestCreditTransaction(userId) {
        console.log(`[CreditChange] Fetching latest credit transaction for user ${userId}...`);
        setLoadingState('latestCreditTransaction', true);

        if (!supabase || !userId) {
            console.warn("[CreditChange] Missing Supabase or userId.");
            if (ui.totalPointsFooter) ui.totalPointsFooter.innerHTML = `<i class="fas fa-exclamation-circle"></i> Chyba načítání`;
            setLoadingState('latestCreditTransaction', false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('credit_transactions')
                .select('amount, description, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (ui.totalPointsFooter) {
                if (data && data.amount !== undefined) {
                    console.log(`[CreditChange] Latest transaction: ${data.amount}, Description: ${data.description}`);
                    const sign = data.amount > 0 ? '+' : (data.amount < 0 ? '' : '');
                    const descText = data.description || `Transakce`;
                    let displayDesc = descText;
                    if (displayDesc.length > 25) {
                        displayDesc = displayDesc.substring(0, 22) + "...";
                    }
                    const amountColorClass = data.amount > 0 ? 'positive' : (data.amount < 0 ? 'negative' : '');

                    ui.totalPointsFooter.innerHTML = `<i class="fas fa-history"></i> <span title="${sanitizeHTML(descText)} (${formatRelativeTime(data.created_at)}): ${sign}${data.amount}">${sanitizeHTML(displayDesc)}: <strong class="${amountColorClass}">${sign}${data.amount}</strong></span>`;
                    ui.totalPointsFooter.classList.remove('positive', 'negative');
                    if (data.amount > 0) ui.totalPointsFooter.classList.add('positive');
                    if (data.amount < 0) ui.totalPointsFooter.classList.add('negative');
                } else {
                    console.log('[CreditChange] No credit transactions found for user.');
                    ui.totalPointsFooter.innerHTML = `<i class="fas fa-info-circle"></i> Žádné nedávné transakce`;
                    ui.totalPointsFooter.classList.remove('positive', 'negative');
                }
            }
        } catch (error) {
            console.error('[CreditChange] Error fetching latest credit transaction:', error);
            if (ui.totalPointsFooter) {
                ui.totalPointsFooter.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Info o transakci chybí`;
                ui.totalPointsFooter.classList.remove('positive', 'negative');
            }
        } finally {
            setLoadingState('latestCreditTransaction', false);
        }
    }

    async function checkAndUpdateLoginStreak() { const startTime = performance.now(); if (!currentUser || !currentProfile || !supabase) { console.warn("[StreakCheck] Cannot perform check: missing user, profile, or supabase."); return false; } console.log("[StreakCheck] Performing daily login check/update..."); const today = new Date(); const lastLogin = currentProfile.last_login ? new Date(currentProfile.last_login) : null; let currentStreak = currentProfile.streak_days || 0; let longestStreak = currentProfile.longest_streak_days || 0; let needsDbUpdate = false; let updateData = { updated_at: today.toISOString() }; const currentMonthYear = getCurrentMonthYearString(); if (!lastLogin || !isSameDate(today, lastLogin)) { needsDbUpdate = true; console.log("[StreakCheck] First login of the day detected."); if (lastLogin && isYesterday(lastLogin, today)) { currentStreak++; console.log(`[StreakCheck] Streak continued! New current streak: ${currentStreak}`); } else if (lastLogin) { currentStreak = 1; console.log("[StreakCheck] Streak broken. Resetting to 1."); } else { currentStreak = 1; console.log("[StreakCheck] First login ever. Setting streak to 1."); } updateData.streak_days = currentStreak; updateData.last_login = today.toISOString(); if (currentStreak > longestStreak) { longestStreak = currentStreak; updateData.longest_streak_days = longestStreak; console.log(`[StreakCheck] New longest streak: ${longestStreak}!`); } } else { console.log("[StreakCheck] Already logged in today."); if (currentProfile.streak_days > (currentProfile.longest_streak_days || 0) ) { updateData.longest_streak_days = currentProfile.streak_days; longestStreak = currentProfile.streak_days; needsDbUpdate = true; } } currentProfile.streak_days = currentStreak; currentProfile.longest_streak_days = longestStreak; if (ui.modalCurrentStreakValue) ui.modalCurrentStreakValue.textContent = currentStreak; if (ui.modalLongestStreakValue) ui.modalLongestStreakValue.textContent = longestStreak; currentProfile.monthly_claims = currentProfile.monthly_claims || {}; if (!currentProfile.monthly_claims[currentMonthYear]) { console.log(`[StreakCheck] Initializing claims for new month: ${currentMonthYear}`); updateData.monthly_claims = { ...currentProfile.monthly_claims, [currentMonthYear]: [] }; needsDbUpdate = true; } else { console.log(`[StreakCheck] Monthly claims for ${currentMonthYear} already exist:`, currentProfile.monthly_claims[currentMonthYear]); } if (needsDbUpdate) { console.log("[StreakCheck] Updating profile in DB with:", JSON.stringify(updateData)); try { const { error: updateError } = await supabase.from('profiles').update(updateData).eq('id', currentUser.id); if (updateError) throw updateError; const refreshedProfile = await fetchUserProfile(currentUser.id); if (refreshedProfile) { currentProfile = refreshedProfile; } else { console.warn("[StreakCheck] Could not re-fetch profile after update, local currentProfile might be partially stale for non-updated fields."); if (updateData.last_login) currentProfile.last_login = updateData.last_login; if (updateData.monthly_claims) currentProfile.monthly_claims = updateData.monthly_claims; if (updateData.streak_days !== undefined) currentProfile.streak_days = updateData.streak_days; if (updateData.longest_streak_days !== undefined) currentProfile.longest_streak_days = updateData.longest_streak_days; } const endTime = performance.now(); console.log(`[StreakCheck] Profile updated successfully in DB. Time: ${(endTime - startTime).toFixed(2)}ms`); return true; } catch (error) { console.error("[StreakCheck] Error updating profile:", error); showToast('Chyba', `Nepodařilo se aktualizovat data přihlášení: ${error.message}`, 'error'); return false; } } const endTimeUnchanged = performance.now(); console.log(`[StreakCheck] No DB update needed. Time: ${(endTimeUnchanged - startTime).toFixed(2)}ms`); return false; }
    async function updateMonthlyClaimsInDB(newClaimsData) { if (!currentUser || !supabase) { console.error("[DB Update] Pre-condition failed: No user or supabase client."); return false; } const functionStartTime = performance.now(); console.log(`[DB Update] Attempting to update monthly_claims in DB for user ${currentUser.id} with:`, JSON.parse(JSON.stringify(newClaimsData))); try { const { data: updateResult, error: dbUpdateError } = await supabase.from('profiles').update({ monthly_claims: newClaimsData, updated_at: new Date().toISOString() }).eq('id', currentUser.id).select('monthly_claims'); if (dbUpdateError) { console.error("[DB Update] Supabase UPDATE error:", dbUpdateError); throw dbUpdateError; } if (!updateResult || updateResult.length === 0) { console.warn("[DB Update] Supabase update operation returned 0 rows or no data. Monthly claims might not have been saved to DB."); currentProfile.monthly_claims = newClaimsData; } else { currentProfile.monthly_claims = updateResult[0].monthly_claims; } console.log(`[DB Update] Database update successful. Local currentProfile.monthly_claims updated:`, JSON.parse(JSON.stringify(currentProfile.monthly_claims))); const functionEndTime = performance.now(); console.log(`[DB Update] updateMonthlyClaimsInDB finished successfully. Total time: ${(functionEndTime - functionStartTime).toFixed(2)}ms`); return true; } catch (error) { console.error("[DB Update] Catch block: Error updating monthly_claims in DB or locally:", error); showToast('Chyba databáze', `Nepodařilo se uložit vyzvednutí měsíční odměny: ${error.message}`, 'error'); return false; } }
    async function updateLastMilestoneClaimedInDB(milestoneDay, rewardKey, rewardName) { if (!currentUser || !supabase) return false; console.log(`[DB Update] Attempting to record claim for milestoneDay: ${milestoneDay}, rewardKey: ${rewardKey}`); try { const { error: insertError } = await supabase.from('claimed_streak_milestones').insert({ user_id: currentUser.id, milestone_day: milestoneDay, reward_key: rewardKey, reward_name: rewardName }); if (insertError && insertError.code !== '23505') { throw insertError; } else if (insertError && insertError.code === '23505') { console.warn(`[DB Update] Milestone ${milestoneDay} (key: ${rewardKey}) already claimed. No new record inserted.`); return true; // Důležité: vrátit true i když už existuje, aby se UI aktualizovalo
            } console.log(`[DB Update] Milestone ${milestoneDay} (key: ${rewardKey}) successfully recorded or already existed.`); if (currentProfile && milestoneDay > (currentProfile.last_milestone_claimed || 0)) { const { error: profileUpdateError } = await supabase.from('profiles').update({ last_milestone_claimed: milestoneDay, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (profileUpdateError) { console.error(`[DB Update] Error updating profiles.last_milestone_claimed for ${milestoneDay}:`, profileUpdateError); } else { currentProfile.last_milestone_claimed = milestoneDay; // Aktualizujeme i lokálně
                console.log(`[DB Update] profiles.last_milestone_claimed updated to ${milestoneDay}.`); } } return true; } catch (error) { console.error(`[DB Update] General error in updateLastMilestoneClaimedInDB for ${milestoneDay} (key: ${rewardKey}):`, error); showToast('Chyba', 'Nepodařilo se uložit vyzvednutí milníkové odměny.', 'error'); return false; } }
    async function awardPoints(pointsValue, reason = "Nespecifikováno", transactionType = 'points_earned', referenceActivityId = null, suppressActivityLog = false) { if (!currentUser || !currentProfile || !supabase) { console.warn("Cannot award points: User, profile, or Supabase missing."); return; } if (pointsValue === 0) { console.log("No points to award (value is 0)."); return; } console.log(`[Points] Awarding/deducting ${pointsValue} points for: ${reason}. Type: ${transactionType}, SuppressLog: ${suppressActivityLog}`); setLoadingState('stats', true); const currentPoints = currentProfile.points || 0; const newPoints = currentPoints + pointsValue; try { const { error: profileUpdateError } = await supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (profileUpdateError) throw profileUpdateError; console.log("[Points] Points successfully updated in DB."); currentProfile.points = newPoints; currentProfile.updated_at = new Date().toISOString(); console.log("[Points] Local currentProfile.points updated:", currentProfile.points); const { error: transactionError } = await supabase.from('credit_transactions').insert({ user_id: currentUser.id, transaction_type: transactionType, amount: pointsValue, description: reason, balance_after_transaction: newPoints, reference_activity_id: referenceActivityId }); if (transactionError) { console.error("[Points] Error logging credit transaction:", transactionError); showToast('Varování', 'Kredity připsány, ale záznam transakce selhal.', 'warning'); } else { console.log(`[Points] Credit transaction logged: ${pointsValue} for ${reason}`); } if (pointsValue > 0) { showToast('Kredity Získány!', `+${pointsValue} kreditů za: ${reason}`, 'success', 2500); } else if (pointsValue < 0) { showToast('Kredity Utraceny!', `${pointsValue} kreditů za: ${reason}`, 'info', 2500); } userStatsData = await fetchUserStats(currentUser.id, currentProfile); updateStatsCards(userStatsData); if (transactionType !== 'initial_placeholder') { await fetchAndDisplayLatestCreditTransaction(currentUser.id); } if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderCreditHistory === 'function') { await DashboardLists.loadAndRenderCreditHistory(currentUser.id, 5); } if (pointsValue > 0 && !suppressActivityLog) { await logActivity( currentUser.id, 'points_earned', `Získáno ${pointsValue} kreditů`, `Důvod: ${reason}`, { points_change: pointsValue, new_total_points: newPoints, source: transactionType }, null, referenceActivityId, 'fa-coins' ); } } catch (error) { console.error(`[Points] Error awarding/deducting points:`, error); showToast('Chyba', 'Nepodařilo se upravit kredity.', 'error'); } finally { setLoadingState('stats', false); } }
    async function awardUserTitle(titleKey, titleName, reason = "Měsíční odměna") { if (!currentProfile || !currentUser || !supabase) { console.error("Cannot award title: Missing profile, user or supabase."); return false; } if (currentProfile.purchased_titles && currentProfile.purchased_titles.includes(titleKey)) { showToast("Titul již vlastněn", `Titul "${titleName}" již máte.`, "info"); return true; } const newTitles = [...(currentProfile.purchased_titles || []), titleKey]; let newSelectedTitle = currentProfile.selected_title; if (!newSelectedTitle) { newSelectedTitle = titleKey; } try { const { data: updatedData, error } = await supabase.from('profiles').update({ purchased_titles: newTitles, selected_title: newSelectedTitle, updated_at: new Date().toISOString() }).eq('id', currentUser.id).select('purchased_titles, selected_title'); if (error) throw error; if (updatedData && updatedData.length > 0) { currentProfile.purchased_titles = updatedData[0].purchased_titles; currentProfile.selected_title = updatedData[0].selected_title; } else { currentProfile.purchased_titles = newTitles; currentProfile.selected_title = newSelectedTitle; } currentProfile.updated_at = new Date().toISOString(); await logActivity(currentUser.id, 'title_awarded', `Získán titul: ${titleName}`, `Důvod: ${reason}. Klíč: ${titleKey}`); showToast("Nový titul získán!", `Gratulujeme k titulu: "${titleName}"!`, 'success'); updateSidebarProfile(currentProfile); return true; } catch (error) { console.error("Error awarding title:", error); showToast("Chyba", "Nepodařilo se udělit titul.", "error"); return false; } }
    async function logActivity(userId, type, title, description = null, details = null, link_url = null, reference_id = null, icon = null) { if (!supabase || !userId) { console.error("Cannot log activity: Supabase client or user ID is missing."); return; } console.log(`[Log Activity] Logging: User ${userId}, Type: ${type}, Title: ${title}`); try { const { error } = await supabase.from('activities').insert({ user_id: userId, type: type, title: title, description: description, details: details, link_url: link_url, reference_id: reference_id, icon: icon || activityVisuals[type]?.icon || activityVisuals.default.icon }); if (error) { console.error("Error logging activity:", error); } else { console.log("Activity logged successfully."); if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderRecentActivities === 'function' && window.location.pathname.includes('dashboard.html')) { await DashboardLists.loadAndRenderRecentActivities(userId, 5); } } } catch (err) { console.error("Exception during activity logging:", err); } }
    async function fetchNotifications(userId, limit = 5) { const startTime = performance.now(); if (!supabase || !userId) { console.error("[Notifications] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await withTimeout(supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit), DATA_FETCH_TIMEOUT, new Error('Načítání notifikací vypršelo.')); if (error) throw error; const endTime = performance.now(); console.log(`[Notifications] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}. Time: ${(endTime - startTime).toFixed(2)}ms`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; } }
    function renderNotifications(count, notifications) { const startTime = performance.now(); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.warn("[Render Notifications] Chybí UI elementy pro notifikace."); return; } console.log("[Render Notifications] Start, Počet:", count, "Oznámení:", notifications); ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class || 'default'}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; } ui.markAllReadBtn.disabled = count === 0; const endTime = performance.now(); console.log(`[Render Notifications] Hotovo. Time: ${(endTime - startTime).toFixed(2)}ms`); }
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) { console.warn("[Render Notifications Skeletons] Chybí UI elementy."); return; } let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    async function markNotificationRead(notificationId) { console.log("[FUNC] markNotificationRead: Označení ID:", notificationId); if (!currentUser || !notificationId || !supabase) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[FUNC] markNotificationRead: Úspěch pro ID:", notificationId); return true; } catch (error) { console.error("[FUNC] markNotificationRead: Chyba:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { console.log("[FUNC] markAllNotificationsRead: Start pro uživatele:", currentUser?.id); if (!currentUser || !ui.markAllReadBtn || !supabase) { console.warn("Cannot mark all read: Missing user, button, or supabase."); return; } if (isLoading.notifications) return; setLoadingState('notifications', true); try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false); if (error) throw error; console.log("[FUNC] markAllNotificationsRead: Úspěch"); const { unreadCount, notifications } = await fetchNotifications(currentUser.id, 5); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[FUNC] markAllNotificationsRead: Chyba:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }
    function updateSidebarProfile(profile) { if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { cacheDOMElements(); if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[UI Update Sidebar] Sidebar elements not found in cache."); return; } } console.log("[UI Update] Aktualizace sidebaru..."); if (profile) { const firstName = profile.first_name ?? ''; const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(profile); const avatarUrl = profile.avatar_url; ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const sidebarImg = ui.sidebarAvatar.querySelector('img'); if (sidebarImg) { sidebarImg.onerror = () => { ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; } const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot'; if (selectedTitleKey && allTitles && allTitles.length > 0) { const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) displayTitle = foundTitle.name; else console.warn(`[UI Update Sidebar] Title key "${selectedTitleKey}" not found in titles list.`); } else if (selectedTitleKey) { console.warn(`[UI Update Sidebar] Selected title key present, but titles list is empty or not loaded.`); } ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`; console.log("[UI Update] Sidebar aktualizován."); } else { console.warn("[UI Update Sidebar] Missing profile data. Setting defaults."); ui.sidebarName.textContent = "Nepřihlášen"; ui.sidebarAvatar.textContent = '?'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title'); if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítejte!`; } }
    function updateStatsCards(stats) {
        console.log("[UI Update] Aktualizace karet statistik:", stats);
        const statElements = {
            progress: ui.overallProgressValue,
            streak: ui.streakValue,
            progressFooter: ui.overallProgressFooter,
            streakFooter: ui.streakFooter
        };
        const cards = [ui.progressCard, ui.pointsCard, ui.streakCard];

        if (Object.values(statElements).some(el => !el) || !ui.totalPointsValue) {
            console.error("[UI Update Stats] Chybějící elementy statistik.");
            cards.forEach(card => card?.classList.remove('loading'));
            return;
        }
        cards.forEach(card => card?.classList.remove('loading'));

        if (!stats) {
            console.warn("[UI Update Stats] Chybí data statistik, zobrazuji placeholder.");
            if (statElements.progress) statElements.progress.textContent = '- %';
            if (ui.totalPointsValue) {
                ui.totalPointsValue.innerHTML = `- <span id="latest-credit-change" style="font-size: 0.5em; color: var(--text-medium); vertical-align: middle; margin-left: 0.5em;">--</span>`;
            }
            if (statElements.streak) statElements.streak.textContent = '-';
            if (statElements.progressFooter) statElements.progressFooter.innerHTML = `<i class="fas fa-minus"></i> Načítání...`;
            if (ui.totalPointsFooter && !isLoading.latestCreditTransaction && (!ui.totalPointsFooter.innerHTML || ui.totalPointsFooter.innerHTML.includes("Načítání"))) {
                 ui.totalPointsFooter.innerHTML = `<i class="fas fa-minus"></i> Načítání...`;
            }
            if (statElements.streakFooter) statElements.streakFooter.innerHTML = `MAX: - dní`;
            return;
        }

        statElements.progress.textContent = `${stats.progress ?? 0}%`;
        const weeklyProgress = stats.progress_weekly ?? 0;
        statElements.progressFooter.classList.remove('positive', 'negative');
        let progressFooterHTML = '';
        if (weeklyProgress > 0) {
            progressFooterHTML = `<i class="fas fa-arrow-up"></i> +${weeklyProgress}% týdně`;
            statElements.progressFooter.classList.add('positive');
        } else if (weeklyProgress < 0) {
            progressFooterHTML = `<i class="fas fa-arrow-down"></i> ${weeklyProgress}% týdně`;
            statElements.progressFooter.classList.add('negative');
        } else {
            progressFooterHTML = `<i class="fas fa-minus"></i> ±0% týdně`;
        }
        statElements.progressFooter.innerHTML = progressFooterHTML;

        const pointsValue = stats.points ?? 0;
        if (ui.totalPointsValue.firstChild && ui.totalPointsValue.firstChild.nodeType === Node.TEXT_NODE) {
            ui.totalPointsValue.firstChild.nodeValue = `${pointsValue} `;
        } else {
            const existingSpan = ui.totalPointsValue.querySelector('#latest-credit-change');
            ui.totalPointsValue.textContent = `${pointsValue} `;
            if (existingSpan) ui.totalPointsValue.appendChild(existingSpan);
        }

        const weeklyPoints = stats.points_weekly ?? 0;
        if (ui.totalPointsFooter) {
            if (weeklyPoints !== 0 && weeklyPoints != null) {
                ui.totalPointsFooter.classList.remove('positive', 'negative');
                ui.totalPointsFooter.innerHTML = weeklyPoints > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyPoints} týdně` : `<i class="fas fa-arrow-down"></i> ${weeklyPoints} týdně`;
                if (weeklyPoints > 0) ui.totalPointsFooter.classList.add('positive');
                else ui.totalPointsFooter.classList.add('negative');
            } else {
                // Pokud jsou weeklyPoints 0, patičku aktualizuje fetchAndDisplayLatestCreditTransaction.
                // Zde pouze zobrazíme "načítání", POKUD se zrovna načítá poslední transakce.
                // Pokud se nenačítá A patička ještě nebyla aktualizována (např. při prvním renderu), může zůstat prázdná nebo zobrazit placeholder.
                if (isLoading.latestCreditTransaction) {
                    ui.totalPointsFooter.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Načítání transakce...`;
                } else if (!ui.totalPointsFooter.innerHTML || !ui.totalPointsFooter.querySelector('strong')) {
                    // Pokud se nenačítá a patička ještě nemá finální obsah (poznáme podle absence <strong>),
                    // můžeme zde nechat výchozí "Žádné nedávné transakce" nebo jiný placeholder,
                    // který nastaví fetchAndDisplayLatestCreditTransaction, nebo zde můžeme nastavit "--".
                    // Prozatím necháme tak, aby fetchAndDisplayLatestCreditTransaction měl plnou kontrolu.
                    // Případně, pokud by tam byl starý "Načítání...", tak ho tam necháme, dokud nepřijde update.
                    if (ui.totalPointsFooter.innerHTML.includes("Načítání transakce...")) {
                        // Ponecháme, pokud už tam je načítání, dokud fetchAndDisplayLatestCreditTransaction neskončí.
                    } else if (!ui.totalPointsFooter.querySelector('strong')) { // Pokud tam není finální obsah
                        ui.totalPointsFooter.innerHTML = `<i class="fas fa-info-circle"></i> --`;
                    }
                }
            }
        }


        statElements.streak.textContent = stats.streak_current ?? 0;
        statElements.streakFooter.innerHTML = `MAX: ${stats.longest_streak_days ?? 0} dní`;
        if ((stats.streak_current ?? 0) > 0 && (stats.streak_current !== stats.longest_streak_days)) {
            statElements.streakFooter.innerHTML += ` <span style="color:var(--text-muted); font-size:0.9em;">(Aktuální: ${stats.streak_current ?? 0})</span>`;
        }
        console.log("[UI Update] Karty statistik aktualizovány.");
    }
    // --- END: Helper Functions ---

    // --- START: Event Listeners Setup (Moved to top) ---
    function setupEventListeners() { const startTime = performance.now(); console.log("[SETUP] setupEventListeners: Start"); if (!ui || Object.keys(ui).length === 0) { console.error("[SETUP] UI cache is empty! Cannot setup listeners."); return; } const listenersAdded = new Set(); const safeAddListener = (element, eventType, handler, key) => { if (element) { element.removeEventListener(eventType, handler); element.addEventListener(eventType, handler); listenersAdded.add(key); } else { console.warn(`[SETUP] Element not found for listener: ${key}`); } }; safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle'); safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle'); safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay'); safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn'); document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); }); safeAddListener(ui.startPracticeBtn, 'click', () => { window.location.href = '/dashboard/procvicovani/main.html'; }, 'startPracticeBtn'); safeAddListener(ui.openMonthlyModalBtn, 'click', () => showModal('monthly-reward-modal'), 'openMonthlyModalBtn'); safeAddListener(ui.openStreakModalBtn, 'click', () => showModal('streak-milestones-modal'), 'openStreakModalBtn'); safeAddListener(ui.refreshDataBtn, 'click', async () => { if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; ui.refreshDataBtn.disabled = true; await loadDashboardData(currentUser, currentProfile); if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; ui.refreshDataBtn.disabled = false; }, 'refreshDataBtn'); safeAddListener(ui.notificationBell, 'click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell'); safeAddListener(ui.markAllReadBtn, 'click', markAllNotificationsRead, 'markAllReadBtn'); safeAddListener(ui.notificationsList, 'click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount?.textContent?.replace('+', '') || '0'; const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); if(ui.notificationCount) { ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); } if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }, 'notificationsList'); document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown?.classList.remove('active'); } }); safeAddListener(ui.closeMonthlyModalBtn, 'click', () => hideModal('monthly-reward-modal'), 'closeMonthlyModalBtn'); safeAddListener(ui.monthlyRewardModal, 'click', (event) => { if (event.target === ui.monthlyRewardModal) { hideModal('monthly-reward-modal'); } }, 'monthlyRewardModal'); safeAddListener(ui.closeStreakModalBtn, 'click', () => hideModal('streak-milestones-modal'), 'closeStreakModalBtn'); safeAddListener(ui.streakMilestonesModal, 'click', (event) => { if (event.target === ui.streakMilestonesModal) { hideModal('streak-milestones-modal'); } }, 'streakMilestonesModal'); window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus); if (ui.mainContent) ui.mainContent.addEventListener('scroll', initHeaderScrollDetection, { passive: true }); const endTime = performance.now(); console.log(`[SETUP] Event listeners set up. Added: ${[...listenersAdded].length}. Time: ${(endTime - startTime).toFixed(2)}ms`); }
    // --- END: Event Listeners Setup ---

    // --- START: Rewards Logic (Moved earlier) ---
    async function handleMonthlyRewardClaim(day, rewardConfig) { console.log(`[Monthly Reward] Attempting to claim reward for day ${day}:`, rewardConfig); if (!currentUser || !currentProfile || !supabase || !rewardConfig) { showToast('Chyba', 'Nelze vyzvednout odměnu.', 'error'); return; } const currentMonthYearKey = getCurrentMonthYearString(); const claimedDaysForMonth = currentProfile.monthly_claims?.[currentMonthYearKey] || []; if (claimedDaysForMonth.includes(day)) { showToast('Již vyzvednuto', 'Tato odměna již byla vyzvednuta.', 'info'); return; } const dayCell = ui.modalMonthlyCalendarGrid.querySelector(`.calendar-day[data-day="${day}"]`); const claimButton = dayCell?.querySelector('.btn-claim-month-reward'); if(claimButton) claimButton.disabled = true; let awardedSuccessfully = false; let activityLogged = false; try { setLoadingState('monthlyRewards', true); if (rewardConfig.type === 'credits' && rewardConfig.value) { await awardPoints(rewardConfig.value, `Měsíční odměna (${day}. ${new Date(currentDisplayedYear, currentDisplayedMonth).toLocaleString('cs-CZ', { month: 'long' })}): ${rewardConfig.name}`, 'monthly_reward_credits', null, true); awardedSuccessfully = true; } else if (rewardConfig.type === 'title' && rewardConfig.key) { awardedSuccessfully = await awardUserTitle(rewardConfig.key, rewardConfig.name, `Měsíční odměna (${day}. ${new Date(currentDisplayedYear, currentDisplayedMonth).toLocaleString('cs-CZ', { month: 'long' })})`); } else if (rewardConfig.type === 'xp' && rewardConfig.value) { await awardPoints(rewardConfig.value * 10, `Měsíční odměna ZK (${day}. ${new Date(currentDisplayedYear, currentDisplayedMonth).toLocaleString('cs-CZ', { month: 'long' })}): ${rewardConfig.name}`, 'monthly_reward_xp', null, true); awardedSuccessfully = true; } else if (rewardConfig.type === 'bundle' && rewardConfig.rewards) { let allBundleRewardsAwarded = true; for (const subReward of rewardConfig.rewards) { let singleSuccess = false; const rewardReason = `${rewardConfig.name}: ${subReward.name}`; if (subReward.type === 'credits' && subReward.value) { await awardPoints(subReward.value, rewardReason, 'monthly_reward_bundle_credits', null, true); singleSuccess = true; } else if (subReward.type === 'title' && subReward.key) { singleSuccess = await awardUserTitle(subReward.key, subReward.name, rewardReason); } else if (subReward.type === 'xp' && subReward.value) { await awardPoints(subReward.value * 10, `${rewardReason} (ZK)`, 'monthly_reward_bundle_xp', null, true); singleSuccess = true; } if (!singleSuccess) { allBundleRewardsAwarded = false; break;} } awardedSuccessfully = allBundleRewardsAwarded; } if (awardedSuccessfully) { const newMonthlyClaims = { ...currentProfile.monthly_claims }; if (!newMonthlyClaims[currentMonthYearKey]) newMonthlyClaims[currentMonthYearKey] = []; newMonthlyClaims[currentMonthYearKey].push(day); const dbUpdateSuccess = await updateMonthlyClaimsInDB(newMonthlyClaims); if (dbUpdateSuccess) { await logActivity(currentUser.id, 'monthly_reward_claimed', `Vyzvednuta měsíční odměna (${day}. den)`, `${rewardConfig.name}`, { day: day, reward: rewardConfig }); activityLogged = true; showToast('Odměna Vyzvednuta!', `Úspěšně jste vyzvedli: ${rewardConfig.name}`, 'success'); } else { showToast('Chyba Ukládání', 'Odměna byla připsána, ale nepodařilo se uložit informaci o vyzvednutí.', 'warning'); } } else if (rewardConfig.type !== 'credits' && rewardConfig.type !== 'title' && rewardConfig.type !== 'xp' && rewardConfig.type !== 'bundle'){ showToast('Neznámá odměna', 'Typ odměny není podporován.', 'error'); } else { showToast('Chyba Odměny', 'Nepodařilo se připsat odměnu.', 'error'); } } catch (error) { console.error("Error claiming monthly reward:", error); showToast('Chyba Vyzvednutí', `Nastala chyba: ${error.message}`, 'error'); } finally { setLoadingState('monthlyRewards', false); if (claimButton) claimButton.disabled = false; renderMonthlyCalendar(); if (awardedSuccessfully && activityLogged) { updateSidebarProfile(currentProfile); } } }
    let currentDisplayedMonth = new Date().getMonth();
    let currentDisplayedYear = new Date().getFullYear();
    function renderMonthlyCalendar() { console.log("[Monthly Reward] Rendering calendar..."); setLoadingState('monthlyRewards', true); if (!ui.modalMonthlyCalendarGrid || !ui.modalCurrentMonthYearSpan || !currentProfile) { console.error("[Monthly Reward] Missing UI elements or profile for calendar."); if(ui.modalMonthlyCalendarGrid) ui.modalMonthlyCalendarGrid.innerHTML = '<p class="text-danger">Chyba načítání kalendáře.</p>'; setLoadingState('monthlyRewards', false); return; } ui.modalCurrentMonthYearSpan.textContent = new Date(currentDisplayedYear, currentDisplayedMonth).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' }); const daysInMonth = new Date(currentDisplayedYear, currentDisplayedMonth + 1, 0).getDate(); const firstDayOfMonth = new Date(currentDisplayedYear, currentDisplayedMonth, 1).getDay(); const dayOffset = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1; const currentMonthYearKey = `${currentDisplayedYear}-${String(currentDisplayedMonth + 1).padStart(2, '0')}`; const claimedDays = currentProfile.monthly_claims?.[currentMonthYearKey] || []; let calendarHTML = ''; for (let i = 0; i < dayOffset; i++) { calendarHTML += `<div class="calendar-day empty"></div>`; } const today = new Date(); const currentRealDay = today.getDate(); const currentRealMonth = today.getMonth(); const currentRealYear = today.getFullYear(); for (let day = 1; day <= daysInMonth; day++) { const rewardConfig = (currentDisplayedMonth === 4 && currentDisplayedYear === 2025) ? mayRewardsConfig[day] : null; const isClaimed = claimedDays.includes(day); const isClaimableDate = (currentDisplayedYear === currentRealYear && currentDisplayedMonth === currentRealMonth && day <= currentRealDay); let dayClass = 'calendar-day'; let content = `<div class="day-number">${day}</div>`; let rewardInfoHTML = ''; let buttonOrStatusHTML = ''; if (rewardConfig) { dayClass += ' has-reward'; let rewardIconClass = ''; let rewardName = rewardConfig.name; let rewardValueText = ''; if (rewardConfig.type === 'title') { rewardIconClass = rewardConfig.icon || 'fa-crown'; } else if (rewardConfig.type === 'credits') { rewardIconClass = rewardConfig.icon || 'fa-coins'; rewardValueText = `+${rewardConfig.value} Kr.`;} else if (rewardConfig.type === 'xp') { rewardIconClass = rewardConfig.icon || 'fa-star'; rewardValueText = `+${rewardConfig.value} ZK`;} else if (rewardConfig.type === 'bundle') { rewardIconClass = rewardConfig.icon || 'fa-box-open'; rewardName = rewardConfig.name; rewardValueText = rewardConfig.rewards.map(r => { let iconR = r.icon_reward || 'fa-gift'; if (r.type === 'title') return `<span class="bundle-reward-item"><i class="fas ${iconR}"></i> ${sanitizeHTML(r.name)}</span>`; if (r.type === 'credits') return `<span class="bundle-reward-item"><i class="fas ${iconR}"></i> +${r.value} Kr.</span>`; if (r.type === 'xp') return `<span class="bundle-reward-item"><i class="fas ${iconR}"></i> +${r.value} ZK</span>`; return sanitizeHTML(r.name); }).join(''); } rewardInfoHTML = `<div class="reward-icon reward-type-${rewardConfig.type}" title="${sanitizeHTML(rewardConfig.description || rewardName)}"><i class="fas ${rewardIconClass}"></i></div><div class="reward-name">${sanitizeHTML(rewardName)}</div>`; if (rewardConfig.type !== 'title' && rewardConfig.type !== 'bundle') { rewardInfoHTML += `<div class="reward-value">${sanitizeHTML(rewardValueText)}</div>`; } else if (rewardConfig.type === 'bundle') { rewardInfoHTML += `<div class="reward-bundle-details">${rewardValueText}</div>`; } if (isClaimed) { dayClass += ' claimed'; buttonOrStatusHTML = `<div class="reward-status"><i class="fas fa-check-circle"></i> Vyzvednuto</div>`; } else if (isClaimableDate) { dayClass += ' claimable'; buttonOrStatusHTML = `<button class="btn btn-sm btn-claim-month-reward" data-day="${day}"><i class="fas fa-gift"></i> Vyzvednout</button>`; } else if (day > currentRealDay && currentDisplayedMonth === currentRealMonth && currentDisplayedYear === currentRealYear) { dayClass += ' upcoming-reward'; buttonOrStatusHTML = `<div class="reward-status">Bude dostupné</div>`; } else { dayClass += ' missed'; buttonOrStatusHTML = `<div class="reward-status">Prošlo</div>`; } } else { dayClass += ' no-reward'; } if (currentDisplayedYear === currentRealYear && currentDisplayedMonth === currentRealMonth && day === currentRealDay) { dayClass += ' today'; } calendarHTML += `<div class="${dayClass}" data-day="${day}">${content}${rewardInfoHTML}${buttonOrStatusHTML}</div>`; } ui.modalMonthlyCalendarGrid.innerHTML = calendarHTML; ui.modalMonthlyCalendarGrid.style.display = 'grid'; if (ui.modalMonthlyCalendarEmpty) ui.modalMonthlyCalendarEmpty.style.display = 'none'; ui.modalMonthlyCalendarGrid.querySelectorAll('.btn-claim-month-reward').forEach(button => { button.addEventListener('click', async (event) => { const dayToClaim = parseInt(event.currentTarget.dataset.day); const rewardForDay = (currentDisplayedMonth === 4 && currentDisplayedYear === 2025) ? mayRewardsConfig[dayToClaim] : null; if (rewardForDay) { await handleMonthlyRewardClaim(dayToClaim, rewardForDay); } }); }); initTooltips(); setLoadingState('monthlyRewards', false); }
    function renderStreakMilestones() { console.log("[Streak Milestones] Rendering..."); setLoadingState('streakMilestones', true); if (!ui.modalMilestonesGrid || !ui.modalMilestonesEmpty || !currentProfile) { console.error("[Streak Milestones] Missing UI elements or profile."); if(ui.modalMilestonesGrid) ui.modalMilestonesGrid.innerHTML = '<p class="text-danger">Chyba načítání milníků.</p>'; setLoadingState('streakMilestones', false); return; } if (ui.modalCurrentStreakValue) ui.modalCurrentStreakValue.textContent = currentProfile.streak_days || 0; if (ui.modalLongestStreakValue) ui.modalLongestStreakValue.textContent = currentProfile.longest_streak_days || 0; ui.modalMilestonesGrid.innerHTML = ''; let hasAvailableMilestones = false; sortedMilestoneDays.forEach(dayCount => { const milestoneConfig = STREAK_MILESTONES_CONFIG[dayCount]; if (!milestoneConfig) return; hasAvailableMilestones = true; // Používáme currentProfile.claimed_streak_milestones, které je nyní načteno
        const isClaimed = currentProfile.claimed_streak_milestones?.some(claimed => claimed.milestone_day === dayCount && claimed.reward_key === milestoneConfig.reward_key) || false; const canClaim = currentProfile.streak_days >= dayCount && !isClaimed; let cardClass = 'milestone-card card'; if (isClaimed) cardClass += ' claimed'; else if (canClaim) cardClass += ' available'; else cardClass += ' locked'; let rewardsHTML = '<ul class="milestone-rewards-list">'; milestoneConfig.rewards.forEach(reward => { rewardsHTML += `<li><i class="fas ${reward.icon_reward || 'fa-gift'}"></i> ${sanitizeHTML(reward.name)}</li>`; }); rewardsHTML += '</ul>'; let buttonOrStatusHTML = ''; if (isClaimed) { buttonOrStatusHTML = `<div class="milestone-status claimed"><i class="fas fa-check-circle"></i> Získáno</div>`; } else if (canClaim) { buttonOrStatusHTML = `<button class="btn btn-sm btn-success claim-milestone-btn" data-milestone-day="${dayCount}" data-reward-key="${milestoneConfig.reward_key}"><i class="fas fa-gift"></i> Vyzvednout</button>`; } else { buttonOrStatusHTML = `<div class="milestone-status locked"><i class="fas fa-lock"></i> Potřebujete ${dayCount} dní série</div>`; } const milestoneCard = document.createElement('div'); milestoneCard.className = cardClass; milestoneCard.innerHTML = `<div class="milestone-header"><i class="fas ${milestoneConfig.icon || 'fa-star'} milestone-icon-indicator"></i><span class="milestone-days">Série ${dayCount} Dní</span></div><h4 class="milestone-name">${sanitizeHTML(milestoneConfig.name)}</h4><p class="milestone-desc">${sanitizeHTML(milestoneConfig.description)}</p>${rewardsHTML}<div class="milestone-actions">${buttonOrStatusHTML}</div>`; ui.modalMilestonesGrid.appendChild(milestoneCard); }); if (!hasAvailableMilestones) { ui.modalMilestonesGrid.style.display = 'none'; ui.modalMilestonesEmpty.style.display = 'block'; ui.modalMilestonesEmpty.innerHTML = `<i class="fas fa-road"></i> <p>Momentálně nejsou definovány žádné milníky.</p>`; } else { ui.modalMilestonesGrid.style.display = 'grid'; ui.modalMilestonesEmpty.style.display = 'none'; } ui.modalMilestonesGrid.querySelectorAll('.claim-milestone-btn').forEach(button => { button.addEventListener('click', async (event) => { const day = parseInt(event.currentTarget.dataset.milestoneDay); const rKey = event.currentTarget.dataset.rewardKey; await handleStreakMilestoneClaim(day, rKey); }); }); initTooltips(); setLoadingState('streakMilestones', false); }
    async function handleStreakMilestoneClaim(milestoneDay, rewardKey) { console.log(`[Streak Milestone] Attempting to claim for ${milestoneDay} days, key: ${rewardKey}`); const milestoneConfig = STREAK_MILESTONES_CONFIG[milestoneDay]; if (!currentUser || !currentProfile || !supabase || !milestoneConfig || milestoneConfig.reward_key !== rewardKey) { showToast('Chyba', 'Nelze vyzvednout milník.', 'error'); return; } // Kontrola proti lokálně uloženým vyzvednutým milníkům
        const isAlreadyClaimedLocally = currentProfile.claimed_streak_milestones?.some(claimed => claimed.milestone_day === milestoneDay && claimed.reward_key === rewardKey) || false; if (isAlreadyClaimedLocally) { showToast('Již Vyzvednuto', 'Tento milník již byl vyzvednut.', 'info'); return; } if (currentProfile.streak_days < milestoneDay) { showToast('Nedostatečná Série', `Potřebujete alespoň ${milestoneDay} dní v sérii.`, 'warning'); return; } const claimButton = ui.modalMilestonesGrid.querySelector(`.claim-milestone-btn[data-milestone-day="${milestoneDay}"][data-reward-key="${rewardKey}"]`); if (claimButton) claimButton.disabled = true; let allRewardsAwardedSuccessfully = true; try { setLoadingState('streakMilestones', true); for (const reward of milestoneConfig.rewards) { let successThisReward = false; const rewardReason = `Odměna za sérii (${milestoneDay} dní): ${reward.name}`; if (reward.type === 'credits' && reward.value) { await awardPoints(reward.value, rewardReason, 'streak_milestone_credits', null, true); successThisReward = true; } else if (reward.type === 'xp' && reward.value) { await awardPoints(reward.value * 10, `${rewardReason} (ZK)`, 'streak_milestone_xp', null, true); successThisReward = true; } else if (reward.type === 'title' && reward.key) { successThisReward = await awardUserTitle(reward.key, reward.name, rewardReason); } else if (reward.type === 'badge' && reward.key) { console.log(`[Streak Milestone] Placeholder for awarding badge: ${reward.key} - ${reward.name}`); showToast('Odměna (Odznak)', `Odznak "${reward.name}" bude brzy implementován.`, 'info'); successThisReward = true; } if (!successThisReward) { allRewardsAwardedSuccessfully = false; showToast('Chyba Odměny', `Nepodařilo se připsat část odměny: ${reward.name}`, 'error'); break; } } if (allRewardsAwardedSuccessfully) { const dbRecordSuccess = await updateLastMilestoneClaimedInDB(milestoneDay, rewardKey, milestoneConfig.name); if (dbRecordSuccess) { // Přidáme do lokálního pole, pokud ještě není (pro jistotu)
                    if (!currentProfile.claimed_streak_milestones) currentProfile.claimed_streak_milestones = []; if (!currentProfile.claimed_streak_milestones.some(m => m.milestone_day === milestoneDay && m.reward_key === rewardKey)) {
                        currentProfile.claimed_streak_milestones.push({
                            user_id: currentUser.id, // Není nutné pro lokální data, ale pro konzistenci
                            milestone_day: milestoneDay,
                            reward_key: rewardKey,
                            claimed_at: new Date().toISOString(), // Pro lokální použití
                            reward_name: milestoneConfig.name
                        });
                    } await logActivity(currentUser.id, 'streak_milestone_claimed', `Vyzvednut milník série: ${milestoneConfig.name}`, `Dosaženo ${milestoneDay} dní.`, { milestone_day: milestoneDay, reward_key: rewardKey }); showToast('Milník Vyzvednut!', `Gratulujeme k dosažení milníku: ${milestoneConfig.name}`, 'success'); } else { showToast('Chyba Ukládání', 'Odměny připsány, ale nepodařilo se uložit informaci o vyzvednutí milníku.', 'warning'); allRewardsAwardedSuccessfully = false; // Pokud se DB záznam nepovedl, bereme to jako neúspěch
                } } else { showToast('Chyba Vyzvednutí', 'Některé části odměny se nepodařilo připsat.', 'error'); } } catch (error) { console.error("Error claiming streak milestone:", error); showToast('Chyba Vyzvednutí', `Nastala chyba: ${error.message}`, 'error'); allRewardsAwardedSuccessfully = false; } finally { setLoadingState('streakMilestones', false); if (claimButton) claimButton.disabled = !allRewardsAwardedSuccessfully; // Povolit znovu, pokud se nepovedlo
            renderStreakMilestones(); updateSidebarProfile(currentProfile); if (allRewardsAwardedSuccessfully) { userStatsData = await fetchUserStats(currentUser.id, currentProfile); updateStatsCards(userStatsData); } } }
    // --- END: Rewards Logic ---

    // --- START: Load Dashboard Data ---
    async function loadDashboardData(user, profile) {
        const startTime = performance.now();
        if (!user || !profile) {
            showError("Chyba: Nelze načíst data bez profilu uživatele.", true);
            setLoadingState('all', false);
            return;
        }
        console.log("[MAIN] loadDashboardData: Start pro uživatele:", user.id);
        hideError();
        setLoadingState('stats', true);
        setLoadingState('notifications', true);
        setLoadingState('activities', true);
        setLoadingState('creditHistory', true);
        setLoadingState('latestCreditTransaction', true);

        try {
            await checkAndUpdateLoginStreak();
            updateSidebarProfile(currentProfile);
            console.log("[MAIN] loadDashboardData: Paralelní načítání...");

            const dataPromises = [
                fetchUserStats(user.id, currentProfile),
                fetchNotifications(user.id, 5)
            ];
            if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderAll === 'function') {
                dataPromises.push(DashboardLists.loadAndRenderAll(user.id, 5));
            } else {
                console.warn("DashboardLists.loadAndRenderAll not found, skipping list loads.");
                dataPromises.push(Promise.resolve({ status: 'fulfilled', value: null }));
            }
            dataPromises.push(fetchAndDisplayLatestCreditTransaction(user.id));

            const results = await Promise.allSettled(dataPromises);
            const [statsResult, notificationsResult, dashboardListsResult, latestCreditResult] = results;


            console.log("[MAIN] loadDashboardData: Основные данные получены.");

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

            if (latestCreditResult.status === 'rejected') {
                console.error("❌ Chyba při načítání poslední kreditní transakce pro patičku:", latestCreditResult.reason);
                // Chyba se již řeší v fetchAndDisplayLatestCreditTransaction
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
            if (ui.totalPointsFooter) ui.totalPointsFooter.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Info o transakci chybí`;
            if (ui.latestCreditChange) ui.latestCreditChange.style.display = 'none';
        } finally {
            setLoadingState('stats', false);
            setLoadingState('notifications', false);
            setLoadingState('activities', false);
            setLoadingState('creditHistory', false);
            setLoadingState('latestCreditTransaction', false);
            if (typeof initTooltips === 'function') initTooltips();
            console.log("[MAIN] loadDashboardData: Blok finally dokončen.");
        }
    }
    // --- END: Load Dashboard Data ---

    // --- START: App Initialization ---
    async function initializeApp() {
        const totalStartTime = performance.now();
        console.log("[INIT Dashboard] initializeApp: Start v27.0.3");
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
                 toggleSkeletonUI('welcomeBanner', true);
                 toggleSkeletonUI('stats', true);
                 toggleSkeletonUI('shortcuts', true);
                 if (ui.activityListContainerWrapper) ui.activityListContainerWrapper.classList.add('loading-section');
                 if (ui.creditHistoryContainerWrapper) ui.creditHistoryContainerWrapper.classList.add('loading-section');
            } else {
                console.warn("[INIT Dashboard] mainContentAreaPlaceholder NOT FOUND in DOM after cache. Layout might be affected.");
            }
            if (ui.welcomeBannerReal) ui.welcomeBannerReal.style.display = 'none';
            if (ui.statsCardsContainer) ui.statsCardsContainer.style.display = 'none';
            if (ui.shortcutGridReal) ui.shortcutGridReal.style.display = 'none';
            if (ui.activityListContainer) ui.activityListContainer.style.display = 'none';
            if (ui.creditHistoryListContainer) ui.creditHistoryListContainer.style.display = 'none';

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
            console.log("[INIT Dashboard] Checking auth session (async)...");

            try {
                const { data: { session }, error: sessionError } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT, new Error('Ověření sezení vypršelo.'));
                console.log(`[INIT Dashboard] getSession Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
                setLoadingState('session', false);

                if (sessionError) {
                    let friendlyMessage = `Nepodařilo se ověřit sezení: ${sessionError.message}`;
                    if (sessionError.message.toLowerCase().includes('networkerror')) {
                        friendlyMessage = 'Chyba sítě při ověřování sezení. Zkontrolujte své připojení k internetu.';
                    }
                    throw new Error(friendlyMessage);
                }

                if (session?.user) {
                    currentUser = session.user;
                    console.log(`[INIT Dashboard] User authenticated (ID: ${currentUser.id}). Loading profile and titles...`);
                    if (ui.mainContentAreaPlaceholder) ui.mainContentAreaPlaceholder.style.display = 'none';

                    // Paralelní načítání profilu, titulů a VYZVEDNUTÝCH MILNÍKŮ
                    const [profileResult, titlesResult, claimedMilestonesResult] = await Promise.allSettled([
                        fetchUserProfile(currentUser.id),
                        fetchTitles(),
                        fetchClaimedStreakMilestones(currentUser.id) // Nové volání
                    ]);
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

                    // Zpracování vyzvednutých milníků
                    if (claimedMilestonesResult.status === 'fulfilled' && currentProfile) {
                        currentProfile.claimed_streak_milestones = claimedMilestonesResult.value || [];
                        console.log(`[INIT Dashboard] Claimed streak milestones loaded: ${currentProfile.claimed_streak_milestones.length}`);
                    } else if (currentProfile) {
                        console.warn("[INIT Dashboard] Failed to load claimed streak milestones:", claimedMilestonesResult.reason);
                        currentProfile.claimed_streak_milestones = []; // Zajistíme, že pole existuje
                        showToast('Varování', 'Nepodařilo se načíst vyzvednuté milníky série.', 'warning');
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
                    
                    if (ui.mainContentAreaPlaceholder) ui.mainContentAreaPlaceholder.style.display = 'none';

                    toggleSkeletonUI('welcomeBanner', false);
                    toggleSkeletonUI('stats', false);
                    toggleSkeletonUI('shortcuts', false);

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
                    showError("Nejste přihlášeni. Přesměrovávám na přihlašovací stránku...", false, ui.mainContentAreaPlaceholder || ui.mainContent);
                    setTimeout(() => { window.location.href = '/auth/index.html'; }, 3000);
                }
            } catch (authRelatedError) {
                console.error("❌ [INIT Dashboard] Auth/Session Check or Subsequent Operation Error:", authRelatedError);
                setLoadingState('session', false);
                let userFriendlyMessage = `Chyba ověření nebo načítání dat: ${authRelatedError.message}`;
                 if (authRelatedError.message.toLowerCase().includes('ověření sezení vypršelo')) {
                    userFriendlyMessage = "Ověření sezení vypršelo. Zkuste prosím obnovit stránku, nebo zkontrolujte své internetové připojení.";
                } else if (authRelatedError.message.toLowerCase().includes('networkerror')) {
                    userFriendlyMessage = "Chyba sítě. Zkontrolujte své internetové připojení a zkuste to znovu.";
                }
                showError(userFriendlyMessage, false, ui.mainContentAreaPlaceholder || ui.mainContent);
                if (ui.mainContent) ui.mainContent.style.display = 'block';
            }

            const totalEndTime = performance.now();
            console.log(`✅ [INIT Dashboard] App initializeApp function finished. Total Time: ${(totalEndTime - totalStartTime).toFixed(2)}ms`);

        } catch (error) {
            console.error("❌ [INIT Dashboard] Kritická chyba PŘED ověřením sezení (nebo v úplně úvodní fázi):", error);
            const endTime = performance.now();
            console.log(`[INIT Dashboard] Initialization failed early. Time: ${(endTime - totalStartTime).toFixed(2)}ms`);
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