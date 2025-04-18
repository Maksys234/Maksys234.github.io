// whiteboardController.js - Управление содержимым "доски" (whiteboard)

import { ui } from './ui.js';
import { state } from './state.js';
import { speakText } from './speechService.js'; // Для кнопки TTS на доске
import { initTooltips } from './ui.js'; // Или из отдельного utils модуля

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
    // Закомментируем вызов showToast, чтобы избежать зависимости от UI модуля здесь
    // if (showToastMsg) {
    //     showToast('Vymazáno', "Tabule vymazána.", "info");
    // }
}

/**
 * Добавляет новый блок контента на доску.
 * @param {string} markdownContent - Контент в формате Markdown для отображения.
 * @param {string} commentaryText - Текст для озвучивания (TTS). Если null, используется markdownContent.
 */
export function appendToWhiteboard(markdownContent, commentaryText) {
    if (!ui.whiteboardContent || !ui.whiteboardContainer) {
        console.warn("appendToWhiteboard: Whiteboard elements not found.");
        return;
    }

    const chunkDiv = document.createElement('div');
    chunkDiv.className = 'whiteboard-chunk';

    const contentDiv = document.createElement('div');
    // 1. Рендерим Markdown ПЕРЕД добавлением в DOM
    renderMarkdown(contentDiv, markdownContent);

    // 2. Создаем кнопку TTS, если TTS поддерживается
    let ttsButtonHTML = '';
    if (state.speechSynthesisSupported) {
        const textForSpeech = commentaryText || markdownContent; // Используем комментарий или сам markdown
         // Используем dataset для хранения текста, экранируем его для HTML атрибута
         const escapedText = textForSpeech.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        ttsButtonHTML = `
            <button class="tts-listen-btn btn-tooltip"
                    title="Poslechnout komentář"
                    aria-label="Poslechnout komentář"
                    data-text-to-speak="${escapedText}">
                <i class="fas fa-volume-up"></i>
            </button>
        `;
    }

    // 3. Собираем HTML для чанка
     // Добавляем кнопку TTS справа от контента
     chunkDiv.innerHTML = `
        <div class="chunk-content-wrapper">
            ${contentDiv.innerHTML}
        </div>
        ${ttsButtonHTML}
     `;


    // 4. Добавляем обработчик для кнопки TTS (если она есть) делегированием
    const ttsButton = chunkDiv.querySelector('.tts-listen-btn');
    if (ttsButton) {
        ttsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const textToSpeak = e.currentTarget.dataset.textToSpeak;
            if (textToSpeak) {
                speakText(textToSpeak, chunkDiv); // Вызываем speakText из speechService
            } else {
                console.warn("No text found for TTS button on whiteboard.");
            }
        });
    }

    // 5. Добавляем элемент в DOM и прокручиваем
    ui.whiteboardContent.appendChild(chunkDiv);
    state.boardContentHistory.push(markdownContent); // Сохраняем в историю
    // Прокрутка к последнему элементу
    chunkDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });

    console.log("Appended content to whiteboard.");
    // Инициализируем тултипы для новой кнопки
     // initTooltips(); // Вызывать из основного модуля после обновления DOM
}

console.log("Whiteboard controller module loaded.");