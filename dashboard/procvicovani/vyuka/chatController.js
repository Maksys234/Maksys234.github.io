// chatController.js - Управление логикой и интерфейсом чата

import { ui } from './ui.js';
import { state } from './state.js';
import { speakText } from './speechService.js';
import { saveChatMessage, deleteChatSessionHistory } from './supabaseService.js'; // Импорт для сохранения/удаления
// import { sendToGemini } from './geminiService.js'; // Импорт sendToGemini будет нужен в vyukaApp.js
import { renderMarkdown } from './whiteboardController.js'; // Для рендеринга Markdown в сообщениях
// Функции из utils.js (после его создания)
import { getInitials, formatTimestamp, sanitizeHTML, initTooltips, autoResizeTextarea } from './utils.js';
// Либо импортировать из ui.js, если они там
// import { initTooltips, autoResizeTextarea } from './ui.js';

// Загрузка html2pdf (предполагаем, что загружен глобально через <script>)
// Если используете npm: import html2pdf from 'html2pdf.js';


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
    const avatarText = sender === 'user' ? getInitials(state.currentProfile, state.currentUser?.email) : 'AI'; // Используем getInitials из utils

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
    renderMarkdown(textContentSpan, message); // Рендерим Markdown внутри span
    bubbleContentDiv.appendChild(textContentSpan);

    // Добавляем кнопку TTS для сообщений Gemini, если поддерживается
    if (sender === 'gemini' && state.speechSynthesisSupported) {
        const textForSpeech = ttsText || message; // Используем специальный текст или основной
        const ttsButton = document.createElement('button');
        ttsButton.className = 'tts-listen-btn btn-tooltip';
        ttsButton.title = 'Poslechnout';
        ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
        ttsButton.dataset.textToSpeak = textForSpeech; // Сохраняем текст в data-атрибут
        ttsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            speakText(textForSpeech); // Вызываем speakText из speechService
        });
        bubbleContentDiv.appendChild(ttsButton);
    }

    bubbleDiv.appendChild(bubbleContentDiv); // Добавляем контент в бабл

    const timeHTML = `<div class="message-timestamp">${formatTimestamp(timestamp)}</div>`; // Используем formatTimestamp из utils

    // Собираем полное сообщение
    messageDiv.innerHTML = avatarHTML + bubbleDiv.outerHTML + timeHTML;

    // Удаляем начальное сообщение, если оно есть
    const emptyState = ui.chatMessages.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    // Добавляем сообщение в DOM и прокручиваем
    ui.chatMessages.appendChild(messageDiv);
    // Плавная прокрутка к новому сообщению
     messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });

    // Инициализация тултипов для новой кнопки TTS
     // initTooltips(); // Вызывать из основного модуля после обновления DOM

    // Сохранение в БД (используем функцию из supabaseService)
    if (saveToDb && state.supabase && state.currentUser && state.currentTopic && state.currentSessionId) {
        const messageData = {
            user_id: state.currentUser.id,
            session_id: state.currentSessionId,
            topic_id: state.currentTopic.topic_id,
            topic_name: state.currentTopic.name,
            role: sender === 'gemini' ? 'model' : 'user',
            content: message
        };
        const saved = await saveChatMessage(messageData);
        if (!saved) {
             console.warn("Failed to save chat message to DB.");
            // Можно показать toast из основного модуля
            // showToast("Chyba ukládání chatu.", "error");
        }
    }
}

/**
 * Обновляет визуальное состояние чата (индикатор загрузки, активность кнопок).
 * Эта функция может быть перемещена в основной модуль, если она влияет на другие части UI.
 * @param {boolean} isThinking - Думает ли ИИ.
 */
export function updateGeminiThinkingState(isThinking) {
    state.geminiIsThinking = isThinking;
    // setLoadingState('chat', isThinking); // Вызывать из основного модуля

    ui.aiAvatarCorner?.classList.toggle('thinking', isThinking);
    if (!isThinking) {
        ui.aiAvatarCorner?.classList.remove('speaking');
    }

    if (isThinking) {
        addThinkingIndicator();
    } else {
        removeThinkingIndicator();
    }

    // Управление состоянием кнопок чата
    // manageButtonStates(); // Вызывать из основного модуля
}

/**
 * Добавляет индикатор "AI думает..." в чат.
 */
export function addThinkingIndicator() {
    if (state.thinkingIndicatorId || !ui.chatMessages) return;

    const id = `thinking-${Date.now()}`;
    const div = document.createElement('div');
    div.className = 'chat-message model'; // Стиль как у сообщения от AI
    div.id = id;
    div.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-thinking-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        </div>`;

    const emptyState = ui.chatMessages.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    ui.chatMessages.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
    state.thinkingIndicatorId = id;
}

/**
 * Удаляет индикатор "AI думает..." из чата.
 */
export function removeThinkingIndicator() {
    if (state.thinkingIndicatorId) {
        const indicator = document.getElementById(state.thinkingIndicatorId);
        indicator?.remove();
        state.thinkingIndicatorId = null;
    }
}

/**
 * Обрабатывает отправку сообщения пользователем.
 * Примечание: Эта функция теперь НЕ вызывает sendToGemini напрямую.
 * Она должна вернуть текст для отправки, а основной модуль вызовет sendToGemini.
 * @returns {string|null} Текст сообщения для отправки или null, если отправка невозможна.
 */
export function prepareUserMessageForSend() {
    const text = ui.chatInput?.value.trim();
    if (!text || state.geminiIsThinking || !state.currentTopic || state.isListening) {
        console.log("Cannot send message:", { text, thinking: state.geminiIsThinking, topic: !!state.currentTopic, listening: state.isListening });
        return null; // Невозможно отправить
    }

    // Очистка поля ввода и изменение размера
    if (ui.chatInput) {
        ui.chatInput.value = '';
        autoResizeTextarea(); // Используем утилиту
    }

    // Добавляем сообщение пользователя в UI и контекст Gemini
    addChatMessage(text, 'user'); // Сохранение в БД происходит внутри addChatMessage
    state.geminiChatContext.push({ role: "user", parts: [{ text }] });

    console.log("User message prepared for sending:", text);
    return text; // Возвращаем текст для отправки через Gemini Service
}

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
    // showToast("Historie chatu vymazána.", "info"); // Уведомление лучше показать из основного модуля

    // Удаляем историю из БД
    if (state.currentUser && state.currentSessionId) {
        const deleted = await deleteChatSessionHistory(state.currentUser.id, state.currentSessionId);
        if (!deleted) {
             console.warn("Failed to delete chat history from DB.");
            // showToast("Chyba při mazání historie chatu z databáze.", "error");
        }
    }
}

/**
 * Сохраняет текущую историю чата в PDF файл.
 */
export async function saveChatToPDF() {
    if (!ui.chatMessages || ui.chatMessages.children.length === 0 || (ui.chatMessages.children.length === 1 && ui.chatMessages.querySelector('.empty-state'))) {
        // showToast("Není co uložit.", "warning");
        console.warn("saveChatToPDF: No messages to save.");
        return;
    }
    if (typeof html2pdf === 'undefined') {
        // showToast("Chyba: PDF knihovna nenalezena.", "error");
        console.error("saveChatToPDF: html2pdf library not found.");
        return;
    }

    // showToast("Generuji PDF...", "info", 4000); // Уведомление лучше показать из основного модуля
    console.log("Generating PDF...");

    const elementToExport = document.createElement('div');
    // Стили для PDF (можно вынести в CSS файл и загружать, но для простоты здесь)
    elementToExport.innerHTML = `
        <style>
            body { font-family: 'Poppins', sans-serif; font-size: 10pt; line-height: 1.5; color: #333; }
            .chat-message { margin-bottom: 12px; max-width: 90%; page-break-inside: avoid; display: flex; gap: 8px; }
            .user { margin-left: 10%; flex-direction: row-reverse; }
            .model { margin-right: 10%; }
            .message-avatar { display: inline-block; width: 30px; height: 30px; border-radius: 50%; background-color: #eee; color: #555; text-align: center; line-height: 30px; font-weight: bold; font-size: 0.8em; margin-bottom: 5px; flex-shrink: 0;}
            .user .message-avatar { background-color: #d1e7dd; }
            .model .message-avatar { background-color: #cfe2ff; }
            .message-bubble { display: inline-block; padding: 8px 14px; border-radius: 15px; background-color: #e9ecef; max-width: calc(100% - 40px); }
            .user .message-bubble { background-color: #d1e7dd; border-bottom-right-radius: 5px;}
            .model .message-bubble { background-color: #cfe2ff; border-bottom-left-radius: 5px;}
            .message-timestamp { font-size: 8pt; color: #6c757d; margin-top: 4px; display: block; clear: both; }
            .user .message-timestamp { text-align: right; }
            .model .message-timestamp { text-align: left; }
            h1 { font-size: 16pt; color: #0d6efd; text-align: center; margin-bottom: 5px; }
            p.subtitle { font-size: 9pt; color: #6c757d; text-align: center; margin: 0 0 15px 0; }
            hr { border: 0; border-top: 1px solid #ccc; margin: 15px 0; }
            .tts-listen-btn { display: none; } /* Скрыть кнопки TTS */
            mjx-math { font-size: 1em; } /* Стили для MathJax */
            pre { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 0.8em; border-radius: 6px; overflow-x: auto; font-size: 0.9em; white-space: pre-wrap; word-wrap: break-word; }
            code { background-color: #e9ecef; padding: 0.1em 0.3em; border-radius: 3px; }
            pre code { background: none; padding: 0; }
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
            // Оставляем аватар для ясности
             // clone.querySelector('.message-avatar')?.remove();
            elementToExport.appendChild(clone);
        }
    });

    const filename = `chat-${state.currentTopic?.name?.replace(/[^a-z0-9]/gi, '_') || 'vyuka'}-${Date.now()}.pdf`;
    const pdfOptions = {
        margin: 15,
        filename: filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        await html2pdf().set(pdfOptions).from(elementToExport).save();
        // showToast("Chat uložen jako PDF!", "success"); // Уведомление из основного модуля
        console.log("PDF generated and saved.");
    } catch (e) {
        console.error("PDF Generation Error:", e);
        // showToast("Chyba při generování PDF.", "error"); // Уведомление из основного модуля
    }
}


console.log("Chat controller module loaded.");