// ============================================================================
// dashboard.js -- Hlavní skript pro stránku Dashboard
// ============================================================================
// Globální proměnné pro Supabase klienta a data
let supabase;
let currentProfile = null; // Will store data from 'profiles' table
let currentUserStats = null; // Will store data from 'user_stats' table
let availableTitles = {}; // Pro uložení načtených titulů

// Konstanti pro API klíče a URL (z konfigurace nebo env proměnných)
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Nahraďte skutečným URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Nahraďte skutečným ANON klíčem

// Prvky DOM
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebarCloseToggle = document.getElementById('sidebar-close-toggle');
const mainMobileMenuToggle = document.getElementById('main-mobile-menu-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const mainContent = document.getElementById('main-content');
const sidebarAvatar = document.getElementById('sidebar-avatar');
const sidebarName = document.getElementById('sidebar-name');
const sidebarUserTitle = document.getElementById('sidebar-user-title'); // << Nový prvek pro titul
const welcomeTitle = document.getElementById('welcome-title');
const progressCard = document.getElementById('progress-card');
const pointsCard = document.getElementById('points-card');
const streakCard = document.getElementById('streak-card');
const activityListContainer = document.getElementById('activity-list-container');
const activityList = document.getElementById('activity-list');
const refreshBtn = document.getElementById('refresh-data-btn');
const startPracticeBtn = document.getElementById('start-practice-btn');
const initialLoader = document.getElementById('initial-loader');
const notificationBell = document.getElementById('notification-bell');
const notificationCountBadge = document.getElementById('notification-count');
const notificationsDropdown = document.getElementById('notifications-dropdown');
const notificationsList = document.getElementById('notifications-list');
const markAllReadBtn = document.getElementById('mark-all-read');
const noNotificationsMsg = document.getElementById('no-notifications-msg');
const offlineBanner = document.getElementById('offline-banner');
const globalErrorContainer = document.getElementById('global-error');
const currentYearSidebar = document.getElementById('currentYearSidebar');
const currentYearFooter = document.getElementById('currentYearFooter');
const mouseFollower = document.getElementById('mouse-follower');

// ============================================================================
// Inicializace Supabase
// ============================================================================
function initializeSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase klient inicializován.");
        // Monitorování stavu autentizace
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                console.log("Uživatel odhlášen, přesměrování na login.");
                window.location.href = '/auth/index.html';
            } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                console.log("Uživatel přihlášen nebo session obnovena.");
                // Při úspěšném přihlášení nebo obnovení session můžeme načíst data
                // Added a small delay to ensure Supabase client might be fully ready after auth event
                setTimeout(initializeDashboard, 100);
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('Supabase token obnoven.');
            } else if (event === 'PASSWORD_RECOVERY') {
                console.log('Proces obnovy hesla zahájen.');
                // Zde můžete zobrazit zprávu nebo přesměrovat na stránku pro obnovu hesla
            } else if (event === 'USER_UPDATED') {
                 console.log('Uživatelská data aktualizována v Supabase Auth.');
                 // Možná bude potřeba znovu načíst profil, pokud se změnily důležité údaje
                 // loadUserProfile(); // Zvážit, zda je to potřeba zde
            }
        });
    } catch (error) {
        console.error("Chyba při inicializaci Supabase:", error);
        displayGlobalError("Nepodařilo se připojit k systému. Zkuste obnovit stránku.");
        showInitialLoader(false); // Skrýt loader i při chybě initu
    }
}

// ============================================================================
// Načítání a Zobrazování Dat
// ============================================================================

// Načte data z tabulky 'title_shop'
async function loadTitles() {
    console.log("Načítání dostupných titulů...");
    try {
        const { data, error } = await supabase
            .from('title_shop')
            .select('title_key, name');

        if (error) throw error;

        if (data) {
            availableTitles = data.reduce((acc, title) => {
                acc[title.title_key] = title.name;
                return acc;
            }, {});
            console.log("Dostupné tituly načteny:", availableTitles);
        } else {
             console.warn("Nebyly nalezeny žádné tituly v 'title_shop'.");
             availableTitles = {}; // Zajistit, že je to prázdný objekt
        }
    } catch (error) {
        console.error("Chyba při načítání titulů:", error);
        // Nezobrazujeme globální chybu, titul může být fallback
        showToast("Nepodařilo se načíst seznam titulů.", "warning");
        availableTitles = {}; // Zajistit, že je to prázdný objekt i při chybě
    }
}


// Načte profil a statistiky přihlášeného uživatele
async function loadUserProfile() {
    console.log("Načítání profilu uživatele...");
    showElementLoading(sidebarName); // Zobrazit načítání jména v sidebaru
    showElementLoading(sidebarUserTitle); // Zobrazit načítání titulu v sidebaru

    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("Uživatel není přihlášen.");

        const userId = user.id; // This is the auth.users.id (UUID)

        // Načtení profilu (včetně nových polí)
        // *** CORRECTION: Use 'id' instead of 'user_id' for profiles table ***
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, points, selected_title, last_login_date, streak_days') // Select 'id'
            .eq('id', userId) // Filter by 'id' matching the auth user ID
            .single();

        if (profileError) {
            // Pokud profil neexistuje (např. nová registrace), vytvoříme ho? Nebo chyba?
            if (profileError.code === 'PGRST116') { // 'PGRST116' = row not found
                console.warn(`Profil pro id ${userId} nenalezen. Možná nový uživatel nebo chyba synchronizace?`);
                 // Zde by mohla být logika pro vytvoření základního profilu, pokud je potřeba
                 // Například:
                 // const { error: createError } = await supabase.from('profiles').insert([{ id: userId, username: 'Nový Pilot' }]);
                 // if (createError) throw new Error(`Nepodařilo se vytvořit profil: ${createError.message}`);
                 // else return loadUserProfile(); // Zkusit načíst znovu po vytvoření
                 throw new Error("Profil uživatele nenalezen. Kontaktujte podporu, pokud problém přetrvává.");
            } else {
                // Re-throw other errors, including potential column errors if 'id' is also wrong
                throw profileError;
            }
        }
        if (!profileData) throw new Error("Profilová data nebyla nalezena po dotazu.");

        // *** Store profile data, assuming 'id' is the primary key here ***
        currentProfile = profileData;
        // Add user_id from auth context for consistency if needed elsewhere,
        // but database operations on 'profiles' will use 'id'.
        currentProfile.user_id = userId;

        console.log("Profil načten:", currentProfile);

        // Načtení statistik (včetně nového pole)
        // Assuming 'user_stats' table uses 'user_id' as the foreign key to profiles.id / auth.users.id
        // If 'user_stats' also uses 'id', change 'user_id' to 'id' here too.
        const { data: statsData, error: statsError } = await supabase
            .from('user_stats')
            .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: false }) // Create row if not exists, based on user_id
            .select('user_id, total_exercises_completed, total_correct_answers, total_incorrect_answers, average_accuracy, streak_longest') // Selecting user_id here
            .eq('user_id', userId) // Filtering by user_id
            .single();


        if (statsError && statsError.code !== 'PGRST116') { // Ignore "not found" after upsert
            console.error("Chyba při načítání/upsertu statistik:", statsError);
             currentUserStats = { // Fallback stats
                 user_id: userId,
                 total_exercises_completed: 0,
                 total_correct_answers: 0,
                 total_incorrect_answers: 0,
                 average_accuracy: 0,
                 streak_longest: 0
             };
             showToast("Nepodařilo se načíst statistiky uživatele.", "warning");
        } else {
            currentUserStats = statsData || { // Ensure stats object exists
                user_id: userId,
                total_exercises_completed: 0,
                total_correct_answers: 0,
                total_incorrect_answers: 0,
                average_accuracy: 0,
                streak_longest: 0
            };
             if (!statsData) console.warn("Upsert pro statistiky nevrátil data, použity výchozí.");
        }
        console.log("Statistiky načteny:", currentUserStats);

        updateSidebarProfile();
        updateWelcomeMessage();

        // Nyní, když máme profil, zkontrolujeme denní odměnu
        // Make sure profile is fully loaded before proceeding
        if (currentProfile && currentUserStats) {
            await handleDailyLoginReward();
        } else {
            console.error("Denní odměna přeskočena: Profil nebo statistiky nejsou kompletní.");
        }


    } catch (error) {
        console.error("Chyba při načítání profilu nebo statistik:", error);
        // Display the specific error message if available
        const errorMessage = error.message || "Neznámá chyba";
        displayGlobalError(`Chyba při načítání dat uživatele: ${errorMessage}`);
         hideElementLoading(sidebarName, 'Chyba');
         hideElementLoading(sidebarUserTitle, '-');
    }
}


// Aktualizuje informace v postranním panelu
function updateSidebarProfile() {
    if (currentProfile) {
        hideElementLoading(sidebarName, currentProfile.username || 'Pilot');
        if (sidebarAvatar) {
            sidebarAvatar.textContent = (currentProfile.username || 'P').charAt(0).toUpperCase();
            sidebarAvatar.style.backgroundImage = currentProfile.avatar_url ? `url(${currentProfile.avatar_url})` : '';
            if (currentProfile.avatar_url) {
                 sidebarAvatar.textContent = ''; // Skrýt iniciálu, pokud je obrázek
             }
        }

        // *** Aktualizace titulu ***
        const selectedTitleKey = currentProfile.selected_title;
        const titleName = availableTitles[selectedTitleKey] || 'Pilot'; // Použít název z načtených titulů, fallback na 'Pilot'
        hideElementLoading(sidebarUserTitle, titleName);
         // *** Konec aktualizace titulu ***

    } else {
        console.warn("Profil nenalezen pro aktualizaci sidebaru.");
        hideElementLoading(sidebarName, 'Neznámý');
        hideElementLoading(sidebarUserTitle, 'Pilot');
        if (sidebarAvatar) {
            sidebarAvatar.textContent = '?';
            sidebarAvatar.style.backgroundImage = '';
        }
    }
}


// Aktualizuje uvítací zprávu
function updateWelcomeMessage() {
    if (currentProfile && welcomeTitle) {
        welcomeTitle.textContent = `Vítejte zpět, ${currentProfile.username || 'Pilote'}!`;
    } else if (welcomeTitle) {
        welcomeTitle.textContent = 'Vítejte!';
    }
}

// Zobrazí/skryje placeholder pro načítání v prvku
function showElementLoading(element) {
    if (element) {
        element.classList.add('loading-placeholder-inline');
        element.textContent = '...'; // Nebo použít spinner?
    }
}

function hideElementLoading(element, text) {
    if (element) {
        element.classList.remove('loading-placeholder-inline');
        element.textContent = text;
    }
}


// Načte a zobrazí statistické karty
function updateStatCards() {
    console.log("Aktualizace statistických karet...");
    if (!currentProfile || !currentUserStats) {
        console.warn("Profil nebo statistiky nejsou k dispozici pro aktualizaci karet.");
        // Zobrazit chybový stav v kartách
        updateSingleStatCard(progressCard, { error: true, message: "Data profilu chybí" });
        updateSingleStatCard(pointsCard, { error: true, message: "Data profilu chybí" });
        updateSingleStatCard(streakCard, { error: true, message: "Data profilu chybí" });
        return;
    }

    // 1. Karta Celkový Progress (příklad, zde by měla být reálná logika výpočtu progressu)
    const totalProgress = calculateOverallProgress(currentUserStats); // Příklad funkce
    updateSingleStatCard(progressCard, {
        title: "Celkový Progress",
        iconClass: "fas fa-tasks",
        value: `${totalProgress}%`,
        changeText: "Oproti minulému týdnu +2%", // Příklad
        changeIconClass: "fas fa-arrow-up", // Příklad
        iconBgClass: "progress-icon",
        loading: false,
        error: false
    });

    // 2. Karta Kredity
    updateSingleStatCard(pointsCard, {
        title: "Kredity",
        iconClass: "fas fa-coins",
        value: currentProfile.points?.toLocaleString('cs-CZ') ?? '0', // Použití ?? pro null/undefined
        changeText: "Získáno dnes: +0", // Toto by se mělo aktualizovat po odměně
        changeIconClass: "fas fa-plus", // Příklad
        iconBgClass: "points-icon",
        loading: false,
        error: false
    });

    // 3. Karta Série
    updateSingleStatCard(streakCard, {
        title: "Série Přihlášení",
        iconClass: "fas fa-calendar-check",
        value: `${currentProfile.streak_days ?? '0'} dní`, // Aktuální série
        changeText: `MAX: ${currentUserStats.streak_longest ?? '0'} dní`, // Nejdelší série
        changeIconClass: "fas fa-fire",
        iconBgClass: "streak-icon",
        loading: false,
        error: false
    });
}

// Pomocná funkce pro aktualizaci jedné statistické karty
function updateSingleStatCard(cardElement, data) {
    const content = cardElement.querySelector('.stat-card-content');
    const loadingSkeleton = cardElement.querySelector('.loading-skeleton');
    const errorIcon = cardElement.querySelector('.stat-card-error-icon'); // Předpokládáme, že přidáme prvek pro ikonu chyby

    // Clean previous states
    cardElement.classList.remove('loading', 'error');
    if(errorIcon) errorIcon.style.display = 'none';

    if (data.loading) {
        cardElement.classList.add('loading');
        if (content) content.style.display = 'none';
        if (loadingSkeleton) loadingSkeleton.style.display = 'flex'; // Nebo 'block' podle stylů
        return;
    }

     if (data.error) {
         cardElement.classList.add('error');
         if (content) content.style.display = 'none'; // Skrýt obsah
         if (loadingSkeleton) loadingSkeleton.style.display = 'none'; // Skrýt skeleton
         if (errorIcon) errorIcon.style.display = 'block'; // Zobrazit ikonu chyby
         // Zobrazit chybovou zprávu uvnitř karty? Může být v tooltipu ikony nebo textu.
         console.error("Chyba v kartě:", data.title || cardElement.id, data.message);
         return;
     }

    // Success state
    if (loadingSkeleton) loadingSkeleton.style.display = 'none';
    if (content) {
        content.style.display = 'flex'; // Nebo 'block'

        const titleEl = content.querySelector('.stat-card-title');
        const valueEl = content.querySelector('.stat-card-value');
        const changeEl = content.querySelector('.stat-card-change');
        const iconBgEl = cardElement.querySelector('.stat-card-icon-bg'); // Ikona v pozadí

        if (titleEl) titleEl.innerHTML = `<i class="${data.iconClass || 'fas fa-question-circle'}"></i>${data.title || 'Statistika'}`;
        if (valueEl) valueEl.textContent = data.value || '-';
        if (changeEl) {
             const iconHtml = data.changeIconClass ? `<i class="${data.changeIconClass}"></i> ` : '';
             changeEl.innerHTML = `${iconHtml}${data.changeText || ''}`;
        }
        if (iconBgEl) {
            iconBgEl.className = `stat-card-icon-bg ${data.iconBgClass || ''}`; // Reset a nastavení třídy pozadí
            const iconInside = iconBgEl.querySelector('i');
            if(iconInside) iconInside.className = data.iconClass || 'fas fa-question-circle'; // Aktualizace ikony uvnitř
        }
    }
}


// Příklad funkce pro výpočet celkového progressu (nahraďte reálnou logikou)
function calculateOverallProgress(stats) {
    if (!stats || !stats.total_exercises_completed || stats.total_exercises_completed === 0) return 0;
    // Velmi zjednodušený příklad:
    const accuracyWeight = 0.6;
    const completionWeight = 0.4;
    // Ensure average_accuracy is a number between 0 and 100
    const safeAccuracy = Math.max(0, Math.min(100, stats.average_accuracy || 0));
    const normalizedCompletion = Math.min(stats.total_exercises_completed / 100, 1); // Max 100 cvičení = 100%
    const progress = (safeAccuracy * accuracyWeight) + (normalizedCompletion * 100 * completionWeight);
    return Math.round(progress);
}


// Načte a zobrazí poslední aktivity
async function loadRecentActivity() {
    console.log("Načítání posledních aktivit...");
    activityListContainer.classList.add('loading');
    activityListContainer.classList.remove('error-state-visible', 'empty-state-visible'); // Skrýt předchozí stavy
    const loadingPlaceholder = activityListContainer.querySelector('.loading-placeholder');
    const emptyState = activityListContainer.querySelector('.empty-state');
    const errorState = activityListContainer.querySelector('.card-error-state');
    const actualList = activityListContainer.querySelector('#activity-list'); // Cílový div pro aktivity

    if(loadingPlaceholder) loadingPlaceholder.style.display = 'flex'; // Zobrazit skeleton loader
    if(emptyState) emptyState.style.display = 'none';
    if(errorState) errorState.style.display = 'none';
    actualList.innerHTML = ''; // Vyčistit staré aktivity (pokud tam není skeleton)

    // Use currentProfile.user_id which we added after loading profile
    if (!currentProfile || !currentProfile.user_id) {
        console.warn("Profil nebo user_id nenalezen pro načtení aktivit.");
        displayActivityError("Uživatel není identifikován.");
        return;
    }
    const userId = currentProfile.user_id;

    try {
        // Assuming 'user_activity' table uses 'user_id' column
        const { data, error } = await supabase
            .from('user_activity')
            .select('activity_id, timestamp, type, description, related_data')
            .eq('user_id', userId) // Filter by user_id
            .order('timestamp', { ascending: false })
            .limit(5); // Načteme posledních 5 záznamů

        if (error) throw error;

        if (loadingPlaceholder) loadingPlaceholder.style.display = 'none'; // Skrýt skeleton
        activityListContainer.classList.remove('loading');

        if (data && data.length > 0) {
            data.forEach(activity => {
                const activityElement = createActivityElement(activity);
                actualList.appendChild(activityElement);
            });
        } else {
            activityListContainer.classList.add('empty-state-visible');
            if (emptyState) emptyState.style.display = 'flex';
            console.log("Nebyly nalezeny žádné aktivity.");
        }

    } catch (error) {
        console.error("Chyba při načítání aktivit:", error);
        displayActivityError(error.message);
    }
}

// Zobrazí chybu v sekci aktivit
function displayActivityError(message) {
    activityListContainer.classList.remove('loading', 'empty-state-visible');
    activityListContainer.classList.add('error-state-visible');
    const errorState = activityListContainer.querySelector('.card-error-state');
    const loadingPlaceholder = activityListContainer.querySelector('.loading-placeholder');
    const actualList = activityListContainer.querySelector('#activity-list');

    if(loadingPlaceholder) loadingPlaceholder.style.display = 'none';
    if(actualList) actualList.innerHTML = ''; // Vyčistit seznam

    if (errorState) {
        errorState.style.display = 'flex';
        const errorText = errorState.querySelector('p');
        if(errorText) errorText.textContent = `CHYBA // ${message}`;
    }
}


// Vytvoří HTML prvek pro jednu aktivitu
function createActivityElement(activity) {
    const item = document.createElement('div');
    item.className = 'activity-item';

    const icon = document.createElement('div');
    icon.className = 'activity-icon';
    icon.innerHTML = getActivityIcon(activity.type); // Získat ikonu podle typu

    const content = document.createElement('div');
    content.className = 'activity-content';

    const description = document.createElement('p');
    description.className = 'activity-description';
    description.textContent = activity.description || 'Neznámá aktivita';

    const timestamp = document.createElement('span');
    timestamp.className = 'activity-timestamp';
    timestamp.textContent = formatRelativeTime(activity.timestamp);

    content.appendChild(description);
    content.appendChild(timestamp);
    item.appendChild(icon);
    item.appendChild(content);

    // Přidání detailů, pokud jsou k dispozici v related_data
    if (activity.related_data) {
        try {
            // Očekáváme, že related_data je JSON objekt
            const details = activity.related_data; // Supabase by měl automaticky parsovat JSON
            const detailsContainer = document.createElement('div');
            detailsContainer.className = 'activity-details';
             let detailsHtml = '';
             if (details.points_change) {
                 detailsHtml += `<span class="detail points ${details.points_change > 0 ? 'positive' : 'negative'}"> ${details.points_change > 0 ? '+' : ''}${details.points_change} kreditů</span>`;
             }
             if (details.badge_name) {
                  detailsHtml += `<span class="detail badge"><i class="fas fa-medal"></i> Získáno ocenění: ${details.badge_name}</span>`;
             }
             if (details.exercise_name) {
                  detailsHtml += `<span class="detail exercise"><i class="fas fa-laptop-code"></i> Cvičení: ${details.exercise_name}</span>`;
             }
             if (details.accuracy) {
                 detailsHtml += `<span class="detail accuracy"> Přesnost: ${details.accuracy}%</span>`;
             }
            detailsContainer.innerHTML = detailsHtml;
            content.appendChild(detailsContainer); // Přidat pod popis a čas
        } catch (e) {
            console.warn("Nepodařilo se zpracovat related_data pro aktivitu:", activity.activity_id, e);
        }
    }


    return item;
}

// Vrátí HTML ikony pro daný typ aktivity
function getActivityIcon(type) {
    switch (type) {
        case 'exercise_completed': return '<i class="fas fa-check-circle"></i>';
        case 'badge_earned': return '<i class="fas fa-medal"></i>';
        case 'points_added': return '<i class="fas fa-plus-circle"></i>';
        case 'level_up': return '<i class="fas fa-arrow-alt-circle-up"></i>';
        case 'profile_updated': return '<i class="fas fa-user-edit"></i>';
        case 'login_reward': return '<i class="fas fa-gift"></i>'; // New type for reward
        case 'login': return '<i class="fas fa-sign-in-alt"></i>';
        default: return '<i class="fas fa-history"></i>';
    }
}


// Formátuje časový údaj relativně k současnosti
function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    try {
        const now = new Date();
        const past = new Date(timestamp);
        // Check if date is valid
        if (isNaN(past.getTime())) {
             console.warn("Neplatný timestamp pro formátování:", timestamp);
             return 'neznámo kdy';
        }

        const diffInSeconds = Math.floor((now - past) / 1000);
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInSeconds < 60) return "právě teď";
        if (diffInMinutes < 60) return `před ${diffInMinutes} min`;
        if (diffInHours < 24) return `před ${diffInHours} hod`;
        if (diffInDays === 1) return "včera";
        if (diffInDays < 7) return `před ${diffInDays} dny`;

        // Pro starší záznamy vrátíme normální datum
        return past.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
    } catch (e) {
         console.error("Chyba formátování času:", e, "Timestamp:", timestamp);
         return 'chyba data';
    }
}

// ============================================================================
// Denní odměna za přihlášení (Nová Funkcionalita)
// ============================================================================

/**
 * Zkontroluje poslední přihlášení a případně udělí denní odměnu a aktualizuje sérii.
 */
async function handleDailyLoginReward() {
    console.log("Kontrola denní odměny za přihlášení...");
    // Ensure profile and stats are loaded and profile has 'id'
    if (!currentProfile || !currentProfile.id || !currentUserStats) {
        console.error("Profil (s ID) nebo statistiky nejsou načteny pro kontrolu denní odměny.");
        return;
    }

    const profileId = currentProfile.id; // Use the 'id' from profiles table
    const userId = currentProfile.user_id; // Use the auth user id for other tables (like user_stats)
    const lastLoginDateStr = currentProfile.last_login_date; // Očekává 'YYYY-MM-DD' nebo null
    const currentStreak = currentProfile.streak_days || 0;
    const currentPoints = currentProfile.points || 0;
    const longestStreak = currentUserStats.streak_longest || 0;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // Získá 'YYYY-MM-DD'

    // Pokud je poslední přihlášení dnes, neděláme nic
    if (lastLoginDateStr === todayStr) {
        console.log("Uživatel se již dnes přihlásil. Žádná další denní odměna.");
        return;
    }

    console.log(`Poslední přihlášení: ${lastLoginDateStr}, Dnes: ${todayStr}`);

    let newStreak = 1; // Výchozí nová série je 1
    let pointsToAdd = 5; // Základní denní odměna
    let streakContinued = false; // Příznak, zda série pokračuje

    // Pokud existuje záznam o posledním přihlášení
    if (lastLoginDateStr) {
        try {
             const lastLoginDate = new Date(lastLoginDateStr + 'T00:00:00Z'); // Zajistit UTC pro porovnání
             const yesterday = new Date(today);
             yesterday.setUTCDate(today.getUTCDate() - 1); // Používáme UTC pro konzistenci
             const yesterdayStr = yesterday.toISOString().split('T')[0];

            console.log(`Včera bylo: ${yesterdayStr}`);

            if (lastLoginDateStr === yesterdayStr) {
                // Série pokračuje
                newStreak = currentStreak + 1;
                streakContinued = true;
                console.log(`Série pokračuje, nová délka: ${newStreak}`);

                // Bonusy za sérii (příklady, upravte dle potřeby)
                if (newStreak === 3) pointsToAdd += 10;
                else if (newStreak === 7) pointsToAdd += 20;
                else if (newStreak === 14) pointsToAdd += 35;
                else if (newStreak % 30 === 0) pointsToAdd += 100; // Bonus každých 30 dní

            } else {
                // Série byla přerušena (lastLogin nebyl včera)
                console.log("Série přihlášení byla přerušena.");
                newStreak = 1; // Reset na 1
            }
        } catch(e) {
             console.error("Chyba při zpracování dat pro sérii:", e);
             // Ponechat newStreak = 1 a základní body
        }
    } else {
        // První zaznamenané přihlášení (nebo první po implementaci funkce)
        console.log("První zaznamenané přihlášení pro denní odměnu.");
        newStreak = 1;
    }

    const newPoints = currentPoints + pointsToAdd;
    const newLongestStreak = Math.max(longestStreak, newStreak);

    console.log(`Nová série: ${newStreak}, Body k přidání: ${pointsToAdd}, Nové body: ${newPoints}, Nejdelší série: ${newLongestStreak}`);

    try {
        // Aktualizace databáze v jedné transakci (pokud Supabase podporuje, jinak postupně)
        // 1. Aktualizace profilu
        // *** CORRECTION: Use 'id' to identify the profile row ***
        const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({
                last_login_date: todayStr,
                streak_days: newStreak,
                points: newPoints
            })
            .eq('id', profileId); // Filter by 'id'

        if (profileUpdateError) throw new Error(`Chyba aktualizace profilu: ${profileUpdateError.message}`);
        console.log("Profil aktualizován (datum, série, body).");

        // 2. Aktualizace nejdelší série (pouze pokud se zvýšila)
        // Assuming 'user_stats' uses 'user_id'
        if (newLongestStreak > longestStreak) {
            const { error: statsUpdateError } = await supabase
                .from('user_stats')
                .update({ streak_longest: newLongestStreak })
                .eq('user_id', userId); // Filter by 'user_id' for stats table

            // Check if stats update failed because row didn't exist (shouldn't happen after upsert)
            if (statsUpdateError && statsUpdateError.code === 'PGRST116') {
                 console.warn(`Řádek pro user_stats (user_id: ${userId}) nenalezen pro update nejdelší série. Upsert mohl selhat.`);
                 // Try inserting the whole stats record again? Or just log it.
            } else if (statsUpdateError) {
                 throw new Error(`Chyba aktualizace statistik: ${statsUpdateError.message}`);
            } else {
                console.log("Nejdelší série ve statistikách aktualizována.");
                currentUserStats.streak_longest = newLongestStreak; // Aktualizace lokálního stavu
            }
        }

        // Aktualizace lokálního stavu profilu
        currentProfile.last_login_date = todayStr;
        currentProfile.streak_days = newStreak;
        currentProfile.points = newPoints;


        // Zobrazit oznámení uživateli
        let toastMessage = `DENNÍ ODMĚNA: +${pointsToAdd} kreditů! `;
        if (streakContinued) {
            toastMessage += `Série prodloužena na ${newStreak} dní! 🔥`;
        } else if (lastLoginDateStr) { // Pokud série začala znovu (nebyl to úplně první login)
             toastMessage += `Nová série začala: 1 den!`;
        } else { // Úplně první login
             toastMessage += `Série začala: 1 den!`;
        }
        showToast(toastMessage, 'success', 7000); // Zobrazit déle


        // Aktualizovat UI (karty statistik)
        updateStatCards();
        // Aktualizovat i text v kartě kreditů o dnešním zisku?
        const pointsCardChangeEl = pointsCard.querySelector('.stat-card-change');
        if (pointsCardChangeEl) {
             pointsCardChangeEl.innerHTML = `<i class="fas fa-plus"></i> Získáno dnes: +${pointsToAdd}`;
        }


        // Přidat záznam do logu aktivit?
        // Assuming 'user_activity' uses 'user_id'
        await logActivity('login_reward', `Získána denní odměna a aktualizována série na ${newStreak} dní.`, { points_change: pointsToAdd, current_streak: newStreak });

        // Zkontrolovat odznaky za sérii
        // Assuming 'user_badges' uses 'user_id'
        await checkAndAwardStreakBadges(userId, newStreak);


    } catch (error) {
        console.error('Chyba při zpracování denní odměny a aktualizaci DB:', error);
        showToast(`Chyba při ukládání denní odměny: ${error.message}`, 'error');
        // Vrátit lokální data do původního stavu? Záleží na strategii.
    }
}

/**
 * Kontroluje, zda uživatel dosáhl nové série pro získání odznaku.
 * (Tato funkce vyžaduje tabulky 'badges' a 'user_badges')
 * Assuming 'user_badges' uses 'user_id'.
 */
async function checkAndAwardStreakBadges(userId, currentStreak) {
    console.log(`Kontrola odznaků pro sérii ${currentStreak} dní pro user_id: ${userId}`);
    if (!userId) {
         console.warn("checkAndAwardStreakBadges přeskočeno: Chybí user_id.");
         return;
    }
    try {
        // 1. Získat odznaky typu 'streak', které uživatel ještě nemá
        const { data: potentialBadges, error: badgesError } = await supabase
            .from('badges')
            .select('badge_id, name, requirement, description, icon')
            .eq('type', 'streak') // Předpokládáme sloupec 'type'
            .lte('requirement', currentStreak); // Požadavek je menší nebo roven aktuální sérii

        if (badgesError) throw new Error(`Chyba načítání odznaků: ${badgesError.message}`);
        if (!potentialBadges || potentialBadges.length === 0) {
            console.log("Žádné relevantní odznaky za sérii nenalezeny.");
            return;
        }

        // 2. Získat odznaky, které uživatel již vlastní
        // Assuming 'user_badges' uses 'user_id'
        const { data: userBadges, error: userBadgesError } = await supabase
            .from('user_badges')
            .select('badge_id')
            .eq('user_id', userId); // Filter by user_id

        if (userBadgesError) throw new Error(`Chyba načítání uživatelských odznaků: ${userBadgesError.message}`);

        const userBadgeIds = new Set(userBadges.map(b => b.badge_id));
        console.log("Uživatel vlastní odznaky:", userBadgeIds);
        console.log("Potenciální odznaky k udělení:", potentialBadges);


        // 3. Najít nové odznaky k udělení
        const badgesToAward = potentialBadges.filter(badge => !userBadgeIds.has(badge.badge_id));
        console.log("Odznaky k udělení:", badgesToAward);


        if (badgesToAward.length === 0) {
            console.log("Uživatel již vlastní všechny dosažené odznaky za sérii.");
            return;
        }

        // 4. Udělit nové odznaky
        // Assuming 'user_badges' uses 'user_id'
        const newBadgeRecords = badgesToAward.map(badge => ({
            user_id: userId, // Use user_id here
            badge_id: badge.badge_id,
            earned_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
            .from('user_badges')
            .insert(newBadgeRecords);

        if (insertError) throw new Error(`Chyba udělování odznaků: ${insertError.message}`);

        // 5. Informovat uživatele a zalogovat
        for (const badge of badgesToAward) {
            console.log(`Udělen nový odznak: ${badge.name}`);
            showToast(`NOVÉ OCENĚNÍ: ${badge.name}! <i class="${badge.icon || 'fas fa-medal'}"></i>`, 'info', 8000);
            // Assuming 'user_activity' uses 'user_id'
            await logActivity('badge_earned', `Získáno ocenění "${badge.name}" za dosažení série ${badge.requirement} dní.`, { badge_id: badge.badge_id, badge_name: badge.name });
            // Assuming 'notifications' uses 'user_id'
            await addNotification(userId, 'badge', `Gratulujeme! Získali jste ocenění "${badge.name}" za vaši úžasnou sérii přihlášení!`, `/dashboard/oceneni.html#badge-${badge.badge_id}`);

        }

    } catch (error) {
        console.error("Chyba při kontrole nebo udělování odznaků za sérii:", error);
        // Nezobrazujeme toast, aby nezahltil uživatele chybami systému odznaků
    }
}


// ============================================================================
// Notifikace (základní implementace)
// ============================================================================
let notifications = []; // Pole pro uchování načtených notifikací

// Načte notifikace pro uživatele
// Assuming 'notifications' table uses 'user_id'
async function loadNotifications() {
    // Use currentProfile.user_id which we added after loading profile
    if (!currentProfile || !currentProfile.user_id) {
        console.warn("Profil nebo user_id nenalezen pro načtení notifikací.");
        return;
    }
    const userId = currentProfile.user_id;
    console.log("Načítání notifikací pro user_id:", userId);

    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('notification_id, type, message, link, created_at, is_read')
            .eq('user_id', userId) // Filter by user_id
            .order('created_at', { ascending: false })
            .limit(20); // Omezit na posledních 20

        if (error) throw error;

        notifications = data || [];
        renderNotifications();
        updateNotificationBadge();

    } catch (error) {
        console.error("Chyba při načítání notifikací:", error);
        notificationsList.innerHTML = '<div class="notification-item error">Chyba načítání signálů.</div>';
        updateNotificationBadge(0); // Reset počítadla při chybě
    }
}

// Vykreslí notifikace v dropdownu
function renderNotifications() {
    notificationsList.innerHTML = ''; // Vyčistit předchozí
    const unreadCount = notifications.filter(n => !n.is_read).length;

    if (notifications.length === 0) {
        noNotificationsMsg.style.display = 'block';
        markAllReadBtn.disabled = true;
    } else {
        noNotificationsMsg.style.display = 'none';
        notifications.forEach(notification => {
            notificationsList.appendChild(createNotificationElement(notification));
        });
        markAllReadBtn.disabled = unreadCount === 0; // Povolit, jen pokud jsou nepřečtené
    }
}

// Vytvoří HTML prvek pro jednu notifikaci
function createNotificationElement(notification) {
    const item = document.createElement('div');
    item.className = `notification-item ${notification.is_read ? 'read' : 'unread'}`;
    item.dataset.id = notification.notification_id;

    const icon = document.createElement('div');
    icon.className = 'notification-icon';
    icon.innerHTML = getNotificationIcon(notification.type); // Ikona podle typu

    const content = document.createElement('div');
    content.className = 'notification-content';

    const message = document.createElement('p');
    message.className = 'notification-message';
    message.textContent = notification.message;

    const time = document.createElement('span');
    time.className = 'notification-time';
    time.textContent = formatRelativeTime(notification.created_at);

    content.appendChild(message);
    content.appendChild(time);

    item.appendChild(icon);
    item.appendChild(content);

    // Přidání click listeneru pro označení jako přečtené a navigaci
    item.addEventListener('click', async (event) => {
        event.stopPropagation(); // Prevent dropdown close if click was handled
        if (!notification.is_read) {
            markNotificationAsRead(notification.notification_id);
            // Optimistic UI update
            const localNotif = notifications.find(n => n.notification_id === notification.notification_id);
            if (localNotif) localNotif.is_read = true;
             item.classList.remove('unread');
             item.classList.add('read');
             updateNotificationBadge(); // Snížit počítadlo
        }
        if (notification.link) {
            window.location.href = notification.link;
        }
    });

    return item;
}


// Vrátí ikonu pro typ notifikace
function getNotificationIcon(type) {
    switch (type) {
        case 'badge': return '<i class="fas fa-medal"></i>';
        case 'system': return '<i class="fas fa-cogs"></i>';
        case 'message': return '<i class="fas fa-envelope"></i>';
        case 'alert': return '<i class="fas fa-exclamation-triangle"></i>';
        case 'reward': return '<i class="fas fa-gift"></i>'; // Např. pro denní odměnu
        default: return '<i class="fas fa-bell"></i>';
    }
}

// Aktualizuje počet nepřečtených notifikací v odznaku
function updateNotificationBadge() {
    const unreadCount = notifications.filter(n => !n.is_read).length;
    if (unreadCount > 0) {
        notificationCountBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        notificationCountBadge.style.display = 'flex'; // Zobrazit odznak
    } else {
        notificationCountBadge.style.display = 'none'; // Skrýt odznak
    }
     // Aktualizovat stav tlačítka "Označit vše jako přečtené"
     markAllReadBtn.disabled = unreadCount === 0;
}

// Označí notifikaci jako přečtenou v DB
// Assuming 'notifications' uses 'user_id'
async function markNotificationAsRead(notificationId) {
     if (!currentProfile || !currentProfile.user_id) {
         console.warn("Nelze označit notifikaci: Chybí user_id.");
         return;
     }
     const userId = currentProfile.user_id;
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('notification_id', notificationId)
             .eq('user_id', userId); // Důležité: zajistit, že uživatel mění jen svoje

        if (error) throw error;
        console.log(`Notifikace ${notificationId} označena jako přečtená v DB.`);

    } catch (error) {
        console.error(`Chyba při označování notifikace ${notificationId} jako přečtené v DB:`, error);
        showToast("Chyba při aktualizaci stavu notifikace.", "error");
        // Zde můžeme zvážit vrácení UI do původního stavu, pokud selže DB update
         const localNotif = notifications.find(n => n.notification_id === notificationId);
            if (localNotif) {
                localNotif.is_read = false; // Revert optimistic update
                 const itemElement = notificationsList.querySelector(`.notification-item[data-id="${notificationId}"]`);
                 if(itemElement) {
                     itemElement.classList.add('unread');
                     itemElement.classList.remove('read');
                 }
                 updateNotificationBadge();
            }
    }
}

// Označí všechny notifikace jako přečtené
// Assuming 'notifications' uses 'user_id'
async function markAllNotificationsAsRead() {
     if (!currentProfile || !currentProfile.user_id) {
         console.warn("Nelze označit vše: Chybí user_id.");
         return;
     }
     const userId = currentProfile.user_id;
     console.log("Označování všech notifikací jako přečtených pro user_id:", userId);
     markAllReadBtn.disabled = true; // Deaktivovat během operace
     markAllReadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Zobrazit loader

    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId) // Filter by user_id
            .eq('is_read', false); // Označit jen ty, co jsou nepřečtené

        if (error) throw error;

         // Aktualizovat lokální stav a UI
         notifications.forEach(n => { if (!n.is_read) n.is_read = true; });
         renderNotifications(); // Překreslit seznam (všechny budou 'read')
         updateNotificationBadge(); // Počítadlo bude 0

        console.log("Všechny notifikace označeny jako přečtené v DB.");
        showToast("Všechny signály označeny jako přijaté.", "success");

    } catch (error) {
        console.error("Chyba při označování všech notifikací jako přečtených:", error);
        showToast("Nepodařilo se označit všechny signály.", "error");
        // Znovu povolit tlačítko, pokud selhalo
         updateNotificationBadge(); // Znovu zkontrolovat stav
    } finally {
         markAllReadBtn.innerHTML = 'Vymazat vše'; // Vrátit text tlačítka
         // Tlačítko zůstane disabled, protože updateNotificationBadge() ho nastaví správně
    }
}


/**
 * Přidá novou notifikaci pro uživatele do DB.
 * @param {string} userId - Auth ID uživatele (UUID).
 * @param {string} type - Typ notifikace (badge, system, message, alert, reward).
 * @param {string} message - Text notifikace.
 * @param {string|null} link - Odkaz pro kliknutí (nepovinný).
 * Assuming 'notifications' uses 'user_id'.
 */
async function addNotification(userId, type, message, link = null) {
    if (!supabase || !userId) {
        console.error("Supabase klient nebo user ID není k dispozici pro přidání notifikace.");
        return;
    }
    console.log(`Přidávání notifikace typu ${type} pro user_id ${userId}`);
    try {
        const { data, error } = await supabase
            .from('notifications')
            .insert([{
                user_id: userId, // Use user_id here
                type: type,
                message: message,
                link: link,
                is_read: false // Nová notifikace je vždy nepřečtená
                // created_at se nastaví automaticky databází (DEFAULT now())
            }])
            .select(); // Vrátit vložený záznam pro případné další použití

        if (error) throw error;

        console.log("Notifikace úspěšně přidána:", data);
        // Můžeme zde i aktualizovat UI notifikací v reálném čase, pokud je potřeba
         if (data && data.length > 0) {
            // Přidat na začátek pole pro zobrazení nahoře
             notifications.unshift(data[0]);
             renderNotifications();
             updateNotificationBadge();
             // Zobrazit "toast" o nové notifikaci? Možná ne, pokud je to výsledek akce (např. odznak)
         }

    } catch (error) {
        console.error("Chyba při přidávání notifikace:", error);
        // Nezobrazujeme toast, aby systémové chyby nezahltily uživatele
    }
}


// ============================================================================
// Pomocné Funkce
// ============================================================================

// Zobrazí globální chybovou zprávu
function displayGlobalError(message) {
    if (globalErrorContainer) {
        globalErrorContainer.textContent = message;
        globalErrorContainer.style.display = 'block';
    }
    console.error("GLOBÁLNÍ CHYBA:", message);
}

// Skryje globální chybovou zprávu
function hideGlobalError() {
    if (globalErrorContainer) {
        globalErrorContainer.style.display = 'none';
    }
}

// Zobrazí toast notifikaci
function showToast(message, type = 'info', duration = 4000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`; // např. toast-success, toast-error

     // Přidání ikony podle typu
     let iconClass = 'fas fa-info-circle'; // Default
     if (type === 'success') iconClass = 'fas fa-check-circle';
     else if (type === 'error') iconClass = 'fas fa-exclamation-triangle';
     else if (type === 'warning') iconClass = 'fas fa-exclamation-circle';

    toast.innerHTML = `<i class="${iconClass}"></i> <p>${message}</p>`;

    toastContainer.appendChild(toast);

    // Trigger animace
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('show');
      });
    });

    // Automatické odstranění toastu
    setTimeout(() => {
        toast.classList.remove('show');
        // Odstranit prvek z DOM po skončení animace
        toast.addEventListener('transitionend', () => {
             if(toast.parentNode === toastContainer) { // Check if it wasn't removed already
                 toastContainer.removeChild(toast);
             }
        }, { once: true }); // Ensure listener is removed after firing once
         // Failsafe remove if transitionend doesn't fire (e.g., element hidden)
         setTimeout(() => {
             if (toast.parentNode === toastContainer) {
                 toastContainer.removeChild(toast);
             }
         }, duration + 500); // Add buffer for transition time
    }, duration);
}

// Zobrazí nebo skryje úvodní loader
function showInitialLoader(show) {
    if (initialLoader) {
        initialLoader.style.display = show ? 'flex' : 'none';
    }
}


/**
 * Zaznamená aktivitu uživatele do tabulky user_activity.
 * @param {string} type - Typ aktivity (např. 'exercise_completed', 'badge_earned').
 * @param {string} description - Popis aktivity.
 * @param {object|null} relatedData - JSON objekt s dalšími detaily (nepovinný).
 * Assuming 'user_activity' uses 'user_id'.
 */
async function logActivity(type, description, relatedData = null) {
    // Use currentProfile.user_id which we added after loading profile
    if (!supabase || !currentProfile || !currentProfile.user_id) {
        console.warn("Nelze zaznamenat aktivitu: Supabase nebo user_id není k dispozici.");
        return;
    }
    const userId = currentProfile.user_id;
    console.log(`Logování aktivity: Typ=${type}, UserID=${userId}, Popis=${description}`);

    try {
        const { error } = await supabase
            .from('user_activity')
            .insert([{
                user_id: userId, // Use user_id here
                type: type,
                description: description,
                related_data: relatedData
                // timestamp se nastaví automaticky v DB (DEFAULT now())
            }]);

        if (error) throw error;
        console.log("Aktivita úspěšně zaznamenána.");

    } catch (error) {
        console.error("Chyba při zaznamenávání aktivity:", error);
        // Nezobrazujeme chybu uživateli, logování je spíše na pozadí.
    }
}

// ============================================================================
// Nastavení Event Listenerů
// ============================================================================
function setupEventListeners() {
    // Přepínání postranního panelu
    sidebarToggleBtn?.addEventListener('click', toggleSidebar);
    sidebarCloseToggle?.addEventListener('click', closeSidebar);
    mainMobileMenuToggle?.addEventListener('click', openSidebar);
    sidebarOverlay?.addEventListener('click', closeSidebar);

    // Ošetření kliknutí mimo sidebar pro zavření na mobilu
    document.addEventListener('click', (event) => {
        if (window.innerWidth < 992 && sidebar?.classList.contains('open')) {
            const isClickInsideSidebar = sidebar.contains(event.target);
            const isClickOnMobileToggle = mainMobileMenuToggle?.contains(event.target);
            if (!isClickInsideSidebar && !isClickOnMobileToggle) {
                closeSidebar();
            }
        }
     });

    // Tlačítko pro obnovení dat
    refreshBtn?.addEventListener('click', () => {
         console.log("Manuální refresh dat...");
         showToast("SYNCHRONIZACE DAT...", "info", 2000);
         hideGlobalError(); // Skrýt případné staré chyby
         // Reset cards to loading state immediately for better UX
         updateSingleStatCard(progressCard, { loading: true });
         updateSingleStatCard(pointsCard, { loading: true });
         updateSingleStatCard(streakCard, { loading: true });
         activityListContainer.classList.add('loading');
         activityListContainer.classList.remove('error-state-visible', 'empty-state-visible');
         activityListContainer.querySelector('#activity-list').innerHTML = ''; // Clear old list
         activityListContainer.querySelector('.loading-placeholder').style.display = 'flex';


         loadDashboardData(); // Znovu načíst všechna data
    });

    // Tlačítko pro spuštění tréninku
    startPracticeBtn?.addEventListener('click', () => {
        window.location.href = '/dashboard/procvicovani/main.html'; // Přesměrování
    });

     // Notifikace Bell - otevření/zavření dropdownu
     notificationBell?.addEventListener('click', (event) => {
          event.stopPropagation(); // Zabraňuje zavření při kliku na zvonek
          notificationsDropdown.classList.toggle('show');
     });

     // Zavření dropdownu notifikací při kliknutí mimo něj
     document.addEventListener('click', (event) => {
          if (notificationsDropdown && notificationsDropdown.classList.contains('show')) {
               if (!notificationsDropdown.contains(event.target) && !notificationBell.contains(event.target)) {
                    notificationsDropdown.classList.remove('show');
               }
          }
     });

     // Tlačítko "Označit vše jako přečtené"
     markAllReadBtn?.addEventListener('click', markAllNotificationsAsRead);


    // Online/Offline status
    window.addEventListener('online', () => handleConnectionChange(true));
    window.addEventListener('offline', () => handleConnectionChange(false));

    // Animace při scrollu - jednoduchá implementace
    const animatedElements = document.querySelectorAll('[data-animate]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                // Optional: unobserve after animating once
                // observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 }); // Spustit animaci, když je 10% prvku vidět

    animatedElements.forEach(el => observer.observe(el));


     // --- Mouse Follower Effect ---
     if (mouseFollower && window.matchMedia('(pointer: fine)').matches) { // Only for fine pointers (mice)
         document.body.addEventListener('mousemove', (e) => {
             // Použijeme requestAnimationFrame pro plynulejší výkon
             window.requestAnimationFrame(() => {
                 mouseFollower.style.left = `${e.clientX}px`;
                 mouseFollower.style.top = `${e.clientY}px`;
             });
         });
         document.body.addEventListener('mouseleave', () => {
             mouseFollower.style.opacity = '0';
         });
         document.body.addEventListener('mouseenter', () => {
              mouseFollower.style.opacity = '1';
         });
     } else if (mouseFollower) {
         mouseFollower.style.display = 'none'; // Hide on touch devices
     }


}

// ============================================================================
// Funkce pro ovládání Sidebar
// ============================================================================
function toggleSidebar() {
    sidebar.classList.toggle('closed');
    mainContent.classList.toggle('sidebar-closed');
    sidebarToggleBtn.classList.toggle('rotated'); // Otočení šipky
}

function closeSidebar() {
    sidebar.classList.remove('open'); // Pro mobilní verzi
    sidebarOverlay.classList.remove('active'); // Skrýt overlay
    // Na desktopu můžeme mít jinou logiku, např. sidebar.classList.add('closed');
}

function openSidebar() {
     sidebar.classList.add('open'); // Pro mobilní verzi
     sidebarOverlay.classList.add('active'); // Zobrazit overlay
}


// ============================================================================
// Online/Offline Handling
// ============================================================================
let wasOffline = !navigator.onLine; // Track if we were previously offline

function handleConnectionChange(isOnline) {
    if (offlineBanner) {
        offlineBanner.style.display = isOnline ? 'none' : 'flex';
    }
    if (isOnline) {
        console.log("Spojení obnoveno.");
        if (wasOffline) { // Only show toast and reload if we *were* offline
            showToast("ONLINE // SPOJENÍ OBNOVENO", "success");
            hideGlobalError(); // Skrýt případné chyby způsobené offline stavem
            // Můžeme zkusit znovu načíst data, pokud předchozí pokus selhal kvůli offline
            if (!currentProfile) { // Pokud profil nebyl načten
                console.log("Pokus o opětovné načtení dat po obnovení spojení...");
                loadDashboardData();
            }
            wasOffline = false; // Reset flag
        }
    } else {
        console.warn("Spojení ztraceno.");
        showToast("OFFLINE // SPOJENÍ ZTRACENO", "warning", 6000);
        wasOffline = true; // Set flag
        // Nezobrazujeme globální chybu hned, jen banner
    }
}


// ============================================================================
// Hlavní funkce pro načtení všech dat na stránce
// ============================================================================
async function loadDashboardData() {
    console.log("Zahájení načítání dat pro dashboard...");
    showInitialLoader(true);
    hideGlobalError();

    try {
        // 0. Načíst tituly jako první, aby byly dostupné pro profil
        await loadTitles();

        // 1. Načíst profil a statistiky uživatele (obsahuje i volání handleDailyLoginReward)
        await loadUserProfile(); // Tato funkce nyní volá handleDailyLoginReward po načtení profilu

        // Pokud se profil nebo statistiky nepodařilo načíst, nemá smysl pokračovat
         if (!currentProfile || !currentUserStats) {
             // loadUserProfile should have already displayed an error
             console.error("loadDashboardData přerušeno: Nepodařilo se načíst profil nebo statistiky.");
             // Don't throw here again, let the UI show the error from loadUserProfile
             return; // Exit the function gracefully
         }

        // 2. Aktualizovat statistické karty (už by měly být aktualizované po handleDailyLoginReward, ale pro jistotu)
        updateStatCards();

        // 3. Načíst nedávné aktivity
        await loadRecentActivity();

        // 4. Načíst notifikace
        await loadNotifications();

        console.log("Všechna data pro dashboard načtena úspěšně.");

    } catch (error) {
        // Catch errors from loadTitles, loadRecentActivity, loadNotifications
        console.error("Chyba při načítání doplňkových dat dashboardu (tituly, aktivity, notifikace):", error);
        // Zobrazit globální chybu, pokud již není zobrazena z loadUserProfile
        if (globalErrorContainer && globalErrorContainer.style.display !== 'block') {
             displayGlobalError(`Nepodařilo se načíst všechna data nástěnky: ${error.message}`);
        }
    } finally {
        showInitialLoader(false); // Skrýt hlavní loader po dokončení (i v případě chyby)
         // Aktivovat animace po načtení
          const animatedElements = document.querySelectorAll('[data-animate]');
          animatedElements.forEach(el => el.style.opacity = '1'); // Nebo přidat třídu pro start animace
    }
}

// ============================================================================
// Inicializace stránky
// ============================================================================
function initializeDashboard() {
    // Prevent multiple initializations if auth state changes rapidly
    if (window.dashboardInitialized) {
         console.log("Dashboard již byl inicializován, přeskočení.");
         return;
    }
    window.dashboardInitialized = true;
    console.log("Inicializace Dashboardu...");

    // Nastavit aktuální rok v patičce
    const currentYear = new Date().getFullYear();
    if(currentYearSidebar) currentYearSidebar.textContent = currentYear;
    if(currentYearFooter) currentYearFooter.textContent = currentYear;

    // Nastavit event listenery
    setupEventListeners();

    // Zkontrolovat počáteční stav připojení
    handleConnectionChange(navigator.onLine);

    // Načíst všechna potřebná data
    loadDashboardData();

    // Reset flag after a delay to allow for potential re-initialization if needed after full sign-out/sign-in
    setTimeout(() => { window.dashboardInitialized = false; }, 3000);
}


// Spuštění po načtení DOM a Supabase klienta
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM načten. Čekání na Supabase...");
    // Inicializace Supabase se spustí sama a následně zavolá initializeDashboard
    // přes onAuthStateChange, pokud je uživatel přihlášen.
     initializeSupabase();
    // Pokud Supabase není dostupný (např. chyba skriptu), initializeDashboard se nezavolá.
    // Můžeme přidat fallback po určité době?
     setTimeout(() => {
         if (!supabase && initialLoader && initialLoader.style.display !== 'none') { // Pokud Supabase stále není inicializován po 5s a loader je vidět
             console.error("Supabase se nepodařilo inicializovat v časovém limitu.");
             displayGlobalError("Kritická chyba: Systémové jádro (Supabase) není dostupné.");
             showInitialLoader(false);
         }
     }, 5000);
});