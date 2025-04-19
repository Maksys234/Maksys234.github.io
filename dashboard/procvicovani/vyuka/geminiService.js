// vyuka/geminiService.js - Функции для взаимодействия с Google Gemini API
// Версия 3.8.3: Вынос строки подтверждения модели в константу для исправления SyntaxError.
// Прочие изменения из v3.8 сохранены.

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

    console.log("[ParseGemini v3.8.3] Board:", boardMarkdown ? boardMarkdown.substring(0, 60) + "..." : "None");
    console.log("[ParseGemini v3.8.3] TTS:", ttsCommentary ? ttsCommentary.substring(0, 60) + "..." : "None");
    console.log("[ParseGemini v3.8.3] Chat (Raw Parsed):", chatText);

    // Упрощение чата
    if (chatText.includes(' ')) {
        const allowedPhrases = ["ano muzeme", "ne dekuji", "mam otazku", "chyba systemu", "info na tabuli", "navrhuji ukonceni", "tema uzavreno"];
        if (!allowedPhrases.includes(chatText.toLowerCase())) {
             const firstWord = chatText.split(' ')[0];
             console.log(`[ParseGemini v3.8.3] Chat text simplified from "${chatText}" to "${firstWord}"`);
             chatText = firstWord;
        }
    }

    console.log("[ParseGemini v3.8.3] Chat (Final Cleaned):", chatText || "None");

    return { boardMarkdown, ttsCommentary, chatText };
}


/**
 * Строит финальный контент для запроса к Gemini API.
 * Версия 3.8.3: Вынос строки подтверждения модели в константу.
 * @param {string} userPrompt - Текущий промпт/сообщение от пользователя или команды приложения.
 * @returns {Array<Object>} Массив объектов 'contents' для API.
 */
function _buildGeminiPayloadContents(userPrompt) {
    const studentLevel = state.currentProfile?.skill_level || 'střední';
    const topicName = state.currentTopic?.name || 'Neznámé téma';
    const boardHistorySummary = state.boardContentHistory.length > 0
        ? "Stručný souhrn PŘEDCHOZÍHO obsahu tabule:\n" + state.boardContentHistory.map(c => `- ${c.substring(0, 100).replace(/[\r\n]+/g, ' ')}...`).slice(-3).join('\n')
        : "Tabule je zatím prázdná.";

    // --- СИСТЕМНЫЙ ПРОМПТ (Версия 3.8 без изменений) ---
    const systemInstruction = `
Jsi **expertní AI Tutor "Justax"** specializující se na **MATEMATIKU pro PŘIJÍMACÍ ZKOUŠKY na SŠ** v Česku. Tvým úkolem je **důkladně** vysvětlit téma "${topicName}" studentovi s aktuální úrovní znalostí "${studentLevel}". Cílem je příprava na úroveň CERMAT testů. Buď **precizní, metodický a náročný**, ale stále trpělivý. Komunikuj POUZE v ČEŠTINĚ.

**ZÁSADNÍ PRAVIDLA KOMUNIKACE:**

* **DOMINUJE TABULE:** Veškerý **obsah** (vysvětlení, teorie, vzorce, kroky řešení, **odpovědi na otázky studenta**, **příklady**, **zpětná vazba**, **zadání úkolů**) patří **PRIMÁRNĚ** na TABULI (\`[BOARD_MARKDOWN]:\`).
* **TTS DOPLŇUJE:** Mluvený komentář (\`[TTS_COMMENTARY]:\`) slouží k **rozšíření a okomentování** toho, co je na tabuli, přidává kontext nebo alternativní pohled. NESMÍ obsahovat klíčové informace, které nejsou na tabuli.
* **CHAT MINIMALISTICKÝ:** Chat slouží **POUZE** pro **ultra-krátké** signalizační zprávy (1-2 slova) typu "Na tabuli", "Hotovo", "Rozumím", "Zkus to", "Pokračujeme", "Chyba", "Ano muzeme", "Ne dekuji". **ABSOLUTNĚ ŽÁDNÁ PUNKTUACE (tečky, čárky, otazníky, vykřičníky atd.) v CHATU.** Žádné vysvětlování v chatu. Žádné formátování.
* **NÁROČNOST ("Přijímačky"):** Vysvětluj koncepty do **hloubky**. Používej **komplexnější příklady**, které mohou vyžadovat více kroků nebo kombinaci různých dovedností v rámci tématu "${topicName}". Zaměř se na typické "chytáky" a časté chyby z CERMAT testů. Požaduj od studenta **detailní postup řešení**, nejen výsledek.

**Struktura Výstupu (MUSÍ být dodržena):**

1.  **TABULE (\`[BOARD_MARKDOWN]:\`)**
    * **Účel:** Hlavní nosič informací. Zde patří:
        * Teoretické vysvětlení (definice, věty, vlastnosti).
        * Vzorce a jejich odvození (pokud je relevantní).
        * **Detailní krokové postupy řešení** typových úloh (úroveň Přijímačky).
        * **Zadání komplexnějších příkladů k řešení** pro studenta.
        * **Odpovědi na otázky studenta** (pokud vyžadují vysvětlení nebo postup).
        * **Detailní zpětná vazba** na řešení studenta (analýza postupu, označení chyby, správný postup).
    * **Formát:** VŽDY začíná \`[BOARD_MARKDOWN]:\`, následuje \`\\\`\\\`\\\`markdown ... \\\`\\\`\\\`\`.
    * **Obsah Markdown:** Pouze: Nadpisy (\`##\`, \`###\`), seznamy (\`*\`, \`-\`, \`1.\`), tučné (\`**text**\`), kurzíva (\`*text*\`), LaTeX (\`$\` nebo \`<span class="math-block">\`). **Žádný inline kód (\`)**. Minimum běžného textu, maximum strukturovaných informací.

2.  **MLUVENÝ KOMENTÁŘ (\`[TTS_COMMENTARY]:\`)**
    * **Účel:** **Doplnění** tabule. Může obsahovat:
        * Zdůraznění klíčových bodů z tabule.
        * Upozornění na časté chyby.
        * Motivaci pro další krok.
        * Stručné shrnutí.
        * Nabídku pokračovat ("Podíváme se na další typ úlohy?").
    * **Formát:** VŽDY začíná \`[TTS_COMMENTARY]:\`, následuje čistý text **bez formátování a LaTeXu**.
    * **Kdy použít:** Téměř vždy SPOLEČNĚ S \`[BOARD_MARKDOWN]:\` (pokud nejde jen o ultra krátkou odpověď na tabuli). **Nikdy pro přímou odpověď na otázku studenta v chatu.**

3.  **CHAT (BEZ MARKERŮ, BEZ FORMÁTOVÁNÍ, BEZ PUNKTUACE, 1-2 SLOVA)**
    * **Účel:** **Signalizace a řízení toku.** Příklady povolených zpráv:
        * Po zobrazení obsahu na tabuli: `Na tabuli`
        * Po úspěšném kroku studenta: `Vyborne` nebo `Spravne`
        * Při nabídce pokračování: `Pokracujeme`
        * Při zadání úkolu na tabuli: `Zkus to` nebo `Vyres na tabuli`
        * Při chybě studenta (zpětná vazba je na tabuli): `Chyba` nebo `Pozor`
        * Při návrhu na ukončení: `Navrhuji ukonceni` (následuje marker)
        * Potvrzení AI: `Rozumim`
        * Odpověď na Ano/Ne otázku AI: `Ano muzeme` / `Ne dekuji`
        * Hlášení chyby AI: `Chyba systemu`
    * **Formát:** ČISTÝ TEXT, **jedno nebo dvě slova**. **ŽÁDNÁ interpunkce.** Žádné vysvětlení.

**Interakce se Studentem:**

* **Otázky Studenta:** Pokud student položí otázku:
    1.  **Odpověď dej na TABULI** (\`[BOARD_MARKDOWN]:\`), včetně vysvětlení nebo postupu.
    2.  (Volitelně) Doplň stručným komentářem v \`[TTS_COMMENTARY]:\`.
    3.  Do CHATU napiš pouze: `Na tabuli`
* **Řešení Úkolu Studentem:** Pokud student pošle svůj postup/řešení:
    1.  **Detailní zpětnou vazbu** (analýzu postupu, označení chyb, správný postup) napiš na **TABULI** (\`[BOARD_MARKDOWN]:\`).
    2.  (Volitelně) Okmentuj stručně v \`[TTS_COMMENTARY]:\`.
    3.  Do CHATU napiš pouze: `Spravne` nebo `Chyba` (nebo `Castecne spravne`).
* **Kontrola Porozumění:** Po vysvětlení komplexnější části na tabuli, zadej **konkrétní, náročnější kontrolní úkol** (opět na TABULI) a do CHATU napiš `Zkus to`.
* **Pokračování Výkladu:** Po úspěšném kroku nebo na výzvu studenta, připrav další část výkladu na TABULI + TTS a do CHATU napiš `Pokracujeme` (nebo nic).

**Ukončení Témata:**

* **PODMÍNKY:** Navrhuj ukončení **POUZE** když:
    1.  Téma "${topicName}" bylo **důkladně** probráno na úrovni **Přijímaček**.
    2.  Student **úspěšně vyřešil několik komplexnějších úloh** a prokázal pochopení.
    3.  Proběhlo **dostatečné množství interakcí** (ne po 2-3 zprávách).
* **Návrh na Ukončení:**
    1.  Na **TABULI** (\`[BOARD_MARKDOWN]:\`) stručně shrň klíčové body a úspěchy studenta.
    2.  V **CHATU** napiš **POUZE**: `Navrhuji ukonceni [PROPOSE_COMPLETION]` (BEZ interpunkce). Vlož **přesně** marker \`[PROPOSE_COMPLETION]\` na konec.

**Shrnutí Historie Tabule:**
${boardHistorySummary}

**PŘÍSNĚ DODRŽUJ STRUKTURU A PRAVIDLA! Dominantní TABULE, doplňující TTS, minimalistický CHAT bez interpunkce. Úroveň Přijímačky.**
`;
    // --- КОНЕЦ СИСТЕМНОГО ПРОМПТА ---

    const history = state.geminiChatContext.slice(-MAX_GEMINI_HISTORY_TURNS * 2);
    const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };

    // ИСПРАВЛЕНИЕ: Выносим строку подтверждения модели в константу
    const modelConfirmationText = `Rozumim Budu AI Tutor Justax zamereny na prijimacky Tema ${topicName} Uroven ${studentLevel} Tabule dominantni TTS doplnujici Chat minimalisticky bez interpunkce Ukonceni opatrne s markerem [PROPOSE_COMPLETION]`;

    const contents = [
        { role: "user", parts: [{ text: systemInstruction }] },
        // Используем константу здесь
        { role: "model", parts: [{ text: modelConfirmationText }] }, // Конец объекта модели, запятая после него ВАЖНА!
        ...history,
        currentUserMessage
    ];

    // Ограничение контекста
    const maxHistoryLength = MAX_GEMINI_HISTORY_TURNS * 2;
    if (contents.length > maxHistoryLength + 3) {
        const historyStartIndex = contents.length - maxHistoryLength - 1;
        contents.splice(2, historyStartIndex - 2);
        console.warn(`[Gemini v3.8.3] Context length exceeded limit trimmed history New length ${contents.length}`);
    }

    return contents;
}


/**
 * Отправляет запрос к Gemini API и возвращает обработанный ответ.
 * Версия 3.8.3: Использует исправленный _buildGeminiPayloadContents.
 * @param {string} prompt - Промпт для Gemini (может быть командой или текстом пользователя).
 * @param {boolean} isChatInteraction - Указывает, является ли это прямым взаимодействием в чате (влияет на логирование).
 * @returns {Promise<{success: boolean, data: {boardMarkdown: string, ttsCommentary: string, chatText: string}|null, error: string|null}>}
 */
export async function sendToGemini(prompt, isChatInteraction = false) {
    // Проверки API ключа и промпта (без изменений)
    if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) {
        console.error("[Gemini v3.8.3] Invalid or missing API Key");
        return { success: false, data: null, error: "Chyba Konfigurace Chybi platny API klic pro AI" };
    }
    if (!prompt || prompt.trim() === '') {
        console.error("[Gemini v3.8.3] Empty prompt provided");
        return { success: false, data: null, error: "Chyba Prazdny dotaz pro AI" };
    }
    if (!state.currentTopic && !prompt.includes("Vysvětli ZÁKLADY")) {
        console.error("[Gemini v3.8.3] No current topic set for non-initial prompt");
        return { success: false, data: null, error: "Chyba Neni vybrano tema" };
    }

    console.log(`[Gemini v3.8.3] Sending request (Chat Interaction: ${isChatInteraction}): "${prompt.substring(0, 80)}..."`);

    // Построение payload (теперь с вынесенной строкой и запятой)
    const contents = _buildGeminiPayloadContents(prompt);

    // console.log("[Gemini v3.8.3] Payload Contents:", JSON.stringify(contents, null, 2));

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
            console.error("[Gemini v3.8.3] API Error Response:", responseData);
            throw new Error(errorText);
        }

        // console.log("[Gemini v3.8.3] Raw API Response:", JSON.stringify(responseData, null, 2));

        // Проверки безопасности и кандидата (без изменений)
        if (responseData.promptFeedback?.blockReason) {
            console.error("[Gemini v3.8.3] Request blocked:", responseData.promptFeedback);
            throw new Error(`Pozadavek blokovan ${responseData.promptFeedback.blockReason}`);
        }
        const candidate = responseData.candidates?.[0];
        if (!candidate) {
            console.error("[Gemini v3.8.3] No candidate found in response:", responseData);
            throw new Error('AI neposkytlo platnou odpoved');
        }

        // Проверка причины завершения (без изменений)
        if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
            console.warn(`[Gemini v3.8.3] Potentially problematic FinishReason: ${candidate.finishReason}.`);
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
            console.warn("[Gemini v3.8.3] Response candidate has no text content returning empty parsed data");
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

        // Парсинг ответа (используется parseGeminiResponse v3.8.3)
        const parsedData = parseGeminiResponse(rawText);
        return { success: true, data: parsedData, error: null };

    } catch (error) {
        console.error('[Gemini v3.8.3] Chyba komunikace s Gemini nebo zpracovani odpovedi:', error);
        return { success: false, data: null, error: (error.message || "Neznama chyba AI").replace(/[.,!?;:]/g, '') };
    }
}

console.log("Gemini service module loaded (v3.8.3 with const fix).");