// dashboard/js/supabase-client.js
// Глобальный модуль для инициализации клиента Supabase.
// Версия: 1.1 - Сообщения об ошибках на чешском языке.

(function(global) {
    'use strict';

    // Создаем глобальное пространство имен для нашего приложения, если его еще нет
    if (!global.Justax) {
        global.Justax = {};
    }

    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';

    // Переменная для хранения единственного экземпляра клиента
    let supabaseClient = null;

    /**
     * Инициализирует и возвращает клиент Supabase.
     * Если клиент уже был инициализирован, возвращает существующий экземпляр.
     * @returns {SupabaseClient|null} - Экземпляр клиента Supabase или null в случае ошибки.
     */
    function initSupabase() {
        // Если клиент уже создан, просто возвращаем его (Singleton pattern)
        if (supabaseClient) {
            console.log('[Supabase Client] Возвращаю существующий экземпляр клиента.');
            return supabaseClient;
        }

        console.log('[Supabase Client] Попытка инициализации клиента...');
        try {
            // Проверяем, доступна ли библиотека Supabase
            if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
                throw new Error("Knihovna Supabase není načtena nebo createClient není funkce.");
            }

            supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

            if (!supabaseClient) {
                throw new Error("Vytvoření klienta Supabase se nezdařilo (vrátilo null/undefined).");
            }
            
            // Сохраняем клиент в глобальном пространстве имен для легкого доступа
            global.Justax.supabase = supabaseClient;

            console.log('[Supabase Client] Klient úspěšně inicializován a dostupný v `Justax.supabase`.');
            return supabaseClient;

        } catch (error) {
            console.error('[Supabase Client] KRITICKÁ CHYBA INICIALIZACE:', error);
            
            // Попытка отобразить ошибку пользователю, если это возможно
            const errorDiv = document.getElementById('global-error') || document.body;
            if (errorDiv) {
                errorDiv.innerHTML = `<div style="background-color: #ff33a8; color: white; padding: 2rem; text-align: center; font-family: sans-serif;">
                                        <h1>Kritická chyba</h1>
                                        <p>Nepodařilo se připojit k databázi. Zkontrolujte konzoli pro více informací.</p>
                                      </div>`;
            }
            return null;
        }
    }

    // Экспортируем функцию инициализации в наше глобальное пространство имен
    global.Justax.initSupabase = initSupabase;

})(window);