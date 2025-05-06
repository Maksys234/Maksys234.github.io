// dashboard/procvicovani/main.js
// Version: 24.10.5 - Ensure proper initial tab activation, add stubs for notification functions.
// + DEBUG LOGGING for missing button issue
// + FORCE VISIBILITY FIX
// + COMPUTED STYLE CHECK

(function() { // Start IIFE
    'use strict';

    // --- Глобальные переменные ---
    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
    // NEW_FUNCTION_START - Константа для уведомлений
    const NOTIFICATION_FETCH_LIMIT = 5; // Максимальное количество уведомлений для загрузки
    // NEW_FUNCTION_END

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
    const ui = {};

    function cacheDOMElements() {
        console.log("[Procvičování Cache DOM v3] Caching elements...");
        const ids = [
            'diagnostic-prompt', 'start-test-btn-prompt', 'stats-cards', 'shortcuts-grid',
            'test-results-container', 'test-results-loading', 'test-results-content',
            'test-results-empty', 'start-test-btn-results',
            'study-plan-container', 'study-plan-loading', 'study-plan-content',
            'study-plan-empty', 'start-test-btn-plan', 'main-plan-schedule',
            'topic-analysis-container', 'topic-analysis-loading', 'topic-analysis-content',
            'topic-analysis-empty', 'start-test-btn-analysis', 'topic-grid',
            'global-error', 'toastContainer', 'main-content', 'refresh-data-btn',
            'goal-selection-modal', 'goal-step-1', 'goal-step-accelerate',
            'accelerate-areas-group', 'accelerate-reason-group', 'goal-step-review',
            'review-areas-group', 'goal-step-explore', 'explore-level-group',
            'initial-loader', 'sidebar-overlay', 'sidebar', 'main-mobile-menu-toggle',
            'sidebar-close-toggle', 'sidebar-toggle-btn', 'sidebar-avatar',
            'sidebar-name', 'sidebar-user-title', 'currentYearSidebar',
            'dashboard-title', 'currentYearFooter', 'mouse-follower', 'tabs-wrapper',
            'notification-bell', 'notification-count', 'notifications-dropdown',
            'notifications-list', 'no-notifications-msg', 'mark-all-read-btn'
        ];
        const potentiallyMissingIds = ['toastContainer'];
        const criticalMissingIds = ['goal-step-1', 'goal-selection-modal'];

        const notFound = [];
        const missingCritical = [];
        const missingPotential = [];

        ids.forEach(id => {
            const element = document.getElementById(id);
            const key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
            if (element) { ui[key] = element; }
            else {
                notFound.push(id);
                ui[key] = null;
                if (criticalMissingIds.includes(id)) {
                    missingCritical.push(id);
                } else if (potentiallyMissingIds.includes(id)) {
                    missingPotential.push(id);
                }
            }
        });

        ui.contentTabs = document.querySelectorAll('.content-tab');
        ui.tabContents = document.querySelectorAll('.tab-content');
        ui.modalBackBtns = document.querySelectorAll('.modal-back-btn');
        ui.modalConfirmBtns = document.querySelectorAll('.modal-confirm-btn');
        ui.dashboardHeader = document.querySelector('.dashboard-header');

        if (missingCritical.length > 0) { console.error("[CACHE DOM v3] CRITICAL elements missing after search:", missingCritical); }
        if (missingPotential.length > 0) { console.warn(`[CACHE DOM v3] Potential elements missing: (${missingPotential.length})`, missingPotential); }
        if (notFound.length === 0) { console.log("[CACHE DOM v3] All primary elements cached successfully."); }
        else if (notFound.length > 0 && missingCritical.length === 0) { console.log(`[CACHE DOM v3] Some non-critical elements not found: (${notFound.length})`, notFound); }
        console.log("[Procvičování Cache DOM v3] Caching attempt complete.");
    }

    // --- Карты иконок и визуалов ---
    const topicIcons = { "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon", "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar", "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar", "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book" };
    const activityVisuals = { test: { name: 'Test', icon: 'fa-vial', class: 'test' }, exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' }, badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' }, diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' }, plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' }, other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' }, default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' } };

    // --- START: Вспомогательные функции ---
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) { let container = ui.toastContainer || document.getElementById('toastContainer'); if (!container) { try { console.warn("Toast container not found, attempting to create dynamically."); container = document.createElement('div'); container.id = 'toastContainer'; container.className = 'toast-container'; document.body.appendChild(container); ui.toastContainer = container; } catch (createError) { console.error("Failed to create toast container dynamically:", createError); alert(`${title}: ${message}`); return; } } try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); container.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Error showing toast (after potential container creation):", e); } }
    function showError(message, isGlobal = false) { console.error("Error occurred:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Obnovit</button></div>`; ui.globalError.style.display = 'block'; } else { showToast('CHYBA', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatDate(dateString) { try { return dateString ? new Date(dateString).toLocaleDateString('cs-CZ') : '-'; } catch (e) { return '-'; } }
    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return '--:--'; const m = Math.floor(seconds / 60); const ss = Math.round(seconds % 60); return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`; }
    // NEW_FUNCTION_START - Обновленная formatRelativeTime для уведомлений
    function formatRelativeTime(timestamp) {
        if (!timestamp) return '';
        try {
            const now = new Date();
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '-'; // Invalid date

            const diffMs = now - date;
            const diffSec = Math.round(diffMs / 1000);
            const diffMin = Math.round(diffSec / 60);
            const diffHour = Math.round(diffMin / 60);
            const diffDay = Math.round(diffHour / 24);
            const diffWeek = Math.round(diffDay / 7);

            if (diffSec < 60) return 'Nyní';
            if (diffMin < 60) return `Před ${diffMin} min`;
            if (diffHour < 24) return `Před ${diffHour} hod`;
            if (diffDay === 1) return `Včera`;
            if (diffDay < 7) return `Před ${diffDay} dny`;
            if (diffWeek <= 4) return `Před ${diffWeek} týdny`;
            return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
        } catch (e) {
            console.error("Chyba formátování času:", e, "Timestamp:", timestamp);
            return '-';
        }
    }
    // NEW_FUNCTION_END
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function updateCopyrightYear() { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
    function applyInitialSidebarState() { try { const state = localStorage.getItem(SIDEBAR_STATE_KEY); const collapsed = state === 'collapsed'; document.body.classList.toggle('sidebar-collapsed', collapsed); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) icon.className = collapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; if(ui.sidebarToggleBtn) ui.sidebarToggleBtn.title = collapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (e) { console.error("Sidebar state error:", e); } }
    function toggleSidebar() { try { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; if(ui.sidebarToggleBtn) ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (error) { console.error("[Sidebar Toggle] Error:", error); } }
    function updateSidebarProfile(profile, titlesData) { if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("Skipping sidebar profile update - elements missing."); return; } if (profile) { const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || currentUser?.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(profile); const avatarUrl = profile.avatar_url; const finalAvatarUrl = avatarUrl ? `${sanitizeHTML(avatarUrl)}?t=${Date.now()}` : null; ui.sidebarAvatar.innerHTML = finalAvatarUrl ? `<img src="${finalAvatarUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const img = ui.sidebarAvatar.querySelector('img'); if (img) { img.onerror = function() { console.warn(`Failed to load sidebar avatar: ${this.src}. Displaying initials.`); ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; } const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot'; if (selectedTitleKey && titlesData && titlesData.length > 0) { const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) { displayTitle = foundTitle.name; } else { console.warn(`[UI Update Sidebar] Title key "${selectedTitleKey}" not found in fetched titles.`); } } else if (selectedTitleKey) { console.warn(`[UI Update Sidebar] Selected title key present, but titles list is empty or not loaded yet.`); } ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); } else { ui.sidebarName.textContent = "Nepřihlášen"; ui.sidebarAvatar.textContent = '?'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title'); } }
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
            console.log(`[Procvičování UI Loading v3] Section: ${key}, isLoading: ${loading}`);

            const sectionMap = {
                stats: { container: ui.statsCards, skeletonFn: renderStatsSkeletons },
                tests: { container: ui.testResultsContainer, content: ui.testResultsContent, empty: ui.testResultsEmpty, loader: ui.testResultsLoading, skeletonFn: renderTestSkeletons },
                plan: { container: ui.studyPlanContainer, content: ui.studyPlanContent, empty: ui.studyPlanEmpty, loader: ui.studyPlanLoading, skeletonFn: renderPlanSkeletons },
                topics: { container: ui.topicAnalysisContainer, content: ui.topicAnalysisContent, empty: ui.topicAnalysisEmpty, loader: ui.topicAnalysisLoading, skeletonFn: renderTopicSkeletons },
                shortcuts: { container: ui.shortcutsGrid, skeletonFn: renderShortcutSkeletons },
                notifications: { /* Handled separately by renderNotificationSkeletons if needed */ },
                goalSelection: { /* Handled by button states in goal selection modal */ }
            };

            const config = sectionMap[key];
            if (!config) {
                if (key !== 'all' && key !== 'notifications' && key !== 'goalSelection') {
                    console.warn(`[Procvičování UI Loading v3] Unknown section key '${key}'.`);
                }
                return;
            }

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
                if (content?.querySelector(skeletonSelector)) {
                    content.innerHTML = '';
                }
                // Ensure correct display after loading
                setTimeout(() => {
                    if (content && empty) {
                        const hasActualContent = content.innerHTML.trim() !== '' && !content.querySelector(skeletonSelector);
                        let displayType = 'block';
                        if (content.id === 'topic-grid' || content.id === 'stats-cards' || content.id === 'shortcuts-grid' || content.id === 'main-plan-schedule' || content.classList.contains('test-stats')) {
                            displayType = 'grid';
                        }
                        content.style.display = hasActualContent ? displayType : 'none';
                        empty.style.display = hasActualContent ? 'none' : 'block';
                        // console.log(`[SetLoadingState Finished] Section: ${key}, hasContent: ${hasActualContent}, contentDisplay: ${content.style.display}, emptyDisplay: ${empty.style.display}`);
                    } else if (content && (key === 'stats' || key === 'shortcuts')) {
                        if (container) container.style.display = (key === 'stats' || key === 'shortcuts') ? 'grid' : 'block';
                    }
                }, 50);
            }
        };

        if (sectionKey === 'all') {
            Object.keys(isLoading).forEach(key => {
                if (key !== 'all' && key !== 'goalSelection' && key !== 'notifications') {
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

    // --- Загрузка Данных (Заглушки) ---
    async function fetchDashboardStats(userId, profileData) {
        console.log("[Fetch Data Stub] fetchDashboardStats called. Returning placeholder data.");
        await new Promise(resolve => setTimeout(resolve, 700));
        return {
            totalPoints: profileData?.points || 0,
            completedExercises: profileData?.completed_exercises || 0,
            activeStreak: profileData?.streak_days || 0,
            lastTestScore: diagnosticResultsData.length > 0 ? diagnosticResultsData[0].total_score : null,
        };
    }
    async function fetchDiagnosticResults(userId, goal) {
        console.log("[Fetch Data Stub] fetchDiagnosticResults called. Returning empty array.");
        await new Promise(resolve => setTimeout(resolve, 1000));
        return [];
    }
    async function fetchActiveStudyPlan(userId, goal) {
        console.log("[Fetch Data Stub] fetchActiveStudyPlan called. Returning null.");
        await new Promise(resolve => setTimeout(resolve, 800));
        return null;
    }
    async function fetchPlanActivities(planId, goal) {
        console.log("[Fetch Data Stub] fetchPlanActivities called. Returning empty array.");
        await new Promise(resolve => setTimeout(resolve, 500));
        return [];
    }
    async function fetchTopicProgress(userId, goal) {
        console.log("[Fetch Data Stub] fetchTopicProgress called. Returning placeholder data.");
        await new Promise(resolve => setTimeout(resolve, 900));
        return [
            { id: 'algebra', name: 'Algebra', progress: 0, last_practiced: null, strength: 'neutral' },
            { id: 'geometry', name: 'Geometrie', progress: 0, last_practiced: null, strength: 'neutral' },
            { id: 'functions', name: 'Funkce', progress: 0, last_practiced: null, strength: 'neutral' }
        ];
    }
    // --- Конец Загрузки Данных ---

    // --- Рендеринг UI (Заглушки) ---
    function renderStatsCards(stats) {
        console.log("[Render UI Stub] renderStatsCards called with:", stats);
        if (!ui.statsCards) {
            console.error("Stats cards container not found!");
            setLoadingState('stats', false);
            return;
        }
        if (ui.statsCards.querySelectorAll('.dashboard-card').length === 0) {
            ui.statsCards.innerHTML = `
                <div class="dashboard-card card">
                    <div class="card-header"><h3 class="card-title">Celkové Body</h3><span class="card-badge info">INFO</span></div>
                    <div class="card-content"><div class="card-value">${stats?.totalPoints || 'N/A'}</div></div>
                    <div class="card-footer">Statistika bodů</div>
                </div>
                <div class="dashboard-card card">
                    <div class="card-header"><h3 class="card-title">Dokončená Cvičení</h3></div>
                    <div class="card-content"><div class="card-value">${stats?.completedExercises || 'N/A'}</div></div>
                    <div class="card-footer">Přehled cvičení</div>
                </div>
                <div class="dashboard-card card">
                    <div class="card-header"><h3 class="card-title">Série Dní</h3></div>
                    <div class="card-content"><div class="card-value">${stats?.activeStreak || 'N/A'}</div></div>
                    <div class="card-footer">Aktuální série</div>
                </div>
                <div class="dashboard-card card">
                    <div class="card-header"><h3 class="card-title">Poslední Test</h3></div>
                    <div class="card-content"><div class="card-value">${stats?.lastTestScore !== null && stats?.lastTestScore !== undefined ? stats.lastTestScore + '%' : 'N/A'}</div></div>
                    <div class="card-footer">Výsledek testu</div>
                </div>
            `;
        } else {
            // Placeholder: Just log that we would update if real data changed
            console.log("[Render UI Stub] Stats cards would be updated here if data changed significantly.");
        }
        ui.statsCards.classList.remove('loading');
        setLoadingState('stats', false);
    }
    function calculateAverageScore(results) { console.warn("calculateAverageScore not implemented"); return 0; }
    function renderTestChart(chartData) { console.warn("renderTestChart not implemented"); }
    function renderTestResults(results, goal) {
        console.log("[Render UI Stub] renderTestResults called. Displaying empty state.");
        if(ui.testResultsContainer) ui.testResultsContainer.classList.remove('loading');
        if(ui.testResultsContent) { ui.testResultsContent.innerHTML = ''; ui.testResultsContent.style.display = 'none'; }
        if(ui.testResultsEmpty) ui.testResultsEmpty.style.display = 'block';
        setLoadingState('tests', false);
    }
    function renderStudyPlanOverview(plan, activities, goal) {
        console.log("[Render UI Stub] renderStudyPlanOverview called. Displaying empty state.");
        if(ui.studyPlanContainer) ui.studyPlanContainer.classList.remove('loading');
        if(ui.studyPlanContent) { ui.studyPlanContent.innerHTML = ''; ui.studyPlanContent.style.display = 'none'; }
        if(ui.studyPlanEmpty) ui.studyPlanEmpty.style.display = 'block';
        setLoadingState('plan', false);
    }
    function renderTopicAnalysis(topics, goal) {
        console.log("[Render UI Stub] renderTopicAnalysis called. Displaying empty state.");
        if(ui.topicAnalysisContainer) ui.topicAnalysisContainer.classList.remove('loading');
        if(ui.topicAnalysisContent) { ui.topicAnalysisContent.innerHTML = ''; ui.topicAnalysisContent.style.display = 'none'; }
        if(ui.topicAnalysisEmpty) ui.topicAnalysisEmpty.style.display = 'block';
        setLoadingState('topics', false);
    }
    // --- Конец Рендеринга UI ---

    // --- Goal Selection Logic ---
    // ... (остается без изменений)
    function showGoalSelectionModal() {
        const modalContainer = ui.goalSelectionModal || document.getElementById('goal-selection-modal');
        const step1Element = ui.goalStep1 || document.getElementById('goal-step-1');
        if (!modalContainer) { console.error("[GoalModal v3 Debug] CRITICAL: Modal container (#goal-selection-modal) NOT FOUND!"); return; }
        if (!step1Element) { console.error("[GoalModal v3 Debug] CRITICAL: Step 1 element (#goal-step-1) NOT FOUND!"); return; }
        console.log("[GoalModal v3 Debug] Showing modal. Container:", modalContainer, "Step 1:", step1Element);
        modalContainer.querySelectorAll('.modal-step').forEach(step => step.classList.remove('active'));
        step1Element.classList.add('active');
        modalContainer.style.display = 'flex';
        requestAnimationFrame(() => modalContainer.classList.add('active'));
        const optionButtons = step1Element.querySelectorAll('.goal-option-card[data-goal]');
        if (!optionButtons || optionButtons.length === 0) { console.error("[GoalModal v3 Debug] No goal option buttons found in #goal-step-1!"); return; }
        optionButtons.forEach(button => {
            const goal = button.dataset.goal;
            if (!goal) { console.warn("[GoalModal v3 Debug] Button missing data-goal attribute:", button); return; }
            const handler = () => handleInitialGoalSelection(goal);
             if (button._goalHandler) button.removeEventListener('click', button._goalHandler);
             button.addEventListener('click', handler);
             button._goalHandler = handler;
        });
        console.log("[GoalModal v3 Debug] Step 1 listeners attached.");
    }
    function handleInitialGoalSelection(selectedGoal) { if (goalSelectionInProgress) return; console.log(`[GoalModal] Initial goal selected: ${selectedGoal}`); pendingGoal = selectedGoal; if (selectedGoal === 'exam_prep') { saveGoalAndProceed(selectedGoal); } else { showStep2(selectedGoal); } }
    function showStep2(goalType) { const step2Id = `goal-step-${goalType.replace('math_', '')}`; console.log(`[GoalModal Debug] showStep2 called for goalType: ${goalType}, looking for ID: ${step2Id}`); const step2Element = document.getElementById(step2Id); const modalContainer = document.getElementById('goal-selection-modal'); const step1Element = document.getElementById('goal-step-1'); if (!modalContainer || !step1Element || !step2Element) { console.error(`[GoalModal Debug] Cannot show step 2: Critical element missing (#${step2Id} Found: ${!!step2Element})`); if(typeof showError === 'function') showError("Chyba: Nelze zobrazit druhý krok výběru cíle.", true); return; } console.log(`[GoalModal Debug] Found Step 2 element:`, step2Element); document.querySelectorAll('.modal-step').forEach(step => step.classList.remove('active')); step2Element.classList.add('active'); console.log(`[GoalModal Debug] Step 2 element (#${step2Id}) activated.`); if (goalType === 'math_accelerate') { console.log(`[GoalModal Debug Force] Applying forced styles for #${step2Id}...`); const footerElement = step2Element.querySelector('.modal-footer'); const confirmButtonElement = step2Element.querySelector('.modal-confirm-btn'); if (footerElement) { console.log(`[GoalModal Debug Force] Found footer element. Applying styles...`); footerElement.style.display = 'flex'; footerElement.style.visibility = 'visible'; footerElement.style.opacity = '1'; footerElement.style.height = 'auto'; footerElement.style.position = 'static'; footerElement.style.overflow = 'visible'; footerElement.style.transform = 'none'; footerElement.style.zIndex = 'auto'; footerElement.style.marginTop = '1rem'; footerElement.style.padding = '1rem 1.5rem'; } else { console.error(`[GoalModal Debug Force] Footer element (.modal-footer) NOT FOUND inside #${step2Id} for forced styling.`); } if (confirmButtonElement) { console.log(`[GoalModal Debug Force] Found confirm button element. Applying styles...`); confirmButtonElement.style.display = 'inline-flex'; confirmButtonElement.style.visibility = 'visible'; confirmButtonElement.style.opacity = '1'; confirmButtonElement.style.position = 'static'; confirmButtonElement.style.transform = 'none'; setTimeout(() => { if (document.body.contains(confirmButtonElement)) { const computedStyles = window.getComputedStyle(confirmButtonElement); console.log(`[GoalModal Debug Force Check] Computed styles for button in #${step2Id}: display=${computedStyles.display}, visibility=${computedStyles.visibility}, opacity=${computedStyles.opacity}, width=${computedStyles.width}, height=${computedStyles.height}`); const footerComputedStyles = window.getComputedStyle(footerElement); console.log(`[GoalModal Debug Force Check] Computed styles for footer in #${step2Id}: display=${footerComputedStyles.display}, visibility=${footerComputedStyles.visibility}, opacity=${footerComputedStyles.opacity}, height=${footerComputedStyles.height}`); if (computedStyles.display === 'none' || computedStyles.visibility === 'hidden' || computedStyles.opacity === '0' || parseFloat(computedStyles.height) === 0) { console.error(`[GoalModal Debug Force Check] Button is STILL hidden! Check CSS conflicts or overlapping elements.`); } else { console.log(`[GoalModal Debug Force Check] Button seems visible.`); } } else { console.error(`[GoalModal Debug Force Check] Button no longer in DOM!`); } }, 100); } else { console.error(`[GoalModal Debug Force] Confirm button (.modal-confirm-btn) NOT FOUND inside #${step2Id}.`); } console.log(`[GoalModal Debug Force] Forced styles applied for #${step2Id}.`); } const formElements = step2Element.querySelectorAll('input[type="checkbox"], input[type="radio"]'); formElements.forEach(el => { if (el.type === 'checkbox' || el.type === 'radio') el.checked = false; }); console.log(`[GoalModal Debug] Cleared ${formElements.length} form elements in #${step2Id}.`); const backBtn = step2Element.querySelector('.modal-back-btn'); if (backBtn) { console.log(`[GoalModal Debug] Found back button in #${step2Id}. Attaching listener.`); const backHandler = () => handleBackToStep1(step1Element, step2Element); if (backBtn._backHandler) backBtn.removeEventListener('click', backBtn._backHandler); backBtn.addEventListener('click', backHandler, { once: true }); backBtn._backHandler = backHandler; } else { console.warn(`[GoalModal Debug] Back button not found in step: #${step2Id}`); } console.log(`[GoalModal Debug] Searching for '.modal-confirm-btn' within #${step2Id} (for listener)...`); const confirmBtn = step2Element.querySelector('.modal-confirm-btn'); if (confirmBtn) { console.log(`[GoalModal Debug] FOUND confirm button in #${step2Id}. Attaching listener...`, confirmBtn); const confirmHandler = () => handleStep2Confirm(goalType); if (confirmBtn._confirmHandler) confirmBtn.removeEventListener('click', confirmBtn._confirmHandler); confirmBtn.addEventListener('click', confirmHandler); confirmBtn._confirmHandler = confirmHandler; confirmBtn.disabled = false; confirmBtn.innerHTML = 'Potvrdit a pokračovat'; console.log(`[GoalModal Debug] Listener attached to confirm button in #${step2Id}.`); } else { console.error(`[GoalModal Debug] CRITICAL: Confirm button (.modal-confirm-btn) NOT FOUND within step #${step2Id}.`); console.log(`[GoalModal Debug] Element searched within:`, step2Element); } }
    function handleBackToStep1(step1Element, currentStep2) { console.log("[GoalModal] Going back to step 1..."); if(currentStep2) currentStep2.classList.remove('active'); if(step1Element) step1Element.classList.add('active'); pendingGoal = null; }
    function handleStep2Confirm(goalType) { if (goalSelectionInProgress) return; const step2Id = `goal-step-${goalType.replace('math_', '')}`; const step2Element = document.getElementById(step2Id); if (!step2Element) { console.error(`[GoalModal] Step 2 element ${step2Id} not found during confirm.`); return; } const details = {}; let isValid = true; try { if (goalType === 'math_accelerate') { details.accelerate_areas = Array.from(step2Element.querySelectorAll('input[name="accelerate_area"]:checked')).map(cb => cb.value); const reasonRadio = step2Element.querySelector('input[name="accelerate_reason"]:checked'); details.accelerate_reason = reasonRadio ? reasonRadio.value : null; if(details.accelerate_areas.length === 0) { showToast("Chyba", "Vyberte prosím alespoň jednu oblast zájmu.", "warning"); isValid = false; } if(!details.accelerate_reason) { showToast("Chyba", "Vyberte prosím důvod.", "warning"); isValid = false; } } else if (goalType === 'math_review') { details.review_areas = Array.from(step2Element.querySelectorAll('input[name="review_area"]:checked')).map(cb => cb.value); } else if (goalType === 'math_explore') { const levelRadio = step2Element.querySelector('input[name="explore_level"]:checked'); details.explore_level = levelRadio ? levelRadio.value : null; if(!details.explore_level) { showToast("Chyba", "Vyberte prosím vaši úroveň.", "warning"); isValid = false; } } } catch (e) { console.error("[GoalModal] Error getting step 2 details:", e); isValid = false; showToast("Chyba", "Nastala chyba při zpracování výběru.", "error"); } if (isValid) { console.log(`[GoalModal] Step 2 details collected for ${goalType}:`, details); saveGoalAndProceed(pendingGoal, details); } }
    async function saveGoalAndProceed(goal, details = null) { if (goalSelectionInProgress || !goal) return; goalSelectionInProgress = true; setLoadingState('goalSelection', true); console.log(`[GoalModal Save v3] Saving goal: ${goal}, with details:`, details); const activeStep = ui.goalSelectionModal?.querySelector('.modal-step.active'); const confirmButton = activeStep?.querySelector('.modal-confirm-btn'); const backButton = activeStep?.querySelector('.modal-back-btn'); if (confirmButton) { confirmButton.disabled = true; confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...'; } if (backButton) backButton.disabled = true; try { if (!supabase || !currentUser || !currentProfile) throw new Error("Supabase client, user, or profile not available."); const existingPreferences = currentProfile.preferences || {}; let finalPreferences = { ...existingPreferences }; if (details && Object.keys(details).length > 0) { finalPreferences.goal_details = details; } else { delete finalPreferences.goal_details; } const updatePayload = { learning_goal: goal, preferences: finalPreferences, updated_at: new Date().toISOString() }; console.log("[GoalModal Save v3] Payload to update:", updatePayload); const { data: updatedProfileData, error } = await supabase.from('profiles').update(updatePayload).eq('id', currentUser.id).select('*, selected_title, preferences').single(); if (error) throw error; currentProfile = updatedProfileData; console.log("[GoalModal Save v3] Goal and preferences saved successfully:", currentProfile.learning_goal, currentProfile.preferences); let goalText = goal; switch(goal) { case 'exam_prep': goalText = 'Příprava na zkoušky'; break; case 'math_accelerate': goalText = 'Učení napřed'; break; case 'math_review': goalText = 'Doplnění mezer'; break; case 'math_explore': goalText = 'Volné prozkoumávání'; break; } showToast('Cíl uložen!', `Váš cíl byl nastaven na: ${goalText}.`, 'success'); if (ui.goalSelectionModal) { ui.goalSelectionModal.classList.remove('active'); setTimeout(() => { if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; }, 300); } if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'block'; document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'block'); configureUIForGoal(goal); await loadPageData(); if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled'); } catch (error) { console.error("[GoalModal Save v3] Error saving goal/preferences:", error); showToast('Chyba', 'Nepodařilo se uložit váš cíl.', 'error'); if (confirmButton) { confirmButton.disabled = false; confirmButton.innerHTML = 'Potvrdit a pokračovat'; } if (backButton) backButton.disabled = false; } finally { goalSelectionInProgress = false; setLoadingState('goalSelection', false); pendingGoal = null; } }
    // --- END: Goal Selection Logic ---

    // --- Рендеринг Ярлыков ---
    function renderShortcutsForGoal(goal, container) { if (!container) { console.warn("Shortcut container not found"); return; } setLoadingState('shortcuts', true); container.innerHTML = ''; console.log(`[Shortcuts] Rendering shortcuts for goal: ${goal}`); let shortcutsHTML = ''; const shortcuts = { test: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-graduation-cap"></i></div><h3 class="shortcut-title">Diagnostický Test</h3><p class="shortcut-desc">Ověřte své znalosti pro přijímačky.</p><a href="/dashboard/procvicovani/test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Test</a></div>`, plan: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-tasks"></i></div><h3 class="shortcut-title">Studijní Plán</h3><p class="shortcut-desc">Zobrazte si svůj personalizovaný plán.</p><a href="/dashboard/procvicovani/plan.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Zobrazit Plán</a></div>`, tutor: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-book-open"></i></div><h3 class="shortcut-title">AI Tutor (Lekce)</h3><p class="shortcut-desc">Nechte si vysvětlit témata z plánu nebo osnovy.</p><a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a></div>`, nextTopic: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-forward"></i></div><h3 class="shortcut-title">Další Téma Osnovy</h3><p class="shortcut-desc">Pokračujte v učení podle standardní osnovy.</p><a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Učit se Další</a></div>`, curriculum: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-stream"></i></div><h3 class="shortcut-title">Přehled Osnovy</h3><p class="shortcut-desc">Zobrazte si přehled témat dle školní osnovy.</p><a href="/dashboard/procvicovani/plan.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Osnovu</a></div>`, weakness: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-search"></i></div><h3 class="shortcut-title">Moje Slabiny</h3><p class="shortcut-desc">Zobrazte témata, kde potřebujete nejvíce zlepšení.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="switchActiveTab('topic-analysis-tab'); return false;">Analýza Témat</a></div>`, review: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-history"></i></div><h3 class="shortcut-title">Opakování</h3><p class="shortcut-desc">Procvičte si témata, která jste dlouho neprobírali.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="showToast('Info','Funkce opakování zatím není implementována.','info'); return false;">Spustit Opakování</a></div>`, explore: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-compass"></i></div><h3 class="shortcut-title">Procházet Témata</h3><p class="shortcut-desc">Vyberte si libovolné matematické téma k učení.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="switchActiveTab('topic-analysis-tab'); return false;">Vybrat Téma</a></div>`, random: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-dumbbell"></i></div><h3 class="shortcut-title">Náhodné Cvičení</h3><p class="shortcut-desc">Spusťte náhodné cvičení pro rychlé procvičení.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="showToast('Info','Funkce náhodného cvičení zatím není implementována.','info'); return false;">Náhodné Cvičení</a></div>`, progress: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-chart-line"></i></div><h3 class="shortcut-title">Můj Pokrok</h3><p class="shortcut-desc">Sledujte své zlepšení v matematice.</p><a href="/dashboard/pokrok.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Pokrok</a></div>` }; switch (goal) { case 'exam_prep': shortcutsHTML = shortcuts.test + shortcuts.plan + shortcuts.tutor; break; case 'math_accelerate': shortcutsHTML = shortcuts.nextTopic + shortcuts.curriculum + shortcuts.tutor; break; case 'math_review': shortcutsHTML = shortcuts.weakness + shortcuts.review + shortcuts.tutor; break; case 'math_explore': shortcutsHTML = shortcuts.explore + shortcuts.random + shortcuts.tutor; break; default: shortcutsHTML = shortcuts.progress + shortcuts.tutor + shortcuts.random; } requestAnimationFrame(() => { if(container) { container.innerHTML = shortcutsHTML; container.classList.remove('loading'); setLoadingState('shortcuts', false); if (typeof initScrollAnimations === 'function') { initScrollAnimations(); } } }); }
    // --- Конец Рендеринга Ярлыков ---

    // --- Конфигурация UI ---
    function configureUIForGoal(goal) { console.log(`[UI Config] Configuring UI for goal: ${goal}`); if (!ui || Object.keys(ui).length === 0) { console.error("[UI Config] UI cache empty, cannot configure."); return; } const isExamPrep = goal === 'exam_prep'; const dashboardTitle = ui.dashboardTitle; if (dashboardTitle) { let titleText = "Procvičování // "; let iconClass = "fas fa-laptop-code"; switch(goal) { case 'exam_prep': titleText += "Příprava na Zkoušky"; iconClass = "fas fa-graduation-cap"; break; case 'math_accelerate': titleText += "Učení Napřed"; iconClass = "fas fa-rocket"; break; case 'math_review': titleText += "Doplnění Mezer"; iconClass = "fas fa-sync-alt"; break; case 'math_explore': titleText += "Volné Prozkoumávání"; iconClass = "fas fa-compass"; break; default: titleText += "Přehled"; } dashboardTitle.innerHTML = `<i class="${iconClass}"></i> ${sanitizeHTML(titleText)}`; } else { console.warn("[UI Config] Dashboard title element not found."); } if (ui.shortcutsGrid) { renderShortcutsForGoal(goal, ui.shortcutsGrid); } else { console.warn("[UI Config] Shortcuts grid not found."); } const testTabButton = document.querySelector('.content-tab[data-tab="test-results-tab"]'); const planTabButton = document.querySelector('.content-tab[data-tab="study-plan-tab"]'); const topicAnalysisButton = document.querySelector('.content-tab[data-tab="topic-analysis-tab"]'); const practiceTabButton = document.querySelector('.content-tab[data-tab="practice-tab"]'); if (testTabButton) testTabButton.style.display = isExamPrep ? 'flex' : 'none'; if (planTabButton) planTabButton.style.display = (isExamPrep || goal === 'math_accelerate') ? 'flex' : 'none'; if (topicAnalysisButton) topicAnalysisButton.style.display = 'flex'; if (practiceTabButton) practiceTabButton.style.display = 'flex'; const activeTab = document.querySelector('.content-tab.active'); if (activeTab && activeTab.style.display === 'none') { console.log("[UI Config] Active tab is hidden, switching to first visible tab."); const firstVisibleTab = document.querySelector('.content-tab:not([style*="display: none"])'); if (firstVisibleTab) { if (typeof handleTabSwitch === 'function') { handleTabSwitch({ currentTarget: firstVisibleTab }); } else { console.error("handleTabSwitch function not defined for tab switch!"); } } else { console.warn("[UI Config] No visible tabs found to switch to."); } } else if (!activeTab) { console.log("[UI Config] No active tab found, activating first visible tab."); const firstVisibleTab = document.querySelector('.content-tab:not([style*="display: none"])'); if (firstVisibleTab) { if (typeof handleTabSwitch === 'function') { handleTabSwitch({ currentTarget: firstVisibleTab }); } else { console.error("handleTabSwitch function not defined for tab switch!"); } } else { console.warn("[UI Config] No visible tabs found to activate."); } } console.log(`[UI Config] UI configured for goal: ${goal}`); }
    // --- Конец Конфигурации UI ---

    // --- Загрузка Основных Данных Страницы ---
    async function loadPageData() { if (!currentProfile) { console.error("[Load Page Data] Profile not loaded."); showError("Chyba: Profil uživatele není k dispozici.", true); setLoadingState('all', false); return; } const goal = currentProfile.learning_goal; if (!goal) { console.warn("[Load Page Data] Learning goal not set. Aborting."); if (typeof showGoalSelectionModal === 'function') showGoalSelectionModal(); else console.error("showGoalSelectionModal is not defined!"); setLoadingState('all', false); if(ui.mainContent) ui.mainContent.classList.add('interaction-disabled'); if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'none'; document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none'); return; } if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled'); if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'block'; if (!currentUser || !supabase) { showError("Chyba: Nelze načíst data.", true); setLoadingState('all', false); return; } console.log(`🔄 [Load Page Data] Loading data for goal: ${goal}...`); setLoadingState('all', true); hideError(); configureUIForGoal(goal); if (ui.statsCards) renderStatsSkeletons(ui.statsCards); if (document.querySelector('.content-tab[data-tab="test-results-tab"]:not([style*="display: none"])') && ui.testResultsContent) renderTestSkeletons(ui.testResultsContent); if (document.querySelector('.content-tab[data-tab="study-plan-tab"]:not([style*="display: none"])') && ui.studyPlanContent) renderPlanSkeletons(ui.studyPlanContent); if (document.querySelector('.content-tab[data-tab="topic-analysis-tab"]:not([style*="display: none"])') && ui.topicAnalysisContent) renderTopicSkeletons(ui.topicAnalysisContent); try { const stats = await fetchDashboardStats(currentUser.id, currentProfile); userStatsData = stats; renderStatsCards(userStatsData); const promisesToAwait = []; if (goal === 'exam_prep' && document.querySelector('.content-tab[data-tab="test-results-tab"]:not([style*="display: none"])')) { promisesToAwait.push(fetchDiagnosticResults(currentUser.id, goal).then(r => { diagnosticResultsData = r || []; renderTestResults(diagnosticResultsData, goal); })); } else { setLoadingState('tests', false); if(ui.testResultsContent) ui.testResultsContent.innerHTML=''; } if ((goal === 'exam_prep' || goal === 'math_accelerate') && document.querySelector('.content-tab[data-tab="study-plan-tab"]:not([style*="display: none"])')) { promisesToAwait.push(fetchActiveStudyPlan(currentUser.id, goal).then(async (p) => { studyPlanData = p || null; planActivitiesData = studyPlanData ? await fetchPlanActivities(studyPlanData.id, goal) : []; renderStudyPlanOverview(studyPlanData, planActivitiesData, goal); })); } else { setLoadingState('plan', false); if(ui.studyPlanContent) ui.studyPlanContent.innerHTML=''; } if (document.querySelector('.content-tab[data-tab="topic-analysis-tab"]:not([style*="display: none"])')) { promisesToAwait.push(fetchTopicProgress(currentUser.id, goal).then(t => { topicProgressData = t || []; renderTopicAnalysis(topicProgressData, goal); })); } else { setLoadingState('topics', false); if(ui.topicAnalysisContent) ui.topicAnalysisContent.innerHTML=''; } await Promise.allSettled(promisesToAwait); if (goal === 'exam_prep' && diagnosticResultsData.length === 0 && ui.diagnosticPrompt) { ui.diagnosticPrompt.style.display = 'flex'; if(ui.testResultsEmpty) ui.testResultsEmpty.style.display = 'none'; if(ui.studyPlanEmpty) ui.studyPlanEmpty.style.display = 'none'; if(ui.topicAnalysisEmpty) ui.topicAnalysisEmpty.style.display = 'none'; } else if (ui.diagnosticPrompt) { ui.diagnosticPrompt.style.display = 'none'; } console.log("✅ [Load Page Data] All relevant data loaded and rendered for goal:", goal); } catch (error) { console.error("❌ [Load Page Data] Error loading page data:", error); showError(`Nepodařilo se načíst data: ${error.message}`, true); renderStatsCards(null); if (goal === 'exam_prep' && ui.testResultsContent) renderTestResults([], goal); if ((goal === 'exam_prep' || goal === 'math_accelerate') && ui.studyPlanContent) renderStudyPlanOverview(null, [], goal); if (ui.topicAnalysisContent) renderTopicAnalysis([], goal); } finally { setLoadingState('all', false); initTooltips(); } }
    // --- Конец Загрузки Данных Страницы ---

    // --- Event Handlers ---
    function handleTabSwitch(event) {
        if (!event || !event.currentTarget) return;
        const targetTabButton = event.currentTarget;
        const tabId = targetTabButton.dataset.tab;
        if (!tabId) return;

        console.log(`[Tabs] Switching to tab: ${tabId}`);

        ui.contentTabs.forEach(tab => tab.classList.remove('active'));
        targetTabButton.classList.add('active');

        ui.tabContents.forEach(content => {
            const isActive = content.id === tabId;
            content.classList.toggle('active', isActive);
            content.style.display = isActive ? 'block' : 'none';
        });
        // Removed animation logic for now to simplify
    }

    function switchActiveTab(tabId) { const tabButton = document.querySelector(`.content-tab[data-tab="${tabId}"]`); if (tabButton) { handleTabSwitch({ currentTarget: tabButton }); } else { console.warn(`Tab button for '${tabId}' not found.`); } }
    async function handleRefreshClick() { if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } console.log("🔄 Manual refresh triggered..."); const icon = ui.refreshDataBtn?.querySelector('i'); const text = ui.refreshDataBtn?.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = true; await loadPageData(); if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = false; }
    // --- Конец Event Handlers ---

    // --- Логика Уведомлений (Заглушки) ---
    // NEW_FUNCTION_START
    async function fetchNotifications(userId, limit) {
        console.log(`[Notifications Stub] fetchNotifications called for user ${userId}, limit ${limit}. Returning empty.`);
        setLoadingState('notifications', true);
        await new Promise(resolve => setTimeout(resolve, 600)); // Simulate delay
        setLoadingState('notifications', false);
        return { unreadCount: 0, notifications: [] };
    }

    function renderNotifications(count, notifications) {
        console.log(`[Notifications Stub] renderNotifications called with count ${count}.`);
        if (!ui.notificationBell || !ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
            console.error("[Notifications Stub] UI elements for notifications are missing.");
            return;
        }
        ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
        ui.notificationCount.classList.toggle('visible', count > 0);

        if (notifications && notifications.length > 0) {
            ui.notificationsList.innerHTML = notifications.map(n => {
                const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default;
                const isReadClass = n.is_read ? 'is-read' : '';
                const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : '';
                return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
                            ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
                            <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div>
                            <div class="notification-content">
                                <div class="notification-title">${sanitizeHTML(n.title)}</div>
                                <div class="notification-message">${sanitizeHTML(n.message)}</div>
                                <div class="notification-time">${formatRelativeTime(n.created_at)}</div>
                            </div>
                        </div>`;
            }).join('');
            ui.noNotificationsMsg.style.display = 'none';
            ui.notificationsList.style.display = 'block';
        } else {
            ui.notificationsList.innerHTML = ''; // Clear previous
            ui.noNotificationsMsg.style.display = 'block';
            ui.notificationsList.style.display = 'none';
        }
        ui.markAllReadBtn.disabled = count === 0;
    }

    async function markNotificationRead(notificationId) {
        console.log(`[Notifications Stub] markNotificationRead called for ID ${notificationId}. Simulating success.`);
        // В реальном приложении здесь был бы вызов Supabase
        await new Promise(resolve => setTimeout(resolve, 200));
        return true; // Имитация успеха
    }

    async function markAllNotificationsRead() {
        console.log(`[Notifications Stub] markAllNotificationsRead called. Simulating success.`);
        // В реальном приложении здесь был бы вызов Supabase
        await new Promise(resolve => setTimeout(resolve, 300));
        renderNotifications(0, []); // Обновляем UI, показывая 0 уведомлений
        showToast('Oznámení vymazána', 'Všechna oznámení byla označena jako přečtená.', 'success');
    }

    function renderNotificationSkeletons(count = 2) {
        if (!ui.notificationsList || !ui.noNotificationsMsg) return;
        let skeletonHTML = '';
        for (let i = 0; i < count; i++) {
            skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height:16px;width:70%;margin-bottom:6px;"></div><div class="skeleton" style="height:12px;width:90%;"></div><div class="skeleton" style="height:10px;width:40%;margin-top:6px;"></div></div></div>`;
        }
        ui.notificationsList.innerHTML = skeletonHTML;
        ui.noNotificationsMsg.style.display = 'none';
        ui.notificationsList.style.display = 'block';
    }
    // NEW_FUNCTION_END

    // --- Настройка Event Listeners ---
    function setupEventListeners() {
        console.log("[Procvičování SETUP v3] Setting up event listeners...");
        const safeAddListener = (element, eventType, handler, key) => {
            if (element) {
                // Удаляем старый обработчик перед добавлением нового, чтобы избежать дублирования
                if (element._eventHandlers && element._eventHandlers[eventType]) {
                    element.removeEventListener(eventType, element._eventHandlers[eventType]);
                }
                element.addEventListener(eventType, handler);
                if (!element._eventHandlers) element._eventHandlers = {};
                element._eventHandlers[eventType] = handler; // Сохраняем ссылку на новый обработчик
            } else {
                console.warn(`[SETUP v3] Element not found for listener: ${key}`);
            }
        };
        const safeAddListenerToAll = (elementsNodeList, eventType, handler, key) => { /* ... */ }; // Оставляем как есть, но можно улучшить по аналогии

        safeAddListener(ui.refreshDataBtn, 'click', handleRefreshClick, 'refreshDataBtn');
        safeAddListenerToAll(ui.contentTabs, 'click', handleTabSwitch, 'contentTabs');
        safeAddListener(ui.startTestBtnPrompt, 'click', () => window.location.href = 'test1.html', 'startTestBtnPrompt');
        safeAddListener(ui.startTestBtnResults, 'click', () => window.location.href = 'test1.html', 'startTestBtnResults');
        safeAddListener(ui.startTestBtnPlan, 'click', () => window.location.href = 'test1.html', 'startTestBtnPlan');
        safeAddListener(ui.startTestBtnAnalysis, 'click', () => window.location.href = 'test1.html', 'startTestBtnAnalysis');
        safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
        safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
        safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');
        safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn');
        safeAddListenerToAll(document.querySelectorAll('.sidebar-link'), 'click', () => { if (window.innerWidth <= 992) closeMenu(); }, 'sidebarLinks');

        // NEW_FUNCTION_START - Обработчики для уведомлений
        safeAddListener(ui.notificationBell, 'click', (event) => {
            event.stopPropagation();
            ui.notificationsDropdown?.classList.toggle('active');
            // Если открываем и нет данных, загружаем
            if (ui.notificationsDropdown?.classList.contains('active') && ui.notificationsList?.innerHTML.trim() === '' && !isLoading.notifications) {
                fetchNotifications(currentUser?.id, NOTIFICATION_FETCH_LIMIT).then(({ unreadCount, notifications }) => {
                    renderNotifications(unreadCount, notifications || []);
                });
            }
        }, 'notificationBell');

        safeAddListener(ui.markAllReadBtn, 'click', markAllNotificationsRead, 'markAllReadBtn');

        if (ui.notificationsList) {
            // Удаляем предыдущий обработчик, если он был
             if (ui.notificationsList._itemClickHandler) {
                 ui.notificationsList.removeEventListener('click', ui.notificationsList._itemClickHandler);
             }
             ui.notificationsList._itemClickHandler = async (event) => { // Сохраняем ссылку на обработчик
                const item = event.target.closest('.notification-item');
                if (item) {
                    const notificationId = item.dataset.id;
                    const link = item.dataset.link;
                    const isRead = item.classList.contains('is-read');

                    if (!isRead && notificationId) {
                        const success = await markNotificationRead(notificationId); // Эта функция теперь заглушка
                        if (success) { // Обновляем UI немедленно, так как заглушка вернет true
                            item.classList.add('is-read');
                            item.querySelector('.unread-dot')?.remove();
                            const currentCountText = ui.notificationCount.textContent.replace('+', '');
                            const currentCount = parseInt(currentCountText) || 0;
                            const newCount = Math.max(0, currentCount - 1);
                            ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                            ui.notificationCount.classList.toggle('visible', newCount > 0);
                            ui.markAllReadBtn.disabled = newCount === 0;
                        }
                    }
                    if (link) window.location.href = link;
                    ui.notificationsDropdown?.classList.remove('active'); // Закрываем после клика
                }
            };
            ui.notificationsList.addEventListener('click', ui.notificationsList._itemClickHandler);
        }

        // Закрытие выпадающего списка уведомлений при клике вне его
        document.removeEventListener('click', handleOutsideNotificationClick); // Удаляем предыдущий
        document.addEventListener('click', handleOutsideNotificationClick);
        // NEW_FUNCTION_END

        console.log("[Procvičování SETUP v3] Event listeners set up.");
    }
    // --- Конец Настройки Event Listeners ---

    // NEW_FUNCTION_START
    function handleOutsideNotificationClick(event) {
        if (ui.notificationsDropdown?.classList.contains('active') &&
            !ui.notificationsDropdown.contains(event.target) &&
            !ui.notificationBell?.contains(event.target)) {
            ui.notificationsDropdown.classList.remove('active');
        }
    }
    // NEW_FUNCTION_END


    // --- Инициализация Supabase ---
    function initializeSupabase() { try { if (!window.supabase?.createClient) throw new Error("Supabase library not loaded."); if (window.supabaseClient) { supabase = window.supabaseClient; console.log('[Supabase] Using existing global client instance.'); } else if (supabase === null) { supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); if (!supabase) throw new Error("Supabase client creation failed."); window.supabaseClient = supabase; console.log('[Supabase] Client initialized by main.js and stored globally.'); } else { console.log('[Supabase] Using existing local client instance.'); } return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }

    // --- Инициализация Приложения ---
    async function createDefaultProfile(userId, email) {
        console.log(`[Default Profile] Creating default profile for new user ${userId}...`);
        const defaultProfileData = { id: userId, username: email.split('@')[0], email: email, updated_at: new Date().toISOString(), learning_goal: null, preferences: {}, points: 0, level: 1, completed_exercises: 0, streak_days: 0, selected_title: null, avatar_url: null, first_name: null, last_name: null, };
        try {
            const { data, error } = await supabase.from('profiles').insert(defaultProfileData).select('*, selected_title, preferences').single();
            if (error) { if (error.code === '23505') { console.warn("[Default Profile] Profile likely already exists, attempting to fetch..."); const { data: existingProfile, error: fetchError } = await supabase.from('profiles').select('*, selected_title, preferences').eq('id', userId).single(); if (fetchError) { console.error("[Default Profile] Error fetching existing profile after unique violation:", fetchError); throw fetchError; } if (!existingProfile.preferences) existingProfile.preferences = {}; return existingProfile; } throw error; }
            if (!data.preferences) data.preferences = {};
            console.log("[Default Profile] Default profile created successfully:", data);
            return data;
        } catch (err) { console.error("[Default Profile] Error creating default profile:", err); showError("Nepodařilo se vytvořit uživatelský profil.", true); return null; }
    }

    async function initializeApp() {
        try {
            console.log("[INIT Procvičování] App Init Start v24.10.5...");
            cacheDOMElements();
            if (!initializeSupabase()) return;
            setupEventListeners();
            applyInitialSidebarState();
            updateCopyrightYear();
            initMouseFollower();
            initHeaderScrollDetection();
            updateOnlineStatus();

            if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
            if (ui.mainContent) ui.mainContent.style.display = 'none';
            if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none';
            ui.tabContents.forEach(el => el.style.display = 'none');
            hideError();

            console.log("[INIT Procvičování] Checking auth session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Session error: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;
                console.log(`[INIT Procvičování] User authenticated (ID: ${currentUser.id}). Loading profile & titles...`);
                const [profileResult, titlesResult, initialNotificationsResult] = await Promise.allSettled([ // NEW: fetch initial notifications
                    supabase.from('profiles').select('*, selected_title, preferences').eq('id', currentUser.id).single(),
                    supabase.from('title_shop').select('title_key, name'),
                    fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT) // Загружаем уведомления здесь
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

                if (titlesResult.status === 'fulfilled') {
                    allTitles = titlesResult.value?.data || [];
                    console.log("[INIT Procvičování] Titles loaded:", allTitles.length);
                } else {
                    console.warn("[INIT Procvičování] Failed to load titles:", titlesResult.reason);
                    allTitles = [];
                }
                updateSidebarProfile(currentProfile, allTitles);

                // NEW_FUNCTION_START - Рендеринг первоначальных уведомлений
                if (initialNotificationsResult.status === 'fulfilled') {
                    const { unreadCount, notifications } = initialNotificationsResult.value;
                    renderNotifications(unreadCount, notifications || []);
                } else {
                    console.warn("[INIT Procvičování] Failed to load initial notifications:", initialNotificationsResult.reason);
                    renderNotifications(0, []); // Показать пустой список в случае ошибки
                }
                // NEW_FUNCTION_END

                const goal = currentProfile.learning_goal;
                if (!goal) {
                    console.log("[INIT Procvičování] Goal not set, showing modal.");
                    showGoalSelectionModal();
                    setLoadingState('all', false);
                    if (ui.mainContent) ui.mainContent.style.display = 'block';
                    if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none';
                    ui.tabContents.forEach(el => el.style.display = 'none');
                } else {
                    console.log(`[INIT Procvičování] Goal found: ${goal}. Loading data...`);
                    if(ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none';
                    if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'block';

                    const firstTabButton = document.querySelector('.content-tab[data-tab="practice-tab"]');
                    if (firstTabButton) {
                         handleTabSwitch({ currentTarget: firstTabButton }); // Активируем вкладку через наш обработчик
                         console.log("[INIT Procvičování] 'practice-tab' activated via handleTabSwitch.");
                    } else {
                         console.warn("[INIT Procvičování] Could not find practice-tab button to force activate.");
                    }
                    configureUIForGoal(goal);
                    await loadPageData();
                }
                if (ui.mainContent && window.getComputedStyle(ui.mainContent).display === 'none') {
                    ui.mainContent.style.display = 'flex';
                    requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); });
                }
                initTooltips();
                console.log("✅ [INIT Procvičování] Page specific setup complete.");
            } else {
                console.log('[INIT Procvičování] User not logged in, redirecting...');
                window.location.href = '/auth/index.html';
            }
        } catch (error) {
            console.error("❌ [INIT Procvičování] Critical initialization error:", error);
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
    // --- Конец Инициализации ---

    // --- Запуск ---
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeApp); }
    else { initializeApp(); }

})(); // End IIFE