/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, and simulations.
 * Version: v2.0 (Refactored)
 * Author: [Your Name/Alias]
 * Date: 2025-05-01
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.0...");

    // --- Polyfills and Early Checks ---
    // Example: Check for IntersectionObserver support
    if (!('IntersectionObserver' in window)) {
        console.warn("IntersectionObserver not supported. Animations on scroll might not work.");
        // Optionally load a polyfill here
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
    const testimonialsContainer = document.querySelector('#testimonials .testimonials-grid');
    const animatedElements = document.querySelectorAll('[data-animate], [data-animate-letters]'); // Simplified selector

    // --- Configuration ---
    const config = {
        mouseFollower: {
            enabled: true, // Set to false to disable
            followSpeed: 0.1,
            clickScale: 0.8,
            hoverScale: 1.6 // Scale factor on link hover
        },
        animations: {
            scrollThreshold: 0.15, // Trigger when 15% visible
            staggerDelay: 120, // ms delay between staggered items
            letterDelay: 40, // ms delay between letters
            letterRandomOffset: 250 // ms max random additional delay for letters
        },
        aiDemo: {
            enabled: true,
            typingSpeed: 40, // ms per character
            stepBaseDelay: 200, // ms base delay between steps
            stepRandomDelay: 450 // ms max random additional delay
        },
        testimonials: {
            enabled: true, // Enable/disable testimonial simulation
            placeholderAvatarBaseUrl: 'https://placehold.co/100x100/'
        }
    };

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
        hamburger.setAttribute('aria-label', shouldOpen ? 'Zavřít menu' : 'Otevřít menu'); // Update label

        if (shouldOpen) {
             navLinks.querySelector('a')?.focus(); // Focus first link when opening
        } else {
            hamburger.focus(); // Return focus to hamburger when closing
        }
        console.log(`Mobile menu toggled: ${shouldOpen ? 'Open' : 'Closed'}`);
    };

    // Debounce function to limit resize/scroll event frequency
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
    const handleScroll = () => {
        if (header) {
            header.classList.toggle('scrolled', window.scrollY > 50);
        }
    };
    window.addEventListener('scroll', debounce(handleScroll, 15), { passive: true });
    handleScroll(); // Initial check

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
                // Don't close menu if it's an external link or non-anchor link
                if (link.getAttribute('href')?.startsWith('#') || link.getAttribute('href')?.startsWith('/#')) {
                     if (navLinks.classList.contains('active')) {
                         // Smooth scroll handles closing, prevent double close
                         if (!e.defaultPrevented) { // Only close if smooth scroll didn't prevent default
                             toggleMenu(false);
                         }
                     }
                }
            });
        });
         // Keyboard accessibility for menu
         navLinks.addEventListener('keydown', (e) => {
             if (e.key === 'Escape' && navLinks.classList.contains('active')) {
                 toggleMenu(false);
             }
         });
    }
    console.log("Hamburger menu initialized.");


    // 4. Mouse Follower
    if (config.mouseFollower.enabled && follower && !window.matchMedia('(hover: none)').matches) { // Check config & touch device media query
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

            // Determine target scale based on hover state
            const targetScale = isHoveringLink ? config.mouseFollower.hoverScale : (body.matches(':active') ? config.mouseFollower.clickScale : 1);
            // Smoothly transition scale
            currentScale += (targetScale - currentScale) * 0.2; // Adjust smoothing factor as needed

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
            if (!animationFrameId) { // Start animation if stopped
                 animationFrameId = requestAnimationFrame(updateFollower);
             }
        }, { passive: true });

        // Detect hover over interactive elements for scaling effect
        document.addEventListener('mouseover', (e) => {
             if (e.target.closest('a, button, .btn')) {
                 isHoveringLink = true;
                 follower.classList.add('follower-hover'); // Add class for potential style changes
             }
         });
        document.addEventListener('mouseout', (e) => {
             if (e.target.closest('a, button, .btn')) {
                 isHoveringLink = false;
                  follower.classList.remove('follower-hover');
             }
         });

        // Stop animation when mouse leaves window to save resources
         document.addEventListener('mouseleave', () => {
             if (animationFrameId) {
                 cancelAnimationFrame(animationFrameId);
                 animationFrameId = null;
                 // Optionally fade out or hide follower
                 // follower.style.opacity = '0';
             }
         });
         document.addEventListener('mouseenter', () => {
             // follower.style.opacity = '1'; // Fade back in
             if (!animationFrameId) {
                 mouseX = window.innerWidth / 2; // Reset position roughly center
                 mouseY = window.innerHeight / 2;
                 followerX = mouseX;
                 followerY = mouseY;
                 animationFrameId = requestAnimationFrame(updateFollower);
             }
         });


        animationFrameId = requestAnimationFrame(updateFollower); // Initial start
        console.log("Mouse follower activated.");
    } else if (!follower) {
        console.warn("Mouse follower element not found.");
    } else if (window.matchMedia('(hover: none)').matches) {
        console.log("Mouse follower disabled on likely touch device.");
        follower.style.display = 'none'; // Hide it completely
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
             // { text: "Awaiting User Interaction.", type: "status" } // Optional final line
        ];
        const progressIncrement = 100 / (demoTexts.length - 1 || 1); // Calculate progress increment

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
                 if(currentTextIndex >= demoTexts.length) {
                     aiProgressBar.style.width = '100%'; // Ensure it reaches 100%
                     console.log("AI Demo sequence finished.");
                 }
                 demoIsRunning = false;
                 if (demoTimeoutId) clearTimeout(demoTimeoutId);
                return;
            }

            const item = demoTexts[currentTextIndex];
            const logLine = document.createElement('p');
            logLine.classList.add('ai-log-line', item.type || 'status');
            logLine.setAttribute('role', 'logitem'); // Accessibility

            aiStatusIndicator.textContent = item.progressText || "PROCESSING"; // Update status

            // Handle input simulation
            if (item.type === 'input') {
                aiFakeInput.parentElement?.classList.add('typing'); // Show cursor is active
                await typeText(aiFakeInput, item.text, item.inputSpeed || config.aiDemo.typingSpeed);
                await new Promise(resolve => setTimeout(resolve, 300)); // Pause after typing
                logLine.textContent = `> ${item.text}`;
                aiFakeInput.textContent = '';
                aiFakeInput.parentElement?.classList.remove('typing');
            } else {
                // Type out the log line directly for visual effect
                 await typeText(logLine, item.text, config.aiDemo.typingSpeed);
            }

            aiOutput.appendChild(logLine);
            // Smooth scroll to the bottom
            aiOutput.scrollTo({ top: aiOutput.scrollHeight, behavior: 'smooth' });


            // Update progress bar and label (don't increment progress for the very first step)
            if (currentTextIndex > 0 || demoTexts.length === 1) {
                currentProgress += progressIncrement;
            }
            const displayProgress = Math.min(currentProgress, 100);
             aiProgressBar.style.width = `${displayProgress}%`;
            aiProgressBar.setAttribute('aria-valuenow', Math.round(displayProgress));
            aiProgressLabel.textContent = `${item.progressText || item.type || 'Status'} // ${item.text.substring(0, 30)}...`;

            currentTextIndex++;

            // Schedule next step
            const delay = (item.delay || 0) + config.aiDemo.stepBaseDelay + Math.random() * config.aiDemo.stepRandomDelay;
            if (demoIsRunning) { // Check again in case observer triggered stop
                demoTimeoutId = setTimeout(runAIDemoStep, delay);
            }
        };

        const startDemo = () => {
            if (demoIsRunning) return; // Prevent multiple starts
            console.log("AI Demo section intersecting, starting simulation...");
            demoIsRunning = true;
            aiOutput.innerHTML = ''; // Clear previous logs
            aiFakeInput.textContent = '';
            aiProgressBar.style.width = '0%';
            aiProgressBar.setAttribute('aria-valuenow', '0');
            aiStatusIndicator.textContent = "INITIALIZING";
            aiProgressLabel.textContent = "Initializing // Please wait...";
            currentTextIndex = 0;
            currentProgress = 0;
             if (demoTimeoutId) clearTimeout(demoTimeoutId); // Clear any pending timeouts
            runAIDemoStep(); // Start the sequence
        };

        const stopDemo = () => {
            if (!demoIsRunning) return;
            console.log("AI Demo section out of view, stopping simulation.");
             demoIsRunning = false;
             if (demoTimeoutId) clearTimeout(demoTimeoutId);
             aiStatusIndicator.textContent = "PAUSED";
             aiProgressLabel.textContent = "Demo Paused // Scroll down to resume";
        }

        // Intersection Observer for AI Demo
        const demoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    startDemo();
                } else {
                    stopDemo();
                }
            });
        }, { threshold: 0.5 }); // Trigger when 50% is visible

        demoObserver.observe(demoSection);
        console.log("AI Demo observer attached.");

    } else {
        console.warn("AI Demo elements or section not found, or demo disabled in config.");
    }

    // 6. Scroll Animations (Refactored)
    const animateOnScroll = (entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const delay = (parseInt(element.style.getPropertyValue('--animation-order') || '0', 10)) * config.animations.staggerDelay;

                // Letter Animation
                if (element.hasAttribute('data-animate-letters') && !element.classList.contains('letters-animated')) {
                    element.classList.add('letters-animating'); // State class
                    const text = element.textContent?.trim() ?? '';
                    element.innerHTML = ''; // Clear for spans

                    text.split('').forEach((char, charIndex) => {
                        const span = document.createElement('span');
                        span.textContent = char === ' ' ? '\u00A0' : char; // Handle spaces
                        const randomDelay = Math.random() * config.animations.letterRandomOffset;
                        span.style.animation = `letter-pop-in 0.6s ${delay + charIndex * config.animations.letterDelay + randomDelay}ms forwards cubic-bezier(0.2, 0.8, 0.2, 1.2)`; // Added bounce
                        element.appendChild(span);
                    });
                    element.classList.add('letters-animated'); // Mark as animated
                    console.log("Letter animation triggered for:", element);
                    observer.unobserve(element); // Animate only once
                }
                // General Animation
                else if (element.hasAttribute('data-animate') && !element.classList.contains('animated')) {
                     setTimeout(() => {
                         element.classList.add('animated');
                         console.log("General animation triggered for:", element, "with delay:", delay);
                         observer.unobserve(element); // Animate only once
                     }, delay);
                }
             }
            // No 'else' needed if we unobserve after animating
        });
    };

    const scrollObserver = new IntersectionObserver(animateOnScroll, {
        threshold: config.animations.scrollThreshold,
    });

    animatedElements.forEach(el => scrollObserver.observe(el));
    console.log(`Scroll observer attached to ${animatedElements.length} elements.`);


    // 7. Smooth Scroll for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#') return; // Ignore empty or '#' links

            try {
                 const targetElement = document.querySelector(href);
                 if (targetElement) {
                    e.preventDefault(); // Prevent default only if target exists
                     console.log(`Smooth scrolling to ${href}`);
                    const headerOffset = header?.offsetHeight || 70;
                     const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                     window.scrollTo({
                         top: offsetPosition,
                         behavior: "smooth"
                     });

                     // Close mobile menu after scroll initiated
                     toggleMenu(false);

                     // Optional: Update focus to the target section after scroll
                     // setTimeout(() => {
                     //    targetElement.setAttribute('tabindex', '-1'); // Make it focusable
                     //    targetElement.focus({ preventScroll: true }); // Focus without scrolling again
                     // }, 1000); // Delay allows scroll to finish roughly

                 } else {
                     console.warn(`Smooth scroll target element not found for selector: ${href}`);
                     // Allow default behavior for links like #cookie-settings-link if needed
                     // If the target doesn't exist, maybe it's a link to another page starting with #?
                     // In a real SPA, you'd handle this differently.
                 }
            } catch (err) {
                console.error(`Error finding element for smooth scroll selector: ${href}`, err);
                 // Allow default behavior in case of selector error
             }
        });
    });
    console.log("Smooth scroll initialized for anchor links.");

    // 8. Dynamic Testimonials Simulation
    if (config.testimonials.enabled && testimonialsContainer) {
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
             // Use more specific selectors if available, otherwise fallback
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
                 if (nameEl) avatarEl.setAttribute('aria-labelledby', nameEl.id || ''); // Link avatar to name if name has ID
            }
        };

        const loadRandomTestimonials = () => {
            const cards = testimonialsContainer.querySelectorAll('.testimonial-card');
            if (!cards.length) return;

            const shuffledTestimonials = [...sampleTestimonials].sort(() => 0.5 - Math.random());

            cards.forEach((card, index) => {
                const testimonialData = shuffledTestimonials[index % shuffledTestimonials.length];
                updateTestimonialCard(card, testimonialData);
            });
            console.log("Simulated testimonials loaded.");
        };

        loadRandomTestimonials(); // Load on initial page load

    } else {
         console.warn("Testimonials container not found or feature disabled.");
    }


    // --- Final Initialization ---
    console.log("JUSTAX Interface v2.0 Initialization Complete.");

}); // End DOMContentLoaded