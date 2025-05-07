// dashboard/procvicovani/main.js
// Version: 25.0.3 - Removed Promise.resolve().then() wrapper in checkUserGoalAndDiagnostic to address syntax error.
// Added more robust checks for UI elements.

(function() { // Start IIFE
    'use strict';

    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
    const NOTIFICATION_FETCH_LIMIT = 5;
    const LEARNING_GOAL_KEY = 'userLearningGoal';
    const GOAL_DETAILS_KEY = 'userLearningGoalDetails';

    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = [];
    let userStatsData = null;
    let diagnosticResultsData = []; // Ensure this is initialized
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

    const ui = {};

    // NEW_FUNCTION_START - Кэширование DOM элементов (v6 из предыдущего шага)
    function cacheDOMElements() {
        console.log("[Procvičování Cache DOM v6] Caching elements...");
        const ids = [
            'diagnostic-prompt', 'start-test-btn-prompt', 'stats-cards', 'shortcuts-grid',
            'test-results-container', 'test-results-loading', 'test-results-content',
            'test-results-empty', 'start-test-btn-results',
            'study-plan-container', 'study-plan-loading', 'study-plan-content',
            'study-plan-empty', 'startTestBtnPlan', 'create-plan-btn-empty', // Исправлен ID startTestBtnPlan
            'main-plan-schedule',
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
            'notifications-list', 'no-notifications-msg', 'mark-all-read-btn',
            // ID для контента вкладок, которые теперь должны соответствовать HTML (с суффиксом -content)
            'practice-tab-content',
            'test-results-tab-content',
            'study-plan-tab-content',
            'topic-analysis-tab-content'
        ];

        const potentiallyMissingIds = ['toastContainer']; // Keep as is, might be dynamically added
        const criticalMissingIds = ['goal-selection-modal', 'goal-step-1']; // Critical for goal selection

        const notFound = [];
        const missingCritical = [];
        const missingPotential = [];

        ids.forEach(id => {
            const element = document.getElementById(id);
            const key = id; // Используем ID как ключ в объекте ui
            if (element) {
                ui[key] = element;
            } else {
                notFound.push(id);
                ui[key] = null;
                if (criticalMissingIds.includes(id)) {
                    missingCritical.push(id);
                } else if (potentiallyMissingIds.includes(id)) {
                    missingPotential.push(id);
                }
            }
        });

        // Query selectors for classes or more general elements
        ui.contentTabs = document.querySelectorAll('.content-tab');
        ui.tabContents = document.querySelectorAll('.tab-content'); // This will get all, including the newly ID'd ones
        ui.modalBackBtns = document.querySelectorAll('#goal-selection-modal .modal-back-btn');
        ui.modalConfirmBtns = document.querySelectorAll('#goal-selection-modal .modal-confirm-btn');
        ui.goalOptionCards = document.querySelectorAll('#goal-step-1 .goal-option-card');
        ui.dashboardHeader = document.querySelector('.dashboard-header'); // Keep querySelector for class

        if (missingCritical.length > 0) { console.error("[CACHE DOM v6] CRITICAL elements missing after search:", missingCritical); }
        if (missingPotential.length > 0) { console.warn(`[CACHE DOM v6] Potential elements missing: (${missingPotential.length})`, missingPotential); }

        if (notFound.length === 0) { console.log("[CACHE DOM v6] All primary elements cached successfully."); }
        else if (notFound.length > 0 && missingCritical.length === 0) { console.log(`[CACHE DOM v6] Some non-critical elements not found: (${notFound.length})`, notFound); }
        else { console.log(`[CACHE DOM v6] Caching complete with ${notFound.length} missing elements, including ${missingCritical.length} critical.`); }
    }
    // NEW_FUNCTION_END

    const topicIcons = { "Algebra": "fa-calculator", "Geometrie": "fa-draw-polygon", "Funkce": "fa-chart-line", "Rovnice": "fa-equals", "Statistika": "fa-chart-bar", "Kombinatorika": "fa-dice-d6", "Posloupnosti": "fa-ellipsis-h", default: "fa-atom" };
    const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) { let container = ui.toastContainer || document.getElementById('toastContainer'); if (!container) { try { console.warn("Toast container not found, attempting to create dynamically."); container = document.createElement('div'); container.id = 'toastContainer'; container.className = 'toast-container'; document.body.appendChild(container); ui.toastContainer = container; } catch (createError) { console.error("Failed to create toast container dynamically:", createError); alert(`${title}: ${message}`); return; } } try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); container.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Error showing toast (after potential container creation):", e); } }
    function showError(message, isGlobal = false) { console.error("Error occurred:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Obnovit</button></div>`; ui.globalError.style.display = 'block'; } else { showToast('CHYBA', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatDate(dateString) { try { return dateString ? new Date(dateString).toLocaleDateString('cs-CZ') : '-'; } catch (e) { return '-'; } }
    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return '--:--'; const m = Math.floor(seconds / 60); const ss = Math.round(seconds % 60); return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`; }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
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

    function setLoadingState(sectionKey, isLoadingFlag) {
        if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;
        const updateSingleSection = (key, loading) => {
            if (isLoading[key] === loading && key !== 'all') return;
            isLoading[key] = loading;
            console.log(`[Procvičování UI Loading v4] Section: ${key}, isLoading: ${loading}`);
            const sectionMap = {
                stats: { container: ui.statsCards, skeletonFn: renderStatsSkeletons },
                tests: { container: ui['test-results-container'], content: ui['test-results-content'], empty: ui['test-results-empty'], loader: ui['test-results-loading'], skeletonFn: renderTestSkeletons },
                plan: { container: ui['study-plan-container'], content: ui['study-plan-content'], empty: ui['study-plan-empty'], loader: ui['study-plan-loading'], skeletonFn: renderPlanSkeletons },
                topics: { container: ui['topic-analysis-container'], content: ui['topic-analysis-content'], empty: ui['topic-analysis-empty'], loader: ui['topic-analysis-loading'], skeletonFn: renderTopicSkeletons },
                shortcuts: { container: ui.shortcutsGrid, skeletonFn: renderShortcutSkeletons },
                notifications: { }, // No specific loader/content, handled by notification functions
                goalSelection: { } // Modal, handled separately
            };
            const config = sectionMap[key];
            if (!config) {
                if (key !== 'all' && key !== 'notifications' && key !== 'goalSelection') {
                    console.warn(`[Procvičování UI Loading v4] Unknown section key '${key}'.`);
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
                // Clear skeletons and show content/empty state
                const skeletonSelector = '.loading-skeleton, .dashboard-card.loading > .loading-skeleton, .card.loading > .loading-skeleton';
                const clearSkeletons = (el) => {
                    el?.querySelectorAll(skeletonSelector).forEach(skel => skel.parentElement?.classList.remove('loading'));
                    el?.querySelectorAll(skeletonSelector).forEach(skel => skel.remove());
                };

                if (content) clearSkeletons(content);
                if (container && (key === 'stats' || key === 'shortcuts')) clearSkeletons(container);

                // Show content or empty state after a tiny delay to ensure DOM updates
                setTimeout(() => {
                    if (key === 'stats' && ui.statsCards) {
                        if (ui.statsCards.querySelectorAll('.dashboard-card:not(.loading-skeleton)').length > 0) {
                            ui.statsCards.style.display = 'grid';
                        } else if (!isLoading.stats) {
                            // ui.statsCards.innerHTML = '<p>Statistiky nejsou k dispozici.</p>'; // Or some empty state for stats
                            // ui.statsCards.style.display = 'block';
                        }
                    } else if (content && empty) {
                        const hasActualContent = content.innerHTML.trim() !== '';
                        let displayType = 'block';
                        // Determine correct display type based on ID or class
                        if (content.id === 'topic-grid' || content.id === 'stats-cards' || content.id === 'shortcuts-grid' || content.id === 'main-plan-schedule' || content.classList.contains('test-stats')) {
                            displayType = 'grid';
                        }
                        content.style.display = hasActualContent ? displayType : 'none';
                        empty.style.display = hasActualContent ? 'none' : 'block';
                    } else if (content && (key === 'shortcuts')) {
                         // For shortcuts, container itself is the grid
                        if (container && container.querySelectorAll('.shortcut-card:not(.loading-skeleton)').length > 0) container.style.display = 'grid';
                        else if (container) container.innerHTML = '<p class="empty-state-text" style="grid-column: 1 / -1; text-align:center;">Žádné zkratky nejsou k dispozici.</p>'; // Full-width message
                    }
                }, 50); // Small delay for DOM to catch up
            }
        };
        if (sectionKey === 'all') { Object.keys(isLoading).forEach(key => { if (key !== 'all' && key !== 'goalSelection' && key !== 'notifications') { updateSingleSection(key, isLoadingFlag); } }); } else { updateSingleSection(sectionKey, isLoadingFlag); }
    }
    function renderStatsSkeletons(container) { if (!container) return; container.innerHTML = ''; for (let i = 0; i < 4; i++) { container.innerHTML += ` <div class="dashboard-card card loading"> <div class="loading-skeleton"> <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 1rem;"></div> <div class="skeleton" style="height: 35px; width: 40%; margin-bottom: 0.8rem;"></div> <div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 1.5rem;"></div> <div class="skeleton" style="height: 14px; width: 50%;"></div> </div> </div>`; } container.classList.add('loading'); }
    function renderTestSkeletons(container) { if (!container) return; container.innerHTML = `<div class="test-stats loading"><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton value"></div><div class="skeleton text"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton value"></div><div class="skeleton text"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton value"></div><div class="skeleton text"></div></div></div></div></div><div class="chart-container loading"><div class="skeleton" style="height: 350px; width: 100%;"></div></div><div class="last-test-result card loading"><div class="loading-skeleton"><div class="skeleton title"></div><div class="skeleton text"></div></div></div><div class="test-list loading"><div class="skeleton" style="height: 70px; width: 100%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 70px; width: 100%;"></div></div>`; }
    function renderPlanSkeletons(container) { const scheduleGrid = ui['main-plan-schedule']; if (!container || !scheduleGrid) return; scheduleGrid.innerHTML = `<div class="schedule-grid loading"><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 40%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 50%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 45%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div></div>`; }
    function renderTopicSkeletons(container) { const topicGrid = ui['topic-grid']; if (!container || !topicGrid) return; topicGrid.innerHTML = `<div class="topic-grid loading"><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div></div>`; }
    function renderShortcutSkeletons(container) { if (!container) return; container.innerHTML = ''; for(let i = 0; i < 3; i++) { container.innerHTML += `<div class="shortcut-card card loading"><div class="loading-skeleton" style="align-items: center; padding: 1.8rem;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 16px; margin-bottom: 1.2rem;"></div><div class="skeleton" style="height: 18px; width: 70%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.4rem;"></div><div class="skeleton" style="height: 14px; width: 80%;"></div></div></div>`; } container.classList.add('loading'); }

    // --- Start: Logic aneb "Mozek" stránky (nahrazeno zástupnými funkcemi) ---
    async function fetchDashboardStats(userId, profileData) { console.log("[Fetch Data Stub] fetchDashboardStats called. Returning placeholder data."); await new Promise(resolve => setTimeout(resolve, 700)); diagnosticResultsData = diagnosticResultsData || []; return { totalPoints: profileData?.points || 0, completedExercises: profileData?.completed_exercises || 0, activeStreak: profileData?.streak_days || 0, lastTestScore: diagnosticResultsData.length > 0 ? diagnosticResultsData[0].total_score : null, }; }
    async function fetchDiagnosticResults(userId, goal) { console.log("[Fetch Data Stub] fetchDiagnosticResults called. Returning empty array."); await new Promise(resolve => setTimeout(resolve, 1000)); return []; }
    async function fetchActiveStudyPlan(userId, goal) { console.log("[Fetch Data Stub] fetchActiveStudyPlan called. Returning null."); await new Promise(resolve => setTimeout(resolve, 800)); return null; }
    async function fetchPlanActivities(planId, goal) { console.log("[Fetch Data Stub] fetchPlanActivities called. Returning empty array."); await new Promise(resolve => setTimeout(resolve, 500)); return []; }
    async function fetchTopicProgress(userId, goal) { console.log("[Fetch Data Stub] fetchTopicProgress called. Returning placeholder data."); await new Promise(resolve => setTimeout(resolve, 900)); return [ { id: 'algebra', name: 'Algebra', progress: 0, last_practiced: null, strength: 'neutral' }, { id: 'geometry', name: 'Geometrie', progress: 0, last_practiced: null, strength: 'neutral' }, { id: 'functions', name: 'Funkce', progress: 0, last_practiced: null, strength: 'neutral' } ]; }
    // --- End: Logic ---

    // --- Start: Render Functions (nahrazeno zástupnými funkcemi) ---
    function renderStatsCards(stats) { console.log("[Render UI Stub] renderStatsCards called with:", stats); if (!ui.statsCards) { console.error("Stats cards container not found!"); setLoadingState('stats', false); return; } ui.statsCards.innerHTML = ` <div class="dashboard-card card"> <div class="card-header"><h3 class="card-title">Celkové Body</h3><span class="card-badge info">INFO</span></div> <div class="card-content"><div class="card-value">${stats?.totalPoints || 'N/A'}</div></div> <div class="card-footer">Statistika bodů</div> </div> <div class="dashboard-card card"> <div class="card-header"><h3 class="card-title">Dokončená Cvičení</h3></div> <div class="card-content"><div class="card-value">${stats?.completedExercises || 'N/A'}</div></div> <div class="card-footer">Přehled cvičení</div> </div> <div class="dashboard-card card"> <div class="card-header"><h3 class="card-title">Série Dní</h3></div> <div class="card-content"><div class="card-value">${stats?.activeStreak || 'N/A'}</div></div> <div class="card-footer">Aktuální série</div> </div> <div class="dashboard-card card"> <div class="card-header"><h3 class="card-title">Poslední Test</h3></div> <div class="card-content"><div class="card-value">${stats?.lastTestScore !== null && stats?.lastTestScore !== undefined ? stats.lastTestScore + '%' : 'N/A'}</div></div> <div class="card-footer">Výsledek testu</div> </div> `; ui.statsCards.classList.remove('loading'); setLoadingState('stats', false); }
    function calculateAverageScore(results) { console.warn("calculateAverageScore not implemented"); return 0; }
    function renderTestChart(chartData) { console.warn("renderTestChart not implemented"); }
    function renderTestResults(results, goal) { console.log("[Render UI Stub] renderTestResults called. Displaying empty state."); if(ui['test-results-container']) ui['test-results-container'].classList.remove('loading'); if(ui['test-results-content']) { ui['test-results-content'].innerHTML = ''; ui['test-results-content'].style.display = 'none'; } if(ui['test-results-empty']) ui['test-results-empty'].style.display = 'block'; setLoadingState('tests', false); }
    function renderStudyPlanOverview(plan, activities, goal) { console.log("[Render UI Stub] renderStudyPlanOverview called. Displaying empty state."); if(ui['study-plan-container']) ui['study-plan-container'].classList.remove('loading'); if(ui['study-plan-content']) { ui['study-plan-content'].innerHTML = ''; ui['study-plan-content'].style.display = 'none'; } if(ui['study-plan-empty']) ui['study-plan-empty'].style.display = 'block'; setLoadingState('plan', false); }
    function renderTopicAnalysis(topics, goal) { console.log("[Render UI Stub] renderTopicAnalysis called. Displaying empty state."); if(ui['topic-analysis-container']) ui['topic-analysis-container'].classList.remove('loading'); if(ui['topic-analysis-content']) { ui['topic-analysis-content'].innerHTML = ''; ui['topic-analysis-content'].style.display = 'none'; } if(ui['topic-analysis-empty']) ui['topic-analysis-empty'].style.display = 'block'; setLoadingState('topics', false); }
    // --- End: Render Functions ---

    // --- NEW_FUNCTION_START - Логика выбора цели обучения (v5) ---
    function showGoalSelectionModal() {
        if (!ui.goalSelectionModal || !ui.goalStep1) {
            console.error("[GoalModal v5] Critical: Modal (#goal-selection-modal) or Step 1 element (#goal-step-1) NOT FOUND in UI cache!");
            // Attempt to re-cache if critical elements are missing, then try again ONCE.
            cacheDOMElements(); // Re-run caching
            if (!ui.goalSelectionModal || !ui.goalStep1) { // Check again
                showError("Chyba zobrazení výběru cíle. Elementy nenalezeny.", true);
                return;
            }
            console.log("[GoalModal v5] Re-queried modal elements after initial miss.");
        }

        console.log("[GoalModal v5] Showing goal selection modal.");
        // Reset all steps and inputs
        ui.goalSelectionModal.querySelectorAll('.modal-step').forEach(step => {
            step.classList.remove('active');
            step.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => input.checked = false);
        });
        ui.goalStep1.classList.add('active'); // Show first step
        ui.goalSelectionModal.style.display = 'flex';
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => ui.goalSelectionModal.classList.add('active')); // For animation

        // Ensure goalOptionCards are cached and listeners are attached
        if (!ui.goalOptionCards || ui.goalOptionCards.length === 0) {
            ui.goalOptionCards = document.querySelectorAll('#goal-step-1 .goal-option-card'); // Re-cache if needed
        }
        if (!ui.goalOptionCards || ui.goalOptionCards.length === 0) {
            console.error("[GoalModal v5] No goal option cards found in #goal-step-1 after re-cache!");
            return;
        }

        ui.goalOptionCards.forEach(button => {
            const goal = button.dataset.goal;
            if (!goal) { console.warn("[GoalModal v5] Goal option button missing data-goal attribute:", button); return; }
            // Remove old listener before adding new one to prevent duplicates
            const oldHandler = button._goalHandler;
            if (oldHandler) button.removeEventListener('click', oldHandler);
            const newHandler = () => handleInitialGoalSelection(goal);
            button.addEventListener('click', newHandler);
            button._goalHandler = newHandler; // Store handler for potential removal
        });
        console.log("[GoalModal v5] Listeners attached/re-attached to goal option cards.");
    }

    function hideGoalSelectionModal() { if (!ui.goalSelectionModal) return; ui.goalSelectionModal.classList.remove('active'); document.body.classList.remove('modal-open'); setTimeout(() => { if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; }, 300); }
    function handleInitialGoalSelection(selectedGoal) { if (goalSelectionInProgress) return; console.log(`[GoalModal v5] Initial goal selected: ${selectedGoal}`); pendingGoal = selectedGoal; if (selectedGoal === 'exam_prep' || selectedGoal === 'math_explore') { saveGoalAndProceed(selectedGoal); } else { showStep2(selectedGoal); } }
    function showStep2(goalType) { const step2Id = `goal-step-${goalType.replace('math_', '')}`; const step2Element = document.getElementById(step2Id); if (!ui.goalSelectionModal || !ui.goalStep1 || !step2Element) { console.error(`[GoalModal v5] Cannot show step 2: Critical element missing. Step ID: ${step2Id}, Found: ${!!step2Element}`); showError("Chyba: Nelze zobrazit další krok výběru cíle.", true); return; } console.log(`[GoalModal v5] Showing step 2: #${step2Id}`); ui.goalSelectionModal.querySelectorAll('.modal-step').forEach(step => step.classList.remove('active')); step2Element.classList.add('active'); const backBtn = step2Element.querySelector('.modal-back-btn'); if (backBtn) { const oldHandler = backBtn._backHandler; if (oldHandler) backBtn.removeEventListener('click', oldHandler); const newHandler = () => handleBackToStep1(ui.goalStep1, step2Element); backBtn.addEventListener('click', newHandler); backBtn._backHandler = newHandler; } else { console.warn(`[GoalModal v5] Back button not found in step: #${step2Id}`); } const confirmBtn = step2Element.querySelector('.modal-confirm-btn'); if (confirmBtn) { const oldHandler = confirmBtn._confirmHandler; if (oldHandler) confirmBtn.removeEventListener('click', oldHandler); const newHandler = () => handleStep2Confirm(goalType); confirmBtn.addEventListener('click', newHandler); confirmBtn._confirmHandler = newHandler; confirmBtn.disabled = false; confirmBtn.innerHTML = 'Potvrdit a pokračovat'; } else { console.error(`[GoalModal v5] Confirm button not found in step: #${step2Id}`); } }
    function handleBackToStep1(step1Element, currentStep2Element) { console.log("[GoalModal v5] Going back to step 1..."); if(currentStep2Element) currentStep2Element.classList.remove('active'); if(step1Element) step1Element.classList.add('active'); pendingGoal = null; }
    function handleStep2Confirm(goalType) { if (goalSelectionInProgress) return; const step2Id = `goal-step-${goalType.replace('math_', '')}`; const step2Element = document.getElementById(step2Id); if (!step2Element) { console.error(`[GoalModal v5] Step 2 element ${step2Id} not found during confirm.`); return; } const details = {}; let isValid = true; try { if (goalType === 'math_accelerate') { details.accelerate_areas = Array.from(step2Element.querySelectorAll('input[name="accelerate_area"]:checked')).map(cb => cb.value); const reasonRadio = step2Element.querySelector('input[name="accelerate_reason"]:checked'); details.accelerate_reason = reasonRadio ? reasonRadio.value : null; if(details.accelerate_areas.length === 0) { showToast("Chyba", "Vyberte prosím alespoň jednu oblast zájmu.", "warning"); isValid = false; } if(!details.accelerate_reason) { showToast("Chyba", "Vyberte prosím důvod.", "warning"); isValid = false; } } else if (goalType === 'math_review') { details.review_areas = Array.from(step2Element.querySelectorAll('input[name="review_area"]:checked')).map(cb => cb.value); } } catch (e) { console.error("[GoalModal v5] Error getting step 2 details:", e); isValid = false; showToast("Chyba", "Nastala chyba při zpracování výběru.", "error"); } if (isValid) { console.log(`[GoalModal v5] Step 2 details collected for ${goalType}:`, details); saveGoalAndProceed(pendingGoal, details); } }
    async function saveGoalAndProceed(goal, details = null) { if (goalSelectionInProgress || !goal) return; goalSelectionInProgress = true; setLoadingState('goalSelection', true); console.log(`[GoalModal Save v5] Saving goal: ${goal}, with details:`, details); const activeStep = ui.goalSelectionModal?.querySelector('.modal-step.active'); const confirmButton = activeStep?.querySelector('.modal-confirm-btn'); const backButton = activeStep?.querySelector('.modal-back-btn'); if (confirmButton) { confirmButton.disabled = true; confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...'; } if (backButton) backButton.disabled = true; try { if (!supabase || !currentUser || !currentProfile) throw new Error("Supabase client, user, or profile not available for saving goal."); localStorage.setItem(LEARNING_GOAL_KEY, goal); if (details && Object.keys(details).length > 0) { localStorage.setItem(GOAL_DETAILS_KEY, JSON.stringify(details)); } else { localStorage.removeItem(GOAL_DETAILS_KEY); } const existingPreferences = currentProfile.preferences || {}; let finalPreferences = { ...existingPreferences }; if (details && Object.keys(details).length > 0) { finalPreferences.goal_details = details; } else { delete finalPreferences.goal_details; } const updatePayload = { learning_goal: goal, preferences: finalPreferences, updated_at: new Date().toISOString() }; console.log("[GoalModal Save v5] Payload to update Supabase profile:", updatePayload); const { data: updatedProfileData, error } = await supabase.from('profiles').update(updatePayload).eq('id', currentUser.id).select('*, selected_title, preferences').single(); if (error) throw error; currentProfile = updatedProfileData; if (!currentProfile.preferences) currentProfile.preferences = {}; console.log("[GoalModal Save v5] Goal and preferences saved successfully in Supabase:", currentProfile.learning_goal, currentProfile.preferences); let goalText = goal; switch(goal) { case 'exam_prep': goalText = 'Příprava na zkoušky'; break; case 'math_accelerate': goalText = 'Učení napřed'; break; case 'math_review': goalText = 'Doplnění mezer'; break; case 'math_explore': goalText = 'Volné prozkoumávání'; break; } showToast('Cíl uložen!', `Váš cíl byl nastaven na: ${goalText}.`, 'success'); hideGoalSelectionModal(); if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'flex'; if(ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none'; configureUIForGoal(); await loadPageData(); if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled'); } catch (error) { console.error("[GoalModal Save v5] Error saving goal/preferences:", error); showToast('Chyba', 'Nepodařilo se uložit váš cíl.', 'error'); if (confirmButton) { confirmButton.disabled = false; confirmButton.innerHTML = 'Potvrdit a pokračovat'; } if (backButton) backButton.disabled = false; } finally { goalSelectionInProgress = false; setLoadingState('goalSelection', false); pendingGoal = null; } }
    // --- NEW_FUNCTION_END ---

    // --- NEW_FUNCTION_START - Конфигурация UI на основе цели (v5) ---
    function renderShortcutsForGoal(goal, container) { if (!container) { console.warn("Shortcut container not found"); return; } setLoadingState('shortcuts', true); container.innerHTML = ''; // Clear previous shortcuts console.log(`[Shortcuts] Rendering shortcuts for goal: ${goal}`); let shortcutsHTML = ''; const shortcuts = { test: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-graduation-cap"></i></div><h3 class="shortcut-title">Diagnostický Test</h3><p class="shortcut-desc">Ověřte své znalosti pro přijímačky.</p><a href="/dashboard/procvicovani/test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Test</a></div>`, plan: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-tasks"></i></div><h3 class="shortcut-title">Studijní Plán</h3><p class="shortcut-desc">Zobrazte si svůj personalizovaný plán.</p><a href="/dashboard/procvicovani/plan.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Zobrazit Plán</a></div>`, tutor: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-book-open"></i></div><h3 class="shortcut-title">AI Tutor (Lekce)</h3><p class="shortcut-desc">Nechte si vysvětlit témata z plánu nebo osnovy.</p><a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a></div>`, nextTopic: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-forward"></i></div><h3 class="shortcut-title">Další Téma Osnovy</h3><p class="shortcut-desc">Pokračujte v učení podle standardní osnovy.</p><a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Učit se Další</a></div>`, curriculum: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-stream"></i></div><h3 class="shortcut-title">Přehled Osnovy</h3><p class="shortcut-desc">Zobrazte si přehled témat dle školní osnovy.</p><a href="/dashboard/procvicovani/plan.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Osnovu</a></div>`, // Assuming plan.html can show curriculum overview weakness: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-search"></i></div><h3 class="shortcut-title">Moje Slabiny</h3><p class="shortcut-desc">Zobrazte témata, kde potřebujete nejvíce zlepšení.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="switchActiveTab('topic-analysis-tab'); return false;">Analýza Témat</a></div>`, review: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-history"></i></div><h3 class="shortcut-title">Opakování</h3><p class="shortcut-desc">Procvičte si témata, která jste dlouho neprobírali.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="showToast('Info','Funkce opakování zatím není implementována.','info'); return false;">Spustit Opakování</a></div>`, explore: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-compass"></i></div><h3 class="shortcut-title">Procházet Témata</h3><p class="shortcut-desc">Vyberte si libovolné matematické téma k učení.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="switchActiveTab('topic-analysis-tab'); return false;">Vybrat Téma</a></div>`, random: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-dumbbell"></i></div><h3 class="shortcut-title">Náhodné Cvičení</h3><p class="shortcut-desc">Spusťte náhodné cvičení pro rychlé procvičení.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="showToast('Info','Funkce náhodného cvičení zatím není implementována.','info'); return false;">Náhodné Cvičení</a></div>`, progress: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-chart-line"></i></div><h3 class="shortcut-title">Můj Pokrok</h3><p class="shortcut-desc">Sledujte své zlepšení v matematice.</p><a href="/dashboard/pokrok.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Pokrok</a></div>` }; switch (goal) { case 'exam_prep': shortcutsHTML = shortcuts.test + shortcuts.plan + shortcuts.tutor; break; case 'math_accelerate': shortcutsHTML = shortcuts.nextTopic + shortcuts.curriculum + shortcuts.tutor; break; case 'math_review': shortcutsHTML = shortcuts.weakness + shortcuts.review + shortcuts.tutor; break; case 'math_explore': shortcutsHTML = shortcuts.explore + shortcuts.random + shortcuts.tutor; break; default: shortcutsHTML = shortcuts.progress + shortcuts.tutor + shortcuts.random; } requestAnimationFrame(() => { if(container) { container.innerHTML = shortcutsHTML; container.classList.remove('loading'); setLoadingState('shortcuts', false); if (typeof initScrollAnimations === 'function') { initScrollAnimations(); } } }); }
    function configureUIForGoal() {
        if (!currentProfile || !currentProfile.learning_goal) {
            console.error("[UI Config v6] Profile or learning goal not loaded. Cannot configure UI.");
            if (ui.goalSelectionModal && getComputedStyle(ui.goalSelectionModal).display === 'none') {
                showGoalSelectionModal();
            }
            return;
        }
        const goal = currentProfile.learning_goal;
        console.log(`[UI Config v6] Configuring UI for goal: ${goal}`);

        if (!ui || Object.keys(ui).length === 0) {
            console.error("[UI Config v6] UI cache empty, cannot configure.");
            return;
        }

        // Configure dashboard title
        const dashboardTitleEl = ui.dashboardTitle; // Используем кэшированный элемент
        if (dashboardTitleEl) {
            let titleText = "Procvičování // ";
            let iconClass = "fas fa-laptop-code"; // Default icon
            switch(goal) {
                case 'exam_prep': titleText += "Příprava na Zkoušky"; iconClass = "fas fa-graduation-cap"; break;
                case 'math_accelerate': titleText += "Učení Napřed"; iconClass = "fas fa-rocket"; break;
                case 'math_review': titleText += "Doplnění Mezer"; iconClass = "fas fa-sync-alt"; break;
                case 'math_explore': titleText += "Volné Prozkoumávání"; iconClass = "fas fa-compass"; break;
                default: titleText += "Přehled";
            }
            dashboardTitleEl.innerHTML = `<i class="${iconClass}"></i> ${sanitizeHTML(titleText)}`;
        } else { console.warn("[UI Config v6] Dashboard title element (ui.dashboardTitle) not found."); }

        // Configure shortcuts
        if (ui.shortcutsGrid) { // Используем кэшированный элемент
            renderShortcutsForGoal(goal, ui.shortcutsGrid);
        } else { console.warn("[UI Config v6] Shortcuts grid (ui.shortcutsGrid) not found."); }

        // Configure tabs visibility
        const tabButtonsConfig = {
            'test-results-tab': (goal === 'exam_prep'),
            'study-plan-tab': (goal === 'exam_prep' || goal === 'math_review' || goal === 'math_accelerate'),
            'topic-analysis-tab': true, // Always visible
            'practice-tab': true        // Always visible (overview)
        };

        ui.contentTabs?.forEach(tabButton => {
            const tabId = tabButton.dataset.tab;
            const shouldDisplay = tabButtonsConfig[tabId];
            if (shouldDisplay !== undefined) {
                tabButton.style.display = shouldDisplay ? 'flex' : 'none';
            }
        });

        // Determine active tab (ensure it's visible)
        let activeTabId = localStorage.getItem('lastActiveProcvicovaniTab') || 'practice-tab';
        let activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`);

        if (!activeTabButton || activeTabButton.style.display === 'none') {
            console.log(`[UI Config v6] Previous active tab '${activeTabId}' is now hidden or invalid, switching to 'practice-tab'.`);
            activeTabId = 'practice-tab'; // Default to a visible tab
            activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`);
        }

        if (activeTabButton) {
            console.log(`[UI Config v6] Setting active tab to: ${activeTabId}`);
            isInitialTabLoad = true; // Treat this as an initial load for the new goal
            switchActiveTab(activeTabId);
        } else {
            console.error("[UI Config v6] Could not find a suitable active tab to switch to.");
        }
        console.log(`[UI Config v6] UI configured for goal: ${goal}`);
    }
    // --- NEW_FUNCTION_END ---

    // --- NEW_FUNCTION_START - Логика переключения вкладок (v5) ---
    async function loadTabData(tabId) { // Renamed from _loadTabData and made global
        if (!currentProfile || !currentProfile.learning_goal) {
            console.warn(`[Load Tab Data v6] Cannot load data for tab '${tabId}', missing profile or goal.`);
            const contentElement = ui[`${tabId}-content`]; // Use new ID pattern from cache
            if (contentElement) {
                contentElement.innerHTML = `<div class="empty-state"><i class="fas fa-info-circle"></i><h3>Vyberte cíl</h3><p>Pro zobrazení obsahu této záložky si nejprve vyberte svůj studijní cíl.</p><button class="btn btn-primary" onclick="PlanApp.showGoalSelectionModal()">Vybrat cíl</button></div>`;
                contentElement.style.display = 'block';
            } else {
                console.error(`[Load Tab Data v6] Content element for '${tabId}-content' not found in ui cache for no-goal message.`);
            }
            return;
        }
        const goal = currentProfile.learning_goal;
        console.log(`[Load Tab Data v6] Loading data for tab: ${tabId} with goal: ${goal}`);

        const sectionKey = tabIdToSectionKey(tabId);
        setLoadingState(sectionKey, true);

        try {
            // Hide all tab contents, then show the active one
            if(ui.tabContents) {
                 ui.tabContents.forEach(tc => {
                     if(tc) { // Check if element exists in cache
                         tc.style.display = 'none';
                         tc.classList.remove('active');
                     }
                 });
            }


            const targetContentElement = ui[`${tabId}-content`]; // Correctly access cached element for content

            if (!targetContentElement) {
                console.error(`[Load Tab Data v6] Content element with ID '${tabId}-content' not found in ui cache.`);
                setLoadingState(sectionKey, false);
                return;
            }
            targetContentElement.innerHTML = ''; // Clear before loading skeletons/data
            targetContentElement.classList.add('active');
            targetContentElement.style.display = 'block'; // Make it visible

            // Render skeletons specific to the tab
            // Note: stats and shortcuts are part of 'practice-tab-content'
            if (tabId === 'practice-tab') {
                if (ui.statsCards) renderStatsSkeletons(ui.statsCards);
                if (ui.shortcutsGrid) renderShortcutSkeletons(ui.shortcutsGrid);
            } else if (tabId === 'test-results-tab' && ui['test-results-content']) {
                renderTestSkeletons(ui['test-results-content']);
            } else if (tabId === 'study-plan-tab' && ui['study-plan-content']) {
                renderPlanSkeletons(ui['study-plan-content']);
            } else if (tabId === 'topic-analysis-tab' && ui['topic-analysis-content']) {
                renderTopicSkeletons(ui['topic-analysis-content']);
            }


            switch (tabId) {
                case 'practice-tab':
                    userStatsData = await fetchDashboardStats(currentUser.id, currentProfile);
                    renderStatsCards(userStatsData);
                    if (ui.shortcutsGrid) renderShortcutsForGoal(goal, ui.shortcutsGrid);
                    if(ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = (goal === 'exam_prep' && (!diagnosticResultsData || diagnosticResultsData.length === 0)) ? 'flex' : 'none';
                    break;
                case 'test-results-tab':
                    if (goal === 'exam_prep') {
                        diagnosticResultsData = await fetchDiagnosticResults(currentUser.id, goal);
                        renderTestResults(diagnosticResultsData, goal);
                    } else {
                        renderTestResults([], goal); // Show empty/irrelevant state
                    }
                    break;
                case 'study-plan-tab':
                    if (goal === 'exam_prep' || goal === 'math_review' || goal === 'math_accelerate') {
                        studyPlanData = await fetchActiveStudyPlan(currentUser.id, goal);
                        planActivitiesData = studyPlanData ? await fetchPlanActivities(studyPlanData.id, goal) : [];
                        renderStudyPlanOverview(studyPlanData, planActivitiesData, goal);
                    } else {
                        renderStudyPlanOverview(null, [], goal); // Show empty/irrelevant state
                    }
                    break;
                case 'topic-analysis-tab':
                    topicProgressData = await fetchTopicProgress(currentUser.id, goal);
                    renderTopicAnalysis(topicProgressData, goal);
                    break;
                default:
                    console.warn(`[Load Tab Data v6] No specific data loading logic for tab: ${tabId}`);
                    if (targetContentElement) {
                         targetContentElement.innerHTML = `<div class="empty-state"><i class="fas fa-question-circle"></i><h3>Obsah nedostupný</h3><p>Pro tuto záložku zatím není definován obsah.</p></div>`;
                    }
            }

        } catch (error) {
            console.error(`[Load Tab Data v6] Error loading data for tab ${tabId}:`, error);
            showError(`Nepodařilo se načíst data pro záložku: ${error.message}`);
            const contentEl = ui[`${tabId}-content`];
            if (contentEl) {
                contentEl.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Chyba načítání</h3><p>${error.message}</p></div>`;
                contentEl.style.display = 'block';
            }
        } finally {
            setLoadingState(sectionKey, false);
        }
    }

    function tabIdToSectionKey(tabId) {
        // Map tabId (e.g., 'practice-tab') to sectionKey for isLoading (e.g., 'stats')
        switch (tabId) {
            case 'practice-tab': return 'stats'; // 'stats' also covers 'shortcuts' for loading purposes
            case 'test-results-tab': return 'tests';
            case 'study-plan-tab': return 'plan';
            case 'topic-analysis-tab': return 'topics';
            default: return 'all'; // Fallback, should ideally not happen
        }
    }
    // --- NEW_FUNCTION_END ---

    // --- Load Page Data ---
    async function loadPageData() {
        if (!currentProfile || !currentProfile.learning_goal) {
            console.error("[Load Page Data v5] Profile or learning goal not loaded. Cannot load page data.");
            if (ui.goalSelectionModal && getComputedStyle(ui.goalSelectionModal).display === 'none') {
                showGoalSelectionModal(); // Show modal if goal not set
                if(ui.mainContent) ui.mainContent.classList.add('interaction-disabled'); // Disable main content interaction
                if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'none'; // Hide tabs
                if(ui.tabContents) ui.tabContents.forEach(el => el.style.display = 'none'); // Hide tab contents
            }
            setLoadingState('all', false); // Ensure all loaders are off
            return;
        }
        // If goal is set, ensure modal is hidden and UI is interactive
        if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none';
        if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled');
        if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'flex'; // Show tabs

        console.log(`🔄 [Load Page Data v5] Loading data for goal: ${currentProfile.learning_goal}...`);
        setLoadingState('all', true); // Start global loading state
        hideError();

        const activeTabButton = document.querySelector('.content-tab.active');
        let activeTabId = 'practice-tab'; // Default tab
        if (activeTabButton) {
            activeTabId = activeTabButton.dataset.tab;
        } else {
            // If no tab is active (e.g., on first load after goal selection), activate 'practice-tab'
            const practiceTabElem = document.querySelector('.content-tab[data-tab="practice-tab"]');
            if (practiceTabElem) {
                ui.contentTabs?.forEach(tab => tab.classList.remove('active'));
                practiceTabElem.classList.add('active');
                // Ensure corresponding content is shown
                 ui.tabContents?.forEach(content => {
                     content.classList.toggle('active', content.id === `${activeTabId}-content`); // Match updated ID
                     content.style.display = content.id === `${activeTabId}-content` ? 'block' : 'none';
                 });
            }
        }
        // Always load data for the determined active tab
        await loadTabData(activeTabId);
        console.log("✅ [Load Page Data v5] Relevant data for active tab loaded.");
        setLoadingState('all', false); // End global loading state
        initTooltips(); // Re-initialize tooltips after dynamic content load
    }

    // --- Tab Switching Logic (v5) ---
    let isInitialTabLoad = true; // Flag to prevent double loading on initial page load

    function handleTabSwitch(eventOrTabId) {
        let tabId;
        let targetTabButton;

        if (typeof eventOrTabId === 'string') {
            tabId = eventOrTabId;
            targetTabButton = document.querySelector(`.content-tab[data-tab="${tabId}"]`);
            if (!targetTabButton) {
                console.warn(`[Tabs v5] Programmatic switch: Tab button for '${tabId}' not found.`);
                return;
            }
        } else if (eventOrTabId && eventOrTabId.currentTarget) {
            targetTabButton = eventOrTabId.currentTarget;
            tabId = targetTabButton.dataset.tab;
            if (!tabId) {
                console.warn("[Tabs v5] Clicked element has no data-tab attribute.");
                return;
            }
        } else {
            console.warn("[Tabs v5] Invalid argument for handleTabSwitch:", eventOrTabId);
            return;
        }

        // Prevent re-loading if the tab is already active, unless it's the initial load
        if (targetTabButton.classList.contains('active') && !isInitialTabLoad) {
            console.log(`[Tabs v5] Tab ${tabId} is already active. Switch ignored.`);
            return;
        }

        console.log(`[Tabs v5] Switching to tab: ${tabId}`);

        // Update active class on tab buttons
        ui.contentTabs?.forEach(tab => tab.classList.remove('active'));
        targetTabButton.classList.add('active');

        // Show/hide tab content elements
        ui.tabContents?.forEach(content => {
            const contentId = content.id; // HTML ID of the content div
            const isActive = contentId === `${tabId}-content`; // Compare with "tabId-content"
            content.classList.toggle('active', isActive);
            content.style.display = isActive ? 'block' : 'none';
        });

        localStorage.setItem('lastActiveProcvicovaniTab', tabId);

        // Load data for the new tab only if it's not the initial load
        if (!isInitialTabLoad) {
            loadTabData(tabId);
        }
        isInitialTabLoad = false; // Reset flag after first successful switch/load
    }

    function switchActiveTab(tabId) { // Helper for programmatic switching
        const tabButton = document.querySelector(`.content-tab[data-tab="${tabId}"]`);
        if (tabButton) {
            handleTabSwitch({ currentTarget: tabButton });
        } else {
            console.warn(`[SwitchActiveTab v5] Tab button for '${tabId}' not found.`);
        }
    }
    // --- End Tab Switching ---

    // --- Refresh Data ---
    async function handleRefreshClick() { if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } console.log("🔄 Manual refresh triggered..."); const icon = ui.refreshDataBtn?.querySelector('i'); const text = ui.refreshDataBtn?.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = true; await loadPageData(); if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = false; }

    // --- Notifications (Stubbed) ---
    async function fetchNotifications(userId, limit) { console.log(`[Notifications Stub] fetchNotifications called for user ${userId}, limit ${limit}. Returning empty.`); setLoadingState('notifications', true); await new Promise(resolve => setTimeout(resolve, 600)); const fakeNotifications = []; renderNotifications(0, fakeNotifications); setLoadingState('notifications', false); return { unreadCount: 0, notifications: fakeNotifications }; }
    function renderNotifications(count, notifications) { console.log(`[Notifications Stub] renderNotifications called with count ${count}.`); if (!ui.notificationBell || !ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Notifications Stub] UI elements for notifications are missing. Cannot render."); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; } ui.markAllReadBtn.disabled = count === 0; }
    async function markNotificationRead(notificationId) { console.log(`[Notifications Stub] markNotificationRead called for ID ${notificationId}. Simulating success.`); await new Promise(resolve => setTimeout(resolve, 200)); return true; }
    async function markAllNotificationsRead() { console.log(`[Notifications Stub] markAllNotificationsRead called. Simulating success.`); await new Promise(resolve => setTimeout(resolve, 300)); renderNotifications(0, []); showToast('Oznámení vymazána', 'Všechna oznámení byla označena jako přečtená.', 'success'); }
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height:16px;width:70%;margin-bottom:6px;"></div><div class="skeleton" style="height:12px;width:90%;"></div><div class="skeleton" style="height:10px;width:40%;margin-top:6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    // --- End Notifications ---

    // --- Event Listener Setup (v6 - includes checks for ui elements) ---
    function setupEventListeners() {
        console.log("[Procvičování SETUP v6] Setting up event listeners...");
        const safeAddListener = (elementKey, eventType, handler, descriptiveKey) => {
            const element = ui[elementKey]; // Get element from cached ui object
            if (element) {
                // Remove old listener if it exists (using a stored property)
                if (element._eventHandlers && element._eventHandlers[eventType]) {
                    element.removeEventListener(eventType, element._eventHandlers[eventType]);
                }
                element.addEventListener(eventType, handler);
                if (!element._eventHandlers) element._eventHandlers = {};
                element._eventHandlers[eventType] = handler; // Store for potential removal
            } else {
                const nonCriticalMissing = ['markAllReadBtn', 'create-plan-btn-empty', 'startTestBtnPlan']; // Example
                if (nonCriticalMissing.includes(elementKey)) {
                    console.log(`[SETUP v6] Non-critical element not found for listener: ${descriptiveKey} (ui key: ${elementKey}).`);
                } else {
                    console.warn(`[SETUP v6] Element not found for listener: ${descriptiveKey} (ui key: ${elementKey})`);
                }
            }
        };
        const safeAddListenerToAll = (elementsNodeList, eventType, handler, key) => { if(elementsNodeList && elementsNodeList.length > 0) { elementsNodeList.forEach(el => safeAddListener(el.id || el.dataset.tab, eventType, handler, `${key}-${el.dataset?.tab || el.id || 'item'}`)); } else { console.warn(`[SETUP v6] NodeList empty for key: ${key}`); } };

        safeAddListener('refreshDataBtn', 'click', handleRefreshClick, 'refreshDataBtn');
        // For tabs, it's better to use querySelectorAll from ui cache
        if(ui.contentTabs) ui.contentTabs.forEach(tab => { if(tab) tab.addEventListener('click', handleTabSwitch); });
        else console.warn("[SETUP v6] ui.contentTabs not found in cache.");

        safeAddListener('start-test-btn-prompt', 'click', () => window.location.href = 'test1.html', 'start-test-btn-prompt');
        safeAddListener('start-test-btn-results', 'click', () => window.location.href = 'test1.html', 'start-test-btn-results');
        safeAddListener('startTestBtnPlan', 'click', () => window.location.href = 'test1.html', 'startTestBtnPlan'); // Corrected key
        safeAddListener('create-plan-btn-empty', 'click', () => switchActiveTab('study-plan-tab'), 'create-plan-btn-empty');
        safeAddListener('start-test-btn-analysis', 'click', () => window.location.href = 'test1.html', 'start-test-btn-analysis');

        safeAddListener('mainMobileMenuToggle', 'click', openMenu, 'mainMobileMenuToggle');
        safeAddListener('sidebarCloseToggle', 'click', closeMenu, 'sidebarCloseToggle');
        safeAddListener('sidebarOverlay', 'click', closeMenu, 'sidebarOverlay');
        safeAddListener('sidebarToggleBtn', 'click', toggleSidebar, 'sidebarToggleBtn');

        document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); }); // Keep direct querySelectorAll here as they are static

        safeAddListener('markAllReadBtn', 'click', markAllNotificationsRead, 'markAllReadBtn');
        safeAddListener('notificationBell', 'click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); if (ui.notificationsDropdown?.classList.contains('active') && ui.notificationsList?.innerHTML.trim() === '' && !isLoading.notifications) { fetchNotifications(currentUser?.id, NOTIFICATION_FETCH_LIMIT); } }, 'notificationBell');

        if (ui.notificationsList) {
            if (ui.notificationsList._itemClickHandler) { ui.notificationsList.removeEventListener('click', ui.notificationsList._itemClickHandler); }
            ui.notificationsList._itemClickHandler = async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; ui.notificationsDropdown?.classList.remove('active'); } };
            ui.notificationsList.addEventListener('click', ui.notificationsList._itemClickHandler);
        } else { console.warn("[SETUP v6] Notifications list (ui.notificationsList) not found."); }

        document.removeEventListener('click', handleOutsideNotificationClick); // Ensure old one is gone
        document.addEventListener('click', handleOutsideNotificationClick);

        if(ui.modalBackBtns) ui.modalBackBtns.forEach(btn => safeAddListener(btn.id || `modal-back-btn-${Math.random().toString(16).slice(2)}`, 'click', (event) => { const targetStepId = event.currentTarget.dataset.targetStep; const currentActiveStep = ui.goalSelectionModal?.querySelector('.modal-step.active'); const targetStepElement = document.getElementById(targetStepId); if(currentActiveStep) currentActiveStep.classList.remove('active'); if(targetStepElement) targetStepElement.classList.add('active'); pendingGoal = null; }, 'modalBackBtns'));
        else console.warn("[SETUP v6] ui.modalBackBtns not found in cache.");

        if(ui.modalConfirmBtns) ui.modalConfirmBtns.forEach(btn => safeAddListener(btn.id || `modal-confirm-btn-${Math.random().toString(16).slice(2)}`, 'click', (event) => { const goal = event.currentTarget.dataset.goal; if (goal === pendingGoal) { handleStep2Confirm(goal); } else { console.warn("[GoalModal v5] Confirm button clicked without matching pendingGoal. Goal from button:", goal); if (ui.goalStep1?.classList.contains('active') && goal) { handleInitialGoalSelection(goal); } } }, 'modalConfirmBtns'));
        else console.warn("[SETUP v6] ui.modalConfirmBtns not found in cache.");

        console.log("[Procvičování SETUP v6] Event listeners set up.");
    }

    function handleOutsideNotificationClick(event) { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } }

    // --- Supabase Init ---
    function initializeSupabase() { try { if (!window.supabase?.createClient) throw new Error("Supabase library not loaded."); if (window.supabaseClient) { supabase = window.supabaseClient; console.log('[Supabase] Using existing global client instance.'); } else if (supabase === null) { supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); if (!supabase) throw new Error("Supabase client creation failed."); window.supabaseClient = supabase; console.log('[Supabase] Client initialized by main.js and stored globally.'); } else { console.log('[Supabase] Using existing local client instance.'); } return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }
    // --- Default Profile ---
    async function createDefaultProfile(userId, email) { console.log(`[Default Profile] Creating default profile for new user ${userId}...`); const defaultProfileData = { id: userId, username: email.split('@')[0], email: email, updated_at: new Date().toISOString(), learning_goal: null, preferences: {}, points: 0, level: 1, completed_exercises: 0, streak_days: 0, selected_title: null, avatar_url: null, first_name: null, last_name: null, }; try { const { data, error } = await supabase.from('profiles').insert(defaultProfileData).select('*, selected_title, preferences').single(); if (error) { if (error.code === '23505') { console.warn("[Default Profile] Profile likely already exists, attempting to fetch..."); const { data: existingProfile, error: fetchError } = await supabase.from('profiles').select('*, selected_title, preferences').eq('id', userId).single(); if (fetchError) { console.error("[Default Profile] Error fetching existing profile after unique violation:", fetchError); throw fetchError; } if (!existingProfile.preferences) existingProfile.preferences = {}; return existingProfile; } throw error; } if (!data.preferences) data.preferences = {}; console.log("[Default Profile] Default profile created successfully:", data); return data; } catch (err) { console.error("[Default Profile] Error creating default profile:", err); showError("Nepodařilo se vytvořit uživatelský profil.", true); return null; } }

    // --- Main Initialization ---
    async function initializeApp() {
        try {
            console.log("[INIT Procvičování] App Init Start v25.0.3...");
            cacheDOMElements(); // Cache DOM elements first
            if (!initializeSupabase()) return; // Initialize Supabase

            applyInitialSidebarState(); // Apply sidebar visual state
            updateCopyrightYear();
            initMouseFollower();
            initHeaderScrollDetection();
            updateOnlineStatus();

            if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
            if (ui.mainContent) ui.mainContent.style.display = 'none';
            if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none';
            if (ui.tabContents) ui.tabContents.forEach(el => { if(el) el.style.display = 'none';}); // Check if el exists

            hideError();
            console.log("[INIT Procvičování] Checking auth session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Session error: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;
                console.log(`[INIT Procvičování] User authenticated (ID: ${currentUser.id}). Loading profile & titles...`);

                const [profileResult, titlesResult, initialNotificationsResult] = await Promise.allSettled([
                    supabase.from('profiles').select('*, selected_title, preferences').eq('id', currentUser.id).single(),
                    supabase.from('title_shop').select('title_key, name'), // Assuming 'title_shop' is the table name
                    fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT) // Fetch initial notifications
                ]);

                if (profileResult.status === 'fulfilled' && profileResult.value?.data) {
                    currentProfile = profileResult.value.data;
                } else {
                    // Attempt to create a default profile if loading failed or no profile found
                    currentProfile = await createDefaultProfile(currentUser.id, currentUser.email);
                }
                if (!currentProfile) throw new Error("Failed to create/load user profile.");
                if (!currentProfile.preferences) currentProfile.preferences = {}; // Ensure preferences object exists
                console.log("[INIT Procvičování] Profile loaded:", currentProfile);

                if (titlesResult.status === 'fulfilled') { allTitles = titlesResult.value?.data || []; }
                else { allTitles = []; console.warn("Failed to fetch titles:", titlesResult.reason); }

                updateSidebarProfile(currentProfile, allTitles);

                // Process notifications result
                if (initialNotificationsResult.status === 'fulfilled') {
                    const { unreadCount, notifications } = initialNotificationsResult.value;
                    renderNotifications(unreadCount, notifications || []);
                } else {
                    console.warn("Failed to fetch initial notifications:", initialNotificationsResult.reason);
                    renderNotifications(0, []); // Render empty state for notifications
                }

                setupEventListeners(); // Setup general event listeners

                // Goal selection logic
                let storedGoal = localStorage.getItem(LEARNING_GOAL_KEY);
                let storedGoalDetails = JSON.parse(localStorage.getItem(GOAL_DETAILS_KEY) || '{}');

                if (!currentProfile.learning_goal && storedGoal) {
                    console.log(`[INIT Procvičování] Found goal '${storedGoal}' in localStorage, and no goal in profile. Attempting to save to profile.`);
                    await saveGoalAndProceed(storedGoal, Object.keys(storedGoalDetails).length > 0 ? storedGoalDetails : null);
                    // saveGoalAndProceed will update currentProfile and call configureUIForGoal & loadPageData
                } else if (currentProfile.learning_goal) {
                    console.log(`[INIT Procvičování] Goal '${currentProfile.learning_goal}' already set in profile.`);
                     if(ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none';
                     if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'flex';
                     configureUIForGoal(); // Configure UI based on the existing goal
                     const lastTab = localStorage.getItem('lastActiveProcvicovaniTab') || 'practice-tab';
                     isInitialTabLoad = true; // Set flag before first tab switch
                     switchActiveTab(lastTab); // Load data for the last active or default tab
                } else {
                    // No goal in profile and no goal in localStorage - show modal
                    showGoalSelectionModal();
                    setLoadingState('all', false); // Ensure loaders are off before showing modal
                    if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show main content area (modal will overlay)
                    if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none'; // Hide tabs until goal is selected
                    if (ui.tabContents) ui.tabContents.forEach(el => {if(el) el.style.display = 'none';});
                }


                // Ensure main content is visible if not showing modal
                if (ui.mainContent && (!ui.goalSelectionModal || getComputedStyle(ui.goalSelectionModal).display === 'none')) {
                    ui.mainContent.style.display = 'flex'; // Use flex for main content layout
                    requestAnimationFrame(() => {
                        if(ui.mainContent) ui.mainContent.classList.add('loaded');
                        initScrollAnimations(); // Initialize animations if any
                    });
                }

                initTooltips(); // Initialize tooltips after all content is potentially loaded
                console.log("✅ [INIT Procvičování] Page specific setup complete.");

            } else {
                console.log('[INIT Procvičování] User not logged in, redirecting...');
                window.location.href = '/auth/index.html';
            }
        } catch (error) {
            console.error("❌ [INIT Procvičování] Critical initialization error:", error);
            showError(`Chyba inicializace: ${error.message}`, true);
            if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show main content to display global error
            setLoadingState('all', false);
        } finally {
            const il = ui.initialLoader;
            if (il && !il.classList.contains('hidden')) {
                il.classList.add('hidden');
                setTimeout(() => { if(il) il.style.display = 'none'; }, 300);
            }
        }
    }

    // Запуск приложения
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }

})(); // End IIFE