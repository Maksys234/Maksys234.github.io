// procvicovani/main.js
// This script is intended for procvicovani/main.html (Přehled Procvičování)
// It includes logic for the main overview, stats, shortcuts, topic progress,
// and also incorporates functions for displaying the current study plan (carousel)
// and managing goal settings, similar to plan.js but integrated for main.html's context.
// VERZE (USER REQUEST): Scroll fix, Plan display fix, Tab style already handled in CSS.

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
    const PLAN_GENERATION_COOLDOWN_DAYS = 7; // Cooldown for generating a new plan
    const NOTIFICATION_FETCH_LIMIT = 5;
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState'; // localStorage key for sidebar state

    // ==============================================
    //          DOM Элементы (Кэш)
    // ==============================================
    const ui = {
        initialLoader: document.getElementById('initial-loader'),
        mainContent: document.getElementById('main-content'), // This is the main scrolling container <main>
        mainContentWrapper: document.querySelector('.main-content-wrapper'), // This is the direct child that should scroll if main is flex column
        sidebar: document.getElementById('sidebar'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
        sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
        sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
        sidebarName: document.getElementById('sidebar-name'),
        sidebarAvatar: document.getElementById('sidebar-avatar'),
        sidebarUserTitle: document.getElementById('sidebar-user-title'),
        toastContainer: document.getElementById('toastContainer'), // Corrected from toastContainer
        globalError: document.getElementById('global-error'),
        dashboardTitle: document.getElementById('dashboard-title'),
        userGoalDisplay: document.getElementById('user-goal-display'),
        refreshDataBtn: document.getElementById('refresh-data-btn'),
        diagnosticPrompt: document.getElementById('diagnostic-prompt'),
        startTestBtnPrompt: document.getElementById('start-test-btn-prompt'),
        tabsWrapper: document.getElementById('tabs-wrapper'),
        contentTabs: document.querySelectorAll('#tabs-wrapper .plan-tab'), // Corrected selector if needed
        mainTabContentArea: document.getElementById('main-tab-content-area'),
        practiceTabContent: document.getElementById('practice-tab-content'),
        vyukaTabContent: document.getElementById('vyuka-tab-content'),
        statsCardsContainer: document.getElementById('stats-cards-container'), // Corrected to match HTML
        shortcutsGrid: document.getElementById('shortcuts-grid'),
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
        accelerateGradeSelect: document.getElementById('accelerate_grade_profile'), // Corrected ID
        accelerateIntensitySelect: document.getElementById('accelerate_intensity_profile'), // Corrected ID
        accelerateAreasCheckboxes: document.querySelectorAll('input[name="accelerate_area"]'),
        accelerateReasonRadios: document.querySelectorAll('input[name="accelerate_reason"]'),
        accelerateProfessionGroup: document.getElementById('accelerate-profession-group'),
        accelerateProfessionTextarea: document.getElementById('accelerate-profession'),
        reviewGradeSelect: document.getElementById('review_grade_profile'), // Corrected ID
        topicRatingsContainer: document.getElementById('topic-ratings-container'),
        exploreGradeSelect: document.getElementById('explore_grade'), // Corrected ID (assuming it's there or will be)
        planTabs: document.querySelectorAll('.plan-tab'), // This is in plan.js, using contentTabs for this page
        currentPlanSection: document.getElementById('currentPlanSection'),
        currentPlanLoader: document.getElementById('currentPlanLoader'),
        dailyPlanCarouselContainer: document.getElementById('dailyPlanCarouselContainer'),
        singleDayPlanView: document.getElementById('singleDayPlanView'),
        prevDayBtn: document.getElementById('prevDayBtn'),
        nextDayBtn: document.getElementById('nextDayBtn'),
        currentPlanEmptyState: document.getElementById('currentPlanEmptyState'),
        // History and Create plan sections are part of plan.html, not main.html's direct scope for this file
        // historyPlanSection: document.getElementById('historyPlanSection'),
        // historyLoader: document.getElementById('historyLoader'),
        // historyPlanContent: document.getElementById('historyPlanContent'),
        // createPlanSection: document.getElementById('createPlanSection'),
        // createPlanLoader: document.getElementById('createPlanLoader'),
        // createPlanContent: document.getElementById('createPlanContent'),
        // planSection: document.getElementById('planSection'),
        // planLoading: document.getElementById('planLoading'),
        // planSectionTitle: document.getElementById('plan-section-title'),
        // planContent: document.getElementById('planContent'),
        // planActions: document.getElementById('planActions'),
        // genericBackBtn: document.getElementById('genericBackBtn'),
        notificationBell: document.getElementById('notification-bell'),
        notificationCount: document.getElementById('notification-count'),
        notificationsDropdown: document.getElementById('notifications-dropdown'),
        notificationsList: document.getElementById('notifications-list'),
        noNotificationsMsg: document.getElementById('no-notifications-msg'),
        markAllReadBtn: document.getElementById('mark-all-read'),
        // Templates are in plan.html, not directly used here unless plan.js logic is fully merged
        // lockedPlanTemplate: document.getElementById('lockedPlanTemplate'),
        // createPlanFormTemplate: document.getElementById('createPlanFormTemplate'),
        // noDiagnosticTemplate: document.getElementById('noDiagnosticTemplate'),
        // historyItemTemplate: document.getElementById('historyItemTemplate'),
        // promptCreatePlanTemplate: document.getElementById('promptCreatePlanTemplate'),
        // noActivePlanTemplate: document.getElementById('noActivePlanTemplate'),
        currentYearSidebar: document.getElementById('currentYearSidebar'),
        currentYearFooter: document.getElementById('currentYearFooter'),
        mouseFollower: document.getElementById('mouse-follower'),
        dayCardTemplate: document.getElementById('dayCardTemplate'),
        dayCardSkeleton: document.getElementById('dayCardSkeleton')
    };

    // ==============================================
    //          Глобальное Состояние (Global State)
    // ==============================================
    let state = {
        currentUser: null,
        currentProfile: null,
        latestDiagnosticTest: null, // This is from plan.js, might not be needed here directly
        currentStudyPlan: null,
        allTitles: [],
        currentMainTab: 'practice-tab', // Default tab for this page
        isLoading: {
            page: true, stats: false, topicProgress: false, currentPlan: false,
            goalModal: false, notifications: false, titles: false,
            // These are more relevant to plan.js functionality if fully merged
            history: false, create: false, detail: false, schedule: false, generation: false,
        },
        hasCompletedGoalSetting: false,
        hasCompletedDiagnostic: false,
        allExamTopicsAndSubtopics: [], // For goal setting, might be fetched if modal is used
        // Plan specific state, keep if plan.js logic is fully merged
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
        // Added from dashboard.js for consistency
        test_diagnostic_completed: { name: 'Diagnostický Test Dokončen', icon: 'fa-microscope', class: 'diagnostic' },
        vyuka_topic_started: { name: 'Výuka Zahájena', icon: 'fa-chalkboard-teacher', class: 'lesson' },
        vyuka_topic_finished: { name: 'Výuka Dokončena', icon: 'fa-graduation-cap', class: 'lesson' },
        badge: { name: 'Odznak Získán', icon: 'fa-medal', class: 'badge' },
        diagnostic: { name: 'Diagnostika', icon: 'fa-microscope', class: 'diagnostic' },
        lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' }, // Overlap with 'theory', use specific type from DB
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
    //          Помощники (Utility Functions)
    // ==============================================
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
        return `<span class="math-inline">\{year\}\-</span>{month}-${day}`;
    };
    const addDaysToDate = (dateString, days) => {
        const date = new Date(dateString + 'T00:00:00'); // Ensure parsing as local date
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
        let lastScrollY = ui.mainContentWrapper?.scrollTop || 0; // Scroll on wrapper
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
        const offlineBanner = document.getElementById('offline-banner'); // Get it each time or ensure it's in ui cache
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
    const setLoadingState = (sectionKey, isLoadingFlag) => {
        if (state.isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;
        if (sectionKey === 'all') { Object.keys(state.isLoading).forEach(key => { if(key !== 'all') state.isLoading[key] = isLoadingFlag; }); }
        else { state.isLoading[sectionKey] = isLoadingFlag; }
        console.log(`[Loading - Main] ${sectionKey}: ${isLoadingFlag}`);

        // Logic for specific sections
        if (sectionKey === 'stats' && ui.statsCardsContainer) {
            ui.statsCardsContainer.classList.toggle('loading', isLoadingFlag);
            // Toggle skeleton visibility if you have a separate skeleton container for stats
             if (ui.statsCardsSkeletonContainer && ui.statsCardsContainer) {
                ui.statsCardsSkeletonContainer.style.display = isLoadingFlag ? 'grid' : 'none';
                ui.statsCardsContainer.style.display = isLoadingFlag ? 'none' : 'grid';
            }
        } else if (sectionKey === 'topicProgress' && ui.topicProgressSection) {
            ui.topicProgressTableLoadingOverlay?.classList.toggle('visible-loader', isLoadingFlag);
            ui.topicProgressTable?.classList.toggle('hidden-while-loading', isLoadingFlag);
            if (isLoadingFlag) {
                // Render skeleton rows for topic progress table if needed
            }
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
            if (isLoadingFlag && ui.notificationsList) renderNotificationSkeletons(2);
        } else if (sectionKey === 'page' && ui.initialLoader) {
            if(isLoadingFlag) {
                ui.initialLoader.style.display = 'flex';
                ui.initialLoader.classList.remove('hidden');
            } else {
                ui.initialLoader.classList.add('hidden');
                setTimeout(() => { if(ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500);
            }
        }
    };
    const renderMessage = (container, type = 'info', title, message, addButtons = []) => {
        if (!container) { console.error("renderMessage: Container not found!"); return; }
        console.log(`[RenderMessage] Rendering into:`, container.id || container.className, `Type: ${type}, Title: ${title}`);
        const iconMap = { info: 'fa-info-circle', warning: 'fa-exclamation-triangle', error: 'fa-exclamation-circle' };
        let buttonsHTML = '';
        addButtons.forEach(btn => {
            buttonsHTML += `<button class="btn <span class="math-inline">\{btn\.class \|\| 'btn\-primary'\}" id\="</span>{btn.id}" <span class="math-inline">\{btn\.disabled ? 'disabled' \: ''\}\></span>{btn.icon ? `<i class="fas ${btn.icon}"></i> ` : ''}${sanitizeHTML(btn.text)}</button>`;
        });
        container.innerHTML = `<div class="notest-message ${type}"><h3><i class="fas ${iconMap[type]}"></i> <span class="math-inline">\{sanitizeHTML\(title\)\}</h3\><p\></span>{sanitizeHTML(message)}</p><div class="action-buttons">${buttonsHTML}</div></div>`;
        container.classList.add('content-visible'); // Ensure visibility class is added
        container.style.display = 'flex'; // Make sure it's displayed

        // For current plan empty state, hide the carousel
        if (container === ui.currentPlanEmptyState) {
            if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
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
        setLoadingState('titles', true); // Assuming titles are part of profile loading for sidebar
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*, selected_title, preferences, longest_streak_days, learning_goal') // Ensure learning_goal is fetched
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows found, not an error for single()
            setLoadingState('titles', false);
            return data; // Returns null if not found, or the profile object
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
                .from('title_shop') // Assuming this is your titles table
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
            const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || user.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);

            const initials = getInitials(profile, user.email);
            const avatarUrl = profile.avatar_url;
            let finalAvatarUrlToUse = null;

            if (avatarUrl) {
                if (!avatarUrl.startsWith('http') && avatarUrl.includes('/')) {
                    finalAvatarUrlToUse = sanitizeHTML(avatarUrl);
                } else {
                    finalAvatarUrlToUse = `<span class="math-inline">\{sanitizeHTML\(avatarUrl\)\}?t\=</span>{new Date().getTime()}`;
                }
            }
            ui.sidebarAvatar.innerHTML = finalAvatarUrlToUse ? `<img src="<span class="math-inline">\{finalAvatarUrlToUse\}" alt\="</span>{sanitizeHTML(initials)}">` : sanitizeHTML(initials);


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
    function renderNotifications(count, notifications) { console.log("[Render Notifications] Start, Count:", count, "Notifications:", notifications); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements."); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item <span class="math-inline">\{isReadClass\}" data\-id\="</span>{n.id}" <span class="math-inline">\{linkAttr\}\></span>{!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas <span class="math-inline">\{visual\.icon\}"\></i\></div\><div class\="notification\-content"\><div class\="notification\-title"\></span>{sanitizeHTML(n.title)}</div><div class="notification-message"><span class="math-inline">\{sanitizeHTML\(n\.message\)\}</div\><div class\="notification\-time"\></span>{formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.toggle('has-content', notifications && notifications.length > 0); console.log("[Render Notifications] Finished"); }
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    async function markNotificationRead(notificationId) { console.log("[Notifications] Marking notification as read:", notificationId); if (!state.currentUser || !notificationId) return false; try { const { error } = await supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[Notifications] Mark as read successful for ID:", notificationId); return true; } catch (error) { console.error("[Notifications] Mark as read error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { console.log("[Notifications] Marking all as read for user:", state.currentUser?.id); if (!state.currentUser || !ui.markAllReadBtn) return; setLoadingState('notifications', true); try { const { error } = await supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('is_read', false); if (error) throw error; console.log("[Notifications] Mark all as read successful"); const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[Notifications] Mark all as read error:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }

    async function checkUserInitialSetup(userId) {
        console.log("[InitialSetupCheck] Checking setup for user:", userId);
        if (!state.currentProfile) {
            console.warn("[InitialSetupCheck] Profile not loaded, cannot check setup.");
            return { completedGoalSetting: false, completedDiagnostic: false };
        }
        const completedGoalSetting = !!state.currentProfile.learning_goal;
        let completedDiagnostic = false;
        // For 'math_explore', diagnostic is not strictly required to proceed.
        if (completedGoalSetting && state.currentProfile.learning_goal !== 'math_explore') {
            const diagnostic = await getLatestDiagnosticTest(userId, false); // false to not show loader in this specific check
            completedDiagnostic = !!(diagnostic && diagnostic.completed_at);
        } else if (completedGoalSetting && state.currentProfile.learning_goal === 'math_explore') {
            completedDiagnostic = true; // 'math_explore' doesn't require a diagnostic test to be considered "setup" for plan tab.
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
            // Reset selections
            ui.goalRadioLabels.forEach(label => {
                label.classList.remove('selected-goal');
                const radio = label.querySelector('input[type="radio"]');
                if (radio) radio.checked = false;
            });
            // Pre-select if a goal is already set
            if (state.currentProfile && state.currentProfile.learning_goal) {
                const currentGoalRadio = document.querySelector(`input[name="learningGoal"][value="${state.currentProfile.learning_goal}"]`);
                if (currentGoalRadio) {
                    currentGoalRadio.checked = true;
                    currentGoalRadio.closest('.goal-radio-label')?.classList.add('selected-goal');
                }
            }
        }
        // Hide main content tabs when modal is open
        if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none';
        if (ui.mainTabContentArea) ui.mainTabContentArea.style.display = 'none';
        if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none';
    }

    function hideGoalSelectionModal() {
        if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none';
        // Show tabs again if they were hidden
        // This logic will be handled by initializeApp after goal is saved
    }

    function handleGoalSelection(event) {
        const target = event.target.closest('.goal-radio-label');
        if (!target) return;
        const radio = target.querySelector('input[type="radio"]');
        if (!radio) return;

        ui.goalRadioLabels.forEach(label => label.classList.remove('selected-goal'));
        target.classList.add('selected-goal');

        const selectedGoal = radio.value;
        state.selectedLearningGoal = selectedGoal; // Temporarily store selected goal

        let nextStepId = null;
        if (selectedGoal === 'math_accelerate') nextStepId = 'goal-step-accelerate';
        else if (selectedGoal === 'math_review') nextStepId = 'goal-step-review';
        else if (selectedGoal === 'math_explore') nextStepId = 'goal-step-explore';
        // 'exam_prep' has no further details, so it will be saved directly

        if (nextStepId) {
            ui.goalModalSteps.forEach(step => step.classList.remove('active'));
            document.getElementById(nextStepId)?.classList.add('active');
            if (selectedGoal === 'math_review') loadTopicsForGradeReview(); // Load topics for rating
        } else if (selectedGoal === 'exam_prep') {
            // Directly save if no further steps
            saveLearningGoal(selectedGoal, {});
        } else {
            console.warn("No next step defined for goal:", selectedGoal);
        }
    }

    async function loadTopicsForGradeReview() {
        if (!state.allExamTopicsAndSubtopics || state.allExamTopicsAndSubtopics.length === 0) {
            try {
                const { data, error } = await supabaseClient
                    .from('exam_topics')
                    .select(`id, name, subtopics:exam_subtopics (id, name, topic_id)`)
                    .order('id');
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
        ui.topicRatingsContainer.innerHTML = ''; // Clear previous
        if (!state.allExamTopicsAndSubtopics || state.allExamTopicsAndSubtopics.length === 0) {
            ui.topicRatingsContainer.innerHTML = '<p>Žádná témata k hodnocení.</p>';
            return;
        }

        // Filter out "Smíšené úlohy"
        state.allExamTopicsAndSubtopics.filter(topic => topic.name !== "Smíšené úlohy").forEach(topic => {
            const item = document.createElement('div');
            item.className = 'topic-rating-item';
            item.innerHTML = `
                <span class="topic-name"><span class="math-inline">\{sanitizeHTML\(topic\.name\)\}</span\>
<div class\="rating\-stars" data\-topic\-id\="</span>{topic.id}">
                    ${[1,2,3,4,5].map(val => `<i class="fas fa-star star" data-value="${val}" aria-label="${val} hvězdiček"></i>`).join('')}
                </div>
            `;
            item.querySelectorAll('.star').forEach(star => {
                star.addEventListener('click', function() {
                    const value = parseInt(this.dataset.value);
                    const parentStars = this.parentElement;
                    parentStars.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('rated', i < value));
                    parentStars.dataset.currentRating = value; // Store current rating
                });
            });
            ui.topicRatingsContainer.appendChild(item);
        });
    }

    async function saveLearningGoal(goal, details = {}) {
        if (!state.currentUser || !supabaseClient) {
            showToast("Chyba: Uživatel není přihlášen.", "error");
            return;
        }
        setLoadingState('goalModal', true);
        console.log(`[SaveGoal] Saving goal: ${goal}, Details:`, details);

        // Ensure goal_details is always an object
        const currentGoalDetails = state.currentProfile?.preferences?.goal_details || {};
        const preferencesUpdate = {
            ...state.currentProfile.preferences,
            goal_details: { ...currentGoalDetails, ...details } // Merge new details
        };

        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({
                    learning_goal: goal,
                    preferences: preferencesUpdate,
                    updated_at: new Date().toISOString()
                })
                .eq('id', state.currentUser.id);

            if (error) throw error;

            // Update local state
            if(state.currentProfile) {
                state.currentProfile.learning_goal = goal;
                state.currentProfile.preferences = preferencesUpdate;
            }
            state.hasCompletedGoalSetting = true;

            showToast("Cíl uložen!", `Váš studijní cíl byl nastaven na: ${getGoalDisplayName(goal)}.`, "success");
            hideGoalSelectionModal();
            updateUserGoalDisplay(); // Update the goal display in the header

            // Re-check diagnostic status based on the new goal
            const { completedDiagnostic } = await checkUserInitialSetup(state.currentUser.id);
            state.hasCompletedDiagnostic = completedDiagnostic;

            if (!completedDiagnostic && goal !== 'math_explore') {
                showDiagnosticPrompt(); // Show prompt if diagnostic is now needed
            } else {
                 if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none';
            }
            // Ensure main content area is visible after goal setting
            if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');}
            if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');}
            await switchTabContent('practice-tab'); // Switch to default tab

        } catch (error) {
            console.error("Error saving learning goal:", error);
            showToast("Chyba ukládání", `Nepodařilo se uložit cíl: ${error.message}`, "error");
        } finally {
            setLoadingState('goalModal', false);
        }
    }

    function showDiagnosticPrompt() {
        if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'flex';
        // Ensure tabs and content area are visible when diagnostic prompt is shown
        if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');}
        if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');}
    }

    function getGoalDisplayName(goalKey) {
        const goalMap = {
            'exam_prep': 'Příprava na přijímačky',
            'math_accelerate': 'Učení napřed',
            'math_review': 'Doplnění mezer',
            'math_explore': 'Volné prozkoumávání',
        };
        return goalMap[goalKey] || goalKey || 'Neznámý cíl';
    }

    function updateUserGoalDisplay() {
        if (ui.userGoalDisplay && state.currentProfile && state.currentProfile.learning_goal) {
            ui.userGoalDisplay.innerHTML = `<i class="fas fa-bullseye"></i> Cíl: <strong>${getGoalDisplayName(state.currentProfile.learning_goal)}</strong>`;
            ui.userGoalDisplay.style.display = 'inline-flex';
        } else if (ui.userGoalDisplay) {
            ui.userGoalDisplay.style.display = 'none'; // Hide if no goal is set
        }
    }

    async function loadDashboardStats() {
        if (!state.currentUser || !supabaseClient) return;
        setLoadingState('stats', true);
        toggleSkeletonUI('stats', true); // Show skeleton for stats cards
        try {
            // userStatsData should be fetched and updated in loadDashboardData
            // This function now just calls renderStatsCards with potentially stale data if called standalone
            // Or uses currentProfile as a fallback if userStatsData isn't ready
            const statsToDisplay = userStatsData || { // Fallback to profile if stats not loaded
                progress: state.currentProfile?.overall_progress_percentage || 0,
                points: state.currentProfile?.points || 0,
                streak_current: state.currentProfile?.streak_days || 0,
                longest_streak_days: state.currentProfile?.longest_streak_days || 0,
                completed_exercises: state.currentProfile?.completed_exercises || 0,
                completed_tests_count: state.currentProfile?.completed_tests_count || 0, // This might be from a different source
            };
            renderStatsCards(statsToDisplay);
        } catch (error) {
            console.error("Error loading dashboard stats:", error);
            if(ui.statsCardsContainer) {
                ui.statsCardsContainer.innerHTML = '<p class="error-message card">Statistiky nelze načíst.</p>';
                ui.statsCardsContainer.style.display = 'grid'; // Ensure it's visible even on error
            }
        } finally {
            setLoadingState('stats', false);
            toggleSkeletonUI('stats', false); // Hide skeleton for stats cards
        }
    }

    function renderStatsCards(stats) {
        // This function is from dashboard.js and seems mostly fine.
        // Key change: Make sure to use correct IDs for elements.
        console.log("[UI Update] Aktualizace karet statistik:", stats);

        // Ensure UI elements are cached and available
        if (!ui.statsCardsContainer || !ui.overallProgressValue || !ui.totalPointsValue || !ui.streakValue) {
            console.error("[Render Stats] Chybí klíčové UI elementy pro statistiky.");
            return;
        }
        // No need to toggle 'loading' class on individual cards if skeleton container is used.
        // The main container `statsCardsContainer` will be hidden/shown.

        if (!stats) {
            console.warn("[UI Update Stats] Chybí data statistik, zobrazuji placeholder.");
            // Show an error/empty message within the statsCardsContainer or specific cards
            ui.statsCardsContainer.innerHTML = '<p class="error-message card">Statistiky nelze načíst nebo nejsou k dispozici.</p>';
            return;
        }

        // It's better to rebuild the cards if structure might change or to ensure cleanliness
        // For now, assuming the HTML structure is fixed and we just update text content.
        if(ui.overallProgressValue) ui.overallProgressValue.textContent = `${stats.progress ?? 0}%`;
        if(ui.overallProgressFooter && stats.progress_weekly !== undefined) {
            const weeklyChange = stats.progress_weekly;
            ui.overallProgressFooter.innerHTML = `<i class="fas ${weeklyChange > 0 ? 'fa-arrow-up' : weeklyChange < 0 ? 'fa-arrow-down' : 'fa-minus'}"></i> <span class="math-inline">\{weeklyChange \> 0 ? '\+' \: ''\}</span>{weeklyChange}% tento týden`;
            ui.overallProgressFooter.className = `stat-card-footer ${weeklyChange > 0 ? 'positive' : weeklyChange < 0 ? 'negative' : ''}`;
        } else if (ui.overallProgressFooter) {
            ui.overallProgressFooter.innerHTML = `<i class="fas fa-minus"></i> Data nedostupná`;
            ui.overallProgressFooter.className = 'stat-card-footer';
        }


        if (ui.totalPointsValue) {
            ui.totalPointsValue.innerHTML = `${stats.points ?? 0} <span id="latest-credit-change" class="latest-credit-change-span"></span>`;
            const latestTx = fetchAndDisplayLatestCreditChange.latestTxData; // Access stored data
            const latestCreditSpan = document.getElementById('latest-credit-change');

            if (latestTx && latestCreditSpan) {
                const amount = latestTx.amount;
                const description = latestTx.description || 'N/A';
                const sign = amount > 0 ? '+' : '';
                const colorClass = amount > 0 ? 'positive' : (amount < 0 ? 'negative' : 'neutral');
                latestCreditSpan.innerHTML = `(<span class="<span class="math-inline">\{colorClass\}" title\="</span>{sanitizeHTML(description)}"><span class="math-inline">\{sign\}</span>{amount}</span>)`;
                latestCreditSpan.style.display = 'inline';
            } else if (latestCreditSpan) {
                latestCreditSpan.style.display = 'none';
            }
        }

        if(ui.totalPointsFooter && stats.points_weekly !== undefined) {
            const weeklyPoints = stats.points_weekly;
             ui.totalPointsFooter.className = `stat-card-footer ${weeklyPoints > 0 ? 'positive' : weeklyPoints < 0 ? 'negative' : ''}`;
            ui.totalPointsFooter.innerHTML = `<i class="fas ${weeklyPoints > 0 ? 'fa-arrow-up' : weeklyPoints < 0 ? 'fa-arrow-down' : 'fa-minus'}"></i> <span class="math-inline">\{weeklyPoints \> 0 ? '\+' \: ''\}</span>{weeklyPoints} kreditů tento týden`;
        } else if (ui.totalPointsFooter) {
            ui.totalPointsFooter.innerHTML = `<i class="fas fa-minus"></i> Data nedostupná`;
            ui.totalPointsFooter.className = 'stat-card-footer';
        }

        if(ui.streakValue) ui.streakValue.textContent = stats.streak_current ?? 0;
        if(ui.streakFooter) ui.streakFooter.innerHTML = `MAX: ${stats.longest_streak_days ?? 0} dní`;


        console.log("[UI Update] Karty statistik aktualizovány.");
    }

    async function loadTopicProgress() {
        if (!state.currentUser || !supabaseClient) return;
        setLoadingState('topicProgress', true);
        // No direct skeleton toggling here, assumes parent section skeleton is active
        try {
            // Call the RPC function
            const { data, error } = await supabaseClient.rpc('get_user_topic_progress_summary', {
                p_user_id: state.currentUser.id
            });

            if (error) {
                // Check if the error is due to the function not existing (404 like)
                // Supabase RPC errors might not have a HTTP status code directly in `error.status`
                // but might be in `error.message` or a nested property.
                let errorMessage = error.message;
                const errString = JSON.stringify(error); // Simple way to check for relevant parts
                if (error.code === '42883' || errString.includes('function get_user_topic_progress_summary(p_user_id => uuid) does not exist')) {
                    errorMessage = 'Chyba: Požadovaná funkce (get_user_topic_progress_summary) pro načtení pokroku v tématech nebyla nalezena na serveru. Ověřte prosím, že je SQL funkce správně vytvořena a nasazena ve vaší Supabase databázi.';
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

        topics.sort((a,b) => (new Date(b.last_studied_at || 0)) - (new Date(a.last_studied_at || 0))); // Sort by most recent

        topics.forEach(topic => {
            const row = ui.topicProgressTableBody.insertRow();
            const progress = Math.round(topic.progress_percentage || 0);
            let progressColor = 'var(--accent-primary)'; // Default/Neutral
            if (progress >= 75) progressColor = 'var(--accent-lime)'; // Good
            else if (progress < 40) progressColor = 'var(--accent-pink)'; // Needs attention

            row.innerHTML = `
                <td><i class="fas ${topic.topic_icon || 'fa-question-circle'}" style="margin-right: 0.7em; color: <span class="math-inline">\{progressColor\};"\></i\></span>{sanitizeHTML(topic.topic_name)}</td>
                <td>
                    <div class="progress-bar-cell">
                        <div class="progress-bar-track">
                            <div class="progress-bar-fill" style="width: ${progress}%; background: ${progressColor};"></div>
                        </div>
                        <span class="progress-bar-text" style="color: <span class="math-inline">\{progressColor\};"\></span>{progress}%</span>
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

        // Update ARIA attributes and active class for tab buttons
        ui.contentTabs.forEach(tab => {
            const isCurrentTab = tab.dataset.tab === tabId;
            tab.classList.toggle('active', isCurrentTab);
            tab.setAttribute('aria-selected', isCurrentTab ? 'true' : 'false');
        });

        // Hide all tab content panes and specific sections
        document.querySelectorAll('#main-tab-content-area > .tab-content, #main-tab-content-area > .section').forEach(paneOrSection => {
            paneOrSection.classList.remove('active', 'visible-section');
            paneOrSection.style.display = 'none';
        });

        let targetElement = null;
        if (tabId === 'practice-tab') {
            targetElement = ui.practiceTabContent;
        } else if (tabId === 'current') { // This is the "Plán" tab
            targetElement = ui.currentPlanSection;
        } else if (tabId === 'vyuka-tab') {
            targetElement = ui.vyukaTabContent;
        } else {
            console.warn(`[Main Tab Switch] Unknown tabId: ${tabId}`);
            return; // Do nothing if tabId is unknown
        }

        if (targetElement) {
            // Use 'block' for general tab content and 'flex' for sections that need it (like plan carousel)
            const displayStyle = (tabId === 'current') ? 'flex' : 'block';
            targetElement.style.display = displayStyle;

            if (targetElement.classList.contains('tab-content')) {
                targetElement.classList.add('active');
            } else if (targetElement.classList.contains('section')) {
                targetElement.classList.add('visible-section');
                 // Ensure the parent container is visible if it's managing multiple sections
                if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible'); }
            }
            console.log(`[Main Tab Switch] Activated element: #${targetElement.id} with display: ${displayStyle}`);
        }

        // Load content for the selected tab
        if (tabId === 'practice-tab') {
            await loadDashboardStats();
            await loadTopicProgress();
            // Ensure DashboardLists is called here for the recent activities and credit history
            if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderAll === 'function' && state.currentUser) {
                 await DashboardLists.loadAndRenderAll(state.currentUser.id, 5);
            }
        } else if (tabId === 'current') {
            await loadCurrentStudyPlanData();
        } else if (tabId === 'vyuka-tab') {
            // Logic for Výuka tab if any data needs to be loaded upon activation
            console.log("[Main Tab Switch] Výuka tab activated. Placeholder for future content loading.");
        }
    }

    async function loadCurrentStudyPlanData() {
        console.log("[Main.html CurrentPlan] Delegating to plan.js-like logic's loadCurrentPlan...");
        if (typeof loadCurrentPlan === 'function') { // This function is now part of main.js itself
            await loadCurrentPlan();
        } else {
            console.error("[Main.html CurrentPlan] loadCurrentPlan function (expected in main.js) not found!");
            if(ui.currentPlanSection) {
                const emptyStateContainer = ui.currentPlanSection.querySelector('#currentPlanEmptyState') || ui.currentPlanSection;
                renderMessage(emptyStateContainer, 'error', 'Chyba', 'Logika pro načtení plánu není dostupná.');
            }
        }
    }

    // --- Merged plan.js functions directly into main.js for the "Plán" tab ---
    const groupActivitiesByDayAndDateArray = (activities) => {
        state.allActivePlanActivitiesByDay = {};
        state.sortedActivityDates = [];
        if (!activities || activities.length === 0) {
            state.planStartDate = null;
            state.planEndDate = null;
            return;
        }

        const dayToDateMap = {};
        // Determine the plan's start day of the week (0=Sunday, 1=Monday, ..., 6=Saturday)
        // Sort activities by day_of_week then time_slot to find the earliest one
        const sortedActivities = [...activities].sort((a, b) => {
            if (a.day_of_week !== b.day_of_week) {
                return a.day_of_week - b.day_of_week;
            }
            return (a.time_slot || '99:99').localeCompare(b.time_slot || '99:99');
        });

        let planStartDayOfWeek = sortedActivities[0].day_of_week; // This is 0-6, Sunday-Saturday
        let referenceDate = new Date(); // Today

        // Adjust referenceDate to match the plan's start day of the week
        // If plan starts on Monday (1) and today is Wednesday (3), go back 2 days.
        // If plan starts on Friday (5) and today is Tuesday (2), go forward 3 days.
        let currentDayOfWeekJs = referenceDate.getDay(); // 0=Sunday, ..., 6=Saturday
        let diffToStartDay = planStartDayOfWeek - currentDayOfWeekJs;
        referenceDate.setDate(referenceDate.getDate() + diffToStartDay);

        state.planStartDate = new Date(referenceDate); // This is now the actual start date of the plan's first activity this week
        state.planEndDate = new Date(state.planStartDate);
        state.planEndDate.setDate(state.planStartDate.getDate() + 6); // The plan covers 7 days from its start

        // Map each day of the week (0-6) in the plan's 7-day cycle to a YYYY-MM-DD string
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(state.planStartDate);
            currentDate.setDate(state.planStartDate.getDate() + i);
            const dayOfWeekForMap = currentDate.getDay(); // 0 for Sunday, 1 for Monday etc.
            dayToDateMap[dayOfWeekForMap] = dateToYYYYMMDD(currentDate);
        }

        activities.forEach(act => {
            const dateString = dayToDateMap[act.day_of_week]; // act.day_of_week is 0-6
            if (dateString) {
                if (!state.allActivePlanActivitiesByDay[dateString]) {
                    state.allActivePlanActivitiesByDay[dateString] = [];
                }
                state.allActivePlanActivitiesByDay[dateString].push(act);
            } else {
                 console.warn(`Activity with ID ${act.id} has invalid day_of_week: ${act.day_of_week} or dateString not found.`);
            }
        });
        state.sortedActivityDates = Object.keys(state.allActivePlanActivitiesByDay).sort();

        // Re-evaluate planStartDate and planEndDate based on actual activity dates found
        if (state.sortedActivityDates.length > 0) {
            state.planStartDate = new Date(state.sortedActivityDates[0] + 'T00:00:00');
            state.planEndDate = new Date(state.sortedActivityDates[state.sortedActivityDates.length - 1] + 'T00:00:00');
        } else {
            // If no activities, keep original referenceDate based calculation or nullify
            state.planStartDate = null; // Or keep as calculated if preferred for empty plan view
            state.planEndDate = null;
        }

        console.log("[groupActivities] Grouped activities:", state.allActivePlanActivitiesByDay);
        console.log("[groupActivities] Sorted dates:", state.sortedActivityDates);
        console.log("[groupActivities] Plan effective start/end:", state.planStartDate, state.planEndDate);
    };

    async function loadCurrentPlan() { // This function is now part of main.js
        if (!supabaseClient || !state.currentUser) return;
        console.log("[CurrentPlan in Main.js] Loading current plan...");
        setLoadingState('currentPlan', true);
        // setLoadingState('schedule', true); // 'schedule' is part of plan.js, here we use 'currentPlan' for the whole tab

        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        if (ui.currentPlanEmptyState) ui.currentPlanEmptyState.style.display = 'none';

        try {
            const { data: plans, error } = await supabaseClient.from('study_plans')
                .select('*')
                .eq('user_id', state.currentUser.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1);
            if (error) throw error;

            if (plans && plans.length > 0) {
                state.currentStudyPlan = plans[0];
                console.log("[CurrentPlan in Main.js] Active plan found:", state.currentStudyPlan.id);

                const { data: activities, error: actError } = await supabaseClient
                    .from('plan_activities')
                    .select('*')
                    .eq('plan_id', state.currentStudyPlan.id)
                    .order('day_of_week')
                    .order('time_slot');
                if (actError) throw actError;

                groupActivitiesByDayAndDateArray(activities || []);

                const todayStr = getTodayDateString();
                if (state.sortedActivityDates.includes(todayStr)) {
                    state.currentDisplayDate = todayStr;
                } else if (state.sortedActivityDates.length > 0) {
                    // Find the closest future date, or the last date if all are in the past
                    let futureDate = state.sortedActivityDates.find(d => d >= todayStr);
                    state.currentDisplayDate = futureDate || state.sortedActivityDates[state.sortedActivityDates.length -1];
                     // If all dates are in the past and currentDisplayDate is still null, default to the first available date or today
                    if (!state.currentDisplayDate && state.planStartDate) {
                        state.currentDisplayDate = dateToYYYYMMDD(state.planStartDate); // Fallback to plan's start
                    } else if (!state.currentDisplayDate) { // If still no date (e.g. empty plan)
                         state.currentDisplayDate = state.sortedActivityDates[0] || todayStr;
                    }
                } else { // No activities with dates
                    state.currentDisplayDate = todayStr; // Default to today if no activities
                }

                renderSingleDayPlan(state.currentDisplayDate);
                if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'flex';

            } else {
                state.currentStudyPlan = null;
                state.allActivePlanActivitiesByDay = {};
                state.sortedActivityDates = [];
                state.currentDisplayDate = null;
                console.log("[CurrentPlan in Main.js] No active plan found. Checking diagnostic...");
                if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';

                const diagnostic = await getLatestDiagnosticTest(state.currentUser.id, false); // false not to show loader
                if (diagnostic === null) { // Error fetching diagnostic
                    renderMessage(ui.currentPlanEmptyState, 'error', 'Chyba načítání diagnostiky', 'Nepodařilo se ověřit stav vašeho diagnostického testu.');
                } else if (diagnostic) { // Diagnostic exists
                    renderPromptCreatePlan(ui.currentPlanEmptyState);
                } else { // No diagnostic found
                    renderNoActivePlan(ui.currentPlanEmptyState);
                }
            }
        } catch (error) {
            console.error("[CurrentPlan in Main.js] Error loading current plan:", error);
            renderMessage(ui.currentPlanEmptyState, 'error', 'Chyba', 'Nepodařilo se načíst aktuální studijní plán.');
            if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        } finally {
            setLoadingState('currentPlan', false);
            // setLoadingState('schedule', false); // Use 'currentPlan' for the whole tab
            console.log("[CurrentPlan in Main.js] Loading finished.");
        }
     }

    const renderSingleDayPlan = (targetDateString) => {
        console.log(`[RenderSingleDay in Main.js] Rendering for date: ${targetDateString}`);
        if (!ui.singleDayPlanView || !state.currentStudyPlan || !ui.dayCardTemplate) {
            console.error("[RenderSingleDay in Main.js] Missing UI elements (singleDayPlanView, dayCardTemplate) or current study plan.");
            if(ui.currentPlanEmptyState) renderMessage(ui.currentPlanEmptyState, 'error', 'Chyba zobrazení', 'Nelze zobrazit denní plán.');
            if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
            setLoadingState('currentPlan', false); // Use 'currentPlan'
            return;
        }

        setLoadingState('currentPlan', true); // Use 'currentPlan'

        if (ui.dayCardSkeleton && getComputedStyle(ui.dayCardSkeleton).display !== 'none') {
            ui.dayCardSkeleton.style.display = 'none';
        }

        let dayCard = ui.singleDayPlanView.querySelector('.day-schedule-card:not(.skeleton-day-card)');
        let dayHeader, activitiesContainer;

        if (!dayCard) {
            console.log("[RenderSingleDay in Main.js] No existing day card, cloning template.");
            const templateNode = ui.dayCardTemplate.content.cloneNode(true);
            dayCard = templateNode.querySelector('.day-schedule-card');
            if (!dayCard) {
                console.error("[RenderSingleDay in Main.js] Failed to clone .day-schedule-card from template!");
                setLoadingState('currentPlan', false);
                return;
            }
            ui.singleDayPlanView.innerHTML = '';
            ui.singleDayPlanView.appendChild(dayCard);
        } else {
            console.log("[RenderSingleDay in Main.js] Reusing existing day card structure.");
        }

        dayHeader = dayCard.querySelector('.day-header');
        activitiesContainer = dayCard.querySelector('.activity-list-container');

        if (!dayHeader || !activitiesContainer) {
            console.error("[RenderSingleDay in Main.js] Day header or activity container missing in day card!");
            setLoadingState('currentPlan', false);
            return;
        }
        dayCard.style.opacity = '0'; // For fade-in

        const activitiesForDay = state.allActivePlanActivitiesByDay[targetDateString] || [];
        activitiesForDay.sort((a, b) => (a.time_slot || '99:99').localeCompare(b.time_slot || '99:99'));

        dayCard.classList.toggle('today', targetDateString === getTodayDateString());
        dayHeader.innerHTML = `${formatDateForDisplay(targetDateString)} ${targetDateString === getTodayDateString() ? '<span>(Dnes)</span>' : ''}`;
        activitiesContainer.innerHTML = '';

        if (activitiesForDay.length > 0) {
            activitiesForDay.forEach(activity => {
                if (!activity.id) return; // Skip if no ID
                const activityElement = document.createElement('div');
                activityElement.className = `activity-list-item ${activity.completed ? 'completed' : ''}`;
                activityElement.dataset.activityId = activity.id;

                const timeDisplay = activity.time_slot ? `<span class="activity-time-display">${activity.time_slot}</span>` : '';
                const iconClass = getActivityIcon(activity.title, activity.type);
                const hasDescription = activity.description && activity.description.trim().length > 0;
                const expandIcon = hasDescription ? `<button class="expand-icon-button btn-tooltip" aria-label="Rozbalit popis" title="Zobrazit/skrýt popis"><i class="fas fa-chevron-down expand-icon"></i></button>` : '';

                let activityLinkStart = '';
                let activityLinkEnd = '';
                // Make "theory" type activities clickable if plan is active
                if (activity.type === 'theory' && state.currentStudyPlan?.status === 'active') {
                    activityLinkStart = `<a href="/dashboard/procvicovani/vyuka/vyuka.html?planActivityId=${activity.id}" class="activity-link">`;
                    activityLinkEnd = `</a>`;
                }

                activityElement.innerHTML = `
                    <span class="math-inline">\{activityLinkStart\}
<label class\="activity\-checkbox"\>
<input type\="checkbox" id\="carousel\-activity\-</span>{activity.id}" <span class="math-inline">\{activity\.completed ? 'checked' \: ''\} data\-activity\-id\="</span>{activity.id}" data-plan-id="${state.currentStudyPlan.id}">
                    </label>
                    <i class="fas <span class="math-inline">\{iconClass\} activity\-icon"\></i\>
<div class\="activity\-details"\>
<div class\="activity\-header"\>
<div class\="activity\-title\-time"\>
<span class\="activity\-title"\></span>{sanitizeHTML(activity.title || 'Aktivita')}</span>
                                ${timeDisplay}
                            </div>
                            ${expandIcon}
                        </div>
                        ${hasDescription ? `<div class="activity-desc">${sanitizeHTML(activity.description)}</div>` : ''}
                    </div>
                    ${activityLinkEnd}`;

                const expandButtonElem = activityElement.querySelector('.expand-icon-button');
                if (expandButtonElem) {
                    expandButtonElem.addEventListener('click', (e) => {
                        e.preventDefault(); // Prevent link navigation if present
                        e.stopPropagation(); // Prevent bubbling to link
                        const descElement = activityElement.querySelector('.activity-desc');
                        if (descElement) {
                            activityElement.classList.toggle('expanded');
                        }
                    });
                }
                const checkbox = activityElement.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.addEventListener('click', (e) => e.stopPropagation()); // Prevent link navigation
                    checkbox.addEventListener('change', async (e) => {
                        e.stopPropagation(); // Prevent bubbling
                        const isCompleted = e.target.checked;
                        activityElement.classList.toggle('completed', isCompleted);
                        await handleActivityCompletionToggle(activity.id, isCompleted, state.currentStudyPlan.id);
                    });
                }
                activitiesContainer.appendChild(activityElement);
            });
        } else {
            activitiesContainer.innerHTML = `<div class="no-activities-day"><i class="fas fa-coffee"></i> Žádné aktivity pro tento den. Užijte si volno!</div>`;
        }

        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'flex';
        if (ui.currentPlanEmptyState) ui.currentPlanEmptyState.style.display = 'none';

        updateNavigationButtonsState(targetDateString);
        initTooltips(); // Re-initialize tooltips for new buttons
        setLoadingState('currentPlan', false); // Use 'currentPlan'

        requestAnimationFrame(() => {
            dayCard.style.transition = 'opacity 0.3s ease-in-out';
            dayCard.style.opacity = '1';
        });
    };

    const updateNavigationButtonsState = (currentDateString) => {
        if (!ui.prevDayBtn || !ui.nextDayBtn || !state.sortedActivityDates || state.sortedActivityDates.length === 0) {
            if(ui.prevDayBtn) ui.prevDayBtn.style.display = 'none';
            if(ui.nextDayBtn) ui.nextDayBtn.style.display = 'none';
            return;
        }

        const currentIndex = state.sortedActivityDates.indexOf(currentDateString);

        ui.prevDayBtn.style.display = 'inline-flex';
        ui.nextDayBtn.style.display = 'inline-flex';

        ui.prevDayBtn.disabled = currentIndex <= 0;
        ui.nextDayBtn.disabled = currentIndex >= state.sortedActivityDates.length - 1;
    };

    const renderPromptCreatePlan = (container) => {
        // Assuming ui.promptCreatePlanTemplate is defined in the HTML and cached in ui object
        if (!container || !ui.promptCreatePlanTemplate) return;
        console.log("[Render] Rendering Prompt Create Plan...");
        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';

        const node = ui.promptCreatePlanTemplate.content.cloneNode(true);
        const btn = node.getElementById('createNewPlanFromPromptBtn'); // ID from plan.html template
        if (btn) {
            btn.addEventListener('click', () => {
                // For main.html, this should redirect to plan.html#create
                window.location.href = 'plan.html?tab=create';
            });
        }
        container.innerHTML = '';
        container.appendChild(node);
        container.style.display = 'flex';
        console.log("[Render] Prompt Create Plan Rendered.");
    };
    const renderNoActivePlan = (container) => {
        if (!container || !ui.noActivePlanTemplate) return;
        console.log("[Render] Rendering No Active Plan...");
        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';

        const node = ui.noActivePlanTemplate.content.cloneNode(true);
        const linkToCreate = node.querySelector('.link-to-create-tab');
        if(linkToCreate) {
            linkToCreate.addEventListener('click', (e) => {
                e.preventDefault();
                // For main.html, redirect to plan.html#create
                window.location.href = 'plan.html?tab=create';
            });
        }
        container.innerHTML = '';
        container.appendChild(node);
        container.style.display = 'flex';
        console.log("[Render] No Active Plan Rendered.");
    };
    const handleActivityCompletionToggle = async (activityId, isCompleted, planId) => { if (!supabaseClient || !planId) return; try { const { error } = await supabaseClient.from('plan_activities').update({ completed: isCompleted, updated_at: new Date().toISOString() }).eq('id', activityId); if (error) throw error; console.log(`[ActivityToggle] Aktivita ${activityId} stav: ${isCompleted}`); await updatePlanProgress(planId); } catch (error) { console.error(`[ActivityToggle] Chyba aktualizace aktivity ${activityId}:`, error); showToast('Nepodařilo se aktualizovat stav aktivity.', 'error'); const checkbox = document.getElementById(`carousel-activity-${activityId}`); const activityElement = checkbox?.closest('.activity-list-item'); if(checkbox) checkbox.checked = !isCompleted; if(activityElement) activityElement.classList.toggle('completed', !isCompleted); } };
    const updatePlanProgress = async (planId) => { if (!planId || !supabaseClient) return; console.log(`[PlanProgress] Updating progress for plan ${planId}`); try { const { count: totalCount, error: countError } = await supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId); const { count: completedCount, error: completedError } = await supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId).eq('completed', true); if (countError || completedError) throw countError || completedError; const numTotal = totalCount ?? 0; const numCompleted = completedCount ?? 0; const progress = numTotal > 0 ? Math.round((numCompleted / numTotal) * 100) : 0; console.log(`[PlanProgress] Plan ${planId}: <span class="math-inline">\{numCompleted\}/</span>{numTotal} completed (${progress}%)`); const { error: updateError } = await supabaseClient.from('study_plans').update({ progress: progress, updated_at: new Date().toISOString() }).eq('id', planId); if (updateError) throw updateError; console.log(`[PlanProgress] Plan ${planId} progress DB updated to ${progress}%`); if (state.currentStudyPlan?.id === planId) state.currentStudyPlan.progress = progress; } catch (error) { console.error(`[PlanProgress] Error updating plan progress ${planId}:`, error); } };
    const getActivityIcon = (title = "", type = "") => {
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
    async function getLatestDiagnosticTest(userId, showLoaderFlag = true) {
        // This function is primarily for plan.js logic.
        // On main.html, it might be used to determine if diagnostic prompt is shown.
        if (!userId || !supabaseClient) return null;
        if (showLoaderFlag) setLoadingState('page', true); // Or a more specific loader if available
        try {
            const { data, error } = await supabaseClient
                .from('user_diagnostics')
                .select('id, completed_at, total_score, total_questions, topic_results, analysis')
                .eq('user_id', userId)
                .order('completed_at', { ascending: false })
                .limit(1);
            if (error) throw error;
            state.latestDiagnosticTest = (data && data.length > 0) ? data[0] : false; // false if no test found
            return state.latestDiagnosticTest;
        } catch (error) {
            console.error("Error fetching latest diagnostic test:", error);
            state.latestDiagnosticTest = null; // Error occurred
            return null;
        } finally {
            if (showLoaderFlag) setLoadingState('page', false);
        }
    }


    function setupEventListeners() {
        console.log("[SETUP Main] Setting up event listeners for main.html...");
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);
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
                !ui.notificationBell?.contains(event.target)) { // Ensure bell click doesn't close it
                ui.notificationsDropdown.classList.remove('active');
            }
        });

        if(ui.refreshDataBtn) {
            ui.refreshDataBtn.addEventListener('click', async () => {
                showToast("Obnovuji data...", "info", 2000);
                setLoadingState('all', true); // Generic loading state

                // Reload data based on the currently active tab
                if (state.currentMainTab === 'practice-tab') {
                    await loadDashboardStats();
                    await loadTopicProgress();
                    if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderAll === 'function' && state.currentUser) {
                         await DashboardLists.loadAndRenderAll(state.currentUser.id, 5);
                    }
                } else if (state.currentMainTab === 'current') {
                    await loadCurrentStudyPlanData();
                }
                // Add other tab refresh logic if needed

                setLoadingState('all', false);
                showToast("Data obnovena!", "success");
            });
        }

        // Goal Modal Listeners
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
                let details = { goal_set_timestamp: new Date().toISOString() }; // Basic detail

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
                    details.topic_ratings = {}; // Initialize
                    if (ui.topicRatingsContainer) {
                        ui.topicRatingsContainer.querySelectorAll('.rating-stars').forEach(rs => {
                            const topicId = rs.dataset.topicId;
                            const rating = rs.dataset.currentRating; // Get stored rating
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
                window.location.href = 'test1.html'; // Redirect to the test page
            });
        }

        console.log("✅ [SETUP Main] Event listeners set up for main.html.");
    }

    async function initializeApp() {
        console.log("🚀🚀🚀 [Init Main - DEBUG] procvicovani/main.js initializeApp CALLED! 🚀🚀🚀");
        console.log("🚀 [Init Main] Starting application...");
        setLoadingState('page', true);
        if (!initializeSupabase()) {
            setLoadingState('page', false);
            showGlobalError("Kritická chyba: Nelze inicializovat databázi.");
            if(ui.mainContent) ui.mainContent.style.display = 'block'; // Show main content to display global error
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
                if(ui.mainContent) ui.mainContent.style.display = 'block';
                return;
            }
            updateSidebarProfile(); // Update sidebar with fetched profile and titles
            updateUserGoalDisplay(); // Update goal display in header
            setupEventListeners(); // Setup listeners AFTER initial data fetch
            initTooltips();
            initMouseFollower();
            initHeaderScrollDetection();
            updateCopyrightYear();
            updateOnlineStatus();

            // Fetch notifications
            fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
                .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                .catch(err => {
                    console.error("Failed to load notifications initially:", err);
                    renderNotifications(0, []); // Render empty on error
                });

            // Check user setup status
            const { completedGoalSetting, completedDiagnostic } = await checkUserInitialSetup(state.currentUser.id);
            state.hasCompletedGoalSetting = completedGoalSetting;
            state.hasCompletedDiagnostic = completedDiagnostic;

            if (!completedGoalSetting) {
                showGoalSelectionModal();
            } else if (!completedDiagnostic && state.currentProfile?.learning_goal !== 'math_explore') {
                showDiagnosticPrompt(); // Show prompt to take diagnostic test
                // Show tabs and practice content even if diagnostic is needed
                if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');}
                if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');}
                await switchTabContent("practice-tab"); // Default to practice tab
            } else {
                // Goal is set, and diagnostic is done (or not needed for 'math_explore')
                if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none';
                if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');}
                if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');}

                const urlParams = new URLSearchParams(window.location.search);
                const initialTab = urlParams.get('tab') || 'practice-tab'; // Default to practice
                await switchTabContent(initialTab);
            }

            if (ui.mainContent) {
                ui.mainContent.style.display = 'flex'; // Changed from block to flex for proper layout
                requestAnimationFrame(() => {
                    if(ui.mainContent) ui.mainContent.classList.add('loaded');
                    initScrollAnimations();
                });
            }
            console.log("✅ [Init Main] Page Initialized.");

        } catch (error) {
            console.error("❌ [Init Main] Critical initialization error:", error);
            showGlobalError(`Chyba inicializace: ${error.message}`);
            if(ui.mainContent) ui.mainContent.style.display = 'flex'; // Ensure main content is visible for error
        } finally {
            setLoadingState('page', false);
        }
    }

    document.addEventListener('DOMContentLoaded', initializeApp);

})();
// --- Developer Edit Log ---
// Goal: Fix scrolling, improve "Plán" tab display, ensure correct tab styling.
// Stage:
// 1. Scrolling: Ensured `main#main-content` is `display: flex; flex-direction: column; overflow: hidden;`
//    and `.main-content-wrapper` is `flex-grow: 1; overflow-y: auto;`. This is the standard and correct way for this layout.
//    The issue might have been related to how tab content was managed.
// 2. Plan Display ("Aktuální plán" / Carousel):
//    - The "Plán" tab corresponds to the `id="currentPlanSection"` in `main.html`.
//    - Ensured `switchTabContent` correctly shows `currentPlanSection` and calls `loadCurrentStudyPlanData`.
//    - `loadCurrentStudyPlanData` now directly calls the plan rendering logic (`loadCurrentPlan`, `renderSingleDayPlan` etc.) which were merged from `plan.js`.
//    - `renderSingleDayPlan` and related functions have been reviewed to ensure they populate `ui.singleDayPlanView` within `ui.currentPlanSection`.
//    - Corrected ID selectors for goal setting elements (e.g., `accelerate_grade_profile`).
//    - Ensured skeleton loaders for the plan tab are managed by `setLoadingState('currentPlan', ...)`.
// 3. Tab Styles: CSS for `.plan-tab` has been reviewed in `main.css` to use theme variables correctly, ensuring they are not white.
// 4. Merged Relevant Logic from `plan.js`:
//    - Functions related to loading, grouping, and rendering the current study plan (`loadCurrentPlan`, `groupActivitiesByDayAndDateArray`, `renderSingleDayPlan`, `updateNavigationButtonsState`, `renderPromptCreatePlan`, `renderNoActivePlan`, `handleActivityCompletionToggle`, `updatePlanProgress`, `getActivityIcon`, `getLatestDiagnosticTest`) have been integrated directly into `main.js`.
//    - This is because `main.html` now directly handles the "Plán" tab view.
//    - State variables related to the current plan are now part of `main.js`'s `state` object.
//    - UI elements specific to the plan view are cached in `main.js`'s `ui` object.
//    - Event listeners for plan navigation (`prevDayBtn`, `nextDayBtn`) are set up in `main.js`.
// 5. General Code Review:
//    - Corrected element IDs used in `cacheDOMElements` to match `main.html`.
//    - Ensured `setLoadingState` correctly handles the `'currentPlan'` key for the plan tab.
//    - Ensured `switchTabContent` correctly manages the display of `ui.currentPlanSection` and `ui.practiceTabContent`/`ui.vyukaTabContent`.
//    - The functions for "Historie plánů" and "Vytvořit nový" (if user clicks buttons in empty states of "Plán" tab) now redirect to `plan.html` with appropriate query parameters as those full functionalities reside there.
// ---