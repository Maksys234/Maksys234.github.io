// dashboard/bethebest.js
// Версия с добавлением логики интерактивного квиза

// --- ИЗМЕНЕННЫЕ ДАННЫЕ ДЛЯ ПОДКЛЮЧЕНИЯ К НОВОЙ БАЗЕ SUPABASE ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
// --- КОНЕЦ ИЗМЕНЕННЫХ ДАННЫХ ---

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// HTML Elementy (Добавляем новые элементы для квиза)
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

// Старые элементы Gemini (оставляем для обратной совместимости, если нужно)
const generateTasksButton = document.getElementById('generateTasksButton');
const geminiTasksContainer = document.getElementById('geminiTasksContainer');
const geminiLoading = document.getElementById('geminiLoading');

// --- НОВЫЕ ЭЛЕМЕНТЫ UI ДЛЯ КВИЗА (Нужно будет добавить их в HTML) ---
const quizContainer = document.getElementById('quizContainer');         // Главный контейнер квиза
const questionDisplay = document.getElementById('questionDisplay');     // Место для вопроса
const userAnswerInput = document.getElementById('userAnswerInput');     // Поле ввода ответа
const submitAnswerButton = document.getElementById('submitAnswerButton'); // Кнопка "Ответить"
const feedbackArea = document.getElementById('feedbackArea');           // Область для обратной связи
const nextQuestionButton = document.getElementById('nextQuestionButton');   // Кнопка "Следующий вопрос"
const quizLoading = document.getElementById('quizLoading');             // Индикатор загрузки вопросов
// --------------------------------------------------------------------

// !!! ВАЖНО: API КЛЮЧ GEMINI - НЕБЕЗОПАСНО ДЛЯ ПРОДАКШЕНА !!!
const GEMINI_API_KEY = 'AIzaSyB4l6Yj9AjWfkG2Ob2LCAgTsnSwN-UZQcA'; // Используем твой ключ
const GEMINI_API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- НОВЫЕ ПЕРЕМЕННЫЕ СОСТОЯНИЯ КВИЗА ---
let generatedQuestions = [];
let currentQuestionIndex = -1;
let isLoadingQuestions = false;
let currentLogTextForQuiz = ''; // Храним текст лога, для которого генерируем вопросы
// ---------------------------------------

// Функция для zobrazení notifikací (без изменений)
function showNotification(message, type = 'info', duration = 3000) {
    if (!notificationArea) return;
    // ... (остальная часть функции без изменений)
    const notificationDiv = document.createElement('div');
    notificationDiv.className = `notification ${type}`;

    // Безопасное добавление текста
    notificationDiv.textContent = message;

    // Анимация появления (можно добавить класс)
     notificationDiv.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
     requestAnimationFrame(() => {
         notificationDiv.style.opacity = '1';
         notificationDiv.style.transform = 'translateX(0)';
     });

    notificationArea.appendChild(notificationDiv);

    // Анимация исчезновения и удаление
    if (duration > 0) {
        setTimeout(() => {
            notificationDiv.style.opacity = '0';
            notificationDiv.style.transform = 'translateX(120%)';
            // Удаляем элемент после завершения анимации
            notificationDiv.addEventListener('transitionend', () => notificationDiv.remove());
            // Запасной вариант удаления, если transitionend не сработает
            setTimeout(() => {
                 if (notificationDiv.parentElement) notificationDiv.remove();
            }, 600); // Чуть больше времени анимации
        }, duration);
    }
}


// Функция для přepínání mezi přihlašovacím a registračním formulářem (без изменений)
window.toggleAuthForms = () => {
    loginFormContainer.classList.toggle('hidden');
    registerFormContainer.classList.toggle('hidden');
};

// --- Autentizace (без изменений) ---
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginButton = loginForm.querySelector('button[type="submit"]');
    loginButton.disabled = true;
    loginButton.textContent = 'Přihlašuji...';

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        showNotification(`Chyba přihlášení: ${error.message}`, 'error');
    } else {
        showNotification('Přihlášení úspěšné!', 'success');
        loginForm.reset();
        // App Section станет видимым через onAuthStateChange
    }
    loginButton.disabled = false;
    loginButton.textContent = 'Přihlásit se';
});

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const registerButton = registerForm.querySelector('button[type="submit"]');
    registerButton.disabled = true;
    registerButton.textContent = 'Registruji...';

    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
        showNotification(`Chyba registrace: ${error.message}`, 'error');
    } else {
        showNotification('Registrace úspěšná! Zkontrolujte svůj e-mail pro potvrzení (pokud je nastaveno).', 'success');
        registerForm.reset();
        toggleAuthForms(); // Переключаем обратно на форму логина
    }
    registerButton.disabled = false;
    registerButton.textContent = 'Zaregistrovat se';
});

logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        showNotification(`Chyba odhlášení: ${error.message}`, 'error');
    } else {
        showNotification('Odhlášení úspěšné.', 'info');
        // Скрытие App Section и показ Auth Section произойдет через onAuthStateChange
        // Также сбросим состояние квиза при выходе
        resetQuizState();
        hideQuizUI();
    }
    // Кнопка будет скрыта вместе с appSection
});

// --- ИЗМЕНЕНИЕ ЛОГИКИ: Auth State Change ---
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session);
    if (session && session.user) {
        currentUser = session.user;
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        userEmailDisplay.textContent = session.user.email;
        loadLearningLogs(session.user.id); // Загружаем логи
        logoutButton.disabled = false;
        // Прячем квиз по умолчанию при логине
        hideQuizUI();
        resetQuizState();
         // Показываем кнопку "Vygenerovat úkoly" (которая теперь запускает квиз)
         if (generateTasksButton) {
            generateTasksButton.style.display = 'inline-flex'; // или 'block'
            generateTasksButton.disabled = false;
            generateTasksButton.textContent = 'Spustit kvíz k poslednímu záznamu';
         }
    } else {
        currentUser = null;
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
        userEmailDisplay.textContent = '';
        logsContainer.innerHTML = '<p>Přihlaste se, abyste mohli vidět a přidávat záznamy.</p>';
        // Прячем квиз при выходе
        hideQuizUI();
        resetQuizState();
         // Скрываем кнопку "Vygenerovat úkoly"
         if (generateTasksButton) {
            generateTasksButton.style.display = 'none';
         }
    }
});

// --- Práce se záznamy o učení (Изменения в обработчике формы) ---
learningLogForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const logText = learningInput.value.trim();

    if (!logText) {
        showNotification('Prosím, napiš, co ses naučil/a.', 'error');
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        showNotification('Pro uložení záznamu se musíš přihlásit.', 'error');
        return;
    }

    const submitButton = learningLogForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Ukládám...';

    // Прячем предыдущий квиз или сообщение об ошибке квиза
    hideQuizUI();
    resetQuizState();

    try {
        const { data, error } = await supabaseClient
            .from('learning_logs')
            .insert([{ user_id: user.id, log_text: logText }])
            .select();

        if (error) {
            throw error; // Передаем ошибку в catch
        } else {
            showNotification('Pokrok úspěšně uložen!', 'success');
            learningInput.value = '';
            currentLogTextForQuiz = logText; // Сохраняем текст ПОСЛЕДНЕГО лога для квиза
            loadLearningLogs(user.id); // Перезагружаем логи
            // --- НОВЫЙ ШАГ: Делаем кнопку "Spustit kvíz" активной ---
            if (generateTasksButton) {
                generateTasksButton.style.display = 'inline-flex'; // Показываем кнопку
                generateTasksButton.disabled = false;
                generateTasksButton.textContent = 'Spustit kvíz k poslednímu záznamu';
            }
            // --- КОНЕЦ НОВОГО ШАГА ---
        }
    } catch (err) {
        console.error('Chyba ukládání záznamu:', err);
        showNotification(`Nepodařilo se uložit záznam: ${err.message}`, 'error');
        // Скрываем кнопку квиза в случае ошибки сохранения лога
        if (generateTasksButton) generateTasksButton.style.display = 'none';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
});

// Загрузка логов (без изменений)
async function loadLearningLogs(userId) {
    if (!userId) {
        logsContainer.innerHTML = '<p>Přihlaste se pro zobrazení záznamů.</p>';
        return;
    }
    logsContainer.innerHTML = '<div class="loader">Načítání záznamů...</div>';
    try {
        const { data, error } = await supabaseClient
            .from('learning_logs')
            .select('log_text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            logsContainer.innerHTML = '';
            // Сохраняем самый последний лог для возможного запуска квиза по кнопке
             currentLogTextForQuiz = data[0].log_text;
            data.forEach(log => {
                const logElement = document.createElement('div');
                logElement.classList.add('log-entry');
                logElement.innerHTML = `
                    <p>${sanitizeHTML(log.log_text.replace(/\n/g, '<br>'))}</p>
                    <small>Datum: ${new Date(log.created_at).toLocaleString('cs-CZ')}</small>
                `;
                logsContainer.appendChild(logElement);
                 // Анимация появления (если есть)
                requestAnimationFrame(() => {
                    logElement.style.opacity = '1';
                    logElement.style.transform = 'translateY(0)';
                });
            });
            // Показываем кнопку для запуска квиза, если логи загружены
             if (generateTasksButton) {
                generateTasksButton.style.display = 'inline-flex';
                generateTasksButton.disabled = false;
                generateTasksButton.textContent = 'Spustit kvíz k poslednímu záznamu';
             }
        } else {
            logsContainer.innerHTML = '<p>Zatím nemáš žádné záznamy.</p>';
            if (generateTasksButton) generateTasksButton.style.display = 'none'; // Прячем кнопку, если нет логов
        }
    } catch (err) {
        console.error('Chyba načítání záznamů:', err);
        logsContainer.innerHTML = `<p style="color: var(--error-color);">Chyba načítání: ${err.message}</p>`;
        if (generateTasksButton) generateTasksButton.style.display = 'none';
    }
}

// --- СТАРАЯ ИНТЕГРАЦИЯ GEMINI ДЛЯ ЗАДАНИЙ (Оставляем для совместимости) ---
// Эта функция ГЕНЕРИРУЕТ ЗАДАНИЯ, а не вопросы для квиза
async function generateTasksWithGeminiDirectly(learningContext) {
    // Старый промпт остается без изменений
    const prompt = `
Na základě následujících záznamů o učení studenta, vygeneruj 3-5 konkrétních cvičných úkolů nebo otázek, které mu pomohou prohloubit porozumění a procvičit si naučené. Úkoly by měly být formulovány jasně a stručně. Odpověď vrať jako HTML nečíslovaný seznam (<ul><li>První úkol</li><li>Druhý úkol</li>...</ul>). Nepoužívej Markdown.

Kontext učení:
---
${learningContext}
---
Příklady úkolů:`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6 } // Можно настроить
    };

    try {
        const response = await fetch(GEMINI_API_URL_BASE, { // Используем базовый URL
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) { /* ... (обработка ошибок без изменений) ... */ }

        const data = await response.json();

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts?.[0]?.text) {
            // ... (обработка ответа без изменений) ...
             if (data.candidates[0].finishReason === "SAFETY") {
                 console.warn("Gemini odpověď zablokována kvůli bezpečnostním nastavením:", data.candidates[0].safetyRatings);
                 return "<p>Odpověď byla zablokována bezpečnostními filtry Gemini. Zkuste přeformulovat své záznamy o učení.</p>";
             }
             // Очистка от markdown, если он случайно появился
             let tasksHtml = data.candidates[0].content.parts[0].text;
             tasksHtml = tasksHtml.replace(/^```html\s*/, '').replace(/\s*```$/, '');
             return tasksHtml;
        } else if (data.promptFeedback?.blockReason) { /* ... (обработка ошибок без изменений) ... */ }
        else { /* ... (обработка ошибок без изменений) ... */ }

    } catch (error) {
        console.error('Chyba při přímém volání Gemini API:', error);
        throw error; // Передаем ошибку дальше
    }
}

// Обработчик для СТАРОЙ кнопки "Vygenerovat úkoly" (если она еще используется где-то)
// В НОВОЙ ЛОГИКЕ эта кнопка будет запускать квиз, см. ниже.
if (generateTasksButton) {
    generateTasksButton.addEventListener('click', async () => {
        // --- НОВАЯ ЛОГИКА: ЗАПУСК КВИЗА ---
        console.log('Start Quiz button clicked.');
        if (!currentLogTextForQuiz) {
            showNotification('Nejprve uložte záznam o učení.', 'warning');
            return;
        }
        if (isLoadingQuestions) {
            showNotification('Otázky se již načítají...', 'info');
            return;
        }
        await startQuizSession(currentLogTextForQuiz);
        // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

        /* --- СТАРАЯ ЛОГИКА (закомментирована, но оставлена) ---
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) { showNotification('Pro generování úkolů se musíš přihlásit.', 'error'); return; }
        if (!geminiLoading || !geminiTasksContainer) return;

        geminiLoading.classList.remove('hidden');
        geminiTasksContainer.innerHTML = '';
        generateTasksButton.disabled = true;
        generateTasksButton.textContent = 'Generuji...';

        try {
            const { data: logs, error: logError } = await supabaseClient
                .from('learning_logs')
                .select('log_text')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(3);

            if (logError) throw new Error(`Chyba načítání záznamů pro Gemini: ${logError.message}`);
            if (!logs || logs.length === 0) { showNotification('Nemáš zatím žádné záznamy pro analýzu Gemini.', 'info'); geminiTasksContainer.innerHTML = '<p>Nejprve přidej nějaké záznamy o svém učení.</p>'; return; }

            const learningContext = logs.map(log => log.log_text).join("\n---\n");
            const tasksHtml = await generateTasksWithGeminiDirectly(learningContext);
            geminiTasksContainer.innerHTML = tasksHtml;
            showNotification('Úkoly od Gemini vygenerovány!', 'success');

        } catch (error) {
            console.error('Celková chyba při generování úkolů Gemini:', error);
            showNotification(error.message || 'Nastala chyba při generování úkolů.', 'error');
            geminiTasksContainer.innerHTML = `<p>Nastala chyba: ${error.message}. Zkuste to prosím znovu.</p>`;
        } finally {
            geminiLoading.classList.add('hidden');
            generateTasksButton.disabled = false;
            generateTasksButton.textContent = 'Vygenerovat úkoly';
        }
        */
    });
}

// --- НОВЫЕ ФУНКЦИИ ДЛЯ КВИЗА ---

/**
 * Сбрасывает состояние квиза.
 */
function resetQuizState() {
    generatedQuestions = [];
    currentQuestionIndex = -1;
    isLoadingQuestions = false;
    // Очистка полей UI, связанных с квизом, выполняется в hideQuizUI
}

/**
 * Скрывает UI элементы квиза и очищает их содержимое.
 */
function hideQuizUI() {
    if (quizContainer) quizContainer.style.display = 'none';
    if (questionDisplay) questionDisplay.innerHTML = '';
    if (userAnswerInput) userAnswerInput.value = '';
    if (feedbackArea) feedbackArea.innerHTML = '';
    if (nextQuestionButton) nextQuestionButton.style.display = 'none';
    if (submitAnswerButton) submitAnswerButton.style.display = 'none';
    if (quizLoading) quizLoading.classList.add('hidden');
    console.log('Quiz UI hidden and cleared.');
}

/**
 * Генерирует вопросы и ответы с помощью Gemini API.
 * @param {string} learningContext Текст из лога обучения.
 * @returns {Promise<Array|null>} Массив объектов вопросов или null в случае ошибки.
 */
async function generateQuestionsForQuiz(learningContext) {
    const prompt = `
Na základě následujících záznamů o učení studenta ("${learningContext}"), vygeneruj 3-5 konkrétních otázek, které otestují jeho porozumění zaznamenané látce. Ke každé otázce uveď i očekávanou správnou odpověď a krátké vysvětlení, proč je odpověď správná nebo jaký je klíčový koncept. Vrať odpověď POUZE jako JSON pole objektů. Každý objekt v poli musí obsahovat klíče: "question" (string, text otázky), "answer" (string, text správné odpovědi), "explanation" (string, text vysvětlení). Nepoužívej Markdown mimo JSON. JSON formát musí být striktně dodržen.

Příklad formátu JSON pole:
[
  {
    "question": "Jaký je vzorec pro výpočet obsahu trojúhelníku?",
    "answer": "S = (a * v_a) / 2",
    "explanation": "Obsah trojúhelníku je polovina součinu délky strany a výšky k této straně."
  },
  {
    "question": "Co znamená pojem 'ekvivalentní úprava' u rovnic?",
    "answer": "Úprava, která nezmění množinu řešení rovnice.",
    "explanation": "Ekvivalentní úpravy zahrnují přičtení/odečtení stejného čísla/výrazu k oběma stranám nebo násobení/dělení obou stran nenulovým číslem/výrazem."
  }
]`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, topP: 0.9 } // Настройки для более точных вопросов
    };

    try {
        console.log('Sending request to Gemini for questions...');
        const response = await fetch(GEMINI_API_URL_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Chyba od Gemini API:', errorData, 'Status:', response.status);
            throw new Error(`Chyba ${response.status} od Gemini API: ${errorData?.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('Raw Gemini response:', JSON.stringify(data)); // Логируем сырой ответ

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts?.[0]?.text) {
             if (data.candidates[0].finishReason === "SAFETY") {
                 console.warn("Gemini odpověď (otázky) zablokována bezpečnostními filtry.");
                 throw new Error("Odpověď AI byla zablokována bezpečnostními filtry.");
             }
             let jsonString = data.candidates[0].content.parts[0].text;
             // Очистка от возможных ```json ... ```
             const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
             if (jsonMatch && jsonMatch[1]) {
                 jsonString = jsonMatch[1];
             }

             try {
                 const parsedQuestions = JSON.parse(jsonString);
                 // Проверка структуры
                 if (Array.isArray(parsedQuestions) && parsedQuestions.every(q => q.question && q.answer && q.explanation)) {
                     console.log('Successfully parsed questions:', parsedQuestions);
                     return parsedQuestions;
                 } else {
                     console.error('Invalid JSON structure received:', parsedQuestions);
                     throw new Error('AI vrátilo otázky v neočekávaném formátu.');
                 }
             } catch (parseError) {
                 console.error('Failed to parse JSON response:', parseError, 'Raw JSON string:', jsonString);
                 throw new Error('Nepodařilo se zpracovat odpověď AI s otázkami.');
             }
        } else if (data.promptFeedback?.blockReason) {
             console.warn("Gemini dotaz (otázky) zablokován:", data.promptFeedback.blockReason);
             throw new Error(`Dotaz na otázky byl blokován AI filtrem (${data.promptFeedback.blockReason}).`);
        } else {
             console.warn('Gemini API (otázky) nevrátilo očekávaný formát textu:', data);
             throw new Error('AI nevrátilo žádné otázky.');
        }

    } catch (error) {
        console.error('Chyba při volání Gemini API pro otázky:', error);
        throw error; // Передаем ошибку дальше
    }
}

/**
 * Запускает сессию квиза.
 * @param {string} logText Текст из последнего лога.
 */
async function startQuizSession(logText) {
    if (!logText) {
        showNotification('Chybí text záznamu pro vytvoření kvízu.', 'error');
        return;
    }
    if (!quizContainer || !quizLoading) {
        console.error('Quiz container or loading elements not found');
        return;
    }
    console.log('Starting quiz session for log:', logText.substring(0, 50) + '...');
    resetQuizState(); // Сбрасываем предыдущее состояние
    isLoadingQuestions = true;
    quizContainer.style.display = 'block'; // Показываем контейнер квиза
    quizLoading.classList.remove('hidden'); // Показываем загрузчик
    if(questionDisplay) questionDisplay.innerHTML = ''; // Очищаем область вопроса
    if(feedbackArea) feedbackArea.innerHTML = ''; // Очищаем обратную связь
    if(submitAnswerButton) submitAnswerButton.style.display = 'none'; // Прячем кнопки
    if(nextQuestionButton) nextQuestionButton.style.display = 'none';
    if(userAnswerInput) userAnswerInput.style.display = 'none';
    if(generateTasksButton) generateTasksButton.disabled = true; // Блокируем кнопку запуска

    try {
        generatedQuestions = await generateQuestionsForQuiz(logText);
        if (generatedQuestions && generatedQuestions.length > 0) {
            currentQuestionIndex = 0;
            displayCurrentQuestion();
        } else {
            throw new Error('Nebyly vygenerovány žádné otázky.');
        }
    } catch (error) {
        console.error('Failed to start quiz session:', error);
        showNotification(`Chyba při generování kvízu: ${error.message}`, 'error');
        hideQuizUI(); // Скрываем UI квиза при ошибке
        if(generateTasksButton) generateTasksButton.disabled = false; // Разблокируем кнопку
    } finally {
        isLoadingQuestions = false;
        if (quizLoading) quizLoading.classList.add('hidden'); // Скрываем загрузчик
    }
}

/**
 * Отображает текущий вопрос.
 */
function displayCurrentQuestion() {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= generatedQuestions.length) {
        console.log('Invalid question index or quiz finished.');
        displayQuizEnd();
        return;
    }
    if (!questionDisplay || !userAnswerInput || !submitAnswerButton || !feedbackArea || !nextQuestionButton) {
        console.error('Required quiz UI elements not found');
        return;
    }

    const question = generatedQuestions[currentQuestionIndex];
    questionDisplay.innerHTML = `<p><strong>Otázka ${currentQuestionIndex + 1}/${generatedQuestions.length}:</strong></p><p>${sanitizeHTML(question.question)}</p>`;
    userAnswerInput.value = '';
    feedbackArea.innerHTML = '';
    userAnswerInput.style.display = 'block';
    submitAnswerButton.style.display = 'inline-flex'; // Показываем кнопку "Ответить"
    submitAnswerButton.disabled = false; // Активируем ее
    nextQuestionButton.style.display = 'none'; // Скрываем кнопку "Дальше"
    userAnswerInput.focus();
    console.log(`Displayed question ${currentQuestionIndex + 1}`);
}

/**
 * Обрабатывает отправку ответа пользователя.
 */
function handleAnswerSubmit() {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= generatedQuestions.length) return;
    if (!userAnswerInput || !feedbackArea || !submitAnswerButton || !nextQuestionButton) return;

    const userAnswer = userAnswerInput.value.trim();
    if (userAnswer === '') {
        showNotification('Prosím, zadejte odpověď.', 'warning');
        return;
    }

    const currentQuestion = generatedQuestions[currentQuestionIndex];
    const correctAnswer = currentQuestion.answer.trim();
    const explanation = currentQuestion.explanation.trim();

    // Простая проверка ответа (можно усложнить)
    const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();

    let feedbackHTML = '';
    if (isCorrect) {
        feedbackHTML = `<div class="feedback correct"><i class="fas fa-check-circle"></i> <strong>Správně!</strong><p>${sanitizeHTML(explanation)}</p></div>`;
        showNotification('Výborně!', 'success', 2000);
    } else {
        feedbackHTML = `<div class="feedback incorrect"><i class="fas fa-times-circle"></i> <strong>Špatně.</strong><p>Správná odpověď: <strong>${sanitizeHTML(correctAnswer)}</strong></p><p>Vysvětlení: ${sanitizeHTML(explanation)}</p></div>`;
        showNotification('Nevadí, zkus další!', 'info', 2000);
    }

    feedbackArea.innerHTML = feedbackHTML;
    submitAnswerButton.disabled = true; // Блокируем кнопку "Ответить"
    submitAnswerButton.style.display = 'none'; // Можно скрыть
    nextQuestionButton.style.display = 'inline-flex'; // Показываем кнопку "Дальше"
    nextQuestionButton.focus();
    console.log(`Answer submitted for question ${currentQuestionIndex + 1}. Correct: ${isCorrect}`);
}

/**
 * Переходит к следующему вопросу.
 */
function handleNextQuestion() {
    if (!nextQuestionButton || !submitAnswerButton) return;

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
    if (!questionDisplay || !userAnswerInput || !submitAnswerButton || !feedbackArea || !nextQuestionButton) return;

    questionDisplay.innerHTML = `<h2><i class="fas fa-flag-checkered"></i> Kvíz dokončen!</h2><p>Dobrá práce!</p>`;
    userAnswerInput.style.display = 'none';
    submitAnswerButton.style.display = 'none';
    feedbackArea.innerHTML = '';
    nextQuestionButton.style.display = 'none';
     // Можно снова показать кнопку "Spustit kvíz"
     if (generateTasksButton && currentLogTextForQuiz) {
        generateTasksButton.disabled = false;
        generateTasksButton.textContent = 'Spustit kvíz znovu';
     }
    console.log('Quiz finished.');
}

// --- ПРИКРЕПЛЕНИЕ ОБРАБОТЧИКОВ К НОВЫМ КНОПКАМ ---
// Важно: Эти кнопки должны существовать в вашем HTML файле (`bethebest.html`)
document.addEventListener('DOMContentLoaded', () => {
    if (submitAnswerButton) {
        submitAnswerButton.addEventListener('click', handleAnswerSubmit);
    } else {
        console.warn('Submit answer button (#submitAnswerButton) not found.');
    }

    if (nextQuestionButton) {
        nextQuestionButton.addEventListener('click', handleNextQuestion);
    } else {
        console.warn('Next question button (#nextQuestionButton) not found.');
    }
});
// ------------------------------------------------------

// --- СТАРАЯ ФУНКЦИЯ (Оставляем) ---
// Inicializace (загрузка логов при старте, если пользователь залогинен)
console.log("bethebest.js načten, Supabase klient inicializován.");
// Изначальная загрузка логов и проверка состояния пользователя происходит в onAuthStateChange

// Sanitize HTML function (если она не глобальная)
function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }