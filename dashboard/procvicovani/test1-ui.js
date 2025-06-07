// Файл: test1-ui.js
// Содержит все функции для управления пользовательским интерфейсом (UI) на странице теста.
// Отвечает за отображение вопросов, результатов, уведомлений, таймера и других визуальных элементов.

(function(global) {
    'use strict';

    // Вспомогательные константы для UI
    const topicIcons = {
        "Algebra": "fa-square-root-alt", "Aritmetika": "fa-calculator", "Geometrie": "fa-draw-polygon",
        "Logika": "fa-brain", "Logické úlohy": "fa-brain", "Statistika": "fa-chart-bar",
        "Čísla a aritmetické operace": "fa-calculator", "Práce s daty": "fa-chart-bar",
        "Problémové úlohy": "fa-lightbulb", "Proporce a procenta": "fa-percentage",
        "default": "fa-book"
    };

    const activityVisuals = {
        test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' },
        badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' },
        lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' },
        level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' },
        default: { icon: 'fa-check-circle', class: 'default' }
    };

    const uiFunctions = {
        // Кэш для DOM-элементов, который будет заполнен из основного файла test1.js
        uiCache: {},

        // --- START: Утилиты для UI ---
        sanitizeHTML: function(str) {
            const temp = document.createElement('div');
            temp.textContent = str || '';
            return temp.innerHTML;
        },

        indexToLetter: function(index) {
            return String.fromCharCode(65 + index);
        },

        formatTime: function(seconds) {
            if (isNaN(seconds) || seconds < 0) return '--:--';
            const m = Math.floor(seconds / 60);
            const s = Math.round(seconds % 60);
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        },
        
        getInitials: function(profileData) {
            if (!profileData) return '?';
            const f = profileData.first_name?.[0] || '';
            const l = profileData.last_name?.[0] || '';
            const nameInitial = (f + l).toUpperCase();
            const usernameInitial = profileData.username?.[0].toUpperCase() || '';
            const emailInitial = profileData.email?.[0].toUpperCase() || '';
            return nameInitial || usernameInitial || emailInitial || '?';
        },

        formatRelativeTime: function(timestamp) {
            if (!timestamp) return '';
            try {
                const now = new Date();
                const date = new Date(timestamp);
                if (isNaN(date.getTime())) return '-';
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
                return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
            } catch (e) {
                console.error("Chyba formátování času:", e, "Timestamp:", timestamp);
                return '-';
            }
        },
        // --- END: Утилиты для UI ---

        // --- START: Toast & Error Handling ---
        showToast: function(title, message, type = 'info', duration = 4500) {
            const toastContainer = this.uiCache.toastContainer;
            if (!toastContainer) return;
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
                        ${title ? `<div class="toast-title">${this.sanitizeHTML(title)}</div>` : ''}
                        <div class="toast-message">${this.sanitizeHTML(message)}</div>
                    </div>
                    <button type="button" class="toast-close" aria-label="Zavřít">&times;</button>
                `;
                const icon = toastElement.querySelector('.toast-icon');
                icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`;
                toastElement.querySelector('.toast-close').addEventListener('click', () => {
                    toastElement.classList.remove('show');
                    setTimeout(() => toastElement.remove(), 400);
                });
                toastContainer.appendChild(toastElement);
                requestAnimationFrame(() => {
                    toastElement.classList.add('show');
                });
                setTimeout(() => {
                    if (toastElement.parentElement) {
                        toastElement.classList.remove('show');
                        setTimeout(() => toastElement.remove(), 400);
                    }
                }, duration);
            } catch (e) {
                console.error("Chyba při zobrazování toastu:", e);
            }
        },

        showErrorMessagePage: function(message, showRetryButton = true) {
            console.error("Error Page:", message);
            const ui = this.uiCache;
            if (ui.testSelector) ui.testSelector.style.display = 'none';
            if (ui.testContainer) ui.testContainer.style.display = 'none';
            if (ui.resultsContainer) ui.resultsContainer.style.display = 'none';
            if (ui.reviewContainer) ui.reviewContainer.style.display = 'none';
            if (ui.geminiOverlay) ui.geminiOverlay.style.display = 'none';
            if (ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'none';
            if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none';

            const retryButtonHTML = showRetryButton ? `<button class="btn btn-primary" style="margin-top:1.5rem;" onclick="location.reload()"><i class="fas fa-redo"></i> Zkusit znovu</button>` : '';
            const infoTitle = message.includes("Test již byl dokončen") || message.includes("Nejsou k dispozici žádné vhodné otázky") || message.includes("Otázky pro tento test budou brzy doplněny");

            if (ui.globalError) {
                ui.globalError.innerHTML = `<div class="error-message"><i class="fas ${infoTitle ? 'fa-info-circle' : 'fa-exclamation-triangle'}"></i><div>${this.sanitizeHTML(message)}</div>${retryButtonHTML}</div>`;
                ui.globalError.style.display = 'block';
            } else {
                 document.body.innerHTML = `<div style='padding: 2rem; color: ${infoTitle ? 'var(--text-light)' : 'red'}; text-align:center;'><h1>${infoTitle ? "Informace" : "Chyba"}</h1><p>${this.sanitizeHTML(message)}</p>${retryButtonHTML}</div>`;
            }
            if (ui.initialLoader && ui.initialLoader.style.display !== 'none') {
                ui.initialLoader.classList.add('hidden');
                setTimeout(() => {if(ui.initialLoader) ui.initialLoader.style.display = 'none';}, 300);
            }
        },

        hideError: function() {
            if (this.uiCache.globalError) this.uiCache.globalError.style.display = 'none';
        },
        // --- END: Toast & Error Handling ---

        // --- START: Sidebar & Main UI Management ---
        applyInitialSidebarState: function() {
            try {
                const stateValue = localStorage.getItem('sidebarCollapsedState');
                const isCurrentlyCollapsed = document.body.classList.contains('sidebar-collapsed');
                const shouldBeCollapsed = stateValue === 'collapsed';
                if (shouldBeCollapsed !== isCurrentlyCollapsed) {
                    document.body.classList.toggle('sidebar-collapsed', shouldBeCollapsed);
                }
                const icon = this.uiCache.sidebarToggleBtn?.querySelector('i');
                if (icon) {
                    icon.className = shouldBeCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
                }
                if(this.uiCache.sidebarToggleBtn) {
                    this.uiCache.sidebarToggleBtn.title = shouldBeCollapsed ? 'Rozbalit panel' : 'Sbalit panel';
                }
            } catch (e) {
                console.error("Chyba při aplikaci stavu postranního panelu:", e);
            }
        },

        toggleSidebar: function() {
            try {
                const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
                localStorage.setItem('sidebarCollapsedState', isCollapsed ? 'collapsed' : 'expanded');
                const icon = this.uiCache.sidebarToggleBtn?.querySelector('i');
                if (icon) {
                    icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
                }
                if(this.uiCache.sidebarToggleBtn) {
                    this.uiCache.sidebarToggleBtn.title = isCollapsed ? 'Rozbalit panel' : 'Sbalit panel';
                }
            } catch (error) {
                console.error("[ToggleSidebar] Chyba:", error);
            }
        },

        openMenu: function() {
            if (this.uiCache.sidebar && this.uiCache.sidebarOverlay) {
                document.body.classList.remove('sidebar-collapsed');
                this.uiCache.sidebar.classList.add('active');
                this.uiCache.sidebarOverlay.classList.add('active');
            }
        },

        closeMenu: function() {
            if (this.uiCache.sidebar && this.uiCache.sidebarOverlay) {
                this.uiCache.sidebar.classList.remove('active');
                this.uiCache.sidebarOverlay.classList.remove('active');
            }
        },

        updateUserInfoUI: function(currentUser, currentProfile, allTitles = []) {
            const ui = this.uiCache;
            if (!ui.sidebarName || !ui.sidebarAvatar || !ui.sidebarUserTitle) {
                console.warn("[UI Sidebar] Sidebar profile elements missing for full update.");
                return;
            }
            if (currentUser && currentProfile) {
                const displayName = `${currentProfile.first_name || ''} ${currentProfile.last_name || ''}`.trim() || currentProfile.username || currentUser.email?.split('@')[0] || 'Pilot';
                ui.sidebarName.textContent = this.sanitizeHTML(displayName);
                const initials = this.getInitials(currentProfile);
                let avatarUrl = currentProfile.avatar_url;
                if (avatarUrl && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))) {
                    avatarUrl += `?t=${new Date().getTime()}`;
                }
                ui.sidebarAvatar.innerHTML = avatarUrl ? `<img src="${this.sanitizeHTML(avatarUrl)}" alt="${this.sanitizeHTML(initials)}">` : this.sanitizeHTML(initials);
                const img = ui.sidebarAvatar.querySelector('img');
                if (img) {
                    img.onerror = () => {
                        console.warn(`[UI Sidebar] Failed to load avatar: ${img.src}. Showing initials.`);
                        ui.sidebarAvatar.innerHTML = this.sanitizeHTML(initials);
                    };
                }

                const selectedTitleKey = currentProfile.selected_title;
                let displayTitle = 'Pilot';
                if (selectedTitleKey && allTitles && allTitles.length > 0) {
                    const foundTitle = allTitles.find(t => t.title_key === selectedTitleKey);
                    if (foundTitle && foundTitle.name) {
                        displayTitle = foundTitle.name;
                    }
                }
                ui.sidebarUserTitle.textContent = this.sanitizeHTML(displayTitle);
                ui.sidebarUserTitle.setAttribute('title', this.sanitizeHTML(displayTitle));
            } else {
                ui.sidebarName.textContent = 'Nepřihlášen';
                ui.sidebarAvatar.textContent = '?';
                ui.sidebarUserTitle.textContent = 'Pilot';
                ui.sidebarUserTitle.removeAttribute('title');
            }
        },

        showGeminiOverlay: function(show) {
            if (this.uiCache.geminiOverlay) this.uiCache.geminiOverlay.style.display = show ? 'flex' : 'none';
        },
        // --- END: Sidebar & Main UI Management ---

        // --- START: Test-specific UI Functions ---
        updateTimer: function(testTime) {
            if (this.uiCache.timerValue) this.uiCache.timerValue.textContent = this.formatTime(testTime);
        },

        displayTestSelector: function(mandatoryTestIdentifier, testTypeConfig) {
            const ui = this.uiCache;
            if (ui.testSelector) ui.testSelector.style.display = 'block';
            if (ui.testContainer) ui.testContainer.style.display = 'none';
            if (ui.resultsContainer) ui.resultsContainer.style.display = 'none';
            if (ui.reviewContainer) ui.reviewContainer.style.display = 'none';
            if (ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'none';
            if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none';
            this.applyTestHighlightingAndSelection(mandatoryTestIdentifier, testTypeConfig);
        },

        applyTestHighlightingAndSelection: function(mandatoryTestIdentifier, testTypeConfig) {
            const ui = this.uiCache;
            let mandatoryTestKey = null;
            if (mandatoryTestIdentifier) {
                mandatoryTestKey = Object.keys(testTypeConfig).find(key => testTypeConfig[key].identifier === mandatoryTestIdentifier);
            }

            ui.testTypeCards.forEach(card => {
                const testType = card.dataset.testType;
                const config = testTypeConfig[testType];
                const buttonInCard = card.querySelector('.btn-start-test-in-card');
                const recommendedBadge = card.querySelector('.recommended-badge');
                card.classList.remove('recommended-test', 'disabled-test', 'selected');
                if (buttonInCard) buttonInCard.disabled = true;
                if (recommendedBadge) recommendedBadge.style.display = 'none';

                if (config) {
                    if (mandatoryTestKey === testType) {
                        card.classList.add('recommended-test', 'selected');
                        if (recommendedBadge) recommendedBadge.style.display = 'block';
                        if (buttonInCard) {
                            if (config.isActive === false) {
                                buttonInCard.innerHTML = '<i class="fas fa-hourglass-half"></i> Spustit Test (Brzy!)';
                                buttonInCard.disabled = true; // Still disabled
                            } else {
                                buttonInCard.innerHTML = `<i class="fas fa-play"></i> Spustit Test`;
                                buttonInCard.disabled = false;
                            }
                        }
                    } else {
                        card.classList.add('disabled-test');
                        if (buttonInCard) {
                            buttonInCard.innerHTML = '<i class="fas fa-times-circle"></i> Není určeno pro váš cíl';
                            buttonInCard.disabled = true;
                        }
                    }
                }
            });

            if (ui.startSelectedTestBtnGlobal) {
                if (mandatoryTestKey && testTypeConfig[mandatoryTestKey]) {
                    const config = testTypeConfig[mandatoryTestKey];
                    ui.startSelectedTestBtnGlobal.innerHTML = `<i class="fas fa-play-circle"></i> Spustit: ${config.title}`;
                    ui.startSelectedTestBtnGlobal.disabled = config.isActive === false;
                } else {
                    ui.startSelectedTestBtnGlobal.innerHTML = `<i class="fas fa-times-circle"></i> Nastavte cíl`;
                    ui.startSelectedTestBtnGlobal.disabled = true;
                }
            }
        },

        updateAdaptiveProgressBar: function(questionsAnswered, totalQuestionsInSession) {
            const ui = this.uiCache;
            if (!ui.progressBar || !ui.answeredCountEl) return;
            const progress = totalQuestionsInSession > 0 ? (questionsAnswered / totalQuestionsInSession) * 100 : 0;
            ui.progressBar.style.width = `${progress}%`;
            ui.answeredCountEl.textContent = questionsAnswered;
            if (ui.questionCountEl) ui.questionCountEl.textContent = `${Math.min(questionsAnswered + 1, totalQuestionsInSession)} / ${totalQuestionsInSession}`;
        },

        updateAdaptiveNavigationButtons: function(currentQuestion, questionsAnswered, totalQuestionsInSession, isLoading) {
            const ui = this.uiCache;
            const noQuestion = !currentQuestion;
            const isLastQuestionPlanned = questionsAnswered >= totalQuestionsInSession - 1;

            if (ui.prevBtn) ui.prevBtn.style.display = 'none';

            if (ui.nextBtn) {
                ui.nextBtn.disabled = noQuestion;
                ui.nextBtn.innerHTML = isLastQuestionPlanned ? 'Vyhodnotit poslední <i class="fas fa-flag-checkered"></i>' : 'Další otázka <i class="fas fa-arrow-right"></i>';
                ui.nextBtn.style.display = noQuestion ? 'none' : 'flex';
            }

            if (ui.skipBtn) {
                ui.skipBtn.style.display = noQuestion ? 'none' : 'flex';
                ui.skipBtn.disabled = noQuestion;
            }

            if (ui.finishBtn) {
                ui.finishBtn.style.display = 'flex';
                ui.finishBtn.disabled = isLoading.results;
                if (noQuestion) {
                    ui.finishBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Zpět na výběr';
                } else {
                    ui.finishBtn.innerHTML = isLoading.results ? '<i class="fas fa-spinner fa-spin"></i> Vyhodnocuji...' : '<i class="fas fa-check-circle"></i> Dokončit test';
                }
            }
        },

        displayReview: function() {
            // Complex function, implementation will be in test1.js
            console.warn("TestUI.displayReview is a placeholder. Main logic resides in test1.js");
        },

        updateSingleReviewItemUI: function() {
            // Complex function, implementation will be in test1.js
             console.warn("TestUI.updateSingleReviewItemUI is a placeholder. Main logic resides in test1.js");
        },
        
        renderNotifications: function(count, notifications) {
            console.log("[Render Notifications UI] Start, Count:", count, "Notifications:", notifications);
            const ui = this.uiCache;
            if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
                console.error("[Render Notifications UI] Missing UI elements.");
                return;
            }
            ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
            ui.notificationCount.classList.toggle('visible', count > 0);

            if (notifications && notifications.length > 0) {
                ui.notificationsList.innerHTML = notifications.map(n => {
                    const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default;
                    const isReadClass = n.is_read ? 'is-read' : '';
                    const linkAttr = n.link ? `data-link="${this.sanitizeHTML(n.link)}"` : '';
                    return `
                        <div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>
                            ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
                            <div class="notification-icon ${visual.class}">
                                <i class="fas ${visual.icon}"></i>
                            </div>
                            <div class="notification-content">
                                <div class="notification-title">${this.sanitizeHTML(n.title)}</div>
                                <div class="notification-message">${this.sanitizeHTML(n.message)}</div>
                                <div class="notification-time">${this.formatRelativeTime(n.created_at)}</div>
                            </div>
                        </div>`;
                }).join('');
                ui.noNotificationsMsg.style.display = 'none';
                ui.notificationsList.style.display = 'block';
                ui.markAllReadBtn.disabled = count === 0;
            } else {
                ui.notificationsList.innerHTML = '';
                ui.noNotificationsMsg.style.display = 'block';
                ui.notificationsList.style.display = 'none';
                ui.markAllReadBtn.disabled = true;
            }
            console.log("[Render Notifications UI] Finished rendering.");
        },

        renderNotificationSkeletons: function(count = 2) {
            const ui = this.uiCache;
            if (!ui.notificationsList || !ui.noNotificationsMsg) return;
            let skeletonHTML = '';
            for (let i = 0; i < count; i++) {
                skeletonHTML += `
                    <div class="notification-item skeleton">
                        <div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div>
                        <div class="notification-content">
                            <div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div>
                            <div class="skeleton" style="height: 12px; width: 90%;"></div>
                            <div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div>
                        </div>
                    </div>`;
            }
            ui.notificationsList.innerHTML = skeletonHTML;
            ui.noNotificationsMsg.style.display = 'none';
            ui.notificationsList.style.display = 'block';
        }
    };

    // This makes the uiFunctions object available globally as window.TestUI
    global.TestUI = uiFunctions;
    console.log("test1-ui.js loaded and TestUI object exposed.");

})(window);