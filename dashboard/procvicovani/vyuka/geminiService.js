// geminiService.js - Функции для взаимодействия с Google Gemini API

import {
    GEMINI_API_KEY,
    GEMINI_API_URL,
    GEMINI_SAFETY_SETTINGS,
    GEMINI_GENERATION_CONFIG,
    MAX_GEMINI_HISTORY_TURNS
} from './config.js';
import { state } from './state.js';
// Закомментируем импорты, связанные с UI, т.к. этот сервис будет только возвращать данные
// import { showToast } from './ui.js';
// import { addChatMessage } from './chatController.js'; // Не должно быть здесь
// import { appendToWhiteboard } from './whiteboardController.js'; // Не должно быть здесь

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

    // Важно: поиск маркеров и извлечение текста
    const boardStart = rawText.indexOf(boardMarker);
    const ttsStart = rawText.indexOf(ttsMarker);

    // Извлечение Markdown для доски
    if (boardStart !== -1) {
        let blockStart = rawText.indexOf("```markdown", boardStart + boardMarker.length); // Ищем начало блока кода
        if (blockStart === -1) blockStart = rawText.indexOf("```", boardStart + boardMarker.length); // Ищем просто ```

        if (blockStart !== -1) {
             const codeBlockStartIndex = blockStart + (rawText.includes("```markdown") ? 11 : 3); // Начало содержимого блока
            let blockEnd = rawText.indexOf("```", codeBlockStartIndex);
            if (blockEnd !== -1) {
                boardMarkdown = rawText.substring(codeBlockStartIndex, blockEnd).trim();
            } else {
                // Если закрывающий ``` не найден, берем все до конца строки (менее надежно)
                boardMarkdown = rawText.substring(codeBlockStartIndex).trim();
                console.warn("parseGeminiResponse: Missing closing ``` for board markdown.");
            }
        } else {
             // Если блок ``` не найден после маркера, возможно, markdown идет сразу
             // Попробуем найти конец ttsMarker или конец строки
             let contentEnd = rawText.length;
             if (ttsStart > boardStart) contentEnd = ttsStart;
             boardMarkdown = rawText.substring(boardStart + boardMarker.length, contentEnd).trim();
             console.warn("parseGeminiResponse: Code block ``` not found after [BOARD_MARKDOWN]:, extracting content until next marker or end.");
        }
    }

    // Извлечение комментария TTS
    if (ttsStart !== -1) {
        let commentaryEnd = rawText.length;
        // Ищем следующий маркер после TTS_COMMENTARY
        if (boardStart > ttsStart) {
            commentaryEnd = boardStart;
        }
        ttsCommentary = rawText.substring(ttsStart + ttsMarker.length, commentaryEnd).trim();
    }

    // Извлечение текста для чата (все, что не попало в markdown или tts)
    let lastIndex = 0;
    let textSegments = [];
    const markers = [];
    if (boardStart !== -1) {
        // Определяем конец блока markdown (включая ```)
        let boardEndIndex = boardStart + boardMarker.length + (boardMarkdown.length > 0 ? boardMarkdown.length : 0);
        if (rawText.includes("```", boardStart)) {
             boardEndIndex = rawText.indexOf("```", rawText.indexOf("```", boardStart) + 3) + 3;
             if (boardEndIndex < 3) boardEndIndex = rawText.length; // Если закрытия нет
        }
        markers.push({ start: boardStart, end: boardEndIndex });
    }
    if (ttsStart !== -1) {
         let ttsEndIndex = ttsStart + ttsMarker.length + ttsCommentary.length;
         markers.push({ start: ttsStart, end: ttsEndIndex });
    }
    markers.sort((a, b) => a.start - b.start); // Сортируем маркеры по началу

    markers.forEach(marker => {
        if (marker.start > lastIndex) {
            textSegments.push(rawText.substring(lastIndex, marker.start));
        }
        lastIndex = marker.end;
    });
    if (lastIndex < rawText.length) {
        textSegments.push(rawText.substring(lastIndex));
    }
    // Убираем пустые строки и остатки маркеров
    chatText = textSegments.map(s => s.replace(boardMarker, '').replace(ttsMarker, '').trim()).filter(s => s.length > 0).join("\n\n").trim();

    console.log("[ParseGemini] Board:", boardMarkdown ? boardMarkdown.substring(0, 50) + "..." : "None");
    console.log("[ParseGemini] TTS:", ttsCommentary ? ttsCommentary.substring(0, 50) + "..." : "None");
    console.log("[ParseGemini] Chat:", chatText ? chatText.substring(0, 50) + "..." : "None");

    return { boardMarkdown, ttsCommentary, chatText };
}


// --- Функции для создания промптов (приватные для модуля) ---

function _buildInitialPrompt() {
    const level = state.currentProfile?.skill_level || 'neznámá';
    return `Jsi AI Tutor "Justax". Vysvětli ZÁKLADY tématu "${state.currentTopic?.name}" pro studenta s úrovní "${level}". Rozděl vysvětlení na menší logické části. Pro PRVNÍ ČÁST:
Formát odpovědi MUSÍ být:
[BOARD_MARKDOWN]:
\`\`\`markdown
(Zde napiš KRÁTKÝ a STRUČNÝ Markdown text pro první část vysvětlení na TABULI - klíčové body, vzorec, jednoduchý diagram. Použij POUZE nadpisy ## nebo ###, seznamy, \$\$. NEPOUŽÍVEJ chatovací styl zde.)
\`\`\`
[TTS_COMMENTARY]:
(Zde napiš PODROBNĚJŠÍ konverzační komentář k obsahu tabule pro hlasový výstup. Rozveď myšlenky, přidej kontext, PŘIZPŮSOBENO ÚROVNI "${level}". Můžeš zakončit otázkou pro ověření pochopení.)`;
}

function _buildContinuePrompt() {
    const level = state.currentProfile?.skill_level || 'neznámá';
    return `Pokračuj ve vysvětlování tématu "${state.currentTopic?.name}" pro studenta s úrovní "${level}". Naváž na předchozí část. Vygeneruj další logickou část výkladu.
Formát odpovědi MUSÍ být:
[BOARD_MARKDOWN]:
\`\`\`markdown
(Zde napiš DALŠÍ stručnou část Markdown textu pro TABULI. Použij POUZE nadpisy ## nebo ###, seznamy, \$\$. NEPOUŽÍVEJ chatovací styl zde.)
\`\`\`
[TTS_COMMENTARY]:
(Zde napiš podrobnější konverzační komentář k NOVÉMU obsahu tabule pro hlasový výstup, přizpůsobený úrovni "${level}". Zkus položit jednoduchou otázku nebo zadat příklad k tématu.)`;
}

function _buildChatInteractionPrompt(userText) {
     const level = state.currentProfile?.skill_level || 'neznámá';
     let baseInstruction;
     if (state.aiIsWaitingForAnswer) {
         baseInstruction = `Student odpověděl: "${userText}". Vyhodnoť stručně správnost odpovědi v kontextu tématu "${state.currentTopic?.name}" a předchozí konverzace. Vysvětli případné chyby.`;
     } else {
         baseInstruction = `Student píše do chatu: "${userText}". Odpověz relevantně k tématu "${state.currentTopic?.name}" a kontextu diskuze.`;
     }
     // Сбрасываем флаг ожидания, т.к. AI сейчас обработает ответ/вопрос
     state.aiIsWaitingForAnswer = false;

     return `${baseInstruction} Udržuj konverzační tón přizpůsobený úrovni "${level}". Odpovídej POUZE textem do CHATU. Nepoužívej bloky [BOARD_MARKDOWN] ani [TTS_COMMENTARY]. Na konci své odpovědi můžeš položit další otázku nebo navrhnout pokračování ve výkladu.`;
 }

function _buildGeminiPayloadContents(userPrompt) {
    const level = state.currentProfile?.skill_level || 'neznámá';
    // Обновленная системная инструкция
    const systemInstruction = `Jsi AI Tutor "Justax". Vyučuješ téma: "${state.currentTopic?.name}" studenta s úrovní "${level}".
- Pokud dostaneš instrukci začít nebo pokračovat ve výkladu (obsahující "Vysvětli ZÁKLADY", "Pokračuj ve vysvětlování"), ODPOVĚĎ MUSÍ OBSAHOVAT OBA BLOKY: [BOARD_MARKDOWN]: \`\`\`markdown ... \`\`\` A [TTS_COMMENTARY]: .... Text pro tabuli (BOARD_MARKDOWN) má být stručný a strukturovaný (nadpisy ##/###, seznamy, LaTeX \$\$). Komentář pro TTS má být podrobnější, konverzační a může obsahovat otázky.
- Pokud dostaneš text od studenta (označený jako "Student píše..." nebo "Student odpověděl..."), odpovídej POUZE běžným textem do CHATU. Vyhodnoť odpovědi studenta nebo odpověz na jeho otázky. Nepřidávej [BOARD_MARKDOWN] ani [TTS_COMMENTARY] pokud to není explicitně vyžádáno.
- Pokud jsi právě položil otázku, očekávej odpověď studenta.`;

    // Берем последние N*2 сообщений (вопрос-ответ) + 2 системных
    const history = state.geminiChatContext.slice(-MAX_GEMINI_HISTORY_TURNS * 2);
    const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };

     // Структура: Системные инструкции -> История -> Текущий Запрос Пользователя
     const contents = [
         { role: "user", parts: [{ text: systemInstruction }] },
         { role: "model", parts: [{ text: `Rozumím. Jsem připraven vysvětlovat téma "${state.currentTopic?.name}" pro úroveň "${level}" pomocí tabule a TTS komentáře, nebo odpovídat na dotazy studenta v chatu.` }] },
         ...history,
         currentUserMessage
     ];

    return contents;
}

// --- Основная функция отправки запроса ---

/**
 * Отправляет запрос к Gemini API и возвращает обработанный ответ.
 * @param {string} prompt - Промпт для Gemini.
 * @param {boolean} isChatInteraction - Указывает, является ли это прямым взаимодействием в чате (влияет на генерацию промпта).
 * @returns {Promise<{success: boolean, data: {boardMarkdown: string, ttsCommentary: string, chatText: string}|null, error: string|null}>}
 */
export async function sendToGemini(prompt, isChatInteraction = false) {
    if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIzaSy')) {
        return { success: false, data: null, error: "Chyba Konfigurace: Chybí platný API klíč pro AI." };
    }
    if (!state.currentTopic) {
        return { success: false, data: null, error: "Chyba: Není vybráno žádné téma." };
    }
    // Убрали проверку navigator.onLine, т.к. она должна быть в вызывающем коде

    console.log(`[Gemini] Sending request (Chat Interaction: ${isChatInteraction}): "${prompt.substring(0, 80)}..."`);

    // Строим payload в зависимости от типа взаимодействия
    const finalPrompt = isChatInteraction ? _buildChatInteractionPrompt(prompt) : prompt;
    const contents = _buildGeminiPayloadContents(finalPrompt);

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

        if (!response.ok) {
            let errorText = `Chyba API (${response.status})`;
            try {
                const errData = await response.json();
                errorText += `: ${errData?.error?.message || 'Neznámá chyba'}`;
            } catch (e) {
                errorText += `: ${await response.text()}`;
            }
            throw new Error(errorText);
        }

        const data = await response.json();

        if (data.promptFeedback?.blockReason) {
            throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}. Zkuste přeformulovat.`);
        }
        const candidate = data.candidates?.[0];
        if (!candidate) {
            throw new Error('AI neposkytlo platnou odpověď.');
        }
        if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
            console.warn(`[Gemini] FinishReason: ${candidate.finishReason}.`);
            if (candidate.finishReason === 'SAFETY') {
                throw new Error('Odpověď blokována bezpečnostním filtrem AI.');
            }
        }

        const rawText = candidate.content?.parts?.[0]?.text;
        if (!rawText && candidate.finishReason !== 'STOP') {
             if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Odpověď AI byla příliš dlouhá (Max Tokens).');
             else throw new Error('AI vrátilo prázdnou odpověď (Důvod: '+(candidate.finishReason || 'Neznámý')+').');
        }

        // Обновляем контекст чата в state
        state.geminiChatContext.push({ role: "user", parts: [{ text: finalPrompt }] }); // Сохраняем финальный промпт
        state.geminiChatContext.push({ role: "model", parts: [{ text: rawText || "" }] });
        // Обрезаем историю, если она слишком длинная (+2 для системных сообщений)
        if (state.geminiChatContext.length > MAX_GEMINI_HISTORY_TURNS * 2 + 2) {
            state.geminiChatContext.splice(2, state.geminiChatContext.length - (MAX_GEMINI_HISTORY_TURNS * 2 + 2));
        }

        // Парсим ответ и возвращаем его
        const parsedData = parseGeminiResponse(rawText || "");
        return { success: true, data: parsedData, error: null };

    } catch (error) {
        console.error('[Gemini] Chyba komunikace s Gemini:', error);
        return { success: false, data: null, error: error.message }; // Возвращаем ошибку
    }
    // finally блок не нужен, т.к. управление thinking state будет в вызывающем коде
}

console.log("Gemini service module loaded.");