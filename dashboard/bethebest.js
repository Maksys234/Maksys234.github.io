// dashboard/bethebest.js
// Версия: 6.2 - Улучшено управление загрузчиком и логирование в loadLearningLogs.

// --- Константы и Supabase клиент ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
let supabaseClient = null;

// --- HTML Элементы (Объявление переменных) ---
let authSection, appSection, loginFormContainer, registerFormContainer, notificationArea,
	loginForm, registerForm, logoutButton, userEmailDisplay, learningLogForm,
	learningInput, logsContainer, geminiTasksContainer, geminiLoading,
	quizContainer, questionDisplay, answerCheckboxesContainer, submitAnswerButton,
	feedbackArea, nextQuestionButton, quizLoading, generateTasksButton;

// --- API Ключ ---
const GEMINI_API_KEY = 'AIzaSyB4l6Yj9AjWfkG2Ob2LCAgTsnSwN-UZQcA'; // Твой ключ
const GEMINI_API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- Состояние Квиза ---
let generatedQuestions = [];
let currentQuestionIndex = -1;
let isLoadingQuestions = false;
let fullLearningContextForQuiz = '';
let currentUser = null;

// --- Состояние инициализации сессии ---
let isUserSessionInitialized = false;

// --- Функции ---

function cacheDOMElements() {
    authSection = document.getElementById('authSection');
    appSection = document.getElementById('appSection');
    loginFormContainer = document.getElementById('loginFormContainer');
    registerFormContainer = document.getElementById('registerFormContainer');
    notificationArea = document.getElementById('notificationArea');
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');
    logoutButton = document.getElementById('logoutButton');
    userEmailDisplay = document.getElementById('userEmailDisplay');
    learningLogForm = document.getElementById('learningLogForm');
    learningInput = document.getElementById('learningInput');
    logsContainer = document.getElementById('logsContainer');
    generateTasksButton = document.getElementById('generateTasksButton');
    geminiTasksContainer = document.getElementById('geminiTasksContainer');
    geminiLoading = document.getElementById('geminiLoading');
    quizContainer = document.getElementById('quizContainer');
    questionDisplay = document.getElementById('questionDisplay');
    answerCheckboxesContainer = document.getElementById('answerCheckboxesContainer');
    submitAnswerButton = document.getElementById('submitAnswerButton');
    feedbackArea = document.getElementById('feedbackArea');
    nextQuestionButton = document.getElementById('nextQuestionButton');
    quizLoading = document.getElementById('quizLoading');
    console.log("[DEBUG] DOM elements cached.");
}

function showNotification(message, type = 'info', duration = 3000) {
    if (!notificationArea) { console.warn("Notification area not found"); return; }
    const notificationDiv = document.createElement('div');
    notificationDiv.className = `notification ${type}`;
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    else if (type === 'error') iconClass = 'fa-exclamation-circle';
    else if (type === 'warning') iconClass = 'fa-exclamation-triangle';
    notificationDiv.innerHTML = `
        <i class="fas ${iconClass} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-message">${sanitizeHTML(message)}</div>
        </div>`;
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.className = 'toast-close';
    closeButton.onclick = () => {
        notificationDiv.style.opacity = '0';
        notificationDiv.style.transform = 'translateX(120%)';
        setTimeout(() => { if (notificationDiv.parentElement) notificationDiv.remove(); }, 600);
    };
    notificationDiv.appendChild(closeButton);
    notificationArea.appendChild(notificationDiv);
    notificationDiv.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    requestAnimationFrame(() => {
        notificationDiv.style.opacity = '1';
        notificationDiv.style.transform = 'translateX(0)';
    });
    if (duration > 0) {
        setTimeout(() => {
            notificationDiv.style.opacity = '0';
            notificationDiv.style.transform = 'translateX(120%)';
            const removeHandler = () => { if (notificationDiv.parentElement) notificationDiv.remove(); notificationDiv.removeEventListener('transitionend', removeHandler); };
            notificationDiv.addEventListener('transitionend', removeHandler);
            setTimeout(() => { if (notificationDiv.parentElement) notificationDiv.remove(); }, 600);
        }, duration);
    }
}

window.toggleAuthForms = () => { loginFormContainer?.classList.toggle('hidden'); registerFormContainer?.classList.toggle('hidden'); };
function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }

function setupAuthListeners() {
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('loginEmail')?.value;
            const password = document.getElementById('loginPassword')?.value;
            const button = loginForm.querySelector('button');
            if (!email || !password || !supabaseClient) return;
            if (button) { button.disabled = true; button.textContent = 'Přihlašuji...'; }
            try {
                const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                showNotification('Přihlášení úspěšné!', 'success');
            } catch (err) {
                console.error('[DEBUG] Login error:', err);
                showNotification(`Přihlášení selhalo: ${err.message}`, 'error');
            } finally {
                if (button) { button.disabled = false; button.textContent = 'Přihlásit se'; }
            }
        });
    } else { console.warn("Login form not found."); }

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('registerEmail')?.value;
            const password = document.getElementById('registerPassword')?.value;
            const button = registerForm.querySelector('button');
            if (!email || !password || !supabaseClient) return;
            if (password.length < 8) { showNotification('Heslo musí mít alespoň 8 znaků.', 'warning'); return; }
            if (button) { button.disabled = true; button.textContent = 'Registruji...'; }
            try {
                const { error } = await supabaseClient.auth.signUp({ email, password });
                if (error) throw error;
                showNotification('Registrace úspěšná! Ověřte prosím svůj e-mail.', 'success', 5000);
                toggleAuthForms();
            } catch (err) {
                console.error('[DEBUG] Register error:', err);
                showNotification(`Registrace selhala: ${err.message}`, 'error');
            } finally {
                if (button) { button.disabled = false; button.textContent = 'Zaregistrovat se'; }
            }
        });
    } else { console.warn("Register form not found."); }

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            if (!supabaseClient) return;
            logoutButton.disabled = true;
            try {
                const { error } = await supabaseClient.auth.signOut();
                if (error) throw error;
                showNotification('Odhlášení úspěšné.', 'info');
            } catch (err) {
                console.error('[DEBUG] Logout error:', err);
                showNotification(`Odhlášení selhalo: ${err.message}`, 'error');
                logoutButton.disabled = false;
            }
        });
    } else { console.warn("Logout button not found."); }
}

function setupLogFormListener() {
    if (learningLogForm) {
        learningLogForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const logText = learningInput?.value.trim();
            const submitButton = learningLogForm.querySelector('button[type="submit"]');
            if (!currentUser) { showNotification('Pro uložení se přihlas.', 'error'); return; }
            if (!logText) { showNotification('Napiš, co ses naučil/a.', 'warning'); return; }
            if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Ukládám...'; }
            try {
                console.log('[DEBUG] Saving log for user:', currentUser.id);
                if (!supabaseClient) throw new Error("Supabase client is not initialized.");
                const { error } = await supabaseClient.from('learning_logs').insert([{ user_id: currentUser.id, log_text: logText }]);
                if (error) throw new Error(`Supabase error (${error.code || 'N/A'}): ${error.message}`);
                showNotification('Pokrok uložen!', 'success');
                if (learningInput) learningInput.value = '';
                console.log('[DEBUG] Log saved, reloading logs and potentially quiz...');
                const logsLoaded = await loadLearningLogs(currentUser.id);
                if (logsLoaded && fullLearningContextForQuiz && quizContainer) {
                    console.log("[DEBUG] Logs reloaded and context exists, fetching new questions for quiz...");
                    await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
                } else if (logsLoaded && !fullLearningContextForQuiz) {
                    console.warn("[DEBUG] Logs loaded but context empty after save. Quiz may not update if it was not visible.");
                    if (quizContainer && quizContainer.style.display === 'block'){ displayEndOfQuizMessage(false, true); }
                } else { console.warn("[DEBUG] Logs not loaded or context empty after save. Quiz will not update."); }
            } catch (err) {
                console.error('[DEBUG] Log save error:', err);
                showNotification(`Uložení selhalo: ${err.message}`, 'error');
            } finally {
                if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Uložit pokrok'; }
            }
        });
    } else { console.warn("Learning log form not found."); }
}

// --- Загрузка логов (ИСПРАВЛЕНО v6.2) ---
async function loadLearningLogs(userId) {
    console.log(`[DEBUG] loadLearningLogs v6.2 called for user: ${userId}`);
    fullLearningContextForQuiz = ''; // Сброс контекста перед загрузкой
    if (generateTasksButton) generateTasksButton.style.display = 'none'; // Скрыть кнопку, пока нет контекста

    if (!userId || !logsContainer || !supabaseClient) {
        console.warn("[DEBUG v6.2] Cannot load logs: userId, logsContainer or supabaseClient missing.");
        if (logsContainer) {
             logsContainer.innerHTML = '<p style="color: var(--accent-orange); text-align: center; margin-top: 1rem;">Chyba konfigurace pro načtení záznamů.</p>';
        }
        return false;
    }

    logsContainer.innerHTML = '<div class="loader visible-loader">Načítám záznamy...</div>';
    console.log("[DEBUG v6.2] Loader displayed.");

    try {
        console.log(`[DEBUG v6.2] Querying learning_logs for user_id: ${userId}`);
        const { data, error, status } = await supabaseClient
            .from('learning_logs')
            .select('log_text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(30);

        // Логирование ответа от Supabase
        console.log(`[DEBUG v6.2] Supabase query finished. Status: ${status}. Error:`, error);
        if (data) {
            console.log(`[DEBUG v6.2] Supabase data received. Length: ${data.length}`);
        } else {
            console.log(`[DEBUG v6.2] Supabase data is null/undefined.`);
        }

        if (error) { // Явная проверка ошибки
            console.error('[DEBUG v6.2] Supabase error during log fetch:', error);
            throw error; // Передать ошибку в catch
        }

        // Обработка данных (даже если data === null или data === [])
        logsContainer.innerHTML = ''; // Очистка загрузчика ПЕРЕД добавлением контента
        if (data && data.length > 0) {
            console.log(`[DEBUG v6.2] Processing ${data.length} logs.`);
            data.forEach(log => {
                const logElement = document.createElement('div');
                logElement.classList.add('log-entry');
                logElement.innerHTML = `<p>${sanitizeHTML(log.log_text.replace(/\n/g, '<br>'))}</p><small>Datum: ${new Date(log.created_at).toLocaleString('cs-CZ')}</small>`;
                logsContainer.appendChild(logElement);
                requestAnimationFrame(() => {
                     requestAnimationFrame(() => {
                         logElement.style.opacity = '1';
                         logElement.style.transform = 'translateY(0)';
                     });
                 });
            });

            const reversedData = [...data].reverse();
            fullLearningContextForQuiz = reversedData.map(log => `Datum: ${new Date(log.created_at).toLocaleDateString('cs-CZ')}\nText: ${log.log_text}`).join("\n\n---\n\n");
            console.log('[DEBUG v6.2] Learning context generated. Length:', fullLearningContextForQuiz.length);
            if (generateTasksButton && fullLearningContextForQuiz) { // Убедимся, что контекст не пуст
                generateTasksButton.style.display = 'inline-flex';
                generateTasksButton.disabled = false;
                generateTasksButton.textContent = 'Restartovat Kvíz';
            }
        } else {
            console.log('[DEBUG v6.2] No logs found for this user or data is null.');
            logsContainer.innerHTML = '<p style="text-align: center; margin-top: 1rem;">Zatím žádné záznamy.</p>';
            // fullLearningContextForQuiz остается пустым, кнопка скрыта
        }
        console.log('[DEBUG v6.2] loadLearningLogs returning true.');
        return true;

    } catch (err) {
        console.error('[DEBUG v6.2] Error in loadLearningLogs catch block:', err);
        logsContainer.innerHTML = `<p style="color: var(--accent-pink); text-align: center; margin-top: 1rem;">Chyba načítání záznamů: ${err.message}</p>`;
        // fullLearningContextForQuiz остается пустым, кнопка скрыта
        console.log('[DEBUG v6.2] loadLearningLogs returning false due to error.');
        return false;
    }
}


// --- Генерация Multiple Choice ---
async function generateMultipleChoiceQuestions(context) {
    console.log('[DEBUG] generateMultipleChoiceQuestions called.');
    if (!context) { console.warn('[DEBUG] generateMultipleChoiceQuestions: No context provided.'); return null; }
    if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) { console.error('[DEBUG] Missing valid Gemini API Key.'); throw new Error('Chybí konfigurace AI.'); }
    const prompt = `Na základě VŠECH následujících záznamů o učení studenta, vygeneruj 3-5 otázek s výběrem odpovědí (multiple choice), které otestují jeho porozumění RŮZNÝM tématům zmíněným v záznamech. Ke KAŽDÉ otázce vytvoř PŘESNĚ 5 možností odpovědí (označených A, B, C, D, E). Otázka MŮŽE mít JEDNU NEBO VÍCE SPRÁVNÝCH odpovědí. Uveď VŠECHNA správná písmena odpovědí jako pole stringů a krátké vysvětlení, proč jsou tyto odpovědi správné. Vrať odpověď POUZE jako JSON pole objektů. Každý objekt musí obsahovat PŘESNĚ tyto klíče: "question" (string), "options" (array of 5 strings), "answer" (array of strings, např. ["A"], ["B", "D"]), "explanation" (string). JSON formát musí být striktně dodržen. Nepoužívej Markdown mimo JSON. Zajisti, aby otázky pokrývaly RŮZNÁ témata z poskytnutého kontextu. Kontext učení:\n---\n${context}\n---\n\nPříklad formátu JSON pole:\n[{"question": "...", "options": ["...", "...", "...", "...", "..."], "answer": ["B", "D"], "explanation": "..."}, ... ]`;
    const requestBody = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, topP: 0.95 } };
    try {
        console.log('[DEBUG] Requesting MC questions from Gemini API...');
        const response = await fetch(GEMINI_API_URL_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) { const errorData = await response.json().catch(() => ({})); console.error('[DEBUG] Gemini API Error Response:', errorData); throw new Error(`API Error ${response.status}: ${errorData?.error?.message || response.statusText}`); }
        const data = await response.json();
        console.log('[DEBUG] Raw Gemini MC Response:', JSON.stringify(data).substring(0, 300) + '...');
        if (data.candidates?.[0]?.finishReason === "SAFETY") { throw new Error("Odpověď AI byla zablokována bezpečnostním filtrem."); }
        if (data.promptFeedback?.blockReason) { throw new Error(`Dotaz blokován AI filtrem (${data.promptFeedback.blockReason}).`); }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) { throw new Error('AI nevrátilo žádný text.'); }
        let jsonString = text; const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/); if (jsonMatch?.[1]) jsonString = jsonMatch[1];
        try {
            const parsed = JSON.parse(jsonString);
            if (Array.isArray(parsed) && parsed.every(q => q && q.question && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length === 5 && q.options.every(opt => typeof opt === 'string') && Array.isArray(q.answer) && q.answer.length > 0 && q.explanation && typeof q.explanation === 'string' && q.answer.every(a => typeof a === 'string' && ["A", "B", "C", "D", "E"].includes(a.toUpperCase())))) {
                console.log('[DEBUG] Successfully parsed valid MC questions:', parsed.length);
                return parsed.map(q => ({ ...q, answer: q.answer.map(a => a.toUpperCase()) }));
            }
            else { console.error('[DEBUG] Invalid JSON structure from AI:', parsed); throw new Error('Neplatná struktura JSON odpovědi od AI.'); }
        } catch (e) { console.error('[DEBUG] JSON Parse Error:', e, 'Raw String:', jsonString); throw new Error('Chyba zpracování JSON odpovědi od AI.'); }
    } catch (error) { console.error('[DEBUG] Gemini MC question generation error:', error); throw error; }
}

function resetQuizState() { console.log('[DEBUG] Resetting quiz state.'); generatedQuestions = []; currentQuestionIndex = -1; isLoadingQuestions = false; }
function hideQuizUI() { if (quizContainer) quizContainer.style.display = 'none'; if (questionDisplay) questionDisplay.innerHTML = ''; if (answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = ''; if (submitAnswerButton) submitAnswerButton.style.display = 'none'; if (feedbackArea) feedbackArea.innerHTML = ''; if (nextQuestionButton) nextQuestionButton.style.display = 'none'; if (quizLoading) quizLoading.classList.add('hidden'); console.log('[DEBUG] Quiz UI hidden.'); }
function setQuizLoadingState(isLoading) { if (!quizLoading) { console.warn("Quiz loading element not found."); return; } quizLoading.classList.toggle('visible-loader', isLoading); quizLoading.classList.toggle('hidden', !isLoading); if(generateTasksButton) generateTasksButton.disabled = isLoading; if(submitAnswerButton) submitAnswerButton.disabled = isLoading; if(nextQuestionButton) nextQuestionButton.disabled = isLoading; console.log(`[DEBUG] Quiz loading state set to: ${isLoading}`); }
function hideQuizElements() { if(answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = ''; if(submitAnswerButton) submitAnswerButton.style.display = 'none'; if(feedbackArea) feedbackArea.innerHTML = ''; if(nextQuestionButton) nextQuestionButton.style.display = 'none'; }

async function fetchAndDisplayFirstQuestions(context) {
    console.log('[DEBUG] fetchAndDisplayFirstQuestions called.');
    if (!context) { showNotification('Chybí kontext pro kvíz (žádné záznamy?).', 'warning'); console.warn('[DEBUG] No context provided for quiz.'); displayEndOfQuizMessage(false, true); return; }
    if (isLoadingQuestions) { console.log("[DEBUG] Fetch already in progress, skipping."); return; }
    if (!quizContainer || !quizLoading) { console.error("[DEBUG] Missing quiz container or loading elements."); return; }

    resetQuizState();
    isLoadingQuestions = true;
    setQuizLoadingState(true);
    if(quizContainer) quizContainer.style.display = 'block';
    if(questionDisplay) questionDisplay.innerHTML = '';
    if(feedbackArea) feedbackArea.innerHTML = '';
    if(answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = '';
    if(submitAnswerButton) submitAnswerButton.style.display = 'none';
    if(nextQuestionButton) nextQuestionButton.style.display = 'none';

    try {
        console.log('[DEBUG] Fetching first batch from Gemini...');
        generatedQuestions = await generateMultipleChoiceQuestions(context);
        if (generatedQuestions && generatedQuestions.length > 0) {
            console.log(`[DEBUG] Fetched ${generatedQuestions.length} initial questions.`);
            currentQuestionIndex = 0;
            displayCurrentQuestion();
        } else {
            console.warn('[DEBUG] No questions generated by AI.');
            throw new Error('AI nevygenerovalo žádné otázky pro tento kontext.');
        }
    } catch (error) {
        console.error('[DEBUG] Failed fetch first questions:', error);
        showNotification(`Chyba generování kvízu: ${error.message}`, 'error');
        displayEndOfQuizMessage(true);
    } finally {
        isLoadingQuestions = false;
        setQuizLoadingState(false);
    }
}

async function fetchMoreQuestions() {
    console.log('[DEBUG] fetchMoreQuestions called.');
    if (!fullLearningContextForQuiz) { console.warn("[DEBUG] No context to fetch more questions."); displayEndOfQuizMessage(); return; }
    if (isLoadingQuestions) { console.warn("[DEBUG] Fetch more already in progress."); return; }
    isLoadingQuestions = true;
    if (nextQuestionButton) { nextQuestionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Načítám...'; nextQuestionButton.disabled = true; }
    let success = false;
    try {
        console.log('[DEBUG] Fetching more questions from Gemini...');
        const newQuestions = await generateMultipleChoiceQuestions(fullLearningContextForQuiz);
        if (newQuestions && newQuestions.length > 0) {
            const existingQuestionsSet = new Set(generatedQuestions.map(q => q.question));
            const uniqueNewQuestions = newQuestions.filter(nq => !existingQuestionsSet.has(nq.question));
            if (uniqueNewQuestions.length > 0) { generatedQuestions.push(...uniqueNewQuestions); console.log(`[DEBUG] Added ${uniqueNewQuestions.length} new unique questions. Total: ${generatedQuestions.length}`); success = true; }
            else { console.log("[DEBUG] Gemini returned only duplicate questions."); showNotification("AI vrátilo otázky, které již byly zobrazeny.", "info"); }
        } else { console.log("[DEBUG] Gemini returned no new questions."); showNotification("Nebyly nalezeny další otázky pro tento kontext.", "info"); }
    } catch (error) { console.error("[DEBUG] Failed fetch more questions:", error); showNotification(`Chyba načítání dalších otázek: ${error.message}`, 'error'); }
    finally {
        isLoadingQuestions = false;
        if (nextQuestionButton) { nextQuestionButton.disabled = false; nextQuestionButton.innerHTML = 'Další otázka <i class="fas fa-arrow-right"></i>'; }
        if (success && currentQuestionIndex < generatedQuestions.length) { displayCurrentQuestion(); }
        else { displayEndOfQuizMessage(); }
    }
}

function displayCurrentQuestion() { /* ... (No changes, assumed to be correct from previous version) ... */ }
function arraysContainSameElements(arr1, arr2) { /* ... (No changes, assumed to be correct from previous version) ... */ }
function handleAnswerSubmit() { /* ... (No changes, assumed to be correct from previous version) ... */ }
function handleNextQuestion() { /* ... (No changes, assumed to be correct from previous version) ... */ }
function displayEndOfQuizMessage(isError = false, isContextMissing = false) { /* ... (No changes, assumed to be correct from previous version) ... */ }

function initializeSupabase() {
    console.log("[DEBUG] Initializing Supabase...");
    try {
        if (!window.supabase?.createClient) throw new Error("Supabase library not loaded.");
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        if (!supabaseClient) throw new Error("Supabase client creation failed.");
        console.log("[DEBUG] Supabase client initialized."); return true;
    }
    catch (e) { console.error("[DEBUG] Supabase init failed:", e); showNotification("Chyba připojení k databázi. Obnovte stránku.", "error", 0); return false; }
}

async function initializeApp() {
    console.log("[DEBUG] initializeApp v6.2 - Start"); // Изменена версия
    cacheDOMElements();
    setupAuthListeners();
    setupLogFormListener();

    if (submitAnswerButton) submitAnswerButton.addEventListener('click', handleAnswerSubmit); else console.warn('Submit answer button not found.');
    if (nextQuestionButton) nextQuestionButton.addEventListener('click', handleNextQuestion); else console.warn('Next question button not found.');
    if (generateTasksButton) {
         generateTasksButton.textContent = 'Restartovat Kvíz';
         generateTasksButton.addEventListener('click', async () => {
             if (!fullLearningContextForQuiz) { showNotification("Nejprve přidejte záznam o učení.", "warning"); return; }
             if (isLoadingQuestions) return;
             showNotification('Generuji novou sadu otázek...', 'info', 2000);
             await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
         });
         generateTasksButton.style.display = 'none';
    } else { console.warn('Generate/Restart button not found.'); }

    if (!initializeSupabase()) return;

    if (supabaseClient && supabaseClient.auth) {
        console.log("[DEBUG] Setting up onAuthStateChange listener...");
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('[DEBUG Auth State Change v6.2] Event:', event, 'Session ID:', session?.user?.id, 'Current User ID:', currentUser?.id, 'Initialized:', isUserSessionInitialized);
            if (session?.user) {
                const newUserId = session.user.id;
                if (currentUser?.id !== newUserId || !isUserSessionInitialized) {
                    currentUser = session.user;
                    isUserSessionInitialized = false;
                    console.log('[DEBUG Auth State Change v6.2] User SIGNED IN or CHANGED:', currentUser.id);
                    authSection?.classList.add('hidden');
                    appSection?.classList.remove('hidden');
                    if (userEmailDisplay) userEmailDisplay.textContent = session.user.email;
                    if (logoutButton) logoutButton.disabled = false;
                    hideQuizUI(); resetQuizState();

                    try {
                        console.log('[DEBUG Auth State Change v6.2] Awaiting loadLearningLogs...');
                        const logsLoaded = await loadLearningLogs(session.user.id); // logsLoaded теперь true/false
                        console.log(`[DEBUG Auth State Change v6.2] loadLearningLogs finished. Result: ${logsLoaded}. Context length: ${fullLearningContextForQuiz?.length || 0}`);

                        if (logsLoaded && fullLearningContextForQuiz) {
                            console.log('[DEBUG Auth State Change v6.2] Context found, awaiting fetchAndDisplayFirstQuestions...');
                            await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
                            console.log('[DEBUG Auth State Change v6.2] fetchAndDisplayFirstQuestions finished.');
                        } else if (logsLoaded && !fullLearningContextForQuiz) {
                             console.log('[DEBUG Auth State Change v6.2] Logs loaded but no context (no logs found or empty). Displaying prompt.');
                             if(quizContainer) quizContainer.style.display = 'block';
                             displayEndOfQuizMessage(false, true); // Сообщение: "добавьте контекст"
                             if (quizLoading) quizLoading.classList.add('hidden');
                             // generateTasksButton должен быть уже скрыт из loadLearningLogs
                        } else { // logsLoaded is false (ошибка при загрузке логов)
                             console.error("[DEBUG Auth State Change v6.2] Failed to load learning logs. Quiz cannot start.");
                             if(quizContainer) quizContainer.style.display = 'block';
                             displayEndOfQuizMessage(true); // Сообщение: "ошибка загрузки логов"
                             if (quizLoading) quizLoading.classList.add('hidden');
                             // generateTasksButton должен быть уже скрыт из loadLearningLogs
                        }
                        isUserSessionInitialized = true; // Сессия инициализирована (или попытка была сделана)
                    } catch (error) {
                        console.error("[DEBUG Auth State Change v6.2] Error during log loading or quiz start:", error);
                        showNotification("Chyba při načítání dat nebo startu kvízu.", "error");
                        hideQuizUI();
                        isUserSessionInitialized = false; // Сброс, если инициализация не удалась
                    }
                } else if (event === 'TOKEN_REFRESHED' && isUserSessionInitialized) {
                    console.log('[DEBUG Auth State Change v6.2] Token refreshed for already initialized session. No UI reload needed.');
                } else {
                     console.log('[DEBUG Auth State Change v6.2] User already signed in and session initialized or other event. No action taken.');
                }
            } else { // Signed out
                currentUser = null;
                isUserSessionInitialized = false;
                console.log('[DEBUG Auth State Change v6.2] User SIGNED OUT.');
                authSection?.classList.remove('hidden');
                appSection?.classList.add('hidden');
                if (userEmailDisplay) userEmailDisplay.textContent = '';
                if (logsContainer) logsContainer.innerHTML = '<p style="text-align: center; margin-top: 1rem;">Pro zobrazení historie se přihlaste.</p>';
                if (generateTasksButton) generateTasksButton.style.display = 'none';
                hideQuizUI(); resetQuizState(); fullLearningContextForQuiz = '';
            }
        });
    } else {
         console.error("[DEBUG] Supabase client or auth object not available to attach listener.");
         showNotification("Kritická chyba inicializace autentizace.", "error", 0);
    }
    console.log("[DEBUG] initializeApp v6.2 - Initialization complete. Waiting for auth state...");
}


// --- Запуск приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);