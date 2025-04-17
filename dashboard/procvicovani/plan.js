(function() { // IIFE для изоляции области видимости
    'use strict';

    // ==============================================
    //          Конфигурация
    // ==============================================
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabaseClient = null;
    const GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // !!! БЕЗОПАСНОСТЬ: Переместить на сервер !!!
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const PLAN_GENERATION_COOLDOWN_DAYS = 7; // Кулдаун для генерации плана
    const NOTIFICATION_FETCH_LIMIT = 5; // Max notifications to show in dropdown

    // ==============================================
    //          DOM Элементы (Кэш)
    // ==============================================
    const ui = {
         initialLoader: document.getElementById('initial-loader'),
         mainContent: document.getElementById('main-content'),
         sidebar: document.getElementById('sidebar'),
         sidebarOverlay: document.getElementById('sidebar-overlay'),
         mobileMenuToggle: document.getElementById('mobile-menu-toggle'),
         sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
         userName: document.getElementById('user-name'),
         userAvatar: document.getElementById('user-avatar'),
         userRole: document.getElementById('user-role'),
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
         planSection: document.getElementById('planSection'), // Section for plan detail/generation result
         planLoading: document.getElementById('planLoading'), // Loader specific to plan detail/generation
         planSectionTitle: document.getElementById('plan-section-title'), // Title for detail/generated plan
         planContent: document.getElementById('planContent'), // Markdown display area
         planActions: document.getElementById('planActions'), // Action buttons for generated plan
         genericBackBtn: document.getElementById('genericBackBtn'), // Back button within plan detail/generation view
         verticalScheduleList: document.getElementById('vertical-schedule-list'), // Container for vertical schedule
         verticalScheduleNav: document.getElementById('verticalScheduleNav'), // Nav bar for vertical schedule
         exportScheduleBtnVertical: document.getElementById('exportScheduleBtnVertical'), // Export button for vertical schedule
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

    // ==============================================
    //          Глобальное Состояние
    // ==============================================
    let state = {
        currentUser: null, currentProfile: null, latestDiagnosticData: null,
        currentStudyPlan: null, previousPlans: [], planCreateAllowed: false,
        nextPlanCreateTime: null, planTimerInterval: null, currentTab: 'current',
        lastGeneratedMarkdown: null, lastGeneratedActivitiesJson: null,
        isLoading: { current: false, history: false, create: false, detail: false, schedule: false, generation: false, notifications: false },
        topicMap: { 1: "Čísla a aritmetické operace", 2: "Algebra", 3: "Geometrie", 4: "Práce s daty", 5: "Problémové úlohy", 6: "Proporce a procenta", 7: "Logické úlohy" } // Basic topic map
    };

     // Visuals for activity types (used in schedule rendering)
     const activityVisuals = {
         test: { name: 'Test', icon: 'fa-vial', class: 'test' },
         exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' },
         badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' },
         diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' },
         lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' },
         plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' },
         level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' },
         review: { name: 'Opakování', icon: 'fa-history', class: 'review' }, // Added review type
         analysis: { name: 'Analýza', icon: 'fa-chart-pie', class: 'analysis' }, // Added analysis type
         other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' },
         default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
     };

    // ==============================================
    //          Помощники (Утилиты)
    // ==============================================
    const formatDate = (dateString) => { if(!dateString) return '-'; try { const date = new Date(dateString); return date.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch(e){ return '-'}};
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } };
    const sanitizeHTML = (str) => { const t = document.createElement('div'); t.textContent = str || ''; return t.innerHTML; };
    const getInitials = (profileData, email) => { if (!profileData && !email) return '?'; let i = ''; if (profileData?.first_name) i += profileData.first_name[0]; if (profileData?.last_name) i += profileData.last_name[0]; if (i) return i.toUpperCase(); if (profileData?.username) return profileData.username[0].toUpperCase(); if (email) return email[0].toUpperCase(); return 'Pilot'; }; // Default to Pilot
    const openMenu = () => { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } };
    const closeMenu = () => { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } };
    const initTooltips = () => { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } };
    const showGlobalError = (message) => { if(ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i><div>${sanitizeHTML(message)}</div></div>`; ui.globalError.style.display = 'block';} };
    const hideGlobalError = () => { if(ui.globalError) ui.globalError.style.display = 'none'; };
    const formatRelativeTime = (timestamp) => { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
    const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); };
    const updateOnlineStatus = () => { /* Offline banner not present in plan.html */ };

    // Управление состоянием загрузки секций
    const setLoadingState = (sectionKey, isLoadingFlag) => {
        if (state.isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;
        if (sectionKey === 'all') { Object.keys(state.isLoading).forEach(key => state.isLoading[key] = isLoadingFlag); }
        else { state.isLoading[sectionKey] = isLoadingFlag; }
        console.log(`[Loading] ${sectionKey}: ${isLoadingFlag}`);

        const loaderMap = { current: ui.currentPlanLoader, history: ui.historyLoader, create: ui.createPlanLoader, detail: ui.planLoading, schedule: ui.currentPlanLoader, generation: ui.planLoading, notifications: null };
        const contentMap = { current: ui.currentPlanContent, history: ui.historyPlanContent, create: ui.createPlanContent, detail: ui.planContent, schedule: ui.verticalScheduleList, notifications: ui.notificationsList };
        const navMap = { schedule: ui.verticalScheduleNav }; // Only schedule has a specific nav bar
        const sectionMap = { current: ui.currentPlanSection, history: ui.historyPlanSection, create: ui.createPlanSection, detail: ui.planSection };
        const emptyMap = { notifications: ui.noNotificationsMsg };

        const sectionsToUpdate = sectionKey === 'all' ? Object.keys(loaderMap) : [sectionKey];

        sectionsToUpdate.forEach(key => {
            const loader = loaderMap[key];
            const content = contentMap[key];
            const nav = navMap[key];
            const section = sectionMap[key];
            const emptyState = emptyMap[key];

            if (loader) loader.classList.toggle('visible-loader', isLoadingFlag);
            if (section) section.classList.toggle('loading', isLoadingFlag); // Add loading class to the section itself

            if (isLoadingFlag) {
                if (content) content.classList.remove('content-visible', 'schedule-visible'); // Hide content
                if (nav) nav.classList.remove('nav-visible'); // Hide nav bar
                if (emptyState) emptyState.style.display = 'none'; // Hide empty state message

                // Specific rendering for skeletons during loading
                 if (key === 'history' && ui.historyPlanContent) renderHistorySkeletons(3);
                 if (key === 'schedule' && ui.verticalScheduleList) {
                     ui.verticalScheduleList.classList.add('schedule-visible'); // Keep schedule list visible for skeletons
                     ui.verticalScheduleList.innerHTML = `
                         <div class="skeleton day-card-skeleton"> <div class="skeleton day-header-skeleton"></div> <div class="skeleton activity-item-skeleton"><div class="skeleton activity-checkbox-skeleton"></div><div class="skeleton activity-content-skeleton"><div class="skeleton activity-title-skeleton"></div><div class="skeleton activity-meta-skeleton"></div></div></div> <div class="skeleton activity-item-skeleton"><div class="skeleton activity-checkbox-skeleton"></div><div class="skeleton activity-content-skeleton"><div class="skeleton activity-title-skeleton" style="width: 60%;"></div></div></div> </div>
                         <div class="skeleton day-card-skeleton"> <div class="skeleton day-header-skeleton" style="width: 50%;"></div> <div class="skeleton activity-item-skeleton"><div class="skeleton activity-checkbox-skeleton"></div><div class="skeleton activity-content-skeleton"><div class="skeleton activity-title-skeleton" style="width: 70%;"></div></div></div> </div>`;
                 }
                 if (key === 'notifications' && ui.notificationsList) { renderNotificationSkeletons(2); }
            } else {
                // After loading, visibility is handled by render functions (they add 'content-visible' or 'schedule-visible')
                if (key === 'history' && ui.historyPlanContent) {
                    // If loading finished and history content is empty (no items rendered), clear skeletons
                    if (!ui.historyPlanContent.querySelector('.history-item') && !ui.historyPlanContent.querySelector('.notest-message')) {
                         ui.historyPlanContent.innerHTML = '';
                    }
                }
            }

            // Show/hide plan detail action buttons based on loading state
            if (key === 'detail' || key === 'generation') {
                if (ui.planActions) ui.planActions.style.display = isLoadingFlag ? 'none' : 'flex';
            }

            // Handle notification bell opacity and mark all read button state
             if (key === 'notifications' && ui.notificationBell) {
                 ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                 if (ui.markAllReadBtn) {
                     const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                     ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
                 }
             }
        });
    };

    // Рендеринг сообщений (добавляет content-visible)
    const renderMessage = (container, type = 'info', title, message, addButtons = []) => {
        if (!container) { console.error("renderMessage: Container not found!"); return; }
        console.log(`[RenderMessage] Rendering into:`, container.id, `Type: ${type}, Title: ${title}`);
        const iconMap = { info: 'fa-info-circle', warning: 'fa-exclamation-triangle', error: 'fa-exclamation-circle' };
        let buttonsHTML = '';
        addButtons.forEach(btn => {
            buttonsHTML += `<button class="btn ${btn.class || 'btn-primary'}" id="${btn.id}" ${btn.disabled ? 'disabled' : ''}>${btn.icon ? `<i class="fas ${btn.icon}"></i> ` : ''}${btn.text}</button>`;
        });
        // Wrap in the message container
        container.innerHTML = `<div class="notest-message ${type}"><h3><i class="fas ${iconMap[type]}"></i> ${sanitizeHTML(title)}</h3><p>${sanitizeHTML(message)}</p><div class="action-buttons">${buttonsHTML}</div></div>`;
        container.classList.add('content-visible'); // Make the container visible

        // Attach listeners AFTER inserting into DOM
        addButtons.forEach(btn => {
            const btnElement = container.querySelector(`#${btn.id}`);
            if (btnElement && btn.onClick) {
                btnElement.addEventListener('click', btn.onClick);
            }
        });
    };

    // ==============================================
    //          Инициализация и Навигация
    // ==============================================
    const initializeSupabase = () => { try { if (!window.supabase) throw new Error("Supabase library not loaded."); supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey); console.log("Supabase client initialized."); return true; } catch (error) { console.error("Supabase init failed:", error); showGlobalError("Chyba připojení k databázi."); return false; } };
    const setupEventListeners = () => {
         console.log("[SETUP] Setting up event listeners...");
         if (ui.mobileMenuToggle) ui.mobileMenuToggle.addEventListener('click', openMenu);
         if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
         if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
         ui.planTabs.forEach(tab => { tab.addEventListener('click', () => switchTab(tab.dataset.tab)); });
         if (ui.genericBackBtn) { ui.genericBackBtn.addEventListener('click', () => { switchTab(state.currentTab || 'current'); }); }
         if (ui.exportScheduleBtnVertical) { ui.exportScheduleBtnVertical.addEventListener('click', () => { if (state.currentStudyPlan) exportPlanToPDFWithStyle(state.currentStudyPlan); else showToast('Nelze exportovat, plán není načten.', 'warning'); }); }
         window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) closeMenu(); });

        // Event Delegation for Vertical Schedule
         const scheduleContainer = ui.verticalScheduleList;
         if (scheduleContainer) {
             scheduleContainer.addEventListener('click', (event) => {
                 const expandButton = event.target.closest('.expand-icon-button');
                 const header = event.target.closest('.day-header');
                 const titleArea = event.target.closest('.activity-title-time');
                 const checkboxLabel = event.target.closest('.activity-checkbox');

                 if (checkboxLabel || event.target.tagName === 'INPUT') { return; } // Ignore clicks on checkbox itself

                 if (expandButton || titleArea) {
                     const activityElement = (expandButton || titleArea).closest('.activity-list-item');
                     const descElement = activityElement?.querySelector('.activity-desc');
                      // Only toggle if there is description text
                      if (activityElement && descElement && descElement.textContent.trim()) {
                           activityElement.classList.toggle('expanded');
                           console.log("Toggled activity description for:", activityElement.dataset.activityId);
                      }
                 }
                 else if (header) { // Toggle day card expansion
                     const dayCard = header.closest('.day-schedule-card');
                     if (dayCard) {
                         dayCard.classList.toggle('expanded');
                         console.log("Toggled day card:", dayCard.querySelector('.day-header').textContent.trim().split('\n')[0]);
                     }
                 }
             });

             // Listener for checkbox changes
             scheduleContainer.addEventListener('change', async (event) => {
                 if (event.target.type === 'checkbox' && event.target.closest('.activity-checkbox')) {
                      const checkbox = event.target;
                      const activityId = checkbox.dataset.activityId;
                      const planId = checkbox.dataset.planId;
                      const isCompleted = checkbox.checked;
                      const activityElement = checkbox.closest('.activity-list-item');
                      console.log(`Checkbox changed for activity ${activityId}, completed: ${isCompleted}`);
                      if (activityElement) { activityElement.classList.toggle('completed', isCompleted); }
                      await handleActivityCompletionToggle(activityId, isCompleted, planId);
                 }
             });
         } else {
             console.warn("Vertical schedule container not found for event delegation.");
         }

         // Notification Listeners
         if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
         if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); }
         if (ui.notificationsList) {
             ui.notificationsList.addEventListener('click', async (event) => {
                 const item = event.target.closest('.notification-item');
                 if (item) {
                     const notificationId = item.dataset.id;
                     const link = item.dataset.link;
                     const isRead = item.classList.contains('is-read');
                     if (!isRead && notificationId) {
                         const success = await markNotificationRead(notificationId);
                         if (success) {
                             item.classList.add('is-read');
                             item.querySelector('.unread-dot')?.remove();
                             // Update badge count
                             const currentCountText = ui.notificationCount.textContent.replace('+', '');
                             const currentCount = parseInt(currentCountText) || 0;
                             const newCount = Math.max(0, currentCount - 1);
                             ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                             ui.notificationCount.classList.toggle('visible', newCount > 0);
                             if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0;
                         }
                     }
                     if (link) { window.location.href = link; }
                 }
             });
         }
          // Close notification dropdown on outside click
          document.addEventListener('click', (event) => {
             if (ui.notificationsDropdown?.classList.contains('active') &&
                 !ui.notificationsDropdown.contains(event.target) &&
                 !ui.notificationBell?.contains(event.target)) {
                 ui.notificationsDropdown.classList.remove('active');
             }
         });

         console.log("✅ [SETUP] Event listeners set up.");
    };
    const initializeApp = async () => {
         console.log("🚀 [Init Plan] Starting...");
         if (!initializeSupabase()) return;
         if(ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden');}
         if (ui.mainContent) ui.mainContent.style.display = 'none';
         hideGlobalError();
         try {
             const { data: { user }, error } = await supabaseClient.auth.getUser();
             if (error) throw new Error("Nepodařilo se ověřit uživatele.");
             if (!user) { window.location.href = '/auth/index.html'; return; } // Redirect if not logged in
             state.currentUser = user;
             state.currentProfile = await fetchUserProfile(user.id); // Fetch profile
             updateUserInfoUI(); // Update sidebar
             setupEventListeners(); // Setup all event listeners
             initTooltips(); // Initialize tooltips
             initMouseFollower(); // Initialize cyberpunk mouse effect
             initHeaderScrollDetection(); // Initialize header scroll effect
             updateCopyrightYear(); // Update footer year

             // Load Notifications first or concurrently
             const loadNotificationsPromise = fetchNotifications(user.id, NOTIFICATION_FETCH_LIMIT)
                 .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                 .catch(err => {
                     console.error("Failed to load notifications initially:", err);
                     renderNotifications(0, []); // Show empty state on error
                 });

             // Load the default ('current') tab data
             const loadInitialTabPromise = switchTab('current'); // Default to 'current' tab

             // Wait for both to settle
             await Promise.all([loadNotificationsPromise, loadInitialTabPromise]);

             // Show main content after initial data attempts
             if (ui.mainContent) {
                 ui.mainContent.style.display = 'block';
                 // Use requestAnimationFrame for smoother fade-in
                 requestAnimationFrame(() => {
                     ui.mainContent.classList.add('loaded');
                     initScrollAnimations(); // Start scroll animations
                 });
             }
             console.log("✅ [Init Plan] Page Initialized.");
         } catch (error) {
             console.error("App initialization error:", error);
             showGlobalError(`Chyba inicializace: ${error.message}`);
             if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show main content to display error
             const errorContainer = document.getElementById('currentPlanContent') || ui.mainContent;
             if(errorContainer) renderMessage(errorContainer, 'error', 'Chyba inicializace', error.message);
         } finally {
             // Hide loader once everything is done (or failed)
             if (ui.initialLoader) {
                 ui.initialLoader.classList.add('hidden');
                 setTimeout(() => { if(ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); // Match CSS transition
             }
         }
    };
    const fetchUserProfile = async (userId) => { if (!userId || !supabaseClient) return null; try { const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', userId).single(); if (error && error.code !== 'PGRST116') throw error; return data; } catch (e) { console.error("Profile fetch error:", e); return null; } };
    const updateUserInfoUI = () => { if (ui.userName && ui.userAvatar) { const name = `${state.currentProfile?.first_name || ''} ${state.currentProfile?.last_name || ''}`.trim() || state.currentProfile?.username || state.currentUser?.email?.split('@')[0] || 'Pilot'; ui.userName.textContent = name; const initials = getInitials(state.currentProfile, state.currentUser?.email); ui.userAvatar.innerHTML = state.currentProfile?.avatar_url ? `<img src="${state.currentProfile.avatar_url}?t=${Date.now()}" alt="Avatar">` : initials; } }; // Added cache busting

    // Corrected Tab Switching
    const switchTab = async (tabId) => {
        if (!supabaseClient) { showGlobalError("Aplikace není správně inicializována."); return; }
        console.log(`[NAV] Switching to tab: ${tabId}`);
        state.currentTab = tabId;
        ui.planTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));

        // Hide all sections first
        ui.currentPlanSection?.classList.remove('visible-section');
        ui.historyPlanSection?.classList.remove('visible-section');
        ui.createPlanSection?.classList.remove('visible-section');
        ui.planSection?.classList.remove('visible-section'); // Hide detail section too

        hideGlobalError(); // Clear previous global errors

        try {
            let targetSection = null;
            // Determine the correct section based on tabId
            if (tabId === 'current') targetSection = ui.currentPlanSection;
            else if (tabId === 'history') targetSection = ui.historyPlanSection;
            else if (tabId === 'create') targetSection = ui.createPlanSection;

            if (targetSection) {
                targetSection.classList.add('visible-section'); // Make the target section visible

                // Load content for the selected tab
                if (tabId === 'current') await loadCurrentPlan();
                else if (tabId === 'history') await loadPlanHistory();
                else if (tabId === 'create') await checkPlanCreationAvailability();

            } else {
                console.warn(`[NAV] No section defined for tab: ${tabId}`);
            }
        } catch (error) {
            console.error(`[NAV] Error loading tab ${tabId}:`, error);
            const errorTargetSection = document.getElementById(`${tabId}PlanSection`);
            const errorContentContainer = document.getElementById(`${tabId}PlanContent`) || errorTargetSection?.querySelector('.section-content');

            if(errorTargetSection) errorTargetSection.classList.add('visible-section'); // Ensure section is visible to show error

            if (errorContentContainer) {
                renderMessage(errorContentContainer, 'error', 'Chyba načítání', `Obsah záložky "${tabId}" nelze načíst: ${error.message}`);
            } else {
                showGlobalError(`Nepodařilo se načíst záložku "${tabId}": ${error.message}`);
            }
            // Ensure loading state is reset for the failed tab
            if(tabId === 'current') setLoadingState('current', false);
            if(tabId === 'history') setLoadingState('history', false);
            if(tabId === 'create') setLoadingState('create', false);
            if(tabId === 'current') setLoadingState('schedule', false); // Reset schedule loading if current failed
        }
    };

    // ==============================================
    //          Уведомления (Notification Logic)
    // ==============================================
     async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) { if (!supabaseClient || !userId) { console.error("[Notifications] Missing Supabase client or User ID."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Fetching unread notifications for user ${userId}`); setLoadingState('notifications', true); try { const { data, error, count } = await supabaseClient.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; console.log(`[Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } finally { setLoadingState('notifications', false); } }
     function renderNotifications(count, notifications) { console.log("[Render Notifications] Start, Count:", count, "Notifications:", notifications); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements."); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.toggle('has-content', notifications && notifications.length > 0); console.log("[Render Notifications] Finished"); }
     function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
     async function markNotificationRead(notificationId) { console.log("[Notifications] Marking notification as read:", notificationId); if (!state.currentUser || !notificationId) return false; try { const { error } = await supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[Notifications] Mark as read successful for ID:", notificationId); return true; } catch (error) { console.error("[Notifications] Mark as read error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
     async function markAllNotificationsRead() { console.log("[Notifications] Marking all as read for user:", state.currentUser?.id); if (!state.currentUser || !ui.markAllReadBtn) return; setLoadingState('notifications', true); try { const { error } = await supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('is_read', false); if (error) throw error; console.log("[Notifications] Mark all as read successful"); const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[Notifications] Mark all as read error:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); } finally { setLoadingState('notifications', false); } }

    // ==============================================
    //          Актуальный План (Vertical Layout)
    // ==============================================
     const loadCurrentPlan = async () => { if (!supabaseClient || !state.currentUser) return; console.log("[CurrentPlan] Loading current plan..."); setLoadingState('current', true); setLoadingState('schedule', true); if (ui.currentPlanContent) { ui.currentPlanContent.innerHTML = ''; ui.currentPlanContent.classList.remove('content-visible'); } if (ui.verticalScheduleList) { ui.verticalScheduleList.innerHTML = ''; ui.verticalScheduleList.classList.remove('schedule-visible'); } if (ui.verticalScheduleNav) { ui.verticalScheduleNav.classList.remove('nav-visible'); } try { const { data: plans, error } = await supabaseClient.from('study_plans').select('*').eq('user_id', state.currentUser.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1); if (error) throw error; console.log("[CurrentPlan] Fetched plans:", plans); if (plans && plans.length > 0) { state.currentStudyPlan = plans[0]; console.log("[CurrentPlan] Active plan found:", state.currentStudyPlan.id); await showVerticalSchedule(state.currentStudyPlan); } else { state.currentStudyPlan = null; console.log("[CurrentPlan] No active plan found. Checking diagnostic..."); setLoadingState('schedule', false); // Stop schedule loading as there's no plan
 const diagnostic = await getLatestDiagnostic(false); if (diagnostic === null) { renderMessage(ui.currentPlanContent, 'error', 'Chyba načítání diagnostiky', 'Nepodařilo se ověřit stav vašeho diagnostického testu.'); } else if (diagnostic) { renderPromptCreatePlan(ui.currentPlanContent); } else { renderNoActivePlan(ui.currentPlanContent); } } } catch (error) { console.error("[CurrentPlan] Error loading current plan:", error); renderMessage(ui.currentPlanContent, 'error', 'Chyba', 'Nepodařilo se načíst aktuální studijní plán.'); setLoadingState('schedule', false); } finally { setLoadingState('current', false); console.log("[CurrentPlan] Loading finished."); } };
     const renderPromptCreatePlan = (container) => { if (!container || !ui.promptCreatePlanTemplate) return; console.log("[Render] Rendering Prompt Create Plan..."); const node = ui.promptCreatePlanTemplate.content.cloneNode(true); const btn = node.getElementById('createNewPlanFromPromptBtn'); if (btn) btn.addEventListener('click', () => switchTab('create')); container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); console.log("[Render] Prompt Create Plan Rendered."); };
     const renderNoActivePlan = (container) => { if (!container || !ui.noActivePlanTemplate) return; console.log("[Render] Rendering No Active Plan..."); const node = ui.noActivePlanTemplate.content.cloneNode(true); const link = node.querySelector('.link-to-create-tab'); if (link) link.addEventListener('click', (e) => { e.preventDefault(); switchTab('create'); }); container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); console.log("[Render] No Active Plan Rendered."); };
     const showVerticalSchedule = async (plan) => { if (!supabaseClient || !plan || !plan.id) { console.error("[ShowVertical] Invalid plan data."); if(ui.currentPlanContent) renderMessage(ui.currentPlanContent, 'error', 'Chyba plánu', 'Nelze zobrazit detaily plánu.'); setLoadingState('schedule', false); return; } console.log(`[ShowVertical] Displaying schedule for Plan ID ${plan.id}`); if (ui.currentPlanContent) ui.currentPlanContent.classList.remove('content-visible'); // Hide messages
 try { const { data: activities, error } = await supabaseClient.from('plan_activities').select('*').eq('plan_id', plan.id).order('day_of_week').order('time_slot'); if (error) throw error; console.log(`[ShowVertical] Fetched ${activities?.length ?? 0} activities.`); renderVerticalSchedule(activities || [], plan.id); if (ui.verticalScheduleList) ui.verticalScheduleList.classList.add('schedule-visible'); if (ui.verticalScheduleNav) ui.verticalScheduleNav.classList.add('nav-visible'); } catch (error) { console.error("[ShowVertical] Error fetching activities:", error); if(ui.currentPlanContent) renderMessage(ui.currentPlanContent, 'error', 'Chyba Harmonogramu', 'Nepodařilo se načíst aktivity.'); if(ui.verticalScheduleList) ui.verticalScheduleList.classList.remove('schedule-visible'); if(ui.verticalScheduleNav) ui.verticalScheduleNav.classList.remove('nav-visible'); } finally { setLoadingState('schedule', false); initTooltips(); } };
     const renderVerticalSchedule = (activities, planId) => { const days = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota']; const todayIndex = new Date().getDay(); const listContainer = ui.verticalScheduleList; if (!listContainer) { console.error("[RenderVertical] Container #vertical-schedule-list not found!"); return; } listContainer.innerHTML = ''; if (!Array.isArray(activities)) activities = []; const activitiesByDay = {}; for (let i = 0; i <= 6; i++) { activitiesByDay[i] = []; } activities.forEach(act => { if (activitiesByDay[act.day_of_week] !== undefined) activitiesByDay[act.day_of_week].push(act); }); console.log("[RenderVertical] Grouped activities:", activitiesByDay); const daysOrder = [1, 2, 3, 4, 5, 6, 0]; let hasAnyActivity = false; daysOrder.forEach(dayIndex => { const dayActivities = activitiesByDay[dayIndex].sort((a, b) => (a.time_slot || '99:99').localeCompare(b.time_slot || '99:99')); const dayName = days[dayIndex]; const isToday = dayIndex === todayIndex; const dayCard = document.createElement('div'); dayCard.className = `day-schedule-card ${isToday ? 'today' : ''}`; // Always start expanded for now, can be changed
 dayCard.classList.add('expanded'); // Start expanded
 const dayHeader = document.createElement('div'); dayHeader.className = 'day-header'; dayHeader.innerHTML = `${dayName} ${isToday ? '<span>(Dnes)</span>' : ''}<i class="fas fa-chevron-down day-expand-icon"></i>`; dayCard.appendChild(dayHeader); const activitiesContainer = document.createElement('div'); activitiesContainer.className = 'activity-list-container'; if (dayActivities.length > 0) { hasAnyActivity = true; dayActivities.forEach(activity => { if (!activity.id) return; const activityElement = document.createElement('div'); activityElement.className = `activity-list-item ${activity.completed ? 'completed' : ''}`; activityElement.dataset.activityId = activity.id; const timeDisplay = activity.time_slot ? `<span class="activity-time-display">${activity.time_slot}</span>` : ''; const iconClass = getActivityIcon(activity.title); const hasDescription = activity.description && activity.description.trim().length > 0; const expandIcon = hasDescription ? `<button class="expand-icon-button" aria-label="Rozbalit popis"><i class="fas fa-chevron-down expand-icon"></i></button>` : ''; activityElement.innerHTML = `<label class="activity-checkbox"><input type="checkbox" id="vertical-activity-${activity.id}" ${activity.completed ? 'checked' : ''} data-activity-id="${activity.id}" data-plan-id="${planId}"></label><i class="fas ${iconClass} activity-icon"></i><div class="activity-details"><div class="activity-header"><div class="activity-title-time"><span class="activity-title">${sanitizeHTML(activity.title || 'Aktivita')}</span>${timeDisplay}</div>${expandIcon}</div>${hasDescription ? `<div class="activity-desc">${sanitizeHTML(activity.description)}</div>` : ''}</div>`; activitiesContainer.appendChild(activityElement); }); } else { activitiesContainer.innerHTML = `<div class="no-activities-day">Žádné aktivity pro tento den.</div>`; } dayCard.appendChild(activitiesContainer); listContainer.appendChild(dayCard); }); if (!hasAnyActivity) { console.log("[RenderVertical] No activities found in the entire plan."); listContainer.innerHTML = '<div class="no-activities-day" style="padding: 2rem; border: none;">Pro tento plán nebyly nalezeny žádné aktivity.</div>'; } console.log("[RenderVertical] Vertical schedule rendering logic complete."); };
     const handleActivityCompletionToggle = async (activityId, isCompleted, planId) => { if (!supabaseClient) return; try { const { error } = await supabaseClient.from('plan_activities').update({ completed: isCompleted, updated_at: new Date().toISOString() }).eq('id', activityId); if (error) throw error; console.log(`[ActivityToggle] Aktivita ${activityId} stav: ${isCompleted}`); await updatePlanProgress(planId); } catch (error) { console.error(`[ActivityToggle] Chyba aktualizace aktivity ${activityId}:`, error); showToast('Nepodařilo se aktualizovat stav aktivity.', 'error'); const checkbox = document.getElementById(`vertical-activity-${activityId}`); const activityElement = document.querySelector(`.activity-list-item[data-activity-id="${activityId}"]`); if(checkbox) checkbox.checked = !isCompleted; if(activityElement) activityElement.classList.toggle('completed', !isCompleted); } };
     const updatePlanProgress = async (planId) => { if (!planId || !supabaseClient) return; console.log(`[PlanProgress] Updating progress for plan ${planId}`); try { const { count: totalCount, error: countError } = await supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId); const { count: completedCount, error: completedError } = await supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId).eq('completed', true); if (countError || completedError) throw countError || completedError; const numTotal = totalCount ?? 0; const numCompleted = completedCount ?? 0; const progress = numTotal > 0 ? Math.round((numCompleted / numTotal) * 100) : 0; console.log(`[PlanProgress] Plan ${planId}: ${numCompleted}/${numTotal} completed (${progress}%)`); const { error: updateError } = await supabaseClient.from('study_plans').update({ progress: progress, updated_at: new Date().toISOString() }).eq('id', planId); if (updateError) throw updateError; console.log(`[PlanProgress] Plan ${planId} progress DB updated to ${progress}%`); if (state.currentStudyPlan?.id === planId) state.currentStudyPlan.progress = progress; } catch (error) { console.error(`[PlanProgress] Error updating plan progress ${planId}:`, error); } };
     const getActivityIcon = (title = '') => { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('test')) return 'fa-vial'; if (lowerTitle.includes('cvičení') || lowerTitle.includes('příklad') || lowerTitle.includes('úloh')) return 'fa-pencil-alt'; if (lowerTitle.includes('opakování') || lowerTitle.includes('shrnutí')) return 'fa-history'; if (lowerTitle.includes('geometrie')) return 'fa-draw-polygon'; if (lowerTitle.includes('algebra')) return 'fa-square-root-alt'; if (lowerTitle.includes('procent')) return 'fa-percentage'; if (lowerTitle.includes('analýza') || lowerTitle.includes('kontrola')) return 'fa-search'; // Example for analysis
 if (lowerTitle.includes('lekce') || lowerTitle.includes('teorie')) return 'fa-book-open'; // Example for lesson
 return 'fa-tasks'; }; // Default

    // ==============================================
    //          История Планов
    // ==============================================
    const loadPlanHistory = async () => { if (!supabaseClient || !state.currentUser) return; setLoadingState('history', true); if(ui.historyPlanContent) ui.historyPlanContent.classList.remove('content-visible'); try { const { data: plans, error } = await supabaseClient.from('study_plans').select('id, title, created_at, status, progress').eq('user_id', state.currentUser.id).order('created_at', { ascending: false }); if (error) throw error; state.previousPlans = plans || []; renderPlanHistory(state.previousPlans); } catch (error) { console.error("Error loading plan history:", error); renderMessage(ui.historyPlanContent, 'error', 'Chyba', 'Nepodařilo se načíst historii plánů.'); } finally { setLoadingState('history', false); } };
    const renderPlanHistory = (plans) => { if (!ui.historyPlanContent) return; if (!plans || plans.length === 0) { renderMessage(ui.historyPlanContent, 'info', 'Žádná historie', 'Zatím jste nevytvořili žádné studijní plány.'); return; } ui.historyPlanContent.innerHTML = ''; ui.historyPlanContent.style.display = 'grid'; plans.forEach(plan => { const node = ui.historyItemTemplate.content.cloneNode(true); const item = node.querySelector('.history-item'); if(item) { item.dataset.planId = plan.id; item.classList.add(plan.status || 'inactive'); const dateEl = item.querySelector('.history-date'); const titleEl = item.querySelector('.history-title'); const progressEl = item.querySelector('.history-progress'); const statusEl = item.querySelector('.history-status'); if(dateEl) dateEl.textContent = `Vytvořeno: ${formatDate(plan.created_at)}`; if(titleEl) titleEl.textContent = plan.title || "Studijní plán"; if(progressEl) progressEl.innerHTML = `Pokrok: <strong>${plan.progress ?? 0}%</strong>`; if(statusEl) { const statusText = plan.status === 'active' ? 'Aktivní' : plan.status === 'completed' ? 'Dokončený' : 'Neaktivní'; statusEl.textContent = statusText; statusEl.className = `history-status ${plan.status || 'inactive'}`; } item.addEventListener('click', () => showPlanDetail(plan)); ui.historyPlanContent.appendChild(node); } }); ui.historyPlanContent.classList.add('content-visible'); };
    const renderHistorySkeletons = (count) => { if (!ui.historyPlanContent) return; ui.historyPlanContent.innerHTML = ''; if (count === 0) { ui.historyPlanContent.classList.remove('content-visible'); ui.historyPlanContent.style.display = 'none'; return; } ui.historyPlanContent.style.display = 'grid'; ui.historyPlanContent.classList.add('content-visible'); let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="skeleton history-item-skeleton"><div class="skeleton text-sm" style="width: 40%;"></div><div class="skeleton title-sm" style="width: 80%; height: 16px;"></div><div class="skeleton text-sm" style="width: 50%;"></div></div>`; } ui.historyPlanContent.innerHTML = skeletonHTML; };
    const showPlanDetail = async (plan) => { if (!plan || !plan.id || !supabaseClient) return; ui.currentPlanSection.classList.remove('visible-section'); ui.historyPlanSection.classList.remove('visible-section'); ui.createPlanSection.classList.remove('visible-section'); ui.planSection.classList.add('visible-section'); setLoadingState('detail', true); if(ui.planContent) ui.planContent.classList.remove('content-visible'); if(ui.planActions) ui.planActions.innerHTML = ''; if(ui.planSectionTitle) ui.planSectionTitle.textContent = 'Načítání detailu...'; if (ui.genericBackBtn) ui.genericBackBtn.onclick = () => switchTab('history'); try { // Fetch full markdown content if it's not already available
 if (!plan.plan_content_markdown) { console.log("Načítám plný markdown pro detail..."); const { data: fullData, error: fetchError } = await supabaseClient.from('study_plans').select('plan_content_markdown, title, created_at, estimated_completion_date').eq('id', plan.id).single(); if (fetchError) throw fetchError; plan = { ...plan, ...fullData }; } if(ui.planSectionTitle) ui.planSectionTitle.textContent = plan.title || 'Detail studijního plánu'; const metaDateEl = document.getElementById('plan-meta-date'); if (metaDateEl) metaDateEl.textContent = `Vytvořeno: ${formatDate(plan.created_at)}`; displayPlanContent(plan.plan_content_markdown || '# Studijní plán\n\nObsah plánu není k dispozici.'); if(ui.planActions) { ui.planActions.innerHTML = `<button class="btn btn-success btn-tooltip" id="exportDetailPlanBtn" title="Stáhnout plán jako PDF"><i class="fas fa-file-pdf"></i> Export PDF</button>`; const exportButton = ui.planActions.querySelector('#exportDetailPlanBtn'); if(exportButton) exportButton.addEventListener('click', () => exportPlanToPDFWithStyle(plan)); ui.planActions.style.display = 'flex'; } ui.planSection.scrollIntoView({ behavior: 'smooth' }); initTooltips(); } catch (error) { console.error("Chyba načítání detailu plánu:", error); renderMessage(ui.planContent, 'error', 'Chyba', 'Nepodařilo se načíst detail plánu.'); if(ui.planActions) ui.planActions.innerHTML = ''; } finally { setLoadingState('detail', false); } };

    // ==============================================
    //          Создание Плана
    // ==============================================
    const getLatestDiagnostic = async (showLoaderFlag = true) => { if (!state.currentUser || !supabaseClient) return null; if (showLoaderFlag) setLoadingState('create', true); try { console.log("[getLatestDiagnostic] Fetching diagnostic..."); const { data, error } = await supabaseClient.from('user_diagnostics').select('id, completed_at, total_score, total_questions, topic_results, analysis').eq('user_id', state.currentUser.id).order('completed_at', { ascending: false }).limit(1); if (error) throw error; console.log("[getLatestDiagnostic] Fetched:", data); return (data && data.length > 0) ? data[0] : false; } catch (error) { console.error("Error fetching diagnostic:", error); return null; } finally { if (showLoaderFlag) setLoadingState('create', false); } };

    const checkPlanCreationAvailability = async () => { console.log("[CreateCheck] Starting check..."); setLoadingState('create', true); if(ui.createPlanContent) ui.createPlanContent.classList.remove('content-visible'); try { console.log("[CreateCheck] Fetching latest diagnostic..."); state.latestDiagnosticData = await getLatestDiagnostic(false); console.log("[CreateCheck] Diagnostic fetched:", state.latestDiagnosticData); if (state.latestDiagnosticData === null) { renderMessage(ui.createPlanContent, 'error', 'Chyba', 'Nepodařilo se ověřit váš diagnostický test.'); return; } else if (state.latestDiagnosticData === false) { renderNoDiagnosticAvailable(ui.createPlanContent); return; } console.log("[CreateCheck] Checking cooldown..."); const { data: latestPlan, error: planError } = await supabaseClient.from('study_plans').select('created_at').eq('user_id', state.currentUser.id).order('created_at', { ascending: false }).limit(1); if (planError) throw planError; console.log("[CreateCheck] Cooldown check - Latest plan:", latestPlan); let canCreate = true; if (latestPlan && latestPlan.length > 0) { const lastPlanDate = new Date(latestPlan[0].created_at); const cooldownDate = new Date(lastPlanDate); cooldownDate.setDate(cooldownDate.getDate() + PLAN_GENERATION_COOLDOWN_DAYS); console.log("[CreateCheck] Cooldown date:", cooldownDate, "Current date:", new Date()); if (new Date() < cooldownDate) { canCreate = false; state.nextPlanCreateTime = cooldownDate; } } state.planCreateAllowed = canCreate; if (!ui.createPlanContent) { console.error("[CreateCheck] Error: createPlanContent container not found!"); showGlobalError("Chyba zobrazení: Chybí element pro vytvoření plánu."); return; } if (canCreate) { renderPlanCreationForm(ui.createPlanContent); } else { renderLockedPlanSection(ui.createPlanContent); } } catch (error) { console.error('[CreateCheck] Error checking plan creation availability:', error); if(ui.createPlanContent) renderMessage(ui.createPlanContent, 'error', 'Chyba', 'Nepodařilo se ověřit možnost vytvoření plánu.'); else showGlobalError('Nepodařilo se ověřit možnost vytvoření plánu: ' + error.message); } finally { setLoadingState('create', false); console.log("[CreateCheck] Check finished."); } };

    const renderNoDiagnosticAvailable = (container) => { if (!container || !ui.noDiagnosticTemplate) return; console.log("[Render] Rendering No Diagnostic Available..."); const node = ui.noDiagnosticTemplate.content.cloneNode(true); const btn = node.getElementById('goToTestBtn'); if(btn) btn.onclick = () => window.location.href = '/dashboard/procvicovani/test1.html'; container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); console.log("[Render] No Diagnostic Available Rendered."); };
    const renderLockedPlanSection = (container) => { if(!container || !ui.lockedPlanTemplate) return; console.log("[Render] Rendering Locked Plan Section..."); const node = ui.lockedPlanTemplate.content.cloneNode(true); const timerEl = node.getElementById('nextPlanTimer'); const viewBtn = node.getElementById('viewCurrentPlanBtnLocked'); if(timerEl) updateNextPlanTimer(timerEl); if(viewBtn) viewBtn.addEventListener('click', () => switchTab('current')); container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); startPlanTimer(); console.log("[Render] Locked Plan Section Rendered."); };
    const startPlanTimer = () => { if (state.planTimerInterval) clearInterval(state.planTimerInterval); state.planTimerInterval = setInterval(() => { const timerEl = document.getElementById('nextPlanTimer'); if (timerEl && document.body.contains(timerEl)) updateNextPlanTimer(timerEl); else clearInterval(state.planTimerInterval); }, 1000); };
    const updateNextPlanTimer = (el) => { if (!state.nextPlanCreateTime || !el) return; const now = new Date(); const diff = state.nextPlanCreateTime - now; if (diff <= 0) { el.textContent = 'Nyní'; clearInterval(state.planTimerInterval); state.planCreateAllowed = true; if(state.currentTab === 'create') setTimeout(checkPlanCreationAvailability, 500); return; } const d = Math.floor(diff/(1000*60*60*24)), h = Math.floor((diff%(1000*60*60*24))/(1000*60*60)), m = Math.floor((diff%(1000*60*60))/(1000*60)), s = Math.floor((diff%(1000*60))/1000); el.textContent = `${d}d ${h}h ${m}m ${s}s`; };

    // Render the form to create a new plan
    const renderPlanCreationForm = (container) => {
         if (!container || !ui.createPlanFormTemplate || !state.latestDiagnosticData) {
             console.error("[Render] Missing container, CreatePlan template, or diagnostic data.");
             renderMessage(container, 'error', 'Chyba', 'Nelze zobrazit formulář pro vytvoření plánu.');
             return;
         }
         console.log("[Render] Rendering Plan Creation Form...");
         const node = ui.createPlanFormTemplate.content.cloneNode(true);

         // Populate diagnostic info
         const diagInfo = node.getElementById('diagnosticInfo');
         if (diagInfo) {
             const score = state.latestDiagnosticData.total_score ?? '-';
             const totalQ = state.latestDiagnosticData.total_questions ?? '-'; // Assuming total_questions exists
             diagInfo.innerHTML = `<p>Plán bude vycházet z testu ze dne: <strong>${formatDate(state.latestDiagnosticData.completed_at)}</strong> (Skóre: ${score}/${totalQ})</p>`;
         } else {
             console.warn("[Render] Diagnostic info element not found in template.");
         }

         // Find and attach listener to the GENERATE button within the CLONED NODE
         const genBtnTemplate = node.querySelector('#generatePlanBtn');
         if (genBtnTemplate) {
             console.log("[Render] Button #generatePlanBtn found in template clone.");
             genBtnTemplate.addEventListener('click', handleGenerateClick); // Use helper function
         } else {
             console.error("[Render] Button #generatePlanBtn NOT FOUND in template clone!");
         }

         container.innerHTML = ''; // Clear the target container
         container.appendChild(node); // Append the cloned content

         // Verify button in DOM after appending (for debugging)
         const buttonInDOM = container.querySelector('#generatePlanBtn');
         if (!buttonInDOM) {
             console.error("❌ [Render] Button #generatePlanBtn NOT FOUND in container's DOM after append!");
         } else {
             console.log("✅ [Render] Button #generatePlanBtn VERIFIED in DOM.");
         }

         container.classList.add('content-visible'); // Make the container visible
         console.log("[Render] Plan Creation Form Rendered function finished.");
    };

    // Helper function for the event listener
    const handleGenerateClick = function() {
        if (state.isLoading.generation) return; // Prevent multiple clicks
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generuji plán...';
        generateStudyPlan();
    };

    // ==============================================
    //          Генерация и Сохранение Плана
    // ==============================================
    const generateStudyPlan = async () => { if (!state.latestDiagnosticData || !state.currentUser) { showToast('Chybí data pro generování.', 'error'); setLoadingState('generation', false); return; } if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) { showToast('Chyba: Nastavte platný Gemini API klíč v kódu.', 'error'); setLoadingState('generation', false); return; } ui.currentPlanSection.classList.remove('visible-section'); ui.historyPlanSection.classList.remove('visible-section'); ui.createPlanSection.classList.remove('visible-section'); ui.planSection.classList.add('visible-section'); setLoadingState('generation', true); if(ui.planContent) ui.planContent.classList.remove('content-visible'); if(ui.planActions) ui.planActions.innerHTML = ''; state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; if (ui.genericBackBtn) ui.genericBackBtn.onclick = () => switchTab('create'); try { const topicsData = Object.entries(state.latestDiagnosticData.topic_results || {}).map(([topicKey, data]) => ({ name: data.name || state.topicMap[topicKey] || `Téma ${topicKey}`, questions: data.total || 0, correct: data.correct || 0, percentage: data.score || 0 })).sort((a, b) => a.percentage - b.percentage); const fullMarkdownResponse = await generatePlanContentWithGemini(state.latestDiagnosticData, topicsData); const jsonRegex = /```json\s*([\s\S]*?)\s*```/; const jsonMatch = fullMarkdownResponse.match(jsonRegex); let activitiesArray = null; let planMarkdownForStorage = fullMarkdownResponse; if (jsonMatch && jsonMatch[1]) { try { activitiesArray = JSON.parse(jsonMatch[1].replace(/\u00A0/g, ' ').trim()); planMarkdownForStorage = fullMarkdownResponse.replace(jsonRegex, '').trim(); state.lastGeneratedActivitiesJson = activitiesArray; } catch (e) { console.error("Error parsing JSON activities:", e); showToast("Warning: Nepodařilo se zpracovat aktivity z plánu.", "warning"); state.lastGeneratedActivitiesJson = null; } } else { console.warn("JSON block of activities not found."); state.lastGeneratedActivitiesJson = null; } state.lastGeneratedMarkdown = planMarkdownForStorage; if(ui.planSectionTitle) ui.planSectionTitle.textContent = 'Návrh studijního plánu'; displayPlanContent(state.lastGeneratedMarkdown); if(ui.planActions) { ui.planActions.innerHTML = `<button class="btn btn-primary" id="saveGeneratedPlanBtn"><i class="fas fa-save"></i> Uložit tento plán</button><button class="btn btn-success btn-tooltip" id="exportGeneratedPlanBtn" title="Stáhnout návrh jako PDF"><i class="fas fa-file-pdf"></i> Export PDF</button><button class="btn btn-secondary" id="regeneratePlanBtn"><i class="fas fa-sync-alt"></i> Vygenerovat znovu</button>`; const saveBtn = ui.planActions.querySelector('#saveGeneratedPlanBtn'); const exportBtn = ui.planActions.querySelector('#exportGeneratedPlanBtn'); const regenBtn = ui.planActions.querySelector('#regeneratePlanBtn'); if(saveBtn) saveBtn.addEventListener('click', () => saveGeneratedPlan(state.lastGeneratedMarkdown, state.lastGeneratedActivitiesJson, topicsData)); if(exportBtn) exportBtn.addEventListener('click', () => exportPlanToPDFWithStyle({ created_at: new Date(), plan_content_markdown: state.lastGeneratedMarkdown, title: "Nový návrh plánu" })); if(regenBtn) regenBtn.addEventListener('click', handleGenerateClick); ui.planActions.style.display = 'flex'; } ui.planSection.scrollIntoView({ behavior: 'smooth' }); initTooltips(); } catch (error) { console.error('Plan generation error:', error); renderMessage(ui.planContent, 'error', 'Chyba generování', error.message); if(ui.planActions) { ui.planActions.innerHTML = `<button class="btn btn-secondary" id="regeneratePlanBtn"><i class="fas fa-sync-alt"></i> Vygenerovat znovu</button>`; const regenBtn = ui.planActions.querySelector('#regeneratePlanBtn'); if(regenBtn) regenBtn.addEventListener('click', handleGenerateClick); ui.planActions.style.display = 'flex'; } } finally { setLoadingState('generation', false); } };
    // Updated Prompt
    const generatePlanContentWithGemini = async (testData, topicsData) => {
        const totalScore = testData.total_score ?? '-';
        const totalQuestions = testData.total_questions ?? '-';
        const analysis = testData.analysis || {};
        const overallAssessment = analysis.summary?.overall_assessment || 'N/A';
        const strengths = analysis.strengths?.map(s => `${s.topic} (${s.score}%)`).join(', ') || 'Nebyly identifikovány';
        const weaknesses = analysis.weaknesses?.map(w => `${w.topic} (${w.score}%)`).join(', ') || 'Nebyly identifikovány';
        const recommendations = analysis.recommendations?.join('\n- ') || 'Žádná specifická.';

        // *** NEW DETAILED PROMPT ***
        const prompt = `
Jsi expertní AI tutor specializující se na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v Česku. Tvým úkolem je vytvořit NÁROČNÝ, DETAILNÍ a KONZISTENTNÍ týdenní studijní plán v ČEŠTINĚ ve formátu Markdown, zaměřený na dosažení co nejlepšího výsledku u zkoušek. Na konci MUSÍŠ vygenerovat JSON pole aktivit pro tento plán, které PŘESNĚ ODRÁŽÍ obsah Markdown plánu pro daný den.

# Kontext: Student právě dokončil diagnostický test.
# Výsledky diagnostického testu:
- Celkové skóre: ${totalScore}/${totalQuestions} bodů
- Výsledky podle témat (Název tématu: Úspěšnost %):
${topicsData.map(topic => `  - ${topic.name}: ${topic.percentage}%`).join('\n')}

# Analýza výsledků testu (Shrnutí od AI):
- Celkové hodnocení: ${overallAssessment}
- Identifikované silné stránky: ${strengths}
- Identifikované slabé stránky: ${weaknesses}
- Doporučení na základě testu:
- ${recommendations}

# Oficiální Témata Zkoušky (CERMAT - detailně):
1.  **Čísla a aritmetické operace:** Přirozená čísla (do milionu), nula. Sčítání, odčítání, násobení, dělení (vlastnosti, algoritmy). Zlomky (porovnávání, sčítání/odčítání se stejným jm.). Desetinná čísla, číselná osa.
2.  **Algebra:** Mocniny, odmocniny (základní operace). Lineární rovnice (jedna neznámá, úpravy). Soustavy 2 lineárních rovnic (dosazovací, sčítací metoda). Mnohočleny (sčítání, odčítání, násobení, vytýkání, vzorce (a±b)², a²-b²). Výrazy s proměnnými (dosazování, úpravy).
3.  **Geometrie:** Základní rovinné útvary (čtverec, obdélník, trojúhelník - typy, vlastnosti, věty; kruh/kružnice - části, vlastnosti). Kreslení, náčrty. Kolmost, rovnoběžnost. Obvod, obsah rovinných útvarů. Povrch a objem těles (krychle, kvádr, válec; základy kužele, koule). Pythagorova věta. Základní konstrukční úlohy.
4.  **Práce s daty:** Tabulky, diagramy (čtení, interpretace, jednoduchá tvorba). Aritmetický průměr, modus, medián. Grafy závislostí (čtení, interpretace).
5.  **Problémové úlohy:** Slovní úlohy (převod na matematický model, řešení). Úlohy na poměr, přímá a nepřímá úměrnost, měřítko mapy. Úlohy na pohyb, společnou práci (základní typy). Aplikace matematiky. Strategie řešení.
6.  **Proporce a procenta:** Procento, promile. Procentová část, základ, počet procent. Jednoduché úrokování. Trojčlenka. Poměr (základní úpravy, rozdělení).
7.  **Logické úlohy:** Logické vztahy, jednoduché výroky, číselné řady, vzory, závislosti.

# TVŮJ ÚKOL (Vytvoř NÁROČNÝ, DETAILNÍ a KONZISTENTNÍ plán):
1.  Vytvoř DETAILNÍ týdenní studijní plán (Pondělí - Neděle) ve formátu Markdown. Musí být strukturovaný, srozumitelný a zaměřený na VÝRAZNÉ zlepšení. Dbej na přirozené formátování textu.
2.  Plán musí pokrývat klíčové oblasti z OFICIÁLNÍCH TÉMAT, klást ZVÝŠENÝ DŮRAZ na slabé stránky (${weaknesses}), ale ZAHRNOVAT i OPAKOVÁNÍ silnějších stránek.
3.  Navrhni RŮZNORODÉ a KONKRÉTNÍ aktivity:
    * **Co přesně se učit:** Jasně definuj rozsah tématu (např. "Opakování sčítání a odčítání zlomků se stejným jmenovatelem").
    * **Typy úkolů:** Řešení KONKRÉTNÍCH TYPŮ příkladů s uvedením POČTU (např. "Řešení 8 lineárních rovnic se závorkami").
    * **Slovní úlohy:** Specifikuj zaměření (např. "4 slovní úlohy na procenta - výpočet základu").
    * **Analýza:** Doporučení k ANALÝZE minulých chyb nebo PROJITÍ ŘEŠENÝCH příkladů.
    * **Pokročilé:** Zařazení NÁROČNĚJŠÍCH úloh u silnějších témat.
4.  Rozděl denní studium (cca 75-100 minut) do 2-3 INTENZIVNÍCH bloků. Uveď odhadovaný čas (např., "45 min").
5.  **JSON Popis:** V JSON poli 'description' **NEUVÁDĚJ KONKRÉTNÍ ROVNICE NEBO ČÍSELNÉ ZADÁNÍ PŘÍKLADŮ**. Místo toho SLOVNĚ popiš TYP úkolů, počet a zaměření (např. 'Řešení 5 lineárních rovnic se zlomky', 'Výpočet procentové části ze základu ve 4 slovních úlohách').
6.  **KONZISTENCE:** JSON \`title\` a \`description\` musí být PŘÍMÝM a VĚRNÝM shrnutím aktivity popsané v odpovídajícím bloku v Markdown textu pro ten samý den a časový úsek. Žádné informace nesmí být v JSON přidány ani vynechány oproti Markdown popisu daného bloku.
7.  **RADA PRO PLÁN:** Přidej krátkou radu nebo tip na konci Markdown části, jak efektivně pracovat s tímto plánem nebo na co si dát pozor.

# Požadovaný formát výstupu (Markdown + JSON na konci):
**Analýza diagnostiky:**
* Zaměření na: ${weaknesses}
* Udržování: ${strengths}

**Hlavní cíle pro tento týden:**
* [Použij odrážky] Výrazně zlepšit [Nejslabší téma].
* [Použij odrážky] Upevnit znalosti v [Druhé nejslabší téma].
* [Použij odrážky] Zopakovat a procvičit [Silnější téma].
---
### Pondělí
* **Fokus dne:** [Např. Složitější lineární rovnice a aplikace procent]
* **Blok 1 (cca 45 min): Algebra - Rovnice:** Řešení 10 složitějších lineárních rovnic se zlomky a závorkami. Důraz na správné úpravy a zkoušku.
* **Blok 2 (cca 40 min): Procenta - Slovní úlohy:** Řešení 5 slovních úloh na výpočet základu a procentové změny (zdražení/sleva).
* *Tip dne:* U rovnic si piš mezikroky a ověřuj si je.

### Úterý
* **Fokus dne:** [Např. Geometrie - Tělesa a opakování mnohočlenů]
* **Blok 1 (cca 50 min): Geometrie - Objem a povrch válce:** Opakování vzorců. Výpočet objemu a povrchu válce ve 4 úlohách (včetně slovních).
* **Blok 2 (cca 30 min): Opakování - Mnohočleny:** Opakování vzorců (a±b)², a²-b². Rozklad 10 mnohočlenů na součin pomocí vytýkání a vzorců.
* *Tip dne:* Kresli si náčrty těles, pomůže ti to s představivostí.
* ... (atd. pro všechny dny) ...
---
**Rada pro práci s plánem:**
* [Tvoje rada zde...]

\`\`\`json
[
  { "day_of_week": 1, "title": "Algebra: Složitější rovnice", "description": "Řešení 10 složitějších lineárních rovnic se zlomky a závorkami. Důraz na správné úpravy a zkoušku.", "time_slot": "45 min" },
  { "day_of_week": 1, "title": "Procenta: Slovní úlohy (základ, změna)", "description": "Řešení 5 slovních úloh na výpočet základu a procentové změny (zdražení/sleva).", "time_slot": "40 min" },
  { "day_of_week": 2, "title": "Geometrie: Objem a povrch válce", "description": "Opakování vzorců. Výpočet objemu a povrchu válce ve 4 úlohách (včetně slovních).", "time_slot": "50 min" },
  { "day_of_week": 2, "title": "Opakování: Rozklad mnohočlenů", "description": "Opakování vzorců (a±b)², a²-b². Rozklad 10 mnohočlenů na součin pomocí vytýkání a vzorců.", "time_slot": "30 min" }
  // ... (další aktivity pro všechny dny, PŘESNĚ podle Markdown) ...
]
\`\`\`
`;
        // *** END NEW PROMPT ***

        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.6, // Keep reasonable temperature for creativity but structure
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 8192 // Keep high for detailed plans
                    },
                    safetySettings: [ // Keep permissive for educational content
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ]
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || `Chyba Gemini API (${response.status})`);
            }
            const geminiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!geminiResponse) {
                 // Check for blocked response
                 if (data.promptFeedback?.blockReason) {
                     throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}.`);
                 }
                 // Check for other finish reasons
                 const finishReason = data.candidates?.[0]?.finishReason;
                 if(finishReason && finishReason !== 'STOP') {
                      throw new Error(`AI dokončilo generování s důvodem: ${finishReason}.`);
                 }
                 throw new Error('Prázdná odpověď od Gemini API.');
             }

            return geminiResponse;
        } catch (error) {
            console.error('Chyba při generování obsahu plánu:', error);
            throw error; // Re-throw for handling in generateStudyPlan
        }
    };
    const saveGeneratedPlan = async (markdownContent, activitiesArray, topicsData) => { if (!state.currentUser || !state.latestDiagnosticData || !markdownContent || !supabaseClient) { showToast('Chyba: Chybí data pro uložení.', 'error'); return; } const saveButton = document.getElementById('saveGeneratedPlanBtn'); if (saveButton) { saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...'; } const priorityTopics = {}; topicsData.forEach((topic, index) => { priorityTopics[topic.name] = { priority: index + 1, performance: topic.percentage, focus_level: topic.percentage < 50 ? 'high' : topic.percentage < 75 ? 'medium' : 'low' }; }); let savedPlanId = null; try { // 1. Deactivate old active plans
 const { error: deactivateError } = await supabaseClient.from('study_plans').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('user_id', state.currentUser.id).eq('status', 'active'); if (deactivateError) throw deactivateError; // 2. Create new plan data
 const today = new Date(); const completionDate = new Date(today); completionDate.setDate(completionDate.getDate() + 7); const newPlanData = { user_id: state.currentUser.id, title: `Studijní plán (${formatDate(today)})`, subject: "Matematika", status: "active", diagnostic_id: state.latestDiagnosticData.id, plan_content_markdown: markdownContent, priority_topics: priorityTopics, estimated_completion_date: completionDate.toISOString().split('T')[0], progress: 0, is_auto_adjusted: true }; // 3. Insert new plan
 const { data: savedPlan, error: insertPlanError } = await supabaseClient.from('study_plans').insert(newPlanData).select('id').single(); if (insertPlanError) throw insertPlanError; savedPlanId = savedPlan.id; console.log("Nový plán uložen, ID:", savedPlanId); // 4. Insert activities if available
 if (activitiesArray && Array.isArray(activitiesArray) && activitiesArray.length > 0) { const activitiesToInsert = activitiesArray.map(act => { if (typeof act !== 'object' || act === null) return null; const dayOfWeek = typeof act.day_of_week === 'number' ? act.day_of_week : parseInt(act.day_of_week, 10); if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null; return { plan_id: savedPlanId, day_of_week: dayOfWeek, time_slot: act.time_slot || null, title: act.title || 'Nespecifikováno', description: act.description || null, type: getActivityTypeFromTitle(act.title), // Infer type from title
 completed: false }; }).filter(item => item !== null); if (activitiesToInsert.length > 0) { const { error: insertActivitiesError } = await supabaseClient.from('plan_activities').insert(activitiesToInsert); if (insertActivitiesError) { console.error("Chyba vkládání aktivit:", insertActivitiesError); showToast('Plán uložen, ale aktivity pro harmonogram selhaly.', 'warning'); } else { console.log("Aktivity úspěšně vloženy."); showToast('Studijní plán a aktivity uloženy!', 'success'); } } else { showToast('Plán uložen, ale nebyly nalezeny platné aktivity.', 'warning'); } } else { showToast('Studijní plán uložen (bez detailních aktivit).', 'info'); } state.currentStudyPlan = { ...newPlanData, id: savedPlanId }; // Update local state
 switchTab('current'); // Switch to the current plan tab
 } catch (error) { console.error("Chyba při ukládání plánu:", error); showToast(`Nepodařilo se uložit plán: ${error.message}`, 'error'); if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Uložit tento plán'; } } };
    const displayPlanContent = (markdownContent) => { if (!ui.planContent) return; try { marked.setOptions({ gfm: true, breaks: true, sanitize: false }); const htmlContent = marked.parse(markdownContent || ''); ui.planContent.innerHTML = htmlContent; ui.planContent.classList.add('content-visible'); if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { setTimeout(() => { window.MathJax.typesetPromise([ui.planContent]).catch(e => console.error("MathJax error:", e)); }, 0); } else { console.warn("MathJax is not ready for rendering."); } } catch (e) { console.error("Markdown rendering error:", e); renderMessage(ui.planContent, 'error', 'Chyba zobrazení plánu', e.message); } };
    const getActivityTypeFromTitle = (title = "") => { const lower = title.toLowerCase(); if (lower.includes('test') || lower.includes('zkouška')) return 'test'; if (lower.includes('cvičení') || lower.includes('příklad') || lower.includes('úloh')) return 'exercise'; if (lower.includes('lekce') || lower.includes('vysvětlení') || lower.includes('teorie')) return 'lesson'; if (lower.includes('opakování') || lower.includes('shrnutí')) return 'review'; if (lower.includes('analýza') || lower.includes('chyb')) return 'analysis'; return 'other'; }; // Default type

    // ==============================================
    //          Экспорт PDF
    // ==============================================
    const exportPlanToPDFWithStyle = async (plan) => { if (!plan) return; if (!plan.plan_content_markdown) { showToast('Načítám data pro PDF...', 'info', 2000); try { const { data: fullPlanData, error } = await supabaseClient.from('study_plans').select('plan_content_markdown, title, created_at, estimated_completion_date').eq('id', plan.id).single(); if (error) throw error; plan = { ...plan, ...fullPlanData }; } catch (fetchError) { console.error("Nepodařilo se načíst markdown pro export:", fetchError); showToast('Chyba: Nepodařilo se načíst data pro export.', 'error'); return; } } const exportContainer = document.createElement('div'); exportContainer.id = 'pdf-export-content'; const pdfStyles = ` <style> body { font-family: 'Poppins', Arial, sans-serif; font-size: 10pt; color: #333; line-height: 1.5; } #pdf-export-content { padding: 18mm 13mm; } .pdf-header { text-align: center; margin-bottom: 12mm; border-bottom: 1px solid #ccc; padding-bottom: 4mm; } .pdf-header h1 { color: #4361ee; font-size: 18pt; margin: 0 0 4px 0; font-weight: 600; } .pdf-header p { color: #6c757d; font-size: 9pt; margin: 0; } .student-info { background-color: #f8f9fa; padding: 8mm 10mm; border-radius: 8px; border: 1px solid #eee; margin-bottom: 10mm; font-size: 9pt; break-inside: avoid; } .student-info h2 { color: #3f37c9; font-size: 12pt; margin: 0 0 6px 0; padding-bottom: 3px; border-bottom: 1px dotted #ccc; font-weight: 600;} .student-info p { margin: 0 0 3px 0; line-height: 1.4; } .student-info strong { font-weight: 600; color: #1e2a3a; } .pdf-content h2, .pdf-content h3, .pdf-content h4 { margin-top: 7mm; margin-bottom: 3mm; padding-bottom: 2px; font-weight: 600; break-after: avoid; } .pdf-content h2 { font-size: 13pt; color: #3f37c9; border-bottom: 1px solid #eee; } .pdf-content h3 { font-size: 11.5pt; color: #1e2a3a; border-bottom: 1px dotted #ccc; } .pdf-content h4 { font-size: 10.5pt; color: #4361ee; border-bottom: none; margin-top: 5mm; } .pdf-content p, .pdf-content li { margin-bottom: 2.5mm; color: #333; text-align: left; } .pdf-content ul, .pdf-content ol { padding-left: 5mm; margin-left: 3mm; margin-bottom: 4mm; break-inside: avoid;} .pdf-content li { margin-bottom: 1.5mm; } .pdf-content strong { font-weight: 600; color: #000; } .pdf-content em { font-style: italic; color: #555; } .pdf-content code { font-family: 'Courier New', Courier, monospace; background-color: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 9pt; color: #c7254e; } .pdf-content pre { background-color: #f8f9fa; border: 1px solid #eee; padding: 3mm; margin: 4mm 0; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word; font-size: 9pt; break-inside: avoid; } .pdf-content blockquote { border-left: 3px solid #ccc; padding-left: 4mm; margin: 4mm 0 4mm 2mm; color: #555; font-style: italic; break-inside: avoid; } .pdf-content hr { border: none; border-top: 1px dashed #ccc; margin: 6mm 0; } .pdf-day-block { break-before: auto; break-inside: avoid; } .pdf-footer { text-align: center; margin-top: 10mm; padding-top: 5mm; border-top: 1px solid #ccc; color: #888; font-size: 8pt; } </style> `; exportContainer.innerHTML = pdfStyles; const pdfTitle = plan.title ? plan.title.replace(/\s*\(\d{2}\.\d{2}\.\d{4}\)$/, '').trim() : 'Studijní plán'; const headerHTML = `<div class="pdf-header"><h1>${sanitizeHTML(pdfTitle)}</h1><p>Vytvořeno: ${formatDate(plan.created_at)}</p></div>`; exportContainer.innerHTML += headerHTML; if (state.currentUser && ui.userName.textContent) { exportContainer.innerHTML += `<div class="student-info"><h2>Informace o studentovi</h2><p><strong>Student:</strong> ${ui.userName.textContent}</p><p><strong>Datum vytvoření plánu:</strong> ${formatDate(plan.created_at)}</p>${plan.estimated_completion_date ? `<p><strong>Předpokládané dokončení:</strong> ${formatDate(plan.estimated_completion_date)}</p>` : ''}</div>`; } const contentDiv = document.createElement('div'); contentDiv.className = 'pdf-content'; try { const rawHtml = marked.parse(plan.plan_content_markdown || ''); contentDiv.innerHTML = rawHtml; const daysCzech = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle']; contentDiv.querySelectorAll('h3').forEach(h3 => { if (daysCzech.some(day => h3.textContent.trim().startsWith(day))) h3.classList.add('pdf-day-block'); }); } catch (e) { contentDiv.innerHTML = '<p>Chyba při zpracování obsahu plánu.</p>'; } exportContainer.appendChild(contentDiv); exportContainer.innerHTML += `<div class="pdf-footer">&copy; ${new Date().getFullYear()} Justax.space</div>`; const options = { margin: [18, 13, 18, 13], filename: `studijni-plan-${formatDate(plan.created_at).replace(/\./g, '-')}.pdf`, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'avoid-all'] } }; if (typeof html2pdf === 'function') { showToast('Generuji PDF...', 'info', 5000); html2pdf().set(options).from(exportContainer).save().then(() => { showToast('PDF bylo úspěšně vygenerováno!', 'success'); }).catch(err => { console.error("Chyba exportu PDF:", err); showToast('Nepodařilo se exportovat PDF.', 'error'); }); } else { showToast('Chyba: Knihovna pro export PDF není načtena.', 'error'); } };

    // ==============================================
    //          Запуск Приложения
    // ==============================================
    document.addEventListener('DOMContentLoaded', initializeApp);

})(); // Конец IIFE