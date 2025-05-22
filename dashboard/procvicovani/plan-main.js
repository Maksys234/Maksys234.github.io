// Файл: procvicovani/plan-main.js
// Описание: Главный файл оркестровки для страницы Studijního plánu.
// Отвечает за инициализацию, основные обработчики событий и координацию модулей.
// Зависит от plan-data-logic.js и plan-ui-components.js.
// Версия: 2.2 (Исправлена проверка инициализации PlanApp.ui)

(function() { // IIFE для изоляции области видимости
	'use strict';

	const PlanApp = window.PlanApp;

	PlanApp.setupMainEventListeners = () => {
		const ui = PlanApp.ui;
		console.log("[Main] Setting up main event listeners...");
		if (!ui) { console.error("[Main] UI cache not found during listener setup."); return; }

		ui.planTabs?.forEach(tab => {
            tab.removeEventListener('click', PlanApp.handleTabClick);
            tab.addEventListener('click', PlanApp.handleTabClick);
        });

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

        if (!ui.genericBackBtn) { console.warn("[Main] Generic back button not found."); }

        if (ui.exportScheduleBtnVertical) {
            ui.exportScheduleBtnVertical.removeEventListener('click', PlanApp.handleExportVerticalClick);
            ui.exportScheduleBtnVertical.addEventListener('click', PlanApp.handleExportVerticalClick);
        } else { console.warn("[Main] Vertical export button not found."); }

        if (!ui.verticalScheduleList) { console.warn("[Main] Vertical schedule list not found for delegation setup check."); }

		window.removeEventListener('resize', PlanApp.handleWindowResize);
        window.addEventListener('resize', PlanApp.handleWindowResize);

		window.removeEventListener('online', PlanApp.updateOnlineStatus);
        window.addEventListener('online', PlanApp.updateOnlineStatus);

        window.removeEventListener('offline', PlanApp.updateOnlineStatus);
		window.addEventListener('offline', PlanApp.updateOnlineStatus);

        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', PlanApp.handleThemeChange);
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', PlanApp.handleThemeChange);

		if (ui.notificationBell) {
            ui.notificationBell.removeEventListener('click', PlanApp.toggleNotifications);
            ui.notificationBell.addEventListener('click', PlanApp.toggleNotifications);
        } else { console.warn("[Main] Notification bell not found."); }

		if (ui.markAllReadBtn) {
            ui.markAllReadBtn.removeEventListener('click', PlanApp.handleMarkAllNotificationsReadClick);
            ui.markAllReadBtn.addEventListener('click', PlanApp.handleMarkAllNotificationsReadClick);
        } else { console.warn("[Main] Mark all read button not found."); }

        if (ui.notificationsList) {
            ui.notificationsList.removeEventListener('click', PlanApp.handleNotificationItemClick);
            ui.notificationsList.addEventListener('click', PlanApp.handleNotificationItemClick);
        } else { console.warn("[Main] Notifications list not found for delegation setup."); }

        document.removeEventListener('click', PlanApp.handleOutsideNotificationClick);
		document.addEventListener('click', PlanApp.handleOutsideNotificationClick);

		console.log("✅ [Main] Main event listeners setup complete.");
	};

    PlanApp.handleTabClick = (event) => {
        const tabId = event.currentTarget.dataset.tab;
        if (tabId && typeof PlanApp.switchTab === 'function') {
            PlanApp.switchTab(tabId);
        } else {
            console.error("Invalid tab click or switchTab function missing:", tabId);
        }
    };

    PlanApp.handleWindowResize = () => {
        const ui = PlanApp.ui;
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
            if (ui?.markAllReadBtn) ui.markAllReadBtn.disabled = true;
            if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('notifications', true);
            const success = await PlanApp.markAllNotificationsRead();
            if (!success && ui?.markAllReadBtn) {
                 ui.markAllReadBtn.disabled = (parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0') === 0);
            }
             if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('notifications', false);
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
                const success = await PlanApp.markNotificationRead(notificationId);
                if (success && typeof PlanApp.updateNotificationReadStateUI === 'function') {
                    PlanApp.updateNotificationReadStateUI(item);
                } else if (!success) {
                     console.warn("Failed to mark notification as read in DB.");
                 } else if (typeof PlanApp.updateNotificationReadStateUI !== 'function') {
                     console.error("UI function updateNotificationReadStateUI missing!");
                 }
            } else if (!isRead && notificationId) {
                 console.error("Core function PlanApp.markNotificationRead missing!");
            }

            if (link) window.location.href = link;
            ui?.notificationsDropdown?.classList.remove('active');
        }
    };

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
         const state = PlanApp.state;
         if (state.currentStudyPlan && typeof PlanApp.exportPlanToPDFWithStyle === 'function') {
             PlanApp.exportPlanToPDFWithStyle(state.currentStudyPlan);
         } else if (!state.currentStudyPlan) {
             if(PlanApp.showToast) PlanApp.showToast('Nelze exportovat, plán není načten.', 'warning');
         } else { console.error("PlanApp.exportPlanToPDFWithStyle function not found!"); }
     };

    PlanApp.handleGenerateClick = () => {
         const state = PlanApp.state;
         if (state.isLoading.generation) return;
         const genBtn = document.getElementById('generatePlanBtn');
         if(genBtn) {
             genBtn.disabled = true;
             genBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generuji plán...';
         }
         if(typeof PlanApp.generateStudyPlan === 'function') {
             PlanApp.generateStudyPlan();
         } else {
             console.error("Core function generateStudyPlan missing!");
             if(genBtn) {
                 genBtn.disabled = false;
                 genBtn.innerHTML = '<i class="fas fa-cogs"></i> Vygenerovat nový plán';
             }
         }
     };

     PlanApp.handleSaveGeneratedPlanClick = () => {
         const saveButton = document.getElementById('saveGeneratedPlanBtn');
         if (saveButton) {
             saveButton.disabled = true;
             saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...';
         }
         // ВНИМАНИЕ: Здесь была ошибка в вашем коде, вы проверяли typeof PlanApp.handleSaveGeneratedPlanClick,
         // что привело бы к бесконечной рекурсии, если бы функция не была определена в PlanApp.
         // Предполагается, что основная логика сохранения находится в PlanApp.saveGeneratedPlanCoreLogic() или подобной функции.
         // Для данного исправления, я предполагаю, что вы хотели вызвать функцию сохранения из PlanApp.
         // Если такой функции нет в plan-core.js, ее нужно будет добавить или изменить логику здесь.
         // ПРЕДПОЛОЖИМ, что функция ядра называется PlanApp.saveGeneratedPlanCore
         if(typeof PlanApp.saveGeneratedPlanCore === 'function') {
             PlanApp.saveGeneratedPlanCore(); // Вызов функции ядра для сохранения
         } else {
             console.error("Core function for saving plan (e.g., PlanApp.saveGeneratedPlanCore) missing!");
             if (saveButton) {
                 saveButton.disabled = false;
                 saveButton.innerHTML = '<i class="fas fa-save"></i> Uložit tento plán';
             }
             // Сообщить пользователю об ошибке
             if (typeof PlanApp.showToast === 'function') {
                PlanApp.showToast('Chyba', 'Funkce pro uložení plánu nebyla nalezena.', 'error');
             }
         }
     };

	PlanApp.switchTab = async (tabId) => {
        if (typeof PlanApp.state === 'undefined' || typeof PlanApp.ui === 'undefined') {
            console.error("[SwitchTab] FATAL: PlanApp state or ui not available.");
            return;
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

		ui.planTabs?.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));
		const sections = [ui.currentPlanSection, ui.historyPlanSection, ui.createPlanSection, ui.planSection];
		sections.forEach(section => section?.classList.remove('visible-section'));
		const contents = [ui.currentPlanContent, ui.verticalScheduleList, ui.verticalScheduleNav, ui.planContent, ui.historyPlanContent, ui.createPlanContent];
		contents.forEach(content => content?.classList.remove('content-visible', 'schedule-visible', 'generated-reveal'));

		if (state.lastGeneratedMarkdown !== null && !['detail', 'generation'].includes(tabId) && !ui.planSection?.classList.contains('visible-section')) {
			console.log("[SwitchTab] Clearing generated plan state (navigating away from preview).");
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
				let loadSuccess = false;
				if (tabId === 'current' && typeof PlanApp.loadCurrentPlan === 'function') {
					loadSuccess = await PlanApp.loadCurrentPlan();
                    if (!loadSuccess) {
                        console.warn("[SwitchTab] loadCurrentPlan indicated failure.");
                    }
				} else if (tabId === 'history' && typeof PlanApp.loadPlanHistory === 'function') {
					await PlanApp.loadPlanHistory();
				} else if (tabId === 'create' && typeof PlanApp.checkPlanCreationAvailability === 'function') {
					await PlanApp.checkPlanCreationAvailability();
				} else if (!['current', 'history', 'create'].includes(tabId)) {
                    console.warn(`[SwitchTab] No specific load function defined for tab: ${tabId}`);
                } else {
                    console.error(`[SwitchTab] Core function missing for tab: ${tabId}`);
                    throw new Error(`Missing core function for tab ${tabId}`);
                }
			} else {
				console.warn(`[SwitchTab] Target section element not found for tab: ${tabId}`);
                throw new Error(`UI Section not found for tab ${tabId}`);
			}
		} catch (error) {
			console.error(`[SwitchTab] Error loading tab ${tabId}:`, error);
			const errorTargetSection = document.getElementById(`${tabId}PlanSection`);
			const errorContentContainer = errorTargetSection?.querySelector('.section-content');
			if(errorTargetSection) errorTargetSection.classList.add('visible-section');
			if (errorContentContainer && typeof PlanApp.renderMessage === 'function') {
				PlanApp.renderMessage(errorContentContainer, 'error', 'Chyba načítání', `Obsah záložky "${tabId}" nelze načíst: ${error.message}`);
			} else if(typeof PlanApp.showGlobalError === 'function') {
				PlanApp.showGlobalError(`Nepodařilo se načíst záložku "${tabId}": ${error.message}`);
			}
			if(typeof PlanApp.setLoadingState === 'function') {
				if(tabId === 'current') { PlanApp.setLoadingState('current', false); PlanApp.setLoadingState('schedule', false); }
				if(tabId === 'history') PlanApp.setLoadingState('history', false);
				if(tabId === 'create') PlanApp.setLoadingState('create', false);
			}
		}
	};

	PlanApp.initializeApp = async () => {
		console.log("🚀 [Init Main - v2.2 Orchestrator] Starting Plan Page Initialization...");

        // Check for PlanApp, state, and config first (these are set by plan-core.js)
        if (typeof PlanApp === 'undefined' || typeof PlanApp.state === 'undefined' || typeof PlanApp.config === 'undefined') {
            console.error("FATAL: PlanApp or its core state/config are undefined at initializeApp start.");
            document.body.innerHTML = '<p style="color:red;">Kritická chyba aplikace (stav/konfigurace). Obnovte stránku.</p>';
            return;
        }
        const state = PlanApp.state; // Safe to access PlanApp.state now

        const uiInitialLoader = document.getElementById('initial-loader');
        const uiMainContent = document.getElementById('main-content');

		if (uiInitialLoader) { uiInitialLoader.style.display = 'flex'; uiInitialLoader.classList.remove('hidden');}
		if (uiMainContent) uiMainContent.style.display = 'none';


		console.log("[Init Main] Attempting to initialize Supabase via Core...");
		if (typeof PlanApp.initializeSupabase !== 'function' || !PlanApp.initializeSupabase()) {
			console.error("FATAL: Supabase initialization failed."); if (uiInitialLoader) uiInitialLoader.innerHTML = '<p style="color:red;">Chyba DB.</p>'; return;
		}
		console.log("[Init Main] Supabase initialized via Core.");

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

            console.log("[Init Main] Attempting to initialize UI via UI module...");
			if (typeof PlanApp.initializeUI !== 'function') {
                throw new Error("UI initializeUI function is missing from PlanApp (expected in plan-ui.js).");
            }
			if (!PlanApp.initializeUI()) {
                throw new Error("UI Initialization failed (initializeUI returned false).");
            }
            const ui = PlanApp.ui; // Now it's safe to assign/use PlanApp.ui
            if (typeof ui === 'undefined') {
                 throw new Error("PlanApp.ui is still undefined after calling initializeUI.");
            }
            console.log("[Init Main] UI initialized successfully via UI module. PlanApp.ui is now populated.");

			if (typeof PlanApp.setupMainEventListeners !== 'function') { // This function is defined in this file
                console.warn("setupMainEventListeners function missing in PlanApp (expected in plan-main.js)!");
            } else {
                PlanApp.setupMainEventListeners();
            }

			if (ui.initialLoader) {
                 ui.initialLoader.classList.add('hidden');
                 setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500);
            }
            if (ui.mainContent) {
                ui.mainContent.style.display = 'flex';
                requestAnimationFrame(() => {
                    if (ui.mainContent) ui.mainContent.classList.add('loaded');
                    if (typeof PlanApp.initScrollAnimations === 'function') PlanApp.initScrollAnimations();
                });
            }
            // Дальнейшая логика инициализации, если UI успешно загружен
            if (typeof PlanApp.updateUserInfoUI === 'function') PlanApp.updateUserInfoUI(); // Update sidebar with profile

            if (typeof PlanApp.fetchNotifications === 'function' && typeof PlanApp.renderNotifications === 'function') {
                 PlanApp.fetchNotifications(state.currentUser.id, PlanApp.config.NOTIFICATION_FETCH_LIMIT)
                    .then(result => PlanApp.renderNotifications(result.unreadCount, result.notifications))
                    .catch(err => { console.error("Initial notification load failed:", err); if(PlanApp.renderNotifications) PlanApp.renderNotifications(0, []); });
            } else { console.warn("Notification functions (fetch/render) not found.");}


            if (typeof PlanApp.switchTab === 'function') {
                PlanApp.switchTab('current'); // Load default tab after UI and everything else is ready
            } else { console.error("PlanApp.switchTab is not defined!");}


		} catch (error) {
			console.error("❌ [Init Main] Critical initialization error:", error);
			if (uiInitialLoader && !uiInitialLoader.classList.contains('hidden')) {
                uiInitialLoader.innerHTML = `<p style="color:red;">Chyba (${error.message}). Obnovte.</p>`;
            } else if (document.getElementById('global-error') && typeof PlanApp.showGlobalError === 'function' ) {
                PlanApp.showGlobalError(`Chyba: ${error.message}`);
                if (uiMainContent) uiMainContent.style.display = 'flex';
            } else {
                 document.body.innerHTML = `<div style="color:red; padding: 20px;">Chyba: ${error.message}</div>`;
            }
			if(typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('all', false);
		} finally {
            console.log("[Init Main] InitializeApp finally block finished.");
            // Ensure loader is hidden
            if (document.body.innerHTML.includes("Kritická chyba aplikace")) {
                // Do nothing
            } else if (uiInitialLoader && !uiInitialLoader.innerHTML.includes("Chyba")) {
                if (!uiInitialLoader.classList.contains('hidden')) {
                     uiInitialLoader.classList.add('hidden');
                }
                // Ensure it's hidden even if other steps in `finally` are slow
                // Use a slightly longer timeout to be safe
                setTimeout(() => {
                     const finalLoaderCheck = document.getElementById('initial-loader');
                     if (finalLoaderCheck) finalLoaderCheck.style.display = 'none';
                }, 600);
            }
		}
	};

	if (window.PlanApp && typeof window.PlanApp.initializeApp === 'function') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', PlanApp.initializeApp);
        } else {
            PlanApp.initializeApp();
        }
    } else {
         console.error("FATAL: PlanApp or PlanApp.initializeApp not defined globally. Cannot start application.");
         document.body.innerHTML = '<p style="color:red;">Kritická chyba aplikace (plan-main.js). Obnovte stránku.</p>';
    }

	console.log("plan-main.js loaded.");

})();