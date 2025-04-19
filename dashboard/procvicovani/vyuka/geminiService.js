// vyuka/geminiService.js - Функции для взаимодействия с Google Gemini API
// Версия 3.8.9: Добавлено правило обработки команды "Pokračuj" в systemInstruction.
// Прочие изменения из v3.8.8 сохранены.

import {
    GEMINI_API_KEY,
    GEMINI_API_URL,
    GEMINI_SAFETY_SETTINGS,
    GEMINI_GENERATION_CONFIG,
    MAX_GEMINI_HISTORY_TURNS
} from './config.js';
import { state } from './state.js';

/**
 * Парсит сырой ответ от Gemini, извлекая блоки Markdown и TTS.
 * @param {string} rawText - Сырой текстовый ответ от Gemini.
 * @returns {{ boardMarkdown: string, ttsCommentary: string, chatText: string }} - Объект с извлеченными частями.
 */
export function parseGeminiResponse(rawText) {
    // ... (логика парсинга без изменений с v3.8.8) ...
    const boardMarker = "[BOARD_MARKDOWN]:"; const ttsMarker = "[TTS_COMMENTARY]:"; let boardMarkdown = ""; let ttsCommentary = ""; let chatText = "";
    const boardStart = rawText.indexOf(boardMarker); if (boardStart !== -1) { let blockStart = rawText.indexOf("```markdown", boardStart + boardMarker.length); if (blockStart === -1) blockStart = rawText.indexOf("```", boardStart + boardMarker.length); if (blockStart !== -1) { const codeBlockStartIndex = blockStart + (rawText.includes("```markdown", blockStart) ? 11 : 3); let blockEnd = rawText.indexOf("```", codeBlockStartIndex); if (blockEnd !== -1) { boardMarkdown = rawText.substring(codeBlockStartIndex, blockEnd).trim(); } else { let potentialEnd = rawText.indexOf(ttsMarker, codeBlockStartIndex); if (potentialEnd === -1 || potentialEnd < codeBlockStartIndex) potentialEnd = rawText.length; boardMarkdown = rawText.substring(codeBlockStartIndex, potentialEnd).trim(); console.warn("parseGeminiResponse: Missing closing ``` for board markdown."); } } else { let contentEnd = rawText.indexOf(ttsMarker, boardStart + boardMarker.length); if (contentEnd === -1 || contentEnd < boardStart) contentEnd = rawText.length; boardMarkdown = rawText.substring(boardStart + boardMarker.length, contentEnd).trim(); console.warn("parseGeminiResponse: Code block ``` not found after [BOARD_MARKDOWN]:"); } }
    const ttsStart = rawText.indexOf(ttsMarker); if (ttsStart !== -1) { let commentaryEnd = rawText.length; const nextBoardStart = rawText.indexOf(boardMarker, ttsStart + ttsMarker.length); if (nextBoardStart !== -1 && nextBoardStart > ttsStart) { commentaryEnd = nextBoardStart; } ttsCommentary = rawText.substring(ttsStart + ttsMarker.length, commentaryEnd).trim(); }
    let chatSegments = []; let lastIndex = 0; const markers = []; if (boardStart !== -1) { let boardEndIndex = boardStart + boardMarker.length + boardMarkdown.length; if (rawText.includes("```", boardStart + boardMarker.length)) { let startOfCodeBlock = rawText.indexOf("```", boardStart + boardMarker.length); if (startOfCodeBlock !== -1) { let endOfCodeBlock = rawText.indexOf("```", startOfCodeBlock + 3); if (endOfCodeBlock !== -1) boardEndIndex = endOfCodeBlock + 3; } } markers.push({ start: boardStart, end: boardEndIndex }); } if (ttsStart !== -1) { let ttsEndIndex = ttsStart + ttsMarker.length + ttsCommentary.length; const nextBoardAfterTts = rawText.indexOf(boardMarker, ttsStart + ttsMarker.length); if(nextBoardAfterTts !== -1 && nextBoardAfterTts > ttsStart) ttsEndIndex = nextBoardAfterTts; markers.push({ start: ttsStart, end: ttsEndIndex }); } markers.sort((a, b) => a.start - b.start);
    markers.forEach(marker => { if (marker.start > lastIndex) { chatSegments.push(rawText.substring(lastIndex, marker.start)); } lastIndex = Math.max(lastIndex, marker.end); }); if (lastIndex < rawText.length) { chatSegments.push(rawText.substring(lastIndex)); }
    chatText = chatSegments.map(s => s.replace(boardMarker, '').replace(ttsMarker, '').replace(/```(markdown)?/g, '').trim()).filter(s => s.length > 0).join(" ").trim(); chatText = chatText.replace(/[.,!?;:]/g, '').replace(/\$/g, '');
    console.log("[ParseGemini v3.8.9] Board:", boardMarkdown ? boardMarkdown.substring(0, 60) + "..." : "None"); console.log("[ParseGemini v3.8.9] TTS:", ttsCommentary ? ttsCommentary.substring(0, 60) + "..." : "None"); console.log("[ParseGemini v3.8.9] Chat (Raw Parsed):", chatText);
    if (chatText.includes(' ')) { const allowedPhrases = ["ano muzeme", "ne dekuji", "mam otazku", "chyba systemu", "info na tabuli", "navrhuji ukonceni", "tema uzavreno", "na tabuli", "pokracujeme", "zkus to", "vyborne", "spravne", "chyba", "pozor"]; if (!allowedPhrases.includes(chatText.toLowerCase())) { const firstWord = chatText.split(' ')[0]; console.log(`[ParseGemini v3.8.9] Chat text simplified from "${chatText}" to "${firstWord}"`); chatText = firstWord; } } console.log("[ParseGemini v3.8.9] Chat (Final Cleaned):", chatText || "None");
    return { boardMarkdown, ttsCommentary, chatText };
}


/**
 * Строит финальный контент для запроса к Gemini API.
 * Версия 3.8.9: Уточнено правило для кнопки "Pokračuj".
 * @param {string} userPrompt - Текущий промпт/сообщение от пользователя или команды приложения.
 * @returns {Array<Object>} Массив объектов 'contents' для API.
 */
function _buildGeminiPayloadContents(userPrompt) {
    const studentLevel = state.currentProfile?.skill_level || 'střední';
    const topicName = state.currentTopic?.name || 'Neznámé téma';
    const boardHistorySummary = state.boardContentHistory.length > 0
        ? "Stručný souhrn PŘEDCHOZÍHO obsahu tabule:\n" + state.boardContentHistory.map(c => `- ${c.substring(0, 100).replace(/[\r\n]+/g, ' ')}...`).slice(-3).join('\n')
        : "Tabule je zatím prázdná.";

    // --- СИСТЕМНЫЙ ПРОМПТ (Версия 3.8.9) ---
    let systemInstructionParts = [];
    systemInstructionParts.push(`Jsi **expertní AI Tutor "Justax"** specializující se na **MATEMATIKU pro PŘIJÍMACÍ ZKOUŠKY na SŠ** v Česku.`);
    systemInstructionParts.push(`Tvým úkolem je **důkladně** vysvětlit téma "${topicName}" studentovi s aktuální úrovní znalostí "${studentLevel}".`);
    systemInstructionParts.push(`Cílem je příprava na úroveň CERMAT testů. Buď **precizní, metodický a náročný**, ale stále trpělivý. Komunikuj POUZE v ČEŠTINĚ.`);

    systemInstructionParts.push(`\n**ZÁSADNÍ PRAVIDLA KOMUNIKACE:**\n`);
    systemInstructionParts.push(`* **DOMINUJE TABULE:** Veškerý **obsah** (vysvětlení, teorie, vzorce, kroky řešení, odpovědi, příklady, zpětná vazba, zadání úkolů) patří **PRIMÁRNĚ** na TABULI (\`[BOARD_MARKDOWN]:\`).`);
    systemInstructionParts.push(`* **TTS DOPLŇUJE:** Mluvený komentář (\`[TTS_COMMENTARY]:\`) slouží k **rozšíření** toho, co je na tabuli.`);
    systemInstructionParts.push(`* **CHAT MINIMALISTICKÝ:** Chat slouží **POUZE** pro **ultra-krátké** signalizační zprávy (1-2 slova). **ŽÁDNÁ PUNKTUACE, ŽÁDNÝ symbol dolaru ($) v CHATU.**`);
    systemInstructionParts.push(`* **NÁROČNOST ("Přijímačky"):** Vysvětluj do **hloubky**. Používej **komplexnější příklady**. Požaduj **detailní postup řešení**.`);

    systemInstructionParts.push(`\n**Struktura Výstupu:**\n`);
    systemInstructionParts.push(`1.  **TABULE (\`[BOARD_MARKDOWN]:\`)**: VŽDY začíná \`[BOARD_MARKDOWN]:\`, následuje \`\
        \`\`markdown ... \`\`\`\`. Obsah: Teorie, vzorce, kroky, příklady, odpovědi, zpětná vazba. Formát: Nadpisy (\`##\`, \`###\`), seznamy (\`*\`, \`-\`, \`1.\`), tučné (\`**..**\`), kurzíva (\`*..*\`), LaTeX (\`$\`, \`<span class="math-block">\`). **Žádný inline kód (\
        \`)**.`);
    systemInstructionParts.push(`2.  **MLUVENÝ KOMENTÁŘ (\`[TTS_COMMENTARY]:\`)**: VŽDY začíná \`[TTS_COMMENTARY]:\`, následuje čistý text. Doplnění tabule, upozornění, motivace.`);
    systemInstructionParts.push(`3.  **CHAT (BEZ ..., BEZ $, 1-2 SLOVA)**: POUZE signalizace. Příklady: \`Na tabuli\`, \`Hotovo\`, \`Spravne\`, \`Chyba\`, \`Zkus to\`, \`Pokracujeme\`, \`Ano muzeme\`, \`Ne dekuji\`, \`Navrhuji ukonceni [PROPOSE_COMPLETION]\`.`);

    systemInstructionParts.push(`\n**Interakce:**\n`);
    systemInstructionParts.push(`* **Otázka Studenta:** Odpověď na TABULI + CHAT: \`Na tabuli\`.`);
    systemInstructionParts.push(`* **Řešení Studenta:** Zpětná vazba na TABULI + CHAT: \`Spravne\` / \`Chyba\`.`);
    systemInstructionParts.push(`* **Kontrola:** Úkol na TABULI + CHAT: \`Zkus to\`.`);
    // ИЗМЕНЕНИЕ: Правило для кнопки "Pokračovat"
    systemInstructionParts.push(`* **Příkaz "Pokračuj...":** Pokud dostaneš od aplikace příkaz začínající "Pokračuj ve vysvětlování...", IGNORUJ případný předchozí nezodpovězený úkol a pokračuj DALŠÍ logickou částí výkladu nebo novým příkladem na TABULI. Do CHATU napiš \`Pokracujeme\`.`);

    systemInstructionParts.push(`\n**Ukončení:**\n`);
    systemInstructionParts.push(`* **PODMÍNKY:** Navrhuj **POUZE** po důkladném probrání tématu "${topicName}" na úrovni Přijímaček a **úspěšném vyřešení několika komplexních úloh** studentem.`);
    systemInstructionParts.push(`* **Návrh:** 1. Shrnutí na TABULI. 2. CHAT: \`Navrhuji ukonceni [PROPOSE_COMPLETION]\`.`);

    systemInstructionParts.push(`\n**Shrnutí Historie Tabule:**\n${boardHistorySummary}\n`);
    systemInstructionParts.push(`**PŘÍSNĚ DODRŽUJ! TABULE DOMINUJE, CHAT MINIMUM BEZ INTERPUNKCE/$. Úroveň Přijímačky.**`);

    const systemInstruction = systemInstructionParts.join('\n');
    // --- КОНЕЦ СБОРКИ systemInstruction ---

    const history = state.geminiChatContext.slice(-MAX_GEMINI_HISTORY_TURNS * 2);
    const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };
    const modelConfirmationText = `Rozumim Budu AI Tutor Justax zamereny na prijimacky Tema ${topicName} Uroven ${studentLevel} Tabule dominantni TTS doplnujici Chat minimalisticky bez interpunkce a bez dolaru Ukonceni opatrne s markerem [PROPOSE_COMPLETION]`;

    const contents = [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: modelConfirmationText }] },
        ...history,
        currentUserMessage
    ];

    const maxHistoryLength = MAX_GEMINI_HISTORY_TURNS * 2;
    if (contents.length > maxHistoryLength + 3) {
        const historyStartIndex = contents.length - maxHistoryLength - 1;
        contents.splice(2, historyStartIndex - 2);
        console.warn(`[Gemini v3.8.9] Context length exceeded limit trimmed history New length ${contents.length}`);
    }
    return contents;
}


/**
 * Отправляет запрос к Gemini API и возвращает обработанный ответ.
 * Версия 3.8.9: Использует обновленный _buildGeminiPayloadContents.
 * @param {string} prompt - Промпт для Gemini.
 * @param {boolean} isChatInteraction - Флаг чат-интеракции.
 * @returns {Promise<{success: boolean, data: object|null, error: string|null}>}
 */
export async function sendToGemini(prompt, isChatInteraction = false) {
    // ... (Проверки API ключа и промпта без изменений) ...
    if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) { console.error("[Gemini v3.8.9] Invalid or missing API Key"); return { success: false, data: null, error: "Chyba Konfigurace Chybi platny API klic pro AI" }; }
    if (!prompt || prompt.trim() === '') { console.error("[Gemini v3.8.9] Empty prompt provided"); return { success: false, data: null, error: "Chyba Prazdny dotaz pro AI" }; }
    if (!state.currentTopic && !prompt.includes("Vysvětli ZÁKLADY")) { console.error("[Gemini v3.8.9] No current topic set for non-initial prompt"); return { success: false, data: null, error: "Chyba Neni vybrano tema" }; }

    console.log(`[Gemini v3.8.9] Sending request (Chat Interaction: ${isChatInteraction}): "${prompt.substring(0, 80)}..."`);

    const contents = _buildGeminiPayloadContents(prompt);
    const body = {
        contents,
        generationConfig: GEMINI_GENERATION_CONFIG,
        safetySettings: GEMINI_SAFETY_SETTINGS
    };

    try {
        // --- Отправка и обработка ответа (без изменений с v3.8.7) ---
         const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const responseData = await response.json();
         if (!response.ok) { let errorText = `Chyba API ${response.status}`; if (responseData?.error?.message) { errorText += ` ${responseData.error.message}`; } else if (typeof responseData === 'string') { errorText += ` ${responseData}`; } else { errorText += ` Neznama chyba API`; } errorText = errorText.replace(/[.,!?;:]/g, ''); console.error("[Gemini v3.8.9] API Error Response:", responseData); throw new Error(errorText); }
         if (responseData.promptFeedback?.blockReason) { console.error("[Gemini v3.8.9] Request blocked:", responseData.promptFeedback); throw new Error(`Pozadavek blokovan ${responseData.promptFeedback.blockReason}`); } const candidate = responseData.candidates?.[0]; if (!candidate) { console.error("[Gemini v3.8.9] No candidate found in response:", responseData); throw new Error('AI neposkytlo platnou odpoved'); } if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) { console.warn(`[Gemini v3.8.9] Potentially problematic FinishReason: ${candidate.finishReason}.`); let reasonText = `Generovani ukonceno ${candidate.finishReason}`; if (candidate.finishReason === 'SAFETY') reasonText = 'Odpoved blokovana filtrem'; if (candidate.finishReason === 'RECITATION') reasonText = 'Odpoved blokovana recitace'; throw new Error(reasonText); } const rawText = candidate.content?.parts?.[0]?.text;
         if (!rawText && candidate.finishReason && candidate.finishReason !== 'STOP') { if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Odpoved AI prilis dlouha'); else throw new Error('AI vratilo prazdnou odpoved Duvod ' + (candidate.finishReason || 'Neznamy')); } if (!rawText) { console.warn("[Gemini v3.8.9] Response candidate has no text content returning empty parsed data"); state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] }); state.geminiChatContext.push({ role: "model", parts: [{ text: "" }] }); if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2 + 2) { state.geminiChatContext.splice(2, state.geminiChatContext.length - (MAX_GEMINI_HISTORY_TURNS * 2 + 2)); } return { success: true, data: { boardMarkdown: "", ttsCommentary: "", chatText: "" }, error: null }; }
         state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] }); state.geminiChatContext.push({ role: "model", parts: [{ text: rawText }] }); if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2 + 2) { state.geminiChatContext.splice(2, state.geminiChatContext.length - (MAX_GEMINI_HISTORY_TURNS * 2 + 2)); } const boardMatch = rawText.match(/\[BOARD_MARKDOWN]:\s*```(markdown)?([\s\S]*?)```/); if (boardMatch && boardMatch[2]) { state.boardContentHistory.push(boardMatch[2].trim()); if(state.boardContentHistory.length > 7) { state.boardContentHistory.shift(); } }
         const parsedData = parseGeminiResponse(rawText); // Использует parseGeminiResponse v3.8.9
         return { success: true, data: parsedData, error: null };
         // --- Конец отправки и обработки ---

    } catch (error) {
        console.error('[Gemini v3.8.9] Chyba komunikace s Gemini nebo zpracovani odpovedi:', error);
        return { success: false, data: null, error: (error.message || "Neznama chyba AI").replace(/[.,!?;:]/g, '') };
    }
}

console.log("Gemini service module loaded (v3.8.9 with continue rule).");