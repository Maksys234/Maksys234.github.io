// Файл: procvicovani/plan-ui-components.js
// Описание: Управляет созданием, рендерингом и базовым взаимодействием
// с UI компонентами для страницы Studijního plánu.
// Предоставляет функции через PlanApp.
// Версия: 2.0 (Исправлено на основе plan.js и запроса пользователя)

(function() { // IIFE для изоляции области видимости
	'use strict';

	// --- Глобальное Пространство Имен ---
	window.PlanApp = window.PlanApp || {};
	const PlanApp = window.PlanApp; // Локальная ссылка

	// Проверка зависимостей (убедимся, что state и config уже есть из plan-data-logic.js)
	if (typeof PlanApp.state === 'undefined' || typeof PlanApp.config === 'undefined') {
		console.error("FATAL: Не удалось инициализировать plan-ui-components.js. Отсутствует PlanApp.state или PlanApp.config. Убедитесь, что plan-data-logic.js загружен первым.");
		// Optionally display a critical error message to the user
        // document.body.innerHTML = '<div style="color:red; padding:20px;">Kritická chyba: Chybí základní konfigurace (plan-data-logic.js).</div>';
		return;
	}

	// --- DOM Элементы (Кэш) ---
    // Кэширование элементов перенесено в PlanApp.initializeUI в plan-main.js,
    // чтобы гарантировать, что DOM загружен. Здесь остается ссылка на PlanApp.ui.

	// Визуалы для уведомлений и активностей (копируем для рендеринга)
    const activityVisuals = {
         test: { name: 'Test', icon: 'fa-vial', class: 'test' },
         exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' },
         practice: { name: 'Procvičování', icon: 'fa-dumbbell', class: 'practice' },
         example: { name: 'Příklad', icon: 'fa-lightbulb', class: 'example' },
         review: { name: 'Opakování', icon: 'fa-history', class: 'review' },
         theory: { name: 'Teorie', icon: 'fa-book-open', class: 'theory' },
         analysis: { name: 'Analýza', icon: 'fa-chart-pie', class: 'analysis' },
         badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' },
         diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' },
         lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' },
         plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' },
         level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' },
         other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' },
         default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
     };

	// --- Вспомогательные UI Функции ---
	PlanApp.showToast = (title, message, type = 'info', duration = 4500) => {
		const ui = PlanApp.ui;
		if (!ui?.toastContainer) { console.warn("[UI] Toast container not found."); return; }
		try {
			const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div');
			toastElement.className = `toast ${type}`; toastElement.id = toastId;
			toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive');
			toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${PlanApp.sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${PlanApp.sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`;
			const icon = toastElement.querySelector('.toast-icon');
			icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`;
			toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); });
			ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); });
			setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration);
		} catch (e) { console.error("[UI] Error displaying toast:", e); }
	};

	PlanApp.showGlobalError = (message) => { const ui = PlanApp.ui; if(ui?.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i><div>${PlanApp.sanitizeHTML(message)}</div></div>`; ui.globalError.style.display = 'block'; console.error("[UI] Global Error Displayed:", message); } else { console.error("[UI] Global error container not found. Error:", message); PlanApp.showToast("Kritická chyba", message, "error", 10000); } };
	PlanApp.hideGlobalError = () => { const ui = PlanApp.ui; if(ui?.globalError) ui.globalError.style.display = 'none'; };
	PlanApp.sanitizeHTML = (str) => { const t = document.createElement('div'); t.textContent = str || ''; return t.innerHTML; };
	PlanApp.getInitials = (profileData, email) => { const state = PlanApp.state; if (!profileData && !email) return '?'; const avatarUrl = profileData?.avatar_url; if (avatarUrl && !avatarUrl.startsWith('assets/')) { return `<img src="${PlanApp.sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="Avatar">`; } else if (avatarUrl) { return `<img src="${PlanApp.sanitizeHTML(avatarUrl)}" alt="Avatar">`; } else { let i = ''; if (profileData?.first_name) i += profileData.first_name[0]; if (profileData?.last_name) i += profileData.last_name[0]; if (i) return i.toUpperCase(); if (profileData?.username) return profileData.username[0].toUpperCase(); if (email) return email[0].toUpperCase(); return 'P'; } };
	PlanApp.formatDate = (dateString) => { if(!dateString) return '-'; try { const date = new Date(dateString); if (isNaN(date.getTime())) return 'Neplatné datum'; return date.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch(e){ return '-';}};
	PlanApp.formatRelativeTime = (timestamp) => { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return '-'; } };
	PlanApp.openMenu = () => { const ui = PlanApp.ui; if (ui?.sidebar && ui?.sidebarOverlay) { ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } };
	PlanApp.closeMenu = () => { const ui = PlanApp.ui; if (ui?.sidebar && ui?.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } };
	PlanApp.initTooltips = () => { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top', contentAsHTML: true }); } } catch (e) { console.error("[UI] Tooltipster init error:", e); } };
	PlanApp.updateCopyrightYear = () => { const ui = PlanApp.ui; const year = new Date().getFullYear(); if (ui?.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui?.currentYearFooter) ui.currentYearFooter.textContent = year; };
	PlanApp.initMouseFollower = () => { const ui = PlanApp.ui; const follower = ui?.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
	PlanApp.initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) { console.log("Scroll animations not initialized (no elements or IntersectionObserver not supported)."); return; } const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
	PlanApp.initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = PlanApp.ui?.mainContent; if (!mainEl) { console.warn("Main content element not found for scroll detection."); return; } mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) { document.body.classList.add('scrolled'); } };
	PlanApp.updateOnlineStatus = () => { if (!navigator.onLine) PlanApp.showToast('Offline', 'Spojení bylo ztraceno.', 'warning'); };
    PlanApp.updateTheme = () => { const state = PlanApp.state; console.log("[UI] Updating theme, isDarkMode:", state?.isDarkMode); document.documentElement.classList.toggle('dark', state?.isDarkMode); document.documentElement.classList.toggle('light', !state?.isDarkMode); };

    // --- Управление состоянием загрузки UI ---
    PlanApp.setLoadingState = (sectionKey, isLoadingFlag) => {
		const state = PlanApp.state; const ui = PlanApp.ui;
		if (!state || !ui) { console.error("SetLoadingState: State or UI not initialized."); return; }
        if (state.isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;
		if (sectionKey === 'all') { Object.keys(state.isLoading).forEach(key => state.isLoading[key] = isLoadingFlag); } else { state.isLoading[sectionKey] = isLoadingFlag; }
		console.log(`[UI Loading] ${sectionKey}: ${isLoadingFlag}`);

		const loaderMap = { current: ui.currentPlanLoader, history: ui.historyLoader, create: ui.createPlanLoader, detail: ui.planLoading, schedule: ui.currentPlanLoader, generation: ui.planLoading, notifications: null, saving: null };
		const contentMap = { current: ui.currentPlanContent, history: ui.historyPlanContent, create: ui.createPlanContent, detail: ui.planContent, schedule: ui.verticalScheduleList, generation: ui.planContent, notifications: ui.notificationsList };
		const navMap = { schedule: ui.verticalScheduleNav };
		const sectionMap = { current: ui.currentPlanSection, history: ui.historyPlanSection, create: ui.createPlanSection, detail: ui.planSection };
		const emptyMap = { notifications: ui.noNotificationsMsg };

		const sectionsToUpdate = sectionKey === 'all' ? Object.keys(loaderMap).filter(k => k !== 'saving') : [sectionKey];

		sectionsToUpdate.forEach(key => {
			const loader = loaderMap[key]; const content = contentMap[key]; const nav = navMap[key]; const section = sectionMap[key]; const emptyState = emptyMap[key];
			if (loader) { loader.classList.toggle('visible-loader', isLoadingFlag); if (key === 'generation') { const loaderText = loader.querySelector('p'); if (loaderText) { if (isLoadingFlag) { loader.classList.add('generating-animation'); loaderText.textContent = 'Generuji plán...'; } else { loader.classList.remove('generating-animation'); loaderText.textContent = 'Načítám / Generuji...'; } } } }
			if (section) section.classList.toggle('loading', isLoadingFlag);

			if (isLoadingFlag) {
				if (content) content.classList.remove('content-visible', 'schedule-visible', 'generated-reveal');
				if (nav) nav.classList.remove('nav-visible'); if (emptyState) emptyState.style.display = 'none';
				if (key === 'history' && ui.historyPlanContent) PlanApp.renderHistorySkeletons(3);
				if (key === 'schedule' && ui.verticalScheduleList) { PlanApp.renderScheduleSkeletons(ui.verticalScheduleList, 3); ui.verticalScheduleList.classList.add('schedule-visible'); }
				if (key === 'notifications' && ui.notificationsList) PlanApp.renderNotificationSkeletons(2);
				if ((key === 'generation' || key === 'detail') && ui.planActions) ui.planActions.style.display = 'none';
			} else {
                // After loading, visibility is handled by render functions, remove loading artifacts
				if (key === 'history' && ui.historyPlanContent && !ui.historyPlanContent.querySelector('.history-item') && !ui.historyPlanContent.querySelector('.notest-message')) ui.historyPlanContent.innerHTML = '';
				if (key === 'schedule' && ui.verticalScheduleList && !ui.verticalScheduleList.querySelector('.day-schedule-card')) ui.verticalScheduleList.innerHTML = '';
				if (key === 'detail' && ui.planActions && !state.isLoading.generation) ui.planActions.style.display = 'flex';
			}
			if (key === 'notifications' && ui.notificationBell) { ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1; if (ui.markAllReadBtn) { const count = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = isLoadingFlag || count === 0; } }
		});
	};

    // --- Рендеринг UI Компонентов ---
    PlanApp.renderMessage = (container, type = 'info', title, message, addButtons = []) => {
        if (!container) { console.error("[UI RenderMessage] Container not found!"); return; }
		console.log(`[UI RenderMessage] Rendering into: #${container.id}, Type: ${type}, Title: ${title}`);
		const iconMap = { info: 'fa-info-circle', warning: 'fa-exclamation-triangle', error: 'fa-exclamation-circle' };
		let buttonsHTML = '';
		addButtons.forEach(btn => { buttonsHTML += `<button class="btn ${btn.class || 'btn-primary'}" id="${btn.id}" ${btn.disabled ? 'disabled' : ''}>${btn.icon ? `<i class="fas ${btn.icon}"></i> ` : ''}${PlanApp.sanitizeHTML(btn.text)}</button>`; });
		container.innerHTML = `<div class="notest-message ${type}"><h3><i class="fas ${iconMap[type]}"></i> ${PlanApp.sanitizeHTML(title)}</h3><p>${PlanApp.sanitizeHTML(message)}</p><div class="action-buttons">${buttonsHTML}</div></div>`;
		container.classList.add('content-visible');
		// Прикрепляем обработчики ПОСЛЕ добавления в DOM
		addButtons.forEach(btn => { const btnElement = container.querySelector(`#${btn.id}`); if (btnElement && btn.onClick) btnElement.addEventListener('click', btn.onClick); });
	};

	PlanApp.updateUserInfoUI = () => {
		const state = PlanApp.state; const ui = PlanApp.ui;
		if (ui?.userName && ui?.userAvatar) {
			if (state?.currentUser && state?.currentProfile) {
				const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot';
				ui.userName.textContent = PlanApp.sanitizeHTML(displayName);
				ui.userAvatar.innerHTML = PlanApp.getInitials(state.currentProfile, state.currentUser.email);
			} else { ui.userName.textContent = 'Nepřihlášen'; ui.userAvatar.textContent = '?'; }
		} else { console.warn("[UI] Sidebar user info elements not found."); }
	};

	// Function to render the vertical schedule (UI logic)
	PlanApp.renderVerticalSchedule = (activities, planId) => {
		 const ui = PlanApp.ui;
         if (!ui) { console.error("[RenderVertical] UI cache not initialized!"); return; }
		 const days = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
		 const todayIndex = new Date().getDay();
		 const listContainer = ui.verticalScheduleList;
		 if (!listContainer) { console.error("[UI RenderVertical] Container #vertical-schedule-list not found!"); return; }

		 listContainer.innerHTML = ''; // Clear previous content/skeletons
		 if (!Array.isArray(activities)) activities = [];

		 const activitiesByDay = {};
		 for (let i = 0; i <= 6; i++) { activitiesByDay[i] = []; }
		 activities.forEach(act => {
            if (act && typeof act.day_of_week === 'number' && act.day_of_week >= 0 && act.day_of_week <= 6) {
                activitiesByDay[act.day_of_week].push(act);
            } else {
                console.warn("[RenderVertical] Invalid activity data or day_of_week:", act);
            }
         });
		 console.log("[UI RenderVertical] Grouped activities:", activitiesByDay);

		 const daysOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon -> Sun
		 let hasAnyActivity = false;

		 daysOrder.forEach(dayIndex => {
			 const dayActivities = activitiesByDay[dayIndex].sort((a, b) => (a?.time_slot || '99:99').localeCompare(b?.time_slot || '99:99'));
			 const dayName = days[dayIndex];
			 const isToday = dayIndex === todayIndex;
			 const dayCard = document.createElement('div');
			 dayCard.className = `day-schedule-card ${isToday ? 'today' : ''} expanded`; // Start expanded
			 dayCard.setAttribute('data-animate', '');
			 dayCard.style.setProperty('--animation-order', daysOrder.indexOf(dayIndex));

			 const dayHeader = document.createElement('div');
			 dayHeader.className = 'day-header';
			 dayHeader.innerHTML = `${PlanApp.sanitizeHTML(dayName)} ${isToday ? '<span>(Dnes)</span>' : ''}<i class="fas fa-chevron-down day-expand-icon"></i>`;
			 dayCard.appendChild(dayHeader);

			 const activitiesContainer = document.createElement('div');
			 activitiesContainer.className = 'activity-list-container';

			 if (dayActivities.length > 0) {
				 hasAnyActivity = true;
				 dayActivities.forEach(activity => {
					 if (!activity || !activity.id) return; // Skip invalid activities
					 const activityElement = document.createElement('div');
					 activityElement.className = `activity-list-item ${activity.completed ? 'completed' : ''}`;
					 activityElement.dataset.activityId = activity.id;
					 const timeDisplay = activity.time_slot ? `<span class="activity-time-display">${PlanApp.sanitizeHTML(activity.time_slot)}</span>` : '';
					 // Use PlanApp helper for icon logic
					 const iconClass = typeof PlanApp.getActivityIcon === 'function' ? PlanApp.getActivityIcon(activity.title, activity.type) : 'fa-question-circle';
					 const hasDescription = activity.description && activity.description.trim().length > 0;
					 const expandIcon = hasDescription ? `<button class="expand-icon-button btn-tooltip" aria-label="Rozbalit popis" title="Zobrazit/skrýt popis"><i class="fas fa-chevron-down expand-icon"></i></button>` : '';
					 activityElement.innerHTML = `
						<label class="activity-checkbox">
							<input type="checkbox" id="vertical-activity-${activity.id}" ${activity.completed ? 'checked' : ''} data-activity-id="${activity.id}" data-plan-id="${planId}">
						</label>
						<i class="fas ${iconClass} activity-icon"></i>
						<div class="activity-details">
							<div class="activity-header">
								<div class="activity-title-time">
									<span class="activity-title">${PlanApp.sanitizeHTML(activity.title || 'Aktivita')}</span>
									${timeDisplay}
								</div>
								${expandIcon}
							</div>
							${hasDescription ? `<div class="activity-desc">${PlanApp.sanitizeHTML(activity.description)}</div>` : ''}
						</div>`;
					 activitiesContainer.appendChild(activityElement);
				 });
			 } else {
				 activitiesContainer.innerHTML = `<div class="no-activities-day">Žádné aktivity pro tento den.</div>`;
			 }
			 dayCard.appendChild(activitiesContainer);
			 listContainer.appendChild(dayCard);
		 });

		 if (!hasAnyActivity) {
			 console.log("[UI RenderVertical] No activities found in the entire plan.");
			 listContainer.innerHTML = '<div class="no-activities-day" style="padding: 2rem; border: none;">Pro tento plán nebyly nalezeny žádné aktivity.</div>';
		 }

		 console.log("[UI RenderVertical] Vertical schedule rendering complete.");
		 // Initialize animations after rendering
		  if (typeof PlanApp.initScrollAnimations === 'function') PlanApp.initScrollAnimations();
         // Initialize tooltips
         if (typeof PlanApp.initTooltips === 'function') PlanApp.initTooltips();
	 };

	// UI function to show schedule (calls render function)
	PlanApp.showVerticalSchedule = async (plan) => {
		const ui = PlanApp.ui;
        const state = PlanApp.state;
        if (!state || !ui) { console.error("[ShowVertical] State or UI not initialized."); return; }

		if (!plan || !plan.id) {
			console.error("[UI ShowVertical] Invalid plan data.");
			if(ui.currentPlanContent) {
				 PlanApp.renderMessage(ui.currentPlanContent, 'error', 'Chyba plánu', 'Nelze zobrazit detaily plánu.');
				 ui.currentPlanContent.classList.add('content-visible');
			}
			if(ui.verticalScheduleList) ui.verticalScheduleList.classList.remove('schedule-visible');
			if(ui.verticalScheduleNav) ui.verticalScheduleNav.classList.remove('nav-visible');
			 if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('schedule', false);
			return;
		}
		console.log(`[UI ShowVertical] Displaying schedule for Plan ID ${plan.id}`);
		if (ui.currentPlanContent) ui.currentPlanContent.classList.remove('content-visible'); // Hide message area

        // Use already fetched activities from state if available
        let activities = state.currentPlanActivities || [];
        if (!state.currentPlanActivities || state.currentPlanActivities.length === 0) {
            console.warn("[ShowVertical] No activities in state, attempting to fetch...");
            if (typeof PlanApp.fetchPlanActivities === 'function') {
                activities = await PlanApp.fetchPlanActivities(plan.id);
            } else {
                console.error("Error: fetchPlanActivities function is missing!");
                activities = [];
            }
        }

        PlanApp.renderVerticalSchedule(activities || [], plan.id); // Render the fetched data

        // Make the schedule visible AFTER rendering
        if (ui.verticalScheduleList) ui.verticalScheduleList.classList.add('schedule-visible');
        if (ui.verticalScheduleNav) ui.verticalScheduleNav.classList.add('nav-visible');

        if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('schedule', false); // Stop schedule loading state
	 };

	// --- Рендеринг остальных UI компонентов ---
	PlanApp.renderPlanHistory = (plans) => {
		const ui = PlanApp.ui;
        if (!ui) { console.error("[RenderHistory] UI cache not initialized!"); return; }
		if (!ui.historyPlanContent || !ui.historyItemTemplate) {
			 console.error("[UI RenderHistory] Missing history container or template.");
			 return;
		}
		if (!plans || plans.length === 0) {
			PlanApp.renderMessage(ui.historyPlanContent, 'info', 'Žádná historie', 'Zatím jste nevytvořili žádné studijní plány.');
			return;
		}
		ui.historyPlanContent.innerHTML = ''; // Clear skeletons/previous content
		ui.historyPlanContent.style.display = 'grid'; // Ensure grid layout
		plans.forEach((plan, index) => {
			const node = ui.historyItemTemplate.content.cloneNode(true);
			const item = node.querySelector('.history-item');
			if(item) {
				item.dataset.planId = plan.id;
				item.classList.add(plan.status || 'inactive');
				item.setAttribute('data-animate', '');
				item.style.setProperty('--animation-order', index);

				const dateEl = item.querySelector('.history-date');
				const titleEl = item.querySelector('.history-title');
				const progressEl = item.querySelector('.history-progress');
				const statusEl = item.querySelector('.history-status');
				if(dateEl) dateEl.textContent = `Vytvořeno: ${PlanApp.formatDate(plan.created_at)}`;
				if(titleEl) titleEl.textContent = PlanApp.sanitizeHTML(plan.title || "Studijní plán");
				if(progressEl) progressEl.innerHTML = `Pokrok: <strong>${plan.progress ?? 0}%</strong>`;
				if(statusEl) {
					const statusText = plan.status === 'active' ? 'Aktivní' : plan.status === 'completed' ? 'Dokončený' : 'Neaktivní';
					statusEl.textContent = statusText;
					statusEl.className = `history-status ${plan.status || 'inactive'}`;
				}
				// Attach click listener to call showPlanDetail
				 item.addEventListener('click', () => {
					 if (typeof PlanApp.showPlanDetail === 'function') {
						 PlanApp.showPlanDetail(plan);
					 } else { console.error("PlanApp.showPlanDetail function not found!"); }
				 });
				ui.historyPlanContent.appendChild(node);
			}
		});
		ui.historyPlanContent.classList.add('content-visible'); // Show the grid
		 if (typeof PlanApp.initScrollAnimations === 'function') PlanApp.initScrollAnimations();
	};

    PlanApp.getActivityIcon = (title = '', type = '') => {
        const lowerType = type?.toLowerCase() || ''; // Prefer type if available
        const lowerTitle = title.toLowerCase();
        if (activityVisuals[lowerType]) return activityVisuals[lowerType].icon;
        // Fallback to title keywords if type is missing or unknown
        if (lowerTitle.includes('test')) return activityVisuals.test.icon;
        if (lowerTitle.includes('cvičení') || lowerTitle.includes('procvič')) return activityVisuals.exercise.icon;
        if (lowerTitle.includes('příklad')) return activityVisuals.example.icon;
        if (lowerTitle.includes('opakování') || lowerTitle.includes('shrnutí')) return activityVisuals.review.icon;
        if (lowerTitle.includes('lekce') || lowerTitle.includes('teorie')) return activityVisuals.theory.icon;
        if (lowerTitle.includes('analýza')) return activityVisuals.analysis.icon;
        return activityVisuals.default.icon; // Default icon
    };

	PlanApp.renderHistorySkeletons = (count) => {
        const ui = PlanApp.ui;
		if (!ui?.historyPlanContent) return;
		ui.historyPlanContent.innerHTML = '';
		if (count === 0) {
			ui.historyPlanContent.classList.remove('content-visible');
			ui.historyPlanContent.style.display = 'none';
			return;
		}
		ui.historyPlanContent.style.display = 'grid';
		ui.historyPlanContent.classList.add('content-visible');
		let skeletonHTML = '';
		for (let i = 0; i < count; i++) {
			skeletonHTML += `<div class="skeleton history-item-skeleton">
								<div class="skeleton text-sm" style="width: 40%;"></div>
								<div class="skeleton title-sm" style="width: 80%; height: 16px;"></div>
								<div class="skeleton text-sm" style="width: 50%;"></div>
							</div>`;
		}
		ui.historyPlanContent.innerHTML = skeletonHTML;
    };

    PlanApp.renderScheduleSkeletons = (container, dayCount) => {
         if (!container) return;
         container.innerHTML = ''; // Clear existing
         let skeletonHTML = '';
         for (let i = 0; i < dayCount; i++) {
             skeletonHTML += `
                 <div class="skeleton day-card-skeleton">
                     <div class="skeleton day-header-skeleton"></div>
                     <div class="skeleton activity-item-skeleton">
                         <div class="skeleton activity-checkbox-skeleton"></div>
                         <div class="skeleton activity-content-skeleton">
                             <div class="skeleton activity-title-skeleton"></div>
                             <div class="skeleton activity-meta-skeleton"></div>
                         </div>
                     </div>
                     <div class="skeleton activity-item-skeleton">
                         <div class="skeleton activity-checkbox-skeleton"></div>
                         <div class="skeleton activity-content-skeleton">
                             <div class="skeleton activity-title-skeleton" style="width: 60%;"></div>
                         </div>
                     </div>
                 </div>`;
         }
         container.innerHTML = skeletonHTML;
     };

	PlanApp.renderLockedPlanSection = (container) => {
		 const ui = PlanApp.ui;
		 const state = PlanApp.state;
         if (!state || !ui) { console.error("[RenderLocked] State or UI not initialized."); return; }
		 if(!container || !ui.lockedPlanTemplate) {
			 console.error("[UI RenderLocked] Missing container or template.");
			 return;
		 }
		 console.log("[UI Render] Rendering Locked Plan Section...");
		 const node = ui.lockedPlanTemplate.content.cloneNode(true);
		 const timerEl = node.getElementById('nextPlanTimer');
		 const viewBtn = node.getElementById('viewCurrentPlanBtnLocked');
		 if(timerEl && typeof PlanApp.updateNextPlanTimer === 'function') {
			 PlanApp.updateNextPlanTimer(timerEl); // Initial update
		 } else if (!timerEl) { console.warn("Timer element #nextPlanTimer not found in locked template."); }
		 if(viewBtn && typeof PlanApp.switchTab === 'function') {
			 viewBtn.addEventListener('click', () => PlanApp.switchTab('current'));
		 } else if (!viewBtn) { console.warn("View button #viewCurrentPlanBtnLocked not found in locked template."); }
		 container.innerHTML = ''; // Clear previous content
		 container.appendChild(node);
		 container.classList.add('content-visible'); // Make visible
		 if (typeof PlanApp.startPlanTimer === 'function') PlanApp.startPlanTimer(); // Start the countdown timer
		 console.log("[UI Render] Locked Plan Section Rendered.");
	 };

	PlanApp.renderPlanCreationForm = (container) => {
		 const ui = PlanApp.ui;
		 const state = PlanApp.state;
         if (!state || !ui) { console.error("[RenderForm] State or UI not initialized."); return; }
		 if (!container || !ui.createPlanFormTemplate || !state.latestDiagnosticData) {
			 console.error("[UI RenderForm] Missing container, template, or diagnostic data.");
			 PlanApp.renderMessage(container, 'error', 'Chyba', 'Nelze zobrazit formulář pro vytvoření plánu.');
			 return;
		 }
		 console.log("[UI RenderForm] Rendering Plan Creation Form...");
		 const node = ui.createPlanFormTemplate.content.cloneNode(true);
		 const diagInfo = node.getElementById('diagnosticInfo');
		 if (diagInfo) {
			 const score = state.latestDiagnosticData.total_score ?? '-';
			 const totalQ = state.latestDiagnosticData.total_questions ?? '-';
			 const date = typeof PlanApp.formatDate === 'function' ? PlanApp.formatDate(state.latestDiagnosticData.completed_at) : '-';
			 diagInfo.innerHTML = `<p>Plán bude vycházet z testu ze dne: <strong>${date}</strong> (Skóre: ${score}/${totalQ})</p>`;
		 } else { console.warn("[UI RenderForm] Diagnostic info element not found in template."); }

		 container.innerHTML = ''; // Clear previous content
		 container.appendChild(node);
		 container.classList.add('content-visible'); // Show the form container

		 // Find the button *after* appending the template content to the DOM
		 const actualGenBtn = container.querySelector('#generatePlanBtn');
		 if (actualGenBtn && typeof PlanApp.handleGenerateClick === 'function') {
			 actualGenBtn.addEventListener('click', PlanApp.handleGenerateClick);
			 console.log("[UI RenderForm] Event listener added to #generatePlanBtn.");
		 } else if (!actualGenBtn) {
			 console.error("[UI RenderForm] Failed to find #generatePlanBtn in the DOM after appending!");
		 } else {
			  console.error("[UI RenderForm] PlanApp.handleGenerateClick function not found!");
		 }
		 console.log("[UI RenderForm] Plan Creation Form Rendered.");
	 };

	PlanApp.renderNoDiagnosticAvailable = (container) => {
		const ui = PlanApp.ui;
         if (!ui) { console.error("[RenderNoDiag] UI cache not initialized!"); return; }
		if (!container || !ui.noDiagnosticTemplate) {
			console.error("[UI RenderNoDiag] Missing container or template.");
			return;
		}
		console.log("[UI Render] Rendering No Diagnostic Available...");
		const node = ui.noDiagnosticTemplate.content.cloneNode(true);
		const btn = node.getElementById('goToTestBtn');
		if(btn) btn.onclick = () => window.location.href = '/dashboard/procvicovani/test1.html';
		container.innerHTML = ''; // Clear previous
		container.appendChild(node);
		container.classList.add('content-visible');
		console.log("[UI Render] No Diagnostic Available Rendered.");
	};

	PlanApp.renderPromptCreatePlan = (container) => {
		 const ui = PlanApp.ui;
         if (!ui) { console.error("[RenderPrompt] UI cache not initialized!"); return; }
		 if (!container || !ui.promptCreatePlanTemplate) {
			  console.error("[UI RenderPrompt] Missing container or template.");
			 return;
		 }
		 console.log("[UI Render] Rendering Prompt Create Plan...");
		 // Ensure other content in the section is hidden
		 ui.verticalScheduleList?.classList.remove('schedule-visible');
		 ui.verticalScheduleNav?.classList.remove('nav-visible');

		 const node = ui.promptCreatePlanTemplate.content.cloneNode(true);
		 const btn = node.getElementById('createNewPlanFromPromptBtn');
		 if (btn && typeof PlanApp.switchTab === 'function') {
			 btn.addEventListener('click', () => PlanApp.switchTab('create'));
		 } else if (!btn) { console.warn("Button #createNewPlanFromPromptBtn not found in template."); }
		 container.innerHTML = ''; // Clear previous messages
		 container.appendChild(node);
		 container.classList.add('content-visible'); // Show the message container
		 console.log("[UI Render] Prompt Create Plan Rendered.");
	 };

	 PlanApp.renderNoActivePlan = (container) => {
		 const ui = PlanApp.ui;
          if (!ui) { console.error("[RenderNoActive] UI cache not initialized!"); return; }
		 if (!container || !ui.noActivePlanTemplate) {
			  console.error("[UI RenderNoActive] Missing container or template.");
			 return;
		 }
		 console.log("[UI Render] Rendering No Active Plan...");
		 // Ensure other content in the section is hidden
		 ui.verticalScheduleList?.classList.remove('schedule-visible');
		 ui.verticalScheduleNav?.classList.remove('nav-visible');

		 const node = ui.noActivePlanTemplate.content.cloneNode(true);
		 const link = node.querySelector('.link-to-create-tab');
		 if (link && typeof PlanApp.switchTab === 'function') {
			 link.addEventListener('click', (e) => { e.preventDefault(); PlanApp.switchTab('create'); });
		 } else if (!link) { console.warn("Link .link-to-create-tab not found in template."); }
		 container.innerHTML = ''; // Clear previous messages
		 container.appendChild(node);
		 container.classList.add('content-visible'); // Show the message container
		 console.log("[UI Render] No Active Plan Rendered.");
	 };

	 // Renders the generated plan Markdown content
	 PlanApp.displayPlanContent = (markdownContent) => {
		const ui = PlanApp.ui;
        if (!ui) { console.error("[DisplayPlan] UI cache not initialized!"); return; }
		if (!ui.planContent) {
			console.error("[UI DisplayPlan] Plan content container not found!");
			return;
		}
		try {
			// Ensure Marked library is loaded
			if (typeof marked === 'undefined') {
				throw new Error("Marked library not loaded.");
			}
			marked.setOptions({ gfm: true, breaks: true, sanitize: false }); // Use recommended settings
			const htmlContent = marked.parse(markdownContent || '');
			ui.planContent.innerHTML = htmlContent;
			// Visibility and animations are handled by the calling function (showPlanDetail or generateStudyPlan)

			// Trigger MathJax rendering if available
			if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
				setTimeout(() => {
					window.MathJax.typesetPromise([ui.planContent])
						.then(() => console.log("[MathJax] Typesetting complete for plan content."))
						.catch(e => console.error("[MathJax] Error typesetting plan content:", e));
				}, 0); // Use timeout 0 to allow DOM update
			} else {
				console.warn("[MathJax] MathJax not ready for rendering plan content.");
			}
		} catch (e) {
			console.error("[UI DisplayPlan] Markdown rendering error:", e);
			// Display error within the content area
			 PlanApp.renderMessage(ui.planContent, 'error', 'Chyba zobrazení plánu', e.message);
			 ui.planContent.classList.add('content-visible'); // Make sure error is visible
		}
	};

	 // Renders action buttons after plan generation/preview
	 PlanApp.renderPreviewActions = (isError = false, isDevMessage = false) => {
         const ui = PlanApp.ui;
          if (!ui) { console.error("[RenderPreviewActions] UI cache not initialized!"); return; }
         if (!ui.planActions) return;
         let buttonsHTML = '';
         if (isError) {
             buttonsHTML = `<button class="btn btn-secondary" id="regeneratePlanBtn"><i class="fas fa-sync-alt"></i> Vygenerovat znovu</button>`;
         } else if (isDevMessage) {
             buttonsHTML = ''; // No actions needed for "in development" message
         } else {
             buttonsHTML = `
                 <button class="btn btn-primary" id="saveGeneratedPlanBtn">
                     <i class="fas fa-save"></i> Uložit tento plán
                 </button>
                 <button class="btn btn-success btn-tooltip" id="exportGeneratedPlanBtn" title="Stáhnout návrh jako PDF">
                     <i class="fas fa-file-pdf"></i> Export PDF
                 </button>
                 <button class="btn btn-secondary" id="regeneratePlanBtn">
                     <i class="fas fa-sync-alt"></i> Vygenerovat znovu
                 </button>`;
         }
         ui.planActions.innerHTML = buttonsHTML;

         const saveBtn = ui.planActions.querySelector('#saveGeneratedPlanBtn');
         const exportBtn = ui.planActions.querySelector('#exportGeneratedPlanBtn');
         const regenBtn = ui.planActions.querySelector('#regeneratePlanBtn');

         if (saveBtn && typeof PlanApp.handleSaveGeneratedPlanClick === 'function') {
             saveBtn.addEventListener('click', PlanApp.handleSaveGeneratedPlanClick);
         } else if (saveBtn) { console.error("Core function handleSaveGeneratedPlanClick missing!"); }

         if (exportBtn && typeof PlanApp.exportPlanToPDFWithStyle === 'function') {
              const tempPlanData = { created_at: new Date(), plan_content_markdown: PlanApp.state?.lastGeneratedMarkdown || '', title: "Nový návrh plánu" };
              exportBtn.addEventListener('click', () => PlanApp.exportPlanToPDFWithStyle(tempPlanData));
         } else if (exportBtn) { console.error("UI function exportPlanToPDFWithStyle missing!"); }

         if (regenBtn && typeof PlanApp.handleGenerateClick === 'function') {
             regenBtn.addEventListener('click', PlanApp.handleGenerateClick); // Reuse the same handler
         } else if (regenBtn) { console.error("UI function handleGenerateClick missing for regenerate button!"); }

         ui.planActions.style.display = buttonsHTML.trim() ? 'flex' : 'none';
         if (typeof PlanApp.initTooltips === 'function') PlanApp.initTooltips();
     };

	 // UI function to display plan detail (fetches data if needed)
	 PlanApp.showPlanDetail = async (plan) => {
		const ui = PlanApp.ui;
		const state = PlanApp.state;
        if (!state || !ui) { console.error("[ShowPlanDetail] State or UI not initialized."); return; }
		if (!plan || !plan.id) {
			 console.error("[UI ShowDetail] Invalid plan data.");
			 return;
		}

		// Switch to the detail view
		ui.currentPlanSection?.classList.remove('visible-section');
		ui.historyPlanSection?.classList.remove('visible-section');
		ui.createPlanSection?.classList.remove('visible-section');
		ui.planSection?.classList.add('visible-section'); // Show the detail section

		PlanApp.setLoadingState('detail', true); // Start loading state for detail view
		if(ui.planContent) ui.planContent.classList.remove('content-visible', 'generated-reveal'); // Hide content areas
		if(ui.planActions) ui.planActions.innerHTML = ''; // Clear previous actions
		if(ui.planSectionTitle) ui.planSectionTitle.textContent = 'Načítání detailu...';

		// Set back button action for this context (going back to history)
		if (ui.genericBackBtn) {
			 ui.genericBackBtn.onclick = () => {
				 state.lastGeneratedMarkdown = null; // Ensure preview state is cleared
				 state.lastGeneratedActivitiesJson = null;
				 state.lastGeneratedTopicsData = null;
				 PlanApp.switchTab('history');
			 };
		}

		try {
			let fullPlanData = { ...plan }; // Start with existing data
			// Fetch full markdown if not present (uses Core logic now)
			if (!plan.plan_content_markdown) {
				console.log("[UI ShowDetail] Fetching full markdown via PlanApp.fetchPlanDetails...");
                 if (typeof PlanApp.fetchPlanDetails !== 'function') { throw new Error("Core function fetchPlanDetails is missing!"); }
                 const fetchedData = await PlanApp.fetchPlanDetails(plan.id);
                 if (!fetchedData) throw new Error("Nepodařilo se načíst data plánu.");
                 fullPlanData = { ...plan, ...fetchedData }; // Merge fetched data
			}

			// Update UI with Fetched Data
			if(ui.planSectionTitle) ui.planSectionTitle.textContent = fullPlanData.title || 'Detail studijního plánu';
			const metaDateEl = document.getElementById('plan-meta-date');
			if (metaDateEl) metaDateEl.textContent = `Vytvořeno: ${PlanApp.formatDate(fullPlanData.created_at)}`;

			PlanApp.displayPlanContent(fullPlanData.plan_content_markdown || '# Studijní plán\n\nObsah plánu není k dispozici.');
			if (ui.planContent) {
				 ui.planContent.classList.remove('generated-reveal'); // Ensure no reveal animation
				 ui.planContent.classList.add('content-visible'); // Show content
			 }

			// Add Export button for DETAIL view
			if(ui.planActions && typeof PlanApp.exportPlanToPDFWithStyle === 'function') {
				ui.planActions.innerHTML = `<button class="btn btn-success btn-tooltip" id="exportDetailPlanBtn" title="Stáhnout plán jako PDF"><i class="fas fa-file-pdf"></i> Export PDF</button>`;
				const exportButton = ui.planActions.querySelector('#exportDetailPlanBtn');
				if(exportButton) exportButton.addEventListener('click', () => PlanApp.exportPlanToPDFWithStyle(fullPlanData));
				ui.planActions.style.display = 'flex'; // Show actions for detail view
			} else if (ui.planActions) {
				 console.error("Function exportPlanToPDFWithStyle not found!");
				 ui.planActions.innerHTML = '';
				 ui.planActions.style.display = 'none';
			}

			if (ui.planSection) ui.planSection.scrollIntoView({ behavior: 'smooth' });
			PlanApp.initTooltips(); // Init tooltips for the new export button

		} catch (error) {
			console.error("[UI ShowDetail] Error loading plan detail:", error);
			if(ui.planContent) {
				 PlanApp.renderMessage(ui.planContent, 'error', 'Chyba', 'Nepodařilo se načíst detail plánu.');
				 ui.planContent.classList.add('content-visible');
			 }
			if(ui.planActions) ui.planActions.innerHTML = '';
		} finally {
			PlanApp.setLoadingState('detail', false); // Stop loading state
		}
	};

    // --- Уведомления (UI Рендеринг) ---
	PlanApp.renderNotifications = (count, notifications) => {
        const ui = PlanApp.ui;
        if (!ui) { console.error("[RenderNotifications] UI cache not initialized!"); return; }
        console.log("[UI RenderNotifications] Start, Count:", count, "Notifications:", notifications);
        if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
            console.error("[UI RenderNotifications] Missing UI elements.");
            return;
        }
        ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
        ui.notificationCount.classList.toggle('visible', count > 0);

        if (notifications && notifications.length > 0) {
            ui.notificationsList.innerHTML = notifications.map(n => {
                 const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default;
                 const isReadClass = n.is_read ? 'is-read' : '';
                 const linkAttr = n.link ? `data-link="${PlanApp.sanitizeHTML(n.link)}"` : '';
                 return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
							 ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
							 <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div>
							 <div class="notification-content">
								 <div class="notification-title">${PlanApp.sanitizeHTML(n.title)}</div>
								 <div class="notification-message">${PlanApp.sanitizeHTML(n.message)}</div>
								 <div class="notification-time">${PlanApp.formatRelativeTime(n.created_at)}</div>
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
        ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.toggle('has-content', notifications && notifications.length > 0);
        console.log("[UI RenderNotifications] Finished rendering.");
    };

	PlanApp.renderNotificationSkeletons = (count = 2) => {
        const ui = PlanApp.ui;
        if (!ui) { console.error("[RenderNotificationSkeletons] UI cache not initialized!"); return; }
        if (!ui.notificationsList || !ui.noNotificationsMsg) return;
        let skeletonHTML = '';
        for (let i = 0; i < count; i++) {
            skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height:16px;width:70%;margin-bottom:6px;"></div><div class="skeleton" style="height:12px;width:90%;"></div><div class="skeleton" style="height:10px;width:40%;margin-top:6px;"></div></div></div>`;
        }
        ui.notificationsList.innerHTML = skeletonHTML;
        ui.noNotificationsMsg.style.display = 'none';
        ui.notificationsList.style.display = 'block';
    };

    // --- Экспорт PDF (UI обертка) ---
	 PlanApp.exportPlanToPDFWithStyle = async (plan) => {
		 const state = PlanApp.state;
         const ui = PlanApp.ui;
         if (!state || !ui) { console.error("[ExportPDF] State or UI not initialized."); return; }

		 if (!plan) {
			 PlanApp.showToast('Nelze exportovat, chybí data plánu.', 'error');
			 return;
		 }

		 let planToExport = { ...plan };
		 if (!planToExport.plan_content_markdown && planToExport.id && state.supabaseClient) {
			 PlanApp.showToast('Načítám data pro PDF...', 'info', 2000);
			 try {
                 // Use Core function to fetch details
                 if (typeof PlanApp.fetchPlanDetails !== 'function') {
                     throw new Error("Core function fetchPlanDetails is missing!");
                 }
                 const fetchedData = await PlanApp.fetchPlanDetails(planToExport.id);
				 if (!fetchedData) throw new Error("Nepodařilo se načíst data plánu.");
				 planToExport = { ...planToExport, ...fetchedData };
			 } catch (fetchError) {
				 console.error("Nepodařilo se načíst markdown pro export:", fetchError);
				 PlanApp.showToast('Chyba: Nepodařilo se načíst data pro export.', 'error');
				 return;
			 }
		 } else if (!planToExport.plan_content_markdown) {
			 PlanApp.showToast('Chyba: Chybí obsah plánu pro export.', 'error');
			 return;
		 }

		 const exportContainer = document.createElement('div');
		 exportContainer.id = 'pdf-export-content';
		 const pdfStyles = `/* ... стили PDF остаются без изменений ... */`;
		 exportContainer.innerHTML = pdfStyles;

		 // Add Header
		 const pdfTitle = planToExport.title ? planToExport.title.replace(/\s*\(\d{2}\.\d{2}\.\d{4}\)$/, '').trim() : 'Studijní plán';
		 exportContainer.innerHTML += `
			 <div class="pdf-header">
				 <h1>${PlanApp.sanitizeHTML(pdfTitle)}</h1>
				 <p>Vytvořeno: ${PlanApp.formatDate(planToExport.created_at)}</p>
			 </div>`;

		 // Add Student Info
		 const studentName = ui.userName?.textContent || "Neznámý student";
		 exportContainer.innerHTML += `
			 <div class="student-info">
				 <h2>Informace o studentovi</h2>
				 <p><strong>Student:</strong> ${PlanApp.sanitizeHTML(studentName)}</p>
				 <p><strong>Datum vytvoření plánu:</strong> ${PlanApp.formatDate(planToExport.created_at)}</p>
				 ${planToExport.estimated_completion_date ? `<p><strong>Předpokládané dokončení:</strong> ${PlanApp.formatDate(planToExport.estimated_completion_date)}</p>` : ''}
			 </div>`;

		 // Add Plan Content
		 const contentDiv = document.createElement('div');
		 contentDiv.className = 'pdf-content';
		 try {
			 if (typeof marked === 'undefined') throw new Error("Marked library not loaded.");
			 const rawHtml = marked.parse(planToExport.plan_content_markdown || '');
			 contentDiv.innerHTML = rawHtml;
			 const daysCzech = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
			 contentDiv.querySelectorAll('h3').forEach(h3 => { if (daysCzech.some(day => h3.textContent.trim().startsWith(day))) { h3.classList.add('pdf-day-block'); } });
		 } catch (e) { contentDiv.innerHTML = '<p>Chyba při zpracování obsahu plánu.</p>'; }
		 exportContainer.appendChild(contentDiv);

		 // Add Footer
		 exportContainer.innerHTML += `<div class="pdf-footer">&copy; ${new Date().getFullYear()} Justax.space</div>`;

		 // Configure and run html2pdf
		 const options = { margin: [18, 13, 18, 13], filename: `studijni-plan-${PlanApp.formatDate(planToExport.created_at).replace(/\./g, '-')}.pdf`, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'avoid-all'] } };

		 if (typeof html2pdf === 'function') {
			  PlanApp.showToast('Generuji PDF...', 'info', 5000);
			 html2pdf().set(options).from(exportContainer).save()
				 .then(() => { PlanApp.showToast('PDF bylo úspěšně vygenerováno!', 'success'); })
				 .catch(err => { console.error("Chyba exportu PDF:", err); PlanApp.showToast('Nepodařilo se exportovat PDF.', 'error'); });
		 } else {
			 PlanApp.showToast('Chyba: Knihovna pro export PDF není načtena.', 'error');
		 }
	 };

	console.log("plan-ui-components.js initialized and functions attached to PlanApp.");

})(); // Конец IIFE