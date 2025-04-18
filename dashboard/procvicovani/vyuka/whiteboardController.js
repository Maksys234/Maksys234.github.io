// whiteboardController.js - Управление содержимым "доски" (whiteboard)

import { ui } from './ui.js'; // Import DOM elementů je v pořádku
import { state } from './state.js'; // Import stavu je v pořádku
import { speakText } from './speechService.js'; // Import pro TTS je v pořádku

// !!! UJISTĚTE SE, ŽE ZDE NENÍ ŽÁDNÝ import { initTooltips } from './ui.js'; !!!
// Funkce initTooltips je v utils.js a volá se z vyukaApp.js

/**
 * Рендерит Markdown в указанный HTML-элемент с поддержкой MathJax.
 * @param {HTMLElement} element - Целевой элемент для рендеринга.
 * @param {string} markdownText - Текст в формате Markdown.
 */
export function renderMarkdown(element, markdownText) {
    if (!element) {
        console.error("renderMarkdown: Target element not provided.");
        return;
    }
    if (typeof marked === 'undefined') {
        console.error("renderMarkdown: Marked library is not loaded.");
        element.textContent = 'Chyba: Knihovna Marked není načtena.';
        return;
    }

    try {
        marked.setOptions({
            gfm: true,
            breaks: true,
        });
        const rawHtml = marked.parse(markdownText || '');
        element.innerHTML = rawHtml;

        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            setTimeout(() => {
                window.MathJax.typesetPromise([element])
                    .catch(err => console.error("MathJax typesetting error:", err));
            }, 0);
        } else if (!window.MathJax) {
             console.warn("renderMarkdown: MathJax is not available for typesetting.");
        }

    } catch (error) {
        console.error("Markdown rendering error:", error);
        element.innerHTML = `<p style="color:var(--accent-pink);">Chyba při renderování Markdown.</p>`;
    }
}

/**
 * Очищает содержимое доски и историю.
 * @param {boolean} showToastMsg - Показывать ли уведомление об очистке.
 */
export function clearWhiteboard(showToastMsg = true) {
    if (!ui.whiteboardContent) {
        console.warn("clearWhiteboard: Whiteboard content element not found.");
        return;
    }
    ui.whiteboardContent.innerHTML = '';
    state.boardContentHistory = [];
    console.log("Whiteboard cleared.");
    // Toast se volá z vyukaApp
}

/**
 * Добавляет новый блок контента на доску.
 * @param {string} markdownContent - Контент в формате Markdown для отображения.
 * @param {string|null} commentaryText - Текст для озвучивания (TTS). Если null, используется markdownContent.
 */
export function appendToWhiteboard(markdownContent, commentaryText) {
    if (!ui.whiteboardContent || !ui.whiteboardContainer) {
        console.warn("appendToWhiteboard: Whiteboard elements not found.");
        return;
    }

    const chunkDiv = document.createElement('div');
    chunkDiv.className = 'whiteboard-chunk';

    const contentDiv = document.createElement('div');
    contentDiv.className = "chunk-content-wrapper";

    renderMarkdown(contentDiv, markdownContent);
    chunkDiv.appendChild(contentDiv);

    if (state.speechSynthesisSupported) {
        const textForSpeech = commentaryText || markdownContent;
        const escapedText = textForSpeech.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const ttsButton = document.createElement('button');
        ttsButton.className = 'tts-listen-btn btn-tooltip';
        ttsButton.title = "Poslechnout komentář";
        ttsButton.setAttribute('aria-label', 'Poslechnout komentář');
        ttsButton.dataset.textToSpeak = escapedText;
        ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
        ttsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const textToSpeak = e.currentTarget.dataset.textToSpeak;
            if (textToSpeak) {
                speakText(textToSpeak, chunkDiv);
            } else {
                console.warn("No text found for TTS button on whiteboard.");
            }
        });
        chunkDiv.appendChild(ttsButton);
    }

    ui.whiteboardContent.appendChild(chunkDiv);
    state.boardContentHistory.push(markdownContent);
    chunkDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
    console.log("Appended content to whiteboard.");
    // Tooltipy se inicializují ve vyukaApp.js
}

console.log("Whiteboard controller module loaded (Version without initTooltips import)."); // Přidána poznámka pro ověření