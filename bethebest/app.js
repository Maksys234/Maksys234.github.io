// app.js

const SUPABASE_URL = 'https://orjivlyliqxyffsvaqzu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yaml2bHlsaXF4eWZmc3ZhcXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2OTc5NTIsImV4cCI6MjA2MjI3Mzk1Mn0.Au1RyA2mcFZgO5vvBhz4yJO1tqjcSQZyLOZcDu58uLo';

const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// HTML Elementy
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const loginFormContainer = document.getElementById('loginFormContainer');
const registerFormContainer = document.getElementById('registerFormContainer');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutButton = document.getElementById('logoutButton');
const userEmailDisplay = document.getElementById('userEmailDisplay');

const learningLogForm = document.getElementById('learningLogForm');
const learningInput = document.getElementById('learningInput');
const logsContainer = document.getElementById('logsContainer');

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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert(`Chyba přihlášení: ${error.message}`);
    } else {
        // Přihlášení úspěšné, onAuthStateChange se postará o UI
        loginForm.reset();
        console.log('Přihlášený uživatel:', data.user);
    }
});

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
        alert(`Chyba registrace: ${error.message}`);
    } else {
        alert('Registrace úspěšná! Zkontrolujte svůj e-mail pro potvrzení (pokud je vyžadováno). Nyní se můžete přihlásit.');
        // Automaticky nepřihlašujeme, necháme uživatele se přihlásit explicitně
        // nebo Supabase může automaticky přihlásit po potvrzení emailu
        registerForm.reset();
        toggleAuthForms(); // Přepne na přihlašovací formulář
        console.log('Zaregistrovaný uživatel:', data.user);
    }
});

logoutButton.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        alert(`Chyba odhlášení: ${error.message}`);
    } else {
        // Odhlášení úspěšné, onAuthStateChange se postará o UI
        console.log('Uživatel odhlášen.');
    }
});

// Sledování změn stavu autentizace
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event, session);
    if (session && session.user) {
        // Uživatel je přihlášen
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        userEmailDisplay.textContent = session.user.email;
        loadLearningLogs(session.user.id);
    } else {
        // Uživatel není přihlášen
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
        userEmailDisplay.textContent = '';
        logsContainer.innerHTML = '<p>Přihlaste se, abyste mohli vidět a přidávat záznamy.</p>';
    }
});


// --- Práce se záznamy o učení ---
learningLogForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const logText = learningInput.value.trim();

    if (!logText) {
        alert('Prosím, napiš, co ses naučil/a.');
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        alert('Pro uložení záznamu se musíš přihlásit.');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('learning_logs')
            .insert([{ user_id: user.id, log_text: logText }])
            .select();

        if (error) {
            console.error('Chyba ukládání záznamu:', error);
            alert(`Nepodařilo se uložit záznam: ${error.message}`);
            return;
        }

        console.log('Záznam úspěšně uložen:', data);
        alert('Pokrok uložen!');
        learningInput.value = '';
        loadLearningLogs(user.id);
    } catch (err) {
        console.error('Kritická chyba při ukládání:', err);
        alert('Došlo ke kritické chybě při ukládání.');
    }
});

async function loadLearningLogs(userId) {
    if (!userId) {
        logsContainer.innerHTML = '<p>Přihlaste se pro zobrazení záznamů.</p>';
        return;
    }

    logsContainer.innerHTML = '<p>Načítání záznamů...</p>';

    try {
        const { data, error } = await supabase
            .from('learning_logs')
            .select('log_text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Chyba načítání záznamů:', error);
            logsContainer.innerHTML = `<p style="color: var(--secondary-color);">Chyba načítání: ${error.message}</p>`;
            return;
        }

        if (data && data.length > 0) {
            logsContainer.innerHTML = '';
            data.forEach(log => {
                const logElement = document.createElement('div');
                logElement.classList.add('log-entry');
                logElement.innerHTML = `
                    <p>${log.log_text}</p>
                    <small>Datum: ${new Date(log.created_at).toLocaleString('cs-CZ')}</small>
                `;
                logsContainer.appendChild(logElement);
            });
        } else {
            logsContainer.innerHTML = '<p>Zatím nemáš žádné záznamy. Začni se učit a zaznamenávej svůj pokrok!</p>';
        }
    } catch (err) {
        console.error('Kritická chyba při načítání záznamů:', err);
        logsContainer.innerHTML = `<p style="color: var(--secondary-color);">Kritická chyba při načítání.</p>`;
    }
}

// Inicializace - kontrola stavu přihlášení při načtení stránky
// onAuthStateChange se o to postará automaticky po načtení klienta Supabase
// Není potřeba volat checkUser() explicitně, pokud je onAuthStateChange aktivní od začátku.
console.log("app.js načten, Supabase klient inicializován.");