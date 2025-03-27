class Auth {
    constructor() {
        this.supabase = null;
        this.user = null;
        this.listeners = [];
    }

    init(supabaseUrl, supabaseKey) {
        this.supabase = supabase.createClient(supabaseUrl, supabaseKey);
        this.checkSession();
    }

    async checkSession() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                throw error;
            }

            if (user) {
                this.user = user;
                this.notifyListeners();
            } else {
                this.redirectToLogin();
            }

        } catch (error) {
            console.error('Session check error:', error);
            this.redirectToLogin();
        }
    }

    async signIn(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            this.user = data.user;
            this.notifyListeners();
            return data;

        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    }

    async signUp(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password
            });

            if (error) throw error;

            return data;

        } catch (error) {
            console.error('Sign up error:', error);
            throw error;
        }
    }

    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;

            this.user = null;
            this.notifyListeners();
            this.redirectToLogin();

        } catch (error) {
            console.error('Sign out error:', error);
            throw error;
        }
    }

    async resetPassword(email) {
        try {
            const { data, error } = await this.supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;
            return data;

        } catch (error) {
            console.error('Password reset error:', error);
            throw error;
        }
    }

    async updatePassword(newPassword) {
        try {
            const { data, error } = await this.supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;
            return data;

        } catch (error) {
            console.error('Password update error:', error);
            throw error;
        }
    }

    async getCurrentUser() {
        if (this.user) return this.user;

        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            if (error) throw error;
            
            this.user = user;
            return user;

        } catch (error) {
            console.error('Get current user error:', error);
            return null;
        }
    }

    async getUserProfile() {
        try {
            const user = await this.getCurrentUser();
            if (!user) return null;

            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            return profile;

        } catch (error) {
            console.error('Get user profile error:', error);
            throw error;
        }
    }

    addAuthStateListener(listener) {
        this.listeners.push(listener);
        if (this.user) {
            listener(this.user);
        }
    }

    removeAuthStateListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    notifyListeners() {
        this.listeners.forEach(listener => listener(this.user));
    }

    redirectToLogin() {
        if (window.location.pathname !== '/login.html') {
            window.location.href = '/login.html';
        }
    }

    isAuthenticated() {
        return !!this.user;
    }

    getUserId() {
        return this.user ? this.user.id : null;
    }

    getUserEmail() {
        return this.user ? this.user.email : null;
    }
}

// Создаем и экспортируем единственный экземпляр
const auth = new Auth();
export default auth;