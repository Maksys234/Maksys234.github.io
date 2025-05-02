// main.js for dashboard/procvicovani/main.html
// Version: 23.5 - SyntaxError fix, full rendering logic

(function() { // Start IIFE
    'use strict';

    // Global variables for this script's scope
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = [];
    let userStatsData = null;
    let diagnosticResultsData = [];
    let testsChartInstance = null;
    let topicProgressData = [];
    let studyPlanData = null;
    let planActivitiesData = [];
    let isLoading = {
        stats: false,
        tests: false,
        plan: false,
        topics: false,
        notifications: false // Keep notification state consistent if dashboard.js modifies it
    };

    // Cache UI elements for this specific page (main.html)
    const ui = {
        // Common elements
        initialLoader: document.getElementById('initial-loader'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        mainContent: document.getElementById('main-content'),
        sidebar: document.getElementById('sidebar'),
        mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
        sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
        sidebarAvatar: document.getElementById('sidebar-avatar'),
        sidebarName: document.getElementById('sidebar-name'),
        sidebarUserTitle: document.getElementById('sidebar-user-title'),
        dashboardHeader: document.querySelector('.dashboard-header'),
        refreshDataBtn: document.getElementById('refresh-data-btn'),
        notificationBell: document.getElementById('notification-bell'),
        notificationCount: document.getElementById('notification-count'),
        notificationsDropdown: document.getElementById('notifications-dropdown'),
        notificationsList: document.getElementById('notifications-list'),
        noNotificationsMsg: document.getElementById('no-notifications-msg'),
        markAllReadBtn: document.getElementById('mark-all-read'),
        toastContainer: document.getElementById('toast-container'),
        globalError: document.getElementById('global-error'),
        offlineBanner: document.getElementById('offline-banner'),
        currentYearSidebar: document.getElementById('currentYearSidebar'),
        currentYearFooter: document.getElementById('currentYearFooter'),
        mouseFollower: document.getElementById('mouse-follower'),

        // Elements specific to main.html
        contentTabs: document.querySelectorAll('.content-tab'),
        tabContents: document.querySelectorAll('.tab-content'),
        practiceTab: document.getElementById('practice-tab'),
        diagnosticPrompt: document.getElementById('diagnostic-prompt'),
        startTestBtnPrompt: document.getElementById('start-test-btn-prompt'),
        statsCardsContainer: document.getElementById('stats-cards'),
        statsCompleted: document.getElementById('stats-completed'),
        statsCompletedChange: document.getElementById('stats-completed-change'),
        statsAvgScore: document.getElementById('stats-avg-score'),
        statsAvgScoreChange: document.getElementById('stats-avg-score-change'),
        statsTimeSpent: document.getElementById('stats-time-spent'),
        statsTimeChange: document.getElementById('stats-time-change'),
        statsWeakestTopic: document.getElementById('stats-weakest-topic'),
        statsWeakestTopicFooter: document.querySelector('#stats-weakest-topic')?.closest('.dashboard-card')?.querySelector('.card-footer'),
        shortcutsGrid: document.getElementById('shortcuts-grid'),
        testResultsTab: document.getElementById('test-results-tab'),
        testResultsContainer: document.getElementById('test-results-container'),
        testResultsLoading: document.getElementById('test-results-loading'),
        testResultsContent: document.getElementById('test-results-content'),
        testResultsEmpty: document.getElementById('test-results-empty'),
        startTestBtnResults: document.getElementById('start-test-btn-results'),
        testStatsContainer: document.getElementById('test-stats'),
        testsChartCanvas: document.getElementById('testsChart'),
        lastTestResultContainer: document.getElementById('last-test-result'),
        testHistoryContainer: document.getElementById('test-history'),
        studyPlanTab: document.getElementById('study-plan-tab'),
        studyPlanContainer: document.getElementById('study-plan-container'),
        studyPlanLoading: document.getElementById('study-plan-loading'),
        studyPlanContent: document.getElementById('study-plan-content'),
        studyPlanEmpty: document.getElementById('study-plan-empty'),
        startTestBtnPlan: document.getElementById('start-test-btn-plan'),
        mainPlanScheduleGrid: document.getElementById('main-plan-schedule'),
        topicAnalysisTab: document.getElementById('topic-analysis-tab'),
        topicAnalysisContainer: document.getElementById('topic-analysis-container'),
        topicAnalysisLoading: document.getElementById('topic-analysis-loading'),
        topicAnalysisContent: document.getElementById('topic-analysis-content'),
        topicAnalysisEmpty: document.getElementById('topic-analysis-empty'),
        startTestBtnAnalysis: document.getElementById('start-test-btn-analysis'),
        topicGrid: document.getElementById('topic-grid')
    };

    // Maps
    const topicIcons = { "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon", "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar", "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar", "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book" };
    const activityVisuals = { test: { name: 'Test', icon: 'fa-vial', class: 'test' }, exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' }, badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' }, diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' }, plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' }, other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' }, default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' } };

    // --- Helper Functions ---
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; const retryBtn = document.getElementById('global-retry-btn'); if (retryBtn) { retryBtn.addEventListener('click', () => { hideError(); if (currentUser && !Object.values(isLoading).some(s=>s)) { setLoadingState('all', true); loadPageData(); } else { showToast("Info", "Data se načítají nebo nejste přihlášeni.", "info"); } }); } } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function sanitizeHTML(str) { const t = document.createElement('div'); t.textContent = str || ''; return t.innerHTML; }
    function getInitials(profile) { if (!profile) return '?'; const f = profile.first_name?.[0] || ''; const l = profile.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = profile.username?.[0].toUpperCase() || ''; const emailInitial = profile.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatDate(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) return '-'; return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return '-'; } }
    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return '--:--'; const m = Math.floor(seconds / 60); const s = Math.round(seconds % 60); return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    function updateOnlineStatus() { /* Banner not present */ if (!navigator.onLine) console.warn("Network offline."); }
    function handleScroll() { if (!ui.mainContent || !ui.dashboardHeader) return; document.body.classList.toggle('scrolled', ui.mainContent.scrollTop > 10); }
    function initTooltips() { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip.tooltipstered').each(function() { if (document.body.contains(this)) { try { window.jQuery(this).tooltipster('destroy'); } catch (destroyError) { /* Ignore */ } } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } }
    function updateCopyrightYear() { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; }
    function initMouseFollower() { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); }
    function initScrollAnimations() { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) { return; } const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); }
    function initHeaderScrollDetection() { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }

    // --- Loading State ---
    function setLoadingState(section, isLoadingFlag) {
        if (isLoading[section] === isLoadingFlag && section !== 'all') return;
        if (section === 'all') { Object.keys(isLoading).forEach(key => setLoadingState(key, isLoadingFlag)); return; }

        isLoading[section] = isLoadingFlag;
        console.log(`[UI Loading] Section: ${section}, isLoading: ${isLoadingFlag}`);

        const sectionMap = {
            stats: { container: ui.statsCardsContainer, childrenSelector: '.dashboard-card', skeletonContainer: ui.shortcutsGrid },
            tests: { container: ui.testResultsContainer, content: ui.testResultsContent, empty: ui.testResultsEmpty, loader: ui.testResultsLoading },
            plan: { container: ui.studyPlanContainer, content: ui.studyPlanContent, empty: ui.studyPlanEmpty, loader: ui.studyPlanLoading },
            topics: { container: ui.topicAnalysisContainer, content: ui.topicAnalysisContent, empty: ui.topicAnalysisEmpty, loader: ui.topicAnalysisLoading },
            notifications: { container: ui.notificationsList, empty: ui.noNotificationsMsg }
        };

        const config = sectionMap[section];
        if (!config && section !== 'notifications') {
            if (section !== 'shortcuts') { // Allow missing shortcuts
                console.warn(`[UI Loading] Unknown section '${section}' for setLoadingState in main.js.`);
            }
            return;
        }

        if (config?.loader) {
            config.loader.style.display = isLoadingFlag ? 'flex' : 'none';
        }
        if (isLoadingFlag) {
            if (config?.content) config.content.style.display = 'none';
            if (config?.empty) config.empty.style.display = 'none';
            // Render skeletons
            if (section === 'tests' && config?.content) renderTestSkeletons(config.content);
            else if (section === 'plan' && config?.content) renderPlanSkeletons(config.content);
            else if (section === 'topics' && config?.content) renderTopicSkeletons(config.content);
            else if (section === 'stats' && config?.skeletonContainer) renderShortcutSkeletons(config.skeletonContainer);

        } else {
            // After loading, determine visibility based on data
            let hasContent = false;
            if (section === 'tests') hasContent = diagnosticResultsData && diagnosticResultsData.length > 0;
            else if (section === 'plan') hasContent = !!studyPlanData;
            else if (section === 'topics') hasContent = topicProgressData && topicProgressData.length > 0;
            else if (section === 'stats') hasContent = !!userStatsData;

            if (config && section !== 'notifications') {
                if (config.content) config.content.style.display = hasContent ? 'block' : 'none';
                if (config.empty) config.empty.style.display = hasContent ? 'none' : 'block';
            }
             // Handle stats cards loading class separately
             if (section === 'stats' && config?.container && config?.childrenSelector) {
                config.container.querySelectorAll(config.childrenSelector).forEach(child => {
                    child.classList.toggle('loading', !hasContent); // Keep loading if no stats
                });
            }
            // Remove loading class from shortcuts when stats are done
            if (section === 'stats' && ui.shortcutsGrid) {
                 ui.shortcutsGrid.classList.remove('loading');
                 // Restore actual shortcut content if it was replaced by skeletons
                 renderShortcuts();
             }
        }
    }

    // --- Skeleton Rendering Functions ---
    function renderTestSkeletons(container) { if (!container) return; container.innerHTML = `<div class="test-stats loading"><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder" style="width: 50px; height: 50px;"></div><div style="flex-grow: 1;"><div class="skeleton value" style="width: 50px; height:28px;"></div><div class="skeleton text" style="width: 80px; height:14px;"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder" style="width: 50px; height: 50px;"></div><div style="flex-grow: 1;"><div class="skeleton value" style="width: 45px; height:28px;"></div><div class="skeleton text" style="width: 70px; height:14px;"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder" style="width: 50px; height: 50px;"></div><div style="flex-grow: 1;"><div class="skeleton value" style="width: 55px; height:28px;"></div><div class="skeleton text" style="width: 75px; height:14px;"></div></div></div></div></div><div class="chart-container loading"><div class="skeleton" style="height: 350px; width: 100%;"></div></div><div class="last-test-result card loading"><div class="loading-skeleton"><div class="skeleton title" style="width: 40%;"></div><div class="skeleton text" style="width: 30%;"></div></div></div><div class="test-list loading"><div class="skeleton" style="height: 70px; width: 100%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 70px; width: 100%;"></div></div>`; }
    function renderPlanSkeletons(container) { if (!container) return; container.innerHTML = `<div class="schedule-grid loading"><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 40%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 50%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 45%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div></div>`; }
    function renderTopicSkeletons(container) { if (!container) return; container.innerHTML = `<div class="topic-grid loading"><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div></div>`; }
    function renderShortcutSkeletons(container) { if (!container) return; container.innerHTML = `<div class="shortcut-card card loading"><div class="loading-skeleton" style="align-items: center; padding: 1.8rem;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 16px; margin-bottom: 1.2rem;"></div><div class="skeleton" style="height: 18px; width: 70%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.4rem;"></div><div class="skeleton" style="height: 14px; width: 80%;"></div></div></div><div class="shortcut-card card loading"><div class="loading-skeleton" style="align-items: center; padding: 1.8rem;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 16px; margin-bottom: 1.2rem;"></div><div class="skeleton" style="height: 18px; width: 65%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 14px; width: 85%; margin-bottom: 0.4rem;"></div><div class="skeleton" style="height: 14px; width: 75%;"></div></div></div>`; container.classList.add('loading'); }

    // --- Data Fetching ---
    async function fetchUserProfile(userId) { if (!supabase || !userId) return null; console.log(`[Profile] Fetching profile for user ID: ${userId}`); try { const { data: profile, error } = await supabase.from('profiles').select('*, selected_title').eq('id', userId).single(); if (error && error.code !== 'PGRST116') throw error; return profile || null; } catch (error) { console.error('[Profile] Exception fetching profile:', error); return null; } }
    async function fetchTitles() { if (!supabase) return []; console.log(`[Titles] Fetching available titles...`); try { const { data, error } = await supabase.from('title_shop').select('title_key, name'); if (error) throw error; return data || []; } catch (error) { console.error("[Titles] Error fetching titles:", error); return []; } }
    async function fetchDashboardStats(userId, profileData) { if (!supabase || !userId || !profileData) return null; console.log(`[Stats] Fetching dashboard stats for user ${userId}...`); let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests, total_study_seconds, weakest_topic_name').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; } catch (error) { statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0, total_study_seconds: fetchedStats?.total_study_seconds ?? 0, weakest_topic_name: fetchedStats?.weakest_topic_name ?? null, }; if (statsError) console.warn("[Stats] Error fetching user_stats, using profile data as fallback:", statsError?.message); return finalStats; }
    async function fetchDiagnosticResults(userId) { if (!supabase || !userId) return []; console.log(`[Tests] Fetching diagnostic results for user ${userId}...`); try { const { data, error } = await supabase.from('user_diagnostics').select('id, completed_at, total_score, total_questions, time_spent').eq('user_id', userId).order('completed_at', { ascending: false }); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching diagnostic results:", err); return []; } }
    async function fetchActiveStudyPlan(userId) { if (!supabase || !userId) return null; console.log(`[Plan] Fetching active study plan for user ${userId}...`); try { const { data: plans, error } = await supabase.from('study_plans').select('id, title, created_at').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }).limit(1); if (error) throw error; return plans?.[0] || null; } catch (err) { console.error("Error fetching active study plan:", err); return null; } }
    async function fetchPlanActivities(planId) { if (!planId || !supabase) return []; console.log(`[Plan] Fetching activities for plan ${planId}...`); try { const { data, error } = await supabase.from('plan_activities').select('id, title, day_of_week, time_slot, completed, description, type').eq('plan_id', planId).order('day_of_week').order('time_slot'); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching plan activities:", err); return []; } }
    async function fetchTopicProgress(userId) { if (!supabase || !userId) return []; console.log(`[Topics] Fetching topic progress for user ${userId}...`); try { const { data, error } = await supabase .from('user_topic_progress') .select(` topic_id, progress, strength, questions_attempted, questions_correct, topic:exam_topics!inner( name, subject ) `) .eq('user_id', userId); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching topic progress:", err); return []; } }

    // --- UI Rendering ---
    function renderStatsCards(stats) { if (!stats) { console.warn("[Render Stats] No stats data provided."); ui.statsCardsContainer?.querySelectorAll('.dashboard-card').forEach(c => c.classList.add('loading')); return; } ui.statsCardsContainer?.querySelectorAll('.dashboard-card').forEach(c => c.classList.remove('loading')); if (ui.statsCompleted) ui.statsCompleted.textContent = (stats.completed_exercises ?? 0) + (stats.completed_tests ?? 0); if (ui.statsCompletedChange) ui.statsCompletedChange.innerHTML = `<i class="fas fa-check"></i> Cvičení: ${stats.completed_exercises || 0}, Testů: ${stats.completed_tests || 0}`; const avgScore = calculateAverageScore(diagnosticResultsData); if (ui.statsAvgScore) ui.statsAvgScore.textContent = `${avgScore}%`; if (ui.statsAvgScoreChange) ui.statsAvgScoreChange.innerHTML = `<i class="fas fa-poll"></i> V ${diagnosticResultsData.length} testech`; const totalSeconds = stats.total_study_seconds ?? 0; const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); if (ui.statsTimeSpent) ui.statsTimeSpent.textContent = `${hours}h ${minutes}m`; if (ui.statsTimeChange) ui.statsTimeChange.innerHTML = `<i class="fas fa-stopwatch"></i> Celkem stráveno`; if (ui.statsWeakestTopic) ui.statsWeakestTopic.textContent = stats.weakest_topic_name || '-'; if (ui.statsWeakestTopicFooter) ui.statsWeakestTopicFooter.innerHTML = `<i class="fas fa-atom"></i> Poslední analýza`; }
    function calculateAverageScore(results) { if (!results || results.length === 0) return '-'; const validScores = results.filter(r => typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0); if (validScores.length === 0) return '-'; const avgPercentage = validScores.reduce((sum, r) => sum + (r.total_score / r.total_questions) * 100, 0) / validScores.length; return Math.round(avgPercentage); }
    function renderTestResults(results) { if (!ui.testResultsContainer || !ui.testResultsContent || !ui.testResultsEmpty || !ui.testStatsContainer || !ui.lastTestResultContainer || !ui.testHistoryContainer || !ui.startTestBtnResults) { console.warn("Missing elements for renderTestResults"); return; } ui.testResultsContent.innerHTML = ''; ui.testResultsContent.style.display = 'none'; ui.testResultsEmpty.style.display = 'none'; if (!results || results.length === 0) { ui.testResultsEmpty.style.display = 'block'; ui.startTestBtnResults.style.display = 'inline-flex'; return; } ui.testResultsContent.style.display = 'block'; ui.startTestBtnResults.style.display = 'inline-flex'; const avgScore = calculateAverageScore(results); const validScores = results.filter(r => typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0); const bestScore = validScores.length > 0 ? Math.round(Math.max(...validScores.map(r => (r.total_score / r.total_questions) * 100))) : '-'; const validTimes = results.filter(r => r.time_spent != null && typeof r.time_spent === 'number' && r.time_spent > 0); const avgTime = validTimes.length > 0 ? formatTime(validTimes.reduce((sum, r) => sum + r.time_spent, 0) / validTimes.length) : '--:--'; ui.testStatsContainer.innerHTML = ` <div class="stats-card"> <div class="stats-icon primary"><i class="fas fa-percentage"></i></div><div class="stats-value">${avgScore}%</div><div class="stats-label">Prům. Skóre</div></div> <div class="stats-card"> <div class="stats-icon success"><i class="fas fa-trophy"></i></div><div class="stats-value">${bestScore}%</div><div class="stats-label">Nejlepší Skóre</div></div> <div class="stats-card"> <div class="stats-icon warning"><i class="fas fa-clock"></i></div><div class="stats-value">${avgTime}</div><div class="stats-label">Prům. Čas</div></div> `; const chartDataPoints = results.filter(r => r.completed_at && typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0).sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at)).map(r => ({ date: new Date(r.completed_at + 'T00:00:00Z'), score: Math.round((r.total_score / r.total_questions) * 100) })); renderTestChart({ labels: chartDataPoints.map(p => p.date), data: chartDataPoints.map(p => p.score) }); if (results[0]) { const lastTest = results[0]; const scorePercent = calculateAverageScore([lastTest]); ui.lastTestResultContainer.innerHTML = `<div class="test-result-header"><div class="test-result-title"><h3>Diagnostický Test</h3><div class="test-result-meta">Dokončeno ${formatDate(lastTest.completed_at)}</div></div><div class="test-result-score"><div class="test-result-score-value">${scorePercent}%</div><div class="test-result-score-label">(${lastTest.total_score}/${lastTest.total_questions})</div></div></div>`; } else { ui.lastTestResultContainer.innerHTML = `<p>Žádný výsledek.</p>`; } if (results.length > 1) { ui.testHistoryContainer.innerHTML = results.slice(1).map(test => { const scorePercentHist = calculateAverageScore([test]); const timeSpent = test.time_spent != null ? formatTime(test.time_spent) : '--:--'; return `<div class="test-item"><div class="test-info"><div class="test-icon"><i class="fas fa-clipboard-check"></i></div><div class="test-details"><h4>Diagnostický Test</h4><div class="test-meta"><span><i class="far fa-calendar"></i> ${formatDate(test.completed_at)}</span><span><i class="far fa-clock"></i> ${timeSpent}</span></div></div></div><div class="test-score">${scorePercentHist}%</div></div>`; }).join(''); } else { ui.testHistoryContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Žádná další historie.</p>`; } }
    function renderTestChart(chartData) { if (!ui.testsChartCanvas) { console.warn("Canvas element for test chart not found."); return; } const container = ui.testsChartCanvas.parentElement; if (!container) { console.warn("Container for test chart canvas not found."); return; } const ctx = ui.testsChartCanvas.getContext('2d'); if (testsChartInstance) testsChartInstance.destroy(); if (!chartData || !chartData.labels || !chartData.data || chartData.labels.length < 2) { ui.testsChartCanvas.style.display = 'none'; container.classList.add('loading'); container.innerHTML = `<p style='text-align: center; padding: 2rem;'>Nedostatek dat pro zobrazení grafu.</p>`; return; } ui.testsChartCanvas.style.display = 'block'; container.classList.remove('loading'); container.innerHTML = ''; container.appendChild(ui.testsChartCanvas); const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches; const gridColor = 'rgba(160, 92, 255, 0.15)'; const textColor = '#808db0'; const pointColor = '#00e0ff'; const lineColor = '#00e0ff'; const bgColor = 'rgba(0, 224, 255, 0.1)'; try { testsChartInstance = new Chart(ctx, { type: 'line', data: { labels: chartData.labels, datasets: [{ label: 'Skóre (%)', data: chartData.data, borderColor: lineColor, backgroundColor: bgColor, borderWidth: 2.5, pointBackgroundColor: pointColor, pointRadius: 4, pointHoverRadius: 6, tension: 0.3, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time', time: { unit: 'day', tooltipFormat: 'P', displayFormats: { day: 'd.M.' } }, ticks: { color: textColor, maxRotation: 0, autoSkipPadding: 15 }, grid: { display: false } }, y: { beginAtZero: true, max: 100, ticks: { stepSize: 25, color: textColor, callback: (v) => v + '%' }, grid: { color: gridColor } } }, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(6, 4, 22, 0.92)', titleColor: '#ffffff', bodyColor: '#b8c4e0', borderColor: 'rgba(160, 92, 255, 0.45)', borderWidth: 1, padding: 10, displayColors: false, callbacks: { title: (items) => { try { return dateFns.format(new Date(items[0].parsed.x), 'PPP', { locale: dateFns.locale.cs || dateFns.locale.enUS }); } catch { return 'Chyba data'; } }, label: (ctx) => `Skóre: ${ctx.parsed.y.toFixed(0)}%` } } }, interaction: { mode: 'nearest', axis: 'x', intersect: false } } }); } catch (e) { console.error("Error creating Chart instance:", e); container.innerHTML = `<p style='text-align: center; padding: 2rem; color: var(--accent-pink);'>Chyba při vykreslování grafu.</p>`; } }
    function renderStudyPlanOverview(plan, activities) { if (!ui.studyPlanContainer || !ui.studyPlanContent || !ui.studyPlanEmpty || !ui.mainPlanScheduleGrid || !ui.startTestBtnPlan) { console.warn("Missing elements for renderStudyPlanOverview"); return; } ui.studyPlanContent.innerHTML = ''; ui.studyPlanContent.style.display = 'none'; ui.studyPlanEmpty.style.display = 'none'; if (!plan) { ui.studyPlanEmpty.style.display = 'block'; ui.startTestBtnPlan.style.display = 'inline-flex'; return; } ui.studyPlanContent.style.display = 'block'; ui.startTestBtnPlan.style.display = 'none'; ui.mainPlanScheduleGrid.innerHTML = ''; const daysOrder = [1, 2, 3, 4, 5, 6, 0]; const dayNames = { 0: 'Neděle', 1: 'Pondělí', 2: 'Úterý', 3: 'Středa', 4: 'Čtvrtek', 5: 'Pátek', 6: 'Sobota' }; const activitiesByDay = {}; daysOrder.forEach(dayIndex => activitiesByDay[dayIndex] = []); (activities || []).forEach(activity => { if (activitiesByDay[activity.day_of_week] !== undefined) activitiesByDay[activity.day_of_week].push(activity); }); daysOrder.forEach(dayIndex => { const dayName = dayNames[dayIndex]; const dayDiv = document.createElement('div'); dayDiv.className = 'schedule-day card'; const headerDiv = document.createElement('div'); headerDiv.className = 'schedule-day-header'; headerDiv.textContent = dayName; dayDiv.appendChild(headerDiv); const activitiesDiv = document.createElement('div'); activitiesDiv.className = 'schedule-activities'; const dayActivities = activitiesByDay[dayIndex].sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || '')); if (dayActivities.length > 0) { dayActivities.forEach(activity => { const visual = activityVisuals[activity.type?.toLowerCase()] || activityVisuals.default; const title = sanitizeHTML(activity.title || 'Nespecifikováno'); const timeSlot = activity.time_slot ? `<span>${sanitizeHTML(activity.time_slot)}</span>` : ''; const activityItem = document.createElement('div'); activityItem.className = `schedule-activity-item ${activity.completed ? 'completed' : ''}`; activityItem.innerHTML = `<i class="fas ${visual.icon} activity-icon"></i><div class="activity-details"><strong>${title}</strong>${timeSlot}</div>`; activitiesDiv.appendChild(activityItem); }); } else { activitiesDiv.innerHTML = `<p class="no-activities-placeholder">Žádné aktivity</p>`; } dayDiv.appendChild(activitiesDiv); ui.mainPlanScheduleGrid.appendChild(dayDiv); }); ui.studyPlanContent.innerHTML += `<div class="full-plan-link-container"><a href="plan.html" class="btn btn-secondary">Zobrazit celý plán a detaily</a></div>`; }
    function renderTopicAnalysis(topics) { if (!ui.topicAnalysisContainer || !ui.topicAnalysisContent || !ui.topicAnalysisEmpty || !ui.topicGrid || !ui.startTestBtnAnalysis) { console.warn("Missing elements for renderTopicAnalysis"); return; } ui.topicAnalysisContent.innerHTML = ''; ui.topicGrid.innerHTML = ''; ui.topicAnalysisContent.style.display = 'none'; ui.topicAnalysisEmpty.style.display = 'none'; if (!topics || topics.length === 0) { ui.topicAnalysisEmpty.style.display = 'block'; ui.startTestBtnAnalysis.style.display = 'inline-flex'; return; } ui.topicAnalysisContent.style.display = 'block'; ui.startTestBtnAnalysis.style.display = 'none'; const fragment = document.createDocumentFragment(); topics.sort((a, b) => { const order = { 'weakness': 0, 'neutral': 1, 'strength': 2 }; return (order[a.strength] ?? 1) - (order[b.strength] ?? 1); }); topics.forEach(topic => { const topicName = topic.topic?.name || `Téma ${topic.topic_id}` || 'Neznámé téma'; const iconClass = topicIcons[topicName] || topicIcons.default || 'fa-book'; const strength = topic.strength || 'neutral'; const progress = topic.progress || 0; const attempted = topic.questions_attempted || 0; const correct = topic.questions_correct || 0; const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0; const accuracyClass = accuracy >= 75 ? 'high' : accuracy < 50 ? 'low' : 'medium'; const card = document.createElement('div'); card.className = `topic-card card ${strength}`; card.innerHTML = ` <div class="topic-header"> <div class="topic-icon"><i class="fas ${iconClass}"></i></div> <h3 class="topic-title">${sanitizeHTML(topicName)}</h3> </div> <div class="progress-container" title="Celkový pokrok v tématu: ${progress}%"> <div class="progress-bar" style="width: ${progress}%;"></div> </div> <div class="topic-stats"> <div class="topic-stat"> <span>Správnost otázek:</span> <strong class="accuracy-value ${accuracyClass}">${accuracy}%</strong> </div> <div class="topic-stat"> <span>Zodpovězeno:</span> <strong>${correct}/${attempted}</strong> </div> </div>`; fragment.appendChild(card); }); ui.topicGrid.appendChild(fragment); }
    function updateUserInfoUI(profile, titlesData = []) { console.log("[UI Update] Aktualizace informací uživatele v sidebaru..."); if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[UI Update] Elementy sidebaru nenalezeny."); return; } if (profile) { const firstName = profile.first_name ?? ''; const lastName = profile.last_name ?? ''; const username = profile.username ?? ''; const emailUsername = currentUser?.email?.split('@')[0] || ''; const displayName = `${firstName} ${lastName}`.trim() || username || emailUsername || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(profile); const avatarUrl = profile.avatar_url; ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot'; if (selectedTitleKey && titlesData && titlesData.length > 0) { const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) { displayTitle = foundTitle.name; } } ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); } else { console.warn("[UI Update] Chybí currentUser nebo currentProfile, nastavuji výchozí hodnoty."); ui.sidebarName.textContent = "Nepřihlášen"; ui.sidebarAvatar.textContent = '?'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title'); } }
    function renderShortcuts() { if (!ui.shortcutsGrid) return; ui.shortcutsGrid.innerHTML = ` <div class="shortcut-card card" data-animate style="--animation-order: 7;"> <div class="shortcut-icon"><i class="fas fa-dumbbell"></i></div> <h3 class="shortcut-title">Spustit Výuku (AI)</h3> <p class="shortcut-desc">Začněte novou lekci s AI Tutorem na základě vašeho plánu.</p> <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Spustit</a> </div> <div class="shortcut-card card" data-animate style="--animation-order: 8;"> <div class="shortcut-icon"><i class="fas fa-vial"></i></div> <h3 class="shortcut-title">Diagnostický Test</h3> <p class="shortcut-desc">Ověřte své znalosti a získejte personalizovaný plán.</p> <a href="/dashboard/procvicovani/test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit</a> </div> `; requestAnimationFrame(initScrollAnimations); }

    // --- Load Page Data ---
    async function loadPageData() {
        if (!currentUser || !currentProfile) { showError("Nelze načíst data: Chybí informace o uživateli."); setLoadingState('all', false); return; }
        console.log("🔄 [Load Page] Loading all procvičování data...");
        setLoadingState('all', true);
        hideError();
        renderShortcutSkeletons(ui.shortcutsGrid);

        try {
            const [stats, diagnostics, plan, topics] = await Promise.all([
                fetchDashboardStats(currentUser.id, currentProfile),
                fetchDiagnosticResults(currentUser.id),
                fetchActiveStudyPlan(currentUser.id),
                fetchTopicProgress(currentUser.id)
            ]);

            userStatsData = stats;
            diagnosticResultsData = diagnostics;
            studyPlanData = plan;
            topicProgressData = topics;

            if (studyPlanData) { planActivitiesData = await fetchPlanActivities(studyPlanData.id); }
            else { planActivitiesData = []; }

            renderStatsCards(userStatsData);
            renderTestResults(diagnosticResultsData);
            renderStudyPlanOverview(studyPlanData, planActivitiesData);
            renderTopicAnalysis(topicProgressData);
            renderShortcuts(); // Render actual shortcuts

            if (diagnosticResultsData.length === 0 && ui.diagnosticPrompt) {
                ui.diagnosticPrompt.style.display = 'flex';
                if(ui.testResultsEmpty) ui.testResultsEmpty.style.display = 'none';
                if(ui.studyPlanEmpty) ui.studyPlanEmpty.style.display = 'none';
                if(ui.topicAnalysisEmpty) ui.topicAnalysisEmpty.style.display = 'none';
            } else if (ui.diagnosticPrompt) {
                ui.diagnosticPrompt.style.display = 'none';
            }

            const defaultTabButton = document.querySelector('.content-tab[data-tab="practice-tab"]');
            const defaultTabContent = document.getElementById('practice-tab');
            if(defaultTabButton && defaultTabContent && !defaultTabButton.classList.contains('active')) {
                 document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
                 document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                 defaultTabButton.classList.add('active');
                 defaultTabContent.classList.add('active');
            }

            console.log("✅ [Load Page] All data loaded and rendered.");

        } catch (error) {
            console.error("❌ [Load Page] Error loading page data:", error);
            showError(`Nepodařilo se načíst data pro stránku Procvičování: ${error.message}`, true);
            renderStatsCards(null);
            renderTestResults([]);
            renderStudyPlanOverview(null, []);
            renderTopicAnalysis([]);
            renderShortcuts();
        } finally {
            setLoadingState('all', false);
            initTooltips();
        }
    }

    // --- Event Handlers ---
    function handleTabSwitch(event) { const tabId = event.currentTarget.dataset.tab; ui.contentTabs?.forEach(t => t.classList.remove('active')); ui.tabContents?.forEach(c => c.classList.remove('active')); event.currentTarget.classList.add('active'); const activeContent = document.getElementById(tabId); if(activeContent) { activeContent.classList.add('active'); requestAnimationFrame(() => { activeContent.querySelectorAll('[data-animate]').forEach(el => {el.classList.remove('animated');}); initScrollAnimations(); }); } else { console.warn(`Content for tab ${tabId} not found!`); } if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' }); }
    async function handleRefreshClick() { if (Object.values(isLoading).some(s => s)) { showToast('Info','Data se již načítají.', 'info'); return; } const icon = ui.refreshDataBtn?.querySelector('i'); const text = ui.refreshDataBtn?.querySelector('.refresh-text'); if(ui.refreshDataBtn) ui.refreshDataBtn.disabled = true; if(icon) icon.classList.add('fa-spin'); if(text) text.textContent = 'RELOADING...'; await loadPageData(); if(ui.refreshDataBtn) ui.refreshDataBtn.disabled = false; if(icon) icon.classList.remove('fa-spin'); if(text) text.textContent = 'RELOAD'; initTooltips(); }

    // --- Setup Event Listeners ---
    function setupEventListeners() {
        console.log("[SETUP] Setting up event listeners for main.js...");
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
        document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });
        ui.contentTabs?.forEach(tab => { tab.addEventListener('click', handleTabSwitch); });
        if (ui.refreshDataBtn) ui.refreshDataBtn.addEventListener('click', handleRefreshClick);
        if (ui.startTestBtnPrompt) ui.startTestBtnPrompt.addEventListener('click', () => window.location.href = 'test1.html');
        if (ui.startTestBtnResults) ui.startTestBtnResults.addEventListener('click', () => window.location.href = 'test1.html');
        if (ui.startTestBtnPlan) ui.startTestBtnPlan.addEventListener('click', () => window.location.href = 'test1.html');
        if (ui.startTestBtnAnalysis) ui.startTestBtnAnalysis.addEventListener('click', () => window.location.href = 'test1.html');
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();
        if (ui.mainContent) ui.mainContent.addEventListener('scroll', handleScroll, { passive: true });
        console.log("[SETUP] Event listeners for main.js set up.");
    }

    // --- Initialize ---
    function initializeApp() {
        console.log("[INIT Procvičování] Adding 'dashboardReady' event listener...");

        document.addEventListener('dashboardReady', async (event) => {
            console.log("[INIT Procvičování] 'dashboardReady' event received.");
            supabase = event.detail.client;
            currentUser = event.detail.user;
            currentProfile = event.detail.profile;
            allTitles = event.detail.titles;

            if (!supabase || !currentUser || !currentProfile) {
                console.error("[INIT Procvičování] Critical data missing from dashboardReady event.");
                showError("Chyba načítání základních dat. Zkuste obnovit stránku.", true);
                if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }
                return;
            }

            console.log(`[INIT Procvičování] User authenticated (ID: ${currentUser.id}). Profile and titles received.`);

            try {
                setupEventListeners();
                updateCopyrightYear();
                updateUserInfoUI(currentProfile, allTitles); // Update sidebar

                await loadPageData(); // Load page specific data

                if (ui.mainContent) {
                    ui.mainContent.style.display = 'block';
                    requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); });
                }
                initMouseFollower();
                initTooltips();

                console.log("✅ [INIT Procvičování] Page fully initialized.");

            } catch (error) {
                console.error("❌ [Init Procvičování] Error during page-specific setup:", error);
                showError(`Chyba inicializace stránky Procvičování: ${error.message}`, true);
                if (ui.mainContent) ui.mainContent.style.display = 'block';
                setLoadingState('all', false);
            } finally {
                 if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) {
                     ui.initialLoader.classList.add('hidden');
                     setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300);
                 }
            }
        }); // End of dashboardReady listener

        // Initial setup that doesn't depend on dashboardReady
        if (ui.mainContent) ui.mainContent.style.display = 'none';
        console.log("[INIT Procvičování] Waiting for 'dashboardReady' event...");
    }

    // --- Run ---
    initializeApp(); // Setup the event listener

})(); // End IIFE