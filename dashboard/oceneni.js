// oceneni.js
// Версия: 23.12 - Oprava syntaktické chyby (chybějící '}' a '();')
(function() { // <<<< START IIFE
	'use strict'; // Povolení striktního režimu

	// --- START: Initialization and Configuration ---
	const SIDEBAR_STATE_KEY = 'sidebarState'; // Použijte stejný klíč jako dashboard.js, pokud je sdílený
	let supabase = null;
	let currentUser = null;
	let currentProfile = null;
	let currentUserStats = null; // Statistiky specifické pro uživatele (např. z user_stats)
	let userBadges = []; // Odznaky získané uživatelem
	let allBadges = []; // Definice všech dostupných odznaků
	let allTitles = []; // Definice všech dostupných titulů (z title_shop)
	let allDecorations = []; // Definice všech dostupných dekorací avatarů (placeholder, není implementováno)
	let leaderboardData = []; // Data žebříčku
	let currentLeaderboardPeriod = 'overall'; // Výchozí období žebříčku
	let isLoading = { // Stavy načítání pro různé sekce
		stats: false,
		userBadges: false,
		availableBadges: false,
		leaderboard: false,
		recentBadges: false, // Přidáno pro poslední získané odznaky
		notifications: false,
		titleShop: false,
		avatarDecorations: false, // Přidáno
		all: false // Globální stav načítání
	};
	const NOTIFICATION_FETCH_LIMIT = 5; // Limit pro načítání notifikací v dropdownu

	// DOM Cache - ukládání odkazů na HTML elementy pro rychlejší přístup
	const ui = {};

	function cacheDOMElements() {
		console.log("[Oceneni CACHE DOM] Caching elements...");
		const ids = [
			'initial-loader', 'sidebar-overlay', 'main-content', 'sidebar', 'main-mobile-menu-toggle',
			'sidebar-close-toggle', 'sidebar-avatar', 'sidebar-name', 'sidebar-user-title',
			'currentYearSidebar', 'page-title', 'refresh-data-btn', 'notification-bell',
			'notification-count', 'notifications-dropdown', 'notifications-list', 'no-notifications-msg',
			'mark-all-read', 'global-error', 'offline-banner', 'toast-container',
			'achievements-content', // Hlavní kontejner pro obsah stránky
			'achievement-stats-container', // Kontejner pro karty statistik
			'badges-count', 'badges-change', // Elementy pro statistiku odznaků
			'points-count', 'points-change', // Elementy pro statistiku bodů
			'streak-days', 'streak-change', // Elementy pro statistiku série
			'rank-value', 'rank-change', 'total-users', // Elementy pro statistiku žebříčku
			'user-badges-container', 'badge-grid', 'empty-badges', // Elementy pro sekci získaných odznaků
			'available-badges-container', 'available-badges-grid', 'empty-available-badges', // Elementy pro sekci dostupných odznaků/výzev
			'leaderboard-section', 'leaderboard-container', 'leaderboard-skeleton', // Elementy pro sekci žebříčku
			'leaderboard-header', 'leaderboard-table-container', 'leaderboard-body', 'leaderboard-empty',
			'recent-achievements-section', 'recent-achievements-list', // Elementy pro poslední získané odznaky (pokud bude implementováno)
			'title-shop-container', 'shop-user-credits', 'title-shop-loading', // Elementy pro obchod s tituly
			'title-shop-grid', 'title-shop-empty',
			'avatar-decorations-shop', 'shop-decor-credits', 'avatar-decorations-loading', // Elementy pro obchod s dekoracemi
			'avatar-decorations-grid', 'avatar-decorations-empty',
			'currentYearFooter', 'mouse-follower',
            'sidebar-toggle-btn' // Tlačítko pro přepínání sidebar
		];
		const notFound = [];
		ids.forEach(id => {
			const element = document.getElementById(id);
			// Převod ID na camelCase klíč (např. 'initial-loader' -> 'initialLoader')
			const key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
			if (element) {
				ui[key] = element;
			} else {
				notFound.push(id);
				ui[key] = null; // Explicitně nastavit na null, pokud nebyl nalezen
			}
		});

        // Přidání tooltipster elementů, pokud existují
		ui.tooltipElements = document.querySelectorAll('.btn-tooltip');

		if (notFound.length > 0) {
			 // Varování, pokud některé elementy chybí, ale pokračujeme
			 console.warn(`[Oceneni CACHE DOM] Elements not found: (${notFound.length}) ['${notFound.join("', '")}']`);
		}
		console.log("[Oceneni CACHE DOM] Caching complete.");
	}


    // Mapování typů odznaků na vizuální styl (ikony a gradienty)
    const badgeVisuals = {
        math: { icon: 'fa-square-root-alt', gradient: 'var(--gradient-math)' },
        language: { icon: 'fa-language', gradient: 'var(--gradient-lang)' },
        streak: { icon: 'fa-fire', gradient: 'var(--gradient-streak)' },
        special: { icon: 'fa-star', gradient: 'var(--gradient-special)' },
        points: { icon: 'fa-coins', gradient: 'var(--gradient-warning)' },
        exercises: { icon: 'fa-pencil-alt', gradient: 'var(--gradient-success)' },
        test: { icon: 'fa-vial', gradient: 'var(--gradient-info)' },
        default: { icon: 'fa-medal', gradient: 'var(--gradient-locked)' } // Výchozí pro neznámé typy
    };

	// Mapování typů aktivit pro ikony v notifikacích (konzistentní s dashboard.js)
	const activityVisuals = {
		test: { icon: 'fa-vial', class: 'test' },
		exercise: { icon: 'fa-pencil-alt', class: 'exercise' },
		badge: { icon: 'fa-medal', class: 'badge' },
		diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' },
		lesson: { icon: 'fa-book-open', class: 'lesson' },
		plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' },
		level_up: { icon: 'fa-level-up-alt', class: 'level_up' },
		other: { icon: 'fa-info-circle', class: 'other' },
		default: { icon: 'fa-check-circle', class: 'default' }
	};
	// --- END: Initialization and Configuration ---

	// --- START: Helper Functions ---
	function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
	function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; const retryBtn = document.getElementById('global-retry-btn'); if (retryBtn) { retryBtn.addEventListener('click', handleGlobalRetry); } } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
	function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
	function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }
	function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
	function formatDate(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) return '-'; const optionsDate = { day: 'numeric', month: 'numeric', year: 'numeric' }; return d.toLocaleDateString('cs-CZ', optionsDate); } catch (e) { console.error("Chyba formátování data:", dateString, e); return '-'; } }
	function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
	function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
	function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
	function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
	function setLoadingState(section, isLoadingFlag) {
		const sectionsMap = {
			stats: { container: ui.achievementStatsContainer, childrenSelector: '.stat-card' },
			userBadges: { container: ui.userBadgesContainer, emptyEl: ui.emptyBadges, contentEl: ui.badgeGrid },
			availableBadges: { container: ui.availableBadgesContainer, emptyEl: ui.emptyAvailableBadges, contentEl: ui.availableBadgesGrid },
			leaderboard: { container: ui.leaderboardContainer, emptyEl: ui.leaderboardEmpty, contentEl: ui.leaderboardTableContainer, skeletonEl: ui.leaderboardSkeleton },
			recentBadges: { container: ui.recentAchievementsSection }, // Assuming you add a loading state here
			notifications: { container: ui.notificationsList, emptyEl: ui.noNotificationsMsg },
			titleShop: { container: ui.titleShopContainer, emptyEl: ui.titleShopEmpty, contentEl: ui.titleShopGrid, loadingEl: ui.titleShopLoading },
			avatarDecorations: { container: ui.avatarDecorationsShop, emptyEl: ui.avatarDecorationsEmpty, contentEl: ui.avatarDecorationsGrid, loadingEl: ui.avatarDecorationsLoading }
		};
		const sectionsToUpdate = section === 'all' ? Object.keys(sectionsMap) : [section];

		sectionsToUpdate.forEach(secKey => {
			// Skip if section doesn't exist in map or state is already correct
			if (!sectionsMap[secKey] || isLoading[secKey] === isLoadingFlag) return;
			isLoading[secKey] = isLoadingFlag;
			console.log(`[SetLoading] Sekce: ${secKey}, isLoading: ${isLoadingFlag}`);

			const config = sectionsMap[secKey];
			// Toggle 'loading' class on the main container
			if (config.container) config.container.classList.toggle('loading', isLoadingFlag);

			// Toggle 'loading' on child elements if specified
			if (config.childrenSelector && config.container) {
				config.container.querySelectorAll(config.childrenSelector).forEach(child => {
					child?.classList.toggle('loading', isLoadingFlag);
				});
			}

			// Handle visibility of content, empty state, loaders, and skeletons
			const loaderEl = config.loadingEl || (config.skeletonEl && secKey === 'leaderboard' ? config.skeletonEl : null);
			const contentEl = config.contentEl;
			const emptyEl = config.emptyEl;

			if (loaderEl) loaderEl.style.display = isLoadingFlag ? (secKey === 'leaderboard' ? 'block' : 'flex') : 'none';
			if (isLoadingFlag) {
				if (contentEl) contentEl.style.display = 'none'; // Hide content grid/list when loading
				if (emptyEl) emptyEl.style.display = 'none';
				if (config.skeletonFn && contentEl) config.skeletonFn(contentEl); // Render skeletons into content area
                else if (secKey === 'notifications' && config.container && config.skeletonFn) config.skeletonFn(2); // Special case for notifications dropdown
			} else {
				// After loading, check if content is empty and show empty state if needed
				const isContentEmpty = !contentEl || !contentEl.hasChildNodes();
				if (isContentEmpty && emptyEl) {
					emptyEl.style.display = 'block';
					if (contentEl) contentEl.style.display = 'none'; // Hide grid if empty
				} else {
					if (emptyEl) emptyEl.style.display = 'none'; // Hide empty state if content exists
					if (contentEl) contentEl.style.display = 'grid'; // Ensure content grid is visible
				}
				// Ensure leaderboard specific elements are visible
				if (secKey === 'leaderboard') {
					if(config.contentEl) config.contentEl.style.visibility = 'visible';
					if(ui.leaderboardHeader) ui.leaderboardHeader.style.visibility = 'visible';
				}
			}

			// Handle notification bell state separately
			if (secKey === 'notifications' && ui.notificationBell) {
				ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
				if (ui.markAllReadBtn) {
					const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
					ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
				}
			}
		});
	}
	const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
	const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); };
	const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 30); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl && mainEl.scrollTop > 30) document.body.classList.add('scrolled'); };
	const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
	const initTooltips = () => { console.log("[Tooltips] Initializing..."); try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip.tooltipstered').each(function() { try { window.jQuery(this).tooltipster('destroy'); } catch (e) { console.warn('Error destroying tooltip', e); } }); window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); console.log("[Tooltips] Tooltips initialized/re-initialized."); } else { console.warn("[Tooltips] jQuery or Tooltipster not loaded/ready."); } } catch (e) { console.error("[Tooltips] Error initializing Tooltipster:", e); } };
	// --- END: Helper Functions ---

    // --- Sidebar Functions ---
    function toggleSidebar() {
        const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsedState', isCollapsed ? 'collapsed' : 'expanded');
        const icon = ui.sidebarToggleBtn?.querySelector('i');
        if (icon) { icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; }
        if (ui.sidebarToggleBtn) { ui.sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.setAttribute('title', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel');}
    }

    function applyInitialSidebarState() {
        const savedState = localStorage.getItem('sidebarCollapsedState');
        const shouldBeCollapsed = savedState === 'collapsed';
        if (shouldBeCollapsed) document.body.classList.add('sidebar-collapsed');
        else document.body.classList.remove('sidebar-collapsed');
        const icon = ui.sidebarToggleBtn?.querySelector('i');
        if (icon) { icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; }
        if (ui.sidebarToggleBtn) { ui.sidebarToggleBtn.setAttribute('aria-label', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.setAttribute('title', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel');}
    }
	// --- END: Sidebar Functions ---

	// --- Skeleton Rendering Functions ---
	// Functions renderBadgeSkeletons, renderAvailableBadgeSkeletons, renderLeaderboardSkeleton, renderTitleShopSkeleton, renderAvatarDecorationsSkeleton, renderNotificationSkeletons remain the same
	function renderBadgeSkeletons(container, count = 6) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="badge-card card loading"><div class="loading-skeleton" style="display: flex !important; flex-direction: column; align-items: center; padding: 1.8rem 1.2rem;"><div class="skeleton badge-icon-placeholder" style="width: 70px; height: 70px; border-radius: 50%; margin-bottom: 1.2rem;"></div><div class="skeleton badge-title-placeholder" style="height: 16px; width: 70%; margin-bottom: 0.5rem;"></div><div class="skeleton badge-desc-placeholder" style="height: 12px; width: 90%; margin-bottom: 0.4rem;"></div><div class="skeleton badge-desc-placeholder" style="height: 12px; width: 80%; margin-bottom: 0.8rem;"></div><div class="skeleton badge-date-placeholder" style="height: 12px; width: 50%; margin-top: auto;"></div></div></div>`; } container.innerHTML = skeletonHTML; }
	function renderAvailableBadgeSkeletons(container, count = 4) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="achievement-card card loading"><div class="loading-skeleton" style="display: flex !important;"><div class="skeleton achievement-icon-placeholder" style="width: 60px; height: 60px; border-radius: 16px; flex-shrink: 0;"></div><div class="skeleton achievement-content-placeholder" style="flex-grow: 1;"><div class="skeleton achievement-title-placeholder" style="height: 18px; width: 60%; margin-bottom: 0.6rem;"></div><div class="skeleton achievement-desc-placeholder" style="height: 14px; width: 95%; margin-bottom: 0.4rem;"></div><div class="skeleton achievement-desc-placeholder" style="height: 14px; width: 80%; margin-bottom: 0.8rem;"></div><div class="skeleton achievement-progress-placeholder" style="height: 20px; width: 100%;"></div></div></div></div>`; } container.innerHTML = skeletonHTML; }
	function renderLeaderboardSkeleton() { if (!ui.leaderboardSkeleton) return; ui.leaderboardSkeleton.style.display = 'block'; if(ui.leaderboardBody) ui.leaderboardBody.innerHTML = ''; if(ui.leaderboardTableContainer) ui.leaderboardTableContainer.style.visibility = 'hidden'; if(ui.leaderboardHeader) ui.leaderboardHeader.style.visibility = 'hidden'; if(ui.leaderboardEmpty) ui.leaderboardEmpty.style.display = 'none'; }
	function renderTitleShopSkeleton() { if (!ui.titleShopGrid) return; ui.titleShopGrid.innerHTML = ''; let skeletonHTML = ''; for(let i = 0; i < 3; i++) { skeletonHTML += `<div class="title-item card loading"><div class="loading-skeleton" style="display: flex !important;"><div style="display: flex; gap: 1.2rem; align-items: flex-start; width: 100%;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 14px; flex-shrink: 0;"></div><div style="flex-grow: 1;"><div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 0.7rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 14px; width: 75%;"></div></div></div></div></div>`; } ui.titleShopGrid.innerHTML = skeletonHTML; }
	function renderAvatarDecorationsSkeleton() { if (!ui.avatarDecorationsGrid) return; ui.avatarDecorationsGrid.innerHTML = ''; let skeletonHTML = ''; for(let i = 0; i < 4; i++) { skeletonHTML += `<div class="decoration-item card loading"><div class="loading-skeleton" style="display: flex !important; flex-direction: column; align-items: center; padding:1rem;"><div class="skeleton" style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 1rem auto;"></div><div class="skeleton" style="height: 18px; width: 70%; margin: 0 auto 0.7rem auto;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 14px; width: 80%;"></div><div style="margin-top: 1rem; padding-top: 0.8rem; border-top: 1px solid transparent; display: flex; justify-content: space-between; align-items: center; width:100%;"><div class="skeleton" style="height: 16px; width: 70px;"></div><div class="skeleton" style="height: 30px; width: 90px; border-radius: var(--button-radius);"></div></div></div></div>`; } ui.avatarDecorationsGrid.innerHTML = skeletonHTML; }
	function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) return; ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; }
	// --- END: Skeleton Rendering ---

	// --- Data Fetching Functions ---
	async function fetchUserStats(userId) { if (!supabase || !userId) return null; try { const { data: statsData, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); if (error) return null; return statsData || {}; } catch (error) { console.error("[Stats Fetch] Caught exception fetching user_stats:", error); showToast('Chyba', 'Nepodařilo se načíst statistiky uživatele.', 'error'); return null; } }
	async function fetchAllBadgesDefinition() { if (!supabase) return []; try { const { data, error } = await supabase.from('badges').select('*').order('id'); if (error) throw error; return data || []; } catch (error) { console.error("[Badges] Error fetching definitions:", error); return []; } }
	async function fetchUserEarnedBadges(userId) { if (!supabase || !userId) return []; try { const { data, error } = await supabase.from('user_badges').select(`badge_id, earned_at, badge:badges!inner (id, title, description, type, icon, requirements, points)`).eq('user_id', userId).order('earned_at', { ascending: false }); if (error) throw error; return data || []; } catch (error) { console.error("[UserBadges] Error fetching earned badges:", error); return []; } }
	async function fetchTitleShopData() { if (!supabase) return []; try { const { data, error } = await supabase.from('title_shop').select('*').eq('is_available', true).order('cost', { ascending: true }); if (error) throw error; return data || []; } catch (error) { console.error("[TitleShop] Error fetching available titles:", error); showError("Nepodařilo se načíst nabídku titulů v obchodě."); return []; } }
	async function fetchAvatarDecorationsData() { if (!supabase) return []; /* setLoadingState('avatarDecorations', true); */ try { const { data, error } = await supabase.from('avatar_decorations_shop').select('*').eq('is_available', true).order('cost', { ascending: true }); if (error) throw error; console.log("Fetched avatar decorations:", data); return data || []; } catch (error) { console.error("[AvatarShop] Error fetching decorations:", error); showError("Nepodařilo se načíst nabídku vylepšení avatarů."); return []; } /* finally { setLoadingState('avatarDecorations', false); } */ }
	async function fetchLeaderboardData(filter = 'points', period = 'overall') { if (!supabase) return []; let orderColumn = 'points'; let ascendingOrder = false; if (filter === 'badges') { orderColumn = 'badges_count'; } else if (filter === 'streak') { orderColumn = 'rank'; ascendingOrder = true; } try { const { data, error } = await supabase.from('leaderboard').select(`rank, user_id, points, badges_count, profile:profiles!inner(id, first_name, last_name, username, avatar_url, level, streak_days)`).eq('period', period).order(orderColumn, { ascending: ascendingOrder }).limit(10); if (error) throw error; let rankedData = data || []; rankedData = rankedData.map((entry, index) => ({ ...entry, calculated_rank: index + 1 })); return rankedData; } catch (error) { console.error(`[Leaderboard] Exception during fetch (sort: ${filter}, period: ${period}):`, error); if (error.message && error.message.includes('column') && error.message.includes('does not exist')) { showToast('Chyba Žebříčku', `Struktura databáze se změnila: ${error.message}`, 'error'); } return []; } }
	async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) { if (!supabase || !userId) return { unreadCount: 0, notifications: [] }; try { const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); return { unreadCount: 0, notifications: [] }; } }
	// --- END: Data Fetching ---

	// --- UI Update Functions ---
    // updateSidebarProfile remains the same
	// Functions updateStatsCards, renderUserBadges, renderAvailableBadges, renderLeaderboard, renderTitleShop, renderAvatarDecorationsShop, renderNotifications remain the same
    function updateSidebarProfile(profile, titlesData) { if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[UI Update Sidebar] Sidebar elements not found."); return; } console.log("[Oceneni UI Update] Updating sidebar..."); if (profile) { const firstName = profile.first_name ?? ''; const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(profile); const avatarUrl = profile.avatar_url; const selectedDecoration = profile.selected_decoration || ''; // Získání klíče dekorace
         const avatarWrapper = ui.sidebarAvatar.closest('.avatar-wrapper'); // Najdeme obalovač
         if (avatarWrapper) { // Odstranění starých tříd dekorací a přidání nové
             const decorationClasses = (allDecorations || []).map(d => d.decoration_key);
             avatarWrapper.classList.remove(...decorationClasses); // Odebrat všechny možné třídy dekorací
             if (selectedDecoration) avatarWrapper.classList.add(sanitizeHTML(selectedDecoration)); // Přidat aktuální
             avatarWrapper.dataset.decorationKey = selectedDecoration; // Uložit klíč do data atributu
         }
         ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot'; if (selectedTitleKey && titlesData && titlesData.length > 0) { const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) { displayTitle = foundTitle.name; } else { console.warn(`[UI Update Sidebar] Title key "${selectedTitleKey}" not found.`); } } ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); console.log("[Oceneni UI Update] Sidebar updated."); } else { console.warn("[Oceneni UI Update] Missing profile data."); ui.sidebarName.textContent = "Pilot"; ui.sidebarAvatar.textContent = '?'; if (ui.sidebarUserTitle) { ui.sidebarUserTitle.textContent = 'Pilot'; ui.sidebarUserTitle.removeAttribute('title'); } const avatarWrapper = ui.sidebarAvatar?.closest('.avatar-wrapper'); if(avatarWrapper) { const decorationClasses = (allDecorations || []).map(d => d.decoration_key); avatarWrapper.classList.remove(...decorationClasses); avatarWrapper.dataset.decorationKey = ''; } } }
	function updateStatsCards(profileData, statsData, earnedBadgesData, leaderboard) { const getStatValue = (value) => (value !== null && value !== undefined) ? value : '-'; const formatChange = (value, unit = '', iconUp = 'fa-arrow-up', iconDown = 'fa-arrow-down', iconNone = 'fa-minus') => { if (value === null || value === undefined || value === 0) return `<i class="fas ${iconNone}"></i> --`; const sign = value > 0 ? '+' : ''; const icon = value > 0 ? iconUp : iconDown; const cssClass = value > 0 ? 'positive' : 'negative'; return `<span class="${cssClass}"><i class="fas ${icon}"></i> ${sign}${value}${unit}</span>`; }; const statElements = { badgesCount: ui.badgesCount, badgesChange: ui.badgesChange, pointsCount: ui.pointsCount, pointsChange: ui.pointsChange, streakDays: ui.streakDays, streakChange: ui.streakChange, rankValue: ui.rankValue, rankChange: ui.rankChange, totalUsers: ui.totalUsers }; if (!profileData) { Object.values(statElements).forEach(el => { if(el && el.id !== 'total-users') el.textContent = '-'; }); if(statElements.badgesChange) statElements.badgesChange.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ERR`; if(statElements.pointsChange) statElements.pointsChange.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ERR`; if(statElements.streakChange) statElements.streakChange.textContent = `MAX: - dní`; if(statElements.rankChange) statElements.rankChange.innerHTML = `<i class="fas fa-users"></i> z ? pilotů`; return; } const badgesTotal = earnedBadgesData?.length ?? profileData.badges_count ?? 0; if(statElements.badgesCount) statElements.badgesCount.textContent = getStatValue(badgesTotal); if(statElements.badgesChange) statElements.badgesChange.innerHTML = `<i class="fas fa-sync-alt"></i> Aktualizováno`; if(statElements.pointsCount) statElements.pointsCount.textContent = getStatValue(profileData.points); const pointsWeekly = statsData?.points_weekly; if(statElements.pointsChange) statElements.pointsChange.innerHTML = formatChange(pointsWeekly, ' kr.'); if(statElements.streakDays) statElements.streakDays.textContent = getStatValue(profileData.streak_days); const longestStreak = statsData?.streak_longest ?? profileData.streak_days ?? '-'; if(statElements.streakChange) statElements.streakChange.textContent = `MAX: ${getStatValue(longestStreak)} dní`; const userRankEntry = leaderboard?.find(u => u.user_id === currentUser?.id); const rank = userRankEntry?.calculated_rank ?? '-'; const total = leaderboard?.length ?? 0; if(statElements.rankValue) statElements.rankValue.textContent = getStatValue(rank); if(statElements.rankChange && statElements.totalUsers) { statElements.rankChange.innerHTML = `<i class="fas fa-users"></i> z TOP ${total > 0 ? total : '?'} pilotů`; } }
	function renderUserBadges(earnedBadges) { if (!ui.badgeGrid || !ui.emptyBadges || !ui.userBadgesContainer) return; setLoadingState('userBadges', false); ui.badgeGrid.innerHTML = ''; if (!earnedBadges || earnedBadges.length === 0) { ui.emptyBadges.style.display = 'block'; ui.badgeGrid.style.display = 'none'; return; } ui.emptyBadges.style.display = 'none'; ui.badgeGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); earnedBadges.forEach((ub, index) => { const badge = ub.badge; if (!badge) return; const badgeType = badge.type?.toLowerCase() || 'default'; const visual = badgeVisuals[badgeType] || badgeVisuals.default; const badgeElement = document.createElement('div'); badgeElement.className = 'badge-card card'; badgeElement.setAttribute('data-animate', ''); badgeElement.style.setProperty('--animation-order', index); badgeElement.innerHTML = `<div class="badge-icon ${badgeType}" style="background: ${visual.gradient};"><i class="fas ${visual.icon}"></i></div><h3 class="badge-title">${sanitizeHTML(badge.title)}</h3><p class="badge-desc">${sanitizeHTML(badge.description || '')}</p><div class="badge-date"><i class="far fa-calendar-alt"></i> ${formatDate(ub.earned_at)}</div>`; fragment.appendChild(badgeElement); }); ui.badgeGrid.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
	function renderAvailableBadges(allBadgesDef, userEarnedBadges, userProfileData) { if (!ui.availableBadgesGrid || !ui.emptyAvailableBadges || !ui.availableBadgesContainer) { setLoadingState('availableBadges', false); return; } setLoadingState('availableBadges', false); ui.availableBadgesGrid.innerHTML = ''; const earnedIds = new Set(userEarnedBadges.map(ub => ub.badge_id)); const available = allBadgesDef.filter(b => !earnedIds.has(b.id)); if (available.length === 0) { ui.emptyAvailableBadges.style.display = 'block'; ui.availableBadgesGrid.style.display = 'none'; return; } ui.emptyAvailableBadges.style.display = 'none'; ui.availableBadgesGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); available.forEach((badge, index) => { const badgeType = badge.type?.toLowerCase() || 'default'; const visual = badgeVisuals[badgeType] || badgeVisuals.default; let progress = 0; let progressText = '???'; if (badge.requirements && typeof badge.requirements === 'object' && userProfileData) { const req = badge.requirements; let current = 0; let target = parseInt(req.target, 10) || 1; try { switch (req.type) { case 'points_earned': current = userProfileData.points || 0; progressText = `${current}/${target} KR`; break; case 'streak_days': current = userProfileData.streak_days || 0; progressText = `${current}/${target} dní`; break; case 'exercises_completed': current = userProfileData.completed_exercises || 0; progressText = `${current}/${target} cv.`; break; case 'level_reached': current = userProfileData.level || 1; progressText = `${current}/${target} úr.`; break; default: progressText = '?/?'; } if (target > 0) { progress = Math.min(100, Math.max(0, Math.round((current / target) * 100))); } } catch(e) { progressText = 'Chyba'; } } else { progressText = 'Nespec.'; } const badgeElement = document.createElement('div'); badgeElement.className = 'achievement-card card'; badgeElement.setAttribute('data-animate', ''); badgeElement.style.setProperty('--animation-order', index); badgeElement.innerHTML = `<div class="achievement-icon ${badgeType}" style="background: ${visual.gradient};"><i class="fas ${visual.icon}"></i></div><div class="achievement-content"><h3 class="achievement-title">${sanitizeHTML(badge.title)}</h3><p class="achievement-desc">${sanitizeHTML(badge.description || '')}</p><div class="progress-container"><div class="progress-bar"><div class="progress-fill" style="width: ${progress}%; background: ${visual.gradient};"></div></div><div class="progress-stats">${progress}% (${progressText})</div></div></div>`; fragment.appendChild(badgeElement); }); ui.availableBadgesGrid.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
	function renderLeaderboard(data) { if (!ui.leaderboardBody || !ui.leaderboardEmpty || !ui.leaderboardContainer || !ui.leaderboardSkeleton || !ui.leaderboardTableContainer || !ui.leaderboardHeader) { setLoadingState('leaderboard', false); return; } ui.leaderboardSkeleton.style.display = 'none'; ui.leaderboardTableContainer.style.visibility = 'visible'; ui.leaderboardHeader.style.visibility = 'visible'; ui.leaderboardBody.innerHTML = ''; if (!data || data.length === 0) { ui.leaderboardEmpty.style.display = 'block'; ui.leaderboardTableContainer.style.display = 'none'; } else { ui.leaderboardEmpty.style.display = 'none'; ui.leaderboardTableContainer.style.display = 'block'; const fragment = document.createDocumentFragment(); data.forEach((entry) => { const userProfile = entry.profile; if (!userProfile) return; const rank = entry.calculated_rank || '?'; const isCurrentUser = entry.user_id === currentUser?.id; const displayName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.username || `Pilot #${entry.user_id.substring(0, 4)}`; const initials = getInitials(userProfile); const avatarUrl = userProfile.avatar_url; const pointsValue = entry.points ?? 0; const badgesCount = entry.badges_count ?? 0; const streakValue = userProfile.streak_days ?? 0; const decorationKey = userProfile.selected_decoration || ''; // Získání klíče dekorace
            const rowElement = document.createElement('tr'); if (isCurrentUser) rowElement.classList.add('highlight-row'); rowElement.innerHTML = `<td class="rank-cell">${rank}</td><td class="user-cell"><div class="avatar-wrapper ${sanitizeHTML(decorationKey)}" data-decoration-key="${sanitizeHTML(decorationKey)}"><div class="user-avatar-sm">${avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(displayName)}">` : sanitizeHTML(initials)}</div></div><div class="user-info-sm"><div class="user-name-sm">${sanitizeHTML(displayName)}</div><div class="user-level">Úroveň ${userProfile.level || 1}</div></div></td><td class="score-cell">${pointsValue}</td><td class="badge-count-cell">${badgesCount}</td><td class="streak-cell">${streakValue}</td>`; fragment.appendChild(rowElement); }); ui.leaderboardBody.appendChild(fragment); } setLoadingState('leaderboard', false); }
	function renderTitleShop(titles, userProfile) { if (!ui.titleShopGrid || !ui.titleShopEmpty || !ui.titleShopContainer || !ui.shopUserCredits || !userProfile) { setLoadingState('titleShop', false); return; } setLoadingState('titleShop', false); ui.shopUserCredits.textContent = userProfile.points ?? 0; ui.titleShopGrid.innerHTML = ''; if (!titles || titles.length === 0) { ui.titleShopEmpty.style.display = 'block'; ui.titleShopGrid.style.display = 'none'; return; } ui.titleShopEmpty.style.display = 'none'; ui.titleShopGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); const purchasedKeys = new Set(userProfile.purchased_titles || []); const selectedKey = userProfile.selected_title; titles.forEach((title, index) => { const isPurchased = purchasedKeys.has(title.title_key); const isEquipped = isPurchased && title.title_key === selectedKey; const canAfford = userProfile.points >= title.cost; const itemElement = document.createElement('div'); itemElement.className = 'title-item card'; itemElement.setAttribute('data-title-key', title.title_key); itemElement.setAttribute('data-title-cost', title.cost); itemElement.setAttribute('data-animate', ''); itemElement.style.setProperty('--animation-order', index); itemElement.innerHTML = `<div class="title-item-icon"><i class="${sanitizeHTML(title.icon || 'fas fa-user-tag')}"></i></div><div class="title-item-content"><h4 class="title-item-name">${sanitizeHTML(title.name)}</h4>${title.description ? `<p class="title-item-desc">${sanitizeHTML(title.description)}</p>` : ''}<div class="title-item-footer"><span class="title-item-cost">Cena: ${title.cost} <i class="fas fa-coins"></i></span><div class="title-item-actions"><button class="btn btn-sm btn-primary buy-title-btn" ${isPurchased ? 'style="display: none;"' : ''} ${canAfford ? '' : 'disabled'} title="${canAfford ? 'Koupit titul' : 'Nedostatek kreditů'}"><i class="fas fa-shopping-cart"></i> Koupit</button><span class="title-status purchased" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-check"></i> Zakoupeno</span><span class="title-status equipped" ${isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-user-check"></i> Používá se</span><button class="btn btn-sm btn-secondary equip-title-btn" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-check-square"></i> Použít</button></div></div></div>`; fragment.appendChild(itemElement); }); ui.titleShopGrid.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
	function renderAvatarDecorationsShop(decorations, userProfile) { if (!ui.avatarDecorationsGrid || !ui.avatarDecorationsEmpty || !ui.avatarDecorationsShop || !ui.shopDecorCredits || !userProfile) { setLoadingState('avatarDecorations', false); return; } setLoadingState('avatarDecorations', false); ui.shopDecorCredits.textContent = userProfile.points ?? 0; ui.avatarDecorationsGrid.innerHTML = ''; if (!decorations || decorations.length === 0) { ui.avatarDecorationsEmpty.style.display = 'block'; ui.avatarDecorationsGrid.style.display = 'none'; return; } ui.avatarDecorationsEmpty.style.display = 'none'; ui.avatarDecorationsGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); const purchasedKeys = new Set(userProfile.purchased_decorations || []); const selectedKey = userProfile.selected_decoration; const userInitials = getInitials(userProfile); const userAvatarUrl = userProfile.avatar_url; decorations.forEach((decor, index) => { const isPurchased = purchasedKeys.has(decor.decoration_key); const isEquipped = isPurchased && decor.decoration_key === selectedKey; const canAfford = userProfile.points >= decor.cost; const itemElement = document.createElement('div'); itemElement.className = 'decoration-item card'; itemElement.setAttribute('data-decoration-key', decor.decoration_key); itemElement.setAttribute('data-decoration-cost', decor.cost); itemElement.setAttribute('data-animate', ''); itemElement.style.setProperty('--animation-order', index); const previewAvatarHTML = userAvatarUrl ? `<img src="${sanitizeHTML(userAvatarUrl)}" alt="Avatar">` : sanitizeHTML(userInitials); itemElement.innerHTML = `<div class="decoration-preview"><div class="avatar-wrapper ${sanitizeHTML(decor.decoration_key)}"><div class="user-avatar-sm">${previewAvatarHTML}</div></div></div><div class="decoration-info"><h4 class="decoration-name">${sanitizeHTML(decor.name)}</h4><p class="decoration-desc">${sanitizeHTML(decor.description || '')}</p><div class="decoration-footer"><span class="decoration-cost">Cena: ${decor.cost} <i class="fas fa-coins"></i></span><div class="decoration-actions"><button class="btn btn-sm btn-primary buy-decor-btn" ${isPurchased ? 'style="display: none;"' : ''} ${canAfford ? '' : 'disabled'} title="${canAfford ? 'Koupit vylepšení' : 'Nedostatek kreditů'}"><i class="fas fa-shopping-cart"></i> Koupit</button><span class="title-status purchased" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-check"></i> Zakoupeno</span><span class="title-status equipped" ${isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-user-check"></i> Používá se</span><button class="btn btn-sm btn-secondary equip-decor-btn" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-check-square"></i> Použít</button></div></div></div>`; fragment.appendChild(itemElement); }); ui.avatarDecorationsGrid.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
    function renderNotifications(count, notifications) { if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { setLoadingState('notifications', false); return; } setLoadingState('notifications', false); ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } }
    // --- END: UI Update ---

    // --- Event Handlers ---
	// handleGlobalRetry remains the same
	// Functions handleNotificationClick, closeNotificationDropdownOnClickOutside, markNotificationRead, markAllNotificationsRead remain the same
	// handleShopInteraction needs to handle both title and decoration clicks
	// handleBuyItem and handleEquipItem need to be adapted to handle both types
    async function handleGlobalRetry() { if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné být přihlášen a mít načtený profil.", "error"); if (!currentProfile) await initializeApp(); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } hideError(); if (ui.refreshDataBtn) { const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; ui.refreshDataBtn.disabled = true; } await loadAllAwardData(); if (ui.refreshDataBtn) { const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; ui.refreshDataBtn.disabled = false; } }
	async function handleNotificationClick(event) { const item = event.target.closest('.notification-item'); if (!item) return; const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; }
	function closeNotificationDropdownOnClickOutside(event) { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } }
	async function markNotificationRead(notificationId) { console.log("[Notifications] Marking notification as read:", notificationId); if (!currentUser || !notificationId || !supabase) return false; try { const { error } = await supabase .from('user_notifications') .update({ is_read: true }) .eq('user_id', currentUser.id) .eq('id', notificationId); if (error) throw error; console.log("[Notifications] Successfully marked ID:", notificationId); return true; } catch (error) { console.error("[Notifications] Mark as read error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
	async function markAllNotificationsRead() { console.log("[Notifications] Marking all as read for user:", currentUser?.id); if (!currentUser || !ui.markAllReadBtn || !supabase) { console.warn("Cannot mark all read: Missing user, button, or supabase."); return; } if (isLoading.notifications) return; setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; try { const { error } = await supabase .from('user_notifications') .update({ is_read: true }) .eq('user_id', currentUser.id) .eq('is_read', false); if (error) throw error; console.log("[Notifications] Mark all as read successful in DB."); const { unreadCount, notifications } = await fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('Oznámení Vymazána', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[Notifications] Mark all as read error:", error); showToast('Chyba', 'Nepodařilo se označit všechna oznámení.', 'error'); } finally { setLoadingState('notifications', false); } }
	async function handleShopInteraction(event) {
        const buyTitleButton = event.target.closest('.buy-title-btn'); const equipTitleButton = event.target.closest('.equip-title-btn'); const buyDecorButton = event.target.closest('.buy-decor-btn'); const equipDecorButton = event.target.closest('.equip-decor-btn');
        if (buyTitleButton) { const itemElement = buyTitleButton.closest('.title-item'); const itemKey = itemElement?.dataset.titleKey; const itemCost = parseInt(itemElement?.dataset.titleCost, 10); if (itemKey && !isNaN(itemCost)) { handleBuyItem('title', itemKey, itemCost, buyTitleButton); } else { console.error("Could not get title key or cost from button:", buyTitleButton); showToast('Chyba', 'Nelze zpracovat nákup titulu.', 'error'); } }
        else if (equipTitleButton) { const itemElement = equipTitleButton.closest('.title-item'); const itemKey = itemElement?.dataset.titleKey; if (itemKey) { handleEquipItem('title', itemKey, equipTitleButton); } else { console.error("Could not get title key from button:", equipTitleButton); showToast('Chyba', 'Nelze nastavit titul.', 'error'); } }
        else if (buyDecorButton) { const itemElement = buyDecorButton.closest('.decoration-item'); const itemKey = itemElement?.dataset.decorationKey; const itemCost = parseInt(itemElement?.dataset.decorationCost, 10); if (itemKey && !isNaN(itemCost)) { handleBuyItem('decoration', itemKey, itemCost, buyDecorButton); } else { console.error("Could not get decoration key or cost from button:", buyDecorButton); showToast('Chyba', 'Nelze zpracovat nákup dekorace.', 'error'); } }
        else if (equipDecorButton) { const itemElement = equipDecorButton.closest('.decoration-item'); const itemKey = itemElement?.dataset.decorationKey; if (itemKey) { handleEquipItem('decoration', itemKey, equipDecorButton); } else { console.error("Could not get decoration key from button:", equipDecorButton); showToast('Chyba', 'Nelze nastavit dekoraci.', 'error'); } }
    }
	async function handleBuyItem(itemType, itemKey, cost, buttonElement) { if (!currentProfile || !supabase || !currentUser) { showToast('Chyba', 'Nelze provést nákup, chybí data uživatele.', 'error'); return; } const currentCredits = currentProfile.points ?? 0; if (currentCredits < cost) { showToast('Nedostatek Kreditů', `Potřebujete ${cost} kreditů, máte ${currentCredits}.`, 'warning'); return; } const itemData = (itemType === 'title' ? allTitles : allDecorations).find(it => it[itemType === 'title' ? 'title_key' : 'decoration_key'] === itemKey); const itemName = itemData?.name || itemKey; const itemTypeName = itemType === 'title' ? 'titul' : 'vylepšení'; if (!confirm(`Opravdu chcete koupit ${itemTypeName} "${itemName}" za ${cost} kreditů?`)) return; buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kupuji...'; const purchaseField = itemType === 'title' ? 'purchased_titles' : 'purchased_decorations'; try { const currentPurchased = Array.isArray(currentProfile[purchaseField]) ? currentProfile[purchaseField] : []; if (currentPurchased.includes(itemKey)) { showToast('Již Vlastněno', `Tento ${itemTypeName} již máte.`, 'info'); if(itemType === 'title') renderTitleShop(allTitles, currentProfile); else renderAvatarDecorationsShop(allDecorations, currentProfile); return; } const newCredits = currentCredits - cost; const newPurchasedItems = [...currentPurchased, itemKey]; const updatePayload = { points: newCredits, [purchaseField]: newPurchasedItems }; const { error: updateError } = await supabase .from('profiles') .update(updatePayload) .eq('id', currentUser.id); if (updateError) throw updateError; currentProfile.points = newCredits; currentProfile[purchaseField] = newPurchasedItems; if (ui.shopUserCredits) ui.shopUserCredits.textContent = newCredits; if (ui.shopDecorCredits) ui.shopDecorCredits.textContent = newCredits; if (ui.pointsCount) ui.pointsCount.textContent = newCredits; if(itemType === 'title') renderTitleShop(allTitles, currentProfile); else renderAvatarDecorationsShop(allDecorations, currentProfile); showToast('Nákup Úspěšný', `${itemTypeName} "${itemName}" byl zakoupen!`, 'success'); } catch (error) { console.error(`[Shop] Error buying ${itemType} ${itemKey}:`, error); showToast('Chyba Nákupu', `Nepodařilo se zakoupit položku: ${error.message}`, 'error'); } finally { buttonElement.disabled = false; buttonElement.innerHTML = '<i class="fas fa-shopping-cart"></i> Koupit'; const stillOwned = (currentProfile[purchaseField] || []).includes(itemKey); if (stillOwned) { buttonElement.style.display = 'none'; } else if (currentProfile.points < cost) { buttonElement.disabled = true; } } }
	async function handleEquipItem(itemType, itemKey, buttonElement) { if (!currentProfile || !supabase || !currentUser) { showToast('Chyba', 'Nelze nastavit položku.', 'error'); return; } const purchaseField = itemType === 'title' ? 'purchased_titles' : 'purchased_decorations'; const selectField = itemType === 'title' ? 'selected_title' : 'selected_decoration'; const purchasedKeys = Array.isArray(currentProfile[purchaseField]) ? currentProfile[purchaseField] : []; const itemTypeName = itemType === 'title' ? 'titul' : 'vylepšení'; if (!purchasedKeys.includes(itemKey)) { showToast('Chyba', `Tento ${itemTypeName} nemáte zakoupený.`, 'error'); if(itemType === 'title') renderTitleShop(allTitles, currentProfile); else renderAvatarDecorationsShop(allDecorations, currentProfile); return; } if (currentProfile[selectField] === itemKey) { showToast('Již Používáte', `Tento ${itemTypeName} již máte nastavený.`, 'info'); return; } buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Nastavuji...'; try { const { error: updateError } = await supabase .from('profiles') .update({ [selectField]: itemKey }) .eq('id', currentUser.id); if (updateError) throw updateError; currentProfile[selectField] = itemKey; if(itemType === 'title') { renderTitleShop(allTitles, currentProfile); updateSidebarProfile(currentProfile, allTitles); // Update sidebar title } else { renderAvatarDecorationsShop(allDecorations, currentProfile); updateSidebarProfile(currentProfile, allTitles); // Update sidebar avatar decoration } const itemData = (itemType === 'title' ? allTitles : allDecorations).find(it => it[itemType === 'title' ? 'title_key' : 'decoration_key'] === itemKey); const itemName = itemData?.name || itemKey; showToast('Položka Nastavena', `Nyní používáte ${itemTypeName} "${itemName}".`, 'success'); } catch (error) { console.error(`[Shop] Error equipping ${itemType} ${itemKey}:`, error); showToast('Chyba Nastavení', `Nepodařilo se nastavit položku: ${error.message}`, 'error'); } finally { buttonElement.disabled = false; buttonElement.innerHTML = '<i class="fas fa-check-square"></i> Použít'; const stillSelected = currentProfile[selectField] === itemKey; const stillOwned = (currentProfile[purchaseField] || []).includes(itemKey); if (stillSelected || !stillOwned) { buttonElement.style.display = 'none'; } } }
	// --- END: Event Handlers ---

	// --- Load All Award Data ---
	async function loadAllAwardData() {
		if (!currentUser || !currentProfile || !supabase) { console.error("[LoadAwards] Missing core data."); showError("Chyba: Nelze načíst data ocenění bez profilu uživatele.", true); setLoadingState('all', false); return; }
		console.log("🔄 [LoadAwards] Loading all award page data..."); hideError(); setLoadingState('all', true);
		renderBadgeSkeletons(ui.badgeGrid); renderAvailableBadgeSkeletons(ui.availableBadgesGrid); renderLeaderboardSkeleton(); renderTitleShopSkeleton(); renderAvatarDecorationsSkeleton(); renderNotificationSkeletons(2);

		try {
			const results = await Promise.allSettled([
				fetchUserStats(currentUser.id),
				fetchAllBadgesDefinition(),
				fetchUserEarnedBadges(currentUser.id),
				fetchTitleShopData(),
				fetchAvatarDecorationsData(), // Fetch decorations
				fetchLeaderboardData(currentLeaderboardPeriod),
				fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT)
			]);
			console.log("[LoadAwards] Data fetch results (settled):", results);
			const [statsResult, allBadgesResult, userBadgesResult, titleShopResult, avatarShopResult, leaderboardResult, notificationsResult] = results;
			currentUserStats = (statsResult.status === 'fulfilled') ? statsResult.value : null;
			allBadges = (allBadgesResult.status === 'fulfilled') ? allBadgesResult.value : [];
			userBadges = (userBadgesResult.status === 'fulfilled') ? userBadgesResult.value : [];
			allTitles = (titleShopResult.status === 'fulfilled') ? titleShopResult.value : [];
			allDecorations = (avatarShopResult.status === 'fulfilled') ? avatarShopResult.value : []; // Store decorations
			leaderboardData = (leaderboardResult.status === 'fulfilled') ? leaderboardResult.value : [];
			const { unreadCount, notifications } = (notificationsResult.status === 'fulfilled') ? notificationsResult.value : { unreadCount: 0, notifications: [] };

			updateStatsCards(currentProfile, currentUserStats, userBadges, leaderboardData);
			renderUserBadges(userBadges);
			renderAvailableBadges(allBadges, userBadges, currentProfile);
			renderLeaderboard(leaderboardData);
			renderTitleShop(allTitles, currentProfile);
			renderAvatarDecorationsShop(allDecorations, currentProfile); // Render decorations shop
			renderNotifications(unreadCount, notifications);
			updateSidebarProfile(currentProfile, allTitles); // Pass titles to update sidebar title
			console.log("✅ [LoadAwards] All award page data loaded and rendered.");
		} catch (error) { console.error("❌ [LoadAwards] Error during loading award data:", error); showError(`Nepodařilo se načíst data pro stránku Ocenění: ${error.message}`, true); updateStatsCards(currentProfile, null, [], []); renderUserBadges([]); renderAvailableBadges([], [], currentProfile); renderLeaderboard([]); renderTitleShop([], currentProfile); renderAvatarDecorationsShop([], currentProfile); renderNotifications(0, []); }
		finally { setLoadingState('all', false); initTooltips(); }
	}
	// --- END Load All Award Data ---

	// --- App Initialization ---
	async function initializeApp() {
		console.log("🚀 [Init Oceneni v23.11] Starting...");
		cacheDOMElements(); // Cache elements early
		if (!initializeSupabase()) return;

		if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden');}
		if (ui.mainContent) ui.mainContent.style.display = 'none';

		try {
			const { data: { session }, error: sessionError } = await supabase.auth.getSession();
			if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);

			if (!session || !session.user) { console.log('[Init Oceneni] User not logged in. Redirecting...'); window.location.href = '/auth/index.html'; return; }
			currentUser = session.user;
			console.log(`[Init Oceneni] User authenticated (ID: ${currentUser.id}). Loading profile...`);

			// Fetch user profile ONLY here initially
			const { data: fetchedProfile, error: profileError } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
			if (profileError && profileError.code !== 'PGRST116') throw new Error(`Failed to fetch profile: ${profileError.message}`);
            if (!fetchedProfile) throw new Error("User profile not found.");
            currentProfile = fetchedProfile;
			console.log("[Init Oceneni] Profile loaded.");

            // Apply sidebar state EARLY
            applyInitialSidebarState();

            // Setup basic listeners and UI elements that DON'T depend on fetched data
            setupUIEventListeners();
            initMouseFollower();
            initHeaderScrollDetection();
            updateCopyrightYear();
            updateOnlineStatus();

            // Now load all the data needed for the page display
            await loadAllAwardData(); // This now fetches everything and renders

            // Hide loader and show content after all data is loaded and rendered
            if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
            if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }

            console.log("✅ [Init Oceneni] Page fully initialized.");

		} catch (error) {
			console.error("❌ [Init Oceneni] Kritická chyba inicializace:", error);
			if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE.</p>`; }
			else { showError(`Chyba inicializace: ${error.message}`, true); }
			if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show content to display error
			setLoadingState('all', false); // Ensure all loaders are off on error
		}
	}
    function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Knihovna Supabase nebyla správně načtena."); } supabase = window.supabase.createClient('https://qcimhjjwvsbgjsitmvuh.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10'); if (!supabase) throw new Error("Vytvoření klienta Supabase selhalo."); console.log('[Supabase] Klient úspěšně inicializován.'); return true; } catch (error) { console.error('[Supabase] Inicializace selhala:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }
    function setupUIEventListeners() { console.log("[SETUP] setupUIEventListeners: Start"); if (!ui || Object.keys(ui).length === 0) { console.error("[SETUP] UI cache is empty! Cannot setup listeners."); return; } const listenersAdded = new Set(); const safeAddListener = (element, eventType, handler, key) => { if (element) { element.removeEventListener(eventType, handler); element.addEventListener(eventType, handler); listenersAdded.add(key); } else { console.warn(`[SETUP] Element not found for listener: ${key}`); } }; safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle'); safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle'); safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay'); safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn'); document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); }); window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus); safeAddListener(ui.refreshDataBtn, 'click', handleGlobalRetry, 'refreshDataBtn'); safeAddListener(ui.notificationBell, 'click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell'); safeAddListener(ui.markAllReadBtn, 'click', markAllNotificationsRead, 'markAllReadBtn'); safeAddListener(ui.notificationsList, 'click', handleNotificationClick, 'notificationsList'); document.addEventListener('click', closeNotificationDropdownOnClickOutside); safeAddListener(ui.titleShopGrid, 'click', handleShopInteraction, 'titleShopGrid'); safeAddListener(ui.avatarDecorationsGrid, 'click', handleShopInteraction, 'avatarDecorationsGrid'); console.log(`[SETUP] Event listeners set up. Added: ${[...listenersAdded].length}`); }
	// --- END: App Initialization ---

    // <<<< START FIX: Added closing brace and IIFE call >>>>
    } // <<<< CLOSING BRACE for initializeApp function

    // Start the app
    initializeApp(); // Call initializeApp after defining it

})(); // <<<< CLOSING IIFE call >>>>