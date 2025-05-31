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
        latestDiagnosticTest: null, // Pro logiku main.js
        currentStudyPlan: null,     // Pro logiku plánu
        allTitles: [],
        currentMainTab: 'practice-tab', // Výchozí záložka
        isLoading: {
            page: true, stats: false, topicProgress: false,
            goalModal: false, notifications: false, titles: false,
            // Stavy pro Plán
            currentPlan: false, // Nahrazuje current, schedule z plan.js
            historyPlan: false, // Nahrazuje history z plan.js
            createPlan: false,  // Nahrazuje create z plan.js
            planDetail: false,  // Nahrazuje detail z plan.js
            planGeneration: false, // Nahrazuje generation z plan.js
        },
        hasCompletedGoalSetting: false,
        hasCompletedDiagnostic: false,
        allExamTopicsAndSubtopics: [],
        // Stavy specifické pro Plán (přesunuto z plan.js)
        latestDiagnosticDataForPlan: null, // Přejmenováno z latestDiagnosticData
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
        lesson: { name: 'Nová Data/Lekce', icon: 'fa-book-open', class: 'lesson' }, // Sjednoceno
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
            toastContainer: document.getElementById('toastContainer'), // Přejmenováno z toastContainer na toastContainer
            globalError: document.getElementById('global-error'),
            dashboardTitle: document.getElementById('dashboard-title'),
            userGoalDisplay: document.getElementById('user-goal-display'),
            refreshDataBtn: document.getElementById('refresh-data-btn'),
            diagnosticPrompt: document.getElementById('diagnostic-prompt'),
            startTestBtnPrompt: document.getElementById('start-test-btn-prompt'),
            tabsWrapper: document.getElementById('tabs-wrapper'),
            contentTabs: document.querySelectorAll('#tabs-wrapper .plan-tab'), // Zůstává stejné, plan-tab je třída
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
            accelerateGradeSelect: document.getElementById('accelerate-grade'), // ID z main.html pro modál
            accelerateIntensitySelect: document.getElementById('accelerate-intensity'), // ID z main.html pro modál
            accelerateAreasCheckboxes: document.querySelectorAll('input[name="accelerate_area"]'),
            accelerateReasonRadios: document.querySelectorAll('input[name="accelerate_reason"]'),
            accelerateProfessionGroup: document.getElementById('accelerate-profession-group'),
            accelerateProfessionTextarea: document.getElementById('accelerate-profession'),
            reviewGradeSelect: document.getElementById('review-grade'), // ID z main.html pro modál
            topicRatingsContainer: document.getElementById('topic-ratings-container'),
            exploreGradeSelect: document.getElementById('explore-grade'), // ID z main.html pro modál

            // Elementy pro Plán (přidány/přejmenovány z plan.js ui)
            planTabContent: document.getElementById('plan-tab-content'), // Nový hlavní kontejner pro Plán
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
            planSection: document.getElementById('planSection'), // Pro detail/návrh
            planLoading: document.getElementById('planLoading'), // Loader v detailu/návrhu
            planSectionTitle: document.getElementById('plan-section-title'),
            planContent: document.getElementById('planContent'), // Zobrazení markdownu
            planActions: document.getElementById('planActions'), // Tlačítka pro návrh plánu
            genericBackBtn: document.getElementById('genericBackBtn'), // Zpět v detailu/návrhu

            notificationBell: document.getElementById('notification-bell'),
            notificationCount: document.getElementById('notification-count'),
            notificationsDropdown: document.getElementById('notifications-dropdown'),
            notificationsList: document.getElementById('notifications-list'),
            noNotificationsMsg: document.getElementById('no-notifications-msg'),
            markAllReadBtn: document.getElementById('mark-all-read'),
            currentYearSidebar: document.getElementById('currentYearSidebar'),
            currentYearFooter: document.getElementById('currentYearFooter'),
            mouseFollower: document.getElementById('mouse-follower'),
            dayCardTemplate: document.getElementById('dayCardTemplate'), // Z plan.html
            dayCardSkeleton: document.getElementById('dayCardSkeleton'), // Z plan.html
            lockedPlanTemplate: document.getElementById('lockedPlanTemplate'), // Z plan.html
            createPlanFormTemplate: document.getElementById('createPlanFormTemplate'), // Z plan.html
            noDiagnosticTemplate: document.getElementById('noDiagnosticTemplate'), // Z plan.html
            historyItemTemplate: document.getElementById('historyItemTemplate'), // Z plan.html
            promptCreatePlanTemplate: document.getElementById('promptCreatePlanTemplate'), // Z plan.html
            noActivePlanTemplate: document.getElementById('noActivePlanTemplate'), // Z plan.html
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
        if (!ui.exploreGradeSelect) ui.exploreGradeSelect = document.getElementById('explore_grade'); // Zkontrolujeme i toto, ačkoliv není v plan.html
        console.log("[CACHE DOM] Caching complete.");
    }

    const formatDateForDisplay = (dateStringOrDate) => {
        if (!dateStringOrDate) return 'Neznámé datum';
        try {
            const date = (typeof dateStringOrDate === 'string') ? new Date(dateStringOrDate + 'T00:00:00') : dateStringOrDate; // Přidáno T00:00:00 pro konzistenci
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
    const addDaysToDate = (dateString, days) => { // Tato funkce nebyla v plan.js, ale může být užitečná
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
                skeletonContainer = null; // Řešeno přes třídu 'loading' na jednotlivých kartách
                realContainer = ui.statsCardsContainer; // Hlavní kontejner statistik
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
            // Případy pro Plán
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
                    if (sectionKey === 'historyPlan' && ui.historyPlanContent) renderHistorySkeletons(3);
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
                return; // Ukončení pro plan-specifické sekce

            default:
                console.warn(`[Skeleton Toggle - Main.js] Unknown sectionKey: ${sectionKey}`);
                return;
        }

        if (showSkeleton) {
            if (skeletonContainer) {
                if (skeletonContainer) skeletonContainer.style.display = displayTypeIfReal;
                if (realContainer) realContainer.style.display = 'none';
            } else if (realContainer && individualCards.length > 0) { // Pro 'stats' sekci
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
            } else if (realContainer && individualCards.length > 0) { // Pro 'stats' sekci
                realContainer.classList.remove('loading');
                realContainer.style.display = displayTypeIfReal;
                 individualCards.forEach(card => { // explicitní zobrazení obsahu po načtení
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
        container.classList.add('content-visible'); // Zůstává pro kompatibilitu s plan.js

        // Specifické zobrazení pro kontejnery plánu
        if (container === ui.currentPlanEmptyState) {
            if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
            container.style.display = 'flex';
        } else if (container === ui.historyPlanContent || container === ui.createPlanContent || container === ui.planContent) {
            container.style.display = 'block'; // Nebo flex, pokud to vyžaduje .notest-message
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
        setLoadingState('titles', true); // Používáme 'titles' i zde, protože tituly se načítají s profilem
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('id, updated_at, username, first_name, last_name, email, avatar_url, bio, school, grade, level, completed_exercises, streak_days, last_login, badges_count, points, preferences, notifications, created_at, experience, purchased_titles, selected_title, last_reward_claimed_at, monthly_claims, last_milestone_claimed, learning_goal, longest_streak_days, role') // Přidán learning_goal a longest_streak_days
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = 0 rows, což je OK, pokud profil neexistuje
                console.error("Profile fetch error (details):", error);
                throw error;
            }
            if (!data) { // Vytvoření výchozího profilu, pokud neexistuje
                console.warn(`Profil pro uživatele ${userId} nenalezen. Vytvářím výchozí...`);
                const defaultProfile = {
                    id: userId,
                    email: state.currentUser.email, // Předpokládá, že state.currentUser je již nastaven
                    username: state.currentUser.email.split('@')[0],
                    level: 1, points: 0, experience: 0, badges_count: 0, streak_days: 0, longest_streak_days: 0,
                    last_login: new Date().toISOString(),
                    monthly_claims: {}, last_milestone_claimed: 0,
                    preferences: { dark_mode: window.matchMedia('(prefers-color-scheme: dark)').matches, language: 'cs', goal_details: {} },
                    notifications: { email: true, study_tips: true, content_updates: true, practice_reminders: true },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    purchased_titles: [],
                    learning_goal: null // Výchozí hodnota
                };
                const { data: newProfile, error: insertError } = await supabaseClient
                    .from('profiles')
                    .insert(defaultProfile)
                    .select('id, updated_at, username, first_name, last_name, email, avatar_url, bio, school, grade, level, completed_exercises, streak_days, last_login, badges_count, points, preferences, notifications, created_at, experience, purchased_titles, selected_title, last_reward_claimed_at, monthly_claims, last_milestone_claimed, learning_goal, longest_streak_days, role')
                    .single();
                if (insertError) throw insertError;
                setLoadingState('titles', false);
                return newProfile;
            }
            if (!data.preferences) data.preferences = { goal_details: {} }; // Zajistí, že preferences existuje
            else if (!data.preferences.goal_details) data.preferences.goal_details = {};

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
    function renderNotifications(count, notifications) { console.log("[Render Notifications] Start, Count:", count, "Notifications:", notifications); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements."); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class || 'default'}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.toggle('has-content', notifications && notifications.length > 0); console.log("[Render Notifications] Finished"); }
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    async function markNotificationRead(notificationId) { console.log("[Notifications] Marking notification as read:", notificationId); if (!state.currentUser || !notificationId) return false; try { const { error } = await supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[Notifications] Mark as read successful for ID:", notificationId); return true; } catch (error) { console.error("[Notifications] Mark as read error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { console.log("[Notifications] Marking all as read for user:", state.currentUser?.id); if (!state.currentUser || !ui.markAllReadBtn) return; setLoadingState('notifications', true); try { const { error } = await supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('is_read', false); if (error) throw error; console.log("[Notifications] Mark all as read successful"); const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[Notifications] Mark all as read error:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }

    const groupActivitiesByDayAndDateArray = (activities) => { // Z plan.js
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

        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(state.planStartDate);
            currentDate.setDate(state.planStartDate.getDate() + i);
            const dayOfWeekForMap = currentDate.getDay();
            dayToDateMap[dayOfWeekForMap === 0 ? 7 : dayOfWeekForMap] = dateToYYYYMMDD(currentDate);
        }

        activities.forEach(act => {
            const dateString = dayToDateMap[act.day_of_week];
            if (dateString) {
                if (!state.allActivePlanActivitiesByDay[dateString]) {
                    state.allActivePlanActivitiesByDay[dateString] = [];
                }
                state.allActivePlanActivitiesByDay[dateString].push(act);
            } else {
                 console.warn(`Activity ID ${act.id} has invalid day_of_week: ${act.day_of_week}`);
            }
        });
        state.sortedActivityDates = Object.keys(state.allActivePlanActivitiesByDay).sort();
        if (state.sortedActivityDates.length > 0) {
            state.planStartDate = new Date(state.sortedActivityDates[0] + 'T00:00:00');
            state.planEndDate = new Date(state.sortedActivityDates[state.sortedActivityDates.length - 1] + 'T00:00:00');
        } else {
            state.planStartDate = null;
            state.planEndDate = null;
        }
        console.log("[groupActivities] Grouped activities:", state.allActivePlanActivitiesByDay, "Sorted dates:", state.sortedActivityDates, "Plan effective start/end:", state.planStartDate, state.planEndDate);
    };


    async function loadCurrentPlan() { // Z plan.js, upraveno pro state.isLoading.currentPlan
        if (!supabaseClient || !state.currentUser) return;
        console.log("[CurrentPlan in Main.js] Loading current plan...");
        setLoadingState('currentPlan', true); // Používáme nový klíč
        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        if (ui.currentPlanEmptyState) ui.currentPlanEmptyState.style.display = 'none';
        try {
            const { data: plans, error } = await supabaseClient.from('study_plans').select('*').eq('user_id', state.currentUser.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1);
            if (error) throw error;
            if (plans && plans.length > 0) {
                state.currentStudyPlan = plans[0]; console.log("[CurrentPlan in Main.js] Active plan found:", state.currentStudyPlan.id);
                const { data: activities, error: actError } = await supabaseClient.from('plan_activities').select('*').eq('plan_id', state.currentStudyPlan.id).order('day_of_week').order('time_slot');
                if (actError) throw actError;
                groupActivitiesByDayAndDateArray(activities || []); // Použije globální state
                const todayStr = getTodayDateString();
                if (state.sortedActivityDates.includes(todayStr)) { state.currentDisplayDate = todayStr; }
                else if (state.sortedActivityDates.length > 0) {
                    let futureDate = state.sortedActivityDates.find(d => d >= todayStr);
                    state.currentDisplayDate = futureDate || state.sortedActivityDates[state.sortedActivityDates.length -1];
                    if (!state.currentDisplayDate && state.planStartDate) {
                        state.currentDisplayDate = dateToYYYYMMDD(state.planStartDate);
                    } else if (!state.currentDisplayDate) {
                        state.currentDisplayDate = state.sortedActivityDates[0] || todayStr;
                    }
                }
                else { state.currentDisplayDate = todayStr; }
                renderSingleDayPlan(state.currentDisplayDate);
                if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'flex';
            } else {
                state.currentStudyPlan = null; state.allActivePlanActivitiesByDay = {}; state.sortedActivityDates = []; state.currentDisplayDate = null;
                console.log("[CurrentPlan in Main.js] No active plan found. Checking diagnostic...");
                if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
                const diagnostic = await getLatestDiagnosticTest(state.currentUser.id, false); // Používáme getLatestDiagnosticTest z main.js
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

    const renderSingleDayPlan = (targetDateString) => { // Z plan.js
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

    const updateNavigationButtonsState = (currentDateString) => { // Z plan.js
        if (!ui.prevDayBtn || !ui.nextDayBtn || !state.sortedActivityDates || state.sortedActivityDates.length === 0) { if(ui.prevDayBtn) ui.prevDayBtn.style.display = 'none'; if(ui.nextDayBtn) ui.nextDayBtn.style.display = 'none'; return; }
        const currentIndex = state.sortedActivityDates.indexOf(currentDateString);
        ui.prevDayBtn.style.display = 'inline-flex'; ui.nextDayBtn.style.display = 'inline-flex';
        ui.prevDayBtn.disabled = currentIndex <= 0; ui.nextDayBtn.disabled = currentIndex >= state.sortedActivityDates.length - 1;
    };

    const renderPromptCreatePlan = (container) => { // Z plan.js
        const promptTemplate = ui.promptCreatePlanTemplate; // Použijeme ui cache
        if (!container || !promptTemplate) { console.error("Missing container or promptCreatePlanTemplate for renderPromptCreatePlan in main.js."); return; }
        console.log("[Render] Rendering Prompt Create Plan...");
        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        const node = promptTemplate.content.cloneNode(true);
        const btn = node.getElementById('createNewPlanFromPromptBtn');
        if (btn) { btn.addEventListener('click', () => { console.log("Přepínám na záložku Vytvořit plán z promptu"); handlePlanTabManagement('create'); }); } // Upraveno pro přepnutí záložky
        container.innerHTML = ''; container.appendChild(node); container.style.display = 'flex';
        console.log("[Render] Prompt Create Plan Rendered.");
    };
    const renderNoActivePlan = (container) => { // Z plan.js
        const noActivePlanTemplate = ui.noActivePlanTemplate; // Použijeme ui cache
        if (!container || !noActivePlanTemplate) { console.error("Missing container or noActivePlanTemplate for renderNoActivePlan in main.js."); return; }
        console.log("[Render] Rendering No Active Plan...");
        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        const node = noActivePlanTemplate.content.cloneNode(true);
        const linkToCreate = node.querySelector('.link-to-create-tab');
        if(linkToCreate) { linkToCreate.addEventListener('click', (e) => { e.preventDefault(); console.log("Přepínám na záložku Vytvořit plán z 'no active'"); handlePlanTabManagement('create'); }); } // Upraveno
        container.innerHTML = ''; container.appendChild(node); container.style.display = 'flex';
        console.log("[Render] No Active Plan Rendered.");
    };
    const handleActivityCompletionToggle = async (activityId, isCompleted, planId) => { // Z plan.js
        if (!supabaseClient || !planId) return;
        try {
            const { error } = await supabaseClient.from('plan_activities').update({ completed: isCompleted, updated_at: new Date().toISOString() }).eq('id', activityId);
            if (error) throw error;
            console.log(`[ActivityToggle] Aktivita ${activityId} stav: ${isCompleted}`);
            await updatePlanProgress(planId);
        } catch (error) {
            console.error(`[ActivityToggle] Chyba aktualizace aktivity ${activityId}:`, error);
            showToast('Nepodařilo se aktualizovat stav aktivity.', 'error');
            const checkbox = document.getElementById(`carousel-activity-${activityId}`); // Hledáme pouze v karuselu
            const activityElement = checkbox?.closest('.activity-list-item');
            if(checkbox) checkbox.checked = !isCompleted;
            if(activityElement) activityElement.classList.toggle('completed', !isCompleted);
        }
    };
    const updatePlanProgress = async (planId) => { // Z plan.js
        if (!planId || !supabaseClient) return;
        console.log(`[PlanProgress] Updating progress for plan ${planId}`);
        try {
            const { count: totalCount, error: countError } = await supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId);
            const { count: completedCount, error: completedError } = await supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId).eq('completed', true);
            if (countError || completedError) throw countError || completedError;
            const numTotal = totalCount ?? 0;
            const numCompleted = completedCount ?? 0;
            const progress = numTotal > 0 ? Math.round((numCompleted / numTotal) * 100) : 0;
            console.log(`[PlanProgress] Plan ${planId}: ${numCompleted}/${numTotal} completed (${progress}%)`);
            const { error: updateError } = await supabaseClient.from('study_plans').update({ progress: progress, updated_at: new Date().toISOString() }).eq('id', planId);
            if (updateError) throw updateError;
            console.log(`[PlanProgress] Plan ${planId} progress DB updated to ${progress}%`);
            if (state.currentStudyPlan?.id === planId) state.currentStudyPlan.progress = progress;
        } catch (error) {
            console.error(`[PlanProgress] Error updating plan progress ${planId}:`, error);
        }
    };
    const getActivityIcon = (title = "", type = "") => { // Z plan.js, používá globální activityVisuals
        const lowerTitle = title.toLowerCase();
        const lowerType = type?.toLowerCase() || '';
        if (activityVisuals[lowerType]) return activityVisuals[lowerType].icon;
        if (lowerTitle.includes('test')) return activityVisuals.test.icon;
        if (lowerTitle.includes('cvičení') || lowerTitle.includes('příklad') || lowerTitle.includes('úloh')) return activityVisuals.exercise.icon;
        if (lowerTitle.includes('procvič')) return activityVisuals.practice.icon;
        if (lowerTitle.includes('opakování') || lowerTitle.includes('shrnutí')) return activityVisuals.review.icon;
        if (lowerTitle.includes('geometrie')) return 'fa-draw-polygon';
        if (lowerTitle.includes('algebra')) return 'fa-square-root-alt';
        if (lowerTitle.includes('procent')) return 'fa-percentage';
        if (lowerTitle.includes('analýza') || lowerTitle.includes('kontrola')) return activityVisuals.analysis.icon;
        if (lowerTitle.includes('lekce') || lowerTitle.includes('teorie') || lowerTitle.includes('vysvětlení')) return activityVisuals.theory.icon;
        return activityVisuals.default.icon;
    };
    async function loadPlanHistory() { // Z plan.js
        if (!supabaseClient || !state.currentUser) return;
        setLoadingState('historyPlan', true);
        if(ui.historyPlanContent) ui.historyPlanContent.classList.remove('content-visible');
        try {
            const { data: plans, error } = await supabaseClient.from('study_plans').select('id, title, created_at, status, progress').eq('user_id', state.currentUser.id).order('created_at', { ascending: false });
            if (error) throw error;
            state.previousPlans = plans || [];
            renderPlanHistory(state.previousPlans);
        } catch (error) {
            console.error("Error loading plan history:", error);
            renderMessage(ui.historyPlanContent, 'error', 'Chyba', 'Nepodařilo se načíst historii plánů.');
        } finally {
            setLoadingState('historyPlan', false);
        }
    }
    const renderPlanHistory = (plans) => { // Z plan.js
        if (!ui.historyPlanContent) return;
        if (!plans || plans.length === 0) {
            renderMessage(ui.historyPlanContent, 'info', 'Žádná historie', 'Zatím jste nevytvořili žádné studijní plány.');
            return;
        }
        ui.historyPlanContent.innerHTML = '';
        ui.historyPlanContent.style.display = 'grid';
        plans.forEach((plan, index) => {
            const node = ui.historyItemTemplate.content.cloneNode(true);
            const item = node.querySelector('.history-item');
            if(item) {
                item.dataset.planId = plan.id;
                item.classList.add(plan.status || 'inactive');
                item.setAttribute('data-animate', '');
                item.style.setProperty('--animation-order', index);
                const dateEl = item.querySelector('.history-date');
                const titleEl = item.querySelector('.history-title');
                const progressEl = item.querySelector('.history-progress');
                const statusEl = item.querySelector('.history-status');
                if(dateEl) dateEl.textContent = `Vytvořeno: ${formatDate(plan.created_at)}`;
                if(titleEl) titleEl.textContent = plan.title || "Studijní plán";
                if(progressEl) progressEl.innerHTML = `Pokrok: <strong>${plan.progress ?? 0}%</strong>`;
                if(statusEl) {
                    const statusText = plan.status === 'active' ? 'Aktivní' : plan.status === 'completed' ? 'Dokončený' : 'Neaktivní';
                    statusEl.textContent = statusText;
                    statusEl.className = `history-status ${plan.status || 'inactive'}`;
                }
                item.addEventListener('click', () => showPlanDetail(plan));
                ui.historyPlanContent.appendChild(node);
            }
        });
        ui.historyPlanContent.classList.add('content-visible');
        requestAnimationFrame(initScrollAnimations);
    };
    const renderHistorySkeletons = (count) => { // Z plan.js
        if (!ui.historyPlanContent) return;
        ui.historyPlanContent.innerHTML = '';
        if (count === 0) {
            ui.historyPlanContent.classList.remove('content-visible');
            ui.historyPlanContent.style.display = 'none';
            return;
        }
        ui.historyPlanContent.style.display = 'grid';
        ui.historyPlanContent.classList.add('content-visible');
        let skeletonHTML = '';
        for (let i = 0; i < count; i++) {
            skeletonHTML += `<div class="skeleton history-item-skeleton">
                                <div class="skeleton text-sm" style="width: 40%;"></div>
                                <div class="skeleton title-sm" style="width: 80%; height: 16px;"></div>
                                <div class="skeleton text-sm" style="width: 50%;"></div>
                            </div>`;
        }
        ui.historyPlanContent.innerHTML = skeletonHTML;
    };
    const showPlanDetail = async (plan) => { // Z plan.js, upraveno pro přepínání sekcí
        if (!plan || !plan.id || !supabaseClient) return;
        handlePlanTabManagement('detail'); // Zobrazí správnou sekci
        setLoadingState('planDetail', true);
        if(ui.planContent) ui.planContent.classList.remove('content-visible', 'generated-reveal');
        if(ui.planActions) ui.planActions.innerHTML = '';
        if(ui.planSectionTitle) ui.planSectionTitle.textContent = 'Načítání detailu...';

        if (ui.genericBackBtn) {
            ui.genericBackBtn.onclick = () => {
                 state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; state.lastGeneratedTopicsData = null;
                 handlePlanTabManagement('historyPlan'); // Zpět na historii
            };
        }
        try {
            if (!plan.plan_content_markdown) { // Pokud nemáme markdown, načteme ho
                console.log("Načítám plný markdown pro detail...");
                const { data: fullData, error: fetchError } = await supabaseClient
                    .from('study_plans')
                    .select('plan_content_markdown, title, created_at, estimated_completion_date')
                    .eq('id', plan.id)
                    .single();
                if (fetchError) throw fetchError;
                plan = { ...plan, ...fullData }; // Aktualizujeme objekt plánu
            }
            if(ui.planSectionTitle) ui.planSectionTitle.textContent = plan.title || 'Detail studijního plánu';
            const metaDateEl = document.getElementById('plan-meta-date'); // Předpokládáme, že toto ID existuje v novém HTML
            if (metaDateEl) metaDateEl.textContent = `Vytvořeno: ${formatDate(plan.created_at)}`;
            displayPlanContent(plan.plan_content_markdown || '# Studijní plán\n\nObsah plánu není k dispozici.');
            if (ui.planContent) {
                 ui.planContent.classList.remove('generated-reveal');
                 ui.planContent.classList.add('content-visible');
             }
            if(ui.planActions) {
                ui.planActions.innerHTML = `<button class="btn btn-success btn-tooltip" id="exportDetailPlanBtn" title="Stáhnout plán jako PDF"><i class="fas fa-file-pdf"></i> Export PDF</button>`;
                const exportButton = ui.planActions.querySelector('#exportDetailPlanBtn');
                if(exportButton) exportButton.addEventListener('click', () => exportPlanToPDFWithStyle(plan));
                ui.planActions.style.display = 'flex';
            }
            ui.planSection.scrollIntoView({ behavior: 'smooth' });
            initTooltips();
        } catch (error) {
            console.error("Chyba načítání detailu plánu:", error);
            if(ui.planContent) {
                 renderMessage(ui.planContent, 'error', 'Chyba', 'Nepodařilo se načíst detail plánu.');
                 ui.planContent.classList.add('content-visible');
             }
            if(ui.planActions) ui.planActions.innerHTML = '';
        } finally {
            setLoadingState('planDetail', false);
        }
    };
    const getLatestDiagnosticTest = async (userId, showLoaderFlag = true) => { // Z main.js
        if (!userId || !supabaseClient) return null;
        // Použijeme správný loader key pro "create plan" kontext
        if (showLoaderFlag) setLoadingState('createPlan', true);
        try {
            const { data, error } = await supabaseClient.from('user_diagnostics').select('id, completed_at, total_score, total_questions, topic_results, analysis').eq('user_id', userId).order('completed_at', { ascending: false }).limit(1);
            if (error) throw error;
            const diagnosticData = (data && data.length > 0) ? data[0] : false;
            state.latestDiagnosticDataForPlan = diagnosticData; // Uložíme do stavu pro plán
            console.log("[getLatestDiagnosticTest for Plan] Fetched:", diagnosticData);
            return diagnosticData;
        } catch (error) {
            console.error("Error fetching diagnostic test for plan:", error);
            state.latestDiagnosticDataForPlan = null;
            return null;
        } finally {
            if (showLoaderFlag) setLoadingState('createPlan', false);
        }
    };
    const checkPlanCreationAvailability = async () => { // Z plan.js
        console.log("[CreateCheck] Starting check...");
        setLoadingState('createPlan', true);
        if(ui.createPlanContent) ui.createPlanContent.classList.remove('content-visible');
        try {
            console.log("[CreateCheck] Fetching latest diagnostic...");
            state.latestDiagnosticDataForPlan = await getLatestDiagnosticTest(state.currentUser.id, false);
            console.log("[CreateCheck] Diagnostic fetched:", state.latestDiagnosticDataForPlan);
            if (state.latestDiagnosticDataForPlan === null) { renderMessage(ui.createPlanContent, 'error', 'Chyba', 'Nepodařilo se ověřit váš diagnostický test.'); return; }
            else if (state.latestDiagnosticDataForPlan === false) { renderNoDiagnosticAvailable(ui.createPlanContent); return; }
            console.log("[CreateCheck] Checking cooldown...");
            const { data: latestPlan, error: planError } = await supabaseClient.from('study_plans').select('created_at').eq('user_id', state.currentUser.id).order('created_at', { ascending: false }).limit(1);
            if (planError) throw planError;
            console.log("[CreateCheck] Cooldown check - Latest plan:", latestPlan);
            let canCreate = true;
            if (latestPlan && latestPlan.length > 0) {
                const lastPlanDate = new Date(latestPlan[0].created_at);
                const cooldownDate = new Date(lastPlanDate);
                cooldownDate.setDate(cooldownDate.getDate() + PLAN_GENERATION_COOLDOWN_DAYS);
                console.log("[CreateCheck] Cooldown date:", cooldownDate, "Current date:", new Date());
                if (new Date() < cooldownDate) { canCreate = false; state.nextPlanCreateTime = cooldownDate; }
            }
            state.planCreateAllowed = canCreate;
            if (!ui.createPlanContent) { console.error("[CreateCheck] Error: createPlanContent container not found!"); showGlobalError("Chyba zobrazení: Chybí element pro vytvoření plánu."); return; }
            if (canCreate) { renderPlanCreationForm(ui.createPlanContent); }
            else { renderLockedPlanSection(ui.createPlanContent); }
        } catch (error) {
            console.error('[CreateCheck] Error checking plan creation availability:', error);
            if(ui.createPlanContent) renderMessage(ui.createPlanContent, 'error', 'Chyba', 'Nepodařilo se ověřit možnost vytvoření plánu.');
            else showGlobalError('Nepodařilo se ověřit možnost vytvoření plánu: ' + error.message);
        } finally {
            setLoadingState('createPlan', false);
            console.log("[CreateCheck] Check finished.");
        }
    };
    const renderNoDiagnosticAvailable = (container) => { // Z plan.js
        if (!container || !ui.noDiagnosticTemplate) return;
        console.log("[Render] Rendering No Diagnostic Available...");
        const node = ui.noDiagnosticTemplate.content.cloneNode(true);
        const btn = node.getElementById('goToTestBtn');
        if(btn) btn.onclick = () => window.location.href = '/dashboard/procvicovani/test1.html'; // Pevná cesta k testu
        container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible');
        console.log("[Render] No Diagnostic Available Rendered.");
    };
    const renderLockedPlanSection = (container) => { // Z plan.js
        if(!container || !ui.lockedPlanTemplate) return;
        console.log("[Render] Rendering Locked Plan Section...");
        const node = ui.lockedPlanTemplate.content.cloneNode(true);
        const timerEl = node.getElementById('nextPlanTimer');
        const viewBtn = node.getElementById('viewCurrentPlanBtnLocked');
        if(timerEl) updateNextPlanTimer(timerEl);
        if(viewBtn) viewBtn.addEventListener('click', () => handlePlanTabManagement('currentPlan')); // Přepne na záložku s aktivním plánem
        container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible');
        startPlanTimer();
        console.log("[Render] Locked Plan Section Rendered.");
    };
    const startPlanTimer = () => { // Z plan.js
        if (state.planTimerInterval) clearInterval(state.planTimerInterval);
        state.planTimerInterval = setInterval(() => {
            const timerEl = document.getElementById('nextPlanTimer'); // Musí být znovu nalezen, protože DOM se mění
            if (timerEl && document.body.contains(timerEl)) updateNextPlanTimer(timerEl);
            else clearInterval(state.planTimerInterval);
        }, 1000);
    };
    const updateNextPlanTimer = (el) => { // Z plan.js
        if (!state.nextPlanCreateTime || !el) return;
        const now = new Date(); const diff = state.nextPlanCreateTime - now;
        if (diff <= 0) { el.textContent = 'Nyní'; clearInterval(state.planTimerInterval); state.planCreateAllowed = true; if(state.currentMainTab === 'plan-tab-create') setTimeout(checkPlanCreationAvailability, 500); return; } // Používáme nový klíč pro tab
        const d = Math.floor(diff/(1000*60*60*24)), h = Math.floor((diff%(1000*60*60*24))/(1000*60*60)), m = Math.floor((diff%(1000*60*60))/(1000*60)), s = Math.floor((diff%(1000*60))/1000); el.textContent = `${d}d ${h}h ${m}m ${s}s`;
    };
    const renderPlanCreationForm = (container) => { // Z plan.js
        if (!container || !ui.createPlanFormTemplate || !state.latestDiagnosticDataForPlan) { console.error("[Render] Missing container, CreatePlan template, or diagnostic data for plan."); renderMessage(container, 'error', 'Chyba', 'Nelze zobrazit formulář pro vytvoření plánu.'); return; }
        console.log("[Render] Rendering Plan Creation Form...");
        const node = ui.createPlanFormTemplate.content.cloneNode(true);
        const diagInfo = node.getElementById('diagnosticInfo');
        if (diagInfo) { const score = state.latestDiagnosticDataForPlan.total_score ?? '-'; const totalQ = state.latestDiagnosticDataForPlan.total_questions ?? '-'; diagInfo.innerHTML = `<p>Plán bude vycházet z testu ze dne: <strong>${formatDate(state.latestDiagnosticDataForPlan.completed_at)}</strong> (Skóre: ${score}/${totalQ})</p>`; }
        else { console.warn("[Render] Diagnostic info element not found in template."); }
        const genBtnTemplate = node.querySelector('#generatePlanBtn');
        if (genBtnTemplate) {
            const genBtnId = 'generatePlanBtn_instance_' + Date.now(); // Unikátní ID
            genBtnTemplate.id = genBtnId;
            container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible');
            const actualGenBtn = document.getElementById(genBtnId);
            if (actualGenBtn) { actualGenBtn.addEventListener('click', handleGenerateClick); }
            else { console.error(`[Render] Failed to find #${genBtnId} in the DOM after appending!`); }
        } else { console.error("[Render] Button #generatePlanBtn NOT FOUND in template clone!"); container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); }
        console.log("[Render] Plan Creation Form Rendered function finished.");
    };
    const handleGenerateClick = function() { // Z plan.js
        if (state.isLoading.planGeneration) return;
        this.disabled = true; this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generuji plán...';
        generateStudyPlan();
    };
    const generateStudyPlan = async () => { // Z plan.js
        if (!state.latestDiagnosticDataForPlan || !state.currentUser) { showToast('Chybí data pro generování.', 'error'); return; }
        if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) { showToast('Chyba: Nastavte platný Gemini API klíč v kódu.', 'error'); return; }
        handlePlanTabManagement('planGeneration'); // Zobrazí správnou sekci
        setLoadingState('planGeneration', true);
        if (ui.planContent) { ui.planContent.innerHTML = ''; ui.planContent.classList.remove('content-visible', 'generated-reveal'); }
        if (ui.planActions) ui.planActions.style.display = 'none';
        if (ui.planSectionTitle) ui.planSectionTitle.textContent = 'Generování plánu...';
        if (ui.genericBackBtn) { ui.genericBackBtn.onclick = () => { state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; state.lastGeneratedTopicsData = null; handlePlanTabManagement('createPlan'); };} // Zpět na formulář pro vytvoření
        try {
            const topicsData = Object.entries(state.latestDiagnosticDataForPlan.topic_results || {}).map(([topicKey, data]) => ({ name: data.name || state.topicMap[topicKey] || `Téma ${topicKey}`, percentage: data.score_percent || data.score || 0 })).sort((a, b) => a.percentage - b.percentage); // Přidána data.score_percent
            state.lastGeneratedTopicsData = topicsData;
            const fullMarkdownResponse = await generatePlanContentWithGemini(state.latestDiagnosticDataForPlan, topicsData);
            const jsonRegex = /```json\s*([\s\S]*?)\s*```/; const jsonMatch = fullMarkdownResponse.match(jsonRegex);
            let activitiesArray = null; let planMarkdownForStorage = fullMarkdownResponse;
            if (jsonMatch && jsonMatch[1]) {
                try { activitiesArray = JSON.parse(jsonMatch[1].replace(/\u00A0/g, ' ').trim()); planMarkdownForStorage = fullMarkdownResponse.replace(jsonRegex, '').trim(); state.lastGeneratedActivitiesJson = activitiesArray; }
                catch (e) { console.error("Error parsing JSON activities:", e); showToast("Warning: Nepodařilo se zpracovat aktivity z plánu.", "warning"); state.lastGeneratedActivitiesJson = null; }
            } else { console.warn("JSON block of activities not found."); state.lastGeneratedActivitiesJson = null; }
            state.lastGeneratedMarkdown = planMarkdownForStorage;
            if(ui.planSectionTitle) ui.planSectionTitle.textContent = 'Návrh studijního plánu';
            setLoadingState('planGeneration', false);
            if(ui.planContent) {
                ui.planContent.classList.remove('generated-reveal');
                displayPlanContent(state.lastGeneratedMarkdown);
                requestAnimationFrame(() => { if (ui.planContent) { ui.planContent.classList.add('content-visible', 'generated-reveal');}});
            }
            renderPreviewActions();
            ui.planSection.scrollIntoView({ behavior: 'smooth' });
            initTooltips();
        } catch (error) {
            console.error('Plan generation error:', error);
            setLoadingState('planGeneration', false);
            if (ui.planContent) { renderMessage(ui.planContent, 'error', 'Chyba generování', error.message); ui.planContent.classList.add('content-visible'); }
            renderPreviewActions(true);
        }
    };
    const renderPreviewActions = (isError = false) => { // Z plan.js
        if (!ui.planActions) return;
        let buttonsHTML = '';
        if (isError) {
            buttonsHTML = `<button class="btn btn-secondary" id="regeneratePlanBtn"><i class="fas fa-sync-alt"></i> Vygenerovat znovu</button>`;
        } else {
            buttonsHTML = `
                <button class="btn btn-primary" id="saveGeneratedPlanBtn">
                    <i class="fas fa-save"></i> Uložit tento plán
                </button>
                <button class="btn btn-success btn-tooltip" id="exportGeneratedPlanBtn" title="Stáhnout návrh jako PDF">
                    <i class="fas fa-file-pdf"></i> Export PDF
                </button>
                <button class="btn btn-secondary" id="regeneratePlanBtn">
                    <i class="fas fa-sync-alt"></i> Vygenerovat znovu
                </button>`;
        }
        ui.planActions.innerHTML = buttonsHTML;
        const saveBtn = ui.planActions.querySelector('#saveGeneratedPlanBtn');
        const exportBtn = ui.planActions.querySelector('#exportGeneratedPlanBtn');
        const regenBtn = ui.planActions.querySelector('#regeneratePlanBtn');
        if (saveBtn) saveBtn.addEventListener('click', handleSaveGeneratedPlanClick);
        if (exportBtn) { const tempPlanData = { created_at: new Date(), plan_content_markdown: state.lastGeneratedMarkdown, title: "Nový návrh plánu" }; exportBtn.addEventListener('click', () => exportPlanToPDFWithStyle(tempPlanData));}
        if (regenBtn) { regenBtn.addEventListener('click', function() { if (state.isLoading.planGeneration) return; this.disabled = true; this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generuji znovu...'; generateStudyPlan(); }); }
        ui.planActions.style.display = 'flex';
        initTooltips();
    };
    const handleSaveGeneratedPlanClick = async function() { // Z plan.js
        if (!state.currentUser || !state.latestDiagnosticDataForPlan || !state.lastGeneratedMarkdown || !supabaseClient) { showToast('Chyba: Chybí data pro uložení.', 'error'); return; }
        const saveButton = this; saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...';
        const markdownContent = state.lastGeneratedMarkdown; const activitiesArray = state.lastGeneratedActivitiesJson; const topicsData = state.lastGeneratedTopicsData;
        const priorityTopics = {};
        if (topicsData && Array.isArray(topicsData)) { topicsData.forEach((topic, index) => { priorityTopics[topic.name] = { priority: index + 1, performance: topic.percentage, focus_level: topic.percentage < 50 ? 'high' : topic.percentage < 75 ? 'medium' : 'low' }; });}
        else { console.warn("Missing topicsData in state during save."); }
        let savedPlanId = null;
        try {
            const { error: deactivateError } = await supabaseClient.from('study_plans').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('user_id', state.currentUser.id).eq('status', 'active');
            if (deactivateError) throw deactivateError;
            const today = new Date(); const completionDate = new Date(today); completionDate.setDate(completionDate.getDate() + 7);
            const newPlanData = { user_id: state.currentUser.id, title: `Studijní plán (${formatDate(today)})`, subject: "Matematika", status: "active", diagnostic_id: state.latestDiagnosticDataForPlan.id, plan_content_markdown: markdownContent, priority_topics: priorityTopics, estimated_completion_date: completionDate.toISOString().split('T')[0], progress: 0, is_auto_adjusted: true };
            const { data: savedPlan, error: insertPlanError } = await supabaseClient.from('study_plans').insert(newPlanData).select('id').single();
            if (insertPlanError) throw insertPlanError;
            savedPlanId = savedPlan.id; console.log("Nový plán uložen, ID:", savedPlanId);
            if (activitiesArray && Array.isArray(activitiesArray) && activitiesArray.length > 0) {
                const activitiesToInsert = activitiesArray.map(act => { if (typeof act !== 'object' || act === null) return null; const dayOfWeek = typeof act.day_of_week === 'number' ? act.day_of_week : parseInt(act.day_of_week, 10); if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null; return { plan_id: savedPlanId, day_of_week: dayOfWeek, time_slot: act.time_slot || null, title: act.title || 'Nespecifikováno', description: act.description || null, type: act.type || getActivityTypeFromTitle(act.title), completed: false }; }).filter(item => item !== null);
                if (activitiesToInsert.length > 0) { const { error: insertActivitiesError } = await supabaseClient.from('plan_activities').insert(activitiesToInsert); if (insertActivitiesError) { console.error("Chyba vkládání aktivit:", insertActivitiesError); showToast('Plán uložen, ale aktivity pro harmonogram selhaly.', 'warning'); } else { console.log("Aktivity úspěšně vloženy."); showToast('Studijní plán a aktivity uloženy!', 'success'); }
                } else { showToast('Plán uložen, ale nebyly nalezeny platné aktivity v JSON.', 'warning'); }
            } else { showToast('Studijní plán uložen (bez detailních aktivit).', 'info'); }
             state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; state.lastGeneratedTopicsData = null;
            state.currentStudyPlan = { ...newPlanData, id: savedPlanId };
            handlePlanTabManagement('currentPlan'); // Přepne na zobrazení aktuálního plánu
        } catch (error) { console.error("Chyba při ukládání plánu:", error); showToast(`Nepodařilo se uložit plán: ${error.message}`, 'error'); if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Uložit tento plán'; } }
    };
    const generatePlanContentWithGemini = async (testData, topicsData) => { // Z plan.js
        const totalScore = testData.total_score ?? '-'; const totalQuestions = testData.total_questions ?? '-'; const analysis = testData.analysis || {}; const overallAssessment = analysis.summary?.overall_assessment || 'N/A'; const strengths = analysis.strengths?.map(s => `${s.topic} (${s.score_percent || s.score}%)`).join(', ') || 'Nebyly identifikovány'; const weaknesses = analysis.weaknesses?.map(w => `${w.topic} (${w.score_percent || w.score}%)`).join(', ') || 'Nebyly identifikovány'; const recommendations = analysis.recommendations?.join('\n- ') || 'Žádná specifická.'; // Používáme score_percent
        const prompt = `
Jsi expertní AI tutor specializující se na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v Česku. Tvým úkolem je vytvořit EXTRÉMNĚ DETAILNÍ, ZAMĚŘENÝ a STRUKTUROVANÝ týdenní studijní plán (Pondělí - Sobota, Neděle volno) v ČEŠTINĚ ve formátu Markdown. Cílem je hluboké porozumění a procvičení **JEDNOHO NEBO DVOU NEJSLABŠÍCH TÉMAT** týdně, nikoli povrchní pokrytí mnoha oblastí. Důraz klad na PRAKTICKÉ PŘÍKLADY a OPAKOVÁNÍ. Na konci MUSÍŠ vygenerovat JSON pole aktivit pro tento plán.
# Kontext: Student právě dokončil diagnostický test.
# Výsledky diagnostického testu:
- Celkové skóre: ${totalScore}/${totalQuestions} bodů
- Výsledky podle témat (Název tématu: Úspěšnost %):
${topicsData.map(topic => `  - ${topic.name}: ${topic.percentage}%`).join('\n')}
# Analýza výsledků testu (Shrnutí od AI):
- Celkové hodnocení: ${overallAssessment}
- Identifikované silné stránky: ${strengths}
- Identifikované slabé stránky: ${weaknesses}
- Doporučení na základě testu:
- ${recommendations}
# TVŮJ ÚKOL (Vytvoř VELMI PODROBNÝ a ZAMĚŘENÝ plán):
1.  **Výběr Téma/Témat:** Identifikuj **JEDNO, maximálně DVĚ nejslabší témata** studenta z poskytnutých výsledků (${weaknesses}). Celý týden se bude soustředit POUZE na tato vybraná témata.
2.  **Struktura Týdne (Po-So):** Vytvoř DETAILNÍ denní plán pro Pondělí až Sobotu. Neděle je volná.
3.  **Denní Rozvrh:** Rozděl studium každého dne (cca 60-90 minut) do 2-3 bloků s KONKRÉTNÍMI úkoly. Zaměř se na střídání:
    * **Teorie/Vysvětlení:** Krátké zopakování nebo vysvětlení **konkrétního pod-tématu**.
    * **Řešené Příklady:** Projití a analýza **několika (2-3)** řešených příkladů na dané pod-téma.
    * **Samostatné Procvičování:** Zadání **SPECIFICKÉHO počtu příkladů** k vyřešení. Buď VELMI KONKRÉTNÍ.
    * **Opakování:** Krátké opakování předchozího dne nebo týdne.
4.  **Sobota - Opakovací Test:** Na sobotu naplánuj **pouze JEDNU aktivitu**: "Opakovací test" zaměřený na témata probíraná během týdne.
5.  **DETAILNÍ Popis v Markdown:** V Markdown části pro každý den jasně popiš **CO** se má student učit a **JAKÉ KONKRÉTNÍ** úkoly má dělat. Používej správné Markdown formátování (nadpisy, odrážky, tučné písmo).
6.  **JSON Aktivity (KRITICKÉ!):** Na konci, v bloku \`\`\`json ... \`\`\`, vygeneruj pole JSON objektů. KAŽDÝ objekt reprezentuje JEDEN studijní blok. Každý objekt MUSÍ obsahovat:
    * \`"day_of_week"\`: Číslo dne (0=Po, ..., 5=So). Opraveno číslování na 0-5.
    * \`"title"\`: **VELMI SPECIFICKÝ název aktivity**.
    * \`"description"\`: **VELMI SPECIFICKÝ popis úkolu**. **NESMÍ obsahovat obecné fráze**.
    * \`"time_slot"\`: Odhadovaný čas bloku (např., "08:00 - 08:40" nebo "40 min").
    * \`"type"\`: Typ aktivity (např., "theory", "practice", "example", "test", "review").
7.  **KONZISTENCE JSON a Markdown:** Obsah JSON objektů musí PŘESNĚ odpovídat Markdown.
8.  **Rada pro Plán:** Na konci Markdown přidej krátkou radu.
# Požadovaný formát výstupu (Markdown + JSON na konci):
**Analýza diagnostiky:**
* Zaměření tento týden na: [Vybrané 1-2 nejslabší téma/témata]
---
### Pondělí
* **Fokus dne:** [Pod-téma 1]
* **Blok 1 (08:00 - 08:40): Teorie - [Název]:** ...
* **Blok 2 (08:45 - 09:25): Procvičování - [Název]:** ...
### Úterý
...
### Sobota
* **Fokus dne:** Týdenní opakování
* **Blok 1 (cca 60 min): Opakovací test:** Absolvujte test na témata: [Téma 1], [Téma 2].
---
**Rada pro práci s plánem:**
* Důsledně dodržujte časové bloky...
---
\`\`\`json
[
  { "day_of_week": 0, "type": "theory", "title": "Teorie - [Název z Po]", "description": "Popis úkolu...", "time_slot": "08:00 - 08:40" },
  { "day_of_week": 0, "type": "practice", "title": "Procvičování - [Název z Po]", "description": "Popis úkolu...", "time_slot": "08:45 - 09:25" },
  { "day_of_week": 5, "type": "test", "title": "Opakovací test týdne", "description": "Otestujte si znalosti z témat: [Téma 1], [Téma 2].", "time_slot": "60 min" }
]
\`\`\`
`;
        try {
            const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, topK: 30, topP: 0.9, maxOutputTokens: 8192 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ] }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || `Chyba Gemini API (${response.status})`);
            const geminiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!geminiResponse) { if (data.promptFeedback?.blockReason) throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}.`); const finishReason = data.candidates?.[0]?.finishReason; if(finishReason && finishReason !== 'STOP') throw new Error(`AI dokončilo s důvodem: ${finishReason}.`); throw new Error('Prázdná odpověď od Gemini API.'); }
            console.log("Gemini response received length:", geminiResponse.length); return geminiResponse;
        } catch (error) { console.error('Chyba při generování obsahu plánu:', error); throw error; }
    };
    const displayPlanContent = (markdownContent) => { // Z plan.js
        if (!ui.planContent) return;
        try {
            marked.setOptions({ gfm: true, breaks: true, sanitize: false }); // Používáme globální `marked`
            const htmlContent = marked.parse(markdownContent || '');
            ui.planContent.innerHTML = htmlContent;
            if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { setTimeout(() => { window.MathJax.typesetPromise([ui.planContent]).catch(e => console.error("MathJax error:", e)); }, 0); }
        } catch (e) { console.error("Markdown rendering error:", e); if(ui.planContent) { renderMessage(ui.planContent, 'error', 'Chyba zobrazení plánu', e.message); ui.planContent.classList.add('content-visible'); }}
    };
    const getActivityTypeFromTitle = (title = "") => { // Z plan.js
        const lower = title.toLowerCase(); if (lower.includes('test')) return 'test'; if (lower.includes('procvičování') || lower.includes('příklad')) return 'practice'; if (lower.includes('řešené')) return 'example'; if (lower.includes('cvičení')) return 'exercise'; if (lower.includes('lekce') || lower.includes('teorie') || lower.includes('vysvětlení')) return 'theory'; if (lower.includes('opakování') || lower.includes('shrnutí')) return 'review'; if (lower.includes('analýza')) return 'analysis'; return 'other';
    };
    const exportPlanToPDFWithStyle = async (plan) => { // Z plan.js
        if (!plan) return;
        if (!plan.plan_content_markdown && plan.id) {
            showToast('Načítám data pro PDF...', 'info', 2000);
            try { const { data: fullPlanData, error } = await supabaseClient.from('study_plans').select('plan_content_markdown, title, created_at, estimated_completion_date').eq('id', plan.id).single(); if (error) throw error; plan = { ...plan, ...fullPlanData }; }
            catch (fetchError) { console.error("Nepodařilo se načíst markdown pro export:", fetchError); showToast('Chyba: Nepodařilo se načíst data pro export.', 'error'); return; }
        } else if (!plan.plan_content_markdown) { showToast('Chyba: Chybí obsah plánu pro export.', 'error'); return; }
        const exportContainer = document.createElement('div'); exportContainer.id = 'pdf-export-content';
        const pdfStyles = `
        <style>
            body { font-family: 'Poppins', Arial, sans-serif; font-size: 10pt; color: #333; line-height: 1.5; }
            #pdf-export-content { padding: 18mm 13mm; }
            .pdf-header { text-align: center; margin-bottom: 12mm; border-bottom: 1px solid #ccc; padding-bottom: 4mm; }
            .pdf-header h1 { color: #4361ee; font-size: 18pt; margin: 0 0 4px 0; font-weight: 600; }
            .pdf-header p { color: #6c757d; font-size: 9pt; margin: 0; }
            .student-info { background-color: #f8f9fa; padding: 8mm 10mm; border-radius: 8px; border: 1px solid #eee; margin-bottom: 10mm; font-size: 9pt; break-inside: avoid; }
            .student-info h2 { color: #3f37c9; font-size: 12pt; margin: 0 0 6px 0; padding-bottom: 3px; border-bottom: 1px dotted #ccc; font-weight: 600;}
            .student-info p { margin: 0 0 3px 0; line-height: 1.4; }
            .student-info strong { font-weight: 600; color: #1e2a3a; }
            .pdf-content h2, .pdf-content h3, .pdf-content h4 { margin-top: 7mm; margin-bottom: 3mm; padding-bottom: 2px; font-weight: 600; break-after: avoid; }
            .pdf-content h2 { font-size: 13pt; color: #3f37c9; border-bottom: 1px solid #eee; }
            .pdf-content h3 { font-size: 11.5pt; color: #1e2a3a; border-bottom: 1px dotted #ccc; }
            .pdf-content h4 { font-size: 10.5pt; color: #4361ee; border-bottom: none; margin-top: 5mm; }
            .pdf-content p, .pdf-content li { margin-bottom: 2.5mm; color: #333; text-align: left; }
            .pdf-content ul, .pdf-content ol { padding-left: 5mm; margin-left: 3mm; margin-bottom: 4mm; break-inside: avoid;}
            .pdf-content li { margin-bottom: 1.5mm; }
            .pdf-content strong { font-weight: 600; color: #000; }
            .pdf-content em { font-style: italic; color: #555; }
            .pdf-content code { font-family: 'Courier New', Courier, monospace; background-color: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 9pt; color: #c7254e; }
            .pdf-content pre { background-color: #f8f9fa; border: 1px solid #eee; padding: 3mm; margin: 4mm 0; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word; font-size: 9pt; break-inside: avoid; }
            .pdf-content blockquote { border-left: 3px solid #ccc; padding-left: 4mm; margin: 4mm 0 4mm 2mm; color: #555; font-style: italic; break-inside: avoid; }
            .pdf-content hr { border: none; border-top: 1px dashed #ccc; margin: 6mm 0; }
            .pdf-day-block { break-before: auto; break-inside: avoid; }
            .pdf-footer { text-align: center; margin-top: 10mm; padding-top: 5mm; border-top: 1px solid #ccc; color: #888; font-size: 8pt; }
        </style>`;
        exportContainer.innerHTML += pdfStyles;
        const pdfTitle = plan.title ? plan.title.replace(/\s*\(\d{2}\.\d{2}\.\d{4}\)$/, '').trim() : 'Studijní plán';
        exportContainer.innerHTML += `<div class="pdf-header"><h1>${sanitizeHTML(pdfTitle)}</h1><p>Vytvořeno: ${formatDate(plan.created_at)}</p></div>`;
        if (state.currentUser && ui.sidebarName?.textContent) { exportContainer.innerHTML += `<div class="student-info"><h2>Informace o studentovi</h2><p><strong>Student:</strong> ${ui.sidebarName.textContent}</p><p><strong>Datum vytvoření plánu:</strong> ${formatDate(plan.created_at)}</p>${plan.estimated_completion_date ? `<p><strong>Předpokládané dokončení:</strong> ${formatDate(plan.estimated_completion_date)}</p>` : ''}</div>`;}
        const contentDiv = document.createElement('div'); contentDiv.className = 'pdf-content';
        try { const rawHtml = marked.parse(plan.plan_content_markdown || ''); contentDiv.innerHTML = rawHtml; const daysCzech = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle']; contentDiv.querySelectorAll('h3').forEach(h3 => { if (daysCzech.some(day => h3.textContent.trim().startsWith(day))) { h3.classList.add('pdf-day-block'); }}); }
        catch (e) { contentDiv.innerHTML = '<p>Chyba při zpracování obsahu plánu.</p>'; }
        exportContainer.appendChild(contentDiv); exportContainer.innerHTML += `<div class="pdf-footer">&copy; ${new Date().getFullYear()} Justax.space</div>`;
        const options = { margin: [18, 13, 18, 13], filename: `studijni-plan-${formatDate(plan.created_at).replace(/\./g, '-')}.pdf`, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'avoid-all'] }};
        if (typeof html2pdf === 'function') { showToast('Generuji PDF...', 'info', 5000); html2pdf().set(options).from(exportContainer).save().then(() => { showToast('PDF bylo úspěšně vygenerováno!', 'success'); }).catch(err => { console.error("Chyba exportu PDF:", err); showToast('Nepodařilo se exportovat PDF.', 'error'); }); }
        else { showToast('Chyba: Knihovna pro export PDF není načtena.', 'error'); }
    };

    // ==============================================
    //          Core Application Logic (for main.html)
    // ==============================================

    async function fetchUserStats(userId, profileData) { // Z main.js
        if (!supabaseClient || !userId || !profileData) { console.error("[Stats] Chybí Supabase klient, ID uživatele nebo data profilu pro fetchUserStats."); return { progress: 0, progress_weekly: 0, points: profileData?.points ?? 0, points_weekly: 0, streak_current: profileData?.streak_days ?? 0, longest_streak_days: profileData?.longest_streak_days ?? 0, completed_exercises: profileData?.completed_exercises ?? 0, completed_tests: 0, }; }
        console.log(`[Stats] Načítání user_stats pro uživatele ${userId}...`);
        try {
            const { data, error } = await supabaseClient.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle();
            if (error) { console.warn("[Stats] Supabase chyba při načítání user_stats:", error.message); return { progress: profileData.progress ?? 0, progress_weekly: 0, points: profileData.points ?? 0, points_weekly: 0, streak_current: profileData.streak_days ?? 0, longest_streak_days: profileData.longest_streak_days ?? 0, completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests_count ?? 0, }; }
            const finalStats = { progress: data?.progress ?? profileData.progress ?? 0, progress_weekly: data?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: data?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, longest_streak_days: profileData.longest_streak_days ?? data?.streak_longest ?? 0, completed_exercises: profileData.completed_exercises ?? 0, completed_tests: data?.completed_tests ?? profileData.completed_tests_count ?? 0, };
            console.log("[Stats] Statistiky úspěšně načteny/sestaveny:", finalStats); return finalStats;
        } catch (error) { console.error("[Stats] Neočekávaná chyba při načítání user_stats:", error); return { progress: profileData.progress ?? 0, progress_weekly: 0, points: profileData.points ?? 0, points_weekly: 0, streak_current: profileData.streak_days ?? 0, longest_streak_days: profileData.longest_streak_days ?? 0, completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests_count ?? 0, }; }
    }

    async function loadDashboardStats() { // Z main.js
        if (!state.currentUser || !supabaseClient || !state.currentProfile) { console.warn("[LoadStats] Chybí uživatel, Supabase klient nebo profil pro načtení statistik."); renderStatsCards(null); return; }
        setLoadingState('stats', true);
        try { userStatsData = await fetchUserStats(state.currentUser.id, state.currentProfile); renderStatsCards(userStatsData); }
        catch (error) { console.error("Error in loadDashboardStats:", error); renderStatsCards(null); }
        // setLoadingState('stats', false); // Řešeno v toggleSkeletonUI
    }

    function renderStatsCards(statsData) { // Z main.js
        console.log("[UI Update] Aktualizace karet statistik pro procvicovani/main.html:", statsData);
        const profile = state.currentProfile;
        if (!profile) { console.warn("[UI Update Stats] Chybí data profilu, nelze aktualizovat karty."); if(ui.dashboardLevelWidget) ui.dashboardLevelWidget.textContent = '-'; if(ui.totalPointsValue) { ui.totalPointsValue.innerHTML = `- <span id="latest-credit-change" style="font-size: 0.5em; color: var(--text-medium); vertical-align: middle; margin-left: 0.5em; display: none;"></span>`; } if(ui.streakValue) ui.streakValue.textContent = '-'; if(ui.totalPointsFooter) ui.totalPointsFooter.innerHTML = `<i class="fas fa-minus"></i> Data nedostupná`; if(ui.streakFooter) ui.streakFooter.innerHTML = `MAX: - dní`; [ui.progressCard, ui.pointsCard, ui.streakCard].forEach(card => { if (card) { setCardContentVisibility(card, false); }}); return; }
        updateWelcomeBannerAndLevel(profile);
        if (ui.totalPointsValue) { ui.totalPointsValue.textContent = `${profile.points ?? 0} `; const latestCreditSpan = ui.latestCreditChange || document.getElementById('latest-credit-change'); if (latestCreditSpan) { const latestTx = fetchAndDisplayLatestCreditChange.latestTxData; if (latestTx && latestTx.amount !== undefined) { const amount = latestTx.amount; const description = latestTx.description || 'N/A'; const sign = amount > 0 ? '+' : (amount < 0 ? '' : ''); const colorClass = amount > 0 ? 'positive' : (amount < 0 ? 'negative' : 'neutral'); let displayDescription = description; const maxDescLengthFooter = 20; if (displayDescription.length > maxDescLengthFooter) { displayDescription = displayDescription.substring(0, maxDescLengthFooter - 3) + "..."; } latestCreditSpan.innerHTML = `(<span class="${colorClass}" title="${sanitizeHTML(description)}">${sign}${amount}</span>)`; latestCreditSpan.style.display = 'inline'; } else { latestCreditSpan.style.display = 'none'; } } }
        if (ui.totalPointsFooter) { const weeklyPoints = statsData?.points_weekly ?? 0; ui.totalPointsFooter.classList.remove('positive', 'negative'); if (weeklyPoints !== 0 && weeklyPoints != null) { ui.totalPointsFooter.innerHTML = weeklyPoints > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyPoints} týdně` : `<i class="fas fa-arrow-down"></i> ${weeklyPoints} týdně`; if (weeklyPoints > 0) ui.totalPointsFooter.classList.add('positive'); else ui.totalPointsFooter.classList.add('negative'); } else { ui.totalPointsFooter.innerHTML = `<i class="fas fa-minus"></i> Žádná změna bodů`; } }
        if (ui.streakValue) { ui.streakValue.textContent = profile.streak_days ?? 0; }
        if (ui.streakFooter) { ui.streakFooter.innerHTML = `MAX: ${profile.longest_streak_days ?? 0} dní`; }
        [ui.progressCard, ui.pointsCard, ui.streakCard].forEach(card => { if (card) { card.classList.remove('loading'); setCardContentVisibility(card, true); }});
        console.log("[UI Update] Karty statistik aktualizovány pro procvicovani/main.html.");
    }


    function updateWelcomeBannerAndLevel(profile) { // Z main.js
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

    async function loadTopicProgress() { // Z main.js
        if (!state.currentUser || !supabaseClient) return;
        setLoadingState('topicProgress', true);
        try {
            const { data, error } = await supabaseClient.rpc('get_user_topic_progress_summary', { p_user_id: state.currentUser.id });
            if (error) { let errorMessage = error.message; const errString = JSON.stringify(error); if (errString.includes('structure of query does not match function result type') || (error.code && ['PGRST200', '42883', '42703'].includes(error.code))) { errorMessage = 'Chyba: Funkce pro načtení pokroku v tématech (get_user_topic_progress_summary) má nesprávnou definici, neexistuje na serveru, nebo vrací nesprávné sloupce. Zkontrolujte SQL definici funkce, její návratové typy a SELECT část.'; } else if (error.status === 404 || (error.message && error.message.includes('404')) || errString.includes('"status":404')){ errorMessage = 'Chyba: Požadovaná funkce (get_user_topic_progress_summary) pro načtení pokroku v tématech nebyla nalezena na serveru (404). Ověřte prosím, že je SQL funkce správně vytvořena a nasazena.';} throw new Error(errorMessage); }
            renderTopicProgressTable(data || []);
        } catch (error) { console.error("Error loading topic progress via RPC:", error); if(ui.topicProgressTable) ui.topicProgressTable.style.display = 'none'; if(ui.topicProgressEmptyState) { ui.topicProgressEmptyState.innerHTML = `<i class="fas fa-exclamation-triangle"></i><h3>Chyba načítání</h3><p>${sanitizeHTML(error.message)}</p>`; ui.topicProgressEmptyState.style.display = 'flex'; }}
        finally { setLoadingState('topicProgress', false); }
    }
    function renderTopicProgressTable(topics) { // Z main.js
        if (!ui.topicProgressTableBody || !ui.topicProgressTable || !ui.topicProgressEmptyState) return;
        ui.topicProgressTableBody.innerHTML = '';
        if (!topics || topics.length === 0) { ui.topicProgressTable.style.display = 'none'; ui.topicProgressEmptyState.innerHTML = '<i class="fas fa-book-reader"></i><h3>Žádná data o pokroku</h3><p>Zatím nemáte zaznamenaný žádný pokrok v tématech. Začněte procvičovat!</p>'; ui.topicProgressEmptyState.style.display = 'flex'; return; }
        ui.topicProgressTable.style.display = 'table'; ui.topicProgressEmptyState.style.display = 'none';
        topics.sort((a,b) => (new Date(b.last_studied_at || 0)) - (new Date(a.last_studied_at || 0)));
        topics.forEach(topic => { const row = ui.topicProgressTableBody.insertRow(); const progress = Math.round(topic.progress_percentage || 0); let progressColor = 'var(--accent-primary)'; if (progress >= 75) progressColor = 'var(--accent-lime)'; else if (progress < 40) progressColor = 'var(--accent-pink)'; row.innerHTML = `<td><i class="fas ${topic.topic_icon || 'fa-question-circle'}" style="margin-right: 0.7em; color: ${progressColor};"></i>${sanitizeHTML(topic.topic_name)}</td><td><div class="progress-bar-cell"><div class="progress-bar-track"><div class="progress-bar-fill" style="width: ${progress}%; background: ${progressColor};"></div></div><span class="progress-bar-text" style="color: ${progressColor};">${progress}%</span></div></td><td>${topic.last_studied_at ? formatDate(topic.last_studied_at) : '-'}</td>`; });
    }
    function handleSort(event) { const th = event.currentTarget; const column = th.dataset.sort; console.log("Sorting by:", column); showToast("Řazení tabulky", "Funkce řazení bude brzy implementována.", "info");} // Z main.js

    async function switchTabContent(tabId) { // Kombinovaná a upravená logika
        console.log(`[Main Tab Switch] Pokus o přepnutí na záložku: ${tabId}`);
        state.currentMainTab = tabId;

        ui.contentTabs.forEach(tab => {
            const isCurrentTab = tab.dataset.tab === tabId;
            tab.classList.toggle('active', isCurrentTab);
            tab.setAttribute('aria-selected', isCurrentTab ? 'true' : 'false');
        });

        // Skryjeme všechny hlavní obsahové oblasti
        if(ui.practiceTabContent) ui.practiceTabContent.style.display = 'none';
        if(ui.planTabContent) ui.planTabContent.style.display = 'none'; // Používáme nové ID
        if(ui.vyukaTabContent) ui.vyukaTabContent.style.display = 'none';

        // Skryjeme specifické sekce plánu, pokud nejsou aktivní
        [ui.currentPlanSection, ui.historyPlanSection, ui.createPlanSection, ui.planSection].forEach(section => {
            if (section) section.classList.remove('visible-section');
        });


        let targetElement = null;
        if (tabId === 'practice-tab') {
            targetElement = ui.practiceTabContent;
            if(targetElement) targetElement.style.display = 'block'; // Nebo 'flex' dle potřeby
            await loadDashboardStats();
            await loadTopicProgress();
            if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderAll === 'function' && state.currentUser) {
                 await DashboardLists.loadAndRenderAll(state.currentUser.id, 5);
            }
        } else if (tabId === 'plan-tab') { // Nová záložka pro plán
            targetElement = ui.planTabContent;
            if(targetElement) targetElement.style.display = 'block';
            // Zde se rozhodne, která podsekce plánu se zobrazí (current, history, create)
            // Prozatím zavoláme logiku, která byla v plan.js pro `switchTab('current')`
            await handlePlanTabManagement('currentPlan'); // Výchozí podzáložka pro Plán
        } else if (tabId === 'vyuka-tab') {
            targetElement = ui.vyukaTabContent;
            if(targetElement) targetElement.style.display = 'block';
            console.log("[Main Tab Switch] Výuka tab activated. Placeholder for future content loading.");
            // Zde by se načítal obsah pro záložku Výuka, pokud by existoval
        } else {
            console.warn(`[Main Tab Switch] Unknown tabId: ${tabId}`);
            return;
        }

        if (targetElement) {
            // Pokud se jedná o .tab-content, přidáme třídu active
            if (targetElement.classList.contains('tab-content')) {
                targetElement.classList.add('active');
            }
            console.log(`[Main Tab Switch] Activated element: #${targetElement.id}`);
        }
        if (ui.mainTabContentArea) {
            ui.mainTabContentArea.style.display = 'flex'; // Zajištění viditelnosti rodiče
            ui.mainTabContentArea.classList.add('visible');
        }
    }

    async function handlePlanTabManagement(planSubTabId) { // Nová funkce pro správu podzáložek plánu
        if (!supabaseClient) { showGlobalError("Aplikace není správně inicializována."); return; }
        console.log(`[Plan SubTab] Switching to plan sub-tab: ${planSubTabId}`);

        // Skryjeme všechny sekce plánu
        [ui.currentPlanSection, ui.historyPlanSection, ui.createPlanSection, ui.planSection].forEach(section => {
            if (section) section.classList.remove('visible-section');
        });

        // Odstranění předchozího obsahu, pokud existuje
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
            switch(planSubTabId) {
                case 'currentPlan': targetSectionElement = ui.currentPlanSection; break;
                case 'historyPlan': targetSectionElement = ui.historyPlanSection; break;
                case 'createPlan': targetSectionElement = ui.createPlanSection; break;
                case 'planDetail': targetSectionElement = ui.planSection; break; // Pro zobrazení detailu konkrétního plánu
                case 'planGeneration': targetSectionElement = ui.planSection; break; // Pro zobrazení generovaného návrhu
                default: console.warn(`[Plan SubTab] Unknown plan sub-tab ID: ${planSubTabId}`); return;
            }
            if (targetSectionElement) {
                targetSectionElement.classList.add('visible-section');
                if (planSubTabId === 'currentPlan') await loadCurrentPlan(); // Volá loadCurrentPlan z plan.js
                else if (planSubTabId === 'historyPlan') await loadPlanHistory(); // Volá loadPlanHistory z plan.js
                else if (planSubTabId === 'createPlan') await checkPlanCreationAvailability(); // Volá checkPlanCreationAvailability z plan.js
                // 'planDetail' a 'planGeneration' se řeší specifickými funkcemi (showPlanDetail, generateStudyPlan)
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
            setLoadingState(planSubTabId, false); // Používáme klíče z isLoading stavu
        }
    }


    async function getLatestDiagnosticTest(userId, showLoaderFlag = true) { // Z main.js
        if (!userId || !supabaseClient) return null;
        if (showLoaderFlag && state.currentMainTab === 'practice-tab') setLoadingState('page', true); // Pouze pokud jsme na záložce "Obecné"
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

    async function checkUserInitialSetup(userId) { // Z main.js
        console.log("[InitialSetupCheck] Checking setup for user:", userId);
        if (!state.currentProfile) { console.warn("[InitialSetupCheck] Profile not loaded, cannot check setup."); return { completedGoalSetting: false, completedDiagnostic: false }; }
        const completedGoalSetting = !!state.currentProfile.learning_goal;
        let completedDiagnostic = false;
        // Diagnostický test je relevantní pouze pro určité cíle. Pro 'math_explore' není potřeba.
        if (completedGoalSetting && state.currentProfile.learning_goal !== 'math_explore') {
            const diagnostic = await getLatestDiagnosticTest(userId, false); // Nepotřebujeme globální loader
            completedDiagnostic = !!(diagnostic && diagnostic.completed_at);
        } else if (completedGoalSetting && state.currentProfile.learning_goal === 'math_explore') {
            completedDiagnostic = true; // Prozkoumávání nevyžaduje test
        }
        console.log(`[InitialSetupCheck] Goal set: ${completedGoalSetting}, Diagnostic done (for current goal type): ${completedDiagnostic}`);
        return { completedGoalSetting, completedDiagnostic };
    }

    function showGoalSelectionModal() { // Z main.js
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

    function hideGoalSelectionModal() { if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; } // Z main.js

    function handleGoalSelection(event) { // Z main.js
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

    async function loadTopicsForGradeReview() { // Z main.js
        if (!state.allExamTopicsAndSubtopics || state.allExamTopicsAndSubtopics.length === 0) {
            try { const { data, error } = await supabaseClient.from('exam_topics').select(`id, name, subtopics:exam_subtopics (id, name, topic_id)`).order('id'); if (error) throw error; state.allExamTopicsAndSubtopics = data || []; }
            catch (e) { console.error("Failed to load topics for review:", e); if (ui.topicRatingsContainer) ui.topicRatingsContainer.innerHTML = '<p class="error-message">Nepodařilo se načíst témata.</p>'; return; }
        }
        populateTopicRatings();
    }

    function populateTopicRatings() { // Z main.js
        if (!ui.topicRatingsContainer) return; ui.topicRatingsContainer.innerHTML = '';
        if (!state.allExamTopicsAndSubtopics || state.allExamTopicsAndSubtopics.length === 0) { ui.topicRatingsContainer.innerHTML = '<p>Žádná témata k hodnocení.</p>'; return; }
        state.allExamTopicsAndSubtopics.filter(topic => topic.name !== "Smíšené úlohy").forEach(topic => { const item = document.createElement('div'); item.className = 'topic-rating-item'; item.innerHTML = `<span class="topic-name">${sanitizeHTML(topic.name)}</span><div class="rating-stars" data-topic-id="${topic.id}">${[1,2,3,4,5].map(val => `<i class="fas fa-star star" data-value="${val}" aria-label="${val} hvězdiček"></i>`).join('')}</div>`; item.querySelectorAll('.star').forEach(star => { star.addEventListener('click', function() { const value = parseInt(this.dataset.value); const parentStars = this.parentElement; parentStars.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('rated', i < value)); parentStars.dataset.currentRating = value; }); }); ui.topicRatingsContainer.appendChild(item); });
    }

    async function saveLearningGoal(goal, details = {}) { // Z main.js
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
            if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');} // Použijeme flex pro rodiče
            await switchTabContent('practice-tab'); // Výchozí po nastavení cíle
        } catch (error) { console.error("Error saving learning goal:", error); showToast("Chyba ukládání", `Nepodařilo se uložit cíl: ${error.message}`, "error");
        } finally { setLoadingState('goalModal', false); }
    }

    function showDiagnosticPrompt() { if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'flex'; if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');} if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');} } // Z main.js

    function getGoalDisplayName(goalKey) { const goalMap = { 'exam_prep': 'Příprava na přijímačky', 'math_accelerate': 'Učení napřed', 'math_review': 'Doplnění mezer', 'math_explore': 'Volné prozkoumávání', }; return goalMap[goalKey] || goalKey || 'Neznámý cíl'; } // Z main.js

    function updateUserGoalDisplay() { if (ui.userGoalDisplay && state.currentProfile && state.currentProfile.learning_goal) { ui.userGoalDisplay.innerHTML = `<i class="fas fa-bullseye"></i> Cíl: <strong>${getGoalDisplayName(state.currentProfile.learning_goal)}</strong>`; ui.userGoalDisplay.style.display = 'inline-flex'; } else if (ui.userGoalDisplay) { ui.userGoalDisplay.style.display = 'none'; } } // Z main.js

    // ==============================================
    //          Event Listeners Setup
    // ==============================================
    function setupEventListeners() {
        console.log("[SETUP Main] Setting up event listeners for main.html...");
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        else console.warn("Main mobile menu toggle button (#main-mobile-menu-toggle) not found.");

        if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);
        else console.warn("Sidebar toggle button (#sidebar-toggle-btn) not found.");

        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);

        // Event listenery pro hlavní záložky (Obecné, Plán, Výuka)
        if (ui.contentTabs && ui.contentTabs.length > 0) {
            ui.contentTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    switchTabContent(tab.dataset.tab); // Volá novou funkci pro přepínání hlavních záložek
                });
            });
        } else { console.warn("Main HTML page tabs (#tabs-wrapper .plan-tab) not found."); }

        // Event listenery pro Plán (z plan.js)
        if (ui.prevDayBtn) ui.prevDayBtn.addEventListener('click', () => { if (state.currentDisplayDate && state.sortedActivityDates.length > 0) { const currentIndex = state.sortedActivityDates.indexOf(state.currentDisplayDate); if (currentIndex > 0) { state.currentDisplayDate = state.sortedActivityDates[currentIndex - 1]; renderSingleDayPlan(state.currentDisplayDate); } } });
        if (ui.nextDayBtn) ui.nextDayBtn.addEventListener('click', () => { if (state.currentDisplayDate && state.sortedActivityDates.length > 0) { const currentIndex = state.sortedActivityDates.indexOf(state.currentDisplayDate); if (currentIndex < state.sortedActivityDates.length - 1) { state.currentDisplayDate = state.sortedActivityDates[currentIndex + 1]; renderSingleDayPlan(state.currentDisplayDate); } } });
        if (ui.genericBackBtn) { // Toto tlačítko je pro detail/návrh plánu
            ui.genericBackBtn.addEventListener('click', () => {
                 state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; state.lastGeneratedTopicsData = null;
                 handlePlanTabManagement('historyPlan'); // Nebo na 'createPlan' pokud to dává větší smysl
            });
        }


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
        document.addEventListener('click', (event) => { // Zavření notifikací kliknutím mimo
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
                } else if (state.currentMainTab === 'plan-tab') { // Aktualizovaný název záložky
                    await loadCurrentPlan(); // Volání funkce pro načtení plánu
                }
                setLoadingState('all', false);
                showToast("Data obnovena!", "success");
            });
        }

        ui.goalRadioLabels.forEach(label => label.addEventListener('click', handleGoalSelection));
        ui.goalModalBackBtns.forEach(btn => { btn.addEventListener('click', () => { const targetStepId = btn.dataset.targetStep; ui.goalModalSteps.forEach(step => step.classList.remove('active')); document.getElementById(targetStepId)?.classList.add('active'); }); });
        ui.goalModalConfirmBtns.forEach(btn => { btn.addEventListener('click', () => { const goal = btn.dataset.goal; let details = { goal_set_timestamp: new Date().toISOString() }; if (goal === 'math_accelerate') { details.grade = ui.accelerateGradeSelect.value; details.intensity = ui.accelerateIntensitySelect.value; details.accelerate_areas = Array.from(ui.accelerateAreasCheckboxes).filter(cb => cb.checked).map(cb => cb.value); details.accelerate_reason = document.querySelector('input[name="accelerate_reason"]:checked')?.value; if(details.accelerate_reason === 'professional_needs' && ui.accelerateProfessionTextarea) { details.profession = ui.accelerateProfessionTextarea.value; }} else if (goal === 'math_review') { details.grade = ui.reviewGradeSelect.value; details.topic_ratings = {}; if (ui.topicRatingsContainer) { ui.topicRatingsContainer.querySelectorAll('.rating-stars').forEach(rs => { const topicId = rs.dataset.topicId; const rating = rs.dataset.currentRating; if (topicId && rating) { details.topic_ratings[topicId] = { overall: parseInt(rating) }; }}); }} else if (goal === 'math_explore') { details.grade = ui.exploreGradeSelect.value; } saveLearningGoal(goal, details); }); });
        const profNeedsRadio = document.querySelector('input[name="accelerate_reason"][value="professional_needs"]');
        if(profNeedsRadio) { profNeedsRadio.addEventListener('change', (e) => { if (ui.accelerateProfessionGroup) ui.accelerateProfessionGroup.style.display = e.target.checked ? 'block' : 'none'; });}

        if (ui.startTestBtnPrompt) { ui.startTestBtnPrompt.addEventListener('click', () => { window.location.href = 'test1.html'; }); }
        console.log("✅ [SETUP Main] Event listeners set up for main.html.");
    }

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
        } catch (error) { console.error("❌ [Init Main] Critical initialization error:", error); if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). Obnovte.</p>`; } else { showGlobalError(`Chyba inicializace: ${error.message}`, true); } if(ui.mainContent) ui.mainContent.style.display = 'flex'; // Změněno na flex pro konzistenci s úspěšným načtením
        } finally { setLoadingState('page', false); }
    }

    document.addEventListener('DOMContentLoaded', initializeApp);

})();

// Seznam funkcí v dashboard/procvicovani/main.js:
// cacheDOMElements, formatDateForDisplay, getTodayDateString, dateToYYYYMMDD, addDaysToDate, formatDate, showToast, sanitizeHTML, getInitials, openMenu, closeMenu, initTooltips, showGlobalError, hideGlobalError, formatRelativeTime, updateCopyrightYear, initMouseFollower, initScrollAnimations, initHeaderScrollDetection, updateOnlineStatus, applyInitialSidebarState, toggleSidebar, setCardContentVisibility, toggleSkeletonUI, setLoadingState, renderMessage, initializeSupabase, fetchUserProfile, fetchTitles, updateSidebarProfile, fetchNotifications, renderNotifications, renderNotificationSkeletons, markNotificationRead, markAllNotificationsRead, groupActivitiesByDayAndDateArray, loadCurrentPlan, renderSingleDayPlan, updateNavigationButtonsState, renderPromptCreatePlan, renderNoActivePlan, handleActivityCompletionToggle, updatePlanProgress, getActivityIcon, loadPlanHistory, renderPlanHistory, renderHistorySkeletons, showPlanDetail, getLatestDiagnosticTest, checkPlanCreationAvailability, renderNoDiagnosticAvailable, renderLockedPlanSection, startPlanTimer, updateNextPlanTimer, renderPlanCreationForm, handleGenerateClick, generateStudyPlan, renderPreviewActions, handleSaveGeneratedPlanClick, generatePlanContentWithGemini, displayPlanContent, getActivityTypeFromTitle, exportPlanToPDFWithStyle, fetchUserStats, loadDashboardStats, renderStatsCards, updateWelcomeBannerAndLevel, loadTopicProgress, renderTopicProgressTable, handleSort, switchTabContent, handlePlanTabManagement, checkUserInitialSetup, showGoalSelectionModal, hideGoalSelectionModal, handleGoalSelection, loadTopicsForGradeReview, populateTopicRatings, saveLearningGoal, showDiagnosticPrompt, getGoalDisplayName, updateUserGoalDisplay, setupEventListeners, initializeApp