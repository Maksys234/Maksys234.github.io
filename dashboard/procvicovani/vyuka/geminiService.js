// geminiService.js - Функции для взаимодействия с Google Gemini API (Версия с улучшенным промптом)

import {
    GEMINI_API_KEY,
    GEMINI_API_URL,
    GEMINI_SAFETY_SETTINGS,
    GEMINI_GENERATION_CONFIG,
    MAX_GEMINI_HISTORY_TURNS
} from './config.js';
import { state } from './state.js';
// UI-связанные импорты здесь не нужны, сервис только возвращает данные

/**
 * Парсит сырой ответ от Gemini, извлекая блоки Markdown и TTS.
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
            const codeBlockStartIndex = blockStart + (rawText.includes("```markdown", blockStart) ? 11 : 3); // +11 for ```markdown\n or +3 for ```\n
            let blockEnd = rawText.indexOf("```", codeBlockStartIndex);
            if (blockEnd !== -1) {
                boardMarkdown = rawText.substring(codeBlockStartIndex, blockEnd).trim();
            } else {
                boardMarkdown = rawText.substring(codeBlockStartIndex).trim();
                console.warn("parseGeminiResponse: Missing closing ``` for board markdown.");
            }
        } else {
            // Если блок ``` не найден, попробуем извлечь до следующего маркера или конца
            let contentEnd = rawText.indexOf(ttsMarker, boardStart);
            if (contentEnd === -1) contentEnd = rawText.length;
            boardMarkdown = rawText.substring(boardStart + boardMarker.length, contentEnd).trim();
            console.warn("parseGeminiResponse: Code block ``` not found after [BOARD_MARKDOWN]:, extracting content until next marker or end.");
        }
    }

    // Извлечение комментария TTS
    const ttsStart = rawText.indexOf(ttsMarker);
    if (ttsStart !== -1) {
        // Комментарий идет до конца или до следующего маркера [BOARD_MARKDOWN], если он есть *после* TTS
        let commentaryEnd = rawText.length;
        const nextBoardStart = rawText.indexOf(boardMarker, ttsStart + ttsMarker.length);
        if (nextBoardStart !== -1) {
            commentaryEnd = nextBoardStart;
        }
        ttsCommentary = rawText.substring(ttsStart + ttsMarker.length, commentaryEnd).trim();
    }

    // Извлечение текста для чата (все, что не попало в другие блоки)
    let chatSegments = [];
    let lastIndex = 0;
    const markers = [];
    if (boardStart !== -1) {
        let boardEndIndex = rawText.indexOf("```", boardStart + boardMarker.length);
        if (boardEndIndex !== -1) boardEndIndex = rawText.indexOf("```", boardEndIndex + 3) + 3;
        if (boardEndIndex < 3) boardEndIndex = boardStart + boardMarker.length + boardMarkdown.length; // Fallback if no ```
        markers.push({ start: boardStart, end: Math.max(boardStart + boardMarker.length, boardEndIndex) });
    }
    if (ttsStart !== -1) {
        let ttsEndIndex = ttsStart + ttsMarker.length + ttsCommentary.length;
        const nextBoardStart = rawText.indexOf(boardMarker, ttsStart + ttsMarker.length);
         if (nextBoardStart !== -1 && nextBoardStart > ttsStart) {
             ttsEndIndex = nextBoardStart; // TTS ends before the next board marker
         }
         markers.push({ start: ttsStart, end: ttsEndIndex });
    }
    markers.sort((a, b) => a.start - b.start);

    markers.forEach(marker => {
        if (marker.start > lastIndex) {
            chatSegments.push(rawText.substring(lastIndex, marker.start));
        }
        lastIndex = marker.end;
    });
    if (lastIndex < rawText.length) {
        chatSegments.push(rawText.substring(lastIndex));
    }

    chatText = chatSegments
        .map(s => s.replace(boardMarker, '').replace(ttsMarker, '').replace(/```(markdown)?/g, '').trim())
        .filter(s => s.length > 0)
        .join("\n\n") // Join segments with double newline for paragraph breaks
        .trim();

    // Исправляем возможное попадание "?" в chatText, если это был единственный остаток
    if (chatText === '?') {
        chatText = ""; // Игнорируем одинокий "?"
    }

    console.log("[ParseGemini V2] Board:", boardMarkdown ? boardMarkdown.substring(0, 60) + "..." : "None");
    console.log("[ParseGemini V2] TTS:", ttsCommentary ? ttsCommentary.substring(0, 60) + "..." : "None");
    console.log("[ParseGemini V2] Chat:", chatText ? chatText.substring(0, 60) + "..." : "None");

    return { boardMarkdown, ttsCommentary, chatText };
}


// --- Функции для создания промптов (вспомогательные) ---

// Эти функции теперь менее важны, т.к. основная логика в _buildGeminiPayloadContents
// Оставляем их для совместимости или будущих доработок, но они не будут формировать полный запрос.
function _buildInitialPrompt() {
    // Этот промпт теперь используется только как часть _buildGeminiPayloadContents
    return `Vysvětli ZÁKLADY tématu "${state.currentTopic?.name}". Začni PRVNÍ částí.`;
}
function _buildContinuePrompt() {
    // Этот промпт теперь используется только как часть _buildGeminiPayloadContents
    return `Pokračuj ve vysvětlování tématu "${state.currentTopic?.name}". Naváž na předchozí část.`;
}
function _buildChatInteractionPrompt(userText) {
     // Этот промпт теперь используется только как часть _buildGeminiPayloadContents
     return state.aiIsWaitingForAnswer
         ? `Student odpověděl: "${userText}"`
         : `Student píše do chatu: "${userText}"`;
 }


/**
 * Строит финальный контент для запроса к Gemini API, включая улучшенную системную инструкцию.
 * @param {string} userPrompt - Текущий промпт/сообщение от пользователя или команды приложения.
 * @returns {Array<Object>} Массив объектов 'contents' для API.
 */
function _buildGeminiPayloadContents(userPrompt) {
    const level = state.currentProfile?.skill_level || 'neznámá';
    const topicName = state.currentTopic?.name || 'Neznámé téma';

    // --- УЛУЧШЕННЫЙ СИСТЕМНЫЙ ПРОМПТ (v2) ---
    const systemInstruction = `
Jsi expertní, přátelský a trpělivý AI Tutor "Justax". Tvým cílem je efektivně vysvětlit téma "${topicName}" studentovi 9. třídy ZŠ v Česku s aktuální úrovní znalostí "${level}". Komunikuj POUZE v ČEŠTINĚ.

Tvůj výstup MUSÍ být strukturován pomocí JEDNOHO nebo VÍCE z následujících kanálů/formátů, v závislosti na kontextu:

1.  **TABULE (`[BOARD_MARKDOWN]:`)**
    * **Účel:** Prezentace klíčových, strukturovaných informací (definice, vzorce, kroky řešení, diagramy, tabulky). Obsah musí být vizuálně přehledný.
    * **Formát:** VŽDY začíná markerem \`[BOARD_MARKDOWN]:\` následovaným blokem kódu \`\`\`markdown ... \`\`\`.
    * **Obsah Markdown:**
        * Používej POUZE: Nadpisy (\`##\`, \`###\`), seznamy (\`*\`, \`-\`, \`1.\`), tučné písmo (\`**text**\`), kurzívu (\`*text*\`), inline kód (\``kód`\`) pro zvýraznění, LaTeX pro vzorce (\`$ ... $\` pro inline, \`$$...$$\` pro blokové).
        * Text musí být STRUČNÝ, věcný a dobře organizovaný.
        * ZDE NEPOUŽÍVEJ konverzační styl, otázky ani dlouhé odstavce. Toto je pro vizuální prezentaci.
    * **Kdy použít:** POVINNĚ při *zahájení* výkladu (\`startLearningSession\`) a při *pokračování* výkladu (\`requestContinue\`). Také POUZE tehdy, když student VÝSLOVNĚ požádá o zobrazení něčeho na tabuli (např. "ukaž postup na tabuli", "napiš rovnici na tabuli").

2.  **MLUVENÝ KOMENTÁŘ (`[TTS_COMMENTARY]:`)**
    * **Účel:** Podrobnější, konverzační vysvětlení obsahu zobrazeného na tabuli nebo poskytnutí dalšího kontextu.
    * **Formát:** VŽDY začíná markerem \`[TTS_COMMENTARY]:\` následovaným čistým textem (bez Markdown).
    * **Obsah:**
        * Vysvětluj koncepty srozumitelně, přizpůsobeno úrovni "${level}". Rozveď myšlenky z tabule.
        * MŮŽEŠ použít řečnické otázky nebo jednoduché kontrolní otázky ("Rozumíme si?", "Je to jasné?", "Můžeme přejít dál?").
        * NEPOKLÁDEJ zde složité otázky nebo příklady, které má student vyřešit – ty patří do chatu.
    * **Kdy použít:** VŽDY SPOLEČNĚ S \`[BOARD_MARKDOWN]:\` při *zahájení* a *pokračování* výkladu. NIKDY samostatně. NIKDY v reakci na zprávu studenta v chatu.

3.  **CHAT (Čistý text)**
    * **Účel:** Přímá interakce se studentem - odpovídání na jeho otázky, KONTROLA jeho odpovědí, pokládání KONKRÉTNÍCH otázek k zamyšlení nebo procvičení, krátká zpětná vazba, přechodové fráze.
    * **Formát:** POUZE čistý text. ŽÁDNÉ MARKERY (\`[BOARD_MARKDOWN]:\`, \`[TTS_COMMENTARY]:\`), ŽÁDNÉ bloky \`\`\`markdown\`.
    * **Obsah:**
        * Udržuj přátelský a podporující tón.
        * Odpovědi musí být relevantní k tématu "${topicName}" a aktuální diskuzi.
        * MŮŽEŠ POKLÁDAT **konkrétní otázky** vyžadující odpověď studenta (např. "Jak bys upravil tento výraz?", "Zkus vypočítat hodnotu x.", "Co si myslíš o tomto kroku?").
        * Pokud hodnotíš odpověď studenta, buď KONSTRUKTIVNÍ. Pokud je špatně, vysvětli proč.
        * Odpovědi by měly být spíše KRATŠÍ, pokud nejde o vysvětlení složitého dotazu studenta.
        * **DŮLEŽITÉ:** Vyhni se zakončení odpovědi POUZE otazníkem (\`?\`), pokud to není skutečná, smysluplná otázka pro studenta. Místo "?" použij např. "Můžeme pokračovat?".
    * **Kdy použít:** VŽDY v reakci na zprávu studenta v chatu (pokud student nepožádal o zobrazení na tabuli - viz výjimka níže). MŮŽE následovat po bloku TABULE+TTS, pokud chceš v chatu položit doplňující otázku.

**SPECIÁLNÍ PŘÍPADY:**

* **Student žádá o zobrazení na tabuli:** Pokud student napíše něco jako "ukaž na tabuli", "napiš postup", "jak vypadá vzorec", pak:
    1.  Použij \`[BOARD_MARKDOWN]:\` \`\`\`markdown ... \`\`\` pro zobrazení požadovaného obsahu (rovnice, kroky, vzorec).
    2.  Do CHATU napiš pouze KRÁTKOU potvrzovací zprávu, např. "Jasně, tady je to na tabuli:" nebo "Dobře, postup je teď na tabuli.". NEopakuj obsah tabule v chatu.
* **Studentova odpověď na tvou otázku:** Pokud student odpovídá na tvou předchozí otázku z chatu, vyhodnoť jeho odpověď v CHATU (čistým textem) a poté buď polož další otázku, nebo navrhni pokračování výkladu pomocí \`[BOARD_MARKDOWN]:\` a \`[TTS_COMMENTARY]:\`.

**PŘÍSNĚ DODRŽUJ STRUKTURU A PRAVIDLA PRO JEDNOTLIVÉ KANÁLY!** Nepoužívej markery tam, kde nemají být, a naopak. Udržuj kontext diskuze.
`;
    // --- КОНЕЦ УЛУЧШЕННОГО ПРОМПТА ---

    // Берем последние N*2 сообщений (вопрос-ответ) + 2 системных
    const history = state.geminiChatContext.slice(-MAX_GEMINI_HISTORY_TURNS * 2);
    const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };

     // Структура: Системные инструкции -> Подтверждение Модели -> История -> Текущий Запрос
     const contents = [
         { role: "user", parts: [{ text: systemInstruction }] },
         // Обновленный ответ модели для подтверждения понимания правил
         { role: "model", parts: [{ text: `Rozumím. Jsem AI tutor Justax, připravený vysvětlovat téma "${topicName}" pro úroveň "${level}". Budu striktně dodržovat pravidla pro používání tabule (\`[BOARD_MARKDOWN]:\` + \`\`\`markdown\`), mluveného komentáře (\`[TTS_COMMENTARY]:\`) a chatu (čistý text). Na explicitní žádost studenta zobrazím obsah i na tabuli během chatu.` }] },
         ...history,
         currentUserMessage
     ];

    return contents;
}

/**
 * Отправляет запрос к Gemini API и возвращает обработанный ответ.
 * @param {string} prompt - Промпт для Gemini (может быть командой или текстом пользователя).
 * @param {boolean} isChatInteraction - Указывает, является ли это прямым взаимодействием в чате.
 * @returns {Promise<{success: boolean, data: {boardMarkdown: string, ttsCommentary: string, chatText: string}|null, error: string|null}>}
 */
export async function sendToGemini(prompt, isChatInteraction = false) {
    if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) {
        console.error("[Gemini] Invalid or missing API Key!");
        return { success: false, data: null, error: "Chyba Konfigurace: Chybí platný API klíč pro AI." };
    }
    if (!state.currentTopic && !prompt.includes("Vysvětli ZÁKLADY")) { // Разрешаем только первый запрос без темы
        console.error("[Gemini] No current topic set.");
        return { success: false, data: null, error: "Chyba: Není vybráno žádné téma." };
    }

    console.log(`[Gemini] Sending request (Chat Interaction: ${isChatInteraction}): "${prompt.substring(0, 80)}..."`);

    // Строим payload с использованием улучшенного системного промпта
    const finalPrompt = isChatInteraction ? _buildChatInteractionPrompt(prompt) : prompt;
    const contents = _buildGeminiPayloadContents(finalPrompt); // Эта функция содержит улучшенную инструкцию

    console.log("[Gemini] Payload Contents:", JSON.stringify(contents, null, 2)); // Логируем полный payload для отладки

    const body = {
        contents,
        generationConfig: GEMINI_GENERATION_CONFIG,
        safetySettings: GEMINI_SAFETY_SETTINGS
    };

    try {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const responseData = await response.json(); // Получаем JSON в любом случае для анализа

        if (!response.ok) {
            let errorText = `Chyba API (${response.status})`;
            errorText += `: ${responseData?.error?.message || 'Neznámá chyba API.'}`;
            console.error("[Gemini] API Error Response:", responseData);
            throw new Error(errorText);
        }

        console.log("[Gemini] Raw API Response:", JSON.stringify(responseData, null, 2)); // Логируем успешный ответ

        if (responseData.promptFeedback?.blockReason) {
            console.error("[Gemini] Request blocked:", responseData.promptFeedback);
            throw new Error(`Požadavek blokován: ${responseData.promptFeedback.blockReason}. Zkuste přeformulovat.`);
        }
        const candidate = responseData.candidates?.[0];
        if (!candidate) {
            console.error("[Gemini] No candidate found in response:", responseData);
            throw new Error('AI neposkytlo platnou odpověď (žádný kandidát).');
        }
        // Проверяем finishReason, но позволяем ответу пройти, если есть текст
        if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
            console.warn(`[Gemini] Potentially problematic FinishReason: ${candidate.finishReason}.`);
            if (candidate.finishReason === 'SAFETY') {
                throw new Error('Odpověď blokována bezpečnostním filtrem AI.');
            }
        }

        const rawText = candidate.content?.parts?.[0]?.text;

        // Если нет текста И причина завершения не STOP, это проблема
        if (!rawText && candidate.finishReason && candidate.finishReason !== 'STOP') {
             if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Odpověď AI byla příliš dlouhá (Max Tokens).');
             else throw new Error('AI vrátilo prázdnou odpověď (Důvod: ' + (candidate.finishReason || 'Neznámý') + ').');
        }
        // Если текста нет, но причина STOP (например, safety block внутри), вернем пустой результат
        if (!rawText) {
            console.warn("[Gemini] Response candidate has no text content, returning empty parsed data.");
             // Обновляем контекст, чтобы избежать повторения запроса
             state.geminiChatContext.push({ role: "user", parts: [{ text: finalPrompt }] });
             state.geminiChatContext.push({ role: "model", parts: [{ text: "" }] }); // Пустой ответ модели
             if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2 + 2) {
                 state.geminiChatContext.splice(2, state.geminiChatContext.length - (MAX_GEMINI_HISTORY_TURNS * 2 + 2));
             }
            return { success: true, data: { boardMarkdown: "", ttsCommentary: "", chatText: "(AI neposkytlo žádný textový obsah)" }, error: null };
        }


        // Обновляем контекст чата в state
        state.geminiChatContext.push({ role: "user", parts: [{ text: finalPrompt }] }); // Сохраняем финальный промпт
        state.geminiChatContext.push({ role: "model", parts: [{ text: rawText }] });
        // Обрезаем историю, если она слишком длинная (+2 для системных сообщений)
        if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2 + 2) {
            state.geminiChatContext.splice(2, state.geminiChatContext.length - (MAX_GEMINI_HISTORY_TURNS * 2 + 2));
        }

        // Парсим ответ и возвращаем его
        const parsedData = parseGeminiResponse(rawText);
        return { success: true, data: parsedData, error: null };

    } catch (error) {
        console.error('[Gemini] Chyba komunikace s Gemini:', error);
        return { success: false, data: null, error: error.message }; // Возвращаем ошибку
    }
}

console.log("Gemini service module loaded (v2 with improved prompt).");