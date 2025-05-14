// dashboard/bethebest.js
// Verze: 7.7 - Obnovení a vylepšení AI úkolů, robustnější načítání

// --- Konstanty a Supabase klient ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
let supabaseClient = null;

// API Klíč pro Gemini - !! NAHRAĎTE SVÝM SKUTEČNÝM KLÍČEM !!
const GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // <--- ZDE VLOŽTE VÁŠ KLÍČ
const GEMINI_API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- HTML Elementy ---
let authSection, appSection, loginFormContainer, registerFormContainer, notificationArea,
    loginForm, registerForm, logoutButton, userEmailDisplay,
    calendarGrid, monthYearDisplay, prevMonthBtn, nextMonthBtn,
    learningLogModal, closeLogModalBtn, dailyLearningLogForm, logSelectedDateInput,
    logDateDisplay, logTopicInput, logDetailsInput,
    tasksFeed, loadMoreTasksButton;

let currentUser = null;
let currentDisplayedMonth = new Date().getMonth();
let currentDisplayedYear = new Date().getFullYear();
let learningLogsCache = {};

let generatedTasks = [];
let lastTaskTopicContext = "";
let isLoadingTasks = false;

let isLoadingCalendarLogs = false;
let isUserSessionInitialized = false;
const SUPABASE_FETCH_TIMEOUT = 15000;
const GEMINI_FETCH_TIMEOUT = 25000;

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
    console.log("[DEBUG v7.7 Cache] DOM elements cached.");
}

function showNotification(message, type = 'info', duration = 3500) {
    if (!notificationArea) {
        console.warn("Notification area not found.");
        return;
    }
    const toastId = `toast-${Date.now()}`;
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.id = toastId;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'assertive');
    notification.innerHTML = `
        <i class="toast-icon"></i>
        <div class="toast-message">${sanitizeHTML(message)}</div>
        <button type="button" class="toast-close" aria-label="Zavřít">&times;</button>
    `;
    const iconElement = notification.querySelector('.toast-icon');
    iconElement.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`;
    notification.querySelector('.toast-close').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 400);
    });
    notificationArea.appendChild(notification);
    requestAnimationFrame(() => notification.classList.add('show'));
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 400);
        }
    }, duration);
}

function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str || '';
    return temp.innerHTML;
}

window.toggleAuthForms = () => {
    if (loginFormContainer && registerFormContainer) {
        loginFormContainer.classList.toggle('hidden');
        registerFormContainer.classList.toggle('hidden');
    } else {
        console.warn("Login or Register form container not found for toggle.");
    }
};

function setupAuthListeners() {
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = loginForm.email.value;
            const password = loginForm.password.value;
            try {
                const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                showNotification("Přihlášení úspěšné!", "success");
            } catch (error) {
                showNotification(`Chyba přihlášení: ${error.message}`, "error");
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = registerForm.email.value;
            const password = registerForm.password.value;
            try {
                const { error } = await supabaseClient.auth.signUp({ email, password });
                if (error) throw error;
                showNotification("Registrace úspěšná! Zkontrolujte svůj email pro ověření.", "success");
            } catch (error) {
                showNotification(`Chyba registrace: ${error.message}`, "error");
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                const { error } = await supabaseClient.auth.signOut();
                if (error) throw error;
                showNotification("Odhlášení úspěšné.", "info");
            } catch (error) {
                showNotification(`Chyba odhlášení: ${error.message}`, "error");
            }
        });
    }
}

function renderCalendar() {
    if (!calendarGrid || !monthYearDisplay) {
        console.error("[Calendar v7.7] Chybí elementy kalendáře (calendarGrid nebo monthYearDisplay).");
        return;
    }
    console.log(`[Calendar v7.7] Vykreslování kalendáře pro ${currentDisplayedMonth + 1}/${currentDisplayedYear}`);
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
            preview.innerHTML = `<strong>${sanitizeHTML(log.topic) || 'Téma'}</strong><br>${sanitizeHTML(log.details)?.substring(0, 50) || 'Žádné detaily'}...`;
            dayCell.appendChild(preview);
        }

        dayCell.addEventListener('click', () => openLearningLogModal(dateStr));
        calendarGrid.appendChild(dayCell);
    }
    console.log(`[Calendar v7.7] Kalendář pro ${monthYearDisplay.textContent} vykreslen.`);
}

function changeMonth(offset) {
    console.log(`[DEBUG v7.7 ChangeMonth] POKUS O VOLÁNÍ s offset: ${offset}. isLoadingCalendarLogs: ${isLoadingCalendarLogs}`);

    if (isLoadingCalendarLogs) {
        console.warn(`[DEBUG v7.7 ChangeMonth] ZABLOKOVÁNO: Načítání kalendáře již probíhá.`);
        showNotification("Kalendář se stále načítá, počkejte prosím.", "info", 2000);
        return;
    }

    currentDisplayedMonth += offset;
    if (currentDisplayedMonth < 0) {
        currentDisplayedMonth = 11;
        currentDisplayedYear--;
    } else if (currentDisplayedMonth > 11) {
        currentDisplayedMonth = 0;
        currentDisplayedYear++;
    }
    console.log(`[DEBUG v7.7 ChangeMonth] Nový M/R: ${currentDisplayedMonth + 1}/${currentDisplayedYear}. Volám loadLogs...`);
    loadLogsForMonthAndRenderCalendar();
}

async function loadLogsForMonthAndRenderCalendar() {
    if (!currentUser || !supabaseClient) {
        console.warn("[LogsCal v7.7] Chybí uživatel nebo Supabase klient.");
        if (typeof renderCalendar === 'function') renderCalendar();
        return;
    }
    if (isLoadingCalendarLogs) {
        console.warn("[LogsCal v7.7] Duplicitní volání, načítání již probíhá.");
        return;
    }
    isLoadingCalendarLogs = true;
    const displayMonthForLog = currentDisplayedMonth;
    const displayYearForLog = currentDisplayedYear;
    console.log(`[LogsCal v7.7] START: isLoadingCalendarLogs -> true. Cíl: ${displayYearForLog}-${String(displayMonthForLog + 1).padStart(2, '0')}`);
    if (monthYearDisplay) monthYearDisplay.textContent = "Načítám...";

    const startDateStr = `${displayYearForLog}-${String(displayMonthForLog + 1).padStart(2, '0')}-01`;
    const tempEndDate = new Date(displayYearForLog, displayMonthForLog + 1, 0);
    const endDateStr = `${tempEndDate.getFullYear()}-${String(tempEndDate.getMonth() + 1).padStart(2, '0')}-${String(tempEndDate.getDate()).padStart(2, '0')}`;

    let supabaseRequestCompleted = false;
    try {
        const fetchPromise = supabaseClient
            .from('learning_logs_detailed') // Ujistěte se, že název tabulky je správný!
            .select('log_date, topic, details')
            .eq('user_id', currentUser.id)
            .gte('log_date', startDateStr)
            .lte('log_date', endDateStr);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Supabase fetch timeout")), SUPABASE_FETCH_TIMEOUT));
        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
        supabaseRequestCompleted = true;

        if (error) throw error;
        Object.keys(learningLogsCache).forEach(key => {
            if (key.startsWith(`${displayYearForLog}-${String(displayMonthForLog + 1).padStart(2, '0')}`)) delete learningLogsCache[key];
        });
        if (data) data.forEach(log => { learningLogsCache[log.log_date] = { topic: log.topic, details: log.details }; });
        console.log(`[LogsCal v7.7] Logy načteny (${data?.length || 0} záznamů).`);
        if (typeof renderCalendar === 'function') renderCalendar();
    } catch (err) {
        console.error("[LogsCal v7.7] Chyba:", err.message);
        if (typeof showNotification === 'function') showNotification(`Chyba načítání záznamů: ${err.message === "Supabase fetch timeout" ? "Server neodpověděl." : err.message}`, "error");
        if (typeof renderCalendar === 'function') renderCalendar();
    } finally {
        console.log(`[LogsCal v7.7] FINALLY: isLoadingCalendarLogs -> false. Bylo supabaseRequestCompleted: ${supabaseRequestCompleted}`);
        isLoadingCalendarLogs = false;
        if (monthYearDisplay && currentDisplayedMonth === displayMonthForLog && currentDisplayedYear === displayYearForLog) {
             const firstDay = new Date(currentDisplayedYear, currentDisplayedMonth, 1);
             monthYearDisplay.textContent = `${firstDay.toLocaleString('cs-CZ', { month: 'long' })} ${currentDisplayedYear}`;
        }
        console.log(`[LogsCal v7.7] KONEC: isLoadingCalendarLogs je ${isLoadingCalendarLogs}.`);
    }
}

function openLearningLogModal(dateStr) {
    if (!learningLogModal || !logDateDisplay || !logSelectedDateInput || !logTopicInput || !logDetailsInput) {
        console.error("Chybí elementy modálního okna pro log."); return;
    }
    const dateObj = new Date(dateStr + 'T00:00:00Z');
    logDateDisplay.textContent = dateObj.toLocaleDateString('cs-CZ', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Prague' });
    logSelectedDateInput.value = dateStr;
    const existingLog = learningLogsCache[dateStr];
    logTopicInput.value = existingLog ? (existingLog.topic || '') : '';
    logDetailsInput.value = existingLog ? (existingLog.details || '') : '';
    learningLogModal.style.display = "flex";
    logTopicInput.focus();
}

function closeLearningLogModal() {
    if (learningLogModal) learningLogModal.style.display = "none";
}

async function handleDailyLogSubmit(event) {
    event.preventDefault();
    if (!currentUser || !supabaseClient || !logSelectedDateInput || !logTopicInput || !logDetailsInput) {
        showNotification("Chyba: Nelze uložit záznam, chybí interní data.", "error"); return;
    }
    const date = logSelectedDateInput.value;
    const topic = logTopicInput.value.trim();
    const details = logDetailsInput.value.trim();
    if (!date || !topic) { showNotification("Datum a téma jsou povinné.", "error"); return; }

    const submitButton = dailyLearningLogForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...';
    try {
        const { data, error } = await supabaseClient
            .from('learning_logs_detailed') // !! ZKONTROLUJTE NÁZEV TABULKY !!
            .upsert({ user_id: currentUser.id, log_date: date, topic: topic, details: details }, { onConflict: 'user_id, log_date' })
            .select();
        if (error) throw error;
        learningLogsCache[date] = { topic, details };
        showNotification("Záznam úspěšně uložen!", "success");
        closeLearningLogModal();
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof fetchAndDisplayTasks === 'function') fetchAndDisplayTasks(true); // Aktualizovat AI úkoly
    } catch (error) {
        console.error("Chyba ukládání záznamu:", error);
        showNotification(`Chyba ukládání: ${error.message}`, "error");
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    }
}

// --- AI Úkoly ---
async function generateTasksFromTopics(topicsContext, existingTasksCount = 0) {
    console.log(`[AI Tasks v7.7] Generování úkolů. Kontext: "${topicsContext.substring(0, 100)}...", Počet existujících: ${existingTasksCount}`);
    if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) { // Zjednodušená kontrola
        console.error("[AI Tasks v7.7] Neplatný nebo chybějící Gemini API klíč.");
        return [{ title: "Chyba konfigurace AI", description: "Prosím zkontrolujte API klíč pro Gemini.", topic: "Systém" }];
    }

    const prompt = `Jsi AI asistent pro plánování studia. Na základě následujících probraných témat navrhni 3-5 konkrétních, stručných úkolů nebo otázek k zopakování. Každý úkol by měl mít jasný název (title), krátký popis (description) a téma (topic), ke kterému se vztahuje. Formátuj odpověď jako pole JSON objektů. Existující počet úkolů: ${existingTasksCount}. Snaž se negenerovat duplicitní úkoly k již existujícím. Probraná témata:\n${topicsContext}`;

    let fetchAttemptCompleted = false;
    try {
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024, // Dostatek tokenů pro 3-5 úkolů
            },
        };
        console.log("[AI Tasks v7.7] Gemini request body (začátek):", JSON.stringify(requestBody).substring(0, 200) + "...");

        const fetchPromise = fetch(GEMINI_API_URL_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini API fetch timeout")), GEMINI_FETCH_TIMEOUT));

        const response = await Promise.race([fetchPromise, timeoutPromise]);
        fetchAttemptCompleted = true;
        console.log("[AI Tasks v7.7] Gemini fetch nebo timeout dokončen.");

        if (!response.ok) {
            const errorText = await response.text(); // Získat text chyby
            console.error("[AI Tasks v7.7] Gemini API chyba:", response.status, errorText);
            let errorMsg = `Chyba API (${response.status})`;
            try {
                const errorData = JSON.parse(errorText);
                errorMsg = errorData.error?.message || errorMsg;
            } catch (e) { /* ignorovat chybu parsování, použít HTTP chybu */ }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log("[AI Tasks v7.7] Gemini API response data:", data);

        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) {
            const feedback = data.promptFeedback || data.candidates?.[0]?.finishReason;
            console.warn("[AI Tasks v7.7] Gemini API nevrátilo textovou odpověď. Feedback/Reason:", feedback);
            throw new Error(`AI nevrátilo platnou odpověď (důvod: ${feedback?.blockReason || feedback || 'neznámý'}).`);
        }

        // Pokus o extrakci JSON bloku
        const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
        let parsedTasks;
        if (jsonMatch && jsonMatch[1]) {
            parsedTasks = JSON.parse(jsonMatch[1]);
        } else {
            console.warn("[AI Tasks v7.7] JSON blok nenalezen, pokus o parsování celého textu jako JSON pole.");
            // Zkusit parsovat celý textResponse - Gemini někdy nevrací ```json
            try {
                parsedTasks = JSON.parse(textResponse);
                if (!Array.isArray(parsedTasks)) { // Pokud to není pole, zabalíme to do pole (pokud je to jeden objekt)
                    if (typeof parsedTasks === 'object' && parsedTasks !== null) {
                        parsedTasks = [parsedTasks];
                    } else {
                        throw new Error("Odpověď AI není pole JSON objektů.");
                    }
                }
            } catch (e) {
                 console.error("[AI Tasks v7.7] Nepodařilo se parsovat odpověď AI jako JSON:", e, "Odpověď:", textResponse);
                 throw new Error("AI odpovědělo v nesprávném formátu.");
            }
        }
        return parsedTasks;
    } catch (error) {
        console.error("[AI Tasks v7.7] Chyba při generování úkolů z Gemini:", error.message);
        if (!fetchAttemptCompleted && error.message.includes("timeout")) { // Přesnější kontrola timeoutu
             return [{ title: "AI neodpovědělo", description: "Generování úkolů trvalo příliš dlouho. Zkuste to prosím později.", topic: "Systém" }];
        }
        return [{ title: "Chyba AI", description: `Nepodařilo se vygenerovat úkoly: ${error.message}`, topic: "Systém" }];
    }
}

async function fetchAndDisplayTasks(forceRefresh = false) {
    if (!currentUser || !tasksFeed || !supabaseClient) {
        console.warn("[Tasks v7.7] Chybí uživatel, tasksFeed element nebo Supabase klient.");
        if (tasksFeed) tasksFeed.innerHTML = '<p class="error-message" style="text-align:center; padding: 20px;">Chyba: Nelze inicializovat sekci úkolů.</p>';
        return;
    }
    if (isLoadingTasks && !forceRefresh) {
        console.log("[Tasks v7.7] Načítání úkolů již probíhá. Přeskakuji.");
        return;
    }

    console.log(`[Tasks v7.7] Spuštěno fetchAndDisplayTasks (forceRefresh: ${forceRefresh})`);
    isLoadingTasks = true;
    tasksFeed.innerHTML = '<div class="loader visible-loader">Načítám relevantní úkoly...</div>';
    if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');

    try {
        console.log("[Tasks v7.7] Načítání posledních logů pro kontext AI úkolů...");
        const { data: logs, error: logError } = await supabaseClient
            .from('learning_logs_detailed') // !! ZKONTROLUJTE NÁZEV TABULKY !!
            .select('topic, details, log_date')
            .eq('user_id', currentUser.id)
            .order('log_date', { ascending: false })
            .limit(10);

        if (logError) {
            console.error("[Tasks v7.7] Chyba při načítání logů pro AI:", logError);
            throw new Error(`Chyba databáze při čtení logů: ${logError.message}`);
        }
        console.log(`[Tasks v7.7] Načteno ${logs ? logs.length : 0} logů pro AI kontext.`);

        if (forceRefresh) {
            generatedTasks = [];
            lastTaskTopicContext = "";
            console.log("[Tasks v7.7] Force refresh: Vymazány existující úkoly a kontext.");
        }

        if (logs && logs.length > 0) {
            const topicsContext = logs.map(log =>
                `- Dne ${new Date(log.log_date + 'T00:00:00Z').toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' })}, Téma: ${log.topic}${log.details ? (': ' + log.details.substring(0, 70) + '...') : ''}`
            ).join("\n");

            if (forceRefresh || topicsContext !== lastTaskTopicContext || generatedTasks.length === 0) {
                console.log("[Tasks v7.7] Kontext se změnil / refresh / žádné úkoly. Generuji nové AI úkoly...");
                lastTaskTopicContext = topicsContext;
                const newTasks = await generateTasksFromTopics(topicsContext, generatedTasks.length);
                generatedTasks = Array.isArray(newTasks) ? newTasks.filter(task => task && typeof task === 'object' && task.title) : [];
                console.log(`[Tasks v7.7] Vygenerováno/zpracováno ${generatedTasks.length} AI úkolů.`);
            } else {
                console.log("[Tasks v7.7] Kontext se nezměnil, AI úkoly již existují.");
            }
        } else {
            console.log("[Tasks v7.7] Nenalezeny žádné studijní záznamy pro kontext AI úkolů. AI úkoly nebudou generovány.");
            generatedTasks = [];
        }
        displayTasks();
    } catch (err) {
        console.error("[Tasks v7.7] Chyba v fetchAndDisplayTasks:", err);
        tasksFeed.innerHTML = `<p class="error-message" style="text-align:center; padding:20px;">Nepodařilo se načíst AI úkoly: ${err.message}</p>`;
        generatedTasks = [];
    } finally {
        isLoadingTasks = false;
        console.log("[Tasks v7.7] isLoadingTasks nastaveno na false.");
        // Tlačítko "Načíst další úkoly" je zatím skryté/neaktivní
        if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
        console.log("[Tasks v7.7] fetchAndDisplayTasks dokončeno.");
    }
}

function displayTasks() {
    if (!tasksFeed) { console.error("[DisplayTasks v7.7] Element tasksFeed nenalezen."); return; }
    console.log(`[DisplayTasks v7.7] Zobrazuji AI úkoly. Počet: ${generatedTasks.length}`);

    if (generatedTasks.length === 0) {
        tasksFeed.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px;">Nejsou k dispozici žádné doporučené úkoly. Přidejte studijní záznamy do kalendáře pro personalizované návrhy.</p>';
        console.log("[DisplayTasks v7.7] Zobrazena zpráva 'žádné AI úkoly'.");
        return;
    }
    tasksFeed.innerHTML = '';
    generatedTasks.forEach((task, index) => {
        if (!task || !task.title) {
            console.warn(`[DisplayTasks v7.7] Přeskakuji nevalidní task objekt na indexu ${index}:`, task);
            return;
        }
        const taskElement = document.createElement('div');
        taskElement.classList.add('task-item');
        taskElement.id = `generated-task-${index}-${Date.now()}`;

        taskElement.innerHTML = `
            <h3>${sanitizeHTML(task.title)}</h3>
            <p>${sanitizeHTML(task.description || "Žádný popis.")}</p>
            ${task.topic ? `<small class="task-topic">Téma: ${sanitizeHTML(task.topic)}</small>` : ''}
        `;
        tasksFeed.appendChild(taskElement);
    });
    console.log("[DisplayTasks v7.7] AI úkoly zobrazeny.");
}

// --- Inicializace ---
async function initializeApp() {
    console.log("[DEBUG v7.7 InitApp] Start");
    cacheDOMElements();
    if (!initializeSupabase()) return;
    setupAuthListeners();

    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => changeMonth(1));
    if (closeLogModalBtn) closeLogModalBtn.addEventListener('click', closeLearningLogModal);
    if (dailyLearningLogForm) dailyLearningLogForm.addEventListener('submit', handleDailyLogSubmit);
    if (loadMoreTasksButton) { // Příklad, pokud bychom chtěli tlačítko aktivovat
        // loadMoreTasksButton.addEventListener('click', () => fetchAndDisplayTasks(false)); // false = ne forceRefresh
        // Prozatím ho necháme neaktivní, jak je v HTML
    }

    console.log("[DEBUG v7.7 InitApp] Nastavuji onAuthStateChange listener...");
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log(`[DEBUG v7.7 AuthChange] Event: ${event}, Session Active: ${!!session}, User Initialized: ${isUserSessionInitialized}`);
        if (session && session.user) {
            const isNewUserOrFirstInit = !currentUser || currentUser.id !== session.user.id || !isUserSessionInitialized;
            currentUser = session.user;

            if (isNewUserOrFirstInit) {
                console.log('[DEBUG v7.7 AuthChange] Uživatel přihlášen/změněn nebo první inicializace. Načítám data...');
                isUserSessionInitialized = false;

                if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
                if (authSection) authSection.classList.add('hidden');
                if (appSection) appSection.classList.remove('hidden');

                try {
                    console.log("[DEBUG v7.7 AuthChange] Čekám na loadLogsForMonthAndRenderCalendar()...");
                    await loadLogsForMonthAndRenderCalendar();
                    console.log('[DEBUG v7.7 AuthChange] Kalendář načten a vykreslen po přihlášení.');

                    console.log("[DEBUG v7.7 AuthChange] Čekám na fetchAndDisplayTasks(true)...");
                    await fetchAndDisplayTasks(true);
                    console.log('[DEBUG v7.7 AuthChange] AI úkoly načteny a zobrazeny.');

                    isUserSessionInitialized = true;
                    console.log('[DEBUG v7.7 AuthChange] isUserSessionInitialized nastaveno na true.');
                } catch (initError) {
                    console.error("[DEBUG v7.7 AuthChange] Chyba během inicializace dat po přihlášení:", initError);
                    if (typeof showNotification === 'function') showNotification("Nepodařilo se plně načíst data po přihlášení. Zkuste obnovit stránku.", "error", 5000);
                    if (tasksFeed && initError.message.toLowerCase().includes("úkol")) {
                        tasksFeed.innerHTML = `<p class="error-message" style="text-align:center; padding:20px;">Nepodařilo se načíst AI úkoly: ${initError.message}</p>`;
                    }
                }
            } else {
                 console.log('[DEBUG v7.7 AuthChange] Session obnovena, uživatel stejný a již inicializováno. Žádná akce.');
            }
        } else {
            currentUser = null;
            isUserSessionInitialized = false;
            console.log('[DEBUG v7.7 AuthChange] Uživatel odhlášen nebo session neaktivní.');
            if (userEmailDisplay) userEmailDisplay.textContent = '';
            if (authSection) authSection.classList.remove('hidden');
            if (appSection) appSection.classList.add('hidden');
            learningLogsCache = {};
            generatedTasks = [];
            if(calendarGrid) calendarGrid.innerHTML = '<p style="text-align:center; color: var(--text-muted);">Pro zobrazení kalendáře se přihlaste.</p>';
            if(tasksFeed) tasksFeed.innerHTML = '<p style="text-align:center; color: var(--text-muted);">Pro zobrazení doporučených úkolů se přihlaste.</p>';
            if(loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
        }
    });
    console.log("[DEBUG v7.7 InitApp] Konec");
}

function initializeSupabase() {
    try {
        if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
            throw new Error("Supabase library not loaded or createClient is not a function.");
        }
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        if (!supabaseClient) {
            throw new Error("Supabase client creation failed (returned null/undefined).");
        }
        window.supabase = supabaseClient;
        console.log('[Supabase] Klient úspěšně inicializován.');
        return true;
    } catch (error) {
        console.error('[Supabase] Initialization failed:', error);
        const container = document.querySelector('.container') || document.body;
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = `Kritická chyba: Nepodařilo se připojit k databázi. ${error.message}`;
        if (container) {
            container.innerHTML = '';
            container.appendChild(errorDiv);
        } else {
            document.body.innerHTML = `<div class="error-message" style="padding:20px; text-align:center;">Kritická chyba: ${error.message}</div>`;
        }
        return false;
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);