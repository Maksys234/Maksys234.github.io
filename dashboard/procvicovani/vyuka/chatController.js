// chatController.js - Управление логикой и интерфейсом чата (Без изменений v3.6)

import { ui } from './ui.js';
import { state } from './state.js';
import { speakText } from './speechService.js';
import { saveChatMessage, deleteChatSessionHistory } from './supabaseService.js'; // Импорт для сохранения/удаления
import { renderMarkdown } from './whiteboardController.js'; // Для рендеринга Markdown в сообщениях
import { getInitials, formatTimestamp, sanitizeHTML, initTooltips, autoResizeTextarea } from './utils.js';

// html2pdf предполагается загруженным глобально

/**
 * Добавляет сообщение в окно чата.
 * @param {string} message - Текст сообщения (может быть Markdown).
 * @param {'user' | 'gemini'} sender - Отправитель ('user' или 'gemini').
 * @param {boolean} [saveToDb=true] - Сохранять ли сообщение в БД.
 * @param {Date} [timestamp=new Date()] - Временная метка сообщения.
 * @param {string|null} [ttsText=null] - Текст для озвучивания (если отличается от message).
 */
export async function addChatMessage(message, sender, saveToDb = true, timestamp = new Date(), ttsText = null) {
    if (!ui.chatMessages) {
        console.error("addChatMessage: Chat messages container not found.");
        return;
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Убедимся, что данные пользователя доступны для инициалов
    let avatarText = 'AI';
    if (sender === 'user') {
        if (state.currentUser && state.currentProfile) {
            avatarText = getInitials(state.currentProfile, state.currentUser.email);
        } else {
            console.warn("addChatMessage: User profile data missing for avatar, using default.");
            avatarText = 'Vy'; // Стандартный текст аватара пользователя, если данных нет
        }
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`;
    messageDiv.id = messageId;

    const avatarHTML = `<div class="message-avatar">${avatarText}</div>`;

    // Создаем контейнер для бабла и его содержимого
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';

    const bubbleContentDiv = document.createElement('div');
    bubbleContentDiv.className = 'message-bubble-content';

    const textContentSpan = document.createElement('span');
    textContentSpan.className = 'message-text-content';
    // Обрабатываем потенциальные сообщения "?" - не отображаем их
    if (message && message.trim() !== '?') {
        renderMarkdown(textContentSpan, message); // Рендерим Markdown внутри span
    } else if (message && message.trim() === '?') {
        console.warn("addChatMessage: Received a message containing only '?'. Skipping render.");
        return; // Не добавляем сообщение, если это просто "?"
    } else {
        textContentSpan.textContent = "(Prázdná zpráva)"; // Обрабатываем пустые сообщения
    }

    bubbleContentDiv.appendChild(textContentSpan);

    // Добавляем кнопку TTS для сообщений Gemini, если поддерживается и сообщение не "?"
    if (sender === 'gemini' && state.speechSynthesisSupported && message && message.trim() !== '?') {
        const textForSpeech = ttsText || message; // Используем специальный текст или основной
        const ttsButton = document.createElement('button');
        ttsButton.className = 'tts-listen-btn btn-tooltip';
        ttsButton.title = 'Poslechnout';
        ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
        ttsButton.dataset.textToSpeak = textForSpeech; // Сохраняем текст в data-атрибут
        // Слушатель событий добавляется в vyukaApp.js через делегирование
        bubbleContentDiv.appendChild(ttsButton);
    }

    bubbleDiv.appendChild(bubbleContentDiv); // Добавляем контент в бабл

    const timeHTML = `<div class="message-timestamp">${formatTimestamp(timestamp)}</div>`;

    // Собираем полное сообщение
    // Сначала аватар, потом бабл, потом время (порядок важен для CSS)
    messageDiv.appendChild(document.createRange().createContextualFragment(avatarHTML)); // Вставляем HTML аватара
    messageDiv.appendChild(bubbleDiv); // Добавляем бабл
    messageDiv.appendChild(document.createRange().createContextualFragment(timeHTML)); // Вставляем HTML времени

    // Удаляем начальное сообщение/заглушку, если оно есть
    const emptyState = ui.chatMessages.querySelector('.empty-state, .initial-load-placeholder');
    if (emptyState) emptyState.remove();

    // Добавляем сообщение в DOM и прокручиваем
    ui.chatMessages.appendChild(messageDiv);
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });

    // Инициализация тултипов для новой кнопки TTS происходит в vyukaApp.js

    // Сохранение в БД (используем функцию из supabaseService)
    // Не сохраняем, если сообщение было просто "?"
    if (saveToDb && state.supabase && state.currentUser && state.currentTopic && state.currentSessionId && message && message.trim() !== '?') {
        const messageData = {
            user_id: state.currentUser.id,
            session_id: state.currentSessionId,
            topic_id: state.currentTopic.topic_id || null, // Добавляем topic_id если есть
            topic_name: state.currentTopic.name,
            role: sender === 'gemini' ? 'model' : 'user',
            content: message // Сохраняем оригинальное сообщение
        };
        const saved = await saveChatMessage(messageData);
        if (!saved) {
             console.warn("Failed to save chat message to DB.");
             // Уведомление об ошибке вызывается из vyukaApp
        }
    }
}


/**
 * Добавляет индикатор "AI думает..." в чат.
 */
export function addThinkingIndicator() {
    if (state.thinkingIndicatorId || !ui.chatMessages) return; // Не добавлять, если уже есть

    const id = `thinking-${Date.now()}`;
    const div = document.createElement('div');
    div.className = 'chat-message model'; // Стиль как у сообщения от AI
    div.id = id;
    // Используем createRange для безопасной вставки HTML
    const fragment = document.createRange().createContextualFragment(`
        <div class="message-avatar">AI</div>
        <div class="message-thinking-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        </div>`);
    div.appendChild(fragment);

    // Удаляем заглушку, если она есть
    const emptyState = ui.chatMessages.querySelector('.empty-state, .initial-load-placeholder');
    if (emptyState) emptyState.remove();

    ui.chatMessages.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
    state.thinkingIndicatorId = id; // Сохраняем ID индикатора
}

/**
 * Удаляет индикатор "AI думает..." из чата.
 */
export function removeThinkingIndicator() {
    if (state.thinkingIndicatorId) {
        const indicator = document.getElementById(state.thinkingIndicatorId);
        indicator?.remove(); // Безопасное удаление
        state.thinkingIndicatorId = null; // Сбрасываем ID
    }
}

// Функция prepareUserMessageForSend удалена, т.к. логика перенесена в handleSendMessage в vyukaApp.js

/**
 * Подтверждает и запускает очистку текущей сессии чата.
 */
export function confirmClearChat() {
    if (confirm("Opravdu vymazat historii této konverzace? Tato akce je nevratná.")) {
        clearCurrentChatSessionHistory();
    }
}

/**
 * Очищает историю сообщений текущей сессии чата в UI и (опционально) в БД.
 */
export async function clearCurrentChatSessionHistory() {
    if (ui.chatMessages) {
        ui.chatMessages.innerHTML = `<div class="empty-state"><i class="fas fa-comments"></i><h3>Chat vymazán</h3><p>Můžete začít novou konverzaci.</p></div>`;
    }
    state.geminiChatContext = []; // Очищаем контекст Gemini
    console.log("Chat history cleared locally.");
    // Уведомление вызывается из vyukaApp

    // Удаляем историю из БД
    if (state.currentUser && state.currentSessionId) {
        const deleted = await deleteChatSessionHistory(state.currentUser.id, state.currentSessionId);
        if (!deleted) {
             console.warn("Failed to delete chat history from DB.");
             // Уведомление об ошибке вызывается из vyukaApp
        }
    }
}

/**
 * Сохраняет текущую историю чата в PDF файл.
 */
export async function saveChatToPDF() {
    if (!ui.chatMessages || ui.chatMessages.children.length === 0 || (ui.chatMessages.children.length === 1 && ui.chatMessages.querySelector('.empty-state'))) {
        console.warn("saveChatToPDF: No messages to save.");
        // Уведомление вызывается из vyukaApp
        return;
    }
    if (typeof html2pdf === 'undefined') {
        console.error("saveChatToPDF: html2pdf library not found.");
         // Уведомление вызывается из vyukaApp
        return;
    }

    console.log("Generating PDF...");
    // Уведомление о начале генерации вызывается из vyukaApp

    const elementToExport = document.createElement('div');
    // Стили для PDF (можно вынести в CSS файл и загружать)
    elementToExport.innerHTML = `
        <style>
            body { font-family: 'DejaVu Sans', sans-serif; /* Use a font supporting Czech chars */ font-size: 10pt; line-height: 1.5; color: #333; }
            .chat-message { margin-bottom: 12px; max-width: 90%; page-break-inside: avoid; display: flex; gap: 8px; align-items: flex-end; }
            .user { margin-left: 10%; flex-direction: row-reverse; }
            .model { margin-right: 10%; }
            .message-avatar { display: inline-block; width: 30px; height: 30px; border-radius: 50%; background-color: #eee; color: #555; text-align: center; line-height: 30px; font-weight: bold; font-size: 0.8em; flex-shrink: 0; align-self: flex-start; }
            .user .message-avatar { background-color: #d1e7dd; }
            .model .message-avatar { background-color: #cfe2ff; }
            .message-bubble { display: flex; flex-direction: column; /* Changed to column */ padding: 8px 14px; border-radius: 15px; background-color: #e9ecef; width: 100%; /* Take full width within flex gap */ word-wrap: break-word; }
            .user .message-bubble { background-color: #d1e7dd; border-bottom-right-radius: 5px; align-items: flex-end; /* Align content right */ }
            .model .message-bubble { background-color: #cfe2ff; border-bottom-left-radius: 5px; align-items: flex-start; /* Align content left */ }
            .message-text-content { /* Takes full width */ }
            .message-timestamp { font-size: 8pt; color: #6c757d; margin-top: 4px; }
            /* Timestamp positioning handled by flex alignment of bubble */
            h1 { font-size: 16pt; color: #0d6efd; text-align: center; margin-bottom: 5px; }
            p.subtitle { font-size: 9pt; color: #6c757d; text-align: center; margin: 0 0 15px 0; }
            hr { border: 0; border-top: 1px solid #ccc; margin: 15px 0; }
            .tts-listen-btn { display: none; } /* Скрыть кнопки TTS */
            mjx-container { page-break-inside: avoid !important; } /* Avoid breaks inside math */
            mjx-math { font-size: 1em; }
            pre { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 0.8em; border-radius: 6px; overflow-x: auto; font-size: 0.9em; white-space: pre-wrap; word-wrap: break-word; page-break-inside: avoid !important; }
            code { background-color: #e9ecef; padding: 0.1em 0.3em; border-radius: 3px; font-family: 'DejaVu Sans Mono', monospace; }
            pre code { background: none; padding: 0; }
            /* Ensure block elements inside bubble span width */
            .message-text-content p, .message-text-content ul, .message-text-content ol, .message-text-content pre, .message-text-content blockquote, .message-text-content table { max-width: 100%; margin-bottom: 0.5em; }
            .message-text-content ul, .message-text-content ol { padding-left: 1.5em; }
        </style>
        <h1>Chat s AI Tutorem - ${sanitizeHTML(state.currentTopic?.name || 'Neznámé téma')}</h1>
        <p class="subtitle">Vygenerováno: ${new Date().toLocaleString('cs-CZ')}</p>
        <hr>`;

    // Клонируем сообщения для экспорта
    Array.from(ui.chatMessages.children).forEach(msgElement => {
        if (msgElement.classList.contains('chat-message') && !msgElement.id.startsWith('thinking-')) {
            const clone = msgElement.cloneNode(true);
            // Удаляем элементы, ненужные в PDF
            clone.querySelector('.tts-listen-btn')?.remove();
            // Извлекаем бабл и время из клона
            const bubbleClone = clone.querySelector('.message-bubble');
            const timestampClone = clone.querySelector('.message-timestamp');
            if (bubbleClone && timestampClone) {
                 // Перемещаем время внутрь бабла для лучшего контроля разрывов страниц
                 bubbleClone.appendChild(timestampClone);
            }
            elementToExport.appendChild(clone);
        }
    });

    const filename = `chat-${state.currentTopic?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'vyuka'}-${new Date().toISOString().slice(0,10)}.pdf`;
    const pdfOptions = {
        margin: [15, 10, 15, 10], // top, left, bottom, right
        filename: filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
             scale: 2,
             useCORS: true,
             logging: false,
             // Попытка улучшить рендеринг шрифтов и разрывы
             dpi: 192,
             letterRendering: true,
             allowTaint: true
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        // Добавляем pagebreak опции
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'], before: '.chat-message' }
    };

    try {
        // Сохраняем PDF
        await html2pdf().set(pdfOptions).from(elementToExport).save();
        console.log("PDF generated and saved.");
         // Уведомление об успехе вызывается из vyukaApp
    } catch (e) {
        console.error("PDF Generation Error:", e);
        // Уведомление об ошибке вызывается из vyukaApp
    }
}

// Эта функция может быть полезна для отладки, но в vyukaApp.js она не используется
/**
 * Обновляет визуальное состояние чата (индикатор загрузки).
 * Эта функция больше НЕ управляет состоянием кнопок.
 * @param {boolean} isThinking - Думает ли ИИ.
 */
export function updateGeminiThinkingStateVisual(isThinking) {
    // Управление состоянием state.geminiIsThinking происходит в vyukaApp.js
    if (isThinking) {
        addThinkingIndicator();
    } else {
        removeThinkingIndicator();
    }
    // Управление кнопками (manageButtonStates) вызывается из vyukaApp.js
}


console.log("Chat controller module loaded (v3.6).");