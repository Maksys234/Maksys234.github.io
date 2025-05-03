// dashboard/procvicovani/main.js
// Version: 24.10.1 - Added checks for critical elements in cacheDOMElements and showGoalSelectionModal

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
        shortcuts: false, notifications: false,
        goalSelection: false, all: false
    };
    let goalSelectionInProgress = false;
    let pendingGoal = null;

    // --- Кэш UI Элементов ---
    const ui = {}; // Будет заполнен функцией cacheDOMElements

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
            'goal-selection-modal',
            'goal-step-1', // Step 1 container
            'goal-step-accelerate', // Step 2 container for accelerate
            'accelerate-areas-group', 'accelerate-reason-group', // Specific groups within step 2
            'goal-step-review',     // Step 2 container for review
            'review-areas-group',
            'goal-step-explore',    // Step 2 container for explore
            'explore-level-group',
            'initial-loader', 'sidebar-overlay', 'sidebar', 'main-mobile-menu-toggle',
            'sidebar-close-toggle', 'sidebar-toggle-btn', 'sidebar-avatar',
            'sidebar-name', 'sidebar-user-title', 'currentYearSidebar',
            'dashboard-title', 'currentYearFooter', 'mouse-follower',
            'tabs-wrapper' // Added ID from previous step
            // Note: Notification elements are likely cached globally or dynamically added,
            // We'll rely on checks before use rather than caching everything here.
        ];
        const potentiallyMissingIds = ['toastContainer']; // Add elements here that are optional
        const criticalMissingIds = ['goalStep1']; // Add elements here that are critical

        const notFound = [];
        const missingCritical = [];
        const missingPotential = [];

        ids.forEach(id => {
            const element = document.getElementById(id);
            // Convert kebab-case to camelCase for ui object keys
            const key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
            if (element) {
                ui[key] = element;
            } else {
                notFound.push(id);
                ui[key] = null; // Explicitly set to null if not found
                if (criticalMissingIds.includes(key)) {
                    missingCritical.push(key);
                } else if (potentiallyMissingIds.includes(key)) {
                    missingPotential.push(key);
                }
            }
        });

        // Query selectors for elements without specific IDs if necessary (example)
        ui.contentTabs = document.querySelectorAll('.content-tab');
        ui.modalBackBtns = document.querySelectorAll('.modal-back-btn');
        ui.modalConfirmBtns = document.querySelectorAll('.modal-confirm-btn');
        ui.dashboardHeader = document.querySelector('.dashboard-header');
        // Add other querySelectors if needed

        // Specific check after the loop for critical elements
        if (missingCritical.length > 0) {
            console.error("[CACHE DOM] CRITICAL elements missing after search:", missingCritical);
            // You might want to throw an error here or handle it more gracefully
            // depending on how critical these elements are for the app's core functionality.
        }
        if (missingPotential.length > 0) {
             console.warn(`[CACHE DOM] Potential elements missing: (${missingPotential.length})`, missingPotential);
        }

        if (notFound.length > 0 && missingCritical.length === 0) {
            console.log(`[CACHE DOM] Some non-critical elements not found: (${notFound.length})`, notFound);
        } else if (notFound.length === 0) {
            console.log("[CACHE DOM] All primary elements cached successfully.");
        }
        console.log("[Procvičování Cache DOM] Caching attempt complete.");
    }

    // --- Карты иконок и визуалов ---
    const topicIcons = { "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon", "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar", "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar", "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book" };
    const activityVisuals = { test: { name: 'Test', icon: 'fa-vial', class: 'test' }, exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' }, badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' }, diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' }, plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' }, other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' }, default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' } };

    // --- START: Вспомогательные функции ---
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) {
        const container = ui.toastContainer; // Use cached element
        if (!container) { console.log(`No toast container found. Toast (${type}): ${title} - ${message}`); return; }
        try {
            const toastId = `toast-${Date.now()}`;
            const toastElement = document.createElement('div');
            toastElement.className = `toast ${type}`;
            toastElement.id = toastId;
            toastElement.setAttribute('role', 'alert');
            toastElement.setAttribute('aria-live', 'assertive');
            toastElement.innerHTML = `
                <i class="toast-icon"></i>
                <div class="toast-content">
                    ${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}
                    <div class="toast-message">${sanitizeHTML(message)}</div>
                </div>
                <button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`;

            const icon = toastElement.querySelector('.toast-icon');
            icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`;

            toastElement.querySelector('.toast-close').addEventListener('click', () => {
                toastElement.classList.remove('show');
                setTimeout(() => toastElement.remove(), 400);
            });

            container.appendChild(toastElement);
            requestAnimationFrame(() => { toastElement.classList.add('show'); });

            setTimeout(() => {
                if (toastElement.parentElement) {
                    toastElement.classList.remove('show');
                    setTimeout(() => toastElement.remove(), 400);
                }
            }, duration);
        } catch (e) {
            console.error("Error showing toast:", e);
        }
    }
    function showError(message, isGlobal = false) { console.error("Error occurred:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Obnovit</button></div>`; ui.globalError.style.display = 'block'; } else { showToast('CHYBA', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatDate(dateString) { try { return dateString ? new Date(dateString).toLocaleDateString('cs-CZ') : '-'; } catch (e) { return '-'; } }
    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return '--:--'; const m = Math.floor(seconds / 60); const ss = Math.round(seconds % 60); return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`; }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function updateCopyrightYear() { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
    function applyInitialSidebarState() { try { const state = localStorage.getItem(SIDEBAR_STATE_KEY); const collapsed = state === 'collapsed'; document.body.classList.toggle('sidebar-collapsed', collapsed); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) icon.className = collapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; if(ui.sidebarToggleBtn) ui.sidebarToggleBtn.title = collapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (e) { console.error("Sidebar state error:", e); } }
    function toggleSidebar() { try { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; if(ui.sidebarToggleBtn) ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (error) { console.error("[Sidebar Toggle] Error:", error); } }
    function updateSidebarProfile(profile, titlesData) {
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) {
             console.warn("Skipping sidebar profile update - elements missing.");
             return;
        }
        if (profile) {
             const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || currentUser?.email?.split('@')[0] || 'Pilot';
             ui.sidebarName.textContent = sanitizeHTML(displayName);
             const initials = getInitials(profile);
             const avatarUrl = profile.avatar_url;
             // Add timestamp to force refresh if URL might be cached
             const finalAvatarUrl = avatarUrl ? `${sanitizeHTML(avatarUrl)}?t=${Date.now()}` : null;
             ui.sidebarAvatar.innerHTML = finalAvatarUrl ? `<img src="${finalAvatarUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
             // <<< Error Handling for Image Load >>>
             const img = ui.sidebarAvatar.querySelector('img');
             if (img) {
                 img.onerror = function() {
                     console.warn(`Failed to load sidebar avatar: ${this.src}. Displaying initials.`);
                     ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); // Fallback to initials
                 };
             }
             // <<< End Error Handling >>>

             const selectedTitleKey = profile.selected_title;
             let displayTitle = 'Pilot'; // Default
             if (selectedTitleKey && titlesData && titlesData.length > 0) {
                 const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey);
                 if (foundTitle && foundTitle.name) {
                     displayTitle = foundTitle.name;
                 } else {
                      console.warn(`[UI Update Sidebar] Title key "${selectedTitleKey}" not found in fetched titles.`);
                 }
             } else if (selectedTitleKey) {
                  console.warn(`[UI Update Sidebar] Selected title key present, but titles list is empty or not loaded yet.`);
             }
             ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
             ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); // Update tooltip
        } else {
             ui.sidebarName.textContent = "Nepřihlášen";
             ui.sidebarAvatar.textContent = '?';
             if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot';
             if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title');
        }
    }
    function initTooltips() { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip.tooltipstered').each(function() { try { window.jQuery(this).tooltipster('destroy'); } catch (e) { /* ignore */ } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } }
    function initScrollAnimations() { /* Placeholder */ }
    function initHeaderScrollDetection() { /* Placeholder */ }
    function updateOnlineStatus() { /* Placeholder */ }
    function initMouseFollower() { /* Placeholder */ }
    // --- END: Вспомогательные функции ---

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
                notifications: { /* Handled elsewhere */ },
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
                if (container?.querySelector(skeletonSelector) && !['stats', 'shortcuts'].includes(key)) {
                    const skeletons = container.querySelectorAll(skeletonSelector);
                    skeletons.forEach(sk => sk.parentElement.remove()); // Remove parent if skeleton was inside
                }
                // Ensure content/empty state visibility is handled after data rendering
                // Example: Check after data has been potentially rendered
                setTimeout(() => {
                    if (content && empty) {
                        const hasContent = content.innerHTML.trim() !== '' && !content.querySelector(skeletonSelector);
                        let displayType = 'block';
                        if (content.id === 'topic-grid' || content.id === 'stats-cards' || content.id === 'shortcuts-grid' || content.id === 'main-plan-schedule') displayType = 'grid';
                        else if (content.classList.contains('test-stats')) displayType = 'grid';
                        content.style.display = hasContent ? displayType : 'none';
                        empty.style.display = hasContent ? 'none' : 'block';
                    }
                }, 50); // Short delay
            }
        };

        if (sectionKey === 'all') { Object.keys(isLoading).forEach(key => { if (key !== 'all' && key !== 'goalSelection' && key !== 'notifications') updateSingleSection(key, isLoadingFlag); }); }
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
    async function fetchDashboardStats(userId, profileData) { /* ... implementation ... */ return {}; }
    async function fetchDiagnosticResults(userId, goal) { /* ... implementation ... */ return []; }
    async function fetchActiveStudyPlan(userId, goal) { /* ... implementation ... */ return null; }
    async function fetchPlanActivities(planId, goal) { /* ... implementation ... */ return []; }
    async function fetchTopicProgress(userId, goal) { /* ... implementation ... */ return []; }
    // --- Конец Загрузки Данных ---

    // --- Рендеринг UI ---
    function renderStatsCards(stats) { /* ... implementation ... */ }
    function calculateAverageScore(results) { /* ... implementation ... */ return 0; }
    function renderTestChart(chartData) { /* ... implementation ... */ }
    function renderTestResults(results, goal) { /* ... implementation ... */ }
    function renderStudyPlanOverview(plan, activities, goal) { /* ... implementation ... */ }
    function renderTopicAnalysis(topics, goal) { /* ... implementation ... */ }
    // --- Конец Рендеринга UI ---

    // --- START: Goal Selection Logic (Multi-Step) ---
    function showGoalSelectionModal() {
        // ** ADDED Check **: Verify ui elements exist before proceeding
        if (!ui.goalSelectionModal || !ui.goalStep1) {
            console.error("[GoalModal] CRITICAL: Modal container (#goal-selection-modal) or Step 1 (#goal-step-1) not found in DOM! Cannot show modal.");
            // Display a user-facing error if possible
            showError("Chyba: Nelze zobrazit dialog pro výběr cíle. Chybí HTML elementy.", true);
            // Optionally, disable parts of the UI that depend on a goal
            if(ui.mainContent) ui.mainContent.classList.add('interaction-disabled');
            return; // Stop execution here
        }

        console.log("[GoalModal] Showing goal selection modal (Step 1)...");
        ui.goalSelectionModal.querySelectorAll('.modal-step').forEach(step => step.classList.remove('active'));
        ui.goalStep1.classList.add('active');
        ui.goalSelectionModal.style.display = 'flex';
        requestAnimationFrame(() => ui.goalSelectionModal.classList.add('active'));

        // Find buttons within step 1 using data attributes
        const optionButtons = ui.goalStep1.querySelectorAll('.goal-option-card[data-goal]');
        if (optionButtons.length === 0) {
            console.error("[GoalModal] No goal option buttons found within #goal-step-1!");
            return;
        }

        optionButtons.forEach(button => {
            const goal = button.dataset.goal;
            if (!goal) {
                console.warn("[GoalModal] Goal button missing data-goal attribute:", button);
                return;
            }
            const handler = () => handleInitialGoalSelection(goal);
            // Clean up old listener before adding new one
            if (button._goalHandler) button.removeEventListener('click', button._goalHandler);
            button.addEventListener('click', handler);
            button._goalHandler = handler; // Store reference to remove later if needed
        });
        console.log("[GoalModal] Step 1 listeners attached successfully.");
    }
    function handleInitialGoalSelection(selectedGoal) { if (goalSelectionInProgress) return; console.log(`[GoalModal] Initial goal selected: ${selectedGoal}`); pendingGoal = selectedGoal; if (selectedGoal === 'exam_prep') { saveGoalAndProceed(selectedGoal); } else { showStep2(selectedGoal); } }
    function showStep2(goalType) {
        const step2Id = `goal-step-${goalType.replace('math_', '')}`;
        const step2 = ui[step2Id.replace(/-/g, '_').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/-([a-z])/g, g => g[1].toUpperCase())] || document.getElementById(step2Id); // Use cached or find

        if (!ui.goalSelectionModal || !ui.goalStep1 || !step2) { console.error(`[GoalModal] Cannot show step 2: Modal, Step 1, or Step 2 element not found (Step2 ID: ${step2Id}, Found: ${!!step2})`); return; }

        console.log(`[GoalModal] Showing step 2: ${goalType}`);
        ui.goalStep1.classList.remove('active'); step2.classList.add('active');
        const formElements = step2.querySelectorAll('input[type="checkbox"], input[type="radio"]'); formElements.forEach(el => { if (el.type === 'checkbox' || el.type === 'radio') el.checked = false; });
        const backBtn = step2.querySelector('.modal-back-btn'); if (backBtn) { const backHandler = () => handleBackToStep1(ui.goalStep1, step2); backBtn.removeEventListener('click', backHandler); backBtn.addEventListener('click', backHandler, { once: true }); }
        const confirmBtn = step2.querySelector('.modal-confirm-btn'); if (confirmBtn) { const confirmHandler = () => handleStep2Confirm(goalType); confirmBtn.removeEventListener('click', confirmHandler); confirmBtn.addEventListener('click', confirmHandler); confirmBtn.disabled = false; confirmBtn.innerHTML = 'Potvrdit a pokračovat'; }
    }
    function handleBackToStep1(step1, currentStep2) { console.log("[GoalModal] Going back to step 1..."); if(currentStep2) currentStep2.classList.remove('active'); if(step1) step1.classList.add('active'); pendingGoal = null; }
    function handleStep2Confirm(goalType) { if (goalSelectionInProgress) return; const step2Id = `goal-step-${goalType.replace('math_', '')}`; const step2Element = ui[step2Id.replace(/-/g, '_').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/-([a-z])/g, g => g[1].toUpperCase())] || document.getElementById(step2Id); if (!step2Element) { console.error(`[GoalModal] Step 2 element ${step2Id} not found during confirm.`); return; } const details = {}; let isValid = true; try { if (goalType === 'math_accelerate') { details.accelerate_areas = Array.from(step2Element.querySelectorAll('input[name="accelerate_area"]:checked')).map(cb => cb.value); const reasonRadio = step2Element.querySelector('input[name="accelerate_reason"]:checked'); details.accelerate_reason = reasonRadio ? reasonRadio.value : null; if(details.accelerate_areas.length === 0) { showToast("Chyba", "Vyberte prosím alespoň jednu oblast zájmu.", "warning"); isValid = false; } if(!details.accelerate_reason) { showToast("Chyba", "Vyberte prosím důvod.", "warning"); isValid = false; } } else if (goalType === 'math_review') { details.review_areas = Array.from(step2Element.querySelectorAll('input[name="review_area"]:checked')).map(cb => cb.value); } else if (goalType === 'math_explore') { const levelRadio = step2Element.querySelector('input[name="explore_level"]:checked'); details.explore_level = levelRadio ? levelRadio.value : null; if(!details.explore_level) { showToast("Chyba", "Vyberte prosím vaši úroveň.", "warning"); isValid = false; } } } catch (e) { console.error("[GoalModal] Error getting step 2 details:", e); isValid = false; showToast("Chyba", "Nastala chyba při zpracování výběru.", "error"); } if (isValid) { console.log(`[GoalModal] Step 2 details collected for ${goalType}:`, details); saveGoalAndProceed(pendingGoal, details); } }
    async function saveGoalAndProceed(goal, details = null) { if (goalSelectionInProgress || !goal) return; goalSelectionInProgress = true; setLoadingState('goalSelection', true); console.log(`[GoalModal] Saving goal: ${goal}, with details:`, details); const activeStep = ui.goalSelectionModal?.querySelector('.modal-step.active'); const confirmButton = activeStep?.querySelector('.modal-confirm-btn'); const backButton = activeStep?.querySelector('.modal-back-btn'); if (confirmButton) { confirmButton.disabled = true; confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...'; } if (backButton) backButton.disabled = true; try { if (!supabase || !currentUser) throw new Error("Supabase client or user not available."); const updatePayload = { learning_goal: goal, updated_at: new Date().toISOString() }; let finalPreferences = currentProfile?.preferences || {}; if (details && Object.keys(details).length > 0) { finalPreferences = { ...finalPreferences, goal_details: details }; } else { delete finalPreferences.goal_details; } updatePayload.preferences = finalPreferences; console.log("[GoalModal] Payload to update:", updatePayload); const { data, error } = await supabase.from('profiles').update(updatePayload).eq('id', currentUser.id).select('*, selected_title').single(); if (error) throw error; currentProfile = data; console.log("[GoalModal] Goal saved successfully:", currentProfile.learning_goal, currentProfile.preferences); let goalText = goal; switch(goal) { case 'exam_prep': goalText = 'Příprava na zkoušky'; break; case 'math_accelerate': goalText = 'Učení napřed'; break; case 'math_review': goalText = 'Doplnění mezer'; break; case 'math_explore': goalText = 'Volné prozkoumávání'; break; } showToast('Cíl uložen!', `Váš cíl byl nastaven na: ${goalText}.`, 'success'); if (ui.goalSelectionModal) { ui.goalSelectionModal.classList.remove('active'); setTimeout(() => { if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; }, 300); } if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'block'; document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'block'); configureUIForGoal(goal); await loadPageData(); if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled'); } catch (error) { console.error("[GoalModal] Error saving goal/preferences:", error); showToast('Chyba', 'Nepodařilo se uložit váš cíl.', 'error'); if (confirmButton) { confirmButton.disabled = false; confirmButton.innerHTML = 'Potvrdit a pokračovat'; } if (backButton) backButton.disabled = false; } finally { goalSelectionInProgress = false; setLoadingState('goalSelection', false); pendingGoal = null; } }
    // --- END: Goal Selection Logic ---

    // --- Рендеринг Ярлыков ---
    function renderShortcutsForGoal(goal, container) {
        if (!container) { console.warn("Shortcut container not found"); return; }
        setLoadingState('shortcuts', true); container.innerHTML = '';
        console.log(`[Shortcuts] Rendering shortcuts for goal: ${goal}`);
        let shortcutsHTML = '';
        // Define shortcuts as objects for easier management
        const shortcuts = {
             test: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-graduation-cap"></i></div><h3 class="shortcut-title">Diagnostický Test</h3><p class="shortcut-desc">Ověřte své znalosti pro přijímačky.</p><a href="/dashboard/procvicovani/test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Test</a></div>`,
             plan: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-tasks"></i></div><h3 class="shortcut-title">Studijní Plán</h3><p class="shortcut-desc">Zobrazte si svůj personalizovaný plán.</p><a href="/dashboard/procvicovani/plan.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Zobrazit Plán</a></div>`,
             tutor: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-book-open"></i></div><h3 class="shortcut-title">AI Tutor (Lekce)</h3><p class="shortcut-desc">Nechte si vysvětlit témata z plánu nebo osnovy.</p><a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a></div>`,
             nextTopic: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-forward"></i></div><h3 class="shortcut-title">Další Téma Osnovy</h3><p class="shortcut-desc">Pokračujte v učení podle standardní osnovy.</p><a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Učit se Další</a></div>`,
             curriculum: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-stream"></i></div><h3 class="shortcut-title">Přehled Osnovy</h3><p class="shortcut-desc">Zobrazte si přehled témat dle školní osnovy.</p><a href="/dashboard/procvicovani/plan.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Osnovu</a></div>`,
             weakness: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-search"></i></div><h3 class="shortcut-title">Moje Slabiny</h3><p class="shortcut-desc">Zobrazte témata, kde potřebujete nejvíce zlepšení.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="switchActiveTab('topic-analysis-tab'); return false;">Analýza Témat</a></div>`,
             review: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-history"></i></div><h3 class="shortcut-title">Opakování</h3><p class="shortcut-desc">Procvičte si témata, která jste dlouho neprobírali.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="showToast('Info','Funkce opakování zatím není implementována.','info'); return false;">Spustit Opakování</a></div>`,
             explore: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-compass"></i></div><h3 class="shortcut-title">Procházet Témata</h3><p class="shortcut-desc">Vyberte si libovolné matematické téma k učení.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="switchActiveTab('topic-analysis-tab'); return false;">Vybrat Téma</a></div>`,
             random: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-dumbbell"></i></div><h3 class="shortcut-title">Náhodné Cvičení</h3><p class="shortcut-desc">Spusťte náhodné cvičení pro rychlé procvičení.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="showToast('Info','Funkce náhodného cvičení zatím není implementována.','info'); return false;">Náhodné Cvičení</a></div>`,
             progress: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-chart-line"></i></div><h3 class="shortcut-title">Můj Pokrok</h3><p class="shortcut-desc">Sledujte své zlepšení v matematice.</p><a href="/dashboard/pokrok.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Pokrok</a></div>`
         };

        switch (goal) {
            case 'exam_prep': shortcutsHTML = shortcuts.test + shortcuts.plan + shortcuts.tutor; break;
            case 'math_accelerate': shortcutsHTML = shortcuts.nextTopic + shortcuts.curriculum + shortcuts.tutor; break;
            case 'math_review': shortcutsHTML = shortcuts.weakness + shortcuts.review + shortcuts.tutor; break;
            case 'math_explore': shortcutsHTML = shortcuts.explore + shortcuts.random + shortcuts.tutor; break;
            default: shortcutsHTML = shortcuts.progress + shortcuts.tutor + shortcuts.random;
        }

        // Use requestAnimationFrame to ensure the DOM is ready for animation updates
        requestAnimationFrame(() => {
            if(container) {
                container.innerHTML = shortcutsHTML;
                container.classList.remove('loading');
                setLoadingState('shortcuts', false);
                // Re-initialize scroll animations for the newly added shortcut cards
                 if (typeof initScrollAnimations === 'function') {
                    initScrollAnimations();
                 }
            }
        });
    }
    // --- Конец Рендеринга Ярлыков ---


    // --- Конфигурация UI ---
    function configureUIForGoal(goal) {
        console.log(`[UI Config] Configuring UI for goal: ${goal}`);
        if (!ui || Object.keys(ui).length === 0) { console.error("[UI Config] UI cache empty, cannot configure."); return; }

        const isExamPrep = goal === 'exam_prep';

        // 1. Заголовок
        const dashboardTitle = ui.dashboardTitle;
        if (dashboardTitle) {
            let titleText = "Procvičování // "; let iconClass = "fas fa-laptop-code";
            switch(goal) {
                case 'exam_prep': titleText += "Příprava na Zkoušky"; iconClass = "fas fa-graduation-cap"; break;
                case 'math_accelerate': titleText += "Učení Napřed"; iconClass = "fas fa-rocket"; break;
                case 'math_review': titleText += "Doplnění Mezer"; iconClass = "fas fa-sync-alt"; break;
                case 'math_explore': titleText += "Volné Prozkoumávání"; iconClass = "fas fa-compass"; break;
                default: titleText += "Přehled";
            }
            dashboardTitle.innerHTML = `<i class="${iconClass}"></i> ${sanitizeHTML(titleText)}`;
        } else { console.warn("[UI Config] Dashboard title element not found."); }

        // 2. Ярлыки
        if (ui.shortcutsGrid) {
            renderShortcutsForGoal(goal, ui.shortcutsGrid);
        } else { console.warn("[UI Config] Shortcuts grid not found."); }

        // 3. Вкладки
        const testTabButton = document.querySelector('.content-tab[data-tab="test-results-tab"]');
        const planTabButton = document.querySelector('.content-tab[data-tab="study-plan-tab"]');
        const topicAnalysisButton = document.querySelector('.content-tab[data-tab="topic-analysis-tab"]');
        const practiceTabButton = document.querySelector('.content-tab[data-tab="practice-tab"]');

        if (testTabButton) testTabButton.style.display = isExamPrep ? 'flex' : 'none';
        if (planTabButton) planTabButton.style.display = (isExamPrep || goal === 'math_accelerate') ? 'flex' : 'none';
        if (topicAnalysisButton) topicAnalysisButton.style.display = 'flex'; // Always visible?
        if (practiceTabButton) practiceTabButton.style.display = 'flex'; // Overview always visible?

        // 4. Активация вкладки - Ensure the active tab is visible
        const activeTab = document.querySelector('.content-tab.active');
        if (activeTab && activeTab.style.display === 'none') {
            console.log("[UI Config] Active tab is hidden, switching to first visible tab.");
            const firstVisibleTab = document.querySelector('.content-tab:not([style*="display: none"])');
            if (firstVisibleTab) {
                 if (typeof handleTabSwitch === 'function') {
                      handleTabSwitch({ currentTarget: firstVisibleTab });
                 } else {
                     console.error("handleTabSwitch function not defined for tab switch!");
                 }
            } else { console.warn("[UI Config] No visible tabs found to switch to."); }
        } else if (!activeTab) {
             console.log("[UI Config] No active tab found, activating first visible tab.");
            const firstVisibleTab = document.querySelector('.content-tab:not([style*="display: none"])');
            if (firstVisibleTab) {
                if (typeof handleTabSwitch === 'function') {
                     handleTabSwitch({ currentTarget: firstVisibleTab });
                } else {
                     console.error("handleTabSwitch function not defined for tab switch!");
                }
            } else { console.warn("[UI Config] No visible tabs found to activate."); }
        }
        console.log(`[UI Config] UI configured for goal: ${goal}`);
    }
    // --- Конец Конфигурации UI ---


    // --- Загрузка Основных Данных Страницы ---
    async function loadPageData() {
        if (!currentProfile) { // Check if profile is loaded
            console.error("[Load Page Data] Profile not loaded. Cannot load data.");
            showError("Chyba: Profil uživatele není k dispozici.", true);
            setLoadingState('all', false);
            return;
        }
        const goal = currentProfile.learning_goal;
        if (!goal) {
             console.warn("[Load Page Data] Learning goal not set. Aborting data load.");
             if (typeof showGoalSelectionModal === 'function') showGoalSelectionModal();
             else console.error("showGoalSelectionModal is not defined!");
             setLoadingState('all', false);
             if(ui.mainContent) ui.mainContent.classList.add('interaction-disabled'); // Disable interactions
             if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'none'; // Hide tabs
             document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none'); // Hide content
             return;
        }

        if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none';
        if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled'); // Re-enable interaction
        if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'block'; // Show tabs
        // Make sure the currently active tab content is visible (controlled by handleTabSwitch)

        if (!currentUser || !supabase) { showError("Chyba: Nelze načíst data.", true); setLoadingState('all', false); return; }
        console.log(`🔄 [Load Page Data] Loading data for goal: ${goal}...`); setLoadingState('all', true); hideError();

        // Render skeletons based on which tabs are visible for the current goal
        configureUIForGoal(goal); // Re-run config to ensure visibility is correct
        if (ui.statsCards) renderStatsSkeletons(ui.statsCards);
        if (document.querySelector('.content-tab[data-tab="test-results-tab"]:not([style*="display: none"])') && ui.testResultsContent) renderTestSkeletons(ui.testResultsContent);
        if (document.querySelector('.content-tab[data-tab="study-plan-tab"]:not([style*="display: none"])') && ui.studyPlanContent) renderPlanSkeletons(ui.studyPlanContent);
        if (document.querySelector('.content-tab[data-tab="topic-analysis-tab"]:not([style*="display: none"])') && ui.topicAnalysisContent) renderTopicSkeletons(ui.topicAnalysisContent);

        try {
            const stats = await fetchDashboardStats(currentUser.id, currentProfile); userStatsData = stats; renderStatsCards(userStatsData);
            const promisesToAwait = [];
            if (goal === 'exam_prep' && document.querySelector('.content-tab[data-tab="test-results-tab"]:not([style*="display: none"])')) { promisesToAwait.push(fetchDiagnosticResults(currentUser.id, goal).then(r => { diagnosticResultsData = r || []; renderTestResults(diagnosticResultsData, goal); })); } else { setLoadingState('tests', false); if(ui.testResultsContent) ui.testResultsContent.innerHTML=''; }
            if ((goal === 'exam_prep' || goal === 'math_accelerate') && document.querySelector('.content-tab[data-tab="study-plan-tab"]:not([style*="display: none"])')) { promisesToAwait.push(fetchActiveStudyPlan(currentUser.id, goal).then(async (p) => { studyPlanData = p || null; planActivitiesData = studyPlanData ? await fetchPlanActivities(studyPlanData.id, goal) : []; renderStudyPlanOverview(studyPlanData, planActivitiesData, goal); })); } else { setLoadingState('plan', false); if(ui.studyPlanContent) ui.studyPlanContent.innerHTML=''; }
            if (document.querySelector('.content-tab[data-tab="topic-analysis-tab"]:not([style*="display: none"])')) { promisesToAwait.push(fetchTopicProgress(currentUser.id, goal).then(t => { topicProgressData = t || []; renderTopicAnalysis(topicProgressData, goal); })); } else { setLoadingState('topics', false); if(ui.topicAnalysisContent) ui.topicAnalysisContent.innerHTML=''; }

            await Promise.allSettled(promisesToAwait);

            // Show diagnostic prompt only if needed and no results exist
             if (goal === 'exam_prep' && diagnosticResultsData.length === 0 && ui.diagnosticPrompt) {
                 ui.diagnosticPrompt.style.display = 'flex';
                 if(ui.testResultsEmpty) ui.testResultsEmpty.style.display = 'none';
                 if(ui.studyPlanEmpty) ui.studyPlanEmpty.style.display = 'none';
                 if(ui.topicAnalysisEmpty) ui.topicAnalysisEmpty.style.display = 'none';
             } else if (ui.diagnosticPrompt) {
                 ui.diagnosticPrompt.style.display = 'none';
             }

            console.log("✅ [Load Page Data] All relevant data loaded and rendered for goal:", goal);
        } catch (error) {
             console.error("❌ [Load Page Data] Error loading page data:", error);
             showError(`Nepodařilo se načíst data: ${error.message}`, true);
             renderStatsCards(null); // Clear potentially loaded stats
             // Clear content for relevant tabs based on goal
             if (goal === 'exam_prep' && ui.testResultsContent) renderTestResults([], goal);
             if ((goal === 'exam_prep' || goal === 'math_accelerate') && ui.studyPlanContent) renderStudyPlanOverview(null, [], goal);
             if (ui.topicAnalysisContent) renderTopicAnalysis([], goal);
        }
        finally { setLoadingState('all', false); initTooltips(); }
    }
    // --- Конец Загрузки Данных Страницы ---

    // --- Event Handlers ---
    function handleTabSwitch(event) {
        if (!event || !event.currentTarget) return;
        const targetTab = event.currentTarget;
        const tabId = targetTab.dataset.tab;
        if (!tabId) return;
        console.log(`[Tabs] Switching to tab: ${tabId}`);
        // Update active tab button
        ui.contentTabs.forEach(tab => tab.classList.remove('active'));
        targetTab.classList.add('active');
        // Show/hide content based on tab ID
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
            // Set display based on active state to prevent flashes before animation
            content.style.display = content.id === tabId ? 'block' : 'none';
        });
         // Initialize animations for the newly displayed content
         requestAnimationFrame(() => {
            const activeContent = document.getElementById(tabId);
            if (activeContent) {
                 activeContent.querySelectorAll('[data-animate]').forEach((el, index) => {
                     el.style.setProperty('--animation-order', index); // Reset animation order
                     el.classList.remove('animated'); // Reset animation state
                 });
                 initScrollAnimations(); // Re-run animation observer
            }
         });
    }
    // Helper to switch tab programmatically
    function switchActiveTab(tabId) {
        const tabButton = document.querySelector(`.content-tab[data-tab="${tabId}"]`);
        if (tabButton) {
            handleTabSwitch({ currentTarget: tabButton });
        } else {
             console.warn(`Tab button for '${tabId}' not found.`);
        }
    }
    async function handleRefreshClick() {
        if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; }
        if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; }
        console.log("🔄 Manual refresh triggered...");
        const icon = ui.refreshDataBtn?.querySelector('i');
        const text = ui.refreshDataBtn?.querySelector('.refresh-text');
        if (icon) icon.classList.add('fa-spin');
        if (text) text.textContent = 'RELOADING...';
        if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = true;
        await loadPageData(); // Reload all page data based on current goal
        if (icon) icon.classList.remove('fa-spin');
        if (text) text.textContent = 'RELOAD';
        if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = false;
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

        // Sidebar listeners
        safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
        safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
        safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');
        safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn');
        safeAddListenerToAll(document.querySelectorAll('.sidebar-link'), 'click', () => { if (window.innerWidth <= 992) closeMenu(); }, 'sidebarLinks');

        console.log("[Procvičování SETUP] Event listeners set up.");
    }
    // --- Конец Настройки Event Listeners ---

    // --- Инициализация Supabase ---
    function initializeSupabase() {
        try {
            if (!window.supabase?.createClient) throw new Error("Supabase library not loaded.");
            // Используем глобальную переменную, если она уже установлена
             if (window.supabaseClient) {
                  supabase = window.supabaseClient;
                  console.log('[Supabase] Using existing global client instance.');
             } else if (supabase === null) { // Инициализируем, только если локальная переменная null
                 supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                 if (!supabase) throw new Error("Supabase client creation failed.");
                 window.supabaseClient = supabase; // Сохраняем в глобальную переменную
                 console.log('[Supabase] Client initialized by main.js and stored globally.');
             } else {
                 console.log('[Supabase] Using existing local client instance.');
             }
            return true;
        } catch (error) {
            console.error('[Supabase] Initialization failed:', error);
            showError("Kritická chyba: Nepodařilo se připojit k databázi.", true);
            return false;
        }
    }

    // --- Инициализация Приложения ---
    async function initializeApp() {
        console.log("[INIT Procvičování] App Init Start v24.10.1...");
        cacheDOMElements(); // Cache first

        if (!initializeSupabase()) return; // Initialize Supabase

        // Setup listeners AFTER caching and Supabase init
        setupEventListeners();

        // Apply initial UI states
        applyInitialSidebarState();
        updateCopyrightYear();
        initMouseFollower();
        initHeaderScrollDetection();
        updateOnlineStatus();

        if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
        if (ui.mainContent) ui.mainContent.style.display = 'none';
        if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none';
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
        hideError();

        try {
            console.log("[INIT Procvičování] Checking auth session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Session error: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;
                console.log(`[INIT Procvičování] User authenticated (ID: ${currentUser.id}). Loading profile & titles...`);

                const [profileResult, titlesResult] = await Promise.allSettled([
                    supabase.from('profiles').select('*, selected_title, preferences').eq('id', currentUser.id).single(),
                    supabase.from('title_shop').select('title_key, name') // Fetch titles
                ]);

                if (profileResult.status === 'fulfilled' && profileResult.value?.data) {
                    currentProfile = profileResult.value.data;
                    if (!currentProfile.preferences) currentProfile.preferences = {};
                    console.log("[INIT Procvičování] Profile loaded:", currentProfile);
                } else {
                    console.warn("[INIT Procvičování] Profile not found or fetch failed, creating default...");
                    currentProfile = await createDefaultProfile(currentUser.id, currentUser.email);
                    if (!currentProfile) throw new Error("Failed to create/load user profile.");
                    console.log("[INIT Procvičování] Default profile created/retrieved.");
                }

                if (titlesResult.status === 'fulfilled') { allTitles = titlesResult.value?.data || []; console.log("[INIT Procvičování] Titles loaded:", allTitles.length); }
                else { console.warn("[INIT Procvičování] Failed to load titles:", titlesResult.reason); allTitles = []; }

                updateSidebarProfile(currentProfile, allTitles); // Update sidebar with titles

                // --- Goal Check and Data Loading ---
                const goal = currentProfile.learning_goal;
                if (!goal) {
                     console.log("[INIT Procvičování] Goal not set, showing modal.");
                     showGoalSelectionModal();
                     setLoadingState('all', false); // Stop all loaders if showing modal
                     if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show main for modal backdrop
                     if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none'; // Hide tabs
                     document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none'); // Hide content
                } else {
                     console.log(`[INIT Procvičování] Goal found: ${goal}. Loading data...`);
                     if(ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; // Ensure modal is hidden
                     if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'block'; // Show tabs
                     // Content visibility is handled by configureUI and handleTabSwitch
                     configureUIForGoal(goal);
                     await loadPageData();
                }
                // --- End Goal Check ---

                if (ui.mainContent && window.getComputedStyle(ui.mainContent).display === 'none') {
                     ui.mainContent.style.display = 'block';
                     requestAnimationFrame(() => {
                         ui.mainContent.classList.add('loaded');
                         initScrollAnimations();
                     });
                }
                initTooltips();

                console.log("✅ [INIT Procvičování] Page specific setup complete.");

            } else { console.log('[INIT Procvičování] User not logged in, redirecting...'); window.location.href = '/auth/index.html'; }
        } catch (error) {
            console.error("❌ [INIT Procvičování] Critical initialization error:", error);
            showError(`Chyba inicializace: ${error.message}`, true);
            if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show content to display error
            setLoadingState('all', false); // Stop all loaders
        } finally {
             const il = ui.initialLoader;
             if (il && !il.classList.contains('hidden')) { il.classList.add('hidden'); setTimeout(() => { if(il) il.style.display = 'none'; }, 300); }
        }
    }
    // --- Конец Инициализации ---

    // --- Запуск ---
    // Ensure the script runs after the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp(); // DOM is already ready
    }

})(); // End IIFE