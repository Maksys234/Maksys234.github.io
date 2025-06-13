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
        // Кэш для DOM-элементов
        uiCache: {},

        // Функция для поиска и сохранения всех элементов страницы
        cacheDOMElements: function() {
            this.uiCache = {
                sidebarAvatar: document.getElementById('sidebar-avatar'),
                sidebarName: document.getElementById('sidebar-name'),
                sidebarUserTitle: document.getElementById('sidebar-user-title'),
                initialLoader: document.getElementById('initial-loader'),
                sidebarOverlay: document.getElementById('sidebar-overlay'),
                geminiOverlay: document.getElementById('gemini-checking-overlay'),
                mainContent: document.getElementById('main-content'),
                sidebar: document.getElementById('sidebar'),
                mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
                sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
                sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
                dashboardHeader: document.querySelector('.dashboard-header'),
                testSubject: document.getElementById('test-subject'),
                testLevel: document.getElementById('test-level'),
                testTimer: document.getElementById('test-timer'),
                timerValue: document.getElementById('timer-value'),
                notificationBell: document.getElementById('notification-bell'),
                notificationCount: document.getElementById('notification-count'),
                notificationsDropdown: document.getElementById('notifications-dropdown'),
                notificationsList: document.getElementById('notifications-list'),
                noNotificationsMsg: document.getElementById('no-notifications-msg'),
                markAllReadBtn: document.getElementById('mark-all-read-btn'),
                testSelector: document.getElementById('test-selector'),
                testLoader: document.getElementById('test-loader'),
                loaderSubtext: document.getElementById('loader-subtext'),
                testContainer: document.getElementById('test-container'),
                resultsContainer: document.getElementById('results-container'),
                reviewContainer: document.getElementById('review-container'),
                currentTestTitle: document.getElementById('current-test-title'),
                questionCountEl: document.getElementById('question-count'),
                answeredCountEl: document.getElementById('answered-count'),
                progressBar: document.getElementById('progress-bar'),
                questionContainer: document.getElementById('question-container'),
                pagination: document.getElementById('pagination'),
                prevBtn: document.getElementById('prev-btn'),
                nextBtn: document.getElementById('next-btn'),
                skipBtn: document.getElementById('skip-btn'),
                finishBtn: document.getElementById('finish-btn'),
                resultScoreEl: document.getElementById('result-score'),
                resultPercentageEl: document.getElementById('result-percentage'),
                resultCorrectEl: document.getElementById('result-correct'),
                resultIncorrectEl: document.getElementById('result-incorrect'),
                resultTimeEl: document.getElementById('result-time'),
                topicResultsEl: document.getElementById('topic-results'),
                retryBtn: document.getElementById('retry-btn'),
                reviewAnswersBtn: document.getElementById('review-answers-btn'),
                continueBtn: document.getElementById('continue-btn'),
                lowScoreMessageContainer: document.getElementById('low-score-message-container'),
                reviewContent: document.getElementById('review-content'),
                backToResultsBtn: document.getElementById('back-to-results-btn'),
                testTypeCards: document.querySelectorAll('.test-type-card'),
                startSelectedTestBtnGlobal: document.getElementById('start-selected-test-btn'),
                toastContainer: document.getElementById('toast-container'),
                globalError: document.getElementById('global-error'),
                offlineBanner: document.getElementById('offline-banner'),
                mouseFollower: document.getElementById('mouse-follower'),
                currentYearSidebar: document.getElementById('currentYearSidebar'),
                currentYearFooter: document.getElementById('currentYearFooter'),
                reviewItemTemplate: document.getElementById('review-item-template'),
                completedTestSummaryContainer: document.getElementById('completed-test-summary-container'),
                completedTestTitleSummary: document.getElementById('completed-test-title-summary'),
                summaryScore: document.getElementById('summary-score'),
                summaryPercentage: document.getElementById('summary-percentage'),
                summaryCorrect: document.getElementById('summary-correct'),
                summaryIncorrect: document.getElementById('summary-incorrect'),
                summaryTime: document.getElementById('summary-time'),
                summaryReviewAnswersBtn: document.getElementById('summary-review-answers-btn'),
                reinforcementTestsSection: document.getElementById('reinforcement-tests-section')
            };
            console.log("[CACHE DOM test1-ui.js] Caching complete.");
        },

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

        formatDate: function(dateString) {
            if (!dateString) return '-';
            try {
                const d = new Date(dateString);
                if (isNaN(d.getTime())) return '-';
                return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
            } catch (e) {
                return '-';
            }
        },

        initTooltips: function() {
            try {
                if (window.jQuery?.fn.tooltipster) {
                    window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({
                        theme: 'tooltipster-shadow',
                        animation: 'fade',
                        delay: 100,
                        side: 'top'
                    });
                }
            } catch (e) {
                console.error("Chyba inicializace Tooltipster:", e);
            }
        },

        updateCopyrightYear: function() {
            const year = new Date().getFullYear();
            if (this.uiCache.currentYearFooter) this.uiCache.currentYearFooter.textContent = year;
            if (this.uiCache.currentYearSidebar) this.uiCache.currentYearSidebar.textContent = year;
        },

        initMouseFollower: function() {
            const follower = this.uiCache.mouseFollower;
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
        },

        initScrollAnimations: function() {
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
        },

        initHeaderScrollDetection: function() {
            let lastScrollY = window.scrollY;
            const mainEl = this.uiCache.mainContent;
            if (!mainEl) return;
            mainEl.addEventListener('scroll', () => {
                const currentScrollY = mainEl.scrollTop;
                document.body.classList.toggle('scrolled', currentScrollY > 10);
                lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
            }, { passive: true });
            if (mainEl.scrollTop > 10) document.body.classList.add('scrolled');
        },

        updateOnlineStatus: function() {
            if (this.uiCache.offlineBanner) {
                this.uiCache.offlineBanner.style.display = navigator.onLine ? 'none' : 'block';
            }
            if (!navigator.onLine) {
                this.showToast('Offline', 'Spojení bylo ztraceno. Některé funkce nemusí být dostupné.', 'warning');
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

        applyTestHighlightingAndSelection: function(currentProfile, testTypeConfig) {
            const ui = this.uiCache;
            const userLearningGoal = currentProfile?.learning_goal;
            let mandatoryTestKey = null;

            if (userLearningGoal) {
                mandatoryTestKey = Object.keys(testTypeConfig).find(key => testTypeConfig[key].recommendedForGoal === userLearningGoal);
            }

            if (!mandatoryTestKey && userLearningGoal) {
                console.warn(`[Highlight] Pro cíl '${userLearningGoal}' nebyl nalezen žádný povinný test. Zobrazuji všechny jako neaktivní.`);
            } else if (!userLearningGoal) {
                console.warn(`[Highlight] Cíl uživatele není nastaven. Nelze určit povinný test. Zobrazuji všechny jako neaktivní.`);
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
                                buttonInCard.disabled = true;
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
                } else {
                    card.classList.add('disabled-test');
                    if (buttonInCard) {
                        buttonInCard.innerHTML = '<i class="fas fa-ban"></i> Test nedostupný';
                        buttonInCard.disabled = true;
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

        initializeAdaptiveTestUI: function(startTimerCallback, testTime, adaptiveTestState) {
            const ui = this.uiCache;
            if (!ui.testLoader || !ui.testContainer || !ui.resultsContainer || !ui.reviewContainer || !ui.testSelector || !ui.testTimer || !ui.pagination) {
                console.error("[InitializeAdaptiveTestUI] Critical UI elements missing for test initialization.");
                this.showErrorMessagePage("Chyba inicializace testu: Chybí komponenty uživatelského rozhraní.");
                return;
            }
            if (ui.testLoader) ui.testLoader.style.display = 'none';
            if (ui.testContainer) ui.testContainer.style.display = 'block';
            if (ui.resultsContainer) ui.resultsContainer.style.display = 'none';
            if (ui.reviewContainer) ui.reviewContainer.style.display = 'none';
            if (ui.testSelector) ui.testSelector.style.display = 'none';
            if (ui.completedTestSummaryContainer) ui.completedTestSummaryContainer.style.display = 'none';
            if (ui.reinforcementTestsSection) ui.reinforcementTestsSection.style.display = 'none';
            if (ui.testTimer) ui.testTimer.style.display = 'flex';

            if (adaptiveTestState.currentQuestion) {
                startTimerCallback();
            } else {
                // stopTimer() will be called from test1.js
                if(ui.timerValue) ui.timerValue.textContent = this.formatTime(0);
                if (ui.questionContainer) {
                     const noQuestionsMessage = "Pro tento test nejsou k dispozici žádné vhodné otázky. Zkuste prosím jiný test nebo kontaktujte podporu.";
                     ui.questionContainer.innerHTML = `<div class="empty-state" style="display:flex; flex-direction:column; align-items:center; padding: 2rem; border: 1px dashed var(--border-color-medium); border-radius: var(--card-radius);"><i class="fas fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem; color: var(--accent-secondary);"></i><h3>Žádné otázky</h3><p>${noQuestionsMessage}</p></div>`;
                }
            }

            if(ui.timerValue && adaptiveTestState.currentQuestion) ui.timerValue.textContent = this.formatTime(testTime);
            if(ui.answeredCountEl) ui.answeredCountEl.textContent = '0';
            if(ui.lowScoreMessageContainer) ui.lowScoreMessageContainer.innerHTML = '';

            ui.pagination.innerHTML = '';

            this.updateAdaptiveProgressBar(adaptiveTestState.questionsAnswered, adaptiveTestState.totalQuestionsInSession);
            this.updateAdaptiveNavigationButtons(adaptiveTestState.currentQuestion, adaptiveTestState.questionsAnswered, adaptiveTestState.totalQuestionsInSession, {results: false});

            if (ui.testContainer) {
                ui.testContainer.setAttribute('data-animate', '');
                ui.testContainer.style.setProperty('--animation-order', 0);
            }
        },

        showNextAdaptiveQuestion: function(adaptiveTestState, saveCurrentAnswerCallback) {
            const question = adaptiveTestState.currentQuestion;
            const currentQuestionIndex = adaptiveTestState.questionsAnswered;
            const ui = this.uiCache;

            if (!ui.questionContainer) { console.error("[ShowNextAdaptiveQuestion] Question container not found."); return; }
            if (!question) {
                // This case is handled in test1.js
                console.log("[ShowNextAdaptiveQuestion] No more questions. Test should finish.");
                return;
            }

            if(ui.questionCountEl) ui.questionCountEl.textContent = `${adaptiveTestState.questionsAnswered + 1} / ${adaptiveTestState.totalQuestionsInSession}`;

            let questionHTML = `<div class="question-header"><span class="question-number">${adaptiveTestState.questionsAnswered + 1}</span><div class="question-text">${this.sanitizeHTML(question.question_text)}</div></div>`;
            if (question.image_url) { questionHTML += `<div class="question-image-container"><img class="question-image" src="${question.image_url}" alt="Obrázek k otázce ${adaptiveTestState.questionsAnswered + 1}" loading="lazy"></div>`; }

            let answerInputHTML = '';
            switch (question.question_type) {
                case 'multiple_choice':
                    answerInputHTML += `<div class="answer-options">`;
                    question.options.forEach((optionText, idx) => {
                        const optionLetter = this.indexToLetter(idx);
                        answerInputHTML += `<label class="answer-option" data-option-id="${optionLetter}"><input type="radio" name="question_${question.id}" value="${optionLetter}" style="display: none;"><div class="answer-text"><span class="answer-letter">${optionLetter}.</span> ${this.sanitizeHTML(optionText)}</div></label>`;
                    });
                    answerInputHTML += `</div>`;
                    break;
                case 'numeric':
                case 'text':
                case 'ano_ne':
                    let prefixData = null;
                    let suffixData = question.answer_suffix || null;
                    let isMultiPart = false;
                    let multiPartKeys = [];
                    if (question.answer_prefix && typeof question.answer_prefix === 'string') {
                        try {
                            const parsedPrefix = JSON.parse(question.answer_prefix);
                            if (typeof parsedPrefix === 'object' && parsedPrefix !== null && !Array.isArray(parsedPrefix)) {
                                prefixData = parsedPrefix;
                                isMultiPart = true;
                                multiPartKeys = Object.keys(prefixData);
                            } else {
                                prefixData = question.answer_prefix;
                            }
                        } catch (e) {
                            prefixData = question.answer_prefix;
                        }
                    } else if (question.answer_prefix && typeof question.answer_prefix === 'object' && !Array.isArray(question.answer_prefix)) {
                        prefixData = question.answer_prefix;
                        isMultiPart = true;
                        multiPartKeys = Object.keys(prefixData);
                    } else if (question.answer_prefix) {
                        prefixData = String(question.answer_prefix);
                    }

                    answerInputHTML += `<div class="answer-input-container">`;
                    if (isMultiPart && multiPartKeys.length > 0) {
                        answerInputHTML += `<label class="form-label">Vaše odpovědi:</label>`;
                        multiPartKeys.forEach(partKey => {
                            const partPrefixText = prefixData[partKey] || '';
                            answerInputHTML += `<div class="answer-input-group multi-part-answer-group">`;
                            if (partPrefixText) {
                                answerInputHTML += `<span class="answer-prefix">${this.sanitizeHTML(partPrefixText)}</span>`;
                            }
                            answerInputHTML += `<input type="${question.question_type === 'numeric' ? 'number' : 'text'}" id="text-answer-${currentQuestionIndex}-part-${partKey}" class="answer-input multi-part-input" data-part-key="${partKey}" placeholder="Odpověď pro ${partKey}" value="">`;
                            answerInputHTML += `</div>`;
                        });
                    } else {
                        answerInputHTML += `<label for="text-answer-${currentQuestionIndex}" class="form-label">Vaše odpověď:</label>`;
                        answerInputHTML += `<div class="answer-input-group">`;
                        if (prefixData && typeof prefixData === 'string') {
                            answerInputHTML += `<span class="answer-prefix">${this.sanitizeHTML(prefixData)}</span>`;
                        }
                        answerInputHTML += `<input type="${question.question_type === 'numeric' ? 'number' : 'text'}" id="text-answer-${currentQuestionIndex}" class="answer-input" placeholder="Zadejte odpověď" value="">`;
                        if (suffixData) {
                            answerInputHTML += `<span class="answer-suffix">${this.sanitizeHTML(suffixData)}</span>`;
                        }
                        answerInputHTML += `</div>`;
                    }
                    answerInputHTML += `</div>`;
                    break;
                case 'construction':
                    answerInputHTML += `<div class="answer-input-container"><label for="construction-answer-${currentQuestionIndex}" class="form-label">Popište svůj postup:</label><textarea id="construction-answer-${currentQuestionIndex}" class="construction-textarea" placeholder="Podrobně popište kroky..."></textarea></div>`;
                    break;
                default:
                    answerInputHTML += `<div class="answer-input-container"><label for="text-answer-${currentQuestionIndex}" class="form-label">Vaše odpověď:</label><div class="answer-input-group"><input type="text" id="text-answer-${currentQuestionIndex}" class="answer-input" placeholder="Zadejte odpověď" value=""></div></div>`;
                    break;
            }

            questionHTML += answerInputHTML;
            ui.questionContainer.innerHTML = questionHTML;

            const textInputs = ui.questionContainer.querySelectorAll('.answer-input');
            textInputs.forEach(input => { input.addEventListener('input', (event) => saveCurrentAnswerCallback(event)); });
            ui.questionContainer.querySelectorAll('.answer-option').forEach(label => {
                label.addEventListener('click', (event) => {
                    const selectedLabel = event.currentTarget;
                    const optionId = selectedLabel.dataset.optionId;
                    const radio = selectedLabel.querySelector('input[type="radio"]');
                    ui.questionContainer.querySelectorAll('.answer-option').forEach(l => l.classList.remove('selected'));
                    selectedLabel.classList.add('selected');
                    if (radio) radio.checked = true;
                    saveCurrentAnswerCallback(optionId);
                });
            });

            if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
                try {
                    setTimeout(() => {
                        window.MathJax.typesetPromise([ui.questionContainer]).catch(e => console.error("MathJax typesetting error:", e));
                    }, 0);
                } catch (e) {
                    console.error("MathJax initialization error:", e);
                }
            }
        },

        updateAdaptiveProgressBar: function(questionsAnswered, totalQuestionsInSession) {
            const ui = this.uiCache;
            if (!ui.progressBar || !ui.answeredCountEl) return;
            const progress = totalQuestionsInSession > 0 ? (questionsAnswered / totalQuestionsInSession) * 100 : 0;
            ui.progressBar.style.width = `${progress}%`;
            ui.answeredCountEl.textContent = questionsAnswered;
            if(ui.questionCountEl) ui.questionCountEl.textContent = `${Math.min(questionsAnswered + 1, totalQuestionsInSession)} / ${totalQuestionsInSession}`;
        },

        updateAdaptiveNavigationButtons: function(currentQuestion, questionsAnswered, totalQuestionsInSession, isLoading) {
            const ui = this.uiCache;
            const noQuestion = !currentQuestion;
            const isLastQuestionPlanned = questionsAnswered >= totalQuestionsInSession - 1;

            if (ui.prevBtn) ui.prevBtn.style.display = 'none';

            if(ui.nextBtn) {
                ui.nextBtn.disabled = noQuestion;
                ui.nextBtn.innerHTML = isLastQuestionPlanned ? 'Vyhodnotit poslední <i class="fas fa-flag-checkered"></i>' : 'Další otázka <i class="fas fa-arrow-right"></i>';
                ui.nextBtn.style.display = noQuestion ? 'none' : 'flex';
            }

            if(ui.skipBtn) {
                ui.skipBtn.style.display = noQuestion ? 'none' : 'flex';
                ui.skipBtn.disabled = noQuestion;
            }

            if(ui.finishBtn) {
                ui.finishBtn.style.display = 'flex';
                ui.finishBtn.disabled = isLoading.results;
                if (noQuestion) {
                    ui.finishBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Zpět na výběr';
                } else {
                    ui.finishBtn.innerHTML = isLoading.results ? '<i class="fas fa-spinner fa-spin"></i> Vyhodnocuji...' : '<i class="fas fa-check-circle"></i> Dokončit test';
                }
            }
        },

        displayResults: function(testResultsData, testTime, selectedTestType, testTypeConfig) {
            const ui = this.uiCache;
            if(!ui.testContainer || !ui.resultsContainer || !ui.reviewContainer || !ui.testTimer || !ui.testLevel || !ui.resultScoreEl || !ui.resultPercentageEl || !ui.resultCorrectEl || !ui.resultIncorrectEl || !ui.resultTimeEl || !ui.lowScoreMessageContainer || !ui.continueBtn || !ui.topicResultsEl || !ui.reviewAnswersBtn || !ui.backToResultsBtn) {
                console.error("Chyba: Některé elementy výsledků nebyly nalezeny v DOM.");
                return;
            }
            if (!testResultsData) {
                console.error("Chyba: Chybí data výsledků (testResultsData).");
                this.showErrorMessagePage("Nepodařilo se zobrazit výsledky - chybí data.");
                return;
            }

            ui.testContainer.style.display = 'none';
            ui.resultsContainer.style.display = 'block';
            ui.reviewContainer.style.display = 'none';
            ui.testTimer.style.display = 'none';
            if(ui.testLevel) ui.testLevel.textContent = 'Výsledky testu';

            if(ui.resultScoreEl) ui.resultScoreEl.textContent = `${testResultsData.score}/${testResultsData.maxScore}`;
            if(ui.resultPercentageEl) ui.resultPercentageEl.textContent = `${testResultsData.percentage}%`;
            if(ui.resultCorrectEl) ui.resultCorrectEl.textContent = testResultsData.correctAnswers;
            if(ui.resultIncorrectEl) ui.resultIncorrectEl.textContent = testResultsData.incorrectAnswers + testResultsData.partiallyCorrectAnswers;
            if(ui.resultTimeEl) ui.resultTimeEl.textContent = this.formatTime(testTime);

            ui.lowScoreMessageContainer.innerHTML = '';
            ui.continueBtn.disabled = true;

            const saveError = ui.continueBtn.getAttribute('data-save-error') === 'true';
            const scoreThreshold = window.TestLogic?.SCORE_THRESHOLD_FOR_SAVING ?? 5;

            if (saveError) {
                ui.lowScoreMessageContainer.innerHTML = `<div class="error-message-container"><i class="fas fa-exclamation-triangle"></i><div class="loader-text">Chyba ukládání</div><div class="loader-subtext">Nepodařilo se uložit výsledky testu. Studijní plán nelze vytvořit.</div></div>`;
            } else if (testResultsData.score < scoreThreshold) {
                ui.lowScoreMessageContainer.innerHTML = `<div class="low-score-message warning"><i class="fas fa-exclamation-circle"></i><strong>Výsledek nebyl uložen.</strong><br>Vaše skóre (${testResultsData.score}/${testResultsData.maxScore}) je nižší než ${scoreThreshold} bodů. Tyto výsledky nebudou použity pro generování studijního plánu.</div>`;
            } else {
                ui.lowScoreMessageContainer.innerHTML = `<div class="low-score-message info"><i class="fas fa-info-circle"></i><strong>Výsledky byly uloženy.</strong><br>Vaše skóre (${testResultsData.score}/${testResultsData.maxScore}) bude použito pro studijní plán.</div>`;
                ui.continueBtn.disabled = false;
            }

            const sortedTopics = Object.values(testResultsData.topicResults || {}).sort((a, b) => a.score_percent - b.score_percent);
            ui.topicResultsEl.innerHTML = sortedTopics.map(stats => {
                const icon = topicIcons[stats.name] || topicIcons.default;
                return `
                <div class="topic-card card ${stats.strength}">
                    <div class="topic-header">
                        <div class="topic-icon"><i class="fas ${icon}"></i></div>
                        <h3 class="topic-title">${this.sanitizeHTML(stats.name)}</h3>
                    </div>
                    <div class="topic-stats">
                        <div class="topic-progress">
                            <span class="topic-progress-label">Úspěšnost (body)</span>
                            <span class="topic-progress-value">${stats.score_percent}%</span>
                        </div>
                        <div class="topic-progress-bar">
                            <div class="topic-progress-fill" style="width: ${stats.score_percent}%;"></div>
                        </div>
                        <div class="topic-progress" style="margin-top: 0.5rem;">
                            <span class="topic-progress-label">Body</span>
                            <span class="topic-progress-value">${stats.points_achieved} / ${stats.max_points}</span>
                        </div>
                        <div class="topic-progress" style="margin-top: 0.1rem; font-size: 0.8em;">
                            <span class="topic-progress-label">Správně otázek</span>
                            <span class="topic-progress-value">${stats.fully_correct} / ${stats.total_questions}</span>
                        </div>
                    </div>
                </div>`;
            }).join('');
        },

        renderNotificationSkeletons: function(count = 2) {
            const ui = this.uiCache;
            if (!ui.notificationsList || !ui.noNotificationsMsg) return;
            let skeletonHTML = '';
            for (let i = 0; i < count; i++) {
                skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`;
            }
            ui.notificationsList.innerHTML = skeletonHTML;
            ui.noNotificationsMsg.style.display = 'none';
            ui.notificationsList.style.display = 'block';
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
                        <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div>
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
        }
        // --- END: Test-specific UI Functions ---
    };

    // This makes the uiFunctions object available globally, for example, as window.TestUI
    global.TestUI = uiFunctions;
    console.log("test1-ui.js (v2) loaded and TestUI object exposed.");

})(window);