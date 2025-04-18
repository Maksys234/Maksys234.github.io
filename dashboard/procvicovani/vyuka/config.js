// config.js - Константы и конфигурация приложения Vyuka
// --- Supabase Configuration ---
export const SUPABASE_URL = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';

// --- Gemini API Configuration ---
// !!! ВНИМАНИЕ: Хранение API ключа в клиентском коде НЕБЕЗОПАСНО!
// !!! В реальном приложении этот ключ должен быть на сервере или в serverless-функции.
export const GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs';
export const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- Application Settings ---
export const MAX_GEMINI_HISTORY_TURNS = 10; // Максимальное количество сообщений в истории Gemini
export const NOTIFICATION_FETCH_LIMIT = 5;    // Лимит загрузки уведомлений
export const POINTS_TOPIC_COMPLETE = 25;    // Очки за завершение темы
// export const POINTS_CORRECT_ANSWER = 5; // Очки за правильный ответ (если понадобится)

// --- TTS/STT Settings ---
export const TTS_LANGUAGE = 'cs-CZ';          // Язык для Text-to-Speech
export const TTS_RATE = 0.9;                  // Скорость речи
export const TTS_PITCH = 1.0;                 // Высота голоса
export const STT_LANGUAGE = 'cs-CZ';          // Язык для Speech-to-Text

// --- UI Settings ---
export const TOAST_DEFAULT_DURATION = 4500; // Длительность показа уведомлений (ms)
export const CHAT_TEXTAREA_MAX_HEIGHT = 110; // Макс. высота поля ввода чата (px)

// --- Safety Settings for Gemini ---
export const GEMINI_SAFETY_SETTINGS = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

// --- Generation Config for Gemini ---
export const GEMINI_GENERATION_CONFIG = {
    temperature: 0.6,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 4096
};

console.log("Configuration loaded."); // Для отладки