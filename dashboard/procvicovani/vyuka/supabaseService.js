// supabaseService.js - Функции для взаимодействия с Supabase

// ODSTRANĚN NESPRÁVNÝ IMPORT, pokud zde byl:
// import { createClient } from '@supabase/supabase-js'; // <-- TOTO JE POTŘEBA ODSTRANIT NEBO ZAKOMENTOVAT

import { SUPABASE_URL, SUPABASE_ANON_KEY, POINTS_TOPIC_COMPLETE } from './config.js';
import { state } from './state.js';
// import { showToast } from './uiHelpers.js'; // Importujte, pokud chcete zde zobrazovat toasty

// Инициализируем клиент Supabase один раз при загрузке модуля
export let supabaseClient = null;

/**
 * Inicializuje Supabase klienta pomocí globálního objektu window.supabase.
 * @returns {object|null} Instance Supabase klienta nebo null při chybě.
 */
export function initializeSupabase() {
    try {
        // Používáme window.supabase, protože je načteno přes <script> v HTML
        if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log("Supabase client initialized via window.supabase.");
        } else {
            // Log detailnější chyby
            if (typeof window === 'undefined') {
                 console.error("Supabase init failed: 'window' object is not available.");
            } else if (!window.supabase) {
                 console.error("Supabase init failed: 'window.supabase' is not defined. Check if Supabase V2 CDN script is loaded correctly in HTML.");
            } else if (typeof window.supabase.createClient !== 'function') {
                 console.error("Supabase init failed: 'window.supabase.createClient' is not a function. Possible script load issue or conflict.");
            }
            throw new Error("Supabase library (window.supabase.createClient) not available.");
        }

        if (!supabaseClient) {
            throw new Error("Supabase client creation failed unexpectedly.");
        }

        // Nastavení pro odhlášení uživatele, pokud token vypršel (volitelné, ale dobrá praxe)
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                console.log('Supabase Auth: User signed in.');
                // Možná aktualizace stavu aplikace, pokud je potřeba
            } else if (event === 'SIGNED_OUT') {
                console.log('Supabase Auth: User signed out.');
                state.currentUser = null;
                state.currentProfile = null;
                // Zde můžete přesměrovat na přihlášení nebo aktualizovat UI
                // např. window.location.href = '/auth/index.html';
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('Supabase Auth: Token refreshed.');
            } else if (event === 'USER_UPDATED') {
                console.log('Supabase Auth: User updated.');
                 if (session?.user) { state.currentUser = session.user; }
            } else if (event === 'PASSWORD_RECOVERY') {
                 console.log('Supabase Auth: Password recovery event.');
            }
        });


        return supabaseClient; // Vrací klienta pro uložení do stavu (state)
    } catch (error) {
        console.error("Supabase service initialization failed:", error);
        // Zde můžete zobrazit chybu uživateli pomocí importované showError funkce
        // showError("Kritická chyba: Nelze se připojit k databázi.", true);
        supabaseClient = null;
        return null;
    }
}

/**
 * Načte profil uživatele z databáze.
 * @param {string} userId - ID uživatele.
 * @returns {Promise<object|null>} Objekt profilu nebo null při chybě/nenalezení.
 */
export async function fetchUserProfile(userId) {
    if (!supabaseClient) {
        console.error("fetchUserProfile: Supabase client not initialized.");
        return null;
    }
    if (!userId) {
        console.error("fetchUserProfile: User ID is missing.");
        return null;
    }

    console.log(`[Supabase] Fetching profile for user ID: ${userId}`);
    try {
        const { data: profile, error, status } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            // Chyba 'PGRST116' znamená, že záznam nebyl nalezen, což nemusí být nutně chyba aplikace
            if (error.code === 'PGRST116') {
                console.warn(`[Supabase] Profile not found for user ${userId} (status: ${status}).`);
                return null; // Explicitně vracíme null, pokud profil neexistuje
            } else {
                // Ostatní chyby logujeme a házíme dál
                console.error('[Supabase] Error fetching profile:', error.message, `(status: ${status}, code: ${error.code})`);
                throw error; // Znovu vyhodíme chybu pro zpracování výše
            }
        }

        if (!profile) {
            // Tento případ by neměl nastat, pokud error.code nebyl PGRST116, ale pro jistotu
            console.warn(`[Supabase] Profile data is unexpectedly null for user ${userId} despite no specific error.`);
            return null;
        }

        console.log("[Supabase] Profile data fetched successfully.");
        return profile;
    } catch (error) {
        // Zde zachytáváme chyby vyhozené z try bloku nebo neočekávané chyby
        console.error('[Supabase] Exception during profile fetch execution:', error);
        // showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error');
        return null; // Vracíme null, aby volající funkce věděla o selhání
    }
}

/**
 * Přidá body uživateli v databázi.
 * @param {string} userId - ID uživatele.
 * @param {number} pointsValue - Počet bodů k přidání.
 * @returns {Promise<boolean>} True při úspěchu, false při selhání.
 */
export async function awardPoints(userId, pointsValue) {
    if (!supabaseClient) { console.error("[Points] Supabase client not initialized."); return false; }
    if (!userId || typeof pointsValue !== 'number' || pointsValue <= 0) {
        console.warn("[Points] Skipping point award (invalid input):", { userId, pointsValue });
        return false;
    }

    // 1. Získání aktuálního profilu pro body (minimalizuje race condition)
    console.log(`[Points] Fetching current points for user ${userId} before awarding.`);
    let currentPoints = 0;
    try {
         // Použijeme RPC volání pro atomické navýšení bodů
         const { data, error } = await supabaseClient.rpc('increment_user_points', {
             user_id_input: userId,
             points_to_add: pointsValue
         });

         if (error) {
             console.error(`[Points] RPC Error updating points:`, error);
             throw error;
         }

         const newPoints = data; // RPC funkce by měla vrátit nový počet bodů
         console.log(`[Points] User points updated via RPC to ${newPoints}. Awarded: ${pointsValue}`);

         // Aktualizace lokálního stavu (pokud existuje a je relevantní)
         if (state.currentUser && state.currentUser.id === userId && state.currentProfile) {
             state.currentProfile.points = newPoints;
         }
         return true;

    } catch (error) {
         console.error(`[Points] Exception awarding points for user ${userId}:`, error);
         // showToast('Chyba kreditů', 'Nepodařilo se připsat kredity.', 'error');
         return false;
    }
}

// --- Функции Уведомлений --- (bez zásadních změn, jen drobné logování)

/**
 * Načte nepřečtená oznámení pro uživatele.
 * @param {string} userId - ID uživatele.
 * @param {number} [limit=5] - Maximální počet oznámení k načtení.
 * @returns {Promise<{unreadCount: number, notifications: Array<object>}>} Objekt s počtem a polem oznámení.
 */
export async function fetchNotifications(userId, limit = 5) {
    if (!supabaseClient || !userId) {
        console.error("[Notifications] Missing Supabase client or User ID.");
        return { unreadCount: 0, notifications: [] };
    }
    console.log(`[Supabase] Fetching unread notifications for user ${userId}, limit ${limit}`);
    try {
        const { data, error, count } = await supabaseClient
            .from('user_notifications')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[Supabase] Error fetching notifications:', error);
            throw error;
        }
        console.log(`[Supabase] Fetched ${data?.length || 0} notifications. Total unread: ${count ?? 0}`);
        return { unreadCount: count ?? 0, notifications: data || [] };
    } catch (error) {
        console.error("[Supabase] Exception fetching notifications:", error);
        // showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error');
        return { unreadCount: 0, notifications: [] };
    }
}

/**
 * Označí konkrétní oznámení jako přečtené.
 * @param {string} notificationId - ID oznámení.
 * @param {string} userId - ID uživatele (pro ověření vlastnictví).
 * @returns {Promise<boolean>} True při úspěchu, false při selhání.
 */
export async function markNotificationRead(notificationId, userId) {
    if (!supabaseClient || !notificationId || !userId) {
        console.error("[Notifications] Missing Supabase client, notificationId, or userId for mark read.");
        return false;
    }
    console.log("[Supabase] Marking notification as read:", notificationId);
    try {
        // Přidána kontrola user_id pro bezpečnost
        const { error } = await supabaseClient
            .from('user_notifications')
            .update({ is_read: true })
            .eq('id', notificationId)
            .eq('user_id', userId); // <- Ověření uživatele

        if (error) {
            console.error('[Supabase] Mark as read error:', error);
            throw error;
        }
        console.log("[Supabase] Mark as read successful for ID:", notificationId);
        return true;
    } catch (error) {
        console.error("[Supabase] Mark as read exception:", error);
        // showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error');
        return false;
    }
}

/**
 * Označí všechna nepřečtená oznámení uživatele jako přečtená.
 * @param {string} userId - ID uživatele.
 * @returns {Promise<boolean>} True při úspěchu, false při selhání.
 */
export async function markAllNotificationsRead(userId) {
    if (!supabaseClient || !userId) {
         console.error("[Notifications] Missing Supabase client or userId for mark all.");
         return false;
    }
    console.log("[Supabase] Marking all as read for user:", userId);
    try {
        const { error } = await supabaseClient
            .from('user_notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false); // Cílíme jen na nepřečtené

        if (error) {
            console.error('[Supabase] Mark all as read error:', error);
            throw error;
        }
        console.log("[Supabase] Mark all as read successful in DB.");
        return true;
    } catch (error) {
        console.error("[Supabase] Mark all as read exception:", error);
        // showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error');
        return false;
    }
}

// --- Функции Учебного Плана и Тем --- (bez zásadních změn, jen drobné logování)

/**
 * Načte další nedokončenou aktivitu z aktivního plánu uživatele.
 * @param {string} userId - ID uživatele.
 * @returns {Promise<{success: boolean, reason?: string, message?: string, topic?: object}>} Výsledek operace.
 */
export async function loadNextUncompletedTopic(userId) {
    if (!supabaseClient || !userId) {
        console.error("loadNextUncompletedTopic: Missing Supabase client or userId.");
        return { success: false, reason: 'init_error', message: 'Chybí spojení nebo uživatel.' };
    }
    console.log(`[Topic] Loading next topic for user ${userId}`);
    try {
        // 1. Najít aktivní plán uživatele
        const { data: plans, error: planError } = await supabaseClient
            .from('study_plans')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'active') // Hledáme pouze aktivní plány
            .limit(1);

        if (planError) throw planError;
        if (!plans || plans.length === 0) {
            console.log("[Topic] No active plan found.");
            return { success: false, reason: 'no_plan', message: 'Nebyl nalezen žádný aktivní studijní plán.' };
        }
        const planId = plans[0].id;
        console.log(`[Topic] Found active plan ID: ${planId}`);

        // 2. Najít další nedokončenou aktivitu v tomto plánu
        const { data: activities, error: activityError } = await supabaseClient
            .from('plan_activities')
            .select('id, title, description, topic_id') // Načítáme ID tématu pro případné pozdější doplnění detailů
            .eq('plan_id', planId)
            .eq('completed', false)
            .order('day_of_week') // Předpokládáme řazení podle dne a pak času
            .order('time_slot')   // - ujistěte se, že máte indexy pro tyto sloupce
            .limit(1);

        if (activityError) throw activityError;

        if (activities && activities.length > 0) {
            const activity = activities[0];
            console.log(`[Topic] Found next activity ID: ${activity.id}`);
            let name = activity.title || 'Nespecifikováno';
            let desc = activity.description || '';

            // 3. (Volitelné) Načíst detaily tématu, pokud existuje topic_id
            if (activity.topic_id) {
                try {
                    console.log(`[Topic] Fetching details for topic ID: ${activity.topic_id}`);
                    const { data: topic, error: topicError } = await supabaseClient
                        .from('exam_topics') // Předpokládaný název tabulky témat
                        .select('name, description')
                        .eq('id', activity.topic_id)
                        .single();
                    if (topicError && topicError.code !== 'PGRST116') throw topicError;
                    if (topic) {
                        console.log(`[Topic] Topic details found: ${topic.name}`);
                        name = topic.name || name; // Použít název tématu, pokud je k dispozici
                        desc = topic.description || desc; // Stejně tak popis
                    } else {
                         console.warn(`[Topic] Details for topic ID ${activity.topic_id} not found.`);
                    }
                } catch(e) {
                    console.warn(`[Topic] Could not fetch topic details for ID ${activity.topic_id}:`, e);
                }
            }

            const nextTopicData = {
                activity_id: activity.id, // ID konkrétní aktivity v plánu
                plan_id: planId,
                name: name, // Název tématu nebo aktivity
                description: desc, // Popis tématu nebo aktivity
                user_id: userId, // Pro kontext
                topic_id: activity.topic_id // ID tématu z exam_topics (pokud existuje)
            };
            console.log("[Topic] Next topic prepared:", nextTopicData);
            return { success: true, topic: nextTopicData };
        } else {
            console.log("[Topic] Plan is complete (no uncompleted activities).");
            return { success: false, reason: 'plan_complete', message: 'Gratulujeme, všechny aktivity v plánu jsou dokončeny!' };
        }
    } catch (error) {
        console.error('[Topic] Error loading next topic:', error);
        return { success: false, reason: 'load_error', message: `Chyba načítání tématu: ${error.message}` };
    }
}

/**
 * Označí aktivitu v plánu jako dokončenou.
 * @param {string} activityId - ID aktivity v plánu.
 * @param {string} userId - ID uživatele (pro případné další logování nebo kontrolu).
 * @returns {Promise<boolean>} True při úspěchu, false při selhání.
 */
export async function markTopicComplete(activityId, userId) {
    if (!supabaseClient || !activityId || !userId) {
        console.error("markTopicComplete: Missing Supabase client, activityId, or userId.");
        return false;
    }
    console.log(`[TopicComplete] Marking activity ${activityId} as complete for user ${userId}`);
    try {
        const { error } = await supabaseClient
            .from('plan_activities')
            .update({ completed: true, updated_at: new Date().toISOString() })
            .eq('id', activityId); // Není třeba kontrolovat userId, pokud ID aktivity je unikátní

        if (error) throw error;

        console.log(`[TopicComplete] Activity ${activityId} marked complete in DB.`);
        // Body se přidávají ve volající funkci (handleMarkTopicCompleteFlow)
        return true;
    } catch (error) {
        console.error(`[TopicComplete] Error marking activity ${activityId} complete:`, error);
        // showToast("Chyba při označování tématu jako dokončeného.", "error");
        return false;
    }
}


// --- Функции Чата --- (bez zásadních změn, jen drobné logování)

/**
 * Uloží zprávu chatu do databáze.
 * @param {object} messageData - Data zprávy k uložení.
 * @param {string} messageData.user_id - ID uživatele.
 * @param {string} messageData.session_id - ID aktuální chatovací session.
 * @param {string|null} messageData.topic_id - ID tématu (volitelné).
 * @param {string|null} messageData.topic_name - Název tématu (volitelné).
 * @param {'user'|'model'} messageData.role - Role odesílatele.
 * @param {string} messageData.content - Obsah zprávy.
 * @returns {Promise<boolean>} True při úspěchu, false při selhání.
 */
export async function saveChatMessage(messageData) {
    if (!supabaseClient) { console.error("saveChatMessage: Supabase client not initialized."); return false; }
    if (!messageData.user_id || !messageData.session_id || !messageData.role || !messageData.content) {
        console.error("saveChatMessage: Missing required data", messageData);
        return false;
    }
    console.log("[ChatSave] Saving message to DB...");
    try {
        const { error } = await supabaseClient
            .from('chat_history') // Ujistěte se, že tabulka se jmenuje správně
            .insert({
                user_id: messageData.user_id,
                session_id: messageData.session_id,
                topic_id: messageData.topic_id || null, // Volitelné
                topic_name: messageData.topic_name || null, // Volitelné
                role: messageData.role, // 'user' nebo 'model'
                content: messageData.content
                // created_at se nastavuje automaticky v databázi
            });
        if (error) throw error;
        console.log("[ChatSave] Message saved successfully.");
        return true;
    } catch (error) {
        console.error("[ChatSave] DB error saving chat message:", error);
        // showToast("Chyba ukládání chatu.", "error");
        return false;
    }
}

/**
 * Smaže historii zpráv pro danou chatovací session.
 * @param {string} userId - ID uživatele.
 * @param {string} sessionId - ID session.
 * @returns {Promise<boolean>} True při úspěchu, false při selhání.
 */
export async function deleteChatSessionHistory(userId, sessionId) {
     if (!supabaseClient || !userId || !sessionId) {
         console.error("deleteChatSessionHistory: Missing required data");
         return false;
     }
     console.log(`[ChatDelete] Deleting chat history for session: ${sessionId}`);
     try {
         // Použijeme match pro kombinaci podmínek
         const { error } = await supabaseClient
             .from('chat_history')
             .delete()
             .match({ user_id: userId, session_id: sessionId });
         if (error) throw error;
         console.log(`[ChatDelete] Chat history deleted from DB for session: ${sessionId}`);
         return true;
     } catch (e) {
         console.error("[ChatDelete] DB clear chat error:", e);
         // showToast("Chyba při mazání historie chatu z databáze.", "error");
         return false;
     }
}

// --- Инициализация при загрузке модуля ---
// Вызываем инициализацию здесь, чтобы клиент был доступен при импорте функций
initializeSupabase();

console.log("Supabase service module loaded and initialized.");