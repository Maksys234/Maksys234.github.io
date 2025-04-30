// =============================================================================
// POKROK.JS - Logic for the Progress Overview Page (v3 - Correct Supabase Credentials)
// =============================================================================

// --- Supabase Configuration (Corrected to match auth/index.html) ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co'; // <<< CORRECTED
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10'; // <<< CORRECTED

// --- Global State ---
let supabaseClient = null; // Initialize Supabase client variable
let currentUser = null;
let currentProfile = null;
let userTitles = [];
let progressChart = null;
let currentPage = 1;
const activitiesPerPage = 10;
let currentSortColumn = 'created_at';
let currentSortDirection = 'desc';
let currentActivityFilter = 'all';
let totalActivities = 0;

// --- DOM Elements (Assign ASAP) ---
const initialLoader = document.getElementById('initial-loader');
const globalErrorContainer = document.getElementById('global-error');
const refreshButton = document.getElementById('refresh-btn');
const mainContent = document.getElementById('main-content');

// Sidebar Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const mobileMenuToggleBtn = document.getElementById('main-mobile-menu-toggle');
const sidebarCloseToggleBtn = document.getElementById('sidebar-close-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarUserName = document.getElementById('sidebar-name');
const sidebarUserAvatar = document.getElementById('sidebar-avatar');
const sidebarUserTitle = document.getElementById('sidebar-user-title');

// Header Elements
const creditsValueElement = document.getElementById('credits-value');

// Stats Elements
const overallProgressValueEl = document.getElementById('overall-progress-value');
const overallProgressDescEl = document.getElementById('overall-progress-desc');
const overallProgressFooterEl = document.getElementById('overall-progress-footer');
const totalPointsValueEl = document.getElementById('total-points-value');
const totalPointsDescEl = document.getElementById('total-points-desc');
const totalPointsFooterEl = document.getElementById('total-points-footer');
const streakValueEl = document.getElementById('streak-value');
const streakDescEl = document.getElementById('streak-desc');
const streakFooterEl = document.getElementById('streak-footer');
const completedCountValueEl = document.getElementById('completed-count-value');
const completedCountDescEl = document.getElementById('completed-count-desc');
const completedCountFooterEl = document.getElementById('completed-count-footer');
const statsGrid = document.getElementById('stats-grid');

// Chart Elements
const chartContainer = document.getElementById('progressChart');
const chartPeriodSelect = document.getElementById('chart-period-select');
const chartLoadingOverlay = document.getElementById('chart-loading-overlay');
const chartEmptyState = document.getElementById('chart-empty-state');

// Activity Table Elements
const activitiesTable = document.getElementById('activities-table');
const activitiesTableBody = document.getElementById('activities-body');
const tableLoadingOverlay = document.getElementById('table-loading-overlay');
const activitiesEmptyState = document.getElementById('activities-empty-state');
const activityTypeFilter = document.getElementById('activity-type-filter');
const paginationControls = document.getElementById('pagination-controls');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageInfo = document.getElementById('page-info');
const exportTableBtn = document.getElementById('export-table-btn');

// Notification Elements
const notificationBell = document.getElementById('notification-bell');
const notificationCountBadge = document.getElementById('notification-count');
const notificationsDropdown = document.getElementById('notifications-dropdown');
const notificationsList = document.getElementById('notifications-list');
const noNotificationsMsg = document.getElementById('no-notifications-msg');
const markAllReadBtn = document.getElementById('mark-all-read');

// --- Utility Functions ---

// Show/Hide Loader
function showLoader(loaderElement) {
    loaderElement?.classList.remove('hidden');
}
function hideLoader(loaderElement) {
    loaderElement?.classList.add('hidden');
}

// Show Global Error Message
function showGlobalError(message) {
    // Ensure the container element exists before trying to modify it
    const errorContainer = document.getElementById('global-error');
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    } else {
        console.error("Global error container not found in DOM yet.");
    }
    console.error("Global Error:", message);
    // Attempt to hide initial loader even if container wasn't found
    const initialLoaderEl = document.getElementById('initial-loader');
    if (initialLoaderEl) hideLoader(initialLoaderEl);
}

// Update Element Text Content Safely
function updateElementText(element, text) {
    if (element) {
        element.textContent = text ?? '-'; // Use '-' as default if text is null/undefined
    }
}

// Update Element HTML Content Safely
function updateElementHTML(element, html) {
    if (element) {
        element.innerHTML = html ?? '';
    }
}

// Simple Toast Notification
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'fas fa-info-circle';
    if (type === 'success') iconClass = 'fas fa-check-circle';
    if (type === 'error') iconClass = 'fas fa-times-circle';
    if (type === 'warning') iconClass = 'fas fa-exclamation-triangle';

    toast.innerHTML = `<i class="${iconClass} toast-icon"></i> <span class="toast-message">${message}</span>`;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
             if (toast.parentNode === container) {
                container.removeChild(toast);
            }
        }, { once: true });
    }, duration);
}

// Format Date Relatively
function formatDateRelative(dateString) {
    if (!dateString) return '-';
    try {
        if (typeof dateFns === 'undefined' || typeof dateFns.locale === 'undefined' || typeof dateFns.locale.cs === 'undefined') {
            console.warn("date-fns or CS locale not loaded.");
            return new Date(dateString).toLocaleDateString('cs-CZ'); // Fallback
        }
        return dateFns.formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: dateFns.locale.cs });
    } catch (e) {
        console.error("Error formatting date:", e);
        try { return new Date(dateString).toLocaleDateString('cs-CZ'); } catch { return dateString; }
    }
}

// Format Date Simply
function formatDateSimple(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) { throw new Error("Invalid Date"); }
        return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
    } catch (e) {
        console.error("Error formatting simple date:", dateString, e);
        return '-';
    }
}

// Format number
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// --- Authentication and User Profile ---

async function getUser() {
    if (!supabaseClient) {
        console.error("Supabase client not initialized before calling getUser.");
        showGlobalError("Chyba ověření: Klient databáze není inicializován.");
        // Redirect immediately if client fails, likely means core issue
        window.location.href = '/auth/index.html';
        return null;
    }
    try {
        // Use getSession for potentially faster check if session exists locally
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

        if (sessionError) {
            console.error("Error getting session:", sessionError);
            throw sessionError; // Rethrow to handle below
        }

        if (session?.user) {
            // Optional: Verify session validity if needed (e.g., refresh)
            // const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            // if (userError) throw userError;
            // if (!user) throw new Error("Session exists but user fetch failed.");
            // return user;
            return session.user; // Assume session implies valid user for now
        } else {
            console.log("User session not found, redirecting to login.");
            showToast("Relace neplatná. Přihlašte se prosím.", "warning", 2500);
            // Prevent redirect loop if already on auth page (though shouldn't happen here)
            if (!window.location.pathname.startsWith('/auth/')) {
                setTimeout(() => { window.location.href = '/auth/index.html'; }, 1500);
            }
            return null;
        }
    } catch (error) {
        console.error("Error verifying user session:", error);
        showGlobalError("Nepodařilo se ověřit relaci uživatele. Zkuste se znovu přihlásit.");
        if (!window.location.pathname.startsWith('/auth/')) {
             setTimeout(() => { window.location.href = '/auth/index.html'; }, 2000);
        }
        return null;
    }
}

async function getUserProfile(userId) {
    if (!userId || !supabaseClient) return null;
    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error("Supabase error fetching profile:", error.message);
            // Handle specific 'not found' case if necessary (e.g., profile creation pending)
            if (error.code === 'PGRST116') { // Resource not found
                 console.warn(`Profile not found for user ${userId}. Might be pending creation.`);
                 showGlobalError("Profil uživatele zatím nebyl nalezen. Zkuste to prosím znovu za chvíli.");
                 return null; // Or return a default object
            }
            throw new Error(`Supabase: ${error.message}`);
        };
        return profile;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        showGlobalError("Nepodařilo se načíst profil uživatele.");
        return null;
    }
}

// Fetch all available titles
async function fetchTitles() {
    if (!supabaseClient) return [];
    try {
        const { data, error } = await supabaseClient
            .from('title_shop')
            .select('id, name');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching titles:", error);
        showToast("Nepodařilo se načíst seznam titulů.", "error");
        return [];
    }
}


// --- UI Update Functions ---

function updateHeaderAndSidebar(profile, titles) {
    if (!profile) {
         // Handle case where profile might be null initially (e.g., pending creation)
         updateElementText(sidebarUserName, 'Uživatel');
         updateElementText(sidebarUserAvatar, '?');
         updateElementText(sidebarUserTitle, 'Pilot');
         updateElementText(creditsValueElement, '0'); // Show 0 credits if no profile
         return;
    }

    updateElementText(sidebarUserName, profile.full_name || profile.username || 'Uživatel');
    const firstLetter = (profile.full_name || profile.username || '?')[0].toUpperCase();
    updateElementText(sidebarUserAvatar, firstLetter);

    let titleName = "Pilot";
    if (profile.selected_title && titles && titles.length > 0) {
        const foundTitle = titles.find(t => t.id === profile.selected_title);
        if (foundTitle) {
            titleName = foundTitle.name;
        }
    }
    updateElementText(sidebarUserTitle, titleName);
    updateElementText(creditsValueElement, formatNumber(profile.points ?? 0));
}

// --- Sidebar Toggle Logic ---

function setupSidebarToggle() {
    const body = document.body;

    sidebarToggleBtn?.addEventListener('click', () => {
        body.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', body.classList.contains('sidebar-collapsed'));
        window.dispatchEvent(new Event('resize')); // Trigger resize for charts etc.
    });

    mobileMenuToggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        body.classList.add('sidebar-visible');
        sidebarOverlay?.classList.add('active');
    });

    sidebarCloseToggleBtn?.addEventListener('click', () => {
        body.classList.remove('sidebar-visible');
        sidebarOverlay?.classList.remove('active');
    });

    sidebarOverlay?.addEventListener('click', () => {
        body.classList.remove('sidebar-visible');
        sidebarOverlay?.classList.remove('active');
    });

    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        body.classList.add('sidebar-collapsed');
    }

     const updateToggleButton = () => {
        const isCollapsed = body.classList.contains('sidebar-collapsed');
        const icon = sidebarToggleBtn?.querySelector('i');
        if (icon) {
            icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        }
        const title = isCollapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel';
        sidebarToggleBtn?.setAttribute('title', title);
        if (typeof $ !== 'undefined' && $.fn.tooltipster && $(sidebarToggleBtn).hasClass('tooltipstered')) {
           $(sidebarToggleBtn).tooltipster('content', title);
        }
     };

     const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.attributeName === 'class' && mutation.target === body) {
                 updateToggleButton();
            }
        }
    });

    observer.observe(body, { attributes: true, attributeFilter: ['class'] });
    updateToggleButton(); // Initial check
}


// --- Notification Handling ---
// (Keep existing notification functions: fetchNotifications, renderNotifications, getNotificationColor, updateNotificationBadge, markNotificationAsRead, markAllNotificationsRead, initNotifications)
// Ensure they use 'supabaseClient' instead of 'supabase'

async function fetchNotifications() {
    if (!currentUser || !supabaseClient) return { count: 0, notifications: [] };
    try {
        const { data, error, count } = await supabaseClient // Use supabaseClient
            .from('notifications')
            .select('*', { count: 'exact' })
            .eq('user_id', currentUser.id)
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;
        return { count: count || 0, notifications: data || [] };
    } catch (error) {
        console.error("Error fetching notifications:", error);
        showToast("Nepodařilo se načíst oznámení.", "error");
        return { count: 0, notifications: [] };
    }
}

function renderNotifications(notifications) {
    notificationsList.innerHTML = '';
    if (!notifications || notifications.length === 0) {
        noNotificationsMsg.style.display = 'block';
        markAllReadBtn.disabled = true;
    } else {
        noNotificationsMsg.style.display = 'none';
        markAllReadBtn.disabled = false;
        notifications.forEach(notif => {
            const li = document.createElement('div');
            li.className = 'notification-item';
            li.dataset.id = notif.id;

            let iconClass = 'fas fa-info-circle';
            if (notif.type === 'achievement' || notif.type === 'badge') iconClass = 'fas fa-medal';
            else if (notif.type === 'system') iconClass = 'fas fa-cog';
            else if (notif.type === 'message') iconClass = 'fas fa-envelope';
            else if (notif.type === 'level_up') iconClass = 'fas fa-arrow-up';

            li.innerHTML = `
                <div class="notification-icon" style="background-color: ${getNotificationColor(notif.type)};"><i class="${iconClass}"></i></div>
                <div class="notification-content">
                    <p class="notification-message">${notif.message || 'Žádná zpráva'}</p>
                    <span class="notification-time">${formatDateRelative(notif.created_at)}</span>
                </div>
                <button class="mark-read-btn" title="Označit jako přečtené"><i class="fas fa-check"></i></button>
            `;
            notificationsList.appendChild(li);

            li.querySelector('.mark-read-btn')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                await markNotificationAsRead(notif.id);
                li.remove();
                updateNotificationBadge();
                 if (notificationsList.children.length === 0) {
                    noNotificationsMsg.style.display = 'block';
                    markAllReadBtn.disabled = true;
                 }
            });

            li.addEventListener('click', async () => {
                await markNotificationAsRead(notif.id);
                li.remove();
                updateNotificationBadge();
                if (notificationsList.children.length === 0) {
                    noNotificationsMsg.style.display = 'block';
                    markAllReadBtn.disabled = true;
                 }
            });
        });
    }
}

function getNotificationColor(type) {
    switch (type) {
        case 'achievement':
        case 'badge': return 'var(--gold-color)';
        case 'system': return 'var(--accent-blue, var(--primary-color))'; // Fallback blue
        case 'warning': return 'var(--warning)';
        case 'error': return 'var(--danger)';
        case 'level_up': return 'var(--secondary-color)';
        case 'message': return 'var(--info)';
        default: return 'var(--text-muted)';
    }
}

async function updateNotificationBadge() {
    if (!currentUser) return;
    const { count } = await fetchNotifications();
    notificationCountBadge.textContent = count > 9 ? '9+' : count;
    notificationCountBadge.classList.toggle('visible', count > 0);
    notificationCountBadge.dataset.count = count;
}

async function markNotificationAsRead(notificationId) {
     if (!currentUser || !supabaseClient || !notificationId) return;
    try {
        const { error } = await supabaseClient // Use supabaseClient
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId)
            .eq('user_id', currentUser.id);

        if (error) throw error;
        console.log(`Notification ${notificationId} marked as read.`);
    } catch (error) {
        console.error(`Error marking notification ${notificationId} as read:`, error);
        showToast("Chyba při označování oznámení.", "error");
    }
}

async function markAllNotificationsRead() {
    if (!currentUser || !supabaseClient) return;
    markAllReadBtn.disabled = true;
    markAllReadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const { error } = await supabaseClient // Use supabaseClient
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', currentUser.id)
            .eq('is_read', false);

        if (error) throw error;
        notificationsList.innerHTML = '';
        noNotificationsMsg.style.display = 'block';
        updateNotificationBadge();
        showToast("Všechna oznámení označena jako přečtená.", "success");

    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        showToast("Nepodařilo se označit všechna oznámení.", "error");
    } finally {
         markAllReadBtn.innerHTML = 'Vymazat vše';
         markAllReadBtn.disabled = true; // Keep disabled
    }
}

function initNotifications() {
    if (!notificationBell) return;
    updateNotificationBadge();
    notificationBell.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isOpen = notificationsDropdown.classList.toggle('show');
        if (isOpen) {
            const { notifications } = await fetchNotifications();
            renderNotifications(notifications);
        }
    });
    markAllReadBtn?.addEventListener('click', markAllNotificationsRead);
    document.addEventListener('click', (e) => {
         if (notificationsDropdown && notificationBell && !notificationBell.contains(e.target) && !notificationsDropdown.contains(e.target)) {
             notificationsDropdown.classList.remove('show');
         }
     });
}


// --- Core Pokrok Logic ---
// (Keep existing core logic functions: loadOverallStats, loadProgressChart, renderChart, calculateTimeUnit, loadActivityHistory, renderActivities, getActivityTypeBadge, getActivityStatusBadge, setupTableSorting, setupActivityFilter, renderPagination, setupPagination, exportTableToCSV)
// Ensure they use 'supabaseClient' instead of 'supabase'

async function loadOverallStats(userId) {
    if (!userId || !supabaseClient) return;
    statsGrid?.querySelectorAll('.stats-card')?.forEach(card => card.classList.add('loading'));
    try {
        const { data: profile, error: profileError } = await supabaseClient // Use supabaseClient
            .from('profiles')
            .select('points, study_streak, longest_study_streak, overall_progress, last_activity_date')
            .eq('id', userId)
            .single();
        if (profileError) throw profileError;

         const { count: completedCount, error: countError } = await supabaseClient // Use supabaseClient
            .from('user_activity')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .not('type', 'in', '("badge", "plan_generated", "level_up")')
            .in('status', ['completed', 'passed']);
        if (countError) throw countError;

        updateElementText(overallProgressValueEl, `${profile.overall_progress ?? 0} %`);
        updateElementText(overallProgressDescEl, "Průměrný pokrok");
        updateElementText(overallProgressFooterEl, profile.last_activity_date ? `Poslední aktivita: ${formatDateRelative(profile.last_activity_date)}` : 'Zatím žádná aktivita');
        updateElementText(totalPointsValueEl, formatNumber(profile.points ?? 0));
        updateElementText(totalPointsFooterEl, "Celkem kreditů získáno");
        const streakDaysText = (days) => days === 1 ? 'den' : (days > 1 && days < 5 ? 'dny' : 'dní');
        updateElementText(streakValueEl, `${profile.study_streak ?? 0} ${streakDaysText(profile.study_streak ?? 0)}`);
        updateElementText(streakFooterEl, `Nejdelší série: ${profile.longest_study_streak ?? 0} ${streakDaysText(profile.longest_study_streak ?? 0)}`);
        updateElementText(completedCountValueEl, formatNumber(completedCount ?? 0));
        updateElementText(completedCountFooterEl, "Dokončených testů a cvičení");

    } catch (error) {
        console.error("Error loading overall stats:", error);
        showToast("Nepodařilo se načíst statistiky pokroku.", "error");
        statsGrid?.querySelectorAll('.stats-card')?.forEach(card => {
            card.classList.add('error');
            const footer = card.querySelector('.stats-card-footer');
            if(footer) footer.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Chyba načítání`;
        });
    } finally {
        statsGrid?.querySelectorAll('.stats-card')?.forEach(card => card.classList.remove('loading'));
    }
}

async function loadProgressChart(userId, period = 'month') {
    if (!userId || !chartContainer || !supabaseClient) return;
    showLoader(chartLoadingOverlay);
    chartEmptyState.style.display = 'none';
    try {
        let dateFrom;
        const now = new Date();
        if (typeof dateFns === 'undefined') throw new Error("Date library not loaded.");
        switch (period) {
            case 'week': dateFrom = dateFns.subDays(now, 7); break;
            case 'month': dateFrom = dateFns.subMonths(now, 1); break;
            case '3months': dateFrom = dateFns.subMonths(now, 3); break;
            case 'all': default: dateFrom = null; break;
        }
        let query = supabaseClient // Use supabaseClient
            .from('user_progress_log')
            .select('created_at, overall_progress')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });
        if (dateFrom) { query = query.gte('created_at', dateFrom.toISOString()); }
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length < 2) {
            chartEmptyState.style.display = 'flex';
            if (progressChart) { progressChart.destroy(); progressChart = null; }
            chartEmptyState.innerHTML = `<i class="fas fa-chart-line"></i><p>Nedostatek dat pro zobrazení grafu.</p>`;
        } else { renderChart(data); chartEmptyState.style.display = 'none'; }
    } catch (error) {
        console.error(`Error loading progress chart data (${period}):`, error);
        showToast("Nepodařilo se načíst data pro graf pokroku.", "error");
        chartEmptyState.style.display = 'flex';
        chartEmptyState.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Chyba načítání grafu.</p>`;
        if (progressChart) { progressChart.destroy(); progressChart = null; }
    } finally { hideLoader(chartLoadingOverlay); }
}

function renderChart(data) {
    if (typeof Chart === 'undefined' || typeof Chart.adapters === 'undefined' || typeof dateFns === 'undefined') {
        console.error("Chart.js or Date Adapter not loaded.");
        showGlobalError("Chyba: Knihovna pro grafy nebyla správně načtena.");
        chartEmptyState.style.display = 'flex';
        chartEmptyState.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Chyba inicializace grafu.</p>`;
        return;
    }
    if (!chartContainer || !data) return;
    const ctx = chartContainer.getContext('2d');
    const labels = data.map(item => new Date(item.created_at));
    const chartData = data.map(item => item.overall_progress);
    if (progressChart) { progressChart.destroy(); }
    const bodyStyles = getComputedStyle(document.body);
    const primaryColor = bodyStyles.getPropertyValue('--primary-color').trim() || '#00e0ff';
    const gridColor = bodyStyles.getPropertyValue('--border-color-light').trim() || 'rgba(160, 92, 255, 0.25)';
    const textColor = bodyStyles.getPropertyValue('--text-medium').trim() || '#b8c4e0';
    progressChart = new Chart(ctx, { /* ... chart options kept the same as before ... */
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Celkový pokrok (%)', data: chartData, borderColor: primaryColor, backgroundColor: primaryColor + '33', tension: 0.3, pointBackgroundColor: primaryColor, pointBorderColor: '#fff', pointHoverRadius: 6, pointRadius: 4, fill: true }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time', time: { unit: calculateTimeUnit(labels), tooltipFormat: 'dd.MM.yyyy HH:mm', displayFormats: { millisecond: 'HH:mm:ss.SSS', second: 'HH:mm:ss', minute: 'HH:mm', hour: 'dd.MM HH:mm', day: 'dd.MM.yy', week: 'dd.MM.yy', month: 'MMM yy', quarter: 'QQQ yy', year: 'yyyy' } }, adapters: { date: { locale: dateFns.locale.cs } }, grid: { color: gridColor }, ticks: { color: textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }, y: { beginAtZero: true, max: 100, title: { display: true, text: 'Pokrok (%)', color: textColor }, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 20 } } }, plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.85)', titleColor: '#fff', bodyColor: '#fff', padding: 10, borderColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1, callbacks: { title: (tooltipItems) => dateFns.format(new Date(tooltipItems[0].parsed.x), 'PPPp', { locale: dateFns.locale.cs }), label: (context) => `${context.dataset.label || ''}: ${context.parsed.y !== null ? context.parsed.y.toFixed(1) + '%' : ''}` } } } }, interaction: { mode: 'index', intersect: false }, hover: { mode: 'nearest', intersect: true } }
    });
}

function calculateTimeUnit(labels) {
    if (!labels || labels.length < 2 || typeof dateFns === 'undefined') return 'day';
    const firstDate = labels[0]; const lastDate = labels[labels.length - 1]; const diffDays = dateFns.differenceInDays(lastDate, firstDate);
    if (diffDays <= 2) return 'hour'; if (diffDays <= 31) return 'day'; if (diffDays <= 180) return 'week'; if (diffDays <= 730) return 'month'; return 'year';
}

async function loadActivityHistory(userId) {
    if (!userId || !supabaseClient) return;
    showLoader(tableLoadingOverlay); activitiesEmptyState.style.display = 'none'; activitiesTable.style.display = 'none'; paginationControls.style.display = 'none';
    activitiesTableBody.innerHTML = Array(activitiesPerPage).fill(0).map(() => `<tr class="skeleton-row"><td><div class="skeleton text-sm" style="width: 70px;"></div></td><td><div class="skeleton text-sm" style="width: 80px;"></div></td><td><div class="skeleton text-sm" style="width: 150px;"></div></td><td><div class="skeleton text-sm" style="width: 40px;"></div></td><td><div class="skeleton text-sm" style="width: 90px;"></div></td></tr>`).join('');
    activitiesTableBody.classList.add('loading'); activitiesTable.style.display = 'table';
    const startIndex = (currentPage - 1) * activitiesPerPage;
    try {
        let query = supabaseClient // Use supabaseClient
            .from('user_activity').select('*', { count: 'exact' }).eq('user_id', userId);
        if (currentActivityFilter !== 'all') { query = query.eq('type', currentActivityFilter); }
        query = query.order(currentSortColumn, { ascending: currentSortDirection === 'asc' }).range(startIndex, startIndex + activitiesPerPage - 1);
        const { data, error, count } = await query;
        if (error) throw error;
        totalActivities = count || 0;
        renderActivities(data); renderPagination();
        if (!data || data.length === 0) { activitiesEmptyState.style.display = 'block'; activitiesTable.style.display = 'none'; } else { activitiesTable.style.display = 'table'; }
    } catch (error) {
        console.error("Error loading activity history:", error); showToast("Nepodařilo se načíst historii aktivit.", "error");
        activitiesTableBody.innerHTML = ''; activitiesEmptyState.style.display = 'block';
        activitiesEmptyState.innerHTML = `<i class="fas fa-exclamation-triangle"></i><h3>Chyba načítání</h3><p>Nelze zobrazit historii aktivit.</p>`;
        activitiesTable.style.display = 'none';
    } finally {
        hideLoader(tableLoadingOverlay); activitiesTableBody.classList.remove('loading');
        activitiesTableBody.querySelectorAll('.skeleton-row').forEach(row => row.remove());
    }
}

function renderActivities(activities) {
    activitiesTableBody.innerHTML = '';
    if (!activities || activities.length === 0) { return; }
    activities.forEach(activity => {
        const row = activitiesTableBody.insertRow();
        row.insertCell().textContent = formatDateSimple(activity.created_at);
        const typeCell = row.insertCell(); typeCell.innerHTML = getActivityTypeBadge(activity.type);
        const titleCell = row.insertCell(); titleCell.textContent = activity.title || activity.description || 'N/A'; titleCell.classList.add('activity-title'); if (activity.title || activity.description) { titleCell.title = activity.title || activity.description; }
        const pointsCell = row.insertCell(); pointsCell.textContent = activity.points_earned !== null ? formatNumber(activity.points_earned) : '-'; pointsCell.classList.add(activity.points_earned > 0 ? 'points-positive' : (activity.points_earned < 0 ? 'points-negative' : ''));
        const statusCell = row.insertCell(); statusCell.innerHTML = getActivityStatusBadge(activity.status);
    });
     if (typeof $ !== 'undefined' && $.fn.tooltipster) { $('#activities-body .activity-title[title]').tooltipster({ theme: 'tooltipster-shadow', side: 'top', distance: 3 }); }
}

function getActivityTypeBadge(type) {
    let iconClass = 'fas fa-question-circle'; let text = type; let colorClass = 'badge-dark';
    switch (type) {
        case 'test': iconClass = 'fas fa-vial'; text = 'Test'; colorClass = 'badge-secondary'; break;
        case 'diagnostic': iconClass = 'fas fa-stethoscope'; text = 'Diagnostika'; colorClass = 'badge-info'; break;
        case 'exercise': iconClass = 'fas fa-pencil-alt'; text = 'Cvičení'; colorClass = 'badge-success'; break;
        case 'lesson': iconClass = 'fas fa-book-open'; text = 'Lekce'; colorClass = 'badge-warning'; break;
        case 'badge': iconClass = 'fas fa-medal'; text = 'Odznak'; colorClass = 'badge-gold'; break;
        case 'plan_generated': iconClass = 'fas fa-route'; text = 'Plán'; colorClass = 'badge-purple'; break;
        case 'level_up': iconClass = 'fas fa-arrow-up'; text = 'Postup'; colorClass = 'badge-cyan'; break;
        case 'other': iconClass = 'fas fa-asterisk'; text = 'Jiné'; break;
    }
    text = text.charAt(0).toUpperCase() + text.slice(1); return `<span class="badge ${colorClass}"><i class="${iconClass}"></i> ${text}</span>`;
}

function getActivityStatusBadge(status) {
    let iconClass = 'fas fa-info-circle'; let text = status; let colorClass = 'badge-dark';
    switch (status?.toLowerCase()) {
        case 'completed': case 'passed': iconClass = 'fas fa-check-circle'; text = 'Dokončeno'; colorClass = 'badge-success'; break;
        case 'failed': iconClass = 'fas fa-times-circle'; text = 'Neúspěch'; colorClass = 'badge-danger'; break;
        case 'in_progress': iconClass = 'fas fa-spinner fa-spin'; text = 'Probíhá'; colorClass = 'badge-info'; break;
        case 'skipped': iconClass = 'fas fa-forward'; text = 'Přeskočeno'; colorClass = 'badge-warning'; break;
        case 'generated': iconClass = 'fas fa-cogs'; text = 'Vytvořeno'; colorClass = 'badge-purple'; break;
        case 'awarded': iconClass = 'fas fa-trophy'; text = 'Uděleno'; colorClass = 'badge-gold'; break;
        default: text = status || 'Neznámý';
    }
     text = text.charAt(0).toUpperCase() + text.slice(1); return `<span class="badge ${colorClass}"><i class="${iconClass}"></i> ${text}</span>`;
}

function setupTableSorting() {
    activitiesTable?.querySelectorAll('thead th[data-sort]').forEach(header => header.replaceWith(header.cloneNode(true)));
    activitiesTable?.querySelectorAll('thead th[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            const sortKey = header.dataset.sort;
            if (currentSortColumn === sortKey) { currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc'; } else { currentSortColumn = sortKey; currentSortDirection = 'desc'; }
            activitiesTable.querySelectorAll('thead th[data-sort] i').forEach(icon => { icon.className = 'fas fa-sort'; });
            const currentIcon = header.querySelector('i'); if (currentIcon) { currentIcon.className = `fas ${currentSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}`; }
            currentPage = 1; loadActivityHistory(currentUser.id);
        });
        const initialSortKey = header.dataset.sort; const initialIcon = header.querySelector('i');
        if (initialIcon) { if (initialSortKey === currentSortColumn) { initialIcon.className = `fas ${currentSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}`; } else { initialIcon.className = 'fas fa-sort'; } }
    });
}

function setupActivityFilter() {
    activityTypeFilter?.addEventListener('change', (e) => { currentActivityFilter = e.target.value; currentPage = 1; loadActivityHistory(currentUser.id); });
}

function renderPagination() {
    if (!paginationControls) return; const totalPages = Math.ceil(totalActivities / activitiesPerPage);
    if (totalPages <= 1) { paginationControls.style.display = 'none'; return; }
    paginationControls.style.display = 'flex'; updateElementText(pageInfo, `Strana ${currentPage} z ${totalPages}`);
    prevPageBtn.disabled = currentPage === 1; nextPageBtn.disabled = currentPage === totalPages;
}

function setupPagination() {
    prevPageBtn?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadActivityHistory(currentUser.id); } });
    nextPageBtn?.addEventListener('click', () => { const totalPages = Math.ceil(totalActivities / activitiesPerPage); if (currentPage < totalPages) { currentPage++; loadActivityHistory(currentUser.id); } });
}

function exportTableToCSV(filename = 'historie-aktivit.csv') {
     if (!activitiesTable || !activitiesTable.tHead || !activitiesTable.tBodies[0]) { showToast("Tabulka není připravena k exportu.", "error"); return; }
     const headers = Array.from(activitiesTable.tHead.rows[0].cells).map(th => th.textContent.replace(/[\s\u2191\u2193\u2195]/g, '').trim()).join(',');
     const rows = Array.from(activitiesTable.tBodies[0].rows).map(row => Array.from(row.cells).map(td => { let cellText = td.textContent.trim().replace(/\s+/g, ' '); return `"${cellText.replace(/"/g, '""')}"`; }).join(',')).join('\n');
     if (!rows) { showToast("Žádná data k exportu.", "warning"); return; }
     const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
     try { const encodedUri = encodeURI(csvContent); const link = document.createElement('a'); link.setAttribute('href', encodedUri); link.setAttribute('download', filename); document.body.appendChild(link); link.click(); document.body.removeChild(link); showToast("Tabulka byla exportována.", "success"); } catch (e) { console.error("CSV Export failed:", e); showToast("Export tabulky se nezdařil.", "error"); }
}

// --- Initialization ---

async function initializePage() {
    showLoader(initialLoader);
    globalErrorContainer.style.display = 'none';

    if (!supabaseClient) { hideLoader(initialLoader); return; } // Should be initialized by now

    currentUser = await getUser();
    if (!currentUser) { hideLoader(initialLoader); return; } // getUser handles redirect

    try {
        const [profileData, titlesData] = await Promise.all([ getUserProfile(currentUser.id), fetchTitles() ]);
        currentProfile = profileData; userTitles = titlesData;
        // Handle case where profile might still be null (e.g., just created)
        updateHeaderAndSidebar(currentProfile, userTitles); // Update UI even if profile is null
        initNotifications();

        // Don't proceed to load data if profile is still null after initial check
        if (!currentProfile) {
            console.warn("Profile is null, skipping data loading.");
            hideLoader(initialLoader);
            // Optionally keep showing a message or retry logic
            return;
        }

        await Promise.all([ loadOverallStats(currentUser.id), loadProgressChart(currentUser.id, chartPeriodSelect.value), loadActivityHistory(currentUser.id) ]);
        mainContent?.classList.add('loaded');
    } catch (error) {
         console.error("Initialization failed after getting user:", error);
         if (globalErrorContainer && !globalErrorContainer.textContent) { showGlobalError("Během inicializace stránky došlo k chybě."); }
    } finally {
        hideLoader(initialLoader);
        setupEntranceAnimations();
    }
}

// Setup Event Listeners
function setupEventListeners() {
    refreshButton?.addEventListener('click', () => {
        showToast("Obnovuji data...");
        if (currentUser) {
             Promise.all([ loadOverallStats(currentUser.id), loadProgressChart(currentUser.id, chartPeriodSelect.value), loadActivityHistory(currentUser.id), updateNotificationBadge() ])
             .catch(err => console.error("Refresh failed:", err));
         } else { initializePage(); }
    });
    chartPeriodSelect?.addEventListener('change', (e) => { if (currentUser) { loadProgressChart(currentUser.id, e.target.value); } });
    setupTableSorting(); setupActivityFilter(); setupPagination(); setupSidebarToggle();
    exportTableBtn?.addEventListener('click', () => exportTableToCSV());
    const currentYear = new Date().getFullYear(); document.querySelectorAll('#currentYearFooter, #currentYearSidebar').forEach(el => el.textContent = currentYear);
    const header = document.querySelector('.dashboard-header'); const mainArea = document.querySelector('main#main-content');
    if (header && mainArea) { mainArea.addEventListener('scroll', () => { document.body.classList.toggle('scrolled', mainArea.scrollTop > 20); }, { passive: true }); }
}

// Setup Entrance Animations
function setupEntranceAnimations() {
    const animatedElements = document.querySelectorAll('[data-animate]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                 requestAnimationFrame(() => { const delay = parseInt(entry.target.style.getPropertyValue('--animation-order') || '0', 10) * 100; setTimeout(() => { entry.target.classList.add('animate-in'); }, delay); });
                 observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    animatedElements.forEach(el => observer.observe(el));
}

// Setup Mouse Follower
function setupMouseFollower() {
    const follower = document.getElementById('mouse-follower'); if (!follower) return; let mouseMoved = false;
    const updateFollowerPosition = (e) => { if (!mouseMoved) { document.body.classList.add('mouse-has-moved'); mouseMoved = true; } follower.style.left = `${e.pageX}px`; follower.style.top = `${e.pageY}px`; }
    document.addEventListener('mousemove', updateFollowerPosition, { passive: true });
    const interactiveSelector = 'a, button, [role="button"], .stats-card, .notification-item, th[data-sort], .sidebar-link, input, select, textarea';
    document.querySelectorAll(interactiveSelector).forEach(el => { el.addEventListener('mouseenter', () => follower.classList.add('active')); el.addEventListener('mouseleave', () => follower.classList.remove('active')); });
}

// --- Run on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing Pokrok Page.");
    try {
        if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') { throw new Error("Supabase library not loaded or initialized globally."); }
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); // Use corrected keys
        console.log("Supabase client created successfully using Pokrok page keys.");
        setupEventListeners();
        setupMouseFollower();
        initializePage(); // Start data loading etc.
        if (typeof $ !== 'undefined' && $.fn.tooltipster) { console.log("Initializing Tooltips"); $('.btn-tooltip, .sidebar-toggle-btn, .notification-bell').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); } else { console.warn("Tooltipster library not found."); }
    } catch (error) {
        console.error("Critical initialization error:", error);
        showGlobalError(`Kritická chyba při inicializaci: ${error.message}. Zkuste obnovit stránku.`);
        hideLoader(initialLoader);
    }
});