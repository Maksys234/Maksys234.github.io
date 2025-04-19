// chatController.js - Управление логикой и интерфейсом чата
// Verze 3.9.5: Používá marked.parse přímo, opravena chyba s renderMarkdown.

import { ui } from './ui.js';
import { state } from './state.js';
// import { speakText } from './speechService.js'; // Není voláno přímo odsud
import { saveChatMessage, deleteChatSessionHistory } from './supabaseService.js';
// Potřebujeme marked a sanitizeHTML
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import { sanitizeHTML, getInitials, formatTimestamp } from './utils.js';
// import { initTooltips } from './utils.js'; // Tultipy se inicializují v vyukaApp

// html2pdf предполагается загруженным глобально

// Konfigurace Marked.js pro chat (může být jiná než pro tabuli, pokud je potřeba)
marked.setOptions({
    gfm: true,
    breaks: true,
    sanitize: false // Sanitizaci děláme ručně
});

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

    let avatarText = 'AI';
    if (sender === 'user') {
        avatarText = (state.currentProfile && state.currentUser) ? getInitials(state.currentProfile, state.currentUser.email) : 'Vy';
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`;
    messageDiv.id = messageId;

    const avatarHTML = `<div class="message-avatar">${avatarText}</div>`;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';

    const bubbleContentDiv = document.createElement('div');
    bubbleContentDiv.className = 'message-bubble-content';

    const textContentSpan = document.createElement('span');
    textContentSpan.className = 'message-text-content'; // MathJax by se měl případně spouštět na #chat-messages

    // Zpracování zprávy: Použijeme marked.parse a sanitizeHTML přímo zde
    if (message && message.trim()) {
        try {
            // Použijeme marked.parse PŘÍMO na message string
            const rawHtml = marked.parse(message);
            // Sanitizace pro chat může být přísnější
            const cleanHtml = sanitizeHTML(rawHtml, {
                USE_PROFILES: { html: true },
                ALLOWED_TAGS: ['p', 'strong', 'em', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td'], // Povolit více tagů pro chat?
                ALLOWED_ATTR: [] // Obecně bezpečné nepovolit atributy
            });
            textContentSpan.innerHTML = cleanHtml;
        } catch (e) {
            console.error("Marked.parse error in chatController:", e);
            textContentSpan.textContent = message; // Fallback na čistý text při chybě
        }
    } else {
        console.warn("addChatMessage: Received empty or whitespace message. Rendering placeholder.");
        textContentSpan.textContent = "(Prázdná zpráva)";
    }

    bubbleContentDiv.appendChild(textContentSpan);

    // TTS tlačítko pro AI zprávy
    if (sender === 'gemini' && state.speechSynthesisSupported && message && message.trim()) {
        const textForSpeech = ttsText || message;
        const ttsButton = document.createElement('button');
        ttsButton.className = 'tts-listen-btn btn-tooltip';
        ttsButton.title = 'Poslechnout';
        ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
        ttsButton.dataset.textToSpeak = textForSpeech;
        // Listener je přidán v vyukaApp.js
        bubbleContentDiv.appendChild(ttsButton);
    }

    bubbleDiv.appendChild(bubbleContentDiv);

    const timeHTML = `<div class="message-timestamp">${formatTimestamp(timestamp)}</div>`;

    // Sestavení zprávy
    messageDiv.appendChild(document.createRange().createContextualFragment(avatarHTML));
    messageDiv.appendChild(bubbleDiv);
    messageDiv.appendChild(document.createRange().createContextualFragment(timeHTML));

    const emptyState = ui.chatMessages.querySelector('.empty-state, .initial-load-placeholder');
    if (emptyState) emptyState.remove();

    ui.chatMessages.appendChild(messageDiv);
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });

    // Tooltipy se inicializují v vyukaApp.js

    // Uložení do DB
    if (saveToDb && state.supabase && state.currentUser && state.currentTopic && state.currentSessionId && message && message.trim()) {
        const messageData = {
            user_id: state.currentUser.id,
            session_id: state.currentSessionId,
            topic_id: state.currentTopic.topic_id || null,
            topic_name: state.currentTopic.name,
            role: sender === 'gemini' ? 'model' : 'user',
            content: message // Uložit původní zprávu
        };
        saveChatMessage(messageData).catch(e => console.warn("Nepodařilo se uložit zprávu do DB:", e));
    }
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

    const fragment = document.createRange().createContextualFragment(`
        <div class="message-avatar">AI</div>
        <div class="message-thinking-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        </div>`);
    div.appendChild(fragment);

    const emptyState = ui.chatMessages.querySelector('.empty-state, .initial-load-placeholder');
    if (emptyState) emptyState.remove();

    ui.chatMessages.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
    state.thinkingIndicatorId = id; // Сохраняем ID индикатора
}

/**
 * Удаляет индикатор "AI думает..." из чата.
 * @returns {boolean} - Vrací true, pokud byl indikátor skutečně odstraněn.
 */
export function removeThinkingIndicator() {
    if (state.thinkingIndicatorId) {
        const indicator = document.getElementById(state.thinkingIndicatorId);
        if (indicator) {
            indicator.remove();
            state.thinkingIndicatorId = null;
            return true; // Indikátor byl odstraněn
        } else {
             console.warn("Thinking indicator ID existed but element not found in DOM:", state.thinkingIndicatorId);
             state.thinkingIndicatorId = null;
        }
    }
    return false; // Indikátor nebyl odstraněn (buď neexistoval ID, nebo element)
}


// Funkce confirmClearChat a saveChatToPDF již nejsou relevantní, protože tlačítka byla odstraněna
/* export function confirmClearChat() { ... } */
/* export async function clearCurrentChatSessionHistory() { ... } */
/* export async function saveChatToPDF() { ... } */


console.log("Chat controller module loaded (v3.9.5 using direct marked.parse).");