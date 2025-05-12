// dashboard.js
// Verze: 25.1 - Улучшенное управление состоянием загрузки, очистка скелетонов
(function() {
    'use strict';

    // --- START: Initialization and Configuration ---
    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = [];
    let userStatsData = null;

    let isLoading = {
        stats: false,
        activities: false,
        notifications: false,
        titles: false,
        monthlyRewards: false,
        streakMilestones: false,
        creditHistory: false
    };
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
    const MONTHLY_REWARD_DAYS = 31; // Примерное количество дней для календаря

    const STREAK_MILESTONES_CONFIG = {
        3: { name: "Zahřívací Kolečko", description: "3 dny v řadě! Dobrý začátek!", icon: "fa-running", reward_type: "points", reward_value: 5, reward_key: "streak_3_days_points_5" },
        7: { name: "Týdenní Vytrvalec", description: "Celý týden bez přestávky! Skvělé!", icon: "fa-calendar-week", reward_type: "points", reward_value: 15, reward_key: "streak_7_days_points_15" },
        14: { name: "Dvou Týdenní Hrdina", description: "Již 14 dní studia! Neuvěřitelné!", icon: "fa-star", reward_type: "badge", reward_value: "badge_streak_14", reward_key: "streak_14_days_badge_perseverance" },
        30: { name: "Měsíční Maratonec", description: "Celý měsíc konzistence! Jsi legenda!", icon: "fa-trophy", reward_type: "title", reward_value: "title_monthly_marathon", reward_key: "streak_30_days_title_marathon" },
        60: { name: "Dvouměsíční Vládce", description: "60 dní! Jsi nezastavitelný!", icon: "fa-crown", reward_type: "item", reward_value: "item_rare_avatar_frame", reward_key: "streak_60_days_item_frame" },
        90: { name: "Čtvrtletní Soustředění", description: "90 dní naprosté oddanosti!", icon: "fa-brain", reward_type: "points", reward_value: 200, reward_key: "streak_90_days_points_200" },
        180: { name: "Půlroční Mistr", description: "Půl roku konzistentního studia!", icon: "fa-user-graduate", reward_type: "badge", reward_value: "badge_streak_180", reward_key: "streak_180_days_badge_master" },
        365: { name: "Roční Výročí!", description: "Jste absolutní legenda Justax!", icon: "fa-rocket", reward_type: "title", reward_value: "title_legend_365", reward_key: "streak_365_days_title_legend" }
    };
    const sortedMilestoneDays = Object.keys(STREAK_MILESTONES_CONFIG).map(Number).sort((a, b) => a - b);

    const mayRewards = { // Пример наград на Май (может быть загружен с сервера)
        1: { type: 'title', key: 'majovy_poutnik', name: 'Titul: Májový Poutník', icon: 'fa-hiking', value: null },
        7: { type: 'credits', key: 'may_credits_10', name: '10 Kreditů', icon: 'fa-coins', value: 10 },
        // ...
    };

    let ui = {}; // UI cache

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
        points_earned: { name: 'Kredity Získány', icon: 'fa-arrow-up', class: 'points_earned' }, // Иконка для зачисления
        points_spent: { name: 'Kredity Utraceny', icon: 'fa-arrow-down', class: 'points_spent' }, // Иконка для списания
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
            activityListLoadingPlaceholder: document.querySelector('#activity-list-container .loading-placeholder'), // Явное указание

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
            currentYearFooter: document.getElementById('currentYearFooter'),

            creditHistorySection: document.getElementById('credit-history-section'),
            creditHistoryListContainer: document.querySelector('#credit-history-section .activity-list-container'), // Внутренний контейнер
            creditHistoryList: document.getElementById('credit-history-list'),
            creditHistoryEmptyState: document.getElementById('credit-history-empty-state'),
            creditHistoryErrorState: document.getElementById('credit-history-error-state'),
            creditHistoryLoadingPlaceholder: document.querySelector('#credit-history-section .loading-placeholder'), // Явное указание
            viewAllCreditsLink: document.getElementById('view-all-credits-link')
        };
        const missingElements = Object.entries(ui).filter(([key, element]) => element === null).map(([key]) => key);
        if (missingElements.length > 0) {
            console.warn(`[CACHE DOM] Following elements were not found: (${missingElements.length})`, missingElements);
        } else {
            console.log("[CACHE DOM] Caching complete.");
        }
         // Проверка наличия ключевых плейсхолдеров
         if (!ui.activityListLoadingPlaceholder) console.warn("[CACHE DOM] Activity list loading placeholder NOT FOUND. Skeletons may not work.");
         if (!ui.creditHistoryLoadingPlaceholder) console.warn("[CACHE DOM] Credit history loading placeholder NOT FOUND. Skeletons may not work.");
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

    // --- Улучшенная функция setLoadingState v25.1 ---
    function setLoadingState(sectionKey, isLoadingFlag) {
        if (!ui || Object.keys(ui).length === 0) { console.error("[SetLoadingState] UI cache not ready."); return; }
        if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;

        isLoading[sectionKey] = isLoadingFlag;
        console.log(`[SetLoadingState v25.1] Section: ${sectionKey}, isLoading: ${isLoadingFlag}`);

        let targetContainer, placeholder, contentList, emptyState, errorState;

        switch (sectionKey) {
            case 'activities':
                targetContainer = ui.activityListContainer;
                placeholder = ui.activityListLoadingPlaceholder;
                contentList = ui.activityList;
                emptyState = ui.activityListEmptyState;
                errorState = ui.activityListErrorState;
                break;
            case 'creditHistory':
                targetContainer = ui.creditHistoryListContainer;
                placeholder = ui.creditHistoryLoadingPlaceholder;
                contentList = ui.creditHistoryList;
                emptyState = ui.creditHistoryEmptyState;
                errorState = ui.creditHistoryErrorState;
                break;
            case 'stats':
                // Статистика обрабатывается добавлением/удалением класса 'loading' к .stat-card
                ui.statsCards?.querySelectorAll('.stat-card').forEach(card => card.classList.toggle('loading', isLoadingFlag));
                return; // Выход, так как остальная логика не нужна
            case 'notifications':
                if (ui.notificationBell) ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                if (ui.markAllReadBtn) {
                    const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                    ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
                }
                if (isLoadingFlag && ui.notificationsList && typeof renderNotificationSkeletons === 'function') {
                    renderNotificationSkeletons(2);
                } else if (!isLoadingFlag && ui.notificationsList && ui.noNotificationsMsg && ui.notificationsList.children.length === 0) {
                    ui.noNotificationsMsg.style.display = 'block';
                }
                return;
            case 'all':
                Object.keys(isLoading).forEach(key => {
                    if (key !== 'all') setLoadingState(key, isLoadingFlag);
                });
                return;
            default:
                console.warn(`[SetLoadingState] Unknown section key: ${sectionKey}`);
                return;
        }

        if (!targetContainer) {
            console.warn(`[SetLoadingState] Container for section "${sectionKey}" not found.`);
            return;
        }

        targetContainer.classList.toggle('loading', isLoadingFlag);

        if (isLoadingFlag) {
            if (placeholder) placeholder.style.display = 'flex'; // Показываем скелетоны
            if (contentList) contentList.style.display = 'none';
            if (emptyState) emptyState.style.display = 'none';
            if (errorState) errorState.style.display = 'none';
        } else {
            // Скрытие плейсхолдера должно произойти в render-функции,
            // но на всякий случай, если он остался видимым:
            if (placeholder && placeholder.style.display !== 'none') {
                placeholder.style.display = 'none';
            }
            // Видимость contentList и emptyState/errorState управляется render-функциями
        }
    }
    // --- END: Helper Functions ---

    // --- START: Supabase Client Initialization ---
    function initializeSupabase() { /* ... (same as before, from previous script) ... */ console.log("[Supabase] Attempting initialization..."); try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded or createClient is not a function."); } supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); if (!supabase) { throw new Error("Supabase client creation failed (returned null/undefined)."); } window.supabaseClient = supabase; console.log('[Supabase] Klient úspěšně inicializován a globálně dostupný.'); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); if (typeof showError === 'function') { showError("Kritická chyba: Nepodařilo se připojit k databázi. Zkuste obnovit stránku.", true); } else { alert("Kritická chyba: Nepodařilo se připojit k databázi. Zkuste obnovit stránku."); } return false; } }
    // --- END: Supabase Client Initialization ---

    // --- START: Data Loading and Processing ---
    async function fetchUserProfile(userId) { /* ... (same as before, from previous script) ... */ if (!supabase || !userId) return null; console.log(`[Profile] Fetching profile for user ID: ${userId}`); try { const { data: profile, error } = await supabase.from('profiles').select('*, selected_title, last_login, streak_days, longest_streak_days, monthly_claims, last_milestone_claimed, purchased_titles').eq('id', userId).single(); if (error && error.code !== 'PGRST116') { throw error; } if (!profile) { console.warn(`[Profile] Profile for ${userId} not found. Returning null.`); return null; } profile.monthly_claims = profile.monthly_claims || {}; profile.last_milestone_claimed = profile.last_milestone_claimed || 0; profile.purchased_titles = profile.purchased_titles || []; console.log("[Profile] Profile data fetched successfully:", profile); return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); return null; } }
    async function createDefaultProfile(userId, userEmail) { /* ... (same as before, from previous script) ... */ if (!supabase || !userId || !userEmail) return null; console.log(`[Profile Create] Creating default profile for user ${userId}`); try { const defaultData = { id: userId, email: userEmail, username: userEmail.split('@')[0] || `user_${userId.substring(0, 6)}`, level: 1, points: 0, experience: 0, badges_count: 0, streak_days: 0, longest_streak_days: 0, last_login: new Date().toISOString(), monthly_claims: {}, last_milestone_claimed: 0, purchased_titles: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), preferences: { dark_mode: window.matchMedia('(prefers-color-scheme: dark)').matches, language: 'cs' }, notifications: { email: true, study_tips: true, content_updates: true, practice_reminders: true } }; const { data: newProfile, error } = await supabase.from('profiles').insert(defaultData).select('*, selected_title, last_login, streak_days, longest_streak_days, monthly_claims, last_milestone_claimed, purchased_titles').single(); if (error) { if (error.code === '23505') { console.warn("[Profile Create] Profile likely already exists, fetching again."); return await fetchUserProfile(userId); } throw error; } console.log("[Profile Create] Default profile created:", newProfile); return newProfile; } catch (error) { console.error("[Profile Create] Failed to create default profile:", error); return null; } }
    async function fetchTitles() { /* ... (same as before, from previous script) ... */ if (!supabase) return []; console.log("[Titles] Fetching available titles..."); setLoadingState('titles', true); try { const { data, error } = await supabase.from('title_shop').select('title_key, name'); if (error) throw error; console.log("[Titles] Fetched titles:", data); return data || []; } catch (error) { console.error("[Titles] Error fetching titles:", error); return []; } finally { setLoadingState('titles', false); } }
    async function fetchUserStats(userId, profileData) { /* ... (same as before, from previous script) ... */ if (!supabase || !userId || !profileData) { console.error("[Stats] Chybí Supabase klient, ID uživatele nebo data profilu."); return null; } console.log(`[Stats] Načítání statistik pro uživatele ${userId}...`); let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats] Chyba Supabase při načítání user_stats:", statsError.message); } } catch (error) { console.error("[Stats] Neočekávaná chyba při načítání user_stats:", error); statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: profileData.longest_streak_days ?? Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0 }; if (statsError) { console.warn("[Stats] Vracení statistik primárně z profilu kvůli chybě načítání."); } else { console.log("[Stats] Statistiky úspěšně načteny/sestaveny:", finalStats); } return finalStats; }
    async function fetchRecentActivities(userId, limit = 5) { /* ... (same as before, from previous script) ... */ if (!supabase || !userId) { console.error("[Activities] Chybí Supabase klient nebo ID uživatele pro fetchRecentActivities."); return []; } console.log(`[Activities] START: Načítání posledních ${limit} aktivit pro uživatele ${userId}`); try { const { data, error } = await supabase.from('activities').select('title, description, type, created_at, icon, link_url, details').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit); if (error) { console.error(`[Activities] ERROR při dotazu na Supabase 'activities':`, error); throw error; } console.log(`[Activities] SUCCESS: Načteno ${data?.length || 0} aktivit z 'activities'. Data:`, data); return data || []; } catch (e) { console.error('[Activities] VÝJIMKA při načítání aktivit z "activities":', e.message, e.stack); showToast('Chyba aktivit', 'Nepodařilo se načíst nedávné aktivity.', 'error'); return []; } }
    async function fetchNotifications(userId, limit = 5) { /* ... (same as before, from previous script) ... */ if (!supabase || !userId) { console.error("[Notifications] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; console.log(`[Notifications] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; } }
    async function fetchCreditHistory(userId, limit = 5) { /* ... (same as before, from previous script) ... */ if (!supabase || !userId) { console.error("[CreditHistory] Chybí Supabase klient nebo ID uživatele."); return []; } console.log(`[CreditHistory] Načítání posledních ${limit} kreditových transakcí pro uživatele ${userId}`); try { const { data, error } = await supabase.from('credit_transactions').select('created_at, transaction_type, amount, description, balance_after_transaction').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit); if (error) throw error; console.log(`[CreditHistory] Načteno ${data?.length || 0} transakcí.`); return data || []; } catch (error) { console.error('[CreditHistory] Výjimka při načítání historie kreditů:', error); showToast('Chyba historie kreditů', 'Nepodařilo se načíst historii kreditů.', 'error'); return []; } }
    async function checkAndUpdateLoginStreak() { /* ... (same as before, from previous script) ... */ if (!currentUser || !currentProfile || !supabase) { console.warn("[StreakCheck] Cannot perform check: missing user, profile, or supabase."); return false; } console.log("[StreakCheck] Performing daily login check/update..."); const today = new Date(); const lastLogin = currentProfile.last_login ? new Date(currentProfile.last_login) : null; let currentStreak = currentProfile.streak_days || 0; let longestStreak = currentProfile.longest_streak_days || 0; let needsDbUpdate = false; let updateData = {}; const currentMonthYear = getCurrentMonthYearString(); if (!lastLogin || !isSameDate(today, lastLogin)) { needsDbUpdate = true; console.log("[StreakCheck] First login of the day detected."); if (lastLogin && isYesterday(lastLogin, today)) { currentStreak++; console.log(`[StreakCheck] Streak continued! New current streak: ${currentStreak}`); } else if (lastLogin) { currentStreak = 1; console.log("[StreakCheck] Streak broken. Resetting to 1."); } else { currentStreak = 1; console.log("[StreakCheck] First login ever. Setting streak to 1."); } updateData.streak_days = currentStreak; updateData.last_login = today.toISOString(); if (currentStreak > longestStreak) { longestStreak = currentStreak; updateData.longest_streak_days = longestStreak; console.log(`[StreakCheck] New longest streak: ${longestStreak}!`); } } else { console.log("[StreakCheck] Already logged in today. No streak update needed for current streak."); if (currentProfile.streak_days > (currentProfile.longest_streak_days || 0) ) { console.warn(`[StreakCheck] Discrepancy found: streak_days (${currentProfile.streak_days}) > longest_streak_days (${currentProfile.longest_streak_days || 0}). Updating longest_streak.`); updateData.longest_streak_days = currentProfile.streak_days; longestStreak = currentProfile.streak_days; needsDbUpdate = true; } } currentProfile.streak_days = currentStreak; currentProfile.longest_streak_days = longestStreak; if (ui.modalCurrentStreakValue) ui.modalCurrentStreakValue.textContent = currentStreak; currentProfile.monthly_claims = currentProfile.monthly_claims || {}; if (!currentProfile.monthly_claims[currentMonthYear]) { console.log(`[StreakCheck] Initializing claims for new month: ${currentMonthYear}`); const updatedClaims = { ...currentProfile.monthly_claims, [currentMonthYear]: [] }; currentProfile.monthly_claims = updatedClaims; updateData.monthly_claims = updatedClaims; needsDbUpdate = true; } else { console.log(`[StreakCheck] Monthly claims for ${currentMonthYear} already exist.`); } if (needsDbUpdate) { console.log("[StreakCheck] Updating profile in DB with:", updateData); try { const { error: updateError } = await supabase.from('profiles').update(updateData).eq('id', currentUser.id); if (updateError) throw updateError; if (updateData.last_login) currentProfile.last_login = updateData.last_login; if (updateData.monthly_claims) currentProfile.monthly_claims = updateData.monthly_claims; console.log("[StreakCheck] Profile updated successfully in DB."); return true; } catch (error) { console.error("[StreakCheck] Error updating profile:", error); showToast('Chyba', 'Nepodařilo se aktualizovat data přihlášení.', 'error'); return false; } } return false; }
    async function updateMonthlyClaimsInDB(newClaimsData) { /* ... (same as before, from previous script) ... */ if (!currentUser || !supabase) return false; console.log("[DB Update] Updating monthly claims in DB:", newClaimsData); try { const { error } = await supabase.from('profiles').update({ monthly_claims: newClaimsData, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (error) throw error; console.log("[DB Update] Monthly claims update successful."); return true; } catch (error) { console.error("[DB Update] Error updating monthly claims:", error); showToast('Chyba', 'Nepodařilo se uložit vyzvednutí měsíční odměny.', 'error'); return false; } }
    async function updateLastMilestoneClaimedInDB(milestoneDay, rewardKey, rewardName) { /* ... (same as before, from previous script) ... */ if (!currentUser || !supabase) return false; console.log(`[DB Update] Attempting to record claim for milestoneDay: ${milestoneDay}, rewardKey: ${rewardKey}`); try { const { error: insertError } = await supabase.from('claimed_streak_milestones').insert({ user_id: currentUser.id, milestone_day: milestoneDay, reward_key: rewardKey, reward_name: rewardName }); if (insertError && insertError.code !== '23505') { console.error(`[DB Update] Error inserting into claimed_streak_milestones for milestone ${milestoneDay}:`, insertError); throw insertError; } else if (insertError && insertError.code === '23505') { console.warn(`[DB Update] Milestone ${milestoneDay} (key: ${rewardKey}) already claimed by user ${currentUser.id}. No new record inserted.`); return true; } console.log(`[DB Update] Milestone ${milestoneDay} (key: ${rewardKey}) successfully recorded in claimed_streak_milestones.`); if (currentProfile && milestoneDay > (currentProfile.last_milestone_claimed || 0)) { const { error: profileUpdateError } = await supabase.from('profiles').update({ last_milestone_claimed: milestoneDay, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (profileUpdateError) { console.error(`[DB Update] Error updating profiles.last_milestone_claimed for ${milestoneDay}:`, profileUpdateError); } else { currentProfile.last_milestone_claimed = milestoneDay; console.log(`[DB Update] profiles.last_milestone_claimed updated to ${milestoneDay}.`); } } return true; } catch (error) { console.error(`[DB Update] General error in updateLastMilestoneClaimedInDB for ${milestoneDay}:`, error); showToast('Chyba', 'Nepodařilo se uložit vyzvednutí milníkové odměny.', 'error'); return false; } }
    async function awardPoints(pointsValue, reason = "Nespecifikováno", transactionType = 'points_earned', referenceActivityId = null) { /* ... (same as before, from previous script) ... */ if (!currentUser || !currentProfile || !supabase) { console.warn("Cannot award points: User, profile, or Supabase missing."); return; } if (pointsValue === 0) { console.log("No points to award (value is 0)."); return; } console.log(`[Points] Awarding/deducting ${pointsValue} points for: ${reason}. Type: ${transactionType}`); setLoadingState('stats', true); const currentPoints = currentProfile.points || 0; const newPoints = currentPoints + pointsValue; try { const { error: profileError } = await supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (profileError) throw profileError; currentProfile.points = newPoints; const { error: transactionError } = await supabase.from('credit_transactions').insert({ user_id: currentUser.id, transaction_type: transactionType, amount: pointsValue, description: reason, balance_after_transaction: newPoints, reference_activity_id: referenceActivityId }); if (transactionError) { console.error("[Points] Error logging credit transaction:", transactionError); showToast('Varování', 'Kredity připsány, ale záznam transakce selhal.', 'warning'); } else { console.log(`[Points] Credit transaction logged: ${pointsValue} for ${reason}`); } if (pointsValue > 0) { showToast('Kredity Získány!', `+${pointsValue} kreditů za: ${reason}`, 'success', 2500); } else if (pointsValue < 0) { showToast('Kredity Utraceny!', `${pointsValue} kreditů za: ${reason}`, 'info', 2500); } userStatsData = await fetchUserStats(currentUser.id, currentProfile); updateStatsCards(userStatsData); if (ui.creditHistorySection) { const creditHistory = await fetchCreditHistory(currentUser.id, 5); renderCreditHistory(creditHistory); } if (pointsValue > 0) { await logActivity( currentUser.id, 'points_earned', `Získáno ${pointsValue} kreditů`, `Důvod: ${reason}`, { points_change: pointsValue, new_total_points: newPoints, source: transactionType }, null, referenceActivityId, 'fa-coins' ); } } catch (error) { console.error(`[Points] Error awarding/deducting points:`, error); showToast('Chyba', 'Nepodařilo se upravit kredity.', 'error'); } finally { setLoadingState('stats', false); } }
    async function logActivity(userId, type, title, description = null, details = null, link_url = null, reference_id = null, icon = null) { /* ... (same as before, from previous script) ... */ if (!supabase || !userId) { console.error("Cannot log activity: Supabase client or user ID is missing."); return; } console.log(`[Log Activity] Logging: User ${userId}, Type: ${type}, Title: ${title}`); try { const { error } = await supabase.from('activities').insert({ user_id: userId, type: type, title: title, description: description, details: details, link_url: link_url, reference_id: reference_id, icon: icon || activityVisuals[type]?.icon || activityVisuals.default.icon }); if (error) { console.error("Error logging activity:", error); } else { console.log("Activity logged successfully."); if (ui.activityListContainer && window.location.pathname.includes('dashboard.html')) { const activities = await fetchRecentActivities(userId, 5); renderActivities(activities); } } } catch (err) { console.error("Exception during activity logging:", err); } }
    // --- END: Data Loading and Processing ---

    // --- START: UI Update Functions ---
    function updateSidebarProfile(profile) { /* ... (same as before, from previous script) ... */ if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { cacheDOMElements(); if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[UI Update Sidebar] Sidebar elements not found in cache."); return; } } console.log("[UI Update] Aktualizace sidebaru..."); if (profile) { const firstName = profile.first_name ?? ''; const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(profile); const avatarUrl = profile.avatar_url; ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const sidebarImg = ui.sidebarAvatar.querySelector('img'); if (sidebarImg) { sidebarImg.onerror = () => { ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; } const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot'; if (selectedTitleKey && allTitles && allTitles.length > 0) { const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) displayTitle = foundTitle.name; else console.warn(`[UI Update Sidebar] Title key "${selectedTitleKey}" not found in titles list.`); } else if (selectedTitleKey) { console.warn(`[UI Update Sidebar] Selected title key present, but titles list is empty or not loaded.`); } ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`; console.log("[UI Update] Sidebar aktualizován."); } else { console.warn("[UI Update Sidebar] Missing profile data. Setting defaults."); ui.sidebarName.textContent = "Nepřihlášen"; ui.sidebarAvatar.textContent = '?'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title'); if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítejte!`; } }
    function updateStatsCards(stats) { /* ... (same as before, from previous script) ... */ console.log("[UI Update] Aktualizace karet statistik:", stats); const statElements = { progress: ui.overallProgressValue, points: ui.totalPointsValue, streak: ui.streakValue, progressFooter: ui.overallProgressFooter, pointsFooter: ui.totalPointsFooter, streakFooter: ui.streakFooter }; const cards = [ui.progressCard, ui.pointsCard, ui.streakCard]; const requiredElements = Object.values(statElements); if (requiredElements.some(el => !el)) { console.error("[UI Update Stats] Chybějící elementy statistik."); cards.forEach(card => card?.classList.remove('loading')); return; } cards.forEach(card => card?.classList.remove('loading')); if (!stats) { console.warn("[UI Update Stats] Chybí data statistik, zobrazuji placeholder."); statElements.progress.textContent = '- %'; statElements.points.textContent = '-'; statElements.streak.textContent = '-'; statElements.progressFooter.innerHTML = `<i class="fas fa-exclamation-circle"></i> Data nenalezena`; statElements.pointsFooter.innerHTML = `<i class="fas fa-exclamation-circle"></i> Data nenalezena`; statElements.streakFooter.textContent = `MAX: - dní`; return; } statElements.progress.textContent = `${stats.progress ?? 0}%`; const weeklyProgress = stats.progress_weekly ?? 0; statElements.progressFooter.classList.remove('positive', 'negative'); statElements.progressFooter.innerHTML = weeklyProgress > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyProgress}% týdně` : weeklyProgress < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyProgress}% týdně` : `<i class="fas fa-minus"></i> --`; if (weeklyProgress > 0) statElements.progressFooter.classList.add('positive'); else if (weeklyProgress < 0) statElements.progressFooter.classList.add('negative'); statElements.points.textContent = stats.points ?? 0; const weeklyPoints = stats.points_weekly ?? 0; statElements.pointsFooter.classList.remove('positive', 'negative'); statElements.pointsFooter.innerHTML = weeklyPoints > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyPoints} týdně` : weeklyPoints < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyPoints} týdně` : `<i class="fas fa-minus"></i> --`; if (weeklyPoints > 0) statElements.pointsFooter.classList.add('positive'); else if (weeklyPoints < 0) statElements.pointsFooter.classList.add('negative'); statElements.streak.textContent = stats.streak_current ?? 0; statElements.streakFooter.innerHTML = `MAX: ${stats.streak_longest ?? 0} dní`; if ((stats.streak_current ?? 0) > 0 && (stats.streak_current !== stats.streak_longest)) { statElements.streakFooter.innerHTML += ` <span style="color:var(--text-muted); font-size:0.9em;">(Aktuální: ${stats.streak_current ?? 0})</span>`; } console.log("[UI Update] Karty statistik aktualizovány."); }

    // Обновленная renderActivities с улучшенным управлением состоянием загрузки
    function renderActivities(activities) {
        if (!ui.activityList || !ui.activityListContainer || !ui.activityListEmptyState || !ui.activityListErrorState || !ui.activityListLoadingPlaceholder) {
            console.error("[Render Activities] Essential UI elements for activity list are missing. Rendering cancelled.");
            setLoadingState('activities', false);
            return;
        }
        console.log("[Render Activities v25.1] START: Vykreslování aktivit, počet:", activities?.length);

        ui.activityList.innerHTML = ''; // Очистка старых элементов
        ui.activityListLoadingPlaceholder.style.display = 'none'; // Скрываем скелетоны/плейсхолдер
        ui.activityListErrorState.style.display = 'none';
        ui.activityListEmptyState.style.display = 'none';
        ui.activityList.style.display = 'none'; // Скрываем основной список по умолчанию

        if (activities === null) {
            ui.activityListErrorState.style.display = 'block';
            console.warn("[Render Activities] Přijata null data (error state).");
        } else if (!activities || activities.length === 0) {
            ui.activityListEmptyState.style.display = 'block';
            console.log("[Render Activities] Žádné aktivity k zobrazení.");
        } else {
            const fragment = document.createDocumentFragment();
            activities.forEach(activity => {
                const typeLower = activity.type?.toLowerCase() || 'default';
                const visual = activityVisuals[typeLower] || activityVisuals.default;
                const title = sanitizeHTML(activity.title || 'Neznámá aktivita');
                let description = sanitizeHTML(activity.description || '');
                const timeAgo = formatRelativeTime(activity.created_at);
                const icon = activity.icon || visual.icon;
                const linkUrl = activity.link_url;
                const details = activity.details;
                let metaScoreHTML = '';

                if (details && details.score !== undefined && details.max_score !== undefined) {
                    metaScoreHTML = `<div class="activity-meta">Skóre: ${sanitizeHTML(String(details.score))}/${sanitizeHTML(String(details.max_score))}</div>`;
                } else if (details && details.score !== undefined) {
                     metaScoreHTML = `<div class="activity-meta">Skóre: ${sanitizeHTML(String(details.score))}</div>`;
                }

                const item = document.createElement('div');
                item.className = 'activity-item';
                let itemContent = `
                    <div class="activity-icon ${visual.class || typeLower}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${title}</div>
                        ${description ? `<div class="activity-desc">${description}</div>` : ''}
                        ${metaScoreHTML}
                        <div class="activity-time"><i class="far fa-clock"></i> ${timeAgo}</div>
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
            console.log(`[Render Activities] SUCCESS: Vykresleno ${activities.length} aktivit.`);
        }
        ui.activityListContainer.classList.remove('loading');
        // setLoadingState('activities', false); // Вызывается в loadDashboardData
    }

    function renderActivitySkeletons(count = 5) {
        if (!ui.activityListContainer || !ui.activityListLoadingPlaceholder) {
            console.warn("Cannot render activity skeletons: activityListContainer or activityListLoadingPlaceholder not found.");
            return;
        }
        console.log(`[Render Skeletons] Rendering ${count} activity skeletons into placeholder.`);
        // ui.activityListContainer.classList.add('loading'); // Управляется setLoadingState
        // if(ui.activityList) ui.activityList.style.display = 'none';
        // if(ui.activityListEmptyState) ui.activityListEmptyState.style.display = 'none';
        // if(ui.activityListErrorState) ui.activityListErrorState.style.display = 'none';

        let skeletonHTML = ''; // Собираем HTML для скелетонов
        for (let i = 0; i < count; i++) {
            skeletonHTML += `
                <div class="skeleton-activity-item">
                    <div class="skeleton icon-placeholder"></div>
                    <div style="flex-grow: 1;">
                        <div class="skeleton activity-line"></div>
                        <div class="skeleton activity-line text-short"></div>
                        <div class="skeleton activity-line-short"></div>
                    </div>
                </div>`;
        }
        ui.activityListLoadingPlaceholder.innerHTML = skeletonHTML; // Вставляем скелетоны в плейсхолдер
        // ui.activityListLoadingPlaceholder.style.display = 'flex'; // Показ плейсхолдера управляется setLoadingState
    }

    // Обновленная renderCreditHistory
    function renderCreditHistory(transactions) {
        if (!ui.creditHistoryList || !ui.creditHistoryListContainer || !ui.creditHistoryEmptyState || !ui.creditHistoryErrorState || !ui.creditHistoryLoadingPlaceholder) {
            console.error("[RenderCreditHistory] Essential UI elements for credit history are missing.");
            setLoadingState('creditHistory', false);
            return;
        }
        console.log("[RenderCreditHistory v25.1] Vykreslování historie kreditů, počet transakcí:", transactions?.length);

        ui.creditHistoryList.innerHTML = '';
        ui.creditHistoryLoadingPlaceholder.style.display = 'none';
        ui.creditHistoryEmptyState.style.display = 'none';
        ui.creditHistoryErrorState.style.display = 'none';
        ui.creditHistoryList.style.display = 'none';

        if (transactions === null) {
            ui.creditHistoryErrorState.style.display = 'block';
            console.warn("[RenderCreditHistory] Přijata null data (error state).");
        } else if (!transactions || transactions.length === 0) {
            ui.creditHistoryEmptyState.style.display = 'block';
            console.log("[RenderCreditHistory] Žádné transakce k zobrazení.");
        } else {
            const fragment = document.createDocumentFragment();
            transactions.forEach(tx => {
                const item = document.createElement('div');
                item.className = 'activity-item credit-transaction-item';
                const amountClass = tx.amount > 0 ? 'positive' : (tx.amount < 0 ? 'negative' : 'neutral');
                const amountSign = tx.amount > 0 ? '+' : '';
                const typeLower = tx.transaction_type?.toLowerCase() || (tx.amount > 0 ? 'points_earned' : tx.amount < 0 ? 'points_spent' : 'default');
                const visual = activityVisuals[typeLower] || activityVisuals.default;
                const iconClass = visual.icon;
                const iconBgClass = visual.class || typeLower;

                item.innerHTML = `
                    <div class="activity-icon ${iconBgClass}">
                        <i class="fas ${iconClass}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${sanitizeHTML(tx.description || tx.transaction_type || 'Neznámá transakce')}</div>
                        <div class="credit-amount ${amountClass}">
                            ${amountSign}${tx.amount} <i class="fas fa-coins"></i>
                        </div>
                        <div class="activity-time">
                            <i class="far fa-clock"></i> ${formatRelativeTime(tx.created_at)}
                        </div>
                    </div>`;
                fragment.appendChild(item);
            });
            ui.creditHistoryList.appendChild(fragment);
            ui.creditHistoryList.style.display = 'block';
            console.log(`[RenderCreditHistory] Vykresleno ${transactions.length} transakcí.`);
        }
        ui.creditHistoryListContainer.classList.remove('loading');
        // setLoadingState('creditHistory', false); // Вызывается в loadDashboardData
    }

     function renderCreditHistorySkeletons(count = 5) {
        if (!ui.creditHistoryListContainer || !ui.creditHistoryLoadingPlaceholder) {
            console.warn("Cannot render credit history skeletons: container or placeholder missing.");
            return;
        }
        console.log(`[RenderSkeletons] Rendering ${count} credit history skeletons.`);
        // ui.creditHistoryListContainer.classList.add('loading'); // Управляется setLoadingState
        // if(ui.creditHistoryList) ui.creditHistoryList.style.display = 'none';
        // if(ui.creditHistoryEmptyState) ui.creditHistoryEmptyState.style.display = 'none';
        // if(ui.creditHistoryErrorState) ui.creditHistoryErrorState.style.display = 'none';

        let skeletonHTML = '';
        for (let i = 0; i < count; i++) {
            skeletonHTML += `
                <div class="skeleton-activity-item">
                    <div class="skeleton icon-placeholder" style="background-color: var(--accent-orange);"></div>
                    <div style="flex-grow: 1;">
                        <div class="skeleton activity-line" style="width: 70%;"></div>
                        <div class="skeleton activity-line text-short" style="width: 30%;"></div>
                        <div class="skeleton activity-line-short" style="width: 40%;"></div>
                    </div>
                </div>`;
        }
        ui.creditHistoryLoadingPlaceholder.innerHTML = skeletonHTML;
        // ui.creditHistoryLoadingPlaceholder.style.display = 'flex'; // Показ управляется setLoadingState
    }


    function renderNotifications(count, notifications) { /* ... (same as before, from previous script) ... */ if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { return; } console.log("[Render Notifications] Start, Počet:", count, "Oznámení:", notifications); ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } console.log("[Render Notifications] Hotovo"); }
    function renderNotificationSkeletons(count = 2) { /* ... (same as before, from previous script) ... */ if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    function renderMonthlyCalendar() { /* ... (same as before, from previous script) ... */ }
    function renderMonthlyCalendarSkeletons() { /* ... (same as before, from previous script) ... */ }
    function renderStreakMilestones() { /* ... (same as before, from previous script) ... */ }
    function renderMilestoneSkeletons() { /* ... (same as before, from previous script) ... */ }
    // --- END: UI Update Functions ---

    // --- START: Claim Reward Logic ---
    async function claimMonthlyReward(day, buttonElement, rewardType = 'default', rewardValue = 1, rewardName = `Odměna dne ${day}`) { /* ... (same as before, from previous script) ... */ }
    async function claimMilestoneReward(milestoneDay, buttonElement, rewardType, rewardValue, rewardName, rewardKey) { /* ... (same as before, from previous script) ... */ }
    // --- END: Claim Reward Logic ---

    // --- START: Notification Logic ---
    async function markNotificationRead(notificationId) { /* ... (same as before, from previous script) ... */ }
    async function markAllNotificationsRead() { /* ... (same as before, from previous script) ... */ }
    // --- END: Notification Logic ---

    // --- START: Main Data Loading Orchestration ---
    async function loadDashboardData(user, profile) {
        if (!user || !profile) {
            showError("Chyba: Nelze načíst data bez profilu uživatele.", true);
            setLoadingState('all', false);
            return;
        }
        console.log("[MAIN] loadDashboardData: Start pro uživatele:", user.id);
        hideError();
        setLoadingState('stats', true);
        setLoadingState('activities', true);       // Показываем скелетоны для активностей
        setLoadingState('notifications', true);
        setLoadingState('creditHistory', true);     // Показываем скелетоны для истории кредитов

        try {
            await checkAndUpdateLoginStreak(); // Эта функция может обновить currentProfile
            updateSidebarProfile(currentProfile); // Обновляем сайдбар актуальными данными

            console.log("[MAIN] loadDashboardData: Načítání statistik, aktivit, notifikací a historie kreditů...");
            const [statsResult, activitiesResult, notificationsResult, creditHistoryResult] = await Promise.allSettled([
                fetchUserStats(user.id, currentProfile), // Передаем обновленный currentProfile
                fetchRecentActivities(user.id, 5),
                fetchNotifications(user.id, 5),
                fetchCreditHistory(user.id, 5)
            ]);
            console.log("[MAIN] loadDashboardData: Souběžné načítání dokončeno.");

            // Обработка статистики
            if (statsResult.status === 'fulfilled') {
                userStatsData = statsResult.value;
                updateStatsCards(userStatsData || currentProfile); // Передаем currentProfile как fallback
            } else {
                console.error("❌ Chyba při načítání statistik:", statsResult.reason);
                showError("Nepodařilo se načíst statistiky.", false);
                updateStatsCards(currentProfile); // Показываем данные из профиля при ошибке
            }
            setLoadingState('stats', false);

            // Обработка активностей
            if (activitiesResult.status === 'fulfilled') {
                renderActivities(activitiesResult.value || []);
            } else {
                console.error("❌ Chyba při načítání aktivit:", activitiesResult.reason);
                showError("Nepodařilo se načíst aktivity.", false);
                renderActivities(null); // Передаем null для отображения ошибки
            }
            // setLoadingState('activities', false); // Перемещено в renderActivities

            // Обработка уведомлений
            if (notificationsResult.status === 'fulfilled') {
                const { unreadCount, notifications } = notificationsResult.value || { unreadCount: 0, notifications: [] };
                renderNotifications(unreadCount, notifications);
            } else {
                console.error("❌ Chyba při načítání oznámení:", notificationsResult.reason);
                showError("Nepodařilo se načíst oznámení.", false);
                renderNotifications(0, []);
            }
            setLoadingState('notifications', false);

            // Обработка истории кредитов
            if (creditHistoryResult.status === 'fulfilled') {
                renderCreditHistory(creditHistoryResult.value || []);
            } else {
                console.error("❌ Chyba při načítání historie kreditů:", creditHistoryResult.reason);
                showError("Nepodařilo se načíst historii kreditů.", false);
                renderCreditHistory(null); // Передаем null для отображения ошибки
            }
            // setLoadingState('creditHistory', false); // Перемещено в renderCreditHistory

            console.log("[MAIN] loadDashboardData: Data načtena a zobrazena.");

        } catch (error) {
            console.error('[MAIN] loadDashboardData: Zachycena hlavní chyba:', error);
            showError('Nepodařilo se kompletně načíst data nástěnky: ' + error.message);
            // Попытка отобразить хоть что-то
            updateStatsCards(currentProfile); // Данные из профиля
            renderActivities(null);
            renderNotifications(0, []);
            renderCreditHistory(null);
        } finally {
            // Финальное снятие всех состояний загрузки, если что-то осталось
            setLoadingState('stats', false);
            setLoadingState('activities', false);
            setLoadingState('notifications', false);
            setLoadingState('creditHistory', false);
            if (typeof initTooltips === 'function') initTooltips();
            console.log("[MAIN] loadDashboardData: Blok finally dokončen.");
        }
    }
    // --- END: Main Data Loading ---

    // --- START: Event Listeners Setup ---
    function setupEventListeners() { /* ... (same as before, from previous script) ... */ console.log("[SETUP] setupUIEventListeners: Start"); if (!ui || Object.keys(ui).length === 0) { console.error("[SETUP] UI cache is empty! Cannot setup listeners."); return; } const listenersAdded = new Set(); const safeAddListener = (element, eventType, handler, key) => { if (element) { element.removeEventListener(eventType, handler); element.addEventListener(eventType, handler); listenersAdded.add(key); } else { console.warn(`[SETUP] Element not found for listener: ${key}`); } }; safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle'); safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle'); safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay'); safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn'); document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); }); safeAddListener(ui.startPracticeBtn, 'click', () => { window.location.href = '/dashboard/procvicovani/main.html'; }, 'startPracticeBtn'); safeAddListener(ui.openMonthlyModalBtn, 'click', () => showModal('monthly-reward-modal'), 'openMonthlyModalBtn'); safeAddListener(ui.openStreakModalBtn, 'click', () => showModal('streak-milestones-modal'), 'openStreakModalBtn'); safeAddListener(ui.refreshDataBtn, 'click', async () => { if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; ui.refreshDataBtn.disabled = true; await loadDashboardData(currentUser, currentProfile); if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; ui.refreshDataBtn.disabled = false; }, 'refreshDataBtn'); safeAddListener(ui.notificationBell, 'click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell'); safeAddListener(ui.markAllReadBtn, 'click', markAllNotificationsRead, 'markAllReadBtn'); safeAddListener(ui.notificationsList, 'click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount?.textContent?.replace('+', '') || '0'; const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); if(ui.notificationCount) { ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); } if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }, 'notificationsList'); document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown?.classList.remove('active'); } }); safeAddListener(ui.closeMonthlyModalBtn, 'click', () => hideModal('monthly-reward-modal'), 'closeMonthlyModalBtn'); safeAddListener(ui.monthlyRewardModal, 'click', (event) => { if (event.target === ui.monthlyRewardModal) { hideModal('monthly-reward-modal'); } }, 'monthlyRewardModal'); safeAddListener(ui.closeStreakModalBtn, 'click', () => hideModal('streak-milestones-modal'), 'closeStreakModalBtn'); safeAddListener(ui.streakMilestonesModal, 'click', (event) => { if (event.target === ui.streakMilestonesModal) { hideModal('streak-milestones-modal'); } }, 'streakMilestonesModal'); window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus); if (ui.mainContent) ui.mainContent.addEventListener('scroll', initHeaderScrollDetection, { passive: true }); console.log(`[SETUP] Event listeners set up. Added: ${[...listenersAdded].length}`); }
    // --- END: Event Listeners Setup ---

    // --- START: App Initialization ---
    async function initializeApp() { /* ... (same as before, from previous script) ... */ console.log("[INIT Dashboard] initializeApp: Start v24.9 - Detailní ladění fetchRecentActivities"); cacheDOMElements(); const waitForSupabase = new Promise((resolve, reject) => { const maxAttempts = 10; let attempts = 0; const intervalId = setInterval(() => { attempts++; if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') { console.log(`[INIT Dashboard] Supabase library found after ${attempts} attempts.`); clearInterval(intervalId); resolve(); } else if (attempts >= maxAttempts) { console.error("[INIT Dashboard] Supabase library not found after waiting. Aborting."); clearInterval(intervalId); reject(new Error("Knihovna Supabase nebyla nalezena včas.")); } else { console.log(`[INIT Dashboard] Waiting for Supabase library... (Attempt ${attempts}/${maxAttempts})`); } }, 200); }); try { await waitForSupabase; } catch (waitError) { showError(waitError.message, true); if(ui.initialLoader) ui.initialLoader.classList.add('hidden'); return; } if (!initializeSupabase()) { console.error("[INIT Dashboard] Supabase init function failed. Aborting."); return; } applyInitialSidebarState(); setupEventListeners(); if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; } if (ui.mainContent) ui.mainContent.style.display = 'none'; try { console.log("[INIT Dashboard] Checking auth session..."); const { data: { session }, error: sessionError } = await supabase.auth.getSession(); if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`); if (session?.user) { currentUser = session.user; console.log(`[INIT Dashboard] User authenticated (ID: ${currentUser.id}). Loading profile and titles...`); const [profileResult, titlesResult] = await Promise.allSettled([ fetchUserProfile(currentUser.id), fetchTitles() ]); if (profileResult.status === 'fulfilled' && profileResult.value) { currentProfile = profileResult.value; console.log("[INIT Dashboard] Profile loaded:", currentProfile); } else { console.warn("[INIT Dashboard] Profile not found or fetch failed, attempting to create default..."); currentProfile = await createDefaultProfile(currentUser.id, currentUser.email); if (!currentProfile) throw new Error("Nepodařilo se vytvořit/načíst profil uživatele."); console.log("[INIT Dashboard] Default profile created/retrieved."); } if (titlesResult.status === 'fulfilled') { allTitles = titlesResult.value || []; console.log("[INIT Dashboard] Titles loaded:", allTitles.length); } else { console.warn("[INIT Dashboard] Failed to load titles:", titlesResult.reason); allTitles = []; } updateSidebarProfile(currentProfile); updateCopyrightYear(); updateOnlineStatus(); await loadDashboardData(currentUser, currentProfile); if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); } if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); } initMouseFollower(); initHeaderScrollDetection(); initTooltips(); const readyEvent = new CustomEvent('dashboardReady', { detail: { user: currentUser, profile: currentProfile, client: supabase, titles: allTitles } }); document.dispatchEvent(readyEvent); console.log("[INIT Dashboard] Dispatching 'dashboardReady' event."); console.log("✅ [INIT Dashboard] Page fully loaded and initialized."); } else { console.log('[INIT Dashboard] V sezení není uživatel, přesměrování.'); window.location.href = '/auth/index.html'; } } catch (error) { console.error("❌ [INIT Dashboard] Kritická chyba inicializace:", error); if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE.</p>`; } else { showError(`Chyba inicializace: ${error.message}`, true); } if (ui.mainContent) ui.mainContent.style.display = 'none'; setLoadingState('all', false); } }
    // --- END: App Initialization ---

    // --- START THE APP ---
    initializeApp();

})();