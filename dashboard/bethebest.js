// dashboard/bethebest.js
// Verze: 7.0 - Kyber-kalendář, detailní logy, task feed

// --- Konstanty a Supabase klient ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
let supabaseClient = null;

// --- HTML Elementy ---
let authSection, appSection, loginFormContainer, registerFormContainer, notificationArea,
    loginForm, registerForm, logoutButton, userEmailDisplay,
    calendarGrid, monthYearDisplay, prevMonthBtn, nextMonthBtn,
    learningLogModal, closeLogModalBtn, dailyLearningLogForm, logSelectedDateInput,
    logDateDisplay, logTopicInput, logDetailsInput,
    tasksFeed, loadMoreTasksButton, tasksFeedLoader;

// --- API Klíč pro Gemini (POZOR: V produkci řešit bezpečněji!) ---
const GEMINI_API_KEY = 'AIzaSyB4l6Yj9AjWfkG2Ob2LCAgTsnSwN-UZQcA'; // Nahraďte skutečným klíčem
const GEMINI_API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- Stav Aplikace ---
let currentUser = null;
let currentDisplayedMonth = new Date().getMonth();
let currentDisplayedYear = new Date().getFullYear();
let learningLogsCache = {}; // Cache pro logy: {'YYYY-MM-DD': {topic: '...', details: '...'}}
let generatedTasks = [];
let lastTaskTopicContext = ""; // Pro kontext generování dalších úkolů

// --- Funkce ---

function cacheDOMElements() {
    authSection = document.getElementById('authSection');
    appSection = document.getElementById('appSection');
    // Login/Register (převzato, pokud existuje v HTML)
    loginFormContainer = document.getElementById('loginFormContainer');
    registerFormContainer = document.getElementById('registerFormContainer');
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');

    notificationArea = document.getElementById('notificationArea');
    logoutButton = document.getElementById('logoutButton');
    userEmailDisplay = document.getElementById('userEmailDisplay');

    // Kalendář
    calendarGrid = document.getElementById('calendarGrid');
    monthYearDisplay = document.getElementById('monthYearDisplay');
    prevMonthBtn = document.getElementById('prevMonthBtn');
    nextMonthBtn = document.getElementById('nextMonthBtn');

    // Modální okno pro logy
    learningLogModal = document.getElementById('learningLogModal');
    closeLogModalBtn = document.getElementById('closeLogModalBtn');
    dailyLearningLogForm = document.getElementById('dailyLearningLogForm');
    logSelectedDateInput = document.getElementById('logSelectedDate');
    logDateDisplay = document.getElementById('logDateDisplay');
    logTopicInput = document.getElementById('logTopic');
    logDetailsInput = document.getElementById('logDetails');

    // Task Feed
    tasksFeed = document.getElementById('tasksFeed');
    loadMoreTasksButton = document.getElementById('loadMoreTasksButton');
    // Předpokládáme, že tasksFeed je také kontejner pro loader
    tasksFeedLoader = tasksFeed; // Pokud je loader součástí tasksFeed
    console.log("[DEBUG] DOM elements cached.");
}

function showNotification(message, type = 'info', duration = 3500) {
    if (!notificationArea) { console.warn("Notification area not found"); return; }
    const notificationDiv = document.createElement('div');
    // Jednoduchá implementace notifikace, lze vylepšit styly
    notificationDiv.className = `toast ${type}`; // Předpokládá existující styly .toast .success .error
    notificationDiv.innerHTML = `<span>${sanitizeHTML(message)}</span>`;
    notificationArea.appendChild(notificationDiv);
    setTimeout(() => { notificationDiv.remove(); }, duration);
}

window.toggleAuthForms = () => {
    if (loginFormContainer && registerFormContainer) {
        loginFormContainer.classList.toggle('hidden');
        registerFormContainer.classList.toggle('hidden');
    }
};
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
    }

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
                if (typeof toggleAuthForms === 'function') toggleAuthForms();
            } catch (err) {
                console.error('[DEBUG] Register error:', err);
                showNotification(`Registrace selhala: ${err.message}`, 'error');
            } finally {
                if (button) { button.disabled = false; button.textContent = 'Zaregistrovat se'; }
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            if (!supabaseClient) return;
            logoutButton.disabled = true;
            try {
                const { error } = await supabaseClient.auth.signOut();
                if (error) throw error;
                showNotification('Odhlášení úspěšné.', 'info');
                // UI se aktualizuje přes onAuthStateChange
            } catch (err) {
                console.error('[DEBUG] Logout error:', err);
                showNotification(`Odhlášení selhalo: ${err.message}`, 'error');
                logoutButton.disabled = false;
            }
        });
    }
}

// --- Logika Kalendáře ---
function renderCalendar() {
    if (!calendarGrid || !monthYearDisplay) return;
    calendarGrid.innerHTML = ''; // Vyčistit starý kalendář
    const firstDayOfMonth = new Date(currentDisplayedYear, currentDisplayedMonth, 1);
    const lastDayOfMonth = new Date(currentDisplayedYear, currentDisplayedMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    monthYearDisplay.textContent = `${firstDayOfMonth.toLocaleString('cs-CZ', { month: 'long' })} ${currentDisplayedYear}`;

    let startingDay = firstDayOfMonth.getDay(); // 0=Ne, 1=Po, ...
    startingDay = (startingDay === 0) ? 6 : startingDay - 1; // Převod na Po=0, Ne=6

    // Prázdné buňky pro dny před prvním dnem měsíce
    for (let i = 0; i < startingDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('calendar-day-cell', 'empty-cell');
        calendarGrid.appendChild(emptyCell);
    }

    // Buňky pro dny v měsíci
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('calendar-day-cell');
        const dateStr = `${currentDisplayedYear}-${String(currentDisplayedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dayCell.dataset.date = dateStr;

        const dayNumberSpan = document.createElement('span');
        dayNumberSpan.classList.add('day-number');
        dayNumberSpan.textContent = day;
        dayCell.appendChild(dayNumberSpan);

        const log = learningLogsCache[dateStr];
        if (log) {
            dayCell.classList.add('has-log');
            const preview = document.createElement('div');
            preview.classList.add('log-preview');
            preview.innerHTML = `<strong>${sanitizeHTML(log.topic) || 'Téma'}</strong><br>${sanitizeHTML(log.details)?.substring(0, 50) || 'Žádné detaily'}...`;
            dayCell.appendChild(preview);
        }

        dayCell.addEventListener('click', () => openLearningLogModal(dateStr));
        calendarGrid.appendChild(dayCell);
    }
}

function changeMonth(offset) {
    currentDisplayedMonth += offset;
    if (currentDisplayedMonth < 0) {
        currentDisplayedMonth = 11;
        currentDisplayedYear--;
    } else if (currentDisplayedMonth > 11) {
        currentDisplayedMonth = 0;
        currentDisplayedYear++;
    }
    loadLogsForMonthAndRenderCalendar();
}

async function loadLogsForMonthAndRenderCalendar() {
    if (!currentUser) return;
    const firstDay = new Date(currentDisplayedYear, currentDisplayedMonth, 1);
    const lastDay = new Date(currentDisplayedYear, currentDisplayedMonth + 1, 0);

    console.log(`[DEBUG] Načítání logů pro ${firstDay.toISOString().split('T')[0]} až ${lastDay.toISOString().split('T')[0]}`);

    try {
        const { data, error } = await supabaseClient
            .from('learning_logs_detailed') // Používáme novou tabulku
            .select('log_date, topic, details')
            .eq('user_id', currentUser.id)
            .gte('log_date', firstDay.toISOString().split('T')[0])
            .lte('log_date', lastDay.toISOString().split('T')[0]);

        if (error) throw error;

        // Vyčistit cache pro aktuální měsíc před naplněním novými daty
        Object.keys(learningLogsCache).forEach(key => {
            if (key.startsWith(`${currentDisplayedYear}-${String(currentDisplayedMonth + 1).padStart(2, '0')}`)) {
                delete learningLogsCache[key];
            }
        });

        data.forEach(log => {
            learningLogsCache[log.log_date] = { topic: log.topic, details: log.details };
        });
        console.log("[DEBUG] Logy pro měsíc načteny:", learningLogsCache);
        renderCalendar();
    } catch (err) {
        console.error("[DEBUG] Chyba načítání logů:", err);
        showNotification("Chyba při načítání záznamů z kalendáře.", "error");
    }
}


// --- Modální okno a Ukládání Logů ---
function openLearningLogModal(dateStr) {
    if (!logSelectedDateInput || !logDateDisplay || !logTopicInput || !logDetailsInput || !learningLogModal) return;
    logSelectedDateInput.value = dateStr;
    const dateObj = new Date(dateStr + 'T00:00:00'); // Zajistit správné parsování data
    logDateDisplay.textContent = dateObj.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });

    const existingLog = learningLogsCache[dateStr];
    if (existingLog) {
        logTopicInput.value = existingLog.topic || '';
        logDetailsInput.value = existingLog.details || '';
    } else {
        logTopicInput.value = '';
        logDetailsInput.value = '';
    }
    learningLogModal.style.display = "block";
    logTopicInput.focus();
}

function closeLearningLogModal() {
    if (learningLogModal) learningLogModal.style.display = "none";
}

async function handleDailyLogSubmit(event) {
    event.preventDefault();
    if (!currentUser || !dailyLearningLogForm || !logSelectedDateInput || !logTopicInput || !logDetailsInput) return;

    const date = logSelectedDateInput.value;
    const topic = logTopicInput.value.trim();
    const details = logDetailsInput.value.trim();

    if (!topic) {
        showNotification("Vyplňte prosím hlavní téma.", "warning");
        return;
    }

    const submitButton = dailyLearningLogForm.querySelector('button[type="submit"]');
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = "Ukládám..."; }

    try {
        const { data, error } = await supabaseClient
            .from('learning_logs_detailed')
            .upsert({
                user_id: currentUser.id,
                log_date: date,
                topic: topic,
                details: details
            }, { onConflict: 'user_id, log_date' }) // Aktualizuje, pokud záznam pro daného uživatele a datum již existuje
            .select();

        if (error) throw error;

        showNotification("Záznam úspěšně uložen!", "success");
        learningLogsCache[date] = { topic, details }; // Aktualizovat cache
        renderCalendar(); // Překreslit kalendář s novým/upraveným záznamem
        closeLearningLogModal();
        // Po uložení nového logu, aktualizovat a zobrazit úkoly
        await fetchAndDisplayTasks(true);
    } catch (err) {
        console.error("[DEBUG] Chyba ukládání denního logu:", err);
        showNotification(`Uložení záznamu selhalo: ${err.message}`, "error");
    } finally {
        if (submitButton) { submitButton.disabled = false; submitButton.textContent = "Uložit záznam"; }
    }
}


// --- Logika Generování Úkolů (Gemini) ---
async function generateTasksFromTopics(topicsContext, existingTasksCount = 0) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'AIzaSyB4l6Yj9AjWfkG2Ob2LCAgTsnSwN-UZQcA' || GEMINI_API_KEY.startsWith("YOUR_")) {
        console.warn("[DEBUG] Chybí platný Gemini API Klíč. Generování úkolů přeskočeno.");
        return [{ title: "Ukázkový úkol", description: "Nastavte si Gemini API klíč pro generování úkolů na míru.", topic: "Konfigurace" }];
    }
    if (!topicsContext) {
        console.warn("[DEBUG] Žádný kontext témat pro generování úkolů.");
        return [];
    }

    const prompt = `
        Jsi AI asistent pro vytváření vzdělávacích úkolů. Na základě následujících témat, která se student nedávno učil, vygeneruj 3-5 krátkých, praktických úkolů nebo otázek.
        Pokud již bylo vygenerováno ${existingTasksCount} úkolů, zkus vytvořit odlišné úkoly nebo se zaměř na pokročilejší aspekty témat.
        Formát odpovědi: JSON pole objektů. Každý objekt musí mít klíče: "title" (stručný název úkolu), "description" (krátký popis nebo otázka), "topic" (jedno z témat, ke kterému se úkol vztahuje).

        Nedávno studovaná témata:
        ---
        ${topicsContext}
        ---

        Příklad formátu JSON pole:
        [
          {"title": "Rovnice: Procvičení", "description": "Vyřešte následující lineární rovnici: 2x + 5 = 11", "topic": "Lineární rovnice"},
          {"title": "Python: Smyčka for", "description": "Napište Python kód, který vypíše čísla od 1 do 10 pomocí smyčky for.", "topic": "Python smyčky"}
        ]
    `;

    try {
        const response = await fetch(GEMINI_API_URL_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, topP: 0.9 }
            })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[DEBUG] Gemini API Error Response:', errorData);
            throw new Error(`Chyba Gemini API ${response.status}: ${errorData?.error?.message || response.statusText}`);
        }
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('AI nevrátilo žádný text pro úkoly.');

        let jsonString = text;
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch?.[1]) jsonString = jsonMatch[1];

        const parsedTasks = JSON.parse(jsonString);
        if (Array.isArray(parsedTasks) && parsedTasks.every(t => t.title && t.description && t.topic)) {
            return parsedTasks;
        } else {
            throw new Error('Neplatná struktura JSON odpovědi od AI pro úkoly.');
        }
    } catch (error) {
        console.error("[DEBUG] Chyba generování úkolů přes Gemini:", error);
        showNotification(`Chyba generování úkolů: ${error.message}`, "error");
        return []; // Vrátit prázdné pole v případě chyby
    }
}

async function fetchAndDisplayTasks(forceRefresh = false) {
    if (!currentUser || !tasksFeed || !tasksFeedLoader) return;

    if (forceRefresh) {
        generatedTasks = [];
        lastTaskTopicContext = "";
    }

    tasksFeedLoader.classList.add('visible-loader');
    if (generatedTasks.length === 0) { // Zobrazit loader pouze pokud žádné úkoly nejsou
      tasksFeed.innerHTML = '<div class="loader visible-loader">Načítám úkoly...</div>';
    }
    if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');


    try {
        // Získat poslední N naučených témat pro kontext
        const { data: logs, error: logError } = await supabaseClient
            .from('learning_logs_detailed')
            .select('topic, details, log_date')
            .eq('user_id', currentUser.id)
            .order('log_date', { ascending: false })
            .limit(10); // Kontext z posledních 10 záznamů

        if (logError) throw logError;

        if (logs && logs.length > 0) {
            const topicsContext = logs.map(log => `- ${log.topic}: ${log.details ? log.details.substring(0, 100) + '...' : '(bez detailů)'}`).join("\n");
            if (topicsContext === lastTaskTopicContext && !forceRefresh) {
                console.log("[DEBUG] Kontext témat se nezměnil, není třeba znovu generovat úkoly.");
                displayTasks(); // Zobrazit již existující
                tasksFeedLoader.classList.remove('visible-loader');
                if (tasksFeed.innerHTML === '<div class="loader visible-loader">Načítám úkoly...</div>') tasksFeed.innerHTML = '';
                return;
            }
            lastTaskTopicContext = topicsContext;
            const newTasks = await generateTasksFromTopics(topicsContext, generatedTasks.length);
            generatedTasks.push(...newTasks);
        }

        displayTasks();

    } catch (err) {
        console.error("[DEBUG] Chyba při načítání nebo generování úkolů:", err);
        tasksFeed.innerHTML = '<p class="error-message">Nepodařilo se načíst úkoly.</p>';
    } finally {
        tasksFeedLoader.classList.remove('visible-loader');
         if (tasksFeed.innerHTML.includes('Načítám úkoly...')) { // Pokud tam byl jen loader
            if (generatedTasks.length === 0) {
                 tasksFeed.innerHTML = '<p style="text-align:center; color: var(--text-muted);">Nejsou k dispozici žádné úkoly. Přidejte nejprve nějaké studijní záznamy.</p>';
            } else {
                tasksFeed.innerHTML = ''; // Vyčistit loader pokud se mají zobrazit úkoly
                displayTasks(); // Znovu zavolat pro případ, že mezitím doběhlo generování
            }
        }
        // Zobrazit "Load More" pouze pokud jsou nějaké úkoly (zde by měla být logika pro další načítání, pokud by API podporovalo stránkování)
        // Prozatím skryjeme, protože Gemini generuje dávku.
        if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
    }
}

function displayTasks() {
    if (!tasksFeed) return;
    if (generatedTasks.length === 0 && !tasksFeed.querySelector('.loader')) { // Zkontrolujte, zda není loader již přítomen
        tasksFeed.innerHTML = '<p style="text-align:center; color: var(--text-muted);">Nejsou k dispozici žádné úkoly. Zkuste přidat studijní záznam.</p>';
        return;
    }
    // Pokud je zobrazen loader a máme úkoly, vyčistíme loader před přidáním úkolů
    if (tasksFeed.querySelector('.loader')) {
        tasksFeed.innerHTML = '';
    }

    generatedTasks.forEach(task => {
        // Zabraňte duplicitnímu přidání úkolu, pokud by se ID nějak generovalo
        if (task.id && document.getElementById(`task-${task.id}`)) return;

        const taskElement = document.createElement('div');
        taskElement.classList.add('task-item');
        if(task.id) taskElement.id = `task-${task.id}`; // Pokud AI vrátí ID

        taskElement.innerHTML = `
            <h3>${sanitizeHTML(task.title)}</h3>
            <p>${sanitizeHTML(task.description)}</p>
            <small class="task-topic">Téma: ${sanitizeHTML(task.topic)}</small>
        `;
        // Přidat na začátek seznamu (novější nahoře) nebo na konec
        tasksFeed.appendChild(taskElement); // Nebo tasksFeed.prepend(taskElement);
    });
}


// --- Inicializace Aplikace ---
async function initializeApp() {
    console.log("[DEBUG] initializeApp v7.0 - Start");
    cacheDOMElements();
    if (!initializeSupabase()) return;

    // Inicializace UI pro přihlášení/registraci
    if (authSection && loginFormContainer && registerFormContainer) {
        // Zobrazit přihlašovací formulář jako výchozí
        loginFormContainer.classList.remove('hidden');
        registerFormContainer.classList.add('hidden');
    } else if (authSection) {
        // Pokud je jen authSection, možná se formuláře načítají dynamicky
        authSection.innerHTML = `
            <div id="loginFormContainer">
                <h2>Přihlášení</h2>
                <form id="loginForm">
                    <div><label for="loginEmail">E-mail:</label><input type="email" id="loginEmail" required autocomplete="email"></div>
                    <div><label for="loginPassword">Heslo:</label><input type="password" id="loginPassword" required autocomplete="current-password"></div>
                    <button type="submit">Přihlásit se</button>
                </form>
                <p class="auth-toggle" onclick="toggleAuthForms()">Nemáš účet? Zaregistruj se</p>
            </div>
            <div id="registerFormContainer" class="hidden">
                <h2>Registrace</h2>
                <form id="registerForm">
                    <div><label for="registerEmail">E-mail:</label><input type="email" id="registerEmail" required autocomplete="email"></div>
                    <div><label for="registerPassword">Heslo:</label><input type="password" id="registerPassword" required autocomplete="new-password"></div>
                    <button type="submit">Zaregistrovat se</button>
                </form>
                <p class="auth-toggle" onclick="toggleAuthForms()">Už máš účet? Přihlas se</p>
            </div>`;
        // Znovu cache formulářů po jejich vytvoření
        loginFormContainer = document.getElementById('loginFormContainer');
        registerFormContainer = document.getElementById('registerFormContainer');
        loginForm = document.getElementById('loginForm');
        registerForm = document.getElementById('registerForm');
    }

    setupAuthListeners(); // Nastavit listenery i když formuláře nejsou viditelné

    // Kalendář Listeners
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => changeMonth(1));
    if (closeLogModalBtn) closeLogModalBtn.addEventListener('click', closeLearningLogModal);
    if (dailyLearningLogForm) dailyLearningLogForm.addEventListener('submit', handleDailyLogSubmit);
    // Task feed listener (prozatím není potřeba, pokud loadMore řeší vše)
    // if (loadMoreTasksButton) loadMoreTasksButton.addEventListener('click', () => fetchAndDisplayTasks(false));


    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log('[DEBUG Auth Change] Event:', event, 'Session Active:', !!session);
        if (session && session.user) {
            currentUser = session.user;
            console.log('[DEBUG Auth Change] Uživatel přihlášen:', currentUser.id);
            if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
            if (authSection) authSection.classList.add('hidden');
            if (appSection) appSection.classList.remove('hidden');

            await loadLogsForMonthAndRenderCalendar(); // Načíst logy pro aktuální měsíc
            await fetchAndDisplayTasks(true); // Načíst úkoly poprvé

        } else {
            currentUser = null;
            console.log('[DEBUG Auth Change] Uživatel odhlášen nebo session neaktivní.');
            if (userEmailDisplay) userEmailDisplay.textContent = '';
            if (authSection) authSection.classList.remove('hidden');
            if (appSection) appSection.classList.add('hidden');
            learningLogsCache = {}; // Vyčistit cache
            generatedTasks = [];    // Vyčistit úkoly
            if(calendarGrid) calendarGrid.innerHTML = '';
            if(tasksFeed) tasksFeed.innerHTML = '<p style="text-align:center; color: var(--text-muted);">Pro zobrazení úkolů se přihlaste.</p>';
        }
    });

    console.log("[DEBUG] initializeApp - Konec");
}

function initializeSupabase() {
    console.log("[DEBUG] Initializing Supabase...");
    try {
        if (!window.supabase?.createClient) throw new Error("Supabase library not loaded.");
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        if (!supabaseClient) throw new Error("Supabase client creation failed.");
        console.log("[DEBUG] Supabase client initialized.");
        return true;
    } catch (e) {
        console.error("[DEBUG] Supabase init failed:", e);
        showNotification("Chyba připojení k databázi. Obnovte stránku.", "error", 0);
        return false;
    }
}

// --- Spuštění aplikace ---
document.addEventListener('DOMContentLoaded', initializeApp);