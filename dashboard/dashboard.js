// dashboard.js
// Версия: 24 - Добавлена логика для отображения майских титулов в Měsíční Odměny
(function() {
    'use strict';

    // --- START: Initialization and Configuration ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = []; // Stores available titles from DB

    let isLoading = { stats: false, activities: false, notifications: false, titles: false, monthlyRewards: false, streakMilestones: false };
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState'; // Key for localStorage

    const MONTHLY_REWARD_DAYS = 31; // Usually 31 for safety, logic handles actual days
    const MILESTONE_REWARDS_CONFIG = { // Configuration for streak rewards
        5: { name: "První Krůčky", description: "Gratulujeme k 5 dnům v řadě!", icon: "fa-shoe-prints", reward_type: "points", reward_value: 10 },
        10: { name: "Stabilních 10", description: "Udržujete tempo!", icon: "fa-star", reward_type: "points", reward_value: 25 },
        15: { name: "Patnáctka", description: "Půl cesty k měsíci!", icon: "fa-adjust", reward_type: "points", reward_value: 50 },
        20: { name: "Dvacítka!", description: "Pěkná série!", icon: "fa-angle-double-up", reward_type: "points", reward_value: 75 },
        30: { name: "Měsíc Bez Přestávky!", description: "Stabilita se vyplácí.", icon: "fa-calendar-check", reward_type: "badge", reward_value: "streak_30_days" }, // Example badge key
        50: { name: "Půl Století Dnů!", description: "Jste na půli cesty ke stovce!", icon: "fa-award", reward_type: "points", reward_value: 150 },
        75: { name: "Tři Čtvrtě Stovky", description: "Blížíte se k velkému milníku.", icon: "fa-hourglass-half", reward_type: "points", reward_value: 200 },
        100: { name: "Legendární Stovka!", description: "Váš závazek je inspirující!", icon: "fa-crown", reward_type: "title", reward_value: "centurion" }, // Example title key
        125: { name: "Stovka a Čtvrt", description: "Stále silní!", icon: "fa-thumbs-up", reward_type: "points", reward_value: 300 },
        150: { name: "Věrný Pilot", description: "Jste skutečným veteránem systému.", icon: "fa-shield-alt", reward_type: "points", reward_value: 400 },
        200: { name: "Dvojitá Stovka!", description: "Úžasná vytrvalost!", icon: "fa-gem", reward_type: "badge", reward_value: "streak_200_days" },
        250: { name: "Čtvrt Tisíciletí Dnů", description: "Síla je s vámi.", icon: "fa-meteor", reward_type: "points", reward_value: 600 },
        300: { name: "Téměř Rok!", description: "Neuvěřitelná disciplína!", icon: "fa-trophy", reward_type: "points", reward_value: 750 },
        365: { name: "Roční Výročí!", description: "Jste absolutní legenda Justax!", icon: "fa-rocket", reward_type: "title", reward_value: "legenda_365" }
    };
    const milestoneDays = Object.keys(MILESTONE_REWARDS_CONFIG).map(Number).sort((a, b) => a - b);

    // <<< NEW: May Themed Rewards Definition >>>
    const mayRewards = {
        // day: { type: 'title'/'credits'/'xp', key: 'unique_key_if_needed', name: 'Display Name', icon: 'fa-icon', value: amount_if_applicable }
        1: { type: 'title', key: 'majovy_poutnik', name: 'Titul: Májový Poutník', icon: 'fa-hiking', value: 0 }, // Cost to claim is 0
        7: { type: 'credits', key: 'may_credits_1', name: '10 Kreditů', icon: 'fa-coins', value: 10 },
        9: { type: 'title', key: 'kral_majalesu', name: 'Titul: Král Majálesu', icon: 'fa-crown', value: 0 },
        14: { type: 'title', key: 'prvni_laska', name: 'Titul: První Láska', icon: 'fa-heart', value: 0 },
        18: { type: 'title', key: 'majovy_vanek', name: 'Titul: Májový vánek', icon: 'fa-feather-alt', value: 0 },
        21: { type: 'xp', key: 'may_xp_1', name: '25 Zkušeností', icon: 'fa-star', value: 25 },
        23: { type: 'title', key: 'kvetouci_duse', name: 'Titul: Kvetoucí Duše', icon: 'fa-leaf', value: 0 },
        28: { type: 'item', key: 'may_gem_1', name: 'Jarní Krystal', icon: 'fa-gem', value: 1 } // Example item
    };
    // --- End May Rewards ---

    let ui = {}; // UI Cache, populated by cacheDOMElements

    const activityVisuals = { /* ... (map remains the same) ... */
        exercise: { name: 'Trénink', icon: 'fa-laptop-code', class: 'exercise' },
        test: { name: 'Test', icon: 'fa-vial', class: 'test' },
        badge: { name: 'Odznak Získán', icon: 'fa-medal', class: 'badge' },
        diagnostic: { name: 'Diagnostika', icon: 'fa-microscope', class: 'diagnostic' },
        lesson: { name: 'Nová Data', icon: 'fa-book-open', class: 'lesson' },
        plan_generated: { name: 'Plán Aktualizován', icon: 'fa-route', class: 'plan_generated' },
        level_up: { name: 'Level UP!', icon: 'fa-angle-double-up', class: 'level_up' },
        other: { name: 'Systémová Zpráva', icon: 'fa-info-circle', class: 'other' },
        default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
    };
    // --- END: Initialization and Configuration ---

    // --- START: DOM Element Caching ---
    function cacheDOMElements() {
        console.log("[CACHE DOM] Caching elements...");
        ui = {
            // Core Layout & Sidebar
            initialLoader: document.getElementById('initial-loader'),
            sidebarOverlay: document.getElementById('sidebar-overlay'),
            mainContent: document.getElementById('main-content'),
            sidebar: document.getElementById('sidebar'),
            mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
            sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
            sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
            sidebarAvatar: document.getElementById('sidebar-avatar'),
            sidebarName: document.getElementById('sidebar-name'),
            sidebarUserTitle: document.getElementById('sidebar-user-title'),
            currentYearSidebar: document.getElementById('currentYearSidebar'),
            // Header
            dashboardHeader: document.querySelector('.dashboard-header'),
            dashboardTitle: document.getElementById('dashboard-title'),
            refreshDataBtn: document.getElementById('refresh-data-btn'),
            // Notifications
            notificationBell: document.getElementById('notification-bell'),
            notificationCount: document.getElementById('notification-count'),
            notificationsDropdown: document.getElementById('notifications-dropdown'),
            notificationsList: document.getElementById('notifications-list'),
            noNotificationsMsg: document.getElementById('no-notifications-msg'),
            markAllReadBtn: document.getElementById('mark-all-read'),
            // Welcome & Shortcuts
            welcomeTitle: document.getElementById('welcome-title'),
            startPracticeBtn: document.getElementById('start-practice-btn'),
            openMonthlyModalBtn: document.getElementById('open-monthly-modal-btn'),
            openStreakModalBtn: document.getElementById('open-streak-modal-btn'),
            // Stat Cards
            progressCard: document.getElementById('progress-card'),
            overallProgressValue: document.getElementById('overall-progress-value'),
            overallProgressFooter: document.getElementById('overall-progress-footer'),
            pointsCard: document.getElementById('points-card'),
            totalPointsValue: document.getElementById('total-points-value'),
            totalPointsFooter: document.getElementById('total-points-footer'),
            streakCard: document.getElementById('streak-card'),
            streakValue: document.getElementById('streak-value'),
            streakFooter: document.getElementById('streak-footer'),
            // Activity List
            activityListContainer: document.getElementById('activity-list-container'),
            activityList: document.getElementById('activity-list'),
            activityListEmptyState: document.getElementById('activity-list-empty-state'),
            activityListErrorState: document.getElementById('activity-list-error-state'),
            // Modals
            monthlyRewardModal: document.getElementById('monthly-reward-modal'),
            modalMonthlyCalendarGrid: document.getElementById('modal-monthly-calendar-grid'),
            modalMonthlyCalendarEmpty: document.getElementById('modal-monthly-calendar-empty'),
            modalCurrentMonthYearSpan: document.getElementById('modal-current-month-year'),
            closeMonthlyModalBtn: document.getElementById('close-monthly-modal-btn'),
            streakMilestonesModal: document.getElementById('streak-milestones-modal'),
            modalMilestonesGrid: document.getElementById('modal-milestones-grid'),
            modalMilestonesEmpty: document.getElementById('modal-milestones-empty'),
            modalCurrentStreakValue: document.getElementById('modal-current-streak-value'),
            closeStreakModalBtn: document.getElementById('close-streak-modal-btn'),
            // Utility/Other
            toastContainer: document.getElementById('toast-container'),
            globalError: document.getElementById('global-error'),
            offlineBanner: document.getElementById('offline-banner'),
            mouseFollower: document.getElementById('mouse-follower'),
            currentYearFooter: document.getElementById('currentYearFooter')
        };

        // Check for missing elements
        const missingElements = Object.entries(ui)
            .filter(([key, element]) => element === null)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            console.warn(`[CACHE DOM] Following elements were not found: (${missingElements.length})`, missingElements);
        } else {
            console.log("[CACHE DOM] Caching complete.");
        }
    }
    // --- END: DOM Element Caching ---

    // --- START: Helper Functions ---
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) { console.warn("Toast container not found."); return; } try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Error displaying toast:", e); } }
    function showError(message, isGlobal = false) { console.error("Error:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Obnovit Stránku</button></div>`; ui.globalError.style.display = 'block'; const retryBtn = document.getElementById('global-retry-btn'); if (retryBtn) { retryBtn.addEventListener('click', () => { location.reload(); }); } } else { showToast('SYSTEM ERROR', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || 'P'; }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Error formatting time:", e, "Timestamp:", timestamp); return '-'; } }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }
    function setLoadingState(section, isLoadingFlag) {
        const sections = section === 'all' ? Object.keys(isLoading) : [section];
        sections.forEach(sec => {
            if (!ui || Object.keys(ui).length === 0) { console.warn("UI cache not ready for setLoadingState"); return; }
            if (isLoading[sec] === isLoadingFlag && section !== 'all') return;
            isLoading[sec] = isLoadingFlag;
            console.log(`[setLoadingState] Section: ${sec}, isLoading: ${isLoadingFlag}`);

            // Find appropriate UI elements based on section
            const loaderOverlay = sec === 'monthlyRewards' ? ui.monthlyRewardModal?.querySelector('.loading-overlay') :
                                sec === 'streakMilestones' ? ui.streakMilestonesModal?.querySelector('.loading-overlay') :
                                null;
            const contentContainer = sec === 'monthlyRewards' ? ui.modalMonthlyCalendarGrid :
                                   sec === 'streakMilestones' ? ui.modalMilestonesGrid :
                                   sec === 'activities' ? ui.activityList :
                                   sec === 'notifications' ? ui.notificationsList :
                                   null;
            const emptyStateContainer = sec === 'monthlyRewards' ? ui.modalMonthlyCalendarEmpty :
                                      sec === 'streakMilestones' ? ui.modalMilestonesEmpty :
                                      sec === 'activities' ? ui.activityListEmptyState :
                                      sec === 'notifications' ? ui.noNotificationsMsg :
                                      null;
            const parentSection = sec === 'monthlyRewards' ? ui.monthlyRewardModal?.querySelector('.modal-body') :
                                sec === 'streakMilestones' ? ui.streakMilestonesModal?.querySelector('.modal-body') :
                                sec === 'activities' ? ui.activityListContainer :
                                sec === 'notifications' ? ui.notificationsDropdown :
                                null;
            const statCards = sec === 'stats' ? [ui.progressCard, ui.pointsCard, ui.streakCard] : [];

            // Toggle loading state
            if (statCards.length > 0) {
                 statCards.forEach(card => card?.classList.toggle('loading', isLoadingFlag));
            } else if (loaderOverlay || parentSection) {
                parentSection?.classList.toggle('loading', isLoadingFlag);
                if (loaderOverlay) loaderOverlay.classList.toggle('hidden', !isLoadingFlag);

                if (isLoadingFlag) {
                    if (contentContainer) contentContainer.innerHTML = ''; // Clear content
                    if (emptyStateContainer) emptyStateContainer.style.display = 'none'; // Hide empty state

                    // Render appropriate skeletons
                    if (sec === 'activities') renderActivitySkeletons(5);
                    else if (sec === 'monthlyRewards') renderMonthlyCalendarSkeletons();
                    else if (sec === 'streakMilestones') renderMilestoneSkeletons();
                    else if (sec === 'notifications') renderNotificationSkeletons(2);
                } else {
                    // After loading, show empty state if content is still empty
                    if (contentContainer && !contentContainer.hasChildNodes() && emptyStateContainer) {
                        emptyStateContainer.style.display = 'block';
                    } else if (emptyStateContainer) {
                        emptyStateContainer.style.display = 'none';
                    }
                }
            } else if (sec === 'notifications' && ui.notificationBell) {
                 ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                 if (ui.markAllReadBtn) {
                     const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                     ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
                 }
                 if (isLoadingFlag && ui.notificationsList) renderNotificationSkeletons(2);
            }
        });
    }
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }); animatedElements.forEach(element => observer.observe(element)); };
    const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 50); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl && mainEl.scrollTop > 50) document.body.classList.add('scrolled'); };
    const updateCopyrightYear = () => { const currentYearSpan = ui.currentYearFooter; const currentYearSidebar = ui.currentYearSidebar; const year = new Date().getFullYear(); if (currentYearSpan) { currentYearSpan.textContent = year; } if (currentYearSidebar) { currentYearSidebar.textContent = year; } };
    function applyInitialSidebarState() { const savedState = localStorage.getItem(SIDEBAR_STATE_KEY); const shouldBeCollapsed = savedState === 'collapsed'; console.log(`[Sidebar State] Initial read state: ${savedState}, Applying collapsed: ${shouldBeCollapsed}`); if (shouldBeCollapsed) { document.body.classList.add('sidebar-collapsed'); } else { document.body.classList.remove('sidebar-collapsed'); } const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) { icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.setAttribute('title', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); console.log(`[Sidebar State] Initial icon/attributes set.`); } else { console.warn("[Sidebar State] Sidebar toggle button icon not found for initial state."); } }
    function toggleSidebar() { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) { icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.setAttribute('title', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); } console.log(`[Sidebar Toggle] Sidebar toggled. New state: ${isCollapsed ? 'collapsed' : 'expanded'}`); }
    function initTooltips() { try { if (window.jQuery && typeof window.jQuery.fn.tooltipster === 'function') { window.jQuery('.btn-tooltip.tooltipstered').each(function() { if (document.body.contains(this)) { try { window.jQuery(this).tooltipster('destroy'); } catch (destroyError) { console.warn("Tooltipster destroy error:", destroyError); } } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); console.log("[Tooltips] Initialized/Re-initialized."); } else { console.warn("[Tooltips] jQuery or Tooltipster library not loaded."); } } catch (e) { console.error("[Tooltips] Error initializing Tooltipster:", e); } }
    function isSameDate(date1, date2) { if (!date1 || !date2) return false; const d1 = new Date(date1); const d2 = new Date(date2); return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate(); }
    function isYesterday(date1, date2) { if (!date1 || !date2) return false; const yesterday = new Date(date2); yesterday.setDate(yesterday.getDate() - 1); return isSameDate(date1, yesterday); }
    function getCurrentMonthYearString() { const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); return `${year}-${month}`; }
    function showModal(modalId) { const modal = document.getElementById(modalId); if (modal) { console.log(`[Modal] Opening modal: ${modalId}`); modal.style.display = 'flex'; if (modalId === 'monthly-reward-modal') { renderMonthlyCalendar(); } else if (modalId === 'streak-milestones-modal') { renderStreakMilestones(); } requestAnimationFrame(() => { modal.classList.add('active'); }); } else { console.error(`[Modal] Modal element not found: #${modalId}`); } }
    function hideModal(modalId) { const modal = document.getElementById(modalId); if (modal) { console.log(`[Modal] Closing modal: ${modalId}`); modal.classList.remove('active'); setTimeout(() => { modal.style.display = 'none'; }, 300); } }
    // --- END: Helper Functions ---

    // --- START: Supabase Client Initialization ---
    function initializeSupabase() {
        console.log("[Supabase] Attempting initialization...");
        try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded or createClient is not a function."); } supabase = window.supabase.createClient(supabaseUrl, supabaseKey); if (!supabase) { throw new Error("Supabase client creation failed (returned null/undefined)."); } window.supabaseClient = supabase; console.log('[Supabase] Klient úspěšně inicializován a globálně dostupný.'); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); if (typeof showError === 'function') { showError("Kritická chyba: Nepodařilo se připojit k databázi. Zkuste obnovit stránku.", true); } else { alert("Kritická chyba: Nepodařilo se připojit k databázi. Zkuste obnovit stránku."); } return false; }
    }
    // --- END: Supabase Client Initialization ---

    // --- START: Data Loading and Processing ---
    async function fetchUserProfile(userId) { if (!supabase || !userId) return null; console.log(`[Profile] Fetching profile for user ID: ${userId}`); try { const { data: profile, error } = await supabase.from('profiles').select('*, selected_title, last_login, streak_days, monthly_claims, last_milestone_claimed').eq('id', userId).single(); if (error && error.code !== 'PGRST116') { throw error; } if (!profile) { console.warn(`[Profile] Profile for ${userId} not found. Returning null.`); return null; } profile.monthly_claims = profile.monthly_claims || {}; profile.last_milestone_claimed = profile.last_milestone_claimed || 0; console.log("[Profile] Profile data fetched successfully."); return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); return null; } }
    async function createDefaultProfile(userId, userEmail) { if (!supabase || !userId || !userEmail) return null; console.log(`[Profile Create] Creating default profile for user ${userId}`); try { const defaultData = { id: userId, email: userEmail, username: userEmail.split('@')[0] || `user_${userId.substring(0, 6)}`, level: 1, points: 0, experience: 0, badges_count: 0, streak_days: 0, last_login: new Date().toISOString(), monthly_claims: {}, last_milestone_claimed: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), preferences: { dark_mode: window.matchMedia('(prefers-color-scheme: dark)').matches, language: 'cs' }, notifications: { email: true, study_tips: true, content_updates: true, practice_reminders: true } }; const { data: newProfile, error } = await supabase.from('profiles').insert(defaultData).select('*, selected_title, last_login, streak_days, monthly_claims, last_milestone_claimed').single(); if (error) { if (error.code === '23505') { console.warn("[Profile Create] Profile likely already exists, fetching again."); return await fetchUserProfile(userId); } throw error; } console.log("[Profile Create] Default profile created:", newProfile); return newProfile; } catch (error) { console.error("[Profile Create] Failed to create default profile:", error); return null; } }
    async function fetchTitles() { if (!supabase) return []; console.log("[Titles] Fetching available titles..."); setLoadingState('titles', true); try { const { data, error } = await supabase.from('title_shop').select('title_key, name'); if (error) throw error; console.log("[Titles] Fetched titles:", data); return data || []; } catch (error) { console.error("[Titles] Error fetching titles:", error); return []; } finally { setLoadingState('titles', false); } }
    async function fetchUserStats(userId, profileData) { if (!supabase || !userId || !profileData) { console.error("[Stats] Chybí Supabase klient, ID uživatele nebo data profilu."); return null; } console.log(`[Stats] Načítání statistik pro uživatele ${userId}...`); let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats] Chyba Supabase při načítání user_stats:", statsError.message); } } catch (error) { console.error("[Stats] Neočekávaná chyba při načítání user_stats:", error); statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0 }; if (statsError) { console.warn("[Stats] Vracení statistik primárně z profilu kvůli chybě načítání."); } else { console.log("[Stats] Statistiky úspěšně načteny/sestaveny:", finalStats); } return finalStats; }
    async function fetchRecentActivities(userId, limit = 5) { if (!supabase || !userId) { console.error("[Activities] Chybí Supabase nebo ID uživatele."); return []; } console.log(`[Activities] Načítání posledních ${limit} aktivit pro uživatele ${userId}`); try { const { data, error } = await supabase .from('activities') .select('*') .eq('user_id', userId) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; console.log(`[Activities] Načteno ${data?.length || 0} aktivit.`); return data || []; } catch (error) { console.error('[Activities] Výjimka při načítání aktivit:', error); return []; } }
    async function fetchNotifications(userId, limit = 5) { if (!supabase || !userId) { console.error("[Notifications] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await supabase .from('user_notifications') .select('*', { count: 'exact' }) .eq('user_id', userId) .eq('is_read', false) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; console.log(`[Notifications] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; } }
    async function checkAndUpdateLoginStreak() { if (!currentUser || !currentProfile || !supabase) { console.warn("[StreakCheck] Cannot perform check: missing user, profile, or supabase."); return false; } console.log("[StreakCheck] Performing daily login check/update..."); const today = new Date(); const lastLogin = currentProfile.last_login ? new Date(currentProfile.last_login) : null; let currentStreak = currentProfile.streak_days || 0; let needsDbUpdate = false; let updateData = {}; let currentMonth = getCurrentMonthYearString(); if (!lastLogin || !isSameDate(today, lastLogin)) { needsDbUpdate = true; console.log("[StreakCheck] First login of the day detected."); if (lastLogin && isYesterday(lastLogin, today)) { currentStreak++; console.log(`[StreakCheck] Streak continued! New streak: ${currentStreak}`); } else if (lastLogin) { currentStreak = 1; console.log("[StreakCheck] Streak broken. Resetting to 1."); } else { currentStreak = 1; console.log("[StreakCheck] First login ever. Setting streak to 1."); } updateData.streak_days = currentStreak; updateData.last_login = today.toISOString(); } else { console.log("[StreakCheck] Already logged in today. No streak update needed."); currentStreak = currentProfile.streak_days || 0; } currentProfile.streak_days = currentStreak; // Update local state immediately if (ui.modalCurrentStreakValue) ui.modalCurrentStreakValue.textContent = currentStreak; currentProfile.monthly_claims = currentProfile.monthly_claims || {}; if (!currentProfile.monthly_claims[currentMonth]) { console.log(`[StreakCheck] Initializing claims for new month: ${currentMonth}`); const updatedClaims = { ...currentProfile.monthly_claims, [currentMonth]: [] }; currentProfile.monthly_claims = updatedClaims; // Update local state updateData.monthly_claims = updatedClaims; needsDbUpdate = true; } else { console.log(`[StreakCheck] Monthly claims for ${currentMonth} already exist.`); } if (needsDbUpdate) { console.log("[StreakCheck] Updating profile in DB with:", updateData); try { const { error: updateError } = await supabase.from('profiles').update(updateData).eq('id', currentUser.id); if (updateError) throw updateError; if (updateData.last_login) currentProfile.last_login = updateData.last_login; if (updateData.monthly_claims) currentProfile.monthly_claims = updateData.monthly_claims; console.log("[StreakCheck] Profile updated successfully in DB."); return true; } catch (error) { console.error("[StreakCheck] Error updating profile:", error); showToast('Chyba', 'Nepodařilo se aktualizovat data přihlášení.', 'error'); return false; } } return false; }
    async function updateMonthlyClaimsInDB(newClaimsData) { if (!currentUser || !supabase) return false; console.log("[DB Update] Updating monthly claims in DB:", newClaimsData); try { const { error } = await supabase.from('profiles').update({ monthly_claims: newClaimsData, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (error) throw error; console.log("[DB Update] Monthly claims update successful."); return true; } catch (error) { console.error("[DB Update] Error updating monthly claims:", error); showToast('Chyba', 'Nepodařilo se uložit vyzvednutí měsíční odměny.', 'error'); return false; } }
    async function updateLastMilestoneClaimedInDB(milestoneDay) { if (!currentUser || !supabase) return false; console.log(`[DB Update] Updating last_milestone_claimed to ${milestoneDay}`); try { const { error } = await supabase.from('profiles').update({ last_milestone_claimed: milestoneDay, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (error) throw error; console.log(`[DB Update] Last claimed milestone update successful.`); return true; } catch (error) { console.error(`[DB Update] Error updating last_milestone_claimed:`, error); showToast('Chyba', 'Nepodařilo se uložit vyzvednutí milníkové odměny.', 'error'); return false; } }

    // <<< UPDATED: Function to award points and trigger achievement check >>>
    async function awardPoints(pointsValue, reason) {
        if (!currentUser || !currentProfile || !supabase) return;
        if (pointsValue <= 0) return;
        console.log(`[Points] Awarding ${pointsValue} points for: ${reason}`);
        setLoadingState('stats', true); // Indicate stats might change
        const currentPoints = currentProfile.points || 0;
        const newPoints = currentPoints + pointsValue;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ points: newPoints, updated_at: new Date().toISOString() })
                .eq('id', currentUser.id);
            if (error) throw error;
            currentProfile.points = newPoints; // Update local state
            showToast('Kredity Získány!', `+${pointsValue} kreditů za: ${reason}`, 'success', 2500);
            updateStatsCards(await fetchUserStats(currentUser.id, currentProfile)); // Refresh stats cards
            // <<< NEW: Trigger achievement check >>>
            if (typeof window.VyukaApp?.checkAndAwardAchievements === 'function') {
                 console.log("[Points] Triggering achievement check after awarding points.");
                 window.VyukaApp.checkAndAwardAchievements(currentUser.id);
             } else {
                 console.warn("[Points] Achievement check function (VyukaApp.checkAndAwardAchievements) not available.");
             }
        } catch (error) {
            console.error(`[Points] Error awarding points:`, error);
            showToast('Chyba', 'Nepodařilo se připsat kredity.', 'error');
        } finally {
            setLoadingState('stats', false);
        }
    }

    async function loadDashboardData(user, profile) { if (!user || !profile) { showError("Chyba: Nelze načíst data bez profilu uživatele.", true); setLoadingState('all', false); return; } console.log("[MAIN] loadDashboardData: Start pro uživatele:", user.id); hideError(); setLoadingState('stats', true); setLoadingState('activities', true); setLoadingState('notifications', true); renderActivitySkeletons(5); try { await checkAndUpdateLoginStreak(); updateSidebarProfile(profile); console.log("[MAIN] loadDashboardData: Načítání statistik, aktivit, oznámení..."); const [statsResult, activitiesResult, notificationsResult] = await Promise.allSettled([ fetchUserStats(user.id, profile), fetchRecentActivities(user.id, 5), fetchNotifications(user.id, 5) ]); console.log("[MAIN] loadDashboardData: Souběžné načítání dokončeno:", [statsResult, activitiesResult, notificationsResult]); if (statsResult.status === 'fulfilled') { updateStatsCards(statsResult.value || profile); } else { console.error("❌ Chyba při načítání statistik:", statsResult.reason); showError("Nepodařilo se načíst statistiky.", false); updateStatsCards(profile); } if (activitiesResult.status === 'fulfilled') { renderActivities(activitiesResult.value || []); } else { console.error("❌ Chyba při načítání aktivit:", activitiesResult.reason); showError("Nepodařilo se načíst aktivity.", false); renderActivities(null); } if (notificationsResult.status === 'fulfilled') { const { unreadCount, notifications } = notificationsResult.value || { unreadCount: 0, notifications: [] }; renderNotifications(unreadCount, notifications); } else { console.error("❌ Chyba při načítání oznámení:", notificationsResult.reason); showError("Nepodařilo se načíst oznámení.", false); renderNotifications(0, []); } console.log("[MAIN] loadDashboardData: Statické sekce обработаны."); } catch (error) { console.error('[MAIN] loadDashboardData: Zachycena hlavní chyba:', error); showError('Nepodařilo se kompletně načíst data nástěnky: ' + error.message); updateStatsCards(profile); renderActivities(null); renderNotifications(0, []); } finally { setLoadingState('stats', false); setLoadingState('activities', false); setLoadingState('notifications', false); if (typeof initTooltips === 'function') initTooltips(); } }
    // --- END: Data Loading ---

    // --- START: UI Update Functions ---
    function updateSidebarProfile(profile) { if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { cacheDOMElements(); if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[UI Update Sidebar] Sidebar elements not found in cache."); return; } } console.log("[UI Update] Aktualizace sidebaru..."); if (profile) { const firstName = profile.first_name ?? ''; const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(profile); const avatarUrl = profile.avatar_url; ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot'; if (selectedTitleKey && allTitles && allTitles.length > 0) { const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) displayTitle = foundTitle.name; else console.warn(`[UI Update Sidebar] Title key "${selectedTitleKey}" not found in titles list.`); } else if (selectedTitleKey) { console.warn(`[UI Update Sidebar] Selected title key present, but titles list is empty or not loaded.`); } ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`; console.log("[UI Update] Sidebar aktualizován."); } else { console.warn("[UI Update Sidebar] Missing profile data. Setting defaults."); ui.sidebarName.textContent = "Pilot"; ui.sidebarAvatar.textContent = '?'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title'); if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítejte!`; } }
    function updateStatsCards(stats) { /* ... (same as previous dashboard.js) ... */ console.log("[UI Update] Aktualizace karet statistik:", stats); const statElements = { progress: ui.overallProgressValue, points: ui.totalPointsValue, streak: ui.streakValue, progressFooter: ui.overallProgressFooter, pointsFooter: ui.totalPointsFooter, streakFooter: ui.streakFooter }; const cards = [ui.progressCard, ui.pointsCard, ui.streakCard]; if (requiredElements.some(el => !el)) { console.error("[UI Update Stats] Chybějící elementy statistik:", requiredElements.filter(el => !el).map(el => 'unknown element')); cards.forEach(card => card?.classList.remove('loading')); return; } cards.forEach(card => card?.classList.remove('loading')); if (!stats) { console.warn("[UI Update Stats] Chybí data statistik."); statElements.progress.textContent = '- %'; statElements.points.textContent = '-'; statElements.streak.textContent = '-'; statElements.progressFooter.innerHTML = `<i class="fas fa-exclamation-circle"></i> Data nenalezena`; statElements.pointsFooter.innerHTML = `<i class="fas fa-exclamation-circle"></i> Data nenalezena`; statElements.streakFooter.textContent = `MAX: - dní`; return; } statElements.progress.textContent = `${stats.progress ?? 0}%`; const weeklyProgress = stats.progress_weekly ?? 0; statElements.progressFooter.classList.remove('positive', 'negative'); statElements.progressFooter.innerHTML = weeklyProgress > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyProgress}% týdně` : weeklyProgress < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyProgress}% týdně` : `<i class="fas fa-minus"></i> --`; if (weeklyProgress > 0) statElements.progressFooter.classList.add('positive'); else if (weeklyProgress < 0) statElements.progressFooter.classList.add('negative'); statElements.points.textContent = stats.points ?? 0; const weeklyPoints = stats.points_weekly ?? 0; statElements.pointsFooter.classList.remove('positive', 'negative'); statElements.pointsFooter.innerHTML = weeklyPoints > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyPoints} týdně` : weeklyPoints < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyPoints} týdně` : `<i class="fas fa-minus"></i> --`; if (weeklyPoints > 0) statElements.pointsFooter.classList.add('positive'); else if (weeklyPoints < 0) statElements.pointsFooter.classList.add('negative'); statElements.streak.textContent = stats.streak_current ?? 0; statElements.streakFooter.textContent = `MAX: ${stats.streak_longest ?? 0} dní`; console.log("[UI Update] Karty statistik aktualizovány."); }
    function renderActivities(activities) { /* ... (same as previous dashboard.js) ... */ if (!ui.activityList || !ui.activityListContainer || !ui.activityListEmptyState || !ui.activityListErrorState) { console.error("[Render Activities] Essential UI elements for activity list are missing. Rendering cancelled."); setLoadingState('activities', false); return; } console.log("[Render Activities] Start rendering, activities count:", activities?.length); ui.activityList.innerHTML = ''; ui.activityListEmptyState.style.display = 'none'; ui.activityListErrorState.style.display = 'none'; ui.activityList.style.display = 'none'; if (activities === null) { ui.activityListErrorState.style.display = 'block'; console.warn("[Render Activities] Received null data, showing error state."); } else if (activities.length === 0) { ui.activityListEmptyState.style.display = 'block'; console.log("[Render Activities] No activities to display, showing empty state."); } else { const fragment = document.createDocumentFragment(); activities.forEach(activity => { const visual = activityVisuals[activity.type?.toLowerCase()] || activityVisuals.default; const title = sanitizeHTML(activity.title || 'Neznámá aktivita'); const description = sanitizeHTML(activity.description || ''); const timeAgo = formatRelativeTime(activity.created_at); const item = document.createElement('div'); item.className = 'activity-item'; item.innerHTML = `<div class="activity-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="activity-content"><div class="activity-title">${title}</div>${description ? `<div class="activity-desc">${description}</div>` : ''}<div class="activity-time"><i class="far fa-clock"></i> ${timeAgo}</div></div>`; fragment.appendChild(item); }); ui.activityList.appendChild(fragment); ui.activityList.style.display = 'block'; console.log(`[Render Activities] Rendered ${activities.length} items.`); } ui.activityListContainer.classList.remove('loading'); setLoadingState('activities', false); }
    function renderActivitySkeletons(count = 5) { /* ... (same as previous dashboard.js) ... */ if (!ui.activityList || !ui.activityListContainer) { console.warn("Cannot render activity skeletons: List or container not found."); return; } ui.activityListContainer.classList.add('loading'); ui.activityList.innerHTML = ''; if(ui.activityListEmptyState) ui.activityListEmptyState.style.display = 'none'; if(ui.activityListErrorState) ui.activityListErrorState.style.display = 'none'; let skeletonHTML = '<div class="loading-placeholder">'; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="skeleton-activity-item"> <div class="skeleton icon-placeholder"></div> <div style="flex-grow: 1;"> <div class="skeleton activity-line"></div> <div class="skeleton activity-line text-short"></div> <div class="skeleton activity-line-short"></div> </div> </div>`; } skeletonHTML += '</div>'; ui.activityList.innerHTML = skeletonHTML; ui.activityList.style.display = 'block'; console.log(`[Render Skeletons] Rendered ${count} activity skeletons.`); }
    function renderNotifications(count, notifications) { /* ... (same as previous dashboard.js - FIX check) ... */ if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { cacheDOMElements(); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Notification UI elements are still missing after re-cache. Cannot render."); setLoadingState('notifications', false); return; } } console.log("[Render Notifications] Start, Počet:", count, "Oznámení:", notifications); ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return ` <div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"> <i class="fas ${visual.icon}"></i> </div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } console.log("[Render Notifications] Hotovo"); }
    function renderNotificationSkeletons(count = 2) { /* ... (same as previous dashboard.js) ... */ if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }

    // <<< MODIFIED: Render monthly calendar with May titles >>>
    function renderMonthlyCalendar() {
        if (!ui.modalMonthlyCalendarGrid || !ui.modalCurrentMonthYearSpan || !ui.modalMonthlyCalendarEmpty) { console.error("Monthly calendar MODAL UI elements missing. Cannot render."); setLoadingState('monthlyRewards', false); return; }
        console.log("[RenderMonthly] Rendering calendar...");
        setLoadingState('monthlyRewards', true);
        const gridContainer = ui.modalMonthlyCalendarGrid;
        const modalTitleSpan = ui.modalCurrentMonthYearSpan;
        const emptyState = ui.modalMonthlyCalendarEmpty;
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0 = January, 4 = May
        const today = now.getDate();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthString = getCurrentMonthYearString(); // e.g., "2025-05"
        const monthName = now.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
        const claimedDaysThisMonth = currentProfile?.monthly_claims?.[monthString] || [];

        console.log(`[RenderMonthly] Claimed days for ${monthString}:`, claimedDaysThisMonth);
        modalTitleSpan.textContent = monthName;
        gridContainer.innerHTML = ''; // Clear previous skeletons/days
        emptyState.style.display = 'none';
        gridContainer.style.display = 'grid';
        const fragment = document.createDocumentFragment();
        let daysRendered = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.classList.add('calendar-day');
            dayElement.dataset.day = day;

            const isClaimed = claimedDaysThisMonth.includes(day);
            const isClaimable = (day === today && !isClaimed);
            const isUpcoming = day > today;
            const isMissed = day < today && !isClaimed;

            let rewardIconHtml = '<i class="fas fa-gift"></i>'; // Default icon
            let rewardText = `Den ${day}`; // Default text
            let specificReward = null;
            let rewardType = 'default';
            let rewardKey = `day_${day}`;
            let rewardValue = 1; // Default placeholder value

            // --- START: May Rewards Logic ---
            if (month === 4) { // Check if current month is May (index 4)
                specificReward = mayRewards[day]; // Check if a specific reward exists for this day in May
            }

            if (specificReward) {
                rewardIconHtml = `<i class="fas ${specificReward.icon || 'fa-gift'}"></i>`;
                rewardText = specificReward.name;
                rewardType = specificReward.type;
                rewardKey = specificReward.key || `may_reward_${day}`;
                rewardValue = specificReward.value !== undefined ? specificReward.value : 1; // Use defined value or 1
                dayElement.dataset.rewardType = rewardType;
                dayElement.dataset.rewardKey = rewardKey;
                dayElement.dataset.rewardValue = rewardValue;
            } else {
                // Default reward logic for non-themed days (or other months)
                // Example: Credits every 7 days, XP every 5 days
                if (day % 7 === 0) {
                    rewardIconHtml = '<i class="fas fa-coins"></i>';
                    rewardText = '10 Kreditů';
                    rewardType = 'credits';
                    rewardValue = 10;
                } else if (day % 5 === 0) {
                     rewardIconHtml = '<i class="fas fa-star"></i>';
                     rewardText = '5 EXP';
                     rewardType = 'xp';
                     rewardValue = 5;
                 }
                 dayElement.dataset.rewardType = rewardType;
                 dayElement.dataset.rewardKey = rewardKey;
                 dayElement.dataset.rewardValue = rewardValue;
            }
            // --- END: May Rewards Logic ---

            dayElement.innerHTML = `
                <span class="day-number">${day}</span>
                <div class="reward-icon">${rewardIconHtml}</div>
                <span class="reward-text">${rewardText}</span>
                <span class="reward-status"></span>
                <button class="claim-button btn btn-sm" style="display: none;"><i class="fas fa-check"></i> Vyzvednout</button>`;

            const statusSpan = dayElement.querySelector('.reward-status');
            const claimButton = dayElement.querySelector('.claim-button');

            if (isClaimed) {
                dayElement.classList.add('claimed');
                if (statusSpan) statusSpan.textContent = 'Získáno';
            } else if (isClaimable) {
                dayElement.classList.add('available');
                if (statusSpan) statusSpan.textContent = 'Dostupné';
                if (claimButton) {
                    claimButton.style.display = 'block';
                    // Ensure listener is added correctly
                    claimButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        claimMonthlyReward(day, claimButton, rewardType, rewardValue, rewardText); // Pass reward details
                    });
                }
            } else if (isUpcoming) {
                dayElement.classList.add('upcoming');
                if (statusSpan) statusSpan.textContent = 'Připravuje se';
            } else { // isMissed
                dayElement.classList.add('missed');
                if (statusSpan) statusSpan.textContent = 'Zmeškáno';
            }

            if (day === today) {
                dayElement.classList.add('today');
            }

            fragment.appendChild(dayElement);
            daysRendered++;
        }

        if (daysRendered > 0) {
            gridContainer.appendChild(fragment);
        } else {
            emptyState.style.display = 'block';
            gridContainer.style.display = 'none';
        }

        ui.monthlyRewardModal?.querySelector('.modal-body')?.classList.remove('loading');
        console.log("[RenderMonthly] Modal calendar rendered with dynamic rewards.");
        setLoadingState('monthlyRewards', false);
        initTooltips();
    }
    // <<< End MODIFIED renderMonthlyCalendar >>>

    function renderMonthlyCalendarSkeletons() { /* ... (same as before) ... */ const gridContainer = ui.modalMonthlyCalendarGrid; if (!gridContainer) return; gridContainer.innerHTML = ''; gridContainer.style.display = 'grid'; const skeletonCount = 21; let skeletonHTML = ''; for(let i=0; i < skeletonCount; i++) { skeletonHTML += '<div class="calendar-day skeleton"></div>'; } gridContainer.innerHTML = skeletonHTML; }
    function renderStreakMilestones() { /* ... (same as before) ... */ if (!ui.modalMilestonesGrid || !ui.modalMilestonesEmpty || !ui.modalCurrentStreakValue) { console.error("Streak milestones MODAL UI elements missing. Cannot render."); setLoadingState('streakMilestones', false); return; } console.log("[RenderMilestones] Rendering streak milestones..."); setLoadingState('streakMilestones', true); const gridContainer = ui.modalMilestonesGrid; const emptyState = ui.modalMilestonesEmpty; const streakSpan = ui.modalCurrentStreakValue; const currentStreak = currentProfile?.streak_days || 0; const lastClaimed = currentProfile?.last_milestone_claimed || 0; streakSpan.textContent = currentStreak; gridContainer.innerHTML = ''; emptyState.style.display = 'none'; gridContainer.style.display = 'grid'; const fragment = document.createDocumentFragment(); let milestonesToShow = 0; milestoneDays.forEach(milestoneDay => { const config = MILESTONE_REWARDS_CONFIG[milestoneDay]; if (!config) return; const milestoneElement = document.createElement('div'); milestoneElement.classList.add('milestone-card'); milestoneElement.dataset.milestone = milestoneDay; const isClaimed = lastClaimed >= milestoneDay; const isClaimable = currentStreak >= milestoneDay && !isClaimed; const isLocked = currentStreak < milestoneDay; let statusHTML = ''; let buttonHTML = ''; if (isClaimed) { milestoneElement.classList.add('claimed'); statusHTML = `<span class="reward-status">Získáno</span>`; } else if (isClaimable) { milestoneElement.classList.add('available'); statusHTML = `<span class="reward-status">Dostupné</span>`; buttonHTML = `<button class="claim-button btn btn-sm btn-success"><i class="fas fa-check"></i> Vyzvednout</button>`; } else { milestoneElement.classList.add('locked'); const daysNeeded = milestoneDay - currentStreak; statusHTML = `<span class="reward-status">Ještě ${daysNeeded} ${daysNeeded === 1 ? 'den' : (daysNeeded < 5 ? 'dny' : 'dní')}</span>`; } milestoneElement.innerHTML = `<span class="day-number">Série ${milestoneDay}</span><div class="reward-icon"><i class="fas ${config.icon || 'fa-award'}"></i></div><span class="reward-text" title="${sanitizeHTML(config.description)}">${sanitizeHTML(config.name)}</span>${statusHTML}${buttonHTML}`; const claimButton = milestoneElement.querySelector('.claim-button'); if (claimButton) { claimButton.addEventListener('click', (e) => { e.stopPropagation(); claimMilestoneReward(milestoneDay, claimButton, config.reward_type, config.reward_value, config.name); }); } fragment.appendChild(milestoneElement); milestonesToShow++; }); if (milestonesToShow > 0) { gridContainer.appendChild(fragment); } else { emptyState.style.display = 'block'; gridContainer.style.display = 'none'; } ui.streakMilestonesModal?.querySelector('.modal-body')?.classList.remove('loading'); console.log("[RenderMilestones] Milestones rendered in modal."); setLoadingState('streakMilestones', false); initTooltips(); }
    function renderMilestoneSkeletons() { /* ... (same as before) ... */ const gridContainer = ui.modalMilestonesGrid; if (!gridContainer) return; gridContainer.innerHTML = ''; gridContainer.style.display = 'grid'; const skeletonCount = 6; let skeletonHTML = ''; for(let i=0; i < skeletonCount; i++) { skeletonHTML += '<div class="milestone-card skeleton"></div>'; } gridContainer.innerHTML = skeletonHTML; }
    // --- END: UI Update ---

    // --- START: Claim Reward Logic ---
    async function claimMonthlyReward(day, buttonElement, rewardType = 'default', rewardValue = 1, rewardName = `Odměna dne ${day}`) {
        console.log(`[ClaimMonthly] Attempting claim for day ${day}. Reward: ${rewardType}, Value: ${rewardValue}, Name: ${rewardName}`);
        if (!currentUser || !currentProfile || !supabase || isLoading.monthlyRewards) return;
        setLoadingState('monthlyRewards', true);
        if (buttonElement) { buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

        const currentMonth = getCurrentMonthYearString();
        currentProfile.monthly_claims = currentProfile.monthly_claims || {};
        currentProfile.monthly_claims[currentMonth] = currentProfile.monthly_claims[currentMonth] || [];

        if (currentProfile.monthly_claims[currentMonth].includes(day)) { console.warn(`[ClaimMonthly] Day ${day} already claimed.`); showToast('Info', 'Odměna již byla vyzvednuta.', 'info'); setLoadingState('monthlyRewards', false); renderMonthlyCalendar(); return; }

        const updatedClaimsForMonth = [...currentProfile.monthly_claims[currentMonth], day];
        const updatedFullClaims = { ...currentProfile.monthly_claims, [currentMonth]: updatedClaimsForMonth };

        // Simulate DB update first for immediate UI feedback, then actual update
        const dbSuccess = await updateMonthlyClaimsInDB(updatedFullClaims);

        if (dbSuccess) {
            currentProfile.monthly_claims = updatedFullClaims; // Update local state
            console.log(`[ClaimMonthly] DB update successful. New claims:`, currentProfile.monthly_claims);

            // Award points/items/etc. based on rewardType
            switch (rewardType) {
                case 'credits':
                case 'points': // Handle both 'credits' and 'points'
                    await awardPoints(rewardValue, `Měsíční odměna (Den ${day})`);
                    break;
                case 'xp':
                    // TODO: Implement XP awarding logic if needed
                    showToast('Odměna Získána!', `${rewardValue} Zkušeností (Implementace XP chybí)`, 'success');
                    break;
                case 'title':
                    // Titles are just unlocked visually here, actual purchase is separate
                    showToast('Odměna Získána!', `${rewardName}`, 'success');
                    break;
                case 'item':
                     // TODO: Implement item awarding logic
                     showToast('Odměna Získána!', `Předmět: ${rewardName} (Implementace předmětů chybí)`, 'success');
                     break;
                default:
                    showToast('Odměna Získána!', `Získali jste odměnu za ${day}. den měsíce!`, 'success');
            }
        } else {
            showToast('Chyba', 'Nepodařilo se uložit vyzvednutí odměny.', 'error');
            // Re-enable button only if DB update failed
            if (buttonElement) {
                buttonElement.disabled = false;
                buttonElement.innerHTML = '<i class="fas fa-check"></i> Vyzvednout';
            }
        }
        setLoadingState('monthlyRewards', false);
        renderMonthlyCalendar(); // Re-render calendar to reflect claimed state
    }

    async function claimMilestoneReward(milestoneDay, buttonElement, rewardType, rewardValue, rewardName) {
        console.log(`[ClaimMilestone] Attempting claim for milestone ${milestoneDay}. Reward: ${rewardType}, Value: ${rewardValue}, Name: ${rewardName}`);
        if (!currentUser || !currentProfile || !supabase || isLoading.streakMilestones) return;
        setLoadingState('streakMilestones', true);
        if (buttonElement) { buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

        const lastClaimed = currentProfile?.last_milestone_claimed || 0;
        const currentStreak = currentProfile?.streak_days || 0;

        if (lastClaimed >= milestoneDay) { console.warn(`[ClaimMilestone] Milestone ${milestoneDay} already claimed.`); showToast('Info', 'Milník již byl dosažen.', 'info'); setLoadingState('streakMilestones', false); renderStreakMilestones(); return; }
        if (currentStreak < milestoneDay) { console.warn(`[ClaimMilestone] Milestone ${milestoneDay} not yet reached.`); showToast('Chyba', 'Podmínky pro tento milník ještě nebyly splněny.', 'warning'); setLoadingState('streakMilestones', false); renderStreakMilestones(); return; }

        const dbSuccess = await updateLastMilestoneClaimedInDB(milestoneDay);

        if (dbSuccess) {
            currentProfile.last_milestone_claimed = milestoneDay; // Update local state
            console.log(`[ClaimMilestone] DB update successful. Last claimed: ${currentProfile.last_milestone_claimed}`);

            // Award reward based on type
            switch (rewardType) {
                case 'points':
                    await awardPoints(rewardValue, `Odměna za sérii ${milestoneDay} dní`);
                    break;
                case 'badge':
                    // TODO: Award badge logic (requires badge key in reward_value)
                    console.warn(`[ClaimMilestone] Badge awarding for '${rewardValue}' not implemented yet.`);
                    showToast('Milník Dosažen!', `${rewardName} (Přiřazení odznaku TODO)`, 'success');
                    break;
                case 'title':
                     // TODO: Award title logic (grant ownership, requires title key)
                     console.warn(`[ClaimMilestone] Title awarding for '${rewardValue}' not implemented yet.`);
                     showToast('Milník Dosažen!', `${rewardName} (Přiřazení titulu TODO)`, 'success');
                    break;
                 case 'placeholder': // Handle the placeholder type specifically
                     showToast('Milník Dosažen!', `${rewardName} (Placeholder odměna)`, 'success');
                     break;
                default:
                    showToast('Milník Dosažen!', `Získali jste: ${rewardName}`, 'success');
            }
        } else {
            showToast('Chyba', 'Nepodařilo se uložit vyzvednutí milníkové odměny.', 'error');
            if (buttonElement) { // Re-enable only on error
                buttonElement.disabled = false;
                buttonElement.innerHTML = '<i class="fas fa-check"></i> Vyzvednout';
            }
        }
        setLoadingState('streakMilestones', false);
        renderStreakMilestones(); // Re-render milestones
    }
    // --- END: Claim Reward Logic ---

    // --- START: Notification Logic ---
    async function markNotificationRead(notificationId) { /* ... (same as before) ... */ console.log("[FUNC] markNotificationRead: Označení ID:", notificationId); if (!currentUser || !notificationId || !supabase) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[FUNC] markNotificationRead: Úspěch pro ID:", notificationId); return true; } catch (error) { console.error("[FUNC] markNotificationRead: Chyba:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { /* ... (same as before) ... */ console.log("[FUNC] markAllNotificationsRead: Start pro uživatele:", currentUser?.id); if (!currentUser || !ui.markAllReadBtn || !supabase) { console.warn("Cannot mark all read: Missing user, button, or supabase."); return; } if (isLoading.notifications) return; setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false); if (error) throw error; console.log("[FUNC] markAllNotificationsRead: Úspěch"); const { unreadCount, notifications } = await fetchNotifications(currentUser.id, 5); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[FUNC] markAllNotificationsRead: Chyba:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }
    // --- END: Notification Logic ---

    // --- START: Event Listeners Setup ---
    function setupUIEventListeners() {
         console.log("[SETUP] setupUIEventListeners: Start");
         if (!ui || Object.keys(ui).length === 0) { console.error("[SETUP] UI cache is empty! Cannot setup listeners."); return; }
         const listenersAdded = new Set();
         const safeAddListener = (element, eventType, handler, key) => { if (element) { element.removeEventListener(eventType, handler); element.addEventListener(eventType, handler); listenersAdded.add(key); } else { console.warn(`[SETUP] Element not found for listener: ${key}`); } };

         // Sidebar/Menu
         safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
         safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
         safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');
         safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn');
         document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });

         // Core Actions
         safeAddListener(ui.startPracticeBtn, 'click', () => { window.location.href = '/dashboard/procvicovani/main.html'; }, 'startPracticeBtn');
         safeAddListener(ui.openMonthlyModalBtn, 'click', () => showModal('monthly-reward-modal'), 'openMonthlyModalBtn');
         safeAddListener(ui.openStreakModalBtn, 'click', () => showModal('streak-milestones-modal'), 'openStreakModalBtn');
         safeAddListener(ui.refreshDataBtn, 'click', async () => { if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; ui.refreshDataBtn.disabled = true; await loadDashboardData(currentUser, currentProfile); if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; ui.refreshDataBtn.disabled = false; }, 'refreshDataBtn');

         // Notifications
         safeAddListener(ui.notificationBell, 'click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell');
         safeAddListener(ui.markAllReadBtn, 'click', markAllNotificationsRead, 'markAllReadBtn');
         safeAddListener(ui.notificationsList, 'click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount?.textContent?.replace('+', '') || '0'; const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); if(ui.notificationCount) { ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); } if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }, 'notificationsList');
         document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown?.classList.remove('active'); } });

         // Modal Listeners
         safeAddListener(ui.closeMonthlyModalBtn, 'click', () => hideModal('monthly-reward-modal'), 'closeMonthlyModalBtn');
         safeAddListener(ui.monthlyRewardModal, 'click', (event) => { if (event.target === ui.monthlyRewardModal) { hideModal('monthly-reward-modal'); } }, 'monthlyRewardModal');
         safeAddListener(ui.closeStreakModalBtn, 'click', () => hideModal('streak-milestones-modal'), 'closeStreakModalBtn');
         safeAddListener(ui.streakMilestonesModal, 'click', (event) => { if (event.target === ui.streakMilestonesModal) { hideModal('streak-milestones-modal'); } }, 'streakMilestonesModal');

         // Other global listeners
         window.addEventListener('online', updateOnlineStatus);
         window.addEventListener('offline', updateOnlineStatus);
         if (ui.mainContent) ui.mainContent.addEventListener('scroll', initHeaderScrollDetection, { passive: true });

         console.log(`[SETUP] Event listeners set up. Added: ${[...listenersAdded].length}`);
     }
    // --- END: Event Listeners ---

    // --- START: App Initialization ---
    async function initializeApp() {
        console.log("[INIT Dashboard] initializeApp: Start v24 - May Titles");
        cacheDOMElements();
        if (!initializeSupabase()) return;

        try {
            applyInitialSidebarState();
            setupUIEventListeners();

            if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; }
            if (ui.mainContent) ui.mainContent.style.display = 'none';

            console.log("[INIT Dashboard] Checking auth session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;
                console.log(`[INIT Dashboard] User authenticated (ID: ${currentUser.id}). Loading profile and titles...`);

                const [profileResult, titlesResult] = await Promise.allSettled([ fetchUserProfile(currentUser.id), fetchTitles() ]);

                if (profileResult.status === 'fulfilled' && profileResult.value) { currentProfile = profileResult.value; console.log("[INIT Dashboard] Profile loaded:", currentProfile); }
                else { console.warn("[INIT Dashboard] Profile not found or fetch failed, attempting to create default..."); currentProfile = await createDefaultProfile(currentUser.id, currentUser.email); if (!currentProfile) throw new Error("Nepodařilo se vytvořit/načíst profil uživatele."); console.log("[INIT Dashboard] Default profile created/retrieved."); }

                if (titlesResult.status === 'fulfilled') { allTitles = titlesResult.value || []; console.log("[INIT Dashboard] Titles loaded:", allTitles.length); }
                else { console.warn("[INIT Dashboard] Failed to load titles:", titlesResult.reason); allTitles = []; }

                updateSidebarProfile(currentProfile);
                updateCopyrightYear();
                updateOnlineStatus();

                await loadDashboardData(currentUser, currentProfile);

                if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
                if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
                initMouseFollower();
                initHeaderScrollDetection();
                initTooltips();

                const readyEvent = new CustomEvent('dashboardReady', { detail: { user: currentUser, profile: currentProfile, client: supabase, titles: allTitles } });
                document.dispatchEvent(readyEvent);
                console.log("[INIT Dashboard] Dispatching 'dashboardReady' event.");

                console.log("✅ [INIT Dashboard] Page fully initialized.");

            } else { console.log('[INIT Dashboard] V sezení není uživatel, přesměrování.'); window.location.href = '/auth/index.html'; }
        } catch (error) { console.error("❌ [INIT Dashboard] Kritická chyba inicializace:", error); if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE.</p>`; } else { showError(`Chyba inicializace: ${error.message}`, true); } if (ui.mainContent) ui.mainContent.style.display = 'none'; setLoadingState('all', false); }
    }
    // --- END: App Initialization ---

    // --- START THE APP ---
    initializeApp();

})(); // End of IIFE