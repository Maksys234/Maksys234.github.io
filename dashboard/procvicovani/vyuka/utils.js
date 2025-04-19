// utils.js - Общие вспомогательные функции
// Verze 3.9.6: Upravena sanitizeHTML pro lepší podporu MathJax s DOMPurify

import { state } from './state.js'; // state нужен для getInitials
import { ui } from './ui.js'; // ui нужен для autoResizeTextarea и updateOnlineStatus
// Import DOMPurify (assuming it's available globally or via import map/module)
// If using modules, you might need: import DOMPurify from 'dompurify';
// Make sure DOMPurify library is included in your HTML or build process.
// <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.8/purify.min.js"></script>

/**
 * Sanitizes an HTML string using DOMPurify to prevent XSS attacks,
 * configured to allow MathJax elements and necessary HTML tags.
 * @param {string} dirtyHtml - The potentially unsafe HTML string.
 * @param {object} [configOverrides={}] - Optional DOMPurify configuration overrides.
 * @returns {string} The sanitized HTML string.
 */
export function sanitizeHTML(dirtyHtml, configOverrides = {}) {
    // Check if DOMPurify is available
    if (typeof DOMPurify === 'undefined' || typeof DOMPurify.sanitize !== 'function') {
        console.warn("DOMPurify library not loaded. Falling back to basic text escaping.");
        const temp = document.createElement('div');
        temp.textContent = dirtyHtml || '';
        return temp.innerHTML; // Basic escaping as fallback
    }

    // Default configuration allowing common formatting and MathJax elements
    const defaultConfig = {
        USE_PROFILES: { html: true }, // Allows common HTML tags like p, strong, em, ul, ol, li, etc.
        ADD_TAGS: [ // Explicitly allow MathJax wrapper elements and common math tags
            'math', 'maction', 'maligngroup', 'malignmark', 'menclose', 'merror',
            'mfenced', 'mfrac', 'mi', 'mlabeledtr', 'mmultiscripts', 'mn', 'mo', 'mover', 'mpadded',
            'mphantom', 'mroot', 'mrow', 'ms', 'mspace', 'msqrt', 'mstyle', 'msub',
            'msubsup', 'msup', 'mtable', 'mtd', 'mtext', 'mtr', 'munder', 'munderover',
            'semantics', 'annotation', // MathML tags
            'mjx-container', 'mjx-assistive-mml', 'mjx-math' // MathJax v3 specific elements
            // Add other tags if needed (e.g., 'br', 'hr', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td')
        ],
        ADD_ATTR: [ // Allow common MathJax attributes and basic HTML attributes
            'class', 'id', 'style', // Common HTML
            'xmlns', 'display', 'href', 'mathvariant', 'mathsize', 'mathcolor', // MathML / MathJax
            'mathbackground', 'encoding', 'definitionURL', 'accent', 'accentunder', // More MathML
            'align', 'rowalign', 'columnalign', 'groupalign', 'alignmentscope', // Table related
            'columnspan', 'rowspan', 'columnlines', 'rowlines', 'frame', 'framespacing',
            'equalrows', 'equalcolumns', 'displaystyle', 'scriptlevel', 'width', 'height',
            'data-mathml' // Potentially used by MathJax
            // Add 'src' for images if you use them in markdown that needs sanitizing
        ],
        // KEEP_CONTENT: true, // Might be too permissive, use ADD_TAGS/ADD_ATTR carefully
        // SAFE_FOR_TEMPLATES: true, // Can help with frameworks, might slightly change output
        ALLOW_UNKNOWN_PROTOCOLS: true, // Can help if MathJax uses custom protocols (unlikely but possible)
        RETURN_DOM: false, // Ensure it returns a string
        RETURN_DOM_FRAGMENT: false
    };

    // Merge default config with overrides
    const finalConfig = { ...defaultConfig, ...configOverrides };

    try {
        // Sanitize the input HTML
        const cleanHtml = DOMPurify.sanitize(dirtyHtml || '', finalConfig);
        // console.log("Sanitized HTML:", cleanHtml); // DEBUG: See the sanitized output
        return cleanHtml;
    } catch (error) {
        console.error("DOMPurify sanitization failed:", error);
        // Fallback to basic escaping on error
        const temp = document.createElement('div');
        temp.textContent = dirtyHtml || '';
        return temp.innerHTML;
    }
}


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
    const maxHeight = 110; // Define max height (adjust as needed)
    textareaElement.style.height = 'auto'; // Reset height to recalculate scrollHeight
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
        // Destroy existing tooltips first to avoid duplicates
        if (window.jQuery && typeof window.jQuery.fn.tooltipster === 'function') {
            // Check if elements still exist before destroying
             window.jQuery('.tooltipstered').each(function() {
                if (document.body.contains(this)) {
                    try {
                       window.jQuery(this).tooltipster('destroy');
                    } catch(e) {
                        console.warn("Could not destroy tooltipster instance for element:", this, e);
                    }
                }
            });
            // Initialize new tooltips
            window.jQuery('.btn-tooltip').tooltipster({
                theme: 'tooltipster-shadow', // Assuming theme.css defines this
                animation: 'fade',
                delay: 150, // Slightly longer delay
                distance: 6,
                side: 'top'
            });
            // console.log("[Tooltips] Initialized."); // Can be noisy
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
         // Optionally show a toast message (import showToast if needed)
         // showToast('Offline', 'Spojení bylo ztraceno.', 'warning');
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
    if (!follower || window.innerWidth <= 576) return; // Не показывать на мобильных

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
    // Скрыть при касании
    window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true });
};

/**
 * Инициализирует анимации при прокрутке для элементов с атрибутом data-animate.
 */
export const initScrollAnimations = () => {
    const animatedElements = document.querySelectorAll('.main-content-wrapper [data-animate]');
    if (!animatedElements.length || !('IntersectionObserver' in window)) {
        // console.log("Scroll animations not initialized."); // Too noisy
        return;
    }

    const observer = new IntersectionObserver((entries, observerInstance) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                observerInstance.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }); // Trigger slightly earlier

    animatedElements.forEach(element => observer.observe(element));
    // console.log(`Scroll animations initialized for ${animatedElements.length} elements.`); // Too noisy
};

/**
 * Добавляет/удаляет класс 'scrolled' к body при прокрутке основного контента.
 */
export const initHeaderScrollDetection = () => {
    let lastScrollY = 0;
    const mainEl = ui.mainContent; // Scroll within main content area
    if (!mainEl) return;

    const handleScroll = () => {
         const currentScrollY = mainEl.scrollTop;
         // Add 'scrolled' class if scrolled more than 10px
         document.body.classList.toggle('scrolled', currentScrollY > 10);
         lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; // For Mobile or negative scrolling
    };

    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check in case the page loads scrolled
    if (mainEl.scrollTop > 10) {
        document.body.classList.add('scrolled');
    }
};

// --- ADDED EXPORTS for openMenu and closeMenu ---
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
// --- END OF ADDED EXPORTS ---

console.log("Utils module loaded (v3.9.6 with MathJax sanitize config).");