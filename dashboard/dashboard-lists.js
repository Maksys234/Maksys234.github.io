// dashboard-lists.js
// Verze: 1.2 - Definitivně odstraněno rekurzivní/chybné volání setLoadingStateGlobal

(function(window) {
    'use strict';

    const DashboardLists = {
        dependencies: {
            supabaseClient: null,
            currentUser: null,
            activityVisuals: {},
            formatRelativeTime: () => '',
            sanitizeHTML: (str) => str,
            // setLoadingStateGlobal: () => {} // Odebráno z explicitních závislostí, pokud již není voláno
        },
        uiLists: {
            activityListContainer: null,
            activityList: null,
            activityListEmptyState: null,
            activityListErrorState: null,
            activityListLoadingPlaceholder: null,
            creditHistoryListContainer: null,
            creditHistoryList: null,
            creditHistoryEmptyState: null,
            creditHistoryErrorState: null,
            creditHistoryLoadingPlaceholder: null
        },
        isLoadingActivities: false,
        isLoadingCreditHistory: false,

        initialize: function(deps) {
            console.log("[DashboardLists] Initializing (v1.2)...");
            this.dependencies.supabaseClient = deps.supabaseClient;
            this.dependencies.currentUser = deps.currentUser;
            this.dependencies.activityVisuals = deps.activityVisuals;
            this.dependencies.formatRelativeTime = deps.formatRelativeTime;
            this.dependencies.sanitizeHTML = deps.sanitizeHTML;
            // Globální setLoadingState se již nebude volat z tohoto modulu pro klíče 'activities' a 'creditHistory'
            // this.dependencies.setLoadingStateGlobal = deps.setLoadingStateGlobal; 
            this._cacheDOMElements();
            if (!this.dependencies.supabaseClient) console.error("[DashboardLists] Supabase client is missing!");
            console.log("[DashboardLists] Initialized successfully (v1.2).");
        },

        _cacheDOMElements: function() {
            console.log("[DashboardLists CacheDOM] Caching list-specific elements...");
            this.uiLists.activityListContainer = document.getElementById('activity-list-container');
            this.uiLists.activityList = document.getElementById('activity-list');
            this.uiLists.activityListEmptyState = document.getElementById('activity-list-empty-state');
            this.uiLists.activityListErrorState = document.getElementById('activity-list-error-state');
            this.uiLists.activityListLoadingPlaceholder = this.uiLists.activityListContainer?.querySelector('.loading-placeholder');

            this.uiLists.creditHistoryListContainer = document.getElementById('credit-history-list-container');
            this.uiLists.creditHistoryList = document.getElementById('credit-history-list');
            this.uiLists.creditHistoryEmptyState = document.getElementById('credit-history-empty-state');
            this.uiLists.creditHistoryErrorState = document.getElementById('credit-history-error-state');
            this.uiLists.creditHistoryLoadingPlaceholder = this.uiLists.creditHistoryListContainer?.querySelector('.loading-placeholder');
            console.log("[DashboardLists CacheDOM] Caching complete.");
        },

        setActivitiesLoading: function(isLoadingFlag) {
            this.isLoadingActivities = isLoadingFlag;
            console.log(`[DashboardLists] Inner setActivitiesLoading set to: ${isLoadingFlag}`);

            // Tato funkce nyní spravuje pouze UI prvky UVNITŘ activityListContainer
            if (this.uiLists.activityListContainer) {
                this.uiLists.activityListContainer.classList.toggle('loading', isLoadingFlag);
                if (isLoadingFlag) {
                    if (this.uiLists.activityList) this.uiLists.activityList.style.display = 'none';
                    if (this.uiLists.activityListEmptyState) this.uiLists.activityListEmptyState.style.display = 'none';
                    if (this.uiLists.activityListErrorState) this.uiLists.activityListErrorState.style.display = 'none';
                    if (this.uiLists.activityListLoadingPlaceholder) {
                        this.renderActivitySkeletons(5);
                        this.uiLists.activityListLoadingPlaceholder.style.display = 'flex';
                    }
                } else {
                    if (this.uiLists.activityListLoadingPlaceholder) this.uiLists.activityListLoadingPlaceholder.style.display = 'none';
                }
            }
        },

        setCreditHistoryLoading: function(isLoadingFlag) {
            this.isLoadingCreditHistory = isLoadingFlag;
            console.log(`[DashboardLists] Inner setCreditHistoryLoading set to: ${isLoadingFlag}`);

            if (this.uiLists.creditHistoryListContainer) {
                this.uiLists.creditHistoryListContainer.classList.toggle('loading', isLoadingFlag);
                 if (isLoadingFlag) {
                    if (this.uiLists.creditHistoryList) this.uiLists.creditHistoryList.style.display = 'none';
                    if (this.uiLists.creditHistoryEmptyState) this.uiLists.creditHistoryEmptyState.style.display = 'none';
                    if (this.uiLists.creditHistoryErrorState) this.uiLists.creditHistoryErrorState.style.display = 'none';
                    if (this.uiLists.creditHistoryLoadingPlaceholder) {
                        this.renderCreditHistorySkeletons(5);
                        this.uiLists.creditHistoryLoadingPlaceholder.style.display = 'flex';
                    }
                } else {
                    if (this.uiLists.creditHistoryLoadingPlaceholder) this.uiLists.creditHistoryLoadingPlaceholder.style.display = 'none';
                }
            }
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
                if (typeof this.dependencies.showToast === 'function') { // Použijeme globální showToast
                    this.dependencies.showToast('Chyba aktivit', 'Nepodařilo se načíst nedávné aktivity.', 'error');
                }
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
                if (typeof this.dependencies.showToast === 'function') {
                     this.dependencies.showToast('Chyba historie kreditů', 'Nepodařilo se načíst historii kreditů.', 'error');
                }
                return null;
            }
        },

        renderActivities: function(activities) {
            const ui = this.uiLists;
            const { sanitizeHTML, formatRelativeTime, activityVisuals } = this.dependencies;

            if (!ui.activityList || !ui.activityListContainer || !ui.activityListEmptyState || !ui.activityListErrorState || !ui.activityListLoadingPlaceholder) {
                console.error("[DashboardLists Render Activities] Essential UI elements missing.");
                this.setActivitiesLoading(false);
                return;
            }
            console.log("[DashboardLists Render Activities] Rendering, count:", activities?.length);

            ui.activityList.innerHTML = '';
            // Již řešeno v setActivitiesLoading: ui.activityListLoadingPlaceholder.style.display = 'none';
            ui.activityListErrorState.style.display = 'none';
            ui.activityListEmptyState.style.display = 'none';
            ui.activityList.style.display = 'none';

            if (activities === null) {
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
                ui.activityList.style.display = 'block';
            }
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

            if (!ui.creditHistoryList || !ui.creditHistoryListContainer || !ui.creditHistoryEmptyState || !ui.creditHistoryErrorState || !ui.creditHistoryLoadingPlaceholder) {
                console.error("[DashboardLists Render Credits] Essential UI elements missing.");
                this.setCreditHistoryLoading(false);
                return;
            }
            console.log("[DashboardLists Render Credits] Rendering, count:", transactions?.length);

            ui.creditHistoryList.innerHTML = '';
            // Již řešeno v setCreditHistoryLoading: ui.creditHistoryLoadingPlaceholder.style.display = 'none';
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
                    if (!activityVisuals[typeLower]) {
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
            const [activitiesResult, creditHistoryResult] = await Promise.allSettled([
                this.loadAndRenderRecentActivities(userId, limit),
                this.loadAndRenderCreditHistory(userId, limit)
            ]);

            if (activitiesResult.status === 'rejected') {
                console.error("[DashboardLists] Error loading recent activities in loadAndRenderAll:", activitiesResult.reason);
                // renderActivities(null) se volá uvnitř loadAndRenderRecentActivities v případě chyby
            }
            if (creditHistoryResult.status === 'rejected') {
                console.error("[DashboardLists] Error loading credit history in loadAndRenderAll:", creditHistoryResult.reason);
                // renderCreditHistory(null) se volá uvnitř loadAndRenderCreditHistory v případě chyby
            }
            console.log("[DashboardLists] loadAndRenderAll finished.");
        },

        loadAndRenderRecentActivities: async function(userId, limit) {
            this.setActivitiesLoading(true);
            const activities = await this.fetchRecentActivities(userId, limit);
            this.renderActivities(activities); // Tato funkce již volá setActivitiesLoading(false)
        },

        loadAndRenderCreditHistory: async function(userId, limit) {
            this.setCreditHistoryLoading(true);
            const transactions = await this.fetchCreditHistory(userId, limit);
            this.renderCreditHistory(transactions); // Tato funkce již volá setCreditHistoryLoading(false)
        }
    };

    window.DashboardLists = DashboardLists;
    console.log("dashboard-lists.js loaded with fix for recursive call (v1.2).");

})(window);