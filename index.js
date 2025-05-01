document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v19...");

    // --- Глобальные переменные и хелперы ---
    const body = document.body;
    const currentYear = new Date().getFullYear();
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = currentYear;
    }

    // Функция для добавления/удаления класса с задержкой (для анимаций и т.д.)
    const delayedToggleClass = (element, className, delay, add = true) => {
        setTimeout(() => {
            if (element) {
                element.classList.toggle(className, add);
            }
        }, delay);
    };

    // --- Эффект следования за мышью ---
    const follower = document.getElementById('mouse-follower');
    let mouseX = 0, mouseY = 0;
    let followerX = 0, followerY = 0;
    const followSpeed = 0.1; // Плавность следования (0 до 1)

    if (follower) {
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        // Добавляем эффект при нажатии кнопки мыши
        document.addEventListener('mousedown', () => {
            follower.style.transform = 'translate(-50%, -50%) scale(0.8)'; // Уменьшаем размер
            follower.style.transition = 'transform 0.1s ease-out'; // Быстрая анимация
        });

        document.addEventListener('mouseup', () => {
            follower.style.transform = 'translate(-50%, -50%) scale(1)'; // Возвращаем нормальный размер
            follower.style.transition = 'transform 0.2s ease-in-out'; // Плавное возвращение
        });


        const updateFollowerPosition = () => {
            const dx = mouseX - followerX;
            const dy = mouseY - followerY;

            followerX += dx * followSpeed;
            followerY += dy * followSpeed;

            // Округляем значения для производительности
            const roundedX = Math.round(followerX);
            const roundedY = Math.round(followerY);

            // Используем requestAnimationFrame для плавности и производительности
            requestAnimationFrame(() => {
                 if (follower) {
                     follower.style.left = `${roundedX}px`;
                     follower.style.top = `${roundedY}px`;
                     // Переустанавливаем transform, чтобы он не конфликтовал с mouseup/down
                     if (!body.matches(':active')) { // Проверяем, не нажата ли кнопка мыши
                         follower.style.transform = 'translate(-50%, -50%) scale(1)';
                     }
                 }
                 requestAnimationFrame(updateFollowerPosition);
            });
        };

        // Запускаем анимацию следования
        requestAnimationFrame(updateFollowerPosition);

        console.log("Mouse follower activated.");
    } else {
        console.warn("Mouse follower element not found.");
    }


    // --- Навигация (гамбургер меню) ---
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    const menuOverlay = document.getElementById('menuOverlay');
    const header = document.getElementById('header'); // Получаем хедер

    if (hamburger && navLinks && menuOverlay && header) {
        hamburger.addEventListener('click', () => {
            const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
            hamburger.setAttribute('aria-expanded', !isExpanded);
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
            menuOverlay.classList.toggle('active');
            body.classList.toggle('no-scroll'); // Блокировка скролла при открытом меню
            header.classList.toggle('menu-open'); // Добавляем класс на хедер
            console.log(`Mobile menu toggled: ${!isExpanded ? 'Open' : 'Closed'}`);
        });

        menuOverlay.addEventListener('click', () => {
            hamburger.setAttribute('aria-expanded', 'false');
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            menuOverlay.classList.remove('active');
            body.classList.remove('no-scroll');
            header.classList.remove('menu-open');
            console.log("Mobile menu closed via overlay click.");
        });

        // Закрытие меню при клике на ссылку (для SPA-подобной навигации)
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (navLinks.classList.contains('active')) {
                    hamburger.setAttribute('aria-expanded', 'false');
                    hamburger.classList.remove('active');
                    navLinks.classList.remove('active');
                    menuOverlay.classList.remove('active');
                    body.classList.remove('no-scroll');
                    header.classList.remove('menu-open');
                    console.log("Mobile menu closed via link click.");
                }
            });
        });
        console.log("Hamburger menu initialized.");
    } else {
         console.warn("Hamburger menu elements not found. Menu might not function.");
     }

    // --- Демонстрация работы AI ---
    const aiOutput = document.getElementById('ai-demo-output');
    const aiProgressBar = document.getElementById('ai-progress-bar');
    const aiProgressLabel = document.getElementById('ai-progress-label');
    const aiFakeInput = document.getElementById('ai-fake-input'); // Элемент для имитации ввода

    // Расширенный список текстов для демо + имитация команд и ошибок
    const demoTexts = [
        { text: "Boot Sequence Initiated...", type: "status" },
        { text: "Loading AI Core v19...", type: "status" },
        { text: "Accessing Neural Network...", type: "status" },
        { text: "Analyzing Query: 'Optimal Learning Path - Math'", type: "input" }, // Имитация ввода
        { text: "Processing User Profile: CyberMike_77...", type: "process" },
        { text: "Scanning Knowledge Base...", type: "process" },
        { text: "Identifying Weak Points: Algebra, Geometry...", type: "analysis" },
        { text: "WARNING: High error rate detected in Polynomials.", type: "warning" }, // Добавлено предупреждение
        { text: "Initiating Correction Subroutine...", type: "process" },
        { text: "Generating Adaptive Lesson Plan...", type: "process" },
        { text: "Module 1: Polynomial Refresher Activated.", type: "output" },
        { text: "Module 2: Geometric Proofs - Interactive.", type: "output" },
        { text: "Calculating Optimal Time Allocation...", type: "analysis" },
        { text: "Simulating CERMAT Exam Conditions...", type: "process" },
        { text: "Cross-referencing with known exam patterns...", type: "process" },
        { text: "Optimization Complete.", type: "status" },
        { text: "Ready for User Input.", type: "status" }
    ];

    let currentTextIndex = 0;
    let currentProgress = 0;
    const progressIncrement = 100 / demoTexts.length; // Инкремент прогресса на каждый шаг

    // Функция для имитации печатания текста
    const typeText = (element, text, speed = 50) => {
         return new Promise((resolve) => {
            let i = 0;
            element.textContent = ''; // Очищаем перед началом
            const intervalId = setInterval(() => {
                if (i < text.length) {
                    element.textContent += text.charAt(i);
                    i++;
                } else {
                    clearInterval(intervalId);
                     resolve(); // Завершаем промис после печати
                }
            }, speed);
        });
    };

    const runAIDemo = async () => {
        if (!aiOutput || !aiProgressBar || !aiProgressLabel || !aiFakeInput) {
            console.warn("AI Demo elements missing. Demo aborted.");
            return; // Выходим, если элементы не найдены
        }

        if (currentTextIndex >= demoTexts.length) {
            // Демо завершено, можно перезапустить или остановиться
            aiOutput.innerHTML += `<p class="ai-log-line status">[Session End]</p>`;
            aiProgressLabel.textContent = "Processing Complete";
            console.log("AI Demo sequence finished.");
            // Можно добавить кнопку для перезапуска
            // setTimeout(resetAndRunDemo, 5000); // Пример перезапуска через 5 сек
            return;
        }

        const item = demoTexts[currentTextIndex];
        const logLine = document.createElement('p');
        logLine.classList.add('ai-log-line', item.type || 'status'); // Добавляем класс типа

        if (item.type === 'input') {
            // Имитируем ввод в поле fake-input
            await typeText(aiFakeInput, item.text, 70); // Печатаем в поле ввода
            await new Promise(resolve => setTimeout(resolve, 300)); // Пауза после ввода
             logLine.textContent = `> ${item.text}`; // Отображаем как введенную команду в логе
            aiFakeInput.textContent = ''; // Очищаем поле ввода
        } else {
            // Имитируем вывод в лог
            logLine.textContent = item.text;
         }

        aiOutput.appendChild(logLine);
        aiOutput.scrollTop = aiOutput.scrollHeight; // Автопрокрутка вниз

        // Обновляем прогресс-бар и метку
        currentProgress += progressIncrement;
        aiProgressBar.style.width = `${Math.min(currentProgress, 100)}%`; // Ограничиваем 100%
         // Динамическое изменение текста прогресс бара
         let progressText = "Processing";
         if (item.type === 'analysis') progressText = "Analyzing Data";
         if (item.type === 'warning') progressText = "System Alert";
         if (item.type === 'output') progressText = "Generating Output";
         aiProgressLabel.textContent = `${progressText} // ${item.text.substring(0, 25)}...`; // Краткое описание задачи

        currentTextIndex++;

        // Случайная задержка перед следующим шагом для реализма
        const randomDelay = Math.random() * 500 + 200; // от 200 до 700 мс
        setTimeout(runAIDemo, randomDelay);
    };

    // Наблюдатель для запуска AI демо при появлении блока на экране
    const demoSection = document.getElementById('ai-demo');
    let demoStarted = false;
    const demoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !demoStarted) {
                console.log("AI Demo section intersecting, starting simulation...");
                demoStarted = true; // Запускаем только один раз
                // Очищаем перед запуском (если нужно перезапускать)
                if (aiOutput) aiOutput.innerHTML = '';
                if (aiProgressBar) aiProgressBar.style.width = '0%';
                currentTextIndex = 0;
                currentProgress = 0;
                if (aiFakeInput) aiFakeInput.textContent = '';
                runAIDemo(); // Запускаем демо
                // demoObserver.unobserve(entry.target); // Раскомментировать, если нужно запустить только 1 раз за сессию
            }
        });
    }, { threshold: 0.6 }); // Запускать, когда 60% секции видно

    if (demoSection) {
        demoObserver.observe(demoSection);
         console.log("AI Demo observer attached.");
     } else {
         console.warn("AI Demo section (#ai-demo) not found.");
     }


    // --- Анимации при прокрутке ---
    const animatedElements = document.querySelectorAll('[data-animate], [data-animate-letters], [data-animate-timeline]');

    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const delay = (parseInt(element.style.getPropertyValue('--animation-order') || '0', 10)) * 100; // Задержка на основе --animation-order

                // Анимация букв
                if (element.hasAttribute('data-animate-letters') && !element.classList.contains('letters-animated')) {
                    element.classList.add('letters-animating'); // Класс для начала анимации
                     const text = element.textContent?.trim() ?? ''; // Используем textContent и удаляем пробелы
                     element.innerHTML = ''; // Очищаем элемент

                    text.split('').forEach((char, charIndex) => {
                         const span = document.createElement('span');
                         span.textContent = char === ' ' ? '\u00A0' : char; // Заменяем пробел на неразрывный
                        span.style.display = 'inline-block'; // Важно для transform
                         span.style.opacity = '0';
                         // Добавляем случайное смещение и задержку для "крутого" эффекта
                        const randomY = (Math.random() - 0.5) * 10; // Случайное смещение по Y (-5px до +5px)
                        const randomDelay = Math.random() * 300; // Случайная доп. задержка до 300ms
                         span.style.transform = `translateY(${randomY}px)`;
                         span.style.animation = `letterFadeIn 0.6s ${delay + charIndex * 50 + randomDelay}ms forwards cubic-bezier(0.2, 0.8, 0.2, 1)`;
                         element.appendChild(span);
                    });
                    element.classList.add('letters-animated'); // Отмечаем, что анимация запущена
                    console.log("Letter animation triggered for:", element);
                 }
                // Обычная анимация появления
                else if (element.hasAttribute('data-animate') && !element.classList.contains('animated')) {
                    delayedToggleClass(element, 'animated', delay);
                    console.log("General animation triggered for:", element, "with delay:", delay);
                 }
                 // Анимация таймлайна
                else if (element.hasAttribute('data-animate-timeline') && !element.classList.contains('timeline-animated')) {
                    delayedToggleClass(element, 'timeline-animated', delay);
                    console.log("Timeline animation triggered for:", element, "with delay:", delay);
                 }

                // Отключаем наблюдение после анимации для производительности
                // observer.unobserve(element); // Пока закомментировано, если нужна повторная анимация при прокрутке
            }
            // Можно добавить логику для скрытия элементов при прокрутке вверх (если нужно)
             // else {
             //     if (entry.target.classList.contains('animated')) {
             //         entry.target.classList.remove('animated');
             //     }
             //     // ... и для других типов анимаций
             // }
        });
    }, {
         threshold: 0.1, // Запускать, когда 10% элемента видно
         // rootMargin: "0px 0px -50px 0px" // Можно настроить отступы, чтобы анимация начиналась чуть раньше/позже
     });

    animatedElements.forEach(el => {
        scrollObserver.observe(el);
    });
    console.log(`Scroll observer attached to ${animatedElements.length} elements.`);

    // --- Плавная прокрутка к якорям ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');

             // Исключаем пустые якоря или якоря только с #
            if (href === '#' || href === '') return;

             // Исключаем ссылки на другие страницы или элементы управления (например, гамбургер)
             if (href.startsWith('#') && href.length > 1) {
                const targetElement = document.querySelector(href);
                if (targetElement) {
                    e.preventDefault(); // Отменяем стандартное поведение только если якорь найден
                    console.log(`Smooth scrolling to ${href}`);
                    const headerOffset = document.getElementById('header')?.offsetHeight || 70; // Учитываем высоту хедера
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: "smooth" // Плавная прокрутка
                    });

                    // Закрываем мобильное меню, если оно открыто
                    if (navLinks && navLinks.classList.contains('active')) {
                         hamburger?.classList.remove('active');
                         navLinks.classList.remove('active');
                         menuOverlay?.classList.remove('active');
                         body.classList.remove('no-scroll');
                         header?.classList.remove('menu-open');
                         hamburger?.setAttribute('aria-expanded', 'false');
                        console.log("Mobile menu closed after anchor link click.");
                    }
                 } else {
                     console.warn(`Smooth scroll target element not found for selector: ${href}`);
                 }
            }
        });
    });
    console.log("Smooth scroll initialized for anchor links.");

    console.log("JUSTAX Interface v19 Initialization Complete.");
}); // Конец DOMContentLoaded