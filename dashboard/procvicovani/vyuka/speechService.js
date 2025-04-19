// speechService.js - Функции для Text-to-Speech (TTS) и Speech-to-Text (STT)

import { state } from './state.js';
import { ui } from './ui.js';
import { TTS_LANGUAGE, TTS_RATE, TTS_PITCH, STT_LANGUAGE } from './config.js';
// import { showToast } from './uiHelpers.js'; // Use from uiHelpers if needed

// --- Text-to-Speech (TTS) ---

/**
 * Загружает и выбирает подходящий чешский голос для TTS.
 */
export function loadVoices() {
    if (!state.speechSynthesisSupported) return;
    try {
        const voices = window.speechSynthesis.getVoices();
        if (!voices || voices.length === 0) {
            // Голоса могут быть недоступны сразу, обработчик onvoiceschanged должен их загрузить.
            console.warn("[TTS] No voices available yet. Waiting for 'onvoiceschanged'.");
            if (!window.speechSynthesis.onvoiceschanged) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
            return;
        }
        console.log('[TTS] Available voices:', voices.map(v => ({ name: v.name, lang: v.lang, default: v.default })));

        // Логика выбора голоса (приоритет женским cs-CZ)
        let preferredVoice = voices.find(voice => voice.lang === TTS_LANGUAGE && /female|žena|ženský|iveta|zuzana/i.test(voice.name));
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang === TTS_LANGUAGE);
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang.startsWith('cs')); // Например, cs_CZ
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.default && voice.lang.startsWith('cs')); // Default чешский
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.default) || voices[0]; // Любой default или первый

        state.czechVoice = preferredVoice;
        console.log("[TTS] Selected voice:", state.czechVoice?.name, state.czechVoice?.lang);

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
    if (!state.speechSynthesisSupported) {
        // showToast("Syntéza řeči není podporována.", "warning");
        console.warn("TTS not supported.");
        return;
    }
    if (!text) {
        console.warn("[TTS] No text provided to speak.");
        return;
    }

    // Очистка текста
    const plainText = text
        .replace(/<[^>]*>/g, ' ')             // Удалить HTML теги
        .replace(/[`*#_~[\]()]/g, '')        // Удалить Markdown символы
        .replace(/\$\$(.*?)\$\$/g, 'matematický vzorec') // Заменить $$...$$
        .replace(/\$(.*?)\$/g, 'vzorec')     // Заменить $...$
        .replace(/\s+/g, ' ')                // Заменить множественные пробелы на один
        .trim();                             // Убрать пробелы по краям

    if (!plainText) {
        console.warn("[TTS] Text is empty after cleaning.");
        return;
    }

    window.speechSynthesis.cancel(); // Остановить предыдущее воспроизведение
    removeBoardHighlight(); // Снять подсветку с предыдущего

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = TTS_LANGUAGE;
    utterance.rate = TTS_RATE;
    utterance.pitch = TTS_PITCH;

    if (state.czechVoice) {
        utterance.voice = state.czechVoice;
    } else {
        console.warn("[TTS] Czech voice not loaded, attempting to load or using default.");
        loadVoices(); // Попробовать загрузить снова
        if (state.czechVoice) {
             utterance.voice = state.czechVoice;
        } else {
             console.warn("[TTS] Czech voice still not found, using default.");
        }
    }

    utterance.onstart = () => {
        console.log("[TTS] Speech started.");
        // REMOVED: ui.aiAvatarCorner?.classList.add('speaking');
        ui.boardSpeakingIndicator?.classList.add('active');
        if (targetChunkElement) {
            targetChunkElement.classList.add('speaking-highlight');
            state.currentlyHighlightedChunk = targetChunkElement;
        }
    };
    utterance.onend = () => {
        console.log("[TTS] Speech finished.");
        // REMOVED: ui.aiAvatarCorner?.classList.remove('speaking');
        ui.boardSpeakingIndicator?.classList.remove('active');
        removeBoardHighlight();
    };
    utterance.onerror = (event) => {
        console.error('[TTS] SpeechSynthesisUtterance.onerror', event);
        // showToast(`Chyba při čtení: ${event.error}`, 'error');
        // REMOVED: ui.aiAvatarCorner?.classList.remove('speaking');
        ui.boardSpeakingIndicator?.classList.remove('active');
        removeBoardHighlight();
    };

    console.log(`[TTS] Attempting to speak with voice: ${utterance.voice?.name}, lang: ${utterance.lang}`);
    window.speechSynthesis.speak(utterance);
}

/**
 * Немедленно останавливает текущее воспроизведение TTS.
 */
export function stopSpeech() {
    if (state.speechSynthesisSupported) {
        window.speechSynthesis.cancel();
        // REMOVED: ui.aiAvatarCorner?.classList.remove('speaking');
        ui.boardSpeakingIndicator?.classList.remove('active');
        removeBoardHighlight();
        console.log("[TTS] Speech cancelled by user.");
    }
}

// --- Speech-to-Text (STT) ---

/**
 * Инициализирует объект SpeechRecognition.
 */
export function initializeSpeechRecognition() {
    if (!state.speechRecognitionSupported) {
        console.warn("STT: Speech Recognition not supported by this browser.");
        if(ui.micBtn) {
            ui.micBtn.disabled = true;
            ui.micBtn.title = "Rozpoznávání řeči není podporováno";
        }
        return;
    }

    try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        state.speechRecognition = new SpeechRecognition();
        state.speechRecognition.lang = STT_LANGUAGE;
        state.speechRecognition.interimResults = false; // Нам нужны только конечные результаты
        state.speechRecognition.maxAlternatives = 1;     // Достаточно одного варианта
        state.speechRecognition.continuous = false;      // Останавливаться после одной фразы

        // Обработчик результата
        state.speechRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log('[STT] Speech recognized:', transcript);
            if (ui.chatInput) {
                ui.chatInput.value = transcript;
                // Нужно импортировать или передать функцию autoResizeTextarea
                // autoResizeTextarea(); // Called from vyukaApp via input event
                ui.chatInput.dispatchEvent(new Event('input')); // Имитируем событие input для autoResize
            }
             stopListening(); // Остановить прослушивание после получения результата
        };

        // Обработчик ошибок
        state.speechRecognition.onerror = (event) => {
            console.error('[STT] Speech recognition error:', event.error);
            let errorMsg = "Chyba rozpoznávání řeči";
            if (event.error === 'no-speech') errorMsg = "Nerozpoznal jsem žádnou řeč.";
            else if (event.error === 'audio-capture') errorMsg = "Chyba mikrofonu.";
            else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                errorMsg = "Přístup k mikrofonu zamítnut.";
                if(ui.micBtn) ui.micBtn.disabled = true;
            }
            // showToast(errorMsg, 'error'); // Call from uiHelpers
            stopListening(); // Остановить в любом случае при ошибке
        };

        // Обработчик завершения (срабатывает и после onresult, и после onerror)
        state.speechRecognition.onend = () => {
            console.log('[STT] Speech recognition ended.');
            // Убедимся, что состояние isListening сброшено
            if (state.isListening) {
                 stopListening();
            }
        };

        console.log("STT: Speech Recognition initialized successfully.");

    } catch (e) {
        console.error("STT: Failed to initialize Speech Recognition:", e);
        state.speechRecognitionSupported = false; // Считаем неподдерживаемым при ошибке инициализации
        if(ui.micBtn) {
            ui.micBtn.disabled = true;
            ui.micBtn.title = "Chyba inicializace rozpoznávání";
        }
    }
}

/**
 * Запускает процесс распознавания речи.
 */
export function startListening() {
    if (!state.speechRecognitionSupported || !state.speechRecognition || state.isListening) {
        console.log("[STT] Cannot start listening:", { supported: state.speechRecognitionSupported, exists: !!state.speechRecognition, listening: state.isListening });
        return;
    }

    // Запросить доступ к микрофону перед запуском
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
            try {
                state.speechRecognition.start();
                state.isListening = true;
                if (ui.micBtn) {
                    ui.micBtn.classList.add('listening');
                    ui.micBtn.title = "Zastavit hlasový vstup";
                    ui.micBtn.disabled = false; // Убедимся, что кнопка активна
                }
                console.log('[STT] Speech recognition started.');
                // manageButtonStates() // Called from vyukaApp
            } catch (e) {
                console.error("[STT] Error starting speech recognition:", e);
                // showToast("Nepodařilo se spustit rozpoznávání.", "error"); // Call from uiHelpers
                stopListening(); // Сбросить состояние, если запуск не удался
            }
        })
        .catch(err => {
            console.error("[STT] Microphone access denied:", err);
            // showToast("Přístup k mikrofonu je nutný pro hlasový vstup.", "warning"); // Call from uiHelpers
            if(ui.micBtn) ui.micBtn.disabled = true; // Заблокировать кнопку, если доступ запрещен
            stopListening();
        });
}

/**
 * Останавливает процесс распознавания речи.
 */
export function stopListening() {
    if (!state.speechRecognitionSupported || !state.speechRecognition || !state.isListening) {
         // console.log("[STT] Not stopping listening, already stopped or not supported.");
         return;
    }
    try {
        state.speechRecognition.stop(); // Может вызвать onend
        console.log('[STT] Speech recognition stopped.');
    } catch (e) {
        console.warn("[STT] Error trying to stop recognition (might be harmless):", e);
    } finally {
        state.isListening = false;
        if (ui.micBtn) {
            ui.micBtn.classList.remove('listening');
            ui.micBtn.title = state.speechRecognitionSupported ? "Zahájit hlasový vstup" : "Rozpoznávání řeči není podporováno";
            // Don't change disabled state here, manageButtonStates handles it
        }
        // manageButtonStates() // Called from vyukaApp
    }
}

/**
 * Обработчик клика по кнопке микрофона.
 */
export function handleMicClick() {
    if (!state.speechRecognitionSupported) {
        // showToast("Rozpoznávání řeči není podporováno.", "warning"); // Call from uiHelpers
        console.warn("Mic button clicked, but STT not supported.");
        return;
    }
    if (state.isListening) {
        stopListening();
    } else {
        startListening();
    }
}

// --- Инициализация при загрузке ---
// Загрузка голосов может потребовать события 'onvoiceschanged'
if (state.speechSynthesisSupported) {
    if (window.speechSynthesis.getVoices().length > 0) {
        loadVoices();
    } else if ('onvoiceschanged' in window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    } else {
         console.warn("TTS: Could not set up 'onvoiceschanged' event handler.");
         // Попробовать загрузить голоса через короткую задержку как запасной вариант
         setTimeout(loadVoices, 500);
    }
}

// Инициализация распознавания речи (Called from initializeUI now)
// initializeSpeechRecognition(); // Don't call here, called from initializeUI

console.log("Speech service module loaded.");