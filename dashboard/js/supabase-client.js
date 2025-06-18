// dashboard/js/supabase-client.js
// Глобальный модуль для инициализации клиента Supabase.
// Версия: 2.0 - Исправлена ошибка инициализации.

(function(global) {
    'use strict';
    
    if (!global.Justax) {
        global.Justax = {};
    }

    global.Justax.initSupabase = function() {
        const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
        
        try {
            // Проверяем, что библиотека Supabase загружена
            if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
                throw new Error("Knihovna Supabase není načtena nebo createClient není funkce.");
            }
            const client = window.supabase.createClient(supabaseUrl, supabaseKey);
            console.log('[Supabase Client] Klient úspěšně inicializován.');
            return client;
        } catch (error) {
            console.error('[Supabase Client] KRITICKÁ CHYBA INICIALIZACE:', error);
            const errorDiv = document.getElementById('global-error') || document.body;
            errorDiv.innerHTML = `<div style="background-color: #ff3860; color: white; padding: 2rem; text-align: center;"><h1>Kritická chyba</h1><p>Nepodařilo se připojit k databázi.</p></div>`;
            return null;
        }
    };

})(window);