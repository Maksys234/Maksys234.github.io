// dashboard/bethebest.js
// Версия с Multiple Choice (Checkboxes), бесконечной лентой и авто-стартом

// --- Константы и Supabase клиент (без изменений) ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- HTML Элементы (Изменения для чекбоксов) ---
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
// ... (формы, userInfo, logoutButton - без изменений)
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
const generateTasksButton = document.getElementById('generateTasksButton'); // Можно убрать или переназначить
const geminiTasksContainer = document.getElementById('geminiTasksContainer');
const geminiLoading = document.getElementById('geminiLoading'); // Старый лоадер

// --- ЭЛЕМЕНТЫ UI ДЛЯ КВИЗА ---
const quizContainer = document.getElementById('quizContainer');
const questionDisplay = document.getElementById('questionDisplay');
const answerCheckboxesContainer = document.getElementById('answerCheckboxesContainer'); // ИЗМЕНЕНО: Контейнер для чекбоксов
const submitAnswerButton = document.getElementById('submitAnswerButton'); // ВОЗВРАЩЕНО: Кнопка подтверждения выбора
const feedbackArea = document.getElementById('feedbackArea');
const nextQuestionButton = document.getElementById('nextQuestionButton');
const quizLoading = document.getElementById('quizLoading');
// --------------------------------------------------------------------

// --- API Ключ (Без изменений) ---
const GEMINI_API_KEY = 'AIzaSyB4l6Yj9AjWfkG2Ob2LCAgTsnSwN-UZQcA'; // Твой ключ
const GEMINI_API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- Состояние Квиза (Без изменений) ---
let generatedQuestions = [];
let currentQuestionIndex = -1;
let isLoadingQuestions = false;
let fullLearningContextForQuiz = '';

// --- Функции (showNotification, toggleAuthForms - без изменений) ---
function showNotification(message, type = 'info', duration = 3000) { /* ... без изменений ... */ }
window.toggleAuthForms = () => { /* ... без изменений ... */ };

// --- Autentizace (Login, Register, Logout - без изменений) ---
loginForm.addEventListener('submit', async (event) => { /* ... без изменений ... */ });
registerForm.addEventListener('submit', async (event) => { /* ... без изменений ... */ });
logoutButton.addEventListener('click', async () => { /* ... добавлено resetQuizState() и hideQuizUI() ... */ });

// --- ИЗМЕНЕНО: Auth State Change (Авто-запуск квиза) ---
supabaseClient.auth.onAuthStateChange(async (event, session) => { // Добавлено async
    console.log('Auth state changed:', event, session);
    if (session && session.user) {
        currentUser = session.user;
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        userEmailDisplay.textContent = session.user.email;
        logoutButton.disabled = false;
        hideQuizUI(); // Скрываем UI квиза по умолчанию
        resetQuizState();

        // Загружаем логи и контекст
        await loadLearningLogs(session.user.id);

        // Если есть контекст, запускаем квиз автоматически
        if (fullLearningContextForQuiz) {
            console.log('User logged in and has learning logs, starting quiz automatically.');
            await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz);
        } else {
            console.log('User logged in, but no learning logs found. Quiz not started.');
            // Можно показать сообщение, что нужно сначала добавить записи
             if(quizContainer) quizContainer.style.display = 'block'; // Показать контейнер
             if(questionDisplay) questionDisplay.innerHTML = '<p>Vítejte! Přidejte záznam o učení, aby se zde objevily otázky k procvičení.</p>'; // Сообщение
        }

    } else {
        currentUser = null;
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
        userEmailDisplay.textContent = '';
        logsContainer.innerHTML = '<p>Přihlaste se, abyste mohli vidět a přidávat záznamy.</p>';
        if (generateTasksButton) generateTasksButton.style.display = 'none';
        hideQuizUI();
        resetQuizState();
        fullLearningContextForQuiz = ''; // Очищаем контекст при выходе
    }
});

// --- Сохранение логов (без изменений, авто-старт квиза убран отсюда) ---
learningLogForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const logText = learningInput.value.trim();
    if (!logText) { showNotification('Napiš, co ses naučil/a.', 'error'); return; }
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { showNotification('Pro uložení se přihlas.', 'error'); return; }

    const submitButton = learningLogForm.querySelector('button[type="submit"]');
    submitButton.disabled = true; submitButton.textContent = 'Ukládám...';
    // Не запускаем квиз автоматически после сохранения,
    // пользователь продолжит через кнопку "Další otázka" или обновит страницу

    try {
        const { data, error } = await supabaseClient.from('learning_logs').insert([{ user_id: user.id, log_text: logText }]).select();
        if (error) throw error;
        showNotification('Pokrok uložen! Nové poznatky budou zahrnuty v dalších otázkách.', 'success');
        learningInput.value = '';
        await loadLearningLogs(user.id); // Перезагружаем логи для обновления контекста
    } catch (err) {
        console.error('Chyba ukládání záznamu:', err);
        showNotification(`Uložení selhalo: ${err.message}`, 'error');
    } finally {
        submitButton.disabled = false; submitButton.textContent = 'Uložit pokrok';
    }
});

// --- Загрузка логов (без изменений, сохраняет ВЕСЬ контекст) ---
async function loadLearningLogs(userId) {
    if (!userId) { logsContainer.innerHTML = '<p>Přihlaste se.</p>'; return; }
    logsContainer.innerHTML = '<div class="loader">Načítám záznamy...</div>';
    try {
        const { data, error } = await supabaseClient
            .from('learning_logs')
            .select('log_text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }); // Сначала новые
        if (error) throw error;

        if (data && data.length > 0) {
            logsContainer.innerHTML = '';
            fullLearningContextForQuiz = data
                .slice(0, 20) // Ограничим контекст последними 20 записями
                .reverse() // Перевернем, чтобы старые были первыми для AI
                .map(log => `Datum: ${new Date(log.created_at).toLocaleDateString('cs-CZ')}\nText: ${log.log_text}`)
                .join("\n\n---\n\n");
            console.log('Learning context loaded (truncated):', fullLearningContextForQuiz.substring(0, 100) + '...');

            data.forEach(log => { /* ... отображение логов без изменений ... */ });
        } else {
            logsContainer.innerHTML = '<p>Zatím žádné záznamy.</p>';
            fullLearningContextForQuiz = '';
        }
    } catch (err) { /* ... обработка ошибок ... */ }
}

// --- Старая функция для задач (оставляем) ---
async function generateTasksWithGeminiDirectly(learningContext) { /* ... без изменений ... */ }

// --- НОВАЯ ФУНКЦИЯ: Генерация Multiple Choice, поддержка нескольких ответов ---
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

    const requestBody = { /* ... (как раньше) ... */ };
    try {
        // ... (API вызов как раньше) ...
        const response = await fetch(GEMINI_API_URL_BASE, { /* ... */ });
        if (!response.ok) { /* ... */ throw new Error(`API Error ${response.status}`); }
        const data = await response.json();
        // ... (обработка safety и blockReason как раньше) ...

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts?.[0]?.text) {
            let jsonString = data.candidates[0].content.parts[0].text;
            const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch && jsonMatch[1]) { jsonString = jsonMatch[1]; }

            try {
                const parsedQuestions = JSON.parse(jsonString);
                // --- УЛУЧШЕННАЯ ВАЛИДАЦИЯ ---
                if (Array.isArray(parsedQuestions) && parsedQuestions.every(q =>
                    q.question && typeof q.question === 'string' &&
                    Array.isArray(q.options) && q.options.length === 5 && q.options.every(opt => typeof opt === 'string') &&
                    Array.isArray(q.answer) && q.answer.length > 0 && q.answer.every(ans => typeof ans === 'string' && ["A", "B", "C", "D", "E"].includes(ans.toUpperCase())) &&
                    q.explanation && typeof q.explanation === 'string'
                )) {
                    console.log('Successfully parsed valid MC questions (multi-answer):', parsedQuestions);
                    // Приводим буквы ответов к верхнему регистру для согласованности
                    return parsedQuestions.map(q => ({ ...q, answer: q.answer.map(a => a.toUpperCase()) }));
                } else {
                    console.error('Invalid MC JSON structure received (multi-answer):', parsedQuestions);
                    throw new Error('AI vrátilo MC otázky v neočekávaném formátu.');
                }
                // --- КОНЕЦ УЛУЧШЕННОЙ ВАЛИДАЦИИ ---
            } catch (parseError) { /* ... */ throw new Error('Nepodařilo se zpracovat MC odpověď AI.'); }
        } else { /* ... */ throw new Error('AI nevrátilo žádné MC otázky.'); }
    } catch (error) { console.error('Chyba při volání Gemini API pro MC otázky:', error); throw error; }
}

// --- Логика Квиза (Обновлена для Checkbox и бесконечности) ---

function resetQuizState() { /* ... без изменений ... */ }
function hideQuizUI() { /* ... обновлено для скрытия чекбоксов и кнопки Submit ... */
    if (quizContainer) quizContainer.style.display = 'none';
    if (questionDisplay) questionDisplay.innerHTML = '';
    if (answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = ''; // Очищаем чекбоксы
    if (submitAnswerButton) submitAnswerButton.style.display = 'none';     // Скрываем Submit
    if (feedbackArea) feedbackArea.innerHTML = '';
    if (nextQuestionButton) nextQuestionButton.style.display = 'none';
    if (quizLoading) quizLoading.classList.add('hidden');
    console.log('Quiz UI hidden and cleared.');
}

/**
 * Запускает квиз или отображает первый вопрос.
 */
async function fetchAndDisplayFirstQuestions(context) {
    if (!context) { showNotification('Chybí kontext pro vytvoření kvízu.', 'warning'); return; }
    if (isLoadingQuestions) { return; }
    if (!quizContainer || !quizLoading) { return; }

    console.log('Fetching first batch of questions...');
    resetQuizState();
    isLoadingQuestions = true;
    quizContainer.style.display = 'block';
    quizLoading.classList.remove('hidden');
    if(questionDisplay) questionDisplay.innerHTML = '';
    if(feedbackArea) feedbackArea.innerHTML = '';
    if(answerCheckboxesContainer) answerCheckboxesContainer.innerHTML = '';
    if(submitAnswerButton) submitAnswerButton.style.display = 'none';
    if(nextQuestionButton) nextQuestionButton.style.display = 'none';

    try {
        generatedQuestions = await generateMultipleChoiceQuestions(context);
        if (generatedQuestions && generatedQuestions.length > 0) {
            currentQuestionIndex = 0;
            displayCurrentQuestion();
        } else {
            throw new Error('Nebyly vygenerovány žádné otázky.');
        }
    } catch (error) {
        console.error('Failed to fetch first questions:', error);
        showNotification(`Chyba při generování kvízu: ${error.message}`, 'error');
        hideQuizUI();
    } finally {
        isLoadingQuestions = false;
        if (quizLoading) quizLoading.classList.add('hidden');
    }
}

/**
 * Загружает больше вопросов и добавляет их в конец.
 */
async function fetchMoreQuestions() {
    if (!fullLearningContextForQuiz || isLoadingQuestions) return;
    console.log("Fetching more questions...");
    isLoadingQuestions = true;
    // Можно показать маленький индикатор загрузки рядом с кнопкой "Дальше"
    if(nextQuestionButton) nextQuestionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Načítám...';
    if(nextQuestionButton) nextQuestionButton.disabled = true;

    try {
        const newQuestions = await generateMultipleChoiceQuestions(fullLearningContextForQuiz);
        if (newQuestions && newQuestions.length > 0) {
            generatedQuestions.push(...newQuestions); // Добавляем новые вопросы в конец
            console.log(`Added ${newQuestions.length} new questions. Total: ${generatedQuestions.length}`);
            // Сразу показываем следующий вопрос (который теперь существует)
            displayCurrentQuestion();
        } else {
            // Если не удалось загрузить новые, просто показываем старый (или ничего, если это была последняя попытка?)
             showNotification("Nepodařilo se načíst další otázky.", "warning");
             // Позволяем пользователю попробовать еще раз? Или останавливаем? Пока просто разблокируем кнопку.
             if(nextQuestionButton) nextQuestionButton.disabled = false;
             if(nextQuestionButton) nextQuestionButton.innerHTML = 'Další otázka <i class="fas fa-arrow-right"></i>';
        }
    } catch (error) {
        console.error("Failed to fetch more questions:", error);
        showNotification(`Chyba při načítání dalších otázek: ${error.message}`, 'error');
         if(nextQuestionButton) nextQuestionButton.disabled = false;
         if(nextQuestionButton) nextQuestionButton.innerHTML = 'Další otázka <i class="fas fa-arrow-right"></i>';
    } finally {
        isLoadingQuestions = false;
         // Восстанавливаем кнопку "Дальше" только если мы не перешли к новому вопросу успешно
         if(nextQuestionButton && nextQuestionButton.textContent.includes('Načítám')) {
             nextQuestionButton.disabled = false;
             nextQuestionButton.innerHTML = 'Další otázka <i class="fas fa-arrow-right"></i>';
         }
    }
}

/**
 * Отображает текущий вопрос и чекбоксы для ответа.
 */
function displayCurrentQuestion() {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= generatedQuestions.length) {
        console.error('Invalid question index in displayCurrentQuestion:', currentQuestionIndex);
        // Возможно, тут стоит попробовать загрузить еще вопросы?
        fetchMoreQuestions();
        return;
    }
    if (!questionDisplay || !answerCheckboxesContainer || !submitAnswerButton || !feedbackArea || !nextQuestionButton) {
        console.error('Required quiz UI elements not found for displaying MC question');
        return;
    }

    const question = generatedQuestions[currentQuestionIndex];
    questionDisplay.innerHTML = `<p><strong>Otázka ${currentQuestionIndex + 1}:</strong></p><p>${sanitizeHTML(question.question)}</p>`;
    feedbackArea.innerHTML = '';
    answerCheckboxesContainer.innerHTML = ''; // Очищаем предыдущие варианты
    nextQuestionButton.style.display = 'none'; // Прячем кнопку "Дальше"

    // Создаем чекбоксы для вариантов ответа
    const choices = ["A", "B", "C", "D", "E"];
    question.options.forEach((optionText, index) => {
        const choiceLetter = choices[index];
        const checkboxId = `q${currentQuestionIndex}_choice${choiceLetter}`;

        const label = document.createElement('label');
        label.classList.add('checkbox-label'); // Класс для стилизации
        label.htmlFor = checkboxId;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.name = `question_${currentQuestionIndex}`; // Группа чекбоксов для вопроса
        checkbox.value = choiceLetter;
        checkbox.dataset.choice = choiceLetter; // Сохраняем букву

        const span = document.createElement('span');
        span.textContent = ` ${choiceLetter}) ${optionText}`; // Пробел перед буквой

        label.appendChild(checkbox);
        label.appendChild(span);
        answerCheckboxesContainer.appendChild(label);
    });

    answerCheckboxesContainer.style.display = 'flex'; // Показываем контейнер с чекбоксами
    answerCheckboxesContainer.style.flexDirection = 'column';
    answerCheckboxesContainer.style.gap = '10px';
    submitAnswerButton.style.display = 'inline-flex'; // Показываем кнопку "Odpovědět"
    submitAnswerButton.disabled = false;
    console.log(`Displayed MC question ${currentQuestionIndex + 1}`);
}

/**
 * Сравнивает два массива строк, порядок не важен.
 */
function arraysContainSameElements(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    const sortedArr1 = [...arr1].sort();
    const sortedArr2 = [...arr2].sort();
    return sortedArr1.every((value, index) => value === sortedArr2[index]);
}


/**
 * Обрабатывает подтверждение выбора чекбоксов.
 */
function handleAnswerSubmit() {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= generatedQuestions.length) return;
    if (!answerCheckboxesContainer || !feedbackArea || !submitAnswerButton || !nextQuestionButton) return;

    const selectedCheckboxes = answerCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
    const selectedChoices = Array.from(selectedCheckboxes).map(cb => cb.value.toUpperCase());

    if (selectedChoices.length === 0) {
        showNotification('Prosím, vyberte alespoň jednu odpověď.', 'warning');
        return;
    }

    const currentQuestion = generatedQuestions[currentQuestionIndex];
    const correctAnswers = currentQuestion.answer; // Это уже массив букв в верхнем регистре
    const explanation = currentQuestion.explanation;

    // Сравнение массивов выбранных и правильных ответов
    const isFullyCorrect = arraysContainSameElements(selectedChoices, correctAnswers);
    // Частично правильно: есть хотя бы одно совпадение, но не все выбрано ИЛИ выбрано что-то лишнее
    const correctSelected = selectedChoices.filter(choice => correctAnswers.includes(choice));
    const isPartiallyCorrect = !isFullyCorrect && correctSelected.length > 0;

    let feedbackHTML = '';
    let feedbackClass = '';

    // Визуальное выделение и блокировка чекбоксов
    const allCheckboxes = answerCheckboxesContainer.querySelectorAll('input[type="checkbox"]');
    allCheckboxes.forEach(checkbox => {
        checkbox.disabled = true;
        const choice = checkbox.value.toUpperCase();
        const label = checkbox.closest('.checkbox-label');
        if (correctAnswers.includes(choice)) {
            label?.classList.add('correct-answer-label'); // Отмечаем правильные
        }
        if (selectedChoices.includes(choice)) {
            if (correctAnswers.includes(choice)) {
                label?.classList.add('selected-correct-label'); // Выбранный правильный
            } else {
                label?.classList.add('selected-incorrect-label'); // Выбранный неправильный
            }
        }
    });

    // Формирование отзыва
    if (isFullyCorrect) {
        feedbackClass = 'correct';
        feedbackHTML = `<div class="feedback ${feedbackClass}"><i class="fas fa-check-circle"></i> <strong>Správně!</strong><p>${sanitizeHTML(explanation)}</p></div>`;
        showNotification('Výborně!', 'success', 2000);
    } else if (isPartiallyCorrect) {
        feedbackClass = 'partial'; // Нужен стиль для partial
        feedbackHTML = `<div class="feedback ${feedbackClass}"><i class="fas fa-exclamation-triangle"></i> <strong>Částečně správně.</strong><p>Správné odpovědi: <strong>${correctAnswers.join(', ')}</strong>.</p><p>Vysvětlení: ${sanitizeHTML(explanation)}</p></div>`;
        showNotification('Skoro! Podívej se na vysvětlení.', 'info', 2500);
    } else { // incorrect
        feedbackClass = 'incorrect';
        feedbackHTML = `<div class="feedback ${feedbackClass}"><i class="fas fa-times-circle"></i> <strong>Špatně.</strong><p>Správné odpovědi: <strong>${correctAnswers.join(', ')}</strong>.</p><p>Vysvětlení: ${sanitizeHTML(explanation)}</p></div>`;
        showNotification('Nevadí, zkus další!', 'info', 2500);
    }

    feedbackArea.innerHTML = feedbackHTML;
    submitAnswerButton.disabled = true;
    submitAnswerButton.style.display = 'none'; // Скрываем кнопку "Odpovědět"
    nextQuestionButton.style.display = 'inline-flex'; // Показываем кнопку "Дальше"
    nextQuestionButton.disabled = false;
    nextQuestionButton.focus();
    console.log(`Answer submitted for question ${currentQuestionIndex + 1}. Selected: ${selectedChoices.join(',')}. Correct: ${correctAnswers.join(',')}. FullyCorrect: ${isFullyCorrect}. PartiallyCorrect: ${isPartiallyCorrect}`);
}

/**
 * Переходит к следующему вопросу или загружает новые.
 */
function handleNextQuestion() {
    if (!nextQuestionButton) return;
    nextQuestionButton.disabled = true;
    currentQuestionIndex++;

    if (currentQuestionIndex >= generatedQuestions.length) {
        console.log("Reached end of current questions batch, fetching more...");
        fetchMoreQuestions(); // Загружаем новые вопросы
    } else {
        displayCurrentQuestion(); // Показываем следующий из текущего набора
    }
}

// --- Прикрепление обработчиков ---
document.addEventListener('DOMContentLoaded', () => {
    if (submitAnswerButton) {
        submitAnswerButton.addEventListener('click', handleAnswerSubmit);
    } else { console.warn('Submit answer button (#submitAnswerButton) not found.'); }

    if (nextQuestionButton) {
        nextQuestionButton.addEventListener('click', handleNextQuestion);
    } else { console.warn('Next question button (#nextQuestionButton) not found.'); }

    // Старый обработчик для #generateTasksButton теперь запускает квиз
    if (generateTasksButton) {
         generateTasksButton.addEventListener('click', async () => {
             console.log('Start/Restart Quiz button clicked.');
             if (!fullLearningContextForQuiz) {
                 showNotification('Nejprve uložte záznam o učení nebo obnovte stránku.', 'warning');
                 return;
             }
             if (isLoadingQuestions) {
                 showNotification('Otázky se již načítají...', 'info');
                 return;
             }
             await fetchAndDisplayFirstQuestions(fullLearningContextForQuiz); // Всегда начинаем с новыми вопросами
         });
     } else { console.warn('Generate tasks/quiz button (#generateTasksButton) not found.'); }

});

// Sanitize HTML function
function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }

// Инициализация
console.log("bethebest.js načten (v. Multi-Choice, Endless), Supabase klient inicializován.");
// Загрузка логов и авто-старт квиза произойдет в onAuthStateChange