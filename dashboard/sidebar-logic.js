// dashboard/sidebar-logic.js
// Logika pro boční panel (rozbalování, sbalování, mobilní menu)
// Verze: 1.0

(function() {
    'use strict';

    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState'; // Klíč pro localStorage

    const ui = {
        sidebar: null,
        sidebarOverlay: null,
        mainMobileMenuToggle: null, // Tlačítko pro otevření menu na mobilu (v headeru)
        sidebarCloseToggle: null,   // Tlačítko 'X' pro zavření menu na mobilu (v sidebar)
        sidebarToggleBtn: null,     // Tlačítko pro sbalení/rozbalení na desktopu (v headeru)
        sidebarLinks: []
    };

    function cacheSidebarElements() {
        ui.sidebar = document.getElementById('sidebar');
        ui.sidebarOverlay = document.getElementById('sidebar-overlay');
        ui.mainMobileMenuToggle = document.getElementById('main-mobile-menu-toggle');
        ui.sidebarCloseToggle = document.getElementById('sidebar-close-toggle');
        ui.sidebarToggleBtn = document.getElementById('sidebar-toggle-btn'); // Desktop toggle
        ui.sidebarLinks = document.querySelectorAll('.sidebar-link');

        // Základní kontrola, zda byly elementy nalezeny
        if (!ui.sidebar || !ui.sidebarOverlay) {
            console.warn('[SidebarLogic] Chybí základní elementy sidebaru (sidebar nebo sidebarOverlay). Funkčnost může být omezena.');
        }
        if (!ui.mainMobileMenuToggle && !ui.sidebarToggleBtn) {
             console.warn('[SidebarLogic] Chybí tlačítka pro ovládání sidebaru (mobilní nebo desktopové).');
        }
    }

    function openMobileMenu() {
        if (ui.sidebar && ui.sidebarOverlay) {
            // Zajistíme, že není sbalený, když se otevírá mobilní menu
            document.body.classList.remove('sidebar-collapsed');
            ui.sidebar.classList.add('active'); // Třída pro zobrazení na mobilu
            ui.sidebarOverlay.classList.add('active');
            console.log('[SidebarLogic] Mobilní menu otevřeno.');
        }
    }

    function closeMobileMenu() {
        if (ui.sidebar && ui.sidebarOverlay) {
            ui.sidebar.classList.remove('active');
            ui.sidebarOverlay.classList.remove('active');
            console.log('[SidebarLogic] Mobilní menu zavřeno.');
        }
    }

    function toggleDesktopSidebar() {
        if (!ui.sidebarToggleBtn || !document.body.classList.contains('sidebar-collapsed-supported')) {
            // Pokud tlačítko neexistuje nebo body nemá třídu signalizující podporu sbalení
            // (přidáme třídu 'sidebar-collapsed-supported' na body v HTML, kde chceme tuto funkci)
            // console.warn('[SidebarLogic] Desktop sidebar toggle není podporováno nebo není k dispozici.');
            return;
        }
        try {
            const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded');
            const icon = ui.sidebarToggleBtn.querySelector('i');
            if (icon) {
                icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
            }
            ui.sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel');
            ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel';
            console.log(`[SidebarLogic] Desktop sidebar přepnut. Nový stav: ${isCollapsed ? 'sbalený' : 'rozbalený'}`);
        } catch (error) {
            console.error("[SidebarLogic] Chyba při přepínání desktopového sidebaru:", error);
        }
    }

    function applyInitialDesktopSidebarState() {
        if (!document.body.classList.contains('sidebar-collapsed-supported')) {
             // Pokud stránka nepodporuje sbalený sidebar, vždy ho necháme rozbalený
             document.body.classList.remove('sidebar-collapsed');
             if (ui.sidebarToggleBtn) {
                 const icon = ui.sidebarToggleBtn.querySelector('i');
                 if (icon) icon.className = 'fas fa-chevron-left';
                 ui.sidebarToggleBtn.setAttribute('aria-label', 'Sbalit postranní panel');
                 ui.sidebarToggleBtn.title = 'Sbalit panel';
             }
             console.log('[SidebarLogic] Stránka nepodporuje sbalený sidebar, nastaveno na rozbalený.');
             return;
        }

        try {
            const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);
            const shouldBeCollapsed = savedState === 'collapsed';

            document.body.classList.toggle('sidebar-collapsed', shouldBeCollapsed);

            if (ui.sidebarToggleBtn) {
                const icon = ui.sidebarToggleBtn.querySelector('i');
                if (icon) {
                    icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
                }
                ui.sidebarToggleBtn.setAttribute('aria-label', shouldBeCollapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel');
                ui.sidebarToggleBtn.title = shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel';
            }
            console.log(`[SidebarLogic] Počáteční stav desktopového sidebaru aplikován: ${shouldBeCollapsed ? 'sbalený' : 'rozbalený'}`);
        } catch (error) {
            console.error("[SidebarLogic] Chyba při aplikaci počátečního stavu desktopového sidebaru:", error);
            document.body.classList.remove('sidebar-collapsed'); // Výchozí stav při chybě
        }
    }

    function setupSidebarEventListeners() {
        if (ui.mainMobileMenuToggle) {
            ui.mainMobileMenuToggle.addEventListener('click', openMobileMenu);
        }
        if (ui.sidebarCloseToggle) {
            ui.sidebarCloseToggle.addEventListener('click', closeMobileMenu);
        }
        if (ui.sidebarOverlay) {
            ui.sidebarOverlay.addEventListener('click', closeMobileMenu);
        }
        if (ui.sidebarToggleBtn && document.body.classList.contains('sidebar-collapsed-supported')) {
            ui.sidebarToggleBtn.addEventListener('click', toggleDesktopSidebar);
        }

        ui.sidebarLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 992 && ui.sidebar && ui.sidebar.classList.contains('active')) {
                    closeMobileMenu();
                }
            });
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 992 && ui.sidebar && ui.sidebar.classList.contains('active')) {
                closeMobileMenu(); // Zavřít mobilní menu, pokud se okno zvětší nad mobilní breakpoint
            }
        });
        console.log('[SidebarLogic] Posluchače událostí pro sidebar nastaveny.');
    }

    function init() {
        console.log('[SidebarLogic] Inicializace modulu...');
        cacheSidebarElements();
        if (document.body.classList.contains('sidebar-collapsed-supported')) {
            applyInitialDesktopSidebarState();
        } else {
            // Zajistíme, že pokud stránka nepodporuje sbalený sidebar, je vždy rozbalený
            document.body.classList.remove('sidebar-collapsed');
        }
        setupSidebarEventListeners();
        console.log('[SidebarLogic] Modul inicializován.');
    }

    // Spustit po načtení DOMu
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init(); // DOM již načten
    }

})();