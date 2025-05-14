
// dashboard/bethebest.js
// Verze: 7.8 - Finální verze s AI úkoly, timeouty a vylepšeným logováním

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
const SUPABASE_FETCH_TIMEOUT = 15000; // 15 sekund
const GEMINI_FETCH_TIMEOUT = 25000; // 25 sekund

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
    console.log("[DEBUG v7.8 Cache] DOM elements cached.");
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
    if (!calendarGrid || !monthYearDisplay) { console.error("[Calendar v7.8] Chybí elementy."); return; }
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
        if (log) { dayCell.classList.add('has-log'); dayCell.innerHTML += `<div class="log-preview"><strong>${sanitizeHTML(log.topic) || 'Téma'}</strong><br>${sanitizeHTML(log.details)?.substring(0,50)||(log.details ? '...' : 'Žádné detaily')}</div>`; }
        dayCell.addEventListener('click', () => openLearningLogModal(dateStr));
        calendarGrid.appendChild(dayCell);
    }
    console.log(`[Calendar v7.8] Vykreslen pro ${monthYearDisplay.textContent}.`);
}

function changeMonth(offset) {
    if (isLoadingCalendarLogs) { showNotification("Kalendář se načítá...", "info", 1500); return; }
    currentDisplayedMonth += offset;
    if (currentDisplayedMonth < 0) { currentDisplayedMonth = 11; currentDisplayedYear--; }
    else if (currentDisplayedMonth > 11) { currentDisplayedMonth = 0; currentDisplayedYear++; }
    loadLogsForMonthAndRenderCalendar();
}

async function loadLogsForMonthAndRenderCalendar() {
    if (!currentUser || !supabaseClient) { if (typeof renderCalendar === 'function') renderCalendar(); return; }
    if (isLoadingCalendarLogs) { console.warn("[LogsCal v7.8] Duplicitní volání."); return; }
    isLoadingCalendarLogs = true;
    const displayMonth = currentDisplayedMonth, displayYear = currentDisplayedYear;
    console.log(`[LogsCal v7.8] START: isLoading. Cíl: ${displayYear}-${String(displayMonth + 1).padStart(2, '0')}`);
    if (monthYearDisplay) monthYearDisplay.textContent = "Načítám...";
    const startDate = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-01`;
    const endDate = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${new Date(displayYear, displayMonth + 1, 0).getDate()}`;

    try {
        const fetchPromise = supabaseClient.from('learning_logs_detailed').select('log_date, topic, details').eq('user_id', currentUser.id).gte('log_date', startDate).lte('log_date', endDate);
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Supabase timeout (logs)")), SUPABASE_FETCH_TIMEOUT));
        const { data, error } = await Promise.race([fetchPromise, timeout]);
        if (error) throw error;
        Object.keys(learningLogsCache).forEach(k => { if (k.startsWith(`${displayYear}-${String(displayMonth+1).padStart(2,'0')}`)) delete learningLogsCache[k]; });
        if (data) data.forEach(log => learningLogsCache[log.log_date] = { topic: log.topic, details: log.details });
        console.log(`[LogsCal v7.8] Logy načteny (${data?.length || 0}).`);
        if (typeof renderCalendar === 'function') renderCalendar();
    } catch (err) {
        console.error("[LogsCal v7.8] Chyba:", err.message);
        if (typeof showNotification === 'function') showNotification(`Chyba načítání záznamů: ${err.message.includes("timeout") ? "Server neodpověděl." : err.message}`, "error");
        if (typeof renderCalendar === 'function') renderCalendar();
    } finally {
        isLoadingCalendarLogs = false;
        if (monthYearDisplay && currentDisplayedMonth === displayMonth && currentDisplayedYear === displayYear) {
            monthYearDisplay.textContent = `${new Date(displayYear, displayMonth).toLocaleString('cs-CZ', { month: 'long' })} ${displayYear}`;
        }
        console.log(`[LogsCal v7.8] KONEC: isLoading je ${isLoadingCalendarLogs}.`);
    }
}

function openLearningLogModal(dateStr) {
    if (!learningLogModal) return;
    const dateObj = new Date(dateStr + 'T00:00:00Z'); // Pro konzistentní parsování
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
        fetchAndDisplayTasks(true); // Force refresh tasks
    } catch (err) { showNotification(`Chyba ukládání: ${err.message}`, "error"); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Uložit záznam'; }
}

async function generateTasksFromTopics(topicsContext, existingTasksCount = 0) {
    console.log(`[AI Tasks v7.8] Generuji úkoly. Kontext: "${topicsContext.substring(0, 100)}...", Existující: ${existingTasksCount}`);
    if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) {
        return [{ title: "Chyba konfigurace AI", description: "Chybí platný API klíč.", topic: "Systém" }];
    }
    const prompt = `Jsi AI asistent pro plánování studia. Na základě těchto probraných témat navrhni 3-4 konkrétní, stručné úkoly nebo otázky k zopakování. Každý úkol musí mít: "title" (max 5 slov), "description" (max 2 krátké věty), "topic" (jedno z probraných témat). Odpověz jako pole JSON objektů. Již existuje ${existingTasksCount} úkolů, negeneruj duplikáty. Témata:\n${topicsContext}`;
    try {
        const requestBody = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.75, maxOutputTokens: 1200 }};
        const fetchPromise = fetch(GEMINI_API_URL_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini API timeout (tasks)")), GEMINI_FETCH_TIMEOUT));
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (!response.ok) { const errTxt = await response.text(); throw new Error(`Gemini API chyba ${response.status}: ${errTxt}`); }
        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) throw new Error("AI nevrátilo platnou odpověď.");
        const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
        let parsedTasks = jsonMatch && jsonMatch[1] ? JSON.parse(jsonMatch[1]) : JSON.parse(textResponse);
        if (!Array.isArray(parsedTasks)) parsedTasks = typeof parsedTasks === 'object' && parsedTasks !== null ? [parsedTasks] : [];
        return parsedTasks.filter(t => t && t.title && t.description && t.topic); // Základní validace
    } catch (error) {
        console.error("[AI Tasks v7.8] Chyba:", error.message);
        const desc = error.message.includes("timeout") ? "AI neodpovědělo včas." : `Chyba generování: ${error.message}`;
        return [{ title: "Chyba AI", description: desc, topic: "Systém" }];
    }
}

async function fetchAndDisplayTasks(forceRefresh = false) {
    if (!currentUser || !tasksFeed || !supabaseClient) {
        if (tasksFeed) tasksFeed.innerHTML = '<p class="error-message">Chyba inicializace úkolů.</p>';
        return;
    }
    if (isLoadingTasks && !forceRefresh) { console.log("[Tasks v7.8] Načítání již probíhá."); return; }
    isLoadingTasks = true;
    tasksFeed.innerHTML = '<div class="loader visible-loader">Načítám AI úkoly...</div>';
    if (loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');

    try {
        const { data: logs, error: logError } = await supabaseClient.from('learning_logs_detailed').select('topic, details, log_date').eq('user_id', currentUser.id).order('log_date', { ascending: false }).limit(10);
        if (logError) throw new Error(`DB chyba (logy pro AI): ${logError.message}`);

        if (forceRefresh || logs?.length > 0) { // Generovat vždy, pokud jsou logy, nebo při forceRefresh
            const topicsContext = logs && logs.length > 0 ? logs.map(l => `- ${new Date(l.log_date+'T00:00:00Z').toLocaleDateString('cs-CZ',{timeZone:'Europe/Prague'})}, Téma: ${l.topic}${l.details ? (': '+l.details.substring(0,70)+'...') : ''}`).join("\n") : "Žádná nedávná témata. Navrhni obecné opakovací otázky z matematiky pro 9. třídu ZŠ.";
            if (forceRefresh || topicsContext !== lastTaskTopicContext || generatedTasks.length === 0) {
                lastTaskTopicContext = topicsContext;
                generatedTasks = await generateTasksFromTopics(topicsContext, generatedTasks.length);
            }
        } else {
            generatedTasks = []; // Žádné logy, žádné specifické úkoly
        }
        displayTasks();
    } catch (err) {
        console.error("[Tasks v7.8] Chyba:", err);
        tasksFeed.innerHTML = `<p class="error-message">Nepodařilo se načíst AI úkoly: ${err.message}</p>`;
        generatedTasks = [];
    } finally {
        isLoadingTasks = false;
        // loadMoreTasksButton zůstává skrytý, jelikož není implementováno stránkování úkolů
        console.log("[Tasks v7.8] Dokončeno.");
    }
}

function displayTasks() {
    if (!tasksFeed) return;
    if (generatedTasks.length === 0) {
        tasksFeed.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px;">Žádné doporučené úkoly. Zkuste přidat záznamy do kalendáře!</p>';
        return;
    }
    tasksFeed.innerHTML = '';
    generatedTasks.forEach((task, i) => {
        if (!task || !task.title) return;
        const el = document.createElement('div'); el.className = 'task-item'; el.id = `task-${i}-${Date.now()}`;
        el.innerHTML = `<h3>${sanitizeHTML(task.title)}</h3><p>${sanitizeHTML(task.description||"")}</p>${task.topic ? `<small class="task-topic">Téma: ${sanitizeHTML(task.topic)}</small>` : ''}`;
        tasksFeed.appendChild(el);
    });
}

async function initializeApp() {
    console.log("[DEBUG v7.8 InitApp] Start");
    cacheDOMElements();
    if (!initializeSupabase()) return;
    setupAuthListeners();

    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => changeMonth(1));
    if (closeLogModalBtn) closeLogModalBtn.addEventListener('click', closeLearningLogModal);
    if (dailyLearningLogForm) dailyLearningLogForm.addEventListener('submit', handleDailyLogSubmit);

    console.log("[DEBUG v7.8 InitApp] Nastavuji onAuthStateChange listener...");
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log(`[DEBUG v7.8 AuthChange] Event: ${event}, Session: ${!!session}, Initialized: ${isUserSessionInitialized}`);
        if (session && session.user) {
            const isNew = !currentUser || currentUser.id !== session.user.id || !isUserSessionInitialized;
            currentUser = session.user;
            if (isNew) {
                console.log('[DEBUG v7.8 AuthChange] Nový uživatel/první init. Načítám data...');
                isUserSessionInitialized = false;
                if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
                if (authSection) authSection.classList.add('hidden');
                if (appSection) appSection.classList.remove('hidden');
                try {
                    await loadLogsForMonthAndRenderCalendar();
                    await fetchAndDisplayTasks(true);
                    isUserSessionInitialized = true;
                    console.log('[DEBUG v7.8 AuthChange] Data úspěšně inicializována.');
                } catch (initError) {
                    console.error("[DEBUG v7.8 AuthChange] Chyba inicializace dat:", initError);
                    showNotification("Chyba při načítání dat po přihlášení.", "error");
                }
            } else {
                console.log('[DEBUG v7.8 AuthChange] Session obnovena, žádná akce.');
            }
        } else {
            currentUser = null; isUserSessionInitialized = false;
            if (userEmailDisplay) userEmailDisplay.textContent = '';
            if (authSection) authSection.classList.remove('hidden');
            if (appSection) appSection.classList.add('hidden');
            learningLogsCache = {}; generatedTasks = [];
            if(calendarGrid) calendarGrid.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Přihlaste se pro zobrazení kalendáře.</p>';
            if(tasksFeed) tasksFeed.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Přihlaste se pro AI úkoly.</p>';
            if(loadMoreTasksButton) loadMoreTasksButton.classList.add('hidden');
        }
    });
    console.log("[DEBUG v7.8 InitApp] Konec");
}

function initializeSupabase() {
    try {
        if (!window.supabase?.createClient) throw new Error("Supabase library error.");
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        if (!supabaseClient) throw new Error("Supabase client creation failed.");
        window.supabase = supabaseClient; // Pro konzoli
        console.log('[Supabase] Klient inicializován (v7.8).');
        return true;
    } catch (error) {
        console.error('[Supabase] Init Chyba (v7.8):', error.message);
        const el = document.querySelector('.container') || document.body;
        el.innerHTML = `<div class="error-message" style="padding:20px;text-align:center;">Kritická chyba DB: ${error.message}</div>`;
        return false;
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);