// Файл: plan-core.js
// Описание: Содержит основную логику, управление состоянием,
// взаимодействие с Supabase и Gemini для страницы studijního plánu.
// Версия: 23.4 (Улучшенное логирование в loadCurrentPlan для отладки)

(function() { // IIFE для изоляции области видимости
	'use strict';

	window.PlanApp = window.PlanApp || {};
	const PlanApp = window.PlanApp;

	PlanApp.config = {
		supabaseUrl: 'https://qcimhjjwvsbgjsitmvuh.supabase.co',
		supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10',
		GEMINI_API_KEY: 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs',
		GEMINI_API_URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs`,
		PLAN_GENERATION_COOLDOWN_DAYS: 7,
		NOTIFICATION_FETCH_LIMIT: 5,
		MAX_GEMINI_HISTORY_TURNS: 12,
		POINTS_ACTIVITY_COMPLETE: 5,
		POINTS_PLAN_COMPLETE: 50,
	};

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
		topicMap: {},
        isDarkMode: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true,
	};

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

	PlanApp.formatDate = (dateString) => {
		if (!dateString) return '-';
		try { const date = new Date(dateString); if (isNaN(date.getTime())) { console.warn(`Invalid date string received: ${dateString}`); return 'Neplatné datum'; } return date.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
		} catch (e) { console.error(`Error formatting date string ${dateString}:`, e); return '-'; }
	};

	PlanApp.getActivityTypeFromTitle = (title = "") => { const lower = title.toLowerCase(); if (lower.includes('test')) return 'test'; if (lower.includes('procvičování') || lower.includes('příklad')) return 'practice'; if (lower.includes('řešené')) return 'example'; if (lower.includes('cvičení')) return 'exercise'; if (lower.includes('lekce') || lower.includes('teorie') || lower.includes('vysvětlení')) return 'theory'; if (lower.includes('opakování') || lower.includes('shrnutí')) return 'review'; if (lower.includes('analýza')) return 'analysis'; return 'other'; };

	PlanApp.initializeSupabase = () => {
		const config = PlanApp.config; const state = PlanApp.state;
		try { if (!window.supabase) throw new Error("Supabase library not loaded."); if (state.supabaseClient) { console.log("[Core] Supabase client already initialized."); return true; } state.supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseKey); if (!state.supabaseClient) throw new Error("Client creation failed."); console.log("[Core] Supabase client initialized."); return true;
		} catch (error) { console.error("[Core] Supabase init failed:", error); if (typeof PlanApp.showGlobalError === 'function') { PlanApp.showGlobalError("Chyba připojení k databázi."); } else { alert("Kritická chyba: Nelze se připojit k databázi."); } return false; }
	};

	PlanApp.fetchUserProfile = async (userId) => {
		const state = PlanApp.state; if (!userId || !state.supabaseClient) { console.warn("[Core FetchProfile] Missing userId or Supabase client."); return null; }
		console.log(`[Core] Fetching profile for user ID: ${userId}`);
		try { const { data, error } = await state.supabaseClient.from('profiles').select('*').eq('id', userId).single(); if (error && error.code !== 'PGRST116') { console.error(`[Core] Supabase profile fetch error for user ${userId}:`, error); throw error; } if (!data) { console.warn(`[Core] Profile not found for user ${userId}.`); return null; } console.log("[Core] Profile data fetched successfully."); return data;
		} catch (e) { console.error(`[Core] Exception fetching profile for user ${userId}:`, e); if (typeof PlanApp.showToast === 'function') { PlanApp.showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error'); } return null; }
	};

    PlanApp.fetchPlanActivities = async (planId) => {
        const state = PlanApp.state;
        if (!planId || !state.supabaseClient) {
            console.warn("[Core FetchActivities] Missing planId or Supabase client.");
            return [];
        }
        console.log(`[Core FetchActivities] Fetching activities for plan ID: ${planId}`);
        try {
            const { data, error } = await state.supabaseClient
                .from('plan_activities')
                .select('*')
                .eq('plan_id', planId)
                .order('day_of_week')
                .order('time_slot');
            if (error) {
                console.error(`[Core FetchActivities] Supabase error fetching activities for plan ${planId}:`, error);
                throw error;
            }
            console.log(`[Core FetchActivities] Fetched ${data?.length ?? 0} activities for plan ${planId}.`);
            return data || [];
        } catch (errorCatch) { // Renamed to avoid conflict with 'error' from Supabase response
            console.error(`[Core FetchActivities] Exception fetching activities for plan ${planId}:`, errorCatch);
            if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba', 'Nepodařilo se načíst aktivity plánu.', 'error');
            return [];
        }
    };

    PlanApp.fetchPlanDetails = async (planId) => {
         const state = PlanApp.state; if (!planId || !state.supabaseClient) { console.warn("[Core FetchDetails] Missing planId or Supabase client."); return null; }
         console.log(`[Core FetchDetails] Fetching details for plan ${planId}`);
         try { const { data, error } = await state.supabaseClient.from('study_plans').select('plan_content_markdown, title, created_at, estimated_completion_date').eq('id', planId).single(); if (error) throw error; console.log(`[Core FetchDetails] Details fetched successfully for plan ${planId}.`); return data;
         } catch (error) { console.error(`[Core FetchDetails] Error fetching details for plan ${planId}:`, error); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba', 'Nepodařilo se načíst detail plánu.', 'error'); return null; }
     };

	PlanApp.loadCurrentPlan = async () => {
		const state = PlanApp.state;
        console.log("[Core LoadCurrent START v23.4] Called.");

		if (!state.supabaseClient || !state.currentUser) {
			console.warn("[Core LoadCurrent EXIT v23.4] Missing Supabase client or current user. Returning false.");
			return false;
		}
		console.log("[Core LoadCurrent v23.4] Supabase client and current user are present.");

		try {
			console.log("[Core LoadCurrent TRY v23.4] Fetching plans from Supabase...");
			const { data: plans, error: plansError } = await state.supabaseClient
				.from('study_plans')
				.select('*')
				.eq('user_id', state.currentUser.id)
				.eq('status', 'active')
				.order('created_at', { ascending: false })
				.limit(1);

			if (plansError) {
				console.error("[Core LoadCurrent ERROR v23.4] Supabase error fetching plans:", plansError);
				throw plansError;
			}
			console.log("[Core LoadCurrent v23.4] Fetched plans from Supabase:", plans);

			if (plans && plans.length > 0) {
				state.currentStudyPlan = plans[0];
				console.log("[Core LoadCurrent v23.4] Active plan found:", state.currentStudyPlan.id);

				if (typeof PlanApp.fetchPlanActivities === 'function') {
					console.log(`[Core LoadCurrent v23.4] Attempting to fetch activities for plan ID: ${state.currentStudyPlan.id}`);
					try {
						state.currentPlanActivities = await PlanApp.fetchPlanActivities(state.currentStudyPlan.id);
						console.log(`[Core LoadCurrent v23.4] Result of fetchPlanActivities (length): ${state.currentPlanActivities?.length ?? 'undefined'}. Activities stored in state.`);
					} catch (activitiesError) {
						console.error(`[Core LoadCurrent ERROR v23.4] Error explicitly caught from fetchPlanActivities for plan ${state.currentStudyPlan.id}:`, activitiesError);
						state.currentPlanActivities = []; // Ensure it's an empty array on error from fetchPlanActivities
                        // This error should ideally propagate to make loadCurrentPlan return false
                        throw new Error(`Failed to fetch activities: ${activitiesError.message}`);
					}
				} else {
					console.error("[Core LoadCurrent CRITICAL v23.4] fetchPlanActivities function is NOT DEFINED on PlanApp!");
					state.currentPlanActivities = [];
                    throw new Error("Core function fetchPlanActivities is missing, cannot load plan activities.");
				}
			} else {
				state.currentStudyPlan = null;
                state.currentPlanActivities = [];
				console.log("[Core LoadCurrent v23.4] No active plan found. Checking diagnostic...");
                if (typeof PlanApp.getLatestDiagnostic === 'function') {
				    await PlanApp.getLatestDiagnostic(false);
                } else {
                    console.warn("[Core LoadCurrent v23.4] getLatestDiagnostic function is missing.");
                }
			}
			console.log("[Core LoadCurrent EXIT v23.4] Successfully processed. Returning true.");
			return true;
		} catch (error) {
			console.error("[Core LoadCurrent CATCH BLOCK v23.4] Error during loadCurrentPlan:", error);
			state.currentStudyPlan = null;
			state.currentPlanActivities = [];
			console.log("[Core LoadCurrent EXIT v23.4] Error caught. Returning false.");
			return false;
		} finally {
			console.log("[Core LoadCurrent FINALLY v23.4] Core loading logic for current plan finished.");
		}
	};

	PlanApp.loadPlanHistory = async () => {
		const state = PlanApp.state; if (!state.supabaseClient || !state.currentUser) { console.warn("[Core LoadHistory] Missing Supabase client or user."); return; }
        console.log("[Core LoadHistory] Fetching plan history...");
		try { const { data: plans, error } = await state.supabaseClient.from('study_plans').select('id, title, created_at, status, progress').eq('user_id', state.currentUser.id).order('created_at', { ascending: false }); if (error) throw error; state.previousPlans = plans || []; console.log(`[Core LoadHistory] Loaded ${state.previousPlans.length} previous plans.`);
		} catch (error) { console.error("[Core LoadHistory] Error loading plan history:", error); state.previousPlans = []; }
	};

	PlanApp.getLatestDiagnostic = async (showLoaderFlag = true) => {
		const state = PlanApp.state; if (!state.currentUser || !state.supabaseClient) { console.warn("[Core GetDiagnostic] Missing user or Supabase client."); return null; }
		try { console.log("[Core GetDiagnostic] Fetching latest diagnostic data..."); const { data, error } = await state.supabaseClient.from('user_diagnostics').select('id, completed_at, total_score, total_questions, topic_results, analysis').eq('user_id', state.currentUser.id).order('completed_at', { ascending: false }).limit(1); if (error) throw error; console.log("[Core GetDiagnostic] Fetched diagnostic data:", data ? data[0] : 'None'); return (data && data.length > 0) ? data[0] : false;
		} catch (error) { console.error("[Core GetDiagnostic] Error fetching diagnostic:", error); return null; }
	};

	PlanApp.checkPlanCreationAvailability = async () => {
		const state = PlanApp.state; const config = PlanApp.config; if (!state.supabaseClient || !state.currentUser) { console.warn("[Core CreateCheck] Missing Supabase or user."); return 'error'; }
		console.log("[Core CreateCheck] Starting availability check...");
		try { state.latestDiagnosticData = await PlanApp.getLatestDiagnostic(false); if (state.latestDiagnosticData === null) return 'error'; if (state.latestDiagnosticData === false) return 'no_diagnostic'; const { data: latestPlan, error: planError } = await state.supabaseClient.from('study_plans').select('created_at').eq('user_id', state.currentUser.id).order('created_at', { ascending: false }).limit(1); if (planError) throw planError; let canCreate = true; state.nextPlanCreateTime = null; if (latestPlan && latestPlan.length > 0) { const lastPlanDate = new Date(latestPlan[0].created_at); const cooldownDate = new Date(lastPlanDate); cooldownDate.setDate(cooldownDate.getDate() + config.PLAN_GENERATION_COOLDOWN_DAYS); console.log("[Core CreateCheck] Cooldown date:", cooldownDate, "Current date:", new Date()); if (new Date() < cooldownDate) { canCreate = false; state.nextPlanCreateTime = cooldownDate; } } state.planCreateAllowed = canCreate; console.log("[Core CreateCheck] Result:", canCreate ? 'allowed' : 'locked'); return canCreate ? 'allowed' : 'locked';
		} catch (error) { console.error('[Core CreateCheck] Error:', error); return 'error'; }
	};

	PlanApp.handleActivityCompletionToggle = async (activityId, isCompleted, planId) => {
		const state = PlanApp.state; const config = PlanApp.config; if (!state.supabaseClient) { console.warn("[Core ActivityToggle] Supabase client not available."); return false; }
		console.log(`[Core ActivityToggle] Toggling activity ${activityId} to ${isCompleted} in plan ${planId}`);
		try { const { error } = await state.supabaseClient.from('plan_activities').update({ completed: isCompleted, updated_at: new Date().toISOString() }).eq('id', activityId); if (error) throw error; console.log(`[Core ActivityToggle] Activity ${activityId} status updated successfully in DB.`); if (isCompleted && typeof PlanApp.awardPoints === 'function') { await PlanApp.awardPoints(config.POINTS_ACTIVITY_COMPLETE); } await PlanApp.updatePlanProgress(planId); if (typeof PlanApp.checkAndAwardAchievements === 'function' && state.currentUser) { await PlanApp.checkAndAwardAchievements(state.currentUser.id); } return true;
		} catch (error) { console.error(`[Core ActivityToggle] Error updating activity ${activityId}:`, error); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Nepodařilo se aktualizovat stav aktivity.', 'error'); return false; }
	};

	PlanApp.updatePlanProgress = async (planId) => {
		const state = PlanApp.state; const config = PlanApp.config; if (!planId || !state.supabaseClient) { console.warn("[Core PlanProgress] Missing planId or Supabase client."); return; }
		console.log(`[Core PlanProgress] Updating progress for plan ${planId}`);
		try { const [totalResult, completedResult] = await Promise.all([ state.supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId), state.supabaseClient.from('plan_activities').select('id', { count: 'exact', head: true }).eq('plan_id', planId).eq('completed', true) ]); if (totalResult.error || completedResult.error) throw totalResult.error || completedResult.error; const numTotal = totalResult.count ?? 0; const numCompleted = completedResult.count ?? 0; const progress = numTotal > 0 ? Math.round((numCompleted / numTotal) * 100) : (numTotal === 0 ? 100 : 0); console.log(`[Core PlanProgress] Plan ${planId}: ${numCompleted}/${numTotal} completed (${progress}%)`); const updates = { progress: progress, updated_at: new Date().toISOString() }; let planCompleted = false; if (numTotal > 0 && numCompleted === numTotal) { updates.status = 'completed'; updates.completed_at = new Date().toISOString(); planCompleted = true; console.log(`[Core PlanProgress] Plan ${planId} marked as completed.`); } const { error: updateError } = await state.supabaseClient.from('study_plans').update(updates).eq('id', planId); if (updateError) throw updateError; console.log(`[Core PlanProgress] Plan ${planId} progress/status DB updated to ${progress}%` + (planCompleted ? ', status: completed' : '')); if (state.currentStudyPlan?.id === planId) { state.currentStudyPlan.progress = progress; if (planCompleted) { state.currentStudyPlan.status = 'completed'; state.currentStudyPlan.completed_at = updates.completed_at; } } if (planCompleted && typeof PlanApp.awardPoints === 'function') { await PlanApp.awardPoints(config.POINTS_PLAN_COMPLETE); }
		} catch (error) { console.error(`[Core PlanProgress] Error updating plan progress for ${planId}:`, error); }
	};

	PlanApp.generatePlanContentWithGemini = async (testData, topicsData, learningGoal = 'exam_prep') => {
		const config = PlanApp.config; console.log(`[Core GeminiGenerate] Starting plan generation for goal: ${learningGoal}...`); if (!testData || !testData.id) { throw new Error('Chybí data diagnostického testu.'); } if (!Array.isArray(topicsData)) { throw new Error('Chybí data o výsledcích témat.'); } if (!config.GEMINI_API_KEY || !config.GEMINI_API_KEY.startsWith('AIzaSy')) { throw new Error('Chybí platný Gemini API klíč.'); }
		const totalScore = testData.total_score ?? '-'; const totalQuestions = testData.total_questions ?? '-'; const analysis = testData.analysis || {}; const overallAssessment = analysis.summary?.overall_assessment || 'N/A'; const strengths = analysis.strengths?.map(s => `${s.topic} (${s.score}%)`).join(', ') || 'Nebyly identifikovány'; const weaknesses = analysis.weaknesses?.map(w => `${w.topic} (${s.score}%)`).join(', ') || 'Nebyly identifikovány'; const recommendations = analysis.recommendations?.join('\n- ') || 'Žádná specifická.'; let prompt;
		if (learningGoal === 'math_review') { const reviewTopicsList = "- Lineární rovnice\n- Procenta\n- Základy geometrie (obvody, obsahy základních tvarů)\n- Zlomky (sčítání, odčítání, násobení, dělení)\n- Algebraické výrazy (rozšiřování, zjednodušování)\n- Jednoduché slovní úlohy"; prompt = `Jsi AI asistent... \`\`\``; // Сокращенный промпт для краткости
		} else { prompt = `Jsi expertní AI tutor... \`\`\``; /* ... (полный промпт для exam_prep) ... */ }
		try { console.log("[Core GeminiGenerate] Sending request to Gemini API..."); const response = await fetch(config.GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, topK: 30, topP: 0.9, maxOutputTokens: 8192 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ] }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || `Chyba Gemini API (${response.status})`); const geminiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text; if (!geminiResponse) { if (data.promptFeedback?.blockReason) throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}.`); const finishReason = data.candidates?.[0]?.finishReason; if(finishReason && finishReason !== 'STOP') throw new Error(`AI dokončilo s důvodem: ${finishReason}.`); throw new Error('Prázdná odpověď od Gemini API.'); } console.log("[Core GeminiGenerate] Gemini response received length:", geminiResponse.length); return geminiResponse;
		} catch (error) { console.error('[Core GeminiGenerate] Error generating plan content:', error); throw error; }
	};

	PlanApp.generateStudyPlan = async () => {
        const state = PlanApp.state; const ui = PlanApp.ui; if (!state.latestDiagnosticData || !state.currentUser || !state.currentProfile) { if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chybí data pro generování.', 'error'); return; }
        const learningGoal = state.currentProfile.learning_goal || 'exam_prep';
        ui?.currentPlanSection?.classList.remove('visible-section'); ui?.historyPlanSection?.classList.remove('visible-section'); ui?.createPlanSection?.classList.remove('visible-section'); ui?.planSection?.classList.add('visible-section');
        state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; state.lastGeneratedTopicsData = null;
        if (learningGoal === 'math_explore' || learningGoal === 'math_accelerate') { console.log(`[Core GeneratePlan] Goal '${learningGoal}' is in development.`); if (ui && ui.planContent && typeof PlanApp.renderMessage === 'function') { PlanApp.renderMessage(ui.planContent, 'info', 'V přípravě', 'Tato funkce studijního plánu je momentálně ve vývoji.'); } if (ui && ui.planSectionTitle) ui.planSectionTitle.textContent = 'Funkce ve vývoji'; if (typeof PlanApp.renderPreviewActions === 'function') PlanApp.renderPreviewActions(false, true); if (ui && ui.planSection) ui.planSection.scrollIntoView({ behavior: 'smooth' }); return; }
        if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('generation', true); if (ui && ui.planContent) { ui.planContent.innerHTML = ''; ui.planContent.classList.remove('content-visible', 'generated-reveal'); } if (ui && ui.planActions) ui.planActions.style.display = 'none'; if (ui && ui.planSectionTitle) ui.planSectionTitle.textContent = 'Generování plánu...'; if (ui && ui.genericBackBtn) ui.genericBackBtn.onclick = () => PlanApp.switchTab('create');
        try { const topicsData = Object.entries(state.latestDiagnosticData.topic_results || {}).map(([_, data]) => ({ name: data.name || `Neznámé Téma`, percentage: data.score_percent || 0 })).sort((a, b) => a.percentage - b.percentage); state.lastGeneratedTopicsData = topicsData; const fullMarkdownResponse = await PlanApp.generatePlanContentWithGemini(state.latestDiagnosticData, topicsData, learningGoal); const jsonRegex = /```json\s*([\s\S]*?)\s*```/; const jsonMatch = fullMarkdownResponse.match(jsonRegex); let activitiesArray = null; let planMarkdownForStorage = fullMarkdownResponse; if (jsonMatch && jsonMatch[1]) { try { activitiesArray = JSON.parse(jsonMatch[1].replace(/\u00A0/g, ' ').trim()); planMarkdownForStorage = fullMarkdownResponse.replace(jsonRegex, '').trim(); state.lastGeneratedActivitiesJson = activitiesArray; } catch (e) { console.error("Error parsing JSON activities:", e); if(typeof PlanApp.showToast === 'function') PlanApp.showToast("Warning: Nepodařilo se zpracovat aktivity z plánu.", "warning"); state.lastGeneratedActivitiesJson = null; } } else { console.warn("JSON block of activities not found in Gemini response."); state.lastGeneratedActivitiesJson = null; } state.lastGeneratedMarkdown = planMarkdownForStorage; if(ui?.planSectionTitle) ui.planSectionTitle.textContent = 'Návrh studijního plánu'; if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('generation', false); if(ui?.planContent && typeof PlanApp.displayPlanContent === 'function') { PlanApp.displayPlanContent(state.lastGeneratedMarkdown); requestAnimationFrame(() => { if (ui.planContent) ui.planContent.classList.add('content-visible', 'generated-reveal'); }); } if(typeof PlanApp.renderPreviewActions === 'function') { PlanApp.renderPreviewActions(false, false); } if (ui?.planSection) ui.planSection.scrollIntoView({ behavior: 'smooth' }); if (typeof PlanApp.initTooltips === 'function') PlanApp.initTooltips();
        } catch (error) { console.error('[Core GeneratePlan] Plan generation failed:', error); if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('generation', false); if (ui && ui.planContent && typeof PlanApp.renderMessage === 'function') { PlanApp.renderMessage(ui.planContent, 'error', 'Chyba generování', error.message); ui.planContent.classList.add('content-visible'); } if (typeof PlanApp.renderPreviewActions === 'function') PlanApp.renderPreviewActions(true); }
    };

	PlanApp.handleSaveGeneratedPlanClick = async () => { // Эта функция была в plan-main.js, но для логики ядра, она должна быть здесь. UI часть может вызвать эту.
		const state = PlanApp.state;
		const markdownContent = state.lastGeneratedMarkdown; const activitiesArray = state.lastGeneratedActivitiesJson; const topicsData = state.lastGeneratedTopicsData;
		if (!state.currentUser || !state.latestDiagnosticData || !markdownContent || !state.supabaseClient) { if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba: Chybí data pro uložení.', 'error'); return false; /* Indicate failure */ }
		if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('saving', true);
		const priorityTopics = {}; if (topicsData?.length) { topicsData.forEach((t, i) => priorityTopics[t.name] = { priority: i + 1, performance: t.percentage, focus_level: t.percentage < 50 ? 'high' : t.percentage < 75 ? 'medium' : 'low' }); } else { console.warn("[Core SavePlan] Missing topicsData in state during save."); }
		let savedPlanId = null;
		try { console.log("[Core SavePlan] Deactivating old plans..."); const { error: deactivateError } = await state.supabaseClient.from('study_plans').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('user_id', state.currentUser.id).eq('status', 'active'); if (deactivateError) throw deactivateError; const today = new Date(); const completionDate = new Date(today); completionDate.setDate(completionDate.getDate() + 7); const newPlanData = { user_id: state.currentUser.id, title: `Studijní plán (${PlanApp.formatDate(today)})`, subject: "Matematika", status: "active", diagnostic_id: state.latestDiagnosticData.id, plan_content_markdown: markdownContent, priority_topics: priorityTopics, estimated_completion_date: completionDate.toISOString().split('T')[0], progress: 0, is_auto_adjusted: true }; console.log("[Core SavePlan] Inserting new plan data..."); const { data: savedPlan, error: insertPlanError } = await state.supabaseClient.from('study_plans').insert(newPlanData).select('id').single(); if (insertPlanError) throw insertPlanError; savedPlanId = savedPlan.id; console.log("[Core SavePlan] Plan saved, ID:", savedPlanId);
			if (activitiesArray?.length) { console.log(`[Core SavePlan] Inserting ${activitiesArray.length} activities...`); const activitiesToInsert = activitiesArray.map(act => { if (typeof act !== 'object' || act === null) return null; const dayOfWeek = typeof act.day_of_week === 'number' ? act.day_of_week : parseInt(act.day_of_week, 10); if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) { console.warn("[Core SavePlan] Invalid day_of_week in activity:", act); return null; } return { plan_id: savedPlanId, day_of_week: dayOfWeek, time_slot: act.time_slot || null, title: act.title || 'N/A', description: act.description || null, type: act.type || PlanApp.getActivityTypeFromTitle(act.title), completed: false }; }).filter(Boolean); if (activitiesToInsert.length > 0) { const { error: insertActivitiesError } = await state.supabaseClient.from('plan_activities').insert(activitiesToInsert); if (insertActivitiesError) { console.error("[Core SavePlan] Error inserting activities:", insertActivitiesError); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán uložen, ale aktivity selhaly.', 'warning'); } else { console.log("[Core SavePlan] Activities inserted."); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán a aktivity uloženy!', 'success'); } } else { if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán uložen, ale nenalezeny platné aktivity.', 'warning'); } } else { if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán uložen (bez aktivit).', 'info'); }
			 state.lastGeneratedMarkdown = null; state.lastGeneratedActivitiesJson = null; state.lastGeneratedTopicsData = null; state.currentStudyPlan = { ...newPlanData, id: savedPlanId };
			return true; // Indicate success
		} catch (error) { console.error("[Core SavePlan] Error saving plan:", error); if (typeof PlanApp.showToast === 'function') PlanApp.showToast(`Uložení selhalo: ${error.message}`, 'error'); return false; /* Indicate failure */ } finally { if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('saving', false); }
	};

	PlanApp.startPlanTimer = () => { const state = PlanApp.state; if (state.planTimerInterval) clearInterval(state.planTimerInterval); console.log("[Core Timer] Starting interval timer..."); state.planTimerInterval = setInterval(() => { const timerEl = document.getElementById('nextPlanTimer'); if (timerEl && document.body.contains(timerEl)) { if (typeof PlanApp.updateNextPlanTimer === 'function') PlanApp.updateNextPlanTimer(timerEl); else { console.error("[Core Timer] updateNextPlanTimer func missing!"); clearInterval(state.planTimerInterval); } } else { console.log("[Core Timer] Timer element gone, stopping."); clearInterval(state.planTimerInterval); } }, 1000); };
	PlanApp.updateNextPlanTimer = (el) => { const state = PlanApp.state; if (!state.nextPlanCreateTime || !el) { if (el) el.textContent = 'Chyba času'; return; } const now = new Date(); const diff = state.nextPlanCreateTime - now; if (diff <= 0) { el.textContent = 'Nyní'; clearInterval(state.planTimerInterval); state.planCreateAllowed = true; console.log("[Core Timer] Cooldown finished."); if(state.currentTab === 'create' && typeof PlanApp.checkPlanCreationAvailability === 'function') setTimeout(PlanApp.checkPlanCreationAvailability, 500); return; } const d = Math.floor(diff/(1000*60*60*24)), h = Math.floor((diff%(1000*60*60*24))/(1000*60*60)), m = Math.floor((diff%(1000*60*60))/(1000*60)), s = Math.floor((diff%(1000*60))/1000); el.textContent = `${d}d ${h}h ${m}m ${s}s`; };
	PlanApp.fetchNotifications = async (userId, limit) => { const state = PlanApp.state; const config = PlanApp.config; const fetchLimit = limit || config.NOTIFICATION_FETCH_LIMIT || 5; if (!state.supabaseClient || !userId) { console.warn("[Core Notifications] Missing Supabase or User ID."); return { unreadCount: 0, notifications: [] }; } console.log(`[Core Notifications] Fetching unread for user ${userId}, Limit: ${fetchLimit}`); try { const { data, error, count } = await state.supabaseClient.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(fetchLimit); if (error) throw error; console.log(`[Core Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Core Notifications] Exception fetching notifications:", error); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } };
	PlanApp.markNotificationRead = async (notificationId) => { const state = PlanApp.state; console.log("[Core Notifications] Marking read:", notificationId); if (!state.currentUser || !notificationId || !state.supabaseClient) return false; try { const { error } = await state.supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[Core Notifications] Mark read success:", notificationId); return true; } catch (error) { console.error("[Core Notifications] Mark read error:", error); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba', 'Nepodařilo se označit oznámení.', 'error'); return false; } };
	PlanApp.markAllNotificationsRead = async () => { const state = PlanApp.state; console.log("[Core Notifications] Marking all read:", state.currentUser?.id); if (!state.currentUser || !state.supabaseClient) return false; try { const { error } = await state.supabaseClient.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('is_read', false); if (error) throw error; console.log("[Core Notifications] Mark all read success."); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení přečtena.', 'success'); return true; } catch (error) { console.error("[Core Notifications] Mark all read error:", error); if (typeof PlanApp.showToast === 'function') PlanApp.showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); return false; } };
	PlanApp.awardPoints = async (pointsValue) => { console.warn(`[Core Placeholder] awardPoints called: ${pointsValue}`); return Promise.resolve(); };
	PlanApp.checkAndAwardAchievements = async (userId) => { console.warn(`[Core Placeholder] checkAchievements called: ${userId}`); return Promise.resolve(); };

	console.log("plan-core.js loaded and PlanApp initialized.");

})();