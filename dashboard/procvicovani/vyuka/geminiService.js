// vyuka/geminiService.js - Функции для взаимодействия с Google Gemini API
// Версия 3.8.6: ДИАГНОСТИЧЕСКАЯ - Замена systemInstruction на простую заглушку для поиска SyntaxError.
// Прочие изменения из v3.8.3/5 сохранены.

import {
    GEMINI_API_KEY,
    GEMINI_API_URL,
    GEMINI_SAFETY_SETTINGS,
    GEMINI_GENERATION_CONFIG,
    MAX_GEMINI_HISTORY_TURNS
} from './config.js';
import { state } from './state.js';
// UI-связанные импорты здесь не нужны

/**
 * Парсит сырой ответ от Gemini, извлекая блоки Markdown и TTS.
 * (Логика парсинга без изменений с версии 3.8.1)
 * @param {string} rawText - Сырой текстовый ответ от Gemini.
 * @returns {{ boardMarkdown: string, ttsCommentary: string, chatText: string }} - Объект с извлеченными частями.
 */
export function parseGeminiResponse(rawText) {
    const boardMarker = "[BOARD_MARKDOWN]:";
    const ttsMarker = "[TTS_COMMENTARY]:";
    let boardMarkdown = "";
    let ttsCommentary = "";
    let chatText = "";

    // Извлечение Markdown для доски
    const boardStart = rawText.indexOf(boardMarker);
    if (boardStart !== -1) {
        let blockStart = rawText.indexOf("```markdown", boardStart + boardMarker.length);
        if (blockStart === -1) blockStart = rawText.indexOf("```", boardStart + boardMarker.length);
        if (blockStart !== -1) {
            const codeBlockStartIndex = blockStart + (rawText.includes("```markdown", blockStart) ? 11 : 3);
            let blockEnd = rawText.indexOf("```", codeBlockStartIndex);
            if (blockEnd !== -1) {
                boardMarkdown = rawText.substring(codeBlockStartIndex, blockEnd).trim();
            } else {
                let potentialEnd = rawText.indexOf(ttsMarker, codeBlockStartIndex);
                if (potentialEnd === -1 || potentialEnd < codeBlockStartIndex) potentialEnd = rawText.length;
                boardMarkdown = rawText.substring(codeBlockStartIndex, potentialEnd).trim();
                console.warn("parseGeminiResponse: Missing closing ``` for board markdown.");
            }
        } else {
            let contentEnd = rawText.indexOf(ttsMarker, boardStart + boardMarker.length);
            if (contentEnd === -1 || contentEnd < boardStart) contentEnd = rawText.length;
            boardMarkdown = rawText.substring(boardStart + boardMarker.length, contentEnd).trim();
            console.warn("parseGeminiResponse: Code block ``` not found after [BOARD_MARKDOWN]:");
        }
    }

    // Извлечение комментария TTS
    const ttsStart = rawText.indexOf(ttsMarker);
    if (ttsStart !== -1) {
        let commentaryEnd = rawText.length;
        const nextBoardStart = rawText.indexOf(boardMarker, ttsStart + ttsMarker.length);
        if (nextBoardStart !== -1 && nextBoardStart > ttsStart) {
            commentaryEnd = nextBoardStart;
        }
        ttsCommentary = rawText.substring(ttsStart + ttsMarker.length, commentaryEnd).trim();
    }

    // Извлечение текста для чата
    let chatSegments = [];
    let lastIndex = 0;
    const markers = [];
    if (boardStart !== -1) {
        let boardEndIndex = boardStart + boardMarker.length + boardMarkdown.length;
         if (rawText.includes("```", boardStart + boardMarker.length)) {
             let startOfCodeBlock = rawText.indexOf("```", boardStart + boardMarker.length);
             if (startOfCodeBlock !== -1) {
                 let endOfCodeBlock = rawText.indexOf("```", startOfCodeBlock + 3);
                 if (endOfCodeBlock !== -1) boardEndIndex = endOfCodeBlock + 3;
             }
        }
        markers.push({ start: boardStart, end: boardEndIndex });
    }
    if (ttsStart !== -1) {
         let ttsEndIndex = ttsStart + ttsMarker.length + ttsCommentary.length;
         const nextBoardAfterTts = rawText.indexOf(boardMarker, ttsStart + ttsMarker.length);
         if(nextBoardAfterTts !== -1 && nextBoardAfterTts > ttsStart) ttsEndIndex = nextBoardAfterTts;
         markers.push({ start: ttsStart, end: ttsEndIndex });
    }
    markers.sort((a, b) => a.start - b.start);

    markers.forEach(marker => {
        if (marker.start > lastIndex) {
            chatSegments.push(rawText.substring(lastIndex, marker.start));
        }
        lastIndex = Math.max(lastIndex, marker.end);
    });
    if (lastIndex < rawText.length) {
        chatSegments.push(rawText.substring(lastIndex));
    }

    chatText = chatSegments
        .map(s => s.replace(boardMarker, '').replace(ttsMarker, '').replace(/```(markdown)?/g, '').trim())
        .filter(s => s.length > 0)
        .join(" ")
        .trim();

    // Убираем пунктуацию
    chatText = chatText.replace(/[.,!?;:]/g, '');

    console.log("[ParseGemini v3.8.6] Board:", boardMarkdown ? boardMarkdown.substring(0, 60) + "..." : "None");
    console.log("[ParseGemini v3.8.6] TTS:", ttsCommentary ? ttsCommentary.substring(0, 60) + "..." : "None");
    console.log("[ParseGemini v3.8.6] Chat (Raw Parsed):", chatText);

    // Упрощение чата
    if (chatText.includes(' ')) {
        const allowedPhrases = ["ano muzeme", "ne dekuji", "mam otazku", "chyba systemu", "info na tabuli", "navrhuji ukonceni", "tema uzavreno"];
        if (!allowedPhrases.includes(chatText.toLowerCase())) {
             const firstWord = chatText.split(' ')[0];
             console.log(`[ParseGemini v3.8.6] Chat text simplified from "${chatText}" to "${firstWord}"`);
             chatText = firstWord;
        }
    }

    console.log("[ParseGemini v3.8.6] Chat (Final Cleaned):", chatText || "None");

    return { boardMarkdown, ttsCommentary, chatText };
}


/**
 * Строит финальный контент для запроса к Gemini API.
 * Версия 3.8.6: ЗАМЕНА systemInstruction на заглушку для диагностики.
 * @param {string} userPrompt - Текущий промпт/сообщение от пользователя или команды приложения.
 * @returns {Array<Object>} Массив объектов 'contents' для API.
 */
function _buildGeminiPayloadContents(userPrompt) {
    // ----- ДИАГНОСТИКА: НАЧАЛО ИЗМЕНЕНИЙ -----
    // const studentLevel = state.currentProfile?.skill_level || 'střední'; // Временно не используется
    // const topicName = state.currentTopic?.name || 'Neznámé téma'; // Временно не используется
    // const boardHistorySummary = "Historie tabule ignorovana"; // Временно не используется

    // ЗАМЕНЯЕМ СЛОЖНЫЙ ПРОМПТ НА ПРОСТУЮ ЗАГЛУШКУ
    const systemInstruction = 'System prompt placeholder';
    console.warn("[Gemini v3.8.6 DIAG] Using simplified systemInstruction placeholder!");
    // ----- ДИАГНОСТИКА: КОНЕЦ ИЗМЕНЕНИЙ -----


    const history = state.geminiChatContext.slice(-MAX_GEMINI_HISTORY_TURNS * 2);
    const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };

    // Строка подтверждения модели (остается вынесенной, но теперь бессмысленна без переменных)
    // Используем простую строку, чтобы не зависеть от переменных topicName/studentLevel
    const modelConfirmationText = `Rozumim Pripraven`;

    const contents = [
        // Используем простую заглушку systemInstruction
        { role: "user", parts: [{ text: systemInstruction }] },
        // Используем простую строку-подтверждение
        { role: "model", parts: [{ text: modelConfirmationText }] }, // Запятая после важна
        ...history, // История пока остается
        currentUserMessage
    ];

    // Ограничение контекста
    const maxHistoryLength = MAX_GEMINI_HISTORY_TURNS * 2;
    if (contents.length > maxHistoryLength + 3) {
        const historyStartIndex = contents.length - maxHistoryLength - 1;
        contents.splice(2, historyStartIndex - 2);
        console.warn(`[Gemini v3.8.6 DIAG] Context length exceeded limit trimmed history New length ${contents.length}`);
    }

    return contents;
}


/**
 * Отправляет запрос к Gemini API и возвращает обработанный ответ.
 * Версия 3.8.6: ДИАГНОСТИЧЕСКАЯ. Использует исправленный _buildGeminiPayloadContents с заглушкой.
 * @param {string} prompt - Промпт для Gemini (может быть командой или текстом пользователя).
 * @param {boolean} isChatInteraction - Указывает, является ли это прямым взаимодействием в чате (влияет на логирование).
 * @returns {Promise<{success: boolean, data: {boardMarkdown: string, ttsCommentary: string, chatText: string}|null, error: string|null}>}
 */
export async function sendToGemini(prompt, isChatInteraction = false) {
    // Проверки API ключа и промпта
    if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) {
        console.error("[Gemini v3.8.6 DIAG] Invalid or missing API Key");
        return { success: false, data: null, error: "Chyba Konfigurace Chybi platny API klic pro AI" };
    }
    if (!prompt || prompt.trim() === '') {
        console.error("[Gemini v3.8.6 DIAG] Empty prompt provided");
        return { success: false, data: null, error: "Chyba Prazdny dotaz pro AI" };
    }
    // Проверка currentTopic остается важной
    if (!state.currentTopic && !prompt.includes("Vysvětli ZÁKLADY")) {
        console.error("[Gemini v3.8.6 DIAG] No current topic set for non-initial prompt");
        return { success: false, data: null, error: "Chyba Neni vybrano tema" };
    }

    console.log(`[Gemini v3.8.6 DIAG] Sending request (Chat Interaction: ${isChatInteraction}): "${prompt.substring(0, 80)}..."`);

    // Построение payload (с заглушкой вместо systemInstruction)
    const contents = _buildGeminiPayloadContents(prompt);

    // console.log("[Gemini v3.8.6 DIAG] Payload Contents:", JSON.stringify(contents, null, 2));

    const body = {
        contents,
        generationConfig: GEMINI_GENERATION_CONFIG,
        safetySettings: GEMINI_SAFETY_SETTINGS
    };

    try {
        // Отправка запроса и обработка ответа (логика fetch без изменений)
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const responseData = await response.json();

        if (!response.ok) {
            let errorText = `Chyba API ${response.status}`;
            if (responseData?.error?.message) { errorText += ` ${responseData.error.message}`; }
            else if (typeof responseData === 'string') { errorText += ` ${responseData}`; }
            else { errorText += ` Neznama chyba API`; }
            errorText = errorText.replace(/[.,!?;:]/g, '');
            console.error("[Gemini v3.8.6 DIAG] API Error Response:", responseData);
            throw new Error(errorText);
        }

        // console.log("[Gemini v3.8.6 DIAG] Raw API Response:", JSON.stringify(responseData, null, 2));

        // Проверки безопасности и кандидата (без изменений)
        if (responseData.promptFeedback?.blockReason) {
            console.error("[Gemini v3.8.6 DIAG] Request blocked:", responseData.promptFeedback);
            throw new Error(`Pozadavek blokovan ${responseData.promptFeedback.blockReason}`);
        }
        const candidate = responseData.candidates?.[0];
        if (!candidate) {
            console.error("[Gemini v3.8.6 DIAG] No candidate found in response:", responseData);
            throw new Error('AI neposkytlo platnou odpoved');
        }

        // Проверка причины завершения (без изменений)
        if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
            console.warn(`[Gemini v3.8.6 DIAG] Potentially problematic FinishReason: ${candidate.finishReason}.`);
            let reasonText = `Generovani ukonceno ${candidate.finishReason}`;
            if (candidate.finishReason === 'SAFETY') reasonText = 'Odpoved blokovana filtrem';
            if (candidate.finishReason === 'RECITATION') reasonText = 'Odpoved blokovana recitace';
            throw new Error(reasonText);
        }

        const rawText = candidate.content?.parts?.[0]?.text;

        // Обработка пустого ответа (без изменений)
        if (!rawText && candidate.finishReason && candidate.finishReason !== 'STOP') {
             if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Odpoved AI prilis dlouha');
             else throw new Error('AI vratilo prazdnou odpoved Duvod ' + (candidate.finishReason || 'Neznamy'));
        }
        if (!rawText) {
            console.warn("[Gemini v3.8.6 DIAG] Response candidate has no text content returning empty parsed data");
             state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] });
             state.geminiChatContext.push({ role: "model", parts: [{ text: "" }] });
             if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2 + 2) {
                 state.geminiChatContext.splice(2, state.geminiChatContext.length - (MAX_GEMINI_HISTORY_TURNS * 2 + 2));
             }
            return { success: true, data: { boardMarkdown: "", ttsCommentary: "", chatText: "" }, error: null };
        }

        // Добавление в историю (без изменений)
        state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] });
        state.geminiChatContext.push({ role: "model", parts: [{ text: rawText }] });
        if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2 + 2) {
             state.geminiChatContext.splice(2, state.geminiChatContext.length - (MAX_GEMINI_HISTORY_TURNS * 2 + 2));
        }

        // Сохранение истории доски (без изменений)
        const boardMatch = rawText.match(/\[BOARD_MARKDOWN]:\s*```(markdown)?([\s\S]*?)```/);
        if (boardMatch && boardMatch[2]) {
            state.boardContentHistory.push(boardMatch[2].trim());
            if(state.boardContentHistory.length > 7) {
                state.boardContentHistory.shift();
            }
        }

        // Парсинг ответа (используется parseGeminiResponse v3.8.6)
        const parsedData = parseGeminiResponse(rawText);
        return { success: true, data: parsedData, error: null };

    } catch (error) {
        console.error('[Gemini v3.8.6 DIAG] Chyba komunikace s Gemini nebo zpracovani odpovedi:', error);
        return { success: false, data: null, error: (error.message || "Neznama chyba AI").replace(/[.,!?;:]/g, '') };
    }
}

console.log("Gemini service module loaded (v3.8.6 DIAGNOSTIC with simplified prompt).");