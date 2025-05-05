// Файл: plan-core.js
// Описание: Содержит основную логику, управление состоянием,
// взаимодействие с Supabase и Gemini для страницы studijního plánu.
// Версия: 23.1 (добавлена логика learning_goal)

(function() { // IIFE для изоляции области видимости
	'use strict';

	// --- Глобальное Пространство Имен (если нужно) ---
	// Создаем или получаем доступ к глобальному пространству имен
	window.PlanApp = window.PlanApp || {};
	const PlanApp = window.PlanApp; // Локальная ссылка для удобства

	// --- Конфигурация ---
	PlanApp.config = {
		supabaseUrl: 'https://qcimhjjwvsbgjsitmvuh.supabase.co',
		supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10',
		GEMINI_API_KEY: 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs', // !!! БЕЗОПАСНОСТЬ: Переместить на сервер !!!
		GEMINI_API_URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs`, // Строка ключа вставлена прямо здесь
		PLAN_GENERATION_COOLDOWN_DAYS: 7, // Кулдаун для генерации плана (в днях)
		NOTIFICATION_FETCH_LIMIT: 5, // Макс. кол-во уведомлений в выпадающем списке
		MAX_GEMINI_HISTORY_TURNS: 12, // Сколько пар user/model хранить в истории для Gemini
		POINTS_ACTIVITY_COMPLETE: 5, // Баллы за выполнение активности плана
		POINTS_PLAN_COMPLETE: 50, // Баллы за завершение всего плана
	};

	// --- Глобальное Состояние ---
	PlanApp.state = {
		supabaseClient: null,
		currentUser: null,
		currentProfile: null,
		latestDiagnosticData: null, // Последние результаты диагностики
		currentStudyPlan: null,     // Текущий активный план
		currentPlanActivities: [],  // Активности текущего плана
		previousPlans: [],          // История предыдущих планов
		planCreateAllowed: false,   // Может ли пользователь создать новый план
		nextPlanCreateTime: null,   // Когда можно будет создать следующий план
		planTimerInterval: null,    // Интервал для таймера кулдауна
		currentTab: 'current',      // Активная вкладка ('current', 'history', 'create')
		lastGeneratedMarkdown: null,// Последний сгенерированный Markdown для предпросмотра
		lastGeneratedActivitiesJson: null, // Последний JSON активностей для предпросмотра/сохранения
		lastGeneratedTopicsData: null, // Последние данные тем для сохранения
		isLoading: {                // Состояния загрузки для разных секций
			current: false,
			history: false,
			create: false,
			detail: false,      // Загрузка детального вида (из истории или нового)
			schedule: false,    // Загрузка активностей для расписания
			generation: false,  // Процесс генерации AI
			notifications: false,
			saving: false       // Процесс сохранения нового плана
		},
		topicMap: {}                // TODO: Заполнить, если нужно (пока пусто)
	};

	// --- Вспомогательные функции (только те, что нужны ядру) ---
	PlanApp.formatDate = (dateString) => {
		if (!dateString) return '-';
		try {
			const date = new Date(dateString);
			// Проверка на валидность даты
			if (isNaN(date.getTime())) {
				console.warn(`Invalid date string received: ${dateString}`);
				return 'Neplatné datum';
			}
			return date.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
		} catch (e) {
			console.error(`Error formatting date string ${dateString}:`, e);
			return '-';
		}
	};

	PlanApp.getActivityTypeFromTitle = (title = "") => {
		const lower = title.toLowerCase();
		if (lower.includes('test')) return 'test';
		if (lower.includes('procvičování') || lower.includes('příklad')) return 'practice';
		if (lower.includes('řešené')) return 'example';
		if (lower.includes('cvičení')) return 'exercise';
		if (lower.includes('lekce') || lower.includes('teorie') || lower.includes('vysvětlení')) return 'theory';
		if (lower.includes('opakování') || lower.includes('shrnutí')) return 'review';
		if (lower.includes('analýza')) return 'analysis';
		return 'other'; // Default
	};

	// --- Инициализация и Аутентификация ---
	PlanApp.initializeSupabase = () => {
		const config = PlanApp.config;
		const state = PlanApp.state;
		try {
			if (!window.supabase) throw new Error("Supabase library not loaded.");
			state.supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
			console.log("[Core] Supabase client initialized.");
			return true;
		} catch (error) {
			console.error("[Core] Supabase init failed:", error);
			// Попытка показать ошибку через UI, если оно уже частично инициализировано
			if (typeof PlanApp.showGlobalError === 'function') {
				 PlanApp.showGlobalError("Chyba připojení k databázi.");
			} else {
				 alert("Kritická chyba: Nelze se připojit k databázi.");
			}
			return false;
		}
	};

	PlanApp.fetchUserProfile = async (userId) => {
		const state = PlanApp.state;
		if (!userId || !state.supabaseClient) {
			console.warn("[Core] fetchUserProfile: Missing userId or Supabase client.");
			return null; // Indicate error/inability to fetch
		}
		console.log(`[Core] Fetching profile for user ID: ${userId}`);
		try {
			const { data, error } = await state.supabaseClient
				.from('profiles')
				.select('*') // Запрашиваем все поля
				.eq('id', userId)
				.single(); // Ожидаем один результат

			if (error && error.code !== 'PGRST116') { // Игнорируем ошибку "0 rows"
				console.error(`[Core] Supabase profile fetch error for user ${userId}:`, error);
				throw error;
			}
			if (!data) {
				console.warn(`[Core] Profile not found for user ${userId}.`);
				return null;
			}
			console.log("[Core] Profile data fetched successfully.");
			return data;
		} catch (e) {
			console.error(`[Core] Exception fetching profile for user ${userId}:`, e);
			// Попытка показать ошибку через UI
			 if (typeof PlanApp.showToast === 'function') {
				 PlanApp.showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error');
			 }
			return null;
		}
	};

	// --- Логика Плана Обучения ---

	PlanApp.loadCurrentPlan = async () => {
		const state = PlanApp.state;
		const ui = PlanApp.ui; // Получаем доступ к UI из PlanApp

		if (!state.supabaseClient || !state.currentUser) {
			 console.warn("[Core LoadCurrent] Missing Supabase client or current user.");
			 return;
		}
		console.log("[Core LoadCurrent] Loading current plan...");
		// Устанавливаем состояние загрузки через UI функцию
		if (typeof PlanApp.setLoadingState === 'function') {
			PlanApp.setLoadingState('current', true);
			PlanApp.setLoadingState('schedule', true);
		}

		// Скрытие контента через UI функции
		if (ui && ui.currentPlanContent) ui.currentPlanContent.classList.remove('content-visible');
		if (ui && ui.verticalScheduleList) ui.verticalScheduleList.classList.remove('schedule-visible');
		if (ui && ui.verticalScheduleNav) ui.verticalScheduleNav.classList.remove('nav-visible');

		try {
			const { data: plans, error } = await state.supabaseClient
				.from('study_plans')
				.select('*') // Запрашиваем все поля для текущего плана
				.eq('user_id', state.currentUser.id)
				.eq('status', 'active')
				.order('created_at', { ascending: false })
				.limit(1);

			if (error) throw error;
			console.log("[Core LoadCurrent] Fetched plans:", plans);

			if (plans && plans.length > 0) {
				state.currentStudyPlan = plans[0];
				console.log("[Core LoadCurrent] Active plan found:", state.currentStudyPlan.id);
				// Вызываем функцию для показа расписания (должна быть в UI)
				if (typeof PlanApp.showVerticalSchedule === 'function') {
					await PlanApp.showVerticalSchedule(state.currentStudyPlan);
				} else {
					 console.error("[Core LoadCurrent] PlanApp.showVerticalSchedule function not found!");
				}
			} else {
				state.currentStudyPlan = null;
				console.log("[Core LoadCurrent] No active plan found. Checking diagnostic...");
				if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('schedule', false); // Останавливаем загрузку расписания
				const diagnostic = await PlanApp.getLatestDiagnostic(false); // Не показывать индикатор для этой проверки

				// Отображаем сообщения через UI функцию
				 if (typeof PlanApp.renderMessage === 'function' && ui && ui.currentPlanContent) {
					 if (diagnostic === null) {
						 PlanApp.renderMessage(ui.currentPlanContent, 'error', 'Chyba načítání diagnostiky', 'Nepodařilo se ověřit stav vašeho diagnostického testu.');
					 } else if (diagnostic) {
						 if (typeof PlanApp.renderPromptCreatePlan === 'function') {
							 PlanApp.renderPromptCreatePlan(ui.currentPlanContent);
						 } else { console.error("[Core LoadCurrent] PlanApp.renderPromptCreatePlan function not found!"); }
					 } else {
						  if (typeof PlanApp.renderNoActivePlan === 'function') {
							  PlanApp.renderNoActivePlan(ui.currentPlanContent);
						  } else { console.error("[Core LoadCurrent] PlanApp.renderNoActivePlan function not found!"); }
					 }
				 } else {
					  console.error("[Core LoadCurrent] Cannot render messages: renderMessage or UI container missing.");
				 }
			}
		} catch (error) {
			console.error("[Core LoadCurrent] Error loading current plan:", error);
			if (typeof PlanApp.renderMessage === 'function' && ui && ui.currentPlanContent) {
				PlanApp.renderMessage(ui.currentPlanContent, 'error', 'Chyba', 'Nepodařilo se načíst aktuální studijní plán.');
			}
			 if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('schedule', false);
		} finally {
			if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('current', false);
			console.log("[Core LoadCurrent] Loading finished.");
		}
	};

	PlanApp.loadPlanHistory = async () => {
		const state = PlanApp.state;
		if (!state.supabaseClient || !state.currentUser) {
			 console.warn("[Core LoadHistory] Missing Supabase client or user.");
			 return;
		}
		 if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('history', true);

		try {
			const { data: plans, error } = await state.supabaseClient
				.from('study_plans')
				.select('id, title, created_at, status, progress') // Запрашиваем только нужные поля для истории
				.eq('user_id', state.currentUser.id)
				.order('created_at', { ascending: false });

			if (error) throw error;
			state.previousPlans = plans || [];
			console.log(`[Core LoadHistory] Loaded ${state.previousPlans.length} previous plans.`);
			// Вызываем функцию рендеринга из UI
			if (typeof PlanApp.renderPlanHistory === 'function') {
				PlanApp.renderPlanHistory(state.previousPlans);
			} else {
				 console.error("[Core LoadHistory] PlanApp.renderPlanHistory function not found!");
			}
		} catch (error) {
			console.error("[Core LoadHistory] Error loading plan history:", error);
			if (typeof PlanApp.renderMessage === 'function' && PlanApp.ui && PlanApp.ui.historyPlanContent) {
				 PlanApp.renderMessage(PlanApp.ui.historyPlanContent, 'error', 'Chyba', 'Nepodařilo se načíst historii plánů.');
			}
		} finally {
			if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('history', false);
		}
	};

	PlanApp.getLatestDiagnostic = async (showLoaderFlag = true) => {
		const state = PlanApp.state;
		if (!state.currentUser || !state.supabaseClient) {
			console.warn("[Core GetDiagnostic] Missing user or Supabase client.");
			return null; // Indicate error/inability to fetch
		}
		if (showLoaderFlag && typeof PlanApp.setLoadingState === 'function') {
			PlanApp.setLoadingState('create', true); // Use 'create' loader state
		}
		try {
			console.log("[Core GetDiagnostic] Fetching latest diagnostic...");
			const { data, error } = await state.supabaseClient
				.from('user_diagnostics')
				.select('id, completed_at, total_score, total_questions, topic_results, analysis') // Get necessary fields
				.eq('user_id', state.currentUser.id)
				.order('completed_at', { ascending: false })
				.limit(1);

			if (error) throw error;
			console.log("[Core GetDiagnostic] Fetched diagnostic data:", data);
			return (data && data.length > 0) ? data[0] : false; // Return data or false if none found
		} catch (error) {
			console.error("[Core GetDiagnostic] Error fetching diagnostic:", error);
			return null; // Return null on error
		} finally {
			if (showLoaderFlag && typeof PlanApp.setLoadingState === 'function') {
				 PlanApp.setLoadingState('create', false);
			}
		}
	};

	PlanApp.checkPlanCreationAvailability = async () => {
		const state = PlanApp.state;
		const config = PlanApp.config;
		const ui = PlanApp.ui; // Access UI elements cache
		console.log("[Core CreateCheck] Starting check...");
		if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('create', true);
		if(ui && ui.createPlanContent) ui.createPlanContent.classList.remove('content-visible'); // Скрыть контент перед проверкой

		try {
			console.log("[Core CreateCheck] Fetching latest diagnostic...");
			state.latestDiagnosticData = await PlanApp.getLatestDiagnostic(false); // Не показывать отдельный лоадер здесь
			console.log("[Core CreateCheck] Diagnostic fetched:", state.latestDiagnosticData);

			// Проверка наличия диагностического теста
			if (state.latestDiagnosticData === null) { // Ошибка при получении теста
				if (typeof PlanApp.renderMessage === 'function' && ui && ui.createPlanContent) {
					 PlanApp.renderMessage(ui.createPlanContent, 'error', 'Chyba', 'Nepodařilo se ověřit váš diagnostický test.');
				}
				return;
			} else if (state.latestDiagnosticData === false) { // Тест не найден
				if (typeof PlanApp.renderNoDiagnosticAvailable === 'function' && ui && ui.createPlanContent) {
					 PlanApp.renderNoDiagnosticAvailable(ui.createPlanContent);
				} else { console.error("PlanApp.renderNoDiagnosticAvailable function not found!"); }
				return;
			}

			// Проверка кулдауна
			console.log("[Core CreateCheck] Checking cooldown...");
			const { data: latestPlan, error: planError } = await state.supabaseClient
				.from('study_plans')
				.select('created_at')
				.eq('user_id', state.currentUser.id)
				.order('created_at', { ascending: false })
				.limit(1);

			if (planError) throw planError;
			console.log("[Core CreateCheck] Cooldown check - Latest plan:", latestPlan);

			let canCreate = true;
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

			if (!ui || !ui.createPlanContent) {
				 console.error("[Core CreateCheck] Error: createPlanContent container not found!");
				 if (typeof PlanApp.showGlobalError === 'function') PlanApp.showGlobalError("Chyba zobrazení: Chybí element pro vytvoření plánu.");
				 return;
			}

			// Отображение соответствующего UI
			if (canCreate) {
				if (typeof PlanApp.renderPlanCreationForm === 'function') {
					 PlanApp.renderPlanCreationForm(ui.createPlanContent);
				} else { console.error("PlanApp.renderPlanCreationForm function not found!"); }
			} else {
				 if (typeof PlanApp.renderLockedPlanSection === 'function') {
					 PlanApp.renderLockedPlanSection(ui.createPlanContent);
				 } else { console.error("PlanApp.renderLockedPlanSection function not found!"); }
			}
		} catch (error) {
			console.error('[Core CreateCheck] Error checking plan creation availability:', error);
			 if (typeof PlanApp.renderMessage === 'function' && ui && ui.createPlanContent) {
				 PlanApp.renderMessage(ui.createPlanContent, 'error', 'Chyba', 'Nepodařilo se ověřit možnost vytvoření plánu.');
			 } else if (typeof PlanApp.showGlobalError === 'function') {
				 PlanApp.showGlobalError('Nepodařilo se ověřit možnost vytvoření plánu: ' + error.message);
			 }
		} finally {
			if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('create', false);
			console.log("[Core CreateCheck] Check finished.");
		}
	};

	PlanApp.handleActivityCompletionToggle = async (activityId, isCompleted, planId) => {
		const state = PlanApp.state;
		const config = PlanApp.config;
		if (!state.supabaseClient) {
			 console.warn("[Core ActivityToggle] Supabase client not available.");
			 return;
		}
		console.log(`[Core ActivityToggle] Toggling activity ${activityId} to ${isCompleted} in plan ${planId}`);
		try {
			const { error } = await state.supabaseClient
				.from('plan_activities')
				.update({ completed: isCompleted, updated_at: new Date().toISOString() })
				.eq('id', activityId);
			if (error) throw error;

			console.log(`[Core ActivityToggle] Activity ${activityId} status updated successfully.`);

			// Award points if completing the activity
			if (isCompleted && typeof PlanApp.awardPoints === 'function') {
				await PlanApp.awardPoints(config.POINTS_ACTIVITY_COMPLETE);
			}

			// Recalculate plan progress
			await PlanApp.updatePlanProgress(planId);

			// Check for achievements after updating progress
			 if (typeof PlanApp.checkAndAwardAchievements === 'function' && state.currentUser) {
				await PlanApp.checkAndAwardAchievements(state.currentUser.id);
			}

		} catch (error) {
			console.error(`[Core ActivityToggle] Error updating activity ${activityId}:`, error);
			if (typeof PlanApp.showToast === 'function') {
				 PlanApp.showToast('Nepodařilo se aktualizovat stav aktivity.', 'error');
			}
			// Revert UI state (checkbox) - handled in UI part
			const checkbox = document.getElementById(`vertical-activity-${activityId}`);
			const activityElement = document.querySelector(`.activity-list-item[data-activity-id="${activityId}"]`);
			if(checkbox) checkbox.checked = !isCompleted;
			if(activityElement) activityElement.classList.toggle('completed', !isCompleted);
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
			// Get total activities count
			const { count: totalCount, error: countError } = await state.supabaseClient
				.from('plan_activities')
				.select('id', { count: 'exact', head: true })
				.eq('plan_id', planId);

			// Get completed activities count
			const { count: completedCount, error: completedError } = await state.supabaseClient
				.from('plan_activities')
				.select('id', { count: 'exact', head: true })
				.eq('plan_id', planId)
				.eq('completed', true);

			if (countError || completedError) throw countError || completedError;

			const numTotal = totalCount ?? 0;
			const numCompleted = completedCount ?? 0;
			const progress = numTotal > 0 ? Math.round((numCompleted / numTotal) * 100) : 0;
			console.log(`[Core PlanProgress] Plan ${planId}: ${numCompleted}/${numTotal} completed (${progress}%)`);

			const updates = { progress: progress, updated_at: new Date().toISOString() };
			let planCompleted = false;

			// Check if all activities are completed
			if (numTotal > 0 && numCompleted === numTotal) {
				updates.status = 'completed'; // Mark plan as completed
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
			// Don't show toast here, error is likely internal
		}
	};


	// --- Генерация Плана (Gemini) ---
	// MODIFIED: Accepts learningGoal parameter
	PlanApp.generatePlanContentWithGemini = async (testData, topicsData, learningGoal = 'exam_prep') => {
		const config = PlanApp.config;
		console.log(`[Core GeminiGenerate] Starting plan generation for goal: ${learningGoal}...`);
		if (!testData || !testData.id) { throw new Error('Chybí data diagnostického testu.'); }
		if (!Array.isArray(topicsData)) { throw new Error('Chybí data o výsledcích témat.'); }
		if (!config.GEMINI_API_KEY || !config.GEMINI_API_KEY.startsWith('AIzaSy')) { throw new Error('Chybí platný Gemini API klíč.'); }

		const totalScore = testData.total_score ?? '-';
		const totalQuestions = testData.total_questions ?? '-';
		const analysis = testData.analysis || {};
		const overallAssessment = analysis.summary?.overall_assessment || 'N/A';
		const strengths = analysis.strengths?.map(s => `${s.topic} (${s.score}%)`).join(', ') || 'Nebyly identifikovány';
		const weaknesses = analysis.weaknesses?.map(w => `${w.topic} (${w.score}%)`).join(', ') || 'Nebyly identifikovány';
		const recommendations = analysis.recommendations?.join('\n- ') || 'Žádná specifická.';

		let prompt;

		// --- START: Prompt Selection Logic ---
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

# Příklad formátu výstupu:
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
		} else { // Default to 'exam_prep' or any other goal needing detailed plan
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

# Oficiální Témata Zkoušky (CERMAT): [Zde by měl být detailní seznam témat, pro stručnost vynecháno, ale AI by jej mělo znát]

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
		// --- END: Prompt Selection Logic ---

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
				if(finishReason && finishReason !== 'STOP') throw new Error(`AI dokončilo generování s důvodem: ${finishReason}.`);
				throw new Error('Prázdná odpověď od Gemini API.');
			}
			console.log("[Core GeminiGenerate] Gemini response received length:", geminiResponse.length);
			return geminiResponse; // Return the full response (Markdown + JSON)
		} catch (error) {
			console.error('[Core GeminiGenerate] Error generating plan content:', error);
			throw error; // Rethrow to be caught by the calling function
		}
	};


	PlanApp.handleSaveGeneratedPlanClick = async () => {
		const state = PlanApp.state;
		const ui = PlanApp.ui; // Get UI elements reference

		const saveButton = ui?.planActions?.querySelector('#saveGeneratedPlanBtn');

		// Используем сохраненные данные из состояния
		const markdownContent = state.lastGeneratedMarkdown;
		const activitiesArray = state.lastGeneratedActivitiesJson;
		const topicsData = state.lastGeneratedTopicsData;

		if (!state.currentUser || !state.latestDiagnosticData || !markdownContent || !state.supabaseClient) {
			 if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba: Chybí data pro uložení.', 'error');
			 if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Uložit tento plán'; }
			 return;
		}
		if (saveButton) {
			saveButton.disabled = true;
			saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...';
		}
		 if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('saving', true);

		const priorityTopics = {};
		if (topicsData && Array.isArray(topicsData)) {
			topicsData.forEach((topic, index) => {
				priorityTopics[topic.name] = { priority: index + 1, performance: topic.percentage, focus_level: topic.percentage < 50 ? 'high' : topic.percentage < 75 ? 'medium' : 'low' };
			});
		} else { console.warn("[Core SavePlan] Missing topicsData in state during save."); }

		let savedPlanId = null;
		try {
			// 1. Деактивировать существующие активные планы
			console.log("[Core SavePlan] Deactivating existing active plans...");
			const { error: deactivateError } = await state.supabaseClient
				.from('study_plans')
				.update({ status: 'inactive', updated_at: new Date().toISOString() })
				.eq('user_id', state.currentUser.id)
				.eq('status', 'active');
			if (deactivateError) throw deactivateError;
			console.log("[Core SavePlan] Existing plans deactivated.");

			// 2. Вставить новый план
			const today = new Date();
			const completionDate = new Date(today);
			completionDate.setDate(completionDate.getDate() + 7); // Оценка 7 дней

			const newPlanData = {
				user_id: state.currentUser.id,
				title: `Studijní plán (${PlanApp.formatDate(today)})`,
				subject: "Matematika", // Предполагаем Математику
				status: "active",
				diagnostic_id: state.latestDiagnosticData.id,
				plan_content_markdown: markdownContent,
				priority_topics: priorityTopics,
				estimated_completion_date: completionDate.toISOString().split('T')[0],
				progress: 0,
				is_auto_adjusted: true // AI генерирует = auto adjusted
			};
			console.log("[Core SavePlan] Inserting new plan data:", newPlanData);

			const { data: savedPlan, error: insertPlanError } = await state.supabaseClient
				.from('study_plans')
				.insert(newPlanData)
				.select('id') // Запросить ID вставленной записи
				.single(); // Ожидаем одну запись

			if (insertPlanError) throw insertPlanError;
			savedPlanId = savedPlan.id;
			console.log("[Core SavePlan] New plan saved, ID:", savedPlanId);

			// 3. Вставить активности, если доступны
			if (activitiesArray && Array.isArray(activitiesArray) && activitiesArray.length > 0) {
				 console.log(`[Core SavePlan] Preparing to insert ${activitiesArray.length} activities...`);
				const activitiesToInsert = activitiesArray.map(act => {
					if (typeof act !== 'object' || act === null) return null;
					const dayOfWeek = typeof act.day_of_week === 'number' ? act.day_of_week : parseInt(act.day_of_week, 10);
					if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) { console.warn("[Core SavePlan] Invalid day_of_week in activity:", act); return null; }

					return {
						plan_id: savedPlanId,
						day_of_week: dayOfWeek,
						time_slot: act.time_slot || null,
						title: act.title || 'Nespecifikováno',
						description: act.description || null,
						type: act.type || PlanApp.getActivityTypeFromTitle(act.title),
						completed: false
					};
				}).filter(item => item !== null);

				if (activitiesToInsert.length > 0) {
					console.log(`[Core SavePlan] Inserting ${activitiesToInsert.length} valid activities...`);
					const { error: insertActivitiesError } = await state.supabaseClient
						.from('plan_activities')
						.insert(activitiesToInsert);

					if (insertActivitiesError) {
						console.error("[Core SavePlan] Error inserting activities:", insertActivitiesError);
						if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán uložen, ale aktivity pro harmonogram selhaly.', 'warning');
					} else {
						console.log("[Core SavePlan] Activities inserted successfully.");
						if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Studijní plán a aktivity uloženy!', 'success');
					}
				} else {
					if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Plán uložen, ale nebyly nalezeny platné aktivity v JSON.', 'warning');
				}
			} else {
				 if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Studijní plán uložen (bez detailních aktivit).', 'info');
			}

			 // Очистить сгенерированное состояние после успешного сохранения
			 state.lastGeneratedMarkdown = null;
			 state.lastGeneratedActivitiesJson = null;
			 state.lastGeneratedTopicsData = null;

			// Обновить локальное состояние и переключиться на вкладку текущего плана
			state.currentStudyPlan = { ...newPlanData, id: savedPlanId };
			 if (typeof PlanApp.switchTab === 'function') PlanApp.switchTab('current');

		} catch (error) {
			console.error("[Core SavePlan] Error saving plan:", error);
			if (typeof PlanApp.showToast === 'function') PlanApp.showToast(`Nepodařilo se uložit plán: ${error.message}`, 'error');
			if (saveButton) { // Re-enable button on error
				saveButton.disabled = false;
				saveButton.innerHTML = '<i class="fas fa-save"></i> Uložit tento plán';
			}
		} finally {
			 if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('saving', false);
		}
	};

	// --- Уведомления (только логика ядра) ---
	PlanApp.fetchNotifications = async (userId, limit) => {
		const state = PlanApp.state;
		if (!state.supabaseClient || !userId) { console.warn("[Core Notifications] Missing Supabase or User ID."); return { unreadCount: 0, notifications: [] }; }
		console.log(`[Core Notifications] Fetching unread notifications for user ${userId}`);
		// Установка состояния загрузки обрабатывается в UI
		try {
			const { data, error, count } = await state.supabaseClient
				.from('user_notifications')
				.select('*', { count: 'exact' })
				.eq('user_id', userId)
				.eq('is_read', false)
				.order('created_at', { ascending: false })
				.limit(limit);
			if (error) throw error;
			console.log(`[Core Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`);
			return { unreadCount: count ?? 0, notifications: data || [] };
		} catch (error) {
			console.error("[Core Notifications] Exception fetching notifications:", error);
			 if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error');
			return { unreadCount: 0, notifications: [] };
		} finally {
			// Сброс состояния загрузки обрабатывается в UI
		}
	};

	PlanApp.markNotificationRead = async (notificationId) => {
		const state = PlanApp.state;
		console.log("[Core Notifications] Marking notification as read:", notificationId);
		if (!state.currentUser || !notificationId || !state.supabaseClient) return false;
		try {
			const { error } = await state.supabaseClient
				.from('user_notifications')
				.update({ is_read: true })
				.eq('user_id', state.currentUser.id)
				.eq('id', notificationId);
			if (error) throw error;
			console.log("[Core Notifications] Mark as read successful for ID:", notificationId);
			return true;
		} catch (error) {
			console.error("[Core Notifications] Mark as read error:", error);
			if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error');
			return false;
		}
	};

	PlanApp.markAllNotificationsRead = async () => {
		const state = PlanApp.state;
		console.log("[Core Notifications] Marking all as read for user:", state.currentUser?.id);
		if (!state.currentUser || !state.supabaseClient) return;
		 // Установка состояния загрузки и блокировка кнопки обрабатываются в UI
		try {
			const { error } = await state.supabaseClient
				.from('user_notifications')
				.update({ is_read: true })
				.eq('user_id', state.currentUser.id)
				.eq('is_read', false);
			if (error) throw error;
			console.log("[Core Notifications] Mark all as read successful in DB.");
			// Обновление UI вызывается из UI
			// if (typeof PlanApp.fetchAndRenderNotifications === 'function') PlanApp.fetchAndRenderNotifications();
			if (typeof PlanApp.showToast === 'function') PlanApp.showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success');
		} catch (error) {
			console.error("[Core Notifications] Mark all as read error:", error);
			if (typeof PlanApp.showToast === 'function') PlanApp.showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error');
			// Сброс состояния кнопки обрабатывается в UI
		} finally {
			 // Сброс состояния загрузки обрабатывается в UI
		}
	};

	// MODIFIED: Function to handle the generation call based on learning goal
	PlanApp.generateStudyPlan = async () => {
        const state = PlanApp.state;
        const ui = PlanApp.ui; // Access UI cache

        if (!state.latestDiagnosticData || !state.currentUser || !state.currentProfile) {
            if (typeof PlanApp.showToast === 'function') PlanApp.showToast('Chybí data pro generování.', 'error');
            return;
        }
        const learningGoal = state.currentProfile.learning_goal || 'exam_prep'; // Default to exam_prep

        // Switch view to the detail/generation section
        ui.currentPlanSection?.classList.remove('visible-section');
        ui.historyPlanSection?.classList.remove('visible-section');
        ui.createPlanSection?.classList.remove('visible-section');
        ui.planSection?.classList.add('visible-section'); // Show the generation/detail section

        // Clear previous generated content if any
        state.lastGeneratedMarkdown = null;
        state.lastGeneratedActivitiesJson = null;
        state.lastGeneratedTopicsData = null;

        // Handle "in development" cases
        if (learningGoal === 'math_explore' || learningGoal === 'math_accelerate') {
            console.log(`[Core GeneratePlan] Goal '${learningGoal}' is in development.`);
            if (ui && ui.planContent && typeof PlanApp.renderMessage === 'function') {
                PlanApp.renderMessage(ui.planContent, 'info', 'V přípravě', 'Tato funkce studijního plánu je momentálně ve vývoji.');
            }
            if (ui && ui.planSectionTitle) ui.planSectionTitle.textContent = 'Funkce ve vývoji';
            if (ui && ui.planActions) ui.planActions.innerHTML = ''; // No actions
            if (ui && ui.planSection) ui.planSection.scrollIntoView({ behavior: 'smooth' });
             if (ui && ui.genericBackBtn) ui.genericBackBtn.onclick = () => PlanApp.switchTab('create'); // Set back button for this context
            return; // Stop execution for these goals
        }

        // Proceed with generation for 'exam_prep' or 'math_review'
        if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('generation', true);
        if (ui && ui.planContent) { ui.planContent.innerHTML = ''; ui.planContent.classList.remove('content-visible', 'generated-reveal'); }
        if (ui && ui.planActions) ui.planActions.style.display = 'none';
        if (ui && ui.planSectionTitle) ui.planSectionTitle.textContent = 'Generování plánu...';
        if (ui && ui.genericBackBtn) ui.genericBackBtn.onclick = () => PlanApp.switchTab('create'); // Set back button

        try {
            const topicsData = Object.entries(state.latestDiagnosticData.topic_results || {}).map(([topicKey, data]) => ({ name: data.name || state.topicMap[topicKey] || `Téma ${topicKey}`, percentage: data.score || 0 })).sort((a, b) => a.percentage - b.percentage);
            state.lastGeneratedTopicsData = topicsData; // Store topics

            // Call Gemini with the appropriate goal
            const fullMarkdownResponse = await PlanApp.generatePlanContentWithGemini(state.latestDiagnosticData, topicsData, learningGoal);

            // Parse JSON (same logic as before)
            const jsonRegex = /```json\s*([\s\S]*?)\s*```/; const jsonMatch = fullMarkdownResponse.match(jsonRegex);
            let activitiesArray = null; let planMarkdownForStorage = fullMarkdownResponse;
            if (jsonMatch && jsonMatch[1]) {
                try { activitiesArray = JSON.parse(jsonMatch[1].replace(/\u00A0/g, ' ').trim()); planMarkdownForStorage = fullMarkdownResponse.replace(jsonRegex, '').trim(); state.lastGeneratedActivitiesJson = activitiesArray; }
                catch (e) { console.error("Error parsing JSON activities:", e); if(typeof PlanApp.showToast === 'function') PlanApp.showToast("Warning: Nepodařilo se zpracovat aktivity z plánu.", "warning"); state.lastGeneratedActivitiesJson = null; }
            } else { console.warn("JSON block of activities not found."); state.lastGeneratedActivitiesJson = null; }
            state.lastGeneratedMarkdown = planMarkdownForStorage;

            // Update UI (same logic as before)
            if(ui && ui.planSectionTitle) ui.planSectionTitle.textContent = 'Návrh studijního plánu';
            if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('generation', false);
            if(ui && ui.planContent && typeof PlanApp.displayPlanContent === 'function') {
                PlanApp.displayPlanContent(state.lastGeneratedMarkdown);
                requestAnimationFrame(() => { if (ui.planContent) { ui.planContent.classList.add('content-visible', 'generated-reveal'); } });
            }
            if(typeof PlanApp.renderPreviewActions === 'function') PlanApp.renderPreviewActions();
            if (ui && ui.planSection) ui.planSection.scrollIntoView({ behavior: 'smooth' });
            if (typeof PlanApp.initTooltips === 'function') PlanApp.initTooltips();

        } catch (error) {
            console.error('[Core GeneratePlan] Plan generation error:', error);
            if (typeof PlanApp.setLoadingState === 'function') PlanApp.setLoadingState('generation', false);
            if (ui && ui.planContent && typeof PlanApp.renderMessage === 'function') {
                PlanApp.renderMessage(ui.planContent, 'error', 'Chyba generování', error.message);
                ui.planContent.classList.add('content-visible');
            }
             if (typeof PlanApp.renderPreviewActions === 'function') PlanApp.renderPreviewActions(true); // Show only regenerate on error
        }
    };


	console.log("plan-core.js loaded and PlanApp initialized.");

})(); // Конец IIFE