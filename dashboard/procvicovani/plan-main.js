// Файл: procvicovani/plan-main.js
// Описание: Главный файл оркестровки для страницы Studijního plánu.
// Отвечает за инициализацию, основные обработчики событий и координацию модулей.
// Зависит от plan-data-logic.js и plan-ui-components.js.
// Версия: 2.2 (Перенесена проверка зависимостей внутрь initializeApp)

(function() { // IIFE для изоляции области видимости
	'use strict';

	// --- Убрана проверка зависимостей отсюда ---

	// Локальная ссылка для удобства (предполагаем, что PlanApp уже создан предыдущими скриптами)
	const PlanApp = window.PlanApp || {}; // Обеспечиваем существование PlanApp

	// --- Основные обработчики событий UI (Оркестровка) ---
	// (Определяем функции до initializeApp, чтобы они были доступны)
    PlanApp.handleTabClick = (event) => {
        const tabId = event.currentTarget.dataset.tab;
        if (tabId && typeof PlanApp.switchTab === 'function') {
            PlanApp.switchTab(tabId);
        } else {
            console.error("Invalid tab click or switchTab function missing:", tabId);
        }
    };

    PlanApp.handleWindowResize = () => {
        const ui = PlanApp.ui; // Access ui from PlanApp
        if (window.innerWidth > 992 && ui?.sidebar?.classList.contains('active')) {
            if(PlanApp.closeMenu) PlanApp.closeMenu();
        }
    };

    PlanApp.handleThemeChange = (event) => {
        if (PlanApp.state) {
             PlanApp.state.isDarkMode = event.matches;
             if(PlanApp.updateTheme) PlanApp.updateTheme();
        }
    };

    PlanApp.toggleNotifications = (event) => {
        const ui = PlanApp.ui;
        event.stopPropagation();
        ui?.notificationsDropdown?.classList.toggle('active');
    };

    PlanApp.handleMarkAllNotificationsReadClick = async () => {
        const ui = PlanApp.ui;
        if (typeof PlanApp.markAllNotificationsRead === 'function') {
            // Disable button immediately in UI
            if (ui?.markAllReadBtn) ui.markAllReadBtn.disabled = true;
            if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('notifications', true);
            const success = await PlanApp.markAllNotificationsRead(); // Call Core logic
            // If successful, the core function should trigger a UI update (e.g., re-fetch)
            if (!success && ui?.markAllReadBtn) {
                 const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                 ui.markAllReadBtn.disabled = (currentCount === 0); // Re-enable only if failed AND there are still notifications
            }
             if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('notifications', false); // Reset loading state regardless
        } else {
            console.error("Core function PlanApp.markAllNotificationsRead missing!");
        }
    };

    PlanApp.handleNotificationItemClick = async (event) => {
        const item = event.target.closest('.notification-item');
        const ui = PlanApp.ui;
        if (item) {
            const notificationId = item.dataset.id;
            const link = item.dataset.link;
            const isRead = item.classList.contains('is-read');

            if (!isRead && notificationId && typeof PlanApp.markNotificationRead === 'function') {
                const success = await PlanApp.markNotificationRead(notificationId); // Call Core logic
                if (success && typeof PlanApp.updateNotificationReadStateUI === 'function') {
                    PlanApp.updateNotificationReadStateUI(item); // Update UI on success
                } else if (!success) {
                     console.warn("Failed to mark notification as read in DB.");
                 } else if (typeof PlanApp.updateNotificationReadStateUI !== 'function') {
                     console.error("UI function updateNotificationReadStateUI missing!");
                 }
            } else if (!isRead && notificationId) {
                 console.error("Core function PlanApp.markNotificationRead missing!");
            }

            if (link) window.location.href = link;
            ui?.notificationsDropdown?.classList.remove('active'); // Close dropdown after click
        }
    };

    // UI update after marking notification read
    PlanApp.updateNotificationReadStateUI = (itemElement) => {
         const ui = PlanApp.ui;
         if (!itemElement || !ui?.notificationCount || !ui?.markAllReadBtn) return;
         itemElement.classList.add('is-read');
         itemElement.querySelector('.unread-dot')?.remove();
         const currentCountText = ui.notificationCount.textContent.replace('+', '');
         const currentCount = parseInt(currentCountText) || 0;
         const newCount = Math.max(0, currentCount - 1);
         ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
         ui.notificationCount.classList.toggle('visible', newCount > 0);
         ui.markAllReadBtn.disabled = newCount === 0;
     };

    PlanApp.handleOutsideNotificationClick = (event) => {
        const ui = PlanApp.ui;
        if (ui?.notificationsDropdown?.classList.contains('active') &&
            !ui.notificationsDropdown.contains(event.target) &&
            !ui.notificationBell?.contains(event.target)) {
            ui.notificationsDropdown.classList.remove('active');
        }
    };

    PlanApp.handleExportVerticalClick = () => {
         const state = PlanApp.state; // Access state
         if (state?.currentStudyPlan && typeof PlanApp.exportPlanToPDFWithStyle === 'function') {
             PlanApp.exportPlanToPDFWithStyle(state.currentStudyPlan);
         } else if (!state?.currentStudyPlan) {
             if(PlanApp.showToast) PlanApp.showToast('Nelze exportovat, plán není načten.', 'warning');
         } else { console.error("PlanApp.exportPlanToPDFWithStyle function not found!"); }
     };

    // UI Trigger for Generation (calls Core)
    PlanApp.handleGenerateClick = () => {
         const state = PlanApp.state;
         if (!state || state.isLoading.generation) return;
         const genBtn = document.getElementById('generatePlanBtn'); // Find button
         if(genBtn) {
             genBtn.disabled = true;
             genBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generuji plán...';
         }
         if(typeof PlanApp.generateStudyPlan === 'function') {
             PlanApp.generateStudyPlan(); // Call core function
         } else {
             console.error("Core function generateStudyPlan missing!");
             if(genBtn) { // Reset button on error
                 genBtn.disabled = false;
                 genBtn.innerHTML = '<i class="fas fa-cogs"></i> Vygenerovat nový plán';
             }
              if(typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('generation', false); // Ensure loading stops
         }
     };

     // UI Trigger for Saving (calls Core)
     PlanApp.handleSaveGeneratedPlanClick = () => {
         const saveButton = document.getElementById('saveGeneratedPlanBtn');
         if (saveButton) {
             saveButton.disabled = true;
             saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...';
         }
         if(typeof PlanApp.handleSaveGeneratedPlanClick === 'function') { // Check if CORE function exists
             PlanApp.handleSaveGeneratedPlanClick(); // Call CORE function
         } else {
             console.error("Core function handleSaveGeneratedPlanClick missing!");
             if (saveButton) { // Reset button on error
                 saveButton.disabled = false;
                 saveButton.innerHTML = '<i class="fas fa-save"></i> Uložit tento plán';
             }
             if(typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('saving', false); // Ensure loading stops
         }
     };

    PlanApp.setupMainEventListeners = () => {
		const ui = PlanApp.ui; // Access cached UI elements
		console.log("[Main] Setting up main event listeners...");
		if (!ui) { console.error("[Main] UI cache not found during listener setup."); return; }

		// Tabs
		ui.planTabs?.forEach(tab => {
            tab.removeEventListener('click', PlanApp.handleTabClick); // Remove previous listener if any
            tab.addEventListener('click', PlanApp.handleTabClick);
        });

        // Sidebar Toggles
		if (ui.mobileMenuToggle) {
            ui.mobileMenuToggle.removeEventListener('click', PlanApp.openMenu);
            ui.mobileMenuToggle.addEventListener('click', PlanApp.openMenu);
        } else { console.warn("[Main] Mobile menu toggle not found."); }

		if (ui.sidebarCloseToggle) {
            ui.sidebarCloseToggle.removeEventListener('click', PlanApp.closeMenu);
            ui.sidebarCloseToggle.addEventListener('click', PlanApp.closeMenu);
        } else { console.warn("[Main] Sidebar close toggle not found."); }

		if (ui.sidebarOverlay) {
            ui.sidebarOverlay.removeEventListener('click', PlanApp.closeMenu);
            ui.sidebarOverlay.addEventListener('click', PlanApp.closeMenu);
        } else { console.warn("[Main] Sidebar overlay not found."); }

        // Generic Back Button (Listener set dynamically by UI module)
        if (!ui.genericBackBtn) { console.warn("[Main] Generic back button not found."); }

        // Vertical Schedule Export Button
        if (ui.exportScheduleBtnVertical) {
            ui.exportScheduleBtnVertical.removeEventListener('click', PlanApp.handleExportVerticalClick);
            ui.exportScheduleBtnVertical.addEventListener('click', PlanApp.handleExportVerticalClick);
        } else { console.warn("[Main] Vertical export button not found."); }

        // Schedule Interaction (Delegation in UI module)
        if (!ui.verticalScheduleList) { console.warn("[Main] Vertical schedule list not found for delegation setup check."); }

		// Window / Global Listeners
		window.removeEventListener('resize', PlanApp.handleWindowResize);
        window.addEventListener('resize', PlanApp.handleWindowResize);
		window.removeEventListener('online', PlanApp.updateOnlineStatus);
        window.addEventListener('online', PlanApp.updateOnlineStatus);
        window.removeEventListener('offline', PlanApp.updateOnlineStatus);
		window.addEventListener('offline', PlanApp.updateOnlineStatus);
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', PlanApp.handleThemeChange);
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', PlanApp.handleThemeChange);

		// Notifications
		if (ui.notificationBell) {
            ui.notificationBell.removeEventListener('click', PlanApp.toggleNotifications);
            ui.notificationBell.addEventListener('click', PlanApp.toggleNotifications);
        } else { console.warn("[Main] Notification bell not found."); }

		if (ui.markAllReadBtn) {
            ui.markAllReadBtn.removeEventListener('click', PlanApp.handleMarkAllNotificationsReadClick);
            ui.markAllReadBtn.addEventListener('click', PlanApp.handleMarkAllNotificationsReadClick);
        } else { console.warn("[Main] Mark all read button not found."); }

        if (ui.notificationsList) {
            ui.notificationsList.removeEventListener('click', PlanApp.handleNotificationItemClick); // Remove old before adding
            ui.notificationsList.addEventListener('click', PlanApp.handleNotificationItemClick); // Use delegation
        } else { console.warn("[Main] Notifications list not found for delegation setup."); }

        // Close dropdown on outside click
        document.removeEventListener('click', PlanApp.handleOutsideNotificationClick);
		document.addEventListener('click', PlanApp.handleOutsideNotificationClick);

		console.log("✅ [Main] Main event listeners setup complete.");
	};

	// --- Логика переключения вкладок (Оркестровка) ---
	PlanApp.switchTab = async (tabId) => {
        // Check dependencies at the start of a major action
        if (typeof PlanApp.state === 'undefined' || typeof PlanApp.ui === 'undefined' || typeof PlanApp.config === 'undefined') {
            console.error("[SwitchTab] FATAL: PlanApp state, ui or config not available.");
            return; // Stop execution if core parts are missing
        }
        const state = PlanApp.state;
        const ui = PlanApp.ui;

		if (Object.values(state.isLoading).some(loading => loading)) {
			console.warn(`[SwitchTab] Blocked switching to ${tabId}, operation in progress.`);
			if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Operace stále probíhá, počkejte prosím.', 'info', 2000);
			return;
		}
		console.log(`[SwitchTab] Switching to tab: ${tabId}`);
		state.currentTab = tabId;

		// --- UI Updates (Should be in UI module, but kept here for now) ---
		ui.planTabs?.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));
		const sections = [ui.currentPlanSection, ui.historyPlanSection, ui.createPlanSection, ui.planSection];
		sections.forEach(section => section?.classList.remove('visible-section'));
		const contents = [ui.currentPlanContent, ui.verticalScheduleList, ui.verticalScheduleNav, ui.planContent, ui.historyPlanContent, ui.createPlanContent];
		contents.forEach(content => content?.classList.remove('content-visible', 'schedule-visible', 'generated-reveal'));
		// --- End UI Updates ---

		if (state.lastGeneratedMarkdown !== null && !['detail', 'generation'].includes(tabId) && !ui.planSection?.classList.contains('visible-section')) {
			console.log("[SwitchTab] Clearing generated plan state (navigating away from preview).");
			state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; state.lastGeneratedTopicsData = null;
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
				// Call CORE data loading functions
				let loadSuccess = false; let checkResult = null;
				if (tabId === 'current' && typeof PlanApp.loadCurrentPlan === 'function') { loadSuccess = await PlanApp.loadCurrentPlan(); if (!loadSuccess) console.warn("[SwitchTab] loadCurrentPlan indicated failure."); }
                else if (tabId === 'history' && typeof PlanApp.loadPlanHistory === 'function') { await PlanApp.loadPlanHistory(); }
                else if (tabId === 'create' && typeof PlanApp.checkPlanCreationAvailability === 'function') { checkResult = await PlanApp.checkPlanCreationAvailability(); /* UI module will render based on checkResult */ }
                else if (!['current', 'history', 'create'].includes(tabId)) { console.warn(`[SwitchTab] No specific load function defined for tab: ${tabId}`); }
                else { throw new Error(`Core function missing for tab: ${tabId}`); }
			} else { throw new Error(`UI Section not found for tab ${tabId}`); }
		} catch (error) {
			console.error(`[SwitchTab] Error loading tab ${tabId}:`, error);
			// --- Error UI Handling ---
			const errorTargetSection = document.getElementById(`${tabId}PlanSection`); const errorContentContainer = errorTargetSection?.querySelector('.section-content');
			if(errorTargetSection) errorTargetSection.classList.add('visible-section');
			if (errorContentContainer && typeof PlanApp.renderMessage === 'function') PlanApp.renderMessage(errorContentContainer, 'error', 'Chyba načítání', `Obsah záložky "${tabId}" nelze načíst: ${error.message}`);
			else if(typeof PlanApp.showGlobalError === 'function') PlanApp.showGlobalError(`Nepodařilo se načíst záložku "${tabId}": ${error.message}`);
			if(typeof PlanApp.setLoadingState === 'function') { /* Reset loading states */ }
            // --- End Error UI Handling ---
		}
	};

	// --- Главная функция инициализации приложения (Оркестровка) ---
	PlanApp.initializeApp = async () => {
		console.log("🚀 [Init Main - v2.2 Orchestrator] Starting Plan Page Initialization...");

         // --- ПРОВЕРКА ЗАВИСИМОСТЕЙ ВНУТРИ initializeApp ---
         if (typeof PlanApp === 'undefined' || typeof PlanApp.state === 'undefined' || typeof PlanApp.config === 'undefined' || typeof PlanApp.ui === 'undefined') {
             console.error("FATAL: Не удалось инициализировать plan-main.js. Отсутствуют необходимые компоненты PlanApp (state, config, ui) при запуске initializeApp.");
             document.body.innerHTML = '<p style="color:red;">Kritická chyba: Základní moduly aplikace nebyly správně načteny. Obnovte stránku nebo kontaktujte podporu.</p>';
             return; // Stop initialization
         }
         console.log("[Init Main] Dependencies (state, config, ui) confirmed.");
         const ui = PlanApp.ui;
         const state = PlanApp.state;
         // --- КОНЕЦ ПРОВЕРКИ ---

		// 1. Показать начальный загрузчик
		if (ui?.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden');}
		if (ui?.mainContent) ui.mainContent.style.display = 'none';

		// 2. Инициализация Supabase (Core)
		if (typeof PlanApp.initializeSupabase !== 'function' || !PlanApp.initializeSupabase()) {
			console.error("FATAL: Supabase initialization failed."); if (ui?.initialLoader) ui.initialLoader.innerHTML = '<p style="color:red;">Chyba DB.</p>'; return;
		}

		// 3. Проверка аутентификации и загрузка профиля (Core)
		try {
			if (!state.supabaseClient) throw new Error("Supabase client is not available after init!");
			console.log("[Init Main] Checking auth session...");
			const { data: { session }, error: sessionError } = await state.supabaseClient.auth.getSession();
			if (sessionError) throw new Error(`Auth error: ${sessionError.message}`);
			if (!session || !session.user) { console.log('[Init Main] Not logged in.'); window.location.href = '/auth/index.html'; return; }
			state.currentUser = session.user;
			console.log(`[Init Main] User authenticated (ID: ${state.currentUser.id}). Loading profile...`);

			if (typeof PlanApp.fetchUserProfile !== 'function') throw new Error("Core fetchUserProfile missing.");
			state.currentProfile = await PlanApp.fetchUserProfile(state.currentUser.id);
			if (!state.currentProfile) throw new Error("Profil nenalezen.");
			console.log("[Init Main] Profile loaded via Core.");

			// 4. Инициализация UI (Components) - включает кэширование UI
			if (typeof PlanApp.initializeUI !== 'function') throw new Error("UI initializeUI missing.");
			if (!PlanApp.initializeUI()) throw new Error("UI Initialization failed."); // initializeUI returns true/false

			// 5. Настройка слушателей (Main)
			if (typeof PlanApp.setupMainEventListeners !== 'function') console.warn("setupMainEventListeners missing!"); else PlanApp.setupMainEventListeners();

			// 6. Загрузка данных (Уведомления + Вкладка по умолчанию 'current')
			console.log("[Init Main] Loading initial notifications and default tab...");
            const loadNotificationsPromise = (typeof PlanApp.fetchNotifications === 'function' && typeof PlanApp.renderNotifications === 'function')
                ? PlanApp.fetchNotifications(state.currentUser.id, PlanApp.config.NOTIFICATION_FETCH_LIMIT)
                    .then(result => PlanApp.renderNotifications(result.unreadCount, result.notifications))
                    .catch(err => { console.error("Initial notification load failed:", err); if(PlanApp.renderNotifications) PlanApp.renderNotifications(0, []); })
                : Promise.resolve(console.warn("Notification functions not found."));

			const loadInitialTabPromise = typeof PlanApp.switchTab === 'function'
				? PlanApp.switchTab('current') // Load default tab
				: Promise.resolve(console.error("switchTab function not found!"));

			await Promise.all([loadNotificationsPromise, loadInitialTabPromise]);

			// 7. Показать контент, скрыть загрузчик
			if (ui?.mainContent) { ui.mainContent.style.display = 'flex'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); if (typeof PlanApp.initScrollAnimations === 'function') PlanApp.initScrollAnimations(); }); }
			console.log("✅ [Init Main - v2.2] Plan Page Initialized Successfully.");

		} catch (error) {
			console.error("❌ [Init Main] Critical initialization error:", error);
			if (ui?.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color:red;">Chyba (${error.message}). Obnovte.</p>`; }
			else if(typeof PlanApp.showGlobalError === 'function') { PlanApp.showGlobalError(`Chyba: ${error.message}`); if (ui?.mainContent) ui.mainContent.style.display = 'flex'; }
			else { document.body.innerHTML = `<div style="color:red; padding: 20px;">Chyba: ${error.message}</div>`; }
			if(typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('all', false);
		} finally {
			if (ui?.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
		}
	};

	// --- Запуск приложения ---
	if (window.PlanApp) { // Проверяем наличие PlanApp перед добавлением слушателя
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', PlanApp.initializeApp);
        } else {
            // Убедимся, что предыдущие скрипты успели выполниться, добавив микро-задержку
            setTimeout(PlanApp.initializeApp, 0);
        }
    } else {
         console.error("FATAL: PlanApp not defined globally when setting up DOMContentLoaded listener. Cannot start the application.");
         // Можно добавить fallback отображение ошибки здесь
    }

	console.log("plan-main.js loaded.");

})(); // Конец IIFE