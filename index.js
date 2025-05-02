/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, and **INFINITE** testimonial slider with pre-fetching.
 * Version: v2.8 (Stabilized Indexing & Event Handling - INSECURE DEMO)
 * Author: Gemini Modification
 * Date: 2025-05-02 // Stabilized logic
 *
 * !!! SECURITY WARNING !!!
 * This code demonstrates calling the Gemini API directly from the client-side.
 * THIS IS HIGHLY INSECURE as it exposes your API key placeholder.
 * DO NOT USE THIS PATTERN IN PRODUCTION WITH A REAL API KEY.
 * API calls MUST be proxied through your own backend server.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.8 (Stabilized - INSECURE DEMO)...");

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
            visibleCardsDesktop: 3,
            bufferCards: 2,         // Buffer cards on EACH side
            slideDuration: 500
        }
    };

    // --- Testimonial Slider State (Infinite Scroll) ---
    let testimonialDataCache = [];
    let cardsInTrack = [];
    // Stable index pointing to the *first visible* card relative to the start of cardsInTrack
    let stableVisibleStartIndex = config.testimonials.bufferCards;
    let totalCardsInDOM = 0;
    let cardWidthAndMargin = 0;
    let isSliding = false;
    let isFetching = false; // Global flag for ongoing prefetch triggered by moveSlider
    let resizeTimeout;
    let initialLoadComplete = false;
    let prefetchPromise = null;
    // Counter to help debug repeated transitionend events
    let transitionEndCounter = 0;

    // --- Utility Functions ---
    // [setYear, toggleMenu, debounce remain the same]
    const setYear = () => { if (yearSpan) yearSpan.textContent = new Date().getFullYear(); };
    const toggleMenu = (open) => { /* ... same ... */
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
    const debounce = (func, wait) => { /* ... same ... */
        let timeout;
        return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); };
    };

    // --- Feature Initializations ---
    // [Sections 1-7: Year, Header, Hamburger, Mouse, AI Demo, Scroll Anim, Smooth Scroll - remain the same]
    // ... (sections 1-7 are identical to previous version) ...
    setYear();
    const handleScrollHeader = () => { if (header) header.classList.toggle('scrolled', window.scrollY > 50); };
    window.addEventListener('scroll', debounce(handleScrollHeader, 15), { passive: true });
    handleScrollHeader();
    if (hamburger) hamburger.addEventListener('click', () => toggleMenu());
    if (menuOverlay) menuOverlay.addEventListener('click', () => toggleMenu(false));
    if (navLinks) { navLinks.querySelectorAll('a').forEach(link => { link.addEventListener('click', (e) => { if (link.getAttribute('href')?.startsWith('#') || link.getAttribute('href')?.startsWith('/#')) { if (navLinks.classList.contains('active') && !e.defaultPrevented) toggleMenu(false); } }); }); navLinks.addEventListener('keydown', (e) => { if (e.key === 'Escape' && navLinks.classList.contains('active')) toggleMenu(false); }); }
    console.log("Hamburger menu initialized.");
    if (config.mouseFollower.enabled && follower && !window.matchMedia('(hover: none)').matches) { let mouseX = 0, mouseY = 0; let followerX = 0, followerY = 0; let currentScale = 1; let isHoveringLink = false; let animationFrameId = null; const updateFollower = () => { const dx = mouseX - followerX; const dy = mouseY - followerY; followerX += dx * config.mouseFollower.followSpeed; followerY += dy * config.mouseFollower.followSpeed; const targetScale = isHoveringLink ? config.mouseFollower.hoverScale : (body.matches(':active') ? config.mouseFollower.clickScale : 1); currentScale += (targetScale - currentScale) * 0.2; const roundedX = Math.round(followerX); const roundedY = Math.round(followerY); follower.style.transform = `translate(-50%, -50%) scale(${currentScale.toFixed(3)})`; follower.style.left = `${roundedX}px`; follower.style.top = `${roundedY}px`; animationFrameId = requestAnimationFrame(updateFollower); }; document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; if (!animationFrameId) animationFrameId = requestAnimationFrame(updateFollower); }, { passive: true }); document.addEventListener('mouseover', (e) => { if (e.target.closest('a, button, .btn')) { isHoveringLink = true; follower.classList.add('follower-hover'); } }); document.addEventListener('mouseout', (e) => { if (e.target.closest('a, button, .btn')) { isHoveringLink = false; follower.classList.remove('follower-hover'); } }); document.addEventListener('mouseleave', () => { if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; } }); document.addEventListener('mouseenter', () => { if (!animationFrameId) { mouseX = window.innerWidth / 2; mouseY = window.innerHeight / 2; followerX = mouseX; followerY = mouseY; animationFrameId = requestAnimationFrame(updateFollower); } }); animationFrameId = requestAnimationFrame(updateFollower); console.log("Mouse follower activated."); } else if (!follower) console.warn("Mouse follower element not found."); else if (window.matchMedia('(hover: none)').matches) { console.log("Mouse follower disabled on likely touch device."); if (follower) follower.style.display = 'none'; }
    if (config.aiDemo.enabled && demoSection && aiOutput && aiProgressBar && aiProgressLabel && aiFakeInput && aiStatusIndicator) { let currentTextIndex = 0; let currentProgress = 0; let demoIsRunning = false; let demoTimeoutId = null; const demoTexts = [ { text: "Boot Sequence Initiated...", type: "status", delay: 500 }, { text: "Loading AI Core v19...", type: "status" }, { text: "Accessing Neural Network Interface...", type: "status" }, { text: "Query Received: 'Optimal Learning Path - Math (Grade 9)'", type: "input", inputSpeed: 60 }, { text: "Processing User Profile: CyberMike_77...", type: "process" }, { text: "Scanning Knowledge Base (Algebra, Geometry, Functions)...", type: "process", progressText: "Scanning KB" }, { text: "Analyzing performance metrics...", type: "analysis" }, { text: "Identified Weak Points: Polynomial Factoring, Circle Theorems.", type: "analysis", progressText: "Analyzing Weaknesses" }, { text: "WARNING: Low confidence score in Trigonometric Identities.", type: "warning", delay: 300 }, { text: "Executing Adaptive Path Correction Subroutine...", type: "process" }, { text: "Generating Personalized Lesson Plan...", type: "process", progressText: "Generating Plan" }, { text: "Module 1: Interactive Polynomial Factoring Drill.", type: "output" }, { text: "Module 2: Visual Proofs for Circle Theorems.", type: "output" }, { text: "Module 3: Targeted Practice: Trig Identities.", type: "output" }, { text: "Calculating Optimal Time Allocation...", type: "analysis" }, { text: "Simulating CERMAT Exam Conditions (Difficulty Level: High)...", type: "process", progressText: "Simulating Exam" }, { text: "Cross-referencing with historical exam patterns...", type: "process" }, { text: "Optimization Complete. Learning Path Ready.", type: "status", delay: 500, final: true }, ]; const progressIncrement = 100 / (demoTexts.length - 1 || 1); const typeText = (element, text, speed) => new Promise((resolve) => { let i = 0; element.textContent = ''; const intervalId = setInterval(() => { if (i < text.length) { element.textContent += text.charAt(i); i++; } else { clearInterval(intervalId); resolve(); } }, speed); }); const runAIDemoStep = async () => { if (currentTextIndex >= demoTexts.length || !demoIsRunning) { aiStatusIndicator.textContent = "IDLE"; aiProgressLabel.textContent = currentTextIndex >= demoTexts.length ? "Processing Complete" : "Demo Stopped"; if(currentTextIndex >= demoTexts.length) aiProgressBar.style.width = '100%'; demoIsRunning = false; if (demoTimeoutId) clearTimeout(demoTimeoutId); return; } const item = demoTexts[currentTextIndex]; const logLine = document.createElement('p'); logLine.classList.add('ai-log-line', item.type || 'status'); logLine.setAttribute('role', 'logitem'); aiStatusIndicator.textContent = item.progressText || "PROCESSING"; if (item.type === 'input') { aiFakeInput.parentElement?.classList.add('typing'); await typeText(aiFakeInput, item.text, item.inputSpeed || config.aiDemo.typingSpeed); await new Promise(resolve => setTimeout(resolve, 300)); logLine.textContent = `> ${item.text}`; aiFakeInput.textContent = ''; aiFakeInput.parentElement?.classList.remove('typing'); } else { await typeText(logLine, item.text, config.aiDemo.typingSpeed); } aiOutput.appendChild(logLine); aiOutput.scrollTo({ top: aiOutput.scrollHeight, behavior: 'smooth' }); if (currentTextIndex > 0 || demoTexts.length === 1) currentProgress += progressIncrement; const displayProgress = Math.min(currentProgress, 100); aiProgressBar.style.width = `${displayProgress}%`; aiProgressBar.setAttribute('aria-valuenow', Math.round(displayProgress)); aiProgressLabel.textContent = `${item.progressText || item.type || 'Status'} // ${item.text.substring(0, 30)}...`; currentTextIndex++; const delay = (item.delay || 0) + config.aiDemo.stepBaseDelay + Math.random() * config.aiDemo.stepRandomDelay; if (demoIsRunning) demoTimeoutId = setTimeout(runAIDemoStep, delay); }; const startDemo = () => { if (demoIsRunning) return; console.log("AI Demo section intersecting, starting simulation..."); demoIsRunning = true; aiOutput.innerHTML = ''; aiFakeInput.textContent = ''; aiProgressBar.style.width = '0%'; aiProgressBar.setAttribute('aria-valuenow', '0'); aiStatusIndicator.textContent = "INITIALIZING"; aiProgressLabel.textContent = "Initializing // Please wait..."; currentTextIndex = 0; currentProgress = 0; if (demoTimeoutId) clearTimeout(demoTimeoutId); runAIDemoStep(); }; const stopDemo = () => { if (!demoIsRunning) return; console.log("AI Demo section out of view, stopping simulation."); demoIsRunning = false; if (demoTimeoutId) clearTimeout(demoTimeoutId); aiStatusIndicator.textContent = "PAUSED"; aiProgressLabel.textContent = "Demo Paused // Scroll down to resume"; }; const demoObserver = new IntersectionObserver((entries) => entries.forEach(entry => { if (entry.isIntersecting) startDemo(); else stopDemo(); }), { threshold: 0.5 }); if (demoSection) demoObserver.observe(demoSection); console.log("AI Demo observer attached."); } else console.warn("AI Demo elements or section not found, or demo disabled in config.");
    const scrollObserver = new IntersectionObserver((entries, observer) => { entries.forEach((entry) => { if (entry.isIntersecting) { const element = entry.target; const delay = (parseInt(element.style.getPropertyValue('--animation-order') || '0', 10)) * config.animations.staggerDelay; if (element.hasAttribute('data-animate-letters') && !element.classList.contains('letters-animated')) { element.classList.add('letters-animating'); const text = element.textContent?.trim() ?? ''; element.innerHTML = ''; text.split('').forEach((char, charIndex) => { const span = document.createElement('span'); span.textContent = char === ' ' ? '\u00A0' : char; const randomDelay = Math.random() * config.animations.letterRandomOffset; span.style.animation = `letter-pop-in 0.6s ${delay + charIndex * config.animations.letterDelay + randomDelay}ms forwards cubic-bezier(0.2, 0.8, 0.2, 1.2)`; element.appendChild(span); }); element.classList.add('letters-animated'); } else if (element.hasAttribute('data-animate') && !element.classList.contains('animated')) { setTimeout(() => { element.classList.add('animated'); observer.unobserve(element); }, delay); } } }); }, { threshold: config.animations.scrollThreshold, });
    document.querySelectorAll('[data-animate], [data-animate-letters]').forEach(el => scrollObserver.observe(el));
    console.log(`Scroll observer attached for entry animations.`);
    document.querySelectorAll('a[href^="#"]').forEach(anchor => { anchor.addEventListener('click', function (e) { const href = this.getAttribute('href'); if (!href || href === '#') return; try { const targetElement = document.querySelector(href); if (targetElement) { e.preventDefault(); const headerOffset = header?.offsetHeight || 70; const elementPosition = targetElement.getBoundingClientRect().top; const offsetPosition = elementPosition + window.pageYOffset - headerOffset; window.scrollTo({ top: offsetPosition, behavior: "smooth" }); toggleMenu(false); } else console.warn(`Smooth scroll target element not found: ${href}`); } catch (err) { console.error(`Error finding element for smooth scroll: ${href}`, err); } }); });
    console.log("Smooth scroll initialized.");


    // ========================================================
    // 8. Infinite Testimonial Slider Implementation (v2.8 - Stabilized)
    //    !!! USES INSECURE Client-Side Gemini API Call !!!
    // ========================================================
    if (sliderContainer && sliderTrack && prevBtn && nextBtn) {
        console.log("Initializing Infinite Testimonial Slider v2.8...");

        // --- Helper Functions ---
        const getRandomColorPair = () => { /* ... same ... */
            const colors = [ { bg: 'a05cff', text: 'FFFFFF' }, { bg: '00e0ff', text: '03020c' }, { bg: 'ff33a8', text: 'FFFFFF' }, { bg: 'f0e14a', text: '03020c' }, { bg: '00ffaa', text: '03020c' }, { bg: 'ff9a00', text: 'FFFFFF' } ];
            return colors[Math.floor(Math.random() * colors.length)];
        };
        const generateStarsHTML = (rating) => { /* ... same ... */
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
        const createPlaceholderCard = () => { /* ... same ... */
             const card = document.createElement('article');
            card.className = 'testimonial-card is-loading';
            card.innerHTML = '<div class="spinner"></div>';
            card.setAttribute('aria-hidden', 'true');
            return card;
        };
        const updateCardContent = (cardElement, testimonialData) => { /* ... same, added robustness ... */
            if (!cardElement) { console.warn("updateCardContent: null cardElement received"); return; }
             // Ensure testimonialData is an object, even if it's an error placeholder
             const data = testimonialData && typeof testimonialData === 'object' ? testimonialData :
                 { name: "Chyba Dat", text: "Neplatná data pro kartu.", rating: 0, role: "Systém" };

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

            const name = data.name || 'AI Uživatel';
            const role = data.role || 'Student';
            const rating = data.rating;
            const text = data.text || 'Chybí text recenze.'; // Provide default text

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
        const fetchTestimonialFromGeminiAPI = async () => { /* ... same prompt and API call logic ... */
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

            let testimonialData = { name: "Chyba API", text: "Nepodařilo se načíst data.", rating: 0, role:"Systém"}; // Default error object

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(15000) // Keep timeout
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
                     if (!testimonialData.text) testimonialData.text = "Prázdná odpověď API."; // Handle empty text case

                } else if (data.promptFeedback?.blockReason) {
                     console.error("Gemini API Blocked:", data.promptFeedback.blockReason);
                     testimonialData = { name: "Blokováno API", text: `Obsah blokován (${data.promptFeedback.blockReason})`, rating: 0, role:"Systém"};
                } else {
                    console.error("Unexpected Gemini API response structure:", data);
                    testimonialData = { name: "Chyba Odpovědi", text: "Neočekávaná struktura odpovědi API.", rating: 0, role:"Systém"};
                }

            } catch (error) {
                console.error("Error calling/parsing Gemini API:", error);
                // Ensure the returned object has the expected structure even on error
                 testimonialData = {
                     name: "Chyba API",
                     text: `Nepodařilo se kontaktovat AI (${error.name === 'TimeoutError' ? 'časový limit vypršel' : error.message})`,
                     rating: 0,
                     role: "Systém"
                 };
            } finally {
                console.log("Gemini API fetch attempt finished.");
            }
             // ALWAYS return an object
             return testimonialData;
        };
        // ***** END OF INSECURE FUNCTION *****


        const calculateCardWidthAndMargin = () => { /* ... same as v2.7 ... */
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

        // Sets the slider track's position instantly based on the STABLE index
        const setTrackPosition = () => {
            if (!initialLoadComplete || cardWidthAndMargin === 0) {
                console.warn(`Cannot set track position: initialLoadComplete=${initialLoadComplete}, cardWidthAndMargin=${cardWidthAndMargin}`);
                return;
            }
            sliderTrack.style.transition = 'none'; // Disable animation for instant jump
            // Position is always based on the stableVisibleStartIndex
            const position = -stableVisibleStartIndex * cardWidthAndMargin;
            sliderTrack.style.transform = `translateX(${position}px)`;
            void sliderTrack.offsetHeight; // Force reflow
            // Re-enable transition IF NOT CURRENTLY SLIDING (important!)
            if (!isSliding) {
                 sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`;
            }
            console.log(`Track position instantly set for index ${stableVisibleStartIndex} (translateX: ${position}px)`);
        };


        // Handles the end of the slide animation for infinite looping
        const handleTransitionEnd = async (event) => {
            // IMPORTANT: Check if the transition ended on the 'transform' property
            if (event.propertyName !== 'transform' || !sliderTrack.contains(event.target)) {
                return;
            }
            // Prevent handling if slider not ready or already handling another transition end
            if (!initialLoadComplete || !isSliding) {
                // console.log(`handleTransitionEnd skipped: initialLoadComplete=${initialLoadComplete}, isSliding=${isSliding}`);
                return;
            }

            const direction = parseInt(sliderTrack.dataset.slideDirection || "0");
            transitionEndCounter++; // Increment debug counter
            console.log(`Transition ended (#${transitionEndCounter}). Target: ${event.target.id}, Direction: ${direction}. Waiting for prefetch...`);

            if (direction === 0) {
                 console.warn("Transition ended but direction was 0. Resetting state.");
                 isSliding = false; // Reset flag
                 if (!isFetching) { // Re-enable buttons if no fetch is ongoing
                     prevBtn.disabled = false;
                     nextBtn.disabled = false;
                 }
                 return;
            }

            // --- Wait for the prefetch to complete ---
            let newData = null;
            if (prefetchPromise) {
                 try {
                     newData = await prefetchPromise;
                     console.log("Prefetch completed.", newData);
                 } catch (error) {
                     console.error("Error during prefetch await:", error);
                     newData = { name: "Chyba Načítání", text: `Chyba (${error.message})`, rating: 0, role: "Systém" };
                 } finally {
                      isFetching = false; // Reset fetching flag ONLY after await is done
                      prefetchPromise = null; // Clear the promise
                 }
            } else {
                 console.warn("Transition ended, but no prefetchPromise was found!");
                 isFetching = false; // Ensure fetch flag is reset
                 newData = { name: "Chyba Logiky", text: "Chybí prefetch promise.", rating: 0, role: "Systém" };
            }


            // --- Proceed with DOM manipulation and updates ---
            sliderTrack.style.transition = 'none'; // Disable transition

            try {
                 if (direction > 0) { // Moved Right (Next)
                     const firstCard = cardsInTrack.shift(); // Remove first card from array
                     if (!firstCard) throw new Error("Cannot get first card from cardsInTrack");
                     sliderTrack.removeChild(firstCard); // Remove first card from DOM
                     sliderTrack.appendChild(firstCard); // Add it to the end of DOM
                     cardsInTrack.push(firstCard); // Add it back to the end of array

                     // Update cache & card content with PREFETCHED data
                     testimonialDataCache.shift();
                     testimonialDataCache.push(newData || { name: "...", text: "Chyba dat", rating: 0, role:""});
                     updateCardContent(firstCard, testimonialDataCache[testimonialDataCache.length - 1]);

                     // Adjust position instantly: We moved one card from start to end,
                     // so the visual start needs to shift back by one card width RELATIVE to the current transform
                     const currentTranslateX = parseFloat(sliderTrack.style.transform.replace(/[^-\d.]/g, '')) || 0;
                     const newTranslateX = currentTranslateX + cardWidthAndMargin;
                     sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
                     console.log(`Moved card first->last. Adjusted translateX by +${cardWidthAndMargin} to: ${newTranslateX}px`);

                 } else { // Moved Left (Prev)
                     const lastCard = cardsInTrack.pop(); // Remove last card from array
                      if (!lastCard) throw new Error("Cannot get last card from cardsInTrack");
                     sliderTrack.removeChild(lastCard); // Remove last card from DOM
                     sliderTrack.insertBefore(lastCard, sliderTrack.firstChild); // Add it to the beginning of DOM
                     cardsInTrack.unshift(lastCard); // Add it back to the beginning of array

                     // Update cache & card content with PREFETCHED data
                     testimonialDataCache.pop();
                     testimonialDataCache.unshift(newData || { name: "...", text: "Chyba dat", rating: 0, role:""});
                     updateCardContent(lastCard, testimonialDataCache[0]);

                     // Adjust position instantly: We moved one card from end to start,
                     // so the visual start needs to shift forward by one card width RELATIVE to the current transform
                     const currentTranslateX = parseFloat(sliderTrack.style.transform.replace(/[^-\d.]/g, '')) || 0;
                     const newTranslateX = currentTranslateX - cardWidthAndMargin;
                     sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
                     console.log(`Moved card last->first. Adjusted translateX by -${cardWidthAndMargin} to: ${newTranslateX}px`);
                 }
            } catch (error) {
                 console.error("Error during DOM manipulation in handleTransitionEnd:", error);
                 // Attempt to recover state or log critical error
            }


            // Force reflow before re-enabling transition
            void sliderTrack.offsetHeight;
            sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`;

            sliderTrack.dataset.slideDirection = "0"; // Reset direction state
            isSliding = false; // Allow next slide

            // Re-enable buttons only if NO fetch is currently running
             if (!isFetching) {
                 prevBtn.disabled = false;
                 nextBtn.disabled = false;
             } else {
                 console.warn("handleTransitionEnd finished, but another fetch might be ongoing? Keeping buttons disabled.");
                  prevBtn.disabled = true;
                  nextBtn.disabled = true;
             }

            console.log("handleTransitionEnd complete.");
        };


        // Moves the slider track visually AND starts pre-fetching the next testimonial
        const moveSlider = (direction) => {
             if (isSliding || !initialLoadComplete) {
                 console.warn(`Slide attempt blocked: isSliding=${isSliding}, initialLoadComplete=${initialLoadComplete}`);
                 return;
             }
              // Check if already fetching (maybe from a previous unfinished slide action)
             if (isFetching) {
                 console.warn(`Slide attempt blocked: isFetching=${isFetching}. Waiting for previous fetch.`);
                 return; // Don't allow sliding if a fetch is in progress
             }

             isSliding = true;
             isFetching = true; // Assume we WILL fetch
             prevBtn.disabled = true;
             nextBtn.disabled = true;
             console.log(`Moving slider. Direction: ${direction}. Starting prefetch...`);

             // --- Start pre-fetching the next testimonial ---
             prefetchPromise = fetchTestimonialFromGeminiAPI();
             // Handle cases where fetch errors out quickly or returns error object, resetting isFetching
             prefetchPromise.then(data => {
                 if (data && (data.name === "Chyba Konfigurace" || data.name === "Chyba API")) {
                     isFetching = false; // Reset early if known error
                     prefetchPromise = Promise.resolve(data); // Ensure it still resolves for await
                     console.warn("Prefetch failed quickly with config/API error.");
                 }
                 // Note: isFetching is reset properly in handleTransitionEnd after await
             }).catch(error => {
                 console.error("Prefetch background error caught in moveSlider:", error);
                 isFetching = false; // Reset fetch flag on background error too
                 prefetchPromise = Promise.resolve({ name: "Chyba Prefetch", text: `Chyba (${error.message})`, rating: 0, role: "Systém" }); // Resolve with error object
             });

             // --- Start the visual slide animation ---
             sliderTrack.dataset.slideDirection = direction.toString();

             // Calculate target position based on current transform and direction
             const currentTransform = sliderTrack.style.transform;
             const currentTranslateX = parseFloat(currentTransform.replace(/[^-\d.]/g, '')) || (-stableVisibleStartIndex * cardWidthAndMargin); // Get current position or recalculate
             const newTranslateX = currentTranslateX - (direction * cardWidthAndMargin);

             // Ensure transition is set before changing transform
             sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`;
             sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
             console.log(`Animating transform from ${currentTranslateX} to: ${newTranslateX}px`);

             // handleTransitionEnd will be called automatically when the CSS transition finishes
        };

        // Initializes the slider
        const initializeInfiniteSlider = async () => {
            console.log("Starting infinite slider initialization v2.8...");
            isSliding = true; // Lock interactions
            initialLoadComplete = false;
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            sliderTrack.innerHTML = '';
            testimonialDataCache = [];
            cardsInTrack = [];
            cardWidthAndMargin = 0;
            stableVisibleStartIndex = config.testimonials.bufferCards; // Reset stable index

            const numVisible = config.testimonials.visibleCardsDesktop;
            const numBuffer = config.testimonials.bufferCards;
            totalCardsInDOM = numVisible + 2 * numBuffer;

            console.log(`Initial setup: Visible=${numVisible}, Buffer=${numBuffer}, TotalInDOM=${totalCardsInDOM}, StableStartIdx=${stableVisibleStartIndex}`);

            // 1. Create and Append the FIRST placeholder
            const firstPlaceholder = createPlaceholderCard();
            sliderTrack.appendChild(firstPlaceholder);
            cardsInTrack.push(firstPlaceholder);

            // 2. Fetch data for the FIRST card
            console.log("Fetching data for the first card...");
            isFetching = true; // Lock fetching
            const firstCardData = await fetchTestimonialFromGeminiAPI();
            isFetching = false; // Unlock fetching

            if (!firstCardData || firstCardData.name === "Chyba Konfigurace" || firstCardData.name === "Chyba API") {
                console.error("Failed to fetch data for the first card. Aborting initialization.", firstCardData);
                sliderTrack.innerHTML = `<p style="color: var(--clr-accent-red);">Chyba: Nepodařilo se načíst první recenzi (${firstCardData?.text || 'neznámá chyba'}).</p>`;
                isSliding = false;
                return;
            }

            // 3. Update the first card
            updateCardContent(firstPlaceholder, firstCardData);
            testimonialDataCache.push(firstCardData); // Cache it
            console.log("First card loaded and updated.");

            // 4. Calculate dimensions (wait for render)
            await new Promise(resolve => requestAnimationFrame(resolve));
            if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
                console.error("Could not calculate card dimensions AFTER loading first card. Aborting slider setup.");
                sliderTrack.innerHTML = '<p style="color: var(--clr-accent-red);">Chyba layoutu slideru i po načtení karty.</p>';
                isSliding = false;
                return;
            }

            // 5. Create REMAINING placeholders
            const remainingCardsToCreate = totalCardsInDOM - 1;
            for (let i = 0; i < remainingCardsToCreate; i++) {
                const placeholderCard = createPlaceholderCard();
                sliderTrack.appendChild(placeholderCard);
                cardsInTrack.push(placeholderCard);
                testimonialDataCache.push(null); // Fill cache with nulls
            }
            console.log(`Added ${remainingCardsToCreate} more placeholder cards.`);

            // 6. Fetch data for REMAINING cards concurrently
            console.log("Fetching data for remaining cards concurrently...");
            const initialFetchPromises = [];
            // Start from index 1 as 0 is done
            for (let i = 1; i < totalCardsInDOM; i++) {
                initialFetchPromises.push(
                     (async (index) => {
                         // console.log(`Starting initial fetch for index ${index}`);
                         // No global isFetching lock here, let them run in parallel
                         const data = await fetchTestimonialFromGeminiAPI();
                         // console.log(`Finished initial fetch for index ${index}`);
                         testimonialDataCache[index] = data || { name: "Chyba", text: "Nepodařilo se načíst.", rating: 0, role:"" };
                         if (cardsInTrack[index]) {
                             updateCardContent(cardsInTrack[index], testimonialDataCache[index]);
                         }
                     })(i)
                 );
            }
            // Wait for all initial fetches to settle (finish or fail)
             try {
                 await Promise.allSettled(initialFetchPromises);
                 console.log("All initial background fetches have settled.");
             } catch (error) {
                  console.error("Error during Promise.allSettled for initial fetches:", error);
             }

            // 7. Set initial position and finalize
            initialLoadComplete = true;
            setTrackPosition(); // Set position based on stableVisibleStartIndex

            // 8. Add event listener
            sliderTrack.removeEventListener('transitionend', handleTransitionEnd); // Ensure no duplicates
            sliderTrack.addEventListener('transitionend', handleTransitionEnd);

            console.log("Infinite slider initialized successfully.");
            isSliding = false; // Unlock interactions
            prevBtn.disabled = false;
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
                 // Reposition instantly based on the STABLE index
                 setTrackPosition();
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
    console.log("JUSTAX Interface v2.8 Initialization Complete (Stabilized - INSECURE DEMO).");

}); // End DOMContentLoaded