// dashboard/procvicovani/vyuka/geminiService.js
// Verze 3.9.8: Přidán import config a opraven přístup ke config proměnným.

// --- Imports ---
import * as config from './config.js'; // <<< ДОБАВЛЕН ИМПОРТ

// --- Helper Functions (Логгирование) ---
const logInfo = (message, ...args) => console.log(`[Gemini INFO ${new Date().toLocaleTimeString()}] ${message}`, ...args);
const logDebug = (message, ...args) => console.log(`[Gemini DEBUG ${new Date().toLocaleTimeString()}] ${message}`, ...args);
const logWarn = (message, ...args) => console.warn(`[Gemini WARN ${new Date().toLocaleTimeString()}] ${message}`, ...args);
const logError = (message, ...args) => console.error(`[Gemini ERROR ${new Date().toLocaleTimeString()}] ${message}`, ...args);

// --- Constants ---
const GEMINI_SERVICE_VERSION = '3.9.8'; // Updated version

// --- Initialization ---
function initializeGeminiService() {
    // <<< ПРОВЕРКА config ВНУТРИ ФУНКЦИИ >>>
    const apiUrl = config?.GEMINI_API_URL; // Используем optional chaining на всякий случай
    if (!apiUrl) {
        const errorMsg = '[Gemini Service] API URL is not configured or config module not loaded correctly.';
        logError(errorMsg);
        return false; // Indicate failure
    }
    logInfo(`[Gemini v${GEMINI_SERVICE_VERSION}] Service initialized. API URL Endpoint: ${apiUrl.split('?')[0]}...`);
    return true; // Indicate success
}

// --- Core Functions ---

/**
 * Parses the raw text response from the Gemini API.
 * Extracts content for whiteboard, TTS, and chat based on markers.
 * @param {string} responseText The raw text response from the API.
 * @returns {object} An object containing { boardContent: string|null, ttsText: string|null, chatText: string|null, codeBlock: string|null }.
 */
function parseGeminiResponse(responseText) {
    let boardContent = null, ttsText = null, chatTextCleaned = null, codeBlockContent = null;
    if (!responseText || typeof responseText !== 'string') {
        logError('[ParseGemini] Invalid responseText:', responseText);
        return { boardContent, ttsText, chatText: chatTextCleaned, codeBlock: codeBlockContent };
    }
    try {
        const boardMarker = '[BOARD_MARKDOWN]', ttsMarker = '[TTS]', chatMarker = '[CHAT]';
        const boardStartIndex = responseText.indexOf(boardMarker);
        const ttsStartIndex = responseText.indexOf(ttsMarker);
        const chatStartIndex = responseText.indexOf(chatMarker);
        // Extract Board Content
        if (boardStartIndex !== -1) {
            const start = boardStartIndex + boardMarker.length;
            let end = responseText.length;
            if (ttsStartIndex > start && ttsStartIndex < end) end = ttsStartIndex;
            if (chatStartIndex > start && chatStartIndex < end) end = chatStartIndex;
            boardContent = responseText.substring(start, end).trim();
        } else if (ttsStartIndex === -1 && chatStartIndex === -1) { // Fallback if no markers
            boardContent = responseText.trim();
            if(boardContent) logWarn(`[ParseGemini] No markers found, assuming all content is for board.`);
            else logWarn(`[ParseGemini] No markers and no content.`);
        }
        // Extract TTS Text
        if (ttsStartIndex !== -1) {
            const start = ttsStartIndex + ttsMarker.length;
            let end = responseText.length;
            if (chatStartIndex > start && chatStartIndex < end) end = chatStartIndex;
            if (boardStartIndex > start && boardStartIndex < end) end = boardStartIndex;
            ttsText = responseText.substring(start, end).trim();
        }
        // Extract Chat Text
        if (chatStartIndex !== -1) {
            const start = chatStartIndex + chatMarker.length;
            let end = responseText.length;
            if (ttsStartIndex > start && ttsStartIndex < end) end = ttsStartIndex;
            if (boardStartIndex > start && boardStartIndex < end) end = boardStartIndex;
            const chatTextRaw = responseText.substring(start, end).trim();
            chatTextCleaned = (!chatTextRaw || chatTextRaw.toLowerCase() === 'none' || chatTextRaw.toLowerCase() === 'null') ? null : chatTextRaw;
        }
        logDebug(`[ParseGemini] Result: Board=${!!boardContent}, TTS=${!!ttsText}, Chat=${!!chatTextCleaned}`);
    } catch (error) {
        logError('[ParseGemini] Error parsing response:', error);
        return { boardContent: null, ttsText: null, chatText: null, codeBlock: null };
    }
    return { boardContent, ttsText, chatText: chatTextCleaned, codeBlock: codeBlockContent };
}

/**
 * Sends a request to the Gemini API endpoint.
 * @param {string} prompt User's prompt.
 * @param {Array<object>} history Conversation history.
 * @param {boolean} isChatInteraction Is it an ongoing chat?
 * @returns {Promise<object>} Result object.
 */
async function sendToGemini(prompt, history = [], isChatInteraction = true) {
    logDebug(`[Gemini] Sending request (Chat: ${isChatInteraction}): "${prompt.substring(0, 50)}..."`);

    // <<< ПРОВЕРКА и ПОЛУЧЕНИЕ config ВНУТРИ ФУНКЦИИ >>>
    if (typeof config === 'undefined' || !config) {
        const errorMsg = 'Config module is not loaded/available in geminiService.';
        logError(`[Gemini] ${errorMsg}`);
        return { success: false, data: null, error: errorMsg };
    }
    // --- DEBUGGING: Log config object ---
    console.log("[Gemini sendToGemini] Config object available:", config);
    // -----------------------------------

    const apiUrl = config.GEMINI_API_URL;
    const apiKey = config.GEMINI_API_KEY;

    if (!apiUrl) {
        const errorMsg = 'Gemini API URL is not configured in config.js.';
        logError(`[Gemini] ${errorMsg}`);
        return { success: false, data: null, error: errorMsg };
    }
    if (!apiKey) {
        const errorMsg = 'Gemini API Key is missing or not configured in config.js.';
        logError(`[Gemini] ${errorMsg}`);
        return { success: false, data: null, error: errorMsg };
    }
    logDebug("[Gemini sendToGemini] API Key first 5 chars:", apiKey ? apiKey.substring(0, 5) : "N/A");

    // --- History Cleaning ---
    const cleanedHistory = history
        .map(entry => {
            if (!entry || !Array.isArray(entry.parts) || entry.parts.length === 0 || typeof entry.parts[0].text !== 'string') return null;
            const cleanedText = entry.parts[0].text.trim();
            return cleanedText.length > 0 ? { role: entry.role, parts: [{ text: cleanedText }] } : null;
        })
        .filter(entry => entry !== null);

    // --- Construct Request Body ---
    const requestBody = {
        contents: [ ...cleanedHistory, { role: "user", parts: [{ text: prompt }] } ],
        generationConfig: config.GEMINI_GENERATION_CONFIG || { temperature: 0.6 },
        safetySettings: config.GEMINI_SAFETY_SETTINGS || []
    };

    // --- API Call ---
    try {
        logDebug("[Gemini sendToGemini] Calling fetch...");
        const response = await fetch(`${apiUrl}?key=${apiKey}`, { // Используем apiUrl и apiKey
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(requestBody),
        });
        logDebug("[Gemini sendToGemini] Fetch response status:", response.status);

        if (!response.ok) {
            let errorBodyText = `Status: ${response.status} ${response.statusText}`;
            try {
                 const errorData = await response.json();
                 errorBodyText = JSON.stringify(errorData.error || errorData);
                 logError(`[Gemini] API Error Response JSON: ${errorBodyText}`);
            } catch (parseError) {
                 logError(`[Gemini] Failed to parse error JSON: ${parseError}`);
                 try { errorBodyText = await response.text(); logError(`[Gemini] API Error Response Text: ${errorBodyText}`); }
                 catch (textError) { logError(`[Gemini] Failed to read error body: ${textError}`); }
            }
            return { success: false, data: null, error: `Chyba API ${response.status}` };
        }

        const data = await response.json();
        logDebug("[Gemini sendToGemini] Fetch response data received.");

        // --- Process Response ---
        if (data.promptFeedback?.blockReason) {
             const blockReason = data.promptFeedback.blockReason;
             logError(`[Gemini] Request blocked: ${blockReason}`);
             return { success: false, data: null, error: `Obsah blokován: ${blockReason}` };
        }
        if (!data.candidates?.length) {
            logError('[Gemini] API response missing candidates.', data);
             return { success: false, data: null, error: 'AI neposkytla žádnou odpověď.' };
        }
        const candidate = data.candidates[0];
        if (!candidate.content?.parts?.[0]?.text) {
            const finishReason = candidate.finishReason || "UNKNOWN";
            logError(`[Gemini] API candidate missing text. Finish reason: ${finishReason}`, candidate);
             if (finishReason === "SAFETY" || finishReason === "RECITATION") { return { success: false, data: null, error: `Odpověď AI byla zastavena (${finishReason}).` }; }
             return { success: false, data: null, error: 'Odpověď AI má nesprávný formát.' };
        }

        const responseText = candidate.content.parts[0].text;
        const parsedData = parseGeminiResponse(responseText);
        logDebug("[Gemini sendToGemini] Request successful, data parsed.");
        return { success: true, data: parsedData, error: null };

    } catch (error) {
        logError('[Gemini] Network/fetch error during API call:', error);
         let userError = 'Chyba sítě nebo serveru při komunikaci s AI.';
          if (error instanceof TypeError) { // Often indicates network issue
              userError = 'Chyba sítě při komunikaci s AI. Zkontrolujte připojení.';
          }
          return { success: false, data: null, error: userError };
    }
}

// --- Assign to window for global access from vyukaApp.js ---
window.geminiService = {
    initialize: initializeGeminiService,
    sendToGemini: sendToGemini,
    parseGeminiResponse: parseGeminiResponse
};

logInfo(`Gemini service module loaded (v${GEMINI_SERVICE_VERSION}).`);