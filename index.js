/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, and **INFINITE** testimonial slider.
 * Version: v2.6 (Fixed Init Dimension Calculation - INSECURE DEMO)
 * Author: Gemini Modification
 * Date: 2025-05-02 // Updated init logic
 *
 * !!! SECURITY WARNING !!!
 * This code demonstrates calling the Gemini API directly from the client-side
 * for an infinite testimonial carousel.
 * THIS IS HIGHLY INSECURE as it exposes your API key placeholder.
 * DO NOT USE THIS PATTERN IN PRODUCTION WITH A REAL API KEY.
 * API calls MUST be proxied through your own backend server.
 * The API key placeholder "GEMINI_API_KEY" MUST be replaced later
 * with a call to your secure backend endpoint.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.6 (Fixed Init - INSECURE DEMO)...");

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

    // Testimonial Slider Elements
    const sliderContainer = document.getElementById('testimonialSliderContainer');
    const sliderTrack = document.getElementById('testimonialSliderTrack');
    const prevBtn = document.getElementById('prevTestimonialBtn');
    const nextBtn = document.getElementById('nextTestimonialBtn');

    // --- Configuration ---
    const config = {
        mouseFollower: { enabled: true, followSpeed: 0.1, clickScale: 0.8, hoverScale: 1.6 },
        animations: { scrollThreshold: 0.15, staggerDelay: 120, letterDelay: 40, letterRandomOffset: 250 },
        aiDemo: { enabled: true, typingSpeed: 40, stepBaseDelay: 200, stepRandomDelay: 450 },
        testimonials: {
            // !!! INSECURE !!! Using placeholder key directly in URL structure
            geminiApiKeyPlaceholder: "AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs", // <<<=== ИСПОЛЬЗУЙ ЭТО ТОЛЬКО КАК ЗАПОЛНИТЕЛЬ! НЕ ДЛЯ ПРОДА!
            geminiApiUrlTemplate: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=`, // Base URL, key added in fetch (Using 1.5 Flash as example)
            placeholderAvatarBaseUrl: 'https://placehold.co/100x100/',
            // --- Infinite Slider Config ---
            visibleCardsDesktop: 3, // How many cards are fully visible on desktop
            bufferCards: 2,         // How many extra cards to load on each side (before/after visible ones)
            // fetchBatchSize: 3,      // How many new testimonials to fetch at once when needed (can be added later)
            slideDuration: 500      // Corresponds to CSS transition duration in ms
        }
    };

    // --- Testimonial Slider State (Infinite Scroll) ---
    let testimonialDataCache = []; // Holds fetched testimonial data objects
    let cardsInTrack = []; // Holds the actual DOM elements of the cards
    let currentVisibleStartIndex = 0; // Index in the conceptual infinite list (points to the first card *before* the visible ones)
    let totalCardsInDOM = 0; // Actual number of card elements in the DOM track
    let cardWidthAndMargin = 0; // Calculated width + margin of a single card
    let isSliding = false; // Flag to prevent multiple clicks during animation
    let isFetching = false; // Flag to prevent concurrent API calls
    let resizeTimeout; // Timeout ID for debounced resize handling
    let initialLoadComplete = false; // Flag to indicate successful initialization

    // --- Utility Functions ---
    const setYear = () => { if (yearSpan) yearSpan.textContent = new Date().getFullYear(); };
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
        if (shouldOpen) navLinks.querySelector('a')?.focus(); else hamburger.focus();
    };
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); };
    };

    // --- Feature Initializations ---

    // 1. Update Copyright Year
    setYear();

    // 2. Header Scroll Effect
    const handleScrollHeader = () => { if (header) header.classList.toggle('scrolled', window.scrollY > 50); };
    window.addEventListener('scroll', debounce(handleScrollHeader, 15), { passive: true });
    handleScrollHeader();

    // 3. Hamburger Menu Logic
    if (hamburger) hamburger.addEventListener('click', () => toggleMenu());
    if (menuOverlay) menuOverlay.addEventListener('click', () => toggleMenu(false));
    if (navLinks) {
        navLinks.querySelectorAll('a').forEach(link => { link.addEventListener('click', (e) => { if (link.getAttribute('href')?.startsWith('#') || link.getAttribute('href')?.startsWith('/#')) { if (navLinks.classList.contains('active') && !e.defaultPrevented) toggleMenu(false); } }); });
        navLinks.addEventListener('keydown', (e) => { if (e.key === 'Escape' && navLinks.classList.contains('active')) toggleMenu(false); });
    }
    console.log("Hamburger menu initialized.");

    // 4. Mouse Follower
    if (config.mouseFollower.enabled && follower && !window.matchMedia('(hover: none)').matches) {
        let mouseX = 0, mouseY = 0; let followerX = 0, followerY = 0; let currentScale = 1; let isHoveringLink = false; let animationFrameId = null;
        const updateFollower = () => { const dx = mouseX - followerX; const dy = mouseY - followerY; followerX += dx * config.mouseFollower.followSpeed; followerY += dy * config.mouseFollower.followSpeed; const targetScale = isHoveringLink ? config.mouseFollower.hoverScale : (body.matches(':active') ? config.mouseFollower.clickScale : 1); currentScale += (targetScale - currentScale) * 0.2; const roundedX = Math.round(followerX); const roundedY = Math.round(followerY); follower.style.transform = `translate(-50%, -50%) scale(${currentScale.toFixed(3)})`; follower.style.left = `${roundedX}px`; follower.style.top = `${roundedY}px`; animationFrameId = requestAnimationFrame(updateFollower); };
        document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; if (!animationFrameId) animationFrameId = requestAnimationFrame(updateFollower); }, { passive: true });
        document.addEventListener('mouseover', (e) => { if (e.target.closest('a, button, .btn')) { isHoveringLink = true; follower.classList.add('follower-hover'); } }); document.addEventListener('mouseout', (e) => { if (e.target.closest('a, button, .btn')) { isHoveringLink = false; follower.classList.remove('follower-hover'); } });
        document.addEventListener('mouseleave', () => { if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; } }); document.addEventListener('mouseenter', () => { if (!animationFrameId) { mouseX = window.innerWidth / 2; mouseY = window.innerHeight / 2; followerX = mouseX; followerY = mouseY; animationFrameId = requestAnimationFrame(updateFollower); } });
        animationFrameId = requestAnimationFrame(updateFollower); console.log("Mouse follower activated.");
    } else if (!follower) console.warn("Mouse follower element not found."); else if (window.matchMedia('(hover: none)').matches) { console.log("Mouse follower disabled on likely touch device."); if (follower) follower.style.display = 'none'; }

    // 5. AI Demo Simulation (Keep existing logic)
    if (config.aiDemo.enabled && demoSection && aiOutput && aiProgressBar && aiProgressLabel && aiFakeInput && aiStatusIndicator) {
        let currentTextIndex = 0; let currentProgress = 0; let demoIsRunning = false; let demoTimeoutId = null;
        const demoTexts = [
             { text: "Boot Sequence Initiated...", type: "status", delay: 500 }, { text: "Loading AI Core v19...", type: "status" }, { text: "Accessing Neural Network Interface...", type: "status" }, { text: "Query Received: 'Optimal Learning Path - Math (Grade 9)'", type: "input", inputSpeed: 60 }, { text: "Processing User Profile: CyberMike_77...", type: "process" }, { text: "Scanning Knowledge Base (Algebra, Geometry, Functions)...", type: "process", progressText: "Scanning KB" }, { text: "Analyzing performance metrics...", type: "analysis" }, { text: "Identified Weak Points: Polynomial Factoring, Circle Theorems.", type: "analysis", progressText: "Analyzing Weaknesses" }, { text: "WARNING: Low confidence score in Trigonometric Identities.", type: "warning", delay: 300 }, { text: "Executing Adaptive Path Correction Subroutine...", type: "process" }, { text: "Generating Personalized Lesson Plan...", type: "process", progressText: "Generating Plan" }, { text: "Module 1: Interactive Polynomial Factoring Drill.", type: "output" }, { text: "Module 2: Visual Proofs for Circle Theorems.", type: "output" }, { text: "Module 3: Targeted Practice: Trig Identities.", type: "output" }, { text: "Calculating Optimal Time Allocation...", type: "analysis" }, { text: "Simulating CERMAT Exam Conditions (Difficulty Level: High)...", type: "process", progressText: "Simulating Exam" }, { text: "Cross-referencing with historical exam patterns...", type: "process" }, { text: "Optimization Complete. Learning Path Ready.", type: "status", delay: 500, final: true },
        ];
        const progressIncrement = 100 / (demoTexts.length - 1 || 1);
        const typeText = (element, text, speed) => new Promise((resolve) => {
             let i = 0; element.textContent = ''; const intervalId = setInterval(() => { if (i < text.length) { element.textContent += text.charAt(i); i++; } else { clearInterval(intervalId); resolve(); } }, speed);
         });
        const runAIDemoStep = async () => {
             if (currentTextIndex >= demoTexts.length || !demoIsRunning) { aiStatusIndicator.textContent = "IDLE"; aiProgressLabel.textContent = currentTextIndex >= demoTexts.length ? "Processing Complete" : "Demo Stopped"; if(currentTextIndex >= demoTexts.length) aiProgressBar.style.width = '100%'; demoIsRunning = false; if (demoTimeoutId) clearTimeout(demoTimeoutId); return; } const item = demoTexts[currentTextIndex]; const logLine = document.createElement('p'); logLine.classList.add('ai-log-line', item.type || 'status'); logLine.setAttribute('role', 'logitem'); aiStatusIndicator.textContent = item.progressText || "PROCESSING"; if (item.type === 'input') { aiFakeInput.parentElement?.classList.add('typing'); await typeText(aiFakeInput, item.text, item.inputSpeed || config.aiDemo.typingSpeed); await new Promise(resolve => setTimeout(resolve, 300)); logLine.textContent = `> ${item.text}`; aiFakeInput.textContent = ''; aiFakeInput.parentElement?.classList.remove('typing'); } else { await typeText(logLine, item.text, config.aiDemo.typingSpeed); } aiOutput.appendChild(logLine); aiOutput.scrollTo({ top: aiOutput.scrollHeight, behavior: 'smooth' }); if (currentTextIndex > 0 || demoTexts.length === 1) currentProgress += progressIncrement; const displayProgress = Math.min(currentProgress, 100); aiProgressBar.style.width = `${displayProgress}%`; aiProgressBar.setAttribute('aria-valuenow', Math.round(displayProgress)); aiProgressLabel.textContent = `${item.progressText || item.type || 'Status'} // ${item.text.substring(0, 30)}...`; currentTextIndex++; const delay = (item.delay || 0) + config.aiDemo.stepBaseDelay + Math.random() * config.aiDemo.stepRandomDelay; if (demoIsRunning) demoTimeoutId = setTimeout(runAIDemoStep, delay);
         };
        const startDemo = () => {
             if (demoIsRunning) return; console.log("AI Demo section intersecting, starting simulation..."); demoIsRunning = true; aiOutput.innerHTML = ''; aiFakeInput.textContent = ''; aiProgressBar.style.width = '0%'; aiProgressBar.setAttribute('aria-valuenow', '0'); aiStatusIndicator.textContent = "INITIALIZING"; aiProgressLabel.textContent = "Initializing // Please wait..."; currentTextIndex = 0; currentProgress = 0; if (demoTimeoutId) clearTimeout(demoTimeoutId); runAIDemoStep();
         };
        const stopDemo = () => {
             if (!demoIsRunning) return; console.log("AI Demo section out of view, stopping simulation."); demoIsRunning = false; if (demoTimeoutId) clearTimeout(demoTimeoutId); aiStatusIndicator.textContent = "PAUSED"; aiProgressLabel.textContent = "Demo Paused // Scroll down to resume";
        };
        const demoObserver = new IntersectionObserver((entries) => entries.forEach(entry => { if (entry.isIntersecting) startDemo(); else stopDemo(); }), { threshold: 0.5 });
        if (demoSection) demoObserver.observe(demoSection);
        console.log("AI Demo observer attached.");
    } else console.warn("AI Demo elements or section not found, or demo disabled in config.");


    // 6. Scroll Animations (Intersection Observer - Keep existing logic)
    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
             if (entry.isIntersecting) { const element = entry.target; const delay = (parseInt(element.style.getPropertyValue('--animation-order') || '0', 10)) * config.animations.staggerDelay; if (element.hasAttribute('data-animate-letters') && !element.classList.contains('letters-animated')) { element.classList.add('letters-animating'); const text = element.textContent?.trim() ?? ''; element.innerHTML = ''; text.split('').forEach((char, charIndex) => { const span = document.createElement('span'); span.textContent = char === ' ' ? '\u00A0' : char; const randomDelay = Math.random() * config.animations.letterRandomOffset; span.style.animation = `letter-pop-in 0.6s ${delay + charIndex * config.animations.letterDelay + randomDelay}ms forwards cubic-bezier(0.2, 0.8, 0.2, 1.2)`; element.appendChild(span); }); element.classList.add('letters-animated'); observer.unobserve(element); } else if (element.hasAttribute('data-animate') && !element.classList.contains('animated')) { setTimeout(() => { element.classList.add('animated'); observer.unobserve(element); }, delay); } else { observer.unobserve(element); } }
         });
    }, {
        threshold: config.animations.scrollThreshold,
    });
    document.querySelectorAll('[data-animate], [data-animate-letters]').forEach(el => scrollObserver.observe(el));
    console.log(`Scroll observer attached for entry animations.`);

    // 7. Smooth Scroll for Anchor Links (Keep existing logic)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
             const href = this.getAttribute('href'); if (!href || href === '#') return; try { const targetElement = document.querySelector(href); if (targetElement) { e.preventDefault(); const headerOffset = header?.offsetHeight || 70; const elementPosition = targetElement.getBoundingClientRect().top; const offsetPosition = elementPosition + window.pageYOffset - headerOffset; window.scrollTo({ top: offsetPosition, behavior: "smooth" }); toggleMenu(false); } else console.warn(`Smooth scroll target element not found: ${href}`); } catch (err) { console.error(`Error finding element for smooth scroll: ${href}`, err); }
         });
    });
    console.log("Smooth scroll initialized.");

    // ========================================================
    // 8. Infinite Testimonial Slider Implementation
    //    !!! USES INSECURE Client-Side Gemini API Call !!!
    // ========================================================
    if (sliderContainer && sliderTrack && prevBtn && nextBtn) {
        console.log("Initializing Infinite Testimonial Slider v2.6...");

        // --- Helper Functions for Slider ---

        const getRandomColorPair = () => {
            const colors = [ { bg: 'a05cff', text: 'FFFFFF' }, { bg: '00e0ff', text: '03020c' }, { bg: 'ff33a8', text: 'FFFFFF' }, { bg: 'f0e14a', text: '03020c' }, { bg: '00ffaa', text: '03020c' }, { bg: 'ff9a00', text: 'FFFFFF' } ];
            return colors[Math.floor(Math.random() * colors.length)];
        };

        const generateStarsHTML = (rating) => {
            let starsHTML = '';
            const clampedRating = Math.max(0, Math.min(5, rating || 0));
            const fullStars = Math.floor(clampedRating);
            const halfStar = clampedRating % 1 >= 0.45;
            const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
            for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fas fa-star" aria-hidden="true"></i>';
            if (halfStar) starsHTML += '<i class="fas fa-star-half-alt" aria-hidden="true"></i>';
            for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star" aria-hidden="true"></i>';
            return starsHTML;
        };

        // Creates a placeholder testimonial card element
        const createPlaceholderCard = () => {
            const card = document.createElement('article');
            card.className = 'testimonial-card is-loading';
            card.innerHTML = '<div class="spinner"></div>';
            card.setAttribute('aria-hidden', 'true'); // Hide placeholders from screen readers initially
            return card;
        };

        // Updates the content of an existing card element with new data
        const updateCardContent = (cardElement, testimonialData) => {
            if (!cardElement || !testimonialData) return; // Exit if no element or data

            cardElement.classList.remove('is-loading');
            cardElement.removeAttribute('aria-hidden'); // Make visible to screen readers
            cardElement.innerHTML = `
                <div class="testimonial-content">
                    <div class="testimonial-rating" aria-label="Hodnocení"></div>
                    <blockquote class="testimonial-text">
                        <p class="testimonial-text-content"></p>
                    </blockquote>
                </div>
                <div class="testimonial-author">
                    <div class="testimonial-avatar" role="img"></div>
                    <div class="testimonial-author-info">
                        <div class="testimonial-name"></div>
                        <div class="testimonial-role"></div>
                    </div>
                </div>
            `;

            const ratingEl = cardElement.querySelector('.testimonial-rating');
            const textEl = cardElement.querySelector('.testimonial-text-content');
            const nameEl = cardElement.querySelector('.testimonial-name');
            const roleEl = cardElement.querySelector('.testimonial-role');
            const avatarEl = cardElement.querySelector('.testimonial-avatar');

            const name = testimonialData.name || 'AI Uživatel';
            const role = testimonialData.role || 'Student';
            const rating = testimonialData.rating;
            const text = testimonialData.text || 'Nepodařilo se načíst text recenze.';

            if (ratingEl) {
                ratingEl.innerHTML = generateStarsHTML(rating);
                ratingEl.setAttribute('aria-label', `Hodnocení: ${rating?.toFixed(1) || 0} z 5 hvězdiček`);
            }
            if (textEl) textEl.textContent = text;
            if (nameEl) nameEl.textContent = name;
            if (roleEl) roleEl.textContent = role;
            if (avatarEl) {
                const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '??';
                const colors = getRandomColorPair();
                const avatarUrl = `${config.testimonials.placeholderAvatarBaseUrl}${colors.bg}/${colors.text}/png?text=${encodeURIComponent(initials)}&font=poppins`;
                avatarEl.style.backgroundImage = `url('${avatarUrl}')`;
                avatarEl.setAttribute('aria-label', `Avatar ${name}`);
            }
        };

        // ***** INSECURE FUNCTION to call Gemini API Directly *****
        // ***** MUST BE REPLACED by a call to your secure backend *****
        const fetchTestimonialFromGeminiAPI = async () => {
             // NOTE: isFetching flag is managed outside this function now before calling
             console.log("Fetching new testimonial directly from Gemini API (INSECURE)...");
             // Buttons are disabled by the caller (moveSlider or initialize)

            const apiKey = config.testimonials.geminiApiKeyPlaceholder;
             if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY" || apiKey.length < 20) {
                 console.error("API Key Placeholder is not set or is invalid! Cannot fetch testimonials.");
                 return { name: "Chyba Konfigurace", text: "Chybí platný API klíč pro Gemini.", rating: 0, role:"Systém"};
             }
             const apiUrl = config.testimonials.geminiApiUrlTemplate + apiKey;

             const existingNames = testimonialDataCache.map(t => t?.name).filter(Boolean).join(', ');
             const existingTexts = testimonialDataCache.map(t => t?.text?.substring(0, 50)).filter(Boolean).join('; ');

             const prompt = `Napiš 1 unikátní, krátkou, pozitivní recenzi (testimonial) pro online AI vzdělávací platformu Justax v češtině.
             Recenze by měla být od fiktivního českého studenta, rodiče nebo učitele (uveď roli).
             Zahrň hodnocení od 3.5 do 5 hvězdiček (může být i půl hvězdičky, např. 4.5).
             Text recenze by měl být specifický, ale stručný (1-3 věty).

             DŮLEŽITÉ:
             1.  Vymysli **nové, neopakující se české jméno a příjmení** (např. Klára S., Tomáš P.). Vyhni se těmto jménům: ${existingNames.substring(0, 200) || 'žádná'}.
             2.  Napiš **originální text recenze**, který se liší od těchto začátků: ${existingTexts.substring(0, 300) || 'žádné'}. Zdůrazni jiný přínos platformy (např. příprava na přijímačky, zlepšení známek, AI tutor, flexibilita, interaktivita).
             3.  Naformátuj odpověď **PŘESNĚ** takto, každý údaj na novém řádku:
                 Jméno: [Nové české jméno a příjmení]
                 Role: [Student/Rodič/Učitel]
                 Hodnocení: [Číslo mezi 3.5 a 5, např. 4.5]
                 Text: [Nový text recenze, 1-3 věty.]`;


            const requestBody = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.85,
                    maxOutputTokens: 180,
                }
            };

            let testimonialData = { name: "Chyba API", text: "Nepodařilo se načíst data.", rating: 0, role:"Systém"};

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(15000)
                });

                if (!response.ok) {
                    let errorBody = null;
                    try { errorBody = await response.json(); } catch (e) { /* ignore */ }
                    console.error("Gemini API Error Response:", response.status, errorBody);
                    throw new Error(`Gemini API error! Status: ${response.status}. ${errorBody?.error?.message || 'No details'}`);
                }

                const data = await response.json();

                if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                    const generatedText = data.candidates[0].content.parts[0].text;
                    // console.log("Generated Text:", generatedText); // Less verbose logging

                    const lines = generatedText.split('\n');
                    const parsedData = { name: null, role: null, rating: null, text: null };
                    lines.forEach(line => {
                        const lowerLine = line.toLowerCase();
                        if (lowerLine.startsWith("jméno:")) parsedData.name = line.substring(6).trim();
                        else if (lowerLine.startsWith("role:")) parsedData.role = line.substring(5).trim();
                        else if (lowerLine.startsWith("hodnocení:")) {
                            const ratingMatch = line.match(/[\d.,]+/);
                            if (ratingMatch) parsedData.rating = parseFloat(ratingMatch[0].replace(',', '.'));
                        }
                        else if (lowerLine.startsWith("text:")) parsedData.text = line.substring(5).trim();
                    });

                     testimonialData.name = parsedData.name || `AI Uživatel #${Math.floor(Math.random() * 1000)}`;
                     testimonialData.role = parsedData.role || "Student";
                     testimonialData.rating = (parsedData.rating >= 3 && parsedData.rating <= 5) ? parsedData.rating : 4.5;
                     // Ensure text isn't empty if parsing failed but text was generated
                     testimonialData.text = parsedData.text || generatedText.trim().split('\n').pop() || "Generovaný text bez specifikace.";


                    // console.log("Parsed Testimonial Data:", testimonialData); // Less verbose logging

                } else if (data.promptFeedback?.blockReason) {
                     console.error("Gemini API Blocked:", data.promptFeedback.blockReason, data.promptFeedback.safetyRatings);
                     testimonialData.text = `Obsah blokován API (${data.promptFeedback.blockReason})`;
                }
                 else {
                    console.error("Unexpected Gemini API response structure:", data);
                    testimonialData.text = "Chyba při zpracování odpovědi API.";
                }

            } catch (error) {
                console.error("Error calling/parsing Gemini API:", error);
                 testimonialData.text = `Nepodařilo se kontaktovat AI (${error.name === 'TimeoutError' ? 'časový limit vypršel' : error.message})`;
            } finally {
                // isFetching flag and button state are managed by the caller
                console.log("Gemini API fetch attempt finished.");
            }
             return testimonialData;
        };
        // ***** END OF INSECURE FUNCTION *****


        // Calculates the full width of a card including its right margin
        const calculateCardWidthAndMargin = () => {
            // Try to find the first card that IS NOT a placeholder anymore
            const firstCard = sliderTrack.querySelector('.testimonial-card:not(.is-loading)');
            if (!firstCard) {
                console.warn("calculateCardWidthAndMargin: No non-loading card found yet.");
                // Fallback: try measuring a placeholder if available
                const placeholderCard = sliderTrack.querySelector('.testimonial-card');
                if (!placeholderCard) return 0; // No cards at all
                const pStyle = window.getComputedStyle(placeholderCard);
                const pWidth = placeholderCard.offsetWidth;
                const pMarginRight = parseFloat(pStyle.marginRight);
                if (pWidth > 0) {
                     cardWidthAndMargin = pWidth + pMarginRight;
                     console.log(`Recalculated cardWidthAndMargin from placeholder: ${cardWidthAndMargin}px (Width: ${pWidth}, Margin: ${pMarginRight})`);
                     return cardWidthAndMargin;
                }
                return 0; // Still couldn't measure
            }

            const style = window.getComputedStyle(firstCard);
            const width = firstCard.offsetWidth;
            const marginRight = parseFloat(style.marginRight);

            if (width === 0) {
                console.warn("calculateCardWidthAndMargin: First non-loading card has zero width. Layout might not be ready.");
                return 0;
            }

            cardWidthAndMargin = width + marginRight;
            console.log(`Recalculated cardWidthAndMargin: ${cardWidthAndMargin}px (Width: ${width}, Margin: ${marginRight})`);
            return cardWidthAndMargin;
        };

        // Sets the slider track's position instantly (without transition)
        const setTrackPosition = (cardIndex) => {
            if (!initialLoadComplete || cardWidthAndMargin === 0) {
                console.warn("Cannot set track position: Initial load incomplete or card width unknown.");
                return;
            }
            sliderTrack.style.transition = 'none'; // Disable animation for instant jump
            // We position based on the start of the *buffer* cards before the visible ones
            const position = -cardIndex * cardWidthAndMargin;
            sliderTrack.style.transform = `translateX(${position}px)`;
            // Force reflow to apply the change immediately before re-enabling transition
            void sliderTrack.offsetHeight; // Reading offsetHeight forces reflow
            sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`; // Re-enable animation
            console.log(`Track position instantly set to index ${cardIndex} (translateX: ${position}px)`);
        };

        // Handles the end of the slide animation for infinite looping
        const handleTransitionEnd = async () => {
            if (!initialLoadComplete) return; // Don't run if slider hasn't initialized

            const direction = parseInt(sliderTrack.dataset.slideDirection || "0");
            console.log(`Transition ended. Direction: ${direction}`);

            if (direction === 0) {
                 isSliding = false; // Ensure flag is reset if no slide occurred
                 // Re-enable buttons if not fetching (safety check)
                 if (!isFetching) {
                     prevBtn.disabled = false;
                     nextBtn.disabled = false;
                 }
                 return;
            }

            sliderTrack.style.transition = 'none'; // Disable transition for DOM manipulation

            // Start fetching the next required testimonial in the background
            let fetchPromise = null;
            if (!isFetching) { // Only fetch if not already fetching
                isFetching = true; // Set fetching flag
                fetchPromise = fetchTestimonialFromGeminiAPI();
            } else {
                 console.warn("Transition end: Already fetching, skipping new fetch.");
                 fetchPromise = Promise.resolve(null); // Resolve immediately if already fetching
            }


            if (direction > 0) { // Moved Right (Next)
                const firstCard = cardsInTrack.shift();
                sliderTrack.removeChild(firstCard);
                sliderTrack.appendChild(firstCard);
                cardsInTrack.push(firstCard);

                // Adjust position instantly
                currentVisibleStartIndex++;
                const currentTranslateX = parseFloat(sliderTrack.style.transform.replace(/[^-\d.]/g, '')) || 0;
                const newTranslateX = currentTranslateX + cardWidthAndMargin;
                sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
                console.log(`Moved card first->last. New logical start index: ${currentVisibleStartIndex}. Adjusted translateX to: ${newTranslateX}px`);

                 // Wait for the fetch to complete (or resolve immediately if skipped)
                 const newData = await fetchPromise;
                 isFetching = false; // Reset fetching flag AFTER await

                // Update cache & card content
                testimonialDataCache.shift();
                testimonialDataCache.push(newData || { name: "...", text: "Načítání...", rating: 0, role:""});
                updateCardContent(firstCard, testimonialDataCache[testimonialDataCache.length - 1]);


            } else { // Moved Left (Prev)
                const lastCard = cardsInTrack.pop();
                sliderTrack.removeChild(lastCard);
                sliderTrack.insertBefore(lastCard, sliderTrack.firstChild);
                cardsInTrack.unshift(lastCard);

                // Adjust position instantly
                currentVisibleStartIndex--;
                const currentTranslateX = parseFloat(sliderTrack.style.transform.replace(/[^-\d.]/g, '')) || 0;
                const newTranslateX = currentTranslateX - cardWidthAndMargin;
                sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
                 console.log(`Moved card last->first. New logical start index: ${currentVisibleStartIndex}. Adjusted translateX to: ${newTranslateX}px`);

                 // Wait for the fetch to complete
                 const newData = await fetchPromise;
                 isFetching = false; // Reset fetching flag AFTER await

                // Update cache & card content
                testimonialDataCache.pop();
                testimonialDataCache.unshift(newData || { name: "...", text: "Načítání...", rating: 0, role:""});
                updateCardContent(lastCard, testimonialDataCache[0]);
            }

            // Force reflow before re-enabling transition
            void sliderTrack.offsetHeight;
            sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`;

            // Reset slide direction state
            sliderTrack.dataset.slideDirection = "0";
            isSliding = false; // Allow next slide

             // Re-enable buttons (final state after fetch and DOM manipulation)
             prevBtn.disabled = false;
             nextBtn.disabled = false;
             console.log("handleTransitionEnd complete. Buttons enabled.");
        };


        // Moves the slider track visually
        const moveSlider = (direction) => {
             if (isSliding || !initialLoadComplete) {
                 console.warn(`Slide attempt blocked: isSliding=${isSliding}, initialLoadComplete=${initialLoadComplete}`);
                 return;
             }
             isSliding = true;
             prevBtn.disabled = true;
             nextBtn.disabled = true;
             console.log(`Moving slider. Direction: ${direction}`);

            sliderTrack.dataset.slideDirection = direction.toString(); // Store direction

            const currentTranslateX = parseFloat(sliderTrack.style.transform.replace(/[^-\d.]/g, '')) || (-currentVisibleStartIndex * cardWidthAndMargin); // Recalculate offset based on index if needed
            const newTranslateX = currentTranslateX - (direction * cardWidthAndMargin);

             // Apply the transition class if not already present (it should be set in setTrackPosition and after transitionend)
             if (!sliderTrack.style.transition || sliderTrack.style.transition === 'none') {
                 sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`;
             }

            sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
             console.log(`Animating transform to: ${newTranslateX}px`);

             // handleTransitionEnd will be called automatically by the browser when the CSS transition finishes
        };

        // Initializes the slider - fetches initial data, creates cards, sets position
        const initializeInfiniteSlider = async () => {
            console.log("Starting infinite slider initialization v2.6...");
            isSliding = true; // Prevent interaction during init
            initialLoadComplete = false;
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            sliderTrack.innerHTML = ''; // Clear any existing placeholders
            testimonialDataCache = [];
            cardsInTrack = [];
            cardWidthAndMargin = 0; // Reset width

            const numVisible = config.testimonials.visibleCardsDesktop; // Base on desktop view for initial load
            const numBuffer = config.testimonials.bufferCards;
            totalCardsInDOM = numVisible + 2 * numBuffer; // Total cards to keep in DOM
            currentVisibleStartIndex = numBuffer; // Start showing cards after the initial buffer

            console.log(`Initial setup: Visible=${numVisible}, Buffer=${numBuffer}, TotalInDOM=${totalCardsInDOM}`);

             // 1. Create and Append the FIRST placeholder card
             const firstPlaceholder = createPlaceholderCard();
             sliderTrack.appendChild(firstPlaceholder);
             cardsInTrack.push(firstPlaceholder); // Add to our array tracker

             // 2. Fetch data ONLY for the first card
             console.log("Fetching data for the first card...");
             isFetching = true; // Set fetching flag
             const firstCardData = await fetchTestimonialFromGeminiAPI();
             isFetching = false; // Reset fetching flag

             if (!firstCardData || firstCardData.name === "Chyba Konfigurace" || firstCardData.name === "Chyba API") {
                 console.error("Failed to fetch data for the first card. Aborting initialization.", firstCardData);
                 sliderTrack.innerHTML = `<p style="color: var(--clr-accent-red);">Chyba: Nepodařilo se načíst první recenzi (${firstCardData?.text || 'neznámá chyba'}).</p>`;
                 isSliding = false;
                 return;
             }

             // 3. Update the first card with its data
             updateCardContent(firstPlaceholder, firstCardData);
             testimonialDataCache.push(firstCardData); // Add the fetched data to cache
             console.log("First card loaded and updated.");

             // 4. NOW, calculate dimensions based on the loaded first card
             // Use requestAnimationFrame to wait for the next paint cycle after update
             await new Promise(resolve => requestAnimationFrame(resolve));

             if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
                 console.error("Could not calculate card dimensions AFTER loading first card. Aborting slider setup.");
                 sliderTrack.innerHTML = '<p style="color: var(--clr-accent-red);">Chyba layoutu slideru i po načtení karty.</p>';
                 isSliding = false;
                 return; // Abort
             }

             // 5. Create and append the REMAINING placeholder cards
             const remainingCardsToCreate = totalCardsInDOM - 1;
             for (let i = 0; i < remainingCardsToCreate; i++) {
                 const placeholderCard = createPlaceholderCard();
                 sliderTrack.appendChild(placeholderCard);
                 cardsInTrack.push(placeholderCard);
                 testimonialDataCache.push(null); // Add null placeholders to cache
             }
             console.log(`Added ${remainingCardsToCreate} more placeholder cards.`);

             // 6. Fetch data for the remaining cards in the background
             console.log("Fetching data for remaining cards...");
             const remainingFetchPromises = [];
             // Start fetching from index 1 (since index 0 is already fetched)
             for (let i = 1; i < totalCardsInDOM; i++) {
                 remainingFetchPromises.push(
                     (async (index) => {
                         isFetching = true; // Manage flag per fetch potentially (or keep global)
                         const data = await fetchTestimonialFromGeminiAPI();
                         isFetching = false; // Manage flag per fetch potentially
                         if (data && cardsInTrack[index]) {
                             testimonialDataCache[index] = data; // Update cache
                             updateCardContent(cardsInTrack[index], data); // Update card content
                         } else {
                              testimonialDataCache[index] = { name: "Chyba", text: "Nepodařilo se načíst.", rating: 0, role:"" }; // Cache error
                              if(cardsInTrack[index]) updateCardContent(cardsInTrack[index], testimonialDataCache[index]); // Show error on card
                         }
                     })(i) // Immediately invoke async function with index
                 );
             }
             // We don't strictly need to wait for all fetches here for initialization
             // Promise.all(remainingFetchPromises).then(() => console.log("All remaining initial fetches complete."));

             // 7. Set the initial track position *without* animation
             initialLoadComplete = true; // Mark load as complete HERE before setting position
             setTrackPosition(currentVisibleStartIndex); // Position to show the 'visible' section (index `numBuffer`)

             // 8. Add the transitionend listener *after* initial setup and positioning
             sliderTrack.removeEventListener('transitionend', handleTransitionEnd); // Remove if already exists
             sliderTrack.addEventListener('transitionend', handleTransitionEnd);

             console.log("Infinite slider initialized successfully.");
             isSliding = false; // Re-enable interaction
             prevBtn.disabled = false; // Enable buttons
             nextBtn.disabled = false;

        };


         // --- Event Listeners ---
         prevBtn.addEventListener('click', () => moveSlider(-1));
         nextBtn.addEventListener('click', () => moveSlider(1));

         // Debounced resize handler
         window.addEventListener('resize', debounce(() => {
             if (!initialLoadComplete) return; // Don't run on resize if not initialized
             console.log("Window resized, recalculating slider dimensions...");
             if (calculateCardWidthAndMargin()) {
                 // Reposition instantly based on current logical index
                 setTrackPosition(currentVisibleStartIndex);
             } else {
                 console.error("Failed to recalculate dimensions on resize.");
             }
         }, 250));

         // Start the initialization
         initializeInfiniteSlider();

    } else {
        console.warn("Infinite Testimonial slider elements (container, track, buttons) not found. Slider cannot be initialized.");
    }
    // ========================================================
    // End of Infinite Testimonial Slider Implementation
    // ========================================================


    // --- Final Initialization ---
    console.log("JUSTAX Interface v2.6 Initialization Complete (Fixed Init - INSECURE DEMO).");

}); // End DOMContentLoaded