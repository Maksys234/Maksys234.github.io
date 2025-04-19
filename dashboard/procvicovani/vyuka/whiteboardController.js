// whiteboardController.js - Kontroler pro správu obsahu na "tabuli" (whiteboard)
// Verze 3.9.6: Nový přístup k MathJax - obalení do spanů PŘED marked/sanitize.

import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import { sanitizeHTML } from './utils.js';
import { ui } from './ui.js';
import { state } from './state.js';

// Konfigurace Marked.js
marked.setOptions({
    renderer: new marked.Renderer(),
    pedantic: false,
    gfm: true,
    breaks: true,
    sanitize: false, // Sanitizaci děláme zvlášť
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

    // 1. PŘED-ZPRACOVÁNÍ MARKDOWNU pro MathJax:
    //    Obalíme $...$ a $$...$$ do spanů, které snadněji přežijí marked a sanitize.
    //    Použijeme zástupné znaky, aby marked neinterpretoval vnitřek.
    let mathProcessedMarkdown = markdownContent || "";
    try {
        // Display Math: $$...$$ -> <span class="math-block">CONTENT</span>
        // Použijeme negativní lookbehind (?<!) a lookahead (?!) aby se nezachytily escapované dolary (\$)
        mathProcessedMarkdown = mathProcessedMarkdown.replace(/(?<!\\)\$\$(.*?)(?<!\\)\$\$/gs, (match, content) => {
            // Zakódujeme speciální znaky uvnitř pro bezpečný průchod marked/sanitize
             const encodedContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<span class="math-block" data-math-content="${encodeURIComponent(content)}">Block Formula</span>`; // Placeholder
        });
        // Inline Math: $...$ -> <span class="math-inline">CONTENT</span>
        mathProcessedMarkdown = mathProcessedMarkdown.replace(/(?<!\\)\$([^\$]+?)(?<!\\)\$/g, (match, content) => {
            // Zakódujeme speciální znaky uvnitř
             const encodedContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
             // Odstraníme potenciální vnější mezery zachycené regexem
             const trimmedContent = content.trim();
             if (!trimmedContent) return '$'; // Pokud je obsah prázdný, vrátíme jen dolar
            return `<span class="math-inline" data-math-content="${encodeURIComponent(trimmedContent)}">Inline Formula</span>`; // Placeholder
        });
    } catch (e) {
        console.error("Error during Math pre-processing:", e);
        // Pokračujeme s původním markdownem v případě chyby
        mathProcessedMarkdown = markdownContent || "";
    }


    // 2. Konverze Markdown na HTML
    let dirtyHtml = "";
    try {
        dirtyHtml = marked.parse(mathProcessedMarkdown);
    } catch (e) {
        console.error("Marked.parse error:", e);
        dirtyHtml = "<p>Chyba při zpracování Markdownu.</p>";
    }

    // 3. Sanitizace HTML - MUSÍME POVOLIT <span class="math-..."> a data-math-content
    const cleanHtml = sanitizeHTML(dirtyHtml, {
        USE_PROFILES: { html: true },
        ADD_TAGS: ['span'], // Povolit <span>
        ADD_ATTR: ['class', 'data-math-content'] // Povolit 'class' a náš data atribut
        // SAFE_FOR_TEMPLATES: true // Pokud používáme DOMPurify, toto může pomoci zachovat obsah spanů
    });

    // 4. Vytvoření obalujícího div elementu (chunk)
    const chunkDiv = document.createElement('div');
    chunkDiv.className = 'whiteboard-chunk tex2jax_process'; // MathJax by měl hledat v prvcích s touto třídou
    chunkDiv.innerHTML = cleanHtml;

    // 5. Obnovení obsahu matematiky z data atributů
    chunkDiv.querySelectorAll('span.math-inline, span.math-block').forEach(span => {
        const originalContent = decodeURIComponent(span.dataset.mathContent || '');
        if (span.classList.contains('math-inline')) {
             // Obnovíme $...$ pro MathJax
             span.textContent = `$${originalContent}$`;
        } else if (span.classList.contains('math-block')) {
             // Obnovíme $$...$$ pro MathJax
             span.textContent = `$$${originalContent}$$`;
        }
        span.removeAttribute('data-math-content'); // Odstraníme data atribut
    });

    // 6. Přidání TTS tlačítka
    if (ttsText) {
        const ttsButton = document.createElement('button');
        ttsButton.className = 'tts-listen-btn btn-tooltip';
        ttsButton.title = 'Přečíst nahlas';
        ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
        ttsButton.dataset.textToSpeak = ttsText;
        chunkDiv.appendChild(ttsButton);
    }

    // 7. Přidání do DOMu a scroll
    container.appendChild(chunkDiv);
    container.scrollTop = container.scrollHeight;

    // 8. Explicitní spuštění MathJax pro nově přidaný element
    if (window.MathJax && window.MathJax.startup) {
        console.log("[MathJax v3.9.6] Queueing typesetting for new whiteboard chunk...");
        window.MathJax.startup.promise.then(() => {
            if (typeof window.MathJax.typesetPromise === 'function') {
                 console.log("[MathJax v3.9.6] MathJax ready, typesetting chunk:", chunkDiv);
                 window.MathJax.typesetPromise([chunkDiv]) // Cílíme na nový chunk
                     .then(() => {
                         console.log("[MathJax v3.9.6] Typesetting complete for new chunk.");
                     }).catch((err) => {
                         console.error('[MathJax v3.9.6] Error typesetting chunk:', err);
                     });
            } else {
                 console.error("[MathJax v3.9.6] typesetPromise function not found after startup.");
            }
        }).catch(err => console.error("MathJax startup promise failed:", err));
    } else {
        console.warn("MathJax or MathJax.startup not available for new chunk.");
    }

    // 9. Uložení do historie (původní markdown)
    state.boardContentHistory.push(markdownContent);
    if (state.boardContentHistory.length > 7) { state.boardContentHistory.shift(); }

    console.log("Appended content to whiteboard and queued MathJax typesetting (v3.9.6).");
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

// Funkce renderMarkdown zde není exportována

console.log("Whiteboard controller module loaded (v3.9.6 with span pre-processing for MathJax).");