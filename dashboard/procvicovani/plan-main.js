// Файл: procvicovani/plan-main.js
// Описание: Главный файл оркестровки для страницы Studijního plánu.
// Отвечает за инициализацию, основные обработчики событий и координацию модулей.
// Зависит от plan-core.js и plan-ui.js (которые должны быть загружены первыми и предоставлять функции через window.PlanApp).
// Версия: 1.0 (создана при разделении plan.js)

(function() { // IIFE для изоляции области видимости
	'use strict';

	// --- Проверка доступности основного объекта PlanApp ---
	if (typeof window.PlanApp === 'undefined') {
		console.error("FATAL: Не удалось инициализировать plan-main.js. Объект PlanApp не найден. Убедитесь, что plan-core.js и plan-ui.js загружены первыми.");
		// Можно отобразить пользователю критическую ошибку
		document.body.innerHTML = '<div style="color:red; padding: 20px;">Kritická chyba: Základní moduly aplikace nebyly načteny. Obnovte stránku nebo kontaktujte podporu.</div>';
		return;
	}

	// Локальная ссылка для удобства
	const PlanApp = window.PlanApp;

	// --- Инициализация Supabase ---
	// (Перенесена в plan-core.js, вызываем оттуда)

	// --- Основные обработчики событий UI (Оркестровка) ---
	PlanApp.setupMainEventListeners = () => {
		const ui = PlanApp.ui; // Получаем UI элементы из PlanApp
		console.log("[Main] Setting up main event listeners...");

		if (!ui) {
			console.error("[Main] UI cache not found in PlanApp. Cannot setup listeners.");
			return;
		}

		// Переключение вкладок
		ui.planTabs?.forEach(tab => {
			tab.addEventListener('click', () => {
				if (typeof PlanApp.switchTab === 'function') {
					PlanApp.switchTab(tab.dataset.tab);
				} else {
					console.error("PlanApp.switchTab function not found!");
				}
			});
		});

		// Общие слушатели (сайбдар, тема и т.д. - если они еще не настроены в plan-ui.js)
		if (ui.mainMobileMenuToggle && typeof PlanApp.openMenu === 'function') {
            ui.mainMobileMenuToggle.addEventListener('click', PlanApp.openMenu);
        }
		if (ui.sidebarCloseToggle && typeof PlanApp.closeMenu === 'function') {
            ui.sidebarCloseToggle.addEventListener('click', PlanApp.closeMenu);
        }
		if (ui.sidebarOverlay && typeof PlanApp.closeMenu === 'function') {
            ui.sidebarOverlay.addEventListener('click', PlanApp.closeMenu);
        }
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
			if (typeof PlanApp.updateTheme === 'function') {
                PlanApp.state.isDarkMode = event.matches; // Обновляем состояние
                PlanApp.updateTheme();
            }
		});
        window.addEventListener('online', () => typeof PlanApp.updateOnlineStatus === 'function' && PlanApp.updateOnlineStatus());
        window.addEventListener('offline', () => typeof PlanApp.updateOnlineStatus === 'function' && PlanApp.updateOnlineStatus());
        window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) { if(typeof PlanApp.closeMenu === 'function') PlanApp.closeMenu();} });

        // Слушатели для специфичных кнопок (генерация, сохранение и т.д.)
        // настраиваются в plan-ui.js или динамически при рендеринге
        // Здесь только проверяем, что основные элементы на месте
        console.log("✅ [Main] Main event listeners setup complete.");
	};

	// --- Логика переключения вкладок ---
	PlanApp.switchTab = async (tabId) => {
		const state = PlanApp.state; // Доступ к состоянию
		const ui = PlanApp.ui; // Доступ к UI
		const core = PlanApp; // Доступ к функциям из plan-core

		if (!state || !ui) {
			console.error("[SwitchTab] State or UI object not found in PlanApp.");
			return;
		}
		if (state.isLoading.current || state.isLoading.history || state.isLoading.create || state.isLoading.detail || state.isLoading.generation || state.isLoading.saving) {
			console.warn(`[SwitchTab] Blocked switching to ${tabId}, operation in progress.`);
			PlanApp.showToast('Operace stále probíhá, počkejte prosím.', 'info');
			return;
		}

		console.log(`[SwitchTab] Switching to tab: ${tabId}`);
		state.currentTab = tabId;
		ui.planTabs?.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));

		// Скрыть все основные секции
		ui.currentPlanSection?.classList.remove('visible-section');
		ui.historyPlanSection?.classList.remove('visible-section');
		ui.createPlanSection?.classList.remove('visible-section');
		ui.planSection?.classList.remove('visible-section'); // Секция для деталей/генерации

		// Скрыть специфичный контент внутри секций (для надежности)
		ui.currentPlanContent?.classList.remove('content-visible');
		ui.verticalScheduleList?.classList.remove('schedule-visible');
		ui.verticalScheduleNav?.classList.remove('nav-visible');
		ui.planContent?.classList.remove('content-visible', 'generated-reveal');
		ui.historyPlanContent?.classList.remove('content-visible');
		ui.createPlanContent?.classList.remove('content-visible');

		// Очистить состояние генерации, если покидаем секцию предпросмотра
		if (state.lastGeneratedMarkdown !== null && tabId !== 'detail' && tabId !== 'generation' && !ui.planSection?.classList.contains('visible-section')) {
			console.log("[SwitchTab] Clearing generated plan state.");
			state.lastGeneratedMarkdown = null;
			state.lastGeneratedActivitiesJson = null;
			state.lastGeneratedTopicsData = null;
		}

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

				// Вызов соответствующей функции загрузки данных из plan-core.js
				if (tabId === 'current' && typeof core.loadCurrentPlan === 'function') await core.loadCurrentPlan();
				else if (tabId === 'history' && typeof core.loadPlanHistory === 'function') await core.loadPlanHistory();
				else if (tabId === 'create' && typeof core.checkPlanCreationAvailability === 'function') await core.checkPlanCreationAvailability();
				else if (tabId !== 'current' && tabId !== 'history' && tabId !== 'create') {
					console.warn(`[SwitchTab] No specific load function defined for tab: ${tabId}`);
				}

			} else {
				console.warn(`[SwitchTab] Target section element not found for tab: ${tabId}`);
			}
		} catch (error) {
			console.error(`[SwitchTab] Error loading tab ${tabId}:`, error);
			const errorTargetSection = document.getElementById(`${tabId}PlanSection`);
			const errorContentContainer = errorTargetSection?.querySelector('.section-content');
			if(errorTargetSection) errorTargetSection.classList.add('visible-section'); // Показать секцию с ошибкой
			if (errorContentContainer && typeof PlanApp.renderMessage === 'function') {
				PlanApp.renderMessage(errorContentContainer, 'error', 'Chyba načítání', `Obsah záložky "${tabId}" nelze načíst: ${error.message}`);
			} else if(typeof PlanApp.showGlobalError === 'function') {
				PlanApp.showGlobalError(`Nepodařilo se načíst záložku "${tabId}": ${error.message}`);
			}
			// Сброс состояния загрузки для этой вкладки
			if(typeof PlanApp.setLoadingState === 'function') {
                if(tabId === 'current') { PlanApp.setLoadingState('current', false); PlanApp.setLoadingState('schedule', false); }
                if(tabId === 'history') PlanApp.setLoadingState('history', false);
                if(tabId === 'create') PlanApp.setLoadingState('create', false);
            }
		}
	};


	// --- Главная функция инициализации приложения ---
	PlanApp.initializeApp = async () => {
		const ui = PlanApp.ui; // Получаем кэш UI
		const state = PlanApp.state; // Получаем объект состояния
		const core = PlanApp; // Получаем доступ к функциям ядра

		console.log("🚀 [Init Main] Starting Plan Page Initialization...");

        // 1. Показать начальный загрузчик
        if (ui.initialLoader) {
            ui.initialLoader.style.display = 'flex';
            ui.initialLoader.classList.remove('hidden');
        }
        if (ui.mainContent) ui.mainContent.style.display = 'none'; // Скрыть контент пока грузим

		// 2. Инициализация Supabase (через core)
		if (typeof core.initializeSupabase !== 'function' || !core.initializeSupabase()) {
			console.error("FATAL: Supabase initialization failed. Cannot proceed.");
			// Показать критическую ошибку пользователю (если возможно)
			if (ui.initialLoader) ui.initialLoader.innerHTML = '<p style="color:red;">Chyba připojení k databázi.</p>';
			return; // Stop initialization
		}

        // 3. Проверка аутентификации и загрузка профиля (через core)
        try {
            console.log("[Init Main] Checking authentication session...");
            const { data: { session }, error: sessionError } = await state.supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);

            if (!session || !session.user) {
                console.log('[Init Main] Not logged in. Redirecting...');
                window.location.href = '/auth/index.html'; // Перенаправляем на логин
                return; // Stop further execution
            }
            state.currentUser = session.user;
            console.log(`[Init Main] User authenticated (ID: ${state.currentUser.id}). Loading profile...`);

            if (typeof core.fetchUserProfile !== 'function') { throw new Error("fetchUserProfile function is missing in PlanApp core."); }
            state.currentProfile = await core.fetchUserProfile(state.currentUser.id);
            if (!state.currentProfile) { throw new Error("Profil uživatele nenalezen nebo se nepodařilo načíst."); }
            console.log("[Init Main] Profile loaded:", state.currentProfile);

            // 4. Инициализация UI (через ui)
            if (typeof PlanApp.initializeUI !== 'function') { throw new Error("initializeUI function is missing in PlanApp ui."); }
            if (!PlanApp.initializeUI()) { throw new Error("UI Initialization failed."); } // Инициализируем UI и базовые слушатели

            // 5. Настройка основных слушателей событий этого файла
            PlanApp.setupMainEventListeners();

            // 6. Загрузка уведомлений и начальной вкладки (параллельно)
            console.log("[Init Main] Loading initial notifications and default tab...");
            const loadNotificationsPromise = (typeof PlanApp.fetchNotifications === 'function' && typeof PlanApp.renderNotifications === 'function')
                ? PlanApp.fetchNotifications(state.currentUser.id, config.NOTIFICATION_FETCH_LIMIT)
                    .then(({ unreadCount, notifications }) => PlanApp.renderNotifications(unreadCount, notifications))
                    .catch(err => { console.error("Initial notification load failed:", err); if(PlanApp.renderNotifications) PlanApp.renderNotifications(0, []); })
                : Promise.resolve(console.warn("Notification functions not found in PlanApp."));

            const loadInitialTabPromise = PlanApp.switchTab('current'); // Загружаем вкладку 'current' по умолчанию

            await Promise.all([loadNotificationsPromise, loadInitialTabPromise]);

            // 7. Показать основной контент и скрыть загрузчик
            if (ui.mainContent) {
                ui.mainContent.style.display = 'flex'; // Используем flex для layout
                requestAnimationFrame(() => {
                     ui.mainContent.classList.add('loaded');
                     if (typeof PlanApp.initScrollAnimations === 'function') PlanApp.initScrollAnimations();
                });
            }
            console.log("✅ [Init Main] Plan Page Initialized Successfully.");

        } catch (error) {
            console.error("❌ [Init Main] Critical initialization error:", error);
            // Показать ошибку пользователю
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) {
                ui.initialLoader.innerHTML = `<p style="color:red;">Chyba inicializace (${error.message}). Obnovte stránku.</p>`;
            } else if(typeof PlanApp.showGlobalError === 'function') {
                 PlanApp.showGlobalError(`Chyba inicializace: ${error.message}`);
                 if (ui.mainContent) ui.mainContent.style.display = 'flex'; // Показать основной контент, чтобы была видна ошибка
            } else {
                 document.body.innerHTML = `<div style="color:red; padding: 20px;">Kritická chyba: ${error.message}</div>`;
            }
            // Убедиться, что состояние загрузки сброшено
            if(typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('all', false);
        } finally {
             // Всегда скрываем начальный загрузчик
            if (ui.initialLoader) {
                ui.initialLoader.classList.add('hidden');
                setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); // Задержка для анимации
            }
        }
	};

	// --- Запуск приложения ---
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', PlanApp.initializeApp);
	} else {
		PlanApp.initializeApp();
	}

})(); // Конец IIFE