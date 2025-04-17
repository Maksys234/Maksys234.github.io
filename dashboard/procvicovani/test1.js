// Using an immediately invoked function expression (IIFE)
(function() {
    // --- START: Инициализация и Конфигурация ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    // !!! WARNING: API Key exposed in client-side code. Move to a secure backend/environment variable in production!
    const GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let questions = [];
    let currentQuestionIndex = 0;
    let userAnswers = []; // Array to store detailed answer objects
    let timer = null;
    let testTime = 0;
    let testStartTime = null;
    let testEndTime = null;
    let testResultsData = { /* Stores final calculated results */ };
    let diagnosticId = null; // ID of the saved diagnostic test in the DB
    let selectedTestType = null; // e.g., 'quick', 'full', 'absolute'
    let isLoading = { page: true, test: false, results: false, notifications: false }; // Loading states

    // Test Type Configuration
    const testTypeConfig = {
        quick: { questionsCount: 10, title: 'Rychlý diagnostický test', description: 'Základní prověření', multiplier: 1.0 },
        full: { questionsCount: 20, title: 'Kompletní diagnostický test', description: 'Podrobné hodnocení', multiplier: 1.5 },
        absolute: { questionsCount: 30, title: 'Absolutní test znalostí', description: 'Důkladná prověrka', multiplier: 2.0 }
    };
    // Topic Icons Mapping
    const topicIcons = { "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon", "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar", "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar", "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book" };
    // Minimum score to save results and generate plan
    const SCORE_THRESHOLD_FOR_SAVING = 5;

    // DOM Cache (Cyberpunk theme)
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
    // Visual map for notification icons
    const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

    // --- START: Helper Functions ---
    function showToast(title, message, type = 'info', duration = 4500) { if (!ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } }
    function showError(message, isGlobal = false) { console.error("Došlo k chybě:", message); if (isGlobal && ui.globalError) { ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Zkusit Znovu</button></div>`; ui.globalError.style.display = 'block'; } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); } }
    function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
    function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
    function getInitials(profileData) { if (!profileData) return '?'; const f = profileData.first_name?.[0] || ''; const l = profileData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = profileData.username?.[0].toUpperCase() || ''; const emailInitial = profileData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
    function formatDate(dateString) { if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) return '-'; return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return '-'; } }
    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return '--:--'; const m = Math.floor(seconds / 60); const s = Math.round(seconds % 60); return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; }
    function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
    function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
    function toggleMobileMenu() { closeMenu(); } // Simplified toggle for header button
    function updateUserInfoUI() { if (!ui.sidebarName || !ui.sidebarAvatar) return; if (currentUser && currentProfile) { const displayName = `${currentProfile.first_name || ''} ${currentProfile.last_name || ''}`.trim() || currentProfile.username || currentUser.email?.split('@')[0] || 'Pilot'; ui.sidebarName.textContent = displayName; const initials = getInitials(currentProfile); ui.sidebarAvatar.innerHTML = currentProfile.avatar_url ? `<img src="${currentProfile.avatar_url}" alt="${displayName}">` : initials; } else { ui.sidebarName.textContent = 'Nepřihlášen'; ui.sidebarAvatar.textContent = '?'; } }
    function handleScroll() { if (!ui.mainContent || !ui.dashboardHeader) return; document.body.classList.toggle('scrolled', ui.mainContent.scrollTop > 10); }
    function shuffleArray(array){ for(let i = array.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
    function indexToLetter(index){ return String.fromCharCode(65 + index); }
    function compareNumericAdvanced(val1, val2, tolerance = 0.001) { if (val1 === null || val1 === undefined || val2 === null || val2 === undefined) return null; const normalize = (v) => { if (typeof v === 'number') return v; if (typeof v !== 'string') return NaN; let str = v.trim().replace(',', '.').replace(/\s+/g, '').replace(/kč|czk|%/gi, '').trim(); if (str.includes('/') && !str.startsWith('.') && !str.endsWith('.')) { const parts = str.split('/'); if (parts.length === 2) { const num = parseFloat(parts[0]), den = parseFloat(parts[1]); if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den; } } const mixedMatch = str.match(/^(-?\d+)\s+(\d+)\/(\d+)$/); if (mixedMatch) { const whole = parseFloat(mixedMatch[1]), num = parseFloat(mixedMatch[2]), den = parseFloat(mixedMatch[3]); if (!isNaN(whole) && !isNaN(num) && !isNaN(den) && den !== 0) { return whole + (num / den) * Math.sign(whole || 1); } } return parseFloat(str); }; const num1 = normalize(val1), num2 = normalize(val2); console.log(`[compareNumeric] Porovnávám normalizované: ${num1} vs ${num2}`); if (isNaN(num1) || isNaN(num2)) { if (typeof val1 === 'string' && typeof val2 === 'string' && val1.trim().toLowerCase() === val2.trim().toLowerCase()) { return true; } console.log("[compareNumeric] Nelze porovnat numericky (NaN)."); return null; } const areEquivalent = Math.abs(num1 - num2) < tolerance; console.log(`[compareNumeric] Výsledek (tolerance ${tolerance}): ${areEquivalent}`); return areEquivalent; }
    function compareTextAdvanced(val1, val2) { if (val1 === null || val1 === undefined || val2 === null || val2 === undefined) return false; const normalize = (v) => { let str = String(v).trim().toLowerCase().replace(/^[a-z][\.\)\s]*=*\s*/, ''); if (str.startsWith('ano') || str.startsWith('ne')) { return str.split(/[\s\.\(]/)[0]; } return str; }; const norm1 = normalize(val1), norm2 = normalize(val2); console.log(`[compareText] Porovnávám normalizované: '${norm1}' vs '${norm2}'`); const areEquivalent = norm1 === norm2; console.log(`[compareText] Výsledek: ${areEquivalent}`); return areEquivalent; }
    function showGeminiOverlay(show){ if(ui.geminiOverlay) ui.geminiOverlay.style.display = show ? 'flex' : 'none'; }
    function showErrorMessagePage(message){ console.error("Error Page:", message); if (ui.testSelector) ui.testSelector.style.display = 'none'; if (ui.testContainer) ui.testContainer.style.display = 'none'; if (ui.resultsContainer) ui.resultsContainer.style.display = 'none'; if (ui.reviewContainer) ui.reviewContainer.style.display = 'none'; if (ui.geminiOverlay) ui.geminiOverlay.style.display = 'none'; if (ui.globalError) { showError(message, true); } else if (ui.mainContent) { ui.mainContent.innerHTML = `<div class="section error-message-container"><i class="fas fa-exclamation-triangle"></i><div class="loader-text">Chyba!</div><div class="loader-subtext">${sanitizeHTML(message)}</div><button class="btn btn-primary" style="margin-top:1.5rem;" onclick="location.reload()"><i class="fas fa-redo"></i> Zkusit znovu</button></div>`; ui.mainContent.style.display = 'block'; } else { document.body.innerHTML = `<div style='padding: 2rem; color: red;'><h1>Chyba</h1><p>${sanitizeHTML(message)}</p><button onclick="location.reload()">Obnovit</button></div>`; } if (ui.initialLoader && ui.initialLoader.style.display !== 'none') { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if(ui.initialLoader) ui.initialLoader.style.display = 'none';}, 300); } }
    function formatRelativeTime(timestamp) { if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    const initTooltips = () => { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 100, side: 'top' }); } } catch (e) { console.error("Chyba inicializace Tooltipster:", e); } };
    const updateCopyrightYear = () => { const year = new Date().getFullYear(); if (ui.currentYearFooter) ui.currentYearFooter.textContent = year; if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year; };
    const initMouseFollower = () => { const follower = ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    const initScrollAnimations = () => { const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]'); if (!animatedElements.length || !('IntersectionObserver' in window)) { console.log("Scroll animations not initialized."); return; } const observer = new IntersectionObserver((entries, observerInstance) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); animatedElements.forEach(element => observer.observe(element)); console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); };
    const initHeaderScrollDetection = () => { let lastScrollY = window.scrollY; const mainEl = ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); };
    function updateOnlineStatus() { if (ui.offlineBanner) { ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; } if (!navigator.onLine) { showToast('Offline', 'Spojení bylo ztraceno. Některé funkce nemusí být dostupné.', 'warning'); } }
    function setLoadingState(section, isLoadingFlag) { if (isLoading[section] === isLoadingFlag && section !== 'all') return; if (section === 'all') { Object.keys(isLoading).forEach(key => isLoading[key] = isLoadingFlag); } else { isLoading[section] = isLoadingFlag; } console.log(`[SetLoading] Section: ${section}, isLoading: ${isLoadingFlag}`); if (section === 'test') { if (ui.testLoader) ui.testLoader.style.display = isLoadingFlag ? 'flex' : 'none'; if (ui.testContainer) ui.testContainer.style.display = isLoadingFlag ? 'none' : 'block'; } else if (section === 'results') { /* Handle results loading if needed */ } else if (section === 'notifications') { if(ui.notificationBell) ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1; if (ui.markAllReadBtn) { const currentUnreadCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = isLoadingFlag || currentUnreadCount === 0; } } }
    // --- END: Helper Functions ---

    // --- START: Data Fetching & Initialization Logic ---
    function initializeSupabase() { try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Supabase library not loaded."); } supabase = window.supabase.createClient(supabaseUrl, supabaseKey); if (!supabase) throw new Error("Supabase client creation failed."); console.log('[Supabase] Client initialized.'); return true; } catch (error) { console.error('[Supabase] Initialization failed:', error); showError("Kritická chyba: Nelze se připojit.", true); if (ui.initialLoader) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">Chyba připojení. Obnovte stránku.</p>`;} return false; } }
    async function fetchUserProfile(userId) { if (!supabase || !userId) return null; console.log(`[Profile] Fetching profile for user ID: ${userId}`); try { const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).single(); if (error && error.code !== 'PGRST116') throw error; if (!profile) { console.warn(`[Profile] Profile not found for user ${userId}.`); return null; } console.log("[Profile] Profile data fetched."); return profile; } catch (error) { console.error('[Profile] Exception fetching profile:', error); showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error'); return null; } }
    async function checkExistingDiagnostic(userId) { if (!userId || userId === 'PLACEHOLDER_USER_ID' || !supabase) { console.warn("Kontrola testu přeskočena (není user/supabase)."); return false; } try { if (ui.loaderSubtext) ui.loaderSubtext.textContent = 'Kontroluji předchozí testy...'; const { data: existingDiagnostic, error } = await supabase.from('user_diagnostics').select('id, completed_at').eq('user_id', userId).limit(1); if (error) { console.error("Chyba při kontrole existujícího testu:", error); showToast("Varování", "Nepodařilo se ověřit historii testů.", "warning"); return false; } return existingDiagnostic && existingDiagnostic.length > 0; } catch(err) { console.error("Neočekávaná chyba při kontrole testu:", err); showToast("Chyba", "Nastala neočekávaná chyba při kontrole testů.", "error"); return false; } }
    async function loadTestQuestions(testType) {
        setLoadingState('test', true);
        try {
            const config = testTypeConfig[testType];
            const questionCount = config.questionsCount;
            console.log(`[Questions] Loading ${questionCount} questions for type: ${testType}...`);
            const { data: allQuestions, error: fetchError } = await supabase
                .from('exam_questions')
                .select(`
                    id, question_text, question_type, options, correct_answer,
                    solution_explanation, topic_id, subtopic_id, difficulty, image_url,
                    source_year, source_exam_type,
                    topic:topic_id ( id, name ),
                    subtopic:subtopic_id ( id, name )
                `);

            if (fetchError) throw fetchError;
            if (!allQuestions || allQuestions.length === 0) throw new Error("V databázi nejsou žádné otázky.");

            const shuffledQuestions = shuffleArray(allQuestions);
            const selectedQuestions = shuffledQuestions.slice(0, questionCount);

            questions = selectedQuestions.map((q, index) => ({
                id: q.id, question_number: index + 1, question_text: q.question_text,
                question_type: q.question_type, options: q.options,
                correct_answer: q.correct_answer,
                solution_explanation: q.solution_explanation || "Oficiální postup není k dispozici.",
                topic_id: q.topic_id, topic_name: q.topic ? q.topic.name : "Neznámé téma",
                subtopic_id: q.subtopic_id, subtopic_name: q.subtopic ? q.subtopic.name : "",
                difficulty: q.difficulty, image_url: q.image_url,
                source_year: q.source_year, source_exam_type: q.source_exam_type
            }));

            console.log("[Questions] Selected questions:", questions);
            if (questions.length === 0) throw new Error("Nepodařilo se vybrat žádné otázky.");
            initializeTest(); // Start the test UI
        } catch (error) {
            console.error('[Questions] Error loading:', error);
            showErrorMessagePage(`Nepodařilo se načíst otázky: ${error.message}`);
        } finally {
            setLoadingState('test', false);
        }
    }
     // --- END: Data Fetching & Initialization Logic ---

    // --- START: Test Logic ---
    function initializeTest() {
        if (ui.testLoader) ui.testLoader.style.display = 'none';
        if (ui.testContainer) ui.testContainer.style.display = 'block';
        if (ui.resultsContainer) ui.resultsContainer.style.display = 'none';
        if (ui.reviewContainer) ui.reviewContainer.style.display = 'none';
        if (ui.testSelector) ui.testSelector.style.display = 'none';
        if (ui.testTimer) ui.testTimer.style.display = 'flex';
        currentQuestionIndex = 0;
        // Initialize userAnswers array with detailed structure
        userAnswers = new Array(questions.length).fill(null).map((_, idx) => {
            const q = questions[idx];
            let maxScore = 1;
            const difficultyInt = parseInt(q.difficulty);
            if (q.question_type === 'construction') maxScore = 2;
            else if (!isNaN(difficultyInt)) { if (difficultyInt >= 4) maxScore = 3; else if (difficultyInt === 3) maxScore = 2; }
            return {
                question_db_id: q.id,
                question_number_in_test: q.question_number,
                question_text: q.question_text,
                question_type: q.question_type,
                options: q.options,
                correct_answer: q.correct_answer,
                solution_explanation: q.solution_explanation, // Store explanation
                image_url: q.image_url,
                topic_id: q.topic_id,
                topic_name: q.topic_name,
                subtopic_id: q.subtopic_id,
                subtopic_name: q.subtopic_name,
                difficulty: q.difficulty,
                userAnswerValue: null, // Will be filled by user
                scoreAwarded: null,    // Will be filled by evaluation
                maxScore: maxScore,    // Calculated max score
                checked_by: null,      // Who checked (e.g., 'skipped', 'gemini_scored', 'error')
                correctness: null,     // 'correct', 'incorrect', 'partial', 'skipped'
                reasoning: null,       // Explanation from Gemini
                error_analysis: null,  // Error analysis from Gemini
                feedback: null         // Feedback from Gemini
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
    }
    function startTimer() { if(timer)clearInterval(timer); testStartTime=new Date(); testTime=0; if(ui.timerValue) ui.timerValue.textContent=formatTime(testTime); ui.testTimer?.classList.remove('timer-warning','timer-danger'); timer=setInterval(()=>{testTime++; if(ui.timerValue) ui.timerValue.textContent=formatTime(testTime); const config=testTypeConfig[selectedTestType]; if(!config)return; const estimatedTime=config.questionsCount*1.5*60; const warningTime=estimatedTime*0.8; if(testTime>estimatedTime){ui.testTimer?.classList.add('timer-danger'); ui.testTimer?.classList.remove('timer-warning');}else if(testTime>warningTime){ui.testTimer?.classList.add('timer-warning'); ui.testTimer?.classList.remove('timer-danger');}},1000); }
    function stopTimer() { clearInterval(timer); timer = null; testEndTime = new Date(); }
    function showQuestion(index) {
         if (index < 0 || index >= questions.length || !ui.questionContainer) return;
         const question = questions[index];
         console.log(`Zobrazuji Q#${index + 1}`, question);
         currentQuestionIndex = index;

         if(ui.questionCountEl) ui.questionCountEl.textContent = `${index + 1} / ${questions.length}`;

         let questionHTML = `<div class="question-header">
                                 <span class="question-number">${question.question_number}</span>
                                 <div class="question-text">${sanitizeHTML(question.question_text)}</div>
                             </div>`;

         if (question.image_url) { questionHTML += `<div class="question-image-container"><img class="question-image" src="${question.image_url}" alt="Obrázek k otázce ${question.question_number}" loading="lazy"></div>`; }

         // Retrieve saved value from the structured answer object
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
                         const isSelected = savedValue === optionLetter; // Check against saved value
                         const displayText = (typeof optionText === 'string' || typeof optionText === 'number') ? sanitizeHTML(optionText) : `(neplatný text ${idx+1})`;
                         questionHTML += `<label class="answer-option ${isSelected ? 'selected' : ''}" data-option-id="${optionLetter}"><input type="radio" name="question_${question.id || index}" value="${optionLetter}" ${isSelected ? 'checked' : ''} style="display: none;"><div class="answer-text"><span class="answer-letter">${optionLetter}.</span> ${displayText}</div></label>`;
                     });
                 }
                 questionHTML += `</div>`;
                 break;
             case 'construction':
                 questionHTML += `<div class="answer-input-container"><label for="construction-answer-${index}" class="form-label">Popište svůj postup:</label><textarea id="construction-answer-${index}" class="construction-textarea" placeholder="Podrobně popište kroky...">${sanitizeHTML(savedValue || '')}</textarea></div>`;
                 break;
             default:
                 let inputType = "text";
                 if (question.question_type === 'numeric') { inputType = "text"; /* Use text for more flexible numeric input (fractions, decimals) */}
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

         if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { try { setTimeout(() => { window.MathJax.typesetPromise([ui.questionContainer]).catch(e=>console.error("MathJax typesetting error:", e)); }, 0); } catch(e) { console.error("MathJax initialization error:", e); } }
    }
    function handleAnswerSelection(event) { const selectedLabel=event.currentTarget;const qIndex=currentQuestionIndex;const optionId=selectedLabel.dataset.optionId;const radio=selectedLabel.querySelector('input[type="radio"]');ui.questionContainer.querySelectorAll('.answer-option').forEach(label=>{label.classList.remove('selected');});selectedLabel.classList.add('selected');if(radio)radio.checked=true;saveAnswer(qIndex,optionId);}
    function createPagination() { if(!ui.pagination) return; ui.pagination.innerHTML=questions.map((_,i)=>`<div class="page-item" data-question="${i}">${i+1}</div>`).join(''); ui.pagination.querySelectorAll('.page-item').forEach(item=>{item.addEventListener('click',()=>{showQuestion(parseInt(item.dataset.question));});}); updatePagination(); }
    function updatePagination() { ui.pagination?.querySelectorAll('.page-item').forEach((item,index)=>{item.classList.remove('active','answered');if(index===currentQuestionIndex)item.classList.add('active');if(userAnswers[index] && userAnswers[index].userAnswerValue !== null)item.classList.add('answered');}); } // Check userAnswerValue
    function updateNavigationButtons() { if(ui.prevBtn) ui.prevBtn.disabled = currentQuestionIndex === 0; if(ui.nextBtn) ui.nextBtn.disabled = currentQuestionIndex === questions.length - 1; if(ui.finishBtn) { ui.finishBtn.style.display = currentQuestionIndex === questions.length - 1 ? 'flex' : 'none'; ui.finishBtn.disabled = false; ui.finishBtn.innerHTML = '<i class="fas fa-check-circle"></i> Dokončit test'; } }
    function updateProgressBar() { if (!ui.progressBar) return; const answeredCount = userAnswers.filter(a => a && a.userAnswerValue !== null).length; const progress = (answeredCount / questions.length) * 100; ui.progressBar.style.width = `${progress}%`; }
    function saveAnswer(qIndex, userAnswerValue) {
        if (!userAnswers[qIndex]) { console.error(`Chyba: Chybí objekt odpovědi pro index ${qIndex}`); return; } // Safety check
        const wasAnsweredBefore = userAnswers[qIndex].userAnswerValue !== null;
        const isEmptyAnswer = typeof userAnswerValue === 'string' && userAnswerValue.trim() === '';

        if (!isEmptyAnswer) {
            userAnswers[qIndex].userAnswerValue = userAnswerValue;
            // Keep other fields (scoreAwarded, correctness etc.) as they are until evaluation
        } else {
            userAnswers[qIndex].userAnswerValue = null; // Set back to null if cleared
            // Reset evaluation fields if answer is cleared? Optional.
            // userAnswers[qIndex].scoreAwarded = null;
            // userAnswers[qIndex].correctness = null;
            // userAnswers[qIndex].reasoning = null;
            // userAnswers[qIndex].error_analysis = null;
            // userAnswers[qIndex].feedback = null;
            // userAnswers[qIndex].checked_by = null;
        }

        const isAnsweredNow = userAnswers[qIndex].userAnswerValue !== null;
        if (wasAnsweredBefore !== isAnsweredNow) {
            const answeredCount = userAnswers.filter(a => a && a.userAnswerValue !== null).length;
            if(ui.answeredCountEl) ui.answeredCountEl.textContent = answeredCount;
            updateProgressBar();
            updatePagination();
        }
        console.log(`Odpověď uložena Q#${qIndex + 1}:`, userAnswers[qIndex]);
    }
    // --- END: Test Logic ---

    // --- START: Оценка и Сохранение ---

    // ***** VYLEPŠENÁ FUNKCE checkAnswerWithGemini *****
    async function checkAnswerWithGemini(questionType, questionText, correctAnswerOrExplanation, userAnswer, maxScore = 1) {
        console.log(`--- Vyhodnocování Q#${currentQuestionIndex + 1} (Typ: ${questionType}, Max bodů: ${maxScore}) ---`);
        console.log(`   Otázka: ${questionText.substring(0, 100)}...`);
        console.log(`   Správně: `, correctAnswerOrExplanation);
        console.log(`   Uživatel: `, userAnswer);

        // Default response structure for fallback / error
        const defaultResult = {
            score: 0,
            max_score: maxScore,
            correctness: "skipped", // Default to skipped if no answer
            reasoning: "Odpověď nebyla poskytnuta nebo je prázdná.",
            error_analysis: null,
            feedback: null,
            is_equivalent: null
        };

        if (userAnswer === null || String(userAnswer).trim() === "") {
            console.log("   Odpověď prázdná. Vracím výchozí výsledek.");
            return defaultResult;
        }
        defaultResult.correctness = "incorrect"; // Change default if answer *was* provided but evaluation fails
        defaultResult.reasoning = "Automatické hodnocení selhalo (fallback)."; // Default error reasoning

        // --- Fallback Logic ---
        const runFallbackCheck = () => {
            console.warn("!!! Používá se FALLBACK logika pro vyhodnocení !!!");
            let fallbackScore = 0;
            let fallbackCorrectness = "incorrect";
            let fallbackReasoning = "Automatické hodnocení selhalo. Použita základní kontrola.";
            let isEquivalent = null;

            try {
                if (questionType === 'multiple_choice') {
                    const correctLetter = String(correctAnswerOrExplanation).trim().toUpperCase().charAt(0);
                    const userLetter = String(userAnswer).trim().toUpperCase().charAt(0);
                    if (correctLetter === userLetter) {
                        fallbackScore = maxScore;
                        fallbackCorrectness = "correct";
                        fallbackReasoning = "Odpověď (písmeno) se shoduje se správnou možností.";
                        isEquivalent = true;
                    } else {
                        fallbackReasoning = "Odpověď (písmeno) se neshoduje se správnou možností.";
                        isEquivalent = false;
                    }
                } else if (['numeric', 'text', 'ano_ne'].includes(questionType)) {
                    const numericComparison = compareNumericAdvanced(userAnswer, correctAnswerOrExplanation);
                    if (numericComparison === true) {
                        fallbackScore = maxScore;
                        fallbackCorrectness = "correct";
                        fallbackReasoning = "Odpověď je numericky/logicky ekvivalentní správné odpovědi.";
                        isEquivalent = true;
                    } else if (numericComparison === false) {
                        fallbackReasoning = "Odpověď není numericky ekvivalentní správné odpovědi.";
                        isEquivalent = false;
                    } else { // numericComparison is null (cannot compare numerically)
                        if (compareTextAdvanced(userAnswer, correctAnswerOrExplanation)) {
                            fallbackScore = maxScore;
                            fallbackCorrectness = "correct";
                            fallbackReasoning = "Odpověď se textově shoduje (po normalizaci).";
                            isEquivalent = true;
                        } else {
                            fallbackReasoning = "Odpověď se neshoduje se správnou odpovědí (ani numericky, ani textově).";
                             isEquivalent = false;
                        }
                    }
                } else if (questionType === 'construction') {
                    // Very basic fallback for construction: give partial credit for non-empty answer
                    fallbackScore = (String(userAnswer).trim().length > 10) ? Math.min(1, maxScore) : 0; // Give 1 point if > 10 chars, max 1
                    fallbackCorrectness = fallbackScore > 0 ? "partial" : "incorrect";
                    fallbackReasoning = "Základní fallback hodnocení pro popis konstrukce (kontrola délky).";
                    isEquivalent = false;
                }
            } catch (e) {
                console.error("[Fallback] Chyba při fallback porovnání:", e);
                fallbackScore = 0;
                fallbackCorrectness = "error";
                fallbackReasoning = "Chyba při záložním hodnocení.";
                 isEquivalent = false;
            }

            console.log(`[Fallback Výsledek] Skóre: ${fallbackScore}/${maxScore}, Správnost: ${fallbackCorrectness}`);
            return {
                 score: fallbackScore,
                 max_score: maxScore,
                 correctness: fallbackCorrectness,
                 reasoning: fallbackReasoning,
                 error_analysis: null,
                 feedback: "Pro detailní hodnocení zkuste znovu, pokud problém přetrvává, kontaktujte podporu.",
                 is_equivalent: isEquivalent
             };
        };
        // --- End Fallback Logic ---

        if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR_') || GEMINI_API_KEY.length < 10) {
            console.warn("Chybí platný Gemini API klíč. Používám fallback.");
            return runFallbackCheck();
        }

        // --- Prompt Building ---
        let prompt;
        const baseInstruction = `Jsi PŘÍSNÝ a DETAILNÍ AI hodnotitel odpovědí z PŘIJÍMACÍCH ZKOUŠEK z matematiky/logiky pro 9. třídu ZŠ v ČR. Tvým úkolem je komplexně posoudit odpověď studenta vůči správnému řešení/odpovědi v kontextu dané otázky. MUSÍŠ vrátit POUZE JSON objekt podle PŘESNĚ definované struktury. NEPŘIDÁVEJ žádný text mimo JSON.`;

        const outputStructure = `{
"score": number (0-${maxScore}, celé číslo),
"max_score": ${maxScore},
"correctness": string ("correct" | "incorrect" | "partial" | "skipped"),
"reasoning": string (DETAILNÍ zdůvodnění skóre a vysvětlení správného postupu/odpovědi v ČEŠTINĚ),
"error_analysis": string | null (KONKRÉTNÍ popis chyby studenta v ČEŠTINĚ - např. "chyba ve výpočtu", "nepochopení pojmu", "špatný vzorec", "chybějící krok", "formální chyba"; null pokud správně),
"feedback": string | null (Krátká konstruktivní rada pro studenta v ČEŠTINĚ, na co si dát pozor nebo co procvičit; null pokud správně),
"is_equivalent": boolean | null (Pouze pro typy 'numeric', 'text', 'ano_ne'. True, pokud je odpověď uživatele matematicky/logicky správná i přes jiný formát. Null pro jiné typy nebo pokud nelze určit.)
}`;

        const questionContext = `Kontext otázky: """${questionText}"""`;
        const inputData = `SPRÁVNÁ ODPOVĚĎ/ŘEŠENÍ: """${correctAnswerOrExplanation}"""\nODPOVĚĎ STUDENTA: """${userAnswer}"""`;

        if (questionType === 'construction') {
            prompt = `${baseInstruction} Typ otázky: Popis konstrukce. Maximální skóre: ${maxScore}.
${questionContext}
PRAVIDLA HODNOCENÍ (PŘÍSNĚ DODRŽUJ):
1. Identifikuj KLÍČOVÉ kroky v oficiálním postupu.
2. Posuď, zda popis studenta obsahuje VŠECHNY klíčové kroky ve SPRÁVNÉM logickém pořadí.
3. Skóre:
   - ${maxScore} bodů (correct): Popis kompletní, věcně správný, logicky seřazený.
   - 1 bod (partial): Hlavní myšlenka správná, ALE chybí JEDEN méně podstatný krok NEBO obsahuje JEDNU či DVĚ menší nepřesnosti/nejasnosti.
   - 0 bodů (incorrect): Zásadně chybný, chybí VÍCE kroků, špatné pořadí, VÍCE chyb, nesrozumitelný.
4. Zdůvodnění: PODROBNĚ vysvětli, proč bylo skóre uděleno, které kroky chybí/jsou špatně.
5. Error Analysis: Popiš KONKRÉTNÍ chyby (např. "chybí kružnice k nalezení bodu C", "špatné pořadí kroků", "nejednoznačný popis").
6. Feedback: Navrhni, na co se zaměřit (např. "procvičit konstrukci osy úhlu", "dbát na přesný popis kroků").
${inputData}
ÚKOL: Pečlivě porovnej. Vrať POUZE JSON objekt podle této struktury: ${outputStructure}`;
        } else if (questionType === 'multiple_choice') {
            prompt = `${baseInstruction} Typ otázky: Výběr z možností. Maximální skóre: ${maxScore}.
${questionContext}
PRAVIDLA: Porovnej POUZE PÍSMENO na začátku odpovědi studenta (case-insensitive) se správným písmenem.
SKÓRE: ${maxScore} bodů (correct) POKUD se normalizované písmeno shoduje, jinak 0 (incorrect).
Zdůvodnění: Uveď správné písmeno a proč je daná možnost správná (stručně). Pokud je odpověď špatně, uveď i proč je špatně.
Error Analysis: Pokud špatně, uveď "vybrána nesprávná možnost".
Feedback: Pokud špatně, navrhni "pečlivě číst všechny možnosti" nebo podobně.
${inputData}
ÚKOL: Vrať POUZE JSON objekt podle této struktury: ${outputStructure}`;
        } else { // 'text', 'numeric', 'ano_ne'
            prompt = `${baseInstruction} Typ otázky: ${questionType === 'ano_ne' ? 'Ano/Ne' : (questionType === 'numeric' ? 'Numerická/Výpočetní' : 'Textová/Symbolická')}. Maximální skóre: ${maxScore}.
${questionContext}
PRAVIDLA:
1. Ekvivalence (is_equivalent): MUSÍŠ posoudit, zda je odpověď studenta MATEMATICKY/LOGICKY ekvivalentní správné odpovědi, i když formát může být jiný (např. zlomek vs desetinné číslo, jednotky, pořadí u množin). Buď flexibilní u čísel.
2. Skóre: ${maxScore} bodů (correct) POKUD je ekvivalentní, jinak 0 (incorrect).
3. Ano/Ne: Hodnoť POUZE první slovo ("ano"=="ano", "ne"=="ne"). Ekvivalence = true/false.
4. Text/Symbolika: Vyžaduj VYŠŠÍ MÍRU shody pro ekvivalenci (např. 'y=2x+1' není 'y=2x'). Normalizuj mezery, malá písmena.
5. Zdůvodnění: Vysvětli, proč je/není odpověď správná a jaký je správný výsledek/postup. Uveď, zda byla odpověď uznána jako ekvivalentní.
6. Error Analysis: Pokud incorrect, KONKRÉTNĚ popiš chybu (např. "chyba ve výpočtu", "špatná jednotka", "nesprávný termín", "překlep měnící význam").
7. Feedback: Pokud incorrect, navrhni co zlepšit (např. "zkontrolovat znaménka", "převádět jednotky", "naučit se definici").
${inputData}
ÚKOL: Posuď ekvivalenci a správnost. Vrať POUZE JSON objekt podle této struktury: ${outputStructure}`;
        }
        // --- End Prompt Building ---

        try {
            console.log(`[Gemini Call Q#${currentQuestionIndex + 1}] Posílám požadavek...`);
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1, // Lower temperature for more deterministic evaluation
                        responseMimeType: "application/json", // Expect JSON directly if possible
                        // maxOutputTokens: 8192 // Keep high for detailed explanations
                    },
                    safetySettings: [ // Keep permissive for educational content
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                    ]
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`[Gemini Call Q#${currentQuestionIndex + 1}] Chyba API:`, response.status, errorBody);
                throw new Error(`Chyba Gemini API (${response.status})`);
            }

            const data = await response.json();
            console.log(`[Gemini Call Q#${currentQuestionIndex + 1}] Surová odpověď:`, JSON.stringify(data));

            // Check for safety blocks or lack of candidate
            if (data.promptFeedback?.blockReason) {
                throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}.`);
            }
            const candidate = data.candidates?.[0];
            if (!candidate) { throw new Error('AI neposkytlo kandidáta odpovědi.'); }
            if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
                 console.warn(`[Gemini Call Q#${currentQuestionIndex + 1}] Finish Reason: ${candidate.finishReason}.`);
                 if (candidate.finishReason === 'SAFETY') throw new Error('Odpověď blokována bezpečnostním filtrem AI.');
             }

            const resultJsonText = candidate.content?.parts?.[0]?.text;
            if (!resultJsonText) { throw new Error('AI vrátilo prázdnou odpověď.'); }

             console.log(`[Gemini Call Q#${currentQuestionIndex + 1}] Získaný text JSON:`, resultJsonText);

            try {
                const result = JSON.parse(resultJsonText);
                 console.log(`[Gemini Call Q#${currentQuestionIndex + 1}] Parsovaný výsledek JSON:`, result);

                 // Validate the structure and score
                 if (typeof result.score !== 'number' || typeof result.correctness !== 'string' || typeof result.reasoning !== 'string') {
                    console.warn(`[Gemini Call Q#${currentQuestionIndex + 1}] Chybí povinné klíče v JSON. Používám fallback.`, result);
                    return runFallbackCheck();
                 }

                 const potentialScore = Math.round(result.score); // Ensure integer score
                 const isValidScore = potentialScore >= 0 && potentialScore <= maxScore;

                 if (!isValidScore) {
                    console.warn(`[Gemini Call Q#${currentQuestionIndex + 1}] Neplatné skóre ${potentialScore} (max ${maxScore}). Používám fallback.`);
                    return runFallbackCheck();
                 }

                 // Return the validated and structured result
                  return {
                     score: potentialScore,
                     max_score: maxScore,
                     correctness: ["correct", "incorrect", "partial", "skipped"].includes(result.correctness) ? result.correctness : "incorrect",
                     reasoning: result.reasoning || "Nebylo poskytnuto žádné zdůvodnění.",
                     error_analysis: result.error_analysis || null,
                     feedback: result.feedback || null,
                     is_equivalent: typeof result.is_equivalent === 'boolean' ? result.is_equivalent : null
                 };

            } catch (e) {
                console.error(`[Gemini Call Q#${currentQuestionIndex + 1}] Nepodařilo se parsovat JSON:`, e, "Odpověď:", resultJsonText);
                return runFallbackCheck(); // Use fallback if JSON parsing fails
            }

        } catch (error) {
            console.error(`[Gemini Call Q#${currentQuestionIndex + 1}] Selhalo volání API:`, error);
            showToast(`Chyba AI při hodnocení otázky ${currentQuestionIndex + 1}`, "error", 3000);
            return runFallbackCheck(); // Use fallback on API call failure
        }
    }

    async function evaluateAnswers() {
        console.log("Spouštím vyhodnocení odpovědí...");
        showGeminiOverlay(true);
        const promises = [];

        for (let i = 0; i < questions.length; i++) {
            const qData = questions[i]; // Original question data
            const answerData = userAnswers[i]; // User's answer object

            if (!answerData) {
                console.error(`Chyba: Nenalezen objekt odpovědi pro index ${i}`);
                continue; // Skip if something went wrong earlier
            }

            // If answer was skipped or is empty, set evaluation directly
            if (answerData.userAnswerValue === null || String(answerData.userAnswerValue).trim() === '') {
                answerData.scoreAwarded = 0;
                answerData.correctness = "skipped";
                answerData.reasoning = "Otázka byla přeskočena nebo odpověď byla prázdná.";
                answerData.error_analysis = null;
                answerData.feedback = "Příště zkuste odpovědět.";
                answerData.checked_by = 'skipped';
                 console.log(`Q#${i+1} (${qData.question_type}) přeskočeno/prázdné.`);
                promises.push(Promise.resolve()); // Add resolved promise to keep array structure
                continue;
            }

            // Add the Gemini check promise
             promises.push(
                 checkAnswerWithGemini(
                     qData.question_type,
                     qData.question_text, // Pass question text for context
                     qData.question_type === 'construction' ? qData.solution_explanation : qData.correct_answer,
                     answerData.userAnswerValue,
                     answerData.maxScore
                 ).then(evaluationResult => {
                     // Update the userAnswers object with detailed results
                     userAnswers[i].scoreAwarded = evaluationResult.score;
                     userAnswers[i].correctness = evaluationResult.correctness;
                     userAnswers[i].reasoning = evaluationResult.reasoning;
                     userAnswers[i].error_analysis = evaluationResult.error_analysis;
                     userAnswers[i].feedback = evaluationResult.feedback;
                     // is_equivalent might be useful for specific analysis later, store it if needed
                     // userAnswers[i].is_equivalent = evaluationResult.is_equivalent;
                     userAnswers[i].checked_by = 'gemini_scored';
                      console.log(`Q#${i+1} (${qData.question_type}) vyhodnoceno: Skóre ${evaluationResult.score}/${answerData.maxScore}, Správnost: ${evaluationResult.correctness}`);
                 }).catch(error => {
                     console.error(`Chyba vyhodnocení pro Q#${i+1}:`, error);
                     // Update with error state
                     userAnswers[i].scoreAwarded = 0;
                     userAnswers[i].correctness = 'error';
                     userAnswers[i].reasoning = `Automatické hodnocení selhalo: ${error.message}`;
                     userAnswers[i].error_analysis = "Chyba systému hodnocení.";
                     userAnswers[i].feedback = "Kontaktujte podporu, pokud problém přetrvává.";
                     userAnswers[i].checked_by = 'error';
                 })
             );
        }

        await Promise.all(promises);
        showGeminiOverlay(false);
        console.log("Vyhodnocení odpovědí dokončeno:", userAnswers);
    }
    function calculateFinalResults() {
        let totalRawPointsAchieved = 0;
        let totalRawMaxPossiblePoints = 0;
        let correctCount = 0; // Count questions answered correctly (full score)
        let incorrectCount = 0; // Count questions answered incorrectly (score 0)
        let partialCount = 0; // Count questions with partial score
        let skippedCount = 0; // Count skipped questions
        let topicStats = {};

        userAnswers.forEach((answer, index) => {
            if (!answer) {
                console.warn(`Chybí data odpovědi pro otázku index ${index}, přeskakuji statistiky.`);
                skippedCount++; // Treat missing answer object as skipped
                return;
            }

            const q = questions[index]; // Get corresponding question data if needed
            const topicKey = answer.topic_id || answer.topic_name || 'unknown';
            const topicName = answer.topic_name || 'Neznámé téma';

            if (!topicStats[topicKey]) {
                topicStats[topicKey] = {
                    name: topicName, id: answer.topic_id,
                    total_questions: 0, // Count questions for this topic
                    fully_correct: 0, // Count fully correct answers
                    points_achieved: 0, // Sum achieved points
                    max_points: 0, // Sum max possible points
                    score_percent: 0, // Overall percentage score for the topic
                    strength: 'neutral' // Classification
                };
            }

            topicStats[topicKey].total_questions++;
            topicStats[topicKey].max_points += answer.maxScore;
            totalRawMaxPossiblePoints += answer.maxScore;

            if (answer.correctness === "skipped") {
                skippedCount++;
            } else if (answer.correctness === "error") {
                incorrectCount++; // Count evaluation errors as incorrect for simplicity
            } else {
                const awardedScore = answer.scoreAwarded ?? 0;
                totalRawPointsAchieved += awardedScore;
                topicStats[topicKey].points_achieved += awardedScore;

                if (answer.correctness === "correct") {
                    correctCount++;
                    topicStats[topicKey].fully_correct++;
                } else if (answer.correctness === "partial") {
                    partialCount++;
                } else { // incorrect
                    incorrectCount++;
                }
            }
        });

        // Calculate topic percentages and strengths
        Object.values(topicStats).forEach(stats => {
            stats.score_percent = stats.max_points > 0 ? Math.round((stats.points_achieved / stats.max_points) * 100) : 0;
            stats.strength = stats.score_percent >= 75 ? 'strength' : (stats.score_percent < 50 ? 'weakness' : 'neutral');
        });

        // Calculate overall percentage based on questions (correct / total applicable)
        const totalApplicableQuestions = questions.length - skippedCount; // Exclude skipped from percentage base
        const finalPercentage = totalApplicableQuestions > 0 ? Math.round((correctCount / totalApplicableQuestions) * 100) : 0;

        // Calculate final score out of 50 based on points
        const finalScoreOutOf50 = totalRawMaxPossiblePoints > 0 ? Math.round((totalRawPointsAchieved / totalRawMaxPossiblePoints) * 50) : 0;

        testResultsData = {
            totalQuestions: questions.length,
            correctAnswers: correctCount, // Fully correct count
            incorrectAnswers: incorrectCount, // Score 0 count (excluding skipped/error?) - Adjust if needed
            partiallyCorrectAnswers: partialCount, // New field
            skippedAnswers: skippedCount, // New field
            evaluationErrors: userAnswers.filter(a => a?.correctness === 'error').length, // New field
            score: finalScoreOutOf50, // Score / 50
            totalPointsAchieved: totalRawPointsAchieved, // Sum of awarded points
            totalMaxPossiblePoints: totalRawMaxPossiblePoints, // Sum of max possible points
            percentage: finalPercentage, // Percentage of *fully correct* answers (excluding skipped)
            timeSpent: testTime,
            topicResults: topicStats, // Detailed topic stats based on points
        };
        console.log("Finální výsledky vypočítány:", testResultsData);
    }
    function displayResults() {
         if(!ui.testContainer || !ui.resultsContainer || !ui.reviewContainer || !ui.testTimer || !ui.testLevel || !ui.resultScoreEl || !ui.resultPercentageEl || !ui.resultCorrectEl || !ui.resultIncorrectEl || !ui.resultTimeEl || !ui.lowScoreMessageContainer || !ui.continueBtn || !ui.topicResultsEl || !ui.reviewAnswersBtn || !ui.backToResultsBtn) { console.error("Chyba: Některé elementy výsledků nebyly nalezeny v DOM."); return; }
         ui.testContainer.style.display = 'none';
         ui.resultsContainer.style.display = 'block';
         ui.reviewContainer.style.display = 'none';
         ui.testTimer.style.display = 'none';
         if(ui.testLevel) ui.testLevel.textContent = 'Výsledky testu';

         if(ui.resultScoreEl) ui.resultScoreEl.textContent = `${testResultsData.score}/50`;
         if(ui.resultPercentageEl) ui.resultPercentageEl.textContent = `${testResultsData.percentage}%`;
         if(ui.resultCorrectEl) ui.resultCorrectEl.textContent = testResultsData.correctAnswers;
         if(ui.resultIncorrectEl) ui.resultIncorrectEl.textContent = testResultsData.incorrectAnswers + testResultsData.partiallyCorrectAnswers; // Combine incorrect + partial for display here? Or show separately? Let's combine for now.
         if(ui.resultTimeEl) ui.resultTimeEl.textContent = formatTime(testResultsData.timeSpent);
         ui.lowScoreMessageContainer.innerHTML = '';
         ui.continueBtn.disabled = true;
         const saveError = ui.continueBtn.getAttribute('data-save-error') === 'true';

         if (saveError) { ui.lowScoreMessageContainer.innerHTML = `<div class="error-message-container"><i class="fas fa-exclamation-triangle"></i><div class="loader-text">Chyba ukládání</div><div class="loader-subtext">Nepodařilo se uložit výsledky testu. Studijní plán nelze vytvořit.</div></div>`; }
         else if (testResultsData.score < SCORE_THRESHOLD_FOR_SAVING) { ui.lowScoreMessageContainer.innerHTML = `<div class="low-score-message warning"> <i class="fas fa-exclamation-circle"></i> <strong>Výsledek nebyl uložen.</strong><br> Vaše skóre (${testResultsData.score}/50) je nižší než ${SCORE_THRESHOLD_FOR_SAVING} bodů. Tyto výsledky nebudou použity pro generování studijního plánu.</div>`; }
         else { ui.lowScoreMessageContainer.innerHTML = `<div class="low-score-message info"> <i class="fas fa-info-circle"></i> <strong>Výsledky byly uloženy.</strong><br> Vaše skóre (${testResultsData.score}/50) bude použito pro studijní plán.</div>`; ui.continueBtn.disabled = false; }

         // Display Topic Results (using score_percent)
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
    // ***** VYLEPŠENÁ FUNKCE displayReview *****
    function displayReview() {
        if (!ui.resultsContainer || !ui.reviewContainer || !ui.reviewContent) { console.error("Elementy pro přehled odpovědí nenalezeny!"); return; }
        ui.resultsContainer.style.display = 'none';
        ui.reviewContainer.style.display = 'block';
        ui.reviewContent.innerHTML = ''; // Clear previous content

        if (!questions || !userAnswers || questions.length !== userAnswers.length) {
            ui.reviewContent.innerHTML = '<p class="error-message-container">Chyba: Data pro přehled odpovědí nejsou kompletní.</p>';
            return;
        }

        questions.forEach((q, index) => {
            const answer = userAnswers[index]; // Get the full answer object
            if (!answer) {
                // Should not happen if initializeTest works correctly, but handle defensively
                ui.reviewContent.innerHTML += `<div class="review-question-item skipped card"><p>Chyba: Chybí data odpovědi pro otázku ${index + 1}</p></div>`;
                return;
            }

            let itemClass = 'review-question-item card';
            let scoreStatus = '';
            let scoreText = `${answer.scoreAwarded ?? '?'} / ${answer.maxScore} b.`;

            switch (answer.correctness) {
                case 'correct':
                    itemClass += ' correct';
                    scoreStatus = '<span class="correct">Správně</span>';
                    break;
                case 'partial':
                    itemClass += ' partial';
                    scoreStatus = '<span class="partial">Částečně správně</span>';
                    break;
                case 'incorrect':
                    itemClass += ' incorrect';
                    scoreStatus = '<span class="incorrect">Nesprávně</span>';
                    break;
                case 'skipped':
                    itemClass += ' skipped';
                    scoreStatus = '<span class="skipped">Přeskočeno</span>';
                    scoreText = `0 / ${answer.maxScore} b.`; // Show 0 for skipped
                    break;
                case 'error':
                default:
                    itemClass += ' incorrect'; // Treat error as incorrect visually
                    scoreStatus = '<span class="incorrect">Chyba hodnocení</span>';
                     scoreText = `? / ${answer.maxScore} b.`;
                    break;
            }

            let reviewHTML = `<div class="${itemClass}">`;
            // Question Header
            reviewHTML += `<div class="review-question-header"><span class="review-question-number">${q.question_number}</span><div class="review-question-text">${sanitizeHTML(q.question_text)}</div></div>`;
            // Image
            if (q.image_url) { reviewHTML += `<div class="question-image-container"><img class="question-image" src="${q.image_url}" alt="Obrázek k otázce ${q.question_number}" loading="lazy"></div>`; }
            // Answer Section
            reviewHTML += `<div class="review-answer-section">`;
            // User Answer
            reviewHTML += `<div class="review-user-answer"><strong>Vaše odpověď:</strong> `;
            if (answer.userAnswerValue !== null) {
                if (q.question_type === 'multiple_choice') {
                    const selectedLetter = String(answer.userAnswerValue).trim().toUpperCase();
                    const selectedOptionIndex = selectedLetter.charCodeAt(0) - 65;
                    const optionText = (Array.isArray(q.options) && q.options[selectedOptionIndex] !== undefined) ? sanitizeHTML(q.options[selectedOptionIndex]) : `(Neplatná volba: ${sanitizeHTML(answer.userAnswerValue)})`;
                    reviewHTML += `${selectedLetter}. ${optionText}`;
                } else { reviewHTML += sanitizeHTML(answer.userAnswerValue); }
            } else { reviewHTML += `<em>(Nezodpovězeno)</em>`; }
            reviewHTML += `</div>`;

            // Correct Answer (unless construction)
            if (q.question_type !== 'construction') {
                reviewHTML += `<div class="review-correct-answer"><strong>Správná odpověď:</strong> `;
                if (q.question_type === 'multiple_choice') {
                    const correctLetter = String(q.correct_answer).trim().toUpperCase().replace(/[\.\)\s].*/, '');
                    const correctOptionIndex = correctLetter.charCodeAt(0) - 65;
                    const correctText = (Array.isArray(q.options) && q.options[correctOptionIndex] !== undefined) ? sanitizeHTML(q.options[correctOptionIndex]) : `(Neplatný text správné odpovědi)`;
                    reviewHTML += `${correctLetter}. ${correctText}`;
                } else { reviewHTML += sanitizeHTML(q.correct_answer); }
                reviewHTML += `</div>`;
            }

             // Reasoning / Explanation (Show explanation if available, otherwise show Gemini's reasoning)
             const explanationToShow = q.solution_explanation && q.solution_explanation !== "Oficiální postup není k dispozici." ? q.solution_explanation : answer.reasoning;
             if (explanationToShow) {
                reviewHTML += `<div class="review-solution"><strong>Zdůvodnění / Postup:</strong><pre><code>${sanitizeHTML(explanationToShow)}</code></pre></div>`;
             }

            // Error Analysis (If Gemini provided one)
            if (answer.error_analysis) {
                 reviewHTML += `<div class="review-solution" style="border-left: 3px solid var(--accent-pink); background-color: rgba(var(--accent-pink-rgb), 0.05);"><strong>Analýza chyby:</strong><p style="margin:0;">${sanitizeHTML(answer.error_analysis)}</p></div>`;
             }

             // Feedback (If Gemini provided one)
            if (answer.feedback) {
                 reviewHTML += `<div class="review-solution" style="border-left: 3px solid var(--accent-secondary); background-color: rgba(var(--accent-secondary-rgb), 0.05);"><strong>Zpětná vazba:</strong><p style="margin:0;">${sanitizeHTML(answer.feedback)}</p></div>`;
             }

            // Score
            reviewHTML += `<div class="review-score"><strong>Hodnocení:</strong> ${scoreStatus} (${scoreText})</div>`;
            reviewHTML += `</div></div>`; // Close answer-section and review-question-item
            ui.reviewContent.innerHTML += reviewHTML;
        });

        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { try { setTimeout(() => { window.MathJax.typesetPromise([ui.reviewContent]).catch(e => console.error("MathJax error in review:", e)); }, 0); } catch (e) { console.error("MathJax init error in review:", e); } }
        if (ui.reviewContainer) ui.reviewContainer.scrollIntoView({ behavior: 'smooth' });
        requestAnimationFrame(() => { if (ui.reviewContent) { ui.reviewContent.querySelectorAll('.review-question-item').forEach((el, index) => { el.setAttribute('data-animate', ''); el.style.setProperty('--animation-order', index); }); initScrollAnimations(); } });
    }
    // ***** Konec VYLEPŠENÉ FUNKCE displayReview *****

    function generateDetailedAnalysis(results, answers, questionsData) {
                 const analysis = { summary: { score: results.score, total_points_achieved: results.totalPointsAchieved, total_max_possible_points: results.totalMaxPossiblePoints, percentage: results.percentage, time_spent_seconds: results.timeSpent, total_questions: results.totalQuestions, correct: results.correctAnswers, incorrect: results.incorrectAnswers, partial: results.partiallyCorrectAnswers, skipped: results.skippedAnswers, evaluation_errors: results.evaluationErrors, }, strengths: [], weaknesses: [], performance_by_topic: {}, performance_by_type: {}, performance_by_difficulty: {}, incorrectly_answered_details: [] };
                 // Populate performance_by_topic using points achieved / max points
                 for (const [topicKey, stats] of Object.entries(results.topicResults || {})) { analysis.performance_by_topic[stats.name] = { points_achieved: stats.points_achieved, max_points: stats.max_points, score_percent: stats.score_percent, total_questions: stats.total_questions, fully_correct: stats.fully_correct }; if (stats.strength === 'strength') analysis.strengths.push({ topic: stats.name, score: stats.score_percent }); else if (stats.strength === 'weakness') analysis.weaknesses.push({ topic: stats.name, score: stats.score_percent }); }
                 analysis.strengths.sort((a, b) => b.score - a.score); analysis.weaknesses.sort((a, b) => a.score - b.score);
                 // Populate performance_by_type and performance_by_difficulty
                 answers.forEach((answer) => { if (!answer || answer.correctness === 'error') return; const qType = answer.question_type; const difficulty = answer.difficulty; const maxQScore = answer.maxScore; const awardedScore = answer.scoreAwarded ?? 0; if (!analysis.performance_by_type[qType]) analysis.performance_by_type[qType] = { points_achieved: 0, max_points: 0, count: 0 }; analysis.performance_by_type[qType].points_achieved += awardedScore; analysis.performance_by_type[qType].max_points += maxQScore; analysis.performance_by_type[qType].count++; if (!analysis.performance_by_difficulty[difficulty]) analysis.performance_by_difficulty[difficulty] = { points_achieved: 0, max_points: 0, count: 0 }; analysis.performance_by_difficulty[difficulty].points_achieved += awardedScore; analysis.performance_by_difficulty[difficulty].max_points += maxQScore; analysis.performance_by_difficulty[difficulty].count++; // Add details for non-correct answers (incorrect or partial)
                     if (answer.correctness === 'incorrect' || answer.correctness === 'partial') { analysis.incorrectly_answered_details.push({ question_number: answer.question_number_in_test, question_text: answer.question_text, topic: answer.topic_name, type: answer.question_type, user_answer: answer.userAnswerValue, correct_answer: answer.correct_answer, score_awarded: awardedScore, max_score: maxQScore, explanation: answer.reasoning, // Include Gemini's reasoning
                             error_identified: answer.error_analysis // Include identified error
                         }); } }); // Determine overall assessment and recommendations
                 if (results.score >= 43) analysis.overall_assessment = "Vynikající výkon!"; else if (results.score >= 33) analysis.overall_assessment = "Dobrý výkon, solidní základ."; else if (results.score >= 20) analysis.overall_assessment = "Průměrný výkon, zaměřte se na slabiny."; else analysis.overall_assessment = `Výkon ${results.score < 10 ? 'výrazně ' : ''}pod průměrem. Nutné opakování.`; if (results.score < SCORE_THRESHOLD_FOR_SAVING) analysis.overall_assessment += " Skóre je příliš nízké pro uložení a generování plánu."; analysis.recommendations = analysis.weaknesses.length > 0 ? [`Intenzivně se zaměřte na nejslabší témata: ${analysis.weaknesses.map(w => w.topic).slice(0, 2).join(', ')}.`] : ["Pokračujte v upevňování znalostí."]; if (analysis.incorrectly_answered_details.length > 3) analysis.recommendations.push(`Projděte si ${analysis.incorrectly_answered_details.length} otázek s nízkým nebo částečným skóre.`); console.log("[Analysis] Vygenerována detailní analýza:", analysis); return analysis;
    }
    async function saveTestResults() {
         if(!ui.continueBtn) return false; ui.continueBtn.removeAttribute('data-save-error'); if (!currentUser || currentUser.id === 'PLACEHOLDER_USER_ID') { console.warn("Neukládám: Není uživatel."); ui.continueBtn.disabled = true; return false; } if (testResultsData.score < SCORE_THRESHOLD_FOR_SAVING) { console.log(`Výsledek (${testResultsData.score}/50) < ${SCORE_THRESHOLD_FOR_SAVING}. Přeskakuji ukládání.`); ui.continueBtn.disabled = true; return false; } console.log(`Pokouším se uložit výsledky (Skóre: ${testResultsData.score}/50 >= ${SCORE_THRESHOLD_FOR_SAVING})...`); ui.continueBtn.disabled = true; try { const detailedAnalysis = generateDetailedAnalysis(testResultsData, userAnswers, questions);
             // Prepare answers for saving - include evaluation details
             const answersToSave = userAnswers.map(a => ({
                question_db_id: a.question_db_id,
                question_number_in_test: a.question_number_in_test,
                question_type: a.question_type,
                topic_id: a.topic_id,
                difficulty: a.difficulty,
                userAnswerValue: a.userAnswerValue, // User's raw answer
                scoreAwarded: a.scoreAwarded,       // Gemini's score
                maxScore: a.maxScore,           // Max possible score
                correctness: a.correctness,       // 'correct', 'incorrect', etc.
                reasoning: a.reasoning,         // Gemini's explanation
                error_analysis: a.error_analysis,   // Gemini's error analysis
                feedback: a.feedback,           // Gemini's feedback
                checked_by: a.checked_by          // 'gemini_scored', 'skipped', 'error'
             }));

             const dataToSave = { user_id: currentUser.id, completed_at: testEndTime ? testEndTime.toISOString() : new Date().toISOString(), total_score: testResultsData.score, total_questions: testResultsData.totalQuestions, // Total questions in the test
                 answers: answersToSave,           // Store the detailed answers array
                 topic_results: testResultsData.topicResults, // Store aggregated topic results
                 analysis: detailedAnalysis,         // Store the generated detailed analysis object
                 time_spent: testResultsData.timeSpent, test_type: selectedTestType || 'unknown' // Store the test type
             }; console.log("Data k uložení do user_diagnostics:", dataToSave); const { data, error } = await supabase.from('user_diagnostics').insert(dataToSave).select('id').single(); if (error) { console.error('Supabase insert error:', error); throw new Error(`Supabase chyba: ${error.message} (Hint: ${error.hint})`); } diagnosticId = data.id; console.log("Diagnostika uložena, ID:", diagnosticId); ui.continueBtn.disabled = false; return true; } catch (error) { console.error('Chyba při ukládání:', error); ui.continueBtn.disabled = true; ui.continueBtn.setAttribute('data-save-error', 'true'); showError(`Nepodařilo se uložit výsledky: ${error.message}`, false); return false; }
    }
    async function awardPoints() { if (!selectedTestType || !testResultsData || testResultsData.totalQuestions <= 0) { console.warn("Nelze vypočítat body: Chybí data testu."); return; } if (!currentUser || currentUser.id === 'PLACEHOLDER_USER_ID') { console.warn("Nelze uložit body: Chybí uživatel."); return; } if (!currentProfile) { currentProfile = await fetchUserProfile(currentUser.id); if (!currentProfile) { console.warn("Nelze uložit body: Chybí profil uživatele."); return; } } const config = testTypeConfig[selectedTestType]; if (!config) { console.warn(`Neznámá konfigurace testu pro typ: ${selectedTestType}`); return; } const n = config.multiplier; const r = testResultsData.correctAnswers; const t = testResultsData.totalQuestions; const calculatedPoints = Math.round(n * (r / t) * 10); if (calculatedPoints <= 0) { console.log("Nebyly získány žádné body."); return; } console.log(`Vypočítané body: ${calculatedPoints} (n=${n}, r=${r}, t=${t})`); await updateUserPoints(calculatedPoints); }
    async function updateUserPoints(pointsToAdd) { if (!currentUser || !currentProfile || pointsToAdd <= 0) { console.log("Přeskakuji aktualizaci bodů:", { userId: currentUser?.id, profileExists: !!currentProfile, pointsToAdd }); return; } try { const currentPoints = currentProfile.points || 0; const newPoints = currentPoints + pointsToAdd; const { error } = await supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (error) { throw error; } console.log(`Body uživatele ${currentUser.id} aktualizovány na ${newPoints} (+${pointsToAdd})`); currentProfile.points = newPoints; showToast('ÚSPĚCH', `Získali jste ${pointsToAdd} kreditů!`, 'success'); } catch (error) { console.error("Chyba při aktualizaci bodů uživatele:", error); showToast('Chyba', 'Nepodařilo se aktualizovat kredity.', 'error'); } }
    async function updateUserStats() { console.log("Aktualizace user stats - přeskočeno v testu."); }
    async function finishTest() {
        stopTimer();
        if(ui.finishBtn) { ui.finishBtn.disabled = true; ui.finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vyhodnocuji...'; }
        let savedSuccessfully = false;
        try {
            await evaluateAnswers(); // Evaluate first
            calculateFinalResults(); // Then calculate based on evaluation
            savedSuccessfully = await saveTestResults(); // Then try to save
            displayResults(); // Always display results

            if (savedSuccessfully) {
                await awardPoints(); // Award points only if saved
            } else {
                 // Ensure continue button is disabled if saving failed AFTER displayResults might have enabled it
                if(ui.continueBtn) ui.continueBtn.disabled = true;
                console.warn("Výsledky nebyly úspěšně uloženy, body nebudou přiděleny.");
            }

            history.pushState({ state: 'testFinished' }, document.title, window.location.href);

        } catch (error) {
            console.error("Chyba při dokončování testu:", error);
            showGeminiOverlay(false); // Make sure overlay is hidden on error
            displayResults(); // Still try to display whatever results were calculated
            // Show a prominent error message in the results area
            if(ui.lowScoreMessageContainer) {
                 ui.lowScoreMessageContainer.innerHTML = `<div class="error-message-container"><i class="fas fa-exclamation-triangle"></i><div class="loader-text">Chyba!</div><div class="loader-subtext">Chyba vyhodnocení/ukládání: ${error.message}. Výsledky nemusí být kompletní nebo uložené.</div></div>`;
            }
            if(ui.continueBtn) {
                ui.continueBtn.disabled = true; // Ensure continue is disabled
                ui.continueBtn.setAttribute('data-save-error', 'true'); // Mark that saving failed
            }
            history.pushState({ state: 'testFinishedWithError' }, document.title, window.location.href);
        } finally {
            if(ui.finishBtn) { // Reset finish button state
                ui.finishBtn.disabled = false;
                ui.finishBtn.innerHTML = '<i class="fas fa-check-circle"></i> Dokončit test';
            }
        }
    }
    // --- END: Оценка и Сохранение ---

    // --- START: Notification Logic ---
    async function fetchNotifications(userId, limit = 5) { if (!supabase || !userId) { console.error("[Notifications] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Načítání nepřečtených oznámení pro uživatele ${userId}`); setLoadingState('notifications', true); try { const { data, error, count } = await supabase .from('user_notifications') .select('*', { count: 'exact' }) .eq('user_id', userId) .eq('is_read', false) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; console.log(`[Notifications] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Výjimka při načítání oznámení:", error); showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } finally { setLoadingState('notifications', false); } }
    function renderNotifications(count, notifications) { console.log("[Render Notifications] Start, Počet:", count, "Oznámení:", notifications); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Chybí UI elementy."); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${sanitizeHTML(n.title)}</div> <div class="notification-message">${sanitizeHTML(n.message)}</div> <div class="notification-time">${formatRelativeTime(n.created_at)}</div> </div> </div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } console.log("[Render Notifications] Hotovo"); }
    async function markNotificationRead(notificationId) { console.log("[FUNC] markNotificationRead: Označení ID:", notificationId); if (!currentUser || !notificationId) return false; try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[FUNC] markNotificationRead: Úspěch pro ID:", notificationId); return true; } catch (error) { console.error("[FUNC] markNotificationRead: Chyba:", error); showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } }
    async function markAllNotificationsRead() { console.log("[FUNC] markAllNotificationsRead: Start pro uživatele:", currentUser?.id); if (!currentUser || !ui.markAllReadBtn) return; setLoadingState('notifications', true); try { const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false); if (error) throw error; console.log("[FUNC] markAllNotificationsRead: Úspěch"); const { unreadCount, notifications } = await fetchNotifications(currentUser.id, 5); renderNotifications(unreadCount, notifications); showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[FUNC] markAllNotificationsRead: Chyba:", error); showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); } finally { setLoadingState('notifications', false); } }
    // --- END: Notification Logic ---

    // --- START: Event Listeners Setup ---
    function setupEventListeners() {
         console.log("[SETUP] Nastavování posluchačů událostí...");
         // Sidebar/Menu
         if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
         if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
         if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
         document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });
         // Test Controls
         if (ui.prevBtn) ui.prevBtn.addEventListener('click', () => { if (currentQuestionIndex > 0) showQuestion(currentQuestionIndex - 1); });
         if (ui.nextBtn) ui.nextBtn.addEventListener('click', () => { if (currentQuestionIndex < questions.length - 1) showQuestion(currentQuestionIndex + 1); });
         if (ui.finishBtn) { ui.finishBtn.addEventListener('click', async () => { const unansweredCount = userAnswers.filter(a => a && a.userAnswerValue === null).length; let confirmFinish = true; if (unansweredCount > 0) confirmFinish = confirm(`Nezodpověděli jste ${unansweredCount} ${unansweredCount === 1 ? 'otázku' : (unansweredCount < 5 ? 'otázky' : 'otázek')}. Přesto dokončit?`); else confirmFinish = confirm('Opravdu chcete dokončit test?'); if (confirmFinish) { await finishTest(); } }); }
         // Results/Review Controls
         if (ui.retryBtn) { ui.retryBtn.addEventListener('click', () => { ui.resultsContainer.style.display = 'none'; ui.reviewContainer.style.display = 'none'; if (ui.testSelector) ui.testSelector.style.display = 'block'; questions = []; userAnswers = []; testResultsData = {}; diagnosticId = null; selectedTestType = null; ui.testTypeCards.forEach(c => c.classList.remove('selected')); if(ui.lowScoreMessageContainer) ui.lowScoreMessageContainer.innerHTML = ''; if (ui.continueBtn) { ui.continueBtn.disabled = true; ui.continueBtn.removeAttribute('data-save-error'); } if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu'; history.replaceState({ state: 'testSelection' }, document.title, window.location.href); }); }
         if (ui.continueBtn) { ui.continueBtn.addEventListener('click', () => { if (!ui.continueBtn.disabled) window.location.href = `/dashboard/procvicovani/plan.html`; }); }
         if (ui.reviewAnswersBtn) ui.reviewAnswersBtn.addEventListener('click', displayReview);
         if (ui.backToResultsBtn) ui.backToResultsBtn.addEventListener('click', () => { if(ui.reviewContainer) ui.reviewContainer.style.display = 'none'; if(ui.resultsContainer) ui.resultsContainer.style.display = 'block'; if(ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' }); });
         // Test Type Selection
         ui.testTypeCards.forEach(card => { card.addEventListener('click', function(event) { const testType = this.dataset.testType; const isButtonClicked = event.target.closest('.select-test-btn'); ui.testTypeCards.forEach(c => c.classList.remove('selected')); this.classList.add('selected'); selectedTestType = testType; if (isButtonClicked) { event.stopPropagation(); startSelectedTest(); } }); });
         ui.selectTestBtns.forEach(button => { button.addEventListener('click', function(event) { event.stopPropagation(); const testType = this.closest('.test-type-card').dataset.testType; ui.testTypeCards.forEach(c => c.classList.remove('selected')); this.closest('.test-type-card').classList.add('selected'); selectedTestType = testType; startSelectedTest(); }); });
         // Back button handling
         window.addEventListener('popstate', handleBackButton);
         // Resize listener
         window.addEventListener('resize', () => { if (window.innerWidth > 992 && ui.sidebar?.classList.contains('active')) closeMenu(); });
         // Notifications
         if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
         if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', markAllNotificationsRead); }
         if (ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }); }
         document.addEventListener('click', (event) => { if (ui.notificationsDropdown?.classList.contains('active') && !ui.notificationsDropdown.contains(event.target) && !ui.notificationBell?.contains(event.target)) { ui.notificationsDropdown.classList.remove('active'); } });
        // Online/Offline
         window.addEventListener('online', updateOnlineStatus);
         window.addEventListener('offline', updateOnlineStatus);
         console.log("[SETUP] Posluchači událostí nastaveni.");
    }
    // --- END: Event Listeners Setup ---

    // --- START: Test Flow & Back Button ---
    function startSelectedTest() {
         if (!selectedTestType) { showToast('Varování', 'Vyberte prosím typ testu.', 'warning'); return; }
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
         if (ui.testTimer) ui.testTimer.style.display = 'flex';

         history.pushState({ state: 'testInProgress' }, document.title, window.location.href);
         loadTestQuestions(selectedTestType);
    }
    function handleBackButton(event) { const state = event.state ? event.state.state : null; const testIsRunning = ui.testContainer && ui.testContainer.style.display === 'block'; const resultsAreShown = ui.resultsContainer && ui.resultsContainer.style.display === 'block'; const reviewIsShown = ui.reviewContainer && ui.reviewContainer.style.display === 'block'; if (reviewIsShown) { ui.reviewContainer.style.display = 'none'; if (ui.resultsContainer) ui.resultsContainer.style.display = 'block'; } else if (testIsRunning) { if (!confirm('Opustit test? Postup nebude uložen.')) { history.pushState({ state: 'testInProgress' }, document.title, window.location.href); } else { stopTimer(); if (ui.testContainer) ui.testContainer.style.display = 'none'; if (ui.testLoader) ui.testLoader.style.display = 'none'; if (ui.testSelector) ui.testSelector.style.display = 'block'; if (ui.testTimer) ui.testTimer.style.display = 'none'; if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu'; } } else if (resultsAreShown) { if(ui.resultsContainer) ui.resultsContainer.style.display = 'none'; if (ui.testSelector) ui.testSelector.style.display = 'block'; if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu'; } else { console.log("Navigace zpět (výchozí chování)."); } }
    // --- END: Test Flow & Back Button ---

    // --- START: App Initialization ---
    async function initializeApp() {
        console.log("🚀 [Init Test1 - Kyber] Starting...");
        if (!initializeSupabase()) return;

        if (ui.initialLoader) { ui.initialLoader.style.display = 'flex'; ui.initialLoader.classList.remove('hidden'); }
        if (ui.mainContent) { ui.mainContent.style.display = 'none'; ui.mainContent.classList.remove('loaded'); }

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);

            if (!session || !session.user) { console.log('[Init Test1 - Kyber] Not logged in. Redirecting...'); window.location.href = '/auth/index.html'; return; }
            currentUser = session.user;
            currentProfile = await fetchUserProfile(currentUser.id);
            updateUserInfoUI();

            if (!currentProfile) { showError("Profil nenalezen. Test nelze spustit.", true); if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => {if(ui.initialLoader) ui.initialLoader.style.display = 'none';}, 300); } if (ui.mainContent) ui.mainContent.style.display = 'block'; return; }

            setupEventListeners();

             try { setLoadingState('notifications', true); const { unreadCount, notifications } = await fetchNotifications(currentUser.id, 5); renderNotifications(unreadCount, notifications); } catch (notifError) { console.error("Chyba při úvodním načítání notifikací:", notifError); renderNotifications(0, []); } finally { setLoadingState('notifications', false); }

            const hasCompletedTest = await checkExistingDiagnostic(currentUser.id);
            if (hasCompletedTest) { if(ui.testSelector) { ui.testSelector.innerHTML = `<div class="section card" data-animate style="--animation-order: 0;"><h2 class="section-title"><i class="fas fa-check-circle" style="color: var(--accent-lime);"></i> Test již dokončen</h2><p>Tento diagnostický test jste již absolvoval/a. <strong>Tento test nelze opakovat.</strong> Vaše výsledky byly použity k vytvoření studijního plánu.</p><div style="margin-top:1.5rem; display:flex; gap:1rem; flex-wrap:wrap;"><a href="plan.html" class="btn btn-primary"><i class="fas fa-tasks"></i> Zobrazit plán</a><a href="main.html" class="btn btn-secondary"><i class="fas fa-arrow-left"></i> Zpět</a></div></div>`; ui.testSelector.style.display = 'block'; requestAnimationFrame(initScrollAnimations); } if(ui.testLoader) ui.testLoader.style.display = 'none'; if(ui.testLevel) ui.testLevel.textContent = 'Dokončeno';
            } else { if(ui.testSelector) ui.testSelector.style.display = 'block'; if(ui.testLoader) ui.testLoader.style.display = 'none'; if(ui.testLevel) ui.testLevel.textContent = 'Výběr testu'; requestAnimationFrame(() => { if (ui.testSelector) { ui.testSelector.querySelectorAll('.test-type-card').forEach((el, index) => { el.setAttribute('data-animate', ''); el.style.setProperty('--animation-order', index); }); initScrollAnimations(); } });
            }

            if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }
            if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); }); }

             initMouseFollower();
             initHeaderScrollDetection();
             initTooltips();
             updateCopyrightYear();
             updateOnlineStatus(); // Initial online status check

            console.log("✅ [Init Test1 - Kyber] Page initialized.");

        } catch (error) {
            console.error("❌ [Init Test1 - Kyber] Error:", error);
            if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">Chyba (${error.message}). Obnovte.</p>`; }
            else { showError(`Chyba inicializace: ${error.message}`, true); }
            if (ui.mainContent) ui.mainContent.style.display = 'block';
            setLoadingState('all', false);
        }
    }
    // --- END: App Initialization ---

    // --- Run Application ---
    initializeApp();

})(); // End IIFE