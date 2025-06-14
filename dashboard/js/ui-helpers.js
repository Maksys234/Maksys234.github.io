// dashboard/js/ui-helpers.js
// Глобальный модуль для управления общими элементами UI, такими как сайдбар.
// Версия: 1.0

(function(global) {
    'use strict';

    if (!global.Justax) {
        global.Justax = {};
    }

    const UIHelpers = {
        SIDEBAR_STATE_KEY: 'vyukaSidebarState', // Единый ключ для состояния сайдбара
        uiCache: {},

        /**
         * Кэширует основные элементы макета для многократного использования.
         */
        _cacheDOMElements: function() {
            this.uiCache = {
                sidebar: document.querySelector('.vyuka-sidebar-ai'),
                sidebarToggleBtn: document.querySelector('.sidebar-ai-desktop-toggle'),
                mobileMenuToggle: document.querySelector('.mobile-menu-toggle'),
                sidebarOverlay: document.querySelector('.sidebar-overlay-ai'),
                scrollableContent: document.querySelector('.vyuka-main-content-scrollable'),
                header: document.querySelector('.vyuka-header')
            };
            console.log('[UI Helpers] DOM elements cached.');
        },

        /**
         * Управляет сворачиванием/разворачиванием сайдбара на десктопе.
         */
        toggleSidebar: function() {
            if (!this.uiCache.sidebar) return;
            const shouldBeExpanded = !this.uiCache.sidebar.classList.contains('expanded');
            this.uiCache.sidebar.classList.toggle('expanded', shouldBeExpanded);
            localStorage.setItem(this.SIDEBAR_STATE_KEY, shouldBeExpanded ? 'expanded' : 'collapsed');
            
            const icon = this.uiCache.sidebarToggleBtn?.querySelector('i');
            if (icon) {
                icon.className = `fas fa-chevron-${shouldBeExpanded ? 'left' : 'right'}`;
            }
            if (this.uiCache.sidebarToggleBtn) {
                this.uiCache.sidebarToggleBtn.title = shouldBeExpanded ? 'Sbalit panel' : 'Rozbalit panel';
            }
            console.log(`[UI Helpers] Sidebar toggled. Expanded: ${shouldBeExpanded}`);
        },

        /**
         * Применяет сохранённое состояние сайдбара при загрузке страницы.
         */
        applyInitialSidebarState: function() {
            if (!this.uiCache.sidebar) return;
            const savedState = localStorage.getItem(this.SIDEBAR_STATE_KEY) || 'expanded';
            const shouldBeExpanded = savedState === 'expanded';
            this.uiCache.sidebar.classList.toggle('expanded', shouldBeExpanded);
            
            const icon = this.uiCache.sidebarToggleBtn?.querySelector('i');
            if (icon) {
                icon.className = `fas fa-chevron-${shouldBeExpanded ? 'left' : 'right'}`;
            }
            if (this.uiCache.sidebarToggleBtn) {
                this.uiCache.sidebarToggleBtn.title = shouldBeExpanded ? 'Sbalit panel' : 'Rozbalit panel';
            }
            console.log(`[UI Helpers] Initial sidebar state applied: ${savedState}`);
        },

        /**
         * Открывает мобильное меню.
         */
        openMobileMenu: function() {
            if (this.uiCache.sidebar && this.uiCache.sidebarOverlay) {
                this.uiCache.sidebar.classList.add('active-mobile', 'expanded');
                this.uiCache.sidebarOverlay.classList.add('active');
            }
        },

        /**
         * Закрывает мобильное меню.
         */
        closeMobileMenu: function() {
            if (this.uiCache.sidebar && this.uiCache.sidebarOverlay) {
                this.uiCache.sidebar.classList.remove('active-mobile');
                this.uiCache.sidebarOverlay.classList.remove('active');
            }
        },

        /**
         * Инициализирует отслеживание прокрутки для стилизации хедера.
         */
        initHeaderScrollDetection: function() {
            if (!this.uiCache.scrollableContent || !this.uiCache.header) return;
            this.uiCache.scrollableContent.addEventListener('scroll', () => {
                document.body.classList.toggle('scrolled', this.uiCache.scrollableContent.scrollTop > 20);
            }, { passive: true });
        },

        /**
         * Устанавливает все слушатели событий для общих элементов UI.
         */
        init: function() {
            this._cacheDOMElements();
            this.applyInitialSidebarState();
            this.initHeaderScrollDetection();

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