// speechService.js - Функции для Text-to-Speech (TTS) и Speech-to-Text (STT) - с логированием

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
            console.warn("[TTS] No voices available yet. Waiting for 'onvoiceschanged'.");
            if (!window.speechSynthesis.onvoiceschanged) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
            return;
        }
        console.log('[TTS] Available voices:', voices.map(v => ({ name: v.name, lang: v.lang, default: v.default })));

        let preferredVoice = voices.find(voice => voice.lang === TTS_LANGUAGE && /female|žena|ženský|iveta|zuzana/i.test(voice.name));
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang === TTS_LANGUAGE);
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang.startsWith('cs'));
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.default && voice.lang.startsWith('cs'));
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.default) || voices[0];

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
        // console.log("[TTS Highlight] Removing highlight from:", state.currentlyHighlightedChunk);
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

    const plainText = text.replace(/<[^>]*>/g, ' ').replace(/[`*#_~[\]()]/g, '').replace(/\$\$(.*?)\$\$/g, 'matematický vzorec').replace(/\$(.*?)\$/g, 'vzorec').replace(/\s+/g, ' ').trim();
    if (!plainText) { console.warn("[TTS] Text is empty after cleaning."); return; }

    console.log("[TTS] Attempting to cancel previous speech...");
    window.speechSynthesis.cancel(); // Остановить предыдущее
    removeBoardHighlight(); // Снять подсветку

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = TTS_LANGUAGE;
    utterance.rate = TTS_RATE;
    utterance.pitch = TTS_PITCH;

    if (state.czechVoice) { utterance.voice = state.czechVoice; }
    else { console.warn("[TTS] Czech voice not loaded, using default."); loadVoices(); if (state.czechVoice) { utterance.voice = state.czechVoice; } }

    utterance.onstart = () => {
        console.log(`[TTS] Speech STARTED. Current window.speechSynthesis.speaking = ${window.speechSynthesis.speaking}`);
        ui.boardSpeakingIndicator?.classList.add('active');
        if (targetChunkElement) {
            console.log("[TTS Highlight] Adding highlight to:", targetChunkElement);
            targetChunkElement.classList.add('speaking-highlight');
            state.currentlyHighlightedChunk = targetChunkElement;
        }
        // Важно: После начала воспроизведения нужно обновить состояние кнопок
        // Прямой вызов manageButtonStates здесь невозможен (циклическая зависимость).
        // Обновление должно происходить через проверку window.speechSynthesis.speaking в manageButtonStates.
         // Попробуем вызвать manageButtonStates с небольшой задержкой, если он не обновляется сам
         // setTimeout(manageButtonStates, 50); // Убрано, т.к. это плохая практика
    };
    utterance.onend = () => {
        console.log(`[TTS] Speech FINISHED. Current window.speechSynthesis.speaking = ${window.speechSynthesis.speaking}`); // Должен быть false
        ui.boardSpeakingIndicator?.classList.remove('active');
        removeBoardHighlight();
         // Важно: После окончания воспроизведения нужно обновить состояние кнопок
         // setTimeout(manageButtonStates, 50); // Убрано
    };
    utterance.onerror = (event) => {
        console.error('[TTS] SpeechSynthesisUtterance.onerror:', event);
        ui.boardSpeakingIndicator?.classList.remove('active');
        removeBoardHighlight();
        // setTimeout(manageButtonStates, 50); // Убрано
    };
     utterance.onpause = () => console.log("[TTS] Speech paused."); // Добавлено
     utterance.onresume = () => console.log("[TTS] Speech resumed."); // Добавлено

    console.log(`[TTS] Calling window.speechSynthesis.speak() with voice: ${utterance.voice?.name}`);
    window.speechSynthesis.speak(utterance);
}

/**
 * Немедленно останавливает текущее воспроизведение TTS.
 */
export function stopSpeech() {
    console.log("[TTS] stopSpeech function called."); // Лог вызова функции
    if (state.speechSynthesisSupported) {
        console.log("[TTS] Checking if speaking:", window.speechSynthesis.speaking); // Проверка перед отменой
        if (window.speechSynthesis.speaking) {
            console.log("[TTS] Calling window.speechSynthesis.cancel()...");
            window.speechSynthesis.cancel();
            console.log("[TTS] window.speechSynthesis.cancel() called."); // Лог после вызова
        } else {
             console.log("[TTS] Not speaking, no need to cancel.");
        }
        // Убираем индикаторы независимо от того, говорило ли что-то
        ui.boardSpeakingIndicator?.classList.remove('active');
        removeBoardHighlight();
        console.log("[TTS] Speech stopped/indicators cleared by user.");
        // После остановки нужно обновить состояние кнопок
        // setTimeout(manageButtonStates, 50); // Убрано
    } else {
         console.log("[TTS] Speech synthesis not supported, cannot stop.");
    }
}

// --- Speech-to-Text (STT) ---

/** Инициализирует объект SpeechRecognition. */
export function initializeSpeechRecognition() { /* ... (без изменений из v3.3) ... */
    if (!state.speechRecognitionSupported) { console.warn("STT: Speech Recognition not supported by this browser."); if(ui.micBtn) { ui.micBtn.disabled = true; ui.micBtn.title = "Rozpoznávání řeči není podporováno"; } return; } try { const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; state.speechRecognition = new SpeechRecognition(); state.speechRecognition.lang = STT_LANGUAGE; state.speechRecognition.interimResults = false; state.speechRecognition.maxAlternatives = 1; state.speechRecognition.continuous = false; state.speechRecognition.onresult = (event) => { const transcript = event.results[0][0].transcript; console.log('[STT] Speech recognized:', transcript); if (ui.chatInput) { ui.chatInput.value = transcript; ui.chatInput.dispatchEvent(new Event('input')); } stopListening(); }; state.speechRecognition.onerror = (event) => { console.error('[STT] Speech recognition error:', event.error); let errorMsg = "Chyba rozpoznávání řeči"; if (event.error === 'no-speech') errorMsg = "Nerozpoznal jsem žádnou řeč."; else if (event.error === 'audio-capture') errorMsg = "Chyba mikrofonu."; else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { errorMsg = "Přístup k mikrofonu zamítnut."; if(ui.micBtn) ui.micBtn.disabled = true; } stopListening(); }; state.speechRecognition.onend = () => { console.log('[STT] Speech recognition ended.'); if (state.isListening) { stopListening(); } }; console.log("STT: Speech Recognition initialized successfully."); } catch (e) { console.error("STT: Failed to initialize Speech Recognition:", e); state.speechRecognitionSupported = false; if(ui.micBtn) { ui.micBtn.disabled = true; ui.micBtn.title = "Chyba inicializace rozpoznávání"; } }
}

/** Запускает процесс распознавания речи. */
export function startListening() { /* ... (без изменений из v3.3) ... */
    if (!state.speechRecognitionSupported || !state.speechRecognition || state.isListening) { console.log("[STT] Cannot start listening:", { supported: state.speechRecognitionSupported, exists: !!state.speechRecognition, listening: state.isListening }); return; } navigator.mediaDevices.getUserMedia({ audio: true }) .then(() => { try { state.speechRecognition.start(); state.isListening = true; if (ui.micBtn) { ui.micBtn.classList.add('listening'); ui.micBtn.title = "Zastavit hlasový vstup"; ui.micBtn.disabled = false; } console.log('[STT] Speech recognition started.'); } catch (e) { console.error("[STT] Error starting speech recognition:", e); stopListening(); } }) .catch(err => { console.error("[STT] Microphone access denied:", err); if(ui.micBtn) ui.micBtn.disabled = true; stopListening(); });
}

/** Останавливает процесс распознавания речи. */
export function stopListening() { /* ... (без изменений из v3.3) ... */
    if (!state.speechRecognitionSupported || !state.speechRecognition || !state.isListening) { return; } try { state.speechRecognition.stop(); console.log('[STT] Speech recognition stopped.'); } catch (e) { console.warn("[STT] Error trying to stop recognition (might be harmless):", e); } finally { state.isListening = false; if (ui.micBtn) { ui.micBtn.classList.remove('listening'); ui.micBtn.title = state.speechRecognitionSupported ? "Zahájit hlasový vstup" : "Rozpoznávání řeči není podporováno"; } }
}

/** Обработчик клика по кнопке микрофона. */
export function handleMicClick() { /* ... (без изменений из v3.3) ... */
    if (!state.speechRecognitionSupported) { console.warn("Mic button clicked, but STT not supported."); return; } if (state.isListening) { stopListening(); } else { startListening(); }
}

// --- Инициализация при загрузке ---
if (state.speechSynthesisSupported) {
    if (window.speechSynthesis.getVoices().length > 0) { loadVoices(); }
    else if ('onvoiceschanged' in window.speechSynthesis) { window.speechSynthesis.onvoiceschanged = loadVoices; }
    else { console.warn("TTS: Could not set up 'onvoiceschanged' event handler."); setTimeout(loadVoices, 500); }
}

console.log("Speech service module loaded (v3.5 with logging).");