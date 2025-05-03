// dashboard/procvicovani/main.js
// Version: 24.8 - Self-contained, Multi-step goal selection, Syntax fixes

(function() { // Start IIFE
    'use strict';

    // --- Глобальные переменные ---
    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';

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
        shortcuts: false, notifications: false, // Keep notifications state for potential future use
        goalSelection: false, all: false
    };
    let goalSelectionInProgress = false;
    let pendingGoal = null;

    // --- Кэш UI Элементов ---
    const ui = {};

    function cacheDOMElements() {
        console.log("[Procvičování Cache DOM] Caching elements...");
        const ids = [
            'diagnostic-prompt', 'start-test-btn-prompt', 'stats-cards', 'shortcuts-grid',
            'test-results-container', 'test-results-loading', 'test-results-content',
            'test-results-empty', 'start-test-btn-results',
            'study-plan-container', 'study-plan-loading', 'study-plan-content',
            'study-plan-empty', 'start-test-btn-plan', 'main-plan-schedule',
            'topic-analysis-container', 'topic-analysis-loading', 'topic-analysis-content',
            'topic-analysis-empty', 'start-test-btn-analysis', 'topic-grid',
            'global-error', 'toastContainer', 'main-content', 'refresh-data-btn',
            'goal-selection-modal', 'goal-step-1', 'select-goal-exam', 'select-goal-accelerate',
            'select-goal-review', 'select-goal-explore',
            'goal-step-accelerate', 'accelerate-areas-group', 'accelerate-reason-group',
            'goal-step-review', 'review-areas-group',
            'goal-step-explore', 'explore-level-group',
            'initial-loader', 'sidebar-overlay', 'sidebar', 'main-mobile-menu-toggle',
            'sidebar-close-toggle', 'sidebar-toggle-btn', 'sidebar-avatar',
            'sidebar-name', 'sidebar-user-title', 'currentYearSidebar',
            'dashboard-title',
             // Notification elements are likely in the shared header, not cached here
             // 'notification-bell', 'notification-count', 'notifications-dropdown',
             // 'notifications-list', 'no-notifications-msg', 'mark-all-read',
            'currentYearFooter', 'mouse-follower'
        ];
        const notFound = [];
        ids.forEach(id => {
            const element = document.getElementById(id);
            const key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
            if (element) { ui[key] = element; }
            else { notFound.push(id); ui[key] = null; }
        });
        ui.contentTabs = document.querySelectorAll('.content-tab');
        ui.practiceTabContent = document.getElementById('practice-tab');
        ui.testResultsTabContent = document.getElementById('test-results-tab');
        ui.studyPlanTabContent = document.getElementById('study-plan-tab');
        ui.topicAnalysisTabContent = document.getElementById('topic-analysis-tab');
        ui.modalBackBtns = document.querySelectorAll('.modal-back-btn');
        ui.modalConfirmBtns = document.querySelectorAll('.modal-confirm-btn');
        ui.dashboardHeader = document.querySelector('.dashboard-header');

        const criticalMissing = ['practiceTabContent', 'goalSelectionModal', 'goalStep1', 'goalStepAccelerate', 'goalStepReview', 'goalStepExplore']
                                .filter(key => !ui[key]);
        if (criticalMissing.length > 0) { console.error("[CACHE DOM] CRITICAL elements missing:", criticalMissing); }
        if (notFound.length > 0) { console.log(`[Procvičování Cache DOM] Elements potentially missing: (${notFound.length}) ['${notFound.join("', '")}']`); }
        console.log("[Procvičování Cache DOM] Caching complete.");
    }

    // --- Карты иконок и визуалов ---
    const topicIcons = { /* ... as before ... */ "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon", "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar", "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar", "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book" };
    const activityVisuals = { /* ... as before ... */ test: { name: 'Test', icon: 'fa-vial', class: 'test' }, exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' }, badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' }, diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' }, plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' }, other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' }, default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' } };

    // --- START: Вспомогательные функции (Локальные определения) ---
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Obnovit</button></div>`; ui.globalError.style.display = 'block'; } else { showToast('CHYBA', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatDate(dateString) { try { return dateString ? new Date(dateString).toLocaleDateString('cs-CZ') : '-'; } catch (e) { return '-'; } }
    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return '--:--'; const m = Math.floor(seconds / 60); const ss = Math.round(seconds % 60); return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`; }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function updateCopyrightYear() { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
    function initTooltips() { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, side: 'top' }); } } catch(e){console.warn("Tooltipster init failed", e)} }
    function initScrollAnimations() { console.warn("initScrollAnimations function not implemented in main.js"); } // Stub
    function initHeaderScrollDetection() { console.warn("initHeaderScrollDetection function not implemented in main.js"); } // Stub
    function updateOnlineStatus() { console.warn("updateOnlineStatus function not implemented in main.js"); } // Stub
    function initMouseFollower() { console.warn("initMouseFollower function not implemented in main.js"); } // Stub
    function applyInitialSidebarState() { /* ... logic from dashboard.js ... */ try { const state = localStorage.getItem(SIDEBAR_STATE_KEY); const collapsed = state === 'collapsed'; document.body.classList.toggle('sidebar-collapsed', collapsed); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) icon.className = collapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; if(ui.sidebarToggleBtn) ui.sidebarToggleBtn.title = collapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (e) { console.error("Sidebar state error:", e); } }
    function toggleSidebar() { /* ... logic from dashboard.js ... */ try { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; if(ui.sidebarToggleBtn) ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (error) { console.error("[Sidebar Toggle] Error:", error); } }
    function updateSidebarProfile(profile, titlesData) { // Simplified version for this page
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) return;
        if (profile) { const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || currentUser?.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(profile); const avatarUrl = profile.avatar_url; ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot'; if (selectedTitleKey && titlesData && titlesData.length > 0) { const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey); if (foundTitle) displayTitle = foundTitle.name; } ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.title = sanitizeHTML(displayTitle); }
        else { ui.sidebarName.textContent = "Nepřihlášen"; ui.sidebarAvatar.textContent = '?'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot'; }
    }
    // --- END: Вспомогательные функции ---

    // --- Управление состоянием загрузки (Refined) ---
    function setLoadingState(sectionKey, isLoadingFlag) {
        // ... (Полная реализация setLoadingState из предыдущего ответа) ...
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
                notifications: { /* Handled by dashboard.js */ },
                goalSelection: { /* Handled by button states */ }
            };

            const config = sectionMap[key];
            if (!config) { if (key !== 'all' && key !== 'notifications' && key !== 'goalSelection') { console.warn(`[Procvičování UI Loading] Unknown section key '${key}'.`); } return; }

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
                 const skeletonSelector = '.loading-skeleton';
                 if (content?.querySelector(skeletonSelector)) content.innerHTML = '';
                 if (container?.querySelector(skeletonSelector) && !['stats', 'shortcuts'].includes(key)) container.innerHTML = '';
                 // Render functions handle showing content/empty state
                 if (content && empty) {
                     const hasContent = content.innerHTML.trim() !== '' && !content.querySelector(skeletonSelector);
                     // Determine display type based on element ID or structure if possible
                     let displayType = 'block';
                     if (content.id === 'topic-grid' || content.id === 'stats-cards' || content.id === 'shortcuts-grid' || content.id === 'main-plan-schedule') {
                         displayType = 'grid';
                     } else if (content.classList.contains('test-stats')) {
                          displayType = 'grid'; // Assuming test-stats should be grid too
                     }
                     content.style.display = hasContent ? displayType : 'none';
                     empty.style.display = hasContent ? 'none' : 'block';
                 }
            }
        };
        if (sectionKey === 'all') { Object.keys(isLoading).forEach(key => { if (key !== 'all' && key !== 'goalSelection' && key !== 'notifications') { updateSingleSection(key, isLoadingFlag); } }); }
        else { updateSingleSection(sectionKey, isLoadingFlag); }
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
        try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests, total_study_seconds, weakest_topic_name').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats Fetch] Supabase error fetching user_stats:", statsError.message); } } catch (error) { console.error("[Stats Fetch] Exception fetching user_stats:", error); statsError = error; }
        const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0, total_study_seconds: fetchedStats?.total_study_seconds ?? 0, weakest_topic_name: fetchedStats?.weakest_topic_name ?? null, };
        if (statsError && fetchedStats === null) { console.warn("[Stats Fetch] Returning stats based primarily on profile due to fetch error."); } else { console.log("[Stats Fetch] Dashboard stats fetched/compiled:", finalStats); }
        return finalStats;
     }
    async function fetchDiagnosticResults(userId, goal) {
         if (!supabase || !userId) return []; console.log(`[Tests Fetch] Fetching diagnostic results for user ${userId}, goal: ${goal}...`);
         try { const { data, error } = await supabase.from('user_diagnostics').select('id, completed_at, total_score, total_questions, time_spent').eq('user_id', userId).order('completed_at', { ascending: false }); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching diagnostic results:", err); return []; }
     }
    async function fetchActiveStudyPlan(userId, goal) {
         if (!supabase || !userId) return null; console.log(`[Plan Fetch] Fetching active study plan for user ${userId}, goal: ${goal}...`);
         try { let query = supabase.from('study_plans').select('id, title, created_at').eq('user_id', userId).eq('status', 'active'); query = query.order('created_at', { ascending: false }).limit(1); const { data: plans, error } = await query; if (error) throw error; return plans?.[0] || null; } catch (err) { console.error("Error fetching active study plan:", err); return null; }
     }
    async function fetchPlanActivities(planId, goal) {
        if (!planId || !supabase) return []; console.log(`[Plan Activities Fetch] Fetching activities for plan ${planId}, goal: ${goal}...`);
        try { let query = supabase.from('plan_activities').select('id, title, day_of_week, time_slot, completed, description, type').eq('plan_id', planId); query = query.order('day_of_week').order('time_slot'); const { data, error } = await query; if (error) throw error; return data || []; } catch (err) { console.error("Error fetching plan activities:", err); return []; }
    }
    async function fetchTopicProgress(userId, goal) {
        if (!supabase || !userId) return []; console.log(`[Topics Fetch] Fetching topic progress for user ${userId}, goal: ${goal}...`);
        try {
            let query = supabase.from('user_topic_progress').select(` topic_id, progress, strength, questions_attempted, questions_correct, topic:exam_topics!inner( name, subject, is_exam_topic ) `).eq('user_id', userId);
            if (goal === 'exam_prep') { query = query.eq('topic.is_exam_topic', true); console.log("[Topics Fetch] Filtering for exam topics."); }
            else if (goal === 'math_accelerate' || goal === 'math_review') { query = query.eq('topic.is_exam_topic', false); console.log("[Topics Fetch] Filtering for non-exam (math learning) topics."); }
            else { console.log("[Topics Fetch] Fetching all topics (explore or default)."); }
            const { data, error } = await query; if (error) throw error; console.log(`[Topics Fetch] Fetched ${data?.length} topics for goal ${goal}.`); return data || [];
        } catch (err) { console.error("Error fetching topic progress:", err); if (err.message?.includes('column exam_topics.is_exam_topic does not exist')) { console.warn("Column 'is_exam_topic' not found. Fetching all topics instead."); try { const { data: allData, error: allError } = await supabase.from('user_topic_progress').select(` topic_id, progress, strength, questions_attempted, questions_correct, topic:exam_topics!inner( name, subject ) `).eq('user_id', userId); if (allError) throw allError; return allData || []; } catch (fallbackErr) { console.error("Error fetching all topics after fallback:", fallbackErr); return []; } } return []; }
    }
    // --- Конец Загрузки Данных ---

    // --- Рендеринг UI ---
    function renderStatsCards(stats) {
         const container = ui.statsCards;
         if (!container) { console.warn("[Render Stats] Container #stats-cards not found."); return; }
         console.log("[Render Stats] Rendering stats cards with data:", stats);
         container.innerHTML = ''; // Clear skeletons
         if (!stats) { container.innerHTML = '<p class="error-message-inline">Statistiky nelze načíst.</p>'; container.classList.remove('loading'); return; }
         const completedTotal = (stats.completed_exercises || 0) + (stats.completed_tests || 0);
         const avgScore = calculateAverageScore(diagnosticResultsData);
         const timeSpentFormatted = formatTime(stats.total_study_seconds ?? 0);
         const weakestTopicName = stats.weakest_topic_name || topicProgressData?.filter(t => t.strength === 'weakness').sort((a, b) => (a.progress ?? 100) - (b.progress ?? 100))[0]?.topic?.name || '-';

         container.innerHTML = `
             <div class="dashboard-card card" data-animate style="--animation-order: 2;"> <div class="card-header"> <h3 class="card-title">Dokončeno</h3> </div> <div class="card-content"> <div class="card-value">${completedTotal}</div> <p class="card-description">Celkový počet úkolů</p> </div> <div class="card-footer"><i class="fas fa-check"></i> Cvičení: ${stats.completed_exercises || 0}, Testů: ${stats.completed_tests || 0}</div> </div>
             <div class="dashboard-card card" data-animate style="--animation-order: 3;"> <div class="card-header"> <h3 class="card-title">Průměrné Skóre</h3> </div> <div class="card-content"> <div class="card-value">${avgScore}%</div> <p class="card-description">V diagnostických testech</p> </div> <div class="card-footer"><i class="fas fa-poll"></i> V ${diagnosticResultsData.length} testech</div> </div>
             <div class="dashboard-card card" data-animate style="--animation-order: 4;"> <div class="card-header"> <h3 class="card-title">Čas Cvičení</h3> </div> <div class="card-content"> <div class="card-value">${timeSpentFormatted}</div> <p class="card-description">Celkem stráveno učením</p> </div> <div class="card-footer"><i class="fas fa-hourglass-half"></i> Za celou dobu</div> </div>
             <div class="dashboard-card card" data-animate style="--animation-order: 5;"> <div class="card-header"> <h3 class="card-title">Nejslabší Téma</h3> </div> <div class="card-content"> <div class="card-value" style="font-size: 1.8rem;">${sanitizeHTML(weakestTopicName)}</div> <p class="card-description">Oblast s nejnižší úspěšností</p> </div> <div class="card-footer"><i class="fas fa-atom"></i> Poslední analýza</div> </div>
             `;
         container.classList.remove('loading');
         initScrollAnimations();
     }
    function calculateAverageScore(results) { if (!results || results.length === 0) return '-'; const validScores = results.filter(r => typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0); if (validScores.length === 0) return '-'; const avgPercentage = validScores.reduce((sum, r) => sum + (r.total_score / r.total_questions) * 100, 0) / validScores.length; return Math.round(avgPercentage); }
    function renderTestChart(chartData) { /* ... keep existing ... */ }
    function renderTestResults(results, goal) {
         console.log(`[Tests Render] Rendering test results for goal: ${goal}`);
         const container = ui.testResultsContainer; const contentEl = ui.testResultsContent; const emptyEl = ui.testResultsEmpty; const startBtn = ui.startTestBtnResults;
         if (!contentEl || !emptyEl || !startBtn || !container) { console.warn("Missing elements for renderTestResults"); setLoadingState('tests', false); return; }
         const titleElement = container.querySelector('.section-title'); if (titleElement) { titleElement.innerHTML = '<i class="fas fa-poll"></i>Výsledky Diagnostiky'; }
         contentEl.innerHTML = ''; contentEl.style.display = 'none'; emptyEl.style.display = 'none'; startBtn.style.display = 'inline-flex';
         if (!results || results.length === 0) { emptyEl.style.display = 'block'; } else { contentEl.style.display = 'block'; /* ... render logic ... */ } setLoadingState('tests', false); initScrollAnimations();
    }
    function renderStudyPlanOverview(plan, activities, goal) {
         console.log(`[Plan Render] Rendering plan overview for goal: ${goal}`);
         const container = ui.studyPlanContainer; const contentEl = ui.studyPlanContent; const emptyEl = ui.studyPlanEmpty; const startBtn = ui.startTestBtnPlan; const scheduleGrid = ui.mainPlanSchedule;
         if (!contentEl || !emptyEl || !startBtn || !container || !scheduleGrid) { console.warn("Missing elements for renderStudyPlanOverview"); setLoadingState('plan', false); return; }
         const titleElement = container.querySelector('.section-title'); if (titleElement) { titleElement.innerHTML = '<i class="fas fa-route"></i>Aktuální Studijní Plán'; }
         scheduleGrid.innerHTML = ''; contentEl.style.display = 'none'; emptyEl.style.display = 'none';
         if (!plan) { emptyEl.style.display = 'block'; startBtn.style.display = 'inline-flex'; } else { contentEl.style.display = 'block'; startBtn.style.display = 'none'; /* ... render schedule grid logic ... */ } setLoadingState('plan', false); initScrollAnimations();
     }
    function renderTopicAnalysis(topics, goal) {
         console.log(`[Topics Render] Rendering topic analysis for goal: ${goal}`);
         const container = ui.topicAnalysisContainer; const contentEl = ui.topicAnalysisContent; const emptyEl = ui.topicAnalysisEmpty; const topicGrid = ui.topicGrid; const startBtn = ui.startTestBtnAnalysis;
         if (!contentEl || !emptyEl || !topicGrid || !startBtn || !container) { console.warn("Missing elements for renderTopicAnalysis"); setLoadingState('topics', false); return; }
         const titleElement = container.querySelector('.section-title'); if (titleElement) { titleElement.innerHTML = '<i class="fas fa-atom"></i>Analýza podle Témat'; }
         topicGrid.innerHTML = ''; contentEl.style.display = 'none'; emptyEl.style.display = 'none';
         if (!topics || topics.length === 0) { emptyEl.style.display = 'block'; startBtn.style.display = 'inline-flex'; } else { contentEl.style.display = 'block'; startBtn.style.display = 'none'; /* ... render topic grid logic ... */ }
         setLoadingState('topics', false); initScrollAnimations();
    }
    // --- Конец Рендеринга UI ---

    // --- START: Goal Selection Logic (Multi-Step) ---
    function showGoalSelectionModal() {
        const modal = ui.goalSelectionModal; const step1 = ui.goalStep1; if (!modal || !step1) { console.error("Modal #goal-selection-modal or #goal-step-1 not found!"); return; } console.log("Showing goal selection modal (Step 1)...");
        modal.querySelectorAll('.modal-step').forEach(step => step.classList.remove('active')); step1.classList.add('active'); modal.style.display = 'flex'; requestAnimationFrame(() => modal.classList.add('active'));
        const optionButtons = step1.querySelectorAll('.goal-option-card'); optionButtons.forEach(button => { const goal = button.dataset.goal; const handler = () => handleInitialGoalSelection(goal); button.removeEventListener('click', button._goalHandler); button.addEventListener('click', handler); button._goalHandler = handler; }); console.log("Goal selection step 1 listeners attached.");
    }
    function handleInitialGoalSelection(selectedGoal) { if (goalSelectionInProgress) return; console.log(`Initial goal selected: ${selectedGoal}`); pendingGoal = selectedGoal; if (selectedGoal === 'exam_prep') { saveGoalAndProceed(selectedGoal); } else { showStep2(selectedGoal); } }
    function showStep2(goalType) { const modal = ui.goalSelectionModal; const step1 = ui.goalStep1; const step2Id = `goal-step-${goalType.replace('math_', '')}`; const step2 = document.getElementById(step2Id); if (!modal || !step1 || !step2) { console.error(`Cannot show step 2: Modal or step element not found (Step1: ${!!step1}, Step2 ID: ${step2Id}, Found: ${!!step2})`); return; } console.log(`Showing goal selection modal (Step 2: ${goalType})...`); step1.classList.remove('active'); step2.classList.add('active'); const backBtn = step2.querySelector('.modal-back-btn'); if (backBtn) { const backHandler = () => handleBackToStep1(step1, step2); backBtn.removeEventListener('click', backHandler); backBtn.addEventListener('click', backHandler, { once: true }); } const confirmBtn = step2.querySelector('.modal-confirm-btn'); if (confirmBtn) { const confirmHandler = () => handleStep2Confirm(goalType); confirmBtn.removeEventListener('click', confirmHandler); confirmBtn.addEventListener('click', confirmHandler); } }
    function handleBackToStep1(step1, currentStep2) { console.log("Going back to step 1..."); if(currentStep2) currentStep2.classList.remove('active'); if(step1) step1.classList.add('active'); pendingGoal = null; }
    function handleStep2Confirm(goalType) { if (goalSelectionInProgress) return; const step2Id = `goal-step-${goalType.replace('math_', '')}`; const step2Element = document.getElementById(step2Id); if (!step2Element) { console.error(`Step 2 element ${step2Id} not found during confirm.`); return; } const details = {}; let isValid = true; if (goalType === 'math_accelerate') { details.accelerate_areas = Array.from(step2Element.querySelectorAll('input[name="accelerate_area"]:checked')).map(cb => cb.value); const reasonRadio = step2Element.querySelector('input[name="accelerate_reason"]:checked'); details.accelerate_reason = reasonRadio ? reasonRadio.value : null; if(details.accelerate_areas.length === 0) { showToast("Chyba", "Vyberte prosím alespoň jednu oblast zájmu.", "warning"); isValid = false; } if(!details.accelerate_reason) { showToast("Chyba", "Vyberte prosím důvod.", "warning"); isValid = false; } } else if (goalType === 'math_review') { details.review_areas = Array.from(step2Element.querySelectorAll('input[name="review_area"]:checked')).map(cb => cb.value); } else if (goalType === 'math_explore') { const levelRadio = step2Element.querySelector('input[name="explore_level"]:checked'); details.explore_level = levelRadio ? levelRadio.value : null; if(!details.explore_level) { showToast("Chyba", "Vyberte prosím vaši úroveň.", "warning"); isValid = false; } } if (isValid) { console.log(`Step 2 details collected for ${goalType}:`, details); saveGoalAndProceed(pendingGoal, details); } }
    async function saveGoalAndProceed(goal, details = null) {
         const modal = ui.goalSelectionModal; if (goalSelectionInProgress || !goal) return; goalSelectionInProgress = true; setLoadingState('goalSelection', true);
         console.log(`Saving goal: ${goal}, with details:`, details);
         const confirmButton = document.querySelector(`.modal-step.active .modal-confirm-btn`); const backButton = document.querySelector(`.modal-step.active .modal-back-btn`);
         if (confirmButton) { confirmButton.disabled = true; confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...'; } if (backButton) backButton.disabled = true;
         try { if (!supabase || !currentUser) throw new Error("Supabase client or user not available."); const updatePayload = { learning_goal: goal, updated_at: new Date().toISOString() }; let finalPreferences = currentProfile.preferences || {}; if (details) { finalPreferences = { ...finalPreferences, goal_details: details }; } updatePayload.preferences = finalPreferences; const { data, error } = await supabase.from('profiles').update(updatePayload).eq('id', currentUser.id).select('*').single(); if (error) throw error; currentProfile = data; console.log("Learning goal and preferences saved successfully:", currentProfile.learning_goal, currentProfile.preferences); let goalText = goal; /* ... set goalText ... */ showToast('Cíl uložen!', `Váš cíl byl nastaven na: ${goalText}.`, 'success'); if (modal) { modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); } configureUIForGoal(goal); await loadPageData(); if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled'); } catch (error) { console.error("Error saving goal/preferences:", error); showToast('Chyba', 'Nepodařilo se uložit váš cíl.', 'error'); if (confirmButton) { confirmButton.disabled = false; confirmButton.innerHTML = 'Potvrdit a pokračovat'; } if (backButton) backButton.disabled = false; } finally { goalSelectionInProgress = false; setLoadingState('goalSelection', false); pendingGoal = null; }
     }
    // --- END: Goal Selection Logic ---

    // --- Рендеринг Ярлыков ---
    function renderShortcutsForGoal(goal, container) {
        if (!container) return; setLoadingState('shortcuts', true); container.innerHTML = ''; console.log(`Rendering shortcuts for goal: ${goal}`); let shortcutsHTML = '';
        const shortcutTest = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-graduation-cap"></i></div><h3 class="shortcut-title">Diagnostický Test</h3><p class="shortcut-desc">Ověřte své znalosti pro přijímačky.</p><a href="/dashboard/procvicovani/test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Test</a></div>`;
        const shortcutPlan = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-tasks"></i></div><h3 class="shortcut-title">Studijní Plán</h3><p class="shortcut-desc">Zobrazte si svůj personalizovaný plán.</p><a href="/dashboard/procvicovani/plan.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Zobrazit Plán</a></div>`;
        const shortcutTutor = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-book-open"></i></div><h3 class="shortcut-title">AI Tutor (Lekce)</h3><p class="shortcut-desc">Nechte si vysvětlit témata z plánu nebo osnovy.</p><a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a></div>`;
        const shortcutNextTopic = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-forward"></i></div><h3 class="shortcut-title">Další Téma Osnovy</h3><p class="shortcut-desc">Pokračujte v učení podle standardní osnovy.</p><a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Učit se Další</a></div>`;
        const shortcutCurriculum = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-stream"></i></div><h3 class="shortcut-title">Přehled Osnovy</h3><p class="shortcut-desc">Zobrazte si přehled témat dle školní osnovy.</p><a href="/dashboard/procvicovani/plan.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Osnovu</a></div>`;
        const shortcutWeakness = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-search"></i></div><h3 class="shortcut-title">Moje Slabiny</h3><p class="shortcut-desc">Zobrazte témata, kde potřebujete nejvíce zlepšení.</p><a href="#topic-analysis-tab" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="document.querySelector('.content-tab[data-tab=topic-analysis-tab]').click()">Analýza Témat</a></div>`;
        const shortcutReview = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-history"></i></div><h3 class="shortcut-title">Opakování</h3><p class="shortcut-desc">Procvičte si témata, která jste dlouho neprobírali.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="alert('Funkce opakování zatím není implementována.'); return false;">Spustit Opakování</a></div>`;
        const shortcutExplore = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-compass"></i></div><h3 class="shortcut-title">Procházet Témata</h3><p class="shortcut-desc">Vyberte si libovolné matematické téma k učení.</p><a href="#topic-analysis-tab" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="document.querySelector('.content-tab[data-tab=topic-analysis-tab]').click()">Vybrat Téma</a></div>`;
        const shortcutRandom = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-dumbbell"></i></div><h3 class="shortcut-title">Náhodné Cvičení</h3><p class="shortcut-desc">Spusťte náhodné cvičení pro rychlé procvičení.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="alert('Funkce náhodného cvičení zatím není implementována.'); return false;">Náhodné Cvičení</a></div>`;
        const shortcutProgress = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-chart-line"></i></div><h3 class="shortcut-title">Můj Pokrok</h3><p class="shortcut-desc">Sledujte své zlepšení v matematice.</p><a href="/dashboard/pokrok.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Pokrok</a></div>`;

        switch (goal) {
            case 'exam_prep': shortcutsHTML = shortcutTest + shortcutPlan + shortcutTutor; break;
            case 'math_accelerate': shortcutsHTML = shortcutNextTopic + shortcutCurriculum + shortcutTutor; break;
            case 'math_review': shortcutsHTML = shortcutWeakness + shortcutReview + shortcutTutor; break;
            case 'math_explore': shortcutsHTML = shortcutExplore + shortcutRandom + shortcutTutor; break;
            default: shortcutsHTML = shortcutProgress + shortcutTutor + shortcutRandom;
        }
        container.innerHTML = shortcutsHTML; container.classList.remove('loading'); setLoadingState('shortcuts', false); initScrollAnimations();
    }
     // Fallback
     if (typeof window.renderShortcuts === 'undefined') { window.renderShortcuts = function() { console.warn("Using fallback renderShortcuts in main.js"); if(ui.shortcutsGrid) renderShortcutsForGoal(currentProfile?.learning_goal || 'exam_prep', ui.shortcutsGrid); } }
    // --- Конец Рендеринга Ярлыков ---

    // --- Конфигурация UI ---
    function configureUIForGoal(goal) {
        console.log(`Configuring UI for goal: ${goal}`);
        const isExamPrep = goal === 'exam_prep';

        // 1. Заголовок (если нужно)
        // if (ui.dashboardTitle) { /* ... */ }

        // 2. Ярлыки
        if (ui.shortcutsGrid) { renderShortcutsForGoal(goal, ui.shortcutsGrid); }
        else { console.warn("Shortcuts grid not found for configuration."); }

        // 3. Вкладки
        const testTabButton = document.querySelector('.content-tab[data-tab="test-results-tab"]');
        const planTabButton = document.querySelector('.content-tab[data-tab="study-plan-tab"]');
        const topicAnalysisButton = document.querySelector('.content-tab[data-tab="topic-analysis-tab"]');
        const practiceTabButton = document.querySelector('.content-tab[data-tab="practice-tab"]');

        if (testTabButton) testTabButton.style.display = isExamPrep ? 'flex' : 'none';
        if (planTabButton) planTabButton.style.display = (isExamPrep || goal === 'math_accelerate') ? 'flex' : 'none';
        if (topicAnalysisButton) topicAnalysisButton.style.display = 'flex'; // Показываем всегда?
        if (practiceTabButton) practiceTabButton.style.display = 'flex'; // Показываем всегда?

        // 4. Активация вкладки
        const activeTab = document.querySelector('.content-tab.active');
        if (activeTab && window.getComputedStyle(activeTab).display === 'none') {
             console.log("Active tab is hidden, switching...");
             const firstVisibleTab = document.querySelector('.content-tab:not([style*="display: none"])');
             if (firstVisibleTab) { handleTabSwitch({ currentTarget: firstVisibleTab }); }
             else if (practiceTabButton && window.getComputedStyle(practiceTabButton).display !== 'none') { handleTabSwitch({ currentTarget: practiceTabButton }); }
             else { console.warn("No visible tabs found."); }
        } else if (!activeTab) { // Если ни одна не активна
             const firstVisibleTab = document.querySelector('.content-tab:not([style*="display: none"])');
             if (firstVisibleTab) { handleTabSwitch({ currentTarget: firstVisibleTab }); }
        }
        console.log(`UI configured for goal: ${goal}`);
    }
    // --- Конец Конфигурации UI ---

    // --- Загрузка Основных Данных Страницы ---
    async function loadPageData() {
        const goal = currentProfile?.learning_goal;
        if (!goal) { console.warn("[Load Page Data] Learning goal not set. Showing modal."); showGoalSelectionModal(); setLoadingState('all', false); if(ui.mainContent) ui.mainContent.classList.add('show-modal-overlay'); document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none'); if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'none'; return; }
        if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; if(ui.mainContent) ui.mainContent.classList.remove('show-modal-overlay');
        if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'block'; document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'block'); // Show tab content containers again

        if (!currentUser || !currentProfile || !supabase) { showError("Chyba: Nelze načíst data.", true); setLoadingState('all', false); return; }
        console.log(`🔄 [Load Page Data] Loading data for goal: ${goal}...`); setLoadingState('all', true); hideError();

        // Render skeletons for relevant sections early
        if(ui.statsCards) renderStatsSkeletons(ui.statsCards);
        configureUIForGoal(goal); // Ensure UI is configured (renders shortcuts)
        if(ui.testResultsContainer?.style.display !== 'none' && ui.testResultsContent) renderTestSkeletons(ui.testResultsContent);
        if(ui.studyPlanContainer?.style.display !== 'none' && ui.studyPlanContent) renderPlanSkeletons(ui.studyPlanContent);
        if(ui.topicAnalysisContainer?.style.display !== 'none' && ui.topicAnalysisContent) renderTopicSkeletons(ui.topicAnalysisContent);

        try {
            const stats = await fetchDashboardStats(currentUser.id, currentProfile); userStatsData = stats; renderStatsCards(userStatsData);
            const promisesToAwait = [];
            if (goal === 'exam_prep' && ui.testResultsContainer?.style.display !== 'none') { promisesToAwait.push(fetchDiagnosticResults(currentUser.id, goal).then(r => { diagnosticResultsData = r || []; renderTestResults(diagnosticResultsData, goal); })); } else { setLoadingState('tests', false); if(ui.testResultsContent) ui.testResultsContent.innerHTML=''; }
            if ((goal === 'exam_prep' || goal === 'math_accelerate') && ui.studyPlanContainer?.style.display !== 'none') { promisesToAwait.push(fetchActiveStudyPlan(currentUser.id, goal).then(async (p) => { studyPlanData = p || null; planActivitiesData = studyPlanData ? await fetchPlanActivities(studyPlanData.id, goal) : []; renderStudyPlanOverview(studyPlanData, planActivitiesData, goal); })); } else { setLoadingState('plan', false); if(ui.studyPlanContent) ui.studyPlanContent.innerHTML=''; }
            if (ui.topicAnalysisContainer?.style.display !== 'none') { promisesToAwait.push(fetchTopicProgress(currentUser.id, goal).then(t => { topicProgressData = t || []; renderTopicAnalysis(topicProgressData, goal); })); } else { setLoadingState('topics', false); if(ui.topicAnalysisContent) ui.topicAnalysisContent.innerHTML=''; }
            await Promise.allSettled(promisesToAwait);
            if (goal === 'exam_prep') { /* Show/hide diagnostic prompt */ if (diagnosticResultsData.length === 0 && ui.diagnosticPrompt) { ui.diagnosticPrompt.style.display = 'flex'; if(ui.testResultsEmpty) ui.testResultsEmpty.style.display = 'none'; if(ui.studyPlanEmpty) ui.studyPlanEmpty.style.display = 'none'; if(ui.topicAnalysisEmpty) ui.topicAnalysisEmpty.style.display = 'none'; } else if (ui.diagnosticPrompt) { ui.diagnosticPrompt.style.display = 'none'; } } else if (ui.diagnosticPrompt) { ui.diagnosticPrompt.style.display = 'none'; }
            console.log("✅ [Load Page Data] All relevant data loaded and rendered for goal:", goal);
        } catch (error) { console.error("❌ [Load Page Data] Error loading page data:", error); showError(`Nepodařilo se načíst data: ${error.message}`, true); renderStatsCards(null); if(ui.testResultsContainer?.style.display !== 'none') renderTestResults([], goal); if(ui.studyPlanContainer?.style.display !== 'none') renderStudyPlanOverview(null, [], goal); if(ui.topicAnalysisContainer?.style.display !== 'none') renderTopicAnalysis([], goal); }
        finally { setLoadingState('all', false); initTooltips(); }
    }
    // --- Конец Загрузки Данных Страницы ---

    // --- Event Handlers ---
    function handleTabSwitch(event) {
        const tabButton = event.currentTarget; const tabId = tabButton?.dataset?.tab; if (!tabId || !ui.contentTabs) return; console.log(`[UI TabSwitch] Switching to tab: ${tabId}`); ui.contentTabs.forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); tabButton.classList.add('active'); const activeContent = document.getElementById(tabId); if (activeContent) { activeContent.classList.add('active'); requestAnimationFrame(() => { activeContent.querySelectorAll('[data-animate]').forEach(el => el.classList.remove('animated')); initScrollAnimations(); }); } else { console.warn(`[UI TabSwitch] Content for tab ${tabId} not found!`); const firstContent = document.querySelector('.tab-content'); if (firstContent) firstContent.classList.add('active'); } if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
    async function handleRefreshClick() {
        if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(s => s === true)) { showToast('Info','Data se již načítají.', 'info'); return; } const refreshBtn = ui.refreshDataBtn; const icon = refreshBtn?.querySelector('i'); const text = refreshBtn?.querySelector('.refresh-text'); if(refreshBtn) refreshBtn.disabled = true; if(icon) icon.classList.add('fa-spin'); if(text) text.textContent = 'RELOADING...'; await loadPageData(); if(refreshBtn) refreshBtn.disabled = false; if(icon) icon.classList.remove('fa-spin'); if(text) text.textContent = 'RELOAD'; initTooltips();
    }
    // --- Конец Event Handlers ---

    // --- Настройка Event Listeners ---
    function setupEventListeners() {
        console.log("[Procvičování SETUP] Setting up event listeners...");
        const safeAddListener = (element, eventType, handler, key) => { if (element) { element.addEventListener(eventType, handler); } else { console.warn(`[SETUP] Element not found for listener: ${key}`); } };
        const safeAddListenerToAll = (elementsNodeList, eventType, handler, key) => { if (elementsNodeList && elementsNodeList.length > 0) { elementsNodeList.forEach(el => el.addEventListener(eventType, handler)); } else { console.warn(`[SETUP] No elements found for listener group: ${key}`); } };
        safeAddListener(ui.refreshDataBtn, 'click', handleRefreshClick, 'refreshDataBtn');
        safeAddListenerToAll(ui.contentTabs, 'click', handleTabSwitch, 'contentTabs');
        safeAddListener(ui.startTestBtnPrompt, 'click', () => window.location.href = 'test1.html', 'startTestBtnPrompt');
        safeAddListener(ui.startTestBtnResults, 'click', () => window.location.href = 'test1.html', 'startTestBtnResults');
        safeAddListener(ui.startTestBtnPlan, 'click', () => window.location.href = 'test1.html', 'startTestBtnPlan');
        safeAddListener(ui.startTestBtnAnalysis, 'click', () => window.location.href = 'test1.html', 'startTestBtnAnalysis');
        // Listeners for modal buttons are added dynamically in showGoalSelectionModal / showStep2
        console.log("[Procvičování SETUP] Event listeners set up.");
    }
    // --- Конец Настройки Event Listeners ---

    // --- Инициализация Приложения ---
    async function initializeApp() {
        console.log("[INIT Procvičování] App Init Start...");
        cacheDOMElements(); // Cache first

        // Инициализация Supabase
        if (!window.supabase?.createClient) { showError("Kritická chyba: Supabase knihovna nenalezena.", true); return; }
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        if (!supabase) { showError("Kritická chyba: Nepodařilo se inicializovat Supabase.", true); return; }
        console.log("[INIT Procvičování] Supabase client initialized.");

        // Базовая настройка UI (должна быть до проверки auth, если влияет на отображение)
        if (typeof applyInitialSidebarState === 'function') applyInitialSidebarState(); else console.warn("applyInitialSidebarState missing");
        setupEventListeners(); // Настройка обработчиков
        if (typeof updateCopyrightYear === 'function') updateCopyrightYear(); else console.warn("updateCopyrightYear missing");
        if (typeof initMouseFollower === 'function') initMouseFollower(); else console.warn("initMouseFollower missing");
        if (typeof initHeaderScrollDetection === 'function') initHeaderScrollDetection(); else console.warn("initHeaderScrollDetection missing");
        if (typeof updateOnlineStatus === 'function') updateOnlineStatus(); else console.warn("updateOnlineStatus missing");
        window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus); // Add global listeners here

        if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
        if (ui.mainContent) ui.mainContent.style.display = 'none'; // Скрываем основной контент
         if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none'; // Скрываем табы
         document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none'); // Скрываем панели


        try {
            console.log("[INIT Procvičování] Checking auth session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Session error: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;
                console.log(`[INIT Procvičování] User authenticated (ID: ${currentUser.id}). Loading profile & titles...`);

                // Fetch profile and titles concurrently
                const [profileResult, titlesResult] = await Promise.allSettled([
                    supabase.from('profiles').select('*, selected_title, preferences').eq('id', currentUser.id).single(), // Fetch preferences too
                    supabase.from('title_shop').select('title_key, name') // Fetch only needed fields
                ]);

                if (profileResult.status === 'fulfilled' && profileResult.value?.data) {
                    currentProfile = profileResult.value.data;
                     if (!currentProfile.preferences) currentProfile.preferences = {}; // Initialize preferences if null
                    console.log("[INIT Procvičování] Profile loaded:", currentProfile);
                } else {
                     const profileError = profileResult.reason || profileResult.value?.error;
                     if(profileError?.code === 'PGRST116') { // Profile not found
                          console.warn("[INIT Procvičování] Profile not found, creating default...");
                          const {data: defaultProfile, error: createError} = await supabase.from('profiles').insert({id: currentUser.id, email: currentUser.email, username: currentUser.email?.split('@')[0] || `user_${currentUser.id.substring(0,6)}`, preferences: {}}).select('*, selected_title, preferences').single();
                          if(createError) throw new Error(`Failed to create default profile: ${createError.message}`);
                          currentProfile = defaultProfile;
                          console.log("[INIT Procvičování] Default profile created.");
                     } else {
                          throw new Error(`Failed to fetch profile: ${profileError?.message || 'Unknown error'}`);
                     }
                }

                if (titlesResult.status === 'fulfilled') { allTitles = titlesResult.value?.data || []; console.log("[INIT Procvičování] Titles loaded:", allTitles.length); }
                else { console.warn("[INIT Procvičování] Failed to load titles:", titlesResult.reason); allTitles = []; }

                // Update sidebar (important to do this early)
                 if (typeof updateSidebarProfile === 'function') {
                     updateSidebarProfile(currentProfile, allTitles);
                 }

                // --- Goal Check ---
                if (!currentProfile.learning_goal) {
                    console.log("[INIT Procvičování] Goal not set, showing modal.");
                    showGoalSelectionModal();
                    setLoadingState('all', false);
                    if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show main area for modal
                     if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none'; // Hide tabs
                     document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none'); // Hide panes
                } else {
                    console.log(`[INIT Procvičování] Goal found: ${currentProfile.learning_goal}. Loading data...`);
                    if(ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none';
                    if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'block'; // Show tabs
                    configureUIForGoal(currentProfile.learning_goal); // Configure UI first
                    await loadPageData(); // Load data based on the existing goal
                }
                // --- End Goal Check ---

                if (ui.mainContent && window.getComputedStyle(ui.mainContent).display === 'none') { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
                initTooltips();

                console.log("✅ [INIT Procvičování] Page specific setup complete.");

            } else { console.log('[INIT Procvičování] User not logged in, redirecting...'); window.location.href = '/auth/index.html'; }
        } catch (error) {
            console.error("❌ [INIT Procvičování] Critical initialization error:", error);
            showError(`Chyba inicializace: ${error.message}`, true);
            if (ui.mainContent) ui.mainContent.style.display = 'block';
            setLoadingState('all', false);
        } finally {
             const il = ui.initialLoader;
             if (il && !il.classList.contains('hidden')) { il.classList.add('hidden'); setTimeout(() => { if(il) il.style.display = 'none'; }, 300); }
        }
    }
    // --- Конец Инициализации ---

    // --- Запуск ---
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeApp); }
    else { initializeApp(); }

})(); // End IIFE