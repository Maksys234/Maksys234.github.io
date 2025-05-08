// dashboard/bethebest.js
// Версия: Multiple Choice, Endless Feed, Auto-Start, Refined Fetching

// --- Константы и Supabase клиент ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- HTML Элементы ---
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const loginFormContainer = document.getElementById('loginFormContainer');
const registerFormContainer = document.getElementById('registerFormContainer');
const notificationArea = document.getElementById('notificationArea');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutButton = document.getElementById('logoutButton');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const learningLogForm = document.getElementById('learningLogForm');
const learningInput = document.getElementById('learningInput');
const logsContainer = document.getElementById('logsContainer');
// Старые элементы Gemini (скрыты в HTML)
const geminiTasksContainer = document.getElementById('geminiTasksContainer');
const geminiLoading = document.getElementById('geminiLoading');

// --- ЭЛЕМЕНТЫ UI ДЛЯ КВИЗА ---
const quizContainer = document.getElementById('quizContainer');
const questionDisplay = document.getElementById('questionDisplay');
const answerCheckboxesContainer = document.getElementById('answerCheckboxesContainer');
const submitAnswerButton = document.getElementById('submitAnswerButton');
const feedbackArea = document.getElementById('feedbackArea');
const nextQuestionButton = document.getElementById('nextQuestionButton');
const quizLoading = document.getElementById('quizLoading');
// --------------------------------------------------------------------

// --- API Ключ ---
const GEMINI_API_KEY = 'AIzaSyB4l6Yj9AjWfkG2Ob2LCAgTsnSwN-UZQcA'; // Твой ключ
const GEMINI_API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- Состояние Квиза ---
let generatedQuestions = [];
let currentQuestionIndex = -1;
let isLoadingQuestions = false;
let fullLearningContextForQuiz = ''; // Контекст для Gemini
let currentUser = null; // Добавляем currentUser в состояние

// --- Функции ---

// Уведомления (без изменений)
function showNotification(message, type = 'info', duration = 3000) {
    if (!notificationArea) return;
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

// Переключение форм (без изменений)
window.toggleAuthForms = () => {
    loginFormContainer?.classList.toggle('hidden');
    registerFormContainer?.classList.toggle('hidden');
};

// Sanitize HTML (без изменений)
function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }

// --- Autentizace (Login, Register, Logout - без изменений) ---
loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    // ... (логика логина)
});

registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    // ... (логика регистрации)
});

logoutButton?.addEventListener('click', async () => {
    logoutButton.disabled = true;
    const { error } = await supabaseClient.auth.signOut();
    // ... (обработка выхода + resetQuizState() + hideQuizUI())
    if (error) {
        showNotification(`Chyba odhlášení: ${error.message}`, 'error');
        logoutButton.disabled = false;
    } else {
        showNotification('Odhlášení úspěšné.', 'info');
        resetQuizState();
        hideQuizUI();
    }
});

// --- ИЗМЕНЕНО: Auth State Change (Авто-запуск квиза) ---
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event);
    if (session?.user) {
        currentUser = session.user; // Сохраняем пользователя в состояние
        authSection?.classList.add('hidden');
        appSection?.classList.remove('hidden');
        if (userEmailDisplay) userEmailDisplay.textContent = session.user.email;
        if (logoutButton) logoutButton.disabled = false;
        hideQuizUI();
        resetQuizState();

        await loadLearningLogs(session.user.id); // Загружаем логи и контекст

        if (fullLearningContextForQuiz) {
            console.log('Auth state: User logged in, logs found. Starting quiz automatically.');
            await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
        } else {
            console.log('Auth state: User logged in, no logs found. Quiz not started.');
            if (quizContainer) quizContainer.style.display = 'block';
            if (questionDisplay) questionDisplay.innerHTML = '<p>Vítejte! Přidejte záznam o učení, aby se zde objevily otázky k procvičení.</p>';
        }

    } else {
        currentUser = null;
        authSection?.classList.remove('hidden');
        appSection?.classList.add('hidden');
        if (userEmailDisplay) userEmailDisplay.textContent = '';
        if (logsContainer) logsContainer.innerHTML = '<p>Přihlaste se, abyste mohli vidět a přidávat záznamy.</p>';
        hideQuizUI();
        resetQuizState();
        fullLearningContextForQuiz = '';
    }
});

// --- Сохранение логов (Обновляет контекст) ---
learningLogForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const logText = learningInput?.value.trim();
    if (!logText) { showNotification('Napiš, co ses naučil/a.', 'error'); return; }
    if (!currentUser) { showNotification('Pro uložení se přihlas.', 'error'); return; }

    const submitButton = learningLogForm.querySelector('button[type="submit"]');
    submitButton.disabled = true; submitButton.textContent = 'Ukládám...';

    try {
        const { data, error } = await supabaseClient.from('learning_logs').insert([{ user_id: currentUser.id, log_text: logText }]).select();
        if (error) throw error;
        showNotification('Pokrok uložen! Záznam bude zahrnut v dalších otázkách.', 'success');
        if(learningInput) learningInput.value = '';
        await loadLearningLogs(currentUser.id); // Перезагружаем логи для обновления контекста

        // Если квиз еще не был запущен (не было логов), запускаем его
        if (currentQuestionIndex === -1 && fullLearningContextForQuiz) {
             console.log("First log saved, starting quiz...");
             await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
        }

    } catch (err) {
        console.error('Chyba ukládání záznamu:', err);
        showNotification(`Uložení selhalo: ${err.message}`, 'error');
    } finally {
        submitButton.disabled = false; submitButton.textContent = 'Uložit pokrok';
    }
});

// --- Загрузка логов (Сохраняет ВЕСЬ контекст) ---
async function loadLearningLogs(userId) {
    if (!userId) { logsContainer.innerHTML = '<p>Přihlaste se.</p>'; return; }
    if (logsContainer) logsContainer.innerHTML = '<div class="loader">Načítám záznamy...</div>';
    try {
        const { data, error } = await supabaseClient
            .from('learning_logs')
            .select('log_text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(30); // Ограничиваем контекст последними 30 записями

        if (error) throw error;

        if (data?.length > 0) {
            if(logsContainer) logsContainer.innerHTML = '';
            fullLearningContextForQuiz = data
                .reverse() // Старые первыми для AI
                .map(log => `Datum: ${new Date(log.created_at).toLocaleDateString('cs-CZ')}\nText: ${log.log_text}`)
                .join("\n\n---\n\n");
            console.log('Learning context loaded (entries):', data.length);

            // Отображаем только последние несколько логов (например, 5) для UI
            data.slice(0, 5).forEach(log => {
                const logElement = document.createElement('div');
                logElement.classList.add('log-entry');
                logElement.innerHTML = `<p>${sanitizeHTML(log.log_text.replace(/\n/g, '<br>'))}</p><small>Datum: ${new Date(log.created_at).toLocaleString('cs-CZ')}</small>`;
                logsContainer?.appendChild(logElement);
                requestAnimationFrame(() => { logElement.style.opacity = '1'; logElement.style.transform = 'translateY(0)'; });
            });
        } else {
            if(logsContainer) logsContainer.innerHTML = '<p>Zatím žádné záznamy.</p>';
            fullLearningContextForQuiz = '';
        }
    } catch (err) {
        console.error('Chyba načítání záznamů:', err);
        if(logsContainer) logsContainer.innerHTML = `<p style="color: var(--error-color);">Chyba načítání: ${err.message}</p>`;
        fullLearningContextForQuiz = '';
    }
}

// --- НОВАЯ ФУНКЦИЯ: Генерация MC вопросов (с поддержкой >1 ответа) ---
async function generateMultipleChoiceQuestions(fullLearningContext) {
    if (!fullLearningContext) { return null; }
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
${fullLearningContext}
---

Příklad formátu JSON pole:
[
  {
    "question": "Které z následujících čísel jsou prvočísla?",
    "options": [ "4", "7", "9", "11", "15" ],
    "answer": ["B", "D"],
    "explanation": "Prvočíslo je dělitelné pouze 1 a samo sebou. 7 a 11 splňují tuto podmínku."
  },
  {
    "question": "Co platí pro sin(x) v prvním kvadrantu?",
    "options": [ "Je vždy kladný", "Je rostoucí", "Je vždy záporný", "Je klesající", "Nabývá hodnot od 0 do 1" ],
    "answer": ["A", "B", "E"],
    "explanation": "V prvním kvadrantu (0 až 90 stupňů) je sinus kladný, jeho hodnota roste od 0 do 1."
  }
]`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, topP: 0.95 } // Настройки для генерации вопросов
    };
    try {
        console.log('Sending request to Gemini for MC questions (multi-answer)...');
        const response = await fetch(GEMINI_API_URL_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(`Chyba ${response.status} od Gemini API: ${errorData?.error?.message || response.statusText}`);}
        const data = await response.json();
        console.log('Raw MC Gemini response:', JSON.stringify(data).substring(0, 300) + '...');
        if (data.candidates?.[0]?.finishReason === "SAFETY") { throw new Error("Odpověď AI byla zablokována bezpečnostními filtry."); }
        if (data.promptFeedback?.blockReason) { throw new Error(`Dotaz na MC otázky byl blokován AI filtrem (${data.promptFeedback.blockReason}).`); }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) { throw new Error('AI nevrátilo žádný text s otázkami.'); }

        let jsonString = text;
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch?.[1]) { jsonString = jsonMatch[1]; }

        try {
            const parsedQuestions = JSON.parse(jsonString);
            if (Array.isArray(parsedQuestions) && parsedQuestions.every(q => q.question && Array.isArray(q.options) && q.options.length === 5 && Array.isArray(q.answer) && q.answer.length > 0 && q.explanation && q.answer.every(ans => typeof ans === 'string' && ["A", "B", "C", "D", "E"].includes(ans.toUpperCase())))) {
                console.log('Successfully parsed valid MC questions (multi-answer):', parsedQuestions);
                return parsedQuestions.map(q => ({ ...q, answer: q.answer.map(a => a.toUpperCase()) }));
            } else { throw new Error('Nesprávná struktura JSONu od AI.'); }
        } catch (parseError) { console.error('Failed to parse JSON:', parseError, 'Raw JSON:', jsonString); throw new Error('Nepodařilo se zpracovat odpověď AI.'); }
    } catch (error) { console.error('Chyba při volání Gemini API pro MC otázky:', error); throw error; }
}

// --- Логика Квиза (Обновлена для Checkbox и бесконечности) ---

function resetQuizState() { generatedQuestions = []; currentQuestionIndex = -1; isLoadingQuestions = false; }
function hideQuizUI() { if (quizContainer) quizContainer.style.display = 'none'; if (questionDisplay) questionDisplay.innerHTML = ''; if (answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = ''; if (submitAnswerButton) submitAnswerButton.style.display = 'none'; if (feedbackArea) feedbackArea.innerHTML = ''; if (nextQuestionButton) nextQuestionButton.style.display = 'none'; if (quizLoading) quizLoading.classList.add('hidden'); console.log('Quiz UI hidden.'); }

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

async function fetchMoreQuestions() {
    if (!fullLearningContextForQuiz || isLoadingQuestions) return;
    console.log("Fetching more questions...");
    isLoadingQuestions = true;
    if(nextQuestionButton) { nextQuestionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Načítám...'; nextQuestionButton.disabled = true; }
    try {
        const newQuestions = await generateMultipleChoiceQuestions(fullLearningContextForQuiz);
        if (newQuestions?.length > 0) {
            generatedQuestions.push(...newQuestions);
            console.log(`Added ${newQuestions.length}. Total: ${generatedQuestions.length}`);
            // currentQuestionIndex УЖЕ увеличен в handleNextQuestion,
            // поэтому просто показываем вопрос по текущему индексу
            displayCurrentQuestion();
        } else {
             showNotification("Nepodařilo se načíst další otázky. Zkuste to znovu.", "warning");
             // Важно: Уменьшаем индекс обратно, т.к. новых вопросов нет,
             // чтобы пользователь не застрял
             currentQuestionIndex--;
        }
    } catch (error) {
        console.error("Failed fetch more questions:", error);
        showNotification(`Chyba načítání dalších otázek: ${error.message}`, 'error');
        currentQuestionIndex--; // Сбрасываем индекс обратно
    } finally {
        isLoadingQuestions = false;
        if(nextQuestionButton) {
            nextQuestionButton.disabled = false;
            nextQuestionButton.innerHTML = 'Další otázka <i class="fas fa-arrow-right"></i>';
        }
    }
}

function displayCurrentQuestion() {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= generatedQuestions.length) {
        console.warn('Invalid index or end reached in displayCurrentQuestion:', currentQuestionIndex, generatedQuestions.length);
         // Попытка загрузить еще, если мы вышли за пределы
         fetchMoreQuestions();
         // Показываем лоадер или сообщение? Пока просто выходим
        return;
    }
    if (!questionDisplay || !answerCheckboxesContainer || !submitAnswerButton || !feedbackArea || !nextQuestionButton) { console.error('Missing quiz UI elements.'); return; }

    const question = generatedQuestions[currentQuestionIndex];
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

function arraysContainSameElements(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    const sortedArr1 = [...arr1].sort();
    const sortedArr2 = [...arr2].sort();
    return sortedArr1.every((value, index) => value === sortedArr2[index]);
}

function handleAnswerSubmit() {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= generatedQuestions.length) return;
    if (!answerCheckboxesContainer || !feedbackArea || !submitAnswerButton || !nextQuestionButton) return;

    const selectedCheckboxes = answerCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
    const selectedChoices = Array.from(selectedCheckboxes).map(cb => cb.value.toUpperCase());

    if (selectedChoices.length === 0) { showNotification('Vyberte alespoň jednu odpověď.', 'warning'); return; }

    const currentQuestion = generatedQuestions[currentQuestionIndex];
    const correctAnswers = currentQuestion.answer; // Массив букв
    const explanation = currentQuestion.explanation;

    const isFullyCorrect = arraysContainSameElements(selectedChoices, correctAnswers);
    const correctSelected = selectedChoices.filter(choice => correctAnswers.includes(choice));
    const incorrectSelected = selectedChoices.filter(choice => !correctAnswers.includes(choice));
    const missedCorrect = correctAnswers.filter(ans => !selectedChoices.includes(ans));
    const isPartiallyCorrect = !isFullyCorrect && correctSelected.length > 0 && incorrectSelected.length === 0; // Правильные выбраны, но не все

    let feedbackHTML = ''; let feedbackClass = '';

    // Блокируем и подсвечиваем чекбоксы
    const allCheckboxes = answerCheckboxesContainer.querySelectorAll('input[type="checkbox"]');
    allCheckboxes.forEach(checkbox => {
        checkbox.disabled = true;
        const choice = checkbox.value.toUpperCase();
        const label = checkbox.closest('.checkbox-label');
        label?.classList.add('disabled'); // Добавляем общий класс блокировки
        if (correctAnswers.includes(choice)) {
            label?.classList.add('correct-answer-label'); // Помечаем все правильные
        }
        if (selectedChoices.includes(choice)) {
            if (correctAnswers.includes(choice)) {
                label?.classList.add('selected-correct-label'); // Выбранный и правильный
            } else {
                label?.classList.add('selected-incorrect-label'); // Выбранный и неправильный
            }
        }
    });

    // Формируем отзыв
    if (isFullyCorrect) {
        feedbackClass = 'correct';
        feedbackHTML = `<div class="feedback ${feedbackClass}"><i class="fas fa-check-circle"></i> <strong>Správně!</strong><p>${sanitizeHTML(explanation)}</p></div>`;
        showNotification('Výborně!', 'success', 2000);
    } else if (isPartiallyCorrect) {
        feedbackClass = 'partial';
        feedbackHTML = `<div class="feedback ${feedbackClass}"><i class="fas fa-exclamation-triangle"></i> <strong>Částečně správně.</strong><p>Správné odpovědi byly: <strong>${correctAnswers.join(', ')}</strong>. Chyběly: ${missedCorrect.join(', ')}.</p><p>Vysvětlení: ${sanitizeHTML(explanation)}</p></div>`;
        showNotification('Skoro! Chybí jen kousek.', 'info', 2500);
    } else { // Полностью неправильно (либо выбраны только неправильные, либо смесь правильных и неправильных)
        feedbackClass = 'incorrect';
        let mistakeDetail = '';
        if(incorrectSelected.length > 0) mistakeDetail += ` Nesprávně zvolené: ${incorrectSelected.join(', ')}.`;
        if(missedCorrect.length > 0 && correctSelected.length > 0) mistakeDetail += ` Navíc chyběly správné: ${missedCorrect.join(', ')}.`;

        feedbackHTML = `<div class="feedback ${feedbackClass}"><i class="fas fa-times-circle"></i> <strong>Špatně.</strong><p>Správné odpovědi: <strong>${correctAnswers.join(', ')}</strong>.${mistakeDetail}</p><p>Vysvětlení: ${sanitizeHTML(explanation)}</p></div>`;
        showNotification('Nevadí, podívej se na vysvětlení.', 'info', 2500);
    }

    feedbackArea.innerHTML = feedbackHTML;
    submitAnswerButton.disabled = true;
    submitAnswerButton.style.display = 'none';
    nextQuestionButton.style.display = 'inline-flex';
    nextQuestionButton.disabled = false;
    nextQuestionButton.focus();
    console.log(`Answer submitted Q${currentQuestionIndex + 1}. Selected: ${selectedChoices.join(',')}. Correct: ${correctAnswers.join(',')}. Fully: ${isFullyCorrect}. Partial: ${isPartiallyCorrect}`);
}

function handleNextQuestion() {
    if (!nextQuestionButton) return;
    if (isLoadingQuestions) return; // Не переключать, если грузятся новые

    nextQuestionButton.disabled = true;
    currentQuestionIndex++;

    if (currentQuestionIndex >= generatedQuestions.length) {
        console.log("Reached end, fetching more...");
        fetchMoreQuestions(); // Загружаем новые, он покажет следующий вопрос
    } else {
        displayCurrentQuestion(); // Показываем следующий из текущего набора
    }
}


// --- Прикрепление обработчиков ---
document.addEventListener('DOMContentLoaded', () => {
    // Кнопка подтверждения ответа
    if (submitAnswerButton) {
        submitAnswerButton.addEventListener('click', handleAnswerSubmit);
    } else { console.warn('Submit answer button (#submitAnswerButton) not found.'); }

    // Кнопка следующего вопроса
    if (nextQuestionButton) {
        nextQuestionButton.addEventListener('click', handleNextQuestion);
    } else { console.warn('Next question button (#nextQuestionButton) not found.'); }

    // Старая кнопка теперь не нужна для автостарта
    if (generateTasksButton) {
        // Можно оставить для ручного обновления вопросов?
        generateTasksButton.textContent = 'Obnovit Otázky';
        generateTasksButton.addEventListener('click', async () => {
             if (!fullLearningContextForQuiz || isLoadingQuestions) return;
             showNotification('Generuji novou sadu otázek...', 'info');
             await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz); // Перегенерировать с начала
        });
        // Показываем её, только если есть контекст (после loadLearningLogs)
        generateTasksButton.style.display = fullLearningContextForQuiz ? 'inline-flex' : 'none';
    }

    // --- Инициализация ---
    // Запускаем инициализацию Supabase и проверку auth state
    initializeApp(); // Новая функция инициализации

});

// --- НОВАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ---
async function initializeApp() {
    console.log("[Init Bethebest MC Endless] Starting initialization...");
    if (!initializeSupabase()) {
        showNotification("Chyba připojení k databázi.", "error", 0); // Show indefinitely
        return;
    }
    // Состояние пользователя и запуск квиза обрабатывается в onAuthStateChange
    console.log("[Init Bethebest MC Endless] Initialization complete. Waiting for auth state...");
}

function initializeSupabase() { /* ... как раньше ... */ return true; }
// -----------------------------------

// --- КОНЕЦ НОВЫХ ФУНКЦИЙ КВИЗА ---

// Sanitize HTML function
function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }

// Запускаем инициализацию
// initializeApp(); // Вызывается из DOMContentLoaded