// whiteboardController.js - Управление содержимым "доски" (whiteboard)

import { ui } from './ui.js';
import { state } from './state.js';
import { speakText } from './speechService.js'; // Для кнопки TTS на доске
// ODSTRANĚN CHYBNÝ IMPORT Z ./ui.js - Funkce initTooltips je v utils.js

// Загрузка Marked.js (предполагаем, что он загружен глобально через <script>)
// Если используете npm: import { marked } from 'marked';

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
             gfm: true,    // Включить GitHub Flavored Markdown
             breaks: true, // Преобразовывать переводы строк в <br>
             // sanitize: false // Важно: НЕ ИСПОЛЬЗОВАТЬ в проде без внешнего DOMPurify! Оставим false, т.к. контент от доверенного AI.
         });

         // 1. Преобразуем Markdown в HTML
         const rawHtml = marked.parse(markdownText || '');
         // 2. Устанавливаем HTML в элемент
         element.innerHTML = rawHtml;

         // 3. Запускаем рендеринг MathJax *после* обновления DOM
         if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
             // Использовать setTimeout 0 для ожидания рендера браузера
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
    state.boardContentHistory = []; // Очищаем историю
    console.log("Whiteboard cleared.");
    // Vyvolání toastu by mělo být v uiHelpers nebo vyukaApp
    // if (showToastMsg) {
    //     showToast('Vymazáno', "Tabule vymazána.", "info"); // Toto by mělo být voláno z vyukaApp
    // }
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
    contentDiv.className = "chunk-content-wrapper"; // Přidán wrapper pro lepší layout s tlačítkem

    // 1. Renderujeme Markdown PŘED přidáním do DOM
    renderMarkdown(contentDiv, markdownContent);

    chunkDiv.appendChild(contentDiv); // Přidáme obsahový div

    // 2. Vytvoříme tlačítko TTS, pokud je podporováno
    if (state.speechSynthesisSupported) {
        const textForSpeech = commentaryText || markdownContent; // Použijeme komentář nebo samotný markdown
        const escapedText = textForSpeech.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        const ttsButton = document.createElement('button');
        ttsButton.className = 'tts-listen-btn btn-tooltip'; // Přidána třída btn-tooltip
        ttsButton.title = "Poslechnout komentář"; // Tooltip text
        ttsButton.setAttribute('aria-label', 'Poslechnout komentář');
        ttsButton.dataset.textToSpeak = escapedText;
        ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';

        // 3. Přidáme posluchač události na tlačítko
        ttsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const textToSpeak = e.currentTarget.dataset.textToSpeak;
            if (textToSpeak) {
                speakText(textToSpeak, chunkDiv); // Voláme speakText z speechService
            } else {
                console.warn("No text found for TTS button on whiteboard.");
            }
        });
        // Přidáme tlačítko do chunkDiv, ale vedle contentDiv
        chunkDiv.appendChild(ttsButton);
    }

    // 5. Přidáme element do DOM a proscrollujeme
    ui.whiteboardContent.appendChild(chunkDiv);
    state.boardContentHistory.push(markdownContent); // Uložíme do historie

    // Proscrollujeme k poslednímu elementu
    chunkDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });

    console.log("Appended content to whiteboard.");

    // Inicializace tooltipů se nyní volá z vyukaApp.js po této funkci
}

console.log("Whiteboard controller module loaded.");