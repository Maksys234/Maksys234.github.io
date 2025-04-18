// uiHelpers.js - Вспомогательные функции для управления UI, не привязанные напрямую к DOM-кэшу

import { ui } from './ui.js';
import { state } from './state.js'; // Нужен для updateTheme
import { sanitizeHTML } from './utils.js'; // Нужен для showToast/showError
import { TOAST_DEFAULT_DURATION } from './config.js';

/**
 * Отображает всплывающее уведомление (toast).
 * @param {string} title - Заголовок уведомления (может быть пустым).
 * @param {string} message - Текст сообщения.
 * @param {'info' | 'success' | 'warning' | 'error'} [type='info'] - Тип уведомления.
 * @param {number} [duration=TOAST_DEFAULT_DURATION] - Длительность показа (мс).
 */
export function showToast(title, message, type = 'info', duration = TOAST_DEFAULT_DURATION) {
    if (!ui.toastContainer) return;
    try {
        const toastId = `toast-${Date.now()}`;
        const toastElement = document.createElement('div');
        toastElement.className = `toast ${type}`;
        toastElement.id = toastId;
        toastElement.setAttribute('role', 'alert');
        toastElement.setAttribute('aria-live', 'assertive');
        toastElement.innerHTML = `
            <i class="toast-icon"></i>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${sanitizeHTML(title)}</div>` : ''}
                <div class="toast-message">${sanitizeHTML(message)}</div>
            </div>
            <button type="button" class="toast-close" aria-label="Zavřít">&times;</button>
        `;
        const icon = toastElement.querySelector('.toast-icon');
        icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`;
        toastElement.querySelector('.toast-close').addEventListener('click', () => {
            toastElement.classList.remove('show');
            setTimeout(() => toastElement.remove(), 400);
        });
        ui.toastContainer.appendChild(toastElement);
        requestAnimationFrame(() => { toastElement.classList.add('show'); });
        setTimeout(() => {
            if (toastElement.parentElement) {
                toastElement.classList.remove('show');
                setTimeout(() => toastElement.remove(), 400);
            }
        }, duration);
    } catch (e) {
        console.error("Chyba při zobrazování toastu:", e);
    }
}

/**
 * Отображает сообщение об ошибке (глобальное или toast).
 * @param {string} message - Сообщение об ошибке.
 * @param {boolean} [isGlobal=false] - Отобразить как глобальную ошибку?
 */
export function showError(message, isGlobal = false) {
    console.error("Došlo k chybě:", message);
    if (isGlobal && ui.globalError) {
        ui.globalError.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><div>${sanitizeHTML(message)}</div><button class="retry-button btn" onclick="location.reload()">Zkusit Znovu</button></div>`;
        ui.globalError.style.display = 'block';
    } else {
        showToast('CHYBA SYSTÉMU', message, 'error', 6000);
    }
}

/**
 * Скрывает глобальное сообщение об ошибке.
 */
export function hideError() {
    if (ui.globalError) ui.globalError.style.display = 'none';
}

/**
 * Устанавливает состояние загрузки для определенной секции.
 * @param {'currentTopic' | 'chat' | 'user' | 'notifications' | 'points' | 'all'} sectionKey - Ключ секции.
 * @param {boolean} isLoadingFlag - Флаг загрузки (true - загружается, false - нет).
 */
export function setLoadingState(sectionKey, isLoadingFlag) {
    if (state.isLoading[sectionKey] === isLoadingFlag && sectionKey !== 'all') return;

    if (sectionKey === 'all') {
        Object.keys(state.isLoading).forEach(key => state.isLoading[key] = isLoadingFlag);
    } else if (state.isLoading.hasOwnProperty(sectionKey)) {
        state.isLoading[sectionKey] = isLoadingFlag;
    } else {
        console.warn(`setLoadingState: Unknown section key '${sectionKey}'`);
        return;
    }

    console.log(`[SetLoading] ${sectionKey}: ${isLoadingFlag}`);

    // Специфичные для UI обновления, связанные с загрузкой
    // (можно расширить для других секций при необходимости)
    if (sectionKey === 'chat' || sectionKey === 'all') {
        // Логика для кнопок чата/поля ввода будет в manageButtonStates
    }
    if (sectionKey === 'currentTopic' || sectionKey === 'all') {
        if (ui.currentTopicDisplay) {
            if (isLoadingFlag) {
                ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám téma...</span>';
            }
            // Содержимое обновляется после загрузки в loadNextTopicFlow
        }
    }
     if (sectionKey === 'notifications' || sectionKey === 'all') {
          if (ui.notificationBell) {
             ui.notificationBell.style.opacity = isLoadingFlag ? 0.5 : 1;
         }
         if (ui.markAllReadBtn) {
             // Состояние кнопки обновляется в manageButtonStates или напрямую при клике
         }
     }

    // Вызов функции управления кнопками (должна быть в vyukaApp.js)
    // manageButtonStates(); // Эта функция должна быть доступна глобально или передана
}

/**
 * Обновляет тему (dark/light) на основе state.isDarkMode.
 */
export function updateTheme() {
    console.log("Updating theme, isDarkMode:", state.isDarkMode);
    document.documentElement.classList.toggle('dark', state.isDarkMode);
    document.documentElement.classList.toggle('light', !state.isDarkMode);
    // Обновление переменной CSS для подсветки на доске
    const highlightColor = state.isDarkMode ? 'var(--board-highlight-dark)' : 'var(--board-highlight-light)';
    document.documentElement.style.setProperty('--board-highlight-color', highlightColor);
}

console.log("UI Helpers module loaded.");