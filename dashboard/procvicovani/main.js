(function() { // IIFE для изоляции области видимости
    'use strict';

    // ==============================================
    //          Конфигурация
    // ==============================================
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabaseClient = null;
    const GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const PLAN_GENERATION_COOLDOWN_DAYS = 7;
    const NOTIFICATION_FETCH_LIMIT = 5;
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';

    // ==============================================
    //          DOM Элементы (Кэш)
    // ==============================================
    const ui = {
         initialLoader: document.getElementById('initial-loader'),
         mainContent: document.getElementById('main-content'),
         sidebar: document.getElementById('sidebar'),
         sidebarOverlay: document.getElementById('sidebar-overlay'),
         mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
         sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
         sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
         sidebarName: document.getElementById('sidebar-name'),
         sidebarAvatar: document.getElementById('sidebar-avatar'),
         sidebarUserTitle: document.getElementById('sidebar-user-title'),
         toastContainer: document.getElementById('toast-container'),
         globalError: document.getElementById('global-error'),
         planTabs: document.querySelectorAll('.plan-tab'),
         currentPlanSection: document.getElementById('currentPlanSection'),
         currentPlanLoader: document.getElementById('currentPlanLoader'),
         dailyPlanCarouselContainer: document.getElementById('dailyPlanCarouselContainer'),
         singleDayPlanView: document.getElementById('singleDayPlanView'),
         prevDayBtn: document.getElementById('prevDayBtn'),
         nextDayBtn: document.getElementById('nextDayBtn'),
         currentPlanEmptyState: document.getElementById('currentPlanEmptyState'),

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
         notificationBell: document.getElementById('notification-bell'),
         notificationCount: document.getElementById('notification-count'),
         notificationsDropdown: document.getElementById('notifications-dropdown'),
         notificationsList: document.getElementById('notifications-list'),
         noNotificationsMsg: document.getElementById('no-notifications-msg'),
         markAllReadBtn: document.getElementById('mark-all-read'), // Corrected ID from mark-all-read-btn
         lockedPlanTemplate: document.getElementById('lockedPlanTemplate'),
         createPlanFormTemplate: document.getElementById('createPlanFormTemplate'),
         noDiagnosticTemplate: document.getElementById('noDiagnosticTemplate'),
         historyItemTemplate: document.getElementById('historyItemTemplate'),
         promptCreatePlanTemplate: document.getElementById('promptCreatePlanTemplate'),
         noActivePlanTemplate: document.getElementById('noActivePlanTemplate'),
         currentYearSidebar: document.getElementById('currentYearSidebar'),
         currentYearFooter: document.getElementById('currentYearFooter'),
         mouseFollower: document.getElementById('mouse-follower'),
         dayCardTemplate: document.getElementById('dayCardTemplate'),
         dayCardSkeleton: document.getElementById('dayCardSkeleton')
    };

    // ==============================================
    //          Глобальное Состояние
    // ==============================================
    let state = {
        currentUser: null, currentProfile: null, latestDiagnosticData: null,
        currentStudyPlan: null, previousPlans: [], planCreateAllowed: false,
        nextPlanCreateTime: null, planTimerInterval: null, currentTab: 'current',
        lastGeneratedMarkdown: null, lastGeneratedActivitiesJson: null,
        lastGeneratedTopicsData: null,
        isLoading: { current: false, history: false, create: false, detail: false, schedule: false, generation: false, notifications: false, titles: false },
        topicMap: { /* Populate this if needed from DB or keep static */ },
        allTitles: [],
        currentDisplayDate: null,
        allActivePlanActivitiesByDay: {},
        sortedActivityDates: [],
        planStartDate: null,
        planEndDate: null,
        allExamTopicsAndSubtopics: [] // NEW: To store topics for math_review prompt
    };

     const activityVisuals = {
         test: { name: 'Test', icon: 'fa-vial', class: 'test' },
         exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' },
         practice: { name: 'Procvičování', icon: 'fa-dumbbell', class: 'practice' },
         example: { name: 'Příklad', icon: 'fa-lightbulb', class: 'example' },
         review: { name: 'Opakování', icon: 'fa-history', class: 'review' },
         theory: { name: 'Teorie', icon: 'fa-book-open', class: 'theory' },
         analysis: { name: 'Analýza', icon: 'fa-chart-pie', class: 'analysis' },
         other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' },
         default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
     };

    // ==============================================
    //          Помощники (Утилиты)
    // ==============================================
    const formatDateForDisplay = (dateStringOrDate) => {
        if (!dateStringOrDate) return 'Neznámé datum';
        try {
            const date = (typeof dateStringOrDate === 'string') ? new Date(dateStringOrDate + 'T00:00:00') : dateStringOrDate;
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            let formatted = date.toLocaleDateString('cs-CZ', options);
            formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
            return formatted;
        } catch (e) {
            console.error("Chyba formátování data pro zobrazení:", dateStringOrDate, e);
            return 'Chybné datum';
        }
    };

    const getTodayDateString = () => {
        const today = new Date();
        return dateToYYYYMMDD(today);
    };

    const dateToYYYYMMDD = (date) => {
        if (!(date instanceof Date) || isNaN(date)) return null;
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const addDaysToDate = (dateString, days) => {
        const date = new Date(dateString + 'T00:00:00');
        date.setDate(date.getDate() + days);
        return dateToYYYYMMDD(date);
    };

    const formatDate = (dateString) => { if(!dateString) return '-'; try { const date = new Date(dateString); return date.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch(e){ return '-'}};
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } };
    const sanitizeHTML = (str) => { const t = document.createElement('div'); t.textContent = str || ''; return t.innerHTML; };
    const getInitials = (profileData, email) => {
        if (!profileData && !email) return '?';
        let i = '';
        if (profileData?.first_name) i += profileData.first_name[0];
        if (profileData?.last_name) i += profileData.last_name[0];
        if (i) return i.toUpperCase();
        if (profileData?.username) return profileData.username[0].toUpperCase();
        if (email) return email[0].toUpperCase();
        return 'P';
    };
    const openMenu = () => {
        if (ui.sidebar && ui.sidebarOverlay) {
            document.body.classList.remove('sidebar-collapsed');
            ui.sidebar.classList.add('active');
            ui.sidebarOverlay.classList.add('active');
        }
    };
    const closeMenu = () => {
        if (ui.sidebar && ui.sidebarOverlay) {
            ui.sidebar.classList.remove('active');
            ui.sidebarOverlay.classList.remove('active');
        }
    };
    const initTooltips = () => { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } };
    const showGlobalError = (message) => { if(ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i><div>${sanitizeHTML(message)}</div></div>`; ui.globalError.style.display = 'block';} };
    const hideGlobalError = () => { if(ui.globalError) ui.globalError.style.display = 'none'; };
    const formatRelativeTime = (timestamp) => { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
    const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); };
    const updateOnlineStatus = () => { /* Offline banner not present in plan.html */ };

    function applyInitialSidebarState() {
        try {
            const stateValue = localStorage.getItem(SIDEBAR_STATE_KEY); // Renamed to avoid conflict
            const isCurrentlyCollapsed = document.body.classList.contains('sidebar-collapsed');
            const shouldBeCollapsed = stateValue === 'collapsed';

            if (shouldBeCollapsed !== isCurrentlyCollapsed) {
                 document.body.classList.toggle('sidebar-collapsed', shouldBeCollapsed);
            }

            const icon = ui.sidebarToggleBtn?.querySelector('i');
            if (icon) {
                icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
            }
            if(ui.sidebarToggleBtn) {
                ui.sidebarToggleBtn.title = shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel';
            }
        } catch (e) {
            console.error("Chyba při aplikaci stavu postranního panelu:", e);
        }
    }

    function toggleSidebar() {
        try {
            const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded');
            const icon = ui.sidebarToggleBtn?.querySelector('i');
            if (icon) {
                icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
            }
             if(ui.sidebarToggleBtn) {
                ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel';
            }
        } catch (error) {
            console.error("[ToggleSidebar] Chyba:", error);
        }
    }

    const setLoadingState = (sectionKey, isLoadingFlag) => {
        if (state.isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;
        if (sectionKey === 'all') { Object.keys(state.isLoading).forEach(key => state.isLoading[key] = isLoadingFlag); }
        else { state.isLoading[sectionKey] = isLoadingFlag; }
        console.log(`[Loading] ${sectionKey}: ${isLoadingFlag}`);

        const loaderMap = { current: ui.currentPlanLoader, history: ui.historyLoader, create: ui.createPlanLoader, detail: ui.planLoading, schedule: ui.currentPlanLoader, generation: ui.planLoading, notifications: null, titles: null };
        const contentMap = { current: ui.dailyPlanCarouselContainer, history: ui.historyPlanContent, create: ui.createPlanContent, detail: ui.planContent, schedule: ui.singleDayPlanView, notifications: ui.notificationsList };
        const sectionMap = { current: ui.currentPlanSection, history: ui.historyPlanSection, create: ui.createPlanSection, detail: ui.planSection };
        const emptyMap = { notifications: ui.noNotificationsMsg, current: ui.currentPlanEmptyState };

        const sectionsToUpdate = sectionKey === 'all' ? Object.keys(loaderMap) : [sectionKey];

        sectionsToUpdate.forEach(key => {
            const loader = loaderMap[key];
            const content = contentMap[key];
            const section = sectionMap[key];
            const emptyState = emptyMap[key];

            if (loader) {
                loader.classList.toggle('visible-loader', isLoadingFlag);
                 if (key === 'generation') {
                     const loaderText = loader.querySelector('p');
                     if (loaderText) {
                         if (isLoadingFlag) {
                             loader.classList.add('generating-animation');
                             loaderText.textContent = 'Generuji plán, analyzuji data...';
                         } else {
                             loader.classList.remove('generating-animation');
                             loaderText.textContent = 'Načítám / Generuji...';
                         }
                     }
                 }
            }
            if (section) section.classList.toggle('loading', isLoadingFlag);

            if (isLoadingFlag) {
                if (content) content.classList.remove('content-visible', 'schedule-visible', 'generated-reveal');
                if (emptyState) emptyState.style.display = 'none';
                if (key === 'history' && ui.historyPlanContent) renderHistorySkeletons(3);

                if (key === 'schedule' && ui.singleDayPlanView) {
                    if (ui.dayCardSkeleton) {
                        ui.singleDayPlanView.innerHTML = '';
                        const skeletonClone = ui.dayCardSkeleton.cloneNode(true);
                        skeletonClone.style.display = 'flex';
                        ui.singleDayPlanView.appendChild(skeletonClone);
                    } else {
                        ui.singleDayPlanView.innerHTML = `<div class="day-schedule-card skeleton-day-card" style="display:block; opacity:0.5; margin: 0 auto; max-width: 700px; height: 300px;"><div class="day-header skeleton-day-header skeleton" style="height: 40px; width: 60%; margin-bottom:1rem;"></div><div class="activity-list-container" style="padding: 1rem 0;"><div class="activity-list-item skeleton-activity-item skeleton" style="height: 50px; margin-bottom:0.5rem;"></div></div></div>`;
                    }
                    if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'flex';
                }
                if (key === 'notifications' && ui.notificationsList) renderNotificationSkeletons(2);
                 if (key === 'generation' && ui.planActions) {
                     ui.planActions.style.display = 'none';
                 }
            } else {
                if (key === 'history' && ui.historyPlanContent) {
                    if (!ui.historyPlanContent.querySelector('.history-item') && !ui.historyPlanContent.querySelector('.notest-message')) {
                        ui.historyPlanContent.innerHTML = '';
                    }
                }
                 if (key === 'schedule' && ui.singleDayPlanView) {
                    const existingSkeleton = ui.singleDayPlanView.querySelector('.skeleton-day-card');
                    if (existingSkeleton && !ui.singleDayPlanView.querySelector('.day-schedule-card:not(.skeleton-day-card)')) {
                        // Leave skeleton if not replaced by real content
                    }
                 }
            }
             if (key === 'detail') {
                 if (ui.planActions) {
                     ui.planActions.style.display = isLoadingFlag ? 'none' : 'flex';
                 }
             }
            if (key === 'notifications' && ui.notificationBell) {
                ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                if (ui.markAllReadBtn) {
                    const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                    ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
                }
            }
        });
    };

    const renderMessage = (container, type = 'info', title, message, addButtons = []) => {
        if (!container) { console.error("renderMessage: Container not found!"); return; }
        console.log(`[RenderMessage] Rendering into:`, container.id || container.className, `Type: ${type}, Title: ${title}`);
        const iconMap = { info: 'fa-info-circle', warning: 'fa-exclamation-triangle', error: 'fa-exclamation-circle' };
        let buttonsHTML = '';
        addButtons.forEach(btn => {
            buttonsHTML += `<button class="btn ${btn.class || 'btn-primary'}" id="${btn.id}" ${btn.disabled ? 'disabled' : ''}>${btn.icon ? `<i class="fas ${btn.icon}"></i> ` : ''}${sanitizeHTML(btn.text)}</button>`;
        });
        container.innerHTML = `<div class="notest-message ${type}"><h3><i class="fas ${iconMap[type]}"></i> ${sanitizeHTML(title)}</h3><p>${sanitizeHTML(message)}</p><div class="action-buttons">${buttonsHTML}</div></div>`;
        container.classList.add('content-visible');
        if (container === ui.currentPlanEmptyState) {
            if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
            container.style.display = 'flex';
        }

        addButtons.forEach(btn => {
            const btnElement = container.querySelector(`#${btn.id}`);
            if (btnElement && btn.onClick) {
                btnElement.addEventListener('click', btn.onClick);
            }
        });
    };

    const initializeSupabase = () => { try { if (!window.supabase) throw new Error("Supabase library not loaded."); supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey); console.log("Supabase client initialized."); return true; } catch (error) { console.error("Supabase init failed:", error); showGlobalError("Chyba připojení k databázi."); return false; } };
    const setupEventListeners = () => {
        console.log("[SETUP] Setting up event listeners...");
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        else console.warn("Main mobile menu toggle button (#main-mobile-menu-toggle) not found.");

        if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);
        else console.warn("Sidebar toggle button (#sidebar-toggle-btn) not found.");

        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
        ui.planTabs.forEach(tab => { tab.addEventListener('click', () => switchTab(tab.dataset.tab)); });
        if (ui.genericBackBtn) {
            ui.genericBackBtn.addEventListener('click', () => {
                if (ui.planSection?.classList.contains('visible-section')) {
                    if (state.lastGeneratedMarkdown !== null) {
                        switchTab('create');
                    } else {
                        switchTab('history');
                    }
                    state.lastGeneratedMarkdown = null;
                    state.lastGeneratedActivitiesJson = null;
                    state.lastGeneratedTopicsData = null;
                } else {
                     switchTab('current');
                }
            });
        }

        window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) closeMenu(); });

        if (ui.prevDayBtn) {
            ui.prevDayBtn.addEventListener('click', () => {
                if (state.currentDisplayDate && state.sortedActivityDates.length > 0) {
                    const currentIndex = state.sortedActivityDates.indexOf(state.currentDisplayDate);
                    if (currentIndex > 0) {
                        state.currentDisplayDate = state.sortedActivityDates[currentIndex - 1];
                        renderSingleDayPlan(state.currentDisplayDate);
                    }
                }
            });
        }
        if (ui.nextDayBtn) {
            ui.nextDayBtn.addEventListener('click', () => {
                if (state.currentDisplayDate && state.sortedActivityDates.length > 0) {
                    const currentIndex = state.sortedActivityDates.indexOf(state.currentDisplayDate);
                    if (currentIndex < state.sortedActivityDates.length - 1) {
                        state.currentDisplayDate = state.sortedActivityDates[currentIndex + 1];
                        renderSingleDayPlan(state.currentDisplayDate);
                    }
                }
            });
        }

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
                            const currentCountText = ui.notificationCount.textContent.replace('+', '');
                            const currentCount = parseInt(currentCountText) || 0;
                            const newCount = Math.max(0, currentCount - 1);
                            ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                            ui.notificationCount.classList.toggle('visible', newCount > 0);
                            if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0;
                        }
                    }
                    if (link) window.location.href = link;
                }
            });
        }
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
        applyInitialSidebarState();
        if(ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden');}
        if (ui.mainContent) ui.mainContent.style.display = 'none';
        hideGlobalError();
        try {
            const { data: { user }, error } = await supabaseClient.auth.getUser();
            if (error) throw new Error("Nepodařilo se ověřit uživatele.");
            if (!user) { window.location.href = '/auth/index.html'; return; }
            state.currentUser = user;
            const [profile, titles] = await Promise.all([
                fetchUserProfile(user.id),
                fetchTitles()
            ]);
            state.currentProfile = profile;
            state.allTitles = titles;
            updateSidebarProfile();
            setupEventListeners();
            initTooltips();
            initMouseFollower();
            initHeaderScrollDetection();
            updateCopyrightYear();
            const loadNotificationsPromise = fetchNotifications(user.id, NOTIFICATION_FETCH_LIMIT)
                .then(({ unreadCount, notifications }) => renderNotifications(unreadCount, notifications))
                .catch(err => { console.error("Failed to load notifications initially:", err); renderNotifications(0, []); });
            const loadInitialTabPromise = switchTab('current'); // Default tab
            await Promise.all([loadNotificationsPromise, loadInitialTabPromise]);
            if (ui.mainContent) {
                ui.mainContent.style.display = 'block';
                requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); });
            }
            console.log("✅ [Init Plan] Page Initialized.");
        } catch (error) {
            console.error("App initialization error:", error);
            showGlobalError(`Chyba inicializace: ${error.message}`);
            if (ui.mainContent) ui.mainContent.style.display = 'block';
            const errorContainer = ui.currentPlanEmptyState || ui.mainContent;
            if(errorContainer) renderMessage(errorContainer, 'error', 'Chyba inicializace', error.message);
        } finally {
            if (ui.initialLoader) {
                ui.initialLoader.classList.add('hidden');
                setTimeout(() => { if(ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500);
            }
        }
    };
    const fetchUserProfile = async (userId) => {
        if (!userId || !supabaseClient) return null;
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*, selected_title, preferences, longest_streak_days') // Přidáno preferences
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (e) {
            console.error("Profile fetch error:", e);
            return null;
        }
    };

    async function fetchTitles() {
        if (!supabaseClient) return [];
        console.log("[Titles] Fetching available titles...");
        setLoadingState('titles', true);
        try {
            const { data, error } = await supabaseClient
                .from('title_shop')
                .select('title_key, name');

            if (error) {
                console.error("[Titles] Error from Supabase:", error);
                throw error;
            }
            console.log("[Titles] Fetched titles:", data);
            setLoadingState('titles', false);
            return data || [];
        } catch (error) {
            console.error("[Titles] Catch block error fetching titles:", error.message);
            showToast("Chyba", "Nepodařilo se načíst dostupné tituly. Zkontrolujte konzoli pro detaily.", "error");
            setLoadingState('titles', false);
            return [];
        }
    }

    function updateSidebarProfile() {
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) {
            console.warn("[SidebarUI] Chybí elementy postranního panelu pro profil.");
            return;
        }
        if (state.currentProfile && state.currentUser) {
            const profile = state.currentProfile;
            const user = state.currentUser;
            const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || user.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);

            const initials = getInitials(profile, user.email);
            const avatarUrl = profile.avatar_url;
            let finalAvatarUrl = avatarUrl;

            if (avatarUrl && !avatarUrl.startsWith('http') && avatarUrl.includes('/')) {
                finalAvatarUrl = sanitizeHTML(avatarUrl);
            } else if (avatarUrl) {
                finalAvatarUrl = `${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`;
            }

            ui.sidebarAvatar.innerHTML = finalAvatarUrl ? `<img src="${finalAvatarUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
            const img = ui.sidebarAvatar.querySelector('img');
            if (img) {
                img.onerror = function() {
                    console.warn(`[SidebarUI] Nepodařilo se načíst avatar: ${this.src}. Zobrazuji iniciály.`);
                    ui.sidebarAvatar.innerHTML = sanitizeHTML(initials);
                };
            }

            const selectedTitleKey = profile.selected_title;
            let displayTitle = 'Pilot';

            if (selectedTitleKey && state.allTitles && state.allTitles.length > 0) {
                const foundTitle = state.allTitles.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) {
                    displayTitle = foundTitle.name;
                } else {
                    console.warn(`[SidebarUI] Titul s klíčem "${selectedTitleKey}" nebyl nalezen v načtených titulech.`);
                }
            } else if (selectedTitleKey) {
                console.warn(`[SidebarUI] Klíč titulu "${selectedTitleKey}" je přítomen, ale seznam všech titulů (state.allTitles) je prázdný nebo nebyl načten.`);
            }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle));

        } else {
            ui.sidebarName.textContent = "Nepřihlášen";
            ui.sidebarAvatar.textContent = '?';
            ui.sidebarUserTitle.textContent = 'Pilot';
            ui.sidebarUserTitle.removeAttribute('title');
        }
    }

    const switchTab = async (tabId) => {
        if (!supabaseClient) { showGlobalError("Aplikace není správně inicializována."); return; }
        console.log(`[NAV] Switching to tab: ${tabId}`);
        state.currentTab = tabId;
        ui.planTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));
        ui.currentPlanSection?.classList.remove('visible-section');
        ui.historyPlanSection?.classList.remove('visible-section');
        ui.createPlanSection?.classList.remove('visible-section');
        ui.planSection?.classList.remove('visible-section');

        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        if (ui.currentPlanEmptyState) ui.currentPlanEmptyState.style.display = 'none';
        if (ui.historyPlanContent) ui.historyPlanContent.classList.remove('content-visible');
        if (ui.createPlanContent) ui.createPlanContent.classList.remove('content-visible');
        if (ui.planContent) ui.planContent.classList.remove('content-visible', 'generated-reveal');

        if (state.lastGeneratedMarkdown !== null && tabId !== 'detail' && tabId !== 'generation') {
            console.log("[NAV] Clearing generated plan state as we are leaving the preview section.");
            state.lastGeneratedMarkdown = null;
            state.lastGeneratedActivitiesJson = null;
            state.lastGeneratedTopicsData = null;
        }
        hideGlobalError();
        try {
            let targetSectionElement = null;
            switch(tabId) {
                case 'current': targetSectionElement = ui.currentPlanSection; break;
                case 'history': targetSectionElement = ui.historyPlanSection; break;
                case 'create': targetSectionElement = ui.createPlanSection; break;
                default: console.warn(`[NAV] Unknown tab ID: ${tabId}`); return;
            }
            if (targetSectionElement) {
                targetSectionElement.classList.add('visible-section');
                if (tabId === 'current') await loadCurrentPlan();
                else if (tabId === 'history') await loadPlanHistory();
                else if (tabId === 'create') await checkPlanCreationAvailability();
            } else {
                console.warn(`[NAV] Target section element not found for tab: ${tabId}`);
            }
        } catch (error) {
            console.error(`[NAV] Error loading tab ${tabId}:`, error);
            const errorTargetSection = document.getElementById(`${tabId}PlanSection`);
            const errorContentContainer = (tabId === 'current') ? ui.currentPlanEmptyState : errorTargetSection?.querySelector('.section-content');

            if(errorTargetSection) errorTargetSection.classList.add('visible-section');
            if (errorContentContainer) {
                renderMessage(errorContentContainer, 'error', 'Chyba načítání', `Obsah záložky "${tabId}" nelze načíst: ${error.message}`);
            } else {
                showGlobalError(`Nepodařilo se načíst záložku "${tabId}": ${error.message}`);
            }
            if(tabId === 'current') { setLoadingState('current', false); setLoadingState('schedule', false); }
            if(tabId === 'history') setLoadingState('history', false);
            if(tabId === 'create') setLoadingState('create', false);
        }
    };

    async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) { if (!supabaseClient || !userId) { console.error("[Notifications] Missing Supabase client or User ID."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Fetching unread notifications for user ${userId}`); setLoadingState('notifications', true); try { const { data, error, count } = await supabaseClient.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; console.log(`[Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } finally { setLoadingState('notifications', false); } }
     function renderNotifications(count, notifications) { console.log("[Render Notifications] Start, Count:", count, "Notifications:", notifications); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements."); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.toggle('has-content', notifications && notifications.length > 0); console.log("[Render Notifications] Finished"); }
     function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
     async function markNotificationRead(notificationId) { console.log("[Notifications] Marking notification as read:", notificationId); if (!state.currentUser || !notificationId) return false; try { const { error } = await supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[Notifications] Mark as read successful for ID:", notificationId); return true; } catch (error) { console.error("[Notifications] Mark as read error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
     async function markAllNotificationsRead() { console.log("[Notifications] Marking all as read for user:", state.currentUser?.id); if (!state.currentUser || !ui.markAllReadBtn) return; setLoadingState('notifications', true); try { const { error } = await supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('is_read', false); if (error) throw error; console.log("[Notifications] Mark all as read successful"); const { unreadCount, notifications } = await fetchNotifications(state.currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[Notifications] Mark all as read error:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); } finally { setLoadingState('notifications', false); } }

    const groupActivitiesByDayAndDateArray = (activities) => {
        state.allActivePlanActivitiesByDay = {};
        state.sortedActivityDates = [];
        if (!activities || activities.length === 0) {
            state.planStartDate = null;
            state.planEndDate = null;
            return;
        }

        const dayToDateMap = {};
        let planStartDayOfWeek = activities[0].day_of_week; // Předpokládáme, že aktivity jsou již seřazeny
        let referenceDate = new Date(); // Dnešní datum jako referenční bod

        // Najdeme datum pro první den plánu (planStartDayOfWeek)
        let currentDayOfWeek = referenceDate.getDay(); // Neděle = 0, Pondělí = 1, ...
        if (currentDayOfWeek === 0) currentDayOfWeek = 7; // Převod neděle na 7 pro snadnější výpočty
        if (planStartDayOfWeek === 0) planStartDayOfWeek = 7; // Převod neděle v plánu na 7

        let diffToStartDay = planStartDayOfWeek - currentDayOfWeek;
        // Pokud je diffToStartDay záporný, znamená to, že den plánu už byl tento týden,
        // takže posuneme referenční datum na začátek *následujícího* týdne, kde tento den začíná.
        // Toto je třeba upravit, pokud plán může začínat i v minulosti nebo má pevné datum startu.
        // Pro jednoduchý 7-denní cyklický plán od aktuálního týdne:
        referenceDate.setDate(referenceDate.getDate() + diffToStartDay);


        state.planStartDate = new Date(referenceDate); // Toto bude datum prvního dne plánu (např. pondělí)
        state.planEndDate = new Date(state.planStartDate);
        state.planEndDate.setDate(state.planStartDate.getDate() + 6); // Konec plánu o 6 dní později

        // Mapování dnů týdne (0-6 z DB) na konkrétní data v tomto týdnu
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(state.planStartDate);
            currentDate.setDate(state.planStartDate.getDate() + i);
            const dayOfWeekInPlan = activities.find(a => a.day_of_week === (currentDate.getDay() === 0 ? 6 : currentDate.getDay() -1) )?.day_of_week; // mapování JS dne na plánovací den
            // Potřebujeme mapovat day_of_week (0-6, kde 0 je typicky pondělí v plánu) na skutečné datum
            // Toto je zjednodušené, reálné mapování závisí na tom, jak je 'day_of_week' definován (0=Po nebo Ne?)
             dayToDateMap[(currentDate.getDay() + 6) % 7] = dateToYYYYMMDD(currentDate); // Pondělí = 0 ... Neděle = 6
        }


        activities.forEach(act => {
            const dateString = dayToDateMap[act.day_of_week]; // act.day_of_week by mělo být 0 (Po) - 6 (Ne)
            if (dateString) {
                if (!state.allActivePlanActivitiesByDay[dateString]) {
                    state.allActivePlanActivitiesByDay[dateString] = [];
                }
                state.allActivePlanActivitiesByDay[dateString].push(act);
            } else {
                 console.warn(`Activity with ID ${act.id} has invalid day_of_week: ${act.day_of_week} or dateString not found.`);
            }
        });
        state.sortedActivityDates = Object.keys(state.allActivePlanActivitiesByDay).sort();

        // Aktualizace skutečného začátku a konce plánu na základě dat aktivit
        if (state.sortedActivityDates.length > 0) {
            state.planStartDate = new Date(state.sortedActivityDates[0] + 'T00:00:00');
            state.planEndDate = new Date(state.sortedActivityDates[state.sortedActivityDates.length - 1] + 'T00:00:00');
        } else {
            state.planStartDate = null;
            state.planEndDate = null;
        }
        console.log("[groupActivities] Grouped activities:", state.allActivePlanActivitiesByDay);
        console.log("[groupActivities] Sorted dates:", state.sortedActivityDates);
        console.log("[groupActivities] Plan effective start/end:", state.planStartDate, state.planEndDate);
    };


    const loadCurrentPlan = async () => {
        if (!supabaseClient || !state.currentUser) return;
        console.log("[CurrentPlan] Loading current plan...");
        setLoadingState('current', true);
        setLoadingState('schedule', true);
        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        if (ui.currentPlanEmptyState) ui.currentPlanEmptyState.style.display = 'none';

        try {
            const { data: plans, error } = await supabaseClient.from('study_plans')
                .select('*')
                .eq('user_id', state.currentUser.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1);
            if (error) throw error;

            if (plans && plans.length > 0) {
                state.currentStudyPlan = plans[0];
                console.log("[CurrentPlan] Active plan found:", state.currentStudyPlan.id);

                const { data: activities, error: actError } = await supabaseClient
                    .from('plan_activities')
                    .select('*')
                    .eq('plan_id', state.currentStudyPlan.id)
                    .order('day_of_week')
                    .order('time_slot');
                if (actError) throw actError;

                groupActivitiesByDayAndDateArray(activities || []);

                // Určení, který den zobrazit jako první
                const todayStr = getTodayDateString();
                if (state.sortedActivityDates.includes(todayStr)) {
                    state.currentDisplayDate = todayStr; // Pokud je dnes v plánu, zobraz dnes
                } else if (state.sortedActivityDates.length > 0) {
                    // Najdi první budoucí den v plánu, nebo poslední minulý, pokud žádný budoucí není
                    let futureDate = state.sortedActivityDates.find(d => d >= todayStr);
                    state.currentDisplayDate = futureDate || state.sortedActivityDates[state.sortedActivityDates.length -1];
                     if (!state.currentDisplayDate && state.planStartDate) { // Fallback na start plánu
                        state.currentDisplayDate = dateToYYYYMMDD(state.planStartDate);
                    } else if (!state.currentDisplayDate) { // Absolutní fallback
                        state.currentDisplayDate = state.sortedActivityDates[0] || todayStr;
                    }
                } else {
                     // Žádné dny s aktivitami, zobraz prázdný dnešek
                    state.currentDisplayDate = todayStr;
                }


                renderSingleDayPlan(state.currentDisplayDate);
                if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'flex';


            } else {
                state.currentStudyPlan = null;
                state.allActivePlanActivitiesByDay = {};
                state.sortedActivityDates = [];
                state.currentDisplayDate = null;
                console.log("[CurrentPlan] No active plan found. Checking diagnostic...");
                if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';

                const diagnostic = await getLatestDiagnostic(false);
                if (diagnostic === null) { // Chyba při načítání diagnostiky
                    renderMessage(ui.currentPlanEmptyState, 'error', 'Chyba načítání diagnostiky', 'Nepodařilo se ověřit stav vašeho diagnostického testu.');
                } else if (diagnostic) { // Diagnostika existuje
                    renderPromptCreatePlan(ui.currentPlanEmptyState);
                } else { // Žádná diagnostika
                    renderNoActivePlan(ui.currentPlanEmptyState);
                }
            }
        } catch (error) {
            console.error("[CurrentPlan] Error loading current plan:", error);
            renderMessage(ui.currentPlanEmptyState, 'error', 'Chyba', 'Nepodařilo se načíst aktuální studijní plán.');
            if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
        } finally {
            setLoadingState('current', false);
            setLoadingState('schedule', false);
            console.log("[CurrentPlan] Loading finished.");
        }
     };

    const renderSingleDayPlan = (targetDateString) => {
        console.log(`[RenderSingleDay] Rendering for date: ${targetDateString}`);
        if (!ui.singleDayPlanView || !ui.dayCardTemplate) {
            console.error("[RenderSingleDay] Missing UI elements (singleDayPlanView, dayCardTemplate).");
            if(ui.currentPlanEmptyState) renderMessage(ui.currentPlanEmptyState, 'error', 'Chyba zobrazení', 'Nelze zobrazit denní plán.');
            if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';
            setLoadingState('schedule', false);
            return;
        }

        setLoadingState('schedule', true);

        if (ui.dayCardSkeleton && getComputedStyle(ui.dayCardSkeleton).display !== 'none') {
            ui.dayCardSkeleton.style.display = 'none';
        }

        let dayCard = ui.singleDayPlanView.querySelector('.day-schedule-card:not(.skeleton-day-card)');
        let dayHeader, activitiesContainer;

        if (!dayCard) {
            console.log("[RenderSingleDay] No existing day card, cloning template.");
            const templateNode = ui.dayCardTemplate.content.cloneNode(true);
            dayCard = templateNode.querySelector('.day-schedule-card');
            if (!dayCard) {
                console.error("[RenderSingleDay] Failed to clone .day-schedule-card from template!");
                setLoadingState('schedule', false);
                return;
            }
            ui.singleDayPlanView.innerHTML = '';
            ui.singleDayPlanView.appendChild(dayCard);
        } else {
            console.log("[RenderSingleDay] Reusing existing day card structure.");
        }

        dayHeader = dayCard.querySelector('.day-header');
        activitiesContainer = dayCard.querySelector('.activity-list-container');

        if (!dayHeader || !activitiesContainer) {
            console.error("[RenderSingleDay] Day header or activity container missing in day card!");
            setLoadingState('schedule', false);
            return;
        }

        dayCard.style.opacity = '0';

        const activitiesForDay = state.allActivePlanActivitiesByDay[targetDateString] || [];
        activitiesForDay.sort((a, b) => (a.time_slot || '99:99').localeCompare(b.time_slot || '99:99'));

        dayCard.classList.toggle('today', targetDateString === getTodayDateString());
        dayHeader.innerHTML = `${formatDateForDisplay(targetDateString)} ${targetDateString === getTodayDateString() ? '<span>(Dnes)</span>' : ''}`;
        activitiesContainer.innerHTML = '';

        if (activitiesForDay.length > 0) {
            activitiesForDay.forEach(activity => {
                if (!activity.id) return;
                const activityElement = document.createElement('div');
                activityElement.className = `activity-list-item ${activity.completed ? 'completed' : ''}`;
                activityElement.dataset.activityId = activity.id;
                const timeDisplay = activity.time_slot ? `<span class="activity-time-display">${activity.time_slot}</span>` : '';
                const iconClass = getActivityIcon(activity.title, activity.type);
                const hasDescription = activity.description && activity.description.trim().length > 0;
                const expandIcon = hasDescription ? `<button class="expand-icon-button btn-tooltip" aria-label="Rozbalit popis" title="Zobrazit/skrýt popis"><i class="fas fa-chevron-down expand-icon"></i></button>` : '';

                let activityLinkStart = '';
                let activityLinkEnd = '';
                if (activity.type === 'theory' && state.currentStudyPlan?.status === 'active') {
                     activityLinkStart = `<a href="/dashboard/procvicovani/vyuka/vyuka.html?planActivityId=${activity.id}" class="activity-link">`;
                     activityLinkEnd = `</a>`;
                }


                activityElement.innerHTML = `
                    ${activityLinkStart}
                    <label class="activity-checkbox">
                        <input type="checkbox" id="carousel-activity-${activity.id}" ${activity.completed ? 'checked' : ''} data-activity-id="${activity.id}" data-plan-id="${state.currentStudyPlan?.id}">
                    </label>
                    <i class="fas ${iconClass} activity-icon"></i>
                    <div class="activity-details">
                        <div class="activity-header">
                            <div class="activity-title-time">
                                <span class="activity-title">${sanitizeHTML(activity.title || 'Aktivita')}</span>
                                ${timeDisplay}
                            </div>
                            ${expandIcon}
                        </div>
                        ${hasDescription ? `<div class="activity-desc">${sanitizeHTML(activity.description)}</div>` : ''}
                    </div>
                    ${activityLinkEnd}`;

                const expandButtonElem = activityElement.querySelector('.expand-icon-button');
                if (expandButtonElem) {
                    expandButtonElem.addEventListener('click', (e) => {
                        e.preventDefault(); // Zabráníme přechodu odkazu, pokud je přítomen
                        e.stopPropagation();
                        const descElement = activityElement.querySelector('.activity-desc');
                        if (descElement) {
                            activityElement.classList.toggle('expanded');
                        }
                    });
                }
                const checkbox = activityElement.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.addEventListener('click', (e) => e.stopPropagation()); // Zabráníme prokliku na odkaz při kliku na checkbox
                    checkbox.addEventListener('change', async (e) => {
                        e.stopPropagation();
                        const isCompleted = e.target.checked;
                        activityElement.classList.toggle('completed', isCompleted);
                        await handleActivityCompletionToggle(activity.id, isCompleted, state.currentStudyPlan?.id);
                    });
                }
                activitiesContainer.appendChild(activityElement);
            });
        } else {
            activitiesContainer.innerHTML = `<div class="no-activities-day"><i class="fas fa-coffee"></i> Žádné aktivity pro tento den. Užijte si volno!</div>`;
        }

        if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'flex';
        if (ui.currentPlanEmptyState) ui.currentPlanEmptyState.style.display = 'none';

        updateNavigationButtonsState(targetDateString);
        initTooltips();
        setLoadingState('schedule', false);

        requestAnimationFrame(() => {
            dayCard.style.transition = 'opacity 0.3s ease-in-out';
            dayCard.style.opacity = '1';
        });
    };

    const updateNavigationButtonsState = (currentDateString) => {
        if (!ui.prevDayBtn || !ui.nextDayBtn || !state.sortedActivityDates || state.sortedActivityDates.length === 0) {
            if(ui.prevDayBtn) ui.prevDayBtn.style.display = 'none';
            if(ui.nextDayBtn) ui.nextDayBtn.style.display = 'none';
            return;
        }

        const currentIndex = state.sortedActivityDates.indexOf(currentDateString);

        ui.prevDayBtn.style.display = 'inline-flex';
        ui.nextDayBtn.style.display = 'inline-flex';

        ui.prevDayBtn.disabled = currentIndex <= 0;
        ui.nextDayBtn.disabled = currentIndex >= state.sortedActivityDates.length - 1;
    };

     const renderPromptCreatePlan = (container) => {
         if (!container || !ui.promptCreatePlanTemplate) return;
         console.log("[Render] Rendering Prompt Create Plan...");
         if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';

         const node = ui.promptCreatePlanTemplate.content.cloneNode(true);
         const btn = node.getElementById('createNewPlanFromPromptBtn');
         if (btn) btn.addEventListener('click', () => switchTab('create'));
         container.innerHTML = '';
         container.appendChild(node);
         container.style.display = 'flex';
         console.log("[Render] Prompt Create Plan Rendered.");
     };
     const renderNoActivePlan = (container) => {
         if (!container || !ui.noActivePlanTemplate) return;
         console.log("[Render] Rendering No Active Plan...");
         if (ui.dailyPlanCarouselContainer) ui.dailyPlanCarouselContainer.style.display = 'none';

         const node = ui.noActivePlanTemplate.content.cloneNode(true);
         const link = node.querySelector('.link-to-create-tab');
         if (link) link.addEventListener('click', (e) => { e.preventDefault(); switchTab('create'); });
         container.innerHTML = '';
         container.appendChild(node);
         container.style.display = 'flex';
         console.log("[Render] No Active Plan Rendered.");
     };

     const handleActivityCompletionToggle = async (activityId, isCompleted, planId) => { if (!supabaseClient || !planId) return; try { const { error } = await supabaseClient.from('plan_activities').update({ completed: isCompleted, updated_at: new Date().toISOString() }).eq('id', activityId); if (error) throw error; console.log(`[ActivityToggle] Aktivita ${activityId} stav: ${isCompleted}`); await updatePlanProgress(planId); } catch (error) { console.error(`[ActivityToggle] Chyba aktualizace aktivity ${activityId}:`, error); showToast('Nepodařilo se aktualizovat stav aktivity.', 'error'); const checkbox = document.getElementById(`carousel-activity-${activityId}`) || document.getElementById(`vertical-activity-${activityId}`); const activityElement = checkbox?.closest('.activity-list-item'); if(checkbox) checkbox.checked = !isCompleted; if(activityElement) activityElement.classList.toggle('completed', !isCompleted); } };
     const updatePlanProgress = async (planId) => { if (!planId || !supabaseClient) return; console.log(`[PlanProgress] Updating progress for plan ${planId}`); try { const { count: totalCount, error: countError } = await supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId); const { count: completedCount, error: completedError } = await supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId).eq('completed', true); if (countError || completedError) throw countError || completedError; const numTotal = totalCount ?? 0; const numCompleted = completedCount ?? 0; const progress = numTotal > 0 ? Math.round((numCompleted / numTotal) * 100) : 0; console.log(`[PlanProgress] Plan ${planId}: ${numCompleted}/${numTotal} completed (${progress}%)`); const { error: updateError } = await supabaseClient.from('study_plans').update({ progress: progress, updated_at: new Date().toISOString() }).eq('id', planId); if (updateError) throw updateError; console.log(`[PlanProgress] Plan ${planId} progress DB updated to ${progress}%`); if (state.currentStudyPlan?.id === planId) state.currentStudyPlan.progress = progress; } catch (error) { console.error(`[PlanProgress] Error updating plan progress ${planId}:`, error); } };
     const getActivityIcon = (title = '', type = '') => { const lowerTitle = title.toLowerCase(); const lowerType = type?.toLowerCase() || ''; if (activityVisuals[lowerType]) return activityVisuals[lowerType].icon; if (lowerTitle.includes('test')) return activityVisuals.test.icon; if (lowerTitle.includes('cvičení') || lowerTitle.includes('příklad') || lowerTitle.includes('úloh')) return activityVisuals.exercise.icon; if (lowerTitle.includes('procvič')) return activityVisuals.practice.icon; if (lowerTitle.includes('opakování') || lowerTitle.includes('shrnutí')) return activityVisuals.review.icon; if (lowerTitle.includes('geometrie')) return 'fa-draw-polygon'; if (lowerTitle.includes('algebra')) return 'fa-square-root-alt'; if (lowerTitle.includes('procent')) return 'fa-percentage'; if (lowerTitle.includes('analýza') || lowerTitle.includes('kontrola')) return activityVisuals.analysis.icon; if (lowerTitle.includes('lekce') || lowerTitle.includes('teorie')) return activityVisuals.theory.icon; return activityVisuals.default.icon; };

    const loadPlanHistory = async () => {
        if (!supabaseClient || !state.currentUser) return;
        setLoadingState('history', true);
        if(ui.historyPlanContent) ui.historyPlanContent.classList.remove('content-visible');
        try {
            const { data: plans, error } = await supabaseClient.from('study_plans').select('id, title, created_at, status, progress').eq('user_id', state.currentUser.id).order('created_at', { ascending: false });
            if (error) throw error;
            state.previousPlans = plans || [];
            renderPlanHistory(state.previousPlans);
        } catch (error) {
            console.error("Error loading plan history:", error);
            renderMessage(ui.historyPlanContent, 'error', 'Chyba', 'Nepodařilo se načíst historii plánů.');
        } finally {
            setLoadingState('history', false);
        }
    };
    const renderPlanHistory = (plans) => {
        if (!ui.historyPlanContent) return;
        if (!plans || plans.length === 0) {
            renderMessage(ui.historyPlanContent, 'info', 'Žádná historie', 'Zatím jste nevytvořili žádné studijní plány.');
            return;
        }
        ui.historyPlanContent.innerHTML = '';
        ui.historyPlanContent.style.display = 'grid';
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
                if(dateEl) dateEl.textContent = `Vytvořeno: ${formatDate(plan.created_at)}`;
                if(titleEl) titleEl.textContent = plan.title || "Studijní plán";
                if(progressEl) progressEl.innerHTML = `Pokrok: <strong>${plan.progress ?? 0}%</strong>`;
                if(statusEl) {
                    const statusText = plan.status === 'active' ? 'Aktivní' : plan.status === 'completed' ? 'Dokončený' : 'Neaktivní';
                    statusEl.textContent = statusText;
                    statusEl.className = `history-status ${plan.status || 'inactive'}`;
                }
                item.addEventListener('click', () => showPlanDetail(plan));
                ui.historyPlanContent.appendChild(node);
            }
        });
        ui.historyPlanContent.classList.add('content-visible');
        requestAnimationFrame(initScrollAnimations);
    };
    const renderHistorySkeletons = (count) => {
        if (!ui.historyPlanContent) return;
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
    const showPlanDetail = async (plan) => {
        if (!plan || !plan.id || !supabaseClient) return;
        ui.currentPlanSection.classList.remove('visible-section');
        ui.historyPlanSection.classList.remove('visible-section');
        ui.createPlanSection.classList.remove('visible-section');
        ui.planSection.classList.add('visible-section');
        setLoadingState('detail', true);
        if(ui.planContent) ui.planContent.classList.remove('content-visible', 'generated-reveal');
        if(ui.planActions) ui.planActions.innerHTML = '';
        if(ui.planSectionTitle) ui.planSectionTitle.textContent = 'Načítání detailu...';
        if (ui.genericBackBtn) ui.genericBackBtn.onclick = () => {
             state.lastGeneratedMarkdown = null;
             state.lastGeneratedActivitiesJson = null;
             state.lastGeneratedTopicsData = null;
             switchTab('history');
        };
        try {
            if (!plan.plan_content_markdown) {
                console.log("Načítám plný markdown pro detail...");
                const { data: fullData, error: fetchError } = await supabaseClient
                    .from('study_plans')
                    .select('plan_content_markdown, title, created_at, estimated_completion_date')
                    .eq('id', plan.id)
                    .single();
                if (fetchError) throw fetchError;
                plan = { ...plan, ...fullData };
            }
            if(ui.planSectionTitle) ui.planSectionTitle.textContent = plan.title || 'Detail studijního plánu';
            const metaDateEl = document.getElementById('plan-meta-date');
            if (metaDateEl) metaDateEl.textContent = `Vytvořeno: ${formatDate(plan.created_at)}`;
            displayPlanContent(plan.plan_content_markdown || '# Studijní plán\n\nObsah plánu není k dispozici.');
            if (ui.planContent) {
                 ui.planContent.classList.remove('generated-reveal');
                 ui.planContent.classList.add('content-visible');
             }
            if(ui.planActions) {
                ui.planActions.innerHTML = `<button class="btn btn-success btn-tooltip" id="exportDetailPlanBtn" title="Stáhnout plán jako PDF"><i class="fas fa-file-pdf"></i> Export PDF</button>`;
                const exportButton = ui.planActions.querySelector('#exportDetailPlanBtn');
                if(exportButton) exportButton.addEventListener('click', () => exportPlanToPDFWithStyle(plan));
                ui.planActions.style.display = 'flex';
            }
            ui.planSection.scrollIntoView({ behavior: 'smooth' });
            initTooltips();
        } catch (error) {
            console.error("Chyba načítání detailu plánu:", error);
            if(ui.planContent) {
                 renderMessage(ui.planContent, 'error', 'Chyba', 'Nepodařilo se načíst detail plánu.');
                 ui.planContent.classList.add('content-visible');
             }
            if(ui.planActions) ui.planActions.innerHTML = '';
        } finally {
            setLoadingState('detail', false);
        }
    };

    const getLatestDiagnostic = async (showLoaderFlag = true) => { if (!state.currentUser || !supabaseClient) return null; if (showLoaderFlag) setLoadingState('create', true); try { console.log("[getLatestDiagnostic] Fetching diagnostic..."); const { data, error } = await supabaseClient.from('user_diagnostics').select('id, completed_at, total_score, total_questions, topic_results, analysis').eq('user_id', state.currentUser.id).order('completed_at', { ascending: false }).limit(1); if (error) throw error; console.log("[getLatestDiagnostic] Fetched:", data); return (data && data.length > 0) ? data[0] : false; } catch (error) { console.error("Error fetching diagnostic:", error); return null; } finally { if (showLoaderFlag) setLoadingState('create', false); } };
    const checkPlanCreationAvailability = async () => { console.log("[CreateCheck] Starting check..."); setLoadingState('create', true); if(ui.createPlanContent) ui.createPlanContent.classList.remove('content-visible'); try { console.log("[CreateCheck] Fetching latest diagnostic..."); state.latestDiagnosticData = await getLatestDiagnostic(false); console.log("[CreateCheck] Diagnostic fetched:", state.latestDiagnosticData); if (state.latestDiagnosticData === null) { renderMessage(ui.createPlanContent, 'error', 'Chyba', 'Nepodařilo se ověřit váš diagnostický test.'); return; } else if (state.latestDiagnosticData === false) { renderNoDiagnosticAvailable(ui.createPlanContent); return; } console.log("[CreateCheck] Checking cooldown..."); const { data: latestPlan, error: planError } = await supabaseClient.from('study_plans').select('created_at').eq('user_id', state.currentUser.id).order('created_at', { ascending: false }).limit(1); if (planError) throw planError; console.log("[CreateCheck] Cooldown check - Latest plan:", latestPlan); let canCreate = true; if (latestPlan && latestPlan.length > 0) { const lastPlanDate = new Date(latestPlan[0].created_at); const cooldownDate = new Date(lastPlanDate); cooldownDate.setDate(cooldownDate.getDate() + PLAN_GENERATION_COOLDOWN_DAYS); console.log("[CreateCheck] Cooldown date:", cooldownDate, "Current date:", new Date()); if (new Date() < cooldownDate) { canCreate = false; state.nextPlanCreateTime = cooldownDate; } } state.planCreateAllowed = canCreate; if (!ui.createPlanContent) { console.error("[CreateCheck] Error: createPlanContent container not found!"); showGlobalError("Chyba zobrazení: Chybí element pro vytvoření plánu."); return; } if (canCreate) { renderPlanCreationForm(ui.createPlanContent); } else { renderLockedPlanSection(ui.createPlanContent); } } catch (error) { console.error('[CreateCheck] Error checking plan creation availability:', error); if(ui.createPlanContent) renderMessage(ui.createPlanContent, 'error', 'Chyba', 'Nepodařilo se ověřit možnost vytvoření plánu.'); else showGlobalError('Nepodařilo se ověřit možnost vytvoření plánu: ' + error.message); } finally { setLoadingState('create', false); console.log("[CreateCheck] Check finished."); } };
    const renderNoDiagnosticAvailable = (container) => { if (!container || !ui.noDiagnosticTemplate) return; console.log("[Render] Rendering No Diagnostic Available..."); const node = ui.noDiagnosticTemplate.content.cloneNode(true); const btn = node.getElementById('goToTestBtn'); if(btn) btn.onclick = () => window.location.href = '/dashboard/procvicovani/test1.html'; container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); console.log("[Render] No Diagnostic Available Rendered."); };
    const renderLockedPlanSection = (container) => { if(!container || !ui.lockedPlanTemplate) return; console.log("[Render] Rendering Locked Plan Section..."); const node = ui.lockedPlanTemplate.content.cloneNode(true); const timerEl = node.getElementById('nextPlanTimer'); const viewBtn = node.getElementById('viewCurrentPlanBtnLocked'); if(timerEl) updateNextPlanTimer(timerEl); if(viewBtn) viewBtn.addEventListener('click', () => switchTab('current')); container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); startPlanTimer(); console.log("[Render] Locked Plan Section Rendered."); };
    const startPlanTimer = () => { if (state.planTimerInterval) clearInterval(state.planTimerInterval); state.planTimerInterval = setInterval(() => { const timerEl = document.getElementById('nextPlanTimer'); if (timerEl && document.body.contains(timerEl)) updateNextPlanTimer(timerEl); else clearInterval(state.planTimerInterval); }, 1000); };
    const updateNextPlanTimer = (el) => { if (!state.nextPlanCreateTime || !el) return; const now = new Date(); const diff = state.nextPlanCreateTime - now; if (diff <= 0) { el.textContent = 'Nyní'; clearInterval(state.planTimerInterval); state.planCreateAllowed = true; if(state.currentTab === 'create') setTimeout(checkPlanCreationAvailability, 500); return; } const d = Math.floor(diff/(1000*60*60*24)), h = Math.floor((diff%(1000*60*60*24))/(1000*60*60)), m = Math.floor((diff%(1000*60*60))/(1000*60)), s = Math.floor((diff%(1000*60))/1000); el.textContent = `${d}d ${h}h ${m}m ${s}s`; };
    const renderPlanCreationForm = (container) => { if (!container || !ui.createPlanFormTemplate || !state.latestDiagnosticData) { console.error("[Render] Missing container, CreatePlan template, or diagnostic data."); renderMessage(container, 'error', 'Chyba', 'Nelze zobrazit formulář pro vytvoření plánu.'); return; } console.log("[Render] Rendering Plan Creation Form..."); const node = ui.createPlanFormTemplate.content.cloneNode(true); const diagInfo = node.getElementById('diagnosticInfo'); if (diagInfo) { const score = state.latestDiagnosticData.total_score ?? '-'; const totalQ = state.latestDiagnosticData.total_questions ?? '-'; diagInfo.innerHTML = `<p>Plán bude vycházet z testu ze dne: <strong>${formatDate(state.latestDiagnosticData.completed_at)}</strong> (Skóre: ${score}/${totalQ})</p>`; } else { console.warn("[Render] Diagnostic info element not found in template."); } const genBtnTemplate = node.querySelector('#generatePlanBtn'); if (genBtnTemplate) { console.log("[Render] Button #generatePlanBtn found in template clone."); const genBtnId = 'generatePlanBtn'; genBtnTemplate.id = genBtnId; container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); const actualGenBtn = document.getElementById(genBtnId); if (actualGenBtn) { actualGenBtn.addEventListener('click', handleGenerateClick); console.log("[Render] Event listener added to #generatePlanBtn."); } else { console.error("[Render] Failed to find #generatePlanBtn in the DOM after appending!"); } } else { console.error("[Render] Button #generatePlanBtn NOT FOUND in template clone!"); container.innerHTML = ''; container.appendChild(node); container.classList.add('content-visible'); } console.log("[Render] Plan Creation Form Rendered function finished."); };
    const handleGenerateClick = function() { if (state.isLoading.generation) return; this.disabled = true; this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generuji plán...'; generateStudyPlan(); };

    // --- NEW: _getGoalSpecificPromptPart function ---
    const _getGoalSpecificPromptPart = (learningGoal, diagnosticData, goalDetails, topicsData) => {
        const testScore = diagnosticData?.total_score ?? '-';
        const totalQuestions = diagnosticData?.total_questions ?? '-';
        const analysis = diagnosticData?.analysis || {};
        const overallAssessment = analysis.summary?.overall_assessment || 'N/A';
        const strengths = analysis.strengths?.map(s => `${s.topic} (${s.score}%)`).join(', ') || 'Nebyly identifikovány';
        const weaknesses = analysis.weaknesses?.map(w => `${w.topic} (${w.score}%)`).join(', ') || 'Nebyly identifikovány';

        let goalSpecificText = "";

        switch (learningGoal) {
            case 'exam_prep':
                goalSpecificText = `
# Kontext cíle: Příprava na Přijímačky (9. třída ZŠ)
# Výsledky diagnostického testu:
- Celkové skóre: ${testScore}/${totalQuestions} bodů
- Výsledky podle témat (Název tématu: Úspěšnost %):
${topicsData.map(topic => `  - ${topic.name}: ${topic.percentage}%`).join('\n')}
# Analýza výsledků testu (Shrnutí od AI):
- Celkové hodnocení: ${overallAssessment}
- Identifikované silné stránky: ${strengths}
- Identifikované slabé stránky: ${weaknesses}
# TVŮJ ÚKOL:
# Vytvoř plán s důrazem na slabé stránky z diagnostiky, s příklady a úlohami na úrovni přijímacích zkoušek.
# Zaměř se na 1-2 nejslabší témata.
`;
                break;

            case 'math_review':
                const gradeReview = goalDetails?.grade || 'Nespecifikováno';
                // Предполагается, что state.allExamTopicsAndSubtopics содержит {id, name, subtopics: [{id, name}]}
                const topicRatingsText = goalDetails?.topic_ratings
                    ? Object.entries(goalDetails.topic_ratings).map(([topicId, ratings]) => {
                        const mainTopic = state.allExamTopicsAndSubtopics?.find(t => String(t.id) === topicId);
                        const mainTopicName = mainTopic?.name || `Téma ID ${topicId}`;
                        let subtopicRatingsText = "";
                        if (ratings.subtopics && Object.keys(ratings.subtopics).length > 0) {
                            subtopicRatingsText = Object.entries(ratings.subtopics).map(([subId, ratingVal]) => {
                                const subTopic = mainTopic?.subtopics?.find(st => String(st.id) === subId);
                                const subTopicName = subTopic?.name || `Podtéma ID ${subId}`;
                                return `    - ${subTopicName}: ${ratingVal} hvězdiček`;
                            }).join('\n');
                        }
                        return `  - ${mainTopicName} (Celkově): ${ratings.overall} hvězdiček\n${subtopicRatingsText}`;
                    }).join('\n')
                    : "Nebylo poskytnuto sebehodnocení témat.";

                goalSpecificText = `
# Kontext cíle: Doplnění mezer v matematice
# Informace o studentovi:
# - Aktuální ročník: ${gradeReview}
# - Sebehodnocení témat (1=vůbec nerozumím, 5=ovládám perfektně):
${topicRatingsText}
# (Volitelně) Výsledky diagnostického testu (pokud relevantní pro doplnění mezer):
- Slabé stránky z diagnostiky: ${weaknesses}
# TVŮJ ÚKOL:
# Vytvoř plán zaměřený na MAXIMÁLNĚ 2-3 základní témata, kde student projevil největší nejistotu (nízké sebehodnocení nebo slabý výsledek v testu).
# Důraz na jasné vysvětlení základů, mnoho jednoduchých a středně těžkých řešených příkladů. Sobotní test jako krátká prověrka.
`;
                break;

            case 'math_accelerate':
                const gradeAccelerate = goalDetails?.grade || 'Nespecifikováno';
                const intensity = goalDetails?.intensity || 'Střední';
                const areas = goalDetails?.accelerate_areas?.length > 0 ? goalDetails.accelerate_areas.join(', ') : "neupřesněno";
                const reason = goalDetails?.accelerate_reason || 'Nespecifikováno';
                const professionText = goalDetails?.accelerate_reason === 'professional_needs' && goalDetails?.profession ? `\n# - Specifická profese/oblast zájmu: ${goalDetails.profession}` : "";
                goalSpecificText = `
# Kontext cíle: Učení napřed v matematice
# Informace o studentovi:
# - Aktuální ročník: ${gradeAccelerate}
# - Preferovaná intenzita: ${intensity}
# - Oblasti zájmu pro pokročilé studium: ${areas}
# - Důvod pro učení napřed: ${reason}${professionText}
# TVŮJ ÚKOL:
# Vytvoř plán pro 1-2 témata, která jsou logickým pokročilým krokem nebo odpovídají zájmům studenta.
# Zahrň nové koncepty, náročné příklady. Pokud je relevantní, ukaž spojitost s profesí.
# Sobota: "challenge problem" nebo malý projekt.
`;
                break;

            case 'math_explore':
                const gradeExplore = goalDetails?.grade || 'Nespecifikováno';
                goalSpecificText = `
# Kontext cíle: Volné prozkoumávání matematiky
# Informace o studentovi:
# - Aktuální ročník: ${gradeExplore}
# TVŮJ ÚKOL:
# Vytvoř ŠABLONOVITÝ týdenní plán, který studenta povede v SAMOSTATNÉM výběru a studiu matematických témat.
# Nepředepisuj konkrétní témata, ale kroky (výběr tématu, rešerše, studium teorie, příklady, shrnutí).
# Můžeš v Markdownu navrhnout 5-7 různých témat vhodných pro ročník studenta jako inspiraci.
# JSON aktivity budou obecné. Sobota: Projektový den.
`;
                break;
            default:
                console.warn(`Neznámý cíl '${learningGoal}', použije se výchozí/exam_prep logika pro část proмпта.`);
                goalSpecificText = `
# Kontext cíle: Příprava na Přijímačky (9. třída ZŠ) - VÝCHOZÍ
# Výsledky diagnostického testu:
- Celkové skóre: ${testScore}/${totalQuestions} bodů
- Slabé stránky z diagnostiky: ${weaknesses}
# TVŮJ ÚKOL:
# Vytvoř plán s důrazem na slabé stránky z diagnostiky.
# Zaměř se na 1-2 nejslabší témata.
`;
        }
        return goalSpecificText;
    };


    const generateStudyPlan = async () => {
        if (!state.latestDiagnosticData || !state.currentUser || !state.currentProfile) { showToast('Chybí data pro generování.', 'error'); return; }
        if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) { showToast('Chyba: Nastavte platný Gemini API klíč v kódu.', 'error'); return; }
        ui.currentPlanSection.classList.remove('visible-section');
        ui.historyPlanSection.classList.remove('visible-section');
        ui.createPlanSection.classList.remove('visible-section');
        ui.planSection.classList.add('visible-section');
        setLoadingState('generation', true);
        if (ui.planContent) {
             ui.planContent.innerHTML = '';
             ui.planContent.classList.remove('content-visible', 'generated-reveal');
        }
        if (ui.planActions) ui.planActions.style.display = 'none';
        if (ui.planSectionTitle) ui.planSectionTitle.textContent = 'Generování plánu...';
        if (ui.genericBackBtn) ui.genericBackBtn.onclick = () => {
             state.lastGeneratedMarkdown = null;
             state.lastGeneratedActivitiesJson = null;
             state.lastGeneratedTopicsData = null;
             switchTab('create');
        };
        try {
            const topicsData = Object.entries(state.latestDiagnosticData.topic_results || {}).map(([topicKey, data]) => ({ name: data.name || state.topicMap[topicKey] || `Téma ${topicKey}`, percentage: data.score_percent || 0 })).sort((a, b) => a.percentage - b.percentage);
            state.lastGeneratedTopicsData = topicsData;

            // --- MODIFIED PART - Dynamic prompt generation ---
            const learningGoal = state.currentProfile.learning_goal;
            const goalDetails = state.currentProfile.preferences?.goal_details;
            const goalSpecificPromptPart = _getGoalSpecificPromptPart(learningGoal, state.latestDiagnosticData, goalDetails, topicsData);

            const baseInstructions = `
Jsi expertní AI tutor specializující se na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v Česku. Tvým úkolem je vytvořit EXTRÉMNĚ DETAILNÍ, ZAMĚŘENÝ a STRUKTUROVANÝ týdenní studijní plán (Pondělí - Sobota, Neděle volno) v ČEŠTINĚ ve formátu Markdown. Cílem je hluboké porozumění a procvičení **JEDNOHO NEBO DVOU NEJSLABŠÍCH TÉMAT** týdně, nikoli povrchní pokrytí mnoha oblastí. Důraz klad na PRAKTICKÉ PŘÍKLADY a OPAKOVÁNÍ. Na konci MUSÍŠ vygenerovat JSON pole aktivit pro tento plán.
# HLAVNÍ PRAVIDLA (DODRŽUJ NAPROSTO VŽDY!):
1.  **Výběr Téma/Témat:** (Toto bude přepsáno specifickou částí pro cíl)
2.  **Struktura Týdne (Po-So):** Vytvoř DETAILNÍ denní plán pro Pondělí až Sobotu. Neděle je volná.
3.  **Denní Rozvrh:** Rozděl studium každého dne (cca 60-90 minut) do 2-3 bloků s KONKRÉTNÍMI úkoly. Zaměř se na střídání:
    * **Teorie/Vysvětlení:** Krátké zopakování nebo vysvětlení **konkrétního pod-tématu**.
    * **Řešené Příklady:** Projití a analýza **několika (2-3)** řešených příkladů na dané pod-téma.
    * **Samostatné Procvičování:** Zadání **SPECIFICKÉHO počtu příkladů** k vyřešení. Buď VELMI KONKRÉTNÍ.
    * **Opakování:** Krátké opakování předchozího dne nebo týdne.
4.  **Sobota - Opakovací Test/Projekt:** (Toto bude přepsáno specifickou částí pro cíl)
5.  **DETAILNÍ Popis v Markdown:** V Markdown části pro každý den jasně popiš **CO** se má student učit a **JAKÉ KONKRÉTNÍ** úkoly má dělat.
6.  **JSON Aktivity (KRITICKÉ!):** Na konci, v bloku \`\`\`json ... \`\`\`, vygeneruj pole JSON objektů. KAŽDÝ objekt reprezentuje JEDEN studijní blok. Každý objekt MUSÍ obsahovat:
    * \`"day_of_week"\`: Číslo dne (0=Po, ..., 5=So). POZOR: Gemini někdy používá 1-6. Musíme to pořešit v kódu. Pro Gemini Po=0, Út=1, St=2, Čt=3, Pá=4, So=5.
    * \`"title"\`: **VELMI SPECIFICKÝ název aktivity**.
    * \`"description"\`: **VELMI SPECIFICKÝ popis úkolu**. **NESMÍ obsahovat obecné fráze**.
    * \`"time_slot"\`: Odhadovaný čas bloku (např., "40 min", "cca 30-45 min").
    * \`"type"\`: Typ aktivity (např., "theory", "practice", "example", "test", "review", "research", "project").
7.  **KONZISTENCE JSON a Markdown:** Obsah JSON objektů musí PŘESNĚ odpovídat Markdown.
8.  **Rada pro Plán:** Na konci Markdown přidej krátkou radu.
# Požadovaný formát výstupu (Markdown + JSON na konci):
**Analýza diagnostiky/cíle:**
* Zaměření tento týden na: [Vybrané téma/témata nebo cíl]
---
### Pondělí (Den 0)
* **Fokus dne:** [Pod-téma 1]
* **Blok 1 (čas): Typ - [Název]:** ... (Popis)
* **Blok 2 (čas): Typ - [Název]:** ... (Popis)
...
### Sobota (Den 5)
* **Fokus dne:** Týdenní opakování / Projekt
* **Blok 1 (čas): Typ - [Název]:** ... (Popis)
---
**Rada pro práci s plánem:**
* Důsledně dodržujte časové bloky...
---
\`\`\`json
[
  { "day_of_week": 0, "type": "...", "title": "...", "description": "...", "time_slot": "..." },
  { "day_of_week": 0, "type": "...", "title": "...", "description": "...", "time_slot": "..." },
  ...
  { "day_of_week": 5, "type": "...", "title": "...", "description": "...", "time_slot": "..." }
]
\`\`\`
`;
            const finalPrompt = `${goalSpecificPromptPart}\n${baseInstructions}`; // Skládáme finální prompt
            // --- END MODIFIED PART ---

            const fullMarkdownResponse = await generatePlanContentWithGeminiAPI(finalPrompt); // Renamed original function
            const jsonRegex = /```json\s*([\s\S]*?)\s*```/; const jsonMatch = fullMarkdownResponse.match(jsonRegex);
            let activitiesArray = null; let planMarkdownForStorage = fullMarkdownResponse;
            if (jsonMatch && jsonMatch[1]) {
                try { activitiesArray = JSON.parse(jsonMatch[1].replace(/\u00A0/g, ' ').trim()); planMarkdownForStorage = fullMarkdownResponse.replace(jsonRegex, '').trim(); state.lastGeneratedActivitiesJson = activitiesArray; }
                catch (e) { console.error("Error parsing JSON activities:", e); showToast("Warning: Nepodařilo se zpracovat aktivity z plánu.", "warning"); state.lastGeneratedActivitiesJson = null; }
            } else { console.warn("JSON block of activities not found."); state.lastGeneratedActivitiesJson = null; }
            state.lastGeneratedMarkdown = planMarkdownForStorage;
            if(ui.planSectionTitle) ui.planSectionTitle.textContent = 'Návrh studijního plánu';
            setLoadingState('generation', false);
            if(ui.planContent) {
                ui.planContent.classList.remove('generated-reveal');
                displayPlanContent(state.lastGeneratedMarkdown);
                requestAnimationFrame(() => {
                     if (ui.planContent) {
                          ui.planContent.classList.add('content-visible', 'generated-reveal');
                     }
                });
            }
            renderPreviewActions();
            ui.planSection.scrollIntoView({ behavior: 'smooth' });
            initTooltips();
        } catch (error) {
            console.error('Plan generation error:', error);
            setLoadingState('generation', false);
            if (ui.planContent) {
                 renderMessage(ui.planContent, 'error', 'Chyba generování', error.message);
                 ui.planContent.classList.add('content-visible');
             }
            renderPreviewActions(true);
        }
    };

    // Renamed original generatePlanContentWithGemini to avoid conflict
    const generatePlanContentWithGeminiAPI = async (prompt) => {
        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.5, topK: 30, topP: 0.9, maxOutputTokens: 8192 },
                    safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ]
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || `Chyba Gemini API (${response.status})`);
            const geminiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!geminiResponse) {
                if (data.promptFeedback?.blockReason) throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}.`);
                const finishReason = data.candidates?.[0]?.finishReason;
                if(finishReason && finishReason !== 'STOP') throw new Error(`AI dokončilo s důvodem: ${finishReason}.`);
                throw new Error('Prázdná odpověď od Gemini API.');
            }
            console.log("Gemini response received length:", geminiResponse.length);
            return geminiResponse;
        } catch (error) {
            console.error('Chyba při generování obsahu plánu (API call):', error);
            throw error;
        }
    };

    const renderPreviewActions = (isError = false) => {
        if (!ui.planActions) return;
        let buttonsHTML = '';
        if (isError) {
            buttonsHTML = `<button class="btn btn-secondary" id="regeneratePlanBtn"><i class="fas fa-sync-alt"></i> Vygenerovat znovu</button>`;
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
        if (saveBtn) {
            saveBtn.addEventListener('click', handleSaveGeneratedPlanClick);
        }
        if (exportBtn) {
             const tempPlanData = {
                 created_at: new Date(),
                 plan_content_markdown: state.lastGeneratedMarkdown,
                 title: "Nový návrh plánu"
             };
             exportBtn.addEventListener('click', () => exportPlanToPDFWithStyle(tempPlanData));
        }
        if (regenBtn) {
            regenBtn.addEventListener('click', function() {
                if (state.isLoading.generation) return;
                this.disabled = true;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generuji znovu...';
                generateStudyPlan();
            });
        }
        ui.planActions.style.display = 'flex';
        initTooltips();
    };
    const handleSaveGeneratedPlanClick = async function() {
        if (!state.currentUser || !state.latestDiagnosticData || !state.lastGeneratedMarkdown || !supabaseClient) {
            showToast('Chyba: Chybí data pro uložení.', 'error'); return;
        }
        const saveButton = this;
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...';
        const markdownContent = state.lastGeneratedMarkdown;
        const activitiesArray = state.lastGeneratedActivitiesJson;
        const topicsData = state.lastGeneratedTopicsData; // Ensure this is populated
        const priorityTopics = {};
        if (topicsData && Array.isArray(topicsData)) {
            topicsData.forEach((topic, index) => {
                priorityTopics[topic.name] = { priority: index + 1, performance: topic.percentage, focus_level: topic.percentage < 50 ? 'high' : topic.percentage < 75 ? 'medium' : 'low' };
            });
        } else {
             console.warn("Missing topicsData in state during save.");
        }
        let savedPlanId = null;
        try {
            const { error: deactivateError } = await supabaseClient
                .from('study_plans')
                .update({ status: 'inactive', updated_at: new Date().toISOString() })
                .eq('user_id', state.currentUser.id)
                .eq('status', 'active');
            if (deactivateError) throw deactivateError;
            const today = new Date();
            const completionDate = new Date(today);
            completionDate.setDate(completionDate.getDate() + 7); // Default 7 day plan
            const newPlanData = {
                user_id: state.currentUser.id,
                title: `Studijní plán (${formatDate(today)}) - ${state.currentProfile?.learning_goal || 'Neznámý cíl'}`, // Přidání cíle do názvu
                subject: "Matematika",
                status: "active",
                diagnostic_id: state.latestDiagnosticData.id,
                plan_content_markdown: markdownContent,
                priority_topics: priorityTopics,
                estimated_completion_date: completionDate.toISOString().split('T')[0],
                progress: 0,
                is_auto_adjusted: true,
                learning_goal_at_creation: state.currentProfile?.learning_goal // Uložení cíle při vytváření
            };
            const { data: savedPlan, error: insertPlanError } = await supabaseClient
                .from('study_plans')
                .insert(newPlanData)
                .select('id')
                .single();
            if (insertPlanError) throw insertPlanError;
            savedPlanId = savedPlan.id;
            console.log("Nový plán uložen, ID:", savedPlanId);
            if (activitiesArray && Array.isArray(activitiesArray) && activitiesArray.length > 0) {
                const activitiesToInsert = activitiesArray.map(act => {
                    if (typeof act !== 'object' || act === null) return null;
                     // Gemini může vracet day_of_week jako 0-6 (Po-Ne) nebo 1-7.
                     // Naše DB očekává 0=Po, 1=Út, ..., 6=Ne.
                    let dbDayOfWeek = parseInt(act.day_of_week, 10);
                    if (isNaN(dbDayOfWeek)) return null; // Neplatný den

                    // Pokud Gemini vrací 1 (Po) až 7 (Ne), převedeme na 0-6
                    // if (dbDayOfWeek >= 1 && dbDayOfWeek <= 7) {
                    //     dbDayOfWeek = dbDayOfWeek - 1; // Po(1)->0, ..., Ne(7)->6
                    // }
                    // Pokud Gemini vrací 0 (Po) až 5 (So), je to v pořádku pro naši logiku (0-6)
                    if (dbDayOfWeek < 0 || dbDayOfWeek > 6) return null; // Neplatný den mimo rozsah

                    return {
                        plan_id: savedPlanId,
                        day_of_week: dbDayOfWeek, // Použijeme upravenou hodnotu
                        time_slot: act.time_slot || null,
                        title: act.title || 'Nespecifikováno',
                        description: act.description || null,
                        type: act.type || getActivityTypeFromTitle(act.title),
                        completed: false
                    };
                }).filter(item => item !== null);
                if (activitiesToInsert.length > 0) {
                    const { error: insertActivitiesError } = await supabaseClient
                        .from('plan_activities')
                        .insert(activitiesToInsert);
                    if (insertActivitiesError) {
                        console.error("Chyba vkládání aktivit:", insertActivitiesError);
                        showToast('Plán uložen, ale aktivity pro harmonogram selhaly.', 'warning');
                    } else {
                        console.log("Aktivity úspěšně vloženy.");
                        showToast('Studijní plán a aktivity uloženy!', 'success');
                    }
                } else {
                    showToast('Plán uložen, ale nebyly nalezeny platné aktivity v JSON.', 'warning');
                }
            } else {
                showToast('Studijní plán uložen (bez detailních aktivit).', 'info');
            }
             state.lastGeneratedMarkdown = null;
             state.lastGeneratedActivitiesJson = null;
             state.lastGeneratedTopicsData = null;
            state.currentStudyPlan = { ...newPlanData, id: savedPlanId }; // Aktualizujeme currentStudyPlan
            switchTab('current'); // Přepneme na zobrazení aktuálního plánu
        } catch (error) {
            console.error("Chyba při ukládání plánu:", error);
            showToast(`Nepodařilo se uložit plán: ${error.message}`, 'error');
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML = '<i class="fas fa-save"></i> Uložit tento plán';
            }
        }
    };
    const displayPlanContent = (markdownContent) => {
        if (!ui.planContent) return;
        try {
            marked.setOptions({ gfm: true, breaks: true, sanitize: false });
            const htmlContent = marked.parse(markdownContent || '');
            ui.planContent.innerHTML = htmlContent;
            if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
                setTimeout(() => {
                    window.MathJax.typesetPromise([ui.planContent]).catch(e => console.error("MathJax error:", e));
                }, 0);
            }
        } catch (e) {
            console.error("Markdown rendering error:", e);
             if(ui.planContent) {
                 renderMessage(ui.planContent, 'error', 'Chyba zobrazení plánu', e.message);
                 ui.planContent.classList.add('content-visible');
             }
        }
    };
    const getActivityTypeFromTitle = (title = "") => { const lower = title.toLowerCase(); if (lower.includes('test')) return 'test'; if (lower.includes('procvičování') || lower.includes('příklad')) return 'practice'; if (lower.includes('řešené')) return 'example'; if (lower.includes('cvičení')) return 'exercise'; if (lower.includes('lekce') || lower.includes('teorie') || lower.includes('vysvětlení')) return 'theory'; if (lower.includes('opakování') || lower.includes('shrnutí')) return 'review'; if (lower.includes('analýza')) return 'analysis'; return 'other'; };
    const exportPlanToPDFWithStyle = async (plan) => {
        if (!plan) return;
        if (!plan.plan_content_markdown && plan.id) {
            showToast('Načítám data pro PDF...', 'info', 2000);
            try {
                const { data: fullPlanData, error } = await supabaseClient
                    .from('study_plans')
                    .select('plan_content_markdown, title, created_at, estimated_completion_date')
                    .eq('id', plan.id)
                    .single();
                if (error) throw error;
                plan = { ...plan, ...fullPlanData };
            } catch (fetchError) {
                console.error("Nepodařilo se načíst markdown pro export:", fetchError);
                showToast('Chyba: Nepodařilo se načíst data pro export.', 'error');
                return;
            }
        } else if (!plan.plan_content_markdown) {
             showToast('Chyba: Chybí obsah plánu pro export.', 'error');
             return;
        }
        const exportContainer = document.createElement('div');
        exportContainer.id = 'pdf-export-content';
        const pdfStyles = `
        <style>
            body { font-family: 'Poppins', Arial, sans-serif; font-size: 10pt; color: #333; line-height: 1.5; }
            #pdf-export-content { padding: 18mm 13mm; }
            .pdf-header { text-align: center; margin-bottom: 12mm; border-bottom: 1px solid #ccc; padding-bottom: 4mm; }
            .pdf-header h1 { color: #4361ee; font-size: 18pt; margin: 0 0 4px 0; font-weight: 600; }
            .pdf-header p { color: #6c757d; font-size: 9pt; margin: 0; }
            .student-info { background-color: #f8f9fa; padding: 8mm 10mm; border-radius: 8px; border: 1px solid #eee; margin-bottom: 10mm; font-size: 9pt; break-inside: avoid; }
            .student-info h2 { color: #3f37c9; font-size: 12pt; margin: 0 0 6px 0; padding-bottom: 3px; border-bottom: 1px dotted #ccc; font-weight: 600;}
            .student-info p { margin: 0 0 3px 0; line-height: 1.4; }
            .student-info strong { font-weight: 600; color: #1e2a3a; }
            .pdf-content h2, .pdf-content h3, .pdf-content h4 { margin-top: 7mm; margin-bottom: 3mm; padding-bottom: 2px; font-weight: 600; break-after: avoid; }
            .pdf-content h2 { font-size: 13pt; color: #3f37c9; border-bottom: 1px solid #eee; }
            .pdf-content h3 { font-size: 11.5pt; color: #1e2a3a; border-bottom: 1px dotted #ccc; }
            .pdf-content h4 { font-size: 10.5pt; color: #4361ee; border-bottom: none; margin-top: 5mm; }
            .pdf-content p, .pdf-content li { margin-bottom: 2.5mm; color: #333; text-align: left; }
            .pdf-content ul, .pdf-content ol { padding-left: 5mm; margin-left: 3mm; margin-bottom: 4mm; break-inside: avoid;}
            .pdf-content li { margin-bottom: 1.5mm; }
            .pdf-content strong { font-weight: 600; color: #000; }
            .pdf-content em { font-style: italic; color: #555; }
            .pdf-content code { font-family: 'Courier New', Courier, monospace; background-color: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 9pt; color: #c7254e; }
            .pdf-content pre { background-color: #f8f9fa; border: 1px solid #eee; padding: 3mm; margin: 4mm 0; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word; font-size: 9pt; break-inside: avoid; }
            .pdf-content blockquote { border-left: 3px solid #ccc; padding-left: 4mm; margin: 4mm 0 4mm 2mm; color: #555; font-style: italic; break-inside: avoid; }
            .pdf-content hr { border: none; border-top: 1px dashed #ccc; margin: 6mm 0; }
            .pdf-day-block { break-before: auto; break-inside: avoid; }
            .pdf-footer { text-align: center; margin-top: 10mm; padding-top: 5mm; border-top: 1px solid #ccc; color: #888; font-size: 8pt; }
        </style>
        `;
        exportContainer.innerHTML += pdfStyles;
        const pdfTitle = plan.title ? plan.title.replace(/\s*\(\d{2}\.\d{2}\.\d{4}\)\s*-\s*.*/, '').trim() : 'Studijní plán'; // Odebrání data a cíle z názvu
        exportContainer.innerHTML += `
            <div class="pdf-header">
                <h1>${sanitizeHTML(pdfTitle)}</h1>
                <p>Vytvořeno: ${formatDate(plan.created_at)}</p>
            </div>`;
        if (state.currentUser && ui.sidebarName?.textContent) {
            exportContainer.innerHTML += `
                <div class="student-info">
                    <h2>Informace o studentovi</h2>
                    <p><strong>Student:</strong> ${ui.sidebarName.textContent}</p>
                    <p><strong>Datum vytvoření plánu:</strong> ${formatDate(plan.created_at)}</p>
                    ${plan.estimated_completion_date ? `<p><strong>Předpokládané dokončení:</strong> ${formatDate(plan.estimated_completion_date)}</p>` : ''}
                     ${plan.learning_goal_at_creation ? `<p><strong>Cíl plánu:</strong> ${getGoalDisplayName(plan.learning_goal_at_creation)}</p>` : ''}
                </div>`;
        }
        const contentDiv = document.createElement('div');
        contentDiv.className = 'pdf-content';
        try {
            const rawHtml = marked.parse(plan.plan_content_markdown || '');
            contentDiv.innerHTML = rawHtml;
             const daysCzech = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
             contentDiv.querySelectorAll('h3').forEach(h3 => {
                 if (daysCzech.some(day => h3.textContent.trim().startsWith(day))) {
                     h3.classList.add('pdf-day-block');
                 }
             });
        } catch (e) { contentDiv.innerHTML = '<p>Chyba při zpracování obsahu plánu.</p>'; }
        exportContainer.appendChild(contentDiv);
        exportContainer.innerHTML += `<div class="pdf-footer">&copy; ${new Date().getFullYear()} Justax.space</div>`;
        const options = {
            margin: [18, 13, 18, 13],
            filename: `studijni-plan-${formatDate(plan.created_at).replace(/\./g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'avoid-all'] }
        };
        if (typeof html2pdf === 'function') {
             showToast('Generuji PDF...', 'info', 5000);
            html2pdf().set(options).from(exportContainer).save()
                .then(() => { showToast('PDF bylo úspěšně vygenerováno!', 'success'); })
                .catch(err => { console.error("Chyba exportu PDF:", err); showToast('Nepodařilo se exportovat PDF.', 'error'); });
        } else {
            showToast('Chyba: Knihovna pro export PDF není načtena.', 'error');
        }
    };

    // --- Helper function to get goal display name (can be expanded) ---
    function getGoalDisplayName(goalKey) {
        const goalMap = {
            'exam_prep': 'Příprava na přijímačky',
            'math_accelerate': 'Učení napřed',
            'math_review': 'Doplnění mezer',
            'math_explore': 'Volné prozkoumávání',
        };
        return goalMap[goalKey] || goalKey || 'Neznámý cíl';
    }


    document.addEventListener('DOMContentLoaded', initializeApp);

})();