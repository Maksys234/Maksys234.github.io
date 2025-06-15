// dashboard/js/ui-helpers.js
// Глобальный модуль для управления общими элементами UI.
// Версия: 2.0 - Добавлены функции для модальных окон и уведомлений. Улучшено меню.

(function(global) {
    'use strict';

    if (!global.Justax) {
        global.Justax = {};
    }

    const UIHelpers = {
        SIDEBAR_STATE_KEY: 'vyukaSidebarState',
        uiCache: {},

        _cacheDOMElements: function() {
            this.uiCache = {
                sidebar: document.querySelector('.vyuka-sidebar-ai'),
                sidebarToggleBtn: document.querySelector('.sidebar-ai-desktop-toggle'),
                mobileMenuToggle: document.querySelector('.mobile-menu-toggle'),
                sidebarOverlay: document.querySelector('.sidebar-overlay-ai'),
                scrollableContent: document.querySelector('.vyuka-main-content-scrollable'),
                header: document.querySelector('.vyuka-header'),
                userMenuContainer: document.querySelector('.user-menu-container'),
                userDropdownMenu: document.querySelector('.user-dropdown-menu'),
                // --- НОВОЕ: Элементы для новых компонентов ---
                toastContainer: document.getElementById('toast-container'),
            };
            console.log('[UI Helpers] DOM elements cached.');
        },

        // --- УЛУЧШЕНИЕ: Новые функции для интерактивности ---

        showToast: function(message, type = 'info', duration = 4000) {
            if (!this.uiCache.toastContainer) return;
            const toast = document.createElement('div');
            toast.className = `toast-notification ${type}`;
            let iconClass = 'fa-info-circle';
            if (type === 'success') iconClass = 'fa-check-circle';
            if (type === 'error') iconClass = 'fa-exclamation-triangle';
            if (type === 'warning') iconClass = 'fa-exclamation-circle';
            
            toast.innerHTML = `<i class="fas ${iconClass}"></i><p>${message}</p>`;
            this.uiCache.toastContainer.appendChild(toast);
            
            toast.style.animation = 'toast-in 0.5s forwards';
            setTimeout(() => {
                toast.style.animation = 'toast-out 0.5s forwards';
                setTimeout(() => toast.remove(), 500);
            }, duration);
        },

        showModal: function(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) modal.classList.add('active');
        },

        hideModal: function(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) modal.classList.remove('active');
        },

        // --- Существующие функции (обновленные) ---

        toggleSidebar: function() {
            if (!this.uiCache.sidebar) return;
            const shouldBeExpanded = !this.uiCache.sidebar.classList.contains('expanded');
            this.uiCache.sidebar.classList.toggle('expanded', shouldBeExpanded);
            localStorage.setItem(this.SIDEBAR_STATE_KEY, shouldBeExpanded ? 'expanded' : 'collapsed');
            const icon = this.uiCache.sidebarToggleBtn?.querySelector('i');
            if (icon) icon.className = `fas fa-chevron-${shouldBeExpanded ? 'left' : 'right'}`;
        },

        applyInitialSidebarState: function() {
            if (!this.uiCache.sidebar) return;
            const savedState = localStorage.getItem(this.SIDEBAR_STATE_KEY) || 'expanded';
            const shouldBeExpanded = savedState === 'expanded';
            this.uiCache.sidebar.classList.toggle('expanded', shouldBeExpanded);
            const icon = this.uiCache.sidebarToggleBtn?.querySelector('i');
            if (icon) icon.className = `fas fa-chevron-${shouldBeExpanded ? 'left' : 'right'}`;
        },

        openMobileMenu: function() {
            if (this.uiCache.sidebar && this.uiCache.sidebarOverlay) {
                this.uiCache.sidebar.classList.add('active-mobile', 'expanded');
                this.uiCache.sidebarOverlay.classList.add('active');
            }
        },

        closeMobileMenu: function() {
            if (this.uiCache.sidebar && this.uiCache.sidebarOverlay) {
                this.uiCache.sidebar.classList.remove('active-mobile');
                this.uiCache.sidebarOverlay.classList.remove('active');
            }
        },

        initHeaderScrollDetection: function() {
            if (!this.uiCache.scrollableContent || !this.uiCache.header) return;
            this.uiCache.scrollableContent.addEventListener('scroll', () => {
                document.body.classList.toggle('scrolled', this.uiCache.scrollableContent.scrollTop > 20);
            }, { passive: true });
        },

        initUserDropdown: function() {
            const container = this.uiCache.userMenuContainer;
            if (!container) return;

            // Логика для hover/focus уже будет работать через CSS.
            // Этот JS нужен для клика на мобильных устройствах.
            container.querySelector('.vyuka-header-user-display')?.addEventListener('click', (e) => {
                e.stopPropagation(); 
                this.uiCache.userDropdownMenu?.classList.toggle('active');
            });
            
            // Закрытие при клике вне меню
            document.addEventListener('click', () => {
                this.uiCache.userDropdownMenu?.classList.remove('active');
            });
        },

        init: function() {
            this._cacheDOMElements();
            this.applyInitialSidebarState();
            this.initHeaderScrollDetection();
            this.initUserDropdown();

            if (this.uiCache.sidebarToggleBtn) {
                this.uiCache.sidebarToggleBtn.addEventListener('click', () => this.toggleSidebar());
            }
            if (this.uiCache.mobileMenuToggle) {
                this.uiCache.mobileMenuToggle.addEventListener('click', () => this.openMobileMenu());
            }
            if (this.uiCache.sidebarOverlay) {
                this.uiCache.sidebarOverlay.addEventListener('click', () => this.closeMobileMenu());
            }
            console.log('[UI Helpers] All event listeners initialized.');
        }
    };

    global.Justax.UI = UIHelpers;

})(window);