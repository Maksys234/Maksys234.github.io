(function() {
    'use strict';

    // --- Original Global Variables ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let userStatsData = null;
    let diagnosticResultsData = [];
    let testsChartInstance = null;
    let topicProgressData = [];
    let studyPlanData = null;
    let planActivitiesData = [];
    let isLoading = { // Original isLoading structure is fine
        stats: false,
        tests: false,
        plan: false,
        topics: false,
        notifications: false
    };
    const NOTIFICATION_FETCH_LIMIT = 5;

    // --- Added Global Variables ---
    let allTitles = []; // To store fetched titles
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState'; // Key for localStorage

    // --- Original Constants ---
    const topicIcons = {
        "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon",
        "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar",
        "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar",
        "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book"
    };
     const activityVisuals = {
         test: { name: 'Test', icon: 'fa-vial', class: 'test' },
         exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' },
         practice: { name: 'Procvičování', icon: 'fa-dumbbell', class: 'practice' },
         example: { name: 'Příklad', icon: 'fa-lightbulb', class: 'example' },
         review: { name: 'Opakování', icon: 'fa-history', class: 'review' },
         theory: { name: 'Teorie', icon: 'fa-book-open', class: 'theory' },
         analysis: { name: 'Analýza', icon: 'fa-chart-pie', class: 'analysis' },
         badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' },
         diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' },
         lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' },
         plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' },
         level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' },
         other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' },
         default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
     };

    // --- Original UI Elements + Added ---
    const ui = {
        // Original elements
        initialLoader: document.getElementById('initial-loader'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        mainContent: document.getElementById('main-content'),
        sidebar: document.getElementById('sidebar'),
        mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
        sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
        sidebarAvatar: document.getElementById('sidebar-avatar'),
        sidebarName: document.getElementById('sidebar-name'),
        dashboardHeader: document.querySelector('.dashboard-header'),
        dashboardTitle: document.getElementById('dashboard-title'), // Note: This ID might not exist in main.html
        refreshDataBtn: document.getElementById('refresh-data-btn'),
        notificationBell: document.getElementById('notification-bell'),
        notificationCount: document.getElementById('notification-count'),
        notificationsDropdown: document.getElementById('notifications-dropdown'),
        notificationsList: document.getElementById('notifications-list'),
        noNotificationsMsg: document.getElementById('no-notifications-msg'),
        markAllReadBtn: document.getElementById('mark-all-read'),
        contentTabs: document.querySelectorAll('.content-tab'),
        tabContents: document.querySelectorAll('.tab-content'),
        practiceTab: document.getElementById('practice-tab'),
        diagnosticPrompt: document.getElementById('diagnostic-prompt'),
        startTestBtnPrompt: document.getElementById('start-test-btn-prompt'),
        statsCardsContainer: document.getElementById('stats-cards'),
        statsProgress: document.getElementById('stats-progress'),
        statsProgressChange: document.getElementById('stats-progress-change'),
        statsTests: document.getElementById('stats-tests'),
        statsTestsAvg: document.getElementById('stats-tests-avg'),
        statsPoints: document.getElementById('stats-points'),
        statsPointsChange: document.getElementById('stats-points-change'),
        statsStreak: document.getElementById('stats-streak'),
        statsStreakLongest: document.getElementById('stats-streak-longest'),
        testResultsTab: document.getElementById('test-results-tab'),
        testResultsContainer: document.getElementById('test-results-container'),
        testResultsLoading: document.getElementById('test-results-loading'), // Used by new setLoadingState
        testResultsContent: document.getElementById('test-results-content'),
        testResultsEmpty: document.getElementById('test-results-empty'),
        startTestBtnResults: document.getElementById('start-test-btn-results'),
        testStatsContainer: document.getElementById('test-stats'),
        testAvgScore: document.getElementById('test-avg-score'), // Note: This ID might not exist
        testBestScore: document.getElementById('test-best-score'), // Note: This ID might not exist
        testAvgTime: document.getElementById('test-avg-time'), // Note: This ID might not exist
        testsChartCanvas: document.getElementById('testsChart'),
        lastTestResultContainer: document.getElementById('last-test-result'),
        testHistoryContainer: document.getElementById('test-history'),
        studyPlanTab: document.getElementById('study-plan-tab'),
        studyPlanContainer: document.getElementById('study-plan-container'),
        studyPlanLoading: document.getElementById('study-plan-loading'), // Used by new setLoadingState
        studyPlanContent: document.getElementById('study-plan-content'),
        studyPlanEmpty: document.getElementById('study-plan-empty'),
        startTestBtnPlan: document.getElementById('start-test-btn-plan'),
        mainPlanScheduleGrid: document.getElementById('main-plan-schedule'),
        topicAnalysisTab: document.getElementById('topic-analysis-tab'),
        topicAnalysisContainer: document.getElementById('topic-analysis-container'),
        topicAnalysisLoading: document.getElementById('topic-analysis-loading'), // Used by new setLoadingState
        topicAnalysisContent: document.getElementById('topic-analysis-content'),
        topicAnalysisEmpty: document.getElementById('topic-analysis-empty'),
        startTestBtnAnalysis: document.getElementById('start-test-btn-analysis'),
        topicGrid: document.getElementById('topic-grid'),
        toastContainer: document.getElementById('toast-container'),
        globalError: document.getElementById('global-error'),
        offlineBanner: document.getElementById('offline-banner'), // Note: Assumes this ID exists in HTML
        currentYearSidebar: document.getElementById('currentYearSidebar'), // Note: Assumes this ID exists
        currentYearFooter: document.getElementById('currentYearFooter'),
        mouseFollower: document.getElementById('mouse-follower'),
        // Added UI elements
        sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'), // For collapse/expand
        sidebarUserTitle: document.getElementById('sidebar-user-title')  // For user title display
    };

    // --- Original Helper Functions ---
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; const retryBtn = document.getElementById('global-retry-btn'); if (retryBtn) { retryBtn.addEventListener('click', () => { hideError(); if (currentUser && !Object.values(isLoading).some(s=>s)) { setLoadingState('all', true); loadPageData(); } else { showToast("Info", "Data se načítají nebo nejste přihlášeni.", "info"); } }); } } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function sanitizeHTML(str) { const t = document.createElement('div'); t.textContent = str || ''; return t.innerHTML; }
    function getInitials(profile) { if (!profile) return '?'; const f = profile.first_name?.[0] || ''; const l = profile.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = profile.username?.[0].toUpperCase() || ''; const emailInitial = profile.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatDate(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) return '-'; return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return '-'; } }
    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return '--:--'; const m = Math.floor(seconds / 60); const s = Math.round(seconds % 60); return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; }
    function openMenu() { ui.sidebar?.classList.add('active'); ui.sidebarOverlay?.classList.add('active'); }
    function closeMenu() { ui.sidebar?.classList.remove('active'); ui.sidebarOverlay?.classList.remove('active'); }
    // --- MODIFIED: updateUserInfoUI to include title ---
    function updateUserInfoUI() {
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) return; // Added title check
        if (currentUser && currentProfile) {
            const displayName = `${currentProfile.first_name || ''} ${currentProfile.last_name || ''}`.trim() || currentProfile.username || currentUser.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(currentProfile);
            // Original logic for avatar_url handling
            const avatarUrl = currentProfile.avatar_url;
             ui.sidebarAvatar.innerHTML = avatarUrl && !avatarUrl.startsWith('assets/')
                  ? `<img src="${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}" alt="${sanitizeHTML(initials)}">`
                  : avatarUrl
                      ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">`
                      : sanitizeHTML(initials);

            // --- ADDED: Title Display Logic ---
            const selectedTitleKey = currentProfile.selected_title;
            let displayTitle = 'Pilot'; // Default title
            if (selectedTitleKey && allTitles && allTitles.length > 0) {
                const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) {
                    displayTitle = foundTitle.name;
                } else {
                     console.warn(`Title with key "${selectedTitleKey}" not found.`);
                }
            } else if (selectedTitleKey) {
                 console.warn(`Selected title key "${selectedTitleKey}" exists but title list is empty or not fetched.`);
            }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); // Display the title
            ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); // Add tooltip
            // --- END ADDED: Title Display Logic ---

        } else {
            ui.sidebarName.textContent = 'Nepřihlášen';
            ui.sidebarAvatar.textContent = '?';
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot'; // Set default title if not logged in
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title');
        }
    }
    // --- End MODIFIED: updateUserInfoUI ---
    function handleScroll() { if (!ui.mainContent || !ui.dashboardHeader) return; document.body.classList.toggle('scrolled', ui.mainContent.scrollTop > 10); }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    function initTooltips() { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } }
    function updateCopyrightYear() { const year = new Date().getFullYear(); /* Original had sidebar/footer check */ if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; } // Simplified, assuming only footer span exists
    function initMouseFollower() { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); }
    function initScrollAnimations() { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) { console.log("Scroll animations not initialized."); return; } const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); }
    function initHeaderScrollDetection() { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); }
    function updateOnlineStatus() { /* Original only logged a warning */ if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) console.warn("Network offline."); }

    // --- ADDED: Skeleton Rendering Function ---
    function renderSkeletonRows(container, count = 3, type = 'card') {
        if (!container) return;
        let skeletonHTML = '';
        container.innerHTML = ''; // Clear previous skeletons/content
        for (let i = 0; i < count; i++) {
             if (type === 'stats-card') {
                 skeletonHTML += `<div class="dashboard-card card loading"> <div class="loading-skeleton"> <div class="skeleton title" style="width: 60%;"></div> <div class="skeleton value"></div> <div class="skeleton text" style="width: 70%;"></div> <div class="skeleton text text-short"></div> </div> </div>`;
             } else if (type === 'notification') {
                 skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`;
             } else if (type === 'test-stats') {
                 skeletonHTML += `<div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder" style="width: 50px; height: 50px;"></div><div class="skeleton value" style="width: 50%;"></div><div class="skeleton text-short"></div></div></div>`;
             } else if (type === 'plan-day') {
                 skeletonHTML += `<div class="schedule-day card loading"><div class="loading-skeleton"> <div class="skeleton day-header"></div> <div class="skeleton activity-item"></div> <div class="skeleton activity-item" style="width: 70%;"></div> </div></div>`;
             } else if (type === 'topic') {
                 skeletonHTML += `<div class="topic-card card loading"><div class="loading-skeleton"> <div class="skeleton topic-header"></div> <div class="skeleton progress-container" style="height: 8px;"></div> <div class="skeleton text-sm" style="width: 60%;"></div> <div class="skeleton text-sm" style="width: 50%;"></div> </div></div>`;
             } else if (type === 'test-history') {
                  skeletonHTML += `<div class="test-item skeleton"> <div class="test-info"> <div class="test-icon skeleton"></div> <div class="test-details"> <div class="skeleton" style="height: 18px; width: 120px; margin-bottom: 8px;"></div> <div class="skeleton" style="height: 12px; width: 180px;"></div> </div> </div> <div class="test-score skeleton" style="width: 50px; height: 20px;"></div> </div>`;
             } else { // Default simple skeleton
                  skeletonHTML += `<div class="card loading"><div class="loading-skeleton"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div>`;
             }
        }
        container.innerHTML = skeletonHTML;
    }
    // --- END ADDED: Skeleton Rendering Function ---

    // --- REPLACED: setLoadingState Function ---
    function setLoadingState(sectionKey, isLoadingFlag, options = {}) {
        const { isEmpty = false } = options; // Option to indicate if data is empty after loading

        const sectionMap = {
            stats: { container: ui.statsCardsContainer, childrenSelector: '.dashboard-card', skeletonParent: ui.statsCardsContainer, skeletonType: 'stats-card', skeletonCount: 4 },
            tests: { container: ui.testResultsContainer, loader: ui.testResultsLoading, content: ui.testResultsContent, empty: ui.testResultsEmpty, skeletonParent: ui.testStatsContainer, skeletonType: 'test-stats', skeletonCount: 3, extraSkeletons: { history: { parent: ui.testHistoryContainer, type: 'test-history', count: 2 }} },
            plan: { container: ui.studyPlanContainer, loader: ui.studyPlanLoading, content: ui.studyPlanContent, empty: ui.studyPlanEmpty, skeletonParent: ui.mainPlanScheduleGrid, skeletonType: 'plan-day', skeletonCount: 3 },
            topics: { container: ui.topicAnalysisContainer, loader: ui.topicAnalysisLoading, content: ui.topicAnalysisContent, empty: ui.topicAnalysisEmpty, skeletonParent: ui.topicGrid, skeletonType: 'topic', skeletonCount: 3 },
            notifications: { loader: null, content: ui.notificationsList, empty: ui.noNotificationsMsg, skeletonParent: ui.notificationsList, skeletonType: 'notification', skeletonCount: 2 }
        };

        if (sectionKey === 'all') {
            Object.keys(isLoading).forEach(key => setLoadingState(key, isLoadingFlag, options));
            return;
        }
        // Update loading state only if it changes, except when forcing skeleton rendering
        // if (isLoading[sectionKey] === isLoadingFlag && !forceRender) return;

        isLoading[sectionKey] = isLoadingFlag;
        console.log(`[SetLoading] ${sectionKey}: ${isLoadingFlag}, isEmpty: ${isEmpty}`);

        const config = sectionMap[sectionKey];
        if (!config) { console.warn(`No config found for setLoadingState key: ${sectionKey}`); return; }

        // Toggle overall container loading class if exists
        if (config.container) config.container.classList.toggle('loading', isLoadingFlag);

        // Handle overlay loader (like for tests, plan, topics)
        if (config.loader) config.loader.style.display = isLoadingFlag ? 'flex' : 'none';

        // Render skeletons or clear them
        if (isLoadingFlag) {
            // Hide content and empty state when loading starts
            if (config.content) config.content.style.display = 'none';
            if (config.empty) config.empty.style.display = 'none';

            // Render main skeletons
            if (config.skeletonParent) {
                renderSkeletonRows(config.skeletonParent, config.skeletonCount, config.skeletonType);
                 // Ensure parent grid/container is visible if skeletons are rendered inside hidden content area
                 if(config.content && config.content.contains(config.skeletonParent)) {
                     config.content.style.display = 'block'; // Or 'grid', 'flex' depending on layout
                 }
            }
            // Render extra skeletons
            if (config.extraSkeletons) {
                for (const key in config.extraSkeletons) {
                    const extra = config.extraSkeletons[key];
                    if (extra.parent) {
                        renderSkeletonRows(extra.parent, extra.count, extra.type);
                    }
                }
            }
        } else {
            // Clear skeletons when loading finishes
            if (config.skeletonParent && config.skeletonParent.querySelector('.skeleton, .loading-skeleton')) {
                config.skeletonParent.innerHTML = '';
            }
            if (config.extraSkeletons) {
                for (const key in config.extraSkeletons) {
                    const extra = config.extraSkeletons[key];
                    if (extra.parent && extra.parent.querySelector('.skeleton')) {
                        extra.parent.innerHTML = '';
                    }
                }
            }

            // Show content or empty state after loading
            if (config.content) config.content.style.display = !isEmpty ? 'block' : 'none'; // Or 'grid', 'flex'
            if (config.empty) config.empty.style.display = isEmpty ? 'block' : 'none';

            // Special handling for stats: remove loading class from individual cards
            if (sectionKey === 'stats' && config.container) {
                config.container.querySelectorAll(config.childrenSelector).forEach(el => el.classList.remove('loading'));
            }
        }

        // Specific UI updates for notifications bell/button
        if (sectionKey === 'notifications') {
            if (ui.notificationBell) ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
            if (ui.markAllReadBtn) {
                const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
            }
        }
    }
    // --- END REPLACED: setLoadingState Function ---


    // --- Original Data Fetching ---
    async function initializeSupabase() { /* Original Code */ try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded."); } supabase = window.supabase.createClient(supabaseUrl, supabaseKey); if (!supabase) throw new Error("Supabase client creation failed."); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nelze se připojit.", true); return false; } }
    async function fetchUserProfile(userId) { /* Original Code */ if (!supabase || !userId) return null; try { const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).single(); if (error && error.code !== 'PGRST116') throw error; if (!profile) { return null; } return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); showToast('Chyba Profilu','Nepodařilo se načíst data profilu.', 'error'); return null; } }
    async function fetchDashboardStats(userId, profileData) { /* Original Code */ if (!supabase || !userId || !profileData) { return null; } let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats Fetch] Supabase error fetching user_stats:", statsError.message); } } catch (error) { console.error("[Stats Fetch] Exception fetching user_stats:", error); statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0 }; if (statsError) { console.warn("[Stats Fetch] Returning stats based primarily on profile due to fetch error."); } return finalStats; }
    async function fetchDiagnosticResults(userId) { /* Original Code */ try { const { data, error } = await supabase.from('user_diagnostics').select('id, completed_at, total_score, total_questions, time_spent').eq('user_id', userId).order('completed_at', { ascending: false }); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching diagnostic results:", err); showToast(`Chyba načítání testů: ${err.message}`, "error"); return []; } }
    async function fetchActiveStudyPlan(userId) { /* Original Code */ try { const { data: plans, error } = await supabase.from('study_plans').select('id, title, created_at').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }).limit(1); if (error) throw error; return plans?.[0] || null; } catch (err) { console.error("Error fetching active study plan:", err); return null; } }
    async function fetchPlanActivities(planId) { /* Original Code */ if (!planId) return []; try { const { data, error } = await supabase.from('plan_activities').select('id, title, day_of_week, time_slot, completed, description, type').eq('plan_id', planId).order('day_of_week').order('time_slot'); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching plan activities:", err); return []; } }
    async function fetchTopicProgress(userId) { /* Original Code - slightly modified to remove initial setLoading */ try { const { data, error } = await supabase .from('user_topic_progress') .select(` topic_id, progress, strength, questions_attempted, questions_correct, topic:exam_topics!inner( name, subject ) `) .eq('user_id', userId); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching topic progress:", err); showToast(`Chyba načítání pokroku v tématech: ${err.message}`, "error"); return []; } }
    async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) { /* Original Code - slightly modified to remove initial setLoading */ if (!supabase || !userId) { return { unreadCount: 0, notifications: [] }; } /* setLoadingState('notifications', true); removed */ try { const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } /* finally { setLoadingState('notifications', false); } removed */ }

    // --- ADDED: Fetch Titles Function ---
    async function fetchTitles() {
        if (!supabase) return [];
        try {
            const { data, error } = await supabase.from('title_shop').select('title_key, name'); // Ensure table/column names are correct
            if (error) throw error;
            console.log("Fetched titles:", data);
            return data || [];
        } catch (error) {
            console.error("Error fetching titles:", error);
            showToast("Chyba načítání dostupných titulů.", "error");
            return [];
        }
    }
    // --- END ADDED: Fetch Titles Function ---


    // --- Original Rendering Functions (modified to use new setLoadingState) ---
    function renderStatsCards(stats, avgScore='-') { // Added avgScore default
        // Original render logic here, but call setLoadingState at the end
        setLoadingState('stats', false); // Indicate loading is finished for stats
        if (!stats) { /* ... set default values ... */ return; }
        /* ... update UI elements with stats ... */
        if(ui.statsProgress) ui.statsProgress.textContent = `${stats.progress ?? 0}%`;
        // Update stats-tests-avg with avgScore passed from loadPageData
        if(ui.statsTestsAvg) ui.statsTestsAvg.textContent = `Prům. skóre: ${avgScore}%`;
        // ... rest of the updates
    }
    function calculateAverageScore(results) { /* Original Code */ if (!results || results.length === 0) return '-'; const validScores = results.filter(r => typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0); if (validScores.length === 0) return '-'; const avgPercentage = validScores.reduce((sum, r) => sum + (r.total_score / r.total_questions) * 100, 0) / validScores.length; return Math.round(avgPercentage); }
    function renderTestResults(results) {
        const isEmpty = !results || results.length === 0;
        setLoadingState('tests', false, { isEmpty: isEmpty }); // Use new setLoadingState
        if (isEmpty) return;
        // Original render logic here...
        const avgScore = calculateAverageScore(results); /* ... calculate other stats ... */
        if(ui.testStatsContainer) ui.testStatsContainer.innerHTML = `...`; // Render actual stats cards
        renderTestChart({ /* chart data */ });
        if(ui.lastTestResultContainer) { /* render last test */ }
        if(ui.testHistoryContainer) { /* render history */ }
    }
    function renderTestChart(chartData) { /* Original Code */ if (!ui.testsChartCanvas) { return; } const ctx = ui.testsChartCanvas.getContext('2d'); if (testsChartInstance) testsChartInstance.destroy(); if (!chartData || !chartData.labels || !chartData.data || chartData.labels.length < 2) { if (ui.testsChartCanvas) ui.testsChartCanvas.style.display = 'none'; return; } ui.testsChartCanvas.style.display = 'block'; const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches; const gridColor = 'rgba(var(--accent-secondary-rgb), 0.15)'; const textColor = 'var(--text-muted)'; const pointColor = 'var(--accent-primary)'; const lineColor = 'var(--accent-primary)'; const bgColor = 'rgba(var(--accent-primary-rgb), 0.1)'; testsChartInstance = new Chart(ctx, { type: 'line', data: { labels: chartData.labels, datasets: [{ label: 'Skóre (%)', data: chartData.data, borderColor: lineColor, backgroundColor: bgColor, borderWidth: 2.5, pointBackgroundColor: pointColor, pointRadius: 4, pointHoverRadius: 6, tension: 0.3, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time', time: { unit: 'day', tooltipFormat: 'P', displayFormats: { day: 'd.M.' } }, ticks: { color: textColor, maxRotation: 0, autoSkipPadding: 15 }, grid: { display: false } }, y: { beginAtZero: true, max: 100, ticks: { stepSize: 25, color: textColor, callback: (v) => v + '%' }, grid: { color: gridColor } } }, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, backgroundColor: 'var(--interface-bg)', titleColor: 'var(--text-heading)', bodyColor: 'var(--text-medium)', borderColor: 'var(--border-color-medium)', borderWidth: 1, padding: 10, displayColors: false, callbacks: { title: (items) => dateFns.format(new Date(items[0].parsed.x), 'PPP', { locale: dateFns.locale.cs || dateFns.locale.enUS }), label: (ctx) => `Skóre: ${ctx.parsed.y.toFixed(0)}%` } } }, interaction: { mode: 'nearest', axis: 'x', intersect: false } } }); }
    function renderStudyPlanOverview(plan, activities) {
        const isEmpty = !plan;
        setLoadingState('plan', false, { isEmpty: isEmpty }); // Use new setLoadingState
        if (isEmpty) return;
        // Original render logic here...
        if (ui.mainPlanScheduleGrid) { ui.mainPlanScheduleGrid.innerHTML = ''; /* ... render schedule ... */ }
    }
    function renderTopicAnalysis(topics) {
        const isEmpty = !topics || topics.length === 0;
        setLoadingState('topics', false, { isEmpty: isEmpty }); // Use new setLoadingState
        if (isEmpty) return;
        // Original render logic here...
        if(ui.topicGrid) { ui.topicGrid.innerHTML = ''; /* ... render topics ... */ }
    }
    function renderNotifications(count, notifications) {
        const isEmpty = !notifications || notifications.length === 0;
        setLoadingState('notifications', false, { isEmpty: isEmpty }); // Use new setLoadingState
        if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) return;
        // Original render logic here...
        ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); /* ... rest of logic ... */
    }
    // --- Removed renderNotificationSkeletons as it's handled by renderSkeletonRows now ---

    // --- Original Notification Handlers ---
    async function markNotificationRead(notificationId) { /* Original Code */ if (!currentUser || !notificationId) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; return true; } catch (error) { console.error("[FUNC] markNotificationRead: Error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { /* Original Code (without setLoadingState) */ if (!currentUser || !supabase || !ui.markAllReadBtn || ui.markAllReadBtn.disabled) return; /* setLoadingState('notifications', true); removed */ ui.markAllReadBtn.disabled = true; try { const { error } = await supabase .from('user_notifications') .update({ is_read: true }) .eq('user_id', currentUser.id) .eq('is_read', false); if (error) throw error; const { unreadCount, notifications } = await fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('Oznámení Vymazána', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[FUNC] markAllNotificationsRead: Error:", error); showToast('Chyba', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentCount === 0; } /* finally { setLoadingState('notifications', false); } removed */ }

    // --- MODIFIED: loadPageData to use new setLoadingState and pass avgScore ---
    async function loadPageData() {
        if (!currentUser || !currentProfile) { showError("Chybí data profilu.", true); /* setLoadingState('all', false); Removed as it's handled below */ return; }

        // Show skeletons BEFORE fetching
        setLoadingState('stats', true);
        setLoadingState('tests', true);
        setLoadingState('plan', true);
        setLoadingState('topics', true);
        setLoadingState('notifications', true);
        hideError();

        let avgScore = '-'; // Default average score

        try {
            const results = await Promise.allSettled([
                fetchDashboardStats(currentUser.id, currentProfile),
                fetchDiagnosticResults(currentUser.id),
                fetchActiveStudyPlan(currentUser.id),
                fetchTopicProgress(currentUser.id),
                fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT)
            ]);

            // Process test results first to calculate avgScore
            if (results[1].status === 'fulfilled') {
                diagnosticResultsData = results[1].value || [];
                avgScore = calculateAverageScore(diagnosticResultsData); // Calculate score
                renderTestResults(diagnosticResultsData); // Render tests (this will call setLoadingState tests false)
            } else {
                console.error("Error fetching test results:", results[1].reason);
                diagnosticResultsData = [];
                avgScore = '-';
                renderTestResults([]); // Render empty tests
            }

            // Process stats, passing the calculated avgScore
            if (results[0].status === 'fulfilled') {
                userStatsData = results[0].value;
                renderStatsCards(userStatsData, avgScore); // Render stats (this will call setLoadingState stats false)
            } else {
                console.error("Error fetching stats:", results[0].reason);
                renderStatsCards(null, avgScore); // Render empty stats
            }

            // Process study plan
            if (results[2].status === 'fulfilled') {
                studyPlanData = results[2].value;
                if (studyPlanData?.id) {
                    try { planActivitiesData = await fetchPlanActivities(studyPlanData.id); renderStudyPlanOverview(studyPlanData, planActivitiesData); } // Calls setLoadingState plan false
                    catch(activityError){ console.error("Error fetching plan activities:", activityError); renderStudyPlanOverview(studyPlanData, []); }
                } else { renderStudyPlanOverview(null, null); } // Calls setLoadingState plan false
            } else { console.error("Error fetching study plan:", results[2].reason); renderStudyPlanOverview(null, null); }

            // Process topic progress
            if (results[3].status === 'fulfilled') {
                topicProgressData = results[3].value || [];
                renderTopicAnalysis(topicProgressData); // Calls setLoadingState topics false
            } else { console.error("Error fetching topic progress:", results[3].reason); renderTopicAnalysis(null); }

            // Process notifications
            if (results[4].status === 'fulfilled') {
                const { unreadCount, notifications } = results[4].value || { unreadCount: 0, notifications: [] };
                renderNotifications(unreadCount, notifications); // Calls setLoadingState notifications false
            } else { console.error("Error fetching notifications:", results[4].reason); renderNotifications(0, []); }


            // Handle diagnostic prompt visibility
            if (ui.diagnosticPrompt) {
                 ui.diagnosticPrompt.style.display = (diagnosticResultsData.length === 0) ? 'flex' : 'none';
                 if(diagnosticResultsData.length === 0) { requestAnimationFrame(() => initScrollAnimations()); }
            }

        } catch(error) {
            console.error("❌ [LoadPageData] Unexpected error:", error);
            showError(`Nepodařilo se načíst data stránky: ${error.message}`, true);
             // Ensure loading state is false for all sections in case of global error
             setLoadingState('all', false, { isEmpty: true }); // Assume empty on error
             // Potentially render empty states explicitly again if needed
             // renderStatsCards(null, '-');
             // renderTestResults([]);
             // ... etc.
        } finally {
             initTooltips();
        }
    }
    // --- END MODIFIED: loadPageData ---


    // --- ADDED: Sidebar Toggle Functions ---
    function applyInitialSidebarState() {
        const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);
        const body = document.body;
        const buttonIcon = ui.sidebarToggleBtn?.querySelector('i');

        if (savedState === 'collapsed') {
            body.classList.add('sidebar-collapsed');
            if(buttonIcon) buttonIcon.className = 'fas fa-chevron-right';
        } else {
            body.classList.remove('sidebar-collapsed');
            if(buttonIcon) buttonIcon.className = 'fas fa-chevron-left';
        }
        console.log(`[Sidebar Init] State: ${savedState || 'expanded'}`);
    }

    function toggleSidebar() {
        const body = document.body;
        const buttonIcon = ui.sidebarToggleBtn?.querySelector('i');
        const isCollapsed = body.classList.toggle('sidebar-collapsed');

        localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded');
        console.log(`[Sidebar Toggle] New state: ${isCollapsed ? 'collapsed' : 'expanded'}`);

        if (buttonIcon) {
            buttonIcon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        }
    }
    // --- END ADDED: Sidebar Toggle Functions ---


    // --- MODIFIED: setupEventListeners to include sidebar toggle ---
    function setupEventListeners() {
         if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
         if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
         if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
         document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 576) closeMenu(); }); }); // Changed breakpoint check
         ui.contentTabs?.forEach(tab => { tab.addEventListener('click', handleTabSwitch); });
          if (ui.refreshDataBtn) { ui.refreshDataBtn.addEventListener('click', handleRefreshClick); }
          if (ui.startTestBtnPrompt) ui.startTestBtnPrompt.addEventListener('click', () => window.location.href = 'test1.html');
          if (ui.startTestBtnResults) ui.startTestBtnResults.addEventListener('click', () => window.location.href = 'test1.html');
          if (ui.startTestBtnPlan) ui.startTestBtnPlan.addEventListener('click', () => window.location.href = 'test1.html');
          if (ui.startTestBtnAnalysis) ui.startTestBtnAnalysis.addEventListener('click', () => window.location.href = 'test1.html');
         if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
         if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); }
         if (ui.notificationsList) { ui.notificationsList.addEventListener('click', handleNotificationClick); }
         document.addEventListener('click', closeNotificationDropdownOnClickOutside);
         window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus);
         // updateOnlineStatus(); // Call initially

         // --- ADDED: Event listener for sidebar toggle button ---
         if (ui.sidebarToggleBtn) {
              ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);
              console.log("Sidebar toggle event listener attached.");
         } else {
              console.warn("Sidebar toggle button not found.");
         }
         // --- END ADDED ---

         if (ui.mainContent) ui.mainContent.addEventListener('scroll', handleScroll, { passive: true });
    }
    // --- END MODIFIED: setupEventListeners ---

    // --- Original Event Handlers ---
    function handleTabSwitch(event) { /* Original Code */ const tabId = event.currentTarget.dataset.tab; ui.contentTabs.forEach(t => t.classList.remove('active')); ui.tabContents.forEach(c => c.classList.remove('active')); event.currentTarget.classList.add('active'); const activeContent = document.getElementById(tabId); if(activeContent) { activeContent.classList.add('active'); requestAnimationFrame(() => { activeContent.querySelectorAll('[data-animate]').forEach(el => el.classList.remove('animated')); initScrollAnimations(); }); } else { console.warn(`Content for tab ${tabId} not found!`); } if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' }); }
    async function handleRefreshClick() { /* Original Code */ if (Object.values(isLoading).some(s => s)) { showToast('Info','Data se již načítají.', 'info'); return; } const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if(icon) icon.classList.add('fa-spin'); if(text) text.textContent = 'RELOADING...'; ui.refreshDataBtn.disabled = true; await loadPageData(); if(icon) icon.classList.remove('fa-spin'); if(text) text.textContent = 'RELOAD'; ui.refreshDataBtn.disabled = false; initTooltips(); }
    async function handleNotificationClick(event) { /* Original Code */ const item = event.target.closest('.notification-item'); if (!item) return; const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); ui.markAllReadBtn.disabled = newCount === 0; } } if (link) { window.location.href = link; } }
    function closeNotificationDropdownOnClickOutside(event) { /* Original Code */ if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } }

    // --- MODIFIED: initializeApp to fetch titles and apply sidebar state ---
    async function initializeApp() {
        if (!initializeSupabase()) return;

        if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; }
        if (ui.mainContent) ui.mainContent.style.display = 'none'; // Keep hidden initially

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;

                // Fetch profile and titles first
                [currentProfile, allTitles] = await Promise.all([
                     fetchUserProfile(currentUser.id),
                     fetchTitles()
                ]);

                if (!currentProfile) {
                    throw new Error("Nepodařilo se načíst profil uživatele.");
                }

                updateUserInfoUI(); // Update sidebar with name, avatar, and title
                applyInitialSidebarState(); // Set initial sidebar collapsed/expanded state
                setupEventListeners(); // Setup all listeners, including sidebar toggle

                await loadPageData(); // Load main content data (shows skeletons, then content)

                if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }

                // Show main content area after data load attempt
                if (ui.mainContent) {
                    ui.mainContent.style.display = 'flex'; // Use flex as main is a flex container
                    // Default tab selection from original code
                    const defaultTabButton = document.querySelector('.content-tab[data-tab="practice-tab"]');
                    const defaultTabContent = document.getElementById('practice-tab');
                    if(defaultTabButton && defaultTabContent) {
                         document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
                         document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                         defaultTabButton.classList.add('active');
                         defaultTabContent.classList.add('active');
                    }
                    requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); });
                }
                initMouseFollower();
                initHeaderScrollDetection();
                updateCopyrightYear();
                // initTooltips(); // Moved to loadPageData finally block

            } else {
                window.location.href = '/auth/index.html';
            }
        } catch (error) {
            console.error("❌ [Init Procvičování - Kyber v21] Error:", error);
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">Chyba (${error.message}). Obnovte.</p>`; }
            else { showError(`Chyba inicializace: ${error.message}`, true); }
            if (ui.mainContent) ui.mainContent.style.display = 'flex'; // Show content even on error
            setLoadingState('all', false, { isEmpty: true }); // Clear all skeletons on error
        }
    }
    // --- END MODIFIED: initializeApp ---

    // --- Original Event Listener ---
    document.addEventListener('DOMContentLoaded', initializeApp);

})();