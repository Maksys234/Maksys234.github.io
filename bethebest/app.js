// app.js

// --- ИЗМЕНЕННЫЕ ДАННЫЕ ДЛЯ ПОДКЛЮЧЕНИЯ К НОВОЙ БАЗЕ SUPABASE ---
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
// --- КОНЕЦ ИЗМЕНЕННЫХ ДАННЫХ ---

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

// !!! ВАЖНО: API КЛЮЧ GEMINI - НЕБЕЗОПАСНО ДЛЯ ПРОДАКШЕНА !!!
const GEMINI_API_KEY = 'AIzaSyB4l6Yj9AjWfkG2Ob2LCAgTsnSwN-UZQcA'; 
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;


// Функция для zobrazení notifikací
function showNotification(message, type = 'info', duration = 3000) {
    if (!notificationArea) return;

    const notificationDiv = document.createElement('div');
    notificationDiv.className = `notification ${type}`;
    notificationDiv.textContent = message;
    
    notificationArea.appendChild(notificationDiv);

    if (duration > 0) {
        setTimeout(() => {
            notificationDiv.style.opacity = '0';
            notificationDiv.style.transform = 'translateX(120%)';
            setTimeout(() => notificationDiv.remove(), 500);
        }, duration);
    }
}

// Функция для přepínání mezi přihlašovacím a registračním formulářem
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
        toggleAuthForms();
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
    }
});

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        userEmailDisplay.textContent = session.user.email;
        loadLearningLogs(session.user.id); // Загружаем логи для нового пользователя из новой базы
        logoutButton.disabled = false;
    } else {
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
        userEmailDisplay.textContent = '';
        logsContainer.innerHTML = '<p>Přihlaste se, abyste mohli vidět a přidávat záznamy.</p>';
        geminiTasksContainer.innerHTML = '<p>Pro generování úkolů se musíte přihlásit.</p>';
    }
});

// --- Práce se záznamy o učení ---
// Эта функция предполагает, что в новой базе есть таблица 'learning_logs'
// с колонками user_id, log_text, created_at
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
            .from('learning_logs') // Убедись, что эта таблица существует в новой базе
            .insert([{ user_id: user.id, log_text: logText }])
            .select();

        if (error) {
            console.error('Chyba ukládání záznamu do nové databáze:', error);
            showNotification(`Nepodařilo se uložit záznam: ${error.message}`, 'error');
        } else {
            showNotification('Pokrok úspěšně uložen!', 'success');
            learningInput.value = '';
            loadLearningLogs(user.id); // Перезагружаем логи из новой базы
        }
    } catch (err) {
        console.error('Kritická chyba při ukládání do nové databáze:', err);
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
            .from('learning_logs') // Убедись, что эта таблица существует в новой базе
            .select('log_text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Chyba načítání záznamů z nové databáze:', error);
            logsContainer.innerHTML = `<p style="color: var(--error-color);">Chyba načítání: ${error.message}</p>`;
            return;
        }

        if (data && data.length > 0) {
            logsContainer.innerHTML = '';
            data.forEach(log => {
                const logElement = document.createElement('div');
                logElement.classList.add('log-entry');
                logElement.innerHTML = `
                    <p>${log.log_text.replace(/\n/g, '<br>')}</p> 
                    <small>Datum: ${new Date(log.created_at).toLocaleString('cs-CZ')}</small>
                `;
                logsContainer.appendChild(logElement);
                requestAnimationFrame(() => {
                    logElement.style.opacity = '1';
                    logElement.style.transform = 'translateY(0)';
                });
            });
        } else {
            logsContainer.innerHTML = '<p>Zatím nemáš žádné záznamy. Začni se učit a zaznamenávej svůj pokrok!</p>';
        }
    } catch (err) {
        console.error('Kritická chyba při načítání záznamů z nové databáze:', err);
        logsContainer.innerHTML = `<p style="color: var(--error-color);">Kritická chyba při načítání.</p>`;
    }
}

// --- Функция для прямого вызова GEMINI API (без изменений) ---
async function generateTasksWithGeminiDirectly(learningContext) {
    const prompt = `
Na základě následujících záznamů o učení studenta, vygeneruj 3-5 konkrétních cvičných úkolů nebo otázek, které mu pomohou prohloubit porozumění a procvičit si naučené. Úkoly by měly být formulovány jasně a stručně. Odpověď vrať jako HTML nečíslovaný seznam (<ul><li>První úkol</li><li>Druhý úkol</li>...</ul>). Nepoužívej Markdown.

Kontext učení:
---
${learningContext}
---
Příklady úkolů:`;

    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
    };

    try {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); 
            console.error('Chyba od Gemini API:', errorData, 'Status:', response.status, 'StatusText:', response.statusText);
            let errorMessage = `Chyba ${response.status} od Gemini API: ${response.statusText}. `;
            if (errorData.error && errorData.error.message) {
                errorMessage += errorData.error.message;
            } else if (typeof errorData === 'string') {
                errorMessage += errorData;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0 &&
            data.candidates[0].content && data.candidates[0].content.parts &&
            data.candidates[0].content.parts.length > 0) {
            
            if (data.candidates[0].finishReason === "SAFETY") {
                console.warn("Gemini odpověď zablokována kvůli bezpečnostním nastavením:", data.candidates[0].safetyRatings);
                return "<p>Odpověď byla zablokována bezpečnostními filtry Gemini. Zkuste přeformulovat své záznamy o učení.</p>";
            }
            return data.candidates[0].content.parts[0].text;
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
             console.warn("Gemini dotaz zablokován:", data.promptFeedback.blockReason, data.promptFeedback.safetyRatings);
             return `<p>Váš dotaz byl zablokován filtrem Gemini (${data.promptFeedback.blockReason}). Zkuste prosím upravit své záznamy o učení.</p>`;
        } 
        else {
            console.warn('Gemini API nevrátilo očekávaný formát textu:', data);
            throw new Error('Nepodařilo se získat text z odpovědi Gemini.');
        }

    } catch (error) {
        console.error('Chyba při přímém volání Gemini API:', error);
        throw error;
    }
}

// --- Gemini Integrace (без изменений, использует логи из текущей Supabase) ---
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
                .from('learning_logs') // Запрашиваем из новой базы
                .select('log_text')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(3); 

            if (logError) {
                throw new Error(`Chyba načítání záznamů pro Gemini z nové databáze: ${logError.message}`);
            }
            if (!logs || logs.length === 0) {
                showNotification('Nemáš zatím žádné záznamy pro analýzu Gemini.', 'info');
                geminiTasksContainer.innerHTML = '<p>Nejprve přidej nějaké záznamy o svém učení.</p>';
                geminiLoading.classList.add('hidden');
                generateTasksButton.disabled = false;
                generateTasksButton.textContent = 'Vygenerovat úkoly';
                return; 
            }
            
            const learningContext = logs.map(log => log.log_text).join("\n---\n");
            
            const tasksHtml = await generateTasksWithGeminiDirectly(learningContext);
            geminiTasksContainer.innerHTML = tasksHtml;
            showNotification('Úkoly od Gemini vygenerovány!', 'success');

        } catch (error) {
            console.error('Celková chyba při generování úkolů Gemini:', error);
            showNotification(error.message || 'Nastala chyba při generování úkolů.', 'error');
            geminiTasksContainer.innerHTML = `<p>Nastala chyba: ${error.message}. Zkuste to prosím znovu.</p>`;
        } finally {
            geminiLoading.classList.add('hidden');
            generateTasksButton.disabled = false;
            generateTasksButton.textContent = 'Vygenerovat úkoly';
        }
    });
}

// Inicializace
console.log("app.js načten, Supabase klient inicializován s НОВЫМИ ДАННЫМИ. Gemini nastaven на přímý API volání.");