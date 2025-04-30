// =============================================================================
// POKROK.JS - Logic for the Progress Overview Page (v6 - Syntax Fix & Stubbed Data)
// =============================================================================

// --- Supabase Configuration (Matches auth/index.html) ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';

// --- Global State ---
let supabaseClient = null;
let currentUser = null;
let currentProfile = null; // Profile data will be attempted
let userTitles = [];     // Titles will be attempted
// Chart and activity data are removed as loading is disabled
let currentPage = 1;
const activitiesPerPage = 10;
let currentSortColumn = 'created_at';
let currentSortDirection = 'desc';
let currentActivityFilter = 'all';
let totalActivities = 0;

// --- DOM Elements ---
const initialLoader = document.getElementById('initial-loader');
const globalErrorContainer = document.getElementById('global-error');
const refreshButton = document.getElementById('refresh-btn');
const mainContent = document.getElementById('main-content');
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const mobileMenuToggleBtn = document.getElementById('main-mobile-menu-toggle');
const sidebarCloseToggleBtn = document.getElementById('sidebar-close-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarUserName = document.getElementById('sidebar-name');
const sidebarUserAvatar = document.getElementById('sidebar-avatar');
const sidebarUserTitle = document.getElementById('sidebar-user-title');
const creditsValueElement = document.getElementById('credits-value');
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
// Chart elements (mostly for showing empty state)
const chartContainer = document.getElementById('progressChart'); // Container might still exist
const chartPeriodSelect = document.getElementById('chart-period-select');
const chartLoadingOverlay = document.getElementById('chart-loading-overlay'); // May not be needed now
const chartEmptyState = document.getElementById('chart-empty-state');
// Activity table elements (mostly for showing empty state)
const activitiesTable = document.getElementById('activities-table'); // May not be needed now
const activitiesTableBody = document.getElementById('activities-body'); // May not be needed now
const tableLoadingOverlay = document.getElementById('table-loading-overlay'); // May not be needed now
const activitiesEmptyState = document.getElementById('activities-empty-state');
const activityTypeFilter = document.getElementById('activity-type-filter');
const paginationControls = document.getElementById('pagination-controls');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageInfo = document.getElementById('page-info');
const exportTableBtn = document.getElementById('export-table-btn');
// Notification elements
const notificationBell = document.getElementById('notification-bell');
const notificationCountBadge = document.getElementById('notification-count');
const notificationsDropdown = document.getElementById('notifications-dropdown');
const notificationsList = document.getElementById('notifications-list');
const noNotificationsMsg = document.getElementById('no-notifications-msg');
const markAllReadBtn = document.getElementById('mark-all-read');

// --- Utility Functions --- (Keep all as they are used by UI elements)

function showLoader(loaderElement) { loaderElement?.classList.remove('hidden'); }
function hideLoader(loaderElement) { loaderElement?.classList.add('hidden'); }
function showGlobalError(message) { const eC = document.getElementById('global-error'); if (eC) { eC.textContent = message; eC.style.display = 'block'; } else { console.error("Global error container not found."); } console.error("Global Error:", message); const iLE = document.getElementById('initial-loader'); if (iLE) hideLoader(iLE); }
function updateElementText(element, text) { if (element) { element.textContent = text ?? '-'; } }
function updateElementHTML(element, html) { if (element) { element.innerHTML = html ?? ''; } }
function showToast(message, type = 'info', duration = 3000) { const c = document.getElementById('toast-container'); if (!c) return; const t = document.createElement('div'); t.className = `toast toast-${type}`; let iC = 'fas fa-info-circle'; if (type === 'success') iC = 'fas fa-check-circle'; if (type === 'error') iC = 'fas fa-times-circle'; if (type === 'warning') iC = 'fas fa-exclamation-triangle'; t.innerHTML = `<i class="${iC} toast-icon"></i> <span class="toast-message">${message}</span>`; c.appendChild(t); requestAnimationFrame(() => { t.classList.add('show'); }); setTimeout(() => { t.classList.remove('show'); t.addEventListener('transitionend', () => { if (t.parentNode === c) { c.removeChild(t); } }, { once: true }); }, duration); }
function formatDateRelative(dateString) { if (!dateString) return '-'; try { if (typeof dateFns === 'undefined' || typeof dateFns.locale?.cs === 'undefined') { console.warn("date-fns or CS locale not loaded."); return new Date(dateString).toLocaleDateString('cs-CZ'); } return dateFns.formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: dateFns.locale.cs }); } catch (e) { console.error("Error formatting date:", e); try { return new Date(dateString).toLocaleDateString('cs-CZ'); } catch { return dateString; } } }
function formatDateSimple(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) { throw new Error("Invalid Date"); } return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Error formatting simple date:", dateString, e); return '-'; } }
function formatNumber(num) { if (num === null || num === undefined || isNaN(num)) return '-'; return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

// --- Authentication and User Profile ---

async function getUser() {
    if (!supabaseClient) { console.error("Supabase client not initialized before calling getUser."); showGlobalError("Chyba ověření: Klient databáze není inicializován."); if (!window.location.pathname.startsWith('/auth/')) { window.location.href = '/auth/index.html'; } return null; }
    try { const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession(); if (sessionError) { throw sessionError; } if (session?.user) { return session.user; } else { console.log("User session not found, redirecting to login."); showToast("Relace neplatná. Přihlašte se prosím.", "warning", 2500); if (!window.location.pathname.startsWith('/auth/')) { setTimeout(() => { window.location.href = '/auth/index.html'; }, 1500); } return null; } }
    catch (error) { console.error("Error verifying user session:", error); showGlobalError("Nepodařilo se ověřit relaci uživatele. Zkuste se znovu přihlásit."); if (!window.location.pathname.startsWith('/auth/')) { setTimeout(() => { window.location.href = '/auth/index.html'; }, 2000); } return null; }
}

async function getUserProfile(userId) {
    // This function *might* still work if the 'profiles' table exists and has basic columns
    if (!userId || !supabaseClient) return null;
    try { const { data: profile, error } = await supabaseClient.from('profiles').select('id, username, full_name, points, selected_title').eq('id', userId).single(); /* <<< Simplified select */
        if (error) { console.error("Supabase error fetching profile:", error.message); if (error.code === 'PGRST116') { console.warn(`Profile not found for user ${userId}.`); showGlobalError("Profil uživatele zatím nebyl nalezen."); return null; } throw new Error(`Supabase: ${error.message}`); }; return profile;
    } catch (error) { console.error("Error fetching user profile:", error); showGlobalError("Nepodařilo se načíst profil uživatele."); return null; }
}

async function fetchTitles() {
    // This function *might* still work if 'title_shop' exists
    if (!supabaseClient) return [];
    try { const { data, error } = await supabaseClient.from('title_shop').select('id, name'); if (error) throw error; return data || []; }
    catch (error) { console.error("Error fetching titles:", error); showToast("Nepodařilo se načíst seznam titulů.", "error"); return []; }
}

// --- UI Update Functions --- (Keep as is, relies on profile/titles)
function updateHeaderAndSidebar(profile, titles) { if (!profile) { updateElementText(sidebarUserName, 'Uživatel'); updateElementText(sidebarUserAvatar, '?'); updateElementText(sidebarUserTitle, 'Pilot'); updateElementText(creditsValueElement, '0'); return; } updateElementText(sidebarUserName, profile.full_name || profile.username || 'Uživatel'); const firstLetter = (profile.full_name || profile.username || '?')[0].toUpperCase(); updateElementText(sidebarUserAvatar, firstLetter); let titleName = "Pilot"; if (profile.selected_title && titles && titles.length > 0) { const foundTitle = titles.find(t => t.id === profile.selected_title); if (foundTitle) { titleName = foundTitle.name; } } updateElementText(sidebarUserTitle, titleName); updateElementText(creditsValueElement, formatNumber(profile.points ?? 0)); }

// --- Sidebar Toggle Logic --- (Keep as is)
function setupSidebarToggle() { const body = document.body; sidebarToggleBtn?.addEventListener('click', () => { body.classList.toggle('sidebar-collapsed'); localStorage.setItem('sidebarCollapsed', body.classList.contains('sidebar-collapsed')); window.dispatchEvent(new Event('resize')); }); mobileMenuToggleBtn?.addEventListener('click', (e) => { e.stopPropagation(); body.classList.add('sidebar-visible'); sidebarOverlay?.classList.add('active'); }); sidebarCloseToggleBtn?.addEventListener('click', () => { body.classList.remove('sidebar-visible'); sidebarOverlay?.classList.remove('active'); }); sidebarOverlay?.addEventListener('click', () => { body.classList.remove('sidebar-visible'); sidebarOverlay?.classList.remove('active'); }); if (localStorage.getItem('sidebarCollapsed') === 'true') { body.classList.add('sidebar-collapsed'); } const updateToggleButton = () => { const isCollapsed = body.classList.contains('sidebar-collapsed'); const icon = sidebarToggleBtn?.querySelector('i'); if (icon) { icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; } const title = isCollapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel'; sidebarToggleBtn?.setAttribute('title', title); if (typeof $ !== 'undefined' && $.fn.tooltipster && $(sidebarToggleBtn).hasClass('tooltipstered')) { $(sidebarToggleBtn).tooltipster('content', title); } }; const observer = new MutationObserver((mutationsList) => { for (const mutation of mutationsList) { if (mutation.attributeName === 'class' && mutation.target === body) { updateToggleButton(); } } }); observer.observe(body, { attributes: true, attributeFilter: ['class'] }); updateToggleButton(); }

// --- Notification Handling --- (Keep, but expect 404 errors)
// (Functions: fetchNotifications, renderNotifications, getNotificationColor, updateNotificationBadge, markNotificationAsRead, markAllNotificationsRead, initNotifications - kept same as v4)
async function fetchNotifications() { if (!currentUser || !supabaseClient) return { count: 0, notifications: [] }; try { const { data, error, count } = await supabaseClient.from('notifications').select('*', { count: 'exact' }).eq('user_id', currentUser.id).eq('is_read', false).order('created_at', { ascending: false }).limit(5); if (error) { console.error("Notifications fetch error:", error); throw error; } return { count: count || 0, notifications: data || [] }; } catch (error) { showToast("Nepodařilo se načíst oznámení (Chyba DB).", "error"); return { count: 0, notifications: [] }; } }
function renderNotifications(notifications) { notificationsList.innerHTML = ''; if (!notifications || notifications.length === 0) { noNotificationsMsg.style.display = 'block'; markAllReadBtn.disabled = true; } else { noNotificationsMsg.style.display = 'none'; markAllReadBtn.disabled = false; notifications.forEach(notif => { const li = document.createElement('div'); li.className = 'notification-item'; li.dataset.id = notif.id; let iC = 'fas fa-info-circle'; if (notif.type === 'achievement' || notif.type === 'badge') iC = 'fas fa-medal'; else if (notif.type === 'system') iC = 'fas fa-cog'; else if (notif.type === 'message') iC = 'fas fa-envelope'; else if (notif.type === 'level_up') iC = 'fas fa-arrow-up'; li.innerHTML = `<div class="notification-icon" style="background-color: ${getNotificationColor(notif.type)};"><i class="${iC}"></i></div><div class="notification-content"><p class="notification-message">${notif.message || 'Žádná zpráva'}</p><span class="notification-time">${formatDateRelative(notif.created_at)}</span></div><button class="mark-read-btn" title="Označit jako přečtené"><i class="fas fa-check"></i></button>`; notificationsList.appendChild(li); li.querySelector('.mark-read-btn')?.addEventListener('click', async (e) => { e.stopPropagation(); await markNotificationAsRead(notif.id); li.remove(); updateNotificationBadge(); if (notificationsList.children.length === 0) { noNotificationsMsg.style.display = 'block'; markAllReadBtn.disabled = true; } }); li.addEventListener('click', async () => { await markNotificationAsRead(notif.id); li.remove(); updateNotificationBadge(); if (notificationsList.children.length === 0) { noNotificationsMsg.style.display = 'block'; markAllReadBtn.disabled = true; } }); }); } }
function getNotificationColor(type) { switch (type) { case 'achievement': case 'badge': return 'var(--gold-color)'; case 'system': return 'var(--accent-blue, var(--primary-color))'; case 'warning': return 'var(--warning)'; case 'error': return 'var(--danger)'; case 'level_up': return 'var(--secondary-color)'; case 'message': return 'var(--info)'; default: return 'var(--text-muted)'; } }
async function updateNotificationBadge() { if (!currentUser) return; const { count } = await fetchNotifications(); notificationCountBadge.textContent = count > 9 ? '9+' : count; notificationCountBadge.classList.toggle('visible', count > 0); notificationCountBadge.dataset.count = count; }
async function markNotificationAsRead(notificationId) { if (!currentUser || !supabaseClient || !notificationId) return; try { const { error } = await supabaseClient.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', notificationId).eq('user_id', currentUser.id); if (error) throw error; console.log(`Notification ${notificationId} marked as read.`); } catch (error) { console.error(`Error marking notification ${notificationId} as read:`, error); showToast("Chyba při označování oznámení.", "error"); } }
async function markAllNotificationsRead() { if (!currentUser || !supabaseClient) return; markAllReadBtn.disabled = true; markAllReadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; try { const { error } = await supabaseClient.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', currentUser.id).eq('is_read', false); if (error) throw error; notificationsList.innerHTML = ''; noNotificationsMsg.style.display = 'block'; updateNotificationBadge(); showToast("Všechna oznámení označena jako přečtená.", "success"); } catch (error) { console.error("Error marking all notifications as read:", error); showToast("Nepodařilo se označit všechna oznámení.", "error"); } finally { markAllReadBtn.innerHTML = 'Vymazat vše'; markAllReadBtn.disabled = true; } }
function initNotifications() { if (!notificationBell) return; updateNotificationBadge(); notificationBell.addEventListener('click', async (e) => { e.stopPropagation(); const isOpen = notificationsDropdown.classList.toggle('show'); if (isOpen) { const { notifications } = await fetchNotifications(); renderNotifications(notifications); } }); markAllReadBtn?.addEventListener('click', markAllNotificationsRead); document.addEventListener('click', (e) => { if (notificationsDropdown && notificationBell && !notificationBell.contains(e.target) && !notificationsDropdown.contains(e.target)) { notificationsDropdown.classList.remove('show'); } }); }

// --- Core Pokrok Logic (Stubbed/Disabled) ---

function loadOverallStats(userId) {
    console.log("loadOverallStats called, but data loading is disabled due to potential DB schema mismatch.");
    // Optionally update UI to show "Unavailable" or keep static placeholders from HTML
    statsGrid?.querySelectorAll('.stats-card')?.forEach(card => {
         card.classList.remove('loading'); // Ensure loading class is removed
         const valueEl = card.querySelector('.stats-card-value');
         const descEl = card.querySelector('.stats-card-description');
         const footerEl = card.querySelector('.stats-card-footer');
         if (valueEl) valueEl.textContent = '-';
         if (descEl) descEl.textContent = 'Data nedostupná';
         if (footerEl) footerEl.innerHTML = '<i class="fas fa-database"></i> Chyba DB';
     });
     // Specific handling for streak card footer which has different text format
     if(streakFooterEl) streakFooterEl.textContent = 'Nejdelší série: -';
     return Promise.resolve(); // Return resolved promise
}

function loadProgressChart(userId, period = 'month') {
    console.log(`loadProgressChart called for period ${period}, but data loading is disabled.`);
    // Ensure empty state is shown
    chartEmptyState.style.display = 'flex';
    chartEmptyState.innerHTML = `<i class="fas fa-database"></i> <p>Data pro graf nedostupná (Chyba DB).</p>`;
    // Hide loading overlay if it exists
    if (chartLoadingOverlay) hideLoader(chartLoadingOverlay);
     // Disable period select if needed
     if(chartPeriodSelect) chartPeriodSelect.disabled = true;
    return Promise.resolve();
}

// Render chart function - DEFINITION IS KEPT, but it won't be called by loadProgressChart
// Corrected the syntax within this function
function renderChart(data) {
    if (typeof Chart === 'undefined' || typeof Chart.adapters === 'undefined' || typeof dateFns === 'undefined') { console.error("Chart.js or Date Adapter not loaded."); showGlobalError("Chyba: Knihovna pro grafy nebyla správně načtena."); chartEmptyState.style.display = 'flex'; chartEmptyState.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Chyba inicializace grafu.</p>`; return; }
    if (!chartContainer || !data) return; const ctx = chartContainer.getContext('2d'); const labels = data.map(item => new Date(item.created_at)); const chartData = data.map(item => item.overall_progress); if (progressChart) { progressChart.destroy(); }
    const bodyStyles = getComputedStyle(document.body); const primaryColor = bodyStyles.getPropertyValue('--primary-color').trim() || '#00e0ff'; const gridColor = bodyStyles.getPropertyValue('--border-color-light').trim() || 'rgba(160, 92, 255, 0.25)'; const textColor = bodyStyles.getPropertyValue('--text-medium').trim() || '#b8c4e0';

    progressChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Celkový pokrok (%)', data: chartData, borderColor: primaryColor, backgroundColor: primaryColor + '33', tension: 0.3, pointBackgroundColor: primaryColor, pointBorderColor: '#fff', pointHoverRadius: 6, pointRadius: 4, fill: true }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { type: 'time', time: { unit: calculateTimeUnit(labels), tooltipFormat: 'dd.MM.yyyy HH:mm', displayFormats: { millisecond: 'HH:mm:ss.SSS', second: 'HH:mm:ss', minute: 'HH:mm', hour: 'dd.MM HH:mm', day: 'dd.MM.yy', week: 'dd.MM.yy', month: 'MMM yy', quarter: 'QQQ yy', year: 'yyyy' } }, adapters: { date: { locale: dateFns.locale.cs } }, grid: { color: gridColor }, ticks: { color: textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
                y: { beginAtZero: true, max: 100, title: { display: true, text: 'Pokrok (%)', color: textColor }, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 20 } }
            }, // End scales
            plugins: {
                 legend: { display: false },
                 tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.85)', titleColor: '#fff', bodyColor: '#fff', padding: 10, borderColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1,
                     callbacks: {
                         title: function(tooltipItems) { // Using function keyword
                             const date = new Date(tooltipItems[0].parsed.x);
                             // Add safety check for dateFns
                             if (typeof dateFns !== 'undefined' && typeof dateFns.format === 'function') {
                                 return dateFns.format(date, 'PPPp', { locale: dateFns.locale.cs });
                             } return date.toLocaleString(); // Fallback
                         }, // Comma
                         label: function(context) { // Using function keyword
                             let label = context.dataset.label || '';
                             if (label) { label += ': '; }
                             if (context.parsed.y !== null) { label += context.parsed.y.toFixed(1) + '%'; }
                             return label;
                         } // No comma needed here
                     } // End callbacks
                 } // End tooltip
             }, // End plugins
            interaction: { mode: 'index', intersect: false },
            hover: { mode: 'nearest', intersect: true }
        } // End options
    }); // End new Chart
} // End renderChart definition

// This function is kept as it might be used by renderChart if data existed
function calculateTimeUnit(labels) { if (!labels || labels.length < 2 || typeof dateFns === 'undefined') return 'day'; const firstDate = labels[0]; const lastDate = labels[labels.length - 1]; if (!(firstDate instanceof Date) || !(lastDate instanceof Date) || isNaN(firstDate) || isNaN(lastDate)) return 'day'; const diffDays = dateFns.differenceInDays(lastDate, firstDate); if (diffDays <= 2) return 'hour'; if (diffDays <= 31) return 'day'; if (diffDays <= 180) return 'week'; if (diffDays <= 730) return 'month'; return 'year'; }

function loadActivityHistory(userId) {
    console.log("loadActivityHistory called, but data loading is disabled.");
    // Ensure empty state is shown
    activitiesEmptyState.style.display = 'block';
    activitiesEmptyState.innerHTML = `<i class="fas fa-database"></i><h3>Historie nedostupná</h3><p>Nelze načíst data aktivit (Chyba DB).</p>`;
    // Hide table and loading/pagination
    if(activitiesTable) activitiesTable.style.display = 'none';
    if(tableLoadingOverlay) hideLoader(tableLoadingOverlay);
    if(paginationControls) paginationControls.style.display = 'none';
    // Disable filter/export
    if(activityTypeFilter) activityTypeFilter.disabled = true;
    if(exportTableBtn) exportTableBtn.disabled = true;
    return Promise.resolve();
}

// Keep render functions definitions, even if not called by load functions now
function renderActivities(activities) { activitiesTableBody.innerHTML = ''; if (!activities || activities.length === 0) { return; } activities.forEach(activity => { const row = activitiesTableBody.insertRow(); row.insertCell().textContent = formatDateSimple(activity.created_at); const typeCell = row.insertCell(); typeCell.innerHTML = getActivityTypeBadge(activity.type); const titleCell = row.insertCell(); titleCell.textContent = activity.title || activity.description || 'N/A'; titleCell.classList.add('activity-title'); if (activity.title || activity.description) { titleCell.title = activity.title || activity.description; } const pointsCell = row.insertCell(); pointsCell.textContent = activity.points_earned !== null ? formatNumber(activity.points_earned) : '-'; pointsCell.classList.add(activity.points_earned > 0 ? 'points-positive' : (activity.points_earned < 0 ? 'points-negative' : '')); const statusCell = row.insertCell(); statusCell.innerHTML = getActivityStatusBadge(activity.status); }); if (typeof $ !== 'undefined' && $.fn.tooltipster) { $('#activities-body .activity-title[title]').tooltipster({ theme: 'tooltipster-shadow', side: 'top', distance: 3 }); } }
function getActivityTypeBadge(type) { let iC='fas fa-question-circle';let t=type;let cC='badge-dark';switch(type){case 'test':iC='fas fa-vial';t='Test';cC='badge-secondary';break;case 'diagnostic':iC='fas fa-stethoscope';t='Diagnostika';cC='badge-info';break;case 'exercise':iC='fas fa-pencil-alt';t='Cvičení';cC='badge-success';break;case 'lesson':iC='fas fa-book-open';t='Lekce';cC='badge-warning';break;case 'badge':iC='fas fa-medal';t='Odznak';cC='badge-gold';break;case 'plan_generated':iC='fas fa-route';t='Plán';cC='badge-purple';break;case 'level_up':iC='fas fa-arrow-up';t='Postup';cC='badge-cyan';break;case 'other':iC='fas fa-asterisk';t='Jiné';break;} t=t.charAt(0).toUpperCase()+t.slice(1);return `<span class="badge ${cC}"><i class="${iC}"></i> ${t}</span>`;}
function getActivityStatusBadge(status){let iC='fas fa-info-circle';let t=status;let cC='badge-dark';switch(status?.toLowerCase()){case 'completed':case 'passed':iC='fas fa-check-circle';t='Dokončeno';cC='badge-success';break;case 'failed':iC='fas fa-times-circle';t='Neúspěch';cC='badge-danger';break;case 'in_progress':iC='fas fa-spinner fa-spin';t='Probíhá';cC='badge-info';break;case 'skipped':iC='fas fa-forward';t='Přeskočeno';cC='badge-warning';break;case 'generated':iC='fas fa-cogs';t='Vytvořeno';cC='badge-purple';break;case 'awarded':iC='fas fa-trophy';t='Uděleno';cC='badge-gold';break;default:t=status||'Neznámý';} t=t.charAt(0).toUpperCase()+t.slice(1);return `<span class="badge ${cC}"><i class="${iC}"></i> ${t}</span>`;}
function setupTableSorting() { /* Table data loading disabled */ }
function setupActivityFilter() { /* Table data loading disabled */ }
function renderPagination() { /* Table data loading disabled */ paginationControls.style.display = 'none'; }
function setupPagination() { /* Table data loading disabled */ }
function exportTableToCSV(filename = 'historie-aktivit.csv') { showToast("Export není možný, data nejsou načtena.", "warning"); }

// --- Initialization ---

async function initializePage() {
    showLoader(initialLoader); globalErrorContainer.style.display = 'none';
    if (!supabaseClient) { hideLoader(initialLoader); return; } // Already checked in DOMContentLoaded
    currentUser = await getUser(); if (!currentUser) { hideLoader(initialLoader); return; } // Redirects if no user
    try {
        // Fetch profile & titles (these might still work)
        const [profileData, titlesData] = await Promise.all([ getUserProfile(currentUser.id), fetchTitles() ]);
        currentProfile = profileData; userTitles = titlesData;
        updateHeaderAndSidebar(currentProfile, userTitles); // Update UI with whatever we got

        // Initialize notifications (will show 0 if fetch fails)
        initNotifications();

        // Call stubbed data loading functions (they will show "unavailable" messages)
        await Promise.all([
             loadOverallStats(currentUser.id),
             loadProgressChart(currentUser.id, chartPeriodSelect.value),
             loadActivityHistory(currentUser.id)
        ]);

        mainContent?.classList.add('loaded'); // Mark page as loaded for animations
    } catch (error) { console.error("Initialization failed after getting user:", error); if (globalErrorContainer && !globalErrorContainer.textContent) { showGlobalError("Během inicializace stránky došlo k chybě."); } }
    finally { hideLoader(initialLoader); setupEntranceAnimations(); }
}

// Setup Event Listeners
function setupEventListeners() {
    refreshButton?.addEventListener('click', () => {
        // Refresh only profile/titles/notifications as other data is stubbed
        showToast("Obnovuji profil...");
        if (currentUser) {
            Promise.all([ getUserProfile(currentUser.id).then(p => updateHeaderAndSidebar(p, userTitles)), fetchTitles().then(t => userTitles = t), updateNotificationBadge() ])
             .catch(err => console.error("Profile/Title Refresh failed:", err));
        } else { initializePage(); } // Fallback if user lost
    });
    // Chart period selector is disabled, no need for listener now
    // chartPeriodSelect?.addEventListener('change', (e) => { /* loadProgressChart is disabled */ });
    // Table interactions disabled
    // setupTableSorting(); setupActivityFilter(); setupPagination();
    setupSidebarToggle(); // Keep sidebar toggle
    exportTableBtn?.addEventListener('click', () => exportTableToCSV()); // Keep export button listener (shows message)
    const currentYear = new Date().getFullYear(); document.querySelectorAll('#currentYearFooter, #currentYearSidebar').forEach(el => el.textContent = currentYear); const header = document.querySelector('.dashboard-header'); const mainArea = document.querySelector('main#main-content'); if (header && mainArea) { mainArea.addEventListener('scroll', () => { document.body.classList.toggle('scrolled', mainArea.scrollTop > 20); }, { passive: true }); }
}

// Setup Entrance Animations (Keep)
function setupEntranceAnimations() { const aE = document.querySelectorAll('[data-animate]'); const o = new IntersectionObserver((e) => { e.forEach(en => { if (en.isIntersecting) { requestAnimationFrame(() => { const d = parseInt(en.target.style.getPropertyValue('--animation-order') || '0', 10) * 100; setTimeout(() => { en.target.classList.add('animate-in'); }, d); }); o.unobserve(en.target); } }); }, { threshold: 0.1 }); aE.forEach(el => o.observe(el)); }
// Setup Mouse Follower (Keep)
function setupMouseFollower() { const f = document.getElementById('mouse-follower'); if (!f) return; let m = false; const u = (e) => { if (!m) { document.body.classList.add('mouse-has-moved'); m = true; } f.style.left = `${e.pageX}px`; f.style.top = `${e.pageY}px`; }; document.addEventListener('mousemove', u, { passive: true }); const iS = 'a, button, [role="button"], .stats-card, .notification-item, th[data-sort], .sidebar-link, input, select, textarea'; document.querySelectorAll(iS).forEach(el => { el.addEventListener('mouseenter', () => f.classList.add('active')); el.addEventListener('mouseleave', () => f.classList.remove('active')); }); }

// --- Run on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing Pokrok Page.");
    try {
        // Ensure dateFns is loaded BEFORE initializing anything that might use it
        if (typeof dateFns === 'undefined') {
            console.warn("date-fns library not found immediately on DOMContentLoaded. Charting/Date features might be delayed or fail.");
             // Optionally show a warning to the user
             // showGlobalError("Chyba: Knihovna pro práci s daty nebyla správně načtena.");
        }

        if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') { throw new Error("Supabase library not loaded or initialized globally."); }
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); console.log("Supabase client created successfully using Pokrok page keys.");
        setupEventListeners(); setupMouseFollower(); initializePage();
        if (typeof $ !== 'undefined' && typeof $.fn.tooltipster) { console.log("Initializing Tooltips"); $('.btn-tooltip, .sidebar-toggle-btn, .notification-bell').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); } else { console.warn("Tooltipster library not found."); }
    } catch (error) { console.error("Critical initialization error:", error); showGlobalError(`Kritická chyba při inicializaci: ${error.message}. Zkuste obnovit stránku.`); hideLoader(initialLoader); }
});