// whiteboardController.js - Kontroler pro správu obsahu na "tabuli" (whiteboard)
// Verze 3.9.5 (revert): Jednodušší zpracování Markdownu a MathJax. Spoléhá na správnou konfiguraci sanitizeHTML v utils.js.

import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import { sanitizeHTML } from './utils.js'; // Import upravené sanitizační funkce
import { ui } from './ui.js';
import { state } from './state.js';

// Konfigurace Marked.js - Důležité: NECHCEME, aby Marked interpretoval $ jako LaTeX.
marked.setOptions({
    renderer: new marked.Renderer(),
    pedantic: false,
    gfm: true,
    breaks: true,
    sanitize: false, // Sanitizaci děláme zvlášť pomocí DOMPurify v sanitizeHTML
    smartLists: true,
    smartypants: false,
    xhtml: false
});

/**
 * Přidá obsah (chunk) na tabuli a zpracuje Markdown a MathJax.
 * @param {string} markdownContent - Obsah ve formátu Markdown.
 * @param {string} ttsText - Text pro TTS tlačítko (nepovinné).
 * @returns {HTMLElement | null} - Nově přidaný DOM element (chunk) nebo null při chybě.
 */
export function appendToWhiteboard(markdownContent, ttsText = "") {
    if (!ui.whiteboardContent) {
        console.error("Whiteboard container (#whiteboard-content) not found!");
        return null;
    }
    const container = ui.whiteboardContent;

    // 1. Konverze Markdown na HTML - necháváme $ a $$ nedotčené pro MathJax
    let dirtyHtml = "";
    try {
        dirtyHtml = marked.parse(markdownContent || "");
    } catch (e) {
        console.error("Marked.parse error:", e);
        dirtyHtml = "<p>Chyba při zpracování Markdownu.</p>";
    }

    // 2. Sanitizace HTML pomocí upravené funkce v utils.js
    //   Předpokládáme, že tato funkce nyní správně zachází s MathJaxem.
    const cleanHtml = sanitizeHTML(dirtyHtml); // Použijeme nově nakonfigurovanou sanitizeHTML

    // 3. Vytvoření obalujícího div elementu (chunk)
    const chunkDiv = document.createElement('div');
    // Třída tex2jax_process je na #whiteboard-content, MathJax ji tam najde.
    chunkDiv.className = 'whiteboard-chunk';
    chunkDiv.innerHTML = cleanHtml;

    // 4. Přidání TTS tlačítka
    if (ttsText) {
        const ttsButton = document.createElement('button');
        ttsButton.className = 'tts-listen-btn btn-tooltip';
        ttsButton.title = 'Přečíst nahlas';
        ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
        ttsButton.dataset.textToSpeak = ttsText;
        chunkDiv.appendChild(ttsButton);
    }

    // 5. Přidání do DOMu a scroll
    container.appendChild(chunkDiv);
    container.scrollTop = container.scrollHeight;

    // 6. Explicitní spuštění MathJax pro nově přidaný element
    if (window.MathJax && window.MathJax.startup) {
        console.log("[MathJax v3.9.5] Queueing typesetting for new whiteboard chunk...");
        window.MathJax.startup.promise.then(() => {
            if (typeof window.MathJax.typesetPromise === 'function') {
                 console.log("[MathJax v3.9.5] MathJax ready, typesetting chunk:", chunkDiv);
                 window.MathJax.typesetPromise([chunkDiv])
                     .then(() => {
                         console.log("[MathJax v3.9.5] Typesetting complete for new chunk.");
                     }).catch((err) => {
                         console.error('[MathJax v3.9.5] Error typesetting chunk:', err);
                     });
            } else {
                 console.error("[MathJax v3.9.5] typesetPromise function not found after startup.");
            }
        }).catch(err => console.error("MathJax startup promise failed:", err));
    } else {
        console.warn("MathJax or MathJax.startup not available for new chunk.");
    }

    // 7. Uložení do historie
    state.boardContentHistory.push(markdownContent);
    if (state.boardContentHistory.length > 7) { state.boardContentHistory.shift(); }

    console.log("Appended content to whiteboard and queued MathJax typesetting (v3.9.5).");
    return chunkDiv;
}

/**
 * Vymaže veškerý obsah z tabule.
 * @param {boolean} showInternalToast - Zda zobrazit interní toast (pro debug).
 */
export function clearWhiteboard(showInternalToast = true) {
    if (ui.whiteboardContent) {
        ui.whiteboardContent.innerHTML = '<div class="empty-state"><i class="fas fa-chalkboard"></i><h3>Tabule</h3><p>Obsah byl vymazán.</p></div>';
        state.boardContentHistory = [];
        if (showInternalToast) {
             console.log("Whiteboard cleared internally.");
        }
    } else {
        console.error("Whiteboard container not found!");
    }
}

console.log("Whiteboard controller module loaded (v3.9.5 - reverted to simpler MathJax handling).");