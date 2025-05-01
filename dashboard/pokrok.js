// =============================================================================
// POKROK.JS - Logic for the Progress Overview Page (v9 - Full Code with Fixes)
// =============================================================================

// --- Supabase Configuration ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';

// --- Global State ---
let supabaseClient = null;
let currentUser = null;
let currentProfile = null;
let userTitles = [];
let progressChart = null; // Chart instance
let currentPage = 1;
const activitiesPerPage = 10;
let currentSortColumn = 'created_at';
let currentSortDirection = 'desc';
let currentActivityFilter = 'all';
let totalActivities = 0;
// Flag to prevent data loading if critical init fails (like profile fetch)
let isDataLoadingEnabled = true;

// --- DOM Elements Cache ---
const ui = {
    initialLoader: document.getElementById('initial-loader'),
    globalErrorContainer: document.getElementById('global-error'),
    refreshButton: document.getElementById('refresh-btn'),
    mainContent: document.getElementById('main-content'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
    mobileMenuToggleBtn: document.getElementById('main-mobile-menu-toggle'),
    sidebarCloseToggleBtn: document.getElementById('sidebar-close-toggle'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    sidebarUserName: document.getElementById('sidebar-name'),
    sidebarUserAvatar: document.getElementById('sidebar-avatar'),
    sidebarUserTitle: document.getElementById('sidebar-user-title'),
    creditsValueElement: document.getElementById('credits-value'),
    overallProgressValueEl: document.getElementById('overall-progress-value'),
    overallProgressDescEl: document.getElementById('overall-progress-desc'),
    overallProgressFooterEl: document.getElementById('overall-progress-footer'),
    totalPointsValueEl: document.getElementById('total-points-value'),
    totalPointsDescEl: document.getElementById('total-points-desc'),
    totalPointsFooterEl: document.getElementById('total-points-footer'),
    streakValueEl: document.getElementById('streak-value'),
    streakDescEl: document.getElementById('streak-desc'),
    streakFooterEl: document.getElementById('streak-footer'),
    completedCountValueEl: document.getElementById('completed-count-value'),
    completedCountDescEl: document.getElementById('completed-count-desc'),
    completedCountFooterEl: document.getElementById('completed-count-footer'),
    statsGrid: document.getElementById('stats-grid'),
    chartContainer: document.getElementById('progressChart'),
    chartPeriodSelect: document.getElementById('chart-period-select'),
    chartLoadingOverlay: document.getElementById('chart-loading-overlay'),
    chartEmptyState: document.getElementById('chart-empty-state'),
    activitiesTable: document.getElementById('activities-table'),
    activitiesTableBody: document.getElementById('activities-body'),
    tableLoadingOverlay: document.getElementById('table-loading-overlay'),
    activitiesEmptyState: document.getElementById('activities-empty-state'),
    activityTypeFilter: document.getElementById('activity-type-filter'),
    paginationControls: document.getElementById('pagination-controls'),
    prevPageBtn: document.getElementById('prev-page-btn'),
    nextPageBtn: document.getElementById('next-page-btn'),
    pageInfo: document.getElementById('page-info'),
    exportTableBtn: document.getElementById('export-table-btn'),
    notificationBell: document.getElementById('notification-bell'),
    notificationCountBadge: document.getElementById('notification-count'),
    notificationsDropdown: document.getElementById('notifications-dropdown'),
    notificationsList: document.getElementById('notifications-list'),
    noNotificationsMsg: document.getElementById('no-notifications-msg'),
    markAllReadBtn: document.getElementById('mark-all-read'),
    currentYearSidebar: document.getElementById('currentYearSidebar'),
    currentYearFooter: document.getElementById('currentYearFooter')
};

// --- Utility Functions ---
function showLoader(loaderElement) { loaderElement?.classList.remove('hidden'); }
function hideLoader(loaderElement) { loaderElement?.classList.add('hidden'); }
function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
function showGlobalError(message) {
    if (ui.globalErrorContainer) {
        ui.globalErrorContainer.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${sanitizeHTML(message)}</div>`;
        ui.globalErrorContainer.style.display = 'block';
    } else {
        console.error("Global error container not found.");
    }
    console.error("Global Error:", message);
    if (ui.initialLoader) hideLoader(ui.initialLoader);
}
function updateElementText(element, text) { if (element) { element.textContent = text ?? '-'; } }
function updateElementHTML(element, html) { if (element) { element.innerHTML = html ?? ''; } }
function showToast(message, type = 'info', duration = 3000) { const c = document.getElementById('toast-container'); if (!c) return; const t = document.createElement('div'); t.className = `toast toast-${type}`; let iC = 'fas fa-info-circle'; if (type === 'success') iC = 'fas fa-check-circle'; if (type === 'error') iC = 'fas fa-times-circle'; if (type === 'warning') iC = 'fas fa-exclamation-triangle'; t.innerHTML = `<i class="${iC} toast-icon"></i> <span class="toast-message">${sanitizeHTML(message)}</span>`; c.appendChild(t); requestAnimationFrame(() => { t.classList.add('show'); }); setTimeout(() => { t.classList.remove('show'); t.addEventListener('transitionend', () => { if (t.parentNode === c) { c.removeChild(t); } }, { once: true }); }, duration); }
function formatDateRelative(dateString) { if (!dateString) return '-'; try { if (typeof dateFns === 'undefined' || typeof dateFns.locale?.cs === 'undefined') { console.warn("date-fns or CS locale not loaded for relative formatting."); return new Date(dateString).toLocaleDateString('cs-CZ'); } return dateFns.formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: dateFns.locale.cs }); } catch (e) { console.error("Error formatting relative date:", dateString, e); try { return new Date(dateString).toLocaleDateString('cs-CZ'); } catch { return dateString; } } }
function formatDateSimple(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) { throw new Error("Invalid Date"); } return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Error formatting simple date:", dateString, e); return '-'; } }
function formatNumber(num) { if (num === null || num === undefined || isNaN(num)) return '-'; return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
function getInitials(profileData, email) { if (!profileData && !email) return '?'; let initials = ''; if (profileData?.first_name) initials += profileData.first_name[0]; if (profileData?.last_name) initials += profileData.last_name[0]; if (initials) return initials.toUpperCase(); if (profileData?.username) return profileData.username[0].toUpperCase(); if (email) return email[0].toUpperCase(); return 'U'; };

// --- Authentication and User Profile ---
async function getUser() {
    if (!supabaseClient) { console.error("Supabase client not initialized before getUser."); showGlobalError("Chyba ověření: Klient databáze není inicializován."); return null; }
    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) throw sessionError;
        if (session?.user) return session.user;
        console.log("User session not found, redirecting to login.");
        showToast("Relace neplatná. Přihlašte se prosím.", "warning", 2500);
        if (!window.location.pathname.startsWith('/auth/')) { setTimeout(() => { window.location.href = '/auth/index.html'; }, 1500); }
        return null;
    } catch (error) {
        console.error("Error verifying user session:", error);
        showGlobalError("Nepodařilo se ověřit relaci uživatele. Zkuste se znovu přihlásit.");
        if (!window.location.pathname.startsWith('/auth/')) { setTimeout(() => { window.location.href = '/auth/index.html'; }, 2000); }
        return null;
    }
}

async function getUserProfile(userId) {
    if (!userId || !supabaseClient) {
        console.warn("getUserProfile: Missing userId or supabaseClient.");
        return null;
    }
    console.log(`[getUserProfile] Fetching profile for user ID: ${userId}`);
    try {
        // OPRAVA: Odebrán 'full_name', přidán 'first_name', 'last_name', 'avatar_url'
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('id, username, first_name, last_name, points, selected_title, avatar_url') // Select existing columns
            .eq('id', userId)
            .single();

        if (error) {
            console.error(`Supabase error fetching profile (Code: ${error.code}): ${error.message}. Details: ${error.details}`);
            if (error.message.includes("column") && error.message.includes("does not exist")) {
                 showGlobalError("Chyba načítání profilu: Neshoda databázového schématu. Kontaktujte administrátora.");
                 isDataLoadingEnabled = false;
            } else if (error.code === 'PGRST116') {
                console.warn(`Profile not found for user ${userId}.`);
                showGlobalError("Profil uživatele zatím nebyl vytvořen nebo nalezen.");
            } else {
                showGlobalError(`Chyba databáze při načítání profilu: ${error.code || error.message}`);
                isDataLoadingEnabled = false;
            }
            return null;
        }
        console.log("[getUserProfile] Profile data fetched:", profile);
        isDataLoadingEnabled = true;
        return profile;
    } catch (error) {
        console.error("Error fetching user profile (catch block):", error);
        showGlobalError(`Nepodařilo se načíst profil uživatele: ${error.message}`);
        isDataLoadingEnabled = false;
        return null;
    }
}

async function fetchTitles() {
    if (!supabaseClient) return [];
    try {
        const { data, error } = await supabaseClient
            .from('title_shop')
            .select('title_key, name') // Fetching key and display name
            .eq('is_available', true);
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
        updateElementText(ui.sidebarUserName, 'Uživatel');
        updateElementText(ui.sidebarUserAvatar, '?');
        updateElementText(ui.sidebarUserTitle, 'Pilot');
        updateElementText(ui.creditsValueElement, '0');
        return;
    }
    const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || currentUser?.email?.split('@')[0] || 'Pilot';
    updateElementText(ui.sidebarUserName, sanitizeHTML(displayName));

    const initials = getInitials(profile, currentUser?.email);
    const avatarUrl = profile.avatar_url;
    if (ui.sidebarUserAvatar) {
        let finalAvatarUrl = avatarUrl;
        if (avatarUrl && avatarUrl.includes('supabase.co')) {
            finalAvatarUrl = `${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`;
        } else if (avatarUrl) {
            finalAvatarUrl = sanitizeHTML(avatarUrl);
        }

        ui.sidebarUserAvatar.innerHTML = finalAvatarUrl ? `<img src="${finalAvatarUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);

         const img = ui.sidebarUserAvatar.querySelector('img');
         if (img) {
             img.onerror = function() {
                 console.warn(`Failed to load sidebar avatar: ${this.src}`);
                 ui.sidebarUserAvatar.innerHTML = sanitizeHTML(initials);
             };
         }
    }

    let titleName = "Pilot";
    if (profile.selected_title && titles && titles.length > 0) {
        const foundTitle = titles.find(t => t.title_key === profile.selected_title);
        if (foundTitle) {
            titleName = foundTitle.name;
        }
    }
    updateElementText(ui.sidebarUserTitle, sanitizeHTML(titleName));
    updateElementText(ui.creditsValueElement, formatNumber(profile.points ?? 0));
}

// --- Sidebar Toggle Logic ---
function setupSidebarToggle() {
    const body = document.body;
    const toggleButton = ui.sidebarToggleBtn;
    const mobileToggle = ui.mobileMenuToggleBtn;
    const closeButton = ui.sidebarCloseToggleBtn;
    const overlay = ui.sidebarOverlay;

    const applyState = () => {
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        body.classList.toggle('sidebar-collapsed', isCollapsed);
        updateToggleButtonVisuals(isCollapsed);
    };

    const updateToggleButtonVisuals = (isCollapsed) => {
        const icon = toggleButton?.querySelector('i');
        if (icon) {
            icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        }
        const title = isCollapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel';
        toggleButton?.setAttribute('title', title);
        if (typeof $ !== 'undefined' && $.fn.tooltipster && $(toggleButton).hasClass('tooltipstered')) {
            $(toggleButton).tooltipster('content', title);
        }
    };

    toggleButton?.addEventListener('click', () => {
        const isCollapsed = body.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed);
        updateToggleButtonVisuals(isCollapsed);
        window.dispatchEvent(new Event('resize'));
    });

    mobileToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        body.classList.add('sidebar-visible');
        overlay?.classList.add('active');
    });
    closeButton?.addEventListener('click', () => {
        body.classList.remove('sidebar-visible');
        overlay?.classList.remove('active');
    });
    overlay?.addEventListener('click', () => {
        body.classList.remove('sidebar-visible');
        overlay?.classList.remove('active');
    });

    applyState();
}

// --- Notification Handling ---
async function fetchNotifications() {
    if (!currentUser || !supabaseClient) return { count: 0, notifications: [] };
    console.log("[Notifications] Fetching...");
    try {
        // OPRAVA: Změna na 'user_notifications'
        const { data, error, count } = await supabaseClient
            .from('user_notifications') // Use correct table name
            .select('*', { count: 'exact' })
            .eq('user_id', currentUser.id)
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            if (error.code === 'PGRST003' || (error.message && error.message.includes("relation \"public.user_notifications\" does not exist"))) {
                 console.error("Notifications fetch error: Table 'user_notifications' not found or inaccessible (404 likely).", error);
                 // No toast here, as it might spam if the table truly doesn't exist yet
            } else {
                 console.error("Notifications fetch error:", error);
                 throw error; // Rethrow other errors
            }
            return { count: 0, notifications: [] }; // Return empty on error
        }
        console.log(`[Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count ?? 0}`);
        return { count: count || 0, notifications: data || [] };
    } catch (error) {
         console.error("Unexpected error fetching notifications:", error);
         showToast("Nepodařilo se načíst oznámení.", "error");
         return { count: 0, notifications: [] };
    }
}

function renderNotifications(notifications) {
    const list = ui.notificationsList;
    const emptyMsg = ui.noNotificationsMsg;
    const markBtn = ui.markAllReadBtn;

    if (!list || !emptyMsg || !markBtn) {
        console.error("Notification UI elements missing.");
        return;
    }

    list.innerHTML = ''; // Clear previous items
    if (!notifications || notifications.length === 0) {
        emptyMsg.style.display = 'block';
        markBtn.disabled = true;
    } else {
        emptyMsg.style.display = 'none';
        markBtn.disabled = false;
        notifications.forEach(notif => {
            const li = document.createElement('div');
            li.className = 'notification-item';
            li.dataset.id = notif.id;

            let iC = 'fas fa-info-circle'; // Default icon
            const type = notif.type?.toLowerCase() || 'default';
            // Map types to icons (add more as needed)
            const iconMap = {
                achievement: 'fas fa-medal', badge: 'fas fa-medal', system: 'fas fa-cog',
                message: 'fas fa-envelope', level_up: 'fas fa-arrow-up', error: 'fas fa-exclamation-circle',
                warning: 'fas fa-exclamation-triangle', success: 'fas fa-check-circle'
            };
             if (iconMap[type]) { iC = iconMap[type]; }

            li.innerHTML = `
                <div class="notification-icon" style="background-color: ${getNotificationColor(notif.type)};">
                    <i class="${iC}"></i>
                </div>
                <div class="notification-content">
                    <p class="notification-message">${sanitizeHTML(notif.message || 'Žádná zpráva')}</p>
                    <span class="notification-time">${formatDateRelative(notif.created_at)}</span>
                </div>
                <button class="mark-read-btn" title="Označit jako přečtené"><i class="fas fa-check"></i></button>
            `;
            list.appendChild(li);

            li.querySelector('.mark-read-btn')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                await markNotificationAsRead(notif.id);
                li.remove();
                updateNotificationBadge(); // Update count after marking as read
                if (list.children.length === 0 || (list.children.length === 1 && list.children[0] === emptyMsg)) {
                     emptyMsg.style.display = 'block';
                     markBtn.disabled = true;
                 }
            });

            li.addEventListener('click', async () => {
                await markNotificationAsRead(notif.id);
                li.remove();
                 updateNotificationBadge(); // Update count
                 if (list.children.length === 0 || (list.children.length === 1 && list.children[0] === emptyMsg)) {
                     emptyMsg.style.display = 'block';
                     markBtn.disabled = true;
                 }
                 // Optionally redirect if link exists: if (notif.link) window.location.href = notif.link;
            });
        });
    }
}

function getNotificationColor(type) {
    switch (type?.toLowerCase()) {
        case 'achievement': case 'badge': return 'var(--accent-gold, #ffc107)'; // Use fallback color
        case 'system': return 'var(--accent-cyan, #00e0ff)';
        case 'warning': return 'var(--accent-orange, #f8961e)';
        case 'error': return 'var(--accent-pink, #ff33a8)';
        case 'level_up': return 'var(--accent-secondary, #a05cff)';
        case 'message': return 'var(--accent-primary, #00e0ff)';
        case 'success': return 'var(--accent-lime, #6fff3a)';
        default: return 'var(--text-muted, #808db0)';
    }
}

async function updateNotificationBadge() {
    if (!currentUser || !ui.notificationCountBadge) return;
    try {
        const { count } = await fetchNotifications(); // Fetch again to get the latest count
        ui.notificationCountBadge.textContent = count > 9 ? '9+' : (count > 0 ? count : ''); // Show empty if 0
        ui.notificationCountBadge.classList.toggle('visible', count > 0);
        ui.notificationCountBadge.dataset.count = count;
         if (ui.markAllReadBtn) { ui.markAllReadBtn.disabled = count === 0; } // Ensure mark all button state is correct
    } catch (error) {
        console.error("Failed to update notification badge:", error);
        ui.notificationCountBadge.textContent = '!'; // Indicate error
        ui.notificationCountBadge.classList.add('visible');
    }
}

async function markNotificationAsRead(notificationId) {
    if (!currentUser || !supabaseClient || !notificationId) return;
    console.log(`Marking notification ${notificationId} as read...`);
    try {
        const { error } = await supabaseClient
            .from('user_notifications') // Correct table name
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
    if (!currentUser || !supabaseClient || !ui.markAllReadBtn) return;
    ui.markAllReadBtn.disabled = true;
    ui.markAllReadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const { error } = await supabaseClient
            .from('user_notifications') // Correct table name
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', currentUser.id)
            .eq('is_read', false);
        if (error) throw error;
        // Clear UI list and update badge
        if (ui.notificationsList) ui.notificationsList.innerHTML = '';
        if (ui.noNotificationsMsg) ui.noNotificationsMsg.style.display = 'block';
        await updateNotificationBadge(); // Fetch count again (should be 0)
        showToast("Všechna oznámení označena jako přečtená.", "success");
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        showToast("Nepodařilo se označit všechna oznámení.", "error");
    } finally {
        ui.markAllReadBtn.innerHTML = 'Vymazat vše';
        // Re-enable only if there are still unread somehow (unlikely but safe)
        const currentCount = parseInt(ui.notificationCountBadge.textContent || '0');
        ui.markAllReadBtn.disabled = currentCount === 0;
    }
}

function initNotifications() {
    if (!ui.notificationBell) return;
    updateNotificationBadge(); // Initial load
    ui.notificationBell.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isOpen = ui.notificationsDropdown.classList.toggle('show');
        if (isOpen) {
            const { notifications } = await fetchNotifications(); // Fetch on open
            renderNotifications(notifications);
        }
    });
    ui.markAllReadBtn?.addEventListener('click', markAllNotificationsRead);
    document.addEventListener('click', (e) => { // Close on outside click
        if (ui.notificationsDropdown && ui.notificationBell &&
            !ui.notificationBell.contains(e.target) &&
            !ui.notificationsDropdown.contains(e.target) &&
            ui.notificationsDropdown.classList.contains('show'))
        {
            ui.notificationsDropdown.classList.remove('show');
        }
    });
}

// --- Core Pokrok Logic (Stubs with adjusted messages) ---
function loadOverallStats(userId) {
    console.log("loadOverallStats called - showing unavailable state.");
    if (!isDataLoadingEnabled) {
        console.warn("Stats loading skipped due to profile load failure.");
        showToast("Statistiky nelze načíst kvůli chybě profilu.", "warning");
    }
    ui.statsGrid?.querySelectorAll('.stats-card').forEach(card => {
         card.classList.remove('loading');
         const valueEl = card.querySelector('.stats-card-value');
         const descEl = card.querySelector('.stats-card-description');
         const footerEl = card.querySelector('.stats-card-footer');
         if (valueEl) valueEl.textContent = 'N/A';
         if (descEl) descEl.textContent = 'Data nedostupná';
         if (footerEl) footerEl.innerHTML = '<i class="fas fa-times-circle"></i> Nelze načíst';
    });
    if(ui.streakFooterEl) ui.streakFooterEl.textContent = 'Nejdelší série: N/A';
    return Promise.resolve();
}

function loadProgressChart(userId, period = 'month') {
    console.log(`loadProgressChart called for period ${period} - showing unavailable state.`);
    if (!isDataLoadingEnabled) {
        console.warn("Chart data loading skipped due to profile load failure.");
        showToast("Graf pokroku nelze načíst kvůli chybě profilu.", "warning");
    }
    if (ui.chartEmptyState) {
        ui.chartEmptyState.style.display = 'flex';
        ui.chartEmptyState.innerHTML = `<i class="fas fa-chart-bar"></i> <p>Data pro graf nejsou k dispozici.</p>`;
    }
    if (ui.chartLoadingOverlay) hideLoader(ui.chartLoadingOverlay);
    if (ui.chartContainer && ui.chartContainer instanceof HTMLCanvasElement) {
         const ctx = ui.chartContainer.getContext('2d');
         ctx.clearRect(0, 0, ui.chartContainer.width, ui.chartContainer.height); // Clear canvas
    }
    if (progressChart) progressChart.destroy();
    if(ui.chartPeriodSelect) ui.chartPeriodSelect.disabled = false;
    return Promise.resolve();
}

// --- Chart Rendering (Keep Definition) ---
function renderChart(data) {
    if (typeof Chart === 'undefined' || typeof Chart.adapters === 'undefined' || typeof dateFns === 'undefined') { console.error("Chart.js or Date Adapter not loaded."); showGlobalError("Chyba: Knihovna pro grafy nebyla správně načtena."); ui.chartEmptyState.style.display = 'flex'; ui.chartEmptyState.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Chyba inicializace grafu.</p>`; return; }
    if (!ui.chartContainer || !data || !Array.isArray(data) || data.length === 0) { console.warn("renderChart: No data or container."); ui.chartEmptyState.style.display = 'flex'; ui.chartEmptyState.innerHTML = `<i class="fas fa-chart-bar"></i> <p>Pro zobrazení grafu nejsou k dispozici data.</p>`; if (progressChart) progressChart.destroy(); return; }

    ui.chartEmptyState.style.display = 'none'; // Hide empty state
    const ctx = ui.chartContainer.getContext('2d');
    const labels = data.map(item => new Date(item.created_at || item.snapshot_date)); // Use snapshot_date as fallback
    const chartData = data.map(item => item.overall_progress ?? item.points_total ?? 0); // Use progress or points

    if (progressChart) { progressChart.destroy(); }

    const bodyStyles = getComputedStyle(document.body);
    const primaryColor = bodyStyles.getPropertyValue('--accent-primary').trim() || '#00e0ff';
    const gridColor = bodyStyles.getPropertyValue('--border-color-light').trim() || 'rgba(160, 92, 255, 0.25)';
    const textColor = bodyStyles.getPropertyValue('--text-medium').trim() || '#b8c4e0';

    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Pokrok / Body', // Generic label
                data: chartData,
                borderColor: primaryColor,
                backgroundColor: primaryColor + '33', // Use variable with alpha
                tension: 0.3,
                pointBackgroundColor: primaryColor,
                pointBorderColor: '#fff',
                pointHoverRadius: 6,
                pointRadius: 4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: calculateTimeUnit(labels),
                        tooltipFormat: 'P p', // Using date-fns built-in formats
                        displayFormats: { // Recommended formats from chartjs-adapter-date-fns
                             millisecond: 'HH:mm:ss.SSS', second: 'HH:mm:ss', minute: 'HH:mm', hour: 'HH:00',
                             day: 'dd.MM', week: 'dd.MM', month: 'MMM yyyy', quarter: 'QQQ yyyy', year: 'yyyy'
                         }
                    },
                    adapters: {
                        date: { locale: dateFns.locale.cs } // Ensure CS locale is used
                    },
                    grid: { color: gridColor },
                    ticks: { color: textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
                },
                y: {
                    beginAtZero: true,
                    // max: 100, // Max might not always be 100 if using points
                    title: { display: true, text: 'Hodnota (%)', color: textColor },
                    grid: { color: gridColor },
                    ticks: { color: textColor, stepSize: 20, callback: function(value) { return value + '%';} } // Add % sign
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    titleColor: '#fff', bodyColor: '#fff', padding: 10,
                    borderColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1,
                    callbacks: {
                        title: function(tooltipItems) {
                            const date = new Date(tooltipItems[0].parsed.x);
                            if (typeof dateFns !== 'undefined' && typeof dateFns.format === 'function') {
                                return dateFns.format(date, 'PPP p', { locale: dateFns.locale.cs });
                            } return date.toLocaleString();
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) { label += ': '; }
                            if (context.parsed.y !== null) { label += context.parsed.y.toFixed(1); } // Show value without % if it's not always percentage
                            return label;
                        }
                    }
                }
            },
            interaction: { mode: 'index', intersect: false },
            hover: { mode: 'nearest', intersect: true }
        }
    });
}

function calculateTimeUnit(labels) { if (!labels || labels.length < 2 || typeof dateFns === 'undefined') return 'day'; const firstDate = labels[0]; const lastDate = labels[labels.length - 1]; if (!(firstDate instanceof Date) || !(lastDate instanceof Date) || isNaN(firstDate) || isNaN(lastDate)) return 'day'; const diffDays = dateFns.differenceInDays(lastDate, firstDate); if (diffDays <= 2) return 'hour'; if (diffDays <= 31) return 'day'; if (diffDays <= 180) return 'week'; if (diffDays <= 730) return 'month'; return 'year'; }

// --- Activity History Logic (Stubbed) ---
function loadActivityHistory(userId, page = 1, filter = 'all', sortCol = 'created_at', sortDir = 'desc') {
    console.log(`loadActivityHistory called (page ${page}, filter ${filter}) - showing unavailable state.`);
    if (!isDataLoadingEnabled) {
        console.warn("Activity history loading skipped due to profile load failure.");
        showToast("Historii aktivit nelze načíst kvůli chybě profilu.", "warning");
    }
    if (ui.activitiesEmptyState) {
        ui.activitiesEmptyState.style.display = 'block';
        ui.activitiesEmptyState.innerHTML = `<i class="fas fa-box-open"></i> <h3>Žádné aktivity</h3> <p>Data historie aktivit nejsou k dispozici.</p>`;
    }
    if (ui.activitiesTableBody) ui.activitiesTableBody.innerHTML = '';
    if (ui.tableLoadingOverlay) hideLoader(ui.tableLoadingOverlay);
    if (ui.paginationControls) ui.paginationControls.style.display = 'none';
    if (ui.activityTypeFilter) ui.activityTypeFilter.disabled = false; // Allow filtering
    if (ui.exportTableBtn) ui.exportTableBtn.disabled = true;

    totalActivities = 0;
    currentPage = page;
    renderPagination();

    return Promise.resolve({ activities: [], totalCount: 0 });
}

// --- Render Functions for Activities (Keep Definitions) ---
function renderActivities(activities) {
    const tbody = ui.activitiesTableBody;
    if (!tbody) return;
    tbody.innerHTML = ''; // Clear previous content
    if (!activities || activities.length === 0) {
        // Empty state is handled by loadActivityHistory, no need to repeat here
        return;
    }
    activities.forEach(activity => {
        const row = tbody.insertRow();
        row.insertCell().textContent = formatDateSimple(activity.created_at);
        const typeCell = row.insertCell();
        typeCell.innerHTML = getActivityTypeBadge(activity.type);
        const titleCell = row.insertCell();
        const desc = sanitizeHTML(activity.title || activity.description || 'N/A');
        titleCell.textContent = desc;
        titleCell.classList.add('table-activity-title'); // Use correct class
        if (desc !== 'N/A') { titleCell.title = desc; } // Add tooltip only if there's content

        const pointsCell = row.insertCell();
        const points = activity.points_earned; // Assuming this field exists
        pointsCell.textContent = (points !== null && points !== undefined) ? formatNumber(points) : '-';
        pointsCell.classList.add(points > 0 ? 'points-positive' : (points < 0 ? 'points-negative' : ''));

        const statusCell = row.insertCell();
        statusCell.innerHTML = getActivityStatusBadge(activity.status); // Assuming status field exists
    });

    // Re-initialize tooltips for the table content if needed
     if (typeof $ !== 'undefined' && $.fn.tooltipster) {
         $('#activities-body .table-activity-title[title]').tooltipster({
             theme: 'tooltipster-shadow', side: 'top', distance: 3
         });
     }
}

function getActivityTypeBadge(type) {
    // Map types to Font Awesome icons and labels
    const typeMap = {
        test: { icon: 'fas fa-vial', label: 'Test', class: 'badge-secondary' },
        diagnostic: { icon: 'fas fa-stethoscope', label: 'Diagnostika', class: 'badge-info' },
        exercise: { icon: 'fas fa-pencil-alt', label: 'Cvičení', class: 'badge-success' },
        lesson: { icon: 'fas fa-book-open', label: 'Lekce', class: 'badge-warning' },
        badge: { icon: 'fas fa-medal', label: 'Odznak', class: 'badge-gold' },
        plan_generated: { icon: 'fas fa-route', label: 'Plán', class: 'badge-purple' },
        level_up: { icon: 'fas fa-arrow-up', label: 'Postup', class: 'badge-cyan' },
        other: { icon: 'fas fa-asterisk', label: 'Jiné', class: 'badge-dark' },
        default: { icon: 'fas fa-question-circle', label: 'Neznámý', class: 'badge-dark' }
    };
    const key = type?.toLowerCase() || 'default';
    const config = typeMap[key] || typeMap['default'];
    const label = config.label;
    return `<span class="badge ${config.class}"><i class="${config.icon}"></i> ${label}</span>`;
}

function getActivityStatusBadge(status){
    // Map statuses to Font Awesome icons and labels
     const statusMap = {
        completed: { icon: 'fas fa-check-circle', label: 'Dokončeno', class: 'badge-success' },
        passed: { icon: 'fas fa-check-circle', label: 'Splněno', class: 'badge-success' },
        failed: { icon: 'fas fa-times-circle', label: 'Neúspěch', class: 'badge-danger' },
        in_progress: { icon: 'fas fa-spinner fa-spin', label: 'Probíhá', class: 'badge-info' },
        skipped: { icon: 'fas fa-forward', label: 'Přeskočeno', class: 'badge-warning' },
        generated: { icon: 'fas fa-cogs', label: 'Vytvořeno', class: 'badge-purple' },
        awarded: { icon: 'fas fa-trophy', label: 'Uděleno', class: 'badge-gold' },
        pending: { icon: 'fas fa-hourglass-half', label: 'Čeká', class: 'badge-dark' },
        default: { icon: 'fas fa-question-circle', label: 'Neznámý', class: 'badge-dark' }
    };
    const key = status?.toLowerCase() || 'default';
    const config = statusMap[key] || statusMap['default'];
    const label = config.label;
    return `<span class="badge ${config.class}"><i class="${config.icon}"></i> ${label}</span>`;
}

function setupTableSorting() {
    const headers = document.querySelectorAll('#activities-table th.sortable');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const sortField = header.dataset.sort;
            let direction = 'desc';
            // Cycle through asc, desc, none (remove sort)
            if (header.classList.contains('sorted-desc')) {
                direction = 'asc';
                header.classList.remove('sorted-desc');
                header.classList.add('sorted-asc');
            } else if (header.classList.contains('sorted-asc')) {
                direction = 'desc'; // Back to desc as default after asc
                 header.classList.remove('sorted-asc');
                 // If you want to cycle to 'none', you'd remove both classes here
                 // and set sortField = 'created_at', direction = 'desc' as default.
                 // For simplicity, we toggle between asc and desc.
                 header.classList.add('sorted-desc');
            } else {
                // If not sorted previously, sort desc first
                headers.forEach(h => { h.classList.remove('sorted-asc', 'sorted-desc'); });
                header.classList.add('sorted-desc');
                direction = 'desc';
            }
            currentSortColumn = sortField;
            currentSortDirection = direction;
            console.log(`Sorting by ${currentSortColumn}, direction ${currentSortDirection}`);
            loadActivityHistory(currentUser.id, 1, currentActivityFilter, currentSortColumn, currentSortDirection); // Reload data with new sort
        });
    });
}

function setupActivityFilter() {
    ui.activityTypeFilter?.addEventListener('change', (e) => {
        currentActivityFilter = e.target.value;
        currentPage = 1; // Reset to page 1 when filter changes
        console.log(`Filtering by type: ${currentActivityFilter}`);
        loadActivityHistory(currentUser.id, currentPage, currentActivityFilter, currentSortColumn, currentSortDirection); // Reload data
    });
    // Populate filter options (example) - should ideally come from distinct values in DB
     const defaultTypes = ['test', 'diagnostic', 'exercise', 'lesson', 'badge', 'plan_generated', 'level_up', 'other'];
     defaultTypes.forEach(type => {
         const option = document.createElement('option');
         option.value = type;
         option.textContent = getActivityTypeBadge(type).replace(/<[^>]+>/g, '').trim(); // Get text label
         ui.activityTypeFilter?.appendChild(option);
     });
}

function renderPagination() {
    const totalPages = Math.ceil(totalActivities / activitiesPerPage);
    console.log(`Rendering pagination: Page ${currentPage} of ${totalPages} (Total items: ${totalActivities})`);

    if (ui.pageInfo) {
        ui.pageInfo.textContent = totalActivities > 0 ? `Stránka ${currentPage} / ${totalPages}` : `Stránka 1 / 0`;
    }
    if (ui.prevPageBtn) {
        ui.prevPageBtn.disabled = currentPage <= 1;
    }
    if (ui.nextPageBtn) {
        ui.nextPageBtn.disabled = currentPage >= totalPages;
    }
    // Show pagination only if there's more than one page or if currently loading results
    if (ui.paginationControls) {
        ui.paginationControls.style.display = totalPages > 1 || totalActivities > 0 ? 'flex' : 'none';
    }
}

function setupPagination() {
    ui.prevPageBtn?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadActivityHistory(currentUser.id, currentPage, currentActivityFilter, currentSortColumn, currentSortDirection);
        }
    });
    ui.nextPageBtn?.addEventListener('click', () => {
        const totalPages = Math.ceil(totalActivities / activitiesPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            loadActivityHistory(currentUser.id, currentPage, currentActivityFilter, currentSortColumn, currentSortDirection);
        }
    });
}

function exportTableToCSV(filename = 'historie-aktivit.csv') {
    showToast("Export není možný, data historie nejsou načtena.", "warning");
    console.warn("CSV Export attempted but data loading is disabled/unavailable.");
    // Original export logic would go here if data was available
}

// --- Initialization ---
async function initializePage() {
    showLoader(ui.initialLoader);
    if(ui.globalErrorContainer) ui.globalErrorContainer.style.display = 'none';
    isDataLoadingEnabled = true;

    if (!supabaseClient) { console.error("Supabase client failed to initialize."); hideLoader(ui.initialLoader); return; }

    currentUser = await getUser();
    if (!currentUser) { hideLoader(ui.initialLoader); return; }

    try {
        const [profileData, titlesData] = await Promise.all([
             getUserProfile(currentUser.id),
             fetchTitles()
        ]);
        currentProfile = profileData;
        userTitles = titlesData || [];

        updateHeaderAndSidebar(currentProfile, userTitles);
        initNotifications();

        // Call data loading functions (stubs will show "unavailable" if needed)
        // Use Promise.allSettled to ensure all attempts complete even if some fail
        const results = await Promise.allSettled([
            loadOverallStats(currentUser.id),
            loadProgressChart(currentUser.id, ui.chartPeriodSelect?.value || 'month'),
            loadActivityHistory(currentUser.id) // Initial load for page 1
        ]);

        // Log results of each promise (optional)
        console.log("Data loading results:", results);

        ui.mainContent?.classList.add('loaded');
    } catch (error) {
        console.error("Initialization failed after getting user:", error);
        if (ui.globalErrorContainer && !ui.globalErrorContainer.textContent) {
            showGlobalError("Během inicializace stránky došlo k chybě.");
        }
    } finally {
        hideLoader(ui.initialLoader);
        if (ui.refreshButton) ui.refreshButton.disabled = false;
        if (ui.chartPeriodSelect) ui.chartPeriodSelect.disabled = false;
        if (ui.activityTypeFilter) ui.activityTypeFilter.disabled = false;
        setupEntranceAnimations();
    }
}

// --- Setup Event Listeners ---
function setupEventListeners() {
    ui.refreshButton?.addEventListener('click', async () => {
        if (!currentUser) { showToast("Pro obnovení je nutné být přihlášen.", "warning"); return; }
        console.log("Refreshing data...");
        showToast("Obnovuji data...");
        ui.refreshButton.disabled = true;
        ui.refreshButton.querySelector('i')?.classList.add('fa-spin');
        isDataLoadingEnabled = true; // Re-enable check for refresh
        try {
             const [profileData, titlesData] = await Promise.all([ getUserProfile(currentUser.id), fetchTitles() ]);
             currentProfile = profileData;
             userTitles = titlesData;
             updateHeaderAndSidebar(currentProfile, userTitles);
             await updateNotificationBadge();
             await Promise.allSettled([
                 loadOverallStats(currentUser.id),
                 loadProgressChart(currentUser.id, ui.chartPeriodSelect?.value || 'month'),
                 loadActivityHistory(currentUser.id, 1, currentActivityFilter, currentSortColumn, currentSortDirection) // Reload page 1
             ]);
        } catch(err) { console.error("Error during refresh:", err); }
        finally {
            ui.refreshButton.disabled = false;
            ui.refreshButton.querySelector('i')?.classList.remove('fa-spin');
        }
    });
    ui.chartPeriodSelect?.addEventListener('change', (e) => {
        if(currentUser) loadProgressChart(currentUser.id, e.target.value); // Calls stub
    });
    setupSidebarToggle();
    ui.exportTableBtn?.addEventListener('click', () => exportTableToCSV()); // Shows warning
    // Table sorting/filtering/pagination listeners are not needed until data loading is fixed
    // setupTableSorting();
    // setupActivityFilter();
    // setupPagination();
    const currentYear = new Date().getFullYear();
    document.querySelectorAll('#currentYearFooter, #currentYearSidebar').forEach(el => {if(el) el.textContent = currentYear;});
    const header = document.querySelector('.dashboard-header');
    const mainArea = document.querySelector('main#main-content');
    if (header && mainArea) { mainArea.addEventListener('scroll', () => { document.body.classList.toggle('scrolled', mainArea.scrollTop > 20); }, { passive: true }); }
}

// --- Setup Entrance Animations & Mouse Follower ---
function setupEntranceAnimations() { const aE = document.querySelectorAll('[data-animate]'); const o = new IntersectionObserver((e) => { e.forEach(en => { if (en.isIntersecting) { requestAnimationFrame(() => { const d = parseInt(en.target.style.getPropertyValue('--animation-order') || '0', 10) * 100; setTimeout(() => { en.target.classList.add('animate-in'); }, d); }); o.unobserve(en.target); } }); }, { threshold: 0.1 }); aE.forEach(el => o.observe(el)); }
function setupMouseFollower() { const f = document.getElementById('mouse-follower'); if (!f || window.innerWidth <= 576) return; let m = false; const u = (e) => { if (!m) { document.body.classList.add('mouse-has-moved'); m = true; } requestAnimationFrame(() => { f.style.left = `${e.pageX}px`; f.style.top = `${e.pageY}px`; }); }; document.addEventListener('mousemove', u, { passive: true }); const iS = 'a, button, [role="button"], .stats-card, .notification-item, th[data-sort], .sidebar-link, input, select, textarea'; document.querySelectorAll(iS).forEach(el => { el.addEventListener('mouseenter', () => f.classList.add('active')); el.addEventListener('mouseleave', () => f.classList.remove('active')); }); }


// --- Run on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing Pokrok Page (v9 - Full Code Fix).");
    try {
        // Checks for libraries
        if (typeof dateFns === 'undefined' || typeof dateFns.locale?.cs === 'undefined') {
            console.error("FATAL: date-fns or CS locale not loaded. Check script tags.");
            showGlobalError("Chyba: Knihovna pro práci s daty nebo její lokalizace (CS) nebyla správně načtena.");
            return; // Critical dependency
        }
        if (typeof Chart === 'undefined') {
            console.warn("Chart.js library not found. Charts will not be rendered.");
        }
        if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
             throw new Error("Supabase library not loaded or initialized globally.");
        }

        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase client created successfully using Pokrok page keys.");

        setupEventListeners();
        setupMouseFollower();
        initializePage(); // Main initialization logic

        if (typeof $ !== 'undefined' && typeof $.fn.tooltipster === 'function') {
            console.log("Initializing Tooltips");
             $('.btn-tooltip, .sidebar-toggle-btn, .notification-bell').tooltipster({
                 theme: 'tooltipster-shadow', animation: 'fade', delay: 150,
                 distance: 6, side: 'top'
             });
        } else {
            console.warn("Tooltipster library not found or jQuery not loaded.");
        }
    } catch (error) {
        console.error("Critical initialization error in DOMContentLoaded:", error);
        showGlobalError(`Kritická chyba při inicializaci: ${error.message}. Zkuste obnovit stránku.`);
        hideLoader(ui.initialLoader);
    }
});