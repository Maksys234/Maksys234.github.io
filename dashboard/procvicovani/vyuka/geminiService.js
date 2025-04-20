// dashboard/procvicovani/vyuka/geminiService.js
// Verze 3.9.7: Přidán import config, opravena chyba 'config is not defined'

// --- Imports ---
import * as config from './config.js'; // <<< ДОБАВЛЕН ИМПОРТ

// --- Helper Functions (Логгирование - если не импортированы из utils) ---
// Замените на импорт или используйте console напрямую
const logInfo = (message, ...args) => console.log(`[Gemini INFO] ${message}`, ...args);
const logDebug = (message, ...args) => console.log(`[Gemini DEBUG] ${message}`, ...args);
const logWarn = (message, ...args) => console.warn(`[Gemini WARN] ${message}`, ...args);
const logError = (message, ...args) => console.error(`[Gemini ERROR] ${message}`, ...args);

// --- Constants ---
const GEMINI_SERVICE_VERSION = '3.9.7'; // Updated version

// --- Initialization ---
function initializeGeminiService() {
    // <<< ПЕРЕМЕЩЕНО ИСПОЛЬЗОВАНИЕ config ВНУТРЬ ФУНКЦИИ >>>
    const apiUrl = config.GEMINI_API_URL;
    if (!apiUrl) {
        const errorMsg = '[Gemini Service] API URL is not configured in config.js.';
        logError(errorMsg);
        // Potentially disable features relying on Gemini
        return false; // Indicate failure
    }
    logInfo(`[Gemini v${GEMINI_SERVICE_VERSION}] Service initialized with API URL (first part): ${apiUrl.split('?')[0]}...`);
    return true; // Indicate success
}

// --- Core Function ---

/**
 * Parses the raw text response from the Gemini API.
 * Extracts content for whiteboard, TTS, and chat based on markers.
 * Version 3.9.6 (Vyuka Integration): Adjusted parsing to be more robust against missing ```.
 *
 * @param {string} responseText The raw text response from the API.
 * @returns {object} An object containing { boardContent: string|null, ttsText: string|null, chatText: string|null, codeBlock: string|null }.
 */
function parseGeminiResponse(responseText) {
    // logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Raw Response: ${responseText.substring(0, 100)}...`); // Log truncated response

    // Default values
    let boardContent = null;
    let ttsText = null;
    let chatTextRaw = null; // Raw text potentially for chat
    let chatTextCleaned = null; // Cleaned chat text
    let codeBlockContent = null; // Generic code block, if any

    if (!responseText || typeof responseText !== 'string') {
        logError('[ParseGemini] Invalid responseText received:', responseText);
        return { boardContent, ttsText, chatText: chatTextCleaned, codeBlock: codeBlockContent };
    }

    try {
        // Define markers
        const boardMarker = '[BOARD_MARKDOWN]';
        const ttsMarker = '[TTS]';
        const chatMarker = '[CHAT]';

        // Find marker indices
        const boardStartIndex = responseText.indexOf(boardMarker);
        const ttsStartIndex = responseText.indexOf(ttsMarker);
        const chatStartIndex = responseText.indexOf(chatMarker);

        // --- Extract Board Content ---
        if (boardStartIndex !== -1) {
            const boardContentStart = boardStartIndex + boardMarker.length;
            let boardEndIndex = responseText.length;
            if (ttsStartIndex > boardContentStart && ttsStartIndex < boardEndIndex) { boardEndIndex = ttsStartIndex; }
            if (chatStartIndex > boardContentStart && chatStartIndex < boardEndIndex) { boardEndIndex = chatStartIndex; }
            boardContent = responseText.substring(boardContentStart, boardEndIndex).trim();
            logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Board: ${boardContent.substring(0, 100)}...`);
        } else {
            logWarn(`[ParseGemini] Marker ${boardMarker} not found.`);
            if (ttsStartIndex === -1 && chatStartIndex === -1 && responseText.length > 0) {
                logWarn(`[ParseGemini] No markers found, assuming entire response is board content.`);
                boardContent = responseText.trim();
                logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Board (fallback): ${boardContent.substring(0, 100)}...`);
            }
        }

        // --- Extract TTS Text ---
        if (ttsStartIndex !== -1) {
            const ttsContentStart = ttsStartIndex + ttsMarker.length;
            let ttsEndIndex = responseText.length;
            if (chatStartIndex > ttsContentStart && chatStartIndex < ttsEndIndex) { ttsEndIndex = chatStartIndex; }
            if (boardStartIndex > ttsContentStart && boardStartIndex < ttsEndIndex) { ttsEndIndex = boardStartIndex; }
            ttsText = responseText.substring(ttsContentStart, ttsEndIndex).trim();
            logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] TTS: ${ttsText.substring(0, 100)}...`);
        } else {
            logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] TTS marker not found.`);
        }

        // --- Extract Chat Text ---
        if (chatStartIndex !== -1) {
            const chatContentStart = chatStartIndex + chatMarker.length;
            let chatEndIndex = responseText.length;
             if (ttsStartIndex > chatContentStart && ttsStartIndex < chatEndIndex) { chatEndIndex = ttsStartIndex; }
             if (boardStartIndex > chatContentStart && boardStartIndex < chatEndIndex) { chatEndIndex = boardStartIndex; }
            chatTextRaw = responseText.substring(chatContentStart, chatEndIndex).trim();
            logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Chat (Raw Parsed): ${chatTextRaw.substring(0, 100)}...`);

            // Clean the chat text
            chatTextCleaned = chatTextRaw;
            if (!chatTextCleaned || chatTextCleaned.toLowerCase() === 'none' || chatTextCleaned.toLowerCase() === 'null') {
                chatTextCleaned = null;
                logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Chat (Final Cleaned): None (detected 'none'/'null')`);
            } else if (chatTextCleaned.length === 0) {
                chatTextCleaned = null;
                logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Chat (Final Cleaned): None (empty string)`);
            } else {
                 logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Chat (Final Cleaned): ${chatTextCleaned ? chatTextCleaned.substring(0, 100) + '...' : 'None'}`);
            }
        } else {
            logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Chat marker not found.`);
        }

        // --- (Optional) Extract generic code block ---
        // Logic removed for brevity as it wasn't actively used based on previous analysis

    } catch (error) {
        logError('[ParseGemini] Error parsing response:', error, responseText);
        return { boardContent: null, ttsText: null, chatText: null, codeBlock: null };
    }

    // Return parsed data
    return { boardContent, ttsText, chatText: chatTextCleaned, codeBlock: codeBlockContent };
}


/**
 * Sends a request to the Gemini API endpoint.
 * Handles history formatting and API key retrieval.
 * Version 3.9.7: Access config inside function.
 *
 * @param {string} prompt The user's current prompt or message.
 * @param {Array<object>} history The conversation history (array of {role: 'user'/'model', parts: [{text: string}]}).
 * @param {boolean} isChatInteraction Indicates if this is part of an ongoing chat vs initial topic load.
 * @returns {Promise<object>} A promise resolving to { success: boolean, data: { boardContent: string|null, ttsText: string|null, chatText: string|null, codeBlock: string|null } | null, error: string | null }.
 */
async function sendToGemini(prompt, history = [], isChatInteraction = true) {
    // <<< ПЕРЕМЕЩЕНО ИСПОЛЬЗОВАНИЕ config ВНУТРЬ ФУНКЦИИ >>>
    const apiUrl = config.GEMINI_API_URL;
    const apiKey = config.GEMINI_API_KEY; // Assuming it's okay to read here for now

    logDebug(`[Gemini v${GEMINI_SERVICE_VERSION}] Sending request (Chat: ${isChatInteraction}): "${prompt.substring(0, 50)}..."`);

    if (!apiUrl) {
        const errorMsg = 'Gemini API URL is not configured.';
        logError(`[Gemini] ${errorMsg}`);
        return { success: false, data: null, error: errorMsg };
    }
    if (!apiKey) {
        const errorMsg = 'Gemini API Key is missing or not configured.';
        logError(`[Gemini] ${errorMsg}`);
        return { success: false, data: null, error: errorMsg };
    }

    // --- History Cleaning/Formatting ---
    const cleanedHistory = history
        .map(entry => {
            if (!entry || !Array.isArray(entry.parts) || entry.parts.length === 0 || typeof entry.parts[0].text !== 'string') {
                logWarn('[Gemini] Invalid history entry skipped:', entry); return null;
            }
            const cleanedText = entry.parts[0].text.trim();
            if (cleanedText.length === 0) {
                 logWarn('[Gemini] History entry with empty text skipped:', entry); return null;
            }
            return { role: entry.role, parts: [{ text: cleanedText }] };
        })
        .filter(entry => entry !== null);

    // --- Construct Request Body ---
    const requestBody = {
        contents: [
            ...cleanedHistory,
            {
                role: "user", // Always 'user' for the latest prompt
                parts: [{ text: prompt }]
            }
        ],
        // Use generationConfig and safetySettings from config.js
        generationConfig: config.GEMINI_GENERATION_CONFIG || { temperature: 0.6 },
        safetySettings: config.GEMINI_SAFETY_SETTINGS || []
    };

    logDebug('[Gemini] Request Body (approx):', JSON.stringify(requestBody).substring(0, 200) + '...');


    // --- API Call ---
    try {
        const response = await fetch(`${apiUrl}?key=${apiKey}`, { // Используем apiUrl и apiKey
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            let errorBodyText = 'Could not read error body.';
            try {
                 const errorData = await response.json();
                 errorBodyText = JSON.stringify(errorData.error || errorData);
                 logError(`[Gemini] API Error Response: ${errorBodyText}`);
            } catch (parseError) {
                 logError(`[Gemini] Failed to parse error response body: ${parseError}`);
                 try { errorBodyText = await response.text(); logError(`[Gemini] API Error Response (Text): ${errorBodyText}`); }
                 catch (textError) { logError(`[Gemini] Failed to read error response body as text: ${textError}`); }
            }
            const errorMsg = `API request failed with status ${response.status}: ${response.statusText}. Details: ${errorBodyText}`;
            logError(`[Gemini] ${errorMsg}`);
            return { success: false, data: null, error: `Chyba ${response.status}: ${errorBodyText}` };
        }

        const data = await response.json();

        // --- Process Response ---
        if (data.promptFeedback && data.promptFeedback.blockReason) {
             const blockReason = data.promptFeedback.blockReason;
             const errorMsg = `Request blocked due to safety settings: ${blockReason}`;
             logError(`[Gemini] ${errorMsg}`);
             return { success: false, data: null, error: `Obsah blokován: ${blockReason}` };
        }

        if (!data.candidates || data.candidates.length === 0) {
            const errorMsg = 'API response missing candidates.';
            logError(`[Gemini] ${errorMsg}`, data);
             if (data.promptFeedback) { logWarn("[Gemini] Prompt Feedback:", data.promptFeedback); return { success: false, data: null, error: 'Odpověď AI byla zablokována nebo je prázdná.' }; }
             return { success: false, data: null, error: 'AI neposkytla žádnou odpověď.' };
        }

        const candidate = data.candidates[0];
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0 || !candidate.content.parts[0].text) {
            const errorMsg = 'API response candidate missing valid text content.';
            logError(`[Gemini] ${errorMsg}`, candidate);
             const finishReason = candidate.finishReason || "N/A";
             logWarn(`[Gemini] Candidate Finish Reason: ${finishReason}`);
             if (finishReason === "SAFETY" || finishReason === "RECITATION") { return { success: false, data: null, error: `Odpověď AI byla zastavena (${finishReason}).` }; }
             return { success: false, data: null, error: 'Odpověď AI má nesprávný formát.' };
        }

        const responseText = candidate.content.parts[0].text;
        const parsedData = parseGeminiResponse(responseText);
        return { success: true, data: parsedData, error: null };

    } catch (error) {
        logError('[Gemini] Network or other error during API call:', error);
        let userError = 'Chyba sítě nebo serveru při komunikaci s AI.';
         if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             userError = 'Chyba sítě při komunikaci s AI. Zkontrolujte připojení.';
         }
         return { success: false, data: null, error: userError };
    }
}

// --- Export or make available globally ---
// Assign to window for use in vyukaApp.js if it's not treated as a module consistently
// Note: If vyukaApp.js IS correctly imported as a module, this window assignment isn't strictly necessary
// but doesn't hurt.
window.geminiService = {
    initialize: initializeGeminiService,
    sendToGemini: sendToGemini,
    parseGeminiResponse: parseGeminiResponse // Expose if needed externally
};

logInfo(`Gemini service module loaded (v${GEMINI_SERVICE_VERSION}).`);