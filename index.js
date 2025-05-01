<script>
       // --- START: JavaScript v19 (Maximum Overdrive) ---

       // --- Вспомогательные Функции ---

       const toggleMenu = (forceClose = false) => { /* ... (код без изменений) ... */
           const hamburger = document.getElementById('hamburger');
           const navLinks = document.getElementById('navLinks');
           const menuOverlay = document.getElementById('menuOverlay');
           const body = document.body;
           if (!hamburger || !navLinks || !menuOverlay) { console.warn("Элементы мобильного меню не найдены."); return; }
           const isActive = navLinks.classList.contains('active');
           if (forceClose || isActive) {
               hamburger.classList.remove('active'); navLinks.classList.remove('active'); menuOverlay.classList.remove('active'); body.classList.remove('menu-open'); hamburger.setAttribute('aria-expanded', 'false');
           } else {
               hamburger.classList.add('active'); navLinks.classList.add('active'); menuOverlay.classList.add('active'); body.classList.add('menu-open'); hamburger.setAttribute('aria-expanded', 'true');
           }
       };

       const handleHeaderScroll = () => { /* ... (код без изменений, можно добавить логику hide/show) ... */
           const header = document.getElementById('header');
           if (!header) return;
           const currentScrollY = window.scrollY;
           if (currentScrollY > 50) { header.classList.add('scrolled'); } else { header.classList.remove('scrolled'); }
           // Optional: Hide header on scroll down
           // static let lastScrollY = 0; // Needs to be managed outside if used
           // if (currentScrollY > lastScrollY && currentScrollY > header.offsetHeight + 50) { header.classList.add('hidden'); } else { header.classList.remove('hidden'); }
           // lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
       };

       const initScrollAnimations = () => { /* ... (код без изменений, но теперь есть data-animate-timeline) ... */
           const animatedElements = document.querySelectorAll('[data-animate]');
           if (animatedElements.length && 'IntersectionObserver' in window) {
               const observer = new IntersectionObserver((entries, observerInstance) => {
                   entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animated'); observerInstance.unobserve(entry.target); } });
               }, { threshold: 0.1 });
               animatedElements.forEach(element => observer.observe(element));
           } else { animatedElements.forEach(element => element.classList.add('animated')); }
       };

        // NEW: Анимация таймлайна
        const initTimelineAnimation = () => {
            const timelineContainer = document.getElementById('timelineContainer');
            const timelineItems = document.querySelectorAll('[data-animate-timeline]');
            if (!timelineContainer || !timelineItems.length || !('IntersectionObserver' in window)) return;

            // Анимация линии
            const lineObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        timelineContainer.classList.add('in-view');
                    } else {
                         // Можно добавить сброс анимации при выходе из вида, если нужно
                         // timelineContainer.classList.remove('in-view');
                    }
                });
            }, { threshold: 0.2 }); // Запускать, когда 20% контейнера видно

            lineObserver.observe(timelineContainer);

            // Анимация элементов
            const itemObserver = new IntersectionObserver((entries, observerInstance) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('in-view');
                        observerInstance.unobserve(entry.target); // Анимировать один раз
                    }
                });
            }, { threshold: 0.5 }); // Запускать, когда 50% элемента видно

            timelineItems.forEach(item => itemObserver.observe(item));
        };

        // NEW: Анимация букв в заголовке
        const initLetterAnimation = () => {
            const elements = document.querySelectorAll('[data-animate-letters]');
            elements.forEach(element => {
                const text = element.textContent?.trim() ?? '';
                const highlightSpan = element.querySelector('.highlight');
                const highlightText = highlightSpan?.dataset.text ?? highlightSpan?.textContent?.trim() ?? '';

                let content = '';
                let charIndex = 0;

                // Обработка текста ДО span.highlight
                const textBeforeHighlight = text.substring(0, text.indexOf(highlightText));
                textBeforeHighlight.split('').forEach(char => {
                    if (char.trim()) { // Пропускаем пробелы
                        content += `<span class="char" style="--char-index:${charIndex};">${char}</span>`;
                        charIndex++;
                    } else { content += ' '; }
                });

                // Обработка span.highlight
                if (highlightSpan) {
                    content += `<span class="highlight" data-text="${highlightText}">`; // Оставляем highlight обертку
                    highlightText.split('<br>').forEach((line, lineIndex) => {
                        if(lineIndex > 0) content += '<br>'; // Сохраняем <br>
                         line.split('').forEach(char => {
                             if (char.trim()) {
                                 content += `<span class="char" style="--char-index:${charIndex};">${char}</span>`;
                                 charIndex++;
                             } else { content += ' '; }
                         });
                    });
                    content += `</span>`;
                }

                 // Обработка текста ПОСЛЕ span.highlight (если есть)
                const textAfterHighlight = text.substring(text.indexOf(highlightText) + highlightText.length);
                textAfterHighlight.split('').forEach(char => {
                    if (char.trim()) {
                        content += `<span class="char" style="--char-index:${charIndex};">${char}</span>`;
                        charIndex++;
                    } else { content += ' '; }
                });


                element.innerHTML = content;

                // Optional: Trigger glitch effect after letters revealed
                 const highlight = element.querySelector('.highlight');
                 if(highlight) {
                     setTimeout(() => {
                         highlight.classList.add('glitch-effect');
                         // Remove after some time if you want it temporary
                         setTimeout(() => highlight.classList.remove('glitch-effect'), 1500);
                     }, charIndex * 30 + 500); // Wait for letters + delay
                 }
            });
        };


       const handleSmoothScroll = (event) => { /* ... (код без изменений) ... */
            const link = event.target.closest('a[href^="#"]'); if (!link) return;
            const hrefAttribute = link.getAttribute('href');
            if (hrefAttribute && hrefAttribute.length > 1) {
                try {
                    const targetElement = document.querySelector(hrefAttribute);
                    if (targetElement) { event.preventDefault(); targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (link.closest('#navLinks.active')) { toggleMenu(true); } }
                } catch (error) { console.error(`Ошибка поиска элемента для селектора: ${hrefAttribute}`, error); }
            } else if (link.classList.contains('nav-item') && link.closest('#navLinks.active')) { toggleMenu(true); }
       };

       const updateCopyrightYear = () => { /* ... (код без изменений) ... */
            const currentYearSpan = document.getElementById('currentYear');
            if (currentYearSpan) { currentYearSpan.textContent = new Date().getFullYear(); }
       };

       const updateActiveNav = () => { /* ... (код без изменений) ... */
            const header = document.getElementById('header'); const navItems = document.querySelectorAll('#navLinks a.nav-item[href^="#"]'); const sections = document.querySelectorAll('section[id]');
            if (!navItems || !header || !sections) return;
            let currentSectionId = null; const scrollPosition = window.scrollY + header.offsetHeight + 50;
            sections.forEach(section => { if (section && typeof section.offsetTop === 'number') { if (scrollPosition >= section.offsetTop) { currentSectionId = section.id; } } });
            navItems.forEach(item => { item.classList.remove('active'); const itemHref = item.getAttribute('href'); if (itemHref && itemHref === `#${currentSectionId}`) { item.classList.add('active'); } });
       };

        const runAiDemo = () => { /* ... (Обновленная версия с доп. шагами и фейковым инпутом) ... */
            const aiDemoOutput = document.getElementById('ai-demo-output');
            const aiProgressBarElement = document.getElementById('ai-progress-bar');
            const aiProgressBarContainer = document.querySelector('.ai-progress-bar[role="progressbar"]');
            const aiFakeInput = document.getElementById('ai-fake-input'); // NEW

            if (!aiDemoOutput || !aiProgressBarElement || !aiProgressBarContainer || !aiFakeInput) {
                console.warn("Элементы AI демо не найдены."); return;
            }

            const demoSteps = [
                { text: { type: 'system', content: 'Initializing JX CORE v19...'}, delay: 300 },
                { progress: 5, delay: 200 },
                { text: { type: 'system', content: 'Neural link established. Ready for input.'}, delay: 500 },
                { progress: 10, delay: 150 },
                { text: { type: 'user', content: 'Problém: Najdi diskriminant: 2x² + 5x - 3 = 0'}, delay: 1200, fakeInput: true }, // Input this
                { progress: 15, delay: 200 },
                { text: { type: 'analysis', content: 'Query received. Analyzing quadratic equation...'}, delay: 600 },
                { progress: 30, delay: 300 },
                { text: { type: 'analysis', content: 'Identifikace: Kvadratická rovnice. Požadavek: Výpočet diskriminantu (D).'}, delay: 500 },
                { progress: 40, delay: 200 },
                { text: { type: 'ai', content: 'Vzorec pro diskriminant: D = b² - 4ac', typing: true }, delay: 900 },
                { progress: 50, delay: 200 },
                { text: { type: 'analysis', content: 'Parametry extrahovány: a=2, b=5, c=-3'}, delay: 400 },
                { progress: 60, delay: 300 },
                { text: { type: 'ai', content: 'Dosazení parametrů: D = (5)² - 4 * (2) * (-3)', typing: true }, delay: 1000 },
                { progress: 75, delay: 200 },
                { text: { type: 'ai', content: 'Výpočet: D = 25 - (-24) = 25 + 24', typing: true }, delay: 900 },
                { progress: 90, delay: 200 },
                { text: { type: 'ai', content: 'Finální výsledek: D = 49', typing: true }, delay: 600 },
                { progress: 100, delay: 300 },
                { text: { type: 'analysis', content: 'Úloha vyřešena. D > 0 => 2 reálné kořeny. Čekání na další příkaz...'}, delay: 1000 },
                { progress: 0, delay: 7000 } // Еще больше задержка
            ];
            let currentStepIndex = 0; let charIndex = 0; let typeInterval; let sequenceTimeout; let fakeInputTimeout;

            function sanitizeHTML(str) { /* ... (код без изменений) ... */
                 const temp = document.createElement('div'); temp.textContent = str; return temp.innerHTML.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            }

            function typeWriter(lineElement, text, speed = 45, onComplete) { /* Добавлен коллбэк */
                 const textContainer = lineElement?.querySelector('.text-content'); if (!textContainer) return;
                 if (charIndex < text.length) {
                      textContainer.innerHTML = sanitizeHTML(text.substring(0, charIndex + 1)) + '<span class="typing-cursor"></span>';
                      charIndex++; const currentSpeed = speed + (Math.random() * speed * 0.4 - speed * 0.2);
                      typeInterval = setTimeout(() => typeWriter(lineElement, text, speed, onComplete), currentSpeed);
                 } else {
                      textContainer.innerHTML = sanitizeHTML(text); clearTimeout(typeInterval);
                      if (onComplete) onComplete(); // Вызвать коллбэк
                      else scheduleNextStep();
                 }
             }

             // NEW: Печать в фейковый инпут
            function typeInFakeInput(text, speed = 60, onComplete) {
                 let currentInputChar = 0;
                 aiFakeInput.textContent = ''; // Очистить перед началом
                 clearTimeout(fakeInputTimeout);

                 function typeChar() {
                     if (currentInputChar < text.length) {
                         aiFakeInput.textContent += text[currentInputChar];
                         currentInputChar++;
                         fakeInputTimeout = setTimeout(typeChar, speed + (Math.random() * speed * 0.5 - speed * 0.25));
                     } else {
                         if (onComplete) onComplete();
                     }
                 }
                 typeChar();
             }


            function addDemoLine(lineData, onComplete) { /* Добавлен коллбэк */
                const lineElement = document.createElement('div'); lineElement.className = `ai-demo-line ${lineData.type || 'ai'}`; lineElement.style.opacity = '0';
                lineElement.innerHTML = `<span class="text-content"></span>`; aiDemoOutput.appendChild(lineElement);
                const isScrolledToBottom = aiDemoOutput.scrollHeight - aiDemoOutput.clientHeight <= aiDemoOutput.scrollTop + 10;
                if (isScrolledToBottom) { aiDemoOutput.scrollTop = aiDemoOutput.scrollHeight; }
                requestAnimationFrame(() => { lineElement.style.opacity = '1'; });
                if (lineData.typing) {
                    const textContainer = lineElement.querySelector('.text-content'); if(textContainer) textContainer.innerHTML = '<span class="typing-cursor"></span>';
                    charIndex = 0; clearTimeout(typeInterval);
                    setTimeout(() => typeWriter(lineElement, lineData.content, 45, onComplete), 150);
                } else {
                    const textContainer = lineElement.querySelector('.text-content'); if(textContainer) textContainer.textContent = lineData.content;
                    if (onComplete) onComplete(); // Вызвать коллбэк для непечатаемых строк
                    else scheduleNextStep();
                }
            }

            function updateProgressBar(percentage) { /* ... (код без изменений) ... */
                 aiProgressBarElement.style.width = `${percentage}%`; aiProgressBarContainer.setAttribute('aria-valuenow', percentage);
            }

            function executeNextStep() {
                if (currentStepIndex >= demoSteps.length) {
                    sequenceTimeout = setTimeout(() => {
                        aiDemoOutput.innerHTML = ''; updateProgressBar(0); currentStepIndex = 0; aiFakeInput.textContent = ''; // Очистить инпут
                        executeNextStep();
                    }, demoSteps[demoSteps.length - 1]?.delay || 7000);
                    return;
                }

                const step = demoSteps[currentStepIndex];
                let blockExecution = false; // Флаг блокировки до завершения асинхронной операции

                if (step.progress !== undefined) { updateProgressBar(step.progress); }

                if (step.text) {
                    blockExecution = step.text.typing || step.fakeInput; // Блокировать, если печатаем или вводим в инпут
                    if (step.fakeInput && step.text.type === 'user') {
                        // Сначала напечатать в инпут, потом добавить строку в лог
                        typeInFakeInput(step.text.content, 60, () => {
                             addDemoLine(step.text, scheduleNextStep); // Добавить строку и запланировать след. шаг
                             aiFakeInput.textContent = ''; // Очистить инпут после добавления в лог
                        });
                    } else {
                         // Просто добавить строку (печать обработается внутри addDemoLine)
                         addDemoLine(step.text, blockExecution ? scheduleNextStep : null); // Если печатаем, запланировать шаг после печати
                    }
                }

                currentStepIndex++;

                if (!blockExecution) { scheduleNextStep(); } // Если шаг не блокировал, планируем следующий
             }

             function scheduleNextStep() {
                  clearTimeout(sequenceTimeout);
                  if (currentStepIndex < demoSteps.length) {
                      const nextStepDelay = demoSteps[currentStepIndex]?.delay || 250;
                      sequenceTimeout = setTimeout(executeNextStep, nextStepDelay);
                  } else {
                      executeNextStep(); // Запустить логику перезапуска
                  }
              }

             // --- Инициализация Демо ---
             aiDemoOutput.innerHTML = ''; updateProgressBar(0); currentStepIndex = 0; aiFakeInput.textContent = '';
             executeNextStep(); // Старт
        };

        // NEW: Mouse Follower Logic
        const initMouseFollower = () => {
            const follower = document.getElementById('mouse-follower');
            if (!follower) return;

            let hasMoved = false;

            const updatePosition = (event) => {
                if (!hasMoved) {
                    document.body.classList.add('mouse-has-moved'); // Показать элемент после первого движения
                    hasMoved = true;
                }
                // Использование pageX/pageY для учета прокрутки
                follower.style.left = `${event.pageX}px`;
                follower.style.top = `${event.pageY}px`;
            };

            // Обновлять позицию при движении мыши
            window.addEventListener('mousemove', updatePosition, { passive: true });

            // Скрывать/показывать при уходе/возвращении мыши из окна (опционально)
            document.body.addEventListener('mouseleave', () => {
                if (hasMoved) follower.style.opacity = '0';
            });
            document.body.addEventListener('mouseenter', () => {
                 if (hasMoved) follower.style.opacity = '1';
            });
             // Скрывать при касании на тач-устройствах
             window.addEventListener('touchstart', () => {
                 follower.style.display = 'none';
             }, { passive: true });
        };

        // NEW: Hero Parallax Effect
        const initHeroParallax = () => {
            const hero = document.getElementById('hero');
            if (!hero) return;

            hero.addEventListener('mousemove', (e) => {
                const { clientWidth, clientHeight } = hero;
                const xRelativeToCenter = (e.clientX - clientWidth / 2) / (clientWidth / 2); // -1 to 1
                const yRelativeToCenter = (e.clientY - clientHeight / 2) / (clientHeight / 2); // -1 to 1

                const maxOffset = 1; // Max percentage offset for background-position

                // Небольшое смещение фона в противоположную сторону от курсора
                const bgPosX = 50 + xRelativeToCenter * maxOffset * -1; // %
                const bgPosY = 50 + yRelativeToCenter * maxOffset * -1; // %

                 // Плавное обновление через requestAnimationFrame
                 requestAnimationFrame(() => {
                     hero.style.backgroundPosition = `${bgPosX}% ${bgPosY}%`;
                 });

            }, { passive: true });

             // Сброс позиции, когда мышь уходит
            hero.addEventListener('mouseleave', () => {
                 requestAnimationFrame(() => {
                     hero.style.backgroundPosition = `center center`;
                 });
             });
        };


       // --- Инициализация после загрузки DOM ---
       document.addEventListener('DOMContentLoaded', () => {
            const hamburger = document.getElementById('hamburger');
            const menuOverlay = document.getElementById('menuOverlay');

            // --- Обработчики событий ---
            hamburger?.addEventListener('click', () => toggleMenu());
            menuOverlay?.addEventListener('click', () => toggleMenu(true));
            document.body.addEventListener('click', handleSmoothScroll);
            document.addEventListener('keydown', (e) => {
                 if (e.key === 'Escape' && document.getElementById('navLinks')?.classList.contains('active')) { toggleMenu(true); }
            });

            let scrollTimeout;
            window.addEventListener('scroll', () => {
                handleHeaderScroll();
                clearTimeout(scrollTimeout); scrollTimeout = setTimeout(updateActiveNav, 100);
            }, { passive: true });


            // --- Вызов инициализирующих функций ---
            handleHeaderScroll();
            updateActiveNav();
            initScrollAnimations(); // Общие анимации появления
            initTimelineAnimation(); // Анимация таймлайна
            initLetterAnimation(); // Анимация букв заголовка
            initMouseFollower(); // Свечение за мышью
            initHeroParallax(); // Параллакс в Hero
            updateCopyrightYear();
            runAiDemo(); // Запуск AI демо

       }); // Конец DOMContentLoaded

       // --- END: JavaScript ---
    </script>