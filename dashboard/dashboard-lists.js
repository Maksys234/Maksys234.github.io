// dashboard-lists.js
// Verze: 2.0 - Úprava pro integraci se skeletony řízenými z dashboard.js
// Globální setLoadingStateGlobal je nahrazeno externím voláním toggleSkeletonUI.
// Tento modul nyní spravuje pouze vnitřní skeletony pro samotné seznamy.

(function(window) {
    'use strict';

    const DashboardLists = {
        dependencies: {
            supabaseClient: null,
            currentUser: null,
            activityVisuals: {},
            formatRelativeTime: () => '',
            sanitizeHTML: (str) => str,
            // toggleSkeletonUI: () => {} // Předpokládáme, že tuto funkci zavolá dashboard.js
        },
        uiLists: {
            activityListContainerWrapper: null, // Rodičovský kontejner pro celou sekci aktivit
            activityListContainer: null, // Kontejner, kde se střídá placeholder a seznam
            activityList: null,
            activityListEmptyState: null,
            activityListErrorState: null,
            activityListLoadingPlaceholder: null, // Vnitřní placeholder/skeleton pro položky seznamu

            creditHistoryListContainerWrapper: null, // Rodičovský kontejner pro celou sekci kreditů
            creditHistoryListContainer: null, // Kontejner, kde se střídá placeholder a seznam
            creditHistoryList: null,
            creditHistoryEmptyState: null,
            creditHistoryErrorState: null,
            creditHistoryLoadingPlaceholder: null // Vnitřní placeholder/skeleton
        },
        isLoadingActivities: false,
        isLoadingCreditHistory: false,

        initialize: function(deps) {
            console.log("[DashboardLists] Initializing (v2.0 - Skeleton Integration)...");
            this.dependencies.supabaseClient = deps.supabaseClient;
            this.dependencies.currentUser = deps.currentUser;
            this.dependencies.activityVisuals = deps.activityVisuals;
            this.dependencies.formatRelativeTime = deps.formatRelativeTime;
            this.dependencies.sanitizeHTML = deps.sanitizeHTML;
            // this.dependencies.toggleSkeletonUI = deps.toggleSkeletonUI; // Pokud by dashboard.js předával referenci

            this._cacheDOMElements();
            if (!this.dependencies.supabaseClient) console.error("[DashboardLists] Supabase client is missing!");
            console.log("[DashboardLists] Initialized successfully (v2.0).");
        },

        _cacheDOMElements: function() {
            console.log("[DashboardLists CacheDOM] Caching list-specific elements...");
            // Recent Activities
            this.uiLists.activityListContainerWrapper = document.getElementById('recent-activities-container-wrapper');
            this.uiLists.activityListContainer = document.getElementById('activity-list-container'); // Toto je <div class="activity-list-container">
            this.uiLists.activityList = document.getElementById('activity-list');
            this.uiLists.activityListEmptyState = document.getElementById('activity-list-empty-state');
            this.uiLists.activityListErrorState = document.getElementById('activity-list-error-state');
            // Placeholder pro skeletony položek seznamu (je *uvnitř* activityListContainer)
            this.uiLists.activityListLoadingPlaceholder = this.uiLists.activityListContainer?.querySelector('.loading-placeholder');

            // Credit History
            this.uiLists.creditHistoryContainerWrapper = document.getElementById('credit-history-container-wrapper');
            this.uiLists.creditHistoryListContainer = document.getElementById('credit-history-list-container'); // Toto je <div class="activity-list-container">
            this.uiLists.creditHistoryList = document.getElementById('credit-history-list');
            this.uiLists.creditHistoryEmptyState = document.getElementById('credit-history-empty-state');
            this.uiLists.creditHistoryErrorState = document.getElementById('credit-history-error-state');
            this.uiLists.creditHistoryLoadingPlaceholder = this.uiLists.creditHistoryListContainer?.querySelector('.loading-placeholder');
            console.log("[DashboardLists CacheDOM] Caching complete.");
        },

        // Interní funkce pro zobrazení/skrytí skeletonů položek seznamu
        _setListSpecificLoading: function(listType, isLoadingFlag) {
            const ui = listType === 'activities' ? this.uiLists : this.uiLists; // Upravit pokud budou odlišné ui klíče
            const listEl = listType === 'activities' ? ui.activityList : ui.creditHistoryList;
            const emptyEl = listType === 'activities' ? ui.activityListEmptyState : ui.creditHistoryEmptyState;
            const errorEl = listType === 'activities' ? ui.activityListErrorState : ui.creditHistoryErrorState;
            const placeholderEl = listType === 'activities' ? ui.activityListLoadingPlaceholder : ui.creditHistoryLoadingPlaceholder;
            const listContainer = listType === 'activities' ? ui.activityListContainer : ui.creditHistoryListContainer;

            console.log(`[DashboardLists _setListSpecificLoading] ${listType} - isLoading: ${isLoadingFlag}`);

            if (!listContainer) {
                console.warn(`[DashboardLists] ${listType} list container not found.`);
                return;
            }
            
            listContainer.classList.toggle('loading-items', isLoadingFlag);

            if (isLoadingFlag) {
                if (listEl) listEl.style.display = 'none';
                if (emptyEl) emptyEl.style.display = 'none';
                if (errorEl) errorEl.style.display = 'none';
                if (placeholderEl) {
                    if (listType === 'activities') this.renderActivitySkeletons(5);
                    else if (listType === 'creditHistory') this.renderCreditHistorySkeletons(5);
                    placeholderEl.style.display = 'flex'; // Placeholder je flex kontejner
                }
            } else {
                if (placeholderEl) placeholderEl.style.display = 'none';
                // Zobrazení listEl, emptyEl, errorEl se řeší v render funkcích
            }
        },

        setActivitiesLoading: function(isLoadingFlag) {
            this.isLoadingActivities = isLoadingFlag;
            this._setListSpecificLoading('activities', isLoadingFlag);
        },

        setCreditHistoryLoading: function(isLoadingFlag) {
            this.isLoadingCreditHistory = isLoadingFlag;
            this._setListSpecificLoading('creditHistory', isLoadingFlag);
        },

        fetchRecentActivities: async function(userId, limit = 5) {
            if (!this.dependencies.supabaseClient || !userId) {
                console.error("[DashboardLists Activities] Supabase client or User ID missing.");
                return null;
            }
            console.log(`[DashboardLists Activities] Fetching last ${limit} activities for user ${userId}`);
            try {
                const { data, error } = await this.dependencies.supabaseClient
                    .from('activities')
                    .select('title, description, type, created_at, icon, link_url, details')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(limit);
                if (error) throw error;
                console.log(`[DashboardLists Activities] Fetched ${data?.length || 0} activities.`);
                return data || [];
            } catch (e) {
                console.error('[DashboardLists Activities] Exception fetching activities:', e);
                // Globální showToast bude voláno z dashboard.js nebo hlavní logiky
                return null;
            }
        },

        fetchCreditHistory: async function(userId, limit = 5) {
            if (!this.dependencies.supabaseClient || !userId) {
                console.error("[DashboardLists CreditHistory] Supabase client or User ID missing.");
                return null;
            }
            console.log(`[DashboardLists CreditHistory] Fetching last ${limit} credit transactions for ${userId}`);
            try {
                const { data, error } = await this.dependencies.supabaseClient
                    .from('credit_transactions')
                    .select('created_at, transaction_type, amount, description, balance_after_transaction')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(limit);
                if (error) throw error;
                console.log(`[DashboardLists CreditHistory] Fetched ${data?.length || 0} transactions.`);
                return data || [];
            } catch (error) {
                console.error('[DashboardLists CreditHistory] Exception fetching credit history:', error);
                // Globální showToast bude voláno z dashboard.js
                return null;
            }
        },

        renderActivities: function(activities) {
            const ui = this.uiLists;
            const { sanitizeHTML, formatRelativeTime, activityVisuals } = this.dependencies;

            if (!ui.activityList || !ui.activityListContainer || !ui.activityListEmptyState || !ui.activityListErrorState) {
                console.error("[DashboardLists Render Activities] Essential UI elements missing.");
                this.setActivitiesLoading(false); // Zajistíme vypnutí interního skeletonu
                return;
            }
            console.log("[DashboardLists Render Activities] Rendering, count:", activities?.length);

            ui.activityList.innerHTML = '';
            // Placeholder se skryje ve funkci _setListSpecificLoading
            ui.activityListErrorState.style.display = 'none';
            ui.activityListEmptyState.style.display = 'none';
            ui.activityList.style.display = 'none'; // Skryjeme hlavní seznam před naplněním

            if (activities === null) { // Explicitní null značí chybu načítání
                ui.activityListErrorState.style.display = 'block';
            } else if (!activities || activities.length === 0) {
                ui.activityListEmptyState.style.display = 'block';
            } else {
                const fragment = document.createDocumentFragment();
                activities.forEach(activity => {
                    const typeLower = activity.type?.toLowerCase() || 'default';
                    const visual = activityVisuals[typeLower] || activityVisuals.default;
                    const title = sanitizeHTML(activity.title || 'Neznámá aktivita');
                    let description = sanitizeHTML(activity.description || '');
                    const timeAgo = formatRelativeTime(activity.created_at);
                    const icon = activity.icon || visual.icon;
                    const linkUrl = activity.link_url;
                    const details = activity.details;
                    let metaScoreHTML = '';

                    if (details && details.score !== undefined) {
                        const maxScore = details.max_score !== undefined ? `/${sanitizeHTML(String(details.max_score))}` : '';
                        metaScoreHTML = `<div class="activity-meta">Skóre: ${sanitizeHTML(String(details.score))}${maxScore}</div>`;
                    }

                    const item = document.createElement('div');
                    item.className = 'activity-item';
                    let itemContent = `
                        <div class="activity-icon ${visual.class || typeLower}">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-title">${title}</div>
                            ${description ? `<div class="activity-desc">${description}</div>` : ''}
                            ${metaScoreHTML}
                            <div class="activity-time"><i class="far fa-clock"></i> ${timeAgo}</div>
                        </div>`;
                    if (linkUrl) {
                        item.innerHTML = `<a href="${sanitizeHTML(linkUrl)}" class="activity-link-wrapper" target="_blank" rel="noopener noreferrer">${itemContent}</a>`;
                    } else {
                        item.innerHTML = itemContent;
                    }
                    fragment.appendChild(item);
                });
                ui.activityList.appendChild(fragment);
                ui.activityList.style.display = 'block'; // Zobrazíme naplněný seznam
            }
            // Voláme interní funkci pro skrytí skeletonu položek
            this.setActivitiesLoading(false);
            console.log("[DashboardLists Render Activities] Finished.");
        },

        renderActivitySkeletons: function(count = 5) {
            const ui = this.uiLists;
            if (!ui.activityListLoadingPlaceholder) { console.warn("[DashboardLists Skeletons] Activity placeholder not found."); return; }
            let skeletonHTML = '';
            for (let i = 0; i < count; i++) {
                skeletonHTML += `<div class="skeleton-activity-item"><div class="skeleton icon-placeholder"></div><div style="flex-grow: 1;"><div class="skeleton activity-line"></div><div class="skeleton activity-line text-short"></div><div class="skeleton activity-line-short"></div></div></div>`;
            }
            ui.activityListLoadingPlaceholder.innerHTML = skeletonHTML;
        },

        renderCreditHistory: function(transactions) {
            const ui = this.uiLists;
            const { sanitizeHTML, formatRelativeTime, activityVisuals } = this.dependencies;

            if (!ui.creditHistoryList || !ui.creditHistoryListContainer || !ui.creditHistoryEmptyState || !ui.creditHistoryErrorState) {
                console.error("[DashboardLists Render Credits] Essential UI elements missing.");
                this.setCreditHistoryLoading(false);
                return;
            }
            console.log("[DashboardLists Render Credits] Rendering, count:", transactions?.length);

            ui.creditHistoryList.innerHTML = '';
            ui.creditHistoryErrorState.style.display = 'none';
            ui.creditHistoryEmptyState.style.display = 'none';
            ui.creditHistoryList.style.display = 'none';

            if (transactions === null) {
                ui.creditHistoryErrorState.style.display = 'block';
            } else if (!transactions || transactions.length === 0) {
                ui.creditHistoryEmptyState.style.display = 'block';
            } else {
                const fragment = document.createDocumentFragment();
                transactions.forEach(tx => {
                    const item = document.createElement('div');
                    item.className = 'activity-item credit-transaction-item';
                    const amountClass = tx.amount > 0 ? 'positive' : (tx.amount < 0 ? 'negative' : 'neutral');
                    const amountSign = tx.amount > 0 ? '+' : '';
                    let typeLower = tx.transaction_type?.toLowerCase();

                    // Mapování transaction_type na existující visuals klíče, pokud je to možné
                    if (typeLower === 'reward_streak_milestone') typeLower = 'streak_milestone_claimed';
                    else if (typeLower === 'reward_monthly_calendar') typeLower = 'monthly_reward_claimed';
                    else if (typeLower === 'purchase_title_shop') typeLower = 'points_spent'; // Nebo jiný obecný typ pro útratu
                    else if (!activityVisuals[typeLower]) { // Fallback pro neznámé typy
                        typeLower = tx.amount > 0 ? 'points_earned' : (tx.amount < 0 ? 'points_spent' : 'default');
                    }

                    const visual = activityVisuals[typeLower] || activityVisuals.default;
                    const iconClass = visual.icon;
                    const iconBgClass = visual.class || typeLower;

                    item.innerHTML = `
                        <div class="activity-icon ${iconBgClass}">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-title">${sanitizeHTML(tx.description || tx.transaction_type || 'Neznámá transakce')}</div>
                            <div class="credit-amount ${amountClass}">
                                ${amountSign}${tx.amount} <i class="fas fa-coins"></i>
                            </div>
                            <div class="activity-time">
                                <i class="far fa-clock"></i> ${formatRelativeTime(tx.created_at)}
                            </div>
                        </div>`;
                    fragment.appendChild(item);
                });
                ui.creditHistoryList.appendChild(fragment);
                ui.creditHistoryList.style.display = 'block';
            }
            this.setCreditHistoryLoading(false);
            console.log("[DashboardLists Render Credits] Finished.");
        },

        renderCreditHistorySkeletons: function(count = 5) {
            const ui = this.uiLists;
            if (!ui.creditHistoryLoadingPlaceholder) { console.warn("[DashboardLists Skeletons] Credit history placeholder not found."); return; }
            let skeletonHTML = '';
            for (let i = 0; i < count; i++) {
                skeletonHTML += `<div class="skeleton-activity-item"><div class="skeleton icon-placeholder" style="background-color: var(--accent-orange);"></div><div style="flex-grow: 1;"><div class="skeleton activity-line" style="width: 60%;"></div><div class="skeleton activity-line text-short" style="width: 40%; margin-bottom: 0.3rem;"></div><div class="skeleton activity-line-short" style="width: 30%;"></div></div></div>`;
            }
            ui.creditHistoryLoadingPlaceholder.innerHTML = skeletonHTML;
        },

        loadAndRenderAll: async function(userId, limit) {
            console.log("[DashboardLists] loadAndRenderAll called.");
            // dashboard.js bude řídit hlavní skeletony sekcí
            // Tento modul se postará pouze o vnitřní skeletony a obsah seznamů

            const [activitiesResult, creditHistoryResult] = await Promise.allSettled([
                (async () => {
                    this.setActivitiesLoading(true); // Zobrazí vnitřní skeleton seznamu aktivit
                    const activities = await this.fetchRecentActivities(userId, limit);
                    this.renderActivities(activities); // Vykreslí data nebo chybový/prázdný stav
                })(),
                (async () => {
                    this.setCreditHistoryLoading(true); // Zobrazí vnitřní skeleton historie kreditů
                    const transactions = await this.fetchCreditHistory(userId, limit);
                    this.renderCreditHistory(transactions); // Vykreslí data nebo chybový/prázdný stav
                })()
            ]);

            if (activitiesResult.status === 'rejected') {
                console.error("[DashboardLists] Error loading recent activities in loadAndRenderAll:", activitiesResult.reason);
            }
            if (creditHistoryResult.status === 'rejected') {
                console.error("[DashboardLists] Error loading credit history in loadAndRenderAll:", creditHistoryResult.reason);
            }
            console.log("[DashboardLists] loadAndRenderAll finished.");
        },

        loadAndRenderRecentActivities: async function(userId, limit) {
            this.setActivitiesLoading(true);
            const activities = await this.fetchRecentActivities(userId, limit);
            this.renderActivities(activities);
        },

        loadAndRenderCreditHistory: async function(userId, limit) {
            this.setCreditHistoryLoading(true);
            const transactions = await this.fetchCreditHistory(userId, limit);
            this.renderCreditHistory(transactions);
        }
    };

    window.DashboardLists = DashboardLists;
    console.log("dashboard-lists.js loaded (v2.0 - Skeleton Integration).");

})(window);