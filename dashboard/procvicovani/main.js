// dashboard/procvicovani/main.js
// Version: 24.6 - Multi-step goal selection implementation

(function() { // Start IIFE
    'use strict';

    // --- Глобальные переменные ---
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = []; // For sidebar consistency
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
    let goalSelectionInProgress = false; // Prevent double clicks on goal selection
    let pendingGoal = null; // Store the initially selected goal during multi-step process

    // --- Кэш UI Элементов ---
    const ui = {}; // Populated by cacheDOMElements

    function cacheDOMElements() {
        console.log("[Procvičování Cache DOM] Caching elements...");
        const ids = [
            // Core Layout & Sidebar (assuming provided by dashboard.js or similar)
            'initial-loader', 'sidebar-overlay', 'main-content', 'sidebar', 'main-mobile-menu-toggle',
            'sidebar-close-toggle', 'sidebar-toggle-btn', 'sidebar-avatar',
            'sidebar-name', 'sidebar-user-title', 'currentYearSidebar',
            // Header
            // 'dashboard-header', // Using class selector instead
            'dashboard-title', 'refresh-data-btn',
            // Notifications
            'notification-bell', 'notification-count', 'notifications-dropdown',
            'notifications-list', 'no-notifications-msg', 'mark-all-read',
            // Main Content Sections & Loaders
            'diagnostic-prompt', 'start-test-btn-prompt',
            'stats-cards', 'shortcuts-grid',
            'test-results-container', 'test-results-loading', 'test-results-content',
            'test-results-empty', 'start-test-btn-results',
            'study-plan-container', 'study-plan-loading', 'study-plan-content',
            'study-plan-empty', 'start-test-btn-plan',
            'main-plan-schedule', // Grid within study plan tab
            'topic-analysis-container', 'topic-analysis-loading', 'topic-analysis-content',
            'topic-analysis-empty', 'start-test-btn-analysis', 'topic-grid',
            // Goal Selection Modal & Steps
            'goal-selection-modal',
            'goal-step-1', 'select-goal-exam', 'select-goal-accelerate', 'select-goal-review', 'select-goal-explore',
            'goal-step-accelerate', 'accelerate-areas-group', 'accelerate-reason-group',
            'goal-step-review', 'review-areas-group',
            'goal-step-explore', 'explore-level-group',
            // Utility
            'global-error', 'toastContainer',
            'currentYearFooter', 'mouse-follower'
        ];
        const notFound = [];
        ids.forEach(id => {
            const element = document.getElementById(id);
            const key = id.replace(/-([a-z])/g, g => g[1].toUpperCase()); // Convert kebab-case to camelCase
            if (element) { ui[key] = element; }
            else { notFound.push(id); ui[key] = null; }
        });

        // Selectors for multiple elements
        ui.contentTabs = document.querySelectorAll('.content-tab');
        ui.practiceTabContent = document.getElementById('practice-tab');
        ui.testResultsTabContent = document.getElementById('test-results-tab');
        ui.studyPlanTabContent = document.getElementById('study-plan-tab');
        ui.topicAnalysisTabContent = document.getElementById('topic-analysis-tab');
        ui.modalBackBtns = document.querySelectorAll('.modal-back-btn'); // Back buttons in modal steps
        ui.modalConfirmBtns = document.querySelectorAll('.modal-confirm-btn'); // Confirm buttons in modal steps
        ui.dashboardHeader = document.querySelector('.dashboard-header'); // Find by class

        // Critical check
        const criticalMissing = ['practiceTabContent', 'goalSelectionModal', 'goalStep1', 'goalStepAccelerate', 'goalStepReview', 'goalStepExplore']
                                .filter(key => !ui[key]);
        if (criticalMissing.length > 0) { console.error("[CACHE DOM] CRITICAL elements missing:", criticalMissing); }
        if (notFound.length > 0) { console.log(`[Procvičování Cache DOM] Elements potentially missing: (${notFound.length}) ['${notFound.join("', '")}']`); }
        console.log("[Procvičování Cache DOM] Caching complete.");
    }

    // --- Карты иконок и визуалов ---
    const topicIcons = { /* ... as before ... */ "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon", "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar", "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar", "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book" };
    const activityVisuals = { /* ... as before ... */ test: { name: 'Test', icon: 'fa-vial', class: 'test' }, exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' }, badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' }, diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' }, plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' }, other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' }, default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' } };

    // --- Вспомогательные функции (Fallbacks/Definitions) ---
    // (Keep the fallback definitions or rely on dashboard.js)
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
        // ... (keep the refined version from previous step) ...
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
                 if (container?.querySelector(skeletonSelector) && key !== 'stats' && key !== 'shortcuts') container.innerHTML = '';
                 // Visibility after loading is handled by render functions
                 if (content && empty) {
                     const hasContent = content.innerHTML.trim() !== '';
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

    // --- Загрузка Данных (Адаптированные вызовы) ---
    async function fetchDashboardStats(userId, profileData) { /* ... as before ... */ }
    async function fetchDiagnosticResults(userId, goal) { /* ... as before ... */ }
    async function fetchActiveStudyPlan(userId, goal) { /* ... as before ... */ }
    async function fetchPlanActivities(planId, goal) { /* ... as before ... */ }
    async function fetchTopicProgress(userId, goal) { /* ... as before ... */ }
    // --- Конец Загрузки Данных ---

    // --- Рендеринг UI (Адаптированные вызовы) ---
    function renderStatsCards(stats) { /* ... as before ... */ }
    function calculateAverageScore(results) { /* ... as before ... */ }
    function renderTestChart(chartData) { /* ... as before ... */ }
    function renderTestResults(results, goal) { /* ... as before ... */ }
    function renderStudyPlanOverview(plan, activities, goal) { /* ... as before ... */ }
    function renderTopicAnalysis(topics, goal) { /* ... as before ... */ }
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
        // Скрыть все шаги, показать первый
        modal.querySelectorAll('.modal-step').forEach(step => step.classList.remove('active'));
        step1.classList.add('active');

        // Показать модальное окно
        modal.style.display = 'flex';
        requestAnimationFrame(() => modal.classList.add('active'));

        // Добавить обработчики только к кнопкам первого шага
        const optionButtons = step1.querySelectorAll('.goal-option-card');
        optionButtons.forEach(button => {
            const goal = button.dataset.goal;
            const handler = () => handleInitialGoalSelection(goal); // Use a wrapper
            // Удаляем старый обработчик (если есть) и добавляем новый
            button.removeEventListener('click', handler);
            button.addEventListener('click', handler);
        });
        console.log("Goal selection step 1 listeners attached.");
    }

    /**
     * Обрабатывает выбор на первом шаге.
     */
    function handleInitialGoalSelection(selectedGoal) {
        if (goalSelectionInProgress) return;
        console.log(`Initial goal selected: ${selectedGoal}`);
        pendingGoal = selectedGoal; // Сохраняем выбранную цель временно

        if (selectedGoal === 'exam_prep') {
            // Для exam_prep сразу сохраняем и продолжаем
            saveGoalAndProceed(selectedGoal);
        } else {
            // Для других целей показываем соответствующий второй шаг
            showStep2(selectedGoal);
        }
    }

    /**
     * Показывает второй шаг модального окна для уточнения цели.
     */
    function showStep2(goalType) {
        const modal = ui.goalSelectionModal;
        const step1 = ui.goalStep1;
        const step2Id = `goal-step-${goalType.replace('math_', '')}`; // -> goal-step-accelerate, goal-step-review, etc.
        const step2 = document.getElementById(step2Id); // Получаем ID из ui кэша не получится, так как ключи camelCase

        if (!modal || !step1 || !step2) {
            console.error(`Cannot show step 2: Modal or step element not found (Step1: ${!!step1}, Step2 ID: ${step2Id}, Found: ${!!step2})`);
            return;
        }
        console.log(`Showing goal selection modal (Step 2: ${goalType})...`);

        // Скрываем шаг 1, показываем шаг 2
        step1.classList.remove('active');
        step2.classList.add('active');

        // TODO: Динамически загрузить список тем для чекбоксов в 'review' и 'accelerate', если нужно
        // populateTopicCheckboxes('review-areas-group');
        // populateTopicCheckboxes('accelerate-areas-group');

        // Добавляем обработчик для кнопки "Назад"
        const backBtn = step2.querySelector('.modal-back-btn');
        if (backBtn) {
             const backHandler = () => handleBackToStep1(step1, step2);
             backBtn.removeEventListener('click', backHandler); // Remove previous listener
             backBtn.addEventListener('click', backHandler, { once: true }); // Add new listener
        }

        // Добавляем обработчик для кнопки "Потврдить"
        const confirmBtn = step2.querySelector('.modal-confirm-btn');
        if (confirmBtn) {
             const confirmHandler = () => handleStep2Confirm(goalType); // Pass goalType
             confirmBtn.removeEventListener('click', confirmHandler); // Remove previous listener
             confirmBtn.addEventListener('click', confirmHandler); // Add new listener
        }
    }

    /**
    * Обработчик кнопки "Назад" в шагах 2.
    */
    function handleBackToStep1(step1, currentStep2) {
        console.log("Going back to step 1...");
        if(currentStep2) currentStep2.classList.remove('active');
        if(step1) step1.classList.add('active');
        pendingGoal = null; // Сбрасываем временную цель
    }

    /**
     * Обработчик кнопки "Потврдить" в шагах 2.
     */
    function handleStep2Confirm(goalType) {
         if (goalSelectionInProgress) return;
         const step2Id = `goal-step-${goalType.replace('math_', '')}`;
         const step2Element = document.getElementById(step2Id);
         if (!step2Element) { console.error(`Step 2 element ${step2Id} not found during confirm.`); return; }

         const details = {};
         let isValid = true; // Флаг валидации для шага 2

         // Сбор данных из формы шага 2
         if (goalType === 'math_accelerate') {
             details.accelerate_areas = Array.from(step2Element.querySelectorAll('input[name="accelerate_area"]:checked')).map(cb => cb.value);
             const reasonRadio = step2Element.querySelector('input[name="accelerate_reason"]:checked');
             details.accelerate_reason = reasonRadio ? reasonRadio.value : null;
             // Добавить валидацию, если нужно (например, хотя бы одна область выбрана)
              if(details.accelerate_areas.length === 0) {
                  showToast("Chyba", "Vyberte prosím alespoň jednu oblast zájmu.", "warning");
                  isValid = false;
              }
              if(!details.accelerate_reason) {
                  showToast("Chyba", "Vyberte prosím důvod.", "warning");
                   isValid = false;
              }
         } else if (goalType === 'math_review') {
             details.review_areas = Array.from(step2Element.querySelectorAll('input[name="review_area"]:checked')).map(cb => cb.value);
             // Можно не требовать выбора, система сама найдет слабые места
         } else if (goalType === 'math_explore') {
             const levelRadio = step2Element.querySelector('input[name="explore_level"]:checked');
             details.explore_level = levelRadio ? levelRadio.value : null;
              if(!details.explore_level) {
                  showToast("Chyba", "Vyberte prosím vaši úroveň.", "warning");
                   isValid = false;
              }
         }

         if (isValid) {
             console.log(`Step 2 details collected for ${goalType}:`, details);
             saveGoalAndProceed(pendingGoal, details); // Сохраняем основную цель и детали
         }
     }

     /**
      * Финальная функция сохранения цели и деталей в БД.
      */
     async function saveGoalAndProceed(goal, details = null) {
         const modal = ui.goalSelectionModal;
         if (goalSelectionInProgress || !goal) return; // Убедимся, что цель есть
         goalSelectionInProgress = true;
         setLoadingState('goalSelection', true);

         console.log(`Saving goal: ${goal}, with details:`, details);
         const confirmButton = document.querySelector(`.modal-step.active .modal-confirm-btn`);
         if (confirmButton) { confirmButton.disabled = true; confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...'; }
         else { console.warn("Confirm button not found during save."); }


         try {
             if (!supabase || !currentUser) throw new Error("Supabase client or user not available.");

             // Подготовка данных для обновления
             const updatePayload = {
                 learning_goal: goal,
                 updated_at: new Date().toISOString()
             };
             // Обновляем preferences JSONB, сохраняя существующие
             let finalPreferences = currentProfile.preferences || {};
             if (details) {
                 // Сливаем новые детали с существующими preferences
                 finalPreferences = { ...finalPreferences, ...details };
             }
             updatePayload.preferences = finalPreferences;


             const { data, error } = await supabase
                 .from('profiles')
                 .update(updatePayload)
                 .eq('id', currentUser.id)
                 .select('*') // Загружаем весь обновленный профиль
                 .single();

             if (error) throw error;

             currentProfile = data; // Обновляем локальный профиль ПОЛНОСТЬЮ
             console.log("Learning goal and preferences saved successfully:", currentProfile.learning_goal, currentProfile.preferences);

             let goalText = goal;
              if (goal === 'exam_prep') goalText = 'Příprava na zkoušky';
              else if (goal === 'math_accelerate') goalText = 'Učení napřed';
              else if (goal === 'math_review') goalText = 'Doplnění mezer';
              else if (goal === 'math_explore') goalText = 'Volné prozkoumávání';
             showToast('Cíl uložen!', `Váš cíl byl nastaven na: ${goalText}.`, 'success');

             // Скрыть модальное окно
             if (modal) {
                 modal.classList.remove('active');
                 setTimeout(() => modal.style.display = 'none', 300);
             }
             // Настроить UI и загрузить данные
             configureUIForGoal(goal);
             await loadPageData(); // Перезагрузка с учетом новой цели и деталей
             if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled'); // Разблокировать контент

         } catch (error) {
             console.error("Error saving goal/preferences:", error);
             showToast('Chyba', 'Nepodařilo se uložit váš cíl.', 'error');
             if (confirmButton) { confirmButton.disabled = false; confirmButton.innerHTML = 'Potvrdit a pokračovat'; }
         } finally {
             goalSelectionInProgress = false;
             setLoadingState('goalSelection', false);
             pendingGoal = null; // Сбросить временную цель
         }
     }
    // --- END: Goal Selection Logic ---

    // --- Рендеринг Ярлыков (Адаптировано) ---
    function renderShortcutsForGoal(goal, container) {
        if (!container) return;
        setLoadingState('shortcuts', true);
        container.innerHTML = ''; // Clear previous
        console.log(`Rendering shortcuts for goal: ${goal}`);
        let shortcutsHTML = '';

        // --- Define shortcut HTML blocks ---
        const shortcutTest = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-graduation-cap"></i></div><h3 class="shortcut-title">Diagnostický Test</h3><p class="shortcut-desc">Ověřte své znalosti pro přijímačky.</p><a href="/dashboard/procvicovani/test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Test</a></div>`;
        const shortcutPlan = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-tasks"></i></div><h3 class="shortcut-title">Studijní Plán</h3><p class="shortcut-desc">Zobrazte si svůj personalizovaný plán.</p><a href="/dashboard/procvicovani/plan.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Zobrazit Plán</a></div>`;
        const shortcutTutor = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-book-open"></i></div><h3 class="shortcut-title">AI Tutor (Lekce)</h3><p class="shortcut-desc">Nechte si vysvětlit témata z plánu nebo osnovy.</p><a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a></div>`;
        const shortcutNextTopic = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-forward"></i></div><h3 class="shortcut-title">Další Téma Osnovy</h3><p class="shortcut-desc">Pokračujte v učení podle standardní osnovy.</p><a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Učit se Další</a></div>`;
        const shortcutCurriculum = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-stream"></i></div><h3 class="shortcut-title">Přehled Osnovy</h3><p class="shortcut-desc">Zobrazte si přehled témat dle školní osnovy.</p><a href="/dashboard/procvicovani/plan.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Osnovu</a></div>`;
        const shortcutWeakness = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-search"></i></div><h3 class="shortcut-title">Moje Slabiny</h3><p class="shortcut-desc">Zobrazte témata, kde potřebujete zlepšení.</p><a href="#topic-analysis-tab" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="document.querySelector('.content-tab[data-tab=topic-analysis-tab]').click()">Analýza Témat</a></div>`;
        const shortcutReview = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-history"></i></div><h3 class="shortcut-title">Opakování</h3><p class="shortcut-desc">Procvičte si témata, která jste dlouho neprobírali.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="alert('Funkce opakování zatím není implementována.'); return false;">Spustit Opakování</a></div>`;
        const shortcutExplore = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-compass"></i></div><h3 class="shortcut-title">Procházet Témata</h3><p class="shortcut-desc">Vyberte si libovolné matematické téma k učení.</p><a href="#topic-analysis-tab" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="document.querySelector('.content-tab[data-tab=topic-analysis-tab]').click()">Vybrat Téma</a></div>`;
        const shortcutRandom = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-dumbbell"></i></div><h3 class="shortcut-title">Náhodné Cvičení</h3><p class="shortcut-desc">Spusťte náhodné cvičení pro rychlé procvičení.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="alert('Funkce náhodného cvičení zatím není implementována.'); return false;">Náhodné Cvičení</a></div>`;
        const shortcutProgress = `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-chart-line"></i></div><h3 class="shortcut-title">Můj Pokrok</h3><p class="shortcut-desc">Sledujte své zlepšení v matematice.</p><a href="/dashboard/pokrok.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Pokrok</a></div>`;

        // --- Assemble shortcuts based on goal ---
        switch (goal) {
            case 'exam_prep':       shortcutsHTML = shortcutTest + shortcutPlan + shortcutTutor; break;
            case 'math_accelerate': shortcutsHTML = shortcutNextTopic + shortcutCurriculum + shortcutTutor; break;
            case 'math_review':     shortcutsHTML = shortcutWeakness + shortcutReview + shortcutTutor; break;
            case 'math_explore':    shortcutsHTML = shortcutExplore + shortcutRandom + shortcutTutor; break;
            default:                shortcutsHTML = shortcutProgress + shortcutTutor + shortcutRandom; // Fallback
        }

        container.innerHTML = shortcutsHTML; container.classList.remove('loading');
        setLoadingState('shortcuts', false); initScrollAnimations();
    }
     // Fallback if needed
     if (typeof window.renderShortcuts === 'undefined') { window.renderShortcuts = function() { console.warn("Using fallback renderShortcuts in main.js"); if(ui.shortcutsGrid) renderShortcutsForGoal(currentProfile?.learning_goal || 'exam_prep', ui.shortcutsGrid); } }
    // --- Конец Рендеринга Ярлыков ---


    // --- Конфигурация UI ---
    function configureUIForGoal(goal) {
        console.log(`Configuring UI for goal: ${goal}`);
        const isExamPrep = goal === 'exam_prep';

        // 1. Заголовок страницы (можно менять в зависимости от цели)
        const dashboardTitle = ui.dashboardTitle;
         if (dashboardTitle) {
              let titleText = "Procvičování // ";
              let iconClass = "fas fa-laptop-code"; // Default
              switch(goal) {
                  case 'exam_prep': titleText += "Příprava na Zkoušky"; iconClass = "fas fa-graduation-cap"; break;
                  case 'math_accelerate': titleText += "Učení Napřed"; iconClass = "fas fa-rocket"; break;
                  case 'math_review': titleText += "Doplnění Mezer"; iconClass = "fas fa-sync-alt"; break;
                  case 'math_explore': titleText += "Volné Prozkoumávání"; iconClass = "fas fa-compass"; break;
                  default: titleText += "Přehled"; break;
              }
              dashboardTitle.innerHTML = `<i class="${iconClass}"></i> ${sanitizeHTML(titleText)}`;
         }


        // 2. Ярлыки
        if (ui.shortcutsGrid) {
            renderShortcutsForGoal(goal, ui.shortcutsGrid);
        } else { console.warn("Shortcuts grid not found for configuration."); }

        // 3. Вкладки
        const testTabButton = document.querySelector('.content-tab[data-tab="test-results-tab"]');
        const planTabButton = document.querySelector('.content-tab[data-tab="study-plan-tab"]');
        const topicAnalysisButton = document.querySelector('.content-tab[data-tab="topic-analysis-tab"]');
        const practiceTabButton = document.querySelector('.content-tab[data-tab="practice-tab"]'); // Overview tab

        if (testTabButton) testTabButton.style.display = isExamPrep ? 'flex' : 'none';
        if (planTabButton) planTabButton.style.display = (isExamPrep || goal === 'math_accelerate') ? 'flex' : 'none';
        if (topicAnalysisButton) topicAnalysisButton.style.display = 'flex'; // Show analysis for all?
        if (practiceTabButton) practiceTabButton.style.display = 'flex'; // Show overview for all?

        // 4. Переключение на первую видимую вкладку, если текущая скрыта
        const activeTab = document.querySelector('.content-tab.active');
        if (activeTab && window.getComputedStyle(activeTab).display === 'none') {
            console.log("Active tab is hidden, switching to first visible tab...");
            const firstVisibleTab = document.querySelector('.content-tab:not([style*="display: none"])');
            if (firstVisibleTab) {
                handleTabSwitch({ currentTarget: firstVisibleTab });
            } else if (practiceTabButton && window.getComputedStyle(practiceTabButton).display !== 'none') {
                handleTabSwitch({ currentTarget: practiceTabButton }); // Fallback to practice tab
            } else {
                console.warn("No visible tabs found to switch to.");
            }
        } else if (!activeTab) {
             // If no tab is active initially (e.g., after goal selection), activate the first visible one
             const firstVisibleTab = document.querySelector('.content-tab:not([style*="display: none"])');
             if (firstVisibleTab) {
                  handleTabSwitch({ currentTarget: firstVisibleTab });
             }
        }

        console.log(`UI configured for goal: ${goal}`);
    }
    // --- Конец Конфигурации UI ---

    // --- Загрузка Данных Страницы ---
    async function loadPageData() {
        const goal = currentProfile?.learning_goal;
        // --- Check if goal is set ---
        if (!goal) { console.warn("[Load Page Data] Learning goal not set. Showing modal."); showGoalSelectionModal(); setLoadingState('all', false); if(ui.mainContent) ui.mainContent.classList.add('show-modal-overlay'); // Optional: visually block content return; }
        if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; if(ui.mainContent) ui.mainContent.classList.remove('show-modal-overlay');
        // --- End Check ---

        if (!currentUser || !currentProfile || !supabase) { showError("Chyba: Nelze načíst data.", true); setLoadingState('all', false); return; }
        console.log(`🔄 [Load Page Data] Loading data for goal: ${goal}...`); setLoadingState('all', true); hideError();

        // Render skeletons for potentially visible sections BEFORE fetching
        if(ui.statsCards) renderStatsSkeletons(ui.statsCards);
        configureUIForGoal(goal); // Configure UI including shortcuts
        if(ui.testResultsContainer?.style.display !== 'none' && ui.testResultsContent) renderTestSkeletons(ui.testResultsContent);
        if(ui.studyPlanContainer?.style.display !== 'none' && ui.studyPlanContent) renderPlanSkeletons(ui.studyPlanContent);
        if(ui.topicAnalysisContainer?.style.display !== 'none' && ui.topicAnalysisContent) renderTopicSkeletons(ui.topicAnalysisContent);

        try {
            const stats = await fetchDashboardStats(currentUser.id, currentProfile); userStatsData = stats; renderStatsCards(userStatsData); // Render stats always
            const promisesToAwait = []; // Fetch data concurrently based on goal
            if (goal === 'exam_prep' && ui.testResultsContainer?.style.display !== 'none') { promisesToAwait.push(fetchDiagnosticResults(currentUser.id, goal).then(r => { diagnosticResultsData = r || []; renderTestResults(diagnosticResultsData, goal); })); } else { setLoadingState('tests', false); if(ui.testResultsContent) ui.testResultsContent.innerHTML=''; }
            if ((goal === 'exam_prep' || goal === 'math_accelerate') && ui.studyPlanContainer?.style.display !== 'none') { promisesToAwait.push(fetchActiveStudyPlan(currentUser.id, goal).then(async (p) => { studyPlanData = p || null; planActivitiesData = studyPlanData ? await fetchPlanActivities(studyPlanData.id, goal) : []; renderStudyPlanOverview(studyPlanData, planActivitiesData, goal); })); } else { setLoadingState('plan', false); if(ui.studyPlanContent) ui.studyPlanContent.innerHTML=''; }
            if (ui.topicAnalysisContainer?.style.display !== 'none') { promisesToAwait.push(fetchTopicProgress(currentUser.id, goal).then(t => { topicProgressData = t || []; renderTopicAnalysis(topicProgressData, goal); })); } else { setLoadingState('topics', false); if(ui.topicAnalysisContent) ui.topicAnalysisContent.innerHTML=''; }
            await Promise.allSettled(promisesToAwait);
            if (goal === 'exam_prep') { /* Show/hide diagnostic prompt */ if (diagnosticResultsData.length === 0 && ui.diagnosticPrompt) { ui.diagnosticPrompt.style.display = 'flex'; if(ui.testResultsEmpty) ui.testResultsEmpty.style.display = 'none'; if(ui.studyPlanEmpty) ui.studyPlanEmpty.style.display = 'none'; if(ui.topicAnalysisEmpty) ui.topicAnalysisEmpty.style.display = 'none'; } else if (ui.diagnosticPrompt) { ui.diagnosticPrompt.style.display = 'none'; } } else if (ui.diagnosticPrompt) { ui.diagnosticPrompt.style.display = 'none'; }
            console.log("✅ [Load Page Data] All relevant data loaded and rendered for goal:", goal);
        } catch (error) { console.error("❌ [Load Page Data] Error loading page data:", error); showError(`Nepodařilo se načíst data: ${error.message}`, true); /* Render empty/error states */ renderStatsCards(null); if(ui.testResultsContainer?.style.display !== 'none') renderTestResults([], goal); if(ui.studyPlanContainer?.style.display !== 'none') renderStudyPlanOverview(null, [], goal); if(ui.topicAnalysisContainer?.style.display !== 'none') renderTopicAnalysis([], goal); }
        finally { setLoadingState('all', false); initTooltips(); }
    }

    // --- Event Handlers ---
    function handleTabSwitch(event) { /* ... as before ... */
        const tabButton = event.currentTarget; const tabId = tabButton?.dataset?.tab; if (!tabId || !ui.contentTabs) return; console.log(`[UI TabSwitch] Switching to tab: ${tabId}`); ui.contentTabs.forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); tabButton.classList.add('active'); const activeContent = document.getElementById(tabId); if (activeContent) { activeContent.classList.add('active'); requestAnimationFrame(() => { activeContent.querySelectorAll('[data-animate]').forEach(el => el.classList.remove('animated')); initScrollAnimations(); }); } else { console.warn(`[UI TabSwitch] Content for tab ${tabId} not found!`); const firstContent = document.querySelector('.tab-content'); if (firstContent) firstContent.classList.add('active'); } if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
    async function handleRefreshClick() { /* ... as before ... */
        if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(s => s === true)) { showToast('Info','Data se již načítají.', 'info'); return; } const refreshBtn = ui.refreshDataBtn; const icon = refreshBtn?.querySelector('i'); const text = refreshBtn?.querySelector('.refresh-text'); if(refreshBtn) refreshBtn.disabled = true; if(icon) icon.classList.add('fa-spin'); if(text) text.textContent = 'RELOADING...'; await loadPageData(); if(refreshBtn) refreshBtn.disabled = false; if(icon) icon.classList.remove('fa-spin'); if(text) text.textContent = 'RELOAD'; initTooltips();
    }

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
        console.log("[Procvičování SETUP] Event listeners set up.");
    }

    // --- Инициализация Приложения ---
    function initializeApp() {
        console.log("[INIT Procvičování] Adding 'dashboardReady' event listener...");
        document.addEventListener('dashboardReady', async (event) => {
            console.log("[INIT Procvičování] 'dashboardReady' event received.");
            supabase = event?.detail?.client; currentUser = event?.detail?.user; currentProfile = event?.detail?.profile; allTitles = event?.detail?.titles || [];
            if (!supabase || !currentUser || !currentProfile) { console.error("[INIT Procvičování] Critical data missing after 'dashboardReady'."); showError("Chyba načítání základních dat. Zkuste obnovit.", true); return; }
            console.log(`[INIT Procvičování] User: ${currentUser.id}, Profile:`, currentProfile);
            try {
                cacheDOMElements(); setupEventListeners(); // Setup core listeners
                if (typeof initMouseFollower === 'function') initMouseFollower();
                if (typeof initHeaderScrollDetection === 'function') initHeaderScrollDetection();
                if (typeof updateCopyrightYear === 'function') updateCopyrightYear();
                if (typeof updateOnlineStatus === 'function') updateOnlineStatus();
                // Initial check and load based on goal
                if (!currentProfile.learning_goal) { console.log("[INIT Procvičování] Goal not set, showing modal."); showGoalSelectionModal(); setLoadingState('all', false); if (ui.mainContent) ui.mainContent.style.display = 'block'; if (ui.practiceTabContent) ui.practiceTabContent.style.display = 'none'; /* Hide other tabs too */ }
                else { console.log(`[INIT Procvičování] Goal found: ${currentProfile.learning_goal}. Loading data...`); if(ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; configureUIForGoal(currentProfile.learning_goal); await loadPageData(); }
                if (ui.mainContent && window.getComputedStyle(ui.mainContent).display === 'none') { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
                initTooltips(); console.log("✅ [INIT Procvičování] Page specific setup complete.");
            } catch (error) { console.error("❌ [INIT Procvičování] Error during page-specific setup:", error); showError(`Chyba inicializace: ${error.message}`, true); if (ui.mainContent) ui.mainContent.style.display = 'block'; setLoadingState('all', false); }
            finally { const il = ui.initialLoader; if (il && !il.classList.contains('hidden')) { il.classList.add('hidden'); setTimeout(() => { if(il) il.style.display = 'none'; }, 300); } }
        });
        cacheDOMElements(); // Cache early
        if (ui.mainContent) ui.mainContent.style.display = 'none'; // Hide content initially
        console.log("[INIT Procvičování] Waiting for 'dashboardReady' event...");
    }

    // --- Запуск ---
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeApp); }
    else { initializeApp(); }

})(); // End IIFE