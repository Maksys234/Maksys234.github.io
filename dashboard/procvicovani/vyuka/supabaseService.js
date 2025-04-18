// supabaseService.js - Функции для взаимодействия с Supabase

import { createClient } from '@supabase/supabase-js'; // Предполагаем использование npm/import map
// Если вы загружаете Supabase через <script>, замените строку выше и используйте window.supabase.createClient
import { SUPABASE_URL, SUPABASE_ANON_KEY, POINTS_TOPIC_COMPLETE } from './config.js';
import { state } from './state.js';
// Импортируйте showToast или другие UI-хелперы, если будете их здесь использовать
// import { showToast } from './ui.js';

// Инициализируем клиент Supabase один раз при загрузке модуля
export let supabaseClient = null;

export function initializeSupabase() {
    try {
        // Если Supabase загружен через <script>, используйте window.supabase
        if (typeof window !== 'undefined' && window.supabase) {
             supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else if (typeof createClient !== 'undefined') {
             // Если используете import (npm)
             supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
             throw new Error("Supabase library not found.");
        }

        if (!supabaseClient) throw new Error("Client creation failed.");
        console.log("Supabase client initialized in service.");
        return supabaseClient; // Возвращаем клиент для сохранения в state (опционально)
    } catch (error) {
        console.error("Supabase init failed in service:", error);
        // Здесь можно вызвать showError, если он импортирован, или просто вернуть null/false
        // showError("Kritická chyba: Nelze se připojit.", true);
        supabaseClient = null;
        return null;
    }
}

// --- Функции Профиля ---
export async function fetchUserProfile(userId) {
    if (!supabaseClient || !userId) {
        console.error("fetchUserProfile: Supabase client or userId missing.");
        return null;
    }
    console.log(`[Supabase] Fetching profile for user ID: ${userId}`);
    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // Игнорируем ошибку "не найдено", но логируем другие
            console.error('[Supabase] Error fetching profile:', error);
            throw error;
        }
        if (!profile) {
            console.warn(`[Supabase] Profile not found for user ${userId}.`);
            return null;
        }
        console.log("[Supabase] Profile data fetched successfully.");
        return profile;
    } catch (error) {
        console.error('[Supabase] Exception fetching profile:', error);
        // showToast('Chyba Profilu', 'Nepodařilo se načíst data profilu.', 'error');
        return null; // Возвращаем null, чтобы вызывающая функция обработала ошибку
    }
}

export async function awardPoints(userId, pointsValue) {
    if (!supabaseClient || !userId || !pointsValue || pointsValue <= 0) {
        console.warn("[Points] Skipping point award (invalid input):", { userId, pointsValue });
        return false;
    }

    // Получаем текущий профиль, чтобы узнать текущие очки
    const currentProfileData = await fetchUserProfile(userId);
    if (!currentProfileData) {
        console.error(`[Points] Cannot award points: Profile not found for user ${userId}.`);
        return false;
    }

    console.log(`[Points] Awarding ${pointsValue} points to user ${userId}`);
    const currentPoints = currentProfileData.points || 0;
    const newPoints = currentPoints + pointsValue;

    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ points: newPoints, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (error) {
            console.error(`[Points] Error updating user points in DB:`, error);
            throw error;
        }

        console.log(`[Points] User points updated to ${newPoints}`);
        // Обновляем state.currentProfile, если он используется глобально
        if (state.currentUser && state.currentUser.id === userId && state.currentProfile) {
             state.currentProfile.points = newPoints;
        }
        return true;
    } catch (error) {
        console.error(`[Points] Exception updating user points:`, error);
        // showToast('Chyba', 'Nepodařilo se aktualizovat kredity.', 'error');
        return false;
    }
}

// --- Функции Уведомлений ---
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
        console.log(`[Supabase] Fetched ${data?.length || 0} notifications. Total unread: ${count}`);
        return { unreadCount: count ?? 0, notifications: data || [] };
    } catch (error) {
        console.error("[Supabase] Exception fetching notifications:", error);
        // showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error');
        return { unreadCount: 0, notifications: [] };
    }
}

export async function markNotificationRead(notificationId, userId) {
    if (!supabaseClient || !notificationId || !userId) {
        console.error("[Notifications] Missing Supabase client, notificationId, or userId.");
        return false;
    }
    console.log("[Supabase] Marking notification as read:", notificationId);
    try {
        const { error } = await supabaseClient
            .from('user_notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('id', notificationId);

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
            .eq('is_read', false);

        if (error) {
            console.error('[Supabase] Mark all as read error:', error);
            throw error;
        }
        console.log("[Supabase] Mark all as read successful in DB.");
        return true; // Indicate success
    } catch (error) {
        console.error("[Supabase] Mark all as read exception:", error);
        // showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error');
        return false; // Indicate failure
    }
}

// --- Функции Учебного Плана и Тем ---
export async function loadNextUncompletedTopic(userId) {
    if (!supabaseClient || !userId) {
        console.error("loadNextUncompletedTopic: Missing Supabase client or userId.");
        return { success: false, reason: 'init_error', message: 'Chybí spojení nebo uživatel.' };
    }
    console.log(`[Topic] Loading next topic for user ${userId}`);
    try {
        // 1. Найти активный план пользователя
        const { data: plans, error: planError } = await supabaseClient
            .from('study_plans')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'active')
            .limit(1);

        if (planError) throw planError;
        if (!plans || plans.length === 0) {
            console.log("[Topic] No active plan found.");
            return { success: false, reason: 'no_plan', message: 'Nebyl nalezen žádný aktivní studijní plán.' };
        }
        const planId = plans[0].id;

        // 2. Найти следующую незавершенную активность в этом плане
        const { data: activities, error: activityError } = await supabaseClient
            .from('plan_activities')
            .select('id, title, description, topic_id') // Убрал topic(name, description) для упрощения
            .eq('plan_id', planId)
            .eq('completed', false)
            .order('day_of_week')
            .order('time_slot')
            .limit(1);

        if (activityError) throw activityError;

        if (activities && activities.length > 0) {
            const activity = activities[0];
            let name = activity.title || 'N/A';
            let desc = activity.description || '';

            // 3. (Опционально) Загрузить детали темы, если есть topic_id
            if (activity.topic_id) {
                try {
                    const { data: topic, error: topicError } = await supabaseClient
                        .from('exam_topics')
                        .select('name, description')
                        .eq('id', activity.topic_id)
                        .single();
                    if (topicError && topicError.code !== 'PGRST116') throw topicError;
                    if (topic) {
                        name = topic.name || name;
                        desc = topic.description || desc;
                    }
                } catch(e) {
                    console.warn("Could not fetch topic details:", e); // Не критично, если не удалось
                }
            }

            const nextTopicData = {
                activity_id: activity.id,
                plan_id: planId,
                name: name,
                description: desc,
                user_id: userId,
                topic_id: activity.topic_id
            };
            console.log("[Topic] Next topic found:", nextTopicData);
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
            .eq('id', activityId);

        if (error) throw error;

        // Потенциально вызываем awardPoints отсюда или в вызывающей функции
        // const success = await awardPoints(userId, POINTS_TOPIC_COMPLETE);
        // if (!success) { showToast('Varování', 'Téma dokončeno, ale body se nepodařilo připsat.', 'warning'); }

        console.log(`[TopicComplete] Activity ${activityId} marked complete.`);
        return true;
    } catch (error) {
        console.error(`[TopicComplete] Error marking activity ${activityId} complete:`, error);
        // showToast("Chyba při označování tématu jako dokončeného.", "error");
        return false;
    }
}

// --- Функции Чата ---
export async function saveChatMessage(messageData) {
    if (!supabaseClient || !messageData.user_id || !messageData.session_id || !messageData.role || !messageData.content) {
        console.error("saveChatMessage: Missing required data", messageData);
        return false;
    }
    console.log("[ChatSave] Saving message to DB...");
    try {
        const { error } = await supabaseClient
            .from('chat_history') // Убедитесь, что таблица называется так
            .insert({
                user_id: messageData.user_id,
                session_id: messageData.session_id,
                topic_id: messageData.topic_id || null, // Опционально
                topic_name: messageData.topic_name || null, // Опционально
                role: messageData.role, // 'user' или 'model'
                content: messageData.content
                // created_at устанавливается автоматически в базе данных
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

export async function deleteChatSessionHistory(userId, sessionId) {
     if (!supabaseClient || !userId || !sessionId) {
         console.error("deleteChatSessionHistory: Missing required data");
         return false;
     }
     console.log(`[ChatDelete] Deleting chat history for session: ${sessionId}`);
     try {
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
initializeSupabase(); // Вызываем инициализацию здесь