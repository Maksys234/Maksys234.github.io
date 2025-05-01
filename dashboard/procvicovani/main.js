// dashboard/procvicovani/main.js
// Version: 2.0 (Fixes Overview and Quick Actions, integrates with core dashboard logic)
(function() {
	'use strict';

	// --- START: Configuration & State ---
	const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
	const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
	const SIDEBAR_STATE_KEY = 'sidebarCollapsedState'; // Shared key with dashboard.js
    const NOTIFICATION_FETCH_LIMIT = 5;
	let supabase = null;
	let currentUser = null;
	let currentProfile = null;
    let allTitles = []; // To store titles for sidebar consistency
    let userPracticeStats = null; // Store fetched practice stats
    let isLoading = { page: true, stats: false, shortcuts: false, notifications: false, exercises: false }; // Added exercises loading state

	// DOM Elements Cache (Added elements for overview and actions)
	const ui = {
		initialLoader: document.getElementById('initial-loader'),
        mainContent: document.getElementById('main-content'),
        globalError: document.getElementById('global-error'),
        offlineBanner: document.getElementById('offline-banner'),
        // Sidebar elements (consistent with dashboard.js)
		sidebarOverlay: document.getElementById('sidebar-overlay'),
		sidebar: document.getElementById('sidebar'),
		mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
		sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
		sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
		sidebarAvatar: document.getElementById('sidebar-avatar'),
		sidebarName: document.getElementById('sidebar-name'),
        sidebarUserTitle: document.getElementById('sidebar-user-title'), // Title element
		currentYearSidebar: document.getElementById('currentYearSidebar'),
		currentYearFooter: document.getElementById('currentYearFooter'),
		// Header elements (consistent with dashboard.js)
		dashboardHeader: document.querySelector('.dashboard-header'),
		refreshDataBtn: document.getElementById('refresh-data-btn'),
		notificationBell: document.getElementById('notification-bell'),
		notificationCount: document.getElementById('notification-count'),
		notificationsDropdown: document.getElementById('notifications-dropdown'),
		notificationsList: document.getElementById('notifications-list'),
		noNotificationsMsg: document.getElementById('no-notifications-msg'),
		markAllReadBtn: document.getElementById('mark-all-read'),
		// Page specific elements
		tabsWrapper: document.querySelector('.tabs-wrapper'),
		contentTabs: document.querySelectorAll('.content-tab'),
		tabContents: document.querySelectorAll('.tab-content'),
        // **Celkový Přehled (Stats/Overview) Elements**
        statsCardsContainer: document.getElementById('stats-cards'), // Container for stats cards
        statsProgressCard: document.getElementById('stats-card-progress'), // Example card ID
        statsAccuracyCard: document.getElementById('stats-card-accuracy'), // Example card ID
        statsTimeCard: document.getElementById('stats-card-time'),       // Example card ID
        statsCompletedCard: document.getElementById('stats-card-completed'), // Example card ID
        // **Rychlé Akce (Quick Actions) Elements**
        shortcutsGrid: document.getElementById('shortcuts-grid'), // Container for action cards
        startMathBtn: document.getElementById('start-math-btn'), // Example button ID
        startLangBtn: document.getElementById('start-lang-btn'), // Example button ID
        startRandomBtn: document.getElementById('start-random-btn'), // Example button ID
        viewHistoryBtn: document.getElementById('view-history-btn'), // Example button ID
        // Content Area for Exercises/Tests (Assuming you will add this later)
        exerciseListContainer: document.getElementById('exercise-list-container'), // Example ID
        exerciseList: document.getElementById('exercise-list'), // Example ID
		// Other
		toastContainer: document.getElementById('toast-container'),
		mouseFollower: document.getElementById('mouse-follower')
	};

	// Visuals (consistent with dashboard.js)
	const activityVisuals = {
		exercise: { name: 'Cvičení', icon: 'fa-laptop-code', class: 'exercise' },
		test: { name: 'Test', icon: 'fa-vial', class: 'test' },
		badge: { name: 'Odznak Získán', icon: 'fa-medal', class: 'badge' },
		diagnostic: { name: 'Diagnostika', icon: 'fa-microscope', class: 'diagnostic' },
		lesson: { name: 'Nová Data', icon: 'fa-book-open', class: 'lesson' },
		plan_generated: { name: 'Plán Aktualizován', icon: 'fa-route', class: 'plan_generated' },
		level_up: { name: 'Level UP!', icon: 'fa-angle-double-up', class: 'level_up' },
		other: { name: 'Systémová Zpráva', icon: 'fa-info-circle', class: 'other' },
		default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
	};
	// --- END: Configuration & State ---

	// --- START: Helper Functions (Mostly copied from dashboard.js for consistency) ---
	function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
	function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
	function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Obnovit Stránku</button></div>`; ui.globalError.style.display = 'block'; const retryBtn = document.getElementById('global-retry-btn'); if (retryBtn) { retryBtn.addEventListener('click', () => { location.reload(); }); } } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
	function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
	function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }
	function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
	function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
	function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
	function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
	function setLoadingState(section, isLoadingFlag) {
		 if (isLoading[section] === isLoadingFlag && section !== 'all') return;
		 if (section === 'all') { Object.keys(isLoading).forEach(key => isLoading[key] = isLoadingFlag); }
		 else { isLoading[section] = isLoadingFlag; }
		 console.log(`[SetLoading] Sekce: ${section}, isLoading: ${isLoadingFlag}`);

		 // Handle stats loading
		 if (section === 'stats' || section === 'all') {
			 if (ui.statsCardsContainer) {
				 ui.statsCardsContainer.querySelectorAll('.dashboard-card').forEach(card => card.classList.toggle('loading', isLoadingFlag));
			 }
		 }
         // Handle shortcuts loading
          if (section === 'shortcuts' || section === 'all') {
              if (ui.shortcutsGrid) {
                  ui.shortcutsGrid.querySelectorAll('.shortcut-card').forEach(card => card.classList.toggle('loading', isLoadingFlag));
              }
          }
		 // Handle exercises loading (assuming you add this later)
		 if (section === 'exercises' || section === 'all') {
			 if (ui.exerciseListContainer) {
				 ui.exerciseListContainer.classList.toggle('loading', isLoadingFlag);
			 }
		 }
		 // Handle notifications loading
		 if (section === 'notifications' || section === 'all') {
			 if(ui.notificationBell) ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
			 if (ui.markAllReadBtn) {
				 const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
				 ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
			 }
			 if(isLoadingFlag && ui.notificationsList && typeof renderNotificationSkeletons === 'function') {
				 renderNotificationSkeletons(2);
			 }
		 }
	 }
	 const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
	 const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); };
	 const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); };
	 const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
	 function applyInitialSidebarState() { const savedState = localStorage.getItem(SIDEBAR_STATE_KEY); const shouldBeCollapsed = savedState === 'collapsed'; if (shouldBeCollapsed) { document.body.classList.add('sidebar-collapsed'); } else { document.body.classList.remove('sidebar-collapsed'); } const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) { icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; } }
	 function toggleSidebar() { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) { icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; } }
	 function initTooltips() { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Tooltipster error:", e); } }
	 // --- END: Helper Functions ---

	// --- START: Data Loading and Processing Functions ---
	 function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Knihovna Supabase nebyla správně načtena."); } supabase = window.supabase.createClient(supabaseUrl, supabaseKey); if (!supabase) throw new Error("Vytvoření klienta Supabase selhalo."); console.log('[Supabase] Klient úspěšně inicializován.'); return true; } catch (error) { console.error('[Supabase] Inicializace selhala:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }
	 async function fetchUserProfile(userId) { if (!supabase || !userId) return null; console.log(`[Profile] Fetching profile for user ID: ${userId}`); try { const { data: profile, error } = await supabase.from('profiles').select('*, selected_title').eq('id', userId).single(); if (error && error.code !== 'PGRST116') { throw error; } if (!profile) { console.warn(`[Profile] Profile not found for user ${userId}.`); return null; } console.log("[Profile] Profile data fetched."); return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); showToast('Chyba', 'Nepodařilo se načíst data profilu.', 'error'); return null; } }
	 async function fetchTitles() { if (!supabase) return []; console.log("[Titles] Fetching available titles..."); try { const { data, error } = await supabase.from('title_shop').select('title_key, name'); if (error) throw error; console.log("[Titles] Fetched titles:", data); return data || []; } catch (error) { console.error("[Titles] Error fetching titles:", error); return []; } }
     async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) { if (!supabase || !userId) { console.error("[Notifications] Missing Supabase or User ID."); return { unreadCount: 0, notifications: [] }; } try { const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } }
     async function markNotificationRead(notificationId) { if (!currentUser || !notificationId || !supabase) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; return true; } catch (error) { console.error("[FUNC] markNotificationRead: Error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
     async function markAllNotificationsRead() { if (!currentUser || !ui.markAllReadBtn || !supabase) return; setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false); if (error) throw error; const { unreadCount, notifications } = await fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[FUNC] markAllNotificationsRead: Error:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }

     /**
      * Fetches practice statistics for the user.
      * Replace this with actual Supabase query for user_exercises or similar table.
      */
     async function fetchPracticeStats(userId) {
        if (!supabase || !userId) return null;
        console.log(`[Practice Stats] Fetching for user ${userId}...`);
        // **Placeholder Logic - Replace with your actual Supabase query**
        try {
            // Example: Query 'user_exercises' table
            const { data: exercises, error, count } = await supabase
                .from('user_exercises') // Assuming this table exists
                .select('status, score, attempts, last_attempt, exercise_id', { count: 'exact' })
                .eq('user_id', userId);

            if (error) throw error;

            const completedCount = exercises?.filter(ex => ex.status === 'completed').length ?? 0;
            const totalAttempts = exercises?.reduce((sum, ex) => sum + (ex.attempts ?? 0), 0) ?? 0;
            const completedExercises = exercises?.filter(ex => ex.status === 'completed' && ex.score !== null) ?? [];
            const averageScore = completedExercises.length > 0
                ? completedExercises.reduce((sum, ex) => sum + (ex.score ?? 0), 0) / completedExercises.length
                : 0;

            // You might want to fetch total time spent from another table or calculate it differently
            // Placeholder for total time (e.g., sum from 'activities' table for type 'exercise')
             const { data: timeData, error: timeError } = await supabase
                .from('activities')
                 .select('time_spent') // Assuming 'time_spent' is a column in seconds or minutes
                 .eq('user_id', userId)
                 .eq('type', 'exercise'); // Or filter by reference_id based on user_exercises

             const totalTimeMinutes = timeData ? timeData.reduce((sum, act) => sum + (act.time_spent || 0), 0) : 0; // Assuming time is in minutes

            const stats = {
                totalProgress: currentProfile?.progress ?? 0, // Use overall progress from profile for now?
                averageAccuracy: Math.round(averageScore), // Assuming score is out of 100
                totalTimeMinutes: totalTimeMinutes,
                completedExercisesCount: completedCount,
                // Add other relevant stats here
            };
            console.log("[Practice Stats] Fetched stats:", stats);
            return stats;

        } catch (error) {
            console.error('[Practice Stats] Error fetching:', error);
            showToast('Chyba', 'Nepodařilo se načíst statistiky procvičování.', 'error');
            return null;
        }
     }

	// --- END: Data Loading ---

	// --- START: UI Update Functions ---
	 function updateUserInfoUI() { // Copied from dashboard.js for consistency
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) return;
        if (currentUser && currentProfile) {
            const firstName = currentProfile.first_name ?? '';
            const displayName = firstName || currentProfile.username || currentUser?.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(currentProfile);
            const avatarUrl = currentProfile.avatar_url;
            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); // Add cache buster
            const selectedTitleKey = currentProfile.selected_title;
            let displayTitle = 'Pilot'; // Default
            if (selectedTitleKey && allTitles && allTitles.length > 0) {
                const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) displayTitle = foundTitle.name;
            }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle));
        } else {
            ui.sidebarName.textContent = "Nepřihlášen";
            ui.sidebarAvatar.textContent = '?';
            ui.sidebarUserTitle.textContent = 'Pilot';
            ui.sidebarUserTitle.removeAttribute('title');
        }
    }
	 function renderNotifications(count, notifications) { // Copied from dashboard.js
         if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { setLoadingState('notifications', false); return; }
         ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
         ui.notificationCount.classList.toggle('visible', count > 0);
         if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } setLoadingState('notifications', false);
    }
	 function renderNotificationSkeletons(count = 2) { // Copied from dashboard.js
         if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block';
    }

     /**
      * Renders the "Celkový Přehled" (Overall Overview) section.
      * Uses fetched userPracticeStats.
      */
     function renderOverviewStats(stats) {
         if (!ui.statsCardsContainer) return;
         setLoadingState('stats', false); // Stop loading state for stats

         const statCards = {
             progress: ui.statsCardsContainer.querySelector('#stats-card-progress'),
             accuracy: ui.statsCardsContainer.querySelector('#stats-card-accuracy'),
             time: ui.statsCardsContainer.querySelector('#stats-card-time'),
             completed: ui.statsCardsContainer.querySelector('#stats-card-completed'),
         };

         if (!stats) {
             console.warn("[Overview Stats] No stats data provided. Showing error state.");
             Object.values(statCards).forEach(card => {
                 if (card) {
                     card.classList.remove('loading');
                     card.innerHTML = `
                        <div class="card-header">
                            <h3 class="card-title">Chyba</h3>
                        </div>
                        <div class="card-content">
                            <div class="card-value" style="color: var(--accent-pink);">ERR</div>
                            <div class="card-description">Data nelze načíst</div>
                        </div>
                        <div class="card-footer"><i class="fas fa-exclamation-triangle"></i> Zkuste obnovit</div>
                    `;
                 }
             });
             return;
         }

         // Helper to safely update card content
         const updateCard = (card, title, value, description, footer, iconClass = 'fa-question-circle', badge = null) => {
            if (!card) return;
            card.classList.remove('loading');
            let badgeHTML = badge ? `<span class="card-badge ${badge.class}">${badge.text}</span>` : '';
            card.innerHTML = `
                <div class="card-header">
                    <h3 class="card-title">${title}</h3>
                    ${badgeHTML}
                </div>
                <div class="card-content">
                    <div class="card-value">${value}</div>
                    <div class="card-description">${description}</div>
                </div>
                <div class="card-footer ${footer.class || ''}"><i class="fas ${footer.icon || 'fa-info-circle'}"></i> ${footer.text}</div>
            `;
         };

         // Populate cards with data (Adjust values and descriptions as needed)
         updateCard(statCards.progress, 'Celkový pokrok', `${stats.totalProgress}%`, 'Průměr ze všech cvičení', { text: 'Na základě vašeho profilu' }, 'fa-chart-line');
         updateCard(statCards.accuracy, 'Průměrná přesnost', `${stats.averageAccuracy}%`, 'Průměrné skóre v dokončených cvičeních', { text: 'Vyšší je lepší' }, 'fa-bullseye', stats.averageAccuracy >= 80 ? { text: 'Výborné', class: 'success'} : stats.averageAccuracy >= 60 ? { text: 'Dobré', class: 'info'} : { text: 'Zlepšit', class: 'warning'} );
         updateCard(statCards.time, 'Celkový čas', `${stats.totalTimeMinutes} min`, 'Čas strávený procvičováním', { text: 'Celkem stráveno' }, 'fa-stopwatch');
         updateCard(statCards.completed, 'Dokončeno cvičení', `${stats.completedExercisesCount}`, 'Počet úspěšně dokončených cvičení', { text: 'Cvičení celkem' }, 'fa-check-double'); // Use double check icon

         console.log("[Overview Stats] Stats cards rendered.");
     }

     /**
      * Sets up the "Rychlé Akce" (Quick Actions) section.
      * Adds event listeners or sets href attributes.
      */
     function setupQuickActions() {
         if (!ui.shortcutsGrid) return;
         setLoadingState('shortcuts', false); // Stop loading state for shortcuts

         // Remove loading class from skeleton cards
          ui.shortcutsGrid.querySelectorAll('.shortcut-card').forEach(card => card.classList.remove('loading'));

         // **Replace placeholders with actual functionality**
         // Example: Link to a specific math practice page/mode
         if (ui.startMathBtn) {
             // Option 1: Simple Link
             // ui.startMathBtn.href = '/dashboard/procvicovani/math-practice.html';
             // Option 2: Trigger JS function
             ui.startMathBtn.addEventListener('click', () => {
                 console.log("Starting Math Practice...");
                 // Add your logic here, e.g., startTest('math');
                 showToast('Info', 'Funkce "Procvičit Matematiku" zatím není implementována.', 'info');
             });
             ui.startMathBtn.querySelector('.shortcut-title').textContent = 'Procvičit Matematiku';
             ui.startMathBtn.querySelector('.shortcut-desc').textContent = 'Spusťte cvičení zaměřené na matematiku.';
             ui.startMathBtn.querySelector('.shortcut-icon i').className = 'fas fa-calculator';
         }

         // Example: Link to language practice
         if (ui.startLangBtn) {
             // ui.startLangBtn.href = '/dashboard/procvicovani/language-practice.html';
             ui.startLangBtn.addEventListener('click', () => {
                 console.log("Starting Language Practice...");
                 showToast('Info', 'Funkce "Procvičit Jazyky" zatím není implementována.', 'info');
             });
             ui.startLangBtn.querySelector('.shortcut-title').textContent = 'Procvičit Jazyky';
             ui.startLangBtn.querySelector('.shortcut-desc').textContent = 'Zaměřte se na český jazyk a gramatiku.';
             ui.startLangBtn.querySelector('.shortcut-icon i').className = 'fas fa-language';
         }

         // Example: Start a random exercise
         if (ui.startRandomBtn) {
             ui.startRandomBtn.addEventListener('click', () => {
                 console.log("Starting Random Practice...");
                 showToast('Info', 'Funkce "Náhodné Cvičení" zatím není implementována.', 'info');
             });
             ui.startRandomBtn.querySelector('.shortcut-title').textContent = 'Náhodné Cvičení';
             ui.startRandomBtn.querySelector('.shortcut-desc').textContent = 'Spusťte náhodně vybrané cvičení.';
              ui.startRandomBtn.querySelector('.shortcut-icon i').className = 'fas fa-random'; // Example icon
         }

          // Example: Link to view exercise history
          if (ui.viewHistoryBtn) {
              // This might be a tab switch or a link to another page
              ui.viewHistoryBtn.addEventListener('click', () => {
                  // Option A: Switch Tab (if on the same page)
                  // switchTab('history-tab'); // Assuming you have a function switchTab
                  // Option B: Go to another page
                  window.location.href = '/dashboard/pokrok.html'; // Link to progress page
                  console.log("Viewing History...");
              });
               ui.viewHistoryBtn.querySelector('.shortcut-title').textContent = 'Historie Cvičení';
               ui.viewHistoryBtn.querySelector('.shortcut-desc').textContent = 'Prohlédněte si své předchozí výsledky.';
               ui.viewHistoryBtn.querySelector('.shortcut-icon i').className = 'fas fa-history'; // Example icon
          }
         console.log("[Quick Actions] Setup complete.");
     }

     /**
      * Renders the list of available exercises (Placeholder function)
      * This needs to be implemented based on how you fetch and structure exercise data.
      */
     function renderExerciseList(exercises) {
         if (!ui.exerciseListContainer || !ui.exerciseList) return;
         setLoadingState('exercises', false);
         ui.exerciseList.innerHTML = ''; // Clear previous content/skeletons

         if (!exercises || exercises.length === 0) {
             ui.exerciseList.innerHTML = '<p class="empty-state">Nebyly nalezeny žádné dostupné cvičení.</p>';
             return;
         }

         // Example rendering (replace with your actual exercise card structure)
         exercises.forEach(ex => {
             const card = document.createElement('div');
             card.className = 'exercise-card card'; // Assuming you have this CSS class
             card.innerHTML = `
                 <h4>${sanitizeHTML(ex.title || 'Neznámé cvičení')}</h4>
                 <p>${sanitizeHTML(ex.description || 'Popis není k dispozici.')}</p>
                 <span>Obtížnost: ${ex.difficulty || '?'}</span>
                 <button class="btn btn-sm btn-primary">Spustit</button>
             `;
             // Add event listener to the button if needed
             card.querySelector('button').addEventListener('click', () => {
                 console.log(`Starting exercise ${ex.id}`);
                 // Add logic to start the exercise
             });
             ui.exerciseList.appendChild(card);
         });
         console.log("[Exercise List] Rendered exercise list.");
     }
	 // --- END: UI Update Functions ---

	// --- START: Event Listener Setup ---
	 function setupEventListeners() { // Combined setup
		 console.log("[SETUP] Setting up event listeners...");
		 // Sidebar/Menu
		 if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
		 if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
		 if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
		 if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar); // Sidebar collapse
		 document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });
		 // Refresh
		 if (ui.refreshDataBtn) ui.refreshDataBtn.addEventListener('click', loadPageData); // Reload all data on refresh
		 // Notifications (Copied from dashboard.js)
		 if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
		 if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); }
		 if (ui.notificationsList) {
			 ui.notificationsList.addEventListener('click', async (event) => {
				 const item = event.target.closest('.notification-item');
				 if (item) {
					 const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read');
					 if (!isRead && notificationId) {
						 const success = await markNotificationRead(notificationId); // Use the core function
						 if (success) { // Update UI only if successful
							 item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); ui.markAllReadBtn.disabled = newCount === 0;
						 }
					 }
					 if (link) window.location.href = link;
					 // Optionally close dropdown: ui.notificationsDropdown?.classList.remove('active');
				 }
			 });
		 }
		 document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } });
		 // Online/Offline
		 window.addEventListener('online', updateOnlineStatus);
		 window.addEventListener('offline', updateOnlineStatus);
		 // Scroll
		 if (ui.mainContent) ui.mainContent.addEventListener('scroll', handleScroll, { passive: true });
		 console.log("[SETUP] Event listeners set up.");
	 }
	 // --- END: Event Listener Setup ---

	// --- START: Main Application Logic ---
	 async function loadPageData() {
		 if (!currentUser || !currentProfile || !supabase) {
			 showError("Chyba: Uživatel není přihlášen nebo chybí spojení.");
			 setLoadingState('all', false);
			 return;
		 }
		 if (Object.values(isLoading).some(s => s && s !== isLoading.page)) { // Don't reload if other sections are loading
             console.log("[LoadPageData] Skipping reload, other sections are busy.");
             showToast('Info', 'Data se již načítají...', 'info', 2000);
             // Reset refresh button if it was clicked
             if (ui.refreshDataBtn) {
                const icon = ui.refreshDataBtn.querySelector('i');
                const text = ui.refreshDataBtn.querySelector('.refresh-text');
                if (icon?.classList.contains('fa-spin')) icon.classList.remove('fa-spin');
                if (text?.textContent.includes('RELOADING')) text.textContent = 'RELOAD';
                ui.refreshDataBtn.disabled = false;
            }
             return;
         }
		 console.log("🔄 [LoadPageData] Starting data fetch for procvicovani/main...");
		 hideError();
		 setLoadingState('all', true);

		 try {
			 const [statsResult, notificationsResult] = await Promise.allSettled([
				 fetchPracticeStats(currentUser.id),
				 fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT)
				 // Add fetch for exercises list here if needed:
				 // fetchExercisesList(currentUser.id, /* filters? */),
			 ]);

			 // Process Stats
			 if (statsResult.status === 'fulfilled') {
				 userPracticeStats = statsResult.value;
				 renderOverviewStats(userPracticeStats);
			 } else {
				 console.error("❌ Error fetching practice stats:", statsResult.reason);
                 showError("Nepodařilo se načíst přehled statistik.", false);
				 renderOverviewStats(null); // Render error state in cards
			 }

			 // Process Notifications
			 if (notificationsResult.status === 'fulfilled') {
				 const { unreadCount, notifications } = notificationsResult.value || { unreadCount: 0, notifications: [] };
				 renderNotifications(unreadCount, notifications);
			 } else {
				 console.error("❌ Error fetching notifications:", notificationsResult.reason);
                 showError("Nepodařilo se načíst oznámení.", false);
				 renderNotifications(0, []); // Render empty state on error
			 }

			 // Setup Quick Actions (assumed not data dependent, just sets up links/listeners)
			 setupQuickActions();

             // Render Exercise List (if fetched)
             // if (exercisesResult.status === 'fulfilled') {
             //     renderExerciseList(exercisesResult.value);
             // } else {
             //     console.error("❌ Error fetching exercises:", exercisesResult.reason);
             //     renderExerciseList(null); // Handle error state for exercises
             // }

			 initTooltips(); // Re-initialize tooltips for any new elements
			 console.log("✅ [LoadPageData] All data fetched and rendered.");

		 } catch (error) {
			 console.error("❌ Unexpected error in loadPageData:", error);
			 showError(`Nastala neočekávaná chyba při načítání stránky: ${error.message}`, true);
			 // Render error states for all sections
			 renderOverviewStats(null);
			 setupQuickActions(); // Still try to set up static actions
			 renderNotifications(0, []);
             // renderExerciseList(null);
		 } finally {
			 setLoadingState('all', false); // Ensure all loading states are off
		 }
	 }

	 async function initializeApp() {
		 console.log("🚀 [Init Procvičování Main - Kyber v2] Starting...");
		 if (!initializeSupabase()) return; // Init Supabase first

		 applyInitialSidebarState(); // Apply sidebar state early
		 setupEventListeners(); // Setup base listeners early

		 if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
		 if (ui.mainContent) ui.mainContent.style.display = 'none';

		 try {
			 console.log("[INIT] Checking auth session...");
			 const { data: { session }, error: sessionError } = await supabase.auth.getSession();
			 if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);

			 if (!session || !session.user) { console.log('[INIT] User not logged in. Redirecting...'); window.location.href = '/auth/index.html'; return; }
			 currentUser = session.user;
			 console.log(`[INIT] User authenticated (ID: ${currentUser.id}). Loading profile and titles...`);

			 // Fetch profile and titles concurrently
			 const [profileResult, titlesResult] = await Promise.allSettled([
				 fetchUserProfile(currentUser.id),
				 fetchTitles()
			 ]);

			 if (profileResult.status === 'fulfilled' && profileResult.value) { currentProfile = profileResult.value; console.log("[INIT] Profile loaded."); }
			 else { throw new Error(`Nepodařilo se načíst profil: ${profileResult.reason || 'Nenalezen'}`); }

			 if (titlesResult.status === 'fulfilled') { allTitles = titlesResult.value || []; console.log("[INIT] Titles loaded."); }
			 else { console.warn("[INIT] Failed to load titles:", titlesResult.reason); allTitles = []; }

			 updateUserInfoUI(); // Update sidebar with profile and title

			 // Load page-specific data (stats, notifications, etc.)
			 await loadPageData();

			 // Initialize UI enhancements after data is loaded
			 initTooltips();
			 initMouseFollower();
			 initHeaderScrollDetection();
			 updateCopyrightYear();
			 updateOnlineStatus();

			 if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if(ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }
			 if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); } // Add animations after load

			 console.log("✅ [Init Procvičování Main - Kyber v2] Page initialized.");

		 } catch (error) {
			 console.error("❌ [Init Procvičování Main - Kyber v2] Critical initialization error:", error);
			 if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). Obnovte.</p>`; }
			 else { showError(`Chyba inicializace: ${error.message}`, true); }
			 if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show content to display error
			 setLoadingState('all', false); // Ensure loading indicators are off
		 }
	 }
	// --- END: Main Application Logic ---

	// --- START THE APP ---
	initializeApp();

})(); // End IIFE