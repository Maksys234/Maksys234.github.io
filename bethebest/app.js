// app.js

const SUPABASE_URL = 'https://orjivlyliqxyffsvaqzu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yaml2bHlsaXF4eWZmc3ZhcXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2OTc5NTIsImV4cCI6MjA2MjI3Mzk1Mn0.Au1RyA2mcFZgO5vvBhz4yJO1tqjcSQZyLOZcDu58uLo';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// HTML Elementy
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const loginFormContainer = document.getElementById('loginFormContainer');
const registerFormContainer = document.getElementById('registerFormContainer');
const notificationArea = document.getElementById('notificationArea');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutButton = document.getElementById('logoutButton');
const userEmailDisplay = document.getElementById('userEmailDisplay');

const learningLogForm = document.getElementById('learningLogForm');
const learningInput = document.getElementById('learningInput');
const logsContainer = document.getElementById('logsContainer');

// Gemini elementy
const generateTasksButton = document.getElementById('generateTasksButton');
const geminiTasksContainer = document.getElementById('geminiTasksContainer');
const geminiLoading = document.getElementById('geminiLoading');


// Funkce pro zobrazení notifikací
function showNotification(message, type = 'info', duration = 3000) {
    if (!notificationArea) return;

    const notificationDiv = document.createElement('div');
    notificationDiv.className = `notification ${type}`;
    notificationDiv.textContent = message;
    
    notificationArea.appendChild(notificationDiv);

    // Po krátké chvíli spustíme animaci zmizení, pokud je duration > 0
    if (duration > 0) {
        setTimeout(() => {
            notificationDiv.style.opacity = '0';
            notificationDiv.style.transform = 'translateX(120%)'; // Odsuneme pryč
            setTimeout(() => notificationDiv.remove(), 500); // Odstraníme z DOM po dokončení animace
        }, duration);
    }
}

// Funkce pro přepínání mezi přihlašovacím a registračním formulářem
window.toggleAuthForms = () => {
    loginFormContainer.classList.toggle('hidden');
    registerFormContainer.classList.toggle('hidden');
};

// --- Autentizace ---
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginButton = loginForm.querySelector('button[type="submit"]');
    loginButton.disabled = true;
    loginButton.textContent = 'Přihlašuji...';

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        showNotification(`Chyba přihlášení: ${error.message}`, 'error');
    } else {
        showNotification('Přihlášení úspěšné!', 'success');
        loginForm.reset();
        // onAuthStateChange se postará o zbytek
    }
    loginButton.disabled = false;
    loginButton.textContent = 'Přihlásit se';
});

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const registerButton = registerForm.querySelector('button[type="submit"]');
    registerButton.disabled = true;
    registerButton.textContent = 'Registruji...';

    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
        showNotification(`Chyba registrace: ${error.message}`, 'error');
    } else {
        showNotification('Registrace úspěšná! Zkontrolujte svůj e-mail pro potvrzení (pokud je nastaveno).', 'success');
        registerForm.reset();
        toggleAuthForms(); // Přepne na přihlašovací formulář
    }
    registerButton.disabled = false;
    registerButton.textContent = 'Zaregistrovat se';
});

logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        showNotification(`Chyba odhlášení: ${error.message}`, 'error');
    } else {
        showNotification('Odhlášení úspěšné.', 'info');
        // onAuthStateChange se postará o zbytek
    }
    // Tlačítko se znovu povolí v onAuthStateChange skrytím appSection
});

// Sledování změn stavu autentizace
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        userEmailDisplay.textContent = session.user.email;
        loadLearningLogs(session.user.id);
        logoutButton.disabled = false; // Povolit logout tlačítko
    } else {
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
        userEmailDisplay.textContent = '';
        logsContainer.innerHTML = '<p>Přihlaste se, abyste mohli vidět a přidávat záznamy.</p>';
        geminiTasksContainer.innerHTML = '<p>Pro generování úkolů se musíte přihlásit.</p>';
    }
});


// --- Práce se záznamy o učení ---
learningLogForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const logText = learningInput.value.trim();

    if (!logText) {
        showNotification('Prosím, napiš, co ses naučil/a.', 'error');
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        showNotification('Pro uložení záznamu se musíš přihlásit.', 'error');
        return;
    }

    const submitButton = learningLogForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Ukládám...';

    try {
        const { data, error } = await supabaseClient
            .from('learning_logs')
            .insert([{ user_id: user.id, log_text: logText }])
            .select();

        if (error) {
            console.error('Chyba ukládání záznamu:', error);
            showNotification(`Nepodařilo se uložit záznam: ${error.message}`, 'error');
        } else {
            showNotification('Pokrok úspěšně uložen!', 'success');
            learningInput.value = '';
            loadLearningLogs(user.id); // Znovu načteme logy, aby se zobrazil nový
        }
    } catch (err) {
        console.error('Kritická chyba při ukládání:', err);
        showNotification('Došlo ke kritické chybě při ukládání.', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
});

async function loadLearningLogs(userId) {
    if (!userId) {
        logsContainer.innerHTML = '<p>Přihlaste se pro zobrazení záznamů.</p>';
        return;
    }

    logsContainer.innerHTML = '<div class="loader">Načítání záznamů...</div>';

    try {
        const { data, error } = await supabaseClient
            .from('learning_logs')
            .select('log_text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Chyba načítání záznamů:', error);
            logsContainer.innerHTML = `<p style="color: var(--error-color);">Chyba načítání: ${error.message}</p>`;
            return;
        }

        if (data && data.length > 0) {
            logsContainer.innerHTML = ''; // Vyčistíme předchozí obsah
            data.forEach(log => {
                const logElement = document.createElement('div');
                logElement.classList.add('log-entry');
                logElement.innerHTML = `
                    <p>${log.log_text}</p>
                    <small>Datum: ${new Date(log.created_at).toLocaleString('cs-CZ')}</small>
                `;
                logsContainer.appendChild(logElement);
                // Spustíme animaci pro nově přidaný prvek
                requestAnimationFrame(() => {
                    logElement.style.opacity = '1';
                    logElement.style.transform = 'translateY(0)';
                });
            });
        } else {
            logsContainer.innerHTML = '<p>Zatím nemáš žádné záznamy. Začni se učit a zaznamenávej svůj pokrok!</p>';
        }
    } catch (err) {
        console.error('Kritická chyba při načítání záznamů:', err);
        logsContainer.innerHTML = `<p style="color: var(--error-color);">Kritická chyba při načítání.</p>`;
    }
}

// --- Gemini Integrace ---
if (generateTasksButton) {
    generateTasksButton.addEventListener('click', async () => {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            showNotification('Pro generování úkolů se musíš přihlásit.', 'error');
            return;
        }

        geminiLoading.classList.remove('hidden');
        geminiTasksContainer.innerHTML = ''; 
        generateTasksButton.disabled = true;
        generateTasksButton.textContent = 'Generuji...';

        try {
            const { data: logs, error: logError } = await supabaseClient
                .from('learning_logs')
                .select('log_text')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(3); // Poslední 3 záznamy pro kontext

            if (logError) {
                throw new Error(`Chyba načítání záznamů pro Gemini: ${logError.message}`);
            }
            if (!logs || logs.length === 0) {
                showNotification('Nemáš zatím žádné záznamy pro analýzu Gemini.', 'info');
                geminiTasksContainer.innerHTML = '<p>Nejprve přidej nějaké záznamy o svém učení.</p>';
                return; // Nepokračujeme, pokud nejsou logy
            }
            
            const learningContext = logs.map(log => log.log_text).join("\n---\n");

            const { data: tasksData, error: functionError } = await supabaseClient.functions.invoke('get-gemini-tasks', {
                body: { learningContext: learningContext }
            });

            if (functionError) {
                throw new Error(`Chyba volání AI asistenta: ${functionError.message}`);
            }

            if (tasksData && tasksData.tasks) {
                geminiTasksContainer.innerHTML = tasksData.tasks; // Zobrazí HTML od Gemini
                showNotification('Úkoly od Gemini vygenerovány!', 'success');
            } else {
                geminiTasksContainer.innerHTML = '<p>Nepodařilo se získat úkoly od Gemini. Zkuste to později.</p>';
                console.warn('Gemini funkce nevrátila očekávaná data:', tasksData);
            }

        } catch (error) {
            console.error('Celková chyba při generování úkolů Gemini:', error);
            showNotification(error.message || 'Nastala chyba při generování úkolů.', 'error');
            geminiTasksContainer.innerHTML = `<p>Nastala chyba. Zkuste to prosím znovu.</p>`;
        } finally {
            geminiLoading.classList.add('hidden');
            generateTasksButton.disabled = false;
            generateTasksButton.textContent = 'Vygenerovat úkoly';
        }
    });
}

// Inicializace - onAuthStateChange se postará o první načtení stavu
console.log("app.js načten, Supabase klient inicializován.");