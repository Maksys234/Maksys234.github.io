// speechService.js - Funkce pro Text-to-Speech (TTS) a Speech-to-Text (STT)
// Verze 3.7.0: Aktualizuje state.isSpeakingTTS a volá manageButtonStates

import { state } from './state.js';
import { ui } from './ui.js';
import { TTS_LANGUAGE, TTS_RATE, TTS_PITCH, STT_LANGUAGE } from './config.js';
// Importujeme funkci pro aktualizaci tlačítek z hlavního modulu
// POZOR: Toto může vést k cyklické závislosti, pokud vyukaApp.js také importuje
// něco z tohoto souboru (což dělá). Pokud by nastal problém, je nutné předat
// manageButtonStates jako callback parametr do speakText, startListening, stopListening.
// Prozatím to zkusíme takto.
let manageButtonStatesCallback = () => {
    console.warn("[SpeechService] manageButtonStates callback not set!");
};

export function setManageButtonStatesCallback(callback) {
    if (typeof callback === 'function') {
        manageButtonStatesCallback = callback;
        console.log("[SpeechService] manageButtonStates callback registered.");
    } else {
        console.error("[SpeechService] Invalid callback provided for manageButtonStates.");
    }
}


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
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang.startsWith('en'));
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.default) || voices[0];
        state.czechVoice = preferredVoice;
        console.log("[TTS] Selected voice:", state.czechVoice?.name, state.czechVoice?.lang || 'N/A');
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

    const plainText = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/```[\s\S]*?```/g, ' (ukázka kódu) ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[.*?\]\(.*?\)/g, ' (obrázek) ')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        .replace(/~{2}(.*?)~{2}/g, '$1')
        .replace(/^\s*#+\s*/gm, '')
        .replace(/^\s*>\s*/gm, '')
        .replace(/^\s*-\s*/gm, '')
        .replace(/^\s*\d+\.\s*/gm, '')
        .replace(/\$\$(.*?)\$\$/g, 'matematický vzorec')
        .replace(/\$(.*?)\$/g, 'vzorec')
        .replace(/\s+/g, ' ').trim();

    if (!plainText) { console.warn("[TTS] Text is empty after cleaning."); return; }

    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        console.log("[TTS] Cancelling previous speech before starting new one...");
        window.speechSynthesis.cancel();
    }
    removeBoardHighlight(); // Снять подсветку

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = state.czechVoice?.lang || TTS_LANGUAGE;
    utterance.rate = TTS_RATE;
    utterance.pitch = TTS_PITCH;
    if (state.czechVoice) { utterance.voice = state.czechVoice; }
    else { console.warn("[TTS] Czech voice not loaded, using default."); }

    utterance.onstart = () => {
        console.log(`[TTS] Speech STARTED.`);
        state.isSpeakingTTS = true; // <<< Aktualizace stavu
        ui.boardSpeakingIndicator?.classList.add('active');
        if (targetChunkElement) {
            targetChunkElement.classList.add('speaking-highlight');
            state.currentlyHighlightedChunk = targetChunkElement;
        }
        manageButtonStatesCallback(); // <<< VOLÁNÍ CALLBACKU
    };
    utterance.onend = () => {
        console.log(`[TTS] Speech FINISHED.`);
        state.isSpeakingTTS = false; // <<< Aktualizace stavu
        ui.boardSpeakingIndicator?.classList.remove('active');
        removeBoardHighlight();
        manageButtonStatesCallback(); // <<< VOLÁNÍ CALLBACKU
    };
    utterance.onerror = (event) => {
        console.error('[TTS] SpeechSynthesisUtterance.onerror:', event.error);
        state.isSpeakingTTS = false; // <<< Aktualizace stavu
        ui.boardSpeakingIndicator?.classList.remove('active');
        removeBoardHighlight();
        manageButtonStatesCallback(); // <<< VOLÁNÍ CALLBACKU
    };
    utterance.onpause = () => console.log(`[TTS] Speech PAUSED.`);
    utterance.onresume = () => console.log(`[TTS] Speech RESUMED.`);

    console.log(`[TTS] Calling window.speechSynthesis.speak() with voice: ${utterance.voice?.name || 'default'}, lang: ${utterance.lang}`);
    window.speechSynthesis.speak(utterance);
}

/**
 * Немедленно останавливает текущее воспроизведение TTS.
 */
export function stopSpeech() {
    console.log("[TTS Action] User clicked 'Zastavit'.");
    if (state.speechSynthesisSupported) {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            window.speechSynthesis.cancel();
        }
        state.isSpeakingTTS = false; // <<< Aktualizace stavu
        ui.boardSpeakingIndicator?.classList.remove('active');
        removeBoardHighlight();
        manageButtonStatesCallback(); // <<< VOLÁNÍ CALLBACKU
        console.log("[TTS Action] Speech cancelled and UI updated via callback.");
    } else {
         console.log("[TTS Action] Speech synthesis not supported.");
    }
}


// --- Speech-to-Text (STT) ---

/** Инициализирует объект SpeechRecognition. */
export function initializeSpeechRecognition() {
    if (!state.speechRecognitionSupported) {
        console.warn("STT: Speech Recognition not supported by this browser.");
        if(ui.micBtn) { ui.micBtn.disabled = true; ui.micBtn.title = "Rozpoznávání řeči není podporováno"; }
        return;
    }
    try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        state.speechRecognition = new SpeechRecognition();
        state.speechRecognition.lang = STT_LANGUAGE;
        state.speechRecognition.interimResults = false; // Nechceme průběžné výsledky
        state.speechRecognition.maxAlternatives = 1;
        state.speechRecognition.continuous = false; // Ukončit po první frázi

        state.speechRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log('[STT] Speech recognized:', transcript);
            if (ui.chatInput) {
                ui.chatInput.value = transcript;
                ui.chatInput.dispatchEvent(new Event('input')); // Trigger input event for auto-resize
            }
            stopListening(); // Explicitně zastavit po získání výsledku
        };

        state.speechRecognition.onerror = (event) => {
            console.error('[STT] Speech recognition error:', event.error);
            let errorMsg = "Chyba rozpoznávání řeči";
            if (event.error === 'no-speech') errorMsg = "Nerozpoznal jsem žádnou řeč.";
            else if (event.error === 'audio-capture') errorMsg = "Chyba zachytávání zvuku (mikrofon).";
            else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                 errorMsg = "Přístup k mikrofonu byl zamítnut nebo není povolen.";
                 if(ui.micBtn) ui.micBtn.disabled = true; // Trvale deaktivovat, pokud zamítnuto
            } else if (event.error === 'network') {
                 errorMsg = "Chyba sítě při rozpoznávání řeči.";
            } else { errorMsg = `Chyba: ${event.error}`; }
            showToast('Chyba Hlasu', errorMsg, 'error'); // Použít showToast z uiHelpers
            stopListening(); // Zajistit ukončení
        };

        state.speechRecognition.onend = () => {
             // Volá se i po úspěšném rozpoznání (onresult -> stopListening -> onend)
             // nebo při chybě (onerror -> stopListening -> onend)
             // nebo při automatickém ukončení (např. ticho)
            console.log('[STT] Recognition service ended.');
            // Pokud stav isListening je stále true, znamená to, že skončil neočekávaně
            if (state.isListening) {
                 console.warn('[STT] Recognition ended unexpectedly (e.g., timeout). Resetting state.');
                 stopListening(); // Zavolá interně manageButtonStates a nastaví isListening na false
            }
        };

        console.log("STT: Speech Recognition initialized successfully.");
    } catch (e) {
        console.error("STT: Failed to initialize Speech Recognition:", e);
        state.speechRecognitionSupported = false;
        if(ui.micBtn) { ui.micBtn.disabled = true; ui.micBtn.title = "Chyba inicializace rozpoznávání"; }
    }
}

/** Запускает процесс распознавания речи. */
export function startListening() {
    if (!state.speechRecognitionSupported || !state.speechRecognition || state.isListening) {
        console.log("[STT] Cannot start listening:", { supported: state.speechRecognitionSupported, exists: !!state.speechRecognition, listening: state.isListening });
        return;
    }
    // Zkusíme získat přístup k mikrofonu PŘED spuštěním rozpoznávání
    navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => {
        try {
            console.log('[STT] Attempting to start speech recognition...');
            state.speechRecognition.start();
            state.isListening = true; // <<< Aktualizace stavu
            // UI se aktualizuje přes manageButtonStates
            manageButtonStatesCallback(); // <<< VOLÁNÍ CALLBACKU
            console.log('[STT] Speech recognition started.');
        } catch (e) {
            console.error("[STT] Error starting speech recognition after getting permissions:", e);
            stopListening(); // Zajistit reset stavu
            showToast('Chyba Startu', 'Nepodařilo se spustit rozpoznávání.', 'error');
        }
    })
    .catch(err => {
        console.error("[STT] Microphone access denied or unavailable:", err);
        if (ui.micBtn) { ui.micBtn.disabled = true; ui.micBtn.title = "Přístup k mikrofonu zamítnut"; }
        showToast('Chyba Mikrofonu', 'Přístup k mikrofonu byl zamítnut nebo není dostupný.', 'error');
        // Není třeba volat stopListening, protože jsme ani nezačali
        state.isListening = false; // Zajistit správný stav
        manageButtonStatesCallback(); // Aktualizovat UI
    });
}

/** Останавливает процесс распознавания речи. */
export function stopListening() {
    if (!state.speechRecognitionSupported || !state.speechRecognition) {
        state.isListening = false; // Jistota
        manageButtonStatesCallback(); // Aktualizovat UI
        return;
    }
    if (state.isListening) {
        try { state.speechRecognition.stop(); console.log('[STT] Stopped by call.'); }
        catch (e) { console.warn("[STT] Error stopping (harmless if already stopped):", e); }
        // onend se zavolá automaticky po stop() a tam se nastaví isListening = false a zavolá manageButtonStatesCallback
    } else {
         // Pokud už neběží, jen zajistíme správný stav UI
         state.isListening = false;
         manageButtonStatesCallback();
    }
}

/** Обработчик клика по кнопке микрофона. */
export function handleMicClick() {
    if (!state.speechRecognitionSupported) {
        showToast("Nepodporováno", "Rozpoznávání řeči není podporováno vaším prohlížečem.", "warning");
        return;
    }
    // Zabráníme spuštění/zastavení, pokud je systém zaneprázdněn jinak
    const isBusy = state.geminiIsThinking || state.topicLoadInProgress || state.isSpeakingTTS;
     if (isBusy && !state.isListening) { // Umožníme zastavit, i když je AI zaneprázdněna
        console.warn("Mic button clicked, but system is busy.");
        showToast('Systém zaneprázdněn', 'Počkejte na dokončení akce AI.', 'warning');
        return;
    }

    if (state.isListening) {
        stopListening();
    } else {
        startListening();
    }
}


// --- Инициализация при загрузке ---
if (state.speechSynthesisSupported) {
    const checkVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) { loadVoices(); }
        else if ('onvoiceschanged' in window.speechSynthesis) { window.speechSynthesis.onvoiceschanged = loadVoices; }
        else { console.warn("TTS: Cannot use 'onvoiceschanged'. Retrying voice load in 500ms."); setTimeout(checkVoices, 500); }
    };
    checkVoices();
}

console.log("Speech service module loaded (v3.7.0 with manageButtonStates callback).");