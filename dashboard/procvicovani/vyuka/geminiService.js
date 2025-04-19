// vyuka/geminiService.js - Функции для взаимодействия с Google Gemini API
// Версия 3.7: Улучшен промпт (глубина, без символов в чате, логика завершения)

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
        // Ищем начало блока ```markdown или просто ```
        let blockStart = rawText.indexOf("```markdown", boardStart + boardMarker.length);
        if (blockStart === -1) blockStart = rawText.indexOf("```", boardStart + boardMarker.length);

        if (blockStart !== -1) {
            // Определяем, где начинается сам контент блока
            const codeBlockStartIndex = blockStart + (rawText.includes("```markdown", blockStart) ? 11 : 3); // +11 для ```markdown\n или +3 для ```\n
            let blockEnd = rawText.indexOf("```", codeBlockStartIndex); // Ищем конец блока
            if (blockEnd !== -1) {
                boardMarkdown = rawText.substring(codeBlockStartIndex, blockEnd).trim();
            } else {
                // Если не нашли закрывающий ```, берем все до конца или до следующего маркера
                let potentialEnd = rawText.indexOf(ttsMarker, codeBlockStartIndex);
                if (potentialEnd === -1 || potentialEnd < codeBlockStartIndex) potentialEnd = rawText.length;
                boardMarkdown = rawText.substring(codeBlockStartIndex, potentialEnd).trim();
                console.warn("parseGeminiResponse: Missing closing ``` for board markdown. Extracted until next marker or end.");
            }
        } else {
            // Если ``` не найден после маркера, берем текст до следующего маркера или конца
            let contentEnd = rawText.indexOf(ttsMarker, boardStart + boardMarker.length);
            if (contentEnd === -1 || contentEnd < boardStart) contentEnd = rawText.length;
            boardMarkdown = rawText.substring(boardStart + boardMarker.length, contentEnd).trim();
            console.warn("parseGeminiResponse: Code block ``` not found after [BOARD_MARKDOWN]:, extracting content until next marker or end.");
        }
    }

    // Извлечение комментария TTS
    const ttsStart = rawText.indexOf(ttsMarker);
    if (ttsStart !== -1) {
        let commentaryEnd = rawText.length;
        // Ищем следующий маркер [BOARD_MARKDOWN]:, чтобы не захватить лишнего
        const nextBoardStart = rawText.indexOf(boardMarker, ttsStart + ttsMarker.length);
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
        // Определяем конец блока доски более точно
        let boardEndIndex = boardStart + boardMarker.length + boardMarkdown.length;
        if (rawText.includes("```", boardStart + boardMarker.length)) { // Если был блок кода
             let startOfCodeBlock = rawText.indexOf("```", boardStart + boardMarker.length);
             if (startOfCodeBlock !== -1) {
                 let endOfCodeBlock = rawText.indexOf("```", startOfCodeBlock + 3);
                 if (endOfCodeBlock !== -1) {
                     boardEndIndex = endOfCodeBlock + 3;
                 }
             }
        }
        markers.push({ start: boardStart, end: boardEndIndex });
    }
    if (ttsStart !== -1) {
         let ttsEndIndex = ttsStart + ttsMarker.length + ttsCommentary.length;
         const nextBoardAfterTts = rawText.indexOf(boardMarker, ttsStart + ttsMarker.length);
         if(nextBoardAfterTts !== -1 && nextBoardAfterTts > ttsStart) {
             // Если после TTS есть блок доски, обрезаем по нему
             ttsEndIndex = nextBoardAfterTts;
         }
         markers.push({ start: ttsStart, end: ttsEndIndex });
    }
    markers.sort((a, b) => a.start - b.start); // Сортируем маркеры по началу

    // Проходим по тексту, вырезая сегменты между маркерами
    markers.forEach(marker => {
        if (marker.start > lastIndex) {
            chatSegments.push(rawText.substring(lastIndex, marker.start));
        }
        lastIndex = Math.max(lastIndex, marker.end); // Обновляем позицию после маркера
    });
    // Добавляем остаток текста после последнего маркера
    if (lastIndex < rawText.length) {
        chatSegments.push(rawText.substring(lastIndex));
    }

    // Собираем текст чата, очищая от маркеров и пустых строк
    chatText = chatSegments
        .map(s => s.replace(boardMarker, '').replace(ttsMarker, '').replace(/```(markdown)?/g, '').trim())
        .filter(s => s.length > 0) // Убираем пустые сегменты
        .join("\n\n") // Соединяем сегменты с двойным переносом строки
        .trim();

    // Особая обработка ответа "?" - считаем его пустым
    if (chatText === '?') {
        chatText = "";
    }

    // Логирование для отладки
    console.log("[ParseGemini] Board:", boardMarkdown ? boardMarkdown.substring(0, 60) + "..." : "None");
    console.log("[ParseGemini] TTS:", ttsCommentary ? ttsCommentary.substring(0, 60) + "..." : "None");
    console.log("[ParseGemini] Chat:", chatText ? chatText.substring(0, 60) + "..." : "None");

    return { boardMarkdown, ttsCommentary, chatText };
}


/**
 * Строит финальный контент для запроса к Gemini API, включая улучшенную системную инструкцию.
 * @param {string} userPrompt - Текущий промпт/сообщение от пользователя или команды приложения.
 * @returns {Array<Object>} Массив объектов 'contents' для API.
 */
function _buildGeminiPayloadContents(userPrompt) {
    const level = state.currentProfile?.skill_level || 'neznámá';
    const topicName = state.currentTopic?.name || 'Neznámé téma';
    const boardHistorySummary = state.boardContentHistory.length > 0
        ? "Stručný souhrn PŘEDCHOZÍHO obsahu tabule:\n" + state.boardContentHistory.map(c => `- ${c.substring(0, 100).replace(/[\r\n]+/g, ' ')}...`).slice(-3).join('\n') // Last 3 items summary
        : "Tabule je zatím prázdná.";

    // --- УЛУЧШЕННЫЙ СИСТЕМНЫЙ ПРОМПТ (Версия 3.7) ---
    const systemInstruction = `
Jsi expertní, přátelský a **velmi trpělivý** AI Tutor "Justax". Tvým cílem je **důkladně a podrobně** vysvětlit téma "${topicName}" studentovi 9. třídy ZŠ v Česku s aktuální úrovní znalostí "${level}". Komunikuj POUZE v ČEŠTINĚ. **NEPOSPÍCHEJ** s výkladem.

**Tvůj výstup MUSÍ být strukturován pomocí JEDNOHO nebo VÍCE z následujících kanálů/formátů.** **NIKDY nekombinuj obsah určený pro různé kanály v jednom bloku.**

**Pravidla Vysvětlování a Interakce:**

* **PODROBNOST VÝKLADU:** Každý koncept vysvětluj **DŮKLADNĚ**. Rozděluj složitější témata na **menší, stravitelné kroky**. Po každém kroku/konceptu **VŽDY ověř porozumění** konkrétní otázkou nebo malým úkolem. Nepřecházej dál, dokud student neprokáže pochopení.
* **Struktura Výkladu:** Postupuj logicky, krok za krokem. Každá část by měla pokrývat jeden klíčový koncept nebo krok. Používej TABULI (\`[BOARD_MARKDOWN]:\`) pro klíčové vizuální informace (vzorce, kroky) a TTS (\`[TTS_COMMENTARY]:\`) pro **PODROBNÉ** mluvené vysvětlení.
* **Aktivní Zapojení Studenta:**
    * **Po vysvětlení (v TTS/CHATU):** Aktivně nabídni **krátký praktický příklad** nebo **úkol k procvičení** související s právě vysvětlenou látkou. Zeptej se studenta, jestli si to chce zkusit. Např.: "Chceš si teď zkusit podobný příklad na tabuli?" nebo "Mám tu pro tebe krátký úkol na procvičení, co říkáš?".
    * **Pravidelná Kontrola Porozumění (v CHATU):** Kláď **KONKRÉTNÍ** otázky k ověření porozumění (NEJEN "rozumíš?"). Např.: "Jak bys vlastními slovy popsal(a) tento krok?", "Proč jsme zde použili právě tento vzorec, a ne jiný?", "Mohl(a) bys uvést jiný příklad použití?".
    * **Hodnocení Odpovědí (v CHATU):** Když student odpoví na otázku nebo vyřeší úkol, poskytni **DETAILNÍ konstruktivní zpětnou vazbu**. Pokud je odpověď správná, pochval a **stručně zopakuj, PROČ je správná**. Pokud je chybná, **PODROBNĚ vysvětli chybu** a naved na správné řešení krok za krokem.

**Formáty Výstupu (MUSÍ být dodrženy):**

1.  **TABULE (\`[BOARD_MARKDOWN]:\`)**
    * **Účel:** POUZE pro VIZUÁLNÍ prezentaci klíčových, strukturovaných informací (definice, vzorce, **KROKY ŘEŠENÍ**, diagramy, tabulky). Obsah musí být jasný a **velmi stručný**.
    * **Formát:** VŽDY začíná markerem \`[BOARD_MARKDOWN]:\` na samostatném řádku, následovaným blokem kódu \`\\\`\\\`\\\`markdown ... \\\`\\\`\\\`\`.
    * **Obsah Markdown:**
        * Používej POUZE: Nadpisy (\`##\`, \`###\`), seznamy (\`*\`, \`-\`, \`1.\`), tučné písmo (\`**text**\`), kurzívu (\`*text*\`), LaTeX pro vzorce (\`$ ... $\` pro inline, \`<span class="math-block">\.\.\.</span>\` pro blokové). **ŽÁDNÝ inline kód (\`) v markdownu pro tabuli!**
        * **ZDE NEPATŘÍ:** Konverzace, otázky, vysvětlení "proč", nabídky úkolů, dlouhé texty. POUZE stručná fakta a kroky.
    * **Kdy použít:** POVINNĚ při *zahájení* výkladu a při *pokračování* výkladu. Také POUZE tehdy, když student VÝSLOVNĚ požádá o zobrazení něčeho na tabuli.

2.  **MLUVENÝ KOMENTÁŘ (\`[TTS_COMMENTARY]:\`)**
    * **Účel:** **PODROBNÉ**, **konverzační** vysvětlení obsahu z TABULE. Poskytnutí KONTEXTU, motivace, vysvětlení "proč" daný krok děláme, analogie, příklady. Může obsahovat nabídku úkolu/příkladu k řešení v chatu.
    * **Formát:** VŽDY začíná markerem \`[TTS_COMMENTARY]:\` na samostatném řádku, následovaným **čistým textem** (bez Markdown, LaTeXu, zpětných apostrofů).
    * **Obsah:**
        * Vysvětluj koncepty **podrobně a trpělivě**, přizpůsobeno úrovni "${level}". Rozveď stručné body z tabule.
        * **Můžeš nabízet úkoly/příklady:** "A teď bychom si mohli ukázat příklad. Chtěl(a) bys?" nebo "Pro lepší pochopení mám připravený krátký úkol. Zkusíme?". Samotný úkol pak zadej v CHATU.
        * MŮŽEŠ použít řečnické otázky nebo jednoduché kontrolní otázky na konci ("Je tento krok jasný?").
    * **Kdy použít:** VŽDY **SPOLEČNĚ S** \`[BOARD_MARKDOWN]:\` při *zahájení* a *pokračování* výkladu. NIKDY samostatně. NIKDY v reakci na zprávu studenta v chatu.

3.  **CHAT (Čistý text - BEZ MARKERŮ a BEZ FORMÁTOVÁNÍ)**
    * **Účel:** Přímá **interakce** se studentem - odpovídání na jeho otázky, KONTROLA a **PODROBNÉ HODNOCENÍ** jeho odpovědí, pokládání **KONKRÉTNÍCH otázek** k zamyšlení nebo **ZADÁVÁNÍ PROCVIČOVACÍCH ÚKOLŮ**, **DETAILNÍ** zpětná vazba, **navrhování ukončení tématu**.
    * **Formát:** POUZE čistý text. **ABSOLUTNĚ ŽÁDNÉ MARKDOWN SYMBOLY** (žádné \`*\`, \`_\`, \`**\`, \`__\`, \`\\\`\`, \`[]()\`, \`#\`, atd.). Žádný LaTeX. Vzorce piš slovně nebo velmi jednoduše (např. "x se rovná 5 děleno 2"). **ŽÁDNÉ** markery \`[BOARD_MARKDOWN]:\` nebo \`[TTS_COMMENTARY]:\`.
    * **Obsah:**
        * Udržuj přátelský, podporující a trpělivý tón.
        * Odpovídej **relevantně a podrobně** k tématu "${topicName}" a kontextu diskuze.
        * **ZADÁVEJ ÚKOLY:** Po nabídce v TTS nebo samostatně polož v chatu krátký, jasný úkol nebo otázku vyžadující výpočet/aplikaci znalosti.
        * **POKLÁDEJ OTÁZKY:** Ověřuj porozumění konkrétními dotazy po každém kroku.
        * **HODNOŤ ODPOVĚDI:** Jasně řekni, zda je odpověď studenta správná. Vysvětli **PODROBNĚ** chyby krok za krokem. Buď konstruktivní.
        * **NAVHRUJ UKONČENÍ:** POUZE pokud jsi si **JISTÝ(Á)**, že téma bylo **DŮKLADNĚ** probráno a student **PROKÁZAL POROZUMĚNÍ** (správně odpověděl na kontrolní otázky/úkoly), navrhni ukončení (viz pravidlo níže). **Nepospíchej s tímto návrhem.**
    * **Kdy použít:** VŽDY v reakci na zprávu studenta v chatu (POKUD student explicitně nepožádal o zobrazení na tabuli). MŮŽE následovat po bloku TABULE+TTS, **zejména pro položení kontrolní otázky nebo zadání úkolu**. Také pro **návrh ukončení tématu**.

**SPECIÁLNÍ PŘÍPADY:**

* **Student žádá o zobrazení na tabuli:** Pokud student napíše "ukaž na tabuli", "napiš postup", "jak vypadá vzorec", pak:
    1.  Použij \`[BOARD_MARKDOWN]:\` \`\\\`\\\`\\\`markdown ... \\\`\\\`\\\`\` pro zobrazení **POUZE** požadovaného vizuálního obsahu (rovnice, kroky, vzorec).
    2.  Do CHATU napiš POUZE **KRÁTKOU** potvrzovací zprávu, např. "Jasně, tady je to na tabuli:" nebo "Dobře, postup je teď na tabuli.". **NEopakuj obsah tabule v chatu.** Žádné TTS.
* **Studentova odpověď na tvou otázku/úkol:** Vyhodnoť jeho odpověď **PODROBNĚ** v CHATU (čistým textem). Poté buď polož další otázku/úkol v CHATU, nebo (pokud je odpověď správná a logická) navrhni pokračování výkladu (což spustí další kolo s TABULÍ+TTS), nebo (velmi opatrně) navrhni ukončení tématu.

**Ukončení Témata:**

* **PODMÍNKY:** Navrhuj ukončení **POUZE** když:
    1.  Všechny klíčové koncepty tématu "${topicName}" byly **PODROBNĚ** vysvětleny.
    2.  Student **AKTIVNĚ** a **SPRÁVNĚ** odpověděl na **několik** kontrolních otázek a/nebo vyřešil **několik** procvičovacích úkolů.
    3.  Proběhlo dostatečné množství interakcí.
* **Návrh na Ukončení:** Pokud jsou podmínky splněny, navrhni ukončení v **CHATU** (čistým textem, bez formátování). Zpráva by měla znít podobně jako: "Výborně, zdá se, že jsme důkladně probrali téma ${topicName}. Správně jsi například [zmínit konkrétní úspěšný úkol/odpověď]. Cítíš se jistě v tomto tématu a chceš ho nyní uzavřít? **[PROPOSE_COMPLETION]**"
* **DŮLEŽITÉ:** Vlož **přesně** marker \`[PROPOSE_COMPLETION]\` na konec zprávy navrhující ukončení. Nepoužívej ho jindy.

**Shrnutí Historie Tabule:**
${boardHistorySummary}

**PŘÍSNĚ DODRŽUJ STRUKTURU A PRAVIDLA!** Odděluj vizuální prezentaci (tabule), mluvené vysvětlení (TTS) a interaktivní diskuzi (chat). Buď PODROBNÝ(Á) a TRPĚLIVÝ(Á). NEPOUŽÍVEJ formátování v CHATU. Navrhuj ukončení pouze po důkladném probrání a ověření.
`;
    // --- КОНЕЦ УЛУЧШЕННОГО ПРОМПТА ---

    // Берем последние N диалогов (каждый диалог = user + model) + 2 системных сообщения в начале
    const history = state.geminiChatContext.slice(-MAX_GEMINI_HISTORY_TURNS * 2);
    const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };

     // Структура: Системные инструкции -> Подтверждение Модели -> История -> Текущий Запрос
     const contents = [
         { role: "user", parts: [{ text: systemInstruction }] },
         // Ответ модели подтверждает понимание правил (включая экранированные примеры)
         { role: "model", parts: [{ text: `Rozumím. Jsem AI tutor Justax. Budu důkladně vysvětlovat téma "${topicName}" pro úroveň "${level}". Budu striktně dodržovat pravidla pro tabuli (\`[BOARD_MARKDOWN]:\` + \`\\\`\\\`\\\`markdown\`), mluveného komentáře (\`[TTS_COMMENTARY]:\`), a chatu (čistý text bez formátování). Budu aktivně nabízet úkoly a ověřovat porozumění. Ukončení navrhnu opatrně a pouze s markerem \`[PROPOSE_COMPLETION]\`.` }] },
         ...history,
         currentUserMessage
     ];

    // Ограничиваем общую длину контекста на всякий случай (хотя slice уже это делает)
    // Учитываем 2 системных сообщения + историю
    const maxHistoryLength = MAX_GEMINI_HISTORY_TURNS * 2;
    if (contents.length > maxHistoryLength + 3) { // +1 за текущее сообщение пользователя
        const historyStartIndex = contents.length - maxHistoryLength -1;
        // Удаляем старые сообщения из истории (после системных)
        contents.splice(2, historyStartIndex - 2);
        console.warn(`[Gemini] Context length exceeded limit, trimmed history. New length: ${contents.length}`);
    }


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
    // Небольшая проверка: промпт нужен всегда, тема - почти всегда
    if (!prompt || prompt.trim() === '') {
        console.error("[Gemini] Empty prompt provided.");
        return { success: false, data: null, error: "Chyba: Prázdný dotaz pro AI." };
    }
    // Тема не нужна только при самом первом запросе на инициализацию
    if (!state.currentTopic && !prompt.includes("Vysvětli ZÁKLADY")) {
        console.error("[Gemini] No current topic set for non-initial prompt.");
        return { success: false, data: null, error: "Chyba: Není vybráno žádné téma." };
    }

    console.log(`[Gemini] Sending request (Chat Interaction: ${isChatInteraction}): "${prompt.substring(0, 80)}..."`);

    // Создаем контент для API, используя внутреннюю логику промпта
    const contents = _buildGeminiPayloadContents(prompt);

    // console.log("[Gemini] Payload Contents:", JSON.stringify(contents, null, 2)); // Раскомментировать для детальной отладки payload

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
            let errorText = `Chyba API (${response.status})`;
            if (responseData?.error?.message) {
                 errorText += `: ${responseData.error.message}`;
            } else if (typeof responseData === 'string') { // Иногда API возвращает просто строку с ошибкой
                 errorText += `: ${responseData}`;
            } else {
                 errorText += `: Neznámá chyba API.`;
            }
            console.error("[Gemini] API Error Response:", responseData);
            throw new Error(errorText);
        }

        // console.log("[Gemini] Raw API Response:", JSON.stringify(responseData, null, 2)); // Раскомментировать для детальной отладки ответа

        // Проверка блокировки из-за безопасности или других причин
        if (responseData.promptFeedback?.blockReason) {
            console.error("[Gemini] Request blocked:", responseData.promptFeedback);
            throw new Error(`Požadavek blokován: ${responseData.promptFeedback.blockReason}. Zkuste přeformulovat.`);
        }
        const candidate = responseData.candidates?.[0];
        if (!candidate) {
            console.error("[Gemini] No candidate found in response:", responseData);
            throw new Error('AI neposkytlo platnou odpověď (žádný kandidát).');
        }

        // Проверка причины завершения генерации
        if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
            console.warn(`[Gemini] Potentially problematic FinishReason: ${candidate.finishReason}.`);
            if (candidate.finishReason === 'SAFETY') {
                throw new Error('Odpověď blokována bezpečnostním filtrem AI.');
            }
             if (candidate.finishReason === 'RECITATION') {
                 throw new Error('Odpověď blokována z důvodu recitace chráněného obsahu.');
             }
             // Другие причины могут быть 'OTHER' или 'UNKNOWN'
             // throw new Error(`Generování odpovědi bylo neočekávaně ukončeno (Důvod: ${candidate.finishReason}).`);
        }

        // Извлечение текста ответа
        const rawText = candidate.content?.parts?.[0]?.text;

        // Обработка случая, когда текст пустой, но причина не STOP (например, SAFETY)
        if (!rawText && candidate.finishReason && candidate.finishReason !== 'STOP') {
             if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Odpověď AI byla příliš dlouhá (Max Tokens).');
             else throw new Error('AI vrátilo prázdnou odpověď (Důvod: ' + (candidate.finishReason || 'Neznámý') + ').');
        }
        // Обработка случая, когда текст просто пустой (может быть нормально, если AI только подтвердило что-то)
        if (!rawText) {
            console.warn("[Gemini] Response candidate has no text content, returning empty parsed data.");
             // Добавляем в историю только пользовательский запрос и пустой ответ модели
             state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] });
             state.geminiChatContext.push({ role: "model", parts: [{ text: "" }] });
             // Обрезаем историю, если она слишком длинная (учитывая 2 системных сообщения)
             if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2 + 2) {
                 state.geminiChatContext.splice(2, state.geminiChatContext.length - (MAX_GEMINI_HISTORY_TURNS * 2 + 2));
             }
            return { success: true, data: { boardMarkdown: "", ttsCommentary: "", chatText: "(AI neposkytlo žádný textový obsah)" }, error: null };
        }

        // Добавляем реальный запрос и ответ в историю
        state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] }); // Сохраняем оригинальный промпт пользователя/команды
        state.geminiChatContext.push({ role: "model", parts: [{ text: rawText }] });
        // Обрезаем историю, если она слишком длинная (учитывая 2 системных сообщения)
        if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2 + 2) {
             state.geminiChatContext.splice(2, state.geminiChatContext.length - (MAX_GEMINI_HISTORY_TURNS * 2 + 2));
        }

        // Парсим ответ
        const parsedData = parseGeminiResponse(rawText);
        return { success: true, data: parsedData, error: null };

    } catch (error) {
        console.error('[Gemini] Chyba komunikace s Gemini nebo zpracování odpovědi:', error);
        // Не добавляем ошибочный ответ в историю
        return { success: false, data: null, error: error.message || "Neznámá chyba při komunikaci s AI." };
    }
}

console.log("Gemini service module loaded (with enhanced prompt v3.7).");