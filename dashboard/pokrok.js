// dashboard/pokrok.js
// Verze: 23.23.3 - Sidebar logic removed, sidebar state key removed.
// Sidebar UI elements (sidebarAvatar, sidebarName, sidebarUserTitle) are still cached for updateUserInfoUI.
(function() {
	const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
	const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
	let supabase = null;
	let currentUser = null;
	let currentProfile = null;
	let currentActivitiesPage = 1;
	const activitiesPerPage = 10;
	let totalActivitiesCount = 0;
	let currentSort = { column: 'created_at', direction: 'desc' };
	let currentFilter = 'all';
	let allActivitiesData = [];
	let allTitles = [];
	let isLoading = { stats: false, activities: false, notifications: false }; // Removed chart

	const ui = {
		 sidebarAvatar: document.getElementById('sidebar-avatar'), // Ponecháno pro updateUserInfoUI
		 sidebarName: document.getElementById('sidebar-name'),       // Ponecháno pro updateUserInfoUI
         sidebarUserTitle: document.getElementById('sidebar-user-title'), // Ponecháno pro updateUserInfoUI
		 // currentTime: document.getElementById('current-time'), // Stále neexistuje v HTML
		 refreshBtn: document.getElementById('refresh-btn'),
		 globalError: document.getElementById('global-error'),
		 statsGrid: document.getElementById('stats-grid'),
		 overallProgressValue: document.getElementById('overall-progress-value'),
		 overallProgressDesc: document.getElementById('overall-progress-desc'),
		 overallProgressFooter: document.getElementById('overall-progress-footer'),
		 totalPointsValue: document.getElementById('total-points-value'),
		 totalPointsDesc: document.getElementById('total-points-desc'),
		 totalPointsFooter: document.getElementById('total-points-footer'),
		 streakValue: document.getElementById('streak-value'),
		 streakDesc: document.getElementById('streak-desc'),
		 streakFooter: document.getElementById('streak-footer'),
		 completedCountValue: document.getElementById('completed-count-value'),
		 completedCountDesc: document.getElementById('completed-count-desc'),
		 completedCountFooter: document.getElementById('completed-count-footer'),
		 activitiesSection: document.getElementById('activities-section'),
		 tableLoadingOverlay: document.getElementById('table-loading-overlay'),
		 activitiesTable: document.getElementById('activities-table'),
		 activitiesBody: document.getElementById('activities-body'),
		 activitiesEmptyState: document.getElementById('activities-empty-state'),
		 activityTypeFilter: document.getElementById('activity-type-filter'),
		 exportTableBtn: document.getElementById('export-table-btn'),
		 tableHeaders: document.querySelectorAll('#activities-table th[data-sort]'),
		 paginationControls: document.getElementById('pagination-controls'),
		 prevPageBtn: document.getElementById('prev-page-btn'),
		 nextPageBtn: document.getElementById('next-page-btn'),
		 pageInfo: document.getElementById('page-info'),
		 toastContainer: document.getElementById('toast-container'),
         // sidebar, sidebarOverlay, sidebarCloseToggle, mainMobileMenuToggle, sidebarToggleBtn - ODEBRÁNY Z CACHE ZDE
         mainElement: document.getElementById('main-content'),
         dashboardHeader: document.querySelector('.dashboard-header'),
         initialLoader: document.getElementById('initial-loader'),
         mouseFollower: document.getElementById('mouse-follower'),
         currentYearSidebar: document.getElementById('currentYearSidebar'),
         currentYearFooter: document.getElementById('currentYearFooter'),
         notificationBell: document.getElementById('notification-bell'),
         notificationCount: document.getElementById('notification-count'),
         notificationsDropdown: document.getElementById('notifications-dropdown'),
         notificationsList: document.getElementById('notifications-list'),
         noNotificationsMsg: document.getElementById('no-notifications-msg'),
         markAllReadBtn: document.getElementById('mark-all-read'),
         userCreditsDisplayValue: document.getElementById('credits-value')
	};

	 const activityTypeMap = {
		 test: { name: 'Test', icon: 'fa-vial', class: 'test' },
		 exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' },
		 badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' },
		 diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' },
		 lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' },
		 plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' },
		 level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' },
		 other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' },
		 default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
	 };
	 const activityStatusMap = {
		 completed: { name: 'Dokončeno', class: 'completed', icon: 'fa-check-circle' },
		 'in-progress': { name: 'Probíhá', class: 'in-progress', icon: 'fa-spinner fa-spin' },
		 pending: { name: 'Čeká', class: 'pending', icon: 'fa-clock' },
		 failed: { name: 'Neúspěch', class: 'failed', icon: 'fa-times-circle' },
		 earned: { name: 'Získáno', class: 'earned', icon: 'fa-medal' },
		 generated: { name: 'Vygenerováno', class: 'generated', icon: 'fa-magic' },
		 skipped: { name: 'Přeskočeno', class: 'skipped', icon: 'fa-forward' },
		 default: { name: 'Neznámý', class: 'default', icon: 'fa-question-circle' }
	 };
     const activityVisuals = activityTypeMap; // Pro kompatibilitu s renderNotifications

	// --- Helper Functions ---
	function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
	function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
	function hideGlobalError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
	function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
	function formatDate(dateString, includeTime = false) { if (!dateString) return '-'; try { const date = new Date(dateString); if (isNaN(date.getTime())) return '-'; const optionsDate = { day: 'numeric', month: 'numeric', year: 'numeric' }; const optionsTime = { hour: '2-digit', minute: '2-digit' }; let formatted = date.toLocaleDateString('cs-CZ', optionsDate); if (includeTime) { formatted += ' ' + date.toLocaleTimeString('cs-CZ', optionsTime); } return formatted; } catch (e) { console.error("Chyba formátování data:", dateString, e); return '-'; } }
	function updateCurrentTime() { if (ui.currentTime) ui.currentTime.textContent = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }); }

    // Sidebar toggle a state funkce jsou nyní v sidebar-logic.js
    // openMenu, closeMenu, toggleSidebar, applyInitialSidebarState - ODEBRÁNY

    function handleScroll() { if (!ui.mainElement || !ui.dashboardHeader) return; document.body.classList.toggle('scrolled', ui.mainElement.scrollTop > 10); }
	function setLoadingState(section, isLoadingFlag) {
        if (isLoading[section] === isLoadingFlag && section !== 'all') return;
         if (section === 'all') { Object.keys(isLoading).forEach(key => isLoading[key] = isLoadingFlag); }
         else { isLoading[section] = isLoadingFlag; }
         console.log(`[setLoadingState] Sekce: ${section}, isLoading: ${isLoadingFlag}`);

         const overlayMap = { activities: ui.tableLoadingOverlay, notifications: null };
         const contentMap = { activities: ui.activitiesTable, notifications: ui.notificationsList };
         const emptyStateMap = { activities: ui.activitiesEmptyState, notifications: ui.noNotificationsMsg };
         const sectionsToUpdate = section === 'all' ? Object.keys(isLoading) : [section];

         sectionsToUpdate.forEach(sec => {
             if (sec === 'stats' && ui.statsGrid) {
                 ui.statsGrid.querySelectorAll('.stats-card').forEach(card => card.classList.toggle('loading', isLoadingFlag));
             }
             const overlay = overlayMap[sec];
             const contentEl = contentMap[sec];
             const emptyEl = emptyStateMap[sec];

             if (overlay) overlay.classList.toggle('hidden', !isLoadingFlag);

             if (isLoadingFlag) {
                 if (contentEl) contentEl.style.display = 'none';
                 if (emptyEl) emptyEl.style.display = 'none';
             }

             if (sec === 'activities' && ui.activitiesBody) {
                 if (isLoadingFlag) {
                     renderSkeletonRows(activitiesPerPage);
                     ui.activitiesBody.classList.add('loading');
                     if (ui.activitiesTable) ui.activitiesTable.style.display = 'table';
                     if (ui.paginationControls) ui.paginationControls.style.display = 'none';
                 } else {
                     ui.activitiesBody.classList.remove('loading');
                 }
             }
             if (sec === 'notifications' && ui.notificationBell) {
                 ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                 if (ui.markAllReadBtn) {
                     const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                     ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
                 }
                 if (isLoadingFlag && ui.notificationsList) { renderNotificationSkeletons(2); }
                 else if (!isLoadingFlag && emptyEl && ui.notificationsList?.innerHTML.trim() === '') { emptyEl.style.display = 'block'; }
             }
         });
    }
	function renderSkeletonRows(count = 5) { if (!ui.activitiesBody) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<tr class="skeleton-row"><td><div class="skeleton text-sm" style="width: 70px;"></div></td><td><div class="skeleton text-sm" style="width: 80px;"></div></td><td><div class="skeleton text-sm" style="width: 150px;"></div></td><td><div class="skeleton text-sm" style="width: 40px;"></div></td><td><div class="skeleton text-sm" style="width: 90px;"></div></td></tr>`; } ui.activitiesBody.innerHTML = skeletonHTML; }
	function initializeTooltips() { console.log("[Tooltips] Inicializace..."); try { if (window.jQuery && window.jQuery.fn.tooltipster) { window.jQuery('.btn-tooltip.tooltipstered').each(function() { if (document.body.contains(this)) { window.jQuery(this).tooltipster('destroy'); } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); console.log("[Tooltips] Initialized."); } else { console.warn("[Tooltips] jQuery or Tooltipster not loaded."); } } catch (e) { console.error("[Tooltips] Error initializing Tooltipster:", e); } }
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
    const initHeaderScrollDetection = () => { let lastScrollY = ui.mainElement?.scrollTop || 0; const mainEl = ui.mainElement; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); };
    const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };

	// --- Supabase Initialization ---
	function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Knihovna Supabase nebyla správně načtena."); } supabase = window.supabase.createClient(supabaseUrl, supabaseKey); if (!supabase) throw new Error("Vytvoření klienta Supabase selhalo."); console.log('[Supabase] Klient úspěšně inicializován.'); return true; } catch (error) { console.error('[Supabase] Inicializace selhala:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }

    async function fetchUserProfile(userId) {
        if (!supabase) { console.error("[Profile] Supabase client not available."); return null; }
        console.log(`[Profile] Fetching profile for user ID: ${userId}`);
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*, selected_title')
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') { throw error; }
            if (!profile) { console.warn(`[Profile] Profile for user ${userId} not found. Returning null.`); return null; }
            console.log("[Profile] Profile data fetched successfully.");
            return profile;
        } catch (error) {
            console.error('[Profile] Caught exception fetching profile:', error);
            showToast('Chyba', 'Nepodařilo se načíst data profilu.', 'error');
            return null;
        }
    }

    async function fetchTitles() {
        if (!supabase) return [];
        console.log("[Titles] Fetching available titles...");
        try {
            const { data, error } = await supabase
                .from('title_shop')
                .select('title_key, name');
            if (error) throw error;
            console.log("[Titles] Fetched titles:", data);
            return data || [];
        } catch (error) {
            console.error("[Titles] Error fetching titles:", error);
            showToast("Chyba načítání dostupných titulů.", "error");
            return [];
        }
    }

	async function loadAllData() {
        if (!currentUser || !supabase || !currentProfile) { showError("Nelze načíst data: Chybí informace o uživateli nebo spojení.", true); setLoadingState('all', false); return; }
        if (Object.values(isLoading).some(s => s)) { console.log("[LoadAllData] Přeskakuji - data se již načítají."); return; }
        console.log("🔄 [LoadAllData] Zahájení načítání dat...");
        hideGlobalError();
        setLoadingState('all', true);
        renderSkeletonRows(activitiesPerPage);

        try {
            const results = await Promise.allSettled([
                fetchUserStats(currentUser.id, currentProfile),
                fetchRecentActivities(currentUser.id, currentActivitiesPage, activitiesPerPage, currentSort.column, currentSort.direction === 'asc', currentFilter),
                fetchNotifications(currentUser.id, 5)
            ]);
            console.log("[LoadAllData] Výsledky načítání (settled):", results);

            if (results[0].status === 'fulfilled') { updateStatsCards(results[0].value); }
            else { console.error("❌ Chyba při načítání statistik:", results[0].reason); showError("Nepodařilo se načíst statistiky pokroku.", false); updateStatsCards(null); }
            setLoadingState('stats', false);

            if (results[1].status === 'fulfilled') {
                const activityResult = results[1].value || { data: [], count: 0 };
                allActivitiesData = activityResult.data;
                totalActivitiesCount = activityResult.count;
                renderActivitiesTable(allActivitiesData);
                updatePaginationUI();
            } else {
                console.error("❌ Chyba při načítání historie aktivit:", results[1].reason);
                showError("Nepodařilo se načíst historii aktivit.", false);
                allActivitiesData = []; totalActivitiesCount = 0; renderActivitiesTable(null); updatePaginationUI();
            }
            setLoadingState('activities', false);

            if (results[2].status === 'fulfilled') {
                 const { unreadCount, notifications } = results[2].value || { unreadCount: 0, notifications: [] };
                 renderNotifications(unreadCount, notifications);
             } else {
                 console.error("❌ Chyba při načítání oznámení:", results[2].reason);
                 showError("Nepodařilo se načíst oznámení.", false);
                 renderNotifications(0, []);
             }
             setLoadingState('notifications', false);

            initializeTooltips();

        } catch (error) {
            console.error("❌ Neočekávaná chyba v loadAllData:", error);
            showError(`Nastala neočekávaná chyba: ${error.message}`, true);
            setLoadingState('all', false);
            updateStatsCards(null);
            renderActivitiesTable(null);
            renderNotifications(0, []);
            updatePaginationUI();
        } finally {
            console.log("🏁 [LoadAllData] Dokončeno načítání a zpracování dat.");
        }
    }
	async function fetchUserStats(userId, profileData) { if (!supabase || !userId || !profileData) { console.error("[Stats] Chybí Supabase klient, ID uživatele nebo data profilu."); return null; } console.log(`[Stats] Načítání statistik pro uživatele ${userId}...`); let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats] Supabase chyba při načítání user_stats:", statsError.message); } } catch (error) { console.error("[Stats] Neočekávaná chyba při načítání user_stats:", error); statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0 }; if (statsError) { console.warn("[Stats] Vracím statistiky založené primárně na profilu kvůli chybě načítání."); } else { console.log("[Stats] Statistiky úspěšně načteny/sestaveny:", finalStats); } return finalStats; }
	async function fetchRecentActivities(userId, page = 1, limit = 10, sortBy = 'created_at', ascending = false, filterType = 'all') { if (!supabase || !userId) { console.error("[Activities] Chybí Supabase klient nebo ID uživatele."); return { data: [], count: 0 }; } console.log(`[Activities] Načítání stránky ${page} (limit ${limit}), řazení: ${sortBy} ${ascending ? 'ASC' : 'DESC'}, filtr: ${filterType}`); const offset = (page - 1) * limit; let query = supabase.from('activities').select('*', { count: 'exact' }).eq('user_id', userId); if (filterType !== 'all') { query = query.eq('type', filterType); } const dbSortColumn = sortBy === 'points_earned' ? 'points_earned' : sortBy === 'status' ? 'status' : sortBy === 'title' ? 'title' : sortBy === 'type' ? 'type' : 'created_at'; query = query.order(dbSortColumn, { ascending: ascending }); query = query.range(offset, offset + limit - 1); try { const { data, error, count } = await query; if (error) { console.error("[Activities] Supabase chyba při načítání aktivit:", error); throw error; } console.log(`[Activities] Načteno ${data?.length || 0} aktivit. Celkový počet: ${count}`); return { data: data || [], count: count || 0 }; } catch (error) { console.error('[Activities] Zachycena výjimka při načítání aktivit:', error); showToast('Chyba', 'Nepodařilo se načíst historii aktivit.', 'error'); return { data: [], count: 0 }; } }

    async function fetchNotifications(userId, limit = 5) {
        if (!supabase || !userId) { console.error("[Notifications] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; }
        console.log(`[Notifications] Načítání nepřečtených oznámení pro uživatele ${userId}`);
        try {
            const { data, error, count } = await supabase
                .from('user_notifications')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            console.log(`[Notifications] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`);
            return { unreadCount: count ?? 0, notifications: data || [] };
        } catch (error) {
            console.error("[Notifications] Výjimka při načítání oznámení:", error);
            showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error');
            return { unreadCount: 0, notifications: [] };
        }
    }

    function renderNotifications(count, notifications) {
         if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
             console.error("[Render Notifications] Chybí UI elementy pro notifikace.");
             setLoadingState('notifications', false);
             return;
         }
         console.log("[Render Notifications] Start, Počet:", count, "Oznámení:", notifications);
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
             ui.markAllReadBtn.disabled = count === 0;
         } else {
             ui.notificationsList.innerHTML = '';
             ui.noNotificationsMsg.style.display = 'block';
             ui.notificationsList.style.display = 'none';
             ui.markAllReadBtn.disabled = true;
         }
         console.log("[Render Notifications] Hotovo");
     }

     function renderNotificationSkeletons(count = 2) {
         if (!ui.notificationsList || !ui.noNotificationsMsg) return;
         let skeletonHTML = '';
         for (let i = 0; i < count; i++) {
             skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`;
         }
         ui.notificationsList.innerHTML = skeletonHTML;
         ui.noNotificationsMsg.style.display = 'none';
         ui.notificationsList.style.display = 'block';
     }

     async function markNotificationRead(notificationId) {
         console.log("[Notifications] Označení jako přečtené:", notificationId);
         if (!currentUser || !notificationId || !supabase) return false;
         try {
             const { error } = await supabase
                 .from('user_notifications')
                 .update({ is_read: true })
                 .eq('user_id', currentUser.id)
                 .eq('id', notificationId);
             if (error) throw error;
             console.log("[Notifications] Úspěšně označeno ID:", notificationId);
             return true;
         } catch (error) {
             console.error("[Notifications] Chyba označení:", error);
             showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error');
             return false;
         }
     }

     async function markAllNotificationsRead() {
         console.log("[Notifications] Označení všech jako přečtené pro:", currentUser?.id);
         if (!currentUser || !ui.markAllReadBtn || !supabase) return;
         setLoadingState('notifications', true);
         try {
             const { error } = await supabase
                 .from('user_notifications')
                 .update({ is_read: true })
                 .eq('user_id', currentUser.id)
                 .eq('is_read', false);
             if (error) throw error;
             console.log("[Notifications] Vše úspěšně označeno.");
             const { unreadCount, notifications } = await fetchNotifications(currentUser.id, 5);
             renderNotifications(unreadCount, notifications);
             showToast('Oznámení Vymazána', 'Všechna oznámení byla označena jako přečtená.', 'success');
         } catch (error) {
             console.error("[Notifications] Chyba označení všech:", error);
             showToast('Chyba', 'Nepodařilo se označit všechna oznámení.', 'error');
         } finally {
             setLoadingState('notifications', false);
         }
     }

    function updateUserInfoUI() {
        console.log("[UI Update] Aktualizace informací uživatele v sidebaru...");
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) {
            console.warn("[UI Update] Elementy sidebaru nenalezeny.");
            return;
        }
        if (currentUser && currentProfile) {
            const firstName = currentProfile.first_name ?? '';
            const lastName = currentProfile.last_name ?? '';
            const username = currentProfile.username ?? '';
            const emailUsername = currentUser.email?.split('@')[0] || '';
            const displayName = `${firstName} ${lastName}`.trim() || username || emailUsername || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);

            const initials = getInitials(currentProfile);
            const avatarUrl = currentProfile.avatar_url;
            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
            const sidebarImg = ui.sidebarAvatar.querySelector('img');
            if(sidebarImg) { sidebarImg.onerror = () => { ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; }

            const selectedTitleKey = currentProfile.selected_title;
            let displayTitle = 'Pilot';
            if (selectedTitleKey && allTitles && allTitles.length > 0) {
                const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) {
                    displayTitle = foundTitle.name;
                } else {
                    console.warn(`[UI Update] Title with key "${selectedTitleKey}" not found in fetched titles.`);
                }
            } else if (selectedTitleKey) {
                 console.warn(`[UI Update] Selected title key "${selectedTitleKey}" exists but title list is empty or not fetched yet.`);
            }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle));

             if(ui.userCreditsDisplayValue) {
                 ui.userCreditsDisplayValue.textContent = currentProfile.points ?? 0;
             }
            console.log("[UI Update] Sidebar UI aktualizován.");
        } else {
            console.warn("[UI Update] Chybí currentUser nebo currentProfile, nastavuji výchozí hodnoty.");
            ui.sidebarName.textContent = "Nepřihlášen";
            ui.sidebarAvatar.textContent = '?';
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot';
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title');
            if(ui.userCreditsDisplayValue) ui.userCreditsDisplayValue.textContent = '-';
        }
    }
	function updateStatsCards(stats) { console.log("[UI Update] Aktualizace karet statistik daty:", stats); const statElements = { progress: { value: ui.overallProgressValue, desc: ui.overallProgressDesc, footer: ui.overallProgressFooter }, points: { value: ui.totalPointsValue, desc: ui.totalPointsDesc, footer: ui.totalPointsFooter }, streak: { value: ui.streakValue, desc: ui.streakDesc, footer: ui.streakFooter }, completed: { value: ui.completedCountValue, desc: ui.completedCountDesc, footer: ui.completedCountFooter } }; ui.statsGrid?.querySelectorAll('.stats-card').forEach(card => card.classList.remove('loading')); if (!stats) { console.warn("[UI Update] Nejsou dostupná data statistik, zobrazuji chybový stav v kartách."); Object.values(statElements).forEach(els => { if (els.value) els.value.textContent = '-'; if (els.desc) els.desc.textContent = 'Data nedostupná'; if (els.footer) els.footer.innerHTML = '<i class="fas fa-exclamation-circle" style="color:var(--danger-color);"></i> Chyba'; }); return; } const completedTotal = (stats.completed_exercises || 0) + (stats.completed_tests || 0); if (statElements.progress.value) statElements.progress.value.textContent = `${stats.progress ?? 0}%`; if (statElements.progress.desc) statElements.progress.desc.textContent = "Průměrný pokrok"; if (statElements.progress.footer) { const change = stats.progress_weekly ?? 0; const icon = change > 0 ? 'fa-arrow-up' : change < 0 ? 'fa-arrow-down' : 'fa-minus'; const sign = change > 0 ? '+' : ''; statElements.progress.footer.className = `stats-card-footer ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`; statElements.progress.footer.innerHTML = `<i class="fas ${icon}"></i> ${sign}${change}% tento týden`; } if (statElements.points.value) statElements.points.value.textContent = stats.points ?? 0; if (statElements.points.desc) statElements.points.desc.textContent = "Celkem získaných bodů"; if (statElements.points.footer) { const change = stats.points_weekly ?? 0; const icon = change > 0 ? 'fa-arrow-up' : change < 0 ? 'fa-arrow-down' : 'fa-minus'; const sign = change > 0 ? '+' : ''; statElements.points.footer.className = `stats-card-footer ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`; statElements.points.footer.innerHTML = `<i class="fas ${icon}"></i> ${sign}${change} bodů tento týden`; } if (statElements.streak.value) statElements.streak.value.textContent = stats.streak_current ?? 0; if (statElements.streak.desc) statElements.streak.desc.textContent = `Aktuální série dnů`; if (statElements.streak.footer) statElements.streak.footer.innerHTML = `<i class="fas fa-medal"></i> Nejdelší: ${stats.streak_longest ?? 0} dnů`; if (statElements.completed.value) statElements.completed.value.textContent = completedTotal; if (statElements.completed.desc) statElements.completed.desc.textContent = `Cvičení: ${stats.completed_exercises || 0}, Testů: ${stats.completed_tests || 0}`; if (statElements.completed.footer) statElements.completed.footer.innerHTML = `<i class="fas fa-tasks"></i> Celkový počet`; console.log("[UI Update] Karty statistik aktualizovány."); }
	function renderActivitiesTable(activities) { if (!ui.activitiesBody || !ui.activitiesTable || !ui.activitiesEmptyState) { console.error("[ActivitiesTable] Elementy tabulky nenalezeny."); setLoadingState('activities', false); return; } ui.activitiesBody.innerHTML = ''; if (!activities || activities.length === 0) { console.log("[ActivitiesTable] Nejsou žádné aktivity k zobrazení."); ui.activitiesTable.style.display = 'none'; ui.activitiesEmptyState.style.display = 'flex'; setLoadingState('activities', false); return; } console.log(`[ActivitiesTable] Vykreslování ${activities.length} aktivit.`); ui.activitiesTable.style.display = 'table'; ui.activitiesEmptyState.style.display = 'none'; const fragment = document.createDocumentFragment(); activities.forEach(activity => { const tr = document.createElement('tr'); const typeKey = activity.type?.toLowerCase() || 'default'; const statusKey = activity.status?.toLowerCase() || 'default'; const activityTypeInfo = activityTypeMap[typeKey] || activityTypeMap.default; const activityStatusInfo = activityStatusMap[statusKey] || activityStatusMap.default; const pointsEarned = activity.points_earned != null ? activity.points_earned : '-'; const titleOrDesc = sanitizeHTML(activity.title || activity.description || '-'); tr.innerHTML = `<td>${formatDate(activity.created_at, true)}</td><td><span class="status-badge ${activityTypeInfo.class || typeKey}"><i class="fas ${activityTypeInfo.icon}"></i> ${activityTypeInfo.name}</span></td><td><span class="table-activity-title" title="${titleOrDesc}">${titleOrDesc}</span></td><td class="points-value">${pointsEarned}</td><td><span class="status-badge ${activityStatusInfo.class}"><i class="fas ${activityStatusInfo.icon}"></i> ${activityStatusInfo.name}</span></td>`; fragment.appendChild(tr); }); ui.activitiesBody.appendChild(fragment); console.log("[ActivitiesTable] Tabulka vykreslena."); setLoadingState('activities', false); }
	function updatePaginationUI() { if (!ui.paginationControls || !ui.pageInfo || !ui.prevPageBtn || !ui.nextPageBtn) return; if (totalActivitiesCount <= activitiesPerPage) { ui.paginationControls.style.display = 'none'; return; } ui.paginationControls.style.display = 'flex'; const totalPages = Math.ceil(totalActivitiesCount / activitiesPerPage); ui.pageInfo.textContent = `Strana ${currentActivitiesPage} z ${totalPages}`; ui.prevPageBtn.disabled = currentActivitiesPage === 1; ui.nextPageBtn.disabled = currentActivitiesPage === totalPages; console.log(`[Pagination] UI aktualizováno: Strana ${currentActivitiesPage}/${totalPages}`); }

	function setupEventListeners() {
        console.log("[Events] Nastavování event listenerů...");
        // Listenery pro sidebar jsou nyní v sidebar-logic.js

         if (ui.refreshBtn) ui.refreshBtn.addEventListener('click', handleRefreshClick);
         if (ui.activityTypeFilter) ui.activityTypeFilter.addEventListener('change', handleActivityFilterChange);
         if (ui.exportTableBtn) ui.exportTableBtn.addEventListener('click', exportTableToCSV);
         if (ui.tableHeaders) ui.tableHeaders.forEach(header => header.addEventListener('click', handleSortChange));
         if (ui.prevPageBtn) ui.prevPageBtn.addEventListener('click', () => changeActivitiesPage(-1));
         if (ui.nextPageBtn) ui.nextPageBtn.addEventListener('click', () => changeActivitiesPage(1));

         if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
         if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); }
         if (ui.notificationsList) { ui.notificationsList.addEventListener('click', handleNotificationClick); }
         document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } });

         console.log("[Events] Event listenery pro pokrok.html nastaveny.");
    }

	async function handleRefreshClick() { if (Object.values(isLoading).some(s => s)) { showToast('Info', "Data se již načítají..."); return; } console.log("🔄 Manuální obnovení spuštěno..."); const icon = ui.refreshBtn.querySelector('i'); const text = ui.refreshBtn.querySelector('.refresh-text'); if (icon) icon.classList.add('loading'); if (text) text.textContent = 'Obnovuji...'; ui.refreshBtn.disabled = true; try { await loadAllData(); showToast('Úspěch', "Data byla úspěšně obnovena."); } catch (error) { showError("Obnovení dat selhalo: " + error.message); } finally { if (icon) icon.classList.remove('loading'); if (text) text.textContent = 'Obnovit'; ui.refreshBtn.disabled = false; initializeTooltips(); } }
	async function handleActivityFilterChange() { if (!currentUser || isLoading.activities) return; currentFilter = ui.activityTypeFilter.value; currentActivitiesPage = 1; console.log(`[Filter] Filtr aktivit změněn na: ${currentFilter}. Znovunačítání aktivit...`); await reloadActivities(); }
	async function handleSortChange(event) { if (isLoading.activities) return; const header = event.currentTarget; const newSortColumn = header.dataset.sort; if (!newSortColumn) return; let newDirection = 'desc'; if (currentSort.column === newSortColumn && currentSort.direction === 'desc') { newDirection = 'asc'; } currentSort = { column: newSortColumn, direction: newDirection }; currentActivitiesPage = 1; ui.tableHeaders?.forEach(th => { th.classList.remove('sort-asc', 'sort-desc'); const i = th.querySelector('i.fa-sort, i.fa-sort-up, i.fa-sort-down, i.fa-filter'); if(i) { if(i.classList.contains('fa-sort') || i.classList.contains('fa-sort-up') || i.classList.contains('fa-sort-down')) { i.className = 'fas fa-sort'; } } }); header.classList.add(newDirection === 'asc' ? 'sort-asc' : 'sort-desc'); const sortIcon = header.querySelector('i.fa-sort'); if (sortIcon) { sortIcon.className = `fas ${newDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}`; } console.log(`[Sort] Řazení změněno na: ${currentSort.column} ${currentSort.direction}. Znovunačítání aktivit...`); await reloadActivities(); }
	async function changeActivitiesPage(direction) { if (isLoading.activities) return; const totalPages = Math.ceil(totalActivitiesCount / activitiesPerPage); const newPage = currentActivitiesPage + direction; if (newPage >= 1 && newPage <= totalPages) { currentActivitiesPage = newPage; console.log(`[Pagination] Změna na stránku ${currentActivitiesPage}. Znovunačítání aktivit...`); await reloadActivities(); } }
	async function reloadActivities() { if (!currentUser || isLoading.activities) return; console.log(`🔄 [ReloadActivities] Znovunačítání: stránka=${currentActivitiesPage}, řazení=${currentSort.column} ${currentSort.direction}, filtr=${currentFilter}`); setLoadingState('activities', true); try { const activityResult = await fetchRecentActivities( currentUser.id, currentActivitiesPage, activitiesPerPage, currentSort.column, currentSort.direction === 'asc', currentFilter ); allActivitiesData = activityResult.data || []; totalActivitiesCount = activityResult.count || 0; renderActivitiesTable(allActivitiesData); updatePaginationUI(); } catch (error) { showError("Nepodařilo se znovu načíst aktivity.", false); renderActivitiesTable(null); updatePaginationUI(); } finally { setLoadingState('activities', false); } }
    async function handleNotificationClick(event) { const item = event.target.closest('.notification-item'); if (!item) return; const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; }
	function exportTableToCSV() { if (isLoading.activities) { showToast('Info', "Počkejte na dokončení načítání."); return; } if (!allActivitiesData || allActivitiesData.length === 0) { showToast('Info', "Není co exportovat."); return; } console.log("[Export] Zahájení exportu do CSV..."); const headers = ["Datum", "Čas", "Typ Aktivity", "Název/Popis", "Body", "Stav"]; const rows = allActivitiesData.map(activity => { const date = new Date(activity.created_at); const formattedDate = date.toLocaleDateString('cs-CZ'); const formattedTime = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }); const typeInfo = activityTypeMap[activity.type?.toLowerCase()] || activityTypeMap.default; const statusInfo = activityStatusMap[activity.status?.toLowerCase()] || activityStatusMap.default; const escapeCSV = (field) => { const str = String(field ?? ''); if (str.includes(',') || str.includes('"') || str.includes('\n')) { return `"${str.replace(/"/g, '""')}"`; } return str; }; return [ formattedDate, formattedTime, escapeCSV(typeInfo.name), escapeCSV(activity.title || activity.description || '-'), activity.points_earned ?? '', escapeCSV(statusInfo.name) ].join(','); }); const BOM = "\uFEFF"; const csvContent = BOM + headers.join(',') + '\n' + rows.join('\n'); const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); const now = new Date(); const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; link.setAttribute("download", `historie_aktivit_${timestamp}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); showToast('Úspěch', "Export do CSV dokončen."); console.log("[Export] Export CSV dokončen."); }

	async function initializeApp() {
        console.log("🚀 [Init Pokrok] Spouštění inicializace...");
        // cacheDOMElements(); // Přesunuto za initializeSupabase, aby se zajistilo, že ui je definováno
        if (!initializeSupabase()) return; // Kritická chyba, pokud Supabase selže

        // Sidebar-logic.js by se měl postarat o applyInitialSidebarState
        // a nastavení svých listenerů pro sidebarToggleBtn, mainMobileMenuToggle, atd.
        // Není třeba je zde volat explicitně, pokud sidebar-logic.js běží na DOMContentLoaded.

        if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; }
        if (ui.mainElement) ui.mainElement.style.display = 'none'; // Skryjeme hlavní obsah, dokud není vše načteno

        try {
            console.log("[Init] Ověřování session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;
                console.log(`[Init] Uživatel ověřen (ID: ${currentUser.id}). Načítání profilu a titulů...`);

                const [profileResult, titlesResult] = await Promise.allSettled([
                    fetchUserProfile(currentUser.id),
                    fetchTitles()
                ]);

                if (profileResult.status === 'fulfilled' && profileResult.value) {
                    currentProfile = profileResult.value;
                    console.log("[Init] Profil načten:", currentProfile);
                } else {
                    throw new Error(`Nepodařilo se načíst profil uživatele. Důvod: ${profileResult.reason || 'Nenalezen'}`);
                }

                if (titlesResult.status === 'fulfilled') {
                    allTitles = titlesResult.value || [];
                    console.log("[Init] Tituly načteny:", allTitles.length);
                } else {
                    console.warn("[Init] Nepodařilo se načíst tituly:", titlesResult.reason);
                    allTitles = [];
                }

                updateUserInfoUI(); // Tato funkce nyní používá 'allTitles'
                setupEventListeners(); // Nastaví listenery pro prvky specifické pro pokrok.html
                updateCurrentTime(); setInterval(updateCurrentTime, 60000);

                if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }
                if (ui.mainElement) { ui.mainElement.style.display = 'block'; requestAnimationFrame(() => { ui.mainElement.classList.add('loaded'); }); }

                console.log("[Init] Načítání všech dat stránky...");
                await loadAllData();
                console.log("✅ [Init] Stránka plně načtena a inicializována.");
                initMouseFollower();
                initScrollAnimations();
                initHeaderScrollDetection();
                updateCopyrightYear();

            } else {
                console.log("[Init] Uživatel není přihlášen. Přesměrování na login...");
                window.location.href = '/auth/index.html';
            }
        } catch (error) {
            console.error("❌ [Init] Kritická chyba inicializace:", error);
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--danger-color);">Chyba (${error.message}). Obnovte stránku.</p>`; }
            else { showError(`Chyba při inicializaci: ${error.message}`, true); }
            if (ui.mainElement) ui.mainElement.style.display = 'none'; // Skrýt hlavní obsah při chybě
        }
    }

    // Před DOMContentLoaded musíme mít UI elementy pro sidebar-logic.js
    // Tento blok by měl být spuštěn co nejdříve, ale po definici ui objektu.
    // Jelikož sidebar-logic.js má vlastní DOMContentLoaded, stačí definovat ui zde.
    // (Samotné cachování se přesunulo do initializeApp pro konzistenci)

    // --- START THE APP ---
    // Nejprve cachujeme DOM elementy, pak inicializujeme zbytek.
    // Přesunuto do initializeApp pro jistotu, že všechny závislosti jsou načteny.
	document.addEventListener('DOMContentLoaded', () => {
        cacheDOMElements(); // Cachování DOM elementů by mělo proběhnout zde, aby byly dostupné pro sidebar-logic i pro pokrok.js
        initializeApp();
    });

})();