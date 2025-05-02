// main.js for dashboard/procvicovani/main.html
// Version: 23.10 - Correct dashboardReady check (no stats), re-fetch stats, slim cache

(function() { // Start IIFE
    'use strict';

    // --- Global variables ---
    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let userStatsData = null; // Will be fetched by loadPageData
    let diagnosticResultsData = [];
    let testsChartInstance = null;
    let topicProgressData = [];
    let studyPlanData = null;
    let planActivitiesData = [];
    let isLoading = {
        stats: false,
        tests: false,
        plan: false,
        topics: false,
        notifications: false
    };

    // --- UI Elements Cache (Slimmed Down) ---
    const ui = {};

    function cacheDOMElements() {
        console.log("[Procvičování Cache DOM] Caching elements...");
        const ids = [
            // Only cache elements DIRECTLY manipulated by main.js
            'content-tabs', 'practice-tab', 'test-results-tab', 'study-plan-tab', 'topic-analysis-tab', // Tabs and their content containers
            'diagnostic-prompt', 'start-test-btn-prompt',

            // Tab Content Containers & Loaders/Empty states
            'stats-cards', // Container for stats cards (rendered into by renderStatsCards)
            'shortcuts-grid', // Container for shortcuts (rendered into by renderShortcuts)

            'test-results-container', 'test-results-loading', 'test-results-content',
            'test-results-empty', 'start-test-btn-results',

            'study-plan-container', 'study-plan-loading', 'study-plan-content',
            'study-plan-empty', 'start-test-btn-plan',
            'main-plan-schedule', // Grid within study plan content

            'topic-analysis-container', 'topic-analysis-loading', 'topic-analysis-content',
            'topic-analysis-empty', 'start-test-btn-analysis',
            'topic-grid' // Grid within topic analysis content
        ];
        const notFound = [];
        ids.forEach(id => {
            const element = document.getElementById(id);
            const key = id.replace(/-([a-z])/g, g => g[1].toUpperCase()); // kebab-case to camelCase
            if (element) {
                ui[key] = element;
            } else {
                // Only warn if the element is absolutely essential for initial function
                const essentialIds = ['contentTabs', 'statsCards', 'testResultsContent', 'studyPlanContent', 'topicAnalysisContent'];
                if (essentialIds.includes(key)) {
                     console.warn(`[Procvičování Cache DOM] Essential element #${id} not found.`);
                }
                notFound.push(id);
                ui[key] = null; // Set to null if not found
            }
        });
        // Cache tab content containers separately for clarity
        ui.practiceTabContent = document.getElementById('practice-tab');
        ui.testResultsTabContent = document.getElementById('test-results-tab');
        ui.studyPlanTabContent = document.getElementById('study-plan-tab');
        ui.topicAnalysisTabContent = document.getElementById('topic-analysis-tab');

        if (notFound.length > 0) {
             console.log(`[Procvičování Cache DOM] Elements not found: (${notFound.length}) ['${notFound.join("', '")}']`);
        }
        console.log("[Procvičování Cache DOM] Caching complete.");
    }

    // --- Maps ---
    const topicIcons = { "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon", "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar", "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar", "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book" };
    const activityVisuals = { test: { name: 'Test', icon: 'fa-vial', class: 'test' }, exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' }, badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' }, diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' }, plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' }, other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' }, default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' } };

    // --- Helper Function Fallbacks ---
    // Attempt to use globally defined functions from dashboard.js, provide fallbacks if needed
    const showToast = window.showToast || function(t,m,ty){ console.log(`[Toast Fallback] ${ty}: ${t} - ${m}`); };
    const showError = window.showError || function(m,g){ console.error(`[Error Fallback] Global=${g}: ${m}`); const ge = document.getElementById('global-error'); if(g && ge) { ge.innerHTML = `<p>${m}</p>`; ge.style.display = 'block'; } else { console.error(m); }};
    const hideError = window.hideError || function(){ const ge = document.getElementById('global-error'); if(ge) ge.style.display = 'none'; };
    const sanitizeHTML = window.sanitizeHTML || function(s){ return s || ''; };
    const formatDate = window.formatDate || function(d){ try { return d ? new Date(d).toLocaleDateString('cs-CZ') : '-'; } catch(e){return '-';} };
    const formatTime = window.formatTime || function(s){ if (isNaN(s) || s < 0) return '--:--'; const m = Math.floor(s / 60); const ss = Math.round(s % 60); return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`; };
    const formatRelativeTime = window.formatRelativeTime || function(t){ try { return t ? new Date(t).toLocaleString('cs-CZ') : '-'; } catch(e){ return '-'; } };
    const initTooltips = window.initTooltips || function(){ console.warn("initTooltips function not found."); };
    const initScrollAnimations = window.initScrollAnimations || function(){ console.warn("initScrollAnimations function not found."); };
    const initHeaderScrollDetection = window.initHeaderScrollDetection || function(){ console.warn("initHeaderScrollDetection function not found."); };
    const updateOnlineStatus = window.updateOnlineStatus || function(){ console.warn("updateOnlineStatus function not found."); };
    const openMenu = window.openMenu || function(){ console.warn("openMenu function not found."); };
    const closeMenu = window.closeMenu || function(){ console.warn("closeMenu function not found."); };
    const renderNotificationSkeletons = window.renderNotificationSkeletons || function(c) { console.warn("renderNotificationSkeletons function not found."); }
    const renderNotifications = window.renderNotifications || function(c, n) { console.warn("renderNotifications function not found."); }
    const markNotificationRead = window.markNotificationRead || async function(id) { console.warn("markNotificationRead function not found."); return false; }
    const markAllNotificationsRead = window.markAllNotificationsRead || async function() { console.warn("markAllNotificationsRead function not found."); }


    // --- Loading State Management (Specific to this page) ---
    function setLoadingState(section, isLoadingFlag) {
        if (isLoading[section] === isLoadingFlag && section !== 'all') return;
        if (section === 'all') { Object.keys(isLoading).forEach(key => setLoadingState(key, isLoadingFlag)); return; }

        isLoading[section] = isLoadingFlag;
        console.log(`[Procvičování UI Loading] Section: ${section}, isLoading: ${isLoadingFlag}`);

        const sectionMap = {
             stats: { container: ui.statsCards, loader: null, empty: null, skeletonFn: renderStatsSkeletons },
             tests: { container: ui.testResultsContainer, content: ui.testResultsContent, empty: ui.testResultsEmpty, loader: ui.testResultsLoading, skeletonFn: renderTestSkeletons },
             plan: { container: ui.studyPlanContainer, content: ui.studyPlanContent, empty: ui.studyPlanEmpty, loader: ui.studyPlanLoading, skeletonFn: renderPlanSkeletons },
             topics: { container: ui.topicAnalysisContainer, content: ui.topicAnalysisContent, empty: ui.topicAnalysisEmpty, loader: ui.topicAnalysisLoading, skeletonFn: renderTopicSkeletons },
             notifications: { container: ui.notificationsList, empty: ui.noNotificationsMsg, loader: null, skeletonFn: renderNotificationSkeletons }
         };

        const config = sectionMap[section];
        if (!config) {
            if (section !== 'shortcuts') { // Allow ignoring 'shortcuts' if needed
                 console.warn(`[Procvičování UI Loading] Unknown section '${section}'.`);
            }
            return;
        }

        // Handle Loader Element
        if (config.loader) {
            config.loader.style.display = isLoadingFlag ? 'flex' : 'none';
        } else if (section === 'stats' && config.container) {
             // Toggle loading class for stats cards container directly
             config.container.classList.toggle('loading', isLoadingFlag);
        }

        // Handle Content/Empty/Skeletons
        if (isLoadingFlag) {
            if (config.content) config.content.style.display = 'none'; // Hide content
            if (config.empty) config.empty.style.display = 'none';   // Hide empty state
            if (config.skeletonFn && (config.content || (section === 'stats' && config.container) || (section === 'notifications' && config.container))) {
                 const targetContainer = config.content || (section === 'stats' ? config.container : (section === 'notifications' ? config.container : null));
                 if (targetContainer) {
                     config.skeletonFn(targetContainer); // Render skeleton
                 }
            }
        } else {
             // Determine if content exists AFTER loading finishes
             let hasContent = false;
             if (section === 'tests') hasContent = diagnosticResultsData && diagnosticResultsData.length > 0;
             else if (section === 'plan') hasContent = !!studyPlanData;
             else if (section === 'topics') hasContent = topicProgressData && topicProgressData.length > 0;
             else if (section === 'stats') hasContent = !!userStatsData; // Check the fetched stats data

             // Show content or empty state
             if (config.content) config.content.style.display = hasContent ? 'block' : 'none';
             if (config.empty) config.empty.style.display = hasContent ? 'none' : 'block';

             // Clean up stats card loading classes/skeletons
             if (section === 'stats' && config.container) {
                 config.container.classList.remove('loading');
                  // Remove skeleton divs if content was rendered
                  if (hasContent) {
                       config.container.querySelectorAll('.loading-skeleton').forEach(sk => sk.parentElement.remove()); // Remove the parent card containing the skeleton
                  }
             }
              // Handle notifications empty state correctly
             if (section === 'notifications' && config.container && config.empty) {
                 config.empty.style.display = config.container.innerHTML.trim() === '' ? 'block' : 'none';
             }
        }
    }

    // --- Skeleton Rendering Functions ---
    function renderStatsSkeletons(container) { if (!container) return; container.innerHTML = ''; for (let i = 0; i < 4; i++) { container.innerHTML += ` <div class="dashboard-card card loading"> <div class="loading-skeleton"> <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 1rem;"></div> <div class="skeleton" style="height: 35px; width: 40%; margin-bottom: 0.8rem;"></div> <div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 1.5rem;"></div> <div class="skeleton" style="height: 14px; width: 50%;"></div> </div> </div>`; } container.classList.add('loading'); }
    function renderTestSkeletons(container) { if (!container) return; container.innerHTML = `<div class="test-stats loading"><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder" style="width: 50px; height: 50px;"></div><div style="flex-grow: 1;"><div class="skeleton value" style="width: 50px; height:28px;"></div><div class="skeleton text" style="width: 80px; height:14px;"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder" style="width: 50px; height: 50px;"></div><div style="flex-grow: 1;"><div class="skeleton value" style="width: 45px; height:28px;"></div><div class="skeleton text" style="width: 70px; height:14px;"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder" style="width: 50px; height: 50px;"></div><div style="flex-grow: 1;"><div class="skeleton value" style="width: 55px; height:28px;"></div><div class="skeleton text" style="width: 75px; height:14px;"></div></div></div></div></div><div class="chart-container loading"><div class="skeleton" style="height: 350px; width: 100%;"></div></div><div class="last-test-result card loading"><div class="loading-skeleton"><div class="skeleton title" style="width: 40%;"></div><div class="skeleton text" style="width: 30%;"></div></div></div><div class="test-list loading"><div class="skeleton" style="height: 70px; width: 100%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 70px; width: 100%;"></div></div>`; }
    function renderPlanSkeletons(container) { if (!container) return; container.innerHTML = `<div class="schedule-grid loading"><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 40%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 50%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 45%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div></div>`; }
    function renderTopicSkeletons(container) { if (!container) return; container.innerHTML = `<div class="topic-grid loading"><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div></div>`; }
    function renderShortcuts() { /* Render actual shortcuts */ if (!ui.shortcutsGrid) return; ui.shortcutsGrid.innerHTML = ` <div class="shortcut-card card" data-animate style="--animation-order: 7;"> <div class="shortcut-icon"><i class="fas fa-dumbbell"></i></div> <h3 class="shortcut-title">Spustit Výuku (AI)</h3> <p class="shortcut-desc">Začněte novou lekci s AI Tutorem na základě vašeho plánu.</p> <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Spustit</a> </div> <div class="shortcut-card card" data-animate style="--animation-order: 8;"> <div class="shortcut-icon"><i class="fas fa-vial"></i></div> <h3 class="shortcut-title">Diagnostický Test</h3> <p class="shortcut-desc">Ověřte své znalosti a získejte personalizovaný plán.</p> <a href="/dashboard/procvicovani/test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit</a> </div> `; ui.shortcutsGrid.classList.remove('loading'); initScrollAnimations(); }

    // --- Data Fetching ---
    // <<< ADDED: fetchDashboardStats to fetch stats needed for the overview tab >>>
    async function fetchDashboardStats(userId, profileData) {
         if (!supabase || !userId || !profileData) {
              console.warn("[Procvičování Stats Fetch] Missing supabase, userId, or profileData.");
              return null;
         }
         console.log(`[Procvičování Stats Fetch] Fetching dashboard stats for user ${userId}...`);
         let fetchedStats = null;
         let statsError = null;
         try {
             // Fetch stats typically shown on the main dashboard
             const { data, error } = await supabase
                 .from('user_stats')
                 .select('progress, progress_weekly, points_weekly, streak_longest, completed_tests, total_study_seconds, weakest_topic_name') // Add fields as needed
                 .eq('user_id', userId)
                 .maybeSingle(); // Use maybeSingle as the row might not exist
             fetchedStats = data;
             statsError = error;
             if (statsError) { console.warn("[Procvičování Stats Fetch] Supabase error fetching user_stats:", statsError.message); }
         } catch (error) {
             console.error("[Procvičování Stats Fetch] Exception fetching user_stats:", error);
             statsError = error; // Store the error
         }

         // Combine with profile data to create a complete stats object
         const finalStats = {
             // From user_stats or fallback to profile
             progress: fetchedStats?.progress ?? profileData.progress ?? 0,
             progress_weekly: fetchedStats?.progress_weekly ?? 0,
             points_weekly: fetchedStats?.points_weekly ?? 0,
             streak_longest: Math.max(fetchedStats?.streak_longest ?? 0, profileData.streak_days ?? 0),
             completed_tests: profileData.completed_tests ?? fetchedStats?.completed_tests ?? 0,
             total_study_seconds: fetchedStats?.total_study_seconds ?? 0,
             weakest_topic_name: fetchedStats?.weakest_topic_name ?? null, // <<< Added
             // From profile
             points: profileData.points ?? 0,
             streak_current: profileData.streak_days ?? 0,
             completed_exercises: profileData.completed_exercises ?? 0,
         };

         if (statsError && fetchedStats === null) { // Log only if fetch failed completely
             console.warn("[Procvičování Stats Fetch] Returning stats based primarily on profile due to fetch error.");
         } else {
             console.log("[Procvičování Stats Fetch] Dashboard stats fetched/compiled:", finalStats);
         }
         return finalStats;
     }
    async function fetchDiagnosticResults(userId) { if (!supabase || !userId) return []; console.log(`[Procvičování Tests] Fetching diagnostic results for user ${userId}...`); try { const { data, error } = await supabase.from('user_diagnostics').select('id, completed_at, total_score, total_questions, time_spent').eq('user_id', userId).order('completed_at', { ascending: false }); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching diagnostic results:", err); return []; } }
    async function fetchActiveStudyPlan(userId) { if (!supabase || !userId) return null; console.log(`[Procvičování Plan] Fetching active study plan for user ${userId}...`); try { const { data: plans, error } = await supabase.from('study_plans').select('id, title, created_at').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }).limit(1); if (error) throw error; return plans?.[0] || null; } catch (err) { console.error("Error fetching active study plan:", err); return null; } }
    async function fetchPlanActivities(planId) { if (!planId || !supabase) return []; console.log(`[Procvičování Plan] Fetching activities for plan ${planId}...`); try { const { data, error } = await supabase.from('plan_activities').select('id, title, day_of_week, time_slot, completed, description, type').eq('plan_id', planId).order('day_of_week').order('time_slot'); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching plan activities:", err); return []; } }
    async function fetchTopicProgress(userId) { if (!supabase || !userId) return []; console.log(`[Procvičování Topics] Fetching topic progress for user ${userId}...`); try { const { data, error } = await supabase .from('user_topic_progress') .select(` topic_id, progress, strength, questions_attempted, questions_correct, topic:exam_topics!inner( name, subject ) `) .eq('user_id', userId); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching topic progress:", err); return []; } }


    // --- UI Rendering ---
    // --- MODIFIED: renderStatsCards checks for element existence and uses correct data ---
    function renderStatsCards(stats) {
         if (!ui.statsCards) { console.warn("[Render Stats] Container #stats-cards not found."); setLoadingState('stats', false); return; } // Check container
         console.log("[Render Stats] Rendering stats cards with data:", stats);
         if (!stats) { renderStatsSkeletons(ui.statsCards); return; } // Show skeletons if no data

         // Use fetched topic progress data if available, otherwise use stats data or fallback
         const weakestTopicName = stats.weakest_topic_name || topicProgressData?.filter(t => t.strength === 'weakness').sort((a, b) => (a.progress ?? 100) - (b.progress ?? 100))[0]?.topic?.name || '-';
         const avgScore = calculateAverageScore(diagnosticResultsData); // Calculate from fetched diagnostics
         const totalSeconds = stats.total_study_seconds ?? 0;
         const hours = Math.floor(totalSeconds / 3600);
         const minutes = Math.floor((totalSeconds % 3600) / 60);
         const timeSpentFormatted = `${hours}h ${minutes}m`;
         const completedTotal = (stats.completed_exercises ?? 0) + (stats.completed_tests ?? 0);

         ui.statsCards.innerHTML = `
             <div class="dashboard-card card" data-animate style="--animation-order: 2;">
                 <div class="card-header"> <h3 class="card-title">Dokončeno</h3> </div>
                 <div class="card-content"> <div class="card-value">${completedTotal}</div> <p class="card-description">Celkový počet úkolů</p> </div>
                 <div class="card-footer"><i class="fas fa-check"></i> Cvičení: ${stats.completed_exercises || 0}, Testů: ${stats.completed_tests || 0}</div>
             </div>
             <div class="dashboard-card card" data-animate style="--animation-order: 3;">
                  <div class="card-header"> <h3 class="card-title">Průměrné Skóre</h3> </div>
                  <div class="card-content"> <div class="card-value">${avgScore}%</div> <p class="card-description">V diagnostických testech</p> </div>
                  <div class="card-footer"><i class="fas fa-poll"></i> V ${diagnosticResultsData.length} testech</div>
              </div>
              <div class="dashboard-card card" data-animate style="--animation-order: 4;">
                  <div class="card-header"> <h3 class="card-title">Čas Cvičení</h3> </div>
                  <div class="card-content"> <div class="card-value">${timeSpentFormatted}</div> <p class="card-description">Celkem stráveno učením</p> </div>
                  <div class="card-footer"><i class="fas fa-hourglass-half"></i> Za celou dobu</div>
             </div>
              <div class="dashboard-card card" data-animate style="--animation-order: 5;">
                  <div class="card-header"> <h3 class="card-title">Nejslabší Téma</h3> </div>
                  <div class="card-content"> <div class="card-value" style="font-size: 1.8rem;">${sanitizeHTML(weakestTopicName)}</div> <p class="card-description">Oblast s nejnižší úspěšností</p> </div>
                  <div class="card-footer"><i class="fas fa-atom"></i> Poslední analýza</div>
             </div>
         `;
         ui.statsCards.classList.remove('loading');
         setLoadingState('stats', false); // Mark stats loading finished
         initScrollAnimations();
     }
    function renderTestResults(results) { /* (Keep existing structure, ensure element checks) */ if (!ui.testResultsContent || !ui.testResultsEmpty || !ui.startTestBtnResults) { console.warn("Missing elements for renderTestResults"); setLoadingState('tests', false); return; } console.log("[Render Tests] Rendering test results:", results); ui.testResultsContent.innerHTML = ''; if (!results || results.length === 0) { ui.testResultsEmpty.style.display = 'block'; ui.startTestBtnResults.style.display = 'inline-flex'; ui.testResultsContent.style.display = 'none'; } else { ui.testResultsEmpty.style.display = 'none'; ui.startTestBtnResults.style.display = 'inline-flex'; ui.testResultsContent.style.display = 'block'; const avgScore = calculateAverageScore(results); const validScores = results.filter(r => typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0); const bestScore = validScores.length > 0 ? Math.round(Math.max(...validScores.map(r => (r.total_score / r.total_questions) * 100))) : '-'; const validTimes = results.filter(r => r.time_spent != null && typeof r.time_spent === 'number' && r.time_spent > 0); const avgTime = validTimes.length > 0 ? formatTime(validTimes.reduce((sum, r) => sum + r.time_spent, 0) / validTimes.length) : '--:--'; const testStatsHTML = ui.testStats ? ` <div class="stats-card"> <div class="stats-icon primary"><i class="fas fa-percentage"></i></div><div class="stats-value">${avgScore}%</div><div class="stats-label">Prům. Skóre</div></div> <div class="stats-card"> <div class="stats-icon success"><i class="fas fa-trophy"></i></div><div class="stats-value">${bestScore}%</div><div class="stats-label">Nejlepší Skóre</div></div> <div class="stats-card"> <div class="stats-icon warning"><i class="fas fa-clock"></i></div><div class="stats-value">${avgTime}</div><div class="stats-label">Prům. Čas</div></div> ` : ''; const chartCanvasHTML = ui.testsChart ? `<div class="chart-container"><canvas id="testsChart"></canvas></div>` : '<p>Graf nelze zobrazit.</p>'; const lastTest = results[0]; let lastTestHTML = '<p>Žádný poslední výsledek.</p>'; if (lastTest && ui.lastTestResult) { const scorePercent = calculateAverageScore([lastTest]); lastTestHTML = `<div class="test-result-header"><div class="test-result-title"><h3>Poslední Diagnostika</h3><div class="test-result-meta">Dokončeno ${formatDate(lastTest.completed_at)}</div></div><div class="test-result-score"><div class="test-result-score-value">${scorePercent}%</div><div class="test-result-score-label">(${lastTest.total_score}/${lastTest.total_questions})</div></div></div>`; } let historyHTML = `<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Žádná další historie testů.</p>`; if (results.length > 1 && ui.testHistory) { historyHTML = `<h3 class="section-subtitle">Předchozí Testy</h3>` + results.slice(1).map(test => { const scorePercentHist = calculateAverageScore([test]); const timeSpent = test.time_spent != null ? formatTime(test.time_spent) : '--:--'; return `<div class="test-item"><div class="test-info"><div class="test-icon"><i class="fas fa-clipboard-check"></i></div><div class="test-details"><h4>Diagnostický Test</h4><div class="test-meta"><span><i class="far fa-calendar"></i> ${formatDate(test.completed_at)}</span><span><i class="far fa-clock"></i> ${timeSpent}</span></div></div></div><div class="test-score">${scorePercentHist}%</div></div>`; }).join(''); } ui.testResultsContent.innerHTML = ` <div class="test-stats" ${ui.testStats ? '' : 'style="display:none;"'}>${testStatsHTML}</div> ${chartCanvasHTML} <div class="last-test-result card" ${ui.lastTestResult ? '' : 'style="display:none;"'}>${lastTestHTML}</div> <div class="test-list" ${ui.testHistory ? '' : 'style="display:none;"'}>${historyHTML}</div> `; if (ui.testsChart) { const chartDataPoints = results.filter(r => r.completed_at && typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0).sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at)).map(r => ({ date: new Date(r.completed_at), score: Math.round((r.total_score / r.total_questions) * 100) })); renderTestChart({ labels: chartDataPoints.map(p => p.date), data: chartDataPoints.map(p => p.score) }); } else { console.warn("Canvas element #testsChart not found."); } } setLoadingState('tests', false); initScrollAnimations(); }
    function renderStudyPlanOverview(plan, activities) { /* (Keep existing structure, ensure element checks) */ if (!ui.studyPlanContent || !ui.studyPlanEmpty || !ui.startTestBtnPlan || !ui.mainPlanScheduleGrid) { console.warn("Missing elements for renderStudyPlanOverview"); setLoadingState('plan', false); return; } console.log("[Render Plan] Rendering plan overview:", plan); ui.studyPlanContent.innerHTML = ''; ui.mainPlanScheduleGrid.innerHTML = ''; if (!plan) { ui.studyPlanEmpty.style.display = 'block'; ui.startTestBtnPlan.style.display = 'inline-flex'; ui.studyPlanContent.style.display = 'none'; } else { ui.studyPlanEmpty.style.display = 'none'; ui.startTestBtnPlan.style.display = 'none'; ui.studyPlanContent.style.display = 'block'; const daysOrder = [1, 2, 3, 4, 5, 6, 0]; const dayNames = { 0: 'Neděle', 1: 'Pondělí', 2: 'Úterý', 3: 'Středa', 4: 'Čtvrtek', 5: 'Pátek', 6: 'Sobota' }; const activitiesByDay = {}; daysOrder.forEach(dayIndex => activitiesByDay[dayIndex] = []); (activities || []).forEach(activity => { if (activitiesByDay[activity.day_of_week] !== undefined) activitiesByDay[activity.day_of_week].push(activity); }); daysOrder.forEach(dayIndex => { const dayName = dayNames[dayIndex]; const dayDiv = document.createElement('div'); dayDiv.className = 'schedule-day card'; const headerDiv = document.createElement('div'); headerDiv.className = 'schedule-day-header'; headerDiv.textContent = dayName; dayDiv.appendChild(headerDiv); const activitiesDiv = document.createElement('div'); activitiesDiv.className = 'schedule-activities'; const dayActivities = activitiesByDay[dayIndex].sort((a, b) => (a.time_slot || '99:99').localeCompare(b.time_slot || '99:99')); if (dayActivities.length > 0) { dayActivities.forEach(activity => { const visual = activityVisuals[activity.type?.toLowerCase()] || activityVisuals.default; const title = sanitizeHTML(activity.title || 'Nespecifikováno'); const timeSlot = activity.time_slot ? `<span>${sanitizeHTML(activity.time_slot)}</span>` : ''; const activityItem = document.createElement('div'); activityItem.className = `schedule-activity-item ${activity.completed ? 'completed' : ''}`; activityItem.innerHTML = `<i class="fas ${visual.icon} activity-icon"></i><div class="activity-details"><strong>${title}</strong>${timeSlot}</div>`; activitiesDiv.appendChild(activityItem); }); } else { activitiesDiv.innerHTML = `<p class="no-activities-placeholder">Žádné aktivity</p>`; } dayDiv.appendChild(activitiesDiv); ui.mainPlanScheduleGrid.appendChild(dayDiv); }); ui.studyPlanContent.innerHTML += `<div class="full-plan-link-container"><a href="plan.html" class="btn btn-secondary">Zobrazit celý plán a detaily</a></div>`; } setLoadingState('plan', false); initScrollAnimations(); }
    function renderTopicAnalysis(topics) { /* (Keep existing structure, ensure element checks) */ if (!ui.topicAnalysisContent || !ui.topicAnalysisEmpty || !ui.topicGrid || !ui.startTestBtnAnalysis) { console.warn("Missing elements for renderTopicAnalysis"); setLoadingState('topics', false); return; } console.log("[Render Topics] Rendering topic analysis:", topics); ui.topicAnalysisContent.innerHTML = ''; ui.topicGrid.innerHTML = ''; if (!topics || topics.length === 0) { ui.topicAnalysisEmpty.style.display = 'block'; ui.startTestBtnAnalysis.style.display = 'inline-flex'; ui.topicAnalysisContent.style.display = 'none'; } else { ui.topicAnalysisEmpty.style.display = 'none'; ui.startTestBtnAnalysis.style.display = 'none'; ui.topicAnalysisContent.style.display = 'block'; const fragment = document.createDocumentFragment(); topics.sort((a, b) => { const order = { 'weakness': 0, 'neutral': 1, 'strength': 2 }; return (order[a.strength] ?? 1) - (order[b.strength] ?? 1); }); topics.forEach(topic => { const topicName = topic.topic?.name || `Téma ${topic.topic_id}` || 'Neznámé téma'; const iconClass = topicIcons[topic.topic?.name] || topicIcons.default || 'fa-book'; const strength = topic.strength || 'neutral'; const progress = topic.progress || 0; const attempted = topic.questions_attempted || 0; const correct = topic.questions_correct || 0; const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0; const accuracyClass = accuracy >= 75 ? 'high' : accuracy < 50 ? 'low' : 'medium'; const card = document.createElement('div'); card.className = `topic-card card ${strength}`; card.innerHTML = ` <div class="topic-header"> <div class="topic-icon"><i class="fas ${iconClass}"></i></div> <h3 class="topic-title">${sanitizeHTML(topicName)}</h3> </div> <div class="progress-container" title="Celkový pokrok v tématu: ${progress}%"> <div class="progress-bar" style="width: ${progress}%;"></div> </div> <div class="topic-stats"> <div class="topic-stat"> <span>Správnost otázek:</span> <strong class="accuracy-value ${accuracyClass}">${accuracy}%</strong> </div> <div class="topic-stat"> <span>Zodpovězeno:</span> <strong>${correct}/${attempted}</strong> </div> </div>`; fragment.appendChild(card); }); ui.topicGrid.appendChild(fragment); } setLoadingState('topics', false); initScrollAnimations(); }

    // --- Load Page Data ---
    async function loadPageData() {
        if (!currentUser || !currentProfile) { showError("Chyba: Nelze načíst data, chybí informace o uživateli.", true); setLoadingState('all', false); return; }
        console.log("🔄 [Procvičování Load Page] Loading all data for overview...");
        setLoadingState('all', true);
        hideError();
        renderStatsSkeletons(ui.statsCards);
        renderTestSkeletons(ui.testResultsContent);
        renderPlanSkeletons(ui.studyPlanContent);
        renderTopicSkeletons(ui.topicAnalysisContent);
        renderShortcuts(); // Render shortcuts immediately

        try {
            // <<< Fetch stats FOR THIS PAGE using the function defined above >>>
             const stats = await fetchDashboardStats(currentUser.id, currentProfile);
             userStatsData = stats; // Store fetched stats globally for this script

            const [diagnostics, plan, topics] = await Promise.all([
                fetchDiagnosticResults(currentUser.id),
                fetchActiveStudyPlan(currentUser.id),
                fetchTopicProgress(currentUser.id)
            ]);
            diagnosticResultsData = diagnostics || [];
            studyPlanData = plan || null;
            topicProgressData = topics || [];
            if (studyPlanData) { planActivitiesData = await fetchPlanActivities(studyPlanData.id); }
            else { planActivitiesData = []; }

            renderStatsCards(userStatsData); // Now uses the newly fetched stats
            renderTestResults(diagnosticResultsData);
            renderStudyPlanOverview(studyPlanData, planActivitiesData);
            renderTopicAnalysis(topicProgressData);

            if (diagnosticResultsData.length === 0 && ui.diagnosticPrompt) { ui.diagnosticPrompt.style.display = 'flex'; if(ui.testResultsEmpty) ui.testResultsEmpty.style.display = 'none'; if(ui.studyPlanEmpty) ui.studyPlanEmpty.style.display = 'none'; if(ui.topicAnalysisEmpty) ui.topicAnalysisEmpty.style.display = 'none'; }
            else if (ui.diagnosticPrompt) { ui.diagnosticPrompt.style.display = 'none'; }

            const defaultTabButton = document.querySelector('.content-tab[data-tab="practice-tab"]');
            const defaultTabContent = document.getElementById('practice-tab');
            if(defaultTabButton && defaultTabContent && !defaultTabButton.classList.contains('active')) { document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); defaultTabButton.classList.add('active'); defaultTabContent.classList.add('active'); }
            console.log("✅ [Procvičování Load Page] All data loaded and rendered.");

        } catch (error) { console.error("❌ [Procvičování Load Page] Error loading page data:", error); showError(`Nepodařilo se načíst data pro stránku Procvičování: ${error.message}`, true); renderStatsCards(null); renderTestResults([]); renderStudyPlanOverview(null, []); renderTopicAnalysis([]); renderShortcuts(); }
        finally { setLoadingState('all', false); initTooltips(); }
    }

    // --- Event Handlers ---
    function handleTabSwitch(event) { if (!ui.contentTabs) { cacheDOMElements(); } if (!ui.contentTabs) return; const tabId = event.currentTarget.dataset.tab; console.log(`[UI TabSwitch] Switching to tab: ${tabId}`); ui.contentTabs.forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); event.currentTarget.classList.add('active'); const activeContent = document.getElementById(tabId); if (activeContent) { activeContent.classList.add('active'); requestAnimationFrame(() => { activeContent.querySelectorAll('[data-animate]').forEach(el => { el.classList.remove('animated'); }); if (typeof initScrollAnimations === 'function') initScrollAnimations(); else activeContent.querySelectorAll('[data-animate]').forEach(el => el.classList.add('animated')); }); } else { console.warn(`[UI TabSwitch] Content for tab ${tabId} not found!`); } if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' }); }
    async function handleRefreshClick() { if (!currentUser || !currentProfile) { showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error"); return; } if (Object.values(isLoading).some(s => s)) { showToast('Info','Data se již načítají.', 'info'); return; } const refreshBtn = document.getElementById('refresh-data-btn'); const icon = refreshBtn?.querySelector('i'); const text = refreshBtn?.querySelector('.refresh-text'); if(refreshBtn) refreshBtn.disabled = true; if(icon) icon.classList.add('fa-spin'); if(text) text.textContent = 'RELOADING...'; await loadPageData(); if(refreshBtn) refreshBtn.disabled = false; if(icon) icon.classList.remove('fa-spin'); if(text) text.textContent = 'RELOAD'; if (typeof initTooltips === 'function') initTooltips(); }

    // --- Setup Event Listeners ---
    function setupEventListeners() { console.log("[Procvičování SETUP] Setting up event listeners..."); cacheDOMElements(); const safeAddListener = (element, eventType, handler, key) => { if (element) { element.addEventListener(eventType, handler); } else { console.warn(`[SETUP] Element not found for listener: ${key}`); } }; safeAddListener(ui.mainMobileMenuToggle, 'click', openMenu, 'mainMobileMenuToggle'); safeAddListener(ui.sidebarCloseToggle, 'click', closeMenu, 'sidebarCloseToggle'); safeAddListener(ui.sidebarOverlay, 'click', closeMenu, 'sidebarOverlay'); document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992 && typeof closeMenu === 'function') closeMenu(); }); }); if(ui.contentTabs) ui.contentTabs.forEach(tab => { safeAddListener(tab, 'click', handleTabSwitch, `tab-${tab.dataset.tab}`); }); safeAddListener(document.getElementById('refresh-data-btn'), 'click', handleRefreshClick, 'refreshDataBtn'); safeAddListener(ui.startTestBtnPrompt, 'click', () => window.location.href = 'test1.html', 'startTestBtnPrompt'); safeAddListener(ui.startTestBtnResults, 'click', () => window.location.href = 'test1.html', 'startTestBtnResults'); safeAddListener(ui.startTestBtnPlan, 'click', () => window.location.href = 'test1.html', 'startTestBtnPlan'); safeAddListener(ui.startTestBtnAnalysis, 'click', () => window.location.href = 'test1.html', 'startTestBtnAnalysis'); window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus); updateOnlineStatus(); if (ui.mainContent && typeof initHeaderScrollDetection === 'function') { initHeaderScrollDetection(); } else if (ui.mainContent) { ui.mainContent.addEventListener('scroll', handleScroll, { passive: true }); } console.log("[Procvičování SETUP] Event listeners set up."); }

    // --- Initialize ---
    function initializeApp() {
        console.log("[INIT Procvičování] Adding 'dashboardReady' event listener...");
        document.addEventListener('dashboardReady', async (event) => {
            console.log("[INIT Procvičování] 'dashboardReady' event received.");
            // --- CORRECTED Check ---
            if (!event || !event.detail || !event.detail.client || !event.detail.user || !event.detail.profile) {
                 console.error("[INIT Procvičování] Critical data missing from dashboardReady event detail:", event?.detail);
                 showError("Chyba načítání základních dat (detail eventu #2). Zkuste obnovit stránku.", true);
                 // Hide loader if still visible
                 const il = document.getElementById('initial-loader');
                 if (il && !il.classList.contains('hidden')) { il.classList.add('hidden'); setTimeout(() => { if(il) il.style.display = 'none'; }, 300); }
                 return;
            }
            // --- END CORRECTED Check ---

            supabase = event.detail.client;
            currentUser = event.detail.user;
            currentProfile = event.detail.profile;
            // userStatsData = event.detail.stats; // Don't get stats from event anymore
            userStatsData = null; // Reset stats, will be fetched in loadPageData
            allTitles = event.detail.titles || [];
            console.log(`[INIT Procvičování] User authenticated (ID: ${currentUser.id}). Profile and titles received.`);

            try {
                cacheDOMElements(); // Cache elements for this page
                setupEventListeners();
                if(typeof updateCopyrightYear === 'function') updateCopyrightYear();
                // Rely on dashboard.js to update sidebar initially

                await loadPageData(); // Load and render page-specific data

                if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); }); }
                if (typeof initMouseFollower === 'function') initMouseFollower();
                if (typeof initTooltips === 'function') initTooltips();

                console.log("✅ [INIT Procvičování] Page fully initialized.");

            } catch (error) { console.error("❌ [INIT Procvičování] Error during page-specific setup:", error); showError(`Chyba inicializace stránky Procvičování: ${error.message}`, true); if (ui.mainContent) ui.mainContent.style.display = 'block'; setLoadingState('all', false); }
            finally { /* Loader handled by dashboard.js */ }
        });

        // Initial setup before dashboardReady
        cacheDOMElements(); // Cache early
        if (ui.mainContent) ui.mainContent.style.display = 'none';
        console.log("[INIT Procvičování] Waiting for 'dashboardReady' event...");
    }

    // --- Run ---
    document.addEventListener('DOMContentLoaded', initializeApp);

})(); // End IIFE