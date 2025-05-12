// dashboard.js
// Verze: 24.2 - Integrace Longest Streak, Milníků Série (jednorázové) a Nedávné Aktivity
(function() {
    'use strict';

    // --- START: Initialization and Configuration ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = [];

    let isLoading = {
        stats: false,
        activities: false, // Přidáno pro načítání aktivit
        notifications: false,
        titles: false,
        monthlyRewards: false,
        streakMilestones: false
    };
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';

    const MONTHLY_REWARD_DAYS = 31;

    // --- NOVÉ: Konfigurace Milníků Studijní Série ---
    // Klíč je počet dní série, hodnota je objekt s detaily odměny
    const STREAK_MILESTONES_CONFIG = {
        3: { name: "Zahřívací Kolečko", description: "3 dny v řadě! Dobrý začátek!", icon: "fa-running", reward_type: "points", reward_value: 5, reward_key: "streak_3_days_points_5" },
        7: { name: "Týdenní Vytrvalec", description: "Celý týden bez přestávky! Skvělé!", icon: "fa-calendar-week", reward_type: "points", reward_value: 15, reward_key: "streak_7_days_points_15" },
        14: { name: "Dvou Týdenní Hrdina", description: "Již 14 dní studia! Neuvěřitelné!", icon: "fa-star", reward_type: "badge", reward_value: "badge_streak_14", reward_key: "streak_14_days_badge_perseverance" },
        30: { name: "Měsíční Maratonec", description: "Celý měsíc konzistence! Jsi legenda!", icon: "fa-trophy", reward_type: "title", reward_value: "title_monthly_marathon", reward_key: "streak_30_days_title_marathon" },
        60: { name: "Dvouměsíční Vládce", description: "60 dní! Jsi nezastavitelný!", icon: "fa-crown", reward_type: "item", reward_value: "item_rare_avatar_frame", reward_key: "streak_60_days_item_frame" }, // Příklad pro předmět
        90: { name: "Čtvrtletní Soustředění", description: "90 dní naprosté oddanosti!", icon: "fa-brain", reward_type: "points", reward_value: 200, reward_key: "streak_90_days_points_200" },
        180: { name: "Půlroční Mistr", description: "Půl roku konzistentního studia!", icon: "fa-user-graduate", reward_type: "badge", reward_value: "badge_streak_180", reward_key: "streak_180_days_badge_master" },
        365: { name: "Roční Výročí!", description: "Jste absolutní legenda Justax!", icon: "fa-rocket", reward_type: "title", reward_value: "title_legend_365", reward_key: "streak_365_days_title_legend" }
    };
    const sortedMilestoneDays = Object.keys(STREAK_MILESTONES_CONFIG).map(Number).sort((a, b) => a - b);
    // --- KONEC: Konfigurace Milníků ---

    // Definice odměn pro květen (Máj)
    const mayRewards = {
        1: { type: 'title', key: 'majovy_poutnik', name: 'Titul: Májový Poutník', icon: 'fa-hiking', value: null },
        7: { type: 'credits', key: 'may_credits_10', name: '10 Kreditů', icon: 'fa-coins', value: 10 },
        9: { type: 'title', key: 'kral_majalesu', name: 'Titul: Král Majálesu', icon: 'fa-crown', value: null },
        14: { type: 'title', key: 'prvni_laska', name: 'Titul: První Láska', icon: 'fa-heart', value: null },
        18: { type: 'title', key: 'majovy_vanek', name: 'Titul: Májový vánek', icon: 'fa-feather-alt', value: null },
        21: { type: 'xp', key: 'may_xp_25', name: '25 Zkušeností', icon: 'fa-star', value: 25 },
        23: { type: 'title', key: 'kvetouci_duse', name: 'Titul: Kvetoucí Duše', icon: 'fa-leaf', value: null },
        28: { type: 'item', key: 'may_gem_spring', name: 'Jarní Krystal', icon: 'fa-gem', value: 1 } // value zde může být ID itemu nebo počet
    };

    let ui = {};

    const activityVisuals = {
        exercise: { name: 'Trénink', icon: 'fa-laptop-code', class: 'exercise' },
        test: { name: 'Test', icon: 'fa-vial', class: 'test' },
        test_diagnostic_completed: { name: 'Diagnostický Test Dokončen', icon: 'fa-microscope', class: 'diagnostic' },
        vyuka_topic_started: { name: 'Výuka Zahájena', icon: 'fa-chalkboard-teacher', class: 'lesson' },
        vyuka_topic_finished: { name: 'Výuka Dokončena', icon: 'fa-graduation-cap', class: 'lesson' },
        badge: { name: 'Odznak Získán', icon: 'fa-medal', class: 'badge' },
        diagnostic: { name: 'Diagnostika', icon: 'fa-microscope', class: 'diagnostic' }, // Obecná diagnostika
        lesson: { name: 'Nová Data', icon: 'fa-book-open', class: 'lesson' }, // Obecná lekce
        plan_generated: { name: 'Plán Aktualizován', icon: 'fa-route', class: 'plan_generated' },
        level_up: { name: 'Level UP!', icon: 'fa-angle-double-up', class: 'level_up' },
        streak_milestone_claimed: { name: 'Milník Série', icon: 'fa-meteor', class: 'streak' },
        monthly_reward_claimed: { name: 'Měsíční Odměna', icon: 'fa-gift', class: 'badge' },
        profile_updated: { name: 'Profil Aktualizován', icon: 'fa-user-edit', class: 'other' },
        custom_task_completed: { name: 'Úkol Dokončen', icon: 'fa-check-square', class: 'exercise' },
        other: { name: 'Systémová Zpráva', icon: 'fa-info-circle', class: 'other' },
        default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
    };
    // --- END: Initialization and Configuration ---

    // --- START: DOM Element Caching ---
    function cacheDOMElements() {
        console.log("[CACHE DOM] Caching elements...");
        ui = {
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
            dashboardHeader: document.querySelector('.dashboard-header'),
            dashboardTitle: document.getElementById('dashboard-title'),
            refreshDataBtn: document.getElementById('refresh-data-btn'),
            notificationBell: document.getElementById('notification-bell'),
            notificationCount: document.getElementById('notification-count'),
            notificationsDropdown: document.getElementById('notifications-dropdown'),
            notificationsList: document.getElementById('notifications-list'),
            noNotificationsMsg: document.getElementById('no-notifications-msg'),
            markAllReadBtn: document.getElementById('mark-all-read'),
            welcomeTitle: document.getElementById('welcome-title'),
            startPracticeBtn: document.getElementById('start-practice-btn'),
            openMonthlyModalBtn: document.getElementById('open-monthly-modal-btn'),
            openStreakModalBtn: document.getElementById('open-streak-modal-btn'),
            progressCard: document.getElementById('progress-card'),
            overallProgressValue: document.getElementById('overall-progress-value'),
            overallProgressFooter: document.getElementById('overall-progress-footer'),
            pointsCard: document.getElementById('points-card'),
            totalPointsValue: document.getElementById('total-points-value'),
            totalPointsFooter: document.getElementById('total-points-footer'),
            streakCard: document.getElementById('streak-card'),
            streakValue: document.getElementById('streak-value'),
            streakFooter: document.getElementById('streak-footer'),
            activityListContainer: document.getElementById('activity-list-container'),
            activityList: document.getElementById('activity-list'),
            activityListEmptyState: document.getElementById('activity-list-empty-state'),
            activityListErrorState: document.getElementById('activity-list-error-state'),
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
            toastContainer: document.getElementById('toast-container'),
            globalError: document.getElementById('global-error'),
            offlineBanner: document.getElementById('offline-banner'),
            mouseFollower: document.getElementById('mouse-follower'),
            currentYearFooter: document.getElementById('currentYearFooter')
        };
        const missingElements = Object.entries(ui).filter(([key, element]) => element === null).map(([key]) => key);
        if (missingElements.length > 0) { console.warn(`[CACHE DOM] Following elements were not found: (${missingElements.length})`, missingElements); }
        else { console.log("[CACHE DOM] Caching complete."); }
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
                                sec === 'notifications' ? ui.notificationsDropdown : // Rodič pro notifikace
                                null;
            const statCards = sec === 'stats' ? [ui.progressCard, ui.pointsCard, ui.streakCard] : [];

            if (statCards.length > 0) {
                 statCards.forEach(card => card?.classList.toggle('loading', isLoadingFlag));
            } else if (loaderOverlay || parentSection) { // Check if parentSection exists for sections like activities
                parentSection?.classList.toggle('loading', isLoadingFlag);
                if (loaderOverlay) loaderOverlay.classList.toggle('hidden', !isLoadingFlag);

                if (isLoadingFlag) {
                    if (contentContainer) contentContainer.innerHTML = '';
                    if (emptyStateContainer) emptyStateContainer.style.display = 'none';

                    if (sec === 'activities') renderActivitySkeletons(5);
                    else if (sec === 'monthlyRewards') renderMonthlyCalendarSkeletons();
                    else if (sec === 'streakMilestones') renderMilestoneSkeletons();
                    else if (sec === 'notifications') renderNotificationSkeletons(2);
                } else {
                    if (contentContainer && !contentContainer.hasChildNodes() && emptyStateContainer) {
                        emptyStateContainer.style.display = 'block';
                    } else if (emptyStateContainer) {
                        emptyStateContainer.style.display = 'none';
                    }
                }
            } else if (sec === 'notifications' && ui.notificationBell) { // Speciální ošetření pro notifikace
                 ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                 if(ui.markAllReadBtn) {
                     const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                     ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
                 }
                 if (isLoadingFlag && ui.notificationsList && typeof renderNotificationSkeletons === 'function') { // Zajistí, že renderNotificationSkeletons je definována
                     renderNotificationSkeletons(2);
                 }
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
    // --- END: Helper Functions ---

    // --- START: Supabase Client Initialization ---
    function initializeSupabase() { console.log("[Supabase] Attempting initialization..."); try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded or createClient is not a function."); } supabase = window.supabase.createClient(supabaseUrl, supabaseKey); if (!supabase) { throw new Error("Supabase client creation failed (returned null/undefined)."); } window.supabaseClient = supabase; console.log('[Supabase] Klient úspěšně inicializován a globálně dostupný.'); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); if (typeof showError === 'function') { showError("Kritická chyba: Nepodařilo se připojit k databázi. Zkuste obnovit stránku.", true); } else { alert("Kritická chyba: Nepodařilo se připojit k databázi. Zkuste obnovit stránku."); } return false; } }
    // --- END: Supabase Client Initialization ---

    // --- START: Data Loading and Processing ---
    async function fetchUserProfile(userId) { if (!supabase || !userId) return null; console.log(`[Profile] Fetching profile for user ID: ${userId}`); try { const { data: profile, error } = await supabase.from('profiles').select('*, selected_title, last_login, streak_days, longest_streak_days, monthly_claims, last_milestone_claimed, purchased_titles').eq('id', userId).single(); if (error && error.code !== 'PGRST116') { throw error; } if (!profile) { console.warn(`[Profile] Profile for ${userId} not found. Returning null.`); return null; } profile.monthly_claims = profile.monthly_claims || {}; profile.last_milestone_claimed = profile.last_milestone_claimed || 0; profile.purchased_titles = profile.purchased_titles || []; console.log("[Profile] Profile data fetched successfully:", profile); return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); return null; } }
    async function createDefaultProfile(userId, userEmail) { if (!supabase || !userId || !userEmail) return null; console.log(`[Profile Create] Creating default profile for user ${userId}`); try { const defaultData = { id: userId, email: userEmail, username: userEmail.split('@')[0] || `user_${userId.substring(0, 6)}`, level: 1, points: 0, experience: 0, badges_count: 0, streak_days: 0, longest_streak_days: 0, last_login: new Date().toISOString(), monthly_claims: {}, last_milestone_claimed: 0, purchased_titles: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), preferences: { dark_mode: window.matchMedia('(prefers-color-scheme: dark)').matches, language: 'cs' }, notifications: { email: true, study_tips: true, content_updates: true, practice_reminders: true } }; const { data: newProfile, error } = await supabase.from('profiles').insert(defaultData).select('*, selected_title, last_login, streak_days, longest_streak_days, monthly_claims, last_milestone_claimed, purchased_titles').single(); if (error) { if (error.code === '23505') { console.warn("[Profile Create] Profile likely already exists, fetching again."); return await fetchUserProfile(userId); } throw error; } console.log("[Profile Create] Default profile created:", newProfile); return newProfile; } catch (error) { console.error("[Profile Create] Failed to create default profile:", error); return null; } }
    async function fetchTitles() { if (!supabase) return []; console.log("[Titles] Fetching available titles..."); setLoadingState('titles', true); try { const { data, error } = await supabase.from('title_shop').select('title_key, name'); if (error) throw error; console.log("[Titles] Fetched titles:", data); return data || []; } catch (error) { console.error("[Titles] Error fetching titles:", error); return []; } finally { setLoadingState('titles', false); } }
    async function fetchUserStats(userId, profileData) { if (!supabase || !userId || !profileData) { console.error("[Stats] Chybí Supabase klient, ID uživatele nebo data profilu."); return null; } console.log(`[Stats] Načítání statistik pro uživatele ${userId}...`); let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats] Chyba Supabase při načítání user_stats:", statsError.message); } } catch (error) { console.error("[Stats] Neočekávaná chyba při načítání user_stats:", error); statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: profileData.longest_streak_days ?? Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0 }; if (statsError) { console.warn("[Stats] Vracení statistik primárně z profilu kvůli chybě načítání."); } else { console.log("[Stats] Statistiky úspěšně načteny/sestaveny:", finalStats); } return finalStats; }
    async function fetchRecentActivities(userId, limit = 5) {
        if (!supabase || !userId) { console.error("[Activities] Chybí Supabase nebo ID uživatele."); return []; }
        console.log(`[Activities] Načítání posledních ${limit} aktivit pro uživatele ${userId}`);
        // Nyní setLoadingState('activities', true) je voláno z loadDashboardData
        try {
            const { data, error } = await supabase
                .from('activities')
                .select('title, description, type, created_at, icon, link_url, details')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            console.log(`[Activities] Načteno ${data?.length || 0} aktivit.`);
            return data || [];
        } catch (error) {
            console.error('[Activities] Výjimka při načítání aktivit:', error);
            showToast('Chyba aktivit', 'Nepodařilo se načíst nedávné aktivity.', 'error');
            return []; // Vrať prázdné pole v případě chyby, aby UI mohlo zobrazit chybový stav
        }
        // setLoadingState('activities', false) je také voláno z loadDashboardData po dokončení
    }
    async function fetchNotifications(userId, limit = 5) { if (!supabase || !userId) { console.error("[Notifications] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; console.log(`[Notifications] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; } }

    async function checkAndUpdateLoginStreak() {
        if (!currentUser || !currentProfile || !supabase) { console.warn("[StreakCheck] Cannot perform check: missing user, profile, or supabase."); return false; }
        console.log("[StreakCheck] Performing daily login check/update...");
        const today = new Date();
        const lastLogin = currentProfile.last_login ? new Date(currentProfile.last_login) : null;
        let currentStreak = currentProfile.streak_days || 0;
        let longestStreak = currentProfile.longest_streak_days || 0;
        let needsDbUpdate = false;
        let updateData = {};
        const currentMonthYear = getCurrentMonthYearString(); // Formát YYYY-MM

        if (!lastLogin || !isSameDate(today, lastLogin)) {
            needsDbUpdate = true; console.log("[StreakCheck] First login of the day detected.");
            if (lastLogin && isYesterday(lastLogin, today)) {
                currentStreak++; console.log(`[StreakCheck] Streak continued! New current streak: ${currentStreak}`);
            } else if (lastLogin) {
                currentStreak = 1; console.log("[StreakCheck] Streak broken. Resetting to 1.");
            } else {
                currentStreak = 1; console.log("[StreakCheck] First login ever. Setting streak to 1.");
            }
            updateData.streak_days = currentStreak;
            updateData.last_login = today.toISOString();

            if (currentStreak > longestStreak) {
                longestStreak = currentStreak;
                updateData.longest_streak_days = longestStreak;
                console.log(`[StreakCheck] New longest streak: ${longestStreak}!`);
            }
        } else {
            console.log("[StreakCheck] Already logged in today. No streak update needed for current streak.");
            if (currentProfile.streak_days > (currentProfile.longest_streak_days || 0) ) { // Pojistka
                 console.warn(`[StreakCheck] Discrepancy found: streak_days (${currentProfile.streak_days}) > longest_streak_days (${currentProfile.longest_streak_days || 0}). Updating longest_streak.`);
                 updateData.longest_streak_days = currentProfile.streak_days;
                 longestStreak = currentProfile.streak_days; // Aktualizujeme i lokální proměnnou
                 needsDbUpdate = true;
            }
        }

        currentProfile.streak_days = currentStreak; // Aktualizujeme lokální profil
        currentProfile.longest_streak_days = longestStreak; // Aktualizujeme lokální profil

        if (ui.modalCurrentStreakValue) ui.modalCurrentStreakValue.textContent = currentStreak;

        // Inicializace pole pro aktuální měsíc, pokud neexistuje
        currentProfile.monthly_claims = currentProfile.monthly_claims || {};
        if (!currentProfile.monthly_claims[currentMonthYear]) {
            console.log(`[StreakCheck] Initializing claims for new month: ${currentMonthYear}`);
            const updatedClaims = { ...currentProfile.monthly_claims, [currentMonthYear]: [] };
            currentProfile.monthly_claims = updatedClaims; // Aktualizace lokálního stavu
            updateData.monthly_claims = updatedClaims; // Přidání do DB update payload
            needsDbUpdate = true;
        } else {
            console.log(`[StreakCheck] Monthly claims for ${currentMonthYear} already exist.`);
        }

        if (needsDbUpdate) {
            console.log("[StreakCheck] Updating profile in DB with:", updateData);
            try {
                const { error: updateError } = await supabase.from('profiles').update(updateData).eq('id', currentUser.id);
                if (updateError) throw updateError;
                // Aktualizace lokálního profilu se již stala výše pro streak_days, longest_streak_days a monthly_claims
                if (updateData.last_login) currentProfile.last_login = updateData.last_login;
                console.log("[StreakCheck] Profile updated successfully in DB.");
                return true; // Indikuje, že proběhla aktualizace DB
            } catch (error) {
                console.error("[StreakCheck] Error updating profile:", error);
                showToast('Chyba', 'Nepodařilo se aktualizovat data přihlášení.', 'error');
                return false;
            }
        }
        return false; // Indikuje, že DB aktualizace nebyla nutná (ale lokální profil mohl být upraven)
    }
    async function updateMonthlyClaimsInDB(newClaimsData) { if (!currentUser || !supabase) return false; console.log("[DB Update] Updating monthly claims in DB:", newClaimsData); try { const { error } = await supabase.from('profiles').update({ monthly_claims: newClaimsData, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (error) throw error; console.log("[DB Update] Monthly claims update successful."); return true; } catch (error) { console.error("[DB Update] Error updating monthly claims:", error); showToast('Chyba', 'Nepodařilo se uložit vyzvednutí měsíční odměny.', 'error'); return false; } }
    async function updateLastMilestoneClaimedInDB(milestoneDay, rewardKey, rewardName) {
        if (!currentUser || !supabase) return false;
        console.log(`[DB Update] Attempting to record claim for milestoneDay: ${milestoneDay}, rewardKey: ${rewardKey}`);
        try {
            // Nejprve zkusíme vložit, pokud selže kvůli unikátnosti, znamená to, že uživatel již vyzvedl
            const { error: insertError } = await supabase
                .from('claimed_streak_milestones')
                .insert({
                    user_id: currentUser.id,
                    milestone_day: milestoneDay,
                    reward_key: rewardKey, // Ukládáme klíč odměny
                    reward_name: rewardName
                });

            if (insertError && insertError.code !== '23505') { // Kód 23505 je chyba unikátnosti
                console.error(`[DB Update] Error inserting into claimed_streak_milestones for milestone ${milestoneDay}:`, insertError);
                throw insertError; // Vyhodit chybu, pokud to není jen duplicitní záznam
            } else if (insertError && insertError.code === '23505') {
                console.warn(`[DB Update] Milestone ${milestoneDay} (key: ${rewardKey}) already claimed by user ${currentUser.id}. No new record inserted.`);
                // Není potřeba aktualizovat `last_milestone_claimed` v tomto případě, pokud UI spoléhá na tuto tabulku
                return true; // Považujeme za úspěch, protože záznam již existuje
            }

            console.log(`[DB Update] Milestone ${milestoneDay} (key: ${rewardKey}) successfully recorded in claimed_streak_milestones.`);

            // Volitelně aktualizujeme `last_milestone_claimed` v `profiles` pro rychlý přístup k nejvyššímu vyzvednutému
            if (currentProfile && milestoneDay > (currentProfile.last_milestone_claimed || 0)) {
                const { error: profileUpdateError } = await supabase
                    .from('profiles')
                    .update({ last_milestone_claimed: milestoneDay, updated_at: new Date().toISOString() })
                    .eq('id', currentUser.id);
                if (profileUpdateError) {
                    console.error(`[DB Update] Error updating profiles.last_milestone_claimed for ${milestoneDay}:`, profileUpdateError);
                    // I když toto selže, hlavní záznam o vyzvednutí je v `claimed_streak_milestones`
                } else {
                    currentProfile.last_milestone_claimed = milestoneDay; // Aktualizuj lokální stav
                    console.log(`[DB Update] profiles.last_milestone_claimed updated to ${milestoneDay}.`);
                }
            }
            return true;
        } catch (error) {
            console.error(`[DB Update] General error in updateLastMilestoneClaimedInDB for ${milestoneDay}:`, error);
            showToast('Chyba', 'Nepodařilo se uložit vyzvednutí milníkové odměny.', 'error');
            return false;
        }
    }
    async function awardPoints(pointsValue, reason = "Nespecifikováno") {
        if (!currentUser || !currentProfile || !supabase) { console.warn("Cannot award points: User, profile, or Supabase missing."); return; }
        if (pointsValue <= 0) { console.log("No points to award or negative value."); return; }
        console.log(`[Points] Awarding ${pointsValue} points for: ${reason}`);
        setLoadingState('stats', true);
        const currentPoints = currentProfile.points || 0;
        const newPoints = currentPoints + pointsValue;
        try {
            const { error } = await supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', currentUser.id);
            if (error) throw error;
            currentProfile.points = newPoints;
            showToast('Kredity Získány!', `+${pointsValue} kreditů za: ${reason}`, 'success', 2500);
            // Nyní se ujistíme, že userStatsData je aktuální před voláním updateStatsCards
            userStatsData = await fetchUserStats(currentUser.id, currentProfile); // Znovu načteme/aktualizujeme userStatsData
            updateStatsCards(userStatsData); // Refresh stats cards s novými userStatsData
            // Logování aktivity pro získání bodů
            await logActivity(
                currentUser.id,
                'points_earned',
                `Získáno ${pointsValue} kreditů`,
                `Důvod: ${reason}`,
                { points: pointsValue, new_total: newPoints },
                null, null, 'fa-coins'
            );
        } catch (error) {
            console.error(`[Points] Error awarding points:`, error);
            showToast('Chyba', 'Nepodařilo se připsat kredity.', 'error');
        } finally {
            setLoadingState('stats', false);
        }
    }
    async function loadDashboardData(user, profile) {
        if (!user || !profile) { showError("Chyba: Nelze načíst data bez profilu uživatele.", true); setLoadingState('all', false); return; }
        console.log("[MAIN] loadDashboardData: Start pro uživatele:", user.id);
        hideError();
        setLoadingState('stats', true);
        setLoadingState('activities', true);
        setLoadingState('notifications', true);
        if (typeof renderActivitySkeletons === 'function') renderActivitySkeletons(5);

        try {
            await checkAndUpdateLoginStreak(); // Zkontroluje a aktualizuje sérii a longest_streak
            updateSidebarProfile(profile); // Aktualizuje sidebar, včetně titulu (allTitles by měly být načteny v initializeApp)

            console.log("[MAIN] loadDashboardData: Načítání statistik, aktivit, oznámení...");
            const [statsResult, activitiesResult, notificationsResult] = await Promise.allSettled([
                fetchUserStats(user.id, profile), // fetchUserStats nyní používá profiles.longest_streak_days
                fetchRecentActivities(user.id, 5),
                fetchNotifications(user.id, 5)
            ]);
            console.log("[MAIN] loadDashboardData: Souběžné načítání dokončeno:", [statsResult, activitiesResult, notificationsResult]);

            if (statsResult.status === 'fulfilled') {
                userStatsData = statsResult.value; // Uložíme načtené statistiky
                updateStatsCards(userStatsData || profile); // Zobrazíme je
            } else {
                console.error("❌ Chyba při načítání statistik:", statsResult.reason);
                showError("Nepodařilo se načíst statistiky.", false);
                updateStatsCards(profile); // Zobrazíme alespoň data z profilu
            }
            setLoadingState('stats', false);

            if (activitiesResult.status === 'fulfilled') {
                renderActivities(activitiesResult.value || []);
            } else {
                console.error("❌ Chyba při načítání aktivit:", activitiesResult.reason);
                showError("Nepodařilo se načíst aktivity.", false);
                renderActivities(null); // Zobrazí chybový stav
            }
            setLoadingState('activities', false);

            if (notificationsResult.status === 'fulfilled') {
                const { unreadCount, notifications } = notificationsResult.value || { unreadCount: 0, notifications: [] };
                renderNotifications(unreadCount, notifications);
            } else {
                console.error("❌ Chyba při načítání oznámení:", notificationsResult.reason);
                showError("Nepodařilo se načíst oznámení.", false);
                renderNotifications(0, []);
            }
            setLoadingState('notifications', false);

            console.log("[MAIN] loadDashboardData: Statické sekce обработаны.");
        } catch (error) {
            console.error('[MAIN] loadDashboardData: Zachycena hlavní chyba:', error);
            showError('Nepodařilo se kompletně načíst data nástěnky: ' + error.message);
            updateStatsCards(profile); // Zobrazíme alespoň data z profilu
            renderActivities(null);
            renderNotifications(0, []);
        } finally {
            // setLoadingState('all', false); // Toto by se nemělo volat, protože jednotlivé sekce se starají o svůj stav
            if (typeof initTooltips === 'function') initTooltips();
        }
    }
    // --- END: Data Loading ---

    // --- START: UI Update Functions ---
    function updateSidebarProfile(profile) {
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { cacheDOMElements(); /* ... */ }
        console.log("[UI Update] Aktualizace sidebaru...");
        if (profile) {
            const firstName = profile.first_name ?? '';
            const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(profile);
            const avatarUrl = profile.avatar_url;
            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
            const sidebarImg = ui.sidebarAvatar.querySelector('img');
            if (sidebarImg) { sidebarImg.onerror = () => { ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; }

            const selectedTitleKey = profile.selected_title;
            let displayTitle = 'Pilot';
            if (selectedTitleKey && allTitles && allTitles.length > 0) {
                const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) displayTitle = foundTitle.name;
                else console.warn(`[UI Update Sidebar] Title key "${selectedTitleKey}" not found in titles list.`);
            } else if (selectedTitleKey) { console.warn(`[UI Update Sidebar] Selected title key present, but titles list is empty or not loaded.`); }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle));

            if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`;
            console.log("[UI Update] Sidebar aktualizován.");
        } else { /* ... (ošetření chybějícího profilu) ... */ }
    }
    function updateStatsCards(stats) {
        console.log("[UI Update] Aktualizace karet statistik:", stats);
        const statElements = {
            progress: ui.overallProgressValue, points: ui.totalPointsValue, streak: ui.streakValue,
            progressFooter: ui.overallProgressFooter, pointsFooter: ui.totalPointsFooter, streakFooter: ui.streakFooter
        };
        const cards = [ui.progressCard, ui.pointsCard, ui.streakCard];
        const requiredElements = Object.values(statElements);
        if (requiredElements.some(el => !el)) { console.error("[UI Update Stats] Chybějící elementy statistik."); cards.forEach(card => card?.classList.remove('loading')); return; }
        cards.forEach(card => card?.classList.remove('loading'));
        if (!stats) { /* ... (ošetření chybějících statistik) ... */ return; }

        statElements.progress.textContent = `${stats.progress ?? 0}%`;
        const weeklyProgress = stats.progress_weekly ?? 0;
        statElements.progressFooter.classList.remove('positive', 'negative');
        statElements.progressFooter.innerHTML = weeklyProgress > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyProgress}% týdně` : weeklyProgress < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyProgress}% týdně` : `<i class="fas fa-minus"></i> --`;
        if (weeklyProgress > 0) statElements.progressFooter.classList.add('positive'); else if (weeklyProgress < 0) statElements.progressFooter.classList.add('negative');

        statElements.points.textContent = stats.points ?? 0;
        const weeklyPoints = stats.points_weekly ?? 0;
        statElements.pointsFooter.classList.remove('positive', 'negative');
        statElements.pointsFooter.innerHTML = weeklyPoints > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyPoints} týdně` : weeklyPoints < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyPoints} týdně` : `<i class="fas fa-minus"></i> --`;
        if (weeklyPoints > 0) statElements.pointsFooter.classList.add('positive'); else if (weeklyPoints < 0) statElements.pointsFooter.classList.add('negative');

        statElements.streak.textContent = stats.streak_current ?? 0;
        // Zobrazení i nejdelší série
        statElements.streakFooter.innerHTML = `MAX: ${stats.streak_longest ?? 0} dní`; // Použijeme innerHTML pro případné ikony
        if ((stats.streak_current ?? 0) > 0 && (stats.streak_current !== stats.streak_longest)) {
            statElements.streakFooter.innerHTML += ` <span style="color:var(--text-muted); font-size:0.9em;">(Aktuální: ${stats.streak_current ?? 0})</span>`;
        }
        console.log("[UI Update] Karty statistik aktualizovány.");
    }
    function renderActivities(activities) {
        if (!ui.activityList || !ui.activityListContainer || !ui.activityListEmptyState || !ui.activityListErrorState) {
            console.error("[Render Activities] Essential UI elements for activity list are missing. Rendering cancelled.");
            // setLoadingState('activities', false); // Ujisti se, že loader je vypnutý
            return;
        }
        console.log("[Render Activities] Start rendering, activities count:", activities?.length);
        ui.activityList.innerHTML = '';
        ui.activityListEmptyState.style.display = 'none';
        ui.activityListErrorState.style.display = 'none';
        ui.activityList.style.display = 'none';

        if (activities === null) {
            ui.activityListErrorState.style.display = 'block';
            console.warn("[Render Activities] Received null data, showing error state.");
        } else if (!activities || activities.length === 0) {
            ui.activityListEmptyState.style.display = 'block';
            console.log("[Render Activities] No activities to display, showing empty state.");
        } else {
            const fragment = document.createDocumentFragment();
            activities.forEach(activity => {
                const typeLower = activity.type?.toLowerCase() || 'default';
                const visual = activityVisuals[typeLower] || activityVisuals.default;
                const title = sanitizeHTML(activity.title || 'Neznámá aktivita');
                let description = sanitizeHTML(activity.description || '');
                const timeAgo = formatRelativeTime(activity.created_at);
                const icon = activity.icon || visual.icon; // Prefer icon from DB, fallback to visual map
                const linkUrl = activity.link_url;
                const details = activity.details; // JSONB

                if (details) {
                    let detailsString = '';
                    if (details.score !== undefined && details.max_score !== undefined) {
                        detailsString += `Skóre: ${details.score}/${details.max_score}. `;
                    } else if (details.score !== undefined) {
                        detailsString += `Skóre: ${details.score}. `;
                    }
                    if (details.topic) {
                        detailsString += `Téma: ${sanitizeHTML(details.topic)}. `;
                    }
                    if (details.duration) {
                        detailsString += `Trvání: ${details.duration}. `;
                    }
                    if (detailsString) {
                        description += `<br><small style="color: var(--text-muted); font-size: 0.85em;"><em>${detailsString.trim()}</em></small>`;
                    }
                }

                const item = document.createElement('div');
                item.className = 'activity-item';

                let itemContent = `
                    <div class="activity-icon ${visual.class}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${title}</div>
                        ${description ? `<div class="activity-desc">${description}</div>` : ''}
                        <div class="activity-time">
                            <i class="far fa-clock"></i> ${timeAgo}
                        </div>
                    </div>`;

                if (linkUrl) {
                    item.innerHTML = `<a href="${sanitizeHTML(linkUrl)}" class="activity-link-wrapper" target="_blank" rel="noopener noreferrer">${itemContent}</a>`;
                } else {
                    item.innerHTML = itemContent;
                }
                fragment.appendChild(item);
            });
            ui.activityList.appendChild(fragment);
            ui.activityList.style.display = 'block';
            console.log(`[Render Activities] Rendered ${activities.length} items.`);
        }
        ui.activityListContainer.classList.remove('loading');
        // setLoadingState('activities', false); // Již se volá ve fetchRecentActivities
    }
    function renderActivitySkeletons(count = 5) { if (!ui.activityList || !ui.activityListContainer) { console.warn("Cannot render activity skeletons: List or container not found."); return; } ui.activityListContainer.classList.add('loading'); ui.activityList.innerHTML = ''; if(ui.activityListEmptyState) ui.activityListEmptyState.style.display = 'none'; if(ui.activityListErrorState) ui.activityListErrorState.style.display = 'none'; let skeletonHTML = '<div class="loading-placeholder">'; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="skeleton-activity-item"> <div class="skeleton icon-placeholder"></div> <div style="flex-grow: 1;"> <div class="skeleton activity-line"></div> <div class="skeleton activity-line text-short"></div> <div class="skeleton activity-line-short"></div> </div> </div>`; } skeletonHTML += '</div>'; ui.activityList.innerHTML = skeletonHTML; ui.activityList.style.display = 'block'; console.log(`[Render Skeletons] Rendered ${count} activity skeletons.`); }
    function renderNotifications(count, notifications) { if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { /* ... */ return; } console.log("[Render Notifications] Start, Počet:", count, "Oznámení:", notifications); ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } console.log("[Render Notifications] Hotovo"); }
    function renderNotificationSkeletons(count = 2) { /* ... (stejná jako v originále) ... */ }
    function renderMonthlyCalendar() { /* ... (stejná jako v originále) ... */ }
    function renderMonthlyCalendarSkeletons() { /* ... (stejná jako v originále) ... */ }
    function renderStreakMilestones() {
        if (!ui.modalMilestonesGrid || !ui.modalMilestonesEmpty || !ui.modalCurrentStreakValue) {
            console.error("Streak milestones MODAL UI elements missing."); setLoadingState('streakMilestones', false); return;
        }
        console.log("[RenderMilestones] Rendering streak milestones...");
        setLoadingState('streakMilestones', true);
        const gridContainer = ui.modalMilestonesGrid; const emptyState = ui.modalMilestonesEmpty; const streakSpan = ui.modalCurrentStreakValue;
        const currentStreak = currentProfile?.streak_days || 0;
        streakSpan.textContent = currentStreak;
        gridContainer.innerHTML = ''; emptyState.style.display = 'none'; gridContainer.style.display = 'grid';

        supabase.from('claimed_streak_milestones').select('milestone_day').eq('user_id', currentUser.id)
            .then(({ data: claimedData, error: fetchClaimedError }) => {
                if (fetchClaimedError) { console.error("Error fetching claimed streak milestones:", fetchClaimedError); showToast('Chyba', 'Nepodařilo se načíst vyzvednuté milníky série.', 'error'); setLoadingState('streakMilestones', false); return; }
                const claimedMilestoneDaysSet = new Set((claimedData || []).map(c => c.milestone_day));
                console.log("[RenderMilestones] Claimed milestones loaded:", claimedMilestoneDaysSet);

                const fragment = document.createDocumentFragment(); let milestonesToShow = 0;
                sortedMilestoneDays.forEach(milestoneDay => {
                    const config = STREAK_MILESTONES_CONFIG[milestoneDay]; if (!config) return;
                    const milestoneElement = document.createElement('div'); milestoneElement.classList.add('milestone-card'); milestoneElement.dataset.milestone = milestoneDay;
                    const isClaimed = claimedMilestoneDaysSet.has(milestoneDay);
                    const isClaimable = currentStreak >= milestoneDay && !isClaimed;
                    const isLocked = currentStreak < milestoneDay;
                    let statusHTML = ''; let buttonHTML = '';
                    if (isClaimed) { milestoneElement.classList.add('claimed'); statusHTML = `<span class="reward-status">Získáno</span>`; }
                    else if (isClaimable) { milestoneElement.classList.add('available'); statusHTML = `<span class="reward-status">Dostupné</span>`; buttonHTML = `<button class="claim-button btn btn-sm btn-success"><i class="fas fa-check"></i> Vyzvednout</button>`; }
                    else { milestoneElement.classList.add('locked'); const daysNeeded = milestoneDay - currentStreak; statusHTML = `<span class="reward-status">Ještě ${daysNeeded} ${daysNeeded === 1 ? 'den' : (daysNeeded < 5 ? 'dny' : 'dní')}</span>`; }
                    milestoneElement.innerHTML = `<span class="day-number">Série ${milestoneDay}</span><div class="reward-icon"><i class="fas ${config.icon || 'fa-award'}"></i></div><span class="reward-text" title="${sanitizeHTML(config.description)}">${sanitizeHTML(config.name)}</span>${statusHTML}${buttonHTML}`;
                    const claimButton = milestoneElement.querySelector('.claim-button');
                    if (claimButton) { claimButton.addEventListener('click', (e) => { e.stopPropagation(); claimMilestoneReward(milestoneDay, claimButton, config.reward_type, config.reward_value, config.name, config.reward_key); }); }
                    fragment.appendChild(milestoneElement); milestonesToShow++;
                });
                if (milestonesToShow > 0) { gridContainer.appendChild(fragment); } else { emptyState.innerHTML = '<i class="fas fa-road"></i><p>Pro tuto sérii nejsou definovány žádné milníky.</p>'; emptyState.style.display = 'block'; gridContainer.style.display = 'none'; }
                setLoadingState('streakMilestones', false); initTooltips();
            })
            .catch(error => {
                console.error("Error in renderStreakMilestones fetching claimed data:", error);
                showToast('Chyba', 'Nepodařilo se načíst data o milnících.', 'error');
                emptyState.innerHTML = '<i class="fas fa-exclamation-triangle"></i><p>Chyba načítání milníků.</p>';
                emptyState.style.display = 'block'; gridContainer.style.display = 'none';
                setLoadingState('streakMilestones', false);
            });
        console.log("[RenderMilestones] Milestones rendering initiated in modal.");
    }
    function renderMilestoneSkeletons() { /* ... (stejná jako v originále) ... */ }
    // --- END: UI Update Functions ---

    // --- START: Claim Reward Logic ---
    async function claimMonthlyReward(day, buttonElement, rewardType = 'default', rewardValue = 1, rewardName = `Odměna dne ${day}`) { /* ... (stejná jako v originále) ... */ }
    async function claimMilestoneReward(milestoneDay, buttonElement, rewardType, rewardValue, rewardName, rewardKey) {
        console.log(`[ClaimMilestone] Attempting claim for milestone ${milestoneDay}. Reward: ${rewardType}, Value: ${rewardValue}, Name: ${rewardName}, Key: ${rewardKey}`);
        if (!currentUser || !currentProfile || !supabase || isLoading.streakMilestones) return;

        // Ověření na straně klienta, zda uživatel milník již nevyzvedl (rychlá kontrola, hlavní je DB)
        const { data: existingClaimCheck, error: clientCheckError } = await supabase
            .from('claimed_streak_milestones')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('milestone_day', milestoneDay)
            .maybeSingle();

        if (clientCheckError) { console.error("Error checking claim (client-side):", clientCheckError); showToast('Chyba', 'Ověření milníku selhalo.', 'error'); return; }
        if (existingClaimCheck) { console.warn(`Milestone ${milestoneDay} already claimed (client check).`); showToast('Již Vyzvednuto', 'Tento milník byl již vyzvednut.', 'info'); renderStreakMilestones(); return; }


        setLoadingState('streakMilestones', true);
        if (buttonElement) { buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

        const currentStreak = currentProfile?.streak_days || 0;
        if (currentStreak < milestoneDay) { console.warn(`[ClaimMilestone] Milestone ${milestoneDay} not yet reached (current streak: ${currentStreak}).`); showToast('Chyba', 'Podmínky pro tento milník ještě nebyly splněny.', 'warning'); setLoadingState('streakMilestones', false); renderStreakMilestones(); return; }

        // updateLastMilestoneClaimedInDB nyní správně zapisuje do 'claimed_streak_milestones'
        const dbSuccess = await updateLastMilestoneClaimedInDB(milestoneDay, rewardKey, rewardName);

        if (dbSuccess) {
            console.log(`[ClaimMilestone] DB update successful for milestone ${milestoneDay}.`);
            let activityTitle = `Odměna za milník: ${rewardName}`;
            let activityDescription = `Uživatel dosáhl ${milestoneDay} dní studijní série a vyzvedl si odměnu.`;

            switch (rewardType) {
                case 'points':
                    await awardPoints(rewardValue, `Odměna za sérii ${milestoneDay} dní`);
                    activityDescription += ` Získáno ${rewardValue} kreditů.`;
                    break;
                case 'badge':
                    // Předpokládáme, že `rewardValue` je zde `badge_key` nebo `badge_id`
                    const badgeKeyToAward = rewardValue;
                    console.log(`[ClaimMilestone] Attempting to award badge with key: ${badgeKeyToAward}`);
                    // Získání ID odznaku z tabulky badges podle klíče
                    const { data: badgeData, error: badgeError } = await supabase
                        .from('badges') // Ujisti se, že název tabulky 'badges' je správný
                        .select('id, title')
                        .eq('title_key', badgeKeyToAward) // Předpokládáme, že 'title_key' je sloupec pro klíč odznaku
                        .single();

                    if (badgeError || !badgeData) {
                        console.error(`[ClaimMilestone] Error fetching badge data for key ${badgeKeyToAward}:`, badgeError);
                        showToast('Chyba', `Odznak "${rewardName}" nenalezen.`, 'error');
                    } else {
                        // Vložení do user_badges
                        const { error: insertBadgeError } = await supabase
                            .from('user_badges')
                            .insert({ user_id: currentUser.id, badge_id: badgeData.id });

                        if (insertBadgeError && insertBadgeError.code !== '23505') { // 23505 = unique violation
                            console.error(`[ClaimMilestone] Error inserting user_badge for badge ID ${badgeData.id}:`, insertBadgeError);
                            showToast('Chyba', `Nepodařilo se udělit odznak "${badgeData.title}".`, 'error');
                        } else if (insertBadgeError && insertBadgeError.code === '23505') {
                             showToast('Info', `Odznak "${badgeData.title}" již vlastníte.`, 'info');
                        } else {
                            // Aktualizace počtu odznaků v profilu
                            const newBadgeCount = (currentProfile.badges_count || 0) + 1;
                            const { error: profileUpdateError } = await supabase
                                .from('profiles')
                                .update({ badges_count: newBadgeCount })
                                .eq('id', currentUser.id);
                            if (profileUpdateError) console.error("Error updating profile badge_count:", profileUpdateError);
                            else currentProfile.badges_count = newBadgeCount;

                            showToast('Odznak Získán!', `Získali jste odznak: ${badgeData.title}`, 'success');
                            activityDescription += ` Získán odznak: ${badgeData.title}.`;
                        }
                    }
                    break;
                case 'title':
                    const titleKeyToAward = rewardValue;
                    console.log(`[ClaimMilestone] Attempting to award title with key: ${titleKeyToAward}`);
                    const currentTitles = Array.isArray(currentProfile.purchased_titles) ? currentProfile.purchased_titles : [];
                    if (!currentTitles.includes(titleKeyToAward)) {
                        const newTitles = [...currentTitles, titleKeyToAward];
                        const { error: titleError } = await supabase.from('profiles').update({ purchased_titles: newTitles }).eq('id', currentUser.id);
                        if (titleError) { console.error("Error awarding title:", titleError); showToast('Chyba', 'Nepodařilo se udělit titul.', 'error'); }
                        else { currentProfile.purchased_titles = newTitles; showToast('Titul Získán!', `Získali jste titul: ${rewardName}`, 'success'); activityDescription += ` Získán titul: ${rewardName} (${titleKeyToAward}).`; }
                    } else { showToast('Titul Již Vlastníte', `Titul ${rewardName} již máte.`, 'info'); }
                    break;
                case 'item':
                    console.warn(`[ClaimMilestone] Item awarding for '${rewardValue}' (key: ${rewardKey}) not implemented yet.`);
                    showToast('Milník Dosažen!', `Získali jste předmět: ${rewardName} (Implementace TODO)`, 'success');
                    activityDescription += ` Získán předmět: ${rewardName} (klíč: ${rewardKey}).`;
                    break;
                default:
                    showToast('Milník Dosažen!', `Získali jste: ${rewardName}`, 'success');
            }
            await logActivity(currentUser.id, 'streak_milestone_claimed', activityTitle, activityDescription, { milestone_day: milestoneDay, reward_key: rewardKey, reward_name: rewardName, reward_type: rewardType, reward_value: rewardValue });
        } else { showToast('Chyba', 'Nepodařilo se uložit vyzvednutí milníkové odměny.', 'error'); }
        setLoadingState('streakMilestones', false);
        renderStreakMilestones();
    }
    // --- END: Claim Reward Logic ---

    // --- START: Notification Logic ---
    async function markNotificationRead(notificationId) { /* ... (stejná jako v originále) ... */ }
    async function markAllNotificationsRead() { /* ... (stejná jako v originále) ... */ }
    // --- END: Notification Logic ---

    // --- START: Event Listeners Setup ---
    function setupUIEventListeners() { /* ... (stejná jako v originále) ... */ }
    // --- END: Event Listeners ---

    // --- START: App Initialization ---
    async function initializeApp() {
        console.log("[INIT Dashboard] initializeApp: Start v24.2 - Aktualizace milníků");
        cacheDOMElements();

        const waitForSupabase = new Promise((resolve, reject) => { const maxAttempts = 10; let attempts = 0; const intervalId = setInterval(() => { attempts++; if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') { console.log(`[INIT Dashboard] Supabase library found after ${attempts} attempts.`); clearInterval(intervalId); resolve(); } else if (attempts >= maxAttempts) { console.error("[INIT Dashboard] Supabase library not found after waiting. Aborting."); clearInterval(intervalId); reject(new Error("Knihovna Supabase nebyla nalezena včas.")); } else { console.log(`[INIT Dashboard] Waiting for Supabase library... (Attempt ${attempts}/${maxAttempts})`); } }, 200); });
        try { await waitForSupabase; }
        catch (waitError) { showError(waitError.message, true); if(ui.initialLoader) ui.initialLoader.classList.add('hidden'); return; }

        if (!initializeSupabase()) { console.error("[INIT Dashboard] Supabase init function failed. Aborting."); return; }

        applyInitialSidebarState();
        setupUIEventListeners();

        if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; }
        if (ui.mainContent) ui.mainContent.style.display = 'none';

        try {
            console.log("[INIT Dashboard] Checking auth session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;
                console.log(`[INIT Dashboard] User authenticated (ID: ${currentUser.id}). Loading profile and titles...`);

                const [profileResult, titlesResult, notificationsResult] = await Promise.allSettled([
                    fetchUserProfile(currentUser.id),
                    fetchTitles(),
                    fetchNotifications(currentUser.id, 5)
                ]);

                if (profileResult.status === 'fulfilled' && profileResult.value) { currentProfile = profileResult.value; console.log("[INIT Dashboard] Profile loaded:", currentProfile); }
                else { console.warn("[INIT Dashboard] Profile not found or fetch failed, attempting to create default..."); currentProfile = await createDefaultProfile(currentUser.id, currentUser.email); if (!currentProfile) throw new Error("Nepodařilo se vytvořit/načíst profil uživatele."); console.log("[INIT Dashboard] Default profile created/retrieved."); }

                if (titlesResult.status === 'fulfilled') { allTitles = titlesResult.value || []; console.log("[INIT Dashboard] Titles loaded:", allTitles.length); }
                else { console.warn("[INIT Dashboard] Failed to load titles:", titlesResult.reason); allTitles = []; }

                // Po načtení profilu a titulů aktualizujeme sidebar
                updateSidebarProfile(currentProfile); // Předáno allTitles implicitně přes globální proměnnou
                updateCopyrightYear();
                updateOnlineStatus();

                // Načteme hlavní data dashboardu (včetně aktivit)
                await loadDashboardData(currentUser, currentProfile); // Tato funkce již volá fetchUserStats a fetchRecentActivities

                // Zpracování notifikací (zůstává)
                if (notificationsResult.status === 'fulfilled') { const { unreadCount, notifications } = notificationsResult.value || { unreadCount: 0, notifications: [] }; renderNotifications(unreadCount, notifications); }
                else { console.error("Error fetching notifications:", notificationsResult.reason); renderNotifications(0, []); }

                if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
                if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
                initMouseFollower();
                initHeaderScrollDetection();
                initTooltips();

                const readyEvent = new CustomEvent('dashboardReady', { detail: { user: currentUser, profile: currentProfile, client: supabase, titles: allTitles } });
                document.dispatchEvent(readyEvent);
                console.log("[INIT Dashboard] Dispatching 'dashboardReady' event.");
                console.log("✅ [INIT Dashboard] Page fully loaded and initialized.");

            } else { console.log('[INIT Dashboard] V sezení není uživatel, přesměrování.'); window.location.href = '/auth/index.html'; }
        } catch (error) { console.error("❌ [INIT Dashboard] Kritická chyba inicializace:", error); if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE.</p>`; } else { showError(`Chyba inicializace: ${error.message}`, true); } if (ui.mainContent) ui.mainContent.style.display = 'none'; setLoadingState('all', false); }
    }
    // --- END: App Initialization ---

    // --- START THE APP ---
    initializeApp();

})();