// dashboard/bethebest.js
// Verze: 7.5 - Robustnější správa načítání kalendáře a inicializace

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

let currentUser = null;
let currentDisplayedMonth = new Date().getMonth();
let currentDisplayedYear = new Date().getFullYear();
let learningLogsCache = {}; // Cache pro načtené logy { 'YYYY-MM-DD': { topic, details } }

let isLoadingCalendarLogs = false; // Zámek pro operace načítání logů kalendáře
let isUserSessionInitialized = false; // Zda byla session uživatele plně inicializována

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
    console.log("[DEBUG v7.5 Cache] DOM elements cached.");
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
                // onAuthStateChange se postará o zbytek
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
                // onAuthStateChange se postará o zbytek
            } catch (error) {
                showNotification(`Chyba odhlášení: ${error.message}`, "error");
            }
        });
    }
}

function renderCalendar() {
    if (!calendarGrid || !monthYearDisplay) {
        console.error("[Calendar v7.5] Chybí elementy kalendáře (calendarGrid nebo monthYearDisplay).");
        return;
    }
    console.log(`[Calendar v7.5] Vykreslování kalendáře pro ${currentDisplayedMonth + 1}/${currentDisplayedYear}`);
    calendarGrid.innerHTML = ''; // Vyčistit předchozí buňky
    const firstDayOfMonth = new Date(currentDisplayedYear, currentDisplayedMonth, 1);
    const lastDayOfMonth = new Date(currentDisplayedYear, currentDisplayedMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    monthYearDisplay.textContent = `${firstDayOfMonth.toLocaleString('cs-CZ', { month: 'long' })} ${currentDisplayedYear}`;

    let startingDay = firstDayOfMonth.getDay(); // 0 (Ne) - 6 (So)
    startingDay = (startingDay === 0) ? 6 : startingDay - 1; // Převod na 0 (Po) - 6 (Ne)

    // Přidat prázdné buňky pro dny před začátkem měsíce
    for (let i = 0; i < startingDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('calendar-day-cell', 'empty-cell');
        calendarGrid.appendChild(emptyCell);
    }

    // Přidat buňky pro každý den v měsíci
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
    console.log(`[Calendar v7.5] Kalendář pro ${monthYearDisplay.textContent} vykreslen.`);
}

function changeMonth(offset) {
    console.log(`[DEBUG v7.5 ChangeMonth] POKUS O VOLÁNÍ s offset: ${offset}. isLoadingCalendarLogs: ${isLoadingCalendarLogs}`);

    if (isLoadingCalendarLogs) {
        console.warn(`[DEBUG v7.5 ChangeMonth] ZABLOKOVÁNO: Načítání kalendáře již probíhá.`);
        showNotification("Kalendář se stále načítá, počkejte prosím.", "info", 2000);
        return;
    }

    console.log(`[DEBUG v7.5 ChangeMonth] VSTUP - offset: ${offset}. Aktuální M/R: ${currentDisplayedMonth}/${currentDisplayedYear}`);
    currentDisplayedMonth += offset;
    if (currentDisplayedMonth < 0) {
        currentDisplayedMonth = 11;
        currentDisplayedYear--;
    } else if (currentDisplayedMonth > 11) {
        currentDisplayedMonth = 0;
        currentDisplayedYear++;
    }
    console.log(`[DEBUG v7.5 ChangeMonth] Nový M/R: ${currentDisplayedMonth}/${currentDisplayedYear}. Volám loadLogs...`);
    loadLogsForMonthAndRenderCalendar(); // Tato funkce nyní nastaví isLoadingCalendarLogs
    console.log(`[DEBUG v7.5 ChangeMonth] VÝSTUP - Nový M/R: ${currentDisplayedMonth}/${currentDisplayedYear}.`);
}

async function loadLogsForMonthAndRenderCalendar() {
    if (!currentUser || !supabaseClient) {
        console.warn("[LogsCal v7.5] Chybí uživatel nebo Supabase klient. Kalendář se nevykreslí/neaktualizuje.");
        if (typeof renderCalendar === 'function') renderCalendar();
        return;
    }

    if (isLoadingCalendarLogs) {
        console.warn("[LogsCal v7.5] Duplicitní volání loadLogsForMonthAndRenderCalendar, zatímco již probíhá načítání. Ignoruji.");
        return;
    }

    isLoadingCalendarLogs = true;
    const displayMonthForLog = currentDisplayedMonth; // Uložit hodnoty PŘED asynchronní operací
    const displayYearForLog = currentDisplayedYear;
    console.log(`[LogsCal v7.5] isLoadingCalendarLogs nastaveno na true. Cílové datum: ${displayYearForLog}-${String(displayMonthForLog + 1).padStart(2, '0')}`);

    if (monthYearDisplay) monthYearDisplay.textContent = "Načítám...";

    const startDateStr = `${displayYearForLog}-${String(displayMonthForLog + 1).padStart(2, '0')}-01`;
    const tempEndDate = new Date(displayYearForLog, displayMonthForLog + 1, 0);
    const endDateStr = `${tempEndDate.getFullYear()}-${String(tempEndDate.getMonth() + 1).padStart(2, '0')}-${String(tempEndDate.getDate()).padStart(2, '0')}`;
    console.log(`[LogsCal v7.5] Načítání logů pro ${startDateStr} až ${endDateStr}`);

    try {
        const { data, error } = await supabaseClient
            .from('learning_logs_detailed') // Ujistěte se, že tento název tabulky je správný!
            .select('log_date, topic, details')
            .eq('user_id', currentUser.id)
            .gte('log_date', startDateStr)
            .lte('log_date', endDateStr);

        if (error) {
            console.error("[LogsCal v7.5] Supabase chyba při načítání logů:", error);
            throw error;
        }

        // Vyčistit cache POUZE pro aktuálně načítaný měsíc
        Object.keys(learningLogsCache).forEach(key => {
            if (key.startsWith(`${displayYearForLog}-${String(displayMonthForLog + 1).padStart(2, '0')}`)) {
                delete learningLogsCache[key];
            }
        });

        if (data) {
            data.forEach(log => { learningLogsCache[log.log_date] = { topic: log.topic, details: log.details }; });
            console.log(`[LogsCal v7.5] Logy pro měsíc načteny (${data.length} záznamů) a cache aktualizována.`);
        } else {
            console.log("[LogsCal v7.5] Nebyla vrácena žádná data ze Supabase pro daný měsíc.");
        }
        if (typeof renderCalendar === 'function') renderCalendar();
    } catch (err) {
        console.error("[LogsCal v7.5] Chyba zpracování logů:", err);
        if (typeof showNotification === 'function') showNotification("Chyba při načítání záznamů z kalendáře.", "error");
        if (typeof renderCalendar === 'function') renderCalendar(); // I při chybě se pokusit vykreslit (prázdný/stará cache)
    } finally {
        isLoadingCalendarLogs = false; // Vždy resetovat zámek
        console.log(`[LogsCal v7.5] isLoadingCalendarLogs nastaveno na false. Cílové datum: ${displayYearForLog}-${String(displayMonthForLog + 1).padStart(2, '0')}`);
        // Obnovit text měsíce/roku, pokud se mezitím nezměnil uživatelem
        if (monthYearDisplay && currentDisplayedMonth === displayMonthForLog && currentDisplayedYear === displayYearForLog) {
             const firstDay = new Date(currentDisplayedYear, currentDisplayedMonth, 1);
             monthYearDisplay.textContent = `${firstDay.toLocaleString('cs-CZ', { month: 'long' })} ${currentDisplayedYear}`;
        } else if (monthYearDisplay) {
            // Pokud se mezitím měsíc změnil, monthYearDisplay se aktualizuje v renderCalendar() při příštím volání
            console.log("[LogsCal v7.5] Měsíc byl změněn během načítání, monthYearDisplay se neaktualizuje zde.");
        }
    }
}

function openLearningLogModal(dateStr) {
    if (!learningLogModal || !logDateDisplay || !logSelectedDateInput || !logTopicInput || !logDetailsInput) {
        console.error("Chybí elementy modálního okna pro log.");
        return;
    }
    const dateObj = new Date(dateStr + 'T00:00:00'); // Zajistit správné zacházení s časovou zónou
    logDateDisplay.textContent = dateObj.toLocaleDateString('cs-CZ', { year: 'numeric', month: 'long', day: 'numeric' });
    logSelectedDateInput.value = dateStr;

    const existingLog = learningLogsCache[dateStr];
    logTopicInput.value = existingLog ? (existingLog.topic || '') : '';
    logDetailsInput.value = existingLog ? (existingLog.details || '') : '';

    learningLogModal.style.display = "flex";
    logTopicInput.focus();
}

function closeLearningLogModal() {
    if (learningLogModal) {
        learningLogModal.style.display = "none";
    }
}

async function handleDailyLogSubmit(event) {
    event.preventDefault();
    if (!currentUser || !supabaseClient || !logSelectedDateInput || !logTopicInput || !logDetailsInput) {
        showNotification("Chyba: Nelze uložit záznam, chybí interní data.", "error");
        return;
    }

    const date = logSelectedDateInput.value;
    const topic = logTopicInput.value.trim();
    const details = logDetailsInput.value.trim();

    if (!date || !topic) {
        showNotification("Datum a téma jsou povinné.", "error");
        return;
    }

    const submitButton = dailyLearningLogForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...';

    try {
        // Používáme 'learning_logs_detailed' - ujistěte se, že tento název odpovídá vaší DB!
        const { data, error } = await supabaseClient
            .from('learning_logs_detailed')
            .upsert({ user_id: currentUser.id, log_date: date, topic: topic, details: details }, { onConflict: 'user_id, log_date' })
            .select(); // Přidáno select() pro vrácení dat po operaci

        if (error) throw error;

        learningLogsCache[date] = { topic, details }; // Aktualizace lokální cache
        showNotification("Záznam úspěšně uložen!", "success");
        closeLearningLogModal();
        if (typeof renderCalendar === 'function') renderCalendar(); // Překreslit kalendář
    } catch (error) {
        console.error("Chyba ukládání záznamu:", error);
        showNotification(`Chyba ukládání: ${error.message}`, "error");
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    }
}

async function initializeApp() {
    console.log("[DEBUG v7.5 InitApp - Calendar Only] Start");
    cacheDOMElements();
    if (!initializeSupabase()) return; // Zajistit, že Supabase je inicializován
    setupAuthListeners();

    if (prevMonthBtn) {
        console.log("[DEBUG v7.5 InitApp] Přidávám listener pro prevMonthBtn.");
        prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    } else { console.warn("[DEBUG v7.5 InitApp] prevMonthBtn nenalezen!");}

    if (nextMonthBtn) {
        console.log("[DEBUG v7.5 InitApp] Přidávám listener pro nextMonthBtn.");
        nextMonthBtn.addEventListener('click', () => changeMonth(1));
    } else { console.warn("[DEBUG v7.5 InitApp] nextMonthBtn nenalezen!");}

    if (closeLogModalBtn) closeLogModalBtn.addEventListener('click', closeLearningLogModal);
    if (dailyLearningLogForm) dailyLearningLogForm.addEventListener('submit', handleDailyLogSubmit);

    console.log("[DEBUG v7.5 InitApp] Nastavuji onAuthStateChange listener...");
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log(`[DEBUG v7.5 AuthChange] Event: ${event}, Session Active: ${!!session}, User Initialized: ${isUserSessionInitialized}`);
        if (session && session.user) {
            const isNewUserOrFirstInit = !currentUser || currentUser.id !== session.user.id || !isUserSessionInitialized;
            currentUser = session.user;

            if (isNewUserOrFirstInit) {
                console.log('[DEBUG v7.5 AuthChange] Uživatel přihlášen/změněn nebo první inicializace. Načítám data...');
                isUserSessionInitialized = false;

                if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
                if (authSection) authSection.classList.add('hidden');
                if (appSection) appSection.classList.remove('hidden');

                try {
                    console.log("[DEBUG v7.5 AuthChange] Čekám na loadLogsForMonthAndRenderCalendar()...");
                    await loadLogsForMonthAndRenderCalendar();
                    console.log('[DEBUG v7.5 AuthChange] Kalendář načten a vykreslen po přihlášení.');

                    isUserSessionInitialized = true;
                    console.log('[DEBUG v7.5 AuthChange] isUserSessionInitialized nastaveno na true.');
                } catch (initError) {
                    console.error("[DEBUG v7.5 AuthChange] Chyba během inicializace dat po přihlášení:", initError);
                    if (typeof showNotification === 'function') showNotification("Nepodařilo se plně načíst data po přihlášení. Zkuste obnovit stránku.", "error", 5000);
                }
            } else {
                 console.log('[DEBUG v7.5 AuthChange] Session obnovena, uživatel stejný a již inicializováno. Žádná akce.');
            }
        } else {
            currentUser = null;
            isUserSessionInitialized = false;
            console.log('[DEBUG v7.5 AuthChange] Uživatel odhlášen nebo session neaktivní.');
            if (userEmailDisplay) userEmailDisplay.textContent = '';
            if (authSection) authSection.classList.remove('hidden');
            if (appSection) appSection.classList.add('hidden');
            learningLogsCache = {};
            if(calendarGrid) calendarGrid.innerHTML = '<p style="text-align:center; color: var(--text-muted);">Pro zobrazení kalendáře se přihlaste.</p>';
        }
    });
    console.log("[DEBUG v7.5 InitApp - Calendar Only] Konec");
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
        window.supabase = supabaseClient; // Pro případné přímé použití v konzoli
        console.log('[Supabase] Klient úspěšně inicializován.');
        return true;
    } catch (error) {
        console.error('[Supabase] Initialization failed:', error);
        const container = document.querySelector('.container') || document.body;
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message'; // Použijte existující třídu pro styl chyby
        errorDiv.textContent = `Kritická chyba: Nepodařilo se připojit k databázi. ${error.message}`;
        if (container) {
            container.innerHTML = ''; // Vyčistit předchozí obsah, pokud existuje
            container.appendChild(errorDiv);
        } else {
            document.body.innerHTML = `<div class="error-message" style="padding:20px; text-align:center;">Kritická chyba: ${error.message}</div>`;
        }
        return false;
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);