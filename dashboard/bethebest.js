// dashboard/bethebest.js
// Verze: 7.4 - Odstraněna sekce úkolů, ponechán pouze kalendář

// --- Konstanty a Supabase klient ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
let supabaseClient = null;

// --- HTML Elementy ---
let authSection, appSection, loginFormContainer, registerFormContainer, notificationArea,
    loginForm, registerForm, logoutButton, userEmailDisplay,
    calendarGrid, monthYearDisplay, prevMonthBtn, nextMonthBtn,
    learningLogModal, closeLogModalBtn, dailyLearningLogForm, logSelectedDateInput,
    logDateDisplay, logTopicInput, logDetailsInput;
    // Odstraněno: tasksFeed, loadMoreTasksButton

let currentUser = null;
let currentDisplayedMonth = new Date().getMonth();
let currentDisplayedYear = new Date().getFullYear();
let learningLogsCache = {};
// Odstraněno: generatedTasks, lastTaskTopicContext, isLoadingTasks
let isLoadingCalendarLogs = false;
let isUserSessionInitialized = false;

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
    // Odstraněno: tasksFeed, loadMoreTasksButton
    console.log("[DEBUG v7.4 Cache - Calendar Only] DOM elements cached.");
}

// Funkce showNotification, toggleAuthForms, sanitizeHTML, setupAuthListeners zůstávají stejné
function showNotification(message, type = 'info', duration = 3500) {
    if (!notificationArea) return;
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
    if (!calendarGrid || !monthYearDisplay) { console.error("[Calendar v7.4] Chybí elementy kalendáře."); return; }
    console.log(`[Calendar v7.4] Vykreslování kalendáře pro ${currentDisplayedMonth + 1}/${currentDisplayedYear}`);
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
        console.log(`[Calendar v7.4] Pro ${monthYearDisplay.textContent} nebyly nalezeny žádné záznamy v cache.`);
    }
    console.log(`[Calendar v7.4] Kalendář vykreslen.`);
}

function changeMonth(offset) {
    console.log(`[DEBUG v7.4 ChangeMonth] POKUS O VOLÁNÍ s offset: ${offset}. isLoadingCalendarLogs: ${isLoadingCalendarLogs}`);
    console.trace("[DEBUG v7.4 ChangeMonth] Zásobník volání pro changeMonth");

    if (isLoadingCalendarLogs) { // Odstraněno isLoadingTasks
        console.warn(`[DEBUG v7.4 ChangeMonth] ZABLOKOVÁNO kvůli probíhajícímu načítání (kalendář: ${isLoadingCalendarLogs})`);
        return;
    }
    console.log(`[DEBUG v7.4 ChangeMonth] VSTUP - offset: ${offset}. Aktuální M/R: ${currentDisplayedMonth}/${currentDisplayedYear}`);
    currentDisplayedMonth += offset;
    if (currentDisplayedMonth < 0) {
        currentDisplayedMonth = 11;
        currentDisplayedYear--;
    } else if (currentDisplayedMonth > 11) {
        currentDisplayedMonth = 0;
        currentDisplayedYear++;
    }
    console.log(`[DEBUG v7.4 ChangeMonth] Nový M/R: ${currentDisplayedMonth}/${currentDisplayedYear}. Volám loadLogs...`);
    loadLogsForMonthAndRenderCalendar();
    console.log(`[DEBUG v7.4 ChangeMonth] VÝSTUP - Nový M/R: ${currentDisplayedMonth}/${currentDisplayedYear}.`);
}

async function loadLogsForMonthAndRenderCalendar() {
    if (!currentUser || !supabaseClient) {
        console.warn("[LogsCal v7.4] Chybí uživatel nebo Supabase klient. Kalendář se nevykreslí/neaktualizuje.");
        renderCalendar();
        return;
    }
    if (isLoadingCalendarLogs) {
        console.warn("[LogsCal v7.4] Načítání logů kalendáře již probíhá. Přeskakuji.");
        return;
    }
    isLoadingCalendarLogs = true;
    console.log(`[LogsCal v7.4] isLoadingCalendarLogs nastaveno na true`);

    const startDateStr = `${currentDisplayedYear}-${String(currentDisplayedMonth + 1).padStart(2, '0')}-01`;
    const tempEndDate = new Date(currentDisplayedYear, currentDisplayedMonth + 1, 0);
    const endDateStr = `${tempEndDate.getFullYear()}-${String(tempEndDate.getMonth() + 1).padStart(2, '0')}-${String(tempEndDate.getDate()).padStart(2, '0')}`;
    console.log(`[LogsCal v7.4] Načítání logů pro ${startDateStr} až ${endDateStr}`);

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
        console.log("[LogsCal v7.4] Logy pro měsíc načteny a cache aktualizována.");
        renderCalendar();
    } catch (err) {
        console.error("[LogsCal v7.4] Chyba načítání logů:", err);
        showNotification("Chyba při načítání záznamů z kalendáře.", "error");
        renderCalendar();
    } finally {
        isLoadingCalendarLogs = false;
        console.log(`[LogsCal v7.4] isLoadingCalendarLogs nastaveno na false`);
    }
}

function openLearningLogModal(dateStr) {
    if (!learningLogModal || !logDateDisplay || !logSelectedDateInput || !logTopicInput || !logDetailsInput) return;
    logDateDisplay.textContent = new Date(dateStr + 'T00:00:00Z').toLocaleDateString('cs-CZ', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Prague' });
    logSelectedDateInput.value = dateStr;
    const existingLog = learningLogsCache[dateStr];
    logTopicInput.value = existingLog ? existingLog.topic : '';
    logDetailsInput.value = existingLog ? existingLog.details : '';
    learningLogModal.style.display = "flex";
    logTopicInput.focus();
}

function closeLearningLogModal() {
    if (learningLogModal) learningLogModal.style.display = "none";
}

async function handleDailyLogSubmit(event) {
    event.preventDefault();
    if (!currentUser || !supabaseClient || !logSelectedDateInput || !logTopicInput || !logDetailsInput) return;
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
            .from('learning_logs_detailed')
            .upsert({ user_id: currentUser.id, log_date: date, topic: topic, details: details }, { onConflict: 'user_id, log_date' })
            .select();

        if (error) throw error;
        learningLogsCache[date] = { topic, details };
        showNotification("Záznam úspěšně uložen!", "success");
        closeLearningLogModal();
        renderCalendar(); // Re-render to show new log or update
    } catch (error) {
        console.error("Chyba ukládání záznamu:", error);
        showNotification(`Chyba ukládání: ${error.message}`, "error");
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    }
}

async function initializeApp() {
    console.log("[DEBUG v7.4 InitApp - Calendar Only] Start");
    cacheDOMElements();
    if (!initializeSupabase()) return;
    setupAuthListeners();

     if (prevMonthBtn) {
         console.log("[DEBUG v7.4 InitApp] Přidávám listener pro prevMonthBtn - AKTIVNÍ");
         prevMonthBtn.addEventListener('click', () => changeMonth(-1));
     } else { console.warn("[DEBUG v7.4 InitApp] prevMonthBtn nenalezen!");}

     if (nextMonthBtn) {
         console.log("[DEBUG v7.4 InitApp] Přidávám listener pro nextMonthBtn - AKTIVNÍ");
         nextMonthBtn.addEventListener('click', () => changeMonth(1));
     } else { console.warn("[DEBUG v7.4 InitApp] nextMonthBtn nenalezen!");}

    if (closeLogModalBtn) closeLogModalBtn.addEventListener('click', closeLearningLogModal);
    if (dailyLearningLogForm) dailyLearningLogForm.addEventListener('submit', handleDailyLogSubmit);

    console.log("[DEBUG v7.4 InitApp] Nastavuji onAuthStateChange listener...");
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log(`[DEBUG v7.4 AuthChange] Event: ${event}, Session Active: ${!!session}, User Initialized: ${isUserSessionInitialized}`);
        if (session && session.user) {
            const isNewUserOrFirstInit = !currentUser || currentUser.id !== session.user.id || !isUserSessionInitialized;
            currentUser = session.user;

            if (isNewUserOrFirstInit) {
                console.log('[DEBUG v7.4 AuthChange] Uživatel přihlášen/změněn nebo první inicializace. Načítám data...');
                isUserSessionInitialized = false;

                if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
                if (authSection) authSection.classList.add('hidden');
                if (appSection) appSection.classList.remove('hidden');

                try {
                    console.log("[DEBUG v7.4 AuthChange] Volám loadLogsForMonthAndRenderCalendar()...");
                    await loadLogsForMonthAndRenderCalendar();
                    console.log('[DEBUG v7.4 AuthChange] Kalendář načten a vykreslen.');

                    // Odstraněno volání fetchAndDisplayTasks
                    isUserSessionInitialized = true;
                    console.log('[DEBUG v7.4 AuthChange] isUserSessionInitialized nastaveno na true.');
                } catch (initError) {
                    console.error("[DEBUG v7.4 AuthChange] Chyba během inicializace dat po přihlášení:", initError);
                    showNotification("Nepodařilo se plně načíst data po přihlášení. Zkuste obnovit stránku.", "error", 5000);
                }
            } else {
                 console.log('[DEBUG v7.4 AuthChange] Session obnovena, uživatel stejný a již inicializováno. Žádná akce.');
            }
        } else {
            currentUser = null;
            isUserSessionInitialized = false;
            console.log('[DEBUG v7.4 AuthChange] Uživatel odhlášen nebo session neaktivní.');
            if (userEmailDisplay) userEmailDisplay.textContent = '';
            if (authSection) authSection.classList.remove('hidden');
            if (appSection) appSection.classList.add('hidden');
            learningLogsCache = {};
            if(calendarGrid) calendarGrid.innerHTML = '<p style="text-align:center; color: var(--text-muted);">Pro zobrazení kalendáře se přihlaste.</p>';
            // Odstraněno čištění tasksFeed a loadMoreTasksButton
        }
    });
    console.log("[DEBUG v7.4 InitApp - Calendar Only] Konec");
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
        window.supabase = supabaseClient; // For potential direct use in console if needed
        console.log('[Supabase] Klient úspěšně inicializován.');
        return true;
    } catch (error) {
        console.error('[Supabase] Initialization failed:', error);
        const container = document.querySelector('.container') || document.body;
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = `Kritická chyba: Nepodařilo se připojit k databázi. ${error.message}`;
        container.innerHTML = ''; // Clear previous content
        container.appendChild(errorDiv);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);