// main.js for dashboard/procvicovani/main.html
// Version: 23.8 - Use dashboardReady event data, check for elements, robust error handling

(function() { // Start IIFE
    'use strict';

    // --- Global variables for this script's scope ---
    let supabase = null;        // Populated by dashboardReady
    let currentUser = null;     // Populated by dashboardReady
    let currentProfile = null;  // Populated by dashboardReady
    let userStatsData = null;   // Populated by dashboardReady event
    let diagnosticResultsData = []; // Populated by loadPageData
    let testsChartInstance = null;    // Chart.js instance
    let topicProgressData = [];     // Populated by loadPageData
    let studyPlanData = null;       // Populated by loadPageData
    let planActivitiesData = [];    // Populated by loadPageData
    let isLoading = {           // Loading states for different sections
        stats: false,
        tests: false,
        plan: false,
        topics: false,
        notifications: false // Keep consistent with dashboard.js usage in helpers
    };

    // --- Cache UI elements specific to this page ---
    // Cached after DOM is ready
    const ui = {};

    function cacheDOMElements() {
        console.log("[Procvičování Cache DOM] Caching elements...");
        const ids = [
             // Elements likely inherited/managed by dashboard.js (cache anyway for potential use)
             'initialLoader', 'sidebarOverlay', 'mainContent', 'sidebar', 'mainMobileMenuToggle',
             'sidebarCloseToggle', 'sidebarAvatar', 'sidebarName', 'sidebarUserTitle',
             'dashboardHeader', 'refreshDataBtn', 'notificationBell', 'notificationCount',
             'notificationsDropdown', 'notificationsList', 'noNotificationsMsg', 'markAllReadBtn',
             'toastContainer', 'globalError', 'offlineBanner', 'currentYearSidebar',
             'currentYearFooter', 'mouseFollower', 'sidebarToggleBtn',

            // Elements specific to procvicovani/main.html
            'content-tabs', 'practice-tab', 'test-results-tab', 'study-plan-tab', 'topic-analysis-tab',
            'diagnostic-prompt', 'start-test-btn-prompt',

            // Practice Tab Content
            'stats-cards', // <<< Container for stats
            'stats-completed', 'stats-completed-change', 'stats-avg-score', 'stats-avg-score-change',
            'stats-time-spent', 'stats-time-change', 'stats-weakest-topic',

            // Test Results Tab Content
            'test-results-container', 'test-results-loading', 'test-results-content', // <<< Container for results
            'test-results-empty', 'start-test-btn-results', 'test-stats', 'testsChart',
            'last-test-result', 'test-history',

            // Study Plan Tab Content
            'study-plan-container', 'study-plan-loading', 'study-plan-content', // <<< Container for plan
            'study-plan-empty', 'start-test-btn-plan', 'main-plan-schedule',

            // Topic Analysis Tab Content
            'topic-analysis-container', 'topic-analysis-loading', 'topic-analysis-content', // <<< Container for topics
            'topic-analysis-empty', 'start-test-btn-analysis', 'topic-grid'
        ];
        const notFound = [];
        ids.forEach(id => {
            const element = document.getElementById(id);
            const key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
            if (element) {
                ui[key] = element;
            } else {
                // Only warn if the element is crucial for THIS page's core functionality
                const coreElements = ['contentTabs', 'practiceTab', 'testResultsTab', 'studyPlanTab', 'topicAnalysisTab', 'statsCards', 'testResultsContent', 'studyPlanContent', 'topicAnalysisContent'];
                if (coreElements.includes(key)) {
                    console.warn(`[Procvičování Cache DOM] Crucial element '${id}' not found.`);
                }
                notFound.push(id);
                ui[key] = null; // Set to null if not found
            }
        });
        if (notFound.length > 0) {
             console.log(`[Procvičování Cache DOM] Elements not found: (${notFound.length}) ['${notFound.join("', '")}']`);
        }
        // Also cache tab content containers by their IDs
        ui.practiceTabContent = document.getElementById('practice-tab');
        ui.testResultsTabContent = document.getElementById('test-results-tab');
        ui.studyPlanTabContent = document.getElementById('study-plan-tab');
        ui.topicAnalysisTabContent = document.getElementById('topic-analysis-tab');
        console.log("[Procvičování Cache DOM] Caching complete.");
    }


    // Maps (copied from previous version, keep for rendering)
    const topicIcons = { "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon", "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar", "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar", "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage", "default": "fa-book" };
    const activityVisuals = { test: { name: 'Test', icon: 'fa-vial', class: 'test' }, exercise: { name: 'Cvičení', icon: 'fa-pencil-alt', class: 'exercise' }, badge: { name: 'Odznak', icon: 'fa-medal', class: 'badge' }, diagnostic: { name: 'Diagnostika', icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { name: 'Lekce', icon: 'fa-book-open', class: 'lesson' }, plan_generated: { name: 'Plán', icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { name: 'Postup', icon: 'fa-level-up-alt', class: 'level_up' }, other: { name: 'Jiná', icon: 'fa-info-circle', class: 'other' }, default: { name: 'Aktivita', icon: 'fa-check-circle', class: 'default' } };

    // --- Helper Functions (mostly rely on dashboard.js or are simple UI utils) ---
    // Use helper functions defined in dashboard.js if available, otherwise define minimal versions here if needed
    // Assuming dashboard.js defines: showToast, showError, hideError, sanitizeHTML, getInitials, formatDate, formatTime, formatRelativeTime, openMenu, closeMenu, updateOnlineStatus, initTooltips, updateCopyrightYear, initMouseFollower, initScrollAnimations, initHeaderScrollDetection
    const showToast = window.showToast || function(t,m,ty){ console.log(`[Toast Fallback] ${ty}: ${t} - ${m}`); };
    const showError = window.showError || function(m,g){ console.error(`[Error Fallback] Global=${g}: ${m}`); if(g && ui.globalError) { ui.globalError.innerHTML = `<p>${m}</p>`; ui.globalError.style.display = 'block'; }};
    const hideError = window.hideError || function(){ if(ui.globalError) ui.globalError.style.display = 'none'; };
    const sanitizeHTML = window.sanitizeHTML || function(s){ return s || ''; };
    const formatDate = window.formatDate || function(d){ return d ? new Date(d).toLocaleDateString('cs-CZ') : '-'; };
    const formatTime = window.formatTime || function(s){ return s ? `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}` : '--:--'; };
    const formatRelativeTime = window.formatRelativeTime || function(t){ return t ? new Date(t).toLocaleString('cs-CZ') : '-'; };
    const initTooltips = window.initTooltips || function(){ console.warn("initTooltips function not found."); };
    const updateCopyrightYear = window.updateCopyrightYear || function(){ console.warn("updateCopyrightYear function not found."); };
    const initMouseFollower = window.initMouseFollower || function(){ console.warn("initMouseFollower function not found."); };
    const initScrollAnimations = window.initScrollAnimations || function(){ console.warn("initScrollAnimations function not found."); };
    const initHeaderScrollDetection = window.initHeaderScrollDetection || function(){ console.warn("initHeaderScrollDetection function not found."); };
    const updateOnlineStatus = window.updateOnlineStatus || function(){ console.warn("updateOnlineStatus function not found."); };
    const openMenu = window.openMenu || function(){ console.warn("openMenu function not found."); };
    const closeMenu = window.closeMenu || function(){ console.warn("closeMenu function not found."); };


    // --- Loading State Management ---
    function setLoadingState(section, isLoadingFlag) {
        if (isLoading[section] === isLoadingFlag && section !== 'all') return;
        if (section === 'all') { Object.keys(isLoading).forEach(key => setLoadingState(key, isLoadingFlag)); return; }

        isLoading[section] = isLoadingFlag;
        console.log(`[Procvičování UI Loading] Section: ${section}, isLoading: ${isLoadingFlag}`);

        const sectionMap = {
            stats: { container: ui.statsCards, loader: null, empty: null }, // Stats might just use card loading class
            tests: { container: ui.testResultsContainer, content: ui.testResultsContent, empty: ui.testResultsEmpty, loader: ui.testResultsLoading },
            plan: { container: ui.studyPlanContainer, content: ui.studyPlanContent, empty: ui.studyPlanEmpty, loader: ui.studyPlanLoading },
            topics: { container: ui.topicAnalysisContainer, content: ui.topicAnalysisContent, empty: ui.topicAnalysisEmpty, loader: ui.topicAnalysisLoading },
            notifications: { container: ui.notificationsList, empty: ui.noNotificationsMsg, loader: null }
        };

        const config = sectionMap[section];
        if (!config && section !== 'notifications') {
            console.warn(`[Procvičování UI Loading] Unknown section '${section}'.`);
            return;
        }

        // Handle loaders
        if (config?.loader) {
            config.loader.style.display = isLoadingFlag ? 'flex' : 'none';
        }

        // Handle content visibility and skeletons
        if (isLoadingFlag) {
            if (config?.content) config.content.style.display = 'none';
            if (config?.empty) config.empty.style.display = 'none';

            // Render skeletons into the *content* container
            if (section === 'tests' && config?.content) renderTestSkeletons(config.content);
            else if (section === 'plan' && config?.content) renderPlanSkeletons(config.content);
            else if (section === 'topics' && config?.content) renderTopicSkeletons(config.content);
            else if (section === 'stats' && config?.container) renderStatsSkeletons(config.container); // Render into stats card container
            else if (section === 'notifications' && config?.container && typeof renderNotificationSkeletons === 'function') {
                 renderNotificationSkeletons(2); // Assuming this function exists (from dashboard.js or defined here)
             }
        } else {
             // Determine if content exists AFTER loading finishes
             let hasContent = false;
             if (section === 'tests') hasContent = diagnosticResultsData && diagnosticResultsData.length > 0;
             else if (section === 'plan') hasContent = !!studyPlanData; // Check if plan object exists
             else if (section === 'topics') hasContent = topicProgressData && topicProgressData.length > 0;
             else if (section === 'stats') hasContent = !!userStatsData; // Check if stats object exists

             if (config && section !== 'notifications') {
                 // Show content or empty state based on hasContent
                 if (config.content) config.content.style.display = hasContent ? 'block' : 'none';
                 if (config.empty) config.empty.style.display = hasContent ? 'none' : 'block';
                 // If stats section finished loading, remove loading class from cards
                 if (section === 'stats' && config.container) {
                     config.container.classList.remove('loading');
                     // Ensure skeletons are cleared if actual cards were rendered
                     if(hasContent) config.container.querySelectorAll('.loading-skeleton').forEach(sk => sk.remove());
                 }
             }
             // Handle notifications empty state
             if (section === 'notifications' && config?.container && config?.empty) {
                 config.empty.style.display = config.container.innerHTML.trim() === '' ? 'block' : 'none';
             }
        }
    }

    // --- Skeleton Rendering Functions (Specific for this page) ---
    function renderStatsSkeletons(container) {
         if (!container) return;
         container.innerHTML = ''; // Clear first
         for (let i = 0; i < 4; i++) { // Assuming 4 stats cards
             container.innerHTML += `
                 <div class="dashboard-card card loading">
                     <div class="loading-skeleton">
                         <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 1rem;"></div>
                         <div class="skeleton" style="height: 35px; width: 40%; margin-bottom: 0.8rem;"></div>
                         <div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 1.5rem;"></div>
                         <div class="skeleton" style="height: 14px; width: 50%;"></div>
                     </div>
                 </div>`;
         }
         container.classList.add('loading');
     }
    function renderTestSkeletons(container) { if (!container) return; container.innerHTML = `<div class="test-stats loading"><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder" style="width: 50px; height: 50px;"></div><div style="flex-grow: 1;"><div class="skeleton value" style="width: 50px; height:28px;"></div><div class="skeleton text" style="width: 80px; height:14px;"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder" style="width: 50px; height: 50px;"></div><div style="flex-grow: 1;"><div class="skeleton value" style="width: 45px; height:28px;"></div><div class="skeleton text" style="width: 70px; height:14px;"></div></div></div></div><div class="stats-card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder" style="width: 50px; height: 50px;"></div><div style="flex-grow: 1;"><div class="skeleton value" style="width: 55px; height:28px;"></div><div class="skeleton text" style="width: 75px; height:14px;"></div></div></div></div></div><div class="chart-container loading"><div class="skeleton" style="height: 350px; width: 100%;"></div></div><div class="last-test-result card loading"><div class="loading-skeleton"><div class="skeleton title" style="width: 40%;"></div><div class="skeleton text" style="width: 30%;"></div></div></div><div class="test-list loading"><div class="skeleton" style="height: 70px; width: 100%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 70px; width: 100%;"></div></div>`; }
    function renderPlanSkeletons(container) { if (!container) return; container.innerHTML = `<div class="schedule-grid loading"><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 40%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 50%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div></div></div><div class="schedule-day card loading"><div class="loading-skeleton" style="padding: 1.5rem;"><div class="skeleton" style="height: 24px; width: 45%; margin-bottom: 1rem;"></div><div class="skeleton" style="height: 50px; width: 100%; margin-bottom: 0.8rem;"></div><div class="skeleton" style="height: 50px; width: 100%;"></div></div></div></div>`; }
    function renderTopicSkeletons(container) { if (!container) return; container.innerHTML = `<div class="topic-grid loading"><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div><div class="topic-card card loading"><div class="loading-skeleton"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text-short"></div></div></div></div></div>`; }
    function renderNotificationSkeletons(count = 2) { if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; }
    function renderShortcuts() { /* Simplified - dashboard.js should handle shortcuts if they exist on this page */ console.log("[RenderShortcuts] Rendering shortcuts (if container exists)..."); if (!ui.shortcutsGrid) { console.warn("Shortcuts grid container not found."); return; }; ui.shortcutsGrid.innerHTML = ` <div class="shortcut-card card" data-animate style="--animation-order: 7;"> <div class="shortcut-icon"><i class="fas fa-dumbbell"></i></div> <h3 class="shortcut-title">Spustit Výuku (AI)</h3> <p class="shortcut-desc">Začněte novou lekci s AI Tutorem na základě vašeho plánu.</p> <a href="/dashboard/procvicovani/vyuka/vyuka.html" class="btn btn-primary btn-sm" style="margin-top: auto;">Spustit</a> </div> <div class="shortcut-card card" data-animate style="--animation-order: 8;"> <div class="shortcut-icon"><i class="fas fa-vial"></i></div> <h3 class="shortcut-title">Diagnostický Test</h3> <p class="shortcut-desc">Ověřte své znalosti a získejte personalizovaný plán.</p> <a href="/dashboard/procvicovani/test1.html" class="btn btn-secondary btn-sm" style="margin-top: auto;">Spustit</a> </div> `; ui.shortcutsGrid.classList.remove('loading'); initScrollAnimations(); } // Animate shortcuts after render

    // --- Data Fetching ---
    async function fetchDiagnosticResults(userId) { if (!supabase || !userId) return []; console.log(`[Procvičování Tests] Fetching diagnostic results for user ${userId}...`); try { const { data, error } = await supabase.from('user_diagnostics').select('id, completed_at, total_score, total_questions, time_spent').eq('user_id', userId).order('completed_at', { ascending: false }); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching diagnostic results:", err); return []; } }
    async function fetchActiveStudyPlan(userId) { if (!supabase || !userId) return null; console.log(`[Procvičování Plan] Fetching active study plan for user ${userId}...`); try { const { data: plans, error } = await supabase.from('study_plans').select('id, title, created_at').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }).limit(1); if (error) throw error; return plans?.[0] || null; } catch (err) { console.error("Error fetching active study plan:", err); return null; } }
    async function fetchPlanActivities(planId) { if (!planId || !supabase) return []; console.log(`[Procvičování Plan] Fetching activities for plan ${planId}...`); try { const { data, error } = await supabase.from('plan_activities').select('id, title, day_of_week, time_slot, completed, description, type').eq('plan_id', planId).order('day_of_week').order('time_slot'); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching plan activities:", err); return []; } }
    async function fetchTopicProgress(userId) { if (!supabase || !userId) return []; console.log(`[Procvičování Topics] Fetching topic progress for user ${userId}...`); try { const { data, error } = await supabase .from('user_topic_progress') .select(` topic_id, progress, strength, questions_attempted, questions_correct, topic:exam_topics!inner( name, subject ) `) // Correct join syntax
        .eq('user_id', userId); if (error) throw error; return data || []; } catch (err) { console.error("Error fetching topic progress:", err); return []; } }

    // --- UI Rendering ---
    function renderStatsCards(stats) {
         // Ensure the container exists
         if (!ui.statsCards) { console.warn("[Render Stats] Container #stats-cards not found."); setLoadingState('stats', false); return; }
         console.log("[Render Stats] Rendering stats cards with data:", stats);
         if (!stats) { renderStatsSkeletons(ui.statsCards); return; }

        // Find weakest topic name from fetched topic progress data if not directly in stats
         const weakestTopicName = stats.weakest_topic_name || topicProgressData?.filter(t => t.strength === 'weakness').sort((a, b) => (a.progress ?? 100) - (b.progress ?? 100))[0]?.topic?.name || '-';

         // Calculate average score from diagnostic results
         const avgScore = calculateAverageScore(diagnosticResultsData);

         // Calculate total study time
         const totalSeconds = stats.total_study_seconds ?? 0;
         const hours = Math.floor(totalSeconds / 3600);
         const minutes = Math.floor((totalSeconds % 3600) / 60);
         const timeSpentFormatted = `${hours}h ${minutes}m`;

         // Calculate completed total
         const completedTotal = (stats.completed_exercises ?? 0) + (stats.completed_tests ?? 0);

         // Prepare HTML for cards
         ui.statsCards.innerHTML = `
             <div class="dashboard-card card" data-animate style="--animation-order: 2;">
                 <div class="card-header"> <h3 class="card-title">Dokončeno</h3> </div>
                 <div class="card-content"> <div class="card-value" id="stats-completed">${completedTotal}</div> <p class="card-description">Celkový počet úkolů</p> </div>
                 <div class="card-footer" id="stats-completed-change"><i class="fas fa-check"></i> Cvičení: ${stats.completed_exercises || 0}, Testů: ${stats.completed_tests || 0}</div>
             </div>
             <div class="dashboard-card card" data-animate style="--animation-order: 3;">
                  <div class="card-header"> <h3 class="card-title">Průměrné Skóre</h3> </div>
                  <div class="card-content"> <div class="card-value" id="stats-avg-score">${avgScore}%</div> <p class="card-description">V diagnostických testech</p> </div>
                  <div class="card-footer" id="stats-avg-score-change"><i class="fas fa-poll"></i> V ${diagnosticResultsData.length} testech</div>
              </div>
              <div class="dashboard-card card" data-animate style="--animation-order: 4;">
                  <div class="card-header"> <h3 class="card-title">Čas Cvičení</h3> </div>
                  <div class="card-content"> <div class="card-value" id="stats-time-spent">${timeSpentFormatted}</div> <p class="card-description">Celkem stráveno učením</p> </div>
                  <div class="card-footer" id="stats-time-change"><i class="fas fa-hourglass-half"></i> Za celou dobu</div>
             </div>
              <div class="dashboard-card card" data-animate style="--animation-order: 5;">
                  <div class="card-header"> <h3 class="card-title">Nejslabší Téma</h3> </div>
                  <div class="card-content"> <div class="card-value" id="stats-weakest-topic" style="font-size: 1.8rem;">${sanitizeHTML(weakestTopicName)}</div> <p class="card-description">Oblast s nejnižší úspěšností</p> </div>
                  <div class="card-footer" id="stats-weakest-topic-footer"><i class="fas fa-atom"></i> Poslední analýza</div>
             </div>
         `;
         ui.statsCards.classList.remove('loading');
         setLoadingState('stats', false); // Mark stats loading as finished
         initScrollAnimations(); // Animate cards after render
     }

    function calculateAverageScore(results) { if (!results || results.length === 0) return '-'; const validScores = results.filter(r => typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0); if (validScores.length === 0) return '-'; const avgPercentage = validScores.reduce((sum, r) => sum + (r.total_score / r.total_questions) * 100, 0) / validScores.length; return Math.round(avgPercentage); }
    function renderTestResults(results) {
         // Check if required elements exist
         if (!ui.testResultsContainer || !ui.testResultsContent || !ui.testResultsEmpty || !ui.startTestBtnResults) {
             console.warn("Missing elements for renderTestResults"); setLoadingState('tests', false); return;
         }
         console.log("[Render Tests] Rendering test results:", results);
         ui.testResultsContent.innerHTML = ''; // Clear previous content

         if (!results || results.length === 0) { ui.testResultsEmpty.style.display = 'block'; ui.startTestBtnResults.style.display = 'inline-flex'; ui.testResultsContent.style.display = 'none'; }
         else { ui.testResultsEmpty.style.display = 'none'; ui.startTestBtnResults.style.display = 'inline-flex'; // Keep button visible for re-test option
             ui.testResultsContent.style.display = 'block';

             // Calculate Stats (ensure ui.testStatsContainer exists)
             const avgScore = calculateAverageScore(results);
             const validScores = results.filter(r => typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0);
             const bestScore = validScores.length > 0 ? Math.round(Math.max(...validScores.map(r => (r.total_score / r.total_questions) * 100))) : '-';
             const validTimes = results.filter(r => r.time_spent != null && typeof r.time_spent === 'number' && r.time_spent > 0);
             const avgTime = validTimes.length > 0 ? formatTime(validTimes.reduce((sum, r) => sum + r.time_spent, 0) / validTimes.length) : '--:--';
             if(ui.testStatsContainer) { ui.testStatsContainer.innerHTML = ` <div class="stats-card"> <div class="stats-icon primary"><i class="fas fa-percentage"></i></div><div class="stats-value">${avgScore}%</div><div class="stats-label">Prům. Skóre</div></div> <div class="stats-card"> <div class="stats-icon success"><i class="fas fa-trophy"></i></div><div class="stats-value">${bestScore}%</div><div class="stats-label">Nejlepší Skóre</div></div> <div class="stats-card"> <div class="stats-icon warning"><i class="fas fa-clock"></i></div><div class="stats-value">${avgTime}</div><div class="stats-label">Prům. Čas</div></div> `; }
             else { console.warn("Test stats container (#test-stats) not found."); }

             // Render Chart (ensure ui.testsChartCanvas exists)
             const chartDataPoints = results.filter(r => r.completed_at && typeof r.total_score === 'number' && typeof r.total_questions === 'number' && r.total_questions > 0).sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at)).map(r => ({ date: new Date(r.completed_at), score: Math.round((r.total_score / r.total_questions) * 100) })); // Ensure date parsing is correct
              if (ui.testsChartCanvas) {
                  renderTestChart({ labels: chartDataPoints.map(p => p.date), data: chartDataPoints.map(p => p.score) });
              } else { console.warn("Canvas element #testsChart not found."); }

             // Render Last Test Result (ensure ui.lastTestResultContainer exists)
             const lastTest = results[0];
             if (lastTest && ui.lastTestResultContainer) {
                 const scorePercent = calculateAverageScore([lastTest]);
                 ui.lastTestResultContainer.innerHTML = `<div class="test-result-header"><div class="test-result-title"><h3>Poslední Diagnostika</h3><div class="test-result-meta">Dokončeno ${formatDate(lastTest.completed_at)}</div></div><div class="test-result-score"><div class="test-result-score-value">${scorePercent}%</div><div class="test-result-score-label">(${lastTest.total_score}/${lastTest.total_questions})</div></div></div>`;
             } else if (ui.lastTestResultContainer) { ui.lastTestResultContainer.innerHTML = `<p>Žádný poslední výsledek.</p>`; }
             else { console.warn("Container for last test result (#last-test-result) not found."); }

             // Render History (ensure ui.testHistoryContainer exists)
              if (results.length > 1 && ui.testHistoryContainer) {
                  ui.testHistoryContainer.innerHTML = `<h3 class="section-subtitle">Předchozí Testy</h3>` + results.slice(1).map(test => { const scorePercentHist = calculateAverageScore([test]); const timeSpent = test.time_spent != null ? formatTime(test.time_spent) : '--:--'; return `<div class="test-item"><div class="test-info"><div class="test-icon"><i class="fas fa-clipboard-check"></i></div><div class="test-details"><h4>Diagnostický Test</h4><div class="test-meta"><span><i class="far fa-calendar"></i> ${formatDate(test.completed_at)}</span><span><i class="far fa-clock"></i> ${timeSpent}</span></div></div></div><div class="test-score">${scorePercentHist}%</div></div>`; }).join('');
              } else if (ui.testHistoryContainer) { ui.testHistoryContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Žádná další historie testů.</p>`; }
              else { console.warn("Container for test history (#test-history) not found."); }
         }
         setLoadingState('tests', false); // Mark tests loading as finished
         initScrollAnimations(); // Animate new content
     }

    function renderTestChart(chartData) { if (!ui.testsChartCanvas) { console.warn("Canvas element #testsChart not found for rendering."); return; } const container = ui.testsChartCanvas.parentElement; if (!container) { console.warn("Container for chart canvas not found."); return; } const ctx = ui.testsChartCanvas.getContext('2d'); if (testsChartInstance) testsChartInstance.destroy(); if (!chartData || !chartData.labels || !chartData.data || chartData.labels.length < 2) { ui.testsChartCanvas.style.display = 'none'; container.classList.add('loading'); container.innerHTML = `<p style='text-align: center; padding: 2rem;'>Nedostatek dat pro zobrazení grafu.</p>`; return; } ui.testsChartCanvas.style.display = 'block'; container.classList.remove('loading'); container.innerHTML = ''; container.appendChild(ui.testsChartCanvas); const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches; const gridColor = 'rgba(160, 92, 255, 0.15)'; const textColor = '#808db0'; const pointColor = '#00e0ff'; const lineColor = '#00e0ff'; const bgColor = 'rgba(0, 224, 255, 0.1)'; try { testsChartInstance = new Chart(ctx, { type: 'line', data: { labels: chartData.labels, datasets: [{ label: 'Skóre (%)', data: chartData.data, borderColor: lineColor, backgroundColor: bgColor, borderWidth: 2.5, pointBackgroundColor: pointColor, pointRadius: 4, pointHoverRadius: 6, tension: 0.3, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time', time: { unit: 'day', tooltipFormat: 'P', displayFormats: { day: 'd.M.' } }, ticks: { color: textColor, maxRotation: 0, autoSkipPadding: 15 }, grid: { display: false } }, y: { beginAtZero: true, max: 100, ticks: { stepSize: 25, color: textColor, callback: (v) => v + '%' }, grid: { color: gridColor } } }, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(6, 4, 22, 0.92)', titleColor: '#ffffff', bodyColor: '#b8c4e0', borderColor: 'rgba(160, 92, 255, 0.45)', borderWidth: 1, padding: 10, displayColors: false, callbacks: { title: (items) => { try { return dateFns.format(new Date(items[0].parsed.x), 'PPP', { locale: dateFns.locale.cs || dateFns.locale.enUS }); } catch { return 'Chyba data'; } }, label: (ctx) => `Skóre: ${ctx.parsed.y.toFixed(0)}%` } } }, interaction: { mode: 'nearest', axis: 'x', intersect: false } } }); } catch (e) { console.error("Error creating Chart instance:", e); container.innerHTML = `<p style='text-align: center; padding: 2rem; color: var(--accent-pink);'>Chyba při vykreslování grafu.</p>`; } }
    function renderStudyPlanOverview(plan, activities) {
         // Ensure elements exist
         if (!ui.studyPlanContainer || !ui.studyPlanContent || !ui.studyPlanEmpty || !ui.mainPlanScheduleGrid || !ui.startTestBtnPlan) {
             console.warn("Missing elements for renderStudyPlanOverview"); setLoadingState('plan', false); return;
         }
         console.log("[Render Plan] Rendering plan overview:", plan);
         ui.studyPlanContent.innerHTML = ''; // Clear previous content

         if (!plan) { ui.studyPlanEmpty.style.display = 'block'; ui.startTestBtnPlan.style.display = 'inline-flex'; ui.studyPlanContent.style.display = 'none'; }
         else { ui.studyPlanEmpty.style.display = 'none'; ui.startTestBtnPlan.style.display = 'none'; ui.studyPlanContent.style.display = 'block';
             ui.mainPlanScheduleGrid.innerHTML = ''; // Clear grid before rendering
             const daysOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon -> Sun
             const dayNames = { 0: 'Neděle', 1: 'Pondělí', 2: 'Úterý', 3: 'Středa', 4: 'Čtvrtek', 5: 'Pátek', 6: 'Sobota' };
             const activitiesByDay = {}; daysOrder.forEach(dayIndex => activitiesByDay[dayIndex] = []);
             (activities || []).forEach(activity => { if (activitiesByDay[activity.day_of_week] !== undefined) activitiesByDay[activity.day_of_week].push(activity); });

             daysOrder.forEach(dayIndex => {
                 const dayName = dayNames[dayIndex];
                 const dayDiv = document.createElement('div');
                 dayDiv.className = 'schedule-day card';
                 const headerDiv = document.createElement('div'); headerDiv.className = 'schedule-day-header'; headerDiv.textContent = dayName; dayDiv.appendChild(headerDiv);
                 const activitiesDiv = document.createElement('div'); activitiesDiv.className = 'schedule-activities';
                 const dayActivities = activitiesByDay[dayIndex].sort((a, b) => (a.time_slot || '99:99').localeCompare(b.time_slot || '99:99'));
                 if (dayActivities.length > 0) {
                     dayActivities.forEach(activity => {
                         const visual = activityVisuals[activity.type?.toLowerCase()] || activityVisuals.default;
                         const title = sanitizeHTML(activity.title || 'Nespecifikováno');
                         const timeSlot = activity.time_slot ? `<span>${sanitizeHTML(activity.time_slot)}</span>` : '';
                         const activityItem = document.createElement('div');
                         activityItem.className = `schedule-activity-item ${activity.completed ? 'completed' : ''}`;
                         activityItem.innerHTML = `<i class="fas ${visual.icon} activity-icon"></i><div class="activity-details"><strong>${title}</strong>${timeSlot}</div>`;
                         activitiesDiv.appendChild(activityItem);
                     });
                 } else { activitiesDiv.innerHTML = `<p class="no-activities-placeholder">Žádné aktivity</p>`; }
                 dayDiv.appendChild(activitiesDiv); ui.mainPlanScheduleGrid.appendChild(dayDiv);
             });
             // Add link to full plan only if plan exists
             ui.studyPlanContent.innerHTML += `<div class="full-plan-link-container"><a href="plan.html" class="btn btn-secondary">Zobrazit celý plán a detaily</a></div>`;
         }
         setLoadingState('plan', false); // Mark plan loading as finished
         initScrollAnimations(); // Animate new content
     }

    function renderTopicAnalysis(topics) {
         // Ensure elements exist
         if (!ui.topicAnalysisContainer || !ui.topicAnalysisContent || !ui.topicAnalysisEmpty || !ui.topicGrid || !ui.startTestBtnAnalysis) {
             console.warn("Missing elements for renderTopicAnalysis"); setLoadingState('topics', false); return;
         }
         console.log("[Render Topics] Rendering topic analysis:", topics);
         ui.topicAnalysisContent.innerHTML = ''; // Clear previous
         ui.topicGrid.innerHTML = ''; // Clear grid

         if (!topics || topics.length === 0) { ui.topicAnalysisEmpty.style.display = 'block'; ui.startTestBtnAnalysis.style.display = 'inline-flex'; ui.topicAnalysisContent.style.display = 'none'; }
         else { ui.topicAnalysisEmpty.style.display = 'none'; ui.startTestBtnAnalysis.style.display = 'none'; ui.topicAnalysisContent.style.display = 'block';
             const fragment = document.createDocumentFragment();
             topics.sort((a, b) => { const order = { 'weakness': 0, 'neutral': 1, 'strength': 2 }; return (order[a.strength] ?? 1) - (order[b.strength] ?? 1); }); // Sort by strength
             topics.forEach(topic => {
                 const topicName = topic.topic?.name || `Téma ${topic.topic_id}` || 'Neznámé téma';
                 const iconClass = topicIcons[topic.topic?.name] || topicIcons.default || 'fa-book'; // Use topic name for icon lookup
                 const strength = topic.strength || 'neutral';
                 const progress = topic.progress || 0;
                 const attempted = topic.questions_attempted || 0;
                 const correct = topic.questions_correct || 0;
                 const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
                 const accuracyClass = accuracy >= 75 ? 'high' : accuracy < 50 ? 'low' : 'medium';
                 const card = document.createElement('div');
                 card.className = `topic-card card ${strength}`;
                 card.innerHTML = `
                     <div class="topic-header">
                         <div class="topic-icon"><i class="fas ${iconClass}"></i></div>
                         <h3 class="topic-title">${sanitizeHTML(topicName)}</h3>
                     </div>
                     <div class="progress-container" title="Celkový pokrok v tématu: ${progress}%">
                         <div class="progress-bar" style="width: ${progress}%;"></div>
                     </div>
                     <div class="topic-stats">
                         <div class="topic-stat">
                             <span>Správnost otázek:</span>
                             <strong class="accuracy-value ${accuracyClass}">${accuracy}%</strong>
                         </div>
                         <div class="topic-stat">
                             <span>Zodpovězeno:</span>
                             <strong>${correct}/${attempted}</strong>
                         </div>
                     </div>`;
                 fragment.appendChild(card);
             });
             ui.topicGrid.appendChild(fragment);
         }
         setLoadingState('topics', false); // Mark topics loading as finished
         initScrollAnimations(); // Animate new content
     }


    // --- Load Page Data ---
    async function loadPageData() {
        // Ensure user and profile data are available from the dashboardReady event
        if (!currentUser || !currentProfile) {
            showError("Chyba: Nelze načíst data, chybí informace o uživateli.", true);
            setLoadingState('all', false);
            return;
        }
        console.log("🔄 [Procvičování Load Page] Loading all data for overview...");
        setLoadingState('all', true); // Set global loading state
        hideError(); // Hide previous errors

        // Render skeletons for all sections immediately
        renderStatsSkeletons(ui.statsCards);
        renderTestSkeletons(ui.testResultsContent);
        renderPlanSkeletons(ui.studyPlanContent);
        renderTopicSkeletons(ui.topicAnalysisContent);
        renderShortcuts(); // Render shortcuts immediately (or their skeletons if preferred)

        try {
            // Fetch data concurrently
            // Note: userStatsData is now populated from the dashboardReady event, no need to fetch dashboard stats again.
            const [diagnostics, plan, topics] = await Promise.all([
                fetchDiagnosticResults(currentUser.id),
                fetchActiveStudyPlan(currentUser.id),
                fetchTopicProgress(currentUser.id)
            ]);

            // Assign fetched data to global variables
            diagnosticResultsData = diagnostics || [];
            studyPlanData = plan || null;
            topicProgressData = topics || [];

            // Fetch activities only if a plan exists
            if (studyPlanData) {
                planActivitiesData = await fetchPlanActivities(studyPlanData.id);
            } else {
                planActivitiesData = [];
            }

            // --- Render sections using fetched data and data from dashboardReady event ---
            renderStatsCards(userStatsData); // Use stats from event
            renderTestResults(diagnosticResultsData);
            renderStudyPlanOverview(studyPlanData, planActivitiesData);
            renderTopicAnalysis(topicProgressData);
            // renderShortcuts(); // Already rendered above

            // Show diagnostic prompt only if no tests have been completed
            if (diagnosticResultsData.length === 0 && ui.diagnosticPrompt) {
                ui.diagnosticPrompt.style.display = 'flex';
                // Hide empty states in other tabs if prompt is shown
                if(ui.testResultsEmpty) ui.testResultsEmpty.style.display = 'none';
                if(ui.studyPlanEmpty) ui.studyPlanEmpty.style.display = 'none';
                if(ui.topicAnalysisEmpty) ui.topicAnalysisEmpty.style.display = 'none';
            } else if (ui.diagnosticPrompt) {
                ui.diagnosticPrompt.style.display = 'none';
            }

            // Ensure the default tab is active (if not already)
            const defaultTabButton = document.querySelector('.content-tab[data-tab="practice-tab"]');
            const defaultTabContent = document.getElementById('practice-tab');
            if(defaultTabButton && defaultTabContent && !defaultTabButton.classList.contains('active')) {
                 document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
                 document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                 defaultTabButton.classList.add('active');
                 defaultTabContent.classList.add('active');
            }

            console.log("✅ [Procvičování Load Page] All data loaded and rendered.");

        } catch (error) {
            console.error("❌ [Procvičování Load Page] Error loading page data:", error);
            showError(`Nepodařilo se načíst data pro stránku Procvičování: ${error.message}`, true);
            // Render empty/error states for all sections on failure
            renderStatsCards(null);
            renderTestResults([]);
            renderStudyPlanOverview(null, []);
            renderTopicAnalysis([]);
            renderShortcuts(); // Render default shortcuts
        } finally {
            setLoadingState('all', false); // Turn off all loading states
            initTooltips(); // Re-initialize tooltips for any new elements
        }
    }

    // --- Event Handlers ---
    function handleTabSwitch(event) {
        // Ensure UI elements are cached
         if (!ui.contentTabs || !ui.tabContents) { cacheDOMElements(); }
         if (!ui.contentTabs || !ui.tabContents) { console.error("Tab elements not found."); return; }

         const tabId = event.currentTarget.dataset.tab;
         console.log(`[UI TabSwitch] Switching to tab: ${tabId}`);
         ui.contentTabs.forEach(t => t.classList.remove('active'));
         ui.tabContents.forEach(c => c.classList.remove('active'));
         event.currentTarget.classList.add('active');
         const activeContent = document.getElementById(tabId);

         if (activeContent) {
             activeContent.classList.add('active');
             // Re-trigger animations for the newly activated tab content
             requestAnimationFrame(() => {
                 activeContent.querySelectorAll('[data-animate]').forEach(el => {
                     el.classList.remove('animated'); // Remove previous animation state
                     // Re-observe or directly add 'animated' - using IntersectionObserver is better
                 });
                  if (typeof initScrollAnimations === 'function') {
                      initScrollAnimations(); // Re-initialize to observe elements in the new tab
                  } else { // Fallback if function not available
                      activeContent.querySelectorAll('[data-animate]').forEach(el => el.classList.add('animated'));
                  }
             });
         } else {
             console.warn(`[UI TabSwitch] Content for tab ${tabId} not found!`);
         }
         // Scroll to top of main content area when switching tabs
         if (ui.mainContent) ui.mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function handleRefreshClick() {
         if (!currentUser || !currentProfile) {
             showToast("Chyba", "Pro obnovení je nutné se přihlásit.", "error");
             return;
         }
        if (Object.values(isLoading).some(s => s)) { showToast('Info','Data se již načítají.', 'info'); return; }
        const icon = ui.refreshDataBtn?.querySelector('i');
        const text = ui.refreshDataBtn?.querySelector('.refresh-text');
        if(ui.refreshDataBtn) ui.refreshDataBtn.disabled = true;
        if(icon) icon.classList.add('fa-spin');
        if(text) text.textContent = 'RELOADING...';
        await loadPageData(); // Reload all page data
        if(ui.refreshDataBtn) ui.refreshDataBtn.disabled = false;
        if(icon) icon.classList.remove('fa-spin');
        if(text) text.textContent = 'RELOAD';
        initTooltips(); // Re-init tooltips for potentially new elements
    }

    // --- Setup Event Listeners ---
    function setupEventListeners() {
        console.log("[Procvičování SETUP] Setting up event listeners...");
        cacheDOMElements(); // Ensure elements are cached before adding listeners

        // Use safeAddListener pattern if preferred, or direct check
        if (ui.mainMobileMenuToggle && typeof openMenu === 'function') ui.mainMobileMenuToggle.addEventListener('click', openMenu);
        if (ui.sidebarCloseToggle && typeof closeMenu === 'function') ui.sidebarCloseToggle.addEventListener('click', closeMenu);
        if (ui.sidebarOverlay && typeof closeMenu === 'function') ui.sidebarOverlay.addEventListener('click', closeMenu);
        document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992 && typeof closeMenu === 'function') closeMenu(); }); });

        if (ui.contentTabs) ui.contentTabs.forEach(tab => { tab.addEventListener('click', handleTabSwitch); });
        if (ui.refreshDataBtn) ui.refreshDataBtn.addEventListener('click', handleRefreshClick);

        // Start test buttons
        if (ui.startTestBtnPrompt) ui.startTestBtnPrompt.addEventListener('click', () => window.location.href = 'test1.html');
        if (ui.startTestBtnResults) ui.startTestBtnResults.addEventListener('click', () => window.location.href = 'test1.html');
        if (ui.startTestBtnPlan) ui.startTestBtnPlan.addEventListener('click', () => window.location.href = 'test1.html');
        if (ui.startTestBtnAnalysis) ui.startTestBtnAnalysis.addEventListener('click', () => window.location.href = 'test1.html');

        // General listeners (rely on dashboard.js or defined locally)
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus(); // Initial check
         if (ui.mainContent && typeof initHeaderScrollDetection === 'function') {
             initHeaderScrollDetection(); // Setup scroll detection
         } else if (ui.mainContent) {
              ui.mainContent.addEventListener('scroll', handleScroll, { passive: true }); // Fallback
         }
        console.log("[Procvičování SETUP] Event listeners set up.");
    }

    // --- Initialize ---
    function initializeApp() {
        console.log("[INIT Procvičování] Adding 'dashboardReady' event listener...");

        document.addEventListener('dashboardReady', async (event) => {
            console.log("[INIT Procvičování] 'dashboardReady' event received.");
            // Ensure detail and nested properties exist before assigning
            if (event?.detail?.client && event?.detail?.user && event?.detail?.profile && event?.detail?.stats) {
                supabase = event.detail.client;
                currentUser = event.detail.user;
                currentProfile = event.detail.profile;
                userStatsData = event.detail.stats; // <<< Get stats from event
                allTitles = event.detail.titles || []; // Get titles if available
                console.log(`[INIT Procvičování] User authenticated (ID: ${currentUser.id}). Profile, stats, and titles received.`);
            } else {
                console.error("[INIT Procvičování] Critical data missing from dashboardReady event detail:", event.detail);
                showError("Chyba načítání základních dat (detail eventu). Zkuste obnovit stránku.", true);
                if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300); }
                return;
            }

            try {
                cacheDOMElements(); // Cache elements for this page
                setupEventListeners(); // Set up page-specific listeners
                // Rely on dashboard.js for these if possible
                if(typeof updateCopyrightYear === 'function') updateCopyrightYear();
                // updateUserInfoUI(currentProfile, allTitles); // Update sidebar from dashboard.js event? No, rely on dashboard.js to handle its own UI.

                await loadPageData(); // Load and render page-specific data

                if (ui.mainContent) {
                    ui.mainContent.style.display = 'block'; // Show content after loading
                    requestAnimationFrame(() => { ui.mainContent.classList.add('loaded'); initScrollAnimations(); });
                }
                if (typeof initMouseFollower === 'function') initMouseFollower();
                if (typeof initTooltips === 'function') initTooltips(); // Init tooltips AFTER dynamic content is loaded

                console.log("✅ [INIT Procvičování] Page fully initialized.");

            } catch (error) {
                console.error("❌ [INIT Procvičování] Error during page-specific setup:", error);
                showError(`Chyba inicializace stránky Procvičování: ${error.message}`, true);
                if (ui.mainContent) ui.mainContent.style.display = 'block'; // Show content even on error to display global error
                setLoadingState('all', false); // Turn off loading states
            } finally {
                 // Initial loader hiding should be handled by dashboard.js now
                 if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) {
                    console.warn("[INIT Procvičování] Initial loader was still visible, hiding it.");
                     ui.initialLoader.classList.add('hidden');
                     setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 300);
                 }
            }
        }); // End of dashboardReady listener

        // Initial setup that doesn't depend on dashboardReady
        cacheDOMElements(); // Cache early to catch potential issues
        if (ui.mainContent) ui.mainContent.style.display = 'none'; // Hide main content until ready
        console.log("[INIT Procvičování] Waiting for 'dashboardReady' event...");
    }

    // --- Run ---
    // Use DOMContentLoaded to ensure the script runs after the HTML is parsed
    document.addEventListener('DOMContentLoaded', initializeApp);

})(); // End IIFE