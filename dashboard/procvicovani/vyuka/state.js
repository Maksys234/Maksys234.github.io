// state.js - Глобальное состояние приложения Vyuka

// Экспортируем объект state, чтобы его можно было импортировать и изменять в других модулях.
// Важно: Прямое изменение этого объекта из разных модулей может усложнить отладку.
// При усложнении логики можно создать функции-сеттеры внутри этого файла.
export let state = {
    supabase: null,               // Клиент Supabase (будет инициализирован позже)
    currentUser: null,            // Данные текущего пользователя Supabase Auth
    currentProfile: null,         // Данные профиля пользователя из таблицы 'profiles'

    currentTopic: null,           // Текущая тема для изучения { activity_id, plan_id, name, description, user_id, topic_id }
    currentPlanId: null,          // ID текущего активного учебного плана
    currentSessionId: null,       // Уникальный ID текущей сессии обучения/чата

    geminiChatContext: [],        // История сообщений для Gemini API
    geminiIsThinking: false,      // Флаг: идет ли запрос к Gemini
    thinkingIndicatorId: null,    // ID DOM-элемента индикатора "AI думает..."

    topicLoadInProgress: false,   // Флаг: идет ли загрузка темы/активности
    isDarkMode: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches, // Текущая тема

    boardContentHistory: [],      // История Markdown-контента на доске (если нужно)

    // Возможности браузера
    speechSynthesisSupported: ('speechSynthesis' in window), // Поддержка TTS
    czechVoice: null,             // Найденный чешский голос для TTS
    speechRecognitionSupported: ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window), // Поддержка STT
    speechRecognition: null,      // Экземпляр объекта SpeechRecognition
    isListening: false,           // Флаг: идет ли распознавание речи
    currentlyHighlightedChunk: null, // DOM-элемент подсвечиваемого блока при TTS

    // Состояния загрузки для разных частей приложения
    isLoading: {
        currentTopic: false,
        chat: false,
        user: false,
        notifications: false,
        points: false,
        // Можно добавить другие по необходимости
    },

    aiIsWaitingForAnswer: false // Флаг: ожидает ли ИИ ответ от пользователя на конкретный вопрос
};

console.log("Initial application state created:", state.isDarkMode ? "Dark mode detected" : "Light mode detected");