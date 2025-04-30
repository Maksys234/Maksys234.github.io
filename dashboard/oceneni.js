// ============================================================================
// oceneni.js -- Hlavní skript pro stránku Ocenění
// Copyright © 2024-2025 Mertkay <<=>> Antares // Все права защищены
// ============================================================================

// ----------------------------------------------------------------------------
// Globální konstanty a proměnné
// ----------------------------------------------------------------------------
const SUPABASE_URL = 'https://ivkddmqazqmlwslsdoht.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2a2RkbXFhenFtbHdzbHNkb2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc5NTg4MDksImV4cCI6MjAzMzUzNDgwOX0.193w5rJqagvWk0J087XFpL2QY1p-t7oNf626hFjXfFk';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const USER_PROFILE_KEY = 'userProfileData';
const LAST_FETCH_TIME_KEY = 'lastFetchTime_achievements';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minut v milisekundách
const SIDEBAR_STATE_KEY = 'sidebarState'; // <<< ДОБАВЛЕНО: Ключ для localStorage >>>

let currentUser = null;
let userProfileData = null;
let lastFetchTime = 0;
let currentNotifications = [];

// Elementy DOM
const elements = {
    initialLoader: document.getElementById('initial-loader'),
    mainContent: document.getElementById('main-content'),
    sidebarAvatar: document.getElementById('sidebar-avatar'),
    sidebarName: document.getElementById('sidebar-name'),
    badgesCount: document.getElementById('badges-count'),
    badgesChange: document.getElementById('badges-change'),
    pointsCount: document.getElementById('points-count'),
    pointsChange: document.getElementById('points-change'),
    streakDays: document.getElementById('streak-days'),
    streakChange: document.getElementById('streak-change'),
    rankValue: document.getElementById('rank-value'),
    rankChange: document.getElementById('rank-change'),
    totalUsers: document.getElementById('total-users'),
    badgeGrid: document.getElementById('badge-grid'),
    emptyBadges: document.getElementById('empty-badges'),
    availableBadgesGrid: document.getElementById('available-badges-grid'),
    emptyAvailableBadges: document.getElementById('empty-available-badges'),
    leaderboardBody: document.getElementById('leaderboard-body'),
    leaderboardEmpty: document.getElementById('leaderboard-empty'),
    toastContainer: document.getElementById('toast-container'),
    notificationBell: document.getElementById('notification-bell'),
    notificationCount: document.getElementById('notification-count'),
    notificationsDropdown: document.getElementById('notifications-dropdown'),
    notificationsList: document.getElementById('notifications-list'),
    noNotificationsMsg: document.getElementById('no-notifications-msg'),
    markAllReadBtn: document.getElementById('mark-all-read'),
    refreshBtn: document.getElementById('refresh-data-btn'),
    offlineBanner: document.getElementById('offline-banner'),
    globalErrorContainer: document.getElementById('global-error'),
    userBadgesContainer: document.getElementById('user-badges-container'),
    availableBadgesContainer: document.getElementById('available-badges-container'),
    leaderboardContainer: document.getElementById('leaderboard-container'),
    achievementStatsContainer: document.getElementById('achievement-stats-container'),
    recentAchievementsSection: document.getElementById('recent-achievements-section'),
    recentAchievementsList: document.getElementById('recent-achievements-list'),
    mouseFollower: document.getElementById('mouse-follower'),
    sidebar: document.getElementById('sidebar'), // <<< ДОБАВЛЕНО: Элемент сайдбара >>>
    sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'), // <<< ДОБАВЛЕНО: Кнопка переключения сайдбара >>>
    mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'), // Mobile menu (main content)
    sidebarCloseToggle: document.getElementById('sidebar-close-toggle'), // Mobile menu (sidebar)
    sidebarOverlay: document.getElementById('sidebar-overlay'), // Mobile overlay
    titleShopContainer: document.getElementById('title-shop-container'),
    titleShopGrid: document.getElementById('title-shop-grid'),
    titleShopLoading: document.getElementById('title-shop-loading'),
    titleShopEmpty: document.getElementById('title-shop-empty'),
    shopUserCredits: document.getElementById('shop-user-credits')
};

// ----------------------------------------------------------------------------
// Obecné pomocné funkce
// ----------------------------------------------------------------------------

/** Získá počáteční písmeno nebo avatar uživatele */
const getAvatarContent = (profile) => profile?.avatar_url ? `<img src="${profile.avatar_url}" alt="Avatar">` : (profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : '?');

/** Formátuje čísla pro zobrazení */
const formatNumber = (num) => num?.toLocaleString('cs-CZ') ?? '-';

/** Formátuje datum a čas */
const formatDateTime = (dateString) => {
    if (!dateString) return 'Neznámé datum';
    const date = new Date(dateString);
    return isNaN(date) ? 'Neplatné datum' : date.toLocaleString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Formátuje relativní čas */
function timeAgo(dateInput) {
    if (!dateInput) return "";
    const date = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const seconds = Math.round(Math.abs(now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const months = Math.round(days / 30);
    const years = Math.round(days / 365);

    const rtf = new Intl.RelativeTimeFormat('cs', { numeric: 'auto' });

    if (seconds < 60) return rtf.format(-seconds, 'second');
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    if (hours < 24) return rtf.format(-hours, 'hour');
    if (days < 30) return rtf.format(-days, 'day');
    if (months < 12) return rtf.format(-months, 'month');
    return rtf.format(-years, 'year');
}

/** Zobrazí toast notifikaci */
function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let iconClass = 'fas fa-info-circle';
    if (type === 'success') iconClass = 'fas fa-check-circle';
    else if (type === 'error') iconClass = 'fas fa-exclamation-circle';
    else if (type === 'warning') iconClass = 'fas fa-exclamation-triangle';

    toast.innerHTML = `<i class="${iconClass}"></i><p>${message}</p><button class="toast-close-btn">&times;</button>`;
    elements.toastContainer.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close-btn');
    closeBtn.addEventListener('click', () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 500);
    });

    setTimeout(() => {
        toast.classList.add('show');
    }, 10); // Malé zpoždění pro CSS transition

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 500);
    }, duration);
}

/** Zpracování chyb a zobrazení uživateli */
function handleError(error, contextMessage, isFatal = false) {
    console.error(`Chyba v [${contextMessage}]:`, error);
    const friendlyMessage = `Došlo k chybě: ${contextMessage}. Zkuste prosím obnovit stránku. (${error?.message || 'Neznámá chyba'})`;

    if (isFatal) {
        elements.initialLoader.style.display = 'none';
        elements.mainContent.style.display = 'none';
        elements.globalErrorContainer.textContent = friendlyMessage + " // FATAL ERROR";
        elements.globalErrorContainer.style.display = 'block';
    } else {
        showToast(friendlyMessage, 'error', 6000);
        // Optionally display non-fatal errors somewhere specific
        // elements.globalErrorContainer.textContent = friendlyMessage;
        // elements.globalErrorContainer.style.display = 'block';
    }
}

/** Odstraní skeleton loading třídy a data atributy */
function removeLoadingState(container, cardSelector = '.card.loading', skeletonSelector = '.loading-skeleton') {
    if (container) {
        container.classList.remove('loading');
        const skeletons = container.querySelectorAll(skeletonSelector);
        skeletons.forEach(sk => sk.remove());
        const loadingCards = container.querySelectorAll(cardSelector);
        loadingCards.forEach(card => card.classList.remove('loading'));
    } else {
        console.warn("Container pro removeLoadingState nebyl nalezen.");
    }
}

/** Animace prvků při vstupu do viewportu */
function setupIntersectionObserver() {
    const animatedElements = document.querySelectorAll('[data-animate]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target); // Observe only once
            }
        });
    }, { threshold: 0.1 });

    animatedElements.forEach(el => {
        observer.observe(el);
    });
}

// ----------------------------------------------------------------------------
// Autentizace a načítání profilu
// ----------------------------------------------------------------------------

/** Získá aktuálně přihlášeného uživatele */
async function getCurrentUser() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session?.user) {
            console.log("Uživatel není přihlášen, přesměrování na login.");
            window.location.href = '/auth/index.html';
            return null;
        }
        currentUser = session.user;
        return currentUser;
    } catch (error) {
        handleError(error, "Ověření uživatele", true); // Fatal if auth fails
        return null;
    }
}

/** Načte profil uživatele z DB nebo localStorage */
async function loadUserProfile(userId) {
    // Try cache first
    const cachedProfile = localStorage.getItem(USER_PROFILE_KEY);
    if (cachedProfile) {
        try {
            userProfileData = JSON.parse(cachedProfile);
            updateSidebarProfile(userProfileData);
            // Optionally, check cache expiry here if needed
        } catch (e) {
            console.error("Chyba parsování profilu z cache:", e);
            localStorage.removeItem(USER_PROFILE_KEY); // Clear invalid cache
        }
    }

    // Fetch from DB if not cached or for update
    try {
        const { data, error, status } = await supabase
            .from('profiles')
            .select('username, full_name, avatar_url, xp_points, credits, title') // Adjust columns as needed
            .eq('id', userId)
            .single();

        if (error && status !== 406) throw error; // 406 = No rows found, handle gracefully

        if (data) {
            userProfileData = data;
            localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(userProfileData));
            updateSidebarProfile(userProfileData);
            updateShopCredits(userProfileData.credits); // Aktualizace kreditů v obchodě
        } else if (!userProfileData) { // If no data from DB and no cache
            console.warn("Profil uživatele nenalezen v DB.");
            showToast("Profil nenalezen, některé funkce mohou být omezeny.", "warning");
            updateSidebarProfile(null); // Show default/loading state
            updateShopCredits(0); // Default credits if no profile
        }
    } catch (error) {
        handleError(error, "Načítání profilu uživatele");
        if (!userProfileData) updateSidebarProfile(null); // Ensure sidebar shows loading/error if fetch fails
        if (!userProfileData?.credits) updateShopCredits(0);
    }
    return userProfileData;
}


/** Aktualizuje profil v sidebaru */
function updateSidebarProfile(profile) {
    elements.sidebarAvatar.innerHTML = getAvatarContent(profile);
    elements.sidebarName.textContent = profile?.full_name || profile?.username || 'Neznámý Pilot';
    // Role (pokud je uložena v profilu nebo ji získáme jinak)
    // elements.sidebarRole.textContent = profile?.role || 'Pilot';
}

// ----------------------------------------------------------------------------
// Načítání dat (Ocenění, Statistiky, Žebříček)
// ----------------------------------------------------------------------------

/** Načte všechna potřebná data pro stránku */
async function loadAllData(forceRefresh = false) {
    elements.globalErrorContainer.style.display = 'none'; // Hide previous errors
    if (!currentUser) {
        handleError(new Error("Uživatel není inicializován"), "Přednačtení dat", true);
        return;
    }

    const now = Date.now();
    const isCacheValid = !forceRefresh && (now - lastFetchTime < CACHE_DURATION);

    if (isCacheValid) {
        console.log("Použití cache pro data ocenění.");
        // Maybe just hide loader and show content if we assume cache is fully displayed
        elements.initialLoader.style.display = 'none';
        elements.mainContent.style.display = 'block';
        return; // Data should already be displayed from previous load
    }

    console.log(forceRefresh ? "Vynucené obnovení dat." : "Načítání nových dat ocenění.");
    setLoadingState(true); // Show loading indicators on sections

    try {
        // Use Promise.allSettled to load data in parallel and handle partial failures
        const results = await Promise.allSettled([
            loadAchievementStats(currentUser.id),
            loadUserBadges(currentUser.id),
            loadAvailableBadges(currentUser.id),
            loadLeaderboard(),
            loadNotifications(currentUser.id),
            loadRecentAchievements(currentUser.id),
            loadTitleShopItems(currentUser.id), // Add title shop loading
            loadUserProfile(currentUser.id) // Ensure profile (especially credits) is fresh
        ]);

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const contextMap = ["statistiky", "uživatelské odznaky", "dostupné výzvy", "žebříček", "notifikace", "nedávné úspěchy", "obchod s tituly", "profil"];
                handleError(result.reason, `Načítání ${contextMap[index]}`);
            }
        });

        lastFetchTime = Date.now();
        localStorage.setItem(LAST_FETCH_TIME_KEY, lastFetchTime.toString());

    } catch (error) {
        // This catch block might be redundant if Promise.allSettled handles all errors
        handleError(error, "Načítání všech dat");
    } finally {
        setLoadingState(false); // Hide all loading indicators
        elements.initialLoader.style.display = 'none'; // Hide initial page loader
        elements.mainContent.style.display = 'block'; // Show content
        setupIntersectionObserver(); // Re-apply animations after content load
        elements.refreshBtn.classList.remove('loading'); // Stop refresh button animation
    }
}

/** Nastaví loading stav pro různé sekce */
function setLoadingState(isLoading) {
    const sections = [
        elements.achievementStatsContainer,
        elements.userBadgesContainer,
        elements.availableBadgesContainer,
        elements.leaderboardContainer,
        elements.titleShopContainer
        // elements.recentAchievementsSection - handled separately as it might be hidden
    ];
    const statCards = elements.achievementStatsContainer.querySelectorAll('.stat-card');

    if (isLoading) {
        sections.forEach(sec => sec?.classList.add('loading'));
        statCards.forEach(card => card.classList.add('loading'));
        elements.titleShopLoading.classList.add('visible-loader');
        elements.titleShopGrid.style.display = 'none';
        // Ensure recent achievements skeleton is shown if section will be displayed
        if (elements.recentAchievementsSection?.style.display !== 'none') {
            elements.recentAchievementsSection.classList.add('loading');
            // Add skeleton generation logic here if needed dynamically
        }
    } else {
        sections.forEach(sec => removeLoadingState(sec));
        statCards.forEach(card => removeLoadingState(card, null, '.loading-skeleton')); // Remove specific skeleton
        removeLoadingState(elements.userBadgesContainer, '.badge-card.loading', '.loading-skeleton');
        removeLoadingState(elements.availableBadgesContainer, '.achievement-card.loading', '.loading-skeleton');
        removeLoadingState(elements.leaderboardContainer, null, '.loading-skeleton.leaderboard-skeleton');
        removeLoadingState(elements.titleShopContainer, '.title-item.card.loading', '.loading-skeleton');
        elements.titleShopLoading.classList.remove('visible-loader');

        // Only remove loading from recent if it was displayed
        if (elements.recentAchievementsSection?.style.display !== 'none') {
             removeLoadingState(elements.recentAchievementsSection, null, '.loading-skeleton');
        }
    }
}


/** Načte statistiky úspěchů */
async function loadAchievementStats(userId) {
    try {
        const { data, error } = await supabase.rpc('get_user_achievement_stats', { p_user_id: userId });
        if (error) throw error;

        if (data && data.length > 0) {
            const stats = data[0];
            elements.badgesCount.textContent = formatNumber(stats.total_badges);
            // TODO: Calculate and display change for badges (requires historical data)
            elements.badgesChange.innerHTML = `<i class="fas fa-check"></i> Získáno celkem`;

            elements.pointsCount.textContent = formatNumber(stats.total_credits); // Assuming RPC returns this
            // TODO: Calculate and display change for points
            elements.pointsChange.innerHTML = `<i class="fas fa-coins"></i> Kreditů celkem`;

            elements.streakDays.textContent = `${formatNumber(stats.current_streak)} Dní`;
            elements.streakChange.textContent = `MAX: ${formatNumber(stats.max_streak)} dní`;

            elements.rankValue.textContent = `#${formatNumber(stats.user_rank)}`;
            elements.totalUsers.textContent = formatNumber(stats.total_users);
            elements.rankChange.innerHTML = `<i class="fas fa-users"></i> z ${formatNumber(stats.total_users)} pilotů`;

        } else {
            console.warn("Statistiky úspěchů nenalezeny.");
            // Display default/zero state
            elements.badgesCount.textContent = '0';
            elements.pointsCount.textContent = '0';
            elements.streakDays.textContent = '0 Dní';
            elements.rankValue.textContent = '-';
            elements.totalUsers.textContent = '-';
        }
        removeLoadingState(elements.achievementStatsContainer, '.stat-card.loading'); // Pass specific card selector

    } catch (error) {
        handleError(error, "Načítání statistik úspěchů");
        // Keep loading state or show error in cards? For now, just log.
    }
}


/** Načte odznaky uživatele */
async function loadUserBadges(userId) {
    try {
        const { data, error } = await supabase
            .from('user_badges')
            .select(`
                earned_at,
                badges ( id, name, description, icon_url, rarity )
            `)
            .eq('user_id', userId)
            .order('earned_at', { ascending: false });

        if (error) throw error;

        elements.badgeGrid.innerHTML = ''; // Clear previous/skeleton
        if (data && data.length > 0) {
            data.forEach(ub => {
                const badge = ub.badges;
                const badgeCard = document.createElement('div');
                badgeCard.className = `badge-card rarity-${badge.rarity || 'common'}`;
                 badgeCard.setAttribute('data-tooltip-content', `#tooltip-${badge.id}`); // For Tooltipster

                badgeCard.innerHTML = `
                    <div class="badge-icon">
                        <img src="${badge.icon_url || 'placeholder.png'}" alt="${badge.name}" onerror="this.src='placeholder.png';">
                    </div>
                    <div class="badge-info">
                        <h3 class="badge-title">${badge.name}</h3>
                        <p class="badge-date">Získáno: ${formatDateTime(ub.earned_at)}</p>
                    </div>
                    <div class="tooltip_templates">
                         <div id="tooltip-${badge.id}">
                              <h4>${badge.name} <span class="rarity-label ${badge.rarity || 'common'}">${badge.rarity || 'Běžný'}</span></h4>
                              <p>${badge.description}</p>
                              <small>Získáno: ${formatDateTime(ub.earned_at)}</small>
                         </div>
                     </div>
                `;
                elements.badgeGrid.appendChild(badgeCard);
            });
             elements.emptyBadges.style.display = 'none';
             $('.badge-card').tooltipster({ // Initialize Tooltipster
                 theme: 'tooltipster-noir', // Optional theme
                 contentCloning: true,
                 interactive: true,
                 delay: 100,
                 animation: 'fade', // Optional animation
                 trigger: 'hover'
              });
        } else {
            elements.emptyBadges.style.display = 'flex';
        }
        removeLoadingState(elements.userBadgesContainer); // Remove general loading

    } catch (error) {
        handleError(error, "Načítání odznaků uživatele");
        elements.badgeGrid.innerHTML = '<p class="error-message">Chyba načítání odznaků.</p>'; // Show error in grid
        elements.emptyBadges.style.display = 'none';
        removeLoadingState(elements.userBadgesContainer);
    }
}


/** Načte dostupné výzvy/odznaky (které uživatel ještě nemá) */
async function loadAvailableBadges(userId) {
    try {
        // 1. Získat ID odznaků, které uživatel již má
        const { data: userBadgeIdsData, error: userBadgeIdsError } = await supabase
            .from('user_badges')
            .select('badge_id')
            .eq('user_id', userId);

        if (userBadgeIdsError) throw userBadgeIdsError;
        const userEarnedBadgeIds = userBadgeIdsData.map(ub => ub.badge_id);

        // 2. Získat všechny odznaky, které uživatel NEMÁ
        let query = supabase
            .from('badges')
            .select('id, name, description, icon_url, rarity, goal_description, goal_value, type'); // Include progress fields

        // Pokud uživatel má nějaké odznaky, vyloučíme je
        if (userEarnedBadgeIds.length > 0) {
            query = query.not('id', 'in', `(${userEarnedBadgeIds.join(',')})`);
        }

        const { data: availableBadges, error: availableBadgesError } = await query
            .order('rarity', { ascending: false }) // Optional: Sort by rarity or name
            .order('name', { ascending: true });

        if (availableBadgesError) throw availableBadgesError;

        elements.availableBadgesGrid.innerHTML = ''; // Clear previous/skeleton

        if (availableBadges && availableBadges.length > 0) {
             // 3. Získat aktuální progress uživatele pro tyto odznaky (pokud existuje)
             const badgeIds = availableBadges.map(b => b.id);
             const { data: progressData, error: progressError } = await supabase
                 .from('user_badge_progress')
                 .select('badge_id, current_value')
                 .eq('user_id', userId)
                 .in('badge_id', badgeIds);

             if (progressError) {
                 console.warn("Chyba načítání progressu odznaků:", progressError);
                 // Pokračujeme i bez progressu, zobrazíme jen základní info
             }

             const progressMap = new Map(progressData?.map(p => [p.badge_id, p.current_value]) || []);

            availableBadges.forEach(badge => {
                const achievementCard = document.createElement('div');
                achievementCard.className = `achievement-card available rarity-${badge.rarity || 'common'}`;

                const userProgress = progressMap.get(badge.id) || 0;
                const goalValue = badge.goal_value || 0;
                const progressPercent = goalValue > 0 ? Math.min(100, Math.round((userProgress / goalValue) * 100)) : 0;

                achievementCard.innerHTML = `
                    <div class="achievement-icon">
                        <img src="${badge.icon_url || 'placeholder.png'}" alt="${badge.name}" onerror="this.src='placeholder.png';">
                    </div>
                    <div class="achievement-content">
                        <h3 class="achievement-title">${badge.name} <span class="rarity-label ${badge.rarity || 'common'}">${badge.rarity || 'Běžný'}</span></h3>
                        <p class="achievement-desc">${badge.description}</p>
                        ${goalValue > 0 ? `
                        <div class="achievement-progress">
                            <div class="progress-bar">
                                <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
                            </div>
                            <span class="progress-text">${formatNumber(userProgress)} / ${formatNumber(goalValue)} (${progressPercent}%)</span>
                        </div>
                        <p class="achievement-goal">${badge.goal_description || 'Splňte cíl pro získání'}</p>
                        ` : `<p class="achievement-goal">${badge.goal_description || 'Speciální podmínky pro získání'}</p>`}
                    </div>
                `;
                elements.availableBadgesGrid.appendChild(achievementCard);
            });
            elements.emptyAvailableBadges.style.display = 'none';
        } else {
            elements.emptyAvailableBadges.style.display = 'flex';
        }
         removeLoadingState(elements.availableBadgesContainer);

    } catch (error) {
        handleError(error, "Načítání dostupných výzev");
        elements.availableBadgesGrid.innerHTML = '<p class="error-message">Chyba načítání dostupných výzev.</p>';
        elements.emptyAvailableBadges.style.display = 'none';
        removeLoadingState(elements.availableBadgesContainer);
    }
}


/** Načte data žebříčku */
async function loadLeaderboard() {
    try {
        // Použijeme RPC funkci pro získání žebříčku s potřebnými daty
        const { data, error } = await supabase.rpc('get_leaderboard_with_details', { limit_count: 10 }); // Limit na Top 10

        if (error) throw error;

        elements.leaderboardBody.innerHTML = ''; // Clear previous/skeleton
        if (data && data.length > 0) {
            data.forEach((user, index) => {
                const row = document.createElement('tr');
                row.className = user.user_id === currentUser?.id ? 'current-user-row' : '';
                row.innerHTML = `
                    <td class="rank-cell">${user.rank_num}</td>
                    <td class="user-cell">
                        <div class="user-avatar-small">${getAvatarContent(user)}</div>
                        <span class="user-name">${user.full_name || user.username || 'Anonymní Pilot'}</span>
                         ${user.title ? `<span class="user-title-badge">${user.title}</span>` : ''}
                    </td>
                    <td class="credits-cell">${formatNumber(user.credits)} <i class="fas fa-coins"></i></td>
                    <td class="badges-cell">${formatNumber(user.badge_count)} <i class="fas fa-medal"></i></td>
                    <td class="streak-cell">${formatNumber(user.current_streak)} <i class="fas fa-fire"></i></td>
                `;
                elements.leaderboardBody.appendChild(row);
            });
            elements.leaderboardEmpty.style.display = 'none';
        } else {
            elements.leaderboardEmpty.style.display = 'flex'; // Show empty state
        }
         removeLoadingState(elements.leaderboardContainer);

    } catch (error) {
        handleError(error, "Načítání žebříčku");
        elements.leaderboardBody.innerHTML = '<tr><td colspan="5" class="error-message">Chyba načítání žebříčku.</td></tr>';
        elements.leaderboardEmpty.style.display = 'none';
        removeLoadingState(elements.leaderboardContainer);
    }
}

/** Načte nedávné úspěchy (např. poslední 3 získané odznaky) */
async function loadRecentAchievements(userId) {
    try {
        const { data, error } = await supabase
            .from('user_badges')
            .select(`
                earned_at,
                badges ( id, name, description, icon_url, rarity )
            `)
            .eq('user_id', userId)
            .order('earned_at', { ascending: false })
            .limit(3); // Limit to recent 3

        if (error) throw error;

        elements.recentAchievementsList.innerHTML = ''; // Clear previous/skeleton

        if (data && data.length > 0) {
            elements.recentAchievementsSection.style.display = 'block'; // Show the section
            data.forEach(ua => {
                const badge = ua.badges;
                const item = document.createElement('div');
                item.className = 'achievement-list-item';
                item.innerHTML = `
                    <div class="achievement-item-icon rarity-${badge.rarity || 'common'}">
                        <img src="${badge.icon_url || 'placeholder.png'}" alt="${badge.name}" onerror="this.src='placeholder.png';">
                    </div>
                    <div class="achievement-item-content">
                        <h4 class="achievement-item-title">${badge.name}</h4>
                        <p class="achievement-item-desc">${badge.description}</p>
                        <span class="achievement-item-time">${timeAgo(ua.earned_at)}</span>
                    </div>
                `;
                elements.recentAchievementsList.appendChild(item);
            });
            removeLoadingState(elements.recentAchievementsSection); // Remove loading ONLY if shown
        } else {
            elements.recentAchievementsSection.style.display = 'none'; // Hide if no recent achievements
        }

    } catch (error) {
        handleError(error, "Načítání nedávných úspěchů");
        elements.recentAchievementsSection.style.display = 'none'; // Hide on error too
    }
}

// ----------------------------------------------------------------------------
// Obchod s tituly
// ----------------------------------------------------------------------------

/** Aktualizuje zobrazení kreditů uživatele v obchodě */
function updateShopCredits(credits) {
    elements.shopUserCredits.innerHTML = `${formatNumber(credits ?? 0)} <i class="fas fa-coins"></i>`;
}


/** Načte položky obchodu s tituly */
async function loadTitleShopItems(userId) {
    try {
        elements.titleShopGrid.innerHTML = ''; // Vyčistit před načítáním
        elements.titleShopLoading.classList.add('visible-loader');
        elements.titleShopGrid.style.display = 'none';
        elements.titleShopEmpty.style.display = 'none';

        // 1. Získat všechny dostupné tituly v obchodě
        const { data: shopItems, error: shopError } = await supabase
            .from('title_shop')
            .select('id, title, description, cost, required_badge_id, badges ( name, icon_url ), rarity')
            .order('cost', { ascending: true }); // Seřadit podle ceny

        if (shopError) throw shopError;

        if (!shopItems || shopItems.length === 0) {
            elements.titleShopEmpty.style.display = 'flex';
            elements.titleShopLoading.classList.remove('visible-loader');
            removeLoadingState(elements.titleShopContainer);
            return;
        }

        // 2. Získat ID odznaků a titulů, které uživatel již vlastní
        const { data: userBadges, error: userBadgesError } = await supabase
            .from('user_badges')
            .select('badge_id')
            .eq('user_id', userId);

        if (userBadgesError) throw userBadgesError;
        const userBadgeIds = new Set(userBadges.map(b => b.badge_id));

        const { data: userTitles, error: userTitlesError } = await supabase
             .from('user_titles')
             .select('title')
             .eq('user_id', userId);

         if (userTitlesError) throw userTitlesError;
         const userOwnedTitles = new Set(userTitles.map(t => t.title));

        // 3. Zobrazit položky
        shopItems.forEach(item => {
            const titleItemCard = document.createElement('div');
            titleItemCard.className = `title-item card rarity-${item.rarity || 'common'}`;

            const isOwned = userOwnedTitles.has(item.title);
            const meetsRequirement = !item.required_badge_id || userBadgeIds.has(item.required_badge_id);
            const canAfford = userProfileData?.credits >= item.cost;
            const canPurchase = !isOwned && meetsRequirement && canAfford;

            let requirementText = '';
            let requirementClass = '';
            if (item.required_badge_id) {
                if (meetsRequirement) {
                    requirementText = `<i class="fas fa-check-circle"></i> Odznak "${item.badges?.name || 'Požadovaný'}" získán`;
                    requirementClass = 'requirement-met';
                } else {
                    requirementText = `<i class="fas fa-times-circle"></i> Vyžaduje odznak: "${item.badges?.name || 'Neznámý'}"`;
                    requirementClass = 'requirement-not-met';
                }
            }

            titleItemCard.innerHTML = `
                <div class="title-item-content">
                    <div class="title-icon-wrapper">
                         ${item.required_badge_id && item.badges?.icon_url ?
                           `<img src="${item.badges.icon_url}" alt="Ikona požadavku" class="title-requirement-icon" onerror="this.style.display='none';">` :
                           `<i class="fas fa-bookmark title-default-icon rarity-${item.rarity || 'common'}"></i>`}
                    </div>
                    <div class="title-info">
                        <h3 class="title-name">${item.title}</h3>
                        <p class="title-description">${item.description || 'Žádný popis.'}</p>
                    </div>
                </div>
                <div class="title-item-footer">
                    <div class="title-cost">
                       ${isOwned ? 'VLASTNĚNO' : `<i class="fas fa-coins"></i> ${formatNumber(item.cost)}`}
                    </div>
                    <button class="btn btn-buy-title ${isOwned ? 'btn-disabled' : (canPurchase ? 'btn-primary' : 'btn-secondary')}"
                            data-title-id="${item.id}"
                            data-title-name="${item.title}"
                            data-cost="${item.cost}"
                            ${isOwned || !meetsRequirement || !canAfford ? 'disabled' : ''}>
                        ${isOwned ? '<i class="fas fa-check"></i> Získáno' : (meetsRequirement ? (canAfford ? '<i class="fas fa-shopping-cart"></i> Koupit' : '<i class="fas fa-times"></i> Málo kreditů') : '<i class="fas fa-lock"></i> Zamčeno')}
                    </button>
                </div>
                ${requirementText ? `<div class="title-requirement ${requirementClass}">${requirementText}</div>` : ''}
            `;
            elements.titleShopGrid.appendChild(titleItemCard);
        });

        elements.titleShopGrid.style.display = 'grid';
        elements.titleShopLoading.classList.remove('visible-loader');
        removeLoadingState(elements.titleShopContainer);

        // Přidat event listenery na tlačítka Koupit
        addBuyButtonListeners();

    } catch (error) {
        handleError(error, "Načítání obchodu s tituly");
        elements.titleShopGrid.innerHTML = '<p class="error-message">Chyba načítání nabídky titulů.</p>';
        elements.titleShopEmpty.style.display = 'none';
        elements.titleShopLoading.classList.remove('visible-loader');
        removeLoadingState(elements.titleShopContainer);
    }
}

/** Přidá event listenery pro tlačítka nákupu titulů */
function addBuyButtonListeners() {
    const buyButtons = elements.titleShopGrid.querySelectorAll('.btn-buy-title:not([disabled])');
    buyButtons.forEach(button => {
        button.addEventListener('click', handleBuyTitle);
    });
}

/** Zpracuje nákup titulu */
async function handleBuyTitle(event) {
    const button = event.currentTarget;
    const titleId = button.dataset.titleId;
    const titleName = button.dataset.titleName;
    const cost = parseInt(button.dataset.cost, 10);

    if (isNaN(cost)) {
        showToast("Neplatná cena titulu.", "error");
        return;
    }

    if (userProfileData?.credits < cost) {
        showToast(`Nedostatek kreditů pro nákup titulu "${titleName}". Potřebujete ${cost} kreditů.`, "warning");
        return;
    }

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kupuji...';

    try {
        // Volání RPC funkce pro nákup
        const { data, error } = await supabase.rpc('purchase_title', {
            p_user_id: currentUser.id,
            p_title_shop_id: titleId
        });

        if (error) throw error;

        if (data && data.success) {
            showToast(`Titul "${titleName}" úspěšně zakoupen!`, "success");

            // Aktualizovat UI
            userProfileData.credits -= cost; // Snížit kredity lokálně
            updateShopCredits(userProfileData.credits);
            updateSidebarProfile(userProfileData); // Aktualizovat i sidebar, pokud zobrazuje kredity
            localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(userProfileData)); // Uložit změnu do cache

            // Změnit stav tlačítka na "Vlastněno"
            button.innerHTML = '<i class="fas fa-check"></i> Získáno';
            button.classList.remove('btn-primary');
            button.classList.add('btn-disabled');
            button.disabled = true;

            // Znovu načíst titulky, aby se aktualizovaly stavy ostatních tlačítek (pokud by se změnila dostupnost)
             await loadTitleShopItems(currentUser.id);
        } else {
            // data.message by měla obsahovat důvod selhání z RPC funkce
            throw new Error(data?.message || "Neznámá chyba při nákupu.");
        }

    } catch (error) {
        handleError(error, `Nákup titulu "${titleName}"`);
        // Vrátit tlačítko do původního stavu (nebo nechat deaktivované?)
        button.innerHTML = '<i class="fas fa-shopping-cart"></i> Koupit'; // Nebo původní text podle stavu
        // Znovu zkontrolovat stav a povolit/zakázat tlačítko
        const meetsRequirement = true; // Předpokládáme, že požadavek byl splněn, když bylo tlačítko aktivní
        const canAfford = userProfileData?.credits >= cost;
        button.disabled = !meetsRequirement || !canAfford;
        if (!button.disabled) {
            button.classList.add('btn-primary');
            button.classList.remove('btn-disabled', 'btn-secondary');
        } else {
             button.classList.remove('btn-primary');
             button.classList.add('btn-secondary'); // Nebo btn-disabled, podle logiky
        }
    }
}


// ----------------------------------------------------------------------------
// Notifikace
// ----------------------------------------------------------------------------

/** Načte notifikace */
async function loadNotifications(userId, limit = 5) {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit); // Omezit na posledních X notifikací pro dropdown

        if (error) throw error;

        currentNotifications = data || [];
        displayNotifications(currentNotifications);
        updateNotificationBadge();

    } catch (error) {
        handleError(error, "Načítání notifikací");
        elements.notificationsList.innerHTML = '<div class="notification-item">Chyba načítání.</div>';
    }
}

/** Zobrazí notifikace v dropdownu */
function displayNotifications(notifications) {
    elements.notificationsList.innerHTML = ''; // Clear current list or skeletons

    if (notifications.length === 0) {
        elements.noNotificationsMsg.style.display = 'block';
        elements.markAllReadBtn.disabled = true;
    } else {
        elements.noNotificationsMsg.style.display = 'none';
        notifications.forEach(notif => {
            const item = document.createElement('div');
            item.className = `notification-item ${notif.is_read ? 'read' : 'unread'}`;
            item.dataset.id = notif.id;

            let iconClass = 'fa-info-circle'; // Default icon
            let iconColor = 'var(--info-color)';
            if (notif.type === 'achievement') { iconClass = 'fa-medal'; iconColor = 'var(--accent-yellow)'; }
            else if (notif.type === 'level_up') { iconClass = 'fa-arrow-up'; iconColor = 'var(--accent-lime)'; }
            else if (notif.type === 'system') { iconClass = 'fa-cog'; iconColor = 'var(--text-medium)'; }
            else if (notif.type === 'warning') { iconClass = 'fa-exclamation-triangle'; iconColor = 'var(--warning-color)'; }
            else if (notif.type === 'error') { iconClass = 'fa-exclamation-circle'; iconColor = 'var(--error-color)'; }
             else if (notif.type === 'new_feature') { iconClass = 'fa-star'; iconColor = 'var(--accent-cyan)'; }
              else if (notif.type === 'rank_change') { iconClass = 'fa-trophy'; iconColor = 'var(--accent-orange)'; }
              else if (notif.type === 'credits') { iconClass = 'fa-coins'; iconColor = 'var(--accent-yellow)'; } // New type


            item.innerHTML = `
                <div class="notification-icon" style="color: ${iconColor};"><i class="fas ${iconClass}"></i></div>
                <div class="notification-content">
                    <p class="notification-text">${notif.message}</p>
                    <span class="notification-time">${timeAgo(notif.created_at)}</span>
                </div>
                <button class="mark-read-btn" title="Označit jako přečtené"><i class="fas fa-check"></i></button>
            `;
            elements.notificationsList.appendChild(item);
        });

        elements.markAllReadBtn.disabled = notifications.every(n => n.is_read);

        // Add event listeners for individual mark-read buttons
        elements.notificationsList.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', handleMarkOneRead);
        });
        // Make whole item clickable to mark as read (optional)
         elements.notificationsList.querySelectorAll('.notification-item.unread').forEach(item => {
             item.addEventListener('click', (e) => {
                 // Prevent marking as read if the button itself was clicked
                 if (!e.target.closest('.mark-read-btn')) {
                     handleMarkOneRead(e);
                 }
             });
         });
    }
}

/** Označí jednu notifikaci jako přečtenou */
async function handleMarkOneRead(event) {
    const item = event.target.closest('.notification-item');
    const notificationId = item.dataset.id;

    if (!notificationId || item.classList.contains('read')) return; // Already read or no ID

    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) throw error;

        item.classList.remove('unread');
        item.classList.add('read');
        updateNotificationBadge(); // Update count after marking read
         elements.markAllReadBtn.disabled = elements.notificationsList.querySelectorAll('.notification-item.unread').length === 0;


    } catch (error) {
        handleError(error, "Označení notifikace jako přečtené");
    }
}

/** Označí všechny notifikace jako přečtené */
async function markAllNotificationsRead() {
    const unreadIds = currentNotifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    elements.markAllReadBtn.disabled = true; // Prevent double clicks

    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .in('id', unreadIds); // Use 'in' for bulk update

        if (error) throw error;

        // Update UI
        elements.notificationsList.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
            item.classList.add('read');
        });
        currentNotifications.forEach(n => { if (!n.is_read) n.is_read = true; }); // Update local state
        updateNotificationBadge();
        showToast("Všechny notifikace označeny jako přečtené.", "success", 2000);

    } catch (error) {
        handleError(error, "Označení všech notifikací jako přečtených");
        elements.markAllReadBtn.disabled = false; // Re-enable on error
    }
}

/** Aktualizuje počet nepřečtených notifikací */
function updateNotificationBadge() {
    const unreadCount = currentNotifications.filter(n => !n.is_read).length;
    elements.notificationCount.textContent = unreadCount;
    if (unreadCount > 0) {
        elements.notificationCount.style.display = 'flex'; // Show badge
        elements.notificationBell.classList.add('has-notifications');
    } else {
        elements.notificationCount.style.display = 'none'; // Hide badge
        elements.notificationBell.classList.remove('has-notifications');
    }
}


// ----------------------------------------------------------------------------
// Správa stavu UI (Sidebar, Modály, atd.)
// ----------------------------------------------------------------------------

/** <<< ДОБАВЛЕНО: Переключение состояния боковой панели (Desktop) >>> */
function toggleSidebar() {
    document.body.classList.toggle('sidebar-collapsed');
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded');
    // Update icon based on state - Assuming the icon needs to flip
    const icon = elements.sidebarToggleBtn.querySelector('i');
    if (isCollapsed) {
        icon.classList.remove('fa-chevron-left');
        icon.classList.add('fa-chevron-right');
    } else {
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-left');
    }
}

/** <<< ДОБАВЛЕНО: Применение начального состояния боковой панели при загрузке >>> */
function applyInitialSidebarState() {
    const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);
    if (savedState === 'collapsed') {
        document.body.classList.add('sidebar-collapsed');
         const icon = elements.sidebarToggleBtn.querySelector('i');
         icon.classList.remove('fa-chevron-left');
         icon.classList.add('fa-chevron-right');
    } else {
         document.body.classList.remove('sidebar-collapsed');
         const icon = elements.sidebarToggleBtn.querySelector('i');
         icon.classList.remove('fa-chevron-right');
         icon.classList.add('fa-chevron-left');
    }
}

/** Přepínání mobilního menu */
function toggleMobileSidebar() {
    elements.sidebar.classList.toggle('active');
    elements.sidebarOverlay.classList.toggle('active');
    document.body.classList.toggle('sidebar-open-mobile'); // Prevent body scroll
}

/** Zavření mobilního menu */
function closeMobileSidebar() {
    elements.sidebar.classList.remove('active');
    elements.sidebarOverlay.classList.remove('active');
    document.body.classList.remove('sidebar-open-mobile');
}


/** Sledování kurzoru pro efekt */
function setupMouseFollower() {
    if (!elements.mouseFollower) return;
    document.addEventListener('mousemove', (e) => {
        // Check if the sidebar is collapsed and mouse is near the edge
        const isCollapsed = document.body.classList.contains('sidebar-collapsed');
        const sidebarWidth = isCollapsed ? 60 : 250; // Adjust based on actual CSS
        const activationZone = 20; // Pixels from the edge to activate

        if (isCollapsed && e.clientX < sidebarWidth + activationZone) {
            // Optionally enhance effect when near collapsed sidebar
             elements.mouseFollower.style.opacity = '0.3'; // Dimmed effect near sidebar
        } else {
             elements.mouseFollower.style.opacity = '1'; // Full effect elsewhere
        }

         // Standard follower movement
         elements.mouseFollower.style.left = `${e.clientX}px`;
         elements.mouseFollower.style.top = `${e.clientY}px`;

    });
     document.addEventListener('mouseleave', () => {
         elements.mouseFollower.style.opacity = '0';
     });
     document.addEventListener('mouseenter', () => {
         elements.mouseFollower.style.opacity = '1';
     });
}

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------

/** Přidá všechny potřebné event listenery */
function addEventListeners() {
    // Notifikace
    elements.notificationBell?.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent body click from closing immediately
        elements.notificationsDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!elements.notificationBell?.contains(e.target) && !elements.notificationsDropdown?.contains(e.target)) {
            elements.notificationsDropdown?.classList.remove('active');
        }
    });

    elements.markAllReadBtn?.addEventListener('click', markAllNotificationsRead);

    // Obnovení dat
    elements.refreshBtn?.addEventListener('click', () => {
        elements.refreshBtn.classList.add('loading'); // Add loading visual
        showToast("Obnovuji data...", "info", 1500);
        loadAllData(true); // Force refresh
    });

    // Online/Offline status
    window.addEventListener('online', () => {
        elements.offlineBanner.style.display = 'none';
        showToast("Spojení obnoveno!", "success", 2000);
        // Optionally trigger data refresh on reconnect
        // loadAllData(true);
    });
    window.addEventListener('offline', () => {
        elements.offlineBanner.style.display = 'flex';
        showToast("Spojení ztraceno. Pracujete v offline režimu.", "warning", 5000);
    });

    // Mobilní menu
    elements.mainMobileMenuToggle?.addEventListener('click', toggleMobileSidebar);
    elements.sidebarCloseToggle?.addEventListener('click', closeMobileSidebar);
    elements.sidebarOverlay?.addEventListener('click', closeMobileSidebar);


    // <<< ДОБАВЛЕНО: Listener для кнопки сворачивания/разворачивания десктопного сайдбара >>>
    elements.sidebarToggleBtn?.addEventListener('click', toggleSidebar);


}

// ----------------------------------------------------------------------------
// Inicializace
// ----------------------------------------------------------------------------

/** Hlavní inicializační funkce */
async function initializePage() {
    // Zobrazit/Skrýt offline banner podle počátečního stavu
    elements.offlineBanner.style.display = navigator.onLine ? 'none' : 'flex';

    // Aktualizace roku v patičce
    const currentYear = new Date().getFullYear();
    document.getElementById('currentYearSidebar').textContent = currentYear;
    document.getElementById('currentYearFooter').textContent = currentYear;

    // Pokus o získání uživatele a jeho profilu
    currentUser = await getCurrentUser();
    if (currentUser) {
        // Načíst profil (cache nebo DB)
        userProfileData = await loadUserProfile(currentUser.id);

        // Načíst všechna data stránky (statistiky, odznaky, žebříček, notifikace, obchod)
        // Použijeme cache, pokud je platná
        const cachedTime = localStorage.getItem(LAST_FETCH_TIME_KEY);
        lastFetchTime = cachedTime ? parseInt(cachedTime, 10) : 0;
        await loadAllData(false); // Load data (potentially from cache)

        // Přidat event listenery až po načtení dat, abychom se vyhnuli null referencím
        addEventListeners();
        setupMouseFollower();

    } else {
        // Pokud getCurrentUser selže (není přihlášen nebo chyba), přesměrování už proběhlo
        // nebo byla zobrazena fatální chyba. Není třeba další akce.
        elements.initialLoader.style.display = 'none'; // Skryje loader, pokud chyba není fatální, ale uživatel není načten
    }

     // <<< ДОБАВЛЕНО: Применение начального состояния сайдбара >>>
     applyInitialSidebarState();
}

// Spustit inicializaci po načtení DOM
document.addEventListener('DOMContentLoaded', initializePage);