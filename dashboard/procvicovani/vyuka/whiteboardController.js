// whiteboardController.js - Kontroler pro správu obsahu na "tabuli" (whiteboard)
// Verze 3.9.4: Robustnější volání MathJax přes startup promise.

import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import { sanitizeHTML } from './utils.js';
import { ui } from './ui.js';
import { state } from './state.js'; // Potřebujeme pro historii

// Konfigurace Marked.js
marked.setOptions({
    renderer: new marked.Renderer(),
    pedantic: false,
    gfm: true,
    breaks: true,
    sanitize: false, // Sanitizaci děláme ručně
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
        console.error("Whiteboard container not found!");
        return null;
    }
    const container = ui.whiteboardContent;

    // 1. Příprava pro MathJax a konverze Markdown na HTML
    let dirtyHtml = "";
    try {
        // Nahradíme $...$ a $$...$$ značkami, které MathJax pozná a Marked ignoruje
        const mathJaxReadyMarkdown = (markdownContent || "")
            .replace(/\$\$(.*?)\$\$/gs, '<span class="math-block">$$$1$$</span>') // Display math - použijeme $$ uvnitř pro MathJax
            .replace(/\$(.*?)\$/g, '<span class="math-inline">$1$</span>');   // Inline math - použijeme $ uvnitř pro MathJax

        dirtyHtml = marked.parse(mathJaxReadyMarkdown); // Zpracuje Markdown na HTML
    } catch (e) {
        console.error("Marked.parse error:", e);
        dirtyHtml = "<p>Chyba při zpracování Markdownu.</p>";
    }
    // Sanitizujeme HTML, ale POVOLÍME span s třídami math-inline a math-block
    // a obnovíme vnitřní $ a $$ pro MathJax
    const cleanHtml = sanitizeHTML(dirtyHtml, {
         USE_PROFILES: { html: true },
         ADD_TAGS: ['span'],
         ADD_ATTR: ['class']
     }).replace(/&lt;span class="math-block"&gt;\$\$(.*?)\$\$&lt;\/span&gt;/gs, '<span class="math-block">$$$1$$</span>')
       .replace(/&lt;span class="math-inline"&gt;\$(.*?)\$&lt;\/span&gt;/g, '<span class="math-inline">$1$</span>');

    // 2. Vytvoření obalujícího div elementu (chunk)
    const chunkDiv = document.createElement('div');
    chunkDiv.className = 'whiteboard-chunk tex2jax_process'; // Přidána třída pro MathJax
    chunkDiv.innerHTML = cleanHtml;

    // 3. Přidání TTS tlačítka, pokud je text zadán
    if (ttsText) {
        const ttsButton = document.createElement('button');
        ttsButton.className = 'tts-listen-btn btn-tooltip';
        ttsButton.title = 'Přečíst nahlas';
        ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
        ttsButton.dataset.textToSpeak = ttsText;
        chunkDiv.appendChild(ttsButton);
    }

    // 4. Přidání chunkDiv do kontejneru tabule
    container.appendChild(chunkDiv);

    // 5. Scroll dolů
    container.scrollTop = container.scrollHeight;

    // 6. Robustnější explicitní spuštění MathJax pro nově přidaný element
    if (window.MathJax && window.MathJax.startup) {
        console.log("[MathJax] Queueing typesetting for new whiteboard chunk...");
        // Použijeme startup.promise pro zajištění, že MathJax je plně připraven
        window.MathJax.startup.promise.then(() => {
            if (typeof window.MathJax.typesetPromise === 'function') {
                 console.log("[MathJax] MathJax ready, typesetting chunk:", chunkDiv);
                 window.MathJax.typesetPromise([chunkDiv])
                     .then(() => {
                         console.log("[MathJax] Typesetting complete for new chunk.");
                     }).catch((err) => {
                         console.error('[MathJax] Error typesetting chunk:', err);
                     });
            } else {
                 console.error("[MathJax] typesetPromise function not found after startup.");
            }
        }).catch(err => console.error("MathJax startup promise failed:", err));
    } else {
        console.warn("MathJax or MathJax.startup not available for new chunk.");
    }

    // 7. Uložení do historie
    state.boardContentHistory.push(markdownContent);
    if (state.boardContentHistory.length > 7) { state.boardContentHistory.shift(); }

    console.log("Appended content to whiteboard and queued MathJax typesetting.");
    return chunkDiv; // Vracíme přidaný element
}

/**
 * Vymaže veškerý obsah z tabule.
 * @param {boolean} showInternalToast - Zda zobrazit interní toast (pro debug).
 */
export function clearWhiteboard(showInternalToast = true) {
    if (ui.whiteboardContent) {
        ui.whiteboardContent.innerHTML = '<div class="empty-state"><i class="fas fa-chalkboard"></i><h3>Tabule</h3><p>Obsah byl vymazán.</p></div>';
        state.boardContentHistory = []; // Vymazat i historii
        if (showInternalToast) {
             console.log("Whiteboard cleared internally.");
        }
    } else {
        console.error("Whiteboard container not found!");
    }
}

/**
 * Zpracuje Markdown text a vrátí HTML (bez sanitizace).
 * Používá se interně, např. pro náhledy.
 * @param {string} markdown - Text ve formátu Markdown.
 * @returns {string} - HTML řetězec.
 */
export function renderMarkdown(markdown) {
    try {
        return marked.parse(markdown || "");
    } catch (e) {
        console.error("renderMarkdown error:", e);
        return "<p>Chyba při renderování Markdownu.</p>";
    }
}

console.log("Whiteboard controller module loaded (v3.9.4 with robust MathJax trigger).");