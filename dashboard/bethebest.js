// dashboard/bethebest.js
// Verze: 7.3 - Opravy pro nekonečné načítání, lepší správa stavu a logování

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

// --- API Klíč pro Gemini ---
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
let isLoadingCalendarLogs = false; // Nová proměnná pro sledování načítání kalendáře
let isUserSessionInitialized = false;

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
    console.log("[DEBUG v7.3 Cache] DOM elements cached.");
}

function showNotification(message, type = 'info', duration = 3500) {
    if (!notificationArea) { console.warn("Notification area not found"); return; }
    const notificationDiv = document.createElement('div');
    notificationDiv.className = `notification ${type}`;
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    else if (type === 'error') iconClass = 'fa-exclamation-circle';
    else if (type === 'warning') iconClass = 'fa-exclamation-triangle';
    notificationDiv.innerHTML = `<i class="fas ${iconClass} toast-icon"></i><div class="toast-content"><div class="toast-message">${sanitizeHTML(message)}</div></div><button class="toast-close">&times;</button>`;
    notificationDiv.querySelector('.toast-close').onclick = () => {
        notificationDiv.style.opacity = '0'; notificationDiv.style.transform = 'translateX(120%)';
        setTimeout(() => { if (notificationDiv.parentElement) notificationDiv.remove(); }, 600);
    };
    notificationArea.appendChild(notificationDiv);
    requestAnimationFrame(() => { notificationDiv.style.opacity = '1'; notificationDiv.style.transform = 'translateX(0)'; });
    if (duration > 0) {
        setTimeout(() => {
            notificationDiv.style.opacity = '0'; notificationDiv.style.transform = 'translateX(120%)';
            const removeHandler = () => { if (notificationDiv.parentElement) notificationDiv.remove(); notificationDiv.removeEventListener('transitionend', removeHandler); };
            notificationDiv.addEventListener('transitionend', removeHandler);
            setTimeout(() => { if (notificationDiv.parentElement) notificationDiv.remove(); }, 600);
        }, duration);
    }
}

window.toggleAuthForms = () => { /* ... (beze změny) ... */ };
function sanitizeHTML(str) { /* ... (beze změny) ... */ }
function setupAuthListeners() { /* ... (beze změny, ale ujistěte se, že se volá PO initializeSupabase) ... */ }


function renderCalendar() {
    if (!calendarGrid || !monthYearDisplay) { console.error("[Calendar v7.3] Chybí elementy kalendáře."); return; }
    console.log(`[Calendar v7.3] Vykreslování kalendáře pro ${currentDisplayedMonth + 1}/${currentDisplayedYear}`);
    calendarGrid.innerHTML = '';
    const firstDayOfMonth = new Date(currentDisplayedYear, currentDisplayedMonth, 1);
    const lastDayOfMonth = new Date(currentDisplayedYear, currentDisplayedMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    monthYearDisplay.textContent = `${firstDayOfMonth.toLocaleString('cs-CZ', { month: 'long' })} ${currentDisplayedYear}`;
    let startingDay = firstDayOfMonth.getDay();
    startingDay = (startingDay === 0) ? 6 : startingDay - 1;

    for (let i = 0; i < startingDay; i++) { /* ... (empty cells) ... */ }
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
        console.log(`[Calendar v7.3] Pro ${monthYearDisplay.textContent} nebyly nalezeny žádné záznamy v cache.`);
    }
}

function changeMonth(offset) {
    if (isLoadingCalendarLogs || isLoadingTasks) {
        console.warn(`[DEBUG v7.3 ChangeMonth] Zablokováno kvůli probíhajícímu načítání (kalendář: ${isLoadingCalendarLogs}, úkoly: ${isLoadingTasks})`);
        return;
    }
    console.log(`[DEBUG v7.3 ChangeMonth] VSTUP - offset: ${offset}. Aktuální M/R: ${currentDisplayedMonth}/${currentDisplayedYear}`);
    currentDisplayedMonth += offset;
    if (currentDisplayedMonth < 0) {
        currentDisplayedMonth = 11;
        currentDisplayedYear--;
    } else if (currentDisplayedMonth > 11) {
        currentDisplayedMonth = 0;
        currentDisplayedYear++;
    }
    console.log(`[DEBUG v7.3 ChangeMonth] Nový M/R: ${currentDisplayedMonth}/${currentDisplayedYear}. Volám loadLogs...`);
    loadLogsForMonthAndRenderCalendar();
    console.log(`[DEBUG v7.3 ChangeMonth] VÝSTUP - Nový M/R: ${currentDisplayedMonth}/${currentDisplayedYear}.`);
}

async function loadLogsForMonthAndRenderCalendar() {
    if (!currentUser || !supabaseClient) {
        console.warn("[LogsCal v7.3] Chybí uživatel nebo Supabase klient.");
        renderCalendar(); // Vykreslit prázdný/aktuální stav kalendáře
        return;
    }
    if (isLoadingCalendarLogs) {
        console.warn("[LogsCal v7.3] Načítání logů kalendáře již probíhá. Přeskakuji.");
        return;
    }
    isLoadingCalendarLogs = true;
    console.log(`[LogsCal v7.3] isLoadingCalendarLogs nastaveno na true`);

    const startDateStr = `${currentDisplayedYear}-${String(currentDisplayedMonth + 1).padStart(2, '0')}-01`;
    const tempEndDate = new Date(currentDisplayedYear, currentDisplayedMonth + 1, 0); // Poslední den aktuálního měsíce
    const endDateStr = `${tempEndDate.getFullYear()}-${String(tempEndDate.getMonth() + 1).padStart(2, '0')}-${String(tempEndDate.getDate()).padStart(2, '0')}`;
    console.log(`[LogsCal v7.3] Načítání logů pro ${startDateStr} až ${endDateStr}`);

    try {
        const { data, error } = await supabaseClient
            .from('learning_logs_detailed')
            .select('log_date, topic, details')
            .eq('user_id', currentUser.id)
            .gte('log_date', startDateStr)
            .lte('log_date', endDateStr);

        if (error) throw error;

        Object.keys(learningLogsCache).forEach(key => {
            if (key.startsWith(`${currentDisplayedYear}-${String(currentDisplayedMonth + 1).padStart(2, '0')}`)) {
                delete learningLogsCache[key];
            }
        });
        data.forEach(log => { learningLogsCache[log.log_date] = { topic: log.topic, details: log.details }; });
        console.log("[LogsCal v7.3] Logy pro měsíc načteny a cache aktualizována.");
        renderCalendar();
    } catch (err) {
        console.error("[LogsCal v7.3] Chyba načítání logů:", err);
        showNotification("Chyba při načítání záznamů z kalendáře.", "error");
        renderCalendar(); // I při chybě zkusit vykreslit kalendář (může mít stará data nebo být prázdný)
    } finally {
        isLoadingCalendarLogs = false;
        console.log(`[LogsCal v7.3] isLoadingCalendarLogs nastaveno na false`);
    }
}

function openLearningLogModal(dateStr) { /* ... (beze změny od v7.2) ... */ }
function closeLearningLogModal() { /* ... (beze změny od v7.2) ... */ }
async function handleDailyLogSubmit(event) { /* ... (beze změny od v7.2) ... */ }

async function generateTasksFromTopics(topicsContext, existingTasksCount = 0) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'AIzaSyB4l6Yj9AjWfkG2Ob2LCAgTsnSwN-UZQcA' || GEMINI_API_KEY.startsWith("YOUR_")) {
        console.warn("[GeminiTasks v7.3] Chybí platný Gemini API Klíč. Vracím ukázkové úkoly.");
        return [{ title: "Ukázkový úkol: Nastavení API", description: "Nastavte si platný Gemini API klíč v souboru bethebest.js pro generování úkolů na míru.", topic: "Konfigurace" }];
    }
    if (!topicsContext) {
        console.warn("[GeminiTasks v7.3] Žádný kontext témat pro generování úkolů.");
        return [];
    }
    const prompt = `Na základě VŠECH následujících záznamů o učení studenta, vygeneruj 3-5 krátkých, praktických úkolů nebo otázek. Pokud již bylo vygenerováno ${existingTasksCount} úkolů, zkus vytvořit odlišné úkoly nebo se zaměř na pokročilejší aspekty témat. Formát odpovědi: JSON pole objektů. Každý objekt musí mít klíče: "title", "description", "topic". Nedávno studovaná témata:\n---\n${topicsContext}\n---\n`;
    console.log("[GeminiTasks v7.3] Prompt pro Gemini (začátek):", prompt.substring(0, 250) + "...");

    try {
        const response = await fetch(GEMINI_API_URL_BASE, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, topP: 0.9 }})
        });
        if (!response.ok) { 
            const errorText = await response.text();
            console.error('[GeminiTasks v7.3] Gemini API Error Response Text:', errorText);
            let errorData = {}; try { errorData = JSON.parse(errorText); } catch (e) { /* ignore parse error */ }
            throw new Error(`Chyba Gemini API ${response.status}: ${errorData?.error?.message || response.statusText || errorText}`); 
        }
        const data = await response.json();
        console.log("[GeminiTasks v7.3] Surová odpověď od Gemini (začátek):", JSON.stringify(data).substring(0, 300) + "...");
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('[GeminiTasks v7.3] AI nevrátilo žádný text. Response data:', JSON.stringify(data));
            throw new Error('AI nevrátilo žádný text pro úkoly.');
        }

        let jsonString = text;
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch?.[1]) { jsonString = jsonMatch[1]; } 
        else { console.warn("[GeminiTasks v7.3] JSON blok nenalezen v odpovědi AI, zkouším parsovat celý text."); }
        
        console.log("[GeminiTasks v7.3] Řetězec k parsování jako JSON:", jsonString);
        const parsedTasks = JSON.parse(jsonString);

        if (Array.isArray(parsedTasks) && (parsedTasks.length === 0 || parsedTasks.every(t => t && typeof t.title === 'string' && typeof t.description === 'string' && typeof t.topic === 'string'))) {
            if(parsedTasks.length === 0) console.warn("[GeminiTasks v7.3] AI vrátilo prázdné pole úkolů.");
            return parsedTasks;
        } else {
            console.error('[GeminiTasks v7.3] Neplatná struktura JSON od AI:', parsedTasks);
            throw new Error('Neplatná struktura JSON odpovědi od AI pro úkoly.');
        }
    } catch (error) {
        console.error("[GeminiTasks v7.3] Chyba generování úkolů přes Gemini:", error);
        return []; // Vždy vrátit pole, i při chybě
    }
}

async function fetchAndDisplayTasks(forceRefresh = false) {
    if (!currentUser || !tasksFeed) {
        console.warn("[Tasks v7.3] Chybí aktuální uživatel nebo tasksFeed element.");
        if(tasksFeed) tasksFeed.innerHTML = '<p class="error-message" style="text-align:center; padding: 20px;">Chyba: Nelze inicializovat sekci úkolů.</p>';
        return;
    }
    if (isLoadingTasks && !forceRefresh) { console.log("[Tasks v7.3] Načítání úkolů již probíhá."); return; }
    
    console.log(`[Tasks v7.3] Spuštěno fetchAndDisplayTasks (forceRefresh: ${forceRefresh})`);
    isLoadingTasks = true;
    tasksFeed.innerHTML = '<div class="loader visible-loader">Načítám úkoly...</div>';
    if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');

    try {
        console.log("[Tasks v7.3] Načítání logů pro kontext úkolů...");
        const { data: logs, error: logError } = await supabaseClient
            .from('learning_logs_detailed')
            .select('topic, details, log_date')
            .eq('user_id', currentUser.id)
            .order('log_date', { ascending: false })
            .limit(15);

        if (logError) { console.error("[Tasks v7.3] Chyba při načítání logů z DB:", logError); throw new Error(`Chyba databáze: ${logError.message}`);}
        console.log(`[Tasks v7.3] Načteno ${logs ? logs.length : 0} logů pro kontext.`);

        if (forceRefresh) { generatedTasks = []; lastTaskTopicContext = ""; }

        if (logs && logs.length > 0) {
            const topicsContext = logs.map(log => `- Dne ${new Date(log.log_date+'T00:00:00Z').toLocaleDateString('cs-CZ', {timeZone: 'Europe/Prague'})}, Téma: ${log.topic}${log.details ? (': ' + log.details.substring(0, 70) + '...') : ''}`).join("\n");
            
            if (forceRefresh || topicsContext !== lastTaskTopicContext || generatedTasks.length === 0) {
                console.log("[Tasks v7.3] Generuji nové úkoly...");
                lastTaskTopicContext = topicsContext;
                const newTasks = await generateTasksFromTopics(topicsContext, generatedTasks.length);
                generatedTasks = newTasks; // Vždy nahradit aktuální sadou
                console.log(`[Tasks v7.3] Vygenerováno ${generatedTasks.length} úkolů.`);
            } else {
                console.log("[Tasks v7.3] Kontext se nezměnil, není třeba znovu generovat.");
            }
        } else {
            console.log("[Tasks v7.3] Nenalezeny žádné studijní záznamy pro generování úkolů.");
            generatedTasks = [];
        }
        displayTasks();
    } catch (err) {
        console.error("[Tasks v7.3] Chyba v fetchAndDisplayTasks:", err);
        tasksFeed.innerHTML = `<p class="error-message" style="text-align:center; padding:20px;">Nepodařilo se načíst úkoly: ${err.message}</p>`;
        generatedTasks = []; // Zajistit prázdné pole při chybě
    } finally {
        isLoadingTasks = false;
        console.log("[Tasks v7.3] isLoadingTasks nastaveno na false.");
        if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
        console.log("[Tasks v7.3] fetchAndDisplayTasks dokončeno.");
    }
}

function displayTasks() {
    if (!tasksFeed) { console.error("[DisplayTasks v7.3] Element tasksFeed nenalezen."); return; }
    console.log(`[DisplayTasks v7.3] Zobrazuji úkoly. Počet: ${generatedTasks.length}`);

    if (generatedTasks.length === 0) {
        tasksFeed.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px;">Nejsou k dispozici žádné doporučené úkoly. Přidejte studijní záznamy do kalendáře nebo zkuste obnovit později.</p>';
        if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
        console.log("[DisplayTasks v7.3] Zobrazena zpráva 'žádné úkoly'.");
        return;
    }
    tasksFeed.innerHTML = '';
    generatedTasks.forEach((task, index) => { /* ... (renderování taskElement jako předtím) ... */ });
    console.log("[DisplayTasks v7.3] Úkoly zobrazeny.");
    if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
}

async function initializeApp() {
    console.log("[DEBUG v7.3 InitApp] Start");
    cacheDOMElements();
    if (!initializeSupabase()) return;
    setupAuthListeners();
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => changeMonth(1));
    if (closeLogModalBtn) closeLogModalBtn.addEventListener('click', closeLearningLogModal);
    if (dailyLearningLogForm) dailyLearningLogForm.addEventListener('submit', handleDailyLogSubmit);

    console.log("[DEBUG v7.3 InitApp] Nastavuji onAuthStateChange listener...");
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log(`[DEBUG v7.3 AuthChange] Event: ${event}, Session Active: ${!!session}, User Initialized: ${isUserSessionInitialized}`);
        if (session && session.user) {
            const isNewUserOrFirstInit = !currentUser || currentUser.id !== session.user.id || !isUserSessionInitialized;
            currentUser = session.user;
            if (isNewUserOrFirstInit) {
                console.log('[DEBUG v7.3 AuthChange] Uživatel přihlášen/změněn nebo první inicializace. Načítám data...');
                if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
                if (authSection) authSection.classList.add('hidden');
                if (appSection) appSection.classList.remove('hidden');
                try {
                    await loadLogsForMonthAndRenderCalendar();
                    console.log('[DEBUG v7.3 AuthChange] Kalendář načten a vykreslen.');
                    await fetchAndDisplayTasks(true);
                    console.log('[DEBUG v7.3 AuthChange] Úkoly načteny a zobrazeny.');
                    isUserSessionInitialized = true;
                    console.log('[DEBUG v7.3 AuthChange] isUserSessionInitialized nastaveno na true.');
                } catch (initError) {
                    console.error("[DEBUG v7.3 AuthChange] Chyba během inicializace dat po přihlášení:", initError);
                    showNotification("Nepodařilo se plně načíst data po přihlášení. Zkuste obnovit stránku.", "error", 5000);
                    isUserSessionInitialized = false; // Ponechat false, aby se to zkusilo znovu
                    if(tasksFeed && tasksFeed.innerHTML.includes('loader visible-loader')) {
                       tasksFeed.innerHTML = '<p class="error-message" style="text-align:center; padding: 20px;">Počáteční načítání úkolů selhalo. Zkuste obnovit stránku.</p>';
                    }
                }
            } else {
                 console.log('[DEBUG v7.3 AuthChange] Session obnovena, uživatel stejný a již inicializováno. Žádná akce.');
            }
        } else { /* ... (odhlášení jako předtím) ... */ }
    });
    console.log("[DEBUG v7.3 InitApp] Konec");
}

function initializeSupabase() { /* ... (beze změny od v7.2) ... */ }

document.addEventListener('DOMContentLoaded', initializeApp);