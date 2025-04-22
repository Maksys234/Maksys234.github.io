// Файл: test1.js
// Управляет пользовательским интерфейсом, обработкой событий и оркестрацией теста,
// используя логику из test1-logic.js (доступную через window.TestLogic).

// Используем IIFE для изоляции области видимости
(function() {
    'use strict';

    // --- START: Инициализация и Конфигурация ---
    // Конфигурация Supabase и Gemini находится в test1-logic.js

    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let questions = []; // Массив загруженных вопросов теста
    let currentQuestionIndex = 0;
    let userAnswers = []; // Массив объектов с ответами пользователя
    let timer = null;
    let testTime = 0;
    let testStartTime = null;
    let testEndTime = null;
    let testResultsData = null; // Результаты после вычисления TestLogic
    let diagnosticId = null; // ID сохраненного теста в БД
    let selectedTestType = null; // e.g., 'quick', 'full', 'absolute'
    let isLoading = { page: true, test: false, results: false, notifications: false }; // Состояния загрузки UI

    // Конфигурация типов теста (остается здесь для UI)
    const testTypeConfig = {
        quick: { questionsCount: 10, title: 'Rychlý diagnostický test', description: 'Základní prověření', multiplier: 1.0 },
        full: { questionsCount: 20, title: 'Kompletní diagnostický test', description: 'Podrobné hodnocení', multiplier: 1.5 },
        absolute: { questionsCount: 30, title: 'Absolutní test znalostí', description: 'Důkladná prověrka', multiplier: 2.0 }
    };
    // Иконки тем (остаются здесь для UI)
    const topicIcons = { "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon", "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar", "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar", "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book" };
    // Визуалы для уведомлений (остаются здесь для UI)
    const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

    // DOM Кэш (все элементы UI)
    const ui = {
        // Sidebar & User Info
        sidebarAvatar: document.getElementById('sidebar-avatar'),
        sidebarName: document.getElementById('sidebar-name'),
        // Loaders & Overlays
        initialLoader: document.getElementById('initial-loader'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        geminiOverlay: document.getElementById('gemini-checking-overlay'),
        // Main Layout & Sidebar
        mainContent: document.getElementById('main-content'),
        sidebar: document.getElementById('sidebar'),
        mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
        sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
        // Header & Actions
        dashboardHeader: document.querySelector('.dashboard-header'),
        testSubject: document.getElementById('test-subject'),
        testLevel: document.getElementById('test-level'),
        testTimer: document.getElementById('test-timer'),
        timerValue: document.getElementById('timer-value'),
        // Notifications
        notificationBell: document.getElementById('notification-bell'),
        notificationCount: document.getElementById('notification-count'),
        notificationsDropdown: document.getElementById('notifications-dropdown'),
        notificationsList: document.getElementById('notifications-list'),
        noNotificationsMsg: document.getElementById('no-notifications-msg'),
        markAllReadBtn: document.getElementById('mark-all-read'),
        // Test Specific Sections
        testSelector: document.getElementById('test-selector'),
        testLoader: document.getElementById('test-loader'),
        loaderSubtext: document.getElementById('loader-subtext'),
        testContainer: document.getElementById('test-container'),
        resultsContainer: document.getElementById('results-container'),
        reviewContainer: document.getElementById('review-container'),
        // Test UI Elements
        currentTestTitle: document.getElementById('current-test-title'),
        questionCountEl: document.getElementById('question-count'),
        answeredCountEl: document.getElementById('answered-count'),
        progressBar: document.getElementById('progress-bar'),
        questionContainer: document.getElementById('question-container'),
        pagination: document.getElementById('pagination'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        finishBtn: document.getElementById('finish-btn'),
        // Results UI Elements
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
        // Review UI Elements
        reviewContent: document.getElementById('review-content'),
        backToResultsBtn: document.getElementById('back-to-results-btn'),
        // Selectors specific elements
        testTypeCards: document.querySelectorAll('.test-type-card'),
        selectTestBtns: document.querySelectorAll('.select-test-btn'),
        // Feedback & Status
        toastContainer: document.getElementById('toast-container'),
        globalError: document.getElementById('global-error'),
        offlineBanner: document.getElementById('offline-banner'),
        // Mouse Follower
        mouseFollower: document.getElementById('mouse-follower'),
        // Footer year spans
        currentYearSidebar: document.getElementById('currentYearSidebar'),
        currentYearFooter: document.getElementById('currentYearFooter'),
    };
    // --- END: Инициализация и Конфигурация ---

    // --- START: Helper Functions (UI specific or wrappers) ---
    // Функции showToast, showError, hideError, sanitizeHTML, getInitials, formatDate, formatTime, openMenu, closeMenu, toggleMobileMenu, updateUserInfoUI, handleScroll, indexToLetter, showGeminiOverlay, showErrorMessagePage, formatRelativeTime, initTooltips, updateCopyrightYear, initMouseFollower, initScrollAnimations, initHeaderScrollDetection, updateOnlineStatus - остаются без изменений, как в предыдущем ответе
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function getInitials(profileData) { if (!profileData) return '?'; const f = profileData.first_name?.[0] || ''; const l = profileData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = profileData.username?.[0].toUpperCase() || ''; const emailInitial = profileData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatDate(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) return '-'; return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return '-'; } }
    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return '--:--'; const m = Math.floor(seconds / 60); const s = Math.round(seconds % 60); return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function toggleMobileMenu() { closeMenu(); }
    function updateUserInfoUI() { if (!ui.sidebarName || !ui.sidebarAvatar) return; if (currentUser && currentProfile) { const displayName = `${currentProfile.first_name || ''} ${currentProfile.last_name || ''}`.trim() || currentProfile.username || currentUser.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = displayName; const initials = getInitials(currentProfile); ui.sidebarAvatar.innerHTML = currentProfile.avatar_url ? `<img src="${currentProfile.avatar_url}" alt="${displayName}">` : initials; } else { ui.sidebarName.textContent = 'Nepřihlášen'; ui.sidebarAvatar.textContent = '?'; } }
    function handleScroll() { if (!ui.mainContent || !ui.dashboardHeader) return; document.body.classList.toggle('scrolled', ui.mainContent.scrollTop > 10); }
    function indexToLetter(index){ return String.fromCharCode(65 + index); }
    function showGeminiOverlay(show){ if(ui.geminiOverlay) ui.geminiOverlay.style.display = show ? 'flex' : 'none'; }
    function showErrorMessagePage(message){ console.error("Error Page:", message); if (ui.testSelector) ui.testSelector.style.display = 'none'; if (ui.testContainer) ui.testContainer.style.display = 'none'; if (ui.resultsContainer) ui.resultsContainer.style.display = 'none'; if (ui.reviewContainer) ui.reviewContainer.style.display = 'none'; if (ui.geminiOverlay) ui.geminiOverlay.style.display = 'none'; if (ui.globalError) { showError(message, true); } else if (ui.mainContent) { ui.mainContent.innerHTML = `<div class="section error-message-container"><i class="fas fa-exclamation-triangle"></i><div class="loader-text">Chyba!</div><div class="loader-subtext">${sanitizeHTML(message)}</div><button class="btn btn-primary" style="margin-top:1.5rem;" onclick="location.reload()"><i class="fas fa-redo"></i> Zkusit znovu</button></div>`; ui.mainContent.style.display = 'block'; } else { document.body.innerHTML = `<div style='padding: 2rem; color: red;'><h1>Chyba</h1><p>${sanitizeHTML(message)}</p><button onclick="location.reload()">Obnovit</button></div>`; } if (ui.initialLoader && ui.initialLoader.style.display !== 'none') { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if(ui.initialLoader) ui.initialLoader.style.display = 'none';}, 300); } }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    const initTooltips = () => { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Chyba inicializace Tooltipster:", e); } };
    const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; };
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) { console.log("Scroll animations not initialized."); return; } const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
    const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); };
    function updateOnlineStatus() { if (ui.offlineBanner) { ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; } if (!navigator.onLine) { showToast('Offline', 'Spojení bylo ztraceno. Některé funkce nemusí být dostupné.', 'warning'); } }
    function setLoadingState(section, isLoadingFlag) { if (isLoading[section] === isLoadingFlag && section !== 'all') return; if (section === 'all') { Object.keys(isLoading).forEach(key => isLoading[key] = isLoadingFlag); } else { isLoading[section] = isLoadingFlag; } console.log(`[SetLoading] Section: ${section}, isLoading: ${isLoadingFlag}`); if (section === 'test') { if (ui.testLoader) ui.testLoader.style.display = isLoadingFlag ? 'flex' : 'none'; if (ui.testContainer) ui.testContainer.style.display = isLoadingFlag ? 'none' : (selectedTestType ? 'block' : 'none'); /* Показывать контейнер теста, только если тип выбран */ } else if (section === 'results') { /* UI для загрузки результатов, если нужно */ } else if (section === 'notifications') { if(ui.notificationBell) ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1; if (ui.markAllReadBtn) { const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0; } } }
    // --- END: Helper Functions ---

    // --- START: Data Fetching Wrappers (using TestLogic) ---
    async function fetchUserProfile(userId) {
        // Эта функция остается здесь, так как она нужна для инициализации UI
        if (!supabase || !userId) return null;
        console.log(`[Profile] Fetching profile for user ID: ${userId}`);
        try {
            const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
            if (error && error.code !== 'PGRST116') throw error;
            if (!profile) { console.warn(`[Profile] Profile not found for user ${userId}.`); return null; }
            console.log("[Profile] Profile data fetched.");
            return profile;
        } catch (error) {
            console.error('[Profile] Exception fetching profile:', error);
            showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error');
            return null;
        }
    }

     async function checkExistingDiagnostic(userId) {
         setLoadingState('test', true); // Keep using test loading state
         if (ui.loaderSubtext) ui.loaderSubtext.textContent = 'Kontroluji předchozí testy...';
         try {
             // Call the logic function from the global object
             const hasCompleted = await window.TestLogic.checkExistingDiagnostic(supabase, userId);
             return hasCompleted;
         } catch (err) {
             console.error("Error in checkExistingDiagnostic UI wrapper:", err);
             showToast("Chyba při kontrole testů.", "error");
             setLoadingState('test', false); // Stop loading on error
             return false; // Assume no test if logic fails
         }
         // Loading state is handled by the caller (initializeApp)
     }

    async function loadTestQuestions(testType) {
        setLoadingState('test', true);
        if (ui.loaderSubtext) ui.loaderSubtext.textContent = 'Načítám otázky...';
        try {
            // Call the logic function from the global object
            questions = await window.TestLogic.loadTestQuestions(supabase, testType, testTypeConfig);
            initializeTest(); // Start the test UI which will stop the loader
        } catch (error) {
            console.error('[UI] Error loading questions:', error);
            showErrorMessagePage(`Nepodařilo se načíst otázky: ${error.message}`);
             setLoadingState('test', false); // Ensure loader stops on error
        }
    }
    // --- END: Data Fetching Wrappers ---

    // --- START: Test Logic UI ---
    function initializeTest() {
        if (ui.testLoader) ui.testLoader.style.display = 'none';
        if (ui.testContainer) ui.testContainer.style.display = 'block';
        if (ui.resultsContainer) ui.resultsContainer.style.display = 'none';
        if (ui.reviewContainer) ui.reviewContainer.style.display = 'none';
        if (ui.testSelector) ui.testSelector.style.display = 'none';
        if (ui.testTimer) ui.testTimer.style.display = 'flex';
        currentQuestionIndex = 0;
        // Initialize userAnswers structure based on loaded questions
        userAnswers = questions.map((q, idx) => {
            let maxScore = 1;
            const difficultyInt = parseInt(q.difficulty);
             if (q.question_type === 'construction') maxScore = 2;
             else if (!isNaN(difficultyInt)) { if (difficultyInt >= 4) maxScore = 3; else if (difficultyInt === 3) maxScore = 2; }
            return {
                question_db_id: q.id, question_number_in_test: q.question_number,
                question_text: q.question_text, question_type: q.question_type,
                options: q.options, correct_answer: q.correct_answer,
                solution_explanation: q.solution_explanation, image_url: q.image_url,
                topic_id: q.topic_id, topic_name: q.topic_name,
                subtopic_id: q.subtopic_id, subtopic_name: q.subtopic_name,
                difficulty: q.difficulty, userAnswerValue: null, scoreAwarded: null,
                maxScore: maxScore, checked_by: null, correctness: null,
                reasoning: null, error_analysis: null, feedback: null
            };
        });
        testTime = 0;
        if(ui.timerValue) ui.timerValue.textContent = formatTime(testTime);
        if(ui.answeredCountEl) ui.answeredCountEl.textContent = '0';
        if(ui.lowScoreMessageContainer) ui.lowScoreMessageContainer.innerHTML = '';
        createPagination();
        startTimer();
        showQuestion(0);
        updateProgressBar();
        updateNavigationButtons();
        requestAnimationFrame(() => { if (ui.testContainer) { ui.testContainer.setAttribute('data-animate', ''); ui.testContainer.style.setProperty('--animation-order', 0); initScrollAnimations(); } });
        setLoadingState('test', false); // Stop loading indicator after setup
    }
    function startTimer() { if(timer)clearInterval(timer); testStartTime=new Date(); testTime=0; if(ui.timerValue) ui.timerValue.textContent=formatTime(testTime); ui.testTimer?.classList.remove('timer-warning','timer-danger'); timer=setInterval(()=>{testTime++; if(ui.timerValue) ui.timerValue.textContent=formatTime(testTime); const config=testTypeConfig[selectedTestType]; if(!config)return; const estimatedTime=config.questionsCount*1.5*60; const warningTime=estimatedTime*0.8; if(testTime>estimatedTime){ui.testTimer?.classList.add('timer-danger'); ui.testTimer?.classList.remove('timer-warning');}else if(testTime>warningTime){ui.testTimer?.classList.add('timer-warning'); ui.testTimer?.classList.remove('timer-danger');}},1000); }
    function stopTimer() { clearInterval(timer); timer = null; testEndTime = new Date(); }
    function showQuestion(index) {
         if (index < 0 || index >= questions.length || !ui.questionContainer) return;
         const question = questions[index];
         console.log(`Zobrazuji Q#${index + 1}`, question);
         currentQuestionIndex = index;

         if(ui.questionCountEl) ui.questionCountEl.textContent = `${index + 1} / ${questions.length}`;

         let questionHTML = `<div class="question-header"><span class="question-number">${question.question_number}</span><div class="question-text">${sanitizeHTML(question.question_text)}</div></div>`;
         if (question.image_url) { questionHTML += `<div class="question-image-container"><img class="question-image" src="${question.image_url}" alt="Obrázek k otázce ${question.question_number}" loading="lazy"></div>`; }

         const userAnswerData = userAnswers[index];
         const savedValue = userAnswerData ? userAnswerData.userAnswerValue : null;

         switch (question.question_type) {
             case 'multiple_choice':
                 questionHTML += `<div class="answer-options">`;
                 const optionsData = question.options;
                 if (!Array.isArray(optionsData)) { console.error("Options nejsou pole pro MC:", question.id, optionsData); questionHTML += `<div style='color:var(--accent-pink);font-weight:bold;'>Chyba: Formát možností není pole stringů.</div>`; }
                 else if (optionsData.length === 0) { console.warn("Chybí možnosti pro MC:", question.id); questionHTML += `<div style='color:var(--accent-orange);'>Varování: Chybí možnosti odpovědí.</div>`; }
                 else {
                     optionsData.forEach((optionText, idx) => {
                         const optionLetter = indexToLetter(idx);
                         const isSelected = savedValue === optionLetter;
                         const displayText = (typeof optionText === 'string' || typeof optionText === 'number') ? sanitizeHTML(optionText) : `(neplatný text ${idx+1})`;
                         questionHTML += `<label class="answer-option ${isSelected ? 'selected' : ''}" data-option-id="${optionLetter}"><input type="radio" name="question_${question.id || index}" value="${optionLetter}" ${isSelected ? 'checked' : ''} style="display: none;"><div class="answer-text"><span class="answer-letter">${optionLetter}.</span> ${displayText}</div></label>`;
                     });
                 }
                 questionHTML += `</div>`;
                 break;
             case 'construction':
                 questionHTML += `<div class="answer-input-container"><label for="construction-answer-${index}" class="form-label">Popište svůj postup:</label><textarea id="construction-answer-${index}" class="construction-textarea" placeholder="Podrobně popište kroky...">${sanitizeHTML(savedValue || '')}</textarea></div>`;
                 break;
             default: // text, numeric, ano_ne
                 let inputType = "text";
                 questionHTML += `<div class="answer-input-container"><label for="text-answer-${index}" class="form-label">Vaše odpověď:</label><input type="${inputType}" id="text-answer-${index}" class="answer-input" placeholder="Zadejte odpověď" value="${sanitizeHTML(savedValue || '')}"></div>`;
                 break;
         }

         ui.questionContainer.innerHTML = questionHTML;

         // Add event listeners
         const textInput = ui.questionContainer.querySelector(`#text-answer-${index}`);
         const constructionInput = ui.questionContainer.querySelector(`#construction-answer-${index}`);
         if (textInput) { textInput.addEventListener('input', (event) => { saveAnswer(index, event.target.value); }); }
         if (constructionInput) { constructionInput.addEventListener('input', (event) => { saveAnswer(index, event.target.value); }); }
         ui.questionContainer.querySelectorAll('.answer-option').forEach(label => { label.addEventListener('click', handleAnswerSelection); });

         updatePagination();
         updateNavigationButtons();

         // Trigger MathJax
         if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { try { setTimeout(() => { window.MathJax.typesetPromise([ui.questionContainer]).catch(e=>console.error("MathJax typesetting error:", e)); }, 0); } catch(e) { console.error("MathJax initialization error:", e); } }
    }
    function handleAnswerSelection(event) { const selectedLabel=event.currentTarget;const qIndex=currentQuestionIndex;const optionId=selectedLabel.dataset.optionId;const radio=selectedLabel.querySelector('input[type="radio"]');ui.questionContainer.querySelectorAll('.answer-option').forEach(label=>{label.classList.remove('selected');});selectedLabel.classList.add('selected');if(radio)radio.checked=true;saveAnswer(qIndex,optionId);}
    function createPagination() { if(!ui.pagination) return; ui.pagination.innerHTML=questions.map((_,i)=>`<div class="page-item" data-question="${i}">${i+1}</div>`).join(''); ui.pagination.querySelectorAll('.page-item').forEach(item=>{item.addEventListener('click',()=>{showQuestion(parseInt(item.dataset.question));});}); updatePagination(); }
    function updatePagination() { ui.pagination?.querySelectorAll('.page-item').forEach((item,index)=>{item.classList.remove('active','answered');if(index===currentQuestionIndex)item.classList.add('active');if(userAnswers[index] && userAnswers[index].userAnswerValue !== null)item.classList.add('answered');}); }
    function updateNavigationButtons() { if(ui.prevBtn) ui.prevBtn.disabled = currentQuestionIndex === 0; if(ui.nextBtn) ui.nextBtn.disabled = currentQuestionIndex === questions.length - 1; if(ui.finishBtn) { ui.finishBtn.style.display = currentQuestionIndex === questions.length - 1 ? 'flex' : 'none'; ui.finishBtn.disabled = false; ui.finishBtn.innerHTML = '<i class="fas fa-check-circle"></i> Dokončit test'; } }
    function updateProgressBar() { if (!ui.progressBar) return; const answeredCount = userAnswers.filter(a => a && a.userAnswerValue !== null).length; const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0; ui.progressBar.style.width = `${progress}%`; }
    function saveAnswer(qIndex, userAnswerValue) { if (!userAnswers[qIndex]) { console.error(`Chyba: Chybí objekt odpovědi pro index ${qIndex}`); return; } const wasAnsweredBefore = userAnswers[qIndex].userAnswerValue !== null; const isEmptyAnswer = typeof userAnswerValue === 'string' && userAnswerValue.trim() === ''; if (!isEmptyAnswer) { userAnswers[qIndex].userAnswerValue = userAnswerValue; } else { userAnswers[qIndex].userAnswerValue = null; } const isAnsweredNow = userAnswers[qIndex].userAnswerValue !== null; if (wasAnsweredBefore !== isAnsweredNow) { const answeredCount = userAnswers.filter(a => a && a.userAnswerValue !== null).length; if(ui.answeredCountEl) ui.answeredCountEl.textContent = answeredCount; updateProgressBar(); updatePagination(); } console.log(`Odpověď uložena Q#${qIndex + 1}:`, userAnswers[qIndex]); }
    // --- END: Test Logic UI ---

    // --- START: Evaluation & Results UI ---
    async function evaluateAnswersUI() {
        console.log("Spouštím vyhodnocení odpovědí (UI)...");
        showGeminiOverlay(true);
        const promises = [];

        for (let i = 0; i < questions.length; i++) {
            const qData = questions[i];
            const answerData = userAnswers[i];

            if (!answerData) { console.error(`Chyba: Nenalezen objekt odpovědi pro index ${i} (UI)`); continue; }
            if (answerData.userAnswerValue === null || String(answerData.userAnswerValue).trim() === '') {
                answerData.scoreAwarded = 0; answerData.correctness = "skipped";
                answerData.reasoning = "Otázka byla přeskočena nebo odpověď byla prázdná.";
                answerData.error_analysis = null; answerData.feedback = "Příště zkuste odpovědět.";
                answerData.checked_by = 'skipped';
                console.log(`Q#${i+1} (${qData.question_type}) přeskočeno/prázdné (UI).`);
                promises.push(Promise.resolve()); continue;
            }

            // Вызов логической функции для оценки
            promises.push(
                window.TestLogic.checkAnswerWithGemini(
                    qData.question_type, qData.question_text,
                    qData.question_type === 'construction' ? qData.solution_explanation : qData.correct_answer,
                    answerData.userAnswerValue, answerData.maxScore, i
                ).then(evaluationResult => {
                    userAnswers[i].scoreAwarded = evaluationResult.score;
                    userAnswers[i].correctness = evaluationResult.correctness;
                    userAnswers[i].reasoning = evaluationResult.reasoning;
                    userAnswers[i].error_analysis = evaluationResult.error_analysis;
                    userAnswers[i].feedback = evaluationResult.feedback;
                    userAnswers[i].checked_by = evaluationResult.correctness === 'error' || evaluationResult.reasoning.includes("fallback") ? 'fallback_scored' : 'gemini_scored';
                     console.log(`Q#${i+1} (${qData.question_type}) vyhodnoceno (UI): Skóre ${evaluationResult.score}/${answerData.maxScore}, Správnost: ${evaluationResult.correctness}`);
                }).catch(error => {
                    console.error(`Chyba vyhodnocení pro Q#${i+1} (UI):`, error);
                    userAnswers[i].scoreAwarded = 0; userAnswers[i].correctness = 'error';
                    userAnswers[i].reasoning = `Automatické hodnocení selhalo: ${error.message}`;
                    userAnswers[i].error_analysis = "Chyba systému hodnocení.";
                    userAnswers[i].feedback = "Kontaktujte podporu, pokud problém přetrvává.";
                    userAnswers[i].checked_by = 'error';
                })
            );
        }

        await Promise.all(promises);
        showGeminiOverlay(false);
        console.log("Vyhodnocení odpovědí dokončeno (UI):", userAnswers);
    }

    function displayResults() {
        // Эта функция остается без изменений, как в предыдущем ответе test1.js
         if(!ui.testContainer || !ui.resultsContainer || !ui.reviewContainer || !ui.testTimer || !ui.testLevel || !ui.resultScoreEl || !ui.resultPercentageEl || !ui.resultCorrectEl || !ui.resultIncorrectEl || !ui.resultTimeEl || !ui.lowScoreMessageContainer || !ui.continueBtn || !ui.topicResultsEl || !ui.reviewAnswersBtn || !ui.backToResultsBtn) { console.error("Chyba: Některé elementy výsledků nebyly nalezeny v DOM."); return; }
        if (!testResultsData) { console.error("Chyba: Chybí data výsledků (testResultsData)."); showErrorMessagePage("Nepodařilo se zobrazit výsledky - chybí data."); return; }

        ui.testContainer.style.display = 'none';
        ui.resultsContainer.style.display = 'block';
        ui.reviewContainer.style.display = 'none';
        ui.testTimer.style.display = 'none';
        if(ui.testLevel) ui.testLevel.textContent = 'Výsledky testu';

        if(ui.resultScoreEl) ui.resultScoreEl.textContent = `${testResultsData.score}/50`;
        if(ui.resultPercentageEl) ui.resultPercentageEl.textContent = `${testResultsData.percentage}%`;
        if(ui.resultCorrectEl) ui.resultCorrectEl.textContent = testResultsData.correctAnswers;
        if(ui.resultIncorrectEl) ui.resultIncorrectEl.textContent = testResultsData.incorrectAnswers + testResultsData.partiallyCorrectAnswers;
        if(ui.resultTimeEl) ui.resultTimeEl.textContent = formatTime(testResultsData.timeSpent);
        ui.lowScoreMessageContainer.innerHTML = '';
        ui.continueBtn.disabled = true; // Disable initially
        const saveError = ui.continueBtn.getAttribute('data-save-error') === 'true';

        // Use constant from TestLogic
        const scoreThreshold = window.TestLogic?.SCORE_THRESHOLD_FOR_SAVING ?? 5;

        if (saveError) { ui.lowScoreMessageContainer.innerHTML = `<div class="error-message-container"><i class="fas fa-exclamation-triangle"></i><div class="loader-text">Chyba ukládání</div><div class="loader-subtext">Nepodařilo se uložit výsledky testu. Studijní plán nelze vytvořit.</div></div>`; }
        else if (testResultsData.score < scoreThreshold) {
            ui.lowScoreMessageContainer.innerHTML = `<div class="low-score-message warning"><i class="fas fa-exclamation-circle"></i><strong>Výsledek nebyl uložen.</strong><br>Vaše skóre (${testResultsData.score}/50) je nižší než ${scoreThreshold} bodů. Tyto výsledky nebudou použity pro generování studijního plánu.</div>`;
        } else {
            ui.lowScoreMessageContainer.innerHTML = `<div class="low-score-message info"><i class="fas fa-info-circle"></i><strong>Výsledky byly uloženy.</strong><br>Vaše skóre (${testResultsData.score}/50) bude použito pro studijní plán.</div>`;
            ui.continueBtn.disabled = false; // Enable only if score is high enough AND no save error
        }

        const sortedTopics = Object.values(testResultsData.topicResults || {}).sort((a, b) => a.score_percent - b.score_percent);
        ui.topicResultsEl.innerHTML = sortedTopics.map(stats => {
             const icon = topicIcons[stats.name] || topicIcons.default;
             return `<div class="topic-card card ${stats.strength}"> <div class="topic-header">
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

        if (ui.reviewAnswersBtn) ui.reviewAnswersBtn.onclick = displayReview;
        if (ui.backToResultsBtn) ui.backToResultsBtn.onclick = () => { ui.reviewContainer.style.display = 'none'; ui.resultsContainer.style.display = 'block'; if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' }); };
        requestAnimationFrame(() => { if (ui.resultsContainer) { ui.resultsContainer.querySelectorAll('[data-animate]').forEach((el, index) => { el.style.setProperty('--animation-order', index); }); initScrollAnimations(); } });
    }

    function displayReview() {
         // Эта функция остается без изменений, как в предыдущем ответе test1.js
        if (!ui.resultsContainer || !ui.reviewContainer || !ui.reviewContent) { console.error("Elementy pro přehled odpovědí nenalezeny!"); return; }
        ui.resultsContainer.style.display = 'none';
        ui.reviewContainer.style.display = 'block';
        ui.reviewContent.innerHTML = '';

        if (!questions || !userAnswers || questions.length !== userAnswers.length) { ui.reviewContent.innerHTML = '<p class="error-message-container">Chyba: Data pro přehled odpovědí nejsou kompletní.</p>'; return; }

        questions.forEach((q, index) => {
            const answer = userAnswers[index];
            if (!answer) { ui.reviewContent.innerHTML += `<div class="review-question-item skipped card"><p>Chyba: Chybí data odpovědi pro otázku ${index + 1}</p></div>`; return; }

            let itemClass = 'review-question-item card';
            let scoreStatus = '';
            let scoreText = `${answer.scoreAwarded ?? '?'} / ${answer.maxScore} b.`;

            switch (answer.correctness) {
                case 'correct': itemClass += ' correct'; scoreStatus = '<span class="correct">Správně</span>'; break;
                case 'partial': itemClass += ' partial'; scoreStatus = '<span class="partial">Částečně</span>'; break;
                case 'incorrect': itemClass += ' incorrect'; scoreStatus = '<span class="incorrect">Nesprávně</span>'; break;
                case 'skipped': itemClass += ' skipped'; scoreStatus = '<span class="skipped">Přeskočeno</span>'; scoreText = `0 / ${answer.maxScore} b.`; break;
                case 'error': default: itemClass += ' incorrect'; scoreStatus = '<span class="incorrect">Chyba</span>'; scoreText = `? / ${answer.maxScore} b.`; break;
            }

            let reviewHTML = `<div class="${itemClass}">`;
            reviewHTML += `<div class="review-question-header"><span class="review-question-number">${q.question_number}</span><div class="review-question-text">${sanitizeHTML(q.question_text)}</div></div>`;
            if (q.image_url) { reviewHTML += `<div class="question-image-container"><img class="question-image" src="${q.image_url}" alt="Obrázek k otázce ${q.question_number}" loading="lazy"></div>`; }
            reviewHTML += `<div class="review-answer-section">`;
            reviewHTML += `<div class="review-user-answer"><strong>Vaše odpověď:</strong> `;
            if (answer.userAnswerValue !== null) {
                 if (q.question_type === 'multiple_choice') { const selectedLetter = String(answer.userAnswerValue).trim().toUpperCase(); const selectedOptionIndex = selectedLetter.charCodeAt(0) - 65; const optionText = (Array.isArray(q.options) && q.options[selectedOptionIndex] !== undefined) ? sanitizeHTML(q.options[selectedOptionIndex]) : `(Neplatná volba: ${sanitizeHTML(answer.userAnswerValue)})`; reviewHTML += `${selectedLetter}. ${optionText}`; }
                 else { reviewHTML += sanitizeHTML(answer.userAnswerValue); }
            } else { reviewHTML += `<em>(Nezodpovězeno)</em>`; }
            reviewHTML += `</div>`;

            if (q.question_type !== 'construction') {
                 reviewHTML += `<div class="review-correct-answer"><strong>Správná odpověď:</strong> `;
                 if (q.question_type === 'multiple_choice') { const correctLetter = String(q.correct_answer).trim().toUpperCase().replace(/[\.\)\s].*/, ''); const correctOptionIndex = correctLetter.charCodeAt(0) - 65; const correctText = (Array.isArray(q.options) && q.options[correctOptionIndex] !== undefined) ? sanitizeHTML(q.options[correctOptionIndex]) : `(Neplatný text)`; reviewHTML += `${correctLetter}. ${correctText}`; }
                 else { reviewHTML += sanitizeHTML(q.correct_answer); }
                 reviewHTML += `</div>`;
            }
            const explanationToShow = (q.solution_explanation && q.solution_explanation !== "Oficiální postup není k dispozici.") ? q.solution_explanation : answer.reasoning;
             if (explanationToShow) { reviewHTML += `<div class="review-solution"><strong>Zdůvodnění / Postup:</strong><pre><code>${sanitizeHTML(explanationToShow)}</code></pre></div>`; }
             if (answer.error_analysis) { reviewHTML += `<div class="review-solution" style="border-left: 3px solid var(--accent-pink); background-color: rgba(var(--accent-pink-rgb), 0.05);"><strong>Analýza chyby:</strong><p style="margin:0;">${sanitizeHTML(answer.error_analysis)}</p></div>`; }
             if (answer.feedback) { reviewHTML += `<div class="review-solution" style="border-left: 3px solid var(--accent-secondary); background-color: rgba(var(--accent-secondary-rgb), 0.05);"><strong>Zpětná vazba:</strong><p style="margin:0;">${sanitizeHTML(answer.feedback)}</p></div>`; }

            reviewHTML += `<div class="review-score"><strong>Hodnocení:</strong> ${scoreStatus} (${scoreText})</div>`;
            reviewHTML += `</div></div>`; // Close answer-section and review-question-item
            ui.reviewContent.innerHTML += reviewHTML;
        });

        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { try { setTimeout(() => { window.MathJax.typesetPromise([ui.reviewContent]).catch(e => console.error("MathJax error in review:", e)); }, 0); } catch (e) { console.error("MathJax init error in review:", e); } }
        if (ui.reviewContainer) ui.reviewContainer.scrollIntoView({ behavior: 'smooth' });
        requestAnimationFrame(() => { if (ui.reviewContent) { ui.reviewContent.querySelectorAll('.review-question-item').forEach((el, index) => { el.setAttribute('data-animate', ''); el.style.setProperty('--animation-order', index); }); initScrollAnimations(); } });
    }

    async function finishTest() {
        stopTimer();
        if(ui.finishBtn) { ui.finishBtn.disabled = true; ui.finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vyhodnocuji...'; }
        let saveResult = { success: false };
        try {
            await evaluateAnswersUI(); // Calls logic.checkAnswerWithGemini internally
            testResultsData = window.TestLogic.calculateFinalResults(userAnswers, questions); // Calls logic function
            testResultsData.timeSpent = testTime;

            saveResult = await window.TestLogic.saveTestResults(supabase, currentUser, testResultsData, userAnswers, questions, testEndTime); // Calls logic function
            diagnosticId = saveResult.diagnosticId || null;

            displayResults(); // Update UI based on calculated results and save status

            if (saveResult.success) {
                const pointsResult = await window.TestLogic.awardPoints(supabase, currentUser, currentProfile, selectedTestType, testResultsData, testTypeConfig); // Calls logic function
                 if (pointsResult?.success) {
                     currentProfile.points = pointsResult.newTotal;
                     showToast(`${pointsResult.awardedPoints} kreditů získáno!`, 'success');
                 } else if (pointsResult && pointsResult.error) { showToast(`Nepodařilo se připsat body: ${pointsResult.error}`, 'warning'); }
            } else {
                console.warn("Výsledky nebyly úspěšně uloženy nebo byly pod limitem, body nebudou přiděleny.");
                if(ui.continueBtn) { ui.continueBtn.disabled = true; if(saveResult.error && !saveResult.error.includes('Skóre je příliš nízké')) { ui.continueBtn.setAttribute('data-save-error', 'true'); } }
                displayResults(); // Re-render results to show correct button state/message
            }
            history.pushState({ state: 'testFinished' }, document.title, window.location.href);
        } catch (error) {
            console.error("Chyba při dokončování testu:", error);
            showGeminiOverlay(false);
            if (!testResultsData) { testResultsData = { score: 0, percentage: 0, correctAnswers: 0, incorrectAnswers: questions.length, partiallyCorrectAnswers: 0, skippedAnswers: 0, timeSpent: testTime, topicResults: {}, evaluationErrors: questions.length }; }
            displayResults();
            if(ui.lowScoreMessageContainer) { ui.lowScoreMessageContainer.innerHTML = `<div class="error-message-container"><i class="fas fa-exclamation-triangle"></i><div class="loader-text">Chyba!</div><div class="loader-subtext">Chyba vyhodnocení/ukládání: ${error.message}. Výsledky nemusí být kompletní nebo uložené.</div></div>`; }
            if(ui.continueBtn) { ui.continueBtn.disabled = true; ui.continueBtn.setAttribute('data-save-error', 'true'); }
            history.pushState({ state: 'testFinishedWithError' }, document.title, window.location.href);
        } finally {
            if(ui.finishBtn) { ui.finishBtn.disabled = false; ui.finishBtn.innerHTML = '<i class="fas fa-check-circle"></i> Dokončit test'; }
        }
    }
    // --- END: Evaluation & Results UI ---

    // --- START: Notification Logic (UI Interaction) ---
    async function fetchAndRenderNotifications() {
        if (!currentUser || !window.TestLogic) return; // Check if TestLogic is loaded
        setLoadingState('notifications', true);
        try {
            // Вызов логической функции из TestLogic
            const { unreadCount, notifications } = await window.TestLogic.fetchNotifications(supabase, currentUser.id, 5); // Use NOTIFICATION_FETCH_LIMIT if needed
            renderNotifications(unreadCount, notifications);
        } catch (error) {
            console.error("[UI] Chyba při načítání notifikací:", error);
            renderNotifications(0, []); // Render empty state on error
        } finally {
            setLoadingState('notifications', false);
        }
    }

    function renderNotifications(count, notifications) {
        // Эта функция остается без изменений, как в предыдущем ответе test1.js
         console.log("[Render Notifications UI] Start, Count:", count, "Notifications:", notifications);
         if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications UI] Missing UI elements."); return; }
         ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
         ui.notificationCount.classList.toggle('visible', count > 0);

         if (notifications && notifications.length > 0) {
             ui.notificationsList.innerHTML = notifications.map(n => {
                 const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; // Use visuals map
                 const isReadClass = n.is_read ? 'is-read' : '';
                 const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : '';
                 return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
                             ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
                             <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div>
                             <div class="notification-content">
                                 <div class="notification-title">${sanitizeHTML(n.title)}</div>
                                 <div class="notification-message">${sanitizeHTML(n.message)}</div>
                                 <div class="notification-time">${formatRelativeTime(n.created_at)}</div>
                             </div>
                         </div>`;
             }).join('');
             ui.noNotificationsMsg.style.display = 'none';
             ui.notificationsList.style.display = 'block';
             ui.markAllReadBtn.disabled = count === 0;
         } else {
             ui.notificationsList.innerHTML = '';
             ui.noNotificationsMsg.style.display = 'block';
             ui.notificationsList.style.display = 'none';
             ui.markAllReadBtn.disabled = true;
         }
         console.log("[Render Notifications UI] Finished rendering.");
    }

    async function markNotificationReadUI(notificationId) {
        // Эта функция остается без изменений, как в предыдущем ответе test1.js
        console.log("[UI] Mark Notification Read:", notificationId);
        if (!currentUser || !notificationId) return;
        try {
            const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId);
            if (error) throw error;
            console.log("[UI] Mark as read successful for ID:", notificationId);
            const item = ui.notificationsList.querySelector(`.notification-item[data-id="${notificationId}"]`);
            if(item) {
                 item.classList.add('is-read');
                 item.querySelector('.unread-dot')?.remove();
                 const currentCountText = ui.notificationCount?.textContent?.replace('+', '') || '0';
                 const currentCount = parseInt(currentCountText) || 0;
                 const newCount = Math.max(0, currentCount - 1);
                 ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                 ui.notificationCount.classList.toggle('visible', newCount > 0);
                 if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0;
            }
        } catch (error) {
            console.error("[UI] Mark as read error:", error);
            showToast('Chyba označení oznámení.', 'error');
        }
    }

    async function markAllNotificationsReadUI() {
        // Эта функция остается без изменений, как в предыдущем ответе test1.js
        console.log("[UI] Mark All Notifications Read");
        if (!currentUser || !ui.markAllReadBtn || ui.markAllReadBtn.disabled) return;
        setLoadingState('notifications', true);
        ui.markAllReadBtn.disabled = true;
        try {
             const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false);
             if (error) throw error;
             console.log("[UI] Mark all as read successful in DB.");
              await fetchAndRenderNotifications();
              showToast('Oznámení označena jako přečtená.', 'success');
        } catch (error) {
            console.error("[UI] Mark all as read error:", error);
            showToast('Chyba při označování oznámení.', 'error');
             const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0');
             if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = currentCount === 0;
        } finally {
             setLoadingState('notifications', false);
        }
    }
    // --- END: Notification Logic ---

    // --- START: Event Listeners Setup ---
    function setupEventListeners() {
         // Эта функция остается без изменений, как в предыдущем ответе test1.js
         console.log("[SETUP] Nastavování posluchačů událostí...");
         if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
         if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
         if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
         document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });
         if (ui.prevBtn) ui.prevBtn.addEventListener('click', () => { if (currentQuestionIndex > 0) showQuestion(currentQuestionIndex - 1); });
         if (ui.nextBtn) ui.nextBtn.addEventListener('click', () => { if (currentQuestionIndex < questions.length - 1) showQuestion(currentQuestionIndex + 1); });
         if (ui.finishBtn) { ui.finishBtn.addEventListener('click', async () => { const unansweredCount = userAnswers.filter(a => a && a.userAnswerValue === null).length; let confirmFinish = true; if (unansweredCount > 0) confirmFinish = confirm(`Nezodpověděli jste ${unansweredCount} ${unansweredCount === 1 ? 'otázku' : (unansweredCount < 5 ? 'otázky' : 'otázek')}. Přesto dokončit?`); else confirmFinish = confirm('Opravdu chcete dokončit test?'); if (confirmFinish) { await finishTest(); } }); }
         if (ui.retryBtn) { ui.retryBtn.addEventListener('click', () => { ui.resultsContainer.style.display = 'none'; ui.reviewContainer.style.display = 'none'; if (ui.testSelector) ui.testSelector.style.display = 'block'; questions = []; userAnswers = []; testResultsData = {}; diagnosticId = null; selectedTestType = null; ui.testTypeCards.forEach(c => c.classList.remove('selected')); if(ui.lowScoreMessageContainer) ui.lowScoreMessageContainer.innerHTML = ''; if (ui.continueBtn) { ui.continueBtn.disabled = true; ui.continueBtn.removeAttribute('data-save-error'); } if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu'; history.replaceState({ state: 'testSelection' }, document.title, window.location.href); }); }
         if (ui.continueBtn) { ui.continueBtn.addEventListener('click', () => { if (!ui.continueBtn.disabled) window.location.href = `/dashboard/procvicovani/plan.html`; }); }
         if (ui.reviewAnswersBtn) ui.reviewAnswersBtn.addEventListener('click', displayReview);
         if (ui.backToResultsBtn) ui.backToResultsBtn.addEventListener('click', () => { if(ui.reviewContainer) ui.reviewContainer.style.display = 'none'; if(ui.resultsContainer) ui.resultsContainer.style.display = 'block'; if(ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' }); });
         ui.testTypeCards.forEach(card => { card.addEventListener('click', function(event) { const testType = this.dataset.testType; const isButtonClicked = event.target.closest('.select-test-btn'); ui.testTypeCards.forEach(c => c.classList.remove('selected')); this.classList.add('selected'); selectedTestType = testType; if (isButtonClicked) { event.stopPropagation(); startSelectedTest(); } }); });
         ui.selectTestBtns.forEach(button => { button.addEventListener('click', function(event) { event.stopPropagation(); const testType = this.closest('.test-type-card').dataset.testType; ui.testTypeCards.forEach(c => c.classList.remove('selected')); this.closest('.test-type-card').classList.add('selected'); selectedTestType = testType; startSelectedTest(); }); });
         window.addEventListener('popstate', handleBackButton);
         window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) closeMenu(); });
         if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
         if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsReadUI); }
         if (ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { await markNotificationReadUI(notificationId); } if (link) window.location.href = link; } }); }
         document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } });
         window.addEventListener('online', updateOnlineStatus);
         window.addEventListener('offline', updateOnlineStatus);
         console.log("[SETUP] Posluchači událostí nastaveni.");
    }
    // --- END: Event Listeners Setup ---

    // --- START: Test Flow & Back Button ---
    function startSelectedTest() {
        // Эта функция остается без изменений, как в предыдущем ответе test1.js
        if (!selectedTestType) { showToast('Vyberte prosím typ testu.', 'warning'); return; }
        const config = testTypeConfig[selectedTestType];
        if (!config) { showErrorMessagePage(`Neznámý typ testu: ${selectedTestType}`); return; }
        if(ui.currentTestTitle) ui.currentTestTitle.textContent = config.title;
        if(ui.testLevel) ui.testLevel.textContent = config.description;
        if (ui.testSelector) ui.testSelector.style.display = 'none';
        if (ui.testLoader) ui.testLoader.style.display = 'flex';
        if (ui.loaderSubtext) ui.loaderSubtext.textContent = 'Načítám otázky...';
        if (ui.testContainer) ui.testContainer.style.display = 'none';
        if (ui.resultsContainer) ui.resultsContainer.style.display = 'none';
        if (ui.reviewContainer) ui.reviewContainer.style.display = 'none';
        if (ui.testTimer) ui.testTimer.style.display = 'flex'; // Показываем таймер при старте
        history.pushState({ state: 'testInProgress' }, document.title, window.location.href);
        loadTestQuestions(selectedTestType); // Вызываем обертку
    }
    function handleBackButton(event) {
        // Эта функция остается без изменений, как в предыдущем ответе test1.js
        const state = event.state ? event.state.state : null; const testIsRunning = ui.testContainer && ui.testContainer.style.display === 'block'; const resultsAreShown = ui.resultsContainer && ui.resultsContainer.style.display === 'block'; const reviewIsShown = ui.reviewContainer && ui.reviewContainer.style.display === 'block'; if (reviewIsShown) { ui.reviewContainer.style.display = 'none'; if (ui.resultsContainer) ui.resultsContainer.style.display = 'block'; } else if (testIsRunning) { if (!confirm('Opustit test? Postup nebude uložen.')) { history.pushState({ state: 'testInProgress' }, document.title, window.location.href); } else { stopTimer(); if (ui.testContainer) ui.testContainer.style.display = 'none'; if (ui.testLoader) ui.testLoader.style.display = 'none'; if (ui.testSelector) ui.testSelector.style.display = 'block'; if (ui.testTimer) ui.testTimer.style.display = 'none'; if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu'; } } else if (resultsAreShown) { if(ui.resultsContainer) ui.resultsContainer.style.display = 'none'; if (ui.testSelector) ui.testSelector.style.display = 'block'; if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu'; } else { console.log("Navigace zpět (výchozí chování)."); } }
    // --- END: Test Flow & Back Button ---

    // --- START: App Initialization ---
    async function initializeApp() {
        console.log("🚀 [Init Test1 UI - Kyber v2] Starting...");
        if (!initializeSupabase()) return; // Инициализация Supabase

        // Проверка загрузки логики
        if (typeof window.TestLogic === 'undefined') {
            showErrorMessagePage("Kritická chyba: Chybí základní logika testu (test1-logic.js). Obnovte stránku.");
            return;
        }

        if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
        if (ui.mainContent) { ui.mainContent.style.display = 'none'; ui.mainContent.classList.remove('loaded'); }

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);

            if (!session || !session.user) { console.log('[Init Test1 UI - Kyber v2] Not logged in. Redirecting...'); window.location.href = '/auth/index.html'; return; }
            currentUser = session.user;
            currentProfile = await fetchUserProfile(currentUser.id);
            updateUserInfoUI();

            if (!currentProfile) { showError("Profil nenalezen. Test nelze spustit.", true); if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => {if(ui.initialLoader) ui.initialLoader.style.display = 'none';}, 300); } if (ui.mainContent) ui.mainContent.style.display = 'block'; return; }

            setupEventListeners();
            initTooltips();
            initMouseFollower();
            initHeaderScrollDetection();
            updateCopyrightYear();
            updateOnlineStatus();

            // Загрузка уведомлений
            await fetchAndRenderNotifications();

            // ИСПРАВЛЕНИЕ: Проверка существующего теста и управление потоком
            setLoadingState('test', true); // Показываем загрузчик перед проверкой
            const hasCompletedTest = await checkExistingDiagnostic(currentUser.id);
            setLoadingState('test', false); // Скрываем загрузчик после проверки

            if (hasCompletedTest) {
                 console.log("[Init] Test již dokončen, zobrazuji zprávu.");
                 if(ui.testSelector) {
                    // Отображаем сообщение о завершенном тесте
                    ui.testSelector.innerHTML = `<div class="section card" data-animate style="--animation-order: 0;"><h2 class="section-title"><i class="fas fa-check-circle" style="color: var(--accent-lime);"></i> Test již dokončen</h2><p>Tento diagnostický test jste již absolvoval/a. <strong>Tento test nelze opakovat.</strong> Vaše výsledky byly použity k vytvoření studijního plánu.</p><div style="margin-top:1.5rem; display:flex; gap:1rem; flex-wrap:wrap;"><a href="plan.html" class="btn btn-primary"><i class="fas fa-tasks"></i> Zobrazit plán</a><a href="main.html" class="btn btn-secondary"><i class="fas fa-arrow-left"></i> Zpět</a></div></div>`;
                    ui.testSelector.style.display = 'block';
                    requestAnimationFrame(initScrollAnimations); // Запускаем анимацию для этого блока
                 }
                 if(ui.testLoader) ui.testLoader.style.display = 'none'; // Скрываем основной загрузчик теста
                 if(ui.testLevel) ui.testLevel.textContent = 'Dokončeno'; // Обновляем статус в хедере
            } else {
                 console.log("[Init] Test nebyl dokončen, zobrazuji výběr typu testu.");
                 // Отображаем секцию выбора теста
                 if(ui.testSelector) {
                     ui.testSelector.style.display = 'block';
                     // Запускаем анимацию для карточек выбора теста
                     requestAnimationFrame(() => { ui.testSelector.querySelectorAll('.test-type-card').forEach((el, index) => { el.setAttribute('data-animate', ''); el.style.setProperty('--animation-order', index); }); initScrollAnimations(); });
                 }
                 if(ui.testLoader) ui.testLoader.style.display = 'none'; // Скрываем загрузчик теста
                 if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu'; // Статус в хедере
            }
            // Конец ИСПРАВЛЕНИЯ

            if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }
            if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); }); }

            console.log("✅ [Init Test1 UI - Kyber v2] Page initialized.");

        } catch (error) {
            console.error("❌ [Init Test1 UI - Kyber v2] Error:", error);
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">Chyba (${error.message}). Obnovte.</p>`; }
            else { showError(`Chyba inicializace: ${error.message}`, true); }
            if (ui.mainContent) ui.mainContent.style.display = 'block';
            setLoadingState('all', false);
        }
    }

    // --- Initialize Supabase and App ---
    function initializeSupabase() {
        // Эта функция остается без изменений, как в предыдущем ответе test1.js
        try {
            if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded."); }
            supabase = window.supabase.createClient(
                 'https://qcimhjjwvsbgjsitmvuh.supabase.co',
                 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10'
            );
            if (!supabase) throw new Error("Supabase client creation failed.");
            console.log('[Supabase] Client initialized.');
            return true;
        } catch (error) {
            console.error('[Supabase] Initialization failed:', error);
            showErrorMessagePage("Kritická chyba: Nelze se připojit k databázi.");
            return false;
        }
    }

    // --- Run Application ---
    initializeApp(); // Вызов инициализации

})(); // End IIFE