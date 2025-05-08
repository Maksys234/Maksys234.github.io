// dashboard/procvicovani/main.js
// Version: 25.0.28 - Added detailed logging in renderStatsCards, simplified setLoadingState cleanup, improved empty states.
// Opraveno: Přidáno detailní logování v renderStatsCards, zjednodušené čištění setLoadingState, vylepšené prázdné stavy.

(function() { // Start IIFE
	'use strict';

	// --- START: Constants and Configuration ---
	const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
	const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
	const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
	const NOTIFICATION_FETCH_LIMIT = 5;
	const LEARNING_GOAL_KEY = 'userLearningGoal';
	const GOAL_DETAILS_KEY = 'userLearningGoalDetails';
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
	let isInitialPageLoadComplete = false; // Flag set after the very first data load
	// --- END: State Variables ---

	// --- START: UI Elements Cache ---
	const ui = {};
	// --- END: UI Elements Cache ---

	// --- START: Helper Functions ---
	const topicIcons = { "Algebra": "fa-calculator", "Geometrie": "fa-draw-polygon", "Funkce": "fa-chart-line", "Rovnice": "fa-equals", "Statistika": "fa-chart-bar", "Kombinatorika": "fa-dice-d6", "Posloupnosti": "fa-ellipsis-h", default: "fa-atom" };
	const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

	function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
	function showToast(title, message, type = 'info', duration = 4500) { let container = ui.toastContainer || document.getElementById('toastContainer'); if (!container) { try { console.warn("[Toast] Toast container not found, creating dynamically."); container = document.createElement('div'); container.id = 'toastContainer'; container.className = 'toast-container'; document.body.appendChild(container); ui.toastContainer = container; } catch (createError) { console.error("[Toast] Failed to create toast container:", createError); alert(`${title}: ${message}`); return; } } try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); container.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("[Toast] Error showing toast:", e); } }
	function showError(message, isGlobal = false) { console.error("[Error Handler] Error:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Obnovit</button></div>`; ui.globalError.style.display = 'block'; } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
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
	// --- END: Helper Functions ---

	// --- START: Skeleton Rendering Functions ---
	function renderStatsSkeletons(container) { if (!container) { console.warn("[Skeletons] Stats container not found."); return; } console.log("[Skeletons] Rendering stats skeletons..."); container.innerHTML = ''; for (let i = 0; i < 4; i++) { container.innerHTML += ` <div class="dashboard-card card loading"> <div class="loading-skeleton"> <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 1rem;"></div> <div class="skeleton" style="height: 35px; width: 40%; margin-bottom: 0.8rem;"></div> <div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 1.5rem;"></div> <div class="skeleton" style="height: 14px; width: 50%;"></div> </div> </div>`; } container.classList.add('loading'); container.style.display = 'grid'; /* Ensure visible */ }
	function renderTestSkeletons(container) { /* ... */ }
	function renderPlanSkeletons(container) { const scheduleGrid = ui.mainPlanSchedule; if (!container || !scheduleGrid) { console.warn("[Skeletons] Study plan content or schedule grid not found."); return; } console.log("[Skeletons] Rendering plan skeletons..."); scheduleGrid.innerHTML = `<div class="schedule-grid loading"><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 40%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 50%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 45%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div></div>`; container.classList.add('loading'); container.style.display = 'block'; }
	function renderTopicSkeletons(container) { /* ... */ }
	function renderShortcutSkeletons(container) { if (!container) { console.warn("[Skeletons] Shortcuts grid container not found."); return; } console.log("[Skeletons] Rendering shortcut skeletons..."); container.innerHTML = ''; for(let i = 0; i < 3; i++) { container.innerHTML += `<div class="shortcut-card card loading"><div class="loading-skeleton" style="align-items: center; padding: 1.8rem;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 16px; margin-bottom: 1.2rem;"></div><div class="skeleton" style="height: 18px; width: 70%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.4rem;"></div><div class="skeleton" style="height: 14px; width: 80%;"></div></div></div>`; } container.classList.add('loading'); container.style.display = 'grid'; /* Ensure visible */ }
	function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) {console.warn("[Skeletons] Notifications list or no-message element not found."); return;} let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton"></div><div class="notification-content"><div class="skeleton" style="height:16px;width:70%;margin-bottom:6px;"></div><div class="skeleton" style="height:12px;width:90%;"></div><div class="skeleton" style="height:10px;width:40%;margin-top:6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
	// --- END: Skeleton Rendering Functions ---

	// --- START: Loading State Management ---
	function setLoadingState(sectionKey, isLoadingFlag) {
        console.log(`[SetLoadingState] Called for section: ${sectionKey}, isLoading: ${isLoadingFlag}`); // Log entry
        if (!isLoading || typeof isLoading[sectionKey] === 'undefined' && sectionKey !== 'all') { console.warn(`[SetLoadingState] Unknown section key '${sectionKey}' or isLoading object not initialized.`); return; }
        if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') { console.log(`[SetLoadingState] State for ${sectionKey} already ${isLoadingFlag}. Skipping.`); return; }

        const updateSingleSection = (key, loading) => {
            if (typeof isLoading[key] === 'undefined') { console.warn(`[SetLoadingState] Unknown subsection key '${key}' processing 'all'.`); return; }
            if (isLoading[key] === loading && key !== 'all') return; // Avoid redundant updates
            isLoading[key] = loading;
            console.log(`[SetLoadingState] Updating section: ${key}, isLoading: ${loading}`);

            const sectionMap = { stats: { container: ui.statsCards, skeletonFn: renderStatsSkeletons }, shortcuts: { container: ui.shortcutsGrid, skeletonFn: renderShortcutSkeletons }, plan: { container: ui.studyPlanContainer, content: ui.studyPlanContent, empty: ui.studyPlanEmpty, skeletonFn: renderPlanSkeletons }, notifications: { list: ui.notificationsList, skeletonFn: renderNotificationSkeletons }, /* Add other sections if needed */ };
            const config = sectionMap[key];
            if (!config) { if (key !== 'all' && key !== 'goalSelection') console.warn(`[SetLoadingState] No config found for section key '${key}'.`); return; }

            const container = config.container;
            const content = config.content; // For sections like 'plan'
            const list = config.list; // For sections like 'notifications'
            const skeletonFn = config.skeletonFn;

            // --- Skeleton Display Logic ---
            if (loading) {
                 console.log(`[SetLoadingState] Applying loading state for ${key}.`);
                 if (container) container.classList.add('loading');
                 if (content) content.style.display = 'none'; // Hide content area for plan
                 if (list) list.style.display = 'none'; // Hide list for notifications
                 if (skeletonFn && typeof skeletonFn === 'function') {
                    let targetContainer = container || content || list;
                    if (targetContainer) {
                        skeletonFn(targetContainer); // Render skeletons into appropriate container
                         console.log(`[SetLoadingState] Skeletons rendered for ${key}.`);
                    } else { console.warn(`[SetLoadingState] Target container for skeletons not found for key '${key}'.`); }
                }
            }
            // --- Content Display / Skeleton Removal Logic ---
            else {
                 console.log(`[SetLoadingState Cleanup] Clearing loading state for ${key}.`);
                 const skeletonSelector = '.loading-skeleton, .dashboard-card.loading > .loading-skeleton, .card.loading > .loading-skeleton, .notification-item.skeleton';
                 const clearSkeletons = (el) => {
                    if (!el) return;
                    console.log(`[SetLoadingState Cleanup] Attempting to clear skeletons and loading class for element:`, el);
                    el.querySelectorAll(skeletonSelector).forEach(skel => skel.remove());
                    el.classList.remove('loading');
                    console.log(`[SetLoadingState Cleanup] Class list after remove 'loading':`, el.classList);
                 };

                 let targetContainer = container || content || list;
                 if (targetContainer) {
                     clearSkeletons(targetContainer);
                     // If the container itself had the loading class (like statsCards), remove it too
                     if (container && container !== targetContainer) {
                        container.classList.remove('loading');
                        console.log(`[SetLoadingState Cleanup] Removed loading class from main container:`, container);
                     }
                     // Ensure the container/content is displayed after clearing
                     targetContainer.style.display = (key === 'stats' || key === 'shortcuts') ? 'grid' : 'block';
                 } else {
                     console.warn(`[SetLoadingState Cleanup] Target container not found for key '${key}'.`);
                 }
                 // Handle empty states specifically within render functions now
            }
        };

        if (sectionKey === 'all') { Object.keys(isLoading).forEach(key => { if (key !== 'all' && key !== 'goalSelection') updateSingleSection(key, isLoadingFlag); }); }
        else { updateSingleSection(sectionKey, isLoadingFlag); }
    }
	// --- END: Loading State Management ---

	// --- START: UI Update Functions ---
	function updateSidebarProfile(profile, titlesData) { if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[UI Sidebar] Sidebar profile elements missing."); return; } if (profile) { const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || currentUser?.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(profile); const avatarUrl = profile.avatar_url; let finalAvatarUrl = avatarUrl; if (avatarUrl && !avatarUrl.startsWith('http') && avatarUrl.includes('/')) { finalAvatarUrl = sanitizeHTML(avatarUrl); } else if (avatarUrl) { finalAvatarUrl = `${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`; } ui.sidebarAvatar.innerHTML = finalAvatarUrl ? `<img src="${finalAvatarUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const img = ui.sidebarAvatar.querySelector('img'); if (img) { img.onerror = function() { console.warn(`[UI Sidebar] Failed to load avatar: ${this.src}. Showing initials.`); ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; } const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot'; if (selectedTitleKey && titlesData && titlesData.length > 0) { const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) { displayTitle = foundTitle.name; } else { console.warn(`[UI Sidebar] Title key "${selectedTitleKey}" not found.`); } } else if (selectedTitleKey) { console.warn(`[UI Sidebar] Title key present but titles list is empty/not loaded.`); } ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); } else { ui.sidebarName.textContent = "Nepřihlášen"; ui.sidebarAvatar.textContent = '?'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title'); } }

	function renderStatsCards(stats) {
		console.log("[Render Stats] Starting rendering stats cards. Data received:", stats);
		if (!ui.statsCards) { console.error("[Render Stats] Error: ui.statsCards container not found!"); setLoadingState('stats', false); return; }

		// Handle empty/null data
		if (!stats || Object.keys(stats).length === 0 || (stats.totalPoints === 0 && stats.completedExercises === 0 && stats.activeStreak === 0 && stats.lastTestScore === null)) {
			console.log("[Render Stats] No stats data found, rendering empty state.");
			ui.statsCards.innerHTML = `<div class="empty-state" style="display: flex; grid-column: 1 / -1; flex-direction: column; align-items: center; padding: 2rem;"> <i class="fas fa-chart-pie empty-state-icon"></i> <h3>Žádné statistiky</h3> <p>Zatím zde nejsou žádná data ke zobrazení (nebo jsou všechna NULL/0).</p> </div>`;
			ui.statsCards.style.display = 'block'; // Make sure empty state is visible
            ui.statsCards.classList.remove('loading'); // Ensure loading class is removed
			setLoadingState('stats', false); // Explicitly turn off loading
			return;
		}

		console.log("[Render Stats] Data is valid, generating HTML...");
		const html = `
            <div class="dashboard-card card" data-animate style="--animation-order: 1;"> <div class="card-header"> <div class="card-title">Body</div> <span class="card-badge info">Celkem</span> </div> <div class="card-content"> <div class="card-value">${stats?.totalPoints || 0}</div> <p class="card-description">Nasbírané body za aktivity.</p> </div> </div>
            <div class="dashboard-card card" data-animate style="--animation-order: 2;"> <div class="card-header"> <div class="card-title">Dokončená Cvičení</div> <span class="card-badge success">${stats?.completedExercisesToday || 0} dnes</span> </div> <div class="card-content"> <div class="card-value">${stats?.completedExercises || 0}</div> <p class="card-description">Celkový počet dokončených cvičení.</p> </div> </div>
            <div class="dashboard-card card" data-animate style="--animation-order: 3;"> <div class="card-header"> <div class="card-title">Denní Série</div> <span class="card-badge warning">${stats?.streakRecord || 0} rekord</span> </div> <div class="card-content"> <div class="card-value">${stats?.activeStreak || 0} ${stats?.activeStreak === 1 ? 'den' : 'dní'}</div> <p class="card-description">Počet dní studia v řadě.</p> </div> </div>
            <div class="dashboard-card card" data-animate style="--animation-order: 4;"> <div class="card-header"> <div class="card-title">Poslední Test</div> ${stats?.lastTestDate ? `<span class="card-badge">${formatDate(stats.lastTestDate)}</span>` : '<span class="card-badge">Žádný</span>'} </div> <div class="card-content"> <div class="card-value">${stats?.lastTestScore !== null ? `${stats.lastTestScore}/50` : '--'}</div> <p class="card-description">Skóre posledního diagnostického testu.</p> </div> </div>
        `;
        // console.log("[Render Stats] Generated HTML:", html); // Optional: Log HTML if needed

        console.log("[Render Stats] Setting innerHTML for ui.statsCards:", ui.statsCards);
		ui.statsCards.innerHTML = html;
        console.log("[Render Stats] innerHTML set. Current classList:", ui.statsCards.classList);
		ui.statsCards.style.display = 'grid'; // Ensure display is correct
        console.log("[Render Stats] Display set to grid.");
		// setLoadingState('stats', false); // Called by loadTabData finally block now
		initScrollAnimations();
        console.log("[Render Stats] Rendering complete.");
	}

	function renderTestResults(results, goal) { /* ... (Keep existing logic, add empty state check if needed) ... */ }

	function renderStudyPlanOverview(plan, activities, goal) {
        console.log("[Render Plan] Starting rendering plan overview. Plan data:", plan);
        if (!ui.studyPlanContainer || !ui.studyPlanContent || !ui.studyPlanEmpty) { console.error("[Render Plan] Study plan UI elements missing!"); setLoadingState('plan', false); return; }

        ui.studyPlanContent.innerHTML = ''; // Clear previous
        ui.studyPlanContent.style.display = 'none';
        ui.studyPlanEmpty.style.display = 'none';

        if (plan) {
            console.log("[Render Plan] Plan found, rendering summary.");
            ui.studyPlanContent.innerHTML = `<div class="plan-summary card"> <h4>${plan.title || 'Aktivní plán'}</h4> <p>Stav: ${plan.status === 'active' ? 'Aktivní' : 'Neaktivní/Dokončený'}</p> <p>Pokrok: ${plan.progress || 0}%</p> <a href="plan.html" class="btn btn-primary btn-sm">Otevřít plán</a> </div> <div id="main-plan-schedule" class="schedule-grid" style="margin-top: 1.5rem;"> <p>Týdenní přehled se načte v detailu plánu.</p> </div>`;
            ui.studyPlanContent.style.display = 'block';
            ui.studyPlanContainer.classList.remove('loading'); // Ensure loading class removed
        } else {
            console.log("[Render Plan] No active plan found, rendering empty state.");
            ui.studyPlanEmpty.innerHTML = `<i class="fas fa-route empty-state-icon"></i><h3>Žádný aktivní plán</h3><p>Momentálně nemáte aktivní studijní plán. Můžete si jej vytvořit v <a href="plan.html" onclick="event.preventDefault(); switchActiveTab('study-plan-tab'); return false;">detailu plánu</a>.</p>`;
            ui.studyPlanEmpty.style.display = 'flex';
             ui.studyPlanContainer.classList.remove('loading'); // Ensure loading class removed
        }
        // setLoadingState('plan', false); // Called by loadTabData finally block now
        console.log("[Render Plan] Rendering complete.");
    }

	function renderTopicAnalysis(topics, goal) { /* ... (Keep existing logic, add empty state check) ... */ }

	function renderShortcutsForGoal(goal, container) {
        console.log(`[Render Shortcuts] Starting for goal: ${goal}`);
        if (!container) { console.warn("[Render Shortcuts] Shortcut container not found."); setLoadingState('shortcuts', false); return; }
        // setLoadingState('shortcuts', true); // Set by loadTabData

        let shortcutsHTML = '';
        const shortcuts = { test: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-graduation-cap"></i></div><h3 class="shortcut-title">Diagnostický Test</h3><p class="shortcut-desc">Ověřte své znalosti.</p><a href="test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Test</a></div>`, plan: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-tasks"></i></div><h3 class="shortcut-title">Studijní Plán</h3><p class="shortcut-desc">Zobrazte personalizovaný plán.</p><a href="plan.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Zobrazit Plán</a></div>`, tutor: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-book-open"></i></div><h3 class="shortcut-title">AI Tutor (Lekce)</h3><p class="shortcut-desc">Vysvětlení témat z plánu.</p><a href="vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a></div>`, nextTopic: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-forward"></i></div><h3 class="shortcut-title">Další Téma Osnovy</h3><p class="shortcut-desc">Pokračujte v osnově.</p><a href="vyuka/vyuka.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Učit se Další</a></div>`, curriculum: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-stream"></i></div><h3 class="shortcut-title">Přehled Osnovy</h3><p class="shortcut-desc">Zobrazte přehled témat.</p><a href="plan.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Osnovu</a></div>`, weakness: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-search"></i></div><h3 class="shortcut-title">Moje Slabiny</h3><p class="shortcut-desc">Témata k zlepšení.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="switchActiveTab('topic-analysis-tab'); return false;">Analýza Témat</a></div>`, review: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-history"></i></div><h3 class="shortcut-title">Opakování</h3><p class="shortcut-desc">Procvičte si starší témata.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="showToast('Info','Funkce opakování se připravuje.','info'); return false;">Spustit Opakování</a></div>`, explore: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-compass"></i></div><h3 class="shortcut-title">Procházet Témata</h3><p class="shortcut-desc">Vyberte si téma k učení.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="switchActiveTab('topic-analysis-tab'); return false;">Vybrat Téma</a></div>`, random: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-dumbbell"></i></div><h3 class="shortcut-title">Náhodné Cvičení</h3><p class="shortcut-desc">Rychlé procvičení.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="showToast('Info','Funkce náhodného cvičení se připravuje.','info'); return false;">Náhodné Cvičení</a></div>`, progress: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-chart-line"></i></div><h3 class="shortcut-title">Můj Pokrok</h3><p class="shortcut-desc">Sledujte své zlepšení.</p><a href="../pokrok.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Pokrok</a></div>` };
        switch (goal) { case 'exam_prep': shortcutsHTML = shortcuts.test + shortcuts.plan + shortcuts.tutor; break; case 'math_accelerate': shortcutsHTML = shortcuts.nextTopic + shortcuts.curriculum + shortcuts.tutor; break; case 'math_review': shortcutsHTML = shortcuts.weakness + shortcuts.review + shortcuts.tutor; break; case 'math_explore': shortcutsHTML = shortcuts.explore + shortcuts.random + shortcuts.tutor; break; default: shortcutsHTML = shortcuts.progress + shortcuts.tutor + shortcuts.random; }

        if (!shortcutsHTML) {
             console.log("[Render Shortcuts] No shortcuts defined for this goal, rendering empty state.");
             container.innerHTML = `<div class="empty-state" style="display: flex; grid-column: 1 / -1;"> <i class="fas fa-ban empty-state-icon"></i> <p>Pro tento cíl nejsou definovány žádné rychlé akce.</p> </div>`;
             container.style.display = 'block';
        } else {
            console.log("[Render Shortcuts] Shortcuts found, generating HTML...");
            container.innerHTML = shortcutsHTML;
            container.querySelectorAll('.shortcut-card').forEach((card, index) => { card.style.setProperty('--animation-order', index + 7); });
            container.style.display = 'grid'; // Set display after content is added
        }
        container.classList.remove('loading'); // Ensure loading removed
        // setLoadingState('shortcuts', false); // Called by loadTabData finally block now
        if (typeof initScrollAnimations === 'function') initScrollAnimations();
        if (typeof initTooltips === 'function') initTooltips();
        console.log("[Render Shortcuts] Rendering complete.");
    }
	// --- END: UI Update Functions ---

	// --- START: Data Fetching Stubs ---
	async function fetchDashboardStats(userId, profileData) { console.log("[Fetch Data Stub] fetchDashboardStats called."); setLoadingState('stats', true); await new Promise(resolve => setTimeout(resolve, 700)); console.log("[Fetch Data Stub] fetchDashboardStats finished delay."); const lastTest = diagnosticResultsData?.length > 0 ? diagnosticResultsData[0] : null; const stats = { totalPoints: profileData?.points || 0, completedExercises: profileData?.completed_exercises || 0, activeStreak: profileData?.streak_days || 0, streakRecord: profileData?.streak_record || 0, completedExercisesToday: profileData?.exercises_today || 0, lastTestScore: lastTest?.total_score ?? null, lastTestDate: lastTest?.completed_at ?? null }; return stats; }
	async function fetchDiagnosticResults(userId, goal) { console.log("[Fetch Data Stub] fetchDiagnosticResults called."); setLoadingState('tests', true); await new Promise(resolve => setTimeout(resolve, 1000)); console.log("[Fetch Data Stub] fetchDiagnosticResults finished delay."); return []; }
	async function fetchActiveStudyPlan(userId, goal) { console.log("[Fetch Data Stub] fetchActiveStudyPlan called."); setLoadingState('plan', true); await new Promise(resolve => setTimeout(resolve, 800)); console.log("[Fetch Data Stub] fetchActiveStudyPlan finished delay."); return null; } // Return null to test empty state
	async function fetchPlanActivities(planId, goal) { console.log("[Fetch Data Stub] fetchPlanActivities called."); await new Promise(resolve => setTimeout(resolve, 500)); console.log("[Fetch Data Stub] fetchPlanActivities finished delay."); return []; }
	async function fetchTopicProgress(userId, goal) { console.log("[Fetch Data Stub] fetchTopicProgress called."); setLoadingState('topics', true); await new Promise(resolve => setTimeout(resolve, 900)); console.log("[Fetch Data Stub] fetchTopicProgress finished delay."); return [ { id: 'algebra', name: 'Algebra', progress: 0, last_practiced: null, strength: 'neutral' }, { id: 'geometry', name: 'Geometrie', progress: 0, last_practiced: null, strength: 'neutral' }, { id: 'functions', name: 'Funkce', progress: 0, last_practiced: null, strength: 'neutral' } ]; }
	// --- END: Data Fetching Stubs ---

	// --- START: Notification Stubs ---
	async function fetchNotifications(userId, limit) { console.log(`[Notifications Stub] fetchNotifications called for user ${userId}, limit ${limit}.`); setLoadingState('notifications', true); await new Promise(resolve => setTimeout(resolve, 600)); console.log("[Notifications Stub] fetchNotifications finished delay."); const fakeNotifications = []; renderNotifications(0, fakeNotifications); return { unreadCount: 0, notifications: fakeNotifications }; } // setLoadingState false is handled in render
	function renderNotifications(count, notifications) { console.log(`[Notifications Stub] renderNotifications called with count ${count}.`); const list = ui.notificationsList; const noMsg = ui.noNotificationsMsg; const btn = ui.markAllReadBtn; const bellCount = ui.notificationCount; if (!list || !noMsg || !btn || !bellCount) { console.error("[Notifications Stub] UI elements missing."); setLoadingState('notifications', false); return; } bellCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); bellCount.classList.toggle('visible', count > 0); if (notifications?.length > 0) { list.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join(''); noMsg.style.display = 'none'; list.style.display = 'block'; } else { list.innerHTML = ''; noMsg.style.display = 'block'; list.style.display = 'none'; } btn.disabled = count === 0; setLoadingState('notifications', false); }
	async function markNotificationRead(notificationId) { console.log(`[Notifications Stub] markNotificationRead for ID ${notificationId}.`); await new Promise(resolve => setTimeout(resolve, 200)); return true; }
	async function markAllNotificationsRead() { console.log(`[Notifications Stub] markAllNotificationsRead.`); setLoadingState('notifications', true); await new Promise(resolve => setTimeout(resolve, 300)); renderNotifications(0, []); } // setLoadingState false is handled in render
	// --- END: Notification Stubs ---

	// --- START: Goal Selection Logic ---
	function checkUserGoalAndDiagnostic() { console.log("[Goal Check] Checking user goal and diagnostic status..."); try { if (!currentProfile) { console.warn("[Goal Check] Profile not loaded yet."); if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; return; } if (!currentProfile.learning_goal) { if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none'; console.log("[Goal Check] No learning_goal. Showing modal."); showGoalSelectionModal(); return; } const goal = currentProfile.learning_goal; console.log(`[Goal Check] User goal: ${goal}`); if (!ui.diagnosticPrompt) { console.warn("[Goal Check] ui.diagnosticPrompt not found."); return; } if (goal === 'exam_prep') { console.log("[Goal Check] Goal is exam_prep. Checking diagnosticResultsData."); if (diagnosticResultsData && diagnosticResultsData.length > 0) { const latestResult = diagnosticResultsData[0]; const score = latestResult.total_score ?? 0; console.log(`[Goal Check] Latest diagnostic score: ${score}`); if (score < 20) { ui.diagnosticPrompt.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: var(--accent-orange);"></i><p>Vaše skóre v posledním diagnostickém testu (${score}/50) bylo nízké. Pro optimální přípravu doporučujeme absolvovat test znovu nebo se zaměřit na slabší oblasti.</p><a href="procvicovani/test1.html" class="btn btn-primary" id="start-test-btn-prompt-lowscore"><i class="fas fa-play"></i> Opakovat test</a>`; ui.diagnosticPrompt.style.display = 'flex'; } else { ui.diagnosticPrompt.style.display = 'none'; console.log("[Goal Check] Diagnostic score good."); } } else { ui.diagnosticPrompt.innerHTML = `<i class="fas fa-exclamation-circle"></i><p>Pro odemčení personalizovaného obsahu a studijního plánu je potřeba absolvovat <strong>diagnostický test</strong>.</p><a href="procvicovani/test1.html" class="btn btn-primary" id="start-test-btn-prompt"><i class="fas fa-play"></i> Spustit test</a>`; ui.diagnosticPrompt.style.display = 'flex'; console.log("[Goal Check] No diagnostic results for exam_prep."); } } else { ui.diagnosticPrompt.style.display = 'none'; console.log("[Goal Check] Goal not exam_prep, hiding diagnostic prompt."); } } catch (error) { console.error("[Goal Check] Error:", error); if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none'; } }
	function showGoalSelectionModal() { if (!ui.goalSelectionModal || !ui.goalStep1) { console.error("[GoalModal] Critical modal elements missing."); showError("Chyba zobrazení výběru cíle.", true); return; } console.log("[GoalModal] Showing goal selection modal."); ui.goalSelectionModal.querySelectorAll('.modal-step').forEach(step => { step.classList.remove('active'); step.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => input.checked = false); }); ui.goalStep1.classList.add('active'); ui.goalSelectionModal.style.display = 'flex'; document.body.classList.add('modal-open'); requestAnimationFrame(() => ui.goalSelectionModal.classList.add('active')); const radioListContainer = ui.goalStep1.querySelector('.goal-radio-list'); if (radioListContainer) { if (radioListContainer._goalChangeHandler) { radioListContainer.removeEventListener('change', radioListContainer._goalChangeHandler); } const newHandler = (event) => { if (event.target.type === 'radio' && event.target.name === 'learningGoal') { const selectedGoal = event.target.value; console.log(`Goal selected via radio: ${selectedGoal}`); radioListContainer.querySelectorAll('.goal-radio-label').forEach(label => { label.classList.remove('selected-goal'); }); event.target.closest('.goal-radio-label')?.classList.add('selected-goal'); handleInitialGoalSelection(selectedGoal); } }; radioListContainer.addEventListener('change', newHandler); radioListContainer._goalChangeHandler = newHandler; } else { console.error("[GoalModal] .goal-radio-list container not found!"); } }
	function hideGoalSelectionModal() { if (!ui.goalSelectionModal) return; ui.goalSelectionModal.classList.remove('active'); document.body.classList.remove('modal-open'); setTimeout(() => { if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; }, 300); }
	function handleInitialGoalSelection(selectedGoal) { if (goalSelectionInProgress) return; console.log(`[GoalModal] Initial goal selected: ${selectedGoal}`); pendingGoal = selectedGoal; if (selectedGoal === 'exam_prep' || selectedGoal === 'math_explore') { saveGoalAndProceed(selectedGoal); } else { showStep2(selectedGoal); } }
	function showStep2(goalType) { const step2Id = `goal-step-${goalType.replace('math_', '')}`; const step2Element = document.getElementById(step2Id); if (!ui.goalSelectionModal || !ui.goalStep1 || !step2Element) { console.error(`[GoalModal] Cannot show step 2 for ${goalType}: Missing elements.`); showError("Chyba zobrazení kroku 2.", true); return; } console.log(`[GoalModal] Showing step 2: #${step2Id}`); ui.goalSelectionModal.querySelectorAll('.modal-step').forEach(step => step.classList.remove('active')); step2Element.classList.add('active'); const backBtn = step2Element.querySelector('.modal-back-btn'); if (backBtn) { const oldHandler = backBtn._backHandler; if (oldHandler) backBtn.removeEventListener('click', oldHandler); const newHandler = () => handleBackToStep1(ui.goalStep1, step2Element); backBtn.addEventListener('click', newHandler); backBtn._backHandler = newHandler; } const confirmBtn = step2Element.querySelector('.modal-confirm-btn'); if (confirmBtn) { const oldHandler = confirmBtn._confirmHandler; if (oldHandler) confirmBtn.removeEventListener('click', oldHandler); const newHandler = () => handleStep2Confirm(goalType); confirmBtn.addEventListener('click', newHandler); confirmBtn._confirmHandler = newHandler; confirmBtn.disabled = false; confirmBtn.innerHTML = 'Potvrdit a pokračovat'; } }
	function handleBackToStep1(step1Element, currentStep2Element) { console.log("[GoalModal] Back to step 1..."); if(currentStep2Element) currentStep2Element.classList.remove('active'); if(step1Element) step1Element.classList.add('active'); pendingGoal = null; }
	function handleStep2Confirm(goalType) { if (goalSelectionInProgress) return; const step2Id = `goal-step-${goalType.replace('math_', '')}`; const step2Element = document.getElementById(step2Id); if (!step2Element) { console.error(`[GoalModal] Step 2 element ${step2Id} not found.`); return; } const details = {}; let isValid = true; try { if (goalType === 'math_accelerate') { details.accelerate_areas = Array.from(step2Element.querySelectorAll('input[name="accelerate_area"]:checked')).map(cb => cb.value); const reasonRadio = step2Element.querySelector('input[name="accelerate_reason"]:checked'); details.accelerate_reason = reasonRadio ? reasonRadio.value : null; if(details.accelerate_areas.length === 0) { showToast("Chyba", "Vyberte alespoň jednu oblast zájmu.", "warning"); isValid = false; } if(!details.accelerate_reason) { showToast("Chyba", "Vyberte důvod pro učení napřed.", "warning"); isValid = false; } } else if (goalType === 'math_review') { details.review_areas = Array.from(step2Element.querySelectorAll('input[name="review_area"]:checked')).map(cb => cb.value); } } catch (e) { console.error("[GoalModal] Error getting step 2 details:", e); isValid = false; showToast("Chyba", "Chyba zpracování výběru.", "error"); } if (isValid) { console.log(`[GoalModal] Step 2 details for ${goalType}:`, details); saveGoalAndProceed(pendingGoal, details); } }
	async function saveGoalAndProceed(goal, details = null) { if (goalSelectionInProgress || !goal) return; goalSelectionInProgress = true; setLoadingState('goalSelection', true); console.log(`[GoalModal Save] Saving goal: ${goal}, details:`, details); const activeStep = ui.goalSelectionModal?.querySelector('.modal-step.active'); const confirmButton = activeStep?.querySelector('.modal-confirm-btn'); const backButton = activeStep?.querySelector('.modal-back-btn'); if (confirmButton) { confirmButton.disabled = true; confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...'; } if (backButton) backButton.disabled = true; try { if (!supabase || !currentUser || !currentProfile) throw new Error("Core dependencies missing."); const finalPreferences = { ...(currentProfile.preferences || {}), goal_details: (details && Object.keys(details).length > 0) ? details : undefined }; const updatePayload = { learning_goal: goal, preferences: finalPreferences, updated_at: new Date().toISOString() }; console.log("[GoalModal Save] Updating Supabase profile:", updatePayload); const { data: updatedProfileData, error } = await supabase.from('profiles').update(updatePayload).eq('id', currentUser.id).select('*, selected_title, preferences').single(); if (error) throw error; currentProfile = updatedProfileData; if (!currentProfile.preferences) currentProfile.preferences = {}; console.log("[GoalModal Save] Goal saved to DB:", currentProfile.learning_goal); let goalTextKey = `goal_${goal.replace('math_','')}`; let goalText = { goal_exam_prep: 'Příprava na zkoušky', goal_accelerate: 'Učení napřed', goal_review: 'Doplnění mezer', goal_explore: 'Volné prozkoumávání'}[goalTextKey] || goal; showToast('Cíl uložen!', `Váš cíl: ${goalText}.`, 'success'); hideGoalSelectionModal(); console.log("[GoalModal Save] Making main content areas visible..."); if(ui.tabsWrapper) { ui.tabsWrapper.style.display = 'flex'; ui.tabsWrapper.classList.add('visible'); } else { console.warn("[GoalModal Save] tabsWrapper not found."); } if(ui.tabContentContainer) { ui.tabContentContainer.style.display = 'flex'; ui.tabContentContainer.classList.add('visible'); } else { console.warn("[GoalModal Save] tabContentContainer not found."); } configureUIForGoal(); // This will set the default active tab UI
            await loadPageData(); // This will load data for the default active tab
            if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled'); console.log("[GoalModal Save] UI configured and page data loading initiated."); } catch (error) { console.error("[GoalModal Save] Error saving goal:", error); showToast('Chyba', 'Nepodařilo se uložit váš cíl.', 'error'); if (confirmButton) { confirmButton.disabled = false; confirmButton.innerHTML = 'Potvrdit a pokračovat'; } if (backButton) backButton.disabled = false; } finally { goalSelectionInProgress = false; setLoadingState('goalSelection', false); pendingGoal = null; } }
	// --- END: Goal Selection Logic ---

	// --- START: UI Configuration and Data Loading ---
	function getGoalDisplayName(goalKey) { const goalMap = { 'exam_prep': 'Příprava na přijímačky', 'math_accelerate': 'Učení napřed', 'math_review': 'Doplnění mezer', 'math_explore': 'Volné prozkoumávání' }; return goalMap[goalKey] || goalKey || 'Nenastaveno'; }
	function configureUIForGoal() { console.log("[Configure UI] Starting..."); if (!currentProfile || !currentProfile.learning_goal) { console.error("[Configure UI] Profile or goal missing."); if (ui.goalSelectionModal && getComputedStyle(ui.goalSelectionModal).display === 'none') { showGoalSelectionModal(); } if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none'; if (ui.tabContentContainer) ui.tabContentContainer.style.display = 'none'; return; } const goal = currentProfile.learning_goal; console.log(`[Configure UI] Configuring UI for goal: ${goal}`); if (!ui || !ui.contentTabs || !ui.tabContents) { console.error("[Configure UI] UI cache or tab elements missing. Attempting re-cache..."); cacheDOMElements(); if (!ui.contentTabs || !ui.tabContents) { showError("Chyba: UI components for tabs not found.", true); return; } } const dashboardTitleEl = ui.dashboardTitle; if (dashboardTitleEl) { let titleText = "Procvičování // "; let iconClass = "fas fa-laptop-code"; switch(goal) { case 'exam_prep': titleText += "Příprava na Zkoušky"; iconClass = "fas fa-graduation-cap"; break; case 'math_accelerate': titleText += "Učení Napřed"; iconClass = "fas fa-rocket"; break; case 'math_review': titleText += "Doplnění Mezer"; iconClass = "fas fa-sync-alt"; break; case 'math_explore': titleText += "Volné Prozkoumávání"; iconClass = "fas fa-compass"; break; default: titleText += "Přehled"; } dashboardTitleEl.innerHTML = `<i class="${iconClass}"></i> ${sanitizeHTML(titleText)}`; } else { console.warn("[Configure UI] Dashboard title element not found."); } if (ui.userGoalDisplay) { const goalName = getGoalDisplayName(goal); ui.userGoalDisplay.textContent = `Váš cíl: ${goalName}`; ui.userGoalDisplay.style.display = 'inline-block'; } else { console.warn("[Configure UI] User goal display element not found."); } if (ui.shortcutsGrid) { renderShortcutsForGoal(goal, ui.shortcutsGrid); } else { console.warn("[Configure UI] Shortcuts grid not found."); } if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'flex'; ui.tabsWrapper.classList.add('visible'); } if (ui.tabContentContainer) { ui.tabContentContainer.style.display = 'flex'; ui.tabContentContainer.classList.add('visible'); } const alwaysVisibleTabs = ['practice-tab', 'study-plan-tab', 'vyuka-tab']; if (ui.contentTabs && ui.contentTabs.length > 0) { ui.contentTabs.forEach(tabButton => { const tabId = tabButton.dataset.tab; tabButton.style.display = alwaysVisibleTabs.includes(tabId) ? 'flex' : 'none'; }); console.log("[Configure UI] Tab visibility set."); } else { console.warn("[Configure UI] Tab buttons not found."); } let activeTabId = localStorage.getItem('lastActiveProcvicovaniTab') || 'practice-tab'; let activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`); if (!activeTabButton || activeTabButton.style.display === 'none') { activeTabId = 'practice-tab'; } console.log(`[Configure UI] Determined initial active tab ID: ${activeTabId}`); switchActiveTab(activeTabId); // Sets active class and display, DOES NOT load data here
        console.log(`[Configure UI] UI configuration complete.`); }
	async function loadTabData(tabId) { console.log(`%c[Load Tab Data] Attempting to load data for tab: ${tabId}`, "color: cyan; font-weight: bold;"); const camelCaseKey = tabId.replace(/-([a-z])/g, (g) => g[1].toUpperCase()); const contentKey = `${camelCaseKey}Content`; if (!currentProfile || !currentProfile.learning_goal) { console.warn(`[Load Tab Data] Cannot load data for tab '${tabId}', missing profile or goal.`); const contentElement = ui[contentKey]; if (contentElement) { contentElement.innerHTML = `<div class="empty-state" style="display:flex; flex-direction:column; align-items:center;"><i class="fas fa-info-circle"></i><h3>Vyberte cíl</h3><p>Pro zobrazení obsahu této záložky si nejprve vyberte svůj studijní cíl.</p><button class="btn btn-primary" id="selectGoalBtnInTab_${tabId}">Vybrat cíl</button></div>`; contentElement.style.display = 'block'; const selectGoalBtn = document.getElementById(`selectGoalBtnInTab_${tabId}`); if(selectGoalBtn) selectGoalBtn.addEventListener('click', showGoalSelectionModal); } else { console.error(`[Load Tab Data] Content element '${contentKey}' not found.`); } return; } const goal = currentProfile.learning_goal; console.log(`[Load Tab Data] Loading data for tab: ${tabId}, goal: ${goal}, UI key: ${contentKey}`); const sectionKey = tabIdToSectionKey(tabId); if (sectionKey !== 'none') setLoadingState(sectionKey, true); let success = false; try { const targetContentElement = ui[contentKey]; if (!targetContentElement) { throw new Error(`Content element '${contentKey}' (ID: ${tabId}-content) not found.`); } targetContentElement.innerHTML = ''; targetContentElement.style.display = 'block'; console.log(`[Load Tab Data] Cleared and displayed content for ${tabId}.`); if (tabId !== 'vyuka-tab') { switch (tabId) { case 'practice-tab': if (ui.statsCards) renderStatsSkeletons(ui.statsCards); if (ui.shortcutsGrid) renderShortcutSkeletons(ui.shortcutsGrid); break; case 'study-plan-tab': if (ui.studyPlanContent) renderPlanSkeletons(ui.studyPlanContent); break; default: break; } } console.log(`[Load Tab Data] Starting data fetch for ${tabId}...`); switch (tabId) { case 'practice-tab': userStatsData = await fetchDashboardStats(currentUser.id, currentProfile); console.log(`[Load Tab Data] Stats data fetched for ${tabId}. Rendering...`); renderStatsCards(userStatsData); if (ui.shortcutsGrid) renderShortcutsForGoal(goal, ui.shortcutsGrid); if(ui.diagnosticPrompt) await checkUserGoalAndDiagnostic(); break; case 'study-plan-tab': studyPlanData = await fetchActiveStudyPlan(currentUser.id, goal); console.log(`[Load Tab Data] Plan data fetched for ${tabId}. Rendering...`); planActivitiesData = studyPlanData ? await fetchPlanActivities(studyPlanData.id, goal) : []; renderStudyPlanOverview(studyPlanData, planActivitiesData, goal); break; case 'vyuka-tab': if (!targetContentElement.querySelector('h3')) { targetContentElement.innerHTML = `<div class="empty-state" style="display:flex; flex-direction:column; align-items:center;"><i class="fas fa-person-chalkboard empty-state-icon"></i><h3>Výuka s AI</h3><p>Zde naleznete interaktivní lekce s AI tutorem Justaxem. Obsah se přizpůsobí vašemu plánu.</p><a href="vyuka/vyuka.html" class="btn btn-primary" style="margin-top: 1rem;"> <i class="fas fa-book-open"></i> Spustit výuku </a></div>`; } console.log("[Load Tab Data] Displaying static content for vyuka-tab."); break; default: console.warn(`[Load Tab Data] No specific data loading logic for tab: ${tabId}`); if (targetContentElement) targetContentElement.innerHTML = `<div class="empty-state" style="display:block;"><i class="fas fa-question-circle"></i><p>Obsah pro tuto záložku se připravuje.</p></div>`; break; } success = true; console.log(`%c[Load Tab Data] Successfully finished loading and rendering for tab: ${tabId}`, "color: lime;"); } catch (error) { console.error(`[Load Tab Data] Error loading data for tab ${tabId}:`, error); showError(`Nepodařilo se načíst data pro záložku: ${error.message}`); const contentEl = ui[contentKey]; if (contentEl) { contentEl.innerHTML = `<div class="empty-state" style="display:block;"><i class="fas fa-exclamation-triangle"></i><p>Chyba načítání dat.</p></div>`; contentEl.style.display = 'block'; } } finally { console.log(`[Load Tab Data] Entering finally block for ${tabId}. Success: ${success}`); if (sectionKey !== 'none') { setLoadingState(sectionKey, false); } } }
	function tabIdToSectionKey(tabId) { switch (tabId) { case 'practice-tab': return 'stats'; case 'test-results-tab': return 'tests'; case 'study-plan-tab': return 'plan'; case 'vyuka-tab': return 'none'; default: return 'all'; } }
	async function loadPageData() { if (!currentProfile) { console.error("[Load Page Data] Cannot load page data, profile missing."); return; } if (!currentProfile.learning_goal) { console.log("[Load Page Data] Goal missing, modal should handle this. Skipping data load."); return; } console.log(`🔄 [Load Page Data] Initial page data load for goal: ${currentProfile.learning_goal}...`); hideError(); let activeTabId = localStorage.getItem('lastActiveProcvicovaniTab') || 'practice-tab'; let activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`); if (!activeTabButton || activeTabButton.style.display === 'none') { activeTabId = 'practice-tab'; } console.log(`[Load Page Data] Loading data for initially determined active tab: ${activeTabId}`); await loadTabData(activeTabId); // Load data only for the active tab
        initTooltips(); console.log("✅ [Load Page Data] Initial page data loading process complete for active tab."); isInitialPageLoadComplete = true; // Set flag AFTER initial load is complete
    }
	function handleTabSwitch(event) {
        console.log("[Handle Tab Switch] Click detected.");
        const targetTabButton = event.currentTarget;
        const tabId = targetTabButton.dataset.tab;
        if (!tabId) { console.warn("[Handle Tab Switch] No tabId found on clicked element."); return; }

        const currentActiveTabButton = document.querySelector('.content-tab.active');
        if (targetTabButton === currentActiveTabButton && isInitialPageLoadComplete) { // Avoid reload if already active AND initial load done
            console.log(`[Handle Tab Switch] Tab ${tabId} is already active. Ignoruji.`);
            return;
        }

        console.log(`[Handle Tab Switch] User requested switch to tab: ${tabId}`);
        switchActiveTab(tabId); // Switch UI
        loadTabData(tabId); // Load data
    }
	function switchActiveTab(tabId) {
        const targetTabButton = document.querySelector(`.content-tab[data-tab="${tabId}"]`);
        if (!targetTabButton) { console.warn(`[SwitchActiveTab] Tab button for '${tabId}' not found.`); return; }
        console.log(`[SwitchActiveTab] Setting active UI for tab: ${tabId}.`);

        if (ui.contentTabs) ui.contentTabs.forEach(tab => tab.classList.remove('active'));
        else console.warn("[SwitchActiveTab] ui.contentTabs not found.");
        targetTabButton.classList.add('active');

        const activeContentId = `${tabId}-content`;
        if(ui.tabContents) {
            ui.tabContents.forEach(content => {
                if(content) content.style.display = content.id === activeContentId ? 'block' : 'none';
            });
        } else console.warn("[SwitchActiveTab] ui.tabContents not found.");

        localStorage.setItem('lastActiveProcvicovaniTab', tabId);
        console.log(`[SwitchActiveTab] UI switched to ${tabId}.`);
    }
	async function handleRefreshClick() { if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } console.log("🔄 Manual refresh triggered..."); const icon = ui.refreshDataBtn?.querySelector('i'); const text = ui.refreshDataBtn?.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = true; let activeTabId = localStorage.getItem('lastActiveProcvicovaniTab') || 'practice-tab'; let activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`); if (!activeTabButton || activeTabButton.style.display === 'none') { activeTabId = 'practice-tab'; } console.log(`[Refresh] Reloading data for active tab: ${activeTabId}`); await loadTabData(activeTabId); // Reload only the active tab's data
		if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = false; console.log("[Refresh] Reload complete.");}
	function handleOutsideNotificationClick(event) { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } }
	function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded or createClient is not a function."); } if (window.supabaseClient) { supabase = window.supabaseClient; console.log('[Supabase] Using existing global client instance.'); } else if (supabase === null) { supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); if (!supabase) throw new Error("Supabase client creation failed."); window.supabaseClient = supabase; console.log('[Supabase] Client initialized by main.js and stored globally.'); } else { console.log('[Supabase] Using existing local client instance.'); } return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }
	async function createDefaultProfile(userId, email) { console.log(`[Default Profile] Creating default profile for new user ${userId}...`); const defaultProfileData = { id: userId, username: email.split('@')[0], email: email, updated_at: new Date().toISOString(), learning_goal: null, preferences: {}, points: 0, level: 1, completed_exercises: 0, streak_days: 0, selected_title: null, avatar_url: null, first_name: null, last_name: null, }; try { const { data, error } = await supabase.from('profiles').insert(defaultProfileData).select('*, selected_title, preferences').single(); if (error) { if (error.code === '23505') { console.warn("[Default Profile] Profile likely already exists, attempting to fetch..."); const { data: existingProfile, error: fetchError } = await supabase.from('profiles').select('*, selected_title, preferences').eq('id', userId).single(); if (fetchError) { console.error("[Default Profile] Error fetching existing profile after unique violation:", fetchError); throw fetchError; } if (!existingProfile.preferences) existingProfile.preferences = {}; return existingProfile; } throw error; } if (!data.preferences) data.preferences = {}; console.log("[Default Profile] Default profile created successfully:", data); return data; } catch (err) { console.error("[Default Profile] Error creating default profile:", err); showError("Nepodařilo se vytvořit uživatelský profil.", true); return null; } }
	// --- END: Core Application Logic ---

	// --- START: DOM Element Caching Function ---
	function cacheDOMElements() {
		console.log("[Procvičování Cache DOM v6.2] Caching elements...");
		const elementDefinitions = [ { key: 'initialLoader', id: 'initial-loader', critical: true }, { key: 'mainContent', id: 'main-content', critical: true }, { key: 'sidebar', id: 'sidebar', critical: true }, { key: 'tabsWrapper', id: 'tabs-wrapper', critical: true }, { key: 'practiceTabContent', id: 'practice-tab-content', critical: true }, { key: 'goalSelectionModal', id: 'goal-selection-modal', critical: true }, { key: 'goalStep1', id: 'goal-step-1', critical: true }, { key: 'tabContentContainer', query: '.tab-content-container', critical: true }, { key: 'sidebarOverlay', id: 'sidebar-overlay', critical: false }, { key: 'mainMobileMenuToggle', id: 'main-mobile-menu-toggle', critical: false }, { key: 'sidebarCloseToggle', id: 'sidebar-close-toggle', critical: false }, { key: 'sidebarToggleBtn', id: 'sidebar-toggle-btn', critical: false }, { key: 'sidebarAvatar', id: 'sidebar-avatar', critical: false }, { key: 'sidebarName', id: 'sidebar-name', critical: false }, { key: 'sidebarUserTitle', id: 'sidebar-user-title', critical: false }, { key: 'currentYearSidebar', id: 'currentYearSidebar', critical: false }, { key: 'dashboardHeader', query: '.dashboard-header', critical: false }, { key: 'dashboardTitle', id: 'dashboard-title', critical: false }, { key: 'userGoalDisplay', id: 'user-goal-display', critical: false }, { key: 'refreshDataBtn', id: 'refresh-data-btn', critical: false }, { key: 'currentYearFooter', id: 'currentYearFooter', critical: false }, { key: 'mouseFollower', id: 'mouse-follower', critical: false }, { key: 'globalError', id: 'global-error', critical: false }, { key: 'toastContainer', id: 'toastContainer', critical: false }, { key: 'notificationBell', id: 'notification-bell', critical: false }, { key: 'notificationCount', id: 'notification-count', critical: false }, { key: 'notificationsDropdown', id: 'notifications-dropdown', critical: false }, { key: 'notificationsList', id: 'notifications-list', critical: false }, { key: 'noNotificationsMsg', id: 'no-notifications-msg', critical: false }, { key: 'markAllReadBtn', id: 'mark-all-read-btn', critical: false }, { key: 'diagnosticPrompt', id: 'diagnostic-prompt', critical: false }, { key: 'startTestBtnPrompt', id: 'start-test-btn-prompt', critical: false }, { key: 'statsCards', id: 'stats-cards', critical: false }, { key: 'shortcutsGrid', id: 'shortcuts-grid', critical: false }, { key: 'testResultsContainer', id: 'test-results-container', critical: false }, { key: 'testResultsLoading', id: 'test-results-loading', critical: false }, { key: 'testResultsContent', id: 'test-results-content', critical: false }, { key: 'testResultsEmpty', id: 'test-results-empty', critical: false }, { key: 'startTestBtnResults', id: 'start-test-btn-results', critical: false }, { key: 'studyPlanContainer', id: 'study-plan-container', critical: false }, { key: 'studyPlanLoading', id: 'study-plan-loading', critical: false }, { key: 'studyPlanContent', id: 'study-plan-content', critical: false }, { key: 'studyPlanEmpty', id: 'study-plan-empty', critical: false }, { key: 'createPlanBtnEmpty', id: 'create-plan-btn-empty', critical: false }, { key: 'goalStepAccelerate', id: 'goal-step-accelerate', critical: false }, { key: 'accelerateAreasGroup', id: 'accelerate-areas-group', critical: false }, { key: 'accelerateReasonGroup', id: 'accelerate-reason-group', critical: false }, { key: 'goalStepReview', id: 'goal-step-review', critical: false }, { key: 'reviewAreasGroup', id: 'review-areas-group', critical: false }, { key: 'goalStepExplore', id: 'goal-step-explore', critical: false }, { key: 'exploreLevelGroup', id: 'explore-level-group', critical: false }, { key: 'testResultsTabContent', id: 'test-results-tab-content', critical: false }, { key: 'studyPlanTabContent', id: 'study-plan-tab-content', critical: true }, { key: 'vyukaTabContent', id: 'vyuka-tab-content', critical: true } ];
		const notFoundCritical = []; const notFoundNonCritical = [];
		elementDefinitions.forEach(def => { const element = def.id ? document.getElementById(def.id) : document.querySelector(def.query); const key = def.key; if (element) { ui[key] = element; } else { ui[key] = null; if (def.critical) { notFoundCritical.push(`${key} (${def.id || def.query})`); } else { notFoundNonCritical.push(`${key} (${def.id || def.query})`); } } });
		ui.contentTabs = document.querySelectorAll('.content-tab'); ui.tabContents = document.querySelectorAll('.tab-content'); ui.modalBackBtns = ui.goalSelectionModal ? ui.goalSelectionModal.querySelectorAll('.modal-back-btn') : []; ui.modalConfirmBtns = ui.goalSelectionModal ? ui.goalSelectionModal.querySelectorAll('.modal-confirm-btn') : []; ui.goalOptionCards = ui.goalStep1 ? ui.goalStep1.querySelectorAll('.goal-radio-label') : [];
		if (notFoundCritical.length > 0) { console.error(`[CACHE DOM v6.2] KRITICKÉ elementy nenalezeny (${notFoundCritical.length}):`, notFoundCritical.join(', ')); throw new Error(`Chyba načítání stránky: Kritické komponenty chybí (${notFoundCritical.join(', ')}).`); } else { console.log("[CACHE DOM v6.2] Všechny kritické elementy nalezeny."); }
		if (notFoundNonCritical.length > 0) { console.warn(`[CACHE DOM v6.2] Některé nekritické elementy nenalezeny (${notFoundNonCritical.length}):`, notFoundNonCritical.join(', ')); }
		if (!ui.contentTabs || ui.contentTabs.length === 0) console.warn("[CACHE DOM v6.2] Nenalezeny žádné elementy záložek (.content-tab).");
		if (!ui.tabContentContainer) console.error("[CACHE DOM v6.2] Kritický element '.tab-content-container' nebyl nalezen!");
		console.log("[Procvičování Cache DOM v6.2] Cachování dokončeno.");
	}
	// --- END: DOM Element Caching Function ---

	// --- START: Event Listeners Setup ---
	function setupEventListeners() {
		console.log("[Procvičování SETUP v6.2] Setting up base listeners...");
		const safeAddListener = (elementOrElements, eventType, handler, descriptiveKey) => { const elements = (elementOrElements instanceof NodeList || Array.isArray(elementOrElements)) ? elementOrElements : [elementOrElements]; let count = 0; elements.forEach(element => { if (element) { const handlerKey = descriptiveKey + '_' + eventType; if (element._eventHandlers?.[handlerKey]) { console.log(`[SETUP] Listener ${eventType} for ${descriptiveKey} already seems attached. Skipping.`); return; } element.addEventListener(eventType, handler); if (!element._eventHandlers) element._eventHandlers = {}; element._eventHandlers[handlerKey] = handler; count++; } }); if (count === 0 && elements.length > 0 && elements[0] !== document && elements[0] !== window) { const nonCriticalMissing = ['markAllReadBtn', 'createPlanBtnEmpty', 'startTestBtnPlan', 'startTestBtnPrompt', 'startTestBtnResults', 'startTestBtnAnalysis', 'testResultsContainer', 'testResultsLoading', 'testResultsContent', 'testResultsEmpty', 'studyPlanContainer', 'studyPlanLoading', 'studyPlanContent', 'studyPlanEmpty', 'topicAnalysisContainer', 'topicAnalysisContent', 'topicAnalysisEmpty', 'topicGrid']; if (ui && !ui[descriptiveKey] && nonCriticalMissing.includes(descriptiveKey)) { } else if (ui && !ui[descriptiveKey]) { console.warn(`[SETUP v6.2] Element not found for listener: ${descriptiveKey}.`); } } };

        safeAddListener(ui.refreshDataBtn, 'click', handleRefreshClick, 'refreshDataBtn');
        safeAddListener(ui.startTestBtnPrompt, 'click', () => window.location.href = 'test1.html', 'startTestBtnPrompt');
        safeAddListener(ui.startTestBtnResults, 'click', () => window.location.href = 'test1.html', 'startTestBtnResults');
        safeAddListener(ui.createPlanBtnEmpty, 'click', () => switchActiveTab('study-plan-tab'), 'createPlanBtnEmpty');
        safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
        safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
        safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');
        safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn');
        document.querySelectorAll('.sidebar-link').forEach(link => { safeAddListener(link, 'click', () => { if (window.innerWidth <= 992) closeMenu(); }, 'sidebarLink'); });
        safeAddListener(ui.markAllReadBtn, 'click', markAllNotificationsRead, 'markAllReadBtn');
        safeAddListener(ui.notificationBell, 'click', (event) => { event.stopPropagation(); if (ui.notificationsDropdown) { ui.notificationsDropdown.classList.toggle('active'); if (ui.notificationsDropdown.classList.contains('active') && ui.notificationsList?.innerHTML.trim() === '' && !isLoading.notifications) { if (currentUser?.id) fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT); else console.warn("[NotificationBell] Chybí currentUser.id pro načtení notifikací."); } } else { console.warn("[NotificationBell] ui.notificationsDropdown nenalezeno.");} }, 'notificationBell');

        if (ui.notificationsList) {
             const notificationClickHandler = async (event) => {
                const item = event.target.closest('.notification-item');
                if (item) {
                    const notificationId = item.dataset.id;
                    const link = item.dataset.link;
                    const isRead = item.classList.contains('is-read');
                    if (!isRead && notificationId) {
                        const success = await markNotificationRead(notificationId);
                        if (success) {
                            item.classList.add('is-read');
                            item.querySelector('.unread-dot')?.remove();
                            if (ui.notificationCount) {
                                const countText = ui.notificationCount.textContent.replace('+', '');
                                const currentCount = parseInt(countText) || 0;
                                const newCount = Math.max(0, currentCount - 1);
                                ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                                ui.notificationCount.classList.toggle('visible', newCount > 0);
                            }
                            if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = (parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0') === 0);
                        }
                    }
                    if (link) window.location.href = link;
                    if (ui.notificationsDropdown) ui.notificationsDropdown.classList.remove('active');
                }
            };
            safeAddListener(ui.notificationsList, 'click', notificationClickHandler, 'notificationsList');
        } else { console.warn("[SETUP v6.2] ui.notificationsList nenalezeno."); }

        document.removeEventListener('click', handleOutsideNotificationClick); // Ensure only one listener
        document.addEventListener('click', handleOutsideNotificationClick);
        const radioListContainer = ui.goalStep1?.querySelector('.goal-radio-list'); if (radioListContainer) { safeAddListener(radioListContainer, 'change', (event) => { if (event.target.type === 'radio' && event.target.name === 'learningGoal') { const selectedGoal = event.target.value; radioListContainer.querySelectorAll('.goal-radio-label').forEach(label => label.classList.remove('selected-goal')); event.target.closest('.goal-radio-label')?.classList.add('selected-goal'); handleInitialGoalSelection(selectedGoal); } }, 'goalRadioListContainer'); console.log("[SETUP v6.2] CHANGE listener attached to goal radio list container."); } else { console.warn("[SETUP v6.2] Goal radio list container (.goal-radio-list) not found for listener setup."); }
        const modalBackButtons = ui.goalSelectionModal ? ui.goalSelectionModal.querySelectorAll('.modal-back-btn') : []; safeAddListener(modalBackButtons, 'click', (event) => { const targetStepId = event.currentTarget.dataset.targetStep; const currentActiveStep = ui.goalSelectionModal?.querySelector('.modal-step.active'); const targetStepElement = document.getElementById(targetStepId); if(currentActiveStep) currentActiveStep.classList.remove('active'); if(targetStepElement) targetStepElement.classList.add('active'); pendingGoal = null; }, 'modalBackButtons');
        const modalConfirmButtons = ui.goalSelectionModal ? ui.goalSelectionModal.querySelectorAll('.modal-confirm-btn') : []; safeAddListener(modalConfirmButtons, 'click', (event) => { const goal = event.currentTarget.dataset.goal; if (goal === pendingGoal) { handleStep2Confirm(goal); } else if (ui.goalStep1?.classList.contains('active') && goal) { handleInitialGoalSelection(goal); } }, 'modalConfirmButtons');
		console.log("[Procvičování SETUP v6.2] Nastavení základních listenerů dokončeno.");
	}
	// --- END: Event Listeners Setup ---

	// --- START: Initialization ---
	async function initializeApp() {
		try {
			console.log(`[INIT Procvičování] App Init Start v25.0.28...`); // Version updated
			cacheDOMElements();

			if (!initializeSupabase()) { throw new Error("Supabase initialization failed."); }

			applyInitialSidebarState();
            updateCopyrightYear();
            initMouseFollower();
            initHeaderScrollDetection();
            updateOnlineStatus();
            initTooltips();
            setupEventListeners(); // Setup base listeners

			if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
			if (ui.mainContent) ui.mainContent.style.display = 'none';
			if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none';
			if (ui.tabContentContainer) ui.tabContentContainer.style.display = 'none';

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

				let goal = currentProfile.learning_goal;
				console.log(`[INIT Goal Check] Cíl z DB: ${goal}`);

				if (!goal) {
					 console.log(`[INIT Procvičování] Cíl není v DB. Zobrazuji modální okno.`);
					 showGoalSelectionModal();
					 if (ui.mainContent) ui.mainContent.style.display = 'flex';
					 if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none';
					 if (ui.tabContentContainer) ui.tabContentContainer.style.display = 'none';
				} else {
					 console.log(`[INIT Procvičování] Cíl '${goal}' již nastaven. Konfiguruji UI a načítám data...`);
					 if(ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none';
                     if(ui.tabsWrapper) { ui.tabsWrapper.style.display = 'flex'; ui.tabsWrapper.classList.add('visible'); }
                     if(ui.tabContentContainer) { ui.tabContentContainer.style.display = 'flex'; ui.tabContentContainer.classList.add('visible'); }
                     if(ui.tabContents) { ui.tabContents.forEach(el => {if (el) el.style.display='none';}); }
					 configureUIForGoal(); // Sets up UI, determines initial tab
                     await loadPageData(); // Loads data for the initial tab
				}

				 if (ui.mainContent && (!ui.goalSelectionModal || getComputedStyle(ui.goalSelectionModal).display === 'none')) {
					 ui.mainContent.style.display = 'flex';
					 requestAnimationFrame(() => { if(ui.mainContent) ui.mainContent.classList.add('loaded'); initScrollAnimations(); });
				 } else if (ui.mainContent && ui.goalSelectionModal && getComputedStyle(ui.goalSelectionModal).display !== 'none') {
					  ui.mainContent.style.display = 'flex';
				 }

                // Attach tab click listener AFTER initial setup is done
                const tabs = ui.contentTabs && ui.contentTabs.length > 0 ? ui.contentTabs : document.querySelectorAll('.content-tab');
                if (tabs.length > 0) {
                     const safeAddListener = (el, ev, fn, key) => { if (el) { if (el._eventHandlers?.[key+'_'+ev]) {el.removeEventListener(ev, el._eventHandlers[key+'_'+ev]); delete el._eventHandlers[key+'_'+ev];} el.addEventListener(ev, fn); if (!el._eventHandlers) el._eventHandlers = {}; el._eventHandlers[key+'_'+ev] = fn; } else { console.warn(`[SafeListener] Element not found for: ${key}`); }};
                    tabs.forEach(tab => {
                         safeAddListener(tab, 'click', handleTabSwitch, `tab_${tab.dataset.tab}`);
                     });
                    console.log("[INIT Procvičování] Listener pro kliknutí на záložky připojen/aktualizován.");
                } else {
                    console.warn("[INIT Procvičování] Elementy záložek nenalezeny pro připojení listeneru.");
                }

				console.log("✅ [INIT Procvičování] Nastavení specifické pro stránku dokončeno.");

			} else {
				console.log('[INIT Procvičování] Uživatel není přihlášen, přesměrování...');
				window.location.href = '/auth/index.html';
			}
		} catch (error) {
			console.error("❌ [INIT Procvičování] Kritická chyba inicializace:", error);
			if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color:var(--accent-pink);">CHYBA (${error.message}). Obnovte.</p>`; }
			else { showError(`Chyba inicializace: ${error.message}`, true); }
			if (ui.mainContent) ui.mainContent.style.display = 'flex';
			setLoadingState('all', false);
		} finally {
			const il = ui.initialLoader;
			if (il && !il.classList.contains('hidden')) {
				il.classList.add('hidden');
				setTimeout(() => { if (il) il.style.display = 'none'; }, 300);
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

})(); // End of IIFE