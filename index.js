/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, and simulations.
 * Version: v2.1 (Added Infinite Scroll for Testimonials)
 * Author: [Your Name/Alias] / Gemini Modification
 * Date: 2025-05-02
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.1...");

    // --- Polyfills and Early Checks ---
    if (!('IntersectionObserver' in window)) {
        console.warn("IntersectionObserver not supported. Animations on scroll might not work.");
    }

    // --- Global Variables & DOM References ---
    const body = document.body;
    const header = document.getElementById('header');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    const menuOverlay = document.getElementById('menuOverlay');
    const follower = document.getElementById('mouse-follower');
    const yearSpan = document.getElementById('currentYear');
    const demoSection = document.getElementById('ai-demo');
    const aiOutput = document.getElementById('ai-demo-output');
    const aiProgressBar = document.getElementById('ai-progress-bar');
    const aiProgressLabel = document.getElementById('ai-progress-label');
    const aiFakeInput = document.getElementById('ai-fake-input');
    const aiStatusIndicator = document.getElementById('ai-status');
    const testimonialsSection = document.getElementById('testimonials'); // Get the section
    const testimonialsContainer = document.querySelector('#testimonials .testimonials-grid');
    const animatedElements = document.querySelectorAll('[data-animate], [data-animate-letters]');

    // --- Configuration ---
    const config = {
        mouseFollower: {
            enabled: true,
            followSpeed: 0.1,
            clickScale: 0.8,
            hoverScale: 1.6
        },
        animations: {
            scrollThreshold: 0.15,
            staggerDelay: 120,
            letterDelay: 40,
            letterRandomOffset: 250
        },
        aiDemo: {
            enabled: true,
            typingSpeed: 40,
            stepBaseDelay: 200,
            stepRandomDelay: 450
        },
        testimonials: {
            enabled: true,
            placeholderAvatarBaseUrl: 'https://placehold.co/100x100/',
            loadCount: 3, // How many to load per scroll
            scrollTriggerOffset: 300 // Pixels from bottom to trigger load
        }
    };

    // --- Testimonial Data & State ---
    const sampleTestimonials = [
        { name: "Eva N.", role: "Studentka (8. třída)", text: "Konečně chápu zlomky! AI mi to vysvětlilo úplně jinak než ve škole a teď mi to dává smysl. Super apka!", rating: 5, avatarText: "EN" },
        { name: "Petr S.", role: "Rodič", text: "Platforma skvěle doplňuje školní výuku. Syn si zlepšil známky v matematice a baví ho to víc než biflování z učebnice.", rating: 4.5, avatarText: "PS" },
        { name: "Aneta K.", role: "Studentka (Gymnázium)", text: "Příprava na maturitu z češtiny byla hračka. Líbí se mi interaktivní cvičení a okamžitá zpětná vazba.", rating: 5, avatarText: "AK" },
        { name: "Tomáš V.", role: "Student (VŠ)", text: "Používám Justax na opakování základů před zkouškami. Adaptivní systém mi vždy najde přesně to, co potřebuji procvičit.", rating: 4, avatarText: "TV" },
        { name: "Lucie S.", role: "Máma (syn 9. třída)", text: "Syn si pochvaluje hlavně tu okamžitou zpětnou vazbu. Když něco neví, AI mu to hned vysvětlí jinak. Ušetřilo nám to spoustu nervů před přijímačkami. Doporučuju!", rating: 4.5, avatarText: "LS" },
        { name: "Martin K.", role: "Otec studentky", text: "Konečně něco, co na dceru funguje. Předtím jsme zkoušeli doučování, ale tohle je mnohem efektivnější. Plán na míru je super věc.", rating: 5, avatarText: "MK" },
        { name: "Barbora D.", role: "Studentka", text: "Grafické znázornění pokroku mě motivuje se dál zlepšovat. Vidím, kde mám mezery a na čem pracovat.", rating: 4.5, avatarText: "BD"},
        { name: "Jan F.", role: "Rodič", text: "Oceňuji přehlednost platformy a detailní reporty o pokroku syna. Vím přesně, jak si vede.", rating: 4, avatarText: "JF"}
    ];
    let testimonialsOffset = 0; // How many testimonials have been displayed/created
    let isTestimonialsLoading = false;
    let initialTestimonialCards = [];


    // --- Utility Functions ---
    const setYear = () => {
        if (yearSpan) {
            yearSpan.textContent = new Date().getFullYear();
        }
    };

    const toggleMenu = (open) => {
        if (!hamburger || !navLinks || !menuOverlay || !header) return;
        const shouldOpen = typeof open === 'boolean' ? open : !hamburger.classList.contains('active');
        hamburger.classList.toggle('active', shouldOpen);
        navLinks.classList.toggle('active', shouldOpen);
        menuOverlay.classList.toggle('active', shouldOpen);
        body.classList.toggle('no-scroll', shouldOpen);
        header.classList.toggle('menu-open', shouldOpen);
        hamburger.setAttribute('aria-expanded', shouldOpen);
        hamburger.setAttribute('aria-label', shouldOpen ? 'Zavřít menu' : 'Otevřít menu');
        if (shouldOpen) {
             navLinks.querySelector('a')?.focus();
        } else {
            hamburger.focus();
        }
        // console.log(`Mobile menu toggled: ${shouldOpen ? 'Open' : 'Closed'}`);
    };

    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    // --- Feature Initializations ---

    // 1. Update Copyright Year
    setYear();

    // 2. Header Scroll Effect
    const handleScrollHeader = () => {
        if (header) {
            header.classList.toggle('scrolled', window.scrollY > 50);
        }
    };
    // Debounced scroll listener for header
    window.addEventListener('scroll', debounce(handleScrollHeader, 15), { passive: true });
    handleScrollHeader(); // Initial check

    // 3. Hamburger Menu Logic
    if (hamburger) {
        hamburger.addEventListener('click', () => toggleMenu());
    }
    if (menuOverlay) {
        menuOverlay.addEventListener('click', () => toggleMenu(false));
    }
    if (navLinks) {
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.getAttribute('href')?.startsWith('#') || link.getAttribute('href')?.startsWith('/#')) {
                     if (navLinks.classList.contains('active')) {
                         if (!e.defaultPrevented) {
                             toggleMenu(false);
                         }
                     }
                }
            });
        });
        navLinks.addEventListener('keydown', (e) => {
             if (e.key === 'Escape' && navLinks.classList.contains('active')) {
                 toggleMenu(false);
             }
        });
    }
    console.log("Hamburger menu initialized.");


    // 4. Mouse Follower
    if (config.mouseFollower.enabled && follower && !window.matchMedia('(hover: none)').matches) {
        let mouseX = 0, mouseY = 0;
        let followerX = 0, followerY = 0;
        let currentScale = 1;
        let isHoveringLink = false;
        let animationFrameId = null;

        const updateFollower = () => {
            const dx = mouseX - followerX;
            const dy = mouseY - followerY;
            followerX += dx * config.mouseFollower.followSpeed;
            followerY += dy * config.mouseFollower.followSpeed;
            const targetScale = isHoveringLink ? config.mouseFollower.hoverScale : (body.matches(':active') ? config.mouseFollower.clickScale : 1);
            currentScale += (targetScale - currentScale) * 0.2;
            const roundedX = Math.round(followerX);
            const roundedY = Math.round(followerY);
            follower.style.transform = `translate(-50%, -50%) scale(${currentScale.toFixed(3)})`;
            follower.style.left = `${roundedX}px`;
            follower.style.top = `${roundedY}px`;
            animationFrameId = requestAnimationFrame(updateFollower);
        };

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            if (!animationFrameId) {
                 animationFrameId = requestAnimationFrame(updateFollower);
            }
        }, { passive: true });

        document.addEventListener('mouseover', (e) => {
             if (e.target.closest('a, button, .btn')) {
                 isHoveringLink = true;
                 follower.classList.add('follower-hover');
             }
        });
        document.addEventListener('mouseout', (e) => {
             if (e.target.closest('a, button, .btn')) {
                 isHoveringLink = false;
                 follower.classList.remove('follower-hover');
             }
        });

        document.addEventListener('mouseleave', () => {
             if (animationFrameId) {
                 cancelAnimationFrame(animationFrameId);
                 animationFrameId = null;
             }
        });
        document.addEventListener('mouseenter', () => {
             if (!animationFrameId) {
                 mouseX = window.innerWidth / 2;
                 mouseY = window.innerHeight / 2;
                 followerX = mouseX;
                 followerY = mouseY;
                 animationFrameId = requestAnimationFrame(updateFollower);
             }
        });

        animationFrameId = requestAnimationFrame(updateFollower);
        console.log("Mouse follower activated.");
    } else if (!follower) {
        console.warn("Mouse follower element not found.");
    } else if (window.matchMedia('(hover: none)').matches) {
        console.log("Mouse follower disabled on likely touch device.");
        if (follower) follower.style.display = 'none';
    }


    // 5. AI Demo Simulation
    if (config.aiDemo.enabled && demoSection && aiOutput && aiProgressBar && aiProgressLabel && aiFakeInput && aiStatusIndicator) {
        let currentTextIndex = 0;
        let currentProgress = 0;
        let demoIsRunning = false;
        let demoTimeoutId = null;
        const demoTexts = [
             { text: "Boot Sequence Initiated...", type: "status", delay: 500 },
             { text: "Loading AI Core v19...", type: "status" },
             { text: "Accessing Neural Network Interface...", type: "status" },
             { text: "Query Received: 'Optimal Learning Path - Math (Grade 9)'", type: "input", inputSpeed: 60 },
             { text: "Processing User Profile: CyberMike_77...", type: "process" },
             { text: "Scanning Knowledge Base (Algebra, Geometry, Functions)...", type: "process", progressText: "Scanning KB" },
             { text: "Analyzing performance metrics...", type: "analysis" },
             { text: "Identified Weak Points: Polynomial Factoring, Circle Theorems.", type: "analysis", progressText: "Analyzing Weaknesses" },
             { text: "WARNING: Low confidence score in Trigonometric Identities.", type: "warning", delay: 300 },
             { text: "Executing Adaptive Path Correction Subroutine...", type: "process" },
             { text: "Generating Personalized Lesson Plan...", type: "process", progressText: "Generating Plan" },
             { text: "Module 1: Interactive Polynomial Factoring Drill.", type: "output" },
             { text: "Module 2: Visual Proofs for Circle Theorems.", type: "output" },
             { text: "Module 3: Targeted Practice: Trig Identities.", type: "output" },
             { text: "Calculating Optimal Time Allocation...", type: "analysis" },
             { text: "Simulating CERMAT Exam Conditions (Difficulty Level: High)...", type: "process", progressText: "Simulating Exam" },
             { text: "Cross-referencing with historical exam patterns...", type: "process" },
             { text: "Optimization Complete. Learning Path Ready.", type: "status", delay: 500, final: true },
        ];
        const progressIncrement = 100 / (demoTexts.length - 1 || 1);

        const typeText = (element, text, speed) => {
            return new Promise((resolve) => {
                let i = 0;
                element.textContent = '';
                const intervalId = setInterval(() => {
                    if (i < text.length) {
                        element.textContent += text.charAt(i);
                        i++;
                    } else {
                        clearInterval(intervalId);
                        resolve();
                    }
                }, speed);
            });
        };

        const runAIDemoStep = async () => {
            if (currentTextIndex >= demoTexts.length || !demoIsRunning) {
                aiStatusIndicator.textContent = "IDLE";
                 aiProgressLabel.textContent = currentTextIndex >= demoTexts.length ? "Processing Complete" : "Demo Stopped";
                 if(currentTextIndex >= demoTexts.length) aiProgressBar.style.width = '100%';
                 demoIsRunning = false;
                 if (demoTimeoutId) clearTimeout(demoTimeoutId);
                return;
            }

            const item = demoTexts[currentTextIndex];
            const logLine = document.createElement('p');
            logLine.classList.add('ai-log-line', item.type || 'status');
            logLine.setAttribute('role', 'logitem');
            aiStatusIndicator.textContent = item.progressText || "PROCESSING";

            if (item.type === 'input') {
                aiFakeInput.parentElement?.classList.add('typing');
                await typeText(aiFakeInput, item.text, item.inputSpeed || config.aiDemo.typingSpeed);
                await new Promise(resolve => setTimeout(resolve, 300));
                logLine.textContent = `> ${item.text}`;
                aiFakeInput.textContent = '';
                aiFakeInput.parentElement?.classList.remove('typing');
            } else {
                 await typeText(logLine, item.text, config.aiDemo.typingSpeed);
            }

            aiOutput.appendChild(logLine);
            aiOutput.scrollTo({ top: aiOutput.scrollHeight, behavior: 'smooth' });

            if (currentTextIndex > 0 || demoTexts.length === 1) currentProgress += progressIncrement;
            const displayProgress = Math.min(currentProgress, 100);
            aiProgressBar.style.width = `${displayProgress}%`;
            aiProgressBar.setAttribute('aria-valuenow', Math.round(displayProgress));
            aiProgressLabel.textContent = `${item.progressText || item.type || 'Status'} // ${item.text.substring(0, 30)}...`;

            currentTextIndex++;
            const delay = (item.delay || 0) + config.aiDemo.stepBaseDelay + Math.random() * config.aiDemo.stepRandomDelay;
            if (demoIsRunning) demoTimeoutId = setTimeout(runAIDemoStep, delay);
        };

        const startDemo = () => {
            if (demoIsRunning) return;
            console.log("AI Demo section intersecting, starting simulation...");
            demoIsRunning = true;
            aiOutput.innerHTML = '';
            aiFakeInput.textContent = '';
            aiProgressBar.style.width = '0%';
            aiProgressBar.setAttribute('aria-valuenow', '0');
            aiStatusIndicator.textContent = "INITIALIZING";
            aiProgressLabel.textContent = "Initializing // Please wait...";
            currentTextIndex = 0;
            currentProgress = 0;
            if (demoTimeoutId) clearTimeout(demoTimeoutId);
            runAIDemoStep();
        };

        const stopDemo = () => {
            if (!demoIsRunning) return;
            console.log("AI Demo section out of view, stopping simulation.");
             demoIsRunning = false;
             if (demoTimeoutId) clearTimeout(demoTimeoutId);
             aiStatusIndicator.textContent = "PAUSED";
             aiProgressLabel.textContent = "Demo Paused // Scroll down to resume";
        }

        const demoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) startDemo();
                else stopDemo();
            });
        }, { threshold: 0.5 });
        demoObserver.observe(demoSection);
        console.log("AI Demo observer attached.");
    } else {
        console.warn("AI Demo elements or section not found, or demo disabled in config.");
    }

    // 6. Scroll Animations (Intersection Observer)
    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const delay = (parseInt(element.style.getPropertyValue('--animation-order') || '0', 10)) * config.animations.staggerDelay;

                if (element.hasAttribute('data-animate-letters') && !element.classList.contains('letters-animated')) {
                    element.classList.add('letters-animating');
                    const text = element.textContent?.trim() ?? '';
                    element.innerHTML = '';
                    text.split('').forEach((char, charIndex) => {
                        const span = document.createElement('span');
                        span.textContent = char === ' ' ? '\u00A0' : char;
                        const randomDelay = Math.random() * config.animations.letterRandomOffset;
                        span.style.animation = `letter-pop-in 0.6s ${delay + charIndex * config.animations.letterDelay + randomDelay}ms forwards cubic-bezier(0.2, 0.8, 0.2, 1.2)`;
                        element.appendChild(span);
                    });
                    element.classList.add('letters-animated');
                    // console.log("Letter animation triggered for:", element);
                    observer.unobserve(element);
                } else if (element.hasAttribute('data-animate') && !element.classList.contains('animated')) {
                     // Use a timeout for staggered delay based on --animation-order
                     setTimeout(() => {
                         element.classList.add('animated');
                         // console.log("General animation triggered for:", element, "with delay:", delay);
                         observer.unobserve(element);
                     }, delay);
                } else {
                     // Element might already be animated or not match criteria
                     observer.unobserve(element); // Unobserve if already animated or not applicable
                 }
             }
        });
    }, {
        threshold: config.animations.scrollThreshold,
    });

    // Observe all elements initially marked for animation
    document.querySelectorAll('[data-animate], [data-animate-letters]').forEach(el => {
        // Add initial styles needed before animation starts (if not handled by CSS)
        // e.g., el.style.opacity = '0';
        scrollObserver.observe(el);
    });
    console.log(`Scroll observer attached for entry animations.`);

    // 7. Smooth Scroll for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#') return;
            try {
                 const targetElement = document.querySelector(href);
                 if (targetElement) {
                    e.preventDefault();
                    // console.log(`Smooth scrolling to ${href}`);
                    const headerOffset = header?.offsetHeight || 70;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    window.scrollTo({ top: offsetPosition, behavior: "smooth" });
                    toggleMenu(false);
                 } else {
                     console.warn(`Smooth scroll target element not found for selector: ${href}`);
                 }
            } catch (err) {
                console.error(`Error finding element for smooth scroll selector: ${href}`, err);
            }
        });
    });
    console.log("Smooth scroll initialized for anchor links.");


    // 8. Dynamic & Infinite Testimonials
    if (config.testimonials.enabled && testimonialsContainer && testimonialsSection) {
        const getRandomColorPair = () => {
             const colors = [
                 { bg: 'a05cff', text: 'FFFFFF' }, { bg: '00e0ff', text: '03020c' }, { bg: 'ff33a8', text: 'FFFFFF' },
                 { bg: 'f0e14a', text: '03020c' }, { bg: '00ffaa', text: '03020c' }, { bg: 'ff9a00', text: 'FFFFFF' }
             ];
            return colors[Math.floor(Math.random() * colors.length)];
        };

        const generateStarsHTML = (rating) => {
            let starsHTML = '';
            const fullStars = Math.floor(rating);
            const halfStar = rating % 1 >= 0.5;
            const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
            for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fas fa-star" aria-hidden="true"></i>';
            if (halfStar) starsHTML += '<i class="fas fa-star-half-alt" aria-hidden="true"></i>';
            for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star" aria-hidden="true"></i>';
            return starsHTML;
        };

        const updateTestimonialCard = (cardElement, testimonial) => {
            const ratingEl = cardElement.querySelector('.testimonial-rating');
            const textEl = cardElement.querySelector('.testimonial-text-content');
            const nameEl = cardElement.querySelector('.testimonial-name');
            const roleEl = cardElement.querySelector('.testimonial-role');
            const avatarEl = cardElement.querySelector('.testimonial-avatar');

            if (ratingEl) {
                ratingEl.innerHTML = generateStarsHTML(testimonial.rating);
                ratingEl.setAttribute('aria-label', `Hodnocení: ${testimonial.rating} z 5 hvězdiček`);
            }
            if (textEl) textEl.textContent = testimonial.text;
            if (nameEl) nameEl.textContent = testimonial.name;
            if (roleEl) roleEl.textContent = testimonial.role;
            if (avatarEl) {
                const colors = getRandomColorPair();
                const avatarUrl = `${config.testimonials.placeholderAvatarBaseUrl}${colors.bg}/${colors.text}/png?text=${encodeURIComponent(testimonial.avatarText)}&font=poppins`;
                avatarEl.style.backgroundImage = `url('${avatarUrl}')`;
                avatarEl.setAttribute('aria-label', `Avatar ${testimonial.name}`);
            }
        };

         const createTestimonialCardElement = (testimonialData) => {
            // Clone the structure from an existing card or build from scratch
            // Here, we'll build it to ensure structure is correct
            const card = document.createElement('article');
            card.className = 'testimonial-card';
            card.setAttribute('data-animate', ''); // Add animation attribute
            card.innerHTML = `
                <div class="testimonial-content">
                    <div class="testimonial-rating" aria-label="Hodnocení"></div>
                    <blockquote class="testimonial-text">
                        <p class="testimonial-text-content"></p>
                    </blockquote>
                </div>
                <div class="testimonial-author">
                    <div class="testimonial-avatar" role="img" aria-label="Avatar uživatele"></div>
                    <div class="testimonial-author-info">
                        <div class="testimonial-name"></div>
                        <div class="testimonial-role"></div>
                    </div>
                </div>
            `;
            updateTestimonialCard(card, testimonialData);
            return card;
        };

        const loadMoreTestimonials = () => {
            if (isTestimonialsLoading) return;
            isTestimonialsLoading = true;
            console.log("Loading more testimonials...");

            // Simulate network delay/loading time (optional)
            // setTimeout(() => {
                const fragment = document.createDocumentFragment();
                const currentLoadedCount = testimonialsContainer.children.length; // How many are currently in DOM

                for (let i = 0; i < config.testimonials.loadCount; i++) {
                    const dataIndex = (testimonialsOffset + i) % sampleTestimonials.length; // Cycle through data
                    const testimonialData = sampleTestimonials[dataIndex];
                    const newCard = createTestimonialCardElement(testimonialData);

                    // Apply animation order based on total loaded count
                    newCard.style.setProperty('--animation-order', currentLoadedCount + i);

                    fragment.appendChild(newCard);
                }

                testimonialsContainer.appendChild(fragment);
                testimonialsOffset += config.testimonials.loadCount; // Update offset

                // Re-observe newly added cards for animation
                const newCards = Array.from(testimonialsContainer.children).slice(-config.testimonials.loadCount);
                newCards.forEach(card => scrollObserver.observe(card));

                console.log(`Loaded ${config.testimonials.loadCount} more testimonials. Total offset: ${testimonialsOffset}`);
                isTestimonialsLoading = false;
            // }, 300); // Optional simulated delay
        };

        // Populate initial static cards
        initialTestimonialCards = Array.from(testimonialsContainer.querySelectorAll('.testimonial-card'));
        if (initialTestimonialCards.length > 0) {
            const initialShuffled = [...sampleTestimonials].sort(() => 0.5 - Math.random());
            initialTestimonialCards.forEach((card, index) => {
                 if (initialShuffled[index]) {
                    updateTestimonialCard(card, initialShuffled[index]);
                }
                // Make sure initial cards are observed for animation
                // scrollObserver.observe(card); // Already observed by the global querySelectorAll
            });
             testimonialsOffset = initialTestimonialCards.length; // Set initial offset
            console.log(`Populated ${initialTestimonialCards.length} initial testimonials. Offset: ${testimonialsOffset}`);
        } else {
            // If no static cards, load the first batch immediately
            loadMoreTestimonials();
        }

        // Scroll listener for infinite loading
        const handleScrollTestimonials = () => {
            // Check if the bottom of the viewport is near the bottom of the testimonials section
             if (!isTestimonialsLoading &&
                 (window.innerHeight + window.scrollY) >= testimonialsSection.offsetTop + testimonialsSection.offsetHeight - config.testimonials.scrollTriggerOffset)
            {
                loadMoreTestimonials();
            }
        };

        // Use a separate debounced listener for testimonials scroll check
        window.addEventListener('scroll', debounce(handleScrollTestimonials, 100), { passive: true });
        console.log("Testimonials infinite scroll initialized.");

    } else {
         console.warn("Testimonials container/section not found or feature disabled.");
    }


    // --- Final Initialization ---
    console.log("JUSTAX Interface v2.1 Initialization Complete.");

}); // End DOMContentLoaded