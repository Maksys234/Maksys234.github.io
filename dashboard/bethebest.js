// dashboard/bethebest.js
// Версия: Multiple Choice, Endless Feed, Auto-Start, FIX Initialization & Fetching v4 (Debugging Supabase Query)

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
    notificationDiv.textContent = message;
    notificationArea.appendChild(notificationDiv);
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;'; closeButton.className = 'toast-close';
    closeButton.onclick = () => { notificationDiv.style.opacity = '0'; notificationDiv.style.transform = 'translateX(120%)'; setTimeout(() => { if (notificationDiv.parentElement) notificationDiv.remove(); }, 600); };
    notificationDiv.appendChild(closeButton);
    notificationDiv.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
     requestAnimationFrame(() => { notificationDiv.style.opacity = '1'; notificationDiv.style.transform = 'translateX(0)'; });
     if (duration > 0) {
         setTimeout(() => { notificationDiv.style.opacity = '0'; notificationDiv.style.transform = 'translateX(120%)'; notificationDiv.addEventListener('transitionend', () => notificationDiv.remove(), { once: true }); setTimeout(() => { if (notificationDiv.parentElement) notificationDiv.remove(); }, 600); }, duration);
     }
}

window.toggleAuthForms = () => {
    loginFormContainer?.classList.toggle('hidden');
    registerFormContainer?.classList.toggle('hidden');
};

function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }

// --- Autentizace ---
function setupAuthListeners() {
    if (loginForm) { loginForm.addEventListener('submit', async (event) => { /* ... existing code ... */ }); } else { console.warn("Login form not found."); }
    if (registerForm) { registerForm.addEventListener('submit', async (event) => { /* ... existing code ... */ }); } else { console.warn("Register form not found."); }
    if (logoutButton) { logoutButton.addEventListener('click', async () => { /* ... existing code ... */ }); } else { console.warn("Logout button not found."); }
}

// --- Сохранение логов ---
function setupLogFormListener() {
    if (learningLogForm) {
        learningLogForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const logText = learningInput?.value.trim();
            if (!logText) { showNotification('Napiš, co ses naučil/a.', 'warning'); return; }
            if (!currentUser) { showNotification('Pro uložení se přihlas.', 'error'); return; }
            const submitButton = learningLogForm.querySelector('button[type="submit"]');
            if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Ukládám...'; }
            try {
                console.log('[DEBUG] Saving log for user:', currentUser.id);
                const { error } = await supabaseClient.from('learning_logs').insert([{ user_id: currentUser.id, log_text: logText }]);
                if (error) throw error;
                showNotification('Pokrok uložen!', 'success');
                if (learningInput) learningInput.value = '';
                console.log('[DEBUG] Log saved, reloading logs...');
                const logsLoaded = await loadLearningLogs(currentUser.id);
                if (logsLoaded && fullLearningContextForQuiz) {
                    console.log("[DEBUG] Logs reloaded and context exists, fetching new questions for quiz...");
                    await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
                } else if (!logsLoaded) { console.error("[DEBUG] Failed to reload logs after saving new one."); }
                else { console.warn("[DEBUG] Context still empty after log save/reload?"); }
            } catch (err) { console.error('[DEBUG] Log save error:', err); showNotification(`Uložení selhalo: ${err.message}`, 'error'); }
            finally { if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Uložit pokrok'; } }
        });
    } else { console.warn("Learning log form not found."); }
}

// --- Загрузка логов (More Debugging) ---
async function loadLearningLogs(userId) {
    console.log(`[DEBUG] loadLearningLogs v4 called for user: ${userId}`);
    if (!userId) { console.warn("[DEBUG v4] Cannot load logs: userId missing."); return false; }
    if (!logsContainer) { console.warn("[DEBUG v4] Cannot load logs: logsContainer missing."); return false; }

    // Show loader
    const loaderElement = logsContainer.querySelector('.loader') || document.createElement('div');
    loaderElement.className = 'loader visible-loader';
    loaderElement.textContent = 'Načítám záznamy...';
    logsContainer.innerHTML = '';
    logsContainer.appendChild(loaderElement);
    console.log("[DEBUG v4] Loader displayed.");

    try {
        console.log(`[DEBUG v4] Creating query for learning_logs, user_id: ${userId}`);
        const query = supabaseClient
            .from('learning_logs')
            .select('log_text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(30);
        console.log("[DEBUG v4] Query created, executing...");

        // Execute the query
        const { data, error, status, statusText } = await query; // Get more details

        console.log(`[DEBUG v4] Supabase query returned. Status: ${status} ${statusText}, Error:`, error, "Data:", data);

        if (error) {
            console.error('[DEBUG v4] Supabase error fetching logs:', error);
            showNotification(`Chyba načítání záznamů: ${error.message}`, "error", 5000);
            logsContainer.innerHTML = `<p style="color: var(--accent-pink);">Chyba načítání záznamů. Zkontrolujte RLS politiky nebo konzoli pro detaily.</p>`;
            fullLearningContextForQuiz = '';
            if (generateTasksButton) generateTasksButton.style.display = 'none';
            return false; // Indicate failure
        }

        // Process data if successful
        logsContainer.innerHTML = ''; // Clear loader/error
        if (data && data.length > 0) {
            console.log(`[DEBUG v4] Found ${data.length} logs.`);
            const reversedData = [...data].reverse();
            fullLearningContextForQuiz = reversedData.map(log => `Datum: ${new Date(log.created_at).toLocaleDateString('cs-CZ')}\nText: ${log.log_text}`).join("\n\n---\n\n");
            console.log('[DEBUG v4] Learning context generated. Length:', fullLearningContextForQuiz.length);

            data.slice(0, 5).forEach(log => {
                const logElement = document.createElement('div'); logElement.classList.add('log-entry');
                logElement.innerHTML = `<p>${sanitizeHTML(log.log_text.replace(/\n/g, '<br>'))}</p><small>Datum: ${new Date(log.created_at).toLocaleString('cs-CZ')}</small>`;
                logsContainer.appendChild(logElement);
                requestAnimationFrame(() => { logElement.style.opacity = '1'; logElement.style.transform = 'translateY(0)'; });
            });

            if (generateTasksButton) { generateTasksButton.style.display = 'inline-flex'; generateTasksButton.disabled = false; generateTasksButton.textContent = 'Restartovat Kvíz'; }
            return true; // Indicate success
        } else {
            console.log('[DEBUG v4] No logs found for this user.');
            logsContainer.innerHTML = '<p>Zatím žádné záznamy.</p>';
            fullLearningContextForQuiz = '';
            if (generateTasksButton) generateTasksButton.style.display = 'none';
            return true; // Indicate success (no logs is not an error)
        }
    } catch (err) {
        // Catch any other unexpected errors during the process
        console.error('[DEBUG v4] Error in loadLearningLogs catch block:', err);
        logsContainer.innerHTML = `<p style="color: var(--accent-pink);">Neočekávaná chyba načítání záznamů: ${err.message}</p>`;
        fullLearningContextForQuiz = '';
        if (generateTasksButton) generateTasksButton.style.display = 'none';
        return false; // Indicate failure
    }
}


// --- Генерация Multiple Choice ---
async function generateMultipleChoiceQuestions(context) { /* ... existing code v3 ... */
    console.log('[DEBUG] generateMultipleChoiceQuestions called.');
    if (!context) { console.warn('[DEBUG] generateMultipleChoiceQuestions: No context provided.'); return null; }
    const prompt = `
Na základě VŠECH následujících záznamů o učení studenta, vygeneruj 3-5 otázek s výběrem odpovědí (multiple choice), které otestují jeho porozumění RŮZNÝM tématům zmíněným v záznamech. Ke každé otázce vytvoř 5 možností odpovědí (A, B, C, D, E). DŮLEŽITÉ: Otázka MŮŽE MÍT JEDNU NEBO VÍCE SPRÁVNÝCH odpovědí. Uveď VŠECHNA správná písmena odpovědí jako pole stringů a krátké vysvětlení, proč jsou tyto odpovědi správné.

Vrať odpověď POUZE jako JSON pole objektů. Každý objekt musí obsahovat klíče:
- "question" (string): Text otázky.
- "options" (array of 5 strings): Pole s pěti možnostmi odpovědí.
- "answer" (array of strings): Pole SPRÁVNÝCH PÍSMEN odpovědí (např. ["A"], ["B", "D"], ["A", "C", "E"]). Pole musí vždy obsahovat alespoň jedno písmeno.
- "explanation" (string): Vysvětlení SPRÁVNÝCH odpovědí.

JSON formát musí být striktně dodržen. Nepoužívej Markdown mimo JSON. Zajisti, aby otázky pokrývaly RŮZNÁ témata z poskytnutého kontextu.

Kontext učení (všechny záznamy):
---
${context}
---

Příklad formátu JSON pole:
[{"question": "...", "options": ["...", "..."], "answer": ["B", "D"], "explanation": "..."}, ... ]`;

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
            if (Array.isArray(parsed) && parsed.every(q => q.question && Array.isArray(q.options) && q.options.length === 5 && Array.isArray(q.answer) && q.answer.length > 0 && q.explanation && q.answer.every(a => typeof a === 'string' && ["A", "B", "C", "D", "E"].includes(a.toUpperCase())))) {
                console.log('[DEBUG] Successfully parsed valid MC questions:', parsed.length);
                return parsed.map(q => ({ ...q, answer: q.answer.map(a => a.toUpperCase()) })); // Standardize answer letters to uppercase
            } else {
                console.error('[DEBUG] Invalid JSON structure from AI:', parsed);
                throw new Error('Neplatná struktura JSON odpovědi od AI.');
            }
        } catch (e) { console.error('[DEBUG] JSON Parse Error:', e, 'Raw String:', jsonString); throw new Error('Chyba zpracování JSON odpovědi od AI.'); }
    } catch (error) { console.error('[DEBUG] Gemini MC question generation error:', error); throw error; }
}


// --- Логика Квиза ---
function resetQuizState() { console.log('[DEBUG] Resetting quiz state.'); generatedQuestions = []; currentQuestionIndex = -1; isLoadingQuestions = false; }
function hideQuizUI() { if (quizContainer) quizContainer.style.display = 'none'; if (questionDisplay) questionDisplay.innerHTML = ''; if (answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = ''; if (submitAnswerButton) submitAnswerButton.style.display = 'none'; if (feedbackArea) feedbackArea.innerHTML = ''; if (nextQuestionButton) nextQuestionButton.style.display = 'none'; if (quizLoading) quizLoading.classList.add('hidden'); console.log('[DEBUG] Quiz UI hidden.'); }
function setQuizLoadingState(isLoading) { /* ... existing code v3 ... */ if (!quizLoading) { console.warn("Quiz loading element not found."); return; } quizLoading.classList.toggle('visible-loader', isLoading); quizLoading.classList.toggle('hidden', !isLoading); if(generateTasksButton) generateTasksButton.disabled = isLoading; if(submitAnswerButton) submitAnswerButton.disabled = isLoading; if(nextQuestionButton) nextQuestionButton.disabled = isLoading; console.log(`[DEBUG] Quiz loading state set to: ${isLoading}`); }
function hideQuizElements() { /* ... existing code v3 ... */ if(answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = ''; if(submitAnswerButton) submitAnswerButton.style.display = 'none'; if(feedbackArea) feedbackArea.innerHTML = ''; if(nextQuestionButton) nextQuestionButton.style.display = 'none'; }

async function fetchAndDisplayFirstQuestions(context) { /* ... existing code v3 ... */
    console.log('[DEBUG] fetchAndDisplayFirstQuestions called.');
    if (!context) { showNotification('Chybí kontext pro kvíz.', 'warning'); console.warn('[DEBUG] No context provided for quiz.'); return; }
    if (isLoadingQuestions) { console.log("[DEBUG] Fetch already in progress, skipping."); return; }
    if (!quizContainer || !quizLoading) { console.error("[DEBUG] Missing quiz container or loading elements."); return; }
    resetQuizState(); isLoadingQuestions = true;
    setQuizLoadingState(true);
    quizContainer.style.display = 'block';
    if(questionDisplay) questionDisplay.innerHTML = ''; if(feedbackArea) feedbackArea.innerHTML = ''; if(answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = ''; if(submitAnswerButton) submitAnswerButton.style.display = 'none'; if(nextQuestionButton) nextQuestionButton.style.display = 'none';
    try {
        console.log('[DEBUG] Fetching first batch from Gemini...');
        generatedQuestions = await generateMultipleChoiceQuestions(context);
        if (generatedQuestions && generatedQuestions.length > 0) { console.log(`[DEBUG] Fetched ${generatedQuestions.length} initial questions.`); currentQuestionIndex = 0; displayCurrentQuestion(); }
        else { console.warn('[DEBUG] No questions generated by AI.'); throw new Error('AI nevygenerovalo žádné otázky pro tento kontext.'); }
    } catch (error) { console.error('[DEBUG] Failed fetch first questions:', error); showNotification(`Chyba generování kvízu: ${error.message}`, 'error'); displayEndOfQuizMessage(true); }
    finally { isLoadingQuestions = false; setQuizLoadingState(false); }
}

async function fetchMoreQuestions() { /* ... existing code v3 ... */
    console.log('[DEBUG] fetchMoreQuestions called.');
    if (!fullLearningContextForQuiz) { console.warn("[DEBUG] No context to fetch more questions."); return; }
    if (isLoadingQuestions) { console.warn("[DEBUG] Fetch more already in progress."); return; }
    isLoadingQuestions = true;
    if(nextQuestionButton) { nextQuestionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Načítám...'; nextQuestionButton.disabled = true; }
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
        if(nextQuestionButton) { nextQuestionButton.disabled = false; nextQuestionButton.innerHTML = 'Další otázka <i class="fas fa-arrow-right"></i>'; }
        if (success) { if (currentQuestionIndex < generatedQuestions.length) { console.log(`[DEBUG] fetchMoreQuestions succeeded, displaying question at index ${currentQuestionIndex}`); displayCurrentQuestion(); } else { console.error("[DEBUG] Error: fetchMoreQuestions succeeded but index is still out of bounds."); displayEndOfQuizMessage(); } }
        else { if (currentQuestionIndex >= generatedQuestions.length) { console.log("[DEBUG] Fetch more failed/no new questions, displaying end message."); displayEndOfQuizMessage(); } }
    }
}


function displayCurrentQuestion() { /* ... existing code v3 ... */
    console.log(`[DEBUG] displayCurrentQuestion called for index: ${currentQuestionIndex}, Total loaded: ${generatedQuestions.length}`);
    if (currentQuestionIndex < 0 || !generatedQuestions || generatedQuestions.length === 0) { console.warn("[DEBUG] displayCurrentQuestion: Invalid index or no questions array. Hiding UI."); hideQuizElements(); if(questionDisplay) questionDisplay.innerHTML = '<p>Kvíz není připraven nebo došlo k chybě.</p>'; return; }
    if (currentQuestionIndex >= generatedQuestions.length) { console.error(`[DEBUG] displayCurrentQuestion: Index ${currentQuestionIndex} is out of bounds for loaded questions (${generatedQuestions.length}). This should not happen.`); displayEndOfQuizMessage(); return; }
    if (!questionDisplay || !answerCheckboxesContainer || !submitAnswerButton || !feedbackArea || !nextQuestionButton) { console.error('[DEBUG] Missing UI elements for question display.'); return; }
    const question = generatedQuestions[currentQuestionIndex];
    if (!question || !question.question || !Array.isArray(question.options) || question.options.length !== 5) { console.error(`[DEBUG] Error: Invalid question data found at index ${currentQuestionIndex}:`, question); hideQuizElements(); if(questionDisplay) questionDisplay.innerHTML = '<p>Chyba při načítání této otázky. Zkuste další.</p>'; nextQuestionButton.style.display = 'inline-flex'; nextQuestionButton.disabled = false; return; }
    questionDisplay.innerHTML = `<p><strong>Otázka ${currentQuestionIndex + 1}/${generatedQuestions.length}:</strong></p><p>${sanitizeHTML(question.question)}</p>`;
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

function arraysContainSameElements(arr1, arr2) { /* ... existing code v3 ... */ if (!Array.isArray(arr1) || !Array.isArray(arr2) || arr1.length !== arr2.length) { console.log('[DEBUG arraysContainSameElements] Invalid arrays or different lengths.'); return false; } const sortedArr1 = [...arr1].sort(); const sortedArr2 = [...arr2].sort(); const result = sortedArr1.every((val, index) => val === sortedArr2[index]); console.log(`[DEBUG arraysContainSameElements] Comparing ${JSON.stringify(sortedArr1)} vs ${JSON.stringify(sortedArr2)} -> ${result}`); return result; }

function handleAnswerSubmit() { /* ... existing code v3 ... */
    console.log('[DEBUG] handleAnswerSubmit called.');
    if (currentQuestionIndex < 0 || currentQuestionIndex >= generatedQuestions.length) { console.warn("[DEBUG] Submit ignored: Invalid question index:", currentQuestionIndex); return; }
    if (!answerCheckboxesContainer || !feedbackArea || !submitAnswerButton || !nextQuestionButton) { console.error("[DEBUG] Submit ignored: Missing UI elements."); return; }
    const selectedCheckboxes = answerCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
    const selectedChoices = Array.from(selectedCheckboxes).map(cb => cb.value.toUpperCase());
    console.log('[DEBUG] Selected choices:', selectedChoices);
    if (selectedChoices.length === 0) { showNotification('Vyberte alespoň jednu odpověď.', 'warning'); return; }
    const currentQuestion = generatedQuestions[currentQuestionIndex];
    if (!currentQuestion || !Array.isArray(currentQuestion.answer)) { console.error("[DEBUG] Invalid current question data:", currentQuestion); return; }
    const correctAnswers = currentQuestion.answer; const explanation = currentQuestion.explanation;
    console.log('[DEBUG] Correct answers:', correctAnswers);
    const isFullyCorrect = arraysContainSameElements(selectedChoices, correctAnswers);
    const correctSelected = selectedChoices.filter(choice => correctAnswers.includes(choice));
    const incorrectSelected = selectedChoices.filter(choice => !correctAnswers.includes(choice));
    const missedCorrect = correctAnswers.filter(ans => !selectedChoices.includes(ans));
    const isPartiallyCorrect = !isFullyCorrect && correctSelected.length > 0 && incorrectSelected.length === 0 && missedCorrect.length > 0;
    let feedbackHTML = ''; let feedbackClass = '';
    const allLabels = answerCheckboxesContainer.querySelectorAll('.checkbox-label');
    allLabels.forEach(label => { const checkbox = label.querySelector('input[type="checkbox"]'); checkbox.disabled = true; label.classList.add('disabled'); const choice = checkbox.value.toUpperCase(); if (correctAnswers.includes(choice)) { label.classList.add('correct-answer-label'); } if (selectedChoices.includes(choice)) { if (correctAnswers.includes(choice)) { label.classList.add('selected-correct-label'); } else { label.classList.add('selected-incorrect-label'); } } });
    if (isFullyCorrect) { feedbackClass = 'correct'; feedbackHTML = `<div class="feedback ${feedbackClass}"><i class="fas fa-check-circle"></i> <strong>Správně!</strong><p>${sanitizeHTML(explanation)}</p></div>`; showNotification('Výborně!', 'success', 2000); }
    else if (isPartiallyCorrect) { feedbackClass = 'partial'; feedbackHTML = `<div class="feedback ${feedbackClass}"><i class="fas fa-exclamation-triangle"></i> <strong>Částečně správně.</strong><p>Správné odpovědi byly: <strong>${correctAnswers.join(', ')}</strong>. Chyběly: ${missedCorrect.join(', ')}.</p><p>Vysvětlení: ${sanitizeHTML(explanation)}</p></div>`; showNotification('Skoro!', 'info', 2500); }
    else { feedbackClass = 'incorrect'; let mistakeDetail = ''; if(incorrectSelected.length > 0) mistakeDetail += ` Nesprávně zvolené: ${incorrectSelected.join(', ')}.`; if(missedCorrect.length > 0) { if (correctSelected.length === 0) mistakeDetail += ` Správné odpovědi (${correctAnswers.join(', ')}) nebyly zvoleny.`; else mistakeDetail += ` Navíc chyběly správné: ${missedCorrect.join(', ')}.`; } if (!mistakeDetail) mistakeDetail = " Vaše odpověď nebyla zcela správná."; feedbackHTML = `<div class="feedback ${feedbackClass}"><i class="fas fa-times-circle"></i> <strong>Špatně.</strong><p>Správné odpovědi: <strong>${correctAnswers.join(', ')}</strong>.${mistakeDetail}</p><p>Vysvětlení: ${sanitizeHTML(explanation)}</p></div>`; showNotification('Nevadí.', 'info', 2500); }
    feedbackArea.innerHTML = feedbackHTML; submitAnswerButton.disabled = true; submitAnswerButton.style.display = 'none'; nextQuestionButton.style.display = 'inline-flex'; nextQuestionButton.disabled = false; nextQuestionButton.focus(); console.log(`[DEBUG] Answer submitted for Q${currentQuestionIndex + 1}. Fully Correct: ${isFullyCorrect}, Partially Correct: ${isPartiallyCorrect}`);
}

function handleNextQuestion() { /* ... existing code v3 ... */
    console.log('[DEBUG] handleNextQuestion called.');
    if (!nextQuestionButton || isLoadingQuestions) { console.warn("[DEBUG] Next button disabled or loading."); return; }
    nextQuestionButton.disabled = true;
    currentQuestionIndex++;
    console.log(`[DEBUG] Incremented index to: ${currentQuestionIndex}`);
    if (currentQuestionIndex < generatedQuestions.length) { console.log(`[DEBUG] Next question (${currentQuestionIndex + 1}) exists in cache. Displaying.`); displayCurrentQuestion(); }
    else { console.log("[DEBUG] Reached end of current batch, attempting to fetch more..."); fetchMoreQuestions(); }
}

function displayEndOfQuizMessage(isError = false) { /* ... existing code v3 ... */
     console.log(`[DEBUG] displayEndOfQuizMessage called. Is error: ${isError}`);
     if (!questionDisplay) return;
     hideQuizElements();
     let messageHTML;
     if (isError) { messageHTML = `<h2><i class="fas fa-exclamation-triangle"></i> Chyba Kvízu</h2><p>Nepodařilo se načíst otázky. Zkuste to prosím znovu nebo přidejte více záznamů o učení.</p>`; }
     else { messageHTML = `<h2><i class="fas fa-flag-checkered"></i> Konec otázek</h2><p>Pro tento kontext již nejsou k dispozici další otázky. Přidejte nové záznamy o učení nebo zkuste restartovat kvíz pro novou sadu otázek.</p>`; }
     questionDisplay.innerHTML = messageHTML;
     if (generateTasksButton) { if (fullLearningContextForQuiz) { generateTasksButton.disabled = false; generateTasksButton.textContent = 'Restartovat Kvíz'; generateTasksButton.style.display = 'inline-flex'; } else { generateTasksButton.style.display = 'none'; } }
     console.log("[DEBUG] End of quiz message displayed.");
}


// --- Инициализация приложения ---
function initializeSupabase() { /* ... existing code v3 ... */
    console.log("[DEBUG] Initializing Supabase...");
    try { if (!window.supabase?.createClient) throw new Error("Supabase lib not loaded."); supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); console.log("[DEBUG] Supabase client initialized."); return true; }
    catch (e) { console.error("[DEBUG] Supabase init failed:", e); return false; }
}

async function initializeApp() {
    console.log("[DEBUG] initializeApp v4 - Start");
    cacheDOMElements();
    setupAuthListeners();
    setupLogFormListener();

    // Quiz button listeners
    if (submitAnswerButton) { submitAnswerButton.addEventListener('click', handleAnswerSubmit); } else { console.warn('Submit answer button not found.'); }
    if (nextQuestionButton) { nextQuestionButton.addEventListener('click', handleNextQuestion); } else { console.warn('Next question button not found.'); }
    if (generateTasksButton) {
         generateTasksButton.textContent = 'Restartovat Kvíz';
         generateTasksButton.addEventListener('click', async () => {
             if (!fullLearningContextForQuiz) { showNotification("Nejprve přidejte záznam o učení.", "warning"); return;}
             if (isLoadingQuestions) return;
             showNotification('Generuji novou sadu otázek...', 'info');
             await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz); // Always fetch new set
         });
         generateTasksButton.style.display = 'none';
    } else { console.warn('Generate/Restart button not found.'); }

    if (!initializeSupabase()) { showNotification("Chyba připojení k databázi.", "error", 0); return; }

    // Auth State Listener
    if (supabaseClient && supabaseClient.auth) {
        console.log("[DEBUG] Setting up onAuthStateChange listener...");
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('[DEBUG Auth State Change] Event:', event, 'Session:', !!session);
            if (session?.user) {
                currentUser = session.user;
                console.log('[DEBUG Auth State Change] User SIGNED IN:', currentUser.id);
                authSection?.classList.add('hidden');
                appSection?.classList.remove('hidden');
                if (userEmailDisplay) userEmailDisplay.textContent = session.user.email;
                if (logoutButton) logoutButton.disabled = false;
                hideQuizUI(); resetQuizState();

                try {
                    console.log('[DEBUG Auth State Change] Awaiting loadLearningLogs...');
                    const logsLoaded = await loadLearningLogs(session.user.id);
                    console.log('[DEBUG Auth State Change] loadLearningLogs finished. Context length:', fullLearningContextForQuiz?.length || 0, 'Logs Loaded:', logsLoaded);

                    if (logsLoaded && fullLearningContextForQuiz) {
                        console.log('[DEBUG Auth State Change] Context found, awaiting fetchAndDisplayFirstQuestions...');
                        await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
                        console.log('[DEBUG Auth State Change] fetchAndDisplayFirstQuestions finished.');
                    } else if (logsLoaded && !fullLearningContextForQuiz) {
                         console.log('[DEBUG Auth State Change] Logs loaded but no learning context. Displaying prompt.');
                         if(quizContainer) quizContainer.style.display = 'block';
                         if(questionDisplay) questionDisplay.innerHTML = '<p>Vítejte! Přidejte záznam o učení, aby se zde objevily otázky k procvičení.</p>';
                         if (quizLoading) quizLoading.classList.add('hidden');
                         if (generateTasksButton) generateTasksButton.style.display = 'none';
                    } else { // logsLoaded is false
                         console.error("[DEBUG Auth State Change] Failed to load learning logs. Quiz cannot start.");
                         if(quizContainer) quizContainer.style.display = 'block';
                         if(questionDisplay) questionDisplay.innerHTML = '<p style="color: var(--accent-pink);">Chyba načítání záznamů o učení. Kvíz nelze spustit.</p>';
                         if (quizLoading) quizLoading.classList.add('hidden');
                         if (generateTasksButton) generateTasksButton.style.display = 'none';
                    }
                } catch (error) {
                    console.error("[DEBUG Auth State Change] Error during log loading or quiz start:", error);
                    showNotification("Chyba při načítání dat nebo startu kvízu.", "error");
                    hideQuizUI();
                }

            } else {
                currentUser = null;
                console.log('[DEBUG Auth State Change] User SIGNED OUT.');
                authSection?.classList.remove('hidden');
                appSection?.classList.add('hidden');
                if (userEmailDisplay) userEmailDisplay.textContent = '';
                if (logsContainer) logsContainer.innerHTML = '<p>Přihlaste se.</p>';
                if (generateTasksButton) generateTasksButton.style.display = 'none';
                hideQuizUI(); resetQuizState(); fullLearningContextForQuiz = '';
            }
        });
    } else {
         console.error("[DEBUG] Supabase client or auth object not available to attach listener.");
         showNotification("Kritická chyba inicializace autentizace.", "error", 0);
    }

    console.log("[DEBUG] initializeApp v4 - Initialization complete. Waiting for auth state...");
}


// --- Запуск приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);

// --- КОНЕЦ ОБНОВЛЕННОГО КОДА JS ---