// dashboard/js/ui-helpers.js
// Глобальный модуль для управления общими элементами UI.
// Версия: 1.1 - Исправлена логика выпадающего меню пользователя.

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
                // Новые элементы для меню пользователя
                userMenuContainer: document.querySelector('.user-menu-container'),
                userDropdownMenu: document.querySelector('.user-dropdown-menu'),
            };
            console.log('[UI Helpers] DOM elements cached.');
        },

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

        // --- НОВАЯ УЛУЧШЕННАЯ ЛОГИКА ДЛЯ МЕНЮ ---
        initUserDropdown: function() {
            const container = this.uiCache.userMenuContainer;
            const menu = this.uiCache.userDropdownMenu;

            if (!container || !menu) return;

            let menuTimeout;
            
            const openMenu = () => {
                clearTimeout(menuTimeout);
                menu.classList.add('active');
            };

            const closeMenu = (delay = 200) => {
                menuTimeout = setTimeout(() => {
                    menu.classList.remove('active');
                }, delay);
            };

            container.addEventListener('mouseenter', openMenu);
            container.addEventListener('mouseleave', () => closeMenu());
            
            // Для доступности с клавиатуры
            container.addEventListener('focusin', openMenu);
            container.addEventListener('focusout', (e) => {
                // Если фокус перешел на элемент вне контейнера, закрываем
                if (!container.contains(e.relatedTarget)) {
                    closeMenu(50);
                }
            });

            // Для мобильных устройств (клик)
            container.querySelector('.vyuka-header-user-display').addEventListener('click', (e) => {
                // Предотвращаем закрытие меню, если оно уже открыто через hover
                e.stopPropagation(); 
                menu.classList.toggle('active');
            });
            
            // Закрытие при клике вне меню
            document.addEventListener('click', (event) => {
                if (menu.classList.contains('active') && !container.contains(event.target)) {
                    menu.classList.remove('active');
                }
            });
        },

        init: function() {
            this._cacheDOMElements();
            this.applyInitialSidebarState();
            this.initHeaderScrollDetection();
            this.initUserDropdown(); // Инициализируем новую логику меню

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