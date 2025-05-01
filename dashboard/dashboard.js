// ============================================================================
// dashboard.js -- Hlavní skript pro stránku Dashboard
// ============================================================================
// Globální proměnné pro Supabase klienta a data
let supabase;
let currentProfile = null;
let currentUserStats = null;
let availableTitles = {}; // Pro uložení načtených titulů

// Konstanti pro API klíče a URL (z konfigurace nebo env proměnných)
const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co'; // Nahraďte skutečným URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10'; // Nahraďte skutečným ANON klíčem

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
                initializeDashboard();
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

        const userId = user.id;

        // Načtení profilu (včetně nových polí)
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, username, avatar_url, points, selected_title, last_login_date, streak_days')
            .eq('user_id', userId)
            .single();

        if (profileError) {
            // Pokud profil neexistuje (např. nová registrace), vytvoříme ho? Nebo chyba?
            if (profileError.code === 'PGRST116') { // 'PGRST116' = row not found
                console.warn(`Profil pro user_id ${userId} nenalezen. Možná nový uživatel?`);
                 // Zde by mohla být logika pro vytvoření základního profilu, pokud je potřeba
                 throw new Error("Profil uživatele nenalezen.");
            } else {
                throw profileError;
            }
        }
        if (!profileData) throw new Error("Profilová data nebyla nalezena.");
        currentProfile = profileData;
        console.log("Profil načten:", currentProfile);

        // Načtení statistik (včetně nového pole)
        // Použijeme 'upsert', abychom zajistili, že záznam existuje
        const { data: statsData, error: statsError } = await supabase
            .from('user_stats')
            .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: false }) // Vytvoří řádek, pokud neexistuje
            .select('user_id, total_exercises_completed, total_correct_answers, total_incorrect_answers, average_accuracy, streak_longest') // Přidáno streak_longest
            .eq('user_id', userId)
            .single();


        if (statsError && statsError.code !== 'PGRST116') { // Ignorovat chybu "not found" po upsertu, pokud by nastala zvláštním způsobem
            console.error("Chyba při načítání/upsertu statistik:", statsError);
            // Možná použít výchozí hodnoty místo selhání?
             currentUserStats = { // Fallback stats
                 user_id: userId,
                 total_exercises_completed: 0,
                 total_correct_answers: 0,
                 total_incorrect_answers: 0,
                 average_accuracy: 0,
                 streak_longest: 0 // Přidáno
             };
             showToast("Nepodařilo se načíst statistiky uživatele.", "warning");
        } else {
            currentUserStats = statsData || { // Zajistíme, že stats existují, i kdyby upsert vrátil null (což by neměl)
                user_id: userId,
                total_exercises_completed: 0,
                total_correct_answers: 0,
                total_incorrect_answers: 0,
                average_accuracy: 0,
                streak_longest: 0 // Přidáno
            };
             // Pokud statsData byly null (což by po upsertu nemělo nastat, ale pro jistotu)
             if (!statsData) console.warn("Upsert pro statistiky nevrátil data, použity výchozí.");
        }
        console.log("Statistiky načteny:", currentUserStats);

        updateSidebarProfile();
        updateWelcomeMessage();

        // Nyní, když máme profil, zkontrolujeme denní odměnu
        await handleDailyLoginReward();

    } catch (error) {
        console.error("Chyba při načítání profilu nebo statistik:", error);
        displayGlobalError(`Chyba při načítání dat uživatele: ${error.message}`);
        // Zde bychom mohli zvážit odhlášení uživatele nebo zobrazení trvalé chyby
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
        // Můžeme zobrazit chybový stav v kartách
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

    if (data.loading) {
        cardElement.classList.add('loading');
        cardElement.classList.remove('error');
        if (content) content.style.display = 'none';
        if (loadingSkeleton) loadingSkeleton.style.display = 'flex'; // Nebo 'block' podle stylů
        return;
    }

     if (data.error) {
         cardElement.classList.remove('loading');
         cardElement.classList.add('error'); // Přidat třídu pro error styl
         if (content) content.style.display = 'none'; // Skrýt obsah
         if (loadingSkeleton) loadingSkeleton.style.display = 'none'; // Skrýt skeleton
         // Zobrazit chybovou zprávu uvnitř karty?
         // Např. cardElement.innerHTML = `<div class="error-message">${data.message}</div>`;
         // Prozatím jen třída 'error'
         console.error("Chyba v kartě:", data.title || cardElement.id, data.message);
         return;
     }

    cardElement.classList.remove('loading', 'error');
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
    if (!stats || stats.total_exercises_completed === 0) return 0;
    // Velmi zjednodušený příklad:
    // Můžeme vážit různé faktory: počet cvičení, přesnost atd.
    // Nebo to může být hodnota načtená z jiné tabulky (např. 'user_progress')
    const accuracyWeight = 0.6;
    const completionWeight = 0.4;
    const normalizedCompletion = Math.min(stats.total_exercises_completed / 100, 1); // Max 100 cvičení = 100%
    const progress = (stats.average_accuracy * accuracyWeight) + (normalizedCompletion * completionWeight);
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

    if (!currentProfile) {
        console.warn("Profil nenalezen pro načtení aktivit.");
        displayActivityError("Uživatel není identifikován.");
        return;
    }

    try {
        const { data, error } = await supabase
            .from('user_activity')
            .select('activity_id, timestamp, type, description, related_data')
            .eq('user_id', currentProfile.user_id)
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
        case 'login': return '<i class="fas fa-sign-in-alt"></i>'; // Nový typ pro login?
        default: return '<i class="fas fa-history"></i>';
    }
}


// Formátuje časový údaj relativně k současnosti
function formatRelativeTime(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
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
}

// ============================================================================
// Denní odměna za přihlášení (Nová Funkcionalita)
// ============================================================================

/**
 * Zkontroluje poslední přihlášení a případně udělí denní odměnu a aktualizuje sérii.
 */
async function handleDailyLoginReward() {
    console.log("Kontrola denní odměny za přihlášení...");
    if (!currentProfile || !currentUserStats) {
        console.error("Profil nebo statistiky nejsou načteny pro kontrolu denní odměny.");
        return;
    }

    const userId = currentProfile.user_id;
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
        const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({
                last_login_date: todayStr,
                streak_days: newStreak,
                points: newPoints
            })
            .eq('user_id', userId);

        if (profileUpdateError) throw new Error(`Chyba aktualizace profilu: ${profileUpdateError.message}`);
        console.log("Profil aktualizován (datum, série, body).");

        // 2. Aktualizace nejdelší série (pouze pokud se zvýšila)
        if (newLongestStreak > longestStreak) {
            const { error: statsUpdateError } = await supabase
                .from('user_stats')
                .update({ streak_longest: newLongestStreak })
                .eq('user_id', userId);

            if (statsUpdateError) throw new Error(`Chyba aktualizace statistik: ${statsUpdateError.message}`);
            console.log("Nejdelší série ve statistikách aktualizována.");
            currentUserStats.streak_longest = newLongestStreak; // Aktualizace lokálního stavu
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
        await logActivity('login_reward', `Získána denní odměna a aktualizována série na ${newStreak} dní.`, { points_change: pointsToAdd, current_streak: newStreak });

        // Zkontrolovat odznaky za sérii
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
 */
async function checkAndAwardStreakBadges(userId, currentStreak) {
    console.log(`Kontrola odznaků pro sérii ${currentStreak} dní.`);
    try {
        // 1. Získat odznaky typu 'streak', které uživatel ještě nemá
        const { data: potentialBadges, error: badgesError } = await supabase
            .from('badges')
            .select('badge_id, name, requirement, description, icon')
            .eq('type', 'streak') // Předpokládáme sloupec 'type'
            .lte('requirement', currentStreak); // Požadavek je menší nebo roven aktuální sérii

        if (badgesError) throw new Error(`Chyba načítání odznaků: ${badgesError.message}`);
        if (!potentialBadges || potentialBadges.length === 0) {
            console.log("Žádné relevantní odznaky za sérii nenalezeny nebo již dosaženy.");
            return;
        }

        // 2. Získat odznaky, které uživatel již vlastní
        const { data: userBadges, error: userBadgesError } = await supabase
            .from('user_badges')
            .select('badge_id')
            .eq('user_id', userId);

        if (userBadgesError) throw new Error(`Chyba načítání uživatelských odznaků: ${userBadgesError.message}`);

        const userBadgeIds = new Set(userBadges.map(b => b.badge_id));

        // 3. Najít nové odznaky k udělení
        const badgesToAward = potentialBadges.filter(badge => !userBadgeIds.has(badge.badge_id));

        if (badgesToAward.length === 0) {
            console.log("Uživatel již vlastní všechny dosažené odznaky za sérii.");
            return;
        }

        // 4. Udělit nové odznaky
        const newBadgeRecords = badgesToAward.map(badge => ({
            user_id: userId,
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
            await logActivity('badge_earned', `Získáno ocenění "${badge.name}" za dosažení série ${badge.requirement} dní.`, { badge_id: badge.badge_id, badge_name: badge.name });
            // Zde můžeme přidat i notifikaci
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
async function loadNotifications() {
    if (!currentProfile) return;
    console.log("Načítání notifikací...");
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('notification_id, type, message, link, created_at, is_read')
            .eq('user_id', currentProfile.user_id)
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
    item.addEventListener('click', async () => {
        if (!notification.is_read) {
            markNotificationAsRead(notification.notification_id);
            notification.is_read = true; // Optimistické UI
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
async function markNotificationAsRead(notificationId) {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('notification_id', notificationId)
             .eq('user_id', currentProfile.user_id); // Důležité: zajistit, že uživatel mění jen svoje

        if (error) throw error;
        console.log(`Notifikace ${notificationId} označena jako přečtená.`);

    } catch (error) {
        console.error(`Chyba při označování notifikace ${notificationId} jako přečtené:`, error);
        showToast("Chyba při aktualizaci stavu notifikace.", "error");
        // Zde můžeme zvážit vrácení UI do původního stavu, pokud selže DB update
    }
}

// Označí všechny notifikace jako přečtené
async function markAllNotificationsAsRead() {
     if (!currentProfile) return;
     console.log("Označování všech notifikací jako přečtených...");
     markAllReadBtn.disabled = true; // Deaktivovat během operace
     markAllReadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Zobrazit loader

    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', currentProfile.user_id)
            .eq('is_read', false); // Označit jen ty, co jsou nepřečtené

        if (error) throw error;

         // Aktualizovat lokální stav a UI
         notifications.forEach(n => n.is_read = true);
         renderNotifications(); // Překreslit seznam (všechny budou 'read')
         updateNotificationBadge(); // Počítadlo bude 0

        console.log("Všechny notifikace označeny jako přečtené.");
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
 * @param {string} userId - ID uživatele.
 * @param {string} type - Typ notifikace (badge, system, message, alert, reward).
 * @param {string} message - Text notifikace.
 * @param {string|null} link - Odkaz pro kliknutí (nepovinný).
 */
async function addNotification(userId, type, message, link = null) {
    if (!supabase || !userId) {
        console.error("Supabase klient nebo user ID není k dispozici pro přidání notifikace.");
        return;
    }
    console.log(`Přidávání notifikace typu ${type} pro uživatele ${userId}`);
    try {
        const { data, error } = await supabase
            .from('notifications')
            .insert([{
                user_id: userId,
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
        // Např. přidat notifikaci do lokálního pole 'notifications' a překreslit
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
    setTimeout(() => {
        toast.classList.add('show');
    }, 100); // malý delay pro CSS transition

    // Automatické odstranění toastu
    setTimeout(() => {
        toast.classList.remove('show');
        // Odstranit prvek z DOM po skončení animace
        toast.addEventListener('transitionend', () => {
             if(toast.parentNode === toastContainer) { // Check if it wasn't removed already
                 toastContainer.removeChild(toast);
             }
        });
         // Failsafe remove if transitionend doesn't fire (e.g., element hidden)
         setTimeout(() => {
             if (toast.parentNode === toastContainer) {
                 toastContainer.removeChild(toast);
             }
         }, 500); // Should match transition duration
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
 */
async function logActivity(type, description, relatedData = null) {
    if (!supabase || !currentProfile) {
        console.warn("Nelze zaznamenat aktivitu: Supabase nebo profil není k dispozici.");
        return;
    }
    const userId = currentProfile.user_id;
    console.log(`Logování aktivity: Typ=${type}, Popis=${description}`);

    try {
        const { error } = await supabase
            .from('user_activity')
            .insert([{
                user_id: userId,
                type: type,
                description: description,
                related_data: relatedData
                // timestamp se nastaví automaticky v DB (DEFAULT now())
            }]);

        if (error) throw error;
        console.log("Aktivita úspěšně zaznamenána.");

        // Můžeme zvážit okamžitou aktualizaci UI seznamu aktivit,
        // ale pro dashboard stačí při příštím načtení nebo refresh.
        // Pokud chceme realtime, museli bychom aktivitu přidat do UI zde.

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
        if (window.innerWidth < 768 && sidebar.classList.contains('open')) {
            const isClickInsideSidebar = sidebar.contains(event.target);
            const isClickOnMobileToggle = mainMobileMenuToggle.contains(event.target);
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
            }
        });
    }, { threshold: 0.1 }); // Spustit animaci, když je 10% prvku vidět

    animatedElements.forEach(el => observer.observe(el));


     // --- Mouse Follower Effect ---
     if (mouseFollower) {
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
function handleConnectionChange(isOnline) {
    if (offlineBanner) {
        offlineBanner.style.display = isOnline ? 'none' : 'flex';
    }
    if (isOnline) {
        console.log("Spojení obnoveno.");
        showToast("ONLINE // SPOJENÍ OBNOVENO", "success");
        hideGlobalError(); // Skrýt případné chyby způsobené offline stavem
        // Můžeme zkusit znovu načíst data, pokud předchozí pokus selhal kvůli offline
        if (!currentProfile) { // Pokud profil nebyl načten
             console.log("Pokus o opětovné načtení dat po obnovení spojení...");
             loadDashboardData();
        }
    } else {
        console.warn("Spojení ztraceno.");
        showToast("OFFLINE // SPOJENÍ ZTRACENO", "warning", 6000);
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
             throw new Error("Nepodařilo se načíst základní data uživatele. Načítání dashboardu přerušeno.");
         }

        // 2. Aktualizovat statistické karty (už by měly být aktualizované po handleDailyLoginReward, ale pro jistotu)
        updateStatCards();

        // 3. Načíst nedávné aktivity
        await loadRecentActivity();

        // 4. Načíst notifikace
        await loadNotifications();

        console.log("Všechna data pro dashboard načtena úspěšně.");

    } catch (error) {
        console.error("Celková chyba při načítání dat dashboardu:", error);
        // Zobrazit globální chybu, pokud již není zobrazena z podřízené funkce
        if (globalErrorContainer && globalErrorContainer.style.display !== 'block') {
             displayGlobalError(`Nepodařilo se načíst data nástěnky: ${error.message}`);
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
         if (!supabase && initialLoader) { // Pokud Supabase stále není inicializován po 5 sekundách
             console.error("Supabase se nepodařilo inicializovat v časovém limitu.");
             displayGlobalError("Kritická chyba: Systémové jádro (Supabase) není dostupné.");
             showInitialLoader(false);
         }
     }, 5000);
});