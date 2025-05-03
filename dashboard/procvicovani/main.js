// dashboard/procvicovani/main.js
// Version: 24.2 - Implement Goal Selection Modal Logic

(function() { // Start IIFE
    'use strict';

    // --- Global variables ---
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
        stats: false,
        tests: false,
        plan: false,
        topics: false,
        notifications: false,
        goalSelection: false // <<< NEW: Loading state for goal selection
    };
    let goalSelectionInProgress = false; // Prevent double clicks on goal selection

    // --- UI Elements Cache ---
    const ui = {};

    function cacheDOMElements() {
        console.log("[Procvičování Cache DOM] Caching elements...");
        const ids = [
            // Existing IDs...
            'diagnostic-prompt', 'start-test-btn-prompt',
            'stats-cards', 'shortcuts-grid',
            'test-results-container', 'test-results-loading', 'test-results-content',
            'test-results-empty', 'start-test-btn-results',
            'study-plan-container', 'study-plan-loading', 'study-plan-content',
            'study-plan-empty', 'start-test-btn-plan', 'main-plan-schedule', // Assuming schedule grid ID
            'topic-analysis-container', 'topic-analysis-loading', 'topic-analysis-content',
            'topic-analysis-empty', 'start-test-btn-analysis', 'topic-grid',
            'global-error', 'toastContainer', 'main-content',
            'refresh-data-btn', // Added refresh button if missing before

            // <<< NEW: Goal Selection Modal Elements >>>
            'goal-selection-modal',
            'select-goal-exam',
            'select-goal-math'
        ];
        const notFound = [];
        ids.forEach(id => {
            const element = document.getElementById(id);
            // Simple key generation (id -> camelCase)
            const key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
            if (element) {
                ui[key] = element;
            } else {
                notFound.push(id);
                ui[key] = null; // Assign null if not found
            }
        });

        // Cache Tabs
        ui.contentTabs = document.querySelectorAll('.content-tab');
        if (!ui.contentTabs || ui.contentTabs.length === 0) {
             console.warn("[Procvičování Cache DOM] No tab buttons found with class '.content-tab'.");
             notFound.push('.content-tab');
         } else {
             ui.contentTabsNodeList = ui.contentTabs; // Keep NodeList if needed
         }

        // Cache Tab Content Panes
        ui.practiceTabContent = document.getElementById('practice-tab');
        ui.testResultsTabContent = document.getElementById('test-results-tab');
        ui.studyPlanTabContent = document.getElementById('study-plan-tab');
        ui.topicAnalysisTabContent = document.getElementById('topic-analysis-tab');
         if (!ui.practiceTabContent || !ui.testResultsTabContent || !ui.studyPlanTabContent || !ui.topicAnalysisTabContent) {
              console.warn("[Procvičování Cache DOM] One or more tab content panes not found.");
              notFound.push('tab-content panes');
         }

        if (notFound.length > 0) {
             console.log(`[Procvičování Cache DOM] Elements potentially missing: (${notFound.length}) ['${notFound.join("', '")}']`);
        }
        console.log("[Procvičování Cache DOM] Caching complete.");
    }

    // --- Maps ---
    const topicIcons = { "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon", "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar", "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar", "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book" };
    const activityVisuals = { test: { name: 'Test', icon: 'fa-vial', class: 'test' }, exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' }, badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' }, diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' }, plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' }, other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' }, default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' } };

    // --- Helper Function Fallbacks & Definitions ---
    // Assuming dashboard.js provides these or define them here if needed
    const showToast = window.showToast || function(t, m, ty) { console.log(`[Toast Fallback] ${ty}: ${t} - ${m}`); };
    const showError = window.showError || function(m, g) { console.error(`[Error Fallback] Global=${g}: ${m}`); const ge = ui.globalError; if (g && ge) { ge.innerHTML = `<p>${m}</p>`; ge.style.display = 'block'; } else { showToast("CHYBA", m, 'error'); } };
    const hideError = window.hideError || function() { if (ui.globalError) ui.globalError.style.display = 'none'; };
    const sanitizeHTML = window.sanitizeHTML || function(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
    const formatDate = window.formatDate || function(d) { try { return d ? new Date(d).toLocaleDateString('cs-CZ') : '-'; } catch (e) { return '-'; } };
    const formatTime = window.formatTime || function(s) { if (isNaN(s) || s < 0) return '--:--'; const m = Math.floor(s / 60); const ss = Math.round(s % 60); return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`; };
    const formatRelativeTime = window.formatRelativeTime || function(t) { try { return t ? new Date(t).toLocaleString('cs-CZ') : '-'; } catch (e) { return '-'; } };
    const initTooltips = window.initTooltips || function() { console.warn("initTooltips function not found."); };
    const initScrollAnimations = window.initScrollAnimations || function() { console.warn("initScrollAnimations function not found."); };
    const initHeaderScrollDetection = window.initHeaderScrollDetection || function() { console.warn("initHeaderScrollDetection function not found."); };
    const updateOnlineStatus = window.updateOnlineStatus || function() { console.warn("updateOnlineStatus function not found."); };
    const openMenu = window.openMenu || function() { console.warn("openMenu function not found."); };
    const closeMenu = window.closeMenu || function() { console.warn("closeMenu function not found."); };
    const renderNotificationSkeletons = window.renderNotificationSkeletons || function(c) { console.warn("renderNotificationSkeletons function not found."); }
    const renderNotifications = window.renderNotifications || function(c, n) { console.warn("renderNotifications function not found."); }
    const markNotificationRead = window.markNotificationRead || async function(id) { console.warn("markNotificationRead function not found."); return false; }
    const markAllNotificationsRead = window.markAllNotificationsRead || async function() { console.warn("markAllNotificationsRead function not found."); }
    const updateCopyrightYear = window.updateCopyrightYear || function() { console.warn("updateCopyrightYear function not found."); };
    const initMouseFollower = window.initMouseFollower || function() { console.warn("initMouseFollower function not found."); };

    // --- Loading State Management (Adapted) ---
    function setLoadingState(section, isLoadingFlag) {
        if (isLoading[section] === isLoadingFlag && section !== 'all') return;
        if (section === 'all') { Object.keys(isLoading).forEach(key => setLoadingState(key, isLoadingFlag)); return; }

        isLoading[section] = isLoadingFlag;
        console.log(`[Procvičování UI Loading] Section: ${section}, isLoading: ${isLoadingFlag}`);

        // Map sections to UI elements (adjust based on `main.html` structure)
        const sectionMap = {
            stats: { container: ui.statsCards, skeletonFn: renderStatsSkeletons },
            tests: { container: ui.testResultsContainer, content: ui.testResultsContent, empty: ui.testResultsEmpty, loader: ui.testResultsLoading, skeletonFn: renderTestSkeletons },
            plan: { container: ui.studyPlanContainer, content: ui.studyPlanContent, empty: ui.studyPlanEmpty, loader: ui.studyPlanLoading, skeletonFn: renderPlanSkeletons },
            topics: { container: ui.topicAnalysisContainer, content: ui.topicAnalysisContent, empty: ui.topicAnalysisEmpty, loader: ui.topicAnalysisLoading, skeletonFn: renderTopicSkeletons },
            notifications: { container: ui.notificationsList, empty: ui.noNotificationsMsg, loader: null, skeletonFn: renderNotificationSkeletons },
            goalSelection: { /* No specific loader needed, handled by button state */ }
        };

        const config = sectionMap[section];
        if (!config) { if (section !== 'shortcuts') console.warn(`[Procvičování UI Loading] Unknown section '${section}'.`); return; }

        const container = config.container;
        const content = config.content;
        const empty = config.empty;
        const loader = config.loader;
        const skeletonFn = config.skeletonFn;

        if (loader) loader.style.display = isLoadingFlag ? 'flex' : 'none';
        if (container) container.classList.toggle('loading', isLoadingFlag);

        if (isLoadingFlag) {
            if (content) content.style.display = 'none';
            if (empty) empty.style.display = 'none';
            if (skeletonFn) skeletonFn(content || container); // Pass container if no separate content div
        } else {
            // Logic to show content or empty state after loading completes
            // This should be handled by the specific render functions (e.g., renderTestResults)
            if (content && empty) {
                const hasData = content.innerHTML.trim() !== '' && !content.querySelector('.loading-skeleton'); // Check if actual content exists
                content.style.display = hasData ? 'block' : 'none'; // Or 'grid' etc. based on layout
                empty.style.display = hasData ? 'none' : 'block';
            }
             // Cleanup skeletons if they weren't replaced
            if (content && content.querySelector('.loading-skeleton')) content.innerHTML = '';
            if (container && container.querySelector('.loading-skeleton') && section !== 'stats') container.innerHTML = ''; // Clear container skeletons except for stats

        }
        // Specific handling for notifications loading indicator
        if (section === 'notifications' && ui.notificationBell) {
            ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
            if (ui.markAllReadBtn) {
                const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
            }
        }
    }

    // --- Skeleton Rendering Functions (Keep relevant ones) ---
    function renderStatsSkeletons(container) { if (!container) return; container.innerHTML = ''; for (let i = 0; i < 4; i++) { container.innerHTML += ` <div class="dashboard-card card loading"> <div class="loading-skeleton"> <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 1rem;"></div> <div class="skeleton" style="height: 35px; width: 40%; margin-bottom: 0.8rem;"></div> <div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 1.5rem;"></div> <div class="skeleton" style="height: 14px; width: 50%;"></div> </div> </div>`; } container.classList.add('loading'); }
    function renderTestSkeletons(container) { /* ... */ }
    function renderPlanSkeletons(container) { /* ... */ }
    function renderTopicSkeletons(container) { /* ... */ }
    // function renderNotificationSkeletons(container = ui.notificationsList, count = 2) { /* ... keep from dashboard.js */ }

    // --- Data Fetching (Keep existing, add goal parameter where needed) ---
    async function fetchDashboardStats(userId, profileData) { /* ... keep existing ... */ }
    async function fetchDiagnosticResults(userId, goal = null) { // <<< Add goal
        if (!supabase || !userId) return [];
        console.log(`[Tests Fetch] Fetching diagnostic results for user ${userId}, goal: ${goal}...`);
        // Add goal filtering if your diagnostic tests are specific
        // let query = supabase.from('user_diagnostics')...
        // if (goal === 'exam_prep') { query = query.eq('test_type', 'exam_diagnostic'); } // Example
        // else { query = query.eq('test_type', 'math_diagnostic'); } // Example
        try {
            const { data, error } = await supabase
                .from('user_diagnostics') // Assuming shared diagnostics for now
                .select('id, completed_at, total_score, total_questions, time_spent')
                .eq('user_id', userId)
                .order('completed_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (err) { console.error("Error fetching diagnostic results:", err); return []; }
    }
    async function fetchActiveStudyPlan(userId, goal = null) { // <<< Add goal
        if (!supabase || !userId) return null;
        console.log(`[Plan Fetch] Fetching active study plan for user ${userId}, goal: ${goal}...`);
        // Add goal filtering if plans are specific
        // let query = supabase.from('study_plans')...
        // if (goal) { query = query.eq('plan_goal', goal); } // Example 'plan_goal' column
        try {
            const { data: plans, error } = await supabase
                .from('study_plans') // Assuming shared plans for now
                .select('id, title, created_at')
                .eq('user_id', userId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1);
            if (error) throw error;
            return plans?.[0] || null;
        } catch (err) { console.error("Error fetching active study plan:", err); return null; }
    }
    async function fetchPlanActivities(planId, goal = null) { // <<< Add goal
        if (!planId || !supabase) return [];
        console.log(`[Plan Fetch] Fetching activities for plan ${planId}, goal: ${goal}...`);
        // Add goal filtering if activities are specific
        // let query = supabase.from('plan_activities')...
        // if (goal) { query = query.eq('activity_goal', goal); } // Example
        try {
            const { data, error } = await supabase
                .from('plan_activities') // Assuming shared activities for now
                .select('id, title, day_of_week, time_slot, completed, description, type')
                .eq('plan_id', planId)
                .order('day_of_week')
                .order('time_slot');
            if (error) throw error;
            return data || [];
        } catch (err) { console.error("Error fetching plan activities:", err); return []; }
    }
    async function fetchTopicProgress(userId, goal = null) { // <<< Add goal
        if (!supabase || !userId) return [];
        console.log(`[Topics Fetch] Fetching topic progress for user ${userId}, goal: ${goal}...`);
        // Add goal filtering if progress tracking is specific
        // let query = supabase.from('user_topic_progress')...
        // if (goal === 'exam_prep') { query = query.eq('topic:exam_topics!inner.is_exam_topic', true); } // Example
        // else { query = query.eq('topic:exam_topics!inner.is_exam_topic', false); } // Example
        try {
            const { data, error } = await supabase
                .from('user_topic_progress') // Assuming shared topics for now
                .select(` topic_id, progress, strength, questions_attempted, questions_correct, topic:exam_topics!inner( name, subject ) `) // Make sure inner join works or adjust
                .eq('user_id', userId);
            if (error) throw error;
            return data || [];
        } catch (err) { console.error("Error fetching topic progress:", err); return []; }
    }
    // --- END: Data Fetching ---

    // --- START: UI Rendering (Keep existing, add goal parameter where needed) ---
    function renderStatsCards(stats) { /* ... keep existing ... */ }
    function calculateAverageScore(results) { /* ... keep existing ... */ }
    function renderTestChart(chartData) { /* ... keep existing ... */ }
    function renderTestResults(results, goal = null) { // <<< Add goal
        console.log(`[Tests Render] Rendering test results for goal: ${goal}`);
        if (!ui.testResultsContent || !ui.testResultsEmpty || !ui.startTestBtnResults) { console.warn("Missing elements for renderTestResults"); setLoadingState('tests', false); return; }
        const testResultsContainer = ui.testResultsContainer; // Use cached element
        if (testResultsContainer) {
             const titleElement = testResultsContainer.querySelector('.section-title');
             if (titleElement) {
                  titleElement.innerHTML = (goal === 'exam_prep')
                      ? '<i class="fas fa-poll"></i>Výsledky Diagnostiky (Zkoušky)'
                      : '<i class="fas fa-percentage"></i>Výsledky Testů (Matematika)';
              }
        }
        // ... rest of the function remains the same as in main.js original ...
        setLoadingState('tests', false);
        initScrollAnimations();
    }
    function renderStudyPlanOverview(plan, activities, goal = null) { // <<< Add goal
        console.log(`[Plan Render] Rendering plan overview for goal: ${goal}`);
        if (!ui.studyPlanContent || !ui.studyPlanEmpty || !ui.startTestBtnPlan || !ui.mainPlanSchedule) { console.warn("Missing elements for renderStudyPlanOverview"); setLoadingState('plan', false); return; }
        const studyPlanContainer = ui.studyPlanContainer; // Use cached element
         if (studyPlanContainer) {
              const titleElement = studyPlanContainer.querySelector('.section-title');
              if (titleElement) {
                   titleElement.innerHTML = (goal === 'exam_prep')
                       ? '<i class="fas fa-route"></i>Aktuální Plán (Zkoušky)'
                       : '<i class="fas fa-stream"></i>Aktuální Plán (Matematika)';
               }
         }
        // ... rest of the function remains the same as in main.js original ...
        setLoadingState('plan', false);
        initScrollAnimations();
    }
    function renderTopicAnalysis(topics, goal = null) { // <<< Add goal
         console.log(`[Topics Render] Rendering topic analysis for goal: ${goal}`);
         if (!ui.topicAnalysisContent || !ui.topicAnalysisEmpty || !ui.topicGrid || !ui.startTestBtnAnalysis) { console.warn("Missing elements for renderTopicAnalysis"); setLoadingState('topics', false); return; }
          const topicAnalysisContainer = ui.topicAnalysisContainer; // Use cached element
          if (topicAnalysisContainer) {
               const titleElement = topicAnalysisContainer.querySelector('.section-title');
               if (titleElement) {
                    titleElement.innerHTML = (goal === 'exam_prep')
                        ? '<i class="fas fa-atom"></i>Analýza Témat (Zkoušky)'
                        : '<i class="fas fa-brain"></i>Analýza Témat (Matematika)';
                }
          }
        // ... rest of the function remains the same as in main.js original ...
        setLoadingState('topics', false);
        initScrollAnimations();
    }

    // --- START: Goal Selection Functions ---

    /**
     * Показывает модальное окно выбора цели и добавляет обработчики.
     */
    function showGoalSelectionModal() {
        const modal = ui.goalSelectionModal;
        if (!modal) {
            console.error("Модальное окно выбора цели (#goal-selection-modal) не найдено!");
            showError("Chyba: Nelze zobrazit výběr cíle.", true);
            return;
        }
        console.log("Показ окна выбора цели...");
        modal.style.display = 'flex';
        requestAnimationFrame(() => modal.classList.add('active'));

        // Убедимся, что обработчики добавлены только один раз
        const examPrepBtn = modal.querySelector('#select-goal-exam');
        const mathLearnBtn = modal.querySelector('#select-goal-math');

        // Удаляем старые обработчики перед добавлением новых
        if (examPrepBtn) {
            examPrepBtn.removeEventListener('click', handleExamPrepClick);
            examPrepBtn.addEventListener('click', handleExamPrepClick, { once: true }); // Добавляем { once: true }
        }
        if (mathLearnBtn) {
            mathLearnBtn.removeEventListener('click', handleMathLearnClick);
            mathLearnBtn.addEventListener('click', handleMathLearnClick, { once: true }); // Добавляем { once: true }
        }
        console.log("Обработчики для кнопок выбора цели добавлены.");
    }

    // Отдельные обработчики для предотвращения проблем с `this` и для ясности
    function handleExamPrepClick() {
        handleGoalSelection('exam_prep');
    }
    function handleMathLearnClick() {
        handleGoalSelection('math_learning');
    }

    /**
     * Обрабатывает выбор цели, сохраняет в БД и запускает загрузку данных.
     * @param {string} selectedGoal - Выбранная цель ('exam_prep' или 'math_learning').
     */
    async function handleGoalSelection(selectedGoal) {
        const modal = ui.goalSelectionModal;
        if (goalSelectionInProgress) return; // Предотвращаем двойное нажатие
        goalSelectionInProgress = true;
        setLoadingState('goalSelection', true); // Используем общий лоадер или просто блокируем кнопки

        console.log(`Выбрана цель: ${selectedGoal}`);
        const buttons = modal?.querySelectorAll('.goal-option-card');
        buttons?.forEach(btn => btn.disabled = true); // Блокируем кнопки
        showToast('Ukládání...', `Nastavuji cíl...`, 'info', 2000);

        try {
            if (!supabase || !currentUser) throw new Error("Supabase client or user not available.");

            const { data, error } = await supabase
                .from('profiles')
                .update({ learning_goal: selectedGoal, updated_at: new Date().toISOString() })
                .eq('id', currentUser.id)
                .select('learning_goal') // Запрашиваем обновленное поле для подтверждения
                .single();

            if (error) throw error;

            if (data && data.learning_goal === selectedGoal) {
                currentProfile.learning_goal = selectedGoal; // Обновляем локальное состояние
                console.log("Цель обучения успешно сохранена:", selectedGoal);
                showToast('Cíl uložen!', `Váš cíl byl nastaven.`, 'success');

                // Скрываем модальное окно
                if (modal) {
                    modal.classList.remove('active');
                    setTimeout(() => modal.style.display = 'none', 300); // Скрываем после анимации
                }

                // Конфигурируем UI и загружаем данные под новую цель
                configureUIForGoal(selectedGoal);
                await loadPageData(); // Перезагружаем данные для новой цели
                // Разблокировка основного контента (если блокировали)
                if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled');

            } else {
                throw new Error("Обновление базы данных не подтвердило изменение.");
            }

        } catch (error) {
            console.error("Ошибка сохранения цели обучения:", error);
            showToast('Chyba', 'Nepodařilo se uložit váš cíl.', 'error');
            buttons?.forEach(btn => btn.disabled = false); // Разблокируем кнопки при ошибке
        } finally {
            goalSelectionInProgress = false;
            setLoadingState('goalSelection', false);
        }
    }

    /**
     * Настраивает интерфейс в зависимости от выбранной цели.
     * @param {string} goal - Текущая цель ('exam_prep' или 'math_learning').
     */
    function configureUIForGoal(goal) {
        console.log(`Настройка UI для цели: ${goal}`);
        const isExamPrep = goal === 'exam_prep';

        // 1. Адаптация заголовка страницы (если нужно)
        // const dashboardTitle = ui.dashboardTitle; // Предполагается, что есть #dashboard-title в HTML
        // if (dashboardTitle) {
        //     dashboardTitle.innerHTML = isExamPrep
        //         ? '<i class="fas fa-graduation-cap"></i> Procvičování // Příprava na Zkoušky'
        //         : '<i class="fas fa-calculator"></i> Procvičování // Zlepšení v Matematice';
        // }

        // 2. Адаптация ярлыков (shortcuts)
        const shortcutsGrid = ui.shortcutsGrid;
        if (shortcutsGrid) {
            renderShortcutsForGoal(goal, shortcutsGrid); // Вызываем функцию рендеринга
        }

        // 3. Показать/скрыть вкладки
        const testTabButton = document.querySelector('.content-tab[data-tab="test-results-tab"]');
        const planTabButton = document.querySelector('.content-tab[data-tab="study-plan-tab"]');
        // const topicAnalysisButton = document.querySelector('.content-tab[data-tab="topic-analysis-tab"]');

        if (testTabButton) testTabButton.style.display = isExamPrep ? 'flex' : 'none';
        if (planTabButton) planTabButton.style.display = isExamPrep ? 'flex' : 'none';
        // Анализ тем можно оставить для обоих режимов, или тоже скрывать
        // if (topicAnalysisButton) topicAnalysisButton.style.display = isExamPrep ? 'flex' : 'none';

        // 4. Если текущая активная вкладка скрыта, переключиться на первую видимую
        const activeTab = document.querySelector('.content-tab.active');
        if (activeTab && activeTab.style.display === 'none') {
            const firstVisibleTab = document.querySelector('.content-tab:not([style*="display: none"])');
            if (firstVisibleTab) {
                handleTabSwitch({ currentTarget: firstVisibleTab }); // Имитируем клик
            }
        }

        console.log(`UI настроено для цели: ${goal}`);
    }

    /**
     * Рендерит ярлыки быстрого доступа в зависимости от цели.
     */
    function renderShortcutsForGoal(goal, container) {
         if (!container) return;
         container.innerHTML = ''; // Clear previous shortcuts

         if (goal === 'exam_prep') {
             container.innerHTML = `
                 <div class="shortcut-card card" data-animate style="--animation-order: 7;">
                      <div class="shortcut-icon"><i class="fas fa-graduation-cap"></i></div>
                      <h3 class="shortcut-title">Diagnostický Test</h3>
                      <p class="shortcut-desc">Ověřte své znalosti pro přijímačky.</p>
                      <a href="/dashboard/procvicovani/test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Test</a>
                 </div>
                  <div class="shortcut-card card" data-animate style="--animation-order: 8;">
                      <div class="shortcut-icon"><i class="fas fa-tasks"></i></div>
                      <h3 class="shortcut-title">Studijní Plán</h3>
                      <p class="shortcut-desc">Zobrazte si svůj personalizovaný plán přípravy.</p>
                      <a href="/dashboard/procvicovani/plan.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Zobrazit Plán</a>
                 </div>
                  <div class="shortcut-card card" data-animate style="--animation-order: 9;">
                      <div class="shortcut-icon"><i class="fas fa-book-open"></i></div>
                      <h3 class="shortcut-title">AI Tutor (Lekce)</h3>
                      <p class="shortcut-desc">Nechte si vysvětlit témata z vašeho plánu.</p>
                      <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a>
                 </div>
                 `;
         } else { // math_learning
             container.innerHTML = `
                  <div class="shortcut-card card" data-animate style="--animation-order: 7;">
                      <div class="shortcut-icon"><i class="fas fa-calculator"></i></div>
                      <h3 class="shortcut-title">Procvičit Témata</h3>
                      <p class="shortcut-desc">Vyberte si téma a procvičujte příklady.</p>
                      <a href="#" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="alert('Funkce výběru témat pro procvičování zatím není implementována.'); return false;">Vybrat Téma</a>
                  </div>
                  <div class="shortcut-card card" data-animate style="--animation-order: 8;">
                      <div class="shortcut-icon"><i class="fas fa-chalkboard-teacher"></i></div>
                      <h3 class="shortcut-title">AI Vysvětlení</h3>
                      <p class="shortcut-desc">Nechte si od AI vysvětlit matematické koncepty.</p>
                      <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a>
                  </div>
                  <div class="shortcut-card card" data-animate style="--animation-order: 9;">
                      <div class="shortcut-icon"><i class="fas fa-chart-line"></i></div>
                      <h3 class="shortcut-title">Můj Pokrok</h3>
                      <p class="shortcut-desc">Sledujte své zlepšení v matematice.</p>
                      <a href="/dashboard/pokrok.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Pokrok</a>
                  </div>
                  `;
         }
         container.classList.remove('loading');
         // Re-initialize animations for the new content
         if (typeof initScrollAnimations === 'function') initScrollAnimations();
     }

     // Fallback function if the one from dashboard.js is not available
     if (typeof window.renderShortcuts === 'undefined') {
         window.renderShortcuts = function() {
             console.warn("Using fallback renderShortcuts in main.js");
             configureUIForGoal(currentProfile?.learning_goal || 'exam_prep');
         }
     }
    // --- END: Goal Selection Functions ---

    // --- Load Page Data (Modified) ---
    async function loadPageData() {
        // <<< CHECK GOAL AT THE START >>>
        const goal = currentProfile?.learning_goal;
        if (!goal) {
            console.warn("[Load Page Data] Cíl není nastaven. Zobrazuji modální okno.");
            showGoalSelectionModal(); // Show modal if goal is not set
            // Stop further data loading and hide content sections
             setLoadingState('all', false);
             // Make sure content sections are hidden
             if (ui.practiceTabContent) ui.practiceTabContent.style.display = 'none';
             if (ui.testResultsTabContent) ui.testResultsTabContent.style.display = 'none';
             if (ui.studyPlanTabContent) ui.studyPlanTabContent.style.display = 'none';
             if (ui.topicAnalysisTabContent) ui.topicAnalysisTabContent.style.display = 'none';
            return;
        }
        // Hide modal if it was somehow left open
         if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none';
         // Make sure main content sections are ready to be displayed after loading
         if (ui.practiceTabContent) ui.practiceTabContent.style.display = 'block'; // Or adjust based on active tab
         if (ui.testResultsTabContent) ui.testResultsTabContent.style.display = 'block';
         if (ui.studyPlanTabContent) ui.studyPlanTabContent.style.display = 'block';
         if (ui.topicAnalysisTabContent) ui.topicAnalysisTabContent.style.display = 'block';


        if (!currentUser || !currentProfile || !supabase) {
            showError("Chyba: Nelze načíst data, chybí informace o uživateli nebo spojení.", true);
            setLoadingState('all', false);
            return;
        }
        console.log(`🔄 [Load Page Data] Loading data for goal: ${goal}...`);
        setLoadingState('all', true);
        hideError();
        // Render skeletons only if the respective container exists
        if(ui.statsCards) renderStatsSkeletons(ui.statsCards);
        if(ui.testResultsContent) renderTestSkeletons(ui.testResultsContent);
        if(ui.studyPlanContent) renderPlanSkeletons(ui.studyPlanContent);
        if(ui.topicAnalysisContent) renderTopicSkeletons(ui.topicAnalysisContent);
        // Render shortcuts based on the *current* goal immediately
        configureUIForGoal(goal);


        try {
            // Pass the 'goal' to fetching functions
            const stats = await fetchDashboardStats(currentUser.id, currentProfile);
            userStatsData = stats; // Store globally

            const [diagnostics, plan, topics] = await Promise.all([
                fetchDiagnosticResults(currentUser.id, goal),
                fetchActiveStudyPlan(currentUser.id, goal),
                fetchTopicProgress(currentUser.id, goal)
            ]);
            diagnosticResultsData = diagnostics || [];
            studyPlanData = plan || null;
            topicProgressData = topics || [];
            if (studyPlanData) {
                planActivitiesData = await fetchPlanActivities(studyPlanData.id, goal);
            } else {
                planActivitiesData = [];
            }

            // Pass 'goal' to rendering functions
            renderStatsCards(userStatsData);
            renderTestResults(diagnosticResultsData, goal);
            renderStudyPlanOverview(studyPlanData, planActivitiesData, goal);
            renderTopicAnalysis(topicProgressData, goal);

             // Show diagnostic prompt only if goal is exam_prep and no results exist
             if (goal === 'exam_prep' && diagnosticResultsData.length === 0 && ui.diagnosticPrompt) {
                 ui.diagnosticPrompt.style.display = 'flex';
                 if(ui.testResultsEmpty) ui.testResultsEmpty.style.display = 'none';
                 if(ui.studyPlanEmpty) ui.studyPlanEmpty.style.display = 'none';
                 if(ui.topicAnalysisEmpty) ui.topicAnalysisEmpty.style.display = 'none';
             } else if (ui.diagnosticPrompt) {
                 ui.diagnosticPrompt.style.display = 'none';
             }


            // Ensure the correct tab is active after loading
            const currentActiveTabButton = document.querySelector('.content-tab.active');
             const currentActiveTabContentId = currentActiveTabButton ? currentActiveTabButton.dataset.tab : 'practice-tab'; // Default to practice
             document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
             const targetContent = document.getElementById(currentActiveTabContentId);
             if (targetContent) targetContent.classList.add('active');
             else if (ui.practiceTabContent) ui.practiceTabContent.classList.add('active'); // Fallback

            console.log("✅ [Load Page Data] All data loaded and rendered.");

        } catch (error) {
            console.error("❌ [Load Page Data] Error loading page data:", error);
            showError(`Nepodařilo se načíst data pro stránku Procvičování: ${error.message}`, true);
            // Render empty/error states
            renderStatsCards(null);
            renderTestResults([], goal);
            renderStudyPlanOverview(null, [], goal);
            renderTopicAnalysis([], goal);
        } finally {
            setLoadingState('all', false);
            initTooltips();
        }
    }

    // --- Event Handlers (Keep existing, like handleTabSwitch, handleRefreshClick) ---
    function handleTabSwitch(event) {
        const tabButton = event.currentTarget;
        const tabId = tabButton?.dataset?.tab;
        if (!tabId || !ui.contentTabsNodeList) return; // Check if elements exist

        console.log(`[UI TabSwitch] Switching to tab: ${tabId}`);

        // Deactivate all tabs and content panes
        ui.contentTabsNodeList.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // Activate the clicked tab and its content pane
        tabButton.classList.add('active');
        const activeContent = document.getElementById(tabId);
        if (activeContent) {
            activeContent.classList.add('active');
            // Re-trigger animations for the newly activated content
            requestAnimationFrame(() => {
                activeContent.querySelectorAll('[data-animate]').forEach(el => {
                    el.classList.remove('animated'); // Remove first to allow re-animation
                });
                // Use the initScrollAnimations function if available
                if (typeof initScrollAnimations === 'function') {
                     initScrollAnimations();
                 } else { // Fallback if function is missing
                     activeContent.querySelectorAll('[data-animate]').forEach(el => el.classList.add('animated'));
                 }
            });
        } else {
            console.warn(`[UI TabSwitch] Content for tab ${tabId} not found!`);
             // Fallback: Activate the first tab content if the target is missing
             const firstContent = document.querySelector('.tab-content');
             if (firstContent) firstContent.classList.add('active');
        }

        // Scroll to top smoothly
        if (ui.mainContent) {
             ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
    async function handleRefreshClick() {
        if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; }
        if (Object.values(isLoading).some(s => s)) { showToast('Info', 'Data se již načítají.', 'info'); return; }
        const refreshBtn = ui.refreshDataBtn; // Use cached element
        const icon = refreshBtn?.querySelector('i');
        const text = refreshBtn?.querySelector('.refresh-text');
        if(refreshBtn) refreshBtn.disabled = true;
        if(icon) icon.classList.add('fa-spin');
        if(text) text.textContent = 'RELOADING...';
        await loadPageData(); // Reload all data
        if(refreshBtn) refreshBtn.disabled = false;
        if(icon) icon.classList.remove('fa-spin');
        if(text) text.textContent = 'RELOAD';
        if (typeof initTooltips === 'function') initTooltips();
    }

    // --- Setup Event Listeners (Modified) ---
    function setupEventListeners() {
        console.log("[Procvičování SETUP] Setting up event listeners...");
        cacheDOMElements(); // Ensure UI elements are cached

        const safeAddListener = (element, eventType, handler, key) => {
            if (element) { element.addEventListener(eventType, handler); }
            else { console.warn(`[SETUP] Element not found for listener: ${key}`); }
        };

        const safeAddListenerToAll = (selector, eventType, handler, key) => {
             const elements = document.querySelectorAll(selector);
             if (elements && elements.length > 0) { elements.forEach(el => el.addEventListener(eventType, handler)); }
             else { console.warn(`[SETUP] No elements found for selector: ${key}`); }
         };

        // Sidebar/Menu (Assume provided by dashboard.js or define here)
        // safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
        // safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
        // safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');
        // safeAddListenerToAll('.sidebar-link', 'click', () => { if (window.innerWidth <= 992 && typeof closeMenu === 'function') closeMenu(); }, '.sidebar-link');

        // Page Specific
        safeAddListener(ui.refreshDataBtn, 'click', handleRefreshClick, 'refreshDataBtn');

        // Tabs
        if (ui.contentTabsNodeList) {
            ui.contentTabsNodeList.forEach(tab => {
                safeAddListener(tab, 'click', handleTabSwitch, `tab-${tab.dataset.tab}`);
            });
        } else {
             console.error("[SETUP] Tab buttons not found, cannot add listeners.");
        }


        // Buttons within potentially empty states
        safeAddListener(ui.startTestBtnPrompt, 'click', () => window.location.href = 'test1.html', 'startTestBtnPrompt');
        safeAddListener(ui.startTestBtnResults, 'click', () => window.location.href = 'test1.html', 'startTestBtnResults');
        safeAddListener(ui.startTestBtnPlan, 'click', () => window.location.href = 'test1.html', 'startTestBtnPlan');
        safeAddListener(ui.startTestBtnAnalysis, 'click', () => window.location.href = 'test1.html', 'startTestBtnAnalysis');

        // Global listeners (Assume provided by dashboard.js or define here)
        // window.addEventListener('online', updateOnlineStatus);
        // window.addEventListener('offline', updateOnlineStatus);
        // updateOnlineStatus(); // Initial check
        // if (ui.mainContent && typeof initHeaderScrollDetection === 'function') initHeaderScrollDetection();

        console.log("[Procvičování SETUP] Event listeners set up.");
    }

    // --- Initialize App ---
    function initializeApp() {
        console.log("[INIT Procvičování] Adding 'dashboardReady' event listener...");
        // Use dashboardReady event to ensure supabase, user, profile are ready
        document.addEventListener('dashboardReady', async (event) => {
            console.log("[INIT Procvičování] 'dashboardReady' event received.");

            supabase = event?.detail?.client;
            currentUser = event?.detail?.user;
            currentProfile = event?.detail?.profile;
            allTitles = event?.detail?.titles || []; // Get titles for sidebar

            if (!supabase || !currentUser || !currentProfile) {
                console.error("[INIT Procvičování] Critical data missing after 'dashboardReady'.", { supabase, currentUser, currentProfile });
                showError("Chyba načítání základních dat pro Procvičování. Zkuste obnovit stránku.", true);
                const il = document.getElementById('initial-loader'); // Use direct ID access here
                 if (il && !il.classList.contains('hidden')) { il.classList.add('hidden'); setTimeout(() => { if(il) il.style.display = 'none'; }, 300); }
                return;
            }

            console.log(`[INIT Procvičování] User: ${currentUser.id}, Profile:`, currentProfile);

            try {
                cacheDOMElements(); // Cache elements now that DOM is ready
                setupEventListeners();
                if (typeof updateCopyrightYear === 'function') updateCopyrightYear();
                if (typeof initMouseFollower === 'function') initMouseFollower();
                if (typeof initHeaderScrollDetection === 'function') initHeaderScrollDetection();

                // --- Goal Check ---
                if (!currentProfile.learning_goal) {
                    console.log("[INIT Procvičování] Cíl nenastaven, zobrazuji modální okno.");
                    showGoalSelectionModal();
                     // Hide main content sections until goal is selected
                     setLoadingState('all', false); // Ensure no loading spinners initially
                     if(ui.practiceTabContent) ui.practiceTabContent.style.display = 'none';
                     if(ui.testResultsTabContent) ui.testResultsTabContent.style.display = 'none';
                     if(ui.studyPlanTabContent) ui.studyPlanTabContent.style.display = 'none';
                     if(ui.topicAnalysisTabContent) ui.topicAnalysisTabContent.style.display = 'none';
                     // Show the tab container itself if needed, or just let the modal overlay everything
                } else {
                    console.log(`[INIT Procvičování] Cíl již nastaven: ${currentProfile.learning_goal}`);
                    configureUIForGoal(currentProfile.learning_goal);
                    await loadPageData(); // Load data based on the existing goal
                }
                // --- End Goal Check ---

                if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }

                console.log("✅ [INIT Procvičování] Page fully initialized.");

            } catch (error) {
                console.error("❌ [INIT Procvičování] Error during page-specific setup:", error);
                showError(`Chyba inicializace stránky Procvičování: ${error.message}`, true);
                if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show content to display error
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

    // --- Run ---
    // The initializeApp function now waits for the 'dashboardReady' event
    // which should be dispatched by dashboard.js when it's ready.
    // Make sure dashboard.js is loaded and dispatches this event.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp(); // If DOM is already ready, but dashboard might not be
    }

})(); // End IIFE