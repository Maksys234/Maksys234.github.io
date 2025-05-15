// dashboard.js
// Verze: 26.0.11 - Oprava kritické chyby s chybějícím placeholderem a robustnější skrývání initialLoaderu
(function() {
    'use strict';

    // --- START: Initialization and Configuration ---
    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = [];
    let userStatsData = null;

    const AUTH_TIMEOUT = 30000;
    const DATA_FETCH_TIMEOUT = 20000;

    let isLoading = {
        stats: false,
        activities: false,
        creditHistory: false,
        notifications: false,
        titles: false,
        monthlyRewards: false,
        streakMilestones: false,
        all: false,
        session: false
    };
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
    const MONTHLY_REWARD_DAYS = 31;

    const STREAK_MILESTONES_CONFIG = {
        3: { name: "Zahřívací Kolečko", description: "3 dny v řadě! Dobrý začátek!", icon: "fa-running", reward_type: "points", reward_value: 5, reward_key: "streak_3_days_points_5" },
        7: { name: "Týdenní Vytrvalec", description: "Celý týden bez přestávky! Skvělé!", icon: "fa-calendar-week", reward_type: "points", reward_value: 15, reward_key: "streak_7_days_points_15" },
        14: { name: "Dvou Týdenní Hrdina", description: "Již 14 dní studia! Neuvěřitelné!", icon: "fa-star", reward_type: "badge", reward_value: "badge_streak_14", reward_key: "streak_14_days_badge_perseverance" },
        30: { name: "Měsíční Maratonec", description: "Celý měsíc konzistence! Jsi legenda!", icon: "fa-trophy", reward_type: "title", reward_value: "title_monthly_marathon", reward_key: "streak_30_days_title_marathon" },
    };
    const sortedMilestoneDays = Object.keys(STREAK_MILESTONES_CONFIG).map(Number).sort((a, b) => a - b);

    const mayRewards = {
        1: { type: 'title', key: 'majovy_poutnik', name: 'Titul: Májový Poutník', icon: 'fa-hiking', value: null },
        7: { type: 'credits', key: 'may_credits_10', name: '10 Kreditů', icon: 'fa-coins', value: 10 },
        14: { type: 'credits', key: 'may_credits_14_day', name: '10 Kreditů (Den 14)', icon: 'fa-coins', value: 10 },
    };

    let ui = {};

    const activityVisuals = {
        exercise: { name: 'Trénink', icon: 'fa-laptop-code', class: 'exercise' },
        test: { name: 'Test', icon: 'fa-vial', class: 'test' },
        test_diagnostic_completed: { name: 'Diagnostický Test Dokončen', icon: 'fa-microscope', class: 'diagnostic' },
        vyuka_topic_started: { name: 'Výuka Zahájena', icon: 'fa-chalkboard-teacher', class: 'lesson' },
        vyuka_topic_finished: { name: 'Výuka Dokončena', icon: 'fa-graduation-cap', class: 'lesson' },
        badge: { name: 'Odznak Získán', icon: 'fa-medal', class: 'badge' },
        diagnostic: { name: 'Diagnostika', icon: 'fa-microscope', class: 'diagnostic' },
        lesson: { name: 'Nová Data', icon: 'fa-book-open', class: 'lesson' },
        plan_generated: { name: 'Plán Aktualizován', icon: 'fa-route', class: 'plan_generated' },
        level_up: { name: 'Level UP!', icon: 'fa-angle-double-up', class: 'level_up' },
        streak_milestone_claimed: { name: 'Milník Série', icon: 'fa-meteor', class: 'streak' },
        monthly_reward_claimed: { name: 'Měsíční Odměna', icon: 'fa-gift', class: 'badge' },
        profile_updated: { name: 'Profil Aktualizován', icon: 'fa-user-edit', class: 'other' },
        custom_task_completed: { name: 'Úkol Dokončen', icon: 'fa-check-square', class: 'exercise' },
        points_earned: { name: 'Kredity Získány', icon: 'fa-arrow-up', class: 'points_earned' },
        points_spent: { name: 'Kredity Utraceny', icon: 'fa-arrow-down', class: 'points_spent' },
        other: { name: 'Systémová Zpráva', icon: 'fa-info-circle', class: 'other' },
        default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
    };
    // --- END: Initialization and Configuration ---

    // --- START: DOM Element Caching ---
    function cacheDOMElements() {
        const startTime = performance.now();
        console.log("[CACHE DOM] Caching elements...");
        const elementDefinitions = [
            { key: 'initialLoader', id: 'initial-loader', critical: true },
            { key: 'sidebar', id: 'sidebar', critical: true },
            { key: 'mainContent', id: 'main-content', critical: true },
            { key: 'dashboardHeader', query: '.dashboard-header', critical: true },
            { key: 'globalError', id: 'global-error', critical: true },
            { key: 'sidebarAvatar', id: 'sidebar-avatar', critical: true },
            { key: 'sidebarName', id: 'sidebar-name', critical: true },
            { key: 'sidebarUserTitle', id: 'sidebar-user-title', critical: true },
            { key: 'sidebarToggleBtn', id: 'sidebar-toggle-btn', critical: true },
            { key: 'welcomeTitle', id: 'welcome-title', critical: true },
            { key: 'statsCardsContainer', query: '.stat-cards', critical: true },
            { key: 'activityListContainerWrapper', id: 'recent-activities-container-wrapper', critical: true },
            { key: 'creditHistoryContainerWrapper', id: 'credit-history-container-wrapper', critical: true },
            { key: 'mainContentAreaPlaceholder', id: 'main-content-area-placeholder', critical: true },
            { key: 'sidebarOverlay', id: 'sidebar-overlay', critical: false },
            { key: 'mainMobileMenuToggle', id: 'main-mobile-menu-toggle', critical: false },
            { key: 'sidebarCloseToggle', id: 'sidebar-close-toggle', critical: false },
            { key: 'currentYearSidebar', id: 'currentYearSidebar', critical: false },
            { key: 'dashboardTitle', id: 'dashboard-title', critical: false },
            { key: 'refreshDataBtn', id: 'refresh-data-btn', critical: false },
            { key: 'notificationBell', id: 'notification-bell', critical: false },
            { key: 'notificationCount', id: 'notification-count', critical: false },
            { key: 'notificationsDropdown', id: 'notifications-dropdown', critical: false },
            { key: 'notificationsList', id: 'notifications-list', critical: false },
            { key: 'noNotificationsMsg', id: 'no-notifications-msg', critical: false },
            { key: 'markAllReadBtn', id: 'mark-all-read', critical: false },
            { key: 'startPracticeBtn', id: 'start-practice-btn', critical: false },
            { key: 'openMonthlyModalBtn', id: 'open-monthly-modal-btn', critical: false },
            { key: 'openStreakModalBtn', id: 'open-streak-modal-btn', critical: false },
            { key: 'progressCard', id: 'progress-card', critical: false },
            { key: 'overallProgressValue', id: 'overall-progress-value', critical: false },
            { key: 'overallProgressFooter', id: 'overall-progress-footer', critical: false },
            { key: 'pointsCard', id: 'points-card', critical: false },
            { key: 'totalPointsValue', id: 'total-points-value', critical: false },
            { key: 'totalPointsFooter', id: 'total-points-footer', critical: false },
            { key: 'streakCard', id: 'streak-card', critical: false },
            { key: 'streakValue', id: 'streak-value', critical: false },
            { key: 'streakFooter', id: 'streak-footer', critical: false },
            { key: 'monthlyRewardModal', id: 'monthly-reward-modal', critical: false },
            { key: 'modalMonthlyCalendarGrid', id: 'modal-monthly-calendar-grid', critical: false },
            { key: 'modalMonthlyCalendarEmpty', id: 'modal-monthly-calendar-empty', critical: false },
            { key: 'modalCurrentMonthYearSpan', id: 'modal-current-month-year', critical: false },
            { key: 'closeMonthlyModalBtn', id: 'close-monthly-modal-btn', critical: false },
            { key: 'streakMilestonesModal', id: 'streak-milestones-modal', critical: false },
            { key: 'modalMilestonesGrid', id: 'modal-milestones-grid', critical: false },
            { key: 'modalMilestonesEmpty', id: 'modal-milestones-empty', critical: false },
            { key: 'modalCurrentStreakValue', id: 'modal-current-streak-value', critical: false },
            { key: 'closeStreakModalBtn', id: 'close-streak-modal-btn', critical: false },
            { key: 'toastContainer', id: 'toast-container', critical: false },
            { key: 'offlineBanner', id: 'offline-banner', critical: false },
            { key: 'mouseFollower', id: 'mouse-follower', critical: false },
            { key: 'currentYearFooter', id: 'currentYearFooter', critical: false },
        ];

        const notFoundCritical = [];
        ui = {};

        elementDefinitions.forEach(def => {
            const element = def.id ? document.getElementById(def.id) : document.querySelector(def.query);
            if (element) {
                ui[def.key] = element;
            } else {
                ui[def.key] = null;
                if (def.critical) {
                    notFoundCritical.push(`${def.key} (ID/Query: ${def.id || def.query})`);
                } else {
                    console.warn(`[CACHE DOM] Non-critical element not found: ${def.key}`);
                }
            }
        });

        if (ui.statsCardsContainer) {
            ui.progressCard = ui.statsCardsContainer.querySelector('#progress-card') || ui.progressCard;
            ui.pointsCard = ui.statsCardsContainer.querySelector('#points-card') || ui.pointsCard;
            ui.streakCard = ui.statsCardsContainer.querySelector('#streak-card') || ui.streakCard;
        } else {
            console.warn("[CACHE DOM] Main stats card container (.stat-cards) not found.");
        }

        if (notFoundCritical.length > 0) {
            console.error(`[CACHE DOM] CRITICAL elements not found: (${notFoundCritical.length})`, notFoundCritical);
            throw new Error(`Chyba načítání stránky: Kritické komponenty chybí (${notFoundCritical.join(', ')}).`);
        } else {
            console.log("[CACHE DOM] All critical elements found.");
        }
        const endTime = performance.now();
        console.log(`[CACHE DOM] Caching complete. UI object:`, ui, `Time: ${(endTime - startTime).toFixed(2)}ms`);
    }
    // --- END: DOM Element Caching ---

    // --- START: Helper Functions ---
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) { console.warn("Toast container not found."); return; } try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Error displaying toast:", e); } }

    function showError(message, isGlobal = false, targetElement = ui.globalError) {
        console.error("Error:", message);
        const errorDisplayElement = isGlobal ? ui.globalError : targetElement;

        if (errorDisplayElement) {
            if (targetElement === ui.mainContentAreaPlaceholder && !isGlobal) {
                 errorDisplayElement.innerHTML = `<div class="error-message card" style="margin: 2rem; padding: 2rem; text-align: center;"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="content-retry-btn" style="margin-top:1rem;">Zkusit znovu</button></div>`;
                 errorDisplayElement.style.display = 'flex';
                 const retryBtn = errorDisplayElement.querySelector('#content-retry-btn');
                 if (retryBtn) {
                     retryBtn.addEventListener('click', () => {
                         hideError(errorDisplayElement);
                         initializeApp();
                     });
                 }
            } else {
                errorDisplayElement.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Obnovit Stránku</button></div>`;
                errorDisplayElement.style.display = 'block';
                const retryBtn = errorDisplayElement.querySelector('#global-retry-btn');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => { location.reload(); });
                }
            }
        } else {
            showToast('CHYBA', message, 'error', 10000);
        }
    }

    function hideError(targetElement = ui.globalError) {
        if (targetElement) {
            targetElement.style.display = 'none';
            targetElement.innerHTML = '';
        }
    }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || 'P'; }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Error formatting time:", e, "Timestamp:", timestamp); return '-'; } }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }

    function setLoadingState(sectionKey, isLoadingFlag) {
        if (!ui || Object.keys(ui).length === 0) { console.error("[SetLoadingState] UI cache not ready."); return; }
        if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;

        if (sectionKey === 'all') {
            Object.keys(isLoading).forEach(key => {
                if (key !== 'all') setLoadingState(key, isLoadingFlag);
            });
            isLoading.all = isLoadingFlag;
            console.log(`[SetLoadingState v26.0.7] Section: all, isLoading: ${isLoadingFlag}`);
            return;
        }

        isLoading[sectionKey] = isLoadingFlag;
        console.log(`[SetLoadingState v26.0.7] Section: ${sectionKey}, isLoading: ${isLoadingFlag}`);

        if (sectionKey === 'session') {
            if (ui.mainContentAreaPlaceholder) {
                ui.mainContentAreaPlaceholder.classList.toggle('loading', isLoadingFlag);
                 if(isLoadingFlag) {
                     ui.mainContentAreaPlaceholder.innerHTML = '<div class="loading-spinner" style="margin: auto;"></div><p>Ověřování sezení...</p>';
                     ui.mainContentAreaPlaceholder.style.display = 'flex';
                 } else {
                     // Skrytí placeholderu bude řešeno po úspěšném načtení dat nebo zobrazení chyby
                 }
            }
            return;
        }


        if (sectionKey === 'stats') {
            (ui.statsCardsContainer || ui.progressCard?.parentElement)?.querySelectorAll('.stat-card').forEach(card => card.classList.toggle('loading', isLoadingFlag));
        } else if (sectionKey === 'notifications') {
            if (ui.notificationBell) ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
            if (ui.markAllReadBtn) {
                const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
            }
            if (isLoadingFlag && ui.notificationsList && typeof renderNotificationSkeletons === 'function') {
                renderNotificationSkeletons(2);
                if(ui.noNotificationsMsg) ui.noNotificationsMsg.style.display = 'none';
            } else if (!isLoadingFlag && ui.notificationsList && ui.noNotificationsMsg && ui.notificationsList.children.length === 0) {
                 if(ui.noNotificationsMsg) ui.noNotificationsMsg.style.display = 'block';
            }
        } else if (sectionKey === 'activities') {
            if (ui.activityListContainerWrapper) {
                ui.activityListContainerWrapper.classList.toggle('loading-section', isLoadingFlag);
            } else { console.warn("[SetLoadingState] ui.activityListContainerWrapper not found for 'activities'."); }
        } else if (sectionKey === 'creditHistory') {
            if (ui.creditHistoryContainerWrapper) {
                ui.creditHistoryContainerWrapper.classList.toggle('loading-section', isLoadingFlag);
            } else { console.warn(`[SetLoadingState] Target container for section "creditHistory" (ui.creditHistoryContainerWrapper) not found.`); }
        } else if (sectionKey === 'monthlyRewards' || sectionKey === 'streakMilestones') {
            const modal = sectionKey === 'monthlyRewards' ? ui.monthlyRewardModal : ui.streakMilestonesModal;
            const modalBody = modal?.querySelector('.modal-body');
            const loaderOverlay = modalBody?.querySelector('.loading-overlay');
            if (loaderOverlay) loaderOverlay.classList.toggle('hidden', !isLoadingFlag);
            if (modalBody) modalBody.classList.toggle('loading', isLoadingFlag);
            if (isLoadingFlag) {
                if (sectionKey === 'monthlyRewards' && typeof renderMonthlyCalendarSkeletons === 'function') renderMonthlyCalendarSkeletons();
                if (sectionKey === 'streakMilestones' && typeof renderMilestoneSkeletons === 'function') renderMilestoneSkeletons();
            }
        } else if (sectionKey === 'titles') {
            console.log(`[SetLoadingState] Loading state for 'titles' is now ${isLoadingFlag}.`);
        } else {
            console.warn(`[SetLoadingState] Unknown section key or unhandled UI in dashboard.js: ${sectionKey}`);
        }
    }
    // --- END: Helper Functions ---

    // --- START: Sidebar Toggle Logic ---
    function applyInitialSidebarState() { const startTime = performance.now(); if (!ui.sidebarToggleBtn) { console.warn("[Sidebar State] Sidebar toggle button (#sidebar-toggle-btn) not found for initial state application."); return; } try { const savedState = localStorage.getItem(SIDEBAR_STATE_KEY); const shouldBeCollapsed = savedState === 'collapsed'; console.log(`[Sidebar State] Initial read state from localStorage: '${savedState}', Applying collapsed: ${shouldBeCollapsed}`); document.body.classList.toggle('sidebar-collapsed', shouldBeCollapsed); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) { icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.setAttribute('title', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); const endTime = performance.now(); console.log(`[Sidebar State] Initial icon and attributes set. Icon class: ${icon.className}. Time: ${(endTime - startTime).toFixed(2)}ms`); } else { console.warn("[Sidebar State] Sidebar toggle button icon not found for initial state update."); } } catch (error) { console.error("[Sidebar State] Error applying initial state:", error); document.body.classList.remove('sidebar-collapsed'); } }
    function toggleSidebar() { try { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) { icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.setAttribute('title', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); } console.log(`[Sidebar Toggle] Sidebar toggled. New state: ${isCollapsed ? 'collapsed' : 'expanded'}`); } catch(e){console.error("[Sidebar Toggle] Error:",e);}}
    // --- END: Sidebar Toggle Logic ---

    // --- START: Supabase Client Initialization ---
    function initializeSupabase() { const startTime = performance.now(); console.log("[Supabase] Attempting initialization..."); try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded or createClient is not a function."); } supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); if (!supabase) { throw new Error("Supabase client creation failed (returned null/undefined)."); } window.supabaseClient = supabase; const endTime = performance.now(); console.log(`[Supabase] Klient úspěšně inicializován a globálně dostupný. Time: ${(endTime - startTime).toFixed(2)}ms`); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi. Zkuste obnovit stránku.", true); return false; } }
    // --- END: Supabase Client Initialization ---

    // --- START: Data Loading and Processing ---
    function withTimeout(promise, ms, timeoutError = new Error('Operace vypršela')) { const timeoutPromise = new Promise((_, reject) => { setTimeout(() => reject(timeoutError), ms); }); return Promise.race([promise, timeoutPromise]); }
    async function fetchUserProfile(userId) { const startTime = performance.now(); console.log(`[Profile] Fetching profile for user ID: ${userId}`); if (!supabase || !userId) return null; try { const { data: profile, error } = await withTimeout(supabase.from('profiles').select('*, selected_title, last_login, streak_days, longest_streak_days, monthly_claims, last_milestone_claimed, purchased_titles').eq('id', userId).single(), DATA_FETCH_TIMEOUT, new Error('Načítání profilu vypršelo.')); if (error && error.code !== 'PGRST116') { throw error; } if (!profile) { console.warn(`[Profile] Profile for ${userId} not found. Returning null.`); return null; } profile.monthly_claims = profile.monthly_claims || {}; profile.last_milestone_claimed = profile.last_milestone_claimed || 0; profile.purchased_titles = profile.purchased_titles || []; const endTime = performance.now(); console.log(`[Profile] Profile data fetched successfully. Time: ${(endTime - startTime).toFixed(2)}ms`, profile); return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); return null; } }
    async function createDefaultProfile(userId, userEmail) { const startTime = performance.now(); if (!supabase || !userId || !userEmail) return null; console.log(`[Profile Create] Creating default profile for user ${userId}`); try { const defaultData = { id: userId, email: userEmail, username: userEmail.split('@')[0] || `user_${userId.substring(0, 6)}`, level: 1, points: 0, experience: 0, badges_count: 0, streak_days: 0, longest_streak_days: 0, last_login: new Date().toISOString(), monthly_claims: {}, last_milestone_claimed: 0, purchased_titles: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), preferences: { dark_mode: window.matchMedia('(prefers-color-scheme: dark)').matches, language: 'cs' }, notifications: { email: true, study_tips: true, content_updates: true, practice_reminders: true } }; const { data: newProfile, error } = await withTimeout(supabase.from('profiles').insert(defaultData).select('*, selected_title, last_login, streak_days, longest_streak_days, monthly_claims, last_milestone_claimed, purchased_titles').single(), DATA_FETCH_TIMEOUT, new Error('Vytváření profilu vypršelo.')); if (error) { if (error.code === '23505') { console.warn("[Profile Create] Profile likely already exists, fetching again."); return await fetchUserProfile(userId); } throw error; } const endTime = performance.now(); console.log(`[Profile Create] Default profile created. Time: ${(endTime - startTime).toFixed(2)}ms`, newProfile); return newProfile; } catch (error) { console.error("[Profile Create] Failed to create default profile:", error); return null; } }
    async function fetchTitles() { const startTime = performance.now(); if (!supabase) return []; console.log("[Titles] Fetching available titles..."); setLoadingState('titles', true); try { const { data, error } = await withTimeout(supabase.from('title_shop').select('title_key, name'), DATA_FETCH_TIMEOUT, new Error('Načítání titulů vypršelo.')); if (error) throw error; const endTime = performance.now(); console.log(`[Titles] Fetched titles. Time: ${(endTime - startTime).toFixed(2)}ms`, data); return data || []; } catch (error) { console.error("[Titles] Error fetching titles:", error); return []; } finally { setLoadingState('titles', false); } }
    async function fetchUserStats(userId, profileData) { const startTime = performance.now(); if (!supabase || !userId || !profileData) { console.error("[Stats] Chybí Supabase klient, ID uživatele nebo data profilu."); return null; } console.log(`[Stats] Načítání statistik pro uživatele ${userId}...`); let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats] Chyba Supabase při načítání user_stats:", statsError.message); } } catch (error) { console.error("[Stats] Neočekávaná chyba při načítání user_stats:", error); statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, longest_streak_days: profileData.longest_streak_days ?? Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0 }; const endTime = performance.now(); if (statsError) { console.warn(`[Stats] Vracení statistik primárně z profilu kvůli chybě načítání. Time: ${(endTime - startTime).toFixed(2)}ms`); } else { console.log(`[Stats] Statistiky úspěšně načteny/sestaveny. Time: ${(endTime - startTime).toFixed(2)}ms`, finalStats); } return finalStats; }
    async function checkAndUpdateLoginStreak() { const startTime = performance.now(); if (!currentUser || !currentProfile || !supabase) { console.warn("[StreakCheck] Cannot perform check: missing user, profile, or supabase."); return false; } console.log("[StreakCheck] Performing daily login check/update..."); const today = new Date(); const lastLogin = currentProfile.last_login ? new Date(currentProfile.last_login) : null; let currentStreak = currentProfile.streak_days || 0; let longestStreak = currentProfile.longest_streak_days || 0; let needsDbUpdate = false; let updateData = {}; const currentMonthYear = getCurrentMonthYearString(); if (!lastLogin || !isSameDate(today, lastLogin)) { needsDbUpdate = true; console.log("[StreakCheck] First login of the day detected."); if (lastLogin && isYesterday(lastLogin, today)) { currentStreak++; console.log(`[StreakCheck] Streak continued! New current streak: ${currentStreak}`); } else if (lastLogin) { currentStreak = 1; console.log("[StreakCheck] Streak broken. Resetting to 1."); } else { currentStreak = 1; console.log("[StreakCheck] First login ever. Setting streak to 1."); } updateData.streak_days = currentStreak; updateData.last_login = today.toISOString(); if (currentStreak > longestStreak) { longestStreak = currentStreak; updateData.longest_streak_days = longestStreak; console.log(`[StreakCheck] New longest streak: ${longestStreak}!`); } } else { console.log("[StreakCheck] Already logged in today. No streak update needed for current streak."); if (currentProfile.streak_days > (currentProfile.longest_streak_days || 0) ) { console.warn(`[StreakCheck] Discrepancy found: streak_days (${currentProfile.streak_days}) > longest_streak_days (${currentProfile.longest_streak_days || 0}). Updating longest_streak.`); updateData.longest_streak_days = currentProfile.streak_days; longestStreak = currentProfile.streak_days; needsDbUpdate = true; } } currentProfile.streak_days = currentStreak; currentProfile.longest_streak_days = longestStreak; if (ui.modalCurrentStreakValue) ui.modalCurrentStreakValue.textContent = currentStreak; currentProfile.monthly_claims = currentProfile.monthly_claims || {}; if (!currentProfile.monthly_claims[currentMonthYear]) { console.log(`[StreakCheck] Initializing claims for new month: ${currentMonthYear}`); const updatedClaims = { ...currentProfile.monthly_claims, [currentMonthYear]: [] }; currentProfile.monthly_claims = updatedClaims; updateData.monthly_claims = updatedClaims; needsDbUpdate = true; } else { console.log(`[StreakCheck] Monthly claims for ${currentMonthYear} already exist.`); } if (needsDbUpdate) { console.log("[StreakCheck] Updating profile in DB with:", updateData); try { const { error: updateError } = await supabase.from('profiles').update(updateData).eq('id', currentUser.id); if (updateError) throw updateError; if (updateData.last_login) currentProfile.last_login = updateData.last_login; if (updateData.monthly_claims) currentProfile.monthly_claims = updateData.monthly_claims; const endTime = performance.now(); console.log(`[StreakCheck] Profile updated successfully in DB. Time: ${(endTime - startTime).toFixed(2)}ms`); return true; } catch (error) { console.error("[StreakCheck] Error updating profile:", error); showToast('Chyba', 'Nepodařilo se aktualizovat data přihlášení.', 'error'); return false; } } const endTimeUnchanged = performance.now(); console.log(`[StreakCheck] No DB update needed. Time: ${(endTimeUnchanged - startTime).toFixed(2)}ms`); return false; }
    async function updateMonthlyClaimsInDB(newClaimsData) { if (!currentUser || !supabase) return false; console.log("[DB Update] Updating monthly claims in DB:", newClaimsData); try { const { error } = await supabase.from('profiles').update({ monthly_claims: newClaimsData, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (error) throw error; console.log("[DB Update] Monthly claims update successful."); return true; } catch (error) { console.error("[DB Update] Error updating monthly claims:", error); showToast('Chyba', 'Nepodařilo se uložit vyzvednutí měsíční odměny.', 'error'); return false; } }
    async function updateLastMilestoneClaimedInDB(milestoneDay, rewardKey, rewardName) { if (!currentUser || !supabase) return false; console.log(`[DB Update] Attempting to record claim for milestoneDay: ${milestoneDay}, rewardKey: ${rewardKey}`); try { const { error: insertError } = await supabase.from('claimed_streak_milestones').insert({ user_id: currentUser.id, milestone_day: milestoneDay, reward_key: rewardKey, reward_name: rewardName }); if (insertError && insertError.code !== '23505') { console.error(`[DB Update] Error inserting into claimed_streak_milestones for milestone ${milestoneDay}:`, insertError); throw insertError; } else if (insertError && insertError.code === '23505') { console.warn(`[DB Update] Milestone ${milestoneDay} (key: ${rewardKey}) already claimed by user ${currentUser.id}. No new record inserted.`); return true; } console.log(`[DB Update] Milestone ${milestoneDay} (key: ${rewardKey}) successfully recorded in claimed_streak_milestones.`); if (currentProfile && milestoneDay > (currentProfile.last_milestone_claimed || 0)) { const { error: profileUpdateError } = await supabase.from('profiles').update({ last_milestone_claimed: milestoneDay, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (profileUpdateError) { console.error(`[DB Update] Error updating profiles.last_milestone_claimed for ${milestoneDay}:`, profileUpdateError); } else { currentProfile.last_milestone_claimed = milestoneDay; console.log(`[DB Update] profiles.last_milestone_claimed updated to ${milestoneDay}.`); } } return true; } catch (error) { console.error(`[DB Update] General error in updateLastMilestoneClaimedInDB for ${milestoneDay}:`, error); showToast('Chyba', 'Nepodařilo se uložit vyzvednutí milníkové odměny.', 'error'); return false; } }
    async function awardPoints(pointsValue, reason = "Nespecifikováno", transactionType = 'points_earned', referenceActivityId = null, suppressActivityLog = false) { if (!currentUser || !currentProfile || !supabase) { console.warn("Cannot award points: User, profile, or Supabase missing."); return; } if (pointsValue === 0) { console.log("No points to award (value is 0)."); return; } console.log(`[Points] Awarding/deducting ${pointsValue} points for: ${reason}. Type: ${transactionType}, SuppressLog: ${suppressActivityLog}`); setLoadingState('stats', true); const currentPoints = currentProfile.points || 0; const newPoints = currentPoints + pointsValue; try { const { error: profileError } = await supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (profileError) throw profileError; currentProfile.points = newPoints; const { error: transactionError } = await supabase.from('credit_transactions').insert({ user_id: currentUser.id, transaction_type: transactionType, amount: pointsValue, description: reason, balance_after_transaction: newPoints, reference_activity_id: referenceActivityId }); if (transactionError) { console.error("[Points] Error logging credit transaction:", transactionError); showToast('Varování', 'Kredity připsány, ale záznam transakce selhal.', 'warning'); } else { console.log(`[Points] Credit transaction logged: ${pointsValue} for ${reason}`); } if (pointsValue > 0) { showToast('Kredity Získány!', `+${pointsValue} kreditů za: ${reason}`, 'success', 2500); } else if (pointsValue < 0) { showToast('Kredity Utraceny!', `${pointsValue} kreditů za: ${reason}`, 'info', 2500); } userStatsData = await fetchUserStats(currentUser.id, currentProfile); updateStatsCards(userStatsData); if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderCreditHistory === 'function') { await DashboardLists.loadAndRenderCreditHistory(currentUser.id, 5); } if (pointsValue > 0 && !suppressActivityLog) { await logActivity( currentUser.id, 'points_earned', `Získáno ${pointsValue} kreditů`, `Důvod: ${reason}`, { points_change: pointsValue, new_total_points: newPoints, source: transactionType }, null, referenceActivityId, 'fa-coins' ); } } catch (error) { console.error(`[Points] Error awarding/deducting points:`, error); showToast('Chyba', 'Nepodařilo se upravit kredity.', 'error'); } finally { setLoadingState('stats', false); } }
    async function logActivity(userId, type, title, description = null, details = null, link_url = null, reference_id = null, icon = null) { if (!supabase || !userId) { console.error("Cannot log activity: Supabase client or user ID is missing."); return; } console.log(`[Log Activity] Logging: User ${userId}, Type: ${type}, Title: ${title}`); try { const { error } = await supabase.from('activities').insert({ user_id: userId, type: type, title: title, description: description, details: details, link_url: link_url, reference_id: reference_id, icon: icon || activityVisuals[type]?.icon || activityVisuals.default.icon }); if (error) { console.error("Error logging activity:", error); } else { console.log("Activity logged successfully."); if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderRecentActivities === 'function' && window.location.pathname.includes('dashboard.html')) { await DashboardLists.loadAndRenderRecentActivities(userId, 5); } } } catch (err) { console.error("Exception during activity logging:", err); } }
    // --- END: Data Loading and Processing ---

    // --- START: Notification Logic ---
    async function fetchNotifications(userId, limit = 5) { const startTime = performance.now(); if (!supabase || !userId) { console.error("[Notifications] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await withTimeout(supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit), DATA_FETCH_TIMEOUT, new Error('Načítání notifikací vypršelo.')); if (error) throw error; const endTime = performance.now(); console.log(`[Notifications] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}. Time: ${(endTime - startTime).toFixed(2)}ms`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; } }
    function renderNotifications(count, notifications) { const startTime = performance.now(); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.warn("[Render Notifications] Chybí UI elementy pro notifikace."); return; } console.log("[Render Notifications] Start, Počet:", count, "Oznámení:", notifications); ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class || 'default'}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; } ui.markAllReadBtn.disabled = count === 0; const endTime = performance.now(); console.log(`[Render Notifications] Hotovo. Time: ${(endTime - startTime).toFixed(2)}ms`); }
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) { console.warn("[Render Notifications Skeletons] Chybí UI elementy."); return; } let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    async function markNotificationRead(notificationId) { console.log("[FUNC] markNotificationRead: Označení ID:", notificationId); if (!currentUser || !notificationId || !supabase) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[FUNC] markNotificationRead: Úspěch pro ID:", notificationId); return true; } catch (error) { console.error("[FUNC] markNotificationRead: Chyba:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { console.log("[FUNC] markAllNotificationsRead: Start pro uživatele:", currentUser?.id); if (!currentUser || !ui.markAllReadBtn || !supabase) { console.warn("Cannot mark all read: Missing user, button, or supabase."); return; } if (isLoading.notifications) return; setLoadingState('notifications', true); try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false); if (error) throw error; console.log("[FUNC] markAllNotificationsRead: Úspěch"); const { unreadCount, notifications } = await fetchNotifications(currentUser.id, 5); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[FUNC] markAllNotificationsRead: Chyba:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }
    // --- END: Notification Logic ---


    // --- START: UI Update Functions (General) ---
    function updateSidebarProfile(profile) { if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { cacheDOMElements(); if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[UI Update Sidebar] Sidebar elements not found in cache."); return; } } console.log("[UI Update] Aktualizace sidebaru..."); if (profile) { const firstName = profile.first_name ?? ''; const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(profile); const avatarUrl = profile.avatar_url; ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const sidebarImg = ui.sidebarAvatar.querySelector('img'); if (sidebarImg) { sidebarImg.onerror = () => { ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; } const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot'; if (selectedTitleKey && allTitles && allTitles.length > 0) { const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) displayTitle = foundTitle.name; else console.warn(`[UI Update Sidebar] Title key "${selectedTitleKey}" not found in titles list.`); } else if (selectedTitleKey) { console.warn(`[UI Update Sidebar] Selected title key present, but titles list is empty or not loaded.`); } ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`; console.log("[UI Update] Sidebar aktualizován."); } else { console.warn("[UI Update Sidebar] Missing profile data. Setting defaults."); ui.sidebarName.textContent = "Nepřihlášen"; ui.sidebarAvatar.textContent = '?'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title'); if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítejte!`; } }
    function updateStatsCards(stats) { console.log("[UI Update] Aktualizace karet statistik:", stats); const statElements = { progress: ui.overallProgressValue, points: ui.totalPointsValue, streak: ui.streakValue, progressFooter: ui.overallProgressFooter, pointsFooter: ui.totalPointsFooter, streakFooter: ui.streakFooter }; const cards = [ui.progressCard, ui.pointsCard, ui.streakCard]; const requiredElements = Object.values(statElements); if (requiredElements.some(el => !el)) { console.error("[UI Update Stats] Chybějící elementy statistik."); cards.forEach(card => card?.classList.remove('loading')); return; } cards.forEach(card => card?.classList.remove('loading')); if (!stats) { console.warn("[UI Update Stats] Chybí data statistik, zobrazuji placeholder."); Object.values(statElements).forEach(els => { if (els.value) els.value.textContent = '-'; if (els.desc) els.desc.textContent = 'Data nedostupná'; if (els.footer) els.footer.innerHTML = `<i class="fas fa-exclamation-circle"></i> Data nenalezena`; }); return; } statElements.progress.textContent = `${stats.progress ?? 0}%`; const weeklyProgress = stats.progress_weekly ?? 0; statElements.progressFooter.classList.remove('positive', 'negative'); statElements.progressFooter.innerHTML = weeklyProgress > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyProgress}% týdně` : weeklyProgress < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyProgress}% týdně` : `<i class="fas fa-minus"></i> --`; if (weeklyProgress > 0) statElements.progressFooter.classList.add('positive'); else if (weeklyProgress < 0) statElements.progressFooter.classList.add('negative'); statElements.points.textContent = stats.points ?? 0; const weeklyPoints = stats.points_weekly ?? 0; statElements.pointsFooter.classList.remove('positive', 'negative'); statElements.pointsFooter.innerHTML = weeklyPoints > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyPoints} týdně` : weeklyPoints < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyPoints} týdně` : `<i class="fas fa-minus"></i> --`; if (weeklyPoints > 0) statElements.pointsFooter.classList.add('positive'); else if (weeklyPoints < 0) statElements.pointsFooter.classList.add('negative'); statElements.streak.textContent = stats.streak_current ?? 0; statElements.streakFooter.innerHTML = `MAX: ${stats.longest_streak_days ?? 0} dní`; if ((stats.streak_current ?? 0) > 0 && (stats.streak_current !== stats.longest_streak_days)) { statElements.streakFooter.innerHTML += ` <span style="color:var(--text-muted); font-size:0.9em;">(Aktuální: ${stats.streak_current ?? 0})</span>`; } console.log("[UI Update] Karty statistik aktualizovány."); }
    function renderMonthlyCalendar() { if (!ui.modalMonthlyCalendarGrid || !ui.modalCurrentMonthYearSpan || !ui.modalMonthlyCalendarEmpty) { console.error("Monthly calendar MODAL UI elements missing. Cannot render."); setLoadingState('monthlyRewards', false); return; } console.log("[RenderMonthly] Rendering calendar..."); setLoadingState('monthlyRewards', true); const gridContainer = ui.modalMonthlyCalendarGrid; const modalTitleSpan = ui.modalCurrentMonthYearSpan; const emptyState = ui.modalMonthlyCalendarEmpty; const now = new Date(); const year = now.getFullYear(); const month = now.getMonth(); const today = now.getDate(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const monthString = getCurrentMonthYearString(); const monthName = now.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' }); const claimedDaysThisMonth = currentProfile?.monthly_claims?.[monthString] || []; console.log(`[RenderMonthly] Claimed days for ${monthString}:`, claimedDaysThisMonth); modalTitleSpan.textContent = monthName; gridContainer.innerHTML = ''; emptyState.style.display = 'none'; gridContainer.style.display = 'grid'; const fragment = document.createDocumentFragment(); let daysRendered = 0; for (let day = 1; day <= daysInMonth; day++) { const dayElement = document.createElement('div'); dayElement.classList.add('calendar-day'); dayElement.dataset.day = day; const isClaimed = claimedDaysThisMonth.includes(day); const isClaimable = (day <= today && !isClaimed); const isUpcoming = day > today; let rewardIconHtml = '<i class="fas fa-gift"></i>'; let rewardText = `Den ${day}`; let specificReward = null; let rewardType = 'default'; let rewardKey = `day_${day}`; let rewardValue = 1; let rewardIcon = 'fa-gift'; if (month === 4) { specificReward = mayRewards[day]; } if (specificReward) { rewardIcon = specificReward.icon || 'fa-gift'; rewardText = specificReward.name; rewardType = specificReward.type; rewardKey = specificReward.key || `may_reward_${day}`; rewardValue = specificReward.value !== undefined ? specificReward.value : 1; } else { if (day % 7 === 0) { rewardIcon = 'fa-coins'; rewardText = '10 Kreditů'; rewardType = 'credits'; rewardValue = 10; } else if (day % 5 === 0) { rewardIcon = 'fa-star'; rewardText = '5 EXP'; rewardType = 'xp'; rewardValue = 5; } } dayElement.dataset.rewardType = rewardType; dayElement.dataset.rewardKey = rewardKey; dayElement.dataset.rewardValue = rewardValue; dayElement.innerHTML = `<span class="day-number">${day}</span><div class="reward-icon"><i class="fas ${rewardIcon}"></i></div><span class="reward-text">${rewardText}</span><span class="reward-status"></span><button class="claim-button btn btn-sm" style="display: none;"><i class="fas fa-check"></i> Vyzvednout</button>`; const statusSpan = dayElement.querySelector('.reward-status'); const claimButton = dayElement.querySelector('.claim-button'); if (isClaimed) { dayElement.classList.add('claimed'); if (statusSpan) statusSpan.textContent = 'Získáno'; } else if (isClaimable) { dayElement.classList.add('available'); if (statusSpan) statusSpan.textContent = 'Dostupné'; if (claimButton) { claimButton.style.display = 'block'; claimButton.addEventListener('click', (e) => { e.stopPropagation(); claimMonthlyReward(day, claimButton, rewardType, rewardValue, rewardText); }); } } else if (isUpcoming) { dayElement.classList.add('upcoming'); if (statusSpan) statusSpan.textContent = 'Připravuje se'; } else { dayElement.classList.add('missed'); if (statusSpan) statusSpan.textContent = 'Zmeškáno'; } if (day === today) { dayElement.classList.add('today'); } fragment.appendChild(dayElement); daysRendered++; } if (daysRendered > 0) { gridContainer.appendChild(fragment); } else { emptyState.style.display = 'block'; gridContainer.style.display = 'none'; } ui.monthlyRewardModal?.querySelector('.modal-body')?.classList.remove('loading'); console.log("[RenderMonthly] Modal calendar rendered with dynamic rewards."); setLoadingState('monthlyRewards', false); initTooltips(); }
    function renderMonthlyCalendarSkeletons() { const gridContainer = ui.modalMonthlyCalendarGrid; if (!gridContainer) return; gridContainer.innerHTML = ''; gridContainer.style.display = 'grid'; const skeletonCount = 21; let skeletonHTML = ''; for(let i=0; i < skeletonCount; i++) { skeletonHTML += '<div class="calendar-day skeleton"></div>'; } gridContainer.innerHTML = skeletonHTML; }
    function renderStreakMilestones() { if (!ui.modalMilestonesGrid || !ui.modalMilestonesEmpty || !ui.modalCurrentStreakValue) { console.error("Streak milestones MODAL UI elements missing."); setLoadingState('streakMilestones', false); return; } console.log("[RenderMilestones] Rendering streak milestones..."); setLoadingState('streakMilestones', true); const gridContainer = ui.modalMilestonesGrid; const emptyState = ui.modalMilestonesEmpty; const streakSpan = ui.modalCurrentStreakValue; const currentStreak = currentProfile?.streak_days || 0; streakSpan.textContent = currentStreak; gridContainer.innerHTML = ''; emptyState.style.display = 'none'; gridContainer.style.display = 'grid'; supabase.from('claimed_streak_milestones').select('milestone_day, reward_key').eq('user_id', currentUser.id) .then(({ data: claimedData, error: fetchClaimedError }) => { if (fetchClaimedError) { console.error("Error fetching claimed streak milestones:", fetchClaimedError); showToast('Chyba', 'Nepodařilo se načíst vyzvednuté milníky série.', 'error'); setLoadingState('streakMilestones', false); return; } const claimedMilestoneEntries = new Set((claimedData || []).map(c => `${c.milestone_day}_${c.reward_key}`)); console.log("[RenderMilestones] Claimed milestones loaded:", claimedMilestoneEntries); const fragment = document.createDocumentFragment(); let milestonesToShow = 0; sortedMilestoneDays.forEach(milestoneDay => { const config = STREAK_MILESTONES_CONFIG[milestoneDay]; if (!config) return; const milestoneElement = document.createElement('div'); milestoneElement.classList.add('milestone-card'); milestoneElement.dataset.milestone = milestoneDay; const uniqueClaimKey = `${milestoneDay}_${config.reward_key}`; const isClaimed = claimedMilestoneEntries.has(uniqueClaimKey); const isClaimable = currentStreak >= milestoneDay && !isClaimed; const isLocked = currentStreak < milestoneDay; let statusHTML = ''; let buttonHTML = ''; if (isClaimed) { milestoneElement.classList.add('claimed'); statusHTML = `<span class="reward-status claimed">Získáno</span>`; } else if (isClaimable) { milestoneElement.classList.add('available'); statusHTML = `<span class="reward-status available">Dostupné</span>`; buttonHTML = `<button class="claim-button btn btn-sm btn-success"><i class="fas fa-check"></i> Vyzvednout</button>`; } else { milestoneElement.classList.add('locked'); const daysNeeded = milestoneDay - currentStreak; statusHTML = `<span class="reward-status locked">Ještě ${daysNeeded} ${daysNeeded === 1 ? 'den' : (daysNeeded < 5 ? 'dny' : 'dní')}</span>`; } milestoneElement.innerHTML = `<span class="day-number">Série ${milestoneDay}</span><div class="reward-icon"><i class="fas ${config.icon || 'fa-award'}"></i></div><span class="reward-text" title="${sanitizeHTML(config.description)}">${sanitizeHTML(config.name)}</span><div class="milestone-desc">${sanitizeHTML(config.description || '')}</div>${statusHTML}${buttonHTML}`; const claimButton = milestoneElement.querySelector('.claim-button'); if (claimButton) { claimButton.addEventListener('click', (e) => { e.stopPropagation(); claimMilestoneReward(milestoneDay, claimButton, config.reward_type, config.reward_value, config.name, config.reward_key); }); } fragment.appendChild(milestoneElement); milestonesToShow++; }); if (milestonesToShow > 0) { gridContainer.appendChild(fragment); } else { emptyState.innerHTML = '<i class="fas fa-road"></i><p>Pro tuto sérii nejsou definovány žádné milníky.</p>'; emptyState.style.display = 'block'; gridContainer.style.display = 'none'; } setLoadingState('streakMilestones', false); initTooltips(); }) .catch(error => { console.error("Error in renderStreakMilestones fetching claimed data:", error); showToast('Chyba', 'Nepodařilo se načíst data o milnících.', 'error'); emptyState.innerHTML = '<i class="fas fa-exclamation-triangle"></i><p>Chyba načítání milníků.</p>'; emptyState.style.display = 'block'; gridContainer.style.display = 'none'; setLoadingState('streakMilestones', false); }); console.log("[RenderMilestones] Milestones rendering initiated in modal."); }
    function renderMilestoneSkeletons() { const gridContainer = ui.modalMilestonesGrid; if (!gridContainer) return; gridContainer.innerHTML = ''; gridContainer.style.display = 'grid'; const skeletonCount = 6; let skeletonHTML = ''; for(let i=0; i < skeletonCount; i++) { skeletonHTML += '<div class="milestone-card skeleton"></div>'; } gridContainer.innerHTML = skeletonHTML; }
    // --- END: UI Update Functions ---

    // --- START: Claim Reward Logic ---
    async function claimMonthlyReward(day, buttonElement, rewardType = 'default', rewardValue = 1, rewardName = `Odměna dne ${day}`) { console.log(`[ClaimMonthly] Claiming reward for day ${day}: ${rewardName}, Type: ${rewardType}, Value: ${rewardValue}`); if (!currentUser || !currentProfile || !supabase || isLoading.monthlyRewards) return; const currentMonthYear = getCurrentMonthYearString(); const claimedDaysThisMonth = currentProfile.monthly_claims?.[currentMonthYear] || []; if (claimedDaysThisMonth.includes(day)) { showToast('Již Vyzvednuto', 'Tuto odměnu jste již vyzvedli.', 'info'); return; } setLoadingState('monthlyRewards', true); if (buttonElement) { buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; } const newClaimsForMonth = [...claimedDaysThisMonth, day]; const newAllClaims = { ...currentProfile.monthly_claims, [currentMonthYear]: newClaimsForMonth }; const dbSuccess = await updateMonthlyClaimsInDB(newAllClaims); if (dbSuccess) { currentProfile.monthly_claims = newAllClaims; let activityTitle = `Měsíční odměna: ${rewardName}`; let activityDescription = `Uživatel si vyzvedl měsíční odměnu za ${day}. den.`; let mainLogMessage = `Vyzvednuta měsíční odměna: ${rewardName}.`; if (rewardType === 'credits' && rewardValue > 0) { await awardPoints(rewardValue, `Měsíční odměna - Den ${day}`, 'reward_monthly_calendar', null, true); activityDescription += ` Získáno ${rewardValue} kreditů.`; mainLogMessage += ` (+${rewardValue} kreditů)`; } else if (rewardType === 'xp' && rewardValue > 0) { const currentXP = currentProfile.experience || 0; const newXP = currentXP + rewardValue; const { error: xpError } = await supabase.from('profiles').update({ experience: newXP }).eq('id', currentUser.id); if (xpError) { console.error("Error updating XP:", xpError); showToast('Chyba', 'Nepodařilo se připsat zkušenosti.', 'error'); } else { currentProfile.experience = newXP; showToast('Zkušenosti Získány!', `+${rewardValue} ZKU za: ${rewardName}`, 'success'); activityDescription += ` Získáno ${rewardValue} ZKU.`; mainLogMessage += ` (+${rewardValue} ZKU)`;} } else if (rewardType === 'title') { const currentTitles = Array.isArray(currentProfile.purchased_titles) ? currentProfile.purchased_titles : []; const titleKeyToAward = buttonElement.closest('.calendar-day').dataset.rewardKey || rewardName.replace(/\s/g, '_').toLowerCase(); if (!currentTitles.includes(titleKeyToAward)) { const newTitles = [...currentTitles, titleKeyToAward]; const { error: titleError } = await supabase.from('profiles').update({ purchased_titles: newTitles }).eq('id', currentUser.id); if (titleError) { console.error("Error awarding title:", titleError); showToast('Chyba', 'Nepodařilo se udělit titul.', 'error'); } else { currentProfile.purchased_titles = newTitles; showToast('Titul Získán!', `Získali jste titul: ${rewardName}`, 'success'); activityDescription += ` Získán titul: ${rewardName}.`; mainLogMessage += ` (Titul: ${rewardName})`;} } else { showToast('Titul Již Vlastníte', `Titul ${rewardName} již máte.`, 'info'); } } else { showToast('Odměna Získána!', `Získali jste: ${rewardName}`, 'success'); } await logActivity(currentUser.id, 'monthly_reward_claimed', activityTitle, activityDescription, { day: day, reward_name: rewardName, reward_type: rewardType, reward_value: rewardValue }); } else { showToast('Chyba', 'Nepodařilo se uložit vyzvednutí měsíční odměny.', 'error'); } setLoadingState('monthlyRewards', false); renderMonthlyCalendar(); }
    async function claimMilestoneReward(milestoneDay, buttonElement, rewardType, rewardValue, rewardName, rewardKey) { console.log(`[ClaimMilestone] Attempting claim for milestone ${milestoneDay}. Reward: ${rewardType}, Value: ${rewardValue}, Name: ${rewardName}, Key: ${rewardKey}`); if (!currentUser || !currentProfile || !supabase || isLoading.streakMilestones) return; const { data: existingClaimCheck, error: clientCheckError } = await supabase.from('claimed_streak_milestones').select('id').eq('user_id', currentUser.id).eq('milestone_day', milestoneDay).maybeSingle(); if (clientCheckError) { console.error("Error checking claim (client-side):", clientCheckError); showToast('Chyba', 'Ověření milníku selhalo.', 'error'); return; } if (existingClaimCheck) { console.warn(`Milestone ${milestoneDay} already claimed (client check).`); showToast('Již Vyzvednuto', 'Tento milník byl již vyzvednut.', 'info'); renderStreakMilestones(); return; } setLoadingState('streakMilestones', true); if (buttonElement) { buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; } const currentStreak = currentProfile?.streak_days || 0; if (currentStreak < milestoneDay) { console.warn(`[ClaimMilestone] Milestone ${milestoneDay} not yet reached (current streak: ${currentStreak}).`); showToast('Chyba', 'Podmínky pro tento milník ještě nebyly splněny.', 'warning'); setLoadingState('streakMilestones', false); renderStreakMilestones(); return; } const dbSuccess = await updateLastMilestoneClaimedInDB(milestoneDay, rewardKey, rewardName); if (dbSuccess) { console.log(`[ClaimMilestone] DB update successful for milestone ${milestoneDay}.`); let activityTitle = `Odměna za milník: ${rewardName}`; let activityDescription = `Uživatel dosáhl ${milestoneDay} dní studijní série a vyzvedl si odměnu.`; switch (rewardType) { case 'points': await awardPoints(rewardValue, `Odměna za sérii ${milestoneDay} dní`, 'reward_streak_milestone', null, true); activityDescription += ` Získáno ${rewardValue} kreditů.`; break; case 'badge': const badgeKeyToAward = rewardValue; console.log(`[ClaimMilestone] Attempting to award badge with key: ${badgeKeyToAward}`); const { data: badgeData, error: badgeError } = await supabase.from('badges').select('id, title').eq('title_key', badgeKeyToAward).single(); if (badgeError || !badgeData) { console.error(`[ClaimMilestone] Error fetching badge data for key ${badgeKeyToAward}:`, badgeError); showToast('Chyba', `Odznak "${rewardName}" nenalezen.`, 'error'); } else { const { error: insertBadgeError } = await supabase.from('user_badges').insert({ user_id: currentUser.id, badge_id: badgeData.id }); if (insertBadgeError && insertBadgeError.code !== '23505') { console.error(`[ClaimMilestone] Error inserting user_badge for badge ID ${badgeData.id}:`, insertBadgeError); showToast('Chyba', `Nepodařilo se udělit odznak "${badgeData.title}".`, 'error'); } else if (insertBadgeError && insertBadgeError.code === '23505') { showToast('Info', `Odznak "${badgeData.title}" již vlastníte.`, 'info'); } else { const newBadgeCount = (currentProfile.badges_count || 0) + 1; const { error: profileUpdateError } = await supabase.from('profiles').update({ badges_count: newBadgeCount }).eq('id', currentUser.id); if (profileUpdateError) console.error("Error updating profile badge_count:", profileUpdateError); else currentProfile.badges_count = newBadgeCount; showToast('Odznak Získán!', `Získali jste odznak: ${badgeData.title}`, 'success'); activityDescription += ` Získán odznak: ${badgeData.title}.`; } } break; case 'title': const titleKeyToAward = rewardValue; console.log(`[ClaimMilestone] Attempting to award title with key: ${titleKeyToAward}`); const currentTitles = Array.isArray(currentProfile.purchased_titles) ? currentProfile.purchased_titles : []; if (!currentTitles.includes(titleKeyToAward)) { const newTitles = [...currentTitles, titleKeyToAward]; const { error: titleError } = await supabase.from('profiles').update({ purchased_titles: newTitles }).eq('id', currentUser.id); if (titleError) { console.error("Error awarding title:", titleError); showToast('Chyba', 'Nepodařilo se udělit titul.', 'error'); } else { currentProfile.purchased_titles = newTitles; showToast('Titul Získán!', `Získali jste titul: ${rewardName}`, 'success'); activityDescription += ` Získán titul: ${rewardName} (${titleKeyToAward}).`; } } else { showToast('Titul Již Vlastníte', `Titul ${rewardName} již máte.`, 'info'); } break; case 'item': console.warn(`[ClaimMilestone] Item awarding for '${rewardValue}' (key: ${rewardKey}) not implemented yet.`); showToast('Milník Dosažen!', `Získali jste předmět: ${rewardName} (Implementace TODO)`, 'success'); activityDescription += ` Získán předmět: ${rewardName} (klíč: ${rewardKey}).`; break; default: showToast('Milník Dosažen!', `Získali jste: ${rewardName}`, 'success'); } await logActivity(currentUser.id, 'streak_milestone_claimed', activityTitle, activityDescription, { milestone_day: milestoneDay, reward_key: rewardKey, reward_name: rewardName, reward_type: rewardType, reward_value: rewardValue }); } else { showToast('Chyba', 'Nepodařilo se uložit vyzvednutí milníkové odměny.', 'error'); } setLoadingState('streakMilestones', false); renderStreakMilestones(); }
    // --- END: Claim Reward Logic ---

    // --- START: Main Data Loading Orchestration ---
    async function loadDashboardData(user, profile) { const startTime = performance.now(); if (!user || !profile) { showError("Chyba: Nelze načíst data bez profilu uživatele.", true); setLoadingState('all', false); return; } console.log("[MAIN] loadDashboardData: Start pro uživatele:", user.id); hideError(); setLoadingState('stats', true); setLoadingState('notifications', true); setLoadingState('activities', true); setLoadingState('creditHistory', true); try { await checkAndUpdateLoginStreak(); updateSidebarProfile(profile); console.log("[MAIN] loadDashboardData: Paralelní načítání statistik, notifikací a seznamů."); const [statsResult, notificationsResult, dashboardListsResult] = await Promise.allSettled([ fetchUserStats(user.id, currentProfile), fetchNotifications(user.id, 5), (typeof DashboardLists !== 'undefined' && typeof DashboardLists.loadAndRenderAll === 'function') ? DashboardLists.loadAndRenderAll(user.id, 5) : Promise.resolve({ status: 'fulfilled', value: console.warn("DashboardLists.loadAndRenderAll not found or module not ready for parallel load.") }) ]); console.log("[MAIN] loadDashboardData: Načítání statistik, notifikací a seznamů dokončeno."); if (statsResult.status === 'fulfilled' && statsResult.value) { userStatsData = statsResult.value; updateStatsCards(userStatsData); } else { console.error("❌ Chyba při načítání statistik:", statsResult.reason); showError("Nepodařilo se načíst statistiky.", false); updateStatsCards(profile); } if (notificationsResult.status === 'fulfilled' && notificationsResult.value) { const { unreadCount, notifications } = notificationsResult.value; renderNotifications(unreadCount, notifications); } else { console.error("❌ Chyba při načítání oznámení:", notificationsResult.reason); renderNotifications(0, []); } if (dashboardListsResult.status === 'rejected') { console.error("❌ Chyba při DashboardLists.loadAndRenderAll:", dashboardListsResult.reason); setLoadingState('activities', false); setLoadingState('creditHistory', false); } const endTime = performance.now(); console.log(`[MAIN] loadDashboardData: Data načtena a zobrazena. Time: ${(endTime - startTime).toFixed(2)}ms`); } catch (error) { console.error('[MAIN] loadDashboardData: Zachycena hlavní chyba:', error); showError('Nepodařilo se kompletně načíst data nástěnky: ' + error.message); updateStatsCards(profile); renderNotifications(0, []); if (typeof DashboardLists !== 'undefined') { if (typeof DashboardLists.renderActivities === 'function') DashboardLists.renderActivities(null); if (typeof DashboardLists.renderCreditHistory === 'function') DashboardLists.renderCreditHistory(null); } } finally { setLoadingState('stats', false); setLoadingState('notifications', false); setLoadingState('activities', false); setLoadingState('creditHistory', false); if (typeof initTooltips === 'function') initTooltips(); console.log("[MAIN] loadDashboardData: Blok finally dokončen."); } }
    // --- END: Main Data Loading ---

    // --- START: Event Listeners Setup ---
    function setupEventListeners() { const startTime = performance.now(); console.log("[SETUP] setupUIEventListeners: Start"); if (!ui || Object.keys(ui).length === 0) { console.error("[SETUP] UI cache is empty! Cannot setup listeners."); return; } const listenersAdded = new Set(); const safeAddListener = (element, eventType, handler, key) => { if (element) { element.removeEventListener(eventType, handler); element.addEventListener(eventType, handler); listenersAdded.add(key); } else { console.warn(`[SETUP] Element not found for listener: ${key}`); } }; safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle'); safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle'); safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay'); safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn'); document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); }); safeAddListener(ui.startPracticeBtn, 'click', () => { window.location.href = '/dashboard/procvicovani/main.html'; }, 'startPracticeBtn'); safeAddListener(ui.openMonthlyModalBtn, 'click', () => showModal('monthly-reward-modal'), 'openMonthlyModalBtn'); safeAddListener(ui.openStreakModalBtn, 'click', () => showModal('streak-milestones-modal'), 'openStreakModalBtn'); safeAddListener(ui.refreshDataBtn, 'click', async () => { if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; ui.refreshDataBtn.disabled = true; await loadDashboardData(currentUser, currentProfile); if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; ui.refreshDataBtn.disabled = false; }, 'refreshDataBtn'); safeAddListener(ui.notificationBell, 'click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell'); safeAddListener(ui.markAllReadBtn, 'click', markAllNotificationsRead, 'markAllReadBtn'); safeAddListener(ui.notificationsList, 'click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount?.textContent?.replace('+', '') || '0'; const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); if(ui.notificationCount) { ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); } if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }, 'notificationsList'); document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown?.classList.remove('active'); } }); safeAddListener(ui.closeMonthlyModalBtn, 'click', () => hideModal('monthly-reward-modal'), 'closeMonthlyModalBtn'); safeAddListener(ui.monthlyRewardModal, 'click', (event) => { if (event.target === ui.monthlyRewardModal) { hideModal('monthly-reward-modal'); } }, 'monthlyRewardModal'); safeAddListener(ui.closeStreakModalBtn, 'click', () => hideModal('streak-milestones-modal'), 'closeStreakModalBtn'); safeAddListener(ui.streakMilestonesModal, 'click', (event) => { if (event.target === ui.streakMilestonesModal) { hideModal('streak-milestones-modal'); } }, 'streakMilestonesModal'); window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus); if (ui.mainContent) ui.mainContent.addEventListener('scroll', initHeaderScrollDetection, { passive: true }); const endTime = performance.now(); console.log(`[SETUP] Event listeners set up. Added: ${[...listenersAdded].length}. Time: ${(endTime - startTime).toFixed(2)}ms`); }
    // --- END: Event Listeners Setup ---

    // --- START: App Initialization ---
    async function initializeApp() {
        const totalStartTime = performance.now();
        console.log("[INIT Dashboard] initializeApp: Start v26.0.11");
        let stepStartTime = performance.now();

        const initialLoaderElement = document.getElementById('initial-loader'); // Získat přímo zde
        const mainContentElement = document.getElementById('main-content');
        const sidebarElement = document.getElementById('sidebar');
        const headerElement = document.querySelector('.dashboard-header');

        try {
            // Zobrazit základní UI okamžitě
            if (sidebarElement) sidebarElement.style.display = 'flex';
            if (headerElement) headerElement.style.display = 'flex';
            if (mainContentElement) mainContentElement.style.display = 'block';

            // AŽ POTOM cachovat DOM elementy, včetně nového placeholderu
            cacheDOMElements();
            console.log(`[INIT Dashboard] cacheDOMElements Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
            stepStartTime = performance.now();

            // Zobrazit placeholder v hlavní části
            if (ui.mainContentAreaPlaceholder) {
                ui.mainContentAreaPlaceholder.innerHTML = '<div class="loading-spinner" style="margin:auto;"></div><p>Načítání palubní desky...</p>';
                ui.mainContentAreaPlaceholder.style.display = 'flex';
            } else {
                // Pokud placeholder neexistuje, logovat a zkusit pokračovat, ale může to znamenat, že UI nebude ideální
                console.warn("[INIT Dashboard] mainContentAreaPlaceholder NOT FOUND in DOM after cache. Layout might be affected.");
            }

            // Skrýt hlavní obsahové části, dokud se nenahrají data
            if (ui.statsCardsContainer) ui.statsCardsContainer.style.display = 'none';
            if (ui.activityListContainerWrapper) ui.activityListContainerWrapper.style.display = 'none';
            if (ui.creditHistoryContainerWrapper) ui.creditHistoryContainerWrapper.style.display = 'none';
            // ... případně další hlavní obsahové bloky ...


            // Skrýt initialLoader rychleji, jakmile je základní UI (včetně placeholderu) zobrazeno
            if (initialLoaderElement) {
                initialLoaderElement.classList.add('hidden');
                setTimeout(() => { if (initialLoaderElement) initialLoaderElement.style.display = 'none'; }, 50);
            }
            console.log(`[INIT Dashboard] Basic UI visible, initialLoader hidden. Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
            stepStartTime = performance.now();


            const waitForSupabase = new Promise((resolve, reject) => { const maxAttempts = 10; let attempts = 0; const intervalId = setInterval(() => { attempts++; if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') { console.log(`[INIT Dashboard] Supabase library found after ${attempts} attempts.`); clearInterval(intervalId); resolve(); } else if (attempts >= maxAttempts) { console.error("[INIT Dashboard] Supabase library not found after waiting. Aborting."); clearInterval(intervalId); reject(new Error("Knihovna Supabase nebyla nalezena včas.")); } else { console.log(`[INIT Dashboard] Waiting for Supabase library... (Attempt ${attempts}/${maxAttempts})`); } }, 200); });
            await waitForSupabase;
            console.log(`[INIT Dashboard] waitForSupabase Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
            stepStartTime = performance.now();

            if (!initializeSupabase()) { console.error("[INIT Dashboard] Supabase init function failed. Aborting."); return; }
            console.log(`[INIT Dashboard] initializeSupabase Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
            stepStartTime = performance.now();

            applyInitialSidebarState();
            console.log(`[INIT Dashboard] applyInitialSidebarState Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
            stepStartTime = performance.now();

            setupEventListeners();
            console.log(`[INIT Dashboard] setupEventListeners Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
            stepStartTime = performance.now();

            setLoadingState('session', true);
            console.log("[INIT Dashboard] Checking auth session (async)...");

            try {
                const { data: { session }, error: sessionError } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT, new Error('Ověření sezení vypršelo.'));
                 console.log(`[INIT Dashboard] getSession Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
                 stepStartTime = performance.now();
                setLoadingState('session', false);

                if (sessionError) {
                    if (sessionError.message.toLowerCase().includes('networkerror')) {
                         throw new Error('Chyba sítě při ověřování sezení. Zkontrolujte své připojení k internetu.');
                    }
                     throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);
                }

                if (session?.user) {
                    currentUser = session.user;
                    console.log(`[INIT Dashboard] User authenticated (ID: ${currentUser.id}). Loading profile and titles...`);
                    if (ui.mainContentAreaPlaceholder) ui.mainContentAreaPlaceholder.style.display = 'none';

                    const [profileResult, titlesResult] = await Promise.allSettled([
                        fetchUserProfile(currentUser.id),
                        fetchTitles()
                    ]);
                    console.log(`[INIT Dashboard] fetchProfile & fetchTitles (parallel) Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);
                    stepStartTime = performance.now();

                    if (profileResult.status === 'fulfilled' && profileResult.value) {
                        currentProfile = profileResult.value;
                        console.log("[INIT Dashboard] Profile loaded:", currentProfile);
                    } else {
                        const profileErrorReason = profileResult.reason || 'Neznámá chyba při načítání profilu.';
                        console.warn(`[INIT Dashboard] Profile not found or fetch failed (${profileErrorReason}), attempting to create default...`);
                        currentProfile = await createDefaultProfile(currentUser.id, currentUser.email);
                        if (!currentProfile) throw new Error(`Nepodařilo se vytvořit/načíst profil uživatele. Důvod: ${profileErrorReason}`);
                        console.log("[INIT Dashboard] Default profile created/retrieved.");
                    }

                    if (titlesResult.status === 'fulfilled') {
                        allTitles = titlesResult.value || [];
                        console.log("[INIT Dashboard] Titles loaded:", allTitles.length);
                    } else {
                        console.warn("[INIT Dashboard] Failed to load titles:", titlesResult.reason);
                        allTitles = [];
                        showToast('Varování', 'Nepodařilo se načíst seznam titulů.', 'warning');
                    }

                    updateSidebarProfile(currentProfile);
                    updateCopyrightYear();
                    updateOnlineStatus();

                    if (typeof DashboardLists !== 'undefined' && typeof DashboardLists.initialize === 'function') {
                        DashboardLists.initialize({ supabaseClient: supabase, currentUser: currentUser, activityVisuals: activityVisuals, formatRelativeTime: formatRelativeTime, sanitizeHTML: sanitizeHTML, setLoadingStateGlobal: setLoadingState });
                    } else {
                        console.error("Modul DashboardLists není definován nebo nemá funkci initialize!");
                        setLoadingState('activities', false); setLoadingState('creditHistory', false);
                    }

                    if (ui.statsCardsContainer) ui.statsCardsContainer.style.display = 'grid';
                    if (ui.activityListContainerWrapper) ui.activityListContainerWrapper.style.display = 'block';
                    if (ui.creditHistoryContainerWrapper) ui.creditHistoryContainerWrapper.style.display = 'block';

                    await loadDashboardData(currentUser, currentProfile);
                    console.log(`[INIT Dashboard] loadDashboardData Time: ${(performance.now() - stepStartTime).toFixed(2)}ms`);

                    requestAnimationFrame(() => {
                        if (ui.mainContent) ui.mainContent.classList.add('loaded');
                        initScrollAnimations();
                    });

                    initMouseFollower();
                    initHeaderScrollDetection();
                    initTooltips();

                    const readyEvent = new CustomEvent('dashboardReady', { detail: { user: currentUser, profile: currentProfile, client: supabase, titles: allTitles } });
                    document.dispatchEvent(readyEvent);
                    console.log("[INIT Dashboard] Dispatching 'dashboardReady' event.");

                } else {
                    console.log('[INIT Dashboard] V sezení není uživatel, přesměrování.');
                    if (ui.mainContentAreaPlaceholder) ui.mainContentAreaPlaceholder.style.display = 'none';
                    showError("Nejste přihlášeni. Přesměrovávám na přihlašovací stránku...", false, ui.mainContentAreaPlaceholder); // Zobrazit chybu v placeholderu
                    setTimeout(() => { window.location.href = '/auth/index.html'; }, 3000);
                }

            } catch (authError) {
                console.error("❌ [INIT Dashboard] Auth/Session Check Error:", authError);
                setLoadingState('session', false);
                let userFriendlyMessage = `Chyba ověření: ${authError.message}`;
                if (authError.message.toLowerCase().includes('ověření sezení vypršelo')) {
                    userFriendlyMessage = "Ověření sezení vypršelo. Zkuste prosím obnovit stránku, nebo zkontrolujte své internetové připojení.";
                } else if (authError.message.toLowerCase().includes('networkerror')) {
                    userFriendlyMessage = "Chyba sítě. Zkontrolujte své internetové připojení a zkuste to znovu.";
                }
                showError(userFriendlyMessage, false, ui.mainContentAreaPlaceholder);
                if (ui.mainContent) ui.mainContent.style.display = 'block';
            }

            const totalEndTime = performance.now();
            console.log(`✅ [INIT Dashboard] App initializeApp function finished. Total Time: ${(totalEndTime - totalStartTime).toFixed(2)}ms`);

        } catch (error) {
            console.error("❌ [INIT Dashboard] Kritická chyba PŘED ověřením sezení:", error);
            const endTime = performance.now();
            console.log(`[INIT Dashboard] Initialization failed. Time: ${(endTime - totalStartTime).toFixed(2)}ms`);
            const initialLoaderElementForError = document.getElementById('initial-loader');
            if (initialLoaderElementForError && !initialLoaderElementForError.classList.contains('hidden')) {
                initialLoaderElementForError.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE STRÁNKU.</p>`;
            } else {
                const globalErrorElement = document.getElementById('global-error');
                 if (globalErrorElement) {
                     globalErrorElement.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>Kritická chyba inicializace: ${sanitizeHTML(error.message)}</div><button class="retry-button btn" onclick="location.reload()">Obnovit Stránku</button></div>`;
                     globalErrorElement.style.display = 'block';
                 } else {
                    alert(`Kritická chyba inicializace: ${error.message}`);
                 }
            }
            const mainContentForError = document.getElementById('main-content');
            if (mainContentForError) mainContentForError.style.display = 'none';
            if (typeof setLoadingState === 'function') setLoadingState('all', false);
        }
    }
    // --- END: App Initialization ---

    // --- START THE APP ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }

    function isSameDate(date1, date2) { if (!date1 || !date2) return false; const d1 = new Date(date1); const d2 = new Date(date2); return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate(); }
    function isYesterday(date1, date2) { if (!date1 || !date2) return false; const yesterday = new Date(date2); yesterday.setDate(yesterday.getDate() - 1); return isSameDate(date1, yesterday); }
    function getCurrentMonthYearString() { const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); return `${year}-${month}`; }
    function showModal(modalId) { const modal = document.getElementById(modalId); if (modal) { console.log(`[Modal] Opening modal: ${modalId}`); modal.style.display = 'flex'; if (modalId === 'monthly-reward-modal') { renderMonthlyCalendar(); } else if (modalId === 'streak-milestones-modal') { renderStreakMilestones(); } requestAnimationFrame(() => { modal.classList.add('active'); }); } else { console.error(`Modal element not found: #${modalId}`); } }
    function hideModal(modalId) { const modal = document.getElementById(modalId); if (modal) { console.log(`[Modal] Closing modal: ${modalId}`); modal.classList.remove('active'); setTimeout(() => { modal.style.display = 'none'; }, 300); } }
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }); animatedElements.forEach(element => observer.observe(element)); };
    const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 50); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl && mainEl.scrollTop > 50) document.body.classList.add('scrolled'); };
    const updateCopyrightYear = () => { const currentYearSpan = ui.currentYearFooter; const currentYearSidebar = ui.currentYearSidebar; const year = new Date().getFullYear(); if (currentYearSpan) { currentYearSpan.textContent = year; } if (currentYearSidebar) { currentYearSidebar.textContent = year; } };
    function initTooltips() { try { if (window.jQuery && typeof window.jQuery.fn.tooltipster === 'function') { window.jQuery('.btn-tooltip.tooltipstered').each(function() { if (document.body.contains(this)) { try { window.jQuery(this).tooltipster('destroy'); } catch (destroyError) { console.warn("Tooltipster destroy error:", destroyError); } } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); console.log("[Tooltips] Initialized/Re-initialized."); } else { console.warn("[Tooltips] jQuery or Tooltipster library not loaded."); } } catch (e) { console.error("[Tooltips] Error initializing Tooltipster:", e); } }

})();