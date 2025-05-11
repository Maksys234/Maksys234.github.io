// dashboard/bethebest.js
// Verze: 7.2 - Ještě robustnější zpracování chyb a logování při načítání úkolů

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
    tasksFeed, loadMoreTasksButton;

// --- API Klíč pro Gemini (POZOR: V produkci řešit bezpečněji!) ---
const GEMINI_API_KEY = 'AIzaSyB4l6Yj9AjWfkG2Ob2LCAgTsnSwN-UZQcA'; // Nahraďte skutečným klíčem
const GEMINI_API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- Stav Aplikace ---
let currentUser = null;
let currentDisplayedMonth = new Date().getMonth();
let currentDisplayedYear = new Date().getFullYear();
let learningLogsCache = {};
let generatedTasks = [];
let lastTaskTopicContext = "";
let isLoadingTasks = false;
let isUserSessionInitialized = false; // Přidáno pro sledování inicializace session

// --- Funkce ---

function cacheDOMElements() {
    authSection = document.getElementById('authSection');
    appSection = document.getElementById('appSection');
    loginFormContainer = document.getElementById('loginFormContainer');
    registerFormContainer = document.getElementById('registerFormContainer');
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');
    notificationArea = document.getElementById('notificationArea');
    logoutButton = document.getElementById('logoutButton');
    userEmailDisplay = document.getElementById('userEmailDisplay');
    calendarGrid = document.getElementById('calendarGrid');
    monthYearDisplay = document.getElementById('monthYearDisplay');
    prevMonthBtn = document.getElementById('prevMonthBtn');
    nextMonthBtn = document.getElementById('nextMonthBtn');
    learningLogModal = document.getElementById('learningLogModal');
    closeLogModalBtn = document.getElementById('closeLogModalBtn');
    dailyLearningLogForm = document.getElementById('dailyLearningLogForm');
    logSelectedDateInput = document.getElementById('logSelectedDate');
    logDateDisplay = document.getElementById('logDateDisplay');
    logTopicInput = document.getElementById('logTopic');
    logDetailsInput = document.getElementById('logDetails');
    tasksFeed = document.getElementById('tasksFeed');
    loadMoreTasksButton = document.getElementById('loadMoreTasksButton');
    console.log("[DEBUG v7.2 Cache] DOM elements cached.");
}

function showNotification(message, type = 'info', duration = 3500) {
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
        <button class="toast-close">&times;</button>`;
    
    notificationDiv.querySelector('.toast-close').onclick = () => {
        notificationDiv.style.opacity = '0';
        notificationDiv.style.transform = 'translateX(120%)';
        setTimeout(() => { if (notificationDiv.parentElement) notificationDiv.remove(); }, 600);
    };

    notificationArea.appendChild(notificationDiv);
    requestAnimationFrame(() => {
        notificationDiv.style.opacity = '1';
        notificationDiv.style.transform = 'translateX(0)';
    });

    if (duration > 0) {
        setTimeout(() => {
            notificationDiv.style.opacity = '0';
            notificationDiv.style.transform = 'translateX(120%)';
            const removeHandler = () => { if (notificationDiv.parentElement) notificationDiv.remove(); notificationDiv.removeEventListener('transitionend', removeHandler); };
            notificationDiv.addEventListener('transitionend', removeHandler);
            setTimeout(() => { if (notificationDiv.parentElement) notificationDiv.remove(); }, 600);
        }, duration);
    }
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
                console.error('[DEBUG v7.2 Auth] Login error:', err);
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
                console.error('[DEBUG v7.2 Auth] Register error:', err);
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
            } catch (err) {
                console.error('[DEBUG v7.2 Auth] Logout error:', err);
                showNotification(`Odhlášení selhalo: ${err.message}`, 'error');
                logoutButton.disabled = false;
            }
        });
    }
}

function renderCalendar() {
    if (!calendarGrid || !monthYearDisplay) {
        console.error("[Calendar v7.2] Chybí elementy kalendáře.");
        return;
    }
    calendarGrid.innerHTML = '';
    const firstDayOfMonth = new Date(currentDisplayedYear, currentDisplayedMonth, 1);
    const lastDayOfMonth = new Date(currentDisplayedYear, currentDisplayedMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    monthYearDisplay.textContent = `${firstDayOfMonth.toLocaleString('cs-CZ', { month: 'long' })} ${currentDisplayedYear}`;

    let startingDay = firstDayOfMonth.getDay();
    startingDay = (startingDay === 0) ? 6 : startingDay - 1;

    for (let i = 0; i < startingDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('calendar-day-cell', 'empty-cell');
        calendarGrid.appendChild(emptyCell);
    }

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
            preview.innerHTML = `<strong>${sanitizeHTML(log.topic) || 'Téma'}</strong><br>${sanitizeHTML(log.details)?.substring(0, 50) || ''}...`;
            dayCell.appendChild(preview);
        }

        dayCell.addEventListener('click', () => openLearningLogModal(dateStr));
        calendarGrid.appendChild(dayCell);
    }
     if (calendarGrid.querySelectorAll('.has-log').length === 0) {
        console.log(`[Calendar v7.2] Pro ${monthYearDisplay.textContent} nebyly nalezeny žádné záznamy.`);
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
    if (!currentUser || !supabaseClient) return;
    const firstDay = new Date(currentDisplayedYear, currentDisplayedMonth, 1);
    const lastDay = new Date(currentDisplayedYear, currentDisplayedMonth + 1, 0);

    console.log(`[DEBUG v7.2 LogsCal] Načítání logů pro ${firstDay.toISOString().split('T')[0]} až ${lastDay.toISOString().split('T')[0]}`);

    try {
        const { data, error } = await supabaseClient
            .from('learning_logs_detailed')
            .select('log_date, topic, details')
            .eq('user_id', currentUser.id)
            .gte('log_date', firstDay.toISOString().split('T')[0])
            .lte('log_date', lastDay.toISOString().split('T')[0]);

        if (error) throw error;

        Object.keys(learningLogsCache).forEach(key => {
            if (key.startsWith(`${currentDisplayedYear}-${String(currentDisplayedMonth + 1).padStart(2, '0')}`)) {
                delete learningLogsCache[key];
            }
        });

        data.forEach(log => {
            learningLogsCache[log.log_date] = { topic: log.topic, details: log.details };
        });
        console.log("[DEBUG v7.2 LogsCal] Logy pro měsíc načteny:", learningLogsCache);
        renderCalendar();
    } catch (err) {
        console.error("[DEBUG v7.2 LogsCal] Chyba načítání logů:", err);
        showNotification("Chyba při načítání záznamů z kalendáře.", "error");
        renderCalendar();
    }
}

function openLearningLogModal(dateStr) {
    if (!logSelectedDateInput || !logDateDisplay || !logTopicInput || !logDetailsInput || !learningLogModal) return;
    logSelectedDateInput.value = dateStr;
    const dateObj = new Date(dateStr + 'T00:00:00Z'); // Přidat Z pro UTC, aby se předešlo problémům s časovou zónou
    logDateDisplay.textContent = dateObj.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Prague' });

    const existingLog = learningLogsCache[dateStr];
    logTopicInput.value = existingLog?.topic || '';
    logDetailsInput.value = existingLog?.details || '';
    
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
            .upsert({ user_id: currentUser.id, log_date: date, topic: topic, details: details }, { onConflict: 'user_id, log_date' })
            .select();

        if (error) throw error;

        showNotification("Záznam úspěšně uložen!", "success");
        learningLogsCache[date] = { topic, details };
        renderCalendar();
        closeLearningLogModal();
        await fetchAndDisplayTasks(true);
    } catch (err) {
        console.error("[DEBUG v7.2 LogSubmit] Chyba ukládání denního logu:", err);
        showNotification(`Uložení záznamu selhalo: ${err.message}`, "error");
    } finally {
        if (submitButton) { submitButton.disabled = false; submitButton.textContent = "Uložit záznam"; }
    }
}

async function generateTasksFromTopics(topicsContext, existingTasksCount = 0) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'AIzaSyB4l6Yj9AjWfkG2Ob2LCAgTsnSwN-UZQcA' || GEMINI_API_KEY.startsWith("YOUR_")) {
        console.warn("[GeminiTasks v7.2] Chybí platný Gemini API Klíč. Vracím ukázkové úkoly.");
        return [{ title: "Ukázkový úkol: Nastavení API", description: "Nastavte si platný Gemini API klíč v souboru bethebest.js pro generování úkolů na míru.", topic: "Konfigurace" }];
    }
    if (!topicsContext) {
        console.warn("[GeminiTasks v7.2] Žádný kontext témat pro generování úkolů.");
        return [];
    }
    const prompt = `Na základě VŠECH následujících záznamů o učení studenta, vygeneruj 3-5 krátkých, praktických úkolů nebo otázek. Pokud již bylo vygenerováno ${existingTasksCount} úkolů, zkus vytvořit odlišné úkoly nebo se zaměř na pokročilejší aspekty témat. Formát odpovědi: JSON pole objektů. Každý objekt musí mít klíče: "title" (stručný název úkolu), "description" (krátký popis nebo otázka), "topic" (jedno z témat, ke kterému se úkol vztahuje). Nedávno studovaná témata:\n---\n${topicsContext}\n---\n`;
    
    console.log("[GeminiTasks v7.2] Prompt pro Gemini:", prompt.substring(0, 200) + "...");

    try {
        const response = await fetch(GEMINI_API_URL_BASE, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, topP: 0.9 }})
        });
        if (!response.ok) { 
            const errorText = await response.text();
            console.error('[GeminiTasks v7.2] Gemini API Error Response Text:', errorText);
            const errorData = JSON.parse(errorText); // Zkusit parsovat, i když nemusí být JSON
            throw new Error(`Chyba Gemini API ${response.status}: ${errorData?.error?.message || response.statusText}`); 
        }
        const data = await response.json();
        console.log("[GeminiTasks v7.2] Surová odpověď od Gemini:", JSON.stringify(data).substring(0, 300) + "...");
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('[GeminiTasks v7.2] AI nevrátilo žádný text. Response data:', JSON.stringify(data));
            throw new Error('AI nevrátilo žádný text pro úkoly.');
        }

        let jsonString = text;
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch?.[1]) {
            jsonString = jsonMatch[1];
        } else {
            console.warn("[GeminiTasks v7.2] JSON blok nenalezen v odpovědi AI, zkouším parsovat celý text.");
        }
        console.log("[GeminiTasks v7.2] Řetězec k parsování jako JSON:", jsonString);
        const parsedTasks = JSON.parse(jsonString);

        if (Array.isArray(parsedTasks) && (parsedTasks.length === 0 || parsedTasks.every(t => t && typeof t.title === 'string' && typeof t.description === 'string' && typeof t.topic === 'string'))) {
            if(parsedTasks.length === 0) console.warn("[GeminiTasks v7.2] AI vrátilo prázdné pole úkolů.");
            return parsedTasks;
        } else {
            console.error('[GeminiTasks v7.2] Neplatná struktura JSON od AI:', parsedTasks);
            throw new Error('Neplatná struktura JSON odpovědi od AI pro úkoly.');
        }
    } catch (error) {
        console.error("[GeminiTasks v7.2] Chyba generování úkolů přes Gemini:", error);
        // Vracíme prázdné pole, aby volající funkce mohla zobrazit zprávu "žádné úkoly"
        return [];
    }
}

async function fetchAndDisplayTasks(forceRefresh = false) {
    if (!currentUser || !tasksFeed) {
        console.warn("[Tasks v7.2] Chybí aktuální uživatel nebo tasksFeed element.");
        if(tasksFeed) tasksFeed.innerHTML = '<p class="error-message" style="text-align:center; padding: 20px;">Chyba: Nelze inicializovat sekci úkolů.</p>';
        return;
    }

    if (isLoadingTasks && !forceRefresh) {
        console.log("[Tasks v7.2] Načítání úkolů již probíhá.");
        return;
    }
    console.log(`[Tasks v7.2] Spuštěno fetchAndDisplayTasks (forceRefresh: ${forceRefresh})`);
    isLoadingTasks = true;
    tasksFeed.innerHTML = '<div class="loader visible-loader">Načítám úkoly...</div>';
    if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');

    try {
        console.log("[Tasks v7.2] Načítání logů pro kontext úkolů...");
        const { data: logs, error: logError } = await supabaseClient
            .from('learning_logs_detailed')
            .select('topic, details, log_date')
            .eq('user_id', currentUser.id)
            .order('log_date', { ascending: false })
            .limit(15);

        if (logError) {
            console.error("[Tasks v7.2] Chyba při načítání logů z DB:", logError);
            throw new Error(`Chyba databáze při načítání logů: ${logError.message}`);
        }
        console.log(`[Tasks v7.2] Načteno ${logs ? logs.length : 0} logů pro kontext.`);

        if (forceRefresh) {
            generatedTasks = [];
            lastTaskTopicContext = "";
        }

        if (logs && logs.length > 0) {
            const topicsContext = logs.map(log => `- Dne ${new Date(log.log_date+'T00:00:00Z').toLocaleDateString('cs-CZ', {timeZone: 'Europe/Prague'})}, Téma: ${log.topic}${log.details ? (': ' + log.details.substring(0, 70) + '...') : ''}`).join("\n");
            console.log("[Tasks v7.2] Vytvořen kontext témat, délka:", topicsContext.length);

            if (forceRefresh || topicsContext !== lastTaskTopicContext || generatedTasks.length === 0) {
                console.log("[Tasks v7.2] Kontext se změnil, je vynucen refresh, nebo nejsou žádné úkoly. Generuji nové úkoly...");
                lastTaskTopicContext = topicsContext;
                const newTasks = await generateTasksFromTopics(topicsContext, generatedTasks.length);
                if (newTasks && newTasks.length > 0) {
                    generatedTasks = newTasks; // Vždy nahradit, pro jednoduchost "nekonečné" pásky
                    console.log(`[Tasks v7.2] Vygenerováno ${newTasks.length} nových úkolů.`);
                } else {
                    console.log("[Tasks v7.2] Nebyly vygenerovány žádné nové úkoly z kontextu.");
                    generatedTasks = [];
                }
            } else {
                console.log("[Tasks v7.2] Kontext se nezměnil a úkoly již existují, není třeba znovu generovat.");
            }
        } else {
            console.log("[Tasks v7.2] Nenalezeny žádné studijní záznamy pro generování kontextu úkolů.");
            generatedTasks = [];
        }
        displayTasks();

    } catch (err) {
        console.error("[Tasks v7.2] Chyba v bloku try funkce fetchAndDisplayTasks:", err);
        tasksFeed.innerHTML = `<p class="error-message" style="text-align:center; padding:20px;">Nepodařilo se načíst úkoly: ${err.message}</p>`;
        generatedTasks = [];
    } finally {
        isLoadingTasks = false;
        console.log("[Tasks v7.2] Blok finally, isLoadingTasks nastaveno na false.");
        if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
        console.log("[Tasks v7.2] fetchAndDisplayTasks dokončeno.");
    }
}

function displayTasks() {
    if (!tasksFeed) {
        console.error("[DisplayTasks v7.2] Element tasksFeed nenalezen.");
        return;
    }
    console.log(`[DisplayTasks v7.2] Zobrazuji úkoly. Počet: ${generatedTasks.length}`);

    if (generatedTasks.length === 0) {
        tasksFeed.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px;">Nejsou k dispozici žádné doporučené úkoly. Přidejte studijní záznamy do kalendáře, aby se mohly vygenerovat, nebo zkuste obnovit.</p>';
        if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
        console.log("[DisplayTasks v7.2] Zobrazena zpráva 'žádné úkoly'.");
        return;
    }

    tasksFeed.innerHTML = '';
    generatedTasks.forEach((task, index) => {
        const taskElement = document.createElement('div');
        taskElement.classList.add('task-item');
        taskElement.id = `task-generated-${index + Date.now()}`;

        taskElement.innerHTML = `
            <h3>${sanitizeHTML(task.title)}</h3>
            <p>${sanitizeHTML(task.description)}</p>
            <small class="task-topic">Téma: ${sanitizeHTML(task.topic)}</small>
        `;
        tasksFeed.appendChild(taskElement);
    });
    console.log("[DisplayTasks v7.2] Úkoly zobrazeny.");
    if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
}

async function initializeApp() {
    console.log("[DEBUG v7.2 InitApp] Start");
    cacheDOMElements();
    if (!initializeSupabase()) return;

    if (authSection && loginFormContainer && registerFormContainer) {
        loginFormContainer.classList.remove('hidden');
        registerFormContainer.classList.add('hidden');
    } else if (authSection) {
        authSection.innerHTML = `<div id="loginFormContainer"><h2>Přihlášení</h2><form id="loginForm"><div><label for="loginEmail">E-mail:</label><input type="email" id="loginEmail" required autocomplete="email"></div><div><label for="loginPassword">Heslo:</label><input type="password" id="loginPassword" required autocomplete="current-password"></div><button type="submit">Přihlásit se</button></form><p class="auth-toggle" onclick="toggleAuthForms()">Nemáš účet? Zaregistruj se</p></div><div id="registerFormContainer" class="hidden"><h2>Registrace</h2><form id="registerForm"><div><label for="registerEmail">E-mail:</label><input type="email" id="registerEmail" required autocomplete="email"></div><div><label for="registerPassword">Heslo:</label><input type="password" id="registerPassword" required autocomplete="new-password"></div><button type="submit">Zaregistrovat se</button></form><p class="auth-toggle" onclick="toggleAuthForms()">Už máš účet? Přihlas se</p></div>`;
        loginFormContainer = document.getElementById('loginFormContainer');
        registerFormContainer = document.getElementById('registerFormContainer');
        loginForm = document.getElementById('loginForm');
        registerForm = document.getElementById('registerForm');
    }
    setupAuthListeners();

    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => changeMonth(1));
    if (closeLogModalBtn) closeLogModalBtn.addEventListener('click', closeLearningLogModal);
    if (dailyLearningLogForm) dailyLearningLogForm.addEventListener('submit', handleDailyLogSubmit);

    console.log("[DEBUG v7.2 InitApp] Nastavuji onAuthStateChange listener...");
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log(`[DEBUG v7.2 AuthChange] Event: ${event}, Session Active: ${!!session}, User Initialized: ${isUserSessionInitialized}`);
        if (session && session.user) {
            const isNewUserOrFirstInit = !currentUser || currentUser.id !== session.user.id || !isUserSessionInitialized;
            currentUser = session.user;
            if (isNewUserOrFirstInit) {
                isUserSessionInitialized = false; // Mark as not fully initialized until data loads
                console.log('[DEBUG v7.2 AuthChange] Uživatel přihlášen/změněn:', currentUser.id);
                if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
                if (authSection) authSection.classList.add('hidden');
                if (appSection) appSection.classList.remove('hidden');

                // Postupné načítání a zobrazení
                try {
                    await loadLogsForMonthAndRenderCalendar(); // Nejprve kalendář
                    console.log('[DEBUG v7.2 AuthChange] Kalendář načten a vykreslen.');
                    await fetchAndDisplayTasks(true); // Poté úkoly (force refresh)
                    console.log('[DEBUG v7.2 AuthChange] Úkoly načteny a zobrazeny.');
                    isUserSessionInitialized = true; // Nyní je session plně inicializována
                } catch (initError) {
                    console.error("[DEBUG v7.2 AuthChange] Chyba během inicializace dat po přihlášení:", initError);
                    showNotification("Nepodařilo se plně načíst data po přihlášení.", "error");
                    // Zde můžete zvážit, zda zobrazit nějaký error state pro tasksFeed, pokud kalendář selhal
                    if (tasksFeed && !tasksFeed.querySelector('.task-item') && !tasksFeed.querySelector('.error-message')) {
                         tasksFeed.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px;">Chyba načítání úkolů kvůli problému s inicializací.</p>';
                    }
                }
            } else {
                 console.log('[DEBUG v7.2 AuthChange] Session obnovena, uživatel stejný a již inicializováno. Žádná akce.');
            }
        } else {
            currentUser = null;
            isUserSessionInitialized = false;
            console.log('[DEBUG v7.2 AuthChange] Uživatel odhlášen nebo session neaktivní.');
            if (userEmailDisplay) userEmailDisplay.textContent = '';
            if (authSection) authSection.classList.remove('hidden');
            if (appSection) appSection.classList.add('hidden');
            learningLogsCache = {};
            generatedTasks = [];
            if(calendarGrid) calendarGrid.innerHTML = '<p style="text-align:center; color: var(--text-muted);">Pro zobrazení kalendáře se přihlaste.</p>';
            if(tasksFeed) tasksFeed.innerHTML = '<p style="text-align:center; color: var(--text-muted);">Pro zobrazení úkolů se přihlaste.</p>';
            if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
        }
    });
    console.log("[DEBUG v7.2 InitApp] Konec");
}

function initializeSupabase() {
    console.log("[DEBUG v7.2 Supabase] Initializing Supabase...");
    try {
        if (!window.supabase?.createClient) throw new Error("Supabase library not loaded.");
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        if (!supabaseClient) throw new Error("Supabase client creation failed.");
        console.log("[DEBUG v7.2 Supabase] Supabase client initialized.");
        return true;
    } catch (e) {
        console.error("[DEBUG v7.2 Supabase] Supabase init failed:", e);
        showNotification("Chyba připojení k databázi. Obnovte stránku.", "error", 0);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);