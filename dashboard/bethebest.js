// dashboard/bethebest.js
// Verze: 7.9.0 - Aktivace "Load More Tasks", rozšířený kontext pro AI, vylepšení UX
// --- Konstanty a Supabase klient ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
let supabaseClient = null;

// API Klíč pro Gemini - !! NAHRAĎTE SVÝM SKUTEČNÝM KLÍČEM !!
const GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // <--- ZDE VLOŽTE VÁŠ KLÍČ
const GEMINI_API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- HTML Elementy ---
let authSection, appSection, loginFormContainer, registerFormContainer, notificationArea,
    loginForm, registerForm, logoutButton, userEmailDisplay,
    calendarGrid, monthYearDisplay, prevMonthBtn, nextMonthBtn,
    learningLogModal, closeLogModalBtn, dailyLearningLogForm, logSelectedDateInput,
    logDateDisplay, logTopicInput, logDetailsInput,
    tasksFeed, loadMoreTasksButton, loadMoreLoader; // Přidán loadMoreLoader

let currentUser = null;
let currentDisplayedMonth = new Date().getMonth();
let currentDisplayedYear = new Date().getFullYear();
let learningLogsCache = {};

let generatedTasks = []; // Bude akumulovat úkoly
let lastTaskTopicContext = "";
let isLoadingTasks = false;
let isLoadingMoreTasks = false; // Pro "Load More"

let isLoadingCalendarLogs = false;
let isUserSessionInitialized = false;
const SUPABASE_FETCH_TIMEOUT = 30000;
const GEMINI_FETCH_TIMEOUT = 25000;
const LOG_FETCH_LIMIT_FOR_AI = 25; // Kolik posledních logů načíst pro AI kontext

/**
 * Helper function for consistent debug logging.
 * @param {string} module - The name of the module/component logging the message.
 * @param {string} message - The log message.
 * @param  {...any} args - Additional arguments to log.
 */
function logDebug(module, message, ...args) {
    console.log(`[DEBUG v7.9.0 ${module}] ${message}`, ...args);
}

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
    loadMoreLoader = document.getElementById('loadMoreLoader'); // Cache loaderu
    logDebug("Cache", "DOM elements cached.");
}

function showNotification(message, type = 'info', duration = 3500) {
    if (!notificationArea) { console.warn("Notification area not found."); return; }
    const toastId = `toast-${Date.now()}`;
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.id = toastId;
    notification.innerHTML = `<i class="toast-icon"></i><div class="toast-message">${sanitizeHTML(message)}</div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`;
    const iconElement = notification.querySelector('.toast-icon');
    iconElement.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`;
    notification.querySelector('.toast-close').addEventListener('click', () => { notification.classList.remove('show'); setTimeout(() => notification.remove(), 400); });
    notificationArea.appendChild(notification);
    requestAnimationFrame(() => notification.classList.add('show'));
    setTimeout(() => { if (notification.parentElement) { notification.classList.remove('show'); setTimeout(() => notification.remove(), 400); } }, duration);
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
    }
};

function setupAuthListeners() {
    if (loginForm) loginForm.addEventListener('submit', async (event) => { event.preventDefault(); const { email, password } = loginForm; try { const { error } = await supabaseClient.auth.signInWithPassword({ email: email.value, password: password.value }); if (error) throw error; showNotification("Přihlášení úspěšné!", "success"); } catch (error) { showNotification(`Chyba přihlášení: ${error.message}`, "error"); }});
    if (registerForm) registerForm.addEventListener('submit', async (event) => { event.preventDefault(); const { email, password } = registerForm; try { const { error } = await supabaseClient.auth.signUp({ email: email.value, password: password.value }); if (error) throw error; showNotification("Registrace úspěšná! Zkontrolujte email.", "success"); } catch (error) { showNotification(`Chyba registrace: ${error.message}`, "error"); }});
    if (logoutButton) logoutButton.addEventListener('click', async () => { try { const { error } = await supabaseClient.auth.signOut(); if (error) throw error; showNotification("Odhlášení úspěšné.", "info"); } catch (error) { showNotification(`Chyba odhlášení: ${error.message}`, "error"); }});
}

function renderCalendar() {
    if (!calendarGrid || !monthYearDisplay) { console.error("[Calendar v7.9.0] Chybí elementy."); return; }
    calendarGrid.innerHTML = '';
    const firstDay = new Date(currentDisplayedYear, currentDisplayedMonth, 1);
    monthYearDisplay.textContent = `${firstDay.toLocaleString('cs-CZ', { month: 'long' })} ${currentDisplayedYear}`;
    let startingDay = firstDay.getDay(); startingDay = (startingDay === 0) ? 6 : startingDay - 1;
    for (let i = 0; i < startingDay; i++) { const emptyCell = document.createElement('div'); emptyCell.className = 'calendar-day-cell empty-cell'; calendarGrid.appendChild(emptyCell); }
    const daysInMonth = new Date(currentDisplayedYear, currentDisplayedMonth + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div'); dayCell.className = 'calendar-day-cell';
        const dateStr = `${currentDisplayedYear}-${String(currentDisplayedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dayCell.dataset.date = dateStr;
        dayCell.innerHTML = `<span class="day-number">${day}</span>`;
        const log = learningLogsCache[dateStr];
        if (log) {
            dayCell.classList.add('has-log');
            const topicDisplay = sanitizeHTML(log.topic) || 'Téma';
            const detailsPreview = log.details ? sanitizeHTML(log.details).substring(0,50) + (log.details.length > 50 ? '...' : '') : 'Žádné detaily';
            dayCell.innerHTML += `<div class="log-preview"><strong>${topicDisplay}</strong><br>${detailsPreview}</div>`;
        }
        dayCell.addEventListener('click', () => openLearningLogModal(dateStr));
        calendarGrid.appendChild(dayCell);
    }
    logDebug("Calendar", `Vykreslen pro ${monthYearDisplay.textContent}.`);
}

function changeMonth(offset) {
    if (isLoadingCalendarLogs) { showNotification("Kalendář se načítá...", "info", 1500); return; }
    currentDisplayedMonth += offset;
    if (currentDisplayedMonth < 0) { currentDisplayedMonth = 11; currentDisplayedYear--; }
    else if (currentDisplayedMonth > 11) { currentDisplayedMonth = 0; currentDisplayedYear++; }
    loadLogsForMonthAndRenderCalendar();
}

async function loadLogsForMonthAndRenderCalendar() {
    if (!currentUser || !supabaseClient) {
        logDebug("LogsCal", "Chybí currentUser nebo supabaseClient, renderuji prázdný kalendář.");
        if (typeof renderCalendar === 'function') renderCalendar();
        return;
    }
    if (isLoadingCalendarLogs) {
        logDebug("LogsCal", "Duplicitní volání, ale je aktivní isLoadingCalendarLogs. Přerušuji.");
        return;
    }
    isLoadingCalendarLogs = true;
    const displayMonth = currentDisplayedMonth, displayYear = currentDisplayedYear;
    logDebug("LogsCal", `START: isLoading. Cíl: ${displayYear}-${String(displayMonth + 1).padStart(2, '0')}`);
    if (monthYearDisplay) monthYearDisplay.textContent = "Načítám...";

    const startDate = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-01`;
    const endDate = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${new Date(displayYear, displayMonth + 1, 0).getDate()}`;

    try {
        logDebug("LogsCal", `Supabase dotaz pro uživatele ${currentUser.id}: od ${startDate} do ${endDate}`);
        const fetchPromise = supabaseClient
            .from('learning_logs_detailed')
            .select('log_date, topic, details', { count: 'exact' })
            .eq('user_id', currentUser.id)
            .gte('log_date', startDate)
            .lte('log_date', endDate);

        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Supabase timeout (logs)")), SUPABASE_FETCH_TIMEOUT)
        );

        const { data, error, count } = await Promise.race([fetchPromise, timeout]);

        if (error) {
            logDebug("LogsCal", `Supabase error object:`, error);
            throw error;
        }
        
        Object.keys(learningLogsCache).forEach(key => {
            if (key.startsWith(`${displayYear}-${String(displayMonth + 1).padStart(2, '0')}`)) {
                delete learningLogsCache[key];
            }
        });

        if (data) {
            data.forEach(log => {
                learningLogsCache[log.log_date] = { topic: log.topic, details: log.details };
            });
        }
        logDebug("LogsCal", `Logy zpracovány, cache aktualizována. Načteno: ${data ? data.length : 0}, Celkem dle count: ${count}`);
        if (typeof renderCalendar === 'function') renderCalendar();

    } catch (err) {
        console.error(`[LogsCal v7.9.0] Chyba v catch bloku: ${err.message}`, err);
        let userMessage = `Chyba načítání záznamů: ${err.message.includes("timeout") ? "Server neodpověděl včas (" + (SUPABASE_FETCH_TIMEOUT/1000) + "s)." : err.message}.`;
        if (err.message.includes("timeout")) {
            userMessage += " Zkontrolujte RLS politiky na tabulce 'learning_logs_detailed' a velikost dat.";
        }
        if (typeof showNotification === 'function') showNotification(userMessage, "error", 10000);
        if (typeof renderCalendar === 'function') renderCalendar();
    } finally {
        isLoadingCalendarLogs = false;
        if (monthYearDisplay && currentDisplayedMonth === displayMonth && currentDisplayedYear === displayYear) {
            monthYearDisplay.textContent = `${new Date(displayYear, displayMonth).toLocaleString('cs-CZ', { month: 'long' })} ${displayYear}`;
        }
        logDebug("LogsCal", `KONEC: isLoading je ${isLoadingCalendarLogs}.`);
    }
}

function openLearningLogModal(dateStr) {
    if (!learningLogModal) return;
    const dateObj = new Date(dateStr + 'T00:00:00Z'); // Zajistit UTC interpretaci data
    logDateDisplay.textContent = dateObj.toLocaleDateString('cs-CZ', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Prague' });
    logSelectedDateInput.value = dateStr;
    const log = learningLogsCache[dateStr];
    logTopicInput.value = log?.topic || '';
    logDetailsInput.value = log?.details || '';
    learningLogModal.style.display = "flex";
    logTopicInput.focus();
}
function closeLearningLogModal() { if (learningLogModal) learningLogModal.style.display = "none"; }

async function handleDailyLogSubmit(event) {
    event.preventDefault();
    if (!currentUser || !supabaseClient) { showNotification("Nejste přihlášeni.", "error"); return; }
    const date = logSelectedDateInput.value;
    const topic = logTopicInput.value.trim();
    const details = logDetailsInput.value.trim();
    if (!date || !topic) { showNotification("Datum a téma jsou povinné.", "error"); return; }
    const btn = dailyLearningLogForm.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...';
    try {
        const { error } = await supabaseClient.from('learning_logs_detailed').upsert({ user_id: currentUser.id, log_date: date, topic, details }, { onConflict: 'user_id, log_date' });
        if (error) throw error;
        learningLogsCache[date] = { topic, details };
        showNotification("Záznam uložen!", "success");
        closeLearningLogModal();
        renderCalendar();
        await fetchAndDisplayTasks(true); // true pro forceRefresh, aby se úkoly přegenerovaly s novým logem
    } catch (err) { showNotification(`Chyba ukládání: ${err.message}`, "error"); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Uložit záznam'; }
}

async function generateTasksFromTopics(topicsContext, existingTasksCount = 0, existingTaskTitles = []) {
    logDebug("AI Tasks", `Generuji úkoly. Kontext (prvních 100 znaků): "${topicsContext.substring(0, 100)}...", Existující počet: ${existingTasksCount}, Existující názvy: ${existingTaskTitles.join(', ')}`);
    if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) {
        return [{ title: "Chyba konfigurace AI", description: "Chybí platný API klíč Gemini.", topic: "Systém" }];
    }

    const prompt = `Jsi AI asistent pro plánování studia. Uživatel studuje následující témata (některé nedávno, jiné možná dříve). Navrhni 3-4 RŮZNORODÉ úkoly nebo otázky k procvičení a zopakování. Úkoly by měly pomoci zopakovat nedávno probrané věci a také osvěžit znalosti starších témat, pokud jsou relevantní z poskytnutého kontextu. Každý úkol musí mít: "title" (název, max 7 slov), "description" (popis, 1-2 stručné věty), "topic" (jedno z probraných témat nebo obecnější téma, pokud je to vhodné). Odpověz POUZE jako pole JSON objektů. Již bylo zobrazeno ${existingTasksCount} úkolů s následujícími názvy: '${existingTaskTitles.join("', '")}'. Snaž se negenerovat úkoly s identickými nebo velmi podobnými názvy jako ty existující. Témata a studijní historie:\n${topicsContext}`;

    try {
        const requestBody = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.75, maxOutputTokens: 1200 }};
        const fetchPromise = fetch(GEMINI_API_URL_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini API timeout (tasks)")), GEMINI_FETCH_TIMEOUT));
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (!response.ok) { const errTxt = await response.text(); throw new Error(`Gemini API chyba ${response.status}: ${errTxt}`); }
        const data = await response.json();
        logDebug("AI Tasks", "Gemini response data:", data);
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) {
            if (data.candidates?.[0]?.finishReason === "MAX_TOKENS") {
                 throw new Error("AI odpověď byla oříznuta kvůli limitu tokenů.");
            }
             throw new Error("AI nevrátilo platnou textovou odpověď.");
        }
        logDebug("AI Tasks", "Gemini text response:", textResponse);

        let parsedTasks;
        try {
            // Nejprve zkusíme najít JSON v blocích kódu
            const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch && jsonMatch[1]) {
                parsedTasks = JSON.parse(jsonMatch[1]);
            } else {
                // Pokud není v bloku, zkusíme parsovat přímo (za předpokladu, že odpověď je čistý JSON)
                parsedTasks = JSON.parse(textResponse);
            }
        } catch (parseError) {
            logDebug("AI Tasks", "JSON parsing error:", parseError, "Original text:", textResponse);
            throw new Error(`Chyba parsování odpovědi od AI: ${parseError.message}. Odpověď nebyla validní JSON.`);
        }
        
        if (!Array.isArray(parsedTasks)) parsedTasks = typeof parsedTasks === 'object' && parsedTasks !== null ? [parsedTasks] : [];
        
        const validTasks = parsedTasks.filter(t => t && t.title && t.description && t.topic);
        logDebug("AI Tasks", `Úspěšně vygenerováno a zparsováno ${validTasks.length} úkolů.`);
        return validTasks;

    } catch (error) {
        console.error("[AI Tasks v7.9.0] Chyba:", error.message, error);
        const desc = error.message.includes("timeout") ? "AI neodpovědělo včas." : `Chyba generování: ${error.message}`;
        return [{ title: "Chyba AI", description: desc, topic: "Systém" }];
    }
}

async function fetchAndDisplayTasks(forceRefresh = false, loadMore = false) {
    if (!currentUser || !tasksFeed || !supabaseClient) {
        if (tasksFeed) tasksFeed.innerHTML = '<p class="error-message">Chyba inicializace úkolů. Přihlaste se prosím.</p>';
        if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
        return;
    }

    if (!loadMore && isLoadingTasks) { logDebug("Tasks", "Celkové načítání již probíhá."); return; }
    if (loadMore && isLoadingMoreTasks) { logDebug("Tasks", "Načítání dalších úkolů již probíhá."); return; }

    if (loadMore) {
        isLoadingMoreTasks = true;
        if (loadMoreLoader) loadMoreLoader.style.display = 'flex';
        if (loadMoreTasksButton) loadMoreTasksButton.disabled = true;
    } else {
        isLoadingTasks = true;
        tasksFeed.innerHTML = '<div class="loader visible-loader">Načítám AI úkoly...</div>';
        if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden'); // Skryjeme tlačítko při plném refresh
    }

    try {
        // Pokud je forceRefresh, vyčistíme existující úkoly
        if (forceRefresh && !loadMore) {
            generatedTasks = [];
            lastTaskTopicContext = ""; // Resetujeme kontext, aby se načetl znovu
        }

        const { data: logs, error: logError } = await supabaseClient
            .from('learning_logs_detailed')
            .select('topic, details, log_date')
            .eq('user_id', currentUser.id)
            .order('log_date', { ascending: false })
            .limit(LOG_FETCH_LIMIT_FOR_AI); // Použijeme konstantu pro limit

        if (logError) throw new Error(`DB chyba (logy pro AI): ${logError.message}`);

        let newTasks = [];
        if (logs?.length > 0) {
            const currentTopicsContext = logs.map(l => `- Datum: ${new Date(l.log_date+'T00:00:00Z').toLocaleDateString('cs-CZ',{timeZone:'Europe/Prague'})}, Téma: ${l.topic}${l.details ? (': '+l.details.substring(0,70)+'...') : ''}`).join("\n");
            
            // Generujeme nové úkoly, pokud je forceRefresh, loadMore, nebo se změnil kontext, nebo pokud ještě nemáme žádné úkoly
            if (forceRefresh || loadMore || currentTopicsContext !== lastTaskTopicContext || generatedTasks.length === 0) {
                if (!loadMore) lastTaskTopicContext = currentTopicsContext; // Aktualizujeme kontext jen pokud to není "load more"
                
                const existingTaskTitles = generatedTasks.map(t => t.title);
                newTasks = await generateTasksFromTopics(currentTopicsContext, generatedTasks.length, existingTaskTitles);
                generatedTasks.push(...newTasks); // Přidáme nové úkoly k existujícím
            }
        } else if (generatedTasks.length === 0) { // Pokud nejsou logy a žádné úkoly, zkusíme obecné
            const existingTaskTitles = generatedTasks.map(t => t.title);
            newTasks = await generateTasksFromTopics("Žádná nedávná témata. Navrhni obecné opakovací otázky z běžných školních předmětů (např. matematika, čeština, angličtina) pro studenta střední školy.", generatedTasks.length, existingTaskTitles);
            generatedTasks.push(...newTasks);
        }

        displayTasks(loadMore && newTasks.length > 0); // Předáme info, zda se jednalo o loadMore s novými úkoly

        if (newTasks.length === 0 && loadMore) {
            showNotification("Nebyly nalezeny žádné další nové úkoly.", "info");
        }

    } catch (err) {
        console.error("[Tasks v7.9.0] Chyba:", err);
        if (!loadMore) { // Zobrazíme chybu v hlavním feedu jen pokud to není "load more"
            tasksFeed.innerHTML = `<p class="error-message">Nepodařilo se načíst AI úkoly: ${err.message}</p>`;
        } else { // Pro "load more" zobrazíme notifikaci
            showNotification(`Chyba načítání dalších úkolů: ${err.message}`, "error");
        }
        // generatedTasks zůstanou tak, jak jsou, pokud chyba nastala při loadMore
    } finally {
        if (loadMore) {
            isLoadingMoreTasks = false;
            if (loadMoreLoader) loadMoreLoader.style.display = 'none';
            if (loadMoreTasksButton) loadMoreTasksButton.disabled = false;
        } else {
            isLoadingTasks = false;
        }
        // Zobrazit tlačítko "Load More" pokud máme nějaké úkoly nebo pokud nejsou žádné a neprobíhá error
        if (loadMoreTasksButton) {
             if (generatedTasks.length > 0 || (tasksFeed.querySelector('.error-message') === null) ) {
                loadMoreTasksButton.classList.remove('hidden');
            } else {
                loadMoreTasksButton.classList.add('hidden');
            }
        }
        logDebug("Tasks", "Načítání úkolů dokončeno.");
    }
}

function displayTasks(isAppending = false) {
    if (!tasksFeed) return;

    if (!isAppending) { // Pokud neappendujeme (tj. plný refresh), vyčistíme feed
        tasksFeed.innerHTML = '';
    }

    if (generatedTasks.length === 0 && !isAppending) {
        tasksFeed.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px;">Žádné doporučené úkoly. Zkuste přidat záznamy do kalendáře nebo načíst úkoly!</p>';
        if (loadMoreTasksButton) loadMoreTasksButton.classList.remove('hidden'); // Zobrazíme, i když je prázdno, pro první načtení
        return;
    }
    
    // Pokud appendujeme, chceme přidat jen nové úkoly.
    // Musíme zjistit, které úkoly jsou skutečně nové od posledního renderu.
    // Nejjednodušší je, pokud `generatedTasks` je již aktuální, a my jen renderujeme vše.
    // Pokud displayTasks voláme po `generatedTasks.push(...newTasks)`, stačí iterovat od `generatedTasks.length - newTasks.length`
    // Ale pro jednoduchost, pokud `isAppending` je true, předpokládáme, že `generatedTasks` obsahuje vše a my jen chceme přidat ty, co ještě nejsou v DOM.
    // Bezpečnější je vždy renderovat vše z `generatedTasks` pokud není `isAppending`, jinak přidat jen ty nové.
    // Aktuální logika `WorkspaceAndDisplayTasks` přidává do `generatedTasks` a pak volá `displayTasks`.
    // Takže pokud `isAppending` je false, `tasksFeed.innerHTML = ''` vyčistí vše.
    // Pokud `isAppending` je true, NEČISTÍME, a měli bychom přidat jen nové.
    // Pro jednoduchost, `displayTasks` nyní vždy renderuje celý `generatedTasks` list, pokud není `isAppending` true s novými úkoly.
    // Vylepšená logika: `displayTasks` nyní bude inteligentněji přidávat elementy.

    let startIndex = 0;
    if (isAppending) {
        // Najdeme, kolik task-itemů už v DOM je, a začneme přidávat od dalšího indexu
        startIndex = tasksFeed.querySelectorAll('.task-item').length;
    } else {
        tasksFeed.innerHTML = ''; // Plný refresh
    }
    
    if (generatedTasks.length === 0 && startIndex === 0) { // Znovu kontrola po případném vyčištění
         tasksFeed.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px;">Žádné doporučené úkoly. Zkuste přidat záznamy do kalendáře nebo načíst úkoly!</p>';
    }


    for (let i = startIndex; i < generatedTasks.length; i++) {
        const task = generatedTasks[i];
        if (!task || !task.title) continue;
        const el = document.createElement('div'); 
        el.className = 'task-item'; 
        el.id = `task-${i}-${Date.now()}`; // Unikátní ID
        el.style.animationDelay = `${(i-startIndex) * 0.05}s`; // Malé zpoždění pro animaci
        el.innerHTML = `<h3>${sanitizeHTML(task.title)}</h3><p>${sanitizeHTML(task.description||"")}</p>${task.topic ? `<small class="task-topic">Téma: ${sanitizeHTML(task.topic)}</small>` : ''}`;
        tasksFeed.appendChild(el);
    }
    if (loadMoreTasksButton) {
         loadMoreTasksButton.classList.toggle('hidden', generatedTasks.length === 0 && tasksFeed.querySelector('.error-message') !== null);
    }
}


async function initializeApp() {
    logDebug("InitApp", "Start");
    cacheDOMElements();
    if (!initializeSupabase()) return;
    setupAuthListeners();

    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => changeMonth(1));
    if (closeLogModalBtn) closeLogModalBtn.addEventListener('click', closeLearningLogModal);
    if (dailyLearningLogForm) dailyLearningLogForm.addEventListener('submit', handleDailyLogSubmit);
    if (loadMoreTasksButton) {
        loadMoreTasksButton.addEventListener('click', () => fetchAndDisplayTasks(false, true)); // loadMore = true
    }


    logDebug("InitApp", "Nastavuji onAuthStateChange listener...");
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        logDebug("AuthChange", `Event: ${event}, Session: ${!!session}, UserSessionInitialized: ${isUserSessionInitialized}`);

        if (session && session.user) {
            const isNewUserOrSession = !currentUser || currentUser.id !== session.user.id;
            currentUser = session.user;

            if (isNewUserOrSession || !isUserSessionInitialized) {
                logDebug("AuthChange", "Nový uživatel nebo neinicializovaná session. Startuji inicializaci dat...");
                isUserSessionInitialized = true; 

                if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
                if (authSection) authSection.classList.add('hidden');
                if (appSection) appSection.classList.remove('hidden');
                
                generatedTasks = []; // Resetujeme úkoly pro nového uživatele/session

                try {
                    await loadLogsForMonthAndRenderCalendar();
                    await fetchAndDisplayTasks(true); // forceRefresh = true pro načtení úkolů od začátku
                    logDebug("AuthChange", "Data úspěšně inicializována po prvním načtení.");
                } catch (initError) {
                    console.error("[DEBUG v7.9.0 AuthChange] Chyba inicializace dat:", initError);
                    showNotification("Chyba při načítání dat po přihlášení.", "error");
                    isUserSessionInitialized = false;
                }
            } else {
                logDebug("AuthChange", "Session obnovena nebo již inicializována, žádná akce načítání dat.");
            }
        } else {
            currentUser = null;
            isUserSessionInitialized = false;
            if (userEmailDisplay) userEmailDisplay.textContent = '';
            if (authSection) authSection.classList.remove('hidden');
            if (appSection) appSection.classList.add('hidden');
            learningLogsCache = {}; generatedTasks = [];
            if(calendarGrid) calendarGrid.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Přihlaste se pro zobrazení kalendáře.</p>';
            if(tasksFeed) tasksFeed.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Přihlaste se pro AI úkoly.</p>';
            if(loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
            if(loadMoreLoader) loadMoreLoader.style.display = 'none';
            logDebug("AuthChange", "Uživatel odhlášen, UI resetováno.");
        }
    });
    logDebug("InitApp", "Konec");
}

function initializeSupabase() {
    try {
        if (!window.supabase?.createClient) throw new Error("Supabase library error.");
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        if (!supabaseClient) throw new Error("Supabase client creation failed.");
        window.supabase = supabaseClient; 
        console.log('[Supabase] Klient inicializován (v7.9.0).');
        return true;
    } catch (error) {
        console.error('[Supabase] Init Chyba (v7.9.0):', error.message);
        const el = document.querySelector('.container') || document.body;
        el.innerHTML = `<div class="error-message" style="padding:20px;text-align:center;">Kritická chyba DB: ${error.message}. Aplikace nemůže pokračovat.</div>`;
        // Skryjeme hlavní části, pokud selže DB
        if (authSection) authSection.classList.add('hidden');
        if (appSection) appSection.classList.add('hidden');
        return false;
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);

