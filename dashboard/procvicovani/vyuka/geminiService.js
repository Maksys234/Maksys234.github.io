// dashboard/procvicovani/vyuka/geminiService.js

// --- Constants ---
const GEMINI_API_URL = config.GEMINI_API_URL;
const GEMINI_SERVICE_VERSION = '3.9.2'; // Updated version for chat cleaning fixes

// --- Initialization ---
function initializeGeminiService() {
    if (!GEMINI_API_URL) {
        console.error('[Gemini Service] API URL is not configured in config.js.');
        logError('Gemini API URL not configured.');
        // Potentially disable features relying on Gemini
        // uiHelpers.disableGeminiFeatures(); // Example function call
        return false; // Indicate failure
    }
    logInfo(`[Gemini v${GEMINI_SERVICE_VERSION}] Service initialized with API URL: ${GEMINI_API_URL}`);
    return true; // Indicate success
}

// --- Core Function ---

/**
 * Parses the raw text response from the Gemini API.
 * Extracts content for whiteboard, TTS, and chat based on markers.
 * Version 3.9.2: Fixes chat cleaning. Handles missing markers gracefully.
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
        // const codeBlockMarker = '```'; // No longer strictly required for board

        // Find marker indices
        const boardStartIndex = responseText.indexOf(boardMarker);
        const ttsStartIndex = responseText.indexOf(ttsMarker);
        const chatStartIndex = responseText.indexOf(chatMarker);

        // --- Extract Board Content ---
        if (boardStartIndex !== -1) {
            const boardContentStart = boardStartIndex + boardMarker.length;
            // Find the end of the board content: it's the start of the next marker *after* boardContentStart, or the end of the string
            let boardEndIndex = responseText.length;
            if (ttsStartIndex > boardContentStart && ttsStartIndex < boardEndIndex) {
                boardEndIndex = ttsStartIndex;
            }
            if (chatStartIndex > boardContentStart && chatStartIndex < boardEndIndex) {
                boardEndIndex = chatStartIndex;
            }
            // Add any other potential markers here if they can follow BOARD_MARKDOWN

            boardContent = responseText.substring(boardContentStart, boardEndIndex).trim();
            logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Board: ${boardContent.substring(0, 100)}...`);
        } else {
            logWarning(`[ParseGemini] Marker ${boardMarker} not found.`);
            // Attempt to salvage if no markers are present but there's content
            if (ttsStartIndex === -1 && chatStartIndex === -1 && responseText.length > 0) {
                logWarning(`[ParseGemini] No markers found, assuming entire response is board content.`);
                boardContent = responseText.trim();
                logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Board (fallback): ${boardContent.substring(0, 100)}...`);
            }
        }

        // --- Extract TTS Text ---
        if (ttsStartIndex !== -1) {
            const ttsContentStart = ttsStartIndex + ttsMarker.length;
            // Find the end of TTS content: start of next marker *after* ttsContentStart, or end of string
            let ttsEndIndex = responseText.length;
            if (chatStartIndex > ttsContentStart && chatStartIndex < ttsEndIndex) {
                ttsEndIndex = chatStartIndex;
            }
            if (boardStartIndex > ttsContentStart && boardStartIndex < ttsEndIndex) {
                 ttsEndIndex = boardStartIndex; // Should ideally not happen if order is fixed
            }
            // Add other markers if needed

            ttsText = responseText.substring(ttsContentStart, ttsEndIndex).trim();
            logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] TTS: ${ttsText.substring(0, 100)}...`);
        } else {
            logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] TTS marker not found.`);
        }

        // --- Extract Chat Text ---
        if (chatStartIndex !== -1) {
            const chatContentStart = chatStartIndex + chatMarker.length;
            // Find the end of Chat content: start of next marker *after* chatContentStart, or end of string
            let chatEndIndex = responseText.length;
             if (ttsStartIndex > chatContentStart && ttsStartIndex < chatEndIndex) {
                 chatEndIndex = ttsStartIndex; // Should ideally not happen
             }
             if (boardStartIndex > chatContentStart && boardStartIndex < chatEndIndex) {
                 chatEndIndex = boardStartIndex; // Should ideally not happen
             }
            // Add other markers if needed

            chatTextRaw = responseText.substring(chatContentStart, chatEndIndex).trim();
            logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Chat (Raw Parsed): ${chatTextRaw.substring(0, 100)}...`);

            // Clean the chat text
            chatTextCleaned = chatTextRaw;
            if (!chatTextCleaned || chatTextCleaned.toLowerCase() === 'none' || chatTextCleaned.toLowerCase() === 'null') {
                chatTextCleaned = null; // Treat "none" or "null" as no chat message
                logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Chat (Final Cleaned): None (detected 'none'/'null')`);
            } else if (chatTextCleaned.length === 0) {
                chatTextCleaned = null; // Treat empty string as no chat message
                logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Chat (Final Cleaned): None (empty string)`);
            } else {
                 // Optional: Further cleaning (e.g., remove leading/trailing quotes if the API sometimes adds them)
                 // chatTextCleaned = chatTextCleaned.replace(/^"|"$/g, '').trim();
                 logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Chat (Final Cleaned): ${chatTextCleaned ? chatTextCleaned.substring(0, 100) + '...' : 'None'}`);
            }
        } else {
            logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Chat marker not found.`);
        }

        // --- (Optional) Extract generic code block ---
        // This logic remains separate, maybe for future use if API returns code outside board
        // const genericCodeBlockMarker = '```';
        // const codeBlockStartIndex = responseText.indexOf(genericCodeBlockMarker);
        // const codeBlockEndIndex = responseText.lastIndexOf(genericCodeBlockMarker);
        // if (codeBlockStartIndex !== -1 && codeBlockEndIndex > codeBlockStartIndex) {
        //     // Ensure it's not part of the already parsed board content if board had ```
        //     // This logic might need refinement based on expected structure
        //     codeBlockContent = responseText.substring(codeBlockStartIndex + genericCodeBlockMarker.length, codeBlockEndIndex).trim();
        //     logDebug(`[ParseGemini v${GEMINI_SERVICE_VERSION}] Generic Code Block Found: ${codeBlockContent.substring(0, 100)}...`);
        // }

    } catch (error) {
        logError('[ParseGemini] Error parsing response:', error, responseText);
        // Return default values or throw error depending on desired handling
        return { boardContent: null, ttsText: null, chatText: null, codeBlock: null };
    }

    // Return parsed data
    return { boardContent, ttsText, chatText: chatTextCleaned, codeBlock: codeBlockContent };
}


/**
 * Sends a request to the Gemini API endpoint.
 * Handles history formatting and API key retrieval.
 * Version 3.9.2: Includes fixes for cleaning chat history.
 *
 * @param {string} prompt The user's current prompt or message.
 * @param {Array<object>} history The conversation history (array of {role: 'user'/'model', parts: [{text: string}]}).
 * @param {boolean} isChatInteraction Indicates if this is part of an ongoing chat vs initial topic load.
 * @returns {Promise<object>} A promise resolving to { success: boolean, data: { boardContent: string|null, ttsText: string|null, chatText: string|null, codeBlock: string|null } | null, error: string | null }.
 */
async function sendToGemini(prompt, history = [], isChatInteraction = true) {
    logDebug(`[Gemini v${GEMINI_SERVICE_VERSION}] Sending request (Chat Interaction: ${isChatInteraction}): "${prompt.substring(0, 100)}..."`);

    if (!GEMINI_API_URL) {
        const errorMsg = 'Gemini API URL is not configured.';
        logError(`[Gemini] ${errorMsg}`);
        return { success: false, data: null, error: errorMsg };
    }

    // Retrieve API Key securely (replace with your actual secure method)
    const apiKey = config.GEMINI_API_KEY; // Assuming it's directly in config for now
    if (!apiKey) {
        const errorMsg = 'Gemini API Key is missing or not configured.';
        logError(`[Gemini] ${errorMsg}`);
         // uiHelpers.showToast(errorMsg, 'error'); // Notify user if appropriate
        return { success: false, data: null, error: errorMsg };
    }

    // --- History Cleaning/Formatting (v3.9.2) ---
    const cleanedHistory = history
        .map(entry => {
            // Ensure parts is an array and contains text
            if (!entry || !Array.isArray(entry.parts) || entry.parts.length === 0 || typeof entry.parts[0].text !== 'string') {
                logWarning('[Gemini] Invalid history entry skipped:', entry);
                return null; // Skip invalid entries
            }
            // Trim whitespace from text parts
            const cleanedText = entry.parts[0].text.trim();
            if (cleanedText.length === 0) {
                 logWarning('[Gemini] History entry with empty text skipped:', entry);
                return null; // Skip entries with effectively empty text
            }
            return {
                role: entry.role,
                parts: [{ text: cleanedText }]
            };
        })
        .filter(entry => entry !== null); // Remove skipped entries

    // logDebug('[Gemini] Cleaned History:', JSON.stringify(cleanedHistory));


    // --- Construct Request Body ---
    const requestBody = {
        contents: [
            // Include history first if it exists
            ...cleanedHistory,
            // Add the current user prompt
            {
                role: "user", // Always 'user' for the latest prompt
                parts: [{ text: prompt }]
            }
        ],
         // Add generationConfig if needed (temperature, topP, topK, maxOutputTokens)
         // generationConfig: {
         //     temperature: 0.7,
         //     topP: 1.0,
         //     topK: 40,
         //     maxOutputTokens: 1024, // Adjust as needed
         // },
         // Add safetySettings if needed
         // safetySettings: [
         //     { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
         //     // Add other categories as needed
         // ]
    };

    // logDebug('[Gemini] Request Body:', JSON.stringify(requestBody).substring(0, 500) + '...'); // Log truncated body


    // --- API Call ---
    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            let errorBodyText = 'Could not read error body.';
            try {
                 // Try to parse the error response from Gemini for more details
                 const errorData = await response.json();
                 errorBodyText = JSON.stringify(errorData.error || errorData);
                 logError(`[Gemini] API Error Response: ${errorBodyText}`);
            } catch (parseError) {
                 logError(`[Gemini] Failed to parse error response body: ${parseError}`);
                 try {
                    // Fallback: try reading as plain text
                    errorBodyText = await response.text();
                    logError(`[Gemini] API Error Response (Text): ${errorBodyText}`);
                 } catch (textError) {
                     logError(`[Gemini] Failed to read error response body as text: ${textError}`);
                 }
            }
            const errorMsg = `API request failed with status ${response.status}: ${response.statusText}. Details: ${errorBodyText}`;
            logError(`[Gemini] ${errorMsg}`);
            return { success: false, data: null, error: `Chyba ${response.status}: ${errorBodyText}` }; // User-friendly part
        }

        const data = await response.json();
        // logDebug('[Gemini] Full API Response Data:', JSON.stringify(data)); // Log full response if needed

        // --- Process Response ---
        // Assuming the response structure follows the Gemini API standard
        // Response might be blocked due to safety settings
        if (data.promptFeedback && data.promptFeedback.blockReason) {
             const blockReason = data.promptFeedback.blockReason;
             const errorMsg = `Request blocked due to safety settings: ${blockReason}`;
             logError(`[Gemini] ${errorMsg}`);
             // Consider checking safetyRatings for details if needed
             // console.warn("Safety Ratings:", data.promptFeedback.safetyRatings);
             return { success: false, data: null, error: `Obsah blokován: ${blockReason}` }; // User-friendly error
        }

        // Check if candidates array exists and has content
        if (!data.candidates || data.candidates.length === 0) {
            const errorMsg = 'API response missing candidates.';
            logError(`[Gemini] ${errorMsg}`, data);
             // Check if maybe the prompt was blocked without explicit blockReason
             if (data.promptFeedback) {
                 logWarning("[Gemini] Prompt Feedback:", data.promptFeedback);
                 return { success: false, data: null, error: 'Odpověď AI byla zablokována nebo je prázdná.' };
             }
             return { success: false, data: null, error: 'AI neposkytla žádnou odpověď.' };
        }

        // Extract text from the first candidate
        const candidate = data.candidates[0];
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0 || !candidate.content.parts[0].text) {
            const errorMsg = 'API response candidate missing valid text content.';
            logError(`[Gemini] ${errorMsg}`, candidate);
            // Check finishReason for clues (e.g., "SAFETY", "RECITATION", "OTHER")
             const finishReason = candidate.finishReason || "N/A";
             logWarning(`[Gemini] Candidate Finish Reason: ${finishReason}`);
             if (finishReason === "SAFETY" || finishReason === "RECITATION") {
                 return { success: false, data: null, error: `Odpověď AI byla zastavena (${finishReason}).` };
             }
             return { success: false, data: null, error: 'Odpověď AI má nesprávný formát.' };
        }

        const responseText = candidate.content.parts[0].text;

        // Parse the extracted text
        const parsedData = parseGeminiResponse(responseText);

        return { success: true, data: parsedData, error: null };

    } catch (error) {
        logError('[Gemini] Network or other error during API call:', error);
        // Handle network errors specifically if possible (e.g., check error.message)
        let userError = 'Chyba sítě nebo serveru při komunikaci s AI.';
         if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             userError = 'Chyba sítě při komunikaci s AI. Zkontrolujte připojení.';
         }
         return { success: false, data: null, error: userError };
    }
}

// --- Export or make available globally ---
// If using modules: export { initializeGeminiService, sendToGemini };
// If using global scope:
window.geminiService = {
    initialize: initializeGeminiService,
    sendToGemini: sendToGemini,
    parseGeminiResponse: parseGeminiResponse // Expose if needed externally, though usually internal
};

logInfo(`Gemini service module loaded (v${GEMINI_SERVICE_VERSION} with chat cleaning fixes).`);