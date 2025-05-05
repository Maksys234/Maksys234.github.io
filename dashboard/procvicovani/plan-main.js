// Файл: procvicovani/plan-main.js
// Описание: Главный файл оркестровки для страницы Studijního plánu.
// Отвечает за инициализацию, основные обработчики событий и координацию модулей.
// Зависит от plan-data-logic.js и plan-ui-components.js.
// Версия: 1.1 (Исправлена ошибка с supabaseClient.auth)

(function() { // IIFE для изоляции области видимости
	'use strict';

	// --- Проверка доступности основного объекта PlanApp ---
	if (typeof window.PlanApp === 'undefined') {
		console.error("FATAL: Не удалось инициализировать plan-main.js. Объект PlanApp не найден. Убедитесь, что plan-data-logic.js и plan-ui-components.js загружены первыми.");
		document.body.innerHTML = '<div style="color:red; padding: 20px;">Kritická chyba: Základní moduly aplikace nebyly načteny. Obnovte stránku nebo kontaktujte podporu.</div>';
		return;
	}

	// Локальная ссылка для удобства
	const PlanApp = window.PlanApp;

	// --- Основные обработчики событий UI (Оркестровка) ---
	PlanApp.setupMainEventListeners = () => {
		const ui = PlanApp.ui; // Получаем UI элементы из PlanApp
		console.log("[Main] Setting up main event listeners...");

		if (!ui) { console.error("[Main] UI cache not found in PlanApp. Cannot setup listeners."); return; }

		// Переключение вкладок
		ui.planTabs?.forEach(tab => {
			tab.addEventListener('click', () => {
				if (typeof PlanApp.switchTab === 'function') PlanApp.switchTab(tab.dataset.tab);
				else console.error("PlanApp.switchTab function not found!");
			});
		});

		// Общие слушатели (сайбдар, тема и т.д.)
		if (ui.mobileMenuToggle && typeof PlanApp.openMenu === 'function') ui.mobileMenuToggle.addEventListener('click', PlanApp.openMenu);
		if (ui.sidebarCloseToggle && typeof PlanApp.closeMenu === 'function') ui.sidebarCloseToggle.addEventListener('click', PlanApp.closeMenu);
		if (ui.sidebarOverlay && typeof PlanApp.closeMenu === 'function') ui.sidebarOverlay.addEventListener('click', PlanApp.closeMenu);

		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
			if (typeof PlanApp.updateTheme === 'function' && PlanApp.state) {
                PlanApp.state.isDarkMode = event.matches; PlanApp.updateTheme();
            }
		});
        window.addEventListener('online', () => typeof PlanApp.updateOnlineStatus === 'function' && PlanApp.updateOnlineStatus());
        window.addEventListener('offline', () => typeof PlanApp.updateOnlineStatus === 'function' && PlanApp.updateOnlineStatus());
        window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) { if(typeof PlanApp.closeMenu === 'function') PlanApp.closeMenu();} });

        // Слушатели для уведомлений (колокольчик и кнопка "прочитано")
		if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
		if (ui.markAllReadBtn && typeof PlanApp.markAllNotificationsRead === 'function') ui.markAllReadBtn.addEventListener('click', PlanApp.markAllNotificationsRead);
		else if (ui.markAllReadBtn) console.error("Core function PlanApp.markAllNotificationsRead missing!");

        // Делегирование для кликов по уведомлениям (в plan-ui.js, т.к. динамический контент)
        // Здесь только проверка наличия контейнера
        if (!ui.notificationsList) console.warn("Notifications list element missing for delegation setup.");

		console.log("✅ [Main] Main event listeners setup complete.");
	};

	// --- Логика переключения вкладок ---
	PlanApp.switchTab = async (tabId) => {
		const state = PlanApp.state; const ui = PlanApp.ui; const core = PlanApp;
		if (!state || !ui) { console.error("[SwitchTab] State or UI object not found."); return; }
		if (Object.values(state.isLoading).some(loading => loading)) { console.warn(`[SwitchTab] Blocked switching to ${tabId}, operation in progress.`); PlanApp.showToast('Operace stále probíhá, počkejte prosím.', 'info'); return; }

		console.log(`[SwitchTab] Switching to tab: ${tabId}`);
		state.currentTab = tabId;
		ui.planTabs?.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));

		// Скрыть все основные секции и контент
		const sections = [ui.currentPlanSection, ui.historyPlanSection, ui.createPlanSection, ui.planSection];
		sections.forEach(section => section?.classList.remove('visible-section'));
		const contents = [ui.currentPlanContent, ui.verticalScheduleList, ui.verticalScheduleNav, ui.planContent, ui.historyPlanContent, ui.createPlanContent];
		contents.forEach(content => content?.classList.remove('content-visible', 'schedule-visible', 'generated-reveal'));

		if (state.lastGeneratedMarkdown !== null && tabId !== 'detail' && !ui.planSection?.classList.contains('visible-section')) { console.log("[SwitchTab] Clearing generated plan state."); state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; state.lastGeneratedTopicsData = null; }
		if (typeof PlanApp.hideGlobalError === 'function') PlanApp.hideGlobalError();

		try {
			let targetSectionElement = null;
			switch(tabId) {
				case 'current': targetSectionElement = ui.currentPlanSection; break;
				case 'history': targetSectionElement = ui.historyPlanSection; break;
				case 'create': targetSectionElement = ui.createPlanSection; break;
				default: console.warn(`[SwitchTab] Unknown tab ID: ${tabId}`); return;
			}

			if (targetSectionElement) {
				targetSectionElement.classList.add('visible-section');
				// Вызов соответствующей функции загрузки данных из plan-data-logic.js
				if (tabId === 'current' && typeof core.loadCurrentPlan === 'function') await core.loadCurrentPlan();
				else if (tabId === 'history' && typeof core.loadPlanHistory === 'function') await core.loadPlanHistory();
				else if (tabId === 'create' && typeof core.checkPlanCreationAvailability === 'function') await core.checkPlanCreationAvailability();
				else if (!['current', 'history', 'create'].includes(tabId)) console.warn(`[SwitchTab] No load function defined for tab: ${tabId}`);
			} else { console.warn(`[SwitchTab] Target section element not found for tab: ${tabId}`); }
		} catch (error) {
			console.error(`[SwitchTab] Error loading tab ${tabId}:`, error);
			const errorTargetSection = document.getElementById(`${tabId}PlanSection`); const errorContentContainer = errorTargetSection?.querySelector('.section-content');
			if(errorTargetSection) errorTargetSection.classList.add('visible-section');
			if (errorContentContainer && typeof PlanApp.renderMessage === 'function') PlanApp.renderMessage(errorContentContainer, 'error', 'Chyba načítání', `Obsah záložky "${tabId}" nelze načíst: ${error.message}`);
			else if(typeof PlanApp.showGlobalError === 'function') PlanApp.showGlobalError(`Nepodařilo se načíst záložku "${tabId}": ${error.message}`);
			if(typeof PlanApp.setLoadingState === 'function') { if(tabId === 'current') { PlanApp.setLoadingState('current', false); PlanApp.setLoadingState('schedule', false); } if(tabId === 'history') PlanApp.setLoadingState('history', false); if(tabId === 'create') PlanApp.setLoadingState('create', false); }
		}
	};

	// --- Главная функция инициализации приложения (Исправленная) ---
	PlanApp.initializeApp = async () => {
		const ui = PlanApp.ui;     // UI из plan-ui-components.js
		const state = PlanApp.state; // state из plan-data-logic.js
		const core = PlanApp;    // Функции ядра из plan-data-logic.js

		console.log("🚀 [Init Main - Revised v2] Starting Plan Page Initialization...");

		// 1. Показать начальный загрузчик
		if (ui?.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
		if (ui?.mainContent) ui.mainContent.style.display = 'none';

		// 2. Инициализация Supabase ПЕРВОЙ
		console.log("[Init Main - Revised v2] Attempting to initialize Supabase...");
		if (typeof core.initializeSupabase !== 'function' || !core.initializeSupabase()) {
			console.error("FATAL: Supabase initialization failed. Cannot proceed.");
			if (ui?.initialLoader) ui.initialLoader.innerHTML = '<p style="color:red;">Chyba připojení k databázi.</p>';
			return;
		}
		console.log("[Init Main - Revised v2] Supabase initialization function called.");

		// 3. Проверка аутентификации и загрузка профиля
		try {
			console.log("[Init Main - Revised v2] Checking PlanApp.state.supabaseClient:", PlanApp.state.supabaseClient);
			if (!PlanApp.state.supabaseClient) { // Дополнительная проверка
				 throw new Error("Supabase client is not available after initialization!");
			}
			const localSupabaseClient = PlanApp.state.supabaseClient; // Используем локальную переменную для ясности
			console.log("[Init Main - Revised v2] Checking authentication session using local client...");

			// Получаем сессию
			const { data: { session }, error: sessionError } = await localSupabaseClient.auth.getSession();
			if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);

			if (!session || !session.user) {
				console.log('[Init Main - Revised v2] Not logged in. Redirecting...');
				window.location.href = '/auth/index.html'; return;
			}
			state.currentUser = session.user;
			console.log(`[Init Main - Revised v2] User authenticated (ID: ${state.currentUser.id}). Loading profile...`);

			// Загрузка профиля
			if (typeof core.fetchUserProfile !== 'function') throw new Error("fetchUserProfile function is missing.");
			state.currentProfile = await core.fetchUserProfile(state.currentUser.id);
			if (!state.currentProfile) throw new Error("Profil uživatele nenalezen.");
			console.log("[Init Main - Revised v2] Profile loaded.");

			// 4. Инициализация UI (должна быть доступна из plan-ui-components.js)
			if (typeof PlanApp.initializeUI !== 'function') throw new Error("initializeUI function is missing.");
			if (!PlanApp.initializeUI()) throw new Error("UI Initialization failed.");

			// 5. Настройка основных слушателей событий (эта функция)
			PlanApp.setupMainEventListeners();

			// 6. Загрузка данных по умолчанию (уведомления + вкладка 'current')
			console.log("[Init Main - Revised v2] Loading initial notifications and default tab...");
			const loadNotificationsPromise = (typeof core.fetchNotifications === 'function' && typeof PlanApp.renderNotifications === 'function')
				? core.fetchNotifications(state.currentUser.id, core.config.NOTIFICATION_FETCH_LIMIT)
					.then(({ unreadCount, notifications }) => PlanApp.renderNotifications(unreadCount, notifications))
					.catch(err => { console.error("Initial notification load failed:", err); if(PlanApp.renderNotifications) PlanApp.renderNotifications(0, []); })
				: Promise.resolve(console.warn("Notification functions not found."));

			const loadInitialTabPromise = typeof PlanApp.switchTab === 'function'
				? PlanApp.switchTab('current')
				: Promise.resolve(console.error("switchTab function not found!"));

			await Promise.all([loadNotificationsPromise, loadInitialTabPromise]);

			// 7. Показать контент, скрыть загрузчик
			if (ui?.mainContent) {
				ui.mainContent.style.display = 'flex';
				requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); if (typeof PlanApp.initScrollAnimations === 'function') PlanApp.initScrollAnimations(); });
			}
			console.log("✅ [Init Main - Revised v2] Plan Page Initialized Successfully.");

		} catch (error) {
			console.error("❌ [Init Main - Revised v2] Critical initialization error:", error);
			if (ui?.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color:red;">Chyba inicializace (${error.message}). Obnovte stránku.</p>`; }
			else if(typeof PlanApp.showGlobalError === 'function') { PlanApp.showGlobalError(`Chyba inicializace: ${error.message}`); if (ui?.mainContent) ui.mainContent.style.display = 'flex'; }
			else { document.body.innerHTML = `<div style="color:red; padding: 20px;">Kritická chyba: ${error.message}</div>`; }
			if(typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('all', false);
		} finally {
			if (ui?.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
		}
	};

	// --- Запуск приложения ---
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', PlanApp.initializeApp);
	} else {
		PlanApp.initializeApp(); // Если DOM уже загружен
	}

	console.log("plan-main.js loaded.");

})(); // Конец IIFE