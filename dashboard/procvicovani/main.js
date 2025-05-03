// dashboard/procvicovani/main.js
// Version: 24.4 - Full implementation with 4 goal options

(function() { // Start IIFE
    'use strict';

    // --- Глобальные переменные ---
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = []; // Для консистентности сайдбара
    let userStatsData = null;
    let diagnosticResultsData = [];
    let testsChartInstance = null; // Оставляем, если элемент canvas существует
    let topicProgressData = [];
    let studyPlanData = null;
    let planActivitiesData = [];
    let isLoading = {
        stats: false,
        tests: false,
        plan: false,
        topics: false,
        shortcuts: false, // Добавлено для ярлыков
        notifications: false,
        goalSelection: false,
        all: false
    };
    let goalSelectionInProgress = false; // Предотвращение двойного клика

    // --- Кэш UI Элементов ---
    const ui = {};

    function cacheDOMElements() {
        console.log("[Procvičování Cache DOM] Caching elements...");
        const ids = [
            'diagnostic-prompt', 'start-test-btn-prompt',
            'stats-cards', 'shortcuts-grid',
            'test-results-container', 'test-results-loading', 'test-results-content',
            'test-results-empty', 'start-test-btn-results', 'testsChart', // ID для canvas
            'study-plan-container', 'study-plan-loading', 'study-plan-content',
            'study-plan-empty', 'start-test-btn-plan',
            'main-plan-schedule', // ID для grid'а расписания
            'topic-analysis-container', 'topic-analysis-loading', 'topic-analysis-content',
            'topic-analysis-empty', 'start-test-btn-analysis', 'topic-grid',
            'global-error', 'toastContainer', 'main-content', 'refresh-data-btn',
            'goal-selection-modal', 'select-goal-exam', 'select-goal-accelerate',
            'select-goal-review', 'select-goal-explore', // Включаем кнопку explore
            // Элементы из dashboard.js/shared context, если нужны здесь
            'initial-loader', 'sidebar-overlay', 'sidebar', 'main-mobile-menu-toggle',
            'sidebar-close-toggle', 'sidebar-toggle-btn', 'sidebar-avatar',
            'sidebar-name', 'sidebar-user-title', 'currentYearSidebar',
            'dashboard-header', 'dashboard-title', 'notification-bell',
            'notification-count', 'notifications-dropdown', 'notifications-list',
            'no-notifications-msg', 'mark-all-read', 'currentYearFooter', 'mouse-follower'
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

        // Проверка критически важных элементов
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
    // Используем глобальные функции из dashboard.js или определяем здесь
    const showToast = window.showToast || function(t, m, ty) { console.log(`[Toast Fallback] ${ty}: ${t} - ${m}`); };
    const showError = window.showError || function(m, g) { console.error(`[Error Fallback] Global=${g}: ${m}`); const ge = document.getElementById('global-error'); if (g && ge) { ge.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(m)}</div><button class="retry-button btn" onclick="location.reload()">Obnovit</button></div>`; ge.style.display = 'block'; } else { showToast("CHYBA", m, 'error'); } };
    const hideError = window.hideError || function() { const ge = document.getElementById('global-error'); if (ge) ge.style.display = 'none'; };
    const sanitizeHTML = window.sanitizeHTML || function(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
    const formatDate = window.formatDate || function(d) { try { return d ? new Date(d).toLocaleDateString('cs-CZ') : '-'; } catch (e) { return '-'; } };
    const formatTime = window.formatTime || function(s) { if (isNaN(s) || s < 0) return '--:--'; const m = Math.floor(s / 60); const ss = Math.round(s % 60); return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`; };
    const formatRelativeTime = window.formatRelativeTime || function(t) { try { return t ? new Date(t).toLocaleString('cs-CZ') : '-'; } catch (e) { return '-'; } };
    const initTooltips = window.initTooltips || function() { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, side: 'top' }); } } catch(e){console.warn("Tooltipster init failed", e)} };
    const initScrollAnimations = window.initScrollAnimations || function() { console.warn("initScrollAnimations function not found."); };
    const initHeaderScrollDetection = window.initHeaderScrollDetection || function() { console.warn("initHeaderScrollDetection function not found."); };
    const updateOnlineStatus = window.updateOnlineStatus || function() { /* Placeholder */ };
    const openMenu = window.openMenu || function() { console.warn("openMenu function not found."); };
    const closeMenu = window.closeMenu || function() { console.warn("closeMenu function not found."); };
    const renderNotificationSkeletons = window.renderNotificationSkeletons || function(c) { console.warn("renderNotificationSkeletons function not found."); }
    const renderNotifications = window.renderNotifications || function(c, n) { console.warn("renderNotifications function not found."); }
    const markNotificationRead = window.markNotificationRead || async function(id) { console.warn("markNotificationRead function not found."); return false; }
    const markAllNotificationsRead = window.markAllNotificationsRead || async function() { console.warn("markAllNotificationsRead function not found."); }
    const updateCopyrightYear = window.updateCopyrightYear || function(){ console.warn("updateCopyrightYear function not found."); };
    const initMouseFollower = window.initMouseFollower || function(){ console.warn("initMouseFollower function not found."); };
    const getInitials = window.getInitials || function(p){if(!p) return'?';const f=p.first_name?.[0]||'';const l=p.last_name?.[0]||'';return(f+l).toUpperCase()||p.username?.[0].toUpperCase()||p.email?.[0].toUpperCase()||'?';};
    const updateSidebarProfile = window.updateSidebarProfile || function(p, t){console.warn("updateSidebarProfile function not found.");};
    const applyInitialSidebarState = window.applyInitialSidebarState || function(){console.warn("applyInitialSidebarState function not found.");};
    const toggleSidebar = window.toggleSidebar || function(){console.warn("toggleSidebar function not found.");};


    // --- Управление состоянием загрузки ---
    function setLoadingState(sectionKey, isLoadingFlag) {
        if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;

        const updateSingleSection = (key, loading) => {
            if (isLoading[key] === loading && key !== 'all') return; // Предотвратить избыточные обновления
            isLoading[key] = loading;
            console.log(`[Procvičování UI Loading] Section: ${key}, isLoading: ${loading}`);

            const sectionMap = {
                stats: { container: ui.statsCards, skeletonFn: renderStatsSkeletons },
                tests: { container: ui.testResultsContainer, content: ui.testResultsContent, empty: ui.testResultsEmpty, loader: ui.testResultsLoading, skeletonFn: renderTestSkeletons },
                plan: { container: ui.studyPlanContainer, content: ui.studyPlanContent, empty: ui.studyPlanEmpty, loader: ui.studyPlanLoading, skeletonFn: renderPlanSkeletons },
                topics: { container: ui.topicAnalysisContainer, content: ui.topicAnalysisContent, empty: ui.topicAnalysisEmpty, loader: ui.topicAnalysisLoading, skeletonFn: renderTopicSkeletons },
                shortcuts: { container: ui.shortcutsGrid, skeletonFn: renderShortcutSkeletons },
                notifications: { container: ui.notificationsList, empty: ui.noNotificationsMsg, loader: null, skeletonFn: renderNotificationSkeletons },
                goalSelection: { /* Управляется состоянием кнопок */ }
            };

            const config = sectionMap[key];
            if (!config) { if (key !== 'all') { console.warn(`[Procvičování UI Loading] Unknown section key '${key}'.`); } return; }

            const container = config.container;
            const content = config.content;
            const empty = config.empty;
            const loader = config.loader;
            const skeletonFn = config.skeletonFn;

            // Управление лоадером и классом loading на контейнере
            if (loader) loader.style.display = loading ? 'flex' : 'none';
            if (container) container.classList.toggle('loading', loading);

            // Управление видимостью контента и пустого состояния + рендеринг скелетонов
            if (loading) {
                if (content) content.style.display = 'none';
                if (empty) empty.style.display = 'none';
                if (skeletonFn) {
                     // Для статистики и ярлыков рендерим прямо в контейнер
                     const targetContainer = (key === 'stats' || key === 'shortcuts') ? container : content;
                    if (targetContainer) skeletonFn(targetContainer);
                }
            } else {
                // После загрузки, функции рендеринга (`renderTestResults` и т.д.)
                // должны сами решить, показать контент или пустое состояние.
                // Здесь убираем скелетоны, если они не были заменены.
                const skeletonSelector = '.loading-skeleton'; // Общий селектор для скелетонов
                 if (content?.querySelector(skeletonSelector)) content.innerHTML = '';
                 if (container?.querySelector(skeletonSelector) && key !== 'stats' && key !== 'shortcuts') container.innerHTML = '';
                 // Показ пустого состояния, если контент пуст ПОСЛЕ загрузки, должен быть в renderX функциях
            }

            // Специальная обработка для уведомлений
            if (key === 'notifications' && ui.notificationBell) {
                ui.notificationBell.style.opacity = loading ? 0.5 : 1;
                if (ui.markAllReadBtn) {
                    const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                    ui.markAllReadBtn.disabled = loading || currentUnreadCount === 0;
                }
            }
        };

        // Применить ко всем или к одной секции
        if (sectionKey === 'all') {
            Object.keys(isLoading).forEach(key => {
                if (key !== 'all' && key !== 'goalSelection') { // goalSelection не имеет визуального лоадера
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
    async function fetchDashboardStats(userId, profileData) {
        if (!supabase || !userId || !profileData) { console.error("[Stats Fetch] Missing supabase, userId, or profileData."); return null; }
        console.log(`[Stats Fetch] Fetching stats for user ${userId}...`);
        let fetchedStats = null; let statsError = null;
        try {
            const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests, total_study_seconds, weakest_topic_name').eq('user_id', userId).maybeSingle();
            fetchedStats = data; statsError = error;
            if (statsError) { console.warn("[Stats Fetch] Supabase error fetching user_stats:", statsError.message); }
        } catch (error) { console.error("[Stats Fetch] Exception fetching user_stats:", error); statsError = error; }
        // Комбинируем данные из user_stats и profiles
        const finalStats = {
            progress: fetchedStats?.progress ?? profileData.progress ?? 0,
            progress_weekly: fetchedStats?.progress_weekly ?? 0,
            points: profileData.points ?? 0,
            points_weekly: fetchedStats?.points_weekly ?? 0,
            streak_current: profileData.streak_days ?? 0,
            streak_longest: Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0),
            completed_exercises: profileData.completed_exercises ?? 0,
            completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0, // Берем из profiles, если есть, иначе из stats
            total_study_seconds: fetchedStats?.total_study_seconds ?? 0,
            weakest_topic_name: fetchedStats?.weakest_topic_name ?? null,
        };
        if (statsError && fetchedStats === null) { console.warn("[Stats Fetch] Returning stats based primarily on profile due to fetch error."); }
        else { console.log("[Stats Fetch] Dashboard stats fetched/compiled:", finalStats); }
        return finalStats;
    }
    async function fetchDiagnosticResults(userId, goal) {
         if (!supabase || !userId) return [];
         console.log(`[Tests Fetch] Fetching diagnostic results for user ${userId}, goal: ${goal}...`);
         // Пока без фильтрации по goal, так как диагностика общая
         try {
             const { data, error } = await supabase
                 .from('user_diagnostics')
                 .select('id, completed_at, total_score, total_questions, time_spent')
                 .eq('user_id', userId)
                 .order('completed_at', { ascending: false });
             if (error) throw error; return data || [];
         } catch (err) { console.error("Error fetching diagnostic results:", err); return []; }
     }
    async function fetchActiveStudyPlan(userId, goal) {
         if (!supabase || !userId) return null;
         console.log(`[Plan Fetch] Fetching active study plan for user ${userId}, goal: ${goal}...`);
         try {
             let query = supabase.from('study_plans').select('id, title, created_at').eq('user_id', userId).eq('status', 'active');
             // Добавить фильтр по цели, если нужно, например:
             // if (goal) query = query.eq('plan_goal_type', goal); // Допустим, есть колонка 'plan_goal_type'
             query = query.order('created_at', { ascending: false }).limit(1);
             const { data: plans, error } = await query;
             if (error) throw error; return plans?.[0] || null;
         } catch (err) { console.error("Error fetching active study plan:", err); return null; }
     }
    async function fetchPlanActivities(planId, goal) {
        if (!planId || !supabase) return [];
        console.log(`[Plan Activities Fetch] Fetching activities for plan ${planId}, goal: ${goal}...`);
        try {
            let query = supabase.from('plan_activities').select('id, title, day_of_week, time_slot, completed, description, type').eq('plan_id', planId);
            // Добавить фильтр по цели, если нужно
            // if (goal) query = query.eq('activity_goal_type', goal);
            query = query.order('day_of_week').order('time_slot');
            const { data, error } = await query;
            if (error) throw error; return data || [];
        } catch (err) { console.error("Error fetching plan activities:", err); return []; }
    }
    async function fetchTopicProgress(userId, goal) {
        if (!supabase || !userId) return [];
        console.log(`[Topics Fetch] Fetching topic progress for user ${userId}, goal: ${goal}...`);
        try {
            // Фильтруем темы по типу, если это не "Volné prozkoumávání"
            let query = supabase
                .from('user_topic_progress')
                .select(`
                    topic_id, progress, strength, questions_attempted, questions_correct,
                    topic:exam_topics!inner( name, subject, is_exam_topic )
                `) // Добавляем is_exam_topic
                .eq('user_id', userId);

            if (goal === 'exam_prep') {
                query = query.eq('topic.is_exam_topic', true); // Только темы для экзамена
                 console.log("[Topics Fetch] Filtering for exam topics.");
            } else if (goal === 'math_accelerate' || goal === 'math_review') {
                query = query.eq('topic.is_exam_topic', false); // Только темы НЕ для экзамена
                 console.log("[Topics Fetch] Filtering for non-exam (math learning) topics.");
            } else {
                 console.log("[Topics Fetch] Fetching all topics (explore or default).");
                 // Не добавляем фильтр для 'math_explore' или если цель не определена
            }

            const { data, error } = await query;
            if (error) throw error;
             console.log(`[Topics Fetch] Fetched ${data?.length} topics for goal ${goal}.`);
            return data || [];
        } catch (err) {
            console.error("Error fetching topic progress:", err);
             // Обработка ошибки, если колонка is_exam_topic не существует
             if (err.message?.includes('column exam_topics.is_exam_topic does not exist')) {
                 console.warn("Column 'is_exam_topic' not found in 'exam_topics'. Fetching all topics instead.");
                 // Повторный запрос без фильтрации по is_exam_topic
                 try {
                     const { data: allData, error: allError } = await supabase
                         .from('user_topic_progress')
                         .select(` topic_id, progress, strength, questions_attempted, questions_correct, topic:exam_topics!inner( name, subject ) `)
                         .eq('user_id', userId);
                     if (allError) throw allError;
                     return allData || [];
                 } catch (fallbackErr) {
                      console.error("Error fetching all topics after fallback:", fallbackErr);
                      return [];
                 }
             }
            return [];
        }
    }

    // --- Рендеринг UI ---
    function renderStatsCards(stats) {
         const container = ui.statsCards;
         if (!container) { console.warn("[Render Stats] Container #stats-cards not found."); return; }
         console.log("[Render Stats] Rendering stats cards with data:", stats);
         container.innerHTML = ''; // Clear skeletons
         if (!stats) {
             container.innerHTML = '<p class="error-message-inline">Statistiky nelze načíst.</p>';
             container.classList.remove('loading');
             return;
         }
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
    function renderTestResults(results, goal) {
        console.log(`[Tests Render] Rendering test results for goal: ${goal}`);
        const container = ui.testResultsContainer;
        const contentEl = ui.testResultsContent;
        const emptyEl = ui.testResultsEmpty;
        const startBtn = ui.startTestBtnResults;
        const chartCanvas = ui.testsChart; // Use cached canvas

        if (!contentEl || !emptyEl || !startBtn || !container) { console.warn("Missing elements for renderTestResults"); setLoadingState('tests', false); return; }

        const titleElement = container.querySelector('.section-title');
        if (titleElement) { titleElement.innerHTML = '<i class="fas fa-poll"></i>Výsledky Diagnostiky'; } // Keep title generic for now

        contentEl.innerHTML = ''; // Clear previous content
        contentEl.style.display = 'none';
        emptyEl.style.display = 'none';
        startBtn.style.display = 'inline-flex'; // Always show button?

        if (!results || results.length === 0) {
            emptyEl.style.display = 'block';
        } else {
            contentEl.style.display = 'block';
            const avgScore = calculateAverageScore(results);
            const validScores = results.filter(r => typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0);
            const bestScore = validScores.length > 0 ? Math.round(Math.max(...validScores.map(r => (r.total_score / r.total_questions) * 100))) : '-';
            const validTimes = results.filter(r => r.time_spent != null && typeof r.time_spent === 'number' && r.time_spent > 0);
            const avgTime = validTimes.length > 0 ? formatTime(validTimes.reduce((sum, r) => sum + r.time_spent, 0) / validTimes.length) : '--:--';
            const lastTest = results[0];
            const scorePercentLast = calculateAverageScore([lastTest]);

            const testStatsHTML = `
                <div class="test-stats">
                     <div class="stats-card"> <div class="stats-icon primary"><i class="fas fa-percentage"></i></div><div class="stats-value">${avgScore}%</div><div class="stats-label">Prům. Skóre</div></div>
                     <div class="stats-card"> <div class="stats-icon success"><i class="fas fa-trophy"></i></div><div class="stats-value">${bestScore}%</div><div class="stats-label">Nejlepší Skóre</div></div>
                     <div class="stats-card"> <div class="stats-icon warning"><i class="fas fa-clock"></i></div><div class="stats-value">${avgTime}</div><div class="stats-label">Prům. Čas</div></div>
                 </div>`;
             const chartContainerHTML = chartCanvas ? `<div class="chart-container"><canvas id="testsChart"></canvas></div>` : ''; // Keep canvas ID
             const lastTestHTML = `
                 <div class="last-test-result card">
                      <div class="test-result-header"><div class="test-result-title"><h3>Poslední Diagnostika</h3><div class="test-result-meta">Dokončeno ${formatDate(lastTest.completed_at)}</div></div><div class="test-result-score"><div class="test-result-score-value">${scorePercentLast}%</div><div class="test-result-score-label">(${lastTest.total_score}/${lastTest.total_questions})</div></div></div>
                 </div>`;
             let historyHTML = '';
             if (results.length > 1) {
                 historyHTML = `<h3 class="section-subtitle">Předchozí Testy</h3>` + results.slice(1).map(test => { const scorePercentHist = calculateAverageScore([test]); const timeSpent = test.time_spent != null ? formatTime(test.time_spent) : '--:--'; return `<div class="test-item"><div class="test-info"><div class="test-icon"><i class="fas fa-clipboard-check"></i></div><div class="test-details"><h4>Diagnostický Test</h4><div class="test-meta"><span><i class="far fa-calendar"></i> ${formatDate(test.completed_at)}</span><span><i class="far fa-clock"></i> ${timeSpent}</span></div></div></div><div class="test-score">${scorePercentHist}%</div></div>`; }).join('');
                 historyHTML = `<div class="test-list">${historyHTML}</div>`;
             }

             contentEl.innerHTML = testStatsHTML + chartContainerHTML + lastTestHTML + historyHTML;

             // Re-select canvas and render chart
             ui.testsChart = document.getElementById('testsChart'); // Re-cache canvas element
             if (ui.testsChart) {
                 const chartDataPoints = results.filter(r => r.completed_at && typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0).sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at)).map(r => ({ date: new Date(r.completed_at), score: Math.round((r.total_score / r.total_questions) * 100) }));
                 renderTestChart({ labels: chartDataPoints.map(p => p.date), data: chartDataPoints.map(p => p.score) });
             } else { console.warn("Canvas element #testsChart not found after render."); }
        }
        setLoadingState('tests', false);
        initScrollAnimations();
    }
    function renderStudyPlanOverview(plan, activities, goal) {
         console.log(`[Plan Render] Rendering plan overview for goal: ${goal}`);
         const container = ui.studyPlanContainer;
         const contentEl = ui.studyPlanContent;
         const emptyEl = ui.studyPlanEmpty;
         const startBtn = ui.startTestBtnPlan;
         const scheduleGrid = ui.mainPlanSchedule; // Use cached grid

         if (!contentEl || !emptyEl || !startBtn || !container || !scheduleGrid) { console.warn("Missing elements for renderStudyPlanOverview"); setLoadingState('plan', false); return; }

         const titleElement = container.querySelector('.section-title');
         if (titleElement) { titleElement.innerHTML = '<i class="fas fa-route"></i>Aktuální Studijní Plán'; } // Keep generic title for now

         scheduleGrid.innerHTML = ''; // Clear previous schedule
         contentEl.style.display = 'none';
         emptyEl.style.display = 'none';

         if (!plan) {
             emptyEl.style.display = 'block';
             startBtn.style.display = 'inline-flex';
         } else {
              contentEl.style.display = 'block';
              startBtn.style.display = 'none';
              const daysOrder = [1, 2, 3, 4, 5, 6, 0];
              const dayNames = { 0: 'Neděle', 1: 'Pondělí', 2: 'Úterý', 3: 'Středa', 4: 'Čtvrtek', 5: 'Pátek', 6: 'Sobota' };
              const activitiesByDay = {}; daysOrder.forEach(dayIndex => activitiesByDay[dayIndex] = []);
              (activities || []).forEach(activity => { if (activitiesByDay[activity.day_of_week] !== undefined) activitiesByDay[activity.day_of_week].push(activity); });

              let hasVisibleActivities = false;
              daysOrder.forEach(dayIndex => {
                   const dayName = dayNames[dayIndex];
                   const dayDiv = document.createElement('div'); dayDiv.className = 'schedule-day card';
                   const headerDiv = document.createElement('div'); headerDiv.className = 'schedule-day-header'; headerDiv.textContent = dayName;
                   dayDiv.appendChild(headerDiv);
                   const activitiesDiv = document.createElement('div'); activitiesDiv.className = 'schedule-activities';
                   const dayActivities = activitiesByDay[dayIndex].sort((a, b) => (a.time_slot || '99:99').localeCompare(b.time_slot || '99:99'));
                   if (dayActivities.length > 0) {
                        hasVisibleActivities = true;
                       dayActivities.forEach(activity => { const visual = activityVisuals[activity.type?.toLowerCase()] || activityVisuals.default; const title = sanitizeHTML(activity.title || 'Nespecifikováno'); const timeSlot = activity.time_slot ? `<span>${sanitizeHTML(activity.time_slot)}</span>` : ''; const activityItem = document.createElement('div'); activityItem.className = `schedule-activity-item ${activity.completed ? 'completed' : ''}`; activityItem.innerHTML = `<i class="fas ${visual.icon} activity-icon"></i><div class="activity-details"><strong>${title}</strong>${timeSlot}</div>`; activitiesDiv.appendChild(activityItem); });
                   } else { activitiesDiv.innerHTML = `<p class="no-activities-placeholder">Žádné aktivity</p>`; }
                   dayDiv.appendChild(activitiesDiv); scheduleGrid.appendChild(dayDiv);
               });

                if (!hasVisibleActivities) { // Show empty state if plan exists but has no activities
                    emptyEl.style.display = 'block';
                    emptyEl.querySelector('h3').textContent = "Plán je prázdný";
                    emptyEl.querySelector('p').textContent = "Tento studijní plán zatím neobsahuje žádné aktivity.";
                    startBtn.style.display = 'none'; // Hide test button
                } else {
                     // Add the "View Full Plan" link only if there are activities
                      contentEl.innerHTML = ''; // Clear grid if previously added
                      contentEl.appendChild(scheduleGrid);
                      contentEl.innerHTML += `<div class="full-plan-link-container"><a href="plan.html" class="btn btn-secondary">Zobrazit celý plán a detaily</a></div>`;
                }
            }
         setLoadingState('plan', false);
         initScrollAnimations();
     }
    function renderTopicAnalysis(topics, goal) {
        console.log(`[Topics Render] Rendering topic analysis for goal: ${goal}`);
        const container = ui.topicAnalysisContainer;
        const contentEl = ui.topicAnalysisContent;
        const emptyEl = ui.topicAnalysisEmpty;
        const topicGrid = ui.topicGrid;
        const startBtn = ui.startTestBtnAnalysis;

        if (!contentEl || !emptyEl || !topicGrid || !startBtn || !container) { console.warn("Missing elements for renderTopicAnalysis"); setLoadingState('topics', false); return; }

        const titleElement = container.querySelector('.section-title');
        if (titleElement) { titleElement.innerHTML = '<i class="fas fa-atom"></i>Analýza podle Témat'; } // Keep generic for now

        topicGrid.innerHTML = ''; // Clear previous grid
        contentEl.style.display = 'none';
        emptyEl.style.display = 'none';

        if (!topics || topics.length === 0) {
            emptyEl.style.display = 'block';
            startBtn.style.display = 'inline-flex';
        } else {
            contentEl.style.display = 'block';
            startBtn.style.display = 'none'; // Hide button if topics exist
            const fragment = document.createDocumentFragment();
            topics.sort((a, b) => (a.progress ?? 100) - (b.progress ?? 100)); // Sort by progress ASC (weakest first)
            topics.forEach(topic => {
                const topicName = topic.topic?.name || `Téma ${topic.topic_id}` || 'Neznámé téma';
                const iconClass = topicIcons[topic.topic?.name] || topicIcons.default || 'fa-book';
                const strength = topic.strength || 'neutral';
                const progress = topic.progress || 0;
                const attempted = topic.questions_attempted || 0;
                const correct = topic.questions_correct || 0;
                const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
                const accuracyClass = accuracy >= 75 ? 'high' : accuracy < 50 ? 'low' : 'medium';
                const card = document.createElement('div'); card.className = `topic-card card ${strength}`;
                card.innerHTML = ` <div class="topic-header"> <div class="topic-icon"><i class="fas ${iconClass}"></i></div> <h3 class="topic-title">${sanitizeHTML(topicName)}</h3> </div> <div class="progress-container" title="Celkový pokrok v tématu: ${progress}%"> <div class="progress-bar" style="width: ${progress}%;"></div> </div> <div class="topic-stats"> <div class="topic-stat"> <span>Správnost otázek:</span> <strong class="accuracy-value ${accuracyClass}">${accuracy}%</strong> </div> <div class="topic-stat"> <span>Zodpovězeno:</span> <strong>${correct}/${attempted}</strong> </div> </div>`;
                fragment.appendChild(card);
            });
            topicGrid.appendChild(fragment);
        }
        setLoadingState('topics', false);
        initScrollAnimations();
    }

    // --- Рендеринг Ярлыков ---
    function renderShortcutsForGoal(goal, container) {
         if (!container) return;
         setLoadingState('shortcuts', true); // Start loading state for shortcuts
         container.innerHTML = ''; // Clear previous shortcuts
         console.log(`Rendering shortcuts for goal: ${goal}`);

         let shortcutsHTML = '';

         if (goal === 'exam_prep') {
             shortcutsHTML = `
                 <div class="shortcut-card card" data-animate style="--animation-order: 7;"> <div class="shortcut-icon"><i class="fas fa-graduation-cap"></i></div> <h3 class="shortcut-title">Diagnostický Test</h3> <p class="shortcut-desc">Ověřte své znalosti pro přijímačky.</p> <a href="/dashboard/procvicovani/test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Test</a> </div>
                 <div class="shortcut-card card" data-animate style="--animation-order: 8;"> <div class="shortcut-icon"><i class="fas fa-tasks"></i></div> <h3 class="shortcut-title">Studijní Plán</h3> <p class="shortcut-desc">Zobrazte si svůj personalizovaný plán přípravy.</p> <a href="/dashboard/procvicovani/plan.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Zobrazit Plán</a> </div>
                 <div class="shortcut-card card" data-animate style="--animation-order: 9;"> <div class="shortcut-icon"><i class="fas fa-book-open"></i></div> <h3 class="shortcut-title">AI Tutor (Lekce)</h3> <p class="shortcut-desc">Nechte si vysvětlit témata z vašeho plánu.</p> <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a> </div>
                 `;
         } else if (goal === 'math_accelerate') {
             shortcutsHTML = `
                 <div class="shortcut-card card" data-animate style="--animation-order: 7;"> <div class="shortcut-icon"><i class="fas fa-forward"></i></div> <h3 class="shortcut-title">Další Téma Osnovy</h3> <p class="shortcut-desc">Pokračujte v učení podle standardní osnovy.</p> <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Učit se Další</a> </div>
                 <div class="shortcut-card card" data-animate style="--animation-order: 8;"> <div class="shortcut-icon"><i class="fas fa-chalkboard-teacher"></i></div> <h3 class="shortcut-title">AI Vysvětlení</h3> <p class="shortcut-desc">Nechte si od AI vysvětlit jakýkoli matematický koncept.</p> <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a> </div>
                 <div class="shortcut-card card" data-animate style="--animation-order: 9;"> <div class="shortcut-icon"><i class="fas fa-stream"></i></div> <h3 class="shortcut-title">Přehled Osnovy</h3> <p class="shortcut-desc">Zobrazte si přehled témat dle školní osnovy.</p> <a href="/dashboard/procvicovani/plan.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Osnovu</a> </div>
                 `;
         } else if (goal === 'math_review') {
             shortcutsHTML = `
                 <div class="shortcut-card card" data-animate style="--animation-order: 7;"> <div class="shortcut-icon"><i class="fas fa-search"></i></div> <h3 class="shortcut-title">Moje Slabiny</h3> <p class="shortcut-desc">Zobrazte témata, kde potřebujete nejvíce zlepšení.</p> <a href="#topic-analysis-tab" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="document.querySelector('.content-tab[data-tab=topic-analysis-tab]').click()">Analýza Témat</a> </div>
                 <div class="shortcut-card card" data-animate style="--animation-order: 8;"> <div class="shortcut-icon"><i class="fas fa-history"></i></div> <h3 class="shortcut-title">Opakování</h3> <p class="shortcut-desc">Procvičte si témata, která jste dlouho neprobírali.</p> <a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="alert('Funkce opakování zatím není implementována.'); return false;">Spustit Opakování</a> </div>
                 <div class="shortcut-card card" data-animate style="--animation-order: 9;"> <div class="shortcut-icon"><i class="fas fa-book-open"></i></div> <h3 class="shortcut-title">AI Tutor (Vysvětlení)</h3> <p class="shortcut-desc">Nechte si znovu vysvětlit problematické koncepty.</p> <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a> </div>
                 `;
         } else { // math_explore или fallback
             shortcutsHTML = `
                 <div class="shortcut-card card" data-animate style="--animation-order: 7;"> <div class="shortcut-icon"><i class="fas fa-compass"></i></div> <h3 class="shortcut-title">Procházet Témata</h3> <p class="shortcut-desc">Vyberte si libovolné matematické téma k učení.</p> <a href="#topic-analysis-tab" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="document.querySelector('.content-tab[data-tab=topic-analysis-tab]').click()">Vybrat Téma</a> </div>
                 <div class="shortcut-card card" data-animate style="--animation-order: 8;"> <div class="shortcut-icon"><i class="fas fa-chalkboard-teacher"></i></div> <h3 class="shortcut-title">AI Vysvětlení</h3> <p class="shortcut-desc">Nechte si od AI vysvětlit jakýkoli matematický koncept.</p> <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a> </div>
                 <div class="shortcut-card card" data-animate style="--animation-order: 9;"> <div class="shortcut-icon"><i class="fas fa-dumbbell"></i></div> <h3 class="shortcut-title">Náhodné Cvičení</h3> <p class="shortcut-desc">Spusťte náhodné cvičení pro rychlé procvičení.</p> <a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="alert('Funkce náhodného cvičení zatím není implementována.'); return false;">Náhodné Cvičení</a> </div>
                 `;
         }
         container.innerHTML = shortcutsHTML;
         container.classList.remove('loading');
         setLoadingState('shortcuts', false);
         initScrollAnimations(); // Re-initialize animations
     }

    // --- Event Handlers ---
    function handleTabSwitch(event) {
        const tabButton = event.currentTarget;
        const tabId = tabButton?.dataset?.tab;
        if (!tabId || !ui.contentTabs) return;
        console.log(`[UI TabSwitch] Switching to tab: ${tabId}`);
        ui.contentTabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tabButton.classList.add('active');
        const activeContent = document.getElementById(tabId);
        if (activeContent) {
            activeContent.classList.add('active');
            requestAnimationFrame(() => { // Re-trigger animations
                activeContent.querySelectorAll('[data-animate]').forEach(el => el.classList.remove('animated'));
                initScrollAnimations();
            });
        } else { console.warn(`[UI TabSwitch] Content for tab ${tabId} not found!`); }
        if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
    async function handleRefreshClick() {
        if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; }
        if (Object.values(isLoading).some(s => s === true)) { showToast('Info','Data se již načítají.', 'info'); return; }
        const refreshBtn = ui.refreshDataBtn;
        const icon = refreshBtn?.querySelector('i');
        const text = refreshBtn?.querySelector('.refresh-text');
        if(refreshBtn) refreshBtn.disabled = true;
        if(icon) icon.classList.add('fa-spin');
        if(text) text.textContent = 'RELOADING...';
        await loadPageData(); // Reload all data based on current goal
        if(refreshBtn) refreshBtn.disabled = false;
        if(icon) icon.classList.remove('fa-spin');
        if(text) text.textContent = 'RELOAD';
        initTooltips();
    }
    // --- Конец Event Handlers ---

    // --- Настройка Event Listeners ---
    function setupEventListeners() {
        console.log("[Procvičování SETUP] Setting up event listeners...");
        //cacheDOMElements(); // Already called in initializeApp

        const safeAddListener = (element, eventType, handler, key) => {
            if (element) {
                 // Remove existing listener before adding new one to prevent duplicates
                 // Note: This requires the handler to be a named function or stored reference
                 // For anonymous functions, this simple remove won't work reliably.
                 // Consider storing handlers if elements might be re-cached dynamically.
                 // element.removeEventListener(eventType, handler);
                element.addEventListener(eventType, handler);
            } else { console.warn(`[SETUP] Element not found for listener: ${key}`); }
        };

         const safeAddListenerToAll = (elementsNodeList, eventType, handler, key) => {
             if (elementsNodeList && elementsNodeList.length > 0) {
                 elementsNodeList.forEach(el => el.addEventListener(eventType, handler));
             } else {
                 console.warn(`[SETUP] No elements found for listener group: ${key}`);
             }
         };


        // Sidebar/Menu (Assuming functions from dashboard.js or helpers)
        // safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
        // safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
        // safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');
        // safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn'); // Handled by dashboard.js
        // safeAddListenerToAll(document.querySelectorAll('.sidebar-link'), 'click', () => { if (window.innerWidth <= 992 && typeof closeMenu === 'function') closeMenu(); }, '.sidebar-link');

        // Page Specific
        safeAddListener(ui.refreshDataBtn, 'click', handleRefreshClick, 'refreshDataBtn');
        safeAddListenerToAll(ui.contentTabs, 'click', handleTabSwitch, 'contentTabs');

        // Buttons within empty/prompt states (safer to add listeners here if elements exist)
        safeAddListener(ui.startTestBtnPrompt, 'click', () => window.location.href = 'test1.html', 'startTestBtnPrompt');
        safeAddListener(ui.startTestBtnResults, 'click', () => window.location.href = 'test1.html', 'startTestBtnResults');
        safeAddListener(ui.startTestBtnPlan, 'click', () => window.location.href = 'test1.html', 'startTestBtnPlan');
        safeAddListener(ui.startTestBtnAnalysis, 'click', () => window.location.href = 'test1.html', 'startTestBtnAnalysis');

        // Global listeners (Assuming functions from dashboard.js or helpers)
        // window.addEventListener('online', updateOnlineStatus);
        // window.addEventListener('offline', updateOnlineStatus);
        // if (ui.mainContent && typeof initHeaderScrollDetection === 'function') initHeaderScrollDetection();

        console.log("[Procvičování SETUP] Event listeners set up.");
    }
    // --- Конец Настройки Event Listeners ---


    // --- Инициализация Приложения ---
    function initializeApp() {
        console.log("[INIT Procvičování] Adding 'dashboardReady' event listener...");
        document.addEventListener('dashboardReady', async (event) => {
            console.log("[INIT Procvičování] 'dashboardReady' event received.");

            supabase = event?.detail?.client;
            currentUser = event?.detail?.user;
            currentProfile = event?.detail?.profile;
            allTitles = event?.detail?.titles || []; // Get titles for sidebar

            if (!supabase || !currentUser || !currentProfile) {
                console.error("[INIT Procvičování] Critical data missing after 'dashboardReady'.", { supabase, currentUser, currentProfile });
                showError("Chyba načítání základních dat pro Procvičování. Zkuste obnovit stránku.", true);
                const il = document.getElementById('initial-loader');
                if (il && !il.classList.contains('hidden')) { il.classList.add('hidden'); setTimeout(() => { if(il) il.style.display = 'none'; }, 300); }
                return;
            }

            console.log(`[INIT Procvičování] User: ${currentUser.id}, Profile:`, currentProfile);

            try {
                cacheDOMElements(); // Cache elements now that DOM is likely ready
                setupEventListeners(); // Setup listeners AFTER caching

                 // Basic UI setups (rely on dashboard.js potentially)
                 // if (typeof updateCopyrightYear === 'function') updateCopyrightYear();
                 // if (typeof initMouseFollower === 'function') initMouseFollower();
                 // if (typeof initHeaderScrollDetection === 'function') initHeaderScrollDetection();
                 // if (typeof updateOnlineStatus === 'function') updateOnlineStatus();

                // --- Goal Check ---
                if (!currentProfile.learning_goal) {
                    console.log("[INIT Procvičování] Cíl nenastaven, zobrazuji modální okno.");
                    showGoalSelectionModal(); // Show the modal
                    // Keep content hidden until goal is selected
                    setLoadingState('all', false);
                    if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show main area for modal

                    // Hide specific content sections explicitly
                     const sectionsToHide = [ui.statsCards, ui.testResultsContainer, ui.studyPlanContainer, ui.topicAnalysisContainer, ui.shortcutsGrid];
                     sectionsToHide.forEach(sec => { if(sec) sec.style.display = 'none'; });
                     // Hide tab content panes as well
                     document.querySelectorAll('.tab-content').forEach(pane => pane.classList.remove('active'));


                } else {
                    console.log(`[INIT Procvičování] Cíl již nastaven: ${currentProfile.learning_goal}. Načítání dat...`);
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
                if (ui.mainContent) ui.mainContent.style.display = 'block';
                setLoadingState('all', false);
            } finally {
                 const il = document.getElementById('initial-loader');
                 if (il && !il.classList.contains('hidden')) { il.classList.add('hidden'); setTimeout(() => { if(il) il.style.display = 'none'; }, 300); }
            }
        });

        // Initial setup before dashboardReady is fired
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