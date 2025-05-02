/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, and testimonial slider.
 * Version: v2.4 (Client-Side API Call STRUCTURE - INSECURE DEMO)
 * Author: Gemini Modification
 * Date: 2025-05-02
 *
 * !!! SECURITY WARNING !!!
 * This code demonstrates calling the Gemini API directly from the client-side.
 * THIS IS HIGHLY INSECURE as it exposes your API key.
 * DO NOT USE THIS PATTERN IN PRODUCTION WITH A REAL API KEY.
 * API calls MUST be proxied through your own backend server.
 * The API key placeholder "GEMINI_API_KEY" MUST be replaced later
 * with a call to your secure backend endpoint.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.4 (INSECURE DEMO)...");

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
            initialLoadCount: 6,
            // !!! INSECURE !!! Using placeholder key directly in URL structure
            geminiApiKeyPlaceholder: "AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs", // <<<=== ИСПОЛЬЗУЙ ЭТО ТОЛЬКО КАК ЗАПОЛНИТЕЛЬ!
            geminiApiUrlTemplate: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=`, // Base URL, key added in fetch
            visibleCards: 3,
            placeholderAvatarBaseUrl: 'https://placehold.co/100x100/'
        }
    };

    // --- Testimonial Slider State ---
    let currentTestimonialIndex = 0;
    let totalTestimonialsLoaded = 0;
    let isTestimonialLoading = false;
    let cardWidth = 0;
    let cardGap = 0;
    let visibleCardsCount = config.testimonials.visibleCards;

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

    // 5. AI Demo Simulation
    if (config.aiDemo.enabled && demoSection && aiOutput && aiProgressBar && aiProgressLabel && aiFakeInput && aiStatusIndicator) {
        let currentTextIndex = 0; let currentProgress = 0; let demoIsRunning = false; let demoTimeoutId = null;
        const demoTexts = [ /* ... AI Demo Texts ... */
             { text: "Boot Sequence Initiated...", type: "status", delay: 500 }, { text: "Loading AI Core v19...", type: "status" }, { text: "Accessing Neural Network Interface...", type: "status" }, { text: "Query Received: 'Optimal Learning Path - Math (Grade 9)'", type: "input", inputSpeed: 60 }, { text: "Processing User Profile: CyberMike_77...", type: "process" }, { text: "Scanning Knowledge Base (Algebra, Geometry, Functions)...", type: "process", progressText: "Scanning KB" }, { text: "Analyzing performance metrics...", type: "analysis" }, { text: "Identified Weak Points: Polynomial Factoring, Circle Theorems.", type: "analysis", progressText: "Analyzing Weaknesses" }, { text: "WARNING: Low confidence score in Trigonometric Identities.", type: "warning", delay: 300 }, { text: "Executing Adaptive Path Correction Subroutine...", type: "process" }, { text: "Generating Personalized Lesson Plan...", type: "process", progressText: "Generating Plan" }, { text: "Module 1: Interactive Polynomial Factoring Drill.", type: "output" }, { text: "Module 2: Visual Proofs for Circle Theorems.", type: "output" }, { text: "Module 3: Targeted Practice: Trig Identities.", type: "output" }, { text: "Calculating Optimal Time Allocation...", type: "analysis" }, { text: "Simulating CERMAT Exam Conditions (Difficulty Level: High)...", type: "process", progressText: "Simulating Exam" }, { text: "Cross-referencing with historical exam patterns...", type: "process" }, { text: "Optimization Complete. Learning Path Ready.", type: "status", delay: 500, final: true },
        ];
        const progressIncrement = 100 / (demoTexts.length - 1 || 1);
        const typeText = (element, text, speed) => new Promise((resolve) => { /* ... typeText implementation ... */
            let i = 0; element.textContent = ''; const intervalId = setInterval(() => { if (i < text.length) { element.textContent += text.charAt(i); i++; } else { clearInterval(intervalId); resolve(); } }, speed);
        });
        const runAIDemoStep = async () => { /* ... runAIDemoStep implementation ... */
            if (currentTextIndex >= demoTexts.length || !demoIsRunning) { aiStatusIndicator.textContent = "IDLE"; aiProgressLabel.textContent = currentTextIndex >= demoTexts.length ? "Processing Complete" : "Demo Stopped"; if(currentTextIndex >= demoTexts.length) aiProgressBar.style.width = '100%'; demoIsRunning = false; if (demoTimeoutId) clearTimeout(demoTimeoutId); return; } const item = demoTexts[currentTextIndex]; const logLine = document.createElement('p'); logLine.classList.add('ai-log-line', item.type || 'status'); logLine.setAttribute('role', 'logitem'); aiStatusIndicator.textContent = item.progressText || "PROCESSING"; if (item.type === 'input') { aiFakeInput.parentElement?.classList.add('typing'); await typeText(aiFakeInput, item.text, item.inputSpeed || config.aiDemo.typingSpeed); await new Promise(resolve => setTimeout(resolve, 300)); logLine.textContent = `> ${item.text}`; aiFakeInput.textContent = ''; aiFakeInput.parentElement?.classList.remove('typing'); } else { await typeText(logLine, item.text, config.aiDemo.typingSpeed); } aiOutput.appendChild(logLine); aiOutput.scrollTo({ top: aiOutput.scrollHeight, behavior: 'smooth' }); if (currentTextIndex > 0 || demoTexts.length === 1) currentProgress += progressIncrement; const displayProgress = Math.min(currentProgress, 100); aiProgressBar.style.width = `${displayProgress}%`; aiProgressBar.setAttribute('aria-valuenow', Math.round(displayProgress)); aiProgressLabel.textContent = `${item.progressText || item.type || 'Status'} // ${item.text.substring(0, 30)}...`; currentTextIndex++; const delay = (item.delay || 0) + config.aiDemo.stepBaseDelay + Math.random() * config.aiDemo.stepRandomDelay; if (demoIsRunning) demoTimeoutId = setTimeout(runAIDemoStep, delay);
        };
        const startDemo = () => { /* ... startDemo implementation ... */
            if (demoIsRunning) return; console.log("AI Demo section intersecting, starting simulation..."); demoIsRunning = true; aiOutput.innerHTML = ''; aiFakeInput.textContent = ''; aiProgressBar.style.width = '0%'; aiProgressBar.setAttribute('aria-valuenow', '0'); aiStatusIndicator.textContent = "INITIALIZING"; aiProgressLabel.textContent = "Initializing // Please wait..."; currentTextIndex = 0; currentProgress = 0; if (demoTimeoutId) clearTimeout(demoTimeoutId); runAIDemoStep();
         };
        const stopDemo = () => { /* ... stopDemo implementation ... */
            if (!demoIsRunning) return; console.log("AI Demo section out of view, stopping simulation."); demoIsRunning = false; if (demoTimeoutId) clearTimeout(demoTimeoutId); aiStatusIndicator.textContent = "PAUSED"; aiProgressLabel.textContent = "Demo Paused // Scroll down to resume";
        };
        const demoObserver = new IntersectionObserver((entries) => entries.forEach(entry => { if (entry.isIntersecting) startDemo(); else stopDemo(); }), { threshold: 0.5 });
        if (demoSection) demoObserver.observe(demoSection);
        console.log("AI Demo observer attached.");
    } else console.warn("AI Demo elements or section not found, or demo disabled in config.");


    // 6. Scroll Animations (Intersection Observer)
    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => { /* ... scroll animation observer logic ... */
            if (entry.isIntersecting) { const element = entry.target; const delay = (parseInt(element.style.getPropertyValue('--animation-order') || '0', 10)) * config.animations.staggerDelay; if (element.hasAttribute('data-animate-letters') && !element.classList.contains('letters-animated')) { element.classList.add('letters-animating'); const text = element.textContent?.trim() ?? ''; element.innerHTML = ''; text.split('').forEach((char, charIndex) => { const span = document.createElement('span'); span.textContent = char === ' ' ? '\u00A0' : char; const randomDelay = Math.random() * config.animations.letterRandomOffset; span.style.animation = `letter-pop-in 0.6s ${delay + charIndex * config.animations.letterDelay + randomDelay}ms forwards cubic-bezier(0.2, 0.8, 0.2, 1.2)`; element.appendChild(span); }); element.classList.add('letters-animated'); observer.unobserve(element); } else if (element.hasAttribute('data-animate') && !element.classList.contains('animated')) { setTimeout(() => { element.classList.add('animated'); observer.unobserve(element); }, delay); } else { observer.unobserve(element); } }
        });
    }, {
        threshold: config.animations.scrollThreshold,
    });
    document.querySelectorAll('[data-animate], [data-animate-letters]').forEach(el => scrollObserver.observe(el));
    console.log(`Scroll observer attached for entry animations.`);

    // 7. Smooth Scroll for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) { /* ... smooth scroll logic ... */
            const href = this.getAttribute('href'); if (!href || href === '#') return; try { const targetElement = document.querySelector(href); if (targetElement) { e.preventDefault(); const headerOffset = header?.offsetHeight || 70; const elementPosition = targetElement.getBoundingClientRect().top; const offsetPosition = elementPosition + window.pageYOffset - headerOffset; window.scrollTo({ top: offsetPosition, behavior: "smooth" }); toggleMenu(false); } else console.warn(`Smooth scroll target element not found: ${href}`); } catch (err) { console.error(`Error finding element for smooth scroll: ${href}`, err); }
        });
    });
    console.log("Smooth scroll initialized.");

    // ========================================================
    // 8. Testimonial Slider & **Client-Side Gemini API Call Structure**
    //    !!! INSECURE - FOR DEMONSTRATION ONLY !!!
    // ========================================================
    if (sliderContainer && sliderTrack && prevBtn && nextBtn) {

        const getRandomColorPair = () => {
             const colors = [ { bg: 'a05cff', text: 'FFFFFF' }, { bg: '00e0ff', text: '03020c' }, { bg: 'ff33a8', text: 'FFFFFF' }, { bg: 'f0e14a', text: '03020c' }, { bg: '00ffaa', text: '03020c' }, { bg: 'ff9a00', text: 'FFFFFF' } ];
            return colors[Math.floor(Math.random() * colors.length)];
        };
        const generateStarsHTML = (rating) => {
            let starsHTML = ''; const fullStars = Math.floor(rating); const halfStar = rating % 1 >= 0.5; const emptyStars = 5 - fullStars - (halfStar ? 1 : 0); for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fas fa-star" aria-hidden="true"></i>'; if (halfStar) starsHTML += '<i class="fas fa-star-half-alt" aria-hidden="true"></i>'; for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star" aria-hidden="true"></i>'; return starsHTML;
        };

        const createTestimonialCardElement = (testimonialData) => {
            const card = document.createElement('article');
            card.className = 'testimonial-card';
            card.classList.remove('is-loading');
            card.innerHTML = `
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
            const ratingEl = card.querySelector('.testimonial-rating');
            const textEl = card.querySelector('.testimonial-text-content');
            const nameEl = card.querySelector('.testimonial-name');
            const roleEl = card.querySelector('.testimonial-role');
            const avatarEl = card.querySelector('.testimonial-avatar');

            if (ratingEl) { ratingEl.innerHTML = generateStarsHTML(testimonialData.rating || 0); ratingEl.setAttribute('aria-label', `Hodnocení: ${testimonialData.rating || 0} z 5 hvězdiček`); }
            if (textEl) textEl.textContent = testimonialData.text || 'Nepodařilo se načíst text recenze.';
            if (nameEl) nameEl.textContent = testimonialData.name || 'Anonymní Uživatel';
            if (roleEl) roleEl.textContent = testimonialData.role || 'Student';
            if (avatarEl) { const name = testimonialData.name || 'AU'; const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '??'; const colors = getRandomColorPair(); const avatarUrl = `${config.testimonials.placeholderAvatarBaseUrl}${colors.bg}/${colors.text}/png?text=${encodeURIComponent(initials)}&font=poppins`; avatarEl.style.backgroundImage = `url('${avatarUrl}')`; avatarEl.setAttribute('aria-label', `Avatar ${testimonialData.name || 'uživatele'}`); }
            return card;
        };

        // ***** INSECURE FUNCTION to call Gemini API Directly *****
        // ***** MUST BE REPLACED by a call to your secure backend *****
        const fetchTestimonialFromGeminiAPI = async () => {
            isTestimonialLoading = true;
            nextBtn.disabled = true;
            prevBtn.disabled = true;
            console.log("Fetching new testimonial directly from Gemini API (INSECURE)...");

            // !!! REPLACE "GEMINI_API_KEY" with your actual key ONLY FOR TESTING !!!
            // !!! DO NOT DEPLOY THIS CODE WITH A REAL KEY !!!
            const apiKey = config.testimonials.geminiApiKeyPlaceholder; // Use placeholder
            const apiUrl = config.testimonials.geminiApiUrlTemplate + apiKey;

            // --- Prompt Engineering ---
            // This prompt asks for specific fields. Gemini might not always follow perfectly.
            // Robust parsing or asking for JSON output (if supported and desired) is better.
            const prompt = `Napiš krátkou, pozitivní recenzi (testimonial) pro online vzdělávací AI platformu Justax v češtině. Recenze by měla být od studenta, rodiče nebo učitele. Zahrň hodnocení od 3 do 5 hvězdiček. Naformátuj odpověď PŘESNĚ takto:\nJméno: [Vymysli české jméno a příjmení, např. Petra N.]\nRole: [Student/Rodič/Učitel]\nHodnocení: [Číslo od 3 do 5, může být i .5]\nText: [Samotný text recenze, cca 1-3 věty.]`;

            const requestBody = {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                // Optional: Add generationConfig for temperature, max tokens etc.
                 generationConfig: {
                     temperature: 0.8, // Higher temp for more creative names/text
                     maxOutputTokens: 150,
                 }
            };

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    // Attempt to read error body for more details
                    let errorBody = null;
                    try { errorBody = await response.json(); } catch (e) { /* ignore json parsing error */ }
                    console.error("Gemini API Error Response:", errorBody);
                    throw new Error(`Gemini API error! Status: ${response.status}. ${errorBody?.error?.message || 'No details'}`);
                }

                const data = await response.json();
                console.log("Raw Gemini API Response:", data);

                // --- Parsing the Response ---
                // This is basic parsing based on the requested format in the prompt.
                // It's FRAGILE and might break if Gemini changes formatting slightly.
                // A backend should ideally handle parsing more robustly.
                if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
                    const generatedText = data.candidates[0].content.parts[0].text;
                    console.log("Generated Text:", generatedText);

                    const testimonialData = { name: null, role: null, rating: null, text: null };

                    const lines = generatedText.split('\n');
                    lines.forEach(line => {
                        if (line.toLowerCase().startsWith("jméno:")) testimonialData.name = line.substring(6).trim();
                        else if (line.toLowerCase().startsWith("role:")) testimonialData.role = line.substring(5).trim();
                        else if (line.toLowerCase().startsWith("hodnocení:")) {
                             const ratingMatch = line.match(/[\d.,]+/); // Extract number
                             if(ratingMatch) testimonialData.rating = parseFloat(ratingMatch[0].replace(',', '.'));
                        }
                        else if (line.toLowerCase().startsWith("text:")) testimonialData.text = line.substring(5).trim();
                    });

                    // Fallback if parsing failed for text
                    if (!testimonialData.text) testimonialData.text = generatedText.trim();
                    // Basic validation/defaults
                    testimonialData.name = testimonialData.name || "AI Uživatel";
                    testimonialData.role = testimonialData.role || "Student";
                    testimonialData.rating = (testimonialData.rating >= 3 && testimonialData.rating <= 5) ? testimonialData.rating : 4; // Default rating

                    console.log("Parsed Testimonial Data:", testimonialData);
                    return testimonialData;

                } else {
                    console.error("Unexpected Gemini API response structure:", data);
                    throw new Error("Could not parse Gemini API response.");
                }

            } catch (error) {
                console.error("Error calling Gemini API:", error);
                return { name: "Chyba API", text: `Nepodařilo se kontaktovat AI (${error.message})`, rating: 0, role:"Systém"};
            } finally {
                isTestimonialLoading = false;
                 // Button states are updated in updateSliderPosition which is called after fetch attempt
                console.log("Gemini API fetch attempt finished.");
            }
        };
        // ***** END OF INSECURE FUNCTION *****

        const addTestimonialCardToTrack = (testimonialData) => {
            const newCard = createTestimonialCardElement(testimonialData);
            sliderTrack.appendChild(newCard);
            totalTestimonialsLoaded++;
        };

        const updateSliderPosition = () => {
            if (cardWidth === 0 && totalTestimonialsLoaded > 0) calculateSliderDimensions();
            if (cardWidth === 0) return; // Still cannot calculate
            const translateValue = -currentTestimonialIndex * (cardWidth + cardGap);
            sliderTrack.style.transform = `translateX(${translateValue}px)`;
            prevBtn.disabled = isTestimonialLoading || currentTestimonialIndex === 0;
            nextBtn.disabled = isTestimonialLoading;
        };

        const moveSlider = async (direction) => {
            if (isTestimonialLoading) return;
            const newIndex = currentTestimonialIndex + direction;
            if (newIndex < 0) return;

            if (newIndex >= totalTestimonialsLoaded) {
                 console.log(`Index ${newIndex} needs loading. Fetching via API...`);
                 // !!! Using the INSECURE direct API call function !!!
                 const newData = await fetchTestimonialFromGeminiAPI();

                 if (newData && newData.name !== "Chyba API") {
                    addTestimonialCardToTrack(newData);
                    if(totalTestimonialsLoaded <= visibleCardsCount + 1) calculateSliderDimensions();
                    currentTestimonialIndex = newIndex;
                    updateSliderPosition();
                 } else {
                     console.error("Failed to load new testimonial from API.");
                     updateSliderPosition(); // Re-enable buttons
                 }
             } else {
                 currentTestimonialIndex = newIndex;
                 updateSliderPosition();
            }
        };

        const calculateSliderDimensions = () => {
            const firstCard = sliderTrack.querySelector('.testimonial-card:not(.is-loading)');
            if (!firstCard || !sliderTrack) return;
            const oldVisibleCount = visibleCardsCount;
            if (window.innerWidth <= 768) visibleCardsCount = 1;
            else if (window.innerWidth <= 992) visibleCardsCount = 2;
            else visibleCardsCount = 3;
            cardWidth = firstCard.offsetWidth;
            const trackStyle = window.getComputedStyle(sliderTrack);
            cardGap = parseFloat(trackStyle.gap) || 0;
            if (oldVisibleCount !== visibleCardsCount) currentTestimonialIndex = Math.max(0, Math.min(currentTestimonialIndex, totalTestimonialsLoaded - visibleCardsCount));
            console.log(`Slider dimensions recalculated: CardWidth=${cardWidth}, Gap=${cardGap}, Visible=${visibleCardsCount}`);
            updateSliderPosition();
        };

        const initializeSlider = async () => {
            console.log("Initializing testimonial slider with API calls...");
            sliderTrack.innerHTML = '';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            isTestimonialLoading = true; // Lock during initial load

            const loadPromises = [];
            for (let i = 0; i < config.testimonials.initialLoadCount; i++) {
                // !!! Using the INSECURE direct API call function !!!
                loadPromises.push(fetchTestimonialFromGeminiAPI());
            }

            try {
                 const initialData = await Promise.all(loadPromises);
                 console.log("Initial testimonials fetched via API:", initialData.length);
                 initialData.forEach(data => {
                     if (data && data.name !== "Chyba API") addTestimonialCardToTrack(data);
                 });
                 if (totalTestimonialsLoaded > 0) calculateSliderDimensions();
                 else { console.warn("No testimonials were loaded initially via API."); sliderTrack.innerHTML = '<p>Nepodařilo se načíst žádné recenze.</p>'; }
            } catch (error) {
                console.error("Error during initial API testimonial load:", error);
                sliderTrack.innerHTML = '<p>Chyba při načítání recenzí.</p>';
            } finally {
                 isTestimonialLoading = false; // Reset loading state
                 updateSliderPosition(); // Ensure button state is correct
                 console.log("Slider initialization via API finished.");
            }
        };

        prevBtn.addEventListener('click', () => moveSlider(-1));
        nextBtn.addEventListener('click', () => moveSlider(1));
        window.addEventListener('resize', debounce(calculateSliderDimensions, 250));
        initializeSlider();

    } else {
        console.warn("Testimonial slider elements not found. Slider cannot be initialized.");
    }


    // --- Final Initialization ---
    console.log("JUSTAX Interface v2.4 Initialization Complete (INSECURE DEMO).");

}); // End DOMContentLoaded