/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, infinite testimonial slider,
 * Hero text mask reveal, interactive gradient, and enhanced visual effects.
 * Version: v2.30 (Enhanced Animations & Interactivity)
 * Author: Gemini Modification
 * Date: 2025-05-25 // Added more dynamic animations and refined interactions
 *
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.30 (Enhanced Animations)...");

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

    // Hero Elements for Interactive Gradient & Animation
    const heroSection = document.querySelector('.hero');
    let heroHighlightSpan = document.querySelector('.hero h1 .highlight'); // Will be updated
    let heroHeading = document.getElementById('hero-heading'); // For letter animation
    let rafId = null; // requestAnimationFrame ID for gradient

    // --- Configuration ---
    const config = {
        mouseFollower: {
            enabled: true,
            followSpeed: 0.12, // Slightly faster
            clickScale: 0.7,   // More pronounced click
            hoverScale: 1.5,   // Adjusted hover scale
            textHoverScale: 1.3 // Scale for hovering over text elements
        },
        animations: {
            scrollThreshold: 0.1, // Trigger animations a bit sooner
            staggerDelay: 100,    // Faster stagger
            letterMaskRevealDelay: 50, // Adjusted letter reveal delay
            heroElementEntryDelay: 150 // Base delay for hero p and buttons after H1
        },
        aiDemo: {
            enabled: true,
            typingSpeed: 35,      // Faster typing
            stepBaseDelay: 180,   // Faster base delay
            stepRandomDelay: 400  // Adjusted random delay
        },
        testimonials: {
            placeholderAvatarBaseUrl: 'https://placehold.co/100x100/',
            visibleCardsDesktop: 3,
            bufferCards: 2, // Keep 2 buffer cards on each side for smooth infinite scroll
            slideDuration: 550 // CSS transition duration from var(--transition-smooth-slider)
        }
    };

    // --- Testimonial Slider State ---
    let localTestimonials = [];
    let testimonialDataCache = []; // Holds the data for cards currently in the DOM or about to be shown
    let cardsInTrack = []; // Holds the actual DOM elements of the cards
    let stableVisibleStartIndex = config.testimonials.bufferCards; // Index of the first "truly" visible card in the ideal state
    let totalCardsInDOM = 0;
    let cardWidthAndMargin = 0;
    let isSliding = false;
    let initialLoadComplete = false;
    // No resizeTimeout or transitionEndCounter needed if logic is robust

    // --- REVISED Hardcoded Testimonial Data (same as provided before) ---
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
    console.log(`Loaded ${localTestimonials.length} revised local testimonials.`);

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
        const colors = [
            { bg: 'a05cff', text: 'FFFFFF' }, { bg: '00e0ff', text: '03020c' },
            { bg: 'ff33a8', text: 'FFFFFF' }, { bg: 'f0e14a', text: '03020c' },
            { bg: '00ffaa', text: '03020c' }, { bg: 'ff9a00', text: 'FFFFFF' },
            { bg: '7c4dff', text: 'FFFFFF' }, { bg: '00bcd4', text: '03020c' } // Added more pairs
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    };

    const generateStarsHTML = (rating) => {
        let starsHTML = '';
        const clampedRating = Math.max(0, Math.min(5, rating || 0));
        const fullStars = Math.floor(clampedRating);
        const halfStar = clampedRating % 1 >= 0.45; // Threshold for half star
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
        for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fas fa-star" aria-hidden="true"></i>';
        if (halfStar) starsHTML += '<i class="fas fa-star-half-alt" aria-hidden="true"></i>';
        for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star" aria-hidden="true"></i>';
        return starsHTML;
    };

    const createPlaceholderCard = () => {
        const card = document.createElement('article');
        card.className = 'testimonial-card is-loading';
        card.innerHTML = '<div class="spinner"></div>';
        card.setAttribute('aria-hidden', 'true');
        return card;
    };

    const updateCardContent = (cardElement, testimonialData) => {
        if (!cardElement) { console.warn("updateCardContent: null cardElement received"); return; }
        const data = testimonialData && typeof testimonialData === 'object' ? testimonialData :
            { name: "Chyba Dat", text: "Neplatná data pro kartu.", rating: 0, role: "Systém" };

        cardElement.classList.remove('is-loading');
        cardElement.removeAttribute('aria-hidden');
        // Adding a class to trigger entrance animation for new content
        cardElement.classList.add('card-content-updated');

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

        const name = data.name || 'Uživatel';
        const role = data.role || 'Neznámý';
        const rating = data.rating;
        const text = data.text || 'Chybí text recenze.';

        if (ratingEl) { ratingEl.innerHTML = generateStarsHTML(rating); ratingEl.setAttribute('aria-label', `Hodnocení: ${rating?.toFixed(1) || 0} z 5 hvězdiček`); }
        if (textEl) textEl.textContent = text;
        if (nameEl) nameEl.textContent = name;
        if (roleEl) roleEl.textContent = role;
        if (avatarEl) {
            const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '??';
            const colors = getRandomColorPair();
            const avatarUrl = `${config.testimonials.placeholderAvatarBaseUrl}${colors.bg}/${colors.text}/png?text=${encodeURIComponent(initials)}&font=poppins&font-size=0.4`;
            avatarEl.style.backgroundImage = `url('${avatarUrl}')`;
            avatarEl.setAttribute('aria-label', `Avatar ${name}`);
        }
        // Remove animation class after a short delay so it can be re-triggered
        setTimeout(() => cardElement.classList.remove('card-content-updated'), 600);
    };


    const getRandomLocalTestimonial = () => {
        if (!localTestimonials || localTestimonials.length === 0) {
            console.error("getRandomLocalTestimonial: localTestimonials array is empty or undefined.");
            return { name: "Chyba", text: "Žádné dostupné recenze.", rating: 0, role: "Systém" };
        }
        // Get names of testimonials currently in the DOM cache to avoid immediate repetition
        const currentCacheNames = new Set(testimonialDataCache.map(item => item?.name).filter(Boolean));
        let availableTestimonials = localTestimonials.filter(item => !currentCacheNames.has(item.name));

        if (availableTestimonials.length === 0) {
            // If all unique testimonials are used, allow reuse but try to pick one not *just* shown.
            console.warn("No unique testimonials available outside the current cache. Reusing testimonials.");
            availableTestimonials = localTestimonials;
             if (availableTestimonials.length === 0) { // Should not happen if localTestimonials is not empty
                 return { name: "Chyba", text: "Žádné dostupné recenze.", rating: 0, role: "Systém" };
             }
        }
        const randomIndex = Math.floor(Math.random() * availableTestimonials.length);
        return availableTestimonials[randomIndex];
    };


    const calculateCardWidthAndMargin = () => {
        if (!sliderTrack || !sliderTrack.firstChild) {
            console.warn("calculateCardWidthAndMargin: Slider track or first card not found.");
            return 0;
        }
        const firstCard = sliderTrack.querySelector('.testimonial-card:not(.is-loading)') || sliderTrack.firstChild;
        if (!firstCard || typeof firstCard.offsetWidth === 'undefined') {
             console.warn("calculateCardWidthAndMargin: Invalid first card element.");
             return 0;
        }
        const style = window.getComputedStyle(firstCard);
        const width = firstCard.offsetWidth;
        const marginRight = parseFloat(style.marginRight) || 0;

        if (width <= 0) {
            console.warn(`calculateCardWidthAndMargin: Card element has zero or negative width (${width}px). This might be a CSS issue or the element is not yet rendered.`);
            return 0;
        }
        cardWidthAndMargin = width + marginRight;
        return cardWidthAndMargin;
    };


    const setTrackPositionInstantly = (logReason = "default operation") => {
        if (!initialLoadComplete || !sliderTrack) {
            console.warn(`setTrackPositionInstantly (${logReason}) blocked: initialLoadComplete=${initialLoadComplete}, sliderTrack exists=${!!sliderTrack}`);
            return;
        }
        if (cardWidthAndMargin <= 0) {
             console.warn(`setTrackPositionInstantly (${logReason}): cardWidthAndMargin is invalid (${cardWidthAndMargin}). Attempting recalculation.`);
             if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) { // Recalculate if needed
                 console.error(`setTrackPositionInstantly (${logReason}): Recalculation failed. Cannot set position accurately.`);
                 return;
             }
         }

        sliderTrack.style.transition = 'none'; // Disable transitions for instant jump
        const position = -stableVisibleStartIndex * cardWidthAndMargin;
        sliderTrack.style.transform = `translateX(${position}px)`;
        // Force reflow/repaint to ensure the 'none' transition takes effect before re-enabling
        void sliderTrack.offsetHeight;
        // Re-enable transitions after the jump
        sliderTrack.style.transition = `transform ${config.testimonials.slideDuration}ms cubic-bezier(0.65, 0, 0.35, 1)`;
    };

    // Enhanced handleTransitionEnd to be more robust
    const handleTransitionEnd = () => {
        if (!isSliding || !sliderTrack) return; // Only proceed if a slide was in progress

        const direction = parseInt(sliderTrack.dataset.slideDirection || "0");
        if (direction === 0) { // Should not happen if isSliding is true
            console.warn("handleTransitionEnd called but no slide direction was set.");
            isSliding = false;
            prevBtn.disabled = false;
            nextBtn.disabled = false;
            return;
        }

        let cardToMoveElement, newCardData;

        if (direction > 0) { // Sliding to next (left)
            cardToMoveElement = cardsInTrack.shift(); // Get the first card (now off-screen left)
            sliderTrack.removeChild(cardToMoveElement); // Remove it from DOM start
            newCardData = getRandomLocalTestimonial();
            updateCardContent(cardToMoveElement, newCardData);
            sliderTrack.appendChild(cardToMoveElement); // Add it to DOM end
            cardsInTrack.push(cardToMoveElement); // Add to JS array end

            testimonialDataCache.shift();
            testimonialDataCache.push(newCardData);
        } else { // Sliding to previous (right)
            cardToMoveElement = cardsInTrack.pop(); // Get the last card (now off-screen right)
            sliderTrack.removeChild(cardToMoveElement); // Remove it from DOM end
            newCardData = getRandomLocalTestimonial();
            updateCardContent(cardToMoveElement, newCardData);
            sliderTrack.insertBefore(cardToMoveElement, sliderTrack.firstChild); // Add it to DOM start
            cardsInTrack.unshift(cardToMoveElement); // Add to JS array start

            testimonialDataCache.pop();
            testimonialDataCache.unshift(newCardData);
        }

        setTrackPositionInstantly("transition end adjustment"); // Reset track for seamless loop

        sliderTrack.dataset.slideDirection = "0";
        isSliding = false;
        prevBtn.disabled = false;
        nextBtn.disabled = false;
    };


    const moveSlider = (direction) => {
        if (isSliding || !initialLoadComplete || !sliderTrack) {
            console.warn(`Slide attempt blocked: isSliding=${isSliding}, initialLoadComplete=${initialLoadComplete}, sliderTrack exists=${!!sliderTrack}`);
            return;
        }
         if (cardWidthAndMargin <= 0) { // Double check card dimensions
             console.warn("moveSlider: cardWidthAndMargin is invalid. Attempting recalculation before slide.");
             if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
                 console.error("moveSlider: Recalculation failed. Cannot slide.");
                 isSliding = false; // Release lock
                 return;
             }
             setTrackPositionInstantly("pre-slide dimension recalc"); // Ensure track is correctly positioned if dimensions changed
         }

        isSliding = true;
        prevBtn.disabled = true;
        nextBtn.disabled = true;

        sliderTrack.dataset.slideDirection = direction.toString(); // Store direction for transitionEnd

        // Calculate current translate X. We don't rely on parsing transform if possible.
        // The current position should effectively be -stableVisibleStartIndex * cardWidthAndMargin.
        // The new position will be one card further in the given direction.
        const newTranslateX = (-stableVisibleStartIndex - direction) * cardWidthAndMargin;

        // Remove listener before new transition, add it back for this specific transition
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd);
        sliderTrack.addEventListener('transitionend', handleTransitionEnd, { once: true }); // {once: true} is important

        sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
    };

    const initializeInfiniteSlider = async () => {
        console.log("Starting infinite slider initialization v2.30 (Enhanced)...");
        isSliding = true; // Lock during init
        initialLoadComplete = false;

        if (!sliderTrack || !prevBtn || !nextBtn) {
            console.error("Slider initialization failed: Essential DOM elements missing.");
            isSliding = false;
            return;
        }
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        sliderTrack.innerHTML = ''; // Clear any existing placeholders
        testimonialDataCache = [];
        cardsInTrack = [];
        cardWidthAndMargin = 0; // Reset
        stableVisibleStartIndex = config.testimonials.bufferCards;

        if (!localTestimonials || localTestimonials.length === 0) {
            console.error("Local testimonial data is empty! Cannot initialize slider.");
            sliderTrack.innerHTML = `<p style="color: var(--clr-accent-red); padding: 20px; text-align: center;">Chyba: Chybí data pro recenze.</p>`;
            isSliding = false;
            return;
        }

        const numVisible = config.testimonials.visibleCardsDesktop; // Assuming this is the number of cards you want visible
        const numBuffer = config.testimonials.bufferCards;
        totalCardsInDOM = numVisible + 2 * numBuffer;

        if (localTestimonials.length < totalCardsInDOM) {
            console.warn(`Warning: Not enough unique testimonials (${localTestimonials.length}) to fill the initial track (${totalCardsInDOM}) without immediate reuse. Some testimonials will be duplicated initially.`);
        }

        // Populate initial cards (placeholders first)
        for (let i = 0; i < totalCardsInDOM; i++) {
            const cardElement = createPlaceholderCard();
            sliderTrack.appendChild(cardElement);
            cardsInTrack.push(cardElement);
        }

        // Populate initial data cache, ensuring minimal immediate repeats if possible
        let usedIndices = new Set();
        for (let i = 0; i < totalCardsInDOM; i++) {
            let testimonial;
            let attempts = 0;
            do {
                testimonial = localTestimonials[Math.floor(Math.random() * localTestimonials.length)];
                attempts++;
            } while (testimonialDataCache.some(t => t.name === testimonial.name) && attempts < localTestimonials.length && localTestimonials.length > testimonialDataCache.length); // Try to avoid direct repeat if enough unique options
            testimonialDataCache.push(testimonial);
        }


        // Update placeholders with actual content
        cardsInTrack.forEach((card, index) => {
            updateCardContent(card, testimonialDataCache[index]);
        });

        // Wait for layout to be calculated
        await new Promise(resolve => requestAnimationFrame(resolve));

        if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
            console.error("Could not calculate card dimensions after initial population. Slider setup aborted.");
            sliderTrack.innerHTML = '<p style="color: var(--clr-accent-red); padding: 20px; text-align: center;">Chyba layoutu slideru.</p>';
            isSliding = false;
            return;
        }

        initialLoadComplete = true;
        setTrackPositionInstantly("initialization positioning"); // Set initial correct position

        console.log(`Infinite slider initialized: ${cardsInTrack.length} cards in DOM, card width+margin: ${cardWidthAndMargin}px.`);
        isSliding = false; // Release lock
        prevBtn.disabled = false;
        nextBtn.disabled = false;
    };


    // --- Header Scroll Effect ---
    const handleScroll = () => {
        if (header) {
            if (window.scrollY > 30) { // Reduced scroll threshold for quicker effect
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }
        // Active nav link highlighting
        const sections = document.querySelectorAll('main section[id]');
        let currentSectionId = '';
        const scrollPosition = window.scrollY + header.offsetHeight + 20; // Offset by header height + a bit

        sections.forEach(section => {
            if (section.offsetTop <= scrollPosition && (section.offsetTop + section.offsetHeight) > scrollPosition) {
                currentSectionId = section.getAttribute('id');
            }
        });

        const navItems = navLinks.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href')?.includes(`#${currentSectionId}`)) {
                item.classList.add('active');
            }
        });
    };

    // --- Mobile Menu Toggle ---
    const toggleMenu = () => {
        if (hamburger && navLinks && menuOverlay && body && header) {
            const isActive = hamburger.classList.toggle('active');
            navLinks.classList.toggle('active', isActive);
            menuOverlay.classList.toggle('active', isActive);
            body.classList.toggle('no-scroll', isActive);
            header.classList.toggle('menu-open', isActive); // Used for header styling when menu is open
            hamburger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        }
    };
    const closeMenu = () => { // Ensure this closes the menu fully
        if (hamburger && navLinks && menuOverlay && body && header) {
             if (hamburger.classList.contains('active')) { // Only if active
                 hamburger.classList.remove('active');
                 navLinks.classList.remove('active');
                 menuOverlay.classList.remove('active');
                 body.classList.remove('no-scroll');
                 header.classList.remove('menu-open');
                 hamburger.setAttribute('aria-expanded', 'false');
             }
        }
    };

    if (hamburger && navLinks && menuOverlay) {
        hamburger.addEventListener('click', toggleMenu);
        menuOverlay.addEventListener('click', closeMenu);
        navLinks.addEventListener('click', (e) => { // Close on nav item click
            if (e.target.matches('a.nav-item') || e.target.closest('a.mobile-auth-link')) {
                closeMenu();
            }
        });
    }


    // --- Enhanced Mouse Follower ---
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2; // Initial position center
    let followerX = mouseX, followerY = mouseY;
    let currentScale = 1;
    let currentOpacity = 0.7; // Initial opacity
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    const updateFollower = () => {
        if (!follower || !config.mouseFollower.enabled || isTouchDevice) return;

        const dx = mouseX - followerX;
        const dy = mouseY - followerY;
        followerX += dx * config.mouseFollower.followSpeed;
        followerY += dy * config.mouseFollower.followSpeed;

        follower.style.transform = `translate(${followerX - follower.offsetWidth / 2}px, ${followerY - follower.offsetHeight / 2}px) scale(${currentScale})`;
        follower.style.opacity = currentOpacity;
        requestAnimationFrame(updateFollower);
    };

    if (!isTouchDevice && follower && config.mouseFollower.enabled) {
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            if (follower.style.display === 'none') follower.style.display = ''; // Ensure visible
            currentOpacity = 0.7; // Default opacity when moving
        });
        document.addEventListener('mouseleave', () => { currentOpacity = 0; }); // Hide when mouse leaves window
        document.addEventListener('mouseenter', () => { currentOpacity = 0.7; }); // Show on mouse enter

        document.querySelectorAll('a, button, .btn, .slider-btn, .feature-card, .how-it-works-step, .yuki-card, input[type="text"], textarea')
            .forEach(el => {
                el.addEventListener('mouseenter', () => {
                    currentScale = el.matches('input[type="text"], textarea') ? config.mouseFollower.textHoverScale : config.mouseFollower.hoverScale;
                    follower.classList.add('is-hovering');
                });
                el.addEventListener('mouseleave', () => {
                    currentScale = 1;
                    follower.classList.remove('is-hovering');
                });
            });
        document.body.addEventListener('mousedown', () => { currentScale = config.mouseFollower.clickScale; follower.classList.add('is-clicking'); });
        document.body.addEventListener('mouseup', () => { currentScale = config.mouseFollower.hoverScale; follower.classList.remove('is-clicking'); });


        requestAnimationFrame(updateFollower);
    } else if (follower) {
        follower.style.display = 'none'; // Hide follower on touch devices or if disabled
    }


    // --- Footer Year ---
    if (yearSpan) { yearSpan.textContent = new Date().getFullYear(); }

    // --- Enhanced AI Demo Simulation ---
    const aiDemoSteps = [
        { type: 'status', text: 'AI jádro v2.30 aktivní. Připraven na analýzu...', progress: 5 },
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
    let currentAiStep = 0; let isAiDemoRunning = false; let aiDemoTimeout;

    const addAiLogLine = (text, type) => {
        if (!aiOutput) return;
        const line = document.createElement('div');
        line.className = `ai-log-line ${type}`;
        // Add a timestamp with milliseconds for more "techy" feel
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
        line.innerHTML = `<span class="ai-log-timestamp">[${timeString}]</span> <span class="ai-log-text">${text}</span>`;
        aiOutput.appendChild(line);
        aiOutput.scrollTop = aiOutput.scrollHeight; // Auto-scroll
    };

    const simulateTyping = (text, onComplete) => {
        if (!aiFakeInput) { onComplete?.(); return; }
        let index = 0;
        aiFakeInput.textContent = '';
        const interval = setInterval(() => {
            if (index < text.length) {
                aiFakeInput.textContent += text.charAt(index);
                index++;
            } else {
                clearInterval(interval);
                if (onComplete) setTimeout(onComplete, 150 + Math.random() * 100); // Slight random delay after typing
            }
        }, config.aiDemo.typingSpeed - 5 + Math.random() * 10); // Vary typing speed slightly
    };

    const updateAiProgress = (percentage, label) => {
        if (aiProgressBar) {
            aiProgressBar.style.width = `${percentage}%`;
            aiProgressBar.setAttribute('aria-valuenow', percentage);
        }
        if (aiProgressLabel && label) {
            aiProgressLabel.textContent = label;
        } else if (aiProgressLabel && percentage === 100) {
            aiProgressLabel.textContent = "Systém připraven";
        }
    };

    const runAiDemoStep = () => {
        if (currentAiStep >= aiDemoSteps.length || !aiOutput) {
            isAiDemoRunning = false;
            if(aiStatusIndicator) aiStatusIndicator.textContent = 'IDLE';
            updateAiProgress(100, "AI Idle / Čekání na vstup...");
            return;
        }
        const step = aiDemoSteps[currentAiStep];
        const baseDelay = step.delay || config.aiDemo.stepBaseDelay;
        const randomDelayPart = Math.random() * config.aiDemo.stepRandomDelay;
        const totalDelay = baseDelay + randomDelayPart;

        if (step.type === 'input') {
            aiProgressLabel.textContent = "Očekávám vstup...";
            simulateTyping(step.text, () => {
                addAiLogLine(`> ${step.text}`, step.type);
                if (step.progress) updateAiProgress(step.progress, step.text);
                currentAiStep++;
                aiDemoTimeout = setTimeout(runAiDemoStep, totalDelay / 2); // Shorter delay after input
            });
        } else {
            addAiLogLine(step.text, step.type);
            if (step.progress) updateAiProgress(step.progress, step.text);
            else if (step.type !== 'status') updateAiProgress( (currentAiStep / aiDemoSteps.length) * 100 , step.text);

            currentAiStep++;
            aiDemoTimeout = setTimeout(runAiDemoStep, totalDelay + (step.duration || 0));
        }
        if(aiStatusIndicator) aiStatusIndicator.textContent = step.type === 'process' ? 'ZPRACOVÁVÁM' : 'AKTIVNÍ';
    };

    const aiDemoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (config.aiDemo.enabled && entry.isIntersecting && !isAiDemoRunning) {
                console.log("AI Demo section visible, starting simulation.");
                isAiDemoRunning = true;
                currentAiStep = 0;
                if (aiOutput) aiOutput.innerHTML = ''; // Clear previous logs
                updateAiProgress(0, 'Inicializace AI jádra...');
                if (aiFakeInput) aiFakeInput.textContent = '';
                runAiDemoStep();
            } else if (!entry.isIntersecting && isAiDemoRunning) {
                console.log("AI Demo section not visible, pausing simulation.");
                clearTimeout(aiDemoTimeout);
                isAiDemoRunning = false;
                if(aiStatusIndicator) aiStatusIndicator.textContent = 'POZASTAVENO';
                // updateAiProgress might show last known progress or a paused state
            }
        });
    }, { threshold: 0.4 }); // Trigger when 40% of the demo is visible

    if (demoSection && config.aiDemo.enabled) {
        aiDemoObserver.observe(demoSection);
    } else {
        if (aiProgressLabel) aiProgressLabel.textContent = 'AI Demo je neaktivní';
        if (aiOutput) addAiLogLine('AI Demo je momentálně neaktivní.', 'status');
        if(aiStatusIndicator) aiStatusIndicator.textContent = 'OFFLINE';
    }

    // --- Enhanced Scroll Animations (Intersection Observer & Letter Animation) ---
    const animatedElements = document.querySelectorAll('[data-animate], [data-animate-letters]');
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -50px 0px', // Animate when element is 50px from bottom of viewport
        threshold: config.animations.scrollThreshold
    };

    // --- Enhanced Letter Animation Setup ---
    const setupLetterAnimation = (element) => {
        const textContent = element.dataset.text || element.textContent || ''; // Prefer data-text for highlight preservation
        const originalHighlightDataText = heroHighlightSpan ? (heroHighlightSpan.dataset.text || heroHighlightSpan.textContent) : '';
        let charIndex = 0; // To track overall character position for highlight matching

        element.innerHTML = ''; // Clear original content before adding spans
        element.style.setProperty('--letter-count', textContent.length); // For staggering delays

        let currentWordWrapper = document.createElement('span');
        currentWordWrapper.className = 'word-wrapper';
        element.appendChild(currentWordWrapper);

        textContent.split('').forEach((char, localIndex) => {
            const span = document.createElement('span');
            span.className = 'letter-span';
            span.textContent = char === ' ' ? '\u00A0' : char; // Non-breaking space for actual spaces
            span.style.setProperty('--letter-index', charIndex); // Use charIndex for consistent delay

            // Determine if this character is part of the highlight
            let isHighlightChar = false;
            if (originalHighlightDataText && textContent.includes(originalHighlightDataText)) {
                const highlightStartIndex = textContent.indexOf(originalHighlightDataText);
                const highlightEndIndex = highlightStartIndex + originalHighlightDataText.length;
                if (charIndex >= highlightStartIndex && charIndex < highlightEndIndex) {
                    isHighlightChar = true;
                }
            }

            if (isHighlightChar) {
                // If this is the first char of the highlight, or if heroHighlightSpan doesn't exist yet within the current word
                if (!currentWordWrapper.querySelector('.highlight')) {
                    const newHighlightSpan = document.createElement('span');
                    newHighlightSpan.className = 'highlight'; // Keep original class for styling
                    if(originalHighlightDataText) newHighlightSpan.dataset.text = originalHighlightDataText;
                    currentWordWrapper.appendChild(newHighlightSpan);
                    // Update the global heroHighlightSpan if this is the one in the hero section
                    if (element === heroHeading) {
                         heroHighlightSpan = newHighlightSpan;
                         console.log("Hero highlight span reference updated during letter setup.");
                    }
                }
                // Append the letter span to the highlight span
                currentWordWrapper.querySelector('.highlight').appendChild(span);
            } else {
                currentWordWrapper.appendChild(span);
            }

            if (char === ' ') {
                currentWordWrapper = document.createElement('span');
                currentWordWrapper.className = 'word-wrapper';
                element.appendChild(currentWordWrapper);
            }
            charIndex++;
        });
        console.log(`Letter animation setup for: ${element.id || element.tagName}, total letters: ${charIndex}`);
    };


    const animationObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const animationOrder = parseInt(element.style.getPropertyValue('--animation-order') || '0');
                const baseDelay = animationOrder * config.animations.staggerDelay;

                if (element.dataset.animateLetters !== undefined) {
                    if (!element.classList.contains('letters-setup-complete')) {
                        setupLetterAnimation(element);
                        element.classList.add('letters-setup-complete');
                        // Trigger reveal after a short delay to ensure setup is rendered
                        setTimeout(() => {
                            element.classList.add('is-revealing');
                            // Animate subsequent hero elements (p, buttons) after H1 letters finish
                            if (element === heroHeading) {
                                const letterCount = parseInt(element.style.getPropertyValue('--letter-count') || 10);
                                const h1AnimationDuration = (letterCount * config.animations.letterMaskRevealDelay) + 500; // Estimate H1 animation time
                                document.querySelectorAll('.hero p[data-animate], .hero .hero-buttons[data-animate]').forEach(el => {
                                    const heroElOrder = parseInt(el.style.getPropertyValue('--animation-order') || '0');
                                    el.style.transitionDelay = `${h1AnimationDuration + (heroElOrder * config.animations.heroElementEntryDelay)}ms`;
                                    el.classList.add('animated');
                                });
                            }
                        }, 100); // Small delay for setup
                    }
                } else {
                    element.style.transitionDelay = `${baseDelay}ms`;
                    element.classList.add('animated');
                }
                observer.unobserve(element); // Animate only once
            }
        });
    }, observerOptions);

    if (animatedElements.length > 0) {
        animatedElements.forEach(el => {
            // Initial hide for elements to be animated, to prevent flash of unstyled/unanimated content
            el.style.opacity = '0';
            animationObserver.observe(el);
        });
        // For hero H1, opacity is handled by letter spans, so ensure parent is visible for setup
        if (heroHeading) heroHeading.style.opacity = '1';
        console.log(`Observing ${animatedElements.length} elements for scroll-triggered animations.`);
    }


    // --- Enhanced Interactive Gradient for Hero ---
    const handleHeroMouseMove = (event) => {
        if (!heroSection || !heroHighlightSpan || isTouchDevice) {
            return;
        }
        if (rafId) cancelAnimationFrame(rafId); // Optimize rendering

        rafId = requestAnimationFrame(() => {
            const rect = heroSection.getBoundingClientRect();
            // Calculate mouse position relative to the hero section, clamped between 0 and 1
            const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

            // Update CSS variables used by the gradient
            // Using a slight easing for smoother visual effect on the gradient itself
            const currentX = parseFloat(heroHighlightSpan.style.getPropertyValue('--mouse-x') || "0.5");
            const currentY = parseFloat(heroHighlightSpan.style.getPropertyValue('--mouse-y') || "0.5");
            const targetX = currentX + (x - currentX) * 0.2; // Easing factor
            const targetY = currentY + (y - currentY) * 0.2;

            heroHighlightSpan.style.setProperty('--mouse-x', targetX.toFixed(3));
            heroHighlightSpan.style.setProperty('--mouse-y', targetY.toFixed(3));
        });
    };

    if (heroSection && !isTouchDevice) {
        console.log("Initializing interactive hero gradient.");
        heroSection.addEventListener('mousemove', handleHeroMouseMove);
        heroSection.addEventListener('mouseleave', () => { // Reset gradient to center on mouse leave
            if (rafId) cancelAnimationFrame(rafId);
            if (heroHighlightSpan) { // Check if span exists
                 // Smoothly return to center
                 let currentX = parseFloat(heroHighlightSpan.style.getPropertyValue('--mouse-x') || "0.5");
                 let currentY = parseFloat(heroHighlightSpan.style.getPropertyValue('--mouse-y') || "0.5");
                 const resetInterval = setInterval(() => {
                     currentX += (0.5 - currentX) * 0.1;
                     currentY += (0.5 - currentY) * 0.1;
                     heroHighlightSpan.style.setProperty('--mouse-x', currentX.toFixed(3));
                     heroHighlightSpan.style.setProperty('--mouse-y', currentY.toFixed(3));
                     if (Math.abs(currentX - 0.5) < 0.01 && Math.abs(currentY - 0.5) < 0.01) {
                         heroHighlightSpan.style.setProperty('--mouse-x', "0.5");
                         heroHighlightSpan.style.setProperty('--mouse-y', "0.5");
                         clearInterval(resetInterval);
                     }
                 }, 16);
            }
        });
    } else if (heroHighlightSpan && isTouchDevice) { // Default static position for touch devices
        heroHighlightSpan.style.setProperty('--mouse-x', 0.5);
        heroHighlightSpan.style.setProperty('--mouse-y', 0.3); // Slightly offset for static visual appeal
        console.log("Touch device detected. Interactive hero gradient set to static.");
    }


    // --- Event Listeners ---
    window.addEventListener('scroll', debounce(handleScroll, 30)); // More responsive scroll handling

    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => moveSlider(-1));
        nextBtn.addEventListener('click', () => moveSlider(1));
    } else {
        console.warn("Testimonial slider buttons not found. Slider navigation will not work.");
    }

    window.addEventListener('resize', debounce(() => {
        console.log("Window resized, recalculating slider dimensions...");
        if (initialLoadComplete && sliderTrack) { // Ensure slider is initialized
            if (calculateCardWidthAndMargin() > 0) {
                 setTrackPositionInstantly("resize adjustment");
            } else {
                 console.error("Recalculation of card width failed on resize. Slider may not display correctly.");
            }
        }
    }, 200));


    // --- Initialize Components ---
    handleScroll(); // Initial call to set header state and active nav link
    initializeInfiniteSlider(); // Setup the testimonial slider

    // Final Log
    console.log("JUSTAX Interface v2.30 (Enhanced Animations) Initialization Complete.");

}); // End DOMContentLoaded