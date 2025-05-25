/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, infinite testimonial slider,
 * Hero text mask reveal, interactive gradient, and enhanced visual effects.
 * Version: v2.33 (Hero Text Fix, AI Demo Stability, New Testimonials, Smoother Load)
 * Author: Gemini Modification
 * Date: 2025-05-25
 *
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.33...");

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

    const sliderContainer = document.getElementById('testimonialSliderContainer');
    const sliderTrack = document.getElementById('testimonialSliderTrack');
    const prevBtn = document.getElementById('prevTestimonialBtn');
    const nextBtn = document.getElementById('nextTestimonialBtn');

    const heroSection = document.querySelector('.hero');
    let heroHighlightSpan = null; // Will be set during setupLetterAnimation
    const heroHeading = document.getElementById('hero-heading');
    let rafIdGradient = null;

    const config = {
        mouseFollower: { enabled: true, followSpeed: 0.12, clickScale: 0.7, hoverScale: 1.5, textHoverScale: 1.3 },
        animations: { scrollThreshold: 0.1, staggerDelay: 110, letterMaskRevealDelay: 55, heroElementEntryDelay: 180 }, // Slightly adjusted timings
        aiDemo: { enabled: true, typingSpeed: 40, stepBaseDelay: 200, stepRandomDelay: 420, observerThreshold: 0.5 }, // Threshold for AI demo visibility
        testimonials: { placeholderAvatarBaseUrl: 'https://placehold.co/100x100/', visibleCardsDesktop: 3, bufferCards: 2, slideDuration: 550 }
    };

    let localTestimonials = [];
    let testimonialDataCache = [];
    let cardsInTrack = [];
    let stableVisibleStartIndex = config.testimonials.bufferCards;
    let totalCardsInDOM = 0;
    let cardWidthAndMargin = 0;
    let isSliding = false;
    let sliderInitialLoadComplete = false;
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // --- Smooth Page Load ---
    body.classList.add('page-loading');
    window.addEventListener('load', () => {
        setTimeout(() => {
            body.classList.remove('page-loading');
            body.classList.add('page-loaded');
            console.log("Page fully loaded, class 'page-loaded' added to body.");
        }, 250); // Increased delay for a more noticeable smooth load
    });

    // --- NEW Testimonials Data ---
    localTestimonials = [
        // Focusing on site features
        { name: "Markéta V.", role: "Studentka", rating: 5, text: "Adaptivní učení je naprosto úžasné! Systém poznal, kde mám mezery, a zaměřil se přesně na to. Ušetřila jsem tolik času." },
        { name: "Tomáš P.", role: "Student", rating: 4.5, text: "Interaktivní cvičení jsou skvělá. Okamžitá zpětná vazba a podrobná vysvětlení mi pomohly konečně pochopit složitější témata." },
        { name: "Lucie N.", role: "Rodič", rating: 5, text: "Sledování pokroku mé dcery je tak jednoduché! Vidím její výsledky a oblasti, na které se Justax zaměřuje. Doporučuji!" },
        { name: "Jakub S.", role: "Student", rating: 5, text: "AI Tutor je jako mít osobního učitele 24/7. Kdykoliv jsem si nevěděl rady s úkolem, dostal jsem rychlou a srozumitelnou pomoc." },
        { name: "Eva K.", role: "Studentka", rating: 4.5, text: "Chytré plánování mi vytvořilo studijní plán na míru mým cílům a časovým možnostem. Konečně mám ve studiu systém!" },
        { name: "Petr L.", role: "Student", rating: 5, text: "Nové inovativní nástroje, jako je generátor testů a pokročilá analytika, posunuly mé učení na úplně novou úroveň. Super!" },
        { name: "Aneta B.", role: "Studentka", rating: 4, text: "Databanka materiálů je sice obsáhlá, ale někdy mi chvíli trvá, než najdu přesně to, co hledám. Adaptivní učení to ale kompenzuje." },
        { name: "Filip M.", role: "Student", rating: 5, text: "AI asistent mi nejen pomáhá s učením, ale i s organizací času. Funkce chytrého plánování je top!" },
        { name: "Karolína D.", role: "Studentka", rating: 4.5, text: "Díky Justaxu a jeho interaktivním cvičením jsem si zlepšila známky o dva stupně. A sledování pokroku mě motivuje!" },
        { name: "Martin Č.", role: "Rodič", rating: 5, text: "AI Tutor vysvětlil synovi látku, se kterou bojoval ve škole, mnohem lépe. Investice, která se opravdu vyplatila." },
        { name: "Veronika Z.", role: "Studentka", rating: 5, text: "Adaptivní učení a personalizované plány jsou přesně to, co jsem potřebovala pro přípravu na maturitu. Cítím se mnohem jistější." },
        { name: "Ondřej H.", role: "Student", rating: 4.5, text: "Líbí se mi, jak AI analyzuje můj pokrok a navrhuje další kroky. Nové nástroje pro psaní esejí jsou taky super přídavek." },
        { name: "Tereza J.", role: "Studentka", rating: 5, text: "Interaktivní cvičení s okamžitou zpětnou vazbou jsou návyková! Učení mě konečně baví." },
        { name: "David K.", role: "Student", rating: 4, text: "Platforma je super, i když občas bych ocenil více typů interaktivních úkolů. AI Tutor je ale vždycky k dispozici." },
        { name: "Nikola P.", role: "Studentka", rating: 5, text: "Chytré plánování mi pomohlo skloubit školu, brigádu a přípravu na zkoušky. Bez Justaxu bych to nezvládla!" },
        // Add more testimonials as needed, linking them to features
        { name: "Jana Nová", role: "Rodič", rating: 4.5, text: "Sledování pokroku syna je přehledné. Adaptivní učení mu evidentně pomáhá v matematice." },
        { name: "Pavel Malý", role: "Student", rating: 5, text: "AI Tutor mi vysvětlil komplexní algoritmy lépe než kdokoliv jiný. Inovativní nástroje pro programování jsou plus." },
        { name: "Simona Krátká", role: "Studentka", rating: 4.5, text: "Díky chytrému plánování a interaktivním cvičením jsem se naučila na zkoušku z fyziky za poloviční čas!" },
        { name: "Robert Dlouhý", role: "Student", rating: 5, text: "Adaptivní učení je geniální. Žádné zbytečné opakování toho, co už umím. A nové nástroje na generování kvízů jsou super!" },
        { name: "Lenka Bílá", role: "Studentka", rating: 4, text: "AI asistent je skvělý pomocník, i když někdy bych uvítala více detailů ve vysvětleních. Sledování pokroku je motivující." }
    ];
    console.log(`Loaded ${localTestimonials.length} NEW testimonials focused on features.`);


    // --- Utility Functions & Core Logic ---
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    const getRandomColorPair = () => {
        const colors = [ { bg: 'a05cff', text: 'FFFFFF' }, { bg: '00e0ff', text: '03020c' }, { bg: 'ff33a8', text: 'FFFFFF' }, { bg: 'f0e14a', text: '03020c' }, { bg: '00ffaa', text: '03020c' }, { bg: 'ff9a00', text: 'FFFFFF' }, { bg: '7c4dff', text: 'FFFFFF' }, { bg: '00bcd4', text: '03020c' }];
        return colors[Math.floor(Math.random() * colors.length)];
    };

    const generateStarsHTML = (rating) => {
        let starsHTML = ''; const clampedRating = Math.max(0, Math.min(5, rating || 0)); const fullStars = Math.floor(clampedRating); const halfStar = clampedRating % 1 >= 0.45; const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
        for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fas fa-star" aria-hidden="true"></i>'; if (halfStar) starsHTML += '<i class="fas fa-star-half-alt" aria-hidden="true"></i>'; for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star" aria-hidden="true"></i>';
        return starsHTML;
    };

    const createPlaceholderCard = () => {
        const card = document.createElement('article'); card.className = 'testimonial-card is-loading'; card.innerHTML = '<div class="spinner"></div>'; card.setAttribute('aria-hidden', 'true');
        return card;
    };

    const updateCardContent = (cardElement, testimonialData) => {
        if (!cardElement) { console.warn("updateCardContent: null cardElement."); return; }
        try {
            const data = testimonialData && typeof testimonialData === 'object' ? testimonialData : { name: "Chyba Dat", text: "Neplatná data.", rating: 0, role: "Systém" };
            cardElement.classList.remove('is-loading'); cardElement.removeAttribute('aria-hidden'); cardElement.classList.add('card-content-updated');
            cardElement.innerHTML = `<div class="testimonial-content"><div class="testimonial-rating" aria-label="Hodnocení"></div><blockquote class="testimonial-text"><p class="testimonial-text-content"></p></blockquote></div><div class="testimonial-author"><div class="testimonial-avatar" role="img"></div><div class="testimonial-author-info"><div class="testimonial-name"></div><div class="testimonial-role"></div></div></div>`;
            const ratingEl = cardElement.querySelector('.testimonial-rating'); const textEl = cardElement.querySelector('.testimonial-text-content'); const nameEl = cardElement.querySelector('.testimonial-name'); const roleEl = cardElement.querySelector('.testimonial-role'); const avatarEl = cardElement.querySelector('.testimonial-avatar');
            const name = data.name || 'Uživatel'; const role = data.role || 'Neznámý'; const rating = data.rating; const text = data.text || 'Chybí text.';
            if (ratingEl) { ratingEl.innerHTML = generateStarsHTML(rating); ratingEl.setAttribute('aria-label', `Hodnocení: ${rating?.toFixed(1) || 0} z 5`); }
            if (textEl) textEl.textContent = text; if (nameEl) nameEl.textContent = name; if (roleEl) roleEl.textContent = role;
            if (avatarEl) {
                const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '??'; const colors = getRandomColorPair();
                const avatarUrl = `${config.testimonials.placeholderAvatarBaseUrl}${colors.bg}/${colors.text}/png?text=${encodeURIComponent(initials)}&font=poppins&font-size=0.4`;
                avatarEl.style.backgroundImage = `url('${avatarUrl}')`; avatarEl.setAttribute('aria-label', `Avatar ${name}`);
            }
            setTimeout(() => cardElement.classList.remove('card-content-updated'), 600);
        } catch (error) {
            console.error("Error in updateCardContent:", error, "Data:", testimonialData);
            if (cardElement) cardElement.innerHTML = "<p>Chyba při načítání recenze.</p>";
        }
    };

    const getRandomLocalTestimonial = () => {
        if (!localTestimonials || localTestimonials.length === 0) return { name: "Chyba", text: "Žádné recenze.", rating: 0, role: "Systém" };
        const currentCacheNames = new Set(testimonialDataCache.map(item => item?.name).filter(Boolean));
        let availableTestimonials = localTestimonials.filter(item => !currentCacheNames.has(item.name));
        if (availableTestimonials.length === 0) availableTestimonials = localTestimonials; // Reuse if all unique are used
        return availableTestimonials[Math.floor(Math.random() * availableTestimonials.length)];
    };

    const calculateCardWidthAndMargin = () => {
        if (!sliderTrack || !sliderTrack.firstChild) { console.warn("calculateCardWidthAndMargin: No track or cards."); return 0; }
        const firstCard = sliderTrack.querySelector('.testimonial-card:not(.is-loading)') || sliderTrack.firstChild;
        if (!firstCard || typeof firstCard.offsetWidth === 'undefined') { console.warn("calculateCardWidthAndMargin: Invalid card."); return 0; }
        const style = window.getComputedStyle(firstCard); const width = firstCard.offsetWidth; const marginRight = parseFloat(style.marginRight) || 0;
        if (width <= 0) { console.warn(`Card width is invalid: ${width}px`); return 0; }
        cardWidthAndMargin = width + marginRight;
        return cardWidthAndMargin;
    };

    const setTrackPositionInstantly = (logReason = "default") => {
        if (!sliderInitialLoadComplete || !sliderTrack) { return; }
        if (cardWidthAndMargin <= 0) { if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) { console.error(`setTrackPositionInstantly (${logReason}): Recalc failed.`); return; } }
        sliderTrack.style.transition = 'none'; const position = -stableVisibleStartIndex * cardWidthAndMargin; sliderTrack.style.transform = `translateX(${position}px)`;
        void sliderTrack.offsetHeight; sliderTrack.style.transition = `transform ${config.testimonials.slideDuration}ms cubic-bezier(0.65, 0, 0.35, 1)`;
    };

    const handleSliderTransitionEnd = () => {
        if (!isSliding || !sliderTrack) return;
        try {
            const direction = parseInt(sliderTrack.dataset.slideDirection || "0"); if (direction === 0) { throw new Error("No slide direction."); }
            let cardToMoveElement, newCardData;
            if (direction > 0) {
                cardToMoveElement = cardsInTrack.shift(); sliderTrack.removeChild(cardToMoveElement); newCardData = getRandomLocalTestimonial(); updateCardContent(cardToMoveElement, newCardData); sliderTrack.appendChild(cardToMoveElement); cardsInTrack.push(cardToMoveElement);
                testimonialDataCache.shift(); testimonialDataCache.push(newCardData);
            } else {
                cardToMoveElement = cardsInTrack.pop(); sliderTrack.removeChild(cardToMoveElement); newCardData = getRandomLocalTestimonial(); updateCardContent(cardToMoveElement, newCardData); sliderTrack.insertBefore(cardToMoveElement, sliderTrack.firstChild); cardsInTrack.unshift(cardToMoveElement);
                testimonialDataCache.pop(); testimonialDataCache.unshift(newCardData);
            }
            setTrackPositionInstantly("transition end adjustment");
        } catch (error) {
            console.error("Error in handleSliderTransitionEnd:", error);
            setTrackPositionInstantly("error recovery in transition end");
        } finally {
            sliderTrack.dataset.slideDirection = "0"; isSliding = false; if(prevBtn) prevBtn.disabled = false; if(nextBtn) nextBtn.disabled = false;
        }
    };

    const moveSlider = (direction) => {
        if (isSliding || !sliderInitialLoadComplete || !sliderTrack) return;
        if (cardWidthAndMargin <= 0) { if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) { console.error("moveSlider: Recalc failed."); return; } setTrackPositionInstantly("pre-slide recalc"); }
        isSliding = true; if(prevBtn) prevBtn.disabled = true; if(nextBtn) nextBtn.disabled = true;
        sliderTrack.dataset.slideDirection = direction.toString();
        const newTranslateX = (-stableVisibleStartIndex - direction) * cardWidthAndMargin;
        sliderTrack.removeEventListener('transitionend', handleSliderTransitionEnd); sliderTrack.addEventListener('transitionend', handleSliderTransitionEnd, { once: true });
        sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
    };

    const initializeInfiniteSlider = async () => {
        console.log("Starting infinite slider initialization v2.33...");
        if (!sliderTrack || !prevBtn || !nextBtn) { console.error("Slider init fail: core elements missing."); return; }
        isSliding = true; sliderInitialLoadComplete = false; prevBtn.disabled = true; nextBtn.disabled = true;
        sliderTrack.innerHTML = ''; testimonialDataCache = []; cardsInTrack = []; cardWidthAndMargin = 0; stableVisibleStartIndex = config.testimonials.bufferCards;
        if (!localTestimonials || localTestimonials.length === 0) { sliderTrack.innerHTML = `<p>Chyba dat.</p>`; isSliding = false; return; }

        const numVisible = config.testimonials.visibleCardsDesktop; totalCardsInDOM = numVisible + 2 * config.testimonials.bufferCards;
        if (localTestimonials.length < totalCardsInDOM) console.warn(`Not enough unique testimonials (${localTestimonials.length}) for initial track (${totalCardsInDOM}).`);

        for (let i = 0; i < totalCardsInDOM; i++) { const cardElement = createPlaceholderCard(); sliderTrack.appendChild(cardElement); cardsInTrack.push(cardElement); }
        for (let i = 0; i < totalCardsInDOM; i++) {
            let testimonial; let attempts = 0;
            do { testimonial = localTestimonials[Math.floor(Math.random() * localTestimonials.length)]; attempts++; }
            while (testimonialDataCache.some(t => t.name === testimonial.name) && attempts < localTestimonials.length && localTestimonials.length > testimonialDataCache.length);
            testimonialDataCache.push(testimonial);
        }
        cardsInTrack.forEach((card, index) => updateCardContent(card, testimonialDataCache[index]));
        await new Promise(resolve => requestAnimationFrame(resolve));

        if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
            console.error("Card dimensions calc failed post-population. Slider abort."); sliderTrack.innerHTML = '<p>Chyba layoutu.</p>'; isSliding = false; return;
        }
        sliderInitialLoadComplete = true; setTrackPositionInstantly("initialization positioning");
        console.log(`Infinite slider initialized: ${cardsInTrack.length} cards, card+margin: ${cardWidthAndMargin}px.`);
        isSliding = false; prevBtn.disabled = false; nextBtn.disabled = false;
    };

    const handleScroll = () => {
        try {
            if (header) header.classList.toggle('scrolled', window.scrollY > 30);
            const sections = document.querySelectorAll('main section[id]');
            let currentSectionId = '';
            const scrollPosition = window.scrollY + (header ? header.offsetHeight : 70) + 40;
            sections.forEach(section => { if (section.offsetTop <= scrollPosition && (section.offsetTop + section.offsetHeight) > scrollPosition) currentSectionId = section.id; });
            if (navLinks) navLinks.querySelectorAll('.nav-item').forEach(item => { item.classList.remove('active'); if (item.getAttribute('href')?.includes(`#${currentSectionId}`)) item.classList.add('active'); });
        } catch (error) { console.error("Error in handleScroll:", error); }
    };

    const toggleMenu = () => {
        if (!hamburger || !navLinks || !menuOverlay || !body || !header) return;
        const isActive = hamburger.classList.toggle('active');
        navLinks.classList.toggle('active', isActive); menuOverlay.classList.toggle('active', isActive); body.classList.toggle('no-scroll', isActive); header.classList.toggle('menu-open', isActive);
        hamburger.setAttribute('aria-expanded', isActive.toString());
    };
    const closeMenu = () => {
        if (!hamburger || !navLinks || !menuOverlay || !body || !header || !hamburger.classList.contains('active')) return;
        hamburger.classList.remove('active'); navLinks.classList.remove('active'); menuOverlay.classList.remove('active'); body.classList.remove('no-scroll'); header.classList.remove('menu-open');
        hamburger.setAttribute('aria-expanded', 'false');
    };
    if (hamburger) hamburger.addEventListener('click', toggleMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);
    if (navLinks) navLinks.addEventListener('click', (e) => { if (e.target.matches('a.nav-item') || e.target.closest('a.mobile-auth-link')) closeMenu(); });

    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let followerX = mouseX, followerY = mouseY;
    let currentScale = 1, currentOpacity = 0;

    const updateFollower = () => {
        if (!follower || !config.mouseFollower.enabled || isTouchDevice) return;
        const dx = mouseX - followerX; const dy = mouseY - followerY;
        followerX += dx * config.mouseFollower.followSpeed; followerY += dy * config.mouseFollower.followSpeed;
        follower.style.transform = `translate(${followerX - follower.offsetWidth / 2}px, ${followerY - follower.offsetHeight / 2}px) scale(${currentScale})`;
        follower.style.opacity = currentOpacity.toString();
        requestAnimationFrame(updateFollower);
    };

    if (!isTouchDevice && follower && config.mouseFollower.enabled) {
        document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; if(follower.style.display === 'none') follower.style.display = ''; currentOpacity = 0.7;});
        document.addEventListener('mouseleave', () => { currentOpacity = 0; });
        document.addEventListener('mouseenter', () => { if(follower.style.display === 'none') follower.style.display = ''; currentOpacity = 0.7; });
        document.querySelectorAll('a, button, .btn, .slider-btn, .feature-card, .how-it-works-step, .yuki-card, input, textarea').forEach(el => {
            el.addEventListener('mouseenter', () => { currentScale = el.matches('input, textarea') ? config.mouseFollower.textHoverScale : config.mouseFollower.hoverScale; follower.classList.add('is-hovering'); });
            el.addEventListener('mouseleave', () => { currentScale = 1; follower.classList.remove('is-hovering'); });
        });
        body.addEventListener('mousedown', () => { currentScale = config.mouseFollower.clickScale; follower.classList.add('is-clicking'); });
        body.addEventListener('mouseup', () => { currentScale = follower.classList.contains('is-hovering') ? (Array.from(document.querySelectorAll('input, textarea')).some(i => i.matches(':hover')) ? config.mouseFollower.textHoverScale : config.mouseFollower.hoverScale ) : 1; follower.classList.remove('is-clicking'); });
        requestAnimationFrame(updateFollower);
    } else if (follower) {
        follower.style.display = 'none';
    }

    if (yearSpan) yearSpan.textContent = new Date().getFullYear().toString();

    // --- AI Demo Simulation ---
    const aiDemoSteps = [
        { type: 'status', text: 'AI jádro v2.33 aktivní. Připraven na analýzu...', progress: 5 },
        { type: 'status', text: 'Probíhá skenování interakcí uživatele ID: 734B...', delay: 700 },
        { type: 'input', text: 'ANALYZE_USER_PERFORMANCE --id=734B --subject=algebra --level=intermediate' },
        { type: 'process', text: 'Zpracování dotazu na výkon...', duration: 900, progress: 20 },
        { type: 'analysis', text: 'Načteno 188 relevantních datových bodů...' },
        { type: 'analysis', text: 'Identifikace vzorů: Problémy s kvadratickými rovnicemi (úspěšnost 38%), logaritmy (úspěšnost 55%).', delay: 600 },
        { type: "analysis", text: "Silné stránky: Lineární nerovnice (úspěšnost 95%), procenta (91%)."},
        { type: 'process', text: 'Generování personalizované strategie učení...', duration: 1300, progress: 50 },
        { type: 'output', text: 'Strategie: 1. Revize základů logaritmů (video + 2 cvičení). 2. Interaktivní modul na kvadratické rovnice. 3. Souhrnný test.' },
        { type: 'input', text: 'CREATE_ADAPTIVE_TASK_SEQUENCE --strategy_id=S734B_ALG --tasks=5' },
        { type: 'process', text: 'Sestavování sekvence úkolů...', duration: 1600, progress: 80 },
        { type: 'output', text: 'Sekvence vytvořena. Odhadovaný čas: 55 minut. První úkol: "Základy logaritmů - Interaktivní video".' },
        { type: 'status', text: 'Profil studenta aktualizován s novým plánem.', delay: 500 },
        { type: 'process', text: 'Synchronizace s cloudovým modulem Justax...', duration: 700, progress: 95 },
        { type: 'status', text: 'AI připravena. Čekám na další interakci.', progress: 100 }
    ];
    let currentAiStep = 0; let isAiDemoRunning = false; let aiDemoTimeout; let aiDemoHasRunOnce = false;

    const addAiLogLine = (text, type) => {
        if (!aiOutput) return; const line = document.createElement('div'); line.className = `ai-log-line ${type}`;
        const now = new Date(); const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
        line.innerHTML = `<span class="ai-log-timestamp">[${timeString}]</span> <span class="ai-log-text">${text}</span>`;
        aiOutput.appendChild(line); aiOutput.scrollTop = aiOutput.scrollHeight;
    };
    const simulateTyping = (text, onComplete) => {
        if (!aiFakeInput) { if(onComplete) onComplete(); return; }
        let index = 0; aiFakeInput.textContent = '';
        const interval = setInterval(() => {
            if (index < text.length) { aiFakeInput.textContent += text.charAt(index); index++; }
            else { clearInterval(interval); if (onComplete) setTimeout(onComplete, 150 + Math.random() * 100); }
        }, config.aiDemo.typingSpeed - 5 + Math.random() * 10);
    };
    const updateAiProgress = (percentage, label) => {
        if (aiProgressBar) { aiProgressBar.style.width = `${percentage}%`; aiProgressBar.setAttribute('aria-valuenow', percentage.toString());}
        if (aiProgressLabel && label) aiProgressLabel.textContent = label;
        else if (aiProgressLabel && percentage === 100) aiProgressLabel.textContent = "Systém připraven";
    };

    const runAiDemoStep = () => {
        if (currentAiStep >= aiDemoSteps.length || !aiOutput || !isAiDemoRunning) { // Added !isAiDemoRunning check
            isAiDemoRunning = false; if(aiStatusIndicator) aiStatusIndicator.textContent = 'IDLE'; updateAiProgress(100, "AI Idle / Čekání na vstup..."); return;
        }
        const step = aiDemoSteps[currentAiStep]; const baseDelay = step.delay || config.aiDemo.stepBaseDelay;
        const randomDelayPart = Math.random() * config.aiDemo.stepRandomDelay; const totalDelay = baseDelay + randomDelayPart;
        if (step.type === 'input') {
            if(aiProgressLabel) aiProgressLabel.textContent = "Očekávám vstup...";
            simulateTyping(step.text, () => {
                if (!isAiDemoRunning) return; // Check again if demo was paused during typing
                addAiLogLine(`> ${step.text}`, step.type); if (step.progress) updateAiProgress(step.progress, step.text); currentAiStep++; aiDemoTimeout = setTimeout(runAiDemoStep, totalDelay / 2);
            });
        } else {
            addAiLogLine(step.text, step.type);
            if (step.progress) updateAiProgress(step.progress, step.text); else if (step.type !== 'status' && aiProgressLabel) updateAiProgress( (currentAiStep / aiDemoSteps.length) * 100 , step.text);
            currentAiStep++; aiDemoTimeout = setTimeout(runAiDemoStep, totalDelay + (step.duration || 0));
        }
        if(aiStatusIndicator) aiStatusIndicator.textContent = step.type === 'process' ? 'ZPRACOVÁVÁM' : 'AKTIVNÍ';
    };

    const aiDemoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            try {
                if (entry.isIntersecting && !aiDemoHasRunOnce && config.aiDemo.enabled && demoSection) { // Run only once when it becomes visible enough
                    if (aiOutput && aiFakeInput && aiProgressLabel && aiProgressBar && aiStatusIndicator) {
                        console.log("AI Demo section sufficiently visible and elements found, starting simulation ONCE.");
                        isAiDemoRunning = true;
                        aiDemoHasRunOnce = true; // Set flag to prevent re-runs from observer
                        currentAiStep = 0;
                        aiOutput.innerHTML = ''; updateAiProgress(0, 'Inicializace AI...'); aiFakeInput.textContent = '';
                        runAiDemoStep();
                        // observer.unobserve(demoSection); // Optionally unobserve after first run
                    } else {
                        console.warn("AI Demo cannot start: one or more required elements are missing.");
                        if(aiStatusIndicator) aiStatusIndicator.textContent = 'CHYBA INIT';
                    }
                } else if (!entry.isIntersecting && isAiDemoRunning) {
                    // This part might still be problematic if scrolling away quickly during the demo's async steps
                    // For now, we won't pause it via observer to avoid the flickering, it will run to completion once started.
                    // If pausing is desired, a more robust state management for the demo steps is needed.
                    // console.log("AI Demo section no longer sufficiently visible. Current run will continue but not restart via observer.");
                }
            } catch (error) { console.error("Error in AI Demo observer:", error); isAiDemoRunning = false; if(aiStatusIndicator) aiStatusIndicator.textContent = 'CHYBA OBSERVERU';}
        });
    }, { threshold: config.aiDemo.observerThreshold }); // Use configured threshold

    if (demoSection && config.aiDemo.enabled) {
        if (aiOutput && aiFakeInput && aiProgressLabel && aiProgressBar && aiStatusIndicator) {
             aiDemoObserver.observe(demoSection);
        } else {
            console.error("AI Demo section found, but some child elements are missing. AI Demo will not run.");
            if(aiStatusIndicator) aiStatusIndicator.textContent = 'CHYBA ELEMENTŮ';
        }
    } else if (aiStatusIndicator) {
        aiStatusIndicator.textContent = config.aiDemo.enabled ? 'NEAKTIVNÍ' : 'OFFLINE';
    }


    // --- Scroll Animations & Hero Letter Animation ---
    const animatedElements = document.querySelectorAll('[data-animate], [data-animate-letters]');
    const observerOptions = { root: null, rootMargin: '0px 0px -50px 0px', threshold: config.animations.scrollThreshold };

    const setupLetterAnimation = (element) => {
        try {
            const textContent = element.textContent || ''; // Get current text content
            const originalHighlightHTML = element.querySelector('.highlight')?.innerHTML || ''; // Get innerHTML to preserve spans
            const originalHighlightDataText = element.querySelector('.highlight')?.dataset.text || '';

            element.innerHTML = ''; element.style.setProperty('--letter-count', textContent.length.toString());
            let charIndexGlobal = 0;
            let currentWordWrapper = document.createElement('span'); currentWordWrapper.className = 'word-wrapper'; element.appendChild(currentWordWrapper);
            let isInHighlight = false;
            let tempHighlightContent = '';

            // Split by highlight boundaries if highlight exists
            const parts = [];
            if (originalHighlightHTML && textContent.includes(originalHighlightHTML.replace(/<[^>]+>/g, ''))) { // Use stripped text for matching
                const highlightStripped = originalHighlightHTML.replace(/<[^>]+>/g, '');
                let lastIndex = 0;
                let pos = textContent.indexOf(highlightStripped, lastIndex);
                while(pos > -1){
                    if(pos > lastIndex) parts.push({text: textContent.substring(lastIndex, pos), isHighlight: false});
                    parts.push({text: highlightStripped, isHighlight: true, originalHTML: originalHighlightHTML, dataText: originalHighlightDataText});
                    lastIndex = pos + highlightStripped.length;
                    pos = textContent.indexOf(highlightStripped, lastIndex);
                }
                if(lastIndex < textContent.length) parts.push({text: textContent.substring(lastIndex), isHighlight: false});
            } else {
                parts.push({text: textContent, isHighlight: false});
            }

            parts.forEach(part => {
                part.text.split('').forEach(char => {
                    const span = document.createElement('span'); span.className = 'letter-span'; span.textContent = char === ' ' ? '\u00A0' : char; span.style.setProperty('--letter-index', charIndexGlobal.toString());

                    if (part.isHighlight) {
                        let highlightContainerInWord = currentWordWrapper.querySelector('.highlight');
                        if (!highlightContainerInWord) {
                            highlightContainerInWord = document.createElement('span');
                            highlightContainerInWord.className = 'highlight';
                            if(part.dataText) highlightContainerInWord.dataset.text = part.dataText;
                            currentWordWrapper.appendChild(highlightContainerInWord);
                            if (element === heroHeading) {
                                heroHighlightSpan = highlightContainerInWord; // Assign to global var
                                console.log("GLOBAL heroHighlightSpan set during setupLetterAnimation for heroHeading.");
                            }
                        }
                        highlightContainerInWord.appendChild(span);
                    } else {
                        currentWordWrapper.appendChild(span);
                    }
                    if (char === ' ') { currentWordWrapper = document.createElement('span'); currentWordWrapper.className = 'word-wrapper'; element.appendChild(currentWordWrapper); }
                    charIndexGlobal++;
                });
            });

            // Ensure heroHighlightSpan is set if it's the hero heading and highlight exists
            if (element === heroHeading && !heroHighlightSpan) {
                heroHighlightSpan = element.querySelector('.highlight'); // Try to find it again
                if (heroHighlightSpan) console.log("GLOBAL heroHighlightSpan (fallback) set for heroHeading.");
            }

        } catch (error) { console.error("Error in setupLetterAnimation for element:", element, error); }
    };


    const animationObserver = new IntersectionObserver((entries, observerInstance) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const element = entry.target;
                try {
                    const animationOrder = parseInt(element.style.getPropertyValue('--animation-order') || '0');
                    const baseDelay = animationOrder * config.animations.staggerDelay;
                    element.style.opacity = '0'; // Ensure it's hidden before animation starts

                    if (element.dataset.animateLetters !== undefined) {
                        if (!element.classList.contains('letters-setup-complete')) {
                            setupLetterAnimation(element); // Sets up spans, potentially updates heroHighlightSpan
                            element.classList.add('letters-setup-complete');

                            // Use rAF for triggering class to ensure DOM update
                            requestAnimationFrame(() => {
                                element.style.opacity = '1'; // Make parent visible
                                element.classList.add('is-revealing'); // Trigger letter animation

                                if (element === heroHeading) {
                                    const letterCount = parseInt(element.style.getPropertyValue('--letter-count') || '10');
                                    const h1AnimationDuration = (letterCount * config.animations.letterMaskRevealDelay) + 700; // Increased base for full reveal
                                    document.querySelectorAll('.hero p[data-animate], .hero .hero-buttons[data-animate]').forEach(el => {
                                        if (el) {
                                            el.style.opacity = '0'; // Ensure these are hidden initially
                                            const heroElOrder = parseInt(el.style.getPropertyValue('--animation-order') || '0');
                                            el.style.transitionDelay = `${h1AnimationDuration + (heroElOrder * config.animations.heroElementEntryDelay)}ms`;
                                            el.classList.add('animated'); // This class should set opacity to 1
                                        }
                                    });
                                }
                            });
                        }
                    } else {
                        element.style.transitionDelay = `${baseDelay}ms`;
                        element.classList.add('animated'); // This class should set opacity to 1
                    }
                } catch (error) {
                    console.error("Error processing animation for element:", element, error);
                    if(element) element.style.opacity = '1'; // Fallback to visible if animation setup fails
                }
                observerInstance.unobserve(element);
            }
        });
    }, observerOptions);

    if (animatedElements.length > 0) {
        animatedElements.forEach(el => {
            if (el) {
                 el.style.opacity = '0'; // Initially hide all elements to be animated by observer
                 animationObserver.observe(el);
            }
        });
        console.log(`Observing ${animatedElements.length} elements for scroll animations.`);
    } else {
        console.warn("No elements found for scroll animation.");
    }

    // --- Interactive Gradient for Hero ---
    const handleHeroMouseMove = (event) => {
        if (!heroSection || isTouchDevice) return;
        if (!heroHighlightSpan || !document.contains(heroHighlightSpan)) { // Ensure heroHighlightSpan is valid
             if (heroHeading) heroHighlightSpan = heroHeading.querySelector('.highlight'); // Attempt to re-query
             if (!heroHighlightSpan || !document.contains(heroHighlightSpan)) return; // Exit if still not valid
        }

        if (rafIdGradient) cancelAnimationFrame(rafIdGradient);
        rafIdGradient = requestAnimationFrame(() => {
            try {
                const rect = heroSection.getBoundingClientRect();
                const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
                const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
                const currentX = parseFloat(heroHighlightSpan.style.getPropertyValue('--mouse-x') || "0.5");
                const currentY = parseFloat(heroHighlightSpan.style.getPropertyValue('--mouse-y') || "0.5");
                heroHighlightSpan.style.setProperty('--mouse-x', (currentX + (x - currentX) * 0.2).toFixed(3));
                heroHighlightSpan.style.setProperty('--mouse-y', (currentY + (y - currentY) * 0.2).toFixed(3));
            } catch (error) { console.error("Error in handleHeroMouseMove (gradient):", error); }
        });
    };

    if (heroSection && !isTouchDevice) {
        console.log("Initializing interactive hero gradient listener.");
        heroSection.addEventListener('mousemove', handleHeroMouseMove);
        heroSection.addEventListener('mouseleave', () => {
            if (rafIdGradient) cancelAnimationFrame(rafIdGradient);
            if (heroHighlightSpan && document.contains(heroHighlightSpan)) {
                let currentX = parseFloat(heroHighlightSpan.style.getPropertyValue('--mouse-x') || "0.5");
                let currentY = parseFloat(heroHighlightSpan.style.getPropertyValue('--mouse-y') || "0.5");
                const resetIntervalId = setInterval(() => {
                    if (!heroHighlightSpan || !document.contains(heroHighlightSpan)) { clearInterval(resetIntervalId); return; }
                    currentX += (0.5 - currentX) * 0.1; currentY += (0.5 - currentY) * 0.1;
                    heroHighlightSpan.style.setProperty('--mouse-x', currentX.toFixed(3)); heroHighlightSpan.style.setProperty('--mouse-y', currentY.toFixed(3));
                    if (Math.abs(currentX - 0.5) < 0.01 && Math.abs(currentY - 0.5) < 0.01) {
                        heroHighlightSpan.style.setProperty('--mouse-x', "0.5"); heroHighlightSpan.style.setProperty('--mouse-y', "0.5");
                        clearInterval(resetIntervalId);
                    }
                }, 16);
            }
        });
    } else if (isTouchDevice) {
        // Delay setting static gradient until after letter animation might have run and set heroHighlightSpan
        setTimeout(() => {
            let targetSpan = heroHighlightSpan;
            if (!targetSpan && heroHeading) targetSpan = heroHeading.querySelector('.highlight');

            if (targetSpan && document.contains(targetSpan)) {
                targetSpan.style.setProperty('--mouse-x', 0.5);
                targetSpan.style.setProperty('--mouse-y', 0.3);
                console.log("Touch device: Hero gradient set to static.");
            } else {
                console.warn("Touch device: heroHighlightSpan could not be found to set static gradient.");
            }
        }, 2000); // Increased delay to ensure letter animation completes
    }


    // --- Event Listeners & Final Initializations ---
    window.addEventListener('scroll', debounce(handleScroll, 50)); // Increased debounce for scroll
    if (prevBtn) prevBtn.addEventListener('click', () => moveSlider(-1)); else console.warn("Prev button not found for slider.");
    if (nextBtn) nextBtn.addEventListener('click', () => moveSlider(1)); else console.warn("Next button not found for slider.");

    window.addEventListener('resize', debounce(() => {
        console.log("Window resized, slider recalculation...");
        if (sliderInitialLoadComplete && sliderTrack) {
            if (calculateCardWidthAndMargin() > 0) setTrackPositionInstantly("resize adjustment");
            else console.error("Card width recalc failed on resize.");
        }
    }, 250)); // Increased debounce for resize

    try {
        handleScroll(); // Initial states
        // Defer slider init slightly more to ensure layout is stable for calculations
        setTimeout(() => {
            initializeInfiniteSlider().catch(err => console.error("Error initializing slider:", err));
        }, 300);
    } catch (error) {
        console.error("Error during final initializations:", error);
    }

    // The main "Initialization Complete" log was moved to the end of window.load
    // to better reflect when the page is visually ready.
});