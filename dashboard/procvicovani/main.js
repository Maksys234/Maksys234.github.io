// dashboard/procvicovani/main.js
// Version: 24.5 - Fixed showGoalSelectionModal is not defined error, refined loading/UI logic

(function() { // Start IIFE
    'use strict';

    // --- Глобальные переменные ---
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
        stats: false, tests: false, plan: false, topics: false,
        shortcuts: false, notifications: false, goalSelection: false, all: false
    };
    let goalSelectionInProgress = false;

    // --- Кэш UI Элементов ---
    const ui = {}; // Populated by cacheDOMElements

    function cacheDOMElements() {
        console.log("[Procvičování Cache DOM] Caching elements...");
        const ids = [
            'diagnostic-prompt', 'start-test-btn-prompt', 'stats-cards', 'shortcuts-grid',
            'test-results-container', 'test-results-loading', 'test-results-content',
            'test-results-empty', 'start-test-btn-results',
            // 'testsChart', // <<< Убрано, так как его нет в main.html
            'study-plan-container', 'study-plan-loading', 'study-plan-content',
            'study-plan-empty', 'start-test-btn-plan', 'main-plan-schedule',
            'topic-analysis-container', 'topic-analysis-loading', 'topic-analysis-content',
            'topic-analysis-empty', 'start-test-btn-analysis', 'topic-grid',
            'global-error', 'toastContainer', 'main-content', 'refresh-data-btn',
            'goal-selection-modal', 'select-goal-exam', 'select-goal-accelerate',
            'select-goal-review', 'select-goal-explore',
            'initial-loader', 'sidebar-overlay', 'sidebar', 'main-mobile-menu-toggle',
            'sidebar-close-toggle', 'sidebar-toggle-btn', 'sidebar-avatar',
            'sidebar-name', 'sidebar-user-title', 'currentYearSidebar',
            //'dashboard-header', // <<< Используем класс, а не ID
            'dashboard-title', // ID заголовка страницы
            'notification-bell', 'notification-count', 'notifications-dropdown',
            'notifications-list', 'no-notifications-msg', 'mark-all-read',
            'currentYearFooter', 'mouse-follower'
        ];
        const notFound = [];
        ids.forEach(id => {
            const element = document.getElementById(id);
            const key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
            if (element) { ui[key] = element; }
            else { notFound.push(id); ui[key] = null; }
        });

        // Кэширование вкладок и панелей контента
        ui.contentTabs = document.querySelectorAll('.content-tab');
        ui.practiceTabContent = document.getElementById('practice-tab');
        ui.testResultsTabContent = document.getElementById('test-results-tab');
        ui.studyPlanTabContent = document.getElementById('study-plan-tab');
        ui.topicAnalysisTabContent = document.getElementById('topic-analysis-tab');
        ui.dashboardHeader = document.querySelector('.dashboard-header'); // <<< Ищем по классу

        const criticalMissing = ['practiceTabContent', 'goalSelectionModal']
                                .filter(key => !ui[key]);
        if (criticalMissing.length > 0) {
            console.error("[CACHE DOM] CRITICAL elements missing:", criticalMissing);
        }
        if (notFound.length > 0) { console.log(`[Procvičování Cache DOM] Elements potentially missing: (${notFound.length}) ['${notFound.join("', '")}']`); }
        console.log("[Procvičování Cache DOM] Caching complete.");
    }

    // --- Карты иконок и визуалов ---
    const topicIcons = { "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon", "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar", "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar", "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book" };
    const activityVisuals = { test: { name: 'Test', icon: 'fa-vial', class: 'test' }, exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' }, badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' }, diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' }, plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' }, other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' }, default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' } };

    // --- Вспомогательные функции (Fallback/Definitions) ---
    // (Оставляем как в предыдущей версии)
    const showToast = window.showToast || function(t, m, ty) { console.log(`[Toast Fallback] ${ty}: ${t} - ${m}`); };
    const showError = window.showError || function(m, g) { console.error(`[Error Fallback] Global=${g}: ${m}`); const ge = ui.globalError; if (g && ge) { ge.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(m)}</div><button class="retry-button btn" onclick="location.reload()">Obnovit</button></div>`; ge.style.display = 'block'; } else { showToast("CHYBA", m, 'error'); } };
    const hideError = window.hideError || function() { if (ui.globalError) ui.globalError.style.display = 'none'; };
    const sanitizeHTML = window.sanitizeHTML || function(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
    const formatDate = window.formatDate || function(d) { try { return d ? new Date(d).toLocaleDateString('cs-CZ') : '-'; } catch (e) { return '-'; } };
    const formatTime = window.formatTime || function(s) { if (isNaN(s) || s < 0) return '--:--'; const m = Math.floor(s / 60); const ss = Math.round(s % 60); return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`; };
    const formatRelativeTime = window.formatRelativeTime || function(t) { try { return t ? new Date(t).toLocaleString('cs-CZ') : '-'; } catch (e) { return '-'; } };
    const initTooltips = window.initTooltips || function() { /* Placeholder */ };
    const initScrollAnimations = window.initScrollAnimations || function() { /* Placeholder */ };
    const initHeaderScrollDetection = window.initHeaderScrollDetection || function() { /* Placeholder */ };
    const updateOnlineStatus = window.updateOnlineStatus || function() { /* Placeholder */ };
    const openMenu = window.openMenu || function() { console.warn("openMenu function not found."); };
    const closeMenu = window.closeMenu || function() { console.warn("closeMenu function not found."); };
    const renderNotificationSkeletons = window.renderNotificationSkeletons || function(c) { /* Placeholder */ };
    const renderNotifications = window.renderNotifications || function(c, n) { /* Placeholder */ };
    const markNotificationRead = window.markNotificationRead || async function(id) { return false; };
    const markAllNotificationsRead = window.markAllNotificationsRead || async function() { /* Placeholder */ };
    const updateCopyrightYear = window.updateCopyrightYear || function(){ /* Placeholder */ };
    const initMouseFollower = window.initMouseFollower || function(){ /* Placeholder */ };
    const getInitials = window.getInitials || function(p){if(!p) return'?';const f=p.first_name?.[0]||'';const l=p.last_name?.[0]||'';return(f+l).toUpperCase()||p.username?.[0].toUpperCase()||p.email?.[0].toUpperCase()||'?';};
    const updateSidebarProfile = window.updateSidebarProfile || function(p, t){console.warn("updateSidebarProfile function not found.");};
    const applyInitialSidebarState = window.applyInitialSidebarState || function(){console.warn("applyInitialSidebarState function not found.");};
    const toggleSidebar = window.toggleSidebar || function(){console.warn("toggleSidebar function not found.");};

    // --- Управление состоянием загрузки (Refined) ---
    function setLoadingState(sectionKey, isLoadingFlag) {
        if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;

        const updateSingleSection = (key, loading) => {
            if (isLoading[key] === loading && key !== 'all') return;
            isLoading[key] = loading;
            console.log(`[Procvičování UI Loading] Section: ${key}, isLoading: ${loading}`);

            const sectionMap = {
                stats: { container: ui.statsCards, skeletonFn: renderStatsSkeletons },
                tests: { container: ui.testResultsContainer, content: ui.testResultsContent, empty: ui.testResultsEmpty, loader: ui.testResultsLoading, skeletonFn: renderTestSkeletons },
                plan: { container: ui.studyPlanContainer, content: ui.studyPlanContent, empty: ui.studyPlanEmpty, loader: ui.studyPlanLoading, skeletonFn: renderPlanSkeletons },
                topics: { container: ui.topicAnalysisContainer, content: ui.topicAnalysisContent, empty: ui.topicAnalysisEmpty, loader: ui.topicAnalysisLoading, skeletonFn: renderTopicSkeletons },
                shortcuts: { container: ui.shortcutsGrid, skeletonFn: renderShortcutSkeletons },
                notifications: { container: ui.notificationsList, empty: ui.noNotificationsMsg, loader: null, skeletonFn: renderNotificationSkeletons },
                goalSelection: { /* Handled by button states */ }
            };

            const config = sectionMap[key];
            if (!config) { if (key !== 'all') { console.warn(`[Procvičování UI Loading] Unknown section key '${key}'.`); } return; }

            const container = config.container;
            const content = config.content;
            const empty = config.empty;
            const loader = config.loader;
            const skeletonFn = config.skeletonFn;

            if (loader) loader.style.display = loading ? 'flex' : 'none';
            if (container) container.classList.toggle('loading', loading);

            if (loading) {
                if (content) content.style.display = 'none';
                if (empty) empty.style.display = 'none';
                if (skeletonFn) {
                    const targetContainer = (key === 'stats' || key === 'shortcuts') ? container : content;
                    if (targetContainer) skeletonFn(targetContainer);
                }
            } else {
                 // Remove skeletons if they weren't replaced by content
                 const skeletonSelector = '.loading-skeleton'; // Common selector
                 if (content?.querySelector(skeletonSelector)) content.innerHTML = '';
                 if (container?.querySelector(skeletonSelector) && key !== 'stats' && key !== 'shortcuts') container.innerHTML = ''; // Clear container skeletons

                 // Render functions handle showing content/empty state
                 if (content && empty) {
                     const hasContent = content.innerHTML.trim() !== ''; // Basic check
                     content.style.display = hasContent ? (key === 'shortcuts' || key === 'stats' ? 'grid' : 'block') : 'none';
                     empty.style.display = hasContent ? 'none' : 'block';
                 }
            }

            // Handle notifications bell/button state
            if (key === 'notifications' && ui.notificationBell) {
                ui.notificationBell.style.opacity = loading ? 0.5 : 1;
                if (ui.markAllReadBtn) {
                    const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                    ui.markAllReadBtn.disabled = loading || currentUnreadCount === 0;
                }
            }
        };

        if (sectionKey === 'all') {
            Object.keys(isLoading).forEach(key => {
                if (key !== 'all' && key !== 'goalSelection') {
                    updateSingleSection(key, isLoadingFlag);
                }
            });
        } else {
            updateSingleSection(sectionKey, isLoadingFlag);
        }
    }

    // --- Рендеринг Скелетонов ---
    function renderStatsSkeletons(container) { if (!container) return; container.innerHTML = ''; for (let i = 0; i < 4; i++) { container.innerHTML += ` <div class="dashboard-card card loading"> <div class="loading-skeleton"> <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 1rem;"></div> <div class="skeleton" style="height: 35px; width: 40%; margin-bottom: 0.8rem;"></div> <div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 1.5rem;"></div> <div class="skeleton" style="height: 14px; width: 50%;"></div> </div> </div>`; } container.classList.add('loading'); }
    function renderTestSkeletons(container) { if (!container) return; container.innerHTML = `<div class="test-stats loading"><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton value"></div><div class="skeleton text"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton value"></div><div class="skeleton text"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton value"></div><div class="skeleton text"></div></div></div></div></div><div class="chart-container loading"><div class="skeleton" style="height: 350px; width: 100%;"></div></div><div class="last-test-result card loading"><div class="loading-skeleton"><div class="skeleton title"></div><div class="skeleton text"></div></div></div><div class="test-list loading"><div class="skeleton" style="height: 70px; width: 100%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 70px; width: 100%;"></div></div>`; }
    function renderPlanSkeletons(container) { const scheduleGrid = ui.mainPlanSchedule; if (!container || !scheduleGrid) return; scheduleGrid.innerHTML = `<div class="schedule-grid loading"><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 40%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 50%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 45%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div></div>`; }
    function renderTopicSkeletons(container) { const topicGrid = ui.topicGrid; if (!container || !topicGrid) return; topicGrid.innerHTML = `<div class="topic-grid loading"><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div></div>`; }
    function renderShortcutSkeletons(container) { if (!container) return; container.innerHTML = ''; for(let i = 0; i < 3; i++) { container.innerHTML += `<div class="shortcut-card card loading"><div class="loading-skeleton" style="align-items: center; padding: 1.8rem;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 16px; margin-bottom: 1.2rem;"></div><div class="skeleton" style="height: 18px; width: 70%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.4rem;"></div><div class="skeleton" style="height: 14px; width: 80%;"></div></div></div>`; } container.classList.add('loading'); }
    // --- Конец Рендеринга Скелетонов ---

    // --- Загрузка Данных ---
    async function fetchDashboardStats(userId, profileData) { /* ... no change ... */
         if (!supabase || !userId || !profileData) { console.error("[Stats Fetch] Missing supabase, userId, or profileData."); return null; }
         console.log(`[Stats Fetch] Fetching stats for user ${userId}...`);
         let fetchedStats = null; let statsError = null;
         try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests, total_study_seconds, weakest_topic_name').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats Fetch] Supabase error fetching user_stats:", statsError.message); } } catch (error) { console.error("[Stats Fetch] Exception fetching user_stats:", error); statsError = error; }
         const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0, total_study_seconds: fetchedStats?.total_study_seconds ?? 0, weakest_topic_name: fetchedStats?.weakest_topic_name ?? null, };
         if (statsError && fetchedStats === null) { console.warn("[Stats Fetch] Returning stats based primarily on profile due to fetch error."); } else { console.log("[Stats Fetch] Dashboard stats fetched/compiled:", finalStats); }
         return finalStats;
     }
    async function fetchDiagnosticResults(userId, goal) { /* ... keep filtering logic if needed ... */
         if (!supabase || !userId) return []; console.log(`[Tests Fetch] Fetching diagnostic results for user ${userId}, goal: ${goal}...`);
         try { const { data, error } = await supabase.from('user_diagnostics').select('id, completed_at, total_score, total_questions, time_spent').eq('user_id', userId).order('completed_at', { ascending: false }); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching diagnostic results:", err); return []; }
     }
    async function fetchActiveStudyPlan(userId, goal) { /* ... keep filtering logic if needed ... */
         if (!supabase || !userId) return null; console.log(`[Plan Fetch] Fetching active study plan for user ${userId}, goal: ${goal}...`);
         try { let query = supabase.from('study_plans').select('id, title, created_at').eq('user_id', userId).eq('status', 'active'); query = query.order('created_at', { ascending: false }).limit(1); const { data: plans, error } = await query; if (error) throw error; return plans?.[0] || null; } catch (err) { console.error("Error fetching active study plan:", err); return null; }
     }
    async function fetchPlanActivities(planId, goal) { /* ... keep filtering logic if needed ... */
        if (!planId || !supabase) return []; console.log(`[Plan Activities Fetch] Fetching activities for plan ${planId}, goal: ${goal}...`);
        try { let query = supabase.from('plan_activities').select('id, title, day_of_week, time_slot, completed, description, type').eq('plan_id', planId); query = query.order('day_of_week').order('time_slot'); const { data, error } = await query; if (error) throw error; return data || []; } catch (err) { console.error("Error fetching plan activities:", err); return []; }
    }
    async function fetchTopicProgress(userId, goal) { /* ... keep filtering logic ... */
        if (!supabase || !userId) return []; console.log(`[Topics Fetch] Fetching topic progress for user ${userId}, goal: ${goal}...`);
        try {
            let query = supabase.from('user_topic_progress').select(` topic_id, progress, strength, questions_attempted, questions_correct, topic:exam_topics!inner( name, subject, is_exam_topic ) `).eq('user_id', userId);
            if (goal === 'exam_prep') { query = query.eq('topic.is_exam_topic', true); console.log("[Topics Fetch] Filtering for exam topics."); }
            else if (goal === 'math_accelerate' || goal === 'math_review') { query = query.eq('topic.is_exam_topic', false); console.log("[Topics Fetch] Filtering for non-exam (math learning) topics."); }
            else { console.log("[Topics Fetch] Fetching all topics (explore or default)."); }
            const { data, error } = await query; if (error) throw error; console.log(`[Topics Fetch] Fetched ${data?.length} topics for goal ${goal}.`); return data || [];
        } catch (err) { console.error("Error fetching topic progress:", err); if (err.message?.includes('column exam_topics.is_exam_topic does not exist')) { console.warn("Column 'is_exam_topic' not found. Fetching all topics."); try { const { data: allData, error: allError } = await supabase.from('user_topic_progress').select(` topic_id, progress, strength, questions_attempted, questions_correct, topic:exam_topics!inner( name, subject ) `).eq('user_id', userId); if (allError) throw allError; return allData || []; } catch (fallbackErr) { console.error("Error fetching all topics after fallback:", fallbackErr); return []; } } return []; }
    }
    // --- Конец Загрузки Данных ---

    // --- Рендеринг UI (Адаптация) ---
    function renderStatsCards(stats) {
         const container = ui.statsCards;
         if (!container) { console.warn("[Render Stats] Container #stats-cards not found."); return; }
         console.log("[Render Stats] Rendering stats cards with data:", stats);
         container.innerHTML = ''; // Clear skeletons
         if (!stats) { container.innerHTML = '<p class="error-message-inline">Statistiky nelze načíst.</p>'; container.classList.remove('loading'); return; }
         const completedTotal = (stats.completed_exercises || 0) + (stats.completed_tests || 0);
         container.innerHTML = `
             <div class="dashboard-card card" data-animate style="--animation-order: 2;"> <div class="card-header"> <h3 class="card-title">Dokončeno</h3> </div> <div class="card-content"> <div class="card-value">${completedTotal}</div> <p class="card-description">Celkový počet úkolů</p> </div> <div class="card-footer"><i class="fas fa-check"></i> Cvičení: ${stats.completed_exercises || 0}, Testů: ${stats.completed_tests || 0}</div> </div>
             <div class="dashboard-card card" data-animate style="--animation-order: 3;"> <div class="card-header"> <h3 class="card-title">Průměrné Skóre</h3> </div> <div class="card-content"> <div class="card-value">${calculateAverageScore(diagnosticResultsData)}%</div> <p class="card-description">V diagnostických testech</p> </div> <div class="card-footer"><i class="fas fa-poll"></i> V ${diagnosticResultsData.length} testech</div> </div>
             <div class="dashboard-card card" data-animate style="--animation-order: 4;"> <div class="card-header"> <h3 class="card-title">Čas Cvičení</h3> </div> <div class="card-content"> <div class="card-value">${formatTime(stats.total_study_seconds ?? 0)}</div> <p class="card-description">Celkem stráveno učením</p> </div> <div class="card-footer"><i class="fas fa-hourglass-half"></i> Za celou dobu</div> </div>
             <div class="dashboard-card card" data-animate style="--animation-order: 5;"> <div class="card-header"> <h3 class="card-title">Nejslabší Téma</h3> </div> <div class="card-content"> <div class="card-value" style="font-size: 1.8rem;">${sanitizeHTML(stats.weakest_topic_name || '-')}</div> <p class="card-description">Oblast s nejnižší úspěšností</p> </div> <div class="card-footer"><i class="fas fa-atom"></i> Poslední analýza</div> </div>
             `;
         container.classList.remove('loading');
         initScrollAnimations();
     }
    function calculateAverageScore(results) { if (!results || results.length === 0) return '-'; const validScores = results.filter(r => typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0); if (validScores.length === 0) return '-'; const avgPercentage = validScores.reduce((sum, r) => sum + (r.total_score / r.total_questions) * 100, 0) / validScores.length; return Math.round(avgPercentage); }
    function renderTestChart(chartData) { /* ... keep existing ... */ }
    function renderTestResults(results, goal) { /* ... keep existing, ensure title adapts ... */
         console.log(`[Tests Render] Rendering test results for goal: ${goal}`);
         const container = ui.testResultsContainer; const contentEl = ui.testResultsContent; const emptyEl = ui.testResultsEmpty; const startBtn = ui.startTestBtnResults;
         if (!contentEl || !emptyEl || !startBtn || !container) { console.warn("Missing elements for renderTestResults"); setLoadingState('tests', false); return; }
         const titleElement = container.querySelector('.section-title'); if (titleElement) { titleElement.innerHTML = '<i class="fas fa-poll"></i>Výsledky Diagnostiky'; } // Keep generic?
         contentEl.innerHTML = ''; contentEl.style.display = 'none'; emptyEl.style.display = 'none'; startBtn.style.display = 'inline-flex';
         if (!results || results.length === 0) { emptyEl.style.display = 'block'; } else { contentEl.style.display = 'block'; /* ... rest of rendering logic ... */ }
         setLoadingState('tests', false); initScrollAnimations();
    }
    function renderStudyPlanOverview(plan, activities, goal) { /* ... keep existing, ensure title adapts ... */
         console.log(`[Plan Render] Rendering plan overview for goal: ${goal}`);
         const container = ui.studyPlanContainer; const contentEl = ui.studyPlanContent; const emptyEl = ui.studyPlanEmpty; const startBtn = ui.startTestBtnPlan; const scheduleGrid = ui.mainPlanSchedule;
         if (!contentEl || !emptyEl || !startBtn || !container || !scheduleGrid) { console.warn("Missing elements for renderStudyPlanOverview"); setLoadingState('plan', false); return; }
         const titleElement = container.querySelector('.section-title'); if (titleElement) { titleElement.innerHTML = '<i class="fas fa-route"></i>Aktuální Studijní Plán'; } // Keep generic?
         scheduleGrid.innerHTML = ''; contentEl.style.display = 'none'; emptyEl.style.display = 'none';
         if (!plan) { emptyEl.style.display = 'block'; startBtn.style.display = 'inline-flex'; } else { contentEl.style.display = 'block'; startBtn.style.display = 'none'; /* ... rest of rendering logic ... */ }
         setLoadingState('plan', false); initScrollAnimations();
    }
    function renderTopicAnalysis(topics, goal) { /* ... keep existing, ensure title adapts ... */
         console.log(`[Topics Render] Rendering topic analysis for goal: ${goal}`);
          const container = ui.topicAnalysisContainer; const contentEl = ui.topicAnalysisContent; const emptyEl = ui.topicAnalysisEmpty; const topicGrid = ui.topicGrid; const startBtn = ui.startTestBtnAnalysis;
         if (!contentEl || !emptyEl || !topicGrid || !startBtn || !container) { console.warn("Missing elements for renderTopicAnalysis"); setLoadingState('topics', false); return; }
          const titleElement = container.querySelector('.section-title'); if (titleElement) { titleElement.innerHTML = '<i class="fas fa-atom"></i>Analýza podle Témat'; } // Keep generic?
         topicGrid.innerHTML = ''; contentEl.style.display = 'none'; emptyEl.style.display = 'none';
         if (!topics || topics.length === 0) { emptyEl.style.display = 'block'; startBtn.style.display = 'inline-flex'; } else { contentEl.style.display = 'block'; startBtn.style.display = 'none'; /* ... rest of rendering logic ... */ }
         setLoadingState('topics', false); initScrollAnimations();
     }
    // --- Конец Рендеринга UI ---

    // --- Функции Выбора Цели (Перемещены сюда) ---
    /**
     * Показывает модальное окно выбора цели и добавляет обработчики.
     */
     function showGoalSelectionModal() {
         const modal = ui.goalSelectionModal;
         if (!modal) { console.error("Modal #goal-selection-modal not found!"); showError("Chyba: Nelze zobrazit výběr cíle.", true); return; }
         console.log("Showing goal selection modal...");
         modal.style.display = 'flex'; requestAnimationFrame(() => modal.classList.add('active'));
         const examBtn = ui.selectGoalExam; const accelerateBtn = ui.selectGoalAccelerate; const reviewBtn = ui.selectGoalReview; const exploreBtn = ui.selectGoalExplore;
         const addClickListener = (button, goal) => { if (button) { const handler = () => handleGoalSelection(goal); button.removeEventListener('click', handler); button.addEventListener('click', handler, { once: true }); } else { console.warn(`Goal button for ${goal} not found`); } };
         addClickListener(examBtn, 'exam_prep'); addClickListener(accelerateBtn, 'math_accelerate'); addClickListener(reviewBtn, 'math_review'); addClickListener(exploreBtn, 'math_explore');
         console.log("Goal selection button listeners attached.");
     }

     /**
      * Обрабатывает выбор цели, сохраняет в БД и запускает загрузку данных.
      */
     async function handleGoalSelection(selectedGoal) {
         const modal = ui.goalSelectionModal;
         if (goalSelectionInProgress || !modal) return;
         goalSelectionInProgress = true; setLoadingState('goalSelection', true);
         console.log(`Goal selected: ${selectedGoal}`);
         const buttons = modal.querySelectorAll('.goal-option-card'); buttons.forEach(btn => btn.disabled = true);
         showToast('Ukládání...', `Nastavuji cíl...`, 'info', 2500);
         try { if (!supabase || !currentUser) throw new Error("Supabase client or user not available."); const { data, error } = await supabase.from('profiles').update({ learning_goal: selectedGoal, updated_at: new Date().toISOString() }).eq('id', currentUser.id).select('learning_goal').single(); if (error) throw error; if (data && data.learning_goal === selectedGoal) { currentProfile.learning_goal = selectedGoal; console.log("Learning goal saved successfully:", selectedGoal); let goalText = selectedGoal; if (selectedGoal === 'exam_prep') goalText = 'Příprava na zkoušky'; else if (selectedGoal === 'math_accelerate') goalText = 'Učení napřed'; else if (selectedGoal === 'math_review') goalText = 'Doplnění mezer'; else if (selectedGoal === 'math_explore') goalText = 'Volné prozkoumávání'; showToast('Cíl uložen!', `Váš cíl byl nastaven na: ${goalText}.`, 'success'); modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); configureUIForGoal(selectedGoal); await loadPageData(); if (ui.mainContent) ui.mainContent.classList.remove('interaction-disabled'); } else { throw new Error("Database update did not confirm the change."); } } catch (error) { console.error("Error saving learning goal:", error); showToast('Chyba', 'Nepodařilo se uložit váš cíl.', 'error'); buttons.forEach(btn => btn.disabled = false); } finally { goalSelectionInProgress = false; setLoadingState('goalSelection', false); }
     }

     /**
      * Настраивает интерфейс в зависимости от выбранной цели.
      */
     function configureUIForGoal(goal) {
         console.log(`Configuring UI for goal: ${goal}`);
         const isExamPrep = goal === 'exam_prep';
         if (ui.shortcutsGrid) { renderShortcutsForGoal(goal, ui.shortcutsGrid); }
         const testTabButton = document.querySelector('.content-tab[data-tab="test-results-tab"]');
         const planTabButton = document.querySelector('.content-tab[data-tab="study-plan-tab"]');
         const topicAnalysisButton = document.querySelector('.content-tab[data-tab="topic-analysis-tab"]');
         const practiceTabButton = document.querySelector('.content-tab[data-tab="practice-tab"]');

         if (testTabButton) testTabButton.style.display = isExamPrep ? 'flex' : 'none';
         if (planTabButton) planTabButton.style.display = (isExamPrep || goal === 'math_accelerate') ? 'flex' : 'none';
         if (topicAnalysisButton) topicAnalysisButton.style.display = 'flex';
         if (practiceTabButton) practiceTabButton.style.display = 'flex';

         const activeTab = document.querySelector('.content-tab.active');
         if (activeTab && window.getComputedStyle(activeTab).display === 'none') {
             const firstVisibleTab = document.querySelector('.content-tab:not([style*="display: none"])');
             if (firstVisibleTab) { handleTabSwitch({ currentTarget: firstVisibleTab }); }
             else if (practiceTabButton) { handleTabSwitch({ currentTarget: practiceTabButton }); }
         }
         console.log(`UI configured for goal: ${goal}`);
     }
    // --- Конец Функций Выбора Цели ---

    // --- Рендеринг Ярлыков ---
    function renderShortcutsForGoal(goal, container) {
         if (!container) return; setLoadingState('shortcuts', true); container.innerHTML = ''; console.log(`Rendering shortcuts for goal: ${goal}`); let shortcutsHTML = '';
         if (goal === 'exam_prep') { shortcutsHTML = ` <div class="shortcut-card card" data-animate style="--animation-order: 7;"> <div class="shortcut-icon"><i class="fas fa-graduation-cap"></i></div> <h3 class="shortcut-title">Diagnostický Test</h3> <p class="shortcut-desc">Ověřte své znalosti pro přijímačky.</p> <a href="/dashboard/procvicovani/test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Test</a> </div> <div class="shortcut-card card" data-animate style="--animation-order: 8;"> <div class="shortcut-icon"><i class="fas fa-tasks"></i></div> <h3 class="shortcut-title">Studijní Plán</h3> <p class="shortcut-desc">Zobrazte si svůj personalizovaný plán přípravy.</p> <a href="/dashboard/procvicovani/plan.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Zobrazit Plán</a> </div> <div class="shortcut-card card" data-animate style="--animation-order: 9;"> <div class="shortcut-icon"><i class="fas fa-book-open"></i></div> <h3 class="shortcut-title">AI Tutor (Lekce)</h3> <p class="shortcut-desc">Nechte si vysvětlit témata z vašeho plánu.</p> <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a> </div> `; }
         else if (goal === 'math_accelerate') { shortcutsHTML = ` <div class="shortcut-card card" data-animate style="--animation-order: 7;"> <div class="shortcut-icon"><i class="fas fa-forward"></i></div> <h3 class="shortcut-title">Další Téma Osnovy</h3> <p class="shortcut-desc">Pokračujte v učení podle standardní osnovy.</p> <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Učit se Další</a> </div> <div class="shortcut-card card" data-animate style="--animation-order: 8;"> <div class="shortcut-icon"><i class="fas fa-chalkboard-teacher"></i></div> <h3 class="shortcut-title">AI Vysvětlení</h3> <p class="shortcut-desc">Nechte si od AI vysvětlit jakýkoli matematický koncept.</p> <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a> </div> <div class="shortcut-card card" data-animate style="--animation-order: 9;"> <div class="shortcut-icon"><i class="fas fa-stream"></i></div> <h3 class="shortcut-title">Přehled Osnovy</h3> <p class="shortcut-desc">Zobrazte si přehled témat dle školní osnovy.</p> <a href="/dashboard/procvicovani/plan.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Osnovu</a> </div> `; }
         else if (goal === 'math_review') { shortcutsHTML = ` <div class="shortcut-card card" data-animate style="--animation-order: 7;"> <div class="shortcut-icon"><i class="fas fa-search"></i></div> <h3 class="shortcut-title">Moje Slabiny</h3> <p class="shortcut-desc">Zobrazte témata, kde potřebujete nejvíce zlepšení.</p> <a href="#topic-analysis-tab" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="document.querySelector('.content-tab[data-tab=topic-analysis-tab]').click()">Analýza Témat</a> </div> <div class="shortcut-card card" data-animate style="--animation-order: 8;"> <div class="shortcut-icon"><i class="fas fa-history"></i></div> <h3 class="shortcut-title">Opakování</h3> <p class="shortcut-desc">Procvičte si témata, která jste dlouho neprobírali.</p> <a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="alert('Funkce opakování zatím není implementována.'); return false;">Spustit Opakování</a> </div> <div class="shortcut-card card" data-animate style="--animation-order: 9;"> <div class="shortcut-icon"><i class="fas fa-book-open"></i></div> <h3 class="shortcut-title">AI Tutor (Vysvětlení)</h3> <p class="shortcut-desc">Nechte si znovu vysvětlit problematické koncepty.</p> <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a> </div> `; }
         else { /* math_explore or fallback */ shortcutsHTML = ` <div class="shortcut-card card" data-animate style="--animation-order: 7;"> <div class="shortcut-icon"><i class="fas fa-compass"></i></div> <h3 class="shortcut-title">Procházet Témata</h3> <p class="shortcut-desc">Vyberte si libovolné matematické téma k učení.</p> <a href="#topic-analysis-tab" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="document.querySelector('.content-tab[data-tab=topic-analysis-tab]').click()">Vybrat Téma</a> </div> <div class="shortcut-card card" data-animate style="--animation-order: 8;"> <div class="shortcut-icon"><i class="fas fa-chalkboard-teacher"></i></div> <h3 class="shortcut-title">AI Vysvětlení</h3> <p class="shortcut-desc">Nechte si od AI vysvětlit jakýkoli matematický koncept.</p> <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a> </div> <div class="shortcut-card card" data-animate style="--animation-order: 9;"> <div class="shortcut-icon"><i class="fas fa-dumbbell"></i></div> <h3 class="shortcut-title">Náhodné Cvičení</h3> <p class="shortcut-desc">Spusťte náhodné cvičení pro rychlé procvičení.</p> <a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="alert('Funkce náhodného cvičení zatím není implementována.'); return false;">Náhodné Cvičení</a> </div> `; }
         container.innerHTML = shortcutsHTML; container.classList.remove('loading'); setLoadingState('shortcuts', false); initScrollAnimations();
     }
     // Fallback if needed
     if (typeof window.renderShortcuts === 'undefined') { window.renderShortcuts = function() { console.warn("Using fallback renderShortcuts in main.js"); if(ui.shortcutsGrid) renderShortcutsForGoal(currentProfile?.learning_goal || 'exam_prep', ui.shortcutsGrid); } }
    // --- Конец Рендеринга Ярлыков ---

    // --- Загрузка Основных Данных Страницы (Адаптированная) ---
    async function loadPageData() {
        const goal = currentProfile?.learning_goal;
        if (!goal) { console.warn("[Load Page Data] Cíl není nastaven. Zobrazuji modální okno."); showGoalSelectionModal(); setLoadingState('all', false); /* Скрыть основной контент */ if(ui.practiceTabContent) ui.practiceTabContent.style.display = 'none'; if(ui.testResultsTabContent) ui.testResultsTabContent.style.display = 'none'; if(ui.studyPlanTabContent) ui.studyPlanTabContent.style.display = 'none'; if(ui.topicAnalysisTabContent) ui.topicAnalysisTabContent.style.display = 'none'; return; }
        if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none';
        // Показать контейнеры вкладок (их видимость будет управляться configureUIForGoal)
        if (ui.practiceTabContent) ui.practiceTabContent.style.display = 'block';
        if (ui.testResultsTabContent) ui.testResultsTabContent.style.display = 'block';
        if (ui.studyPlanTabContent) ui.studyPlanTabContent.style.display = 'block';
        if (ui.topicAnalysisTabContent) ui.topicAnalysisTabContent.style.display = 'block';


        if (!currentUser || !currentProfile || !supabase) { showError("Chyba: Nelze načíst data.", true); setLoadingState('all', false); return; }
        console.log(`🔄 [Load Page Data] Loading data for goal: ${goal}...`);
        setLoadingState('all', true); hideError();

        // Рендеринг скелетонов
        if(ui.statsCards) renderStatsSkeletons(ui.statsCards);
        configureUIForGoal(goal); // Рендерим правильные ярлыки СРАЗУ
        // Рендерим скелетоны для видимых вкладок
        if(ui.testResultsContainer?.style.display !== 'none' && ui.testResultsContent) renderTestSkeletons(ui.testResultsContent);
        if(ui.studyPlanContainer?.style.display !== 'none' && ui.studyPlanContent) renderPlanSkeletons(ui.studyPlanContent);
        if(ui.topicAnalysisContainer?.style.display !== 'none' && ui.topicAnalysisContent) renderTopicSkeletons(ui.topicAnalysisContent);

        try {
            const stats = await fetchDashboardStats(currentUser.id, currentProfile);
            userStatsData = stats;
            renderStatsCards(userStatsData); // Статистика отображается всегда

            // --- Загрузка и рендеринг данных в зависимости от цели ---
            const promisesToAwait = [];

            // Результаты тестов (только для exam_prep)
            if (goal === 'exam_prep' && ui.testResultsContainer?.style.display !== 'none') {
                promisesToAwait.push(fetchDiagnosticResults(currentUser.id, goal).then(results => {
                    diagnosticResultsData = results || [];
                    renderTestResults(diagnosticResultsData, goal);
                }));
            } else {
                 setLoadingState('tests', false); // Убрать скелетон, если не загружаем
                 if(ui.testResultsContent) ui.testResultsContent.innerHTML = ''; // Очистить контент
            }

            // Учебный план (для exam_prep и math_accelerate)
            if ((goal === 'exam_prep' || goal === 'math_accelerate') && ui.studyPlanContainer?.style.display !== 'none') {
                 promisesToAwait.push(fetchActiveStudyPlan(currentUser.id, goal).then(async (plan) => {
                     studyPlanData = plan || null;
                     if (studyPlanData) {
                         planActivitiesData = await fetchPlanActivities(studyPlanData.id, goal);
                     } else {
                         planActivitiesData = [];
                     }
                     renderStudyPlanOverview(studyPlanData, planActivitiesData, goal);
                 }));
             } else {
                  setLoadingState('plan', false);
                  if(ui.studyPlanContent) ui.studyPlanContent.innerHTML = '';
             }

            // Анализ тем (для всех)
            if (ui.topicAnalysisContainer?.style.display !== 'none') {
                promisesToAwait.push(fetchTopicProgress(currentUser.id, goal).then(topics => {
                    topicProgressData = topics || [];
                    renderTopicAnalysis(topicProgressData, goal);
                }));
            } else {
                 setLoadingState('topics', false);
                 if(ui.topicAnalysisContent) ui.topicAnalysisContent.innerHTML = '';
            }

            await Promise.allSettled(promisesToAwait); // Ждем завершения всех релевантных загрузок

            // Показ сообщения о диагностике (только если цель - экзамены)
            if (goal === 'exam_prep') {
                if (diagnosticResultsData.length === 0 && ui.diagnosticPrompt) {
                    ui.diagnosticPrompt.style.display = 'flex';
                    if(ui.testResultsEmpty) ui.testResultsEmpty.style.display = 'none'; // Скрыть пустое состояние, если показываем промпт
                    if(ui.studyPlanEmpty) ui.studyPlanEmpty.style.display = 'none';
                    if(ui.topicAnalysisEmpty) ui.topicAnalysisEmpty.style.display = 'none';
                } else if (ui.diagnosticPrompt) {
                    ui.diagnosticPrompt.style.display = 'none';
                }
            } else if (ui.diagnosticPrompt) {
                 ui.diagnosticPrompt.style.display = 'none'; // Скрыть для других целей
            }


            console.log("✅ [Load Page Data] All relevant data loaded and rendered for goal:", goal);

        } catch (error) {
            console.error("❌ [Load Page Data] Error loading page data:", error);
            showError(`Nepodařilo se načíst data: ${error.message}`, true);
            // Render empty/error states for relevant sections
            renderStatsCards(null);
            if(ui.testResultsContainer?.style.display !== 'none') renderTestResults([], goal);
            if(ui.studyPlanContainer?.style.display !== 'none') renderStudyPlanOverview(null, [], goal);
            if(ui.topicAnalysisContainer?.style.display !== 'none') renderTopicAnalysis([], goal);
        } finally {
            setLoadingState('all', false); // Stop all loading indicators
            initTooltips();
        }
    }

    // --- Event Handlers ---
    function handleTabSwitch(event) { /* ... no change needed ... */
         const tabButton = event.currentTarget; const tabId = tabButton?.dataset?.tab; if (!tabId || !ui.contentTabs) return; console.log(`[UI TabSwitch] Switching to tab: ${tabId}`); ui.contentTabs.forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); tabButton.classList.add('active'); const activeContent = document.getElementById(tabId); if (activeContent) { activeContent.classList.add('active'); requestAnimationFrame(() => { activeContent.querySelectorAll('[data-animate]').forEach(el => el.classList.remove('animated')); initScrollAnimations(); }); } else { console.warn(`[UI TabSwitch] Content for tab ${tabId} not found!`); const firstContent = document.querySelector('.tab-content'); if (firstContent) firstContent.classList.add('active'); } if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' });
     }
    async function handleRefreshClick() { /* ... no change needed ... */
        if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(s => s === true)) { showToast('Info','Data se již načítají.', 'info'); return; } const refreshBtn = ui.refreshDataBtn; const icon = refreshBtn?.querySelector('i'); const text = refreshBtn?.querySelector('.refresh-text'); if(refreshBtn) refreshBtn.disabled = true; if(icon) icon.classList.add('fa-spin'); if(text) text.textContent = 'RELOADING...'; await loadPageData(); if(refreshBtn) refreshBtn.disabled = false; if(icon) icon.classList.remove('fa-spin'); if(text) text.textContent = 'RELOAD'; initTooltips();
    }

    // --- Настройка Event Listeners ---
    function setupEventListeners() {
        console.log("[Procvičování SETUP] Setting up event listeners...");
        // cacheDOMElements(); // Called in initializeApp already

        const safeAddListener = (element, eventType, handler, key) => { if (element) { element.addEventListener(eventType, handler); } else { console.warn(`[SETUP] Element not found for listener: ${key}`); } };
        const safeAddListenerToAll = (elementsNodeList, eventType, handler, key) => { if (elementsNodeList && elementsNodeList.length > 0) { elementsNodeList.forEach(el => el.addEventListener(eventType, handler)); } else { console.warn(`[SETUP] No elements found for listener group: ${key}`); } };

        // Sidebar/Menu (Assume provided by dashboard.js)
        // Page Specific
        safeAddListener(ui.refreshDataBtn, 'click', handleRefreshClick, 'refreshDataBtn');
        safeAddListenerToAll(ui.contentTabs, 'click', handleTabSwitch, 'contentTabs');
        safeAddListener(ui.startTestBtnPrompt, 'click', () => window.location.href = 'test1.html', 'startTestBtnPrompt');
        safeAddListener(ui.startTestBtnResults, 'click', () => window.location.href = 'test1.html', 'startTestBtnResults');
        safeAddListener(ui.startTestBtnPlan, 'click', () => window.location.href = 'test1.html', 'startTestBtnPlan');
        safeAddListener(ui.startTestBtnAnalysis, 'click', () => window.location.href = 'test1.html', 'startTestBtnAnalysis');
        // Global listeners (Assume provided by dashboard.js)

        console.log("[Procvičování SETUP] Event listeners set up.");
    }

    // --- Инициализация Приложения ---
    function initializeApp() {
        console.log("[INIT Procvičování] Adding 'dashboardReady' event listener...");
        document.addEventListener('dashboardReady', async (event) => {
            console.log("[INIT Procvičování] 'dashboardReady' event received.");

            supabase = event?.detail?.client;
            currentUser = event?.detail?.user;
            currentProfile = event?.detail?.profile;
            allTitles = event?.detail?.titles || []; // Get titles for sidebar

            if (!supabase || !currentUser || !currentProfile) { console.error("[INIT Procvičování] Critical data missing after 'dashboardReady'."); showError("Chyba načítání základních dat. Zkuste obnovit stránku.", true); return; }

            console.log(`[INIT Procvičování] User: ${currentUser.id}, Profile:`, currentProfile);

            try {
                cacheDOMElements(); // Cache elements now DOM is ready
                setupEventListeners(); // Setup listeners AFTER caching

                // Initial UI setups if functions exist
                if (typeof updateCopyrightYear === 'function') updateCopyrightYear();
                if (typeof initMouseFollower === 'function') initMouseFollower();
                if (typeof initHeaderScrollDetection === 'function') initHeaderScrollDetection();
                if (typeof updateOnlineStatus === 'function') updateOnlineStatus();

                // --- Goal Check and Initial Load ---
                if (!currentProfile.learning_goal) {
                    console.log("[INIT Procvičování] Learning goal not set, showing modal.");
                    showGoalSelectionModal();
                    // Hide main content sections initially
                    setLoadingState('all', false); // Reset loading states
                    if(ui.mainContent) ui.mainContent.style.display = 'block'; // Show main area for modal
                    const sectionsToHide = [ui.practiceTabContent, ui.testResultsTabContent, ui.studyPlanTabContent, ui.topicAnalysisTabContent];
                    sectionsToHide.forEach(sec => { if(sec) sec.style.display = 'none'; });
                    // Make sure the container holding the tabs is visible if needed
                    const tabContainer = document.querySelector('.tab-content-container');
                    if(tabContainer) tabContainer.style.display = 'block'; // Ensure container is visible

                } else {
                    console.log(`[INIT Procvičování] Goal already set: ${currentProfile.learning_goal}. Loading data...`);
                    if(ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; // Ensure modal is hidden
                    configureUIForGoal(currentProfile.learning_goal); // Configure UI first
                    await loadPageData(); // Load data based on the existing goal
                }
                // --- End Goal Check ---

                 if (ui.mainContent && window.getComputedStyle(ui.mainContent).display === 'none') {
                     ui.mainContent.style.display = 'block';
                     requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); });
                 }
                 initTooltips();

                console.log("✅ [INIT Procvičování] Page specific setup complete.");

            } catch (error) {
                console.error("❌ [INIT Procvičování] Error during page-specific setup:", error);
                showError(`Chyba inicializace stránky Procvičování: ${error.message}`, true);
                if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show content to display error
                setLoadingState('all', false);
            } finally {
                 const il = ui.initialLoader; // Use cached element
                 if (il && !il.classList.contains('hidden')) { il.classList.add('hidden'); setTimeout(() => { if(il) il.style.display = 'none'; }, 300); }
            }
        });

        // Initial setup before dashboardReady
        cacheDOMElements(); // Cache early
        if (ui.mainContent) ui.mainContent.style.display = 'none'; // Hide content initially
        console.log("[INIT Procvičování] Waiting for 'dashboardReady' event...");
    }

    // --- Запуск ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp(); // If DOM is already ready
    }

})(); // End IIFE