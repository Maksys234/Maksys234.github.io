/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, and **INFINITE** testimonial slider with pre-fetching.
 * Version: v2.7 (Pre-fetching Implementation - INSECURE DEMO)
 * Author: Gemini Modification
 * Date: 2025-05-02 // Added pre-fetching on button click
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
    console.log("DOM Ready. Initializing JUSTAX Interface v2.7 (Pre-fetching - INSECURE DEMO)...");

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
    let isFetching = false; // Flag to prevent concurrent API calls (global lock for simplicity)
    let resizeTimeout; // Timeout ID for debounced resize handling
    let initialLoadComplete = false; // Flag to indicate successful initialization
    let prefetchPromise = null; // Holds the promise for the ongoing pre-fetch request

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

    // [Code for Year, Header Scroll, Hamburger, Mouse Follower, AI Demo, Scroll Animations, Smooth Scroll remains the same as v2.6]
    // ... (sections 1-7 are identical to previous version) ...
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
        const demoTexts = [ { text: "Boot Sequence Initiated...", type: "status", delay: 500 }, { text: "Loading AI Core v19...", type: "status" }, { text: "Accessing Neural Network Interface...", type: "status" }, { text: "Query Received: 'Optimal Learning Path - Math (Grade 9)'", type: "input", inputSpeed: 60 }, { text: "Processing User Profile: CyberMike_77...", type: "process" }, { text: "Scanning Knowledge Base (Algebra, Geometry, Functions)...", type: "process", progressText: "Scanning KB" }, { text: "Analyzing performance metrics...", type: "analysis" }, { text: "Identified Weak Points: Polynomial Factoring, Circle Theorems.", type: "analysis", progressText: "Analyzing Weaknesses" }, { text: "WARNING: Low confidence score in Trigonometric Identities.", type: "warning", delay: 300 }, { text: "Executing Adaptive Path Correction Subroutine...", type: "process" }, { text: "Generating Personalized Lesson Plan...", type: "process", progressText: "Generating Plan" }, { text: "Module 1: Interactive Polynomial Factoring Drill.", type: "output" }, { text: "Module 2: Visual Proofs for Circle Theorems.", type: "output" }, { text: "Module 3: Targeted Practice: Trig Identities.", type: "output" }, { text: "Calculating Optimal Time Allocation...", type: "analysis" }, { text: "Simulating CERMAT Exam Conditions (Difficulty Level: High)...", type: "process", progressText: "Simulating Exam" }, { text: "Cross-referencing with historical exam patterns...", type: "process" }, { text: "Optimization Complete. Learning Path Ready.", type: "status", delay: 500, final: true }, ];
        const progressIncrement = 100 / (demoTexts.length - 1 || 1);
        const typeText = (element, text, speed) => new Promise((resolve) => { let i = 0; element.textContent = ''; const intervalId = setInterval(() => { if (i < text.length) { element.textContent += text.charAt(i); i++; } else { clearInterval(intervalId); resolve(); } }, speed); });
        const runAIDemoStep = async () => { if (currentTextIndex >= demoTexts.length || !demoIsRunning) { aiStatusIndicator.textContent = "IDLE"; aiProgressLabel.textContent = currentTextIndex >= demoTexts.length ? "Processing Complete" : "Demo Stopped"; if(currentTextIndex >= demoTexts.length) aiProgressBar.style.width = '100%'; demoIsRunning = false; if (demoTimeoutId) clearTimeout(demoTimeoutId); return; } const item = demoTexts[currentTextIndex]; const logLine = document.createElement('p'); logLine.classList.add('ai-log-line', item.type || 'status'); logLine.setAttribute('role', 'logitem'); aiStatusIndicator.textContent = item.progressText || "PROCESSING"; if (item.type === 'input') { aiFakeInput.parentElement?.classList.add('typing'); await typeText(aiFakeInput, item.text, item.inputSpeed || config.aiDemo.typingSpeed); await new Promise(resolve => setTimeout(resolve, 300)); logLine.textContent = `> ${item.text}`; aiFakeInput.textContent = ''; aiFakeInput.parentElement?.classList.remove('typing'); } else { await typeText(logLine, item.text, config.aiDemo.typingSpeed); } aiOutput.appendChild(logLine); aiOutput.scrollTo({ top: aiOutput.scrollHeight, behavior: 'smooth' }); if (currentTextIndex > 0 || demoTexts.length === 1) currentProgress += progressIncrement; const displayProgress = Math.min(currentProgress, 100); aiProgressBar.style.width = `${displayProgress}%`; aiProgressBar.setAttribute('aria-valuenow', Math.round(displayProgress)); aiProgressLabel.textContent = `${item.progressText || item.type || 'Status'} // ${item.text.substring(0, 30)}...`; currentTextIndex++; const delay = (item.delay || 0) + config.aiDemo.stepBaseDelay + Math.random() * config.aiDemo.stepRandomDelay; if (demoIsRunning) demoTimeoutId = setTimeout(runAIDemoStep, delay); };
        const startDemo = () => { if (demoIsRunning) return; console.log("AI Demo section intersecting, starting simulation..."); demoIsRunning = true; aiOutput.innerHTML = ''; aiFakeInput.textContent = ''; aiProgressBar.style.width = '0%'; aiProgressBar.setAttribute('aria-valuenow', '0'); aiStatusIndicator.textContent = "INITIALIZING"; aiProgressLabel.textContent = "Initializing // Please wait..."; currentTextIndex = 0; currentProgress = 0; if (demoTimeoutId) clearTimeout(demoTimeoutId); runAIDemoStep(); };
        const stopDemo = () => { if (!demoIsRunning) return; console.log("AI Demo section out of view, stopping simulation."); demoIsRunning = false; if (demoTimeoutId) clearTimeout(demoTimeoutId); aiStatusIndicator.textContent = "PAUSED"; aiProgressLabel.textContent = "Demo Paused // Scroll down to resume"; };
        const demoObserver = new IntersectionObserver((entries) => entries.forEach(entry => { if (entry.isIntersecting) startDemo(); else stopDemo(); }), { threshold: 0.5 });
        if (demoSection) demoObserver.observe(demoSection);
        console.log("AI Demo observer attached.");
    } else console.warn("AI Demo elements or section not found, or demo disabled in config.");

    // 6. Scroll Animations (Intersection Observer - Keep existing logic)
    const scrollObserver = new IntersectionObserver((entries, observer) => { entries.forEach((entry) => { if (entry.isIntersecting) { const element = entry.target; const delay = (parseInt(element.style.getPropertyValue('--animation-order') || '0', 10)) * config.animations.staggerDelay; if (element.hasAttribute('data-animate-letters') && !element.classList.contains('letters-animated')) { element.classList.add('letters-animating'); const text = element.textContent?.trim() ?? ''; element.innerHTML = ''; text.split('').forEach((char, charIndex) => { const span = document.createElement('span'); span.textContent = char === ' ' ? '\u00A0' : char; const randomDelay = Math.random() * config.animations.letterRandomOffset; span.style.animation = `letter-pop-in 0.6s ${delay + charIndex * config.animations.letterDelay + randomDelay}ms forwards cubic-bezier(0.2, 0.8, 0.2, 1.2)`; element.appendChild(span); }); element.classList.add('letters-animated'); /* observer.unobserve(element); NO unobserve for glitch */ } else if (element.hasAttribute('data-animate') && !element.classList.contains('animated')) { setTimeout(() => { element.classList.add('animated'); observer.unobserve(element); }, delay); } else { /* observer.unobserve(element); */ } } }); }, { threshold: config.animations.scrollThreshold, }); // Removed rootMargin
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
    // 8. Infinite Testimonial Slider Implementation (v2.7 - Pre-fetching)
    //    !!! USES INSECURE Client-Side Gemini API Call !!!
    // ========================================================
    if (sliderContainer && sliderTrack && prevBtn && nextBtn) {
        console.log("Initializing Infinite Testimonial Slider v2.7...");

        // --- Helper Functions for Slider ---

        const getRandomColorPair = () => { /* ... same as v2.6 ... */
            const colors = [ { bg: 'a05cff', text: 'FFFFFF' }, { bg: '00e0ff', text: '03020c' }, { bg: 'ff33a8', text: 'FFFFFF' }, { bg: 'f0e14a', text: '03020c' }, { bg: '00ffaa', text: '03020c' }, { bg: 'ff9a00', text: 'FFFFFF' } ];
            return colors[Math.floor(Math.random() * colors.length)];
        };

        const generateStarsHTML = (rating) => { /* ... same as v2.6 ... */
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

        const createPlaceholderCard = () => { /* ... same as v2.6 ... */
            const card = document.createElement('article');
            card.className = 'testimonial-card is-loading';
            card.innerHTML = '<div class="spinner"></div>';
            card.setAttribute('aria-hidden', 'true');
            return card;
        };

        const updateCardContent = (cardElement, testimonialData) => { /* ... same as v2.6 ... */
             if (!cardElement || !testimonialData) {
                 console.warn("updateCardContent called with invalid element or data.");
                 // Optionally make the card display an error state if element exists but data is bad
                 if(cardElement) {
                     cardElement.classList.remove('is-loading');
                     cardElement.innerHTML = `<p style="color: var(--clr-accent-red); padding: 1em;">Chyba zobrazení dat.</p>`;
                 }
                 return;
             }

            cardElement.classList.remove('is-loading');
            cardElement.removeAttribute('aria-hidden');
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
        const fetchTestimonialFromGeminiAPI = async () => { /* ... same as v2.6 ... */
            console.log("Fetching new testimonial directly from Gemini API (INSECURE)...");

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
                     testimonialData.text = parsedData.text || generatedText.trim().split('\n').pop() || "Generovaný text bez specifikace.";

                } else if (data.promptFeedback?.blockReason) {
                     console.error("Gemini API Blocked:", data.promptFeedback.blockReason, data.promptFeedback.safetyRatings);
                     testimonialData.text = `Obsah blokován API (${data.promptFeedback.blockReason})`;
                } else {
                    console.error("Unexpected Gemini API response structure:", data);
                    testimonialData.text = "Chyba při zpracování odpovědi API.";
                }

            } catch (error) {
                console.error("Error calling/parsing Gemini API:", error);
                 testimonialData.text = `Nepodařilo se kontaktovat AI (${error.name === 'TimeoutError' ? 'časový limit vypršel' : error.message})`;
                 // Ensure critical fields exist even on error, maybe use defaults
                 testimonialData.name = testimonialData.name || "Chyba API";
                 testimonialData.role = testimonialData.role || "Systém";
                 testimonialData.rating = testimonialData.rating || 0;
            } finally {
                console.log("Gemini API fetch attempt finished.");
            }
             return testimonialData;
        };
        // ***** END OF INSECURE FUNCTION *****

        const calculateCardWidthAndMargin = () => { /* ... same as v2.6 ... */
            const firstCard = sliderTrack.querySelector('.testimonial-card:not(.is-loading)');
            if (!firstCard) {
                console.warn("calculateCardWidthAndMargin: No non-loading card found yet.");
                const placeholderCard = sliderTrack.querySelector('.testimonial-card');
                if (!placeholderCard) return 0;
                const pStyle = window.getComputedStyle(placeholderCard);
                const pWidth = placeholderCard.offsetWidth;
                const pMarginRight = parseFloat(pStyle.marginRight);
                if (pWidth > 0) {
                     cardWidthAndMargin = pWidth + pMarginRight;
                     console.log(`Recalculated cardWidthAndMargin from placeholder: ${cardWidthAndMargin}px (Width: ${pWidth}, Margin: ${pMarginRight})`);
                     return cardWidthAndMargin;
                }
                return 0;
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

        const setTrackPosition = (cardIndex) => { /* ... same as v2.6 ... */
            if (!initialLoadComplete || cardWidthAndMargin === 0) {
                console.warn(`Cannot set track position: initialLoadComplete=${initialLoadComplete}, cardWidthAndMargin=${cardWidthAndMargin}`);
                return;
            }
            sliderTrack.style.transition = 'none';
            const position = -cardIndex * cardWidthAndMargin;
            sliderTrack.style.transform = `translateX(${position}px)`;
            void sliderTrack.offsetHeight;
            sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`;
            console.log(`Track position instantly set to index ${cardIndex} (translateX: ${position}px)`);
        };

        // Handles the end of the slide animation for infinite looping (NOW waits for prefetch)
        const handleTransitionEnd = async () => {
            if (!initialLoadComplete) return;

            const direction = parseInt(sliderTrack.dataset.slideDirection || "0");
            console.log(`Transition ended. Direction: ${direction}. Waiting for prefetch...`);

            if (direction === 0) {
                 isSliding = false;
                 if (!isFetching) { // Re-enable buttons if no fetch is ongoing
                     prevBtn.disabled = false;
                     nextBtn.disabled = false;
                 }
                 return;
            }

            // --- Wait for the prefetch to complete ---
            let newData = null;
            try {
                 // prefetchPromise was started in moveSlider
                 newData = await prefetchPromise;
                 console.log("Prefetch completed.", newData);
            } catch (error) {
                 console.error("Error during prefetch await:", error);
                 // Use default error data if prefetch failed
                 newData = { name: "Chyba Načítání", text: `Chyba (${error.message})`, rating: 0, role: "Systém" };
            }
             isFetching = false; // Reset fetching flag AFTER await finishes or errors
             prefetchPromise = null; // Clear the promise

            // --- Proceed with DOM manipulation and updates ---
            sliderTrack.style.transition = 'none'; // Disable transition

            if (direction > 0) { // Moved Right (Next)
                const firstCard = cardsInTrack.shift();
                sliderTrack.removeChild(firstCard);
                sliderTrack.appendChild(firstCard);
                cardsInTrack.push(firstCard);

                currentVisibleStartIndex++;
                const currentTranslateX = parseFloat(sliderTrack.style.transform.replace(/[^-\d.]/g, '')) || 0;
                const newTranslateX = currentTranslateX + cardWidthAndMargin;
                sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
                 console.log(`Moved card first->last. New logical start index: ${currentVisibleStartIndex}. Adjusted translateX to: ${newTranslateX}px`);

                // Update cache & card content with PREFETCHED data
                testimonialDataCache.shift();
                testimonialDataCache.push(newData || { name: "...", text: "Chyba dat", rating: 0, role:""}); // Use fetched or error data
                updateCardContent(firstCard, testimonialDataCache[testimonialDataCache.length - 1]);


            } else { // Moved Left (Prev)
                const lastCard = cardsInTrack.pop();
                sliderTrack.removeChild(lastCard);
                sliderTrack.insertBefore(lastCard, sliderTrack.firstChild);
                cardsInTrack.unshift(lastCard);

                currentVisibleStartIndex--;
                const currentTranslateX = parseFloat(sliderTrack.style.transform.replace(/[^-\d.]/g, '')) || 0;
                const newTranslateX = currentTranslateX - cardWidthAndMargin;
                sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
                 console.log(`Moved card last->first. New logical start index: ${currentVisibleStartIndex}. Adjusted translateX to: ${newTranslateX}px`);

                // Update cache & card content with PREFETCHED data
                testimonialDataCache.pop();
                testimonialDataCache.unshift(newData || { name: "...", text: "Chyba dat", rating: 0, role:""}); // Use fetched or error data
                updateCardContent(lastCard, testimonialDataCache[0]);
            }

            // Force reflow before re-enabling transition
            void sliderTrack.offsetHeight;
            sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`;

            sliderTrack.dataset.slideDirection = "0"; // Reset direction
            isSliding = false; // Allow next slide

            // Re-enable buttons (should be safe now as fetch is complete)
            prevBtn.disabled = false;
            nextBtn.disabled = false;
            console.log("handleTransitionEnd complete. Buttons enabled.");
        };


        // Moves the slider track visually AND starts pre-fetching the next testimonial
        const moveSlider = (direction) => {
             if (isSliding || !initialLoadComplete) {
                 console.warn(`Slide attempt blocked: isSliding=${isSliding}, initialLoadComplete=${initialLoadComplete}`);
                 return;
             }
             // Prevent starting a new fetch if one from a previous (unfinished) slide is still running
             if (isFetching) {
                 console.warn(`Slide attempt blocked: isFetching=${isFetching}`);
                 return;
             }

             isSliding = true;
             prevBtn.disabled = true;
             nextBtn.disabled = true;
             console.log(`Moving slider. Direction: ${direction}. Starting prefetch...`);

             // --- Start pre-fetching the next testimonial ---
             isFetching = true; // Set fetching flag
             prefetchPromise = fetchTestimonialFromGeminiAPI();
             // Add a catch handler to the prefetch promise *here* to prevent unhandled rejections
             // if the user navigates away or something interrupts before handleTransitionEnd awaits it.
              prefetchPromise.catch(error => {
                  console.error("Prefetch background error:", error);
                  // isFetching might need to be reset here too if the await in handleTransitionEnd never happens
                  if (prefetchPromise) isFetching = false; // Reset if this specific promise caused error
                  prefetchPromise = null;
              });
              // Also reset isFetching if the API call itself returns an error object quickly
              prefetchPromise.then(data => {
                  if (data && (data.name === "Chyba Konfigurace" || data.name === "Chyba API")) {
                      isFetching = false; // Reset early if known error
                      prefetchPromise = Promise.resolve(data); // Ensure it still resolves for await
                  }
              });

             // --- Start the visual slide animation ---
             sliderTrack.dataset.slideDirection = direction.toString(); // Store direction

             const currentTranslateX = parseFloat(sliderTrack.style.transform.replace(/[^-\d.]/g, '')) || (-currentVisibleStartIndex * cardWidthAndMargin);
             const newTranslateX = currentTranslateX - (direction * cardWidthAndMargin);

             if (!sliderTrack.style.transition || sliderTrack.style.transition === 'none') {
                 sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`;
             }
             sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
             console.log(`Animating transform to: ${newTranslateX}px`);

             // handleTransitionEnd will wait for prefetchPromise before finishing
        };

        // Initializes the slider - fetches initial data, creates cards, sets position
        const initializeInfiniteSlider = async () => { /* ... same as v2.6 ... */
            console.log("Starting infinite slider initialization v2.7...");
            isSliding = true;
            initialLoadComplete = false;
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            sliderTrack.innerHTML = '';
            testimonialDataCache = [];
            cardsInTrack = [];
            cardWidthAndMargin = 0;

            const numVisible = config.testimonials.visibleCardsDesktop;
            const numBuffer = config.testimonials.bufferCards;
            totalCardsInDOM = numVisible + 2 * numBuffer;
            currentVisibleStartIndex = numBuffer;

            console.log(`Initial setup: Visible=${numVisible}, Buffer=${numBuffer}, TotalInDOM=${totalCardsInDOM}`);

             const firstPlaceholder = createPlaceholderCard();
             sliderTrack.appendChild(firstPlaceholder);
             cardsInTrack.push(firstPlaceholder);

             console.log("Fetching data for the first card...");
             isFetching = true;
             const firstCardData = await fetchTestimonialFromGeminiAPI();
             isFetching = false;

             if (!firstCardData || firstCardData.name === "Chyba Konfigurace" || firstCardData.name === "Chyba API") {
                 console.error("Failed to fetch data for the first card. Aborting initialization.", firstCardData);
                 sliderTrack.innerHTML = `<p style="color: var(--clr-accent-red);">Chyba: Nepodařilo se načíst první recenzi (${firstCardData?.text || 'neznámá chyba'}).</p>`;
                 isSliding = false;
                 return;
             }

             updateCardContent(firstPlaceholder, firstCardData);
             testimonialDataCache.push(firstCardData);
             console.log("First card loaded and updated.");

             await new Promise(resolve => requestAnimationFrame(resolve));

             if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
                 console.error("Could not calculate card dimensions AFTER loading first card. Aborting slider setup.");
                 sliderTrack.innerHTML = '<p style="color: var(--clr-accent-red);">Chyba layoutu slideru i po načtení karty.</p>';
                 isSliding = false;
                 return;
             }

             const remainingCardsToCreate = totalCardsInDOM - 1;
             for (let i = 0; i < remainingCardsToCreate; i++) {
                 const placeholderCard = createPlaceholderCard();
                 sliderTrack.appendChild(placeholderCard);
                 cardsInTrack.push(placeholderCard);
                 testimonialDataCache.push(null);
             }
             console.log(`Added ${remainingCardsToCreate} more placeholder cards.`);

             console.log("Fetching data for remaining cards...");
             const remainingFetchPromises = [];
             const fetchedIndices = new Set([0]); // Keep track of indices being fetched

             const fetchAndUpdate = async (index) => {
                 if (isFetching) { // Simple global lock for initial fetches too
                     console.warn(`Initial fetch for index ${index} skipped, already fetching.`);
                     return; // Skip if another fetch is running
                 }
                 isFetching = true;
                 fetchedIndices.add(index); // Mark as being fetched
                 console.log(`Starting initial fetch for index ${index}`);
                 const data = await fetchTestimonialFromGeminiAPI();
                 isFetching = false;
                 console.log(`Finished initial fetch for index ${index}`);

                 if (data && cardsInTrack[index]) {
                     testimonialDataCache[index] = data;
                     updateCardContent(cardsInTrack[index], data);
                 } else {
                     testimonialDataCache[index] = { name: "Chyba", text: "Nepodařilo se načíst.", rating: 0, role:"" };
                     if(cardsInTrack[index]) updateCardContent(cardsInTrack[index], testimonialDataCache[index]);
                 }
                 fetchedIndices.delete(index); // Mark as done
             };

             // Sequentially trigger fetches to avoid overwhelming API potentially? Or run concurrently?
             // Let's run concurrently but manage the isFetching flag more carefully (or accept potential overlaps initially)
              isFetching = false; // Reset flag before loop
              for (let i = 1; i < totalCardsInDOM; i++) {
                  remainingFetchPromises.push(fetchAndUpdate(i));
              }
             // Don't wait for all promises here, let them fill in background

             initialLoadComplete = true;
             setTrackPosition(currentVisibleStartIndex);

             sliderTrack.removeEventListener('transitionend', handleTransitionEnd);
             sliderTrack.addEventListener('transitionend', handleTransitionEnd);

             console.log("Infinite slider initialized successfully (background fetches ongoing).");
             isSliding = false;
             prevBtn.disabled = false; // Enable buttons immediately after positioning
             nextBtn.disabled = false;
        };


         // --- Event Listeners ---
         prevBtn.addEventListener('click', () => moveSlider(-1));
         nextBtn.addEventListener('click', () => moveSlider(1));

         // Debounced resize handler
         window.addEventListener('resize', debounce(() => {
             if (!initialLoadComplete) return;
             console.log("Window resized, recalculating slider dimensions...");
             if (calculateCardWidthAndMargin()) {
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
    console.log("JUSTAX Interface v2.7 Initialization Complete (Pre-fetching - INSECURE DEMO).");

}); // End DOMContentLoaded