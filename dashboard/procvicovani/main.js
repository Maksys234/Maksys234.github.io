(function() {
    'use strict';

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
    let isLoading = {
        stats: false,
        tests: false,
        plan: false,
        topics: false,
        notifications: false
    };
    const NOTIFICATION_FETCH_LIMIT = 5;

    const topicIcons = {
        "Algebra": "fa-square-root-alt",
        "Aritmetika": "fa-calculator",
        "Geometrie": "fa-draw-polygon",
        "Logika": "fa-brain",
        "Logické úlohy": "fa-brain",
        "Statistika": "fa-chart-bar",
        "Čísla a aritmetické operace": "fa-calculator",
        "Práce s daty": "fa-chart-bar",
        "Problémové úlohy": "fa-lightbulb",
        "Proporce a procenta": "fa-percentage",
        "default": "fa-book"
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

    const ui = {
        initialLoader: document.getElementById('initial-loader'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        mainContent: document.getElementById('main-content'),
        sidebar: document.getElementById('sidebar'),
        mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
        sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
        sidebarAvatar: document.getElementById('sidebar-avatar'),
        sidebarName: document.getElementById('sidebar-name'),
        dashboardHeader: document.querySelector('.dashboard-header'),
        dashboardTitle: document.getElementById('dashboard-title'),
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
        testResultsLoading: document.getElementById('test-results-loading'),
        testResultsContent: document.getElementById('test-results-content'),
        testResultsEmpty: document.getElementById('test-results-empty'),
        startTestBtnResults: document.getElementById('start-test-btn-results'),
        testStatsContainer: document.getElementById('test-stats'),
        testAvgScore: document.getElementById('test-avg-score'),
        testBestScore: document.getElementById('test-best-score'),
        testAvgTime: document.getElementById('test-avg-time'),
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
        topicGrid: document.getElementById('topic-grid'),
        toastContainer: document.getElementById('toast-container'),
        globalError: document.getElementById('global-error'),
        offlineBanner: document.getElementById('offline-banner'),
        currentYearSidebar: document.getElementById('currentYearSidebar'),
        currentYearFooter: document.getElementById('currentYearFooter'),
        mouseFollower: document.getElementById('mouse-follower')
    };

    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; const retryBtn = document.getElementById('global-retry-btn'); if (retryBtn) { retryBtn.addEventListener('click', () => { hideError(); if (currentUser && !Object.values(isLoading).some(s=>s)) { setLoadingState('all', true); loadPageData(); } else { showToast("Info", "Data se načítají nebo nejste přihlášeni.", "info"); } }); } } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function sanitizeHTML(str) { const t = document.createElement('div'); t.textContent = str || ''; return t.innerHTML; }
    function getInitials(profile) { if (!profile) return '?'; const f = profile.first_name?.[0] || ''; const l = profile.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = profile.username?.[0].toUpperCase() || ''; const emailInitial = profile.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatDate(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) return '-'; return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return '-'; } }
    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return '--:--'; const m = Math.floor(seconds / 60); const s = Math.round(seconds % 60); return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; }
    function openMenu() { ui.sidebar?.classList.add('active'); ui.sidebarOverlay?.classList.add('active'); }
    function closeMenu() { ui.sidebar?.classList.remove('active'); ui.sidebarOverlay?.classList.remove('active'); }
    function updateUserInfoUI() { if (!ui.sidebarName || !ui.sidebarAvatar) return; if (currentUser && currentProfile) { const displayName = `${currentProfile.first_name || ''} ${currentProfile.last_name || ''}`.trim() || currentProfile.username || currentUser.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(currentProfile); const avatarUrl = currentProfile.avatar_url; ui.sidebarAvatar.innerHTML = avatarUrl && !avatarUrl.startsWith('assets/') ? `<img src="${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}" alt="${sanitizeHTML(initials)}">` : avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); } else { ui.sidebarName.textContent = 'Nepřihlášen'; ui.sidebarAvatar.textContent = '?'; } }
    function handleScroll() { if (!ui.mainContent || !ui.dashboardHeader) return; document.body.classList.toggle('scrolled', ui.mainContent.scrollTop > 10); }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    function initTooltips() { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } }
    function updateCopyrightYear() { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; }
    function initMouseFollower() { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); }
    function initScrollAnimations() { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) { console.log("Scroll animations not initialized."); return; } const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); }
    function initHeaderScrollDetection() { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); }
    function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = 'none'; if (!navigator.onLine) console.warn("Network offline, banner display is disabled."); }

    function setLoadingState(sectionKey, isLoadingFlag) {
        const sectionMap = {
            stats: ui.statsCardsContainer,
            tests: ui.testResultsContainer,
            plan: ui.studyPlanContainer,
            topics: ui.topicAnalysisContainer,
            notifications: ui.notificationBell
        };
        const loadingMap = {
            stats: ui.statsCardsContainer?.querySelectorAll('.dashboard-card'),
            tests: ui.testResultsLoading,
            plan: ui.studyPlanLoading,
            topics: ui.topicAnalysisLoading,
            notifications: null
        };
        const contentMap = {
            stats: null,
            tests: ui.testResultsContent,
            plan: ui.studyPlanContent,
            topics: ui.topicAnalysisContent,
            notifications: ui.notificationsList
        };
        const emptyMap = {
            tests: ui.testResultsEmpty,
            plan: ui.studyPlanEmpty,
            topics: ui.topicAnalysisEmpty,
            notifications: ui.noNotificationsMsg
        };
        const skeletonMap = {
            stats: ui.statsCardsContainer?.querySelectorAll('.loading-skeleton'),
            tests: ui.testStatsContainer?.querySelectorAll('.loading-skeleton'),
            plan: ui.mainPlanScheduleGrid?.querySelectorAll('.loading-skeleton'),
            topics: ui.topicGrid?.querySelectorAll('.loading-skeleton'),
            notifications: ui.notificationsList?.querySelectorAll('.skeleton')
        };

        if (sectionKey === 'all') { Object.keys(isLoading).forEach(key => setLoadingState(key, isLoadingFlag)); return; }
        if (isLoading[sectionKey] === isLoadingFlag) return;
        isLoading[sectionKey] = isLoadingFlag;

        const container = sectionMap[sectionKey];
        const loaderElements = loadingMap[sectionKey];
        const contentEl = contentMap[sectionKey];
        const emptyEl = emptyMap[sectionKey];
        const skeletons = skeletonMap[sectionKey];

        if (container && sectionKey !== 'notifications') {
            container.classList.toggle('loading', isLoadingFlag);
        }
        if (loaderElements instanceof NodeList) {
            loaderElements.forEach(card => card.classList.toggle('loading', isLoadingFlag));
        } else if (loaderElements) {
            loaderElements.style.display = isLoadingFlag ? 'flex' : 'none';
        }

        if (isLoadingFlag) {
            if (contentEl) contentEl.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'none';
            if (skeletons && skeletons.length > 0) {
                if ((sectionKey === 'topics' && ui.topicGrid) || (sectionKey === 'plan' && ui.mainPlanScheduleGrid)) {
                    const gridParent = sectionKey === 'topics' ? ui.topicAnalysisContent : ui.studyPlanContent;
                    if(gridParent) gridParent.style.display = 'block';
                    const grid = sectionKey === 'topics' ? ui.topicGrid : ui.mainPlanScheduleGrid;
                    if(grid) grid.style.display = 'grid';
                }
                 if (sectionKey === 'notifications' && ui.notificationsList) {
                     renderNotificationSkeletons(2);
                 } else {
                     skeletons.forEach(skel => {
                        skel.style.display = 'flex';
                        if(skel.parentElement && skel.parentElement.classList.contains('loading-skeleton')) {
                            skel.parentElement.style.display = 'flex';
                        }
                     });
                 }
            }
        } else {
            if (skeletons && skeletons.length > 0) {
                skeletons.forEach(skel => {
                     skel.style.display = 'none';
                     if(skel.parentElement && skel.parentElement.classList.contains('loading-skeleton')) {
                         skel.parentElement.style.display = 'none';
                     }
                 });
            }
        }

        if (sectionKey === 'notifications') {
            if(ui.notificationBell) { ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1; }
            if(ui.markAllReadBtn) { const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0; }
        }
    }

    async function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded."); } supabase = window.supabase.createClient(supabaseUrl, supabaseKey); if (!supabase) throw new Error("Supabase client creation failed."); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nelze se připojit.", true); return false; } }
    async function fetchUserProfile(userId) { if (!supabase || !userId) return null; try { const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).single(); if (error && error.code !== 'PGRST116') throw error; if (!profile) { return null; } return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); showToast('Chyba Profilu','Nepodařilo se načíst data profilu.', 'error'); return null; } }
    async function fetchDashboardStats(userId, profileData) { if (!supabase || !userId || !profileData) { return null; } let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats Fetch] Supabase error fetching user_stats:", statsError.message); } } catch (error) { console.error("[Stats Fetch] Exception fetching user_stats:", error); statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0 }; if (statsError) { console.warn("[Stats Fetch] Returning stats based primarily on profile due to fetch error."); } return finalStats; }
    async function fetchDiagnosticResults(userId) { try { const { data, error } = await supabase.from('user_diagnostics').select('id, completed_at, total_score, total_questions, time_spent').eq('user_id', userId).order('completed_at', { ascending: false }); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching diagnostic results:", err); showToast(`Chyba načítání testů: ${err.message}`, "error"); return []; } }
    async function fetchActiveStudyPlan(userId) { try { const { data: plans, error } = await supabase.from('study_plans').select('id, title, created_at').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }).limit(1); if (error) throw error; return plans?.[0] || null; } catch (err) { console.error("Error fetching active study plan:", err); return null; } }
    async function fetchPlanActivities(planId) { if (!planId) return []; try { const { data, error } = await supabase.from('plan_activities').select('id, title, day_of_week, time_slot, completed, description, type').eq('plan_id', planId).order('day_of_week').order('time_slot'); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching plan activities:", err); return []; } }
    async function fetchTopicProgress(userId) { setLoadingState('topics', true); try { const { data, error } = await supabase .from('user_topic_progress') .select(` topic_id, progress, strength, questions_attempted, questions_correct, topic:exam_topics!inner( name, subject ) `) .eq('user_id', userId); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching topic progress:", err); showToast(`Chyba načítání pokroku v tématech: ${err.message}`, "error"); return []; } }
    async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) { if (!supabase || !userId) { return { unreadCount: 0, notifications: [] }; } setLoadingState('notifications', true); try { const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } finally { setLoadingState('notifications', false); } }

    function renderStatsCards(stats) { setLoadingState('stats', false); if (ui.statsCardsContainer) ui.statsCardsContainer.querySelectorAll('.dashboard-card').forEach(c => c.classList.remove('loading')); const avgScore = calculateAverageScore(diagnosticResultsData); if (!stats) { if(ui.statsProgress) ui.statsProgress.textContent = "- %"; if(ui.statsProgressChange) ui.statsProgressChange.innerHTML = '<i class="fas fa-minus"></i> N/A'; if(ui.statsTests) ui.statsTests.textContent = "-"; if(ui.statsTestsAvg) ui.statsTestsAvg.textContent = "Prům: N/A"; if(ui.statsPoints) ui.statsPoints.textContent = "-"; if(ui.statsPointsChange) ui.statsPointsChange.innerHTML = '<i class="fas fa-minus"></i> N/A'; if(ui.statsStreak) ui.statsStreak.textContent = "-"; if(ui.statsStreakLongest) ui.statsStreakLongest.textContent = "Nejdelší: N/A"; return; } if(ui.statsProgress) ui.statsProgress.textContent = `${stats.progress ?? 0}%`; if(ui.statsProgressChange) { const change = stats.progress_weekly ?? 0; ui.statsProgressChange.innerHTML = change > 0 ? `<i class="fas fa-arrow-up"></i> +${change}%` : change < 0 ? `<i class="fas fa-arrow-down"></i> ${change}%` : `<i class="fas fa-minus"></i> Beze změny`; ui.statsProgressChange.className = `card-footer ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`; } if(ui.statsTests) ui.statsTests.textContent = stats.completed_tests ?? 0; if(ui.statsTestsAvg) ui.statsTestsAvg.textContent = `Prům. skóre: ${avgScore}%`; if(ui.statsPoints) ui.statsPoints.textContent = stats.points ?? 0; if(ui.statsPointsChange) { const change = stats.points_weekly ?? 0; ui.statsPointsChange.innerHTML = change > 0 ? `<i class="fas fa-arrow-up"></i> +${change} b.` : change < 0 ? `<i class="fas fa-arrow-down"></i> ${change} b.` : `<i class="fas fa-minus"></i> Beze změny`; ui.statsPointsChange.className = `card-footer ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`; } if(ui.statsStreak) ui.statsStreak.textContent = stats.streak_current ?? 0; if(ui.statsStreakLongest) ui.statsStreakLongest.textContent = `Nejdelší: ${stats.streak_longest ?? 0} dní`; }
    function calculateAverageScore(results) { if (!results || results.length === 0) return '-'; const validScores = results.filter(r => typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0); if (validScores.length === 0) return '-'; const avgPercentage = validScores.reduce((sum, r) => sum + (r.total_score / r.total_questions) * 100, 0) / validScores.length; return Math.round(avgPercentage); }
    function renderTestResults(results) { setLoadingState('tests', false); if (!ui.testResultsContainer || !ui.testResultsContent || !ui.testResultsEmpty || !ui.testStatsContainer) return; ui.testResultsContainer.classList.remove('loading'); if (!results || results.length === 0) { ui.testResultsContent.style.display = 'none'; ui.testResultsEmpty.style.display = 'block'; return; } ui.testResultsContent.style.display = 'block'; ui.testResultsEmpty.style.display = 'none'; const avgScore = calculateAverageScore(results); const validScores = results.filter(r => typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0); const bestScore = validScores.length > 0 ? Math.round(Math.max(...validScores.map(r => (r.total_score / r.total_questions) * 100))) : '-'; const validTimes = results.filter(r => r.time_spent != null && typeof r.time_spent === 'number' && r.time_spent > 0); const avgTime = validTimes.length > 0 ? formatTime(validTimes.reduce((sum, r) => sum + r.time_spent, 0) / validTimes.length) : '--:--'; ui.testStatsContainer.innerHTML = ` <div class="stats-card"> <div class="stats-icon primary"><i class="fas fa-percentage"></i></div><div class="stats-value">${avgScore}%</div><div class="stats-label">Prům. Skóre</div></div> <div class="stats-card"> <div class="stats-icon success"><i class="fas fa-trophy"></i></div><div class="stats-value">${bestScore}%</div><div class="stats-label">Nejlepší Skóre</div></div> <div class="stats-card"> <div class="stats-icon warning"><i class="fas fa-clock"></i></div><div class="stats-value">${avgTime}</div><div class="stats-label">Prům. Čas</div></div> `; const chartDataPoints = results.filter(r => r.completed_at && typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0).sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at)).map(r => ({ date: new Date(r.completed_at + 'T00:00:00Z'), score: Math.round((r.total_score / r.total_questions) * 100) })); renderTestChart({ labels: chartDataPoints.map(p => p.date), data: chartDataPoints.map(p => p.score) }); if(ui.lastTestResultContainer && results[0]) { const lastTest = results[0]; const scorePercent = calculateAverageScore([lastTest]); ui.lastTestResultContainer.innerHTML = `<div class="test-result-header"><div class="test-result-title"><h3>Diagnostický Test</h3><div class="test-result-meta">Dokončeno ${formatDate(lastTest.completed_at)}</div></div><div class="test-result-score"><div class="test-result-score-value">${scorePercent}%</div><div class="test-result-score-label">(${lastTest.total_score}/${lastTest.total_questions})</div></div></div>`; } else if(ui.lastTestResultContainer) { ui.lastTestResultContainer.innerHTML = `<p>Žádný výsledek.</p>`; } if(ui.testHistoryContainer) { if (results.length > 1) { ui.testHistoryContainer.innerHTML = results.slice(1).map(test => { const scorePercentHist = calculateAverageScore([test]); const timeSpent = test.time_spent != null ? formatTime(test.time_spent) : '--:--'; return `<div class="test-item"><div class="test-info"><div class="test-icon"><i class="fas fa-clipboard-check"></i></div><div class="test-details"><h4>Diagnostický Test</h4><div class="test-meta"><span><i class="far fa-calendar"></i> ${formatDate(test.completed_at)}</span><span><i class="far fa-clock"></i> ${timeSpent}</span></div></div></div><div class="test-score">${scorePercentHist}%</div></div>`; }).join(''); } else { ui.testHistoryContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Žádná další historie.</p>`; } } }
    function renderTestChart(chartData) { if (!ui.testsChartCanvas) { return; } const ctx = ui.testsChartCanvas.getContext('2d'); if (testsChartInstance) testsChartInstance.destroy(); if (!chartData || !chartData.labels || !chartData.data || chartData.labels.length < 2) { if (ui.testsChartCanvas) ui.testsChartCanvas.style.display = 'none'; return; } ui.testsChartCanvas.style.display = 'block'; const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches; const gridColor = 'rgba(var(--accent-secondary-rgb), 0.15)'; const textColor = 'var(--text-muted)'; const pointColor = 'var(--accent-primary)'; const lineColor = 'var(--accent-primary)'; const bgColor = 'rgba(var(--accent-primary-rgb), 0.1)'; testsChartInstance = new Chart(ctx, { type: 'line', data: { labels: chartData.labels, datasets: [{ label: 'Skóre (%)', data: chartData.data, borderColor: lineColor, backgroundColor: bgColor, borderWidth: 2.5, pointBackgroundColor: pointColor, pointRadius: 4, pointHoverRadius: 6, tension: 0.3, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time', time: { unit: 'day', tooltipFormat: 'P', displayFormats: { day: 'd.M.' } }, ticks: { color: textColor, maxRotation: 0, autoSkipPadding: 15 }, grid: { display: false } }, y: { beginAtZero: true, max: 100, ticks: { stepSize: 25, color: textColor, callback: (v) => v + '%' }, grid: { color: gridColor } } }, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, backgroundColor: 'var(--interface-bg)', titleColor: 'var(--text-heading)', bodyColor: 'var(--text-medium)', borderColor: 'var(--border-color-medium)', borderWidth: 1, padding: 10, displayColors: false, callbacks: { title: (items) => dateFns.format(new Date(items[0].parsed.x), 'PPP', { locale: dateFns.locale.cs || dateFns.locale.enUS }), label: (ctx) => `Skóre: ${ctx.parsed.y.toFixed(0)}%` } } }, interaction: { mode: 'nearest', axis: 'x', intersect: false } } }); }
    function renderStudyPlanOverview(plan, activities) { setLoadingState('plan', false); if (!ui.studyPlanContainer || !ui.studyPlanContent || !ui.studyPlanEmpty || !ui.mainPlanScheduleGrid) return; ui.studyPlanContainer.classList.remove('loading'); if (!plan) { ui.studyPlanContent.style.display = 'none'; ui.studyPlanEmpty.style.display = 'block'; return; } ui.studyPlanContent.style.display = 'block'; ui.studyPlanEmpty.style.display = 'none'; ui.mainPlanScheduleGrid.innerHTML = ''; const daysOrder = [1, 2, 3, 4, 5, 6, 0]; const dayNames = { 0: 'Neděle', 1: 'Pondělí', 2: 'Úterý', 3: 'Středa', 4: 'Čtvrtek', 5: 'Pátek', 6: 'Sobota' }; const activitiesByDay = {}; daysOrder.forEach(dayIndex => activitiesByDay[dayIndex] = []); (activities || []).forEach(activity => { if (activitiesByDay[activity.day_of_week] !== undefined) activitiesByDay[activity.day_of_week].push(activity); }); daysOrder.forEach(dayIndex => { const dayName = dayNames[dayIndex]; const dayDiv = document.createElement('div'); dayDiv.className = 'schedule-day card'; const headerDiv = document.createElement('div'); headerDiv.className = 'schedule-day-header'; headerDiv.textContent = dayName; dayDiv.appendChild(headerDiv); const activitiesDiv = document.createElement('div'); activitiesDiv.className = 'schedule-activities'; const dayActivities = activitiesByDay[dayIndex].sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || '')); if (dayActivities.length > 0) { dayActivities.forEach(activity => { const visual = activityVisuals[activity.type?.toLowerCase()] || activityVisuals.default; const title = sanitizeHTML(activity.title || 'Nespecifikováno'); const timeSlot = activity.time_slot ? `<span>${sanitizeHTML(activity.time_slot)}</span>` : ''; const activityItem = document.createElement('div'); activityItem.className = `schedule-activity-item ${activity.completed ? 'completed' : ''}`; activityItem.innerHTML = `<i class="fas ${visual.icon} activity-icon"></i><div class="activity-details"><strong>${title}</strong>${timeSlot}</div>`; activitiesDiv.appendChild(activityItem); }); } else { activitiesDiv.innerHTML = `<p class="no-activities-placeholder">Žádné aktivity</p>`; } dayDiv.appendChild(activitiesDiv); ui.mainPlanScheduleGrid.appendChild(dayDiv); }); }
    function renderTopicAnalysis(topics) { setLoadingState('topics', false); if (!ui.topicAnalysisContainer || !ui.topicAnalysisContent || !ui.topicAnalysisEmpty || !ui.topicGrid) { return; } ui.topicAnalysisContainer.classList.remove('loading'); ui.topicGrid.innerHTML = ''; if (!topics || topics.length === 0) { ui.topicAnalysisContent.style.display = 'none'; ui.topicAnalysisEmpty.style.display = 'block'; return; } ui.topicAnalysisContent.style.display = 'block'; ui.topicAnalysisEmpty.style.display = 'none'; const fragment = document.createDocumentFragment(); topics.sort((a, b) => { const order = { 'weakness': 0, 'neutral': 1, 'strength': 2 }; return (order[a.strength] ?? 1) - (order[b.strength] ?? 1); }); topics.forEach(topic => { const topicName = topic.topic?.name || `Téma ${topic.topic_id}` || 'Neznámé téma'; const iconClass = topicIcons[topicName] || topicIcons.default || 'fa-book'; const strength = topic.strength || 'neutral'; const progress = topic.progress || 0; const attempted = topic.questions_attempted || 0; const correct = topic.questions_correct || 0; const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0; const accuracyClass = accuracy >= 75 ? 'high' : accuracy < 50 ? 'low' : 'medium'; const card = document.createElement('div'); card.className = `topic-card card ${strength}`; card.innerHTML = ` <div class="topic-header"> <div class="topic-icon"><i class="fas ${iconClass}"></i></div> <h3 class="topic-title">${sanitizeHTML(topicName)}</h3> </div> <div class="progress-container" title="Celkový pokrok v tématu: ${progress}%"> <div class="progress-bar" style="width: ${progress}%;"></div> </div> <div class="topic-stats"> <div class="topic-stat"> <span>Správnost otázek:</span> <strong class="accuracy-value ${accuracyClass}">${accuracy}%</strong> </div> <div class="topic-stat"> <span>Zodpovězeno:</span> <strong>${correct}/${attempted}</strong> </div> </div>`; fragment.appendChild(card); }); ui.topicGrid.appendChild(fragment); }
    function renderNotifications(count, notifications) { if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } }
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }

    async function markNotificationRead(notificationId) { if (!currentUser || !notificationId) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; return true; } catch (error) { console.error("[FUNC] markNotificationRead: Error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { if (!currentUser || !supabase || !ui.markAllReadBtn) return; if (isLoading.notifications) return; setLoadingState('notifications', true); try { const { error } = await supabase .from('user_notifications') .update({ is_read: true }) .eq('user_id', currentUser.id) .eq('is_read', false); if (error) throw error; const { unreadCount, notifications } = await fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('Oznámení Vymazána', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[FUNC] markAllNotificationsRead: Error:", error); showToast('Chyba', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }

    async function loadPageData() {
        if (!currentUser || !currentProfile) { showError("Chybí data profilu.", true); setLoadingState('all', false); return; }
        setLoadingState('all', true); hideError();
        try {
            const results = await Promise.allSettled([
                fetchDashboardStats(currentUser.id, currentProfile),
                fetchDiagnosticResults(currentUser.id),
                fetchActiveStudyPlan(currentUser.id),
                fetchTopicProgress(currentUser.id),
                fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT)
            ]);

            if (results[1].status === 'fulfilled') { diagnosticResultsData = results[1].value || []; }
            else { console.error("Error fetching test results:", results[1].reason); diagnosticResultsData = []; }
            renderTestResults(diagnosticResultsData);
            setLoadingState('tests', false);

            if (results[0].status === 'fulfilled') { userStatsData = results[0].value; renderStatsCards(userStatsData); }
            else { console.error("Error fetching stats:", results[0].reason); renderStatsCards(null); }
            setLoadingState('stats', false);

            if (results[2].status === 'fulfilled') {
                studyPlanData = results[2].value;
                if (studyPlanData?.id) {
                    try { planActivitiesData = await fetchPlanActivities(studyPlanData.id); renderStudyPlanOverview(studyPlanData, planActivitiesData); }
                    catch(activityError){ console.error("Error fetching plan activities:", activityError); renderStudyPlanOverview(studyPlanData, []); }
                } else { renderStudyPlanOverview(null, null); }
            } else { console.error("Error fetching study plan:", results[2].reason); renderStudyPlanOverview(null, null); }
            setLoadingState('plan', false);

            if (results[3].status === 'fulfilled') { topicProgressData = results[3].value || []; renderTopicAnalysis(topicProgressData); }
            else { console.error("Error fetching topic progress:", results[3].reason); renderTopicAnalysis(null); }
            setLoadingState('topics', false);

            if (results[4].status === 'fulfilled') { const { unreadCount, notifications } = results[4].value || { unreadCount: 0, notifications: [] }; renderNotifications(unreadCount, notifications); }
            else { console.error("Error fetching notifications:", results[4].reason); renderNotifications(0, []); }


            if (ui.diagnosticPrompt) {
                 ui.diagnosticPrompt.style.display = (diagnosticResultsData.length === 0) ? 'flex' : 'none';
                 if(diagnosticResultsData.length === 0) { requestAnimationFrame(() => initScrollAnimations()); }
            }

        } catch(error) {
            console.error("❌ [LoadPageData] Unexpected error:", error);
            showError(`Nepodařilo se načíst data stránky: ${error.message}`, true);
             renderStatsCards(null);
             renderTestResults([]);
             renderStudyPlanOverview(null, null);
             renderTopicAnalysis(null);
             renderNotifications(0, []);
        } finally {
             setLoadingState('all', false); // Corrected: Added semicolon
             initTooltips(); // Corrected: Added semicolon
        }
    }

    function setupEventListeners() {
         if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
         if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
         if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
         document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });
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
         updateOnlineStatus();
          if (ui.mainContent) ui.mainContent.addEventListener('scroll', handleScroll, { passive: true });
    }

    function handleTabSwitch(event) { const tabId = event.currentTarget.dataset.tab; ui.contentTabs.forEach(t => t.classList.remove('active')); ui.tabContents.forEach(c => c.classList.remove('active')); event.currentTarget.classList.add('active'); const activeContent = document.getElementById(tabId); if(activeContent) { activeContent.classList.add('active'); requestAnimationFrame(() => { activeContent.querySelectorAll('[data-animate]').forEach(el => el.classList.remove('animated')); initScrollAnimations(); }); } else { console.warn(`Content for tab ${tabId} not found!`); } if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' }); }
    async function handleRefreshClick() { if (Object.values(isLoading).some(s => s)) { showToast('Info','Data se již načítají.', 'info'); return; } const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if(icon) icon.classList.add('fa-spin'); if(text) text.textContent = 'RELOADING...'; ui.refreshDataBtn.disabled = true; await loadPageData(); if(icon) icon.classList.remove('fa-spin'); if(text) text.textContent = 'RELOAD'; ui.refreshDataBtn.disabled = false; initTooltips(); }
    async function handleNotificationClick(event) { const item = event.target.closest('.notification-item'); if (!item) return; const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); ui.markAllReadBtn.disabled = newCount === 0; } } if (link) { window.location.href = link; } }
    function closeNotificationDropdownOnClickOutside(event) { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } }

    async function initializeApp() {
        if (!initializeSupabase()) return;

        if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; }
        if (ui.mainContent) ui.mainContent.style.display = 'none';

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;
                currentProfile = await fetchUserProfile(currentUser.id);
                if (!currentProfile) { throw new Error("Nepodařilo se načíst profil uživatele."); }
                updateUserInfoUI();
                setupEventListeners();

                await loadPageData();

                if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }
                if (ui.mainContent) {
                    ui.mainContent.style.display = 'block';
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
                initTooltips();

            } else {
                window.location.href = '/auth/index.html';
            }
        } catch (error) {
            console.error("❌ [Init Procvičování - Kyber v21] Error:", error);
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">Chyba (${error.message}). Obnovte.</p>`; }
            else { showError(`Chyba inicializace: ${error.message}`, true); }
            if (ui.mainContent) ui.mainContent.style.display = 'block';
            setLoadingState('all', false);
        }
    }

    document.addEventListener('DOMContentLoaded', initializeApp);

})();