// Файл: procvicovani/plan-data-logic.js
// Описание: Содержит основную логику, управление состоянием,
// взаимодействие с Supabase и Gemini для страницы studijního plánu.
// Предоставляет функции через глобальный объект PlanApp.
// Должен быть загружен ПЕРЕД plan-ui-components.js и plan-main.js.
// Версия: 2.0 (Исправлено на основе plan.js и запроса пользователя)

(function() { // IIFE для изоляции области видимости
	'use strict';

	// --- Глобальное Пространство Имен ---
	window.PlanApp = window.PlanApp || {};
	const PlanApp = window.PlanApp; // Локальная ссылка

	// --- Конфигурация ---
	PlanApp.config = {
		supabaseUrl: 'https://qcimhjjwvsbgjsitmvuh.supabase.co',
		supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10',
		GEMINI_API_KEY: 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs', // !!! SECURITY: Move to backend !!!
		GEMINI_API_URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs`, // Key is inline here
		PLAN_GENERATION_COOLDOWN_DAYS: 7,
		NOTIFICATION_FETCH_LIMIT: 5,
        POINTS_ACTIVITY_COMPLETE: 5, // Example points
        POINTS_PLAN_COMPLETE: 50,    // Example points
        // Добавьте другие константы по мере необходимости
	};

	// --- Глобальное Состояние ---
	PlanApp.state = {
		supabaseClient: null,
		currentUser: null,
		currentProfile: null,
		latestDiagnosticData: null,
		currentStudyPlan: null,
		currentPlanActivities: [], // Added to store activities for the current plan
		previousPlans: [],
		planCreateAllowed: false,
		nextPlanCreateTime: null,
		planTimerInterval: null,
		currentTab: 'current',
		lastGeneratedMarkdown: null,
		lastGeneratedActivitiesJson: null,
		lastGeneratedTopicsData: null,
		isLoading: { current: false, history: false, create: false, detail: false, schedule: false, generation: false, notifications: false, saving: false },
		topicMap: {}, // Maybe populate from DB later if needed
        isDarkMode: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true, // Detect theme preference
	};

    // --- Визуалы для Активностей (могут использоваться для логики) ---
    // Определяем activityVisuals в PlanApp для доступа из других модулей
    PlanApp.activityVisuals = {
         test: { name: 'Test', icon: 'fa-vial', class: 'test' },
         exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' },
         practice: { name: 'Procvičování', icon: 'fa-dumbbell', class: 'practice' },
         example: { name: 'Příklad', icon: 'fa-lightbulb', class: 'example' },
         review: { name: 'Opakování', icon: 'fa-history', class: 'review' },
         theory: { name: 'Teorie', icon: 'fa-book-open', class: 'theory' },
         analysis: { name: 'Analýza', icon: 'fa-chart-pie', class: 'analysis' },
         badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' },
         diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' },
         lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' },
         plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' },
         level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' },
         other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' },
         default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' }
     };

	// --- Инициализация Supabase ---
	PlanApp.initializeSupabase = () => {
		const config = PlanApp.config; const state = PlanApp.state;
		try {
			if (!window.supabase) throw new Error("Supabase library not loaded.");
			if (state.supabaseClient) { console.log("[Core] Supabase client already initialized."); return true; }
			state.supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
			if (!state.supabaseClient) throw new Error("Client creation failed.");
			console.log("[Core] Supabase client initialized."); return true;
		} catch (error) {
            console.error("[Core] Supabase init failed:", error);
            // Use UI function if available, otherwise alert
            if (typeof PlanApp.showGlobalError === 'function') {
                 PlanApp.showGlobalError("Chyba připojení k databázi.");
            } else {
                 alert("Kritická chyba: Nelze se připojit k databázi.");
            }
            return false;
        }
	};

	// --- Взаимодействие с профилем ---
	PlanApp.fetchUserProfile = async (userId) => {
		const state = PlanApp.state;
        if (!userId || !state.supabaseClient) {
            console.warn("[Core FetchProfile] Missing userId or Supabase client.");
            return null; // Return null to indicate failure or missing data
        }
		console.log(`[Core] Fetching profile for user ID: ${userId}`);
		try {
			const { data, error } = await state.supabaseClient
				.from('profiles')
				.select('*') // Fetch all profile data
				.eq('id', userId)
				.single();

			if (error && error.code !== 'PGRST116') { // Ignore "0 rows" error
                console.error(`[Core] Supabase profile fetch error for user ${userId}:`, error);
				throw error;
            }
			if (!data) {
                console.warn(`[Core] Profile not found for user ${userId}.`);
                return null;
            }
			console.log("[Core] Profile data fetched successfully.");
			return data; // Return the fetched profile data
		} catch (e) {
			console.error(`[Core] Exception fetching profile for user ${userId}:`, e);
            if (typeof PlanApp.showToast === 'function') {
                 PlanApp.showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error');
            }
			return null; // Return null on exception
		}
	};

    // --- Функции Получения Данных Плана (Ядро) ---
    PlanApp.fetchPlanActivities = async (planId) => {
        const state = PlanApp.state;
        if (!planId || !state.supabaseClient) {
            console.warn("[Core FetchActivities] Missing planId or Supabase client.");
            return []; // Return empty array on failure
        }
        console.log(`[Core FetchActivities] Fetching activities for plan ${planId}`);
        try {
            const { data, error } = await state.supabaseClient
                .from('plan_activities')
                .select('*')
                .eq('plan_id', planId)
                .order('day_of_week')
                .order('time_slot');
            if (error) throw error;
            console.log(`[Core FetchActivities] Fetched ${data?.length ?? 0} activities for plan ${planId}.`);
            return data || []; // Return fetched data or empty array
        } catch (error) {
            console.error(`[Core FetchActivities] Error fetching activities for plan ${planId}:`, error);
             if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba', 'Nepodařilo se načíst aktivity plánu.', 'error');
            return []; // Return empty array on error
        }
    };

    PlanApp.fetchPlanDetails = async (planId) => {
         const state = PlanApp.state;
         if (!planId || !state.supabaseClient) {
             console.warn("[Core FetchDetails] Missing planId or Supabase client.");
             return null; // Return null on failure
         }
         console.log(`[Core FetchDetails] Fetching details for plan ${planId}`);
         try {
             const { data, error } = await state.supabaseClient
                 .from('study_plans')
                 .select('plan_content_markdown, title, created_at, estimated_completion_date') // Select necessary fields
                 .eq('id', planId)
                 .single();
             if (error) throw error;
             console.log(`[Core FetchDetails] Details fetched successfully for plan ${planId}.`);
             return data; // Return fetched data
         } catch (error) {
             console.error(`[Core FetchDetails] Error fetching details for plan ${planId}:`, error);
             if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba', 'Nepodařilo se načíst detail plánu.', 'error');
             return null; // Return null on error
         }
     };

	// --- Логика Загрузки Планов (Ядро) ---
	PlanApp.loadCurrentPlan = async () => {
		const state = PlanApp.state;
        // UI related actions (loaders, rendering) are now handled in plan-ui-components.js or plan-main.js
		if (!state.supabaseClient || !state.currentUser) {
			 console.warn("[Core LoadCurrent] Missing Supabase client or current user.");
			 return; // Should be handled by UI showing an error or prompt
		}
		console.log("[Core LoadCurrent] Loading current plan data...");
		try {
			const { data: plans, error } = await state.supabaseClient
				.from('study_plans')
				.select('*') // Fetch all plan details initially
				.eq('user_id', state.currentUser.id)
				.eq('status', 'active')
				.order('created_at', { ascending: false })
				.limit(1);
			if (error) throw error;

			if (plans && plans.length > 0) {
				state.currentStudyPlan = plans[0];
				console.log("[Core LoadCurrent] Active plan found:", state.currentStudyPlan.id);
                // Fetch activities associated with this plan
                state.currentPlanActivities = await PlanApp.fetchPlanActivities(state.currentStudyPlan.id);
                 console.log(`[Core LoadCurrent] Loaded ${state.currentPlanActivities.length} activities for current plan.`);
                 // The UI module will call showVerticalSchedule after this function resolves successfully
			} else {
				state.currentStudyPlan = null;
                state.currentPlanActivities = [];
				console.log("[Core LoadCurrent] No active plan found.");
                // Diagnostic check result will be handled by UI logic
                await PlanApp.getLatestDiagnostic(false); // Update diagnostic state without showing loader
			}
            return true; // Indicate success
		} catch (error) {
			console.error("[Core LoadCurrent] Error loading current plan:", error);
            state.currentStudyPlan = null; // Ensure state is cleared on error
            state.currentPlanActivities = [];
            // Error message will be shown by UI logic
            return false; // Indicate failure
		}
	};

	PlanApp.loadPlanHistory = async () => {
		const state = PlanApp.state;
		if (!state.supabaseClient || !state.currentUser) {
			 console.warn("[Core LoadHistory] Missing Supabase client or user.");
			 return; // UI should handle showing an error
		}
        console.log("[Core LoadHistory] Fetching plan history...");
		try {
			const { data: plans, error } = await state.supabaseClient
				.from('study_plans')
				.select('id, title, created_at, status, progress') // Fetch necessary fields for history list
				.eq('user_id', state.currentUser.id)
				.order('created_at', { ascending: false });
			if (error) throw error;
			state.previousPlans = plans || [];
			console.log(`[Core LoadHistory] Loaded ${state.previousPlans.length} previous plans.`);
            // UI will call renderPlanHistory after this resolves
		} catch (error) {
			console.error("[Core LoadHistory] Error loading plan history:", error);
            state.previousPlans = []; // Clear state on error
            // Error message handled by UI
		}
	};

	PlanApp.getLatestDiagnostic = async (showLoaderFlag = true) => {
		const state = PlanApp.state;
		if (!state.currentUser || !state.supabaseClient) {
            console.warn("[Core GetDiagnostic] Missing user or Supabase client.");
            return null;
        }
        // Loading state handled by UI
		try {
			console.log("[Core GetDiagnostic] Fetching latest diagnostic data...");
			const { data, error } = await state.supabaseClient
				.from('user_diagnostics')
				.select('id, completed_at, total_score, total_questions, topic_results, analysis') // Fetch fields needed for generation
				.eq('user_id', state.currentUser.id)
				.order('completed_at', { ascending: false })
				.limit(1);
			if (error) throw error;
			console.log("[Core GetDiagnostic] Fetched diagnostic data:", data ? data[0] : 'None');
			return (data && data.length > 0) ? data[0] : false; // Return data or false if none found
		} catch (error) {
			console.error("[Core GetDiagnostic] Error fetching diagnostic:", error);
			return null; // Return null on error
		}
	};

	PlanApp.checkPlanCreationAvailability = async () => {
		const state = PlanApp.state;
		const config = PlanApp.config;
        // Loading state and UI rendering handled by UI module
		if (!state.supabaseClient || !state.currentUser) {
             console.warn("[Core CreateCheck] Missing Supabase or user.");
             return 'error'; // Indicate error state
        }
		console.log("[Core CreateCheck] Starting availability check...");
		try {
			state.latestDiagnosticData = await PlanApp.getLatestDiagnostic(false); // Get diagnostic data first
			if (state.latestDiagnosticData === null) return 'error'; // Error fetching diagnostic
            if (state.latestDiagnosticData === false) return 'no_diagnostic'; // No diagnostic found

			// Check cooldown
			const { data: latestPlan, error: planError } = await state.supabaseClient
				.from('study_plans')
				.select('created_at')
				.eq('user_id', state.currentUser.id)
				.order('created_at', { ascending: false })
				.limit(1);
			if (planError) throw planError;

			let canCreate = true;
            state.nextPlanCreateTime = null; // Reset
			if (latestPlan && latestPlan.length > 0) {
				const lastPlanDate = new Date(latestPlan[0].created_at);
				const cooldownDate = new Date(lastPlanDate);
				cooldownDate.setDate(cooldownDate.getDate() + config.PLAN_GENERATION_COOLDOWN_DAYS);
				console.log("[Core CreateCheck] Cooldown date:", cooldownDate, "Current date:", new Date());
				if (new Date() < cooldownDate) {
					canCreate = false;
					state.nextPlanCreateTime = cooldownDate;
				}
			}
			state.planCreateAllowed = canCreate;
            console.log("[Core CreateCheck] Result:", canCreate ? 'allowed' : 'locked');
			return canCreate ? 'allowed' : 'locked'; // Return state for UI

		} catch (error) {
			console.error('[Core CreateCheck] Error:', error);
			return 'error'; // Indicate error state
		}
	};

    // --- Логика Активностей и Прогресса (Ядро) ---
	PlanApp.handleActivityCompletionToggle = async (activityId, isCompleted, planId) => {
		const state = PlanApp.state;
		const config = PlanApp.config;
		if (!state.supabaseClient) {
			 console.warn("[Core ActivityToggle] Supabase client not available.");
			 return false; // Indicate failure
		}
		console.log(`[Core ActivityToggle] Toggling activity ${activityId} to ${isCompleted} in plan ${planId}`);
		try {
			const { error } = await state.supabaseClient
				.from('plan_activities')
				.update({ completed: isCompleted, updated_at: new Date().toISOString() })
				.eq('id', activityId);
			if (error) throw error;

			console.log(`[Core ActivityToggle] Activity ${activityId} status updated successfully in DB.`);

			// Award points if completing
			if (isCompleted && typeof PlanApp.awardPoints === 'function') {
				await PlanApp.awardPoints(config.POINTS_ACTIVITY_COMPLETE);
			}

			// Update plan progress
			await PlanApp.updatePlanProgress(planId);

			// Check achievements
			 if (typeof PlanApp.checkAndAwardAchievements === 'function' && state.currentUser) {
				await PlanApp.checkAndAwardAchievements(state.currentUser.id);
			}
            return true; // Indicate success
		} catch (error) {
			console.error(`[Core ActivityToggle] Error updating activity ${activityId}:`, error);
			if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Nepodařilo se aktualizovat stav aktivity.', 'error');
			return false; // Indicate failure
		}
	};

	PlanApp.updatePlanProgress = async (planId) => {
		const state = PlanApp.state;
		const config = PlanApp.config;
		if (!planId || !state.supabaseClient) {
			 console.warn("[Core PlanProgress] Missing planId or Supabase client.");
			 return;
		}
		console.log(`[Core PlanProgress] Updating progress for plan ${planId}`);
		try {
			// Get counts concurrently
			const [totalResult, completedResult] = await Promise.all([
				state.supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId),
				state.supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId).eq('completed', true)
			]);

			if (totalResult.error || completedResult.error) throw totalResult.error || completedResult.error;

			const numTotal = totalResult.count ?? 0;
			const numCompleted = completedResult.count ?? 0;
			const progress = numTotal > 0 ? Math.round((numCompleted / numTotal) * 100) : (numTotal === 0 ? 100 : 0); // Handle case with 0 activities
			console.log(`[Core PlanProgress] Plan ${planId}: ${numCompleted}/${numTotal} completed (${progress}%)`);

			const updates = { progress: progress, updated_at: new Date().toISOString() };
			let planCompleted = false;

			// Check if all activities are completed (and there are activities)
			if (numTotal > 0 && numCompleted === numTotal) {
				updates.status = 'completed';
				updates.completed_at = new Date().toISOString();
				planCompleted = true;
				console.log(`[Core PlanProgress] Plan ${planId} marked as completed.`);
			}

			// Update the plan in the database
			const { error: updateError } = await state.supabaseClient
				.from('study_plans')
				.update(updates)
				.eq('id', planId);

			if (updateError) throw updateError;
			console.log(`[Core PlanProgress] Plan ${planId} progress/status DB updated to ${progress}%` + (planCompleted ? ', status: completed' : ''));

			// Update local state if it's the current plan
			if (state.currentStudyPlan?.id === planId) {
				state.currentStudyPlan.progress = progress;
				if (planCompleted) {
					 state.currentStudyPlan.status = 'completed';
					 state.currentStudyPlan.completed_at = updates.completed_at;
				}
			}

			// Award points for completing the entire plan
			if (planCompleted && typeof PlanApp.awardPoints === 'function') {
				await PlanApp.awardPoints(config.POINTS_PLAN_COMPLETE);
			}

		} catch (error) {
			console.error(`[Core PlanProgress] Error updating plan progress for ${planId}:`, error);
		}
	};


	// --- Генерация Плана (Gemini) ---
	PlanApp.generatePlanContentWithGemini = async (testData, topicsData, learningGoal = 'exam_prep') => {
        const config = PlanApp.config; const state = PlanApp.state;
        console.log(`[Core GeminiGenerate] Starting plan generation for goal: ${learningGoal}...`);
		if (!testData || !testData.id) throw new Error('Chybí data diagnostického testu.');
		if (!Array.isArray(topicsData)) throw new Error('Chybí data o výsledcích témat.');
		if (!config.GEMINI_API_KEY || !config.GEMINI_API_KEY.startsWith('AIzaSy')) throw new Error('Chybí platný Gemini API klíč.');

		const totalScore = testData.total_score ?? '-'; const totalQuestions = testData.total_questions ?? '-'; const analysis = testData.analysis || {};
		const overallAssessment = analysis.summary?.overall_assessment || 'N/A'; const strengths = analysis.strengths?.map(s => `${s.topic} (${s.score}%)`).join(', ') || 'Nebyly identifikovány'; const weaknesses = analysis.weaknesses?.map(w => `${w.topic} (${w.score}%)`).join(', ') || 'Nebyly identifikovány'; const recommendations = analysis.recommendations?.join('\n- ') || 'Žádná specifická.';
		let prompt;

		// Select prompt based on learning goal
		if (learningGoal === 'math_review') {
            const reviewTopicsList = "- Lineární rovnice\n- Procenta\n- Základy geometrie (obvody, obsahy základních tvarů)\n- Zlomky (sčítání, odčítání, násobení, dělení)\n- Algebraické výrazy (rozšiřování, zjednodušování)\n- Jednoduché slovní úlohy";
			prompt = `
Jsi AI asistent pro plánování studia matematiky. Tvým úkolem je vytvořit JEDNODUCHÝ týdenní (Po-Pá) opakovací plán pro studenta, který si potřebuje zopakovat ZÁKLADY matematiky na úrovni přibližně do 8./9. třídy ZŠ. Nejedná se o přípravu na přijímačky, ale o doplnění mezer.

# Studentův cíl: 'math_review' (Doplnění mezer v základech)

# Témata k zopakování:
${reviewTopicsList}

# TVŮJ ÚKOL:
1.  **Struktura:** Vytvoř plán na 5 dní (Pondělí - Pátek). Každý den se zaměř na JEDNO téma z výše uvedeného seznamu.
2.  **Denní Rozvrh:** Pro každý den navrhni 1-2 jednoduché aktivity (celkem max 45-60 minut denně):
    * **Rychlé zopakování:** Krátké připomenutí klíčových pravidel nebo vzorců daného tématu.
    * **Procvičení:** Zadání MALÉHO počtu (3-5) ZÁKLADNÍCH příkladů na dané téma k samostatnému vyřešení.
3.  **Jazyk a Tón:** Použij jednoduchý, povzbudivý jazyk. Plán nemá být náročný.
4.  **Formát Markdown:** Popiš plán v Markdown. Použij nadpisy pro dny a odrážky pro aktivity.
5.  **JSON Aktivity (DŮLEŽITÉ):** Na konci, v bloku \`\`\`json ... \`\`\`, vygeneruj pole JSON objektů. Každý objekt reprezentuje JEDEN denní úkol. Každý objekt MUSÍ obsahovat:
    * \`"day_of_week"\`: Číslo dne (1=Po, ..., 5=Pá).
    * \`"title"\`: Stručný název (např. "Opakování: Zlomky", "Procvičení: Rovnice").
    * \`"description"\`: Krátký popis úkolu (např. "Zopakuj si pravidla sčítání zlomků.", "Vyřeš 4 jednoduché lineární rovnice.").
    * \`"time_slot"\`: Odhadovaný čas (např., "20 min", "30 min").
    * \`"type"\`: Typ aktivity (použij 'review' pro opakování, 'practice' pro příklady).
6.  **Rada:** Přidej krátkou motivační radu na konci Markdown.

# Požadovaný formát výstupu (Markdown + JSON na konci):
**Týdenní opakovací plán:**
Cílem je osvěžit základy.

### Pondělí: Lineární rovnice
* **Opakování (15 min):** Připomeň si, co je lineární rovnice a jak se řeší (ekvivalentní úpravy).
* **Procvičení (30 min):** Vyřeš 4 jednoduché lineární rovnice s jednou neznámou.

### Úterý: Procenta
* ... (další dny) ...

---
**Rada:** Pravidelné krátké opakování je klíčové!
---
\`\`\`json
[
  { "day_of_week": 1, "type": "review", "title": "Opakování: Lineární rovnice", "description": "Připomeň si základní pravidla řešení lineárních rovnic.", "time_slot": "15 min" },
  { "day_of_week": 1, "type": "practice", "title": "Procvičení: Lineární rovnice", "description": "Vyřeš 4 jednoduché lineární rovnice s jednou neznámou.", "time_slot": "30 min" },
  { "day_of_week": 2, "type": "review", "title": "Opakování: Procenta", "description": "Zopakuj si výpočet procentové části, základu a počtu procent.", "time_slot": "20 min" },
  { "day_of_week": 2, "type": "practice", "title": "Procvičení: Procenta", "description": "Vyřeš 3 základní úlohy na procenta.", "time_slot": "25 min" }
  // ... (objekty pro St, Čt, Pá) ...
]
\`\`\`
`;
		} else { // Default to 'exam_prep' or any other goal needing a detailed plan
            prompt = `
Jsi expertní AI tutor specializující se na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v Česku. Tvým úkolem je vytvořit EXTRÉMNĚ DETAILNÍ, ZAMĚŘENÝ a STRUKTUROVANÝ týdenní studijní plán (Pondělí - Sobota, Neděle volno) v ČEŠTINĚ ve formátu Markdown. Cílem je hluboké porozumění a procvičení **JEDNOHO NEBO DVOU NEJSLABŠÍCH TÉMAT** týdně, nikoli povrchní pokrytí mnoha oblastí. Důraz klad na PRAKTICKÉ PŘÍKLADY a OPAKOVÁNÍ. Na konci MUSÍŠ vygenerovat JSON pole aktivit pro tento plán.

# Kontext: Student právě dokončil diagnostický test.
# Výsledky diagnostického testu:
- Celkové skóre: ${totalScore}/${totalQuestions} bodů
- Výsledky podle témat (Název tématu: Úspěšnost %):
${topicsData.map(topic => `  - ${topic.name}: ${topic.percentage}%`).join('\n')}

# Analýza výsledků testu (Shrnutí od AI):
- Celkové hodnocení: ${overallAssessment}
- Identifikované silné stránky: ${strengths}
- Identifikované slabé stránky: ${weaknesses}
- Doporučení na základě testu:
- ${recommendations}

# TVŮJ ÚKOL (Vytvoř VELMI PODROBNÝ a ZAMĚŘENÝ plán):
1.  **Výběr Téma/Témat:** Identifikuj **JEDNO, maximálně DVĚ nejslabší témata** studenta z poskytnutých výsledků (${weaknesses}). Celý týden se bude soustředit POUZE na tato vybraná témata.
2.  **Struktura Týdne (Po-So):** Vytvoř DETAILNÍ denní plán pro Pondělí až Sobotu. Neděle je volná.
3.  **Denní Rozvrh:** Rozděl studium každého dne (cca 60-90 minut) do 2-3 bloků s KONKRÉTNÍMI úkoly. Zaměř se na střídání:
	* **Teorie/Vysvětlení:** Krátké zopakování nebo vysvětlení **konkrétního pod-tématu**.
	* **Řešené Příklady:** Projití a analýza **několika (2-3)** řešených příkladů na dané pod-téma.
	* **Samostatné Procvičování:** Zadání **SPECIFICKÉHO počtu příkladů** k vyřešení. Buď KONKRÉTNÍ v zadání typu a počtu úkolů.
	* **Opakování:** Krátké opakování předchozího dne.
4.  **Sobota - Opakovací Test:** Naplánuj **pouze JEDNU aktivitu**: "Opakovací test" zaměřený na témata probíraná během týdne.
5.  **DETAILNÍ Popis v Markdown:** Jasně popiš **CO** se má student učit a **JAKÉ KONKRÉTNÍ** úkoly má dělat. POUŽIJ PŘIROZENÝ JAZYK a formátování.
6.  **JSON Aktivity (KRITICKÉ!):** Na konci, v bloku \`\`\`json ... \`\`\`, vygeneruj pole JSON objektů. KAŽDÝ objekt reprezentuje JEDEN studijní blok. Objekt MUSÍ obsahovat: \`"day_of_week"\` (1-6), \`"title"\` (SPECIFICKÝ název), \`"description"\` (SPECIFICKÝ popis úkolu), \`"time_slot"\` (odhad), \`"type"\` (theory/practice/example/test/review).
7.  **KONZISTENCE JSON a Markdown:** Obsah JSON musí PŘESNĚ odpovídat aktivitě v Markdown.
8.  **Rada pro Plán:** Na konci Markdown přidej krátkou radu.

# Požadovaný formát výstupu (Markdown + JSON na konci):
**Analýza diagnostiky:**
* Zaměření tento týden na: [Vybrané 1-2 nejslabší téma/témata]
---
### Pondělí
* **Fokus dne:** [Pod-téma 1]
* **Blok 1 (cca 40 min): Teorie - [Název pod-tématu]:** Zopakujte si [konkrétní koncept].
* **Blok 2 (cca 45 min): Procvičování - [Název pod-tématu]:** Samostatně vyřešte [X] příkladů typu [typ příkladu].
### Úterý
* **Fokus dne:** [Pod-téma 2]
* **Blok 1 (cca 30 min): Řešené příklady - [Název pod-tématu]:** Projděte si a analyzujte 3 řešené příklady na [konkrétní koncept]. Všímejte si postupu.
* **Blok 2 (cca 50 min): Procvičování - [Název pod-tématu]:** Vyřešte 6 úloh [specifický typ úloh] z pracovního sešitu, strany Y-Z.
* **Blok 3 (cca 10 min): Rychlé opakování - Pondělí:** Projděte si poznámky z pondělí.
* ... (Detailní plán pro St, Čt, Pá) ...
### Sobota
* **Fokus dne:** Týdenní opakování
* **Blok 1 (cca 60 min): Opakovací test:** Otestujte si znalosti z témat: [Téma 1], [Téma 2].
---
**Rada pro práci s plánem:** Důslednost je klíčová. Pokud něčemu nerozumíte, vraťte se k teorii nebo řešeným příkladům.
---
\`\`\`json
[
  { "day_of_week": 1, "type": "theory", "title": "Teorie - [Název pod-tématu z Po]", "description": "Student si má zopakovat [konkrétní koncept].", "time_slot": "40 min" },
  { "day_of_week": 1, "type": "practice", "title": "Procvičování - [Název pod-tématu z Po]", "description": "Student má samostatně vyřešit [X] příkladů typu [typ příkladu].", "time_slot": "45 min" },
  { "day_of_week": 2, "type": "example", "title": "Řešené příklady - [Název pod-tématu z Út]", "description": "Student si má projít a analyzovat 3 řešené příklady na [konkrétní koncept].", "time_slot": "30 min" },
  { "day_of_week": 2, "type": "practice", "title": "Procvičování - [Název pod-tématu z Út]", "description": "Student má vyřešit 6 úloh [specifický typ úloh] z pracovního sešitu, strany Y-Z.", "time_slot": "50 min" },
  { "day_of_week": 2, "type": "review", "title": "Rychlé opakování - Pondělí", "description": "Student si má projít poznámky z pondělí k tématu [Pod-téma 1].", "time_slot": "10 min" },
  // ... (JSON objekty pro St, Čt, Pá PŘESNĚ podle Markdown) ...
  { "day_of_week": 6, "type": "test", "title": "Opakovací test týdne", "description": "Otestujte si znalosti získané během týdne z témat: [Téma 1], [Téma 2].", "time_slot": "60 min" }
]
\`\`\`
`;
		}

		try {
			console.log("[Core GeminiGenerate] Sending request to Gemini API...");
			const response = await fetch(config.GEMINI_API_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: { temperature: 0.5, topK: 30, topP: 0.9, maxOutputTokens: 8192 },
					safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ]
				})
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error?.message || `Chyba Gemini API (${response.status})`);
			const geminiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
			if (!geminiResponse) {
				if (data.promptFeedback?.blockReason) throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}.`);
				const finishReason = data.candidates?.[0]?.finishReason;
				if(finishReason && finishReason !== 'STOP') throw new Error(`AI dokončilo s důvodem: ${finishReason}.`);
				throw new Error('Prázdná odpověď od Gemini.');
			}
			console.log("[Core GeminiGenerate] Gemini response received length:", geminiResponse.length);
			return geminiResponse; // Return the full response (Markdown + JSON)
		} catch (error) {
			console.error('[Core GeminiGenerate] Error generating plan content:', error);
			throw error; // Rethrow to be caught by the calling function (likely PlanApp.generateStudyPlan)
		}
	};

	PlanApp.generateStudyPlan = async () => {
        const state = PlanApp.state;
        const ui = PlanApp.ui; // Access UI cache if needed for error rendering

        if (!state.latestDiagnosticData || !state.currentUser || !state.currentProfile) {
             if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chybí data pro generování.', 'error');
             return; // Exit early
        }
        const learningGoal = state.currentProfile.learning_goal || 'exam_prep'; // Get goal

        // --- UI Management (should be handled by UI module ideally) ---
        ui?.currentPlanSection?.classList.remove('visible-section');
        ui?.historyPlanSection?.classList.remove('visible-section');
        ui?.createPlanSection?.classList.remove('visible-section');
        ui?.planSection?.classList.add('visible-section');
        if(typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('generation', true);
        if (ui?.planContent) { ui.planContent.innerHTML = ''; ui.planContent.classList.remove('content-visible', 'generated-reveal'); }
        if (ui?.planActions) ui.planActions.style.display = 'none';
        if (ui?.planSectionTitle) ui.planSectionTitle.textContent = 'Generování plánu...';
        if (ui?.genericBackBtn && typeof PlanApp.switchTab === 'function') ui.genericBackBtn.onclick = () => PlanApp.switchTab('create');
        // --- End UI Management ---

        try {
            const topicsData = Object.entries(state.latestDiagnosticData.topic_results || {})
                .map(([_, data]) => ({
                    name: data.name || `Neznámé Téma`,
                    percentage: data.score_percent || 0 // Use score_percent as it's calculated
                }))
                .sort((a, b) => a.percentage - b.percentage); // Sort by lowest percentage first

            state.lastGeneratedTopicsData = topicsData; // Store for potential saving

            // Handle "in development" goals directly
            if (learningGoal === 'math_explore' || learningGoal === 'math_accelerate') {
                console.log(`[Core GeneratePlan] Goal '${learningGoal}' is in development.`);
                 if (ui && ui.planContent && typeof PlanApp.renderMessage === 'function') {
                     PlanApp.renderMessage(ui.planContent, 'info', 'V přípravě', 'Tato funkce studijního plánu je momentálně ve vývoji.');
                     ui.planContent.classList.add('content-visible'); // Make sure message is shown
                 }
                if (ui && ui.planSectionTitle) ui.planSectionTitle.textContent = 'Funkce ve vývoji';
                 if (typeof PlanApp.renderPreviewActions === 'function') PlanApp.renderPreviewActions(false, true); // Show specific state (no actions)
                 if (ui && ui.planSection) ui.planSection.scrollIntoView({ behavior: 'smooth' });
                 if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('generation', false); // Stop loader
                return; // Stop execution
            }

            // Proceed for exam_prep or math_review
            const fullMarkdownResponse = await PlanApp.generatePlanContentWithGemini(
                state.latestDiagnosticData,
                topicsData,
                learningGoal // Pass the goal to the generation function
            );

            // Parse response (Markdown and JSON)
            const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
            const jsonMatch = fullMarkdownResponse.match(jsonRegex);
            let activitiesArray = null;
            let planMarkdownForStorage = fullMarkdownResponse;

            if (jsonMatch && jsonMatch[1]) {
                try {
                    activitiesArray = JSON.parse(jsonMatch[1].replace(/\u00A0/g, ' ').trim()); // Parse JSON activities
                    planMarkdownForStorage = fullMarkdownResponse.replace(jsonRegex, '').trim(); // Separate Markdown
                    state.lastGeneratedActivitiesJson = activitiesArray; // Store parsed activities
                } catch (e) {
                    console.error("Error parsing JSON activities:", e);
                    if(typeof PlanApp.showToast === 'function') PlanApp.showToast("Warning: Nepodařilo se zpracovat aktivity.", "warning");
                    state.lastGeneratedActivitiesJson = null;
                }
            } else {
                console.warn("JSON block of activities not found in Gemini response.");
                state.lastGeneratedActivitiesJson = null;
            }

            state.lastGeneratedMarkdown = planMarkdownForStorage; // Store Markdown

            // --- Update UI (Should ideally be handled by UI module) ---
            if(ui?.planSectionTitle) ui.planSectionTitle.textContent = 'Návrh studijního plánu';
            if(typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('generation', false); // Stop loader

            if(ui?.planContent && typeof PlanApp.displayPlanContent === 'function') {
                PlanApp.displayPlanContent(state.lastGeneratedMarkdown); // Render the markdown
                requestAnimationFrame(() => {
                     if (ui.planContent) ui.planContent.classList.add('content-visible', 'generated-reveal');
                });
            } else { console.error("Cannot display plan content: UI elements or function missing."); }

            if(typeof PlanApp.renderPreviewActions === 'function') {
                 PlanApp.renderPreviewActions(false, false); // Show standard preview actions
            } else { console.error("Cannot render preview actions: Function missing."); }

            if (ui?.planSection) ui.planSection.scrollIntoView({ behavior: 'smooth' });
            if (typeof PlanApp.initTooltips === 'function') PlanApp.initTooltips();
            // --- End Update UI ---

        } catch (error) {
            console.error('[Core GeneratePlan] Plan generation failed:', error);
            if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('generation', false);
            // --- Update UI on Error ---
            if (ui?.planContent && typeof PlanApp.renderMessage === 'function') {
                 PlanApp.renderMessage(ui.planContent, 'error', 'Chyba generování', error.message);
                 ui.planContent.classList.add('content-visible');
             }
            if (typeof PlanApp.renderPreviewActions === 'function') PlanApp.renderPreviewActions(true); // Show only regenerate button
            // --- End Update UI on Error ---
        }
    };

	// --- Сохранение Плана (Ядро) ---
	PlanApp.handleSaveGeneratedPlanClick = async () => {
		const state = PlanApp.state;
        // UI button state handled externally
		const markdownContent = state.lastGeneratedMarkdown;
		const activitiesArray = state.lastGeneratedActivitiesJson;
		const topicsData = state.lastGeneratedTopicsData;

		if (!state.currentUser || !state.latestDiagnosticData || !markdownContent || !state.supabaseClient) {
			 if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba: Chybí data pro uložení.', 'error');
			 // UI should re-enable button here
			 return;
		}
         if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('saving', true);

		const priorityTopics = {};
		if (topicsData?.length) { topicsData.forEach((t, i) => priorityTopics[t.name] = { priority: i + 1, performance: t.percentage, focus_level: t.percentage < 50 ? 'high' : t.percentage < 75 ? 'medium' : 'low' }); } else { console.warn("[Core SavePlan] Missing topicsData in state during save."); }

		let savedPlanId = null;
		try {
			console.log("[Core SavePlan] Deactivating old plans...");
			const { error: deactivateError } = await state.supabaseClient.from('study_plans').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('user_id', state.currentUser.id).eq('status', 'active');
			if (deactivateError) throw deactivateError;

			const today = new Date(); const completionDate = new Date(today); completionDate.setDate(completionDate.getDate() + 7);
			const newPlanData = { user_id: state.currentUser.id, title: `Studijní plán (${PlanApp.formatDate(today)})`, subject: "Matematika", status: "active", diagnostic_id: state.latestDiagnosticData.id, plan_content_markdown: markdownContent, priority_topics: priorityTopics, estimated_completion_date: completionDate.toISOString().split('T')[0], progress: 0, is_auto_adjusted: true };
			console.log("[Core SavePlan] Inserting new plan data...");
			const { data: savedPlan, error: insertPlanError } = await state.supabaseClient.from('study_plans').insert(newPlanData).select('id').single();
			if (insertPlanError) throw insertPlanError;
			savedPlanId = savedPlan.id; console.log("[Core SavePlan] Plan saved, ID:", savedPlanId);

			if (activitiesArray?.length) {
				console.log(`[Core SavePlan] Inserting ${activitiesArray.length} activities...`);
				const activitiesToInsert = activitiesArray.map(act => { if (typeof act !== 'object' || act === null) return null; const dayOfWeek = typeof act.day_of_week === 'number' ? act.day_of_week : parseInt(act.day_of_week, 10); if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null; return { plan_id: savedPlanId, day_of_week: dayOfWeek, time_slot: act.time_slot || null, title: act.title || 'N/A', description: act.description || null, type: act.type || PlanApp.getActivityTypeFromTitle(act.title), completed: false }; }).filter(Boolean);
				if (activitiesToInsert.length > 0) { const { error: insertActivitiesError } = await state.supabaseClient.from('plan_activities').insert(activitiesToInsert); if (insertActivitiesError) { console.error("[Core SavePlan] Error inserting activities:", insertActivitiesError); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán uložen, ale aktivity selhaly.', 'warning'); } else { console.log("[Core SavePlan] Activities inserted."); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán a aktivity uloženy!', 'success'); } } else { if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán uložen, ale nenalezeny platné aktivity.', 'warning'); }
			} else { if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán uložen (bez aktivit).', 'info'); }

			 state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; state.lastGeneratedTopicsData = null; // Clear state
			state.currentStudyPlan = { ...newPlanData, id: savedPlanId }; // Update current plan state
			if (typeof PlanApp.switchTab === 'function') PlanApp.switchTab('current'); // Switch view after successful save

		} catch (error) {
			console.error("[Core SavePlan] Error saving plan:", error);
			if (typeof PlanApp.showToast === 'function') PlanApp.showToast(`Uložení selhalo: ${error.message}`, 'error');
			// UI should re-enable button here
             const saveButton = document.getElementById('saveGeneratedPlanBtn');
             if(saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Uložit tento plán'; }
		} finally {
			if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('saving', false);
		}
	};

	// --- Логика таймера кулдауна (Ядро) ---
	PlanApp.startPlanTimer = () => {
        const state = PlanApp.state; if (state.planTimerInterval) clearInterval(state.planTimerInterval);
        console.log("[Core Timer] Starting interval timer...");
        state.planTimerInterval = setInterval(() => {
            const timerEl = document.getElementById('nextPlanTimer'); // Needs to find element in DOM
            if (timerEl && document.body.contains(timerEl)) {
                if (typeof PlanApp.updateNextPlanTimer === 'function') PlanApp.updateNextPlanTimer(timerEl);
                else { console.error("[Core Timer] updateNextPlanTimer func missing!"); clearInterval(state.planTimerInterval); }
            } else { console.log("[Core Timer] Timer element gone, stopping."); clearInterval(state.planTimerInterval); }
        }, 1000);
    };

	PlanApp.updateNextPlanTimer = (el) => {
        const state = PlanApp.state;
        if (!state.nextPlanCreateTime || !el) { if (el) el.textContent = 'Chyba času'; return; }
        const now = new Date(); const diff = state.nextPlanCreateTime - now;
        if (diff <= 0) { el.textContent = 'Nyní'; clearInterval(state.planTimerInterval); state.planCreateAllowed = true; console.log("[Core Timer] Cooldown finished."); if(state.currentTab === 'create' && typeof PlanApp.checkPlanCreationAvailability === 'function') setTimeout(PlanApp.checkPlanCreationAvailability, 500); return; }
        const d = Math.floor(diff/(1000*60*60*24)), h = Math.floor((diff%(1000*60*60*24))/(1000*60*60)), m = Math.floor((diff%(1000*60*60))/(1000*60)), s = Math.floor((diff%(1000*60))/1000);
        el.textContent = `${d}d ${h}h ${m}m ${s}s`;
    };

	// --- Логика уведомлений (Ядро) ---
	PlanApp.fetchNotifications = async (userId, limit) => {
		const state = PlanApp.state; const config = PlanApp.config;
        const fetchLimit = limit || config.NOTIFICATION_FETCH_LIMIT || 5;
		if (!state.supabaseClient || !userId) { console.warn("[Core Notifications] Missing Supabase or User ID."); return { unreadCount: 0, notifications: [] }; }
		console.log(`[Core Notifications] Fetching unread for user ${userId}, Limit: ${fetchLimit}`);
		try {
			const { data, error, count } = await state.supabaseClient.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(fetchLimit);
			if (error) throw error;
			console.log(`[Core Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`);
			return { unreadCount: count ?? 0, notifications: data || [] };
		} catch (error) { console.error("[Core Notifications] Exception fetching notifications:", error); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; }
	};

	PlanApp.markNotificationRead = async (notificationId) => {
		const state = PlanApp.state; console.log("[Core Notifications] Marking read:", notificationId); if (!state.currentUser || !notificationId || !state.supabaseClient) return false;
		try { const { error } = await state.supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[Core Notifications] Mark read success:", notificationId); return true;
		} catch (error) { console.error("[Core Notifications] Mark read error:", error); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba', 'Nepodařilo se označit oznámení.', 'error'); return false; }
	};

	PlanApp.markAllNotificationsRead = async () => {
		const state = PlanApp.state; console.log("[Core Notifications] Marking all read:", state.currentUser?.id); if (!state.currentUser || !state.supabaseClient) return;
		// UI handles button disabling/enabling and loading state
		try {
			const { error } = await state.supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('is_read', false);
			if (error) throw error;
			console.log("[Core Notifications] Mark all read success.");
			if (typeof PlanApp.showToast === 'function') PlanApp.showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení přečtena.', 'success');
            // Return success to allow UI to re-fetch and re-render
            return true;
		} catch (error) {
            console.error("[Core Notifications] Mark all read error:", error);
            if (typeof PlanApp.showToast === 'function') PlanApp.showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error');
            return false; // Indicate failure
        }
	};

    // --- (Заглушки) Логика баллов и достижений ---
	PlanApp.awardPoints = async (pointsValue) => { console.warn(`[Core Placeholder] awardPoints called: ${pointsValue}`); return Promise.resolve(); };
	PlanApp.checkAndAwardAchievements = async (userId) => { console.warn(`[Core Placeholder] checkAchievements called: ${userId}`); return Promise.resolve(); };

	console.log("plan-data-logic.js loaded and PlanApp core logic attached.");

})(); // Конец IIFE