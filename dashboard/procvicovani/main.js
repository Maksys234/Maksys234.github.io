// dashboard/procvicovani/main.js
// Version: 24.7 - Fixed SyntaxError, added full shortcut rendering, refined goal logic

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
    let pendingGoal = null; // Store the initially selected goal

    // --- Кэш UI Элементов ---
    const ui = {}; // Populated by cacheDOMElements

    function cacheDOMElements() {
        console.log("[Procvičování Cache DOM] Caching elements...");
        const ids = [
            'diagnostic-prompt', 'start-test-btn-prompt', 'stats-cards', 'shortcuts-grid',
            'test-results-container', 'test-results-loading', 'test-results-content',
            'test-results-empty', 'start-test-btn-results',
            // 'testsChart', // No chart canvas in main.html
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
            'dashboard-title', 'notification-bell', 'notification-count',
            'notifications-dropdown', 'notifications-list', 'no-notifications-msg',
            'mark-all-read', 'currentYearFooter', 'mouse-follower'
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
    const topicIcons = { "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon", "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar", "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar", "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book" };
    const activityVisuals = { test: { name: 'Test', icon: 'fa-vial', class: 'test' }, exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' }, badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' }, diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' }, plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' }, other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' }, default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' } };

    // --- Вспомогательные функции (Fallbacks/Definitions) ---
    const showToast = window.showToast || function(t, m, ty) { console.log(`[Toast Fallback] ${ty}: ${t} - ${m}`); };
    const showError = window.showError || function(m, g) { console.error(`[Error Fallback] Global=${g}: ${m}`); const ge = ui.globalError; if (g && ge) { ge.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(m)}</div><button class="retry-button btn" onclick="location.reload()">Obnovit</button></div>`; ge.style.display = 'block'; } else { showToast("CHYBA", m, 'error'); } };
    const hideError = window.hideError || function() { if (ui.globalError) ui.globalError.style.display = 'none'; };
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

    // --- Управление состоянием загрузки ---
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
                 const skeletonSelector = '.loading-skeleton';
                 if (content?.querySelector(skeletonSelector)) content.innerHTML = '';
                 if (container?.querySelector(skeletonSelector) && !['stats', 'shortcuts'].includes(key)) container.innerHTML = '';

                 if (content && empty) {
                     const hasContent = content.innerHTML.trim() !== '' && !content.querySelector('.loading-skeleton');
                     content.style.display = hasContent ? (content.id === 'topic-grid' || content.id === 'stats-cards' || content.id === 'shortcuts-grid' ? 'grid' : 'block') : 'none';
                     empty.style.display = hasContent ? 'none' : 'block';
                 }
            }
            if (key === 'notifications' && ui.notificationBell) {
                ui.notificationBell.style.opacity = loading ? 0.5 : 1;
                if (ui.markAllReadBtn) { const count = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = loading || count === 0; }
            }
        };
        if (sectionKey === 'all') { Object.keys(isLoading).forEach(key => { if (key !== 'all' && key !== 'goalSelection') { updateSingleSection(key, isLoadingFlag); } }); }
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
    async function fetchDashboardStats(userId, profileData) { /* ... keep existing ... */ }
    async function fetchDiagnosticResults(userId, goal) { /* ... keep existing ... */ }
    async function fetchActiveStudyPlan(userId, goal) { /* ... keep existing ... */ }
    async function fetchPlanActivities(planId, goal) { /* ... keep existing ... */ }
    async function fetchTopicProgress(userId, goal) { /* ... keep existing ... */ }
    // --- Конец Загрузки Данных ---

    // --- Рендеринг UI ---
    function renderStatsCards(stats) { /* ... keep existing ... */ }
    function calculateAverageScore(results) { /* ... keep existing ... */ }
    function renderTestChart(chartData) { /* ... keep existing ... */ }
    function renderTestResults(results, goal) { /* ... keep existing ... */ }
    function renderStudyPlanOverview(plan, activities, goal) { /* ... keep existing ... */ }
    function renderTopicAnalysis(topics, goal) { /* ... keep existing ... */ }
    // --- Конец Рендеринга UI ---

    // --- START: Goal Selection Logic (Multi-Step) ---

    /**
     * Показывает первый шаг модального окна выбора цели.
     */
    function showGoalSelectionModal() {
        const modal = ui.goalSelectionModal;
        const step1 = ui.goalStep1;
        if (!modal || !step1) { console.error("Modal #goal-selection-modal or #goal-step-1 not found!"); return; }
        console.log("Showing goal selection modal (Step 1)...");

        modal.querySelectorAll('.modal-step').forEach(step => step.classList.remove('active'));
        step1.classList.add('active');
        modal.style.display = 'flex';
        requestAnimationFrame(() => modal.classList.add('active'));

        const optionButtons = step1.querySelectorAll('.goal-option-card');
        optionButtons.forEach(button => {
            const goal = button.dataset.goal;
            // Ensure a proper handler reference for removal
            const handler = () => handleInitialGoalSelection(goal);
            button.removeEventListener('click', button._goalHandler); // Remove previous if stored
            button.addEventListener('click', handler);
            button._goalHandler = handler; // Store reference for removal
        });
        console.log("Goal selection step 1 listeners attached.");
    }

    /**
     * Обрабатывает выбор на первом шаге.
     */
    function handleInitialGoalSelection(selectedGoal) {
        if (goalSelectionInProgress) return;
        console.log(`Initial goal selected: ${selectedGoal}`);
        pendingGoal = selectedGoal;

        if (selectedGoal === 'exam_prep') {
            saveGoalAndProceed(selectedGoal); // Exam prep doesn't need details
        } else {
            showStep2(selectedGoal); // Show step 2 for other goals
        }
    }

    /**
     * Показывает второй шаг модального окна.
     */
    function showStep2(goalType) {
        const modal = ui.goalSelectionModal;
        const step1 = ui.goalStep1;
        const step2Id = `goal-step-${goalType.replace('math_', '')}`;
        const step2 = document.getElementById(step2Id); // Use getElementById

        if (!modal || !step1 || !step2) { console.error(`Cannot show step 2: Modal or step element not found (Step1: ${!!step1}, Step2 ID: ${step2Id}, Found: ${!!step2})`); return; }
        console.log(`Showing goal selection modal (Step 2: ${goalType})...`);

        step1.classList.remove('active');
        step2.classList.add('active');

        // TODO: Dynamically populate checkboxes if needed, e.g., for review_areas
        // populateTopicCheckboxes('review-areas-group');

        // Attach listeners for Back and Confirm buttons in this step
        const backBtn = step2.querySelector('.modal-back-btn');
        if (backBtn) {
             const backHandler = () => handleBackToStep1(step1, step2);
             backBtn.removeEventListener('click', backHandler); // Use named handler for removal
             backBtn.addEventListener('click', backHandler, { once: true }); // Use once for simplicity
        }

        const confirmBtn = step2.querySelector('.modal-confirm-btn');
        if (confirmBtn) {
            const confirmHandler = () => handleStep2Confirm(goalType);
            confirmBtn.removeEventListener('click', confirmHandler);
            confirmBtn.addEventListener('click', confirmHandler); // Don't use once here, allow re-submission if validation fails
        }
    }

    /**
     * Обработчик кнопки "Назад".
     */
    function handleBackToStep1(step1, currentStep2) {
        console.log("Going back to step 1...");
        if(currentStep2) currentStep2.classList.remove('active');
        if(step1) step1.classList.add('active');
        pendingGoal = null; // Reset pending goal
    }

    /**
     * Обработчик кнопки "Потврдить" в шаге 2.
     */
    function handleStep2Confirm(goalType) {
         if (goalSelectionInProgress) return;
         const step2Id = `goal-step-${goalType.replace('math_', '')}`;
         const step2Element = document.getElementById(step2Id);
         if (!step2Element) { console.error(`Step 2 element ${step2Id} not found during confirm.`); return; }

         const details = {};
         let isValid = true;

         // Сбор данных
         if (goalType === 'math_accelerate') {
             details.accelerate_areas = Array.from(step2Element.querySelectorAll('input[name="accelerate_area"]:checked')).map(cb => cb.value);
             const reasonRadio = step2Element.querySelector('input[name="accelerate_reason"]:checked');
             details.accelerate_reason = reasonRadio ? reasonRadio.value : null;
              if(details.accelerate_areas.length === 0) { showToast("Chyba", "Vyberte prosím alespoň jednu oblast zájmu.", "warning"); isValid = false; }
              if(!details.accelerate_reason) { showToast("Chyba", "Vyberte prosím důvod.", "warning"); isValid = false; }
         } else if (goalType === 'math_review') {
             details.review_areas = Array.from(step2Element.querySelectorAll('input[name="review_area"]:checked')).map(cb => cb.value);
             // No validation needed here, system can find weaknesses if none selected
         } else if (goalType === 'math_explore') {
             const levelRadio = step2Element.querySelector('input[name="explore_level"]:checked');
             details.explore_level = levelRadio ? levelRadio.value : null;
              if(!details.explore_level) { showToast("Chyba", "Vyberte prosím vaši úroveň.", "warning"); isValid = false; }
         }

         if (isValid) {
             console.log(`Step 2 details collected for ${goalType}:`, details);
             saveGoalAndProceed(pendingGoal, details); // Сохраняем основную цель И детали
         }
     }

     /**
      * Сохраняет цель и детали в БД, обновляет UI.
      */
     async function saveGoalAndProceed(goal, details = null) {
         const modal = ui.goalSelectionModal;
         if (goalSelectionInProgress || !goal) return;
         goalSelectionInProgress = true;
         setLoadingState('goalSelection', true);

         console.log(`Saving goal: ${goal}, with details:`, details);
         const confirmButton = document.querySelector(`.modal-step.active .modal-confirm-btn`);
         const backButton = document.querySelector(`.modal-step.active .modal-back-btn`);
         if (confirmButton) { confirmButton.disabled = true; confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...'; }
         if (backButton) backButton.disabled = true; // Disable back during save


         try {
             if (!supabase || !currentUser) throw new Error("Supabase client or user not available.");

             const updatePayload = { learning_goal: goal, updated_at: new Date().toISOString() };
             let finalPreferences = currentProfile.preferences || {};
             if (details) { finalPreferences = { ...finalPreferences, goal_details: details }; } // Store details under 'goal_details' key
             updatePayload.preferences = finalPreferences;


             const { data, error } = await supabase
                 .from('profiles')
                 .update(updatePayload)
                 .eq('id', currentUser.id)
                 .select('*') // Load full updated profile
                 .single();

             if (error) throw error;

             currentProfile = data; // Update local profile
             console.log("Learning goal and preferences saved successfully:", currentProfile.learning_goal, currentProfile.preferences);

             let goalText = goal;
             if (goal === 'exam_prep') goalText = 'Příprava na zkoušky';
             else if (goal === 'math_accelerate') goalText = 'Učení napřed';
             else if (goal === 'math_review') goalText = 'Doplnění mezer';
             else if (goal === 'math_explore') goalText = 'Volné prozkoumávání';
             showToast('Cíl uložen!', `Váš cíl byl nastaven na: ${goalText}.`, 'success');

             if (modal) { modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }
             configureUIForGoal(goal); // Configure based on the main goal
             await loadPageData(); // Reload based on the main goal and details in preferences
             if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled');

         } catch (error) {
             console.error("Error saving goal/preferences:", error);
             showToast('Chyba', 'Nepodařilo se uložit váš cíl.', 'error');
             if (confirmButton) { confirmButton.disabled = false; confirmButton.innerHTML = 'Potvrdit a pokračovat'; }
             if (backButton) backButton.disabled = false;
         } finally {
             goalSelectionInProgress = false;
             setLoadingState('goalSelection', false);
             pendingGoal = null; // Reset pending goal
         }
     }
    // --- END: Goal Selection Logic ---

    // --- Рендеринг Ярлыков (Адаптировано) ---
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
        container.innerHTML = shortcutsHTML; container.classList.remove('loading');
        setLoadingState('shortcuts', false); initScrollAnimations();
    }
    // Fallback
    if (typeof window.renderShortcuts === 'undefined') { window.renderShortcuts = function() { console.warn("Using fallback renderShortcuts in main.js"); if(ui.shortcutsGrid) renderShortcutsForGoal(currentProfile?.learning_goal || 'exam_prep', ui.shortcutsGrid); } }
    // --- Конец Рендеринга Ярлыков ---


    // --- Конфигурация UI (Адаптировано) ---
    function configureUIForGoal(goal) {
        console.log(`Configuring UI for goal: ${goal}`);
        const isExamPrep = goal === 'exam_prep';

        // 1. Adapt Page Title (example)
        // const dashboardTitle = ui.dashboardTitle;
        // if (dashboardTitle) { /* ... update innerHTML based on goal ... */ }

        // 2. Render Correct Shortcuts
        if (ui.shortcutsGrid) {
            renderShortcutsForGoal(goal, ui.shortcutsGrid);
        } else { console.warn("Shortcuts grid not found for configuration."); }

        // 3. Show/Hide Tabs
        const testTabButton = document.querySelector('.content-tab[data-tab="test-results-tab"]');
        const planTabButton = document.querySelector('.content-tab[data-tab="study-plan-tab"]');
        const topicAnalysisButton = document.querySelector('.content-tab[data-tab="topic-analysis-tab"]');
        const practiceTabButton = document.querySelector('.content-tab[data-tab="practice-tab"]');

        if (testTabButton) testTabButton.style.display = isExamPrep ? 'flex' : 'none';
        if (planTabButton) planTabButton.style.display = (isExamPrep || goal === 'math_accelerate') ? 'flex' : 'none';
        if (topicAnalysisButton) topicAnalysisButton.style.display = 'flex'; // Always show?
        if (practiceTabButton) practiceTabButton.style.display = 'flex'; // Always show?

        // 4. Activate correct tab if current one is hidden
        const activeTab = document.querySelector('.content-tab.active');
        if (activeTab && window.getComputedStyle(activeTab).display === 'none') {
            console.log("Active tab is hidden, switching to first visible tab...");
            const firstVisibleTab = document.querySelector('.content-tab:not([style*="display: none"])');
            if (firstVisibleTab) { handleTabSwitch({ currentTarget: firstVisibleTab }); }
            else if (practiceTabButton && window.getComputedStyle(practiceTabButton).display !== 'none') { handleTabSwitch({ currentTarget: practiceTabButton }); }
            else { console.warn("No visible tabs found to switch to."); }
        } else if (!activeTab) {
            // Activate first visible tab if none is active
            const firstVisibleTab = document.querySelector('.content-tab:not([style*="display: none"])');
             if (firstVisibleTab) { handleTabSwitch({ currentTarget: firstVisibleTab }); }
        }
        console.log(`UI configured for goal: ${goal}`);
    }
    // --- Конец Конфигурации UI ---


    // --- Загрузка Данных Страницы (Адаптированная) ---
    async function loadPageData() {
        const goal = currentProfile?.learning_goal;
        // --- Check if goal is set ---
        if (!goal) { console.warn("[Load Page Data] Learning goal not set. Showing modal."); showGoalSelectionModal(); setLoadingState('all', false); if(ui.mainContent) ui.mainContent.classList.add('show-modal-overlay'); // Optional class to dim background return; }
        if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; if(ui.mainContent) ui.mainContent.classList.remove('show-modal-overlay');

        if (!currentUser || !currentProfile || !supabase) { showError("Chyba: Nelze načíst data.", true); setLoadingState('all', false); return; }
        console.log(`🔄 [Load Page Data] Loading data for goal: ${goal}...`); setLoadingState('all', true); hideError();

        // Render skeletons & configure UI (shortcuts) early
        if(ui.statsCards) renderStatsSkeletons(ui.statsCards);
        configureUIForGoal(goal); // Render goal-specific shortcuts
        if(ui.testResultsContainer?.style.display !== 'none' && ui.testResultsContent) renderTestSkeletons(ui.testResultsContent);
        if(ui.studyPlanContainer?.style.display !== 'none' && ui.studyPlanContent) renderPlanSkeletons(ui.studyPlanContent);
        if(ui.topicAnalysisContainer?.style.display !== 'none' && ui.topicAnalysisContent) renderTopicSkeletons(ui.topicAnalysisContent);

        try {
            // Fetch stats first as it's always needed
            const stats = await fetchDashboardStats(currentUser.id, currentProfile);
            userStatsData = stats;
            renderStatsCards(userStatsData); // Render stats

            const promisesToAwait = []; // Fetch other data concurrently

            // Fetch/Render based on goal
            if (goal === 'exam_prep') {
                if (ui.testResultsContainer?.style.display !== 'none') { promisesToAwait.push(fetchDiagnosticResults(currentUser.id, goal).then(r => { diagnosticResultsData = r || []; renderTestResults(diagnosticResultsData, goal); })); } else { setLoadingState('tests', false); }
                if (ui.studyPlanContainer?.style.display !== 'none') { promisesToAwait.push(fetchActiveStudyPlan(currentUser.id, goal).then(async (p) => { studyPlanData = p || null; planActivitiesData = studyPlanData ? await fetchPlanActivities(studyPlanData.id, goal) : []; renderStudyPlanOverview(studyPlanData, planActivitiesData, goal); })); } else { setLoadingState('plan', false); }
                if (ui.topicAnalysisContainer?.style.display !== 'none') { promisesToAwait.push(fetchTopicProgress(currentUser.id, goal).then(t => { topicProgressData = t || []; renderTopicAnalysis(topicProgressData, goal); })); } else { setLoadingState('topics', false); }
            } else if (goal === 'math_accelerate') {
                if (ui.studyPlanContainer?.style.display !== 'none') { promisesToAwait.push(fetchActiveStudyPlan(currentUser.id, goal).then(async (p) => { studyPlanData = p || null; planActivitiesData = studyPlanData ? await fetchPlanActivities(studyPlanData.id, goal) : []; renderStudyPlanOverview(studyPlanData, planActivitiesData, goal); })); } else { setLoadingState('plan', false); }
                if (ui.topicAnalysisContainer?.style.display !== 'none') { promisesToAwait.push(fetchTopicProgress(currentUser.id, goal).then(t => { topicProgressData = t || []; renderTopicAnalysis(topicProgressData, goal); })); } else { setLoadingState('topics', false); }
                setLoadingState('tests', false); // Ensure tests section is marked as not loading
            } else if (goal === 'math_review') {
                if (ui.topicAnalysisContainer?.style.display !== 'none') { promisesToAwait.push(fetchTopicProgress(currentUser.id, goal).then(t => { topicProgressData = t || []; renderTopicAnalysis(topicProgressData, goal); })); } else { setLoadingState('topics', false); }
                setLoadingState('tests', false); setLoadingState('plan', false); // Mark tests and plan as not loading
            } else { // math_explore or fallback
                if (ui.topicAnalysisContainer?.style.display !== 'none') { promisesToAwait.push(fetchTopicProgress(currentUser.id, goal).then(t => { topicProgressData = t || []; renderTopicAnalysis(topicProgressData, goal); })); } else { setLoadingState('topics', false); }
                setLoadingState('tests', false); setLoadingState('plan', false);
            }

            await Promise.allSettled(promisesToAwait); // Wait for relevant fetches

            // Show/hide diagnostic prompt (only relevant for exam_prep)
            if (goal === 'exam_prep') {
                if (diagnosticResultsData.length === 0 && ui.diagnosticPrompt) { ui.diagnosticPrompt.style.display = 'flex'; if(ui.testResultsEmpty) ui.testResultsEmpty.style.display = 'none'; if(ui.studyPlanEmpty) ui.studyPlanEmpty.style.display = 'none'; if(ui.topicAnalysisEmpty) ui.topicAnalysisEmpty.style.display = 'none'; }
                else if (ui.diagnosticPrompt) { ui.diagnosticPrompt.style.display = 'none'; }
            } else if (ui.diagnosticPrompt) { ui.diagnosticPrompt.style.display = 'none'; }

            console.log("✅ [Load Page Data] All relevant data loaded and rendered for goal:", goal);

        } catch (error) {
            console.error("❌ [Load Page Data] Error loading page data:", error);
            showError(`Nepodařilo se načíst data: ${error.message}`, true);
            // Render empty/error states for potentially visible sections
            renderStatsCards(null);
            if(ui.testResultsContainer?.style.display !== 'none') renderTestResults([], goal);
            if(ui.studyPlanContainer?.style.display !== 'none') renderStudyPlanOverview(null, [], goal);
            if(ui.topicAnalysisContainer?.style.display !== 'none') renderTopicAnalysis([], goal);
        } finally {
            setLoadingState('all', false); // Stop all loading indicators
            initTooltips();
        }
    }
    // --- Конец Загрузки Данных Страницы ---

    // --- Event Handlers ---
    function handleTabSwitch(event) { /* ... as before ... */ }
    async function handleRefreshClick() { /* ... as before ... */ }
    // --- Конец Event Handlers ---

    // --- Настройка Event Listeners ---
    function setupEventListeners() {
        console.log("[Procvičování SETUP] Setting up event listeners...");
        // cacheDOMElements(); // Called in initializeApp

        const safeAddListener = (element, eventType, handler, key) => { if (element) { element.addEventListener(eventType, handler); } else { console.warn(`[SETUP] Element not found for listener: ${key}`); } };
        const safeAddListenerToAll = (elementsNodeList, eventType, handler, key) => { if (elementsNodeList && elementsNodeList.length > 0) { elementsNodeList.forEach(el => el.addEventListener(eventType, handler)); } else { console.warn(`[SETUP] No elements found for listener group: ${key}`); } };

        // Assume sidebar/menu listeners are handled by dashboard.js

        // Page Specific
        safeAddListener(ui.refreshDataBtn, 'click', handleRefreshClick, 'refreshDataBtn');
        safeAddListenerToAll(ui.contentTabs, 'click', handleTabSwitch, 'contentTabs');

        // Buttons within potentially empty states or prompts
        safeAddListener(ui.startTestBtnPrompt, 'click', () => window.location.href = 'test1.html', 'startTestBtnPrompt');
        safeAddListener(ui.startTestBtnResults, 'click', () => window.location.href = 'test1.html', 'startTestBtnResults');
        safeAddListener(ui.startTestBtnPlan, 'click', () => window.location.href = 'test1.html', 'startTestBtnPlan');
        safeAddListener(ui.startTestBtnAnalysis, 'click', () => window.location.href = 'test1.html', 'startTestBtnAnalysis');

        // Add listeners for multi-step modal buttons (Done within showStep2 and showGoalSelectionModal now)

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
            allTitles = event?.detail?.titles || [];

            if (!supabase || !currentUser || !currentProfile) { console.error("[INIT Procvičování] Critical data missing after 'dashboardReady'."); showError("Chyba načítání základních dat. Zkuste obnovit.", true); return; }
            console.log(`[INIT Procvičování] User: ${currentUser.id}, Profile:`, currentProfile);

            try {
                cacheDOMElements(); // Cache elements
                setupEventListeners(); // Setup core listeners AFTER cache

                // Initial UI setups (rely on dashboard.js or define fallbacks)
                if (typeof applyInitialSidebarState === 'function') applyInitialSidebarState(); else console.warn("applyInitialSidebarState missing");
                if (typeof updateCopyrightYear === 'function') updateCopyrightYear(); else console.warn("updateCopyrightYear missing");
                if (typeof initMouseFollower === 'function') initMouseFollower(); else console.warn("initMouseFollower missing");
                if (typeof initHeaderScrollDetection === 'function') initHeaderScrollDetection(); else console.warn("initHeaderScrollDetection missing");
                if (typeof updateOnlineStatus === 'function') updateOnlineStatus(); else console.warn("updateOnlineStatus missing");

                // --- Goal Check and Initial Load ---
                if (!currentProfile.learning_goal) {
                    console.log("[INIT Procvičování] Goal not set, showing modal.");
                    showGoalSelectionModal(); // Show the modal
                    setLoadingState('all', false);
                    if(ui.mainContent) ui.mainContent.style.display = 'block'; // Show main area for modal
                    // Hide actual content panes
                    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
                    if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'none'; // Hide tabs too
                } else {
                    console.log(`[INIT Procvičování] Goal found: ${currentProfile.learning_goal}. Loading data...`);
                    if(ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; // Ensure modal is hidden
                    if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'block'; // Show tabs
                     document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'block'); // Show content area (tabs control visibility)
                    configureUIForGoal(currentProfile.learning_goal); // Configure UI first
                    await loadPageData(); // Load data based on the existing goal
                }
                // --- End Goal Check ---

                if (ui.mainContent && window.getComputedStyle(ui.mainContent).display === 'none') { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
                initTooltips(); // Init tooltips after potential dynamic content

                console.log("✅ [INIT Procvičování] Page specific setup complete.");

            } catch (error) {
                console.error("❌ [INIT Procvičování] Error during page-specific setup:", error);
                showError(`Chyba inicializace stránky Procvičování: ${error.message}`, true);
                if (ui.mainContent) ui.mainContent.style.display = 'block';
                setLoadingState('all', false);
            } finally {
                 const il = ui.initialLoader;
                 if (il && !il.classList.contains('hidden')) { il.classList.add('hidden'); setTimeout(() => { if(il) il.style.display = 'none'; }, 300); }
            }
        });
        // Initial setup before dashboardReady
        cacheDOMElements(); // Cache early
        if (ui.mainContent) ui.mainContent.style.display = 'none';
        console.log("[INIT Procvičování] Waiting for 'dashboardReady' event...");
    }

    // --- Запуск ---
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeApp); }
    else { initializeApp(); }

})(); // End IIFE