import auth from './auth.js';
import ui from './ui.js';

class Profile {
    constructor() {
        this.supabase = null;
        this.currentProfile = null;
    }

    init(supabaseClient) {
        this.supabase = supabaseClient;
    }

    async loadUserProfile() {
        try {
            ui.showLoading();
            const user = await auth.getCurrentUser();
            
            if (!user) {
                throw new Error('User not authenticated');
            }

            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            if (!profile) {
                return await this.createDefaultProfile(user);
            }

            this.currentProfile = profile;
            ui.updateProfile(profile);
            return profile;

        } catch (error) {
            ui.showError('Nepodařilo se načíst profil: ' + error.message);
            throw error;
        } finally {
            ui.hideLoading();
        }
    }

    async createDefaultProfile(user) {
        try {
            const defaultProfile = {
                id: user.id,
                email: user.email,
                username: user.email.split('@')[0],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                preferences: {
                    dark_mode: false,
                    show_progress: true,
                    sound_effects: true,
                    language: 'cs'
                },
                notifications: {
                    email: true,
                    study_tips: true,
                    content_updates: true,
                    practice_reminders: true
                }
            };

            const { data: profile, error } = await this.supabase
                .from('profiles')
                .insert([defaultProfile])
                .select()
                .single();

            if (error) throw error;

            this.currentProfile = profile;
            ui.updateProfile(profile);
            return profile;

        } catch (error) {
            ui.showError('Nepodařilo se vytvořit profil: ' + error.message);
            throw error;
        }
    }

    async updateProfile(updates) {
        try {
            ui.showLoading();
            const user = await auth.getCurrentUser();
            
            if (!user) {
                throw new Error('User not authenticated');
            }

            const { data: profile, error } = await this.supabase
                .from('profiles')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id)
                .select()
                .single();

            if (error) throw error;

            this.currentProfile = profile;
            ui.updateProfile(profile);
            ui.showAlert('Profil byl úspěšně aktualizován', 'success');
            return profile;

        } catch (error) {
            ui.showError('Nepodařilo se aktualizovat profil: ' + error.message);
            throw error;
        } finally {
            ui.hideLoading();
        }
    }

    async updateAvatar(file) {
        try {
            ui.showLoading();
            const user = await auth.getCurrentUser();
            
            if (!file || !user) {
                throw new Error('No file or user not authenticated');
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await this.supabase
                .storage
                .from('avatars')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = this.supabase
                .storage
                .from('avatars')
                .getPublicUrl(fileName);

            const { data: profile, error: updateError } = await this.supabase
                .from('profiles')
                .update({
                    avatar_url: publicUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id)
                .select()
                .single();

            if (updateError) throw updateError;

            this.currentProfile = profile;
            ui.updateProfile(profile);
            ui.showAlert('Avatar byl úspěšně aktualizován', 'success');
            return profile;

        } catch (error) {
            ui.showError('Nepodařilo se nahrát avatar: ' + error.message);
            throw error;
        } finally {
            ui.hideLoading();
        }
    }

    async updatePreferences(preferences) {
        try {
            const currentProfile = await this.loadUserProfile();
            const updatedPreferences = {
                ...currentProfile.preferences,
                ...preferences
            };

            return await this.updateProfile({
                preferences: updatedPreferences
            });

        } catch (error) {
            ui.showError('Nepodařilo se aktualizovat preference: ' + error.message);
            throw error;
        }
    }

    async updateNotificationSettings(settings) {
        try {
            const currentProfile = await this.loadUserProfile();
            const updatedNotifications = {
                ...currentProfile.notifications,
                ...settings
            };

            return await this.updateProfile({
                notifications: updatedNotifications
            });

        } catch (error) {
            ui.showError('Nepodařilo se aktualizovat nastavení oznámení: ' + error.message);
            throw error;
        }
    }

    async deleteAccount() {
        try {
            ui.showLoading();
            const user = await auth.getCurrentUser();
            
            if (!user) {
                throw new Error('User not authenticated');
            }

            const { error: storageError } = await this.supabase
                .storage
                .from('avatars')
                .remove([`${user.id}`]);

            const { error: profileError } = await this.supabase
                .from('profiles')
                .delete()
                .eq('id', user.id);

            if (profileError) throw profileError;

            await auth.signOut();
            window.location.href = '/login.html';

        } catch (error) {
            ui.showError('Nepodařilo se smazat účet: ' + error.message);
            throw error;
        } finally {
            ui.hideLoading();
        }
    }

    getCurrentProfile() {
        return this.currentProfile;
    }

    async getProfileStats() {
        try {
            const user = await auth.getCurrentUser();
            
            if (!user) {
                throw new Error('User not authenticated');
            }

            const { data: stats, error } = await this.supabase
                .from('user_stats')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error) throw error;
            return stats;

        } catch (error) {
            ui.showError('Nepodařilo se načíst statistiky: ' + error.message);
            throw error;
        }
    }
}

const profile = new Profile();
export default profile;