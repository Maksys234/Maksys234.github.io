// dashboard/oceneni.js
// Version: 23.15 - Fixed profile fetch query (removed non-existent columns), fixed setLoadingState recursion.
(function() { // IIFE for scope isolation
    'use strict';

    // --- START: Configuration ---
    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    const NOTIFICATION_FETCH_LIMIT = 5;
    const LEADERBOARD_LIMIT = 10;
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState'; // Consistent key
    // --- END: Configuration ---

    // --- START: State Variables ---
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let userStatsData = null;
    let userBadges = [];
    let allBadges = [];
    let allTitles = [];
    let allDecorations = []; // Keep for potential future use, but won't be fetched from profiles table
    let leaderboardData = [];
    let currentLeaderboardPeriod = 'overall';
    let isLoading = {
        stats: false, userBadges: false, availableBadges: false,
        leaderboard: false, titleShop: false, avatarDecorations: false,
        notifications: false, buyEquip: false, all: false
    };
    // --- END: State Variables ---

    // --- START: UI Elements Cache ---
    const ui = {};

    function cacheDOMElements() {
        console.log("[Oceneni Cache DOM] Caching elements...");
        const ids = [
            'initial-loader', 'sidebar-overlay', 'main-content', 'sidebar', 'main-mobile-menu-toggle',
            'sidebar-close-toggle', 'sidebar-avatar', 'sidebar-name', 'sidebar-user-title',
            'currentYearSidebar', 'page-title', 'refresh-data-btn', 'notification-bell',
            'notification-count', 'notifications-dropdown', 'notifications-list', 'no-notifications-msg',
            'mark-all-read', 'global-error', 'offline-banner', 'toast-container',
            'achievements-content', 'achievement-stats-container',
            'badges-count', 'badges-change', 'points-count', 'points-change',
            'streak-days', 'streak-change', 'rank-value', 'rank-change', 'total-users',
            'user-badges-container', 'badge-grid', 'empty-badges',
            'available-badges-container', 'available-badges-grid', 'empty-available-badges',
            'leaderboard-container', 'leaderboard-body', 'leaderboard-empty',
            'title-shop-container', 'shop-user-credits', 'title-shop-loading',
            'title-shop-grid', 'title-shop-empty',
            'avatar-decorations-shop', 'shop-decor-credits', 'avatar-decorations-loading',
            'avatar-decorations-grid', 'avatar-decorations-empty',
            'currentYearFooter', 'mouse-follower',
            'sidebar-toggle-btn',
            // Specific stat cards for loading class management
            'badges-card', 'points-card', 'streak-card', 'rank-card',
            // Specific section elements used by setLoadingState
            'leaderboard-skeleton', // Keep these even if commented out in HTML for robustness
            'leaderboard-header',
            'leaderboard-table-container'
        ];
        const notFound = [];
        ids.forEach(id => {
            const element = document.getElementById(id);
            const key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
            if (element) {
                ui[key] = element;
            } else {
                notFound.push(id);
                ui[key] = null;
            }
        });
        if (!ui.sidebarUserTitle) {
            const roleEl = document.getElementById('sidebar-user-role');
            if(roleEl) ui.sidebarUserTitle = roleEl;
            else notFound.push('sidebar-user-title/role');
        }

        if (notFound.length > 0) { console.warn(`[Oceneni Cache DOM] Elements not found: (${notFound.length})`, notFound); }
        console.log("[Oceneni Cache DOM] Caching complete.");
    }
    // --- END: UI Elements Cache ---

    // --- START: Helper Functions (Consolidated & Improved) ---
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatDate(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) return '-'; return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return '-'; } }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function initTooltips() { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip.tooltipstered').each(function() { try { window.jQuery(this).tooltipster('destroy'); } catch (e) { /* ignore */ } }); window.jQuery('.btn-tooltip').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, distance: 6, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } }
    const initMouseFollower = () => { const f = ui.mouseFollower; if (!f || window.innerWidth <= 576) return; let hM = false; const uP = (e) => { if (!hM) { document.body.classList.add('mouse-has-moved'); hM = true; } requestAnimationFrame(() => { f.style.left = `${e.clientX}px`; f.style.top = `${e.clientY}px`; }); }; window.addEventListener('mousemove', uP, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hM) f.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hM) f.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(f) f.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const els = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!els.length || !('IntersectionObserver' in window)) return; const obs = new IntersectionObserver((e, o) => { e.forEach(en => { if (en.isIntersecting) { en.target.classList.add('animated'); o.unobserve(en.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); els.forEach(el => obs.observe(el)); };
    const initHeaderScrollDetection = () => { let lSY = window.scrollY; const mE = ui.mainContent; if (!mE) return; mE.addEventListener('scroll', () => { const cSY = mE.scrollTop; document.body.classList.toggle('scrolled', cSY > 10); lSY = cSY <= 0 ? 0 : cSY; }, { passive: true }); if (mE.scrollTop > 10) document.body.classList.add('scrolled'); };
    const updateCopyrightYear = () => { const y = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = y; if (ui.currentYearFooter) ui.currentYearFooter.textContent = y; };
    // --- END: Helper Functions ---

    // --- START: Sidebar Logic ---
    function toggleSidebar() { if (!ui.sidebarToggleBtn) return; try { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (error) { console.error("[Sidebar Toggle] Error:", error); } }
    function applyInitialSidebarState() { if (!ui.sidebarToggleBtn) return; try { const savedState = localStorage.getItem(SIDEBAR_STATE_KEY); const shouldBeCollapsed = savedState === 'collapsed'; if (shouldBeCollapsed) document.body.classList.add('sidebar-collapsed'); else document.body.classList.remove('sidebar-collapsed'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.title = shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (error) { console.error("[Sidebar State] Error applying initial state:", error); document.body.classList.remove('sidebar-collapsed'); } }
    // --- END: Sidebar Logic ---

    // --- START: Loading State Management ---
    function setLoadingState(sectionKey, isLoadingFlag) {
        // <<< START FIX: Prevent infinite recursion >>>
        if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;

        const updateSingleSection = (key, loading) => {
            isLoading[key] = loading;
            console.log(`[SetLoading Oceneni] ${key}: ${loading}`);

            const sectionMap = {
                stats: { container: ui.achievementStatsContainer, childrenSelector: '.stat-card' },
                userBadges: { container: ui.userBadgesContainer, emptyEl: ui.emptyBadges, contentEl: ui.badgeGrid, skeletonFn: renderBadgeSkeletons, skeletonCount: 6 },
                availableBadges: { container: ui.availableBadgesContainer, emptyEl: ui.emptyAvailableBadges, contentEl: ui.availableBadgesGrid, skeletonFn: renderAvailableBadgeSkeletons, skeletonCount: 4 },
                leaderboard: { container: ui.leaderboardContainer, emptyEl: ui.leaderboardEmpty, contentEl: ui.leaderboardTableContainer, skeletonEl: ui.leaderboardSkeleton, headerEl: ui.leaderboardHeader, skeletonFn: renderLeaderboardSkeleton },
                titleShop: { container: ui.titleShopContainer, emptyEl: ui.titleShopEmpty, contentEl: ui.titleShopGrid, loadingEl: ui.titleShopLoading, skeletonFn: renderTitleShopSkeleton, skeletonCount: 3 },
                avatarDecorations: { container: ui.avatarDecorationsShop, emptyEl: ui.avatarDecorationsEmpty, contentEl: ui.avatarDecorationsGrid, loadingEl: ui.avatarDecorationsLoading, skeletonFn: renderAvatarDecorationsSkeleton, skeletonCount: 4 },
                notifications: { container: ui.notificationsList, emptyEl: ui.noNotificationsMsg, skeletonFn: renderNotificationSkeletons, skeletonCount: 2 },
                buyEquip: {} // No visual elements besides button state
            };

            const config = sectionMap[key];
            if (!config) { console.warn(`[SetLoading Oceneni] Unknown section key in updateSingleSection: ${key}`); return; }

            if (config.container) config.container.classList.toggle('loading', loading);
            if (config.childrenSelector && config.container) { config.container.querySelectorAll(config.childrenSelector).forEach(child => child.classList.toggle('loading', loading)); }

            const loaderEl = config.loadingEl || config.skeletonEl;
            const contentEl = config.contentEl;
            const emptyEl = config.emptyEl;
            const headerEl = config.headerEl;

            if (loaderEl) loaderEl.style.display = loading ? (key === 'leaderboard' ? 'block' : 'flex') : 'none';
            if (headerEl) headerEl.style.visibility = loading ? 'hidden' : 'visible';

            if (loading) {
                if (contentEl) contentEl.style.display = 'none';
                if (emptyEl) emptyEl.style.display = 'none';
                if (config.skeletonFn && (contentEl || config.container || key === 'leaderboard')) {
                    const target = contentEl || (key === 'leaderboard' ? null : config.container);
                    if (target || key === 'leaderboard') config.skeletonFn(target, config.skeletonCount);
                }
            } else {
                const isContentEmpty = !contentEl || !contentEl.hasChildNodes();
                if (emptyEl) emptyEl.style.display = isContentEmpty ? 'block' : 'none';
                if (contentEl) contentEl.style.display = isContentEmpty ? 'none' : (contentEl.tagName === 'TBODY' ? 'table-row-group' : 'grid');
            }

             // Specific notification handling
             if (key === 'notifications' && ui.notificationBell) {
                 ui.notificationBell.style.opacity = loading ? 0.5 : 1;
                 if (ui.markAllReadBtn) {
                     const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                     ui.markAllReadBtn.disabled = loading || currentUnreadCount === 0;
                 }
             }
        };

        if (sectionKey === 'all') {
            Object.keys(isLoading).forEach(key => {
                // Call the inner logic directly, DO NOT call setLoadingState recursively
                updateSingleSection(key, isLoadingFlag);
            });
        } else {
            updateSingleSection(sectionKey, isLoadingFlag);
        }
        // <<< END FIX >>>
    }
    // --- END: Loading State Management ---

    // --- START: Skeleton Rendering Functions ---
    function renderStatsSkeletons(container) { /* Only toggles loading class on cards */ }
    function renderBadgeSkeletons(container, count = 6) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="badge-card card loading"><div class="loading-skeleton" style="display: flex !important; flex-direction: column; align-items: center; padding: 1.8rem 1.2rem;"><div class="skeleton badge-icon-placeholder" style="width: 70px; height: 70px; border-radius: 50%; margin-bottom: 1.2rem;"></div><div class="skeleton badge-title-placeholder" style="height: 16px; width: 70%; margin-bottom: 0.5rem;"></div><div class="skeleton badge-desc-placeholder" style="height: 12px; width: 90%; margin-bottom: 0.4rem;"></div><div class="skeleton badge-desc-placeholder" style="height: 12px; width: 80%; margin-bottom: 0.8rem;"></div><div class="skeleton badge-date-placeholder" style="height: 12px; width: 50%; margin-top: auto;"></div></div></div>`; } container.innerHTML = skeletonHTML; }
    function renderAvailableBadgeSkeletons(container, count = 4) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="achievement-card card loading"><div class="loading-skeleton" style="display: flex !important;"><div class="skeleton achievement-icon-placeholder" style="width: 60px; height: 60px; border-radius: 16px; flex-shrink: 0;"></div><div class="skeleton achievement-content-placeholder" style="flex-grow: 1;"><div class="skeleton achievement-title-placeholder" style="height: 18px; width: 60%; margin-bottom: 0.6rem;"></div><div class="skeleton achievement-desc-placeholder" style="height: 14px; width: 95%; margin-bottom: 0.4rem;"></div><div class="skeleton achievement-desc-placeholder" style="height: 14px; width: 80%; margin-bottom: 0.8rem;"></div><div class="skeleton achievement-progress-placeholder" style="height: 20px; width: 100%;"></div></div></div></div>`; } container.innerHTML = skeletonHTML; }
    function renderLeaderboardSkeleton() { if (ui.leaderboardSkeleton) ui.leaderboardSkeleton.style.display = 'block'; }
    function renderTitleShopSkeleton(container, count = 3) { if (!container) container = ui.titleShopGrid; if (!container) return; container.innerHTML = ''; let skeletonHTML = ''; for(let i = 0; i < count; i++) { skeletonHTML += `<div class="title-item card loading"><div class="loading-skeleton" style="display: flex !important;"><div style="display: flex; gap: 1.2rem; align-items: flex-start; width: 100%;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 14px; flex-shrink: 0;"></div><div style="flex-grow: 1;"><div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 0.7rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 14px; width: 75%;"></div></div></div></div></div>`; } container.innerHTML = skeletonHTML; }
    function renderAvatarDecorationsSkeleton(container, count = 4) { if (!container) container = ui.avatarDecorationsGrid; if (!container) return; container.innerHTML = ''; let skeletonHTML = ''; for(let i = 0; i < count; i++) { skeletonHTML += `<div class="decoration-item card loading"><div class="loading-skeleton" style="display: flex !important; flex-direction: column; align-items: center; padding:1rem;"><div class="skeleton" style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 1rem auto;"></div><div class="skeleton" style="height: 18px; width: 70%; margin: 0 auto 0.7rem auto;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 14px; width: 80%;"></div><div style="margin-top: 1rem; padding-top: 0.8rem; border-top: 1px solid transparent; display: flex; justify-content: space-between; align-items: center; width:100%;"><div class="skeleton" style="height: 16px; width: 70px;"></div><div class="skeleton" style="height: 30px; width: 90px; border-radius: var(--button-radius);"></div></div></div></div>`; } container.innerHTML = skeletonHTML; }
    function renderNotificationSkeletons(container, count = 2) { if (!container) container = ui.notificationsList; if (!container) return; container.innerHTML = ''; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } container.innerHTML = skeletonHTML; }
    // --- END: Skeleton Rendering Functions ---

    // --- START: Data Fetching Functions ---
    async function fetchUserProfile(userId) {
        if (!supabase || !userId) return null;
        console.log(`[Profile] Fetching profile for user ID: ${userId}`);
        try {
            // <<< FIX: Removed purchased_decorations and selected_decoration >>>
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*, selected_title, purchased_titles') // Only fetch existing columns
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (!profile) { console.warn(`[Profile] Profile for user ${userId} not found. Returning null.`); return null; }
            console.log("[Profile] Profile data fetched successfully.");
            return profile;
        } catch (error) {
            console.error('[Profile] Caught exception fetching profile:', error);
            // Do not call setLoadingState here, let the caller handle it
            return null; // Indicate error
        }
    }
    async function fetchUserStats(userId, profileData) { if (!supabase || !userId || !profileData) return null; try { const { data: statsData, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); if (error) { console.warn("Error fetching user_stats:", error.message); return {}; } const { data: rankData, error: rankError } = await supabase.from('leaderboard').select('rank, user_id').eq('user_id', userId).eq('period', 'overall').limit(1); if (rankError) console.warn("Error fetching rank:", rankError.message); const { count: totalUsersCount, error: countError } = await supabase.from('profiles').select('id', { count: 'exact', head: true }); if (countError) console.warn("Error fetching total users count:", countError.message); return { progress: statsData?.progress ?? profileData.progress ?? 0, progress_weekly: statsData?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: statsData?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: Math.max(statsData?.streak_longest ?? 0, profileData.streak_days ?? 0), badges: profileData.badges_count ?? 0, rank: rankData?.[0]?.rank ?? null, totalUsers: totalUsersCount ?? null, }; } catch (e) { console.error("Exception fetching stats:", e); return null; } }
    async function fetchAllBadgesDefinition() { if (!supabase) return []; try { const { data, error } = await supabase.from('badges').select('*').order('id'); if (error) throw error; return data || []; } catch (e) { console.error("Error fetching badge definitions:", e); return []; } }
    async function fetchUserEarnedBadges(userId) { if (!supabase || !userId) return []; try { const { data, error } = await supabase.from('user_badges').select(`badge_id, earned_at, badge:badges!inner (id, title, description, type, icon, requirements, points)`).eq('user_id', userId).order('earned_at', { ascending: false }); if (error) throw error; return data || []; } catch (e) { console.error("Error fetching earned badges:", e); return []; } }
    async function fetchTitleShopData() { if (!supabase) return []; try { const { data, error } = await supabase.from('title_shop').select('*').eq('is_available', true).order('cost', { ascending: true }); if (error) throw error; return data || []; } catch (e) { console.error("Error fetching title shop:", e); return []; } }
    async function fetchAvatarDecorationsData() { if (!supabase) return []; try { const { data, error } = await supabase.from('avatar_decorations_shop').select('*').eq('is_available', true).order('cost', { ascending: true }); if (error) throw error; return data || []; } catch (e) { console.error("Error fetching avatar decorations:", e); return []; } }
    async function fetchLeaderboardData() { if (!supabase) return []; try { const { data, error } = await supabase.from('leaderboard').select(`rank, user_id, points, badges_count, profile:profiles!inner(id, first_name, last_name, username, avatar_url, level, streak_days, selected_title)`).eq('period', 'overall').order('rank', { ascending: true }).limit(LEADERBOARD_LIMIT); if (error) throw error; const rankedData = (data || []).map((entry, index) => ({ ...entry, calculated_rank: entry.rank ?? (index + 1) })); return rankedData; } catch (e) { console.error("Error fetching leaderboard:", e); return []; } }
    async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) { if (!supabase || !userId) return { unreadCount: 0, notifications: [] }; try { const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; return { unreadCount: count ?? 0, notifications: data || [] }; } catch (e) { console.error("Error fetching notifications:", e); return { unreadCount: 0, notifications: [] }; } }
    // --- END: Data Fetching Functions ---

    // --- START: Data Rendering Functions ---
    const badgeVisuals = { math: { icon: 'fa-square-root-alt', gradient: 'var(--gradient-math)' }, language: { icon: 'fa-language', gradient: 'var(--gradient-lang)' }, streak: { icon: 'fa-fire', gradient: 'var(--gradient-streak)' }, special: { icon: 'fa-star', gradient: 'var(--gradient-special)' }, points: { icon: 'fa-coins', gradient: 'var(--gradient-warning)' }, exercises: { icon: 'fa-pencil-alt', gradient: 'var(--gradient-success)' }, test: { icon: 'fa-vial', gradient: 'var(--gradient-info)' }, default: { icon: 'fa-medal', gradient: 'var(--gradient-locked)' } };
    const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };
    function updateSidebarProfile(profile, titlesData) { if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) return; if (profile) { const firstName = profile.first_name ?? ''; const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = sanitizeHTML(displayName); const initials = getInitials(profile); const avatarUrl = profile.avatar_url; const selectedDecoration = profile.selected_decoration || ''; const avatarWrapper = ui.sidebarAvatar.closest('.avatar-wrapper'); if (avatarWrapper) { const decorationClasses = (allDecorations || []).map(d => d.decoration_key); avatarWrapper.classList.remove(...decorationClasses); if (selectedDecoration) avatarWrapper.classList.add(sanitizeHTML(selectedDecoration)); avatarWrapper.dataset.decorationKey = selectedDecoration; } ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials); const selectedTitleKey = profile.selected_title; let displayTitle = 'Pilot'; if (selectedTitleKey && titlesData && titlesData.length > 0) { const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey); if (foundTitle && foundTitle.name) displayTitle = foundTitle.name; } ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle); ui.sidebarUserTitle.title = sanitizeHTML(displayTitle); } else { ui.sidebarName.textContent = "Pilot"; ui.sidebarAvatar.textContent = '?'; ui.sidebarUserTitle.textContent = 'Pilot'; ui.sidebarUserTitle.removeAttribute('title'); const avatarWrapper = ui.sidebarAvatar?.closest('.avatar-wrapper'); if(avatarWrapper) { const decorationClasses = (allDecorations || []).map(d => d.decoration_key); avatarWrapper.classList.remove(...decorationClasses); avatarWrapper.dataset.decorationKey = ''; } } }
    function updateStatsCards(stats) { if (!stats) { console.warn("No stats data to update cards."); return; } const getVal = (v) => (v !== null && v !== undefined) ? v : '-'; if (ui.badgesCount) ui.badgesCount.textContent = getVal(stats.badges); if (ui.pointsCount) ui.pointsCount.textContent = getVal(stats.points); if (ui.streakDays) ui.streakDays.textContent = getVal(stats.streak_current); if (ui.streakChange) ui.streakChange.textContent = `MAX: ${getVal(stats.streak_longest)} dní`; if (ui.rankValue) ui.rankValue.textContent = getVal(stats.rank); if (ui.rankChange && ui.totalUsers) ui.rankChange.innerHTML = `<i class="fas fa-users"></i> z ${getVal(stats.totalUsers)} pilotů`; if (ui.badgesCard) ui.badgesCard.classList.remove('loading'); if (ui.pointsCard) ui.pointsCard.classList.remove('loading'); if (ui.streakCard) ui.streakCard.classList.remove('loading'); if (ui.rankCard) ui.rankCard.classList.remove('loading'); }
    function renderUserBadges(earnedBadges) { setLoadingState('userBadges', false); if (!ui.badgeGrid || !ui.emptyBadges) return; ui.badgeGrid.innerHTML = ''; if (!earnedBadges || earnedBadges.length === 0) { ui.emptyBadges.style.display = 'block'; ui.badgeGrid.style.display = 'none'; return; } ui.emptyBadges.style.display = 'none'; ui.badgeGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); earnedBadges.forEach((ub, index) => { const badge = ub.badge; if (!badge) return; const badgeType = badge.type?.toLowerCase() || 'default'; const visual = badgeVisuals[badgeType] || badgeVisuals.default; const badgeElement = document.createElement('div'); badgeElement.className = 'badge-card card'; badgeElement.setAttribute('data-animate', ''); badgeElement.style.setProperty('--animation-order', index); badgeElement.innerHTML = `<div class="badge-icon ${badgeType}" style="background: ${visual.gradient};"><i class="fas ${visual.icon}"></i></div><h3 class="badge-title">${sanitizeHTML(badge.title)}</h3><p class="badge-desc">${sanitizeHTML(badge.description || '')}</p><div class="badge-date"><i class="far fa-calendar-alt"></i> ${formatDate(ub.earned_at)}</div>`; fragment.appendChild(badgeElement); }); ui.badgeGrid.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
    function renderAvailableBadges(allBadgesDef, userEarnedBadges) { setLoadingState('availableBadges', false); if (!ui.availableBadgesGrid || !ui.emptyAvailableBadges) return; const earnedIds = new Set((userEarnedBadges || []).map(ub => ub.badge_id)); const available = (allBadgesDef || []).filter(b => !earnedIds.has(b.id)); ui.availableBadgesGrid.innerHTML = ''; if (available.length === 0) { ui.emptyAvailableBadges.style.display = 'block'; ui.availableBadgesGrid.style.display = 'none'; return; } ui.emptyAvailableBadges.style.display = 'none'; ui.availableBadgesGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); available.forEach((badge, index) => { const badgeType = badge.type?.toLowerCase() || 'default'; const visual = badgeVisuals[badgeType] || badgeVisuals.default; let progress = 0; let progressText = '???'; const req = badge.requirements; if (req && typeof req === 'object' && currentProfile) { const target = parseInt(req.target, 10) || 1; let current = 0; try { switch (req.type) { case 'points_earned': current = currentProfile.points ?? 0; progressText = `${current}/${target} KR`; break; case 'streak_days': current = currentProfile.streak_days ?? 0; progressText = `${current}/${target} dní`; break; case 'exercises_completed': current = currentProfile.completed_exercises ?? 0; progressText = `${current}/${target} cv.`; break; case 'level_reached': current = currentProfile.level ?? 1; progressText = `${current}/${target} úr.`; break; default: progressText = '?/?'; } if (target > 0) progress = Math.min(100, Math.max(0, Math.round((current / target) * 100))); } catch(e) { progressText = 'Chyba'; } } else { progressText = 'Nespec.'; } const badgeElement = document.createElement('div'); badgeElement.className = 'achievement-card card'; badgeElement.setAttribute('data-animate', ''); badgeElement.style.setProperty('--animation-order', index); badgeElement.innerHTML = `<div class="achievement-icon ${badgeType}" style="background: ${visual.gradient};"><i class="fas ${visual.icon}"></i></div><div class="achievement-content"><h3 class="achievement-title">${sanitizeHTML(badge.title)}</h3><p class="achievement-desc">${sanitizeHTML(badge.description || '')}</p><div class="progress-container"><div class="progress-bar"><div class="progress-fill" style="width: ${progress}%; background: ${visual.gradient};"></div></div><div class="progress-stats">${progress}% (${progressText})</div></div></div>`; fragment.appendChild(badgeElement); }); ui.availableBadgesGrid.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
    function renderLeaderboard(data) { setLoadingState('leaderboard', false); if (!ui.leaderboardBody || !ui.leaderboardEmpty || !ui.leaderboardTableContainer) return; ui.leaderboardBody.innerHTML = ''; if (!data || data.length === 0) { ui.leaderboardEmpty.style.display = 'block'; ui.leaderboardTableContainer.style.display = 'none'; } else { ui.leaderboardEmpty.style.display = 'none'; ui.leaderboardTableContainer.style.display = 'block'; const fragment = document.createDocumentFragment(); data.forEach((entry) => { const userProf = entry.profile; if (!userProf) return; const rank = entry.calculated_rank || '?'; const isCurrent = entry.user_id === currentUser?.id; const displayName = `${userProf.first_name || ''} ${userProf.last_name || ''}`.trim() || userProf.username || `Pilot #${entry.user_id.substring(0, 4)}`; const initials = getInitials(userProf); const avatarUrl = userProf.avatar_url; const pointsVal = entry.points ?? 0; const badgesCnt = entry.badges_count ?? 0; const streakVal = userProf.streak_days ?? 0; const decorationKey = userProf.selected_decoration || ''; const rowEl = document.createElement('tr'); if (isCurrent) rowEl.classList.add('highlight-row'); rowEl.innerHTML = `<td class="rank-cell">${rank}</td><td class="user-cell"><div class="avatar-wrapper ${sanitizeHTML(decorationKey)}" data-decoration-key="${sanitizeHTML(decorationKey)}"><div class="user-avatar-sm">${avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(displayName)}">` : sanitizeHTML(initials)}</div></div><div class="user-info-sm"><div class="user-name-sm">${sanitizeHTML(displayName)}</div><div class="user-level">Úroveň ${userProf.level || 1}</div></div></td><td class="score-cell">${pointsVal}</td><td class="badge-count-cell">${badgesCnt}</td><td class="streak-cell">${streakVal}</td>`; fragment.appendChild(rowEl); }); ui.leaderboardBody.appendChild(fragment); } }
    function renderTitleShop(titles, profile) { setLoadingState('titleShop', false); if (!ui.titleShopGrid || !ui.titleShopEmpty || !ui.shopUserCredits || !profile) return; ui.shopUserCredits.textContent = profile.points ?? 0; ui.titleShopGrid.innerHTML = ''; if (!titles || titles.length === 0) { ui.titleShopEmpty.style.display = 'block'; ui.titleShopGrid.style.display = 'none'; return; } ui.titleShopEmpty.style.display = 'none'; ui.titleShopGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); const purchasedKeys = new Set(profile.purchased_titles || []); const selectedKey = profile.selected_title; titles.forEach((title, index) => { const isPurchased = purchasedKeys.has(title.title_key); const isEquipped = isPurchased && title.title_key === selectedKey; const canAfford = profile.points >= title.cost; const itemElement = document.createElement('div'); itemElement.className = 'title-item card'; itemElement.setAttribute('data-title-key', title.title_key); itemElement.setAttribute('data-title-cost', title.cost); itemElement.setAttribute('data-animate', ''); itemElement.style.setProperty('--animation-order', index); itemElement.innerHTML = `<div class="title-item-icon"><i class="${sanitizeHTML(title.icon || 'fas fa-user-tag')}"></i></div><div class="title-item-content"><h4 class="title-item-name">${sanitizeHTML(title.name)}</h4>${title.description ? `<p class="title-item-desc">${sanitizeHTML(title.description)}</p>` : ''}<div class="title-item-footer"><span class="title-item-cost">Cena: ${title.cost} <i class="fas fa-coins"></i></span><div class="title-item-actions"><button class="btn btn-sm btn-primary buy-title-btn" ${isPurchased ? 'style="display: none;"' : ''} ${canAfford ? '' : 'disabled'} title="${canAfford ? 'Koupit titul' : 'Nedostatek kreditů'}"><i class="fas fa-shopping-cart"></i> Koupit</button><span class="title-status purchased" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-check"></i> Zakoupeno</span><span class="title-status equipped" ${isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-user-check"></i> Používá se</span><button class="btn btn-sm btn-secondary equip-title-btn" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-check-square"></i> Použít</button></div></div></div>`; fragment.appendChild(itemElement); }); ui.titleShopGrid.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
    function renderAvatarDecorationsShop(decorations, profile) { setLoadingState('avatarDecorations', false); if (!ui.avatarDecorationsGrid || !ui.avatarDecorationsEmpty || !ui.shopDecorCredits || !profile) return; ui.shopDecorCredits.textContent = profile.points ?? 0; ui.avatarDecorationsGrid.innerHTML = ''; if (!decorations || decorations.length === 0) { ui.avatarDecorationsEmpty.style.display = 'block'; ui.avatarDecorationsGrid.style.display = 'none'; return; } ui.avatarDecorationsEmpty.style.display = 'none'; ui.avatarDecorationsGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); const purchasedKeys = new Set(profile.purchased_decorations || []); const selectedKey = profile.selected_decoration; const userInitials = getInitials(profile); const userAvatarUrl = profile.avatar_url; decorations.forEach((decor, index) => { const isPurchased = purchasedKeys.has(decor.decoration_key); const isEquipped = isPurchased && decor.decoration_key === selectedKey; const canAfford = profile.points >= decor.cost; const itemElement = document.createElement('div'); itemElement.className = 'decoration-item card'; itemElement.setAttribute('data-decoration-key', decor.decoration_key); itemElement.setAttribute('data-decoration-cost', decor.cost); itemElement.setAttribute('data-animate', ''); itemElement.style.setProperty('--animation-order', index); const previewAvatarHTML = userAvatarUrl ? `<img src="${sanitizeHTML(userAvatarUrl)}?t=${Date.now()}" alt="Avatar">` : sanitizeHTML(userInitials); itemElement.innerHTML = `<div class="decoration-preview"><div class="avatar-wrapper ${sanitizeHTML(decor.decoration_key)}"><div class="user-avatar-sm">${previewAvatarHTML}</div></div></div><div class="decoration-info"><h4 class="decoration-name">${sanitizeHTML(decor.name)}</h4><p class="decoration-desc">${sanitizeHTML(decor.description || '')}</p><div class="decoration-footer"><span class="decoration-cost">Cena: ${decor.cost} <i class="fas fa-coins"></i></span><div class="decoration-actions"><button class="btn btn-sm btn-primary buy-decor-btn" ${isPurchased ? 'style="display: none;"' : ''} ${canAfford ? '' : 'disabled'} title="${canAfford ? 'Koupit vylepšení' : 'Nedostatek kreditů'}"><i class="fas fa-shopping-cart"></i> Koupit</button><span class="title-status purchased" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-check"></i> Zakoupeno</span><span class="title-status equipped" ${isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-user-check"></i> Používá se</span><button class="btn btn-sm btn-secondary equip-decor-btn" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-check-square"></i> Použít</button></div></div></div>`; fragment.appendChild(itemElement); }); ui.avatarDecorationsGrid.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
    function renderNotifications(count, notifications) { setLoadingState('notifications', false); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) return; ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } }
    // --- END: Data Rendering Functions ---

    // --- START: Shop Interaction Logic ---
    async function handleShopInteraction(event) { const buyTitleButton = event.target.closest('.buy-title-btn'); const equipTitleButton = event.target.closest('.equip-title-btn'); const buyDecorButton = event.target.closest('.buy-decor-btn'); const equipDecorButton = event.target.closest('.equip-decor-btn'); if (buyTitleButton) { const itemEl = buyTitleButton.closest('.title-item'); const key = itemEl?.dataset.titleKey; const cost = parseInt(itemEl?.dataset.titleCost, 10); if (key && !isNaN(cost)) handleBuyItem('title', key, cost, buyTitleButton); else showToast('Chyba: Nelze identifikovat titul.', 'error'); } else if (equipTitleButton) { const itemEl = equipTitleButton.closest('.title-item'); const key = itemEl?.dataset.titleKey; if (key) handleEquipItem('title', key, equipTitleButton); else showToast('Chyba: Nelze identifikovat titul.', 'error'); } else if (buyDecorButton) { const itemEl = buyDecorButton.closest('.decoration-item'); const key = itemEl?.dataset.decorationKey; const cost = parseInt(itemEl?.dataset.decorationCost, 10); if (key && !isNaN(cost)) handleBuyItem('decoration', key, cost, buyDecorButton); else showToast('Chyba: Nelze identifikovat dekoraci.', 'error'); } else if (equipDecorButton) { const itemEl = equipDecorButton.closest('.decoration-item'); const key = itemEl?.dataset.decorationKey; if (key) handleEquipItem('decoration', key, equipDecorButton); else showToast('Chyba: Nelze identifikovat dekoraci.', 'error'); } }
    async function handleBuyItem(itemType, itemKey, cost, buttonElement) { if (!currentProfile || !supabase || !currentUser || isLoading.buyEquip) return; const currentCredits = currentProfile.points ?? 0; if (currentCredits < cost) { showToast('Nedostatek Kreditů', `Potřebujete ${cost} kreditů.`, 'warning'); return; } const itemData = (itemType === 'title' ? allTitles : allDecorations).find(it => it[itemType === 'title' ? 'title_key' : 'decoration_key'] === itemKey); const itemName = itemData?.name || itemKey; const itemTypeName = itemType === 'title' ? 'titul' : 'vylepšení'; if (!confirm(`Opravdu koupit ${itemTypeName} "${itemName}" za ${cost} kreditů?`)) return; setLoadingState('buyEquip', true); buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; const purchaseField = itemType === 'title' ? 'purchased_titles' : 'purchased_decorations'; try { const currentPurchased = Array.isArray(currentProfile[purchaseField]) ? currentProfile[purchaseField] : []; if (currentPurchased.includes(itemKey)) { showToast('Již Vlastněno', `Tento ${itemTypeName} již máte.`, 'info'); return; } const newCredits = currentCredits - cost; const newPurchasedItems = [...currentPurchased, itemKey]; const updatePayload = { points: newCredits, [purchaseField]: newPurchasedItems }; const { data: updatedProfile, error: updateError } = await supabase.from('profiles').update(updatePayload).eq('id', currentUser.id).select('*, selected_title, purchased_titles, purchased_decorations, selected_decoration').single(); if (updateError) throw updateError; currentProfile = updatedProfile; // Update local profile
        if(itemType === 'title') renderTitleShop(allTitles, currentProfile); else renderAvatarDecorationsShop(allDecorations, currentProfile); updateSidebarProfile(currentProfile, allTitles); // Update sidebar
        if (ui.shopUserCredits) ui.shopUserCredits.textContent = currentProfile.points; if (ui.shopDecorCredits) ui.shopDecorCredits.textContent = currentProfile.points; if (ui.pointsCount) ui.pointsCount.textContent = currentProfile.points; showToast('Nákup Úspěšný', `${itemTypeName} "${itemName}" zakoupen!`, 'success'); } catch (error) { console.error(`Error buying ${itemType}:`, error); showToast('Chyba Nákupu', error.message, 'error'); buttonElement.disabled = false; buttonElement.innerHTML = '<i class="fas fa-shopping-cart"></i> Koupit'; } finally { setLoadingState('buyEquip', false); const stillOwned = (currentProfile[purchaseField] || []).includes(itemKey); if (stillOwned) buttonElement.style.display = 'none'; else if (currentProfile.points < cost) buttonElement.disabled = true; } }
    async function handleEquipItem(itemType, itemKey, buttonElement) { if (!currentProfile || !supabase || !currentUser || isLoading.buyEquip) return; const purchaseField = itemType === 'title' ? 'purchased_titles' : 'purchased_decorations'; const selectField = itemType === 'title' ? 'selected_title' : 'selected_decoration'; const purchasedKeys = Array.isArray(currentProfile[purchaseField]) ? currentProfile[purchaseField] : []; const itemTypeName = itemType === 'title' ? 'titul' : 'vylepšení'; if (!purchasedKeys.includes(itemKey)) { showToast('Chyba', `Tento ${itemTypeName} nemáte zakoupený.`, 'error'); return; } if (currentProfile[selectField] === itemKey) { showToast('Již Používáte', `Tento ${itemTypeName} již máte nastavený.`, 'info'); return; } setLoadingState('buyEquip', true); buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; try { const { data: updatedProfile, error: updateError } = await supabase.from('profiles').update({ [selectField]: itemKey }).eq('id', currentUser.id).select('*, selected_title, purchased_titles, purchased_decorations, selected_decoration').single(); if (updateError) throw updateError; currentProfile = updatedProfile; // Update local profile
        if(itemType === 'title') renderTitleShop(allTitles, currentProfile); else renderAvatarDecorationsShop(allDecorations, currentProfile); updateSidebarProfile(currentProfile, allTitles); // Update sidebar
        const itemData = (itemType === 'title' ? allTitles : allDecorations).find(it => it[itemType === 'title' ? 'title_key' : 'decoration_key'] === itemKey); const itemName = itemData?.name || itemKey; showToast('Položka Nastavena', `Nyní používáte ${itemTypeName} "${itemName}".`, 'success'); } catch (error) { console.error(`Error equipping ${itemType}:`, error); showToast('Chyba Nastavení', error.message, 'error'); } finally { setLoadingState('buyEquip', false); buttonElement.disabled = false; buttonElement.innerHTML = '<i class="fas fa-check-square"></i> Použít'; const stillSelected = currentProfile[selectField] === itemKey; const stillOwned = (currentProfile[purchaseField] || []).includes(itemKey); if (stillSelected || !stillOwned) buttonElement.style.display = 'none'; } }
    // --- END: Shop Interaction Logic ---

    // --- START: Notification Logic ---
    async function handleNotificationClick(event) { const item = event.target.closest('.notification-item'); if (!item) return; const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId && supabase) { try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } catch (error) { console.error("Mark notification read error:", error); showToast('Chyba označení oznámení.', 'error'); } } if (link) window.location.href = link; }
    async function handleMarkAllReadClick() { if (!currentUser || !ui.markAllReadBtn || !supabase || isLoading.notifications) return; setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false); if (error) throw error; const { unreadCount, notifications } = await fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('Oznámení označena jako přečtená.', 'success'); } catch (error) { console.error("Mark all read error:", error); showToast('Chyba při označování oznámení.', 'error'); } finally { setLoadingState('notifications', false); } }
    // --- END: Notification Logic ---

    // --- START: Load All Data ---
    async function loadAllAwardData() { if (!currentUser || !currentProfile || !supabase) { showError("Chyba: Nelze načíst data ocenění bez profilu uživatele.", true); setLoadingState('all', false); return; } console.log("🔄 [LoadAwards] Loading all award page data..."); hideError(); setLoadingState('all', true); try { const results = await Promise.allSettled([ fetchUserStats(currentUser.id, currentProfile), fetchAllBadgesDefinition(), fetchUserEarnedBadges(currentUser.id), fetchTitleShopData(), fetchAvatarDecorationsData(), fetchLeaderboardData(), fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT) ]); console.log("[LoadAwards] Data fetch results:", results); const [statsResult, allBadgesResult, userBadgesResult, titleShopResult, avatarShopResult, leaderboardResult, notificationsResult] = results; userStatsData = (statsResult.status === 'fulfilled') ? statsResult.value : null; allBadges = (allBadgesResult.status === 'fulfilled') ? allBadgesResult.value : []; userBadges = (userBadgesResult.status === 'fulfilled') ? userBadgesResult.value : []; allTitles = (titleShopResult.status === 'fulfilled') ? titleShopResult.value : []; allDecorations = (avatarShopResult.status === 'fulfilled') ? avatarShopResult.value : []; leaderboardData = (leaderboardResult.status === 'fulfilled') ? leaderboardResult.value : []; const { unreadCount, notifications } = (notificationsResult.status === 'fulfilled') ? notificationsResult.value : { unreadCount: 0, notifications: [] }; updateStatsCards(userStatsData); // Use combined stats
        renderUserBadges(userBadges); renderAvailableBadges(allBadges, userBadges); renderLeaderboard(leaderboardData); renderTitleShop(allTitles, currentProfile); renderAvatarDecorationsShop(allDecorations, currentProfile); renderNotifications(unreadCount, notifications); updateSidebarProfile(currentProfile, allTitles); console.log("✅ [LoadAwards] All award page data loaded and rendered."); } catch (error) { console.error("❌ [LoadAwards] Error during loading award data:", error); showError(`Nepodařilo se načíst data pro stránku Ocenění: ${error.message}`, true); } finally { setLoadingState('all', false); initTooltips(); } }
    // --- END: Load All Data ---

    // --- START: Event Listeners Setup ---
    function setupEventListeners() { console.log("[Oceneni SETUP] Setting up event listeners..."); const safeAddListener = (el, ev, fn, key) => { if (el) el.addEventListener(ev, fn); else console.warn(`[SETUP] Element not found for listener: ${key}`); }; safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle'); safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle'); safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay'); safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn'); safeAddListener(ui.refreshDataBtn, 'click', loadAllAwardData, 'refreshDataBtn'); safeAddListener(ui.notificationBell, 'click', (e) => { e.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell'); safeAddListener(ui.markAllReadBtn, 'click', handleMarkAllReadClick, 'markAllReadBtn'); safeAddListener(ui.notificationsList, 'click', handleNotificationClick, 'notificationsList'); safeAddListener(ui.titleShopGrid, 'click', handleShopInteraction, 'titleShopGrid'); safeAddListener(ui.avatarDecorationsGrid, 'click', handleShopInteraction, 'avatarDecorationsGrid'); document.querySelectorAll('.sidebar-link').forEach(l => l.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); })); window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus); document.addEventListener('click', (e) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(e.target) && !ui.notificationBell?.contains(e.target)) { ui.notificationsDropdown.classList.remove('active'); } }); console.log("[Oceneni SETUP] Event listeners setup complete."); }
    // --- END: Event Listeners Setup ---

    // --- START: Initialization ---
    async function initializeApp() {
        console.log("🚀 [Init Oceneni v23.15] Starting...");
        cacheDOMElements(); // Cache elements first
        if (!initializeSupabase()) { // Initialize Supabase FIRST
            console.error("[Init Oceneni] Supabase initialization failed. Aborting.");
            return;
        }
        applyInitialSidebarState(); // Apply sidebar state early
        if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
        if (ui.mainContent) ui.mainContent.style.display = 'none';
        hideError();

        try {
            console.log("[Init Oceneni] Checking auth session...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);
            if (!session || !session.user) { window.location.href = '/auth/index.html'; return; }
            currentUser = session.user;
            console.log(`[Init Oceneni] User authenticated (ID: ${currentUser.id}). Loading profile...`);

            currentProfile = await fetchUserProfile(currentUser.id); // Fetch profile AFTER supabase is init
            if (!currentProfile) throw new Error("Nepodařilo se načíst profil uživatele.");

            // Fetch titles AFTER profile is loaded (needed for sidebar update)
             allTitles = await fetchTitles();

            updateSidebarProfile(currentProfile, allTitles); // Update sidebar immediately
            setupEventListeners(); // Setup listeners AFTER caching and Supabase init
            initMouseFollower();
            initHeaderScrollDetection();
            updateCopyrightYear();
            updateOnlineStatus();
            await loadAllAwardData(); // Load the rest of the page data

            if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
            if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
            initTooltips();

            console.log("✅ [Init Oceneni] Page initialized.");
        } catch (error) {
             console.error("❌ [Init Oceneni] Kritická chyba inicializace:", error);
             if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE.</p>`; }
             else { showError(`Chyba inicializace: ${error.message}`, true); }
             if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show error container
             setLoadingState('all', false); // Ensure loading state is off
        }
    }

    function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded."); } supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); if (!supabase) throw new Error("Supabase client creation failed."); console.log('[Supabase] Client initialized.'); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }
    // --- END: Initialization ---

    // --- Run ---
    initializeApp();

})(); // End IIFE