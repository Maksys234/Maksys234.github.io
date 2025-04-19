// supabaseService.js - Функции для взаимодействия с Supabase
// Версия 3.8: Добавлено логирование параметров перед вызовом RPC awardPoints

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { state } from './state.js';
// import { showToast } from './uiHelpers.js'; // Uncomment if needed

// Используем IIFE (Immediately Invoked Function Expression) для создания синглтона
const SupabaseService = (() => {
    let client = null; // Приватная переменная для хранения клиента
    let isInitialized = false;
    let hasLoggedInitialSignIn = false; // Флаг для отслеживания первого лога

    /**
     * Инициализирует Supabase клиент и слушателя состояния аутентификации.
     * Выполняется только один раз.
     * @returns {object|null} Instance Supabase клиента или null при ошибке.
     */
    function initialize() {
        if (isInitialized) {
            // console.log("Supabase client already initialized.");
            return client;
        }

        console.log("Attempting Supabase client initialization...");
        try {
            // Используем window.supabase, так как оно загружено через <script>
            if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
                client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log("Supabase client created via window.supabase.");
            } else {
                let errorMsg = "Supabase library (window.supabase.createClient) not available.";
                if (typeof window === 'undefined') { errorMsg = "Supabase init failed: 'window' is not available."; }
                else if (!window.supabase) { errorMsg = "Supabase init failed: 'window.supabase' is not defined. Check Supabase V2 CDN script."; }
                else if (typeof window.supabase.createClient !== 'function') { errorMsg = "Supabase init failed: 'window.supabase.createClient' is not a function."; }
                throw new Error(errorMsg);
            }

            if (!client) {
                throw new Error("Supabase client creation failed.");
            }

            // Настройка слушателя onAuthStateChange ТОЛЬКО ОДИН РАЗ
            client.auth.onAuthStateChange((event, session) => {
                console.log(`Supabase Auth Event: ${event}`); // Логируем *тип* события

                if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                    if (session?.user) {
                        if (!hasLoggedInitialSignIn) {
                            console.log(`Supabase Auth: User initially confirmed signed in (ID: ${session.user.id}).`); // Логируем только первый раз
                            hasLoggedInitialSignIn = true;
                        }
                        state.currentUser = session.user; // Обновляем состояние
                    } else {
                         console.log('Supabase Auth: Initial session checked, no user.');
                         state.currentUser = null;
                         state.currentProfile = null;
                         hasLoggedInitialSignIn = false;
                    }
                } else if (event === 'SIGNED_OUT') {
                    console.log('Supabase Auth: User signed out.');
                    state.currentUser = null;
                    state.currentProfile = null;
                    hasLoggedInitialSignIn = false;
                    // window.location.href = '/auth/index.html';
                } else if (event === 'TOKEN_REFRESHED') {
                    console.log('Supabase Auth: Token refreshed.');
                    if (session?.user && state.currentUser?.id !== session.user.id) {
                         state.currentUser = session.user;
                    }
                } else if (event === 'USER_UPDATED') {
                    console.log('Supabase Auth: User updated.');
                    if (session?.user) { state.currentUser = session.user; }
                } else if (event === 'PASSWORD_RECOVERY') {
                     console.log('Supabase Auth: Password recovery event.');
                }
            });

            isInitialized = true;
            console.log("Supabase client initialized successfully with Auth Listener.");
            return client;

        } catch (error) {
            console.error("Supabase service initialization failed:", error);
            client = null;
            isInitialized = false;
            return null;
        }
    }

    /**
     * Возвращает инициализированный Supabase клиент.
     * @returns {object|null}
     */
    function getClient() {
        if (!isInitialized) {
            console.warn("Supabase client accessed before initialization. Trying to initialize now.");
            initialize();
        }
        if (!client) {
            console.error("Cannot get Supabase client, initialization failed.");
        }
        return client;
    }

    // --- Экспортируемые функции сервиса ---

    async function fetchUserProfile(userId) {
        const supabase = getClient();
        if (!supabase) return null;
        if (!userId) { console.error("fetchUserProfile: User ID is missing."); return null; }

        console.log(`[Supabase] Fetching profile for user ID: ${userId}`);
        try {
            const { data: profile, error, status } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') { // Standard code for "Not Found"
                    console.warn(`[Supabase] Profile not found for user ${userId} (status: ${status}).`);
                    return null;
                } else {
                    console.error('[Supabase] Error fetching profile:', error.message, `(status: ${status}, code: ${error.code})`);
                    throw error;
                }
            }
            if (!profile) {
                console.warn(`[Supabase] Profile data is unexpectedly null for user ${userId}.`);
                return null;
            }
            console.log("[Supabase] Profile data fetched successfully.");
            return profile;
        } catch (error) {
            console.error('[Supabase] Exception during profile fetch execution:', error);
            return null;
        }
    }

    async function awardPoints(userId, pointsValue) {
        const supabase = getClient();
        if (!supabase) { console.error("[Points] Supabase client not initialized."); return false; }
        if (!userId || typeof pointsValue !== 'number' || pointsValue <= 0) {
            console.warn("[Points] Skipping point award (invalid input):", { userId, pointsValue });
            return false;
        }
        // !!! ВАЖНО: ПРОВЕРЬТЕ ЭТО ИМЯ В SUPABASE -> SQL Editor -> Database Functions !!!
        const functionName = 'increment_user_points';

        // !!! ВАЖНО: ПРОВЕРЬТЕ ИМЕНА ПАРАМЕТРОВ В ОПРЕДЕЛЕНИИ ФУНКЦИИ В SUPABASE !!!
        const parameters = {
            user_id_input: userId,      // Имя параметра 1
            points_to_add: pointsValue  // Имя параметра 2
        };

        // --- ДОПОЛНИТЕЛЬНОЕ ЛОГИРОВАНИЕ ПЕРЕД ВЫЗОВОМ ---
        console.log(`[Points] Preparing to call RPC function '${functionName}' with parameters:`, JSON.stringify(parameters));
        console.log(`[Points] Target URL should be approximately: ${supabase.restUrl}/rpc/${functionName}`);
        console.log(`[Points] User ID: ${userId}, Points to add: ${pointsValue}`);
        // --- Конец дополнительного логирования ---

        try {
            const { data, error } = await supabase.rpc(functionName, parameters);

            if (error) {
                // Расширенное логирование ошибок
                console.error(`[Points] RPC Error calling '${functionName}':`, {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code // '42883' function does not exist, '42703' column does not exist, 'PGRST116' Not Found (может быть из-за RLS или неправильного endpoint)
                });

                if (error.code === '42883') {
                     console.error(`[Points] CRITICAL: Function '${functionName}' does not exist in Supabase schema or is not exposed via API. Check function name and API schema settings.`);
                     // showToast('Chyba funkce', `Funkce '${functionName}' nenalezena. Kontaktujte administrátora.`, 'error');
                } else if (error.code === '42703') {
                     console.error(`[Points] CRITICAL: One of the parameters (${Object.keys(parameters).join(', ')}) does not match the function definition in Supabase.`);
                } else if (error.code === 'PGRST116' || (error.message && error.message.toLowerCase().includes('not found'))) {
                     console.error(`[Points] CRITICAL: RPC endpoint '/rpc/${functionName}' not found. Check API settings or function deployment status.`);
                } else if (error.message && error.message.toLowerCase().includes('permission denied')) {
                     console.error(`[Points] CRITICAL: Permission denied for function '${functionName}'. Check RLS policies and role permissions (e.g., GRANT EXECUTE ON FUNCTION ${functionName} TO authenticated;).`);
                }
                // Перебрасываем ошибку для обработки выше
                throw error;
            }

            // Успешный вызов RPC
            const newPoints = data;
            console.log(`[Points] RPC function '${functionName}' executed successfully. Result/New Points:`, newPoints);

            // Обновление локального состояния очков
            if (state.currentUser && state.currentUser.id === userId && state.currentProfile) {
                if (typeof newPoints === 'number') {
                    state.currentProfile.points = newPoints;
                    console.log(`[Profile Update] Local points updated to ${newPoints}.`);
                } else {
                    const oldPoints = state.currentProfile.points || 0;
                    state.currentProfile.points = oldPoints + pointsValue;
                    console.warn(`[Profile Update] RPC did not return new total points (Returned: ${JSON.stringify(newPoints)}). Estimating local points to ${state.currentProfile.points}.`);
                }
                // Обновление UI должно быть вызвано из vyukaApp.js
            }

            return true; // Успех

        } catch (error) {
            // Логируем ошибку еще раз на уровне catch (может быть полезно для не-RPC ошибок)
            console.error(`[Points] Exception during awardPoints execution for user ${userId}:`, error);
            // Не показываем toast здесь, пусть обрабатывает вызывающая функция
            return false; // Неудача
        }
    }


    async function fetchNotifications(userId, limit = 5) {
        const supabase = getClient();
        if (!supabase || !userId) { console.error("[Notifications] Missing client or User ID."); return { unreadCount: 0, notifications: [] }; }
        console.log(`[Supabase] Fetching unread notifications for user ${userId}, limit ${limit}`);
        try {
            const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit);
            if (error) throw error;
            console.log(`[Supabase] Fetched ${data?.length || 0} notifications. Total unread: ${count ?? 0}`);
            return { unreadCount: count ?? 0, notifications: data || [] };
        } catch (error) { console.error("[Supabase] Exception fetching notifications:", error); return { unreadCount: 0, notifications: [] }; }
    }

    async function markNotificationRead(notificationId, userId) {
         const supabase = getClient();
         if (!supabase || !notificationId || !userId) { console.error("[Notifications] Missing data for mark read."); return false; }
         console.log("[Supabase] Marking notification as read:", notificationId);
         try {
             const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('id', notificationId).eq('user_id', userId);
             if (error) throw error;
             console.log("[Supabase] Mark as read successful for ID:", notificationId); return true;
         } catch (error) { console.error("[Supabase] Mark as read exception:", error); return false; }
    }

    async function markAllNotificationsRead(userId) {
         const supabase = getClient();
         if (!supabase || !userId) { console.error("[Notifications] Missing data for mark all."); return false; }
         console.log("[Supabase] Marking all as read for user:", userId);
         try {
             const { error } = await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
             if (error) throw error;
             console.log("[Supabase] Mark all as read successful in DB."); return true;
         } catch (error) { console.error("[Supabase] Mark all as read exception:", error); return false; }
    }

    async function loadNextUncompletedTopic(userId) {
        const supabase = getClient();
        if (!supabase || !userId) { console.error("loadNextUncompletedTopic: Missing client or userId."); return { success: false, reason: 'init_error', message: 'Chybí spojení nebo uživatel.' }; }
        console.log(`[Topic] Loading next topic for user ${userId}`);
        try {
            const { data: plans, error: planError } = await supabase.from('study_plans').select('id').eq('user_id', userId).eq('status', 'active').limit(1);
            if (planError) throw planError;
            if (!plans || plans.length === 0) return { success: false, reason: 'no_plan', message: 'Nebyl nalezen žádný aktivní studijní plán.' };
            const planId = plans[0].id;
            const { data: activities, error: activityError } = await supabase.from('plan_activities').select('id, title, description, topic_id').eq('plan_id', planId).eq('completed', false).order('day_of_week').order('time_slot').limit(1);
            if (activityError) throw activityError;
            if (activities && activities.length > 0) {
                const activity = activities[0]; let name = activity.title || 'Nespecifikováno'; let desc = activity.description || '';
                if (activity.topic_id) { try { const { data: topic } = await supabase.from('exam_topics').select('name, description').eq('id', activity.topic_id).single(); if (topic) { name = topic.name || name; desc = topic.description || desc; } } catch(e) { console.warn(`[Topic] Could not fetch topic details for ID ${activity.topic_id}:`, e); } }
                return { success: true, topic: { activity_id: activity.id, plan_id: planId, name: name, description: desc, user_id: userId, topic_id: activity.topic_id } };
            } else { return { success: false, reason: 'plan_complete', message: 'Gratulujeme, všechny aktivity v plánu jsou dokončeny!' }; }
        } catch (error) { console.error('[Topic] Error loading next topic:', error); return { success: false, reason: 'load_error', message: `Chyba načítání tématu: ${error.message}` }; }
    }

    async function markTopicComplete(activityId, userId) {
         const supabase = getClient();
         if (!supabase || !activityId || !userId) { console.error("markTopicComplete: Missing data."); return false; }
         console.log(`[TopicComplete] Marking activity ${activityId} as complete`);
         try {
             const { error } = await supabase.from('plan_activities').update({ completed: true, updated_at: new Date().toISOString() }).eq('id', activityId);
             if (error) throw error;
             console.log(`[TopicComplete] Activity ${activityId} marked complete in DB.`); return true;
         } catch (error) { console.error(`[TopicComplete] Error marking activity ${activityId} complete:`, error); return false; }
    }

    async function saveChatMessage(messageData) {
        const supabase = getClient();
        if (!supabase) { console.error("saveChatMessage: Supabase client not initialized."); return false; }
        if (!messageData.user_id || !messageData.session_id || !messageData.role || typeof messageData.content === 'undefined') { // Allow empty content string ''
             console.error("saveChatMessage: Missing required data (userId, sessionId, role, or content)", messageData);
             return false;
         }
        console.log("[ChatSave] Saving message to DB...");
        try {
            const { error } = await supabase.from('chat_history').insert({ user_id: messageData.user_id, session_id: messageData.session_id, topic_id: messageData.topic_id || null, topic_name: messageData.topic_name || null, role: messageData.role, content: messageData.content });
            if (error) throw error;
            console.log("[ChatSave] Message saved successfully."); return true;
        } catch (error) { console.error("[ChatSave] DB error saving chat message:", error); return false; }
    }

    async function deleteChatSessionHistory(userId, sessionId) {
         const supabase = getClient();
         if (!supabase || !userId || !sessionId) { console.error("deleteChatSessionHistory: Missing required data"); return false; }
         console.log(`[ChatDelete] Deleting chat history for session: ${sessionId}`);
         try {
             const { error } = await supabase.from('chat_history').delete().match({ user_id: userId, session_id: sessionId });
             if (error) throw error;
             console.log(`[ChatDelete] Chat history deleted from DB for session: ${sessionId}`); return true;
         } catch (e) { console.error("[ChatDelete] DB clear chat error:", e); return false; }
    }


    // Возвращаем публичный интерфейс сервиса
    return {
        initialize,
        getClient,
        fetchUserProfile,
        awardPoints,
        fetchNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        loadNextUncompletedTopic,
        markTopicComplete,
        saveChatMessage,
        deleteChatSessionHistory
    };
})();

// --- Экспортируем функции ---
export const {
    initialize: initializeSupabase,
    getClient: getSupabaseClient,
    fetchUserProfile,
    awardPoints,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    loadNextUncompletedTopic,
    markTopicComplete,
    saveChatMessage,
    deleteChatSessionHistory
} = SupabaseService;

console.log("Supabase service module loaded (v3.8 with RPC param logging).");