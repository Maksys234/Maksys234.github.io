// utils.js - Общие вспомогательные функции

import { state } from './state.js'; // state нужен для getInitials
import { ui } from './ui.js'; // ui нужен для autoResizeTextarea и updateOnlineStatus

/**
 * Экранирует HTML-строку для безопасного отображения.
 * @param {string} str - Входная строка.
 * @returns {string} Экранированная строка.
 */
export const sanitizeHTML = (str) => {
    const temp = document.createElement('div');
    temp.textContent = str || '';
    return temp.innerHTML;
};

/**
 * Получает инициалы пользователя из данных профиля или email.
 * @param {object|null} profileData - Объект с данными профиля.
 * @param {string|null} email - Email пользователя.
 * @returns {string} Инициалы (или '?').
 */
export const getInitials = (profileData, email) => {
    if (!profileData && !email) return '?';
    let initials = '';
    if (profileData?.first_name) initials += profileData.first_name[0];
    if (profileData?.last_name) initials += profileData.last_name[0];
    if (initials) return initials.toUpperCase();
    if (profileData?.username) return profileData.username[0].toUpperCase();
    if (email) return email[0].toUpperCase();
    return 'Pilot'; // Default to Pilot
};

/**
 * Форматирует дату/время в локальный формат времени (HH:MM).
 * @param {Date} [d=new Date()] - Объект Date.
 * @returns {string} Время в формате HH:MM.
 */
export const formatTimestamp = (d = new Date()) => {
    if (!(d instanceof Date) || isNaN(d.getTime())) {
        d = new Date(); // Fallback to current time if invalid date provided
    }
    return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Форматирует временную метку в относительное время (напр., "Před 5 min").
 * @param {string|Date|number} timestamp - Временная метка.
 * @returns {string} Относительное время или дата.
 */
export const formatRelativeTime = (timestamp) => {
     if (!timestamp) return '';
     try {
         const now = new Date();
         const date = new Date(timestamp);
         if (isNaN(date.getTime())) return '-'; // Невалидная дата

         const diffMs = now - date;
         const diffSec = Math.round(diffMs / 1000);
         const diffMin = Math.round(diffSec / 60);
         const diffHour = Math.round(diffMin / 60);
         const diffDay = Math.round(diffHour / 24);
         const diffWeek = Math.round(diffDay / 7);

         if (diffSec < 60) return 'Nyní';
         if (diffMin < 60) return `Před ${diffMin} min`;
         if (diffHour < 24) return `Před ${diffHour} hod`;
         if (diffDay === 1) return `Včera`;
         if (diffDay < 7) return `Před ${diffDay} dny`;
         if (diffWeek <= 4) return `Před ${diffWeek} týdny`;
         // Если больше месяца, показываем дату
         return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
     } catch (e) {
         console.error("Chyba formátování času:", e, "Timestamp:", timestamp);
         return '-';
     }
 };

/**
 * Автоматически изменяет высоту textarea в зависимости от контента.
 * @param {HTMLTextAreaElement} textareaElement - Prvek textarea pro změnu velikosti.
 */
export const autoResizeTextarea = (textareaElement) => {
    if (!textareaElement) return;
    const maxHeight = 110;
    textareaElement.style.height = 'auto';
    const scrollHeight = textareaElement.scrollHeight;
    textareaElement.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    textareaElement.style.overflowY = scrollHeight > maxHeight ? 'scroll' : 'hidden';
};

/**
 * Генерирует уникальный идентификатор сессии.
 * @returns {string} ID сессии.
 */
export const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

/**
 * Инициализирует всплывающие подсказки (Tooltips) с использованием Tooltipster.
 */
export const initTooltips = () => {
    try {
        if (window.jQuery && typeof window.jQuery.fn.tooltipster === 'function') {
            window.jQuery('.tooltipstered').tooltipster('destroy');
            window.jQuery('.btn-tooltip').tooltipster({
                theme: 'tooltipster-shadow',
                animation: 'fade',
                delay: 100,
                side: 'top'
            });
        } else {
             console.warn("jQuery or Tooltipster not loaded, tooltips disabled.");
        }
    } catch (e) {
        console.error("Tooltipster initialization error:", e);
    }
};

/**
 * Обновляет отображение баннера "Offline".
 */
export const updateOnlineStatus = () => {
    if (ui.offlineBanner) {
        ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block';
    }
    if (!navigator.onLine) {
         console.warn("Application is offline.");
    }
};

/**
 * Обновляет год в копирайте.
 */
export const updateCopyrightYear = () => {
    const year = new Date().getFullYear();
    if (ui.currentYearSidebar) ui.currentYearSidebar.textContent = year;
    if (ui.currentYearFooter) ui.currentYearFooter.textContent = year;
};

/**
 * Инициализирует эффект следования за мышью (декоративный).
 */
export const initMouseFollower = () => {
    const follower = ui.mouseFollower;
    if (!follower || window.innerWidth <= 576) return;

    let hasMoved = false;
    const updatePosition = (event) => {
        if (!hasMoved) {
            document.body.classList.add('mouse-has-moved');
            hasMoved = true;
        }
        requestAnimationFrame(() => {
            follower.style.left = `${event.clientX}px`;
            follower.style.top = `${event.clientY}px`;
        });
    };

    window.addEventListener('mousemove', updatePosition, { passive: true });
    document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; });
    document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; });
    window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true });
};

/**
 * Инициализирует анимации при прокрутке для элементов с атрибутом data-animate.
 */
export const initScrollAnimations = () => {
    const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]');
    if (!animatedElements.length || !('IntersectionObserver' in window)) {
        console.log("Scroll animations not initialized.");
        return;
    }

    const observer = new IntersectionObserver((entries, observerInstance) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                observerInstance.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });

    animatedElements.forEach(element => observer.observe(element));
    console.log(`Scroll animations initialized for ${animatedElements.length} elements.`);
};

/**
 * Добавляет/удаляет класс 'scrolled' к body при прокрутке основного контента.
 */
export const initHeaderScrollDetection = () => {
    let lastScrollY = 0;
    const mainEl = ui.mainContent;
    if (!mainEl) return;

    const handleScroll = () => {
         const currentScrollY = mainEl.scrollTop;
         document.body.classList.toggle('scrolled', currentScrollY > 10);
         lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
    };

    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    if (mainEl.scrollTop > 10) { document.body.classList.add('scrolled'); }
};

// --- PŘIDANÉ FUNKCE PRO MENU ---
/**
 * Otevře postranní menu (sidebar).
 */
export function openMenu() {
    if (ui.sidebar && ui.sidebarOverlay) {
        ui.sidebar.classList.add('active');
        ui.sidebarOverlay.classList.add('active');
    } else {
        console.warn("openMenu: Sidebar or overlay element not found.");
    }
}

/**
 * Zavře postranní menu (sidebar).
 */
export function closeMenu() {
    if (ui.sidebar && ui.sidebarOverlay) {
        ui.sidebar.classList.remove('active');
        ui.sidebarOverlay.classList.remove('active');
    } else {
         console.warn("closeMenu: Sidebar or overlay element not found.");
    }
}
// --- KONEC PŘIDANÝCH FUNKCÍ ---

console.log("Utils module loaded.");