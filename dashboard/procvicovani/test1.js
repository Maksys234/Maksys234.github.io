// Файл: test1.js
// Управляет пользовательским интерфейсом, обработкой событий и оркестрацией теста,
// используя логику из test1-logic.js и test1-ui.js.
// VERZE 13.0 (REFACTORED): Логика UI отделена в test1-ui.js. Этот файл управляет состоянием и потоком.

(function() {
    'use strict';

    // --- START: Инициализация и Конфигурация ---
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let userStatsData = null; // Будет содержать данные из user_stats

    // Состояние адаптивного теста
    let adaptiveTestState = {
        questionPool: [],
        currentQuestion: null,
        currentDifficulty: 3, // Начальная сложность
        questionsAnswered: 0,
        questionsCorrect: 0,
        totalQuestionsInSession: 0,
        presentedQuestionIds: new Set()
    };

    let questions = []; // Для review, если понадобится старый формат
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
    // --- END: Инициализация и Конфигурация ---

    // --- START: Data Fetching Wrappers ---
    async function fetchUserProfile(userId) {
        if (!supabase || !userId) return null;
        console.log(`[Profile] Fetching profile for user ID: ${userId}`);
        TestUI.setLoadingState('titles', true);
        try {
            const { data: profile, error } = await supabase.from('profiles').select('*, selected_title, preferences, longest_streak_days, learning_goal').eq('id', userId).single();
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
            TestUI.showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error');
            return null;
        } finally {
            TestUI.setLoadingState('titles', false);
        }
    }

	async function fetchTitles() {
        if (!supabase) return [];
        console.log("[Titles] Fetching available titles...");
        try {
            const { data, error } = await supabase.from('title_shop').select('title_key, name');
            if (error) {
                console.error("[Titles] Error from Supabase:", error);
                throw error;
            }
            console.log("[Titles] Fetched titles:", data);
            return data || [];
        } catch (error) {
            console.error("[Titles] Catch block error fetching titles:", error.message);
            TestUI.showToast("Chyba", "Nepodařilo se načíst dostupné tituly.", "error");
            return [];
        }
    }

    async function checkSpecificTestCompleted(userId, testIdentifierToFind) {
        TestUI.setLoadingState('test', true);
        TestUI.uiCache.loaderSubtext.textContent = 'Kontroluji předchozí testy...';
        try {
            if (!userId || !supabase) {
                console.warn("[checkSpecificTestCompleted] Chybí ID uživatele nebo Supabase klient.");
                return null;
            }
            console.log(`[checkSpecificTestCompleted] Hledám test pro user: ${userId} s identifikátorem: ${testIdentifierToFind}`);
            const { data: existingTests, error } = await supabase.from('user_diagnostics').select('id, completed_at, analysis, answers').eq('user_id', userId).order('completed_at', { ascending: false });
            if (error) {
                console.error(`[checkSpecificTestCompleted] Chyba při dotazu na user_diagnostics:`, error);
                throw error;
            }
            if (existingTests && existingTests.length > 0) {
                const completedTest = existingTests.find(test => test.analysis && test.analysis.summary && test.analysis.summary.test_type_identifier === testIdentifierToFind );
                if (completedTest) {
                    console.log(`[checkSpecificTestCompleted] Nalezen dokončený test s identifikátorem '${testIdentifierToFind}'. Data:`, completedTest);
                    return completedTest;
                }
                console.log(`[checkSpecificTestCompleted] Nalezeny testy (${existingTests.length}), ale žádný neodpovídá identifikátoru '${testIdentifierToFind}' v analýze.`);
            }
            return null;
        } catch (err) {
            console.error("Error in checkSpecificTestCompleted:", err);
            TestUI.showToast("Chyba při kontrole historie testů.", "error");
            return null;
        } finally {
            TestUI.setLoadingState('test', false);
        }
    }

    async function loadInitialAdaptiveTestData() {
        TestUI.setLoadingState('test', true);
        TestUI.uiCache.loaderSubtext.textContent = 'Přizpůsobuji otázky...';
        try {
            if (!currentProfile) throw new Error("Profil uživatele není načtený.");
            if (!window.TestLogic || typeof window.TestLogic.loadTestQuestions !== 'function') {
                throw new Error("Chybí logika pro načítání otázek (TestLogic.loadTestQuestions).");
            }
            console.log(`[LoadQ] Volání TestLogic.loadTestQuestions s profilem (Cíl: ${currentProfile.learning_goal}, TestTyp: ${selectedTestType})`);

            const initialTestData = await window.TestLogic.loadTestQuestions(supabase, currentProfile, testTypeConfig);

            adaptiveTestState.questionPool = initialTestData.questionPool || [];
            adaptiveTestState.currentQuestion = initialTestData.firstQuestion || null;
            adaptiveTestState.currentDifficulty = initialTestData.initialDifficultyEstimate || 3;
            adaptiveTestState.totalQuestionsInSession = initialTestData.questionsToAnswerInTest || testTypeConfig[selectedTestType]?.questionsCount || 10;
            adaptiveTestState.questionsAnswered = 0;
            adaptiveTestState.questionsCorrect = 0;
            adaptiveTestState.presentedQuestionIds.clear();
            userAnswers = [];

            console.log(`[LoadQ] Initial adaptive data loaded. First question: ${!!adaptiveTestState.currentQuestion}, Pool size: ${adaptiveTestState.questionPool.length}, Target questions: ${adaptiveTestState.totalQuestionsInSession}`);

            TestUI.initializeAdaptiveTestUI(startTimer, testTime, adaptiveTestState);

        } catch (error) {
            console.error('[UI] Error loading initial adaptive test data:', error);
            adaptiveTestState.currentQuestion = null;
            adaptiveTestState.questionPool = [];
            TestUI.initializeAdaptiveTestUI(startTimer, testTime, adaptiveTestState);
            TestUI.showToast("Chyba při načítání otázek", error.message, "error");
        } finally {
             TestUI.setLoadingState('test', false);
        }
    }
    // --- END: Data Fetching Wrappers ---

    // --- START: Test Orchestration ---
    function startTimer() {
        if(timer) clearInterval(timer);
        testStartTime = new Date();
        testTime = 0;
        TestUI.updateTimer(testTime);
        TestUI.uiCache.testTimer?.classList.remove('timer-warning','timer-danger');
        timer = setInterval(() => {
            testTime++;
            TestUI.updateTimer(testTime);
            // Timer warning logic...
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timer);
        timer = null;
        testEndTime = new Date();
    }

    function saveCurrentAnswer(userAnswerValue) {
        if (!adaptiveTestState.currentQuestion) {
            console.error("Chyba: Nelze uložit odpověď, žádná aktuální otázka.");
            return;
        }

        const questionId = adaptiveTestState.currentQuestion.id;
        let answerEntry = userAnswers.find(ans => ans.question_db_id === questionId);

        if (!answerEntry) {
            answerEntry = {
                question_db_id: questionId,
                question_number_in_test: adaptiveTestState.questionsAnswered + 1,
                userAnswerValue: null,
                 // Copy all static question data to the answer entry
                ...adaptiveTestState.currentQuestion
            };
            userAnswers.push(answerEntry);
        }

        let isCurrentAnswerEmpty = false;
        if (typeof userAnswerValue === 'object' && userAnswerValue !== null) {
            isCurrentAnswerEmpty = Object.values(userAnswerValue).every(part => part === null || String(part).trim() === '');
        } else {
            isCurrentAnswerEmpty = userAnswerValue === null || String(userAnswerValue).trim() === '';
        }

        answerEntry.userAnswerValue = isCurrentAnswerEmpty ? null : userAnswerValue;

        console.log(`[SaveCurrentAnswer] Odpověď uložena pro Q ID ${questionId}:`, answerEntry.userAnswerValue);
        TestUI.updateAdaptiveProgressBar(adaptiveTestState.questionsAnswered, adaptiveTestState.totalQuestionsInSession);
    }

    async function evaluateCurrentAnswer() {
        const question = adaptiveTestState.currentQuestion;
        let currentAnswerData = userAnswers.find(ans => ans.question_db_id === question.id);

        if (!currentAnswerData) {
            console.warn(`[EvaluateCurrentAnswer] Pro Q ID ${question.id} nebyl nalezen záznam o odpovědi. Zpracovávám jako přeskočeno.`);
            saveCurrentAnswer("SKIPPED_BY_USER");
            currentAnswerData = userAnswers.find(ans => ans.question_db_id === question.id);
        } else if (currentAnswerData.userAnswerValue === null || (typeof currentAnswerData.userAnswerValue === 'string' && currentAnswerData.userAnswerValue.trim() === "")) {
             currentAnswerData.userAnswerValue = "SKIPPED_BY_USER";
        }

        TestUI.showGeminiOverlay(true);
        try {
            const evaluationResult = await window.TestLogic.checkAnswerWithGemini(
                question.question_type, question.question_text, question.correct_answer,
                currentAnswerData.userAnswerValue, question.maxScore,
                adaptiveTestState.questionsAnswered, question.solution_explanation, question.options
            );

            currentAnswerData.scoreAwarded = evaluationResult.score;
            currentAnswerData.correctness = evaluationResult.correctness;
            currentAnswerData.reasoning = evaluationResult.reasoning;
            currentAnswerData.error_analysis = evaluationResult.detailed_error_analysis;
            currentAnswerData.feedback = evaluationResult.future_improvement_feedback;
            currentAnswerData.checked_by = 'gemini_scored';

            console.log(`[EvaluateCurrentAnswer] Q ID ${question.id} vyhodnoceno: Skóre ${evaluationResult.score}/${question.maxScore}, Správnost: ${evaluationResult.correctness}`);
            return evaluationResult.correctness === 'correct' || evaluationResult.correctness === 'partial';
        } catch (error) {
            console.error(`[EvaluateCurrentAnswer] Chyba vyhodnocení pro Q ID ${question.id}:`, error);
            currentAnswerData.scoreAwarded = 0;
            currentAnswerData.correctness = 'error';
            currentAnswerData.reasoning = `Automatické hodnocení selhalo: ${error.message}`;
            currentAnswerData.checked_by = 'error';
            return false;
        } finally {
            TestUI.showGeminiOverlay(false);
        }
    }

    async function finishTest() {
        stopTimer();
        if (userAnswers.length === 0 && !adaptiveTestState.currentQuestion) {
            TestUI.initializeAppUIState(currentProfile); // Reset UI to selection screen
            return;
        }

        TestUI.setLoadingState('results', true);
        if(TestUI.uiCache.finishBtn) {
            TestUI.uiCache.finishBtn.disabled = true;
            TestUI.uiCache.finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vyhodnocuji...';
        }

        let saveResult = { success: false };
        try {
            testResultsData = window.TestLogic.calculateFinalResults(userAnswers, questions);
            testResultsData.timeSpent = testTime;

            const testConfigForSave = testTypeConfig[selectedTestType];
            if (testConfigForSave?.identifier) {
                if (!testResultsData.summary) testResultsData.summary = {};
                testResultsData.summary.test_type_identifier = testConfigForSave.identifier;
                testResultsData.summary.adaptive = true;
            }
             if (testResultsData.summary) testResultsData.summary.answers = userAnswers;

            saveResult = await window.TestLogic.saveTestResults(supabase, currentUser, testResultsData, userAnswers, questions, testEndTime);
            diagnosticId = saveResult.diagnosticId || null;

            if (saveResult.success) {
                const pointsResult = await window.TestLogic.awardPoints(supabase, currentUser, currentProfile, selectedTestType, testResultsData, testTypeConfig);
                if (pointsResult?.success) {
                    currentProfile.points = pointsResult.newTotal;
                    TestUI.showToast(`+${pointsResult.awardedPoints} kreditů získáno!`, `Za test '${testTypeConfig[selectedTestType].title}'`, 'success');
                }
                if (typeof window.TestLogic.checkAndAwardAchievements === 'function' && currentProfile) {
                    await window.TestLogic.checkAndAwardAchievements(currentUser.id, currentProfile, {});
                }
            } else {
                 if(TestUI.uiCache.continueBtn) TestUI.uiCache.continueBtn.setAttribute('data-save-error', 'true');
            }
            TestUI.displayResults(testResultsData, testTime, userAnswers, diagnosticId, saveResult.success, testConfigForSave.title);
            history.pushState({ state: 'testFinished' }, document.title, window.location.href);

        } catch (error) {
            console.error("Chyba při dokončování adaptivního testu:", error);
            TestUI.showGeminiOverlay(false);
            if (!testResultsData) {
                testResultsData = { score: 0, percentage: 0, correctAnswers: 0, incorrectAnswers: userAnswers.length, totalAnswered: 0, evaluationErrors: userAnswers.length };
            }
            TestUI.displayResults(testResultsData, testTime, userAnswers, null, false);
            if(TestUI.uiCache.lowScoreMessageContainer) TestUI.uiCache.lowScoreMessageContainer.innerHTML = `<div class="error-message-container">...</div>`;
            if(TestUI.uiCache.continueBtn) TestUI.uiCache.continueBtn.setAttribute('data-save-error', 'true');
            history.pushState({ state: 'testFinishedWithError' }, document.title, window.location.href);
        } finally {
            TestUI.setLoadingState('results', false);
        }
    }

    // --- START: Event Handlers ---
    function setupEventListeners() {
        console.log("[SETUP] Nastavování posluchačů událostí...");
        if (TestUI.uiCache.mainMobileMenuToggle) TestUI.uiCache.mainMobileMenuToggle.addEventListener('click', TestUI.openMenu);
        if (TestUI.uiCache.sidebarCloseToggle) TestUI.uiCache.sidebarCloseToggle.addEventListener('click', TestUI.closeMenu);
        if (TestUI.uiCache.sidebarOverlay) TestUI.uiCache.sidebarOverlay.addEventListener('click', TestUI.closeMenu);
        if (TestUI.uiCache.sidebarToggleBtn) TestUI.uiCache.sidebarToggleBtn.addEventListener('click', TestUI.toggleSidebar);
        if (TestUI.uiCache.nextBtn) TestUI.uiCache.nextBtn.addEventListener('click', handleNextQuestionClick);
        if (TestUI.uiCache.skipBtn) TestUI.uiCache.skipBtn.addEventListener('click', handleSkipQuestionClick);
        if (TestUI.uiCache.finishBtn) TestUI.uiCache.finishBtn.addEventListener('click', handleFinishTestClick);

        if (TestUI.uiCache.retryBtn) {
            TestUI.uiCache.retryBtn.addEventListener('click', () => {
                TestUI.initializeAppUIState(currentProfile, testTypeConfig);
                history.replaceState({ state: 'testSelection' }, document.title, window.location.href);
            });
        }
        if (TestUI.uiCache.summaryReviewAnswersBtn) TestUI.uiCache.summaryReviewAnswersBtn.addEventListener('click', () => { TestUI.displayReview(userAnswers, testResultsData); history.pushState({ state: 'reviewCompletedTest' }, document.title, window.location.href); });
        if (TestUI.uiCache.continueBtn) TestUI.uiCache.continueBtn.addEventListener('click', () => { if (!TestUI.uiCache.continueBtn.disabled) window.location.href = `/dashboard/procvicovani/plan.html`; });
        if (TestUI.uiCache.reviewAnswersBtn) TestUI.uiCache.reviewAnswersBtn.onclick = () => { TestUI.displayReview(userAnswers, testResultsData); };
        if (TestUI.uiCache.backToResultsBtn) TestUI.uiCache.backToResultsBtn.addEventListener('click', () => { TestUI.handleBackButton({ state: { state: 'reviewCompletedTest' } }, testResultsData, currentProfile, testTypeConfig); });
        TestUI.uiCache.testTypeCards.forEach(button => { button.addEventListener('click', (event) => { handleTestSelection(event, testTypeConfig); }); });
        if (TestUI.uiCache.startSelectedTestBtnGlobal) TestUI.uiCache.startSelectedTestBtnGlobal.addEventListener('click', startSelectedTest);

        window.addEventListener('popstate', (e) => handleBackButton(e, testResultsData, currentProfile, testTypeConfig));
        window.addEventListener('resize', () => { if (window.innerWidth <= 992 && TestUI.uiCache.sidebar?.classList.contains('active')) TestUI.closeMenu(); });

        if (TestUI.uiCache.notificationBell) TestUI.uiCache.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); TestUI.uiCache.notificationsDropdown?.classList.toggle('active'); });
        if (TestUI.uiCache.markAllReadBtn) TestUI.uiCache.markAllReadBtn.addEventListener('click', markAllNotificationsReadUI);
        if (TestUI.uiCache.notificationsList) {
            TestUI.uiCache.notificationsList.addEventListener('click', async (event) => {
                const item = event.target.closest('.notification-item');
                if (item) {
                    const notificationId = item.dataset.id;
                    const link = item.dataset.link;
                    if (!item.classList.contains('is-read') && notificationId) {
                        await markNotificationReadUI(notificationId);
                    }
                    if (link) window.location.href = link;
                }
            });
        }
        document.addEventListener('click', (event) => {
            if (TestUI.uiCache.notificationsDropdown?.classList.contains('active') && !TestUI.uiCache.notificationsDropdown.contains(event.target) && !TestUI.uiCache.notificationBell?.contains(event.target)) {
                TestUI.uiCache.notificationsDropdown.classList.remove('active');
            }
        });

        window.addEventListener('online', TestUI.updateOnlineStatus);
        window.addEventListener('offline', TestUI.updateOnlineStatus);
        console.log("[SETUP] Posluchači událostí nastaveni.");
    }
    // --- END: Event Handlers ---

    // --- START: Test Flow & Back Button ---
    async function handleNextQuestionClick() {
        if (!adaptiveTestState.currentQuestion || isLoading.test) return;
        const currentAnswerData = userAnswers.find(ans => ans.question_db_id === adaptiveTestState.currentQuestion.id);
        if (!currentAnswerData || currentAnswerData.userAnswerValue === null) {
            TestUI.showToast("Odpověď nezadána", "Prosím, odpovězte na otázku nebo ji přeskočte.", "warning");
            return;
        }

        TestUI.setLoadingState('test', true);
        const treatAsCorrectForDifficulty = await evaluateCurrentAnswer();
        adaptiveTestState.questionsAnswered++;
        if (treatAsCorrectForDifficulty) adaptiveTestState.questionsCorrect++;

        if (adaptiveTestState.questionsAnswered >= adaptiveTestState.totalQuestionsInSession) {
            await finishTest();
        } else {
            const { nextQuestion, nextDifficulty } = await window.TestLogic.getNextAdaptiveQuestion(adaptiveTestState.questionPool, adaptiveTestState.presentedQuestionIds, treatAsCorrectForDifficulty, adaptiveTestState.currentDifficulty, adaptiveTestState.questionsAnswered, adaptiveTestState.totalQuestionsInSession);
            adaptiveTestState.currentDifficulty = nextDifficulty;
            adaptiveTestState.currentQuestion = nextQuestion;
            TestUI.showNextAdaptiveQuestion(adaptiveTestState, saveCurrentAnswer);
        }
        TestUI.setLoadingState('test', false);
    }

    async function handleSkipQuestionClick() {
        if (!adaptiveTestState.currentQuestion || isLoading.test) return;
        TestUI.showToast("Otázka přeskočena", "Odpověď byla označena jako 'Nevím'.", "info");
        saveCurrentAnswer("SKIPPED_BY_USER");

        TestUI.setLoadingState('test', true);
        await evaluateCurrentAnswer();
        adaptiveTestState.questionsAnswered++;

        if (adaptiveTestState.questionsAnswered >= adaptiveTestState.totalQuestionsInSession) {
            await finishTest();
        } else {
            const { nextQuestion, nextDifficulty } = await window.TestLogic.getNextAdaptiveQuestion(adaptiveTestState.questionPool, adaptiveTestState.presentedQuestionIds, false, adaptiveTestState.currentDifficulty, adaptiveTestState.questionsAnswered, adaptiveTestState.totalQuestionsInSession);
            adaptiveTestState.currentDifficulty = nextDifficulty;
            adaptiveTestState.currentQuestion = nextQuestion;
            TestUI.showNextAdaptiveQuestion(adaptiveTestState, saveCurrentAnswer);
        }
        TestUI.setLoadingState('test', false);
    }

    function startSelectedTest() {
        if (!selectedTestType) { TestUI.showToast('Chyba', 'Povinný test nebyl správně určen.', 'error'); return; }
        const config = testTypeConfig[selectedTestType];
        if (!config) { TestUI.showErrorMessagePage(`Neznámý typ testu: ${selectedTestType}`); return; }
        TestUI.uiCache.testSelector.style.display = 'none';
        TestUI.uiCache.testLoader.style.display = 'flex';
        history.pushState({ state: 'testInProgress' }, document.title, window.location.href);
        loadInitialAdaptiveTestData();
    }
    
    function handleBackButton(event) {
        // Implementation in UI file is fine, but can be here too
        TestUI.handleBackButton(event, testResultsData, currentProfile, testTypeConfig, () => TestUI.initializeAppUIState(currentProfile, testTypeConfig));
    }
    // --- END: Test Flow & Back Button ---

    // --- START: Notification Logic ---
    async function fetchAndRenderNotifications() {
        if (!currentUser || !window.TestLogic) return;
        TestUI.setLoadingState('notifications', true);
        try {
            const { unreadCount, notifications } = await window.TestLogic.fetchNotifications(supabase, currentUser.id, NOTIFICATION_FETCH_LIMIT);
            TestUI.renderNotifications(unreadCount, notifications);
        } catch (error) {
            console.error("[UI] Chyba při načítání notifikací:", error);
            TestUI.renderNotifications(0, []);
        } finally {
            TestUI.setLoadingState('notifications', false);
        }
    }

    async function markNotificationReadUI(notificationId) {
        if (!currentUser || !notificationId) return;
        const success = await window.TestLogic.markNotificationRead(supabase, currentUser.id, notificationId);
        if (success) {
            // Update UI
            const item = TestUI.uiCache.notificationsList.querySelector(`[data-id="${notificationId}"]`);
            if (item) item.classList.add('is-read');
            // ... update count ...
        } else {
            TestUI.showToast('Chyba označení oznámení.', 'error');
        }
    }
    // --- END: Notification Logic ---

    // --- START: App Initialization ---
    async function initializeApp() {
        console.log("🚀 [Init Test1] Starting...");
        TestUI.cacheDOMElements();
        if (!initializeSupabase()) return;

        TestUI.applyInitialSidebarState();
        setLoadingState('page', true);

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);
            if (!session || !session.user) {
                window.location.href = '/auth/index.html';
                return;
            }
            currentUser = session.user;

            [currentProfile, allTitles] = await Promise.all([
                fetchUserProfile(currentUser.id),
                fetchTitles()
            ]);

            if (!currentProfile) {
                 throw new Error("Nepodařilo se načíst profil. Zkuste obnovit stránku.");
            }
            
            TestUI.updateUserInfoUI(currentUser, currentProfile, allTitles);
            setupEventListeners();
            TestUI.initTooltips();
            TestUI.initMouseFollower();
            TestUI.initHeaderScrollDetection();
            TestUI.updateCopyrightYear();
            TestUI.updateOnlineStatus();
            await fetchAndRenderNotifications();
            await TestUI.initializeAppUIState(currentProfile, testTypeConfig, async (userId, testIdentifier) => {
                return await checkSpecificTestCompleted(userId, testIdentifier);
            });

        } catch (error) {
            console.error("❌ [Init Test1] Error:", error);
            TestUI.showErrorMessagePage(`Chyba inicializace: ${error.message}`, true);
        } finally {
            TestUI.setLoadingState('page', false);
            TestUI.uiCache.mainContent.style.display = 'block';
            requestAnimationFrame(() => TestUI.uiCache.mainContent.classList.add('loaded'));
        }
    }

    function initializeSupabase() {
        try {
            if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
                throw new Error("Supabase library not loaded.");
            }
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            if (!supabase) throw new Error("Supabase client creation failed.");
            console.log('[Supabase] Client initialized.');
            return true;
        } catch (error) {
            console.error('[Supabase] Initialization failed:', error);
            TestUI.showErrorMessagePage("Kritická chyba: Nelze se připojit k databázi.");
            return false;
        }
    }

    document.addEventListener('DOMContentLoaded', initializeApp);

})();