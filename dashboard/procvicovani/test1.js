// Файл: test1.js
// Управляет пользовательским интерфейсом, обработкой событий и оркестрацией теста,
// используя логику из test1-logic.js (доступную через window.TestLogic).
// Версия v12.1: Исправлена синтаксическая ошибка 'Unexpected token )' в initializeTest.
// Обновлено для поддержки answer_prefix, answer_suffix и многочастных ответов при оценке.
// Версия v12.2 (интеграция с main.js): Добавлена функциональность боковой панели и загрузка заголовка пользователя.
// Версия v12.3: Opraveno ID tlačítka pro označení všech oznámení jako přečtených.
// VERZE 12.4: Přidán placeholder pro tlačítko "Přehodnotit", úpravy v displayReview, sjednocení ID.
// VERZE 12.6: Zpřísnění logiky pro jednorázové spuštění diagnostického testu 'exam_prep' a explicitní logování cíle.
// VERZE 12.7 (UŽIVATELSKÉ POŽADAVKY): Automatické spouštění testu, kontrola dokončení, zobrazení titulu, formát skóre u přeskočených.
// VERZE 12.8 (UŽIVATELSKÉ POŽADAVKY): Rozšíření o 4 typy testů, dva zatím neaktivní.
// VERZE 12.9 (OPRAVY A VYLEPŠENÍ): Oprava zobrazení titulu, logika pro zvýraznění doporučeného testu.
// VERZE 12.10 (MANDATORY TEST): Test je nyní povinný na základě cíle uživatele. Ostatní testy jsou neaktivní.
// VERZE 12.11 (FIX INACTIVE TEST DISPLAY): Opraveno zobrazení UI pro neaktivní povinné testy.
// VERZE 12.12 (NO AUTO-START): Uživatel musí vždy manuálně spustit povinný test z obrazovky výběru.
// VERZE 12.13 (ERROR HANDLING): Přidáno ošetření pro případ nedostatku otázek.
// VERZE 12.14 (NO QUESTIONS UI): Zobrazí testové rozhraní se zprávou, pokud nejsou žádné otázky.
// VERZE K ÚPRAVĚ (pro spuštění math_accelerate a math_explore):

// Используем IIFE для изоляции области видимости
(function() {
    'use strict';

    // --- START: Инициализация и Конфигурация ---
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let questions = [];
    let currentQuestionIndex = 0;
    let userAnswers = [];
    let timer = null;
    let testTime = 0;
    let testStartTime = null;
    let testEndTime = null;
    let testResultsData = null;
    let diagnosticId = null;
    let selectedTestType = null;
    let isLoading = { page: true, test: false, results: false, notifications: false, titles: false, reevaluation: {} };
    let allTitles = [];
		const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';


    const testTypeConfig = {
        full: {
            questionsCount: 30, // Cca, bude bráno z DB nebo z logiky
            title: 'Příprava na Přijímačky',
            description: 'Podrobné hodnocení <strong>všech oblastí přijímaček</strong>, podobné reálnému testu. Poskytuje solidní základ pro studijní plán.',
            multiplier: 1.5, // Vyšší váha pro komplexní test
            isCoreDiagnostic: true, // Klíčový pro počáteční diagnostiku
            identifier: 'exam_prep_full', // Unikátní identifikátor pro tento typ testu
            recommendedForGoal: 'exam_prep',
            isActive: true // Tento test je vždy aktivní
        },
        math_review: {
            questionsCount: 30, // Cca
            title: 'Opakování Matematiky',
            description: 'Test zaměřený na <strong>doplnění mezer v základních tématech</strong> a upevnění znalostí z matematiky ZŠ.',
            multiplier: 1.0,
            isCoreDiagnostic: true, // Může být použit jako doplňková diagnostika
            identifier: 'math_review_standard',
            recommendedForGoal: 'math_review',
            isActive: true // Tento test je aktivní
        },
        math_accelerate: {
            questionsCount: 30, // Cca
            title: 'Učení Napřed',
            description: 'Otestujte své znalosti v <strong>pokročilejších tématech</strong> a připravte se na budoucí výzvy.',
            multiplier: 1.2,
            isCoreDiagnostic: false,
            isActive: true, // ZMĚNA: Nastaveno na true
            identifier: 'math_accelerate_preview',
            recommendedForGoal: 'math_accelerate'
        },
        math_explore: {
            questionsCount: 30, // Cca
            title: 'Volné Prozkoumávání',
            description: 'Test zaměřený na <strong>různorodá témata dle vašeho výběru</strong> pro rozšíření obzorů.',
            multiplier: 1.0,
            isCoreDiagnostic: false,
            isActive: true, // ZMĚNA: Nastaveno na true
            identifier: 'math_explore_sampler',
            recommendedForGoal: 'math_explore'
        }
    };


    const topicIcons = { "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon", "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar", "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar", "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book" };
    const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

    const ui = {
        sidebarAvatar: document.getElementById('sidebar-avatar'),
        sidebarName: document.getElementById('sidebar-name'),
        sidebarUserTitle: document.getElementById('sidebar-user-title'),
        initialLoader: document.getElementById('initial-loader'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        geminiOverlay: document.getElementById('gemini-checking-overlay'),
        mainContent: document.getElementById('main-content'),
        sidebar: document.getElementById('sidebar'),
        mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
        sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
        sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
        dashboardHeader: document.querySelector('.dashboard-header'),
        testSubject: document.getElementById('test-subject'),
        testLevel: document.getElementById('test-level'),
        testTimer: document.getElementById('test-timer'),
        timerValue: document.getElementById('timer-value'),
        notificationBell: document.getElementById('notification-bell'),
        notificationCount: document.getElementById('notification-count'),
        notificationsDropdown: document.getElementById('notifications-dropdown'),
        notificationsList: document.getElementById('notifications-list'),
        noNotificationsMsg: document.getElementById('no-notifications-msg'),
        markAllReadBtn: document.getElementById('mark-all-read-btn'), // Správné ID
        testSelector: document.getElementById('test-selector'),
        testLoader: document.getElementById('test-loader'),
        loaderSubtext: document.getElementById('loader-subtext'),
        testContainer: document.getElementById('test-container'),
        resultsContainer: document.getElementById('results-container'),
        reviewContainer: document.getElementById('review-container'),
        currentTestTitle: document.getElementById('current-test-title'),
        questionCountEl: document.getElementById('question-count'),
        answeredCountEl: document.getElementById('answered-count'),
        progressBar: document.getElementById('progress-bar'),
        questionContainer: document.getElementById('question-container'),
        pagination: document.getElementById('pagination'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        finishBtn: document.getElementById('finish-btn'),
        resultScoreEl: document.getElementById('result-score'),
        resultPercentageEl: document.getElementById('result-percentage'),
        resultCorrectEl: document.getElementById('result-correct'),
        resultIncorrectEl: document.getElementById('result-incorrect'),
        resultTimeEl: document.getElementById('result-time'),
        topicResultsEl: document.getElementById('topic-results'),
        retryBtn: document.getElementById('retry-btn'),
        reviewAnswersBtn: document.getElementById('review-answers-btn'),
        continueBtn: document.getElementById('continue-btn'),
        lowScoreMessageContainer: document.getElementById('low-score-message-container'),
        reviewContent: document.getElementById('review-content'),
        backToResultsBtn: document.getElementById('back-to-results-btn'),
        testTypeCards: document.querySelectorAll('.test-type-card'),
        startSelectedTestBtnGlobal: document.getElementById('start-selected-test-btn'),
        toastContainer: document.getElementById('toast-container'),
        globalError: document.getElementById('global-error'),
        offlineBanner: document.getElementById('offline-banner'),
        mouseFollower: document.getElementById('mouse-follower'),
        currentYearSidebar: document.getElementById('currentYearSidebar'),
        currentYearFooter: document.getElementById('currentYearFooter'),
        reviewItemTemplate: document.getElementById('review-item-template')
    };
    // --- END: Инициализация и Конфигурация ---

    // --- START: Helper Functions (UI specific or wrappers) ---
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function getInitials(profileData) {
        if (!profileData) return '?';
        const f = profileData.first_name?.[0] || '';
        const l = profileData.last_name?.[0] || '';
        const nameInitial = (f + l).toUpperCase();
        const usernameInitial = profileData.username?.[0].toUpperCase() || '';
        const emailInitial = profileData.email?.[0].toUpperCase() || '';
        return nameInitial || usernameInitial || emailInitial || '?';
    }
    function formatDate(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) return '-'; return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return '-'; } }
    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return '--:--'; const m = Math.floor(seconds / 60); const s = Math.round(seconds % 60); return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { document.body.classList.remove('sidebar-collapsed'); ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }

    function updateUserInfoUI() {
        if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) {
            console.warn("[UI Sidebar] Sidebar profile elements missing for full update.");
            return;
        }
        if (currentUser && currentProfile) {
            const displayName = `${currentProfile.first_name || ''} ${currentProfile.last_name || ''}`.trim() || currentProfile.username || currentUser.email?.split('@')[0] || 'Pilot';
            ui.sidebarName.textContent = sanitizeHTML(displayName);
            const initials = getInitials(currentProfile);
            let avatarUrl = currentProfile.avatar_url;

            if (avatarUrl && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))) {
                 avatarUrl += `?t=${new Date().getTime()}`;
            }

            ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);

            const img = ui.sidebarAvatar.querySelector('img');
            if (img) {
                img.onerror = function() {
                    console.warn(`[UI Sidebar] Failed to load avatar: ${this.src}. Showing initials.`);
                    ui.sidebarAvatar.innerHTML = sanitizeHTML(initials);
                };
            }

            const selectedTitleKey = currentProfile.selected_title;
            let displayTitle = 'Pilot';

            if (selectedTitleKey && allTitles && allTitles.length > 0) {
                const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey);
                if (foundTitle && foundTitle.name) {
                    displayTitle = foundTitle.name;
                } else {
                    console.warn(`[UI Sidebar] Title key "${selectedTitleKey}" not found in fetched titles.`);
                }
            } else if (selectedTitleKey) {
                 console.warn(`[UI Sidebar] Title key present but allTitles array is empty or not loaded.`);
            }
            ui.sidebarUserTitle.textContent = sanitizeHTML(displayTitle);
            ui.sidebarUserTitle.setAttribute('title', sanitizeHTML(displayTitle));

        } else {
            ui.sidebarName.textContent = 'Nepřihlášen';
            ui.sidebarAvatar.textContent = '?';
            ui.sidebarUserTitle.textContent = 'Pilot';
            ui.sidebarUserTitle.removeAttribute('title');
        }
    }

    function handleScroll() { if (!ui.mainContent || !ui.dashboardHeader) return; document.body.classList.toggle('scrolled', ui.mainContent.scrollTop > 10); }
    function indexToLetter(index){ return String.fromCharCode(65 + index); }
    function showGeminiOverlay(show){ if(ui.geminiOverlay) ui.geminiOverlay.style.display = show ? 'flex' : 'none'; }
    function showErrorMessagePage(message, showRetryButton = true){
        console.error("Error Page:", message);
        if (ui.testSelector) ui.testSelector.style.display = 'none';
        if (ui.testContainer) ui.testContainer.style.display = 'none';
        if (ui.resultsContainer) ui.resultsContainer.style.display = 'none';
        if (ui.reviewContainer) ui.reviewContainer.style.display = 'none';
        if (ui.geminiOverlay) ui.geminiOverlay.style.display = 'none';

        const retryButtonHTML = showRetryButton ? `<button class="btn btn-primary" style="margin-top:1.5rem;" onclick="location.reload()"><i class="fas fa-redo"></i> Zkusit znovu</button>` : '';

        if (ui.globalError) {
             ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div>${retryButtonHTML}</div>`;
             ui.globalError.style.display = 'block';
        } else if (ui.mainContent) {
            ui.mainContent.innerHTML = `<div class="section error-message-container" style="margin-top: 2rem; text-align:center;"><i class="fas fa-exclamation-triangle" style="font-size: 2.5rem; color: var(--accent-pink); margin-bottom: 1rem;"></i><div class="loader-text" style="font-size: 1.5rem; color: var(--accent-pink);">${message.includes("Test již byl dokončen") || message.includes("Nejsou k dispozici žádné vhodné otázky") || message.includes("Otázky pro tento test budou brzy doplněny") ? "Informace" : "Chyba!"}</div><div class="loader-subtext" style="font-size: 1rem;">${sanitizeHTML(message)}</div>${retryButtonHTML}</div>`;
            ui.mainContent.style.display = 'block';
        } else {
            document.body.innerHTML = `<div style='padding: 2rem; color: red; text-align:center;'><h1>${message.includes("Test již byl dokončen") || message.includes("Nejsou k dispozici žádné vhodné otázky") || message.includes("Otázky pro tento test budou brzy doplněny") ? "Informace" : "Chyba"}</h1><p>${sanitizeHTML(message)}</p>${retryButtonHTML}</div>`;
        }
        if (ui.initialLoader && ui.initialLoader.style.display !== 'none') {
            ui.initialLoader.classList.add('hidden');
            setTimeout(() => { if(ui.initialLoader) ui.initialLoader.style.display = 'none';}, 300);
        }
    }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    const initTooltips = () => { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Chyba inicializace Tooltipster:", e); } };
    const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; };
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) { console.log("Scroll animations not initialized."); return; } const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
    const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); };
    function updateOnlineStatus() { if (ui.offlineBanner) { ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; } if (!navigator.onLine) { showToast('Offline', 'Spojení bylo ztraceno. Některé funkce nemusí být dostupné.', 'warning'); } }
    function setLoadingState(section, isLoadingFlag) {
        if (isLoading[section] === isLoadingFlag && section !== 'all') return;
        if (section === 'all') { Object.keys(isLoading).forEach(key => { if(key !== 'reevaluation') isLoading[key] = isLoadingFlag; }); }
        else { isLoading[section] = isLoadingFlag; }

        console.log(`[SetLoading] Section: ${section}, isLoading: ${isLoadingFlag}`);

        if (section === 'test') {
            if (ui.testLoader) ui.testLoader.style.display = isLoadingFlag ? 'flex' : 'none';
        } else if (section === 'results') {
            /* Placeholder for results loading UI, if any */
        } else if (section === 'notifications') {
            if(ui.notificationBell) ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
            if (ui.markAllReadBtn) {
                const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
                ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0;
            }
        } else if (section.startsWith('reevaluation_')) {
            const questionIndex = parseInt(section.split('_')[1], 10);
            const reevalButton = document.querySelector(`.review-question-item[data-question-index="${questionIndex}"] .reevaluate-answer-btn`);
            if (reevalButton) {
                reevalButton.disabled = isLoadingFlag;
                const icon = reevalButton.querySelector('i');
                if (isLoadingFlag) {
                    if(icon) icon.className = 'fas fa-spinner fa-spin';
                    reevalButton.innerHTML = (icon ? icon.outerHTML : '') + ' Přehodnocuji...';
                } else {
                    if(icon) icon.className = 'fas fa-robot';
                     reevalButton.innerHTML = (icon ? icon.outerHTML : '') + ' Přehodnotit odpověď';
                }
            }
        }
    }

		function applyInitialSidebarState() {
			try {
					const state = localStorage.getItem(SIDEBAR_STATE_KEY);
					const isCurrentlyCollapsed = document.body.classList.contains('sidebar-collapsed');
					const shouldBeCollapsed = state === 'collapsed';

					if (shouldBeCollapsed !== isCurrentlyCollapsed) {
							document.body.classList.toggle('sidebar-collapsed', shouldBeCollapsed);
					}

					const icon = ui.sidebarToggleBtn?.querySelector('i');
					if (icon) {
							icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
					}
					if(ui.sidebarToggleBtn) {
							ui.sidebarToggleBtn.title = shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel';
					}
			} catch (e) {
					console.error("Chyba při aplikaci stavu postranního panelu:", e);
			}
		}

		function toggleSidebar() {
				try {
						const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
						localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded');
						const icon = ui.sidebarToggleBtn?.querySelector('i');
						if (icon) {
								icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
						}
						if(ui.sidebarToggleBtn) {
								ui.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel';
						}
				} catch (error) {
						console.error("[ToggleSidebar] Chyba:", error);
				}
		}
    // --- END: Helper Functions ---

    // --- START: Data Fetching Wrappers (using TestLogic) ---
    async function fetchUserProfile(userId) {
        if (!supabase || !userId) return null;
        console.log(`[Profile] Fetching profile for user ID: ${userId}`);
        setLoadingState('titles', true);
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*, selected_title, preferences, longest_streak_days') // Přidáno preferences a longest_streak_days
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (!profile) {
                console.warn(`[Profile] Profile not found for user ${userId}.`);
                return null;
            }
            if (!profile.preferences) profile.preferences = {}; // Pojistka pro případ, že by preferences byly null
            console.log("[Profile] Profile data fetched successfully:", profile);
            return profile;
        } catch (error) {
            console.error('[Profile] Exception fetching profile:', error);
            showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error');
            return null;
        } finally {
            setLoadingState('titles', false);
        }
    }

		async function fetchTitles() {
        if (!supabase) return [];
        console.log("[Titles] Fetching available titles...");
        // setLoadingState('titles', true); // Již se volá ve fetchUserProfile, pokud je potřeba
        try {
            const { data, error } = await supabase
                .from('title_shop')
                .select('title_key, name');

            if (error) {
                console.error("[Titles] Error from Supabase:", error);
                throw error;
            }
            console.log("[Titles] Fetched titles:", data);
            // setLoadingState('titles', false);
            return data || [];
        } catch (error) {
            console.error("[Titles] Catch block error fetching titles:", error.message);
            showToast("Chyba", "Nepodařilo se načíst dostupné tituly.", "error");
            // setLoadingState('titles', false);
            return [];
        }
    }

    async function checkSpecificTestCompleted(userId, testIdentifier) {
        setLoadingState('test', true);
        if (ui.loaderSubtext) ui.loaderSubtext.textContent = 'Kontroluji předchozí testy...';
        try {
            if (!userId || !supabase) {
                console.warn("[checkSpecificTestCompleted] Chybí ID uživatele nebo Supabase klient.");
                return false;
            }
            console.log(`[checkSpecificTestCompleted] Hledám test pro user: ${userId} s potenciálním identifikátorem (nebo obecně pro cíl): ${testIdentifier}`);

            // Dotaz na tabulku 'user_diagnostics'
            const { data: existingTests, error } = await supabase
                .from('user_diagnostics') // Název vaší tabulky s výsledky diagnostických testů
                .select('id, analysis') // Předpokládáme, že sloupec 'analysis' obsahuje identifikátor testu
                .eq('user_id', userId)
                .order('completed_at', { ascending: false }); // Pro případ, že by jich bylo více

            if (error) {
                console.error(`[checkSpecificTestCompleted] Chyba při dotazu na user_diagnostics:`, error);
                throw error;
            }

            if (existingTests && existingTests.length > 0) {
                // Najdeme konfiguraci pro povinný test na základě aktuálního cíle uživatele
                const mandatoryTestConfigKey = Object.keys(testTypeConfig).find(key => testTypeConfig[key].recommendedForGoal === currentProfile?.learning_goal);
                if (!mandatoryTestConfigKey) {
                     console.warn(`[checkSpecificTestCompleted] Nebyla nalezena konfigurace testu pro cíl: ${currentProfile?.learning_goal}`);
                     return false; // Nebo jiná logika, pokud cíl není definován
                }
                const mandatoryTestIdentifier = testTypeConfig[mandatoryTestConfigKey].identifier;

                // Zkontrolujeme, zda některý z dokončených testů odpovídá PŘESNĚ povinnému testu
                const completedMandatoryTest = existingTests.find(test =>
                    test.analysis && // Ujistíme se, že analysis existuje
                    test.analysis.summary && // Ujistíme se, že summary existuje
                    test.analysis.summary.test_type_identifier === mandatoryTestIdentifier // Porovnáme identifikátor
                );

                if (completedMandatoryTest) {
                    console.log(`[checkSpecificTestCompleted] Nalezen dokončený povinný test s identifikátorem '${mandatoryTestIdentifier}'.`);
                    return true; // Povinný test byl dokončen
                }
                console.log(`[checkSpecificTestCompleted] Nalezeny testy (${existingTests.length}), ale žádný neodpovídá povinnému identifikátoru '${mandatoryTestIdentifier}' v analýze.`);
            }
            // Pokud nebyl nalezen žádný test nebo žádný neodpovídal povinnému
            return false;

        } catch (err) {
            console.error("Error in checkSpecificTestCompleted:", err);
            showToast("Chyba při kontrole historie testů.", "error");
            return false; // Předpokládáme, že test nebyl dokončen, pokud dojde k chybě
        } finally {
            setLoadingState('test', false);
        }
    }


    async function loadTestQuestions(testType) {
        setLoadingState('test', true);
        if (ui.loaderSubtext) ui.loaderSubtext.textContent = 'Přizpůsobuji otázky...';
        try {
            if (!currentProfile) {
                throw new Error("Profil uživatele není načtený. Nelze určit typ otázek.");
            }
            if (!window.TestLogic || typeof window.TestLogic.loadTestQuestions !== 'function') {
                throw new Error("Chybí logika pro načítání otázek (TestLogic.loadTestQuestions).");
            }
            console.log(`[UI LoadQ v12.14] Volání TestLogic.loadTestQuestions s profilem (Cíl: ${currentProfile.learning_goal}, TestTyp: ${testType})`);
            questions = await window.TestLogic.loadTestQuestions(supabase, currentProfile, testTypeConfig);
            console.log(`[UI LoadQ v12.14] Obdrženo ${questions.length} otázek z logiky.`);

            // initializeTest se nyní volá VŽDY, i když je questions.length === 0
            initializeTest();

        } catch (error) {
            console.error('[UI] Error loading questions:', error);
            // Zde by se neměla zobrazovat chybová stránka, pokud chyba není kritická
            // Místo toho se spoléháme na to, že initializeTest() a showQuestion() zobrazí "žádné otázky"
            questions = []; // Zajistíme, že questions je prázdné pole pro initializeTest
            initializeTest(); // I při chybě zkusíme inicializovat UI pro zobrazení "žádné otázky"
            showToast("Chyba při načítání otázek", error.message, "error");
        } finally {
             setLoadingState('test', false);
        }
    }
    // --- END: Data Fetching Wrappers ---

    // --- START: Test Logic UI ---
    function initializeTest() {
        if (!questions) { // Pojistka
            questions = [];
        }

        if (ui.testLoader) ui.testLoader.style.display = 'none';
        if (ui.testContainer) ui.testContainer.style.display = 'block';
        if (ui.resultsContainer) ui.resultsContainer.style.display = 'none';
        if (ui.reviewContainer) ui.reviewContainer.style.display = 'none';
        if (ui.testSelector) ui.testSelector.style.display = 'none';
        if (ui.testTimer) ui.testTimer.style.display = 'flex';

        currentQuestionIndex = (questions.length > 0) ? 0 : -1; // -1 pokud nejsou otázky

        if (questions.length > 0) {
            userAnswers = questions.map((q) => {
                let maxScore = 1; // Default score
                const difficultyInt = parseInt(q.difficulty);
                // Přizpůsobení maxScore podle typu a obtížnosti
                if (q.question_type === 'construction') maxScore = 2; // Konstrukční úlohy
                else if (!isNaN(difficultyInt)) { // Numerická obtížnost
                    if (difficultyInt >= 4) maxScore = 3; // Těžké
                    else if (difficultyInt === 3) maxScore = 2; // Středně těžké
                    // Lehké (1-2) zůstávají na 1 bod
                }
                if (isNaN(maxScore) || maxScore < 1) maxScore = 1; // Pojistka

                return {
                    question_db_id: q.id, // ID otázky z databáze
                    question_number_in_test: q.question_number, // Pořadové číslo v tomto testu
                    question_text: q.question_text,
                    question_type: q.question_type,
                    options: q.options,
                    correct_answer: q.correct_answer,
                    solution_explanation: q.solution_explanation,
                    image_url: q.image_url,
                    topic_id: q.topic_id,
                    topic_name: q.topic_name,
                    subtopic_id: q.subtopic_id,
                    subtopic_name: q.subtopic_name,
                    difficulty: q.difficulty,
                    answer_prefix: q.answer_prefix, // Přidáno
                    answer_suffix: q.answer_suffix, // Přidáno
                    userAnswerValue: null, // Uloží se sem odpověď uživatele
                    scoreAwarded: null, // Body získané za tuto otázku
                    maxScore: maxScore, // Maximální možné body pro tuto otázku
                    checked_by: null, // 'local_exact', 'local_numeric', 'gemini_scored', 'skipped', 'error'
                    correctness: null, // 'correct', 'incorrect', 'partial', 'skipped', 'error'
                    reasoning: null, // Zdůvodnění od AI nebo lokální
                    error_analysis: null, // Analýza chyby od AI
                    feedback: null // Zpětná vazba od AI
                };
            });
            startTimer();
        } else {
            // Případ, kdy nejsou žádné otázky
            userAnswers = [];
            stopTimer(); // Zastavit timer, pokud běžel
            if(ui.timerValue) ui.timerValue.textContent = formatTime(0);
        }

        testTime = 0;
        if(ui.timerValue && questions.length > 0) ui.timerValue.textContent = formatTime(testTime); // Reset timer display only if test starts
        if(ui.answeredCountEl) ui.answeredCountEl.textContent = '0';
        if(ui.lowScoreMessageContainer) ui.lowScoreMessageContainer.innerHTML = ''; // Vyčistit případné staré zprávy

        createPagination(); // Bude prázdná, pokud questions.length === 0
        showQuestion(currentQuestionIndex); // Zobrazí buď první otázku, nebo zprávu "žádné otázky"
        updateProgressBar();
        updateNavigationButtons();

        // Animate test container entrance
        requestAnimationFrame(() => {
            if (ui.testContainer) {
                ui.testContainer.setAttribute('data-animate', ''); // For scroll animations if enabled
                ui.testContainer.style.setProperty('--animation-order', 0);
            }
        });
        setLoadingState('test', false);
        console.log(`[InitializeTest v12.14] Test initialized. Questions: ${questions.length}, CurrentIndex: ${currentQuestionIndex}`);
    }

    function startTimer() { if(timer)clearInterval(timer); testStartTime=new Date(); testTime=0; if(ui.timerValue) ui.timerValue.textContent=formatTime(testTime); ui.testTimer?.classList.remove('timer-warning','timer-danger'); timer=setInterval(()=>{testTime++; if(ui.timerValue) ui.timerValue.textContent=formatTime(testTime); const config=testTypeConfig[selectedTestType]; if(!config)return; const estimatedTime=(questions.length > 0 ? questions.length : testTypeConfig[selectedTestType]?.questionsCount || 20)*1.5*60; const warningTime=estimatedTime*0.8; if(testTime>estimatedTime){ui.testTimer?.classList.add('timer-danger'); ui.testTimer?.classList.remove('timer-warning');}else if(testTime>warningTime){ui.testTimer?.classList.add('timer-warning'); ui.testTimer?.classList.remove('timer-danger');}},1000); }
    function stopTimer() { clearInterval(timer); timer = null; testEndTime = new Date(); }

    function showQuestion(index) {
        if (!ui.questionContainer) {
            console.error("[ShowQuestion v12.14] Question container not found.");
            return;
        }

        if (questions.length === 0 || index < 0) {
            console.log("[ShowQuestion v12.14] No questions available or invalid index. Displaying no questions message.");
            let message = "Pro tento typ testu zatím nejsou k dispozici žádné otázky. Zkuste to prosím později, nebo vyberte jiný typ testu.";
            // Upřesnění zprávy pro aktivní, ale zatím neobsazené testy
            if (selectedTestType === 'math_accelerate' || selectedTestType === 'math_explore') {
                message = "Otázky pro tento test budou brzy doplněny. Děkujeme za trpělivost!";
            }
            ui.questionContainer.innerHTML = `<div class="loading-placeholder" style="text-align:center; padding: 3rem 1rem; color: var(--text-light); background-color: rgba(var(--card-solid-rgb), 0.7); border-radius: var(--card-radius);">
                                                <i class="fas fa-box-open" style="font-size: 3em; margin-bottom: 1rem; color: var(--accent-secondary);"></i>
                                                <p style="font-size: 1.2em; font-weight: 500;">${message}</p>
                                              </div>`;
            if(ui.questionCountEl) ui.questionCountEl.textContent = `0 / 0`;
            currentQuestionIndex = -1; // Explicitně nastavit neplatný index
            updatePagination(); // Aktualizuje paginaci (bude prázdná)
            updateNavigationButtons(); // Aktualizuje navigační tlačítka (finish se změní na zpět)
            return;
        }

        // Standardní zobrazení otázky, pokud existují
        if (index < 0 || index >= questions.length) {
             console.error(`[ShowQuestion v12.14] Pokus o zobrazení neplatné otázky (index: ${index}, počet otázek: ${questions.length})`);
             ui.questionContainer.innerHTML = `<div class="loading-placeholder" style="text-align:center; padding: 2rem; color: var(--text-muted);"><i class="fas fa-exclamation-triangle" style="font-size: 2em; margin-bottom: 1rem; color: var(--accent-orange);"></i><p>Chyba při načítání otázky. Zkuste obnovit stránku.</p></div>`;
            return;
        }

        const question = questions[index];
        console.log(`Zobrazuji Q#${index + 1} (Typ: ${question.question_type})`, question);
        currentQuestionIndex = index;

        if(ui.questionCountEl) ui.questionCountEl.textContent = `${index + 1} / ${questions.length}`;

        let questionHTML = `<div class="question-header"><span class="question-number">${question.question_number}</span><div class="question-text">${sanitizeHTML(question.question_text)}</div></div>`;

        if (question.image_url) {
            questionHTML += `<div class="question-image-container"><img class="question-image" src="${question.image_url}" alt="Obrázek k otázce ${question.question_number}" loading="lazy"></div>`;
        }

        const userAnswerData = userAnswers[index];
        const savedValue = userAnswerData ? userAnswerData.userAnswerValue : null;
        let answerInputHTML = '';

        switch (question.question_type) {
            case 'multiple_choice':
                answerInputHTML += `<div class="answer-options">`;
                const optionsData = question.options;
                if (!Array.isArray(optionsData)) {
                    console.error("Options nejsou pole pro MC:", question.id, optionsData);
                    answerInputHTML += `<div style='color:var(--accent-pink);font-weight:bold;'>Chyba: Formát možností není pole stringů.</div>`;
                } else if (optionsData.length === 0) {
                    console.warn("Chybí možnosti pro MC:", question.id);
                    answerInputHTML += `<div style='color:var(--accent-orange);'>Varování: Chybí možnosti odpovědí.</div>`;
                } else {
                    optionsData.forEach((optionText, idx) => {
                        const optionLetter = indexToLetter(idx);
                        const isSelected = savedValue === optionLetter;
                        const displayText = (typeof optionText === 'string' || typeof optionText === 'number') ? sanitizeHTML(optionText) : `(neplatný text ${idx+1})`;
                        answerInputHTML += `<label class="answer-option ${isSelected ? 'selected' : ''}" data-option-id="${optionLetter}"><input type="radio" name="question_${question.id || index}" value="${optionLetter}" ${isSelected ? 'checked' : ''} style="display: none;"><div class="answer-text"><span class="answer-letter">${optionLetter}.</span> ${displayText}</div></label>`;
                    });
                }
                answerInputHTML += `</div>`;
                break;
            case 'construction':
                answerInputHTML += `<div class="answer-input-container"><label for="construction-answer-${index}" class="form-label">Popište svůj postup:</label><textarea id="construction-answer-${index}" class="construction-textarea" placeholder="Podrobně popište kroky...">${sanitizeHTML(savedValue || '')}</textarea></div>`;
                break;
            case 'numeric':
            case 'text':
                let prefixData = null;
                let suffixData = question.answer_suffix || null;
                let isMultiPart = false;
                let multiPartKeys = [];

                // Check if answer_prefix is a JSON string representing an object or a simple string
                if (question.answer_prefix && typeof question.answer_prefix === 'string') {
                    try {
                        const parsedPrefix = JSON.parse(question.answer_prefix);
                        if (typeof parsedPrefix === 'object' && parsedPrefix !== null && !Array.isArray(parsedPrefix)) {
                            // It's an object, so this is a multi-part question
                            prefixData = parsedPrefix;
                            isMultiPart = true;
                            multiPartKeys = Object.keys(prefixData);
                        } else {
                            // It's a simple string or an array (which we treat as a simple string for prefix)
                            prefixData = question.answer_prefix;
                        }
                    } catch (e) {
                        // Parsing failed, treat as a simple string
                        prefixData = question.answer_prefix;
                    }
                } else if (question.answer_prefix && typeof question.answer_prefix === 'object' && !Array.isArray(question.answer_prefix)) {
                    // Already an object (e.g., if Supabase parses JSONB automatically)
                    prefixData = question.answer_prefix;
                    isMultiPart = true;
                    multiPartKeys = Object.keys(prefixData);
                } else if (question.answer_prefix) { // Simple string or array (treat as string)
                    prefixData = String(question.answer_prefix);
                }


                answerInputHTML += `<div class="answer-input-container">`;
                if (isMultiPart && multiPartKeys.length > 0) {
                    answerInputHTML += `<label class="form-label">Vaše odpovědi:</label>`;
                    multiPartKeys.forEach(partKey => {
                        const partPrefixText = prefixData[partKey] || ''; // Get prefix for this part
                        const partSavedValue = (typeof savedValue === 'object' && savedValue !== null) ? (savedValue[partKey] || '') : '';
                        answerInputHTML += `<div class="answer-input-group multi-part-answer-group">`;
                        if (partPrefixText) {
                            answerInputHTML += `<span class="answer-prefix">${sanitizeHTML(partPrefixText)}</span>`;
                        }
                        answerInputHTML += `<input type="${question.question_type === 'numeric' ? 'number' : 'text'}" id="text-answer-${index}-part-${partKey}" class="answer-input multi-part-input" data-part-key="${partKey}" placeholder="Odpověď pro ${partKey}" value="${sanitizeHTML(partSavedValue)}">`;
                        answerInputHTML += `</div>`;
                    });
                } else {
                    // Single part answer
                    answerInputHTML += `<label for="text-answer-${index}" class="form-label">Vaše odpověď:</label>`;
                    answerInputHTML += `<div class="answer-input-group">`;
                    if (prefixData && typeof prefixData === 'string') {
                        answerInputHTML += `<span class="answer-prefix">${sanitizeHTML(prefixData)}</span>`;
                    }
                    answerInputHTML += `<input type="${question.question_type === 'numeric' ? 'number' : 'text'}" id="text-answer-${index}" class="answer-input" placeholder="Zadejte odpověď" value="${sanitizeHTML(savedValue || '')}">`;
                    if (suffixData) {
                        answerInputHTML += `<span class="answer-suffix">${sanitizeHTML(suffixData)}</span>`;
                    }
                    answerInputHTML += `</div>`;
                }
                answerInputHTML += `</div>`;
                break;
            default:
                answerInputHTML += `<div class="answer-input-container"><label for="text-answer-${index}" class="form-label">Vaše odpověď (Neznámý typ otázky):</label><input type="text" id="text-answer-${index}" class="answer-input" placeholder="Zadejte odpověď" value="${sanitizeHTML(savedValue || '')}"></div>`;
                break;
        }

        questionHTML += answerInputHTML;
        ui.questionContainer.innerHTML = questionHTML;

        // Re-attach event listeners for new inputs
        const textInputs = ui.questionContainer.querySelectorAll('.answer-input');
        const constructionInput = ui.questionContainer.querySelector('.construction-textarea');

        textInputs.forEach(input => {
            input.addEventListener('input', (event) => {
                if (input.classList.contains('multi-part-input')) {
                    const partKey = event.target.dataset.partKey;
                    // Initialize userAnswerValue as an object if it's not already
                    let currentMultiAnswer = (typeof userAnswers[index].userAnswerValue === 'object' && userAnswers[index].userAnswerValue !== null)
                                            ? { ...userAnswers[index].userAnswerValue } : {};
                    currentMultiAnswer[partKey] = event.target.value;
                    saveAnswer(index, currentMultiAnswer);
                } else {
                    saveAnswer(index, event.target.value);
                }
            });
        });

        if (constructionInput) {
            constructionInput.addEventListener('input', (event) => {
                saveAnswer(index, event.target.value);
            });
        }

        ui.questionContainer.querySelectorAll('.answer-option').forEach(label => {
            label.addEventListener('click', handleAnswerSelection);
        });

        updatePagination();
        updateNavigationButtons();

        // Retrigger MathJax for the new question content
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            try {
                setTimeout(() => { // Use setTimeout to ensure DOM is updated
                    window.MathJax.typesetPromise([ui.questionContainer]).catch(e=>console.error("MathJax typesetting error:", e));
                }, 0);
            } catch(e) {
                console.error("MathJax initialization error:", e);
            }
        }
    }

    function handleAnswerSelection(event) { const selectedLabel=event.currentTarget;const qIndex=currentQuestionIndex;const optionId=selectedLabel.dataset.optionId;const radio=selectedLabel.querySelector('input[type="radio"]');ui.questionContainer.querySelectorAll('.answer-option').forEach(label=>{label.classList.remove('selected');});selectedLabel.classList.add('selected');if(radio)radio.checked=true;saveAnswer(qIndex,optionId);}
    function createPagination() { if(!ui.pagination) return; ui.pagination.innerHTML = (questions && questions.length > 0) ? questions.map((_,i)=>`<div class="page-item" data-question="${i}">${i+1}</div>`).join('') : ''; ui.pagination.querySelectorAll('.page-item').forEach(item=>{item.addEventListener('click',()=>{showQuestion(parseInt(item.dataset.question));});}); updatePagination(); }
    function updatePagination() { ui.pagination?.querySelectorAll('.page-item').forEach((item,index)=>{item.classList.remove('active','answered');if(index===currentQuestionIndex)item.classList.add('active');if(questions.length > 0 && userAnswers[index] && userAnswers[index].userAnswerValue !== null && (typeof userAnswers[index].userAnswerValue !== 'object' || Object.values(userAnswers[index].userAnswerValue).some(part => part !== null && String(part).trim() !== '')))item.classList.add('answered');}); }

    function updateNavigationButtons() {
        const noQuestions = questions.length === 0;
        if(ui.prevBtn) ui.prevBtn.disabled = noQuestions || currentQuestionIndex === 0;
        if(ui.nextBtn) ui.nextBtn.disabled = noQuestions || currentQuestionIndex === questions.length - 1;
        if(ui.finishBtn) {
            if (noQuestions) {
                ui.finishBtn.style.display = 'flex'; // Zobrazit i když nejsou otázky
                ui.finishBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Zpět na výběr';
                ui.finishBtn.disabled = isLoading.results; // Původní logika disabled
            } else {
                ui.finishBtn.style.display = currentQuestionIndex === questions.length - 1 ? 'flex' : 'none';
                ui.finishBtn.disabled = isLoading.results;
                ui.finishBtn.innerHTML = isLoading.results ? '<i class="fas fa-spinner fa-spin"></i> Vyhodnocuji...' : '<i class="fas fa-check-circle"></i> Dokončit test';
            }
        }
    }

    function updateProgressBar() {
        if (!ui.progressBar) return;
        const answeredCount = userAnswers.filter(a => {
            if (!a) return false;
            // For multi-part, consider answered if at least one part is filled
            if (typeof a.userAnswerValue === 'object' && a.userAnswerValue !== null) {
                return Object.values(a.userAnswerValue).some(part => part !== null && String(part).trim() !== '');
            }
            // For single-part, check normal non-empty
            return a.userAnswerValue !== null && String(a.userAnswerValue).trim() !== '';
        }).length;
        const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
        ui.progressBar.style.width = `${progress}%`;
        if(ui.answeredCountEl) ui.answeredCountEl.textContent = answeredCount;
    }

    function saveAnswer(qIndex, userAnswerValue) {
        // Ensure qIndex is valid
        if (qIndex < 0 || qIndex >= userAnswers.length) { // Přidána kontrola pro qIndex
             console.error(`Chyba: Neplatný index otázky ${qIndex} pro uložení odpovědi.`);
             return;
        }
        // Ensure userAnswers[qIndex] object exists
        if (!userAnswers[qIndex]) {
            console.error(`Chyba: Chybí objekt odpovědi pro index ${qIndex}`);
            return; // Early exit if the answer object doesn't exist
        }

        // Check if the answer state actually changed to avoid unnecessary updates
        let wasAnsweredBefore = false;
        const previousAnswer = userAnswers[qIndex].userAnswerValue;
        if (typeof previousAnswer === 'object' && previousAnswer !== null) {
            wasAnsweredBefore = Object.values(previousAnswer).some(part => part !== null && String(part).trim() !== '');
        } else {
            wasAnsweredBefore = previousAnswer !== null && String(previousAnswer).trim() !== '';
        }

        // Determine if the current input means the question is now "empty"
        let isCurrentAnswerEmpty = false;
        if (typeof userAnswerValue === 'object' && userAnswerValue !== null) {
            isCurrentAnswerEmpty = Object.values(userAnswerValue).every(part => part === null || String(part).trim() === '');
        } else {
            isCurrentAnswerEmpty = userAnswerValue === null || String(userAnswerValue).trim() === '';
        }

        // Update the stored answer: store null if it's effectively empty
        userAnswers[qIndex].userAnswerValue = isCurrentAnswerEmpty ? null : userAnswerValue;

        // Check if the "answered" status changed to update UI
        let isAnsweredNow = false;
        const currentSavedAnswer = userAnswers[qIndex].userAnswerValue; // Use the just-updated value
        if (typeof currentSavedAnswer === 'object' && currentSavedAnswer !== null) {
            isAnsweredNow = Object.values(currentSavedAnswer).some(part => part !== null && String(part).trim() !== '');
        } else {
            isAnsweredNow = currentSavedAnswer !== null && String(currentSavedAnswer).trim() !== '';
        }

        if (wasAnsweredBefore !== isAnsweredNow) {
            updateProgressBar();
            updatePagination(); // Update pagination dot if answered status changed
        }
        console.log(`Odpověď uložena Q#${qIndex + 1}:`, userAnswers[qIndex].userAnswerValue);
    }
    // --- END: Test Logic UI ---

    // --- START: Evaluation & Results UI ---
    async function evaluateAnswersUI() {
        if (questions.length === 0) {
            console.log("[EvaluateAnswersUI] Žádné otázky k vyhodnocení.");
            return; // Nic k vyhodnocení
        }
        console.log("Spouštím vyhodnocení odpovědí (UI)...");
        showGeminiOverlay(true);
        const promises = [];
        for (let i = 0; i < questions.length; i++) {
            const qData = questions[i];
            const answerData = userAnswers[i];
            if (!answerData) { console.error(`Chyba: Nenalezen objekt odpovědi pro index ${i} (UI)`); continue; }

            // Check if answer is skipped or empty
            let isSkippedOrEmpty = false;
            if (answerData.userAnswerValue === null) {
                isSkippedOrEmpty = true;
            } else if (typeof answerData.userAnswerValue === 'object') {
                // For multi-part, considered empty if all parts are empty/null
                isSkippedOrEmpty = Object.values(answerData.userAnswerValue).every(val => val === null || String(val).trim() === '');
            } else {
                isSkippedOrEmpty = String(answerData.userAnswerValue).trim() === '';
            }

            if (isSkippedOrEmpty) {
                answerData.scoreAwarded = 0;
                answerData.correctness = "skipped";
                answerData.reasoning = "Otázka byla přeskočena nebo odpověď byla prázdná.";
                answerData.error_analysis = null;
                answerData.feedback = "Příště zkuste odpovědět.";
                answerData.checked_by = 'skipped';
                console.log(`Q#${i+1} (${qData.question_type}) přeskočeno/prázdné (UI).`);
                promises.push(Promise.resolve()); // Add a resolved promise to keep array length consistent
                continue; // Skip to next question
            }

            // Push promise for Gemini evaluation for non-skipped answers
            promises.push(
                window.TestLogic.checkAnswerWithGemini(
                    qData.question_type,
                    qData.question_text,
                    qData.correct_answer, // Pass the raw correct_answer from DB
                    answerData.userAnswerValue,
                    answerData.maxScore,
                    i, // currentQuestionIndex for logging within Gemini logic
                    qData.solution_explanation, // Pass solution for construction if available
                    qData.options // Pass options for MC questions
                ).then(evaluationResult => {
                    // Assign evaluation results to the corresponding userAnswer object
                    userAnswers[i].scoreAwarded = evaluationResult.score;
                    userAnswers[i].correctness = evaluationResult.correctness;
                    userAnswers[i].reasoning = evaluationResult.reasoning;
                    userAnswers[i].error_analysis = evaluationResult.error_analysis;
                    userAnswers[i].feedback = evaluationResult.feedback;
                    userAnswers[i].checked_by = evaluationResult.correctness === 'error' || evaluationResult.reasoning.includes("fallback") ? 'fallback_scored' : 'gemini_scored';
                    console.log(`Q#${i+1} (${qData.question_type}) vyhodnoceno (UI): Skóre ${evaluationResult.score}/${answerData.maxScore}, Správnost: ${evaluationResult.correctness}`);
                }).catch(error => {
                    console.error(`Chyba vyhodnocení pro Q#${i+1} (UI):`, error);
                    userAnswers[i].scoreAwarded = 0;
                    userAnswers[i].correctness = 'error';
                    userAnswers[i].reasoning = `Automatické hodnocení selhalo: ${error.message}`;
                    userAnswers[i].error_analysis = "Chyba systému hodnocení.";
                    userAnswers[i].feedback = "Kontaktujte podporu, pokud problém přetrvává.";
                    userAnswers[i].checked_by = 'error';
                })
            );
        }

        await Promise.all(promises); // Wait for all evaluations to complete
        showGeminiOverlay(false);
        console.log("Vyhodnocení odpovědí dokončeno (UI):", userAnswers);
    }

    function displayResults() { if(!ui.testContainer || !ui.resultsContainer || !ui.reviewContainer || !ui.testTimer || !ui.testLevel || !ui.resultScoreEl || !ui.resultPercentageEl || !ui.resultCorrectEl || !ui.resultIncorrectEl || !ui.resultTimeEl || !ui.lowScoreMessageContainer || !ui.continueBtn || !ui.topicResultsEl || !ui.reviewAnswersBtn || !ui.backToResultsBtn) { console.error("Chyba: Některé elementy výsledků nebyly nalezeny v DOM."); return; }
        // Ensure testResultsData exists
        if (!testResultsData) {
            console.error("Chyba: Chybí data výsledků (testResultsData).");
            showErrorMessagePage("Nepodařilo se zobrazit výsledky - chybí data.");
            return;
        }

        // Hide test view, show results
        ui.testContainer.style.display = 'none';
        ui.resultsContainer.style.display = 'block';
        ui.reviewContainer.style.display = 'none'; // Ensure review is hidden
        ui.testTimer.style.display = 'none'; // Hide timer
        if(ui.testLevel) ui.testLevel.textContent = 'Výsledky testu'; // Update header

        // Populate summary stats
        if(ui.resultScoreEl) ui.resultScoreEl.textContent = `${testResultsData.score}/50`;
        if(ui.resultPercentageEl) ui.resultPercentageEl.textContent = `${testResultsData.percentage}%`;
        if(ui.resultCorrectEl) ui.resultCorrectEl.textContent = testResultsData.correctAnswers;
        if(ui.resultIncorrectEl) ui.resultIncorrectEl.textContent = testResultsData.incorrectAnswers + testResultsData.partiallyCorrectAnswers; // Combine incorrect and partial
        if(ui.resultTimeEl) ui.resultTimeEl.textContent = formatTime(testResultsData.timeSpent);

        // Handle low score message and continue button state
        ui.lowScoreMessageContainer.innerHTML = ''; // Clear previous messages
        ui.continueBtn.disabled = true; // Disable by default

        const saveError = ui.continueBtn.getAttribute('data-save-error') === 'true';
        const scoreThreshold = window.TestLogic?.SCORE_THRESHOLD_FOR_SAVING ?? 5;

        if (saveError) {
            ui.lowScoreMessageContainer.innerHTML = `<div class="error-message-container"><i class="fas fa-exclamation-triangle"></i><div class="loader-text">Chyba ukládání</div><div class="loader-subtext">Nepodařilo se uložit výsledky testu. Studijní plán nelze vytvořit.</div></div>`;
        } else if (testResultsData.score < scoreThreshold) {
            ui.lowScoreMessageContainer.innerHTML = `<div class="low-score-message warning"><i class="fas fa-exclamation-circle"></i><strong>Výsledek nebyl uložen.</strong><br>Vaše skóre (${testResultsData.score}/50) je nižší než ${scoreThreshold} bodů. Tyto výsledky nebudou použity pro generování studijního plánu.</div>`;
        } else {
            ui.lowScoreMessageContainer.innerHTML = `<div class="low-score-message info"><i class="fas fa-info-circle"></i><strong>Výsledky byly uloženy.</strong><br>Vaše skóre (${testResultsData.score}/50) bude použito pro studijní plán.</div>`;
            ui.continueBtn.disabled = false; // Enable continue button only if results saved and score is sufficient
        }


        // Populate topic results
        const sortedTopics = Object.values(testResultsData.topicResults || {}).sort((a,b) => a.score_percent - b.score_percent); // Sort by score
        ui.topicResultsEl.innerHTML = sortedTopics.map(stats => {
            const icon = topicIcons[stats.name] || topicIcons.default;
            return `
                <div class="topic-card card ${stats.strength}">
                    <div class="topic-header">
                        <div class="topic-icon"><i class="fas ${icon}"></i></div>
                        <h3 class="topic-title">${sanitizeHTML(stats.name)}</h3>
                    </div>
                    <div class="topic-stats">
                        <div class="topic-progress">
                            <span class="topic-progress-label">Úspěšnost (body)</span>
                            <span class="topic-progress-value">${stats.score_percent}%</span>
                        </div>
                        <div class="topic-progress-bar">
                            <div class="topic-progress-fill" style="width: ${stats.score_percent}%;"></div>
                        </div>
                         <div class="topic-progress" style="margin-top: 0.5rem;">
                            <span class="topic-progress-label">Body</span>
                            <span class="topic-progress-value">${stats.points_achieved} / ${stats.max_points}</span>
                        </div>
                        <div class="topic-progress" style="margin-top: 0.1rem; font-size: 0.8em;">
                            <span class="topic-progress-label">Správně otázek</span>
                            <span class="topic-progress-value">${stats.fully_correct} / ${stats.total_questions}</span>
                        </div>
                    </div>
                </div>`;
        }).join('');

        // Attach event listeners for buttons
        if (ui.reviewAnswersBtn) ui.reviewAnswersBtn.onclick = displayReview;
        if (ui.backToResultsBtn) ui.backToResultsBtn.onclick = () => { ui.reviewContainer.style.display = 'none'; ui.resultsContainer.style.display = 'block'; if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' }); };
    }

    function displayReview() {
        if (!ui.resultsContainer || !ui.reviewContainer || !ui.reviewContent || !ui.reviewItemTemplate) {
            console.error("Elementy pro přehled odpovědí nebo šablona nenalezeny!");
            return;
        }
        ui.resultsContainer.style.display = 'none';
        ui.reviewContainer.style.display = 'block';
        ui.reviewContent.innerHTML = ''; // Clear previous review content

        if (!questions || !userAnswers || questions.length !== userAnswers.length) {
            ui.reviewContent.innerHTML = '<p class="error-message-container">Chyba: Data pro přehled odpovědí nejsou kompletní.</p>';
            // Pokud nebyly žádné otázky (např. test s 0 otázkami), zobrazíme zprávu
            if (questions.length === 0) {
                ui.reviewContent.innerHTML = `<div class="loading-placeholder" style="text-align:center; padding: 3rem 1rem; color: var(--text-light);">
                                                <i class="fas fa-box-open" style="font-size: 3em; margin-bottom: 1rem; color: var(--accent-secondary);"></i>
                                                <p style="font-size: 1.2em; font-weight: 500;">Nebyly zodpovězeny žádné otázky.</p>
                                              </div>`;
            }
            return;
        }


        questions.forEach((q, index) => {
            const answer = userAnswers[index];
            if (!answer) { // Pojistka pro případ, že by answer neexistoval
                ui.reviewContent.innerHTML += `<div class="review-question-item card"><p>Chyba: Chybí data odpovědi pro otázku ${index + 1}</p></div>`;
                return;
            }

            const templateNode = ui.reviewItemTemplate.content.cloneNode(true);
            const itemElement = templateNode.querySelector('.review-question-item');
            itemElement.dataset.questionIndex = index; // Store index for re-evaluation

            let itemClass = 'review-question-item card';
            let scoreStatusText = '';
            // Přidáno: Zobrazit skóre i pro přeskočené jako 0/max
            let scoreValueText = `(${answer.scoreAwarded ?? 0} / ${answer.maxScore} b.)`;
            if (answer.correctness === "skipped") {
                scoreValueText = `(0 / ${answer.maxScore} b.)`; // Explicitně 0 pro přeskočené
            }


            switch (answer.correctness) {
                case 'correct': itemClass += ' correct'; scoreStatusText = '<span class="correct">Správně</span>'; break;
                case 'partial': itemClass += ' partial'; scoreStatusText = '<span class="partial">Částečně</span>'; break;
                case 'incorrect': itemClass += ' incorrect'; scoreStatusText = '<span class="incorrect">Nesprávně</span>'; break;
                case 'skipped': itemClass += ' skipped'; scoreStatusText = '<span class="skipped">Přeskočeno</span>'; break;
                case 'error': default: itemClass += ' incorrect error-eval'; scoreStatusText = '<span class="incorrect">Chyba</span>'; break;
            }
            itemElement.className = itemClass;

            itemElement.querySelector('.review-question-number').textContent = q.question_number;
            itemElement.querySelector('.review-question-text').innerHTML = sanitizeHTML(q.question_text); // Use innerHTML for MathJax

            // Handle image display
            const imgContainer = itemElement.querySelector('.review-question-image-container');
            const imgElement = itemElement.querySelector('.review-question-image');
            if (q.image_url) {
                imgElement.src = q.image_url;
                imgElement.alt = `Obrázek k otázce ${q.question_number}`;
                imgContainer.style.display = 'block';
            } else {
                imgContainer.style.display = 'none';
            }

            // Display user's answer
            const userAnswerValueEl = itemElement.querySelector('.user-answer-value');
            if (answer.userAnswerValue !== null) {
                if (q.question_type === 'multiple_choice') {
                    const selectedLetter = String(answer.userAnswerValue).trim().toUpperCase();
                    const selectedOptionIndex = selectedLetter.charCodeAt(0) - 65; // A=0, B=1, etc.
                    const optionText = (Array.isArray(q.options) && q.options[selectedOptionIndex] !== undefined)
                                        ? sanitizeHTML(q.options[selectedOptionIndex])
                                        : `(Neplatná volba: ${sanitizeHTML(answer.userAnswerValue)})`;
                    userAnswerValueEl.textContent = `${selectedLetter}. ${optionText}`;
                } else if (typeof answer.userAnswerValue === 'object') { // For multi-part answers
                     let multiPartAnswerHTML = "";
                     Object.keys(answer.userAnswerValue).forEach(partKey => {
                         // Pokusíme se najít prefix i pro vícedílnou odpověď z q.answer_prefix (pokud je objekt)
                         const partPrefix = (q.answer_prefix && typeof q.answer_prefix === 'object' && q.answer_prefix[partKey])
                                           ? sanitizeHTML(q.answer_prefix[partKey])
                                           : (sanitizeHTML(partKey).toUpperCase() + ': '); // Fallback na klíč části
                         multiPartAnswerHTML += `<div>${partPrefix}${sanitizeHTML(answer.userAnswerValue[partKey] || '<em>(prázdné)</em>')}</div>`;
                     });
                     userAnswerValueEl.innerHTML = multiPartAnswerHTML;
                } else { // For simple text/numeric
                    userAnswerValueEl.textContent = sanitizeHTML(answer.userAnswerValue);
                }
            } else {
                userAnswerValueEl.innerHTML = `<em>(Nezodpovězeno)</em>`;
            }

            // Display correct answer if not correct or construction
            const correctAnswerContainer = itemElement.querySelector('.review-correct-answer');
            const correctAnswerValueEl = itemElement.querySelector('.correct-answer-value');
            if (q.question_type !== 'construction' && answer.correctness !== 'correct') {
                correctAnswerContainer.style.display = 'block';
                if (q.question_type === 'multiple_choice') {
                    // Ensure correct_answer is just the letter for MCQs
                    const correctLetter = String(q.correct_answer).trim().toUpperCase().replace(/[\.\)\s].*/, ''); // Clean up "A.", "A)", "A "
                    const correctOptionIndex = correctLetter.charCodeAt(0) - 65;
                    const correctText = (Array.isArray(q.options) && q.options[correctOptionIndex] !== undefined)
                                        ? sanitizeHTML(q.options[correctOptionIndex])
                                        : `(Neplatný text správné odpovědi)`;
                    correctAnswerValueEl.textContent = `${correctLetter}. ${correctText}`;
                } else if (typeof q.correct_answer === 'object' && q.correct_answer !== null && !Array.isArray(q.correct_answer)) { // For multi-part correct answers
                    let multiPartCorrectHTML = "";
                     Object.keys(q.correct_answer).forEach(partKey => {
                         const partPrefix = (q.answer_prefix && typeof q.answer_prefix === 'object' && q.answer_prefix[partKey])
                                           ? sanitizeHTML(q.answer_prefix[partKey])
                                           : (sanitizeHTML(partKey).toUpperCase() + ': ');
                         multiPartCorrectHTML += `<div>${partPrefix}${sanitizeHTML(q.correct_answer[partKey])}</div>`;
                     });
                     correctAnswerValueEl.innerHTML = multiPartCorrectHTML;
                } else { // Simple text/numeric correct answer
                    correctAnswerValueEl.textContent = sanitizeHTML(q.correct_answer);
                }
            } else {
                correctAnswerContainer.style.display = 'none';
            }

            // Display solution/explanation from Gemini's reasoning or question's solution
            const solutionExplanationEl = itemElement.querySelector('.solution-explanation');
            const solutionContainer = itemElement.querySelector('.review-solution');

            // Prefer Gemini's reasoning if available and not just a "correct/incorrect" statement for non-skipped.
            // Otherwise, use the question's solution_explanation.
            const explanationToShow = (answer.reasoning && answer.reasoning.trim() !== "" && answer.correctness !== "skipped" && !["Odpověď je správná.", "Odpověď je nesprávná."].includes(answer.reasoning.trim()))
                ? answer.reasoning
                : q.solution_explanation;

            if (explanationToShow && explanationToShow.trim() !== "" && explanationToShow !== "Oficiální postup není k dispozici.") {
                solutionExplanationEl.innerHTML = sanitizeHTML(explanationToShow); // Use innerHTML for MathJax
                solutionContainer.style.display = 'block';
            } else {
                solutionContainer.style.display = 'none';
            }


            // Display AI error analysis and feedback
            const errorAnalysisTextEl = itemElement.querySelector('.error-analysis-text');
            const errorAnalysisContainer = itemElement.querySelector('.review-error-analysis');
            const aiFeedbackContainer = itemElement.querySelector('.review-ai-feedback'); // Rodičovský kontejner

            if (answer.error_analysis && answer.error_analysis.trim() !== "") {
                errorAnalysisTextEl.innerHTML = sanitizeHTML(answer.error_analysis); // Use innerHTML for MathJax
                errorAnalysisContainer.style.display = 'block';
                aiFeedbackContainer.style.display = 'block'; // Zobrazit rodiče, pokud je co zobrazit
            } else {
                errorAnalysisContainer.style.display = 'none';
            }

            const aiAdviceTextEl = itemElement.querySelector('.ai-advice-text');
            const aiAdviceContainer = itemElement.querySelector('.review-ai-advice');
             if (answer.feedback && answer.feedback.trim() !== "") {
                aiAdviceTextEl.innerHTML = sanitizeHTML(answer.feedback); // Use innerHTML for MathJax
                aiAdviceContainer.style.display = 'block';
                // Pokud error_analysis není zobrazen, ale feedback ano, stále zobrazit rodiče
                if(!answer.error_analysis || answer.error_analysis.trim() === "") aiFeedbackContainer.style.display = 'block';
            } else {
                aiAdviceContainer.style.display = 'none';
            }
            // Skrýt rodičovský kontejner, pokud ani jedna podsekce nemá obsah
            if (errorAnalysisContainer.style.display === 'none' && aiAdviceContainer.style.display === 'none') {
                aiFeedbackContainer.style.display = 'none';
            }


            // Display score
            itemElement.querySelector('.score-status').innerHTML = scoreStatusText;
            itemElement.querySelector('.score-value').textContent = scoreValueText;

            // Re-evaluation button logic
            const reviewActionsDiv = itemElement.querySelector('.review-actions');
            const reevaluateBtn = itemElement.querySelector('.reevaluate-answer-btn');
            if (answer.correctness === 'incorrect' || answer.correctness === 'partial' || answer.correctness === 'error') {
                reviewActionsDiv.style.display = 'block';
                reevaluateBtn.dataset.questionIndex = index; // Store index for re-evaluation
                reevaluateBtn.onclick = handleReevaluateClick; // Attach event listener
            } else {
                reviewActionsDiv.style.display = 'none';
            }

            ui.reviewContent.appendChild(templateNode);
        });

        // Retrigger MathJax for the entire review content
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            try {
                setTimeout(() => { // Use setTimeout to ensure DOM is updated
                    window.MathJax.typesetPromise([ui.reviewContent]).catch(e => console.error("MathJax error in review:", e));
                }, 0);
            } catch (e) {
                console.error("MathJax init error in review:", e);
            }
        }
        if (ui.reviewContainer) ui.reviewContainer.scrollIntoView({ behavior: 'smooth' }); // Scroll to top of review
    }


    async function handleReevaluateClick(event) {
        const button = event.currentTarget;
        const questionIndex = parseInt(button.dataset.questionIndex, 10);

        if (isNaN(questionIndex) || !userAnswers[questionIndex] || !questions[questionIndex]) {
            showToast("Chyba", "Nelze přehodnotit tuto otázku.", "error");
            return;
        }

        if (isLoading.reevaluation[questionIndex]) {
            showToast("Info", "Přehodnocení již probíhá.", "info");
            return;
        }

        console.log(`[Reevaluate] Požadavek na přehodnocení otázky #${questionIndex + 1}`);
        isLoading.reevaluation[questionIndex] = true;
        setLoadingState(`reevaluation_${questionIndex}`, true); // Update button UI

        // Simulate AI call (v reálné aplikaci by zde byl volání na Gemini)
        setTimeout(() => {
            // Zde byste aktualizovali userAnswers[questionIndex] s novým hodnocením
            // Např. userAnswers[questionIndex].correctness = 'correct';
            // userAnswers[questionIndex].scoreAwarded = userAnswers[questionIndex].maxScore;
            // userAnswers[questionIndex].reasoning = "AI přehodnotilo: Odpověď je nyní považována za správnou.";
            // ... atd.
            console.log(`[Reevaluate] Placeholder: Přehodnocení dokončeno pro otázku ${questionIndex + 1}.`);
            showToast("Přehodnocení", `Funkce "Přehodnotit odpověď" bude brzy implementována pro otázku č. ${questionIndex + 1}.`, "info");

            isLoading.reevaluation[questionIndex] = false;
            setLoadingState(`reevaluation_${questionIndex}`, false); // Obnovit UI tlačítka

            // Možnost automatického znovuzobrazení revize pro tuto otázku:
            // displayReview(); // Nebo jen aktualizovat konkrétní item, pokud je to možné
        }, 2000); // Simulace 2 sekundového zpoždění
    }


    async function finishTest() {
        stopTimer();

        // VERZE 12.14: Změna chování tlačítka Dokončit, pokud nejsou otázky
        if (questions.length === 0) {
            console.log("[FinishTest] Žádné otázky k dokončení testu. Vracím na výběr.");
            if(ui.testContainer) ui.testContainer.style.display = 'none';
            if(ui.testTimer) ui.testTimer.style.display = 'none';
            if(ui.testSelector) ui.testSelector.style.display = 'block';
            if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu'; // Resetovat nadpis
            applyTestHighlightingAndSelection(); // Obnovit stav výběru testu
            history.replaceState({ state: 'testSelection' }, document.title, window.location.href); // Aktualizovat historii
            return;
        }

        setLoadingState('results', true);
        if(ui.finishBtn) {
            ui.finishBtn.disabled = true;
            ui.finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vyhodnocuji...';
        }
        let saveResult = { success: false }; // Výchozí stav pro případ chyby
        try {
            // Vyhodnocení odpovědí
            await evaluateAnswersUI();

            // Výpočet finálních výsledků
            testResultsData = window.TestLogic.calculateFinalResults(userAnswers, questions);
            testResultsData.timeSpent = testTime; // Přidat čas strávený testem

            // Přidání identifikátoru typu testu do výsledků
            const testConfig = testTypeConfig[selectedTestType];
            if (testConfig && testConfig.identifier) {
                if (!testResultsData.summary) testResultsData.summary = {}; // Pojistka pro summary
                testResultsData.summary.test_type_identifier = testConfig.identifier;
                 console.log(`[finishTest] Added test_type_identifier: ${testConfig.identifier} to results.summary`);
            } else {
                console.warn(`[finishTest] Missing testConfig or identifier for selectedTestType: ${selectedTestType}`);
            }


            // Uložení výsledků
            saveResult = await window.TestLogic.saveTestResults(supabase, currentUser, testResultsData, userAnswers, questions, testEndTime);
            diagnosticId = saveResult.diagnosticId || null; // Uložit ID diagnostiky pro případné použití

            if (saveResult.success) {
                // Přidělení bodů
                const pointsResult = await window.TestLogic.awardPoints(supabase, currentUser, currentProfile, selectedTestType, testResultsData, testTypeConfig);
                if (pointsResult?.success) {
                    // Aktualizace lokálního profilu (pokud TestLogic neaktualizuje globální `currentProfile`)
                    currentProfile.points = pointsResult.newTotal;
                    showToast(`+${pointsResult.awardedPoints} kreditů získáno!`, `Za test '${testTypeConfig[selectedTestType].title}'`, 'success');
                } else if (pointsResult && pointsResult.error) {
                    showToast(`Nepodařilo se připsat body: ${pointsResult.error}`, 'warning');
                }
                // Zde by mohla být i kontrola a udělení odznaků/achievementů
                if (typeof window.TestLogic.checkAndAwardAchievements === 'function' && currentProfile) {
                     await window.TestLogic.checkAndAwardAchievements(currentUser.id, currentProfile, { /* other data if needed */ });
                }

            } else {
                console.warn("Výsledky nebyly úspěšně uloženy nebo byly pod limitem, body nebudou přiděleny.");
                if(ui.continueBtn) {
                    ui.continueBtn.disabled = true; // Zakázat tlačítko Pokračovat na plán
                    // Pokud chyba nebyla kvůli nízkému skóre, označit to
                    if(saveResult.error && !saveResult.error.includes('Skóre je příliš nízké')) {
                        ui.continueBtn.setAttribute('data-save-error', 'true');
                    }
                }
            }

            // Zobrazení výsledků
            displayResults();
            history.pushState({ state: 'testFinished' }, document.title, window.location.href); // PUSH state for results

        } catch (error) {
            console.error("Chyba při dokončování testu:", error);
            showGeminiOverlay(false); // Ujistit se, že overlay je skrytý
            // Pokusit se zobrazit alespoň základní info o chybě, i když testResultsData nemusí být plně vytvořené
            if (!testResultsData) {
                testResultsData = { score: 0, percentage: 0, correctAnswers: 0, incorrectAnswers: questions.length, partiallyCorrectAnswers: 0, skippedAnswers: 0, timeSpent: testTime, topicResults: {}, evaluationErrors: questions.length };
            }
            displayResults(); // Zobrazit co máme, i když je to jen základní skóre 0
            // Zobrazit chybovou zprávu uživateli
            if(ui.lowScoreMessageContainer) {
                ui.lowScoreMessageContainer.innerHTML = `<div class="error-message-container"><i class="fas fa-exclamation-triangle"></i><div class="loader-text">Chyba!</div><div class="loader-subtext">Chyba vyhodnocení/ukládání: ${error.message}. Výsledky nemusí být kompletní nebo uložené.</div></div>`;
            }
            if(ui.continueBtn) { // Zajistit, že tlačítko je deaktivováno
                ui.continueBtn.disabled = true;
                ui.continueBtn.setAttribute('data-save-error', 'true');
            }
            history.pushState({ state: 'testFinishedWithError' }, document.title, window.location.href);
        } finally {
            setLoadingState('results', false);
            if(ui.finishBtn) {
                ui.finishBtn.disabled = true; // I po úspěšném dokončení by mělo být tlačítko neaktivní
                ui.finishBtn.innerHTML = '<i class="fas fa-check-circle"></i> Test Dokončen';
            }
        }
    }
    // --- END: Evaluation & Results UI ---

    // --- START: Test Flow & Back Button ---
    function applyTestHighlightingAndSelection() {
        const userLearningGoal = currentProfile?.learning_goal;
        let mandatoryTestKey = null;

        if (userLearningGoal) {
            mandatoryTestKey = Object.keys(testTypeConfig).find(key => testTypeConfig[key].recommendedForGoal === userLearningGoal);
        }

        if (!mandatoryTestKey && userLearningGoal) {
            console.warn(`[Highlight v12.12] Pro cíl '${userLearningGoal}' nebyl nalezen žádný povinný test. Uživatel by měl být přesměrován na výběr cíle nebo se zobrazí chyba.`);
            // Zde by mohla být logika pro zobrazení chybové zprávy nebo přesměrování
        } else if (!userLearningGoal) {
            console.warn(`[Highlight v12.12] Cíl uživatele není nastaven. Nelze určit povinný test.`);
             // Zde by mohla být logika pro zobrazení chybové zprávy nebo přesměrování
        }

        // Nastavíme `selectedTestType` na povinný test, pokud existuje
        selectedTestType = mandatoryTestKey; // Může být null, pokud cíl není nastaven nebo pro něj není test

        ui.testTypeCards.forEach(card => {
            const testType = card.dataset.testType;
            const config = testTypeConfig[testType];
            const buttonInCard = card.querySelector('.btn-start-test-in-card');
            const recommendedBadge = card.querySelector('.recommended-badge');

            // Reset classes
            card.classList.remove('recommended-test', 'disabled-test', 'selected');
            if (buttonInCard) buttonInCard.disabled = true; // Deaktivovat všechna tlačítka defaultně
            if (recommendedBadge) recommendedBadge.style.display = 'none';

            if (config) {
                if (mandatoryTestKey === testType) { // Je to POVINNÝ test pro daný cíl
                    card.classList.add('recommended-test');
                    card.classList.add('selected'); // Označit jako vybraný
                    if (recommendedBadge) recommendedBadge.style.display = 'block';

                    if (buttonInCard) {
                        if (config.isActive === false) {
                            buttonInCard.innerHTML = '<i class="fas fa-hourglass-half"></i> Spustit Test (Brzy!)';
                            buttonInCard.disabled = false; // Povolíme kliknutí pro zobrazení "Již brzy"
                            buttonInCard.classList.remove('btn-primary');
                            buttonInCard.classList.add('btn-secondary', 'btn-tooltip');
                            buttonInCard.title = `Test "${config.title}" bude brzy dostupný.`;
                        } else {
                            buttonInCard.innerHTML = `<i class="fas fa-play"></i> Spustit Test`;
                            buttonInCard.disabled = false; // Povolit spuštění
                            buttonInCard.classList.remove('btn-secondary');
                            buttonInCard.classList.add('btn-primary');
                             buttonInCard.title = `Spustit test: ${config.title}`;
                        }
                    }
                    console.log(`[Highlight v12.12] Povinný test: ${config.title} pro cíl ${userLearningGoal || 'NENASTAVEN'}`);
                    // Aktualizujeme nadpisy i zde, aby byly konzistentní při návratu na výběr
                    if (ui.currentTestTitle) ui.currentTestTitle.textContent = config.title;
                    if (ui.testLevel) ui.testLevel.textContent = config.description.split('.')[0];

                } else { // Ostatní testy, které nejsou povinné pro daný cíl
                    card.classList.add('disabled-test');
                    if (buttonInCard) {
                        buttonInCard.innerHTML = '<i class="fas fa-times-circle"></i> Není určeno pro váš cíl';
                        buttonInCard.disabled = true;
                        buttonInCard.classList.remove('btn-primary');
                        buttonInCard.classList.add('btn-secondary');
                        buttonInCard.title = 'Tento test není určen pro váš aktuální studijní cíl.';
                    }
                }
            } else { // Konfigurace pro test nebyla nalezena
                card.classList.add('disabled-test');
                if (buttonInCard) {
                    buttonInCard.innerHTML = '<i class="fas fa-ban"></i> Test nedostupný';
                    buttonInCard.disabled = true;
                }
            }
        });

        // Aktualizace globálního tlačítka Start
        if (ui.startSelectedTestBtnGlobal) {
            if (selectedTestType && testTypeConfig[selectedTestType]) {
                const config = testTypeConfig[selectedTestType];
                ui.startSelectedTestBtnGlobal.innerHTML = `<i class="fas fa-play-circle"></i> Spustit: ${config.title}`;
                if (config.isActive === false) {
                    ui.startSelectedTestBtnGlobal.disabled = true; // Deaktivovat, pokud "Již brzy"
                    ui.startSelectedTestBtnGlobal.title = `Test "${config.title}" bude brzy dostupný.`;
                } else {
                    ui.startSelectedTestBtnGlobal.disabled = false; // Povolit, pokud je aktivní
                    ui.startSelectedTestBtnGlobal.title = `Spustit test: ${config.title}`;
                }
            } else {
                // Případ, kdy není žádný povinný test (např. chybí cíl)
                ui.startSelectedTestBtnGlobal.innerHTML = `<i class="fas fa-play-circle"></i> Vyberte Test`;
                ui.startSelectedTestBtnGlobal.disabled = true;
                ui.startSelectedTestBtnGlobal.title = `Nejprve musí být určen povinný test (zkontrolujte svůj studijní cíl).`;
            }
        }
        initTooltips(); // Re-inicializovat tooltips po změnách DOM
    }

    function startSelectedTest() {
        // Zkontrolujeme, zda je selectedTestType platný a test je aktivní
        if (!selectedTestType) {
            showToast('Chyba', 'Povinný test nebyl správně určen. Zkontrolujte svůj studijní cíl nebo obnovte stránku.', 'error');
            // Zobrazit panel výběru, pokud není viditelný
            if (ui.testSelector && getComputedStyle(ui.testSelector).display === 'none') {
                ui.testSelector.style.display = 'block';
            }
            if (ui.testContainer) ui.testContainer.style.display = 'none';
            if (ui.testLoader) ui.testLoader.style.display = 'none';
            if (ui.testTimer) ui.testTimer.style.display = 'none';
            return;
        }

        const config = testTypeConfig[selectedTestType];
        if (!config) {
            showErrorMessagePage(`Neznámý typ testu: ${selectedTestType}`);
            return;
        }

        // VERZE 12.14: Povolit spuštění, i když config.isActive je false, ale zpráva o otázkách bude řešena v showQuestion
        // if (config.isActive === false) {
        //     showToast("Již brzy!", `Test typu "${config.title}" bude brzy dostupný.`, "info");
        //     // Ujistit se, že je zobrazen panel výběru
        //     if (ui.testSelector) ui.testSelector.style.display = 'block';
        //     if (ui.testLoader) ui.testLoader.style.display = 'none';
        //     if (ui.testContainer) ui.testContainer.style.display = 'none';
        //     if (ui.testTimer) ui.testTimer.style.display = 'none';
        //     console.log(`[StartSelectedTest v12.12] Test "${config.title}" je neaktivní. Zobrazuji panel výběru.`);
        //     return;
        // }


        // Update UI for the selected test
        if(ui.currentTestTitle) ui.currentTestTitle.textContent = config.title;
        if(ui.testLevel) ui.testLevel.textContent = config.description.split('.')[0]; // Show first sentence of desc
        // Hide selector, show loader (questions will be loaded next)
        if (ui.testSelector) ui.testSelector.style.display = 'none';
        if (ui.testLoader) ui.testLoader.style.display = 'flex'; // Show loader
        if (ui.loaderSubtext) ui.loaderSubtext.textContent = 'Načítám otázky...';
        if (ui.testContainer) ui.testContainer.style.display = 'none';
        if (ui.resultsContainer) ui.resultsContainer.style.display = 'none';
        if (ui.reviewContainer) ui.reviewContainer.style.display = 'none';
        if (ui.testTimer) ui.testTimer.style.display = 'flex'; // Show timer area
        if (ui.prevBtn) ui.prevBtn.style.display = 'flex'; // Show nav buttons
        if (ui.nextBtn) ui.nextBtn.style.display = 'flex';


        history.pushState({ state: 'testInProgress' }, document.title, window.location.href); // Push state for test in progress
        loadTestQuestions(selectedTestType);
    }
    function handleBackButton(event) { const state = event.state ? event.state.state : null; const testIsRunning = ui.testContainer && ui.testContainer.style.display === 'block'; const resultsAreShown = ui.resultsContainer && ui.resultsContainer.style.display === 'block'; const reviewIsShown = ui.reviewContainer && ui.reviewContainer.style.display === 'block'; if (reviewIsShown) { ui.reviewContainer.style.display = 'none'; if (ui.resultsContainer) ui.resultsContainer.style.display = 'block'; } else if (testIsRunning && questions.length > 0) { if (!confirm('Opustit test? Postup nebude uložen.')) { history.pushState({ state: 'testInProgress' }, document.title, window.location.href); } else { stopTimer(); if (ui.testContainer) ui.testContainer.style.display = 'none'; if (ui.testLoader) ui.testLoader.style.display = 'none'; if (ui.testSelector) ui.testSelector.style.display = 'block'; if (ui.testTimer) ui.testTimer.style.display = 'none'; if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu'; applyTestHighlightingAndSelection(); } } else if (resultsAreShown) { if(ui.resultsContainer) ui.resultsContainer.style.display = 'none'; if (ui.testSelector) ui.testSelector.style.display = 'block'; if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu'; applyTestHighlightingAndSelection(); } else { console.log("Navigace zpět (výchozí chování nebo žádné otázky)."); applyTestHighlightingAndSelection(); if (ui.testSelector && getComputedStyle(ui.testSelector).display === 'none') { ui.testSelector.style.display = 'block'; } if (ui.testContainer && getComputedStyle(ui.testContainer).display !== 'none') { ui.testContainer.style.display = 'none'; } if (ui.testTimer && getComputedStyle(ui.testTimer).display !== 'none') { ui.testTimer.style.display = 'none'; } if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu'; } }
    // --- END: Test Flow & Back Button ---

    // --- START: App Initialization ---
    async function initializeApp() {
        console.log("🚀 [Init Test1 UI - Kyber v12.14] Starting..."); // Updated version log
        if (!initializeSupabase()) return;
        applyInitialSidebarState(); // Použít stav sidebaru

        // Check if TestLogic is available
        if (typeof window.TestLogic === 'undefined') {
            // If critical logic is missing, show a permanent error and stop.
            showErrorMessagePage("Kritická chyba: Chybí základní logika testu (test1-logic.js). Obnovte stránku.");
            return;
        }

        if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
        if (ui.mainContent) { ui.mainContent.style.display = 'none'; ui.mainContent.classList.remove('loaded'); } // Skrýt hlavní obsah dokud není vše připraveno

        try {
            // Authentication and Profile Fetching
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);

            if (!session || !session.user) {
                console.log('[Init Test1 UI - Kyber v12.12] Not logged in. Redirecting...');
                window.location.href = '/auth/index.html';
                return; // Stop further execution
            }
            currentUser = session.user;

            // Fetch titles and profile concurrently
            const titlesFetchResult = await fetchTitles(); // Fetch all titles first
            allTitles = titlesFetchResult || []; // Store them globally
            console.log(`[INIT v12.12] Loaded ${allTitles.length} titles.`);

            const profileResult = await fetchUserProfile(currentUser.id); // Then fetch profile
            if (profileResult) {
                currentProfile = profileResult;
            } else {
                // Try to create a default profile if none exists
                console.error("[INIT v12.12] Profile fetch failed or no data.");
                currentProfile = await createDefaultProfileIfNeeded(currentUser.id, currentUser.email);
                if (!currentProfile) {
                    showError("Nepodařilo se načíst nebo vytvořit profil. Zkuste obnovit stránku.", true);
                    if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => {if(ui.initialLoader) ui.initialLoader.style.display = 'none';}, 300); }
                    return; // Stop if profile still missing
                }
            }
            updateUserInfoUI(); // Update sidebar info

            // Determine mandatory test based on user's goal
            const userLearningGoal = currentProfile.learning_goal;
            console.log(`[Init v12.12] Cíl uživatele z profilu: '${userLearningGoal}'`);

            let testMainTitle = "Diagnostický test"; // Default title
            let testSubtitle = "Automatický výběr testu"; // Default subtitle

            // Initial UI setup AFTER profile and titles are loaded
            setupEventListeners();
            initTooltips();
            initMouseFollower();
            initHeaderScrollDetection();
            updateCopyrightYear();
            updateOnlineStatus();
            await fetchAndRenderNotifications(); // Load notifications

            setLoadingState('test', true); // Set loading state before checking completed tests

            // Determine which test is mandatory (if any) based on user's goal
            let mandatoryTestKey = null;
            if (userLearningGoal) {
                mandatoryTestKey = Object.keys(testTypeConfig).find(key => testTypeConfig[key].recommendedForGoal === userLearningGoal);
            }

            if (!userLearningGoal) {
                 // If no goal is set, show error and test selector, disable start button
                 showErrorMessagePage("Pro pokračování si nejprve nastavte studijní cíl ve svém profilu nebo na hlavní stránce Procvičování.", false);
                 if (ui.testSelector) ui.testSelector.style.display = 'block';
                 applyTestHighlightingAndSelection(); // This will disable non-relevant tests
                 if (ui.startSelectedTestBtnGlobal) {
                    ui.startSelectedTestBtnGlobal.disabled = true;
                    ui.startSelectedTestBtnGlobal.innerHTML = '<i class="fas fa-times-circle"></i> Nastavte cíl';
                 }
                 setLoadingState('test', false);
            } else if (mandatoryTestKey) {
                const config = testTypeConfig[mandatoryTestKey];
                testMainTitle = config.title; // Set title to the mandatory test
                testSubtitle = config.description.split('.')[0]; // Use first sentence of desc
                selectedTestType = mandatoryTestKey; // Pre-select the mandatory test

                // Highlight the mandatory test and disable others
                applyTestHighlightingAndSelection();

                // Check if this SPECIFIC mandatory test has already been completed
                const hasCompletedMandatoryTest = await checkSpecificTestCompleted(currentUser.id, config.identifier);
                setLoadingState('test', false); // Turn off loading after check

                if (hasCompletedMandatoryTest) {
                    console.log(`[Init v12.12] Cíl '${userLearningGoal}' a povinný test '${config.title}' již byl dokončen.`);
                    showErrorMessagePage(`Test "${config.title}" jste již absolvoval/a. Nelze jej opakovat. Vaše výsledky byly použity pro studijní plán.`, false);
                    // Add buttons to navigate away
                    const errorContainer = ui.globalError || ui.mainContent.querySelector('.error-message-container');
                    if(errorContainer){
                        const actionsDiv = document.createElement('div');
                        actionsDiv.style.marginTop = '1.5rem'; actionsDiv.style.display = 'flex'; actionsDiv.style.gap = '1rem'; actionsDiv.style.flexWrap = 'wrap'; actionsDiv.style.justifyContent = 'center';
                        actionsDiv.innerHTML = `<a href="plan.html" class="btn btn-primary"><i class="fas fa-tasks"></i> Zobrazit plán</a><a href="main.html" class="btn btn-secondary"><i class="fas fa-arrow-left"></i> Zpět na přehled</a>`;
                        errorContainer.appendChild(actionsDiv);
                    }
                    if(ui.testLevel) ui.testLevel.textContent = `Dokončeno (${config.title})`;
                    if (ui.testSelector) ui.testSelector.style.display = 'block'; // Keep selector visible
                } else {
                    console.log(`[Init v12.12] Cíl '${userLearningGoal}', povinný test '${config.title}' ještě nebyl dokončen. Zobrazuji panel výběru.`);
                    // Show the test selector so the user can manually start
                    if (ui.testSelector) ui.testSelector.style.display = 'block';
                    if (ui.testLoader) ui.testLoader.style.display = 'none';
                    if (ui.testContainer) ui.testContainer.style.display = 'none';
                    // No auto-start, user must click
                }
            } else {
                // Case where a goal is set, but no test is configured as "recommendedForGoal"
                setLoadingState('test', false);
                console.warn(`[Init v12.12] Povinný test nebyl určen pro cíl '${userLearningGoal}'. Zobrazuji panel výběru (všechny budou disabled).`);
                if(ui.testSelector) { ui.testSelector.style.display = 'block'; }
                applyTestHighlightingAndSelection(); // This will disable all tests if no match
                if(ui.testLoader) ui.testLoader.style.display = 'none';
                if(ui.testContainer) ui.testContainer.style.display = 'none';
                const h1TitleElem = document.querySelector('.dashboard-header h1');
                if (h1TitleElem) h1TitleElem.innerHTML = `<i class="fas fa-vial"></i> Testování // DIAGNOSTIKA`;
                if (ui.testLevel) ui.testLevel.textContent = "Chyba konfigurace testu pro cíl";
                if (ui.startSelectedTestBtnGlobal) {
                    ui.startSelectedTestBtnGlobal.disabled = true;
                    ui.startSelectedTestBtnGlobal.innerHTML = '<i class="fas fa-times-circle"></i> Chyba cíle';
                }
            }

            // Update main page title and subtitle (even if showing selector)
            if (ui.testLevel) ui.testLevel.textContent = testSubtitle;
            const h1TitleElem = document.querySelector('.dashboard-header h1');
            if (h1TitleElem) h1TitleElem.innerHTML = `<i class="fas fa-vial"></i> ${sanitizeHTML(testMainTitle)}`;


            // Hide initial loader and show main content
            if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }
            if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }

            console.log("✅ [Init Test1 UI - Kyber v12.14] Page initialized."); // Updated version log

        } catch (error) {
            console.error("❌ [Init Test1 UI - Kyber v12.12] Error:", error);
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">Chyba (${error.message}). Obnovte.</p>`; }
            else { showErrorMessagePage(`Chyba inicializace: ${error.message}`, true); }
            if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show main content to display error
            setLoadingState('all', false);
        }
    }

     async function createDefaultProfileIfNeeded(userId, email) {
        if (!supabase || !userId || !email) return null;
        console.log(`[Profile] Checking or creating default profile for ${userId}...`);
        try {
            // First, try to fetch an existing profile
            let { data: existingProfile, error: fetchError } = await supabase
                .from('profiles')
                .select('*') // Select all columns to ensure `preferences` is included
                .eq('id', userId)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: 0 rows
                // Some other error occurred during fetch
                throw fetchError;
            }

            if (existingProfile) {
                console.log("[Profile] Default profile already exists.");
                if (!existingProfile.preferences) existingProfile.preferences = {}; // Ensure preferences object exists
                return existingProfile;
            }

            // If no profile exists (PGRST116 or no data), create one
            console.log("[Profile] Creating new default profile...");
            const defaultUsername = email.split('@')[0]; // Basic username from email
            const defaultProfileData = {
                id: userId,
                username: defaultUsername,
                email: email,
                updated_at: new Date().toISOString(), // Set current timestamp
                // Default values for other fields as per your DB schema
                learning_goal: null, // Or a sensible default
                preferences: {}, // Start with empty preferences object
                points: 0,
                level: 1,
                completed_exercises: 0,
                streak_days: 0,
                longest_streak_days: 0,
                selected_title: null,
                avatar_url: null,
                first_name: null,
                last_name: null,
                // Add any other non-nullable fields with defaults
            };

            const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert(defaultProfileData)
                .select('*') // Select all to get the created profile back
                .single();

            if (insertError) {
                throw insertError;
            }
            console.log("[Profile] Default profile created successfully:", newProfile);
            if (!newProfile.preferences) newProfile.preferences = {}; // Ensure preferences for new profile
            return newProfile;

        } catch (error) {
            console.error('[Profile] Error in createDefaultProfileIfNeeded:', error);
            showToast('Kritická chyba Profilu', 'Nepodařilo se vytvořit výchozí profil.', 'error');
            return null;
        }
    }


    function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded."); } supabase = window.supabase.createClient('https://qcimhjjwvsbgjsitmvuh.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10'); if (!supabase) throw new Error("Supabase client creation failed."); console.log('[Supabase] Client initialized.'); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showErrorMessagePage("Kritická chyba: Nelze se připojit k databázi."); return false; } }

    // Spuštění aplikace
    initializeApp();

})();