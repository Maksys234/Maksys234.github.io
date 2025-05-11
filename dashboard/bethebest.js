// dashboard/bethebest.js
// Verze: 7.1 - Vylepšené zpracování načítání úkolů a prázdných stavů

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
    // tasksFeedLoader byl odstraněn, tasksFeed slouží i pro zobrazení loaderu

// --- API Klíč pro Gemini (POZOR: V produkci řešit bezpečněji!) ---
const GEMINI_API_KEY = 'AIzaSyB4l6Yj9AjWfkG2Ob2LCAgTsnSwN-UZQcA'; // Nahraďte skutečným klíčem
const GEMINI_API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- Stav Aplikace ---
let currentUser = null;
let currentDisplayedMonth = new Date().getMonth();
let currentDisplayedYear = new Date().getFullYear();
let learningLogsCache = {}; // Cache pro logy: {'YYYY-MM-DD': {topic: '...', details: '...'}}
let generatedTasks = [];
let lastTaskTopicContext = "";
let isLoadingTasks = false; // Přidáno pro sledování načítání úkolů

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
    console.log("[DEBUG] DOM elements cached.");
}

function showNotification(message, type = 'info', duration = 3500) {
    if (!notificationArea) { console.warn("Notification area not found"); return; }
    const notificationDiv = document.createElement('div');
    notificationDiv.className = `notification ${type}`; // Používá styly z HTML
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
            setTimeout(() => { if (notificationDiv.parentElement) notificationDiv.remove(); }, 600); // Fallback remove
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
            } catch (err) {
                console.error('[DEBUG] Logout error:', err);
                showNotification(`Odhlášení selhalo: ${err.message}`, 'error');
                logoutButton.disabled = false;
            }
        });
    }
}

function renderCalendar() {
    if (!calendarGrid || !monthYearDisplay) return;
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
    // Zpráva pokud pro daný měsíc nejsou žádné logy (volitelné, kalendář se zobrazí i tak prázdný)
    if (calendarGrid.querySelectorAll('.has-log').length === 0) {
        console.log(`[Calendar] Pro ${monthYearDisplay.textContent} nebyly nalezeny žádné záznamy.`);
        // Zde by se případně mohla zobrazit zpráva přímo v UI kalendáře, ale prázdný kalendář je také indikace.
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

    console.log(`[DEBUG] Načítání logů pro ${firstDay.toISOString().split('T')[0]} až ${lastDay.toISOString().split('T')[0]}`);

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
        console.log("[DEBUG] Logy pro měsíc načteny:", learningLogsCache);
        renderCalendar();
    } catch (err) {
        console.error("[DEBUG] Chyba načítání logů:", err);
        showNotification("Chyba při načítání záznamů z kalendáře.", "error");
        renderCalendar(); // Vykreslit prázdný kalendář i při chybě
    }
}

function openLearningLogModal(dateStr) {
    if (!logSelectedDateInput || !logDateDisplay || !logTopicInput || !logDetailsInput || !learningLogModal) return;
    logSelectedDateInput.value = dateStr;
    const dateObj = new Date(dateStr + 'T00:00:00');
    logDateDisplay.textContent = dateObj.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });

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
        await fetchAndDisplayTasks(true); // Force refresh úkolů
    } catch (err) {
        console.error("[DEBUG] Chyba ukládání denního logu:", err);
        showNotification(`Uložení záznamu selhalo: ${err.message}`, "error");
    } finally {
        if (submitButton) { submitButton.disabled = false; submitButton.textContent = "Uložit záznam"; }
    }
}

async function generateTasksFromTopics(topicsContext, existingTasksCount = 0) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'AIzaSyB4l6Yj9AjWfkG2Ob2LCAgTsnSwN-UZQcA' || GEMINI_API_KEY.startsWith("YOUR_")) {
        console.warn("[DEBUG] Chybí platný Gemini API Klíč. Vracím ukázkové úkoly.");
        return [{ title: "Ukázkový úkol: Nastavení API", description: "Nastavte si platný Gemini API klíč v souboru bethebest.js pro generování úkolů na míru.", topic: "Konfigurace" }];
    }
    if (!topicsContext) {
        console.warn("[DEBUG] Žádný kontext témat pro generování úkolů.");
        return [];
    }
    const prompt = `Na základě VŠECH následujících záznamů o učení studenta, vygeneruj 3-5 krátkých, praktických úkolů nebo otázek. Pokud již bylo vygenerováno ${existingTasksCount} úkolů, zkus vytvořit odlišné úkoly nebo se zaměř na pokročilejší aspekty témat. Formát odpovědi: JSON pole objektů. Každý objekt musí mít klíče: "title", "description", "topic". Nedávno studovaná témata:\n---\n${topicsContext}\n---\n`;
    try {
        const response = await fetch(GEMINI_API_URL_BASE, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, topP: 0.9 }})
        });
        if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(`Chyba Gemini API ${response.status}: ${errorData?.error?.message || response.statusText}`); }
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('AI nevrátilo žádný text pro úkoly.');
        let jsonString = text; const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/); if (jsonMatch?.[1]) jsonString = jsonMatch[1];
        const parsedTasks = JSON.parse(jsonString);
        if (Array.isArray(parsedTasks) && parsedTasks.every(t => t.title && t.description && t.topic)) return parsedTasks;
        throw new Error('Neplatná struktura JSON odpovědi od AI pro úkoly.');
    } catch (error) { console.error("[DEBUG] Chyba generování úkolů přes Gemini:", error); showNotification(`Chyba generování úkolů: ${error.message}`, "error"); return []; }
}

// Upravená funkce pro načítání a zobrazování úkolů
async function fetchAndDisplayTasks(forceRefresh = false) {
    if (!currentUser || !tasksFeed) {
        console.warn("[Tasks] Chybí aktuální uživatel nebo tasksFeed element.");
        if(tasksFeed) tasksFeed.innerHTML = '<p class="error-message" style="text-align:center;">Chyba: Nelze načíst úkoly.</p>';
        return;
    }

    if (isLoadingTasks && !forceRefresh) {
        console.log("[Tasks] Načítání úkolů již probíhá.");
        return;
    }
    isLoadingTasks = true;
    tasksFeed.innerHTML = '<div class="loader visible-loader">Načítám úkoly...</div>'; // Zobrazit loader
    if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');

    try {
        const { data: logs, error: logError } = await supabaseClient
            .from('learning_logs_detailed')
            .select('topic, details, log_date')
            .eq('user_id', currentUser.id)
            .order('log_date', { ascending: false })
            .limit(15); // Více kontextu pro lepší úkoly

        if (logError) throw logError;

        if (logs && logs.length > 0) {
            const topicsContext = logs.map(log => `- Dne ${new Date(log.log_date).toLocaleDateString('cs-CZ')}, Téma: ${log.topic}${log.details ? (': ' + log.details.substring(0, 70) + '...') : ''}`).join("\n");
            
            // Generovat úkoly, pouze pokud se kontext změnil nebo je to forceRefresh
            if (forceRefresh || topicsContext !== lastTaskTopicContext) {
                console.log("[Tasks] Kontext se změnil nebo je vynucen refresh. Generuji nové úkoly.");
                lastTaskTopicContext = topicsContext; // Aktualizovat kontext
                const newTasks = await generateTasksFromTopics(topicsContext, 0); // Vždy začít s 0 pro nový kontext
                generatedTasks = newTasks; // Nahradit staré úkoly novými
            } else if (generatedTasks.length > 0) {
                 console.log("[Tasks] Kontext se nezměnil, zobrazuji existující úkoly.");
            } else { // Kontext se nezměnil, ale generatedTasks jsou prázdné (mohlo se stát při předchozí chybě)
                 console.log("[Tasks] Kontext se nezměnil, ale nejsou žádné úkoly. Zkusím vygenerovat.");
                 const newTasks = await generateTasksFromTopics(topicsContext, 0);
                 generatedTasks = newTasks;
            }
        } else {
            console.log("[Tasks] Nenalezeny žádné studijní záznamy pro generování úkolů.");
            generatedTasks = []; // Žádné logy = žádné úkoly
        }
        displayTasks(); // Zobrazí úkoly nebo zprávu "žádné úkoly"

    } catch (err) {
        console.error("[DEBUG] Chyba při načítání nebo generování úkolů:", err);
        tasksFeed.innerHTML = `<p class="error-message" style="text-align:center; padding:20px;">Nepodařilo se načíst úkoly: ${err.message}</p>`;
        generatedTasks = [];
    } finally {
        isLoadingTasks = false;
        // Loader text uvnitř tasksFeed je nyní spravován funkcí displayTasks nebo chybovou zprávou.
        // Pro "nekonečnou pásku" by se zde řešila viditelnost tlačítka "Načíst další".
        // Prozatím generujeme jednu dávku, takže tlačítko zůstane skryté.
        if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
    }
}


function displayTasks() {
    if (!tasksFeed) return;

    if (generatedTasks.length === 0) {
        tasksFeed.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px;">Nejsou k dispozici žádné doporučené úkoly. Přidejte studijní záznamy do kalendáře, aby se mohly vygenerovat.</p>';
        if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
        return;
    }

    tasksFeed.innerHTML = ''; // Vyčistit předchozí obsah (včetně loaderu nebo zprávy "žádné úkoly")
    generatedTasks.forEach((task, index) => {
        const taskElement = document.createElement('div');
        taskElement.classList.add('task-item');
        // Jednoduché ID pro případné budoucí reference, pokud by AI vracelo unikátní ID
        taskElement.id = `task-generated-${index}`;

        taskElement.innerHTML = `
            <h3>${sanitizeHTML(task.title)}</h3>
            <p>${sanitizeHTML(task.description)}</p>
            <small class="task-topic">Téma: ${sanitizeHTML(task.topic)}</small>
        `;
        tasksFeed.appendChild(taskElement);
    });

    // Aktuálně není implementováno "load more" pro úkoly z Gemini, jelikož generujeme dávku.
    // Pokud by bylo, zde by se řešila viditelnost tlačítka.
    if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
}


async function initializeApp() {
    console.log("[DEBUG] initializeApp v7.1 - Start");
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
    // Tlačítko loadMoreTasksButton aktuálně není potřeba pro automatické načítání
    // if (loadMoreTasksButton) loadMoreTasksButton.addEventListener('click', () => fetchAndDisplayTasks(false));


    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log('[DEBUG Auth Change] Event:', event, 'Session Active:', !!session);
        if (session && session.user) {
            const userChanged = !currentUser || currentUser.id !== session.user.id;
            currentUser = session.user;
            if (userChanged) { // Pouze pokud se uživatel změnil nebo je to první přihlášení
                console.log('[DEBUG Auth Change] Uživatel přihlášen/změněn:', currentUser.id);
                if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
                if (authSection) authSection.classList.add('hidden');
                if (appSection) appSection.classList.remove('hidden');
                await loadLogsForMonthAndRenderCalendar();
                await fetchAndDisplayTasks(true); // Force refresh úkolů při přihlášení/změně uživatele
            } else {
                 console.log('[DEBUG Auth Change] Session refreshed, user unchanged. Data integrity should be fine.');
            }
        } else {
            currentUser = null;
            console.log('[DEBUG Auth Change] Uživatel odhlášen nebo session neaktivní.');
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

document.addEventListener('DOMContentLoaded', initializeApp);