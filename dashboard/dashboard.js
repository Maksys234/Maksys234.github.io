// dashboard.js
// Using an immediately invoked function expression (IIFE) to scope variables
(function() {
    'use strict'; // Add strict mode

    // --- START: Initialization and Configuration ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = [];
    let isLoading = { stats: false, activities: false, notifications: false, titles: false, dailyReward: false }; // Added dailyReward
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
    const DAILY_REWARD_BASE = 100; // Base credits per day of streak

    // DOM Elements Cache
    const ui = {
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
        progressCard: document.getElementById('progress-card'),
        pointsCard: document.getElementById('points-card'),
        streakCard: document.getElementById('streak-card'),
        activityListContainer: document.getElementById('activity-list-container'),
        activityList: document.getElementById('activity-list'),
        activityListEmptyState: document.querySelector('#activity-list-container .empty-state'),
        activityListErrorState: document.querySelector('#activity-list-container .card-error-state'),
        toastContainer: document.getElementById('toast-container'),
        globalError: document.getElementById('global-error'),
        offlineBanner: document.getElementById('offline-banner'),
        mouseFollower: document.getElementById('mouse-follower'),
        currentYearSidebar: document.getElementById('currentYearSidebar'),
        currentYearFooter: document.getElementById('currentYearFooter'),
        // --- NEW: Daily Reward UI Elements ---
        dailyRewardCard: document.getElementById('daily-reward-card'),
        dailyRewardDay: document.getElementById('daily-reward-day'),
        dailyRewardAmount: document.getElementById('daily-reward-amount'),
        claimRewardBtn: document.getElementById('claim-reward-btn')
        // --- END: Daily Reward UI Elements ---
    };

    // Visual settings for activities (No change)
    const activityVisuals = {
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

    // --- START: Helper Functions (No change unless necessary) ---
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Obnovit Stránku</button></div>`; ui.globalError.style.display = 'block'; const retryBtn = document.getElementById('global-retry-btn'); if (retryBtn) { retryBtn.addEventListener('click', () => { location.reload(); }); } } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function setLoadingState(section, isLoadingFlag) {
         const sections = section === 'all' ? Object.keys(isLoading) : [section];
         sections.forEach(sec => {
             if (isLoading[sec] === isLoadingFlag && section !== 'all') return;
             isLoading[sec] = isLoadingFlag;
             console.log(`[setLoadingState] Section: ${sec}, isLoading: ${isLoadingFlag}`);
             if (sec === 'stats') { [ui.progressCard, ui.pointsCard, ui.streakCard].forEach(card => card?.classList.toggle('loading', isLoadingFlag)); }
             else if (sec === 'activities' && ui.activityListContainer) { ui.activityListContainer.classList.toggle('loading', isLoadingFlag); if (isLoadingFlag) { renderActivitySkeletons(5); if(ui.activityListEmptyState) ui.activityListEmptyState.style.display = 'none'; if(ui.activityListErrorState) ui.activityListErrorState.style.display = 'none'; if(ui.activityList) ui.activityList.innerHTML = ''; } }
             else if (sec === 'notifications' && ui.notificationBell) { ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1; if(ui.markAllReadBtn) { const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0; } if(isLoadingFlag && ui.notificationsList) { renderNotificationSkeletons(2); } }
             // --- NEW: Handle daily reward loading state ---
             else if (sec === 'dailyReward' && ui.dailyRewardCard) { ui.dailyRewardCard.classList.toggle('loading', isLoadingFlag); if (ui.claimRewardBtn) ui.claimRewardBtn.disabled = isLoadingFlag; }
             // --- END ---
         });
     }
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }); animatedElements.forEach(element => observer.observe(element)); };
    const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 50); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl && mainEl.scrollTop > 50) document.body.classList.add('scrolled'); };
    const updateCopyrightYear = () => { const currentYearSpan = document.getElementById('currentYearFooter'); const currentYearSidebar = document.getElementById('currentYearSidebar'); const year = new Date().getFullYear(); if (currentYearSpan) { currentYearSpan.textContent = year; } if (currentYearSidebar) { currentYearSidebar.textContent = year; } };
    function applyInitialSidebarState() { const savedState = localStorage.getItem(SIDEBAR_STATE_KEY); const shouldBeCollapsed = savedState === 'collapsed'; if (shouldBeCollapsed) { document.body.classList.add('sidebar-collapsed'); } else { document.body.classList.remove('sidebar-collapsed'); } const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) { icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; } console.log(`[Sidebar State] Initial state applied: ${shouldBeCollapsed ? 'collapsed' : 'expanded'}`); }
    function toggleSidebar() { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn?.querySelector('i'); if (icon) { icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; } console.log(`[Sidebar Toggle] Sidebar toggled. New state: ${isCollapsed ? 'collapsed' : 'expanded'}`); }
    // *** NEW: initTooltips Function Definition ***
    function initTooltips() {
        console.log("[Tooltips] Initializing...");
        try {
            if (window.jQuery && typeof window.jQuery.fn.tooltipster === 'function') {
                window.jQuery('.btn-tooltip.tooltipstered').each(function() { if (document.body.contains(this)) { try { window.jQuery(this).tooltipster('destroy'); } catch (destroyError) { console.warn("Tooltipster destroy error:", destroyError); } } });
                window.jQuery('.btn-tooltip').tooltipster({
                    theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top'
                });
                console.log("[Tooltips] Initialized/Re-initialized.");
            } else { console.warn("[Tooltips] jQuery or Tooltipster library not loaded."); }
        } catch (e) { console.error("[Tooltips] Error initializing Tooltipster:", e); }
    }
    // --- NEW: Date Comparison Helper ---
    function isSameDate(date1, date2) {
        if (!date1 || !date2) return false;
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    }
    function isYesterday(date1, date2) {
        if (!date1 || !date2) return false;
        const yesterday = new Date(date2);
        yesterday.setDate(yesterday.getDate() - 1);
        return isSameDate(date1, yesterday);
    }
    // --- END: Helper Functions ---

    // --- START: Data Loading and Processing Functions ---
    function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Knihovna Supabase nebyla správně načtena."); } supabase = window.supabase.createClient(supabaseUrl, supabaseKey); if (!supabase) throw new Error("Vytvoření klienta Supabase selhalo."); console.log('[Supabase] Klient úspěšně inicializován.'); return true; } catch (error) { console.error('[Supabase] Inicializace selhala:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }

    async function fetchUserProfile(userId) {
        if (!supabase || !userId) return null;
        console.log(`[Profile] Načítání profilu pro uživatele ID: ${userId}`);
        try {
            // Fetch needed fields, including the new last_reward_claimed_at
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*, selected_title, last_login, streak_days, last_reward_claimed_at') // ADD last_reward_claimed_at
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') { throw error; }
            if (!profile) { console.warn(`[Profile] Profil nenalezen pro uživatele ${userId}. Returning null.`); return null; }
            console.log("[Profile] Data profilu úspěšně načtena.");
            return profile;
        } catch (error) { console.error('[Profile] Výjimka při načítání profilu:', error); return null; }
    }

    async function createDefaultProfile(userId, userEmail) {
        if (!supabase || !userId || !userEmail) return null;
        console.log(`[Profile Create] Creating default profile for user ${userId}`);
        try {
            const defaultData = {
                 id: userId, email: userEmail, username: userEmail.split('@')[0] || `user_${userId.substring(0, 6)}`,
                 level: 1, points: 0, experience: 0, badges_count: 0, streak_days: 0,
                 last_login: new Date().toISOString(), // Set initial login
                 last_reward_claimed_at: null, // Reward not claimed initially
                 created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                 preferences: { dark_mode: window.matchMedia('(prefers-color-scheme: dark)').matches, language: 'cs' },
                 notifications: { email: true, study_tips: true, content_updates: true, practice_reminders: true }
            };
            const { data: newProfile, error } = await supabase
                .from('profiles')
                .insert(defaultData)
                .select('*, selected_title, last_login, streak_days, last_reward_claimed_at') // Select new fields
                .single();
            if (error) { if (error.code === '23505') { console.warn("[Profile Create] Profile likely already exists, fetching again."); return await fetchUserProfile(userId); } throw error; }
            console.log("[Profile Create] Default profile created:", newProfile);
            return newProfile;
        } catch (error) { console.error("[Profile Create] Failed to create default profile:", error); return null; }
    }

    async function fetchTitles() {
        if (!supabase) return [];
        console.log("[Titles] Fetching available titles...");
        setLoadingState('titles', true);
        try {
            const { data, error } = await supabase.from('title_shop').select('title_key, name');
            if (error) throw error;
            console.log("[Titles] Fetched titles:", data);
            return data || [];
        } catch (error) { console.error("[Titles] Error fetching titles:", error); return []; }
        finally { setLoadingState('titles', false); }
    }

    async function fetchUserStats(userId, profileData) { if (!supabase || !userId || !profileData) { console.error("[Stats] Chybí Supabase klient, ID uživatele nebo data profilu."); return null; } console.log(`[Stats] Načítání statistik pro uživatele ${userId}...`); let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats] Chyba Supabase při načítání user_stats:", statsError.message); } } catch (error) { console.error("[Stats] Neočekávaná chyba při načítání user_stats:", error); statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0 }; if (statsError) { console.warn("[Stats] Vracení statistik primárně z profilu kvůli chybě načítání."); } else { console.log("[Stats] Statistiky úspěšně načteny/sestaveny:", finalStats); } return finalStats; }
    async function fetchRecentActivities(userId, limit = 5) { if (!supabase || !userId) { console.error("[Activities] Chybí Supabase nebo ID uživatele."); return []; } console.log(`[Activities] Načítání posledních ${limit} aktivit pro uživatele ${userId}`); try { const { data, error } = await supabase .from('activities') .select('*') .eq('user_id', userId) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; console.log(`[Activities] Načteno ${data?.length || 0} aktivit.`); return data || []; } catch (error) { console.error('[Activities] Výjimka při načítání aktivit:', error); return []; } }
    async function fetchNotifications(userId, limit = 5) { if (!supabase || !userId) { console.error("[Notifications] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await supabase .from('user_notifications') .select('*', { count: 'exact' }) .eq('user_id', userId) .eq('is_read', false) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; console.log(`[Notifications] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; } }

    // --- NEW: Daily Login & Reward Check ---
    async function handleDailyLoginCheck() {
        if (!currentUser || !currentProfile || !supabase) {
            console.warn("[DailyCheck] Cannot perform daily check: missing user, profile, or supabase.");
            return;
        }
        console.log("[DailyCheck] Performing daily login check...");
        const today = new Date();
        const lastLogin = currentProfile.last_login ? new Date(currentProfile.last_login) : null;
        const lastClaimed = currentProfile.last_reward_claimed_at ? new Date(currentProfile.last_reward_claimed_at) : null;
        let currentStreak = currentProfile.streak_days || 0;
        let canClaimToday = false;
        let rewardAmount = 0;
        let updateData = {};

        if (!lastLogin || !isSameDate(today, lastLogin)) {
            // First login today
            console.log("[DailyCheck] First login of the day.");
            if (lastLogin && isYesterday(lastLogin, today)) {
                // Consecutive day
                currentStreak++;
                console.log(`[DailyCheck] Streak continued! New streak: ${currentStreak}`);
            } else if (lastLogin) {
                // Missed a day or more
                currentStreak = 1;
                console.log("[DailyCheck] Streak broken. Resetting to 1.");
            } else {
                // Very first login ever
                currentStreak = 1;
                console.log("[DailyCheck] First login ever. Setting streak to 1.");
            }
            updateData.streak_days = currentStreak;
            updateData.last_login = today.toISOString();
            canClaimToday = true; // Can claim on the first login of the day
        } else {
            // Already logged in today
            console.log("[DailyCheck] Already logged in today.");
            currentStreak = currentProfile.streak_days || 0; // Use existing streak
            // Check if reward for today was already claimed
            canClaimToday = !lastClaimed || !isSameDate(today, lastClaimed);
        }

        if (canClaimToday) {
            rewardAmount = DAILY_REWARD_BASE * currentStreak;
            console.log(`[DailyCheck] Reward available: Day ${currentStreak}, Amount ${rewardAmount}`);
        } else {
             console.log("[DailyCheck] Reward for today already claimed or not available.");
             rewardAmount = 0;
        }

        // Update profile if needed (streak or last_login changed)
        if (Object.keys(updateData).length > 0) {
             console.log("[DailyCheck] Updating profile with:", updateData);
            try {
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update(updateData)
                    .eq('id', currentUser.id);
                if (updateError) throw updateError;
                // Update local profile state
                currentProfile.streak_days = updateData.streak_days ?? currentProfile.streak_days;
                currentProfile.last_login = updateData.last_login ?? currentProfile.last_login;
                console.log("[DailyCheck] Profile updated successfully.");
            } catch (error) {
                console.error("[DailyCheck] Error updating profile:", error);
                showToast('Chyba', 'Nepodařilo se aktualizovat data přihlášení.', 'error');
            }
        }

        // Update the UI for daily reward
        updateDailyRewardUI(canClaimToday, currentStreak, rewardAmount);

         // Update streak card UI immediately (using possibly updated local profile)
         updateStreakCardUI(currentProfile.streak_days);
    }
    // --- END: Daily Login & Reward Check ---

    // --- NEW: Claim Reward Logic ---
    async function claimDailyReward() {
        if (!currentUser || !currentProfile || !supabase || isLoading.dailyReward) return;
        console.log("[ClaimReward] Attempting to claim reward...");
        setLoadingState('dailyReward', true);
        if (ui.claimRewardBtn) ui.claimRewardBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Zpracování...';

        const today = new Date();
        const lastClaimed = currentProfile.last_reward_claimed_at ? new Date(currentProfile.last_reward_claimed_at) : null;

        if (lastClaimed && isSameDate(today, lastClaimed)) {
            showToast("Odměna již byla vyzvednuta", "Dnešní odměnu jste si již vyzvedli.", "info");
            setLoadingState('dailyReward', false);
            if (ui.claimRewardBtn) { ui.claimRewardBtn.textContent = 'Dnes Vyzvednuto'; ui.claimRewardBtn.disabled = true; }
            return;
        }

        const currentStreak = currentProfile.streak_days || 1; // Use 1 if streak is 0 somehow
        const rewardAmount = DAILY_REWARD_BASE * currentStreak;
        const currentPoints = currentProfile.points || 0;
        const newPoints = currentPoints + rewardAmount;

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    points: newPoints,
                    last_reward_claimed_at: today.toISOString()
                })
                .eq('id', currentUser.id);
            if (updateError) throw updateError;

            // Update local state
            currentProfile.points = newPoints;
            currentProfile.last_reward_claimed_at = today.toISOString();

            console.log(`[ClaimReward] Reward claimed! Amount: ${rewardAmount}, New total: ${newPoints}`);
            showToast("Odměna Vyzvednuta!", `+ ${rewardAmount} kreditů přidáno. Nový zůstatek: ${newPoints}`, "success");

            // Update UI elements
            updatePointsCardUI(newPoints);
            updateDailyRewardUI(false, currentStreak, 0); // Update reward UI to 'claimed' state

        } catch (error) {
            console.error("[ClaimReward] Error claiming reward:", error);
            showToast("Chyba", "Nepodařilo se vyzvednout odměnu.", "error");
             if (ui.claimRewardBtn) ui.claimRewardBtn.innerHTML = '<i class="fas fa-gift"></i> Vyzvednout'; // Reset button text on error
        } finally {
            setLoadingState('dailyReward', false);
        }
    }
    // --- END: Claim Reward Logic ---


    async function loadDashboardData(user, profile) {
         if (!user || !profile) { showError("Chyba: Nelze načíst data bez profilu uživatele."); setLoadingState('all', false); return; }
         console.log("[MAIN] loadDashboardData: Start pro uživatele:", user.id);
         hideError();
         setLoadingState('all', true);
         renderActivitySkeletons(5);

         // --- ADDED: Perform daily login check before fetching other data ---
         await handleDailyLoginCheck();
         // --- END ADDED ---

         try {
             updateSidebarProfile(profile); // Update sidebar (already has profile data)
             console.log("[MAIN] loadDashboardData: Načítání statistik, aktivit, oznámení souběžně...");
             const results = await Promise.allSettled([
                 fetchUserStats(user.id, profile),
                 fetchRecentActivities(user.id, 5),
                 fetchNotifications(user.id, 5)
             ]);
             console.log("[MAIN] loadDashboardData: Souběžné načítání dokončeno:", results);

             if (results[0].status === 'fulfilled') { updateStatsCards(results[0].value || profile); }
             else { console.error("❌ Chyba při načítání statistik uživatele:", results[0].reason); showError("Nepodařilo se načíst statistiky."); updateStatsCards(profile); }
             setLoadingState('stats', false);

             if (results[1].status === 'fulfilled') { renderActivities(results[1].value || []); }
             else { console.error("❌ Chyba při načítání nedávných aktivit:", results[1].reason); showError("Nepodařilo se načíst nedávné aktivity."); renderActivities(null); }
             setLoadingState('activities', false);

             if (results[2].status === 'fulfilled') { const { unreadCount, notifications } = results[2].value || { unreadCount: 0, notifications: [] }; renderNotifications(unreadCount, notifications); }
             else { console.error("❌ Chyba při načítání oznámení:", results[2].reason); showError("Nepodařilo se načíst oznámení."); renderNotifications(0, []); }
             setLoadingState('notifications', false);

             console.log("[MAIN] loadDashboardData: Všechna data zpracována.");
         } catch (error) { console.error('[MAIN] loadDashboardData: Zachycena hlavní chyba:', error); showError('Nepodařilo se kompletně načíst data nástěnky: ' + error.message); setLoadingState('all', false); updateStatsCards(profile); renderActivities(null); renderNotifications(0, []); }
     }
    // --- END: Data Loading ---

    // --- START: UI Update Functions ---
    function updateSidebarProfile(profile) {
        console.log("[UI Update] Aktualizace sidebaru...");
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[UI Update] Elementy sidebaru nenalezeny."); return; }
        if (profile) {
            const firstName = profile.first_name ?? '';
            const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(profile);
            const avatarUrl = profile.avatar_url;
            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
            const selectedTitleKey = profile.selected_title;
            let displayTitle = 'Pilot';
            if (selectedTitleKey && allTitles && allTitles.length > 0) { const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) { displayTitle = foundTitle.name; } else { console.warn(`[UI Update] Title with key "${selectedTitleKey}" not found.`); } } else if (selectedTitleKey) { console.warn(`[UI Update] Selected title key "${selectedTitleKey}" exists but titles not loaded.`); }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle));
            if (ui.welcomeTitle) { ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`; }
            console.log("[UI Update] Sidebar aktualizován.");
        } else { console.warn("[UI Update] Chybí data profilu."); ui.sidebarName.textContent = "Pilot"; ui.sidebarAvatar.textContent = '?'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title'); if (ui.welcomeTitle) { ui.welcomeTitle.textContent = `Vítejte!`; } }
    }
    function updateStatsCards(stats) { console.log("[UI Update] Aktualizace karet statistik:", stats); const statElements = { progress: ui.progressCard?.querySelector('.stat-card-value'), progressChange: ui.progressCard?.querySelector('.stat-card-change'), points: ui.pointsCard?.querySelector('.stat-card-value'), pointsChange: ui.pointsCard?.querySelector('.stat-card-change'), streak: ui.streakCard?.querySelector('.stat-card-value'), streakLongest: ui.streakCard?.querySelector('.stat-card-change') }; const cards = [ui.progressCard, ui.pointsCard, ui.streakCard]; const displayError = (cardElement) => { if (cardElement) { const content = cardElement.querySelector('.stat-card-content'); const skel = cardElement.querySelector('.loading-skeleton'); const errorState = cardElement.querySelector('.card-error-state'); if (!errorState) { const errorDiv = document.createElement('div'); errorDiv.className = 'card-error-state'; errorDiv.style.display = 'block'; errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Chyba</p>`; cardElement.appendChild(errorDiv); } else { errorState.style.display = 'block'; } if(content) content.style.visibility = 'hidden'; if(skel) skel.style.display = 'none'; cardElement.classList.remove('loading'); } }; if (!stats) { console.warn("[UI Update] Chybí data statistik, zobrazení chybového stavu."); cards.forEach(displayError); return; } cards.forEach(card => { if (card) { const skel = card.querySelector('.loading-skeleton'); const cont = card.querySelector('.stat-card-content'); card.querySelector('.card-error-state')?.remove(); if(skel) skel.style.display = 'none'; if(cont) cont.style.visibility = 'visible'; card.classList.remove('loading'); } }); if (statElements.progress && statElements.progressChange) { statElements.progress.textContent = `${stats.progress ?? 0}%`; const weeklyChange = stats.progress_weekly ?? 0; statElements.progressChange.classList.remove('positive', 'negative'); statElements.progressChange.innerHTML = weeklyChange > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyChange}% týdně` : weeklyChange < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyChange}% týdně` : `<i class="fas fa-minus"></i> --`; if (weeklyChange > 0) statElements.progressChange.classList.add('positive'); else if (weeklyChange < 0) statElements.progressChange.classList.add('negative'); } updatePointsCardUI(stats.points, stats.points_weekly); updateStreakCardUI(stats.streak_current, stats.streak_longest); console.log("[UI Update] Karty statistik aktualizovány."); }
    function updatePointsCardUI(points, weeklyPoints = null) { const statElements = { points: ui.pointsCard?.querySelector('.stat-card-value'), pointsChange: ui.pointsCard?.querySelector('.stat-card-change') }; if (statElements.points) { statElements.points.textContent = points ?? 0; } if (statElements.pointsChange && weeklyPoints !== null) { statElements.pointsChange.classList.remove('positive', 'negative'); statElements.pointsChange.innerHTML = weeklyPoints > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyPoints} týdně` : weeklyPoints < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyPoints} týdně` : `<i class="fas fa-minus"></i> --`; if (weeklyPoints > 0) statElements.pointsChange.classList.add('positive'); else if (weeklyPoints < 0) statElements.pointsChange.classList.add('negative'); } }
    function updateStreakCardUI(currentStreak, longestStreak = null) { const statElements = { streak: ui.streakCard?.querySelector('.stat-card-value'), streakLongest: ui.streakCard?.querySelector('.stat-card-change') }; if (statElements.streak) { statElements.streak.textContent = currentStreak ?? 0; } if (statElements.streakLongest && longestStreak !== null) { statElements.streakLongest.textContent = `MAX: ${longestStreak ?? 0} dní`; statElements.streakLongest.classList.remove('positive', 'negative'); } }
    function renderActivities(activities) { if (!ui.activityList || !ui.activityListContainer || !ui.activityListEmptyState || !ui.activityListErrorState) { console.error("[Render Activities] Chybí UI elementy."); setLoadingState('activities', false); return; } ui.activityList.innerHTML = ''; ui.activityListEmptyState.style.display = 'none'; ui.activityListErrorState.style.display = 'none'; if (activities === null) { ui.activityListErrorState.style.display = 'block'; console.log("[Render Activities] Zobrazení chybového stavu (null data)."); setLoadingState('activities', false); return; } if (activities.length === 0) { ui.activityListEmptyState.style.display = 'block'; console.log("[Render Activities] Zobrazení prázdného stavu."); setLoadingState('activities', false); return; } const fragment = document.createDocumentFragment(); activities.forEach(activity => { const visual = activityVisuals[activity.type?.toLowerCase()] || activityVisuals.default; const title = sanitizeHTML(activity.title || 'Neznámá aktivita'); const description = sanitizeHTML(activity.description || ''); const timeAgo = formatRelativeTime(activity.created_at); const item = document.createElement('div'); item.className = 'activity-item'; item.innerHTML = `<div class="activity-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="activity-content"><div class="activity-title">${title}</div><div class="activity-desc">${description}</div><div class="activity-time"><i class="far fa-clock"></i> ${timeAgo}</div></div>`; fragment.appendChild(item); }); ui.activityList.appendChild(fragment); ui.activityListContainer.classList.remove('loading'); console.log(`[Render Activities] Vykresleno ${activities.length} položek.`); setLoadingState('activities', false); }
    function renderActivitySkeletons(count = 5) { if (!ui.activityList || !ui.activityListContainer) return; ui.activityListContainer.classList.add('loading'); ui.activityList.innerHTML = ''; let skeletonHTML = '<div class="loading-placeholder">'; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="skeleton-activity-item"> <div class="skeleton icon-placeholder"></div> <div style="flex-grow: 1;"> <div class="skeleton activity-line"></div> <div class="skeleton activity-line text-short"></div> <div class="skeleton activity-line-short"></div> </div> </div>`; } skeletonHTML += '</div>'; ui.activityList.innerHTML = skeletonHTML; }
    function renderNotifications(count, notifications) { console.log("[Render Notifications] Start, Počet:", count, "Oznámení:", notifications); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Chybí UI elementy."); setLoadingState('notifications', false); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const iconMap = { info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-triangle', danger: 'fa-exclamation-circle', badge: 'fa-medal', level_up: 'fa-angle-double-up' }; const iconClass = iconMap[n.type] || 'fa-info-circle'; const typeClass = n.type || 'info'; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${typeClass}"><i class="fas ${iconClass}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } console.log("[Render Notifications] Hotovo"); setLoadingState('notifications', false); }
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    // --- NEW: Render Daily Reward UI ---
    function updateDailyRewardUI(canClaim, streak, rewardAmount) {
        if (!ui.dailyRewardCard || !ui.dailyRewardDay || !ui.dailyRewardAmount || !ui.claimRewardBtn) {
            console.warn("[DailyReward UI] Missing elements. Cannot update.");
            if (ui.dailyRewardCard) ui.dailyRewardCard.style.display = 'none'; // Hide if elements missing
            return;
        }

        console.log(`[DailyReward UI] Updating: canClaim=${canClaim}, streak=${streak}, reward=${rewardAmount}`);
        ui.dailyRewardCard.style.display = 'block'; // Make sure card is visible

        if (canClaim) {
            ui.dailyRewardDay.textContent = `${streak}. den`;
            ui.dailyRewardAmount.textContent = `${rewardAmount}`;
            ui.claimRewardBtn.disabled = false;
            ui.claimRewardBtn.innerHTML = '<i class="fas fa-gift"></i> Vyzvednout';
            ui.dailyRewardCard.classList.remove('claimed');
            ui.dailyRewardCard.classList.add('available');
        } else {
            // Reward already claimed or streak broken (handled by streak value)
            ui.dailyRewardDay.textContent = `${streak > 0 ? streak : '?'}. den`; // Show current streak or '?'
            ui.dailyRewardAmount.textContent = '---'; // Placeholder
            ui.claimRewardBtn.disabled = true;
            ui.claimRewardBtn.innerHTML = '<i class="fas fa-check-circle"></i> Dnes Vyzvednuto';
            ui.dailyRewardCard.classList.add('claimed');
            ui.dailyRewardCard.classList.remove('available');
        }
         setLoadingState('dailyReward', false); // Ensure loading state is off
    }
    // --- END: UI Update ---

    // --- START: Notification Logic ---
    async function markNotificationRead(notificationId) { console.log("[FUNC] markNotificationRead: Označení ID:", notificationId); if (!currentUser || !notificationId || !supabase) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[FUNC] markNotificationRead: Úspěch pro ID:", notificationId); return true; } catch (error) { console.error("[FUNC] markNotificationRead: Chyba:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { console.log("[FUNC] markAllNotificationsRead: Start pro uživatele:", currentUser?.id); if (!currentUser || !ui.markAllReadBtn || !supabase) return; setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; ui.markAllReadBtn.textContent = 'MAŽU...'; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false); if (error) throw error; console.log("[FUNC] markAllNotificationsRead: Úspěch"); const { unreadCount, notifications } = await fetchNotifications(currentUser.id, 5); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[FUNC] markAllNotificationsRead: Chyba:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); } finally { setLoadingState('notifications', false); if(ui.markAllReadBtn) ui.markAllReadBtn.textContent = 'Vymazat vše'; } }
    // --- END: Notification Logic ---

    // --- START: Event Listeners ---
    function setupUIEventListeners() {
         console.log("[SETUP] setupUIEventListeners: Start");
         if (ui.startPracticeBtn) ui.startPracticeBtn.addEventListener('click', () => { window.location.href = '/dashboard/procvicovani/main.html'; });
         if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
         if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
         if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
         if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);
         document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });
         window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus);
         updateOnlineStatus();
         if (ui.refreshDataBtn) { ui.refreshDataBtn.addEventListener('click', async () => { if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; ui.refreshDataBtn.disabled = true; await loadDashboardData(currentUser, currentProfile); if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; ui.refreshDataBtn.disabled = false; }); }
         if(ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
         if(ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); }
         if(ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? newCount : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }); }
         document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown?.classList.remove('active'); } });

         // --- NEW: Claim Reward Button Listener ---
         if (ui.claimRewardBtn) {
             ui.claimRewardBtn.addEventListener('click', claimDailyReward);
         }
         // --- END NEW ---

         console.log("[SETUP] setupUIEventListeners: Posluchači nastaveni.");
     }
    // --- END: Event Listeners ---

    // --- START THE APP ---
    async function initializeApp() {
        console.log("[INIT Dashboard] initializeApp: Start");
        if (!initializeSupabase()) { console.error("[INIT Dashboard] Supabase initialization failed. Aborting."); return; }

        // Setup base listeners first
        setupUIEventListeners();
        applyInitialSidebarState(); // Apply sidebar state early

        if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; }
        if (ui.mainContent) ui.mainContent.style.display = 'none';

        try {
            console.log("[INIT Dashboard] Checking auth session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;
                console.log(`[INIT Dashboard] User authenticated (ID: ${currentUser.id}). Loading profile and titles...`);

                // Fetch profile and titles concurrently
                const [profileResult, titlesResult] = await Promise.allSettled([
                    fetchUserProfile(currentUser.id), // Now fetches reward/login info
                    fetchTitles()
                ]);

                if (profileResult.status === 'fulfilled' && profileResult.value) {
                    currentProfile = profileResult.value;
                    console.log("[INIT Dashboard] Profile loaded:", currentProfile);
                } else {
                    console.warn("[INIT Dashboard] Profile not found or fetch failed, attempting to create default...");
                    currentProfile = await createDefaultProfile(currentUser.id, currentUser.email); // Creates with reward info
                    if (!currentProfile) throw new Error("Nepodařilo se vytvořit/načíst profil uživatele.");
                    console.log("[INIT Dashboard] Default profile created/retrieved.");
                }

                if (titlesResult.status === 'fulfilled') {
                    allTitles = titlesResult.value || [];
                    console.log("[INIT Dashboard] Titles loaded:", allTitles.length);
                } else { console.warn("[INIT Dashboard] Failed to load titles:", titlesResult.reason); allTitles = []; }

                // Update UI elements that only depend on profile/titles
                updateSidebarProfile(currentProfile);

                // --- MODIFIED: Load dashboard data AFTER profile/title load ---
                await loadDashboardData(currentUser, currentProfile); // This now handles daily login check internally
                // --- END MODIFIED ---

                // Hide loader and show content after data is loaded
                if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
                if (ui.mainContent) {
                    ui.mainContent.style.display = 'block';
                    requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); });
                }
                initMouseFollower();
                initHeaderScrollDetection();
                updateCopyrightYear();
                initTooltips(); // Initialize tooltips after content is loaded

                console.log("✅ [INIT Dashboard] Page fully loaded and initialized.");

            } else {
                console.log('[INIT Dashboard] V sezení není uživatel, přesměrování.');
                window.location.href = '/auth/index.html';
            }
        } catch (error) {
            console.error("❌ [INIT Dashboard] Kritická chyba inicializace:", error);
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE STRÁNKU.</p>`; }
            else { showError(`Chyba inicializace: ${error.message}`, true); }
            if (ui.mainContent) ui.mainContent.style.display = 'none';
             // Reset loading states on critical error
             setLoadingState('all', false);
        }
    } // End of initializeApp

    document.addEventListener('DOMContentLoaded', initializeApp);

})(); // End of IIFE