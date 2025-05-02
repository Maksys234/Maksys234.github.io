// dashboard.js
// Версия: 23.2 - Cache DOM Fix + Event Dispatch + Global Client
(function() {
    'use strict';

    // --- START: Initialization and Configuration ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null; // Will hold the client instance
    window.supabase = { client: null }; // Expose client globally <<< NEW
    let currentUser = null;
    let currentProfile = null;
    let allTitles = []; // Хранилище для доступных титулов

    // Состояния загрузки для разных секций
    let isLoading = {
        stats: false,
        activities: false,
        notifications: false,
        titles: false,
        monthlyRewards: false,
        streakMilestones: false
    };
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';

    // --- DOM Elements Cache ---
    const ui = {}; // Cache object

    function cacheDOMElements() {
        console.log("[CACHE DOM] Caching elements...");
        const elementIds = [
            'initial-loader', 'sidebar-overlay', 'main-content', 'sidebar', 'main-mobile-menu-toggle',
            'sidebar-close-toggle', 'sidebar-toggle-btn', 'sidebar-avatar', 'sidebar-name', 'sidebar-user-title',
            'dashboard-title', 'refresh-data-btn', 'notification-bell', 'notification-count',
            'notifications-dropdown', 'notifications-list', 'no-notifications-msg', 'mark-all-read',
            'welcome-title', 'start-practice-btn', 'open-monthly-modal-btn', 'open-streak-modal-btn',
            'progress-card', 'points-card', 'streak-card', 'activity-list-container', 'activity-list',
            'toast-container', 'global-error', 'offline-banner', 'mouse-follower',
            'currentYearSidebar', 'currentYearFooter', 'monthly-reward-modal', 'modal-monthly-calendar-grid',
            'modal-monthly-calendar-empty', 'modal-current-month-year', 'close-monthly-modal-btn',
            'streak-milestones-modal', 'modal-milestones-grid', 'modal-milestones-empty',
            'modal-current-streak-value', 'close-streak-modal-btn'
            // Add other potential IDs from dashboard.html if needed
        ];
        const elementQueries = {
            dashboardHeader: '.dashboard-header',
            statCards: '#stats-section .stat-card', // Example using parent selector
            activityListEmptyState: '#activity-list-container .empty-state',
            activityListErrorState: '#activity-list-container .card-error-state'
        };

        let allFound = true;
        const notFound = [];

        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                // Convert kebab-case id to camelCase for the ui object key
                const key = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                ui[key] = element;
            } else {
                // Don't mark as error on dashboard page, some elements might be missing
                // allFound = false;
                notFound.push(id);
                // console.warn(`[CACHE DOM] Element with ID '${id}' not found.`);
            }
        });

        for (const key in elementQueries) {
            const elements = document.querySelectorAll(elementQueries[key]);
            if (elements && elements.length > 0) {
                // Store NodeList if multiple elements expected, else store single element
                ui[key] = elements.length === 1 ? elements[0] : elements;
            } else {
                 // allFound = false;
                 notFound.push(elementQueries[key]);
                 // console.warn(`[CACHE DOM] Element(s) with selector '${elementQueries[key]}' not found.`);
            }
        }

        if (notFound.length > 0) {
             console.warn(`[CACHE DOM] Следующие элементы не были найдены:`, notFound);
        }

        console.log("[CACHE DOM] Caching complete.");
        return true; // Continue even if some elements are missing on other pages
    }


    // Visual settings for activities & notifications
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

    // --- START: Helper Functions ---
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Obnovit Stránku</button></div>`; ui.globalError.style.display = 'block'; const retryBtn = document.getElementById('global-retry-btn'); if (retryBtn) { retryBtn.addEventListener('click', () => { location.reload(); }); } } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    function setLoadingState(section, isLoadingFlag) {
        const sections = section === 'all' ? Object.keys(isLoading) : [section];
        sections.forEach(sec => {
            if (isLoading[sec] === isLoadingFlag && section !== 'all') return;
            isLoading[sec] = isLoadingFlag;
            console.log(`[setLoadingState] Section: ${sec}, isLoading: ${isLoadingFlag}`);

            const element = {
                stats: ui.statCards, // NodeList
                activities: ui.activityListContainer,
                notifications: ui.notificationsList,
                monthlyRewards: ui.modalMonthlyCalendarGrid,
                streakMilestones: ui.modalMilestonesGrid
            }[sec];

            const emptyElement = {
                 activities: ui.activityListEmptyState,
                 notifications: ui.noNotificationsMsg,
                 monthlyRewards: ui.modalMonthlyCalendarEmpty,
                 streakMilestones: ui.modalMilestonesEmpty
             }[sec];

             const loaderElement = {
                  monthlyRewards: ui.monthlyRewardModal?.querySelector('.loading-overlay'),
                  streakMilestones: ui.streakMilestonesModal?.querySelector('.loading-overlay'),
                  activities: ui.activityListContainer // Use container class for loading state
             }[sec];


            if (sec === 'stats') {
                (element || []).forEach(card => card?.classList.toggle('loading', isLoadingFlag));
            } else if (element || loaderElement) {
                const container = loaderElement || element?.parentElement; // Find container for loading class
                container?.classList.toggle('loading', isLoadingFlag);

                if (loaderOverlay) loaderOverlay.classList.toggle('hidden', !isLoadingFlag);

                if (isLoadingFlag) {
                    if(element) element.innerHTML = ''; // Clear content on loading start
                    if(emptyElement) emptyElement.style.display = 'none';
                    // Render skeletons
                    if (sec === 'activities') renderActivitySkeletons(5);
                    else if (sec === 'monthlyRewards') renderMonthlyCalendarSkeletons();
                    else if (sec === 'streakMilestones') renderMilestoneSkeletons();
                    else if (sec === 'notifications') renderNotificationSkeletons(2);
                } else {
                    // Show empty state if content is still empty after loading
                    if (element && !element.hasChildNodes() && emptyElement) {
                         emptyElement.style.display = 'block';
                     }
                }
            }

            // Handle notifications bell separately
            if (sec === 'notifications' && ui.notificationBell) {
                 ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                 if (ui.markAllReadBtn) {
                     const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                     ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
                 }
             }
        });
    }
    function openMenu() { /* ... (same as before) ... */ if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { /* ... (same as before) ... */ if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }
    const initMouseFollower = () => { /* ... (same as before) ... */ const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { /* ... (same as before) ... */ const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }); animatedElements.forEach(element => observer.observe(element)); };
    const initHeaderScrollDetection = () => { /* ... (same as before) ... */ let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 50); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl && mainEl.scrollTop > 50) document.body.classList.add('scrolled'); };
    const updateCopyrightYear = () => { /* ... (same as before) ... */ const currentYearSpan = document.getElementById('currentYearFooter'); const currentYearSidebar = document.getElementById('currentYearSidebar'); const year = new Date().getFullYear(); if (currentYearSpan) { currentYearSpan.textContent = year; } if (currentYearSidebar) { currentYearSidebar.textContent = year; } };
    function initTooltips() { try { if (window.jQuery && typeof window.jQuery.fn.tooltipster === 'function') { window.jQuery('.btn-tooltip.tooltipstered').each(function() { if (document.body.contains(this)) { try { window.jQuery(this).tooltipster('destroy'); } catch (destroyError) { console.warn("Tooltipster destroy error:", destroyError); } } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); console.log("[Tooltips] Initialized/Re-initialized."); } else { console.warn("[Tooltips] jQuery or Tooltipster library not loaded."); } } catch (e) { console.error("[Tooltips] Error initializing Tooltipster:", e); } }
    // --- END: Helper Functions ---

    // --- START: Sidebar Toggle Logic ---
    function applyInitialSidebarState() {
        const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);
        const shouldBeCollapsed = savedState === 'collapsed';
        console.log(`[Sidebar State] Initial read state: ${savedState}, Applying collapsed: ${shouldBeCollapsed}`);
        if (shouldBeCollapsed) {
            document.body.classList.add('sidebar-collapsed');
        } else {
            document.body.classList.remove('sidebar-collapsed');
        }
        // Update button icon based on state
        if (ui.sidebarToggleBtn) {
            const icon = ui.sidebarToggleBtn.querySelector('i');
            if (icon) {
                icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
            }
            ui.sidebarToggleBtn.setAttribute('aria-label', shouldBeCollapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel');
             ui.sidebarToggleBtn.setAttribute('title', shouldBeCollapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel');
        }
    }

    function toggleSidebar() {
        if (!ui.sidebarToggleBtn) return;
        const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded');
        console.log(`[Sidebar Toggle] Sidebar toggled. New state: ${isCollapsed ? 'collapsed' : 'expanded'}`);
        // Update button icon
        const icon = ui.sidebarToggleBtn.querySelector('i');
        if (icon) {
            icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        }
         ui.sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel');
         ui.sidebarToggleBtn.setAttribute('title', isCollapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel');
    }
    // --- END: Sidebar Toggle Logic ---

    // --- START: Data Loading and Processing ---
    async function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Knihovna Supabase nebyla správně načtena."); } supabase = window.supabase.createClient(supabaseUrl, supabaseKey); if (!supabase) throw new Error("Vytvoření klienta Supabase selhalo."); window.supabase = { client: supabase }; // <<< EXPOSE CLIENT GLOBALLY >>>
        console.log('[Supabase] Klient úspěšně inicializován.'); return true; } catch (error) { console.error('[Supabase] Inicializace selhala:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }
    async function fetchUserProfile(userId) { /* ... (same as before) ... */ if (!supabase || !userId) return null; console.log(`[Profile] Fetching profile for user ID: ${userId}`); try { const { data: profile, error } = await supabase.from('profiles').select('*, selected_title, last_login, streak_days, monthly_claims, last_milestone_claimed').eq('id', userId).single(); if (error && error.code !== 'PGRST116') { throw error; } if (!profile) { console.warn(`[Profile] Profile for ${userId} not found. Returning null.`); return null; } profile.monthly_claims = profile.monthly_claims || {}; profile.last_milestone_claimed = profile.last_milestone_claimed || 0; console.log("[Profile] Profile data fetched successfully."); return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); return null; } }
    async function createDefaultProfile(userId, userEmail) { /* ... (same as before) ... */ if (!supabase || !userId || !userEmail) return null; console.log(`[Profile Create] Creating default profile for user ${userId}`); try { const defaultData = { id: userId, email: userEmail, username: userEmail.split('@')[0] || `user_${userId.substring(0, 6)}`, level: 1, points: 0, experience: 0, badges_count: 0, streak_days: 0, last_login: new Date().toISOString(), monthly_claims: {}, last_milestone_claimed: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), preferences: { dark_mode: window.matchMedia('(prefers-color-scheme: dark)').matches, language: 'cs' }, notifications: { email: true, study_tips: true, content_updates: true, practice_reminders: true } }; const { data: newProfile, error } = await supabase.from('profiles').insert(defaultData).select('*, selected_title, last_login, streak_days, monthly_claims, last_milestone_claimed').single(); if (error) { if (error.code === '23505') { console.warn("[Profile Create] Profile likely already exists, fetching again."); return await fetchUserProfile(userId); } throw error; } console.log("[Profile Create] Default profile created:", newProfile); return newProfile; } catch (error) { console.error("[Profile Create] Failed to create default profile:", error); return null; } }
    async function fetchTitles() { /* ... (same as before) ... */ if (!supabase) return []; console.log("[Titles] Fetching available titles..."); setLoadingState('titles', true); try { const { data, error } = await supabase.from('title_shop').select('title_key, name'); if (error) throw error; console.log("[Titles] Fetched titles:", data); return data || []; } catch (error) { console.error("[Titles] Error fetching titles:", error); return []; } finally { setLoadingState('titles', false); } }
    async function fetchUserStats(userId, profileData) { /* ... (same as before) ... */ if (!supabase || !userId || !profileData) { console.error("[Stats] Chybí Supabase klient, ID uživatele nebo data profilu."); return null; } console.log(`[Stats] Načítání statistik pro uživatele ${userId}...`); let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats] Chyba Supabase při načítání user_stats:", statsError.message); } } catch (error) { console.error("[Stats] Neočekávaná chyba při načítání user_stats:", error); statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0 }; if (statsError) { console.warn("[Stats] Vracení statistik primárně z profilu kvůli chybě načítání."); } else { console.log("[Stats] Statistiky úspěšně načteny/sestaveny:", finalStats); } return finalStats; }
    async function fetchRecentActivities(userId, limit = 5) { /* ... (same as before) ... */ if (!supabase || !userId) { console.error("[Activities] Chybí Supabase nebo ID uživatele."); return []; } console.log(`[Activities] Načítání posledních ${limit} aktivit pro uživatele ${userId}`); try { const { data, error } = await supabase .from('activities') .select('*') .eq('user_id', userId) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; console.log(`[Activities] Načteno ${data?.length || 0} aktivit.`); return data || []; } catch (error) { console.error('[Activities] Výjimka při načítání aktivit:', error); return []; } }
    async function fetchNotifications(userId, limit = 5) { /* ... (same as before) ... */ if (!supabase || !userId) { console.error("[Notifications] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await supabase .from('user_notifications') .select('*', { count: 'exact' }) .eq('user_id', userId) .eq('is_read', false) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; console.log(`[Notifications] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; } }
    async function checkAndUpdateLoginStreak() { /* ... (same as before) ... */ if (!currentUser || !currentProfile || !supabase) { console.warn("[StreakCheck] Cannot perform check: missing user, profile, or supabase."); return false; } console.log("[StreakCheck] Performing daily login check/update..."); const today = new Date(); const lastLogin = currentProfile.last_login ? new Date(currentProfile.last_login) : null; let currentStreak = currentProfile.streak_days || 0; let needsDbUpdate = false; let updateData = {}; let currentMonth = getCurrentMonthYearString(); if (!lastLogin || !isSameDate(today, lastLogin)) { needsDbUpdate = true; console.log("[StreakCheck] First login of the day detected."); if (lastLogin && isYesterday(lastLogin, today)) { currentStreak++; console.log(`[StreakCheck] Streak continued! New streak: ${currentStreak}`); } else if (lastLogin) { currentStreak = 1; console.log("[StreakCheck] Streak broken. Resetting to 1."); } else { currentStreak = 1; console.log("[StreakCheck] First login ever. Setting streak to 1."); } updateData.streak_days = currentStreak; updateData.last_login = today.toISOString(); } else { console.log("[StreakCheck] Already logged in today. No streak update needed."); currentStreak = currentProfile.streak_days || 0; } currentProfile.streak_days = currentStreak; if (ui.modalCurrentStreakValue) ui.modalCurrentStreakValue.textContent = currentStreak; currentProfile.monthly_claims = currentProfile.monthly_claims || {}; if (!currentProfile.monthly_claims[currentMonth]) { console.log(`[StreakCheck] Initializing claims for new month: ${currentMonth}`); const updatedClaims = { ...currentProfile.monthly_claims, [currentMonth]: [] }; currentProfile.monthly_claims = updatedClaims; updateData.monthly_claims = updatedClaims; needsDbUpdate = true; } else { console.log(`[StreakCheck] Monthly claims for ${currentMonth} already exist.`); } if (needsDbUpdate) { console.log("[StreakCheck] Updating profile in DB with:", updateData); try { const { error: updateError } = await supabase.from('profiles').update(updateData).eq('id', currentUser.id); if (updateError) throw updateError; if (updateData.last_login) currentProfile.last_login = updateData.last_login; console.log("[StreakCheck] Profile updated successfully in DB."); return true; } catch (error) { console.error("[StreakCheck] Error updating profile:", error); showToast('Chyba', 'Nepodařilo se aktualizovat data přihlášení.', 'error'); return false; } } return false; }
    async function updateMonthlyClaimsInDB(newClaimsData) { /* ... (same as before) ... */ if (!currentUser || !supabase) return false; console.log("[DB Update] Simulating update for monthly claims:", newClaimsData); await new Promise(resolve => setTimeout(resolve, 100)); console.log("[DB Update] Placeholder: Monthly claims update simulated."); return true; }
    async function updateLastMilestoneClaimedInDB(milestoneDay) { /* ... (same as before) ... */ if (!currentUser || !supabase) return false; console.log(`[DB Update] Simulating update for last_milestone_claimed: ${milestoneDay}`); await new Promise(resolve => setTimeout(resolve, 100)); console.log(`[DB Update] Placeholder: Last claimed milestone update simulated.`); return true; }
    async function loadDashboardData(user, profile) { /* ... (same as before) ... */ if (!user || !profile) { showError("Chyba: Nelze načíst data bez profilu uživatele."); setLoadingState('all', false); return; } console.log("[MAIN] loadDashboardData: Start pro uživatele:", user.id); hideError(); setLoadingState('stats', true); setLoadingState('activities', true); setLoadingState('notifications', true); renderActivitySkeletons(5); try { await checkAndUpdateLoginStreak(); updateSidebarProfile(profile); console.log("[MAIN] loadDashboardData: Načítání statistik, aktivit, oznámení..."); const results = await Promise.allSettled([ fetchUserStats(user.id, profile), fetchRecentActivities(user.id, 5), fetchNotifications(user.id, 5) ]); console.log("[MAIN] loadDashboardData: Souběžné načítání dokončeno:", results); if (results[0].status === 'fulfilled') { updateStatsCards(results[0].value || profile); } else { console.error("❌ Chyba při načítání statistik:", results[0].reason); updateStatsCards(profile); } setLoadingState('stats', false); if (results[1].status === 'fulfilled') { renderActivities(results[1].value || []); } else { console.error("❌ Chyba při načítání aktivit:", results[1].reason); renderActivities(null); } setLoadingState('activities', false); if (results[2].status === 'fulfilled') { const { unreadCount, notifications } = results[2].value || { unreadCount: 0, notifications: [] }; renderNotifications(unreadCount, notifications); } else { console.error("❌ Chyba při načítání oznámení:", results[2].reason); renderNotifications(0, []); } setLoadingState('notifications', false); console.log("[MAIN] loadDashboardData: Statické секции обработаны."); } catch (error) { console.error('[MAIN] loadDashboardData: Zachycena hlavní chyba:', error); showError('Nepodařilo se kompletně načíst data nástěnky: ' + error.message); updateStatsCards(profile); renderActivities(null); renderNotifications(0, []); } finally { setLoadingState('stats', false); setLoadingState('activities', false); setLoadingState('notifications', false); setLoadingState('streakMilestones', false); initTooltips(); } }
    // --- END: Data Loading ---

    // --- START: UI Update Functions ---
    function updateSidebarProfile(profile, titlesData = allTitles) { /* ... (keep existing logic) ... */ console.log("[UI Update] Aktualizace sidebaru..."); if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) { console.warn("[UI Update] Elementy sidebaru nenalezeny."); return; } if (profile) { const firstName = profile.first_name ?? ''; const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(profile); const avatarUrl = profile.avatar_url; ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot'; if (selectedTitleKey && titlesData && titlesData.length > 0) { const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) { displayTitle = foundTitle.name; } } ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`; console.log("[UI Update] Sidebar aktualizován."); } else { console.warn("[UI Update] Chybí data profilu pro sidebar."); ui.sidebarName.textContent = "Pilot"; ui.sidebarAvatar.textContent = '?'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot'; if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title'); if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítejte!`; } }
    function updateStatsCards(stats) { /* ... (keep existing logic) ... */ console.log("[UI Update] Aktualizace karet statistik:", stats); const statElements = { progress: ui.progressCard?.querySelector('.stat-card-value'), progressChange: ui.progressCard?.querySelector('.stat-card-change'), points: ui.pointsCard?.querySelector('.stat-card-value'), pointsChange: ui.pointsCard?.querySelector('.stat-card-change'), streak: ui.streakCard?.querySelector('.stat-card-value'), streakLongest: ui.streakCard?.querySelector('.stat-card-change') }; const cards = [ui.progressCard, ui.pointsCard, ui.streakCard]; const displayError = (cardElement) => { if (cardElement) { cardElement.classList.remove('loading'); const skel = cardElement.querySelector('.loading-skeleton'); const cont = cardElement.querySelector('.stat-card-content'); if(skel) skel.style.display = 'none'; if(cont) cont.style.visibility='hidden'; /* Optionally add error text */ } }; if (!stats) { cards.forEach(displayError); return; } cards.forEach(card => { if (card) { card.classList.remove('loading'); const skel = card.querySelector('.loading-skeleton'); const cont = card.querySelector('.stat-card-content'); if(skel) skel.style.display = 'none'; if(cont) cont.style.visibility = 'visible'; } }); if (statElements.progress && statElements.progressChange) { statElements.progress.textContent = `${stats.progress ?? 0}%`; const weeklyChange = stats.progress_weekly ?? 0; statElements.progressChange.classList.remove('positive', 'negative'); statElements.progressChange.innerHTML = weeklyChange > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyChange}% týdně` : weeklyChange < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyChange}% týdně` : `<i class="fas fa-minus"></i> --`; if (weeklyChange > 0) statElements.progressChange.classList.add('positive'); else if (weeklyChange < 0) statElements.progressChange.classList.add('negative'); } if (statElements.points && statElements.pointsChange) { statElements.points.textContent = stats.points ?? 0; const weeklyPoints = stats.points_weekly ?? 0; statElements.pointsChange.classList.remove('positive', 'negative'); statElements.pointsChange.innerHTML = weeklyPoints > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyPoints} týdně` : weeklyPoints < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyPoints} týdně` : `<i class="fas fa-minus"></i> --`; if (weeklyPoints > 0) statElements.pointsChange.classList.add('positive'); else if (weeklyPoints < 0) statElements.pointsChange.classList.add('negative'); } if (statElements.streak && statElements.streakLongest) { statElements.streak.textContent = stats.streak_current ?? 0; statElements.streakLongest.textContent = `MAX: ${stats.streak_longest ?? 0} dní`; } console.log("[UI Update] Karty statistik aktualizovány."); }
    function renderActivities(activities) { /* ... (keep existing logic) ... */ if (!ui.activityList || !ui.activityListContainer || !ui.activityListEmptyState || !ui.activityListErrorState) { console.error("[Render Activities] Chybí UI elementy."); setLoadingState('activities', false); return; } ui.activityList.innerHTML = ''; ui.activityListEmptyState.style.display = 'none'; ui.activityListErrorState.style.display = 'none'; if (activities === null) { ui.activityListErrorState.style.display = 'block'; ui.activityListContainer.classList.remove('loading'); setLoadingState('activities', false); return; } if (activities.length === 0) { ui.activityListEmptyState.style.display = 'block'; ui.activityListContainer.classList.remove('loading'); setLoadingState('activities', false); return; } const fragment = document.createDocumentFragment(); activities.forEach(activity => { const visual = activityVisuals[activity.type?.toLowerCase()] || activityVisuals.default; const title = sanitizeHTML(activity.title || 'Neznámá aktivita'); const description = sanitizeHTML(activity.description || ''); const timeAgo = formatRelativeTime(activity.created_at); const item = document.createElement('div'); item.className = 'activity-item'; item.innerHTML = `<div class="activity-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="activity-content"><div class="activity-title">${title}</div><div class="activity-desc">${description}</div><div class="activity-time"><i class="far fa-clock"></i> ${timeAgo}</div></div>`; fragment.appendChild(item); }); ui.activityList.appendChild(fragment); ui.activityListContainer.classList.remove('loading'); console.log(`[Render Activities] Vykresleno ${activities.length} položek.`); setLoadingState('activities', false); }
    function renderActivitySkeletons(count = 5) { /* ... (keep existing logic) ... */ if (!ui.activityList || !ui.activityListContainer) return; ui.activityListContainer.classList.add('loading'); ui.activityList.innerHTML = ''; let skeletonHTML = '<div class="loading-placeholder">'; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="skeleton-activity-item"> <div class="skeleton icon-placeholder"></div> <div style="flex-grow: 1;"> <div class="skeleton activity-line"></div> <div class="skeleton activity-line text-short"></div> <div class="skeleton activity-line-short"></div> </div> </div>`; } skeletonHTML += '</div>'; ui.activityList.innerHTML = skeletonHTML; }
    function renderNotifications(count, notifications) { /* ... (keep existing logic) ... */ if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Chybí UI elementy."); setLoadingState('notifications', false); return; } console.log("[Render Notifications] Start, Počet:", count, "Oznámení:", notifications); ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } console.log("[Render Notifications] Hotovo"); setLoadingState('notifications', false); }
    function renderNotificationSkeletons(count = 2) { /* ... (keep existing logic) ... */ if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    function renderMonthlyCalendar() { /* ... (keep existing logic) ... */ }
    function renderMonthlyCalendarSkeletons() { /* ... (keep existing logic) ... */ }
    function renderStreakMilestones() { /* ... (keep existing logic) ... */ }
    function renderMilestoneSkeletons() { /* ... (keep existing logic) ... */ }
    // --- END: UI Update ---

    // --- START: Reward Claiming Logic ---
    async function claimMonthlyReward(day, buttonElement) { /* ... (keep existing logic) ... */ }
    async function claimMilestoneReward(milestoneDay, buttonElement) { /* ... (keep existing logic) ... */ }
    // --- END: Reward Claiming ---

    // --- START: Notification Logic ---
    async function markNotificationRead(notificationId) { /* ... (keep existing logic) ... */ if (!currentUser || !notificationId || !supabase) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; return true; } catch (error) { console.error("[FUNC] markNotificationRead: Error:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { /* ... (keep existing logic) ... */ if (!currentUser || !supabase || !ui.markAllReadBtn) return; if (isLoading.notifications) return; setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; try { const { error } = await supabase .from('user_notifications') .update({ is_read: true }) .eq('user_id', currentUser.id) .eq('is_read', false); if (error) throw error; const { unreadCount, notifications } = await fetchNotifications(currentUser.id, 5); renderNotifications(unreadCount, notifications); showToast('Oznámení Vymazána', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[FUNC] markAllNotificationsRead: Error:", error); showToast('Chyba', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }
    // --- END: Notification Logic ---

    // --- START: Event Listeners Setup ---
    function setupUIEventListeners() {
        console.log("[SETUP] setupUIEventListeners: Start");
        // Ensure sidebar toggle button listener is attached
        if (ui.sidebarToggleBtn) {
            ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);
        } else { console.warn("[SETUP] Sidebar toggle button not found."); }

        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
        document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });
        window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus(); // Initial check
        if (ui.refreshDataBtn) ui.refreshDataBtn.addEventListener('click', handleRefreshClick);
        if (ui.startPracticeBtn) ui.startPracticeBtn.addEventListener('click', () => { window.location.href = 'procvicovani/main.html'; });
        if (ui.openMonthlyModalBtn) ui.openMonthlyModalBtn.addEventListener('click', () => showModal('monthly-reward-modal'));
        if (ui.openStreakModalBtn) ui.openStreakModalBtn.addEventListener('click', () => showModal('streak-milestones-modal'));
        if (ui.notificationBell) ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); });
        if (ui.markAllReadBtn) ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead);
        if (ui.notificationsList) ui.notificationsList.addEventListener('click', handleNotificationClick);
        document.addEventListener('click', closeNotificationDropdownOnClickOutside);
        if (ui.closeMonthlyModalBtn) ui.closeMonthlyModalBtn.addEventListener('click', () => hideModal('monthly-reward-modal'));
        if (ui.monthlyRewardModal) ui.monthlyRewardModal.addEventListener('click', (e) => { if (e.target === ui.monthlyRewardModal) hideModal('monthly-reward-modal'); });
        if (ui.closeStreakModalBtn) ui.closeStreakModalBtn.addEventListener('click', () => hideModal('streak-milestones-modal'));
        if (ui.streakMilestonesModal) ui.streakMilestonesModal.addEventListener('click', (e) => { if (e.target === ui.streakMilestonesModal) hideModal('streak-milestones-modal'); });
        if (ui.mainContent) ui.mainContent.addEventListener('scroll', initHeaderScrollDetection, { passive: true });
        console.log("[SETUP] Event listeners set up.");
    }
    // --- END: Event Listeners ---

    // --- START: Event Handlers ---
    function handleRefreshClick() { if (!currentUser || !currentProfile || Object.values(isLoading).some(s=>s)) { showToast('Info', 'Data se již načítají nebo nejste přihlášeni.', 'info'); return; } const btn = ui.refreshDataBtn; const icon = btn?.querySelector('i'); const text = btn?.querySelector('.refresh-text'); if (btn) btn.disabled = true; if (icon) icon.classList.add('fa-spin'); if (text) text.textContent = 'RELOADING...'; loadDashboardData(currentUser, currentProfile).finally(() => { if (btn) btn.disabled = false; if (icon) icon.classList.remove('fa-spin'); if (text) text.textContent = 'RELOAD'; }); }
    async function handleNotificationClick(event) { const item = event.target.closest('.notification-item'); if (!item) return; const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) { window.location.href = link; } }
    function closeNotificationDropdownOnClickOutside(event) { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } }
    // --- END: Event Handlers ---

    // --- START: App Initialization ---
    async function initializeApp() {
        console.log("[INIT Dashboard] initializeApp: Start v23.2 - Cache DOM Fix");
        if (!cacheDOMElements()) { showError("Kritická chyba: Nepodařilo se nalézt základní UI prvky.", true); return; }
        if (!initializeSupabase()) return; // Initialize and set global window.supabase.client

        applyInitialSidebarState(); // Apply sidebar state AFTER caching buttons
        setupUIEventListeners(); // Setup listeners AFTER caching

        if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; }
        if (ui.mainContent) ui.mainContent.style.display = 'none'; // Hide content initially

        try {
            console.log("[INIT Dashboard] Checking auth session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);

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

                if (titlesResult.status === 'fulfilled') {
                    allTitles = titlesResult.value || [];
                    console.log("[INIT Dashboard] Titles loaded:", allTitles.length);
                } else {
                    console.warn("[INIT Dashboard] Failed to load titles:", titlesResult.reason);
                    allTitles = [];
                }

                updateSidebarProfile(currentProfile, allTitles); // Update UI
                initHeaderScrollDetection();
                updateCopyrightYear();

                await loadDashboardData(currentUser, currentProfile); // Load dashboard specific data

                // Show main content AFTER data is likely loaded
                if (ui.mainContent) {
                     ui.mainContent.style.display = 'block';
                     requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); });
                 }
                initMouseFollower();
                initTooltips();

                // **** DISPATCH EVENT WHEN READY ****
                console.log("[INIT Dashboard] Dispatching 'dashboardReady' event.");
                document.dispatchEvent(new CustomEvent('dashboardReady', {
                     detail: {
                         user: currentUser,
                         profile: currentProfile,
                         titles: allTitles,
                         client: supabase // Pass the client instance
                     }
                }));
                // **** END DISPATCH ****

                console.log("✅ [INIT Dashboard] Page fully loaded and initialized.");

            } else {
                console.log('[INIT Dashboard] V sezení není uživatel, přesměrování.');
                window.location.href = '/auth/index.html';
            }
        } catch (error) {
            console.error("❌ [INIT Dashboard] Kritická chyba inicializace:", error);
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE STRÁNKU.</p>`; }
            else { showError(`Chyba inicializace: ${error.message}`, true); }
            if (ui.mainContent) ui.mainContent.style.display = 'none'; // Hide content on critical error
            // Do not dispatch ready event on error
        } finally {
            // Hide loader AFTER potential dispatch or error handling
            if (ui.initialLoader) {
                ui.initialLoader.classList.add('hidden');
                setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500);
            }
        }
    }

    // --- START THE APP ---
    // Use DOMContentLoaded to ensure base HTML is parsed before caching/running
    document.addEventListener('DOMContentLoaded', initializeApp);

})();