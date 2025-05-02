// dashboard.js
// Версия: 22 - Модальный Календарь + Этапы Серии
(function() {
    'use strict';

    // --- START: Initialization and Configuration ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = []; // Хранилище для доступных титулов

    // Состояния загрузки
    let isLoading = {
        stats: false,
        activities: false,
        notifications: false,
        titles: false,
        monthlyRewards: false, // Загрузка данных/рендеринг для модального окна
        streakMilestones: false
    };
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';

    // Конфигурация Наград
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
    };
    const milestoneDays = Object.keys(MILESTONE_REWARDS_CONFIG).map(Number).sort((a, b) => a - b);

    // DOM Elements Cache (Обновлено для модального окна)
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
        startPracticeBtn: document.getElementById('start-practice-btn'), // Кнопка в баннере для тренировки
        openMonthlyModalBtn: document.getElementById('open-monthly-modal-btn'), // Кнопка для открытия модалки календаря
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
        // Monthly Reward Modal Elements
        monthlyRewardModal: document.getElementById('monthly-reward-modal'),
        modalMonthlyCalendarGrid: document.getElementById('modal-monthly-calendar-grid'),
        modalMonthlyCalendarEmpty: document.getElementById('modal-monthly-calendar-empty'),
        modalCurrentMonthYearSpan: document.getElementById('modal-current-month-year'), // Title inside modal
        closeMonthlyModalBtn: document.getElementById('close-monthly-modal-btn'),
        // Streak Milestones Elements (remains the same)
        streakMilestonesSection: document.getElementById('streak-milestones-section'),
        streakMilestonesList: document.getElementById('streak-milestones-list'),
        streakMilestonesEmpty: document.getElementById('streak-milestones-empty'),
        currentStreakValueSpan: document.getElementById('current-streak-value')
    };

    // Visual settings for activities & notifications
    const activityVisuals = { /* ... (keep as is) ... */ };
    // --- END: Initialization and Configuration ---

    // --- START: Helper Functions ---
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
                // Используем оверлей ВНУТРИ модального окна
                monthlyRewards: ui.monthlyRewardModal?.querySelector('.loading-overlay'),
                streakMilestones: ui.streakMilestonesSection?.querySelector('.loading-overlay'),
                activities: ui.activityListContainer, // Uses class toggle for skeleton wrapper
                stats: null, notifications: null, titles: null
            }[sec];

            const contentContainer = {
                // Рендерим в сетку ВНУТРИ модального окна
                monthlyRewards: ui.modalMonthlyCalendarGrid,
                streakMilestones: ui.streakMilestonesList,
                activities: ui.activityList,
                stats: null, notifications: ui.notificationsList, titles: null
            }[sec];

             const emptyStateContainer = {
                 monthlyRewards: ui.modalMonthlyCalendarEmpty,
                 streakMilestones: ui.streakMilestonesEmpty,
                 activities: ui.activityListEmptyState,
                 notifications: ui.noNotificationsMsg
             }[sec];

             const parentSection = { // Main container for the section
                 // Секция календаря теперь модальное окно, а не статическая секция
                 monthlyRewards: ui.monthlyRewardModal?.querySelector('.modal-body'), // Loading affects modal body
                 streakMilestones: ui.streakMilestonesSection,
                 activities: ui.activityListContainer,
                 stats: null, notifications: null, titles: null
             }[sec];

            // Handle general cards (stats)
            if (sec === 'stats') {
                [ui.progressCard, ui.pointsCard, ui.streakCard].forEach(card => card?.classList.toggle('loading', isLoadingFlag));
            }
            // Handle sections with overlays/skeletons
            else if (loaderOverlay || parentSection) {
                parentSection?.classList.toggle('loading', isLoadingFlag); // Add loading class to parent if needed
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
                    // After loading, ensure empty state is shown if content is empty
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
    function getCurrentMonthYearString() { const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); return `${year}-${month}`; }

    // --- NEW Modal Helpers ---
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            console.log(`[Modal] Opening modal: ${modalId}`);
            modal.style.display = 'flex';
            // Render calendar content *when modal opens*
            if (modalId === 'monthly-reward-modal') {
                renderMonthlyCalendar(); // Render fresh content
            }
            requestAnimationFrame(() => { modal.classList.add('active'); });
        } else {
             console.error(`[Modal] Modal element not found: #${modalId}`);
        }
    }
    function hideModal(modalId) {
         const modal = document.getElementById(modalId);
         if (modal) {
             console.log(`[Modal] Closing modal: ${modalId}`);
             modal.classList.remove('active');
             // Wait for animation to finish before hiding
             setTimeout(() => { modal.style.display = 'none'; }, 300); // Match CSS transition duration
         }
     }

    // --- END: Helper Functions ---

    // --- START: Data Loading and Processing Functions ---
    function initializeSupabase() { /* ... (keep as is) ... */ }
    async function fetchUserProfile(userId) { /* ... (keep as is, ensures monthly_claims/last_milestone_claimed selected) ... */ }
    async function createDefaultProfile(userId, userEmail) { /* ... (keep as is, includes new defaults) ... */ }
    async function fetchTitles() { /* ... (keep as is) ... */ }
    async function fetchUserStats(userId, profileData) { /* ... (keep as is) ... */ }
    async function fetchRecentActivities(userId, limit = 5) { /* ... (keep as is) ... */ }
    async function fetchNotifications(userId, limit = 5) { /* ... (keep as is) ... */ }
    async function checkAndUpdateLoginStreak() { /* ... (keep as is, updates streak and monthly claims init) ... */ }
    async function updateMonthlyClaimsInDB(newClaimsData) { /* ... (keep placeholder as is) ... */ }
    async function updateLastMilestoneClaimedInDB(milestoneDay) { /* ... (keep placeholder as is) ... */ }

    // --- Modified Load Function ---
    async function loadDashboardData(user, profile) {
        if (!user || !profile) { showError("Chyba: Nelze načíst data bez profilu uživatele."); setLoadingState('all', false); return; }
        console.log("[MAIN] loadDashboardData: Start pro uživatele:", user.id);
        hideError();
        // Set loading state only for non-modal sections initially
        setLoadingState('stats', true);
        setLoadingState('activities', true);
        setLoadingState('notifications', true);
        setLoadingState('streakMilestones', true);
        // Do NOT set monthlyRewards loading state here, it happens when modal opens

        renderActivitySkeletons(5);
        // Render milestone skeletons immediately
        renderMilestoneSkeletons();

        try {
            // Check and update streak/login data FIRST
            await checkAndUpdateLoginStreak();

            // Update sidebar with potentially updated profile
            updateSidebarProfile(profile);

            console.log("[MAIN] loadDashboardData: Načítání statistik, aktivit, oznámení...");
            const results = await Promise.allSettled([
                fetchUserStats(user.id, profile),
                fetchRecentActivities(user.id, 5),
                fetchNotifications(user.id, 5)
            ]);
            console.log("[MAIN] loadDashboardData: Souběžné načítání dokončeno:", results);

            // Process results
            if (results[0].status === 'fulfilled') { updateStatsCards(results[0].value || profile); }
            else { console.error("❌ Chyba při načítání statistik:", results[0].reason); showError("Nepodařilo se načíst statistiky."); updateStatsCards(profile); }
            setLoadingState('stats', false);

            if (results[1].status === 'fulfilled') { renderActivities(results[1].value || []); }
            else { console.error("❌ Chyba při načítání aktivit:", results[1].reason); showError("Nepodařilo se načíst aktivity."); renderActivities(null); }
            setLoadingState('activities', false);

            if (results[2].status === 'fulfilled') { const { unreadCount, notifications } = results[2].value || { unreadCount: 0, notifications: [] }; renderNotifications(unreadCount, notifications); }
            else { console.error("❌ Chyba při načítání oznámení:", results[2].reason); showError("Nepodařilo se načíst oznámení."); renderNotifications(0, []); }
            setLoadingState('notifications', false);

            // Render Streak Milestones section (not the modal calendar yet)
            renderStreakMilestones(); // This will turn off its own loading state

            console.log("[MAIN] loadDashboardData: Statické секции обработаны.");

        } catch (error) {
             console.error('[MAIN] loadDashboardData: Zachycena hlavní chyba:', error);
             showError('Nepodařilo se kompletně načíst data nástěnky: ' + error.message);
             // Render empty/error states for static sections
             updateStatsCards(profile);
             renderActivities(null);
             renderNotifications(0, []);
             renderStreakMilestones(); // Render empty/error state
        }
        finally {
             // Turn off any remaining loaders (except modal ones)
             setLoadingState('stats', false);
             setLoadingState('activities', false);
             setLoadingState('notifications', false);
             setLoadingState('streakMilestones', false);
             initTooltips();
         }
    }
    // --- END: Data Loading ---

    // --- START: UI Update Functions ---
    function updateSidebarProfile(profile) {
        // --- Обновлено: Использовать allTitles для отображения титула ---
        console.log("[UI Update] Aktualizace sidebaru...");
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[UI Update] Elementy sidebaru nenalezeny."); return; }
        if (profile) {
            const firstName = profile.first_name ?? '';
            const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(profile);
            const avatarUrl = profile.avatar_url;
            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
            // --- Title Logic using allTitles ---
            const selectedTitleKey = profile.selected_title;
            let displayTitle = 'Pilot'; // Default
            if (selectedTitleKey && allTitles && allTitles.length > 0) {
                const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) displayTitle = foundTitle.name;
            }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle));
            // --- End Title Logic ---
            if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`;
            console.log("[UI Update] Sidebar aktualizován.");
        } else {
            console.warn("[UI Update] Chybí data profilu pro sidebar.");
            ui.sidebarName.textContent = "Pilot";
            ui.sidebarAvatar.textContent = '?';
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot';
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title');
            if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítejte!`;
        }
    }
    function updateStatsCards(stats) { /* ... (keep as is) ... */ }
    function renderActivities(activities) { /* ... (keep as is) ... */ }
    function renderActivitySkeletons(count = 5) { /* ... (keep as is) ... */ }
    function renderNotifications(count, notifications) { /* ... (keep as is) ... */ }
    function renderNotificationSkeletons(count = 2) { /* ... (keep as is) ... */ }

    // --- Render Monthly Calendar (Targets MODAL grid) ---
    function renderMonthlyCalendar() {
        // --- MODIFIED: Target modal elements ---
        const gridContainer = ui.modalMonthlyCalendarGrid;
        const modalTitleSpan = ui.modalCurrentMonthYearSpan; // Span inside modal title
        const emptyState = ui.modalMonthlyCalendarEmpty;

        if (!gridContainer || !modalTitleSpan || !emptyState) {
             console.error("Monthly calendar MODAL UI elements missing.");
             setLoadingState('monthlyRewards', false);
             return;
        }
        console.log("[RenderMonthly] Rendering calendar INSIDE MODAL...");
        setLoadingState('monthlyRewards', true); // Use the specific loading state

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const today = now.getDate();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthString = getCurrentMonthYearString();
        const monthName = now.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });

        const claimedDaysThisMonth = currentProfile?.monthly_claims?.[monthString] || [];
        console.log(`[RenderMonthly] Claimed days for ${monthString}:`, claimedDaysThisMonth);

        modalTitleSpan.textContent = monthName; // Update modal title
        gridContainer.innerHTML = '';
        emptyState.style.display = 'none'; // Hide empty state initially
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

            // --- Placeholder Reward Icon/Text ---
            // In the future, fetch actual reward data based on 'day' for the current month
            let rewardIconHtml = '<i class="fas fa-question-circle"></i>'; // Default unknown
            let rewardText = `Odměna ${day}`; // Placeholder text
            if(day % 7 === 0) { rewardIconHtml = '<i class="fas fa-star"></i>'; rewardText = `Bonus ${day}`; } // Example: weekly bonus
            else { rewardIconHtml = '<i class="fas fa-coins"></i>'; rewardText = `Kredity ${day*10}`; }
            // --- End Placeholder ---

            dayElement.innerHTML = `
                <span class="day-number">${day}</span>
                <div class="reward-icon">${rewardIconHtml}</div>
                <span class="reward-text">${rewardText}</span>
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
                        claimMonthlyReward(day, claimButton);
                    });
                }
            } else if (isUpcoming) {
                dayElement.classList.add('upcoming');
                if (statusSpan) statusSpan.textContent = 'Připravuje se';
            } else { // Missed
                dayElement.classList.add('missed');
                if (statusSpan) statusSpan.textContent = 'Zmeškáno';
            }
             if(day === today) { dayElement.classList.add('today'); }

            fragment.appendChild(dayElement);
            daysRendered++;
        }

        if (daysRendered > 0) {
            gridContainer.appendChild(fragment);
            gridContainer.style.display = 'grid'; // Ensure grid is visible
        } else {
            emptyState.style.display = 'block'; // Show empty state if no days rendered
            gridContainer.style.display = 'none';
        }

        // Remove general loading class from parent section if exists
        ui.monthlyRewardModal?.querySelector('.modal-body')?.classList.remove('loading');

        console.log("[RenderMonthly] Modal calendar rendered.");
        setLoadingState('monthlyRewards', false);
        initTooltips();
    }

    function renderMonthlyCalendarSkeletons() {
        // --- MODIFIED: Target modal grid ---
        const gridContainer = ui.modalMonthlyCalendarGrid;
        if (!gridContainer) return;
        gridContainer.innerHTML = '';
        gridContainer.style.display = 'grid'; // Ensure grid is visible for skeletons
        const skeletonCount = 21;
        let skeletonHTML = '';
        for(let i=0; i < skeletonCount; i++) {
            skeletonHTML += '<div class="calendar-day skeleton"></div>';
        }
        gridContainer.innerHTML = skeletonHTML;
    }

    // --- Render Streak Milestones (No change needed, targets static section) ---
    function renderStreakMilestones() {
        if (!ui.streakMilestonesList || !ui.streakMilestonesSection || !ui.currentStreakValueSpan) { console.error("Streak milestones UI elements missing."); setLoadingState('streakMilestones', false); return; }
        console.log("[RenderMilestones] Rendering streak milestones...");

        const currentStreak = currentProfile?.streak_days || 0;
        const lastClaimed = currentProfile?.last_milestone_claimed || 0;

        ui.currentStreakValueSpan.textContent = currentStreak;
        ui.streakMilestonesList.innerHTML = '';
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
                    claimMilestoneReward(milestoneDay, claimButton);
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
    // --- END: UI Update ---

    // --- START: Claim Reward Logic (Placeholders) ---
    async function claimMonthlyReward(day, buttonElement) {
        console.log(`[ClaimMonthly] Attempting claim for day ${day}`);
        if (!currentUser || !currentProfile || !supabase) { showToast("Chyba", "Nelze vyzvednout odměnu, zkuste obnovit stránku.", "error"); return; }

        buttonElement.disabled = true;
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const currentMonth = getCurrentMonthYearString();
        // Ensure the structure exists before accessing
        currentProfile.monthly_claims = currentProfile.monthly_claims || {};
        currentProfile.monthly_claims[currentMonth] = currentProfile.monthly_claims[currentMonth] || [];

        if (currentProfile.monthly_claims[currentMonth].includes(day)) {
            console.warn(`[ClaimMonthly] Day ${day} already claimed for ${currentMonth}.`);
            showToast('Info', 'Tato odměna již byla vyzvednuta.', 'info');
            renderMonthlyCalendar(); // Re-render modal content
            return;
        }

        // --- Simulate Claim ---
        const updatedClaimsForMonth = [...currentProfile.monthly_claims[currentMonth], day];
        const updatedFullClaims = { ...currentProfile.monthly_claims, [currentMonth]: updatedClaimsForMonth };

        // **Placeholder for DB Update:**
        const dbSuccess = await updateMonthlyClaimsInDB(updatedFullClaims); // Pass the *entire* updated claims object

        if (dbSuccess) {
             currentProfile.monthly_claims = updatedFullClaims; // Update local state *after* successful DB save
             console.log(`[ClaimMonthly] Reward for day ${day} claimed successfully. New claims obj:`, currentProfile.monthly_claims);
             showToast('Odměna Získána!', `Získali jste odměnu za ${day}. den měsíce! (Placeholder)`, 'success');
             console.log(`Placeholder: Grant reward for month day ${day}`);
         } else {
              // DB update failed, no need to rollback local state as it wasn't changed yet
               showToast('Chyba', 'Nepodařilo se uložit vyzvednutí odměny.', 'error');
         }

        // Re-render calendar to show the final state (claimed or available again on error)
        renderMonthlyCalendar();
    }

    async function claimMilestoneReward(milestoneDay, buttonElement) {
        console.log(`[ClaimMilestone] Attempting claim for milestone ${milestoneDay}`);
        if (!currentUser || !currentProfile || !supabase) { showToast("Chyba", "Nelze vyzvednout odměnu, zkuste obnovit stránku.", "error"); return; }

        buttonElement.disabled = true;
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        if ((currentProfile?.last_milestone_claimed || 0) >= milestoneDay) {
            console.warn(`[ClaimMilestone] Milestone ${milestoneDay} already claimed.`);
            showToast('Info', 'Tato milníková odměna již byla vyzvednuta.', 'info');
            renderStreakMilestones();
            return;
        }

        // --- Simulate Claim ---
        const rewardConfig = MILESTONE_REWARDS_CONFIG[milestoneDay];
        const rewardName = rewardConfig?.name || `Odměna za ${milestoneDay} dní`;
        const previousMilestone = currentProfile.last_milestone_claimed; // Store for rollback

        // **Placeholder for DB Update:**
        const dbSuccess = await updateLastMilestoneClaimedInDB(milestoneDay);

        if(dbSuccess) {
             currentProfile.last_milestone_claimed = milestoneDay; // Update local state *after* DB success
             console.log(`[ClaimMilestone] Reward for ${milestoneDay} days claimed successfully. Last claimed now: ${currentProfile.last_milestone_claimed}`);
             showToast('Milník Dosažen!', `Získali jste: ${rewardName} (Placeholder)`, 'success');
             console.log(`Placeholder: Grant reward for milestone ${milestoneDay}:`, rewardConfig);
             // **TODO (Future):** Add points or other rewards here
         } else {
             // DB update failed
              showToast('Chyba', 'Nepodařilo se uložit vyzvednutí milníkové odměny.', 'error');
              // Local state remains unchanged
         }

        // Re-render milestones
        renderStreakMilestones();
    }
    // --- END: Claim Reward Logic ---

    // --- Notification Logic ---
    async function markNotificationRead(notificationId) { /* ... (keep as is) ... */ }
    async function markAllNotificationsRead() { /* ... (keep as is) ... */ }
    // --- END: Notification Logic ---

    // --- START: Event Listeners Setup ---
    function setupUIEventListeners() {
        console.log("[SETUP] setupUIEventListeners: Start");
        // Sidebar/Menu
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
        if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);
        document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });
        // Core Actions
        if (ui.startPracticeBtn) ui.startPracticeBtn.addEventListener('click', () => { window.location.href = '/dashboard/procvicovani/main.html'; });
        if (ui.refreshDataBtn) { ui.refreshDataBtn.addEventListener('click', async () => { /* ... (keep refresh logic) ... */ }); }
        // Notifications
        if(ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
        if(ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); }
        if(ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { /* ... (keep notification item logic) ... */ }); }
        document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown?.classList.remove('active'); } });
        // Other
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        if (ui.mainContent) ui.mainContent.addEventListener('scroll', initHeaderScrollDetection, { passive: true });

        // --- NEW: Modal Listeners ---
        if (ui.openMonthlyModalBtn) {
             ui.openMonthlyModalBtn.addEventListener('click', () => showModal('monthly-reward-modal'));
        } else { console.warn("Button to open monthly modal not found."); }
        if (ui.closeMonthlyModalBtn) {
             ui.closeMonthlyModalBtn.addEventListener('click', () => hideModal('monthly-reward-modal'));
        } else { console.warn("Close button for monthly modal not found."); }
        if (ui.monthlyRewardModal) {
            // Close on overlay click
            ui.monthlyRewardModal.addEventListener('click', (event) => {
                if (event.target === ui.monthlyRewardModal) {
                    hideModal('monthly-reward-modal');
                }
            });
        } else { console.warn("Monthly reward modal element not found."); }
        // --- END NEW ---

        // Listeners for claim buttons inside modal/milestones are added dynamically during rendering

        console.log("[SETUP] Event listeners set up.");
    }
    // --- END: Event Listeners ---

    // --- START THE APP ---
    async function initializeApp() {
        console.log("[INIT Dashboard] initializeApp: Start v22 - Modal Calendar");
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
                    fetchUserProfile(currentUser.id),
                    fetchTitles()
                ]);

                if (profileResult.status === 'fulfilled' && profileResult.value) {
                    currentProfile = profileResult.value;
                    console.log("[INIT Dashboard] Profile loaded:", currentProfile);
                } else {
                    console.warn("[INIT Dashboard] Profile not found or fetch failed, attempting to create default...");
                    currentProfile = await createDefaultProfile(currentUser.id, currentUser.email);
                    if (!currentProfile) throw new Error("Nepodařilo se vytvořit/načíst profil uživatele.");
                    console.log("[INIT Dashboard] Default profile created/retrieved.");
                }

                if (titlesResult.status === 'fulfilled') { allTitles = titlesResult.value || []; console.log("[INIT Dashboard] Titles loaded:", allTitles.length); }
                else { console.warn("[INIT Dashboard] Failed to load titles:", titlesResult.reason); allTitles = []; }

                // Initial UI updates
                updateSidebarProfile(currentProfile);
                initHeaderScrollDetection();
                updateCopyrightYear();

                // Load main dashboard data (stats, activities, milestones, notifications)
                // Monthly calendar data is rendered when modal is opened
                await loadDashboardData(currentUser, currentProfile);

                if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
                if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
                initMouseFollower();
                initTooltips();

                console.log("✅ [INIT Dashboard] Page fully loaded and initialized.");

            } else { console.log('[INIT Dashboard] V sezení není uživatel, přesměrování.'); window.location.href = '/auth/index.html'; }
        } catch (error) { console.error("❌ [INIT Dashboard] Kritická chyba inicializace:", error); if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE STRÁНКУ.</p>`; } else { showError(`Chyba inicializace: ${error.message}`, true); } if (ui.mainContent) ui.mainContent.style.display = 'none'; setLoadingState('all', false); }
    }

    document.addEventListener('DOMContentLoaded', initializeApp);

})(); // End of IIFE