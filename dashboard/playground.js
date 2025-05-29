// dashboard/playground.js
(function() {
    'use strict';

    const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allBadgesList = [];
    let allTitlesList = [];
    let allAvatarDecorationsList = [];

    const SIDEBAR_STATE_KEY = 'sidebarCollapsedStatePlayground';
    const API_TIMEOUT = 30000; // 30 sekundový timeout

    const ui = {};

    async function fetchWithTimeout(promise, ms, timeoutError = new Error(`Operace vypršela po ${ms / 1000}s`)) {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(timeoutError), ms)
      );
      return Promise.race([promise, timeout]);
    }

    function cacheDOMElements() {
        console.log("[Playground CacheDOM START] Zahajuji cachování DOM elementů...");
        const elementDefinitions = [
            { key: 'initialSiteLoader', id: 'initialSiteLoader' },
            { key: 'authSection', id: 'authSection' },
            { key: 'appContent', id: 'appContent' },
            { key: 'loginFormContainer', id: 'loginFormContainer' },
            { key: 'registerFormContainer', id: 'registerFormContainer' },
            { key: 'loginForm', id: 'loginForm' },
            { key: 'registerForm', id: 'registerForm' },
            { key: 'logoutButton', id: 'logoutButton' },
            { key: 'userEmailDisplay', id: 'userEmailDisplay' },
            { key: 'userIdDisplay', id: 'userIdDisplay' },
            { key: 'userLevelDisplay', id: 'userLevelDisplay' },
            { key: 'userXpDisplay', id: 'userXpDisplay' },
            { key: 'userPointsDisplay', id: 'userPointsDisplay' },
            { key: 'userStreakDisplay', id: 'userStreakDisplay' },
            { key: 'showRegister', id: 'showRegister' },
            { key: 'showLogin', id: 'showLogin' },
            { key: 'toastContainer', id: 'toast-container' },
            { key: 'sidebar', id: 'sidebar' },
            { key: 'mainContent', id: 'main-content' },
            { key: 'sidebarOverlay', id: 'sidebar-overlay' },
            { key: 'mainMobileMenuToggle', id: 'main-mobile-menu-toggle' },
            { key: 'sidebarCloseToggle', id: 'sidebar-close-toggle' },
            { key: 'sidebarToggleBtnDesktop', id: 'sidebar-toggle-btn-desktop' },
            { key: 'userProfileSidebar', id: 'user-profile-sidebar' },
            { key: 'avatarWrapperSidebar', id: 'avatar-wrapper-sidebar' },
            { key: 'sidebarAvatar', id: 'sidebar-avatar' },
            { key: 'sidebarName', id: 'sidebar-name' },
            { key: 'sidebarUserTitle', id: 'sidebar-user-title' },
            { key: 'currentYearSidebar', id: 'currentYearSidebar' },
            { key: 'currentYearFooter', id: 'currentYearFooter' },
            { key: 'mouseFollower', id: 'mouse-follower' },
            { key: 'increaseLevelBtn', id: 'increaseLevelBtn' },
            { key: 'addXpAmount', id: 'addXpAmount' }, { key: 'addXpBtn', id: 'addXpBtn' },
            { key: 'addPointsAmount', id: 'addPointsAmount' }, { key: 'addPointsBtn', id: 'addPointsBtn' },
            { key: 'resetXpBtn', id: 'resetXpBtn' }, { key: 'resetPointsBtn', id: 'resetPointsBtn' },
            { key: 'setStreakDays', id: 'setStreakDays' }, { key: 'setStreakBtn', id: 'setStreakBtn' },
            { key: 'syncDailyStreakBtn', id: 'syncDailyStreakBtn'},
            { key: 'badgeSelect', id: 'badgeSelect' }, { key: 'addBadgeBtn', id: 'addBadgeBtn' }, { key: 'clearBadgesBtn', id: 'clearBadgesBtn' },
            { key: 'titleSelect', id: 'titleSelect' }, { key: 'equipTitleBtn', id: 'equipTitleBtn' }, { key: 'clearEquippedTitleBtn', id: 'clearEquippedTitleBtn' },
            { key: 'avatarDecorationSelect', id: 'avatarDecorationSelect' }, { key: 'setAvatarDecorationBtn', id: 'setAvatarDecorationBtn' },
            { key: 'profileDecorationSelect', id: 'profileDecorationSelect' }, { key: 'setProfileDecorationBtn', id: 'setProfileDecorationBtn' },
            { key: 'applyFallingStarsPlayground', id: 'applyFallingStarsPlayground' }, { key: 'removeAllDecorationsBtn', id: 'removeAllDecorationsBtn' },
            { key: 'notificationTitle', id: 'notificationTitle'}, { key: 'notificationMessage', id: 'notificationMessage'},
            { key: 'notificationType', id: 'notificationType'}, { key: 'notificationIcon', id: 'notificationIcon'},
            { key: 'notificationLink', id: 'notificationLink'}, { key: 'sendTestNotificationBtn', id: 'sendTestNotificationBtn'}
        ];

        let notFoundDuringCache = [];
        elementDefinitions.forEach(item => {
            const element = document.getElementById(item.id);
            ui[item.key] = element; // Store even if null
            if (!element) {
                notFoundDuringCache.push(`${item.key} (ID: ${item.id})`);
            }
        });

        if (notFoundDuringCache.length > 0) {
            // TOTO JE DŮLEŽITÝ LOG - PROSÍM, ZKONTROLUJTE, ZDA SE OBJEVÍ V KONZOLI
            console.error(`[Playground CacheDOM KONTROLA CHYB] Následující elementy NEBYLY NALEZENY v DOM: ${notFoundDuringCache.join('; ')}`);
            // Můžete zde přidat i showToast, pokud je ui.toastContainer již cachován (nebo ho zde cachovat jako první)
            if (!ui.toastContainer) ui.toastContainer = document.getElementById('toast-container'); // Jistota
            showToast(`Chyba UI: Některé elementy stránky nebyly nalezeny (${notFoundDuringCache.length}). Zkontrolujte konzoli.`, "error", 10000);
        } else {
            console.log("[Playground CacheDOM] Všechny definované elementy byly úspěšně nalezeny a cachovány.");
        }
        
        if (!ui.sidebarToggleBtnDesktop && document.getElementById('sidebar-toggle-btn')) { 
            ui.sidebarToggleBtnDesktop = document.getElementById('sidebar-toggle-btn');
            console.log("[Playground CacheDOM] Použit fallback pro sidebarToggleBtnDesktop na ID 'sidebar-toggle-btn'.");
        }
        console.log("[Playground CacheDOM FINISH] Dokončeno cachování DOM elementů.");
    }

    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }

    function showToast(message, type = 'info', duration = 3500) {
        if (!ui.toastContainer) {
            ui.toastContainer = document.getElementById('toast-container'); 
            if (!ui.toastContainer) {
                console.error("CHYBA ZOBRAZENÍ TOASTU: Element #toast-container stále nebyl nalezen. Toast se nezobrazí. Zpráva: " + message);
                return; 
            }
        }
        const toastId = `toast-${Date.now()}`;
        const notification = document.createElement('div');
        notification.className = `toast ${type}`;
        notification.id = toastId;
        notification.innerHTML = `<i class="toast-icon"></i><div class="toast-message">${sanitizeHTML(message)}</div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`;
        const iconElement = notification.querySelector('.toast-icon');
        iconElement.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : (type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle')}`;
        notification.querySelector('.toast-close').addEventListener('click', () => { notification.classList.remove('show'); setTimeout(() => notification.remove(), 400); });
        ui.toastContainer.appendChild(notification);
        requestAnimationFrame(() => notification.classList.add('show'));
        setTimeout(() => { if (notification.parentElement) { notification.classList.remove('show'); setTimeout(() => notification.remove(), 400); } }, duration);
    }

    function initializeSupabase() {
        try {
            if (!window.supabase?.createClient) throw new Error("Supabase library error.");
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            if (!supabase) throw new Error("Supabase client creation failed.");
            console.log('[Supabase] Playground Client initialized.');
            return true;
        } catch (error) {
            console.error('[Supabase] Playground Init Error:', error.message);
            showToast(`Kritická chyba Supabase: ${error.message}`, "error", 10000);
            if (ui.initialSiteLoader) ui.initialSiteLoader.innerHTML = "<p style='color:var(--accent-pink)'>Nelze se připojit k databázi.</p>";
            return false;
        }
    }

    function getInitials(profile) {
        if (!profile) return '?';
        const f = profile.first_name?.[0] || '';
        const l = profile.last_name?.[0] || '';
        return (f + l).toUpperCase() || profile.username?.[0].toUpperCase() || profile.email?.[0].toUpperCase() || '?';
    }

    function updateUserInfoUI() {
        const requiredUiKeys = [
            'sidebarName', 'sidebarAvatar', 'sidebarUserTitle', 
            'userEmailDisplay', 'userIdDisplay', 'userLevelDisplay', 
            'userXpDisplay', 'userPointsDisplay', 'userStreakDisplay',
            'avatarWrapperSidebar', 'userProfileSidebar'
        ];
        let missingKeysMessages = [];
        requiredUiKeys.forEach(key => {
            if (!ui[key]) {
                missingKeysMessages.push(key);
            }
        });

        if (missingKeysMessages.length > 0) {
            console.warn(`[Playground UI Update KONTROLA] Před aktualizací UI chybí elementy: ${missingKeysMessages.join(', ')}`);
        }

        if (!currentUser || !currentProfile) {
            if (ui.sidebarName) ui.sidebarName.textContent = "Nepřihlášen"; else console.warn("ui.sidebarName chybí");
            if (ui.sidebarAvatar) ui.sidebarAvatar.innerHTML = "?"; else console.warn("ui.sidebarAvatar chybí");
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = "Pilot"; else console.warn("ui.sidebarUserTitle chybí");
            if (ui.userEmailDisplay) ui.userEmailDisplay.textContent = "N/A"; else console.warn("ui.userEmailDisplay chybí");
            if (ui.userIdDisplay) ui.userIdDisplay.textContent = "N/A"; else console.warn("ui.userIdDisplay chybí");
            if (ui.userLevelDisplay) ui.userLevelDisplay.textContent = "N/A"; else console.warn("ui.userLevelDisplay chybí");
            if (ui.userXpDisplay) ui.userXpDisplay.textContent = "N/A"; else console.warn("ui.userXpDisplay chybí");
            if (ui.userPointsDisplay) ui.userPointsDisplay.textContent = "N/A"; else console.warn("ui.userPointsDisplay chybí");
            if (ui.userStreakDisplay) ui.userStreakDisplay.textContent = "N/A"; else console.warn("ui.userStreakDisplay chybí");
            if (ui.avatarWrapperSidebar) ui.avatarWrapperSidebar.removeAttribute('data-decoration-key'); else console.warn("ui.avatarWrapperSidebar chybí");
            if (ui.userProfileSidebar) ui.userProfileSidebar.removeAttribute('data-profile-decoration'); else console.warn("ui.userProfileSidebar chybí");
            return;
        }

        const displayName = `${currentProfile.first_name || ''} ${currentProfile.last_name || ''}`.trim() || currentProfile.username || currentUser.email.split('@')[0];
        if (ui.sidebarName) ui.sidebarName.textContent = sanitizeHTML(displayName);
        if (ui.userEmailDisplay) ui.userEmailDisplay.textContent = sanitizeHTML(currentUser.email);
        if (ui.userIdDisplay) ui.userIdDisplay.textContent = sanitizeHTML(currentUser.id);
        if (ui.userLevelDisplay) ui.userLevelDisplay.textContent = currentProfile.level || 1;
        if (ui.userXpDisplay) ui.userXpDisplay.textContent = currentProfile.experience || 0;
        if (ui.userPointsDisplay) ui.userPointsDisplay.textContent = currentProfile.points || 0;
        if (ui.userStreakDisplay) ui.userStreakDisplay.textContent = currentProfile.streak_days || 0;

        const initials = getInitials(currentProfile);
        let avatarUrl = currentProfile.avatar_url;
        if (avatarUrl && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))) {
             avatarUrl += `?t=${new Date().getTime()}`;
        }

        if (ui.sidebarAvatar) {
            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="Avatar">` : sanitizeHTML(initials);
            const img = ui.sidebarAvatar.querySelector('img');
            if (img) img.onerror = () => { if(ui.sidebarAvatar) ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); };
        }

        if (ui.sidebarUserTitle) {
            const selectedTitleKey = currentProfile.selected_title;
            let displayTitle = 'Pilot';
            if (selectedTitleKey && allTitlesList.length > 0) {
                const foundTitle = allTitlesList.find(t => t.title_key === selectedTitleKey);
                if (foundTitle) displayTitle = foundTitle.name;
            }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.title = sanitizeHTML(displayTitle);
        }

        if (ui.avatarWrapperSidebar) {
            if (currentProfile.selected_decoration) {
                ui.avatarWrapperSidebar.setAttribute('data-decoration-key', currentProfile.selected_decoration);
            } else {
                ui.avatarWrapperSidebar.removeAttribute('data-decoration-key');
            }
        }
        if (ui.userProfileSidebar) {
            if (currentProfile.selected_profile_decoration) {
                ui.userProfileSidebar.setAttribute('data-profile-decoration', currentProfile.selected_profile_decoration);
            } else {
                ui.userProfileSidebar.removeAttribute('data-profile-decoration');
            }
        }
    }

    function showAppContent(show) {
        if (show) {
            if (ui.authSection) ui.authSection.classList.add('hidden');
            if (ui.appContent) ui.appContent.classList.remove('hidden');
            if (ui.sidebar) ui.sidebar.style.display = 'flex';
            if (ui.mainContent) ui.mainContent.style.display = 'flex'; 
            if (ui.logoutButton) ui.logoutButton.style.display = 'inline-flex';
        } else {
            if (ui.authSection) ui.authSection.classList.remove('hidden');
            if (ui.appContent) ui.appContent.classList.add('hidden');
            if (ui.sidebar) ui.sidebar.style.display = 'none';
            if (ui.mainContent) ui.mainContent.style.display = 'none';
            if (ui.logoutButton) ui.logoutButton.style.display = 'none';
        }
    }
    
    async function fetchUserProfileData() {
        if (!currentUser || !supabase) return null;
        try {
            console.log(`[Playground fetchUserProfileData] Fetching for ${currentUser.id}`);
            const { data, error } = await fetchWithTimeout(
                supabase
                    .from('profiles')
                    .select('*') 
                    .eq('id', currentUser.id)
                    .single(),
                API_TIMEOUT 
            );

            if (error && error.code !== 'PGRST116') throw error; 
            if (!data) { 
                 console.log("Profil nenalezen, vytvářím výchozí pro playground...");
                const defaultProfile = {
                    id: currentUser.id, email: currentUser.email,
                    username: currentUser.email.split('@')[0] || `user_${currentUser.id.substring(0,6)}`,
                    level: 1, experience: 0, points: 0, streak_days: 0, longest_streak_days: 0, badges_count: 0,
                    last_login: new Date().toISOString(), updated_at: new Date().toISOString(),
                    preferences: {"language":"cs","dark_mode":true,"show_progress":true,"sound_effects":true}, 
                    notifications: {"email":true,"study_tips":true,"content_updates":true,"practice_reminders":true},
                    purchased_titles: [], selected_title: null,
                    purchased_decorations: [], selected_decoration: null, selected_profile_decoration: null,
                    monthly_claims: {}, last_milestone_claimed: 0
                };
                const { data: newProfile, error: createError } = await fetchWithTimeout(
                    supabase
                        .from('profiles')
                        .insert(defaultProfile)
                        .select('*')
                        .single(),
                    API_TIMEOUT
                );
                if (createError) throw createError;
                console.log("[Playground fetchUserProfileData] Default profile created:", newProfile);
                return newProfile;
            }
            console.log("[Playground fetchUserProfileData] Profile fetched:", data);
            return data;
        } catch (e) {
            console.error('Chyba načítání/vytváření profilu:', e);
            showToast(`Chyba profilu: ${e.message}`, 'error');
            return null; 
        }
    }

    async function handleAuthStateChange(event, session) {
        console.log('Playground Auth state change:', event, session);
        try {
            if (session && session.user) {
                currentUser = session.user;
                currentProfile = await fetchUserProfileData(); 
                if (!currentProfile) {
                     showToast("Nepodařilo se načíst profil uživatele.", "error");
                     showAppContent(false); 
                     if (ui.initialSiteLoader && !ui.initialSiteLoader.classList.contains('hidden')) {
                        ui.initialSiteLoader.style.opacity = '0';
                        setTimeout(() => { if(ui.initialSiteLoader) ui.initialSiteLoader.style.display = 'none'; }, 300);
                     }
                     return; 
                }
                await loadInitialSelectData(); 
                updateUserInfoUI();
                showAppContent(true);
            } else {
                currentUser = null;
                currentProfile = null;
                updateUserInfoUI();
                showAppContent(false);
            }
        } catch (error) {
            console.error("Kritická chyba v onAuthStateChange handleru (Playground):", error);
            showToast("Nastala kritická chyba. Zkuste obnovit stránku.", "error", 10000);
            currentUser = null; currentProfile = null;
            updateUserInfoUI(); showAppContent(false);
        } finally {
            if (ui.initialSiteLoader && !ui.initialSiteLoader.classList.contains('hidden')) {
                console.log("[Playground handleAuthStateChange FINALLY] Skrývám initialSiteLoader.");
                ui.initialSiteLoader.style.opacity = '0';
                setTimeout(() => { 
                    if(ui.initialSiteLoader) ui.initialSiteLoader.style.display = 'none'; 
                }, 300);
            }
        }
    }

    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    
    function toggleSidebarDesktop() {
        const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded');
        const icon = ui.sidebarToggleBtnDesktop?.querySelector('i');
        if (icon) icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        if (ui.sidebarToggleBtnDesktop) ui.sidebarToggleBtnDesktop.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel';
    }

    function applyInitialSidebarState() {
        const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);
        const shouldBeCollapsed = savedState === 'collapsed';
        document.body.classList.toggle('sidebar-collapsed', shouldBeCollapsed);
        const icon = ui.sidebarToggleBtnDesktop?.querySelector('i');
        if (icon) icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        if (ui.sidebarToggleBtnDesktop) ui.sidebarToggleBtnDesktop.title = shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel';
    }

    function updateCopyrightYear() { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; }
    function initTooltips() { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } }
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); if (follower) follower.style.opacity = '1'; hasMoved = true; } requestAnimationFrame(() => { if(follower) {follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`;} }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved && follower) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved && follower) follower.style.opacity = '1'; }); };

    async function updateProfileField(updates) {
        if (!currentUser || !supabase) {
            showToast("Nejste přihlášeni nebo chyba spojení.", "error");
            return false;
        }
        try {
            updates.updated_at = new Date().toISOString();
            const { data, error } = await fetchWithTimeout( 
                 supabase
                    .from('profiles')
                    .update(updates)
                    .eq('id', currentUser.id)
                    .select() 
                    .single(), 
                API_TIMEOUT
            );
            if (error) throw error;
            currentProfile = data; 
            updateUserInfoUI();
            showToast("Profil úspěšně aktualizován!", "success");
            return true;
        } catch (e) {
            console.error("Chyba aktualizace profilu:", e);
            showToast(`Chyba: ${e.message}`, "error");
            return false;
        }
    }

    async function increaseLevel() {
        if (!currentProfile) return;
        const newLevel = (currentProfile.level || 1) + 1;
        await updateProfileField({ level: newLevel });
    }

    async function addExperience(amount) {
        if (!currentProfile) return;
        const newExperience = (currentProfile.experience || 0) + amount;
        await updateProfileField({ experience: newExperience });
    }

    async function addPoints(amount) {
        if (!currentProfile) return;
        const newPoints = (currentProfile.points || 0) + amount;
        await updateProfileField({ points: newPoints });
    }

    async function resetExperienceForLevel() {
        if (!currentProfile || !currentProfile.level) return;
        let threshold = 0;
        const base_xp = 100;
        const increment_xp = 25;
        if (currentProfile.level > 1) {
            for (let i = 1; i < currentProfile.level; i++) {
                threshold += (base_xp + (increment_xp * (i - 1)));
            }
        }
        await updateProfileField({ experience: threshold });
    }

    async function resetPoints() {
        await updateProfileField({ points: 0 });
    }

    async function setStreak(days) {
        const updates = { streak_days: days };
        if (!currentProfile || days > (currentProfile.longest_streak_days || 0)) {
            updates.longest_streak_days = days;
        }
        await updateProfileField(updates);
    }
    
    async function syncDailyStreak() {
        if (!currentUser || !currentProfile || !supabase) {
            showToast("Pro synchronizaci série je nutné být přihlášen.", "error");
            return;
        }
        showToast("Synchronizuji denní sérii...", "info");
        try {
            const { data: streakData, error: streakError } = await fetchWithTimeout( 
                supabase.rpc('update_user_streak_and_get_profile', { p_user_id: currentUser.id }),
                API_TIMEOUT
            );
            if (streakError) throw streakError;

            if (streakData) {
                currentProfile = streakData; 
                updateUserInfoUI();
                showToast("Denní série synchronizována a profil aktualizován.", "success");
            } else {
                currentProfile = await fetchUserProfileData();
                updateUserInfoUI();
                showToast("Synchronizace série dokončena, profil obnoven.", "warning");
            }
        } catch (error) {
            console.error("Chyba synchronizace denní série:", error);
            showToast(`Chyba synchronizace série: ${error.message}`, "error");
        }
    }

    async function fetchAllBadgesDefinition() {
        if (!supabase) return [];
        try {
            const { data, error } = await fetchWithTimeout( 
                supabase.from('badges').select('id, title, description'),
                API_TIMEOUT
            );
            if (error) throw error;
            allBadgesList = data || [];
            populateSelect(ui.badgeSelect, allBadgesList, 'id', 'title');
        } catch (e) {
            console.error("Error fetching badge definitions:", e);
            showToast("Nepodařilo se načíst definice odznaků: " + e.message, "error");
            allBadgesList = [];
            populateSelect(ui.badgeSelect, [], 'id', 'title');
        }
    }

    async function awardSpecificBadge(badgeId) {
        if (!currentUser || !supabase || !badgeId) return;
        try {
            const { data: existing, error: checkError } = await fetchWithTimeout( 
                supabase
                    .from('user_badges')
                    .select('badge_id')
                    .eq('user_id', currentUser.id)
                    .eq('badge_id', badgeId)
                    .maybeSingle(),
                API_TIMEOUT
            );
            if (checkError) throw checkError;
            if (existing) {
                showToast("Tento odznak již uživatel vlastní.", "info");
                return;
            }
            const { error: insertError } = await fetchWithTimeout( 
                 supabase.from('user_badges').insert({ user_id: currentUser.id, badge_id: badgeId }),
                 API_TIMEOUT
            );
            if (insertError) throw insertError;

            const newBadgeCount = (currentProfile.badges_count || 0) + 1;
            await updateProfileField({ badges_count: newBadgeCount });
            showToast("Odznak úspěšně přidán!", "success");
        } catch (e) {
            console.error("Chyba při přidávání odznaku:", e);
            showToast(`Chyba: ${e.message}`, "error");
        }
    }

    async function clearUserBadges() {
        if (!currentUser || !supabase) return;
        if (!confirm("Opravdu chcete smazat všechny odznaky tohoto uživatele?")) return;
        try {
            const { error } = await fetchWithTimeout( 
                supabase.from('user_badges').delete().eq('user_id', currentUser.id),
                API_TIMEOUT
            );
            if (error) throw error;
            await updateProfileField({ badges_count: 0 });
            showToast("Všechny odznaky byly smazány.", "success");
        } catch (e) {
            console.error("Chyba při mazání odznaků:", e);
            showToast(`Chyba: ${e.message}`, "error");
        }
    }

    async function fetchAllTitles() {
        if (!supabase) return [];
        try {
            const { data, error } = await fetchWithTimeout( 
                supabase.from('title_shop').select('title_key, name'),
                API_TIMEOUT
            );
            if (error) throw error;
            allTitlesList = data || [];
            populateSelect(ui.titleSelect, allTitlesList, 'title_key', 'name');
        } catch (e) {
            console.error("Error fetching titles:", e);
            showToast("Nepodařilo se načíst tituly: " + e.message, "error");
            allTitlesList = [];
            populateSelect(ui.titleSelect, [], 'title_key', 'name');
        }
    }

    async function equipTitle(titleKey) {
        let purchased = Array.isArray(currentProfile.purchased_titles) ? [...currentProfile.purchased_titles] : [];
        if (titleKey && !purchased.includes(titleKey)) {
            purchased.push(titleKey);
        }
        await updateProfileField({ selected_title: titleKey, purchased_titles: purchased });
    }
    async function clearEquippedTitle() {
        await updateProfileField({ selected_title: null });
    }

    async function fetchAvatarDecorations() {
        if (!supabase) return;
        try {
            const { data, error } = await fetchWithTimeout( 
                supabase
                    .from('avatar_decorations_shop')
                    .select('decoration_key, name, image_url') 
                    .eq('is_available', true),
                API_TIMEOUT
            );
            if (error) throw error;
            allAvatarDecorationsList = data || [];
            populateSelect(ui.avatarDecorationSelect, allAvatarDecorationsList, 'decoration_key', 'name');
        } catch (e) {
            console.error("Error fetching avatar decorations:", e);
            showToast("Nepodařilo se načíst dekorace avatarů: " + e.message, "error");
            allAvatarDecorationsList = [];
            populateSelect(ui.avatarDecorationSelect, [], 'decoration_key', 'name');
        }
    }
    
    async function setAvatarDecoration(decorationKey) {
         let purchased = Array.isArray(currentProfile.purchased_decorations) ? [...currentProfile.purchased_decorations] : [];
         if (decorationKey && !purchased.includes(decorationKey)) {
             purchased.push(decorationKey);
         }
        await updateProfileField({ selected_decoration: decorationKey || null, purchased_decorations: purchased });
    }

    async function setProfileDecoration(decorationKey) {
        await updateProfileField({ selected_profile_decoration: decorationKey || null });
    }
    async function sendTestNotification() {
        if (!currentUser || !supabase) {
            showToast("Pro odeslání notifikace je nutné být přihlášen.", "error");
            return;
        }
        const title = ui.notificationTitle.value.trim();
        const message = ui.notificationMessage.value.trim();
        const type = ui.notificationType.value;
        const icon = ui.notificationIcon.value.trim() || null; 
        const link = ui.notificationLink.value.trim() || null; 

        if (!title || !message) {
            showToast("Titul a zpráva notifikace jsou povinné.", "warning");
            return;
        }
        showToast("Odesílám testovací notifikaci...", "info");
        try {
            const { error } = await fetchWithTimeout( 
                supabase
                    .from('user_notifications')
                    .insert({
                        user_id: currentUser.id, title: title, message: message,
                        type: type, icon: icon, link: link, is_read: false
                    }),
                API_TIMEOUT
            );
            if (error) throw error;
            showToast("Testovací notifikace úspěšně odeslána!", "success");
        } catch (e) {
            console.error("Chyba při odesílání notifikace:", e);
            showToast(`Chyba odeslání: ${e.message}`, "error");
        }
    }

    function populateSelect(selectElement, items, valueKey, textKey) {
        if (!selectElement || !items) return;
        selectElement.innerHTML = '<option value="">-- Vybrat --</option>'; 
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueKey];
            option.textContent = item[textKey];
            selectElement.appendChild(option);
        });
    }
    
    async function loadInitialSelectData() {
        console.log("[Playground] Načítání dat pro select boxy...");
        const promises = [
            fetchAllBadgesDefinition(),
            fetchAllTitles(),
            fetchAvatarDecorations()
        ];
        try {
            await Promise.all(promises); 
            console.log("[Playground] Data pro select boxy načtena.");
        } catch (error) {
            console.error("[Playground] Chyba při hromadném načítání dat pro selecty:", error);
        }
    }

    function setupEventListeners() {
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
        if (ui.sidebarToggleBtnDesktop) ui.sidebarToggleBtnDesktop.addEventListener('click', toggleSidebarDesktop);
        
        if (ui.loginForm) ui.loginForm.addEventListener('submit', async (e) => { e.preventDefault(); const email = ui.loginForm.email.value; const password = ui.loginForm.password.value; const button = ui.loginForm.querySelector('button[type="submit"]'); button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Přihlašuji...'; try { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; showToast("Přihlášení úspěšné!", "success"); } catch (error) { showToast(`Chyba přihlášení: ${error.message}`, "error"); } finally { button.disabled = false; button.innerHTML = 'Přihlásit se'; } });
        if (ui.registerForm) ui.registerForm.addEventListener('submit', async (e) => { e.preventDefault(); const email = ui.registerForm.email.value; const password = ui.registerForm.password.value; const button = ui.registerForm.querySelector('button[type="submit"]'); button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registruji...'; try { const { error } = await supabase.auth.signUp({ email, password }); if (error) throw error; showToast("Registrace úspěšná! Zkontrolujte svůj email pro potvrzení.", "success"); if(ui.registerFormContainer) ui.registerFormContainer.classList.add('hidden'); if(ui.loginFormContainer) ui.loginFormContainer.classList.remove('hidden'); } catch (error) { showToast(`Chyba registrace: ${error.message}`, "error"); } finally { button.disabled = false; button.innerHTML = 'Zaregistrovat se'; } });
        if (ui.logoutButton) ui.logoutButton.addEventListener('click', async () => { try { const { error } = await supabase.auth.signOut(); if (error) throw error; showToast("Odhlášení úspěšné.", "info"); } catch (error) { showToast(`Chyba odhlášení: ${error.message}`, "error"); } });
        if (ui.showRegister) ui.showRegister.addEventListener('click', () => { if(ui.loginFormContainer) ui.loginFormContainer.classList.add('hidden'); if(ui.registerFormContainer) ui.registerFormContainer.classList.remove('hidden'); });
        if (ui.showLogin) ui.showLogin.addEventListener('click', () => { if(ui.registerFormContainer) ui.registerFormContainer.classList.add('hidden'); if(ui.loginFormContainer) ui.loginFormContainer.classList.remove('hidden'); });

        if (ui.increaseLevelBtn) ui.increaseLevelBtn.addEventListener('click', increaseLevel);
        if (ui.addXpBtn) ui.addXpBtn.addEventListener('click', () => addExperience(parseInt(ui.addXpAmount.value) || 0));
        if (ui.addPointsBtn) ui.addPointsBtn.addEventListener('click', () => addPoints(parseInt(ui.addPointsAmount.value) || 0));
        if (ui.resetXpBtn) ui.resetXpBtn.addEventListener('click', resetExperienceForLevel);
        if (ui.resetPointsBtn) ui.resetPointsBtn.addEventListener('click', resetPoints);
        if (ui.setStreakBtn) ui.setStreakBtn.addEventListener('click', () => setStreak(parseInt(ui.setStreakDays.value) || 0));
        if (ui.syncDailyStreakBtn) ui.syncDailyStreakBtn.addEventListener('click', syncDailyStreak);
        if (ui.addBadgeBtn) ui.addBadgeBtn.addEventListener('click', () => {const badgeVal = ui.badgeSelect.value; if(badgeVal) awardSpecificBadge(parseInt(badgeVal)); else showToast("Vyberte odznak.", "warning");});
        if (ui.clearBadgesBtn) ui.clearBadgesBtn.addEventListener('click', clearUserBadges);
        if (ui.equipTitleBtn) ui.equipTitleBtn.addEventListener('click', () => {const titleVal = ui.titleSelect.value; if(titleVal) equipTitle(titleVal); else showToast("Vyberte titul.", "warning");});
        if (ui.clearEquippedTitleBtn) ui.clearEquippedTitleBtn.addEventListener('click', clearEquippedTitle);
        if (ui.setAvatarDecorationBtn) ui.setAvatarDecorationBtn.addEventListener('click', () => setAvatarDecoration(ui.avatarDecorationSelect.value || null));
        if (ui.setProfileDecorationBtn) ui.setProfileDecorationBtn.addEventListener('click', () => setProfileDecoration(ui.profileDecorationSelect.value || null));
        if (ui.applyFallingStarsPlayground) ui.applyFallingStarsPlayground.addEventListener('click', () => setAvatarDecoration('avatar_falling_elements'));
        if (ui.removeAllDecorationsBtn) ui.removeAllDecorationsBtn.addEventListener('click', () => { setAvatarDecoration(null); setProfileDecoration(null); });
        if(ui.sendTestNotificationBtn) ui.sendTestNotificationBtn.addEventListener('click', sendTestNotification);

        window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus);
         console.log("[Playground] Event listeners setup complete.");
    }
    function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení bylo ztraceno.', 'warning'); }

    async function initializeApp() {
        cacheDOMElements();
        if (!initializeSupabase()) {
             if (ui.initialSiteLoader) {
                ui.initialSiteLoader.innerHTML = "<p style='color:var(--accent-pink)'>Chyba! Nelze inicializovat databázi.</p>";
                // Neschováváme loader, aby chyba byla viditelná
             }
            return;
        }
        
        applyInitialSidebarState();
        setupEventListeners();
        updateCopyrightYear();
        initTooltips();
        initMouseFollower();
        updateOnlineStatus();

        if (ui.initialSiteLoader) {
            ui.initialSiteLoader.style.opacity = '1'; 
            ui.initialSiteLoader.style.display = 'flex';
        }
        if (ui.sidebar) ui.sidebar.style.display = 'none'; 
        if (ui.mainContent) ui.mainContent.style.display = 'none'; 
        
        supabase.auth.onAuthStateChange(handleAuthStateChange);
        
        try {
            console.log("[Playground initializeApp] Pokus o získání session...");
            const { data: { session } } = await fetchWithTimeout(supabase.auth.getSession(), API_TIMEOUT);
            console.log("[Playground initializeApp] getSession výsledek:", session);
            handleAuthStateChange('INITIAL_CHECK', session);
        } catch(e) {
            console.error("[Playground initializeApp] Initial session check/timeout failed:", e);
            handleAuthStateChange('INITIAL_CHECK_ERROR', null); 
            showToast("Chyba při ověřování sezení: " + e.message, "error");
        }
        // NEBUdeme zde volat finally pro skrytí loaderu, to je teď plně v zodpovědnosti handleAuthStateChange
    }

    document.addEventListener('DOMContentLoaded', initializeApp);
})();
// EDIT LOGS:
// Developer Goal: Address persistent "UI elements missing" warning and potential issues with initial loader hiding.
// Stage:
//  - Refined `cacheDOMElements`:
//    - Changed the logging for missing elements to `console.error` to make it more prominent.
//    - Added a specific log when all elements are found successfully.
//    - The special handling for `toast-container` was kept from the previous version.
//  - Refined `updateUserInfoUI`:
//    - It now logs a more detailed warning for each specific UI key that is missing, rather than one generic message. This will help pinpoint if `ui.sidebarName` is null, or `ui.userEmailDisplay`, etc.
//  - Ensured `handleAuthStateChange` robustly handles the `ui.initialSiteLoader` in its `finally` block. This block should execute regardless of errors in the `try` block (unless the error is so catastrophic it halts all JS).
//  - The `initializeApp`'s own `finally` block for hiding the loader was removed, as `handleAuthStateChange` should now be the definitive place for this logic once a session state (even error/null) is determined.
//  - Kept `API_TIMEOUT` at 30000ms.
//  - Kept `fetchWithTimeout` and its application to all relevant Supabase calls.