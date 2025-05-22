// dashboard/sidebar-logic.js
// Logika pro boční panel (rozbalování, sbalování, mobilní menu)
// Verze: 1.1 - Přidán event.preventDefault() pro desktop toggle

(function() {
    'use strict';

    const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';

    const ui = {
        sidebar: null,
        sidebarOverlay: null,
        mainMobileMenuToggle: null,
        sidebarCloseToggle: null,
        sidebarToggleBtn: null, // Desktop toggle
        sidebarLinks: []
    };

    function cacheSidebarElements() {
        ui.sidebar = document.getElementById('sidebar');
        ui.sidebarOverlay = document.getElementById('sidebar-overlay');
        ui.mainMobileMenuToggle = document.getElementById('main-mobile-menu-toggle');
        ui.sidebarCloseToggle = document.getElementById('sidebar-close-toggle');
        ui.sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
        ui.sidebarLinks = document.querySelectorAll('.sidebar-link');

        if (!ui.sidebar || !ui.sidebarOverlay) {
            console.warn('[SidebarLogic] Chybí základní elementy sidebaru (sidebar nebo sidebarOverlay).');
        }
    }

    function openMobileMenu() {
        if (ui.sidebar && ui.sidebarOverlay) {
            document.body.classList.remove('sidebar-collapsed'); // Pro jistotu
            ui.sidebar.classList.add('active');
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

    function toggleDesktopSidebar(event) { // Přidán 'event'
        if (event) { // Ochrana, pokud by bylo voláno bez události
            event.preventDefault(); // ZABRÁNÍ VÝCHOZÍ AKCI (např. navigaci, pokud je tlačítko v odkazu)
        }

        if (!ui.sidebarToggleBtn || !document.body.classList.contains('sidebar-collapsed-supported')) {
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
            document.body.classList.remove('sidebar-collapsed');
        }
    }

    function setupSidebarEventListeners() {
        if (ui.mainMobileMenuToggle) {
            ui.mainMobileMenuToggle.addEventListener('click', openMobileMenu);
        } else { console.warn("[SidebarLogic] Tlačítko 'mainMobileMenuToggle' nenalezeno."); }

        if (ui.sidebarCloseToggle) {
            ui.sidebarCloseToggle.addEventListener('click', closeMobileMenu);
        } else { console.warn("[SidebarLogic] Tlačítko 'sidebarCloseToggle' nenalezeno."); }

        if (ui.sidebarOverlay) {
            ui.sidebarOverlay.addEventListener('click', closeMobileMenu);
        } else { console.warn("[SidebarLogic] Element 'sidebarOverlay' nenalezen."); }

        if (ui.sidebarToggleBtn) { // Desktop toggle button
            if (document.body.classList.contains('sidebar-collapsed-supported')) {
                ui.sidebarToggleBtn.addEventListener('click', toggleDesktopSidebar);
            } else {
                // Pokud stránka nemá podporu pro sbalený sidebar, můžeme tlačítko skrýt nebo ho nechat neaktivní
                 ui.sidebarToggleBtn.style.display = 'none'; // Například skryjeme
                 console.log("[SidebarLogic] Desktop toggle button skryto, protože stránka nepodporuje sbalený sidebar.");
            }
        } else { console.warn("[SidebarLogic] Tlačítko 'sidebarToggleBtn' nenalezeno."); }


        ui.sidebarLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 992 && ui.sidebar && ui.sidebar.classList.contains('active')) {
                    closeMobileMenu();
                }
            });
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 992 && ui.sidebar && ui.sidebar.classList.contains('active')) {
                closeMobileMenu();
            }
             // Znovu aplikujeme stav pro desktop, pokud se mění velikost okna a je podporováno
             if (document.body.classList.contains('sidebar-collapsed-supported')) {
                applyInitialDesktopSidebarState(); // Zajistí správné zobrazení ikony a třídy na body
            }
        });
        console.log('[SidebarLogic] Posluchače událostí pro sidebar nastaveny.');
    }

    function init() {
        console.log('[SidebarLogic] Inicializace modulu...');
        cacheSidebarElements(); // Cachujeme elementy hned na začátku
        if (document.body.classList.contains('sidebar-collapsed-supported')) {
            applyInitialDesktopSidebarState();
        } else {
            document.body.classList.remove('sidebar-collapsed');
        }
        setupSidebarEventListeners();
        console.log('[SidebarLogic] Modul inicializován.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();