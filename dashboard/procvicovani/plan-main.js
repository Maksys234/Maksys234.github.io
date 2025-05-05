// Файл: procvicovani/plan-main.js
// Описание: Главный файл оркестровки для страницы Studijního plánu.
// Отвечает за инициализацию, основные обработчики событий и координацию модулей.
// Зависит от plan-data-logic.js и plan-ui-components.js.
// Версия: 1.2 (Исправлена ошибка с деструктуризацией уведомлений)

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
		const ui = PlanApp.ui;
		console.log("[Main] Setting up main event listeners...");
		if (!ui) { console.error("[Main] UI cache not found."); return; }
		ui.planTabs?.forEach(tab => { tab.addEventListener('click', () => PlanApp.switchTab(tab.dataset.tab)); });
		if (ui.mobileMenuToggle) ui.mobileMenuToggle.addEventListener('click', PlanApp.openMenu);
		if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', PlanApp.closeMenu);
		if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', PlanApp.closeMenu);
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => { if (PlanApp.state) { PlanApp.state.isDarkMode = event.matches; if(PlanApp.updateTheme) PlanApp.updateTheme(); } });
        window.addEventListener('online', () => typeof PlanApp.updateOnlineStatus === 'function' && PlanApp.updateOnlineStatus());
        window.addEventListener('offline', () => typeof PlanApp.updateOnlineStatus === 'function' && PlanApp.updateOnlineStatus());
        window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) { if(PlanApp.closeMenu) PlanApp.closeMenu();} });
		if (ui.notificationBell) ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); });
		if (ui.markAllReadBtn && typeof PlanApp.markAllNotificationsRead === 'function') ui.markAllReadBtn.addEventListener('click', PlanApp.markAllNotificationsRead);
        else if (ui.markAllReadBtn) console.error("Core function PlanApp.markAllNotificationsRead missing!");
		if (!ui.notificationsList) console.warn("Notifications list element missing for delegation setup.");
        // Делегирование кликов по уведомлениям настроено в plan-ui-components.js
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
		const sections = [ui.currentPlanSection, ui.historyPlanSection, ui.createPlanSection, ui.planSection];
		sections.forEach(section => section?.classList.remove('visible-section'));
		const contents = [ui.currentPlanContent, ui.verticalScheduleList, ui.verticalScheduleNav, ui.planContent, ui.historyPlanContent, ui.createPlanContent];
		contents.forEach(content => content?.classList.remove('content-visible', 'schedule-visible', 'generated-reveal'));
		if (state.lastGeneratedMarkdown !== null && !['detail', 'generation'].includes(tabId) && !ui.planSection?.classList.contains('visible-section')) { console.log("[SwitchTab] Clearing generated plan state."); state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; state.lastGeneratedTopicsData = null; }
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
				if (tabId === 'current' && typeof core.loadCurrentPlan === 'function') await core.loadCurrentPlan();
				else if (tabId === 'history' && typeof core.loadPlanHistory === 'function') await core.loadPlanHistory();
				else if (tabId === 'create' && typeof core.checkPlanCreationAvailability === 'function') await core.checkPlanCreationAvailability();
				else if (!['current', 'history', 'create'].includes(tabId)) console.warn(`[SwitchTab] No load function for tab: ${tabId}`);
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

	// --- Главная функция инициализации приложения ---
	PlanApp.initializeApp = async () => {
		const ui = PlanApp.ui; const state = PlanApp.state; const core = PlanApp;
		console.log("🚀 [Init Main - Revised v2.1] Starting Plan Page Initialization...");

		// 1. Показать начальный загрузчик
		if (ui?.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
		if (ui?.mainContent) ui.mainContent.style.display = 'none';

		// 2. Инициализация Supabase
		console.log("[Init Main - Revised v2.1] Attempting to initialize Supabase...");
		if (typeof core.initializeSupabase !== 'function' || !core.initializeSupabase()) {
			console.error("FATAL: Supabase initialization failed."); if (ui?.initialLoader) ui.initialLoader.innerHTML = '<p style="color:red;">Chyba DB.</p>'; return;
		}
		console.log("[Init Main - Revised v2.1] Supabase initialized.");

		// 3. Проверка аутентификации и загрузка профиля
		try {
			if (!PlanApp.state.supabaseClient) throw new Error("Supabase client is not available after init!");
			const localSupabaseClient = PlanApp.state.supabaseClient;
			console.log("[Init Main - Revised v2.1] Checking auth session...");

			const { data: { session }, error: sessionError } = await localSupabaseClient.auth.getSession();
			if (sessionError) throw new Error(`Auth error: ${sessionError.message}`);
			if (!session || !session.user) { console.log('[Init Main - Revised v2.1] Not logged in.'); window.location.href = '/auth/index.html'; return; }
			state.currentUser = session.user;
			console.log(`[Init Main - Revised v2.1] User authenticated (ID: ${state.currentUser.id}). Loading profile...`);

			if (typeof core.fetchUserProfile !== 'function') throw new Error("fetchUserProfile missing.");
			state.currentProfile = await core.fetchUserProfile(state.currentUser.id);
			if (!state.currentProfile) throw new Error("Profil nenalezen.");
			console.log("[Init Main - Revised v2.1] Profile loaded.");

			// 4. Инициализация UI
			if (typeof PlanApp.initializeUI !== 'function') throw new Error("initializeUI missing.");
			if (!PlanApp.initializeUI()) throw new Error("UI Init failed.");

			// 5. Настройка слушателей
			if (typeof PlanApp.setupMainEventListeners !== 'function') console.warn("setupMainEventListeners missing!"); else PlanApp.setupMainEventListeners();

			// 6. Загрузка данных (Уведомления + Вкладка)
			console.log("[Init Main - Revised v2.1] Loading initial notifications and default tab...");

            // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
            const loadNotificationsPromise = (typeof core.fetchNotifications === 'function' && typeof PlanApp.renderNotifications === 'function')
                ? core.fetchNotifications(state.currentUser.id, core.config.NOTIFICATION_FETCH_LIMIT)
                    .then(result => { // Получаем весь объект result
                        if (result) { // Проверяем, что result не undefined
                            PlanApp.renderNotifications(result.unreadCount, result.notifications);
                        } else {
                            console.error("fetchNotifications returned undefined!");
                            PlanApp.renderNotifications(0, []); // Рендерим пустой список при ошибке
                        }
                    })
                    .catch(err => { console.error("Initial notification load failed:", err); if(PlanApp.renderNotifications) PlanApp.renderNotifications(0, []); })
                : Promise.resolve(console.warn("Notification functions not found."));
            // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

			const loadInitialTabPromise = typeof PlanApp.switchTab === 'function'
				? PlanApp.switchTab('current')
				: Promise.resolve(console.error("switchTab function not found!"));

			await Promise.all([loadNotificationsPromise, loadInitialTabPromise]);

			// 7. Показать контент, скрыть загрузчик
			if (ui?.mainContent) { ui.mainContent.style.display = 'flex'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); if (typeof PlanApp.initScrollAnimations === 'function') PlanApp.initScrollAnimations(); }); }
			console.log("✅ [Init Main - Revised v2.1] Plan Page Initialized Successfully.");

		} catch (error) {
			console.error("❌ [Init Main - Revised v2.1] Critical initialization error:", error);
			if (ui?.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color:red;">Chyba (${error.message}). Obnovte.</p>`; }
			else if(typeof PlanApp.showGlobalError === 'function') { PlanApp.showGlobalError(`Chyba: ${error.message}`); if (ui?.mainContent) ui.mainContent.style.display = 'flex'; }
			else { document.body.innerHTML = `<div style="color:red; padding: 20px;">Chyba: ${error.message}</div>`; }
			if(typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('all', false);
		} finally {
			if (ui?.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
		}
	};

	// --- Запуск приложения ---
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', PlanApp.initializeApp);
	} else {
		PlanApp.initializeApp();
	}

	console.log("plan-main.js loaded.");

})(); // Конец IIFE