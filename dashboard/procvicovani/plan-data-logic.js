// Файл: procvicovani/plan-data-logic.js
// Описание: Содержит основную логику, управление состоянием,
// взаимодействие с Supabase и Gemini для страницы studijního plánu.
// Предоставляет функции через глобальный объект PlanApp.
// Должен быть загружен ПЕРЕД plan-ui-components.js и plan-main.js.
// Версия: 1.0 (создана при разделении plan.js)

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
		GEMINI_API_URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs`,
		PLAN_GENERATION_COOLDOWN_DAYS: 7,
		NOTIFICATION_FETCH_LIMIT: 5,
		POINTS_ACTIVITY_COMPLETE: 5,
		POINTS_PLAN_COMPLETE: 50,
	};

	// --- Глобальное Состояние ---
	PlanApp.state = {
		supabaseClient: null,
		currentUser: null,
		currentProfile: null,
		latestDiagnosticData: null,
		currentStudyPlan: null,
		currentPlanActivities: [],
		previousPlans: [],
		planCreateAllowed: false,
		nextPlanCreateTime: null,
		planTimerInterval: null,
		currentTab: 'current',
		lastGeneratedMarkdown: null,
		lastGeneratedActivitiesJson: null,
		lastGeneratedTopicsData: null,
		isLoading: { current: false, history: false, create: false, detail: false, schedule: false, generation: false, notifications: false, saving: false },
		topicMap: {}, // Populate if needed
        isDarkMode: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches, // Initialize theme state
	};

	// --- Инициализация Supabase ---
	PlanApp.initializeSupabase = () => {
		const config = PlanApp.config;
		const state = PlanApp.state;
		try {
			if (!window.supabase) throw new Error("Supabase library not loaded.");
			if (state.supabaseClient) return true; // Already initialized
			state.supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
			if (!state.supabaseClient) throw new Error("Client creation failed.");
			console.log("[Core] Supabase client initialized.");
			return true;
		} catch (error) {
			console.error("[Core] Supabase init failed:", error);
			if (typeof PlanApp.showGlobalError === 'function') PlanApp.showGlobalError("Chyba připojení k databázi."); else alert("Kritická chyba: Nelze se připojit k databázi.");
			return false;
		}
	};

	// --- Взаимодействие с профилем ---
	PlanApp.fetchUserProfile = async (userId) => {
		const state = PlanApp.state;
		if (!userId || !state.supabaseClient) { console.warn("[Core FetchProfile] Missing userId or Supabase client."); return null; }
		console.log(`[Core] Fetching profile for user ID: ${userId}`);
		try {
			const { data, error } = await state.supabaseClient.from('profiles').select('*').eq('id', userId).single();
			if (error && error.code !== 'PGRST116') throw error;
			if (!data) { console.warn(`[Core] Profile not found for user ${userId}.`); return null; }
			console.log("[Core] Profile data fetched successfully.");
			return data;
		} catch (e) { console.error(`[Core] Exception fetching profile for user ${userId}:`, e); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error'); return null; }
	};

    // --- Основные функции получения данных плана ---
    PlanApp.fetchPlanActivities = async (planId) => {
        const state = PlanApp.state;
        if (!planId || !state.supabaseClient) {
             console.warn("[Core FetchActivities] Missing planId or Supabase client.");
             return [];
        }
        try {
            const { data, error } = await state.supabaseClient
                .from('plan_activities')
                .select('*')
                .eq('plan_id', planId)
                .order('day_of_week')
                .order('time_slot');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error(`[Core FetchActivities] Error fetching activities for plan ${planId}:`, error);
            return []; // Return empty array on error
        }
    };

    PlanApp.fetchPlanDetails = async (planId) => {
         const state = PlanApp.state;
         if (!planId || !state.supabaseClient) {
             console.warn("[Core FetchDetails] Missing planId or Supabase client.");
             return null;
         }
         try {
             const { data, error } = await state.supabaseClient
                 .from('study_plans')
                 .select('plan_content_markdown, title, created_at, estimated_completion_date')
                 .eq('id', planId)
                 .single();
             if (error) throw error;
             return data;
         } catch (error) {
             console.error(`[Core FetchDetails] Error fetching details for plan ${planId}:`, error);
             return null;
         }
     };

	// --- Логика загрузки планов ---
	PlanApp.loadCurrentPlan = async () => {
		const state = PlanApp.state;
		if (!state.supabaseClient || !state.currentUser) { console.warn("[Core LoadCurrent] Missing Supabase or user."); return; }
		console.log("[Core LoadCurrent] Loading current plan data...");
		if (typeof PlanApp.setLoadingState === 'function') { PlanApp.setLoadingState('current', true); PlanApp.setLoadingState('schedule', true); }
		try {
			const { data: plans, error } = await state.supabaseClient.from('study_plans').select('*').eq('user_id', state.currentUser.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1);
			if (error) throw error;
			if (plans && plans.length > 0) {
				state.currentStudyPlan = plans[0];
				console.log("[Core LoadCurrent] Active plan found:", state.currentStudyPlan.id);
                // Загрузка активностей для найденного плана
                state.currentPlanActivities = await PlanApp.fetchPlanActivities(state.currentStudyPlan.id);
                console.log(`[Core LoadCurrent] Loaded ${state.currentPlanActivities.length} activities for plan ${state.currentStudyPlan.id}.`);
				// UI рендеринг вызывается из plan-ui.js
				if (typeof PlanApp.showVerticalSchedule === 'function') PlanApp.showVerticalSchedule(state.currentStudyPlan); else console.error("UI function showVerticalSchedule missing!");
			} else {
				state.currentStudyPlan = null; state.currentPlanActivities = [];
				console.log("[Core LoadCurrent] No active plan found. Checking diagnostic...");
				if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('schedule', false);
				const diagnostic = await PlanApp.getLatestDiagnostic(false);
                // Вызов UI функций для рендеринга сообщений
				if (typeof PlanApp.renderMessage === 'function' && PlanApp.ui?.currentPlanContent) {
					if (diagnostic === null) PlanApp.renderMessage(PlanApp.ui.currentPlanContent, 'error', 'Chyba', 'Nepodařilo se ověřit test.');
					else if (diagnostic) { if (typeof PlanApp.renderPromptCreatePlan === 'function') PlanApp.renderPromptCreatePlan(PlanApp.ui.currentPlanContent); else console.error("UI function renderPromptCreatePlan missing!"); }
					else { if (typeof PlanApp.renderNoActivePlan === 'function') PlanApp.renderNoActivePlan(PlanApp.ui.currentPlanContent); else console.error("UI function renderNoActivePlan missing!"); }
				} else { console.error("[Core LoadCurrent] Cannot render messages: UI function or container missing."); }
			}
		} catch (error) { console.error("[Core LoadCurrent] Error:", error); if (typeof PlanApp.renderMessage === 'function' && PlanApp.ui?.currentPlanContent) PlanApp.renderMessage(PlanApp.ui.currentPlanContent, 'error', 'Chyba', 'Nepodařilo se načíst plán.'); if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('schedule', false); }
        finally { if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('current', false); }
	};

	PlanApp.loadPlanHistory = async () => {
		const state = PlanApp.state;
		if (!state.supabaseClient || !state.currentUser) { console.warn("[Core LoadHistory] Missing Supabase or user."); return; }
		if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('history', true);
		try {
			const { data: plans, error } = await state.supabaseClient.from('study_plans').select('id, title, created_at, status, progress').eq('user_id', state.currentUser.id).order('created_at', { ascending: false });
			if (error) throw error;
			state.previousPlans = plans || [];
			console.log(`[Core LoadHistory] Loaded ${state.previousPlans.length} previous plans.`);
			if (typeof PlanApp.renderPlanHistory === 'function') PlanApp.renderPlanHistory(state.previousPlans); else console.error("UI function renderPlanHistory missing!");
		} catch (error) { console.error("[Core LoadHistory] Error:", error); if (typeof PlanApp.renderMessage === 'function' && PlanApp.ui?.historyPlanContent) PlanApp.renderMessage(PlanApp.ui.historyPlanContent, 'error', 'Chyba', 'Nepodařilo se načíst historii.'); }
        finally { if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('history', false); }
	};

	PlanApp.getLatestDiagnostic = async (showLoaderFlag = true) => {
		const state = PlanApp.state; if (!state.currentUser || !state.supabaseClient) return null;
		if (showLoaderFlag && typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('create', true);
		try { console.log("[Core GetDiagnostic] Fetching diagnostic..."); const { data, error } = await state.supabaseClient.from('user_diagnostics').select('id, completed_at, total_score, total_questions, topic_results, analysis').eq('user_id', state.currentUser.id).order('completed_at', { ascending: false }).limit(1); if (error) throw error; console.log("[Core GetDiagnostic] Fetched:", data); return (data && data.length > 0) ? data[0] : false;
		} catch (error) { console.error("[Core GetDiagnostic] Error:", error); return null;
		} finally { if (showLoaderFlag && typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('create', false); }
	};

	PlanApp.checkPlanCreationAvailability = async () => {
		const state = PlanApp.state; const config = PlanApp.config; if (!state.supabaseClient || !state.currentUser) return;
		console.log("[Core CreateCheck] Starting check...");
		if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('create', true);
		try {
			state.latestDiagnosticData = await PlanApp.getLatestDiagnostic(false);
			if (state.latestDiagnosticData === null) { if (typeof PlanApp.renderMessage === 'function' && PlanApp.ui?.createPlanContent) PlanApp.renderMessage(PlanApp.ui.createPlanContent, 'error', 'Chyba', 'Nepodařilo se ověřit test.'); return; }
            else if (state.latestDiagnosticData === false) { if (typeof PlanApp.renderNoDiagnosticAvailable === 'function' && PlanApp.ui?.createPlanContent) PlanApp.renderNoDiagnosticAvailable(PlanApp.ui.createPlanContent); return; }

			const { data: latestPlan, error: planError } = await state.supabaseClient.from('study_plans').select('created_at').eq('user_id', state.currentUser.id).order('created_at', { ascending: false }).limit(1);
			if (planError) throw planError;
			let canCreate = true;
			if (latestPlan && latestPlan.length > 0) {
				const lastPlanDate = new Date(latestPlan[0].created_at); const cooldownDate = new Date(lastPlanDate); cooldownDate.setDate(cooldownDate.getDate() + config.PLAN_GENERATION_COOLDOWN_DAYS);
				if (new Date() < cooldownDate) { canCreate = false; state.nextPlanCreateTime = cooldownDate; }
			}
			state.planCreateAllowed = canCreate;
			if (canCreate) { if (typeof PlanApp.renderPlanCreationForm === 'function' && PlanApp.ui?.createPlanContent) PlanApp.renderPlanCreationForm(PlanApp.ui.createPlanContent); }
            else { if (typeof PlanApp.renderLockedPlanSection === 'function' && PlanApp.ui?.createPlanContent) PlanApp.renderLockedPlanSection(PlanApp.ui.createPlanContent); }
		} catch (error) { console.error('[Core CreateCheck] Error:', error); if (typeof PlanApp.renderMessage === 'function' && PlanApp.ui?.createPlanContent) PlanApp.renderMessage(PlanApp.ui.createPlanContent, 'error', 'Chyba', 'Nepodařilo se ověřit dostupnost.'); }
        finally { if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('create', false); }
	};

    PlanApp.handleGenerateClick = () => { // Обработчик клика (вызывает ядро)
         const state = PlanApp.state;
         if (state.isLoading.generation) return;
         const button = document.getElementById('generatePlanBtn'); // Находим кнопку по ID
         if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generuji plán...'; }
         PlanApp.generateStudyPlan(); // Вызываем функцию ядра
     };

	// --- Логика активностей и прогресса ---
	PlanApp.handleActivityCompletionToggle = async (activityId, isCompleted, planId) => {
		const state = PlanApp.state; const config = PlanApp.config; if (!state.supabaseClient) return;
		console.log(`[Core ActivityToggle] Toggling activity ${activityId} to ${isCompleted}`);
		try {
			const { error } = await state.supabaseClient.from('plan_activities').update({ completed: isCompleted, updated_at: new Date().toISOString() }).eq('id', activityId);
			if (error) throw error;
			console.log(`[Core ActivityToggle] Status updated.`);
			if (isCompleted && typeof PlanApp.awardPoints === 'function') await PlanApp.awardPoints(config.POINTS_ACTIVITY_COMPLETE);
			await PlanApp.updatePlanProgress(planId);
			if (typeof PlanApp.checkAndAwardAchievements === 'function' && state.currentUser) await PlanApp.checkAndAwardAchievements(state.currentUser.id);
		} catch (error) { console.error(`[Core ActivityToggle] Error updating activity ${activityId}:`, error); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Nepodařilo se aktualizovat stav aktivity.', 'error'); /* UI revert handled in plan-ui.js */ }
	};

	PlanApp.updatePlanProgress = async (planId) => {
		const state = PlanApp.state; const config = PlanApp.config; if (!planId || !state.supabaseClient) return;
		console.log(`[Core PlanProgress] Updating progress for plan ${planId}`);
		try {
			const { count: totalCount, error: countError } = await state.supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId);
			const { count: completedCount, error: completedError } = await state.supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId).eq('completed', true);
			if (countError || completedError) throw countError || completedError;
			const numTotal = totalCount ?? 0; const numCompleted = completedCount ?? 0;
			const progress = numTotal > 0 ? Math.round((numCompleted / numTotal) * 100) : 0;
			console.log(`[Core PlanProgress] Plan ${planId}: ${numCompleted}/${numTotal} completed (${progress}%)`);
			const updates = { progress: progress, updated_at: new Date().toISOString() }; let planCompleted = false;
			if (numTotal > 0 && numCompleted === numTotal) { updates.status = 'completed'; updates.completed_at = new Date().toISOString(); planCompleted = true; console.log(`[Core PlanProgress] Plan ${planId} marked completed.`); }
			const { error: updateError } = await state.supabaseClient.from('study_plans').update(updates).eq('id', planId);
			if (updateError) throw updateError; console.log(`[Core PlanProgress] Plan ${planId} DB updated`);
			if (state.currentStudyPlan?.id === planId) { state.currentStudyPlan.progress = progress; if (planCompleted) state.currentStudyPlan.status = 'completed'; }
			if (planCompleted && typeof PlanApp.awardPoints === 'function') await PlanApp.awardPoints(config.POINTS_PLAN_COMPLETE);
		} catch (error) { console.error(`[Core PlanProgress] Error updating plan progress ${planId}:`, error); }
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

		if (learningGoal === 'math_review') {
            // ... (Prompt for math_review) ...
            prompt = `
Jsi AI asistent pro plánování studia matematiky. Tvým úkolem je vytvořit JEDNODUCHÝ týdenní (Po-Pá) opakovací plán pro studenta, který si potřebuje zopakovat ZÁKLADY matematiky na úrovni přibližně do 8./9. třídy ZŠ. Nejedná se o přípravu na přijímačky, ale o doplnění mezer.

# Studentův cíl: 'math_review' (Doplnění mezer v základech)

# Témata k zopakování:
- Lineární rovnice
- Procenta
- Základy geometrie (obvody, obsahy základních tvarů)
- Zlomky (sčítání, odčítání, násobení, dělení)
- Algebraické výrazy (rozšiřování, zjednodušování)
- Jednoduché slovní úlohy

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

# Příklad formátu výstupu:
**Týdenní opakovací plán:**
Cílem je osvěžit základy.

### Pondělí: Lineární rovnice
* **Opakování (15 min):** Připomeň si, co je lineární rovnice a jak se řeší (ekvivalentní úpravy).
* **Procvičení (30 min):** Vyřeš 4 jednoduché lineární rovnice s jednou neznámou.

### Úterý: Procenta
* **Opakování (20 min):** Zopakuj si výpočet procentové části, základu a počtu procent.
* **Procvičení (25 min):** Vyřeš 3 základní úlohy na procenta.

### Středa: Základy geometrie
* **Opakování (15 min):** Připomeň si vzorce pro obvod a obsah čtverce, obdélníku a trojúhelníku.
* **Procvičení (30 min):** Vypočítej obvod a obsah 2 obdélníků a 2 trojúhelníků podle zadaných rozměrů.

### Čtvrtek: Zlomky
* **Opakování (20 min):** Zopakuj si pravidla pro sčítání, odčítání, násobení a dělení zlomků.
* **Procvičení (30 min):** Vyřeš 5 příkladů na operace se zlomky (různé operace).

### Pátek: Algebraické výrazy
* **Opakování (15 min):** Připomeň si roznásobování závorek a zjednodušování výrazů.
* **Procvičení (30 min):** Zjednoduš 4 algebraické výrazy (kombinace sčítání, odčítání, násobení).

---
**Rada:** Pravidelné krátké opakování je klíčové! I pár minut denně pomůže.
---
\`\`\`json
[
  { "day_of_week": 1, "type": "review", "title": "Opakování: Lineární rovnice", "description": "Připomeň si základní pravidla řešení lineárních rovnic.", "time_slot": "15 min" },
  { "day_of_week": 1, "type": "practice", "title": "Procvičení: Lineární rovnice", "description": "Vyřeš 4 jednoduché lineární rovnice s jednou neznámou.", "time_slot": "30 min" },
  { "day_of_week": 2, "type": "review", "title": "Opakování: Procenta", "description": "Zopakuj si výpočet procentové části, základu a počtu procent.", "time_slot": "20 min" },
  { "day_of_week": 2, "type": "practice", "title": "Procvičení: Procenta", "description": "Vyřeš 3 základní úlohy na procenta.", "time_slot": "25 min" },
  { "day_of_week": 3, "type": "review", "title": "Opakování: Základy geometrie", "description": "Připomeň si vzorce pro obvod a obsah čtverce, obdélníku a trojúhelníku.", "time_slot": "15 min" },
  { "day_of_week": 3, "type": "practice", "title": "Procvičení: Základy geometrie", "description": "Vypočítej obvod a obsah 2 obdélníků a 2 trojúhelníků podle zadaných rozměrů.", "time_slot": "30 min" },
  { "day_of_week": 4, "type": "review", "title": "Opakování: Zlomky", "description": "Zopakuj si pravidla pro sčítání, odčítání, násobení a dělení zlomků.", "time_slot": "20 min" },
  { "day_of_week": 4, "type": "practice", "title": "Procvičení: Zlomky", "description": "Vyřeš 5 příkladů na operace se zlomky (různé operace).", "time_slot": "30 min" },
  { "day_of_week": 5, "type": "review", "title": "Opakování: Algebraické výrazy", "description": "Připomeň si roznásobování závorek a zjednodušování výrazů.", "time_slot": "15 min" },
  { "day_of_week": 5, "type": "practice", "title": "Procvičení: Algebraické výrazy", "description": "Zjednoduš 4 algebraické výrazy.", "time_slot": "30 min" }
]
\`\`\`
`;
		} else { // Default to 'exam_prep' or any other goal needing detailed plan
            // ... (Prompt for exam_prep - same as before) ...
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
	* **Teorie/Vysvětlení:** Krátké zopakování nebo vysvětlení **konkrétního pod-tématu** (např. "Pravidla pro sčítání mnohočlenů", "Definice a použití Pythagorovy věty").
	* **Řešené Příklady:** Projití a analýza **několika (2-3)** řešených příkladů na dané pod-téma.
	* **Samostatné Procvičování:** Zadání **SPECIFICKÉHO počtu příkladů** k vyřešení (např. "Vyřešte 6 rovnic typu...", "Narýsujte 2 úlohy na konstrukci osy úhlu"). Buď VELMI KONKRÉTNÍ v zadání typu a počtu úkolů.
	* **Opakování:** Krátké opakování předchozího dne nebo týdne na začátku/konci bloku.
4.  **Sobota - Opakovací Test:** Na sobotu naplánuj **pouze JEDNU aktivitu**: "Opakovací test" zaměřený na témata probíraná během týdne. Popis v JSONu by měl být: "Otestujte si znalosti získané během týdne z témat [Název tématu 1], [Název tématu 2]".
5.  **DETAILNÍ Popis v Markdown:** V Markdown části pro každý den jasně popiš **CO** se má student učit a **JAKÉ KONKRÉTNÍ** úkoly má dělat (včetně typu a počtu příkladů). POUŽIJ PŘIROZENÝ JAZYK a formátování (nadpisy, odrážky).
6.  **JSON Aktivity (KRITICKÉ!):** Na konci, v bloku \`\`\`json ... \`\`\`, vygeneruj pole JSON objektů. KAŽDÝ objekt reprezentuje JEDEN studijní blok z Markdown plánu pro daný den. Každý objekt MUSÍ obsahovat:
	* \`"day_of_week"\`: Číslo dne (1=Po, ..., 6=So).
	* \`"title"\`: **VELMI SPECIFICKÝ název aktivity**, např. "Algebra: Procvičení rovnic se zlomky (5 úloh)" nebo "Geometrie: Teorie - Pythagorova věta".
	* \`"description"\`: **VELMI SPECIFICKÝ popis úkolu**, který AI tutor ve výuce pochopí. Např. "Student má samostatně vyřešit 5 lineárních rovnic obsahujících zlomky.", "Student si má zopakovat definici Pythagorovy věty a projít 2 řešené příklady jejího použití.", "Otestujte si znalosti získané během týdne z témat Algebra: Rovnice, Geometrie: Obvody". **NESMÍ obsahovat obecné fráze jako "procvičit chyby"**. Musí být jasné, co se má dělat.
	* \`"time_slot"\`: Odhadovaný čas bloku (např., "40 min").
	* \`"type"\`: Typ aktivity (např., "theory", "practice", "example", "test", "review"). Odhadni typ podle popisu.
7.  **KONZISTENCE JSON a Markdown:** Obsah JSON objektů (title, description, type) musí PŘESNĚ odpovídat aktivitě popsané v Markdown pro daný den/blok.
8.  **Rada pro Plán:** Na konci Markdown přidej krátkou radu.

# Požadovaný formát výstupu (Markdown + JSON na konci):
**Analýza diagnostiky:**
* Zaměření tento týden na: [Vybrané 1-2 nejslabší téma/témata]
---
### Pondělí
* **Fokus dne:** [Pod-téma 1 z vybraného hlavního tématu]
* **Blok 1 (cca 40 min): Teorie - [Název pod-tématu]:** Zopakujte si definici/pravidla pro [konkrétní koncept]. Projděte si vysvětlení na straně X v učebnici nebo v [online zdroj].
* **Blok 2 (cca 45 min): Procvičování - [Název pod-tématu]:** Samostatně vyřešte 8 příkladů typu [specifický typ příkladu] zaměřených na [konkrétní koncept].

### Úterý
* **Fokus dne:** [Pod-téma 2 z vybraného hlavního tématu]
* **Blok 1 (cca 30 min): Řešené příklady - [Název pod-tématu]:** Projděte si a analyzujte 3 řešené příklady na [konkrétní koncept]. Všímejte si postupu a častých chyb.
* **Blok 2 (cca 50 min): Procvičování - [Název pod-tématu]:** Vyřešte 6 úloh [specifický typ úloh] z pracovního sešitu, strany Y-Z.
* ... (Detailní plán pro St, Čt, Pá) ...

### Sobota
* **Fokus dne:** Týdenní opakování
* **Blok 1 (cca 60 min): Opakovací test:** Absolvujte krátký test zaměřený na témata z tohoto týdne: [Název tématu 1], [Název tématu 2]. Cílem je ověřit pochopení a zapamatování.

---
**Rada pro práci s plánem:**
* Důsledně dodržujte časové bloky, ale nebojte se je přizpůsobit svému tempu. Klíčem je pravidelnost a aktivní řešení příkladů.
---
\`\`\`json
[
  { "day_of_week": 1, "type": "theory", "title": "Teorie - [Název pod-tématu z Po]", "description": "Student si má zopakovat definici/pravidla pro [konkrétní koncept] z učebnice nebo online zdroje.", "time_slot": "40 min" },
  { "day_of_week": 1, "type": "practice", "title": "Procvičování - [Název pod-tématu z Po]", "description": "Student má samostatně vyřešit 8 příkladů typu [specifický typ příkladu] zaměřených na [konkrétní koncept].", "time_slot": "45 min" },
  { "day_of_week": 2, "type": "example", "title": "Řešené příklady - [Název pod-tématu z Út]", "description": "Student si má projít a analyzovat 3 řešené příklady na [konkrétní koncept].", "time_slot": "30 min" },
  { "day_of_week": 2, "type": "practice", "title": "Procvičování - [Název pod-tématu z Út]", "description": "Student má vyřešit 6 úloh [specifický typ úloh] z pracovního sešitu, strany Y-Z.", "time_slot": "50 min" },
  // ... (JSON objekty pro St, Čt, Pá PŘESNĚ podle Markdown) ...
  { "day_of_week": 6, "type": "test", "title": "Opakovací test týdne", "description": "Otestujte si znalosti získané během týdne z témat: [Název tématu 1], [Název tématu 2].", "time_slot": "60 min" }
]
\`\`\`
`;
		}

		try {
			console.log("[Core GeminiGenerate] Sending request to Gemini API...");
			const response = await fetch(config.GEMINI_API_URL, {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, topK: 30, topP: 0.9, maxOutputTokens: 8192 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ] })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error?.message || `Chyba Gemini API (${response.status})`);
			const geminiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
			if (!geminiResponse) { if (data.promptFeedback?.blockReason) throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}.`); const finishReason = data.candidates?.[0]?.finishReason; if(finishReason && finishReason !== 'STOP') throw new Error(`AI dokončilo generování s důvodem: ${finishReason}.`); throw new Error('Prázdná odpověď od Gemini API.'); }
			console.log("[Core GeminiGenerate] Gemini response received length:", geminiResponse.length);
			return geminiResponse; // Возвращаем полный ответ (Markdown + JSON)
		} catch (error) { console.error('[Core GeminiGenerate] Error generating plan content:', error); throw error; }
	};

	// --- Сохранение Плана ---
	PlanApp.handleSaveGeneratedPlanClick = async () => {
		const state = PlanApp.state;
		const ui = PlanApp.ui; // Доступ к UI кэшу
		const saveButton = ui?.planActions?.querySelector('#saveGeneratedPlanBtn');

		const markdownContent = state.lastGeneratedMarkdown;
		const activitiesArray = state.lastGeneratedActivitiesJson;
		const topicsData = state.lastGeneratedTopicsData;

		if (!state.currentUser || !state.latestDiagnosticData || !markdownContent || !state.supabaseClient) { if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba: Chybí data pro uložení.', 'error'); if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Uložit tento plán'; } return; }
		if (saveButton) { saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...'; }
		if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('saving', true);

		const priorityTopics = {};
		if (topicsData && Array.isArray(topicsData)) { topicsData.forEach((topic, index) => { priorityTopics[topic.name] = { priority: index + 1, performance: topic.percentage, focus_level: topic.percentage < 50 ? 'high' : topic.percentage < 75 ? 'medium' : 'low' }; }); } else { console.warn("[Core SavePlan] Missing topicsData."); }

		let savedPlanId = null;
		try {
			console.log("[Core SavePlan] Deactivating existing active plans...");
			const { error: deactivateError } = await state.supabaseClient.from('study_plans').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('user_id', state.currentUser.id).eq('status', 'active');
			if (deactivateError) throw deactivateError;

			const today = new Date(); const completionDate = new Date(today); completionDate.setDate(completionDate.getDate() + 7);
			const newPlanData = { user_id: state.currentUser.id, title: `Studijní plán (${PlanApp.formatDate(today)})`, subject: "Matematika", status: "active", diagnostic_id: state.latestDiagnosticData.id, plan_content_markdown: markdownContent, priority_topics: priorityTopics, estimated_completion_date: completionDate.toISOString().split('T')[0], progress: 0, is_auto_adjusted: true };
			console.log("[Core SavePlan] Inserting new plan data...");
			const { data: savedPlan, error: insertPlanError } = await state.supabaseClient.from('study_plans').insert(newPlanData).select('id').single();
			if (insertPlanError) throw insertPlanError;
			savedPlanId = savedPlan.id; console.log("[Core SavePlan] New plan saved, ID:", savedPlanId);

			if (activitiesArray && Array.isArray(activitiesArray) && activitiesArray.length > 0) {
				console.log(`[Core SavePlan] Preparing to insert ${activitiesArray.length} activities...`);
				const activitiesToInsert = activitiesArray.map(act => { if (typeof act !== 'object' || act === null) return null; const dayOfWeek = typeof act.day_of_week === 'number' ? act.day_of_week : parseInt(act.day_of_week, 10); if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null; return { plan_id: savedPlanId, day_of_week: dayOfWeek, time_slot: act.time_slot || null, title: act.title || 'Nespecifikováno', description: act.description || null, type: act.type || PlanApp.getActivityTypeFromTitle(act.title), completed: false }; }).filter(item => item !== null);
				if (activitiesToInsert.length > 0) {
					console.log(`[Core SavePlan] Inserting ${activitiesToInsert.length} valid activities...`);
					const { error: insertActivitiesError } = await state.supabaseClient.from('plan_activities').insert(activitiesToInsert);
					if (insertActivitiesError) { console.error("[Core SavePlan] Error inserting activities:", insertActivitiesError); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán uložen, ale aktivity selhaly.', 'warning'); }
                    else { console.log("[Core SavePlan] Activities inserted."); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán a aktivity uloženy!', 'success'); }
				} else { if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán uložen, ale nenalezeny aktivity.', 'warning'); }
			} else { if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán uložen (bez aktivit).', 'info'); }

			 state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; state.lastGeneratedTopicsData = null;
			state.currentStudyPlan = { ...newPlanData, id: savedPlanId }; // Обновляем текущий план в состоянии
			if (typeof PlanApp.switchTab === 'function') PlanApp.switchTab('current'); // Переключаемся на вкладку текущего плана

		} catch (error) { console.error("[Core SavePlan] Error saving plan:", error); if (typeof PlanApp.showToast === 'function') PlanApp.showToast(`Nepodařilo se uložit plán: ${error.message}`, 'error'); if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Uložit tento plán'; } }
        finally { if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('saving', false); }
	};

	// --- Логика таймера кулдауна ---
	PlanApp.startPlanTimer = () => { const state = PlanApp.state; if (state.planTimerInterval) clearInterval(state.planTimerInterval); state.planTimerInterval = setInterval(() => { const timerEl = document.getElementById('nextPlanTimer'); if (timerEl && document.body.contains(timerEl)) PlanApp.updateNextPlanTimer(timerEl); else clearInterval(state.planTimerInterval); }, 1000); };
	PlanApp.updateNextPlanTimer = (el) => { const state = PlanApp.state; if (!state.nextPlanCreateTime || !el) return; const now = new Date(); const diff = state.nextPlanCreateTime - now; if (diff <= 0) { el.textContent = 'Nyní'; clearInterval(state.planTimerInterval); state.planCreateAllowed = true; if(state.currentTab === 'create' && typeof PlanApp.checkPlanCreationAvailability === 'function') setTimeout(PlanApp.checkPlanCreationAvailability, 500); return; } const d = Math.floor(diff/(1000*60*60*24)), h = Math.floor((diff%(1000*60*60*24))/(1000*60*60)), m = Math.floor((diff%(1000*60*60))/(1000*60)), s = Math.floor((diff%(1000*60))/1000); el.textContent = `${d}d ${h}h ${m}m ${s}s`; };

	// --- Логика уведомлений (Ядро) ---
	PlanApp.fetchNotifications = async (userId, limit) => { /* ... (код из предыдущего файла) ... */ };
	PlanApp.markNotificationRead = async (notificationId) => { /* ... (код из предыдущего файла) ... */ };
	PlanApp.markAllNotificationsRead = async () => { /* ... (код из предыдущего файла) ... */ };

    // --- Вспомогательная функция для типа активности (Ядро) ---
    PlanApp.getActivityTypeFromTitle = (title = "") => { /* ... (код из предыдущего файла) ... */ };

    // --- (Заглушки) Логика баллов и достижений ---
	PlanApp.awardPoints = async (pointsValue) => { console.warn(`[Core Placeholder] awardPoints called with ${pointsValue}, not implemented.`); return Promise.resolve(); };
	PlanApp.checkAndAwardAchievements = async (userId) => { console.warn(`[Core Placeholder] checkAndAwardAchievements called for user ${userId}, not implemented.`); return Promise.resolve(); };

	console.log("plan-data-logic.js loaded.");

})(); // Конец IIFE