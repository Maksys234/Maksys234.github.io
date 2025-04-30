// Using an immediately invoked function expression (IIFE)
(function() {
    // --- START: Initialization and Configuration ---
    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null; // Keep profile data (will include points, purchased_titles, selected_title)
    let currentUserStats = null; // Store user_stats data
    let userBadges = [];
    let allBadges = [];
    let allTitles = []; // Store available titles from title_shop
    let leaderboardData = [];
    let currentLeaderboardPeriod = 'overall';
    let isLoading = {
        stats: false,
        userBadges: false,
        availableBadges: false,
        leaderboard: false,
        recentBadges: false,
        notifications: false,
        titleShop: false // Loading state for title shop
    };
    const NOTIFICATION_FETCH_LIMIT = 5;

    // DOM Cache (Verified + New Elements)
    const ui = {
        initialLoader: document.getElementById('initial-loader'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        mainContent: document.getElementById('main-content'),
        sidebar: document.getElementById('sidebar'),
        mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
        sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
        sidebarAvatar: document.getElementById('sidebar-avatar'),
        sidebarName: document.getElementById('sidebar-name'),
        sidebarRole: document.querySelector('.sidebar .user-role'), // Sidebar role element
        currentYearSidebar: document.getElementById('currentYearSidebar'),
        pageTitle: document.getElementById('page-title'),
        refreshDataBtn: document.getElementById('refresh-data-btn'),
        notificationBell: document.getElementById('notification-bell'),
        notificationCount: document.getElementById('notification-count'),
        notificationsDropdown: document.getElementById('notifications-dropdown'),
        notificationsList: document.getElementById('notifications-list'),
        noNotificationsMsg: document.getElementById('no-notifications-msg'),
        markAllReadBtn: document.getElementById('mark-all-read'),
        globalError: document.getElementById('global-error'),
        offlineBanner: document.getElementById('offline-banner'),
        toastContainer: document.getElementById('toast-container'),
        achievementsContent: document.getElementById('achievements-content'),
        achievementStatsContainer: document.getElementById('achievement-stats-container'),
        badgesCount: document.getElementById('badges-count'),
        badgesChange: document.getElementById('badges-change'),
        pointsCount: document.getElementById('points-count'),
        pointsChange: document.getElementById('points-change'),
        streakDays: document.getElementById('streak-days'),
        streakChange: document.getElementById('streak-change'),
        rankValue: document.getElementById('rank-value'),
        rankChange: document.getElementById('rank-change'),
        totalUsers: document.getElementById('total-users'),
        userBadgesContainer: document.getElementById('user-badges-container'),
        badgeGrid: document.getElementById('badge-grid'),
        emptyBadges: document.getElementById('empty-badges'),
        availableBadgesContainer: document.getElementById('available-badges-container'),
        availableBadgesGrid: document.getElementById('available-badges-grid'),
        emptyAvailableBadges: document.getElementById('empty-available-badges'),
        leaderboardSection: document.getElementById('leaderboard-section'),
        leaderboardContainer: document.getElementById('leaderboard-container'),
        leaderboardSkeleton: document.querySelector('#leaderboard-container .leaderboard-skeleton'),
        leaderboardHeaderElement: document.querySelector('.leaderboard-header'),
        leaderboardTableContainer: document.querySelector('.leaderboard-table-container'),
        leaderboardBody: document.getElementById('leaderboard-body'),
        leaderboardEmpty: document.getElementById('leaderboard-empty'),
        recentAchievementsSection: document.getElementById('recent-achievements-section'),
        recentAchievementsList: document.getElementById('recent-achievements-list'),
        currentYearFooter: document.getElementById('currentYearFooter'),
        mouseFollower: document.getElementById('mouse-follower'),
        // Title Shop UI Elements
        titleShopContainer: document.getElementById('title-shop-container'),
        shopUserCredits: document.getElementById('shop-user-credits'),
        titleShopLoading: document.getElementById('title-shop-loading'),
        titleShopGrid: document.getElementById('title-shop-grid'),
        titleShopEmpty: document.getElementById('title-shop-empty')
    };

    // Badge Visuals & Activity Visuals (No changes)
    const badgeVisuals = { math: { icon: 'fa-square-root-alt', gradient: 'var(--gradient-math)' }, language: { icon: 'fa-language', gradient: 'var(--gradient-lang)' }, streak: { icon: 'fa-fire', gradient: 'var(--gradient-streak)' }, special: { icon: 'fa-star', gradient: 'var(--gradient-special)' }, points: { icon: 'fa-coins', gradient: 'var(--gradient-warning)' }, exercises: { icon: 'fa-pencil-alt', gradient: 'var(--gradient-success)' }, test: { icon: 'fa-vial', gradient: 'var(--gradient-info)' }, default: { icon: 'fa-medal', gradient: 'var(--gradient-locked)' } };
    const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

    // --- START: Helper Functions (Updated setLoadingState) ---
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; const retryBtn = document.getElementById('global-retry-btn'); if (retryBtn) { retryBtn.addEventListener('click', handleGlobalRetry); } } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatDate(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) return '-'; const optionsDate = { day: 'numeric', month: 'numeric', year: 'numeric' }; return d.toLocaleDateString('cs-CZ', optionsDate); } catch (e) { console.error("Chyba formátování data:", dateString, e); return '-'; } }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function setLoadingState(section, isLoadingFlag) {
        const sectionsMap = {
            stats: { container: ui.achievementStatsContainer, childrenSelector: '.stat-card' },
            userBadges: { container: ui.userBadgesContainer, emptyEl: ui.emptyBadges, contentEl: ui.badgeGrid },
            availableBadges: { container: ui.availableBadgesContainer, emptyEl: ui.emptyAvailableBadges, contentEl: ui.availableBadgesGrid },
            leaderboard: { container: ui.leaderboardContainer, emptyEl: ui.leaderboardEmpty, contentEl: ui.leaderboardTableContainer, skeletonEl: ui.leaderboardSkeleton },
            recentBadges: { container: ui.recentAchievementsSection },
            notifications: { container: ui.notificationsList, emptyEl: ui.noNotificationsMsg },
            titleShop: { container: ui.titleShopContainer, emptyEl: ui.titleShopEmpty, contentEl: ui.titleShopGrid, loadingEl: ui.titleShopLoading }
        };
        const sectionsToUpdate = section === 'all' ? Object.keys(sectionsMap) : [section];

        sectionsToUpdate.forEach(secKey => {
            if (!sectionsMap[secKey] || isLoading[secKey] === isLoadingFlag) return;
            isLoading[secKey] = isLoadingFlag;
            console.log(`[setLoadingState] Section: ${secKey}, isLoading: ${isLoadingFlag}`);
            const config = sectionsMap[secKey];

            if (config.container) {
                config.container.classList.toggle('loading', isLoadingFlag);

                if (config.childrenSelector) {
                    config.container.querySelectorAll(config.childrenSelector).forEach(child => {
                        child.classList.toggle('loading', isLoadingFlag);
                    });
                }

                if (secKey === 'leaderboard') {
                    if (config.skeletonEl) config.skeletonEl.style.display = isLoadingFlag ? 'block' : 'none';
                    if (config.contentEl) config.contentEl.style.visibility = isLoadingFlag ? 'hidden' : 'visible';
                    if (config.emptyEl) config.emptyEl.style.display = 'none';
                    if (ui.leaderboardHeaderElement) ui.leaderboardHeaderElement.style.visibility = isLoadingFlag ? 'hidden' : 'visible';
                } else if (secKey === 'titleShop') {
                    if (config.loadingEl) config.loadingEl.style.display = isLoadingFlag ? 'flex' : 'none';
                    if (config.contentEl) config.contentEl.style.display = isLoadingFlag ? 'none' : 'grid'; // Keep hidden until loaded
                    if (config.emptyEl) config.emptyEl.style.display = 'none';
                } else if (secKey === 'notifications') {
                    if (isLoadingFlag && config.container) { renderNotificationSkeletons(2); }
                    if (config.emptyEl) config.emptyEl.style.display = isLoadingFlag ? 'none' : (config.container?.innerHTML.trim() === '' ? 'block' : 'none');
                } else {
                    if (isLoadingFlag) {
                        if (config.contentEl) config.contentEl.style.display = 'none';
                        if (config.emptyEl) config.emptyEl.style.display = 'none';
                    }
                }
            } else if (secKey === 'notifications' && ui.notificationBell) {
                ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                if (ui.markAllReadBtn) {
                    const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                    ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
                }
            } else {
                console.warn(`setLoadingState: Container for section "${secKey}" not found.`);
            }
        });
    }
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) { console.log("Scroll animations not initialized."); return; } const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
    const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 30); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 30) document.body.classList.add('scrolled'); };
    const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
    // --- END: Helper Functions ---

    // --- START: Data Loading Functions (Updated/Added) ---
    async function initializeApp() { console.log("🚀 [Init Oceneni - Kyber v6 - Fix] Initializing Awards Page..."); if (!initializeSupabase()) return; setupUIEventListeners(); if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; } if (ui.mainContent) ui.mainContent.style.display = 'none'; try { console.log("[Init Oceneni - Kyber] Checking auth session..."); const { data: { session }, error: sessionError } = await supabase.auth.getSession(); if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`); if (session?.user) { currentUser = session.user; console.log(`[Init Oceneni - Kyber] User authenticated (ID: ${currentUser.id}). Loading data...`); currentProfile = await fetchUserProfile(currentUser.id); if (!currentProfile) throw new Error("Nepodařilo se načíst profil uživatele."); allTitles = await fetchTitleShopData(); updateSidebarProfile(currentProfile, allTitles); if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); } if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => ui.mainContent.classList.add('loaded')); } await loadAllAwardData(); console.log("✅ [Init Oceneni - Kyber] Page fully loaded and initialized."); requestAnimationFrame(() => { initScrollAnimations(); initMouseFollower(); initHeaderScrollDetection(); updateCopyrightYear(); }); } else { console.log("[Init Oceneni - Kyber] User not logged in. Redirecting..."); window.location.href = '/auth/index.html'; } } catch (error) { console.error("❌ [Init Oceneni - Kyber] Critical initialization error:", error); if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA SYSTÉMU (${error.message}). OBNOVTE STRÁNKU.</p>`; } else { showError(`Chyba při inicializaci: ${error.message}`, true); } if (ui.mainContent) ui.mainContent.style.display = 'none'; } }
    function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Knihovna Supabase nebyla správně načtena."); } supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); if (!supabase) throw new Error("Vytvoření klienta Supabase selhalo."); console.log('[Supabase] Klient úspěšně inicializován.'); return true; } catch (error) { console.error('[Supabase] Inicializace selhala:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }
    async function fetchUserProfile(userId) { if (!supabase || !userId) return null; console.log(`[Profile] Fetching profile for user ID: ${userId}`); try { const { data: profile, error } = await supabase .from('profiles') .select('id, first_name, last_name, username, email, avatar_url, points, streak_days, badges_count, level, completed_exercises, created_at, purchased_titles, selected_title') .eq('id', userId) .single(); if (error && error.code !== 'PGRST116') throw error; if (!profile) { console.warn(`[Profile] Profile not found for user ${userId}.`); return null; } console.log("[Profile] Profile data fetched successfully (including titles)."); if (profile.purchased_titles === null) { profile.purchased_titles = []; } return profile; } catch (error) { console.error('[Profile] Caught exception fetching profile:', error); showToast('Chyba', 'Nepodařilo se načíst data profilu.', 'error'); return null; } }
    async function fetchUserStats(userId) { if (!supabase || !userId) { console.error("[Stats Fetch] Missing Supabase client or User ID."); return null; } console.log(`[Stats Fetch] Fetching stats for user ID: ${userId}`); try { const { data: statsData, error } = await supabase .from('user_stats') .select('progress, progress_weekly, points_weekly, streak_longest, completed_tests') .eq('user_id', userId) .maybeSingle(); if (error) { console.warn("[Stats Fetch] Supabase error fetching user_stats:", error.message); return null; } console.log("[Stats Fetch] Stats fetched successfully:", statsData); return statsData || {}; } catch (error) { console.error("[Stats Fetch] Caught exception fetching user_stats:", error); showToast('Chyba', 'Nepodařilo se načíst statistiky uživatele.', 'error'); return null; } }
    async function fetchTitleShopData() { console.log("[TitleShop] Fetching available titles..."); if (!supabase) return []; try { const { data, error } = await supabase .from('title_shop') .select('*') .eq('is_available', true) .order('cost', { ascending: true }); if (error) throw error; console.log(`[TitleShop] Fetched ${data?.length || 0} available titles.`); return data || []; } catch (error) { console.error("[TitleShop] Error fetching available titles:", error); showError("Nepodařilo se načíst nabídku titulů v obchodě."); return []; } }
    async function loadAllAwardData() {
        if (!currentUser || !supabase || !currentProfile) { showError("Nelze načíst data: Chybí informace o uživateli nebo spojení.", true); return; }
        console.log("🔄 [LoadAwards] Starting data fetch...");
        hideError();
        setLoadingState('all', true);
        renderLeaderboardSkeleton();

        try {
            const results = await Promise.allSettled([
                fetchAllBadgesDefinition(),
                fetchUserEarnedBadges(currentUser.id),
                fetchLeaderboardData('points', currentLeaderboardPeriod),
                fetchUserStats(currentUser.id),
                fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT),
                fetchTitleShopData()
            ]);
            console.log("[LoadAwards] Fetch results (settled):", results);

            const [
                badgesDefResult,
                userBadgesResult,
                leaderboardResult,
                statsResult,
                notificationsResult,
                titlesResult
            ] = results;

            allBadges = badgesDefResult.status === 'fulfilled' ? badgesDefResult.value : [];
            userBadges = userBadgesResult.status === 'fulfilled' ? userBadgesResult.value : [];
            leaderboardData = leaderboardResult.status === 'fulfilled' ? leaderboardResult.value : [];
            currentUserStats = statsResult.status === 'fulfilled' ? statsResult.value || {} : {};
            const fetchedNotifications = notificationsResult.status === 'fulfilled' ? notificationsResult.value : { unreadCount: 0, notifications: [] };
            allTitles = titlesResult.status === 'fulfilled' ? titlesResult.value : [];

            if (badgesDefResult.status === 'rejected') { console.error("❌ Error fetching all badges:", badgesDefResult.reason); showError("Nepodařilo se načíst definice odznaků."); }
            if (userBadgesResult.status === 'rejected') { console.error("❌ Error fetching user badges:", userBadgesResult.reason); showError("Nepodařilo se načíst získané odznaky."); }
            if (leaderboardResult.status === 'rejected') { console.error("❌ Error fetching leaderboard:", leaderboardResult.reason); showError("Nepodařilo se načíst žebříček."); }
            if (statsResult.status === 'rejected') { console.error("❌ Error fetching user stats:", statsResult.reason); showError("Nepodařilo se načíst statistiky."); }
            if (notificationsResult.status === 'rejected') { console.error("❌ Error fetching notifications:", notificationsResult.reason); showError("Nepodařilo se načíst oznámení."); }
            if (titlesResult.status === 'rejected') { console.error("❌ Error fetching titles:", titlesResult.reason); showError("Nepodařilo se načíst obchod s tituly."); }

            setLoadingState('userBadges', false);
            setLoadingState('recentBadges', false);
            setLoadingState('leaderboard', false);
            setLoadingState('stats', false);
            setLoadingState('notifications', false);
            setLoadingState('titleShop', false);

            renderAvailableBadges(allBadges, userBadges, currentProfile);
            setLoadingState('availableBadges', false); // Needs to be after renderAvailableBadges finishes its calculation
            updateStatsCards(currentProfile, currentUserStats, userBadges, leaderboardData);
            renderUserBadges(userBadges);
            renderRecentBadges(userBadges);
            renderLeaderboard(leaderboardData);
            renderNotifications(fetchedNotifications.unreadCount, fetchedNotifications.notifications);
            renderTitleShop(allTitles, currentProfile);

        } catch (error) { // Catch unexpected errors during processing/rendering
            console.error("❌ Unexpected error in loadAllAwardData during processing:", error);
            showError(`Nastala neočekávaná chyba při zpracování dat: ${error.message}`, true);
            setLoadingState('all', false);
            renderLeaderboard([]);
            renderTitleShop([], currentProfile); // Pass profile even on error to show credits
        } finally { // This block always executes
            console.log("🏁 [LoadAwards] Finished data fetch attempt.");
            // Ensure loading states are false in case of early exit or unhandled promise rejection within try
             setLoadingState('all', false);
        }
    }
    async function fetchAllBadgesDefinition() { console.log("[Badges] Fetching all badge definitions..."); if (!supabase) return []; try { const { data, error } = await supabase.from('badges').select('*').order('id'); if (error) throw error; console.log(`[Badges] Fetched ${data?.length || 0} badge definitions.`); return data || []; } catch (error) { console.error("[Badges] Error fetching definitions:", error); return []; } }
    async function fetchUserEarnedBadges(userId) { console.log(`[UserBadges] Fetching earned badges for user ${userId}...`); if (!supabase || !userId) return []; try { const { data, error } = await supabase .from('user_badges') .select(`badge_id, earned_at, badge:badges!inner (id, title, description, type, icon, requirements, points)`) .eq('user_id', userId) .order('earned_at', { ascending: false }); if (error) throw error; console.log(`[UserBadges] Fetched ${data?.length || 0} earned badges.`); return data || []; } catch (error) { console.error("[UserBadges] Error fetching earned badges:", error); return []; } }
    async function fetchLeaderboardData(filter = 'points', period = 'overall') { console.log(`[Leaderboard] Fetching data for period: ${period}, sorted by: ${filter}...`); if (!supabase) { console.error("Supabase client not initialized."); return []; } let orderColumn = 'points'; let ascendingOrder = false; if (filter === 'badges') { orderColumn = 'badges_count'; } else if (filter === 'streak') { orderColumn = 'rank'; ascendingOrder = true; console.warn("[Leaderboard] Sorting by streak requested, using rank order for fetch."); } try { const { data, error } = await supabase .from('leaderboard') .select(`rank, user_id, points, badges_count, profile:profiles!inner ( id, first_name, last_name, username, avatar_url, level, streak_days )`) .eq('period', period) .order(orderColumn, { ascending: ascendingOrder }) .limit(10); if (error) { console.error(`[Leaderboard] Supabase fetch error (sort: ${filter}, period: ${period}):`, error); throw error; } let rankedData = data || []; rankedData = rankedData.map((entry, index) => ({ ...entry, calculated_rank: index + 1 })); console.log(`[Leaderboard] Fetched ${rankedData.length} entries for period '${period}', ordered by ${orderColumn}.`); return rankedData; } catch (error) { console.error(`[Leaderboard] Exception during fetch (sort: ${filter}, period: ${period}):`, error); return []; } }
    async function fetchNotifications(userId, limit = 5) { if (!supabase || !userId) { console.error("[Notifications] Missing Supabase client or User ID."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Fetching unread notifications for user ${userId}`); try { const { data, error, count } = await supabase .from('user_notifications') .select('*', { count: 'exact' }) .eq('user_id', userId) .eq('is_read', false) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; console.log(`[Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); return { unreadCount: 0, notifications: [] }; } }
    // --- END: Data Loading Functions ---

    // --- START: UI Update Functions (Updated/Added) ---
    function updateSidebarProfile(profile, titlesData = allTitles) {
        console.log("[UI Update] Updating sidebar profile...");
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarRole) {
            console.warn("[UI Update] Sidebar elements (name, avatar, or role) not found.");
            return;
        }
        if (profile) {
            const firstName = profile.first_name ?? '';
            const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(profile);
            const avatarUrl = profile.avatar_url;
            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);

            const selectedTitleKey = profile.selected_title;
            let displayTitle = 'Pilot';
            if (selectedTitleKey && titlesData && titlesData.length > 0) {
                const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) {
                    displayTitle = foundTitle.name;
                } else {
                    console.warn(`[UI Update] Selected title key "${selectedTitleKey}" not found in titles data.`);
                }
            }
            ui.sidebarRole.textContent = sanitizeHTML(displayTitle);
            console.log(`[UI Update] Sidebar updated. Role set to: ${displayTitle}`);

        } else {
            console.warn("[UI Update] Missing profile data.");
            ui.sidebarName.textContent = "Pilot";
            ui.sidebarAvatar.textContent = '?';
            ui.sidebarRole.textContent = 'Pilot';
        }
    }
    function updateStatsCards(profileData, statsData, earnedBadgesData, leaderboard) { console.log("[UI Update] Updating stats cards with data:", profileData, statsData); const getStatValue = (value) => (value !== null && value !== undefined) ? value : '-'; const formatChange = (value, unit = '', iconUp = 'fa-arrow-up', iconDown = 'fa-arrow-down', iconNone = 'fa-minus') => { if (value === null || value === undefined || value === 0) return `<i class="fas ${iconNone}"></i> --`; const sign = value > 0 ? '+' : ''; const icon = value > 0 ? iconUp : iconDown; const cssClass = value > 0 ? 'positive' : 'negative'; return `<span class="${cssClass}"><i class="fas ${icon}"></i> ${sign}${value}${unit}</span>`; }; const statElements = { badgesCount: ui.badgesCount, badgesChange: ui.badgesChange, pointsCount: ui.pointsCount, pointsChange: ui.pointsChange, streakDays: ui.streakDays, streakChange: ui.streakChange, rankValue: ui.rankValue, rankChange: ui.rankChange, totalUsers: ui.totalUsers }; if (!profileData) { console.warn("[UI Update] Missing profile data for stats cards."); Object.values(statElements).forEach(el => { if(el && el.id !== 'total-users') el.textContent = '-'; }); if(statElements.badgesChange) statElements.badgesChange.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ERR`; if(statElements.pointsChange) statElements.pointsChange.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ERR`; if(statElements.streakChange) statElements.streakChange.textContent = `MAX: - dní`; if(statElements.rankChange) statElements.rankChange.innerHTML = `<i class="fas fa-users"></i> z ? pilotů`; return; } const badgesTotal = earnedBadgesData?.length ?? profileData.badges_count ?? 0; if(statElements.badgesCount) statElements.badgesCount.textContent = getStatValue(badgesTotal); if(statElements.badgesChange) statElements.badgesChange.innerHTML = `<i class="fas fa-sync-alt"></i> Aktualizováno`; if(statElements.pointsCount) statElements.pointsCount.textContent = getStatValue(profileData.points); const pointsWeekly = statsData?.points_weekly; if(statElements.pointsChange) statElements.pointsChange.innerHTML = formatChange(pointsWeekly, ' kr.'); if(statElements.streakDays) statElements.streakDays.textContent = getStatValue(profileData.streak_days); const longestStreak = statsData?.streak_longest ?? profileData.streak_days ?? '-'; if(statElements.streakChange) statElements.streakChange.textContent = `MAX: ${getStatValue(longestStreak)} dní`; const userRankEntry = leaderboard?.find(u => u.user_id === currentUser?.id); const rank = userRankEntry?.calculated_rank ?? '-'; const total = leaderboard?.length ?? 0; if(statElements.rankValue) statElements.rankValue.textContent = getStatValue(rank); if(statElements.rankChange && statElements.totalUsers) { statElements.rankChange.innerHTML = `<i class="fas fa-users"></i> z TOP ${total > 0 ? total : '?'} pilotů`; } console.log("[UI Update] Stats cards updated."); }
    function renderUserBadges(earnedBadges) { if (!ui.badgeGrid || !ui.emptyBadges || !ui.userBadgesContainer) return; setLoadingState('userBadges', false); ui.badgeGrid.innerHTML = ''; if (!earnedBadges || earnedBadges.length === 0) { ui.emptyBadges.style.display = 'block'; ui.badgeGrid.style.display = 'none'; return; } ui.emptyBadges.style.display = 'none'; ui.badgeGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); earnedBadges.forEach((ub, index) => { const badge = ub.badge; if (!badge) { console.warn("Missing badge details for user badge:", ub); return; } const badgeType = badge.type?.toLowerCase() || 'default'; const visual = badgeVisuals[badgeType] || badgeVisuals.default; const badgeElement = document.createElement('div'); badgeElement.className = 'badge-card card'; badgeElement.setAttribute('data-animate', ''); badgeElement.style.setProperty('--animation-order', index); badgeElement.innerHTML = `<div class="badge-icon ${badgeType}" style="background: ${visual.gradient};"><i class="fas ${visual.icon}"></i></div><h3 class="badge-title">${sanitizeHTML(badge.title)}</h3><p class="badge-desc">${sanitizeHTML(badge.description || '')}</p><div class="badge-date"><i class="far fa-calendar-alt"></i> ${formatDate(ub.earned_at)}</div>`; fragment.appendChild(badgeElement); }); ui.badgeGrid.appendChild(fragment); console.log(`[Render] Rendered ${earnedBadges.length} earned badges.`); requestAnimationFrame(initScrollAnimations); }
    function renderAvailableBadges(allBadgesDef, userEarnedBadges, userProfileData) { if (!ui.availableBadgesGrid || !ui.emptyAvailableBadges || !ui.availableBadgesContainer) { setLoadingState('availableBadges', false); return; } setLoadingState('availableBadges', false); ui.availableBadgesGrid.innerHTML = ''; const earnedIds = new Set(userEarnedBadges.map(ub => ub.badge_id)); const available = allBadgesDef.filter(b => !earnedIds.has(b.id)); if (available.length === 0) { ui.emptyAvailableBadges.style.display = 'block'; ui.availableBadgesGrid.style.display = 'none'; return; } ui.emptyAvailableBadges.style.display = 'none'; ui.availableBadgesGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); available.forEach((badge, index) => { const badgeType = badge.type?.toLowerCase() || 'default'; const visual = badgeVisuals[badgeType] || badgeVisuals.default; let progress = 0; let progressText = '???'; if (badge.requirements && typeof badge.requirements === 'object' && userProfileData) { const req = badge.requirements; let current = 0; let target = parseInt(req.target, 10) || 1; try { switch (req.type) { case 'points_earned': current = userProfileData.points || 0; progressText = `${current}/${target} KR`; break; case 'streak_days': current = userProfileData.streak_days || 0; progressText = `${current}/${target} dní`; break; case 'exercises_completed': current = userProfileData.completed_exercises || 0; progressText = `${current}/${target} cv.`; break; case 'level_reached': current = userProfileData.level || 1; progressText = `${current}/${target} úr.`; break; default: console.warn(`Unknown badge requirement type: ${req.type}`); progressText = '?/?'; } if (target > 0) { progress = Math.min(100, Math.max(0, Math.round((current / target) * 100))); } } catch(e) { console.error("Error calculating badge progress:", e, "Badge:", badge, "Profile:", userProfileData); progressText = 'Chyba'; } } else { progressText = 'Nespec.'; } const badgeElement = document.createElement('div'); badgeElement.className = 'achievement-card card'; badgeElement.setAttribute('data-animate', ''); badgeElement.style.setProperty('--animation-order', index); badgeElement.innerHTML = `<div class="achievement-icon ${badgeType}" style="background: ${visual.gradient};"><i class="fas ${visual.icon}"></i></div><div class="achievement-content"><h3 class="achievement-title">${sanitizeHTML(badge.title)}</h3><p class="achievement-desc">${sanitizeHTML(badge.description || '')}</p><div class="progress-container"><div class="progress-bar"><div class="progress-fill" style="width: ${progress}%; background: ${visual.gradient};"></div></div><div class="progress-stats">${progress}% (${progressText})</div></div></div>`; fragment.appendChild(badgeElement); }); ui.availableBadgesGrid.appendChild(fragment); console.log(`[Render] Rendered ${available.length} available badges.`); requestAnimationFrame(initScrollAnimations); }
    function renderLeaderboardSkeleton() { if (!ui.leaderboardBody || !ui.leaderboardSkeleton) return; console.log("[Leaderboard] Rendering Skeleton"); ui.leaderboardSkeleton.style.display = 'block'; ui.leaderboardBody.innerHTML = ''; if(ui.leaderboardTableContainer) ui.leaderboardTableContainer.style.visibility = 'hidden'; if(ui.leaderboardHeaderElement) ui.leaderboardHeaderElement.style.visibility = 'hidden'; if(ui.leaderboardEmpty) ui.leaderboardEmpty.style.display = 'none'; }
    function renderLeaderboard(data) { if (!ui.leaderboardBody || !ui.leaderboardEmpty || !ui.leaderboardContainer || !ui.leaderboardSkeleton || !ui.leaderboardTableContainer || !ui.leaderboardHeaderElement) { console.error("Leaderboard UI elements not found."); setLoadingState('leaderboard', false); return; } ui.leaderboardSkeleton.style.display = 'none'; ui.leaderboardTableContainer.style.visibility = 'visible'; ui.leaderboardHeaderElement.style.visibility = 'visible'; ui.leaderboardBody.innerHTML = ''; if (!data || data.length === 0) { ui.leaderboardEmpty.style.display = 'block'; ui.leaderboardTableContainer.style.display = 'none'; console.log("[Render] Leaderboard empty."); } else { ui.leaderboardEmpty.style.display = 'none'; ui.leaderboardTableContainer.style.display = 'block'; const fragment = document.createDocumentFragment(); data.forEach((entry) => { const userProfile = entry.profile; if (!userProfile) { console.warn(`Missing profile data for user_id: ${entry.user_id} in leaderboard entry. Skipping.`); return; } const rank = entry.calculated_rank || '?'; const isCurrentUser = entry.user_id === currentUser?.id; const displayName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.username || `Pilot #${entry.user_id.substring(0, 4)}`; const initials = getInitials(userProfile); const avatarUrl = userProfile.avatar_url; const pointsValue = entry.points ?? 0; const badgesCount = entry.badges_count ?? 0; const streakValue = userProfile.streak_days ?? 0; const rowElement = document.createElement('tr'); if (isCurrentUser) rowElement.classList.add('highlight-row'); rowElement.innerHTML = `<td class="rank-cell">${rank}</td><td class="user-cell"><div class="user-avatar-sm">${avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(displayName)}">` : sanitizeHTML(initials)}</div><div class="user-info-sm"><div class="user-name-sm">${sanitizeHTML(displayName)}</div><div class="user-level">Úroveň ${userProfile.level || 1}</div></div></td><td class="score-cell">${pointsValue}</td><td class="badge-count-cell">${badgesCount}</td><td class="streak-cell">${streakValue}</td>`; fragment.appendChild(rowElement); }); ui.leaderboardBody.appendChild(fragment); console.log(`[Render] Rendered ${data.length} leaderboard entries.`); } setLoadingState('leaderboard', false); }
    function renderRecentBadges(earnedBadges) { if (!ui.recentAchievementsList || !ui.recentAchievementsSection) { setLoadingState('recentBadges', false); return; } setLoadingState('recentBadges', false); ui.recentAchievementsList.innerHTML = ''; const recent = earnedBadges.slice(0, 5); if (recent.length === 0) { ui.recentAchievementsSection.style.display = 'none'; return; } ui.recentAchievementsSection.style.display = 'block'; const fragment = document.createDocumentFragment(); recent.forEach((ub, index) => { const badge = ub.badge; if (!badge) return; const badgeType = badge.type?.toLowerCase() || 'default'; const visual = badgeVisuals[badgeType] || badgeVisuals.default; const badgeElement = document.createElement('div'); badgeElement.className = `achievement-item`; badgeElement.innerHTML = `<div class="achievement-item-icon ${badgeType}" style="background: ${visual.gradient};"><i class="fas ${visual.icon}"></i></div><div class="achievement-item-content"><h3 class="achievement-item-title">${sanitizeHTML(badge.title)}</h3><p class="achievement-item-desc">${sanitizeHTML(badge.description || '')}</p><div class="achievement-item-time"><i class="far fa-calendar-alt"></i> ${formatDate(ub.earned_at)}</div></div>`; fragment.appendChild(badgeElement); }); ui.recentAchievementsList.appendChild(fragment); console.log(`[Render] Rendered ${recent.length} recent badges.`); requestAnimationFrame(initScrollAnimations); }
    function renderNotifications(count, notifications) { console.log("[Render Notifications UI] Start, Count:", count, "Notifications:", notifications); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications UI] Missing UI elements."); setLoadingState('notifications', false); return; } setLoadingState('notifications', false); ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } console.log("[Render Notifications UI] Finished rendering."); }
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    async function markNotificationRead(notificationId) { console.log("[FUNC] markNotificationRead: Marking ID:", notificationId); if (!currentUser || !notificationId) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[FUNC] markNotificationRead: Success for ID:", notificationId); return true; } catch (error) { console.error("[FUNC] markNotificationRead: Error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { console.log("[FUNC] markAllNotificationsRead: Start for user:", currentUser?.id); if (!currentUser || !supabase || !ui.markAllReadBtn) return; if (isLoading.notifications) return; setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; try { const { error } = await supabase .from('user_notifications') .update({ is_read: true }) .eq('user_id', currentUser.id) .eq('is_read', false); if (error) throw error; console.log("[FUNC] markAllNotificationsRead: DB update successful"); const { unreadCount, notifications } = await fetchNotifications(currentUser.id, 5); renderNotifications(unreadCount, notifications); showToast('Oznámení Vymazána', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[FUNC] markAllNotificationsRead: Error:", error); showToast('Chyba', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }

    function renderTitleShop(titles, userProfile) {
        if (!ui.titleShopGrid || !ui.titleShopEmpty || !ui.titleShopContainer || !ui.shopUserCredits || !userProfile) {
            console.error("[Render Title Shop] Missing UI elements or user profile.");
            setLoadingState('titleShop', false);
            return;
        }
        console.log("[Render Title Shop] Rendering titles:", titles);
        setLoadingState('titleShop', false);

        ui.shopUserCredits.textContent = userProfile.points ?? 0;
        ui.titleShopGrid.innerHTML = '';

        if (!titles || titles.length === 0) {
            ui.titleShopEmpty.style.display = 'block';
            ui.titleShopGrid.style.display = 'none';
            console.log("[Render Title Shop] No titles available.");
            return;
        }

        ui.titleShopEmpty.style.display = 'none';
        ui.titleShopGrid.style.display = 'grid';

        const fragment = document.createDocumentFragment();
        const purchasedKeys = new Set(userProfile.purchased_titles || []);
        const selectedKey = userProfile.selected_title;

        titles.forEach((title, index) => {
            const isPurchased = purchasedKeys.has(title.title_key);
            const isEquipped = isPurchased && title.title_key === selectedKey;

            const itemElement = document.createElement('div');
            itemElement.className = 'title-item card';
            itemElement.setAttribute('data-title-key', title.title_key);
            itemElement.setAttribute('data-title-cost', title.cost);
            itemElement.setAttribute('data-animate', '');
            itemElement.style.setProperty('--animation-order', index);

            itemElement.innerHTML = `
                <div class="title-item-icon">
                    <i class="${sanitizeHTML(title.icon || 'fas fa-user-tag')}"></i>
                </div>
                <div class="title-item-content">
                    <h4 class="title-item-name">${sanitizeHTML(title.name)}</h4>
                    ${title.description ? `<p class="title-item-desc">${sanitizeHTML(title.description)}</p>` : ''}
                    <div class="title-item-footer">
                        <span class="title-item-cost">Cena: ${title.cost} <i class="fas fa-coins"></i></span>
                        <div class="title-item-actions">
                            <button class="btn btn-sm btn-primary buy-title-btn" ${isPurchased ? 'style="display: none;"' : ''} ${userProfile.points < title.cost ? 'disabled' : ''}>
                                <i class="fas fa-shopping-cart"></i> Koupit
                            </button>
                            <span class="title-status purchased" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}>
                                <i class="fas fa-check"></i> Zakoupeno
                            </span>
                            <span class="title-status equipped" ${isEquipped ? '' : 'style="display: none;"'}>
                                <i class="fas fa-user-check"></i> Používá se
                            </span>
                            <button class="btn btn-sm btn-secondary equip-title-btn" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}>
                                <i class="fas fa-check-square"></i> Použít
                            </button>
                        </div>
                    </div>
                </div>
            `;
            fragment.appendChild(itemElement);
        });

        ui.titleShopGrid.appendChild(fragment);
        console.log(`[Render Title Shop] Rendered ${titles.length} titles.`);
        requestAnimationFrame(initScrollAnimations);
    }
    // --- END: UI Update Functions ---

    // --- START: Event Listeners & Handlers (Updated/Added) ---
    function setupUIEventListeners() {
        console.log("[SETUP] setupUIEventListeners: Start");
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
        document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });
        window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();
        if (ui.refreshDataBtn) { ui.refreshDataBtn.addEventListener('click', handleGlobalRetry); }

        if (ui.notificationBell) ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); });
        if (ui.markAllReadBtn) ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead);
        if (ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }); }
        document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } });

        if (ui.titleShopGrid) {
            ui.titleShopGrid.addEventListener('click', (event) => {
                const buyButton = event.target.closest('.buy-title-btn');
                const equipButton = event.target.closest('.equip-title-btn');

                if (buyButton) {
                    const titleItem = buyButton.closest('.title-item');
                    const titleKey = titleItem?.dataset.titleKey;
                    const titleCost = parseInt(titleItem?.dataset.titleCost, 10);
                    if (titleKey && !isNaN(titleCost)) {
                        handleBuyTitle(titleKey, titleCost, buyButton);
                    } else {
                        console.error("Could not get title key or cost from button:", buyButton);
                        showToast('Chyba', 'Nelze zpracovat nákup, chybí data titulu.', 'error');
                    }
                } else if (equipButton) {
                    const titleItem = equipButton.closest('.title-item');
                    const titleKey = titleItem?.dataset.titleKey;
                    if (titleKey) {
                        handleEquipTitle(titleKey, equipButton);
                    } else {
                        console.error("Could not get title key from button:", equipButton);
                        showToast('Chyba', 'Nelze nastavit titul, chybí data.', 'error');
                    }
                }
            });
        }

        console.log("[SETUP] setupUIEventListeners: Listeners set (including Title Shop).");
    }

    async function handleGlobalRetry() { console.log("🔄 Global retry triggered..."); if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné být přihlášen a mít načtený profil.", "error"); if (!currentProfile) await initializeApp(); return; } if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; } hideError(); if (ui.refreshDataBtn) { const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; ui.refreshDataBtn.disabled = true; } await loadAllAwardData(); if (ui.refreshDataBtn) { const icon = ui.refreshDataBtn.querySelector('i'); const text = ui.refreshDataBtn.querySelector('.refresh-text'); if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; ui.refreshDataBtn.disabled = false; } }

    // <<< CORRECTED: handleBuyTitle with proper try-catch >>>
    async function handleBuyTitle(titleKey, cost, buttonElement) {
        console.log(`[Title Shop] Attempting to buy title: ${titleKey} for ${cost} credits.`);
        if (!currentProfile || !supabase || !currentUser) {
            showToast('Chyba', 'Nelze provést nákup, chybí data uživatele.', 'error');
            return;
        }

        const currentCredits = currentProfile.points ?? 0;
        if (currentCredits < cost) {
            showToast('Nedostatek Kreditů', `Potřebujete ${cost} kreditů, máte ${currentCredits}.`, 'warning');
            return;
        }

        const titleData = allTitles.find(t => t.title_key === titleKey);
        const titleName = titleData?.name || titleKey;
        if (!confirm(`Opravdu chcete koupit titul "${titleName}" za ${cost} kreditů?`)) {
            return;
        }

        buttonElement.disabled = true;
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kupuji...';

        // --- Start of try block ---
        try {
            const currentPurchased = Array.isArray(currentProfile.purchased_titles) ? currentProfile.purchased_titles : [];

            if (currentPurchased.includes(titleKey)) {
                 showToast('Již Vlastněno', 'Tento titul již máte zakoupený.', 'info');
                 buttonElement.innerHTML = '<i class="fas fa-shopping-cart"></i> Koupit';
                 renderTitleShop(allTitles, currentProfile);
                 return; // Exit if already purchased
            }

            const newCredits = currentCredits - cost;
            const newPurchasedTitles = [...currentPurchased, titleKey];

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    points: newCredits,
                    purchased_titles: newPurchasedTitles
                })
                .eq('id', currentUser.id);

            // This is the line that might have caused the error if not inside try
            if (updateError) {
                 throw updateError; // Throw error to be caught by catch block
            }

            // --- Success path ---
            currentProfile.points = newCredits;
            currentProfile.purchased_titles = newPurchasedTitles;

            if (ui.shopUserCredits) ui.shopUserCredits.textContent = newCredits;
            if (ui.pointsCount) ui.pointsCount.textContent = newCredits;
            renderTitleShop(allTitles, currentProfile);

            showToast('Nákup Úspěšný', `Titul "${titleName}" byl zakoupen!`, 'success');
            console.log(`[Title Shop] Successfully bought title: ${titleKey}`);

        // --- End of try block ---
        } catch (error) { // --- Start of catch block (Handles errors from try) ---
            console.error(`[Title Shop] Error buying title ${titleKey}:`, error);
            showToast('Chyba Nákupu', `Nepodařilo se zakoupit titul: ${error.message}`, 'error');
            // Button state handled in finally
        // --- End of catch block ---
        } finally { // --- Start of finally block (Always runs) ---
             // Reset button state regardless of success or error
            buttonElement.disabled = false; // Re-enable
            buttonElement.innerHTML = '<i class="fas fa-shopping-cart"></i> Koupit';
            // Re-check if purchase is possible after operation
            const stillOwned = (currentProfile.purchased_titles || []).includes(titleKey);
            if (stillOwned) {
                 buttonElement.style.display = 'none'; // Hide if now owned
            } else if (currentProfile.points < cost) {
                 buttonElement.disabled = true; // Disable if not enough points now
            }
        // --- End of finally block ---
        }
    } // --- End of handleBuyTitle ---

    // <<< CORRECTED: handleEquipTitle with proper try-catch >>>
    async function handleEquipTitle(titleKey, buttonElement) {
        console.log(`[Title Shop] Attempting to equip title: ${titleKey}.`);
         if (!currentProfile || !supabase || !currentUser) {
            showToast('Chyba', 'Nelze nastavit titul, chybí data uživatele.', 'error');
            return;
        }

         const purchasedKeys = Array.isArray(currentProfile.purchased_titles) ? currentProfile.purchased_titles : [];
         if (!purchasedKeys.includes(titleKey)) {
             showToast('Chyba', 'Tento titul nemáte zakoupený.', 'error');
             renderTitleShop(allTitles, currentProfile);
             return;
         }

         if (currentProfile.selected_title === titleKey) {
             showToast('Již Používáte', 'Tento titul již máte nastavený.', 'info');
             return;
         }

         buttonElement.disabled = true;
         buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Nastavuji...';

         // --- Start of try block ---
         try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ selected_title: titleKey })
                .eq('id', currentUser.id);

            // This is the line that might have caused the error if not inside try
            if (updateError) {
                throw updateError; // Throw error to be caught by catch block
            }

            // --- Success path ---
            currentProfile.selected_title = titleKey;

            renderTitleShop(allTitles, currentProfile);
            updateSidebarProfile(currentProfile, allTitles);

            const titleData = allTitles.find(t => t.title_key === titleKey);
            const titleName = titleData?.name || titleKey;
            showToast('Titul Nastaven', `Nyní používáte titul "${titleName}".`, 'success');
            console.log(`[Title Shop] Successfully equipped title: ${titleKey}`);

         // --- End of try block ---
         } catch (error) { // --- Start of catch block (Handles errors from try) ---
             console.error(`[Title Shop] Error equipping title ${titleKey}:`, error);
             showToast('Chyba Nastavení', `Nepodařilo se nastavit titul: ${error.message}`, 'error');
             // Button state handled in finally
         // --- End of catch block ---
         } finally { // --- Start of finally block (Always runs) ---
              // Reset button state regardless of success or error
             buttonElement.disabled = false; // Re-enable
             buttonElement.innerHTML = '<i class="fas fa-check-square"></i> Použít';
              // Re-check if equip is possible after operation
             const stillSelected = currentProfile.selected_title === titleKey;
             const stillOwned = (currentProfile.purchased_titles || []).includes(titleKey);
             if (stillSelected || !stillOwned) {
                 buttonElement.style.display = 'none'; // Hide if now equipped or somehow not owned
             }
         // --- End of finally block ---
         }
    } // --- End of handleEquipTitle ---

    // --- END: Event Listeners & Handlers ---

    // --- Initialize the Application ---
    initializeApp();

})(); // End of IIFE