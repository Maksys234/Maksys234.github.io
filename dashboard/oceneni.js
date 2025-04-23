        // Using an immediately invoked function expression (IIFE)
        (function() {
            // --- START: Initialization and Configuration ---
            const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
            let supabase = null;
            let currentUser = null;
            let currentProfile = null; // Keep profile data
            let userBadges = [];
            let allBadges = [];
            let leaderboardData = { points: [], badges: [], streak: [] };
            let currentLeaderboardFilter = 'points';
            // Unified loading state from dashboard.html
            let isLoading = { stats: false, userBadges: false, availableBadges: false, leaderboard: false, recentBadges: false };

            // DOM Cache (adapted IDs from new HTML structure)
            const ui = {
                // Loaders & Overlays
                initialLoader: document.getElementById('initial-loader'),
                sidebarOverlay: document.getElementById('sidebar-overlay'),
                // Main Layout & Sidebar
                mainContent: document.getElementById('main-content'),
                sidebar: document.getElementById('sidebar'),
                mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
                sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
                // Sidebar Profile
                sidebarAvatar: document.getElementById('sidebar-avatar'), // Changed ID
                sidebarName: document.getElementById('sidebar-name'), // Changed ID
                currentYearSidebar: document.getElementById('currentYearSidebar'), // For footer year
                // Header
                pageTitle: document.getElementById('page-title'), // Changed ID
                refreshDataBtn: document.getElementById('refresh-data-btn'),
                // Notifications (basic structure elements)
                notificationBell: document.getElementById('notification-bell'),
                notificationCount: document.getElementById('notification-count'),
                notificationsDropdown: document.getElementById('notifications-dropdown'),
                // Global Error/Status
                globalError: document.getElementById('global-error'),
                offlineBanner: document.getElementById('offline-banner'),
                toastContainer: document.getElementById('toast-container'),
                // Achievements Content Area
                achievementsContent: document.getElementById('achievements-content'),
                // Stats Cards (using container ID)
                achievementStatsContainer: document.getElementById('achievement-stats-container'),
                // Stat Card specific elements (by ID)
                badgesCount: document.getElementById('badges-count'),
                badgesChange: document.getElementById('badges-change'),
                pointsCount: document.getElementById('points-count'),
                pointsChange: document.getElementById('points-change'),
                streakDays: document.getElementById('streak-days'),
                streakChange: document.getElementById('streak-change'),
                rankValue: document.getElementById('rank-value'),
                rankChange: document.getElementById('rank-change'),
                totalUsers: document.getElementById('total-users'),
                // Earned Badges
                userBadgesContainer: document.getElementById('user-badges-container'), // Container has card/loading class now
                badgeGrid: document.getElementById('badge-grid'),
                emptyBadges: document.getElementById('empty-badges'),
                // Available Badges
                availableBadgesContainer: document.getElementById('available-badges-container'), // Container has card/loading class now
                availableBadgesGrid: document.getElementById('available-badges-grid'),
                emptyAvailableBadges: document.getElementById('empty-available-badges'),
                // Leaderboard
                leaderboardContainer: document.getElementById('leaderboard-container'), // Container has card/loading class now
                leaderboardBody: document.getElementById('leaderboard-body'),
                leaderboardEmpty: document.getElementById('leaderboard-empty'),
                scoreHeader: document.getElementById('score-header'),
                filterButtons: document.querySelectorAll('.leaderboard-filter .filter-btn'), // Specific selector
                // Recent Badges
                recentAchievementsSection: document.getElementById('recent-achievements-section'), // Container has card/loading class now
                recentAchievementsList: document.getElementById('recent-achievements-list'),
                // Footer Year
                currentYearFooter: document.getElementById('currentYearFooter'),
                 // Mouse Follower
                 mouseFollower: document.getElementById('mouse-follower')
            };

            // Badge Visuals (adapted from Oceneni, using theme gradients)
             const badgeVisuals = {
                 math: { icon: 'fa-square-root-alt', gradient: 'var(--gradient-math)' },
                 language: { icon: 'fa-language', gradient: 'var(--gradient-lang)' },
                 streak: { icon: 'fa-fire', gradient: 'var(--gradient-streak)' },
                 special: { icon: 'fa-star', gradient: 'var(--gradient-special)' },
                 points: { icon: 'fa-coins', gradient: 'var(--gradient-warning)' },
                 exercises: { icon: 'fa-pencil-alt', gradient: 'var(--gradient-success)' },
                 test: { icon: 'fa-vial', gradient: 'var(--gradient-info)' },
                 default: { icon: 'fa-medal', gradient: 'var(--gradient-locked)' } // Default uses locked gradient
             };

            // --- START: Helper Functions (mostly from dashboard.html) ---
            function showToast(title, message, type = 'info', duration = 4500) { /* ... (Copied from dashboard.html's JS) ... */
                 if (!ui.toastContainer) return;
                  try {
                      const toastId = `toast-${Date.now()}`;
                      const toastElement = document.createElement('div');
                      toastElement.className = `toast ${type}`;
                      toastElement.id = toastId;
                      toastElement.setAttribute('role', 'alert');
                      toastElement.setAttribute('aria-live', 'assertive');
                      toastElement.innerHTML = `
                          <i class="toast-icon"></i>
                          <div class="toast-content">
                              ${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}
                              <div class="toast-message">${sanitizeHTML(message)}</div>
                          </div>
                          <button type="button" class="toast-close" aria-label="Zavřít">&times;</button>
                      `;
                      const icon = toastElement.querySelector('.toast-icon');
                      // Используем FontAwesome классы напрямую
                      icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`;
                      toastElement.querySelector('.toast-close').addEventListener('click', () => {
                          toastElement.classList.remove('show');
                          setTimeout(() => toastElement.remove(), 400);
                      });
                      ui.toastContainer.appendChild(toastElement);
                      requestAnimationFrame(() => { toastElement.classList.add('show'); });
                      setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration);
                  } catch (e) { console.error("Chyba při zobrazování toastu:", e); }
            }
            function showError(message, isGlobal = false) { /* ... (Copied from dashboard.html's JS) ... */
                  console.error("Došlo k chybě:", message);
                  if (isGlobal && ui.globalError) {
                      ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" id="global-retry-btn">Zkusit Znovu</button></div>`; // Добавлен класс btn
                      ui.globalError.style.display = 'block';
                      const retryBtn = document.getElementById('global-retry-btn');
                      // Add retry listener only if button exists
                      if (retryBtn) {
                          retryBtn.addEventListener('click', handleGlobalRetry); // Use dedicated handler
                      }
                  } else { showToast('CHYBA SYSTÉMU', message, 'error', 6000); }
            }
            function hideError() { if (ui.globalError) ui.globalError.style.display = 'none'; }
            function updateOnlineStatus() { if (ui.offlineBanner) ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; if (!navigator.onLine) showToast('Offline', 'Spojení ztraceno.', 'warning'); }
            function getInitials(userData) { /* ... (Copied from dashboard.html's JS) ... */ if (!userData) return '?'; const f = userData.first_name?.[0] || ''; const l = userData.last_name?.[0] || ''; const nameInitial = (f + l).toUpperCase(); const usernameInitial = userData.username?.[0].toUpperCase() || ''; const emailInitial = userData.email?.[0].toUpperCase() || ''; return nameInitial || usernameInitial || emailInitial || '?'; }
            function formatDate(dateString) { /* ... (Copied from original oceneni.html JS) ... */ if (!dateString) return '-'; try { const d = new Date(dateString); if (isNaN(d.getTime())) return '-'; const optionsDate = { day: 'numeric', month: 'numeric', year: 'numeric' }; return d.toLocaleDateString('cs-CZ', optionsDate); } catch (e) { console.error("Chyba formátování data:", dateString, e); return '-'; } }
            function openMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.add('active'); ui.sidebarOverlay.classList.add('active'); } }
            function closeMenu() { if (ui.sidebar && ui.sidebarOverlay) { ui.sidebar.classList.remove('active'); ui.sidebarOverlay.classList.remove('active'); } }
            function sanitizeHTML(str) { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; }
            // Updated setLoadingState to handle the new structure
            function setLoadingState(section, isLoadingFlag) {
                 const sectionsMap = {
                     stats: { container: ui.achievementStatsContainer, childrenSelector: '.stat-card' },
                     userBadges: { container: ui.userBadgesContainer },
                     availableBadges: { container: ui.availableBadgesContainer },
                     leaderboard: { container: ui.leaderboardContainer },
                     recentBadges: { container: ui.recentAchievementsSection }
                 };

                 const sectionsToUpdate = section === 'all' ? Object.keys(sectionsMap) : [section];

                 sectionsToUpdate.forEach(secKey => {
                     if (!sectionsMap[secKey] || isLoading[secKey] === isLoadingFlag) return;

                     isLoading[secKey] = isLoadingFlag;
                     console.log(`[setLoadingState] Section: ${secKey}, isLoading: ${isLoadingFlag}`);
                     const config = sectionsMap[secKey];

                     if (config.container) {
                          config.container.classList.toggle('loading', isLoadingFlag);
                          // If it's a container for multiple items (like stats)
                          if(config.childrenSelector) {
                              config.container.querySelectorAll(config.childrenSelector).forEach(child => {
                                   child.classList.toggle('loading', isLoadingFlag);
                              });
                          }
                           // Clear specific empty/error states when loading starts
                          if (isLoadingFlag) {
                              if (secKey === 'userBadges' && ui.emptyBadges) ui.emptyBadges.style.display = 'none';
                              if (secKey === 'availableBadges' && ui.emptyAvailableBadges) ui.emptyAvailableBadges.style.display = 'none';
                              if (secKey === 'leaderboard' && ui.leaderboardEmpty) ui.leaderboardEmpty.style.display = 'none';
                              if (secKey === 'recentBadges' && ui.recentAchievementsSection) ui.recentAchievementsSection.style.display = 'none'; // Hide section before loading
                          }
                     } else {
                          console.warn(`setLoadingState: Container for section "${secKey}" not found.`);
                     }
                 });
            }
            // Mouse Follower Logic (from dashboard.html)
            const initMouseFollower = () => {
                const follower = ui.mouseFollower;
                if (!follower || window.innerWidth <= 576) return; // Don't show on mobile
                let hasMoved = false;
                const updatePosition = (event) => {
                    if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; }
                    requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; });
                 };
                window.addEventListener('mousemove', updatePosition, { passive: true });
                document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; });
                document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; });
                // Hide on touch start
                window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true });
            };
            // Scroll Animations Logic (from dashboard.html)
             const initScrollAnimations = () => {
                 const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]');
                 if (!animatedElements.length || !('IntersectionObserver' in window)) {
                     console.log("Scroll animations not initialized (no elements or IntersectionObserver not supported).");
                     return;
                 }
                 const observer = new IntersectionObserver((entries, observerInstance) => {
                     entries.forEach(entry => {
                         if (entry.isIntersecting) {
                              // Add small delay based on animation order if needed
                              // const delay = (parseInt(entry.target.style.getPropertyValue('--animation-order') || 0)) * 100;
                              // setTimeout(() => { entry.target.classList.add('animated'); }, delay);
                              entry.target.classList.add('animated');
                              observerInstance.unobserve(entry.target);
                         }
                     });
                 }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); // Trigger slightly earlier
                 animatedElements.forEach(element => observer.observe(element));
                 console.log(`Scroll animations initialized for ${animatedElements.length} elements.`);
             };
             // Detect scroll for header styling (from dashboard.html)
            const initHeaderScrollDetection = () => {
                 let lastScrollY = window.scrollY;
                 const mainEl = ui.mainContent; // Scroll within main
                 if (!mainEl) return;

                 mainEl.addEventListener('scroll', () => {
                     const currentScrollY = mainEl.scrollTop;
                     if (currentScrollY > 30) { document.body.classList.add('scrolled'); }
                     else { document.body.classList.remove('scrolled'); }
                     lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
                 }, { passive: true });
                 // Initial check
                 if (mainEl.scrollTop > 30) document.body.classList.add('scrolled');
             };
             // Update Copyright Year (from dashboard.html)
             const updateCopyrightYear = () => {
                 const year = new Date().getFullYear();
                 if (ui.currentYearSidebar) { ui.currentYearSidebar.textContent = year; }
                 if (ui.currentYearFooter) { ui.currentYearFooter.textContent = year; }
             };
            // --- END: Helper Functions ---

            // --- START: Data Loading Functions ---
            async function initializeApp() {
                console.log("🚀 [Init Oceneni - Kyber] Initializing Awards Page...");
                if (!initializeSupabase()) return;

                setupUIEventListeners(); // Basic UI listeners first

                if (ui.initialLoader) { ui.initialLoader.classList.remove('hidden'); ui.initialLoader.style.display = 'flex'; }
                if (ui.mainContent) ui.mainContent.style.display = 'none';

                try {
                    console.log("[Init Oceneni - Kyber] Checking auth session...");
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                    if (sessionError) throw new Error(`Nepodařilo se ověřit přihlášení: ${sessionError.message}`);

                    if (session?.user) {
                        currentUser = session.user;
                        console.log(`[Init Oceneni - Kyber] User authenticated (ID: ${currentUser.id}). Loading data...`);

                        // Load profile first, critical for other fetches and UI
                        currentProfile = await fetchUserProfile(currentUser.id);
                        if (!currentProfile) throw new Error("Nepodařilo se načíst profil uživatele.");

                        updateSidebarProfile(currentProfile); // Update sidebar immediately

                        // Hide loader, show content
                        if (ui.initialLoader) { ui.initialLoader.classList.add('hidden'); setTimeout(() => { if (ui.initialLoader) ui.initialLoader.style.display = 'none'; }, 500); } // Cyber fade out
                        if (ui.mainContent) { ui.mainContent.style.display = 'block'; requestAnimationFrame(() => ui.mainContent.classList.add('loaded')); }

                        await loadAllAwardData(); // Load the rest of the data

                        console.log("✅ [Init Oceneni - Kyber] Page fully loaded and initialized.");

                        // Initialize animations after content structure is likely ready
                         requestAnimationFrame(() => {
                            initScrollAnimations();
                            initMouseFollower();
                            initHeaderScrollDetection();
                            updateCopyrightYear();
                         });

                    } else {
                        console.log("[Init Oceneni - Kyber] User not logged in. Redirecting...");
                        window.location.href = '/auth/index.html'; // Redirect to login
                    }
                } catch (error) {
                    console.error("❌ [Init Oceneni - Kyber] Critical initialization error:", error);
                    if (ui.initialLoader && !ui.initialLoader.classList.contains('hidden')) {
                        ui.initialLoader.innerHTML = `<p style="color: var(--accent-pink);">CHYBA SYSTÉMU (${error.message}). OBNOVTE STRÁNKU.</p>`;
                    } else { showError(`Chyba při inicializaci: ${error.message}`, true); }
                    if (ui.mainContent) ui.mainContent.style.display = 'none';
                }
            }
            function initializeSupabase() { /* ... (Copied from dashboard.html's JS) ... */ try { if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { throw new Error("Knihovna Supabase nebyla správně načtena."); } supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); if (!supabase) throw new Error("Vytvoření klienta Supabase selhalo."); console.log('[Supabase] Klient úspěšně inicializován.'); return true; } catch (error) { console.error('[Supabase] Inicializace selhala:', error); showError("Kritická chyba: Nepodařilo se připojit k databázi.", true); return false; } }
            async function fetchUserProfile(userId) { /* ... (Select fields needed for awards progress) ... */
                 if (!supabase || !userId) return null;
                 console.log(`[Profile] Fetching profile for user ID: ${userId}`);
                 try {
                     // Select fields needed for sidebar AND for badge progress calculation
                     const { data: profile, error } = await supabase
                         .from('profiles')
                         .select('id, first_name, last_name, username, avatar_url, points, streak_days, badges_count, level, completed_exercises, created_at') // Add necessary fields
                         .eq('id', userId)
                         .single();

                     if (error && error.code !== 'PGRST116') { throw error; } // Allow empty result without error
                     if (!profile) { console.warn(`[Profile] Profile not found for user ${userId}.`); return null; }

                     console.log("[Profile] Profile data fetched successfully.");
                     return profile;
                 } catch (error) {
                     console.error('[Profile] Caught exception fetching profile:', error);
                     showToast('Chyba', 'Nepodařilo se načíst data profilu.', 'error');
                     return null;
                 }
             }
            /** Loads all data for the awards page concurrently. */
            async function loadAllAwardData() {
                if (!currentUser || !supabase || !currentProfile) { showError("Nelze načíst data: Chybí informace o uživateli nebo spojení.", true); return; }
                console.log("🔄 [LoadAwards] Starting data fetch...");
                hideError();
                 // Set loading states using the new function
                 setLoadingState('all', true);

                try {
                    const results = await Promise.allSettled([
                        // fetchUserStats is less critical now if profile has basic stats
                        fetchAllBadgesDefinition(),
                        fetchUserEarnedBadges(currentUser.id),
                        fetchLeaderboardData(currentLeaderboardFilter)
                        // fetchUserStats can be added back if 'user_stats' table has unique info
                    ]);
                    console.log("[LoadAwards] Fetch results (settled):", results);

                    let fetchedAllBadges = null, fetchedUserBadges = null, fetchedLeaderboard = null;

                    // Process All Badges Definition
                    if (results[0].status === 'fulfilled') { fetchedAllBadges = results[0].value; allBadges = fetchedAllBadges || []; }
                    else { console.error("❌ Error fetching all badges:", results[0].reason); showError("Nepodařilo se načíst definice odznaků."); allBadges = []; }

                    // Process User Earned Badges
                    if (results[1].status === 'fulfilled') { fetchedUserBadges = results[1].value; userBadges = fetchedUserBadges || []; }
                    else { console.error("❌ Error fetching user badges:", results[1].reason); showError("Nepodařilo se načíst získané odznaky."); userBadges = []; }
                     setLoadingState('userBadges', false); // Stop loading for earned badges section
                     setLoadingState('recentBadges', false); // Stop loading for recent badges section


                    // Render Available Badges (needs both allBadges and userBadges)
                    renderAvailableBadges(allBadges, userBadges, currentProfile); // Pass profile for progress
                     setLoadingState('availableBadges', false); // Stop loading for available badges section

                    // Process Leaderboard
                    if (results[2].status === 'fulfilled') { fetchedLeaderboard = results[2].value; leaderboardData[currentLeaderboardFilter] = fetchedLeaderboard || []; }
                    else { console.error("❌ Error fetching leaderboard:", results[2].reason); showError("Nepodařilo se načíst žebříček."); leaderboardData[currentLeaderboardFilter] = []; }
                    setLoadingState('leaderboard', false); // Stop loading for leaderboard section


                     // Update Stats Cards using profile and leaderboard data
                     updateStatsCards(currentProfile, userBadges, leaderboardData[currentLeaderboardFilter]);
                     setLoadingState('stats', false); // Stop loading for stats section


                    // Render sections that depend on fetched data AFTER loading state is false
                    renderUserBadges(userBadges);
                    renderRecentBadges(userBadges);
                    renderLeaderboard(leaderboardData[currentLeaderboardFilter]); // Render initial leaderboard


                } catch (error) {
                    console.error("❌ Unexpected error in loadAllAwardData:", error);
                    showError(`Nastala neočekávaná chyba: ${error.message}`, true);
                    setLoadingState('all', false); // Ensure all loading states are reset on error
                } finally {
                    console.log("🏁 [LoadAwards] Finished data fetch and processing.");
                }
            }
            async function fetchAllBadgesDefinition() { /* ... (No changes needed) ... */ console.log("[Badges] Fetching all badge definitions..."); if (!supabase) return []; try { const { data, error } = await supabase.from('badges').select('*').order('id'); if (error) throw error; console.log(`[Badges] Fetched ${data?.length || 0} badge definitions.`); return data || []; } catch (error) { console.error("[Badges] Error fetching definitions:", error); showError("Nepodařilo se načíst definice odznaků."); return []; } }
            async function fetchUserEarnedBadges(userId) { /* ... (No changes needed) ... */ console.log(`[UserBadges] Fetching earned badges for user ${userId}...`); if (!supabase || !userId) return []; try { const { data, error } = await supabase .from('user_badges') .select('badge_id, earned_at, badge:badges!inner(id, title, description, type, requirements)') // Select needed fields from badges
                         .eq('user_id', userId) .order('earned_at', { ascending: false }); if (error) throw error; console.log(`[UserBadges] Fetched ${data?.length || 0} earned badges.`); return data || []; } catch (error) { console.error("[UserBadges] Error fetching earned badges:", error); showError("Nepodařilo se načíst získané odznaky."); return []; } }
            async function fetchLeaderboardData(filter = 'points') { /* ... (Adapted JOIN syntax) ... */
                console.log(`[Leaderboard] Fetching data for filter: ${filter}...`);
                if (!supabase) return [];
                const period = 'daily'; // Or configure as needed

                try {
                    // Determine order column based on filter
                    let orderColumn = 'points';
                    if (filter === 'badges') orderColumn = 'badges_count';
                     // Note: Sorting by 'streak' directly in the leaderboard table might require
                     // the streak data to be present in the 'leaderboard' table itself,
                     // which usually requires a function/trigger in the DB to populate.
                     // Here, we assume points/badges are the primary sort keys for the 'leaderboard' table.
                     // We'll fetch profiles to get streak for display if needed.
                    if (filter === 'streak') {
                         // If filtering by streak, we might need a different query or rely on client-side sort after fetching based on points/rank
                         // For simplicity, let's stick to sorting by points for now when filter is streak,
                         // but display the streak value. DB optimization is better.
                         console.warn("[Leaderboard] Sorting by streak directly might require DB function. Fetching sorted by rank/points.");
                         orderColumn = 'rank'; // Fetch by rank, display streak
                    }


                    const { data, error } = await supabase
                        .from('leaderboard')
                        .select('rank, user_id, points, badges_count, profile:profiles!inner(first_name, last_name, username, avatar_url, level, streak_days)') // INNER JOIN profiles
                        .eq('period', period)
                        .order(orderColumn, { ascending: false }) // Order by the selected metric (DESC for higher values first)
                        .limit(10); // Top 10

                    if (error) throw error;

                    // Re-assign rank based on the actual order if needed (Supabase might return rank based on a default order)
                     let rankedData = data || [];
                     if (orderColumn !== 'rank') {
                          rankedData = (data || []).map((entry, index) => ({ ...entry, rank: index + 1 }));
                     }


                    console.log(`[Leaderboard] Fetched ${rankedData.length} entries for period '${period}', ordered by ${orderColumn}.`);
                    return rankedData;
                } catch (error) {
                    console.error(`[Leaderboard] Error fetching leaderboard data (filter: ${filter}, period: ${period}):`, error);
                    showError("Nepodařilo se načíst žebříček.");
                    return [];
                }
             }
            // --- END: Data Loading Functions ---

            // --- START: UI Update Functions ---
            function updateSidebarProfile(profile) { /* ... (Uses new IDs from dashboard.html sidebar) ... */
                 console.log("[UI Update] Aktualizace sidebaru...");
                 if (!ui.sidebarName || !ui.sidebarAvatar) { console.warn("[UI Update] Elementy sidebaru nenalezeny."); return; }
                 if (profile) {
                     const firstName = profile.first_name ?? '';
                     const displayName = firstName || profile.username || currentUser?.email?.split('@')[0] || 'Pilot'; // Use first name primarily
                     ui.sidebarName.textContent = sanitizeHTML(displayName);
                     const initials = getInitials(profile);
                     const avatarUrl = profile.avatar_url;
                     ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${sanitizeHTML(avatarUrl)}" alt="${sanitizeHTML(initials)}">` : sanitizeHTML(initials);
                     console.log("[UI Update] Sidebar aktualizován.");
                 } else {
                     console.warn("[UI Update] Chybí data profilu.");
                     ui.sidebarName.textContent = "Pilot";
                     ui.sidebarAvatar.textContent = '?';
                 }
             }
            // Reworked updateStatsCards to use profile and leaderboard data
            function updateStatsCards(profileData, earnedBadgesData, leaderboard) {
                 console.log("[UI Update] Updating stats cards with data:", profileData);
                 setLoadingState('stats', false); // Explicitly stop loading here

                 const getStatValue = (value) => (value !== null && value !== undefined) ? value : '-';
                 const formatChange = (value, unit = '', iconUp = 'fa-arrow-up', iconDown = 'fa-arrow-down', iconNone = 'fa-minus') => {
                     if (value === null || value === undefined || value === 0) return `<i class="fas ${iconNone}"></i> --`;
                     const sign = value > 0 ? '+' : '';
                     const icon = value > 0 ? iconUp : iconDown;
                     const cssClass = value > 0 ? 'positive' : 'negative';
                     return `<span class="${cssClass}"><i class="fas ${icon}"></i> ${sign}${value}${unit}</span>`;
                 };

                 if (!profileData || !ui.badgesCount || !ui.pointsCount || !ui.streakDays || !ui.rankValue) {
                     console.warn("[UI Update] Missing profile data or stat card elements.");
                     // Optionally show error state on cards, but setLoadingState(false) already hides skeletons
                     [ui.badgesCount, ui.pointsCount, ui.streakDays, ui.rankValue].forEach(el => { if(el) el.textContent = 'ERR'; });
                     [ui.badgesChange, ui.pointsChange, ui.streakChange, ui.rankChange].forEach(el => { if(el) el.innerHTML = `<i class="fas fa-exclamation-triangle"></i>`; });
                     return;
                 }

                 // Badges Count
                 const badgesTotal = earnedBadgesData?.length ?? 0;
                 ui.badgesCount.textContent = getStatValue(badgesTotal);
                 // Placeholder for badges change (requires fetching historical data)
                 ui.badgesChange.innerHTML = `<i class="fas fa-sync-alt"></i> Tento měsíc?`; // Placeholder text

                 // Points Count
                 ui.pointsCount.textContent = getStatValue(profileData.points);
                 // Placeholder for points change (requires user_stats table or similar)
                 ui.pointsChange.innerHTML = `<i class="fas fa-sync-alt"></i> Týdně?`; // Placeholder text

                 // Streak Days
                 ui.streakDays.textContent = getStatValue(profileData.streak_days);
                  // Use streak_longest if available in profile or stats, otherwise fallback
                 const longestStreak = profileData.streak_longest ?? profileData.streak_days ?? '-'; // Assuming streak_longest might be added later
                 ui.streakChange.textContent = `MAX: ${getStatValue(longestStreak)} dní`;

                 // Rank
                 const userRankEntry = leaderboard?.find(u => u.user_id === currentUser?.id);
                 const rank = userRankEntry?.rank ?? '-';
                 const total = leaderboard?.length ?? 0; // Or fetch total users if available
                 ui.rankValue.textContent = getStatValue(rank);
                 ui.rankChange.innerHTML = `<i class="fas fa-users"></i> z ${total > 0 ? total : '?'} pilotů`;

                 console.log("[UI Update] Stats cards updated.");
             }
             // renderUserBadges - Adapting to new card structure and removing loading correctly
             function renderUserBadges(earnedBadges) {
                 if (!ui.badgeGrid || !ui.emptyBadges || !ui.userBadgesContainer) return;
                 setLoadingState('userBadges', false); // Stop loading this section

                 ui.badgeGrid.innerHTML = ''; // Clear previous
                 if (!earnedBadges || earnedBadges.length === 0) {
                     ui.emptyBadges.style.display = 'block';
                     ui.badgeGrid.style.display = 'none';
                     return;
                 }
                 ui.emptyBadges.style.display = 'none';
                 ui.badgeGrid.style.display = 'grid';

                 const fragment = document.createDocumentFragment();
                 earnedBadges.forEach((ub, index) => {
                     const badge = ub.badge;
                     if (!badge) { console.warn("Missing badge details for user badge:", ub); return; }

                     const badgeType = badge.type?.toLowerCase() || 'default';
                     const visual = badgeVisuals[badgeType] || badgeVisuals.default;
                     const badgeElement = document.createElement('div');
                     // Add animation attributes
                     badgeElement.className = 'badge-card card'; // Add base card class
                     badgeElement.setAttribute('data-animate', '');
                     badgeElement.style.setProperty('--animation-order', index);

                     badgeElement.innerHTML = `
                         <div class="badge-icon ${badgeType}" style="background: ${visual.gradient};">
                             <i class="fas ${visual.icon}"></i>
                         </div>
                         <h3 class="badge-title">${sanitizeHTML(badge.title)}</h3>
                         <p class="badge-desc">${sanitizeHTML(badge.description || '')}</p>
                         <div class="badge-date">
                             <i class="far fa-calendar-alt"></i> ${formatDate(ub.earned_at)}
                         </div>
                     `;
                     fragment.appendChild(badgeElement);
                 });
                 ui.badgeGrid.appendChild(fragment);
                 console.log(`[Render] Rendered ${earnedBadges.length} earned badges.`);
                 // Trigger animation initialization if content was added dynamically after initial load
                 requestAnimationFrame(initScrollAnimations);
             }
             // renderAvailableBadges - Adapting to new card structure and removing loading correctly
            function renderAvailableBadges(allBadgesDef, userEarnedBadges, userProfileData) {
                 if (!ui.availableBadgesGrid || !ui.emptyAvailableBadges || !ui.availableBadgesContainer) return;
                 setLoadingState('availableBadges', false); // Stop loading this section

                 ui.availableBadgesGrid.innerHTML = ''; // Clear previous
                 const earnedIds = new Set(userEarnedBadges.map(ub => ub.badge_id));
                 const available = allBadgesDef.filter(b => !earnedIds.has(b.id));

                 if (available.length === 0) {
                     ui.emptyAvailableBadges.style.display = 'block';
                     ui.availableBadgesGrid.style.display = 'none';
                     return;
                 }
                 ui.emptyAvailableBadges.style.display = 'none';
                 ui.availableBadgesGrid.style.display = 'grid';

                 const fragment = document.createDocumentFragment();
                 available.forEach((badge, index) => {
                     const badgeType = badge.type?.toLowerCase() || 'default';
                     const visual = badgeVisuals[badgeType] || badgeVisuals.default;
                     let progress = 0;
                     let progressText = '???'; // Default progress text

                     // --- Calculate Progress based on Requirements ---
                     if (badge.requirements && typeof badge.requirements === 'object' && userProfileData) {
                         const req = badge.requirements;
                         let current = 0;
                         let target = parseInt(req.target, 10) || 1; // Default target to 1

                         try {
                             switch (req.type) {
                                 case 'points_earned': current = userProfileData.points || 0; progressText = `${current}/${target} KR`; break;
                                 case 'streak_days': current = userProfileData.streak_days || 0; progressText = `${current}/${target} dní`; break;
                                 case 'exercises_completed': current = userProfileData.completed_exercises || 0; progressText = `${current}/${target} cv.`; break;
                                 case 'level_reached': current = userProfileData.level || 1; progressText = `${current}/${target} úr.`; break;
                                 // Add more cases as needed
                                 default: console.warn(`Unknown badge requirement type: ${req.type}`); progressText = '?/?';
                             }
                             if (target > 0) {
                                 progress = Math.min(100, Math.max(0, Math.round((current / target) * 100)));
                             }
                         } catch(e) {
                             console.error("Error calculating badge progress:", e, "Badge:", badge, "Profile:", userProfileData);
                             progressText = 'Chyba';
                         }
                     } else {
                         progressText = 'Nespec.'; // Not specified
                     }
                     // --- End Progress Calculation ---

                     const badgeElement = document.createElement('div');
                     badgeElement.className = 'achievement-card card'; // Add base card class
                     badgeElement.setAttribute('data-animate', '');
                     badgeElement.style.setProperty('--animation-order', index);

                     badgeElement.innerHTML = `
                         <div class="achievement-icon ${badgeType}" style="background: ${visual.gradient};">
                             <i class="fas ${visual.icon}"></i>
                         </div>
                         <div class="achievement-content">
                             <h3 class="achievement-title">${sanitizeHTML(badge.title)}</h3>
                             <p class="achievement-desc">${sanitizeHTML(badge.description || '')}</p>
                             <div class="progress-container">
                                 <div class="progress-bar">
                                     <div class="progress-fill" style="width: ${progress}%; background: ${visual.gradient};"></div>
                                 </div>
                                 <div class="progress-stats">${progress}% (${progressText})</div>
                             </div>
                         </div>`;
                     fragment.appendChild(badgeElement);
                 });
                 ui.availableBadgesGrid.appendChild(fragment);
                 console.log(`[Render] Rendered ${available.length} available badges.`);
                  // Trigger animation initialization if content was added dynamically after initial load
                  requestAnimationFrame(initScrollAnimations);
             }
             // renderLeaderboard - Adapting to new table structure and removing loading correctly
            function renderLeaderboard(data) {
                 if (!ui.leaderboardBody || !ui.leaderboardEmpty || !ui.scoreHeader || !ui.leaderboardContainer) return;
                 setLoadingState('leaderboard', false); // Stop loading this section

                 ui.leaderboardBody.innerHTML = ''; // Clear previous
                 const filterMap = { points: 'Kredity', badges: 'Odznaky', streak: 'Série' };
                 ui.scoreHeader.textContent = filterMap[currentLeaderboardFilter] || 'Skóre';

                 if (!data || data.length === 0) {
                     ui.leaderboardEmpty.style.display = 'block';
                     ui.leaderboardBody.style.display = 'none';
                     return;
                 }
                 ui.leaderboardEmpty.style.display = 'none';
                 ui.leaderboardBody.style.display = ''; // Show tbody

                 const fragment = document.createDocumentFragment();
                 data.forEach((entry) => { // Removed index as rank comes from data
                     const user = entry.profile || {};
                     const rank = entry.rank || '?'; // Use rank from data
                     const isCurrentUser = entry.user_id === currentUser?.id;
                     const displayName = user.username ? `@${user.username}` : `${user.first_name || ''} ${user.last_name || ''}`.trim() || `Pilot ${entry.user_id.substring(0, 4)}`;
                     const initials = getInitials(user);
                     let scoreValue;
                     switch (currentLeaderboardFilter) {
                         case 'points': scoreValue = entry.points ?? 0; break;
                         case 'badges': scoreValue = entry.badges_count ?? 0; break;
                         case 'streak': scoreValue = user.streak_days ?? 0; break; // Display streak from profile
                         default: scoreValue = entry.points ?? 0;
                     }
                     const badgesCount = entry.badges_count ?? 0;

                     const rowElement = document.createElement('tr');
                     if (isCurrentUser) rowElement.classList.add('highlight-row');

                     rowElement.innerHTML = `
                         <td class="rank-cell">${rank}</td>
                         <td class="user-cell">
                             <div class="user-avatar-sm">${user.avatar_url ? `<img src="${sanitizeHTML(user.avatar_url)}" alt="${sanitizeHTML(displayName)}">` : sanitizeHTML(initials)}</div>
                             <div class="user-info-sm">
                                 <div class="user-name-sm">${sanitizeHTML(displayName)}</div>
                                 <div class="user-level">Úroveň ${user.level || 1}</div>
                             </div>
                         </td>
                         <td class="score-cell">${scoreValue}</td>
                         <td class="badge-count-cell">${badgesCount}</td>`;
                     fragment.appendChild(rowElement);
                 });
                 ui.leaderboardBody.appendChild(fragment);
                 console.log(`[Render] Rendered ${data.length} leaderboard entries.`);
             }
             // renderRecentBadges - Adapting to new structure and removing loading correctly
            function renderRecentBadges(earnedBadges) {
                 if (!ui.recentAchievementsList || !ui.recentAchievementsSection) return;
                 setLoadingState('recentBadges', false); // Stop loading this section

                 ui.recentAchievementsList.innerHTML = ''; // Clear previous
                 const recent = earnedBadges.slice(0, 5); // Already sorted desc by API

                 if (recent.length === 0) {
                     ui.recentAchievementsSection.style.display = 'none'; // Hide the whole section if no recent badges
                     return;
                 }
                 ui.recentAchievementsSection.style.display = 'block'; // Show the section

                 const fragment = document.createDocumentFragment();
                 recent.forEach((ub, index) => {
                     const badge = ub.badge;
                     if (!badge) return;

                     const badgeType = badge.type?.toLowerCase() || 'default';
                     const visual = badgeVisuals[badgeType] || badgeVisuals.default;
                     const badgeElement = document.createElement('div');
                     badgeElement.className = `achievement-item`; // Animation handled by parent container
                     // Removed animation classes/styles, rely on [data-animate] on parent section

                     badgeElement.innerHTML = `
                         <div class="achievement-item-icon ${badgeType}" style="background: ${visual.gradient};">
                             <i class="fas ${visual.icon}"></i>
                         </div>
                         <div class="achievement-item-content">
                             <h3 class="achievement-item-title">${sanitizeHTML(badge.title)}</h3>
                             <p class="achievement-item-desc">${sanitizeHTML(badge.description || '')}</p>
                             <div class="achievement-item-time">
                                 <i class="far fa-calendar-alt"></i> ${formatDate(ub.earned_at)}
                             </div>
                         </div>`;
                     fragment.appendChild(badgeElement);
                 });
                 ui.recentAchievementsList.appendChild(fragment);
                 console.log(`[Render] Rendered ${recent.length} recent badges.`);
                 // Trigger animation initialization if content was added dynamically after initial load
                 requestAnimationFrame(initScrollAnimations);
             }
            // --- END: UI Update Functions ---

            // --- START: Event Listeners & Handlers ---
            function setupUIEventListeners() {
                console.log("[SETUP] setupUIEventListeners: Start");
                // Mobile Menu Toggles (from dashboard.html)
                if (ui.mainMobileMenuToggle) ui.mainMobileMenuToggle.addEventListener('click', openMenu);
                if (ui.sidebarCloseToggle) ui.sidebarCloseToggle.addEventListener('click', closeMenu);
                if (ui.sidebarOverlay) ui.sidebarOverlay.addEventListener('click', closeMenu);
                document.querySelectorAll('.sidebar-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 992) closeMenu(); }); });

                // Online/Offline Status (from dashboard.html)
                window.addEventListener('online', updateOnlineStatus);
                window.addEventListener('offline', updateOnlineStatus);
                updateOnlineStatus(); // Initial check

                // Refresh button (from dashboard.html)
                if (ui.refreshDataBtn) {
                    ui.refreshDataBtn.addEventListener('click', handleGlobalRetry); // Use the retry handler
                 }

                // Leaderboard Filters
                ui.filterButtons?.forEach(button => { button.addEventListener('click', handleFilterChange); });

                 // Global Error Retry Button (listener added in showError function)

                console.log("[SETUP] setupUIEventListeners: Posluchači nastaveni.");
            }
            async function handleFilterChange(event) { /* ... (Refetch and re-render leaderboard) ... */
                 const newFilter = event.target.dataset.filter;
                 if (!newFilter || newFilter === currentLeaderboardFilter || isLoading.leaderboard) return;

                 ui.filterButtons.forEach(btn => btn.classList.remove('active'));
                 event.target.classList.add('active');
                 currentLeaderboardFilter = newFilter;
                 console.log(`[Filter] Leaderboard filter changed to: ${currentLeaderboardFilter}. Reloading...`);

                 setLoadingState('leaderboard', true);
                 try {
                     const data = await fetchLeaderboardData(currentLeaderboardFilter);
                     leaderboardData[currentLeaderboardFilter] = data || [];
                     renderLeaderboard(leaderboardData[currentLeaderboardFilter]);
                     // Re-update stats cards in case rank changed based on new filter's leaderboard
                     updateStatsCards(currentProfile, userBadges, leaderboardData[currentLeaderboardFilter]);
                 } catch (error) {
                     showError("Nepodařilo se načíst data žebříčku pro tento filtr.");
                     renderLeaderboard([]); // Render empty state on error
                 } finally {
                     setLoadingState('leaderboard', false);
                 }
             }
            async function handleGlobalRetry() { /* ... (Reload all page data) ... */
                 console.log("🔄 Global retry triggered...");
                 if (!currentUser || !currentProfile) {
                     showToast("Chyba", "Pro obnovení je nutné být přihlášen a mít načtený profil.", "error");
                     // Optionally try to re-initialize if profile is missing
                     if (!currentProfile) await initializeApp();
                     return;
                 }
                 // Check if already loading
                 if (Object.values(isLoading).some(state => state)) {
                      showToast("PROBÍHÁ SYNCHRONIZACE", "Data se již načítají.", "info");
                      return;
                  }

                 hideError();
                 // Indicate loading on the button
                 if (ui.refreshDataBtn) {
                     const icon = ui.refreshDataBtn.querySelector('i');
                     const text = ui.refreshDataBtn.querySelector('.refresh-text');
                     if (icon) icon.classList.add('fa-spin');
                     if (text) text.textContent = 'RELOADING...';
                     ui.refreshDataBtn.disabled = true;
                 }

                 await loadAllAwardData(); // Reload everything

                 // Reset button state
                 if (ui.refreshDataBtn) {
                      const icon = ui.refreshDataBtn.querySelector('i');
                      const text = ui.refreshDataBtn.querySelector('.refresh-text');
                      if (icon) icon.classList.remove('fa-spin');
                      if (text) text.textContent = 'RELOAD';
                      ui.refreshDataBtn.disabled = false;
                 }
             }
            // --- END: Event Listeners & Handlers ---

            // --- Initialize the Application ---
            initializeApp();

        })(); // End of IIFE
