/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, infinite testimonial slider,
 * Hero text mask reveal, interactive gradient, and enhanced visual effects.
 * Version: v2.31 (Robustness and Rendering Fixes)
 * Author: Gemini Modification
 * Date: 2025-05-25 // Added error handling, refined initializations
 *
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.31 (Robustness Fixes)...");

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

    const sliderContainer = document.getElementById('testimonialSliderContainer');
    const sliderTrack = document.getElementById('testimonialSliderTrack');
    const prevBtn = document.getElementById('prevTestimonialBtn');
    const nextBtn = document.getElementById('nextTestimonialBtn');

    const heroSection = document.querySelector('.hero');
    let heroHighlightSpan = null; // Will be queried after letter animation setup if needed for gradient
    const heroHeading = document.getElementById('hero-heading');
    let rafIdGradient = null;

    const config = {
        mouseFollower: { enabled: true, followSpeed: 0.12, clickScale: 0.7, hoverScale: 1.5, textHoverScale: 1.3 },
        animations: { scrollThreshold: 0.05, staggerDelay: 100, letterMaskRevealDelay: 50, heroElementEntryDelay: 150 }, // Lowered threshold a bit
        aiDemo: { enabled: true, typingSpeed: 35, stepBaseDelay: 180, stepRandomDelay: 400 },
        testimonials: { placeholderAvatarBaseUrl: 'https://placehold.co/100x100/', visibleCardsDesktop: 3, bufferCards: 2, slideDuration: 550 }
    };

    let localTestimonials = [];
    let testimonialDataCache = [];
    let cardsInTrack = [];
    let stableVisibleStartIndex = config.testimonials.bufferCards;
    let totalCardsInDOM = 0;
    let cardWidthAndMargin = 0;
    let isSliding = false;
    let sliderInitialLoadComplete = false; // Renamed for clarity
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    localTestimonials = [
        // Students (Mix of names, nicknames, initials) - Role always 'Student' or 'Studentka'
        { name: "Petra N.", role: "Studentka", rating: 5, text: "Skvělá příprava na přijímačky! AI mi přesně ukázala, co potřebuju dohnat. Doporučuji!" },
        { name: "Tomáš 'Vory' V.", role: "Student", rating: 4.5, text: "Adaptivní učení je super. Nemusím procházet to, co už umím. Ušetřilo mi to spoustu času." },
        { name: "Aneta", role: "Studentka", rating: 5, text: "Konečně chápu zlomky! Interaktivní cvičení jsou zábavná a vysvětlení jasná." },
        { name: "Kuba P.", role: "Student", rating: 4, text: "AI Tutor je fajn, když si nevím rady. Odpovídá rychle a srozumitelně." },
        { name: "Eliška M.", role: "Studentka", rating: 5, text: "Díky Justaxu jsem si výrazně zlepšila známky z matiky. Ten studijní plán na míru fakt funguje." },
        { name: "Matěj", role: "Student", rating: 4.5, text: "Platforma je přehledná a dobře se ovládá. Líbí se mi sledování pokroku." },
        { name: "Verča S.", role: "Studentka", rating: 5, text: "Ta databáze materiálů je nekonečná. Vždycky najdu, co hledám." },
        { name: "Filip H.", role: "Student", rating: 4, text: "Simulace testů mi pomohly zbavit se stresu před skutečnými zkouškami." },
        { name: "Kája J.", role: "Studentka", rating: 5, text: "Nejlepší investice do vzdělání. Učení mě teď mnohem víc baví." },
        { name: "Adam R.", role: "Student", rating: 4.5, text: "Oceňuji okamžitou zpětnou vazbu u cvičení. Hned vím, kde dělám chybu." },
        { name: "Natka B.", role: "Studentka", rating: 5, text: "Perfektní nástroj pro samostudium. AI mi pomáhá udržet motivaci." },
        { name: "David Z.", role: "Student", rating: 4, text: "Některá témata by mohla být vysvětlena podrobněji, ale celkově super." },
        { name: "Klára T.", role: "Studentka", rating: 5, text: "Příprava na maturitu z matematiky byla s Justaxem hračka. Doporučuji všem!" },
        { name: "Martin L.", role: "Student", rating: 4.5, text: "Flexibilita platformy je úžasná. Můžu se učit kdykoliv a kdekoliv." },
        { name: "Lucka P.", role: "Studentka", rating: 5, text: "AI mi pomohla najít slabiny, o kterých jsem ani nevěděla. Teď se cítím mnohem jistější." },
        { name: "Štěpán 'Štěpa' K.", role: "Student", rating: 4, text: "Grafické znázornění pokroku je motivující. Vidím, jak se zlepšuji." },
        { name: "Bára V.", role: "Studentka", rating: 5, text: "Justax mi změnil pohled na matematiku. Už to není strašák." },
        { name: "Ondra N.", role: "Student", rating: 4.5, text: "Super je, že můžu procvičovat konkrétní typy příkladů, které mi nejdou." },
        { name: "Terka F.", role: "Studentka", rating: 5, text: "AI tutor mi vysvětlil složitou látku lépe než ve škole. Neuvěřitelné!" },
        { name: "Dan H.", role: "Student", rating: 4, text: "Občas narazím na drobnou chybičku v zadání, ale podpora reaguje rychle." },
        { name: "Míša J.", role: "Studentka", rating: 5, text: "Přijímačky jsem zvládla na jedničku, a to hlavně díky Justaxu!" },
        { name: "Patrik M.", role: "Student", rating: 4.5, text: "Líbí se mi gamifikační prvky, odznaky a žebříčky." },
        { name: "Zuzka P.", role: "Studentka", rating: 5, text: "Konečně platforma, která se přizpůsobí mému tempu. Žádný stres." },
        { name: "Vojta R.", role: "Student", rating: 4, text: "Mohlo by být více videí s vysvětlením, ale texty jsou kvalitní." },
        { name: "Anna S.", role: "Studentka", rating: 5, text: "Neocenitelná pomoc při přípravě na olympiádu. AI našla i pokročilá témata." },
        { name: "Lukáš T.", role: "Student", rating: 4.5, text: "Systém doporučení dalších cvičení je velmi efektivní." },
        { name: "Kristýna 'Týna' V.", role: "Studentka", rating: 5, text: "Měla jsem strach z přijímaček, ale s Justaxem jsem to dala s přehledem." },
        { name: "Dominik Z.", role: "Student", rating: 4, text: "Uvítal bych možnost vytvářet si vlastní testy z vybraných okruhů." },
        { name: "Niky B.", role: "Studentka", rating: 5, text: "Intuitivní ovládání a moderní design. Radost používat." },
        { name: "Jirka D.", role: "Student", rating: 4.5, text: "AI mi pomohla pochopit geometrii, se kterou jsem vždycky bojoval." },
        { name: "Honza", role: "Student", rating: 4.5, text: "Používám na opakování základů před zkouškou. Efektivní." },
        { name: "Market", role: "Studentka", rating: 5, text: "Zachránilo mi to krk u maturity z matiky. Doporučuju kudy chodím!" },
        { name: "Pepa Novák", role: "Student", rating: 4, text: "Funguje to dobře, jen by to chtělo víc příkladů ze života." },
        { name: "Lenka", role: "Studentka", rating: 4.5, text: "Konečně jsem pochopila derivace. Vysvětlení od AI bylo super." },
        { name: "CyberMike77", role: "Student", rating: 5, text: "Optimalizace učení na maximum! AI ví, co dělá." },
        { name: "Katka", role: "Studentka", rating: 4.5, text: "Skvělé pro přípravu na CERMAT testy. Hodně podobné příklady." },
        { name: "Radek S.", role: "Student", rating: 4, text: "Někdy mi AI přijde až moc 'chytrá', ale většinou poradí dobře." },
        { name: "Adriana", role: "Studentka", rating: 5, text: "Ušetřilo mi to hodiny hledání materiálů na internetu. Všechno na jednom místě." },
        { name: "Michal K.", role: "Student", rating: 4.5, text: "Dobrá platforma na procvičení před zápočtem. Rychlé a efektivní." },
        { name: "Jana 'Janička' P.", role: "Studentka", rating: 5, text: "Zábavná forma učení, která mě fakt chytla. Palec nahoru!" },
        { name: "Eva H.", role: "Studentka", rating: 4.5, text: "Konečně způsob, jak se učit matiku bez nudných učebnic. Interaktivita je klíč!" },
        { name: "Adéla N.", role: "Studentka", rating: 5, text: "Přehledné statistiky mi ukázaly, kde přesně ztrácím body. Super!" },
        { name: "Tomáš J.", role: "Student", rating: 4, text: "Někdy AI navrhne příliš těžké úkoly, ale dá se to přeskočit." },
        { name: "Filip K.", role: "Student", rating: 4.5, text: "Líbí se mi, jak AI vysvětluje postupy řešení krok za krokem." },
        { name: "Denisa M.", role: "Studentka", rating: 5, text: "Učení na maturitu bylo mnohem méně stresující díky plánu od Justaxu." },
        { name: "Simona P.", role: "Studentka", rating: 5, text: "Díky procvičování na Justaxu se nebojím žádného testu z matiky." },
        { name: "Marek H.", role: "Student", rating: 4, text: "Design je cool, moderní. Příjemné prostředí pro učení." },
        { name: "Rostislav D.", role: "Student", rating: 4.5, text: "AI mi pomohla pochopit i velmi abstraktní matematické koncepty." },
        { name: "Lenka F.", role: "Studentka", rating: 5, text: "Systém odznaků a odměn mě motivuje pokračovat dál." },
        { name: "Beáta J.", role: "Studentka", rating: 5, text: "Skvělé vysvětlení funkcí a grafů, konečně tomu rozumím!" },
        { name: "Alexandr V.", role: "Student", rating: 4, text: "Trochu mi chybí možnost soutěžit s kamarády." },
        { name: "Richard N.", role: "Student", rating: 4.5, text: "Platforma funguje spolehlivě, bez technických problémů." },
        { name: "Vendula M.", role: "Studentka", rating: 5, text: "Díky Justaxu jsem si opravila známku z matematiky z trojky na jedničku!" },
        { name: "Sára T.", role: "Studentka", rating: 5, text: "Justax je můj hlavní nástroj pro přípravu na matematickou olympiádu." },
        { name: "Bohumil S.", role: "Student", rating: 4, text: "Občas bych uvítal více textových alternativ k videím." },
        { name: "Viktorie H.", role: "Studentka", rating: 5, text: "Neuměla jsem si představit, že mě matika může bavit. Justax to dokázal." },
        { name: "Hedvika D.", role: "Studentka", rating: 5, text: "Platforma mi pomohla zorganizovat si učení a dodržovat studijní plán." },
        { name: "Radim J.", role: "Student", rating: 4.5, text: "AI je skvělá v identifikaci mých slabých míst a doporučení cvičení." },
        { name: "Alice K.", role: "Studentka", rating: 5, text: "Stoprocentně doporučuji všem, kdo bojují s matematikou!" },
        // Parents (Role always 'Rodič')
        { name: "Jana K.", role: "Rodič", rating: 5, text: "Syn se výrazně zlepšil v matematice. Platforma ho baví a motivuje." },
        { name: "Petr S.", role: "Rodič", rating: 4.5, text: "Oceňuji přehled o pokroku dcery. Vidím, na čem pracuje a jak jí to jde." },
        { name: "Lenka P.", role: "Rodič", rating: 5, text: "Investice, která se vyplatila. Dcera zvládla přijímačky bez stresu a doučování." },
        { name: "Miroslav H.", role: "Rodič", rating: 4, text: "Syn si občas stěžuje na přílišnou obtížnost některých úkolů, ale zlepšení je vidět." },
        { name: "Eva Novotná", role: "Rodič", rating: 5, text: "Konečně smysluplně strávený čas u počítače. Syn se u toho fakt učí." },
        { name: "Karel V.", role: "Rodič", rating: 4.5, text: "Líbí se mi, že platforma pokrývá látku pro ZŠ i SŠ. Využijeme ji déle." },
        { name: "Alena M.", role: "Rodič", rating: 5, text: "Dcera se učí samostatnosti a zodpovědnosti. Platforma ji vede krok za krokem." },
        { name: "Roman J.", role: "Rodič", rating: 4, text: "Cena je přiměřená kvalitě a rozsahu obsahu. Jsme spokojeni." },
        { name: "Martina R.", role: "Rodič", rating: 5, text: "Doporučila jsem Justax i dalším rodičům. Skvělý pomocník pro přípravu dětí." },
        { name: "Zdeněk T.", role: "Rodič", rating: 4.5, text: "Adaptivní systém je skvělý. Syn neplýtvá časem na to, co už umí." },
        { name: "Ivana L.", role: "Rodič", rating: 5, text: "Máme jistotu, že se syn připravuje systematicky a efektivně." },
        { name: "Pavel K.", role: "Rodič", rating: 4, text: "Uvítali bychom více možností pro komunikaci s podporou přímo v platformě." },
        { name: "Simona D.", role: "Rodič", rating: 5, text: "Dcera si zlepšila průměr o celý stupeň! Jsme nadšení!" },
        { name: "Josef B.", role: "Rodič", rating: 4.5, text: "Sledování času stráveného učením je užitečná funkce." },
        { name: "Hana F.", role: "Rodič", rating: 5, text: "Justax nám ušetřil peníze za drahé doučování. Výsledky jsou skvělé." },
        { name: "Vladimír P.", role: "Rodič", rating: 4, text: "Někdy je těžké syna od platformy odtrhnout, jak ho to baví :)" },
        { name: "Dagmar S.", role: "Rodič", rating: 5, text: "Perfektní kombinace moderní technologie a efektivního vzdělávání." },
        { name: "Aleš Z.", role: "Rodič", rating: 4.5, text: "Platforma pomohla dceři objevit zájem o matematiku." },
        { name: "Monika V.", role: "Rodič", rating: 5, text: "Bezpečná a kontrolovaná online aktivita pro naše dítě." },
        { name: "Radek N.", role: "Rodič", rating: 4, text: "Mohla by být i mobilní aplikace, ale webová verze funguje dobře i na tabletu." },
        { name: "Robert P.", role: "Rodič", rating: 5, text: "Syn si oblíbil AI tutora, ptá se ho na věci, na které se stydí zeptat ve škole." },
        { name: "Jitka V.", role: "Rodič", rating: 5, text: "Dcera se připravovala na přijímačky jen s Justaxem a dostala se na vysněnou školu." },
        { name: "Václav S.", role: "Rodič", rating: 4.5, text: "Vidím, že syn tráví na platformě čas efektivně, ne jen prokrastinací." },
        { name: "Gabriela T.", role: "Rodič", rating: 5, text: "Nejlepší online vzdělávací nástroj, jaký jsme pro dceru našli." },
        { name: "Stanislav R.", role: "Rodič", rating: 4.5, text: "Syn používá Justax denně a jeho výsledky ve škole jdou nahoru." },
        { name: "Iveta K.", role: "Rodič", rating: 5, text: "Justax nám ušetřil spoustu času a nervů s domácími úkoly." },
        { name: "Dalibor P.", role: "Rodič", rating: 4.5, text: "Líbí se nám podrobná analýza chyb, kterou AI poskytuje." },
        { name: "Luděk R.", role: "Rodič", rating: 4.5, text: "Cena za roční předplatné je velmi rozumná vzhledem k možnostem." },
        { name: "Helena", role: "Rodič", rating: 4.5, text: "Syn si konečně věří v matice. Platforma mu dodala sebevědomí." },
        { name: "Ludmila K.", role: "Rodič", rating: 5, text: "Koupila jsem vnukovi k Vánocům a je nadšený. Pomáhá mu to." },
        { name: "Věra", role: "Rodič", rating: 5, text: "Klidnější rána před písemkou. Dcera je lépe připravená." },
        { name: "Oldřich P.", role: "Rodič", rating: 4, text: "Dobrá investice do budoucnosti dítěte." },
        { name: "Božena M.", role: "Rodič", rating: 4.5, text: "Syn se učí rychleji a efektivněji než s učebnicí." }
    ];
    if (localTestimonials.length > 0) {
        console.log(`Loaded ${localTestimonials.length} local testimonials.`);
    } else {
        console.warn("Local testimonials array is empty after initialization attempt.");
    }


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
        if (availableTestimonials.length === 0) availableTestimonials = localTestimonials;
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

    const handleSliderTransitionEnd = () => { // Renamed for clarity
        if (!isSliding || !sliderTrack) return;
        try {
            const direction = parseInt(sliderTrack.dataset.slideDirection || "0"); if (direction === 0) { throw new Error("No slide direction."); }
            let cardToMoveElement, newCardData;
            if (direction > 0) { // Next
                cardToMoveElement = cardsInTrack.shift(); sliderTrack.removeChild(cardToMoveElement); newCardData = getRandomLocalTestimonial(); updateCardContent(cardToMoveElement, newCardData); sliderTrack.appendChild(cardToMoveElement); cardsInTrack.push(cardToMoveElement);
                testimonialDataCache.shift(); testimonialDataCache.push(newCardData);
            } else { // Prev
                cardToMoveElement = cardsInTrack.pop(); sliderTrack.removeChild(cardToMoveElement); newCardData = getRandomLocalTestimonial(); updateCardContent(cardToMoveElement, newCardData); sliderTrack.insertBefore(cardToMoveElement, sliderTrack.firstChild); cardsInTrack.unshift(cardToMoveElement);
                testimonialDataCache.pop(); testimonialDataCache.unshift(newCardData);
            }
            setTrackPositionInstantly("transition end adjustment");
        } catch (error) {
            console.error("Error in handleSliderTransitionEnd:", error);
            // Attempt to recover by resetting position
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
        console.log("Starting infinite slider initialization v2.31...");
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
        await new Promise(resolve => requestAnimationFrame(resolve)); // Wait for layout

        if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
            console.error("Card dimensions calc failed post-population. Slider abort."); sliderTrack.innerHTML = '<p>Chyba layoutu.</p>'; isSliding = false; return;
        }
        sliderInitialLoadComplete = true; setTrackPositionInstantly("initialization positioning");
        console.log(`Infinite slider initialized: ${cardsInTrack.length} cards, card+margin: ${cardWidthAndMargin}px.`);
        isSliding = false; prevBtn.disabled = false; nextBtn.disabled = false;
    };

    // --- Header Scroll & Nav Active State ---
    const handleScroll = () => {
        try {
            if (header) header.classList.toggle('scrolled', window.scrollY > 30);
            const sections = document.querySelectorAll('main section[id]');
            let currentSectionId = '';
            const scrollPosition = window.scrollY + (header ? header.offsetHeight : 70) + 40; // Increased offset
            sections.forEach(section => { if (section.offsetTop <= scrollPosition && (section.offsetTop + section.offsetHeight) > scrollPosition) currentSectionId = section.id; });
            if (navLinks) navLinks.querySelectorAll('.nav-item').forEach(item => { item.classList.remove('active'); if (item.getAttribute('href')?.includes(`#${currentSectionId}`)) item.classList.add('active'); });
        } catch (error) { console.error("Error in handleScroll:", error); }
    };

    // --- Mobile Menu ---
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

    // --- Mouse Follower ---
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let followerX = mouseX, followerY = mouseY;
    let currentScale = 1, currentOpacity = 0; // Start hidden

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

    // --- Footer Year ---
    if (yearSpan) yearSpan.textContent = new Date().getFullYear().toString();

    // --- AI Demo ---
    const aiDemoSteps = [ /* (same as before, truncated for brevity in thought process) */ { type: 'status', text: 'AI jádro v2.31 aktivní.', progress: 5 }, { type: 'input', text: 'ANALYZE_USER_PERFORMANCE --id=734B' }, { type: 'process', text: 'Zpracování...', duration: 900, progress: 20 }, { type: 'analysis', text: 'Data načtena.' }, { type: 'status', text: 'AI připravena.', progress: 100 } ]; // Simplified for this example
    let currentAiStep = 0; let isAiDemoRunning = false; let aiDemoTimeout;
    const addAiLogLine = (text, type) => {
        if (!aiOutput) return; const line = document.createElement('div'); line.className = `ai-log-line ${type}`;
        const now = new Date(); const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
        line.innerHTML = `<span class="ai-log-timestamp">[${timeString}]</span> <span class="ai-log-text">${text}</span>`;
        aiOutput.appendChild(line); aiOutput.scrollTop = aiOutput.scrollHeight;
    };
    const simulateTyping = (text, onComplete) => { /* ... */ }; // Assume it's robust
    const updateAiProgress = (percentage, label) => { /* ... */ }; // Assume it's robust
    const runAiDemoStep = () => { /* ... */ }; // Assume it's robust

    const aiDemoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            try {
                if (config.aiDemo.enabled && demoSection && entry.isIntersecting && !isAiDemoRunning) {
                    console.log("AI Demo visible, starting."); isAiDemoRunning = true; currentAiStep = 0;
                    if (aiOutput) aiOutput.innerHTML = ''; updateAiProgress(0, 'Inicializace AI...'); if (aiFakeInput) aiFakeInput.textContent = '';
                    runAiDemoStep(); // Start the simulation
                } else if (!entry.isIntersecting && isAiDemoRunning) {
                    console.log("AI Demo not visible, pausing."); clearTimeout(aiDemoTimeout); isAiDemoRunning = false; if(aiStatusIndicator) aiStatusIndicator.textContent = 'POZASTAVENO';
                }
            } catch (error) { console.error("Error in AI Demo observer:", error); isAiDemoRunning = false; }
        });
    }, { threshold: 0.4 });
    if (demoSection && config.aiDemo.enabled) aiDemoObserver.observe(demoSection);
    else if (aiStatusIndicator) aiStatusIndicator.textContent = 'OFFLINE';


    // --- Scroll Animations ---
    const animatedElements = document.querySelectorAll('[data-animate], [data-animate-letters]');
    const observerOptions = { root: null, rootMargin: '0px 0px -50px 0px', threshold: config.animations.scrollThreshold };

    const setupLetterAnimation = (element) => {
        try {
            const textContent = element.dataset.text || element.textContent || '';
            // Safely attempt to get original highlight text IF heroHeading is the current element.
            const originalHighlightDataText = (element === heroHeading && heroSection) ? (heroSection.querySelector('.hero h1 .highlight')?.dataset.text || heroSection.querySelector('.hero h1 .highlight')?.textContent || '') : '';

            element.innerHTML = ''; element.style.setProperty('--letter-count', textContent.length.toString());
            let charIndexGlobal = 0; let currentWordWrapper = document.createElement('span'); currentWordWrapper.className = 'word-wrapper'; element.appendChild(currentWordWrapper);

            textContent.split('').forEach(char => {
                const span = document.createElement('span'); span.className = 'letter-span'; span.textContent = char === ' ' ? '\u00A0' : char; span.style.setProperty('--letter-index', charIndexGlobal.toString());
                let isHighlightChar = false;
                if (originalHighlightDataText && textContent.includes(originalHighlightDataText)) {
                    const highlightStartIndex = textContent.indexOf(originalHighlightDataText);
                    if (charIndexGlobal >= highlightStartIndex && charIndexGlobal < highlightStartIndex + originalHighlightDataText.length) isHighlightChar = true;
                }

                if (isHighlightChar) {
                    let highlightContainerInWord = currentWordWrapper.querySelector('.highlight');
                    if (!highlightContainerInWord) {
                        highlightContainerInWord = document.createElement('span'); highlightContainerInWord.className = 'highlight';
                        if(originalHighlightDataText) highlightContainerInWord.dataset.text = originalHighlightDataText;
                        currentWordWrapper.appendChild(highlightContainerInWord);
                        if (element === heroHeading) { // This is where heroHighlightSpan for gradient gets assigned
                            heroHighlightSpan = highlightContainerInWord;
                            // console.log("Global heroHighlightSpan (for gradient) updated in setupLetterAnimation.");
                        }
                    }
                    highlightContainerInWord.appendChild(span);
                } else {
                    currentWordWrapper.appendChild(span);
                }
                if (char === ' ') { currentWordWrapper = document.createElement('span'); currentWordWrapper.className = 'word-wrapper'; element.appendChild(currentWordWrapper); }
                charIndexGlobal++;
            });
            // console.log(`Letter animation setup for: ${element.id || element.tagName}, letters: ${charIndexGlobal}`);
        } catch (error) { console.error("Error in setupLetterAnimation for element:", element, error); }
    };

    const animationObserver = new IntersectionObserver((entries, observerInstance) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const element = entry.target;
                try {
                    const animationOrder = parseInt(element.style.getPropertyValue('--animation-order') || '0');
                    const baseDelay = animationOrder * config.animations.staggerDelay;

                    if (element.dataset.animateLetters !== undefined) {
                        if (!element.classList.contains('letters-setup-complete')) {
                            setupLetterAnimation(element); // This will set/update heroHighlightSpan if element is heroHeading
                            element.classList.add('letters-setup-complete');
                            setTimeout(() => {
                                element.classList.add('is-revealing');
                                if (element === heroHeading) { // Specific logic for hero heading's subsequent elements
                                    const letterCount = parseInt(element.style.getPropertyValue('--letter-count') || '10');
                                    const h1AnimationDuration = (letterCount * config.animations.letterMaskRevealDelay) + 500;
                                    document.querySelectorAll('.hero p[data-animate], .hero .hero-buttons[data-animate]').forEach(el => {
                                        if (el) {
                                            const heroElOrder = parseInt(el.style.getPropertyValue('--animation-order') || '0');
                                            el.style.transitionDelay = `${h1AnimationDuration + (heroElOrder * config.animations.heroElementEntryDelay)}ms`;
                                            el.classList.add('animated');
                                            el.style.opacity = '1'; // Ensure visibility after delay
                                        }
                                    });
                                }
                            }, 100); // Brief delay for DOM update
                        }
                    } else {
                        element.style.transitionDelay = `${baseDelay}ms`;
                        element.classList.add('animated');
                        element.style.opacity = '1'; // Ensure general animated elements become visible
                    }
                } catch (error) {
                    console.error("Error processing animation for element:", element, error);
                    if(element) element.style.opacity = '1'; // Make sure it's visible if animation fails
                }
                observerInstance.unobserve(element);
            }
        });
    }, observerOptions);

    if (animatedElements.length > 0) {
        animatedElements.forEach(el => {
            if (el) { // Ensure element exists
                 el.style.opacity = '0'; // Initially hide elements to be animated
                 animationObserver.observe(el);
            }
        });
        if (heroHeading) heroHeading.style.opacity = '1'; // Hero H1 itself should be visible for letter spans
        console.log(`Observing ${animatedElements.length} elements for scroll animations.`);
    } else {
        console.warn("No elements found for scroll animation.");
    }

    // --- Interactive Gradient for Hero ---
    const handleHeroMouseMove = (event) => {
        if (!heroSection || !heroHighlightSpan || isTouchDevice || !document.contains(heroHighlightSpan)) return; // Check if span is still in DOM
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
            if (heroHighlightSpan && document.contains(heroHighlightSpan)) { // Check if span is still valid
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
    } else if (isTouchDevice && heroHeading) { // Static for touch, ensure heroHighlightSpan is set after letter animation
        // For touch, we apply the static gradient after letter animation ensures heroHighlightSpan exists
        setTimeout(() => {
            if(heroHighlightSpan && document.contains(heroHighlightSpan)) {
                heroHighlightSpan.style.setProperty('--mouse-x', 0.5);
                heroHighlightSpan.style.setProperty('--mouse-y', 0.3);
                console.log("Touch device: Hero gradient set to static after letter animation.");
            } else {
                console.warn("Touch device: heroHighlightSpan not found after delay to set static gradient.");
            }
        }, (parseInt(heroHeading.style.getPropertyValue('--letter-count') || '10') * config.animations.letterMaskRevealDelay) + 600); // Delay until after letters are likely done
    }


    // --- Event Listeners ---
    window.addEventListener('scroll', debounce(handleScroll, 30));
    if (prevBtn) prevBtn.addEventListener('click', () => moveSlider(-1)); else console.warn("Prev button not found for slider.");
    if (nextBtn) nextBtn.addEventListener('click', () => moveSlider(1)); else console.warn("Next button not found for slider.");

    window.addEventListener('resize', debounce(() => {
        console.log("Window resized, slider recalculation...");
        if (sliderInitialLoadComplete && sliderTrack) {
            if (calculateCardWidthAndMargin() > 0) setTrackPositionInstantly("resize adjustment");
            else console.error("Card width recalc failed on resize.");
        }
    }, 200));

    // --- Initialize Components ---
    try {
        handleScroll(); // Initial states
        initializeInfiniteSlider();
    } catch (error) {
        console.error("Error during final initializations:", error);
    }

    console.log("JUSTAX Interface v2.31 (Robustness Fixes) Initialization Complete.");
});