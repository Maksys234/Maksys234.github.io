// procvicovani/main.js
// This script is intended for procvicovani/main.html (Přehled Procvičování)
// It includes logic for the main overview, stats, shortcuts, topic progress,
// and also incorporates functions for displaying the current study plan (carousel)
// and managing goal settings, similar to plan.js but integrated for main.html's context.

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
        mainContent: document.getElementById('main-content'),
        sidebar: document.getElementById('sidebar'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
        sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
        sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
        sidebarName: document.getElementById('sidebar-name'),
        sidebarAvatar: document.getElementById('sidebar-avatar'),
        sidebarUserTitle: document.getElementById('sidebar-user-title'),
        toastContainer: document.getElementById('toastContainer'), // Corrected ID from main.html (was toastContainer)
        globalError: document.getElementById('global-error'),

        // Elements specific to main.html structure
        dashboardTitle: document.getElementById('dashboard-title'),
        userGoalDisplay: document.getElementById('user-goal-display'),
        refreshDataBtn: document.getElementById('refresh-data-btn'),
        diagnosticPrompt: document.getElementById('diagnostic-prompt'),
        startTestBtnPrompt: document.getElementById('start-test-btn-prompt'),
        tabsWrapper: document.getElementById('tabs-wrapper'),
        contentTabs: document.querySelectorAll('#tabs-wrapper .plan-tab'), // Tabs in main.html
        mainTabContentArea: document.getElementById('main-tab-content-area'),
        practiceTabContent: document.getElementById('practice-tab-content'), // "Obecné"
        vyukaTabContent: document.getElementById('vyuka-tab-content'),     // "Výuka"

        // Stats and shortcuts (inside practice-tab-content)
        statsCardsContainer: document.getElementById('stats-cards'),
        shortcutsGrid: document.getElementById('shortcuts-grid'),
        topicProgressSection: document.getElementById('topic-progress-section'),
        topicProgressTableBody: document.getElementById('topic-progress-body'),
        topicProgressTableLoadingOverlay: document.getElementById('topic-progress-table-loading-overlay'),
        topicProgressEmptyState: document.getElementById('topic-progress-empty-state'),
        topicProgressTable: document.getElementById('topic-progress-table'),


        // Goal Selection Modal elements
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

        // Elements from plan.js context (also used in main.html's "Plán" tab)
        planTabs: document.querySelectorAll('.plan-tab'), // Generic selector, might pick up main.html tabs too
        currentPlanSection: document.getElementById('currentPlanSection'), // This is for the "Plán" tab content
        currentPlanLoader: document.getElementById('currentPlanLoader'),
        dailyPlanCarouselContainer: document.getElementById('dailyPlanCarouselContainer'),
        singleDayPlanView: document.getElementById('singleDayPlanView'),
        prevDayBtn: document.getElementById('prevDayBtn'),
        nextDayBtn: document.getElementById('nextDayBtn'),
        currentPlanEmptyState: document.getElementById('currentPlanEmptyState'),
        historyPlanSection: document.getElementById('historyPlanSection'), // Not present in main.html
        historyLoader: document.getElementById('historyLoader'),           // Not present in main.html
        historyPlanContent: document.getElementById('historyPlanContent'), // Not present in main.html
        createPlanSection: document.getElementById('createPlanSection'),   // Not present in main.html
        createPlanLoader: document.getElementById('createPlanLoader'),     // Not present in main.html
        createPlanContent: document.getElementById('createPlanContent'),   // Not present in main.html
        planSection: document.getElementById('planSection'),               // Not present in main.html (detail view from plan.html)
        planLoading: document.getElementById('planLoading'),               // Not present in main.html
        planSectionTitle: document.getElementById('plan-section-title'),   // Not present in main.html
        planContent: document.getElementById('planContent'),               // Not present in main.html
        planActions: document.getElementById('planActions'),               // Not present in main.html
        genericBackBtn: document.getElementById('genericBackBtn'),         // Not present in main.html
        notificationBell: document.getElementById('notification-bell'),
        notificationCount: document.getElementById('notification-count'),
        notificationsDropdown: document.getElementById('notifications-dropdown'),
        notificationsList: document.getElementById('notifications-list'),
        noNotificationsMsg: document.getElementById('no-notifications-msg'),
        markAllReadBtn: document.getElementById('mark-all-read'),
        lockedPlanTemplate: document.getElementById('lockedPlanTemplate'),         // For plan.html
        createPlanFormTemplate: document.getElementById('createPlanFormTemplate'), // For plan.html
        noDiagnosticTemplate: document.getElementById('noDiagnosticTemplate'),     // For plan.html
        historyItemTemplate: document.getElementById('historyItemTemplate'),       // For plan.html
        promptCreatePlanTemplate: document.getElementById('promptCreatePlanTemplate'),// For plan.html
        noActivePlanTemplate: document.getElementById('noActivePlanTemplate'),       // For plan.html
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
        latestDiagnosticTest: null, // Renamed from latestDiagnosticData for clarity
        currentStudyPlan: null,     // Active study plan for the "Plán" tab
        allTitles: [],              // User titles
        currentMainTab: 'practice-tab', // Active tab in main.html
        isLoading: {
            page: true, // Overall page load
            stats: false,
            topicProgress: false,
            currentPlan: false, // For the "Plán" tab in main.html
            goalModal: false,
            notifications: false,
            titles: false,
            // from plan.js context, might not be fully used here
            history: false, create: false, detail: false, schedule: false, generation: false,
        },
        hasCompletedGoalSetting: false,
        hasCompletedDiagnostic: false,
        allExamTopicsAndSubtopics: [], // For goal setting modal (math_review)

        // From plan.js context (for "Plán" tab in main.html)
        planCreateAllowed: false,
        nextPlanCreateTime: null,
        planTimerInterval: null,
        lastGeneratedMarkdown: null,
        lastGeneratedActivitiesJson: null,
        lastGeneratedTopicsData: null,
        currentDisplayDate: null, // For the daily plan carousel
        allActivePlanActivitiesByDay: {},
        sortedActivityDates: [],
        planStartDate: null,
        planEndDate: null,
    };

    const activityVisuals = { /* ... same as before ... */
        test: { name: 'Test', icon: 'fa-vial', class: 'test' },
        exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' },
        practice: { name: 'Procvičování', icon: 'fa-dumbbell', class: 'practice' },
        example: { name: 'Příklad', icon: 'fa-lightbulb', class: 'example' },
        review: { name: 'Opakování', icon: 'fa-history', class: 'review' },
        theory: { name: 'Teorie', icon: 'fa-book-open', class: 'theory' },
        analysis: { name: 'Analýza', icon: 'fa-chart-pie', class: 'analysis' },
        other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' },
        default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
    };

    // ==============================================
    //          Помощники (Utility Functions)
    // ==============================================
    const formatDateForDisplay = (dateStringOrDate) => { /* ... same as before ... */
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
    const getTodayDateString = () => { /* ... same as before ... */
        const today = new Date();
        return dateToYYYYMMDD(today);
    };
    const dateToYYYYMMDD = (date) => { /* ... same as before ... */
        if (!(date instanceof Date) || isNaN(date)) return null;
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const addDaysToDate = (dateString, days) => { /* ... same as before ... */
        const date = new Date(dateString + 'T00:00:00');
        date.setDate(date.getDate() + days);
        return dateToYYYYMMDD(date);
    };
    const formatDate = (dateString) => { /* ... same as before ... */ if(!dateString) return '-'; try { const date = new Date(dateString); return date.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch(e){ return '-'}};
    function showToast(title, message, type = 'info', duration = 4500) { /* ... same as before ... */ if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } };
    const sanitizeHTML = (str) => { /* ... same as before ... */ const t = document.createElement('div'); t.textContent = str || ''; return t.innerHTML; };
    const getInitials = (profileData, email) => { /* ... same as before ... */
        if (!profileData && !email) return '?';
        let i = '';
        if (profileData?.first_name) i += profileData.first_name[0];
        if (profileData?.last_name) i += profileData.last_name[0];
        if (i) return i.toUpperCase();
        if (profileData?.username) return profileData.username[0].toUpperCase();
        if (email) return email[0].toUpperCase();
        return 'P';
    };
    const openMenu = () => { /* ... same as before ... */
        if (ui.sidebar && ui.sidebarOverlay) {
            document.body.classList.remove('sidebar-collapsed');
            ui.sidebar.classList.add('active');
            ui.sidebarOverlay.classList.add('active');
        }
    };
    const closeMenu = () => { /* ... same as before ... */
        if (ui.sidebar && ui.sidebarOverlay) {
            ui.sidebar.classList.remove('active');
            ui.sidebarOverlay.classList.remove('active');
        }
    };
    const initTooltips = () => { /* ... same as before ... */ try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } };
    const showGlobalError = (message) => { /* ... same as before ... */ if(ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i><div>${sanitizeHTML(message)}</div></div>`; ui.globalError.style.display = 'block';} };
    const hideGlobalError = () => { /* ... same as before ... */ if(ui.globalError) ui.globalError.style.display = 'none'; };
    const formatRelativeTime = (timestamp) => { /* ... same as before ... */ if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    const updateCopyrightYear = () => { /* ... same as before ... */ const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
    const initMouseFollower = () => { /* ... same as before ... */ const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { /* ... same as before ... */ const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
    const initHeaderScrollDetection = () => { /* ... same as before ... */ let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); };
    const updateOnlineStatus = () => { /* ... same as before ... (offline banner not in main.html by default) */ if (ui.offlineBanner) {ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; }};
    function applyInitialSidebarState() { /* ... same as before ... */
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
    function toggleSidebar() { /* ... same as before ... */
        try {
            const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded');
            const icon = ui.sidebarToggleBtn?.querySelector('i');
            if (icon) { icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; }
            if(ui.sidebarToggleBtn) { ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; }
        } catch (error) { console.error("[ToggleSidebar] Chyba:", error); }
    }
    const setLoadingState = (sectionKey, isLoadingFlag) => { /* ... adapted from plan.js, simplified for main.html context ... */
        if (state.isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;
        if (sectionKey === 'all') { Object.keys(state.isLoading).forEach(key => state.isLoading[key] = isLoadingFlag); }
        else { state.isLoading[sectionKey] = isLoadingFlag; }
        console.log(`[Loading - Main] ${sectionKey}: ${isLoadingFlag}`);

        if (sectionKey === 'stats') {
            ui.statsCardsContainer?.classList.toggle('loading', isLoadingFlag);
        } else if (sectionKey === 'topicProgress') {
            ui.topicProgressTableLoadingOverlay?.classList.toggle('visible-loader', isLoadingFlag);
            ui.topicProgressTable?.classList.toggle('hidden-while-loading', isLoadingFlag);
        } else if (sectionKey === 'currentPlan') { // For the "Plán" tab
            ui.currentPlanLoader?.classList.toggle('visible-loader', isLoadingFlag);
            // ui.dailyPlanCarouselContainer might be hidden/shown by other logic
        } else if (sectionKey === 'notifications') {
            if(ui.notificationBell) ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
            if (ui.markAllReadBtn) {
                const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
            }
            if (isLoadingFlag && ui.notificationsList) renderNotificationSkeletons(2);
        } else if (sectionKey === 'page') {
            if (ui.initialLoader) {
                if(isLoadingFlag) {
                    ui.initialLoader.style.display = 'flex';
                    ui.initialLoader.classList.remove('hidden');
                } else {
                    ui.initialLoader.classList.add('hidden');
                    setTimeout(() => { if(ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500);
                }
            }
        }
    };
    const renderMessage = (container, type = 'info', title, message, addButtons = []) => { /* ... same as from plan.js ... */
        if (!container) { console.error("renderMessage: Container not found!"); return; }
        console.log(`[RenderMessage] Rendering into:`, container.id || container.className, `Type: ${type}, Title: ${title}`);
        const iconMap = { info: 'fa-info-circle', warning: 'fa-exclamation-triangle', error: 'fa-exclamation-circle' };
        let buttonsHTML = '';
        addButtons.forEach(btn => {
            buttonsHTML += `<button class="btn ${btn.class || 'btn-primary'}" id="${btn.id}" ${btn.disabled ? 'disabled' : ''}>${btn.icon ? `<i class="fas ${btn.icon}"></i> ` : ''}${sanitizeHTML(btn.text)}</button>`;
        });
        container.innerHTML = `<div class="notest-message ${type}"><h3><i class="fas ${iconMap[type]}"></i> ${sanitizeHTML(title)}</h3><p>${sanitizeHTML(message)}</p><div class="action-buttons">${buttonsHTML}</div></div>`;
        container.classList.add('content-visible'); // Ensure this class is managed if it affects display
        container.style.display = 'flex'; // Common display style for these messages

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
    const initializeSupabase = () => { /* ... same as before ... */ try { if (!window.supabase) throw new Error("Supabase library not loaded."); supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey); console.log("Supabase client initialized."); return true; } catch (error) { console.error("Supabase init failed:", error); showGlobalError("Chyba připojení k databázi."); return false; } };

    async function fetchUserProfile(userId) { /* ... same as before ... */
        if (!userId || !supabaseClient) return null;
        setLoadingState('titles', true);
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*, selected_title, preferences, longest_streak_days, learning_goal')
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows found, which is fine if creating new
            setLoadingState('titles', false);
            return data; // Can be null if no profile and no error other than PGRST116
        } catch (e) {
            console.error("Profile fetch error:", e);
            setLoadingState('titles', false);
            return null;
        }
    }

    async function fetchTitles() { /* ... same as before ... */
        if (!supabaseClient) return [];
        console.log("[Titles] Fetching available titles...");
        setLoadingState('titles', true); // Assuming setLoadingState handles 'titles'
        try {
            const { data, error } = await supabaseClient.from('title_shop').select('title_key, name');
            if (error) throw error;
            console.log("[Titles] Fetched titles:", data);
            return data || [];
        } catch (error) {
            console.error("[Titles] Catch block error fetching titles:", error.message);
            showToast("Chyba", "Nepodařilo se načíst dostupné tituly.", "error");
            return [];
        } finally {
            setLoadingState('titles', false);
        }
    }

    function updateSidebarProfile() { /* ... same as before, uses state.allTitles ... */
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[SidebarUI] Chybí elementy postranního panelu pro profil."); return; }
        if (state.currentProfile && state.currentUser) {
            const profile = state.currentProfile; const user = state.currentUser;
            const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || user.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(profile, user.email);
            let avatarUrl = profile.avatar_url;
            if (avatarUrl && !avatarUrl.startsWith('http') && avatarUrl.includes('/')) { finalAvatarUrl = sanitizeHTML(avatarUrl); }
            else if (avatarUrl) { finalAvatarUrl = `${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`; }
            else { finalAvatarUrl = null; }
            ui.sidebarAvatar.innerHTML = finalAvatarUrl ? `<img src="${finalAvatarUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
            const img = ui.sidebarAvatar.querySelector('img');
            if (img) { img.onerror = function() { console.warn(`[SidebarUI] Nepodařilo se načíst avatar: ${this.src}. Zobrazuji iniciály.`); ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; }
            const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot';
            if (selectedTitleKey && state.allTitles && state.allTitles.length > 0) {
                const foundTitle = state.allTitles.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) { displayTitle = foundTitle.name; }
                else { console.warn(`[SidebarUI] Titul s klíčem "${selectedTitleKey}" nebyl nalezen.`); }
            } else if (selectedTitleKey) { console.warn(`[SidebarUI] Klíč titulu "${selectedTitleKey}" je přítomen, ale state.allTitles je prázdný.`); }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle));
        } else { ui.sidebarName.textContent = "Nepřihlášen"; ui.sidebarAvatar.textContent = '?'; ui.sidebarUserTitle.textContent = 'Pilot'; ui.sidebarUserTitle.removeAttribute('title'); }
    }

    async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) { /* ... same as before ... */ if (!supabaseClient || !userId) { console.error("[Notifications] Missing Supabase client or User ID."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Fetching unread notifications for user ${userId}`); setLoadingState('notifications', true); try { const { data, error, count } = await supabaseClient.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; console.log(`[Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } finally { setLoadingState('notifications', false); } }
    function renderNotifications(count, notifications) { /* ... same as before ... */ console.log("[Render Notifications] Start, Count:", count, "Notifications:", notifications); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements."); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.toggle('has-content', notifications && notifications.length > 0); console.log("[Render Notifications] Finished"); }
    function renderNotificationSkeletons(count = 2) { /* ... same as before ... */ if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    async function markNotificationRead(notificationId) { /* ... same as before ... */ console.log("[Notifications] Marking notification as read:", notificationId); if (!state.currentUser || !notificationId) return false; try { const { error } = await supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[Notifications] Mark as read successful for ID:", notificationId); return true; } catch (error) { console.error("[Notifications] Mark as read error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { /* ... same as before ... */ console.log("[Notifications] Marking all as read for user:", state.currentUser?.id); if (!state.currentUser || !ui.markAllReadBtn) return; setLoadingState('notifications', true); try { const { error } = await supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('is_read', false); if (error) throw error; console.log("[Notifications] Mark all as read successful"); const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[Notifications] Mark all as read error:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); } finally { setLoadingState('notifications', false); } }

    // Functions for initial setup (goal, diagnostic) - specific to main.html
    async function checkUserInitialSetup(userId) {
        console.log("[InitialSetupCheck] Checking setup for user:", userId);
        if (!state.currentProfile) {
            console.warn("[InitialSetupCheck] Profile not loaded, cannot check setup.");
            return { completedGoalSetting: false, completedDiagnostic: false };
        }
        const completedGoalSetting = !!state.currentProfile.learning_goal;
        let completedDiagnostic = false;
        if (completedGoalSetting && state.currentProfile.learning_goal !== 'math_explore') {
            // For 'math_explore', diagnostic is not strictly mandatory to show main content
            // but for other goals, it is.
            const diagnostic = await getLatestDiagnosticTest(userId, false); // Don't show loader for this internal check
            completedDiagnostic = !!(diagnostic && diagnostic.completed_at);
        } else if (completedGoalSetting && state.currentProfile.learning_goal === 'math_explore') {
            completedDiagnostic = true; // Considered "done" for explore goal for UI flow
        }
        console.log(`[InitialSetupCheck] Goal set: ${completedGoalSetting}, Diagnostic done (for current goal type): ${completedDiagnostic}`);
        return { completedGoalSetting, completedDiagnostic };
    }

    function showGoalSelectionModal() {
        console.log("[GoalModal] Showing goal selection modal.");
        if (ui.goalSelectionModal) {
            ui.goalSelectionModal.style.display = 'flex';
            // Reset to first step
            ui.goalModalSteps.forEach(step => step.classList.remove('active'));
            document.getElementById('goal-step-1')?.classList.add('active');
            // Clear previous selections
            ui.goalRadioLabels.forEach(label => {
                label.classList.remove('selected-goal');
                const radio = label.querySelector('input[type="radio"]');
                if (radio) radio.checked = false;
            });
            // Pre-select if profile has a goal
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
        state.selectedLearningGoal = selectedGoal; // Store temporarily

        // Show next step or confirm
        let nextStepId = null;
        if (selectedGoal === 'math_accelerate') nextStepId = 'goal-step-accelerate';
        else if (selectedGoal === 'math_review') nextStepId = 'goal-step-review';
        else if (selectedGoal === 'math_explore') nextStepId = 'goal-step-explore';
        // For 'exam_prep', there's no immediate second step, confirm directly.

        if (nextStepId) {
            ui.goalModalSteps.forEach(step => step.classList.remove('active'));
            document.getElementById(nextStepId)?.classList.add('active');
            if (selectedGoal === 'math_review') loadTopicsForGradeReview();
        } else if (selectedGoal === 'exam_prep') {
            // Directly confirm for exam_prep
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
                    .select(`
                        id, name,
                        subtopics:exam_subtopics (id, name, topic_id)
                    `)
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

    function populateTopicRatings() { /* ... same as before ... */
        if (!ui.topicRatingsContainer) return;
        ui.topicRatingsContainer.innerHTML = ''; // Clear previous
        if (!state.allExamTopicsAndSubtopics || state.allExamTopicsAndSubtopics.length === 0) {
            ui.topicRatingsContainer.innerHTML = '<p>Žádná témata k hodnocení.</p>';
            return;
        }
        // For simplicity, let's only rate main topics for now. Can be expanded.
        state.allExamTopicsAndSubtopics.filter(topic => topic.name !== "Smíšené úlohy").forEach(topic => { // Filter out "Smíšené úlohy"
            const item = document.createElement('div');
            item.className = 'topic-rating-item';
            item.innerHTML = `
                <span class="topic-name">${sanitizeHTML(topic.name)}</span>
                <div class="rating-stars" data-topic-id="${topic.id}">
                    ${[1, 2, 3, 4, 5].map(val => `<i class="fas fa-star star" data-value="${val}" aria-label="${val} hvězdiček"></i>`).join('')}
                </div>
            `;
            item.querySelectorAll('.star').forEach(star => {
                star.addEventListener('click', function() {
                    const value = parseInt(this.dataset.value);
                    const parentStars = this.parentElement;
                    parentStars.querySelectorAll('.star').forEach((s, i) => {
                        s.classList.toggle('rated', i < value);
                    });
                    parentStars.dataset.currentRating = value; // Store rating
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

        const preferencesUpdate = {
            ...state.currentProfile.preferences, // Preserve existing preferences
            goal_details: details // Add new goal_details
        };

        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({
                    learning_goal: goal,
                    preferences: preferencesUpdate, // Save new preferences structure
                    updated_at: new Date().toISOString()
                })
                .eq('id', state.currentUser.id);

            if (error) throw error;

            // Update local profile state
            if(state.currentProfile) {
                state.currentProfile.learning_goal = goal;
                state.currentProfile.preferences = preferencesUpdate;
            }
            state.hasCompletedGoalSetting = true;

            showToast("Cíl uložen!", `Váš studijní cíl byl nastaven na: ${getGoalDisplayName(goal)}.`, "success");
            hideGoalSelectionModal();
            updateUserGoalDisplay(); // Update display on main page

            // After saving goal, re-check initial setup to show diagnostic prompt or main content
            const { completedDiagnostic } = await checkUserInitialSetup(state.currentUser.id);
            state.hasCompletedDiagnostic = completedDiagnostic;

            if (!completedDiagnostic && goal !== 'math_explore') {
                showDiagnosticPrompt();
                if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');}
                if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');}
                await switchTabContent('practice-tab'); // Show default tab
            } else {
                if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');}
                if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');}
                await switchTabContent('practice-tab'); // Refresh main content
            }

        } catch (error) {
            console.error("Error saving learning goal:", error);
            showToast("Chyba ukládání", `Nepodařilo se uložit cíl: ${error.message}`, "error");
        } finally {
            setLoadingState('goalModal', false);
        }
    }

    function showDiagnosticPrompt() {
        if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'flex';
        if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'block'; // Show tabs even with prompt
        if (ui.mainTabContentArea) ui.mainTabContentArea.style.display = 'flex';
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
            ui.userGoalDisplay.style.display = 'none';
        }
    }

    // Functions for "Obecné" (practice-tab) content
    async function loadDashboardStats() { /* ... same as before, but simplified ... */
        if (!state.currentUser || !supabaseClient) return;
        setLoadingState('stats', true);
        try {
            // This is a placeholder. Real stats would come from aggregated data.
            const stats = [
                { title: "Celkový Pokrok", value: `${state.currentProfile?.overall_progress_percentage || 0}%`, desc: "Váš průměrný pokrok", badge: "Info", icon: "fa-tasks" },
                { title: "Absolvované Testy", value: state.currentProfile?.completed_tests_count || 0, desc: "Počet dokončených testů", badge: "Statistika", icon: "fa-vial" },
                { title: "Denní Série", value: `${state.currentProfile?.streak_days || 0} dní`, desc: `Nejdelší: ${state.currentProfile?.longest_streak_days || 0} dní`, badge: "Motivace", icon: "fa-fire" },
                { title: "Získané Kredity", value: state.currentProfile?.points || 0, desc: "Celkem nasbíraných kreditů", badge: "Body", icon: "fa-star" }
            ];
            renderStatsCards(stats);
        } catch (error) {
            console.error("Error loading dashboard stats:", error);
            if(ui.statsCardsContainer) ui.statsCardsContainer.innerHTML = '<p class="error-message">Statistiky nelze načíst.</p>';
        } finally {
            setLoadingState('stats', false);
        }
    }
    function renderStatsCards(stats) { /* ... same as before ... */
        if (!ui.statsCardsContainer) return;
        ui.statsCardsContainer.innerHTML = '';
        ui.statsCardsContainer.classList.remove('loading');
        if (!stats || stats.length === 0) {
            ui.statsCardsContainer.innerHTML = '<p>Žádné statistiky k zobrazení.</p>';
            return;
        }
        stats.forEach((stat, index) => {
            const card = document.createElement('div');
            card.className = 'dashboard-card card';
            card.setAttribute('data-animate', '');
            card.style.setProperty('--animation-order', index + 1); // For staggered animation
            card.innerHTML = `
                <div class="card-header">
                    <h3 class="card-title">${sanitizeHTML(stat.title)}</h3>
                    ${stat.badge ? `<span class="card-badge ${stat.badge.toLowerCase()}">${sanitizeHTML(stat.badge)}</span>` : ''}
                </div>
                <div class="card-content">
                    <div class="card-value">${sanitizeHTML(String(stat.value))}</div>
                    <p class="card-description">${sanitizeHTML(stat.desc)}</p>
                </div>
                ${stat.footerText ? `<div class="card-footer ${stat.footerClass || ''}">${stat.footerIcon ? `<i class="fas ${stat.footerIcon}"></i>` : ''} ${sanitizeHTML(stat.footerText)}</div>` : ''}
            `;
            ui.statsCardsContainer.appendChild(card);
        });
        initTooltips(); // Re-initialize if tooltips are used on new cards
    }
    async function loadTopicProgress() { /* ... same as before ... */
        if (!state.currentUser || !supabaseClient) return;
        setLoadingState('topicProgress', true);
        try {
            // Placeholder: Fetch aggregated topic progress for the user
            const { data, error } = await supabaseClient
                .rpc('get_user_topic_progress_summary', { p_user_id: state.currentUser.id });

            if (error) throw error;
            renderTopicProgressTable(data || []);
        } catch (error) {
            console.error("Error loading topic progress:", error);
            if(ui.topicProgressTable) ui.topicProgressTable.style.display = 'none';
            if(ui.topicProgressEmptyState) {
                ui.topicProgressEmptyState.innerHTML = '<i class="fas fa-exclamation-circle"></i><h3>Chyba načítání</h3><p>Nepodařilo se načíst pokrok v tématech.</p>';
                ui.topicProgressEmptyState.style.display = 'flex';
            }
        } finally {
            setLoadingState('topicProgress', false);
        }
    }
    function renderTopicProgressTable(topics) { /* ... same as before ... */
        if (!ui.topicProgressTableBody || !ui.topicProgressTable || !ui.topicProgressEmptyState) return;
        ui.topicProgressTableBody.innerHTML = ''; // Clear existing rows or skeletons

        if (!topics || topics.length === 0) {
            ui.topicProgressTable.style.display = 'none';
            ui.topicProgressEmptyState.innerHTML = '<i class="fas fa-book-reader"></i><h3>Žádná data o pokroku</h3><p>Zatím nemáte zaznamenaný žádný pokrok v tématech. Začněte procvičovat!</p>';
            ui.topicProgressEmptyState.style.display = 'flex';
            return;
        }

        ui.topicProgressTable.style.display = 'table';
        ui.topicProgressEmptyState.style.display = 'none';

        topics.sort((a,b) => (b.last_studied_at || 0) - (a.last_studied_at || 0)); // Sort by last studied

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
    function handleSort(event) { /* ... same as before ... */
        const th = event.currentTarget;
        const column = th.dataset.sort;
        // Implement sorting logic for the topic progress table if needed
        console.log("Sorting by:", column);
        showToast("Řazení tabulky", "Funkce řazení bude brzy implementována.", "info");
    }


    // Tab switching logic for main.html's top-level tabs
    async function switchTabContent(tabId) {
        console.log(`[Main Tab Switch] Attempting to switch to tab: ${tabId}`);
        state.currentMainTab = tabId;

        // Update tab button active states
        ui.contentTabs.forEach(tab => { // Uses the cached NodeList for main.html tabs
            tab.classList.toggle('active', tab.dataset.tab === tabId);
            const button = document.getElementById(tab.getAttribute('aria-controls')); // Get button by its aria-controls ID
            if(button) button.setAttribute('aria-selected', tab.dataset.tab === tabId ? 'true' : 'false');
        });

        // Hide all tab content panes first
        document.querySelectorAll('#main-tab-content-area > .tab-content, #main-tab-content-area > .section').forEach(paneOrSection => {
            paneOrSection.classList.remove('active', 'visible-section');
            paneOrSection.style.display = 'none'; // Ensure it's hidden
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
            return;
        }

        if (targetElement) {
            if (targetElement.classList.contains('tab-content')) {
                targetElement.classList.add('active');
                targetElement.style.display = 'block'; // Or 'flex' if it's a flex container based on CSS
            } else if (targetElement.classList.contains('section')) {
                targetElement.classList.add('visible-section'); // This class handles display via CSS
                 // Ensure parent #main-tab-content-area is flex if it's not already
                if(ui.mainTabContentArea) ui.mainTabContentArea.style.display = 'flex';
            }
            console.log(`[Main Tab Switch] Activated element: #${targetElement.id}`);
        }

        // Load content for the new tab
        if (tabId === 'practice-tab') {
            // Content for this tab (stats, topic progress) is typically loaded during initializeApp
            // or can be refreshed if needed.
            await loadDashboardStats();
            await loadTopicProgress();
        } else if (tabId === 'current') {
            await loadCurrentStudyPlanData(); // Specific function to load plan data for main.html's "Plán" tab
        } else if (tabId === 'vyuka-tab') {
            // Placeholder for AI teaching module init if needed
        }
    }

    // Specific function to load data for the "Plán" tab in main.html
    async function loadCurrentStudyPlanData() {
        console.log("[Main.html CurrentPlan] Delegating to plan.js-like logic's loadCurrentPlan...");
        if (typeof loadCurrentPlan === 'function') { // Check if the plan.js-like function is available
            await loadCurrentPlan(); // This function is defined below (from plan.js context)
        } else {
            console.error("[Main.html CurrentPlan] loadCurrentPlan function (from plan.js context) not found!");
            if(ui.currentPlanSection) { // Ensure section exists before trying to render message
                const emptyStateContainer = ui.currentPlanSection.querySelector('#currentPlanEmptyState') || ui.currentPlanSection;
                renderMessage(emptyStateContainer, 'error', 'Chyba', 'Logika pro načtení plánu není dostupná.');
            }
        }
    }


    // =======================================================================================
    //          LOGIC ADAPTED/MERGED FROM plan.js (for "Plán" tab in main.html and plan generation)
    // =======================================================================================
    // Note: Some UI elements in the `ui` cache might be null if this script runs on main.html
    // and those elements only exist on plan.html. Functions should handle this gracefully.

    const groupActivitiesByDayAndDateArray = (activities) => { /* ... same as from plan.js ... */
        state.allActivePlanActivitiesByDay = {}; state.sortedActivityDates = [];
        if (!activities || activities.length === 0) { state.planStartDate = null; state.planEndDate = null; return; }
        const dayToDateMap = {}; let planStartDayOfWeek = activities[0].day_of_week; let referenceDate = new Date();
        let currentDayOfWeek = referenceDate.getDay(); if (currentDayOfWeek === 0) currentDayOfWeek = 7; if (planStartDayOfWeek === 0) planStartDayOfWeek = 7; // Assuming 0=Mon in DB, but JS Date is 0=Sun
        let diffToStartDay = planStartDayOfWeek - currentDayOfWeek;
        referenceDate.setDate(referenceDate.getDate() + diffToStartDay);
        state.planStartDate = new Date(referenceDate); state.planEndDate = new Date(state.planStartDate); state.planEndDate.setDate(state.planStartDate.getDate() + 6);
        for (let i = 0; i < 7; i++) { const currentDate = new Date(state.planStartDate); currentDate.setDate(state.planStartDate.getDate() + i); dayToDateMap[(currentDate.getDay() + 6) % 7] = dateToYYYYMMDD(currentDate); } // 0=Mon .. 6=Sun
        activities.forEach(act => { const dateString = dayToDateMap[act.day_of_week]; if (dateString) { if (!state.allActivePlanActivitiesByDay[dateString]) { state.allActivePlanActivitiesByDay[dateString] = []; } state.allActivePlanActivitiesByDay[dateString].push(act); } else { console.warn(`Activity ID ${act.id} has invalid day_of_week: ${act.day_of_week}`); }});
        state.sortedActivityDates = Object.keys(state.allActivePlanActivitiesByDay).sort();
        if (state.sortedActivityDates.length > 0) { state.planStartDate = new Date(state.sortedActivityDates[0] + 'T00:00:00'); state.planEndDate = new Date(state.sortedActivityDates[state.sortedActivityDates.length - 1] + 'T00:00:00'); } else { state.planStartDate = null; state.planEndDate = null; }
        console.log("[groupActivities] Grouped activities:", state.allActivePlanActivitiesByDay); console.log("[groupActivities] Sorted dates:", state.sortedActivityDates); console.log("[groupActivities] Plan effective start/end:", state.planStartDate, state.planEndDate);
    };

    async function loadCurrentPlan() { /* ... same as from plan.js, targets ui.currentPlanSection ... */
        // This function is called when the "Plán" tab in main.html is activated,
        // or when plan.html loads its 'current' tab.
        if (!supabaseClient || !state.currentUser) return;
        console.log("[CurrentPlan] Loading current plan..."); // Log from plan.js context
        setLoadingState('currentPlan', true); // Use a specific key for main.html's plan tab
        setLoadingState('schedule', true);
        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        if (ui.currentPlanEmptyState) ui.currentPlanEmptyState.style.display = 'none';

        try {
            const { data: plans, error } = await supabaseClient.from('study_plans').select('*').eq('user_id', state.currentUser.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1);
            if (error) throw error;
            if (plans && plans.length > 0) {
                state.currentStudyPlan = plans[0];
                console.log("[CurrentPlan] Active plan found:", state.currentStudyPlan.id);
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
                console.log("[CurrentPlan] No active plan found. Checking diagnostic...");
                if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
                const diagnostic = await getLatestDiagnosticTest(state.currentUser.id, false); // Use the correct name
                if (diagnostic === null) { renderMessage(ui.currentPlanEmptyState, 'error', 'Chyba načítání diagnostiky', 'Nepodařilo se ověřit stav vašeho diagnostického testu.'); }
                else if (diagnostic) { renderPromptCreatePlan(ui.currentPlanEmptyState); } // Prompt to create based on this diagnostic
                else { renderNoActivePlan(ui.currentPlanEmptyState); } // No diagnostic, no plan
            }
        } catch (error) {
            console.error("[CurrentPlan] Error loading current plan:", error);
            renderMessage(ui.currentPlanEmptyState, 'error', 'Chyba', 'Nepodařilo se načíst aktuální studijní plán.');
            if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        } finally {
            setLoadingState('currentPlan', false); setLoadingState('schedule', false);
            console.log("[CurrentPlan] Loading finished.");
        }
    }

    const renderSingleDayPlan = (targetDateString) => { /* ... same as from plan.js, populates #singleDayPlanView ... */
        console.log(`[RenderSingleDay] Rendering for date: ${targetDateString}`);
        if (!ui.singleDayPlanView || !ui.dayCardTemplate) { console.error("[RenderSingleDay] Missing UI elements."); if(ui.currentPlanEmptyState) renderMessage(ui.currentPlanEmptyState, 'error', 'Chyba zobrazení', 'Nelze zobrazit denní plán.'); if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none'; setLoadingState('schedule', false); return; }
        setLoadingState('schedule', true);
        if (ui.dayCardSkeleton && getComputedStyle(ui.dayCardSkeleton).display !== 'none') { ui.dayCardSkeleton.style.display = 'none'; }
        let dayCard = ui.singleDayPlanView.querySelector('.day-schedule-card:not(.skeleton-day-card)');
        if (!dayCard) { const templateNode = ui.dayCardTemplate.content.cloneNode(true); dayCard = templateNode.querySelector('.day-schedule-card'); if (!dayCard) { console.error("[RenderSingleDay] Failed to clone .day-schedule-card!"); setLoadingState('schedule', false); return; } ui.singleDayPlanView.innerHTML = ''; ui.singleDayPlanView.appendChild(dayCard); }
        const dayHeader = dayCard.querySelector('.day-header'); const activitiesContainer = dayCard.querySelector('.activity-list-container');
        if (!dayHeader || !activitiesContainer) { console.error("[RenderSingleDay] Day header or activity container missing!"); setLoadingState('schedule', false); return; }
        dayCard.style.opacity = '0';
        const activitiesForDay = state.allActivePlanActivitiesByDay[targetDateString] || [];
        activitiesForDay.sort((a, b) => (a.time_slot || '99:99').localeCompare(b.time_slot || '99:99'));
        dayCard.classList.toggle('today', targetDateString === getTodayDateString());
        dayHeader.innerHTML = `${formatDateForDisplay(targetDateString)} ${targetDateString === getTodayDateString() ? '<span>(Dnes)</span>' : ''}`;
        activitiesContainer.innerHTML = '';
        if (activitiesForDay.length > 0) {
            activitiesForDay.forEach(activity => { /* ... (rendering logic for each activity) ... */
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
        updateNavigationButtonsState(targetDateString); initTooltips(); setLoadingState('schedule', false);
        requestAnimationFrame(() => { dayCard.style.transition = 'opacity 0.3s ease-in-out'; dayCard.style.opacity = '1'; });
    };
    const updateNavigationButtonsState = (currentDateString) => { /* ... same as from plan.js ... */
        if (!ui.prevDayBtn || !ui.nextDayBtn || !state.sortedActivityDates || state.sortedActivityDates.length === 0) { if(ui.prevDayBtn) ui.prevDayBtn.style.display = 'none'; if(ui.nextDayBtn) ui.nextDayBtn.style.display = 'none'; return; }
        const currentIndex = state.sortedActivityDates.indexOf(currentDateString);
        ui.prevDayBtn.style.display = 'inline-flex'; ui.nextDayBtn.style.display = 'inline-flex';
        ui.prevDayBtn.disabled = currentIndex <= 0; ui.nextDayBtn.disabled = currentIndex >= state.sortedActivityDates.length - 1;
    };
    const renderPromptCreatePlan = (container) => { /* ... same as from plan.js ... */
        if (!container || !ui.promptCreatePlanTemplate) return; console.log("[Render] Rendering Prompt Create Plan...");
        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        const node = ui.promptCreatePlanTemplate.content.cloneNode(true);
        // Ensure the button inside the template is correctly selected and event listener attached
        const btn = node.querySelector('#createNewPlanFromPromptBtn'); // Changed from getElementById on node itself to querySelector
        if (btn) {
            // For main.html, clicking this should switch to the "Vytvořit nový" tab in main.html context
            btn.addEventListener('click', () => switchTabContent('create')); // Call main.html's tab switcher
        }
        container.innerHTML = ''; container.appendChild(node); container.style.display = 'flex';
        console.log("[Render] Prompt Create Plan Rendered.");
    };
    const renderNoActivePlan = (container) => { /* ... same as from plan.js ... */
        if (!container || !ui.noActivePlanTemplate) return; console.log("[Render] Rendering No Active Plan...");
        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        const node = ui.noActivePlanTemplate.content.cloneNode(true);
        const linkToCreate = node.querySelector('.link-to-create-tab');
        if(linkToCreate) linkToCreate.addEventListener('click', (e) => { e.preventDefault(); switchTabContent('create'); }); // Use main.html's tab switcher
        const linkToTest = node.querySelector('a[href="/dashboard/procvicovani/test1.html"]'); // if needed for specific actions
        container.innerHTML = ''; container.appendChild(node); container.style.display = 'flex';
        console.log("[Render] No Active Plan Rendered.");
    };
    const handleActivityCompletionToggle = async (activityId, isCompleted, planId) => { /* ... same as from plan.js ... */ if (!supabaseClient || !planId) return; try { const { error } = await supabaseClient.from('plan_activities').update({ completed: isCompleted, updated_at: new Date().toISOString() }).eq('id', activityId); if (error) throw error; console.log(`[ActivityToggle] Aktivita ${activityId} stav: ${isCompleted}`); await updatePlanProgress(planId); } catch (error) { console.error(`[ActivityToggle] Chyba aktualizace aktivity ${activityId}:`, error); showToast('Nepodařilo se aktualizovat stav aktivity.', 'error'); const checkbox = document.getElementById(`carousel-activity-${activityId}`) || document.getElementById(`vertical-activity-${activityId}`); const activityElement = checkbox?.closest('.activity-list-item'); if(checkbox) checkbox.checked = !isCompleted; if(activityElement) activityElement.classList.toggle('completed', !isCompleted); } };
    const updatePlanProgress = async (planId) => { /* ... same as from plan.js ... */ if (!planId || !supabaseClient) return; console.log(`[PlanProgress] Updating progress for plan ${planId}`); try { const { count: totalCount, error: countError } = await supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId); const { count: completedCount, error: completedError } = await supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId).eq('completed', true); if (countError || completedError) throw countError || completedError; const numTotal = totalCount ?? 0; const numCompleted = completedCount ?? 0; const progress = numTotal > 0 ? Math.round((numCompleted / numTotal) * 100) : 0; console.log(`[PlanProgress] Plan ${planId}: ${numCompleted}/${numTotal} completed (${progress}%)`); const { error: updateError } = await supabaseClient.from('study_plans').update({ progress: progress, updated_at: new Date().toISOString() }).eq('id', planId); if (updateError) throw updateError; console.log(`[PlanProgress] Plan ${planId} progress DB updated to ${progress}%`); if (state.currentStudyPlan?.id === planId) state.currentStudyPlan.progress = progress; } catch (error) { console.error(`[PlanProgress] Error updating plan progress ${planId}:`, error); } };
    const getActivityIcon = (title = '', type = '') => { /* ... same as from plan.js ... */ const lowerTitle = title.toLowerCase(); const lowerType = type?.toLowerCase() || ''; if (activityVisuals[lowerType]) return activityVisuals[lowerType].icon; if (lowerTitle.includes('test')) return activityVisuals.test.icon; if (lowerTitle.includes('cvičení') || lowerTitle.includes('příklad') || lowerTitle.includes('úloh')) return activityVisuals.exercise.icon; if (lowerTitle.includes('procvič')) return activityVisuals.practice.icon; if (lowerTitle.includes('opakování') || lowerTitle.includes('shrnutí')) return activityVisuals.review.icon; if (lowerTitle.includes('geometrie')) return 'fa-draw-polygon'; if (lowerTitle.includes('algebra')) return 'fa-square-root-alt'; if (lowerTitle.includes('procent')) return 'fa-percentage'; if (lowerTitle.includes('analýza') || lowerTitle.includes('kontrola')) return activityVisuals.analysis.icon; if (lowerTitle.includes('lekce') || lowerTitle.includes('teorie')) return activityVisuals.theory.icon; return activityVisuals.default.icon; };
    async function getLatestDiagnosticTest(userId, showLoaderFlag = true) { /* Renamed from getLatestDiagnostic for clarity */
        if (!userId || !supabaseClient) return null;
        if (showLoaderFlag && typeof setLoadingState === 'function') setLoadingState('create', true); // Assuming 'create' is the relevant loader key
        try {
            const { data, error } = await supabaseClient
                .from('user_diagnostics')
                .select('id, completed_at, total_score, total_questions, topic_results, analysis')
                .eq('user_id', userId)
                .order('completed_at', { ascending: false })
                .limit(1);
            if (error) throw error;
            state.latestDiagnosticTest = (data && data.length > 0) ? data[0] : false;
            return state.latestDiagnosticTest;
        } catch (error) {
            console.error("Error fetching latest diagnostic test:", error);
            state.latestDiagnosticTest = null; // Error state
            return null;
        } finally {
            if (showLoaderFlag && typeof setLoadingState === 'function') setLoadingState('create', false);
        }
    }


    // Event Listeners Setup
    function setupEventListeners() {
        console.log("[SETUP Main] Setting up event listeners for main.html...");
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);
        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);

        // Ensure using main.html's tab buttons and its specific switcher
        const mainHtmlPageTabs = document.querySelectorAll('#tabs-wrapper .plan-tab');
        if (mainHtmlPageTabs.length > 0) {
            mainHtmlPageTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    switchTabContent(tab.dataset.tab); // Call main.html's specific tab switcher
                });
            });
        } else {
            console.warn("Main HTML page tabs (#tabs-wrapper .plan-tab) not found for event listener setup.");
        }


        if (ui.prevDayBtn) ui.prevDayBtn.addEventListener('click', () => { if (state.currentDisplayDate && state.sortedActivityDates.length > 0) { const currentIndex = state.sortedActivityDates.indexOf(state.currentDisplayDate); if (currentIndex > 0) { state.currentDisplayDate = state.sortedActivityDates[currentIndex - 1]; renderSingleDayPlan(state.currentDisplayDate); } } });
        if (ui.nextDayBtn) ui.nextDayBtn.addEventListener('click', () => { if (state.currentDisplayDate && state.sortedActivityDates.length > 0) { const currentIndex = state.sortedActivityDates.indexOf(state.currentDisplayDate); if (currentIndex < state.sortedActivityDates.length - 1) { state.currentDisplayDate = state.sortedActivityDates[currentIndex + 1]; renderSingleDayPlan(state.currentDisplayDate); } } });

        if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
        if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); }
        if (ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { /* ... same as before ... */ const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }); }
        document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } });

        if(ui.refreshDataBtn) ui.refreshDataBtn.addEventListener('click', async () => {
            showToast("Obnovuji data...", "info", 2000);
            setLoadingState('all', true);
            await loadDashboardStats();
            await loadTopicProgress();
            if(state.currentMainTab === 'current') await loadCurrentStudyPlanData();
            setLoadingState('all', false);
            showToast("Data obnovena!", "success");
        });

        // Goal Modal Listeners
        ui.goalRadioLabels.forEach(label => label.addEventListener('click', handleGoalSelection));
        ui.goalModalBackBtns.forEach(btn => btn.addEventListener('click', () => {
            const targetStepId = btn.dataset.targetStep;
            ui.goalModalSteps.forEach(step => step.classList.remove('active'));
            document.getElementById(targetStepId)?.classList.add('active');
        }));
        ui.goalModalConfirmBtns.forEach(btn => btn.addEventListener('click', () => {
            const goal = btn.dataset.goal;
            let details = { goal_set_timestamp: new Date().toISOString() };
            if (goal === 'math_accelerate') {
                details.grade = ui.accelerateGradeSelect.value;
                details.intensity = ui.accelerateIntensitySelect.value;
                details.accelerate_areas = Array.from(ui.accelerateAreasCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
                details.accelerate_reason = document.querySelector('input[name="accelerate_reason"]:checked')?.value;
                if(details.accelerate_reason === 'professional_needs') {
                    details.profession = ui.accelerateProfessionTextarea.value;
                }
            } else if (goal === 'math_review') {
                details.grade = ui.reviewGradeSelect.value;
                details.topic_ratings = {};
                ui.topicRatingsContainer.querySelectorAll('.rating-stars').forEach(rs => {
                    const topicId = rs.dataset.topicId;
                    const rating = rs.dataset.currentRating;
                    if (topicId && rating) details.topic_ratings[topicId] = { overall: parseInt(rating) };
                });
            } else if (goal === 'math_explore') {
                details.grade = ui.exploreGradeSelect.value;
            }
            saveLearningGoal(goal, details);
        }));
        document.querySelector('input[name="accelerate_reason"][value="professional_needs"]')?.addEventListener('change', (e) => {
            if (ui.accelerateProfessionGroup) ui.accelerateProfessionGroup.style.display = e.target.checked ? 'block' : 'none';
        });


        console.log("✅ [SETUP Main] Event listeners set up for main.html.");
    }

    // Main Initialization Function for procvicovani/main.html
    async function initializeApp() {
        // ADDED: More prominent initial log for THIS initializeApp
        console.log("🚀🚀🚀 [Init Main - DEBUG] procvicovani/main.js initializeApp CALLED! 🚀🚀🚀");
        console.log("🚀 [Init Main] Starting application..."); // Original log for this file

        setLoadingState('page', true);
        if (!initializeSupabase()) {
            setLoadingState('page', false);
            showGlobalError("Kritická chyba: Nelze inicializovat databázi.");
            if(ui.mainContent) ui.mainContent.style.display = 'block'; // Show something even if it's just an error
            return;
        }
        applyInitialSidebarState();
        hideGlobalError();

        try {
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);
            if (!session || !session.user) {
                console.log('[Init Main] Not logged in. Redirecting...');
                window.location.href = '/auth/index.html'; // Ensure this path is correct
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
                // Handle case where profile might be null (e.g., new user, fetch error)
                console.error("[Init Main] Profile could not be loaded for user:", state.currentUser.id);
                showGlobalError("Nepodařilo se načíst váš profil. Zkuste obnovit stránku.");
                setLoadingState('page', false);
                if(ui.mainContent) ui.mainContent.style.display = 'block';
                return;
            }

            updateSidebarProfile();
            updateUserGoalDisplay();
            setupEventListeners();
            initTooltips();
            initMouseFollower();
            initHeaderScrollDetection();
            updateCopyrightYear();
            updateOnlineStatus();

            await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT)
                .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                .catch(err => { console.error("Failed to load notifications initially:", err); renderNotifications(0, []); });

            // Check initial setup (goal and diagnostic)
            const { completedGoalSetting, completedDiagnostic } = await checkUserInitialSetup(state.currentUser.id);
            state.hasCompletedGoalSetting = completedGoalSetting;
            state.hasCompletedDiagnostic = completedDiagnostic; // This is true if diagnostic done OR goal is 'explore'

            if (!completedGoalSetting) {
                showGoalSelectionModal();
                // Main content will remain hidden or less functional until goal is set
            } else if (!completedDiagnostic && state.currentProfile?.learning_goal !== 'math_explore') {
                showDiagnosticPrompt(); // Show prompt to complete diagnostic
                // Still show tabs and default content
                if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');}
                if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible'); }
                await switchTabContent("practice-tab"); // Show default tab
            } else {
                // All setup complete (or goal is 'explore'), show tabs and load default content
                if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none';
                if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'block'; ui.tabsWrapper.classList.add('visible');}
                if (ui.mainTabContentArea) { ui.mainTabContentArea.style.display = 'flex'; ui.mainTabContentArea.classList.add('visible');}

                const urlParams = new URLSearchParams(window.location.search);
                const initialTab = urlParams.get('tab') || 'practice-tab';
                await switchTabContent(initialTab); // Load initial tab content
            }

            if (ui.mainContent) {
                ui.mainContent.style.display = 'block';
                requestAnimationFrame(() => {
                    if(ui.mainContent) ui.mainContent.classList.add('loaded');
                    initScrollAnimations();
                });
            }
            console.log("✅ [Init Main] Page Initialized.");
        } catch (error) {
            console.error("❌ [Init Main] Critical initialization error:", error);
            showGlobalError(`Chyba inicializace: ${error.message}`);
            if(ui.mainContent) ui.mainContent.style.display = 'block'; // Still try to show main area for error message
        } finally {
            setLoadingState('page', false);
        }
    }

    // Attach the main initializeApp to DOMContentLoaded
    document.addEventListener('DOMContentLoaded', initializeApp);

})();
// --- Developer Edit Log ---
// Goal: Ensure `procvicovani/main.js` correctly initializes `procvicovani/main.html`,
// logs `[Init Main]` and uses its own tab logic, and that the console log discrepancy is addressed.
// Stage:
// 1. Analyzed the console log discrepancy. Identified that the user's log (`[Init Plan]`) indicates `plan.js`
//    initialization logic is running, which would cause UI issues on `main.html`.
// 2. Confirmed that the uploaded `procvicovani/main.js` *is* structured to run its own `initializeApp`
//    (which logs `[Init Main]`) via its `DOMContentLoaded` listener.
// 3. Added a prominent debug console log: `🚀🚀🚀 [Init Main - DEBUG] procvicovani/main.js initializeApp CALLED! 🚀🚀🚀`
//    at the very beginning of the correct `initializeApp` in the provided `procvicovani/main.js`.
//    This is to help the user definitively verify if their `main.html` page is actually executing this intended starting point.
// 4. Retained all other functions from the uploaded `procvicovani/main.js`, including the `plan.js`-like functions,
//    as they are called by `main.html`'s `switchTabContent` when the "Plán" tab is selected.
// 5. The core message to the user is that the provided `main.js` *should* work correctly if `main.html`
//    is indeed loading and executing *this specific file* and not some other version or `plan.js` itself.
//    The added debug log will help confirm this.