// app.js

const SUPABASE_URL = 'https://orjivlyliqxyffsvaqzu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yaml2bHlsaXF4eWZmc3ZhcXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2OTc5NTIsImV4cCI6MjA2MjI3Mzk1Mn0.Au1RyA2mcFZgO5vvBhz4yJO1tqjcSQZyLOZcDu58uLo';

// SPRÁVNĚ: Použij 'supabase', ne 'supabaseJs'
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); // <--- ZMĚNA ZDE (a přejmenování proměnné pro jasnost)

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
// Musí být na window objektu, aby byla volána z onclick v HTML
window.toggleAuthForms = () => {
    loginFormContainer.classList.toggle('hidden');
    registerFormContainer.classList.toggle('hidden');
};

// --- Autentizace ---
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    // Použij opravený název klienta
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        alert(`Chyba přihlášení: ${error.message}`);
    } else {
        loginForm.reset();
        console.log('Přihlášený uživatel:', data.user);
    }
});

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    // Použij opravený název klienta
    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
        alert(`Chyba registrace: ${error.message}`);
    } else {
        alert('Registrace úspěšná! Zkontrolujte svůj e-mail pro potvrzení (pokud je vyžadováno). Nyní se můžete přihlásit.');
        registerForm.reset();
        window.toggleAuthForms(); // Ujisti se, že voláš window.toggleAuthForms, pokud by byla definována lokálně
        console.log('Zaregistrovaný uživatel:', data.user);
    }
});

logoutButton.addEventListener('click', async () => {
    // Použij opravený název klienta
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        alert(`Chyba odhlášení: ${error.message}`);
    } else {
        console.log('Uživatel odhlášen.');
    }
});

// Sledování změn stavu autentizace
// Použij opravený název klienta
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event, session);
    if (session && session.user) {
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        userEmailDisplay.textContent = session.user.email;
        loadLearningLogs(session.user.id);
    } else {
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
    // Použij opravený název klienta
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        alert('Pro uložení záznamu se musíš přihlásit.');
        return;
    }

    try {
        // Použij opravený název klienta
        const { data, error } = await supabaseClient
            .from('learning_logs')
            .insert([{ user_id: user.id, log_text: logText }])
            .select();

        if (error) {
            console.error('Chyba ukládání záznamu:', error);
            alert(`Nepodařilo se uložit záznam: ${error.message}`);
            return;
        }

        console.log('Záznam úspěšně uložen:', data);
        // alert('Pokrok uložen!'); // Můžeme nahradit něčím méně rušivým
        learningInput.value = '';
        loadLearningLogs(user.id);

        // Malá animace/indikace úspěchu
        const submitButton = learningLogForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Uloženo!';
        submitButton.style.backgroundColor = 'var(--accent-color)';
        submitButton.style.color = 'var(--background-color)';
        setTimeout(() => {
            submitButton.textContent = originalText;
            submitButton.style.backgroundColor = ''; // Vrátí se k původnímu gradientu definovanému v CSS
            submitButton.style.color = '';
        }, 1500);


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

    // Vylepšený loading text s animací (přidáme CSS pro .loader)
    logsContainer.innerHTML = '<div class="loader">Načítání záznamů...</div>';

    try {
        // Použij opravený název klienta
        const { data, error } = await supabaseClient
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
                // Přidání animace při zobrazení záznamu
                logElement.style.opacity = '0';
                logElement.style.transform = 'translateY(20px)';
                logElement.innerHTML = `
                    <p>${log.log_text}</p>
                    <small>Datum: ${new Date(log.created_at).toLocaleString('cs-CZ')}</small>
                `;
                logsContainer.appendChild(logElement);
                // Trigger reflow pro animaci
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
        logsContainer.innerHTML = `<p style="color: var(--secondary-color);">Kritická chyba při načítání.</p>`;
    }
}

console.log("app.js načten, Supabase klient inicializován.");
// Ujisti se, že tento soubor je načten až PO načtení Supabase CDN skriptu v HTML.