// app.js

// Замени на свои учетные данные Supabase
const SUPABASE_URL = 'https://orjivlyliqxyffsvaqzu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yaml2bHlsaXF4eWZmc3ZhcXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2OTc5NTIsImV4cCI6MjA2MjI3Mzk1Mn0.Au1RyA2mcFZgO5vvBhz4yJO1tqjcSQZyLOZcDu58uLo';

const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Аутентификация (Очень упрощенный пример) ---
// В реальном приложении нужна полноценная система логина/регистрации
// Supabase предоставляет удобные методы для этого: supabase.auth.signUp(), supabase.auth.signInWithPassword() и т.д.
// Пока что будем считать, что у нас есть некий ID пользователя (замени на реальный механизм)
let FAKE_USER_ID = 'user_fixed_id_for_testing'; // Замени это после настройки аутентификации

async function checkUser() {
    // Попытка получить текущего пользователя
    // В Supabase v2:
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        document.getElementById('userName').textContent = user.email || user.id;
        FAKE_USER_ID = user.id; // Используем ID реального пользователя
        console.log('Пользователь:', user);
        loadLearningLogs(); // Загружаем логи для аутентифицированного пользователя
    } else {
        document.getElementById('userName').textContent = 'Гость (требуется вход)';
        console.log('Пользователь не аутентифицирован.');
        // Здесь можно перенаправить на страницу входа или показать форму входа/регистрации
        // Для простоты, пока оставляем возможность добавлять логи от имени "Гостя" с FAKE_USER_ID,
        // но в идеале нужно требовать вход.
        // Для примера, если пользователь не вошел, можно скрыть форму добавления логов.
        // document.getElementById('learningLogForm').style.display = 'none';
        // document.getElementById('logsContainer').innerHTML = '<p>Войдите, чтобы видеть и добавлять записи.</p>';

        // Пока для теста, если нет пользователя, все равно загрузим логи (если они есть для FAKE_USER_ID)
        loadLearningLogs();
    }
}


// --- Работа с записями об обучении ---
const learningLogForm = document.getElementById('learningLogForm');
const learningInput = document.getElementById('learningInput');
const logsContainer = document.getElementById('logsContainer');

learningLogForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Предотвращаем стандартную отправку формы
    const logText = learningInput.value.trim();

    if (!logText) {
        alert('Пожалуйста, напиши, что ты выучил.');
        return;
    }

    // Проверяем, вошел ли пользователь (для этого FAKE_USER_ID должен быть обновлен реальным ID)
    const { data: { user } } = await supabase.auth.getUser();
    let userIdToLog = FAKE_USER_ID; // По умолчанию

    if (user) {
        userIdToLog = user.id;
    } else {
        // Можно либо запретить запись без входа, либо использовать ID по умолчанию для анонимных (не рекомендуется для персонализации)
        alert('Ты не вошел в систему. Запись будет сохранена как гостевая (если разрешено).');
        // Для полноценной работы требуется вход.
    }


    // Сохраняем в Supabase
    // Убедись, что у тебя есть таблица 'learning_logs' с колонками:
    // - id (uuid, primary key, можно автогенерировать)
    // - user_id (uuid или text, соответствует ID пользователя из auth.users)
    // - log_text (text)
    // - created_at (timestamp with time zone, default now())
    try {
        const { data, error } = await supabase
            .from('learning_logs') // Название твоей таблицы
            .insert([
                {
                    // user_id: FAKE_USER_ID, // Замени на реальный ID пользователя после настройки аутентификации
                    user_id: userIdToLog,
                    log_text: logText
                    // created_at будет добавлен автоматически Supabase, если так настроено в таблице
                }
            ])
            .select(); // Чтобы получить обратно вставленные данные

        if (error) {
            console.error('Ошибка сохранения записи:', error);
            alert(`Не удалось сохранить запись: ${error.message}`);
            return;
        }

        console.log('Запись успешно сохранена:', data);
        alert('Прогресс сохранен!');
        learningInput.value = ''; // Очищаем поле ввода
        loadLearningLogs(); // Перезагружаем список записей
    } catch (err) {
        console.error('Критическая ошибка при сохранении:', err);
        alert('Произошла критическая ошибка при сохранении.');
    }
});

// Загрузка и отображение записей
async function loadLearningLogs() {
    const { data: { user } } = await supabase.auth.getUser();
    let userIdToLoad = FAKE_USER_ID;

    if (user) {
        userIdToLoad = user.id;
    } else {
        logsContainer.innerHTML = '<p>Войдите, чтобы просмотреть свои записи.</p>';
        // Если не хотим показывать ничего для неавторизованных:
        // return;
    }


    logsContainer.innerHTML = '<p>Загрузка записей...</p>'; // Сообщение о загрузке

    try {
        const { data, error } = await supabase
            .from('learning_logs')
            .select('log_text, created_at')
            .eq('user_id', userIdToLoad) // Фильтруем по ID пользователя
            .order('created_at', { ascending: false }); // Сортируем по дате, новые сверху

        if (error) {
            console.error('Ошибка загрузки записей:', error);
            logsContainer.innerHTML = `<p style="color: red;">Ошибка загрузки: ${error.message}</p>`;
            return;
        }

        if (data && data.length > 0) {
            logsContainer.innerHTML = ''; // Очищаем контейнер
            data.forEach(log => {
                const logElement = document.createElement('div');
                logElement.classList.add('log-entry');
                logElement.innerHTML = `
                    <p>${log.log_text}</p>
                    <small>Дата: ${new Date(log.created_at).toLocaleString()}</small>
                `;
                logsContainer.appendChild(logElement);
            });
        } else {
            logsContainer.innerHTML = '<p>У тебя пока нет записей. Начни учиться и записывай свой прогресс!</p>';
        }
    } catch (err) {
        console.error('Критическая ошибка при загрузке записей:', err);
        logsContainer.innerHTML = `<p style="color: red;">Критическая ошибка при загрузке.</p>`;
    }
}

// --- Инициализация ---
// Проверяем статус пользователя при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    checkUser();
    // Тут можно добавить слушателей для кнопок логина/логаута, если они есть на странице
    // Например:
    // const loginButton = document.getElementById('loginButton');
    // if (loginButton) loginButton.addEventListener('click', () => { /* логика входа */ });
});