// dashboard/procvicovani/main.js
// Version: 25.0.13 - Fixed goal prioritization (DB > localStorage). Render stubs now add placeholder text.
// Cíl z DB má PŘEDNOST. localStorage se NEPOUŽÍVÁ pro obnovu cíle. Renderovací stuby vkládají text.

(function() { // Start IIFE
    'use strict';

    // --- START: Constants and Configuration ---
    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
    const NOTIFICATION_FETCH_LIMIT = 5;
    const LEARNING_GOAL_KEY = 'userLearningGoal'; // Stále používáme pro uložení po výběru v modalu
    const GOAL_DETAILS_KEY = 'userLearningGoalDetails'; // Stále používáme pro uložení po výběru v modalu
    // --- END: Constants and Configuration ---

    // --- START: State Variables ---
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
    let isInitialTabLoad = true;
    // --- END: State Variables ---

    // --- START: UI Elements Cache ---
    const ui = {};
    // --- END: UI Elements Cache ---

    // --- START: Helper Functions ---
    const topicIcons = { "Algebra": "fa-calculator", "Geometrie": "fa-draw-polygon", "Funkce": "fa-chart-line", "Rovnice": "fa-equals", "Statistika": "fa-chart-bar", "Kombinatorika": "fa-dice-d6", "Posloupnosti": "fa-ellipsis-h", default: "fa-atom" };
    const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }

    function showToast(title, message, type = 'info', duration = 4500) {
        let container = ui.toastContainer || document.getElementById('toastContainer');
        if (!container) {
            try {
                console.warn("[Toast] Toast container not found by ui.toastContainer or ID, attempting to create dynamically.");
                container = document.createElement('div');
                container.id = 'toastContainer';
                container.className = 'toast-container';
                document.body.appendChild(container);
                ui.toastContainer = container;
            } catch (createError) {
                console.error("[Toast] Failed to create toast container dynamically:", createError);
                alert(`${title}: ${message}`);
                return;
            }
        }
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
                <button type="button" class="toast-close" aria-label="Zavřít">&times;</button>
            `;
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
            console.error("[Toast] Error showing toast (after potential container creation):", e);
        }
    }

    function showError(message, isGlobal = false) {
        console.error("[Error Handler] Error occurred:", message);
        if (isGlobal && ui.globalError) {
            ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Obnovit</button></div>`;
            ui.globalError.style.display = 'block';
        } else {
            showToast('CHYBA SYSTÉMU', message, 'error', 6000);
        }
    }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || 'P'; }
    function formatDate(dateString) { try { return dateString ? new Date(dateString).toLocaleDateString('cs-CZ') : '-'; } catch (e) { return '-'; } }
    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return '--:--'; const m = Math.floor(seconds / 60); const ss = Math.round(seconds % 60); return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`; }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function updateCopyrightYear() { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
    function applyInitialSidebarState() { try { const state = localStorage.getItem(SIDEBAR_STATE_KEY); const collapsed = state === 'collapsed'; document.body.classList.toggle('sidebar-collapsed', collapsed); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) icon.className = collapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; if(ui.sidebarToggleBtn) ui.sidebarToggleBtn.title = collapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (e) { console.error("Sidebar state error:", e); } }
    function toggleSidebar() { try { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; if(ui.sidebarToggleBtn) ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (error) { console.error("[Sidebar Toggle] Error:", error); } }
    function initTooltips() { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip.tooltipstered').each(function() { try { window.jQuery(this).tooltipster('destroy'); } catch (e) { /* ignore */ } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } }
    function initScrollAnimations() { console.log("[Procvičování UI Placeholder] initScrollAnimations called."); }
    function initHeaderScrollDetection() { console.log("[Procvičování UI Placeholder] initHeaderScrollDetection called."); }
    function updateOnlineStatus() { console.log("[Procvičování UI Placeholder] updateOnlineStatus called."); }
    function initMouseFollower() { console.log("[Procvičování UI Placeholder] initMouseFollower called."); }

    // --- START: Skeleton Rendering Functions ---
    function renderStatsSkeletons(container) { if (!container) { console.warn("[Skeletons] Stats container not found."); return; } container.innerHTML = ''; for (let i = 0; i < 4; i++) { container.innerHTML += ` <div class="dashboard-card card loading"> <div class="loading-skeleton"> <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 1rem;"></div> <div class="skeleton" style="height: 35px; width: 40%; margin-bottom: 0.8rem;"></div> <div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 1.5rem;"></div> <div class="skeleton" style="height: 14px; width: 50%;"></div> </div> </div>`; } container.classList.add('loading');}
    function renderTestSkeletons(container) { if (!container) { console.warn("[Skeletons] Test results content container not found."); return; } container.innerHTML = `<div class="test-stats loading"><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton value"></div><div class="skeleton text"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton value"></div><div class="skeleton text"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton value"></div><div class="skeleton text"></div></div></div></div></div><div class="chart-container loading"><div class="skeleton" style="height: 350px; width: 100%;"></div></div><div class="last-test-result card loading"><div class="loading-skeleton"><div class="skeleton title"></div><div class="skeleton text"></div></div></div><div class="test-list loading"><div class="skeleton" style="height: 70px; width: 100%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 70px; width: 100%;"></div></div>`;}
    function renderPlanSkeletons(container) { const scheduleGrid = ui.mainPlanSchedule; if (!container || !scheduleGrid) { console.warn("[Skeletons] Study plan content or schedule grid not found."); return; } scheduleGrid.innerHTML = `<div class="schedule-grid loading"><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 40%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 50%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 45%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div></div>`;}
    function renderTopicSkeletons(container) { const topicGrid = ui.topicGrid; if (!container || !topicGrid) { console.warn("[Skeletons] Topic analysis content or topic grid not found."); return; } topicGrid.innerHTML = `<div class="topic-grid loading"><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div></div>`;}
    function renderShortcutSkeletons(container) { if (!container) { console.warn("[Skeletons] Shortcuts grid container not found."); return; } container.innerHTML = ''; for(let i = 0; i < 3; i++) { container.innerHTML += `<div class="shortcut-card card loading"><div class="loading-skeleton" style="align-items: center; padding: 1.8rem;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 16px; margin-bottom: 1.2rem;"></div><div class="skeleton" style="height: 18px; width: 70%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.4rem;"></div><div class="skeleton" style="height: 14px; width: 80%;"></div></div></div>`; } container.classList.add('loading');}
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) {console.warn("[Skeletons] Notifications list or no-message element not found."); return;} let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton"></div><div class="notification-content"><div class="skeleton" style="height:16px;width:70%;margin-bottom:6px;"></div><div class="skeleton" style="height:12px;width:90%;"></div><div class="skeleton" style="height:10px;width:40%;margin-top:6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    // --- END: Skeleton Rendering Functions ---

    function setLoadingState(sectionKey, isLoadingFlag) {
        // ... (stejné jako v25.0.11) ...
        if (!isLoading || typeof isLoading[sectionKey] === 'undefined' && sectionKey !== 'all') { console.warn(`[Procvičování UI Loading v6.2] Neznámý klíč sekce '${sectionKey}' nebo objekt isLoading není inicializován.`); return; }
        if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;
        const updateSingleSection = (key, loading) => {
            if (typeof isLoading[key] === 'undefined') { console.warn(`[Procvičování UI Loading v6.2] Neznámý dílčí klíč sekce '${key}' při zpracování 'all'.`); return; }
            if (isLoading[key] === loading && key !== 'all') return;
            isLoading[key] = loading;
            console.log(`[Procvičování UI Loading v6.2] Section: ${key}, isLoading: ${loading}`);
            const sectionMap = { stats: { container: ui.statsCards, skeletonFn: renderStatsSkeletons }, tests: { container: ui.testResultsContainer, content: ui.testResultsContent, empty: ui.testResultsEmpty, loader: ui.testResultsLoading, skeletonFn: renderTestSkeletons }, plan: { container: ui.studyPlanContainer, content: ui.studyPlanContent, empty: ui.studyPlanEmpty, loader: ui.studyPlanLoading, skeletonFn: renderPlanSkeletons }, topics: { container: ui.topicAnalysisContainer, content: ui.topicAnalysisContent, empty: ui.topicAnalysisEmpty, loader: ui.topicAnalysisLoading, skeletonFn: renderTopicSkeletons }, shortcuts: { container: ui.shortcutsGrid, skeletonFn: renderShortcutSkeletons }, notifications: { skeletonFn: renderNotificationSkeletons }, goalSelection: { } };
            const config = sectionMap[key];
            if (!config) { if (key !== 'all' && key !== 'goalSelection') console.warn(`[Procvičování UI Loading v6.2] Unknown section key '${key}'.`); return; }
            const container = config.container; const content = config.content; const empty = config.empty; const loader = config.loader; const skeletonFn = config.skeletonFn;
            if (loader) loader.style.display = loading ? 'flex' : 'none';
            if (container) container.classList.toggle('loading', loading);
            if (loading) {
                if (content) content.style.display = 'none';
                if (empty) empty.style.display = 'none';
                if (skeletonFn && typeof skeletonFn === 'function') { let targetContainer; if (key === 'notifications') targetContainer = ui.notificationsList; else targetContainer = (key === 'stats' || key === 'shortcuts') ? container : content; if (targetContainer) skeletonFn(targetContainer); else console.warn(`[Procvičování UI Loading v6.2] Target container for skeletons not found for key '${key}'.`);
                } else if (skeletonFn) { console.warn(`[Procvičování UI Loading v6.2] skeletonFn pro klíč '${key}' není funkce.`); }
            } else {
                setTimeout(() => {
                    const skeletonSelector = '.loading-skeleton, .dashboard-card.loading > .loading-skeleton, .card.loading > .loading-skeleton, .notification-item.skeleton';
                    const clearSkeletons = (el) => { el?.querySelectorAll(skeletonSelector).forEach(skel => skel.remove()); el?.classList.remove('loading'); el?.parentElement?.classList.remove('loading');};
                    if (key === 'notifications' && ui.notificationsList) { clearSkeletons(ui.notificationsList); }
                    else if (content) {
                        clearSkeletons(content);
                        if (empty) {
                            const hasActualContent = content.innerHTML.trim() !== '' && !content.querySelector('.loading-skeleton'); // Revize: může být obsah i prázdný
                            let displayType = 'block';
                            if (content.id === 'topic-grid' || content.id === 'stats-cards' || content.id === 'shortcuts-grid' || content.id === 'main-plan-schedule' || content.classList.contains('test-stats')) displayType = 'grid';
                            content.style.display = hasActualContent ? displayType : 'none';
                            empty.style.display = hasActualContent ? 'none' : 'block';
                             console.log(`[setLoadingState] Key: ${key}, hasActualContent: ${hasActualContent}, contentDisplay: ${content.style.display}, emptyDisplay: ${empty.style.display}`);
                        }
                    } else if (container && (key === 'stats' || key === 'shortcuts')) {
                        clearSkeletons(container);
                         const hasActualContent = container.innerHTML.trim() !== '' && !container.querySelector('.loading-skeleton');
                        if (key === 'stats' || key === 'shortcuts') { container.style.display = hasActualContent ? 'grid' : 'none'; }
                         if (!hasActualContent && container.innerHTML.trim() === '') { container.innerHTML = `<div class="empty-state" style="display: block; grid-column: 1 / -1;"><i class="fas fa-info-circle"></i><p>Data pro tuto sekci nejsou k dispozici.</p></div>`; container.style.display = 'block'; } // Zobrazíme empty state
                        console.log(`[setLoadingState] Key: ${key}, hasActualContent: ${hasActualContent}, containerDisplay: ${container.style.display}`);
                    }
                }, 50);
            }
        };
        if (sectionKey === 'all') { Object.keys(isLoading).forEach(key => { if (key !== 'all' && key !== 'goalSelection') updateSingleSection(key, isLoadingFlag); }); }
        else { updateSingleSection(sectionKey, isLoadingFlag); }
    }
    // --- END: Helper Functions ---

    // --- START: DOM Element Caching ---
    function cacheDOMElements() {
        console.log("[Procvičování Cache DOM v6.2] Caching elements...");
        const elementDefinitions = [
            { key: 'initialLoader', id: 'initial-loader', critical: true },
            { key: 'mainContent', id: 'main-content', critical: true },
            { key: 'sidebar', id: 'sidebar', critical: true },
            { key: 'tabsWrapper', id: 'tabs-wrapper', critical: true },
            { key: 'practiceTabContent', id: 'practice-tab-content', critical: true },
            { key: 'goalSelectionModal', id: 'goal-selection-modal', critical: true },
            { key: 'goalStep1', id: 'goal-step-1', critical: true },
            { key: 'sidebarOverlay', id: 'sidebar-overlay', critical: false },
            { key: 'mainMobileMenuToggle', id: 'main-mobile-menu-toggle', critical: false },
            { key: 'sidebarCloseToggle', id: 'sidebar-close-toggle', critical: false },
            { key: 'sidebarToggleBtn', id: 'sidebar-toggle-btn', critical: false },
            { key: 'sidebarAvatar', id: 'sidebar-avatar', critical: false },
            { key: 'sidebarName', id: 'sidebar-name', critical: false },
            { key: 'sidebarUserTitle', id: 'sidebar-user-title', critical: false },
            { key: 'currentYearSidebar', id: 'currentYearSidebar', critical: false },
            { key: 'dashboardHeader', query: '.dashboard-header', critical: false },
            { key: 'dashboardTitle', id: 'dashboard-title', critical: false },
            { key: 'refreshDataBtn', id: 'refresh-data-btn', critical: false },
            { key: 'currentYearFooter', id: 'currentYearFooter', critical: false },
            { key: 'mouseFollower', id: 'mouse-follower', critical: false },
            { key: 'globalError', id: 'global-error', critical: false },
            { key: 'toastContainer', id: 'toastContainer', critical: false },
            { key: 'notificationBell', id: 'notification-bell', critical: false },
            { key: 'notificationCount', id: 'notification-count', critical: false },
            { key: 'notificationsDropdown', id: 'notifications-dropdown', critical: false },
            { key: 'notificationsList', id: 'notifications-list', critical: false },
            { key: 'noNotificationsMsg', id: 'no-notifications-msg', critical: false },
            { key: 'markAllReadBtn', id: 'mark-all-read-btn', critical: false },
            { key: 'diagnosticPrompt', id: 'diagnostic-prompt', critical: false },
            { key: 'startTestBtnPrompt', id: 'start-test-btn-prompt', critical: false },
            { key: 'statsCards', id: 'stats-cards', critical: false },
            { key: 'shortcutsGrid', id: 'shortcuts-grid', critical: false },
            { key: 'testResultsContainer', id: 'test-results-container', critical: false },
            { key: 'testResultsLoading', id: 'test-results-loading', critical: false },
            { key: 'testResultsContent', id: 'test-results-content', critical: false },
            { key: 'testResultsEmpty', id: 'test-results-empty', critical: false },
            { key: 'startTestBtnResults', id: 'start-test-btn-results', critical: false },
            { key: 'studyPlanContainer', id: 'study-plan-container', critical: false },
            { key: 'studyPlanLoading', id: 'study-plan-loading', critical: false },
            { key: 'studyPlanContent', id: 'study-plan-content', critical: false },
            { key: 'studyPlanEmpty', id: 'study-plan-empty', critical: false },
            { key: 'startTestBtnPlan', id: 'startTestBtnPlan', critical: false },
            { key: 'createPlanBtnEmpty', id: 'create-plan-btn-empty', critical: false },
            { key: 'mainPlanSchedule', id: 'main-plan-schedule', critical: false },
            { key: 'topicAnalysisContainer', id: 'topic-analysis-container', critical: false },
            { key: 'topicAnalysisLoading', id: 'topic-analysis-loading', critical: false },
            { key: 'topicAnalysisContent', id: 'topic-analysis-content', critical: false },
            { key: 'topicAnalysisEmpty', id: 'topic-analysis-empty', critical: false },
            { key: 'startTestBtnAnalysis', id: 'start-test-btn-analysis', critical: false },
            { key: 'topicGrid', id: 'topic-grid', critical: false },
            { key: 'goalStepAccelerate', id: 'goal-step-accelerate', critical: true },
            { key: 'accelerateAreasGroup', id: 'accelerate-areas-group', critical: true },
            { key: 'accelerateReasonGroup', id: 'accelerate-reason-group', critical: true },
            { key: 'goalStepReview', id: 'goal-step-review', critical: true },
            { key: 'reviewAreasGroup', id: 'review-areas-group', critical: true },
            { key: 'goalStepExplore', id: 'goal-step-explore', critical: true },
            { key: 'exploreLevelGroup', id: 'explore-level-group', critical: true },
            { key: 'testResultsTabContent', id: 'test-results-tab-content', critical: false },
            { key: 'studyPlanTabContent', id: 'study-plan-tab-content', critical: false },
            { key: 'topicAnalysisTabContent', id: 'topic-analysis-tab-content', critical: false }
        ];

        const notFoundCritical = [];
        const notFoundNonCritical = [];

        elementDefinitions.forEach(def => {
            const element = def.id ? document.getElementById(def.id) : document.querySelector(def.query);
            if (element) {
                ui[def.key] = element;
            } else {
                ui[def.key] = null;
                if (def.critical) {
                    notFoundCritical.push(def.key);
                } else {
                    notFoundNonCritical.push(def.key);
                }
            }
        });

        ui.contentTabs = document.querySelectorAll('.content-tab');
        ui.tabContents = document.querySelectorAll('.tab-content');
        ui.modalBackBtns = ui.goalSelectionModal ? ui.goalSelectionModal.querySelectorAll('.modal-back-btn') : [];
        ui.modalConfirmBtns = ui.goalSelectionModal ? ui.goalSelectionModal.querySelectorAll('.modal-confirm-btn') : [];
        ui.goalOptionCards = ui.goalStep1 ? ui.goalStep1.querySelectorAll('.goal-option-card') : [];


        if (notFoundCritical.length > 0) {
            console.error(`[CACHE DOM v6.2] KRITICKÉ elementy nenalezeny (${notFoundCritical.length}):`, notFoundCritical.join(', '));
            showError(`Chyba načítání stránky: Kritické komponenty chybí (${notFoundCritical.join(', ')}).`, true);
        } else {
            console.log("[CACHE DOM v6.2] Všechny kritické elementy nalezeny.");
        }

        if (notFoundNonCritical.length > 0) {
            console.warn(`[CACHE DOM v6.2] Některé nekritické elementy nenalezeny (${notFoundNonCritical.length}):`, notFoundNonCritical.join(', '));
        }

        if (ui.contentTabs.length === 0) console.warn("[CACHE DOM v6.2] Nenalezeny žádné elementy záložek (.content-tab).");
        if (!ui.practiceTabContent) console.warn("[CACHE DOM v6.2] ui.practiceTabContent chybí.");
        if (!ui.testResultsTabContent) console.warn("[CACHE DOM v6.2] ui.testResultsTabContent chybí.");
        if (!ui.studyPlanTabContent) console.warn("[CACHE DOM v6.2] ui.studyPlanTabContent chybí.");
        if (!ui.topicAnalysisTabContent) console.warn("[CACHE DOM v6.2] ui.topicAnalysisTabContent chybí.");

        console.log("[Procvičování Cache DOM v6.2] Pokus o cachování dokončen.");
    }
    // --- END: DOM Element Caching ---

    // --- START: UI Update Functions (Stubs now add placeholder text) ---
    function updateSidebarProfile(profile, titlesData) { /* ... (stejné jako v25.0.11) ... */ if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[UI Sidebar] Přeskakuji aktualizaci profilu v sidebaru - elementy nenalezeny."); return; } if (profile) { const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || currentUser?.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(profile); const avatarUrl = profile.avatar_url; let finalAvatarUrl = avatarUrl; if (avatarUrl && !avatarUrl.startsWith('http') && avatarUrl.includes('/')) { finalAvatarUrl = sanitizeHTML(avatarUrl); } else if (avatarUrl) { finalAvatarUrl = `${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`; } ui.sidebarAvatar.innerHTML = finalAvatarUrl ? `<img src="${finalAvatarUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const img = ui.sidebarAvatar.querySelector('img'); if (img) { img.onerror = function() { console.warn(`[UI Sidebar] Nepodařilo se načíst avatar: ${this.src}. Zobrazuji iniciály.`); ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; } const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot'; if (selectedTitleKey && titlesData && titlesData.length > 0) { const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) { displayTitle = foundTitle.name; } else { console.warn(`[UI Sidebar] Klíč titulu "${selectedTitleKey}" nenalezen v načtených titulech.`); } } else if (selectedTitleKey) { console.warn(`[UI Sidebar] Klíč titulu je přítomen, ale seznam titulů je prázdný nebo nenačtený.`); } ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); } else { ui.sidebarName.textContent = "Nepřihlášen"; ui.sidebarAvatar.textContent = '?'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title'); } }

    function renderStatsCards(stats) {
        console.log("[Render UI Stub] renderStatsCards called with stats:", stats);
        if (!ui.statsCards) {
            console.error("Stats cards container (ui.statsCards) not found!");
            setLoadingState('stats', false);
            return;
        }
        // Vložíme placeholder text místo skutečných karet
        ui.statsCards.innerHTML = `
            <div class="card" style="padding: 20px; border: 1px dashed var(--accent-secondary);">
                <h3>Statistiky</h3>
                <p>Obsah statistik (např. body: ${stats?.totalPoints || 'N/A'}) se načte zde.</p>
            </div>
            <div class="card" style="padding: 20px; border: 1px dashed var(--accent-secondary);">
                <p>Další statistika...</p>
            </div>
        `;
        ui.statsCards.classList.remove('loading');
        // Explicitně nastavíme display, pokud byl skrytý
        ui.statsCards.style.display = 'grid';
        setLoadingState('stats', false); // Voláme až po vložení obsahu
    }

    function renderTestResults(results, goal) {
        console.log("[Render UI Stub] renderTestResults called.");
        if (!ui.testResultsContainer || !ui.testResultsContent || !ui.testResultsEmpty) {
            console.error("Test results UI elements missing!");
            setLoadingState('tests', false);
            return;
        }
        // Vložíme placeholder text
        if (results && results.length > 0) {
             ui.testResultsContent.innerHTML = `<p style="padding: 20px;">Placeholder pro výsledky ${results.length} testů.</p>`;
             ui.testResultsContent.style.display = 'block';
             ui.testResultsEmpty.style.display = 'none';
        } else {
             ui.testResultsContent.innerHTML = '';
             ui.testResultsContent.style.display = 'none';
             // Empty state by se měl zobrazit automaticky přes setLoadingState(false)
        }
        ui.testResultsContainer.classList.remove('loading');
        setLoadingState('tests', false);
    }

    function renderStudyPlanOverview(plan, activities, goal) {
        console.log("[Render UI Stub] renderStudyPlanOverview called.");
        if (!ui.studyPlanContainer || !ui.studyPlanContent || !ui.studyPlanEmpty) {
            console.error("Study plan UI elements missing!");
            setLoadingState('plan', false);
            return;
        }
        // Vložíme placeholder text
        if (plan) {
             ui.studyPlanContent.innerHTML = `<p style="padding: 20px;">Placeholder pro studijní plán "${plan.name || 'bez názvu'}".</p>`;
             ui.studyPlanContent.style.display = 'block';
             ui.studyPlanEmpty.style.display = 'none';
        } else {
             ui.studyPlanContent.innerHTML = '';
             ui.studyPlanContent.style.display = 'none';
             // Empty state by se měl zobrazit automaticky přes setLoadingState(false)
        }
        ui.studyPlanContainer.classList.remove('loading');
        setLoadingState('plan', false);
    }

    function renderTopicAnalysis(topics, goal) {
        console.log("[Render UI Stub] renderTopicAnalysis called.");
         if (!ui.topicAnalysisContainer || !ui.topicAnalysisContent || !ui.topicAnalysisEmpty || !ui.topicGrid) {
            console.error("Topic analysis UI elements missing!");
            setLoadingState('topics', false);
            return;
        }
        // Vložíme placeholder text
        if (topics && topics.length > 0) {
            ui.topicGrid.innerHTML = topics.map(t => `
                <div class="card" style="padding: 15px; border: 1px dashed var(--accent-secondary);">
                    ${t.name || 'Téma'} (Placeholder)
                </div>
            `).join('');
             ui.topicAnalysisContent.style.display = 'block'; // Kontejner pro mřížku
             ui.topicGrid.style.display = 'grid'; // Samotná mřížka
             ui.topicAnalysisEmpty.style.display = 'none';
        } else {
             ui.topicAnalysisContent.innerHTML = ''; // Vyčistíme kontejner, pokud nejsou data
             ui.topicAnalysisContent.style.display = 'none';
             // Empty state by se měl zobrazit automaticky přes setLoadingState(false)
        }
        ui.topicAnalysisContainer.classList.remove('loading');
        setLoadingState('topics', false);
    }

    function renderShortcutsForGoal(goal, container) {
        if (!container) { console.warn("[Shortcuts] Shortcut container (ui.shortcutsGrid) not found."); setLoadingState('shortcuts', false); return; }
        setLoadingState('shortcuts', true); container.innerHTML = ''; // Vyčistíme před přidáním
        console.log(`[Shortcuts] Rendering for goal: ${goal}`); let shortcutsHTML = '';
        const shortcuts = { test: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-graduation-cap"></i></div><h3 class="shortcut-title">Diagnostický Test</h3><p class="shortcut-desc">Ověřte své znalosti.</p><a href="/dashboard/procvicovani/test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Test</a></div>`, plan: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-tasks"></i></div><h3 class="shortcut-title">Studijní Plán</h3><p class="shortcut-desc">Zobrazte personalizovaný plán.</p><a href="/dashboard/procvicovani/plan.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Zobrazit Plán</a></div>`, tutor: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-book-open"></i></div><h3 class="shortcut-title">AI Tutor (Lekce)</h3><p class="shortcut-desc">Vysvětlení témat z plánu.</p><a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a></div>`, nextTopic: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-forward"></i></div><h3 class="shortcut-title">Další Téma Osnovy</h3><p class="shortcut-desc">Pokračujte v osnově.</p><a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Učit se Další</a></div>`, curriculum: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-stream"></i></div><h3 class="shortcut-title">Přehled Osnovy</h3><p class="shortcut-desc">Zobrazte přehled témat.</p><a href="/dashboard/procvicovani/plan.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Osnovu</a></div>`, weakness: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-search"></i></div><h3 class="shortcut-title">Moje Slabiny</h3><p class="shortcut-desc">Témata k zlepšení.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="switchActiveTab('topic-analysis-tab'); return false;">Analýza Témat</a></div>`, review: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-history"></i></div><h3 class="shortcut-title">Opakování</h3><p class="shortcut-desc">Procvičte si starší témata.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="showToast('Info','Funkce opakování se připravuje.','info'); return false;">Spustit Opakování</a></div>`, explore: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-compass"></i></div><h3 class="shortcut-title">Procházet Témata</h3><p class="shortcut-desc">Vyberte si téma k učení.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="switchActiveTab('topic-analysis-tab'); return false;">Vybrat Téma</a></div>`, random: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-dumbbell"></i></div><h3 class="shortcut-title">Náhodné Cvičení</h3><p class="shortcut-desc">Rychlé procvičení.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="showToast('Info','Funkce náhodného cvičení se připravuje.','info'); return false;">Náhodné Cvičení</a></div>`, progress: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-chart-line"></i></div><h3 class="shortcut-title">Můj Pokrok</h3><p class="shortcut-desc">Sledujte své zlepšení.</p><a href="/dashboard/pokrok.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Pokrok</a></div>` };
        switch (goal) { case 'exam_prep': shortcutsHTML = shortcuts.test + shortcuts.plan + shortcuts.tutor; break; case 'math_accelerate': shortcutsHTML = shortcuts.nextTopic + shortcuts.curriculum + shortcuts.tutor; break; case 'math_review': shortcutsHTML = shortcuts.weakness + shortcuts.review + shortcuts.tutor; break; case 'math_explore': shortcutsHTML = shortcuts.explore + shortcuts.random + shortcuts.tutor; break; default: shortcutsHTML = shortcuts.progress + shortcuts.tutor + shortcuts.random; }
        requestAnimationFrame(() => {
            if(container) {
                container.innerHTML = shortcutsHTML; // Vložíme obsah
                container.classList.remove('loading');
                container.style.display = 'grid'; // Zajistíme zobrazení
                setLoadingState('shortcuts', false); // Až po vložení obsahu
                if (typeof initScrollAnimations === 'function') initScrollAnimations();
            }
        });
    }
    // --- END: UI Update Functions ---

    // --- START: Data Fetching Stubs ---
    async function fetchDashboardStats(userId, profileData) { console.log("[Fetch Data Stub] fetchDashboardStats called."); await new Promise(resolve => setTimeout(resolve, 700)); diagnosticResultsData = diagnosticResultsData || []; return { totalPoints: profileData?.points || 0, completedExercises: profileData?.completed_exercises || 0, activeStreak: profileData?.streak_days || 0, lastTestScore: diagnosticResultsData.length > 0 ? diagnosticResultsData[0].total_score : null, }; }
    async function fetchDiagnosticResults(userId, goal) { console.log("[Fetch Data Stub] fetchDiagnosticResults called."); await new Promise(resolve => setTimeout(resolve, 1000)); return []; }
    async function fetchActiveStudyPlan(userId, goal) { console.log("[Fetch Data Stub] fetchActiveStudyPlan called."); await new Promise(resolve => setTimeout(resolve, 800)); return null; }
    async function fetchPlanActivities(planId, goal) { console.log("[Fetch Data Stub] fetchPlanActivities called."); await new Promise(resolve => setTimeout(resolve, 500)); return []; }
    async function fetchTopicProgress(userId, goal) { console.log("[Fetch Data Stub] fetchTopicProgress called."); await new Promise(resolve => setTimeout(resolve, 900)); return [ { id: 'algebra', name: 'Algebra', progress: 0, last_practiced: null, strength: 'neutral' }, { id: 'geometry', name: 'Geometrie', progress: 0, last_practiced: null, strength: 'neutral' }, { id: 'functions', name: 'Funkce', progress: 0, last_practiced: null, strength: 'neutral' } ]; }
    // --- END: Data Fetching Stubs ---

    // --- START: Notification Stubs ---
    async function fetchNotifications(userId, limit) { console.log(`[Notifications Stub] fetchNotifications called for user ${userId}, limit ${limit}.`); setLoadingState('notifications', true); await new Promise(resolve => setTimeout(resolve, 600)); const fakeNotifications = []; renderNotifications(0, fakeNotifications); setLoadingState('notifications', false); return { unreadCount: 0, notifications: fakeNotifications }; }
    function renderNotifications(count, notifications) { console.log(`[Notifications Stub] renderNotifications called with count ${count}.`); if (!ui.notificationBell || !ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Notifications Stub] UI elements missing for notifications."); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications?.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; } ui.markAllReadBtn.disabled = count === 0; }
    async function markNotificationRead(notificationId) { console.log(`[Notifications Stub] markNotificationRead for ID ${notificationId}.`); await new Promise(resolve => setTimeout(resolve, 200)); return true; }
    async function markAllNotificationsRead() { console.log(`[Notifications Stub] markAllNotificationsRead.`); await new Promise(resolve => setTimeout(resolve, 300)); renderNotifications(0, []); showToast('Oznámení vymazána.', 'success'); }
    // --- END: Notification Stubs ---

    // --- START: Goal Selection Logic ---
    function checkUserGoalAndDiagnostic() { console.log("[Goal Check v25.0.11] Checking user goal and diagnostic status..."); try { if (!currentProfile || !currentProfile.learning_goal) { if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none'; console.log("[Goal Check v25.0.11] No profile or learning_goal. Modal should be shown elsewhere."); return; } const goal = currentProfile.learning_goal; console.log(`[Goal Check v25.0.11] User goal: ${goal}`); if (!ui.diagnosticPrompt) { console.warn("[Goal Check v25.0.11] ui.diagnosticPrompt not found, cannot display diagnostic messages."); return; } if (goal === 'exam_prep') { console.log("[Goal Check v25.0.11] Goal is exam_prep. Using existing diagnosticResultsData."); if (diagnosticResultsData && diagnosticResultsData.length > 0) { const latestResult = diagnosticResultsData[0]; const score = latestResult.total_score ?? 0; console.log(`[Goal Check v25.0.11] Latest diagnostic score: ${score}`); if (score < 20) { ui.diagnosticPrompt.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: var(--accent-orange);"></i><p>Vaše skóre v posledním diagnostickém testu (${score}/50) bylo nízké. Pro optimální přípravu doporučujeme absolvovat test znovu nebo se zaměřit na slabší oblasti.</p><a href="test1.html" class="btn btn-primary" id="start-test-btn-prompt-lowscore"><i class="fas fa-play"></i> Opakovat test</a>`; ui.diagnosticPrompt.style.display = 'flex'; } else { ui.diagnosticPrompt.style.display = 'none'; console.log("[Goal Check v25.0.11] Diagnostic score good."); } } else { ui.diagnosticPrompt.innerHTML = `<i class="fas fa-exclamation-circle"></i><p>Pro odemčení personalizovaného obsahu a studijního plánu je potřeba absolvovat <strong>diagnostický test</strong>.</p><a href="test1.html" class="btn btn-primary" id="start-test-btn-prompt"><i class="fas fa-play"></i> Spustit test</a>`; ui.diagnosticPrompt.style.display = 'flex'; console.log("[Goal Check v25.0.11] No diagnostic results for exam_prep."); } } else { ui.diagnosticPrompt.style.display = 'none'; console.log("[Goal Check v25.0.11] Goal not exam_prep, hiding diagnostic prompt."); } } catch (error) { console.error("[Goal Check v25.0.11] Error:", error); if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none'; } }
    function showGoalSelectionModal() { if (!ui.goalSelectionModal || !ui.goalStep1) { console.error("[GoalModal v5.2] Critical modal elements missing. Attempting re-cache."); cacheDOMElements(); if (!ui.goalSelectionModal || !ui.goalStep1) { showError("Chyba zobrazení výběru cíle (chybí #goal-selection-modal nebo #goal-step-1).", true); return; } } console.log("[GoalModal v5.2] Showing goal selection modal."); ui.goalSelectionModal.querySelectorAll('.modal-step').forEach(step => { step.classList.remove('active'); step.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => input.checked = false); }); ui.goalStep1.classList.add('active'); ui.goalSelectionModal.style.display = 'flex'; document.body.classList.add('modal-open'); requestAnimationFrame(() => ui.goalSelectionModal.classList.add('active')); if (!ui.goalOptionCards || ui.goalOptionCards.length === 0) { console.error("[GoalModal v5.2] No goal option cards found (.goal-option-card)!"); return; } ui.goalOptionCards.forEach(button => { const goal = button.dataset.goal; if (!goal) { console.warn("[GoalModal v5.2] Goal option card missing data-goal attribute."); return; } if (button._goalHandler) button.removeEventListener('click', button._goalHandler); const newHandler = () => handleInitialGoalSelection(goal); button.addEventListener('click', newHandler); button._goalHandler = newHandler; }); console.log("[GoalModal v5.2] Listeners attached to goal option cards."); }
    function hideGoalSelectionModal() { if (!ui.goalSelectionModal) return; ui.goalSelectionModal.classList.remove('active'); document.body.classList.remove('modal-open'); setTimeout(() => { if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; }, 300); }
    function handleInitialGoalSelection(selectedGoal) { if (goalSelectionInProgress) return; console.log(`[GoalModal v5.2] Initial goal selected: ${selectedGoal}`); pendingGoal = selectedGoal; if (selectedGoal === 'exam_prep' || selectedGoal === 'math_explore') { saveGoalAndProceed(selectedGoal); } else { showStep2(selectedGoal); } }
    function showStep2(goalType) { const step2Id = `goal-step-${goalType.replace('math_', '')}`; const step2Element = document.getElementById(step2Id); if (!ui.goalSelectionModal || !ui.goalStep1 || !step2Element) { console.error(`[GoalModal v5.2] Cannot show step 2 for ${goalType}: Missing critical elements (#goalSelectionModal, #goalStep1, or #${step2Id}).`); showError("Chyba zobrazení kroku 2.", true); return; } console.log(`[GoalModal v5.2] Showing step 2: #${step2Id}`); ui.goalSelectionModal.querySelectorAll('.modal-step').forEach(step => step.classList.remove('active')); step2Element.classList.add('active'); const backBtn = step2Element.querySelector('.modal-back-btn'); if (backBtn) { const oldHandler = backBtn._backHandler; if (oldHandler) backBtn.removeEventListener('click', oldHandler); const newHandler = () => handleBackToStep1(ui.goalStep1, step2Element); backBtn.addEventListener('click', newHandler); backBtn._backHandler = newHandler; } const confirmBtn = step2Element.querySelector('.modal-confirm-btn'); if (confirmBtn) { const oldHandler = confirmBtn._confirmHandler; if (oldHandler) confirmBtn.removeEventListener('click', oldHandler); const newHandler = () => handleStep2Confirm(goalType); confirmBtn.addEventListener('click', newHandler); confirmBtn._confirmHandler = newHandler; confirmBtn.disabled = false; confirmBtn.innerHTML = 'Potvrdit a pokračovat'; } }
    function handleBackToStep1(step1Element, currentStep2Element) { console.log("[GoalModal v5.2] Back to step 1..."); if(currentStep2Element) currentStep2Element.classList.remove('active'); if(step1Element) step1Element.classList.add('active'); pendingGoal = null; }
    function handleStep2Confirm(goalType) { if (goalSelectionInProgress) return; const step2Id = `goal-step-${goalType.replace('math_', '')}`; const step2Element = document.getElementById(step2Id); if (!step2Element) { console.error(`[GoalModal v5.2] Step 2 element ${step2Id} not found.`); return; } const details = {}; let isValid = true; try { if (goalType === 'math_accelerate') { details.accelerate_areas = Array.from(step2Element.querySelectorAll('input[name="accelerate_area"]:checked')).map(cb => cb.value); const reasonRadio = step2Element.querySelector('input[name="accelerate_reason"]:checked'); details.accelerate_reason = reasonRadio ? reasonRadio.value : null; if(details.accelerate_areas.length === 0) { showToast("Chyba", "Vyberte oblast zájmu.", "warning"); isValid = false; } if(!details.accelerate_reason) { showToast("Chyba", "Vyberte důvod.", "warning"); isValid = false; } } else if (goalType === 'math_review') { details.review_areas = Array.from(step2Element.querySelectorAll('input[name="review_area"]:checked')).map(cb => cb.value); } } catch (e) { console.error("[GoalModal v5.2] Error getting step 2 details:", e); isValid = false; showToast("Chyba", "Chyba zpracování výběru.", "error"); } if (isValid) { console.log(`[GoalModal v5.2] Step 2 details for ${goalType}:`, details); saveGoalAndProceed(pendingGoal, details); } }
    async function saveGoalAndProceed(goal, details = null) { if (goalSelectionInProgress || !goal) return; goalSelectionInProgress = true; setLoadingState('goalSelection', true); console.log(`[GoalModal Save v5.2] Saving goal: ${goal}, details:`, details); const activeStep = ui.goalSelectionModal?.querySelector('.modal-step.active'); const confirmButton = activeStep?.querySelector('.modal-confirm-btn'); const backButton = activeStep?.querySelector('.modal-back-btn'); if (confirmButton) { confirmButton.disabled = true; confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...'; } if (backButton) backButton.disabled = true; try { if (!supabase || !currentUser || !currentProfile) throw new Error("Core dependencies missing for saving goal."); localStorage.setItem(LEARNING_GOAL_KEY, goal); if (details && Object.keys(details).length > 0) localStorage.setItem(GOAL_DETAILS_KEY, JSON.stringify(details)); else localStorage.removeItem(GOAL_DETAILS_KEY); const finalPreferences = { ...(currentProfile.preferences || {}), goal_details: (details && Object.keys(details).length > 0) ? details : undefined }; const updatePayload = { learning_goal: goal, preferences: finalPreferences, updated_at: new Date().toISOString() }; console.log("[GoalModal Save v5.2] Updating Supabase profile:", updatePayload); const { data: updatedProfileData, error } = await supabase.from('profiles').update(updatePayload).eq('id', currentUser.id).select('*, selected_title, preferences').single(); if (error) throw error; currentProfile = updatedProfileData; if (!currentProfile.preferences) currentProfile.preferences = {}; console.log("[GoalModal Save v5.2] Goal saved to DB:", currentProfile.learning_goal, currentProfile.preferences); let goalTextKey = `goal_${goal.replace('math_','')}`; let goalText = {goal_exam_prep: 'Příprava na zkoušky', goal_accelerate: 'Učení napřed', goal_review: 'Doplnění mezer', goal_explore: 'Volné prozkoumávání'}[goalTextKey] || goal; showToast('Cíl uložen!', `Váš cíl: ${goalText}.`, 'success'); hideGoalSelectionModal(); if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'flex'; if(ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none'; configureUIForGoal(); await loadPageData(); if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled'); } catch (error) { console.error("[GoalModal Save v5.2] Error saving goal:", error); showToast('Chyba', 'Nepodařilo se uložit cíl.', 'error'); if (confirmButton) { confirmButton.disabled = false; confirmButton.innerHTML = 'Potvrdit a pokračovat'; } if (backButton) backButton.disabled = false; } finally { goalSelectionInProgress = false; setLoadingState('goalSelection', false); pendingGoal = null; } }
    // --- END: Goal Selection Logic ---

    // --- START: UI Configuration and Data Loading ---
    function configureUIForGoal() {
        if (!currentProfile || !currentProfile.learning_goal) { console.error("[UI Config v6.2] Profil nebo cíl nenalezen."); if (ui.goalSelectionModal && getComputedStyle(ui.goalSelectionModal).display === 'none') { console.log("[UI Config v6.2] Zobrazuji modální okno pro výběr cíle."); showGoalSelectionModal(); } return; }
        const goal = currentProfile.learning_goal; console.log(`[UI Config v6.2] Konfigurace UI pro cíl: ${goal}`);
        if (!ui || Object.keys(ui).length === 0) { console.error("[UI Config v6.2] UI cache je prázdná."); return; }
        const dashboardTitleEl = ui.dashboardTitle;
        if (dashboardTitleEl) {
            let titleText = "Procvičování // "; let iconClass = "fas fa-laptop-code";
            switch(goal) { case 'exam_prep': titleText += "Příprava na Zkoušky"; iconClass = "fas fa-graduation-cap"; break; case 'math_accelerate': titleText += "Učení Napřed"; iconClass = "fas fa-rocket"; break; case 'math_review': titleText += "Doplnění Mezer"; iconClass = "fas fa-sync-alt"; break; case 'math_explore': titleText += "Volné Prozkoumávání"; iconClass = "fas fa-compass"; break; default: titleText += "Přehled"; }
            dashboardTitleEl.innerHTML = `<i class="${iconClass}"></i> ${sanitizeHTML(titleText)}`;
        } else console.warn("[UI Config v6.2] Element titulku dashboardu (ui.dashboardTitle) nenalezen.");
        if (ui.shortcutsGrid) renderShortcutsForGoal(goal, ui.shortcutsGrid); else console.warn("[UI Config v6.2] Element mřížky zkratek (ui.shortcutsGrid) nenalezen.");

        const tabButtonsConfig = { 'test-results-tab': (goal === 'exam_prep'), 'study-plan-tab': (goal === 'exam_prep' || goal === 'math_review' || goal === 'math_accelerate'), 'topic-analysis-tab': true, 'practice-tab': true };
        if (ui.contentTabs && ui.contentTabs.length > 0) {
            ui.contentTabs.forEach(tabButton => { const tabId = tabButton.dataset.tab; const shouldDisplay = tabButtonsConfig[tabId]; if (shouldDisplay !== undefined) tabButton.style.display = shouldDisplay ? 'flex' : 'none'; });
        } else { console.warn("[UI Config v6.2] Nenalezeny žádné elementy záložek (ui.contentTabs)."); }

        let activeTabId = localStorage.getItem('lastActiveProcvicovaniTab') || 'practice-tab';
        let activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`);
        if (!activeTabButton || activeTabButton.style.display === 'none') { console.log(`[UI Config v6.2] Aktivní záložka '${activeTabId}' je skryta, výchozí bude 'practice-tab'.`); activeTabId = 'practice-tab'; activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`);}
        if (activeTabButton) {
            console.log(`[UI Config v6.2] Nastavuji aktivní záložku na: ${activeTabId}`);
            isInitialTabLoad = true;
            switchActiveTab(activeTabId);
        } else console.error("[UI Config v6.2] Nenalezena žádná vhodná aktivní záložka.");
        console.log(`[UI Config v6.2] UI nakonfigurováno pro cíl: ${goal}`);
    }

    async function loadTabData(tabId) {
        const camelCaseKey = tabId.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) + 'Content';

        if (!currentProfile || !currentProfile.learning_goal) {
            console.warn(`[Load Tab Data v6.2] Nelze načíst data pro záložku '${tabId}', chybí profil nebo cíl.`);
            const contentElement = ui[camelCaseKey];
            if (contentElement) { contentElement.innerHTML = `<div class="empty-state"><i class="fas fa-info-circle"></i><h3>Vyberte cíl</h3><p>Pro zobrazení obsahu této záložky si nejprve vyberte svůj studijní cíl.</p><button class="btn btn-primary" id="selectGoalBtnInTab">Vybrat cíl</button></div>`; contentElement.style.display = 'block'; const selectGoalBtn = document.getElementById('selectGoalBtnInTab'); if(selectGoalBtn) selectGoalBtn.addEventListener('click', showGoalSelectionModal); }
            else { console.error(`[Load Tab Data v6.2] Element obsahu s klíčem '${camelCaseKey}' (pro ID: ${tabId}-content) nenalezen pro zprávu o chybějícím cíli.`); }
            return;
        }
        const goal = currentProfile.learning_goal; console.log(`[Load Tab Data v6.2] Načítání pro záložku: ${tabId}, cíl: ${goal}, UI klíč obsahu: ${camelCaseKey}`);
        const sectionKey = tabIdToSectionKey(tabId); setLoadingState(sectionKey, true);
        try {
            if(ui.tabContents && ui.tabContents.length > 0) { ui.tabContents.forEach(tc => { if(tc) { tc.style.display = 'none'; tc.classList.remove('active'); }}); }
            else { console.warn("[Load Tab Data v6.2] ui.tabContents nenalezeno nebo prázdné."); }

            const targetContentElement = ui[camelCaseKey];
            if (!targetContentElement) { console.error(`[Load Tab Data v6.2] Element obsahu s klíčem '${camelCaseKey}' (ID: ${tabId}-content) nenalezen v ui cache.`); setLoadingState(sectionKey, false); return; }

            targetContentElement.innerHTML = ''; // Clear previous content before showing skeletons
            targetContentElement.classList.add('active');
            targetContentElement.style.display = 'block'; // Show the container

            // Render skeletons
            if (tabId === 'practice-tab') { if (ui.statsCards) renderStatsSkeletons(ui.statsCards); if (ui.shortcutsGrid) renderShortcutSkeletons(ui.shortcutsGrid); }
            else if (tabId === 'test-results-tab' && ui.testResultsContent) renderTestSkeletons(ui.testResultsContent);
            else if (tabId === 'study-plan-tab' && ui.studyPlanContent) renderPlanSkeletons(ui.studyPlanContent);
            else if (tabId === 'topic-analysis-tab' && ui.topicAnalysisContent) renderTopicSkeletons(ui.topicAnalysisContent);

            // Fetch and Render Data (Stubs)
            switch (tabId) {
                case 'practice-tab':
                    userStatsData = await fetchDashboardStats(currentUser.id, currentProfile);
                    renderStatsCards(userStatsData); // This stub now adds placeholder text
                    if (ui.shortcutsGrid) renderShortcutsForGoal(goal, ui.shortcutsGrid); // This stub adds shortcut cards
                    if(ui.diagnosticPrompt) { await checkUserGoalAndDiagnostic(); }
                    break;
                case 'test-results-tab':
                    diagnosticResultsData = await fetchDiagnosticResults(currentUser.id, goal);
                    renderTestResults(diagnosticResultsData, goal); // This stub now adds placeholder text or handles empty state
                    break;
                case 'study-plan-tab':
                    studyPlanData = await fetchActiveStudyPlan(currentUser.id, goal);
                    planActivitiesData = studyPlanData ? await fetchPlanActivities(studyPlanData.id, goal) : [];
                    renderStudyPlanOverview(studyPlanData, planActivitiesData, goal); // This stub now adds placeholder text or handles empty state
                    break;
                case 'topic-analysis-tab':
                    topicProgressData = await fetchTopicProgress(currentUser.id, goal);
                    renderTopicAnalysis(topicProgressData, goal); // This stub now adds placeholder cards or handles empty state
                    break;
                default:
                    console.warn(`[Load Tab Data v6.2] No specific logic for tab: ${tabId}`);
                    if (targetContentElement) targetContentElement.innerHTML = `<div class="empty-state" style="display:block;"><i class="fas fa-question-circle"></i><p>Obsah pro tuto záložku se připravuje.</p></div>`;
            }
        } catch (error) { console.error(`[Load Tab Data v6.2] Error loading data for tab ${tabId}:`, error); showError(`Nepodařilo se načíst data pro záložku: ${error.message}`); const contentEl = ui[camelCaseKey]; if (contentEl) { contentEl.innerHTML = `<div class="empty-state" style="display:block;"><i class="fas fa-exclamation-triangle"></i><p>Chyba načítání dat.</p></div>`; contentEl.style.display = 'block'; }
        } finally {
             // Nepotřebujeme volat setLoadingState(false) zde, protože to dělají jednotlivé renderovací funkce
             // setLoadingState(sectionKey, false);
        }
    }
    function tabIdToSectionKey(tabId) { switch (tabId) { case 'practice-tab': return 'stats'; case 'test-results-tab': return 'tests'; case 'study-plan-tab': return 'plan'; case 'topic-analysis-tab': return 'topics'; default: return 'all'; } }
    async function loadPageData() {
        // This function now primarily ensures the correct tab is displayed initially
        // The actual data loading happens in loadTabData, called by configureUIForGoal -> switchActiveTab
        if (!currentProfile) {
            console.error("[Load Page Data v6.2] Chybí profil.");
             setLoadingState('all', false);
             // Possibly redirect to login or show error
             return;
        }
         if (!currentProfile.learning_goal) {
             console.log("[Load Page Data v6.2] Cíl chybí, modální okno by mělo být zobrazeno z initializeApp.");
              setLoadingState('all', false); // Ukončíme hlavní načítání
             return; // Don't proceed further if modal is shown
         }

        // If goal exists, proceed with showing content (already handled by initializeApp/configureUIForGoal)
        console.log(`🔄 [Load Page Data v6.2] Kontrola stavu stránky pro cíl: ${currentProfile.learning_goal}...`);
        setLoadingState('all', true); // Set loading state for the whole page briefly
        hideError();

        // Initial tab setup is now handled by configureUIForGoal calling switchActiveTab
        // which calls loadTabData for the active tab.

        // We just need to ensure the global loading state is eventually turned off.
        // Find the active tab and wait for its data to load (check isLoading state).
        const activeTabId = localStorage.getItem('lastActiveProcvicovaniTab') || 'practice-tab';
        const sectionKey = tabIdToSectionKey(activeTabId);

        // Simple way: just turn off global loading after a short delay,
        // assuming the tab data load will handle its own state.
        // More complex: use Promises or check isLoading[sectionKey]
        await new Promise(resolve => setTimeout(resolve, 100)); // Krátká pauza
        console.log("✅ [Load Page Data v6.2] Dokončeno (načítání záložky řídí loadTabData).");
        setLoadingState('all', false);
        initTooltips(); // Initialize tooltips after potential content changes
    }
    function handleTabSwitch(eventOrTabId) {
        let tabId, targetTabButton;
        if (typeof eventOrTabId === 'string') { tabId = eventOrTabId; targetTabButton = document.querySelector(`.content-tab[data-tab="${tabId}"]`); if (!targetTabButton) { console.warn(`[Tabs v6.2] Tab button with ID '${tabId}' not found.`); return; } }
        else if (eventOrTabId?.currentTarget) { targetTabButton = eventOrTabId.currentTarget; tabId = targetTabButton.dataset.tab; if (!tabId) return; }
        else { console.warn("[Tabs v6.2] Invalid argument for handleTabSwitch."); return; }

        // Nenačítat znovu, pokud je záložka již aktivní a nejedná se o první načtení
        if (targetTabButton.classList.contains('active') && !isInitialTabLoad) {
             console.log(`[Tabs v6.2] Záložka ${tabId} je již aktivní.`);
             return;
        }

        console.log(`[Tabs v6.2] Přepínání na: ${tabId}`);
        if(ui.contentTabs && ui.contentTabs.length > 0) { ui.contentTabs.forEach(tab => tab.classList.remove('active')); } else { console.warn("[Tabs v6.2] ui.contentTabs nenalezeno."); }
        targetTabButton.classList.add('active');
        const activeContentId = `${tabId}-content`;
        if(ui.tabContents && ui.tabContents.length > 0) { ui.tabContents.forEach(content => { if(content){ content.classList.toggle('active', content.id === activeContentId); content.style.display = content.id === activeContentId ? 'block' : 'none'; }}); } else { console.warn("[Tabs v6.2] ui.tabContents nenalezeno."); }
        localStorage.setItem('lastActiveProcvicovaniTab', tabId);

        // Načíst data pouze pokud přepínáme záložku (ne při prvním načtení řízeném z initializeApp)
        if (!isInitialTabLoad) {
             loadTabData(tabId);
        }
        isInitialTabLoad = false; // Po prvním přepnutí (i tom init) nastavíme na false
    }

    function switchActiveTab(tabId) { const tabButton = document.querySelector(`.content-tab[data-tab="${tabId}"]`); if (tabButton) handleTabSwitch({ currentTarget: tabButton }); else console.warn(`[SwitchActiveTab v6.2] Záložka '${tabId}' nenalezena.`);}
    async function handleRefreshClick() { if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } console.log("🔄 Manual refresh triggered..."); const icon = ui.refreshDataBtn?.querySelector('i'); const text = ui.refreshDataBtn?.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = true; // Znovu načteme data pro aktuálně aktivní záložku let activeTabId = localStorage.getItem('lastActiveProcvicovaniTab') || 'practice-tab'; let activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`); if (!activeTabButton || activeTabButton.style.display === 'none') { activeTabId = 'practice-tab'; } await loadTabData(activeTabId); // Explicitně načteme data pro aktivní tab if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = false; }
    function handleOutsideNotificationClick(event) { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } }
    function initializeSupabase() { try { if (!window.supabase?.createClient) throw new Error("Supabase library not loaded."); if (window.supabaseClient) { supabase = window.supabaseClient; console.log('[Supabase] Using existing global client instance.'); } else if (supabase === null) { supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); if (!supabase) throw new Error("Supabase client creation failed."); window.supabaseClient = supabase; console.log('[Supabase] Client initialized by main.js and stored globally.'); } else { console.log('[Supabase] Using existing local client instance.'); } return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }
    async function createDefaultProfile(userId, email) { console.log(`[Default Profile] Creating default profile for new user ${userId}...`); const defaultProfileData = { id: userId, username: email.split('@')[0], email: email, updated_at: new Date().toISOString(), learning_goal: null, preferences: {}, points: 0, level: 1, completed_exercises: 0, streak_days: 0, selected_title: null, avatar_url: null, first_name: null, last_name: null, }; try { const { data, error } = await supabase.from('profiles').insert(defaultProfileData).select('*, selected_title, preferences').single(); if (error) { if (error.code === '23505') { console.warn("[Default Profile] Profile likely already exists, attempting to fetch..."); const { data: existingProfile, error: fetchError } = await supabase.from('profiles').select('*, selected_title, preferences').eq('id', userId).single(); if (fetchError) { console.error("[Default Profile] Error fetching existing profile after unique violation:", fetchError); throw fetchError; } if (!existingProfile.preferences) existingProfile.preferences = {}; return existingProfile; } throw error; } if (!data.preferences) data.preferences = {}; console.log("[Default Profile] Default profile created successfully:", data); return data; } catch (err) { console.error("[Default Profile] Error creating default profile:", err); showError("Nepodařilo se vytvořit uživatelský profil.", true); return null; } }
    // --- END: Core Application Logic ---

    // --- START: Event Listeners Setup ---
    function setupEventListeners() {
        console.log("[Procvičování SETUP v6.2] Nastavování listenerů...");
        const safeAddListener = (elementOrElements, eventType, handler, descriptiveKey) => {
            const elements = (elementOrElements instanceof NodeList || Array.isArray(elementOrElements)) ? elementOrElements : [elementOrElements];
            let count = 0;
            elements.forEach(element => {
                if (element) {
                    if (element._eventHandlers?.[eventType]) element.removeEventListener(eventType, element._eventHandlers[eventType]);
                    element.addEventListener(eventType, handler);
                    if (!element._eventHandlers) element._eventHandlers = {};
                    element._eventHandlers[eventType] = handler;
                    count++;
                }
            });
            if (count === 0 && elements.length > 0 && !ui[descriptiveKey] && elements[0] !== document) {
                const nonCriticalMissing = ['markAllReadBtn', 'createPlanBtnEmpty', 'startTestBtnPlan', 'startTestBtnPrompt', 'startTestBtnResults', 'startTestBtnAnalysis'];
                if (nonCriticalMissing.includes(descriptiveKey)) {
                    console.log(`[SETUP v6.2] Nekritický element nenalezen pro listener: ${descriptiveKey}.`);
                } else {
                    console.warn(`[SETUP v6.2] Element nenalezen pro listener: ${descriptiveKey}.`);
                }
            }
        };

        const tabs = ui.contentTabs && ui.contentTabs.length > 0 ? ui.contentTabs : document.querySelectorAll('.content-tab');
        if (tabs.length > 0) tabs.forEach(tab => { if(tab) tab.addEventListener('click', handleTabSwitch); });
        else console.warn("[SETUP v6.2] Elementy záložek (ui.contentTabs) nenalezeny.");

        safeAddListener(ui.refreshDataBtn, 'click', handleRefreshClick, 'refreshDataBtn');
        safeAddListener(ui.startTestBtnPrompt, 'click', () => window.location.href = 'test1.html', 'startTestBtnPrompt');
        safeAddListener(ui.startTestBtnResults, 'click', () => window.location.href = 'test1.html', 'startTestBtnResults');
        safeAddListener(ui.startTestBtnPlan, 'click', () => window.location.href = 'test1.html', 'startTestBtnPlan');
        safeAddListener(ui.createPlanBtnEmpty, 'click', () => switchActiveTab('study-plan-tab'), 'createPlanBtnEmpty');
        safeAddListener(ui.startTestBtnAnalysis, 'click', () => window.location.href = 'test1.html', 'startTestBtnAnalysis');
        safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
        safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
        safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');
        safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn');
        document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });

        safeAddListener(ui.markAllReadBtn, 'click', markAllNotificationsRead, 'markAllReadBtn');
        safeAddListener(ui.notificationBell, 'click', (event) => {
            event.stopPropagation();
            if (ui.notificationsDropdown) {
                ui.notificationsDropdown.classList.toggle('active');
                if (ui.notificationsDropdown.classList.contains('active') && ui.notificationsList?.innerHTML.trim() === '' && !isLoading.notifications) {
                    if (currentUser?.id) fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT);
                    else console.warn("[NotificationBell] Chybí currentUser.id pro načtení notifikací.");
                }
            } else { console.warn("[NotificationBell] ui.notificationsDropdown nenalezeno.");}
        }, 'notificationBell');

        if (ui.notificationsList) {
            if (ui.notificationsList._itemClickHandler) ui.notificationsList.removeEventListener('click', ui.notificationsList._itemClickHandler);
            ui.notificationsList._itemClickHandler = async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); if (ui.notificationCount) { const countText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(countText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); } if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = (parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0') === 0); } } if (link) window.location.href = link; if (ui.notificationsDropdown) ui.notificationsDropdown.classList.remove('active'); } };
            ui.notificationsList.addEventListener('click', ui.notificationsList._itemClickHandler);
        } else console.warn("[SETUP v6.2] ui.notificationsList nenalezeno.");

        document.removeEventListener('click', handleOutsideNotificationClick);
        document.addEventListener('click', handleOutsideNotificationClick);

        const modalBackButtons = ui.goalSelectionModal ? ui.goalSelectionModal.querySelectorAll('.modal-back-btn') : [];
        safeAddListener(modalBackButtons, 'click', (event) => {
            const targetStepId = event.currentTarget.dataset.targetStep;
            const currentActiveStep = ui.goalSelectionModal?.querySelector('.modal-step.active');
            const targetStepElement = document.getElementById(targetStepId);
            if(currentActiveStep) currentActiveStep.classList.remove('active');
            if(targetStepElement) targetStepElement.classList.add('active');
            pendingGoal = null;
        }, 'modalBackButtons');

        const modalConfirmButtons = ui.goalSelectionModal ? ui.goalSelectionModal.querySelectorAll('.modal-confirm-btn') : [];
        safeAddListener(modalConfirmButtons, 'click', (event) => {
            const goal = event.currentTarget.dataset.goal;
            if (goal === pendingGoal) { handleStep2Confirm(goal);
            } else if (ui.goalStep1?.classList.contains('active') && goal) { handleInitialGoalSelection(goal); }
        }, 'modalConfirmButtons');

        console.log("[Procvičování SETUP v6.2] Nastavení listenerů dokončeno.");
    }
    // --- END: Event Listeners Setup ---

    // --- START: Initialization ---
    async function initializeApp() {
        try {
            console.log(`[INIT Procvičování] App Init Start v25.0.13...`); // Verze
            cacheDOMElements();

            if (!initializeSupabase()) {
                 if(ui.initialLoader) {ui.initialLoader.innerHTML = '<p style="color:red;">Kritická chyba DB.</p>'; setTimeout(()=> ui.initialLoader.style.display = 'none', 2000);}
                 return;
            }

            applyInitialSidebarState(); updateCopyrightYear(); initMouseFollower(); initHeaderScrollDetection(); updateOnlineStatus(); initTooltips();

            if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
            if (ui.mainContent) ui.mainContent.style.display = 'none';
            if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none';
            if (ui.tabContents && ui.tabContents.length > 0) { ui.tabContents.forEach(el => {if(el) el.style.display = 'none';}); }
            else { console.warn("[INIT] ui.tabContents nenalezeno nebo prázdné při skrývání.");}


            hideError(); console.log("[INIT Procvičování] Kontrola autentizační session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Chyba session: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user; console.log(`[INIT Procvičování] Uživatel ověřen (ID: ${currentUser.id}).`);
                const [profileResult, titlesResult, initialNotificationsResult] = await Promise.allSettled([
                    supabase.from('profiles').select('*, selected_title, preferences').eq('id', currentUser.id).single(),
                    supabase.from('title_shop').select('title_key, name'),
                    fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT)
                ]);

                currentProfile = (profileResult.status === 'fulfilled' && profileResult.value?.data) ? profileResult.value.data : await createDefaultProfile(currentUser.id, currentUser.email);
                if (!currentProfile) throw new Error("Nepodařilo se vytvořit/načíst profil uživatele.");
                if (!currentProfile.preferences) currentProfile.preferences = {};
                console.log("[INIT Procvičování] Profil načten:", currentProfile);

                allTitles = (titlesResult.status === 'fulfilled') ? (titlesResult.value?.data || []) : [];
                console.log(`[INIT Procvičování] Načteno ${allTitles.length} titulů.`);
                updateSidebarProfile(currentProfile, allTitles);

                if (initialNotificationsResult.status === 'fulfilled') { renderNotifications(initialNotificationsResult.value.unreadCount, initialNotificationsResult.value.notifications || []); }
                else { console.error("[INIT Procvičování] Chyba načítání počátečních notifikací:", initialNotificationsResult.reason); renderNotifications(0, []); }

                setupEventListeners();

                // --- ZNOVU Upravená logika pro cíl ---
                let goal = currentProfile.learning_goal; // Cíl z DB má nejvyšší prioritu
                console.log(`[INIT Goal Check] Cíl z DB: ${goal}`);

                if (!goal) { // Pokud není cíl v DB...
                    // ...IGNORUJEME localStorage pro obnovení cíle
                    console.log(`[INIT Procvičování] Cíl není v DB. Zobrazuji modální okno.`);
                    showGoalSelectionModal();
                    if(ui.initialLoader) ui.initialLoader.style.display = 'none';
                    if (ui.mainContent) ui.mainContent.style.display = 'block'; // Zobrazit, aby byl vidět modal
                    if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none';
                    if (ui.tabContents && ui.tabContents.length > 0) { ui.tabContents.forEach(el => {if(el) el.style.display='none';}); }
                } else {
                     // Cíl existuje v DB, pokračujeme normálně
                     console.log(`[INIT Procvičování] Cíl '${goal}' již nastaven v profilu (DB). Pokračuji...`);
                     if(ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none';
                     if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'flex';
                     configureUIForGoal(); // Tento zavolá switchActiveTab, který zavolá loadTabData pro aktivní záložku
                }
                // --- Konec ZNOVU upravené logiky ---


                if (ui.mainContent && (!ui.goalSelectionModal || getComputedStyle(ui.goalSelectionModal).display === 'none')) {
                    ui.mainContent.style.display = 'flex';
                    requestAnimationFrame(() => { if(ui.mainContent) ui.mainContent.classList.add('loaded'); initScrollAnimations(); });
                }

                console.log("✅ [INIT Procvičování] Nastavení specifické pro stránku dokončeno.");

            } else {
                console.log('[INIT Procvičování] Uživatel není přihlášen, přesměrování...');
                window.location.href = '/auth/index.html';
            }
        } catch (error) {
            console.error("❌ [INIT Procvičování] Kritická chyba inicializace:", error);
            showError(`Chyba inicializace: ${error.message}`, true);
            if (ui.mainContent) ui.mainContent.style.display = 'block';
            setLoadingState('all', false);
        } finally {
            const il = ui.initialLoader;
            if (il && !il.classList.contains('hidden')) {
                il.classList.add('hidden');
                setTimeout(() => { if(il) il.style.display = 'none'; }, 300);
            }
        }
    }
    // --- END: Initialization ---

    // --- START THE APP ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }
    // --- END THE APP ---

})(); // End IIFE