document.addEventListener('DOMContentLoaded', function() {
    // Initialize the Supabase client
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co'; // Replace with your actual Supabase URL
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    // Fixed initialization - use the global supabase object from CDN
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    
    // Elements for displaying loading state and errors
    const loadingEl = document.createElement('div');
    loadingEl.className = 'loading';
    loadingEl.textContent = 'Načítání profilu...';
    
    const errorContainer = document.querySelector('.error-container') || document.createElement('div');
    errorContainer.className = 'error-container';
    
    // Function to show an alert
    function showAlert(message, type) {
        const alert = document.createElement('div');
        alert.className = `alert ${type}`;
        alert.textContent = message;
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => {
                alert.remove();
            }, 300);
        }, 3000);
    }
    
    // Function to load user profile
    async function loadUserProfile() {
        try {
            // Show loading state
            document.querySelector('.profile-card').appendChild(loadingEl);
            
            // Get the current user
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            
            if (authError) throw authError;
            
            if (!user) {
                window.location.href = 'auth/index.html'; // Redirect to login if no user
                return;
            }
            
            // Fetch profile data
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (profileError) throw profileError;
            
            // Remove loading indicator
            loadingEl.remove();
            
            if (!profile) {
                showAlert('Profil nebyl nalezen. Vytvoříme vám nový.', 'warning');
                // Could redirect to profile creation page or create default profile
                return;
            }
            
            // Populate the user profile UI
            populateProfileUI(profile);
            
        } catch (error) {
            loadingEl.remove();
            console.error('Error loading profile:', error);
            
            errorContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <div>
                        <p>Chyba při načítání profilu: ${error.message || error}</p>
                        <button class="retry-button" id="global-retry-btn">Zkusit znovu</button>
                    </div>
                </div>
            `;
            document.querySelector('.profile-card').prepend(errorContainer);
            errorContainer.style.display = 'block';
            
            // Add retry functionality
            errorContainer.querySelector('.retry-button').addEventListener('click', function() {
                errorContainer.style.display = 'none';
                loadUserProfile();
            });
        }
    }
    
    // Function to populate the UI with profile data
    function populateProfileUI(profile) {
        // Basic profile info
        const userAvatar = document.querySelector('.profile-avatar');
        if (profile.avatar_url) {
            userAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="${profile.username || 'User'}" />
                                  <div class="change-avatar">Změnit avatar</div>`;
        } else {
            const initials = ((profile.first_name || '').charAt(0) + (profile.last_name || '').charAt(0)).toUpperCase();
            userAvatar.innerHTML = `${initials || 'U'}<div class="change-avatar">Změnit avatar</div>`;
        }
        
        // Also update the sidebar avatar if it exists
        const sidebarAvatar = document.getElementById('user-avatar');
        if (sidebarAvatar) {
            if (profile.avatar_url) {
                sidebarAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="${profile.username || 'User'}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
            } else {
                const initials = ((profile.first_name || '').charAt(0) + (profile.last_name || '').charAt(0)).toUpperCase();
                sidebarAvatar.textContent = initials || 'U';
            }
        }
        
        // Update sidebar username if it exists
        const sidebarUsername = document.getElementById('user-name');
        if (sidebarUsername) {
            sidebarUsername.textContent = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || 'Uživatel';
        }
        
        document.querySelector('.profile-name').textContent = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Uživatel';
        document.querySelector('.profile-username').textContent = profile.username || 'no-username';
        
        // Profile stats
        const statValues = document.querySelectorAll('.stat-value');
        if (statValues.length >= 2) {
            statValues[0].textContent = profile.completed_exercises || 0;
            statValues[1].textContent = profile.streak_days || 0;
        }
        
        // Bio
        const bioElement = document.querySelector('.profile-bio');
        bioElement.textContent = profile.bio || 'Bio není nastaveno';
        
        // Fill form fields in profile settings (if they exist)
        const usernameInput = document.querySelector('#username');
        if (usernameInput) usernameInput.value = profile.username || '';
        
        const firstNameInput = document.querySelector('#first_name');
        if (firstNameInput) firstNameInput.value = profile.first_name || '';
        
        const lastNameInput = document.querySelector('#last_name');
        if (lastNameInput) lastNameInput.value = profile.last_name || '';
        
        const emailInput = document.querySelector('#email');
        if (emailInput) emailInput.value = profile.email || '';
        
        const bioInput = document.querySelector('#bio');
        if (bioInput) bioInput.value = profile.bio || '';
        
        const schoolInput = document.querySelector('#school');
        if (schoolInput) schoolInput.value = profile.school || '';
        
        const gradeInput = document.querySelector('#grade');
        if (gradeInput) gradeInput.value = profile.grade || '';
        
        // Set preferences toggles
        if (profile.preferences) {
            try {
                const preferences = typeof profile.preferences === 'string' ? 
                    JSON.parse(profile.preferences) : profile.preferences;
                
                const darkModeToggle = document.querySelector('#dark_mode');
                if (darkModeToggle) darkModeToggle.checked = preferences.dark_mode || false;
                
                const showProgressToggle = document.querySelector('#show_progress');
                if (showProgressToggle) showProgressToggle.checked = preferences.show_progress || false;
                
                const soundEffectsToggle = document.querySelector('#sound_effects');
                if (soundEffectsToggle) soundEffectsToggle.checked = preferences.sound_effects || false;
                
                const languageSelect = document.querySelector('#language');
                if (languageSelect && preferences.language) {
                    languageSelect.value = preferences.language;
                }
            } catch (e) {
                console.error('Error parsing preferences:', e);
            }
        }
        
        // Set notification preferences
        if (profile.notifications) {
            try {
                const notifications = typeof profile.notifications === 'string' ? 
                    JSON.parse(profile.notifications) : profile.notifications;
                
                const emailNotifToggle = document.querySelector('#email_notifications');
                if (emailNotifToggle) emailNotifToggle.checked = notifications.email || false;
                
                const studyTipsToggle = document.querySelector('#study_tips');
                if (studyTipsToggle) studyTipsToggle.checked = notifications.study_tips || false;
                
                const contentUpdatesToggle = document.querySelector('#content_updates');
                if (contentUpdatesToggle) contentUpdatesToggle.checked = notifications.content_updates || false;
                
                const practiceRemindersToggle = document.querySelector('#practice_reminders');
                if (practiceRemindersToggle) practiceRemindersToggle.checked = notifications.practice_reminders || false;
            } catch (e) {
                console.error('Error parsing notifications:', e);
            }
        }
    }
    
    // Handle form submission for profile updates
    const profileForm = document.querySelector('#profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError) throw authError;
                
                const formData = new FormData(profileForm);
                const updates = {
                    id: user.id,
                    username: formData.get('username'),
                    first_name: formData.get('first_name'),
                    last_name: formData.get('last_name'),
                    bio: formData.get('bio'),
                    school: formData.get('school'),
                    grade: formData.get('grade'),
                    updated_at: new Date()
                };
                
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update(updates)
                    .eq('id', user.id);
                
                if (updateError) throw updateError;
                
                showAlert('Profil byl úspěšně aktualizován', 'success');
                
                // Reload profile data
                loadUserProfile();
                
            } catch (error) {
                showAlert(`Chyba při aktualizaci profilu: ${error.message || error}`, 'danger');
                console.error('Update error:', error);
            }
        });
    }
    
    // Handle preferences update
    const savePreferencesBtn = document.getElementById('save-preferences');
    if (savePreferencesBtn) {
        savePreferencesBtn.addEventListener('click', async function() {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError) throw authError;
                
                const preferences = {
                    dark_mode: document.getElementById('dark_mode').checked,
                    show_progress: document.getElementById('show_progress').checked,
                    sound_effects: document.getElementById('sound_effects').checked,
                    language: document.getElementById('language').value
                };
                
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        preferences: preferences,
                        updated_at: new Date()
                    })
                    .eq('id', user.id);
                
                if (updateError) throw updateError;
                
                showAlert('Preference byly úspěšně aktualizovány', 'success');
                
            } catch (error) {
                showAlert(`Chyba při aktualizaci preferencí: ${error.message || error}`, 'danger');
                console.error('Preferences update error:', error);
            }
        });
    }
    
    // Handle notifications update
    const saveNotificationsBtn = document.getElementById('save-notifications');
    if (saveNotificationsBtn) {
        saveNotificationsBtn.addEventListener('click', async function() {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError) throw authError;
                
                const notifications = {
                    email: document.getElementById('email_notifications').checked,
                    study_tips: document.getElementById('study_tips').checked,
                    content_updates: document.getElementById('content_updates').checked,
                    practice_reminders: document.getElementById('practice_reminders').checked
                };
                
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        notifications: notifications,
                        updated_at: new Date()
                    })
                    .eq('id', user.id);
                
                if (updateError) throw updateError;
                
                showAlert('Nastavení oznámení bylo úspěšně aktualizováno', 'success');
                
            } catch (error) {
                showAlert(`Chyba při aktualizaci oznámení: ${error.message || error}`, 'danger');
                console.error('Notifications update error:', error);
            }
        });
    }
    
    // Handle avatar upload
    const saveAvatarBtn = document.getElementById('save-avatar');
    if (saveAvatarBtn) {
        saveAvatarBtn.addEventListener('click', async function() {
            try {
                const avatarInput = document.getElementById('avatar-input');
                const file = avatarInput.files[0];
                
                if (!file) {
                    showAlert('Vyberte prosím obrázek', 'warning');
                    return;
                }
                
                // Add loading spinner to button
                const btnText = saveAvatarBtn.querySelector('.btn-text') || saveAvatarBtn;
                const originalText = btnText.innerHTML;
                btnText.innerHTML = `<div class="loading-spinner"></div> Nahrávám...`;
                saveAvatarBtn.disabled = true;
                
                // Get current user
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError) throw authError;
                
                // Create a unique filename
                const fileExt = file.name.split('.').pop();
                const fileName = `${user.id}-${Date.now()}.${fileExt}`;
                
                // Upload file to Supabase storage
                const { data: uploadData, error: uploadError } = await supabase
                    .storage
                    .from('avatars')
                    .upload(fileName, file);
                
                if (uploadError) throw uploadError;
                
                // Get the public URL for the uploaded file
                const { data: { publicUrl } } = supabase
                    .storage
                    .from('avatars')
                    .getPublicUrl(fileName);
                
                // Update profile with new avatar URL
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ 
                        avatar_url: publicUrl,
                        updated_at: new Date()
                    })
                    .eq('id', user.id);
                
                if (updateError) throw updateError;
                
                // Show success message
                showAlert('Avatar byl úspěšně aktualizován', 'success');
                
                // Close modal
                document.getElementById('avatar-modal').classList.remove('active');
                
                // Reset avatar upload form
                document.getElementById('avatar-preview').style.display = 'none';
                avatarInput.value = '';
                
                // Reload profile to show new avatar
                loadUserProfile();
                
            } catch (error) {
                showAlert(`Chyba při nahrávání avataru: ${error.message || error}`, 'danger');
                console.error('Avatar upload error:', error);
            } finally {
                // Restore button text
                const btnText = saveAvatarBtn.querySelector('.btn-text') || saveAvatarBtn;
                btnText.innerHTML = 'Uložit';
                saveAvatarBtn.disabled = false;
            }
        });
    }
    
    // Handle password change
    const savePasswordBtn = document.getElementById('save-password');
    if (savePasswordBtn) {
        savePasswordBtn.addEventListener('click', async function() {
            try {
                const currentPassword = document.getElementById('current-password').value;
                const newPassword = document.getElementById('new-password').value;
                const confirmPassword = document.getElementById('confirm-password').value;
                
                // Validate inputs
                if (!currentPassword || !newPassword || !confirmPassword) {
                    showAlert('Vyplňte prosím všechna pole', 'warning');
                    return;
                }
                
                if (newPassword !== confirmPassword) {
                    showAlert('Nová hesla se neshodují', 'warning');
                    return;
                }
                
                if (newPassword.length < 8) {
                    showAlert('Nové heslo musí mít alespoň 8 znaků', 'warning');
                    return;
                }
                
                // Add loading spinner to button
                const btnText = savePasswordBtn.querySelector('.btn-text') || savePasswordBtn;
                const originalText = btnText.innerHTML;
                btnText.innerHTML = `<div class="loading-spinner"></div> Měním heslo...`;
                savePasswordBtn.disabled = true;
                
                // Get user's email
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError) throw authError;
                
                // Sign in to verify current password
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: user.email,
                    password: currentPassword
                });
                
                if (signInError) {
                    showAlert('Současné heslo není správné', 'danger');
                    throw signInError;
                }
                
                // Update password
                const { error: passwordError } = await supabase.auth.updateUser({
                    password: newPassword
                });
                
                if (passwordError) throw passwordError;
                
                // Success!
                showAlert('Heslo bylo úspěšně změněno', 'success');
                
                // Close modal
                document.getElementById('password-modal').classList.remove('active');
                
                // Reset form
                document.getElementById('password-form').reset();
                
            } catch (error) {
                console.error('Password change error:', error);
                // Alert is already shown for common errors
            } finally {
                // Restore button text
                const btnText = savePasswordBtn.querySelector('.btn-text') || savePasswordBtn;
                btnText.innerHTML = 'Změnit heslo';
                savePasswordBtn.disabled = false;
            }
        });
    }
    
    // Handle account deletion
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async function() {
            try {
                // Add loading spinner to button
                const btnText = confirmDeleteBtn.querySelector('.btn-text') || confirmDeleteBtn;
                const originalText = btnText.innerHTML;
                btnText.innerHTML = `<div class="loading-spinner"></div> Mažu účet...`;
                confirmDeleteBtn.disabled = true;
                
                // Delete user account
                const { error: deleteError } = await supabase.auth.admin.deleteUser(
                    (await supabase.auth.getUser()).data.user.id
                );
                
                if (deleteError) throw deleteError;
                
                // Sign out
                await supabase.auth.signOut();
                
                // Show success message and redirect
                showAlert('Váš účet byl úspěšně smazán', 'success');
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 2000);
                
            } catch (error) {
                showAlert(`Chyba při mazání účtu: ${error.message || error}`, 'danger');
                console.error('Account deletion error:', error);
                
                // Restore button text
                const btnText = confirmDeleteBtn.querySelector('.btn-text') || confirmDeleteBtn;
                btnText.innerHTML = 'Smazat účet';
                confirmDeleteBtn.disabled = false;
            }
        });
    }
    
    // Handle reset preferences button
    const resetPreferencesBtn = document.getElementById('reset-preferences');
    if (resetPreferencesBtn) {
        resetPreferencesBtn.addEventListener('click', async function() {
            // Set default values for preferences
            document.getElementById('dark_mode').checked = false;
            document.getElementById('show_progress').checked = true;
            document.getElementById('sound_effects').checked = true;
            document.getElementById('language').value = 'cs';
            
            showAlert('Preference byly resetovány na výchozí hodnoty', 'info');
        });
    }
    
    // Handle reset notifications button
    const resetNotificationsBtn = document.getElementById('reset-notifications');
    if (resetNotificationsBtn) {
        resetNotificationsBtn.addEventListener('click', function() {
            // Set default values for notifications
            document.getElementById('email_notifications').checked = true;
            document.getElementById('study_tips').checked = true;
            document.getElementById('content_updates').checked = true;
            document.getElementById('practice_reminders').checked = true;
            
            showAlert('Nastavení oznámení bylo resetováno na výchozí hodnoty', 'info');
        });
    }
    
    // Handle cancel changes button
    const cancelChangesBtn = document.getElementById('cancel-changes');
    if (cancelChangesBtn) {
        cancelChangesBtn.addEventListener('click', function() {
            // Reload the profile data to reset the form
            loadUserProfile();
            showAlert('Změny byly zrušeny', 'info');
        });
    }
    
    // Handle logout
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', async function(e) {
            e.preventDefault();
            
            try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                
                window.location.href = 'auth/index.html';
            } catch (error) {
                showAlert(`Chyba při odhlášení: ${error.message || error}`, 'danger');
                console.error('Logout error:', error);
            }
        });
    }
    
    // Handle direct edit profile button
    const editProfileBtn = document.getElementById('edit-profile-btn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', function() {
            // Activate personal info tab
            document.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.settings-content').forEach(content => content.classList.remove('active'));
            
            const personalInfoTab = document.querySelector('[data-tab="personal-info"]');
            if (personalInfoTab) {
                personalInfoTab.classList.add('active');
                document.getElementById('personal-info').classList.add('active');
            }
            
            // Scroll to the form on mobile
            if (window.innerWidth < 992) {
                document.querySelector('.settings-section').scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    
    // Initialize the profile loading
    loadUserProfile();
});