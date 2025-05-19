// dashboard/oceneni.js
// Version: 23.23.1 - Fixed TypeError in setupEventListeners for section toggles.
(function() { // IIFE for scope isolation
    'use strict';

    // --- START: Configuration ---
    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    const NOTIFICATION_FETCH_LIMIT = 5;
    const LEADERBOARD_LIMIT = 10;
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';
    const DAILY_TITLE_SHOP_COUNT = 6;
    // --- END: Configuration ---

    // --- START: State Variables ---
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let userStatsData = null;
    let userBadges = [];
    let allBadges = [];
    let allTitlesFromDB = []; 
    let titleShopTitles = [];   
    let allDecorations = [];
    let leaderboardData = [];
    let currentLeaderboardPeriod = 'overall';
    let isLoading = {
        stats: false, userBadges: false, availableBadges: false,
        leaderboard: false, titleShop: false, avatarDecorations: false,
        notifications: false, buyEquip: false, all: false, titles: false,
        userTitlesInventory: false 
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
            'mark-all-read', 
            'global-error', 'offline-banner', 'toast-container',
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
            'badges-card', 'points-card', 'streak-card', 'rank-card',
            'leaderboard-skeleton', 'leaderboard-header', 'leaderboard-table-container',
            'user-titles-inventory-container', 'user-titles-inventory-grid', 
            'user-titles-inventory-empty', 'user-titles-inventory-loading',
            'toggle-user-badges-section', 'toggle-available-badges-section',
            'toggle-user-titles-section', 'toggle-title-shop-section',
            'toggle-avatar-decorations-section', 'toggle-leaderboard-section'
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
        
        // Define content areas for toggling - these should be general content wrappers WITHIN the section cards
        ui.userBadgesContent = ui.userBadgesContainer?.querySelector('.section-collapsible-content');
        ui.availableBadgesContent = ui.availableBadgesContainer?.querySelector('.section-collapsible-content');
        ui.userTitlesInventoryContent = ui.userTitlesInventoryContainer?.querySelector('.section-collapsible-content');
        ui.titleShopContent = ui.titleShopContainer?.querySelector('.section-collapsible-content');
        ui.avatarDecorationsContent = ui.avatarDecorationsShop?.querySelector('.section-collapsible-content');
        ui.leaderboardContent = ui.leaderboardContainer?.querySelector('.section-collapsible-content');


        if (!ui.sidebarUserTitle) {
            const roleEl = document.getElementById('sidebar-user-role');
            if(roleEl) ui.sidebarUserTitle = roleEl;
            else if (!notFound.includes('sidebar-user-title')) notFound.push('sidebar-user-title/role');
        }
        if (notFound.length > 0) {
            console.warn(`[Oceneni Cache DOM] Elements not found: (${notFound.length})`, notFound);
        }
        console.log("[Oceneni Cache DOM] Caching complete.");
    }
    // --- END: UI Elements Cache ---

    // --- START: Helper Functions ---
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
    
    function getSeededSortValue(seedString) {
        let hash = 0;
        if (!seedString || seedString.length === 0) return hash;
        for (let i = 0; i < seedString.length; i++) {
            const char = seedString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; 
        }
        return Math.abs(hash); 
    }
    // --- END: Helper Functions ---

    // --- START: Sidebar Logic ---
    function toggleSidebar() { if (!ui.sidebarToggleBtn) return; try { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (error) { console.error("[Sidebar Toggle] Error:", error); } }
    function applyInitialSidebarState() { if (!ui.sidebarToggleBtn) return; try { const savedState = localStorage.getItem(SIDEBAR_STATE_KEY); const shouldBeCollapsed = savedState === 'collapsed'; if (shouldBeCollapsed) document.body.classList.add('sidebar-collapsed'); else document.body.classList.remove('sidebar-collapsed'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; ui.sidebarToggleBtn.setAttribute('aria-label', shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'); ui.sidebarToggleBtn.title = shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel'; } catch (error) { console.error("[Sidebar State] Error applying initial state:", error); document.body.classList.remove('sidebar-collapsed'); } }
    // --- END: Sidebar Logic ---

    // --- START: Loading State Management ---
    function setLoadingState(sectionKey, isLoadingFlag) {
        if (isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;

        const updateSingleSection = (key, loading) => {
            if (isLoading[key] === loading && key !== 'all') return;
            isLoading[key] = loading;
            console.log(`[SetLoading Oceneni] ${key}: ${loading}`);

            const sectionMap = {
                stats: { container: ui.achievementStatsContainer, childrenSelector: '.stat-card' },
                userBadges: { container: ui.userBadgesContainer, emptyEl: ui.emptyBadges, contentEl: ui.badgeGrid, skeletonFn: renderBadgeSkeletons, skeletonCount: 6 },
                availableBadges: { container: ui.availableBadgesContainer, emptyEl: ui.emptyAvailableBadges, contentEl: ui.availableBadgesGrid, skeletonFn: renderAvailableBadgeSkeletons, skeletonCount: 4 },
                leaderboard: { container: ui.leaderboardContainer, emptyEl: ui.leaderboardEmpty, contentEl: ui.leaderboardTableContainer, skeletonEl: ui.leaderboardSkeleton, headerEl: ui.leaderboardHeader, skeletonFn: renderLeaderboardSkeleton },
                titleShop: { container: ui.titleShopContainer, emptyEl: ui.titleShopEmpty, contentEl: ui.titleShopGrid, loadingEl: ui.titleShopLoading, skeletonFn: renderTitleShopSkeleton, skeletonCount: DAILY_TITLE_SHOP_COUNT },
                avatarDecorations: { container: ui.avatarDecorationsShop, emptyEl: ui.avatarDecorationsEmpty, contentEl: ui.avatarDecorationsGrid, loadingEl: ui.avatarDecorationsLoading, skeletonFn: renderAvatarDecorationsSkeleton, skeletonCount: 4 },
                notifications: { container: ui.notificationsList, emptyEl: ui.noNotificationsMsg, skeletonFn: renderNotificationSkeletons, skeletonCount: 2 },
                userTitlesInventory: { container: ui.userTitlesInventoryContainer, emptyEl: ui.userTitlesInventoryEmpty, contentEl: ui.userTitlesInventoryGrid, loadingEl: ui.userTitlesInventoryLoading, skeletonFn: renderUserTitlesInventorySkeletons, skeletonCount: 4 },
                buyEquip: {}, 
                titles: {}    
            };

            const config = sectionMap[key];
            if (!config) return;

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
                if (config.skeletonFn) {
                    const targetContainer = contentEl || (key === 'leaderboard' ? null : config.container); 
                    if (targetContainer || key === 'leaderboard') {
                         config.skeletonFn(targetContainer, config.skeletonCount);
                    }
                }
            }
             if (key === 'notifications' && ui.notificationBell) {
                 ui.notificationBell.style.opacity = loading ? 0.5 : 1;
                 if (ui.markAllRead) { 
                     const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                     ui.markAllRead.disabled = loading || currentUnreadCount === 0;
                 }
             }
        };

        if (sectionKey === 'all') {
            Object.keys(isLoading).forEach(key => {
                if (key !== 'all') updateSingleSection(key, isLoadingFlag);
            });
            isLoading.all = isLoadingFlag;
        } else {
            updateSingleSection(sectionKey, isLoadingFlag);
        }
    }
    // --- END: Loading State Management ---

    // --- START: Skeleton Rendering Functions ---
    function renderStatsSkeletons(container) { /* Only toggles class on parent */ }
    function renderBadgeSkeletons(container = ui.badgeGrid, count = 6) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let s = ''; for (let i = 0; i < count; i++) s += `<div class="badge-card card loading"><div class="loading-skeleton" style="display: flex !important; flex-direction: column; align-items: center; padding: 1.8rem 1.2rem;"><div class="skeleton badge-icon-placeholder" style="width: 70px; height: 70px; border-radius: 50%; margin-bottom: 1.2rem;"></div><div class="skeleton badge-title-placeholder" style="height: 16px; width: 70%; margin-bottom: 0.5rem;"></div><div class="skeleton badge-desc-placeholder" style="height: 12px; width: 90%; margin-bottom: 0.4rem;"></div><div class="skeleton badge-desc-placeholder" style="height: 12px; width: 80%; margin-bottom: 0.8rem;"></div><div class="skeleton badge-date-placeholder" style="height: 12px; width: 50%; margin-top: auto;"></div></div></div>`; container.innerHTML = s; }
    function renderAvailableBadgeSkeletons(container = ui.availableBadgesGrid, count = 4) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let s = ''; for (let i = 0; i < count; i++) s += `<div class="achievement-card card loading"><div class="loading-skeleton" style="display: flex !important;"><div class="skeleton achievement-icon-placeholder" style="width: 60px; height: 60px; border-radius: 16px; flex-shrink: 0;"></div><div class="skeleton achievement-content-placeholder" style="flex-grow: 1;"><div class="skeleton achievement-title-placeholder" style="height: 18px; width: 60%; margin-bottom: 0.6rem;"></div><div class="skeleton achievement-desc-placeholder" style="height: 14px; width: 95%; margin-bottom: 0.4rem;"></div><div class="skeleton achievement-desc-placeholder" style="height: 14px; width: 80%; margin-bottom: 0.8rem;"></div><div class="skeleton achievement-progress-placeholder" style="height: 20px; width: 100%;"></div></div></div></div>`; container.innerHTML = s; }
    function renderLeaderboardSkeleton() { if (ui.leaderboardSkeleton) ui.leaderboardSkeleton.style.display = 'block'; }
    function renderTitleShopSkeleton(container = ui.titleShopGrid, count = DAILY_TITLE_SHOP_COUNT) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let s = ''; for(let i = 0; i < count; i++) s += `<div class="title-item card loading"><div class="loading-skeleton" style="display: flex !important;"><div style="display: flex; gap: 1.2rem; align-items: flex-start; width: 100%;"><div class="skeleton" style="width: 60px; height: 60px; border-radius: 14px; flex-shrink: 0;"></div><div style="flex-grow: 1;"><div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 0.7rem;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 14px; width: 75%;"></div></div></div></div></div>`; container.innerHTML = s; }
    function renderAvatarDecorationsSkeleton(container = ui.avatarDecorationsGrid, count = 4) { if (!container) return; container.innerHTML = ''; container.style.display = 'grid'; let s = ''; for(let i = 0; i < count; i++) s += `<div class="decoration-item card loading"><div class="loading-skeleton" style="display: flex !important; flex-direction: column; align-items: center; padding:1rem;"><div class="skeleton" style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 1rem auto;"></div><div class="skeleton" style="height: 18px; width: 70%; margin: 0 auto 0.7rem auto;"></div><div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div><div class="skeleton" style="height: 14px; width: 80%;"></div><div style="margin-top: 1rem; padding-top: 0.8rem; border-top: 1px solid transparent; display: flex; justify-content: space-between; align-items: center; width:100%;"><div class="skeleton" style="height: 16px; width: 70px;"></div><div class="skeleton" style="height: 30px; width: 90px; border-radius: var(--button-radius);"></div></div></div></div>`; container.innerHTML = s; }
    function renderNotificationSkeletons(container = ui.notificationsList, count = 2) { if (!container) return; container.innerHTML = ''; container.style.display = 'block'; let s = ''; for (let i = 0; i < count; i++) s += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height:16px;width:70%;margin-bottom:6px;"></div><div class="skeleton" style="height:12px;width:90%;"></div><div class="skeleton" style="height:10px;width:40%;margin-top:6px;"></div></div></div>`; container.innerHTML = s; }
    function renderUserTitlesInventorySkeletons(container = ui.userTitlesInventoryGrid, count = 4) {
        if (!container) {
            console.warn("[Skeletons] User Titles Inventory container not found.");
            return;
        }
        container.innerHTML = '';
        container.style.display = 'grid'; 
        let skeletonHTML = '';
        for (let i = 0; i < count; i++) {
            skeletonHTML += `
                <div class="title-item card loading"> 
                    <div class="loading-skeleton" style="display: flex !important;">
                        <div style="display: flex; gap: 1.2rem; align-items: flex-start; width: 100%;">
                            <div class="skeleton" style="width: 60px; height: 60px; border-radius: 14px; flex-shrink: 0;"></div>
                            <div style="flex-grow: 1;">
                                <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 0.7rem;"></div>
                                <div class="skeleton" style="height: 14px; width: 90%; margin-bottom: 0.5rem;"></div>
                                <div class="skeleton" style="height: 14px; width: 75%;"></div>
                            </div>
                        </div>
                    </div>
                </div>`;
        }
        container.innerHTML = skeletonHTML;
    }
    // --- END: Skeleton Rendering Functions ---

    // --- START: Data Fetching Functions ---
    async function fetchUserProfile(userId) { if (!supabase || !userId) return null; console.log(`[Profile] Fetching profile for user ID: ${userId}`); try { const { data: profile, error } = await supabase.from('profiles').select('*, selected_title, purchased_titles, selected_decoration, purchased_decorations').eq('id', userId).single(); if (error && error.code !== 'PGRST116') throw error; if (!profile) { console.warn(`[Profile] Profile for user ${userId} not found. Returning null.`); return null; } console.log("[Profile] Profile data fetched successfully."); return profile; } catch (error) { console.error('[Profile] Caught exception fetching profile:', error); return null; } }
    async function fetchUserStats(userId, profileData) { if (!supabase || !userId || !profileData) return null; try { const { data: statsData, error } = await supabase.from('user_stats').select('progress, progress_weekly, points_weekly, streak_longest, completed_tests').eq('user_id', userId).maybeSingle(); if (error) { console.warn("Error fetching user_stats:", error.message); return {}; } const { data: rankData, error: rankError } = await supabase.from('leaderboard').select('rank').eq('user_id', userId).eq('period', 'overall').limit(1); if (rankError) console.warn("Error fetching rank:", rankError.message); const { count: totalUsersCount, error: countError } = await supabase.from('profiles').select('id', { count: 'exact', head: true }); if (countError) console.warn("Error fetching total users count:", countError.message); return { progress: statsData?.progress ?? profileData.progress ?? 0, progress_weekly: statsData?.progress_weekly ?? 0, points: profileData.points ?? 0, points_weekly: statsData?.points_weekly ?? 0, streak_current: profileData.streak_days ?? 0, streak_longest: Math.max(statsData?.streak_longest ?? 0, profileData.streak_days ?? 0), badges: profileData.badges_count ?? 0, rank: rankData?.[0]?.rank ?? null, totalUsers: totalUsersCount ?? null, }; } catch (e) { console.error("Exception fetching stats:", e); return null; } }
    async function fetchAllBadgesDefinition() { if (!supabase) return []; try { const { data, error } = await supabase.from('badges').select('*').order('id'); if (error) throw error; return data || []; } catch (e) { console.error("Error fetching badge definitions:", e); return []; } }
    async function fetchUserEarnedBadges(userId) { if (!supabase || !userId) return []; try { const { data, error } = await supabase.from('user_badges').select(`badge_id, earned_at, badge:badges!inner (id, title, description, type, icon, requirements, points)`).eq('user_id', userId).order('earned_at', { ascending: false }); if (error) throw error; return data || []; } catch (e) { console.error("Error fetching earned badges:", e); return []; } }
    
    async function fetchAllPurchasableTitles() { 
        if (!supabase) return [];
        console.log("[Titles] Fetching ALL available & purchasable titles from DB...");
        setLoadingState('titles', true); 
        try {
            const { data, error } = await supabase
                .from('title_shop')
                .select('*') 
                .eq('is_available', true)
                .eq('is_purchasable', true);
            if (error) throw error;
            const count = data ? data.length : 0;
            console.log(`[Titles] Fetched all purchasable titles from DB: ${count}. Titles:`, data?.map(t => t.title_key));
            allTitlesFromDB = data || []; 
            return allTitlesFromDB;
        } catch (error) {
            console.error("[Titles] Error fetching all purchasable titles:", error);
            showToast("Chyba načítání všech titulů z obchodu.", "error");
            allTitlesFromDB = [];
            return [];
        } finally {
            setLoadingState('titles', false);
        }
    }

    function selectDailyUserSpecificTitles(allPurchasable, purchasedKeys, userId) {
        if (!userId) {
            console.warn("[Titles Shop] Cannot select user-specific titles without userId. Returning empty.");
            return [];
        }
        const purchasableArray = Array.isArray(allPurchasable) ? allPurchasable : [];
        console.log(`[Titles Shop] Input - All Purchasable Titles (count: ${purchasableArray.length}):`, purchasableArray.map(t => t.title_key));

        if (purchasableArray.length === 0) {
            console.log("[Titles Shop] No purchasable titles available in the master list to select from.");
            return [];
        }

        const candidateTitles = [...purchasableArray]; 
        console.log(`[Titles Shop] ${candidateTitles.length} titles are candidates for the shop (not filtering purchased).`);
        
        if (candidateTitles.length === 0) { 
            console.log("[Titles Shop] No titles available to select from for the shop.");
            return [];
        }
        if (candidateTitles.length <= DAILY_TITLE_SHOP_COUNT) {
            console.log(`[Titles Shop] Fewer than ${DAILY_TITLE_SHOP_COUNT} titles available, showing all ${candidateTitles.length}.`);
            return candidateTitles; // Return all candidates if fewer than or equal to the shop count
        }

        const today = new Date().toISOString().slice(0, 10); 
        
        const seededSortedTitles = candidateTitles
            .map(title => {
                const seedString = `${userId}-${today}-${title.title_key}`;
                return { ...title, sortValue: getSeededSortValue(seedString) };
            })
            .sort((a, b) => a.sortValue - b.sortValue);
        
        const selected = seededSortedTitles.slice(0, DAILY_TITLE_SHOP_COUNT);
        console.log(`[Titles Shop] Selected ${selected.length} daily random titles for user ${userId}. Titles:`, selected.map(t => t.title_key));
        return selected;
    }

    async function fetchAvatarDecorationsData() { console.warn("Avatar decorations fetching skipped: Table 'avatar_decorations_shop' does not exist or feature is disabled."); return []; }
    async function fetchLeaderboardData() { if (!supabase) return []; try { const { data, error } = await supabase.from('leaderboard').select(`rank, user_id, points, badges_count, profile:profiles!inner(id, first_name, last_name, username, avatar_url, level, streak_days, selected_title, selected_decoration)`).eq('period', 'overall').order('rank', { ascending: true }).limit(LEADERBOARD_LIMIT); if (error) throw error; const rankedData = (data || []).map((entry, index) => ({ ...entry, calculated_rank: entry.rank ?? (index + 1) })); return rankedData; } catch (e) { console.error("Error fetching leaderboard:", e); return []; } }
    async function fetchNotifications(userId, limit = NOTIFICATION_FETCH_LIMIT) { if (!supabase || !userId) return { unreadCount: 0, notifications: [] }; try { const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; return { unreadCount: count ?? 0, notifications: data || [] }; } catch (e) { console.error("Error fetching notifications:", e); return { unreadCount: 0, notifications: [] }; } }
    // --- END: Data Fetching Functions ---

    // --- START: Data Rendering Functions ---
    const badgeVisuals = { math: { icon: 'fa-square-root-alt', gradient: 'var(--gradient-math)' }, language: { icon: 'fa-language', gradient: 'var(--gradient-lang)' }, streak: { icon: 'fa-fire', gradient: 'var(--gradient-streak)' }, special: { icon: 'fa-star', gradient: 'var(--gradient-special)' }, points: { icon: 'fa-coins', gradient: 'var(--gradient-warning)' }, exercises: { icon: 'fa-pencil-alt', gradient: 'var(--gradient-success)' }, test: { icon: 'fa-vial', gradient: 'var(--gradient-info)' }, default: { icon: 'fa-medal', gradient: 'var(--gradient-locked)' } };
    const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };
    function updateSidebarProfile(profile, titlesData = allTitlesFromDB) { 
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) return;
        if (profile) {
            const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || currentUser?.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(profile);
            const avatarUrl = profile.avatar_url;
            const selectedDecoration = profile.selected_decoration || '';
            const avatarWrapper = ui.sidebarAvatar.closest('.avatar-wrapper');
            if (avatarWrapper) {
                const decorationClasses = (allDecorations || []).map(d => d.decoration_key).filter(Boolean);
                avatarWrapper.classList.remove(...decorationClasses);
                if (selectedDecoration) avatarWrapper.classList.add(sanitizeHTML(selectedDecoration));
                avatarWrapper.dataset.decorationKey = selectedDecoration;
            }
            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
            const sidebarImg = ui.sidebarAvatar.querySelector('img');
            if(sidebarImg) { sidebarImg.onerror = () => { ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); }; }

            const selectedTitleKey = profile.selected_title;
            let displayTitle = 'Pilot';
            // Use allTitlesFromDB to find the title details for the sidebar
            const allTitlesForLookup = allTitlesFromDB || [];
            if (selectedTitleKey && allTitlesForLookup.length > 0) {
                const foundTitle = allTitlesForLookup.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) displayTitle = foundTitle.name;
            }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.title = sanitizeHTML(displayTitle);
        } else {
            ui.sidebarName.textContent = "Pilot"; ui.sidebarAvatar.textContent = '?';
            ui.sidebarUserTitle.textContent = 'Pilot'; ui.sidebarUserTitle.removeAttribute('title');
            const avatarWrapper = ui.sidebarAvatar?.closest('.avatar-wrapper');
            if (avatarWrapper) {
                const decorationClasses = (allDecorations || []).map(d => d.decoration_key).filter(Boolean);
                avatarWrapper.classList.remove(...decorationClasses);
                avatarWrapper.dataset.decorationKey = '';
            }
        }
    }
    function updateStatsCards(stats) { if (!stats) { console.warn("No stats data to update cards."); return; } const getVal = (v) => (v !== null && v !== undefined) ? v : '-'; if (ui.badgesCount) ui.badgesCount.textContent = getVal(stats.badges); if (ui.pointsCount) ui.pointsCount.textContent = getVal(stats.points); if (ui.streakDays) ui.streakDays.textContent = getVal(stats.streak_current); if (ui.streakChange) ui.streakChange.textContent = `MAX: ${getVal(stats.streak_longest)} dní`; if (ui.rankValue) ui.rankValue.textContent = getVal(stats.rank); if (ui.rankChange && ui.totalUsers) ui.rankChange.innerHTML = `<i class="fas fa-users"></i> z ${getVal(stats.totalUsers)} pilotů`; if (ui.badgesCard) ui.badgesCard.classList.remove('loading'); if (ui.pointsCard) ui.pointsCard.classList.remove('loading'); if (ui.streakCard) ui.streakCard.classList.remove('loading'); if (ui.rankCard) ui.rankCard.classList.remove('loading'); }
    function renderUserBadges(earnedBadges) { setLoadingState('userBadges', false); if (!ui.badgeGrid || !ui.emptyBadges) return; ui.badgeGrid.innerHTML = ''; if (!earnedBadges || earnedBadges.length === 0) { ui.emptyBadges.style.display = 'block'; ui.badgeGrid.style.display = 'none'; return; } ui.emptyBadges.style.display = 'none'; ui.badgeGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); earnedBadges.forEach((ub, index) => { const badge = ub.badge; if (!badge) return; const badgeType = badge.type?.toLowerCase() || 'default'; const visual = badgeVisuals[badgeType] || badgeVisuals.default; const badgeElement = document.createElement('div'); badgeElement.className = 'badge-card card'; badgeElement.setAttribute('data-animate', ''); badgeElement.style.setProperty('--animation-order', index); badgeElement.innerHTML = `<div class="badge-icon ${badgeType}" style="background: ${visual.gradient};"><i class="fas ${visual.icon}"></i></div><h3 class="badge-title">${sanitizeHTML(badge.title)}</h3><p class="badge-desc">${sanitizeHTML(badge.description || '')}</p><div class="badge-date"><i class="far fa-calendar-alt"></i> ${formatDate(ub.earned_at)}</div>`; fragment.appendChild(badgeElement); }); ui.badgeGrid.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
    function renderAvailableBadges(allBadgesDef, userBadges) { setLoadingState('availableBadges', false); if (!ui.availableBadgesGrid || !ui.emptyAvailableBadges) return; const earnedIds = new Set((userBadges || []).map(ub => ub.badge_id)); const available = (allBadgesDef || []).filter(b => !earnedIds.has(b.id)); ui.availableBadgesGrid.innerHTML = ''; if (available.length === 0) { ui.emptyAvailableBadges.style.display = 'block'; ui.availableBadgesGrid.style.display = 'none'; return; } ui.emptyAvailableBadges.style.display = 'none'; ui.availableBadgesGrid.style.display = 'grid'; const fragment = document.createDocumentFragment(); available.forEach((badge, index) => { const badgeType = badge.type?.toLowerCase() || 'default'; const visual = badgeVisuals[badgeType] || badgeVisuals.default; let progress = 0; let progressText = '???'; const req = badge.requirements; if (req && typeof req === 'object' && currentProfile) { const target = parseInt(req.target, 10) || 1; let current = 0; try { switch (req.type) { case 'points_earned': current = currentProfile.points ?? 0; progressText = `${current}/${target} KR`; break; case 'streak_days': current = currentProfile.streak_days ?? 0; progressText = `${current}/${target} dní`; break; case 'exercises_completed': current = currentProfile.completed_exercises ?? 0; progressText = `${current}/${target} cv.`; break; case 'level_reached': current = currentProfile.level ?? 1; progressText = `${current}/${target} úr.`; break; default: progressText = '?/?'; } if (target > 0) progress = Math.min(100, Math.max(0, Math.round((current / target) * 100))); } catch(e) { progressText = 'Chyba'; } } else { progressText = 'Nespec.'; } const badgeElement = document.createElement('div'); badgeElement.className = 'achievement-card card'; badgeElement.setAttribute('data-animate', ''); badgeElement.style.setProperty('--animation-order', index); badgeElement.innerHTML = `<div class="achievement-icon ${badgeType}" style="background: ${visual.gradient};"><i class="fas ${visual.icon}"></i></div><div class="achievement-content"><h3 class="achievement-title">${sanitizeHTML(badge.title)}</h3><p class="achievement-desc">${sanitizeHTML(badge.description || '')}</p><div class="progress-container"><div class="progress-bar"><div class="progress-fill" style="width: ${progress}%; background: ${visual.gradient};"></div></div><div class="progress-stats">${progress}% (${progressText})</div></div></div>`; fragment.appendChild(badgeElement); }); ui.availableBadgesGrid.appendChild(fragment); requestAnimationFrame(initScrollAnimations); }
    function renderLeaderboard(data) { setLoadingState('leaderboard', false); if (!ui.leaderboardBody || !ui.leaderboardEmpty || !ui.leaderboardTableContainer) return; ui.leaderboardBody.innerHTML = ''; if (!data || data.length === 0) { ui.leaderboardEmpty.style.display = 'block'; ui.leaderboardTableContainer.style.display = 'none'; } else { ui.leaderboardEmpty.style.display = 'none'; ui.leaderboardTableContainer.style.display = 'block'; const fragment = document.createDocumentFragment(); data.forEach((entry) => { const userProf = entry.profile; if (!userProf) return; const rank = entry.calculated_rank || '?'; const isCurrent = entry.user_id === currentUser?.id; const displayName = `${userProf.first_name || ''} ${userProf.last_name || ''}`.trim() || userProf.username || `Pilot #${entry.user_id.substring(0, 4)}`; const initials = getInitials(userProf); const avatarUrl = userProf.avatar_url; const pointsVal = entry.points ?? 0; const badgesCnt = entry.badges_count ?? 0; const streakVal = userProf.streak_days ?? 0; const selectedDecoration = userProf.selected_decoration || ''; const rowEl = document.createElement('tr'); if (isCurrent) rowEl.classList.add('highlight-row'); rowEl.innerHTML = `<td class="rank-cell">${rank}</td><td class="user-cell"><div class="avatar-wrapper ${sanitizeHTML(selectedDecoration)}" data-decoration-key="${sanitizeHTML(selectedDecoration)}"><div class="user-avatar-sm">${avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}?t=${Date.now()}" alt="${sanitizeHTML(displayName)}">` : sanitizeHTML(initials)}</div></div><div class="user-info-sm"><div class="user-name-sm">${sanitizeHTML(displayName)}</div><div class="user-level">Úroveň ${userProf.level || 1}</div></div></td><td class="score-cell">${pointsVal}</td><td class="badge-count-cell">${badgesCnt}</td><td class="streak-cell">${streakVal}</td>`; fragment.appendChild(rowEl); }); ui.leaderboardBody.appendChild(fragment); } }
    
    function renderTitleShop(titlesToDisplay, profile) {
        setLoadingState('titleShop', false);
        if (!ui.titleShopGrid || !ui.titleShopEmpty || !ui.shopUserCredits || !profile) {
            console.error("[RenderShop] Missing critical UI elements or profile data.");
            return;
        }
        ui.shopUserCredits.textContent = profile.points ?? 0;
        ui.titleShopGrid.innerHTML = '';

        console.log(`[RenderShop] Rendering ${titlesToDisplay?.length || 0} titles for the shop.`);
        if (!titlesToDisplay || titlesToDisplay.length === 0) {
            ui.titleShopEmpty.style.display = 'block';
            ui.titleShopGrid.style.display = 'none';
            
            const allPurchasableTitlesInDB = (allTitlesFromDB || []).filter(t => t.is_purchasable && t.is_available);
            const purchasedKeysSet = new Set(profile.purchased_titles || []);
            const allPurchasableAndNotOwned = allPurchasableTitlesInDB.filter(t => !purchasedKeysSet.has(t.title_key));

            const emptyMsgP = ui.titleShopEmpty.querySelector('p');
            if (emptyMsgP) {
                if (allPurchasableAndNotOwned.length === 0 && allPurchasableTitlesInDB.length > 0) {
                     emptyMsgP.textContent = 'Všechny aktuálně dostupné tituly v obchodě již vlastníte! Zkuste to znovu zítra.';
                } else if (allPurchasableTitlesInDB.length === 0) {
                     emptyMsgP.textContent = 'Momentálně nejsou v obchodě žádné tituly. Zkuste to prosím později.';
                } else { // This case means titlesToDisplay was empty but there *are* unowned titles, which shouldn't happen with current logic
                     emptyMsgP.textContent = 'Dnešní nabídka je prázdná. Nové tituly se objeví zítra!';
                }
            }
            console.log("[RenderShop] No titles to display. Showing empty state.");
            return;
        }
        ui.titleShopEmpty.style.display = 'none';
        ui.titleShopGrid.style.display = 'grid';
        const fragment = document.createDocumentFragment();
        const purchasedKeys = new Set(profile.purchased_titles || []);
        const selectedKey = profile.selected_title;

        titlesToDisplay.forEach((title, index) => {
            const isPurchased = purchasedKeys.has(title.title_key); 
            const isEquipped = isPurchased && title.title_key === selectedKey;
            const canAfford = profile.points >= title.cost;

            const itemElement = document.createElement('div');
            itemElement.className = 'title-item card';
            itemElement.setAttribute('data-title-key', title.title_key);
            itemElement.setAttribute('data-title-cost', title.cost);
            itemElement.setAttribute('data-animate', '');
            itemElement.style.setProperty('--animation-order', index);

            itemElement.innerHTML = `
                <div class="title-item-icon"><i class="${sanitizeHTML(title.icon || 'fas fa-user-tag')}"></i></div>
                <div class="title-item-content">
                    <h4 class="title-item-name">${sanitizeHTML(title.name)}</h4>
                    ${title.description ? `<p class="title-item-desc">${sanitizeHTML(title.description)}</p>` : ''}
                    <div class="title-item-footer">
                        <span class="title-item-cost">Cena: ${title.cost} <i class="fas fa-coins"></i></span>
                        <div class="title-item-actions">
                            <button class="btn btn-sm btn-primary buy-title-btn" ${isPurchased ? 'style="display: none;"' : ''} ${canAfford ? '' : 'disabled'} title="${canAfford ? 'Koupit titul' : 'Nedostatek kreditů'}">
                                <i class="fas fa-shopping-cart"></i> Koupit
                            </button>
                            <span class="title-status purchased" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-check"></i> Zakoupeno</span>
                            <span class="title-status equipped" ${isEquipped ? '' : 'style="display: none;"'}><i class="fas fa-user-check"></i> Používá se</span>
                            <button class="btn btn-sm btn-secondary equip-title-btn" ${isPurchased && !isEquipped ? '' : 'style="display: none;"'}>
                                <i class="fas fa-check-square"></i> Použít
                            </button>
                        </div>
                    </div>
                </div>`;
            fragment.appendChild(itemElement);
        });
        ui.titleShopGrid.appendChild(fragment);
        requestAnimationFrame(initScrollAnimations);
        console.log(`[RenderShop] Finished rendering titles.`);
    }
    function renderAvatarDecorationsShop(decorations, profile) { setLoadingState('avatarDecorations', false); if (!ui.avatarDecorationsGrid || !ui.avatarDecorationsEmpty || !ui.shopDecorCredits || !profile) return; ui.shopDecorCredits.textContent = profile.points ?? 0; ui.avatarDecorationsGrid.innerHTML = ''; ui.avatarDecorationsEmpty.style.display = 'block'; ui.avatarDecorationsGrid.style.display = 'none'; }
    function renderNotifications(count, notifications) { setLoadingState('notifications', false); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllRead) return; ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllRead.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllRead.disabled = true; } }
    
    function renderUserTitlesInventory(profile, allTitlesData) {
        setLoadingState('userTitlesInventory', false);
        if (!ui.userTitlesInventoryGrid || !ui.userTitlesInventoryEmpty || !profile) {
            console.error("[RenderInventory] Missing UI elements for inventory or profile data.");
            return;
        }
        ui.userTitlesInventoryGrid.innerHTML = '';
        const purchasedTitleKeys = profile.purchased_titles || [];

        if (purchasedTitleKeys.length === 0) {
            if (ui.userTitlesInventoryEmpty) { 
                ui.userTitlesInventoryEmpty.style.display = 'block';
            }
            if (ui.userTitlesInventoryGrid) { 
                ui.userTitlesInventoryGrid.style.display = 'none';
            }
            console.log("[RenderInventory] No titles purchased by user.");
            return;
        }

        if (ui.userTitlesInventoryEmpty) ui.userTitlesInventoryEmpty.style.display = 'none';
        if (ui.userTitlesInventoryGrid) ui.userTitlesInventoryGrid.style.display = 'grid';

        const purchasedTitlesDetailed = purchasedTitleKeys.map(key => {
            return (allTitlesData || []).find(title => title.title_key === key); 
        }).filter(Boolean);

        purchasedTitlesDetailed.sort((a, b) => (a.cost || 0) - (b.cost || 0));

        console.log(`[RenderInventory] Rendering ${purchasedTitlesDetailed.length} purchased titles, sorted by cost.`);

        const fragment = document.createDocumentFragment();
        const selectedKey = profile.selected_title;

        purchasedTitlesDetailed.forEach((title, index) => {
            const isEquipped = title.title_key === selectedKey;
            const itemElement = document.createElement('div');
            itemElement.className = 'title-item card inventory-item'; 
            itemElement.setAttribute('data-title-key', title.title_key);
            itemElement.setAttribute('data-animate', ''); 
            itemElement.style.setProperty('--animation-order', index);

            itemElement.innerHTML = `
                <div class="title-item-icon"><i class="${sanitizeHTML(title.icon || 'fas fa-user-tag')}"></i></div>
                <div class="title-item-content">
                    <h4 class="title-item-name">${sanitizeHTML(title.name)}</h4>
                    ${title.description ? `<p class="title-item-desc">${sanitizeHTML(title.description)}</p>` : ''}
                    <div class="title-item-footer">
                        <span class="title-item-cost" style="visibility:hidden;">Cena: ${title.cost} <i class="fas fa-coins"></i></span>
                        <div class="title-item-actions">
                            ${isEquipped ? 
                                `<span class="title-status equipped"><i class="fas fa-user-check"></i> Používá se</span>` :
                                `<button class="btn btn-sm btn-secondary equip-title-btn">
                                    <i class="fas fa-check-square"></i> Použít
                                 </button>`
                            }
                        </div>
                    </div>
                </div>`;
            fragment.appendChild(itemElement);
        });
        if (ui.userTitlesInventoryGrid) ui.userTitlesInventoryGrid.appendChild(fragment); 
        requestAnimationFrame(initScrollAnimations);
    }
    // --- END: Data Rendering Functions ---

    // --- START: Shop Interaction Logic ---
    async function handleShopInteraction(event) { const buyTitleButton = event.target.closest('.buy-title-btn'); const equipTitleButton = event.target.closest('.equip-title-btn'); const buyDecorButton = event.target.closest('.buy-decor-btn'); const equipDecorButton = event.target.closest('.equip-decor-btn'); if (buyTitleButton) { const itemEl = buyTitleButton.closest('.title-item'); const key = itemEl?.dataset.titleKey; const cost = parseInt(itemEl?.dataset.titleCost, 10); if (key && !isNaN(cost)) handleBuyItem('title', key, cost, buyTitleButton); else showToast('Chyba: Nelze identifikovat titul.', 'error'); } else if (equipTitleButton) { const itemEl = equipTitleButton.closest('.title-item'); const key = itemEl?.dataset.titleKey; if (key) handleEquipItem('title', key, equipTitleButton); else showToast('Chyba: Nelze identifikovat titul.', 'error'); } else if (buyDecorButton) { showToast('Info', 'Nákup vylepšení avatarů není momentálně dostupný.', 'info'); } else if (equipDecorButton) { showToast('Info', 'Nastavení vylepšení avatarů není momentálně dostupný.', 'info'); } }
    async function handleBuyItem(itemType, itemKey, cost, buttonElement) { if (!currentProfile || !supabase || !currentUser || isLoading.buyEquip) return; if(itemType === 'decoration') { showToast('Info', 'Nákup vylepšení avatarů není momentálně dostupný.', 'info'); return; } const currentCredits = currentProfile.points ?? 0; if (currentCredits < cost) { showToast('Nedostatek Kreditů', `Potřebujete ${cost} kreditů.`, 'warning'); return; } const itemData = (itemType === 'title' ? allTitlesFromDB : allDecorations).find(it => it[itemType === 'title' ? 'title_key' : 'decoration_key'] === itemKey); const itemName = itemData?.name || itemKey; const itemTypeName = itemType === 'title' ? 'titul' : 'vylepšení'; if (!confirm(`Opravdu koupit ${itemTypeName} "${itemName}" za ${cost} kreditů?`)) return; setLoadingState('buyEquip', true); buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; const purchaseField = itemType === 'title' ? 'purchased_titles' : 'purchased_decorations'; try { const currentPurchased = Array.isArray(currentProfile[purchaseField]) ? currentProfile[purchaseField] : []; if (currentPurchased.includes(itemKey)) { showToast('Již Vlastněno', `Tento ${itemTypeName} již máte.`, 'info'); return; } const newCredits = currentCredits - cost; const newPurchasedItems = [...currentPurchased, itemKey]; const updatePayload = { points: newCredits, [purchaseField]: newPurchasedItems }; const { data: updatedProfile, error: updateError } = await supabase.from('profiles').update(updatePayload).eq('id', currentUser.id).select('*, selected_title, purchased_titles, selected_decoration, purchased_decorations').single(); if (updateError) throw updateError; currentProfile = updatedProfile; if(itemType === 'title') { titleShopTitles = selectDailyUserSpecificTitles(allTitlesFromDB, currentProfile.purchased_titles || [], currentUser.id); renderTitleShop(titleShopTitles, currentProfile); renderUserTitlesInventory(currentProfile, allTitlesFromDB); } else { renderAvatarDecorationsShop(allDecorations, currentProfile); } updateSidebarProfile(currentProfile, allTitlesFromDB); if (ui.shopUserCredits) ui.shopUserCredits.textContent = currentProfile.points; if (ui.shopDecorCredits) ui.shopDecorCredits.textContent = currentProfile.points; if (ui.pointsCount) ui.pointsCount.textContent = currentProfile.points; showToast('Nákup Úspěšný', `${itemTypeName} "${itemName}" zakoupen!`, 'success'); } catch (error) { console.error(`Error buying ${itemType}:`, error); showToast('Chyba Nákupu', error.message, 'error'); if(buttonElement) {buttonElement.disabled = false; buttonElement.innerHTML = '<i class="fas fa-shopping-cart"></i> Koupit';} } finally { setLoadingState('buyEquip', false); const stillOwned = (currentProfile[purchaseField] || []).includes(itemKey); if (buttonElement) { if (stillOwned) buttonElement.style.display = 'none'; else if (currentProfile.points < cost) buttonElement.disabled = true; } } }
    async function handleEquipItem(itemType, itemKey, buttonElement) { if (!currentProfile || !supabase || !currentUser || isLoading.buyEquip) return; if(itemType === 'decoration') { showToast('Info', 'Nastavení vylepšení avatarů není momentálně dostupný.', 'info'); return; } const purchaseField = itemType === 'title' ? 'purchased_titles' : 'purchased_decorations'; const selectField = itemType === 'title' ? 'selected_title' : 'selected_decoration'; const purchasedKeys = Array.isArray(currentProfile[purchaseField]) ? currentProfile[purchaseField] : []; const itemTypeName = itemType === 'title' ? 'titul' : 'vylepšení'; if (!purchasedKeys.includes(itemKey)) { showToast('Chyba', `Tento ${itemTypeName} nemáte zakoupený.`, 'error'); return; } if (currentProfile[selectField] === itemKey) { showToast('Již Používáte', `Tento ${itemTypeName} již máte nastavený.`, 'info'); return; } setLoadingState('buyEquip', true); if (buttonElement) { buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; } try { const { data: updatedProfile, error: updateError } = await supabase.from('profiles').update({ [selectField]: itemKey }).eq('id', currentUser.id).select('*, selected_title, purchased_titles, selected_decoration, purchased_decorations').single(); if (updateError) throw updateError; currentProfile = updatedProfile; if(itemType === 'title') { renderTitleShop(titleShopTitles, currentProfile); renderUserTitlesInventory(currentProfile, allTitlesFromDB); } else { renderAvatarDecorationsShop(allDecorations, currentProfile); } updateSidebarProfile(currentProfile, allTitlesFromDB); const itemData = (allTitlesFromDB || []).find(it => it[itemType === 'title' ? 'title_key' : 'decoration_key'] === itemKey); const itemName = itemData?.name || itemKey; showToast('Položka Nastavena', `Nyní používáte ${itemTypeName} "${itemName}".`, 'success'); } catch (error) { console.error(`Error equipping ${itemType}:`, error); showToast('Chyba Nastavení', error.message, 'error'); } finally { setLoadingState('buyEquip', false); if (buttonElement) { buttonElement.disabled = false; buttonElement.innerHTML = '<i class="fas fa-check-square"></i> Použít'; const stillSelected = currentProfile[selectField] === itemKey; const stillOwned = (currentProfile[purchaseField] || []).includes(itemKey); if (stillSelected || !stillOwned) buttonElement.style.display = 'none'; } } }
    // --- END: Shop Interaction Logic ---

    // --- START: Notification Logic ---
    async function handleNotificationClick(event) { const item = event.target.closest('.notification-item'); if (!item) return; const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId && supabase) { try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllRead) ui.markAllRead.disabled = newCount === 0; } catch (error) { console.error("Mark notification read error:", error); showToast('Chyba označení oznámení.', 'error'); } } if (link) window.location.href = link; }
    async function handleMarkAllReadClick() { if (!currentUser || !ui.markAllRead || !supabase || isLoading.notifications) return; setLoadingState('notifications', true); ui.markAllRead.disabled = true; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false); if (error) throw error; const { unreadCount, notifications } = await fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT); renderNotifications(unreadCount, notifications); showToast('Oznámení označena jako přečtená.', 'success'); } catch (error) { console.error("Mark all read error:", error); showToast('Chyba při označování oznámení.', 'error'); } finally { setLoadingState('notifications', false); } }
    // --- END: Notification Logic ---

    // --- START: Load All Data ---
    async function loadAllAwardData() {
        if (!currentUser || !currentProfile || !supabase) {
            showError("Chyba: Nelze načíst data ocenění bez profilu uživatele.", true);
            setLoadingState('all', false); return;
        }
        console.log("🔄 [LoadAwards] Loading all award page data...");
        hideError();
        setLoadingState('all', true);
        try {
            const allPurchasableTitlesFromDB = await fetchAllPurchasableTitles(); 
            titleShopTitles = selectDailyUserSpecificTitles(allPurchasableTitlesFromDB, currentProfile.purchased_titles || [], currentUser.id);
            console.log("[LoadAwards] Daily shop titles selected:", titleShopTitles.map(t => t.title_key));

            const results = await Promise.allSettled([
                fetchUserStats(currentUser.id, currentProfile),
                fetchAllBadgesDefinition(),
                fetchUserEarnedBadges(currentUser.id),
                fetchAvatarDecorationsData(),
                fetchLeaderboardData(),
                fetchNotifications(currentUser.id, NOTIFICATION_FETCH_LIMIT)
            ]);
            console.log("[LoadAwards] Data fetch results:", results);

            const [statsResult, allBadgesResult, userBadgesResult, avatarShopResult, leaderboardResult, notificationsResult] = results;

            userStatsData = (statsResult.status === 'fulfilled') ? statsResult.value : null;
            allBadges = (allBadgesResult.status === 'fulfilled') ? allBadgesResult.value : [];
            userBadges = (userBadgesResult.status === 'fulfilled') ? userBadgesResult.value : [];
            allDecorations = [];
            leaderboardData = (leaderboardResult.status === 'fulfilled') ? leaderboardResult.value : [];
            const { unreadCount, notifications } = (notificationsResult.status === 'fulfilled') ? notificationsResult.value : { unreadCount: 0, notifications: [] };

            updateStatsCards(userStatsData);
            renderUserBadges(userBadges);
            renderAvailableBadges(allBadges, userBadges);
            renderLeaderboard(leaderboardData);
            renderTitleShop(titleShopTitles, currentProfile); 
            renderUserTitlesInventory(currentProfile, allTitlesFromDB); 
            renderAvatarDecorationsShop(allDecorations, currentProfile);
            renderNotifications(unreadCount, notifications);
            updateSidebarProfile(currentProfile, allTitlesFromDB); 

            console.log("✅ [LoadAwards] All award page data loaded and rendered.");
        } catch (error) {
            console.error("❌ [LoadAwards] Unexpected error during loading award data:", error);
            showError(`Nepodařilo se načíst data pro stránku Ocenění: ${error.message}`, true);
            updateStatsCards(userStatsData || null);
            renderUserBadges(userBadges || []);
            renderAvailableBadges(allBadges || [], userBadges || []);
            renderLeaderboard(leaderboardData || []);
            renderTitleShop(titleShopTitles || [], currentProfile || {}); 
            renderUserTitlesInventory(currentProfile || {}, allTitlesFromDB || []); 
            renderAvatarDecorationsShop(allDecorations || [], currentProfile || {});
            renderNotifications(0, []);
        } finally {
            setLoadingState('all', false);
            initTooltips();
        }
    }
    // --- END: Load All Data ---

    // --- START: Event Listeners Setup ---
    function setupEventListeners() { 
        console.log("[Oceneni SETUP] Setting up event listeners..."); 
        const safeAddListener = (el, ev, fn, key) => { 
            if (el) {
                if (el._eventHandlers && el._eventHandlers[key]) {
                    el.removeEventListener(ev, el._eventHandlers[key]);
                }
                el.addEventListener(ev, fn);
                if (!el._eventHandlers) el._eventHandlers = {};
                el._eventHandlers[key] = fn; 
            } else {
                console.warn(`[SETUP] Element not found for listener: ${key}`);
            }
        }; 
        safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle'); 
        safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle'); 
        safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay'); 
        safeAddListener(ui.sidebarToggleBtn, 'click', toggleSidebar, 'sidebarToggleBtn'); 
        safeAddListener(ui.refreshDataBtn, 'click', loadAllAwardData, 'refreshDataBtn'); 
        safeAddListener(ui.notificationBell, 'click', (e) => { e.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }, 'notificationBell'); 
        safeAddListener(ui.markAllRead, 'click', handleMarkAllReadClick, 'markAllRead'); 
        safeAddListener(ui.notificationsList, 'click', handleNotificationClick, 'notificationsList'); 
        safeAddListener(ui.titleShopGrid, 'click', handleShopInteraction, 'titleShopGrid'); 
        safeAddListener(ui.avatarDecorationsGrid, 'click', handleShopInteraction, 'avatarDecorationsGrid'); 
        if(ui.userTitlesInventoryGrid) safeAddListener(ui.userTitlesInventoryGrid, 'click', handleShopInteraction, 'userTitlesInventoryGrid'); 
        document.querySelectorAll('.sidebar-link').forEach(l => l.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); })); 
        window.addEventListener('online', updateOnlineStatus); 
        window.addEventListener('offline', updateOnlineStatus); 
        document.addEventListener('click', (e) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(e.target) && !ui.notificationBell?.contains(e.target)) { ui.notificationsDropdown.classList.remove('active'); } }); 
        
        const sectionToggleMap = {
            'toggle-user-badges-section': ui.userBadgesContent,
            'toggle-available-badges-section': ui.availableBadgesContent,
            'toggle-user-titles-section': ui.userTitlesInventoryContent,
            'toggle-title-shop-section': ui.titleShopContent, 
            'toggle-avatar-decorations-section': ui.avatarDecorationsContent,
            'toggle-leaderboard-section': ui.leaderboardContent 
        };

        Object.keys(sectionToggleMap).forEach(buttonIdString => {
            const camelCaseButtonKey = buttonIdString.replace(/-([a-z])/g, g => g[1].toUpperCase()); // Convert kebab-case ID to camelCase for ui object key
            const button = ui[camelCaseButtonKey];
            // The contentElement is now defined directly in cacheDOMElements and stored in ui with a 'Content' suffix.
            // We can derive its key or ensure cacheDOMElements populates it correctly based on the section container.
            // For simplicity, we'll assume the parent .card is what we want to toggle 'collapsed-section' on.
            
            if (button) { // Check if button element was found
                safeAddListener(button, 'click', () => {
                    const sectionCard = button.closest('.card.section, .card.badges-section, .card.available-achievements, .card.user-titles-inventory-section, .card.title-shop-section, .card.avatar-decorations-shop, .card.leaderboard-section'); 
                    if (sectionCard) {
                        sectionCard.classList.toggle('collapsed-section');
                        const icon = button.querySelector('i');
                        if (icon) {
                            icon.classList.toggle('fa-chevron-down');
                            icon.classList.toggle('fa-chevron-up');
                        }
                        console.log(`Toggled section for button ${buttonIdString}`);
                    } else {
                        console.warn(`Parent .card or specific section class not found for toggle button ${buttonIdString}`);
                    }
                }, buttonIdString); // Use buttonIdString as unique key for the listener
            } else {
                console.warn(`[SETUP] Toggle button with ID string '${buttonIdString}' (camelCase: '${camelCaseButtonKey}') not found in ui cache.`);
            }
        });
        console.log("[Oceneni SETUP] Event listeners setup complete."); 
    }
    // --- END: Event Listeners Setup ---

    // --- START: Initialization ---
    async function initializeApp() {
        console.log("🚀 [Init Oceneni v23.23.1] Starting...");
        cacheDOMElements();
        if (!initializeSupabase()) return;
        applyInitialSidebarState();
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
            currentProfile = await fetchUserProfile(currentUser.id);
            if (!currentProfile) throw new Error("Nepodařilo se načíst profil uživatele.");

            updateSidebarProfile(currentProfile, []); 
            setupEventListeners();
            initMouseFollower();
            initHeaderScrollDetection();
            updateCopyrightYear();
            updateOnlineStatus();
            await loadAllAwardData(); 

            if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); }
            if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
            initTooltips();

            console.log("✅ [Init Oceneni] Page initialized.");
        } catch (error) {
            console.error("❌ [Init Oceneni] Kritická chyba inicializace:", error);
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA (${error.message}). OBNOVTE.</p>`; }
            else { showError(`Chyba inicializace: ${error.message}`, true); }
            if (ui.mainContent) ui.mainContent.style.display = 'block';
            setLoadingState('all', false);
        }
    }

    function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded."); } supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); if (!supabase) throw new Error("Supabase client creation failed."); console.log('[Supabase] Client initialized.'); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }
    // --- END: Initialization ---

    // --- Run ---
    initializeApp();

})(); // End IIFE