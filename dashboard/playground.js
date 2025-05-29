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
    let allAvatarDecorationsList = []; // Pro dekorace z DB (pokud budou)

    const SIDEBAR_STATE_KEY = 'sidebarCollapsedStatePlayground'; // Unique key for playground

    const ui = {};

    function cacheDOMElements() {
        const ids = [
            'initialSiteLoader', 'authSection', 'appContent', 'loginFormContainer',
            'registerFormContainer', 'loginForm', 'registerForm', 'logoutButton',
            'userEmailDisplay', 'userIdDisplay', 'userLevelDisplay', 'userXpDisplay', 'userPointsDisplay', 'userStreakDisplay',
            'showRegister', 'showLogin', 'toast-container', 'sidebar', 'main-content',
            'sidebar-overlay', 'main-mobile-menu-toggle', 'sidebar-close-toggle',
            'sidebar-toggle-btn-desktop', // Using desktop specific ID from HTML
            'user-profile-sidebar', 'avatar-wrapper-sidebar', 'sidebar-avatar',
            'sidebar-name', 'sidebar-user-title', 'currentYearSidebar', 'currentYearFooter',
            'mouse-follower', 'increaseLevelBtn', 'addXpAmount', 'addXpBtn',
            'addPointsAmount', 'addPointsBtn', 'resetXpBtn', 'resetPointsBtn',
            'setStreakDays', 'setStreakBtn', 'syncDailyStreakBtn', 'badgeSelect', 'addBadgeBtn', 'clearBadgesBtn',
            'titleSelect', 'equipTitleBtn', 'clearEquippedTitleBtn',
            'avatarDecorationSelect', 'setAvatarDecorationBtn', 'profileDecorationSelect',
            'setProfileDecorationBtn', 'applyFallingStarsPlayground', 'removeAllDecorationsBtn',
            'notificationTitle', 'notificationMessage', 'notificationType', 'notificationIcon', 'notificationLink', 'sendTestNotificationBtn'
        ];
        ids.forEach(id => ui[id] = document.getElementById(id));
        if (!ui.sidebarToggleBtnDesktop && ui.sidebarToggleBtn) { // Fallback if only generic ID was used
            ui.sidebarToggleBtnDesktop = ui.sidebarToggleBtn;
        }
    }

    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }

    function showToast(message, type = 'info', duration = 3500) {
        if (!ui.toastContainer) { console.warn("Toast container not found"); return; }
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
        if (!currentUser || !currentProfile) {
            if (ui.sidebarName) ui.sidebarName.textContent = "Nepřihlášen";
            if (ui.sidebarAvatar) ui.sidebarAvatar.innerHTML = "?";
            if (ui.sidebarUserTitle) ui.sidebarUserTitle.textContent = "Pilot";
            if (ui.userEmailDisplay) ui.userEmailDisplay.textContent = "N/A";
            if (ui.userIdDisplay) ui.userIdDisplay.textContent = "N/A";
            if (ui.userLevelDisplay) ui.userLevelDisplay.textContent = "N/A";
            if (ui.userXpDisplay) ui.userXpDisplay.textContent = "N/A";
            if (ui.userPointsDisplay) ui.userPointsDisplay.textContent = "N/A";
            if (ui.userStreakDisplay) ui.userStreakDisplay.textContent = "N/A";
            if (ui.avatarWrapperSidebar) ui.avatarWrapperSidebar.removeAttribute('data-decoration-key');
            if (ui.userProfileSidebar) ui.userProfileSidebar.removeAttribute('data-profile-decoration');
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
             avatarUrl += `?t=${new Date().getTime()}`; // Cache busting for external URLs
        }

        if (ui.sidebarAvatar) {
            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="Avatar">` : sanitizeHTML(initials);
            const img = ui.sidebarAvatar.querySelector('img');
            if (img) img.onerror = () => { ui.sidebarAvatar.innerHTML = sanitizeHTML(initials); };
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
            if (ui.mainContent) ui.mainContent.style.display = 'flex'; // main content visible
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
            const { data, error } = await supabase
                .from('profiles')
                .select('*') // Select all for simplicity in playground
                .eq('id', currentUser.id)
                .single();
            if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows found
            if (!data) { // If no profile, create one
                 console.log("Profil nenalezen, vytvářím výchozí pro playground...");
                const defaultProfile = {
                    id: currentUser.id,
                    email: currentUser.email,
                    username: currentUser.email.split('@')[0] || `user_${currentUser.id.substring(0,6)}`,
                    level: 1, experience: 0, points: 0, streak_days: 0, longest_streak_days: 0, badges_count: 0,
                    last_login: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    preferences: {}, notifications: {},
                    purchased_titles: [], selected_title: null,
                    purchased_decorations: [], selected_decoration: null, selected_profile_decoration: null,
                };
                const { data: newProfile, error: createError } = await supabase
                    .from('profiles')
                    .insert(defaultProfile)
                    .select('*')
                    .single();
                if (createError) throw createError;
                return newProfile;
            }
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
                     showAppContent(false); // Zobrazit login
                     return;
                }
                await loadInitialSelectData(); // Načtení dat pro selecty
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
            if (ui.initialSiteLoader) {
                ui.initialSiteLoader.style.opacity = '0';
                setTimeout(() => { if(ui.initialSiteLoader) ui.initialSiteLoader.style.display = 'none'; }, 300);
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

    // --- Core Testing Functions ---
    async function updateProfileField(updates) {
        if (!currentUser || !supabase) {
            showToast("Nejste přihlášeni nebo chyba spojení.", "error");
            return false;
        }
        try {
            updates.updated_at = new Date().toISOString();
            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', currentUser.id)
                .select()
                .single();
            if (error) throw error;
            currentProfile = data; // Update local profile
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
        // XP needed for this new level (based on DB function logic, if we want to be precise)
        // For simplicity here, we just increase level. DB trigger for level up based on XP is primary.
        // This function in playground is for *forcing* a level, not natural progression.
        // To ensure XP is consistent with the new level, we could calculate the minimum XP for that level.
        // Let's assume get_total_exp_threshold(level) gives XP for START of that level.
        // We need XP for start of newLevel + 1 to be sure.
        // OR, let's just add a moderate amount of XP that would trigger the level up.
        // Simpler: just set level. The DB trigger should not fire IF experience isn't also changing.
        // However, if we WANT the trigger to fire, we should set XP to required for level up.
        // For now, let's just increment the level directly.
        await updateProfileField({ level: newLevel });
    }

    async function addExperience(amount) {
        if (!currentProfile) return;
        const newExperience = (currentProfile.experience || 0) + amount;
        // The database trigger handle_level_up should automatically adjust the level
        await updateProfileField({ experience: newExperience });
    }

    async function addPoints(amount) {
        if (!currentProfile) return;
        const newPoints = (currentProfile.points || 0) + amount;
        await updateProfileField({ points: newPoints });
    }

    async function resetExperienceForLevel() {
        if (!currentProfile || !currentProfile.level) return;
        // This requires the DB function get_total_exp_threshold to exist and be callable by Supabase.
        // Or, we replicate the logic here.
        // Logic from DB: BASE_XP = 100, INCREMENT_XP = 25
        // Threshold for level L is SUM (BASE + INCREMENT * (i-1)) for i=1 to L-1
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
            // We simulate the daily login logic, which might be more complex in the actual dashboard
            // For playground, just setting last_login to yesterday and then triggering an update
            // or calling a specific function if available.
            // A simplified approach: Set last_login to far past to ensure streak can be incremented by profile update.
            const farPastDate = new Date(0).toISOString(); // Epoch time
            const { error: loginUpdateError } = await supabase
                .from('profiles')
                .update({ last_login: farPastDate, updated_at: new Date().toISOString() })
                .eq('id', currentUser.id);

            if (loginUpdateError) throw loginUpdateError;

            // Now, fetch and update the profile. If `handle_user_login_streak` trigger is active on UPDATE,
            // it should handle the streak.
            // Or, if there's a specific function, call it.
            // For now, let's just rely on a profile update potentially triggering it.
            // A more direct way is to call a specific DB function if one exists for this.
            // Let's call 'update_user_streak' function that was in oceneni.js logic before.
            const { data: streakData, error: streakError } = await supabase.rpc('update_user_streak_and_get_profile', {
                p_user_id: currentUser.id
            });

            if (streakError) throw streakError;

            if (streakData) {
                currentProfile = streakData; // RPC returns the updated profile
                updateUserInfoUI();
                showToast("Denní série synchronizována a profil aktualizován.", "success");
            } else {
                showToast("Synchronizace série dokončena, ale nebyly vráceny data profilu.", "warning");
            }

        } catch (error) {
            console.error("Chyba synchronizace denní série:", error);
            showToast(`Chyba synchronizace série: ${error.message}`, "error");
        }
    }


    async function fetchAllBadgesDefinition() {
        if (!supabase) return [];
        try {
            const { data, error } = await supabase.from('badges').select('id, title, description');
            if (error) throw error;
            allBadgesList = data || [];
            populateSelect(ui.badgeSelect, allBadgesList, 'id', 'title');
        } catch (e) {
            console.error("Error fetching badge definitions:", e);
            showToast("Nepodařilo se načíst definice odznaků.", "error");
        }
    }

    async function awardSpecificBadge(badgeId) {
        if (!currentUser || !supabase || !badgeId) return;
        try {
            // Check if user already has this badge
            const { data: existing, error: checkError } = await supabase
                .from('user_badges')
                .select('badge_id')
                .eq('user_id', currentUser.id)
                .eq('badge_id', badgeId)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existing) {
                showToast("Tento odznak již uživatel vlastní.", "info");
                return;
            }

            const { error: insertError } = await supabase
                .from('user_badges')
                .insert({ user_id: currentUser.id, badge_id: badgeId });
            if (insertError) throw insertError;

            // Update badges_count in profiles
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
            const { error } = await supabase
                .from('user_badges')
                .delete()
                .eq('user_id', currentUser.id);
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
            const { data, error } = await supabase.from('title_shop').select('title_key, name');
            if (error) throw error;
            allTitlesList = data || [];
            populateSelect(ui.titleSelect, allTitlesList, 'title_key', 'name');
        } catch (e) {
            console.error("Error fetching titles:", e);
            showToast("Nepodařilo se načíst tituly.", "error");
        }
    }

    async function equipTitle(titleKey) {
        // Also add to purchased_titles if not already there for testing purposes
        let purchased = currentProfile.purchased_titles || [];
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
            // Assuming 'avatar_decorations_shop' exists and has 'decoration_key' and 'name'
            const { data, error } = await supabase
                .from('avatar_decorations_shop')
                .select('decoration_key, name, image_url') // image_url for preview if available
                .eq('is_available', true);
            if (error) throw error;
            allAvatarDecorationsList = data || [];
            populateSelect(ui.avatarDecorationSelect, allAvatarDecorationsList, 'decoration_key', 'name');
            // For profile decorations, it's not clear if they are from the same table
            // For now, let's assume they are specific CSS classes
            // If they were also from a table, we'd fetch and populate ui.profileDecorationSelect
        } catch (e) {
            console.error("Error fetching avatar decorations:", e);
            showToast("Nepodařilo se načíst dekorace avatarů.", "error");
        }
    }
    
    async function setAvatarDecoration(decorationKey) {
         let purchased = currentProfile.purchased_decorations || [];
         if (decorationKey && !purchased.includes(decorationKey)) {
             purchased.push(decorationKey);
         }
        await updateProfileField({ selected_decoration: decorationKey, purchased_decorations: purchased });
    }

    async function setProfileDecoration(decorationKey) {
        // Profile decorations might not have a "purchased" concept if they are test-only CSS classes
        await updateProfileField({ selected_profile_decoration: decorationKey });
    }
    async function sendTestNotification() {
        if (!currentUser || !supabase) {
            showToast("Pro odeslání notifikace je nutné být přihlášen.", "error");
            return;
        }
        const title = ui.notificationTitle.value.trim();
        const message = ui.notificationMessage.value.trim();
        const type = ui.notificationType.value;
        const icon = ui.notificationIcon.value.trim() || null; // Null if empty
        const link = ui.notificationLink.value.trim() || null; // Null if empty

        if (!title || !message) {
            showToast("Titul a zpráva notifikace jsou povinné.", "warning");
            return;
        }

        showToast("Odesílám testovací notifikaci...", "info");
        try {
            const { error } = await supabase
                .from('user_notifications')
                .insert({
                    user_id: currentUser.id,
                    title: title,
                    message: message,
                    type: type,
                    icon: icon,
                    link: link,
                    is_read: false // Playground notifications should appear as unread
                });
            if (error) throw error;
            showToast("Testovací notifikace úspěšně odeslána!", "success");
        } catch (e) {
            console.error("Chyba při odesílání notifikace:", e);
            showToast(`Chyba odeslání: ${e.message}`, "error");
        }
    }


    function populateSelect(selectElement, items, valueKey, textKey) {
        if (!selectElement || !items) return;
        selectElement.innerHTML = '<option value="">-- Vybrat --</option>'; // Default empty option
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueKey];
            option.textContent = item[textKey];
            selectElement.appendChild(option);
        });
    }
    
    async function loadInitialSelectData() {
        await fetchAllBadgesDefinition();
        await fetchAllTitles();
        await fetchAvatarDecorations(); // Načtení dekorací z DB
    }


    function setupEventListeners() {
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
        if (ui.sidebarToggleBtnDesktop) ui.sidebarToggleBtnDesktop.addEventListener('click', toggleSidebarDesktop);
        
        if (ui.loginForm) ui.loginForm.addEventListener('submit', async (e) => { e.preventDefault(); const email = ui.loginForm.email.value; const password = ui.loginForm.password.value; const button = ui.loginForm.querySelector('button[type="submit"]'); button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Přihlašuji...'; try { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; showToast("Přihlášení úspěšné!", "success"); } catch (error) { showToast(`Chyba přihlášení: ${error.message}`, "error"); } finally { button.disabled = false; button.innerHTML = 'Přihlásit se'; } });
        if (ui.registerForm) ui.registerForm.addEventListener('submit', async (e) => { e.preventDefault(); const email = ui.registerForm.email.value; const password = ui.registerForm.password.value; const button = ui.registerForm.querySelector('button[type="submit"]'); button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registruji...'; try { const { error } = await supabase.auth.signUp({ email, password }); if (error) throw error; showToast("Registrace úspěšná! Zkontrolujte svůj email pro potvrzení.", "success"); ui.registerFormContainer.classList.add('hidden'); ui.loginFormContainer.classList.remove('hidden'); } catch (error) { showToast(`Chyba registrace: ${error.message}`, "error"); } finally { button.disabled = false; button.innerHTML = 'Zaregistrovat se'; } });
        if (ui.logoutButton) ui.logoutButton.addEventListener('click', async () => { try { const { error } = await supabase.auth.signOut(); if (error) throw error; showToast("Odhlášení úspěšné.", "info"); } catch (error) { showToast(`Chyba odhlášení: ${error.message}`, "error"); } });
        if (ui.showRegister) ui.showRegister.addEventListener('click', () => { ui.loginFormContainer.classList.add('hidden'); ui.registerFormContainer.classList.remove('hidden'); });
        if (ui.showLogin) ui.showLogin.addEventListener('click', () => { ui.registerFormContainer.classList.add('hidden'); ui.loginFormContainer.classList.remove('hidden'); });

        // Testing function buttons
        if (ui.increaseLevelBtn) ui.increaseLevelBtn.addEventListener('click', increaseLevel);
        if (ui.addXpBtn) ui.addXpBtn.addEventListener('click', () => addExperience(parseInt(ui.addXpAmount.value) || 0));
        if (ui.addPointsBtn) ui.addPointsBtn.addEventListener('click', () => addPoints(parseInt(ui.addPointsAmount.value) || 0));
        if (ui.resetXpBtn) ui.resetXpBtn.addEventListener('click', resetExperienceForLevel);
        if (ui.resetPointsBtn) ui.resetPointsBtn.addEventListener('click', resetPoints);
        if (ui.setStreakBtn) ui.setStreakBtn.addEventListener('click', () => setStreak(parseInt(ui.setStreakDays.value) || 0));
        if (ui.syncDailyStreakBtn) ui.syncDailyStreakBtn.addEventListener('click', syncDailyStreak);

        if (ui.addBadgeBtn) ui.addBadgeBtn.addEventListener('click', () => awardSpecificBadge(ui.badgeSelect.value));
        if (ui.clearBadgesBtn) ui.clearBadgesBtn.addEventListener('click', clearUserBadges);

        if (ui.equipTitleBtn) ui.equipTitleBtn.addEventListener('click', () => equipTitle(ui.titleSelect.value));
        if (ui.clearEquippedTitleBtn) ui.clearEquippedTitleBtn.addEventListener('click', clearEquippedTitle);

        if (ui.setAvatarDecorationBtn) ui.setAvatarDecorationBtn.addEventListener('click', () => setAvatarDecoration(ui.avatarDecorationSelect.value || null));
        if (ui.setProfileDecorationBtn) ui.setProfileDecorationBtn.addEventListener('click', () => setProfileDecoration(ui.profileDecorationSelect.value || null));
        if (ui.applyFallingStarsPlayground) ui.applyFallingStarsPlayground.addEventListener('click', () => setAvatarDecoration('avatar_falling_elements'));
        if (ui.removeAllDecorationsBtn) ui.removeAllDecorationsBtn.addEventListener('click', () => { setAvatarDecoration(null); setProfileDecoration(null); });
        
        if(ui.sendTestNotificationBtn) ui.sendTestNotificationBtn.addEventListener('click', sendTestNotification);

        window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus);
    }
     function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení bylo ztraceno.', 'warning'); }


    async function initializeApp() {
        cacheDOMElements();
        if (!initializeSupabase()) return;
        
        applyInitialSidebarState();
        setupEventListeners();
        updateCopyrightYear();
        initTooltips();
        initMouseFollower();
        updateOnlineStatus();


        if (ui.initialSiteLoader) {
            ui.initialSiteLoader.style.opacity = '1'; // Ensure it's visible
            ui.initialSiteLoader.style.display = 'flex';
        }
        if (ui.sidebar) ui.sidebar.style.display = 'none';
        if (ui.mainContent) ui.mainContent.style.display = 'none';
        
        supabase.auth.onAuthStateChange(handleAuthStateChange);
        
        // Manually trigger initial auth state check
        const { data: { session } } = await supabase.auth.getSession();
        handleAuthStateChange('INITIAL_CHECK', session);
    }

    document.addEventListener('DOMContentLoaded', initializeApp);
})();