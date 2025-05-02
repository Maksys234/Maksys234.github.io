// dashboard.js
// Версия: 20 - Новый прототип наград (Месячный + Серия)
(function() {
    'use strict';

    // --- START: Initialization and Configuration ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = []; // Хранилище для титулов

    // Состояния загрузки для разных секций
    let isLoading = {
        stats: false,
        activities: false,
        notifications: false,
        titles: false,
        monthlyRewards: false, // NEW
        streakMilestones: false // NEW
    };
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';

    // --- NEW: Reward Configurations (Placeholders) ---
    const MONTHLY_REWARD_DAYS = 31; // Макс. дней в месяце
    const MILESTONE_REWARDS_CONFIG = { // Пример этапов и наград (пока пустые)
        10: { name: "10 Дней Серии!", description: "Маленький бонус за первую веху.", icon: "fa-star", reward_type: "placeholder", reward_value: 10 },
        30: { name: "Месяц Без Пропусков!", description: "Стабильность вознаграждается.", icon: "fa-calendar-check", reward_type: "placeholder", reward_value: 30 },
        50: { name: "Полсотни Дней!", description: "Вы на полпути к сотне!", icon: "fa-award", reward_type: "placeholder", reward_value: 50 },
        100: { name: "Легендарная Сотня!", description: "Впечатляющая преданность!", icon: "fa-crown", reward_type: "placeholder", reward_value: 100 },
        150: { name: "Ветеран Системы", description: "Вы знаете все ходы!", icon: "fa-shield-alt", reward_type: "placeholder", reward_value: 150 },
        200: { name: "Двойная Сотня!", description: "Продолжайте в том же духе!", icon: "fa-gem", reward_type: "placeholder", reward_value: 200 },
        300: { name: "Почти Год!", description: "Невероятная выдержка!", icon: "fa-trophy", reward_type: "placeholder", reward_value: 300 },
        365: { name: "Годовщина Входа!", description: "Вы истинный пилот Justax!", icon: "fa-rocket", reward_type: "placeholder", reward_value: 365 }
        // Добавь больше по необходимости
    };
    const milestoneDays = Object.keys(MILESTONE_REWARDS_CONFIG).map(Number).sort((a, b) => a - b);

    // DOM Elements Cache (Обновлено для новых секций)
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
        // NEW:
        monthlyCalendarSection: document.getElementById('monthly-calendar-section'),
        monthlyCalendarGrid: document.getElementById('monthly-calendar-grid'),
        monthlyCalendarEmpty: document.getElementById('monthly-calendar-empty'),
        currentMonthYearSpan: document.getElementById('current-month-year'),
        streakMilestonesSection: document.getElementById('streak-milestones-section'),
        streakMilestonesList: document.getElementById('streak-milestones-list'),
        streakMilestonesEmpty: document.getElementById('streak-milestones-empty'),
        currentStreakValueSpan: document.getElementById('current-streak-value')
    };

    // Visual settings for activities (No change)
    const activityVisuals = { /* ... (keep as is) ... */ };
    // --- END: Initialization and Configuration ---

    // --- START: Helper Functions (Keep existing sanitizeHTML, showToast, etc.) ---
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) { /* ... (keep as is) ... */ }
    function showError(message, isGlobal = false) { /* ... (keep as is) ... */ }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function getInitials(userData) { /* ... (keep as is) ... */ }
    function formatRelativeTime(timestamp) { /* ... (keep as is) ... */ }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function updateOnlineStatus() { /* ... (keep as is) ... */ }
    function setLoadingState(section, isLoadingFlag) {
        const sections = section === 'all' ? Object.keys(isLoading) : [section];
        sections.forEach(sec => {
            if (isLoading[sec] === isLoadingFlag && section !== 'all') return;
            isLoading[sec] = isLoadingFlag;
            console.log(`[setLoadingState] Section: ${sec}, isLoading: ${isLoadingFlag}`);

            const loaderOverlay = {
                monthlyRewards: ui.monthlyCalendarSection?.querySelector('.loading-overlay'),
                streakMilestones: ui.streakMilestonesSection?.querySelector('.loading-overlay'),
                activities: ui.activityListContainer, // Uses class toggle
                stats: null, notifications: null, titles: null
            }[sec];

            const contentContainer = {
                monthlyRewards: ui.monthlyCalendarGrid,
                streakMilestones: ui.streakMilestonesList,
                activities: ui.activityList,
                stats: null, notifications: ui.notificationsList, titles: null
            }[sec];

            const emptyStateContainer = {
                 monthlyRewards: ui.monthlyCalendarEmpty,
                 streakMilestones: ui.streakMilestonesEmpty,
                 activities: ui.activityListEmptyState,
                 notifications: ui.noNotificationsMsg
             }[sec];

             const parentSection = { // Main container for the section
                 monthlyRewards: ui.monthlyCalendarSection,
                 streakMilestones: ui.streakMilestonesSection,
                 activities: ui.activityListContainer,
                 stats: null, notifications: null, titles: null
             }[sec];

            // Handle general cards (stats)
            if (sec === 'stats') {
                [ui.progressCard, ui.pointsCard, ui.streakCard].forEach(card => card?.classList.toggle('loading', isLoadingFlag));
            }
            // Handle sections with dedicated overlays and skeletons
            else if (loaderOverlay || parentSection) {
                parentSection?.classList.toggle('loading', isLoadingFlag);
                if (loaderOverlay) loaderOverlay.classList.toggle('hidden', !isLoadingFlag);

                if (isLoadingFlag) {
                    if(contentContainer) contentContainer.innerHTML = ''; // Clear content
                    if(emptyStateContainer) emptyStateContainer.style.display = 'none';
                    // Render skeletons
                    if (sec === 'activities') renderActivitySkeletons(5);
                    else if (sec === 'monthlyRewards') renderMonthlyCalendarSkeletons();
                    else if (sec === 'streakMilestones') renderMilestoneSkeletons();
                    else if (sec === 'notifications') renderNotificationSkeletons(2);
                } else {
                    // Logic to show content or empty state after loading handled by render functions
                    // Ensure skeletons are cleared if render functions don't populate content
                    if (contentContainer && !contentContainer.hasChildNodes() && emptyStateContainer) {
                         emptyStateContainer.style.display = 'block';
                    }
                }
            }
            // Handle notifications bell/button separately
            else if (sec === 'notifications' && ui.notificationBell) {
                 ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                 if(ui.markAllReadBtn) { const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0; }
                 if(isLoadingFlag && ui.notificationsList) { renderNotificationSkeletons(2); }
            }
        });
    }
    const initMouseFollower = () => { /* ... (keep as is) ... */ };
    const initScrollAnimations = () => { /* ... (keep as is) ... */ };
    const initHeaderScrollDetection = () => { /* ... (keep as is) ... */ };
    const updateCopyrightYear = () => { /* ... (keep as is) ... */ };
    function applyInitialSidebarState() { /* ... (keep as is) ... */ }
    function toggleSidebar() { /* ... (keep as is) ... */ }
    function initTooltips() { /* ... (keep as is) ... */ }
    function isSameDate(date1, date2) { /* ... (keep as is) ... */ }
    function isYesterday(date1, date2) { /* ... (keep as is) ... */ }
    // --- NEW: Get current month string ---
    function getCurrentMonthYearString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }
    // --- END: Helper Functions ---

    // --- START: Data Loading and Processing Functions ---
    function initializeSupabase() { /* ... (keep as is) ... */ }

    async function fetchUserProfile(userId) {
        // --- MODIFIED: Select new columns ---
        if (!supabase || !userId) return null;
        console.log(`[Profile] Fetching profile for user ID: ${userId}`);
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*, selected_title, last_login, streak_days, monthly_claims, last_milestone_claimed') // Added new columns
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') { throw error; }
            if (!profile) { console.warn(`[Profile] Profile for ${userId} not found. Returning null.`); return null; }
            // Ensure defaults for new columns if they are null from DB
            profile.monthly_claims = profile.monthly_claims || {};
            profile.last_milestone_claimed = profile.last_milestone_claimed || 0;
            console.log("[Profile] Profile data fetched successfully.");
            return profile;
        } catch (error) { console.error('[Profile] Exception fetching profile:', error); return null; }
    }

    async function createDefaultProfile(userId, userEmail) {
        // --- MODIFIED: Add new columns with defaults ---
        if (!supabase || !userId || !userEmail) return null;
        console.log(`[Profile Create] Creating default profile for user ${userId}`);
        try {
            const defaultData = {
                 id: userId, email: userEmail, username: userEmail.split('@')[0] || `user_${userId.substring(0, 6)}`,
                 level: 1, points: 0, experience: 0, badges_count: 0, streak_days: 0,
                 last_login: new Date().toISOString(),
                 monthly_claims: {}, // Default empty object
                 last_milestone_claimed: 0, // Default 0
                 created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                 preferences: { dark_mode: window.matchMedia('(prefers-color-scheme: dark)').matches, language: 'cs' },
                 notifications: { email: true, study_tips: true, content_updates: true, practice_reminders: true }
            };
            const { data: newProfile, error } = await supabase
                .from('profiles')
                .insert(defaultData)
                .select('*, selected_title, last_login, streak_days, monthly_claims, last_milestone_claimed') // Select new columns too
                .single();
            if (error) { if (error.code === '23505') { console.warn("[Profile Create] Profile likely already exists, fetching again."); return await fetchUserProfile(userId); } throw error; }
            console.log("[Profile Create] Default profile created:", newProfile);
            return newProfile;
        } catch (error) { console.error("[Profile Create] Failed to create default profile:", error); return null; }
    }

    async function fetchTitles() { /* ... (keep as is) ... */ }
    async function fetchUserStats(userId, profileData) { /* ... (keep as is) ... */ }
    async function fetchRecentActivities(userId, limit = 5) { /* ... (keep as is) ... */ }
    async function fetchNotifications(userId, limit = 5) { /* ... (keep as is) ... */ }

    // --- NEW: Check/Update Streak and Login ---
    async function checkAndUpdateLoginStreak() {
        if (!currentUser || !currentProfile || !supabase) { console.warn("[StreakCheck] Cannot perform check: missing user, profile, or supabase."); return false; }
        console.log("[StreakCheck] Performing daily login check/update...");
        const today = new Date();
        const lastLogin = currentProfile.last_login ? new Date(currentProfile.last_login) : null;
        let currentStreak = currentProfile.streak_days || 0;
        let needsDbUpdate = false;
        let updateData = {};
        let currentMonth = getCurrentMonthYearString();

        // Check if it's the first login of the day
        if (!lastLogin || !isSameDate(today, lastLogin)) {
            needsDbUpdate = true;
            console.log("[StreakCheck] First login of the day detected.");
            if (lastLogin && isYesterday(lastLogin, today)) {
                currentStreak++; // Continue streak
                console.log(`[StreakCheck] Streak continued! New streak: ${currentStreak}`);
            } else if (lastLogin) {
                currentStreak = 1; // Streak broken
                console.log("[StreakCheck] Streak broken. Resetting to 1.");
            } else {
                currentStreak = 1; // First login ever
                console.log("[StreakCheck] First login ever. Setting streak to 1.");
            }
            updateData.streak_days = currentStreak;
            updateData.last_login = today.toISOString();
        } else {
            console.log("[StreakCheck] Already logged in today. No streak update needed.");
            currentStreak = currentProfile.streak_days || 0; // Use existing streak from profile
        }

        // Update current streak display immediately
        if (ui.currentStreakValueSpan) {
            ui.currentStreakValueSpan.textContent = currentStreak;
        }
        // Update local profile state for immediate UI consistency
        currentProfile.streak_days = currentStreak;

        // --- Check and Initialize Monthly Claims ---
        // Ensure the monthly_claims object exists
        currentProfile.monthly_claims = currentProfile.monthly_claims || {};
        // Check if data for the *current* month exists. If not, initialize it.
        if (!currentProfile.monthly_claims[currentMonth]) {
            console.log(`[StreakCheck] Initializing claims for new month: ${currentMonth}`);
            currentProfile.monthly_claims[currentMonth] = [];
            // We need to save this initialization back to the DB
            updateData.monthly_claims = currentProfile.monthly_claims;
            needsDbUpdate = true;
        } else {
            console.log(`[StreakCheck] Monthly claims for ${currentMonth} already exist.`);
        }


        // Perform DB update if needed
        if (needsDbUpdate) {
            console.log("[StreakCheck] Updating profile in DB with:", updateData);
            try {
                const { error: updateError } = await supabase.from('profiles').update(updateData).eq('id', currentUser.id);
                if (updateError) throw updateError;
                // Update local profile state fully ONLY if DB update is successful
                if (updateData.last_login) currentProfile.last_login = updateData.last_login;
                console.log("[StreakCheck] Profile updated successfully in DB.");
                return true; // Indicate that an update happened
            } catch (error) {
                console.error("[StreakCheck] Error updating profile:", error);
                showToast('Chyba', 'Nepodařilo se aktualizovat data přihlášení.', 'error');
                return false; // Update failed
            }
        }
        return false; // No update was needed
    }

    // --- NEW: Database update functions ---
    async function updateMonthlyClaimsInDB(newClaimsData) {
        if (!currentUser || !supabase) return false;
        try {
            // IMPORTANT: Supabase JSONB update needs the *entire* object.
            // We update the local currentProfile.monthly_claims first, then save the whole object.
            const { error } = await supabase.from('profiles')
                .update({ monthly_claims: newClaimsData })
                .eq('id', currentUser.id);
            if (error) throw error;
            console.log("[DB Update] Monthly claims updated successfully:", newClaimsData);
            return true;
        } catch (error) {
            console.error("[DB Update] Error updating monthly claims:", error);
            showToast('Chyba Ukládání', 'Nepodařilo se uložit postup měsíčních odměn.', 'error');
            return false;
        }
    }

    async function updateLastMilestoneClaimedInDB(milestoneDay) {
        if (!currentUser || !supabase) return false;
        try {
            const { error } = await supabase.from('profiles')
                .update({ last_milestone_claimed: milestoneDay })
                .eq('id', currentUser.id);
            if (error) throw error;
            console.log(`[DB Update] Last claimed milestone updated to: ${milestoneDay}`);
            return true;
        } catch (error) {
            console.error("[DB Update] Error updating last claimed milestone:", error);
            showToast('Chyba Ukládání', 'Nepodařilo se uložit postup milníkových odměn.', 'error');
            return false;
        }
    }

    // --- Modified Load Function ---
    async function loadDashboardData(user, profile) {
        if (!user || !profile) { showError("Chyba: Nelze načíst data bez profilu uživatele."); setLoadingState('all', false); return; }
        console.log("[MAIN] loadDashboardData: Start pro uživatele:", user.id);
        hideError();
        setLoadingState('all', true);
        renderActivitySkeletons(5);
        renderMonthlyCalendarSkeletons(); // Render reward skeletons
        renderMilestoneSkeletons();

        try {
            // --- Check and update streak/login data FIRST ---
            await checkAndUpdateLoginStreak();
            // --- END Check ---

            // Update sidebar with potentially updated profile
            updateSidebarProfile(profile);

            console.log("[MAIN] loadDashboardData: Načítání statistik, aktivit, oznámení...");
            const results = await Promise.allSettled([
                fetchUserStats(user.id, profile),
                fetchRecentActivities(user.id, 5),
                fetchNotifications(user.id, 5)
            ]);
            console.log("[MAIN] loadDashboardData: Souběžné načítání dokončeno:", results);

            // Process stats
            if (results[0].status === 'fulfilled') { updateStatsCards(results[0].value || profile); }
            else { console.error("❌ Chyba při načítání statistik:", results[0].reason); showError("Nepodařilo se načíst statistiky."); updateStatsCards(profile); }
            setLoadingState('stats', false);

            // Process activities
            if (results[1].status === 'fulfilled') { renderActivities(results[1].value || []); }
            else { console.error("❌ Chyba při načítání aktivit:", results[1].reason); showError("Nepodařilo se načíst aktivity."); renderActivities(null); }
            setLoadingState('activities', false);

            // Process notifications
            if (results[2].status === 'fulfilled') { const { unreadCount, notifications } = results[2].value || { unreadCount: 0, notifications: [] }; renderNotifications(unreadCount, notifications); }
            else { console.error("❌ Chyba při načítání oznámení:", results[2].reason); showError("Nepodařilo se načíst oznámení."); renderNotifications(0, []); }
            setLoadingState('notifications', false);

            // --- Render Rewards ---
            renderMonthlyCalendar();
            renderStreakMilestones();
            // --- END Render Rewards ---

            console.log("[MAIN] loadDashboardData: Všechna data zpracována.");

        } catch (error) {
             console.error('[MAIN] loadDashboardData: Zachycena hlavní chyba:', error);
             showError('Nepodařilo se kompletně načíst data nástěnky: ' + error.message);
             setLoadingState('all', false);
             // Render empty/error states for all sections
             updateStatsCards(profile); // Still show basic profile info if available
             renderActivities(null);
             renderNotifications(0, []);
             renderMonthlyCalendar(); // Render empty/error state
             renderStreakMilestones(); // Render empty/error state
        }
        finally { setLoadingState('all', false); initTooltips(); } // Ensure all loaders are off
    }
    // --- END: Data Loading ---

    // --- START: UI Update Functions ---
    function updateSidebarProfile(profile) { /* ... (keep as is) ... */ }
    function updateStatsCards(stats) { /* ... (keep as is) ... */ }
    function renderActivities(activities) { /* ... (keep as is) ... */ }
    function renderActivitySkeletons(count = 5) { /* ... (keep as is) ... */ }
    function renderNotifications(count, notifications) { /* ... (keep as is) ... */ }
    function renderNotificationSkeletons(count = 2) { /* ... (keep as is) ... */ }

    // --- NEW: Render Monthly Calendar ---
    function renderMonthlyCalendar() {
        if (!ui.monthlyCalendarGrid || !ui.monthlyCalendarSection || !ui.currentMonthYearSpan) { console.error("Monthly calendar UI elements missing."); setLoadingState('monthlyRewards', false); return; }
        console.log("[RenderMonthly] Rendering calendar...");

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed
        const today = now.getDate();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthString = getCurrentMonthYearString(); // "YYYY-MM"
        const monthName = now.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });

        // Get claimed days for the *current* month from the profile state
        const claimedDaysThisMonth = currentProfile?.monthly_claims?.[monthString] || [];
        console.log(`[RenderMonthly] Claimed days for ${monthString}:`, claimedDaysThisMonth);

        ui.currentMonthYearSpan.textContent = monthName;
        ui.monthlyCalendarGrid.innerHTML = ''; // Clear previous content or skeletons
        const fragment = document.createDocumentFragment();

        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.classList.add('calendar-day');
            dayElement.dataset.day = day;

            const isClaimed = claimedDaysThisMonth.includes(day);
            const isClaimable = (day === today && !isClaimed); // Only today is claimable if not already claimed
            const isUpcoming = day > today;
            const isMissed = day < today && !isClaimed;

            dayElement.innerHTML = `
                <span class="day-number">${day}</span>
                <div class="reward-icon"><i class="fas fa-gift"></i></div>
                <span class="reward-status"></span>
                <button class="claim-button btn btn-sm" style="display: none;">
                    <i class="fas fa-check"></i> Vyzvednout
                </button>
            `;
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
                    claimButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        claimMonthlyReward(day, claimButton); // Pass button for loading state
                    });
                }
            } else if (isUpcoming) {
                dayElement.classList.add('upcoming');
                if (statusSpan) statusSpan.textContent = 'Připravuje se';
            } else { // Past, not claimed (isMissed)
                dayElement.classList.add('missed');
                if (statusSpan) statusSpan.textContent = 'Zmeškáno';
            }
             if(day === today) { dayElement.classList.add('today'); } // Highlight today

            fragment.appendChild(dayElement);
        }

        ui.monthlyCalendarGrid.appendChild(fragment);
        ui.monthlyCalendarSection.classList.remove('loading'); // Remove loading class from section
        console.log("[RenderMonthly] Calendar rendered.");
        setLoadingState('monthlyRewards', false); // Set loading state off
        initTooltips();
    }

    function renderMonthlyCalendarSkeletons() {
         if (!ui.monthlyCalendarGrid) return;
         ui.monthlyCalendarGrid.innerHTML = '';
         const skeletonCount = 21; // Show a few rows
         let skeletonHTML = '';
         for(let i=0; i < skeletonCount; i++) {
             skeletonHTML += '<div class="calendar-day skeleton"></div>';
         }
         ui.monthlyCalendarGrid.innerHTML = skeletonHTML;
     }


    // --- NEW: Render Streak Milestones ---
    function renderStreakMilestones() {
        if (!ui.streakMilestonesList || !ui.streakMilestonesSection || !ui.currentStreakValueSpan) { console.error("Streak milestones UI elements missing."); setLoadingState('streakMilestones', false); return; }
        console.log("[RenderMilestones] Rendering streak milestones...");

        const currentStreak = currentProfile?.streak_days || 0;
        const lastClaimed = currentProfile?.last_milestone_claimed || 0;

        ui.currentStreakValueSpan.textContent = currentStreak; // Update streak display here too
        ui.streakMilestonesList.innerHTML = ''; // Clear previous
        const fragment = document.createDocumentFragment();
        let milestonesToShow = 0;

        milestoneDays.forEach(milestoneDay => {
            const config = MILESTONE_REWARDS_CONFIG[milestoneDay];
            if (!config) return;

            const milestoneElement = document.createElement('div');
            milestoneElement.classList.add('milestone-item');
            milestoneElement.dataset.milestone = milestoneDay;

            const isClaimed = lastClaimed >= milestoneDay;
            const isClaimable = currentStreak >= milestoneDay && !isClaimed;
            const isLocked = currentStreak < milestoneDay;

            let statusHTML = '';
            let buttonHTML = '';

            if (isClaimed) {
                milestoneElement.classList.add('claimed');
                statusHTML = `<span class="milestone-status claimed"><i class="fas fa-check-circle"></i> Získáno</span>`;
            } else if (isClaimable) {
                milestoneElement.classList.add('available');
                statusHTML = `<span class="milestone-status available"><i class="fas fa-gift"></i> Dostupné!</span>`;
                buttonHTML = `<button class="claim-button btn btn-sm btn-success"><i class="fas fa-check"></i> Vyzvednout</button>`;
            } else { // Locked
                milestoneElement.classList.add('locked');
                const daysNeeded = milestoneDay - currentStreak;
                statusHTML = `<span class="milestone-status locked"><i class="fas fa-lock"></i> Ještě ${daysNeeded} ${daysNeeded === 1 ? 'den' : (daysNeeded < 5 ? 'dny' : 'dní')}</span>`;
            }

            milestoneElement.innerHTML = `
                <div class="milestone-icon">
                    <i class="fas ${config.icon || 'fa-award'}"></i>
                </div>
                <div class="milestone-info">
                    <h4 class="milestone-title">${sanitizeHTML(config.name)}</h4>
                    <p class="milestone-desc">${sanitizeHTML(config.description)}</p>
                    <div class="milestone-req">Požadavek: ${milestoneDay} dní série</div>
                </div>
                <div class="milestone-status-action">
                    ${statusHTML}
                    ${buttonHTML}
                </div>
            `;

            const claimButton = milestoneElement.querySelector('.claim-button');
            if (claimButton) {
                claimButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    claimMilestoneReward(milestoneDay, claimButton); // Pass button
                });
            }

            fragment.appendChild(milestoneElement);
            milestonesToShow++;
        });

        ui.streakMilestonesList.appendChild(fragment);
        ui.streakMilestonesEmpty.style.display = milestonesToShow === 0 ? 'block' : 'none';
        ui.streakMilestonesSection.classList.remove('loading');
        console.log("[RenderMilestones] Milestones rendered.");
        setLoadingState('streakMilestones', false);
        initTooltips();
    }

     function renderMilestoneSkeletons() {
          if (!ui.streakMilestonesList) return;
          ui.streakMilestonesList.innerHTML = '';
          const skeletonCount = 3;
          let skeletonHTML = '';
          for(let i=0; i < skeletonCount; i++) {
              skeletonHTML += '<div class="milestone-item skeleton"></div>';
          }
          ui.streakMilestonesList.innerHTML = skeletonHTML;
      }

    // --- NEW: Claim Reward Logic (Placeholders) ---
    async function claimMonthlyReward(day, buttonElement) {
        console.log(`[ClaimMonthly] Attempting to claim reward for day ${day}`);
        if (buttonElement) {
            buttonElement.disabled = true;
            buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        const currentMonth = getCurrentMonthYearString();
        currentProfile.monthly_claims = currentProfile.monthly_claims || {};
        currentProfile.monthly_claims[currentMonth] = currentProfile.monthly_claims[currentMonth] || [];

        // Prevent double-claiming locally
        if (currentProfile.monthly_claims[currentMonth].includes(day)) {
            console.warn(`[ClaimMonthly] Day ${day} already claimed for ${currentMonth}.`);
            showToast('Info', 'Tato odměna již byla vyzvednuta.', 'info');
            renderMonthlyCalendar(); // Re-render to fix UI state
            return;
        }

        // **Placeholder:** Simulate successful claim
        currentProfile.monthly_claims[currentMonth].push(day);
        console.log(`[ClaimMonthly] Reward for day ${day} claimed locally. New claims:`, currentProfile.monthly_claims);

        // **TODO (Future):** Add DB update call here
        const dbSuccess = await updateMonthlyClaimsInDB(currentProfile.monthly_claims);

        if (dbSuccess) {
             showToast('Odměna Získána!', `Získali jste odměnu za ${day}. den měsíce!`, 'success');
            // Re-render the calendar to show the claimed state correctly
             renderMonthlyCalendar();
         } else {
              // Rollback local state if DB update failed
              const dayIndex = currentProfile.monthly_claims[currentMonth].indexOf(day);
              if (dayIndex > -1) {
                  currentProfile.monthly_claims[currentMonth].splice(dayIndex, 1);
              }
              // Re-enable button and re-render
               renderMonthlyCalendar();
              showToast('Chyba', 'Nepodařilo se uložit vyzvednutí odměny.', 'error');
         }
        // No need to disable button permanently here, renderMonthlyCalendar handles it
    }

    async function claimMilestoneReward(milestoneDay, buttonElement) {
        console.log(`[ClaimMilestone] Attempting to claim reward for milestone ${milestoneDay}`);
        if (buttonElement) {
             buttonElement.disabled = true;
             buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
         }

         // Prevent double-claiming locally
         if ((currentProfile?.last_milestone_claimed || 0) >= milestoneDay) {
              console.warn(`[ClaimMilestone] Milestone ${milestoneDay} already claimed.`);
              showToast('Info', 'Tato milníková odměna již byla vyzvednuta.', 'info');
              renderStreakMilestones(); // Re-render to fix UI state
              return;
         }

         // **Placeholder:** Simulate successful claim
         const rewardConfig = MILESTONE_REWARDS_CONFIG[milestoneDay];
         const rewardName = rewardConfig?.name || `Odměna za ${milestoneDay} dní`;
         currentProfile.last_milestone_claimed = milestoneDay;
         console.log(`[ClaimMilestone] Reward for ${milestoneDay} days claimed locally. Last claimed: ${currentProfile.last_milestone_claimed}`);

         // **TODO (Future):** Add DB update call here
         const dbSuccess = await updateLastMilestoneClaimedInDB(milestoneDay);

         if(dbSuccess) {
             showToast('Milník Dosažen!', `Získali jste: ${rewardName}`, 'success');
             // Re-render milestones to show claimed state
             renderStreakMilestones();
             // **TODO (Future):** Add logic to actually grant the reward (e.g., points)
             // Example: if(rewardConfig.reward_type === 'points') { awardPoints(rewardConfig.reward_value); }
         } else {
              // Rollback local state if DB update failed
              // Find the *previous* milestone to rollback to
               const previousMilestone = milestoneDays.filter(m => m < milestoneDay).pop() || 0;
               currentProfile.last_milestone_claimed = previousMilestone;
              // Re-enable button and re-render
               renderStreakMilestones();
               showToast('Chyba', 'Nepodařilo se uložit vyzvednutí milníkové odměny.', 'error');
         }
    }
    // --- END: New Claim Logic ---

    // --- Notification Logic (Keep existing functions) ---
    async function markNotificationRead(notificationId) { /* ... (keep as is) ... */ }
    async function markAllNotificationsRead() { /* ... (keep as is) ... */ }
    // --- END: Notification Logic ---

    // --- Event Listeners Setup (Add new listeners) ---
    function setupUIEventListeners() {
        console.log("[SETUP] setupUIEventListeners: Start");
        // --- Sidebar/Menu ---
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
        if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);
        document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });
        // --- Core Actions ---
        if (ui.startPracticeBtn) ui.startPracticeBtn.addEventListener('click', () => { window.location.href = '/dashboard/procvicovani/main.html'; });
        if (ui.refreshDataBtn) { ui.refreshDataBtn.addEventListener('click', async () => { if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; ui.refreshDataBtn.disabled = true; await loadDashboardData(currentUser, currentProfile); if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; ui.refreshDataBtn.disabled = false; }); }
        // --- Notifications ---
        if(ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
        if(ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); }
        if(ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }); }
        document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown?.classList.remove('active'); } });
        // --- Other ---
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        if (ui.mainContent) ui.mainContent.addEventListener('scroll', initHeaderScrollDetection, { passive: true }); // Attach scroll listener

        // --- REMOVED: Old Daily Reward Listeners ---
        // if (ui.claimRewardBtn) { ui.claimRewardBtn.addEventListener('click', claimDailyReward); }
        // if (ui.dailyRewardCard) { ui.dailyRewardCard.addEventListener('click', (event) => { if (!event.target.closest('#claim-reward-btn')) { showRewardPreview(); } }); }
        // if (ui.closePreviewModalBtn) { ui.closePreviewModalBtn.addEventListener('click', hideRewardPreview); }
        // if (ui.rewardPreviewModal) { ui.rewardPreviewModal.addEventListener('click', (event) => { if (event.target === ui.rewardPreviewModal) { hideRewardPreview(); } }); }

        // --- NEW: Listeners for new reward sections (delegation might be better if elements are frequently re-rendered) ---
        // Event listeners for claim buttons are added dynamically in renderMonthlyCalendar and renderStreakMilestones

        console.log("[SETUP] Event listeners set up.");
    }
    // --- END: Event Listeners ---

    // --- START THE APP ---
    async function initializeApp() {
        console.log("[INIT Dashboard] initializeApp: Start v20");
        if (!initializeSupabase()) { console.error("[INIT Dashboard] Supabase initialization failed. Aborting."); return; }
        setupUIEventListeners();
        applyInitialSidebarState();

        if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; }
        if (ui.mainContent) ui.mainContent.style.display = 'none';

        try {
            console.log("[INIT Dashboard] Checking auth session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);

            if (session?.user) {
                currentUser = session.user;
                console.log(`[INIT Dashboard] User authenticated (ID: ${currentUser.id}). Loading profile and titles...`);

                const [profileResult, titlesResult] = await Promise.allSettled([
                    fetchUserProfile(currentUser.id), // Fetches profile with new reward columns
                    fetchTitles()
                ]);

                if (profileResult.status === 'fulfilled' && profileResult.value) {
                    currentProfile = profileResult.value;
                    console.log("[INIT Dashboard] Profile loaded:", currentProfile);
                } else {
                    console.warn("[INIT Dashboard] Profile not found or fetch failed, attempting to create default...");
                    currentProfile = await createDefaultProfile(currentUser.id, currentUser.email); // Creates profile with new reward columns
                    if (!currentProfile) throw new Error("Nepodařilo se vytvořit/načíst profil uživatele.");
                    console.log("[INIT Dashboard] Default profile created/retrieved.");
                }

                if (titlesResult.status === 'fulfilled') { allTitles = titlesResult.value || []; console.log("[INIT Dashboard] Titles loaded:", allTitles.length); }
                else { console.warn("[INIT Dashboard] Failed to load titles:", titlesResult.reason); allTitles = []; }

                // Initial UI updates (Sidebar, etc.)
                updateSidebarProfile(currentProfile);
                initHeaderScrollDetection(); // Initialize scroll detection
                updateCopyrightYear();

                // Load main dashboard data (stats, activities, notifications) and render rewards
                await loadDashboardData(currentUser, currentProfile);

                if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
                if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
                initMouseFollower();
                initTooltips();

                console.log("✅ [INIT Dashboard] Page fully loaded and initialized.");

            } else { console.log('[INIT Dashboard] V sezení není uživatel, přesměrování.'); window.location.href = '/auth/index.html'; }
        } catch (error) { console.error("❌ [INIT Dashboard] Kritická chyba inicializace:", error); if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE STRÁNKU.</p>`; } else { showError(`Chyba inicializace: ${error.message}`, true); } if (ui.mainContent) ui.mainContent.style.display = 'none'; setLoadingState('all', false); }
    }

    document.addEventListener('DOMContentLoaded', initializeApp);

})(); // End of IIFE