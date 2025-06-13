// dashboard/settings.js
// Tento kód je PŘÍMOU KOPIÍ vašeho dashboard/profile.js.
// Všechny funkce a logika byly zachovány dle instrukcí.
// Upraveno pouze `cacheDOMElements` a logika pro sidebar.

// Version: UPDATED with Learning Goal Selection & DB Level Up (z původního profile.js)
(function() {
    // --- START: Initialization and Configuration ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let allTitles = [];
    let selectedBuiltInAvatarPath = null;
    let isLoading = {
        profile: false, password: false, preferences: false,
        avatar: false, delete: false, notifications: false,
        titles: false
    };
    const SIDEBAR_STATE_KEY = 'vyukaSidebarState'; // Použijeme jiný klíč pro nový sidebar

    const ui = {}; // Bude naplněno v cacheDOMElements

    // --- END: Initialization and Configuration ---

    function cacheDOMElements() {
        console.log("[Settings Cache DOM] Caching elements...");
        const ids = [
            'initial-loader', 'sidebar-overlay-ai-settings', 'settings-main-area',
            'vyuka-sidebar-settings', 'main-mobile-menu-toggle-settings',
            'sidebar-ai-desktop-toggle-settings',
            'sidebar-avatar', 
            'vyuka-header-user-display', 
            'vyuka-header-avatar',       
            'vyuka-header-user-name',    
            'vyuka-header-user-title',   
            'user-dropdown-menu',        
            'logout-btn', 
            'profile-content', 'profile-name', 'profile-email',
            'profile-avatar', 'profile-points', 'profile-badges', 'profile-streak',
            'profile-level-main', 'exp-progress-bar-fill', 'exp-current-value',
            'exp-required-value', 'exp-percentage', 'profile-form', 'password-form',
            'first_name', 'last_name', 'username', 'email', 'school', 'grade', 'bio',
            'current_password', 'new_password', 'confirm_password',
            'dark_mode', 'language', 'learning_goal', 'goal-details-container',
            'goal-details-math_accelerate', 'accelerate_grade_profile',
            'accelerate_intensity_profile', 'goal-details-math_review',
            'review_grade_profile', 'email_notifications', 'study_tips',
            'content_updates', 'practice_reminders', 'save-profile-btn',
            'save-password-btn', 'save-preferences-btn', 'delete-account-btn',
            'confirm-delete-account-btn', 'save-avatar-btn', 'avatar-modal',
            'delete-account-modal', 'avatar-preview', 'avatar-upload',
            'select-avatar-file-btn', 'builtin-avatar-grid',
            'confirm-delete-password', 'toast-container', 'global-error-settings',
            'offline-banner', 'mouse-follower',
            'currentYearSidebarSettings', 'currentYearFooterSettings',
            'notification-bell', 'notification-count', 'notifications-dropdown',
            'notifications-list', 'no-notifications-msg', 'mark-all-read', // Corrected ID is 'mark-all-read'
            'public-profile-link-sidebar'
        ];
        const notFound = [];
        ids.forEach(id => {
            const element = document.getElementById(id);
            const key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());

            if (key === 'sidebarOverlayAiSettings') ui.sidebarOverlay = element;
            else if (key === 'settingsMainArea') ui.mainContent = element; 
            else if (key === 'vyukaSidebarSettings') ui.sidebar = element; 
            else if (key === 'mainMobileMenuToggleSettings') ui.mainMobileMenuToggle = element; 
            else if (key === 'sidebarAiDesktopToggleSettings') ui.sidebarToggleBtn = element; 
            else if (key === 'globalErrorSettings') ui.globalError = element; 
            else if (key === 'currentYearSidebarSettings') ui.currentYearSidebar = element;
            else if (key === 'currentYearFooterSettings') ui.currentYearFooter = element;
            else if (key === 'vyukaHeaderUserDisplay') ui.headerUserDisplay = element; 
            else if (key === 'vyukaHeaderAvatar') ui.headerAvatar = element;
            else if (key === 'vyukaHeaderUserName') ui.headerUserName = element;
            else if (key === 'vyukaHeaderUserTitle') ui.headerUserTitle = element;
            else if (key === 'userDropdownMenu') ui.userDropdownMenu = element; 
            else if (key === 'sidebarAvatar') ui.sidebarAvatarElement = element; 
            else if (id === 'mark-all-read') ui.markAllReadBtn = element; // Explicit mapping to ui.markAllReadBtn
            else ui[key] = element;

            if (!element && id !== 'sidebar-close-toggle') {
                notFound.push(id);
            }
        });
        ui.sidebarName = null; 
        ui.sidebarUserTitle = null;

        ui.profileTabs = document.querySelectorAll('.profile-tab');
        ui.tabContents = document.querySelectorAll('.tab-content');


        if (notFound.length > 0) {
            console.warn(`[Settings Cache DOM] Elements not found: (${notFound.length})`, notFound);
        }
        console.log("[Settings Cache DOM] Caching complete. UI Object:", ui);
    }
    
    function showToast(title, message, type = 'info', duration = 4500) {
        if (!ui.toastContainer) { console.warn("Toast container not found"); return; }
        try {
            const toastId = `toast-${Date.now()}`;
            const toastElement = document.createElement('div');
            toastElement.className = `toast ${type}`;
            toastElement.id = toastId;
            toastElement.setAttribute('role', 'alert');
            toastElement.setAttribute('aria-live', 'assertive');
            toastElement.innerHTML = `
                <i class="toast-icon"></i>
                <div class="toast-content">
                    ${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}
                    <div class="toast-message">${sanitizeHTML(message)}</div>
                </div>
                <button type="button" class="toast-close" aria-label="Zavřít">&times;</button>
            `;
            const icon = toastElement.querySelector('.toast-icon');
            icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`;
            toastElement.querySelector('.toast-close').addEventListener('click', () => {
                toastElement.classList.remove('show');
                setTimeout(() => toastElement.remove(), 400);
            });
            ui.toastContainer.appendChild(toastElement);
            requestAnimationFrame(() => { toastElement.classList.add('show'); });
            setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration);
        } catch (e) { console.error("Chyba při zobrazování toastu:", e); }
    }
    function showError(message, isGlobal = false) {
        console.error("Došlo k chybě:", message);
        if (isGlobal && ui.globalError) {
            ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Zkusit Znovu</button></div>`;
            ui.globalError.style.display = 'block';
            const retryBtn = document.getElementById('global-retry-btn');
            if (retryBtn) { retryBtn.addEventListener('click', () => { hideError(); if(initializeApp) initializeApp(); }); }
        } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); }
    }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function showFieldError(fieldName, message) {
        const field = document.getElementById(fieldName);
        const errorElement = document.getElementById(`${fieldName}-error`);
        if (field && errorElement) {
            field.classList.add('is-invalid');
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }
    function clearFieldError(fieldName) {
        const field = document.getElementById(fieldName);
        const errorElement = document.getElementById(`${fieldName}-error`);
        if (field && errorElement) {
            field.classList.remove('is-invalid');
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    }
    function clearAllErrors(formId = null) {
        const scope = formId ? document.getElementById(formId) : document;
        if (!scope) return;
        scope.querySelectorAll('.field-error').forEach(e => { e.textContent = ''; e.style.display = 'none'; });
        scope.querySelectorAll('.is-invalid').forEach(f => f.classList.remove('is-invalid'));
    }
     function showModal(modalId) {
         const m = document.getElementById(modalId);
         if (m) {
             console.log(`[Settings Modal] Opening modal: ${modalId}`);
             m.style.display = 'flex';
             requestAnimationFrame(() => m.classList.add('active'));
             if (modalId === 'avatar-modal') {
                 console.log("[Settings Modal] Populating built-in avatars...");
                 populateBuiltInAvatars();
                 selectedBuiltInAvatarPath = null;
                 if (ui.avatarUpload) ui.avatarUpload.value = ''; 
                 if (ui.saveAvatarBtn) ui.saveAvatarBtn.disabled = true;
                 updateAvatarPreviewFromProfile();
             }
         } else {
              console.error(`[Settings Modal] Modal element not found: ${modalId}`);
         }
     }
     function hideModal(modalId) {
         const m = document.getElementById(modalId);
         if (m) {
             console.log(`[Settings Modal] Closing modal: ${modalId}`);
             m.classList.remove('active');
             setTimeout(() => {
                 m.style.display = 'none';
                 if (modalId === 'delete-account-modal' && ui.confirmDeletePasswordField) ui.confirmDeletePasswordField.value = '';
                 if (modalId === 'avatar-modal') {
                      selectedBuiltInAvatarPath = null;
                     if (ui.avatarUpload) ui.avatarUpload.value = ''; 
                     if(ui.avatarPreview) updateAvatarPreviewFromProfile();
                     if(ui.builtinAvatarGrid) ui.builtinAvatarGrid.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
                     if (ui.saveAvatarBtn) ui.saveAvatarBtn.disabled = true;
                 }
             }, 400);
         } else {
              console.error(`[Settings Modal] Modal element not found to hide: ${modalId}`);
         }
    }
    function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.classList.toggle('visible', !navigator.onLine); if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }
    function getInitials(userData) { if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    
    function openVyukaSidebarMobile() {
        if (ui.sidebar && ui.sidebarOverlay) {
            ui.sidebar.classList.add('active-mobile'); 
            ui.sidebar.classList.add('expanded'); 
            ui.sidebarOverlay.classList.add('active');
        }
    }
    function closeVyukaSidebarMobile() {
        if (ui.sidebar && ui.sidebarOverlay) {
            ui.sidebar.classList.remove('active-mobile');
            if(localStorage.getItem(SIDEBAR_STATE_KEY) === 'collapsed'){
                 ui.sidebar.classList.remove('expanded');
            }
            ui.sidebarOverlay.classList.remove('active');
        }
    }
    function toggleVyukaSidebarDesktop() {
        if (!ui.sidebarToggleBtn || !ui.sidebar) return;
        try {
            const shouldBeExpanded = !ui.sidebar.classList.contains('expanded');
            ui.sidebar.classList.toggle('expanded', shouldBeExpanded);
            localStorage.setItem(SIDEBAR_STATE_KEY, shouldBeExpanded ? 'expanded' : 'collapsed'); 
            
            const icon = ui.sidebarToggleBtn.querySelector('i');
            if (icon) {
                icon.className = `fas fa-chevron-${shouldBeExpanded ? 'left' : 'right'}`;
            }
            ui.sidebarToggleBtn.title = shouldBeExpanded ? 'Sbalit panel' : 'Rozbalit panel';
            console.log(`[Settings Vyuka Sidebar Toggle] New state: ${shouldBeExpanded ? 'expanded' : 'collapsed'}`);
        } catch (error) {
            console.error("[Settings Vyuka Sidebar Toggle] Error:", error);
        }
    }
    function applyInitialVyukaSidebarState() {
        if(!ui.sidebar || !ui.sidebarToggleBtn) return;
        const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);
        const shouldBeExpanded = savedState === null ? true : savedState === 'expanded'; 
        
        ui.sidebar.classList.toggle('expanded', shouldBeExpanded);
        
        const icon = ui.sidebarToggleBtn?.querySelector('i');
        if (icon) {
            icon.className = `fas fa-chevron-${shouldBeExpanded ? 'left' : 'right'}`;
        }
        if (ui.sidebarToggleBtn) {
            ui.sidebarToggleBtn.title = shouldBeExpanded ? 'Sbalit panel' : 'Rozbalit panel';
        }
        console.log(`[Settings Vyuka Sidebar State] Initial state applied: ${shouldBeExpanded ? 'expanded' : 'collapsed'}`);
    }

    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 768) { if(follower) follower.style.display = 'none'; return; } follower.style.display = 'block'; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); follower.style.opacity = '1'; hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initHeaderScrollDetection = () => { 
        const scrollableContent = document.querySelector('.vyuka-main-content-scrollable'); 
        if (!scrollableContent) { console.warn("[Header Scroll] Scrollable content area '.vyuka-main-content-scrollable' not found."); return; }
        let lastScrollY = scrollableContent.scrollTop; 
        scrollableContent.addEventListener('scroll', () => { 
            const currentScrollY = scrollableContent.scrollTop; 
            document.body.classList.toggle('scrolled', currentScrollY > 20); 
            lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; 
        }, { passive: true }); 
        document.body.classList.toggle('scrolled', scrollableContent.scrollTop > 20);
    };
    const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; };
    const validators = {
        required: (value, fieldName, message = 'Toto pole je povinné') => { if (!value || String(value).trim() === '') { showFieldError(fieldName, message); return false; } return true; },
        minLength: (value, fieldName, length, message = `Minimální délka je ${length} znaků`) => { if (value && String(value).length < length) { showFieldError(fieldName, message); return false; } return true; },
        match: (value1, fieldName1, value2, message = 'Hodnoty se neshodují') => { if (value1 !== value2) { showFieldError(fieldName1, message); return false; } return true; }
    };
    function setLoadingState(section, isLoadingFlag) {
        if (isLoading[section] === isLoadingFlag && section !== 'all') return;
        if (section === 'all') { Object.keys(isLoading).forEach(key => isLoading[key] = isLoadingFlag); }
        else { isLoading[section] = isLoadingFlag; }
        console.log(`[Settings SetLoading] ${section}: ${isLoadingFlag}`);

        const buttons = {
            profile: ui.saveProfileBtn,
            password: ui.savePasswordBtn,
            preferences: ui.savePreferencesBtn,
            avatar: ui.saveAvatarBtn,
            delete: ui.confirmDeleteAccountBtn,
            notifications: ui.markAllReadBtn 
        };
        const button = buttons[section];
        if (button) {
            button.disabled = isLoadingFlag;
            if (isLoadingFlag && !button.dataset.originalContent) {
                 button.dataset.originalContent = button.innerHTML;
             }

            if (isLoadingFlag) {
                const spinnerIcon = '<i class="fas fa-spinner fa-spin"></i>';
                if (section === 'profile') button.innerHTML = `${spinnerIcon} Ukládám...`;
                else if (section === 'password') button.innerHTML = `${spinnerIcon} Měním...`;
                else if (section === 'preferences') button.innerHTML = `${spinnerIcon} Ukládám...`;
                else if (section === 'avatar') button.innerHTML = `${spinnerIcon} Ukládám...`;
                else if (section === 'delete') button.innerHTML = `${spinnerIcon} Mažu...`;
                else if (section !== 'notifications') { button.innerHTML = `${spinnerIcon} Načítám...`; }
            } else {
                 if (button.dataset.originalContent && section !== 'notifications') {
                     button.innerHTML = button.dataset.originalContent;
                     delete button.dataset.originalContent;
                 }
            }
        }

        if (section === 'notifications' && ui.notificationBell) {
            ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
            if (ui.markAllReadBtn) { 
                const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
            }
        }
    }
    
    function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Knihovna Supabase nebyla správně načtena."); } supabase = window.supabase.createClient(supabaseUrl, supabaseKey); if (!supabase) throw new Error("Vytvoření klienta Supabase selhalo."); console.log('[Settings Supabase] Klient úspěšně inicializován.'); return true; } catch (error) { console.error('[Settings Supabase] Inicializace selhala:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }

    async function fetchUserProfile(userId) {
        if (!supabase || !userId) return null;
        console.log(`[Settings Profile] Načítání profilu pro ID: ${userId}`);
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*, selected_title, learning_goal, preferences->goal_details AS goal_details')
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (!profile) {
                console.warn(`[Settings Profile] Profil nenalezen pro ${userId}. Vytváření výchozího...`);
                const defaultProfileData = {
                    id: userId, email: currentUser.email, username: currentUser.email.split('@')[0], level: 1, points: 0, experience: 0, badges_count: 0, streak_days: 0,
                    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                    preferences: { dark_mode: window.matchMedia('(prefers-color-scheme: dark)').matches, language: 'cs', goal_details: {} },
                    notifications: { email: true, study_tips: true, content_updates: true, practice_reminders: true },
                    learning_goal: null
                };
                const { data: newProfile, error: createError } = await supabase.from('profiles').insert([defaultProfileData]).select('*, selected_title, learning_goal, preferences->goal_details AS goal_details').single();
                if (createError) throw createError;
                console.log("[Settings Profile] Výchozí profil úspěšně vytvořen.");
                return newProfile;
            }
            if (!profile.goal_details) { 
                profile.goal_details = {};
            }
            console.log("[Settings Profile] Profil úspěšně načten:", profile);
            return profile;
        } catch (error) {
            console.error('[Settings Profile] Chyba při načítání/vytváření profilu:', error);
            showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error');
            return null;
        }
    }

    async function fetchTitles() {
        if (!supabase) return [];
        console.log("[Settings Titles] Fetching available titles...");
        setLoadingState('titles', true);
        try {
            const { data, error } = await supabase
                .from('title_shop')
                .select('title_key, name');
            if (error) throw error;
            console.log("[Settings Titles] Fetched titles:", data);
            return data || [];
        } catch (error) {
            console.error("[Settings Titles] Error fetching titles:", error);
            showToast("Chyba načítání dostupných titulů.", "error");
            return [];
        } finally {
            setLoadingState('titles', false);
        }
    }

    async function updateProfileData(data) {
        if (!currentUser || !supabase) { showToast('Chyba', 'Nejste přihlášeni.', 'error'); return false; }
        console.log("[Settings Profile Update] Aktualizace dat:", data);
        setLoadingState('profile', true);
        try {
            const { data: updatedProfile, error } = await supabase
                .from('profiles')
                .update({
                    first_name: data.first_name,
                    last_name: data.last_name,
                    username: data.username,
                    school: data.school,
                    grade: data.grade,
                    bio: data.bio,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentUser.id)
                .select('*, selected_title, learning_goal, preferences->goal_details AS goal_details') 
                .single();
            if (error) throw error;
            currentProfile = updatedProfile; 
            updateProfileDisplay(currentProfile, allTitles); 
            showToast('ÚSPĚCH', 'Profil byl úspěšně aktualizován.', 'success');
            console.log("[Settings Profile Update] Úspěšně aktualizováno.");
            return true;
        } catch (error) {
            console.error('[Settings Profile Update] Chyba:', error);
            showToast('CHYBA', `Aktualizace profilu selhala: ${error.message}`, 'error');
            return false;
        } finally {
            setLoadingState('profile', false);
        }
    }

    async function updateUserPassword(currentPassword, newPassword) {
        if (!currentUser || !supabase) { showToast('Chyba', 'Nejste přihlášeni.', 'error'); return false; }
        console.log("[Settings Password Update] Pokus o změnu hesla.");
        setLoadingState('password', true);
        try {
            console.warn("Settings Password Update: Client-side update doesn't verify current password securely.");
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) {
                let message = 'Změna hesla selhala.';
                if (error.message.includes('requires recent login')) message = 'Vyžadováno nedávné přihlášení. Přihlaste se znovu.';
                else if (error.message.includes('weak_password')) message = 'Heslo je příliš slabé.';
                else if (error.message.includes('same password')) message = 'Nové heslo musí být jiné než současné.';

                showToast('CHYBA HESLA', message, 'error');
                console.error('[Settings Password Update] Chyba Supabase:', error);

                if (message.includes('jiné')) { 
                    showFieldError('new_password', message);
                } else { 
                    showFieldError('current_password', 'Ověření selhalo nebo je vyžadováno nové přihlášení.');
                }
                return false;
            }
            if(ui.passwordForm) ui.passwordForm.reset();
            clearAllErrors('password-form');
            showToast('ÚSPĚCH', 'Heslo bylo úspěšně změněno.', 'success');
            console.log("[Settings Password Update] Heslo úspěšně změněno.");
            return true;
        } catch (error) {
            console.error('[Settings Password Update] Neočekávaná chyba:', error);
            showToast('CHYBA', 'Došlo k neočekávané chybě při změně hesla.', 'error');
            return false;
        } finally {
            setLoadingState('password', false);
        }
    }

    async function updatePreferencesData() {
        if (!currentUser || !supabase || !currentProfile) {
            showToast('Chyba', 'Nejste přihlášeni nebo chybí data profilu.', 'error');
            return false;
        }
        console.log("[Settings Preferences Update] Aktualizace nastavení...");
        setLoadingState('preferences', true);
        try {
            const preferences = {
                dark_mode: ui.darkModeToggle.checked,
                language: ui.languageSelect.value,
                goal_details: currentProfile.preferences?.goal_details || {} 
            };
            const notifications = {
                email: ui.emailNotificationsToggle.checked,
                study_tips: ui.studyTipsToggle.checked,
                content_updates: ui.contentUpdatesToggle.checked,
                practice_reminders: ui.practiceRemindersToggle.checked
            };

            const newLearningGoal = ui.learningGoalSelect.value || null;
            let goalDetailsToSave = preferences.goal_details; 

            if (newLearningGoal) {
                goalDetailsToSave = {}; 
                if (newLearningGoal === 'math_accelerate') {
                    goalDetailsToSave = {
                        grade: ui.accelerateGradeProfileSelect.value,
                        intensity: ui.accelerateIntensityProfileSelect.value
                    };
                } else if (newLearningGoal === 'math_review') {
                    goalDetailsToSave = {
                        grade: ui.reviewGradeProfileSelect.value
                    };
                }
            }
            preferences.goal_details = goalDetailsToSave;

            const updates = {
                preferences: preferences,
                notifications: notifications,
                learning_goal: newLearningGoal,
                updated_at: new Date().toISOString()
            };

            console.log("[Settings Preferences Update] Data k uložení:", updates);

            const { data: updatedProfile, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', currentUser.id)
                .select('*, selected_title, learning_goal, preferences->goal_details AS goal_details')
                .single();

            if (error) throw error;

            currentProfile = updatedProfile; 
            if (!currentProfile.goal_details) currentProfile.goal_details = {}; 

            applyPreferences(currentProfile.preferences);
            populateLearningGoalForm(currentProfile.learning_goal, currentProfile.goal_details); 
            updateProfileDisplay(currentProfile, allTitles); 

            showToast('ÚSPĚCH', 'Nastavení byla uložena.', 'success');
            console.log("[Settings Preferences Update] Nastavení uložena.");
            return true;
        } catch (error) {
            console.error('[Settings Preferences Update] Chyba:', error);
            showToast('CHYBA', `Uložení nastavení selhalo: ${error.message}`, 'error');
            return false;
        } finally {
            setLoadingState('preferences', false);
        }
    }

    async function saveSelectedAvatar() {
        if (!currentUser || !supabase) { showToast('Chyba', 'Nejste přihlášeni.', 'error'); return false; }
        setLoadingState('avatar', true);
        const file = ui.avatarUpload?.files[0];
        let finalAvatarUrl = null;
        let uploadError = null;

        try {
            if (selectedBuiltInAvatarPath) {
                console.log("[Settings Avatar Save] Saving built-in avatar:", selectedBuiltInAvatarPath);
                finalAvatarUrl = selectedBuiltInAvatarPath;
            } else if (file) {
                console.log("[Settings Avatar Save] Uploading new file:", file.name);
                if (file.size > 2 * 1024 * 1024) { throw new Error('Soubor je příliš velký (max 2MB).'); }
                if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) { console.warn(`[Settings Avatar Save] Unsupported file type: ${file.type}`); throw new Error('Nepodporovaný formát souboru (JPG, PNG, GIF).'); }
                const fileExt = file.name.split('.').pop();
                const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`; 
                const { error } = await supabase.storage.from('avatars').upload(fileName, file, { cacheControl: '3600', upsert: true });
                uploadError = error;
                if (uploadError) throw new Error(`Chyba nahrávání souboru: ${uploadError.message}`);
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
                if (!urlData || !urlData.publicUrl) throw new Error("Nepodařilo se získat URL obrázku.");
                finalAvatarUrl = urlData.publicUrl;
                console.log("[Settings Avatar Save] File uploaded, URL:", finalAvatarUrl);
            } else { showToast('Info', 'Nevybrali jste žádný nový obrázek.', 'info'); setLoadingState('avatar', false); return false; }
            console.log("[Settings Avatar Save] Updating profile with avatar_url:", finalAvatarUrl);
            const { data: updatedProfile, error: updateError } = await supabase.from('profiles').update({ avatar_url: finalAvatarUrl, updated_at: new Date().toISOString() }).eq('id', currentUser.id).select('*, selected_title, learning_goal, preferences->goal_details AS goal_details').single();
            if (updateError) throw new Error(`Chyba aktualizace profilu: ${updateError.message}`);
            currentProfile = updatedProfile; 
            updateProfileDisplay(currentProfile, allTitles); 
            hideModal('avatar-modal');
            showToast('ÚSPĚCH', 'Profilový obrázek byl aktualizován.', 'success');
            console.log("[Settings Avatar Save] Avatar successfully updated.");
            return true;
        } catch (error) {
            console.error('[Settings Avatar Save] Chyba:', error);
            showToast('CHYBA', `Aktualizace avataru selhala: ${error.message}`, 'error');
            return false;
        } finally {
            setLoadingState('avatar', false);
        }
    }

    async function deleteUserAccount(password) {
        if (!currentUser || !supabase) { showToast('Chyba', 'Nejste přihlášeni.', 'error'); return false; }
        if (!password) { showFieldError('confirm-delete-password', 'Zadejte heslo pro potvrzení.'); return false; }
        console.warn("[Settings Account Deletion] Zahájení procesu smazání účtu pro:", currentUser.id);
        setLoadingState('delete', true);
        clearFieldError('confirm-delete-password');
        try {
            console.log("[Settings Account Deletion] Volání funkce 'delete-user-account'...");
            const { data, error } = await supabase.functions.invoke('delete-user-account', { body: JSON.stringify({ password: password }) });
            if (error) {
                let message = error.message || 'Neznámá chyba serverové funkce.';
                if (message.includes('Invalid user credentials') || message.includes('Incorrect password')) { showFieldError('confirm-delete-password', 'Nesprávné heslo.'); message = 'Nesprávné heslo.'; }
                else if (message.includes('requires recent login')) { showFieldError('confirm-delete-password', 'Vyžadováno nedávné přihlášení.'); message = 'Pro smazání účtu se prosím znovu přihlaste.'; showToast('Chyba', message, 'warning'); }
                else { showToast('CHYBA SMAZÁNÍ', message, 'error'); }
                console.error('[Settings Account Deletion] Chyba funkce:', error);
                return false;
            }
            console.log("[Settings Account Deletion] Funkce úspěšně provedena:", data);
            showToast('ÚČET SMAZÁN', 'Váš účet byl úspěšně smazán.', 'success', 5000);
            setTimeout(() => { window.location.href = '/auth/index.html'; }, 3000);
            return true;
        } catch (error) { 
            console.error('[Settings Account Deletion] Chyba:', error);
            if (!document.getElementById('confirm-delete-password-error')?.textContent) { showToast('CHYBA SMAZÁNÍ', `Smazání účtu selhalo: ${error.message}`, 'error'); }
            return false;
        } finally {
            setLoadingState('delete', false);
        }
    }
    
    async function fetchNotifications(userId, limit = 5) {
        if (!supabase || !userId) { console.error("[Settings Notifications] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; }
        console.log(`[Settings Notifications] Načítání nepřečtených oznámení pro uživatele ${userId}`);
        setLoadingState('notifications', true);
        try {
            const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit);
            if (error) throw error;
            console.log(`[Settings Notifications] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`);
            return { unreadCount: count ?? 0, notifications: data || [] };
        } catch (error) {
            console.error("[Settings Notifications] Výjimka při načítání oznámení:", error);
            showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error');
            return { unreadCount: 0, notifications: [] };
        } finally {
            setLoadingState('notifications', false);
        }
    }
    function formatRelativeTime(timestamp) {
        if (!timestamp) return '';
        try {
            const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; 
            const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7);
            if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`;
            return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
        } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; }
    }
    function renderNotifications(count, notifications) {
        console.log("[Settings Render Notifications] Start, Počet:", count, "Oznámení:", notifications);
        if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Settings Render Notifications] Chybí UI elementy pro notifikace."); return; }
        ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0);
        if (notifications && notifications.length > 0) {
            const activityVisuals = { info: {icon:'fa-info-circle', class:'info'}, success: {icon:'fa-check-circle', class:'success'}, warning: {icon:'fa-exclamation-triangle', class:'warning'}, danger: {icon:'fa-exclamation-circle', class:'danger'}, badge: {icon:'fa-medal', class:'badge'}, level_up: {icon:'fa-angle-double-up', class:'level_up'}, plan_generated: {icon:'fa-route', class:'plan_generated'}, exercise: {icon:'fa-laptop-code', class:'exercise'}, test: {icon:'fa-vial', class:'test'}, default: {icon:'fa-bell', class:'default'} };
            ui.notificationsList.innerHTML = notifications.map(n => {
                const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default;
                const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : '';
                return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`;
            }).join('');
            ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0;
        } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; }
        console.log("[Settings Render Notifications] Hotovo");
    }
    async function markNotificationRead(notificationId) {
        console.log("[Settings FUNC] markNotificationRead: Označení ID:", notificationId);
        if (!currentUser || !notificationId || !supabase) return false;
        try {
            const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId);
            if (error) throw error; console.log("[Settings FUNC] markNotificationRead: Úspěch pro ID:", notificationId); return true;
        } catch (error) { console.error("[Settings FUNC] markNotificationRead: Chyba:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; }
    }
    async function markAllNotificationsRead() {
        console.log("[Settings FUNC] markAllNotificationsRead: Start pro uživatele:", currentUser?.id);
        if (!currentUser || !ui.markAllReadBtn || !supabase) { console.warn("Cannot mark all read: Missing user, button, or supabase."); return; }
        setLoadingState('notifications', true);
        try {
            const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false);
            if (error) throw error; console.log("[Settings FUNC] markAllNotificationsRead: Úspěch");
            const { unreadCount, notifications } = await fetchNotifications(currentUser.id, 5); renderNotifications(unreadCount, notifications);
            showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success');
        } catch (error) {
            console.error("[Settings FUNC] markAllNotificationsRead: Chyba:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error');
            const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = currentCount === 0;
        } finally { setLoadingState('notifications', false); }
    }
    
    function getTotalExpThreshold(targetLevel) {
        const BASE_XP_JS = 100; const INCREMENT_XP_JS = 25;
        if (targetLevel <= 1) return 0; let totalExp = 0;
        for (let level = 1; level < targetLevel; level++) { totalExp += (BASE_XP_JS + (INCREMENT_XP_JS * (level - 1))); }
        return totalExp;
    }
    function updateProfileDisplay(profileData, titlesData = []) {
        if (!profileData) { console.warn("updateProfileDisplay: Missing profile data."); return; }
        console.log("[Settings UI Update] Updating profile display (main page & header)...");

        if (ui.sidebarAvatarElement) { 
            const initials = getInitials(profileData); const avatarUrl = profileData.avatar_url; let finalSidebarUrl = avatarUrl;
            if (avatarUrl && !avatarUrl.startsWith('http') && avatarUrl.includes('/')) { finalSidebarUrl = sanitizeHTML(avatarUrl); }
            else if (avatarUrl) { finalSidebarUrl = `${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`; }
             ui.sidebarAvatarElement.innerHTML = finalSidebarUrl ? `<img src="${finalSidebarUrl}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
             const sidebarImg = ui.sidebarAvatarElement.querySelector('img');
             if (sidebarImg) { sidebarImg.onerror = function() { console.error(`[Settings UI Update] Failed to load sidebar avatar: ${this.src}`); ui.sidebarAvatarElement.innerHTML = sanitizeHTML(initials); }; }
        }

        const headerDisplayName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || profileData.username || currentUser?.email?.split('@')[0] || 'Pilot';
        if (ui.headerUserName) ui.headerUserName.textContent = sanitizeHTML(headerDisplayName);
        if (ui.headerAvatar) { 
            const initials = getInitials(profileData); const avatarUrl = profileData.avatar_url; let finalHeaderUrl = avatarUrl;
            if (avatarUrl && !avatarUrl.startsWith('http') && avatarUrl.includes('/')) { finalHeaderUrl = sanitizeHTML(avatarUrl); }
            else if (avatarUrl) { finalHeaderUrl = `${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`; }
            ui.headerAvatar.src = finalHeaderUrl || ''; 
            ui.headerAvatar.alt = sanitizeHTML(initials);
            ui.headerAvatar.style.display = finalHeaderUrl ? 'block' : 'none';
            const headerAvatarInitialsSpan = ui.headerUserDisplay?.querySelector('.vyuka-header-avatar-initials');
            if(headerAvatarInitialsSpan) headerAvatarInitialsSpan.style.display = finalHeaderUrl ? 'none' : 'flex';
            if(headerAvatarInitialsSpan && !finalHeaderUrl) headerAvatarInitialsSpan.textContent = initials;
        }
        if(ui.headerUserTitle) { 
            const selectedTitleKey = profileData.selected_title; let displayTitle = 'Pilot';
            if (selectedTitleKey && titlesData && titlesData.length > 0) {
                const foundTitle = titlesData.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) { displayTitle = foundTitle.name; }
                else { console.warn(`[Settings UI Update] Title with key "${selectedTitleKey}" not found in fetched titles.`); }
            } else if (selectedTitleKey) { console.warn(`[Settings UI Update] Selected title key "${selectedTitleKey}" exists but title list is empty or not loaded yet.`); }
            ui.headerUserTitle.textContent = sanitizeHTML(displayTitle); ui.headerUserTitle.setAttribute('title', sanitizeHTML(displayTitle));
        }

        const profileDisplayNameMain = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || profileData.username || 'Uživatel';
        if (ui.profileName) ui.profileName.textContent = sanitizeHTML(profileDisplayNameMain);
        if (ui.profileEmail) ui.profileEmail.textContent = sanitizeHTML(profileData.email);
        if (ui.profileAvatar) { 
            const initials = getInitials(profileData); const avatarUrl = profileData.avatar_url; let finalProfileUrl = avatarUrl;
            if (avatarUrl && !avatarUrl.startsWith('http') && avatarUrl.includes('/')) { finalProfileUrl = sanitizeHTML(avatarUrl); }
            else if (avatarUrl) { finalProfileUrl = `${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`; }
            const overlayHTML = ui.profileAvatar.querySelector('.edit-avatar-overlay')?.outerHTML || `<div class="edit-avatar-overlay" id="edit-avatar-btn"><i class="fas fa-camera-retro"></i><span>Změnit</span></div>`;
            ui.profileAvatar.innerHTML = finalProfileUrl ? `<img src="${finalProfileUrl}" alt="Avatar">` : `<span>${sanitizeHTML(initials)}</span>`;
            ui.profileAvatar.innerHTML += overlayHTML;
            const editBtn = ui.profileAvatar.querySelector('#edit-avatar-btn');
            if (editBtn) editBtn.addEventListener('click', () => showModal('avatar-modal'));
             const profileImg = ui.profileAvatar.querySelector('img');
             if (profileImg) {
                 profileImg.onerror = function() {
                     console.error(`[Settings UI Update] Failed to load main profile avatar: ${this.src}`);
                     const currentOverlay = ui.profileAvatar.querySelector('.edit-avatar-overlay');
                     ui.profileAvatar.innerHTML = `<span>${sanitizeHTML(initials)}</span>` + (currentOverlay ? currentOverlay.outerHTML : overlayHTML);
                      const newEditBtn = ui.profileAvatar.querySelector('#edit-avatar-btn');
                      if (newEditBtn) newEditBtn.addEventListener('click', () => showModal('avatar-modal'));
                 };
             }
        }
        updateAvatarPreviewFromProfile();
        if (ui.profilePoints) ui.profilePoints.textContent = profileData.points ?? 0;
        if (ui.profileBadges) ui.profileBadges.textContent = profileData.badges_count ?? 0;
        if (ui.profileStreak) ui.profileStreak.textContent = profileData.streak_days ?? 0;
        const currentLevel = profileData.level ?? 1; const currentExperience = profileData.experience ?? 0;
        const currentLevelExpThreshold = getTotalExpThreshold(currentLevel); const nextLevelExpThreshold = getTotalExpThreshold(currentLevel + 1);
        const expNeededForLevelSpan = nextLevelExpThreshold - currentLevelExpThreshold; const currentExpInLevel = Math.max(0, currentExperience - currentLevelExpThreshold);
        let percentage = 0;
        if (expNeededForLevelSpan > 0) { percentage = Math.min(100, Math.max(0, Math.round((currentExpInLevel / expNeededForLevelSpan) * 100))); }
        else if (currentExperience >= currentLevelExpThreshold && currentLevel > 0) { percentage = 100; }
        if (ui.profileLevelMain) { ui.profileLevelMain.textContent = currentLevel; }
        if (ui.expProgressBarFill) { ui.expProgressBarFill.style.width = `${percentage}%`; }
        if (ui.expCurrentValue) { ui.expCurrentValue.textContent = currentExpInLevel; }
        if (ui.expRequiredValue) { ui.expRequiredValue.textContent = expNeededForLevelSpan > 0 ? expNeededForLevelSpan : 'MAX'; }
        if (ui.expPercentage) { ui.expPercentage.textContent = percentage; }
        if (ui.firstNameField) ui.firstNameField.value = profileData.first_name || '';
        if (ui.lastNameField) ui.lastNameField.value = profileData.last_name || '';
        if (ui.usernameField) ui.usernameField.value = profileData.username || '';
        if (ui.emailField) ui.emailField.value = profileData.email || '';
        if (ui.schoolField) ui.schoolField.value = profileData.school || '';
        if (ui.gradeField) ui.gradeField.value = profileData.grade || '';
        if (ui.bioField) ui.bioField.value = profileData.bio || '';
        if (profileData.preferences) {
            if (ui.darkModeToggle) ui.darkModeToggle.checked = profileData.preferences.dark_mode ?? false;
            if (ui.languageSelect) ui.languageSelect.value = profileData.preferences.language || 'cs';
            if (ui.learningGoalSelect) { ui.learningGoalSelect.value = profileData.learning_goal || ""; populateLearningGoalForm(profileData.learning_goal, profileData.preferences.goal_details || {}); }
            applyPreferences(profileData.preferences);
        }
        if (profileData.notifications) {
            if (ui.emailNotificationsToggle) ui.emailNotificationsToggle.checked = profileData.notifications.email ?? true;
            if (ui.studyTipsToggle) ui.studyTipsToggle.checked = profileData.notifications.study_tips ?? true;
            if (ui.contentUpdatesToggle) ui.contentUpdatesToggle.checked = profileData.notifications.content_updates ?? true;
            if (ui.practiceRemindersToggle) ui.practiceRemindersToggle.checked = profileData.notifications.practice_reminders ?? true;
        }
        console.log("[Settings UI Update] Profile display update complete.");
    }
    function updateAvatarPreviewFromProfile() {
        if (!ui.avatarPreview || !currentProfile) { console.warn("Cannot update avatar preview: element or profile data missing."); return; }
        const initials = getInitials(currentProfile); const avatarUrl = currentProfile.avatar_url; let finalUrl = avatarUrl;
        if (avatarUrl && !avatarUrl.startsWith('http') && avatarUrl.includes('/')) { finalUrl = sanitizeHTML(avatarUrl); }
        else if (avatarUrl) { finalUrl = `${sanitizeHTML(avatarUrl)}?t=${new Date().getTime()}`; }
        console.log(`[Settings Preview Update] Setting preview source to: ${finalUrl || 'initials'}`);
        ui.avatarPreview.innerHTML = finalUrl ? `<img src="${finalUrl}" alt="Aktuální náhled">` : `<span>${sanitizeHTML(initials)}</span>`;
         const imgPreview = ui.avatarPreview.querySelector('img');
         if (imgPreview) { imgPreview.onerror = function() { console.error(`[Settings Preview Update] Failed to load preview image: ${this.src}`); ui.avatarPreview.innerHTML = `<span>${sanitizeHTML(initials)}</span>`; }; }
    }
    function populateBuiltInAvatars() {
        if (!ui.builtinAvatarGrid) { console.error("CRITICAL: Element #builtin-avatar-grid not found! Avatars cannot be displayed."); return; }
        ui.builtinAvatarGrid.innerHTML = ''; const fragment = document.createDocumentFragment();
        console.log("[Settings Avatars] Populating built-in avatars...");
        for (let i = 1; i <= 9; i++) { 
             const avatarPath = `../assets/avatar${i}.jpeg`; 
            const item = document.createElement('div'); item.className = 'builtin-avatar-item'; item.dataset.path = avatarPath; item.title = `Avatar ${i}`; 
            const img = document.createElement('img'); img.src = avatarPath; img.alt = `Avatar ${i}`; img.loading = 'lazy'; 
            img.onerror = function() { console.error(`[Settings Avatars] Failed to load avatar image: ${this.src}. Check path and file existence/extension.`); item.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:var(--accent-pink); font-size: 1.5rem;"></i>`; item.style.border = '2px solid var(--accent-pink)'; item.title = `Chyba načítání: ${avatarPath}`; };
             item.appendChild(img); fragment.appendChild(item);
        }
        ui.builtinAvatarGrid.appendChild(fragment);
        console.log("[Settings Avatars] Built-in avatars populated into grid.");
    }
    function applyPreferences(preferences) {
        if (!preferences) return;
        const isDarkMode = preferences.dark_mode ?? document.documentElement.classList.contains('dark'); 
        document.documentElement.classList.toggle('dark', isDarkMode);
        document.documentElement.classList.toggle('light', !isDarkMode);
        console.log("[Settings Preferences Apply] Aplikováno nastavení (Tmavý režim: " + isDarkMode + ")");
    }
    function populateLearningGoalForm(learningGoal, goalDetails) {
        if (!ui.learningGoalSelect || !ui.goalDetailsContainer || !ui.goalDetailsMathAccelerate || !ui.goalDetailsMathReview || !ui.accelerateGradeProfileSelect || !ui.accelerateIntensityProfileSelect || !ui.reviewGradeProfileSelect) { console.warn("Learning goal form elements not found."); return; }
        ui.learningGoalSelect.value = learningGoal || "";
        goalDetails = goalDetails || {}; 
        ui.goalDetailsMathAccelerate.style.display = 'none'; ui.goalDetailsMathReview.style.display = 'none'; ui.goalDetailsContainer.style.display = 'none';
        if (learningGoal === 'math_accelerate') {
            ui.accelerateGradeProfileSelect.value = goalDetails.grade || ""; ui.accelerateIntensityProfileSelect.value = goalDetails.intensity || "medium";
            ui.goalDetailsMathAccelerate.style.display = 'block'; ui.goalDetailsContainer.style.display = 'block';
        } else if (learningGoal === 'math_review') {
            ui.reviewGradeProfileSelect.value = goalDetails.grade || "";
            ui.goalDetailsMathReview.style.display = 'block'; ui.goalDetailsContainer.style.display = 'block';
        }
    }
    
    function validateProfileForm() { clearAllErrors('profile-form'); let isValid = true; if (!validators.required(ui.usernameField.value, 'username')) isValid = false; else if (!validators.minLength(ui.usernameField.value, 'username', 3)) isValid = false; return isValid; }
    function validatePasswordForm() { clearAllErrors('password-form'); let isValid = true; const newPassword = ui.newPasswordField.value; const confirmPassword = ui.confirmPasswordField.value; const currentPassword = ui.currentPasswordField.value; if (!validators.required(currentPassword, 'current_password')) isValid = false; if (!validators.required(newPassword, 'new_password', 'Zadejte nové heslo.')) isValid = false; else if (!validators.minLength(newPassword, 'new_password', 8)) isValid = false; if (!validators.required(confirmPassword, 'confirm_password', 'Potvrďte nové heslo.')) isValid = false; else if (newPassword && !validators.match(confirmPassword, 'confirm_password', newPassword, 'Hesla se neshodují.')) isValid = false; return isValid; }
    
    async function loadAndDisplayProfile() {
        console.log("[Settings MAIN] Loading and displaying profile...");
        if (!currentUser) { console.error("[Settings MAIN] No logged-in user."); showError("Pro přístup k profilu se musíte přihlásit.", true); return; }
        if(ui.profileContent) ui.profileContent.style.display = 'none'; 
        hideError(); 
        setLoadingState('profile', true); 
        try {
             const [profileResult, titlesResult, notificationsResult] = await Promise.allSettled([ fetchUserProfile(currentUser.id), fetchTitles(), fetchNotifications(currentUser.id, 5) ]);
             if (profileResult.status === 'fulfilled' && profileResult.value) { currentProfile = profileResult.value; console.log("[Settings MAIN] Profile loaded successfully."); }
             else { throw new Error(`Nepodařilo se načíst profil: ${profileResult.reason || 'Nenalezen'}`); }
             if (titlesResult.status === 'fulfilled') { allTitles = titlesResult.value || []; console.log("[Settings MAIN] Titles loaded successfully."); }
             else { console.warn("[Settings MAIN] Failed to load titles:", titlesResult.reason); allTitles = []; }
             updateProfileDisplay(currentProfile, allTitles); 
             if (notificationsResult.status === 'fulfilled') { const { unreadCount, notifications } = notificationsResult.value || { unreadCount: 0, notifications: [] }; renderNotifications(unreadCount, notifications); }
             else { console.error("Error fetching notifications:", notificationsResult.reason); renderNotifications(0, []); }
            if(ui.profileContent) ui.profileContent.style.display = 'block'; 
            console.log("[Settings MAIN] Profil a notifikace úspěšně načteny a zobrazeny.");
        } catch (error) {
            console.error('[Settings MAIN] Chyba při načítání profilu nebo titulů:', error); showError('Nepodařilo se načíst profil: ' + error.message, true); 
             renderNotifications(0, []); 
        } finally { setLoadingState('profile', false); setLoadingState('notifications', false); setLoadingState('titles', false); }
    }

    function setupEventListeners() {
        console.log("[Settings SETUP] Setting up event listeners...");
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openVyukaSidebarMobile); 
        if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleVyukaSidebarDesktop); 
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeVyukaSidebarMobile);
        
        document.querySelectorAll('.vyuka-sidebar-ai-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 768 && ui.sidebar?.classList.contains('active-mobile')) closeVyukaSidebarMobile(); }); });
        if (ui.profileForm) { ui.profileForm.addEventListener('submit', async (e) => { e.preventDefault(); if (!validateProfileForm() || isLoading.profile) return; await updateProfileData({ first_name: ui.firstNameField.value, last_name: ui.lastNameField.value, username: ui.usernameField.value, school: ui.schoolField.value, grade: ui.gradeField.value, bio: ui.bioField.value }); }); }
        if (ui.passwordForm) { ui.passwordForm.addEventListener('submit', async (e) => { e.preventDefault(); if (!validatePasswordForm() || isLoading.password) return; const success = await updateUserPassword(ui.currentPasswordField.value, ui.newPasswordField.value); if (success && ui.passwordForm) ui.passwordForm.reset(); }); }
        if (ui.savePreferencesBtn) { ui.savePreferencesBtn.addEventListener('click', async () => { if(isLoading.preferences) return; await updatePreferencesData(); }); }
        if (ui.learningGoalSelect) { ui.learningGoalSelect.addEventListener('change', function() { populateLearningGoalForm(this.value, currentProfile?.preferences?.goal_details || {}); }); }
        if (ui.profileAvatar) { ui.profileAvatar.addEventListener('click', (event) => { if (event.target.closest('#edit-avatar-btn') || event.target.closest('.edit-avatar-overlay')) { console.log("[Settings Event] Edit avatar clicked, opening modal."); showModal('avatar-modal'); } }); }
        
        if (ui.selectAvatarFileBtn && ui.avatarUpload) { 
            ui.selectAvatarFileBtn.addEventListener('click', () => { 
                console.log("[Settings Event] Upload button clicked, triggering file input."); 
                ui.avatarUpload.click(); 
            }); 
        } else { 
            console.warn("Could not find avatar select button or file input for listener setup."); 
        }
        
        if (ui.avatarUpload) { 
            ui.avatarUpload.addEventListener('change', function() { 
                if (this.files && this.files[0]) { 
                    console.log("[Settings Event] File selected:", this.files[0].name); 
                    selectedBuiltInAvatarPath = null; 
                    if(ui.builtinAvatarGrid) ui.builtinAvatarGrid.querySelectorAll('.selected').forEach(el => el.classList.remove('selected')); 
                    const reader = new FileReader(); 
                    reader.onload = (e) => { 
                        if (ui.avatarPreview) ui.avatarPreview.innerHTML = `<img src="${e.target.result}" alt="Náhled"/>`; 
                        if (ui.saveAvatarBtn) ui.saveAvatarBtn.disabled = false; 
                    }; 
                    reader.readAsDataURL(this.files[0]); 
                } else { 
                    console.log("[Settings Event] File selection cancelled."); 
                    if (!selectedBuiltInAvatarPath && ui.saveAvatarBtn) ui.saveAvatarBtn.disabled = true; 
                } 
            }); 
        }

        if(ui.builtinAvatarGrid) { ui.builtinAvatarGrid.addEventListener('click', (event) => { const clickedItem = event.target.closest('.builtin-avatar-item'); if (clickedItem) { if (ui.avatarUpload) ui.avatarUpload.value = ''; const path = clickedItem.dataset.path; if(!path) { console.error("Missing data-path on clicked avatar item:", clickedItem); return; } selectedBuiltInAvatarPath = path; ui.builtinAvatarGrid.querySelectorAll('.selected').forEach(el => el.classList.remove('selected')); clickedItem.classList.add('selected'); if (ui.avatarPreview) ui.avatarPreview.innerHTML = `<img src="${path}" alt="Náhled">`; if (ui.saveAvatarBtn) ui.saveAvatarBtn.disabled = false; console.log("[Settings Event] Selected built-in avatar:", path); } }); } else { console.error("CRITICAL: Built-in avatar grid container not found for event listener setup!"); }
        if (ui.saveAvatarBtn) { ui.saveAvatarBtn.addEventListener('click', async () => { if(isLoading.avatar) return; console.log("[Settings Event] Save avatar button clicked."); await saveSelectedAvatar(); }); }
        if (ui.deleteAccountBtn) { ui.deleteAccountBtn.addEventListener('click', () => showModal('delete-account-modal')); }
        if (ui.confirmDeleteAccountBtn) { ui.confirmDeleteAccountBtn.addEventListener('click', async () => { if(isLoading.delete) return; await deleteUserAccount(ui.confirmDeletePasswordField?.value); }); }
        document.querySelectorAll('.modal-close, [data-dismiss="modal"]').forEach(btn => { btn.addEventListener('click', function() { hideModal(this.closest('.modal').id); }); });
        document.querySelectorAll('.modal').forEach(modal => { modal.addEventListener('click', function(event) { if (event.target === this) { hideModal(this.id); } }); });
        if(ui.profileTabs) ui.profileTabs.forEach(tab => { tab.addEventListener('click', () => { ui.profileTabs.forEach(t => t.classList.remove('active')); tab.classList.add('active'); const tabId = tab.dataset.tab; ui.tabContents.forEach(c => c.classList.remove('active')); const activeContent = document.getElementById(tabId); if (activeContent) activeContent.classList.add('active'); }); });
        if (ui.logoutBtn) { ui.logoutBtn.addEventListener('click', async () => { try { console.log("Odhlášení..."); ui.logoutBtn.disabled = true; const { error } = await supabase.auth.signOut(); if (error) throw error; console.log("Odhlášeno, přesměrovávám..."); window.location.href = '/auth/index.html'; } catch (error) { console.error('Chyba při odhlášení:', error); showToast('Chyba', `Chyba při odhlášení: ${error.message}`, 'error'); ui.logoutBtn.disabled = false; } }); }
        document.querySelectorAll('.form-control').forEach(input => { input.addEventListener('input', () => clearFieldError(input.id)); input.addEventListener('change', () => clearFieldError(input.id)); });
        window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus);
        initMouseFollower(); initHeaderScrollDetection(); updateCopyrightYear();
        if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
        if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); } 
        if (ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); const dot = item.querySelector('.unread-dot'); if(dot) dot.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }); }
        document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } 
            if(ui.userDropdownMenu?.classList.contains('active') && !ui.userDropdownMenu.contains(event.target) && !ui.headerUserDisplay?.contains(event.target)) {
                 ui.userDropdownMenu.classList.remove('active');
                 ui.userDropdownMenu.style.opacity = '0';
                 ui.userDropdownMenu.style.visibility = 'hidden';
                 ui.userDropdownMenu.style.transform = 'translateY(10px) scale(0.95)';
            }
        });

        if (ui.headerUserDisplay) { 
            ui.headerUserDisplay.addEventListener('click', (event) => {
                event.stopPropagation();
                if (ui.userDropdownMenu) {
                    const isActive = ui.userDropdownMenu.classList.toggle('active');
                    ui.userDropdownMenu.style.opacity = isActive ? '1' : '0';
                    ui.userDropdownMenu.style.visibility = isActive ? 'visible' : 'hidden';
                    ui.userDropdownMenu.style.transform = isActive ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)';
                }
            });
        }

        if (ui.publicProfileLinkSidebar) { ui.publicProfileLinkSidebar.addEventListener('click', (e) => { e.preventDefault(); if (currentProfile && currentProfile.username) { window.location.href = `/dashboard/profile.html`; } else { showToast('Chyba', 'Uživatelské jméno není dostupné pro vytvoření odkazu.', 'error'); window.location.href = `/dashboard/profile.html`; } }); }
        console.log("[Settings SETUP] Posluchači událostí nastaveni.");
    }

    async function initializeApp() {
        console.log("[Settings INIT] Spouštění inicializace aplikace profilu...");
        cacheDOMElements(); 
        if (!initializeSupabase()) { return; }
        
        applyInitialVyukaSidebarState(); 
        
        if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; }
        const mainContentArea = document.getElementById('settings-main-area'); 
        if (mainContentArea) mainContentArea.style.display = 'none'; 

        try {
            console.log("[Settings INIT] Kontrola autentizační seance...");
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit sezení: ${sessionError.message}`);
            if (!session || !session.user) { console.log('[Settings INIT] Uživatel není přihlášen, přesměrování na /auth/index.html'); window.location.href = '/auth/index.html'; return; }
            currentUser = session.user;
            console.log(`[Settings INIT] Uživatel ověřen (ID: ${currentUser.id}). Načítání profilu a titulů...`);
            await loadAndDisplayProfile(); 
            setupEventListeners(); 
            if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 600); } 
            if (mainContentArea) { mainContentArea.style.display = 'block'; requestAnimationFrame(() => { if(mainContentArea) mainContentArea.classList.add('loaded'); }); }
            console.log("✅ [Settings INIT] Inicializace stránky profilu dokončena.");
        } catch (error) {
            console.error("❌ [Settings INIT] Kritická chyba při inicializaci profilu:", error);
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA: ${error.message}. Obnovte.</p>`; }
            else { showError(`Chyba inicializace: ${error.message}`, true); }
            if (mainContentArea) mainContentArea.style.display = 'block'; 
        }
    }
    // --- START THE APP ---
    initializeApp();

})();