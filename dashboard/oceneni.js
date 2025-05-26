// dashboard/oceneni.js
// Version: 23.23.13 - Badge count fix, Icon fix for available badges, Non-collapsible sections enforced
(function() { // IIFE for scope isolation
	'use strict';

	// --- START: Configuration ---
	const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
	const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
	const NOTIFICATION_FETCH_LIMIT = 5;
	const LEADERBOARD_LIMIT = 10;
	const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
	const DAILY_TITLE_SHOP_COUNT = 6;
	const PROFILE_COLUMNS_TO_SELECT_FOR_ACHIEVEMENTS = 'id, username, first_name, last_name, email, avatar_url, bio, school, grade, level, completed_exercises, streak_days, longest_streak_days, badges_count, points, experience, purchased_titles, selected_title, selected_decoration, purchased_decorations';

	// --- END: Configuration ---

	// --- START: State Variables ---
	let supabase = null;
	let currentUser = null;
	let currentProfile = null;
	let userBadges = [];
	let allBadges = [];
	let allTitlesFromDB = [];
	let titleShopTitles = [];
	let allDecorations = [];
	let leaderboardData = [];
	let currentLeaderboardPeriod = 'overall';
    let lastCreditTransaction = null;

	let userDiagnosticTestsCount = 0;
	let userLearningLogsCount = 0;
	let userTopicProgressList = [];
	let allExamTopics = [];
	let userStudyPlansCount = 0;
	let userAiLessonsCompletedCount = 0;


	let isLoading = {
		stats: false, userBadges: false, availableBadges: false,
		leaderboard: false, titleShop: false, avatarDecorations: false,
		notifications: false, buyEquip: false, all: false, titles: false,
		userTitlesInventory: false,
		userDiagnostics: false, userLearningLogs: false, userTopicProgress: false, examTopics: false,
		userStudyPlans: false, userAiLessons: false
	};
	// --- END: State Variables ---

	// --- START: UI Elements Cache ---
	const ui = {};

	function cacheDOMElements() {
		console.log("[Oceneni Cache DOM] Caching elements...");
		const ids = [
			'initial-loader', 'sidebar-overlay', 'main-content', 'sidebar', 'main-mobile-menu-toggle',
			'sidebar-close-toggle', 'sidebar-avatar', 'sidebar-name', 'sidebar-user-title',
			'currentYearSidebar', 'page-title', 'refresh-data-btn', 'notification-bell',
			'notification-count', 'notifications-dropdown', 'notifications-list', 'no-notifications-msg',
			'mark-all-read',
			'global-error', 'offline-banner', 'toast-container',
			'achievements-content', 'achievement-stats-container',
			'badges-count', 'badges-change', 'points-count', 'points-change',
			'streak-days', 'streak-change', 'rank-value', 'rank-change', 'total-users',
			'user-badges-container', 'badge-grid', 'empty-badges',
			'available-badges-container', 'available-badges-grid', 'empty-available-badges',
			'leaderboard-container', 'leaderboard-body', 'leaderboard-empty',
			'title-shop-container', 'shop-user-credits', 'title-shop-loading',
			'title-shop-grid', 'title-shop-empty',
			'avatar-decorations-shop', 'shop-decor-credits', 'avatar-decorations-loading',
			'avatar-decorations-grid', 'avatar-decorations-empty',
			'currentYearFooter', 'mouse-follower',
			'sidebar-toggle-btn',
			'badges-card', 'points-card', 'streak-card', 'rank-card',
			'leaderboard-skeleton', 'leaderboard-header', 'leaderboard-table-container',
			'user-titles-inventory-container', 'user-titles-inventory-grid',
			'user-titles-inventory-empty', 'user-titles-inventory-loading',
			'toggle-user-badges-section', 'toggle-available-badges-section',
			'toggle-user-titles-section', 'toggle-title-shop-section',
			'toggle-avatar-decorations-section', 'toggle-leaderboard-section'
		];
		const notFound = [];
		ids.forEach(id => {
			const element = document.getElementById(id);
			const key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
			if (element) {
				ui[key] = element;
			} else {
				notFound.push(id);
				ui[key] = null;
			}
		});

		ui.userBadgesContent = ui.userBadgesContainer?.querySelector('.section-collapsible-content');
		ui.availableBadgesContent = ui.availableBadgesContainer?.querySelector('.section-collapsible-content');
		ui.userTitlesInventoryContent = ui.userTitlesInventoryContainer?.querySelector('.section-collapsible-content');
		ui.titleShopContent = ui.titleShopContainer?.querySelector('.section-collapsible-content');
		ui.avatarDecorationsContent = ui.avatarDecorationsShop?.querySelector('.section-collapsible-content');
		ui.leaderboardContent = ui.leaderboardContainer?.querySelector('.section-collapsible-content');


		if (!ui.sidebarUserTitle) {
			const roleEl = document.getElementById('sidebar-user-role');
			if (roleEl) {
				ui.sidebarUserTitle = roleEl;
				console.warn("[Oceneni Cache DOM] Used fallback ID 'sidebar-user-role' for sidebarUserTitle.");
			} else if (!notFound.includes('sidebar-user-title')) {
				notFound.push('sidebar-user-title (and sidebar-user-role)');
			}
		}

		if (notFound.length > 0) {
			console.warn(`[Oceneni Cache DOM] Elements not found: (${notFound.length})`, notFound);
		}
		console.log("[Oceneni Cache DOM] Caching complete.");
	}
	// --- END: UI Elements Cache ---

	// --- START: Helper Functions ---
	function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
	function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) { console.warn("Toast container not found in UI cache."); return; } try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
	function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
	function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
	function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
	function formatDate(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) return '-'; return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return '-'; } }
	function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
	function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
	function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
	function initTooltips() { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip.tooltipstered').each(function() { try { window.jQuery(this).tooltipster('destroy'); } catch (e) { /* ignore */ } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } }
	const initMouseFollower = () => { const f = ui.mouseFollower; if (!f || window.innerWidth <= 576) return; let hM = false; const uP = (e) => { if (!hM) { document.body.classList.add('mouse-has-moved'); hM = true; } requestAnimationFrame(() => { f.style.left = `${e.clientX}px`; f.style.top = `${e.clientY}px`; }); }; window.addEventListener('mousemove', uP, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hM) f.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hM) f.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(f) f.style.display = 'none'; }, { passive: true, once: true }); };
	const initScrollAnimations = () => { const els = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!els.length || !('IntersectionObserver' in window)) return; const obs = new IntersectionObserver((e, o) => { e.forEach(en => { if (en.isIntersecting) { en.target.classList.add('animated'); o.unobserve(en.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); els.forEach(el => obs.observe(el)); };
	const initHeaderScrollDetection = () => { let lSY = window.scrollY; const mE = ui.mainContent; if (!mE) return; mE.addEventListener('scroll', () => { const cSY = mE.scrollTop; document.body.classList.toggle('scrolled', cSY > 10); lSY = cSY <= 0 ? 0 : cSY; }, { passive: true }); if (mE.scrollTop > 10) document.body.classList.add('scrolled'); };
	const updateOnlineStatus = () => { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); };
	const updateCopyrightYear = () => { const y = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = y; if (ui.currentYearFooter) ui.currentYearFooter.textContent = y; };
	function toggleSidebar() { if (!ui.sidebarToggleBtn) return; try { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (error) { console.error("[Sidebar Toggle] Error:", error); } }
	function applyInitialSidebarState() { if (!ui.sidebarToggleBtn) { console.warn("Sidebar toggle button not found for initial state in oceneni.js"); return; } try { const savedState = localStorage.getItem(SIDEBAR_STATE_KEY); const shouldBeCollapsed = savedState === 'collapsed'; if (shouldBeCollapsed) document.body.classList.add('sidebar-collapsed'); else document.body.classList.remove('sidebar-collapsed'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.title = shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (error) { console.error("[Sidebar State] Error applying initial state:", error); document.body.classList.remove('sidebar-collapsed'); } }
	function getSeededSortValue(seedString) { let hash = 0; if (!seedString || seedString.length === 0) return hash; for (let i = 0; i < seedString.length; i++) { const char = seedString.charCodeAt(i); hash = ((hash << 5) - hash) + char; hash |= 0; } return Math.abs(hash); }
	// --- END: Helper Functions ---

	// --- START: Loading State Management ---
	function setLoadingState(sectionKey, isLoadingFlag) {
		if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;

		const updateSingleSection = (key, loading) => {
			if (isLoading[key] === loading && key !== 'all') return;
			isLoading[key] = loading;
			console.log(`[SetLoading Oceneni] ${key}: ${loading}`);

			const sectionMap = {
				stats: { container: ui.achievementStatsContainer, childrenSelector: '.stat-card' },
				userBadges: { container: ui.userBadgesContainer, emptyEl: ui.emptyBadges, contentEl: ui.badgeGrid, skeletonFn: renderBadgeSkeletons, skeletonCount: 6 },
				availableBadges: { container: ui.availableBadgesContainer, emptyEl: ui.emptyAvailableBadges, contentEl: ui.availableBadgesGrid, skeletonFn: renderAvailableBadgeSkeletons, skeletonCount: 4 },
				leaderboard: { container: ui.leaderboardContainer, emptyEl: ui.leaderboardEmpty, contentEl: ui.leaderboardTableContainer, skeletonEl: ui.leaderboardSkeleton, headerEl: ui.leaderboardHeader, skeletonFn: renderLeaderboardSkeleton },
				titleShop: { container: ui.titleShopContainer, emptyEl: ui.titleShopEmpty, contentEl: ui.titleShopGrid, loadingEl: ui.titleShopLoading, skeletonFn: renderTitleShopSkeleton, skeletonCount: DAILY_TITLE_SHOP_COUNT },
				avatarDecorations: { container: ui.avatarDecorationsShop, emptyEl: ui.avatarDecorationsEmpty, contentEl: ui.avatarDecorationsGrid, loadingEl: ui.avatarDecorationsLoading, skeletonFn: renderAvatarDecorationsSkeleton, skeletonCount: 4 },
				notifications: { container: ui.notificationsList, emptyEl: ui.noNotificationsMsg, skeletonFn: renderNotificationSkeletons, skeletonCount: 2 },
				userTitlesInventory: { container: ui.userTitlesInventoryContainer, emptyEl: ui.userTitlesInventoryEmpty, contentEl: ui.userTitlesInventoryGrid, loadingEl: ui.userTitlesInventoryLoading, skeletonFn: renderUserTitlesInventorySkeletons, skeletonCount: 4 },
				buyEquip: {}, titles: {}, userDiagnostics: {}, userLearningLogs: {}, userTopicProgress: {}, examTopics: {}, userStudyPlans: {}, userAiLessons: {}
			};

			const config = sectionMap[key];
			if (!config) {
				console.warn(`[SetLoading Oceneni] No UI config found for section key: ${key}`);
				return;
			}


			if (config.container) config.container.classList.toggle('loading', loading);
			if (config.childrenSelector && config.container) { config.container.querySelectorAll(config.childrenSelector).forEach(child => child.classList.toggle('loading', loading)); }

			const loaderEl = config.loadingEl || config.skeletonEl;
			const contentEl = config.contentEl;
			const emptyEl = config.emptyEl;
			const headerEl = config.headerEl;

			if (loaderEl) loaderEl.style.display = loading ? (key === 'leaderboard' ? 'block' : 'flex') : 'none';
			if (headerEl) headerEl.style.visibility = loading ? 'hidden' : 'visible';

			if (loading) {
				if (contentEl) contentEl.style.display = 'none';
				if (emptyEl) emptyEl.style.display = 'none';
				if (config.skeletonFn) {
					const targetContainer = contentEl || (key === 'leaderboard' ? null : config.container);
					if (targetContainer || key === 'leaderboard') {
						config.skeletonFn(targetContainer, config.skeletonCount);
					} else if (key !== 'leaderboard') {
						console.warn(`[SetLoading Oceneni] Target container for skeletons not found for section ${key}.`);
					}
				}
			}
			if (key === 'notifications' && ui.notificationBell) {
				ui.notificationBell.style.opacity = loading ? 0.5 : 1;
				if (ui.markAllRead) {
					const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
					ui.markAllRead.disabled = loading || currentUnreadCount === 0;
				}
			}
		};

		if (sectionKey === 'all') {
			Object.keys(isLoading).forEach(key => {
				if (key !== 'all') updateSingleSection(key, isLoadingFlag);
			});
			isLoading.all = isLoadingFlag;
		} else {
			updateSingleSection(sectionKey, isLoadingFlag);
		}
	}
	// --- END: Loading State Management ---

	// --- START: Skeleton Rendering Functions ---
	function renderStatsSkeletons(container) { /* Only toggles class on parent */ }
	function renderBadgeSkeletons(container = ui.badgeGrid, count = 6) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let s = ''; for (let i = 0; i < count; i++) s += `<div class="badge-card card loading"><div class="loading-skeleton" style="display: flex !important; flex-direction: column; align-items: center; padding: 1.8rem 1.2rem;"><div class="skeleton badge-icon-placeholder" style="width: 70px; height: 70px; border-radius: 50%; margin-bottom: 1.2rem;"></div><div class="skeleton badge-title-placeholder" style="height: 16px; width: 70%; margin-bottom: 0.5rem;"></div><div class="skeleton badge-desc-placeholder" style="height: 12px; width: 90%; margin-bottom: 0.4rem;"></div><div class="skeleton badge-desc-placeholder" style="height: 12px; width: 80%; margin-bottom: 0.8rem;"></div><div class="skeleton badge-date-placeholder" style="height: 12px; width: 50%; margin-top: auto;"></div></div></div>`; container.innerHTML = s; }
	function renderAvailableBadgeSkeletons(container = ui.availableBadgesGrid, count = 4) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let s = ''; for (let i = 0; i < count; i++) s += `<div class="achievement-card card loading"><div class="loading-skeleton" style="display: flex !important;"><div class="skeleton achievement-icon-placeholder" style="width: 60px; height: 60px; border-radius: 16px; flex-shrink: 0;"></div><div class="skeleton achievement-content-placeholder" style="flex-grow: 1;"><div class="skeleton achievement-title-placeholder" style="height: 18px; width: 60%; margin-bottom: 0.6rem;"></div><div class="skeleton achievement-desc-placeholder" style="height: 14px; width: 95%; margin-bottom: 0.4rem;"></div><div class="skeleton achievement-desc-placeholder" style="height: 14px; width: 80%; margin-bottom: 0.8rem;"></div><div class="skeleton achievement-progress-placeholder" style="height: 20px; width: 100%;"></div></div></div></div>`; container.innerHTML = s; }
	function renderLeaderboardSkeleton() { if (ui.leaderboardSkeleton) ui.leaderboardSkeleton.style.display = 'block'; }
	function renderTitleShopSkeleton(container = ui.titleShopGrid, count = DAILY_TITLE_SHOP_COUNT) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let s = ''; for(let i = 0; i < count; i++) s += `<div class="title-item card loading"><div class="loading-skeleton" style="display: flex !important;"><div style="display: flex; gap: 1.2rem; align-items: flex-start; width: 100%;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 14px; flex-shrink: 0;"></div><div style="flex-grow: 1;"><div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 0.7rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 14px; width: 75%;"></div></div></div></div></div>`; container.innerHTML = s; }
	function renderAvatarDecorationsSkeleton(container = ui.avatarDecorationsGrid, count = 4) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let s = ''; for(let i = 0; i < count; i++) s += `<div class="decoration-item card loading"><div class="loading-skeleton" style="display: flex !important; flex-direction: column; align-items: center; padding:1rem;"><div class="skeleton" style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 1rem auto;"></div><div class="skeleton" style="height: 18px; width: 70%; margin: 0 auto 0.7rem auto;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 14px; width: 80%;"></div><div style="margin-top: 1rem; padding-top: 0.8rem; border-top: 1px solid transparent; display: flex; justify-content: space-between; align-items: center; width:100%;"><div class="skeleton" style="height: 16px; width: 70px;"></div><div class="skeleton" style="height: 30px; width: 90px; border-radius: var(--button-radius);"></div></div></div></div>`; container.innerHTML = s; }
	function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) {console.warn("[Skeletons] Notifications list or no-message element not found."); return;} let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height:16px;width:70%;margin-bottom:6px;"></div><div class="skeleton" style="height:12px;width:90%;"></div><div class="skeleton" style="height:10px;width:40%;margin-top:6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
	function renderUserTitlesInventorySkeletons(container = ui.userTitlesInventoryGrid, count = 4) { if (!container) { console.warn("[Skeletons] User Titles Inventory container not found."); return; } container.innerHTML = ''; container.style.display = 'grid'; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += ` <div class="title-item card loading"> <div class="loading-skeleton" style="display: flex !important;"> <div style="display: flex; gap: 1.2rem; align-items: flex-start; width: 100%;"> <div class="skeleton" style="width: 60px; height: 60px; border-radius: 14px; flex-shrink: 0;"></div> <div style="flex-grow: 1;"> <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 0.7rem;"></div> <div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div> <div class="skeleton" style="height: 14px; width: 75%;"></div> </div> </div> </div> </div>`; } container.innerHTML = skeletonHTML; }
	// --- END: Skeleton Rendering Functions ---

	// --- START: Data Fetching Functions (with new fetches) ---
	async function fetchUserFullProfile(userId) {
		if (!supabase || !userId) return null;
		console.log(`[Profile Full] Fetching FULL profile for achievements, user ID: ${userId}`);
		try {
			const { data: profile, error } = await supabase
				.from('profiles')
				.select(PROFILE_COLUMNS_TO_SELECT_FOR_ACHIEVEMENTS)
				.eq('id', userId)
				.single();
			if (error && error.code !== 'PGRST116') throw error;
			if (!profile) {
				console.warn(`[Profile Full] Profile for ${userId} not found. Returning null.`);
				return null;
			}
			console.log("[Profile Full] Full profile data for achievements fetched successfully.");
			return profile;
		} catch (error) {
			console.error('[Profile Full] Caught exception fetching full profile:', error);
			return null;
		}
	}

	async function fetchUserStats(userId) {
		if (!supabase || !userId ) return {};
		console.log(`[UserStats] Fetching user_stats for user ${userId}`);
		try {
			const { data: stats, error} = await supabase
				.from('user_stats')
				.select('progress, progress_weekly, points_weekly, streak_longest, completed_tests')
				.eq('user_id', userId)
				.maybeSingle();
			if (error) {
				console.warn("[UserStats] Error fetching user_stats from DB:", error.message);
				return {};
			}
			return stats || {};
		} catch (e) {
			console.error("[UserStats] Exception fetching user_stats:", e);
			return {};
		}
	}

	async function fetchAllBadgesDefinition() {
		if (!supabase) return [];
		try {
			const { data, error } = await supabase.from('badges').select('*').order('id');
			if (error) throw error;
			return data || [];
		} catch (e) {
			console.error("Error fetching badge definitions:", e);
			return [];
		}
	}

	async function fetchUserEarnedBadges(userId) {
		if (!supabase || !userId) return [];
		try {
			const { data, error } = await supabase
				.from('user_badges')
				.select(`
					badge_id,
					earned_at,
					badge:badges!inner (
						id, title, description, type, icon, requirements, points
					)
				`)
				.eq('user_id', userId)
				.order('earned_at', { ascending: false });
			if (error) throw error;
			return data || [];
		} catch (e) {
			console.error("Error fetching earned badges:", e);
			return [];
		}
	}
	async function fetchAllPurchasableTitles() {
		if (!supabase) return [];
		console.log("[Titles] Fetching ALL available & purchasable titles from DB...");
		try {
			const { data, error } = await supabase
				.from('title_shop')
				.select('*')
				.eq('is_available', true);
			if (error) throw error;
			allTitlesFromDB = data || [];
			console.log(`[Titles] Fetched all titles from DB: ${allTitlesFromDB.length}.`);
			return allTitlesFromDB;
		} catch (error) {
			console.error("[Titles] Error fetching all titles:", error);
			showToast("Chyba", "Chyba načítání titulů z obchodu.", "error");
			allTitlesFromDB = [];
			return [];
		}
	}

	async function fetchAvatarDecorationsData() {
		console.log("[Decorations] Fetching available avatar decorations...");
		if (!supabase) return [];
		try {
			const { data, error } = await supabase
				.from('avatar_decorations_shop')
				.select('*')
				.eq('is_available', true);
			if (error) throw error;
			allDecorations = data || [];
			console.log(`[Decorations] Fetched ${allDecorations.length} avatar decorations.`);
			return allDecorations;
		} catch (err) {
			console.error("[Decorations] Error fetching avatar decorations:", err);
			showToast("Chyba", "Chyba načítání vylepšení avatarů.", "error");
			allDecorations = [];
			return [];
		}
	}

	async function fetchLeaderboardData(sortBy = 'points', limit = LEADERBOARD_LIMIT) {
		if (!supabase) return [];
		let orderByField = 'points';
        let profileJoinSort = false;
		if (sortBy === 'level') {
			orderByField = 'level';
            profileJoinSort = true;
		}

		console.log(`[Leaderboard] Fetching data, primary sort from DB by points (rank), client-side sort by: ${sortBy}`);
		try {
			let query = supabase
				.from('leaderboard')
				.select(`
					rank,
					user_id,
					points,
					badges_count,
					profile:profiles!inner (
						id, first_name, last_name, username, avatar_url, level, streak_days, selected_title, selected_decoration
					)
				`)
				.eq('period', currentLeaderboardPeriod)
                .order('rank', { ascending: true })
				.limit(limit);


			const { data, error } = await query;
			if (error) throw error;

			const rankedData = (data || []).map((entry, index) => ({
				...entry,
				calculated_rank: entry.rank ?? (index + 1)
			}));
			return rankedData;
		} catch (e) {
			console.error("Error fetching leaderboard:", e);
			return [];
		}
	}
	async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) {
		if (!supabase || !userId) return { unreadCount: 0, notifications: [] };
		try {
			const { data, error, count } = await supabase
				.from('user_notifications')
				.select('*', { count: 'exact' })
				.eq('user_id', userId)
				.eq('is_read', false)
				.order('created_at', { ascending: false })
				.limit(limit);
			if (error) throw error;
			return { unreadCount: count ?? 0, notifications: data || [] };
		} catch (e) {
			console.error("Error fetching notifications:", e);
			return { unreadCount: 0, notifications: [] };
		}
	}

	async function fetchUserDiagnosticTestCount(userId) {
		if (!supabase || !userId) return 0;
		setLoadingState('userDiagnostics', true);
		try {
			const { count, error } = await supabase
				.from('user_diagnostics')
				.select('id', { count: 'exact', head: true })
				.eq('user_id', userId);
			if (error) throw error;
			console.log(`[FetchData] Diagnostic tests count for user ${userId}: ${count || 0}`);
			return count || 0;
		} catch (e) {
			console.error("Error fetching user diagnostic test count:", e);
			return 0;
		} finally {
			setLoadingState('userDiagnostics', false);
		}
	}

	async function fetchUserLearningLogsCount(userId) {
		if (!supabase || !userId) return 0;
		setLoadingState('userLearningLogs', true);
		try {
			const { data: logs, error } = await supabase
				.from('learning_logs_detailed')
				.select('id')
				.eq('user_id', userId);

			if (error) throw error;
			const count = logs ? logs.length : 0;
			console.log(`[FetchData] Learning logs count for user ${userId}: ${count}`);
			return count;
		} catch (e) {
			console.error("Error fetching user learning logs count:", e);
			return 0;
		} finally {
			setLoadingState('userLearningLogs', false);
		}
	}


	async function fetchUserTopicProgressList(userId) {
		if (!supabase || !userId) return [];
		setLoadingState('userTopicProgress', true);
		try {
			const { data, error } = await supabase
				.from('user_topic_progress')
				.select('topic_id, progress_percentage')
				.eq('user_id', userId);
			if (error) throw error;
			console.log(`[FetchData] User topic progress for user ${userId}:`, data);
			return data || [];
		} catch (e) {
			console.error("Error fetching user topic progress list:", e);
			return [];
		} finally {
			setLoadingState('userTopicProgress', false);
		}
	}

	async function fetchAllExamTopics() {
		if (!supabase) return [];
		setLoadingState('examTopics', true);
		try {
			const { data, error } = await supabase
				.from('exam_topics')
				.select('id, name');
			if (error) throw error;
			console.log(`[FetchData] All exam topics:`, data);
			return data || [];
		} catch (e) {
			console.error("Error fetching all exam topics:", e);
			return [];
		} finally {
			setLoadingState('examTopics', false);
		}
	}

	async function fetchUserStudyPlansCount(userId) {
		if (!supabase || !userId) return 0;
		setLoadingState('userStudyPlans', true);
		try {
			const { data: plans, error } = await supabase
				.from('study_plans')
				.select('id')
				.eq('user_id', userId);
			if (error) throw error;
			const count = plans ? plans.length : 0;
			console.log(`[FetchData] Study plans count for user ${userId}: ${count}`);
			return count;
		} catch (e) {
			console.error("Error fetching user study plans count:", e);
			return 0;
		} finally {
			setLoadingState('userStudyPlans', false);
		}
	}


	async function fetchUserAiLessonsCompletedCount(userId) {
		if (!supabase || !userId) return 0;
		setLoadingState('userAiLessons', true);
		try {
			const { data: lessons, error } = await supabase
				.from('ai_sessions')
				.select('id')
				.eq('user_id', userId)
				.eq('status', 'ended');

			if (error) throw error;
			const count = lessons ? lessons.length : 0;
			console.log(`[FetchData] AI lessons completed count for user ${userId}: ${count}`);
			return count;
		} catch (e) {
			console.error("Error fetching user AI lessons completed count:", e);
			return 0;
		} finally {
			setLoadingState('userAiLessons', false);
		}
	}

    async function fetchLatestCreditTransaction(userId) {
        if (!supabase || !userId) return null;
        console.log(`[Credit Transaction] Fetching latest for user ${userId}`);
        try {
            const { data, error } = await supabase
                .from('credit_transactions')
                .select('amount, description, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            lastCreditTransaction = data;
            return data;
        } catch (err) {
            console.error("Error fetching latest credit transaction:", err);
            lastCreditTransaction = null;
            return null;
        }
    }
	// --- END: Data Fetching Functions ---

	// --- START: Achievement Logic ---
	const badgeVisuals = {
		math: { icon: 'fa-calculator', gradient: 'var(--gradient-math)' },
		language: { icon: 'fa-language', gradient: 'var(--gradient-lang)' },
		streak: { icon: 'fa-fire', gradient: 'var(--gradient-streak)' },
		special: { icon: 'fa-star', gradient: 'var(--gradient-special)' },
		points: { icon: 'fa-coins', gradient: 'var(--gradient-warning)' },
		exercises: { icon: 'fa-pencil-ruler', gradient: 'var(--gradient-success)' },
		test: { icon: 'fa-vial', gradient: 'var(--gradient-info)' },
		profile: { icon: 'fa-id-card', gradient: 'var(--gradient-info)' },
		progress: { icon: 'fa-chart-line', gradient: 'var(--gradient-success)' },
		practice: { icon: 'fa-dumbbell', gradient: 'var(--gradient-button)' },
		learning_habit: { icon: 'fa-book-reader', gradient: 'var(--gradient-info)' },
		mastery: { icon: 'fa-brain', gradient: 'var(--gradient-level-up)' },
		customization: { icon: 'fa-paint-brush', gradient: 'var(--gradient-cta)' },
		default: { icon: 'fa-medal', gradient: 'var(--gradient-locked)' }
	};

	function checkRequirements(profileData, requirements, otherData = {}, badgeTitle = 'Unknown Badge') {
		if (!profileData || !requirements || typeof requirements !== 'object') {
			console.warn("[Achievements CheckReq] Invalid input for checking requirements.", profileData, requirements);
			return { met: false, current: 0, target: requirements?.target || requirements?.count || 1, progressText: "Chyba" };
		}

		let reqType = requirements.type;
		const reqTarget = parseInt(requirements.target, 10);
		const reqCount = parseInt(requirements.count, 10);
		let currentValue = 0;
		let targetValue = requirements.target || requirements.count || 1;
		let progressText = "";

		if (!reqType) {
			if (requirements.fields_required !== undefined) reqType = 'profile_fields_filled';
			else if (requirements.is_avatar_set !== undefined) reqType = 'avatar_set';
			else if (requirements.level !== undefined) reqType = 'level_reached';
			else if (requirements.experience !== undefined) reqType = 'experience_earned';
			else if (requirements.points !== undefined) reqType = 'points_earned_total';
			else if (requirements.streak_days !== undefined) reqType = 'streak_days_reached';
			else if (requirements.diagnostic_tests_completed_count !== undefined) reqType = 'diagnostic_test_completed';
			else if (requirements.study_plans_created_count !== undefined) reqType = 'study_plan_created';
			else if (requirements.ai_lessons_completed_count !== undefined) reqType = 'ai_lesson_completed';
			else if (requirements.learning_logs_created_count !== undefined) reqType = 'learning_logs_created';
			else if (requirements.topic_id !== undefined && requirements.min_progress_percentage !== undefined) reqType = 'topic_progress_reached';
			else if ((requirements.min_score_percentage !== undefined || requirements.min_score !== undefined) && (requirements.topic_id !== undefined || requirements.topic !== undefined)) reqType = 'topic_score';
			else if (requirements.exercises_completed_count !== undefined && requirements.topic_id === undefined && requirements.topic === undefined) reqType = 'exercises_completed_total';
			else if (requirements.exercises_count !== undefined && (requirements.topic_id !== undefined || requirements.topic !== undefined)) reqType = 'topic_exercises_completed';
			else if (requirements.perfect_exercises !== undefined && (requirements.topic_id !== undefined || requirements.topic !== undefined)) reqType = 'topic_perfect_exercises';
			else if (requirements.perfect_exercises !== undefined) reqType = 'perfect_exercises';
			else if (requirements.exercises_count !== undefined && requirements.max_time_minutes !== undefined) reqType = 'exercises_count';
            else if (requirements.purchased_titles_count !== undefined) reqType = 'purchased_titles_count';
            else if (requirements.purchased_decorations_count !== undefined) reqType = 'purchased_decorations_count';
			else {
				console.warn(`[Achievements CheckReq] Could not infer 'type' for requirement:`, requirements, `Used by badge: ${badgeTitle}`);
			}
		}

		try {
			switch (reqType) {
				case 'profile_fields_filled':
					const fields = requirements.fields_required || [];
					let filledCount = 0;
					fields.forEach(fieldKey => {
						if (profileData[fieldKey] && String(profileData[fieldKey]).trim() !== '') {
							filledCount++;
						}
					});
					currentValue = filledCount;
					targetValue = requirements.min_fields_to_fill || fields.length;
					progressText = `${currentValue}/${targetValue} polí`;
					break;
				case 'avatar_set':
					currentValue = (profileData.avatar_url && profileData.avatar_url.trim() !== '') ? 1 : 0;
					targetValue = 1;
					progressText = currentValue >= targetValue ? "Nastaven" : "Nenastaven";
					break;
				case 'level_reached':
					currentValue = profileData.level ?? 1;
					targetValue = requirements.level || reqTarget;
					progressText = `${currentValue}/${targetValue} úr.`;
					break;
				case 'experience_earned':
					currentValue = profileData.experience ?? 0;
					targetValue = requirements.experience || reqTarget;
					progressText = `${currentValue}/${targetValue} ZK`;
					break;
				case 'points_earned_total':
					currentValue = profileData.points ?? 0;
					targetValue = requirements.points || reqTarget;
					progressText = `${currentValue}/${targetValue} kr.`;
					break;
				case 'streak_days_reached':
					currentValue = profileData.streak_days ?? 0;
					targetValue = requirements.streak_days || reqTarget;
					progressText = `${currentValue}/${targetValue} dní`;
					break;
				case 'diagnostic_test_completed':
					currentValue = otherData.userDiagnosticTestsCount || 0;
					targetValue = requirements.diagnostic_tests_completed_count || reqCount || 1;
					progressText = `${currentValue}/${targetValue} testů`;
					break;
				case 'study_plan_created':
					currentValue = otherData.userStudyPlansCount || 0;
					targetValue = requirements.study_plans_created_count || reqCount || 1;
					progressText = `${currentValue}/${targetValue} plánů`;
					break;
				case 'ai_lesson_completed':
					currentValue = otherData.userAiLessonsCompletedCount || 0;
					targetValue = requirements.ai_lessons_completed_count || reqCount || 1;
					progressText = `${currentValue}/${targetValue} lekcí`;
					break;
				case 'learning_logs_created':
					currentValue = otherData.userLearningLogsCount || 0;
					targetValue = requirements.learning_logs_created_count || reqTarget;
					progressText = `${currentValue}/${targetValue} záznamů`;
					break;
				case 'topic_progress_reached':
					const topicProgress = (otherData.userTopicProgressList || []).find(tp => tp.topic_id === requirements.topic_id);
					currentValue = topicProgress ? topicProgress.progress_percentage : 0;
					targetValue = requirements.min_progress_percentage || 100;
					const topicObj = (otherData.allExamTopics || []).find(et => et.id === requirements.topic_id);
					const topicName = topicObj ? topicObj.name : `Téma ID ${requirements.topic_id}`;
					progressText = `${currentValue}% v "${sanitizeHTML(topicName)}" (Cíl: ${targetValue}%)`;
					break;
				case 'avatar_decoration_equipped':
					currentValue = (profileData.selected_decoration && profileData.selected_decoration.trim() !== '') ? 1 : 0;
					targetValue = 1;
					progressText = currentValue >= targetValue ? "Dekorace použita" : "Žádná dekorace";
					break;
				case 'title_equipped':
					currentValue = (profileData.selected_title && profileData.selected_title.trim() !== '') ? 1 : 0;
					targetValue = 1;
					progressText = currentValue >= targetValue ? "Titul použit" : "Žádný titul";
					break;
				case 'exercises_completed_total':
					currentValue = profileData.completed_exercises ?? 0;
					targetValue = requirements.exercises_completed_count || reqTarget;
					progressText = `${currentValue}/${targetValue} cvičení`;
					break;
                case 'purchased_titles_count':
                    currentValue = profileData.purchased_titles?.length || 0;
                    targetValue = requirements.purchased_titles_count || reqTarget;
                    progressText = `${currentValue}/${targetValue} titulů`;
                    break;
                case 'purchased_decorations_count':
                    currentValue = profileData.purchased_decorations?.length || 0;
                    targetValue = requirements.purchased_decorations_count || reqTarget;
                    progressText = `${currentValue}/${targetValue} dekorací`;
                    break;
				case 'topic_score':
				case 'exercises_count':
				case 'topic_exercises_completed':
				case 'topic_perfect_exercises':
				case 'perfect_exercises':
					currentValue = 0;
					targetValue = requirements.target || requirements.count || requirements.exercises_count || requirements.perfect_exercises || 1;
					const genericTopic = requirements.topic_id || requirements.topic || 'N/A';
					progressText = `(Splnění: ${badgeTitle} - implementace se připravuje)`;
					console.warn(`[Achievements CheckReq] Achievement type '${reqType}' for badge '${badgeTitle}' requires backend/complex logic. Marked as 0/${targetValue}.`);
					break;

				default:
					if (reqType === undefined) {
						console.error(`[Achievements CheckReq] CRITICAL: Badge requirement 'type' is undefined and could not be inferred for requirement object:`, requirements, `Badge: ${badgeTitle}`);
						progressText = "Chybná definice";
					} else {
						console.warn(`[Achievements CheckReq] Unknown requirement type: ${reqType}`);
						progressText = "Neznámý typ";
					}
					return { met: false, current: 0, target: targetValue, progressText };
			}
			return { met: currentValue >= targetValue, current: currentValue, target: targetValue, progressText };
		} catch (e) {
			console.error("[Achievements CheckReq] Error evaluating requirement:", e, requirements, profileData);
			return { met: false, current: 0, target: targetValue, progressText: "Chyba hodnocení" };
		}
	}

	async function awardBadge(userId, badgeId, badgeTitle, pointsAwarded = 0) {
		const supabaseInstance = supabase;
		if (!supabaseInstance || !userId || !badgeId) { console.error("[AwardBadge] Missing Supabase client, userId, or badgeId."); return; }
		console.log(`[AwardBadge] Attempting to award badge ${badgeId} (${badgeTitle}) to user ${userId}...`);
		try {
			const { data: existing, error: checkError } = await supabaseInstance
				.from('user_badges')
				.select('badge_id')
				.eq('user_id', userId)
				.eq('badge_id', badgeId)
				.limit(1);
			if (checkError) throw checkError;
			if (existing && existing.length > 0) { console.log(`[AwardBadge] Badge ${badgeId} already awarded to user ${userId}. Skipping.`); return; }

			const { error: insertError } = await supabaseInstance
				.from('user_badges')
				.insert({ user_id: userId, badge_id: badgeId });
			if (insertError) throw insertError;
			console.log(`[AwardBadge] Badge ${badgeId} inserted for user ${userId}.`);

			const { data: fetchedProfile, error: fetchProfileError } = await supabaseInstance
				.from('profiles')
				.select('badges_count, points')
				.eq('id', userId)
				.single();

			if (fetchProfileError) { console.error("[AwardBadge] Error fetching current profile stats for update:", fetchProfileError); }
			else if (fetchedProfile) {
				const currentBadgeCount = fetchedProfile.badges_count ?? 0;
				let currentPoints = fetchedProfile.points ?? 0;
				const updates = { badges_count: currentBadgeCount + 1, updated_at: new Date().toISOString() };
				if (pointsAwarded > 0) {
					updates.points = currentPoints + pointsAwarded;
				}
				const { error: updateProfileError } = await supabaseInstance
					.from('profiles')
					.update(updates)
					.eq('id', userId);
				if (updateProfileError) { console.error("[AwardBadge] Error updating profile stats:", updateProfileError); }
				else {
					console.log(`[AwardBadge] Profile stats updated for user ${userId}: badges_count=${updates.badges_count}` + (updates.points ? `, points=${updates.points}` : ''));
					if (currentProfile && currentProfile.id === userId) { // Update local profile state
						currentProfile.badges_count = updates.badges_count;
						if (updates.points !== undefined) currentProfile.points = updates.points;
						// It's better to re-fetch or rely on a global profile update mechanism if stats card needs this immediately
					}
				}
			}

			const notificationTitle = `🏆 Nový Odznak!`;
			const notificationMessage = `Získali jste odznak: "${badgeTitle}"! ${pointsAwarded > 0 ? `(+${pointsAwarded} kreditů)` : ''}`;
			const { error: notifyError } = await supabaseInstance
				.from('user_notifications')
				.insert({ user_id: userId, title: notificationTitle, message: notificationMessage, type: 'badge', link: '/dashboard/oceneni.html' });
			if (notifyError) {
				console.error("[AwardBadge] Error creating notification:", notifyError);
				if (notifyError.code === '42501' || notifyError.message.includes('violates row-level security policy')) {
					showToast('Chyba Notifikace', 'Odznak udělen, ale nepodařilo se vytvořit oznámení (chyba oprávnění RLS).', 'warning');
				} else {
					showToast('Chyba Notifikace', 'Odznak udělen, ale nepodařilo se vytvořit oznámení.', 'warning');
				}
			} else {
				console.log(`[AwardBadge] Notification created for badge ${badgeId}`);
			}

			showToast(notificationTitle, notificationMessage, 'success', 6000);
		} catch (error) {
			console.error(`[AwardBadge] Error awarding badge ${badgeId} to user ${userId}:`, error);
		}
	}

	async function checkAndAwardAchievements(userId) {
		const supabaseInstance = supabase;
		if (!supabaseInstance || !userId || !currentProfile) {
			console.error("[Achievements Check] Missing Supabase client, userId, or currentProfile.");
			return;
		}
		console.log(`[Achievements Check] Starting check for user ${userId}...`);
		setLoadingState('availableBadges', true);
		try {
			const profileDataForCheck = currentProfile; // Use the already fetched full profile

			// Fetch all badge definitions if not already loaded (or if we want fresh ones)
			if (!allBadges || allBadges.length === 0) {
				const { data: allBadgesData, error: badgesError } = await supabaseInstance
					.from('badges')
					.select('id, title, description, type, icon, requirements, points') // Ensure 'icon' is selected
					.order('id');
				if (badgesError) throw badgesError;
				if (!allBadgesData || allBadgesData.length === 0) { console.log("[Achievements Check] No badge definitions found."); setLoadingState('availableBadges', false); return; }
				allBadges = allBadgesData;
			}

			// Fetch earned badges if not already loaded (or if we want fresh ones)
			if (!userBadges || userBadges.length === 0 || !userBadges[0]?.badge) { // Check if badge details are missing
				const { data: earnedBadgesData, error: earnedError } = await supabaseInstance
					.from('user_badges')
					.select('badge_id, earned_at, badge:badges!inner(id, title, description, type, icon, requirements, points)')
					.eq('user_id', userId)
					.order('earned_at', { ascending: false });
				if (earnedError) throw earnedError;
				userBadges = earnedBadgesData || [];
			}

			const earnedBadgeIds = new Set(userBadges.map(b => b.badge_id));
			const unearnedBadges = allBadges.filter(b => !earnedBadgeIds.has(b.id));
			console.log(`[Achievements Check] Found ${unearnedBadges.length} unearned badges to check.`);

			const otherDataForAchievements = {
				userDiagnosticTestsCount,
				userLearningLogsCount,
				userTopicProgressList,
				userStudyPlansCount,
				userAiLessonsCompletedCount,
				allExamTopics
			};

			let newBadgeAwardedThisSession = false;
			for (const badge of unearnedBadges) {
				if (!badge.requirements) {
					console.warn(`[Achievements Check] Badge ID: ${badge.id} (${badge.title}) has no requirements defined. Skipping.`);
					continue;
				}
				const progressResult = checkRequirements(profileDataForCheck, badge.requirements, otherDataForAchievements, badge.title);
				if (progressResult.met) {
					console.log(`[Achievements Check] Criteria MET for badge ID: ${badge.id} (${badge.title})! Triggering award...`);
					await awardBadge(userId, badge.id, badge.title, badge.points || 0);
					newBadgeAwardedThisSession = true;
				}
			}
			console.log(`[Achievements Check] Finished checking for user ${userId}. New badges awarded this session: ${newBadgeAwardedThisSession}`);

			if (newBadgeAwardedThisSession) {
				const updatedProfile = await fetchUserFullProfile(userId); // Re-fetch the full profile after awards
				if(updatedProfile) currentProfile = updatedProfile;

				userBadges = await fetchUserEarnedBadges(userId); // Re-fetch to get updated list with full badge details

				renderUserBadges(userBadges); // Re-render user's earned badges
                const totalUsersForStatsUpdate = (await supabase.from('profiles').select('id', { count: 'exact', head: true })).count || leaderboardData.length || 0;
				updateSidebarProfile(currentProfile, allTitlesFromDB);
				updateStatsCards({ // Update stats cards with fresh data
					badges: currentProfile.badges_count,
					points: currentProfile.points,
					streak_current: currentProfile.streak_days,
					streak_longest: currentProfile.longest_streak_days,
					rank: leaderboardData.find(u => u.user_id === currentUser.id)?.rank,
					totalUsers: totalUsersForStatsUpdate
				});
			}
			// Always re-render available badges to update their progress
			renderAvailableBadges(allBadges, userBadges, currentProfile, otherDataForAchievements);

		} catch (error) {
			console.error(`[Achievements Check] Error during check/award process for user ${userId}:`, error);
		} finally {
			setLoadingState('availableBadges', false);
		}
	}
	// --- END: Achievement Logic ---

	// --- START: Data Rendering Functions ---
	function updateSidebarProfile(profile, titlesData = allTitlesFromDB) {
		console.log("[Sidebar Update] Updating sidebar profile. Profile:", profile, "Titles:", titlesData?.length);
		if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) {
			console.warn("[Sidebar Update] One or more sidebar UI elements are missing. Skipping update.");
			return;
		}

		if (profile && currentUser) {
			const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || currentUser.email?.split('@')[0] || 'Pilot';
			ui.sidebarName.textContent = sanitizeHTML(displayName);
			console.log(`[Sidebar Update] Name set to: ${displayName}`);

			const initials = getInitials(profile);
			const avatarUrl = profile.avatar_url;
			let finalAvatarUrl = avatarUrl;

			if (avatarUrl && !avatarUrl.startsWith('http') && avatarUrl.includes('/')) { // Pokud je to interní cesta
				finalAvatarUrl = sanitizeHTML(avatarUrl);
				console.log(`[Sidebar Update] Using direct avatar URL: ${finalAvatarUrl}`);
			} else if (avatarUrl) { // Pokud je to externí URL, přidáme timestamp
				finalAvatarUrl = `${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`;
				console.log(`[Sidebar Update] Using cache-busted avatar URL: ${finalAvatarUrl}`);
			}

			ui.sidebarAvatar.innerHTML = finalAvatarUrl ? `<img src="${finalAvatarUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
			const sidebarImg = ui.sidebarAvatar.querySelector('img');
			if (sidebarImg) {
				sidebarImg.onerror = function() {
					console.warn(`[Sidebar Update] Failed to load sidebar avatar: ${this.src}. Displaying initials.`);
					ui.sidebarAvatar.innerHTML = sanitizeHTML(initials);
				};
			}
			console.log(`[Sidebar Update] Avatar set. URL: ${finalAvatarUrl || 'Initials'}`);

			const selectedTitleKey = profile.selected_title;
			let displayTitle = 'Pilot'; // Výchozí titul
			if (selectedTitleKey && titlesData && titlesData.length > 0) {
				const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey);
				if (foundTitle && foundTitle.name) {
					displayTitle = foundTitle.name;
				} else {
					console.warn(`[Sidebar Update] Title key "${selectedTitleKey}" not found in titles list.`);
				}
			} else if (selectedTitleKey) {
				 console.warn(`[Sidebar Update] Selected title key present, but titles list is empty or not loaded.`);
			}
			ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
			ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); // Přidání tooltipu pro titul
			console.log(`[Sidebar Update] Title set to: ${displayTitle}`);

		} else {
			ui.sidebarName.textContent = "Nepřihlášen";
			ui.sidebarAvatar.textContent = '?';
			ui.sidebarUserTitle.textContent = 'Pilot'; // Výchozí titul
			ui.sidebarUserTitle.removeAttribute('title');
			console.log("[Sidebar Update] User not logged in or profile missing, sidebar set to defaults.");
		}
	}

	async function updateStatsCards(stats) {
	    console.log("[StatsCards Update] Updating stats cards. Data:", stats);
	    if (!ui.badgesCount || !ui.pointsCount || !ui.streakDays || !ui.rankValue || !ui.totalUsers) {
	        console.warn("[StatsCards Update] One or more stat card UI elements are missing. Skipping update.");
	        return;
	    }

	    ui.badgesCard?.classList.remove('loading');
	    ui.pointsCard?.classList.remove('loading');
	    ui.streakCard?.classList.remove('loading');
	    ui.rankCard?.classList.remove('loading');

	    if (stats) {
	        const earnedBadgesCount = userBadges?.length || 0; // Použijeme aktuální délku pole userBadges
	        ui.badgesCount.textContent = earnedBadgesCount;
	        if (ui.badgesChange) {
	            const totalPossibleBadges = allBadges?.length || 0;
	            if (totalPossibleBadges > 0) {
	                ui.badgesChange.innerHTML = `<i class="fas fa-trophy"></i> ${earnedBadgesCount} / ${totalPossibleBadges} celkem`;
	            } else {
	                 ui.badgesChange.innerHTML = `<i class="fas fa-info-circle"></i> Data nedostupná`;
	            }
	        }

	        ui.pointsCount.textContent = stats.points ?? 0;
	        if (ui.pointsChange) {
	            if (lastCreditTransaction && lastCreditTransaction.description) {
	                const amount = lastCreditTransaction.amount;
	                let description = lastCreditTransaction.description;
                    const maxDescLength = 20;
	                if (description.length > maxDescLength) {
	                    description = description.substring(0, maxDescLength - 3) + "...";
	                }
	                const sign = amount > 0 ? '+' : (amount < 0 ? '' : '');
	                const colorClass = amount > 0 ? 'positive' : (amount < 0 ? 'negative' : '');
	                ui.pointsChange.className = `stat-card-change ${colorClass}`;
	                let displayTransactionText = `${sanitizeHTML(description)}: ${sign}${amount} kr.`;
                     if (lastCreditTransaction.description.startsWith("Odměna za sérii") && lastCreditTransaction.description.includes("):")) {
                        const actualRewardPart = lastCreditTransaction.description.split("):")[1]?.trim();
                        if (actualRewardPart) {
                           let shortActualReward = actualRewardPart;
                           if (shortActualReward.length > maxDescLength -5) {
                                shortActualReward = shortActualReward.substring(0, maxDescLength - 8) + "...";
                           }
                           displayTransactionText = `${sanitizeHTML(shortActualReward)}: ${sign}${amount} kr.`;
                        }
                    }
	                ui.pointsChange.innerHTML = `<i class="fas ${amount > 0 ? 'fa-plus-circle' : (amount < 0 ? 'fa-minus-circle' : 'fa-exchange-alt')}"></i> <span title="${sanitizeHTML(lastCreditTransaction.description)}">${displayTransactionText}</span>`;
	            } else {
	                 ui.pointsChange.innerHTML = `<i class="fas fa-history"></i> Žádné nedávné transakce`;
	            }
	        }

	        ui.streakDays.textContent = stats.streak_current ?? 0;
	        if (ui.streakChange) ui.streakChange.textContent = `MAX: ${stats.streak_longest ?? 0} dní`;

            const currentUserRankData = leaderboardData.find(u => u.user_id === currentUser?.id);
            const currentUserRank = currentUserRankData ? currentUserRankData.calculated_rank : '-'; // Použijeme calculated_rank
            const totalUsersInLeaderboard = stats.totalUsers || leaderboardData.length || '-';
	        ui.rankValue.textContent = currentUserRank;
	        if (ui.totalUsers) ui.totalUsers.textContent = totalUsersInLeaderboard;
	        if (ui.rankChange) ui.rankChange.innerHTML = `<i class="fas fa-users"></i> z <span id="total-users">${totalUsersInLeaderboard}</span> pilotů`;

	    } else {
	        ui.badgesCount.textContent = '-';
	        if (ui.badgesChange) ui.badgesChange.innerHTML = `<i class="fas fa-exclamation-circle"></i> Data nedostupná`;
	        ui.pointsCount.textContent = '-';
	        if (ui.pointsChange) ui.pointsChange.innerHTML = `<i class="fas fa-exclamation-circle"></i> Data nedostupná`;
	        ui.streakDays.textContent = '-';
	        if (ui.streakChange) ui.streakChange.textContent = `MAX: - dní`;
	        ui.rankValue.textContent = '-';
	        if (ui.totalUsers) ui.totalUsers.textContent = '-';
	        if (ui.rankChange) ui.rankChange.innerHTML = `<i class="fas fa-users"></i> z <span id="total-users">-</span> pilotů`;
	    }
	    console.log("[StatsCards Update] Stats cards updated.");
	}


	function renderUserBadges(earnedBadges) {
		console.log("[UserBadges Render] Rendering user's earned badges. Count:", earnedBadges?.length);
		if (!ui.badgeGrid || !ui.emptyBadges) {
			console.warn("[UserBadges Render] Badge grid or empty state element missing.");
			setLoadingState('userBadges', false);
			return;
		}
		ui.badgeGrid.innerHTML = '';
		if (!earnedBadges || earnedBadges.length === 0) {
			ui.badgeGrid.style.display = 'none';
			ui.emptyBadges.style.display = 'flex';
		} else {
			ui.badgeGrid.style.display = 'grid';
			ui.emptyBadges.style.display = 'none';
			const fragment = document.createDocumentFragment();
			earnedBadges.forEach((earnedBadge, index) => {
				const badge = earnedBadge.badge;
				if (!badge) {
					console.warn(`[UserBadges Render] Missing badge details for earned badge_id: ${earnedBadge.badge_id}`);
					return;
				}
				const card = document.createElement('div');
				card.className = 'badge-card card btn-tooltip';
				card.title = `Získáno: ${formatDate(earnedBadge.earned_at)}. ${badge.description || ''}`;
				card.setAttribute('data-animate', '');
				card.style.setProperty('--animation-order', index);

				const visual = badgeVisuals[badge.type?.toLowerCase()] || badgeVisuals.default;
                const iconClass = badge.icon && badge.icon.startsWith('fa-') ? badge.icon : (visual.icon || 'fa-medal');

				card.innerHTML = `
					<div class="badge-icon ${badge.type?.toLowerCase() || 'default'}" style="background: ${visual.gradient};">
						<i class="fas ${iconClass.replace(/^fa[srbd]?\s+/, '')}"></i>
					</div>
					<h3 class="badge-title">${sanitizeHTML(badge.title)}</h3>
					<p class="badge-desc">${sanitizeHTML(badge.description)}</p>
					<div class="badge-date">
						<i class="far fa-calendar-alt"></i> ${formatDate(earnedBadge.earned_at)}
					</div>
				`;
				fragment.appendChild(card);
			});
			ui.badgeGrid.appendChild(fragment);
		}
		setLoadingState('userBadges', false);
		console.log("[UserBadges Render] User badges rendering complete.");
	}

	function renderAvailableBadges(allBadgesDef, userBadgesData, profile, otherData = {}) {
		console.log("[AvailableBadges Render] Rendering available (unearned) badges. All defs:", allBadgesDef?.length);
		if (!ui.availableBadgesGrid || !ui.emptyAvailableBadges) {
			console.warn("[AvailableBadges Render] Available badges grid or empty state element missing.");
			setLoadingState('availableBadges', false);
			return;
		}

		const earnedBadgeIds = new Set((userBadgesData || []).map(b => b.badge_id));
		const available = (allBadgesDef || []).filter(b => !earnedBadgeIds.has(b.id));

		ui.availableBadgesGrid.innerHTML = '';
		if (available.length === 0) {
			ui.availableBadgesGrid.style.display = 'none';
			ui.emptyAvailableBadges.style.display = 'flex';
		} else {
			ui.availableBadgesGrid.style.display = 'grid';
			ui.emptyAvailableBadges.style.display = 'none';
			const fragment = document.createDocumentFragment();
			available.forEach((badge, index) => {
				const card = document.createElement('div');
				card.className = 'achievement-card card';
				card.setAttribute('data-animate', '');
				card.style.setProperty('--animation-order', index);

				const visual = badgeVisuals[badge.type?.toLowerCase()] || badgeVisuals.default;
				const progress = badge.requirements ? checkRequirements(profile, badge.requirements, otherData, badge.title) : { met: false, current: 0, target: 1, progressText: "N/A" };
                const iconClass = badge.icon && badge.icon.startsWith('fa-') ? badge.icon : (visual.icon || 'fa-medal');

				card.innerHTML = `
					<div class="achievement-icon ${badge.type?.toLowerCase() || 'default'}" style="background: ${visual.gradient}; opacity: ${progress.met ? 1 : 0.6};">
						<i class="fas ${iconClass.replace(/^fa[srbd]?\s+/, '')}"></i>
					</div>
					<div class="achievement-content">
						<h3 class="achievement-title">${sanitizeHTML(badge.title)}</h3>
						<p class="achievement-desc">${sanitizeHTML(badge.description)}</p>
						${badge.requirements ? `
						<div class="progress-container">
							<div class="progress-bar">
								<div class="progress-fill" style="width: ${progress.target > 0 ? Math.min(100, (progress.current / progress.target) * 100) : 0}%;"></div>
							</div>
							<div class="progress-stats">${progress.progressText}</div>
						</div>` : ''}
					</div>
				`;
				fragment.appendChild(card);
			});
			ui.availableBadgesGrid.appendChild(fragment);
		}
		setLoadingState('availableBadges', false);
		console.log("[AvailableBadges Render] Available badges rendering complete.");
	}

	function renderLeaderboard(data) {
	    console.log("[Leaderboard Render] Rendering leaderboard. Data rows:", data?.length);
	    if (!ui.leaderboardBody || !ui.leaderboardEmpty || !ui.leaderboardTableContainer || !ui.leaderboardHeader || !ui.leaderboardSkeleton) {
	        console.warn("[Leaderboard Render] Leaderboard UI elements missing.");
	        setLoadingState('leaderboard', false);
	        return;
	    }

	    ui.leaderboardSkeleton.style.display = 'none';
	    ui.leaderboardHeader.style.visibility = 'visible';

	    if (!data || data.length === 0) {
	        ui.leaderboardTableContainer.style.display = 'none';
	        ui.leaderboardEmpty.style.display = 'flex';
	    } else {
	        const sortedDataByRank = [...data].sort((a, b) => (a.calculated_rank || Infinity) - (b.calculated_rank || Infinity));

	        ui.leaderboardTableContainer.style.display = 'block';
	        ui.leaderboardEmpty.style.display = 'none';
	        ui.leaderboardBody.innerHTML = '';
	        const fragment = document.createDocumentFragment();
	        sortedDataByRank.forEach((entry) => {
	            const tr = document.createElement('tr');
	            const profileInfo = entry.profile || {};
	            const isCurrentUser = entry.user_id === currentUser?.id;
	            if (isCurrentUser) tr.classList.add('highlight-row');

	            const avatarUrl = profileInfo.avatar_url;
	            let finalAvatarUrl = avatarUrl;
	            if (avatarUrl && !avatarUrl.startsWith('http') && avatarUrl.includes('/')) {
	                finalAvatarUrl = sanitizeHTML(avatarUrl);
	            } else if (avatarUrl) {
	                finalAvatarUrl = `${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`;
	            }

	            const avatarHTML = finalAvatarUrl
	                ? `<img src="${finalAvatarUrl}" alt="Avatar">`
	                : getInitials(profileInfo);

	            tr.innerHTML = `
	                <td class="rank-cell">${entry.calculated_rank}</td>
	                <td class="user-cell">
	                    <div class="user-avatar-sm">${avatarHTML}</div>
	                    <div class="user-info-sm">
	                        <span class="user-name-sm">${sanitizeHTML(profileInfo.first_name || profileInfo.username || 'Pilot ' + (entry.calculated_rank))}</span>
	                        <span class="user-level">Úroveň ${profileInfo.level || 1}</span>
	                    </div>
	                </td>
	                <td class="score-cell">${entry.points ?? 0}</td>
	                <td class="badge-count-cell">${entry.badges_count ?? 0}</td>
	                <td class="streak-cell">${profileInfo.streak_days ?? 0}</td>
	            `;
	            fragment.appendChild(tr);
	        });
	        ui.leaderboardBody.appendChild(fragment);
	    }
	    setLoadingState('leaderboard', false);
	    console.log("[Leaderboard Render] Leaderboard rendering complete.");
	}


	function selectDailyUserSpecificTitles(allPurchasable, purchasedKeys = [], userId) {
		if (!Array.isArray(allPurchasable) || allPurchasable.length === 0) return [];

		const availableToBuy = allPurchasable.filter(title =>
			title.is_available && title.is_purchasable && !purchasedKeys.includes(title.title_key)
		);

		if (availableToBuy.length === 0) return [];
		const today = new Date();
		const dateSeed = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
		const combinedSeed = `${userId}-${dateSeed}`;
		availableToBuy.sort((a, b) => {
			const valA = getSeededSortValue(combinedSeed + a.title_key);
			const valB = getSeededSortValue(combinedSeed + b.title_key);
			return valA - valB;
		});

		return availableToBuy.slice(0, DAILY_TITLE_SHOP_COUNT);
	}

	function renderTitleShop(titlesToDisplay, profile) {
		console.log("[TitleShop Render] Rendering title shop. Titles to display:", titlesToDisplay?.length);
		if (!ui.titleShopGrid || !ui.titleShopEmpty || !ui.shopUserCredits) {
			console.warn("[TitleShop Render] Title shop UI elements missing.");
			setLoadingState('titleShop', false);
			return;
		}

		ui.shopUserCredits.textContent = profile?.points ?? 0;

		if (!titlesToDisplay || titlesToDisplay.length === 0) {
			ui.titleShopGrid.style.display = 'none';
			ui.titleShopEmpty.style.display = 'flex';
		} else {
			ui.titleShopGrid.style.display = 'grid';
			ui.titleShopEmpty.style.display = 'none';
			ui.titleShopGrid.innerHTML = '';
			const fragment = document.createDocumentFragment();
			titlesToDisplay.forEach((title, index) => {
				const item = document.createElement('div');
				item.className = 'title-item card btn-tooltip';
				item.title = title.description || title.name;
				item.setAttribute('data-animate', '');
				item.style.setProperty('--animation-order', index);

				item.innerHTML = `
					<div class="title-item-icon">
						<i class="fas ${title.icon || 'fa-scroll'}"></i>
					</div>
					<div class="title-item-content">
						<h3 class="title-item-name">${sanitizeHTML(title.name)}</h3>
						${title.description ? `<p class="title-item-desc">${sanitizeHTML(title.description)}</p>` : ''}
						<div class="title-item-footer">
							<div class="title-item-cost">
								<i class="fas fa-coins"></i> ${title.cost} Kreditů
							</div>
							<div class="title-item-actions">
								<button class="btn btn-sm buy-title-btn" data-item-type="title" data-item-key="${title.title_key}" data-item-cost="${title.cost}" ${ (profile?.points ?? 0) < title.cost ? 'disabled' : ''}>
									<i class="fas fa-shopping-cart"></i> Koupit
								</button>
							</div>
						</div>
					</div>
				`;
				fragment.appendChild(item);
			});
			ui.titleShopGrid.appendChild(fragment);
		}
		setLoadingState('titleShop', false);
		console.log("[TitleShop Render] Title shop rendering complete.");
	}

	function renderUserTitlesInventory(profile, allTitlesData) {
		console.log("[UserTitlesInventory Render] Rendering user's titles. Profile titles:", profile?.purchased_titles);
		if (!ui.userTitlesInventoryGrid || !ui.userTitlesInventoryEmpty || !profile) {
			console.warn("[UserTitlesInventory Render] UI elements or profile missing.");
			setLoadingState('userTitlesInventory', false);
			return;
		}

		const purchasedKeys = profile.purchased_titles || [];
		const userOwnedTitles = allTitlesData.filter(dbTitle => purchasedKeys.includes(dbTitle.title_key));

		ui.userTitlesInventoryGrid.innerHTML = '';
		if (userOwnedTitles.length === 0) {
			ui.userTitlesInventoryGrid.style.display = 'none';
			ui.userTitlesInventoryEmpty.style.display = 'flex';
		} else {
			ui.userTitlesInventoryGrid.style.display = 'grid';
			ui.userTitlesInventoryEmpty.style.display = 'none';
			const fragment = document.createDocumentFragment();
			userOwnedTitles.forEach((title, index) => {
				const item = document.createElement('div');
				item.className = 'title-item card';
				item.setAttribute('data-animate', '');
				item.style.setProperty('--animation-order', index);

				const isEquipped = profile.selected_title === title.title_key;
				let actionButtonHTML = '';
				if (isEquipped) {
					actionButtonHTML = `<span class="title-status equipped"><i class="fas fa-check-circle"></i> Vyzbrojeno</span>`;
				} else {
					actionButtonHTML = `<button class="btn btn-sm btn-outline equip-title-btn" data-item-type="title" data-item-key="${title.title_key}"><i class="fas fa-shield-alt"></i> Vyzbrojit</button>`;
				}

				item.innerHTML = `
					<div class="title-item-icon">
						<i class="fas ${title.icon || 'fa-user-tag'}"></i>
					</div>
					<div class="title-item-content">
						<h3 class="title-item-name">${sanitizeHTML(title.name)}</h3>
						${title.description ? `<p class="title-item-desc">${sanitizeHTML(title.description)}</p>` : ''}
						<div class="title-item-footer" style="justify-content: flex-end;">
							<div class="title-item-actions">${actionButtonHTML}</div>
						</div>
					</div>
				`;
				fragment.appendChild(item);
			});
			ui.userTitlesInventoryGrid.appendChild(fragment);
		}
		setLoadingState('userTitlesInventory', false);
		console.log("[UserTitlesInventory Render] User titles inventory rendering complete.");
	}


	function renderAvatarDecorationsShop(decorations, profile) {
		console.log("[AvatarDecorations Render] Rendering avatar decorations shop. Decorations available:", decorations?.length);
		if (!ui.avatarDecorationsGrid || !ui.avatarDecorationsEmpty || !ui.shopDecorCredits || !profile) {
			console.warn("[AvatarDecorations Render] UI elements or profile missing for avatar decorations shop.");
			setLoadingState('avatarDecorations', false);
			return;
		}

		ui.shopDecorCredits.textContent = profile.points ?? 0;

		if (!decorations || decorations.length === 0) {
			ui.avatarDecorationsGrid.style.display = 'none';
			ui.avatarDecorationsEmpty.style.display = 'flex';
		} else {
			ui.avatarDecorationsGrid.style.display = 'grid';
			ui.avatarDecorationsEmpty.style.display = 'none';
			ui.avatarDecorationsGrid.innerHTML = '';
			const fragment = document.createDocumentFragment();
			const purchasedDecorationKeys = profile.purchased_decorations || [];

			decorations.forEach((decoration, index) => {
				const item = document.createElement('div');
				item.className = 'decoration-item card btn-tooltip';
				item.title = decoration.description || decoration.name;
				item.setAttribute('data-animate', '');
				item.style.setProperty('--animation-order', index);

				const isPurchased = purchasedDecorationKeys.includes(decoration.decoration_key);
				const isEquipped = profile.selected_decoration === decoration.decoration_key;
				let actionButtonHTML = '';

				if (isEquipped) {
					actionButtonHTML = `<span class="title-status equipped" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;"><i class="fas fa-check-circle"></i> Použito</span>`;
				} else if (isPurchased) {
					actionButtonHTML = `<button class="btn btn-sm btn-outline equip-decoration-btn" data-item-type="avatar_decoration" data-item-key="${decoration.decoration_key}" style="font-size: 0.75rem; padding: 0.4rem 0.8rem;"><i class="fas fa-paint-roller"></i> Použít</button>`;
				} else {
					actionButtonHTML = `<button class="btn btn-sm buy-decoration-btn" data-item-type="avatar_decoration" data-item-key="${decoration.decoration_key}" data-item-cost="${decoration.cost}" ${ (profile.points ?? 0) < decoration.cost ? 'disabled' : ''} style="font-size: 0.75rem; padding: 0.4rem 0.8rem;">
										<i class="fas fa-shopping-cart"></i> Koupit (${decoration.cost} <i class="fas fa-coins" style="font-size:0.8em; margin-left: 2px;"></i>)
									</button>`;
				}
				const imagePreviewHTML = decoration.image_url
					? `<img src="${sanitizeHTML(decoration.image_url)}" alt="${sanitizeHTML(decoration.name)}" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 1rem; border-radius: 8px; background: rgba(var(--white-rgb), 0.05); padding: 5px;">`
					: `<div class="skeleton" style="width: 80px; height: 80px; border-radius: 8px; margin-bottom: 1rem; display:flex; align-items:center; justify-content:center;"><i class="fas fa-gem" style="font-size: 2rem; color: var(--text-muted);"></i></div>`;


				item.innerHTML = `
					${imagePreviewHTML}
					<h4 class="decoration-name" style="font-size: 1rem; font-weight: 600; color: var(--text-light); margin-bottom: 0.5rem;">${sanitizeHTML(decoration.name)}</h4>
					${decoration.description ? `<p class="decoration-desc" style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem; flex-grow: 1;">${sanitizeHTML(decoration.description)}</p>` : '<div style="flex-grow:1;"></div>'}
					<div class="decoration-actions" style="margin-top: auto; padding-top:0.5rem; border-top: 1px solid var(--border-color-light); width:100%; text-align:center;">
						${actionButtonHTML}
					</div>
				`;
				fragment.appendChild(item);
			});
			ui.avatarDecorationsGrid.appendChild(fragment);
		}
		setLoadingState('avatarDecorations', false);
		console.log("[AvatarDecorations Render] Avatar decorations shop rendering complete.");
	}

	function renderNotifications(count, notifications) {
		console.log("[Notifications Render] Rendering notifications. Count:", count);
		if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllRead) {
			console.warn("[Notifications Render] Notification UI elements missing.");
			setLoadingState('notifications', false);
			return;
		}

		ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
		ui.notificationCount.classList.toggle('visible', count > 0);

		if (notifications && notifications.length > 0) {
			ui.notificationsList.innerHTML = notifications.map(n => {
				const visual = badgeVisuals[n.type?.toLowerCase()] || badgeVisuals.default; // Použijeme badgeVisuals pro konzistenci s ostatními ikonami
				const isReadClass = n.is_read ? 'is-read' : '';
				const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : '';
				const iconClass = n.icon || visual.icon || 'fa-info-circle'; // Použijeme n.icon pokud je, jinak z badgeVisuals

				return `
					<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
						${!n.is_read ? '<span class="unread-dot"></span>' : ''}
						<div class="notification-icon ${n.type || 'default'}" style="${visual.gradient ? `background: ${visual.gradient};` : ''}"> {/* Použijeme typ z DB pro třídu, pokud není, tak default */}
							<i class="fas ${iconClass.replace(/^fa[srbd]?\s+/, '')}"></i> {/* Odstraníme prefix, pokud je již v iconClass */}
						</div>
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
			ui.notificationsList.innerHTML = '';
			ui.noNotificationsMsg.style.display = 'block';
			ui.notificationsList.style.display = 'none';
		}
		ui.markAllRead.disabled = count === 0;
		setLoadingState('notifications', false);
		console.log("[Notifications Render] Notifications rendering complete.");
	}
	// --- END: Data Rendering Functions ---

	// --- START: Shop Interaction Logic (already provided and seems fine) ---
	async function handleShopInteraction(event) {
		const button = event.target.closest('.buy-title-btn, .equip-title-btn, .buy-decoration-btn, .equip-decoration-btn');
		if (!button || button.disabled) return;

		const itemType = button.dataset.itemType;
		const itemKey = button.dataset.itemKey;
		const itemCost = parseInt(button.dataset.itemCost, 10);

		if (!itemKey || !itemType) {
			console.error("Chybí data-item-key nebo data-item-type na tlačítku.");
			return;
		}

		if (button.classList.contains('buy-title-btn') || button.classList.contains('buy-decoration-btn')) {
			await handleBuyItem(itemType, itemKey, itemCost, button);
		} else if (button.classList.contains('equip-title-btn') || button.classList.contains('equip-decoration-btn')) {
			await handleEquipItem(itemType, itemKey, button);
		}
	}

	async function handleBuyItem(itemType, itemKey, cost, buttonElement) {
		if (!currentUser || !currentProfile || !supabase) return;
		if (isLoading.buyEquip) return;
		setLoadingState('buyEquip', true);
		buttonElement.disabled = true;
		const originalButtonHTML = buttonElement.innerHTML;
		buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

		try {
			if (currentProfile.points < cost) {
				showToast("Nedostatek kreditů", "Nemáte dostatek kreditů na zakoupení této položky.", "warning");
				throw new Error("Nedostatek kreditů.");
			}

			const newPoints = currentProfile.points - cost;
			let updates = { points: newPoints, updated_at: new Date().toISOString() };
			let itemName, successMessage;

			if (itemType === 'title') {
				updates.purchased_titles = [...(currentProfile.purchased_titles || []), itemKey];
				itemName = allTitlesFromDB.find(t => t.title_key === itemKey)?.name || itemKey;
				successMessage = `Titul "${itemName}" úspěšně zakoupen!`;
			} else if (itemType === 'avatar_decoration') {
				updates.purchased_decorations = [...(currentProfile.purchased_decorations || []), itemKey];
				itemName = allDecorations.find(d => d.decoration_key === itemKey)?.name || itemKey;
				successMessage = `Dekorace "${itemName}" úspěšně zakoupena!`;
			} else {
				throw new Error("Neznámý typ položky pro nákup.");
			}

			const { data: updatedProfile, error } = await supabase
				.from('profiles')
				.update(updates)
				.eq('id', currentUser.id)
				.select(PROFILE_COLUMNS_TO_SELECT_FOR_ACHIEVEMENTS)
				.single();

			if (error) throw error;
			currentProfile = updatedProfile;
			showToast("Nákup úspěšný", successMessage, "success");
            await logActivity(currentUser.id, `purchase_${itemType}`, `Zakoupena položka: ${itemName}`, `Cena: ${cost} kreditů. Nový zůstatek: ${newPoints}.`, { item_key: itemKey, cost: cost, type: itemType });

            const totalUsersForStatsUpdateAfterBuy = (await supabase.from('profiles').select('id', { count: 'exact', head: true })).count || leaderboardData.length || 0;
			updateSidebarProfile(currentProfile, allTitlesFromDB);
			updateStatsCards({ badges: userBadges?.length || 0, points: currentProfile.points, streak_current: currentProfile.streak_days, streak_longest: currentProfile.longest_streak_days, rank: leaderboardData.find(u=>u.user_id === currentUser.id)?.calculated_rank, totalUsers: totalUsersForStatsUpdateAfterBuy });


			if (itemType === 'title') {
				renderTitleShop(selectDailyUserSpecificTitles(allTitlesFromDB, currentProfile.purchased_titles, currentUser.id), currentProfile);
				renderUserTitlesInventory(currentProfile, allTitlesFromDB);
			} else if (itemType === 'avatar_decoration') {
				renderAvatarDecorationsShop(allDecorations, currentProfile);
			}
			await checkAndAwardAchievements(currentUser.id);

		} catch (error) {
			console.error(`Chyba při nákupu ${itemType} "${itemKey}":`, error);
			showToast("Chyba nákupu", `Při pokusu o zakoupení položky nastala chyba: ${error.message}`, "error");
		} finally {
			setLoadingState('buyEquip', false);
			if (buttonElement) {
				buttonElement.innerHTML = originalButtonHTML;
				const stillAffordable = (currentProfile?.points ?? 0) >= cost;
				const isPurchased = itemType === 'title' ? (currentProfile?.purchased_titles || []).includes(itemKey) : (currentProfile?.purchased_decorations || []).includes(itemKey);
				buttonElement.disabled = isLoading.buyEquip || !stillAffordable || isPurchased;
			}
		}
	}

	async function handleEquipItem(itemType, itemKey, buttonElement) {
		if (!currentUser || !currentProfile || !supabase) return;
		if (isLoading.buyEquip) return;
		setLoadingState('buyEquip', true);
		buttonElement.disabled = true;
		const originalButtonHTML = buttonElement.innerHTML;
		buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

		try {
			let updates = { updated_at: new Date().toISOString() };
			let successMessage, previousItemKey;
			let itemName;

			if (itemType === 'title') {
				previousItemKey = currentProfile.selected_title;
				itemName = allTitlesFromDB.find(t => t.title_key === itemKey)?.name || itemKey;
				if (previousItemKey === itemKey) {
					updates.selected_title = null;
					successMessage = `Titul "${itemName}" byl odstraněn.`;
				} else {
					updates.selected_title = itemKey;
					successMessage = `Titul "${itemName}" byl úspěšně vyzbrojen!`;
				}
			} else if (itemType === 'avatar_decoration') {
				previousItemKey = currentProfile.selected_decoration;
				itemName = allDecorations.find(d => d.decoration_key === itemKey)?.name || itemKey;
				if (previousItemKey === itemKey) {
					updates.selected_decoration = null;
					successMessage = `Dekorace "${itemName}" byla odstraněna.`;
				} else {
					updates.selected_decoration = itemKey;
					successMessage = `Dekorace "${itemName}" byla úspěšně použita!`;
				}
			} else {
				throw new Error("Neznámý typ položky pro vyzbrojení.");
			}


			const { data: updatedProfile, error } = await supabase
				.from('profiles')
				.update(updates)
				.eq('id', currentUser.id)
				.select(PROFILE_COLUMNS_TO_SELECT_FOR_ACHIEVEMENTS)
				.single();

			if (error) throw error;
			currentProfile = updatedProfile;
			showToast("Akce úspěšná", successMessage, "success");
            await logActivity(currentUser.id, `equip_${itemType}`, `Vyzbrojena položka: ${itemName}`, `Klíč: ${updates.selected_title || updates.selected_decoration || 'Odebráno'}`, { item_key: itemKey, equipped: !!(updates.selected_title || updates.selected_decoration), type: itemType });


			updateSidebarProfile(currentProfile, allTitlesFromDB);
			if (itemType === 'title') {
				renderUserTitlesInventory(currentProfile, allTitlesFromDB);
			} else if (itemType === 'avatar_decoration') {
				renderAvatarDecorationsShop(allDecorations, currentProfile);
			}
            await checkAndAwardAchievements(currentUser.id);

		} catch (error) {
			console.error(`Chyba při vyzbrojování ${itemType} "${itemKey}":`, error);
			showToast("Chyba akce", `Při pokusu o akci nastala chyba: ${error.message}`, "error");
		} finally {
			setLoadingState('buyEquip', false);
			if (itemType === 'title') {
				renderUserTitlesInventory(currentProfile, allTitlesFromDB);
			} else if (itemType === 'avatar_decoration') {
				renderAvatarDecorationsShop(allDecorations, currentProfile);
			}
		}
	}
	// --- END: Shop Interaction Logic ---

	// --- START: Notification Logic ---
	async function handleNotificationClick(event) {
		const item = event.target.closest('.notification-item');
		if (!item) return;

		const notificationId = item.dataset.id;
		const link = item.dataset.link;
		const isRead = item.classList.contains('is-read');

		if (!isRead && notificationId) {
			setLoadingState('notifications', true);
			const success = await markNotificationRead(notificationId);
			if (success) {
				item.classList.add('is-read');
				const dot = item.querySelector('.unread-dot');
				if (dot) dot.remove();

				const currentCountText = ui.notificationCount.textContent.replace('+', '');
				const currentCount = parseInt(currentCountText) || 0;
				const newCount = Math.max(0, currentCount - 1);

				ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
				ui.notificationCount.classList.toggle('visible', newCount > 0);
				ui.markAllRead.disabled = newCount === 0;
			}
			setLoadingState('notifications', false);
		}
		if (link) {
			window.location.href = link;
		}
	}

	async function handleMarkAllReadClick() {
		if (!currentUser || !ui.markAllRead || ui.markAllRead.disabled) return;
		setLoadingState('notifications', true);
		ui.markAllRead.disabled = true;

		try {
			const { error } = await supabase
				.from('user_notifications')
				.update({ is_read: true })
				.eq('user_id', currentUser.id)
				.eq('is_read', false);
			if (error) throw error;

			const { unreadCount, notifications } = await fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT);
			renderNotifications(unreadCount, notifications);
			showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success');

		} catch (error) {
			console.error("Chyba při označování všech oznámení jako přečtených:", error);
			showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení jako přečtená.', 'error');
			const currentCount = parseInt(ui.notificationCount.textContent.replace('+', '') || '0');
			ui.markAllRead.disabled = currentCount === 0;
		} finally {
			setLoadingState('notifications', false);
		}
	}
	async function markNotificationRead(notificationId) {
		if (!currentUser || !notificationId) return false;
		try {
			const { error } = await supabase
				.from('user_notifications')
				.update({ is_read: true })
				.eq('user_id', currentUser.id)
				.eq('id', notificationId);
			if (error) throw error;
			return true;
		} catch (error) {
			console.error("Chyba při označování oznámení jako přečteného:", error);
			showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error');
			return false;
		}
	}
    async function logActivity(userId, type, title, description = null, details = null, link_url = null, reference_id = null, icon = null) {
        if (!supabase || !userId) {
            console.error("Nelze logovat aktivitu: Chybí Supabase klient nebo ID uživatele.");
            return;
        }
        console.log(`[Log Activity] Loguji: Uživatel ${userId}, Typ: ${type}, Titul: ${title}`);
        try {
            // Získání výchozí ikony z activityVisuals, pokud není explicitně předána a type existuje
            const defaultVisual = activityVisuals[type.toLowerCase()] || activityVisuals.default;
            const finalIcon = icon || defaultVisual.icon;

            const { error } = await supabase
                .from('activities')
                .insert({
                    user_id: userId,
                    type: type,
                    title: title,
                    description: description,
                    details: details,
                    link_url: link_url,
                    reference_id: reference_id,
                    icon: finalIcon // Použijeme finalIcon
                });
            if (error) {
                console.error("Chyba logování aktivity:", error);
            } else {
                console.log("Aktivita úspěšně zalogována.");
            }
        } catch (err) {
            console.error("Výjimka během logování aktivity:", err);
        }
    }
	// --- END: Notification Logic ---

	// --- START: Load All Data ---
	async function loadAllAwardData() {
		if (!currentUser || !supabase) {
			showError("Chyba: Nelze načíst data ocenění bez přihlášení.", true);
			setLoadingState('all', false); return;
		}
		console.log("🔄 [LoadAwards] Loading all award page data...");
		hideError();
		setLoadingState('all', true);
		try {
			const results = await Promise.allSettled([
				fetchUserFullProfile(currentUser.id),
				fetchAllBadgesDefinition(),
				fetchUserEarnedBadges(currentUser.id),
				fetchAllPurchasableTitles(),
				fetchAvatarDecorationsData(),
				fetchLeaderboardData('points', LEADERBOARD_LIMIT + 10),
				fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT),
				fetchUserDiagnosticTestCount(currentUser.id),
				fetchUserLearningLogsCount(currentUser.id),
				fetchUserTopicProgressList(currentUser.id),
				fetchAllExamTopics(),
				fetchUserStudyPlansCount(currentUser.id),
				fetchUserAiLessonsCompletedCount(currentUser.id),
                fetchLatestCreditTransaction(currentUser.id)
			]);
			console.log("[LoadAwards] Data fetch results:", results);

			const [
				profileResult, allBadgesResult, userBadgesResult,
				allTitlesResult, avatarShopResult, leaderboardResult,
				notificationsResult, diagnosticCountResult, learningLogsCountResult,
				topicProgressResult, examTopicsResult, studyPlansCountResult,
				aiLessonsCountResult, lastCreditTransactionResult
			] = results;

			if (profileResult.status === 'fulfilled' && profileResult.value) {
				currentProfile = profileResult.value;
				if (!currentProfile.preferences) currentProfile.preferences = {};
			} else {
				console.error("CRITICAL: Profile fetch failed:", profileResult.reason);
				showError("Nepodařilo se načíst váš profil. Některé funkce nemusí být dostupné.", true);
				currentProfile = currentProfile || { id: currentUser.id, email: currentUser.email, points: 0, badges_count: 0, streak_days: 0, longest_streak_days:0, purchased_titles: [], selected_title: null, selected_decoration: null, purchased_decorations: [] };
			}

			allBadges = (allBadgesResult.status === 'fulfilled') ? allBadgesResult.value : [];
			userBadges = (userBadgesResult.status === 'fulfilled') ? userBadgesResult.value : [];
			allTitlesFromDB = (allTitlesResult.status === 'fulfilled') ? allTitlesResult.value : [];
			allDecorations = (avatarShopResult.status === 'fulfilled') ? avatarShopResult.value : [];
			leaderboardData = (leaderboardResult.status === 'fulfilled') ? leaderboardResult.value : [];
			const { unreadCount, notifications: fetchedNotifications } = (notificationsResult.status === 'fulfilled') ? notificationsResult.value : { unreadCount: 0, notifications: [] };

			userDiagnosticTestsCount = (diagnosticCountResult.status === 'fulfilled') ? diagnosticCountResult.value : 0;
			userLearningLogsCount = (learningLogsCountResult.status === 'fulfilled') ? learningLogsCountResult.value : 0;
			userTopicProgressList = (topicProgressResult.status === 'fulfilled') ? topicProgressResult.value : [];
			allExamTopics = (examTopicsResult.status === 'fulfilled') ? examTopicsResult.value : [];
			userStudyPlansCount = (studyPlansCountResult.status === 'fulfilled') ? studyPlansCountResult.value : 0;
			userAiLessonsCompletedCount = (aiLessonsCountResult.status === 'fulfilled') ? aiLessonsCountResult.value : 0;
            lastCreditTransaction = (lastCreditTransactionResult.status === 'fulfilled') ? lastCreditTransactionResult.value : null;

			updateSidebarProfile(currentProfile, allTitlesFromDB);
            const { count: totalProfilesCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
			const statsForCards = {
				badges: userBadges?.length || 0, // Použijeme aktuální délku pole userBadges
				points: currentProfile.points,
				streak_current: currentProfile.streak_days,
				streak_longest: currentProfile.longest_streak_days,
				rank: leaderboardData.find(u => u.user_id === currentUser.id)?.calculated_rank,
				totalUsers: totalProfilesCount || leaderboardData.length || 0
			};
			updateStatsCards(statsForCards);

			renderUserBadges(userBadges);
			const otherDataForAchievements = {
				userDiagnosticTestsCount,
				userLearningLogsCount,
				userTopicProgressList,
				userStudyPlansCount,
				userAiLessonsCompletedCount,
				allExamTopics
			};
			renderAvailableBadges(allBadges, userBadges, currentProfile, otherDataForAchievements);
			renderLeaderboard(leaderboardData);
			titleShopTitles = selectDailyUserSpecificTitles(allTitlesFromDB, currentProfile.purchased_titles || [], currentUser.id);
			renderTitleShop(titleShopTitles, currentProfile);
			renderUserTitlesInventory(currentProfile, allTitlesFromDB);
			renderAvatarDecorationsShop(allDecorations, currentProfile);
			renderNotifications(unreadCount, fetchedNotifications);

			await checkAndAwardAchievements(currentUser.id);

			console.log("✅ [LoadAwards] All award page data loaded and rendered.");
		} catch (error) {
			console.error("❌ [LoadAwards] Unexpected error during loading award data:", error);
			showError(`Nepodařilo se načíst data pro stránku Ocenění: ${error.message}`, true);
		} finally {
			setLoadingState('all', false);
			initTooltips();
		}
	}
	// --- END: Load All Data ---

	// --- START: Event Listeners Setup ---
	function setupEventListeners() {
		console.log("[Oceneni SETUP] Setting up event listeners...");
		const safeAddListener = (el, ev, fn, key) => {
			if (el) {
				if (el._eventHandlers && el._eventHandlers[key] && el._eventHandlers[key][ev]) {
					el.removeEventListener(ev, el._eventHandlers[key][ev]);
					console.log(`[SETUP] Removed old listener ${ev} for ${key}`);
				}
				el.addEventListener(ev, fn);
				if (!el._eventHandlers) el._eventHandlers = {};
				if (!el._eventHandlers[key]) el._eventHandlers[key] = {};
				el._eventHandlers[key][ev] = fn;
			} else {
                if (!key.startsWith('toggle') ||
                    (key === 'toggleUserBadgesSection' || key === 'toggleUserTitlesSection' || key === 'toggleAvatarDecorationsSection')
                   ) {
					console.warn(`[SETUP] Element not found for listener: ${key}`);
                }
			}
		};
		safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
		safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
		safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');
		safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn');
		safeAddListener(ui.refreshDataBtn, 'click', loadAllAwardData, 'refreshDataBtn');

		safeAddListener(ui.notificationBell, 'click', (e) => { e.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell');
		safeAddListener(ui.markAllRead, 'click', handleMarkAllReadClick, 'markAllRead');
		safeAddListener(ui.notificationsList, 'click', handleNotificationClick, 'notificationsList');

		safeAddListener(ui.titleShopGrid, 'click', handleShopInteraction, 'titleShopGrid');
		safeAddListener(ui.avatarDecorationsGrid, 'click', handleShopInteraction, 'avatarDecorationsGrid');
		safeAddListener(ui.userTitlesInventoryGrid, 'click', handleShopInteraction, 'userTitlesInventoryGrid');


		document.querySelectorAll('.sidebar-link').forEach(l => {
			safeAddListener(l, 'click', () => { if (window.innerWidth <= 992) closeMenu(); }, 'sidebarLink_' + (l.textContent?.trim() || 'unknown'));
		});

		window.addEventListener('online', updateOnlineStatus);
		window.addEventListener('offline', updateOnlineStatus);

		document.removeEventListener('click', handleOutsideNotificationClick);
		document.addEventListener('click', handleOutsideNotificationClick);

        const sectionToggleMap = {
            toggleUserBadgesSection: { content: ui.userBadgesContent, active: true },
            toggleAvailableBadgesSection: { content: ui.availableBadgesContent, active: false },
            toggleUserTitlesSection: { content: ui.userTitlesInventoryContent, active: true },
            toggleTitleShopSection: { content: ui.titleShopContent, active: false },
            toggleAvatarDecorationsSection: { content: ui.avatarDecorationsContent, active: true },
            toggleLeaderboardSection: { content: ui.leaderboardContent, active: false }
        };

		Object.keys(sectionToggleMap).forEach(buttonKey => {
			const button = ui[buttonKey];
			const config = sectionToggleMap[buttonKey];
            const contentElement = config.content;
            const sectionCard = button?.closest('.card-section');

			if (contentElement) {
                if (!config.active) {
                    if (button) button.style.display = 'none';
                    contentElement.style.maxHeight = '';
                    contentElement.style.opacity = '1';
                    contentElement.style.visibility = 'visible';
                    contentElement.style.paddingTop = '';
                    contentElement.style.paddingBottom = '';
                    contentElement.style.marginTop = '';
                    contentElement.style.marginBottom = '';
                    contentElement.removeAttribute('aria-hidden');
                    if (sectionCard) sectionCard.classList.remove('collapsed-section');
                    console.log(`[SETUP] Section ${buttonKey || contentElement.id} is NOT collapsible. Button hidden, content forced visible.`);
                } else if (button) {
				    const localStorageKey = `section-${buttonKey}-collapsed`;
				    let isInitiallyCollapsed = localStorage.getItem(localStorageKey) === 'true';

				    if (localStorage.getItem(localStorageKey) === null && sectionCard) {
					    isInitiallyCollapsed = sectionCard.classList.contains('collapsed-section');
				    }

				    const icon = button.querySelector('i');

				    const applyCollapsedState = (collapsing) => {
					    if (icon) {
						    icon.classList.toggle('fa-chevron-down', collapsing);
						    icon.classList.toggle('fa-chevron-up', !collapsing);
						    button.title = collapsing ? "Rozbalit sekci" : "Sbalit sekci";
					    }
					    if (sectionCard) {
						    sectionCard.classList.toggle('collapsed-section', collapsing);
					    }
					    if (collapsing) {
						    contentElement.style.maxHeight = '0px';
						    contentElement.style.paddingTop = '0px';
						    contentElement.style.paddingBottom = '0px';
						    contentElement.style.marginTop = '0px';
						    contentElement.style.marginBottom = '0px';
						    contentElement.style.opacity = '0';
						    contentElement.setAttribute('aria-hidden', 'true');
						    setTimeout(() => { if(contentElement.style.maxHeight === '0px') contentElement.style.visibility = 'hidden'; }, 450);
					    } else {
						    contentElement.style.visibility = 'visible';
						    contentElement.style.opacity = '1';
                            contentElement.style.paddingTop = '';
                            contentElement.style.paddingBottom = '';
                            contentElement.style.marginTop = '';
                            contentElement.style.marginBottom = '';
						    contentElement.style.maxHeight = contentElement.scrollHeight + "px";
						    contentElement.removeAttribute('aria-hidden');
						    setTimeout(() => {
							    if (contentElement.style.maxHeight !== '0px') {
								    contentElement.style.maxHeight = '';
							    }
						    }, 460);
					    }
				    };
				    applyCollapsedState(isInitiallyCollapsed);
				    safeAddListener(button, 'click', () => {
					    const isCurrentlyCollapsed = sectionCard ? sectionCard.classList.contains('collapsed-section') : (contentElement.style.maxHeight === '0px');
					    const isCollapsing = !isCurrentlyCollapsed;
					    applyCollapsedState(isCollapsing);
					    localStorage.setItem(localStorageKey, isCollapsing ? 'true' : 'false');
					    console.log(`Toggled section for button ${buttonKey}. Collapsed: ${isCollapsing}`);
				    }, buttonKey);
                } else if (!button && config.active) {
                     console.warn(`[SETUP] Toggle button with key '${buttonKey}' not found in ui cache but section is marked active.`);
                }
			} else {
				console.warn(`[SETUP] Content element for toggle button '${buttonKey}' or button itself not found.`);
			}
		});
		console.log("[Oceneni SETUP] Event listeners setup complete.");
	}

	function handleOutsideNotificationClick(event) {
		if (ui.notificationsDropdown?.classList.contains('active') &&
			!ui.notificationsDropdown.contains(event.target) &&
			!ui.notificationBell?.contains(event.target)) {
			ui.notificationsDropdown.classList.remove('active');
		}
	}
	// --- END: Event Listeners Setup ---

	// --- START: Initialization ---
	async function initializeApp() {
		console.log(`🚀 [Init Oceneni v23.23.13] Starting...`);
		cacheDOMElements();
		if (!initializeSupabase()) return;

		applyInitialSidebarState();

		if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
		if (ui.mainContent) ui.mainContent.style.display = 'none';

		hideError();

		try {
			console.log("[Init Oceneni] Checking auth session...");
			const { data: { session }, error: sessionError } = await supabase.auth.getSession();
			if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);

			if (!session || !session.user) {
				console.log('[Init Oceneni] User not logged in. Redirecting to /auth/index.html');
				window.location.href = '/auth/index.html';
				return;
			}
			currentUser = session.user;
			console.log(`[Init Oceneni] User authenticated (ID: ${currentUser.id}).`);

			const [profileResult, titlesResultInitial] = await Promise.allSettled([
				fetchUserFullProfile(currentUser.id),
				fetchAllPurchasableTitles()
			]);

			if (profileResult.status === 'fulfilled' && profileResult.value) {
				currentProfile = profileResult.value;
				if (!currentProfile.preferences) currentProfile.preferences = {};
			} else {
				console.error("CRITICAL: Profile fetch failed in initializeApp:", profileResult.reason);
				showError("Nepodařilo se načíst váš profil. Některé funkce nemusí být dostupné.", true);
				currentProfile = currentProfile || { id: currentUser.id, email: currentUser.email, points: 0, badges_count: 0, streak_days: 0, longest_streak_days:0, purchased_titles: [], selected_title: null, selected_decoration: null, purchased_decorations: [] };
			}

			allTitlesFromDB = (titlesResultInitial.status === 'fulfilled' && titlesResultInitial.value) ? titlesResultInitial.value : [];
			console.log(`[Init Oceneni] All DB titles loaded: ${allTitlesFromDB.length}`);

			updateSidebarProfile(currentProfile, allTitlesFromDB);
			setupEventListeners();
			initMouseFollower();
			initHeaderScrollDetection();
			updateCopyrightYear();
			updateOnlineStatus();

			fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT)
				.then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
				.catch(err => {
					console.error("Failed to load notifications initially:", err);
					renderNotifications(0, []);
				});

			await loadAllAwardData();

			if (ui.initialLoader) {
				ui.initialLoader.classList.add('hidden');
				setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500);
			}
			if (ui.mainContent) {
				ui.mainContent.style.display = 'block';
				requestAnimationFrame(() => {
					ui.mainContent.classList.add('loaded');
					initScrollAnimations();
				});
			}
			initTooltips();

			console.log("✅ [Init Oceneni] Page initialized.");

		} catch (error) {
			console.error("❌ [Init Oceneni] Kritická chyba inicializace:", error);
			const loader = ui.initialLoader;
			if (loader && !loader.classList.contains('hidden')) {
				loader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE STRÁNKU.</p>`;
			} else {
				showError(`Chyba inicializace: ${error.message}`, true);
			}
			if (ui.mainContent) ui.mainContent.style.display = 'block';
			setLoadingState('all', false);
		}
	}

	function initializeSupabase() {
		try {
			if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
				throw new Error("Supabase library not loaded.");
			}
			supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
			if (!supabase) throw new Error("Supabase client creation failed.");
			console.log('[Supabase] Client initialized for oceneni.js.');
			return true;
		} catch (error) {
			console.error('[Supabase] Initialization failed:', error);
			showError("Kritická chyba: Nepodařilo se připojit k databázi.", true);
			return false;
		}
	}
	// --- END: Initialization ---

	// --- Run ---
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initializeApp);
	} else {
		initializeApp();
	}

})();