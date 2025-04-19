// geminiService.js - Функции для взаимодействия с Google Gemini API (Версия 3.4.1 - Исправление синтаксиса)

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
            if (contentEnd === -1 || contentEnd < boardStart) contentEnd = rawText.length; // Исправлено: ищем ttsMarker *после* boardStart
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
        // Исправлено: убедимся, что nextBoardStart действительно *после* ttsStart
        if (nextBoardStart !== -1 && nextBoardStart > ttsStart) {
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
         if (boardEndIndex !== -1) {
             // Ищем закрывающий ``` после открывающего
             let closingTagIndex = rawText.indexOf("```", boardEndIndex + 3);
             if (closingTagIndex !== -1) {
                 boardEndIndex = closingTagIndex + 3;
             } else {
                 // Если нет закрывающего, считаем концом блока конец markdown-контента
                 boardEndIndex = boardStart + boardMarker.length + boardMarkdown.length;
                 console.warn("parseGeminiResponse: Closing ``` not found for board, estimated end index.");
             }
         } else {
              // Если не было ``` вообще, конец блока - это конец markdown-контента
             boardEndIndex = boardStart + boardMarker.length + boardMarkdown.length;
         }
        markers.push({ start: boardStart, end: Math.max(boardStart + boardMarker.length, boardEndIndex) });
    }
    if (ttsStart !== -1) {
         // Определяем конец TTS более надежно
         let ttsEndIndex = ttsStart + ttsMarker.length + ttsCommentary.length;
         const nextBoardAfterTts = rawText.indexOf(boardMarker, ttsStart + ttsMarker.length);
         if(nextBoardAfterTts !== -1 && nextBoardAfterTts > ttsStart) {
             // Если есть [BOARD_MARKDOWN] после [TTS_COMMENTARY], TTS заканчивается перед ним
             ttsEndIndex = nextBoardAfterTts;
         } else {
             // Иначе TTS идет до конца строки (или до конца найденного ttsCommentary)
             ttsEndIndex = ttsStart + ttsMarker.length + ttsCommentary.length;
         }
         markers.push({ start: ttsStart, end: ttsEndIndex });
    }
    markers.sort((a, b) => a.start - b.start);

    markers.forEach(marker => {
        if (marker.start > lastIndex) {
            chatSegments.push(rawText.substring(lastIndex, marker.start));
        }
        lastIndex = Math.max(lastIndex, marker.end); // Используем Math.max для предотвращения отката индекса
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

    console.log("[ParseGemini V2.1] Board:", boardMarkdown ? boardMarkdown.substring(0, 60) + "..." : "None");
    console.log("[ParseGemini V2.1] TTS:", ttsCommentary ? ttsCommentary.substring(0, 60) + "..." : "None");
    console.log("[ParseGemini V2.1] Chat:", chatText ? chatText.substring(0, 60) + "..." : "None");

    return { boardMarkdown, ttsCommentary, chatText };
}


// --- Функции для создания промптов (вспомогательные) ---

function _buildInitialPrompt() {
    return `Vysvětli ZÁKLADY tématu "${state.currentTopic?.name}". Začni PRVNÍ částí.`;
}
function _buildContinuePrompt() {
    return `Pokračuj ve vysvětlování tématu "${state.currentTopic?.name}". Naváž na předchozí část.`;
}
function _buildChatInteractionPrompt(userText) {
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

    // --- УЛУЧШЕННЫЙ СИСТЕМНЫЙ ПРОМПТ (v2.1) ---
    const systemInstruction = `
Jsi expertní, přátelský a trpělivý AI Tutor "Justax". Tvým cílem je efektivně vysvětlit téma "${topicName}" studentovi 9. třídy ZŠ v Česku s aktuální úrovní znalostí "${level}". Komunikuj POUZE v ČEŠTINĚ.

Tvůj výstup MUSÍ být strukturován pomocí JEDNOHO nebo VÍCE z následujících kanálů/formátů, v závislosti na kontextu. **NIKDY nekombinuj obsah určený pro různé kanály v jednom bloku.**

1.  **TABULE (\`[BOARD_MARKDOWN]:\`)**
    * **Účel:** VIZUÁLNÍ prezentace klíčových, strukturovaných informací (definice, vzorce, KROKY ŘEŠENÍ, diagramy, tabulky). Obsah musí být jasný a přehledný na první pohled.
    * **Formát:** VŽDY začíná markerem \`[BOARD_MARKDOWN]:\` na samostatném řádku, následovaným blokem kódu \`\`\`markdown ... \`\`\` na dalších řádcích.
    * **Obsah Markdown:**
        * Používej POUZE: Nadpisy (\`##\`, \`###\`), seznamy (\`*\`, \`-\`, \`1.\`), tučné písmo (\`**text**\`), kurzívu (\`*text*\`), inline kód (\``kód`\`) pro zvýraznění, LaTeX pro vzorce (\`$ ... $\` pro inline, \`$$...$$\` pro blokové).
        * Text musí být **STRUČNÝ**, faktický, zaměřený na klíčové body. ŽÁDNÉ dlouhé odstavce.
        * **ZDE NEPATŘÍ:** Konverzační styl, uvítací fráze, otázky studentovi, vysvětlení "proč" (to patří do TTS).
    * **Kdy použít:** POVINNĚ při *zahájení* výkladu (první krok) a při *pokračování* výkladu (další kroky). Také POUZE tehdy, když student VÝSLOVNĚ požádá o zobrazení něčeho na tabuli (např. "ukaž postup na tabuli", "napiš rovnici na tabuli").

2.  **MLUVENÝ KOMENTÁŘ (\`[TTS_COMMENTARY]:\`)**
    * **Účel:** PODROBNĚJŠÍ, **konverzační** vysvětlení obsahu zobrazeného na TABULI, poskytnutí KONTEXTU, motivace, vysvětlení "proč" daný krok děláme.
    * **Formát:** VŽDY začíná markerem \`[TTS_COMMENTARY]:\` na samostatném řádku, následovaným **čistým textem** (bez Markdown a LaTeXu).
    * **Obsah:**
        * Vysvětluj koncepty srozumitelně, přizpůsobeno úrovni "${level}". Rozveď stručné body z tabule.
        * Můžeš použít řečnické otázky nebo **jednoduché** kontrolní otázky na konci ("Rozumíš tomu?", "Je tento krok jasný?", "Můžeme pokračovat?").
        * **ZDE NEPATŘÍ:** Komplexní otázky vyžadující výpočet nebo podrobnou odpověď studenta, složité vzorce (ty patří na tabuli), dlouhé seznamy kroků (ty patří na tabuli).
    * **Kdy použít:** VŽDY **SPOLEČNĚ S** \`[BOARD_MARKDOWN]:\` při *zahájení* a *pokračování* výkladu. NIKDY samostatně. NIKDY v reakci na zprávu studenta v chatu.

3.  **CHAT (Čistý text - BEZ MARKERŮ)**
    * **Účel:** Přímá **interakce** se studentem: odpovídání na jeho otázky, KONTROLA a HODNOCENÍ jeho odpovědí, pokládání **KONKRÉTNÍCH otázek** k zamyšlení nebo procvičení, krátká zpětná vazba, přechodové fráze ("Dobře, teď se podíváme na...").
    * **Formát:** POUZE čistý text. **ŽÁDNÉ** markery \`[BOARD_MARKDOWN]:\`, \`[TTS_COMMENTARY]:\`, žádné bloky \`\`\`markdown\`. Žádný LaTeX (vzorce v chatu piš slovně nebo velmi jednoduše).
    * **Obsah:**
        * Udržuj přátelský, podporující a konverzační tón.
        * Odpovídej relevantně k tématu "${topicName}" a kontextu diskuze.
        * MŮŽEŠ POKLÁDAT **konkrétní otázky** vyžadující odpověď studenta (např. "Jaký bude další krok?", "Zkus vypočítat hodnotu x v rovnici 2x = 10.", "Co si myslíš o tomto postupu?").
        * Pokud hodnotíš odpověď studenta, buď KONSTRUKTIVNÍ. Pokud je špatně, jasně vysvětli proč.
        * **DŮLEŽITÉ:** Vyhni se zakončení odpovědi POUZE otazníkem (\`?\`). Místo toho polož jasnou otázku nebo použij frázi jako "Můžeme pokračovat?".
    * **Kdy použít:** VŽDY v reakci na zprávu studenta v chatu (POKUD student explicitně nepožádal o zobrazení na tabuli). MŮŽE následovat po bloku TABULE+TTS, pokud chceš v chatu položit **doplňující otázku** k právě vysvětlenému obsahu.

**SPECIÁLNÍ PŘÍPADY:**

* **Student žádá o zobrazení na tabuli:** Pokud student napíše "ukaž na tabuli", "napiš postup", "jak vypadá vzorec", pak:
    1.  Použij `[BOARD_MARKDOWN]:` \`\`\`markdown ... \`\`\` pro zobrazení **POUZE** požadovaného vizuálního obsahu (rovnice, kroky, vzorec).
    2.  Do CHATU napiš POUZE **KRÁTKOU** potvrzovací zprávu, např. "Jasně, tady je to na tabuli:" nebo "Dobře, postup je teď na tabuli.". **NEopakuj obsah tabule v chatu.**
* **Studentova odpověď na tvou otázku:** Vyhodnoť jeho odpověď v CHATU (čistým textem). Poté buď polož další otázku v CHATU, nebo navrhni pokračování výkladu (což spustí další kolo s TABULÍ+TTS).

**PŘÍSNĚ DODRŽUJ STRUKTURU A PRAVIDLA!** Každý kanál má svůj účel a formát. Jasně odděluj vizuální prezentaci (tabule), mluvené vysvětlení (TTS) a interaktivní diskuzi (chat).
`;
    // --- КОНЕЦ УЛУЧШЕННОГО ПРОМПТА ---

    // Берем последние N*2 сообщений (вопрос-ответ) + 2 системных
    const history = state.geminiChatContext.slice(-MAX_GEMINI_HISTORY_TURNS * 2);
    const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };

     // Структура: Системные инструкции -> Подтверждение Модели -> История -> Текущий Запрос
     // Исправлено: Убрана возможная синтаксическая ошибка, упрощен ответ модели
     const contents = [
         { role: "user", parts: [{ text: systemInstruction }] },
         { role: "model", parts: [{ text: `Rozumím. Jsem připraven vysvětlovat téma "${topicName}" pro úroveň "${level}" a budu striktně dodržovat pravidla pro tabuli, komentář a chat.` }] },
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
    // Разрешаем первый запрос (startLearningSession) даже без currentTopic
    if (!state.currentTopic && !prompt.includes("Vysvětli ZÁKLADY")) {
        console.error("[Gemini] No current topic set for non-initial prompt.");
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

        // Проверка блокировки и кандидата
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
            // Допускаем другие причины, если текст есть
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

        // Обновляем контекст чата в state (даже если парсинг не удастся)
        state.geminiChatContext.push({ role: "user", parts: [{ text: finalPrompt }] });
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
        // Не обновляем контекст при ошибке сети/API
        return { success: false, data: null, error: error.message }; // Возвращаем ошибку
    }
}

console.log("Gemini service module loaded (v2.1 with improved prompt & syntax fix)."); // Updated log message