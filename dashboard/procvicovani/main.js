// dashboard/procvicovani/main.js
// Version: 25.0.14 - Fixed potential SyntaxError near end of file. Adjusted configureUIForGoal and loadTabData for unified tabs.
// Opravena potenciální syntaktická chyba. Upraveno configureUIForGoal a loadTabData pro sjednocené záložky.

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
    let allTitles = []; // Added for potential future title fetching
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
    let isInitialTabLoad = true; // Flag for first tab load after goal selection/page load
    // --- END: State Variables ---

    // --- START: UI Elements Cache ---
    // Cached elements will be populated in initializeApp
    const ui = {};
    // --- END: UI Elements Cache ---

    // --- START: Helper Functions ---
    const topicIcons = { "Algebra": "fa-calculator", "Geometrie": "fa-draw-polygon", "Funkce": "fa-chart-line", "Rovnice": "fa-equals", "Statistika": "fa-chart-bar", "Kombinatorika": "fa-dice-d6", "Posloupnosti": "fa-ellipsis-h", default: "fa-atom" };
    const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

    // Sanitizes HTML to prevent XSS
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }

    // Shows a toast notification
    function showToast(title, message, type = 'info', duration = 4500) {
        let container = ui.toastContainer || document.getElementById('toastContainer');
        if (!container) {
             // Attempt to create dynamically if not found initially
            try {
                console.warn("[Toast] Toast container not found by ui.toastContainer or ID, attempting to create dynamically.");
                container = document.createElement('div');
                container.id = 'toastContainer';
                container.className = 'toast-container'; // Ensure class is added
                document.body.appendChild(container);
                ui.toastContainer = container; // Cache it
            } catch (createError) {
                 console.error("[Toast] Failed to create toast container dynamically:", createError);
                 alert(`${title}: ${message}`); // Fallback to alert
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
            // Safe HTML insertion
            toastElement.innerHTML = `
                <i class="toast-icon"></i>
                <div class="toast-content">
                    ${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}
                    <div class="toast-message">${sanitizeHTML(message)}</div>
                </div>
                <button type="button" class="toast-close" aria-label="Zavřít">&times;</button>
            `;
            // Set icon class
            const icon = toastElement.querySelector('.toast-icon');
            icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`;
            // Add close listener
            toastElement.querySelector('.toast-close').addEventListener('click', () => {
                toastElement.classList.remove('show');
                setTimeout(() => toastElement.remove(), 400); // Remove after fade out
            });
            // Append and show
            container.appendChild(toastElement);
            requestAnimationFrame(() => { toastElement.classList.add('show'); }); // Trigger animation
            // Set timeout for removal
            setTimeout(() => {
                if (toastElement.parentElement) { // Check if still in DOM
                    toastElement.classList.remove('show');
                    setTimeout(() => toastElement.remove(), 400); // Remove after fade out
                }
            }, duration);
        } catch (e) {
            console.error("[Toast] Error showing toast (after potential container creation):", e);
        }
    }

    // Shows an error message (global or toast)
    function showError(message, isGlobal = false) {
        console.error("[Error Handler] Error occurred:", message);
        if (isGlobal && ui.globalError) {
             ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Obnovit</button></div>`;
             ui.globalError.style.display = 'block';
        } else {
            showToast('CHYBA SYSTÉMU', message, 'error', 6000);
        }
    }
    // Hides the global error message
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    // Gets user initials for avatar fallback
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || 'P'; /* Pilot */ }
    // Formats a date string
    function formatDate(dateString) { try { return dateString ? new Date(dateString).toLocaleDateString('cs-CZ') : '-'; } catch (e) { return '-'; } }
    // Formats seconds into MM:SS
    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return '--:--'; const m = Math.floor(seconds / 60); const ss = Math.round(seconds % 60); return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`; }
    // Formats timestamp into relative time string
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    // Opens the mobile sidebar
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    // Closes the mobile sidebar
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    // Updates the copyright year
    function updateCopyrightYear() { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
    // Applies the initial sidebar state (collapsed/expanded) from localStorage
    function applyInitialSidebarState() { try { const state = localStorage.getItem(SIDEBAR_STATE_KEY); const collapsed = state === 'collapsed'; document.body.classList.toggle('sidebar-collapsed', collapsed); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) icon.className = collapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; if(ui.sidebarToggleBtn) ui.sidebarToggleBtn.title = collapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (e) { console.error("Sidebar state error:", e); } }
    // Toggles the sidebar state and saves to localStorage
    function toggleSidebar() { try { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; if(ui.sidebarToggleBtn) ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (error) { console.error("[Sidebar Toggle] Error:", error); } }
    // Initializes Tooltipster tooltips
    function initTooltips() { try { if (window.jQuery?.fn.tooltipster) { /* Remove old instances first */ window.jQuery('.btn-tooltip.tooltipstered').each(function() { try { window.jQuery(this).tooltipster('destroy'); } catch (e) { /* ignore */ } }); /* Initialize new ones */ window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } }
    // Placeholder for scroll animations
    function initScrollAnimations() { console.log("[Procvičování UI Placeholder] initScrollAnimations called."); /* Implementation needed if animations are used */ }
    // Placeholder for header scroll detection
    function initHeaderScrollDetection() { console.log("[Procvičování UI Placeholder] initHeaderScrollDetection called."); /* Implementation needed */ }
    // Placeholder for online status update
    function updateOnlineStatus() { console.log("[Procvičování UI Placeholder] updateOnlineStatus called."); /* Implementation needed */ }
    // Placeholder for mouse follower effect
    function initMouseFollower() { console.log("[Procvičování UI Placeholder] initMouseFollower called."); /* Implementation needed */ }
    // --- END: Helper Functions ---

    // --- START: Skeleton Rendering Functions ---
    function renderStatsSkeletons(container) { if (!container) { console.warn("[Skeletons] Stats container not found."); return; } container.innerHTML = ''; for (let i = 0; i < 4; i++) { container.innerHTML += ` <div class="dashboard-card card loading"> <div class="loading-skeleton"> <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 1rem;"></div> <div class="skeleton" style="height: 35px; width: 40%; margin-bottom: 0.8rem;"></div> <div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 1.5rem;"></div> <div class="skeleton" style="height: 14px; width: 50%;"></div> </div> </div>`; } container.classList.add('loading');}
    function renderTestSkeletons(container) { if (!container) { console.warn("[Skeletons] Test results content container not found."); return; } container.innerHTML = `<div class="test-stats loading"><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton value"></div><div class="skeleton text"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton value"></div><div class="skeleton text"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton value"></div><div class="skeleton text"></div></div></div></div></div><div class="chart-container loading"><div class="skeleton" style="height: 350px; width: 100%;"></div></div><div class="last-test-result card loading"><div class="loading-skeleton"><div class="skeleton title"></div><div class="skeleton text"></div></div></div><div class="test-list loading"><div class="skeleton" style="height: 70px; width: 100%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 70px; width: 100%;"></div></div>`;}
    function renderPlanSkeletons(container) { const scheduleGrid = ui.mainPlanSchedule; if (!container || !scheduleGrid) { console.warn("[Skeletons] Study plan content or schedule grid not found."); return; } scheduleGrid.innerHTML = `<div class="schedule-grid loading"><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 40%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 50%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 45%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div></div>`;}
    function renderTopicSkeletons(container) { const topicGrid = ui.topicGrid; if (!container || !topicGrid) { console.warn("[Skeletons] Topic analysis content or topic grid not found."); return; } topicGrid.innerHTML = `<div class="topic-grid loading"><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div></div>`;}
    function renderShortcutSkeletons(container) { if (!container) { console.warn("[Skeletons] Shortcuts grid container not found."); return; } container.innerHTML = ''; for(let i = 0; i < 3; i++) { container.innerHTML += `<div class="shortcut-card card loading"><div class="loading-skeleton" style="align-items: center; padding: 1.8rem;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 16px; margin-bottom: 1.2rem;"></div><div class="skeleton" style="height: 18px; width: 70%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.4rem;"></div><div class="skeleton" style="height: 14px; width: 80%;"></div></div></div>`; } container.classList.add('loading');}
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) {console.warn("[Skeletons] Notifications list or no-message element not found."); return;} let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton"></div><div class="notification-content"><div class="skeleton" style="height:16px;width:70%;margin-bottom:6px;"></div><div class="skeleton" style="height:12px;width:90%;"></div><div class="skeleton" style="height:10px;width:40%;margin-top:6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    // --- END: Skeleton Rendering Functions ---

    // --- START: Loading State Management ---
    function setLoadingState(sectionKey, isLoadingFlag) {
        if (!isLoading || typeof isLoading[sectionKey] === 'undefined' && sectionKey !== 'all') {
            console.warn(`[Procvičování UI Loading v6.2] Neznámý klíč sekce '${sectionKey}' nebo objekt isLoading není inicializován.`);
            return;
        }
        if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;

        // Update state for the specific key or all keys
        if (sectionKey === 'all') {
            Object.keys(isLoading).forEach(key => { isLoading[key] = isLoadingFlag; });
        } else {
            isLoading[sectionKey] = isLoadingFlag;
        }
        console.log(`[Procvičování UI Loading v6.2] Section: ${sectionKey}, isLoading: ${isLoadingFlag}`);

        // Map section keys to relevant UI elements and skeleton functions
        const sectionMap = {
            stats: { container: ui.statsCards, skeletonFn: renderStatsSkeletons },
            tests: { container: ui.testResultsContainer, content: ui.testResultsContent, empty: ui.testResultsEmpty, loader: ui.testResultsLoading, skeletonFn: renderTestSkeletons },
            plan: { container: ui.studyPlanContainer, content: ui.studyPlanContent, empty: ui.studyPlanEmpty, loader: ui.studyPlanLoading, skeletonFn: renderPlanSkeletons },
            topics: { container: ui.topicAnalysisContainer, content: ui.topicAnalysisContent, empty: ui.topicAnalysisEmpty, loader: ui.topicAnalysisLoading, skeletonFn: renderTopicSkeletons },
            shortcuts: { container: ui.shortcutsGrid, skeletonFn: renderShortcutSkeletons },
            notifications: { skeletonFn: renderNotificationSkeletons }, // No specific container, just uses list
            goalSelection: { }, // No specific UI elements to toggle loading state directly
            all: { } // Handled by iterating through keys
        };

        const updateSingleSectionUI = (key, loading) => {
            const config = sectionMap[key];
            if (!config) {
                if(key !== 'all' && key !== 'goalSelection') console.warn(`[Procvičování UI Loading v6.2] Unknown section key '${key}' for UI update.`);
                return;
            }
            const { container, content, empty, loader, skeletonFn } = config;

            if (loader) loader.style.display = loading ? 'flex' : 'none';
            if (container) container.classList.toggle('loading', loading);

            if (loading) {
                // Hide actual content and empty states
                if (content) content.style.display = 'none';
                if (empty) empty.style.display = 'none';
                // Render skeletons if a function exists
                if (skeletonFn && typeof skeletonFn === 'function') {
                    let targetContainer;
                     // Determine where to render skeletons
                    if (key === 'notifications') targetContainer = ui.notificationsList;
                    else targetContainer = (key === 'stats' || key === 'shortcuts') ? container : content;

                    if (targetContainer) {
                        skeletonFn(targetContainer); // Render skeletons into the target
                    } else {
                        console.warn(`[Procvičování UI Loading v6.2] Target container for skeletons not found for key '${key}'.`);
                    }
                } else if (skeletonFn) {
                    console.warn(`[Procvičování UI Loading v6.2] skeletonFn for key '${key}' is not a function.`);
                }
            } else {
                // Stop loading: Clear skeletons AFTER a tiny delay to allow content rendering
                setTimeout(() => {
                    const skeletonSelector = '.loading-skeleton, .dashboard-card.loading > .loading-skeleton, .card.loading > .loading-skeleton, .notification-item.skeleton';

                    // Function to remove skeletons from an element
                    const clearSkeletons = (el) => {
                        el?.querySelectorAll(skeletonSelector).forEach(skel => skel.remove());
                        el?.classList.remove('loading');
                        el?.parentElement?.classList.remove('loading'); // Also remove from direct parent if needed
                    };

                    // Clear skeletons from the appropriate container
                    if (key === 'notifications' && ui.notificationsList) {
                        clearSkeletons(ui.notificationsList);
                    } else if (content) { // For sections with content/empty states
                        clearSkeletons(content);
                        // NOTE: The display of content vs. empty is handled by the rendering functions (renderTestResults, etc.)
                    } else if (container && (key === 'stats' || key === 'shortcuts')) { // For sections rendering directly into container
                        clearSkeletons(container);
                    }
                }, 50); // Short delay
            }
        };

        // Update UI based on the sectionKey
        if (sectionKey === 'all') {
            Object.keys(isLoading).forEach(key => {
                if (key !== 'all' && key !== 'goalSelection') { // Skip meta keys
                    updateSingleSectionUI(key, isLoadingFlag);
                }
            });
        } else {
            updateSingleSectionUI(sectionKey, isLoadingFlag);
        }
    }
    // --- END: Loading State Management ---

    // --- START: UI Update Functions ---
    // Updates the user info in the sidebar
    function updateSidebarProfile(profile, titlesData) {
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) {
            console.warn("[UI Sidebar] Skipping profile update - elements not found.");
            return;
        }
        if (profile) {
            const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || currentUser?.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(profile);
            const avatarUrl = profile.avatar_url;
            let finalAvatarUrl = avatarUrl;
            // Avoid adding timestamp to local assets/placeholders
            if (avatarUrl && !avatarUrl.startsWith('http') && avatarUrl.includes('/')) {
                 finalAvatarUrl = sanitizeHTML(avatarUrl); // Assume local path is fine as is
            } else if (avatarUrl) {
                finalAvatarUrl = `${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`; // Add timestamp to external URLs
            }
            ui.sidebarAvatar.innerHTML = finalAvatarUrl ? `<img src="${finalAvatarUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
            // Add onerror handler for the image
            const img = ui.sidebarAvatar.querySelector('img');
            if (img) {
                img.onerror = function() {
                    console.warn(`[UI Sidebar] Failed to load avatar: ${this.src}. Displaying initials.`);
                    ui.sidebarAvatar.innerHTML = sanitizeHTML(initials);
                };
            }
            // Determine display title
            const selectedTitleKey = profile.selected_title;
            let displayTitle = 'Pilot'; // Default
            if (selectedTitleKey && titlesData && titlesData.length > 0) {
                const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) {
                    displayTitle = foundTitle.name;
                } else {
                     console.warn(`[UI Sidebar] Title key "${selectedTitleKey}" not found in loaded titles.`);
                 }
            } else if (selectedTitleKey) {
                 console.warn(`[UI Sidebar] Title key present but titles list is empty or not loaded.`);
            }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle));
        } else {
            // Logged out state
            ui.sidebarName.textContent = "Nepřihlášen";
            ui.sidebarAvatar.textContent = '?';
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot';
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title');
        }
    }

    // Renders the stats cards (using placeholder content for now)
    function renderStatsCards(stats) {
        console.log("[Render UI Stub] renderStatsCards called with stats:", stats);
        if (!ui.statsCards) {
            console.error("Stats cards container (ui.statsCards) not found!");
            setLoadingState('stats', false);
            return;
        }
        // Placeholder implementation - replace with actual rendering
        ui.statsCards.innerHTML = `
            <div class="dashboard-card card" data-animate style="--animation-order: 1;">
                <div class="card-header">
                    <div class="card-title">Body</div>
                    <span class="card-badge info">Celkem</span>
                </div>
                <div class="card-content">
                    <div class="card-value">${stats?.totalPoints || 0}</div>
                    <p class="card-description">Nasbírané body za aktivity.</p>
                </div>
            </div>
             <div class="dashboard-card card" data-animate style="--animation-order: 2;">
                <div class="card-header">
                    <div class="card-title">Dokončená Cvičení</div>
                     <span class="card-badge success">${stats?.completedExercisesToday || 0} dnes</span>
                </div>
                <div class="card-content">
                    <div class="card-value">${stats?.completedExercises || 0}</div>
                    <p class="card-description">Celkový počet dokončených cvičení.</p>
                </div>
            </div>
             <div class="dashboard-card card" data-animate style="--animation-order: 3;">
                <div class="card-header">
                    <div class="card-title">Denní Série</div>
                     <span class="card-badge warning">${stats?.streakRecord || 0} rekord</span>
                </div>
                <div class="card-content">
                    <div class="card-value">${stats?.activeStreak || 0} ${stats?.activeStreak === 1 ? 'den' : 'dní'}</div>
                    <p class="card-description">Počet dní studia v řadě.</p>
                </div>
            </div>
             <div class="dashboard-card card" data-animate style="--animation-order: 4;">
                <div class="card-header">
                    <div class="card-title">Poslední Test</div>
                    ${stats?.lastTestDate ? `<span class="card-badge">${formatDate(stats.lastTestDate)}</span>` : '<span class="card-badge">Žádný</span>'}
                </div>
                <div class="card-content">
                    <div class="card-value">${stats?.lastTestScore !== null ? `${stats.lastTestScore}/50` : '--'}</div>
                    <p class="card-description">Skóre posledního diagnostického testu.</p>
                </div>
            </div>
        `;
        ui.statsCards.classList.remove('loading');
        ui.statsCards.style.display = 'grid'; // Ensure grid display
        setLoadingState('stats', false);
        initScrollAnimations(); // Re-initialize animations for new content
    }

    // Renders test results (placeholder)
    function renderTestResults(results, goal) {
        console.log("[Render UI Stub] renderTestResults called.");
        if (!ui.testResultsContainer || !ui.testResultsContent || !ui.testResultsEmpty) {
            console.error("Test results UI elements missing!");
            setLoadingState('tests', false);
            return;
        }
        // Clear previous content before rendering or showing empty state
        ui.testResultsContent.innerHTML = '';
        ui.testResultsContent.style.display = 'none';
        ui.testResultsEmpty.style.display = 'none';

        if (results && results.length > 0) {
            // Placeholder: Display a summary or list
            ui.testResultsContent.innerHTML = `
                <div class="test-summary card">
                    <h4>Poslední test (${formatDate(results[0].completed_at)})</h4>
                    <p>Skóre: ${results[0].total_score}/50</p>
                    <a href="test1.html" class="btn btn-secondary btn-sm">Zobrazit Detail</a>
                </div>
                <p style="margin-top: 1rem; text-align: center;"><a href="#" class="text-link">Zobrazit všechny výsledky (připravuje se)</a></p>
            `;
            ui.testResultsContent.style.display = 'block'; // Show content
        } else {
            ui.testResultsEmpty.style.display = 'flex'; // Show empty state using flex
        }
        ui.testResultsContainer.classList.remove('loading');
        setLoadingState('tests', false);
    }

    // Renders study plan overview (placeholder)
    function renderStudyPlanOverview(plan, activities, goal) {
        console.log("[Render UI Stub] renderStudyPlanOverview called.");
        if (!ui.studyPlanContainer || !ui.studyPlanContent || !ui.studyPlanEmpty) {
            console.error("Study plan UI elements missing!");
            setLoadingState('plan', false);
            return;
        }
         // Clear previous content
         ui.studyPlanContent.innerHTML = '';
         ui.studyPlanContent.style.display = 'none';
         ui.studyPlanEmpty.style.display = 'none';

        if (plan) {
            // Placeholder: Display plan info
            ui.studyPlanContent.innerHTML = `
                <div class="plan-summary card">
                    <h4>${plan.title || 'Aktivní plán'}</h4>
                    <p>Stav: ${plan.status === 'active' ? 'Aktivní' : 'Neaktivní/Dokončený'}</p>
                    <p>Pokrok: ${plan.progress || 0}%</p>
                    <a href="plan.html" class="btn btn-primary btn-sm">Otevřít plán</a>
                </div>
                 <div id="main-plan-schedule" class="schedule-grid" style="margin-top: 1.5rem;">
                    <p>Týdenní přehled se načte v detailu plánu.</p>
                 </div>
            `;
            ui.studyPlanContent.style.display = 'block'; // Show content
        } else {
            ui.studyPlanEmpty.style.display = 'flex'; // Show empty state
        }
        ui.studyPlanContainer.classList.remove('loading');
        setLoadingState('plan', false);
    }

    // Renders topic analysis (placeholder)
    function renderTopicAnalysis(topics, goal) {
        console.log("[Render UI Stub] renderTopicAnalysis called.");
        if (!ui.topicAnalysisContainer || !ui.topicAnalysisContent || !ui.topicAnalysisEmpty || !ui.topicGrid) {
            console.error("Topic analysis UI elements missing!");
            setLoadingState('topics', false);
            return;
        }
        // Clear previous content
        ui.topicGrid.innerHTML = '';
        ui.topicAnalysisContent.style.display = 'none';
        ui.topicAnalysisEmpty.style.display = 'none';


        if (topics && topics.length > 0) {
            // Placeholder: Display list of topics
             ui.topicGrid.innerHTML = topics.map(t => `
                 <div class="topic-card card data-animate" style="--animation-order: ${topics.indexOf(t)};">
                     <div class="topic-header">
                        <div class="topic-icon"><i class="fas ${topicIcons[t.name] || topicIcons.default}"></i></div>
                        <h3 class="topic-title">${sanitizeHTML(t.name || 'Neznámé téma')}</h3>
                     </div>
                     <div class="topic-stats">
                         <div class="topic-progress">
                            <span class="topic-progress-label">Pokrok</span>
                            <span class="topic-progress-value">${t.progress || 0}%</span>
                         </div>
                         <div class="topic-progress-bar">
                            <div class="topic-progress-fill" style="width: ${t.progress || 0}%;"></div>
                         </div>
                         <small class="topic-last-practiced">Naposledy: ${t.last_practiced ? formatDate(t.last_practiced) : 'Nikdy'}</small>
                     </div>
                     <a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="showToast('Info','Detail tématu se připravuje.','info'); return false;">Detail</a>
                 </div>
             `).join('');
            ui.topicAnalysisContent.style.display = 'block'; // Show content
            ui.topicGrid.style.display = 'grid'; // Ensure grid display
            initScrollAnimations(); // Re-init animations
        } else {
            ui.topicAnalysisEmpty.style.display = 'flex'; // Show empty state
        }
        ui.topicAnalysisContainer.classList.remove('loading');
        setLoadingState('topics', false);
    }

    // Renders shortcut cards based on the user's goal
    function renderShortcutsForGoal(goal, container) {
        if (!container) {
            console.warn("[Shortcuts] Shortcut container (ui.shortcutsGrid) not found.");
            setLoadingState('shortcuts', false);
            return;
        }
        setLoadingState('shortcuts', true); // Start loading state
        container.innerHTML = ''; // Clear existing shortcuts/skeletons
        console.log(`[Shortcuts] Rendering for goal: ${goal}`);

        let shortcutsHTML = '';
        // Define all possible shortcuts
        const shortcuts = {
            test: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-graduation-cap"></i></div><h3 class="shortcut-title">Diagnostický Test</h3><p class="shortcut-desc">Ověřte své znalosti.</p><a href="test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Test</a></div>`,
            plan: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-tasks"></i></div><h3 class="shortcut-title">Studijní Plán</h3><p class="shortcut-desc">Zobrazte personalizovaný plán.</p><a href="plan.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Zobrazit Plán</a></div>`,
            tutor: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-book-open"></i></div><h3 class="shortcut-title">AI Tutor (Lekce)</h3><p class="shortcut-desc">Vysvětlení témat z plánu.</p><a href="vyuka/vyuka.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit Výuku</a></div>`,
            nextTopic: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-forward"></i></div><h3 class="shortcut-title">Další Téma Osnovy</h3><p class="shortcut-desc">Pokračujte v osnově.</p><a href="vyuka/vyuka.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Učit se Další</a></div>`,
            curriculum: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-stream"></i></div><h3 class="shortcut-title">Přehled Osnovy</h3><p class="shortcut-desc">Zobrazte přehled témat.</p><a href="plan.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Osnovu</a></div>`,
            weakness: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-search"></i></div><h3 class="shortcut-title">Moje Slabiny</h3><p class="shortcut-desc">Témata k zlepšení.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="switchActiveTab('topic-analysis-tab'); return false;">Analýza Témat</a></div>`,
            review: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-history"></i></div><h3 class="shortcut-title">Opakování</h3><p class="shortcut-desc">Procvičte si starší témata.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="showToast('Info','Funkce opakování se připravuje.','info'); return false;">Spustit Opakování</a></div>`,
            explore: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-compass"></i></div><h3 class="shortcut-title">Procházet Témata</h3><p class="shortcut-desc">Vyberte si téma k učení.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top: auto;" onclick="switchActiveTab('topic-analysis-tab'); return false;">Vybrat Téma</a></div>`,
            random: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-dumbbell"></i></div><h3 class="shortcut-title">Náhodné Cvičení</h3><p class="shortcut-desc">Rychlé procvičení.</p><a href="#" class="btn btn-secondary btn-sm" style="margin-top: auto;" onclick="showToast('Info','Funkce náhodného cvičení se připravuje.','info'); return false;">Náhodné Cvičení</a></div>`,
            progress: `<div class="shortcut-card card" data-animate><div class="shortcut-icon"><i class="fas fa-chart-line"></i></div><h3 class="shortcut-title">Můj Pokrok</h3><p class="shortcut-desc">Sledujte své zlepšení.</p><a href="../pokrok.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Zobrazit Pokrok</a></div>` // Corrected path
        };

        // Determine which shortcuts to show based on the goal
        switch (goal) {
            case 'exam_prep':       shortcutsHTML = shortcuts.test + shortcuts.plan + shortcuts.tutor; break;
            case 'math_accelerate': shortcutsHTML = shortcuts.nextTopic + shortcuts.curriculum + shortcuts.tutor; break;
            case 'math_review':     shortcutsHTML = shortcuts.weakness + shortcuts.review + shortcuts.tutor; break;
            case 'math_explore':    shortcutsHTML = shortcuts.explore + shortcuts.random + shortcuts.tutor; break;
            default:                shortcutsHTML = shortcuts.progress + shortcuts.tutor + shortcuts.random; // Fallback
        }

        // Use requestAnimationFrame to ensure rendering happens after state update
        requestAnimationFrame(() => {
            if(container) {
                container.innerHTML = shortcutsHTML;
                // Add animation properties after inserting content
                container.querySelectorAll('.shortcut-card').forEach((card, index) => {
                     card.style.setProperty('--animation-order', index + 7); // Start animation after stats cards
                });
                container.classList.remove('loading');
                container.style.display = 'grid'; // Ensure grid display
                setLoadingState('shortcuts', false); // Stop loading state
                 if (typeof initScrollAnimations === 'function') initScrollAnimations(); // Re-initialize animations
                 if (typeof initTooltips === 'function') initTooltips(); // Re-initialize tooltips for new buttons
            }
        });
    }
    // --- END: UI Update Functions ---

    // --- START: Data Fetching Stubs ---
    // These functions simulate fetching data. Replace with actual Supabase calls.
    async function fetchDashboardStats(userId, profileData) {
        console.log("[Fetch Data Stub] fetchDashboardStats called.");
        setLoadingState('stats', true);
        await new Promise(resolve => setTimeout(resolve, 700)); // Simulate network delay
        // Use diagnosticResultsData from the outer scope if available
        const lastTest = diagnosticResultsData?.length > 0 ? diagnosticResultsData[0] : null;
        const stats = {
            totalPoints: profileData?.points || 0,
            completedExercises: profileData?.completed_exercises || 0,
            activeStreak: profileData?.streak_days || 0,
            streakRecord: profileData?.streak_record || 0, // Assuming streak_record exists
            completedExercisesToday: profileData?.exercises_today || 0, // Assuming exercises_today exists
            lastTestScore: lastTest?.total_score ?? null,
            lastTestDate: lastTest?.completed_at ?? null
        };
        // setLoadingState('stats', false); // State is set in renderStatsCards
        return stats;
    }
    async function fetchDiagnosticResults(userId, goal) {
        console.log("[Fetch Data Stub] fetchDiagnosticResults called.");
         setLoadingState('tests', true);
        await new Promise(resolve => setTimeout(resolve, 1000));
         // setLoadingState('tests', false); // State is set in renderTestResults
        return []; // Simulate no test results for now
    }
    async function fetchActiveStudyPlan(userId, goal) {
        console.log("[Fetch Data Stub] fetchActiveStudyPlan called.");
        setLoadingState('plan', true);
        await new Promise(resolve => setTimeout(resolve, 800));
        // setLoadingState('plan', false); // State is set in renderStudyPlanOverview
        return null; // Simulate no active plan for now
    }
    async function fetchPlanActivities(planId, goal) {
        console.log("[Fetch Data Stub] fetchPlanActivities called.");
        // No separate loading state for activities, handled by plan loading
        await new Promise(resolve => setTimeout(resolve, 500));
        return []; // Simulate no activities
    }
    async function fetchTopicProgress(userId, goal) {
        console.log("[Fetch Data Stub] fetchTopicProgress called.");
        setLoadingState('topics', true);
        await new Promise(resolve => setTimeout(resolve, 900));
        // setLoadingState('topics', false); // State is set in renderTopicAnalysis
        // Simulate some topic data
        return [
            { id: 'algebra', name: 'Algebra', progress: 0, last_practiced: null, strength: 'neutral' },
            { id: 'geometry', name: 'Geometrie', progress: 0, last_practiced: null, strength: 'neutral' },
            { id: 'functions', name: 'Funkce', progress: 0, last_practiced: null, strength: 'neutral' }
        ];
    }
    // --- END: Data Fetching Stubs ---

    // --- START: Notification Stubs ---
    async function fetchNotifications(userId, limit) {
        console.log(`[Notifications Stub] fetchNotifications called for user ${userId}, limit ${limit}.`);
        setLoadingState('notifications', true); // Start loading state
        await new Promise(resolve => setTimeout(resolve, 600)); // Simulate delay
        const fakeNotifications = []; // Simulate no notifications
        // Call render function here (it will handle the empty state)
        renderNotifications(0, fakeNotifications);
        setLoadingState('notifications', false); // Stop loading state
        return { unreadCount: 0, notifications: fakeNotifications };
    }
    function renderNotifications(count, notifications) {
        console.log(`[Notifications Stub] renderNotifications called with count ${count}.`);
        if (!ui.notificationBell || !ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
             console.error("[Notifications Stub] UI elements missing for notifications.");
             return;
        }
        // Update badge
        ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
        ui.notificationCount.classList.toggle('visible', count > 0);

        // Update list content
        if (notifications?.length > 0) {
            ui.notificationsList.innerHTML = notifications.map(n => {
                 // Use activityVisuals to get icon and class
                 const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default;
                 const isReadClass = n.is_read ? 'is-read' : '';
                 const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; // Add link attribute if exists

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
            ui.notificationsList.innerHTML = ''; // Clear list
            ui.noNotificationsMsg.style.display = 'block'; // Show empty message
            ui.notificationsList.style.display = 'none'; // Hide list container
        }
        // Update "Mark all read" button state
        ui.markAllReadBtn.disabled = count === 0;
    }
    async function markNotificationRead(notificationId) {
        console.log(`[Notifications Stub] markNotificationRead for ID ${notificationId}.`);
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate DB update
        // In a real app, update the specific item's UI here or re-fetch
        return true; // Simulate success
    }
    async function markAllNotificationsRead() {
        console.log(`[Notifications Stub] markAllNotificationsRead.`);
        setLoadingState('notifications', true);
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate DB update
        renderNotifications(0, []); // Re-render with empty state
        setLoadingState('notifications', false);
        showToast('Oznámení vymazána.', 'success');
    }
    // --- END: Notification Stubs ---

    // --- START: Goal Selection Logic (Copied from v25.0.12) ---
    function checkUserGoalAndDiagnostic() {
        console.log("[Goal Check v25.0.11] Checking user goal and diagnostic status...");
        try {
            if (!currentProfile || !currentProfile.learning_goal) {
                 // Hide prompt if goal is missing (modal should handle this)
                if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none';
                console.log("[Goal Check v25.0.11] No profile or learning_goal. Modal should be shown elsewhere.");
                return; // Don't show prompt if no goal is set yet
            }
            const goal = currentProfile.learning_goal;
            console.log(`[Goal Check v25.0.11] User goal: ${goal}`);
            if (!ui.diagnosticPrompt) {
                 console.warn("[Goal Check v25.0.11] ui.diagnosticPrompt not found, cannot display diagnostic messages.");
                 return;
            }
            // Only show diagnostic prompt for 'exam_prep' goal
            if (goal === 'exam_prep') {
                 console.log("[Goal Check v25.0.11] Goal is exam_prep. Using existing diagnosticResultsData.");
                // Check if diagnostic results are loaded and exist
                if (diagnosticResultsData && diagnosticResultsData.length > 0) {
                    const latestResult = diagnosticResultsData[0];
                    const score = latestResult.total_score ?? 0;
                    console.log(`[Goal Check v25.0.11] Latest diagnostic score: ${score}`);
                    // Example: Show warning for low score
                     if (score < 20) { // Adjust threshold as needed
                         ui.diagnosticPrompt.innerHTML = `
                             <i class="fas fa-exclamation-triangle" style="color: var(--accent-orange);"></i>
                             <p>Vaše skóre v posledním diagnostickém testu (${score}/50) bylo nízké. Pro optimální přípravu doporučujeme absolvovat test znovu nebo se zaměřit na slabší oblasti.</p>
                             <a href="test1.html" class="btn btn-primary" id="start-test-btn-prompt-lowscore"><i class="fas fa-play"></i> Opakovat test</a>`;
                         ui.diagnosticPrompt.style.display = 'flex';
                     } else {
                         // Good score, hide the prompt
                         ui.diagnosticPrompt.style.display = 'none';
                         console.log("[Goal Check v25.0.11] Diagnostic score good.");
                     }
                } else {
                    // No diagnostic results found, prompt user to take the test
                    ui.diagnosticPrompt.innerHTML = `
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Pro odemčení personalizovaného obsahu a studijního plánu je potřeba absolvovat <strong>diagnostický test</strong>.</p>
                        <a href="test1.html" class="btn btn-primary" id="start-test-btn-prompt"><i class="fas fa-play"></i> Spustit test</a>`;
                    ui.diagnosticPrompt.style.display = 'flex';
                    console.log("[Goal Check v25.0.11] No diagnostic results for exam_prep.");
                }
            } else {
                 // For other goals, hide the diagnostic prompt
                ui.diagnosticPrompt.style.display = 'none';
                console.log("[Goal Check v25.0.11] Goal not exam_prep, hiding diagnostic prompt.");
            }
        } catch (error) {
             console.error("[Goal Check v25.0.11] Error:", error);
             if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none'; // Hide on error
        }
    }

    function showGoalSelectionModal() {
         if (!ui.goalSelectionModal || !ui.goalStep1) {
             console.error("[GoalModal v5.2] Critical modal elements missing. Attempting re-cache.");
             cacheDOMElements(); // Try caching again
             if (!ui.goalSelectionModal || !ui.goalStep1) {
                 showError("Chyba zobrazení výběru cíle (chybí #goal-selection-modal nebo #goal-step-1).", true);
                 return;
             }
         }
         console.log("[GoalModal v5.2] Showing goal selection modal.");
         // Reset all steps
         ui.goalSelectionModal.querySelectorAll('.modal-step').forEach(step => {
             step.classList.remove('active');
             // Reset inputs within the step
             step.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => input.checked = false);
         });
         // Show step 1
         ui.goalStep1.classList.add('active');
         // Display the modal
         ui.goalSelectionModal.style.display = 'flex';
         document.body.classList.add('modal-open'); // Prevent background scroll
         // Trigger animation
         requestAnimationFrame(() => ui.goalSelectionModal.classList.add('active'));
          // Ensure goal option cards are cached and listeners attached
          if (!ui.goalOptionCards || ui.goalOptionCards.length === 0) {
               console.error("[GoalModal v5.2] No goal option cards found (.goal-option-card)!");
               return;
          }
          ui.goalOptionCards.forEach(button => {
               const goal = button.dataset.goal;
               if (!goal) {
                   console.warn("[GoalModal v5.2] Goal option card missing data-goal attribute.");
                   return; // Skip this card if goal is missing
               }
                // Remove old listener if it exists (using stored reference)
                if (button._goalHandler) {
                     button.removeEventListener('click', button._goalHandler);
                }
                // Define new handler
                const newHandler = () => handleInitialGoalSelection(goal);
                // Add new listener
                button.addEventListener('click', newHandler);
                // Store reference to the new handler on the element
                button._goalHandler = newHandler;
          });
           console.log("[GoalModal v5.2] Listeners attached to goal option cards.");
     }

    function hideGoalSelectionModal() {
        if (!ui.goalSelectionModal) return;
        ui.goalSelectionModal.classList.remove('active');
        document.body.classList.remove('modal-open'); // Re-enable background scroll
        // Wait for fade-out animation before setting display: none
        setTimeout(() => {
             if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none';
         }, 300); // Match CSS transition duration
    }

    function handleInitialGoalSelection(selectedGoal) {
         if (goalSelectionInProgress) return; // Prevent double clicks
         console.log(`[GoalModal v5.2] Initial goal selected: ${selectedGoal}`);
         pendingGoal = selectedGoal; // Store the selected goal temporarily

         // Decide next step or save directly
         if (selectedGoal === 'exam_prep' || selectedGoal === 'math_explore') {
             // Save immediately for these goals
             saveGoalAndProceed(selectedGoal);
         } else {
             // Show step 2 for other goals
             showStep2(selectedGoal);
         }
     }

    function showStep2(goalType) {
         const step2Id = `goal-step-${goalType.replace('math_', '')}`; // e.g., 'goal-step-accelerate'
         const step2Element = document.getElementById(step2Id);

         if (!ui.goalSelectionModal || !ui.goalStep1 || !step2Element) {
             console.error(`[GoalModal v5.2] Cannot show step 2 for ${goalType}: Missing critical elements (#goalSelectionModal, #goalStep1, or #${step2Id}).`);
             showError("Chyba zobrazení kroku 2.", true);
             return;
         }

         console.log(`[GoalModal v5.2] Showing step 2: #${step2Id}`);
         // Hide other steps, show step 2
         ui.goalSelectionModal.querySelectorAll('.modal-step').forEach(step => step.classList.remove('active'));
         step2Element.classList.add('active');

          // Add/Update Back Button Listener
         const backBtn = step2Element.querySelector('.modal-back-btn');
         if (backBtn) {
              // Remove previous listener if exists
              const oldHandler = backBtn._backHandler;
              if (oldHandler) backBtn.removeEventListener('click', oldHandler);
              // Define new handler
              const newHandler = () => handleBackToStep1(ui.goalStep1, step2Element);
              // Add new listener
              backBtn.addEventListener('click', newHandler);
              // Store reference
              backBtn._backHandler = newHandler;
         }

         // Add/Update Confirm Button Listener
         const confirmBtn = step2Element.querySelector('.modal-confirm-btn');
         if (confirmBtn) {
             // Remove previous listener if exists
             const oldHandler = confirmBtn._confirmHandler;
             if (oldHandler) confirmBtn.removeEventListener('click', oldHandler);
             // Define new handler
             const newHandler = () => handleStep2Confirm(goalType);
             // Add new listener
             confirmBtn.addEventListener('click', newHandler);
             // Store reference
             confirmBtn._confirmHandler = newHandler;
             // Reset button state
             confirmBtn.disabled = false;
             confirmBtn.innerHTML = 'Potvrdit a pokračovat';
         }
     }

    function handleBackToStep1(step1Element, currentStep2Element) {
        console.log("[GoalModal v5.2] Back to step 1...");
        if(currentStep2Element) currentStep2Element.classList.remove('active');
        if(step1Element) step1Element.classList.add('active');
        pendingGoal = null; // Clear pending goal if user goes back
    }

    function handleStep2Confirm(goalType) {
         if (goalSelectionInProgress) return; // Prevent double submission

         const step2Id = `goal-step-${goalType.replace('math_', '')}`;
         const step2Element = document.getElementById(step2Id);
         if (!step2Element) {
              console.error(`[GoalModal v5.2] Step 2 element ${step2Id} not found.`);
              return;
         }

         const details = {};
         let isValid = true;

         // Collect details based on goal type
         try {
             if (goalType === 'math_accelerate') {
                 details.accelerate_areas = Array.from(step2Element.querySelectorAll('input[name="accelerate_area"]:checked')).map(cb => cb.value);
                 const reasonRadio = step2Element.querySelector('input[name="accelerate_reason"]:checked');
                 details.accelerate_reason = reasonRadio ? reasonRadio.value : null;
                 // Basic validation
                 if (details.accelerate_areas.length === 0) {
                     showToast("Chyba", "Vyberte alespoň jednu oblast zájmu.", "warning");
                     isValid = false;
                 }
                 if (!details.accelerate_reason) {
                     showToast("Chyba", "Vyberte důvod pro učení napřed.", "warning");
                     isValid = false;
                 }
             } else if (goalType === 'math_review') {
                 details.review_areas = Array.from(step2Element.querySelectorAll('input[name="review_area"]:checked')).map(cb => cb.value);
                 // No mandatory fields here, empty array is valid
             }
             // 'math_explore' case is handled directly in handleInitialGoalSelection as it has no step 2 details
         } catch (e) {
              console.error("[GoalModal v5.2] Error getting step 2 details:", e);
              isValid = false;
              showToast("Chyba", "Chyba zpracování výběru.", "error");
         }


         if (isValid) {
             console.log(`[GoalModal v5.2] Step 2 details for ${goalType}:`, details);
             saveGoalAndProceed(pendingGoal, details); // Use the stored pendingGoal
         }
     }

    async function saveGoalAndProceed(goal, details = null) {
        if (goalSelectionInProgress || !goal) return; // Prevent saving without a goal
        goalSelectionInProgress = true;
        setLoadingState('goalSelection', true);
        console.log(`[GoalModal Save v5.2] Saving goal: ${goal}, details:`, details);

        // Disable buttons during save
        const activeStep = ui.goalSelectionModal?.querySelector('.modal-step.active');
        const confirmButton = activeStep?.querySelector('.modal-confirm-btn');
        const backButton = activeStep?.querySelector('.modal-back-btn');
        if (confirmButton) {
             confirmButton.disabled = true;
             confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...';
        }
        if (backButton) backButton.disabled = true;


        try {
            // --- Core Logic ---
            if (!supabase || !currentUser || !currentProfile) {
                throw new Error("Core dependencies (Supabase, user, profile) missing for saving goal.");
            }
            // Save goal choice locally immediately for responsiveness (optional)
            // localStorage.setItem(LEARNING_GOAL_KEY, goal);
            // if (details && Object.keys(details).length > 0) {
            //     localStorage.setItem(GOAL_DETAILS_KEY, JSON.stringify(details));
            // } else {
            //     localStorage.removeItem(GOAL_DETAILS_KEY);
            // }

            // Prepare update payload for Supabase
            const finalPreferences = {
                ...(currentProfile.preferences || {}), // Keep existing preferences
                goal_details: (details && Object.keys(details).length > 0) ? details : undefined // Add/remove goal_details, use undefined to remove if null/empty
            };

            const updatePayload = {
                learning_goal: goal,
                preferences: finalPreferences,
                updated_at: new Date().toISOString()
            };

            console.log("[GoalModal Save v5.2] Updating Supabase profile:", updatePayload);
            // Update profile in Supabase
            const { data: updatedProfileData, error } = await supabase
                .from('profiles')
                .update(updatePayload)
                .eq('id', currentUser.id)
                .select('*, selected_title, preferences') // Select updated data including nested preferences
                .single();

            if (error) throw error;

            // Update local profile state
            currentProfile = updatedProfileData;
             // Ensure preferences object exists after update
             if (!currentProfile.preferences) currentProfile.preferences = {};
            console.log("[GoalModal Save v5.2] Goal saved to DB:", currentProfile.learning_goal, currentProfile.preferences);

            // --- UI Updates After Success ---
            let goalTextKey = `goal_${goal.replace('math_','')}`;
            let goalText = {
                 goal_exam_prep: 'Příprava na zkoušky',
                 goal_accelerate: 'Učení napřed',
                 goal_review: 'Doplnění mezer',
                 goal_explore: 'Volné prozkoumávání'
             }[goalTextKey] || goal; // Fallback to key if text not found

            showToast('Cíl uložen!', `Váš cíl byl nastaven na: ${goalText}.`, 'success');
            hideGoalSelectionModal();

            // Reconfigure UI for the new goal
            if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'flex'; // Show tabs
            if(ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none'; // Hide diagnostic prompt initially
            configureUIForGoal(); // This will set the correct tabs and active tab
            await loadPageData(); // Reload data for the new active tab
            if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled');


        } catch (error) {
            console.error("[GoalModal Save v5.2] Error saving goal:", error);
            showToast('Chyba', 'Nepodařilo se uložit váš cíl.', 'error');
            // Re-enable buttons on error
            if (confirmButton) {
                 confirmButton.disabled = false;
                 confirmButton.innerHTML = 'Potvrdit a pokračovat';
             }
             if (backButton) backButton.disabled = false;

        } finally {
            goalSelectionInProgress = false;
            setLoadingState('goalSelection', false);
            pendingGoal = null; // Clear pending goal after attempt
        }
    }
    // --- END: Goal Selection Logic ---

    // --- START: UI Configuration and Data Loading ---

    // Configures the UI elements (title, shortcuts, tabs) based on the current goal
    function configureUIForGoal() {
        if (!currentProfile || !currentProfile.learning_goal) {
            console.error("[UI Config v6.2] Profil nebo cíl nenalezen. Nelze konfigurovat UI.");
             // If modal is not currently shown, show it
             if (ui.goalSelectionModal && getComputedStyle(ui.goalSelectionModal).display === 'none') {
                 console.log("[UI Config v6.2] Zobrazuji modální okno pro výběr cíle, protože cíl chybí.");
                 showGoalSelectionModal();
             }
            return; // Stop configuration if no goal is set
        }
        const goal = currentProfile.learning_goal;
        console.log(`[UI Config v6.2] Konfigurace UI pro cíl: ${goal}`);

        // Ensure UI elements are cached
        if (!ui || Object.keys(ui).length === 0) {
            console.error("[UI Config v6.2] UI cache je prázdná. Pokouším se znovu cachovat.");
            cacheDOMElements();
            if (!ui || Object.keys(ui).length === 0) {
                 showError("Chyba: UI komponenty nenalezeny.", true);
                 return;
            }
        }

        // Update Dashboard Title
        const dashboardTitleEl = ui.dashboardTitle;
        if (dashboardTitleEl) {
            let titleText = "Procvičování // ";
            let iconClass = "fas fa-laptop-code"; // Default icon
            switch(goal) {
                case 'exam_prep': titleText += "Příprava na Zkoušky"; iconClass = "fas fa-graduation-cap"; break;
                case 'math_accelerate': titleText += "Učení Napřed"; iconClass = "fas fa-rocket"; break;
                case 'math_review': titleText += "Doplnění Mezer"; iconClass = "fas fa-sync-alt"; break;
                case 'math_explore': titleText += "Volné Prozkoumávání"; iconClass = "fas fa-compass"; break;
                default: titleText += "Přehled"; // Fallback title
            }
            dashboardTitleEl.innerHTML = `<i class="${iconClass}"></i> ${sanitizeHTML(titleText)}`;
        } else console.warn("[UI Config v6.2] Element titulku dashboardu (ui.dashboardTitle) nenalezen.");

        // Render Shortcuts
        if (ui.shortcutsGrid) {
            renderShortcutsForGoal(goal, ui.shortcutsGrid);
        } else console.warn("[UI Config v6.2] Element mřížky zkratek (ui.shortcutsGrid) nenalezen.");

        // --- START: Tab Visibility Logic (MODIFIED) ---
        // Define which tabs are relevant for ALL goals
        const alwaysVisibleTabs = ['practice-tab', 'test-results-tab', 'study-plan-tab', 'vyuka-tab'];

        if (ui.contentTabs && ui.contentTabs.length > 0) {
            ui.contentTabs.forEach(tabButton => {
                const tabId = tabButton.dataset.tab;
                 // Check if the tab is one of the always visible ones
                if (alwaysVisibleTabs.includes(tabId)) {
                     tabButton.style.display = 'flex'; // Ensure it's visible
                } else {
                     // Hide any other tabs that might exist in the HTML but are not needed
                     tabButton.style.display = 'none';
                }
            });
        } else {
            console.warn("[UI Config v6.2] Nenalezeny žádné elementy záložek (ui.contentTabs).");
        }
        // --- END: Tab Visibility Logic (MODIFIED) ---

        // Determine and set the active tab
        let activeTabId = localStorage.getItem('lastActiveProcvicovaniTab') || 'practice-tab'; // Default to 'Obecné'
        let activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`);

        // If the stored tab is now hidden, default to the first *visible* tab ('practice-tab')
        if (!activeTabButton || activeTabButton.style.display === 'none') {
            console.log(`[UI Config v6.2] Aktivní záložka '${activeTabId}' je skryta nebo neexistuje, výchozí bude 'practice-tab'.`);
            activeTabId = 'practice-tab'; // Always visible
            activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`);
        }

        // Switch to the determined active tab
        if (activeTabButton) {
             console.log(`[UI Config v6.2] Nastavuji aktivní záložku na: ${activeTabId}`);
             isInitialTabLoad = true; // Set flag for initial load
             switchActiveTab(activeTabId); // Call the function to switch UI and load data
        } else {
             console.error("[UI Config v6.2] Nenalezena žádná vhodná aktivní záložka (ani practice-tab).");
             // Potentially show an error state for the tabs content
             if(ui.tabContents && ui.tabContents.length > 0) {
                 ui.tabContents.forEach(tc => { if(tc) tc.style.display = 'none';});
             }
             // Optionally display a message in the main area
        }

        console.log(`[UI Config v6.2] UI nakonfigurováno pro cíl: ${goal}`);
    }

    // Loads data for the specified tab based on the current goal
    async function loadTabData(tabId) {
        const camelCaseKey = tabId.replace(/-([a-z])/g, (g) => g[1].toUpperCase()); // e.g., test-results-tab -> testResultsTab
        const contentKey = `${camelCaseKey}Content`; // e.g., testResultsTabContent

        if (!currentProfile || !currentProfile.learning_goal) {
            console.warn(`[Load Tab Data v6.2] Cannot load data for tab '${tabId}', missing profile or goal.`);
            const contentElement = ui[contentKey];
            if (contentElement) {
                 // Display a message prompting goal selection
                 contentElement.innerHTML = `
                    <div class="empty-state" style="display:flex; flex-direction:column; align-items:center;">
                        <i class="fas fa-info-circle"></i>
                        <h3>Vyberte cíl</h3>
                        <p>Pro zobrazení obsahu této záložky si nejprve vyberte svůj studijní cíl.</p>
                        <button class="btn btn-primary" id="selectGoalBtnInTab_${tabId}">Vybrat cíl</button>
                    </div>`;
                 contentElement.style.display = 'block'; // Make sure it's visible
                 const selectGoalBtn = document.getElementById(`selectGoalBtnInTab_${tabId}`);
                 if(selectGoalBtn) selectGoalBtn.addEventListener('click', showGoalSelectionModal);
            } else {
                console.error(`[Load Tab Data v6.2] Content element with key '${contentKey}' (for ID: ${tabId}-content) not found for 'missing goal' message.`);
            }
            return; // Stop loading
        }

        const goal = currentProfile.learning_goal;
        console.log(`[Load Tab Data v6.2] Loading data for tab: ${tabId}, goal: ${goal}, UI content key: ${contentKey}`);

        const sectionKey = tabIdToSectionKey(tabId);
        setLoadingState(sectionKey, true); // Set loading state for the specific section

        try {
            // Hide all tab content elements first
            if(ui.tabContents && ui.tabContents.length > 0) {
                 ui.tabContents.forEach(tc => { if(tc) tc.style.display = 'none'; });
            } else { console.warn("[Load Tab Data v6.2] ui.tabContents not found or empty when hiding."); }

            const targetContentElement = ui[contentKey];
            if (!targetContentElement) {
                 console.error(`[Load Tab Data v6.2] Content element with key '${contentKey}' (ID: ${tabId}-content) not found in ui cache.`);
                 setLoadingState(sectionKey, false);
                 return;
            }

            targetContentElement.innerHTML = ''; // Clear previous content before loading/skeletons
            targetContentElement.style.display = 'block'; // Make the container visible

            // Show skeletons while loading data
            switch (tabId) {
                case 'practice-tab':
                    if (ui.statsCards) renderStatsSkeletons(ui.statsCards);
                    if (ui.shortcutsGrid) renderShortcutSkeletons(ui.shortcutsGrid);
                    break;
                case 'test-results-tab':
                    if (ui.testResultsContent) renderTestSkeletons(ui.testResultsContent);
                    break;
                case 'study-plan-tab':
                    if (ui.studyPlanContent) renderPlanSkeletons(ui.studyPlanContent);
                    break;
                case 'topic-analysis-tab':
                    if (ui.topicAnalysisContent) renderTopicSkeletons(ui.topicAnalysisContent);
                    break;
                 case 'vyuka-tab':
                     // Placeholder for "Výuka" - no specific skeleton needed for now
                     targetContentElement.innerHTML = `
                         <div class="empty-state" style="display:flex; flex-direction:column; align-items:center;">
                             <i class="fas fa-person-chalkboard empty-state-icon"></i>
                             <h3>Výuka s AI</h3>
                             <p>Zde naleznete interaktivní lekce s AI tutorem Justaxem. Obsah se přizpůsobí vašemu plánu.</p>
                             <a href="vyuka/vyuka.html" class="btn btn-primary" style="margin-top: 1rem;"> <i class="fas fa-book-open"></i> Spustit výuku </a>
                         </div>`;
                     setLoadingState(sectionKey, false); // No data to load yet
                     return; // Exit early for vyuka-tab
                default:
                    console.warn(`[Load Tab Data v6.2] No specific skeleton logic for tab: ${tabId}`);
                    break;
            }

            // Fetch and render actual data
            switch (tabId) {
                case 'practice-tab':
                    userStatsData = await fetchDashboardStats(currentUser.id, currentProfile);
                    renderStatsCards(userStatsData); // Renders actual data, replaces skeleton
                    if (ui.shortcutsGrid) renderShortcutsForGoal(goal, ui.shortcutsGrid); // Renders shortcuts
                    if(ui.diagnosticPrompt) await checkUserGoalAndDiagnostic(); // Check diagnostic status
                    break;
                case 'test-results-tab':
                    diagnosticResultsData = await fetchDiagnosticResults(currentUser.id, goal);
                    renderTestResults(diagnosticResultsData, goal); // Renders results or empty state
                    break;
                case 'study-plan-tab':
                    studyPlanData = await fetchActiveStudyPlan(currentUser.id, goal);
                    planActivitiesData = studyPlanData ? await fetchPlanActivities(studyPlanData.id, goal) : [];
                    renderStudyPlanOverview(studyPlanData, planActivitiesData, goal); // Renders plan or empty state
                    break;
                case 'topic-analysis-tab':
                     // Removed topic analysis fetch/render as the tab is removed
                     console.warn("[Load Tab Data] Attempted to load removed tab: topic-analysis-tab");
                    if (targetContentElement) targetContentElement.innerHTML = `<div class="empty-state" style="display:block;"><p>Tato sekce byla odstraněna.</p></div>`;
                    setLoadingState(sectionKey, false); // Ensure loading stops
                    break;
                // case 'vyuka-tab': handled above
                default:
                    console.warn(`[Load Tab Data v6.2] No specific data loading logic for tab: ${tabId}`);
                    if (targetContentElement) targetContentElement.innerHTML = `<div class="empty-state" style="display:block;"><i class="fas fa-question-circle"></i><p>Obsah pro tuto záložku se připravuje.</p></div>`;
                    setLoadingState(sectionKey, false); // Stop loading for unknown tabs
                    break;
            }

            // Ensure loading state is stopped even if rendering functions don't handle it
             if(isLoading[sectionKey]) {
                  setLoadingState(sectionKey, false);
             }

        } catch (error) {
            console.error(`[Load Tab Data v6.2] Error loading data for tab ${tabId}:`, error);
            showError(`Nepodařilo se načíst data pro záložku: ${error.message}`);
            const contentEl = ui[contentKey];
             if (contentEl) { // Show error message in the specific tab content area
                 contentEl.innerHTML = `<div class="empty-state" style="display:block;"><i class="fas fa-exclamation-triangle"></i><p>Chyba načítání dat.</p></div>`;
                 contentEl.style.display = 'block';
             }
              setLoadingState(sectionKey, false); // Stop loading on error
        }
    }

    // Helper to map tab ID to loading state key
    function tabIdToSectionKey(tabId) {
        switch (tabId) {
            case 'practice-tab': return 'stats'; // Or maybe 'all' for this overview tab?
            case 'test-results-tab': return 'tests';
            case 'study-plan-tab': return 'plan';
             case 'vyuka-tab': return 'none'; // No specific loading key needed for static content yet
            // case 'topic-analysis-tab': return 'topics'; // Removed
            default: return 'all'; // Fallback
        }
    }

    // Loads initial page data (usually the active tab's data)
    async function loadPageData() {
        if (!currentProfile) {
            console.error("[Load Page Data v6.2] Cannot load page data, profile missing.");
            setLoadingState('all', false);
            return;
        }
        if (!currentProfile.learning_goal) {
             console.log("[Load Page Data v6.2] Goal missing, modal should handle this. Skipping data load.");
             // No need to set loading state off, as it wasn't set on for this path
             return;
        }
        console.log(`🔄 [Load Page Data v6.2] Loading page data for goal: ${currentProfile.learning_goal}...`);
        // Don't set 'all' loading true here, let individual tabs handle it
        // setLoadingState('all', true);
        hideError(); // Hide previous errors
        await new Promise(resolve => setTimeout(resolve, 100)); // Short delay

        // Find the currently active tab (or default) and load its data
        let activeTabId = localStorage.getItem('lastActiveProcvicovaniTab') || 'practice-tab';
        let activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`);
        // Ensure the active tab is actually visible based on the goal
        if (!activeTabButton || activeTabButton.style.display === 'none') {
             activeTabId = 'practice-tab'; // Default to the always visible tab
        }
        console.log(`[Load Page Data v6.2] Loading data for initially active tab: ${activeTabId}`);
        await loadTabData(activeTabId); // Load data for the determined active tab

        // No need to set 'all' loading false here, individual tabs handle their state
        // setLoadingState('all', false);
        initTooltips(); // Re-init tooltips after potential content changes
        console.log("✅ [Load Page Data v6.2] Page data loading process initiated for active tab.");
    }

    // Handles switching between tabs
    function handleTabSwitch(eventOrTabId) {
        let tabId, targetTabButton;

        // Determine tabId and button from event or string
        if (typeof eventOrTabId === 'string') {
            tabId = eventOrTabId;
            targetTabButton = document.querySelector(`.content-tab[data-tab="${tabId}"]`);
             if (!targetTabButton) {
                 console.warn(`[Tabs v6.2] Tab button with ID '${tabId}' not found.`);
                 return;
             }
        } else if (eventOrTabId?.currentTarget) {
            targetTabButton = eventOrTabId.currentTarget;
            tabId = targetTabButton.dataset.tab;
             if (!tabId) return; // No data-tab attribute
        } else {
            console.warn("[Tabs v6.2] Invalid argument for handleTabSwitch.");
            return;
        }

        // Prevent unnecessary re-load if tab is already active (unless it's the initial load)
        if (targetTabButton.classList.contains('active') && !isInitialTabLoad) {
             console.log(`[Tabs v6.2] Tab ${tabId} is already active.`);
             return;
        }

        console.log(`[Tabs v6.2] Switching to tab: ${tabId}`);

        // Update tab button UI
        if(ui.contentTabs && ui.contentTabs.length > 0) {
            ui.contentTabs.forEach(tab => tab.classList.remove('active'));
        } else { console.warn("[Tabs v6.2] ui.contentTabs not found during UI update."); }
        targetTabButton.classList.add('active');

        // Show the corresponding content pane
        const activeContentId = `${tabId}-content`;
        if(ui.tabContents && ui.tabContents.length > 0) {
             ui.tabContents.forEach(content => {
                 if(content){
                     content.classList.toggle('active', content.id === activeContentId);
                     // Use display block/none for simplicity, animation handled by CSS
                     content.style.display = content.id === activeContentId ? 'block' : 'none';
                 }
             });
        } else { console.warn("[Tabs v6.2] ui.tabContents not found during content switching."); }


        // Save last active tab
        localStorage.setItem('lastActiveProcvicovaniTab', tabId);

        // Load data for the newly activated tab (skip if it's the initial load handled by configureUIForGoal)
        if (!isInitialTabLoad) {
            loadTabData(tabId);
        }

        isInitialTabLoad = false; // Reset initial load flag after the first switch
    }

    // Switches to a specific tab programmatically
    function switchActiveTab(tabId) {
        const tabButton = document.querySelector(`.content-tab[data-tab="${tabId}"]`);
        if (tabButton) {
             handleTabSwitch({ currentTarget: tabButton }); // Simulate event object
        } else {
            console.warn(`[SwitchActiveTab v6.2] Tab button for '${tabId}' not found.`);
        }
    }

    // Handles manual refresh click
    async function handleRefreshClick() {
        if (!currentUser || !currentProfile) {
             showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error");
             return;
        }
        // Check if any loading is in progress
        if (Object.values(isLoading).some(state => state)) {
            showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají, počkejte prosím.", "info");
            return;
        }
        console.log("🔄 Manual refresh triggered...");
        // UI feedback for refresh button
        const icon = ui.refreshDataBtn?.querySelector('i');
        const text = ui.refreshDataBtn?.querySelector('.refresh-text');
        if (icon) icon.classList.add('fa-spin');
        if (text) text.textContent = 'RELOADING...';
        if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = true;

        // Determine which tab is currently active
        let activeTabId = localStorage.getItem('lastActiveProcvicovaniTab') || 'practice-tab';
        let activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`);
         // If stored active tab is hidden, default to practice-tab
         if (!activeTabButton || activeTabButton.style.display === 'none') {
             activeTabId = 'practice-tab';
         }
        // Reload data for the active tab
        await loadTabData(activeTabId);

        // Reset refresh button UI
        if (icon) icon.classList.remove('fa-spin');
        if (text) text.textContent = 'RELOAD';
        if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = false;
        console.log("🔄 Manual refresh complete.");
    }

    // Closes notification dropdown if click is outside
    function handleOutsideNotificationClick(event) {
        if (ui.notificationsDropdown?.classList.contains('active') &&
            !ui.notificationsDropdown.contains(event.target) &&
            !ui.notificationBell?.contains(event.target)) {
            ui.notificationsDropdown.classList.remove('active');
        }
    }

    // Initializes Supabase client
    function initializeSupabase() {
        try {
            if (!window.supabase?.createClient) {
                throw new Error("Supabase library not loaded or createClient is not a function.");
            }
            // Use global instance if already created by another script
            if (window.supabaseClient) {
                supabase = window.supabaseClient;
                console.log('[Supabase] Using existing global client instance.');
            } else if (supabase === null) { // Initialize only if not already done locally
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                if (!supabase) throw new Error("Supabase client creation failed.");
                window.supabaseClient = supabase; // Store globally for potential use by other scripts
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

    // Creates a default profile if one doesn't exist
    async function createDefaultProfile(userId, email) {
        console.log(`[Default Profile] Creating default profile for new user ${userId}...`);
        const defaultProfileData = {
            id: userId,
            username: email.split('@')[0], // Use email prefix as username default
            email: email,
            updated_at: new Date().toISOString(),
            // Default values for other fields
            learning_goal: null, // Start with no goal
            preferences: {},
            points: 0,
            level: 1,
            completed_exercises: 0,
            streak_days: 0,
            selected_title: null,
            avatar_url: null, // Default avatar handled by UI
            first_name: null,
            last_name: null,
        };
        try {
            // Try inserting the default profile
            const { data, error } = await supabase
                .from('profiles')
                .insert(defaultProfileData)
                .select('*, selected_title, preferences') // Select the newly inserted data
                .single();

            if (error) {
                // Handle potential race condition or existing profile (error code 23505: unique_violation)
                if (error.code === '23505') {
                    console.warn("[Default Profile] Profile likely already exists (unique violation), attempting to fetch...");
                    // Attempt to fetch the existing profile instead
                    const { data: existingProfile, error: fetchError } = await supabase
                        .from('profiles')
                        .select('*, selected_title, preferences')
                        .eq('id', userId)
                        .single();

                    if (fetchError) {
                        console.error("[Default Profile] Error fetching existing profile after unique violation:", fetchError);
                        throw fetchError; // Throw the fetch error
                    }
                    if (!existingProfile.preferences) existingProfile.preferences = {}; // Ensure preferences object exists
                    return existingProfile; // Return the existing profile
                }
                // If it's another error, throw it
                throw error;
            }
             // Ensure preferences object exists on new profile
             if (!data.preferences) data.preferences = {};
             console.log("[Default Profile] Default profile created successfully:", data);
             return data;
        } catch (err) {
            console.error("[Default Profile] Error creating default profile:", err);
            showError("Nepodařilo se vytvořit uživatelský profil.", true);
            return null; // Return null on failure
        }
    }
    // --- END: Core Application Logic ---

    // --- START: Event Listeners Setup ---
    function setupEventListeners() {
        console.log("[Procvičování SETUP v6.2] Setting up listeners...");

        // Helper to safely add listeners and avoid duplicates
        const safeAddListener = (elementOrElements, eventType, handler, descriptiveKey) => {
            const elements = (elementOrElements instanceof NodeList || Array.isArray(elementOrElements))
                ? elementOrElements
                : [elementOrElements]; // Ensure we have an array/NodeList

            let count = 0;
            elements.forEach(element => {
                if (element) {
                    // Remove previous listener if stored
                    if (element._eventHandlers?.[eventType]) {
                        element.removeEventListener(eventType, element._eventHandlers[eventType]);
                        // console.log(`[SETUP v6.2] Removed old ${eventType} listener for ${descriptiveKey || 'element'}`);
                    }
                    // Add new listener
                    element.addEventListener(eventType, handler);
                    // Store reference to the handler
                    if (!element._eventHandlers) element._eventHandlers = {};
                    element._eventHandlers[eventType] = handler;
                    count++;
                }
            });

            // Log warnings for missing elements (helps debugging)
            if (count === 0 && elements.length > 0 && elements[0] !== document && elements[0] !== window) {
                const nonCriticalMissing = ['markAllReadBtn', 'createPlanBtnEmpty', 'startTestBtnPlan', 'startTestBtnPrompt', 'startTestBtnResults', 'startTestBtnAnalysis'];
                 if (!ui[descriptiveKey] && nonCriticalMissing.includes(descriptiveKey)) {
                     // console.log(`[SETUP v6.2] Non-critical element not found for listener: ${descriptiveKey}.`);
                 } else if (!ui[descriptiveKey]) {
                     console.warn(`[SETUP v6.2] Element not found for listener: ${descriptiveKey}.`);
                 }
            }
        };

        // Tabs
        const tabs = ui.contentTabs && ui.contentTabs.length > 0 ? ui.contentTabs : document.querySelectorAll('.content-tab');
        if (tabs.length > 0) {
            safeAddListener(tabs, 'click', handleTabSwitch, 'contentTabs');
        } else {
            console.warn("[SETUP v6.2] Tab elements (.content-tab) not found.");
        }

        // Other Buttons
        safeAddListener(ui.refreshDataBtn, 'click', handleRefreshClick, 'refreshDataBtn');
        safeAddListener(ui.startTestBtnPrompt, 'click', () => window.location.href = 'test1.html', 'startTestBtnPrompt');
        safeAddListener(ui.startTestBtnResults, 'click', () => window.location.href = 'test1.html', 'startTestBtnResults');
        safeAddListener(ui.startTestBtnPlan, 'click', () => window.location.href = 'test1.html', 'startTestBtnPlan');
        safeAddListener(ui.createPlanBtnEmpty, 'click', () => switchActiveTab('study-plan-tab'), 'createPlanBtnEmpty'); // Should switch to 'plan' tab or 'create' depending on logic elsewhere
        safeAddListener(ui.startTestBtnAnalysis, 'click', () => window.location.href = 'test1.html', 'startTestBtnAnalysis');

        // Sidebar
        safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
        safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
        safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');
        safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn');
        document.querySelectorAll('.sidebar-link').forEach(link => { // Standard elements, likely present
             safeAddListener(link, 'click', () => { if (window.innerWidth <= 992) closeMenu(); }, 'sidebarLink');
         });

        // Notifications
        safeAddListener(ui.markAllReadBtn, 'click', markAllNotificationsRead, 'markAllReadBtn');
        safeAddListener(ui.notificationBell, 'click', (event) => {
            event.stopPropagation();
            if (ui.notificationsDropdown) {
                ui.notificationsDropdown.classList.toggle('active');
                // Load notifications only when dropdown is opened and empty (and not already loading)
                if (ui.notificationsDropdown.classList.contains('active') &&
                    ui.notificationsList?.innerHTML.trim() === '' &&
                    !isLoading.notifications) {
                    if (currentUser?.id) {
                         fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT);
                    } else {
                         console.warn("[NotificationBell] Missing currentUser.id for fetching notifications.");
                    }
                }
            } else { console.warn("[NotificationBell] ui.notificationsDropdown not found.");}
        }, 'notificationBell');

        // Event delegation for notification items
        if (ui.notificationsList) {
            // Use a stored handler reference to allow removal
            if (ui.notificationsList._itemClickHandler) {
                 ui.notificationsList.removeEventListener('click', ui.notificationsList._itemClickHandler);
            }
            ui.notificationsList._itemClickHandler = async (event) => {
                const item = event.target.closest('.notification-item');
                if (item) {
                    const notificationId = item.dataset.id;
                    const link = item.dataset.link;
                    const isRead = item.classList.contains('is-read');

                    // Mark as read logic
                    if (!isRead && notificationId) {
                        const success = await markNotificationRead(notificationId); // Assume this returns true/false
                        if (success) {
                            // Update UI directly
                            item.classList.add('is-read');
                            item.querySelector('.unread-dot')?.remove();
                            // Update badge count
                            if (ui.notificationCount) {
                                const countText = ui.notificationCount.textContent.replace('+','');
                                const currentCount = parseInt(countText) || 0;
                                const newCount = Math.max(0, currentCount - 1);
                                ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                                ui.notificationCount.classList.toggle('visible', newCount > 0);
                            }
                            // Update "Mark all" button state
                            if(ui.markAllReadBtn) {
                                 ui.markAllReadBtn.disabled = (parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0') === 0);
                             }
                        }
                    }
                    // Navigate if link exists
                    if (link) {
                        window.location.href = link;
                    }
                    // Close dropdown after interaction
                     if (ui.notificationsDropdown) {
                         ui.notificationsDropdown.classList.remove('active');
                     }
                }
            };
            ui.notificationsList.addEventListener('click', ui.notificationsList._itemClickHandler);
        } else { console.warn("[SETUP v6.2] ui.notificationsList not found for delegation setup."); }

        // Close notification dropdown on outside click
        document.removeEventListener('click', handleOutsideNotificationClick); // Ensure no duplicates
        document.addEventListener('click', handleOutsideNotificationClick);

        // Modal Goal Selection Listeners
         const modalBackButtons = ui.goalSelectionModal ? ui.goalSelectionModal.querySelectorAll('.modal-back-btn') : [];
         safeAddListener(modalBackButtons, 'click', (event) => {
             const targetStepId = event.currentTarget.dataset.targetStep;
             const currentActiveStep = ui.goalSelectionModal?.querySelector('.modal-step.active');
             const targetStepElement = document.getElementById(targetStepId);
             if(currentActiveStep) currentActiveStep.classList.remove('active');
             if(targetStepElement) targetStepElement.classList.add('active');
             pendingGoal = null; // Clear pending goal when going back
         }, 'modalBackButtons');

         const modalConfirmButtons = ui.goalSelectionModal ? ui.goalSelectionModal.querySelectorAll('.modal-confirm-btn') : [];
         safeAddListener(modalConfirmButtons, 'click', (event) => {
             const goal = event.currentTarget.dataset.goal; // Goal associated with the confirm button
              // Check if the goal matches the pending goal (from step 1) OR if step 1 is active
             if (goal && goal === pendingGoal) { // Confirming step 2
                 handleStep2Confirm(goal);
             } else if (ui.goalStep1?.classList.contains('active') && goal) { // Handling direct confirm from step 1 (if applicable, e.g., exam_prep)
                  handleInitialGoalSelection(goal);
              } else {
                   console.warn("Confirm button clicked in unexpected state or without matching pendingGoal.");
              }
         }, 'modalConfirmButtons');


        console.log("[Procvičování SETUP v6.2] Event listeners setup complete.");
    }
    // --- END: Event Listeners Setup ---

    // --- START: Initialization ---
    async function initializeApp() {
        try {
            console.log(`[INIT Procvičování] App Init Start v25.0.14...`); // Version updated
            cacheDOMElements(); // Cache elements first

            if (!initializeSupabase()) { // Check Supabase init success
                 if(ui.initialLoader) {ui.initialLoader.innerHTML = '<p style="color:red;">Kritická chyba DB.</p>'; setTimeout(()=> ui.initialLoader.style.display = 'none', 2000);}
                 return;
            }

            // --- Basic UI Init ---
            applyInitialSidebarState(); // Set sidebar based on localStorage
            updateCopyrightYear();
            initMouseFollower();
            initHeaderScrollDetection();
            updateOnlineStatus();
            initTooltips();
            // --- End Basic UI Init ---

            // Show initial loader and hide main content initially
            if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden');}
            if (ui.mainContent) ui.mainContent.style.display = 'none';
            // Hide tab containers initially
            if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none';
            if (ui.tabContents && ui.tabContents.length > 0) { ui.tabContents.forEach(el => {if(el) el.style.display='none';}); }
            else { console.warn("[INIT] ui.tabContents not found or empty during initial hide.");}


            hideError(); // Clear any previous global errors
            console.log("[INIT Procvičování] Checking authentication session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Session error: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;
                console.log(`[INIT Procvičování] User authenticated (ID: ${currentUser.id}). Fetching profile and initial data...`);

                // Fetch profile, titles, and initial notifications concurrently
                const [profileResult, titlesResult, initialNotificationsResult] = await Promise.allSettled([
                    supabase.from('profiles').select('*, selected_title, preferences').eq('id', currentUser.id).single(),
                    supabase.from('title_shop').select('title_key, name'), // Fetch available titles
                    fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT) // Fetch initial notifications
                ]);

                // Process profile result
                if (profileResult.status === 'fulfilled' && profileResult.value?.data) {
                    currentProfile = profileResult.value.data;
                } else {
                    console.warn("[INIT Procvičování] Profile not found or fetch error, creating default...");
                    currentProfile = await createDefaultProfile(currentUser.id, currentUser.email);
                }
                if (!currentProfile) throw new Error("Failed to load or create user profile.");
                if (!currentProfile.preferences) currentProfile.preferences = {}; // Ensure preferences object exists
                console.log("[INIT Procvičování] Profile loaded/created:", currentProfile);

                // Process titles result
                allTitles = (titlesResult.status === 'fulfilled') ? (titlesResult.value?.data || []) : [];
                console.log(`[INIT Procvičování] Loaded ${allTitles.length} titles.`);
                updateSidebarProfile(currentProfile, allTitles); // Update sidebar with profile and titles

                // Process notifications result
                if (initialNotificationsResult.status === 'fulfilled') {
                    // RenderNotifications is called within fetchNotifications now
                    // renderNotifications(initialNotificationsResult.value.unreadCount, initialNotificationsResult.value.notifications || []);
                } else {
                    console.error("[INIT Procvičování] Failed to load initial notifications:", initialNotificationsResult.reason);
                    renderNotifications(0, []); // Render empty state on error
                }

                // Setup event listeners AFTER caching and profile load
                setupEventListeners();

                // --- Goal Handling Logic ---
                let goal = currentProfile.learning_goal;
                console.log(`[INIT Goal Check] Goal from DB: ${goal}`);

                if (!goal) {
                     // No goal set in DB, show the selection modal
                     console.log(`[INIT Procvičování] Goal not set in DB. Showing modal.`);
                     showGoalSelectionModal();
                     // Hide loader, show main content area (but tabs/content remain hidden until goal is set)
                     if(ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if(ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }
                     if (ui.mainContent) ui.mainContent.style.display = 'flex'; // Show main structure
                     if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none'; // Keep tabs hidden
                     if (ui.tabContents && ui.tabContents.length > 0) { ui.tabContents.forEach(el => {if(el) el.style.display='none';}); } // Keep content hidden
                } else {
                     // Goal exists in DB, proceed with normal UI configuration and data loading
                     console.log(`[INIT Procvičování] Goal '${goal}' already set. Configuring UI and loading data...`);
                     if(ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; // Ensure modal is hidden
                     if(ui.tabsWrapper) ui.tabsWrapper.style.display = 'flex'; // Show tabs wrapper
                     if(ui.tabContents) ui.tabContents.forEach(el => el.style.display = 'none'); // Ensure content is hidden before load
                     configureUIForGoal(); // This sets up visible tabs and calls switchActiveTab -> loadPageData
                }
                // --- End Goal Handling Logic ---


                // Show main content area only AFTER goal handling (unless modal is shown)
                if (ui.mainContent && (!ui.goalSelectionModal || getComputedStyle(ui.goalSelectionModal).display === 'none')) {
                     ui.mainContent.style.display = 'flex'; // Use flex as it's the main container
                     requestAnimationFrame(() => { if(ui.mainContent) ui.mainContent.classList.add('loaded'); initScrollAnimations(); });
                 }

                console.log("✅ [INIT Procvičování] Page setup complete.");

            } else {
                console.log('[INIT Procvičování] User not logged in, redirecting to login...');
                window.location.href = '/auth/index.html'; // Redirect to login page
            }
        } catch (error) {
            console.error("❌ [INIT Procvičování] Critical initialization error:", error);
            // Attempt to display error nicely
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) {
                 ui.initialLoader.innerHTML = `<p style="color:red;">Chyba (${error.message}). Obnovte.</p>`;
            } else {
                showError(`Chyba inicializace: ${error.message}`, true);
            }
            if (ui.mainContent) ui.mainContent.style.display = 'flex'; // Show main content area to display global error if possible
            setLoadingState('all', false); // Ensure loading state is off
        } finally {
            // Ensure initial loader is hidden eventually
            const il = ui.initialLoader;
            if (il && !il.classList.contains('hidden')) {
                il.classList.add('hidden');
                setTimeout(() => { if(il) il.style.display = 'none'; }, 300); // Delay to allow fade out
            }
        }
    }
    // --- END: Initialization ---

    // --- START THE APP ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp(); // Initialize immediately if DOM is already ready
    }
    // --- END THE APP ---

})(); // End IIFE