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
// VERZE K ÚPRAVĚ (oprava ReferenceError, aktivace math_accelerate a math_explore):
// VERZE 12.15 (USER TASK): Отображение результатов пройденного теста и секции "Testy pro закрепления".
// VERZE 12.16 (USER FIX): Исправлена логика отображения секций в зависимости от пройденного обязательного теста.

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
    let testResultsData = null; // This will store the 'analysis' part of the completed test for review
    let diagnosticId = null; // ID of the saved user_diagnostics entry
    let selectedTestType = null; // e.g., 'full', 'math_review'
    let isLoading = { page: true, test: false, results: false, notifications: false, titles: false, reevaluation: {} };
    let allTitles = [];
	const SIDEBAR_STATE_KEY = 'sidebarCollapsedState';

    const testTypeConfig = {
        full: {
            questionsCount: 30,
            title: 'Příprava na Přijímačky',
            description: 'Podrobné hodnocení <strong>všech oblastí přijímaček</strong>, podobné reálnému testu. Poskytuje solidní základ pro studijní plán.',
            multiplier: 1.5,
            isCoreDiagnostic: true,
            identifier: 'exam_prep_full',
            recommendedForGoal: 'exam_prep',
            isActive: true
        },
        math_review: {
            questionsCount: 30,
            title: 'Opakování Matematiky',
            description: 'Test zaměřený na <strong>doplnění mezer v základních tématech</strong> a upevnění znalostí z matematiky ZŠ.',
            multiplier: 1.0,
            isCoreDiagnostic: true,
            identifier: 'math_review_standard',
            recommendedForGoal: 'math_review',
            isActive: true
        },
        math_accelerate: {
            questionsCount: 30,
            title: 'Učení Napřed',
            description: 'Otestujte své znalosti v <strong>pokročilejších tématech</strong> a připravte se na budoucí výzvy.',
            multiplier: 1.2,
            isCoreDiagnostic: false,
            isActive: true,
            identifier: 'math_accelerate_preview',
            recommendedForGoal: 'math_accelerate'
        },
        math_explore: {
            questionsCount: 30,
            title: 'Volné Prozkoumávání',
            description: 'Test zaměřený na <strong>různorodá témata dle vašeho výběru</strong> pro rozšíření obzorů.',
            multiplier: 1.0,
            isCoreDiagnostic: false,
            isActive: true,
            identifier: 'math_explore_sampler',
            recommendedForGoal: 'math_explore'
        }
    };

    const topicIcons = {
        "Algebra": "fa-square-root-alt",
        "Aritmetika": "fa-calculator",
        "Geometrie": "fa-draw-polygon",
        "Logika": "fa-brain",
        "Logické úlohy": "fa-brain",
        "Statistika": "fa-chart-bar",
        "Čísla a aritmetické operace": "fa-calculator",
        "Práce s daty": "fa-chart-bar",
        "Problémové úlohy": "fa-lightbulb",
        "Proporce a procenta": "fa-percentage",
        "default": "fa-book"
    };
    const activityVisuals = {
        test: { icon: 'fa-vial', class: 'test' },
        exercise: { icon: 'fa-pencil-alt', class: 'exercise' },
        badge: { icon: 'fa-medal', class: 'badge' },
        diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' },
        lesson: { icon: 'fa-book-open', class: 'lesson' },
        plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' },
        level_up: { icon: 'fa-level-up-alt', class: 'level_up' },
        other: { icon: 'fa-info-circle', class: 'other' },
        default: { icon: 'fa-check-circle', class: 'default' }
    };

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
        markAllReadBtn: document.getElementById('mark-all-read-btn'),
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
        reviewItemTemplate: document.getElementById('review-item-template'),
        // NEW UI Elements
        completedTestSummaryContainer: document.getElementById('completed-test-summary-container'),
        completedTestTitleSummary: document.getElementById('completed-test-title-summary'),
        summaryScore: document.getElementById('summary-score'),
        summaryPercentage: document.getElementById('summary-percentage'),
        summaryCorrect: document.getElementById('summary-correct'),
        summaryIncorrect: document.getElementById('summary-incorrect'),
        summaryTime: document.getElementById('summary-time'),
        summaryReviewAnswersBtn: document.getElementById('summary-review-answers-btn'),
        reinforcementTestsSection: document.getElementById('reinforcement-tests-section')
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
        if (ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'none';
        if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none';


        const retryButtonHTML = showRetryButton ? `<button class="btn btn-primary" style="margin-top:1.5rem;" onclick="location.reload()"><i class="fas fa-redo"></i> Zkusit znovu</button>` : '';
        const infoTitle = message.includes("Test již byl dokončen") || message.includes("Nejsou k dispozici žádné vhodné otázky") || message.includes("Otázky pro tento test budou brzy doplněny");

        if (ui.globalError) {
             ui.globalError.innerHTML = `<div class="error-message"><i class="fas ${infoTitle ? 'fa-info-circle' : 'fa-exclamation-triangle'}"></i><div>${sanitizeHTML(message)}</div>${retryButtonHTML}</div>`;
             ui.globalError.style.display = 'block';
        } else if (ui.mainContent) {
            const mainContentWrapper = document.querySelector('.main-content-wrapper');
            if (mainContentWrapper) {
                 mainContentWrapper.innerHTML = `<div class="section error-message-container" style="margin-top: 2rem; text-align:center;"><i class="fas ${infoTitle ? 'fa-info-circle' : 'fa-exclamation-triangle'}" style="font-size: 2.5rem; color: ${infoTitle ? 'var(--accent-primary)' : 'var(--accent-pink)' }; margin-bottom: 1rem;"></i><div class="loader-text" style="font-size: 1.5rem; color: ${infoTitle ? 'var(--accent-primary)' : 'var(--accent-pink)' };">${infoTitle ? "Informace" : "Chyba!"}</div><div class="loader-subtext" style="font-size: 1rem;">${sanitizeHTML(message)}</div>${retryButtonHTML}</div>`;
            } else {
                 document.body.innerHTML = `<div style='padding: 2rem; color: ${infoTitle ? 'var(--text-light)' : 'red'}; text-align:center;'><h1>${infoTitle ? "Informace" : "Chyba"}</h1><p>${sanitizeHTML(message)}</p>${retryButtonHTML}</div>`;
            }
        } else {
            document.body.innerHTML = `<div style='padding: 2rem; color: ${infoTitle ? 'var(--text-light)' : 'red'}; text-align:center;'><h1>${infoTitle ? "Informace" : "Chyba"}</h1><p>${sanitizeHTML(message)}</p>${retryButtonHTML}</div>`;
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
            // Placeholder
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
    // --- END: Helper Functions ---

    // --- START: Event Listeners Setup ---
    function setupEventListeners() {
        console.log("[SETUP v12.16] Nastavování posluchačů událostí...");
        if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
        if (ui.sidebarToggleBtn) ui.sidebarToggleBtn.addEventListener('click', toggleSidebar);

        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); });
        });
        if (ui.prevBtn) ui.prevBtn.addEventListener('click', () => { if (questions.length > 0 && currentQuestionIndex > 0) showQuestion(currentQuestionIndex - 1); });
        if (ui.nextBtn) ui.nextBtn.addEventListener('click', () => { if (questions.length > 0 && currentQuestionIndex < questions.length - 1) showQuestion(currentQuestionIndex + 1); });
        if (ui.finishBtn) {
            ui.finishBtn.addEventListener('click', async () => {
                if (questions.length === 0) {
                    if(ui.testContainer) ui.testContainer.style.display = 'none';
                    if(ui.testTimer) ui.testTimer.style.display = 'none';
                    // Pokud nejsou otázky, vrátíme se na výběr, ale shrnutí se už nezobrazuje.
                    // Místo toho by se měla zobrazit hlavní obrazovka výběru, pokud to není error.
                    if(ui.testSelector) ui.testSelector.style.display = 'block';
                    if(ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'none';
                    if(ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'block'; // Zde by se mělo zobrazit
                    if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu';
                    applyTestHighlightingAndSelection();
                    history.replaceState({ state: 'testSelection' }, document.title, window.location.href);
                    return;
                }
                const unansweredCount = userAnswers.filter(a => a && a.userAnswerValue === null).length;
                let confirmFinish = true;
                if (unansweredCount > 0) {
                    confirmFinish = confirm(`Nezodpověděli jste ${unansweredCount} ${unansweredCount === 1 ? 'otázku' : (unansweredCount < 5 ? 'otázky' : 'otázek')}. Přesto dokončit?`);
                } else {
                    confirmFinish = confirm('Opravdu chcete dokončit test?');
                }
                if (confirmFinish) { await finishTest(); }
            });
        }
        if (ui.retryBtn) { // Tlačítko "Zkusit jiný test" na stránce výsledků testu
            ui.retryBtn.addEventListener('click', () => {
                ui.resultsContainer.style.display = 'none';
                ui.reviewContainer.style.display = 'none';
                if (ui.testSelector) ui.testSelector.style.display = 'block';
                if (ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'none';
                if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none'; // Skryjeme, dokud není jasné, co se má zobrazit

                questions = []; userAnswers = []; testResultsData = {}; diagnosticId = null; selectedTestType = null;
                if(ui.lowScoreMessageContainer) ui.lowScoreMessageContainer.innerHTML = '';
                if (ui.continueBtn) { ui.continueBtn.disabled = true; ui.continueBtn.removeAttribute('data-save-error'); }
                if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu';
                applyTestHighlightingAndSelection(); // Toto by mělo znovu nastavit viditelnost testSelectoru
                if (ui.startSelectedTestBtnGlobal) {
                    ui.startSelectedTestBtnGlobal.disabled = true;
                    ui.startSelectedTestBtnGlobal.innerHTML = '<i class="fas fa-play-circle"></i> Vyberte Test';
                }
                history.replaceState({ state: 'testSelection' }, document.title, window.location.href);
            });
        }
        if (ui.summaryReviewAnswersBtn) {
            const oldListenerSummary = ui.summaryReviewAnswersBtn._reviewClickListener;
            if (oldListenerSummary) ui.summaryReviewAnswersBtn.removeEventListener('click', oldListenerSummary);

            const newListenerSummary = () => {
                if(testResultsData) { // `testResultsData` by mělo být nastaveno v `initializeApp`, když se načte shrnutí
                    if (ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'none';
                    if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none';
                    displayReview(); // Zobrazí review pro tento dokončený test
                    history.pushState({ state: 'reviewCompletedTest' }, document.title, window.location.href);
                } else {
                    showToast("Chyba", "Data výsledků testu nejsou k dispozici pro zobrazení odpovědí.", "error");
                }
            };
            ui.summaryReviewAnswersBtn.addEventListener('click', newListenerSummary);
            ui.summaryReviewAnswersBtn._reviewClickListener = newListenerSummary;
        }
        if (ui.continueBtn) {
            ui.continueBtn.addEventListener('click', () => { if (!ui.continueBtn.disabled) window.location.href = `/dashboard/procvicovani/plan.html`; });
        }
        if (ui.reviewAnswersBtn) ui.reviewAnswersBtn.addEventListener('click', displayReview); // Tlačítko na standardní stránce výsledků
        if (ui.backToResultsBtn) ui.backToResultsBtn.addEventListener('click', () => {
            if(ui.reviewContainer) ui.reviewContainer.style.display = 'none';
            // Rozhodnutí, kam se vrátit: na shrnutí nebo na standardní výsledky
            if (ui.completedTestSummaryContainer && getComputedStyle(ui.completedTestSummaryContainer).display === 'block') {
                // Pokud je shrnutí viditelné, znamená to, že jsme z něj šli do review
                // Nicméně, displayReview skryje shrnutí. Takže zpět na standardní výsledky, pokud byly předtím.
                // Nebo spíše, pokud jsme v review z `completedTestSummary`, tak zpět na něj.
                // Toto potřebuje úpravu v `handleBackButton` a možná `displayReview`
                ui.completedTestSummaryContainer.style.display = 'block';
                if(ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'block';

            } else if(ui.resultsContainer) {
                 ui.resultsContainer.style.display = 'block';
                 if(ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'block';
            }
            if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        });

        document.querySelectorAll('.btn-start-test-in-card').forEach(button => {
            const oldListener = button._startTestInCardListener;
            if (oldListener) {
                button.removeEventListener('click', oldListener);
            }
            const newListener = function(event) {
                event.stopPropagation();
                const card = this.closest('.test-type-card');
                if (card.classList.contains('disabled-test') && !card.classList.contains('recommended-test')) {
                    showToast("Test není určen pro váš cíl", "Tento typ testu není určen pro váš aktuální studijní cíl.", "info");
                    return;
                }
                const testType = this.dataset.testType;
                const config = testTypeConfig[testType];

                if (config && config.isActive === false) {
                    showToast("Již brzy!", `Test "${config.title}" bude brzy dostupný.`, "info");
                    return;
                }
                selectedTestType = testType;
                startSelectedTest();
            };
            button.addEventListener('click', newListener);
            button._startTestInCardListener = newListener;
        });

        if (ui.startSelectedTestBtnGlobal) {
             const oldListener = ui.startSelectedTestBtnGlobal._globalStartListener;
             if (oldListener) {
                 ui.startSelectedTestBtnGlobal.removeEventListener('click', oldListener);
             }
             const newListener = () => {
                 if (selectedTestType && !ui.startSelectedTestBtnGlobal.disabled) {
                     startSelectedTest();
                 } else if (!selectedTestType) {
                     showToast('Chyba', 'Povinný test nebyl správně určen.', 'error');
                 } else {
                     const config = testTypeConfig[selectedTestType];
                     if (config && config.isActive === false) {
                         showToast("Již brzy!", `Test "${config.title}" bude brzy dostupný.`, "info");
                     }
                 }
             };
             ui.startSelectedTestBtnGlobal.addEventListener('click', newListener);
             ui.startSelectedTestBtnGlobal._globalStartListener = newListener;
        }

        window.addEventListener('popstate', handleBackButton);
        window.addEventListener('resize', () => { if (window.innerWidth <= 992 && ui.sidebar?.classList.contains('active')) closeMenu(); });
        if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
        if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsReadUI); }
        if (ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { await markNotificationReadUI(notificationId); } if (link) window.location.href = link; } }); }
        document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } });
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        console.log("[SETUP v12.16] Posluchači událostí nastaveni.");
    }
    // --- END: Event Listeners Setup ---

    // --- START: Data Fetching Wrappers (using TestLogic) ---
    async function fetchUserProfile(userId) {
        if (!supabase || !userId) return null;
        console.log(`[Profile] Fetching profile for user ID: ${userId}`);
        setLoadingState('titles', true);
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*, selected_title, preferences, longest_streak_days, learning_goal') // Ensure learning_goal is selected
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (!profile) {
                console.warn(`[Profile] Profile not found for user ${userId}.`);
                return null;
            }
            if (!profile.preferences) profile.preferences = {};
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
        try {
            const { data, error } = await supabase
                .from('title_shop')
                .select('title_key, name');

            if (error) {
                console.error("[Titles] Error from Supabase:", error);
                throw error;
            }
            console.log("[Titles] Fetched titles:", data);
            return data || [];
        } catch (error) {
            console.error("[Titles] Catch block error fetching titles:", error.message);
            showToast("Chyba", "Nepodařilo se načíst dostupné tituly.", "error");
            return [];
        }
    }
    // MODIFIED: checkSpecificTestCompleted
    async function checkSpecificTestCompleted(userId, testIdentifierToFind) {
        setLoadingState('test', true);
        if (ui.loaderSubtext) ui.loaderSubtext.textContent = 'Kontroluji předchozí testy...';
        try {
            if (!userId || !supabase) {
                console.warn("[checkSpecificTestCompleted] Chybí ID uživatele nebo Supabase klient.");
                return null;
            }
            console.log(`[checkSpecificTestCompleted v12.16] Hledám test pro user: ${userId} s identifikátorem: ${testIdentifierToFind}`);

            const { data: existingTests, error } = await supabase
                .from('user_diagnostics')
                .select('id, completed_at, analysis, answers') // answers is needed for review
                .eq('user_id', userId)
                .order('completed_at', { ascending: false });

            if (error) {
                console.error(`[checkSpecificTestCompleted v12.16] Chyba při dotazu na user_diagnostics:`, error);
                throw error;
            }

            if (existingTests && existingTests.length > 0) {
                const completedTest = existingTests.find(test =>
                    test.analysis &&
                    test.analysis.summary &&
                    test.analysis.summary.test_type_identifier === testIdentifierToFind
                );

                if (completedTest) {
                    console.log(`[checkSpecificTestCompleted v12.16] Nalezen dokončený test s identifikátorem '${testIdentifierToFind}'. Data:`, completedTest);
                    return completedTest; // Vrací celý objekt testu
                }
                console.log(`[checkSpecificTestCompleted v12.16] Nalezeny testy (${existingTests.length}), ale žádný neodpovídá identifikátoru '${testIdentifierToFind}' v analýze.`);
            }
            return null;
        } catch (err) {
            console.error("Error in checkSpecificTestCompleted:", err);
            showToast("Chyba při kontrole historie testů.", "error");
            return null;
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
            console.log(`[UI LoadQ v12.16] Volání TestLogic.loadTestQuestions s profilem (Cíl: ${currentProfile.learning_goal}, TestTyp: ${testType})`);
            questions = await window.TestLogic.loadTestQuestions(supabase, currentProfile, testTypeConfig);
            console.log(`[UI LoadQ v12.16] Obdrženo ${questions.length} otázek z logiky.`);
            initializeTest();

        } catch (error) {
            console.error('[UI] Error loading questions:', error);
            questions = [];
            initializeTest();
            showToast("Chyba při načítání otázek", error.message, "error");
        } finally {
             setLoadingState('test', false);
        }
    }
    // --- END: Data Fetching Wrappers ---

    // --- START: Test Logic UI ---
    function initializeTest() {
        if (!questions) {
            questions = [];
        }
        if (ui.testLoader) ui.testLoader.style.display = 'none';
        if (ui.testContainer) ui.testContainer.style.display = 'block';
        if (ui.resultsContainer) ui.resultsContainer.style.display = 'none';
        if (ui.reviewContainer) ui.reviewContainer.style.display = 'none';
        if (ui.testSelector) ui.testSelector.style.display = 'none';
        if (ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'none';
        if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none';


        if (ui.testTimer) ui.testTimer.style.display = 'flex';
        currentQuestionIndex = (questions.length > 0) ? 0 : -1;
        if (questions.length > 0) {
            userAnswers = questions.map((q) => ({
                question_db_id: q.id, question_number_in_test: q.question_number,
                question_text: q.question_text, question_type: q.question_type,
                options: q.options, correct_answer: q.correct_answer,
                solution_explanation: q.solution_explanation, image_url: q.image_url,
                topic_id: q.topic_id, topic_name: q.topic_name,
                subtopic_id: q.subtopic_id, subtopic_name: q.subtopic_name,
                difficulty: q.difficulty, answer_prefix: q.answer_prefix, answer_suffix: q.answer_suffix,
                userAnswerValue: null, scoreAwarded: null, maxScore: q.maxScore || 1,
                checked_by: null, correctness: null, reasoning: null, error_analysis: null, feedback: null
            }));
            startTimer();
        } else {
            userAnswers = [];
            stopTimer();
            if(ui.timerValue) ui.timerValue.textContent = formatTime(0);
        }
        testTime = 0;
        if(ui.timerValue && questions.length > 0) ui.timerValue.textContent = formatTime(testTime);
        if(ui.answeredCountEl) ui.answeredCountEl.textContent = '0';
        if(ui.lowScoreMessageContainer) ui.lowScoreMessageContainer.innerHTML = '';
        createPagination();
        showQuestion(currentQuestionIndex);
        updateProgressBar();
        updateNavigationButtons();
        requestAnimationFrame(() => { if (ui.testContainer) { ui.testContainer.setAttribute('data-animate', ''); ui.testContainer.style.setProperty('--animation-order', 0); } });
        setLoadingState('test', false);
        console.log(`[InitializeTest v12.16] Test initialized. Questions: ${questions.length}, CurrentIndex: ${currentQuestionIndex}`);
    }
    function startTimer() { if(timer)clearInterval(timer); testStartTime=new Date(); testTime=0; if(ui.timerValue) ui.timerValue.textContent=formatTime(testTime); ui.testTimer?.classList.remove('timer-warning','timer-danger'); timer=setInterval(()=>{testTime++; if(ui.timerValue) ui.timerValue.textContent=formatTime(testTime); const config=testTypeConfig[selectedTestType]; if(!config)return; const estimatedTime=(questions.length > 0 ? questions.length : testTypeConfig[selectedTestType]?.questionsCount || 20)*1.5*60; const warningTime=estimatedTime*0.8; if(testTime>estimatedTime){ui.testTimer?.classList.add('timer-danger'); ui.testTimer?.classList.remove('timer-warning');}else if(testTime>warningTime){ui.testTimer?.classList.add('timer-warning'); ui.testTimer?.classList.remove('timer-danger');}},1000); }
    function stopTimer() { clearInterval(timer); timer = null; testEndTime = new Date(); }
    function showQuestion(index) {
        if (!ui.questionContainer) { console.error("[ShowQuestion v12.16] Question container not found."); return; }
        if (questions.length === 0 || index < 0) {
            console.log("[ShowQuestion v12.16] No questions available or invalid index. Displaying no questions message.");
            let message = "Pro tento typ testu zatím nejsou k dispozici žádné otázky. Zkuste to prosím později, nebo vyberte jiný typ testu.";
            if (selectedTestType === 'math_accelerate' || selectedTestType === 'math_explore') {
                message = "Otázky pro tento test budou brzy doplněny. Děkujeme za trpělivost!";
            }
            ui.questionContainer.innerHTML = `<div class="loading-placeholder" style="text-align:center; padding: 3rem 1rem; color: var(--text-light); background-color: rgba(var(--card-solid-rgb), 0.7); border-radius: var(--card-radius);"> <i class="fas fa-box-open" style="font-size: 3em; margin-bottom: 1rem; color: var(--accent-secondary);"></i> <p style="font-size: 1.2em; font-weight: 500;">${message}</p> </div>`;
            if(ui.questionCountEl) ui.questionCountEl.textContent = `0 / 0`;
            currentQuestionIndex = -1;
            updatePagination();
            updateNavigationButtons();
            return;
        }
        const question = questions[index]; console.log(`Zobrazuji Q#${index + 1} (Typ: ${question.question_type})`, question); currentQuestionIndex = index;
        if(ui.questionCountEl) ui.questionCountEl.textContent = `${index + 1} / ${questions.length}`;
        let questionHTML = `<div class="question-header"><span class="question-number">${question.question_number}</span><div class="question-text">${sanitizeHTML(question.question_text)}</div></div>`;
        if (question.image_url) { questionHTML += `<div class="question-image-container"><img class="question-image" src="${question.image_url}" alt="Obrázek k otázce ${question.question_number}" loading="lazy"></div>`; }
        const userAnswerData = userAnswers[index]; const savedValue = userAnswerData ? userAnswerData.userAnswerValue : null; let answerInputHTML = '';
        switch (question.question_type) {
            case 'multiple_choice': answerInputHTML += `<div class="answer-options">`; const optionsData = question.options; if (!Array.isArray(optionsData)) { console.error("Options nejsou pole pro MC:", question.id, optionsData); answerInputHTML += `<div style='color:var(--accent-pink);font-weight:bold;'>Chyba: Formát možností není pole stringů.</div>`; } else if (optionsData.length === 0) { console.warn("Chybí možnosti pro MC:", question.id); answerInputHTML += `<div style='color:var(--accent-orange);'>Varování: Chybí možnosti odpovědí.</div>`; } else { optionsData.forEach((optionText, idx) => { const optionLetter = indexToLetter(idx); const isSelected = savedValue === optionLetter; const displayText = (typeof optionText === 'string' || typeof optionText === 'number') ? sanitizeHTML(optionText) : `(neplatný text ${idx+1})`; answerInputHTML += `<label class="answer-option ${isSelected ? 'selected' : ''}" data-option-id="${optionLetter}"><input type="radio" name="question_${question.id || index}" value="${optionLetter}" ${isSelected ? 'checked' : ''} style="display: none;"><div class="answer-text"><span class="answer-letter">${optionLetter}.</span> ${displayText}</div></label>`; }); } answerInputHTML += `</div>`; break;
            case 'construction': answerInputHTML += `<div class="answer-input-container"><label for="construction-answer-${index}" class="form-label">Popište svůj postup:</label><textarea id="construction-answer-${index}" class="construction-textarea" placeholder="Podrobně popište kroky...">${sanitizeHTML(savedValue || '')}</textarea></div>`; break;
            case 'numeric': case 'text': let prefixData = null; let suffixData = question.answer_suffix || null; let isMultiPart = false; let multiPartKeys = []; if (question.answer_prefix && typeof question.answer_prefix === 'string') { try { const parsedPrefix = JSON.parse(question.answer_prefix); if (typeof parsedPrefix === 'object' && parsedPrefix !== null && !Array.isArray(parsedPrefix)) { prefixData = parsedPrefix; isMultiPart = true; multiPartKeys = Object.keys(prefixData); } else { prefixData = question.answer_prefix; } } catch (e) { prefixData = question.answer_prefix; } } else if (question.answer_prefix && typeof question.answer_prefix === 'object' && !Array.isArray(question.answer_prefix)) { prefixData = question.answer_prefix; isMultiPart = true; multiPartKeys = Object.keys(prefixData); } else if (question.answer_prefix) { prefixData = String(question.answer_prefix); } answerInputHTML += `<div class="answer-input-container">`; if (isMultiPart && multiPartKeys.length > 0) { answerInputHTML += `<label class="form-label">Vaše odpovědi:</label>`; multiPartKeys.forEach(partKey => { const partPrefixText = prefixData[partKey] || ''; const partSavedValue = (typeof savedValue === 'object' && savedValue !== null) ? (savedValue[partKey] || '') : ''; answerInputHTML += `<div class="answer-input-group multi-part-answer-group">`; if (partPrefixText) { answerInputHTML += `<span class="answer-prefix">${sanitizeHTML(partPrefixText)}</span>`; } answerInputHTML += `<input type="${question.question_type === 'numeric' ? 'number' : 'text'}" id="text-answer-${index}-part-${partKey}" class="answer-input multi-part-input" data-part-key="${partKey}" placeholder="Odpověď pro ${partKey}" value="${sanitizeHTML(partSavedValue)}">`; answerInputHTML += `</div>`; }); } else { answerInputHTML += `<label for="text-answer-${index}" class="form-label">Vaše odpověď:</label>`; answerInputHTML += `<div class="answer-input-group">`; if (prefixData && typeof prefixData === 'string') { answerInputHTML += `<span class="answer-prefix">${sanitizeHTML(prefixData)}</span>`; } answerInputHTML += `<input type="${question.question_type === 'numeric' ? 'number' : 'text'}" id="text-answer-${index}" class="answer-input" placeholder="Zadejte odpověď" value="${sanitizeHTML(savedValue || '')}">`; if (suffixData) { answerInputHTML += `<span class="answer-suffix">${sanitizeHTML(suffixData)}</span>`; } answerInputHTML += `</div>`; } answerInputHTML += `</div>`; break;
            default: answerInputHTML += `<div class="answer-input-container"><label for="text-answer-${index}" class="form-label">Vaše odpověď (Neznámý typ otázky):</label><input type="text" id="text-answer-${index}" class="answer-input" placeholder="Zadejte odpověď" value="${sanitizeHTML(savedValue || '')}"></div>`; break;
        }
        questionHTML += answerInputHTML; ui.questionContainer.innerHTML = questionHTML;
        const textInputs = ui.questionContainer.querySelectorAll('.answer-input'); const constructionInput = ui.questionContainer.querySelector('.construction-textarea');
        textInputs.forEach(input => { input.addEventListener('input', (event) => { if (input.classList.contains('multi-part-input')) { const partKey = event.target.dataset.partKey; let currentMultiAnswer = (typeof userAnswers[index].userAnswerValue === 'object' && userAnswers[index].userAnswerValue !== null) ? { ...userAnswers[index].userAnswerValue } : {}; currentMultiAnswer[partKey] = event.target.value; saveAnswer(index, currentMultiAnswer); } else { saveAnswer(index, event.target.value); } }); });
        if (constructionInput) { constructionInput.addEventListener('input', (event) => { saveAnswer(index, event.target.value); }); }
        ui.questionContainer.querySelectorAll('.answer-option').forEach(label => { label.addEventListener('click', handleAnswerSelection); });
        updatePagination(); updateNavigationButtons();
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { try { setTimeout(() => { window.MathJax.typesetPromise([ui.questionContainer]).catch(e=>console.error("MathJax typesetting error:", e)); }, 0); } catch(e) { console.error("MathJax initialization error:", e); } }
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
                ui.finishBtn.style.display = 'flex';
                ui.finishBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Zpět na výběr';
                ui.finishBtn.disabled = isLoading.results;
            } else {
                ui.finishBtn.style.display = currentQuestionIndex === questions.length - 1 ? 'flex' : 'none';
                ui.finishBtn.disabled = isLoading.results;
                ui.finishBtn.innerHTML = isLoading.results ? '<i class="fas fa-spinner fa-spin"></i> Vyhodnocuji...' : '<i class="fas fa-check-circle"></i> Dokončit test';
            }
        }
    }
    function updateProgressBar() {
        if (!ui.progressBar) return;
        const answeredCount = userAnswers.filter(a => { if (!a) return false; if (typeof a.userAnswerValue === 'object' && a.userAnswerValue !== null) { return Object.values(a.userAnswerValue).some(part => part !== null && String(part).trim() !== ''); } return a.userAnswerValue !== null && String(a.userAnswerValue).trim() !== ''; }).length;
        const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
        ui.progressBar.style.width = `${progress}%`;
        if(ui.answeredCountEl) ui.answeredCountEl.textContent = answeredCount;
    }
    function saveAnswer(qIndex, userAnswerValue) {
        if (qIndex < 0 || qIndex >= userAnswers.length) { console.error(`Chyba: Neplatný index otázky ${qIndex} pro uložení odpovědi.`); return; }
        if (!userAnswers[qIndex]) { console.error(`Chyba: Chybí objekt odpovědi pro index ${qIndex}`); return; }
        let wasAnsweredBefore = false; const previousAnswer = userAnswers[qIndex].userAnswerValue;
        if (typeof previousAnswer === 'object' && previousAnswer !== null) { wasAnsweredBefore = Object.values(previousAnswer).some(part => part !== null && String(part).trim() !== ''); }
        else { wasAnsweredBefore = previousAnswer !== null && String(previousAnswer).trim() !== ''; }
        let isCurrentAnswerEmpty = false;
        if (typeof userAnswerValue === 'object' && userAnswerValue !== null) { isCurrentAnswerEmpty = Object.values(userAnswerValue).every(part => part === null || String(part).trim() === ''); }
        else { isCurrentAnswerEmpty = userAnswerValue === null || String(userAnswerValue).trim() === ''; }
        userAnswers[qIndex].userAnswerValue = isCurrentAnswerEmpty ? null : userAnswerValue;
        let isAnsweredNow = false; const currentSavedAnswer = userAnswers[qIndex].userAnswerValue;
        if (typeof currentSavedAnswer === 'object' && currentSavedAnswer !== null) { isAnsweredNow = Object.values(currentSavedAnswer).some(part => part !== null && String(part).trim() !== ''); }
        else { isAnsweredNow = currentSavedAnswer !== null && String(currentSavedAnswer).trim() !== ''; }
        if (wasAnsweredBefore !== isAnsweredNow) { updateProgressBar(); updatePagination(); }
        console.log(`Odpověď uložena Q#${qIndex + 1}:`, userAnswers[qIndex].userAnswerValue);
    }
    // --- END: Test Logic UI ---

    // --- START: Evaluation & Results UI ---
    async function evaluateAnswersUI() {
        if (questions.length === 0) { console.log("[EvaluateAnswersUI] Žádné otázky k vyhodnocení."); return; }
        console.log("Spouštím vyhodnocení odpovědí (UI)..."); showGeminiOverlay(true); const promises = [];
        for (let i = 0; i < questions.length; i++) {
            const qData = questions[i]; const answerData = userAnswers[i];
            if (!answerData) { console.error(`Chyba: Nenalezen objekt odpovědi pro index ${i} (UI)`); continue; }
            let isSkippedOrEmpty = false;
            if (answerData.userAnswerValue === null) { isSkippedOrEmpty = true; }
            else if (typeof answerData.userAnswerValue === 'object') { isSkippedOrEmpty = Object.values(answerData.userAnswerValue).every(val => val === null || String(val).trim() === ''); }
            else { isSkippedOrEmpty = String(answerData.userAnswerValue).trim() === ''; }
            if (isSkippedOrEmpty) { answerData.scoreAwarded = 0; answerData.correctness = "skipped"; answerData.reasoning = "Otázka byla přeskočena nebo odpověď byla prázdná."; answerData.error_analysis = null; answerData.feedback = "Příště zkuste odpovědět."; answerData.checked_by = 'skipped'; console.log(`Q#${i+1} (${qData.question_type}) přeskočeno/prázdné (UI).`); promises.push(Promise.resolve()); continue; }
            promises.push( window.TestLogic.checkAnswerWithGemini( qData.question_type, qData.question_text, qData.correct_answer, answerData.userAnswerValue, answerData.maxScore, i, qData.solution_explanation, qData.options ).then(evaluationResult => { userAnswers[i].scoreAwarded = evaluationResult.score; userAnswers[i].correctness = evaluationResult.correctness; userAnswers[i].reasoning = evaluationResult.reasoning; userAnswers[i].error_analysis = evaluationResult.error_analysis; userAnswers[i].feedback = evaluationResult.feedback; userAnswers[i].checked_by = evaluationResult.correctness === 'error' || evaluationResult.reasoning.includes("fallback") ? 'fallback_scored' : 'gemini_scored'; console.log(`Q#${i+1} (${qData.question_type}) vyhodnoceno (UI): Skóre ${evaluationResult.score}/${answerData.maxScore}, Správnost: ${evaluationResult.correctness}`); }).catch(error => { console.error(`Chyba vyhodnocení pro Q#${i+1} (UI):`, error); userAnswers[i].scoreAwarded = 0; userAnswers[i].correctness = 'error'; userAnswers[i].reasoning = `Automatické hodnocení selhalo: ${error.message}`; userAnswers[i].error_analysis = "Chyba systému hodnocení."; userAnswers[i].feedback = "Kontaktujte podporu, pokud problém přetrvává."; userAnswers[i].checked_by = 'error'; }) );
        }
        await Promise.all(promises); showGeminiOverlay(false); console.log("Vyhodnocení odpovědí dokončeno (UI):", userAnswers);
    }
    function displayResults() { if(!ui.testContainer || !ui.resultsContainer || !ui.reviewContainer || !ui.testTimer || !ui.testLevel || !ui.resultScoreEl || !ui.resultPercentageEl || !ui.resultCorrectEl || !ui.resultIncorrectEl || !ui.resultTimeEl || !ui.lowScoreMessageContainer || !ui.continueBtn || !ui.topicResultsEl || !ui.reviewAnswersBtn || !ui.backToResultsBtn) { console.error("Chyba: Některé elementy výsledků nebyly nalezeny v DOM."); return; } if (!testResultsData) { console.error("Chyba: Chybí data výsledků (testResultsData)."); showErrorMessagePage("Nepodařilo se zobrazit výsledky - chybí data."); return; } ui.testContainer.style.display = 'none'; ui.resultsContainer.style.display = 'block'; ui.reviewContainer.style.display = 'none'; ui.testTimer.style.display = 'none'; if(ui.testLevel) ui.testLevel.textContent = 'Výsledky testu'; if(ui.resultScoreEl) ui.resultScoreEl.textContent = `${testResultsData.score}/50`; if(ui.resultPercentageEl) ui.resultPercentageEl.textContent = `${testResultsData.percentage}%`; if(ui.resultCorrectEl) ui.resultCorrectEl.textContent = testResultsData.correctAnswers; if(ui.resultIncorrectEl) ui.resultIncorrectEl.textContent = testResultsData.incorrectAnswers + testResultsData.partiallyCorrectAnswers; if(ui.resultTimeEl) ui.resultTimeEl.textContent = formatTime(testResultsData.timeSpent); ui.lowScoreMessageContainer.innerHTML = ''; ui.continueBtn.disabled = true; const saveError = ui.continueBtn.getAttribute('data-save-error') === 'true'; const scoreThreshold = window.TestLogic?.SCORE_THRESHOLD_FOR_SAVING ?? 5; if (saveError) { ui.lowScoreMessageContainer.innerHTML = `<div class="error-message-container"><i class="fas fa-exclamation-triangle"></i><div class="loader-text">Chyba ukládání</div><div class="loader-subtext">Nepodařilo se uložit výsledky testu. Studijní plán nelze vytvořit.</div></div>`; } else if (testResultsData.score < scoreThreshold) { ui.lowScoreMessageContainer.innerHTML = `<div class="low-score-message warning"><i class="fas fa-exclamation-circle"></i><strong>Výsledek nebyl uložen.</strong><br>Vaše skóre (${testResultsData.score}/50) je nižší než ${scoreThreshold} bodů. Tyto výsledky nebudou použity pro generování studijního plánu.</div>`; } else { ui.lowScoreMessageContainer.innerHTML = `<div class="low-score-message info"><i class="fas fa-info-circle"></i><strong>Výsledky byly uloženy.</strong><br>Vaše skóre (${testResultsData.score}/50) bude použito pro studijní plán.</div>`; ui.continueBtn.disabled = false; } const sortedTopics = Object.values(testResultsData.topicResults || {}).sort((a, b) => a.score_percent - b.score_percent); ui.topicResultsEl.innerHTML = sortedTopics.map(stats => { const icon = topicIcons[stats.name] || topicIcons.default; return `<div class="topic-card card ${stats.strength}"> <div class="topic-header"> <div class="topic-icon"><i class="fas ${icon}"></i></div> <h3 class="topic-title">${sanitizeHTML(stats.name)}</h3> </div> <div class="topic-stats"> <div class="topic-progress"> <span class="topic-progress-label">Úspěšnost (body)</span> <span class="topic-progress-value">${stats.score_percent}%</span> </div> <div class="topic-progress-bar"> <div class="topic-progress-fill" style="width: ${stats.score_percent}%;"></div> </div> <div class="topic-progress" style="margin-top: 0.5rem;"> <span class="topic-progress-label">Body</span> <span class="topic-progress-value">${stats.points_achieved} / ${stats.max_points}</span> </div> <div class="topic-progress" style="margin-top: 0.1rem; font-size: 0.8em;"> <span class="topic-progress-label">Správně otázek</span> <span class="topic-progress-value">${stats.fully_correct} / ${stats.total_questions}</span> </div> </div> </div>`; }).join(''); if (ui.reviewAnswersBtn) ui.reviewAnswersBtn.onclick = displayReview; if (ui.backToResultsBtn) ui.backToResultsBtn.onclick = () => { ui.reviewContainer.style.display = 'none'; ui.resultsContainer.style.display = 'block'; if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' }); };

        // Po zobrazení výsledků testu zobrazíme i sekci "Testy pro закрепления"
        if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'block';
    }
    function displayReview() {
        if (!ui.resultsContainer || !ui.reviewContainer || !ui.reviewContent || !ui.reviewItemTemplate) { console.error("Elementy pro přehled odpovědí nebo šablona nenalezeny!"); return; }
        // Schováme standardní výsledky NEBO shrnutí, podle toho, odkud jsme přišli
        if(ui.resultsContainer) ui.resultsContainer.style.display = 'none';
        if(ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'none';
        if(ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none'; // Schováme i toto

        ui.reviewContainer.style.display = 'block'; ui.reviewContent.innerHTML = '';

        // Data pro review by měla být již v `testResultsData` (jako `analysis`) a `userAnswers`
        // Pokud `userAnswers` nejsou naplněny z `incorrectly_answered_details` (případ shrnutí), potřebujeme je naplnit
        let reviewableAnswers = userAnswers;
        if (testResultsData && testResultsData.incorrectly_answered_details && userAnswers.length === 0) {
            // Toto je případ, kdy jsme přišli ze shrnutí a userAnswers nebyly "rehydratovány" pro review
            // Pro jednoduchost předpokládáme, že 'questions' globální proměnná stále drží strukturu otázek z testu
            // (což nemusí být pravda, pokud uživatel opustil stránku a vrátil se)
            // Bezpečnější by bylo ukládat `questions` spolu s `user_diagnostics`
            // Pro teď, pokud `questions` je prázdné, zobrazíme chybu
            if (questions.length === 0 && testResultsData.incorrectly_answered_details) {
                 console.warn("[DisplayReview] Původní otázky testu nejsou dostupné pro zobrazení detailů odpovědí ze shrnutí. Zobrazuji pouze texty otázek, pokud jsou v `incorrectly_answered_details`.");
                 reviewableAnswers = testResultsData.incorrectly_answered_details.map((detail, index) => ({
                     question_number_in_test: detail.question_number || (index + 1),
                     question_text: detail.question_text || "Text otázky není k dispozici",
                     image_url: null, // Nemáme zde URL obrázku
                     userAnswerValue: detail.user_answer || null,
                     correct_answer: detail.correct_answer || "N/A",
                     solution_explanation: detail.explanation || "Vysvětlení není k dispozici.",
                     reasoning: detail.explanation,
                     error_analysis: detail.error_identified,
                     feedback: null, // Feedback zde není
                     scoreAwarded: detail.score_awarded,
                     maxScore: detail.max_score,
                     correctness: detail.score_awarded === detail.max_score ? 'correct' : (detail.score_awarded > 0 ? 'partial' : 'incorrect'),
                     question_type: detail.type || 'unknown' // typ otázky
                 }));
            } else if (questions.length > 0 && testResultsData.incorrectly_answered_details) {
                // Pokus o "rehydrataci" userAnswers, pokud máme původní otázky
                reviewableAnswers = questions.map((q, index) => {
                    const answeredDetail = testResultsData.answers?.find(a => a.question_number_in_test === q.question_number) ||
                                       testResultsData.incorrectly_answered_details?.find(d => d.question_number === q.question_number);
                    return {
                        ...q, // Vezmeme data z původní otázky
                        userAnswerValue: answeredDetail?.userAnswerValue || answeredDetail?.user_answer || null,
                        scoreAwarded: answeredDetail?.scoreAwarded ?? (answeredDetail?.user_answer === q.correct_answer ? q.maxScore : 0),
                        correctness: answeredDetail?.correctness || (answeredDetail?.user_answer === q.correct_answer ? 'correct' : 'incorrect'),
                        reasoning: answeredDetail?.reasoning || answeredDetail?.explanation,
                        error_analysis: answeredDetail?.error_analysis || answeredDetail?.error_identified,
                        feedback: answeredDetail?.feedback
                    };
                });
                // Pokud jsme přišli ze shrnutí, `userAnswers` nemusí být kompletní. Použijeme `testResultsData.answers` pokud existuje.
                if (testResultsData && testResultsData.answers && testResultsData.answers.length === questions.length) {
                    console.log("[DisplayReview] Používám testResultsData.answers pro zobrazení.");
                    reviewableAnswers = testResultsData.answers.map((ans, idx) => ({
                        ...questions[idx], // doplníme data o otázce
                        ...ans // data z odpovědi
                    }));
                } else {
                    console.warn("[DisplayReview] testResultsData.answers není dostupné nebo neodpovídá počtu otázek. Používám globální userAnswers.");
                }
            }
        }


        if (!reviewableAnswers || reviewableAnswers.length === 0) { ui.reviewContent.innerHTML = '<p class="error-message-container">Chyba: Data pro přehled odpovědí nejsou kompletní.</p>'; return; }

        reviewableAnswers.forEach((answer, index) => {
            const q = answer; // Pro zjednodušení, answer už obsahuje data otázky
            const templateNode = ui.reviewItemTemplate.content.cloneNode(true); const itemElement = templateNode.querySelector('.review-question-item'); itemElement.dataset.questionIndex = index;
            let itemClass = 'review-question-item card'; let scoreStatusText = ''; let scoreValueText = `(${answer.scoreAwarded ?? 0} / ${answer.maxScore} b.)`; if (answer.correctness === "skipped") { scoreValueText = `(0 / ${answer.maxScore} b.)`; }
            switch (answer.correctness) { case 'correct': itemClass += ' correct'; scoreStatusText = '<span class="correct">Správně</span>'; break; case 'partial': itemClass += ' partial'; scoreStatusText = '<span class="partial">Částečně</span>'; break; case 'incorrect': itemClass += ' incorrect'; scoreStatusText = '<span class="incorrect">Nesprávně</span>'; break; case 'skipped': itemClass += ' skipped'; scoreStatusText = '<span class="skipped">Přeskočeno</span>'; break; case 'error': default: itemClass += ' incorrect error-eval'; scoreStatusText = '<span class="incorrect">Chyba</span>'; break; }
            itemElement.className = itemClass; itemElement.querySelector('.review-question-number').textContent = q.question_number_in_test || q.question_number || (index + 1); itemElement.querySelector('.review-question-text').innerHTML = sanitizeHTML(q.question_text);
            const imgContainer = itemElement.querySelector('.review-question-image-container'); const imgElement = itemElement.querySelector('.review-question-image');
            if (q.image_url) { imgElement.src = q.image_url; imgElement.alt = `Obrázek k otázce ${q.question_number_in_test || q.question_number}`; imgContainer.style.display = 'block'; } else { imgContainer.style.display = 'none'; }
            const userAnswerValueEl = itemElement.querySelector('.user-answer-value');
            if (answer.userAnswerValue !== null) { if (q.question_type === 'multiple_choice') { const selectedLetter = String(answer.userAnswerValue).trim().toUpperCase(); const selectedOptionIndex = selectedLetter.charCodeAt(0) - 65; const optionText = (Array.isArray(q.options) && q.options[selectedOptionIndex] !== undefined) ? sanitizeHTML(q.options[selectedOptionIndex]) : `(Neplatná volba: ${sanitizeHTML(answer.userAnswerValue)})`; userAnswerValueEl.textContent = `${selectedLetter}. ${optionText}`; } else if (typeof answer.userAnswerValue === 'object') { let multiPartAnswerHTML = ""; Object.keys(answer.userAnswerValue).forEach(partKey => { const partPrefix = (q.answer_prefix && typeof q.answer_prefix === 'object' && q.answer_prefix[partKey]) ? sanitizeHTML(q.answer_prefix[partKey]) : (sanitizeHTML(partKey).toUpperCase() + ': '); multiPartAnswerHTML += `<div>${partPrefix}${sanitizeHTML(answer.userAnswerValue[partKey] || '<em>(prázdné)</em>')}</div>`; }); userAnswerValueEl.innerHTML = multiPartAnswerHTML; } else { userAnswerValueEl.textContent = sanitizeHTML(answer.userAnswerValue); } } else { userAnswerValueEl.innerHTML = `<em>(Nezodpovězeno)</em>`; }
            const correctAnswerContainer = itemElement.querySelector('.review-correct-answer'); const correctAnswerValueEl = itemElement.querySelector('.correct-answer-value');
            if (q.question_type !== 'construction' && answer.correctness !== 'correct') { correctAnswerContainer.style.display = 'block'; if (q.question_type === 'multiple_choice') { const correctLetter = String(q.correct_answer).trim().toUpperCase().replace(/[\.\)\s].*/, ''); const correctOptionIndex = correctLetter.charCodeAt(0) - 65; const correctText = (Array.isArray(q.options) && q.options[correctOptionIndex] !== undefined) ? sanitizeHTML(q.options[correctOptionIndex]) : `(Neplatný text správné odpovědi)`; correctAnswerValueEl.textContent = `${correctLetter}. ${correctText}`; } else if (typeof q.correct_answer === 'object' && q.correct_answer !== null && !Array.isArray(q.correct_answer)) { let multiPartCorrectHTML = ""; Object.keys(q.correct_answer).forEach(partKey => { const partPrefix = (q.answer_prefix && typeof q.answer_prefix === 'object' && q.answer_prefix[partKey]) ? sanitizeHTML(q.answer_prefix[partKey]) : (sanitizeHTML(partKey).toUpperCase() + ': '); multiPartCorrectHTML += `<div>${partPrefix}${sanitizeHTML(q.correct_answer[partKey])}</div>`; }); correctAnswerValueEl.innerHTML = multiPartCorrectHTML; } else { correctAnswerValueEl.textContent = sanitizeHTML(q.correct_answer); } } else { correctAnswerContainer.style.display = 'none'; }
            const solutionExplanationEl = itemElement.querySelector('.solution-explanation'); const solutionContainer = itemElement.querySelector('.review-solution'); const explanationToShow = (answer.reasoning && answer.reasoning.trim() !== "" && answer.correctness !== "skipped" && !["Odpověď je správná.", "Odpověď je nesprávná."].includes(answer.reasoning.trim())) ? answer.reasoning : q.solution_explanation;
            if (explanationToShow && explanationToShow.trim() !== "" && explanationToShow !== "Oficiální postup není k dispozici.") { solutionExplanationEl.innerHTML = sanitizeHTML(explanationToShow); solutionContainer.style.display = 'block'; } else { solutionContainer.style.display = 'none'; }
            const errorAnalysisTextEl = itemElement.querySelector('.error-analysis-text'); const errorAnalysisContainer = itemElement.querySelector('.review-error-analysis'); const aiFeedbackContainer = itemElement.querySelector('.review-ai-feedback');
            if (answer.error_analysis && answer.error_analysis.trim() !== "") { errorAnalysisTextEl.innerHTML = sanitizeHTML(answer.error_analysis); errorAnalysisContainer.style.display = 'block'; aiFeedbackContainer.style.display = 'block'; } else { errorAnalysisContainer.style.display = 'none'; }
            const aiAdviceTextEl = itemElement.querySelector('.ai-advice-text'); const aiAdviceContainer = itemElement.querySelector('.review-ai-advice');
            if (answer.feedback && answer.feedback.trim() !== "") { aiAdviceTextEl.innerHTML = sanitizeHTML(answer.feedback); aiAdviceContainer.style.display = 'block'; if(!answer.error_analysis || answer.error_analysis.trim() === "") aiFeedbackContainer.style.display = 'block'; } else { aiAdviceContainer.style.display = 'none'; }
            if (errorAnalysisContainer.style.display === 'none' && aiAdviceContainer.style.display === 'none') { aiFeedbackContainer.style.display = 'none'; }
            itemElement.querySelector('.score-status').innerHTML = scoreStatusText; itemElement.querySelector('.score-value').textContent = scoreValueText;
            const reviewActionsDiv = itemElement.querySelector('.review-actions'); const reevaluateBtn = itemElement.querySelector('.reevaluate-answer-btn');
            if (answer.correctness === 'incorrect' || answer.correctness === 'partial' || answer.correctness === 'error') { reviewActionsDiv.style.display = 'block'; reevaluateBtn.dataset.questionIndex = index; reevaluateBtn.onclick = handleReevaluateClick; } else { reviewActionsDiv.style.display = 'none'; }
            ui.reviewContent.appendChild(templateNode);
        });
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { try { setTimeout(() => { window.MathJax.typesetPromise([ui.reviewContent]).catch(e => console.error("MathJax error in review:", e)); }, 0); } catch (e) { console.error("MathJax init error in review:", e); } }
        if (ui.reviewContainer) ui.reviewContainer.scrollIntoView({ behavior: 'smooth' });
    }
    async function handleReevaluateClick(event) {
        const button = event.currentTarget; const questionIndex = parseInt(button.dataset.questionIndex, 10);
        if (isNaN(questionIndex) || !userAnswers[questionIndex] || !questions[questionIndex]) { showToast("Chyba", "Nelze přehodnotit tuto otázku.", "error"); return; }
        if (isLoading.reevaluation[questionIndex]) { showToast("Info", "Přehodnocení již probíhá.", "info"); return; }
        console.log(`[Reevaluate] Požadavek na přehodnocení otázky #${questionIndex + 1}`); isLoading.reevaluation[questionIndex] = true; setLoadingState(`reevaluation_${questionIndex}`, true);
        setTimeout(() => { console.log(`[Reevaluate] Placeholder: Přehodnocení dokončeno pro otázku ${questionIndex + 1}.`); showToast("Přehodnocení", `Funkce "Přehodnotit odpověď" bude brzy implementována pro otázku č. ${questionIndex + 1}.`, "info"); isLoading.reevaluation[questionIndex] = false; setLoadingState(`reevaluation_${questionIndex}`, false); }, 2000);
    }
    async function finishTest() {
        stopTimer();
        if (questions.length === 0) { console.log("[FinishTest] Žádné otázky k dokončení testu. Vracím na výběr."); if(ui.testContainer) ui.testContainer.style.display = 'none'; if(ui.testTimer) ui.testTimer.style.display = 'none'; if(ui.testSelector) ui.testSelector.style.display = 'block'; if (ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'none'; if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none'; if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu'; applyTestHighlightingAndSelection(); history.replaceState({ state: 'testSelection' }, document.title, window.location.href); return; }
        setLoadingState('results', true); if(ui.finishBtn) { ui.finishBtn.disabled = true; ui.finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vyhodnocuji...'; }
        let saveResult = { success: false };
        try {
            await evaluateAnswersUI(); testResultsData = window.TestLogic.calculateFinalResults(userAnswers, questions); testResultsData.timeSpent = testTime;
            const testConfigForSave = testTypeConfig[selectedTestType]; if (testConfigForSave && testConfigForSave.identifier) { if (!testResultsData.summary) testResultsData.summary = {}; testResultsData.summary.test_type_identifier = testConfigForSave.identifier; console.log(`[finishTest] Added test_type_identifier: ${testConfigForSave.identifier} to results.summary`); } else { console.warn(`[finishTest] Missing testConfig or identifier for selectedTestType: ${selectedTestType}`); }
            // Přidáme `answers` do `testResultsData.summary` pro snazší přístup ve funkci `checkSpecificTestCompleted`
            if (testResultsData.summary) {
                 testResultsData.summary.answers = userAnswers.map(a => ({ // Ukládáme jen potřebné části pro review ze summary
                    question_number_in_test: a.question_number_in_test,
                    userAnswerValue: a.userAnswerValue,
                    scoreAwarded: a.scoreAwarded,
                    maxScore: a.maxScore,
                    correctness: a.correctness,
                    reasoning: a.reasoning, // Důležité pro AI vysvětlení
                    error_analysis: a.error_analysis
                 }));
            }
            saveResult = await window.TestLogic.saveTestResults(supabase, currentUser, testResultsData, userAnswers, questions, testEndTime); diagnosticId = saveResult.diagnosticId || null;
            if (saveResult.success) { const pointsResult = await window.TestLogic.awardPoints(supabase, currentUser, currentProfile, selectedTestType, testResultsData, testTypeConfig); if (pointsResult?.success) { currentProfile.points = pointsResult.newTotal; showToast(`+${pointsResult.awardedPoints} kreditů získáno!`, `Za test '${testTypeConfig[selectedTestType].title}'`, 'success'); } else if (pointsResult && pointsResult.error) { showToast(`Nepodařilo se připsat body: ${pointsResult.error}`, 'warning'); } if (typeof window.TestLogic.checkAndAwardAchievements === 'function' && currentProfile) { await window.TestLogic.checkAndAwardAchievements(currentUser.id, currentProfile, {}); } }
            else { console.warn("Výsledky nebyly úspěšně uloženy nebo byly pod limitem, body nebudou přiděleny."); if(ui.continueBtn) { ui.continueBtn.disabled = true; if(saveResult.error && !saveResult.error.includes('Skóre je příliš nízké')) { ui.continueBtn.setAttribute('data-save-error', 'true'); } } }
            displayResults(); history.pushState({ state: 'testFinished' }, document.title, window.location.href);
        } catch (error) { console.error("Chyba při dokončování testu:", error); showGeminiOverlay(false); if (!testResultsData) { testResultsData = { score: 0, percentage: 0, correctAnswers: 0, incorrectAnswers: questions.length, partiallyCorrectAnswers: 0, skippedAnswers: 0, timeSpent: testTime, topicResults: {}, evaluationErrors: questions.length }; } displayResults(); if(ui.lowScoreMessageContainer) { ui.lowScoreMessageContainer.innerHTML = `<div class="error-message-container"><i class="fas fa-exclamation-triangle"></i><div class="loader-text">Chyba!</div><div class="loader-subtext">Chyba vyhodnocení/ukládání: ${error.message}. Výsledky nemusí být kompletní nebo uložené.</div></div>`; } if(ui.continueBtn) { ui.continueBtn.disabled = true; ui.continueBtn.setAttribute('data-save-error', 'true'); } history.pushState({ state: 'testFinishedWithError' }, document.title, window.location.href); }
        finally { setLoadingState('results', false); if(ui.finishBtn) { ui.finishBtn.disabled = true; ui.finishBtn.innerHTML = '<i class="fas fa-check-circle"></i> Test Dokončen'; } }
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
            console.warn(`[Highlight v12.16] Pro cíl '${userLearningGoal}' nebyl nalezen žádný povinný test. Zobrazuji všechny jako neaktivní.`);
        } else if (!userLearningGoal) {
            console.warn(`[Highlight v12.16] Cíl uživatele není nastaven. Nelze určit povinný test. Zobrazuji všechny jako neaktivní.`);
        }

        selectedTestType = mandatoryTestKey;

        ui.testTypeCards.forEach(card => {
            const testType = card.dataset.testType;
            const config = testTypeConfig[testType];
            const buttonInCard = card.querySelector('.btn-start-test-in-card');
            const recommendedBadge = card.querySelector('.recommended-badge');

            card.classList.remove('recommended-test', 'disabled-test', 'selected');
            if (buttonInCard) buttonInCard.disabled = true;
            if (recommendedBadge) recommendedBadge.style.display = 'none';

            if (config) {
                if (mandatoryTestKey === testType) {
                    card.classList.add('recommended-test', 'selected');
                    if (recommendedBadge) recommendedBadge.style.display = 'block';
                    if (buttonInCard) {
                        if (config.isActive === false) {
                            buttonInCard.innerHTML = '<i class="fas fa-hourglass-half"></i> Spustit Test (Brzy!)';
                            buttonInCard.disabled = false;
                            buttonInCard.classList.remove('btn-primary');
                            buttonInCard.classList.add('btn-secondary', 'btn-tooltip');
                            buttonInCard.title = `Test "${config.title}" bude brzy dostupný.`;
                        } else {
                            buttonInCard.innerHTML = `<i class="fas fa-play"></i> Spustit Test`;
                            buttonInCard.disabled = false;
                            buttonInCard.classList.remove('btn-secondary');
                            buttonInCard.classList.add('btn-primary');
                            buttonInCard.title = `Spustit test: ${config.title}`;
                        }
                    }
                    console.log(`[Highlight v12.16] Povinný test: ${config.title} pro cíl ${userLearningGoal || 'NENASTAVEN'}`);
                    if (ui.currentTestTitle) ui.currentTestTitle.textContent = config.title;
                    if (ui.testLevel) ui.testLevel.textContent = config.description.split('.')[0];
                } else {
                    card.classList.add('disabled-test');
                    if (buttonInCard) {
                        buttonInCard.innerHTML = '<i class="fas fa-times-circle"></i> Není určeno pro váš cíl';
                        buttonInCard.disabled = true;
                        buttonInCard.classList.remove('btn-primary');
                        buttonInCard.classList.add('btn-secondary');
                        buttonInCard.title = 'Tento test není určen pro váš aktuální studijní cíl.';
                    }
                }
            } else {
                card.classList.add('disabled-test');
                if (buttonInCard) {
                    buttonInCard.innerHTML = '<i class="fas fa-ban"></i> Test nedostupný';
                    buttonInCard.disabled = true;
                }
            }
        });

        if (ui.startSelectedTestBtnGlobal) {
            if (selectedTestType && testTypeConfig[selectedTestType]) {
                const config = testTypeConfig[selectedTestType];
                ui.startSelectedTestBtnGlobal.innerHTML = `<i class="fas fa-play-circle"></i> Spustit: ${config.title}`;
                if (config.isActive === false) {
                    ui.startSelectedTestBtnGlobal.disabled = true;
                    ui.startSelectedTestBtnGlobal.title = `Test "${config.title}" bude brzy dostupný.`;
                } else {
                    ui.startSelectedTestBtnGlobal.disabled = false;
                    ui.startSelectedTestBtnGlobal.title = `Spustit test: ${config.title}`;
                }
            } else {
                ui.startSelectedTestBtnGlobal.innerHTML = `<i class="fas fa-play-circle"></i> Vyberte Test`;
                ui.startSelectedTestBtnGlobal.disabled = true;
                ui.startSelectedTestBtnGlobal.title = `Nejprve musí být určen povinný test (zkontrolujte svůj studijní cíl).`;
            }
        }
        initTooltips();
    }
    function startSelectedTest() {
        if (!selectedTestType) { showToast('Chyba', 'Povinný test nebyl správně určen. Zkontrolujte svůj studijní cíl nebo obnovte stránku.', 'error'); if (ui.testSelector && getComputedStyle(ui.testSelector).display === 'none') { ui.testSelector.style.display = 'block'; } if (ui.testContainer) ui.testContainer.style.display = 'none'; if (ui.testLoader) ui.testLoader.style.display = 'none'; if (ui.testTimer) ui.testTimer.style.display = 'none'; return; }
        const config = testTypeConfig[selectedTestType]; if (!config) { showErrorMessagePage(`Neznámý typ testu: ${selectedTestType}`); return; }
        if(ui.currentTestTitle) ui.currentTestTitle.textContent = config.title; if(ui.testLevel) ui.testLevel.textContent = config.description.split('.')[0];
        if (ui.testSelector) ui.testSelector.style.display = 'none'; if (ui.testLoader) ui.testLoader.style.display = 'flex'; if (ui.loaderSubtext) ui.loaderSubtext.textContent = 'Načítám otázky...'; if (ui.testContainer) ui.testContainer.style.display = 'none'; if (ui.resultsContainer) ui.resultsContainer.style.display = 'none'; if (ui.reviewContainer) ui.reviewContainer.style.display = 'none'; if (ui.testTimer) ui.testTimer.style.display = 'flex'; if (ui.prevBtn) ui.prevBtn.style.display = 'flex'; if (ui.nextBtn) ui.nextBtn.style.display = 'flex';
        if (ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'none';
        if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none';
        history.pushState({ state: 'testInProgress' }, document.title, window.location.href); loadTestQuestions(selectedTestType);
    }
    function handleBackButton(event) {
        const state = event.state ? event.state.state : null;
        const testIsRunning = ui.testContainer && getComputedStyle(ui.testContainer).display === 'block';
        const resultsAreShown = ui.resultsContainer && getComputedStyle(ui.resultsContainer).display === 'block';
        const reviewIsShown = ui.reviewContainer && getComputedStyle(ui.reviewContainer).display === 'block';
        const summaryIsShown = ui.completedTestSummaryContainer && getComputedStyle(ui.completedTestSummaryContainer).display === 'block';

        console.log("[HandleBack] Current state:", state, "TestRunning:", testIsRunning, "Results:", resultsAreShown, "Review:", reviewIsShown, "Summary:", summaryIsShown);

        if (reviewIsShown) {
            ui.reviewContainer.style.display = 'none';
            // Rozhodnout, zda se vrátit na #results-container nebo #completed-test-summary-container
            // testResultsData by mělo být naplněno buď z dokončení testu, nebo při zobrazení shrnutí
            if (testResultsData && testResultsData.summary?.test_type_identifier) { // Pokud máme summary data
                const mandatoryTestKey = Object.keys(testTypeConfig).find(key => testTypeConfig[key].identifier === testResultsData.summary.test_type_identifier);
                if (mandatoryTestKey && testTypeConfig[mandatoryTestKey].recommendedForGoal === currentProfile?.learning_goal) {
                    // Pokud jsme byli v review z shrnutí dokončeného povinného testu
                    if(ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'block';
                    if(ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'block';
                     history.replaceState({ state: 'completedTestSummary' }, document.title, window.location.href);
                } else if (ui.resultsContainer) { // Jinak na standardní výsledky (např. po právě dokončeném testu)
                    ui.resultsContainer.style.display = 'block';
                     if(ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'block';
                     history.replaceState({ state: 'testFinished' }, document.title, window.location.href);
                }
            } else if (ui.resultsContainer) { // Fallback na standardní výsledky
                 ui.resultsContainer.style.display = 'block';
                 if(ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'block';
                 history.replaceState({ state: 'testFinished' }, document.title, window.location.href);
            }
             if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' });

        } else if (testIsRunning && questions.length > 0) {
            if (!confirm('Opustit test? Postup nebude uložen.')) {
                history.pushState({ state: 'testInProgress' }, document.title, window.location.href);
            } else {
                stopTimer();
                initializeAppUIState(); // Reset to initial state (selector or summary)
            }
        } else if (resultsAreShown || summaryIsShown) {
            initializeAppUIState(); // Reset to initial state (selector or summary)
        } else { // Default or no questions running, back to selector or summary
            console.log("[HandleBack] Výchozí chování, resetuji UI.");
            initializeAppUIState();
        }
    }

    // --- END: Test Flow & Back Button ---

    // --- START: Notification Logic (UI Interaction) ---
    async function fetchAndRenderNotifications() { if (!currentUser || !window.TestLogic) return; setLoadingState('notifications', true); try { const { unreadCount, notifications } = await window.TestLogic.fetchNotifications(supabase, currentUser.id, 5); renderNotifications(unreadCount, notifications); } catch (error) { console.error("[UI] Chyba při načítání notifikací:", error); renderNotifications(0, []); } finally { setLoadingState('notifications', false); } }
    function renderNotifications(count, notifications) { console.log("[Render Notifications UI] Start, Count:", count, "Notifications:", notifications); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications UI] Missing UI elements."); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${sanitizeHTML(n.title)}</div><div class="notification-message">${sanitizeHTML(n.message)}</div><div class="notification-time">${formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } console.log("[Render Notifications UI] Finished rendering."); }
    async function markNotificationReadUI(notificationId) { console.log("[UI] Mark Notification Read:", notificationId); if (!currentUser || !notificationId) return; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[UI] Mark as read successful for ID:", notificationId); const item = ui.notificationsList.querySelector(`.notification-item[data-id="${notificationId}"]`); if(item) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount?.textContent?.replace('+', '') || '0'; const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } catch (error) { console.error("[UI] Mark as read error:", error); showToast('Chyba označení oznámení.', 'error'); } }
    async function markAllNotificationsReadUI() { console.log("[UI] Mark All Notifications Read"); if (!currentUser || !ui.markAllReadBtn || ui.markAllReadBtn.disabled) return; setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false); if (error) throw error; console.log("[UI] Mark all as read successful in DB."); await fetchAndRenderNotifications(); showToast('Oznámení označena jako přečtená.', 'success'); } catch (error) { console.error("[UI] Mark all as read error:", error); showToast('Chyba při označování oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = currentCount === 0; } finally { setLoadingState('notifications', false); } }
    // --- END: Notification Logic ---

    // --- START: App Initialization ---
    // Функция для установки начального состояния UI
    async function initializeAppUIState() {
        setLoadingState('test', true);
        const userLearningGoal = currentProfile.learning_goal;
        let mandatoryTestKey = null;
        let completedTestData = null;

        if (userLearningGoal) {
            mandatoryTestKey = Object.keys(testTypeConfig).find(key => testTypeConfig[key].recommendedForGoal === userLearningGoal);
            if (mandatoryTestKey) {
                const mandatoryConfig = testTypeConfig[mandatoryTestKey];
                completedTestData = await checkSpecificTestCompleted(currentUser.id, mandatoryConfig.identifier);
            }
        }
        setLoadingState('test', false);

        let testMainTitle = "Diagnostický test";
        let testSubtitle = "Automatický výběr testu";

        if (completedTestData) {
            console.log(`[Init UI State v12.16] Zobrazuji SHRNUTÍ pro dokončený test.`);
            if (ui.testSelector) ui.testSelector.style.display = 'none';
            if (ui.testContainer) ui.testContainer.style.display = 'none';
            if (ui.resultsContainer) ui.resultsContainer.style.display = 'none';
            if (ui.reviewContainer) ui.reviewContainer.style.display = 'none';
            if (ui.testTimer) ui.testTimer.style.display = 'none';

            if (ui.completedTestSummaryContainer && completedTestData.analysis && completedTestData.analysis.summary) {
                const summary = completedTestData.analysis.summary;
                const configOfCompleted = Object.values(testTypeConfig).find(c => c.identifier === summary.test_type_identifier);
                if(ui.completedTestTitleSummary) ui.completedTestTitleSummary.textContent = configOfCompleted ? configOfCompleted.title : 'Předchozí test';
                if(ui.summaryScore) ui.summaryScore.textContent = `${summary.score || 0}/${summary.total_max_possible_points || 50}`;
                if(ui.summaryPercentage) ui.summaryPercentage.textContent = `${summary.percentage || 0}%`;
                if(ui.summaryCorrect) ui.summaryCorrect.textContent = summary.correct || 0;
                if(ui.summaryIncorrect) ui.summaryIncorrect.textContent = (summary.incorrect || 0) + (summary.partial || 0);
                if(ui.summaryTime) ui.summaryTime.textContent = formatTime(summary.time_spent_seconds || 0);

                // Prepare data for review functionality if user clicks "Zobrazit odpovědi" from summary
                testResultsData = completedTestData.analysis; // Store analysis for review
                // Reconstruct a simplified `questions` array for `displayReview` if it relies on it.
                // This assumes `completedTestData.answers` (or similar) exists in the saved diagnostic data.
                if (completedTestData.answers && Array.isArray(completedTestData.answers)) {
                    questions = completedTestData.answers.map(ans => ({
                        id: ans.question_db_id, // This might be null if not saved
                        question_number: ans.question_number_in_test,
                        question_text: ans.question_text || "Text otázky není k dispozici v tomto přehledu.",
                        question_type: ans.question_type,
                        options: ans.options, // Must be saved with answers for MC review
                        correct_answer: ans.correct_answer,
                        solution_explanation: ans.solution_explanation,
                        image_url: ans.image_url,
                        answer_prefix: ans.answer_prefix,
                        answer_suffix: ans.answer_suffix,
                        maxScore: ans.maxScore || 1
                    }));
                    userAnswers = completedTestData.answers; // This would be the user's actual answers + eval
                } else {
                    console.warn("[Init UI State] 'answers' array not found in completedTestData, review from summary might be limited.");
                    questions = []; // Prevent errors in displayReview if it expects questions
                    userAnswers = [];
                }


                ui.completedTestSummaryContainer.style.display = 'block';
                if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'block';
                history.replaceState({ state: 'completedTestSummary' }, document.title, window.location.href);

            } else {
                console.warn("[Init UI State v12.16] Data dokončeného testu nebo analýza chybí pro zobrazení shrnutí. Zobrazuji test selector.");
                if (ui.testSelector) ui.testSelector.style.display = 'block';
                applyTestHighlightingAndSelection();
                if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none';
                history.replaceState({ state: 'testSelection' }, document.title, window.location.href);
            }
        } else if (!userLearningGoal) {
            showErrorMessagePage("Pro pokračování si nejprve nastavte studijní cíl ve svém profilu nebo na hlavní stránce Procvičování.", false);
            if (ui.testSelector) ui.testSelector.style.display = 'block';
            applyTestHighlightingAndSelection();
            if (ui.startSelectedTestBtnGlobal) { ui.startSelectedTestBtnGlobal.disabled = true; ui.startSelectedTestBtnGlobal.innerHTML = '<i class="fas fa-times-circle"></i> Nastavte cíl'; }
            if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none';
            history.replaceState({ state: 'testSelection' }, document.title, window.location.href);
        } else if (mandatoryTestKey) {
            const config = testTypeConfig[mandatoryTestKey];
            testMainTitle = config.title;
            testSubtitle = config.description.split('.')[0];
            selectedTestType = mandatoryTestKey;
            applyTestHighlightingAndSelection();
            console.log(`[Init UI State v12.16] Cíl '${userLearningGoal}', povinný test '${config.title}' ještě nebyl dokončen. Zobrazuji panel výběru.`);
            if (ui.testSelector) ui.testSelector.style.display = 'block';
            if (ui.testLoader) ui.testLoader.style.display = 'none';
            if (ui.testContainer) ui.testContainer.style.display = 'none';
            if (ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'none';
            if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none';
            history.replaceState({ state: 'testSelection' }, document.title, window.location.href);
        } else {
            console.warn(`[Init UI State v12.16] Povinný test nebyl určen pro cíl '${userLearningGoal}'. Zobrazuji panel výběru (všechny budou disabled).`);
            if (ui.testSelector) ui.testSelector.style.display = 'block';
            applyTestHighlightingAndSelection();
            if (ui.testLoader) ui.testLoader.style.display = 'none';
            if (ui.testContainer) ui.testContainer.style.display = 'none';
            if (ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'none';
            if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none';
            testSubtitle = "Chyba konfigurace testu pro cíl";
            if (ui.startSelectedTestBtnGlobal) { ui.startSelectedTestBtnGlobal.disabled = true; ui.startSelectedTestBtnGlobal.innerHTML = '<i class="fas fa-times-circle"></i> Chyba cíle'; }
            history.replaceState({ state: 'testSelection' }, document.title, window.location.href);
        }

        if (ui.testLevel && getComputedStyle(ui.completedTestSummaryContainer).display === 'none') ui.testLevel.textContent = testSubtitle;
        const h1TitleElem = document.querySelector('.dashboard-header h1');
        if (h1TitleElem && getComputedStyle(ui.completedTestSummaryContainer).display === 'none') h1TitleElem.innerHTML = `<i class="fas fa-vial"></i> ${sanitizeHTML(testMainTitle)}`;
        else if (h1TitleElem) h1TitleElem.innerHTML = `<i class="fas fa-vial"></i> Přehled Diagnostiky`; // Title when summary is shown

    }

    async function initializeApp() {
        console.log("🚀 [Init Test1 UI - Kyber v12.16] Starting...");
        if (!initializeSupabase()) return;
        applyInitialSidebarState();

        if (typeof window.TestLogic === 'undefined') { showErrorMessagePage("Kritická chyba: Chybí základní logika testu (test1-logic.js). Obnovte stránku."); return; }
        if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
        if (ui.mainContent) { ui.mainContent.style.display = 'none'; ui.mainContent.classList.remove('loaded'); }

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);
            if (!session || !session.user) { console.log('[Init Test1 UI - Kyber v12.16] Not logged in. Redirecting...'); window.location.href = '/auth/index.html'; return; }
            currentUser = session.user;
            const titlesFetchResult = await fetchTitles(); allTitles = titlesFetchResult || []; console.log(`[INIT v12.16] Loaded ${allTitles.length} titles.`);
            const profileResult = await fetchUserProfile(currentUser.id);
            if (profileResult) { currentProfile = profileResult; }
            else { console.error("[INIT v12.16] Profile fetch failed or no data."); currentProfile = await createDefaultProfileIfNeeded(currentUser.id, currentUser.email); if (!currentProfile) { showError("Nepodařilo se načíst nebo vytvořit profil. Zkuste obnovit stránku.", true); if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => {if(ui.initialLoader) ui.initialLoader.style.display = 'none';}, 300); } return; } }
            updateUserInfoUI();

            setupEventListeners();
            initTooltips(); initMouseFollower(); initHeaderScrollDetection(); updateCopyrightYear(); updateOnlineStatus(); await fetchAndRenderNotifications();

            await initializeAppUIState(); // Zavoláme novou funkci pro nastavení UI

            if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }
            if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
            console.log("✅ [Init Test1 UI - Kyber v12.16] Page initialized.");
        } catch (error) { console.error("❌ [Init Test1 UI - Kyber v12.16] Error:", error); if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">Chyba (${error.message}). Obnovte.</p>`; } else { showErrorMessagePage(`Chyba inicializace: ${error.message}`, true); } if (ui.mainContent) ui.mainContent.style.display = 'block'; setLoadingState('all', false); }
    }
     async function createDefaultProfileIfNeeded(userId, email) {
        if (!supabase || !userId || !email) return null;
        console.log(`[Profile] Checking or creating default profile for ${userId}...`);
        try {
            let { data: existingProfile, error: fetchError } = await supabase .from('profiles') .select('*, learning_goal').eq('id', userId).single();
            if (fetchError && fetchError.code !== 'PGRST116') { throw fetchError; }
            if (existingProfile) { console.log("[Profile] Default profile already exists."); if (!existingProfile.preferences) existingProfile.preferences = {}; return existingProfile; }
            console.log("[Profile] Creating new default profile..."); const defaultUsername = email.split('@')[0];
            const defaultProfileData = { id: userId, username: defaultUsername, email: email, updated_at: new Date().toISOString(), learning_goal: null, preferences: {}, points: 0, level: 1, completed_exercises: 0, streak_days: 0, longest_streak_days: 0, selected_title: null, avatar_url: null, first_name: null, last_name: null, };
            const { data: newProfile, error: insertError } = await supabase .from('profiles').insert(defaultProfileData).select('*, learning_goal').single();
            if (insertError) { throw insertError; }
            console.log("[Profile] Default profile created successfully:", newProfile); if (!newProfile.preferences) newProfile.preferences = {}; return newProfile;
        } catch (error) { console.error('[Profile] Error in createDefaultProfileIfNeeded:', error); showToast('Kritická chyba Profilu', 'Nepodařilo se vytvořit výchozí profil.', 'error'); return null; }
    }
    function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded."); } supabase = window.supabase.createClient('https://qcimhjjwvsbgjsitmvuh.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10'); if (!supabase) throw new Error("Supabase client creation failed."); console.log('[Supabase] Client initialized.'); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showErrorMessagePage("Kritická chyba: Nelze se připojit k databázi."); return false; } }
    initializeApp();
})();
// --- Developer Edit Log ---
// Goal: If any of the 4 main diagnostic tests (corresponding to learning_goal) is completed, hide test selector and show a summary. Show "Tests for Reinforcement" section.
// Stage: JavaScript modifications in `test1.js`.
//   - `initializeApp`:
//     - Modified to correctly determine the `mandatoryTestKey` based on `currentProfile.learning_goal`.
//     - Calls `checkSpecificTestCompleted` with the `identifier` of this mandatory test.
//     - **If `completedTestData` is returned (meaning the mandatory test for the user's goal is done):**
//       - Hide `#test-selector`.
//       - Show and populate `#completed-test-summary-container` with data from `completedTestData.analysis.summary`.
//         - `completed-test-title-summary` is set to the title of the completed test.
//         - Other summary fields (score, percentage, correct, incorrect, time) are filled.
//       - `testResultsData` is populated with `completedTestData.analysis` to allow the "Zobrazit odpovědi" button in the summary to function.
//       - A simplified `questions` and `userAnswers` structure is created from `completedTestData.answers` (or `incorrectly_answered_details` as a fallback) to enable `displayReview`. This is a temporary solution; ideally, full question data would be stored/retrieved.
//       - Show `#reinforcement-tests-section`.
//       - Set history state to `completedTestSummary`.
//     - **Else (mandatory test not completed, or no learning_goal, or no mandatoryTestKey found):**
//       - Show `#test-selector` (if no error page is shown for missing `learning_goal`).
//       - Hide `#completed-test-summary-container`.
//       - Hide `#reinforcement-tests-section`.
//       - Call `applyTestHighlightingAndSelection()`.
//       - Set history state to `testSelection`.
//   - `checkSpecificTestCompleted`:
//     - Now fetches `answers` along with `analysis` from `user_diagnostics` to enable review from summary.
//     - Returns the full test data object if the specific test is found.
//   - `handleBackButton`:
//     - Updated to correctly navigate between summary, review, and selector states. If returning from review of a completed test, it goes back to the summary.
//   - `displayResults`:
//     - Added logic to show `#reinforcement-tests-section` after displaying results of a *newly completed* test.
//   - `initializeTest`:
//     - Added hiding of `#completed-test-summary-container` and `#reinforcement-tests-section` when a new test is started.
//   - `displayReview`:
//     - Added logic to try and reconstruct/use `reviewableAnswers` from `testResultsData.answers` (if coming from summary) or fall back to global `userAnswers` / `questions`.
//     - This highlights a potential need to store full question structures with diagnostic results for perfect review from summary.
//   - Added `initializeAppUIState` function to centralize the logic for showing either the test selector or the completed test summary based on the current state. This is called by `initializeApp` and `handleBackButton`.