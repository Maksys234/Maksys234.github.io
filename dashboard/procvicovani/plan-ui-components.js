// Файл: procvicovani/plan-ui-components.js
// Описание: Управляет созданием, рендерингом и базовым взаимодействием
// с UI компонентами для страницы Studijního plánu.
// Предоставляет функции через PlanApp.
// Версия: 1.0 (создана при разделении plan.js)

(function() { // IIFE для изоляции области видимости
	'use strict';

	// --- Глобальное Пространство Имен ---
	window.PlanApp = window.PlanApp || {};
	const PlanApp = window.PlanApp; // Локальная ссылка

	// Проверка зависимостей (убедимся, что state и config уже есть)
	if (typeof PlanApp.state === 'undefined' || typeof PlanApp.config === 'undefined') {
		console.error("FATAL: Не удалось инициализировать plan-ui-components.js. Отсутствует PlanApp.state или PlanApp.config. Убедитесь, что plan-data-logic.js загружен первым.");
		return;
	}

	// --- DOM Элементы (Кэш) ---
	PlanApp.ui = {
		initialLoader: document.getElementById('initial-loader'),
		mainContent: document.getElementById('main-content'),
		sidebar: document.getElementById('sidebar'),
		sidebarOverlay: document.getElementById('sidebar-overlay'),
		mobileMenuToggle: document.getElementById('mobile-menu-toggle'), // ID из plan.html!
		sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
		userName: document.getElementById('user-name'),
		userAvatar: document.getElementById('user-avatar'),
		toastContainer: document.getElementById('toast-container'),
		globalError: document.getElementById('global-error'),
		planTabs: document.querySelectorAll('.plan-tab'),
		currentPlanSection: document.getElementById('currentPlanSection'),
		currentPlanLoader: document.getElementById('currentPlanLoader'),
		currentPlanContent: document.getElementById('currentPlanContent'),
		historyPlanSection: document.getElementById('historyPlanSection'),
		historyLoader: document.getElementById('historyLoader'),
		historyPlanContent: document.getElementById('historyPlanContent'),
		createPlanSection: document.getElementById('createPlanSection'),
		createPlanLoader: document.getElementById('createPlanLoader'),
		createPlanContent: document.getElementById('createPlanContent'),
		planSection: document.getElementById('planSection'),
		planLoading: document.getElementById('planLoading'),
		planSectionTitle: document.getElementById('plan-section-title'),
		planContent: document.getElementById('planContent'),
		planActions: document.getElementById('planActions'),
		genericBackBtn: document.getElementById('genericBackBtn'),
		verticalScheduleList: document.getElementById('vertical-schedule-list'),
		verticalScheduleNav: document.getElementById('verticalScheduleNav'),
		exportScheduleBtnVertical: document.getElementById('exportScheduleBtnVertical'),
		notificationBell: document.getElementById('notification-bell'),
		notificationCount: document.getElementById('notification-count'),
		notificationsDropdown: document.getElementById('notifications-dropdown'),
		notificationsList: document.getElementById('notifications-list'),
		noNotificationsMsg: document.getElementById('no-notifications-msg'),
		markAllReadBtn: document.getElementById('mark-all-read'),
		// Templates
		lockedPlanTemplate: document.getElementById('lockedPlanTemplate'),
		createPlanFormTemplate: document.getElementById('createPlanFormTemplate'),
		noDiagnosticTemplate: document.getElementById('noDiagnosticTemplate'),
		historyItemTemplate: document.getElementById('historyItemTemplate'),
		promptCreatePlanTemplate: document.getElementById('promptCreatePlanTemplate'),
		noActivePlanTemplate: document.getElementById('noActivePlanTemplate'),
		// Footer & Mouse
		currentYearSidebar: document.getElementById('currentYearSidebar'),
		currentYearFooter: document.getElementById('currentYearFooter'),
		mouseFollower: document.getElementById('mouse-follower')
	};

    // Визуалы (копируем для рендеринга)
    const activityVisuals = PlanApp.activityVisuals || { // Используем существующие или дефолтные
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
		if (!ui.toastContainer) { console.warn("[UI] Toast container not found."); return; }
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

	PlanApp.showGlobalError = (message) => { const ui = PlanApp.ui; if(ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i><div>${PlanApp.sanitizeHTML(message)}</div></div>`; ui.globalError.style.display = 'block'; console.error("[UI] Global Error Displayed:", message); } else { console.error("[UI] Global error container not found. Error:", message); PlanApp.showToast("Kritická chyba", message, "error", 10000); } };
	PlanApp.hideGlobalError = () => { const ui = PlanApp.ui; if(ui.globalError) ui.globalError.style.display = 'none'; };
	PlanApp.sanitizeHTML = (str) => { const t = document.createElement('div'); t.textContent = str || ''; return t.innerHTML; };
	PlanApp.getInitials = (profileData, email) => { const state = PlanApp.state; if (!profileData && !email) return '?'; const avatarUrl = profileData?.avatar_url; if (avatarUrl && !avatarUrl.startsWith('assets/')) { return `<img src="${PlanApp.sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="Avatar">`; } else if (avatarUrl) { return `<img src="${PlanApp.sanitizeHTML(avatarUrl)}" alt="Avatar">`; } else { let i = ''; if (profileData?.first_name) i += profileData.first_name[0]; if (profileData?.last_name) i += profileData.last_name[0]; if (i) return i.toUpperCase(); if (profileData?.username) return profileData.username[0].toUpperCase(); if (email) return email[0].toUpperCase(); return 'P'; } };
	PlanApp.formatDate = (dateString) => { if(!dateString) return '-'; try { const date = new Date(dateString); if (isNaN(date.getTime())) return 'Neplatné datum'; return date.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch(e){ return '-';}};
	PlanApp.formatRelativeTime = (timestamp) => { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return '-'; } };
	PlanApp.openMenu = () => { const ui = PlanApp.ui; if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } };
	PlanApp.closeMenu = () => { const ui = PlanApp.ui; if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } };
	PlanApp.initTooltips = () => { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top', contentAsHTML: true }); } } catch (e) { console.error("[UI] Tooltipster init error:", e); } };
	PlanApp.updateCopyrightYear = () => { const ui = PlanApp.ui; const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
	PlanApp.initMouseFollower = () => { /* ... (код остается тем же) ... */ };
	PlanApp.initScrollAnimations = () => { /* ... (код остается тем же) ... */ };
	PlanApp.initHeaderScrollDetection = () => { /* ... (код остается тем же) ... */ };
	PlanApp.updateOnlineStatus = () => { if (!navigator.onLine) PlanApp.showToast('Offline', 'Spojení bylo ztraceno.', 'warning'); };
    PlanApp.updateTheme = () => { const state = PlanApp.state; console.log("[UI] Updating theme, isDarkMode:", state.isDarkMode); document.documentElement.classList.toggle('dark', state.isDarkMode); document.documentElement.classList.toggle('light', !state.isDarkMode); };

    // --- Управление состоянием загрузки UI ---
    PlanApp.setLoadingState = (sectionKey, isLoadingFlag) => {
		const state = PlanApp.state; const ui = PlanApp.ui;
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
				if (key === 'schedule' && ui.verticalScheduleList) { /* ... skeleton HTML ... */ ui.verticalScheduleList.classList.add('schedule-visible'); }
				if (key === 'notifications' && ui.notificationsList) PlanApp.renderNotificationSkeletons(2);
				if ((key === 'generation' || key === 'detail') && ui.planActions) ui.planActions.style.display = 'none';
			} else {
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
		if (ui.userName && ui.userAvatar) {
			if (state.currentUser && state.currentProfile) {
				const displayName = `${state.currentProfile.first_name || ''} ${state.currentProfile.last_name || ''}`.trim() || state.currentProfile.username || state.currentUser.email?.split('@')[0] || 'Pilot';
				ui.userName.textContent = PlanApp.sanitizeHTML(displayName);
				ui.userAvatar.innerHTML = PlanApp.getInitials(state.currentProfile, state.currentUser.email);
			} else { ui.userName.textContent = 'Nepřihlášen'; ui.userAvatar.textContent = '?'; }
		} else { console.warn("[UI] Sidebar user info elements not found."); }
	};

	PlanApp.renderVerticalSchedule = (activities, planId) => {
		 const ui = PlanApp.ui; const days = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota']; const todayIndex = new Date().getDay();
		 const listContainer = ui.verticalScheduleList; if (!listContainer) { console.error("[UI RenderVertical] Container not found!"); return; }
		 listContainer.innerHTML = ''; if (!Array.isArray(activities)) activities = [];
		 const activitiesByDay = {}; for (let i = 0; i <= 6; i++) activitiesByDay[i] = [];
		 activities.forEach(act => { if (activitiesByDay[act.day_of_week] !== undefined) activitiesByDay[act.day_of_week].push(act); });
		 const daysOrder = [1, 2, 3, 4, 5, 6, 0]; let hasAnyActivity = false;
		 daysOrder.forEach(dayIndex => {
			 const dayActivities = activitiesByDay[dayIndex].sort((a, b) => (a.time_slot || '99:99').localeCompare(b.time_slot || '99:99'));
			 const dayName = days[dayIndex]; const isToday = dayIndex === todayIndex; const dayCard = document.createElement('div');
			 dayCard.className = `day-schedule-card ${isToday ? 'today' : ''} expanded`; dayCard.setAttribute('data-animate', ''); dayCard.style.setProperty('--animation-order', daysOrder.indexOf(dayIndex));
			 const dayHeader = document.createElement('div'); dayHeader.className = 'day-header'; dayHeader.innerHTML = `${PlanApp.sanitizeHTML(dayName)} ${isToday ? '<span>(Dnes)</span>' : ''}<i class="fas fa-chevron-down day-expand-icon"></i>`; dayCard.appendChild(dayHeader);
			 const activitiesContainer = document.createElement('div'); activitiesContainer.className = 'activity-list-container';
			 if (dayActivities.length > 0) {
				 hasAnyActivity = true;
				 dayActivities.forEach(activity => {
					 if (!activity || !activity.id) return; const activityElement = document.createElement('div');
					 activityElement.className = `activity-list-item ${activity.completed ? 'completed' : ''}`; activityElement.dataset.activityId = activity.id;
					 const timeDisplay = activity.time_slot ? `<span class="activity-time-display">${PlanApp.sanitizeHTML(activity.time_slot)}</span>` : '';
					 const iconClass = (typeof PlanApp.getActivityIcon === 'function' ? PlanApp.getActivityIcon(activity.title, activity.type) : 'fa-question-circle');
					 const hasDescription = activity.description && activity.description.trim().length > 0;
					 const expandIcon = hasDescription ? `<button class="expand-icon-button btn-tooltip" aria-label="Rozbalit popis" title="Zobrazit/skrýt popis"><i class="fas fa-chevron-down expand-icon"></i></button>` : '';
					 activityElement.innerHTML = `<label class="activity-checkbox"><input type="checkbox" id="vertical-activity-${activity.id}" ${activity.completed ? 'checked' : ''} data-activity-id="${activity.id}" data-plan-id="${planId}"></label><i class="fas ${iconClass} activity-icon"></i><div class="activity-details"><div class="activity-header"><div class="activity-title-time"><span class="activity-title">${PlanApp.sanitizeHTML(activity.title || 'Aktivita')}</span>${timeDisplay}</div>${expandIcon}</div>${hasDescription ? `<div class="activity-desc">${PlanApp.sanitizeHTML(activity.description)}</div>` : ''}</div>`;
					 activitiesContainer.appendChild(activityElement);
				 });
			 } else { activitiesContainer.innerHTML = `<div class="no-activities-day">Žádné aktivity pro tento den.</div>`; }
			 dayCard.appendChild(activitiesContainer); listContainer.appendChild(dayCard);
		 });
		 if (!hasAnyActivity) { listContainer.innerHTML = '<div class="no-activities-day" style="padding: 2rem; border: none;">Pro tento plán nebyly nalezeny žádné aktivity.</div>'; }
		 console.log("[UI RenderVertical] Rendering complete.");
		 if (typeof PlanApp.initScrollAnimations === 'function') PlanApp.initScrollAnimations(); // Initialize animations
	 };

	 PlanApp.showVerticalSchedule = async (plan) => {
		const ui = PlanApp.ui; const state = PlanApp.state;
		if (!state.supabaseClient || !plan || !plan.id) { /* Error handling */ return; }
		console.log(`[UI ShowVertical] Displaying schedule for Plan ID ${plan.id}`);
		if (ui.currentPlanContent) ui.currentPlanContent.classList.remove('content-visible');
		try {
			if (typeof PlanApp.fetchPlanActivities !== 'function') { throw new Error("Core function fetchPlanActivities missing!"); }
			const activities = await PlanApp.fetchPlanActivities(plan.id); // Вызов из ядра
			PlanApp.renderVerticalSchedule(activities || [], plan.id); // Рендеринг
			if (ui.verticalScheduleList) ui.verticalScheduleList.classList.add('schedule-visible');
			if (ui.verticalScheduleNav) ui.verticalScheduleNav.classList.add('nav-visible');
		} catch (error) { /* Error handling */ } finally { if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('schedule', false); if (typeof PlanApp.initTooltips === 'function') PlanApp.initTooltips(); }
	 };

	 PlanApp.renderPlanHistory = (plans) => {
		const ui = PlanApp.ui; if (!ui.historyPlanContent || !ui.historyItemTemplate) return;
		if (!plans || plans.length === 0) { PlanApp.renderMessage(ui.historyPlanContent, 'info', 'Žádná historie', 'Zatím jste nevytvořili žádné studijní plány.'); return; }
		ui.historyPlanContent.innerHTML = ''; ui.historyPlanContent.style.display = 'grid';
		plans.forEach((plan, index) => {
			const node = ui.historyItemTemplate.content.cloneNode(true); const item = node.querySelector('.history-item');
			if(item) {
				item.dataset.planId = plan.id; item.classList.add(plan.status || 'inactive'); item.setAttribute('data-animate', ''); item.style.setProperty('--animation-order', index);
				const dateEl = item.querySelector('.history-date'); const titleEl = item.querySelector('.history-title'); const progressEl = item.querySelector('.history-progress'); const statusEl = item.querySelector('.history-status');
				if(dateEl) dateEl.textContent = `Vytvořeno: ${PlanApp.formatDate(plan.created_at)}`;
				if(titleEl) titleEl.textContent = PlanApp.sanitizeHTML(plan.title || "Studijní plán");
				if(progressEl) progressEl.innerHTML = `Pokrok: <strong>${plan.progress ?? 0}%</strong>`;
				if(statusEl) { const statusText = plan.status === 'active' ? 'Aktivní' : plan.status === 'completed' ? 'Dokončený' : 'Neaktivní'; statusEl.textContent = statusText; statusEl.className = `history-status ${plan.status || 'inactive'}`; }
				 item.addEventListener('click', () => { if (typeof PlanApp.showPlanDetail === 'function') PlanApp.showPlanDetail(plan); else console.error("PlanApp.showPlanDetail function not found!"); });
				ui.historyPlanContent.appendChild(node);
			}
		});
		ui.historyPlanContent.classList.add('content-visible');
		if (typeof PlanApp.initScrollAnimations === 'function') PlanApp.initScrollAnimations();
	};

	PlanApp.renderHistorySkeletons = (count) => { /* ... (код остается тем же) ... */ };
	PlanApp.renderLockedPlanSection = (container) => { const ui = PlanApp.ui; if(!container || !ui.lockedPlanTemplate) return; const node = ui.lockedPlanTemplate.content.cloneNode(true); const timerEl = node.getElementById('nextPlanTimer'); const viewBtn = node.getElementById('viewCurrentPlanBtnLocked'); if(timerEl && typeof PlanApp.updateNextPlanTimer === 'function') PlanApp.updateNextPlanTimer(timerEl); if(viewBtn && typeof PlanApp.switchTab === 'function') viewBtn.addEventListener('click', () => PlanApp.switchTab('current')); container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); if (typeof PlanApp.startPlanTimer === 'function') PlanApp.startPlanTimer(); };
	PlanApp.renderPlanCreationForm = (container) => { const ui = PlanApp.ui; const state = PlanApp.state; if (!container || !ui.createPlanFormTemplate || !state.latestDiagnosticData) { PlanApp.renderMessage(container, 'error', 'Chyba', 'Nelze zobrazit formulář.'); return; } const node = ui.createPlanFormTemplate.content.cloneNode(true); const diagInfo = node.getElementById('diagnosticInfo'); if (diagInfo) { const score = state.latestDiagnosticData.total_score ?? '-'; const totalQ = state.latestDiagnosticData.total_questions ?? '-'; const date = PlanApp.formatDate(state.latestDiagnosticData.completed_at); diagInfo.innerHTML = `<p>Plán bude vycházet z testu ze dne: <strong>${date}</strong> (Skóre: ${score}/${totalQ})</p>`; } container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); const actualGenBtn = container.querySelector('#generatePlanBtn'); if (actualGenBtn && typeof PlanApp.handleGenerateClick === 'function') actualGenBtn.addEventListener('click', PlanApp.handleGenerateClick); else if (actualGenBtn) console.error("PlanApp.handleGenerateClick function not found!"); };
	PlanApp.renderNoDiagnosticAvailable = (container) => { const ui = PlanApp.ui; if (!container || !ui.noDiagnosticTemplate) return; const node = ui.noDiagnosticTemplate.content.cloneNode(true); const btn = node.getElementById('goToTestBtn'); if(btn) btn.onclick = () => window.location.href = '/dashboard/procvicovani/test1.html'; container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); };
	PlanApp.renderPromptCreatePlan = (container) => { const ui = PlanApp.ui; if (!container || !ui.promptCreatePlanTemplate) return; if (PlanApp.ui?.verticalScheduleList) PlanApp.ui.verticalScheduleList.classList.remove('schedule-visible'); if (PlanApp.ui?.verticalScheduleNav) PlanApp.ui.verticalScheduleNav.classList.remove('nav-visible'); const node = ui.promptCreatePlanTemplate.content.cloneNode(true); const btn = node.getElementById('createNewPlanFromPromptBtn'); if (btn && typeof PlanApp.switchTab === 'function') btn.addEventListener('click', () => PlanApp.switchTab('create')); container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); };
	PlanApp.renderNoActivePlan = (container) => { const ui = PlanApp.ui; if (!container || !ui.noActivePlanTemplate) return; if (PlanApp.ui?.verticalScheduleList) PlanApp.ui.verticalScheduleList.classList.remove('schedule-visible'); if (PlanApp.ui?.verticalScheduleNav) PlanApp.ui.verticalScheduleNav.classList.remove('nav-visible'); const node = ui.noActivePlanTemplate.content.cloneNode(true); const link = node.querySelector('.link-to-create-tab'); if (link && typeof PlanApp.switchTab === 'function') link.addEventListener('click', (e) => { e.preventDefault(); PlanApp.switchTab('create'); }); container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); };

	PlanApp.displayPlanContent = (markdownContent) => {
        const ui = PlanApp.ui; if (!ui.planContent) return;
        try { if (typeof marked === 'undefined') throw new Error("Marked library not loaded."); marked.setOptions({ gfm: true, breaks: true, sanitize: false }); const htmlContent = marked.parse(markdownContent || ''); ui.planContent.innerHTML = htmlContent; if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { setTimeout(() => { window.MathJax.typesetPromise([ui.planContent]).catch(e => console.error("[UI] MathJax error:", e)); }, 0); } else { console.warn("[UI] MathJax not ready for rendering plan content."); }
        } catch (e) { console.error("[UI] Markdown rendering error:", e); PlanApp.renderMessage(ui.planContent, 'error', 'Chyba zobrazení plánu', e.message); ui.planContent.classList.add('content-visible'); }
    };

    PlanApp.renderPreviewActions = (isError = false) => {
        const ui = PlanApp.ui; if (!ui.planActions) return;
        let buttonsHTML = '';
        if (isError) { buttonsHTML = `<button class="btn btn-secondary" id="regeneratePlanBtn"><i class="fas fa-sync-alt"></i> Vygenerovat znovu</button>`; }
        else { buttonsHTML = `<button class="btn btn-primary" id="saveGeneratedPlanBtn"><i class="fas fa-save"></i> Uložit tento plán</button><button class="btn btn-success btn-tooltip" id="exportGeneratedPlanBtn" title="Stáhnout návrh jako PDF"><i class="fas fa-file-pdf"></i> Export PDF</button><button class="btn btn-secondary" id="regeneratePlanBtn"><i class="fas fa-sync-alt"></i> Vygenerovat znovu</button>`; }
        ui.planActions.innerHTML = buttonsHTML;
        const saveBtn = ui.planActions.querySelector('#saveGeneratedPlanBtn'); const exportBtn = ui.planActions.querySelector('#exportGeneratedPlanBtn'); const regenBtn = ui.planActions.querySelector('#regeneratePlanBtn');
        if (saveBtn && typeof PlanApp.handleSaveGeneratedPlanClick === 'function') saveBtn.addEventListener('click', PlanApp.handleSaveGeneratedPlanClick); else if (saveBtn) console.error("Core function handleSaveGeneratedPlanClick missing!");
        if (exportBtn && typeof PlanApp.exportPlanToPDFWithStyle === 'function') { const tempPlanData = { created_at: new Date(), plan_content_markdown: PlanApp.state.lastGeneratedMarkdown, title: "Nový návrh plánu" }; exportBtn.addEventListener('click', () => PlanApp.exportPlanToPDFWithStyle(tempPlanData)); } else if (exportBtn) console.error("UI function exportPlanToPDFWithStyle missing!");
        if (regenBtn && typeof PlanApp.handleGenerateClick === 'function') regenBtn.addEventListener('click', PlanApp.handleGenerateClick); else if (regenBtn) console.error("UI function handleGenerateClick missing!");
        ui.planActions.style.display = buttonsHTML.trim() ? 'flex' : 'none';
        if (typeof PlanApp.initTooltips === 'function') PlanApp.initTooltips();
    };

    PlanApp.showPlanDetail = async (plan) => {
		const ui = PlanApp.ui; const state = PlanApp.state; if (!plan || !plan.id) return;
		ui.currentPlanSection?.classList.remove('visible-section'); ui.historyPlanSection?.classList.remove('visible-section'); ui.createPlanSection?.classList.remove('visible-section'); ui.planSection?.classList.add('visible-section');
		PlanApp.setLoadingState('detail', true); if(ui.planContent) ui.planContent.classList.remove('content-visible', 'generated-reveal'); if(ui.planActions) ui.planActions.innerHTML = ''; if(ui.planSectionTitle) ui.planSectionTitle.textContent = 'Načítání detailu...';
		if (ui.genericBackBtn) { ui.genericBackBtn.onclick = () => { state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; state.lastGeneratedTopicsData = null; PlanApp.switchTab('history'); }; }
		try {
			let fullPlanData = { ...plan };
			if (!plan.plan_content_markdown && state.supabaseClient) {
				console.log("[UI ShowDetail] Fetching full markdown for detail via core...");
                 if (typeof PlanApp.fetchPlanDetails !== 'function') { throw new Error("Core function fetchPlanDetails is missing!"); }
                 const fetchedData = await PlanApp.fetchPlanDetails(plan.id); // Вызов из ядра
                 if (!fetchedData) throw new Error("Nepodařilo se načíst data plánu.");
                 fullPlanData = { ...plan, ...fetchedData };
			} else if (!plan.plan_content_markdown) { throw new Error("Chybí obsah plánu a nelze ho načíst."); }
			if(ui.planSectionTitle) ui.planSectionTitle.textContent = fullPlanData.title || 'Detail studijního plánu';
			const metaDateEl = document.getElementById('plan-meta-date'); if (metaDateEl) metaDateEl.textContent = `Vytvořeno: ${PlanApp.formatDate(fullPlanData.created_at)}`;
			PlanApp.displayPlanContent(fullPlanData.plan_content_markdown);
			if (ui.planContent) { ui.planContent.classList.remove('generated-reveal'); ui.planContent.classList.add('content-visible'); }
			if(ui.planActions && typeof PlanApp.exportPlanToPDFWithStyle === 'function') { ui.planActions.innerHTML = `<button class="btn btn-success btn-tooltip" id="exportDetailPlanBtn" title="Stáhnout plán jako PDF"><i class="fas fa-file-pdf"></i> Export PDF</button>`; const exportButton = ui.planActions.querySelector('#exportDetailPlanBtn'); if(exportButton) exportButton.addEventListener('click', () => PlanApp.exportPlanToPDFWithStyle(fullPlanData)); ui.planActions.style.display = 'flex'; } else if (ui.planActions) { console.error("Export function missing!"); ui.planActions.innerHTML = ''; ui.planActions.style.display = 'none';}
			if (ui.planSection) ui.planSection.scrollIntoView({ behavior: 'smooth' }); PlanApp.initTooltips();
		} catch (error) { console.error("[UI ShowDetail] Error loading plan detail:", error); if(ui.planContent) { PlanApp.renderMessage(ui.planContent, 'error', 'Chyba', 'Nepodařilo se načíst detail plánu.'); ui.planContent.classList.add('content-visible'); } if(ui.planActions) ui.planActions.innerHTML = ''; } finally { PlanApp.setLoadingState('detail', false); }
	};

    // --- Уведомления (UI Рендеринг) ---
	PlanApp.renderNotifications = (count, notifications) => {
        const ui = PlanApp.ui; console.log("[UI RenderNotifications] Start, Count:", count, "Notifications:", notifications);
        if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[UI RenderNotifications] Missing UI elements."); return; }
        ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0);
        if (notifications && notifications.length > 0) {
            ui.notificationsList.innerHTML = notifications.map(n => {
                 const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${PlanApp.sanitizeHTML(n.link)}"` : '';
                 return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${PlanApp.sanitizeHTML(n.title)}</div><div class="notification-message">${PlanApp.sanitizeHTML(n.message)}</div><div class="notification-time">${PlanApp.formatRelativeTime(n.created_at)}</div></div></div>`;
             }).join('');
            ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0;
        } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; }
        ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.toggle('has-content', notifications && notifications.length > 0);
        console.log("[UI RenderNotifications] Finished rendering.");
    };

	PlanApp.renderNotificationSkeletons = (count = 2) => { const ui = PlanApp.ui; if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton"></div><div class="notification-content"><div class="skeleton" style="height:16px;width:70%;margin-bottom:6px;"></div><div class="skeleton" style="height:12px;width:90%;"></div><div class="skeleton" style="height:10px;width:40%;margin-top:6px;"></div></div></div>`; ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; };

    // --- UI Инициализация ---
    PlanApp.initializeUI = () => {
        const ui = PlanApp.ui;
        const state = PlanApp.state;
        try {
             if (typeof PlanApp.updateTheme === 'function') PlanApp.updateTheme(); else console.warn("updateTheme function missing");
             if (typeof PlanApp.initTooltips === 'function') PlanApp.initTooltips(); else console.warn("initTooltips function missing");
             if (typeof PlanApp.initMouseFollower === 'function') PlanApp.initMouseFollower(); else console.warn("initMouseFollower function missing");
             if (typeof PlanApp.initHeaderScrollDetection === 'function') PlanApp.initHeaderScrollDetection(); else console.warn("initHeaderScrollDetection function missing");
             if (typeof PlanApp.updateCopyrightYear === 'function') PlanApp.updateCopyrightYear(); else console.warn("updateCopyrightYear function missing");
             if (typeof PlanApp.updateOnlineStatus === 'function') PlanApp.updateOnlineStatus(); else console.warn("updateOnlineStatus function missing");
             if (typeof PlanApp.updateUserInfoUI === 'function') PlanApp.updateUserInfoUI(); else console.warn("updateUserInfoUI function missing"); // Первоначальное обновление UI пользователя

            // Скрыть все секции контента по умолчанию
            ui.currentPlanSection?.classList.remove('visible-section');
            ui.historyPlanSection?.classList.remove('visible-section');
            ui.createPlanSection?.classList.remove('visible-section');
            ui.planSection?.classList.remove('visible-section');

            console.log("[UI Init] Base UI initialized.");
            return true;
        } catch(error) {
            console.error("[UI Init] Failed:", error);
            if(typeof PlanApp.showGlobalError === 'function') PlanApp.showGlobalError(`Chyba inicializace UI: ${error.message}`);
            return false;
        }
    };

	console.log("plan-ui-components.js loaded.");

})(); // Конец IIFE