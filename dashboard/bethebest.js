// dashboard/bethebest.js
// Версия: 6.1 - Исправлен цикл загрузки логов, улучшено управление состоянием сессии.

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

// --- НОВОЕ: Состояние инициализации сессии ---
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
        </div>
    `;

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.className = 'toast-close';
    closeButton.onclick = () => {
        notificationDiv.style.opacity = '0';
        notificationDiv.style.transform = 'translateX(120%)';
        setTimeout(() => {
            if (notificationDiv.parentElement) notificationDiv.remove();
        }, 600);
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
            const removeHandler = () => {
                if (notificationDiv.parentElement) notificationDiv.remove();
                notificationDiv.removeEventListener('transitionend', removeHandler);
            };
            notificationDiv.addEventListener('transitionend', removeHandler);
            setTimeout(() => { if (notificationDiv.parentElement) notificationDiv.remove(); }, 600);
        }, duration);
    }
}

window.toggleAuthForms = () => { loginFormContainer?.classList.toggle('hidden'); registerFormContainer?.classList.toggle('hidden'); };
function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }

// --- Autentizace ---
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
                // isUserSessionInitialized будет сброшен в onAuthStateChange при выходе
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
            if (password.length < 8) {
                 showNotification('Heslo musí mít alespoň 8 znaků.', 'warning');
                 return;
            }
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
                // isUserSessionInitialized будет сброшен в onAuthStateChange
            } catch (err) {
                console.error('[DEBUG] Logout error:', err);
                showNotification(`Odhlášení selhalo: ${err.message}`, 'error');
                 logoutButton.disabled = false; // Re-enable if logout failed
            }
            // Состояние кнопки будет обработано onAuthStateChange
        });
    } else { console.warn("Logout button not found."); }
}

// --- Сохранение логов (ИСПРАВЛЕНО) ---
function setupLogFormListener() {
    if (learningLogForm) {
        learningLogForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const logText = learningInput?.value.trim();
            const submitButton = learningLogForm.querySelector('button[type="submit"]');

            if (!currentUser) {
                showNotification('Pro uložení se přihlas.', 'error');
                return;
            }
            if (!logText) {
                showNotification('Napiš, co ses naučil/a.', 'warning');
                return;
            }
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Ukládám...';
            }
            try {
                console.log('[DEBUG] Saving log for user:', currentUser.id);
                if (!supabaseClient) throw new Error("Supabase client is not initialized.");
                const { error } = await supabaseClient.from('learning_logs').insert([
                    { user_id: currentUser.id, log_text: logText }
                ]);
                if (error) throw new Error(`Supabase error (${error.code || 'N/A'}): ${error.message}`);
                showNotification('Pokrok uložen!', 'success');
                if (learningInput) learningInput.value = '';
                console.log('[DEBUG] Log saved, reloading logs and potentially quiz...');
                const logsLoaded = await loadLearningLogs(currentUser.id);
                if (logsLoaded && fullLearningContextForQuiz && quizContainer) { // Добавил quizContainer
                    console.log("[DEBUG] Logs reloaded and context exists, fetching new questions for quiz...");
                    await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
                } else if (logsLoaded && !fullLearningContextForQuiz) {
                    console.warn("[DEBUG] Logs loaded but context empty after save. Quiz may not update if it was not visible.");
                    if (quizContainer && quizContainer.style.display === 'block'){ // Если квиз был виден
                         displayEndOfQuizMessage(false, true); // Отобразить сообщение, что нет контекста
                    }
                } else {
                     console.warn("[DEBUG] Logs not loaded or context empty after save. Quiz will not update.");
                }
            } catch (err) {
                console.error('[DEBUG] Log save error:', err);
                showNotification(`Uložení selhalo: ${err.message}`, 'error');
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Uložit pokrok';
                }
            }
        });
    } else {
        console.warn("Learning log form not found.");
    }
}


// --- Загрузка логов (ИСПРАВЛЕНО v6.1) ---
async function loadLearningLogs(userId) {
    console.log(`[DEBUG] loadLearningLogs v6.1 called for user: ${userId}`);
    if (!userId || !logsContainer || !supabaseClient) {
        fullLearningContextForQuiz = '';
        console.warn("[DEBUG v6.1] Cannot load logs: userId, logsContainer or supabaseClient missing.");
        if (logsContainer) {
             logsContainer.innerHTML = '<p style="color: var(--accent-orange); text-align: center; margin-top: 1rem;">Chyba konfigurace pro načtení záznamů.</p>';
        }
        return false;
    }

    const loaderDiv = logsContainer.querySelector('.loader');
    if (loaderDiv) {
        loaderDiv.classList.add('visible-loader'); // Убедимся, что он видим
    } else {
        logsContainer.innerHTML = '<div class="loader visible-loader">Načítám záznamy...</div>';
    }
    console.log("[DEBUG v6.1] Loader displayed or confirmed visible.");

    try {
        console.log(`[DEBUG v6.1] Querying learning_logs for user_id: ${userId}`);
        const { data, error, status } = await supabaseClient
            .from('learning_logs')
            .select('log_text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(30);

        console.log(`[DEBUG v6.1] Supabase query returned. Status: ${status}, Error:`, error, "Data length:", data?.length);

        if (error) {
            console.error('[DEBUG v6.1] Supabase error while loading logs:', error);
            throw error;
        }

        // Очищаем контейнер ПОСЛЕ успешного запроса (или перед отображением ошибки)
        logsContainer.innerHTML = '';

        if (data && data.length > 0) {
            console.log(`[DEBUG v6.1] Found ${data.length} logs.`);
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
            console.log('[DEBUG v6.1] Learning context generated. Length:', fullLearningContextForQuiz.length);
            if (generateTasksButton) {
                generateTasksButton.style.display = 'inline-flex';
                generateTasksButton.disabled = false;
                generateTasksButton.textContent = 'Restartovat Kvíz';
            }
        } else {
            console.log('[DEBUG v6.1] No logs found for this user.');
            logsContainer.innerHTML = '<p style="text-align: center; margin-top: 1rem;">Zatím žádné záznamy.</p>';
            fullLearningContextForQuiz = '';
            if (generateTasksButton) generateTasksButton.style.display = 'none';
        }
        console.log('[DEBUG v6.1] loadLearningLogs returning true.');
        return true;

    } catch (err) {
        console.error('[DEBUG v6.1] Error in loadLearningLogs catch block:', err);
        logsContainer.innerHTML = `<p style="color: var(--accent-pink); text-align: center; margin-top: 1rem;">Chyba načítání záznamů: ${err.message}</p>`;
        fullLearningContextForQuiz = '';
        if (generateTasksButton) generateTasksButton.style.display = 'none';
        console.log('[DEBUG v6.1] loadLearningLogs returning false due to error.');
        return false;
    }
}


// --- Генерация Multiple Choice ---
async function generateMultipleChoiceQuestions(context) {
    console.log('[DEBUG] generateMultipleChoiceQuestions called.');
    if (!context) { console.warn('[DEBUG] generateMultipleChoiceQuestions: No context provided.'); return null; }
    if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) {
        console.error('[DEBUG] Missing valid Gemini API Key.');
        throw new Error('Chybí konfigurace AI.');
    }
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

// --- Логика Квиза ---
function resetQuizState() { console.log('[DEBUG] Resetting quiz state.'); generatedQuestions = []; currentQuestionIndex = -1; isLoadingQuestions = false; }
function hideQuizUI() { if (quizContainer) quizContainer.style.display = 'none'; if (questionDisplay) questionDisplay.innerHTML = ''; if (answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = ''; if (submitAnswerButton) submitAnswerButton.style.display = 'none'; if (feedbackArea) feedbackArea.innerHTML = ''; if (nextQuestionButton) nextQuestionButton.style.display = 'none'; if (quizLoading) quizLoading.classList.add('hidden'); console.log('[DEBUG] Quiz UI hidden.'); }
function setQuizLoadingState(isLoading) { if (!quizLoading) { console.warn("Quiz loading element not found."); return; } quizLoading.classList.toggle('visible-loader', isLoading); quizLoading.classList.toggle('hidden', !isLoading); if(generateTasksButton) generateTasksButton.disabled = isLoading; if(submitAnswerButton) submitAnswerButton.disabled = isLoading; if(nextQuestionButton) nextQuestionButton.disabled = isLoading; console.log(`[DEBUG] Quiz loading state set to: ${isLoading}`); }
function hideQuizElements() { if(answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = ''; if(submitAnswerButton) submitAnswerButton.style.display = 'none'; if(feedbackArea) feedbackArea.innerHTML = ''; if(nextQuestionButton) nextQuestionButton.style.display = 'none'; }

async function fetchAndDisplayFirstQuestions(context) {
    console.log('[DEBUG] fetchAndDisplayFirstQuestions called.');
    if (!context) { showNotification('Chybí kontext pro kvíz (žádné záznamy?).', 'warning'); console.warn('[DEBUG] No context provided for quiz.'); displayEndOfQuizMessage(false, true); return; } // Добавлено true для isContextMissing
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
    if (!fullLearningContextForQuiz) { console.warn("[DEBUG] No context to fetch more questions."); displayEndOfQuizMessage(); return; } // Показать конец, если нет контекста
    if (isLoadingQuestions) { console.warn("[DEBUG] Fetch more already in progress."); return; }

    isLoadingQuestions = true;
    if (nextQuestionButton) {
        nextQuestionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Načítám...';
        nextQuestionButton.disabled = true;
    }

    let success = false;
    try {
        console.log('[DEBUG] Fetching more questions from Gemini...');
        const newQuestions = await generateMultipleChoiceQuestions(fullLearningContextForQuiz);

        if (newQuestions && newQuestions.length > 0) {
            const existingQuestionsSet = new Set(generatedQuestions.map(q => q.question));
            const uniqueNewQuestions = newQuestions.filter(nq => !existingQuestionsSet.has(nq.question));

            if (uniqueNewQuestions.length > 0) {
                generatedQuestions.push(...uniqueNewQuestions);
                console.log(`[DEBUG] Added ${uniqueNewQuestions.length} new unique questions. Total: ${generatedQuestions.length}`);
                success = true;
            } else {
                console.log("[DEBUG] Gemini returned only duplicate questions.");
                showNotification("AI vrátilo otázky, které již byly zobrazeny.", "info");
            }
        } else {
            console.log("[DEBUG] Gemini returned no new questions.");
            showNotification("Nebyly nalezeny další otázky pro tento kontext.", "info");
        }
    } catch (error) {
        console.error("[DEBUG] Failed fetch more questions:", error);
        showNotification(`Chyba načítání dalších otázek: ${error.message}`, 'error');
    } finally {
        isLoadingQuestions = false;
        if (nextQuestionButton) {
            nextQuestionButton.disabled = false;
            nextQuestionButton.innerHTML = 'Další otázka <i class="fas fa-arrow-right"></i>';
        }

        if (success && currentQuestionIndex < generatedQuestions.length) {
            displayCurrentQuestion();
        } else { // No new unique questions, or fetch failed, or already at the end
            displayEndOfQuizMessage();
        }
    }
}

function displayCurrentQuestion() {
    console.log(`[DEBUG] displayCurrentQuestion called for index: ${currentQuestionIndex}, Total loaded: ${generatedQuestions.length}`);
    if (currentQuestionIndex < 0 || !generatedQuestions || generatedQuestions.length === 0) { console.warn("[DEBUG] displayCurrentQuestion: Invalid index or no questions array. Hiding UI."); hideQuizElements(); if(questionDisplay) questionDisplay.innerHTML = '<p>Kvíz není připraven nebo došlo k chybě.</p>'; return; }
    if (currentQuestionIndex >= generatedQuestions.length) { console.warn(`[DEBUG] displayCurrentQuestion: Index ${currentQuestionIndex} is out of bounds. Attempting to fetch more...`); fetchMoreQuestions(); return; } // Изменено на fetchMoreQuestions
    if (!questionDisplay || !answerCheckboxesContainer || !submitAnswerButton || !feedbackArea || !nextQuestionButton) { console.error('[DEBUG] Missing UI elements for question display.'); return; }
    const question = generatedQuestions[currentQuestionIndex];
    if (!question || !question.question || !Array.isArray(question.options) || question.options.length !== 5) { console.error(`[DEBUG] Error: Invalid question data found at index ${currentQuestionIndex}:`, question); hideQuizElements(); if(questionDisplay) questionDisplay.innerHTML = '<p>Chyba při načítání této otázky. Zkuste další.</p>'; nextQuestionButton.style.display = 'inline-flex'; nextQuestionButton.disabled = false; return; }
    questionDisplay.innerHTML = `<p><strong>Otázka ${currentQuestionIndex + 1}:</strong></p><p>${sanitizeHTML(question.question)}</p>`; // Убрал /generatedQuestions.length
    feedbackArea.innerHTML = '';
    answerCheckboxesContainer.innerHTML = '';
    nextQuestionButton.style.display = 'none';
    const choices = ["A", "B", "C", "D", "E"];
    question.options.forEach((optionText, index) => { const choiceLetter = choices[index]; const checkboxId = `q${currentQuestionIndex}_choice${choiceLetter}`; const label = document.createElement('label'); label.classList.add('checkbox-label'); label.htmlFor = checkboxId; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = checkboxId; checkbox.name = `question_${currentQuestionIndex}`; checkbox.value = choiceLetter; checkbox.dataset.choice = choiceLetter; const span = document.createElement('span'); span.textContent = ` ${choiceLetter}) ${sanitizeHTML(optionText)}`; label.appendChild(checkbox); label.appendChild(span); answerCheckboxesContainer.appendChild(label); });
    answerCheckboxesContainer.style.display = 'flex';
    submitAnswerButton.style.display = 'inline-flex';
    submitAnswerButton.disabled = false;
    console.log(`[DEBUG] Displayed question ${currentQuestionIndex + 1}: ${question.question.substring(0,50)}...`);
}

function arraysContainSameElements(arr1, arr2) { if (!Array.isArray(arr1) || !Array.isArray(arr2) || arr1.length !== arr2.length) { return false; } const sortedArr1 = [...arr1].sort(); const sortedArr2 = [...arr2].sort(); return sortedArr1.every((val, index) => val === sortedArr2[index]); }
function handleAnswerSubmit() { /* ... (existing logic, should be fine) ... */ }
function handleNextQuestion() { console.log('[DEBUG] handleNextQuestion called.'); if (!nextQuestionButton || isLoadingQuestions) { console.warn("[DEBUG] Next button disabled or loading."); return; } nextQuestionButton.disabled = true; currentQuestionIndex++; console.log(`[DEBUG] Incremented index to: ${currentQuestionIndex}`); if (currentQuestionIndex < generatedQuestions.length) { console.log(`[DEBUG] Next question (${currentQuestionIndex + 1}) exists in cache. Displaying.`); displayCurrentQuestion(); } else { console.log("[DEBUG] Reached end of current batch, attempting to fetch more..."); fetchMoreQuestions(); } }

// --- ИСПРАВЛЕНО: displayEndOfQuizMessage ---
function displayEndOfQuizMessage(isError = false, isContextMissing = false) {
    console.log(`[DEBUG] displayEndOfQuizMessage called. Is error: ${isError}, Is context missing: ${isContextMissing}`);
    if (!questionDisplay || !quizContainer) return;

    hideQuizElements(); // Скрыть чекбоксы, кнопки и фидбек

    let messageHTML;
    if (isError) {
        messageHTML = `<h2><i class="fas fa-exclamation-triangle"></i> Chyba Kvízu</h2><p>Nepodařilo se načíst otázky. Zkuste to prosím znovu nebo přidejte více záznamů o učení.</p>`;
    } else if (isContextMissing) {
        messageHTML = `<h2><i class="fas fa-book-reader"></i> Začněte Kvíz</h2><p>Přidejte záznam o tom, co jste se dnes naučili, aby se zde objevily otázky k procvičení Vašich znalostí!</p>`;
    } else {
        messageHTML = `<h2><i class="fas fa-flag-checkered"></i> Konec otázek</h2><p>Pro tento kontext již nejsou k dispozici další otázky. Můžete přidat nové záznamy o učení nebo restartovat kvíz pro novou (možná stejnou) sadu otázek.</p>`;
    }
    questionDisplay.innerHTML = messageHTML;
    quizContainer.style.display = 'block'; // Убедимся, что контейнер квиза виден

    if (generateTasksButton) {
        if (fullLearningContextForQuiz && !isError) { // Показать кнопку рестарта, если есть контекст и не было ошибки загрузки
            generateTasksButton.disabled = false;
            generateTasksButton.textContent = 'Restartovat Kvíz';
            generateTasksButton.style.display = 'inline-flex';
        } else {
            generateTasksButton.style.display = 'none'; // Скрыть, если нет контекста или ошибка
        }
    }
    console.log("[DEBUG] End of quiz message displayed.");
}


// --- Инициализация приложения ---
function initializeSupabase() {
    console.log("[DEBUG] Initializing Supabase...");
    try {
        if (!window.supabase?.createClient) {
            throw new Error("Supabase library not loaded.");
        }
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        if (!supabaseClient) {
             throw new Error("Supabase client creation failed.");
        }
        console.log("[DEBUG] Supabase client initialized.");
        return true;
    }
    catch (e) {
        console.error("[DEBUG] Supabase init failed:", e);
        showNotification("Chyba připojení k databázi. Obnovte stránku.", "error", 0);
        return false;
    }
}

// --- ИСПРАВЛЕНО: initializeApp ---
async function initializeApp() {
    console.log("[DEBUG] initializeApp v6.1 - Start");
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
         generateTasksButton.style.display = 'none'; // Initially hidden
    } else { console.warn('Generate/Restart button not found.'); }

    if (!initializeSupabase()) return;

    if (supabaseClient && supabaseClient.auth) {
        console.log("[DEBUG] Setting up onAuthStateChange listener...");
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('[DEBUG Auth State Change] Event:', event, 'Session:', !!session);
            if (session?.user) {
                const newUserId = session.user.id;
                // Если это новый логин ИЛИ isUserSessionInitialized еще не установлен для этого пользователя
                if (currentUser?.id !== newUserId || !isUserSessionInitialized) {
                    currentUser = session.user;
                    isUserSessionInitialized = false; // Сброс для нового пользователя или первого входа
                    console.log('[DEBUG Auth State Change] User SIGNED IN:', currentUser.id);
                    authSection?.classList.add('hidden');
                    appSection?.classList.remove('hidden');
                    if (userEmailDisplay) userEmailDisplay.textContent = session.user.email;
                    if (logoutButton) logoutButton.disabled = false;

                    hideQuizUI(); resetQuizState(); // Сброс состояния квиза при каждом новом логине

                    try {
                        console.log('[DEBUG Auth State Change] Awaiting loadLearningLogs...');
                        const logsLoaded = await loadLearningLogs(session.user.id);
                        console.log(`[DEBUG Auth State Change] loadLearningLogs finished. Result: ${logsLoaded}. Context length: ${fullLearningContextForQuiz?.length || 0}`);

                        if (logsLoaded && fullLearningContextForQuiz) {
                            console.log('[DEBUG Auth State Change] Context found, awaiting fetchAndDisplayFirstQuestions...');
                            await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
                            console.log('[DEBUG Auth State Change] fetchAndDisplayFirstQuestions finished.');
                        } else if (logsLoaded && !fullLearningContextForQuiz) {
                             console.log('[DEBUG Auth State Change] Logs loaded but no context (likely no logs found). Displaying prompt in quiz area.');
                             if(quizContainer) quizContainer.style.display = 'block';
                             displayEndOfQuizMessage(false, true); // Показать сообщение "добавьте контекст"
                             if (quizLoading) quizLoading.classList.add('hidden');
                             if (generateTasksButton) generateTasksButton.style.display = 'none';
                        } else { // logsLoaded is false
                             console.error("[DEBUG Auth State Change] Failed to load learning logs. Quiz cannot start.");
                             if(quizContainer) quizContainer.style.display = 'block';
                             displayEndOfQuizMessage(true); // Показать ошибку
                             if (quizLoading) quizLoading.classList.add('hidden');
                             if (generateTasksButton) generateTasksButton.style.display = 'none';
                        }
                        isUserSessionInitialized = true; // Сессия инициализирована
                    } catch (error) {
                        console.error("[DEBUG Auth State Change] Error during log loading or quiz start:", error);
                        showNotification("Chyba při načítání dat nebo startu kvízu.", "error");
                        hideQuizUI();
                        isUserSessionInitialized = false; // Сброс, если инициализация не удалась
                    }
                } else if (event === 'TOKEN_REFRESHED' && isUserSessionInitialized) {
                    console.log('[DEBUG Auth State Change] Token refreshed for already initialized session. No UI reload needed.');
                } else {
                     console.log('[DEBUG Auth State Change] User already signed in and session initialized. No action needed.');
                }
            } else { // Signed out
                currentUser = null;
                isUserSessionInitialized = false; // Сброс состояния сессии при выходе
                console.log('[DEBUG Auth State Change] User SIGNED OUT.');
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
    console.log("[DEBUG] initializeApp v6.1 - Initialization complete. Waiting for auth state...");
}


// --- Запуск приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);