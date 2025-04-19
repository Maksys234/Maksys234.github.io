// speechService.js - Функции для Text-to-Speech (TTS) и Speech-to-Text (STT) - v3.6 (Исправление Zastavit)

import { state } from './state.js';
import { ui } from './ui.js';
import { TTS_LANGUAGE, TTS_RATE, TTS_PITCH, STT_LANGUAGE } from './config.js';
// Закомментировано, т.к. showToast лучше вызывать из основного потока приложения
// import { showToast } from './uiHelpers.js';

// --- Text-to-Speech (TTS) ---

/**
 * Загружает и выбирает подходящий чешский голос для TTS.
 */
export function loadVoices() {
    if (!state.speechSynthesisSupported) return;
    try {
        const voices = window.speechSynthesis.getVoices();
        if (!voices || voices.length === 0) {
            console.warn("[TTS] No voices available yet. Waiting for 'onvoiceschanged'.");
            // Гарантируем, что обработчик назначен только один раз
            if (!window.speechSynthesis.onvoiceschanged) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
            return;
        }
        console.log('[TTS] Available voices:', voices.map(v => ({ name: v.name, lang: v.lang, default: v.default })));

        // Улучшенный поиск голоса
        let preferredVoice = voices.find(voice => voice.lang === TTS_LANGUAGE && /female|žena|ženský|iveta|zuzana/i.test(voice.name));
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang === TTS_LANGUAGE);
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang.startsWith('cs'));
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.default && voice.lang.startsWith('cs'));
        // Если чешский не найден, ищем английский как запасной
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang.startsWith('en'));
        // Если и английского нет, берем любой стандартный или первый
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.default) || voices[0];

        state.czechVoice = preferredVoice;
        console.log("[TTS] Selected voice:", state.czechVoice?.name, state.czechVoice?.lang || 'N/A');

        // Удаляем обработчик после успешной загрузки, чтобы не срабатывал повторно
        window.speechSynthesis.onvoiceschanged = null;

    } catch (e) {
        console.error("[TTS] Error loading voices:", e);
        state.czechVoice = null;
    }
}

/**
 * Снимает подсветку с текущего воспроизводимого блока на доске.
 */
export function removeBoardHighlight() {
    if (state.currentlyHighlightedChunk) {
        state.currentlyHighlightedChunk.classList.remove('speaking-highlight');
        state.currentlyHighlightedChunk = null;
    }
}

/**
 * Очищает текст от HTML/Markdown и произносит его с помощью TTS.
 * @param {string} text - Текст для произношения.
 * @param {HTMLElement|null} targetChunkElement - Элемент на доске для подсветки (опционально).
 */
export function speakText(text, targetChunkElement = null) {
    console.log("[TTS] speakText called.");
    if (!state.speechSynthesisSupported) { console.warn("TTS not supported."); return; }
    if (!text) { console.warn("[TTS] No text provided."); return; }

    // Улучшенная очистка текста (сохраняем знаки препинания)
    const plainText = text
        .replace(/<br\s*\/?>/gi, '\n') // Заменяем <br> на перенос строки
        .replace(/<[^>]*>/g, ' ')       // Удаляем остальные HTML теги
        .replace(/```[\s\S]*?```/g, ' (ukázka kódu) ') // Заменяем блоки кода
        .replace(/`([^`]+)`/g, '$1')   // Удаляем обратные кавычки у inline кода
        .replace(/!\[.*?\]\(.*?\)/g, ' (obrázek) ') // Заменяем изображения
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Оставляем текст ссылок
        .replace(/(\*\*|__)(.*?)\1/g, '$2') // Удаляем **bold** и __bold__
        .replace(/(\*|_)(.*?)\1/g, '$2')   // Удаляем *italic* и _italic_
        .replace(/~{2}(.*?)~{2}/g, '$1') // Удаляем ~~strikethrough~~
        .replace(/^\s*#+\s*/gm, '')      // Удаляем # в начале строк (заголовки)
        .replace(/^\s*>\s*/gm, '')       // Удаляем > в начале строк (цитаты)
        .replace(/^\s*-\s*/gm, '')       // Удаляем - в начале строк (списки)
        .replace(/^\s*\d+\.\s*/gm, '') // Удаляем '1.' в начале строк (списки)
        .replace(/\$\$(.*?)\$\$/g, 'matematický vzorec') // Заменяем блочные формулы
        .replace(/\$(.*?)\$/g, 'vzorec') // Заменяем inline формулы
        .replace(/\s+/g, ' ').trim(); // Убираем лишние пробелы

    if (!plainText) { console.warn("[TTS] Text is empty after cleaning."); return; }

    // Отменяем предыдущую речь, если она есть
    if (window.speechSynthesis.speaking) {
        console.log("[TTS] Attempting to cancel previous speech before starting new one...");
        window.speechSynthesis.cancel(); // Остановить предыдущее
    }
    removeBoardHighlight(); // Снять подсветку

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = state.czechVoice?.lang || TTS_LANGUAGE; // Используем язык выбранного голоса
    utterance.rate = TTS_RATE;
    utterance.pitch = TTS_PITCH;

    if (state.czechVoice) { utterance.voice = state.czechVoice; }
    else {
        console.warn("[TTS] Czech voice not loaded, attempting to load now and use default.");
        loadVoices(); // Попытка загрузить голоса снова
        if (state.czechVoice) { utterance.voice = state.czechVoice; }
    }

    utterance.onstart = () => {
        console.log(`[TTS] Speech STARTED. State: speaking=${window.speechSynthesis.speaking}, pending=${window.speechSynthesis.pending}, paused=${window.speechSynthesis.paused}`);
        ui.boardSpeakingIndicator?.classList.add('active');
        if (targetChunkElement) {
            console.log("[TTS Highlight] Adding highlight to:", targetChunkElement);
            targetChunkElement.classList.add('speaking-highlight');
            state.currentlyHighlightedChunk = targetChunkElement;
        }
        // НЕ вызываем manageButtonStates отсюда
    };
    utterance.onend = () => {
        console.log(`[TTS] Speech FINISHED. State: speaking=${window.speechSynthesis.speaking}, pending=${window.speechSynthesis.pending}, paused=${window.speechSynthesis.paused}`);
        ui.boardSpeakingIndicator?.classList.remove('active');
        removeBoardHighlight();
        // НЕ вызываем manageButtonStates отсюда
    };
    utterance.onerror = (event) => {
        console.error('[TTS] SpeechSynthesisUtterance.onerror:', event.error);
        ui.boardSpeakingIndicator?.classList.remove('active');
        removeBoardHighlight();
        // НЕ вызываем manageButtonStates отсюда
    };
    utterance.onpause = () => {
        console.log(`[TTS] Speech PAUSED. State: speaking=${window.speechSynthesis.speaking}, pending=${window.speechSynthesis.pending}, paused=${window.speechSynthesis.paused}`);
    }
    utterance.onresume = () => {
        console.log(`[TTS] Speech RESUMED. State: speaking=${window.speechSynthesis.speaking}, pending=${window.speechSynthesis.pending}, paused=${window.speechSynthesis.paused}`);
    }

    console.log(`[TTS] Calling window.speechSynthesis.speak() with voice: ${utterance.voice?.name || 'default'}, lang: ${utterance.lang}`);
    window.speechSynthesis.speak(utterance);
}

/**
 * Немедленно останавливает текущее воспроизведение TTS.
 */
export function stopSpeech() {
    console.log("[TTS Action] User clicked 'Zastavit' button (stopSpeech function called)."); // Лог вызова функции
    if (state.speechSynthesisSupported) {
        const wasSpeaking = window.speechSynthesis.speaking; // Проверяем ДО отмены
        console.log(`[TTS Action] State before cancel: speaking=${wasSpeaking}, pending=${window.speechSynthesis.pending}, paused=${window.speechSynthesis.paused}`);
        if (wasSpeaking || window.speechSynthesis.pending) { // Отменяем, если говорит или ожидает
            console.log("[TTS Action] Calling window.speechSynthesis.cancel()...");
            window.speechSynthesis.cancel();
            console.log("[TTS Action] window.speechSynthesis.cancel() called."); // Лог после вызова
        } else {
             console.log("[TTS Action] Not speaking/pending, no need to cancel.");
        }
        // Убираем индикаторы и подсветку независимо от того, говорило ли что-то
        ui.boardSpeakingIndicator?.classList.remove('active');
        removeBoardHighlight();
        console.log(`[TTS Action] Indicators cleared. State after cancel: speaking=${window.speechSynthesis.speaking}, pending=${window.speechSynthesis.pending}, paused=${window.speechSynthesis.paused}`);
        // НЕ вызываем manageButtonStates отсюда
    } else {
         console.log("[TTS Action] Speech synthesis not supported, cannot stop.");
    }
}


// --- Speech-to-Text (STT) --- (Остается без изменений от v3.5, если работало корректно)

/** Инициализирует объект SpeechRecognition. */
export function initializeSpeechRecognition() {
    if (!state.speechRecognitionSupported) { console.warn("STT: Speech Recognition not supported by this browser."); if(ui.micBtn) { ui.micBtn.disabled = true; ui.micBtn.title = "Rozpoznávání řeči není podporováno"; } return; } try { const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; state.speechRecognition = new SpeechRecognition(); state.speechRecognition.lang = STT_LANGUAGE; state.speechRecognition.interimResults = false; state.speechRecognition.maxAlternatives = 1; state.speechRecognition.continuous = false; state.speechRecognition.onresult = (event) => { const transcript = event.results[0][0].transcript; console.log('[STT] Speech recognized:', transcript); if (ui.chatInput) { ui.chatInput.value = transcript; ui.chatInput.dispatchEvent(new Event('input')); /* Trigger input event for auto-resize */ } stopListening(); /* Stop listening after result */ }; state.speechRecognition.onerror = (event) => { console.error('[STT] Speech recognition error:', event.error); let errorMsg = "Chyba rozpoznávání řeči"; if (event.error === 'no-speech') errorMsg = "Nerozpoznal jsem žádnou řeč."; else if (event.error === 'audio-capture') errorMsg = "Chyba mikrofonu."; else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { errorMsg = "Přístup k mikrofonu zamítnut."; if(ui.micBtn) ui.micBtn.disabled = true; } else { errorMsg = `Chyba: ${event.error}`; } /* showToast('Chyba Hlasu', errorMsg, 'error'); */ stopListening(); }; state.speechRecognition.onend = () => { /* Removed unnecessary log */ if (state.isListening) { /* If ended unexpectedly */ console.log('[STT] Recognition ended unexpectedly.'); stopListening(); } }; console.log("STT: Speech Recognition initialized successfully."); } catch (e) { console.error("STT: Failed to initialize Speech Recognition:", e); state.speechRecognitionSupported = false; if(ui.micBtn) { ui.micBtn.disabled = true; ui.micBtn.title = "Chyba inicializace rozpoznávání"; } }
}

/** Запускает процесс распознавания речи. */
export function startListening() {
    if (!state.speechRecognitionSupported || !state.speechRecognition || state.isListening) { console.log("[STT] Cannot start listening:", { supported: state.speechRecognitionSupported, exists: !!state.speechRecognition, listening: state.isListening }); return; }
    // Проверка разрешений перед стартом
    navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => {
        try {
            console.log('[STT] Attempting to start speech recognition...');
            state.speechRecognition.start();
            state.isListening = true;
            if (ui.micBtn) {
                ui.micBtn.classList.add('listening');
                ui.micBtn.title = "Zastavit hlasový vstup";
                // Кнопка не должна быть disabled во время слушания
                // ui.micBtn.disabled = false; // Это управляется в manageButtonStates
            }
            console.log('[STT] Speech recognition started.');
        } catch (e) {
            // Обработка ошибки, если start() не удался после получения разрешения (редко)
            console.error("[STT] Error starting speech recognition after getting permissions:", e);
            stopListening(); // Ensure state is reset
            /* showToast('Chyba Startu', 'Nepodařilo se spustit rozpoznávání.', 'error'); */
        }
    })
    .catch(err => {
        console.error("[STT] Microphone access denied or unavailable:", err);
        if (ui.micBtn) {
             ui.micBtn.disabled = true; // Disable permanently if denied
             ui.micBtn.title = "Přístup k mikrofonu zamítnut";
         }
         /* showToast('Chyba Mikrofonu', 'Přístup k mikrofonu byl zamítnut.', 'error'); */
         stopListening(); // Ensure state is reset
    });
}

/** Останавливает процесс распознавания речи. */
export function stopListening() {
    // Добавлена проверка, чтобы избежать ошибок, если recognition еще не инициализирован
    if (!state.speechRecognitionSupported || !state.speechRecognition) {
        console.log("[STT] Cannot stop listening: Not supported or not initialized.");
        state.isListening = false; // Ensure state is false
        return;
    }
    // Только если действительно слушаем
    if (state.isListening) {
        try {
            state.speechRecognition.stop();
            console.log('[STT] Speech recognition stopped by call.');
        } catch (e) {
            console.warn("[STT] Error trying to stop recognition (might be harmless if already stopped):", e);
        } finally {
            state.isListening = false;
            if (ui.micBtn) {
                ui.micBtn.classList.remove('listening');
                 // Обновление title будет в manageButtonStates
            }
        }
    } else {
        // Если не слушали, просто убедимся, что UI в порядке
        if (ui.micBtn) {
             ui.micBtn.classList.remove('listening');
             // Обновление title будет в manageButtonStates
        }
    }
}

/** Обработчик клика по кнопке микрофона. */
export function handleMicClick() {
    if (!state.speechRecognitionSupported) { console.warn("Mic button clicked, but STT not supported."); return; }
    if (state.isListening) {
        stopListening();
    } else {
        // Добавим проверку на занятость системы перед стартом
        const isBusy = state.geminiIsThinking || state.topicLoadInProgress || (state.speechSynthesisSupported && window.speechSynthesis.speaking);
        if (!isBusy) {
            startListening();
        } else {
            console.warn("Mic button clicked, but system is busy.");
            /* showToast('Systém zaneprázdněn', 'Počkejte na dokončení akce.', 'warning'); */
        }
    }
}


// --- Инициализация при загрузке ---
// Инициализация голосов при первой возможности
if (state.speechSynthesisSupported) {
    // Загрузка голосов может быть асинхронной
    const checkVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            loadVoices();
        } else if ('onvoiceschanged' in window.speechSynthesis) {
            // Назначаем обработчик только если голоса еще не загружены
             window.speechSynthesis.onvoiceschanged = loadVoices;
        } else {
             console.warn("TTS: Cannot use 'onvoiceschanged'. Retrying voice load in 500ms.");
             setTimeout(checkVoices, 500); // Повторная попытка
        }
    };
    checkVoices();
}

console.log("Speech service module loaded (v3.6 with stopSpeech fixes).");