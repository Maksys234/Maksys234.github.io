// dashboard.js
// Версия: 23.3 - Исправлена бесконечная загрузка (проверка элементов UI), Модальные Награды
(function() {
    'use strict';

    // --- START: Initialization and Configuration ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = []; // Store fetched titles

    let isLoading = { stats: false, activities: false, notifications: false, titles: false, monthlyRewards: false, streakMilestones: false };
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';

    // Constants for rewards
    const MONTHLY_REWARD_DAYS = 31; // Assuming max days in a month for calendar rendering
    const MILESTONE_REWARDS_CONFIG = {
        // (Config object remains the same as provided in the original dashboard.js)
         5: { name: "První Krůčky", description: "Gratulujeme k 5 dnům v řadě!", icon: "fa-shoe-prints", reward_type: "placeholder", reward_value: 5 },
        10: { name: "Stabilních 10", description: "Udržujete tempo!", icon: "fa-star", reward_type: "placeholder", reward_value: 10 },
        15: { name: "Patnáctka", description: "Půl cesty k měsíci!", icon: "fa-adjust", reward_type: "placeholder", reward_value: 15 },
        20: { name: "Dvacítka!", description: "Pěkná série!", icon: "fa-angle-double-up", reward_type: "placeholder", reward_value: 20 },
        30: { name: "Měsíc Bez Přestávky!", description: "Stabilita se vyplácí.", icon: "fa-calendar-check", reward_type: "placeholder", reward_value: 30 },
        50: { name: "Půl Století Dnů!", description: "Jste na půli cesty ke stovce!", icon: "fa-award", reward_type: "placeholder", reward_value: 50 },
        75: { name: "Tři Čtvrtě Stovky", description: "Blížíte se k velkému milníku.", icon: "fa-hourglass-half", reward_type: "placeholder", reward_value: 75 },
        100: { name: "Legendární Stovka!", description: "Váš závazek je inspirující!", icon: "fa-crown", reward_type: "placeholder", reward_value: 100 },
        125: { name: "Stovka a Čtvrt", description: "Stále silní!", icon: "fa-thumbs-up", reward_type: "placeholder", reward_value: 125 },
        150: { name: "Věrný Pilot", description: "Jste skutečným veteránem systému.", icon: "fa-shield-alt", reward_type: "placeholder", reward_value: 150 },
        200: { name: "Dvojitá Stovka!", description: "Úžasná vytrvalost!", icon: "fa-gem", reward_type: "placeholder", reward_value: 200 },
        250: { name: "Čtvrt Tisíciletí Dnů", description: "Síla je s vámi.", icon: "fa-meteor", reward_type: "placeholder", reward_value: 250 },
        300: { name: "Téměř Rok!", description: "Neuvěřitelná disciplína!", icon: "fa-trophy", reward_type: "placeholder", reward_value: 300 },
        365: { name: "Roční Výročí!", description: "Jste absolutní legenda Justax!", icon: "fa-rocket", reward_type: "placeholder", reward_value: 365 }
    };
    const milestoneDays = Object.keys(MILESTONE_REWARDS_CONFIG).map(Number).sort((a, b) => a - b);

    // UI Cache - defined globally, populated in cacheDOMElements
    let ui = {};

    // Visual mappings (remain the same)
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
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) { console.warn("Toast container not found."); return; } try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Obnovit Stránku</button></div>`; ui.globalError.style.display = 'block'; const retryBtn = document.getElementById('global-retry-btn'); if (retryBtn) { retryBtn.addEventListener('click', () => { location.reload(); }); } } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }
    function setLoadingState(section, isLoadingFlag) {
        const sections = section === 'all' ? Object.keys(isLoading) : [section];
        sections.forEach(sec => {
             if (!ui || Object.keys(ui).length === 0) { console.warn("UI cache not ready for setLoadingState"); return; } // Guard clause
            if (isLoading[sec] === isLoadingFlag && section !== 'all') return;
            isLoading[sec] = isLoadingFlag;
            console.log(`[setLoadingState] Section: ${sec}, isLoading: ${isLoadingFlag}`);

            // Map sections to relevant UI elements
            const loaderOverlayMap = { monthlyRewards: ui.monthlyRewardModal?.querySelector('.loading-overlay'), streakMilestones: ui.streakMilestonesModal?.querySelector('.loading-overlay'), activities: null, stats: null, notifications: null, titles: null };
            const contentContainerMap = { monthlyRewards: ui.modalMonthlyCalendarGrid, streakMilestones: ui.modalMilestonesGrid, activities: ui.activityList, stats: [ui.progressCard, ui.pointsCard, ui.streakCard], notifications: ui.notificationsList, titles: null };
            const emptyStateMap = { monthlyRewards: ui.modalMonthlyCalendarEmpty, streakMilestones: ui.modalMilestonesEmpty, activities: ui.activityListEmptyState, notifications: ui.noNotificationsMsg };
            const parentSectionMap = { monthlyRewards: ui.monthlyRewardModal?.querySelector('.modal-body'), streakMilestones: ui.streakMilestonesModal?.querySelector('.modal-body'), activities: ui.activityListContainer, stats: null, notifications: ui.notificationsDropdown, titles: null };

            const loaderOverlay = loaderOverlayMap[sec];
            const contentContainer = contentContainerMap[sec];
            const emptyStateContainer = emptyStateMap[sec];
            const parentSection = parentSectionMap[sec];

            if (sec === 'stats') {
                 if (Array.isArray(contentContainer)) {
                     contentContainer.forEach(card => card?.classList.toggle('loading', isLoadingFlag));
                 }
            } else if (loaderOverlay || parentSection) {
                parentSection?.classList.toggle('loading', isLoadingFlag);
                if (loaderOverlay) loaderOverlay.classList.toggle('hidden', !isLoadingFlag);

                if (isLoadingFlag) {
                    if (contentContainer && typeof contentContainer !== 'string') contentContainer.innerHTML = ''; // Clear content
                    if (emptyStateContainer) emptyStateContainer.style.display = 'none';

                    // Render skeletons
                    if (sec === 'activities' && typeof renderActivitySkeletons === 'function') renderActivitySkeletons(5);
                    else if (sec === 'monthlyRewards' && typeof renderMonthlyCalendarSkeletons === 'function') renderMonthlyCalendarSkeletons();
                    else if (sec === 'streakMilestones' && typeof renderMilestoneSkeletons === 'function') renderMilestoneSkeletons();
                    else if (sec === 'notifications' && typeof renderNotificationSkeletons === 'function') renderNotificationSkeletons(2);
                } else {
                     // After loading, check if content is empty and show empty state if necessary
                     if (contentContainer && !contentContainer.hasChildNodes() && emptyStateContainer) {
                         emptyStateContainer.style.display = 'block';
                     } else if (emptyStateContainer) {
                          emptyStateContainer.style.display = 'none'; // Ensure empty state is hidden if content exists
                     }
                }
            } else if (sec === 'notifications' && ui.notificationBell) {
                // Special handling for notification bell/dropdown visibility
                 ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
                 if(ui.markAllReadBtn) {
                     const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                     ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
                 }
                 if (isLoadingFlag && ui.notificationsList && typeof renderNotificationSkeletons === 'function') {
                     renderNotificationSkeletons(2); // Show skeletons
                 }
            }
        });
    }
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }); animatedElements.forEach(element => observer.observe(element)); };
    const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 50); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl && mainEl.scrollTop > 50) document.body.classList.add('scrolled'); };
    const updateCopyrightYear = () => { const currentYearSpan = ui.currentYearFooter; const currentYearSidebar = ui.currentYearSidebar; const year = new Date().getFullYear(); if (currentYearSpan) { currentYearSpan.textContent = year; } if (currentYearSidebar) { currentYearSidebar.textContent = year; } };
    function applyInitialSidebarState() {
        const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);
        const shouldBeCollapsed = savedState === 'collapsed';
        console.log(`[Sidebar State] Initial read state: ${savedState}, Applying collapsed: ${shouldBeCollapsed}`);
        if (shouldBeCollapsed) {
            document.body.classList.add('sidebar-collapsed');
        } else {
            document.body.classList.remove('sidebar-collapsed');
        }
        const icon = ui.sidebarToggleBtn?.querySelector('i');
        if (icon) {
             icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
             ui.sidebarToggleBtn.setAttribute('aria-label', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel');
             ui.sidebarToggleBtn.setAttribute('title', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel');
             console.log(`[Sidebar State] Initial icon/attributes set.`);
        } else {
             console.warn("[Sidebar State] Sidebar toggle button icon not found for initial state.");
        }
    }
    function toggleSidebar() {
        const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded');
        const icon = ui.sidebarToggleBtn?.querySelector('i');
        if (icon) {
            icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
            ui.sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel');
            ui.sidebarToggleBtn.setAttribute('title', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel');
        }
        console.log(`[Sidebar Toggle] Sidebar toggled. New state: ${isCollapsed ? 'collapsed' : 'expanded'}`);
    }
    function initTooltips() { try { if (window.jQuery && typeof window.jQuery.fn.tooltipster === 'function') { window.jQuery('.btn-tooltip.tooltipstered').each(function() { if (document.body.contains(this)) { try { window.jQuery(this).tooltipster('destroy'); } catch (destroyError) { console.warn("Tooltipster destroy error:", destroyError); } } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); console.log("[Tooltips] Initialized/Re-initialized."); } else { console.warn("[Tooltips] jQuery or Tooltipster library not loaded."); } } catch (e) { console.error("[Tooltips] Error initializing Tooltipster:", e); } }
    function isSameDate(date1, date2) { if (!date1 || !date2) return false; const d1 = new Date(date1); const d2 = new Date(date2); return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate(); }
    function isYesterday(date1, date2) { if (!date1 || !date2) return false; const yesterday = new Date(date2); yesterday.setDate(yesterday.getDate() - 1); return isSameDate(date1, yesterday); }
    function getCurrentMonthYearString() { const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); return `${year}-${month}`; }
    function showModal(modalId) { const modal = document.getElementById(modalId); if (modal) { console.log(`[Modal] Opening modal: ${modalId}`); modal.style.display = 'flex'; if (modalId === 'monthly-reward-modal') { renderMonthlyCalendar(); } else if (modalId === 'streak-milestones-modal') { renderStreakMilestones(); } requestAnimationFrame(() => { modal.classList.add('active'); }); } else { console.error(`[Modal] Modal element not found: #${modalId}`); } }
    function hideModal(modalId) { const modal = document.getElementById(modalId); if (modal) { console.log(`[Modal] Closing modal: ${modalId}`); modal.classList.remove('active'); setTimeout(() => { modal.style.display = 'none'; }, 300); } }
    // --- END: Helper Functions ---

    // --- START: Data Loading and Processing ---
    function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Knihovna Supabase nebyla nalezena."); } supabase = window.supabase.createClient(supabaseUrl, supabaseKey); if (!supabase) { throw new Error("Vytvoření klienta Supabase selhalo."); } console.log('[Supabase] Klient úspěšně inicializován.'); return true; } catch (error) { console.error('[Supabase] Inicializace selhala:', error); showError(`Kritická chyba: Nepodařilo se připojit k databázi. (${error.message})`, true); return false; } }
    async function fetchUserProfile(userId) { if (!supabase || !userId) return null; console.log(`[Profile] Fetching profile for user ID: ${userId}`); try { const { data: profile, error } = await supabase.from('profiles').select('*, selected_title, last_login, streak_days, monthly_claims, last_milestone_claimed').eq('id', userId).single(); if (error && error.code !== 'PGRST116') { throw error; } if (!profile) { console.warn(`[Profile] Profile for ${userId} not found. Returning null.`); return null; } profile.monthly_claims = profile.monthly_claims || {}; profile.last_milestone_claimed = profile.last_milestone_claimed || 0; console.log("[Profile] Profile data fetched successfully."); return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); return null; } }
    async function createDefaultProfile(userId, userEmail) { if (!supabase || !userId || !userEmail) return null; console.log(`[Profile Create] Creating default profile for user ${userId}`); try { const defaultData = { id: userId, email: userEmail, username: userEmail.split('@')[0] || `user_${userId.substring(0, 6)}`, level: 1, points: 0, experience: 0, badges_count: 0, streak_days: 0, last_login: new Date().toISOString(), monthly_claims: {}, last_milestone_claimed: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), preferences: { dark_mode: window.matchMedia('(prefers-color-scheme: dark)').matches, language: 'cs' }, notifications: { email: true, study_tips: true, content_updates: true, practice_reminders: true } }; const { data: newProfile, error } = await supabase.from('profiles').insert(defaultData).select('*, selected_title, last_login, streak_days, monthly_claims, last_milestone_claimed').single(); if (error) { if (error.code === '23505') { console.warn("[Profile Create] Profile likely already exists, fetching again."); return await fetchUserProfile(userId); } throw error; } console.log("[Profile Create] Default profile created:", newProfile); return newProfile; } catch (error) { console.error("[Profile Create] Failed to create default profile:", error); return null; } }
    async function fetchTitles() { if (!supabase) return []; console.log("[Titles] Fetching available titles..."); setLoadingState('titles', true); try { const { data, error } = await supabase.from('title_shop').select('title_key, name'); if (error) throw error; console.log("[Titles] Fetched titles:", data); return data || []; } catch (error) { console.error("[Titles] Error fetching titles:", error); return []; } finally { setLoadingState('titles', false); } }
    async function fetchUserStats(userId, profileData) { if (!supabase || !userId || !profileData) { console.error("[Stats] Chybí Supabase klient, ID uživatele nebo data profilu."); return null; } console.log(`[Stats] Načítání statistik pro uživatele ${userId}...`); let fetchedStats = null; let statsError = null; try { const { data, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); fetchedStats = data; statsError = error; if (statsError) { console.warn("[Stats] Chyba Supabase při načítání user_stats:", statsError.message); } } catch (error) { console.error("[Stats] Neočekávaná chyba při načítání user_stats:", error); statsError = error; } const finalStats = { progress: fetchedStats?.progress ?? profileData.progress ?? 0, progress_weekly: fetchedStats?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: fetchedStats?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0), completed_exercises: profileData.completed_exercises ?? 0, completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0 }; if (statsError) { console.warn("[Stats] Vracení statistik primárně z profilu kvůli chybě načítání."); } else { console.log("[Stats] Statistiky úspěšně načteny/sestaveny:", finalStats); } return finalStats; }
    async function fetchRecentActivities(userId, limit = 5) { if (!supabase || !userId) { console.error("[Activities] Chybí Supabase nebo ID uživatele."); return []; } console.log(`[Activities] Načítání posledních ${limit} aktivit pro uživatele ${userId}`); try { const { data, error } = await supabase .from('activities') .select('*') .eq('user_id', userId) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; console.log(`[Activities] Načteno ${data?.length || 0} aktivit.`); return data || []; } catch (error) { console.error('[Activities] Výjimka při načítání aktivit:', error); return []; } }
    async function fetchNotifications(userId, limit = 5) { if (!supabase || !userId) { console.error("[Notifications] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await supabase .from('user_notifications') .select('*', { count: 'exact' }) .eq('user_id', userId) .eq('is_read', false) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; console.log(`[Notifications] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; } }

    async function checkAndUpdateLoginStreak() {
        if (!currentUser || !currentProfile || !supabase) {
            console.warn("[StreakCheck] Cannot perform check: missing user, profile, or supabase.");
            return false;
        }
        console.log("[StreakCheck] Performing daily login check/update...");
        const today = new Date();
        const lastLogin = currentProfile.last_login ? new Date(currentProfile.last_login) : null;
        let currentStreak = currentProfile.streak_days || 0;
        let needsDbUpdate = false;
        let updateData = {};
        let currentMonth = getCurrentMonthYearString();

        if (!lastLogin || !isSameDate(today, lastLogin)) {
            needsDbUpdate = true;
            console.log("[StreakCheck] First login of the day detected.");
            if (lastLogin && isYesterday(lastLogin, today)) {
                currentStreak++;
                console.log(`[StreakCheck] Streak continued! New streak: ${currentStreak}`);
            } else if (lastLogin) {
                currentStreak = 1;
                console.log("[StreakCheck] Streak broken. Resetting to 1.");
            } else {
                currentStreak = 1; // First login ever
                console.log("[StreakCheck] First login ever. Setting streak to 1.");
            }
            updateData.streak_days = currentStreak;
            updateData.last_login = today.toISOString();
        } else {
            console.log("[StreakCheck] Already logged in today. No streak update needed.");
            currentStreak = currentProfile.streak_days || 0; // Use existing streak
        }

        // Update local profile state immediately for UI responsiveness
        currentProfile.streak_days = currentStreak;
        if(ui.modalCurrentStreakValue) ui.modalCurrentStreakValue.textContent = currentStreak; // Update modal streak value

        // Check and initialize monthly claims if needed
        currentProfile.monthly_claims = currentProfile.monthly_claims || {};
        if (!currentProfile.monthly_claims[currentMonth]) {
            console.log(`[StreakCheck] Initializing claims for new month: ${currentMonth}`);
            const updatedClaims = { ...currentProfile.monthly_claims, [currentMonth]: [] };
            currentProfile.monthly_claims = updatedClaims; // Update local state
            updateData.monthly_claims = updatedClaims; // Add to DB update data
            needsDbUpdate = true; // Flag for DB update
        } else {
            console.log(`[StreakCheck] Monthly claims for ${currentMonth} already exist.`);
        }

        // If any changes require DB update, perform it
        if (needsDbUpdate) {
            console.log("[StreakCheck] Updating profile in DB with:", updateData);
            try {
                const { error: updateError } = await supabase.from('profiles').update(updateData).eq('id', currentUser.id);
                if (updateError) throw updateError;
                // Update local profile with potentially new last_login or claims
                if (updateData.last_login) currentProfile.last_login = updateData.last_login;
                if (updateData.monthly_claims) currentProfile.monthly_claims = updateData.monthly_claims;
                console.log("[StreakCheck] Profile updated successfully in DB.");
                return true; // Indicates an update occurred
            } catch (error) {
                console.error("[StreakCheck] Error updating profile:", error);
                showToast('Chyba', 'Nepodařilo se aktualizovat data přihlášení.', 'error');
                return false; // Update failed
            }
        }
        return false; // No update was needed
    }

    async function updateMonthlyClaimsInDB(newClaimsData) {
        if (!currentUser || !supabase) return false;
        console.log("[DB Update] Updating monthly claims in DB:", newClaimsData);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ monthly_claims: newClaimsData, updated_at: new Date().toISOString() })
                .eq('id', currentUser.id);
            if (error) throw error;
            console.log("[DB Update] Monthly claims update successful.");
            return true;
        } catch (error) {
            console.error("[DB Update] Error updating monthly claims:", error);
            showToast('Chyba', 'Nepodařilo se uložit vyzvednutí měsíční odměny.', 'error');
            return false;
        }
    }

    async function updateLastMilestoneClaimedInDB(milestoneDay) {
         if (!currentUser || !supabase) return false;
        console.log(`[DB Update] Updating last_milestone_claimed to ${milestoneDay}`);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ last_milestone_claimed: milestoneDay, updated_at: new Date().toISOString() })
                .eq('id', currentUser.id);
            if (error) throw error;
            console.log(`[DB Update] Last claimed milestone update successful.`);
            return true;
        } catch (error) {
            console.error(`[DB Update] Error updating last_milestone_claimed:`, error);
            showToast('Chyba', 'Nepodařilo se uložit vyzvednutí milníkové odměny.', 'error');
            return false;
        }
    }

    async function loadDashboardData(user, profile) {
        if (!user || !profile) {
            showError("Chyba: Nelze načíst data bez profilu uživatele.", true);
            setLoadingState('all', false);
            return;
        }
        console.log("[MAIN] loadDashboardData: Start pro uživatele:", user.id);
        hideError();
        setLoadingState('stats', true);
        setLoadingState('activities', true);
        setLoadingState('notifications', true);

        try {
            await checkAndUpdateLoginStreak(); // Update streak/login FIRST

            // Update UI with potentially updated profile (streak, etc.)
            updateSidebarProfile(profile);
             // Load other data concurrently
            console.log("[MAIN] loadDashboardData: Načítání statistik, aktivit, oznámení...");
            const results = await Promise.allSettled([
                fetchUserStats(user.id, profile), // Pass potentially updated profile
                fetchRecentActivities(user.id, 5),
                fetchNotifications(user.id, 5)
            ]);
            console.log("[MAIN] loadDashboardData: Souběžné načítání dokončeno:", results);

            // Process Stats
            if (results[0].status === 'fulfilled') {
                 updateStatsCards(results[0].value || profile); // Use updated stats or fallback to profile
            } else {
                 console.error("❌ Chyba při načítání statistik:", results[0].reason);
                 showError("Nepodařilo se načíst statistiky nástěnky.", false);
                 updateStatsCards(profile); // Fallback to profile data
            }
             setLoadingState('stats', false);

            // Process Activities
            if (results[1].status === 'fulfilled') {
                renderActivities(results[1].value || []); // Render empty if null/undefined
            } else {
                console.error("❌ Chyba při načítání aktivit:", results[1].reason);
                showError("Nepodařilo se načíst nedávné aktivity.", false);
                renderActivities(null); // Render error state
            }
             setLoadingState('activities', false);

            // Process Notifications
            if (results[2].status === 'fulfilled') {
                const { unreadCount, notifications } = results[2].value || { unreadCount: 0, notifications: [] };
                renderNotifications(unreadCount, notifications);
            } else {
                console.error("❌ Chyba při načítání oznámení:", results[2].reason);
                showError("Nepodařilo se načíst oznámení.", false);
                renderNotifications(0, []); // Render empty state on error
            }
             setLoadingState('notifications', false);

            console.log("[MAIN] loadDashboardData: Statické секции обработаны.");

        } catch (error) {
            console.error('[MAIN] loadDashboardData: Zachycena hlavní chyba:', error);
            showError('Nepodařilo se kompletně načíst data nástěnky: ' + error.message);
            // Attempt to render with profile data as fallback
            updateStatsCards(profile);
            renderActivities(null);
            renderNotifications(0, []);
            setLoadingState('all', false); // Ensure all loaders are off
        } finally {
             // setLoadingState('all', false); // Already handled above
            initTooltips(); // Re-initialize tooltips for dynamic content
        }
    }
    // --- END: Data Loading ---

    // --- START: UI Update Functions ---
    function updateSidebarProfile(profile) {
        // Ensure UI elements are cached
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) {
             // Try caching again if called before initialization completed
             cacheDOMElements();
             if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) {
                 console.warn("[UI Update Sidebar] Sidebar elements not found in cache.");
                 return;
             }
        }
        console.log("[UI Update Sidebar] Updating sidebar profile...");
        if (profile) {
            const firstName = profile.first_name ?? '';
            const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(profile);
            const avatarUrl = profile.avatar_url;
            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
            const selectedTitleKey = profile.selected_title;
            let displayTitle = 'Pilot';
            if (selectedTitleKey && allTitles && allTitles.length > 0) {
                const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) displayTitle = foundTitle.name;
                 else console.warn(`[UI Update Sidebar] Title key "${selectedTitleKey}" not found in titles list.`);
            } else if (selectedTitleKey) {
                 console.warn(`[UI Update Sidebar] Selected title key present, but titles list is empty or not loaded.`);
            }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle)); // Add tooltip
            if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítej zpět, ${sanitizeHTML(displayName)}!`;
            console.log("[UI Update Sidebar] Sidebar updated.");
        } else {
            console.warn("[UI Update Sidebar] Missing profile data. Setting defaults.");
            ui.sidebarName.textContent = "Pilot";
            ui.sidebarAvatar.textContent = '?';
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = 'Pilot';
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.removeAttribute('title');
            if (ui.welcomeTitle) ui.welcomeTitle.textContent = `Vítejte!`;
        }
    }

    function updateStatsCards(stats) {
        console.log("[UI Update] Aktualizace karet statistik:", stats);
        const statElements = {
            progress: ui.overallProgressValue,
            points: ui.totalPointsValue,
            streak: ui.streakValue,
            progressFooter: ui.overallProgressFooter,
            pointsFooter: ui.totalPointsFooter,
            streakFooter: ui.streakFooter
        };
        const cards = [ui.progressCard, ui.pointsCard, ui.streakCard];

        // Check if stat card elements exist
        const missingStatElements = Object.entries(statElements).filter(([key, el]) => !el).map(([key]) => key);
        if (missingStatElements.length > 0) {
            console.error("[UI Update Stats] Chybějící elementy statistik:", missingStatElements);
            // Optionally display an error or simply return
            // showError("Chyba zobrazení: Některé prvky statistik chybí.", false);
             // Fallback: remove loading class from found cards
             cards.forEach(card => card?.classList.remove('loading'));
             return; // Prevent further processing if essential elements are missing
        }

        cards.forEach(card => card?.classList.remove('loading'));

        if (!stats) {
            console.warn("[UI Update Stats] Chybí data statistik.");
            statElements.progress.textContent = '- %';
            statElements.points.textContent = '-';
            statElements.streak.textContent = '-';
            statElements.progressFooter.innerHTML = `<i class="fas fa-exclamation-circle"></i> Data nenalezena`;
            statElements.pointsFooter.innerHTML = `<i class="fas fa-exclamation-circle"></i> Data nenalezena`;
            statElements.streakFooter.textContent = `MAX: - dní`;
            return;
        }

        statElements.progress.textContent = `${stats.progress ?? 0}%`;
        const weeklyProgress = stats.progress_weekly ?? 0;
        statElements.progressFooter.classList.remove('positive', 'negative');
        statElements.progressFooter.innerHTML = weeklyProgress > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyProgress}% týdně` : weeklyProgress < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyProgress}% týdně` : `<i class="fas fa-minus"></i> --`;
        if (weeklyProgress > 0) statElements.progressFooter.classList.add('positive');
        else if (weeklyProgress < 0) statElements.progressFooter.classList.add('negative');

        statElements.points.textContent = stats.points ?? 0;
        const weeklyPoints = stats.points_weekly ?? 0;
        statElements.pointsFooter.classList.remove('positive', 'negative');
        statElements.pointsFooter.innerHTML = weeklyPoints > 0 ? `<i class="fas fa-arrow-up"></i> +${weeklyPoints} týdně` : weeklyPoints < 0 ? `<i class="fas fa-arrow-down"></i> ${weeklyPoints} týdně` : `<i class="fas fa-minus"></i> --`;
        if (weeklyPoints > 0) statElements.pointsFooter.classList.add('positive');
        else if (weeklyPoints < 0) statElements.pointsFooter.classList.add('negative');

        statElements.streak.textContent = stats.streak_current ?? 0;
        statElements.streakFooter.textContent = `MAX: ${stats.streak_longest ?? 0} dní`;
        console.log("[UI Update] Karty statistik aktualizovány.");
    }

    function renderActivities(activities) {
         // Ensure UI elements are available before proceeding
         if (!ui.activityList || !ui.activityListContainer || !ui.activityListEmptyState || !ui.activityListErrorState) {
             console.error("[Render Activities] Essential UI elements for activity list are missing. Rendering cancelled.");
             setLoadingState('activities', false); // Ensure loading state is off
             return;
         }
         console.log("[Render Activities] Start rendering, activities count:", activities?.length);
         ui.activityList.innerHTML = ''; // Clear previous content
         ui.activityListEmptyState.style.display = 'none';
         ui.activityListErrorState.style.display = 'none';
         ui.activityList.style.display = 'none'; // Hide list initially

         if (activities === null) {
             // Error state
             ui.activityListErrorState.style.display = 'block';
             console.warn("[Render Activities] Received null data, showing error state.");
         } else if (activities.length === 0) {
             // Empty state
             ui.activityListEmptyState.style.display = 'block';
             console.log("[Render Activities] No activities to display, showing empty state.");
         } else {
             // Render activities
             const fragment = document.createDocumentFragment();
             activities.forEach(activity => {
                 const visual = activityVisuals[activity.type?.toLowerCase()] || activityVisuals.default;
                 const title = sanitizeHTML(activity.title || 'Neznámá aktivita');
                 const description = sanitizeHTML(activity.description || '');
                 const timeAgo = formatRelativeTime(activity.created_at);
                 const item = document.createElement('div');
                 item.className = 'activity-item';
                 item.innerHTML = `
                     <div class="activity-icon ${visual.class}">
                         <i class="fas ${visual.icon}"></i>
                     </div>
                     <div class="activity-content">
                         <div class="activity-title">${title}</div>
                         ${description ? `<div class="activity-desc">${description}</div>` : ''}
                         <div class="activity-time"><i class="far fa-clock"></i> ${timeAgo}</div>
                     </div>
                 `;
                 fragment.appendChild(item);
             });
             ui.activityList.appendChild(fragment);
             ui.activityList.style.display = 'block'; // Show the list with items
             console.log(`[Render Activities] Rendered ${activities.length} items.`);
         }
         // Ensure container loading class is removed regardless of state
         ui.activityListContainer.classList.remove('loading');
         // Set loading state to false AFTER rendering decisions
         setLoadingState('activities', false);
     }

    function renderActivitySkeletons(count = 5) {
        if (!ui.activityList || !ui.activityListContainer) {
            console.warn("Cannot render activity skeletons: List or container not found.");
            return;
        }
        // Ensure parent container shows loading state
        ui.activityListContainer.classList.add('loading');
        // Clear previous content and hide other states
        ui.activityList.innerHTML = '';
        if(ui.activityListEmptyState) ui.activityListEmptyState.style.display = 'none';
        if(ui.activityListErrorState) ui.activityListErrorState.style.display = 'none';

        let skeletonHTML = '<div class="loading-placeholder">'; // Wrapper for skeletons
        for (let i = 0; i < count; i++) {
            skeletonHTML += `
                <div class="skeleton-activity-item">
                    <div class="skeleton icon-placeholder"></div>
                    <div style="flex-grow: 1;">
                        <div class="skeleton activity-line"></div>
                        <div class="skeleton activity-line text-short"></div>
                        <div class="skeleton activity-line-short"></div>
                    </div>
                </div>`;
        }
        skeletonHTML += '</div>';
        ui.activityList.innerHTML = skeletonHTML;
        ui.activityList.style.display = 'block'; // Ensure the list container is visible for skeletons
        console.log(`[Render Skeletons] Rendered ${count} activity skeletons.`);
    }

    function renderNotifications(count, notifications) {
        // Ensure elements are cached
        if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
             cacheDOMElements(); // Try caching again
             if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
                 console.error("[Render Notifications] Notification UI elements are still missing after re-cache. Cannot render.");
                 setLoadingState('notifications', false);
                 return;
             }
        }
        console.log("[Render Notifications] Start, Count:", count, "Notifications:", notifications);
        ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
        ui.notificationCount.classList.toggle('visible', count > 0);

        if (notifications && notifications.length > 0) {
            ui.notificationsList.innerHTML = notifications.map(n => {
                const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default;
                const isReadClass = n.is_read ? 'is-read' : '';
                const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : '';
                return `
                    <div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
                        ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
                        <div class="notification-icon ${visual.class}">
                            <i class="fas ${visual.icon}"></i>
                        </div>
                        <div class="notification-content">
                            <div class="notification-title">${sanitizeHTML(n.title)}</div>
                            <div class="notification-message">${sanitizeHTML(n.message)}</div>
                            <div class="notification-time">${formatRelativeTime(n.created_at)}</div>
                        </div>
                    </div>`;
            }).join('');
            ui.noNotificationsMsg.style.display = 'none';
            ui.notificationsList.style.display = 'block';
            ui.markAllReadBtn.disabled = count === 0;
        } else {
            ui.notificationsList.innerHTML = '';
            ui.noNotificationsMsg.style.display = 'block';
            ui.notificationsList.style.display = 'none';
            ui.markAllReadBtn.disabled = true;
        }
        console.log("[Render Notifications] Finished rendering.");
        // setLoadingState('notifications', false); // Set by caller (loadDashboardData)
    }

    function renderNotificationSkeletons(count = 2) {
        if (!ui.notificationsList || !ui.noNotificationsMsg) return;
        let skeletonHTML = '';
        for (let i = 0; i < count; i++) {
            skeletonHTML += `
                <div class="notification-item skeleton">
                    <div class="notification-icon skeleton"></div>
                    <div class="notification-content">
                        <div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div>
                        <div class="skeleton" style="height: 12px; width: 90%;"></div>
                        <div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div>
                    </div>
                </div>`;
        }
        ui.notificationsList.innerHTML = skeletonHTML;
        ui.noNotificationsMsg.style.display = 'none';
        ui.notificationsList.style.display = 'block'; // Show list for skeletons
    }

    function renderMonthlyCalendar() {
         // Ensure elements are cached
         if (!ui.modalMonthlyCalendarGrid || !ui.modalCurrentMonthYearSpan || !ui.modalMonthlyCalendarEmpty) {
             cacheDOMElements(); // Try caching again
             if (!ui.modalMonthlyCalendarGrid || !ui.modalCurrentMonthYearSpan || !ui.modalMonthlyCalendarEmpty) {
                 console.error("Monthly calendar MODAL UI elements missing. Cannot render.");
                 setLoadingState('monthlyRewards', false);
                 return;
             }
         }
        console.log("[RenderMonthly] Rendering calendar...");
        setLoadingState('monthlyRewards', true);
        const gridContainer = ui.modalMonthlyCalendarGrid;
        const modalTitleSpan = ui.modalCurrentMonthYearSpan;
        const emptyState = ui.modalMonthlyCalendarEmpty;
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const today = now.getDate();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthString = getCurrentMonthYearString();
        const monthName = now.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
        const claimedDaysThisMonth = currentProfile?.monthly_claims?.[monthString] || [];
        console.log(`[RenderMonthly] Claimed days for ${monthString}:`, claimedDaysThisMonth);

        modalTitleSpan.textContent = monthName;
        gridContainer.innerHTML = '';
        emptyState.style.display = 'none';
        gridContainer.style.display = 'grid'; // Ensure grid is displayed

        const fragment = document.createDocumentFragment();
        let daysRendered = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.classList.add('calendar-day');
            dayElement.dataset.day = day;
            const isClaimed = claimedDaysThisMonth.includes(day);
            const isClaimable = (day === today && !isClaimed); // Only today is claimable
            const isUpcoming = day > today;
            const isMissed = day < today && !isClaimed;

            let rewardIconHtml = '<i class="fas fa-gift"></i>';
            let rewardText = `Den ${day}`;
            dayElement.innerHTML = `
                <span class="day-number">${day}</span>
                <div class="reward-icon">${rewardIconHtml}</div>
                <span class="reward-text">${rewardText}</span>
                <span class="reward-status"></span>
                <button class="claim-button btn btn-sm" style="display: none;"><i class="fas fa-check"></i> Vyzvednout</button>
            `;
            const statusSpan = dayElement.querySelector('.reward-status');
            const claimButton = dayElement.querySelector('.claim-button');

            if (isClaimed) { dayElement.classList.add('claimed'); if (statusSpan) statusSpan.textContent = 'Získáno'; }
            else if (isClaimable) { dayElement.classList.add('available'); if (statusSpan) statusSpan.textContent = 'Dostupné'; if (claimButton) { claimButton.style.display = 'block'; claimButton.addEventListener('click', (e) => { e.stopPropagation(); claimMonthlyReward(day, claimButton); }); } }
            else if (isUpcoming) { dayElement.classList.add('upcoming'); if (statusSpan) statusSpan.textContent = 'Připravuje se'; }
            else { dayElement.classList.add('missed'); if (statusSpan) statusSpan.textContent = 'Zmeškáno'; }
            if(day === today) { dayElement.classList.add('today'); }

            fragment.appendChild(dayElement);
            daysRendered++;
        }

        if (daysRendered > 0) {
            gridContainer.appendChild(fragment);
        } else {
            emptyState.style.display = 'block';
            gridContainer.style.display = 'none';
        }
         // Ensure modal body loading state is removed
         ui.monthlyRewardModal?.querySelector('.modal-body')?.classList.remove('loading');
        console.log("[RenderMonthly] Modal calendar rendered.");
        setLoadingState('monthlyRewards', false);
        initTooltips(); // Re-init for potential new buttons
    }

    function renderMonthlyCalendarSkeletons() {
        const gridContainer = ui.modalMonthlyCalendarGrid;
        if (!gridContainer) return;
        gridContainer.innerHTML = '';
        gridContainer.style.display = 'grid';
        const skeletonCount = 21; // Render a few rows of skeletons
        let skeletonHTML = '';
        for(let i=0; i < skeletonCount; i++) {
            skeletonHTML += '<div class="calendar-day skeleton"></div>';
        }
        gridContainer.innerHTML = skeletonHTML;
    }

    function renderStreakMilestones() {
         // Ensure elements are cached
         if (!ui.modalMilestonesGrid || !ui.modalMilestonesEmpty || !ui.modalCurrentStreakValue) {
             cacheDOMElements(); // Try caching again
             if (!ui.modalMilestonesGrid || !ui.modalMilestonesEmpty || !ui.modalCurrentStreakValue) {
                 console.error("Streak milestones MODAL UI elements missing. Cannot render.");
                 setLoadingState('streakMilestones', false);
                 return;
             }
         }
        console.log("[RenderMilestones] Rendering streak milestones...");
        setLoadingState('streakMilestones', true);
        const gridContainer = ui.modalMilestonesGrid;
        const emptyState = ui.modalMilestonesEmpty;
        const streakSpan = ui.modalCurrentStreakValue;
        const currentStreak = currentProfile?.streak_days || 0;
        const lastClaimed = currentProfile?.last_milestone_claimed || 0;

        streakSpan.textContent = currentStreak;
        gridContainer.innerHTML = '';
        emptyState.style.display = 'none';
        gridContainer.style.display = 'grid'; // Ensure grid is displayed

        const fragment = document.createDocumentFragment();
        let milestonesToShow = 0;
        milestoneDays.forEach(milestoneDay => {
            const config = MILESTONE_REWARDS_CONFIG[milestoneDay];
            if (!config) return;
            const milestoneElement = document.createElement('div');
            milestoneElement.classList.add('milestone-card');
            milestoneElement.dataset.milestone = milestoneDay;
            const isClaimed = lastClaimed >= milestoneDay;
            const isClaimable = currentStreak >= milestoneDay && !isClaimed; // Claimable if streak met AND not claimed
            const isLocked = currentStreak < milestoneDay; // Locked if streak not met

            let statusHTML = '';
            let buttonHTML = '';
            if (isClaimed) {
                milestoneElement.classList.add('claimed');
                statusHTML = `<span class="reward-status">Získáno</span>`;
            } else if (isClaimable) {
                milestoneElement.classList.add('available');
                statusHTML = `<span class="reward-status">Dostupné</span>`;
                buttonHTML = `<button class="claim-button btn btn-sm btn-success"><i class="fas fa-check"></i> Vyzvednout</button>`;
            } else { // Locked
                milestoneElement.classList.add('locked');
                const daysNeeded = milestoneDay - currentStreak;
                statusHTML = `<span class="reward-status">Ještě ${daysNeeded} ${daysNeeded === 1 ? 'den' : (daysNeeded < 5 ? 'dny' : 'dní')}</span>`;
            }
            milestoneElement.innerHTML = `
                <span class="day-number">Série ${milestoneDay}</span>
                <div class="reward-icon"><i class="fas ${config.icon || 'fa-award'}"></i></div>
                <span class="reward-text" title="${sanitizeHTML(config.description)}">${sanitizeHTML(config.name)}</span>
                ${statusHTML}
                ${buttonHTML}
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

        if (milestonesToShow > 0) {
            gridContainer.appendChild(fragment);
        } else {
            emptyState.style.display = 'block';
            gridContainer.style.display = 'none';
        }
         // Ensure modal body loading state is removed
        ui.streakMilestonesModal?.querySelector('.modal-body')?.classList.remove('loading');
        console.log("[RenderMilestones] Milestones rendered in modal.");
        setLoadingState('streakMilestones', false);
        initTooltips(); // Re-init for potential new buttons
    }

    function renderMilestoneSkeletons() {
        const gridContainer = ui.modalMilestonesGrid;
        if (!gridContainer) return;
        gridContainer.innerHTML = '';
        gridContainer.style.display = 'grid';
        const skeletonCount = 6; // Render a few skeletons
        let skeletonHTML = '';
        for(let i=0; i < skeletonCount; i++) {
            skeletonHTML += '<div class="milestone-card skeleton"></div>';
        }
        gridContainer.innerHTML = skeletonHTML;
    }
    // --- END: UI Update ---

    // --- START: Claim Reward Logic ---
    async function claimMonthlyReward(day, buttonElement) {
        console.log(`[ClaimMonthly] Attempting claim for day ${day}`);
        if (!currentUser || !currentProfile || !supabase || isLoading.monthlyRewards) return;
        setLoadingState('monthlyRewards', true); // Use modal specific loading state
        if (buttonElement) { buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

        const currentMonth = getCurrentMonthYearString();
        currentProfile.monthly_claims = currentProfile.monthly_claims || {};
        currentProfile.monthly_claims[currentMonth] = currentProfile.monthly_claims[currentMonth] || [];

        if (currentProfile.monthly_claims[currentMonth].includes(day)) {
            console.warn(`[ClaimMonthly] Day ${day} already claimed.`);
            showToast('Info', 'Odměna již byla vyzvednuta.', 'info');
            setLoadingState('monthlyRewards', false);
            renderMonthlyCalendar(); // Re-render to update UI if needed
            return;
        }
        const updatedClaimsForMonth = [...currentProfile.monthly_claims[currentMonth], day];
        const updatedFullClaims = { ...currentProfile.monthly_claims, [currentMonth]: updatedClaimsForMonth };

        const dbSuccess = await updateMonthlyClaimsInDB(updatedFullClaims); // Update DB

        if (dbSuccess) {
            currentProfile.monthly_claims = updatedFullClaims; // Update local state
            console.log(`[ClaimMonthly] Reward claimed locally & DB save confirmed. New claims:`, currentProfile.monthly_claims);
            showToast('Odměna Získána!', `Získali jste odměnu za ${day}. den měsíce!`, 'success');
             // TODO: Implement actual reward granting (e.g., points)
             // await grantReward("monthly", day);
        } else {
            showToast('Chyba', 'Nepodařilo se uložit vyzvednutí odměny.', 'error');
             // Re-enable button if save failed
             if (buttonElement) { buttonElement.disabled = false; buttonElement.innerHTML = '<i class="fas fa-check"></i> Vyzvednout'; }
        }
        setLoadingState('monthlyRewards', false);
        renderMonthlyCalendar(); // Re-render calendar to reflect the change
    }

    async function claimMilestoneReward(milestoneDay, buttonElement) {
        console.log(`[ClaimMilestone] Attempting claim for milestone ${milestoneDay}`);
        if (!currentUser || !currentProfile || !supabase || isLoading.streakMilestones) return;
        setLoadingState('streakMilestones', true);
        if (buttonElement) { buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

        const lastClaimed = currentProfile?.last_milestone_claimed || 0;
        const currentStreak = currentProfile?.streak_days || 0;

        if (lastClaimed >= milestoneDay) {
            console.warn(`[ClaimMilestone] Milestone ${milestoneDay} already claimed (last claimed: ${lastClaimed}).`);
            showToast('Info', 'Milník již byl dosažen.', 'info');
            setLoadingState('streakMilestones', false);
            renderStreakMilestones();
            return;
        }
        if (currentStreak < milestoneDay) {
             console.warn(`[ClaimMilestone] Milestone ${milestoneDay} not yet reached (current streak: ${currentStreak}).`);
            showToast('Chyba', 'Podmínky pro tento milník ještě nebyly splněny.', 'warning');
             setLoadingState('streakMilestones', false);
             renderStreakMilestones(); // Refresh UI
             return;
        }

        const rewardConfig = MILESTONE_REWARDS_CONFIG[milestoneDay];
        const rewardName = rewardConfig?.name || `Odměna za ${milestoneDay} dní`;

        const dbSuccess = await updateLastMilestoneClaimedInDB(milestoneDay); // Update DB

        if(dbSuccess) {
            currentProfile.last_milestone_claimed = milestoneDay; // Update local state
            console.log(`[ClaimMilestone] Reward claimed locally & DB save confirmed. Last claimed: ${currentProfile.last_milestone_claimed}`);
            showToast('Milník Dosažen!', `Získali jste: ${rewardName}`, 'success');
            // TODO: Implement actual reward granting (e.g., points, badge trigger)
            // await grantReward("milestone", milestoneDay, rewardConfig);
             // Optionally check achievements after claiming
             // if (typeof checkAndAwardAchievements === 'function') { checkAndAwardAchievements(currentUser.id); }
        } else {
            showToast('Chyba', 'Nepodařilo se uložit vyzvednutí milníkové odměny.', 'error');
             // Re-enable button if save failed
             if (buttonElement) { buttonElement.disabled = false; buttonElement.innerHTML = '<i class="fas fa-check"></i> Vyzvednout'; }
        }
        setLoadingState('streakMilestones', false);
        renderStreakMilestones(); // Re-render milestones
    }
    // --- END: Claim Reward Logic ---

    // --- START: Notification Logic ---
    async function markNotificationRead(notificationId) { console.log("[FUNC] markNotificationRead: Označení ID:", notificationId); if (!currentUser || !notificationId || !supabase) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[FUNC] markNotificationRead: Úspěch pro ID:", notificationId); return true; } catch (error) { console.error("[FUNC] markNotificationRead: Chyba:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() {
         console.log("[FUNC] markAllNotificationsRead: Start pro uživatele:", currentUser?.id);
         // Ensure elements are cached
         if (!ui.markAllReadBtn || !ui.notificationCount) {
             cacheDOMElements(); // Try caching again
             if (!ui.markAllReadBtn || !ui.notificationCount) {
                  console.error("Mark all read button or notification count element not found.");
                  return;
             }
         }
         if (!currentUser || !supabase) return;
         if (isLoading.notifications) return; // Prevent multiple clicks
         setLoadingState('notifications', true);
         ui.markAllReadBtn.disabled = true;
         // Keep text, just show loading state by disabling
         // ui.markAllReadBtn.textContent = 'MAŽU...';
         try {
             const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false);
             if (error) throw error;
             console.log("[FUNC] markAllNotificationsRead: Úspěch");
             // Fetch and re-render after marking all read
             const { unreadCount, notifications } = await fetchNotifications(currentUser.id, 5);
             renderNotifications(unreadCount, notifications);
             showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success');
         } catch (error) {
             console.error("[FUNC] markAllNotificationsRead: Chyba:", error);
             showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error');
             // Re-enable button based on actual count after error
             const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
             ui.markAllReadBtn.disabled = currentCount === 0;
         } finally {
              setLoadingState('notifications', false);
             // Text is not changed, only disabled state based on renderNotifications
         }
     }
    // --- END: Notification Logic ---

    // --- START: Event Listeners Setup ---
    function setupUIEventListeners() {
         console.log("[SETUP] setupUIEventListeners: Start");
         // Ensure UI elements are cached before adding listeners
         if (!ui || Object.keys(ui).length === 0) {
             console.error("[SETUP] UI cache is empty! Cannot setup listeners.");
             return;
         }
         const listenersAdded = new Set(); // Track added listeners

         // Helper to safely add listener
         const safeAddListener = (element, eventType, handler, key) => {
             if (element) {
                 element.removeEventListener(eventType, handler); // Remove previous if exists
                 element.addEventListener(eventType, handler);
                 listenersAdded.add(key);
             } else {
                 console.warn(`[SETUP] Element not found for listener: ${key}`);
             }
         };

         // Sidebar/Menu
         safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle');
         safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle');
         safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay');
         safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn');
         document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });

         // Core Actions
         safeAddListener(ui.startPracticeBtn, 'click', () => { window.location.href = '/dashboard/procvicovani/main.html'; }, 'startPracticeBtn');
         safeAddListener(ui.openMonthlyModalBtn, 'click', () => showModal('monthly-reward-modal'), 'openMonthlyModalBtn');
         safeAddListener(ui.openStreakModalBtn, 'click', () => showModal('streak-milestones-modal'), 'openStreakModalBtn');
         safeAddListener(ui.refreshDataBtn, 'click', async () => {
             if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; }
             if (Object.values(isLoading).some(state => state)) { showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info"); return; }
             const icon = ui.refreshDataBtn.querySelector('i');
             const text = ui.refreshDataBtn.querySelector('.refresh-text');
             if (icon) icon.classList.add('fa-spin');
             if (text) text.textContent = 'RELOADING...';
             ui.refreshDataBtn.disabled = true;
             await loadDashboardData(currentUser, currentProfile);
             if (icon) icon.classList.remove('fa-spin');
             if (text) text.textContent = 'RELOAD';
             ui.refreshDataBtn.disabled = false;
         }, 'refreshDataBtn');

         // Notifications
         safeAddListener(ui.notificationBell, 'click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell');
         safeAddListener(ui.markAllReadBtn, 'click', markAllNotificationsRead, 'markAllReadBtn');
         safeAddListener(ui.notificationsList, 'click', async (event) => {
             const item = event.target.closest('.notification-item');
             if (item) {
                 const notificationId = item.dataset.id;
                 const link = item.dataset.link;
                 const isRead = item.classList.contains('is-read');
                 if (!isRead && notificationId) {
                     const success = await markNotificationRead(notificationId);
                     if (success) {
                         item.classList.add('is-read');
                         item.querySelector('.unread-dot')?.remove();
                         const currentCountText = ui.notificationCount?.textContent?.replace('+', '') || '0';
                         const currentCount = parseInt(currentCountText) || 0;
                         const newCount = Math.max(0, currentCount - 1);
                         if(ui.notificationCount) { ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); }
                         if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0;
                     }
                 }
                 if (link) window.location.href = link;
             }
         }, 'notificationsList');
         document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown?.classList.remove('active'); } });

         // Modal Listeners
         safeAddListener(ui.closeMonthlyModalBtn, 'click', () => hideModal('monthly-reward-modal'), 'closeMonthlyModalBtn');
         safeAddListener(ui.monthlyRewardModal, 'click', (event) => { if (event.target === ui.monthlyRewardModal) { hideModal('monthly-reward-modal'); } }, 'monthlyRewardModal');
         safeAddListener(ui.closeStreakModalBtn, 'click', () => hideModal('streak-milestones-modal'), 'closeStreakModalBtn');
         safeAddListener(ui.streakMilestonesModal, 'click', (event) => { if (event.target === ui.streakMilestonesModal) { hideModal('streak-milestones-modal'); } }, 'streakMilestonesModal');

         // Other global listeners
         window.addEventListener('online', updateOnlineStatus);
         window.addEventListener('offline', updateOnlineStatus);
         if (ui.mainContent) ui.mainContent.addEventListener('scroll', initHeaderScrollDetection, { passive: true });

         console.log(`[SETUP] Event listeners setup complete. Added listeners for: ${[...listenersAdded].join(', ')}`);
     }
    // --- END: Event Listeners ---

    // --- DOM Element Caching Function ---
    function cacheDOMElements() {
        console.log("[CACHE DOM] Caching elements...");
        ui = {
            // Core Layout & Sidebar
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
            currentYearSidebar: document.getElementById('currentYearSidebar'),
            // Header
            dashboardHeader: document.querySelector('.dashboard-header'), // Use querySelector for class
            dashboardTitle: document.getElementById('dashboard-title'),
            refreshDataBtn: document.getElementById('refresh-data-btn'),
            // Notifications
            notificationBell: document.getElementById('notification-bell'),
            notificationCount: document.getElementById('notification-count'),
            notificationsDropdown: document.getElementById('notifications-dropdown'),
            notificationsList: document.getElementById('notifications-list'),
            noNotificationsMsg: document.getElementById('no-notifications-msg'),
            markAllReadBtn: document.getElementById('mark-all-read'),
            // Welcome & Shortcuts
            welcomeTitle: document.getElementById('welcome-title'),
            startPracticeBtn: document.getElementById('start-practice-btn'),
            openMonthlyModalBtn: document.getElementById('open-monthly-modal-btn'),
            openStreakModalBtn: document.getElementById('open-streak-modal-btn'),
            // Stat Cards
            progressCard: document.getElementById('progress-card'),
            overallProgressValue: document.getElementById('overall-progress-value'),
            overallProgressDesc: document.getElementById('overall-progress-desc'), // Keep if used, though static
            overallProgressFooter: document.getElementById('overall-progress-footer'),
            pointsCard: document.getElementById('points-card'),
            totalPointsValue: document.getElementById('total-points-value'),
            totalPointsDesc: document.getElementById('total-points-desc'), // Keep if used, though static
            totalPointsFooter: document.getElementById('total-points-footer'),
            streakCard: document.getElementById('streak-card'),
            streakValue: document.getElementById('streak-value'),
            streakDesc: document.getElementById('streak-desc'), // Keep if used, though static
            streakFooter: document.getElementById('streak-footer'),
            // Activity List
            activityListContainer: document.getElementById('activity-list-container'),
            activityList: document.getElementById('activity-list'),
            activityListEmptyState: document.getElementById('activity-list-empty-state'),
            activityListErrorState: document.getElementById('activity-list-error-state'),
            // Modals
            monthlyRewardModal: document.getElementById('monthly-reward-modal'),
            modalMonthlyCalendarGrid: document.getElementById('modal-monthly-calendar-grid'),
            modalMonthlyCalendarEmpty: document.getElementById('modal-monthly-calendar-empty'),
            modalCurrentMonthYearSpan: document.getElementById('modal-current-month-year'),
            closeMonthlyModalBtn: document.getElementById('close-monthly-modal-btn'),
            streakMilestonesModal: document.getElementById('streak-milestones-modal'),
            modalMilestonesGrid: document.getElementById('modal-milestones-grid'),
            modalMilestonesEmpty: document.getElementById('modal-milestones-empty'),
            modalCurrentStreakValue: document.getElementById('modal-current-streak-value'),
            closeStreakModalBtn: document.getElementById('close-streak-modal-btn'),
            // Utility/Other
            toastContainer: document.getElementById('toast-container'),
            globalError: document.getElementById('global-error'),
            offlineBanner: document.getElementById('offline-banner'),
            mouseFollower: document.getElementById('mouse-follower'),
            currentYearFooter: document.getElementById('currentYearFooter')
        };

        // Check for missing elements
        const missingElements = Object.entries(ui)
            .filter(([key, element]) => element === null)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            console.warn(`[CACHE DOM] The following elements were NOT found: (${missingElements.length})`, missingElements);
            // Consider showing a non-blocking warning to the user or logging more prominently
            // showToast("Warning", `Některé části stránky se nemusí zobrazit správně (chybějící elementy: ${missingElements.join(', ')}).`, "warning", 7000);
        } else {
            console.log("[CACHE DOM] Caching complete, all expected elements found.");
        }
    }

    // --- START THE APP ---
    async function initializeApp() {
         console.log("[INIT Dashboard] initializeApp: Start v23.3 - Fixed element checks");

         // Cache DOM elements FIRST
         cacheDOMElements();

         // Wait for Supabase library to be loaded (important if scripts load async)
         const waitForSupabase = new Promise((resolve, reject) => {
             const maxAttempts = 10; let attempts = 0;
             const intervalId = setInterval(() => {
                 attempts++;
                 if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
                     console.log(`[INIT Dashboard] Supabase library found after ${attempts} attempts.`);
                     clearInterval(intervalId); resolve();
                 } else if (attempts >= maxAttempts) {
                     console.error("[INIT Dashboard] Supabase library not found after waiting. Aborting.");
                     clearInterval(intervalId); reject(new Error("Knihovna Supabase nebyla nalezena včas."));
                 } else { console.log(`[INIT Dashboard] Waiting for Supabase library... (Attempt ${attempts}/${maxAttempts})`); }
             }, 200); // Check every 200ms
         });
         try { await waitForSupabase; }
         catch (waitError) { showError(waitError.message, true); if(ui.initialLoader) ui.initialLoader.classList.add('hidden'); return; } // Stop if Supabase fails

         // Initialize Supabase client
         if (!initializeSupabase()) { console.error("[INIT Dashboard] Supabase init function failed. Aborting."); return; }

         // Setup listeners AFTER caching DOM and initializing Supabase
         setupUIEventListeners();
         applyInitialSidebarState(); // Apply sidebar state early

         if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; }
         if (ui.mainContent) ui.mainContent.style.display = 'none'; // Hide main content until ready

         try {
             console.log("[INIT Dashboard] Checking auth session...");
             const { data: { session }, error: sessionError } = await supabase.auth.getSession();
             if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);

             if (session?.user) {
                 currentUser = session.user;
                 console.log(`[INIT Dashboard] User authenticated (ID: ${currentUser.id}). Loading profile and titles...`);

                 // Fetch profile and titles concurrently
                 const [profileResult, titlesResult] = await Promise.allSettled([
                     fetchUserProfile(currentUser.id),
                     fetchTitles()
                 ]);

                 // Handle profile result
                 if (profileResult.status === 'fulfilled' && profileResult.value) {
                     currentProfile = profileResult.value;
                     console.log("[INIT Dashboard] Profile loaded:", currentProfile);
                 } else {
                     console.warn("[INIT Dashboard] Profile not found or fetch failed, attempting to create default...");
                     currentProfile = await createDefaultProfile(currentUser.id, currentUser.email);
                     if (!currentProfile) { throw new Error("Nepodařilo se vytvořit/načíst profil uživatele."); }
                     console.log("[INIT Dashboard] Default profile created/retrieved.");
                 }

                 // Handle titles result
                 if (titlesResult.status === 'fulfilled') {
                     allTitles = titlesResult.value || [];
                     console.log("[INIT Dashboard] Titles loaded:", allTitles.length);
                 } else {
                     console.warn("[INIT Dashboard] Failed to load titles:", titlesResult.reason);
                     allTitles = []; // Default to empty array
                 }

                 // Initial UI updates that depend on profile/titles
                 updateSidebarProfile(currentProfile); // Update sidebar first
                 updateCopyrightYear();
                 updateOnlineStatus(); // Check network status

                 // Load main dashboard data
                 await loadDashboardData(currentUser, currentProfile);

                 // Final UI setup and reveal
                 if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
                 if (ui.mainContent) {
                     ui.mainContent.style.display = 'block';
                     requestAnimationFrame(() => {
                          ui.mainContent.classList.add('loaded');
                          initScrollAnimations(); // Init animations after content is visible
                     });
                 }
                 initMouseFollower();
                 initHeaderScrollDetection();
                 initTooltips(); // Init tooltips last

                 console.log("✅ [INIT Dashboard] Page fully loaded and initialized.");

             } else {
                 console.log('[INIT Dashboard] User not logged in, redirecting...');
                 window.location.href = '/auth/index.html';
             }
         } catch (error) {
             console.error("❌ [INIT Dashboard] Critical initialization error:", error);
             if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). Obnovte.</p>`; }
             else { showError(`Chyba inicializace: ${error.message}`, true); }
             if (ui.mainContent) ui.mainContent.style.display = 'none'; // Keep hidden on error
             setLoadingState('all', false); // Ensure all loaders are off
         }
     }
    // --- END: App Initialization ---

    // Start the application
    initializeApp();

})(); // End of IIFE