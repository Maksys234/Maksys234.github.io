// dashboard/js/ui-helpers.js
// Глобальный модуль для управления общими элементами UI и данными.
// Версия: v11.0 - "Stardust HUD" edition.

(function(global) {
    'use strict';

    if (!global.Justax) {
        global.Justax = {};
    }

    const UIHelpers = {
        SIDEBAR_STATE_KEY: 'vyukaSidebarState',
        ui: {},
        state: {
            supabase: null,
            currentUser: null,
            currentProfile: null,
            allTitles: []
        },

        init: function() {
            if (!this.state.supabase) {
                console.error("[UI Helpers] Supabase client is not initialized. Call Justax.initSupabase() first.");
                return;
            }
            this._cacheDOMElements();
            this._setupEventListeners();
            this.applyInitialSidebarState();
            this.loadInitialData();
            console.log('[UI Helpers] Initialized successfully.');
        },

        _cacheDOMElements: function() {
            this.ui = {
                sidebar: document.querySelector('.vyuka-sidebar-ai'),
                sidebarToggle: document.getElementById('sidebar-toggle-test'),
                mobileToggle: document.getElementById('mobile-menu-toggle-test'),
                sidebarOverlay: document.getElementById('sidebar-overlay-test'),
                notificationBell: document.getElementById('notification-bell'),
                notificationsDropdown: document.getElementById('notifications-dropdown'),
                notificationsList: document.getElementById('notifications-list'),
                notificationCount: document.getElementById('notification-count'),
                markAllReadBtn: document.getElementById('mark-all-read'),
                headerAvatar: document.getElementById('header-avatar-wrapper'),
                headerUserName: document.getElementById('header-user-name'),
                headerUserTitle: document.getElementById('header-user-title'),
                headerStatLevel: document.getElementById('header-stat-level-value'),
                headerStatXpFill: document.getElementById('header-stat-xp-fill'),
                headerStatCredits: document.getElementById('header-stat-credits-value'),
                logoutBtn: document.getElementById('logout-btn')
            };
        },

        _setupEventListeners: function() {
            if (this.ui.sidebarToggle) this.ui.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
            if (this.ui.mobileToggle) this.ui.mobileToggle.addEventListener('click', () => this.toggleMobileMenu());
            if (this.ui.sidebarOverlay) this.ui.sidebarOverlay.addEventListener('click', () => this.toggleMobileMenu());
            if (this.ui.notificationBell) this.ui.notificationBell.addEventListener('click', (e) => { e.stopPropagation(); this.ui.notificationsDropdown.classList.toggle('active'); });
            if (this.ui.markAllReadBtn) this.ui.markAllReadBtn.addEventListener('click', () => this.markAllAsRead());
            if (this.ui.notificationsList) this.ui.notificationsList.addEventListener('click', (e) => { const item = e.target.closest('.notification-item'); if (item?.dataset.id) this.markNotificationAsRead(item.dataset.id); });
            document.addEventListener('click', (e) => { if (this.ui.notificationsDropdown && !this.ui.notificationsDropdown.contains(e.target) && !this.ui.notificationBell.contains(e.target)) { this.ui.notificationsDropdown.classList.remove('active'); } });
            if (this.ui.logoutBtn) { this.ui.logoutBtn.addEventListener('click', async () => { if (this.state.supabase) { await this.state.supabase.auth.signOut(); window.location.href = '/auth/index.html'; } }); }
        },

        toggleSidebar: function() { this.ui.sidebar.classList.toggle('expanded'); },
        toggleMobileMenu: function() { this.ui.sidebar.classList.toggle('active-mobile'); this.ui.sidebarOverlay.classList.toggle('active'); },
        applyInitialSidebarState: function() { /* Logic for persistence if needed */ },
        
        loadInitialData: async function() {
            try {
                const { data: { user } } = await this.state.supabase.auth.getUser();
                if (user) {
                    this.state.currentUser = user;
                    const [profileRes, titlesRes] = await Promise.all([
                        this.state.supabase.from('profiles').select('*').eq('id', user.id).single(),
                        this.state.supabase.from('title_shop').select('title_key, name')
                    ]);
                    if (profileRes.error && profileRes.error.code !== 'PGRST116') throw profileRes.error;
                    this.state.currentProfile = profileRes.data;
                    this.state.allTitles = titlesRes.data || [];
                    this.updateHeaderUI();
                    this.loadNotifications();
                } else {
                    this.updateHeaderUI(); // Show as logged out
                    this.renderNotifications(0, []);
                }
            } catch (error) {
                console.error("Error loading initial data:", error);
                this.updateHeaderUI();
                this.renderNotifications(0, []);
            }
        },

        updateHeaderUI: function() {
            this.updateHeaderProfile(this.state.currentProfile, this.state.allTitles);
            this.updateHeaderStats(this.state.currentProfile);
        },

        updateHeaderProfile: function(profile, titles) {
            const getInitials = (p, e) => { if (!p && !e) return '?'; let i = ''; if (p?.first_name) i += p.first_name[0]; if (p?.last_name) i += p.last_name[0]; if (i) return i.toUpperCase(); if (p?.username) return p.username[0].toUpperCase(); if (e) return e[0].toUpperCase(); return 'P'; };
            const sanitize = (str) => { const t = document.createElement('div'); t.textContent = str || ''; return t.innerHTML; };

            if (!profile) { this.ui.headerUserName.textContent = "Nepřihlášen"; this.ui.headerUserTitle.textContent = "Host"; this.ui.headerAvatar.innerHTML = `<span>?</span>`; return; }
            const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || profile.email.split('@')[0];
            this.ui.headerUserName.textContent = sanitize(displayName);
            const initials = getInitials(profile, profile.email);
            if (profile.avatar_url) { this.ui.headerAvatar.innerHTML = `<img src="${sanitize(profile.avatar_url)}?t=${Date.now()}" alt="Avatar" class="vyuka-header-avatar-img">`; this.ui.headerAvatar.querySelector('img').onerror = () => { this.ui.headerAvatar.innerHTML = `<span>${initials}</span>`; };
            } else { this.ui.headerAvatar.innerHTML = `<span>${initials}</span>`; }
            let displayTitle = 'Pilot';
            if (profile.selected_title && titles?.length > 0) { const found = titles.find(t => t.title_key === profile.selected_title); if (found) displayTitle = found.name; }
            this.ui.headerUserTitle.textContent = sanitize(displayTitle);
        },

        updateHeaderStats: function(profile) {
            if (!profile) { this.ui.headerStatLevel.textContent = '-'; this.ui.headerStatCredits.textContent = '-'; this.ui.headerStatXpFill.style.width = '0%'; return; }
            this.ui.headerStatLevel.textContent = profile.level || 1;
            this.ui.headerStatCredits.textContent = profile.points || 0;
            const getExpForLevel = l => 100 + (25 * (l - 1));
            const getTotalExpThreshold = tL => { if (tL <= 1) return 0; let total = 0; for (let l = 1; l < tL; l++) total += getExpForLevel(l); return total; };
            const currentLevelThreshold = getTotalExpThreshold(profile.level);
            const nextLevelThreshold = getTotalExpThreshold(profile.level + 1);
            const expInLevel = (profile.experience || 0) - currentLevelThreshold;
            const expNeeded = nextLevelThreshold - currentLevelThreshold;
            const percentage = expNeeded > 0 ? Math.round((expInLevel / expNeeded) * 100) : 100;
            this.ui.headerStatXpFill.style.width = `${percentage}%`;
        },

        loadNotifications: async function() {
            if (!this.state.currentUser) { this.renderNotifications(0, []); return; }
            const { data, count, error } = await this.state.supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', this.state.currentUser.id).eq('is_read', false).order('created_at', { ascending: false }).limit(5);
            if(error) console.error("Error fetching notifications:", error);
            else this.renderNotifications(count || 0, data || []);
        },
        
        renderNotifications: function(count, notifications) {
            const sanitize = (str) => { const t = document.createElement('div'); t.textContent = str || ''; return t.innerHTML; };
            this.ui.notificationCount.textContent = count > 0 ? count : '';
            this.ui.notificationCount.style.display = count > 0 ? 'flex' : 'none';
            this.ui.markAllReadBtn.disabled = count === 0;
            if(notifications?.length > 0) {
                this.ui.notificationsList.innerHTML = notifications.map(n => {
                    const iconClass = n.type === 'level_up' ? 'fa-angle-double-up' : 'fa-coins';
                    const iconBg = n.type === 'level_up' ? 'var(--cn-accent-primary)' : 'var(--cn-accent-secondary)';
                    return `<div class="notification-item" data-id="${n.id}">
                                <div class="notification-icon" style="background:${iconBg};"><i class="fas ${iconClass}"></i></div>
                                <div class="notification-content">
                                    <div class="notification-title">${sanitize(n.title)}</div>
                                    <div class="notification-time">${new Date(n.created_at).toLocaleDateString('cs-CZ')}</div>
                                </div>
                            </div>`;
                }).join('');
            } else {
                this.ui.notificationsList.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--cn-text-muted);">Žádná nová oznámení.</div>`;
            }
        },

        markNotificationAsRead: async function(id) {
            if (!this.state.currentUser) return;
            await this.state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', this.state.currentUser.id).eq('id', id);
            this.loadNotifications();
        },

        markAllAsRead: async function() {
            if (!this.state.currentUser) return;
            this.ui.markAllReadBtn.disabled = true;
            await this.state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', this.state.currentUser.id).eq('is_read', false);
            this.loadNotifications();
        }
    };
    
    // Прикрепляем UIHelpers к глобальному объекту Justax
    global.Justax.UI = UIHelpers;

})(window);

// Глобальный supabase-client.js, который теперь является частью Justax
(function(global) {
    'use strict';
    if (!global.Justax) { global.Justax = {}; }

    global.Justax.initSupabase = function() {
        const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
        
        if (global.Justax.UI && global.Justax.UI.state && global.Justax.UI.state.supabase) {
            return global.Justax.UI.state.supabase;
        }
        
        try {
            const client = window.supabase.createClient(supabaseUrl, supabaseKey);
            if (global.Justax.UI && global.Justax.UI.state) {
                global.Justax.UI.state.supabase = client;
            }
            return client;
        } catch (error) {
            console.error('KRITICKÁ CHYBA INICIALIZACE SUPABASE:', error);
            return null;
        }
    };

})(window);