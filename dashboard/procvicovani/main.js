// dashboard/procvicovani/main.js
// This script is intended for procvicovani/main.html (Přehled Procvičování)
// VERZE (USER REQUEST): Scroll fix, Plan display fix, Tab style already handled in CSS.
// VERZE (Syntax Fix Attempt): Thorough syntax review to address "Unexpected token 'class'".
// VERZE (ReferenceError Fix): Added getLatestDiagnosticTest function definition.
// VERZE (ReferenceError Fix toggleSkeletonUI): Added toggleSkeletonUI function definition.
// VERZE (userStatsData Fix): Corrected handling of userStatsData.
// VERZE (Render Stats UI Check): Added checks for UI elements in renderStatsCards.
// VERZE (DB Column Fix fetchUserProfile): Removed overall_progress_percentage from profiles fetch.
// VERZE (DB Column Fix full_name & others): Updated fetchUserProfile select based on LATEST provided schema.
// VERZE (FIX BUGS from CONSOLE): Corrected user_stats column, added missing UI elements to cache, fixed ReferenceError for fetchUserStats, adapted renderStatsCards.
// VERZE (Fix Infinite Loading): Modified toggleSkeletonUI to correctly manage 'loading' class on main stats container.

(function() {
    'use strict';

    // ==============================================
    //          Конфигурация (Configuration)
    // ==============================================
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabaseClient = null;
    const GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // Store securely in a real app
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const PLAN_GENERATION_COOLDOWN_DAYS = 7;
    const NOTIFICATION_FETCH_LIMIT = 5;
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
    let userStatsData = null; // Will hold data from user_stats table

    // ==============================================
    //          DOM Элементы (Кэш) - Defined in cacheDOMElements
    // ==============================================
    let ui = {};

    // ==============================================
    //          Глобальное Состояние (Global State)
    // ==============================================
    let state = {
        currentUser: null,
        currentProfile: null,
        latestDiagnosticTest: null,
        currentStudyPlan: null,
        allTitles: [],
        currentMainTab: 'practice-tab',
        isLoading: {
            page: true, stats: false, topicProgress: false, currentPlan: false,
            goalModal: false, notifications: false, titles: false,
            history: false, create: false, detail: false, schedule: false, generation: false,
        },
        hasCompletedGoalSetting: false,
        hasCompletedDiagnostic: false,
        allExamTopicsAndSubtopics: [],
        planCreateAllowed: false,
        nextPlanCreateTime: null,
        planTimerInterval: null,
        lastGeneratedMarkdown: null,
        lastGeneratedActivitiesJson: null,
        lastGeneratedTopicsData: null,
        currentDisplayDate: null,
        allActivePlanActivitiesByDay: {},
        sortedActivityDates: [],
        planStartDate: null,
        planEndDate: null,
    };

    const activityVisuals = {
        test: { name: 'Test', icon: 'fa-vial', class: 'test' },
        exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' },
        practice: { name: 'Procvičování', icon: 'fa-dumbbell', class: 'practice' },
        example: { name: 'Příklad', icon: 'fa-lightbulb', class: 'example' },
        review: { name: 'Opakování', icon: 'fa-history', class: 'review' },
        theory: { name: 'Teorie', icon: 'fa-book-open', class: 'theory' },
        analysis: { name: 'Analýza', icon: 'fa-chart-pie', class: 'analysis' },
        other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' },
        default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' },
        test_diagnostic_completed: { name: 'Diagnostický Test Dokončen', icon: 'fa-microscope', class: 'diagnostic' },
        vyuka_topic_started: { name: 'Výuka Zahájena', icon: 'fa-chalkboard-teacher', class: 'lesson' },
        vyuka_topic_finished: { name: 'Výuka Dokončena', icon: 'fa-graduation-cap', class: 'lesson' },
        badge: { name: 'Odznak Získán', icon: 'fa-medal', class: 'badge' },
        diagnostic: { name: 'Diagnostika', icon: 'fa-microscope', class: 'diagnostic' },
        lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' },
        plan_generated: { name: 'Plán Aktualizován', icon: 'fa-route', class: 'plan_generated' },
        level_up: { name: 'Level UP!', icon: 'fa-angle-double-up', class: 'level_up' },
        streak_milestone_claimed: { name: 'Milník Série', icon: 'fa-meteor', class: 'streak' },
        monthly_reward_claimed: { name: 'Měsíční Odměna', icon: 'fa-gift', class: 'badge' },
        title_awarded: { name: 'Titul Získán', icon: 'fa-crown', class: 'badge' },
        profile_updated: { name: 'Profil Aktualizován', icon: 'fa-user-edit', class: 'other' },
        custom_task_completed: { name: 'Úkol Dokončen', icon: 'fa-check-square', class: 'exercise' },
        points_earned: { name: 'Kredity Získány', icon: 'fa-arrow-up', class: 'points_earned' },
        points_spent: { name: 'Kredity Utraceny', icon: 'fa-arrow-down', class: 'points_spent' },
    };
    // ==============================================
    //          Помощники (Utility Functions) - Declarations first
    // ==============================================

    function cacheDOMElements() {
        ui = {
            initialLoader: document.getElementById('initial-loader'),
            mainContent: document.getElementById('main-content'),
            mainContentWrapper: document.querySelector('.main-content-wrapper'),
            sidebar: document.getElementById('sidebar'),
            sidebarOverlay: document.getElementById('sidebar-overlay'),
            mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
            sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
            sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
            sidebarName: document.getElementById('sidebar-name'),
            sidebarAvatar: document.getElementById('sidebar-avatar'),
            sidebarUserTitle: document.getElementById('sidebar-user-title'),
            toastContainer: document.getElementById('toastContainer'), // Corrected ID
            globalError: document.getElementById('global-error'),
            dashboardTitle: document.getElementById('dashboard-title'),
            userGoalDisplay: document.getElementById('user-goal-display'),
            refreshDataBtn: document.getElementById('refresh-data-btn'),
            diagnosticPrompt: document.getElementById('diagnostic-prompt'),
            startTestBtnPrompt: document.getElementById('start-test-btn-prompt'),
            tabsWrapper: document.getElementById('tabs-wrapper'),
            contentTabs: document.querySelectorAll('#tabs-wrapper .plan-tab'),
            mainTabContentArea: document.getElementById('main-tab-content-area'),
            practiceTabContent: document.getElementById('practice-tab-content'),
            vyukaTabContent: document.getElementById('vyuka-tab-content'),

            // Stats Cards Elements for procvicovani/main.html
            statsCardsContainer: document.getElementById('stats-cards'), // Main container for stats cards
            // Level/XP Card
            progressCard: document.getElementById('progress-card'), // The card itself for Level/XP
            dashboardLevelWidget: document.getElementById('dashboard-level-widget'),
            dashboardExpProgressBar: document.getElementById('dashboard-exp-progress-bar'),
            dashboardExpCurrent: document.getElementById('dashboard-exp-current'),
            dashboardExpRequired: document.getElementById('dashboard-exp-required'),
            dashboardExpPercentage: document.getElementById('dashboard-exp-percentage'),
            // Points Card
            pointsCard: document.getElementById('points-card'),
            totalPointsValue: document.getElementById('total-points-value'),
            latestCreditChange: document.getElementById('latest-credit-change'),
            totalPointsFooter: document.getElementById('total-points-footer'),
            // Streak Card
            streakCard: document.getElementById('streak-card'),
            streakValue: document.getElementById('streak-value'),
            streakFooter: document.getElementById('streak-footer'),

            statsCardsSkeletonContainer: document.getElementById('stats-cards-skeleton-container'), // This will be null as ID does not exist in main.html
            shortcutsGrid: document.getElementById('shortcuts-grid'),
            shortcutGridReal: document.getElementById('shortcut-grid-real'), // This ID does not exist in main.html
            shortcutGridSkeletonContainer: document.getElementById('shortcut-grid-skeleton-container'), // This ID does not exist in main.html
            topicProgressSection: document.getElementById('topic-progress-section'),
            topicProgressTableBody: document.getElementById('topic-progress-body'),
            topicProgressTableLoadingOverlay: document.getElementById('topic-progress-table-loading-overlay'),
            topicProgressEmptyState: document.getElementById('topic-progress-empty-state'),
            topicProgressTable: document.getElementById('topic-progress-table'),
            goalSelectionModal: document.getElementById('goal-selection-modal'),
            goalModalSteps: document.querySelectorAll('.modal-step'),
            goalRadioLabels: document.querySelectorAll('.goal-radio-label'),
            goalModalBackBtns: document.querySelectorAll('.modal-back-btn'),
            goalModalConfirmBtns: document.querySelectorAll('.modal-confirm-btn'),
            accelerateGradeSelect: document.getElementById('accelerate_grade_profile'), // Note: HTML uses accelerate-grade
            accelerateIntensitySelect: document.getElementById('accelerate_intensity_profile'), // HTML uses accelerate-intensity
            accelerateAreasCheckboxes: document.querySelectorAll('input[name="accelerate_area"]'),
            accelerateReasonRadios: document.querySelectorAll('input[name="accelerate_reason"]'),
            accelerateProfessionGroup: document.getElementById('accelerate-profession-group'),
            accelerateProfessionTextarea: document.getElementById('accelerate-profession'),
            reviewGradeSelect: document.getElementById('review_grade_profile'), // HTML uses review-grade
            topicRatingsContainer: document.getElementById('topic-ratings-container'),
            exploreGradeSelect: document.getElementById('explore_grade'), // HTML uses explore-grade
            currentPlanSection: document.getElementById('currentPlanSection'),
            currentPlanLoader: document.getElementById('currentPlanLoader'),
            dailyPlanCarouselContainer: document.getElementById('dailyPlanCarouselContainer'),
            singleDayPlanView: document.getElementById('singleDayPlanView'),
            prevDayBtn: document.getElementById('prevDayBtn'),
            nextDayBtn: document.getElementById('nextDayBtn'),
            currentPlanEmptyState: document.getElementById('currentPlanEmptyState'),
            notificationBell: document.getElementById('notification-bell'),
            notificationCount: document.getElementById('notification-count'),
            notificationsDropdown: document.getElementById('notifications-dropdown'),
            notificationsList: document.getElementById('notifications-list'),
            noNotificationsMsg: document.getElementById('no-notifications-msg'),
            markAllReadBtn: document.getElementById('mark-all-read'),
            currentYearSidebar: document.getElementById('currentYearSidebar'),
            currentYearFooter: document.getElementById('currentYearFooter'),
            mouseFollower: document.getElementById('mouse-follower'),
            dayCardTemplate: document.getElementById('dayCardTemplate'),
            dayCardSkeleton: document.getElementById('dayCardSkeleton'),
            welcomeBannerReal: document.getElementById('welcome-banner-real'),
            welcomeBannerSkeleton: document.getElementById('welcome-banner-skeleton'),
            activityListContainerWrapper: document.getElementById('recent-activities-container-wrapper'),
            activityListContainer: document.getElementById('activity-list-container'),
            activityListSkeletonContainer: document.getElementById('activity-list-skeleton-container'),
            creditHistoryContainerWrapper: document.getElementById('credit-history-container-wrapper'),
            creditHistoryListContainer: document.getElementById('credit-history-list-container'),
            creditHistorySkeletonContainer: document.getElementById('credit-history-skeleton-container'),
        };
        if (!ui.accelerateGradeSelect) ui.accelerateGradeSelect = document.getElementById('accelerate-grade');
        if (!ui.accelerateIntensitySelect) ui.accelerateIntensitySelect = document.getElementById('accelerate-intensity');
        if (!ui.reviewGradeSelect) ui.reviewGradeSelect = document.getElementById('review-grade');
        if (!ui.exploreGradeSelect) ui.exploreGradeSelect = document.getElementById('explore-grade');
        console.log("[CACHE DOM] Caching complete.");
    }

    const formatDateForDisplay = (dateStringOrDate) => {
        if (!dateStringOrDate) return 'Neznámé datum';
        try {
            const date = (typeof dateStringOrDate === 'string') ? new Date(dateStringOrDate + 'T00:00:00') : dateStringOrDate;
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            let formatted = date.toLocaleDateString('cs-CZ', options);
            formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
            return formatted;
        } catch (e) {
            console.error("Chyba formátování data pro zobrazení:", dateStringOrDate, e);
            return 'Chybné datum';
        }
    };
    const getTodayDateString = () => {
        const today = new Date();
        return dateToYYYYMMDD(today);
    };
    const dateToYYYYMMDD = (date) => {
        if (!(date instanceof Date) || isNaN(date)) return null;
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const addDaysToDate = (dateString, days) => {
        const date = new Date(dateString + 'T00:00:00');
        date.setDate(date.getDate() + days);
        return dateToYYYYMMDD(date);
    };
    const formatDate = (dateString) => { if(!dateString) return '-'; try { const date = new Date(dateString); return date.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch(e){ return '-'}};
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } };
    const sanitizeHTML = (str) => { const t = document.createElement('div'); t.textContent = str || ''; return t.innerHTML; };
    const getInitials = (profileData, email) => {
        if (!profileData && !email) return '?';
        let i = '';
        if (profileData?.first_name) i += profileData.first_name[0];
        if (profileData?.last_name) i += profileData.last_name[0];
        if (i) return i.toUpperCase();
        if (profileData?.username) return profileData.username[0].toUpperCase();
        if (email) return email[0].toUpperCase();
        return 'P';
    };
    const openMenu = () => {
        if (ui.sidebar && ui.sidebarOverlay) {
            document.body.classList.remove('sidebar-collapsed');
            ui.sidebar.classList.add('active');
            ui.sidebarOverlay.classList.add('active');
        }
    };
    const closeMenu = () => {
        if (ui.sidebar && ui.sidebarOverlay) {
            ui.sidebar.classList.remove('active');
            ui.sidebarOverlay.classList.remove('active');
        }
    };
    const initTooltips = () => { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } };
    const showGlobalError = (message) => { if(ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i><div>${sanitizeHTML(message)}</div></div>`; ui.globalError.style.display = 'block';} };
    const hideGlobalError = () => { if(ui.globalError) ui.globalError.style.display = 'none'; };
    const formatRelativeTime = (timestamp) => { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
    const initHeaderScrollDetection = () => {
        let lastScrollY = ui.mainContentWrapper?.scrollTop || 0; // Scroll je na wrapperu
        const mainWrapperEl = ui.mainContentWrapper;
        if (!mainWrapperEl) return;
        mainWrapperEl.addEventListener('scroll', () => {
            const currentScrollY = mainWrapperEl.scrollTop;
            document.body.classList.toggle('scrolled', currentScrollY > 10);
            lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
        }, { passive: true });
        if (mainWrapperEl.scrollTop > 10) document.body.classList.add('scrolled');
    };
    const updateOnlineStatus = () => {
        const offlineBanner = document.getElementById('offline-banner');
        if (offlineBanner) {
            offlineBanner.style.display = navigator.onLine ? 'none' : 'block';
        }
        if (!navigator.onLine) {
            showToast('Offline', 'Spojení bylo ztraceno. Některé funkce nemusí být dostupné.', 'warning');
        }
    };
    function applyInitialSidebarState() {
        try {
            const stateValue = localStorage.getItem(SIDEBAR_STATE_KEY);
            const isCurrentlyCollapsed = document.body.classList.contains('sidebar-collapsed');
            const shouldBeCollapsed = stateValue === 'collapsed';
            if (shouldBeCollapsed !== isCurrentlyCollapsed) { document.body.classList.toggle('sidebar-collapsed', shouldBeCollapsed); }
            const icon = ui.sidebarToggleBtn?.querySelector('i');
            if (icon) { icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; }
            if(ui.sidebarToggleBtn) { ui.sidebarToggleBtn.title = shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; }
        } catch (e) { console.error("Chyba při aplikaci stavu postranního panelu:", e); }
    }
    function toggleSidebar() {
        try {
            const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded');
            const icon = ui.sidebarToggleBtn?.querySelector('i');
            if (icon) { icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; }
            if(ui.sidebarToggleBtn) { ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; }
        } catch (error) { console.error("[ToggleSidebar] Chyba:", error); }
    }

    // --- START: NEW/MODIFIED toggleSkeletonUI ---
    function toggleSkeletonUI(sectionKey, showSkeleton) {
        console.log(`[Skeleton Toggle - Main.js] Section: ${sectionKey}, Show Skeleton: ${showSkeleton}`);
        let skeletonContainerId, realContainerId, displayTypeIfReal = 'block';

        switch (sectionKey) {
            case 'welcomeBanner': // Assuming these IDs exist in main.html
                skeletonContainerId = 'welcome-banner-skeleton';
                realContainerId = 'welcome-banner-real';
                displayTypeIfReal = 'flex'; // Welcome banner might use flex
                break;
            case 'stats':
                // In main.html, 'stats-cards' is the real container and has skeletons inside when 'loading'.
                // There isn't a separate 'stats-cards-skeleton-container'.
                skeletonContainerId = null; // No separate skeleton container
                realContainerId = 'stats-cards';
                displayTypeIfReal = 'grid';
                break;
            case 'shortcuts': // Assuming these IDs exist in main.html
                skeletonContainerId = 'shortcut-grid-skeleton-container';
                realContainerId = 'shortcuts-grid'; // HTML has 'shortcuts-grid', not 'shortcut-grid-real'
                displayTypeIfReal = 'grid';
                break;
            case 'activities':
                if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.setActivitiesLoading === 'function') {
                    DashboardLists.setActivitiesLoading(showSkeleton);
                }
                if (ui.activityListContainerWrapper) {
                    ui.activityListContainerWrapper.classList.toggle('loading-section', showSkeleton);
                }
                return; // Handled by DashboardLists
            case 'creditHistory':
                 if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.setCreditHistoryLoading === 'function') {
                    DashboardLists.setCreditHistoryLoading(showSkeleton);
                }
                if (ui.creditHistoryContainerWrapper) {
                    ui.creditHistoryContainerWrapper.classList.toggle('loading-section', showSkeleton);
                }
                return; // Handled by DashboardLists
            default:
                console.warn(`[Skeleton Toggle - Main.js] Unknown sectionKey: ${sectionKey}`);
                return;
        }

        const skeletonContainer = skeletonContainerId ? document.getElementById(skeletonContainerId) : null;
        const realContainer = realContainerId ? document.getElementById(realContainerId) : null;

        if (skeletonContainer) {
            skeletonContainer.style.display = showSkeleton ? (skeletonContainer.classList.contains('stat-cards') || skeletonContainer.classList.contains('shortcut-grid') || skeletonContainer.classList.contains('dashboard-grid') ? 'grid' : 'block') : 'none';
        }

        if (realContainer) {
            realContainer.style.display = showSkeleton ? 'none' : displayTypeIfReal;
            if (!showSkeleton) {
                realContainer.classList.remove('loading'); // Explicitly remove loading from the main container
                // Also remove 'loading' from individual cards if this is the stats section
                if (sectionKey === 'stats') {
                    realContainer.querySelectorAll('.dashboard-card.card').forEach(card => card.classList.remove('loading'));
                }
            } else {
                realContainer.classList.add('loading'); // Add loading back if showing skeleton
                if (sectionKey === 'stats') {
                     realContainer.querySelectorAll('.dashboard-card.card').forEach(card => card.classList.add('loading'));
                }
            }
        }
    }
    // --- END: NEW/MODIFIED toggleSkeletonUI ---


    const setLoadingState = (sectionKey, isLoadingFlag) => {
        if (!ui || Object.keys(ui).length === 0) { console.error("[SetLoadingState] UI cache not ready."); return; }
        if (state.isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;

        if (sectionKey === 'all') {
            Object.keys(state.isLoading).forEach(key => {
                if (key !== 'all') setLoadingState(key, isLoadingFlag);
            });
            state.isLoading.all = isLoadingFlag;
            console.log(`[SetLoadingState - Main.js] Section: all, isLoading: ${isLoadingFlag}`);
            return;
        }

        state.isLoading[sectionKey] = isLoadingFlag;
        console.log(`[SetLoadingState - Main.js] Section: ${sectionKey}, isLoading: ${isLoadingFlag}`);

        const skeletonManagedSections = ['welcomeBanner', 'stats', 'shortcuts', 'activities', 'creditHistory'];
        if (skeletonManagedSections.includes(sectionKey)) {
            toggleSkeletonUI(sectionKey, isLoadingFlag);
        }

        if (sectionKey === 'topicProgress' && ui.topicProgressSection) {
            ui.topicProgressTableLoadingOverlay?.classList.toggle('visible-loader', isLoadingFlag);
            ui.topicProgressTable?.classList.toggle('hidden-while-loading', isLoadingFlag);
        } else if (sectionKey === 'currentPlan' && ui.currentPlanSection) {
            ui.currentPlanLoader?.classList.toggle('visible-loader', isLoadingFlag);
             if (isLoadingFlag) {
                if (ui.dayCardSkeleton && ui.singleDayPlanView) {
                    ui.singleDayPlanView.innerHTML = '';
                    const skeletonClone = ui.dayCardSkeleton.cloneNode(true);
                    skeletonClone.style.display = 'flex';
                    ui.singleDayPlanView.appendChild(skeletonClone);
                }
                if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'flex';
                if (ui.currentPlanEmptyState) ui.currentPlanEmptyState.style.display = 'none';
            }
        } else if (sectionKey === 'notifications' && ui.notificationBell) {
            ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
            if (ui.markAllReadBtn) {
                const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
            }
            if (isLoadingFlag && ui.notificationsList && typeof renderNotificationSkeletons === 'function') {
                 renderNotificationSkeletons(2);
                 if(ui.noNotificationsMsg) ui.noNotificationsMsg.style.display = 'none';
            } else if (!isLoadingFlag && ui.notificationsList && ui.noNotificationsMsg && ui.notificationsList.children.length === 0){
                 if(ui.noNotificationsMsg) ui.noNotificationsMsg.style.display = 'block';
            }
        } else if (sectionKey === 'page' && ui.initialLoader) {
            if(isLoadingFlag) {
                ui.initialLoader.style.display = 'flex';
                ui.initialLoader.classList.remove('hidden');
            } else {
                ui.initialLoader.classList.add('hidden');
                setTimeout(() => { if(ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500);
            }
        } else if (sectionKey === 'goalModal' && ui.goalSelectionModal) {
            const modalContent = ui.goalSelectionModal.querySelector('.modal-content');
            if (modalContent) modalContent.classList.toggle('loading-state', isLoadingFlag);
        }
    };
    const renderMessage = (container, type = 'info', title, message, addButtons = []) => {
        if (!container) { console.error("renderMessage: Container not found!"); return; }
        console.log(`[RenderMessage] Rendering into:`, container.id || container.className, `Type: ${type}, Title: ${title}`);
        const iconMap = { info: 'fa-info-circle', warning: 'fa-exclamation-triangle', error: 'fa-exclamation-circle' };
        let buttonsHTML = '';
        addButtons.forEach(btn => {
            buttonsHTML += `<button class="btn ${btn.class || 'btn-primary'}" id="${btn.id}" ${btn.disabled ? 'disabled' : ''}>${btn.icon ? `<i class="fas ${btn.icon}"></i> ` : ''}${sanitizeHTML(btn.text)}</button>`;
        });
        container.innerHTML = `<div class="notest-message ${type}"><h3><i class="fas ${iconMap[type]}"></i> ${sanitizeHTML(title)}</h3><p>${sanitizeHTML(message)}</p><div class="action-buttons">${buttonsHTML}</div></div>`;
        container.classList.add('content-visible');
        if (container === ui.currentPlanEmptyState) {
            if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
            container.style.display = 'flex';
        }


        addButtons.forEach(btn => {
            const btnElement = container.querySelector(`#${btn.id}`);
            if (btnElement && btn.onClick) {
                btnElement.addEventListener('click', btn.onClick);
            }
        });
    };

    // ==============================================
    //          Core Application Logic (for main.html)
    // ==============================================
    const initializeSupabase = () => { try { if (!window.supabase) throw new Error("Supabase library not loaded."); supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey); console.log("Supabase client initialized."); return true; } catch (error) { console.error("Supabase init failed:", error); showGlobalError("Kritická chyba: Nelze inicializovat databázi."); return false; } };

    async function fetchUserProfile(userId) {
        if (!userId || !supabaseClient) return null;
        setLoadingState('titles', true);
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('id, updated_at, username, first_name, last_name, email, avatar_url, bio, school, grade, level, completed_exercises, streak_days, last_login, badges_count, points, preferences, notifications, created_at, experience, purchased_titles, selected_title, last_reward_claimed_at, monthly_claims, last_milestone_claimed, purchased_decorations, selected_decoration, learning_goal, longest_streak_days, role')
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("Profile fetch error (details):", error);
                throw error;
            }
            setLoadingState('titles', false);
            return data;
        } catch (e) {
            console.error("Profile fetch error:", e);
            setLoadingState('titles', false);
            return null;
        }
    }


    async function fetchTitles() {
        if (!supabaseClient) return [];
        console.log("[Titles] Fetching available titles...");
        setLoadingState('titles', true);
        try {
            const { data, error } = await supabaseClient
                .from('title_shop')
                .select('title_key, name');
            if (error) throw error;
            console.log("[Titles] Fetched titles:", data);
            return data || [];
        } catch (error) {
            console.error("[Titles] Error fetching titles:", error);
            showToast("Chyba načítání dostupných titulů.", "error");
            return [];
        } finally {
            setLoadingState('titles', false);
        }
    }

    function updateSidebarProfile() {
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) {
            console.warn("[SidebarUI] Chybí elementy postranního panelu pro profil.");
            return;
        }
        if (state.currentProfile && state.currentUser) {
            const profile = state.currentProfile;
            const user = state.currentUser;
            let displayName = (profile.first_name || profile.last_name)
                ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                : profile.username || user.email?.split('@')[0] || 'Pilot';

            ui.sidebarName.textContent = sanitizeHTML(displayName);

            const initials = getInitials(profile, user.email);
            const avatarUrl = profile.avatar_url;
            let finalAvatarUrlToUse = null;

            if (avatarUrl) {
                if (!avatarUrl.startsWith('http') && avatarUrl.includes('/')) {
                    finalAvatarUrlToUse = sanitizeHTML(avatarUrl);
                } else {
                    finalAvatarUrlToUse = `${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`;
                }
            }
            ui.sidebarAvatar.innerHTML = finalAvatarUrlToUse ? `<img src="${finalAvatarUrlToUse}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);


            const img = ui.sidebarAvatar.querySelector('img');
            if (img) {
                img.onerror = function() {
                    console.warn(`[SidebarUI] Nepodařilo se načíst avatar: ${this.src}. Zobrazuji iniciály.`);
                    ui.sidebarAvatar.innerHTML = sanitizeHTML(initials);
                };
            }

            const selectedTitleKey = profile.selected_title;
            let displayTitle = 'Pilot';

            if (selectedTitleKey && state.allTitles && state.allTitles.length > 0) {
                const foundTitle = state.allTitles.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) {
                    displayTitle = foundTitle.name;
                } else {
                    console.warn(`[SidebarUI] Titul s klíčem "${selectedTitleKey}" nebyl nalezen v načtených titulech.`);
                }
            } else if (selectedTitleKey) {
                 console.warn(`[SidebarUI] Klíč titulu "${selectedTitleKey}" je přítomen, ale seznam všech titulů (state.allTitles) je prázdný nebo nebyl načten.`);
            }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle));

        } else {
            ui.sidebarName.textContent = "Nepřihlášen";
            ui.sidebarAvatar.textContent = '?';
            ui.sidebarUserTitle.textContent = 'Pilot';
            ui.sidebarUserTitle.removeAttribute('title');
        }
    }

    async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) { if (!supabaseClient || !userId) { console.error("[Notifications] Missing Supabase client or User ID."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Fetching unread notifications for user ${userId}`); setLoadingState('notifications', true); try { const { data, error, count } = await supabaseClient.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; console.log(`[Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } finally { setLoadingState('notifications', false); } }
    function renderNotifications(count, notifications) { console.log("[Render Notifications] Start, Count:", count, "Notifications:", notifications); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements."); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.toggle('has-content', notifications && notifications.length > 0); console.log("[Render Notifications] Finished"); }
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    async function markNotificationRead(notificationId) { console.log("[Notifications] Marking notification as read:", notificationId); if (!state.currentUser || !notificationId) return false; try { const { error } = await supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[Notifications] Mark as read successful for ID:", notificationId); return true; } catch (error) { console.error("[Notifications] Mark as read error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { console.log("[Notifications] Marking all as read for user:", state.currentUser?.id); if (!state.currentUser || !ui.markAllReadBtn) return; setLoadingState('notifications', true); try { const { error } = await supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('is_read', false); if (error) throw error; console.log("[Notifications] Mark all as read successful"); const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[Notifications] Mark all as read error:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }

    const groupActivitiesByDayAndDateArray = (activities) => {
        state.allActivePlanActivitiesByDay = {};
        state.sortedActivityDates = [];
        if (!activities || activities.length === 0) {
            state.planStartDate = null;
            state.planEndDate = null;
            return;
        }
        const dayToDateMap = {};
        const sortedActivities = [...activities].sort((a, b) => {
            if (a.day_of_week !== b.day_of_week) { return a.day_of_week - b.day_of_week; }
            return (a.time_slot || '99:99').localeCompare(b.time_slot || '99:99');
        });
        let planStartDayOfWeek = sortedActivities[0].day_of_week;
        let referenceDate = new Date();
        let currentDayOfWeekJs = referenceDate.getDay();
        if (currentDayOfWeekJs === 0) currentDayOfWeekJs = 7;

        let diffToStartDay = planStartDayOfWeek - currentDayOfWeekJs;
        referenceDate.setDate(referenceDate.getDate() + diffToStartDay);
        state.planStartDate = new Date(referenceDate);
        state.planEndDate = new Date(state.planStartDate);
        state.planEndDate.setDate(state.planStartDate.getDate() + 6);
        for (let i = 0; i < 7; i++) { const currentDate = new Date(state.planStartDate); currentDate.setDate(state.planStartDate.getDate() + i); const dayOfWeekForMap = currentDate.getDay(); dayToDateMap[dayOfWeekForMap === 0 ? 7 : dayOfWeekForMap] = dateToYYYYMMDD(currentDate); } // Map DB days (1-7)
        activities.forEach(act => { const dateString = dayToDateMap[act.day_of_week]; if (dateString) { if (!state.allActivePlanActivitiesByDay[dateString]) { state.allActivePlanActivitiesByDay[dateString] = []; } state.allActivePlanActivitiesByDay[dateString].push(act); } else { console.warn(`Activity ID ${act.id} has invalid day_of_week: ${act.day_of_week}`); }});
        state.sortedActivityDates = Object.keys(state.allActivePlanActivitiesByDay).sort();
        if (state.sortedActivityDates.length > 0) { state.planStartDate = new Date(state.sortedActivityDates[0] + 'T00:00:00'); state.planEndDate = new Date(state.sortedActivityDates[state.sortedActivityDates.length - 1] + 'T00:00:00'); }
        else { state.planStartDate = null; state.planEndDate = null; }
        console.log("[groupActivities] Grouped activities:", state.allActivePlanActivitiesByDay, "Sorted dates:", state.sortedActivityDates, "Plan effective start/end:", state.planStartDate, state.planEndDate);
    };

    async function loadCurrentPlan() {
        if (!supabaseClient || !state.currentUser) return;
        console.log("[CurrentPlan in Main.js] Loading current plan...");
        setLoadingState('currentPlan', true);
        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        if (ui.currentPlanEmptyState) ui.currentPlanEmptyState.style.display = 'none';
        try {
            const { data: plans, error } = await supabaseClient.from('study_plans').select('*').eq('user_id', state.currentUser.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1);
            if (error) throw error;
            if (plans && plans.length > 0) {
                state.currentStudyPlan = plans[0]; console.log("[CurrentPlan in Main.js] Active plan found:", state.currentStudyPlan.id);
                const { data: activities, error: actError } = await supabaseClient.from('plan_activities').select('*').eq('plan_id', state.currentStudyPlan.id).order('day_of_week').order('time_slot');
                if (actError) throw actError;
                groupActivitiesByDayAndDateArray(activities || []);
                const todayStr = getTodayDateString();
                if (state.sortedActivityDates.includes(todayStr)) { state.currentDisplayDate = todayStr; }
                else if (state.sortedActivityDates.length > 0) { let futureDate = state.sortedActivityDates.find(d => d >= todayStr); state.currentDisplayDate = futureDate || state.sortedActivityDates[state.sortedActivityDates.length -1]; if (!state.currentDisplayDate && state.planStartDate) { state.currentDisplayDate = dateToYYYYMMDD(state.planStartDate); } else if (!state.currentDisplayDate) { state.currentDisplayDate = state.sortedActivityDates[0] || todayStr; } }
                else { state.currentDisplayDate = todayStr; }
                renderSingleDayPlan(state.currentDisplayDate);
                if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'flex';
            } else {
                state.currentStudyPlan = null; state.allActivePlanActivitiesByDay = {}; state.sortedActivityDates = []; state.currentDisplayDate = null;
                console.log("[CurrentPlan in Main.js] No active plan found. Checking diagnostic...");
                if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
                const diagnostic = await getLatestDiagnosticTest(state.currentUser.id, false);
                if (diagnostic === null) { renderMessage(ui.currentPlanEmptyState, 'error', 'Chyba načítání diagnostiky', 'Nepodařilo se ověřit stav vašeho diagnostického testu.'); }
                else if (diagnostic) { renderPromptCreatePlan(ui.currentPlanEmptyState); }
                else { renderNoActivePlan(ui.currentPlanEmptyState); }
            }
        } catch (error) {
            console.error("[CurrentPlan in Main.js] Error loading current plan:", error);
            renderMessage(ui.currentPlanEmptyState, 'error', 'Chyba', 'Nepodařilo se načíst aktuální studijní plán.');
            if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        } finally { setLoadingState('currentPlan', false); console.log("[CurrentPlan in Main.js] Loading finished."); }
    }

    const renderSingleDayPlan = (targetDateString) => {
        console.log(`[RenderSingleDay in Main.js] Rendering for date: ${targetDateString}`);
        if (!ui.singleDayPlanView || !ui.dayCardTemplate) { console.error("[RenderSingleDay in Main.js] Missing UI elements."); if(ui.currentPlanEmptyState) renderMessage(ui.currentPlanEmptyState, 'error', 'Chyba zobrazení', 'Nelze zobrazit denní plán.'); if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none'; setLoadingState('currentPlan', false); return; }
        setLoadingState('currentPlan', true);
        if (ui.dayCardSkeleton && getComputedStyle(ui.dayCardSkeleton).display !== 'none') { ui.dayCardSkeleton.style.display = 'none'; }
        let dayCard = ui.singleDayPlanView.querySelector('.day-schedule-card:not(.skeleton-day-card)');
        if (!dayCard) { const templateNode = ui.dayCardTemplate.content.cloneNode(true); dayCard = templateNode.querySelector('.day-schedule-card'); if (!dayCard) { console.error("[RenderSingleDay in Main.js] Failed to clone .day-schedule-card!"); setLoadingState('currentPlan', false); return; } ui.singleDayPlanView.innerHTML = ''; ui.singleDayPlanView.appendChild(dayCard); }
        const dayHeader = dayCard.querySelector('.day-header'); const activitiesContainer = dayCard.querySelector('.activity-list-container');
        if (!dayHeader || !activitiesContainer) { console.error("[RenderSingleDay in Main.js] Day header or activity container missing!"); setLoadingState('currentPlan', false); return; }
        dayCard.style.opacity = '0';
        const activitiesForDay = state.allActivePlanActivitiesByDay[targetDateString] || [];
        activitiesForDay.sort((a, b) => (a.time_slot || '99:99').localeCompare(b.time_slot || '99:99'));
        dayCard.classList.toggle('today', targetDateString === getTodayDateString());
        dayHeader.innerHTML = `${formatDateForDisplay(targetDateString)} ${targetDateString === getTodayDateString() ? '<span>(Dnes)</span>' : ''}`;
        activitiesContainer.innerHTML = '';
        if (activitiesForDay.length > 0) {
            activitiesForDay.forEach(activity => {
                 if (!activity.id) return; const activityElement = document.createElement('div'); activityElement.className = `activity-list-item ${activity.completed ? 'completed' : ''}`; activityElement.dataset.activityId = activity.id; const timeDisplay = activity.time_slot ? `<span class="activity-time-display">${activity.time_slot}</span>` : ''; const iconClass = getActivityIcon(activity.title, activity.type); const hasDescription = activity.description && activity.description.trim().length > 0; const expandIcon = hasDescription ? `<button class="expand-icon-button btn-tooltip" aria-label="Rozbalit popis" title="Zobrazit/skrýt popis"><i class="fas fa-chevron-down expand-icon"></i></button>` : '';
                 let activityLinkStart = ''; let activityLinkEnd = '';
                 if (activity.type === 'theory' && state.currentStudyPlan?.status === 'active') { activityLinkStart = `<a href="/dashboard/procvicovani/vyuka/vyuka.html?planActivityId=${activity.id}" class="activity-link">`; activityLinkEnd = `</a>`; }
                 activityElement.innerHTML = `${activityLinkStart}<label class="activity-checkbox"><input type="checkbox" id="carousel-activity-${activity.id}" ${activity.completed ? 'checked' : ''} data-activity-id="${activity.id}" data-plan-id="${state.currentStudyPlan?.id}"></label><i class="fas ${iconClass} activity-icon"></i><div class="activity-details"><div class="activity-header"><div class="activity-title-time"><span class="activity-title">${sanitizeHTML(activity.title||'Aktivita')}</span>${timeDisplay}</div>${expandIcon}</div>${hasDescription ? `<div class="activity-desc">${sanitizeHTML(activity.description)}</div>` : ''}</div>${activityLinkEnd}`;
                 const expandButtonElem = activityElement.querySelector('.expand-icon-button'); if (expandButtonElem) { expandButtonElem.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); const descElement = activityElement.querySelector('.activity-desc'); if (descElement) {activityElement.classList.toggle('expanded');}}); }
                 const checkbox = activityElement.querySelector('input[type="checkbox"]'); if (checkbox) { checkbox.addEventListener('click', (e)=>e.stopPropagation()); checkbox.addEventListener('change', async (e) => { e.stopPropagation(); const isCompleted = e.target.checked; activityElement.classList.toggle('completed', isCompleted); await handleActivityCompletionToggle(activity.id, isCompleted, state.currentStudyPlan?.id); }); }
                 activitiesContainer.appendChild(activityElement);
            });
        } else { activitiesContainer.innerHTML = `<div class="no-activities-day"><i class="fas fa-coffee"></i> Žádné aktivity pro tento den. Užijte si volno!</div>`; }
        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'flex';
        if (ui.currentPlanEmptyState) ui.currentPlanEmptyState.style.display = 'none';
        updateNavigationButtonsState(targetDateString); initTooltips(); setLoadingState('currentPlan', false);
        requestAnimationFrame(() => { dayCard.style.transition = 'opacity 0.3s ease-in-out'; dayCard.style.opacity = '1'; });
    };

    const updateNavigationButtonsState = (currentDateString) => {
        if (!ui.prevDayBtn || !ui.nextDayBtn || !state.sortedActivityDates || state.sortedActivityDates.length === 0) { if(ui.prevDayBtn) ui.prevDayBtn.style.display = 'none'; if(ui.nextDayBtn) ui.nextDayBtn.style.display = 'none'; return; }
        const currentIndex = state.sortedActivityDates.indexOf(currentDateString);
        ui.prevDayBtn.style.display = 'inline-flex'; ui.nextDayBtn.style.display = 'inline-flex';
        ui.prevDayBtn.disabled = currentIndex <= 0; ui.nextDayBtn.disabled = currentIndex >= state.sortedActivityDates.length - 1;
    };

    const renderPromptCreatePlan = (container) => {
        const promptTemplate = document.getElementById('promptCreatePlanTemplate');
        if (!container || !promptTemplate) { console.error("Missing container or promptCreatePlanTemplate for renderPromptCreatePlan in main.js."); return; }
        console.log("[Render] Rendering Prompt Create Plan...");
        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        const node = promptTemplate.content.cloneNode(true);
        const btn = node.getElementById('createNewPlanFromPromptBtn');
        if (btn) { btn.addEventListener('click', () => { window.location.href = 'plan.html?tab=create'; }); }
        container.innerHTML = ''; container.appendChild(node); container.style.display = 'flex';
        console.log("[Render] Prompt Create Plan Rendered.");
    };
    const renderNoActivePlan = (container) => {
        const noActivePlanTemplate = document.getElementById('noActivePlanTemplate');
        if (!container || !noActivePlanTemplate) { console.error("Missing container or noActivePlanTemplate for renderNoActivePlan in main.js."); return; }
        console.log("[Render] Rendering No Active Plan...");
        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        const node = noActivePlanTemplate.content.cloneNode(true);
        const linkToCreate = node.querySelector('.link-to-create-tab');
        if(linkToCreate) { linkToCreate.addEventListener('click', (e) => { e.preventDefault(); window.location.href = 'plan.html?tab=create'; }); }
        container.innerHTML = ''; container.appendChild(node); container.style.display = 'flex';
        console.log("[Render] No Active Plan Rendered.");
    };
    const handleActivityCompletionToggle = async (activityId, isCompleted, planId) => { if (!supabaseClient || !planId) return; try { const { error } = await supabaseClient.from('plan_activities').update({ completed: isCompleted, updated_at: new Date().toISOString() }).eq('id', activityId); if (error) throw error; console.log(`[ActivityToggle] Aktivita ${activityId} stav: ${isCompleted}`); await updatePlanProgress(planId); } catch (error) { console.error(`[ActivityToggle] Chyba aktualizace aktivity ${activityId}:`, error); showToast('Nepodařilo se aktualizovat stav aktivity.', 'error'); const checkbox = document.getElementById(`carousel-activity-${activityId}`) || document.getElementById(`vertical-activity-${activityId}`); const activityElement = checkbox?.closest('.activity-list-item'); if(checkbox) checkbox.checked = !isCompleted; if(activityElement) activityElement.classList.toggle('completed', !isCompleted); } };
    const updatePlanProgress = async (planId) => { if (!planId || !supabaseClient) return; console.log(`[PlanProgress] Updating progress for plan ${planId}`); try { const { count: totalCount, error: countError } = await supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId); const { count: completedCount, error: completedError } = await supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId).eq('completed', true); if (countError || completedError) throw countError || completedError; const numTotal = totalCount ?? 0; const numCompleted = completedCount ?? 0; const progress = numTotal > 0 ? Math.round((numCompleted / numTotal) * 100) : 0; console.log(`[PlanProgress] Plan ${planId}: ${numCompleted}/${numTotal} completed (${progress}%)`); const { error: updateError } = await supabaseClient.from('study_plans').update({ progress: progress, updated_at: new Date().toISOString() }).eq('id', planId); if (updateError) throw updateError; console.log(`[PlanProgress] Plan ${planId} progress DB updated to ${progress}%`); if (state.currentStudyPlan?.id === planId) state.currentStudyPlan.progress = progress; } catch (error) { console.error(`[PlanProgress] Error updating plan progress ${planId}:`, error); } };
    const getActivityIcon = (title = "", type = "") => { const lowerTitle = title.toLowerCase(); const lowerType = type?.toLowerCase() || ''; if (activityVisuals[lowerType]) return activityVisuals[lowerType].icon; if (lowerTitle.includes('test')) return activityVisuals.test.icon; if (lowerTitle.includes('cvičení') || lowerTitle.includes('příklad') || lowerTitle.includes('úloh')) return activityVisuals.exercise.icon; if (lowerTitle.includes('procvič')) return activityVisuals.practice.icon; if (lowerTitle.includes('opakování') || lowerTitle.includes('shrnutí')) return activityVisuals.review.icon; if (lowerTitle.includes('geometrie')) return 'fa-draw-polygon'; if (lowerTitle.includes('algebra')) return 'fa-square-root-alt'; if (lowerTitle.includes('procent')) return 'fa-percentage'; if (lowerTitle.includes('analýza') || lowerTitle.includes('kontrola')) return activityVisuals.analysis.icon; if (lowerTitle.includes('lekce') || lowerTitle.includes('teorie') || lowerTitle.includes('vysvětlení')) return activityVisuals.theory.icon; return activityVisuals.default.icon; };

    async function fetchAndDisplayLatestCreditChange(userId) {
        console.log(`[CreditChange] Fetching latest credit change for user ${userId}...`);
        if (!supabaseClient || !userId) {
            console.warn("[CreditChange] Missing Supabase or userId.");
            fetchAndDisplayLatestCreditChange.latestTxData = null;
            return null;
        }
        try {
            const { data, error } = await supabaseClient
                .from('credit_transactions')
                .select('amount, description, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            fetchAndDisplayLatestCreditChange.latestTxData = data; // Store for use in renderStatsCards
            return data; // Return for direct use if needed elsewhere
        } catch (error) {
            console.error('[CreditChange] Error fetching latest credit change:', error);
            fetchAndDisplayLatestCreditChange.latestTxData = null;
            return null;
        }
    }
    fetchAndDisplayLatestCreditChange.latestTxData = null; // Initialize static property

    async function fetchUserStats(userId, profileData) {
        if (!supabaseClient || !userId || !profileData) {
            console.error("[Stats] Chybí Supabase klient, ID uživatele nebo data profilu pro fetchUserStats.");
            return {
                progress: 0, progress_weekly: 0,
                points: profileData?.points ?? 0, points_weekly: 0,
                streak_current: profileData?.streak_days ?? 0,
                longest_streak_days: profileData?.longest_streak_days ?? 0,
                completed_exercises: profileData?.completed_exercises ?? 0,
                completed_tests: 0, // Assuming this comes from user_stats or aggregation
            };
        }
        console.log(`[Stats] Načítání user_stats pro uživatele ${userId}...`);
        try {
            const { data, error } = await supabaseClient
                .from('user_stats')
                .select('progress, progress_weekly, points_weekly, streak_longest, completed_tests') // Corrected: overall_progress_percentage to progress
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.warn("[Stats] Supabase chyba při načítání user_stats:", error.message);
                return { // Fallback to profile data
                    progress: profileData.progress ?? 0, // Assuming profile might have 'progress'
                    progress_weekly: 0,
                    points: profileData.points ?? 0,
                    points_weekly: 0,
                    streak_current: profileData.streak_days ?? 0,
                    longest_streak_days: profileData.longest_streak_days ?? 0,
                    completed_exercises: profileData.completed_exercises ?? 0,
                    completed_tests: profileData.completed_tests_count ?? 0, // Use if exists, else 0
                };
            }
            const finalStats = {
                progress: data?.progress ?? profileData.progress ?? 0,
                progress_weekly: data?.progress_weekly ?? 0,
                points: profileData.points ?? 0, // Master source of points is profiles table
                points_weekly: data?.points_weekly ?? 0,
                streak_current: profileData.streak_days ?? 0, // Master source
                longest_streak_days: profileData.longest_streak_days ?? data?.streak_longest ?? 0, // Master source
                completed_exercises: profileData.completed_exercises ?? 0, // Master source
                completed_tests: data?.completed_tests ?? profileData.completed_tests_count ?? 0, // Prefer user_stats, fallback
            };
            console.log("[Stats] Statistiky úspěšně načteny/sestaveny:", finalStats);
            return finalStats;
        } catch (error) {
            console.error("[Stats] Neočekávaná chyba při načítání user_stats:", error);
            return { // Fallback on unexpected error
                progress: profileData.progress ?? 0, progress_weekly: 0,
                points: profileData.points ?? 0, points_weekly: 0,
                streak_current: profileData.streak_days ?? 0,
                longest_streak_days: profileData.longest_streak_days ?? 0,
                completed_exercises: profileData.completed_exercises ?? 0,
                completed_tests: profileData.completed_tests_count ?? 0,
            };
        }
    }

    async function loadDashboardStats() {
        if (!state.currentUser || !supabaseClient || !state.currentProfile) {
            console.warn("[LoadStats] Chybí uživatel, Supabase klient nebo profil pro načtení statistik.");
            renderStatsCards(null); // Pass null to show placeholders/error state
            return;
        }
        setLoadingState('stats', true);
        try {
            // userStatsData is now populated in initializeApp or refreshDataBtn
            // It's already based on the latest profile and user_stats data
            renderStatsCards(userStatsData); // Directly use the globally available userStatsData
        } catch (error) {
            console.error("Error in loadDashboardStats:", error);
            renderStatsCards(null); // Pass null to show placeholders/error state
        } finally {
            setLoadingState('stats', false);
        }
    }

    // Modified renderStatsCards for procvicovani/main.html
    function renderStatsCards(statsData) { // statsData here is the combined object from fetchUserStats
        console.log("[UI Update] Aktualizace karet statistik pro procvicovani/main.html:", statsData);

        const profile = state.currentProfile; // Use the globally available currentProfile

        if (!profile) {
            console.warn("[UI Update Stats] Chybí data profilu, nelze aktualizovat karty.");
            // Show placeholders or error messages if needed
            if(ui.dashboardLevelWidget) ui.dashboardLevelWidget.textContent = '-';
            if(ui.totalPointsValue) ui.totalPointsValue.innerHTML = `- <span id="latest-credit-change" style="font-size: 0.5em; color: var(--text-medium); vertical-align: middle; margin-left: 0.5em; display: none;"></span>`;
            if(ui.streakValue) ui.streakValue.textContent = '-';
            if(ui.totalPointsFooter) ui.totalPointsFooter.innerHTML = `<i class="fas fa-minus"></i> Data nedostupná`;
            if(ui.streakFooter) ui.streakFooter.innerHTML = `MAX: - dní`;

            // Remove loading from main container if it's still there
            if (ui.statsCardsContainer) ui.statsCardsContainer.classList.remove('loading');
            // Remove loading from individual cards
            [ui.progressCard, ui.pointsCard, ui.streakCard].forEach(card => card?.classList.remove('loading'));

            return;
        }

        // 1. Karta Úroveň & Zkušenosti (používá data z currentProfile)
        updateWelcomeBannerAndLevel(profile); // This function handles the Level/XP card

        // 2. Karta Kredity
        if (ui.totalPointsValue) {
            ui.totalPointsValue.textContent = `${profile.points ?? 0} `; // Main points from profile
            const latestCreditSpan = ui.latestCreditChange || document.getElementById('latest-credit-change');
            if (latestCreditSpan) {
                const latestTx = fetchAndDisplayLatestCreditChange.latestTxData; // Use globally updated data
                if (latestTx && latestTx.amount !== undefined) {
                    const amount = latestTx.amount;
                    const description = latestTx.description || 'N/A';
                    const sign = amount > 0 ? '+' : (amount < 0 ? '' : '');
                    const colorClass = amount > 0 ? 'positive' : (amount < 0 ? 'negative' : 'neutral');
                    let displayDescription = description;
                    const maxDescLengthFooter = 20;
                     if (displayDescription.length > maxDescLengthFooter) {
                        displayDescription = displayDescription.substring(0, maxDescLengthFooter - 3) + "...";
                    }
                    latestCreditSpan.innerHTML = `(<span class="${colorClass}" title="${sanitizeHTML(description)}">${sign}${amount}</span>)`;
                    latestCreditSpan.style.display = 'inline';
                } else {
                    latestCreditSpan.style.display = 'none';
                }
            }
        }
        if (ui.totalPointsFooter) {
            const weeklyPoints = statsData?.points_weekly ?? 0; // Weekly change from user_stats
            ui.totalPointsFooter.classList.remove('positive', 'negative');
            if (weeklyPoints !== 0 && weeklyPoints != null) {
                ui.totalPointsFooter.innerHTML = weeklyPoints > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyPoints} týdně` : `<i class="fas fa-arrow-down"></i> ${weeklyPoints} týdně`;
                if (weeklyPoints > 0) ui.totalPointsFooter.classList.add('positive');
                else ui.totalPointsFooter.classList.add('negative');
            } else {
                ui.totalPointsFooter.innerHTML = `<i class="fas fa-minus"></i> Žádná změna bodů`;
            }
        }

        // 3. Karta Série
        if (ui.streakValue) {
            ui.streakValue.textContent = profile.streak_days ?? 0; // Current streak from profile
        }
        if (ui.streakFooter) {
            ui.streakFooter.innerHTML = `MAX: ${profile.longest_streak_days ?? 0} dní`; // Longest streak from profile
        }

        // Remove loading class from parent cards and individual cards
        if (ui.statsCardsContainer) ui.statsCardsContainer.classList.remove('loading');
        [ui.progressCard, ui.pointsCard, ui.streakCard].forEach(card => card?.classList.remove('loading'));

        console.log("[UI Update] Karty statistik aktualizovány pro procvicovani/main.html.");
    }

    function updateWelcomeBannerAndLevel(profile) {
        console.log("[UI Update] Aktualizace uvítacího banneru a úrovně XP...");
        if (!profile) { console.warn("[UI Update Welcome] Chybí data profilu."); return; }

        if (ui.welcomeTitle) { // This ID is from dashboard.html, not procvicovani/main.html. Check if needed.
            const displayName = `${profile.first_name || ''}`.trim() || profile.username || currentUser?.email?.split('@')[0] || 'Pilote';
            ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`;
        }

        // Level/XP logic for the card in procvicovani/main.html
        const currentLevel = profile.level ?? 1;
        const currentExperience = profile.experience ?? 0;

        function getExpForLevel(level) {
            if (level <= 0) return 0;
            const BASE_XP = 100; const INCREMENT_XP = 25;
            return BASE_XP + (INCREMENT_XP * (level - 1));
        }
        function getTotalExpThreshold(targetLevel) {
            if (targetLevel <= 1) return 0; let totalExp = 0;
            for (let level = 1; level < targetLevel; level++) { totalExp += getExpForLevel(level); }
            return totalExp;
        }

        const expForCurrentLevel = getTotalExpThreshold(currentLevel);
        const expForNextLevel = getTotalExpThreshold(currentLevel + 1);
        const expNeededForSpan = expForNextLevel - expForCurrentLevel;
        const currentExpInLevelSpan = Math.max(0, currentExperience - expForCurrentLevel);
        let percentage = 0;
        if (expNeededForSpan > 0) {
            percentage = Math.min(100, Math.max(0, Math.round((currentExpInLevelSpan / expNeededForSpan) * 100)));
        } else if (currentLevel > 0 && expNeededForSpan <=0 ) {
            percentage = 100;
        }

        if (ui.dashboardLevelWidget) ui.dashboardLevelWidget.textContent = currentLevel;
        if (ui.dashboardExpProgressBar) ui.dashboardExpProgressBar.style.width = `${percentage}%`;
        if (ui.dashboardExpCurrent) ui.dashboardExpCurrent.textContent = currentExpInLevelSpan;
        if (ui.dashboardExpRequired) ui.dashboardExpRequired.textContent = expNeededForSpan > 0 ? expNeededForSpan : 'MAX';
        if (ui.dashboardExpPercentage) ui.dashboardExpPercentage.textContent = percentage;

        console.log("[UI Update] Uvítací banner a úroveň XP aktualizovány.");
    }

    async function loadTopicProgress() {
        if (!state.currentUser || !supabaseClient) return;
        setLoadingState('topicProgress', true);
        try {
            const { data, error } = await supabaseClient.rpc('get_user_topic_progress_summary', {
                p_user_id: state.currentUser.id
            });
            if (error) {
                let errorMessage = error.message;
                const errString = JSON.stringify(error);
                 if (errString.includes('structure of query does not match function result type') || (error.code && ['PGRST200', '42883', '42703'].includes(error.code))) {
                    errorMessage = 'Chyba: Funkce pro načtení pokroku v tématech (get_user_topic_progress_summary) má nesprávnou definici, neexistuje na serveru, nebo vrací nesprávné sloupce. Zkontrolujte SQL definici funkce, její návratové typy a SELECT část.';
                } else if (error.status === 404 || (error.message && error.message.includes('404')) || errString.includes('"status":404')){
                    errorMessage = 'Chyba: Požadovaná funkce (get_user_topic_progress_summary) pro načtení pokroku v tématech nebyla nalezena na serveru (404). Ověřte prosím, že je SQL funkce správně vytvořena a nasazena.';
                }
                throw new Error(errorMessage);
            }
            renderTopicProgressTable(data || []);
        } catch (error) {
            console.error("Error loading topic progress via RPC:", error);
            if(ui.topicProgressTable) ui.topicProgressTable.style.display = 'none';
            if(ui.topicProgressEmptyState) {
                ui.topicProgressEmptyState.innerHTML = `<i class="fas fa-exclamation-triangle"></i><h3>Chyba načítání</h3><p>${sanitizeHTML(error.message)}</p>`;
                ui.topicProgressEmptyState.style.display = 'flex';
            }
        } finally {
            setLoadingState('topicProgress', false);
        }
    }
    function renderTopicProgressTable(topics) {
        if (!ui.topicProgressTableBody || !ui.topicProgressTable || !ui.topicProgressEmptyState) return;
        ui.topicProgressTableBody.innerHTML = '';
        if (!topics || topics.length === 0) {
            ui.topicProgressTable.style.display = 'none';
            ui.topicProgressEmptyState.innerHTML = '<i class="fas fa-book-reader"></i><h3>Žádná data o pokroku</h3><p>Zatím nemáte zaznamenaný žádný pokrok v tématech. Začněte procvičovat!</p>';
            ui.topicProgressEmptyState.style.display = 'flex';
            return;
        }
        ui.topicProgressTable.style.display = 'table';
        ui.topicProgressEmptyState.style.display = 'none';
        topics.sort((a,b) => (new Date(b.last_studied_at || 0)) - (new Date(a.last_studied_at || 0)));
        topics.forEach(topic => {
            const row = ui.topicProgressTableBody.insertRow();
            const progress = Math.round(topic.progress_percentage || 0);
            let progressColor = 'var(--accent-primary)';
            if (progress >= 75) progressColor = 'var(--accent-lime)';
            else if (progress < 40) progressColor = 'var(--accent-pink)';
            row.innerHTML = `
                <td><i class="fas ${topic.topic_icon || 'fa-question-circle'}" style="margin-right: 0.7em; color: ${progressColor};"></i>${sanitizeHTML(topic.topic_name)}</td>
                <td>
                    <div class="progress-bar-cell">
                        <div class="progress-bar-track">
                            <div class="progress-bar-fill" style="width: ${progress}%; background: ${progressColor};"></div>
                        </div>
                        <span class="progress-bar-text" style="color: ${progressColor};">${progress}%</span>
                    </div>
                </td>
                <td>${topic.last_studied_at ? formatDate(topic.last_studied_at) : '-'}</td>
            `;
        });
    }
    function handleSort(event) {
        const th = event.currentTarget;
        const column = th.dataset.sort;
        console.log("Sorting by:", column);
        showToast("Řazení tabulky", "Funkce řazení bude brzy implementována.", "info");
    }

    async function switchTabContent(tabId) {
        console.log(`[Main Tab Switch] Attempting to switch to tab: ${tabId}`);
        state.currentMainTab = tabId;

        ui.contentTabs.forEach(tab => {
            const isCurrentTab = tab.dataset.tab === tabId;
            tab.classList.toggle('active', isCurrentTab);
            tab.setAttribute('aria-selected', isCurrentTab ? 'true' : 'false');
        });

        document.querySelectorAll('#main-tab-content-area > .tab-content, #main-tab-content-area > .section').forEach(paneOrSection => {
            paneOrSection.classList.remove('active', 'visible-section');
            paneOrSection.style.display = 'none';
        });

        let targetElement = null;
        if (tabId === 'practice-tab') {
            targetElement = ui.practiceTabContent;
        } else if (tabId === 'current') { // 'current' is for currentPlanSection
            targetElement = ui.currentPlanSection;
        } else if (tabId === 'vyuka-tab') {
            targetElement = ui.vyukaTabContent;
        } else {
            console.warn(`[Main Tab Switch] Unknown tabId: ${tabId}`);
            return;
        }

        if (targetElement) {
            const displayStyle = (targetElement.classList.contains('section') || tabId === 'current') ? 'block' : 'block';
            targetElement.style.display = displayStyle;

            if (targetElement.classList.contains('tab-content')) { // Practice / Vyuka
                targetElement.classList.add('active');
            } else if (targetElement.classList.contains('section')) { // Current Plan
                targetElement.classList.add('visible-section');
            }
            if (ui.mainTabContentArea) { // Parent container
                ui.mainTabContentArea.style.display = 'flex'; // Keep as flex
                ui.mainTabContentArea.classList.add('visible');
            }
            console.log(`[Main Tab Switch] Activated element: #${targetElement.id} with display: ${displayStyle}`);
        }

        if (tabId === 'practice-tab') {
            await loadDashboardStats();
            await loadTopicProgress();
            if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderAll === 'function' && state.currentUser) {
                 await DashboardLists.loadAndRenderAll(state.currentUser.id, 5);
            }
        } else if (tabId === 'current') {
            await loadCurrentStudyPlanData();
        } else if (tabId === 'vyuka-tab') {
            console.log("[Main Tab Switch] Výuka tab activated. Placeholder for future content loading.");
        }
    }

    async function loadCurrentStudyPlanData() {
        console.log("[Main.html CurrentPlan] Delegating to plan.js-like logic's loadCurrentPlan...");
        await loadCurrentPlan();
    }

    async function getLatestDiagnosticTest(userId, showLoaderFlag = true) {
        if (!userId || !supabaseClient) return null;
        if (showLoaderFlag) setLoadingState('page', true); // This might affect the global page loader
        try {
            const { data, error } = await supabaseClient.from('user_diagnostics').select('id, completed_at, total_score, total_questions, topic_results, analysis').eq('user_id', userId).order('completed_at', { ascending: false }).limit(1);
            if (error) throw error;
            state.latestDiagnosticTest = (data && data.length > 0) ? data[0] : false; // false if no test
            console.log("[getLatestDiagnosticTest] Fetched:", state.latestDiagnosticTest);
            return state.latestDiagnosticTest;
        } catch (error) {
            console.error("Error fetching latest diagnostic test:", error);
            state.latestDiagnosticTest = null; // null on error
            return null;
        } finally {
            if (showLoaderFlag) setLoadingState('page', false);
        }
    }

    async function checkUserInitialSetup(userId) {
        console.log("[InitialSetupCheck] Checking setup for user:", userId);
        if (!state.currentProfile) {
            console.warn("[InitialSetupCheck] Profile not loaded, cannot check setup.");
            return { completedGoalSetting: false, completedDiagnostic: false };
        }
        const completedGoalSetting = !!state.currentProfile.learning_goal;
        let completedDiagnostic = false;
        if (completedGoalSetting && state.currentProfile.learning_goal !== 'math_explore') {
            const diagnostic = await getLatestDiagnosticTest(userId, false);
            completedDiagnostic = !!(diagnostic && diagnostic.completed_at);
        } else if (completedGoalSetting && state.currentProfile.learning_goal === 'math_explore') {
            completedDiagnostic = true;
        }
        console.log(`[InitialSetupCheck] Goal set: ${completedGoalSetting}, Diagnostic done (for current goal type): ${completedDiagnostic}`);
        return { completedGoalSetting, completedDiagnostic };
    }

    function showGoalSelectionModal() {
        console.log("[GoalModal] Showing goal selection modal.");
        if (ui.goalSelectionModal) {
            ui.goalSelectionModal.style.display = 'flex';
            ui.goalModalSteps.forEach(step => step.classList.remove('active'));
            document.getElementById('goal-step-1')?.classList.add('active');
            ui.goalRadioLabels.forEach(label => {
                label.classList.remove('selected-goal');
                const radio = label.querySelector('input[type="radio"]');
                if (radio) radio.checked = false;
            });
            if (state.currentProfile && state.currentProfile.learning_goal) {
                const currentGoalRadio = document.querySelector(`input[name="learningGoal"][value="${state.currentProfile.learning_goal}"]`);
                if (currentGoalRadio) {
                    currentGoalRadio.checked = true;
                    currentGoalRadio.closest('.goal-radio-label')?.classList.add('selected-goal');
                }
            }
        }
        if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none';
        if (ui.mainTabContentArea) ui.mainTabContentArea.style.display = 'none';
        if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none';
    }

    function hideGoalSelectionModal() {
        if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none';
    }

    function handleGoalSelection(event) {
        const target = event.target.closest('.goal-radio-label');
        if (!target) return;
        const radio = target.querySelector('input[type="radio"]');
        if (!radio) return;

        ui.goalRadioLabels.forEach(label => label.classList.remove('selected-goal'));
        target.classList.add('selected-goal');

        const selectedGoal = radio.value;
        state.selectedLearningGoal = selectedGoal; 

        let nextStepId = null;
        if (selectedGoal === 'math_accelerate') nextStepId = 'goal-step-accelerate';
        else if (selectedGoal === 'math_review') nextStepId = 'goal-step-review';
        else if (selectedGoal === 'math_explore') nextStepId = 'goal-step-explore';

        if (nextStepId) {
            ui.goalModalSteps.forEach(step => step.classList.remove('active'));
            document.getElementById(nextStepId)?.classList.add('active');
            if (selectedGoal === 'math_review') loadTopicsForGradeReview(); 
        } else if (selectedGoal === 'exam_prep') {
            saveLearningGoal(selectedGoal, {}); 
        } else {
            console.warn("No next step defined for goal:", selectedGoal);
        }
    }

    async function loadTopicsForGradeReview() {
        if (!state.allExamTopicsAndSubtopics || state.allExamTopicsAndSubtopics.length === 0) {
            try {
                const { data, error } = await supabaseClient.from('exam_topics').select(`id, name, subtopics:exam_subtopics (id, name, topic_id)`).order('id');
                if (error) throw error;
                state.allExamTopicsAndSubtopics = data || [];
            } catch (e) {
                console.error("Failed to load topics for review:", e);
                if (ui.topicRatingsContainer) ui.topicRatingsContainer.innerHTML = '<p class="error-message">Nepodařilo se načíst témata.</p>';
                return;
            }
        }
        populateTopicRatings();
    }

    function populateTopicRatings() {
        if (!ui.topicRatingsContainer) return;
        ui.topicRatingsContainer.innerHTML = '';
        if (!state.allExamTopicsAndSubtopics || state.allExamTopicsAndSubtopics.length === 0) {
            ui.topicRatingsContainer.innerHTML = '<p>Žádná témata k hodnocení.</p>'; return;
        }
        state.allExamTopicsAndSubtopics.filter(topic => topic.name !== "Smíšené úlohy").forEach(topic => { 
            const item = document.createElement('div');
            item.className = 'topic-rating-item';
            item.innerHTML = `<span class="topic-name">${sanitizeHTML(topic.name)}</span><div class="rating-stars" data-topic-id="${topic.id}">${[1,2,3,4,5].map(val => `<i class="fas fa-star star" data-value="${val}" aria-label="${val} hvězdiček"></i>`).join('')}</div>`;
            item.querySelectorAll('.star').forEach(star => {
                star.addEventListener('click', function() {
                    const value = parseInt(this.dataset.value); const parentStars = this.parentElement;
                    parentStars.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('rated', i < value));
                    parentStars.dataset.currentRating = value;
                });
            });
            ui.topicRatingsContainer.appendChild(item);
        });
    }

    async function saveLearningGoal(goal, details = {}) {
        if (!state.currentUser || !supabaseClient) { showToast("Chyba: Uživatel není přihlášen.", "error"); return; }
        setLoadingState('goalModal', true);
        console.log(`[SaveGoal] Saving goal: ${goal}, Details:`, details);
        const currentGoalDetails = state.currentProfile?.preferences?.goal_details || {};
        const preferencesUpdate = {
            ...state.currentProfile.preferences,
            goal_details: { ...currentGoalDetails, ...details } 
        };

        try {
            const { error } = await supabaseClient.from('profiles').update({ learning_goal: goal, preferences: preferencesUpdate, updated_at: new Date().toISOString() }).eq('id', state.currentUser.id);
            if (error) throw error;
            if(state.currentProfile) { state.currentProfile.learning_goal = goal; state.currentProfile.preferences = preferencesUpdate; }
            state.hasCompletedGoalSetting = true;
            showToast("Cíl uložen!", `Váš studijní cíl byl nastaven na: ${getGoalDisplayName(goal)}.`, "success");
            hideGoalSelectionModal(); updateUserGoalDisplay();
            const { completedDiagnostic } = await checkUserInitialSetup(state.currentUser.id);
            state.hasCompletedDiagnostic = completedDiagnostic;
            if (!completedDiagnostic && goal !== 'math_explore') {
                showDiagnosticPrompt();
            } else {
                 if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none';
            }
            if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');}
            if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');}
            await switchTabContent('practice-tab'); 

        } catch (error) { console.error("Error saving learning goal:", error); showToast("Chyba ukládání", `Nepodařilo se uložit cíl: ${error.message}`, "error");
        } finally { setLoadingState('goalModal', false); }
    }

    function showDiagnosticPrompt() {
        if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'flex';
        if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');}
        if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');}
    }

    function getGoalDisplayName(goalKey) {
        const goalMap = { 'exam_prep': 'Příprava na přijímačky', 'math_accelerate': 'Učení napřed', 'math_review': 'Doplnění mezer', 'math_explore': 'Volné prozkoumávání', };
        return goalMap[goalKey] || goalKey || 'Neznámý cíl';
    }

    function updateUserGoalDisplay() {
        if (ui.userGoalDisplay && state.currentProfile && state.currentProfile.learning_goal) {
            ui.userGoalDisplay.innerHTML = `<i class="fas fa-bullseye"></i> Cíl: <strong>${getGoalDisplayName(state.currentProfile.learning_goal)}</strong>`;
            ui.userGoalDisplay.style.display = 'inline-flex'; 
        } else if (ui.userGoalDisplay) {
            ui.userGoalDisplay.style.display = 'none';
        }
    }
    
    function setupEventListeners() {
        console.log("[SETUP Main] Setting up event listeners for main.html...");
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        else console.warn("Main mobile menu toggle button (#main-mobile-menu-toggle) not found.");

        if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);
        else console.warn("Sidebar toggle button (#sidebar-toggle-btn) not found.");

        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);

        const mainHtmlPageTabs = document.querySelectorAll('#tabs-wrapper .plan-tab');
        if (mainHtmlPageTabs.length > 0) {
            mainHtmlPageTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    switchTabContent(tab.dataset.tab);
                });
            });
        } else { console.warn("Main HTML page tabs (#tabs-wrapper .plan-tab) not found."); }

        if (ui.prevDayBtn) ui.prevDayBtn.addEventListener('click', () => { if (state.currentDisplayDate && state.sortedActivityDates.length > 0) { const currentIndex = state.sortedActivityDates.indexOf(state.currentDisplayDate); if (currentIndex > 0) { state.currentDisplayDate = state.sortedActivityDates[currentIndex - 1]; renderSingleDayPlan(state.currentDisplayDate); } } });
        if (ui.nextDayBtn) ui.nextDayBtn.addEventListener('click', () => { if (state.currentDisplayDate && state.sortedActivityDates.length > 0) { const currentIndex = state.sortedActivityDates.indexOf(state.currentDisplayDate); if (currentIndex < state.sortedActivityDates.length - 1) { state.currentDisplayDate = state.sortedActivityDates[currentIndex + 1]; renderSingleDayPlan(state.currentDisplayDate); } } });
        if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
        if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); }
        if (ui.notificationsList) {
            ui.notificationsList.addEventListener('click', async (event) => {
                const item = event.target.closest('.notification-item');
                if (item) {
                    const notificationId = item.dataset.id;
                    const link = item.dataset.link;
                    const isRead = item.classList.contains('is-read');
                    if (!isRead && notificationId) {
                        const success = await markNotificationRead(notificationId);
                        if (success) {
                            item.classList.add('is-read');
                            item.querySelector('.unread-dot')?.remove();
                            const currentCountText = ui.notificationCount.textContent.replace('+', '');
                            const currentCount = parseInt(currentCountText) || 0;
                            const newCount = Math.max(0, currentCount - 1);
                            ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                            ui.notificationCount.classList.toggle('visible', newCount > 0);
                            if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0;
                        }
                    }
                    if (link) window.location.href = link;
                }
            });
        }
        document.addEventListener('click', (event) => {
            if (ui.notificationsDropdown?.classList.contains('active') &&
                !ui.notificationsDropdown.contains(event.target) &&
                !ui.notificationBell?.contains(event.target)) {
                ui.notificationsDropdown.classList.remove('active');
            }
        });

        if(ui.refreshDataBtn) {
            ui.refreshDataBtn.addEventListener('click', async () => {
                showToast("Obnovuji data...", "info", 2000);
                setLoadingState('all', true);

                if(state.currentUser) {
                    const profileData = await fetchUserProfile(state.currentUser.id);
                    if (profileData) {
                        state.currentProfile = profileData;
                        userStatsData = await fetchUserStats(state.currentUser.id, state.currentProfile);
                        await fetchAndDisplayLatestCreditChange(state.currentUser.id);
                        updateSidebarProfile();
                        updateUserGoalDisplay();
                    }
                }

                if (state.currentMainTab === 'practice-tab') {
                    await loadDashboardStats();
                    await loadTopicProgress();
                    if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderAll === 'function' && state.currentUser) {
                         await DashboardLists.loadAndRenderAll(state.currentUser.id, 5);
                    }
                } else if (state.currentMainTab === 'current') {
                    await loadCurrentStudyPlanData();
                }
                setLoadingState('all', false);
                showToast("Data obnovena!", "success");
            });
        }

        ui.goalRadioLabels.forEach(label => label.addEventListener('click', handleGoalSelection));
        ui.goalModalBackBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetStepId = btn.dataset.targetStep;
                ui.goalModalSteps.forEach(step => step.classList.remove('active'));
                document.getElementById(targetStepId)?.classList.add('active');
            });
        });
        ui.goalModalConfirmBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const goal = btn.dataset.goal;
                let details = { goal_set_timestamp: new Date().toISOString() };

                if (goal === 'math_accelerate') {
                    details.grade = ui.accelerateGradeSelect.value;
                    details.intensity = ui.accelerateIntensitySelect.value;
                    details.accelerate_areas = Array.from(ui.accelerateAreasCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
                    details.accelerate_reason = document.querySelector('input[name="accelerate_reason"]:checked')?.value;
                    if(details.accelerate_reason === 'professional_needs' && ui.accelerateProfessionTextarea) {
                        details.profession = ui.accelerateProfessionTextarea.value;
                    }
                } else if (goal === 'math_review') {
                    details.grade = ui.reviewGradeSelect.value;
                    details.topic_ratings = {};
                    if (ui.topicRatingsContainer) {
                        ui.topicRatingsContainer.querySelectorAll('.rating-stars').forEach(rs => {
                            const topicId = rs.dataset.topicId;
                            const rating = rs.dataset.currentRating;
                            if (topicId && rating) {
                                details.topic_ratings[topicId] = { overall: parseInt(rating) };
                            }
                        });
                    }
                } else if (goal === 'math_explore') {
                    details.grade = ui.exploreGradeSelect.value;
                }
                saveLearningGoal(goal, details);
            });
        });
        const profNeedsRadio = document.querySelector('input[name="accelerate_reason"][value="professional_needs"]');
        if(profNeedsRadio) {
             profNeedsRadio.addEventListener('change', (e) => {
                 if (ui.accelerateProfessionGroup) ui.accelerateProfessionGroup.style.display = e.target.checked ? 'block' : 'none';
             });
        }

        if (ui.startTestBtnPrompt) {
            ui.startTestBtnPrompt.addEventListener('click', () => {
                window.location.href = 'test1.html';
            });
        }
        console.log("✅ [SETUP Main] Event listeners set up for main.html.");
    }

    async function initializeApp() {
        console.log("🚀🚀🚀 [Init Main - DEBUG] procvicovani/main.js initializeApp CALLED! 🚀🚀🚀");
        console.log("🚀 [Init Main] Starting application...");
        cacheDOMElements(); // Cache DOM elements first
        setLoadingState('page', true);
        if (!initializeSupabase()) {
            setLoadingState('page', false);
            showGlobalError("Kritická chyba: Nelze inicializovat databázi.");
            if(ui.mainContent) ui.mainContent.style.display = 'flex';
            return;
        }

        applyInitialSidebarState();
        hideGlobalError();

        try {
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);

            if (!session || !session.user) {
                console.log('[Init Main] Not logged in. Redirecting...');
                window.location.href = '/auth/index.html';
                return;
            }
            state.currentUser = session.user;

            const [profileData, titlesData] = await Promise.all([
                fetchUserProfile(state.currentUser.id),
                fetchTitles()
            ]);
            state.currentProfile = profileData;
            state.allTitles = titlesData || [];

            if (!state.currentProfile) {
                console.error("[Init Main] Profile could not be loaded for user:", state.currentUser.id);
                showGlobalError("Nepodařilo se načíst váš profil. Zkuste obnovit stránku.");
                setLoadingState('page', false);
                if(ui.mainContent) ui.mainContent.style.display = 'flex';
                return;
            }

            userStatsData = await fetchUserStats(state.currentUser.id, state.currentProfile); 
            await fetchAndDisplayLatestCreditChange(state.currentUser.id);

            updateSidebarProfile(); 
            updateUserGoalDisplay();
            setupEventListeners();
            initTooltips();
            initMouseFollower();
            initHeaderScrollDetection();
            updateCopyrightYear();
            updateOnlineStatus();

            fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
                .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                .catch(err => {
                    console.error("Failed to load notifications initially:", err);
                    renderNotifications(0, []);
                });

            const { completedGoalSetting, completedDiagnostic } = await checkUserInitialSetup(state.currentUser.id);
            state.hasCompletedGoalSetting = completedGoalSetting;
            state.hasCompletedDiagnostic = completedDiagnostic;

            if (!completedGoalSetting) {
                showGoalSelectionModal();
            } else if (!completedDiagnostic && state.currentProfile?.learning_goal !== 'math_explore') {
                showDiagnosticPrompt();
                if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');}
                if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');}
                await switchTabContent("practice-tab");
            } else {
                if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none';
                if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');}
                if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');}

                const urlParams = new URLSearchParams(window.location.search);
                const initialTab = urlParams.get('tab') || 'practice-tab';
                await switchTabContent(initialTab);
            }

            if (ui.mainContent) {
                ui.mainContent.style.display = 'flex';
                requestAnimationFrame(() => {
                    if(ui.mainContent) ui.mainContent.classList.add('loaded');
                    initScrollAnimations();
                });
            }
            console.log("✅ [Init Main] Page Initialized.");

        } catch (error) {
            console.error("❌ [Init Main] Critical initialization error:", error);
            showGlobalError(`Chyba inicializace: ${error.message}`);
            if(ui.mainContent) ui.mainContent.style.display = 'flex';
        } finally {
            setLoadingState('page', false);
        }
    }

    document.addEventListener('DOMContentLoaded', initializeApp);

})();
// --- Developer Edit Log ---
// Goal: Fix infinite loading for "Celkový Přehled" on dashboard/procvicovani/main.html.
// Stage:
// 1. Modified `toggleSkeletonUI` in `dashboard/procvicovani/main.js`:
//    - When `showSkeleton` is `false`:
//        - Added `realContainer.classList.remove('loading');` to remove the 'loading' class from the main stats container (`id="stats-cards"`).
//        - Added a loop `realContainer.querySelectorAll('.dashboard-card.card').forEach(card => card.classList.remove('loading'));` to ensure individual cards also have their 'loading' class removed. This complements the removal in `renderStatsCards`.
//    - When `showSkeleton` is `true`:
//        - Added `realContainer.classList.add('loading');` to ensure the main container has the 'loading' class if skeletons need to be re-shown.
//        - Added a loop `realContainer.querySelectorAll('.dashboard-card.card').forEach(card => card.classList.add('loading'));` for individual cards.
// 2. Verified `cacheDOMElements` correctly identifies `ui.statsCardsContainer` and that `ui.statsCardsSkeletonContainer` is correctly `null` as per `main.html` structure.
// 3. Confirmed that `renderStatsCards` in `main.js` already handles removing `.loading` from individual cards, so the addition in `toggleSkeletonUI` for individual cards is a safeguard/reinforcement.
// ---
// Список функций в dashboard/procvicovani/main.js:
// cacheDOMElements, formatDateForDisplay, getTodayDateString, dateToYYYYMMDD, addDaysToDate, formatDate, showToast,
// sanitizeHTML, getInitials, openMenu, closeMenu, initTooltips, showGlobalError, hideGlobalError,
// formatRelativeTime, updateCopyrightYear, initMouseFollower, initScrollAnimations, initHeaderScrollDetection,
// updateOnlineStatus, applyInitialSidebarState, toggleSidebar, toggleSkeletonUI, setLoadingState, renderMessage,
// initializeSupabase, fetchUserProfile, fetchTitles, updateSidebarProfile, fetchNotifications,
// renderNotifications, renderNotificationSkeletons, markNotificationRead, markAllNotificationsRead,
// groupActivitiesByDayAndDateArray, loadCurrentPlan, renderSingleDayPlan, updateNavigationButtonsState,
// renderPromptCreatePlan, renderNoActivePlan, handleActivityCompletionToggle, updatePlanProgress,
// getActivityIcon, fetchAndDisplayLatestCreditChange, fetchUserStats, loadDashboardStats, renderStatsCards,
// updateWelcomeBannerAndLevel, loadTopicProgress, renderTopicProgressTable, handleSort, switchTabContent,
// loadCurrentStudyPlanData, setupEventListeners, initializeApp, getLatestDiagnosticTest, checkUserInitialSetup,
// showGoalSelectionModal, hideGoalSelectionModal, handleGoalSelection, loadTopicsForGradeReview,
// populateTopicRatings, saveLearningGoal, showDiagnosticPrompt, getGoalDisplayName, updateUserGoalDisplay.