// dashboard/profile.js
// Version: 2.0 - Kompletní redesign pro zobrazení dynamických profilů
// Tato verze nahrazuje starou logiku pro úpravu profilu. Úpravy jsou přesunuty do settings.js.
// Tento skript se stará o načtení a zobrazení dat profilu na základě URL.

(function() {
    'use strict';

    // --- START: Konfigurace a Globální Proměnné ---
    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';

    let supabase = null;
    let currentUser = null; // Přihlášený uživatel
    let currentProfile = null; // Profil přihlášeného uživatele
    let viewedProfile = null; // Zobrazovaný profil (může být jiný než přihlášeného)
    let allTitles = []; // Seznam všech titulů pro zobrazení

    let isLoading = {
        page: true,
        profileData: false,
        activityTab: false,
        awardsTab: false,
        notifications: false,
    };

    const ui = {}; // Bude naplněno v cacheDOMElements
    // --- END: Konfigurace ---

    // --- START: Pomocné Funkce ---
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) { console.warn("Toast container not found in UI cache."); return; } try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); const errorContainer = isGlobal ? ui.globalError : document.getElementById('profile-view-container'); if (errorContainer) { errorContainer.innerHTML = `<div class="error-message card" style="text-align:center; padding: 2rem;"><i class="fas fa-broadcast-tower"></i><div><strong>Signál ztracen.</strong><br>${sanitizeHTML(message)}</div><button class="btn btn-secondary" style="margin-top:1rem;" onclick="window.location.href='/dashboard/dashboard.html'">Zpět na Nástěnku</button></div>`; errorContainer.style.display = 'block'; if(ui.profileViewContainer) ui.profileViewContainer.style.display = 'block'; } else { showToast('CHYBA', message, 'error'); } }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || 'P'; }
    function formatDate(dateString) { if (!dateString) return 'Neznámé datum'; try { return new Date(dateString).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return 'Neplatné datum'; } }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); const diffSec = Math.round((now - date) / 1000); if (diffSec < 60) return 'právě teď'; const diffMin = Math.round(diffSec / 60); if (diffMin < 60) return `před ${diffMin} min.`; const diffHour = Math.round(diffMin / 60); if (diffHour < 24) return `před ${diffHour} hod.`; const diffDay = Math.round(diffHour / 24); if (diffDay === 1) return `včera`; if (diffDay < 7) return `před ${diffDay} dny`; return date.toLocaleDateString('cs-CZ'); } catch (e) { return '-'; } }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function toggleSidebar() { try { const isCollapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; } catch (e) { console.error("Chyba při přepínání sidebaru:", e); } }
    function applyInitialSidebarState() { try { const savedState = localStorage.getItem(SIDEBAR_STATE_KEY); const shouldBeCollapsed = savedState === 'collapsed'; if (shouldBeCollapsed) document.body.classList.add('sidebar-collapsed'); else document.body.classList.remove('sidebar-collapsed'); const icon = ui.sidebarToggleBtn.querySelector('i'); if (icon) icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'; } catch (error) { console.error("Chyba při aplikaci stavu sidebaru:", error); } }
    // --- END: Pomocné Funkce ---

    function cacheDOMElements() {
        const ids = [
            'initial-loader', 'sidebar-overlay', 'main-content', 'sidebar', 'sidebar-close-toggle',
            'main-mobile-menu-toggle', 'sidebar-toggle-btn', 'sidebar-avatar', 'sidebar-name',
            'sidebar-user-title', 'currentYearSidebar', 'profile-main-title', 'logout-btn-header',
            'notification-bell', 'notification-count', 'notifications-dropdown', 'notifications-list',
            'no-notifications-msg', 'mark-all-read', 'global-error', 'profile-view-container',
            'profile-page-avatar', 'profile-page-level', 'profile-page-name', 'profile-page-username',
            'profile-page-title-display', 'profile-page-title', 'profile-page-actions',
            'profile-page-points', 'profile-page-badges', 'profile-page-streak', 'profile-page-bio',
            'profile-page-school', 'profile-page-grade', 'profile-page-joindate',
            'activity-list-profile', 'activity-list-empty', 'activity-list-error',
            'awards-grid-profile', 'awards-list-empty', 'awards-list-error',
            'currentYearFooter', 'toast-container', 'mouse-follower'
        ];
        ids.forEach(id => ui[id] = document.getElementById(id));
        ui.profileTabs = document.querySelectorAll('.profile-content-tab');
        ui.tabContents = document.querySelectorAll('.profile-tab-content');
        console.log("[CACHE DOM] Elementy pro stránku profilu uloženy.");
    }

    // --- START: Logika Načítání Dat ---
    async function initializeSupabase() { if (supabase) return true; try { supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); if (!supabase) throw new Error("Vytvoření klienta Supabase selhalo."); console.log('[Supabase] Klient úspěšně inicializován.'); return true; } catch (error) { console.error('[Supabase] Inicializace selhala:', error); showError("Kritická chyba: Nelze se připojit k databázi.", true); return false; } }
    async function fetchTitles() { if (!supabase) return []; try { const { data, error } = await supabase.from('title_shop').select('title_key, name'); if (error) throw error; return data || []; } catch (error) { console.error("Chyba při načítání titulů:", error); return []; } }
    async function fetchProfileByUsername(username) { if (!supabase || !username) return null; try { const { data, error } = await supabase.from('profiles').select('*').eq('username', username).single(); if (error) { if (error.code === 'PGRST116') return null; throw error; } return data; } catch (error) { console.error("Chyba při načítání profilu podle jména:", error); return null; } }
    async function fetchUserActivity(userId, limit = 15) { if (!supabase || !userId) return []; try { const { data, error } = await supabase.from('activities').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit); if (error) throw error; return data || []; } catch (e) { console.error("Chyba načítání aktivity:", e); return null; } }
    async function fetchUserAwards(userId) { if (!supabase || !userId) return []; try { const { data, error } = await supabase.from('user_badges').select('badge:badges(title, description, icon, type)').eq('user_id', userId).order('earned_at', { ascending: false }); if (error) throw error; return data.map(d => d.badge) || []; } catch (e) { console.error("Chyba načítání ocenění:", e); return null; } }
    // --- END: Logika Načítání Dat ---

    // --- START: Logika Vykreslování UI ---
    function updateSidebarProfile() {
        if (!ui.sidebarName || !ui.sidebarAvatar || !currentProfile) return;
        const displayName = `${currentProfile.first_name || ''} ${currentProfile.last_name || ''}`.trim() || currentProfile.username;
        ui.sidebarName.textContent = sanitizeHTML(displayName);
        const initials = getInitials(currentProfile);
        let avatarUrl = currentProfile.avatar_url;
        if (avatarUrl) avatarUrl += `?t=${new Date().getTime()}`; // Cache busting
        ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
        const img = ui.sidebarAvatar.querySelector('img');
        if (img) img.onerror = () => { ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); };
        const selectedTitleKey = currentProfile.selected_title;
        let displayTitle = 'Pilot';
        if (selectedTitleKey && allTitles.length > 0) { const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey); if (foundTitle) displayTitle = foundTitle.name; }
        ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
        ui.sidebarUserTitle.title = sanitizeHTML(displayTitle);
    }

    function displayProfileData(profileData) {
        if (!profileData) { showError("Profil tohoto uživatele nebyl nalezen."); return; }
        viewedProfile = profileData; // Uložíme si profil, na který se díváme

        // Aktualizace hlavního nadpisu stránky
        ui.profileMainTitle.innerHTML = `<i class="fas fa-user-astronaut"></i> Profil: ${sanitizeHTML(viewedProfile.username)}`;

        // Avatar, Jméno, Level atd.
        const initials = getInitials(viewedProfile);
        let avatarUrl = viewedProfile.avatar_url;
        if (avatarUrl) avatarUrl += `?t=${new Date().getTime()}`;
        ui.profilePageAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="Avatar">` : initials;
        ui.profilePageLevel.textContent = viewedProfile.level || 1;
        ui.profilePageName.textContent = `${viewedProfile.first_name || ''} ${viewedProfile.last_name || ''}`.trim() || viewedProfile.username;
        ui.profilePageUsername.textContent = `@${viewedProfile.username}`;

        // Titul
        const titleKey = viewedProfile.selected_title;
        let titleName = 'Pilot';
        if (titleKey && allTitles.length > 0) { const foundTitle = allTitles.find(t => t.title_key === titleKey); if (foundTitle) titleName = foundTitle.name; }
        ui.profilePageTitle.textContent = sanitizeHTML(titleName);

        // Statistiky
        ui.profilePagePoints.textContent = viewedProfile.points || 0;
        ui.profilePageBadges.textContent = viewedProfile.badges_count || 0;
        ui.profilePageStreak.textContent = viewedProfile.streak_days || 0;

        // "O mně" a další detaily
        ui.profilePageBio.textContent = viewedProfile.bio || 'Uživatel zatím nic neuvedl.';
        ui.profilePageSchool.textContent = viewedProfile.school || 'Neuvedeno';
        ui.profilePageGrade.textContent = viewedProfile.grade ? (viewedProfile.grade.includes('_ss') ? `${viewedProfile.grade[0]}. ročník SŠ` : `${viewedProfile.grade}. třída`) : 'Neuvedeno';
        ui.profilePageJoindate.textContent = formatDate(viewedProfile.created_at);

        // Akční tlačítka
        ui.profilePageActions.innerHTML = '';
        if (currentUser && currentUser.id === viewedProfile.id) {
            // Jsme na svém profilu
            const editBtn = document.createElement('a');
            editBtn.href = '/dashboard/settings.html';
            editBtn.className = 'btn btn-primary';
            editBtn.innerHTML = '<i class="fas fa-user-edit"></i> Upravit Profil';
            ui.profilePageActions.appendChild(editBtn);
        } else {
            // Jsme na cizím profilu (logika pro přátele, zprávy atd. přijde sem)
            const addFriendBtn = document.createElement('button');
            addFriendBtn.className = 'btn btn-secondary';
            addFriendBtn.innerHTML = '<i class="fas fa-user-plus"></i> Přidat do přátel';
            addFriendBtn.onclick = () => showToast('Funkce ve vývoji', 'Systém přátel bude brzy spuštěn.', 'info');
            ui.profilePageActions.appendChild(addFriendBtn);
        }

        // Načteme obsah pro první aktivní tab
        loadTabContent('activity');
        ui.profileViewContainer.style.display = 'block';
    }

    function renderActivity(activities) {
        const container = ui.activityListProfile;
        container.innerHTML = '';
        if (activities === null) {
            ui.activityListError.style.display = 'flex';
            return;
        }
        if (activities.length === 0) {
            ui.activityListEmpty.style.display = 'flex';
            return;
        }
        const fragment = document.createDocumentFragment();
        activities.forEach(act => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            const typeLower = act.type?.toLowerCase() || 'default';
            const visual = { icon: 'fa-check-circle', class: 'default' }; // Zjednodušená verze z dashboard.css
            const iconClass = `fas ${visual.icon}`;
            item.innerHTML = `<div class="activity-icon ${visual.class}"><i class="${iconClass}"></i></div>
                              <div class="activity-content">
                                <div class="activity-title">${sanitizeHTML(act.title)}</div>
                                ${act.description ? `<div class="activity-desc">${sanitizeHTML(act.description)}</div>` : ''}
                                <div class="activity-time"><i class="far fa-clock"></i> ${formatRelativeTime(act.created_at)}</div>
                              </div>`;
            fragment.appendChild(item);
        });
        container.appendChild(fragment);
    }

    function renderAwards(badges) {
        const container = ui.awardsGridProfile;
        container.innerHTML = '';
        if (badges === null) {
            ui.awardsListError.style.display = 'flex';
            return;
        }
        if (badges.length === 0) {
            ui.awardsListEmpty.style.display = 'flex';
            return;
        }
        const fragment = document.createDocumentFragment();
        badges.forEach(badge => {
            const card = document.createElement('div');
            card.className = 'badge-card-small btn-tooltip';
            card.title = sanitizeHTML(badge.description);
            const typeLower = badge.type?.toLowerCase() || 'default';
            const iconClass = `fas ${badge.icon || 'fa-medal'}`;
            card.innerHTML = `<div class="badge-icon-small ${typeLower}"><i class="${iconClass}"></i></div>
                              <div class="badge-title-small">${sanitizeHTML(badge.title)}</div>`;
            fragment.appendChild(card);
        });
        container.appendChild(fragment);
        initTooltips();
    }

    async function loadTabContent(tabId) {
        if (tabId === 'activity') {
            ui.activityListProfile.innerHTML = ''; // Clear previous
            renderSkeleton('activity');
            const activities = await fetchUserActivity(viewedProfile.id);
            renderActivity(activities);
        } else if (tabId === 'awards') {
            ui.awardsGridProfile.innerHTML = ''; // Clear previous
            renderSkeleton('awards');
            const badges = await fetchUserAwards(viewedProfile.id);
            renderAwards(badges);
        }
    }

    function renderSkeleton(tabId) {
        if (tabId === 'activity') {
            const container = ui.activityListProfile;
            container.innerHTML = ''; // Vyčistit před vložením
            let skeletonHTML = '';
            for (let i = 0; i < 3; i++) {
                skeletonHTML += `<div class="skeleton-activity-item"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton activity-line"></div><div class="skeleton activity-line text-short"></div></div></div>`;
            }
            container.innerHTML = skeletonHTML;
        } else if (tabId === 'awards') {
            const container = ui.awardsGridProfile;
            container.innerHTML = ''; // Vyčistit před vložením
            let skeletonHTML = '';
            for (let i = 0; i < 4; i++) {
                skeletonHTML += `<div class="skeleton-badge-item"><div class="skeleton icon-placeholder round"></div><div class="skeleton activity-line" style="width: 80%; margin: 0.5rem auto 0 auto;"></div></div>`;
            }
            container.innerHTML = skeletonHTML;
        }
    }

    // --- START: Inicializace a Hlavní Logika ---
    function setupEventListeners() {
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
        if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);
        if (ui.logoutBtnHeader) ui.logoutBtnHeader.addEventListener('click', async () => { if(supabase) await supabase.auth.signOut(); window.location.href = '/auth/index.html'; });

        ui.profileTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                ui.profileTabs.forEach(t => t.classList.remove('active'));
                ui.tabContents.forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`${tabId}-tab-content`).classList.add('active');
                loadTabContent(tabId);
            });
        });
        console.log("[EventListeners] Posluchači událostí nastaveni.");
    }

    async function initializeApp() {
        console.log("🚀 [Init Profile] Starting dynamic profile page...");
        cacheDOMElements();
        if (!initializeSupabase()) return;
        applyInitialSidebarState();
        if (ui.initialLoader) ui.initialLoader.style.display = 'flex';
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!session) { window.location.href = '/auth/index.html'; return; }
            currentUser = session.user;

            const [profile, titles] = await Promise.all([
                fetchProfileByUsername(currentUser.email.split('@')[0]), // Předpokládáme, že username je email prefix
                fetchTitles()
            ]);
            currentProfile = profile;
            allTitles = titles;

            if (!currentProfile) { showError("Váš profil se nepodařilo načíst.", true); return; }

            updateSidebarProfile();
            setupEventListeners();
            updateCopyrightYear();

            const urlParams = new URLSearchParams(window.location.search);
            const usernameFromUrl = urlParams.get('user');

            if (usernameFromUrl) {
                const profileToView = await fetchProfileByUsername(usernameFromUrl);
                displayProfileData(profileToView);
            } else {
                displayProfileData(currentProfile);
            }

        } catch (error) {
            console.error("Chyba při inicializaci:", error);
            showError(`Chyba aplikace: ${error.message}`, true);
        } finally {
            if (ui.initialLoader) ui.initialLoader.style.display = 'none';
        }
    }

    document.addEventListener('DOMContentLoaded', initializeApp);

})();