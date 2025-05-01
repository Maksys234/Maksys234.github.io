// dashboard/procvicovani/main.js
// Version: 2.2 (Fixes Supabase query, uses corrected selectors, removes time stat)
(function() {
	'use strict';

	// --- START: Configuration & State ---
	const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
	const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
	const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
    const NOTIFICATION_FETCH_LIMIT = 5;
	let supabase = null;
	let currentUser = null;
	let currentProfile = null;
    let allTitles = [];
    let userPracticeStats = null;
    let isLoading = { page: true, stats: false, shortcuts: false, notifications: false, exercises: false };

	// DOM Elements Cache
	const ui = {
		initialLoader: document.getElementById('initial-loader'),
        mainContent: document.getElementById('main-content'),
        globalError: document.getElementById('global-error'),
        offlineBanner: document.getElementById('offline-banner'),
		sidebarOverlay: document.getElementById('sidebar-overlay'),
		sidebar: document.getElementById('sidebar'),
		mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
		sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
		sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
		sidebarAvatar: document.getElementById('sidebar-avatar'),
		sidebarName: document.getElementById('sidebar-name'),
        sidebarUserTitle: document.getElementById('sidebar-user-title'),
		currentYearSidebar: document.getElementById('currentYearSidebar'),
		currentYearFooter: document.getElementById('currentYearFooter'),
		dashboardHeader: document.querySelector('.dashboard-header'),
		refreshDataBtn: document.getElementById('refresh-data-btn'),
		notificationBell: document.getElementById('notification-bell'),
		notificationCount: document.getElementById('notification-count'),
		notificationsDropdown: document.getElementById('notifications-dropdown'),
		notificationsList: document.getElementById('notifications-list'),
		noNotificationsMsg: document.getElementById('no-notifications-msg'),
		markAllReadBtn: document.getElementById('mark-all-read'),
		tabsWrapper: document.querySelector('.tabs-wrapper'),
		contentTabs: document.querySelectorAll('.content-tab'),
		tabContents: document.querySelectorAll('.tab-content'),
        // **Celkový Přehled (Stats/Overview) Elements** - Using assumed IDs from dashboard.html structure
        statsCardsContainer: document.getElementById('stats-cards'), // Main container for stats
        statsProgressCard: document.getElementById('progress-card'), // Card for Progress
        statsPointsCard: document.getElementById('points-card'),     // Card for Points
        statsStreakCard: document.getElementById('streak-card'),     // Card for Streak
        statsExercisesCard: document.getElementById('exercises-card'), // Card for Exercises (Added Assumption)
        // **Rychlé Akce (Quick Actions) Elements** - Using assumed container ID
        shortcutsGrid: document.getElementById('shortcuts-grid'),
        // Content Area for Exercises/Tests
        exerciseListContainer: document.getElementById('exercise-list-container'),
        exerciseList: document.getElementById('exercise-list'),
		// Other
		toastContainer: document.getElementById('toast-container'),
		mouseFollower: document.getElementById('mouse-follower')
	};

	// Visuals
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

	// --- START: Helper Functions ---
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
         // Handle exercises loading
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
     const initHeaderScrollDetection = () => {
         let lastScrollY = window.scrollY;
         const mainEl = ui.mainContent;
         if (!mainEl) { console.warn("Main content element not found for scroll detection."); return; }
         const handleScroll = () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; };
         mainEl.addEventListener('scroll', handleScroll, { passive: true });
         if (mainEl.scrollTop > 10) { document.body.classList.add('scrolled'); }
         console.log("Header scroll detection initialized.");
     };
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
      * Fetches practice statistics for the user. (Corrected Version 2.2)
      */
     async function fetchPracticeStats(userId) {
        if (!supabase || !userId) return null;
        console.log(`[Practice Stats] Fetching for user ${userId}...`);
        try {
            // Fetch basic user info (points, exercises completed from profile)
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('points, completed_exercises, level') // Select relevant fields from profiles
                .eq('id', userId)
                .single();

            if (profileError && profileError.code !== 'PGRST116') {
                console.error("[Practice Stats] Error fetching profile data:", profileError);
                // Don't throw, try to continue with other data if possible
            }

            // Fetch user exercise details (status, score)
            const { data: exercises, error: exercisesError } = await supabase
                .from('user_exercises')
                .select('status, score') // Select only needed fields
                .eq('user_id', userId);

            if (exercisesError) {
                console.error("[Practice Stats] Error fetching user_exercises:", exercisesError);
                // Don't throw, try to calculate based on profile if possible
            }

            const completedExercisesData = exercises?.filter(ex => ex.status === 'completed' && ex.score !== null) ?? [];
            const completedCount = completedExercisesData.length; // More reliable count
            const averageAccuracy = completedCount > 0
                ? Math.round(completedExercisesData.reduce((sum, ex) => sum + (ex.score ?? 0), 0) / completedCount)
                : 0; // Assume score is out of 100 or needs scaling

            // Note: Total Time calculation removed as there's no reliable source in provided tables.

            const stats = {
                totalProgress: profileData?.level ?? 1, // Use level as a proxy for progress? Or fetch from user_stats if available
                averageAccuracy: averageAccuracy,
                totalTimeMinutes: '?', // Indicate that time is unavailable
                completedExercisesCount: profileData?.completed_exercises ?? completedCount, // Prefer profile count if available, else use calculated
            };
            console.log("[Practice Stats] Fetched/calculated stats:", stats);
            userPracticeStats = stats;
            return stats;

        } catch (error) {
            console.error('[Practice Stats] Error fetching:', error);
            showToast('Chyba', 'Nepodařilo se načíst statistiky procvičování.', 'error');
            return null;
        }
     }
	// --- END: Data Loading ---

	// --- START: UI Update Functions ---
	 function updateUserInfoUI() {
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) return;
        if (currentUser && currentProfile) {
            const firstName = currentProfile.first_name ?? '';
            const displayName = firstName || currentProfile.username || currentUser?.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(currentProfile);
            const avatarUrl = currentProfile.avatar_url;
            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
            const selectedTitleKey = currentProfile.selected_title;
            let displayTitle = 'Pilot';
            if (selectedTitleKey && allTitles && allTitles.length > 0) { const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) displayTitle = foundTitle.name; }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle));
        } else { ui.sidebarName.textContent = "Nepřihlášen"; ui.sidebarAvatar.textContent = '?'; ui.sidebarUserTitle.textContent = 'Pilot'; ui.sidebarUserTitle.removeAttribute('title'); }
    }
	 function renderNotifications(count, notifications) {
         if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { return; }
         ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
         ui.notificationCount.classList.toggle('visible', count > 0);
         if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; }
    }
	 function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }

     /**
      * Renders the "Celkový Přehled" (Overall Overview) section. (Corrected Version 2.2)
      * Uses corrected card IDs based on dashboard.html structure.
      */
     function renderOverviewStats(stats) {
         if (!ui.statsCardsContainer) { console.warn("[Overview Stats] Stats container #stats-cards not found."); return; }
         setLoadingState('stats', false);

         // **Using IDs assumed from dashboard.html structure**
         const statCards = {
             progress: ui.statsCardsContainer.querySelector('#progress-card'),
             accuracy: ui.statsCardsContainer.querySelector('#points-card'), // Assuming points card shows accuracy/score
             time: ui.statsCardsContainer.querySelector('#streak-card'),     // Assuming streak card shows time (or remove time)
             completed: ui.statsCardsContainer.querySelector('#exercises-card'), // Assuming a 4th card for exercises
         };

         const updateCard = (card, titleHTML, valueHTML, descriptionHTML, footerHTML, iconClass = 'fa-question-circle', badge = null) => {
            if (!card) { console.warn(`[Overview Stats Update] Card element not found for title "${titleHTML}".`); return; }
            card.classList.remove('loading');
            let badgeHTML = badge ? `<span class="card-badge ${badge.class}">${badge.text}</span>` : '';
            // Using the structure from dashboard.css/html for .dashboard-card
            card.innerHTML = `
                <div class="loading-skeleton" style="display: none;"> ... </div>
                <div class="card-header">
                    <h3 class="card-title">${titleHTML}</h3>
                    ${badgeHTML}
                </div>
                <div class="card-content">
                    <div class="card-value">${valueHTML}</div>
                    <div class="card-description">${descriptionHTML}</div>
                </div>
                <div class="card-footer ${footerHTML.class || ''}">${footerHTML.text}</div>
            `;
         };

         if (!stats) { // Handle error/no data case
             console.warn("[Overview Stats] No stats data. Rendering error state.");
             updateCard(statCards.progress, '<i class="fas fa-tasks"></i> Celkový pokrok', '<i class="fas fa-exclamation-triangle"></i> Err', 'Nelze načíst', { text: '<i class="fas fa-redo"></i> Zkusit znovu', class: 'negative'});
             updateCard(statCards.accuracy, '<i class="fas fa-bullseye"></i> Prům. přesnost', '<i class="fas fa-exclamation-triangle"></i> Err', 'Nelze načíst', { text: '<i class="fas fa-redo"></i> Zkusit znovu', class: 'negative'});
             updateCard(statCards.time, '<i class="fas fa-stopwatch"></i> Celkový čas', '<i class="fas fa-ban"></i> N/A', 'Čas není sledován', { text: '<i class="fas fa-info-circle"></i>--', class: ''}); // Indicate time is N/A
             updateCard(statCards.completed, '<i class="fas fa-check-double"></i> Dokončeno cvičení', '<i class="fas fa-exclamation-triangle"></i> Err', 'Nelze načíst', { text: '<i class="fas fa-redo"></i> Zkusit znovu', class: 'negative'});
             return;
         }

         // Populate cards with actual data (Adapt based on available stats)
         const progress = stats.totalProgress || 0; // Use level or profile progress?
         updateCard(statCards.progress, '<i class="fas fa-chart-line"></i> Pokrok (Úroveň)', `${progress}`, 'Aktuální úroveň uživatele', { text: 'Vyšší je lepší', icon: 'fa-user-check', class: 'positive'});

         const accuracy = stats.averageAccuracy || 0;
         updateCard(statCards.accuracy, '<i class="fas fa-bullseye"></i> Prům. přesnost', `${accuracy}%`, 'Prům. skóre v úlohách', { text: 'Na základě dokončených úloh', icon: 'fa-history'}, accuracy >= 80 ? { text: 'Výborné', class: 'success'} : accuracy >= 60 ? { text: 'Dobré', class: 'info'} : { text: 'Zlepšit', class: 'warning'} );

         // Time card is now N/A
         updateCard(statCards.time, '<i class="fas fa-stopwatch"></i> Celkový čas', '<i class="fas fa-ban"></i> N/A', 'Čas cvičení není sledován', { text: '<i class="fas fa-info-circle"></i> --', class: ''});

         const completedCount = stats.completedExercisesCount || 0;
         updateCard(statCards.completed, '<i class="fas fa-check-double"></i> Dokončená cvičení', `${completedCount}`, 'Počet zvládnutých cvičení', { text: 'Celkový počet', icon: 'fa-tasks' });

         console.log("[Overview Stats] Stats cards rendered.");
     }

     /**
      * Sets up the "Rychlé Akce" (Quick Actions) section. (Corrected Version 2.2)
      * Uses data-action attributes assumed from dashboard.html structure.
      */
     function setupQuickActions() {
         if (!ui.shortcutsGrid) { console.warn("[Quick Actions] Shortcuts grid #shortcuts-grid not found."); return; }
         setLoadingState('shortcuts', false);

         // Remove loading class from skeleton cards first
          ui.shortcutsGrid.querySelectorAll('.shortcut-card').forEach(card => card.classList.remove('loading'));

         // Function to update a shortcut card
         const updateShortcut = (action, href, iconClass, title, description) => {
             const btnElement = ui.shortcutsGrid.querySelector(`[data-action="${action}"]`);
             if (!btnElement) { console.warn(`[Quick Actions] Shortcut element with data-action="${action}" not found.`); return; }
             const iconEl = btnElement.querySelector('.shortcut-icon i');
             const titleEl = btnElement.querySelector('.shortcut-title');
             const descEl = btnElement.querySelector('.shortcut-desc');

             // Set href for <a> tags, or add click listener for other elements
             if (btnElement.tagName === 'A') {
                 btnElement.href = href;
             } else {
                 btnElement.addEventListener('click', () => {
                     if (href.startsWith('/')) {
                         window.location.href = href;
                     } else {
                          // Handle non-link actions if necessary
                          console.log(`Action "${action}" triggered.`);
                          showToast('Info', `Akce "${title}" zatím není plně implementována.`, 'info');
                     }
                 });
             }

             if (iconEl) iconEl.className = `fas ${iconClass}`;
             if (titleEl) titleEl.textContent = title;
             if (descEl) descEl.textContent = description;
         };

         // Update each shortcut card based on assumed data-action attributes
         updateShortcut('start-math', 'vyuka/vyuka.html?topic=matematika', 'fa-calculator', 'Procvičit Matematiku', 'Spusťte cvičení zaměřené na matematiku.');
         updateShortcut('start-lang', 'vyuka/vyuka.html?topic=jazyky', 'fa-language', 'Procvičit Jazyky', 'Zaměřte se na český jazyk a gramatiku.');
         updateShortcut('start-random', '#', 'fa-random', 'Náhodné Cvičení', 'Spusťte náhodně vybrané cvičení.'); // '#' or JS function
         updateShortcut('view-history', '/dashboard/pokrok.html', 'fa-history', 'Historie Cvičení', 'Prohlédněte si své předchozí výsledky.');

         console.log("[Quick Actions] Setup complete.");
     }

     /**
      * Renders the list of available exercises (Placeholder).
      */
     function renderExerciseList(exercises) {
         console.log("[Exercise List] Rendering is currently a placeholder.");
         setLoadingState('exercises', false);
         if (ui.exerciseList) {
             ui.exerciseList.innerHTML = '<p class="empty-state" style="display:block; border:none; padding: 2rem;">Seznam cvičení bude dostupný brzy.</p>';
         }
     }
	 // --- END: UI Update Functions ---

	// --- START: Event Listener Setup ---
	 function setupEventListeners() {
		 console.log("[SETUP] Setting up event listeners...");
		 // Sidebar/Menu
		 if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
		 if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
		 if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
		 if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);
		 document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });
		 // Refresh
		 if (ui.refreshDataBtn) ui.refreshDataBtn.addEventListener('click', () => loadPageData(true));
		 // Notifications
		 if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
		 if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); }
		 if (ui.notificationsList) {
			 ui.notificationsList.addEventListener('click', async (event) => {
				 const item = event.target.closest('.notification-item');
				 if (item) {
					 const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read');
					 if (!isRead && notificationId) {
						 const success = await markNotificationRead(notificationId);
						 if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); ui.markAllReadBtn.disabled = newCount === 0; }
					 }
					 if (link) window.location.href = link;
				 }
			 });
		 }
		 document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } });
		 // Online/Offline
		 window.addEventListener('online', updateOnlineStatus);
		 window.addEventListener('offline', updateOnlineStatus);
         // Scroll - Call initHeaderScrollDetection once, not as the listener
         // initHeaderScrollDetection(); // Moved to initializeApp
		 console.log("[SETUP] Event listeners set up.");
	 }
	 // --- END: Event Listener Setup ---

	// --- START: Main Application Logic ---
	 async function loadPageData(forceRefresh = false) {
		 if (!currentUser || !currentProfile || !supabase) { showError("Chyba: Uživatel není přihlášen nebo chybí spojení."); setLoadingState('all', false); return; }
		 if (Object.values(isLoading).some(s => s && s !== isLoading.page && s !== isLoading.notifications) && !forceRefresh) { console.log("[LoadPageData] Skipping load, data is already loading/fresh."); showToast('Info', 'Data jsou aktuální.', 'info', 2000); if (ui.refreshDataBtn) { const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon?.classList.contains('fa-spin')) icon.classList.remove('fa-spin'); if (text?.textContent.includes('RELOADING')) text.textContent = 'RELOAD'; ui.refreshDataBtn.disabled = false; } return; }

		 console.log(`🔄 [LoadPageData] Starting data fetch (forceRefresh: ${forceRefresh})...`);
		 hideError();
		 setLoadingState('stats', true);
         setLoadingState('shortcuts', true);
		 setLoadingState('notifications', true);
         // setLoadingState('exercises', true); // Uncomment if exercises are loaded

		 try {
			 const [statsResult, notificationsResult] = await Promise.allSettled([
				 fetchPracticeStats(currentUser.id),
				 fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT)
			 ]);

			 if (statsResult.status === 'fulfilled') { renderOverviewStats(statsResult.value); }
			 else { console.error("❌ Error fetching practice stats:", statsResult.reason); showError("Nepodařilo se načíst přehled statistik.", false); renderOverviewStats(null); }

			 if (notificationsResult.status === 'fulfilled') { const { unreadCount, notifications } = notificationsResult.value || { unreadCount: 0, notifications: [] }; renderNotifications(unreadCount, notifications); }
			 else { console.error("❌ Error fetching notifications:", notificationsResult.reason); showError("Nepodařilo se načíst oznámení.", false); renderNotifications(0, []); }

             setupQuickActions(); // Setup static actions

			 initTooltips();
			 console.log("✅ [LoadPageData] All data fetched and rendered.");

		 } catch (error) {
			 console.error("❌ Unexpected error in loadPageData:", error);
			 showError(`Nastala neočekávaná chyba při načítání stránky: ${error.message}`, true);
			 renderOverviewStats(null);
             setupQuickActions();
			 renderNotifications(0, []);
		 } finally {
			 setLoadingState('stats', false);
             setLoadingState('shortcuts', false);
             setLoadingState('notifications', false);
             // setLoadingState('exercises', false);
		 }
	 }

	 async function initializeApp() {
		 console.log("🚀 [Init Procvičování Main - Kyber v2.2] Starting...");
		 if (!initializeSupabase()) return;

		 applyInitialSidebarState();
		 setupEventListeners();

		 if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
		 if (ui.mainContent) ui.mainContent.style.display = 'none';

		 try {
			 console.log("[INIT] Checking auth session...");
			 const { data: { session }, error: sessionError } = await supabase.auth.getSession();
			 if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);

			 if (!session || !session.user) { console.log('[INIT] User not logged in. Redirecting...'); window.location.href = '/auth/index.html'; return; }
			 currentUser = session.user;
			 console.log(`[INIT] User authenticated (ID: ${currentUser.id}). Loading profile and titles...`);

			 const [profileResult, titlesResult] = await Promise.allSettled([
				 fetchUserProfile(currentUser.id),
				 fetchTitles()
			 ]);

			 if (profileResult.status === 'fulfilled' && profileResult.value) { currentProfile = profileResult.value; console.log("[INIT] Profile loaded."); }
			 else { throw new Error(`Nepodařilo se načíst profil: ${profileResult.reason || 'Nenalezen'}`); }

			 if (titlesResult.status === 'fulfilled') { allTitles = titlesResult.value || []; console.log("[INIT] Titles loaded."); }
			 else { console.warn("[INIT] Failed to load titles:", titlesResult.reason); allTitles = []; }

			 updateUserInfoUI();

			 await loadPageData();

			 initTooltips();
			 initMouseFollower();
			 initHeaderScrollDetection(); // **FIX**: Call this ONCE here
			 updateCopyrightYear();
			 updateOnlineStatus();

			 if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if(ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }
			 if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }

			 console.log("✅ [Init Procvičování Main - Kyber v2.2] Page initialized.");

		 } catch (error) {
			 console.error("❌ [Init Procvičování Main - Kyber v2.2] Critical initialization error:", error);
			 if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). Obnovte.</p>`; }
			 else { showError(`Chyba inicializace: ${error.message}`, true); }
			 if (ui.mainContent) ui.mainContent.style.display = 'block';
			 setLoadingState('all', false);
		 }
	 }
	// --- END: Main Application Logic ---

	// --- START THE APP ---
	initializeApp();

})(); // End IIFE