// dashboard/procvicovani/main.js
// Version: 25.1.5 - Добавлена функция ensureUserTopicProgressRecords для автоматического создания записей прогресса по темам для пользователя.
// Удалена секция "Témata k Procvičení".
// Добавлена секция "Moje úspěchy a odznaky".

(function() { // Start IIFE
	'use strict';

	// --- START: Constants and Configuration ---
	const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
	const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
	const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
	const NOTIFICATION_FETCH_LIMIT = 5;
	const LEARNING_GOAL_KEY = 'userLearningGoal';
	const GOAL_DETAILS_KEY = 'userLearningGoalDetails';
	const LAST_ACTIVE_TAB_KEY = 'lastActiveProcvicovaniTab';
	const USER_BADGES_LIMIT = 4; 
	const PERFORMANCE_LOGGING_ENABLED = true;
	// --- END: Constants and Configuration ---

	// --- START: State Variables ---
	let supabase = null;
	let currentUser = null;
	let currentProfile = null;
	let allTitles = [];
	let userStatsData = null;
	let diagnosticResultsData = [];
	let testsChartInstance = null;
	let studyPlanData = null;
	let planActivitiesData = [];
	let isLoading = {
		stats: false, tests: false, plan: false, 
		shortcuts: false, notifications: false,
		goalSelection: false, all: false,
		'practice-tab': false,
		'study-plan-tab': false,
		'vyuka-tab': false,
		userBadges: false 
	};
	let goalSelectionInProgress = false;
	let pendingGoal = null;
	let isInitialPageLoadComplete = false;
	let currentlyLoadingTabId = null;
	let performanceTimers = {};
	// --- END: State Variables ---

	// --- START: UI Elements Cache ---
	const ui = {}; 
	// --- END: UI Elements Cache ---

	// --- START: Helper Functions ---
	// ... (все существующие вспомогательные функции остаются здесь без изменений)
	const topicIcons = {
		"Algebra": "fa-calculator",
		"Geometrie": "fa-draw-polygon",
		"Funkce": "fa-chart-line",
		"Rovnice": "fa-equals",
		"Statistika": "fa-chart-bar",
		"Kombinatorika": "fa-dice-d6",
		"Posloupnosti": "fa-ellipsis-h",
		"Číselné obory": "fa-hashtag",
		"Procenta": "fa-percentage",
		"Výrazy": "fa-square-root-alt",
		"Slovní úlohy": "fa-comment-dots",
		default: "fa-atom"
	};
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
	function initDeferredUIFeatures() { startPerformanceTimer('initDeferredUIFeatures'); console.log("[Deferred UI] Initializing non-critical UI features..."); if (typeof initMouseFollower === 'function') initMouseFollower(); if (typeof initHeaderScrollDetection === 'function') initHeaderScrollDetection(); if (typeof updateOnlineStatus === 'function') updateOnlineStatus(); if (typeof initScrollAnimations === 'function') initScrollAnimations(); stopPerformanceTimer('initDeferredUIFeatures'); }
	function initScrollAnimations() { console.log("[Procvičování UI Placeholder] initScrollAnimations called."); }
	function initHeaderScrollDetection() { console.log("[Procvičování UI Placeholder] initHeaderScrollDetection called."); }
	function updateOnlineStatus() { console.log("[Procvičování UI Placeholder] updateOnlineStatus called."); }
	function initMouseFollower() { console.log("[Procvičování UI Placeholder] initMouseFollower called."); }
	function renderMessage(container, type = 'info', title, message, addButtons = []) { if (!container) { console.error("[RenderMessage] Container not found!"); return; } console.log(`[RenderMessage] Rendering into: #${container.id || container.tagName}, Type: ${type}, Title: ${title}`); const iconMap = { info: 'fa-info-circle', warning: 'fa-exclamation-triangle', error: 'fa-exclamation-circle', empty: 'fa-box-open' }; let buttonsHTML = ''; addButtons.forEach(btn => { buttonsHTML += `<button class="btn ${btn.class || 'btn-primary'}" id="${btn.id}" ${btn.disabled ? 'disabled' : ''}>${btn.icon ? `<i class="fas ${btn.icon}"></i> ` : ''}${sanitizeHTML(btn.text)}</button>`; }); container.innerHTML = `<div class="empty-state ${type}" style="display: flex;"> <i class="fas ${iconMap[type] || iconMap.info} empty-state-icon"></i> <h3>${sanitizeHTML(title)}</h3> <p>${sanitizeHTML(message)}</p> <div class="action-buttons">${buttonsHTML}</div> </div>`; container.style.display = 'flex'; addButtons.forEach(btn => { const btnElement = container.querySelector(`#${btn.id}`); if (btnElement && btn.onClick) btnElement.addEventListener('click', btn.onClick); }); }
	function startPerformanceTimer(timerName) { if (!PERFORMANCE_LOGGING_ENABLED) return; performanceTimers[timerName] = performance.now(); console.log(`[Perf] Timer "${timerName}" started.`); }
	function stopPerformanceTimer(timerName) { if (!PERFORMANCE_LOGGING_ENABLED || !performanceTimers[timerName]) return; const startTime = performanceTimers[timerName]; const endTime = performance.now(); const duration = endTime - startTime; console.log(`[Perf] Timer "${timerName}" stopped. Duration: ${duration.toFixed(2)} ms`); delete performanceTimers[timerName]; return duration; }
	// --- END: Helper Functions ---

	// --- START: Skeleton Rendering Functions ---
	function renderStatsSkeletons(container) { if (!container) { console.warn("[Skeletons] Stats container not found."); return; } console.log("[Skeletons] Rendering stats skeletons..."); container.innerHTML = ''; for (let i = 0; i < 4; i++) { container.innerHTML += ` <div class="dashboard-card card loading"> <div class="loading-skeleton"> <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 1rem;"></div> <div class="skeleton" style="height: 35px; width: 40%; margin-bottom: 0.8rem;"></div> <div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 1.5rem;"></div> <div class="skeleton" style="height: 14px; width: 50%;"></div> </div> </div>`; } container.classList.add('loading'); container.style.display = 'grid'; }
	function renderPlanSkeletons(container) { const content = document.getElementById('study-plan-content'); if (!container || !content) { console.warn("[Skeletons] Study plan container or content not found."); return; } console.log("[Skeletons] Rendering plan skeletons..."); content.innerHTML = `<div class="plan-summary card loading"><div class="loading-skeleton"><div class="skeleton" style="height: 24px; width: 40%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 16px; width: 60%; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 16px; width: 50%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 30px; width: 120px;"></div></div></div>`; container.classList.add('loading'); container.style.display = 'block'; }
	function renderShortcutSkeletons(container) { if (!container) { console.warn("[Skeletons] Shortcuts grid container not found."); return; } console.log("[Skeletons] Rendering shortcut skeletons..."); container.innerHTML = ''; for(let i = 0; i < 3; i++) { container.innerHTML += `<div class="shortcut-card card loading"><div class="loading-skeleton" style="align-items: center; padding: 1.8rem;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 16px; margin-bottom: 1.2rem;"></div><div class="skeleton" style="height: 18px; width: 70%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.4rem;"></div><div class="skeleton" style="height: 14px; width: 80%;"></div></div></div>`; } container.classList.add('loading'); container.style.display = 'grid'; }
	function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) {console.warn("[Skeletons] Notifications list or no-message element not found."); return;} let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton"></div><div class="notification-content"><div class="skeleton" style="height:16px;width:70%;margin-bottom:6px;"></div><div class="skeleton" style="height:12px;width:90%;"></div><div class="skeleton" style="height:10px;width:40%;margin-top:6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
	// --- END: Skeleton Rendering Functions ---

	// --- START: User Badges Logic ---
	function renderUserBadgesSkeletons(container) {
		if (!container) { console.warn("[Skeletons] User badges container not found."); return; }
		console.log("[Skeletons] Rendering user badges skeletons...");
		container.innerHTML = ''; // Clear previous content
		let skeletonHTML = '';
		for (let i = 0; i < USER_BADGES_LIMIT; i++) {
			skeletonHTML += `
				<div class="item-card card loading item-card-skeleton user-badge-skeleton">
					<div class="loading-skeleton" style="align-items: center; padding: 1.5rem;">
						<div class="skeleton" style="width: 50px; height: 50px; border-radius: 50%; margin-bottom: 1rem; background-color: var(--skeleton-highlight);"></div>
						<div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 0.6rem;"></div>
						<div class="skeleton" style="height: 12px; width: 60%;"></div>
					</div>
				</div>`;
		}
		container.innerHTML = skeletonHTML;
		container.classList.add('loading'); // Add loading class to container
		container.style.display = 'grid'; // Ensure it's visible
	}

	async function loadAndRenderUserBadges() {
		startPerformanceTimer('loadAndRenderUserBadges');
		console.log("[User Badges] Loading and rendering user badges...");
		if (!ui.userBadgesContainer) { // Новый UI элемент
			console.error("[User Badges] Container #user-badges-container not found.");
			stopPerformanceTimer('loadAndRenderUserBadges');
			return;
		}
		setLoadingState('userBadges', true); // Используем новое состояние загрузки

		try {
			if (!supabase || !currentUser) {
				throw new Error("Supabase client or current user not initialized.");
			}

			// Загрузка последних USER_BADGES_LIMIT значков пользователя, включая информацию о значке из таблицы badges
			const { data: userBadges, error } = await supabase
				.from('user_badges')
				.select(`
					id,
					user_id,
					badge_id,
					earned_at,
					badges (
						title,
						description,
						icon_class,
						rarity
					)
				`)
				.eq('user_id', currentUser.id)
				.order('earned_at', { ascending: false })
				.limit(USER_BADGES_LIMIT);

			if (error) {
				console.error("[User Badges] Error fetching user badges:", error);
				throw error;
			}

			ui.userBadgesContainer.innerHTML = ''; // Очистка перед рендерингом

			if (!userBadges || userBadges.length === 0) {
				renderMessage(ui.userBadgesContainer, 'empty', 'Žádné odznaky', 'Zatím jsi nezískal/a žádné odznaky. Pokračuj v učení a sbírej je!');
			} else {
				const fragment = document.createDocumentFragment();
				userBadges.forEach((userBadge, index) => {
					const badge = userBadge.badges; // Данные из связанной таблицы badges
					if (!badge) return; // Пропускаем, если данные значка отсутствуют

					const card = document.createElement('div'); // Используем div, так как это не ссылка
					card.className = `item-card card user-badge-card rarity-${badge.rarity || 'common'}`;
					card.setAttribute('data-animate', '');
					card.style.setProperty('--animation-order', index + 1);
					card.title = `${badge.title}\nZískáno: ${formatDate(userBadge.earned_at)}\n\n${badge.description || ''}`;


					const iconClass = badge.icon_class || 'fa-medal'; // Иконка по умолчанию
					const rarityColor = {
						common: 'var(--text-muted)',
						rare: 'var(--accent-primary)',
						epic: 'var(--accent-secondary)',
						legendary: 'var(--accent-orange)'
					}[badge.rarity || 'common'];

					card.innerHTML = `
						<div class="shortcut-icon user-badge-icon" style="color: ${rarityColor}; border: 2px solid ${rarityColor};">
							<i class="fas ${iconClass}"></i>
						</div>
						<h3 class="shortcut-title">${sanitizeHTML(badge.title)}</h3>
						<p class="shortcut-desc user-badge-earned-date">Získáno: ${formatDate(userBadge.earned_at)}</p>
					`;
					fragment.appendChild(card);
				});
				ui.userBadgesContainer.appendChild(fragment);
				ui.userBadgesContainer.style.display = 'grid'; // Убедимся, что контейнер видим
			}

			if (typeof initScrollAnimations === 'function') initScrollAnimations();
			if (typeof initTooltips === 'function') initTooltips(); // Для title атрибутов

		} catch (error) {
			console.error("[User Badges] Failed to load and render user badges:", error);
			renderMessage(ui.userBadgesContainer, 'error', 'Chyba načítání odznaků', `Nepodařilo se načíst tvé úspěchy: ${error.message}`);
		} finally {
			setLoadingState('userBadges', false);
			console.log("[User Badges] Loading and rendering finished.");
			stopPerformanceTimer('loadAndRenderUserBadges');
		}
	}
	// --- END: User Badges Logic ---


	// --- START: Loading State Management ---
	function setLoadingState(sectionKey, isLoadingFlag) {
		startPerformanceTimer(`setLoadingState_${sectionKey}_${isLoadingFlag}`);
		console.log(`[SetLoadingState v3.1] Called for section: ${sectionKey}, isLoading: ${isLoadingFlag}`);
		if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') {
			console.log(`[SetLoadingState v3.1] State for ${sectionKey} already ${isLoadingFlag}. Skipping DOM changes.`);
			stopPerformanceTimer(`setLoadingState_${sectionKey}_${isLoadingFlag}`);
			return;
		}
		isLoading[sectionKey] = isLoadingFlag;

		const loaderMap = {
			stats: ui.statsCards,
			shortcuts: ui.shortcutsGrid,
			plan: ui.studyPlanContainer,
			notifications: ui.notificationsList,
			userBadges: ui.userBadgesContainer // Добавлено
		};
		const contentMap = { plan: ui.studyPlanContent };
		const emptyMap = { plan: ui.studyPlanEmpty, notifications: ui.noNotificationsMsg, userBadges: null }; // Для userBadges пока нет отдельного empty state
		const skeletonFnMap = {
			stats: renderStatsSkeletons,
			shortcuts: renderShortcutSkeletons,
			plan: renderPlanSkeletons,
			notifications: renderNotificationSkeletons,
			userBadges: renderUserBadgesSkeletons // Добавлено
		};
		const displayTypeMap = { stats: 'grid', shortcuts: 'grid', plan: 'block', notifications: 'block', userBadges: 'grid' };

		let container = null;
		let skeletonFn = null;
		let emptyStateEl = null;
		let contentEl = null;
		let displayType = 'block';

		if (sectionKey === 'practice-tab') {
			setLoadingState('stats', isLoadingFlag);
			setLoadingState('shortcuts', isLoadingFlag);
			setLoadingState('userBadges', isLoadingFlag); // Загружаем значки вместо тем
			stopPerformanceTimer(`setLoadingState_${sectionKey}_${isLoadingFlag}`);
			return;
		} else if (sectionKey === 'study-plan-tab') {
			setLoadingState('plan', isLoadingFlag);
			stopPerformanceTimer(`setLoadingState_${sectionKey}_${isLoadingFlag}`);
			return;
		} else if (sectionKey === 'vyuka-tab') {
			console.log("[SetLoadingState v3.1] Vyuka tab state (static).");
			stopPerformanceTimer(`setLoadingState_${sectionKey}_${isLoadingFlag}`);
			return;
		} else if (sectionKey === 'goalSelection') {
			console.log("[SetLoadingState v3.1] Goal selection state:", isLoadingFlag);
			stopPerformanceTimer(`setLoadingState_${sectionKey}_${isLoadingFlag}`);
			return;
		} else if (loaderMap[sectionKey] !== undefined) {
			container = loaderMap[sectionKey];
			skeletonFn = skeletonFnMap[sectionKey];
			emptyStateEl = emptyMap[sectionKey];
			contentEl = contentMap[sectionKey];
			displayType = displayTypeMap[sectionKey] || 'block';
		} else {
			console.warn(`[SetLoadingState v3.1] Unknown section key or no UI mapping: '${sectionKey}'`);
			stopPerformanceTimer(`setLoadingState_${sectionKey}_${isLoadingFlag}`);
			return;
		}

		const primaryElement = contentEl || container;

		if (isLoadingFlag) {
			console.log(`[SetLoadingState v3.1] Applying loading state for ${sectionKey}.`);
			if (emptyStateEl) emptyStateEl.style.display = 'none';
			if (primaryElement) {
                // Очищаем только если нет скелетонов (чтобы избежать мерцания)
				if (!primaryElement.querySelector('.loading-skeleton') && !primaryElement.querySelector('.item-card-skeleton')) {
					primaryElement.innerHTML = '';
				}
				primaryElement.style.display = 'none'; // Сначала скрываем, потом показываем скелетоны
				if (skeletonFn) {
					skeletonFn(primaryElement); // Рендерим скелетоны
					primaryElement.style.display = displayType; // И показываем
				}
			}
			if (container && container !== primaryElement) {
				container.classList.add('loading');
			}
		} else {
			console.log(`[SetLoadingState v3.1 Cleanup] Clearing loading state for ${sectionKey}.`);
			if (container) {
				container.classList.remove('loading');
			}
            // Если после загрузки контента нет (например, renderMessage вызвался), то скелетоны уже удалены
            // Если же контент был, он заменит скелетоны.
		}
		stopPerformanceTimer(`setLoadingState_${sectionKey}_${isLoadingFlag}`);
	}
	// --- END: Loading State Management ---

	// --- START: Notification Stubs ---
	async function fetchNotifications(userId, limit) { startPerformanceTimer('fetchNotifications'); console.log(`[Notifications Stub] fetchNotifications called for user ${userId}, limit ${limit}.`); setLoadingState('notifications', true); await new Promise(resolve => setTimeout(resolve, 600)); console.log("[Notifications Stub] fetchNotifications finished delay."); const fakeNotifications = []; renderNotifications(0, fakeNotifications); stopPerformanceTimer('fetchNotifications'); return { unreadCount: 0, notifications: fakeNotifications }; }
	function renderNotifications(count, notifications) { startPerformanceTimer('renderNotifications'); console.log(`[Notifications Stub] renderNotifications called with count ${count}.`); const list = ui.notificationsList; const noMsg = ui.noNotificationsMsg; const btn = ui.markAllReadBtn; const bellCount = ui.notificationCount; if (!list || !noMsg || !btn || !bellCount) { console.error("[Notifications Stub] UI elements missing."); setLoadingState('notifications', false); stopPerformanceTimer('renderNotifications'); return; } bellCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); bellCount.classList.toggle('visible', count > 0); if (notifications?.length > 0) { list.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join(''); noMsg.style.display = 'none'; list.style.display = 'block'; } else { list.innerHTML = ''; noMsg.style.display = 'block'; list.style.display = 'none'; } btn.disabled = count === 0; setLoadingState('notifications', false); stopPerformanceTimer('renderNotifications'); }
	async function markNotificationRead(notificationId) { startPerformanceTimer('markNotificationRead'); console.log(`[Notifications Stub] markNotificationRead for ID ${notificationId}.`); await new Promise(resolve => setTimeout(resolve, 200)); stopPerformanceTimer('markNotificationRead'); return true; }
	async function markAllNotificationsRead() { startPerformanceTimer('markAllNotificationsRead'); console.log(`[Notifications Stub] markAllNotificationsRead.`); setLoadingState('notifications', true); await new Promise(resolve => setTimeout(resolve, 300)); renderNotifications(0, []); stopPerformanceTimer('markAllNotificationsRead'); }
	// --- END: Notification Stubs ---

	// --- START: Goal Selection Logic ---
	function checkUserGoalAndDiagnostic() { startPerformanceTimer('checkUserGoalAndDiagnostic'); console.log("[Goal Check] Checking user goal and diagnostic status..."); try { if (!currentProfile) { console.warn("[Goal Check] Profile not loaded yet."); if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; stopPerformanceTimer('checkUserGoalAndDiagnostic'); return; } if (!currentProfile.learning_goal) { if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none'; console.log("[Goal Check] No learning_goal. Showing modal."); showGoalSelectionModal(); stopPerformanceTimer('checkUserGoalAndDiagnostic'); return; } const goal = currentProfile.learning_goal; console.log(`[Goal Check] User goal: ${goal}`); if (!ui.diagnosticPrompt) { console.warn("[Goal Check] ui.diagnosticPrompt not found."); stopPerformanceTimer('checkUserGoalAndDiagnostic'); return; } if (goal === 'exam_prep') { console.log("[Goal Check] Goal is exam_prep. Checking diagnosticResultsData."); if (diagnosticResultsData && diagnosticResultsData.length > 0) { const latestResult = diagnosticResultsData[0]; const score = latestResult.total_score ?? 0; console.log(`[Goal Check] Latest diagnostic score: ${score}`); if (score < 20) { ui.diagnosticPrompt.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: var(--accent-orange);"></i><p>Vaše skóre v posledním diagnostickém testu (${score}/50) bylo nízké. Pro optimální přípravu doporučujeme absolvovat test znovu nebo se zaměřit na slabší oblasti.</p><a href="test1.html" class="btn btn-primary" id="start-test-btn-prompt-lowscore"><i class="fas fa-play"></i> Opakovat test</a>`; ui.diagnosticPrompt.style.display = 'flex'; } else { ui.diagnosticPrompt.style.display = 'none'; console.log("[Goal Check] Diagnostic score good."); } } else { ui.diagnosticPrompt.innerHTML = `<i class="fas fa-exclamation-circle"></i><p>Pro odemčení personalizovaného obsahu a studijního plánu je potřeba absolvovat <strong>diagnostický test</strong>.</p><a href="test1.html" class="btn btn-primary" id="start-test-btn-prompt"><i class="fas fa-play"></i> Spustit test</a>`; ui.diagnosticPrompt.style.display = 'flex'; console.log("[Goal Check] No diagnostic results for exam_prep."); } } else { ui.diagnosticPrompt.style.display = 'none'; console.log("[Goal Check] Goal not exam_prep, hiding diagnostic prompt."); } } catch (error) { console.error("[Goal Check] Error:", error); if (ui.diagnosticPrompt) ui.diagnosticPrompt.style.display = 'none'; } stopPerformanceTimer('checkUserGoalAndDiagnostic'); }
	function showGoalSelectionModal() { startPerformanceTimer('showGoalSelectionModal'); if (!ui.goalSelectionModal || !ui.goalStep1) { console.error("[GoalModal] Critical modal elements missing."); showError("Chyba zobrazení výběru cíle.", true); stopPerformanceTimer('showGoalSelectionModal'); return; } console.log("[GoalModal] Showing goal selection modal."); ui.goalSelectionModal.querySelectorAll('.modal-step').forEach(step => { step.classList.remove('active'); step.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => input.checked = false); }); ui.goalStep1.classList.add('active'); ui.goalSelectionModal.style.display = 'flex'; document.body.classList.add('modal-open'); requestAnimationFrame(() => ui.goalSelectionModal.classList.add('active')); const radioListContainer = ui.goalStep1.querySelector('.goal-radio-list'); if (radioListContainer) { if (radioListContainer._goalChangeHandler) { radioListContainer.removeEventListener('change', radioListContainer._goalChangeHandler); } const newHandler = (event) => { if (event.target.type === 'radio' && event.target.name === 'learningGoal') { const selectedGoal = event.target.value; console.log(`Goal selected via radio: ${selectedGoal}`); radioListContainer.querySelectorAll('.goal-radio-label').forEach(label => { label.classList.remove('selected-goal'); }); event.target.closest('.goal-radio-label')?.classList.add('selected-goal'); handleInitialGoalSelection(selectedGoal); } }; radioListContainer.addEventListener('change', newHandler); radioListContainer._goalChangeHandler = newHandler; } else { console.error("[GoalModal] .goal-radio-list container not found!"); } stopPerformanceTimer('showGoalSelectionModal'); }
	function hideGoalSelectionModal() { startPerformanceTimer('hideGoalSelectionModal'); if (!ui.goalSelectionModal) { stopPerformanceTimer('hideGoalSelectionModal'); return; } ui.goalSelectionModal.classList.remove('active'); document.body.classList.remove('modal-open'); setTimeout(() => { if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none'; }, 300); stopPerformanceTimer('hideGoalSelectionModal'); }
	function handleInitialGoalSelection(selectedGoal) { startPerformanceTimer('handleInitialGoalSelection'); if (goalSelectionInProgress) { stopPerformanceTimer('handleInitialGoalSelection'); return; } console.log(`[GoalModal] Initial goal selected: ${selectedGoal}`); pendingGoal = selectedGoal; if (selectedGoal === 'exam_prep' || selectedGoal === 'math_explore') { saveGoalAndProceed(selectedGoal); } else { showStep2(selectedGoal); } stopPerformanceTimer('handleInitialGoalSelection'); }
	function showStep2(goalType) { startPerformanceTimer('showStep2'); const step2Id = `goal-step-${goalType.replace('math_', '')}`; const step2Element = document.getElementById(step2Id); if (!ui.goalSelectionModal || !ui.goalStep1 || !step2Element) { console.error(`[GoalModal] Cannot show step 2 for ${goalType}: Missing elements.`); showError("Chyba zobrazení kroku 2.", true); stopPerformanceTimer('showStep2'); return; } console.log(`[GoalModal] Showing step 2: #${step2Id}`); ui.goalSelectionModal.querySelectorAll('.modal-step').forEach(step => step.classList.remove('active')); step2Element.classList.add('active'); const backBtn = step2Element.querySelector('.modal-back-btn'); if (backBtn) { const oldHandler = backBtn._backHandler; if (oldHandler) backBtn.removeEventListener('click', oldHandler); const newHandler = () => handleBackToStep1(ui.goalStep1, step2Element); backBtn.addEventListener('click', newHandler); backBtn._backHandler = newHandler; } const confirmBtn = step2Element.querySelector('.modal-confirm-btn'); if (confirmBtn) { const oldHandler = confirmBtn._confirmHandler; if (oldHandler) confirmBtn.removeEventListener('click', oldHandler); const newHandler = () => handleStep2Confirm(goalType); confirmBtn.addEventListener('click', newHandler); confirmBtn._confirmHandler = newHandler; confirmBtn.disabled = false; confirmBtn.innerHTML = 'Potvrdit a pokračovat'; } stopPerformanceTimer('showStep2'); }
	function handleBackToStep1(step1Element, currentStep2Element) { startPerformanceTimer('handleBackToStep1'); console.log("[GoalModal] Back to step 1..."); if(currentStep2Element) currentStep2Element.classList.remove('active'); if(step1Element) step1Element.classList.add('active'); pendingGoal = null; stopPerformanceTimer('handleBackToStep1'); }
	function handleStep2Confirm(goalType) { startPerformanceTimer('handleStep2Confirm'); if (goalSelectionInProgress) { stopPerformanceTimer('handleStep2Confirm'); return; } const step2Id = `goal-step-${goalType.replace('math_', '')}`; const step2Element = document.getElementById(step2Id); if (!step2Element) { console.error(`[GoalModal] Step 2 element ${step2Id} not found.`); stopPerformanceTimer('handleStep2Confirm'); return; } const details = {}; let isValid = true; try { if (goalType === 'math_accelerate') { details.accelerate_areas = Array.from(step2Element.querySelectorAll('input[name="accelerate_area"]:checked')).map(cb => cb.value); const reasonRadio = step2Element.querySelector('input[name="accelerate_reason"]:checked'); details.accelerate_reason = reasonRadio ? reasonRadio.value : null; if(details.accelerate_areas.length === 0) { showToast("Chyba", "Vyberte alespoň jednu oblast zájmu.", "warning"); isValid = false; } if(!details.accelerate_reason) { showToast("Chyba", "Vyberte důvod pro učení napřed.", "warning"); isValid = false; } } else if (goalType === 'math_review') { details.review_areas = Array.from(step2Element.querySelectorAll('input[name="review_area"]:checked')).map(cb => cb.value); } } catch (e) { console.error("[GoalModal] Error getting step 2 details:", e); isValid = false; showToast("Chyba", "Chyba zpracování výběru.", "error"); } if (isValid) { console.log(`[GoalModal] Step 2 details for ${goalType}:`, details); saveGoalAndProceed(pendingGoal, details); } stopPerformanceTimer('handleStep2Confirm'); }
	async function saveGoalAndProceed(goal, details = null) { startPerformanceTimer('saveGoalAndProceed'); if (goalSelectionInProgress || !goal) { stopPerformanceTimer('saveGoalAndProceed'); return; } goalSelectionInProgress = true; setLoadingState('goalSelection', true); console.log(`[GoalModal Save] Saving goal: ${goal}, details:`, details); const activeStep = ui.goalSelectionModal?.querySelector('.modal-step.active'); const confirmButton = activeStep?.querySelector('.modal-confirm-btn'); const backButton = activeStep?.querySelector('.modal-back-btn'); if (confirmButton) { confirmButton.disabled = true; confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...'; } if (backButton) backButton.disabled = true; try { if (!supabase || !currentUser || !currentProfile) throw new Error("Core dependencies missing."); const finalPreferences = { ...(currentProfile.preferences || {}), goal_details: (details && Object.keys(details).length > 0) ? details : undefined }; const updatePayload = { learning_goal: goal, preferences: finalPreferences, updated_at: new Date().toISOString() }; console.log("[GoalModal Save] Updating Supabase profile:", updatePayload); const { data: updatedProfileData, error } = await supabase.from('profiles').update(updatePayload).eq('id', currentUser.id).select('*, selected_title, preferences, longest_streak_days').single(); if (error) throw error; currentProfile = updatedProfileData; if (!currentProfile.preferences) currentProfile.preferences = {}; console.log("[GoalModal Save] Goal saved to DB:", currentProfile.learning_goal); let goalTextKey = `goal_${goal.replace('math_', '')}`; let goalText = { goal_exam_prep: 'Příprava na zkoušky', goal_accelerate: 'Učení napřed', goal_review: 'Doplnění mezer', goal_explore: 'Volné prozkoumávání' }[goalTextKey] || goal; showToast('Cíl uložen!', `Váš cíl: ${goalText}.`, 'success'); hideGoalSelectionModal(); if (ui.mainContent) { ui.mainContent.style.display = 'flex'; requestAnimationFrame(() => { if(ui.mainContent) ui.mainContent.classList.add('loaded'); }); } else { console.warn("[GoalModal Save] mainContent element not found. Cannot make it visible."); } console.log("[GoalModal Save] Making main content areas (tabs, tab-content) visible..."); if(ui.tabsWrapper) { ui.tabsWrapper.style.display = 'flex'; ui.tabsWrapper.classList.add('visible'); } else { console.warn("[GoalModal Save] tabsWrapper not found."); } if(ui.tabContentContainer) { ui.tabContentContainer.style.display = 'flex'; ui.tabContentContainer.classList.add('visible'); } else { console.warn("[GoalModal Save] tabContentContainer not found."); } if(ui.tabContents) { ui.tabContents.forEach(el => {if (el) el.style.display='none';}); } configureUIForGoal(); await loadPageData(); if(ui.mainContent) ui.mainContent.classList.remove('interaction-disabled'); console.log("[GoalModal Save] UI configured and page data loading initiated."); } catch (error) { console.error("[GoalModal Save] Error saving goal:", error); showToast('Chyba', 'Nepodařilo se uložit váš cíl.', 'error'); if (confirmButton) { confirmButton.disabled = false; confirmButton.innerHTML = 'Potvrdit a pokračovat'; } if (backButton) backButton.disabled = false; } finally { goalSelectionInProgress = false; setLoadingState('goalSelection', false); pendingGoal = null; } stopPerformanceTimer('saveGoalAndProceed'); }
	// --- END: Goal Selection Logic ---

	// --- START: UI Configuration and Data Loading ---
	function getGoalDisplayName(goalKey) { const goalMap = { 'exam_prep': 'Příprava na přijímačky', 'math_accelerate': 'Učení napřed', 'math_review': 'Doplnění mezer', 'math_explore': 'Volné prozkoumávání', }; return goalMap[goalKey] || goalKey || 'Nenastaveno'; }
	function configureUIForGoal() { startPerformanceTimer('configureUIForGoal'); console.log("[Configure UI] Starting UI configuration based on goal..."); if (!currentProfile || !currentProfile.learning_goal) { console.error("[Configure UI] Profile or goal missing. Cannot configure UI."); if (ui.goalSelectionModal && getComputedStyle(ui.goalSelectionModal).display === 'none') { showGoalSelectionModal(); } if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'none'; ui.tabsWrapper.classList.remove('visible'); } if (ui.tabContentContainer) { ui.tabContentContainer.style.display = 'none'; ui.tabContentContainer.classList.remove('visible'); } stopPerformanceTimer('configureUIForGoal'); return; } const goal = currentProfile.learning_goal; console.log(`[Configure UI] Configuring UI for goal: ${goal}`); const dashboardTitleEl = ui.dashboardTitle; if (dashboardTitleEl) { let titleText = "Procvičování // "; let iconClass = "fas fa-laptop-code"; switch(goal) { case 'exam_prep': titleText += "Příprava na Zkoušky"; iconClass = "fas fa-graduation-cap"; break; case 'math_accelerate': titleText += "Učení Napřed"; iconClass = "fas fa-rocket"; break; case 'math_review': titleText += "Doplnění Mezer"; iconClass = "fas fa-sync-alt"; break; case 'math_explore': titleText += "Volné Prozkoumávání"; iconClass = "fas fa-compass"; break; default: titleText += "Přehled"; } dashboardTitleEl.innerHTML = `<i class="${iconClass}"></i> ${sanitizeHTML(titleText)}`; } else { console.warn("[Configure UI] Dashboard title element not found."); } if (ui.userGoalDisplay) { const goalName = getGoalDisplayName(goal); ui.userGoalDisplay.textContent = `Váš cíl: ${goalName}`; ui.userGoalDisplay.style.display = 'inline-block'; } else { console.warn("[Configure UI] User goal display element not found."); } if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'flex'; ui.tabsWrapper.classList.add('visible'); } if (ui.tabContentContainer) { ui.tabContentContainer.style.display = 'flex'; ui.tabContentContainer.classList.add('visible'); } const alwaysVisibleTabs = ['practice-tab', 'study-plan-tab', 'vyuka-tab']; if (ui.contentTabs && ui.contentTabs.length > 0) { ui.contentTabs.forEach(tabButton => { const tabId = tabButton.dataset.tab; tabButton.style.display = alwaysVisibleTabs.includes(tabId) ? 'flex' : 'none'; }); console.log("[Configure UI] Tab visibility set."); } else { console.warn("[Configure UI] Tab buttons not found."); } let activeTabId = localStorage.getItem(LAST_ACTIVE_TAB_KEY) || 'practice-tab'; let activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`); if (!activeTabButton || getComputedStyle(activeTabButton).display === 'none') { console.log(`[Configure UI] Last active tab '${activeTabId}' is invalid or hidden, defaulting to 'practice-tab'.`); activeTabId = 'practice-tab'; } console.log(`[Configure UI] Setting initial active tab UI to: ${activeTabId}`); switchActiveTabUI(activeTabId); console.log(`[Configure UI] UI configuration complete.`); stopPerformanceTimer('configureUIForGoal'); }

	async function loadTabData(tabId) {
		startPerformanceTimer(`loadTabData_${tabId}`);
		console.log(`%c[Load Tab Data v30.2 - Badges] Attempting to load data for tab: ${tabId}`, "color: #00FFFF; font-weight: bold;");
		currentlyLoadingTabId = tabId;

		if (!currentProfile || !currentProfile.learning_goal) {
			console.warn(`[Load Tab Data v30.2] Cannot load data for tab '${tabId}', missing profile or goal.`);
			const contentKey = `${tabId.replace(/-([a-z])/g, (g) => g[1].toUpperCase())}Content`;
			const contentElement = ui[contentKey];
			if (contentElement) {
				renderMessage(contentElement, 'info', 'Vyberte cíl',
					'Pro zobrazení obsahu této záložky si nejprve vyberte svůj studijní cíl.',
					[{ id: `selectGoalBtnInTab_${tabId}`, text: 'Vybrat cíl', onClick: showGoalSelectionModal, class: 'btn-primary' }]);
			} else {
				console.error(`[Load Tab Data v30.2] Content element '${contentKey}' not found.`);
			}
			currentlyLoadingTabId = null;
			setLoadingState(tabId, false);
			stopPerformanceTimer(`loadTabData_${tabId}`);
			return;
		}

		const goal = currentProfile.learning_goal;
		setLoadingState(tabId, true);
		let success = false;
		let targetContentElement = document.getElementById(`${tabId}-content`);

		if (!targetContentElement) {
			const contentKey = `${tabId.replace(/-([a-z])/g, (g) => g[1].toUpperCase())}Content`;
			targetContentElement = ui[contentKey];
			if (!targetContentElement) {
				console.error(`[Load Tab Data v30.2] Content element for tab '${tabId}' not found.`);
				setLoadingState(tabId, false);
				currentlyLoadingTabId = null;
				stopPerformanceTimer(`loadTabData_${tabId}`);
				showError(`Kritická chyba: Chybí kontejner obsahu pro záložku '${tabId}'.`, true);
				return;
			}
			console.warn(`[Load Tab Data v30.2] Used fallback UI container for tab '${tabId}'.`);
		}

		try {
			if (!isLoading[tabId] || (!targetContentElement.querySelector('.loading-skeleton') && !targetContentElement.querySelector('.item-card-skeleton'))) {
				targetContentElement.innerHTML = '';
			}
			targetContentElement.style.display = 'block';
			console.log(`[Load Tab Data v30.2] Initialized content area for ${tabId}. Starting data fetch...`);

			switch (tabId) {
				case 'practice-tab':
					setLoadingState('stats', true);
					setLoadingState('shortcuts', true);
					setLoadingState('userBadges', true); // Изменено с practiceTopics на userBadges

					// Загрузка статистики и значков параллельно
					const [statsResult] = await Promise.allSettled([ // Убрана загрузка topicProgress, т.к. она не используется
						fetchDashboardStats(currentUser.id, currentProfile)
					]);

					if (statsResult.status === 'fulfilled') {
						renderStatsCards(statsResult.value);
					} else {
						console.error(`[Load Tab Data v30.2] Error fetching stats:`, statsResult.reason);
						renderMessage(ui.statsCards || targetContentElement, 'error', 'Chyba statistik', statsResult.reason?.message || 'Neznámá chyba');
					}
					setLoadingState('stats', false);

					if (ui.shortcutsGrid) {
						renderShortcutsForGoal(goal, ui.shortcutsGrid);
					} else {
						console.warn(`[Load Tab Data v30.2] Shortcuts grid not found.`);
					}
					setLoadingState('shortcuts', false);

					if(ui.diagnosticPrompt) {
						await checkUserGoalAndDiagnostic();
					}
					await loadAndRenderUserBadges(); // Новая функция для загрузки значков
					break;

				case 'study-plan-tab':
					const planContentEl = ui.studyPlanContent;
					const planEmptyEl = ui.studyPlanEmpty;
					if (!planContentEl || !planEmptyEl) {
						throw new Error("Missing UI elements for study plan content or empty state.");
					}
					studyPlanData = await fetchActiveStudyPlan(currentUser.id, goal);
					planActivitiesData = studyPlanData ? await fetchPlanActivities(studyPlanData.id, goal) : [];
					renderStudyPlanOverview(studyPlanData, planActivitiesData, goal);
					break;

				case 'vyuka-tab':
					renderVyukaTabContent();
					break;

				default:
					console.warn(`[Load Tab Data v30.2] No specific logic for tab: ${tabId}`);
					renderMessage(targetContentElement, 'info', 'Obsah se připravuje', `Obsah pro záložku '${tabId}' bude brzy dostupný.`);
					break;
			}
			success = true;
			console.log(`%c[Load Tab Data v30.2] Successfully finished for tab: ${tabId}`, "color: lime;");
		} catch (error) {
			console.error(`[Load Tab Data v30.2] Error processing tab ${tabId}:`, error);
			renderMessage(targetContentElement, 'error', 'Chyba načítání dat', `Nepodařilo se načíst obsah: ${error.message || 'Neznámá chyba'}`);
		} finally {
			console.log(`[Load Tab Data v30.2] Entering FINALLY block for ${tabId}. Success: ${success}`);
			setLoadingState(tabId, false);
			currentlyLoadingTabId = null;
			console.log(`[Load Tab Data v30.2] Loading state for ${tabId} turned OFF.`);
			stopPerformanceTimer(`loadTabData_${tabId}`);
		}
	}
	async function loadPageData() { startPerformanceTimer('loadPageData_Total'); console.log("🔄 [Load Page Data] Starting initial data load sequence..."); hideError(); if (!currentProfile || !currentProfile.learning_goal) { console.error("[Load Page Data] Cannot load page data, profile/goal missing."); if (!currentProfile) { showGoalSelectionModal(); } else if (ui.tabsWrapper && ui.tabContentContainer) { ui.tabsWrapper.style.display = 'none'; ui.tabContentContainer.style.display = 'none'; } stopPerformanceTimer('loadPageData_Total'); return; } let activeTabId = localStorage.getItem(LAST_ACTIVE_TAB_KEY) || 'practice-tab'; let activeTabButton = document.querySelector(`.content-tab[data-tab="${activeTabId}"]`); if (!activeTabButton || getComputedStyle(activeTabButton).display === 'none') { console.warn(`[Load Page Data] Invalid/hidden last active tab '${activeTabId}', defaulting to 'practice-tab'.`); activeTabId = 'practice-tab'; localStorage.setItem(LAST_ACTIVE_TAB_KEY, activeTabId); } console.log(`[Load Page Data] Loading data for initial active tab: ${activeTabId}`); switchActiveTabUI(activeTabId); await loadTabData(activeTabId); console.log("✅ [Load Page Data] Initial page data loading process complete."); isInitialPageLoadComplete = true; stopPerformanceTimer('loadPageData_Total'); }
	function handleTabSwitch(event) { startPerformanceTimer('handleTabSwitch'); console.log("[Handle Tab Switch] Click detected."); const targetTabButton = event.currentTarget; const tabId = targetTabButton.dataset.tab; if (!tabId) { console.warn("[Handle Tab Switch] No tabId found on clicked element."); stopPerformanceTimer('handleTabSwitch'); return; } if (currentlyLoadingTabId && currentlyLoadingTabId !== tabId) { showToast('Počkejte prosím', `Data pro záložku '${currentlyLoadingTabId}' se stále načítají.`, 'info', 2500); console.warn(`[Handle Tab Switch] Blocked switch to '${tabId}' while '${currentlyLoadingTabId}' is loading.`); stopPerformanceTimer('handleTabSwitch'); return; } const currentActiveTabButton = document.querySelector('.content-tab.active'); if (targetTabButton === currentActiveTabButton && isInitialPageLoadComplete) { console.log(`[Handle Tab Switch] Tab ${tabId} is already active and loaded. Ignoruji.`); stopPerformanceTimer('handleTabSwitch'); return; } console.log(`[Handle Tab Switch] User requested switch to tab: ${tabId}`); switchActiveTabUI(tabId); loadTabData(tabId); stopPerformanceTimer('handleTabSwitch'); }
	function switchActiveTabUI(tabId) { startPerformanceTimer('switchActiveTabUI'); const targetTabButton = document.querySelector(`.content-tab[data-tab="${tabId}"]`); if (!targetTabButton) { console.warn(`[SwitchActiveTabUI] Tab button for '${tabId}' not found.`); stopPerformanceTimer('switchActiveTabUI'); return; } console.log(`[SwitchActiveTabUI] Setting active UI for tab: ${tabId}.`); ui.contentTabs?.forEach(tab => tab.classList.remove('active')); ui.tabContents?.forEach(content => { if (content) { content.classList.remove('active'); content.style.display = 'none'; } }); targetTabButton.classList.add('active'); let activeContentElement = document.getElementById(`${tabId}-content`); if (!activeContentElement) { const contentKey = `${tabId.replace(/-([a-z])/g, (g) => g[1].toUpperCase())}Content`; activeContentElement = ui[contentKey]; } if (activeContentElement) { activeContentElement.classList.add('active'); activeContentElement.style.display = 'block'; } else { console.warn(`[SwitchActiveTabUI] Content area for tab '${tabId}' not found.`); renderMessage(ui.practiceTabContent || document.body, 'error', 'Chyba zobrazení', `Obsah pro záložku '${tabId}' nelze zobrazit.`); } try { localStorage.setItem(LAST_ACTIVE_TAB_KEY, tabId); } catch (e) { console.warn("Could not save last active tab to localStorage:", e); } console.log(`[SwitchActiveTabUI] UI switched to ${tabId}.`); stopPerformanceTimer('switchActiveTabUI'); }
	async function handleRefreshClick() { startPerformanceTimer('handleRefreshClick'); if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); stopPerformanceTimer('handleRefreshClick'); return; } if (currentlyLoadingTabId) { showToast("PROBÍHÁ SYNCHRONIZACE", `Data pro záložku '${currentlyLoadingTabId}' se již načítají.`, "info"); console.warn("[Refresh] Blocked: A tab is currently loading."); stopPerformanceTimer('handleRefreshClick'); return; } console.log("🔄 Manual refresh triggered..."); const icon = ui.refreshDataBtn?.querySelector('i'); const text = ui.refreshDataBtn?.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = true; const activeTabButton = document.querySelector('.content-tab.active'); const activeTabId = activeTabButton ? activeTabButton.dataset.tab : (localStorage.getItem(LAST_ACTIVE_TAB_KEY) || 'practice-tab'); console.log(`[Refresh] Reloading data for currently active tab: ${activeTabId}`); await loadTabData(activeTabId); if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; if (ui.refreshDataBtn) ui.refreshDataBtn.disabled = false; console.log("[Refresh] Reload process initiated for active tab."); stopPerformanceTimer('handleRefreshClick'); }
	// --- END: UI Configuration and Data Loading ---

	// --- START: Initialization (Modified) ---
	function initializeSupabase() { startPerformanceTimer('initializeSupabase'); try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded or createClient is not a function."); } if (window.supabaseClient) { supabase = window.supabaseClient; console.log('[Supabase] Using existing global client instance.'); } else if (supabase === null) { supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); if (!supabase) throw new Error("Supabase client creation failed."); window.supabaseClient = supabase; console.log('[Supabase] Client initialized by main.js and stored globally.'); } else { console.log('[Supabase] Using existing local client instance.'); } stopPerformanceTimer('initializeSupabase'); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); stopPerformanceTimer('initializeSupabase'); return false; } }
	async function fetchUserProfile(userId) { 
		if (!userId || !supabase) {
			console.warn("[Fetch User Profile] Missing userId or Supabase client.");
			return null;
		}
		try {
			const { data, error } = await supabase
				.from('profiles')
				.select('*, selected_title, preferences, longest_streak_days') 
				.eq('id', userId)
				.single();
			if (error && error.code !== 'PGRST116') { 
				console.error(`[Fetch User Profile] Error fetching profile for user ${userId}:`, error);
				throw error;
			}
			return data; 
		} catch (e) {
			console.error(`[Fetch User Profile] Exception fetching profile for user ${userId}:`, e);
			showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error');
			return null;
		}
	}
	async function createDefaultProfile(userId, email) { startPerformanceTimer('createDefaultProfile'); console.log(`[Default Profile] Creating default profile for new user ${userId}...`); const defaultProfileData = { id: userId, username: email.split('@')[0], email: email, updated_at: new Date().toISOString(), learning_goal: null, preferences: {}, points: 0, level: 1, completed_exercises: 0, streak_days: 0, longest_streak_days: 0, selected_title: null, avatar_url: null, first_name: null, last_name: null, }; try { const { data, error } = await supabase.from('profiles').insert(defaultProfileData).select('*, selected_title, preferences, longest_streak_days').single(); if (error) { if (error.code === '23505') { console.warn("[Default Profile] Profile likely already exists, attempting to fetch..."); const { data: existingProfile, error: fetchError } = await supabase.from('profiles').select('*, selected_title, preferences, longest_streak_days').eq('id', userId).single(); if (fetchError) { console.error("[Default Profile] Error fetching existing profile after unique violation:", fetchError); throw fetchError; } if (!existingProfile.preferences) existingProfile.preferences = {}; stopPerformanceTimer('createDefaultProfile'); return existingProfile; } throw error; } if (!data.preferences) data.preferences = {}; console.log("[Default Profile] Default profile created successfully:", data); stopPerformanceTimer('createDefaultProfile'); return data; } catch (err) { console.error("[Default Profile] Error creating default profile:", err); showError("Nepodařilo se vytvořit uživatelský profil.", true); stopPerformanceTimer('createDefaultProfile'); return null; } }

	// --- NEW FUNCTION: ensureUserTopicProgressRecords ---
	async function ensureUserTopicProgressRecords(userId) {
		startPerformanceTimer('ensureUserTopicProgress');
		if (!supabase || !userId) {
			console.error("[Progress Ensure] Supabase client or User ID is missing.");
			stopPerformanceTimer('ensureUserTopicProgress');
			return;
		}
		console.log(`[Progress Ensure] Ensuring topic progress records for user: ${userId}`);
		try {
			// 1. Получить все темы из exam_topics
			const { data: allTopics, error: topicsError } = await supabase
				.from('exam_topics')
				.select('id');
			if (topicsError) {
				console.error("[Progress Ensure] Error fetching exam_topics:", topicsError);
				throw topicsError;
			}
			if (!allTopics || allTopics.length === 0) {
				console.warn("[Progress Ensure] No exam topics found in the database.");
				stopPerformanceTimer('ensureUserTopicProgress');
				return;
			}

			// 2. Получить существующие записи прогресса для этого пользователя
			const { data: existingProgress, error: progressError } = await supabase
				.from('user_topic_progress')
				.select('topic_id')
				.eq('user_id', userId);
			if (progressError) {
				console.error("[Progress Ensure] Error fetching existing user_topic_progress:", progressError);
				throw progressError;
			}

			const existingTopicIds = new Set(existingProgress.map(p => p.topic_id));
			const recordsToInsert = [];

			allTopics.forEach(topic => {
				if (!existingTopicIds.has(topic.id)) {
					recordsToInsert.push({
						user_id: userId,
						topic_id: topic.id,
						progress_percentage: 0,
						// last_studied_at, created_at, updated_at будут иметь значения по умолчанию или обновляться триггерами
					});
				}
			});

			if (recordsToInsert.length > 0) {
				console.log(`[Progress Ensure] Found ${recordsToInsert.length} topics without progress records. Inserting...`);
				const { error: insertError } = await supabase
					.from('user_topic_progress')
					.insert(recordsToInsert);
				
				if (insertError) {
					console.error("[Progress Ensure] Error inserting new topic progress records:", insertError);
					// Не бросаем ошибку здесь, чтобы не прерывать остальную инициализацию, но логируем
					showToast('Chyba synchronizace témat', 'Nepodařilo se vytvořit záznamy o pokroku pro některé témata.', 'warning');
				} else {
					console.log(`[Progress Ensure] Successfully inserted ${recordsToInsert.length} new topic progress records.`);
				}
			} else {
				console.log("[Progress Ensure] All topics already have progress records for this user or no new topics to add.");
			}

		} catch (error) {
			console.error("[Progress Ensure] General error in ensureUserTopicProgressRecords:", error);
			// Не показываем toast здесь, чтобы не спамить, если это фоновый процесс
		} finally {
			stopPerformanceTimer('ensureUserTopicProgress');
		}
	}
	// --- END NEW FUNCTION ---

	async function initializeApp() {
		startPerformanceTimer('initializeApp_Total');
		console.log(`[INIT Procvičování] App Init Start v25.1.5...`); // Обновленная версия
		try {
			startPerformanceTimer('initializeApp_cacheDOM');
			cacheDOMElements();
			stopPerformanceTimer('initializeApp_cacheDOM');

			if (!initializeSupabase()) { throw new Error("Supabase initialization failed."); }

			startPerformanceTimer('initializeApp_basicUISetup');
			applyInitialSidebarState(); updateCopyrightYear(); initTooltips(); setupBaseEventListeners();
			stopPerformanceTimer('initializeApp_basicUISetup');

			if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden');}
			if (ui.mainContent) ui.mainContent.style.display = 'none';
			if (ui.tabsWrapper) ui.tabsWrapper.style.display = 'none';
			if (ui.tabContentContainer) ui.tabContentContainer.style.display = 'none';
			hideError();

			console.log("[INIT Procvičování] Checking auth session...");
			startPerformanceTimer('initializeApp_getSession');
			const { data: { session }, error: sessionError } = await supabase.auth.getSession();
			stopPerformanceTimer('initializeApp_getSession');
			if (sessionError) { console.error("[INIT Procvičování] Session Error:", sessionError); throw new Error(`Chyba ověření session: ${sessionError.message}`); }

			if (session?.user) {
				currentUser = session.user;
				console.log(`[INIT Procvičování] User authenticated (ID: ${currentUser.id}). Fetching profile, titles, and notifications...`);

				startPerformanceTimer('initializeApp_fetchInitialUserData');
				const [profileResult, titlesResult, initialNotificationsResult] = await Promise.allSettled([
					fetchUserProfile(currentUser.id),
					supabase.from('title_shop').select('title_key, name'),
					fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT)
				]);
				stopPerformanceTimer('initializeApp_fetchInitialUserData');

				startPerformanceTimer('initializeApp_processProfile');
				if (profileResult.status === 'rejected' || !profileResult.value) {
					console.error("[INIT Procvičování] Profile fetch failed or returned no data:", profileResult.reason || "No data");
					currentProfile = await createDefaultProfile(currentUser.id, currentUser.email);
				} else {
					currentProfile = profileResult.value;
				}
				if (!currentProfile) throw new Error("Nepodařilo se vytvořit/načíst profil uživatele.");
				if (!currentProfile.preferences) currentProfile.preferences = {};
				console.log("[INIT Procvičování] Profile loaded/created:", currentProfile);
				stopPerformanceTimer('initializeApp_processProfile');

				startPerformanceTimer('initializeApp_processTitlesAndNotifications');
				allTitles = (titlesResult.status === 'fulfilled') ? (titlesResult.value?.data || []) : [];
				console.log(`[INIT Procvičování] Načteno ${allTitles.length} titulů.`);
				updateSidebarProfile(currentProfile, allTitles);
				if (initialNotificationsResult.status === 'fulfilled') { renderNotifications(initialNotificationsResult.value.unreadCount, initialNotificationsResult.value.notifications || []); } else { console.error("[INIT Procvičování] Chyba načítání počátečních notifikací:", initialNotificationsResult.reason); renderNotifications(0, []); }
				stopPerformanceTimer('initializeApp_processTitlesAndNotifications');

				// --- Ensure topic progress records ---
				await ensureUserTopicProgressRecords(currentUser.id); // Вызов новой функции
				// --- End ensure topic progress ---

				startPerformanceTimer('initializeApp_goalCheckAndConfig');
				const goal = currentProfile.learning_goal;
				console.log(`[INIT Goal Check] Cíl z DB: ${goal}`);

				if (ui.mainContent) {
					ui.mainContent.style.display = 'flex';
					requestAnimationFrame(() => { if(ui.mainContent) ui.mainContent.classList.add('loaded'); });
				}

				if (!goal) {
					console.log(`[INIT Procvičování] Cíl není nastaven. Zobrazuji modální okno.`);
					if (ui.tabsWrapper) { ui.tabsWrapper.style.display = 'none'; ui.tabsWrapper.classList.remove('visible'); }
					if (ui.tabContentContainer) { ui.tabContentContainer.style.display = 'none'; ui.tabContentContainer.classList.remove('visible'); }
					showGoalSelectionModal();
					hideInitialLoaderWithDelay();
				} else {
					console.log(`[INIT Procvičování] Cíl '${goal}' nastaven. Konfiguruji UI a načítám data ASYNCHRONNĚ.`);
					if (ui.goalSelectionModal) ui.goalSelectionModal.style.display = 'none';
					if(ui.tabsWrapper) { ui.tabsWrapper.style.display = 'flex'; ui.tabsWrapper.classList.add('visible'); }
					if(ui.tabContentContainer) { ui.tabContentContainer.style.display = 'flex'; ui.tabContentContainer.classList.add('visible'); }
					if(ui.tabContents) { ui.tabContents.forEach(el => {if (el) el.style.display='none';}); }

					configureUIForGoal();
					hideInitialLoaderWithDelay();
					loadPageData(); 
				}
				stopPerformanceTimer('initializeApp_goalCheckAndConfig');

				setupTabEventListeners();
				initDeferredUIFeatures();
				console.log("✅ [INIT Procvičování] Verze v25.1.5 Initialized.");

			} else {
				console.log('[INIT Procvičování] Uživatel není přihlášen, přesměrování...');
				window.location.href = '/auth/index.html';
			}
		} catch (error) {
			console.error("❌ [INIT Procvičování] Kritická chyba inicializace:", error);
			const il = ui.initialLoader;
			if (il && !il.classList.contains('hidden')) { il.innerHTML = `<p style="color:var(--accent-pink);">CHYBA (${error.message}). Obnovte.</p>`; }
			else { showError(`Chyba inicializace: ${error.message}`, true); }
			if (ui.mainContent) ui.mainContent.style.display = 'flex';
			setLoadingState('all', false);
		} finally {
			console.log("[INIT Procvičování] InitializeApp finally block finished.");
			stopPerformanceTimer('initializeApp_Total');
		}
	}

	let initialLoaderHidden = false;
	function hideInitialLoaderWithDelay() {
		if (initialLoaderHidden) return;
		initialLoaderHidden = true;

		startPerformanceTimer('hideInitialLoaderWithDelay');
		const il = ui.initialLoader;
		if (il) {
			if (!il.classList.contains('hidden')) {
				il.classList.add('hidden');
				console.log("[Loader Hide] Hiding initial loader via class.");
			}
			setTimeout(() => {
				if (il) {
					il.style.display = 'none';
					console.log("[Loader Hide] Setting initial loader display to none.");
				}
			}, 600);
		} else {
			console.warn("[Loader Hide] Initial loader element not found.");
		}
		stopPerformanceTimer('hideInitialLoaderWithDelay');
	}
	// --- END: Initialization ---

	// --- START: DOM Element Caching Function ---
	function cacheDOMElements() {
		console.log("[CACHE DOM v6.4 - User Badges] Caching elements...");
		const elementDefinitions = [
			{ key: 'initialLoader', id: 'initial-loader', critical: true },
			{ key: 'mainContent', id: 'main-content', critical: true },
			{ key: 'sidebar', id: 'sidebar', critical: true },
			{ key: 'tabsWrapper', id: 'tabs-wrapper', critical: true },
			{ key: 'tabContentContainer', query: '.tab-content-container', critical: true },
			{ key: 'practiceTabContent', id: 'practice-tab-content', critical: true },
			{ key: 'studyPlanTabContent', id: 'study-plan-tab-content', critical: true },
			{ key: 'vyukaTabContent', id: 'vyuka-tab-content', critical: true },
			{ key: 'goalSelectionModal', id: 'goal-selection-modal', critical: true },
			{ key: 'goalStep1', id: 'goal-step-1', critical: true },
			{ key: 'globalError', id: 'global-error', critical: true },
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
			{ key: 'userGoalDisplay', id: 'user-goal-display', critical: false },
			{ key: 'refreshDataBtn', id: 'refresh-data-btn', critical: false },
			{ key: 'currentYearFooter', id: 'currentYearFooter', critical: false },
			{ key: 'mouseFollower', id: 'mouse-follower', critical: false },
			{ key: 'toastContainer', id: 'toastContainer', critical: false },
			{ key: 'notificationBell', id: 'notification-bell', critical: false },
			{ key: 'notificationCount', id: 'notification-count', critical: false },
			{ key: 'notificationsDropdown', id: 'notifications-dropdown', critical: false },
			{ key: 'notificationsList', id: 'notifications-list', critical: false },
			{ key: 'noNotificationsMsg', id: 'no-notifications-msg', critical: false },
			{ key: 'markAllReadBtn', id: 'mark-all-read-btn', critical: false },
			{ key: 'diagnosticPrompt', id: 'diagnostic-prompt', critical: false },
			{ key: 'statsCards', id: 'stats-cards', critical: false },
			{ key: 'shortcutsGrid', id: 'shortcuts-grid', critical: false },
			{ key: 'studyPlanContainer', id: 'study-plan-container', critical: false },
			{ key: 'studyPlanContent', id: 'study-plan-content', critical: false },
			{ key: 'studyPlanEmpty', id: 'study-plan-empty', critical: false },
			{ key: 'goalStepAccelerate', id: 'goal-step-accelerate', critical: false },
			{ key: 'accelerateAreasGroup', id: 'accelerate-areas-group', critical: false },
			{ key: 'accelerateReasonGroup', id: 'accelerate-reason-group', critical: false },
			{ key: 'goalStepReview', id: 'goal-step-review', critical: false },
			{ key: 'reviewAreasGroup', id: 'review-areas-group', critical: false },
			{ key: 'goalStepExplore', id: 'goal-step-explore', critical: false },
			// { key: 'demoInfiniteScrollContainer', id: 'demo-infinite-scroll-items-container', critical: true }, // Удалено
			// { key: 'demoInfiniteLoader', id: 'demo-infinite-loader', critical: false }, // Удалено
			{ key: 'userBadgesContainer', id: 'user-badges-container', critical: true } // Новый элемент для значков
		];
		const notFoundCritical = [];
		const notFoundNonCritical = [];
		elementDefinitions.forEach(def => {
			const element = def.id ? document.getElementById(def.id) : document.querySelector(def.query);
			if (element) {
				ui[def.key] = element;
			} else {
				ui[def.key] = null;
				if (def.critical) notFoundCritical.push(`${def.key} (${def.id || def.query})`);
				else notFoundNonCritical.push(`${def.key} (${def.id || def.query})`);
			}
		});
		ui.contentTabs = document.querySelectorAll('.content-tab');
		ui.tabContents = document.querySelectorAll('.tab-content');

		if (notFoundCritical.length > 0) {
			console.error(`[CACHE DOM v6.4] KRITICKÉ elementy nenalezeny (${notFoundCritical.length}):`, notFoundCritical.join(', '));
			throw new Error(`Chyba načítání stránky: Kritické komponenty chybí (${notFoundCritical.join(', ')}).`);
		} else {
			console.log("[CACHE DOM v6.4] Všechny kritické elementy nalezeny.");
		}
		if (notFoundNonCritical.length > 0) console.warn(`[CACHE DOM v6.4] Některé nekritické elementy nenalezeny (${notFoundNonCritical.length}):`, notFoundNonCritical.join(', '));
		if (!ui.contentTabs || ui.contentTabs.length === 0) console.warn("[CACHE DOM v6.4] Nenalezeny žádné elementy záložek (.content-tab).");
		if (!ui.tabContentContainer) console.error("[CACHE DOM v6.4] Kritický element '.tab-content-container' nebyl nalezen!");
		if (!ui.tabContents || ui.tabContents.length === 0) console.warn("[CACHE DOM v6.4] Nenalezeny žádné elementy obsahu záložek (.tab-content).");
		if (!ui.userBadgesContainer) console.error("[CACHE DOM v6.4] Kritický element #user-badges-container nenalezen. Funkce zobrazení значков nemusí fungovat správně.");

		console.log("[CACHE DOM v6.4] Cachování dokončeno.");
	}
	// --- END: DOM Element Caching Function ---

	// --- START: Event Listeners Setup ---
	function setupBaseEventListeners() { console.log("[SETUP Base v6.3] Setting up base listeners..."); const safeAddListener = (elementOrElements, eventType, handler, descriptiveKey) => { const elements = (elementOrElements instanceof NodeList || Array.isArray(elementOrElements)) ? elementOrElements : [elementOrElements]; let count = 0; elements.forEach(element => { if (element) { const handlerKey = descriptiveKey + '_' + eventType; if (element._eventHandlers?.[handlerKey]) { console.log(`[SETUP Base] Listener ${eventType} for ${descriptiveKey} already attached. Skipping.`); return; } element.addEventListener(eventType, handler); if (!element._eventHandlers) element._eventHandlers = {}; element._eventHandlers[handlerKey] = handler; count++; } }); if (count === 0 && elements.length > 0 && elements[0] !== document && elements[0] !== window) { console.warn(`[SETUP Base v6.3] Element not found for listener: ${descriptiveKey}.`); } }; safeAddListener(ui.refreshDataBtn, 'click', handleRefreshClick, 'refreshDataBtn'); safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle'); safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle'); safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay'); safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn'); document.querySelectorAll('.sidebar-link').forEach(link => { safeAddListener(link, 'click', () => { if (window.innerWidth <= 992) closeMenu(); }, 'sidebarLink'); }); safeAddListener(ui.markAllReadBtn, 'click', markAllNotificationsRead, 'markAllReadBtn'); safeAddListener(ui.notificationBell, 'click', (event) => { event.stopPropagation(); if (ui.notificationsDropdown) { ui.notificationsDropdown.classList.toggle('active'); if (ui.notificationsDropdown.classList.contains('active') && ui.notificationsList?.innerHTML.trim() === '' && !isLoading.notifications) { if (currentUser?.id) fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT); else console.warn("[NotificationBell] Chybí currentUser.id pro načtení notifikací."); } } else { console.warn("[NotificationBell] ui.notificationsDropdown nenalezeno.");} }, 'notificationBell'); if (ui.notificationsList) { const notificationClickHandler = async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); if (ui.notificationCount) { const countText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(countText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); } if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = (parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0') === 0); } } if (link) window.location.href = link; if (ui.notificationsDropdown) ui.notificationsDropdown.classList.remove('active'); } }; safeAddListener(ui.notificationsList, 'click', notificationClickHandler, 'notificationsList'); } else { console.warn("[SETUP Base v6.3] ui.notificationsList nenalezeno."); } document.removeEventListener('click', handleOutsideNotificationClick); document.addEventListener('click', handleOutsideNotificationClick); const radioListContainer = ui.goalStep1?.querySelector('.goal-radio-list'); if (radioListContainer) { safeAddListener(radioListContainer, 'change', (event) => { if (event.target.type === 'radio' && event.target.name === 'learningGoal') { const selectedGoal = event.target.value; radioListContainer.querySelectorAll('.goal-radio-label').forEach(label => { label.classList.remove('selected-goal'); }); event.target.closest('.goal-radio-label')?.classList.add('selected-goal'); handleInitialGoalSelection(selectedGoal); } }, 'goalRadioListContainer'); console.log("[SETUP Base v6.3] CHANGE listener attached to goal radio list container."); } else { console.warn("[SETUP Base v6.3] Goal radio list container (.goal-radio-list) not found for listener setup."); } const modalBackButtons = ui.goalSelectionModal ? ui.goalSelectionModal.querySelectorAll('.modal-back-btn') : []; safeAddListener(modalBackButtons, 'click', (event) => { const targetStepId = event.currentTarget.dataset.targetStep; const currentActiveStep = ui.goalSelectionModal?.querySelector('.modal-step.active'); const targetStepElement = document.getElementById(targetStepId); if(currentActiveStep) currentActiveStep.classList.remove('active'); if(targetStepElement) targetStepElement.classList.add('active'); pendingGoal = null; }, 'modalBackButtons'); const modalConfirmButtons = ui.goalSelectionModal ? ui.goalSelectionModal.querySelectorAll('.modal-confirm-btn') : []; safeAddListener(modalConfirmButtons, 'click', (event) => { const goal = event.currentTarget.dataset.goal; if (goal === pendingGoal) { handleStep2Confirm(goal); } else if (ui.goalStep1?.classList.contains('active') && goal) { handleInitialGoalSelection(goal); } }, 'modalConfirmButtons'); console.log("[SETUP Base v6.3] Nastavení základních listenerů dokončeno."); }
	function setupTabEventListeners() { console.log("[SETUP Tabs v6.3] Setting up tab listeners..."); const tabs = ui.contentTabs; if (tabs && tabs.length > 0) { tabs.forEach(tab => { if (tab._tabClickHandler) tab.removeEventListener('click', tab._tabClickHandler); const newHandler = (event) => handleTabSwitch(event); tab.addEventListener('click', newHandler); tab._tabClickHandler = newHandler; }); console.log(`[SETUP Tabs v6.3] Click listener attached to ${tabs.length} tab(s).`); } else { console.warn("[SETUP Tabs v6.3] No tab elements (.content-tab) found to attach listeners."); } }
	function handleOutsideNotificationClick(event) { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } }
	// --- END: Event Listeners Setup ---

	// --- START THE APP ---
	if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeApp); } else { initializeApp(); }
	// --- END THE APP ---

	window.VyukaApp = { showToast: showToast }; // Expose only if needed by other scripts

})(); // End of IIFE