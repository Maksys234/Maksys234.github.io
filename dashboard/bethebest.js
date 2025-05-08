// dashboard/bethebest.js
// Версия: Multiple Choice, Endless Feed, Auto-Start, FIX Initialization & Fetching

// --- Константы и Supabase клиент ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
let supabaseClient = null; // ИЗМЕНЕНО: Используем let вместо const

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
    // Кэшируем элементы, чтобы не искать их каждый раз
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
    console.log("DOM elements cached.");
}

function showNotification(message, type = 'info', duration = 3000) {
    if (!notificationArea) { console.warn("Notification area not found"); return; }
    const notificationDiv = document.createElement('div');
    notificationDiv.className = `notification ${type}`;
    notificationDiv.textContent = message;
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
             notificationDiv.addEventListener('transitionend', () => notificationDiv.remove());
             setTimeout(() => { if (notificationDiv.parentElement) notificationDiv.remove(); }, 600);
         }, duration);
     }
}

window.toggleAuthForms = () => {
    loginFormContainer?.classList.toggle('hidden');
    registerFormContainer?.classList.toggle('hidden');
};

function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }

// --- Autentizace ---
loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginButton = loginForm.querySelector('button[type="submit"]');
    loginButton.disabled = true; loginButton.textContent = 'Přihlašuji...';
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { showNotification(`Chyba přihlášení: ${error.message}`, 'error'); }
    else { showNotification('Přihlášení úspěšné!', 'success'); loginForm.reset(); }
    loginButton.disabled = false; loginButton.textContent = 'Přihlásit se';
});

registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const registerButton = registerForm.querySelector('button[type="submit"]');
    registerButton.disabled = true; registerButton.textContent = 'Registruji...';
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) { showNotification(`Chyba registrace: ${error.message}`, 'error'); }
    else { showNotification('Registrace úspěšná! Zkontrolujte e-mail.', 'success'); registerForm.reset(); toggleAuthForms(); }
    registerButton.disabled = false; registerButton.textContent = 'Zaregistrovat se';
});

logoutButton?.addEventListener('click', async () => {
    if(logoutButton) logoutButton.disabled = true;
    const { error } = await supabaseClient.auth.signOut();
    if (error) { showNotification(`Chyba odhlášení: ${error.message}`, 'error'); if(logoutButton) logoutButton.disabled = false; }
    else { showNotification('Odhlášení úspěšné.', 'info'); resetQuizState(); hideQuizUI(); }
});

// --- ИСПРАВЛЕНО: Auth State Change ---
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('[Auth State Change] Event:', event, 'Session:', !!session);
    if (session?.user) {
        currentUser = session.user;
        console.log('[Auth State Change] User SIGNED IN:', currentUser.id);
        authSection?.classList.add('hidden');
        appSection?.classList.remove('hidden');
        if (userEmailDisplay) userEmailDisplay.textContent = session.user.email;
        if (logoutButton) logoutButton.disabled = false;
        hideQuizUI();
        resetQuizState();

        try {
            console.log('[Auth State Change] Awaiting loadLearningLogs...');
            await loadLearningLogs(session.user.id);
            console.log('[Auth State Change] loadLearningLogs finished. Context length:', fullLearningContextForQuiz?.length || 0);

            if (fullLearningContextForQuiz) {
                console.log('[Auth State Change] Context found, awaiting fetchAndDisplayFirstQuestions...');
                await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
                console.log('[Auth State Change] fetchAndDisplayFirstQuestions finished.');
            } else {
                console.log('[Auth State Change] No learning context found. Displaying prompt message.');
                if(quizContainer) quizContainer.style.display = 'block';
                if(questionDisplay) questionDisplay.innerHTML = '<p>Vítejte! Přidejte záznam o učení, aby se zde objevily otázky k procvičení.</p>';
                if (quizLoading) quizLoading.classList.add('hidden');
                if (generateTasksButton) generateTasksButton.style.display = 'none'; // Прячем кнопку перезапуска, если нет логов
            }
        } catch (error) {
            console.error("[Auth State Change] Error during log loading or quiz start:", error);
            showNotification("Chyba při načítání dat nebo startu kvízu.", "error");
            hideQuizUI();
        }

    } else {
        currentUser = null;
        console.log('[Auth State Change] User SIGNED OUT.');
        authSection?.classList.remove('hidden');
        appSection?.classList.add('hidden');
        if (userEmailDisplay) userEmailDisplay.textContent = '';
        if (logsContainer) logsContainer.innerHTML = '<p>Přihlaste se.</p>';
        if (generateTasksButton) generateTasksButton.style.display = 'none';
        hideQuizUI();
        resetQuizState();
        fullLearningContextForQuiz = '';
    }
});

// --- Сохранение логов ---
learningLogForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const logText = learningInput?.value.trim();
    if (!logText) { showNotification('Napiš, co ses naučil/a.', 'error'); return; }
    if (!currentUser) { showNotification('Pro uložení se přihlas.', 'error'); return; }
    const submitButton = learningLogForm.querySelector('button[type="submit"]');
    submitButton.disabled = true; submitButton.textContent = 'Ukládám...';
    try {
        const { error } = await supabaseClient.from('learning_logs').insert([{ user_id: currentUser.id, log_text: logText }]);
        if (error) throw error;
        showNotification('Pokrok uložen!', 'success');
        if(learningInput) learningInput.value = '';
        await loadLearningLogs(currentUser.id); // Обновляем контекст
        // Если квиз не был запущен, запускаем
        if (currentQuestionIndex === -1 && fullLearningContextForQuiz) {
             console.log("Log saved, starting quiz...");
             await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
        }
    } catch (err) { showNotification(`Uložení selhalo: ${err.message}`, 'error'); }
    finally { submitButton.disabled = false; submitButton.textContent = 'Uložit pokrok'; }
});

// --- Загрузка логов ---
async function loadLearningLogs(userId) {
    if (!userId || !logsContainer) { fullLearningContextForQuiz = ''; return; }
    logsContainer.innerHTML = '<div class="loader visible-loader">Načítám záznamy...</div>'; // Показываем лоадер
    try {
        const { data, error } = await supabaseClient.from('learning_logs').select('log_text, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
        if (error) throw error;
        if (data?.length > 0) {
            logsContainer.innerHTML = '';
            fullLearningContextForQuiz = data.reverse().map(log => `Datum: ${new Date(log.created_at).toLocaleDateString('cs-CZ')}\nText: ${log.log_text}`).join("\n\n---\n\n");
            console.log('Learning context loaded (entries):', data.length);
            // Показываем последние 5 логов
            data.reverse().slice(0, 5).forEach(log => {
                const logElement = document.createElement('div'); logElement.classList.add('log-entry');
                logElement.innerHTML = `<p>${sanitizeHTML(log.log_text.replace(/\n/g, '<br>'))}</p><small>Datum: ${new Date(log.created_at).toLocaleString('cs-CZ')}</small>`;
                logsContainer.appendChild(logElement);
                requestAnimationFrame(() => { logElement.style.opacity = '1'; logElement.style.transform = 'translateY(0)'; });
            });
            // Показываем кнопку перезапуска квиза, так как есть логи
            if (generateTasksButton) {
                generateTasksButton.style.display = 'inline-flex';
                generateTasksButton.disabled = false;
                generateTasksButton.textContent = 'Restartovat Kvíz';
            }
        } else {
            logsContainer.innerHTML = '<p>Zatím žádné záznamy.</p>';
            fullLearningContextForQuiz = '';
            if (generateTasksButton) generateTasksButton.style.display = 'none';
        }
    } catch (err) {
        console.error('Chyba načítání záznamů:', err);
        logsContainer.innerHTML = `<p style="color: var(--error-color);">Chyba načítání záznamů.</p>`;
        fullLearningContextForQuiz = '';
        if (generateTasksButton) generateTasksButton.style.display = 'none';
    }
}

// --- Генерация Multiple Choice ---
async function generateMultipleChoiceQuestions(context) {
    if (!context) return null;
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
        console.log('Requesting MC questions from Gemini...');
        const response = await fetch(GEMINI_API_URL_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(`API Error ${response.status}: ${errorData?.error?.message || response.statusText}`); }
        const data = await response.json();
        console.log('Raw Gemini MC Response:', JSON.stringify(data).substring(0, 300) + '...');
        if (data.candidates?.[0]?.finishReason === "SAFETY") { throw new Error("Odpověď AI byla zablokována."); }
        if (data.promptFeedback?.blockReason) { throw new Error(`Dotaz blokován AI (${data.promptFeedback.blockReason}).`); }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) { throw new Error('AI nevrátilo žádný text.'); }
        let jsonString = text; const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/); if (jsonMatch?.[1]) jsonString = jsonMatch[1];
        try {
            const parsed = JSON.parse(jsonString);
            if (Array.isArray(parsed) && parsed.every(q => q.question && Array.isArray(q.options) && q.options.length === 5 && Array.isArray(q.answer) && q.answer.length > 0 && q.explanation && q.answer.every(a => typeof a === 'string' && ["A", "B", "C", "D", "E"].includes(a.toUpperCase())))) {
                console.log('Successfully parsed valid MC questions:', parsed);
                return parsed.map(q => ({ ...q, answer: q.answer.map(a => a.toUpperCase()) }));
            } else { throw new Error('Neplatná struktura JSON od AI.'); }
        } catch (e) { console.error('JSON Parse Error:', e, 'Raw String:', jsonString); throw new Error('Chyba zpracování odpovědi AI.'); }
    } catch (error) { console.error('Gemini MC question generation error:', error); throw error; }
}

// --- Логика Квиза (Обновлена) ---

function resetQuizState() { generatedQuestions = []; currentQuestionIndex = -1; isLoadingQuestions = false; }
function hideQuizUI() { if (quizContainer) quizContainer.style.display = 'none'; if (questionDisplay) questionDisplay.innerHTML = ''; if (answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = ''; if (submitAnswerButton) submitAnswerButton.style.display = 'none'; if (feedbackArea) feedbackArea.innerHTML = ''; if (nextQuestionButton) nextQuestionButton.style.display = 'none'; if (quizLoading) quizLoading.classList.add('hidden'); console.log('Quiz UI hidden.'); }

// ИСПРАВЛЕНО: Убран двойной вызов setLoadingState
async function fetchAndDisplayFirstQuestions(context) {
    if (!context) { showNotification('Chybí kontext pro kvíz.', 'warning'); return; }
    if (isLoadingQuestions) { return; }
    if (!quizContainer || !quizLoading) { return; }
    console.log('Fetching first batch of questions...');
    resetQuizState(); isLoadingQuestions = true;
    quizContainer.style.display = 'block'; quizLoading.classList.remove('hidden');
    if(questionDisplay) questionDisplay.innerHTML = ''; if(feedbackArea) feedbackArea.innerHTML = ''; if(answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = ''; if(submitAnswerButton) submitAnswerButton.style.display = 'none'; if(nextQuestionButton) nextQuestionButton.style.display = 'none';
    try {
        generatedQuestions = await generateMultipleChoiceQuestions(context);
        if (generatedQuestions?.length > 0) { currentQuestionIndex = 0; displayCurrentQuestion(); }
        else { throw new Error('Nebyly vygenerovány žádné otázky.'); }
    } catch (error) { console.error('Failed fetch first questions:', error); showNotification(`Chyba generování kvízu: ${error.message}`, 'error'); hideQuizUI(); }
    finally { isLoadingQuestions = false; if (quizLoading) quizLoading.classList.add('hidden'); }
}

// ИСПРАВЛЕНО: Логика fetchMoreQuestions и вызова displayCurrentQuestion
async function fetchMoreQuestions() {
    if (!fullLearningContextForQuiz || isLoadingQuestions) return;
    console.log("Fetching more questions...");
    isLoadingQuestions = true;
    if(nextQuestionButton) { nextQuestionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Načítám...'; nextQuestionButton.disabled = true; }
    let success = false;
    try {
        const newQuestions = await generateMultipleChoiceQuestions(fullLearningContextForQuiz);
        if (newQuestions?.length > 0) {
            generatedQuestions.push(...newQuestions);
            console.log(`Added ${newQuestions.length}. Total: ${generatedQuestions.length}`);
            success = true; // Успешно загрузили новые вопросы
        } else {
             showNotification("Nebyly nalezeny další otázky pro tento kontext.", "info");
             // Не уменьшаем индекс, пользователь останется на последнем вопросе
        }
    } catch (error) {
        console.error("Failed fetch more questions:", error);
        showNotification(`Chyba načítání dalších otázek: ${error.message}`, 'error');
        // Не уменьшаем индекс, чтобы не зациклиться
    } finally {
        isLoadingQuestions = false;
        if(nextQuestionButton) { // Восстанавливаем кнопку в любом случае
            nextQuestionButton.disabled = false;
            nextQuestionButton.innerHTML = 'Další otázka <i class="fas fa-arrow-right"></i>';
        }
        if (success) {
            // Убедимся, что индекс указывает на новый вопрос (если мы были в конце)
            // currentQuestionIndex уже увеличен в handleNextQuestion
             if (currentQuestionIndex < generatedQuestions.length) {
                displayCurrentQuestion(); // Показываем новый вопрос
             } else {
                 // Это не должно произойти, если добавление прошло успешно, но на всякий случай
                 console.error("Error: fetchMoreQuestions succeeded but index is still out of bounds.");
                 displayEndOfQuizMessage(); // Показываем сообщение о конце
             }
        } else {
            // Если новые вопросы не загрузились, а мы были в конце
            if (currentQuestionIndex >= generatedQuestions.length) {
                displayEndOfQuizMessage(); // Показываем сообщение о конце
            }
        }
    }
}

// ИСПРАВЛЕНО: displayCurrentQuestion - проверка индекса и вызов fetchMore
function displayCurrentQuestion() {
    console.log(`Trying to display question at index: ${currentQuestionIndex}, Total questions: ${generatedQuestions.length}`);
    if (currentQuestionIndex < 0) { // Если индекс некорректен (например, после reset)
        console.log("DisplayCurrentQuestion: Invalid index, likely reset state.");
         hideQuizUIElements();
         if(questionDisplay) questionDisplay.innerHTML = '<p>Připraveno pro kvíz.</p>'; // Или другое сообщение
        return;
    }
    // Если индекс вышел за пределы *существующих* вопросов, надо грузить новые
    if (currentQuestionIndex >= generatedQuestions.length) {
        console.warn('Index out of bounds in displayCurrentQuestion, attempting to fetch more...');
         fetchMoreQuestions(); // Запускаем загрузку
        return; // Выходим, fetchMoreQuestions покажет вопрос после загрузки
    }
    if (!questionDisplay || !answerCheckboxesContainer || !submitAnswerButton || !feedbackArea || !nextQuestionButton) { console.error('Missing UI elements for question display.'); return; }

    const question = generatedQuestions[currentQuestionIndex];
    // Доп. проверка на наличие вопроса
    if (!question) {
         console.error(`Error: No question data found at index ${currentQuestionIndex}`);
         hideQuizUIElements();
         if(questionDisplay) questionDisplay.innerHTML = '<p>Chyba při načítání otázky. Zkuste obnovit.</p>';
         return;
     }

    questionDisplay.innerHTML = `<p><strong>Otázka ${currentQuestionIndex + 1}:</strong></p><p>${sanitizeHTML(question.question)}</p>`;
    feedbackArea.innerHTML = '';
    answerCheckboxesContainer.innerHTML = '';
    nextQuestionButton.style.display = 'none';

    const choices = ["A", "B", "C", "D", "E"];
    question.options.forEach((optionText, index) => {
        const choiceLetter = choices[index];
        const checkboxId = `q${currentQuestionIndex}_choice${choiceLetter}`;
        const label = document.createElement('label'); label.classList.add('checkbox-label'); label.htmlFor = checkboxId;
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = checkboxId; checkbox.name = `question_${currentQuestionIndex}`; checkbox.value = choiceLetter; checkbox.dataset.choice = choiceLetter;
        const span = document.createElement('span'); span.textContent = ` ${choiceLetter}) ${optionText}`;
        label.appendChild(checkbox); label.appendChild(span);
        answerCheckboxesContainer.appendChild(label);
    });

    answerCheckboxesContainer.style.display = 'flex';
    submitAnswerButton.style.display = 'inline-flex';
    submitAnswerButton.disabled = false;
    console.log(`Displayed MC question ${currentQuestionIndex + 1}`);
}

// Сравнение массивов (без изменений)
function arraysContainSameElements(arr1, arr2) { /* ... без изменений ... */ }

// Обработка ответа (без изменений в логике сравнения)
function handleAnswerSubmit() {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= generatedQuestions.length) return;
    if (!answerCheckboxesContainer || !feedbackArea || !submitAnswerButton || !nextQuestionButton) return;
    const selectedCheckboxes = answerCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
    const selectedChoices = Array.from(selectedCheckboxes).map(cb => cb.value.toUpperCase());
    if (selectedChoices.length === 0) { showNotification('Vyberte alespoň jednu odpověď.', 'warning'); return; }
    const currentQuestion = generatedQuestions[currentQuestionIndex];
    const correctAnswers = currentQuestion.answer; const explanation = currentQuestion.explanation;
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
    else { feedbackClass = 'incorrect'; let mistakeDetail = ''; if(incorrectSelected.length > 0) mistakeDetail += ` Nesprávně zvolené: ${incorrectSelected.join(', ')}.`; if(missedCorrect.length > 0 && correctSelected.length > 0) mistakeDetail += ` Navíc chyběly správné: ${missedCorrect.join(', ')}.`; else if(missedCorrect.length > 0 && correctSelected.length === 0) mistakeDetail += ` Správné odpovědi nebyly zvoleny.`; feedbackHTML = `<div class="feedback ${feedbackClass}"><i class="fas fa-times-circle"></i> <strong>Špatně.</strong><p>Správné odpovědi: <strong>${correctAnswers.join(', ')}</strong>.${mistakeDetail}</p><p>Vysvětlení: ${sanitizeHTML(explanation)}</p></div>`; showNotification('Nevadí.', 'info', 2500); }
    feedbackArea.innerHTML = feedbackHTML; submitAnswerButton.disabled = true; submitAnswerButton.style.display = 'none'; nextQuestionButton.style.display = 'inline-flex'; nextQuestionButton.disabled = false; nextQuestionButton.focus(); console.log(`Answer Q${currentQuestionIndex + 1}. Selected: ${selectedChoices.join(',')}. Correct: ${correctAnswers.join(',')}. Fully: ${isFullyCorrect}. Partial: ${isPartiallyCorrect}`);
}

// ИСПРАВЛЕНО: handleNextQuestion вызывает fetchMoreQuestions, если нужно
function handleNextQuestion() {
    if (!nextQuestionButton || isLoadingQuestions) return;
    nextQuestionButton.disabled = true;
    currentQuestionIndex++;
    console.log(`Next button clicked. New index target: ${currentQuestionIndex}`);

    // Проверяем, есть ли СЛЕДУЮЩИЙ вопрос в УЖЕ загруженных
    if (currentQuestionIndex < generatedQuestions.length) {
        displayCurrentQuestion(); // Показываем следующий из текущего набора
    } else {
        console.log("Reached end of current batch, attempting to fetch more...");
        fetchMoreQuestions(); // Загружаем новые. fetchMoreQuestions сам вызовет displayCurrentQuestion
    }
}

// НОВАЯ ФУНКЦИЯ: Скрыть элементы управления квизом
function hideQuizElements() {
    if(answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = '';
    if(submitAnswerButton) submitAnswerButton.style.display = 'none';
    if(feedbackArea) feedbackArea.innerHTML = '';
    if(nextQuestionButton) nextQuestionButton.style.display = 'none';
}

// НОВАЯ ФУНКЦИЯ: Показать сообщение о конце (если Gemini не вернет больше вопросов)
function displayEndOfQuizMessage() {
     if (!questionDisplay) return;
     hideQuizElements();
     questionDisplay.innerHTML = `<h2><i class="fas fa-flag-checkered"></i> Konec otázek</h2><p>Pro tento kontext již nejsou k dispozici další otázky. Přidejte nové záznamy o učení nebo zkuste restartovat kvíz.</p>`;
     // Показываем кнопку рестарта, если она есть
     if (generateTasksButton && fullLearningContextForQuiz) {
         generateTasksButton.disabled = false;
         generateTasksButton.textContent = 'Restartovat Kvíz';
         generateTasksButton.style.display = 'inline-flex';
     }
     console.log("Quiz truly finished or failed to fetch more.");
}

// --- Прикрепление обработчиков ---
document.addEventListener('DOMContentLoaded', () => {
    cacheDOMElements(); // Кэшируем элементы
    // Прикрепляем обработчики к кнопкам квиза
    if (submitAnswerButton) { submitAnswerButton.addEventListener('click', handleAnswerSubmit); }
    else { console.warn('Submit answer button not found.'); }
    if (nextQuestionButton) { nextQuestionButton.addEventListener('click', handleNextQuestion); }
    else { console.warn('Next question button not found.'); }
    // Кнопка "перезапуска" квиза (бывшая generateTasksButton)
    if (generateTasksButton) {
         generateTasksButton.textContent = 'Restartovat Kvíz'; // Обновляем текст сразу
         generateTasksButton.addEventListener('click', async () => {
             if (!fullLearningContextForQuiz || isLoadingQuestions) return;
             showNotification('Generuji novou sadu otázek...', 'info');
             await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz); // Всегда начинаем с новыми
         });
         // JS в onAuthStateChange решит, показывать ли ее
         generateTasksButton.style.display = 'none';
    }
    // --- Инициализация ---
    initializeApp();
});

// --- Инициализация приложения ---
async function initializeApp() {
    console.log("[Init Bethebest MC Endless v2] Starting initialization...");
    if (!initializeSupabase()) { showNotification("Chyba připojení k databázi.", "error", 0); return; }
    // Состояние пользователя и запуск квиза обрабатывается в onAuthStateChange
    console.log("[Init Bethebest MC Endless v2] Initialization complete. Waiting for auth state...");
}

function initializeSupabase() {
    try { if (!window.supabase?.createClient) throw new Error("Supabase lib not loaded."); supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); return true; }
    catch (e) { console.error("Supabase init failed:", e); return false; }
}

// --- КОНЕЦ ОБНОВЛЕННОГО КОДА JS ---