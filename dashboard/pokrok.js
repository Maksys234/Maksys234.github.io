// =============================================================================
// POKROK.JS - Logic for the Progress Overview Page (v2 - Error Fixes)
// =============================================================================

// --- Supabase Configuration ---
const SUPABASE_URL = 'https://stworzgwguyhrpkejuvew.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0d29yemd3Z3V5aHJwa2VqdXZldyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzEzMzU0MTYxLCJleHAiOjIwMjkwMzAxNjF9.o4P8jfcj8OKUF-8N-ZNWTvQy472NJqPqzY-dW96f0Lw';

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
    // toast.textContent = message; // Replaced by innerHTML below

    // Optional: Add icon based on type
    let iconClass = 'fas fa-info-circle';
    if (type === 'success') iconClass = 'fas fa-check-circle';
    if (type === 'error') iconClass = 'fas fa-times-circle';
    if (type === 'warning') iconClass = 'fas fa-exclamation-triangle';

    // Add icon and message using innerHTML for simplicity
    toast.innerHTML = `<i class="${iconClass} toast-icon"></i> <span class="toast-message">${message}</span>`;


    container.appendChild(toast);

    // Force reflow to enable animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });


    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
             if (toast.parentNode === container) { // Check if still attached
                container.removeChild(toast);
            }
        }, { once: true });
    }, duration);
}

// Format Date Relatively (e.g., "před 2 hodinami") - Requires date-fns library
function formatDateRelative(dateString) {
    if (!dateString) return '-';
    try {
        // Make sure date-fns and the locale are loaded
        if (typeof dateFns === 'undefined' || typeof dateFns.locale === 'undefined' || typeof dateFns.locale.cs === 'undefined') {
            console.warn("date-fns or CS locale not loaded.");
            return new Date(dateString).toLocaleDateString('cs-CZ'); // Fallback
        }
        return dateFns.formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: dateFns.locale.cs });
    } catch (e) {
        console.error("Error formatting date:", e);
        try { // Stronger fallback
             return new Date(dateString).toLocaleDateString('cs-CZ');
         } catch { return dateString; } // Return original if it's totally invalid
    }
}

// Format Date Simply (e.g., "30. 4. 2025")
function formatDateSimple(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        // Check if date is valid
        if (isNaN(date.getTime())) { throw new Error("Invalid Date"); }
        return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
    } catch (e) {
        console.error("Error formatting simple date:", dateString, e);
        return '-';
    }
}

// Format number with spaces as thousands separator
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// --- Authentication and User Profile ---

async function getUser() {
    if (!supabaseClient) { // Check if client is initialized
        console.error("Supabase client not initialized before calling getUser.");
        showGlobalError("Chyba ověření: Klient databáze není inicializován.");
        return null;
    }
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        if (!session?.user) {
            console.log("User not logged in, redirecting to login.");
            // Add a small delay before redirecting to allow potential error messages to be seen
            showToast("Nejste přihlášeni. Přesměrovávám...", "warning", 2500);
            setTimeout(() => { window.location.href = '/auth/index.html'; }, 1500);
            return null;
        }
        return session.user;
    } catch (error) {
        console.error("Error getting user session:", error);
        showGlobalError("Nepodařilo se ověřit uživatele. Zkuste se znovu přihlásit.");
        // Optional: Force redirect even on error
        // setTimeout(() => window.location.href = '/auth/index.html', 2000);
        return null;
    }
}

async function getUserProfile(userId) {
    if (!userId || !supabaseClient) return null; // Check client
    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*') // Select all columns, including points and selected_title
            .eq('id', userId)
            .single();

        if (error) {
            // Log specific Supabase error
            console.error("Supabase error fetching profile:", error.message);
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
    if (!supabaseClient) return []; // Check client
    try {
        const { data, error } = await supabaseClient
            .from('title_shop')
            .select('id, name'); // Only fetch necessary columns

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching titles:", error);
        showToast("Nepodařilo se načíst seznam titulů.", "error");
        return []; // Return empty array on error
    }
}


// --- UI Update Functions ---

function updateHeaderAndSidebar(profile, titles) {
    if (!profile) return;

    // Update sidebar name
    updateElementText(sidebarUserName, profile.full_name || profile.username || 'Uživatel');

    // Update sidebar avatar (using first letter of name/username)
    const firstLetter = (profile.full_name || profile.username || '?')[0].toUpperCase();
    updateElementText(sidebarUserAvatar, firstLetter);

    // Update sidebar user title
    let titleName = "Pilot"; // Default title
    if (profile.selected_title && titles && titles.length > 0) { // Check titles is array
        const foundTitle = titles.find(t => t.id === profile.selected_title);
        if (foundTitle) {
            titleName = foundTitle.name;
        }
    }
    updateElementText(sidebarUserTitle, titleName);

    // Update header credits display
    updateElementText(creditsValueElement, formatNumber(profile.points ?? 0));
}

// --- Sidebar Toggle Logic ---

function setupSidebarToggle() {
    const body = document.body;

    sidebarToggleBtn?.addEventListener('click', () => {
        body.classList.toggle('sidebar-collapsed');
        // Optional: Save state to localStorage
        localStorage.setItem('sidebarCollapsed', body.classList.contains('sidebar-collapsed'));
        // Dispatch resize event for charts etc.
        window.dispatchEvent(new Event('resize'));
    });

    mobileMenuToggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering clicks on underlying elements
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

    // Optional: Check localStorage for saved state on load
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        body.classList.add('sidebar-collapsed');
    }

     // Update toggle button icon based on state (and on initial load)
     const updateToggleButton = () => {
        const isCollapsed = body.classList.contains('sidebar-collapsed');
        const icon = sidebarToggleBtn?.querySelector('i');
        if (icon) {
            icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        }
        const title = isCollapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel';
        sidebarToggleBtn?.setAttribute('title', title);
        // Reinitialize tooltip if necessary
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


// --- Notification Handling (Standard Implementation) ---

async function fetchNotifications() {
    if (!currentUser || !supabaseClient) return { count: 0, notifications: [] }; // Check client
    try {
        const { data, error, count } = await supabaseClient
            .from('notifications')
            .select('*', { count: 'exact' })
            .eq('user_id', currentUser.id)
            .eq('is_read', false) // Only fetch unread notifications
            .order('created_at', { ascending: false })
            .limit(5); // Limit initial dropdown display

        if (error) throw error;
        return { count: count || 0, notifications: data || [] };
    } catch (error) {
        console.error("Error fetching notifications:", error);
        showToast("Nepodařilo se načíst oznámení.", "error");
        return { count: 0, notifications: [] };
    }
}

function renderNotifications(notifications) {
    notificationsList.innerHTML = ''; // Clear previous list
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

            // Determine icon based on type (adjust types as needed)
            let iconClass = 'fas fa-info-circle'; // Default
            if (notif.type === 'achievement') iconClass = 'fas fa-medal';
            else if (notif.type === 'system') iconClass = 'fas fa-cog';
            else if (notif.type === 'message') iconClass = 'fas fa-envelope';
            else if (notif.type === 'level_up') iconClass = 'fas fa-arrow-up';
             else if (notif.type === 'badge') iconClass = 'fas fa-medal'; // Reuse medal for badge type

            li.innerHTML = `
                <div class="notification-icon" style="background-color: ${getNotificationColor(notif.type)};"><i class="${iconClass}"></i></div>
                <div class="notification-content">
                    <p class="notification-message">${notif.message || 'Žádná zpráva'}</p>
                    <span class="notification-time">${formatDateRelative(notif.created_at)}</span>
                </div>
                <button class="mark-read-btn" title="Označit jako přečtené"><i class="fas fa-check"></i></button>
            `;
            notificationsList.appendChild(li);

            // Add event listener for individual mark-read button
            li.querySelector('.mark-read-btn')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                await markNotificationAsRead(notif.id);
                li.remove(); // Remove visually immediately
                updateNotificationBadge(); // Update count after marking read
                 // Re-check if list is empty
                 if (notificationsList.children.length === 0) {
                    noNotificationsMsg.style.display = 'block';
                    markAllReadBtn.disabled = true;
                 }
            });

            // Optional: Make the whole item clickable to mark read or navigate
            li.addEventListener('click', async () => {
                // Example: Navigate if a link exists, otherwise just mark read
                // if (notif.link) {
                //     window.location.href = notif.link;
                // }
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
    // Assign colors based on notification type for better visual distinction
    switch (type) {
        case 'achievement':
        case 'badge':
             return 'var(--gold-color)'; // Use gold for achievements/badges
        case 'system': return 'var(--accent-blue)'; // Assuming blue exists or use primary
        case 'warning': return 'var(--warning)';
        case 'error': return 'var(--danger)';
        case 'level_up': return 'var(--secondary-color)'; // Purple for level up
        case 'message': return 'var(--info)';
        default: return 'var(--text-muted)'; // Default color
    }
}

async function updateNotificationBadge() {
    if (!currentUser) return; // Don't fetch if no user
    const { count } = await fetchNotifications(); // Re-fetch to get current count
    notificationCountBadge.textContent = count > 9 ? '9+' : count;
    // Use CSS class to control visibility based on count > 0
     notificationCountBadge.classList.toggle('visible', count > 0);
     notificationCountBadge.dataset.count = count; // Store count if needed
}

async function markNotificationAsRead(notificationId) {
     if (!currentUser || !supabaseClient || !notificationId) return; // Checks
    try {
        const { error } = await supabaseClient
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId)
            .eq('user_id', currentUser.id); // Ensure user owns the notification

        if (error) throw error;
        console.log(`Notification ${notificationId} marked as read.`);
    } catch (error) {
        console.error(`Error marking notification ${notificationId} as read:`, error);
        showToast("Chyba při označování oznámení.", "error");
    }
}

async function markAllNotificationsRead() {
    if (!currentUser || !supabaseClient) return; // Checks
    markAllReadBtn.disabled = true; // Disable button during operation
    markAllReadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Show loading state

    try {
        const { error } = await supabaseClient
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', currentUser.id)
            .eq('is_read', false); // Only update unread ones

        if (error) throw error;

        notificationsList.innerHTML = ''; // Clear the list visually
        noNotificationsMsg.style.display = 'block';
        updateNotificationBadge(); // Badge should show 0
        showToast("Všechna oznámení označena jako přečtená.", "success");

    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        showToast("Nepodařilo se označit všechna oznámení.", "error");
    } finally {
         markAllReadBtn.innerHTML = 'Vymazat vše'; // Restore button text
         markAllReadBtn.disabled = true; // Keep disabled as list is now empty
    }
}

function initNotifications() {
    if (!notificationBell) return; // Element check

    updateNotificationBadge(); // Initial badge update

    notificationBell.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isOpen = notificationsDropdown.classList.toggle('show'); // Use 'show' class
        if (isOpen) {
            const { notifications } = await fetchNotifications();
            renderNotifications(notifications);
        }
    });

    markAllReadBtn?.addEventListener('click', markAllNotificationsRead);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
         // Check if the click target is outside the bell and the dropdown itself
         if (notificationsDropdown && notificationBell && !notificationBell.contains(e.target) && !notificationsDropdown.contains(e.target)) {
             notificationsDropdown.classList.remove('show'); // Use 'show' class
         }
     });
}


// --- Core Pokrok Logic ---

// Load Overall Stats
async function loadOverallStats(userId) {
    if (!userId || !supabaseClient) return; // Check client

    // Show skeletons in cards
    statsGrid?.querySelectorAll('.stats-card')?.forEach(card => card.classList.add('loading'));

    try {
        // Fetch profile again to get latest points and other stats if needed
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('points, study_streak, longest_study_streak, overall_progress, last_activity_date')
            .eq('id', userId)
            .single();

        if (profileError) throw profileError;

        // Fetch count of completed activities (non-badge, non-plan, non-levelup)
         const { count: completedCount, error: countError } = await supabaseClient
            .from('user_activity')
            .select('*', { count: 'exact', head: true }) // head: true for count only
            .eq('user_id', userId)
            .not('type', 'in', '("badge", "plan_generated", "level_up")')
            .in('status', ['completed', 'passed']); // Consider both 'completed' and 'passed'

        if (countError) throw countError;

        // Update Stats Cards
        updateElementText(overallProgressValueEl, `${profile.overall_progress ?? 0} %`);
        updateElementText(overallProgressDescEl, "Průměrný pokrok"); // Static text
        updateElementText(overallProgressFooterEl, profile.last_activity_date ? `Poslední aktivita: ${formatDateRelative(profile.last_activity_date)}` : 'Zatím žádná aktivita');

        updateElementText(totalPointsValueEl, formatNumber(profile.points ?? 0));
        updateElementText(totalPointsFooterEl, "Celkem kreditů získáno"); // Placeholder

        const streakDaysText = (days) => days === 1 ? 'den' : (days > 1 && days < 5 ? 'dny' : 'dní');
        updateElementText(streakValueEl, `${profile.study_streak ?? 0} ${streakDaysText(profile.study_streak ?? 0)}`);
        updateElementText(streakFooterEl, `Nejdelší série: ${profile.longest_study_streak ?? 0} ${streakDaysText(profile.longest_study_streak ?? 0)}`);

        updateElementText(completedCountValueEl, formatNumber(completedCount ?? 0));
        updateElementText(completedCountFooterEl, "Dokončených testů a cvičení"); // Placeholder

    } catch (error) {
        console.error("Error loading overall stats:", error);
        showToast("Nepodařilo se načíst statistiky pokroku.", "error");
        // Optionally show error state in cards
        statsGrid?.querySelectorAll('.stats-card')?.forEach(card => {
            card.classList.add('error'); // Add an error class for styling
            const footer = card.querySelector('.stats-card-footer');
            if(footer) footer.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Chyba načítání`;
        });
    } finally {
         // Hide skeletons after loading (success or error)
        statsGrid?.querySelectorAll('.stats-card')?.forEach(card => card.classList.remove('loading'));
    }
}


// Load and Render Progress Chart
async function loadProgressChart(userId, period = 'month') {
    if (!userId || !chartContainer || !supabaseClient) return; // Check client

    showLoader(chartLoadingOverlay);
    chartEmptyState.style.display = 'none'; // Hide empty state initially

    try {
        let dateFrom;
        const now = new Date();
        // Ensure dateFns is loaded
        if (typeof dateFns === 'undefined') throw new Error("Date library not loaded.");

        switch (period) {
            case 'week':
                dateFrom = dateFns.subDays(now, 7);
                break;
            case 'month':
                dateFrom = dateFns.subMonths(now, 1);
                break;
            case '3months':
                dateFrom = dateFns.subMonths(now, 3);
                break;
            case 'all':
            default:
                dateFrom = null; // Fetch all data
                break;
        }

        let query = supabaseClient
            .from('user_progress_log') // Assuming a table logging progress over time
            .select('created_at, overall_progress')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (dateFrom) {
            query = query.gte('created_at', dateFrom.toISOString());
        }

        const { data, error } = await query;

        if (error) throw error;

        if (!data || data.length < 2) { // Need at least 2 points to draw a meaningful line
            chartEmptyState.style.display = 'flex';
            if (progressChart) {
                progressChart.destroy();
                progressChart = null;
            }
            chartEmptyState.innerHTML = `<i class="fas fa-chart-line"></i><p>Nedostatek dat pro zobrazení grafu.</p>`; // Default empty message
        } else {
            renderChart(data);
            chartEmptyState.style.display = 'none';
        }

    } catch (error) {
        console.error(`Error loading progress chart data (${period}):`, error);
        showToast("Nepodařilo se načíst data pro graf pokroku.", "error");
        chartEmptyState.style.display = 'flex'; // Show empty state on error
        chartEmptyState.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Chyba načítání grafu.</p>`;
        if (progressChart) {
            progressChart.destroy();
            progressChart = null;
        }
    } finally {
        hideLoader(chartLoadingOverlay);
    }
}

// Render Chart using Chart.js
function renderChart(data) {
    // Ensure Chart.js and adapter are loaded
    if (typeof Chart === 'undefined' || typeof Chart.adapters === 'undefined' || typeof dateFns === 'undefined') {
        console.error("Chart.js or Date Adapter not loaded.");
        showGlobalError("Chyba: Knihovna pro grafy nebyla správně načtena.");
        chartEmptyState.style.display = 'flex';
        chartEmptyState.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Chyba inicializace grafu.</p>`;
        return;
    }
    if (!chartContainer || !data) return;

    const ctx = chartContainer.getContext('2d');

    // Prepare data for Chart.js
    const labels = data.map(item => new Date(item.created_at));
    const chartData = data.map(item => item.overall_progress);

    // Destroy previous chart instance if exists
    if (progressChart) {
        progressChart.destroy();
    }

    // Styling from CSS variables
    const bodyStyles = getComputedStyle(document.body);
    const primaryColor = bodyStyles.getPropertyValue('--primary-color').trim() || '#00e0ff';
    const gridColor = bodyStyles.getPropertyValue('--border-color-light').trim() || 'rgba(160, 92, 255, 0.25)';
    const textColor = bodyStyles.getPropertyValue('--text-medium').trim() || '#b8c4e0';


    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Celkový pokrok (%)',
                data: chartData,
                borderColor: primaryColor,
                backgroundColor: primaryColor + '33', // Semi-transparent fill
                tension: 0.3, // Smoothens the line
                pointBackgroundColor: primaryColor,
                pointBorderColor: '#fff',
                pointHoverRadius: 6,
                pointRadius: 4,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: calculateTimeUnit(labels), // Dynamically choose unit
                        tooltipFormat: 'dd.MM.yyyy HH:mm', // Format for tooltips
                        displayFormats: { // Adjust display formats based on time scale
                            millisecond: 'HH:mm:ss.SSS',
                            second: 'HH:mm:ss',
                            minute: 'HH:mm',
                            hour: 'dd.MM HH:mm',
                            day: 'dd.MM.yy', // Shorter format
                            week: 'dd.MM.yy',
                            month: 'MMM yyyy',
                            quarter: 'QQQ yyyy',
                            year: 'yyyy',
                        }
                    },
                    adapters: {
                        date: { // Ensure date-fns adapter is used correctly
                           locale: dateFns.locale.cs,
                        }
                    },
                    grid: {
                        color: gridColor,
                    },
                    ticks: {
                        color: textColor,
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8 // Limit ticks for readability on smaller screens
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100, // Progress is likely percentage
                    title: {
                        display: true,
                        text: 'Pokrok (%)',
                        color: textColor
                    },
                    grid: {
                        color: gridColor,
                    },
                    ticks: {
                        color: textColor,
                        stepSize: 20 // Wider steps
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // Hide legend if only one dataset
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 10,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    callbacks: {
                        title: function(tooltipItems) {
                           // Format tooltip title using date-fns
                            const date = tooltipItems[0].parsed.x;
                            return dateFns.format(new Date(date), 'PPPp', { locale: dateFns.locale.cs }); // Longer format for tooltip
                         },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1) + '%'; // Add decimal point
                            }
                            return label;
                        }
                    }
                }
            },
            interaction: { // Enhance interaction
                mode: 'index',
                intersect: false,
            },
            hover: {
                mode: 'nearest',
                intersect: true
            }
        }
    });
}

// Calculate appropriate time unit for chart axis based on data range
function calculateTimeUnit(labels) {
    if (!labels || labels.length < 2 || typeof dateFns === 'undefined') return 'day';
    const firstDate = labels[0];
    const lastDate = labels[labels.length - 1];
    const diffDays = dateFns.differenceInDays(lastDate, firstDate);

    if (diffDays <= 2) return 'hour';
    if (diffDays <= 31) return 'day';
    if (diffDays <= 180) return 'week';
    if (diffDays <= 730) return 'month';
    return 'year';
}

// Load User Activity History
async function loadActivityHistory(userId) {
    if (!userId || !supabaseClient) return; // Check client

    showLoader(tableLoadingOverlay);
    activitiesEmptyState.style.display = 'none';
    activitiesTable.style.display = 'none'; // Hide table initially
    paginationControls.style.display = 'none';

    // Show skeleton rows while loading
    activitiesTableBody.innerHTML = Array(activitiesPerPage).fill(0).map(() => `
        <tr class="skeleton-row"><td><div class="skeleton text-sm" style="width: 70px;"></div></td><td><div class="skeleton text-sm" style="width: 80px;"></div></td><td><div class="skeleton text-sm" style="width: 150px;"></div></td><td><div class="skeleton text-sm" style="width: 40px;"></div></td><td><div class="skeleton text-sm" style="width: 90px;"></div></td></tr>
    `).join('');
    activitiesTableBody.classList.add('loading'); // Add loading class to tbody
    activitiesTable.style.display = 'table'; // Show table container


    const startIndex = (currentPage - 1) * activitiesPerPage;

    try {
        let query = supabaseClient
            .from('user_activity')
            .select('*', { count: 'exact' }) // Get total count for pagination
            .eq('user_id', userId);

        // Apply filter
        if (currentActivityFilter !== 'all') {
            query = query.eq('type', currentActivityFilter);
        }

        // Apply sorting
        query = query.order(currentSortColumn, { ascending: currentSortDirection === 'asc' });

        // Apply pagination
        query = query.range(startIndex, startIndex + activitiesPerPage - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        totalActivities = count || 0;

        // Render actual data (will replace skeletons)
        renderActivities(data);
        renderPagination();

        if (!data || data.length === 0) {
            activitiesEmptyState.style.display = 'block';
            activitiesTable.style.display = 'none';
        } else {
            activitiesTable.style.display = 'table';
        }

    } catch (error) {
        console.error("Error loading activity history:", error);
        showToast("Nepodařilo se načíst historii aktivit.", "error");
        activitiesTableBody.innerHTML = ''; // Clear skeletons on error
        activitiesEmptyState.style.display = 'block';
        activitiesEmptyState.innerHTML = `<i class="fas fa-exclamation-triangle"></i><h3>Chyba načítání</h3><p>Nelze zobrazit historii aktivit.</p>`;
        activitiesTable.style.display = 'none';
    } finally {
        hideLoader(tableLoadingOverlay);
        activitiesTableBody.classList.remove('loading'); // Remove loading class
         // Ensure skeleton rows are definitely removed if rendering was skipped on error
         activitiesTableBody.querySelectorAll('.skeleton-row').forEach(row => row.remove());
    }
}

// Render Activities in Table
function renderActivities(activities) {
    activitiesTableBody.innerHTML = ''; // Clear previous entries or skeletons

    if (!activities || activities.length === 0) {
        // Empty state is handled by loadActivityHistory
        return;
    }

    activities.forEach(activity => {
        const row = activitiesTableBody.insertRow();
        row.insertCell().textContent = formatDateSimple(activity.created_at); // Format date simply

        const typeCell = row.insertCell();
        typeCell.innerHTML = getActivityTypeBadge(activity.type);

        const titleCell = row.insertCell();
        titleCell.textContent = activity.title || activity.description || 'N/A';
        titleCell.classList.add('activity-title'); // Add class for potential styling/truncation
        if (activity.title || activity.description) { // Add tooltip for long titles
            titleCell.title = activity.title || activity.description;
        }


        const pointsCell = row.insertCell();
        pointsCell.textContent = activity.points_earned !== null ? formatNumber(activity.points_earned) : '-';
        pointsCell.classList.add(activity.points_earned > 0 ? 'points-positive' : (activity.points_earned < 0 ? 'points-negative' : ''));

        const statusCell = row.insertCell();
        statusCell.innerHTML = getActivityStatusBadge(activity.status);
    });

     // Re-initialize tooltips if using a library for the potentially added titles
     if (typeof $ !== 'undefined' && $.fn.tooltipster) {
         $('#activities-body .activity-title[title]').tooltipster({ theme: 'tooltipster-shadow', side: 'top', distance: 3 });
     }
}

// Generate Badge for Activity Type
function getActivityTypeBadge(type) {
    let iconClass = 'fas fa-question-circle';
    let text = type;
    let colorClass = 'badge-dark'; // Default color

    switch (type) {
        case 'test': iconClass = 'fas fa-vial'; text = 'Test'; colorClass = 'badge-secondary'; break; // Purple
        case 'diagnostic': iconClass = 'fas fa-stethoscope'; text = 'Diagnostika'; colorClass = 'badge-info'; break; // Cyan
        case 'exercise': iconClass = 'fas fa-pencil-alt'; text = 'Cvičení'; colorClass = 'badge-success'; break; // Lime
        case 'lesson': iconClass = 'fas fa-book-open'; text = 'Lekce'; colorClass = 'badge-warning'; break; // Orange
        case 'badge': iconClass = 'fas fa-medal'; text = 'Odznak'; colorClass = 'badge-gold'; break; // Gold
        case 'plan_generated': iconClass = 'fas fa-route'; text = 'Plán'; colorClass = 'badge-purple'; break; // Use a defined purple or secondary
        case 'level_up': iconClass = 'fas fa-arrow-up'; text = 'Postup'; colorClass = 'badge-cyan'; break; // Use a defined cyan or info
        case 'other': iconClass = 'fas fa-asterisk'; text = 'Jiné'; break;
    }
    // Capitalize first letter of text
    text = text.charAt(0).toUpperCase() + text.slice(1);
    return `<span class="badge ${colorClass}"><i class="${iconClass}"></i> ${text}</span>`;
}

// Generate Badge for Activity Status
function getActivityStatusBadge(status) {
    let iconClass = 'fas fa-info-circle';
    let text = status;
    let colorClass = 'badge-dark';

    switch (status?.toLowerCase()) {
        case 'completed':
        case 'passed':
             iconClass = 'fas fa-check-circle'; text = 'Dokončeno'; colorClass = 'badge-success'; break;
        case 'failed': iconClass = 'fas fa-times-circle'; text = 'Neúspěch'; colorClass = 'badge-danger'; break;
        case 'in_progress': iconClass = 'fas fa-spinner fa-spin'; text = 'Probíhá'; colorClass = 'badge-info'; break;
        case 'skipped': iconClass = 'fas fa-forward'; text = 'Přeskočeno'; colorClass = 'badge-warning'; break;
        case 'generated': iconClass = 'fas fa-cogs'; text = 'Vytvořeno'; colorClass = 'badge-purple'; break; // For plan generation etc.
        case 'awarded': iconClass = 'fas fa-trophy'; text = 'Uděleno'; colorClass = 'badge-gold'; break; // For badges/levels
        default: text = status || 'Neznámý'; // Handle null/undefined status
    }
     // Capitalize first letter of text
     text = text.charAt(0).toUpperCase() + text.slice(1);
    return `<span class="badge ${colorClass}"><i class="${iconClass}"></i> ${text}</span>`;
}

// Setup Table Sorting
function setupTableSorting() {
    activitiesTable?.querySelectorAll('thead th[data-sort]').forEach(header => {
        // Clear existing listeners first to avoid duplicates if called multiple times
         header.replaceWith(header.cloneNode(true)); // Simple way to remove listeners
    });
     // Re-select headers after cloning
     activitiesTable?.querySelectorAll('thead th[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            const sortKey = header.dataset.sort;
            if (currentSortColumn === sortKey) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = sortKey;
                currentSortDirection = 'desc'; // Default to descending for new column
            }

            // Update visual indicators
            activitiesTable.querySelectorAll('thead th[data-sort] i').forEach(icon => {
                icon.className = 'fas fa-sort'; // Reset others
            });
            const currentIcon = header.querySelector('i');
             if (currentIcon) {
                 currentIcon.className = `fas ${currentSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}`;
             }

            currentPage = 1; // Reset to first page on sort change
            loadActivityHistory(currentUser.id);
        });
         // Set initial sort icon state
         const initialSortKey = header.dataset.sort;
         const initialIcon = header.querySelector('i');
         if (initialIcon) {
             if (initialSortKey === currentSortColumn) {
                  initialIcon.className = `fas ${currentSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}`;
             } else {
                 initialIcon.className = 'fas fa-sort';
             }
         }
    });
}

// Setup Activity Filter
function setupActivityFilter() {
    activityTypeFilter?.addEventListener('change', (e) => {
        currentActivityFilter = e.target.value;
        currentPage = 1; // Reset to first page on filter change
        loadActivityHistory(currentUser.id);
    });
}

// Render Pagination Controls
function renderPagination() {
    if (!paginationControls) return;

    const totalPages = Math.ceil(totalActivities / activitiesPerPage);

    if (totalPages <= 1) {
        paginationControls.style.display = 'none';
        return;
    }
    paginationControls.style.display = 'flex';

    updateElementText(pageInfo, `Strana ${currentPage} z ${totalPages}`);
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
}

// Setup Pagination Buttons
function setupPagination() {
    prevPageBtn?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadActivityHistory(currentUser.id);
        }
    });

    nextPageBtn?.addEventListener('click', () => {
        const totalPages = Math.ceil(totalActivities / activitiesPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            loadActivityHistory(currentUser.id);
        }
    });
}

// Export Table Data to CSV
function exportTableToCSV(filename = 'historie-aktivit.csv') {
     if (!activitiesTable || !activitiesTable.tHead || !activitiesTable.tBodies[0]) {
         showToast("Tabulka není připravena k exportu.", "error");
         return;
     }

     const headers = Array.from(activitiesTable.tHead.rows[0].cells)
        .map(th => th.textContent.replace(/[\s\u2191\u2193\u2195]/g, '').trim()) // Remove sort icons and trim
        .join(',');
    const rows = Array.from(activitiesTable.tBodies[0].rows)
        .map(row => Array.from(row.cells)
            .map(td => {
                 // Clean text content - remove badge icons etc. if needed, handle quotes
                 let cellText = td.textContent.trim();
                 // Remove potential hidden elements or complex content, keep only visible text
                 cellText = cellText.replace(/\s+/g, ' '); // Normalize whitespace
                 return `"${cellText.replace(/"/g, '""')}"`; // Escape double quotes for CSV
             })
            .join(',')
        ).join('\n');

     if (!rows) {
          showToast("Žádná data k exportu.", "warning");
          return;
      }

    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;

    try {
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', filename);
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link);
        showToast("Tabulka byla exportována.", "success");
    } catch (e) {
        console.error("CSV Export failed:", e);
        showToast("Export tabulky se nezdařil.", "error");
    }
}


// --- Initialization ---

// Main function to load all data
async function initializePage() {
    showLoader(initialLoader);
    globalErrorContainer.style.display = 'none'; // Hide previous errors

    // Client initialization happens in DOMContentLoaded now

    if (!supabaseClient) {
        // Error already shown by DOMContentLoaded handler
        hideLoader(initialLoader); // Ensure loader is hidden
        return;
    }

    currentUser = await getUser();
    if (!currentUser) {
        // getUser handles redirection or shows global error
        hideLoader(initialLoader);
        return;
    }

    // Fetch profile and titles in parallel
    try {
        const [profileData, titlesData] = await Promise.all([
            getUserProfile(currentUser.id),
            fetchTitles()
        ]);

        currentProfile = profileData;
        userTitles = titlesData;

        if (!currentProfile) {
             // getUserProfile should have shown an error
             hideLoader(initialLoader);
             return;
        }

        // Initial UI updates requiring profile/titles
        updateHeaderAndSidebar(currentProfile, userTitles);
        initNotifications(); // Requires currentUser and supabaseClient

        // Load main content data
        await Promise.all([
            loadOverallStats(currentUser.id),
            loadProgressChart(currentUser.id, chartPeriodSelect.value),
            loadActivityHistory(currentUser.id)
        ]);

        // Mark main content as loaded for transitions/animations
        mainContent?.classList.add('loaded');


    } catch (error) {
         console.error("Initialization failed after getting user:", error);
         // Avoid showing generic error if specific errors were already shown
         if (globalErrorContainer && !globalErrorContainer.textContent) {
             showGlobalError("Během inicializace stránky došlo k chybě.");
         }
    } finally {
        hideLoader(initialLoader);
         // Trigger animations if elements are now visible
         setupEntranceAnimations();
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Refresh button
    refreshButton?.addEventListener('click', () => {
        showToast("Obnovuji data...");
        // Re-run only the data loading parts, not full initialization
        if (currentUser) {
             Promise.all([
                 loadOverallStats(currentUser.id),
                 loadProgressChart(currentUser.id, chartPeriodSelect.value),
                 loadActivityHistory(currentUser.id),
                 updateNotificationBadge() // Refresh notification count too
             ]).catch(err => console.error("Refresh failed:", err));
         } else {
             initializePage(); // Fallback to full init if user somehow got lost
         }
    });

    // Chart period selector
    chartPeriodSelect?.addEventListener('change', (e) => {
        if (currentUser) {
            loadProgressChart(currentUser.id, e.target.value);
        }
    });

    // Table sorting, filtering, pagination
    setupTableSorting();
    setupActivityFilter();
    setupPagination();

    // Sidebar toggle
    setupSidebarToggle();

    // Export button
    exportTableBtn?.addEventListener('click', () => exportTableToCSV());

     // Current year in footer/sidebar
     const currentYear = new Date().getFullYear();
     const yearElements = document.querySelectorAll('#currentYearFooter, #currentYearSidebar');
     yearElements.forEach(el => el.textContent = currentYear);

     // Track body scroll for header style change
     const header = document.querySelector('.dashboard-header');
     const mainArea = document.querySelector('main#main-content'); // Target the scrolling element
     if (header && mainArea) {
         mainArea.addEventListener('scroll', () => {
             if (mainArea.scrollTop > 20) {
                 document.body.classList.add('scrolled');
             } else {
                 document.body.classList.remove('scrolled');
             }
         });
     }
}

// Setup Entrance Animations for sections/cards
function setupEntranceAnimations() {
    const animatedElements = document.querySelectorAll('[data-animate]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Use requestAnimationFrame for smoother start
                 requestAnimationFrame(() => {
                    const delay = parseInt(entry.target.style.getPropertyValue('--animation-order') || '0', 10) * 100; // Delay based on order
                    setTimeout(() => {
                        entry.target.classList.add('animate-in');
                    }, delay);
                });
                 observer.unobserve(entry.target); // Animate only once
            }
        });
    }, { threshold: 0.1 }); // Trigger when 10% visible

    animatedElements.forEach(el => {
        observer.observe(el);
    });
}

// --- Mouse Follower Glow Effect ---
function setupMouseFollower() {
    const follower = document.getElementById('mouse-follower');
    if (!follower) return;
    let mouseMoved = false; // Flag to enable only after first move

    const updateFollowerPosition = (e) => {
         if (!mouseMoved) {
             document.body.classList.add('mouse-has-moved'); // Enable visibility
             mouseMoved = true;
         }
         // Using pageX/pageY ensures it works correctly even when scrolled
         follower.style.left = `${e.pageX}px`;
         follower.style.top = `${e.pageY}px`;
     }

     // Use passive event listener for performance
    document.addEventListener('mousemove', updateFollowerPosition, { passive: true });

    // Add/remove class on hover over interactive elements
     const interactiveSelector = 'a, button, [role="button"], .stats-card, .notification-item, th[data-sort], .sidebar-link, input, select, textarea';
     document.querySelectorAll(interactiveSelector).forEach(el => {
         el.addEventListener('mouseenter', () => follower.classList.add('active'));
         el.addEventListener('mouseleave', () => follower.classList.remove('active'));
     });
}


// --- Run on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing Pokrok Page.");

    // 1. Initialize Supabase Client
    try {
        // Check if the Supabase library's global object exists
        if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
            throw new Error("Supabase library not loaded or initialized globally.");
        }
        // Assign to the module-scoped variable
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase client created successfully.");

        // 2. Setup Event Listeners (can be done early)
        setupEventListeners();

        // 3. Setup UI Features (like mouse follower)
         setupMouseFollower(); // Initialize the mouse follower effect

        // 4. Initialize Main Page Data (requires supabaseClient)
        initializePage();

        // 5. Initialize Tooltips (after potential dynamic content is loaded)
         if (typeof $ !== 'undefined' && $.fn.tooltipster) {
            console.log("Initializing Tooltips");
             $('.btn-tooltip, .sidebar-toggle-btn, .notification-bell').tooltipster({ // Apply to more elements
                 theme: 'tooltipster-shadow',
                 animation: 'fade',
                 delay: 150,
                 distance: 6,
                 side: 'top'
             });
         } else {
              console.warn("Tooltipster library not found.");
         }

    } catch (error) {
        console.error("Critical initialization error:", error);
        showGlobalError(`Kritická chyba při inicializaci: ${error.message}. Zkuste obnovit stránku.`);
        hideLoader(initialLoader); // Ensure loader is hidden on critical error
    }
});


// --- Helper Functions (Keep at end or organize) ---
// (Ensure all helper functions used above are defined)