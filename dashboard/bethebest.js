// dashboard/bethebest.js
// Версия с Multiple Choice и контекстом из нескольких логов

// --- Константы и Supabase клиент (без изменений) ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- HTML Элементы (Добавляем/Изменяем) ---
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

// Старые элементы Gemini (оставляем, но скрываем)
const generateTasksButton = document.getElementById('generateTasksButton'); // Кнопка теперь запускает квиз
const geminiTasksContainer = document.getElementById('geminiTasksContainer');
const geminiLoading = document.getElementById('geminiLoading'); // Старый лоадер

// --- ЭЛЕМЕНТЫ UI ДЛЯ КВИЗА ---
const quizContainer = document.getElementById('quizContainer');
const questionDisplay = document.getElementById('questionDisplay');
// УДАЛЕНО: const userAnswerInput = document.getElementById('userAnswerInput');
// УДАЛЕНО: const submitAnswerButton = document.getElementById('submitAnswerButton');
const answerOptionsContainer = document.getElementById('answerOptionsContainer'); // НОВЫЙ контейнер для вариантов
const feedbackArea = document.getElementById('feedbackArea');
const nextQuestionButton = document.getElementById('nextQuestionButton');
const quizLoading = document.getElementById('quizLoading'); // Лоадер для вопросов квиза
// --------------------------------------------------------------------

// --- API Ключ (Без изменений) ---
const GEMINI_API_KEY = 'AIzaSyB4l6Yj9AjWfkG2Ob2LCAgTsnSwN-UZQcA'; // Твой ключ
const GEMINI_API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- Состояние Квиза (Без изменений) ---
let generatedQuestions = [];
let currentQuestionIndex = -1;
let isLoadingQuestions = false;
let fullLearningContextForQuiz = ''; // Храним ВЕСЬ контекст для квиза

// --- Функции (showNotification, toggleAuthForms - без изменений) ---
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
window.toggleAuthForms = () => {
    loginFormContainer.classList.toggle('hidden');
    registerFormContainer.classList.toggle('hidden');
};

// --- Autentizace (Login, Register, Logout - без изменений) ---
loginForm.addEventListener('submit', async (event) => { /* ... без изменений ... */ });
registerForm.addEventListener('submit', async (event) => { /* ... без изменений ... */ });
logoutButton.addEventListener('click', async () => { /* ... добавлено resetQuizState() и hideQuizUI() ... */
    logoutButton.disabled = true;
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        showNotification(`Chyba odhlášení: ${error.message}`, 'error');
        logoutButton.disabled = false; // Re-enable on error
    } else {
        showNotification('Odhlášení úspěšné.', 'info');
        // UI скроется через onAuthStateChange
        resetQuizState();
        hideQuizUI();
    }
});

// --- Auth State Change (Обновлен для показа кнопки квиза) ---
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session);
    if (session && session.user) {
        currentUser = session.user;
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        userEmailDisplay.textContent = session.user.email;
        loadLearningLogs(session.user.id); // Загрузка логов и показ кнопки квиза, если есть логи
        logoutButton.disabled = false;
        hideQuizUI(); // Прячем квиз при входе/обновлении страницы
        resetQuizState();
    } else {
        currentUser = null;
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
        userEmailDisplay.textContent = '';
        logsContainer.innerHTML = '<p>Přihlaste se, abyste mohli vidět a přidávat záznamy.</p>';
        if (generateTasksButton) generateTasksButton.style.display = 'none'; // Прячем кнопку
        hideQuizUI();
        resetQuizState();
    }
});

// --- Сохранение логов (Изменен: сохраняет контекст, показывает кнопку квиза) ---
learningLogForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const logText = learningInput.value.trim();
    if (!logText) { showNotification('Napiš, co ses naučil/a.', 'error'); return; }
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { showNotification('Pro uložení se přihlas.', 'error'); return; }

    const submitButton = learningLogForm.querySelector('button[type="submit"]');
    submitButton.disabled = true; submitButton.textContent = 'Ukládám...';
    hideQuizUI(); resetQuizState();

    try {
        const { data, error } = await supabaseClient.from('learning_logs').insert([{ user_id: user.id, log_text: logText }]).select();
        if (error) throw error;
        showNotification('Pokrok uložen!', 'success');
        learningInput.value = '';
        await loadLearningLogs(user.id); // Перезагружаем логи (это обновит fullLearningContextForQuiz и покажет кнопку)
    } catch (err) {
        console.error('Chyba ukládání záznamu:', err);
        showNotification(`Uložení selhalo: ${err.message}`, 'error');
        if (generateTasksButton) generateTasksButton.style.display = 'none';
    } finally {
        submitButton.disabled = false; submitButton.textContent = 'Uložit pokrok';
    }
});

// --- Загрузка логов (Изменен: сохраняет ВЕСЬ контекст) ---
async function loadLearningLogs(userId) {
    if (!userId) { logsContainer.innerHTML = '<p>Přihlaste se.</p>'; return; }
    logsContainer.innerHTML = '<div class="loader">Načítám záznamy...</div>';
    try {
        const { data, error } = await supabaseClient
            .from('learning_logs')
            .select('log_text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;

        if (data && data.length > 0) {
            logsContainer.innerHTML = '';
            // Собираем контекст из ВСЕХ логов (или последних N)
            fullLearningContextForQuiz = data
                .slice(0, 10) // Ограничим 10 последними логами для Gemini
                .map(log => `Datum: ${new Date(log.created_at).toLocaleDateString('cs-CZ')}\nText: ${log.log_text}`)
                .join("\n\n---\n\n");

            data.forEach(log => {
                const logElement = document.createElement('div');
                logElement.classList.add('log-entry');
                logElement.innerHTML = `<p>${sanitizeHTML(log.log_text.replace(/\n/g, '<br>'))}</p><small>Datum: ${new Date(log.created_at).toLocaleString('cs-CZ')}</small>`;
                logsContainer.appendChild(logElement);
                requestAnimationFrame(() => { logElement.style.opacity = '1'; logElement.style.transform = 'translateY(0)'; });
            });
            // Показываем кнопку квиза, т.к. логи есть
            if (generateTasksButton) {
                generateTasksButton.style.display = 'inline-flex';
                generateTasksButton.disabled = false;
                generateTasksButton.textContent = 'Spustit kvíz';
            }
        } else {
            logsContainer.innerHTML = '<p>Zatím žádné záznamy.</p>';
            fullLearningContextForQuiz = ''; // Очищаем контекст
            if (generateTasksButton) generateTasksButton.style.display = 'none'; // Прячем кнопку
        }
    } catch (err) {
        console.error('Chyba načítání záznamů:', err);
        logsContainer.innerHTML = `<p style="color: var(--error-color);">Chyba načítání: ${err.message}</p>`;
        fullLearningContextForQuiz = '';
        if (generateTasksButton) generateTasksButton.style.display = 'none';
    }
}

// --- Старая функция Gemini для ЗАДАЧ (Оставляем) ---
async function generateTasksWithGeminiDirectly(learningContext) { /* ... без изменений ... */ }

// --- НОВАЯ ФУНКЦИЯ: Генерация вопросов Multiple Choice ---
/**
 * Генерирует вопросы MC с помощью Gemini API на основе всего контекста.
 * @param {string} fullLearningContext Текст из ВСЕХ логов обучения.
 * @returns {Promise<Array|null>} Массив объектов вопросов или null в случае ошибки.
 */
async function generateMultipleChoiceQuestions(fullLearningContext) {
    if (!fullLearningContext) {
        console.warn("generateMultipleChoiceQuestions: No learning context provided.");
        return null;
    }
    const prompt = `
Na základě VŠECH následujících záznamů o učení studenta, vygeneruj 3-5 otázek s výběrem odpovědí (multiple choice), které otestují jeho porozumění RŮZNÝM tématům zmíněným v záznamech. Ke každé otázce vytvoř 5 možností odpovědí (A, B, C, D, E), kde POUZE JEDNA je správná. Uveď také správnou odpověď (jako PÍSMENO A-E) a krátké vysvětlení.

Vrať odpověď POUZE jako JSON pole objektů. Každý objekt musí obsahovat klíče:
- "question" (string): Text otázky.
- "options" (array of 5 strings): Pole s pěti možnostmi odpovědí.
- "answer" (string): Správné PÍSMENO odpovědi (A, B, C, D, nebo E).
- "explanation" (string): Vysvětlení správné odpovědi.

JSON formát musí být striktně dodržen. Nepoužívej Markdown mimo JSON. Zajisti, aby otázky pokrývaly RŮZNÁ témata z poskytnutého kontextu.

Kontext učení (všechny záznamy):
---
${fullLearningContext}
---

Příklad formátu JSON pole:
[
  {
    "question": "Kolik je 5 * (3 + 2)?",
    "options": [
      "10",
      "17",
      "25",
      "15",
      "30"
    ],
    "answer": "C",
    "explanation": "Nejprve se provede operace v závorce (3+2=5), poté násobení (5*5=25)."
  },
  {
    "question": "Jaký je chemický vzorec vody?",
    "options": [
      "CO2",
      "H2O",
      "NaCl",
      "O2",
      "H2SO4"
    ],
    "answer": "B",
    "explanation": "Molekula vody se skládá ze dvou atomů vodíku (H) a jednoho atomu kyslíku (O)."
  }
]`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, topP: 0.95 } // Настройки для генерации вопросов
    };

    try {
        console.log('Sending request to Gemini for MC questions...');
        const response = await fetch(GEMINI_API_URL_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) { /* ... обработка ошибок API ... */ throw new Error(`Chyba ${response.status} od Gemini API.`); }
        const data = await response.json();
        console.log('Raw MC Gemini response:', JSON.stringify(data));

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts?.[0]?.text) {
             if (data.candidates[0].finishReason === "SAFETY") { /* ... обработка safety ... */ throw new Error("Odpověď AI byla zablokována."); }

             let jsonString = data.candidates[0].content.parts[0].text;
             const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
             if (jsonMatch && jsonMatch[1]) { jsonString = jsonMatch[1]; }

             try {
                 const parsedQuestions = JSON.parse(jsonString);
                 // Валидация структуры
                 if (Array.isArray(parsedQuestions) && parsedQuestions.every(q => q.question && Array.isArray(q.options) && q.options.length === 5 && q.answer && q.explanation && ["A", "B", "C", "D", "E"].includes(q.answer.toUpperCase()))) {
                     console.log('Successfully parsed MC questions:', parsedQuestions);
                     return parsedQuestions;
                 } else {
                     console.error('Invalid MC JSON structure received:', parsedQuestions);
                     throw new Error('AI vrátilo MC otázky v neočekávaném formátu.');
                 }
             } catch (parseError) { /* ... обработка ошибок парсинга ... */ throw new Error('Nepodařilo se zpracovat MC odpověď AI.'); }
        } else if (data.promptFeedback?.blockReason) { /* ... обработка blockReason ... */ throw new Error(`Dotaz na MC otázky byl blokován AI filtrem.`); }
        else { /* ... обработка пустого ответа ... */ throw new Error('AI nevrátilo žádné MC otázky.'); }
    } catch (error) { console.error('Chyba při volání Gemini API pro MC otázky:', error); throw error; }
}

// --- Логика Квиза (Обновлена) ---

function resetQuizState() { generatedQuestions = []; currentQuestionIndex = -1; isLoadingQuestions = false; }
function hideQuizUI() { if (quizContainer) quizContainer.style.display = 'none'; if (questionDisplay) questionDisplay.innerHTML = ''; if (answerOptionsContainer) answerOptionsContainer.innerHTML = ''; if (feedbackArea) feedbackArea.innerHTML = ''; if (nextQuestionButton) nextQuestionButton.style.display = 'none'; if (quizLoading) quizLoading.classList.add('hidden'); console.log('Quiz UI hidden and cleared.'); }

/**
 * Запускает сессию квиза на основе ВСЕГО сохраненного контекста.
 */
async function startQuizSession() {
    if (!fullLearningContextForQuiz) { showNotification('Žádné záznamy k dispozici pro kvíz.', 'warning'); return; }
    if (isLoadingQuestions) { showNotification('Otázky se již načítají...', 'info'); return; }
    if (!quizContainer || !quizLoading) { console.error('Quiz container or loading elements missing.'); return; }

    console.log('Starting quiz session based on full context...');
    resetQuizState();
    isLoadingQuestions = true;
    quizContainer.style.display = 'block';
    quizLoading.classList.remove('hidden');
    if(questionDisplay) questionDisplay.innerHTML = '';
    if(feedbackArea) feedbackArea.innerHTML = '';
    if(answerOptionsContainer) answerOptionsContainer.innerHTML = '';
    if(nextQuestionButton) nextQuestionButton.style.display = 'none';
    if(generateTasksButton) generateTasksButton.disabled = true;

    try {
        generatedQuestions = await generateMultipleChoiceQuestions(fullLearningContextForQuiz);
        if (generatedQuestions && generatedQuestions.length > 0) {
            currentQuestionIndex = 0;
            displayCurrentQuestion();
        } else {
            throw new Error('Nebyly vygenerovány žádné MC otázky.');
        }
    } catch (error) {
        console.error('Failed to start quiz session:', error);
        showNotification(`Chyba při generování kvízu: ${error.message}`, 'error');
        hideQuizUI();
        if(generateTasksButton) generateTasksButton.disabled = false;
    } finally {
        isLoadingQuestions = false;
        if (quizLoading) quizLoading.classList.add('hidden');
    }
}

/**
 * Отображает текущий вопрос и варианты ответа.
 */
function displayCurrentQuestion() {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= generatedQuestions.length) { displayQuizEnd(); return; }
    if (!questionDisplay || !answerOptionsContainer || !feedbackArea || !nextQuestionButton) { console.error('Required quiz UI elements missing.'); return; }

    const question = generatedQuestions[currentQuestionIndex];
    questionDisplay.innerHTML = `<p><strong>Otázka ${currentQuestionIndex + 1}/${generatedQuestions.length}:</strong></p><p>${sanitizeHTML(question.question)}</p>`;
    feedbackArea.innerHTML = '';
    answerOptionsContainer.innerHTML = ''; // Очищаем предыдущие варианты
    nextQuestionButton.style.display = 'none'; // Прячем кнопку "Дальше"

    // Создаем кнопки для вариантов ответа
    const choices = ["A", "B", "C", "D", "E"];
    question.options.forEach((optionText, index) => {
        const choiceLetter = choices[index];
        const optionButton = document.createElement('button');
        optionButton.classList.add('btn', 'answer-option-button'); // Добавляем класс для стилизации
        optionButton.dataset.choice = choiceLetter; // Сохраняем букву варианта
        // Используем textContent для безопасности
        optionButton.textContent = `${choiceLetter}) ${optionText}`;
        optionButton.addEventListener('click', handleAnswerSelection);
        answerOptionsContainer.appendChild(optionButton);
    });
    answerOptionsContainer.style.display = 'flex'; // Показываем контейнер с вариантами
    answerOptionsContainer.style.flexDirection = 'column'; // Варианты друг под другом
    answerOptionsContainer.style.gap = '10px'; // Отступ между вариантами

    console.log(`Displayed MC question ${currentQuestionIndex + 1}`);
}

/**
 * Обрабатывает выбор варианта ответа.
 * @param {Event} event Событие клика по кнопке варианта.
 */
function handleAnswerSelection(event) {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= generatedQuestions.length) return;
    if (!feedbackArea || !nextQuestionButton || !answerOptionsContainer) return;

    const selectedButton = event.currentTarget;
    const selectedChoice = selectedButton.dataset.choice;
    const currentQuestion = generatedQuestions[currentQuestionIndex];
    const correctAnswerLetter = currentQuestion.answer.toUpperCase();
    const explanation = currentQuestion.explanation;

    // Блокируем все кнопки вариантов
    const allOptionButtons = answerOptionsContainer.querySelectorAll('.answer-option-button');
    allOptionButtons.forEach(button => {
        button.disabled = true;
        button.removeEventListener('click', handleAnswerSelection); // Убираем обработчик
        // Визуальное выделение правильного и неправильного
        if (button.dataset.choice === correctAnswerLetter) {
            button.classList.add('correct-answer'); // Класс для правильного
        }
        if (button === selectedButton && selectedChoice !== correctAnswerLetter) {
            button.classList.add('incorrect-answer'); // Класс для выбранного неправильного
        } else if (button === selectedButton && selectedChoice === correctAnswerLetter) {
             button.classList.add('selected-correct'); // Класс для выбранного правильного
        }
    });

    let feedbackHTML = '';
    if (selectedChoice === correctAnswerLetter) {
        feedbackHTML = `<div class="feedback correct"><i class="fas fa-check-circle"></i> <strong>Správně!</strong><p>${sanitizeHTML(explanation)}</p></div>`;
        showNotification('Výborně!', 'success', 2000);
    } else {
        feedbackHTML = `<div class="feedback incorrect"><i class="fas fa-times-circle"></i> <strong>Špatně.</strong><p>Správná odpověď: <strong>${correctAnswerLetter}) ${sanitizeHTML(currentQuestion.options[correctAnswerLetter.charCodeAt(0) - 65])}</strong></p><p>Vysvětlení: ${sanitizeHTML(explanation)}</p></div>`;
        showNotification('Nevadí, zkus další!', 'info', 2000);
    }

    feedbackArea.innerHTML = feedbackHTML;
    nextQuestionButton.style.display = 'inline-flex'; // Показываем кнопку "Дальше"
    nextQuestionButton.disabled = false;
    nextQuestionButton.focus();
    console.log(`Answer ${selectedChoice} selected for question ${currentQuestionIndex + 1}. Correct: ${selectedChoice === correctAnswerLetter}`);
}

/**
 * Переходит к следующему вопросу.
 */
function handleNextQuestion() {
    if (!nextQuestionButton) return;
    nextQuestionButton.disabled = true; // Блокируем на время перехода
    currentQuestionIndex++;
    if (currentQuestionIndex < generatedQuestions.length) {
        displayCurrentQuestion();
    } else {
        displayQuizEnd();
    }
}

/**
 * Отображает сообщение об окончании квиза.
 */
function displayQuizEnd() {
    if (!questionDisplay || !answerOptionsContainer || !feedbackArea || !nextQuestionButton) return;
    questionDisplay.innerHTML = `<h2><i class="fas fa-flag-checkered"></i> Kvíz dokončen!</h2><p>Dobrá práce! Můžeš spustit kvíz znovu nebo přidat nový záznam.</p>`;
    answerOptionsContainer.innerHTML = '';
    answerOptionsContainer.style.display = 'none';
    feedbackArea.innerHTML = '';
    nextQuestionButton.style.display = 'none';
    if (generateTasksButton && fullLearningContextForQuiz) { // Покажем кнопку, если есть контекст
        generateTasksButton.disabled = false;
        generateTasksButton.textContent = 'Spustit kvíz znovu';
    }
    console.log('Quiz finished.');
}

// --- ОБНОВЛЕННЫЙ Обработчик для кнопки #generateTasksButton ---
// Теперь он ТОЛЬКО запускает квиз
if (generateTasksButton) {
    generateTasksButton.addEventListener('click', async () => {
        console.log('Start Quiz button clicked.');
        if (!fullLearningContextForQuiz) { // Проверяем наличие общего контекста
            showNotification('Nejprve uložte záznam o učení nebo obnovte stránku.', 'warning');
            return;
        }
        if (isLoadingQuestions) {
            showNotification('Otázky se již načítají...', 'info');
            return;
        }
        await startQuizSession(); // Запускаем квиз с полным контекстом
    });
} else {
    console.warn('Generate tasks/quiz button (#generateTasksButton) not found.');
}

// --- Прикрепление обработчика к кнопке "Дальше" ---
document.addEventListener('DOMContentLoaded', () => {
    // Кнопка submitAnswerButton больше не нужна
    if (nextQuestionButton) {
        nextQuestionButton.addEventListener('click', handleNextQuestion);
    } else {
        console.warn('Next question button (#nextQuestionButton) not found.');
    }
    // Старый обработчик для #submitAnswerButton УДАЛЕН
});
// ------------------------------------------------------

// Sanitize HTML function
function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }

// Инициализация при загрузке страницы
console.log("bethebest.js načten (v. Multiple Choice), Supabase klient inicializován.");
// Загрузка логов и проверка auth state произойдет в onAuthStateChange