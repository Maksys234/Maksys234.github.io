// vyuka/geminiService.js - Функции для взаимодействия с Google Gemini API
// Версия 3.9.2: Opraveno čištění chatu pro odstranění samotných ```, vylepšena detekce konce boardMarkdown.

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
    const boardMarker = "[BOARD_MARKDOWN]:";
    const ttsMarker = "[TTS_COMMENTARY]:";
    let boardMarkdown = "";
    let ttsCommentary = "";
    let chatText = "";

    // --- Логика парсинга (vylepšená detekce konce a čištění chatu) ---
    const boardStart = rawText.indexOf(boardMarker);
    let boardEndIndex = -1; // Index konce celého [BOARD_MARKDOWN]: bloku (včetně ```)
    if (boardStart !== -1) {
        let blockContentStart = boardStart + boardMarker.length;
        // Najdi začátek bloku kódu (s markdown nebo bez)
        let codeBlockStartTagMatch = rawText.substring(blockContentStart).match(/^\s*```(markdown)?/);
        if (codeBlockStartTagMatch) {
            blockContentStart += codeBlockStartTagMatch[0].length; // Posunout za značku bloku kódu
            let blockEndMatch = rawText.indexOf("```", blockContentStart);
            if (blockEndMatch !== -1) {
                boardMarkdown = rawText.substring(blockContentStart, blockEndMatch).trim();
                boardEndIndex = blockEndMatch + 3; // Konec je za značkou ```
            } else {
                // Pokud není uzavírací značka, bereme vše do dalšího markeru nebo konce
                let potentialEnd = rawText.indexOf(ttsMarker, blockContentStart);
                if (potentialEnd === -1 || potentialEnd < blockContentStart) potentialEnd = rawText.length;
                boardMarkdown = rawText.substring(blockContentStart, potentialEnd).trim();
                boardEndIndex = potentialEnd; // Konec je před dalším markerem nebo na konci
                console.warn("parseGeminiResponse: Chybí uzavírací ``` pro blok tabule.");
            }
        } else {
            // Pokud blok kódu nenalezen, bereme vše do dalšího markeru nebo konce
            let potentialEnd = rawText.indexOf(ttsMarker, blockContentStart);
            if (potentialEnd === -1 || potentialEnd < blockContentStart) potentialEnd = rawText.length;
            boardMarkdown = rawText.substring(blockContentStart, potentialEnd).trim();
            boardEndIndex = potentialEnd; // Konec je před dalším markerem nebo na konci
            console.warn("parseGeminiResponse: Blok kódu ``` nenalezen za [BOARD_MARKDOWN]:");
        }
    } else {
         // Pokud není boardMarker, pro účely další logiky považujeme konec za začátek
         boardEndIndex = 0;
    }

    const ttsStart = rawText.indexOf(ttsMarker);
    let ttsEndIndex = -1; // Index konce celého [TTS_COMMENTARY]: bloku
    if (ttsStart !== -1) {
        let commentaryStart = ttsStart + ttsMarker.length;
        let potentialEnd = rawText.length;
        // Hledáme další [BOARD_MARKDOWN]: *až po* aktuálním [TTS_COMMENTARY]:
        const nextBoardStart = rawText.indexOf(boardMarker, commentaryStart);
        if (nextBoardStart !== -1 && nextBoardStart > ttsStart) {
            potentialEnd = nextBoardStart;
        }
        ttsCommentary = rawText.substring(commentaryStart, potentialEnd).trim();
        ttsEndIndex = potentialEnd; // Konec je před dalším markerem nebo na konci
    } else {
         // Pokud není TTS marker, pro účely další logiky použijeme konec boardu
         ttsEndIndex = boardEndIndex > 0 ? boardEndIndex : 0;
    }

    // Extrakce chatu: vše, co není součástí boardu nebo tts
    let remainingText = '';
    // Seřadíme nalezené bloky podle jejich počátečního indexu
    const blocks = [];
    if (boardStart !== -1) blocks.push({ start: boardStart, end: boardEndIndex });
    if (ttsStart !== -1) blocks.push({ start: ttsStart, end: ttsEndIndex });
    blocks.sort((a, b) => a.start - b.start);

    let lastIndexProcessed = 0;
    blocks.forEach(block => {
        if (block.start > lastIndexProcessed) {
            remainingText += rawText.substring(lastIndexProcessed, block.start);
        }
        lastIndexProcessed = Math.max(lastIndexProcessed, block.end);
    });
    // Přidáme zbytek textu po posledním bloku
    if (lastIndexProcessed < rawText.length) {
        remainingText += rawText.substring(lastIndexProcessed);
    }

    // Finální čištění chatu
    chatText = remainingText
        .replace(boardMarker, '') // Odstranit markery, pokud nějak zbyly
        .replace(ttsMarker, '')
        .replace(/```(markdown)?/g, '') // Odstranit ```markdown nebo ```
        .replace(/`+/g, '') // <<< ODSTRANIT VŠECHNY ZPĚTNÉ APOSTROFY
        .replace(/[.,!?;:]/g, '') // Odstranit interpunkci
        .replace(/\$/g, '')      // Odstranit dolar
        .trim();

    console.log("[ParseGemini v3.9.2] Board:", boardMarkdown ? boardMarkdown.substring(0, 60) + "..." : "None");
    console.log("[ParseGemini v3.9.2] TTS:", ttsCommentary ? ttsCommentary.substring(0, 60) + "..." : "None");
    console.log("[ParseGemini v3.9.2] Chat (Raw Parsed):", chatText);

    // Zjednodušení na 1-2 slova zůstává, ale kontrolujeme proti aktualizovanému seznamu
    if (chatText.includes(' ')) {
        const allowedPhrases = ["ano muzeme", "ne dekuji", "mam otazku", "chyba systemu", "info na tabuli", "navrhuji ukonceni", "tema uzavreno", "na tabuli", "tema zahajeno", "pokracujeme", "spravne", "zkus to"];
        const lowerChat = chatText.toLowerCase();
        if (!allowedPhrases.some(phrase => lowerChat.startsWith(phrase))) { // Zkontroluje, zda začíná povolenou frází
             const firstWord = chatText.split(' ')[0];
             console.log(`[ParseGemini v3.9.2] Chat text simplified from "${chatText}" to "${firstWord}"`);
             chatText = firstWord;
        }
    }

    console.log("[ParseGemini v3.9.2] Chat (Final Cleaned):", chatText || "None");

    return { boardMarkdown, ttsCommentary, chatText };
}


/**
 * Строит финальный контент для запроса к Gemini API.
 * Версия 3.9.2: Používá stejný prompt jako 3.8.8.
 * @param {string} userPrompt - Текущий промпт/сообщение от пользователя или команды приложения.
 * @returns {Array<Object>} Массив объектов 'contents' для API.
 */
function _buildGeminiPayloadContents(userPrompt) {
    const studentLevel = state.currentProfile?.skill_level || 'střední';
    const topicName = state.currentTopic?.name || 'Neznámé téma';
    const boardHistorySummary = state.boardContentHistory.length > 0
        ? "Stručný souhrn PŘEDCHOZÍHO obsahu tabule:\n" + state.boardContentHistory.map(c => `- ${c.substring(0, 100).replace(/[\r\n]+/g, ' ')}...`).slice(-3).join('\n')
        : "Tabule je zatím prázdná.";

    // --- СИСТЕМНЫЙ ПРОМПТ (Версия 3.8.8/3.9.2) ---
    let systemInstructionParts = [];
    systemInstructionParts.push(`Jsi **expertní AI Tutor "Justax"** specializující se na **MATEMATIKU pro PŘIJÍMACÍ ZKOUŠKY na SŠ** v Česku.`);
    systemInstructionParts.push(`Tvým úkolem je **důkladně** vysvětlit téma "${topicName}" studentovi s aktuální úrovní znalostí "${studentLevel}".`);
    systemInstructionParts.push(`Cílem je příprava na úroveň CERMAT testů. Buď **precizní, metodický a náročný**, ale stále trpělivý. Komunikuj POUZE v ČEŠTINĚ.`);

    systemInstructionParts.push(`\n**ZÁSADNÍ PRAVIDLA KOMUNIKACE:**\n`);
    systemInstructionParts.push(`* **DOMINUJE TABULE:** Veškerý **obsah** (vysvětlení, teorie, vzorce, kroky řešení, **odpovědi na otázky studenta**, **příklady**, **zpětná vazba**, **zadání úkolů**) patří **PRIMÁRNĚ** na TABULI (\`[BOARD_MARKDOWN]:\`).`);
    systemInstructionParts.push(`* **TTS DOPLŇUJE:** Mluvený komentář (\`[TTS_COMMENTARY]:\`) slouží k **rozšíření a okomentování** toho, co je na tabuli, přidává kontext nebo alternativní pohled. NESMÍ obsahovat klíčové informace, které nejsou na tabuli.`);
    systemInstructionParts.push(`* **CHAT MINIMALISTICKÝ:** Chat slouží **POUZE** pro **ultra-krátké** signalizační zprávy (1-2 slova) typu "Na tabuli", "Hotovo", "Rozumím", "Zkus to", "Pokračujeme", "Chyba", "Ano muzeme", "Ne dekuji". **ABSOLUTNĚ ŽÁDNÁ PUNKTUACE (tečky, čárky, otazníky, vykřičníky atd.) v CHATU.** Žádné vysvětlování v chatu. Žádné formátování. **NIKDY NEPOUŽÍVEJ symbol dolaru ($) ani zpětné apostrofy (\`) v CHATU.**`);
    systemInstructionParts.push(`* **NÁROČNOST ("Přijímačky"):** Vysvětluj koncepty do **hloubky**. Používej **komplexnější příklady**, které mohou vyžadovat více kroků nebo kombinaci různých dovedností v rámci tématu "${topicName}". Zaměř se na typické "chytáky" a časté chyby z CERMAT testů. Požaduj od studenta **detailní postup řešení**, nejen výsledek.`);

    systemInstructionParts.push(`\n**Struktura Výstupu (MUSÍ být dodržena):**\n`);
    systemInstructionParts.push(`1.  **TABULE (\`[BOARD_MARKDOWN]:\`)**`);
    systemInstructionParts.push(`    * **Účel:** Hlavní nosič informací. Obsahuje VŠECHNY matematické zápisy, teorii, kroky řešení, příklady, zadání úkolů, zpětnou vazbu.`);
    systemInstructionParts.push(`    * **Formát:** VŽDY začíná \`[BOARD_MARKDOWN]:\`, následuje \`\
        \`\`markdown ... \`\`\`\`.`);
    systemInstructionParts.push(`    * **Obsah Markdown:** Pouze: Nadpisy (\`##\`, \`###\`), seznamy (\`*\`, \`-\`, \`1.\`), tučné (\`**text**\`), kurzíva (\`*text*\`), LaTeX (\`$\` nebo \`<span class="math-block">\`). **Žádný inline kód (\
        \`)**. Tabulky povoleny.`);

    systemInstructionParts.push(`2.  **MLUVENÝ KOMENTÁŘ (\`[TTS_COMMENTARY]:\`)**`);
    systemInstructionParts.push(`    * **Účel:** **Doplnění** tabule. Přidává kontext, vysvětluje myšlenkové pochody, alternativní pohledy, povzbuzení. NESMÍ obsahovat info, které není na tabuli.`);
    systemInstructionParts.push(`    * **Formát:** VŽDY začíná \`[TTS_COMMENTARY]:\`, následuje čistý text **bez formátování a LaTeXu**. `);
    systemInstructionParts.push(`    * **Kdy použít:** Téměř vždy SPOLEČNĚ S \`[BOARD_MARKDOWN]:\` pro hlavní výklad, odpovědi na otázky nebo komplexní zpětnou vazbu. Může chybět u jednoduché signalizace.`);

    systemInstructionParts.push(`3.  **CHAT (BEZ MARKERŮ, BEZ FORMÁTOVÁNÍ, BEZ PUNKTUACE, BEZ $, BEZ \`, 1-2 SLOVA)**`);
    systemInstructionParts.push(`    * **Účel:** **Signalizace a řízení toku.** Příklady povolených zpráv: \`Na tabuli\`, \`Hotovo\`, \`Rozumím\`, \`Zkus to\`, \`Pokracujeme\`, \`Chyba\`, \`Ano muzeme\`, \`Ne dekuji\`.`);
    systemInstructionParts.push(`    * **Formát:** ČISTÝ TEXT, **jedno nebo dvě slova**. **ŽÁDNÁ interpunkce.** **ŽÁDNÝ symbol dolaru.** ŽÁDNÉ zpětné apostrofy. Žádné vysvětlení.`);

    systemInstructionParts.push(`\n**Interakce se Studentem:**\n`);
    systemInstructionParts.push(`* **Otázky Studenta:** 1. **Odpověď dej na TABULI** (\`[BOARD_MARKDOWN]:\`). 2. (Volitelně) Doplň stručně v \`[TTS_COMMENTARY]:\`. 3. Do CHATU napiš pouze: \`Na tabuli\`.`);
    systemInstructionParts.push(`* **Řešení Úkolu Studentem:** 1. **Detailní zpětnou vazbu** na **TABULI** (\`[BOARD_MARKDOWN]:\`). 2. (Volitelně) Okmentuj stručně v \`[TTS_COMMENTARY]:\`. 3. Do CHATU napiš pouze: \`Spravne\` nebo \`Chyba\`.`);
    systemInstructionParts.push(`* **Kontrola Porozumění:** Po vysvětlení na tabuli, zadej **náročnější kontrolní úkol** na **TABULI** a do CHATU napiš \`Zkus to\`.`);
    systemInstructionParts.push(`* **Pokračování Výkladu:** Po úspěšném kroku/výzvě, připrav další část na TABULI + TTS a do CHATU napiš \`Pokracujeme\`.`);

    systemInstructionParts.push(`\n**Ukončení Témata:**\n`);
    systemInstructionParts.push(`* **PODMÍNKY:** Navrhuj ukončení **POUZE** když: 1. Téma "${topicName}" bylo **důkladně** probráno na úrovni **Přijímaček**. 2. Student **úspěšně vyřešil několik komplexnějších úloh**. 3. Proběhlo **dostatečné množství interakcí**. `);
    systemInstructionParts.push(`* **Návrh na Ukončení:** 1. Na **TABULI** (\`[BOARD_MARKDOWN]:\`) stručně shrň. 2. V **CHATU** napiš **POUZE**: \`Navrhuji ukonceni [PROPOSE_COMPLETION]\`. Vlož **přesně** marker \`[PROPOSE_COMPLETION]\` na konec.`);

    systemInstructionParts.push(`\n**Shrnutí Historie Tabule:**\n${boardHistorySummary}\n`);
    systemInstructionParts.push(`**PŘÍSNĚ DODRŽUJ STRUKTURU A PRAVIDLA! Tabule dominantní, TTS doplňuje, Chat minimalistický bez interpunkce a bez $ nebo \`. Úroveň Přijímačky.**`);

    const systemInstruction = systemInstructionParts.join('\n');
    // --- КОНЕЦ СБОРКИ systemInstruction ---

    const history = state.geminiChatContext.slice(-MAX_GEMINI_HISTORY_TURNS * 2);
    const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };
    const modelConfirmationText = `Rozumim Budu AI Tutor Justax zamereny na prijimacky Tema ${topicName} Uroven ${studentLevel} Tabule dominantni TTS doplnujici Chat minimalisticky bez interpunkce bez dolaru bez zpetnych apostrofu Ukonceni opatrne s markerem [PROPOSE_COMPLETION]`; // Обновил и здесь

    const contents = [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: modelConfirmationText }] },
        ...history,
        currentUserMessage
    ];

    const maxHistoryLength = MAX_GEMINI_HISTORY_TURNS * 2;
    if (contents.length > maxHistoryLength + 3) { // +3 for system instructions and current user message
        const historyStartIndex = contents.length - maxHistoryLength - 1; // Index of the first history item to remove
        contents.splice(2, historyStartIndex - 2); // Remove items between system confirm and needed history
        console.warn(`[Gemini v3.9.2] Context length exceeded limit (${maxHistoryLength * 2}). Trimmed history. New length: ${contents.length}`);
    }
    return contents;
}


/**
 * Отправляет запрос к Gemini API и возвращает обработанный ответ.
 * Версия 3.9.2: Používá opravený parseGeminiResponse.
 * @param {string} prompt - Промпт для Gemini.
 * @param {boolean} isChatInteraction - Флаг чат-интеракции.
 * @returns {Promise<{success: boolean, data: object|null, error: string|null}>}
 */
export async function sendToGemini(prompt, isChatInteraction = false) {
    if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) {
        console.error("[Gemini v3.9.2] Invalid or missing API Key");
        return { success: false, data: null, error: "Chyba Konfigurace Chybi platny API klic pro AI" };
    }
    if (!prompt || prompt.trim() === '') {
        console.error("[Gemini v3.9.2] Empty prompt provided");
        return { success: false, data: null, error: "Chyba Prazdny dotaz pro AI" };
    }
    if (!state.currentTopic && !prompt.includes("Vysvětli ZÁKLADY")) {
        console.error("[Gemini v3.9.2] No current topic set for non-initial prompt");
        return { success: false, data: null, error: "Chyba Neni vybrano tema" };
    }

    console.log(`[Gemini v3.9.2] Sending request (Chat Interaction: ${isChatInteraction}): "${prompt.substring(0, 80)}..."`);

    const contents = _buildGeminiPayloadContents(prompt);
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
        const responseData = await response.json();

        if (!response.ok) {
            let errorText = `Chyba API ${response.status}`;
            if (responseData?.error?.message) { errorText += ` ${responseData.error.message}`; }
            else if (typeof responseData === 'string') { errorText += ` ${responseData}`; }
            else { errorText += ` Neznama chyba API`; }
            errorText = errorText.replace(/[.,!?;:]/g, '');
            console.error("[Gemini v3.9.2] API Error Response:", responseData);
            throw new Error(errorText);
        }

        if (responseData.promptFeedback?.blockReason) {
            console.error("[Gemini v3.9.2] Request blocked:", responseData.promptFeedback);
            throw new Error(`Pozadavek blokovan ${responseData.promptFeedback.blockReason}`);
        }

        const candidate = responseData.candidates?.[0];
        if (!candidate) {
            console.error("[Gemini v3.9.2] No candidate found in response:", responseData);
            throw new Error('AI neposkytlo platnou odpoved');
        }

        if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
            console.warn(`[Gemini v3.9.2] Potentially problematic FinishReason: ${candidate.finishReason}.`);
            let reasonText = `Generovani ukonceno ${candidate.finishReason}`;
            if (candidate.finishReason === 'SAFETY') reasonText = 'Odpoved blokovana filtrem';
            if (candidate.finishReason === 'RECITATION') reasonText = 'Odpoved blokovana recitace';
            // Throw error for problematic finish reasons even if content exists? Maybe not, let's parse first.
        }

        const rawText = candidate.content?.parts?.[0]?.text;

        // Handle cases where response is blocked or empty but finishReason is STOP (e.g., safety filter on output)
        if (!rawText && candidate.finishReason && candidate.finishReason !== 'STOP') {
             if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Odpoved AI prilis dlouha');
             else throw new Error('AI vratilo prazdnou odpoved Duvod ' + (candidate.finishReason || 'Neznamy'));
        }

        // If rawText is empty (even with STOP reason), still add it to context and return empty parsed data
        if (!rawText) {
            console.warn("[Gemini v3.9.2] Response candidate has no text content (rawText is empty/undefined). FinishReason:", candidate.finishReason);
            // Update context
             state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] });
             state.geminiChatContext.push({ role: "model", parts: [{ text: "" }] }); // Add empty response to history
             // Trim context if needed
             if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2 + 2) {
                 state.geminiChatContext.splice(2, state.geminiChatContext.length - (MAX_GEMINI_HISTORY_TURNS * 2 + 2));
             }
            return { success: true, data: { boardMarkdown: "", ttsCommentary: "", chatText: "" }, error: null };
        }

        // Update context with valid response
        state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] });
        state.geminiChatContext.push({ role: "model", parts: [{ text: rawText }] });
        if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2 + 2) {
             state.geminiChatContext.splice(2, state.geminiChatContext.length - (MAX_GEMINI_HISTORY_TURNS * 2 + 2));
        }

        // Update board history (only if board content exists)
        const boardMatch = rawText.match(/\[BOARD_MARKDOWN]:\s*```(?:markdown)?([\s\S]*?)```/); // Improved regex
        if (boardMatch && boardMatch[1]) {
            state.boardContentHistory.push(boardMatch[1].trim());
            if(state.boardContentHistory.length > 7) { // Limit history size
                state.boardContentHistory.shift();
            }
        }

        const parsedData = parseGeminiResponse(rawText); // Использует parseGeminiResponse v3.9.2
        return { success: true, data: parsedData, error: null };

    } catch (error) {
        console.error('[Gemini v3.9.2] Chyba komunikace s Gemini nebo zpracovani odpovedi:', error);
        return { success: false, data: null, error: (error.message || "Neznama chyba AI").replace(/[.,!?;:]/g, '') };
    }
}

console.log("Gemini service module loaded (v3.9.2 with chat cleaning fixes).");