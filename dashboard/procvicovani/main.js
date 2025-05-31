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
// VERZE (Fix Infinite Loading - Refined v2): Ensured robust handling of 'loading' class and display style for stats cards.
// VERZE (Fix Infinite Loading Celkový Přehled v4 - Syntax Error Fix + Robust Skeleton Handling)
// VERZE (Integrace Plánu - Krok 3): Přidána logika z plan.js
// VERZE (Oprava chyby deklarace getLatestDiagnosticTest): Přejmenována duplicitní funkce.

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
        latestDiagnosticTest: null, // Pro logiku main.js (obecná nástěnka)
        currentStudyPlan: null,     // Pro logiku plánu
        allTitles: [],
        currentMainTab: 'practice-tab', // Výchozí záložka
        isLoading: {
            page: true, stats: false, topicProgress: false,
            goalModal: false, notifications: false, titles: false,
            // Stavy pro Plán
            currentPlan: false, 
            historyPlan: false, 
            createPlan: false,  
            planDetail: false,  
            planGeneration: false, 
        },
        hasCompletedGoalSetting: false,
        hasCompletedDiagnostic: false,
        allExamTopicsAndSubtopics: [],
        // Stavy specifické pro Plán (přesunuto z plan.js)
        latestDiagnosticDataForPlan: null, // Specificky pro kontext tvorby plánu
        previousPlans: [],
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

    const activityVisuals = { // Společné pro main.js a plan.js
        test: { name: 'Test', icon: 'fa-vial', class: 'test' },
        exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' },
        practice: { name: 'Procvičování', icon: 'fa-dumbbell', class: 'practice' },
        example: { name: 'Příklad', icon: 'fa-lightbulb', class: 'example' },
        review: { name: 'Opakování', icon: 'fa-history', class: 'review' },
        theory: { name: 'Teorie', icon: 'fa-book-open', class: 'theory' },
        analysis: { name: 'Analýza', icon: 'fa-chart-pie', class: 'analysis' },
        badge: { name: 'Odznak Získán', icon: 'fa-medal', class: 'badge' },
        diagnostic: { name: 'Diagnostika', icon: 'fa-microscope', class: 'diagnostic' },
        lesson: { name: 'Nová Data/Lekce', icon: 'fa-book-open', class: 'lesson' },
        plan_generated: { name: 'Plán Aktualizován', icon: 'fa-route', class: 'plan_generated' },
        level_up: { name: 'Level UP!', icon: 'fa-angle-double-up', class: 'level_up' },
        streak_milestone_claimed: { name: 'Milník Série', icon: 'fa-meteor', class: 'streak' },
        monthly_reward_claimed: { name: 'Měsíční Odměna', icon: 'fa-gift', class: 'badge' },
        title_awarded: { name: 'Titul Získán', icon: 'fa-crown', class: 'badge' },
        profile_updated: { name: 'Profil Aktualizován', icon: 'fa-user-edit', class: 'other' },
        custom_task_completed: { name: 'Úkol Dokončen', icon: 'fa-check-square', class: 'exercise' },
        points_earned: { name: 'Kredity Získány', icon: 'fa-arrow-up', class: 'points_earned' },
        points_spent: { name: 'Kredity Utraceny', icon: 'fa-arrow-down', class: 'points_spent' },
        vyuka_topic_started: { name: 'Výuka Zahájena', icon: 'fa-chalkboard-teacher', class: 'lesson' },
        vyuka_topic_finished: { name: 'Výuka Dokončena', icon: 'fa-graduation-cap', class: 'lesson' },
        other: { name: 'Systémová Zpráva', icon: 'fa-info-circle', class: 'other' },
        default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
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
            toastContainer: document.getElementById('toastContainer'), 
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
            statsCardsContainer: document.getElementById('stats-cards'),
            progressCard: document.getElementById('progress-card'),
            dashboardLevelWidget: document.getElementById('dashboard-level-widget'),
            dashboardExpProgressBar: document.getElementById('dashboard-exp-progress-bar'),
            dashboardExpCurrent: document.getElementById('dashboard-exp-current'),
            dashboardExpRequired: document.getElementById('dashboard-exp-required'),
            dashboardExpPercentage: document.getElementById('dashboard-exp-percentage'),
            pointsCard: document.getElementById('points-card'),
            totalPointsValue: document.getElementById('total-points-value'),
            latestCreditChange: document.getElementById('latest-credit-change'),
            totalPointsFooter: document.getElementById('total-points-footer'),
            streakCard: document.getElementById('streak-card'),
            streakValue: document.getElementById('streak-value'),
            streakFooter: document.getElementById('streak-footer'),
            statsCardsSkeletonContainer: document.getElementById('stats-cards-skeleton-container'),
            shortcutsGrid: document.getElementById('shortcuts-grid'),
            shortcutGridReal: document.getElementById('shortcut-grid-real'),
            shortcutGridSkeletonContainer: document.getElementById('shortcut-grid-skeleton-container'),
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
            accelerateGradeSelect: document.getElementById('accelerate-grade'), 
            accelerateIntensitySelect: document.getElementById('accelerate-intensity'), 
            accelerateAreasCheckboxes: document.querySelectorAll('input[name="accelerate_area"]'),
            accelerateReasonRadios: document.querySelectorAll('input[name="accelerate_reason"]'),
            accelerateProfessionGroup: document.getElementById('accelerate-profession-group'),
            accelerateProfessionTextarea: document.getElementById('accelerate-profession'),
            reviewGradeSelect: document.getElementById('review-grade'), 
            topicRatingsContainer: document.getElementById('topic-ratings-container'),
            exploreGradeSelect: document.getElementById('explore-grade'), 

            planTabContent: document.getElementById('plan-tab-content'), 
            currentPlanSection: document.getElementById('currentPlanSection'),
            currentPlanLoader: document.getElementById('currentPlanLoader'),
            dailyPlanCarouselContainer: document.getElementById('dailyPlanCarouselContainer'),
            singleDayPlanView: document.getElementById('singleDayPlanView'),
            prevDayBtn: document.getElementById('prevDayBtn'),
            nextDayBtn: document.getElementById('nextDayBtn'),
            currentPlanEmptyState: document.getElementById('currentPlanEmptyState'),
            historyPlanSection: document.getElementById('historyPlanSection'),
            historyLoader: document.getElementById('historyLoader'),
            historyPlanContent: document.getElementById('historyPlanContent'),
            createPlanSection: document.getElementById('createPlanSection'),
            createPlanLoader: document.getElementById('createPlanLoader'),
            createPlanContent: document.getElementById('createPlanContent'),
            planSection: document.getElementById('planSection'), 
            planLoading: document.getElementById('planLoading'), 
            planSectionTitle: document.getElementById('plan-section-title'),
            planContent: document.getElementById('planContent'), 
            planActions: document.getElementById('planActions'), 
            genericBackBtn: document.getElementById('genericBackBtn'), 

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
            lockedPlanTemplate: document.getElementById('lockedPlanTemplate'), 
            createPlanFormTemplate: document.getElementById('createPlanFormTemplate'), 
            noDiagnosticTemplate: document.getElementById('noDiagnosticTemplate'), 
            historyItemTemplate: document.getElementById('historyItemTemplate'), 
            promptCreatePlanTemplate: document.getElementById('promptCreatePlanTemplate'), 
            noActivePlanTemplate: document.getElementById('noActivePlanTemplate'), 
            welcomeBannerReal: document.getElementById('welcome-banner-real'),
            welcomeBannerSkeleton: document.getElementById('welcome-banner-skeleton'),
            activityListContainerWrapper: document.getElementById('recent-activities-container-wrapper'),
            activityListContainer: document.getElementById('activity-list-container'),
            activityListSkeletonContainer: document.getElementById('activity-list-skeleton-container'),
            creditHistoryContainerWrapper: document.getElementById('credit-history-container-wrapper'),
            creditHistoryListContainer: document.getElementById('credit-history-list-container'),
            creditHistorySkeletonContainer: document.getElementById('credit-history-skeleton-container'),
        };
        if (!ui.accelerateGradeSelect) ui.accelerateGradeSelect = document.getElementById('accelerate_grade_profile');
        if (!ui.accelerateIntensitySelect) ui.accelerateIntensitySelect = document.getElementById('accelerate_intensity_profile');
        if (!ui.reviewGradeSelect) ui.reviewGradeSelect = document.getElementById('review_grade_profile');
        if (!ui.exploreGradeSelect) ui.exploreGradeSelect = document.getElementById('explore_grade');
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
    const initTooltips = () => { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip.tooltipstered').each(function() { try {window.jQuery(this).tooltipster('destroy');} catch(e){/*ignore*/} }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } };
    const showGlobalError = (message) => { if(ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i><div>${sanitizeHTML(message)}</div></div>`; ui.globalError.style.display = 'block';} };
    const hideGlobalError = () => { if(ui.globalError) ui.globalError.style.display = 'none'; };
    const formatRelativeTime = (timestamp) => { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
    const initHeaderScrollDetection = () => {
        let lastScrollY = ui.mainContentWrapper?.scrollTop || 0;
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

    function setCardContentVisibility(cardElement, showRealContent) {
        if (!cardElement) return;
        const skeletonEl = cardElement.querySelector('.loading-skeleton');
        const realContentElements = Array.from(cardElement.children).filter(child => !child.classList.contains('loading-skeleton'));
        if (skeletonEl) {
            skeletonEl.style.display = showRealContent ? 'none' : 'flex';
        }
        realContentElements.forEach(contentEl => {
            if (showRealContent) {
                contentEl.style.visibility = 'visible';
                contentEl.style.display = '';
            } else {
                contentEl.style.visibility = 'hidden';
            }
        });
    }

    function toggleSkeletonUI(sectionKey, showSkeleton) {
        console.log(`[Skeleton Toggle - Main.js Refined v4] Section: ${sectionKey}, Show Skeleton: ${showSkeleton}`);
        let skeletonContainer, realContainer, displayTypeIfReal = 'block';
        let individualCards = [];

        switch (sectionKey) {
            case 'welcomeBanner':
                skeletonContainer = ui.welcomeBannerSkeleton;
                realContainer = ui.welcomeBannerReal;
                displayTypeIfReal = 'flex';
                break;
            case 'stats':
                skeletonContainer = null; 
                realContainer = ui.statsCardsContainer; 
                individualCards = [ui.progressCard, ui.pointsCard, ui.streakCard].filter(Boolean);
                displayTypeIfReal = 'grid';
                break;
            case 'shortcuts':
                skeletonContainer = ui.shortcutGridSkeletonContainer;
                realContainer = ui.shortcutGridReal;
                displayTypeIfReal = 'grid';
                break;
            case 'activities':
                if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.setActivitiesLoading === 'function') {
                    DashboardLists.setActivitiesLoading(showSkeleton);
                }
                if (ui.activityListContainerWrapper) {
                    ui.activityListContainerWrapper.classList.toggle('loading-section', showSkeleton);
                }
                return;
            case 'creditHistory':
                 if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.setCreditHistoryLoading === 'function') {
                    DashboardLists.setCreditHistoryLoading(showSkeleton);
                }
                if (ui.creditHistoryContainerWrapper) {
                    ui.creditHistoryContainerWrapper.classList.toggle('loading-section', showSkeleton);
                }
                return;
            case 'currentPlan':
            case 'historyPlan':
            case 'createPlan':
            case 'planDetail':
            case 'planGeneration':
                const planLoaderMap = { currentPlan: ui.currentPlanLoader, historyPlan: ui.historyLoader, createPlan: ui.createPlanLoader, planDetail: ui.planLoading, planGeneration: ui.planLoading };
                const planContentMap = { currentPlan: ui.dailyPlanCarouselContainer, historyPlan: ui.historyPlanContent, createPlan: ui.createPlanContent, planDetail: ui.planContent };
                const planEmptyMap = { currentPlan: ui.currentPlanEmptyState };
                const planSectionMap = { currentPlan: ui.currentPlanSection, historyPlan: ui.historyPlanSection, createPlan: ui.createPlanSection, planDetail: ui.planSection };

                const loader = planLoaderMap[sectionKey];
                const content = planContentMap[sectionKey];
                const emptyState = planEmptyMap[sectionKey];
                const section = planSectionMap[sectionKey];

                if (loader) loader.classList.toggle('visible-loader', showSkeleton);
                if (section) section.classList.toggle('loading', showSkeleton);

                if (showSkeleton) {
                    if (content) content.classList.remove('content-visible', 'schedule-visible', 'generated-reveal');
                    if (emptyState) emptyState.style.display = 'none';
                    if (sectionKey === 'historyPlan' && ui.historyPlanContent && typeof renderHistorySkeletons === 'function') renderHistorySkeletons(3);
                    if (sectionKey === 'currentPlan' && ui.singleDayPlanView) {
                        if (ui.dayCardSkeleton) {
                            ui.singleDayPlanView.innerHTML = '';
                            const skeletonClone = ui.dayCardSkeleton.cloneNode(true);
                            skeletonClone.style.display = 'flex';
                            ui.singleDayPlanView.appendChild(skeletonClone);
                        }
                        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'flex';
                    }
                    if (sectionKey === 'planGeneration' && ui.planActions) ui.planActions.style.display = 'none';
                } else {
                    if (sectionKey === 'planDetail' && ui.planActions) ui.planActions.style.display = 'flex';
                }
                return; 

            default:
                console.warn(`[Skeleton Toggle - Main.js] Unknown sectionKey: ${sectionKey}`);
                return;
        }

        if (showSkeleton) {
            if (skeletonContainer) {
                if (skeletonContainer) skeletonContainer.style.display = displayTypeIfReal;
                if (realContainer) realContainer.style.display = 'none';
            } else if (realContainer && individualCards.length > 0) { 
                realContainer.classList.add('loading');
                realContainer.style.display = displayTypeIfReal;
                individualCards.forEach(card => {
                    if (card) {
                        card.classList.add('loading');
                        setCardContentVisibility(card, false);
                    }
                });
            }
        } else {
            if (skeletonContainer) {
                if (skeletonContainer) skeletonContainer.style.display = 'none';
                if (realContainer) realContainer.style.display = displayTypeIfReal;
            } else if (realContainer && individualCards.length > 0) { 
                realContainer.classList.remove('loading');
                realContainer.style.display = displayTypeIfReal;
                 individualCards.forEach(card => { 
                    if (card) {
                        card.classList.remove('loading');
                        setCardContentVisibility(card, true);
                    }
                });
            }
        }
    }

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

        const skeletonManagedSections = ['welcomeBanner', 'stats', 'shortcuts', 'activities', 'creditHistory',
                                         'currentPlan', 'historyPlan', 'createPlan', 'planDetail', 'planGeneration'];
        if (skeletonManagedSections.includes(sectionKey)) {
            toggleSkeletonUI(sectionKey, isLoadingFlag);
        }

        if (sectionKey === 'topicProgress' && ui.topicProgressSection) {
            ui.topicProgressTableLoadingOverlay?.classList.toggle('visible-loader', isLoadingFlag);
            ui.topicProgressTable?.classList.toggle('hidden-while-loading', isLoadingFlag);
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
        } else if (container === ui.historyPlanContent || container === ui.createPlanContent || container === ui.planContent) {
            container.style.display = 'block'; 
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

    async function fetchAndDisplayLatestCreditChange(userId) {
        console.log(`[CreditChange] Fetching latest credit change for user ${userId}...`);
        if (ui.latestCreditChange) { // Zajistíme, že element existuje před manipulací
            ui.latestCreditChange.innerHTML = ''; // Vyčistíme předchozí obsah
            ui.latestCreditChange.style.display = 'none'; // Skryjeme, dokud nemáme data
        }
        if (!supabaseClient || !userId ) {
            console.warn("[CreditChange] Missing Supabase or userId.");
            fetchAndDisplayLatestCreditChange.latestTxData = null; // Uložíme null, pokud chybí data
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

            if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine
                throw error;
            }

            // Uložíme data (nebo null) do statické vlastnosti funkce pro pozdější použití v renderStatsCards
            fetchAndDisplayLatestCreditChange.latestTxData = data;

            return data; // Může být null, pokud nebyly nalezeny žádné transakce
        } catch (error) {
            console.error('[CreditChange] Error fetching latest credit change:', error);
            fetchAndDisplayLatestCreditChange.latestTxData = null; // Uložíme null v případě chyby
            return null;
        }
    }
    fetchAndDisplayLatestCreditChange.latestTxData = null; // Inicializace statické vlastnosti

    async function loadDashboardStats() { 
        if (!state.currentUser || !supabaseClient || !state.currentProfile) { console.warn("[LoadStats] Chybí uživatel, Supabase klient nebo profil pro načtení statistik."); renderStatsCards(null); return; }
        setLoadingState('stats', true);
        try { userStatsData = await fetchUserStats(state.currentUser.id, state.currentProfile); renderStatsCards(userStatsData); }
        catch (error) { console.error("Error in loadDashboardStats:", error); renderStatsCards(null); }
    }

    function updateWelcomeBannerAndLevel(profile) { 
        console.log("[UI Update] Aktualizace uvítacího banneru a úrovně XP...");
        if (!profile) { console.warn("[UI Update Welcome] Chybí data profilu."); return; }
        if (ui.welcomeTitle) { const displayName = `${profile.first_name || ''}`.trim() || profile.username || state.currentUser?.email?.split('@')[0] || 'Pilote'; ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`; }
        const currentLevel = profile.level ?? 1; const currentExperience = profile.experience ?? 0;
        function getExpForLevel(level) { if (level <= 0) return 0; const BASE_XP = 100; const INCREMENT_XP = 25; return BASE_XP + (INCREMENT_XP * (level - 1)); }
        function getTotalExpThreshold(targetLevel) { if (targetLevel <= 1) return 0; let totalExp = 0; for (let level = 1; level < targetLevel; level++) { totalExp += getExpForLevel(level); } return totalExp; }
        const expForCurrentLevel = getTotalExpThreshold(currentLevel); const expForNextLevel = getTotalExpThreshold(currentLevel + 1); const expNeededForSpan = expForNextLevel - expForCurrentLevel; const currentExpInLevelSpan = Math.max(0, currentExperience - expForCurrentLevel); let percentage = 0;
        if (expNeededForSpan > 0) { percentage = Math.min(100, Math.max(0, Math.round((currentExpInLevelSpan / expNeededForSpan) * 100))); } else if (currentLevel > 0 && expNeededForSpan <=0 ) { percentage = 100; }
        if (ui.dashboardLevelWidget) ui.dashboardLevelWidget.textContent = currentLevel; if (ui.dashboardExpProgressBar) ui.dashboardExpProgressBar.style.width = `${percentage}%`; if (ui.dashboardExpCurrent) ui.dashboardExpCurrent.textContent = currentExpInLevelSpan; if (ui.dashboardExpRequired) ui.dashboardExpRequired.textContent = expNeededForSpan > 0 ? expNeededForSpan : 'MAX'; if (ui.dashboardExpPercentage) ui.dashboardExpPercentage.textContent = percentage;
        console.log("[UI Update] Uvítací banner a úroveň XP aktualizovány.");
    }

    async function loadTopicProgress() { 
        if (!state.currentUser || !supabaseClient) return;
        setLoadingState('topicProgress', true);
        try {
            const { data, error } = await supabaseClient.rpc('get_user_topic_progress_summary', { p_user_id: state.currentUser.id });
            if (error) { let errorMessage = error.message; const errString = JSON.stringify(error); if (errString.includes('structure of query does not match function result type') || (error.code && ['PGRST200', '42883', '42703'].includes(error.code))) { errorMessage = 'Chyba: Funkce pro načtení pokroku v tématech (get_user_topic_progress_summary) má nesprávnou definici, neexistuje na serveru, nebo vrací nesprávné sloupce. Zkontrolujte SQL definici funkce, její návratové typy a SELECT část.'; } else if (error.status === 404 || (error.message && error.message.includes('404')) || errString.includes('"status":404')){ errorMessage = 'Chyba: Požadovaná funkce (get_user_topic_progress_summary) pro načtení pokroku v tématech nebyla nalezena na serveru (404). Ověřte prosím, že je SQL funkce správně vytvořena a nasazena.';} throw new Error(errorMessage); }
            renderTopicProgressTable(data || []);
        } catch (error) { console.error("Error loading topic progress via RPC:", error); if(ui.topicProgressTable) ui.topicProgressTable.style.display = 'none'; if(ui.topicProgressEmptyState) { ui.topicProgressEmptyState.innerHTML = `<i class="fas fa-exclamation-triangle"></i><h3>Chyba načítání</h3><p>${sanitizeHTML(error.message)}</p>`; ui.topicProgressEmptyState.style.display = 'flex'; }}
        finally { setLoadingState('topicProgress', false); }
    }
    function renderTopicProgressTable(topics) { 
        if (!ui.topicProgressTableBody || !ui.topicProgressTable || !ui.topicProgressEmptyState) return;
        ui.topicProgressTableBody.innerHTML = '';
        if (!topics || topics.length === 0) { ui.topicProgressTable.style.display = 'none'; ui.topicProgressEmptyState.innerHTML = '<i class="fas fa-book-reader"></i><h3>Žádná data o pokroku</h3><p>Zatím nemáte zaznamenaný žádný pokrok v tématech. Začněte procvičovat!</p>'; ui.topicProgressEmptyState.style.display = 'flex'; return; }
        ui.topicProgressTable.style.display = 'table'; ui.topicProgressEmptyState.style.display = 'none';
        topics.sort((a,b) => (new Date(b.last_studied_at || 0)) - (new Date(a.last_studied_at || 0)));
        topics.forEach(topic => { const row = ui.topicProgressTableBody.insertRow(); const progress = Math.round(topic.progress_percentage || 0); let progressColor = 'var(--accent-primary)'; if (progress >= 75) progressColor = 'var(--accent-lime)'; else if (progress < 40) progressColor = 'var(--accent-pink)'; row.innerHTML = `<td><i class="fas ${topic.topic_icon || 'fa-question-circle'}" style="margin-right: 0.7em; color: ${progressColor};"></i>${sanitizeHTML(topic.topic_name)}</td><td><div class="progress-bar-cell"><div class="progress-bar-track"><div class="progress-bar-fill" style="width: ${progress}%; background: ${progressColor};"></div></div><span class="progress-bar-text" style="color: ${progressColor};">${progress}%</span></div></td><td>${topic.last_studied_at ? formatDate(topic.last_studied_at) : '-'}</td>`; });
    }
    function handleSort(event) { const th = event.currentTarget; const column = th.dataset.sort; console.log("Sorting by:", column); showToast("Řazení tabulky", "Funkce řazení bude brzy implementována.", "info");}

    async function handlePlanTabManagement(planSubTabId) { 
        if (!supabaseClient) { showGlobalError("Aplikace není správně inicializována."); return; }
        console.log(`[Plan SubTab] Switching to plan sub-tab: ${planSubTabId}`);

        [ui.currentPlanSection, ui.historyPlanSection, ui.createPlanSection, ui.planSection].forEach(section => {
            if (section) section.classList.remove('visible-section');
        });

        if (ui.currentPlanEmptyState) ui.currentPlanEmptyState.innerHTML = '';
        if (ui.historyPlanContent) ui.historyPlanContent.innerHTML = '';
        if (ui.createPlanContent) ui.createPlanContent.innerHTML = '';
        if (ui.planContent) ui.planContent.innerHTML = '';

        if (state.lastGeneratedMarkdown !== null && planSubTabId !== 'planDetail' && planSubTabId !== 'planGeneration') {
            console.log("[Plan SubTab] Clearing generated plan state as we are leaving the preview/generation section.");
            state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; state.lastGeneratedTopicsData = null;
        }
        hideGlobalError();

        try {
            let targetSectionElement = null;
            let loaderKey = null;

            switch(planSubTabId) {
                case 'currentPlan': targetSectionElement = ui.currentPlanSection; loaderKey = 'currentPlan'; break;
                case 'historyPlan': targetSectionElement = ui.historyPlanSection; loaderKey = 'historyPlan'; break;
                case 'createPlan': targetSectionElement = ui.createPlanSection; loaderKey = 'createPlan'; break;
                case 'planDetail': targetSectionElement = ui.planSection; loaderKey = 'planDetail'; break;
                case 'planGeneration': targetSectionElement = ui.planSection; loaderKey = 'planGeneration'; break;
                default: console.warn(`[Plan SubTab] Unknown plan sub-tab ID: ${planSubTabId}`); return;
            }

            if (targetSectionElement) {
                targetSectionElement.classList.add('visible-section');
                if (planSubTabId === 'currentPlan') await loadCurrentPlan();
                else if (planSubTabId === 'historyPlan') await loadPlanHistory();
                else if (planSubTabId === 'createPlan') await checkPlanCreationAvailability();
            } else {
                console.warn(`[Plan SubTab] Target section element not found for plan sub-tab: ${planSubTabId}`);
            }
        } catch (error) {
            console.error(`[Plan SubTab] Error loading plan sub-tab ${planSubTabId}:`, error);
            const errorTargetSection = (planSubTabId === 'currentPlan') ? ui.currentPlanSection :
                                     (planSubTabId === 'historyPlan') ? ui.historyPlanSection :
                                     (planSubTabId === 'createPlan') ? ui.createPlanSection : ui.planSection;
            const errorContentContainer = (planSubTabId === 'currentPlan') ? ui.currentPlanEmptyState :
                                          (planSubTabId === 'historyPlan') ? ui.historyPlanContent :
                                          (planSubTabId === 'createPlan') ? ui.createPlanContent : ui.planContent;

            if(errorTargetSection) errorTargetSection.classList.add('visible-section');
            if (errorContentContainer) {
                renderMessage(errorContentContainer, 'error', 'Chyba načítání', `Obsah sekce plánu "${planSubTabId}" nelze načíst: ${error.message}`);
            } else {
                showGlobalError(`Nepodařilo se načíst sekci plánu "${planSubTabId}": ${error.message}`);
            }
            setLoadingState(planSubTabId, false);
        }
    }

    async function switchTabContent(tabId) {
        console.log(`[Main Tab Switch] Pokus o přepnutí na záložku: ${tabId}`);
        state.currentMainTab = tabId;

        ui.contentTabs.forEach(tab => {
            const isCurrentTab = tab.dataset.tab === tabId;
            tab.classList.toggle('active', isCurrentTab);
            tab.setAttribute('aria-selected', isCurrentTab ? 'true' : 'false');
        });

        if(ui.practiceTabContent) ui.practiceTabContent.style.display = 'none';
        if(ui.planTabContent) ui.planTabContent.style.display = 'none';
        if(ui.vyukaTabContent) ui.vyukaTabContent.style.display = 'none';

        [ui.currentPlanSection, ui.historyPlanSection, ui.createPlanSection, ui.planSection].forEach(section => {
            if (section) section.classList.remove('visible-section');
        });


        let targetElement = null;
        if (tabId === 'practice-tab') {
            targetElement = ui.practiceTabContent;
            if(targetElement) targetElement.style.display = 'block';
            await loadDashboardStats();
            await loadTopicProgress();
            if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderAll === 'function' && state.currentUser) {
                 await DashboardLists.loadAndRenderAll(state.currentUser.id, 5);
            }
        } else if (tabId === 'plan-tab') {
            targetElement = ui.planTabContent;
            if(targetElement) targetElement.style.display = 'block';
            await handlePlanTabManagement('currentPlan'); 
        } else if (tabId === 'vyuka-tab') {
            targetElement = ui.vyukaTabContent;
            if(targetElement) targetElement.style.display = 'block';
            console.log("[Main Tab Switch] Výuka tab activated. Placeholder for future content loading.");
        } else {
            console.warn(`[Main Tab Switch] Unknown tabId: ${tabId}`);
            return;
        }

        if (targetElement) {
            if (targetElement.classList.contains('tab-content')) {
                targetElement.classList.add('active');
            }
            console.log(`[Main Tab Switch] Activated element: #${targetElement.id}`);
        }
        if (ui.mainTabContentArea) {
            ui.mainTabContentArea.style.display = 'flex'; 
            ui.mainTabContentArea.classList.add('visible');
        }
    }


    async function getLatestDiagnosticTest(userId, showLoaderFlag = true) { 
        if (!userId || !supabaseClient) return null;
        if (showLoaderFlag && state.currentMainTab === 'practice-tab') setLoadingState('page', true); 
        try {
            const { data, error } = await supabaseClient.from('user_diagnostics').select('id, completed_at, total_score, total_questions, topic_results, analysis').eq('user_id', userId).order('completed_at', { ascending: false }).limit(1);
            if (error) throw error;
            state.latestDiagnosticTest = (data && data.length > 0) ? data[0] : false;
            console.log("[getLatestDiagnosticTest] Fetched:", state.latestDiagnosticTest);
            return state.latestDiagnosticTest;
        } catch (error) {
            console.error("Error fetching latest diagnostic test:", error);
            state.latestDiagnosticTest = null;
            return null;
        } finally {
            if (showLoaderFlag && state.currentMainTab === 'practice-tab') setLoadingState('page', false);
        }
    }

    async function checkUserInitialSetup(userId) { 
        console.log("[InitialSetupCheck] Checking setup for user:", userId);
        if (!state.currentProfile) { console.warn("[InitialSetupCheck] Profile not loaded, cannot check setup."); return { completedGoalSetting: false, completedDiagnostic: false }; }
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
            ui.goalRadioLabels.forEach(label => { label.classList.remove('selected-goal'); const radio = label.querySelector('input[type="radio"]'); if (radio) radio.checked = false; });
            if (state.currentProfile && state.currentProfile.learning_goal) { const currentGoalRadio = document.querySelector(`input[name="learningGoal"][value="${state.currentProfile.learning_goal}"]`); if (currentGoalRadio) { currentGoalRadio.checked = true; currentGoalRadio.closest('.goal-radio-label')?.classList.add('selected-goal');}}
        }
        if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none';
        if (ui.mainTabContentArea) ui.mainTabContentArea.style.display = 'none';
        if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none';
    }

    function hideGoalSelectionModal() { if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; } 

    function handleGoalSelection(event) { 
        const target = event.target.closest('.goal-radio-label'); if (!target) return;
        const radio = target.querySelector('input[type="radio"]'); if (!radio) return;
        ui.goalRadioLabels.forEach(label => label.classList.remove('selected-goal')); target.classList.add('selected-goal');
        const selectedGoal = radio.value; state.selectedLearningGoal = selectedGoal;
        let nextStepId = null;
        if (selectedGoal === 'math_accelerate') nextStepId = 'goal-step-accelerate';
        else if (selectedGoal === 'math_review') nextStepId = 'goal-step-review';
        else if (selectedGoal === 'math_explore') nextStepId = 'goal-step-explore';
        if (nextStepId) { ui.goalModalSteps.forEach(step => step.classList.remove('active')); document.getElementById(nextStepId)?.classList.add('active'); if (selectedGoal === 'math_review') loadTopicsForGradeReview(); }
        else if (selectedGoal === 'exam_prep') { saveLearningGoal(selectedGoal, {}); }
        else { console.warn("No next step defined for goal:", selectedGoal); }
    }

    async function loadTopicsForGradeReview() { 
        if (!state.allExamTopicsAndSubtopics || state.allExamTopicsAndSubtopics.length === 0) {
            try { const { data, error } = await supabaseClient.from('exam_topics').select(`id, name, subtopics:exam_subtopics (id, name, topic_id)`).order('id'); if (error) throw error; state.allExamTopicsAndSubtopics = data || []; }
            catch (e) { console.error("Failed to load topics for review:", e); if (ui.topicRatingsContainer) ui.topicRatingsContainer.innerHTML = '<p class="error-message">Nepodařilo se načíst témata.</p>'; return; }
        }
        populateTopicRatings();
    }

    function populateTopicRatings() { 
        if (!ui.topicRatingsContainer) return; ui.topicRatingsContainer.innerHTML = '';
        if (!state.allExamTopicsAndSubtopics || state.allExamTopicsAndSubtopics.length === 0) { ui.topicRatingsContainer.innerHTML = '<p>Žádná témata k hodnocení.</p>'; return; }
        state.allExamTopicsAndSubtopics.filter(topic => topic.name !== "Smíšené úlohy").forEach(topic => { const item = document.createElement('div'); item.className = 'topic-rating-item'; item.innerHTML = `<span class="topic-name">${sanitizeHTML(topic.name)}</span><div class="rating-stars" data-topic-id="${topic.id}">${[1,2,3,4,5].map(val => `<i class="fas fa-star star" data-value="${val}" aria-label="${val} hvězdiček"></i>`).join('')}</div>`; item.querySelectorAll('.star').forEach(star => { star.addEventListener('click', function() { const value = parseInt(this.dataset.value); const parentStars = this.parentElement; parentStars.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('rated', i < value)); parentStars.dataset.currentRating = value; }); }); ui.topicRatingsContainer.appendChild(item); });
    }

    async function saveLearningGoal(goal, details = {}) { 
        if (!state.currentUser || !supabaseClient) { showToast("Chyba: Uživatel není přihlášen.", "error"); return; }
        setLoadingState('goalModal', true); console.log(`[SaveGoal] Saving goal: ${goal}, Details:`, details);
        const currentGoalDetails = state.currentProfile?.preferences?.goal_details || {};
        const preferencesUpdate = { ...state.currentProfile.preferences, goal_details: { ...currentGoalDetails, ...details } };
        try {
            const { error } = await supabaseClient.from('profiles').update({ learning_goal: goal, preferences: preferencesUpdate, updated_at: new Date().toISOString() }).eq('id', state.currentUser.id);
            if (error) throw error;
            if(state.currentProfile) { state.currentProfile.learning_goal = goal; state.currentProfile.preferences = preferencesUpdate; }
            state.hasCompletedGoalSetting = true; showToast("Cíl uložen!", `Váš studijní cíl byl nastaven na: ${getGoalDisplayName(goal)}.`, "success");
            hideGoalSelectionModal(); updateUserGoalDisplay();
            const { completedDiagnostic } = await checkUserInitialSetup(state.currentUser.id); state.hasCompletedDiagnostic = completedDiagnostic;
            if (!completedDiagnostic && goal !== 'math_explore') { showDiagnosticPrompt(); } else { if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none'; }
            if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');}
            if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');} 
            await switchTabContent('practice-tab'); 
        } catch (error) { console.error("Error saving learning goal:", error); showToast("Chyba ukládání", `Nepodařilo se uložit cíl: ${error.message}`, "error");
        } finally { setLoadingState('goalModal', false); }
    }

    function showDiagnosticPrompt() { if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'flex'; if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');} if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');} } 

    function getGoalDisplayName(goalKey) { const goalMap = { 'exam_prep': 'Příprava na přijímačky', 'math_accelerate': 'Učení napřed', 'math_review': 'Doplnění mezer', 'math_explore': 'Volné prozkoumávání', }; return goalMap[goalKey] || goalKey || 'Neznámý cíl'; } 

    function updateUserGoalDisplay() { if (ui.userGoalDisplay && state.currentProfile && state.currentProfile.learning_goal) { ui.userGoalDisplay.innerHTML = `<i class="fas fa-bullseye"></i> Cíl: <strong>${getGoalDisplayName(state.currentProfile.learning_goal)}</strong>`; ui.userGoalDisplay.style.display = 'inline-flex'; } else if (ui.userGoalDisplay) { ui.userGoalDisplay.style.display = 'none'; } } 

    // ==============================================
    //          Event Listeners Setup
    // ==============================================
    
    // ==============================================
    //          Initialization
    // ==============================================
    async function initializeApp() {
        console.log("🚀🚀🚀 [Init Main - DEBUG] procvicovani/main.js initializeApp CALLED! 🚀🚀🚀");
        console.log("🚀 [Init Main] Starting application...");
        cacheDOMElements();
        setLoadingState('page', true);
        if (!initializeSupabase()) { setLoadingState('page', false); showGlobalError("Kritická chyba: Nelze inicializovat databázi."); if(ui.mainContent) ui.mainContent.style.display = 'flex'; return; }
        applyInitialSidebarState(); hideGlobalError();
        try {
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);
            if (!session || !session.user) { console.log('[Init Main] Not logged in. Redirecting...'); window.location.href = '/auth/index.html'; return; }
            state.currentUser = session.user;
            const [profileData, titlesData] = await Promise.all([ fetchUserProfile(state.currentUser.id), fetchTitles() ]);
            state.currentProfile = profileData; state.allTitles = titlesData || [];
            if (!state.currentProfile) { console.error("[Init Main] Profile could not be loaded for user:", state.currentUser.id); showGlobalError("Nepodařilo se načíst váš profil. Zkuste obnovit stránku."); setLoadingState('page', false); if(ui.mainContent) ui.mainContent.style.display = 'flex'; return; }
            userStatsData = await fetchUserStats(state.currentUser.id, state.currentProfile);
            await fetchAndDisplayLatestCreditChange(state.currentUser.id);
            updateSidebarProfile(); updateUserGoalDisplay(); setupEventListeners(); initTooltips(); initMouseFollower(); initHeaderScrollDetection(); updateCopyrightYear(); updateOnlineStatus();
            if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.initialize === 'function') { DashboardLists.initialize({ supabaseClient: supabaseClient, currentUser: state.currentUser, activityVisuals: activityVisuals, formatRelativeTime: formatRelativeTime, sanitizeHTML: sanitizeHTML, }); console.log("[Init Main] DashboardLists initialized."); }
            else { console.warn("[Init Main] DashboardLists module not found or initialize function missing. Activity/Credit lists might not load.");}
            fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT).then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications)).catch(err => { console.error("Failed to load notifications initially:", err); renderNotifications(0, []); });
            const { completedGoalSetting, completedDiagnostic } = await checkUserInitialSetup(state.currentUser.id); state.hasCompletedGoalSetting = completedGoalSetting; state.hasCompletedDiagnostic = completedDiagnostic;
            if (!completedGoalSetting) { showGoalSelectionModal(); }
            else if (!completedDiagnostic && state.currentProfile?.learning_goal !== 'math_explore') { showDiagnosticPrompt(); if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');} if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');} await switchTabContent("practice-tab"); }
            else { if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none'; if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');} if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');} const urlParams = new URLSearchParams(window.location.search); const initialTab = urlParams.get('tab') || 'practice-tab'; await switchTabContent(initialTab); }
            if (ui.mainContent) { ui.mainContent.style.display = 'flex'; requestAnimationFrame(() => { if(ui.mainContent) ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
            console.log("✅ [Init Main] Page Initialized.");
        } catch (error) { console.error("❌ [Init Main] Critical initialization error:", error); if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). Obnovte.</p>`; } else { showGlobalError(`Chyba inicializace: ${error.message}`, true); } if(ui.mainContent) ui.mainContent.style.display = 'flex'; 
        } finally { setLoadingState('page', false); }
    }

    document.addEventListener('DOMContentLoaded', initializeApp);

})();

// Seznam funkcí v dashboard/procvicovani/main.js:
// cacheDOMElements, formatDateForDisplay, getTodayDateString, dateToYYYYMMDD, addDaysToDate, formatDate, showToast, sanitizeHTML, getInitials, openMenu, closeMenu, initTooltips, showGlobalError, hideGlobalError, formatRelativeTime, updateCopyrightYear, initMouseFollower, initScrollAnimations, initHeaderScrollDetection, updateOnlineStatus, applyInitialSidebarState, toggleSidebar, setCardContentVisibility, toggleSkeletonUI, setLoadingState, renderMessage, initializeSupabase, fetchUserProfile, fetchTitles, updateSidebarProfile, fetchNotifications, renderNotifications, renderNotificationSkeletons, markNotificationRead, markAllNotificationsRead, groupActivitiesByDayAndDateArray, loadCurrentPlan, renderSingleDayPlan, updateNavigationButtonsState, renderPromptCreatePlan, renderNoActivePlan, handleActivityCompletionToggle, updatePlanProgress, getActivityIcon, loadPlanHistory, renderPlanHistory, renderHistorySkeletons, showPlanDetail, getLatestDiagnosticTest, getLatestDiagnosticDataForPlanContext, checkPlanCreationAvailability, renderNoDiagnosticAvailable, renderLockedPlanSection, startPlanTimer, updateNextPlanTimer, renderPlanCreationForm, handleGenerateClick, generateStudyPlan, renderPreviewActions, handleSaveGeneratedPlanClick, generatePlanContentWithGemini, displayPlanContent, getActivityTypeFromTitle, exportPlanToPDFWithStyle, fetchUserStats, loadDashboardStats, renderStatsCards, updateWelcomeBannerAndLevel, loadTopicProgress, renderTopicProgressTable, handleSort, switchTabContent, handlePlanTabManagement, checkUserInitialSetup, showGoalSelectionModal, hideGoalSelectionModal, handleGoalSelection, loadTopicsForGradeReview, populateTopicRatings, saveLearningGoal, showDiagnosticPrompt, getGoalDisplayName, updateUserGoalDisplay, setupEventListeners, initializeApp