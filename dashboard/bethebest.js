// dashboard/bethebest.js
// Версия: Multiple Choice, Endless Feed, Auto-Start, FIX Initialization & Fetching v2 (Fix auth listener)

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
    notificationDiv.textContent = message; // Use textContent for security
    notificationArea.appendChild(notificationDiv);

    // Add close button manually if needed or use a library
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.className = 'toast-close'; // Make sure you have CSS for this
    closeButton.onclick = () => {
        notificationDiv.style.opacity = '0';
        notificationDiv.style.transform = 'translateX(120%)';
        setTimeout(() => { if (notificationDiv.parentElement) notificationDiv.remove(); }, 600);
    };
    notificationDiv.appendChild(closeButton); // Append close button

    notificationDiv.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
     requestAnimationFrame(() => {
         notificationDiv.style.opacity = '1';
         notificationDiv.style.transform = 'translateX(0)';
     });
     if (duration > 0) {
         setTimeout(() => {
             notificationDiv.style.opacity = '0';
             notificationDiv.style.transform = 'translateX(120%)';
             notificationDiv.addEventListener('transitionend', () => notificationDiv.remove(), { once: true }); // Use once option
             setTimeout(() => { if (notificationDiv.parentElement) notificationDiv.remove(); }, 600); // Fallback removal
         }, duration);
     }
}


window.toggleAuthForms = () => {
    loginFormContainer?.classList.toggle('hidden');
    registerFormContainer?.classList.toggle('hidden');
};

function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }

// --- Autentizace ---
function setupAuthListeners() {
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const emailInput = document.getElementById('loginEmail');
            const passwordInput = document.getElementById('loginPassword');
            const email = emailInput?.value;
            const password = passwordInput?.value;
            if (!email || !password) { showNotification('Prosím zadejte e-mail i heslo.', 'warning'); return; }

            const loginButton = loginForm.querySelector('button[type="submit"]');
            if (loginButton) { loginButton.disabled = true; loginButton.textContent = 'Přihlašuji...'; }

            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) { showNotification(`Chyba přihlášení: ${error.message}`, 'error'); }
            else { showNotification('Přihlášení úspěšné!', 'success'); loginForm.reset(); }

            if (loginButton) { loginButton.disabled = false; loginButton.textContent = 'Přihlásit se'; }
        });
    } else { console.warn("Login form not found."); }

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const emailInput = document.getElementById('registerEmail');
            const passwordInput = document.getElementById('registerPassword');
            const email = emailInput?.value;
            const password = passwordInput?.value;
            if (!email || !password) { showNotification('Prosím zadejte e-mail i heslo.', 'warning'); return; }

            const registerButton = registerForm.querySelector('button[type="submit"]');
            if (registerButton) { registerButton.disabled = true; registerButton.textContent = 'Registruji...'; }

            const { error } = await supabaseClient.auth.signUp({ email, password });

            if (error) { showNotification(`Chyba registrace: ${error.message}`, 'error'); }
            else { showNotification('Registrace úspěšná! Zkontrolujte e-mail pro potvrzení.', 'success'); registerForm.reset(); toggleAuthForms(); }

            if (registerButton) { registerButton.disabled = false; registerButton.textContent = 'Zaregistrovat se'; }
        });
    } else { console.warn("Register form not found."); }

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            logoutButton.disabled = true;
            const { error } = await supabaseClient.auth.signOut();
            if (error) { showNotification(`Chyba odhlášení: ${error.message}`, 'error'); logoutButton.disabled = false; }
            else { showNotification('Odhlášení úspěšné.', 'info'); resetQuizState(); hideQuizUI(); }
            // State change will handle UI updates
        });
    } else { console.warn("Logout button not found."); }
}


// --- ИСПРАВЛЕНО: Auth State Change Listener moved inside initializeApp ---
/*
// THIS BLOCK IS MOVED INSIDE initializeApp

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
*/

// --- Сохранение логов ---
function setupLogFormListener() {
    if (learningLogForm) {
        learningLogForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const logText = learningInput?.value.trim();
            if (!logText) { showNotification('Napiš, co ses naučil/a.', 'error'); return; }
            if (!currentUser) { showNotification('Pro uložení se přihlas.', 'error'); return; }
            const submitButton = learningLogForm.querySelector('button[type="submit"]');
            if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Ukládám...'; }
            try {
                const { error } = await supabaseClient.from('learning_logs').insert([{ user_id: currentUser.id, log_text: logText }]);
                if (error) throw error;
                showNotification('Pokrok uložen!', 'success');
                if (learningInput) learningInput.value = '';
                await loadLearningLogs(currentUser.id); // Reload logs & update context
                // If quiz wasn't started and context now exists, start it
                if (currentQuestionIndex === -1 && fullLearningContextForQuiz) {
                    console.log("Log saved, context found, starting quiz...");
                    await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
                } else if (fullLearningContextForQuiz) {
                    console.log("Log saved, context found, but quiz already started or fetched.");
                     // Optionally, you could regenerate questions based on new log here
                     // await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
                }
            } catch (err) { showNotification(`Uložení selhalo: ${err.message}`, 'error'); }
            finally { if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Uložit pokrok'; } }
        });
    } else { console.warn("Learning log form not found."); }
}


// --- Загрузка логов ---
async function loadLearningLogs(userId) {
    if (!userId || !logsContainer) {
        fullLearningContextForQuiz = '';
        console.warn("Cannot load logs: userId or logsContainer missing.");
        return;
    }
    const loaderElement = logsContainer.querySelector('.loader') || document.createElement('div');
    loaderElement.className = 'loader visible-loader';
    loaderElement.textContent = 'Načítám záznamy...';
    logsContainer.innerHTML = ''; // Clear first
    logsContainer.appendChild(loaderElement);

    try {
        const { data, error } = await supabaseClient.from('learning_logs').select('log_text, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
        if (error) throw error;

        logsContainer.innerHTML = ''; // Clear loader

        if (data?.length > 0) {
            // Reverse the data so the oldest log comes first for the context
            const reversedData = [...data].reverse();
            fullLearningContextForQuiz = reversedData.map(log => `Datum: ${new Date(log.created_at).toLocaleDateString('cs-CZ')}\nText: ${log.log_text}`).join("\n\n---\n\n");
            console.log('Learning context loaded (entries):', data.length);

            // Show latest 5 logs in the UI (original order: newest first)
            data.slice(0, 5).forEach(log => {
                const logElement = document.createElement('div'); logElement.classList.add('log-entry');
                logElement.innerHTML = `<p>${sanitizeHTML(log.log_text.replace(/\n/g, '<br>'))}</p><small>Datum: ${new Date(log.created_at).toLocaleString('cs-CZ')}</small>`;
                logsContainer.appendChild(logElement);
                // Use requestAnimationFrame for smooth entry
                requestAnimationFrame(() => { logElement.style.opacity = '1'; logElement.style.transform = 'translateY(0)'; });
            });
            // Show restart button because logs exist
            if (generateTasksButton) {
                generateTasksButton.style.display = 'inline-flex';
                generateTasksButton.disabled = false;
                generateTasksButton.textContent = 'Restartovat Kvíz';
            }
        } else {
            logsContainer.innerHTML = '<p>Zatím žádné záznamy.</p>';
            fullLearningContextForQuiz = '';
            if (generateTasksButton) generateTasksButton.style.display = 'none'; // Hide restart button
        }
    } catch (err) {
        console.error('Chyba načítání záznamů:', err);
        logsContainer.innerHTML = `<p style="color: var(--accent-pink);">Chyba načítání záznamů.</p>`;
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
        if (data.candidates?.[0]?.finishReason === "SAFETY") { throw new Error("Odpověď AI byla zablokována bezpečnostním filtrem."); }
        if (data.promptFeedback?.blockReason) { throw new Error(`Dotaz blokován AI (${data.promptFeedback.blockReason}).`); }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) { throw new Error('AI nevrátilo žádný text.'); }
        let jsonString = text; const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/); if (jsonMatch?.[1]) jsonString = jsonMatch[1];
        try {
            const parsed = JSON.parse(jsonString);
            if (Array.isArray(parsed) && parsed.every(q => q.question && Array.isArray(q.options) && q.options.length === 5 && Array.isArray(q.answer) && q.answer.length > 0 && q.explanation && q.answer.every(a => typeof a === 'string' && ["A", "B", "C", "D", "E"].includes(a.toUpperCase())))) {
                console.log('Successfully parsed valid MC questions:', parsed);
                return parsed.map(q => ({ ...q, answer: q.answer.map(a => a.toUpperCase()) })); // Standardize answer letters to uppercase
            } else { throw new Error('Neplatná struktura JSON od AI.'); }
        } catch (e) { console.error('JSON Parse Error:', e, 'Raw String:', jsonString); throw new Error('Chyba zpracování odpovědi AI (JSON).'); }
    } catch (error) { console.error('Gemini MC question generation error:', error); throw error; }
}


// --- Логика Квиза (Обновлена) ---

function resetQuizState() { generatedQuestions = []; currentQuestionIndex = -1; isLoadingQuestions = false; }
function hideQuizUI() { if (quizContainer) quizContainer.style.display = 'none'; if (questionDisplay) questionDisplay.innerHTML = ''; if (answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = ''; if (submitAnswerButton) submitAnswerButton.style.display = 'none'; if (feedbackArea) feedbackArea.innerHTML = ''; if (nextQuestionButton) nextQuestionButton.style.display = 'none'; if (quizLoading) quizLoading.classList.add('hidden'); console.log('Quiz UI hidden.'); }

function setQuizLoadingState(isLoading) {
     if (!quizLoading) { console.warn("Quiz loading element not found."); return; }
     quizLoading.classList.toggle('visible-loader', isLoading);
     quizLoading.classList.toggle('hidden', !isLoading);
     if(generateTasksButton) generateTasksButton.disabled = isLoading;
     if(submitAnswerButton) submitAnswerButton.disabled = isLoading;
     if(nextQuestionButton) nextQuestionButton.disabled = isLoading;
     console.log(`Quiz loading state set to: ${isLoading}`);
}


async function fetchAndDisplayFirstQuestions(context) {
    if (!context) { showNotification('Chybí kontext pro kvíz.', 'warning'); return; }
    if (isLoadingQuestions) { console.log("Fetch already in progress, skipping."); return; }
    if (!quizContainer || !quizLoading) { console.error("Missing quiz container or loading elements."); return; }
    console.log('Fetching first batch of questions...');
    resetQuizState(); isLoadingQuestions = true;
    setQuizLoadingState(true);
    quizContainer.style.display = 'block';
    if(questionDisplay) questionDisplay.innerHTML = ''; if(feedbackArea) feedbackArea.innerHTML = ''; if(answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = ''; if(submitAnswerButton) submitAnswerButton.style.display = 'none'; if(nextQuestionButton) nextQuestionButton.style.display = 'none';
    try {
        generatedQuestions = await generateMultipleChoiceQuestions(context);
        if (generatedQuestions?.length > 0) { currentQuestionIndex = 0; displayCurrentQuestion(); }
        else { throw new Error('Nebyly vygenerovány žádné otázky.'); }
    } catch (error) { console.error('Failed fetch first questions:', error); showNotification(`Chyba generování kvízu: ${error.message}`, 'error'); hideQuizUI(); }
    finally { isLoadingQuestions = false; setQuizLoadingState(false); }
}


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
            success = true; // Successfully loaded new questions
        } else {
             showNotification("Nebyly nalezeny další otázky pro tento kontext.", "info");
             // Keep the index as is, user stays on the last question
        }
    } catch (error) {
        console.error("Failed fetch more questions:", error);
        showNotification(`Chyba načítání dalších otázek: ${error.message}`, 'error');
        // Don't decrement index, stay on last question or show end message
    } finally {
        isLoadingQuestions = false;
        if(nextQuestionButton) { // Restore button text/state
            nextQuestionButton.disabled = false;
            nextQuestionButton.innerHTML = 'Další otázka <i class="fas fa-arrow-right"></i>';
        }
        if (success) {
             // Index was already incremented in handleNextQuestion
             if (currentQuestionIndex < generatedQuestions.length) {
                 displayCurrentQuestion(); // Show the newly fetched question
             } else {
                  console.error("Error: fetchMoreQuestions succeeded but index is still out of bounds.");
                 displayEndOfQuizMessage();
             }
        } else {
             // If fetching failed or no new questions were found, and we are at the end
             if (currentQuestionIndex >= generatedQuestions.length) {
                 displayEndOfQuizMessage();
             }
             // Otherwise, user stays on the current question (no change needed)
        }
    }
}


function displayCurrentQuestion() {
    console.log(`Trying to display question at index: ${currentQuestionIndex}, Total questions: ${generatedQuestions.length}`);
    if (currentQuestionIndex < 0 || !generatedQuestions || generatedQuestions.length === 0) {
        console.warn("DisplayCurrentQuestion: Invalid index or no questions. Hiding UI elements.");
        hideQuizElements();
        if(questionDisplay) questionDisplay.innerHTML = '<p>Kvíz není připraven.</p>';
        return;
    }
     // If index is out of bounds, fetch more (handleNextQuestion should prevent this state mostly)
     if (currentQuestionIndex >= generatedQuestions.length) {
         console.warn('Index out of bounds in displayCurrentQuestion, attempting to fetch more...');
         fetchMoreQuestions();
         return;
     }

    if (!questionDisplay || !answerCheckboxesContainer || !submitAnswerButton || !feedbackArea || !nextQuestionButton) { console.error('Missing UI elements for question display.'); return; }

    const question = generatedQuestions[currentQuestionIndex];
    if (!question) {
         console.error(`Error: No question data found at index ${currentQuestionIndex}`);
         hideQuizElements();
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
        const span = document.createElement('span'); span.textContent = ` ${choiceLetter}) ${sanitizeHTML(optionText)}`; // Sanitize options
        label.appendChild(checkbox); label.appendChild(span);
        answerCheckboxesContainer.appendChild(label);
    });

    answerCheckboxesContainer.style.display = 'flex';
    submitAnswerButton.style.display = 'inline-flex';
    submitAnswerButton.disabled = false;
    console.log(`Displayed MC question ${currentQuestionIndex + 1}: ${question.question}`);
}


// Сравнение массивов (без изменений)
function arraysContainSameElements(arr1, arr2) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2) || arr1.length !== arr2.length) { return false; }
    const sortedArr1 = [...arr1].sort(); const sortedArr2 = [...arr2].sort();
    return sortedArr1.every((val, index) => val === sortedArr2[index]);
}

// Обработка ответа (без изменений в логике сравнения)
function handleAnswerSubmit() {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= generatedQuestions.length) { console.warn("Submit ignored: Invalid question index."); return; }
    if (!answerCheckboxesContainer || !feedbackArea || !submitAnswerButton || !nextQuestionButton) { console.error("Submit ignored: Missing UI elements."); return; }
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


function handleNextQuestion() {
    if (!nextQuestionButton || isLoadingQuestions) return;
    nextQuestionButton.disabled = true; // Disable immediately
    currentQuestionIndex++;
    console.log(`Next button clicked. New index target: ${currentQuestionIndex}`);

    // Check if the *next* question exists in the current batch
    if (currentQuestionIndex < generatedQuestions.length) {
        displayCurrentQuestion(); // Show next question from current batch
    } else {
        console.log("Reached end of current batch, attempting to fetch more...");
        fetchMoreQuestions(); // Fetch more; fetchMoreQuestions will call displayCurrentQuestion if successful
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
     // Показываем кнопку рестарта, если она есть и есть контекст
     if (generateTasksButton && fullLearningContextForQuiz) {
         generateTasksButton.disabled = false;
         generateTasksButton.textContent = 'Restartovat Kvíz';
         generateTasksButton.style.display = 'inline-flex';
     } else if (generateTasksButton) {
         generateTasksButton.style.display = 'none'; // Hide if no context
     }
     console.log("Quiz truly finished or failed to fetch more.");
}


// --- Инициализация приложения ---
function initializeSupabase() {
    try { if (!window.supabase?.createClient) throw new Error("Supabase lib not loaded."); supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); return true; }
    catch (e) { console.error("Supabase init failed:", e); return false; }
}

async function initializeApp() {
    console.log("[Init Bethebest MC Endless v2 - Fix Auth] Starting initialization...");
    cacheDOMElements(); // Cache elements first
    setupAuthListeners(); // Setup login/register/logout handlers
    setupLogFormListener(); // Setup learning log form handler

    // --- NEW: Setup for quiz buttons ---
    if (submitAnswerButton) { submitAnswerButton.addEventListener('click', handleAnswerSubmit); }
    else { console.warn('Submit answer button not found.'); }

    if (nextQuestionButton) { nextQuestionButton.addEventListener('click', handleNextQuestion); }
    else { console.warn('Next question button not found.'); }

    if (generateTasksButton) {
         generateTasksButton.textContent = 'Restartovat Kvíz'; // Set text immediately
         generateTasksButton.addEventListener('click', async () => {
             if (!fullLearningContextForQuiz) { showNotification("Nejprve přidejte záznam o učení.", "warning"); return;}
             if (isLoadingQuestions) return;
             showNotification('Generuji novou sadu otázek...', 'info');
             await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz); // Always fetch new set
         });
         generateTasksButton.style.display = 'none'; // Hide initially
    } else { console.warn('Generate/Restart button not found.'); }
    // --- End NEW ---

    if (!initializeSupabase()) { showNotification("Chyba připojení k databázi.", "error", 0); return; }

    // --- NEW: Moved Auth State Listener here ---
    if (supabaseClient && supabaseClient.auth) {
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('[Auth State Change] Event:', event, 'Session:', !!session);
            if (session?.user) {
                currentUser = session.user;
                console.log('[Auth State Change] User SIGNED IN:', currentUser.id);
                authSection?.classList.add('hidden');
                appSection?.classList.remove('hidden');
                if (userEmailDisplay) userEmailDisplay.textContent = session.user.email;
                if (logoutButton) logoutButton.disabled = false;
                hideQuizUI(); // Reset UI elements
                resetQuizState(); // Reset quiz variables

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
                        if (generateTasksButton) generateTasksButton.style.display = 'none'; // Hide restart if no logs
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
    } else {
         console.error("Supabase client or auth object not available to attach listener.");
         showNotification("Kritická chyba inicializace autentizace.", "error", 0);
    }
    // --- END: Moved Auth State Listener ---

    console.log("[Init Bethebest MC Endless v2 - Fix Auth] Initialization complete. Waiting for auth state...");
}


// --- Запуск приложения ---
document.addEventListener('DOMContentLoaded', initializeApp);

// --- КОНЕЦ ОБНОВЛЕННОГО КОДА JS ---