/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, infinite testimonial slider,
 * NEW: Hero text mask reveal and interactive gradient.
 * Version: v2.20 (Hero Animation Update)
 * Author: Gemini Modification
 * Date: 2025-05-03 // Added Mask Reveal + Interactive Gradient
 *
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.20 (Hero Animation Update)...");

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

    // *** NEW: Hero Elements for Interactive Gradient ***
    const heroSection = document.querySelector('.hero');
    // Ensure we select the potentially re-created span later
    let heroHighlightSpan = document.querySelector('.hero h1 .highlight');
    let rafId = null; // requestAnimationFrame ID

    // --- Configuration ---
    const config = {
        mouseFollower: { enabled: true, followSpeed: 0.1, clickScale: 0.8, hoverScale: 1.6 },
        animations: {
            scrollThreshold: 0.15,
            staggerDelay: 120, // General stagger delay for non-letter elements
            letterMaskRevealDelay: 45 // Delay between each letter reveal (ms)
        },
        aiDemo: { enabled: true, typingSpeed: 40, stepBaseDelay: 200, stepRandomDelay: 450 },
        testimonials: {
            placeholderAvatarBaseUrl: 'https://placehold.co/100x100/',
            visibleCardsDesktop: 3,
            bufferCards: 2,
            slideDuration: 500
        }
    };

    // --- Testimonial Slider State ---
    let localTestimonials = [];
    let testimonialDataCache = [];
    let cardsInTrack = [];
    let stableVisibleStartIndex = config.testimonials.bufferCards;
    let totalCardsInDOM = 0;
    let cardWidthAndMargin = 0;
    let isSliding = false;
    let resizeTimeout;
    let initialLoadComplete = false;
    let transitionEndCounter = 0;

    // --- REVISED Hardcoded Testimonial Data ---
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
            const avatarUrl = `${config.testimonials.placeholderAvatarBaseUrl}${colors.bg}/${colors.text}/png?text=${encodeURIComponent(initials)}&font=poppins`;
            avatarEl.style.backgroundImage = `url('${avatarUrl}')`;
            avatarEl.setAttribute('aria-label', `Avatar ${name}`);
        }
     };

    const getRandomLocalTestimonial = () => {
        if (!localTestimonials || localTestimonials.length === 0) {
            console.error("getRandomLocalTestimonial: localTestimonials array is empty or undefined.");
            return { name: "Chyba", text: "Žádné dostupné recenze.", rating: 0, role: "Systém" };
        }
        const currentCacheNames = new Set(testimonialDataCache.map(item => item?.name).filter(Boolean));
        let availableTestimonials = localTestimonials.filter(item => !currentCacheNames.has(item.name));
        if (availableTestimonials.length === 0) {
            console.warn("No unique testimonials available outside the current cache. Reusing testimonials.");
            availableTestimonials = localTestimonials;
             if (availableTestimonials.length === 0) {
                 return { name: "Chyba", text: "Žádné dostupné recenze.", rating: 0, role: "Systém" };
             }
        }
        const randomIndex = Math.floor(Math.random() * availableTestimonials.length);
        return availableTestimonials[randomIndex];
     };

    const calculateCardWidthAndMargin = () => {
        if (!sliderTrack) {
            console.error("calculateCardWidthAndMargin: sliderTrack element not found.");
            return 0;
        }
        const firstCard = sliderTrack.querySelector('.testimonial-card:not(.is-loading)');
        const cardElement = firstCard || sliderTrack.querySelector('.testimonial-card');
        if (!cardElement) {
            console.warn("calculateCardWidthAndMargin: No card elements found in the track.");
            return 0;
        }
        const style = window.getComputedStyle(cardElement);
        const width = cardElement.offsetWidth;
        const marginRight = parseFloat(style.marginRight) || 0;
        if (width <= 0) {
            console.warn(`calculateCardWidthAndMargin: Card element has zero or negative width (${width}px). Check CSS.`);
            if (!cardElement.dataset.recalcAttempted) {
                cardElement.dataset.recalcAttempted = "true";
                console.log("Attempting delayed recalculation...");
                setTimeout(calculateCardWidthAndMargin, 150);
            }
            return 0;
        }
        cardWidthAndMargin = width + marginRight;
        delete cardElement.dataset.recalcAttempted;
        return cardWidthAndMargin;
     };

    const setTrackPositionInstantly = (logReason = "default") => {
        if (!initialLoadComplete) {
            return;
        }
         if (!sliderTrack) {
             console.error(`setTrackPositionInstantly (${logReason}): sliderTrack not found.`);
             return;
         }
        if (cardWidthAndMargin <= 0) {
             console.warn(`setTrackPositionInstantly (${logReason}): cardWidthAndMargin is invalid (${cardWidthAndMargin}). Attempting recalculation.`);
             if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
                 console.error(`setTrackPositionInstantly (${logReason}): Recalculation failed. Cannot set position.`);
                 return;
             }
             console.log(`setTrackPositionInstantly (${logReason}): Recalculation successful.`);
         }
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd);
        sliderTrack.style.transition = 'none';
        const position = -stableVisibleStartIndex * cardWidthAndMargin;
        sliderTrack.style.transform = `translateX(${position}px)`;
        void sliderTrack.offsetHeight;
        sliderTrack.style.transition = `transform var(--transition-smooth-slider)`;
        sliderTrack.addEventListener('transitionend', handleTransitionEnd);
    };

    const handleTransitionEnd = (event) => {
        if (event.target !== sliderTrack || event.propertyName !== 'transform' || !initialLoadComplete || !isSliding) {
            return;
        }
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd);
        const direction = parseInt(sliderTrack.dataset.slideDirection || "0");
        transitionEndCounter++;
        if (direction === 0) {
            console.warn("handleTransitionEnd: Transition ended but direction was 0 (unexpected). Resetting state.");
             isSliding = false;
             prevBtn.disabled = false;
             nextBtn.disabled = false;
             sliderTrack.style.transition = `transform var(--transition-smooth-slider)`;
            return;
        }
        let cardToMove;
        let newData;
        try {
             newData = getRandomLocalTestimonial();
             if (!newData) throw new Error("Failed to get new testimonial data.");
            if (direction > 0) {
                cardToMove = cardsInTrack.shift();
                if (!cardToMove) throw new Error("Failed to get first card element from cardsInTrack array.");
                testimonialDataCache.shift();
                testimonialDataCache.push(newData);
            } else {
                cardToMove = cardsInTrack.pop();
                 if (!cardToMove) throw new Error("Failed to get last card element from cardsInTrack array.");
                testimonialDataCache.pop();
                testimonialDataCache.unshift(newData);
            }
             updateCardContent(cardToMove, newData);
        } catch (error) {
             console.error("Error during data/card selection in handleTransitionEnd:", error);
             isSliding = false;
             setTrackPositionInstantly("error recovery");
             prevBtn.disabled = false;
             nextBtn.disabled = false;
             sliderTrack.style.transition = `transform var(--transition-smooth-slider)`;
             return;
        }
        sliderTrack.style.transition = 'none';
        try {
            if (direction > 0) {
                sliderTrack.appendChild(cardToMove);
                cardsInTrack.push(cardToMove);
            } else {
                sliderTrack.insertBefore(cardToMove, sliderTrack.firstChild);
                cardsInTrack.unshift(cardToMove);
            }
        } catch (domError) {
             console.error("Error during DOM manipulation (appendChild/insertBefore) in handleTransitionEnd:", domError);
             isSliding = false;
             setTrackPositionInstantly("dom error recovery");
             prevBtn.disabled = false;
             nextBtn.disabled = false;
             sliderTrack.style.transition = `transform var(--transition-smooth-slider)`;
             return;
        }
        setTrackPositionInstantly("transition end");
        sliderTrack.dataset.slideDirection = "0";
        isSliding = false;
        prevBtn.disabled = false;
        nextBtn.disabled = false;
     };

    const moveSlider = (direction) => {
         if (isSliding || !initialLoadComplete) {
             console.warn(`Slide attempt blocked: isSliding=${isSliding}, initialLoadComplete=${initialLoadComplete}`);
             return;
        }
        if (cardWidthAndMargin <= 0) {
             console.warn("moveSlider: cardWidthAndMargin is invalid. Attempting recalculation.");
             if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
                 console.error("moveSlider: Recalculation failed. Cannot slide.");
                 return;
             }
             console.log("moveSlider: Recalculation successful.");
             setTrackPositionInstantly("pre-slide recalc");
         }
        isSliding = true;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        sliderTrack.dataset.slideDirection = direction.toString();
        sliderTrack.style.transition = `transform var(--transition-smooth-slider)`;
        const currentTransform = window.getComputedStyle(sliderTrack).transform;
        let currentTranslateX = 0;
        if (currentTransform && currentTransform !== 'none') {
            const matrix = new DOMMatrixReadOnly(currentTransform);
            currentTranslateX = matrix.m41;
        } else {
             currentTranslateX = -stableVisibleStartIndex * cardWidthAndMargin;
             console.warn("moveSlider: Could not get current transform, using stable index as base.");
        }
        const newTranslateX = currentTranslateX - (direction * cardWidthAndMargin);
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd);
        sliderTrack.addEventListener('transitionend', handleTransitionEnd);
        sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
     };

    const initializeInfiniteSlider = async () => {
         console.log("Starting infinite slider initialization v2.13 (Slider Fixes)...");
        isSliding = true;
        initialLoadComplete = false;
         if (!sliderTrack || !prevBtn || !nextBtn) {
             console.error("Slider initialization failed: Essential DOM elements (track or buttons) not found.");
             isSliding = false;
             return;
         }
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        sliderTrack.innerHTML = '';
        testimonialDataCache = [];
        cardsInTrack = [];
        cardWidthAndMargin = 0;
        stableVisibleStartIndex = config.testimonials.bufferCards;
        if (!localTestimonials || localTestimonials.length === 0) {
            console.error("Local testimonial data is empty! Cannot initialize slider.");
            sliderTrack.innerHTML = `<p style="color: var(--clr-accent-red); padding: 20px; text-align: center;">Chyba: Chybí data pro recenze.</p>`;
            isSliding = false;
            return;
        }
        const numVisible = config.testimonials.visibleCardsDesktop;
        const numBuffer = config.testimonials.bufferCards;
        totalCardsInDOM = numVisible + 2 * numBuffer;
        console.log(`Initial setup: Visible=${numVisible}, Buffer=${numBuffer}, TotalInDOM=${totalCardsInDOM}, StableStartIdx=${stableVisibleStartIndex}`);
        if (localTestimonials.length < totalCardsInDOM) {
            console.warn(`Warning: Not enough unique testimonials (${localTestimonials.length}) to fill the initial track (${totalCardsInDOM}) without potential immediate reuse.`);
        }
        for (let i = 0; i < totalCardsInDOM; i++) {
            const cardElement = createPlaceholderCard();
            sliderTrack.appendChild(cardElement);
            cardsInTrack.push(cardElement);
        }
        let attempt = 0;
        const maxAttempts = localTestimonials.length * 2;
        while (testimonialDataCache.length < totalCardsInDOM && attempt < maxAttempts && localTestimonials.length > 0) {
             let randomIndex = Math.floor(Math.random() * localTestimonials.length);
             let randomTestimonial = localTestimonials[randomIndex];
             let retries = 0;
             const maxRetries = 5;
             while (testimonialDataCache.some(d => d && d.name === randomTestimonial.name) && retries < maxRetries && testimonialDataCache.length + (localTestimonials.length - testimonialDataCache.length) > totalCardsInDOM) {
                 randomIndex = Math.floor(Math.random() * localTestimonials.length);
                 randomTestimonial = localTestimonials[randomIndex];
                 retries++;
             }
             testimonialDataCache.push(randomTestimonial);
             attempt++;
         }
         while (testimonialDataCache.length < totalCardsInDOM && localTestimonials.length > 0) {
              testimonialDataCache.push(localTestimonials[Math.floor(Math.random() * localTestimonials.length)]);
         }
        cardsInTrack.forEach((card, index) => {
            const data = testimonialDataCache[index];
            if (data) {
                updateCardContent(card, data);
            } else {
                 console.warn(`Missing data for card index ${index} during initial population.`);
                 updateCardContent(card, { name: "Chyba", text: "Data nenalezena.", rating: 0, role: "Systém" });
             }
        });
        console.log(`Created and populated ${cardsInTrack.length} initial cards from local data.`);
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
            console.error("Could not calculate card dimensions after initial population and layout. Aborting slider setup.");
            sliderTrack.innerHTML = '<p style="color: var(--clr-accent-red); padding: 20px; text-align: center;">Chyba layoutu slideru.</p>';
            isSliding = false;
            return;
        }
        initialLoadComplete = true;
        setTrackPositionInstantly("initialization");
        console.log("Infinite slider initialized successfully (Local Data).");
        isSliding = false;
        prevBtn.disabled = false;
        nextBtn.disabled = false;
     };

    // --- Header Scroll Effect ---
    const handleScroll = () => {
        if (header) {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }
         const sections = document.querySelectorAll('main section[id]');
         let currentSectionId = '';
         sections.forEach(section => {
             const sectionTop = section.offsetTop;
             if (window.scrollY >= sectionTop - window.innerHeight / 2) {
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
            header.classList.toggle('menu-open', isActive);
            hamburger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        }
    };

    const closeMenu = () => {
        if (hamburger && navLinks && menuOverlay && body && header) {
            if (hamburger.classList.contains('active')) {
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
        navLinks.addEventListener('click', (e) => {
            if (e.target.matches('a.nav-item') || e.target.closest('a.mobile-auth-link')) {
                closeMenu();
            }
        });
    }

    // --- Mouse Follower ---
    let mouseX = 0, mouseY = 0;
    let followerX = 0, followerY = 0;
    let isHoveringInteractable = false;
    const updateFollower = () => {
        if (!follower || !config.mouseFollower.enabled) return;
        const dx = mouseX - followerX;
        const dy = mouseY - followerY;
        followerX += dx * config.mouseFollower.followSpeed;
        followerY += dy * config.mouseFollower.followSpeed;
        follower.style.transform = `translate(${followerX - follower.offsetWidth / 2}px, ${followerY - follower.offsetHeight / 2}px) scale(${isHoveringInteractable ? config.mouseFollower.hoverScale : 1})`;
        requestAnimationFrame(updateFollower);
    };
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!isTouchDevice && follower && config.mouseFollower.enabled) {
        window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; if(follower.style.opacity !== '1') follower.style.opacity = '1'; });
        document.addEventListener('mouseleave', () => { if (follower) follower.style.opacity = '0'; });
        document.addEventListener('mouseenter', () => { if (follower) follower.style.opacity = '0.7'; });
        document.querySelectorAll('a, button, .btn, .slider-btn').forEach(el => {
            el.addEventListener('mouseenter', () => isHoveringInteractable = true);
            el.addEventListener('mouseleave', () => isHoveringInteractable = false);
        });
        requestAnimationFrame(updateFollower);
    } else if (follower) {
        follower.style.display = 'none';
    }

    // --- Footer Year ---
    if (yearSpan) { yearSpan.textContent = new Date().getFullYear(); }

    // --- AI Demo Simulation ---
    const aiDemoSteps = [ { type: 'status', text: 'AI jádro aktivní. Monitoruji interakce...' }, { type: 'status', text: 'Detekováno načtení dat o výkonu studenta ID: 734B' }, { type: 'input', text: 'getUserPerformance("734B") --area=algebra --level=základní' }, { type: 'process', text: 'Zpracování požadavku...', duration: 800, progress: 15 }, { type: 'analysis', text: 'Analýza dat: Nalezeno 156 záznamů...' }, { type: 'analysis', text: 'Identifikace slabých míst: Zlomky (úspěšnost 45%), Rovnice (úspěšnost 58%)' }, { type: 'analysis', text: 'Silné stránky: Procenta (úspěšnost 92%)' }, { type: 'process', text: 'Generování doporučení...', duration: 1200, progress: 40 }, { type: 'output', text: 'Doporučení: 3x cvičení na sčítání zlomků, 2x cvičení na lineární rovnice.' }, { type: 'input', text: 'generateAdaptivePlan("734B", ["zlomky", "rovnice"])' }, { type: 'process', text: 'Vytváření personalizovaného plánu...', duration: 1500, progress: 75 }, { type: 'output', text: 'Plán vygenerován: 5 kroků, odhadovaná doba 45 minut.' }, { type: 'status', text: 'Aktualizace profilu studenta...' }, { type: 'process', text: 'Synchronizace s databází...', duration: 600, progress: 90 }, { type: 'status', text: 'Systém připraven pro další vstup.', progress: 100 } ];
    let currentAiStep = 0; let isAiDemoRunning = false; let aiDemoTimeout;
    const addAiLogLine = (text, type) => { if (!aiOutput) return; const line = document.createElement('div'); line.className = `ai-log-line ${type}`; line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`; aiOutput.appendChild(line); aiOutput.scrollTop = aiOutput.scrollHeight; };
    const simulateTyping = (text, onComplete) => { if (!aiFakeInput) { onComplete?.(); return; } let index = 0; aiFakeInput.textContent = ''; const interval = setInterval(() => { if (index < text.length) { aiFakeInput.textContent += text.charAt(index); index++; } else { clearInterval(interval); if (onComplete) setTimeout(onComplete, 200); } }, config.aiDemo.typingSpeed); };
    const updateAiProgress = (percentage) => { if (aiProgressBar && aiProgressLabel) { aiProgressBar.style.width = `${percentage}%`; aiProgressBar.setAttribute('aria-valuenow', percentage); } };
    const runAiDemoStep = () => { if (currentAiStep >= aiDemoSteps.length || !aiOutput) { isAiDemoRunning = false; if(aiStatusIndicator) aiStatusIndicator.textContent = 'ČEKÁ'; return; } const step = aiDemoSteps[currentAiStep]; const delay = config.aiDemo.stepBaseDelay + Math.random() * config.aiDemo.stepRandomDelay; if (step.type === 'input') { simulateTyping(step.text, () => { addAiLogLine(`> ${step.text}`, step.type); if (step.progress) updateAiProgress(step.progress); if (aiProgressLabel) aiProgressLabel.textContent = step.text; currentAiStep++; aiDemoTimeout = setTimeout(runAiDemoStep, delay / 2); }); } else { addAiLogLine(step.text, step.type); if (step.progress) updateAiProgress(step.progress); if (aiProgressLabel && step.type !== 'status') aiProgressLabel.textContent = step.text; currentAiStep++; aiDemoTimeout = setTimeout(runAiDemoStep, delay + (step.duration || 0)); } if(aiStatusIndicator) aiStatusIndicator.textContent = 'ZPRACOVÁVÁ'; };
    const aiDemoObserver = new IntersectionObserver((entries) => { entries.forEach(entry => { if (config.aiDemo.enabled && entry.isIntersecting && !isAiDemoRunning) { isAiDemoRunning = true; currentAiStep = 0; if (aiOutput) aiOutput.innerHTML = ''; updateAiProgress(0); if (aiProgressLabel) aiProgressLabel.textContent = 'Inicializace...'; if (aiFakeInput) aiFakeInput.textContent = ''; runAiDemoStep(); } else if (!entry.isIntersecting && isAiDemoRunning) { clearTimeout(aiDemoTimeout); isAiDemoRunning = false; if(aiStatusIndicator) aiStatusIndicator.textContent = 'POZASTAVENO'; } }); }, { threshold: 0.5 });
    if (demoSection && config.aiDemo.enabled) { aiDemoObserver.observe(demoSection); } else { if (aiProgressLabel) aiProgressLabel.textContent = 'AI Demo není aktivní'; if (aiOutput) addAiLogLine('AI Demo je momentálně neaktivní.', 'status'); }


    // --- *** NEW/REVISED: Scroll Animations (Intersection Observer & Letter Animation) *** ---

    const animatedElements = document.querySelectorAll('[data-animate], [data-animate-letters]');
    const observerOptions = { root: null, rootMargin: '0px', threshold: config.animations.scrollThreshold };

    // *** REVISED: Function to SET UP letters for mask animation ***
    const setupLetterAnimation = (element) => {
        const textContent = element.textContent || '';
        // Use the globally scoped heroHighlightSpan initially
        const originalHighlightElement = element.querySelector('.highlight');
        const highlightText = originalHighlightElement ? (originalHighlightElement.dataset.text || originalHighlightElement.textContent || '') : '';
        let currentHighlightSpan = null;
        let letterIndex = 0;

        element.innerHTML = ''; // Clear original content
        element.style.setProperty('--letter-count', textContent.length); // Set total count for subsequent delays

        textContent.split('').forEach(char => {
            const span = document.createElement('span');
            span.className = 'letter-span'; // Class for CSS targeting
            span.textContent = char === ' ' ? '\u00A0' : char; // Handle spaces
            span.style.setProperty('--letter-index', letterIndex); // Set index for staggered delay

            const isHighlightChar = originalHighlightElement &&
                                   highlightText &&
                                   textContent.includes(highlightText) &&
                                   charIndex >= textContent.indexOf(highlightText) &&
                                   charIndex < textContent.indexOf(highlightText) + highlightText.length;

            if (isHighlightChar) {
                if (!currentHighlightSpan) {
                    currentHighlightSpan = document.createElement('span');
                    currentHighlightSpan.className = originalHighlightElement.className; // Copy classes
                    if (originalHighlightElement.dataset.text) {
                        currentHighlightSpan.dataset.text = originalHighlightElement.dataset.text; // Copy data-text
                    }
                    // Update the global reference *if* this is the hero highlight element
                    if (originalHighlightElement === heroHighlightSpan) {
                        heroHighlightSpan = currentHighlightSpan; // Update global reference
                        console.log("Hero highlight span reference updated during setup.");
                    }
                    element.appendChild(currentHighlightSpan);
                }
                currentHighlightSpan.appendChild(span);
            } else {
                element.appendChild(span);
                currentHighlightSpan = null;
            }

            letterIndex++;
        });
        console.log(`Setup letter animation for: ${element.id || element.tagName}`);
    };

    // *** REVISED: Intersection Observer Callback ***
    const animationObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const element = entry.target;
                // console.log(`Element intersecting: ${element.id || element.tagName}`);

                if (element.dataset.animateLetters !== undefined) {
                    if (!element.classList.contains('letters-setup')) {
                        setupLetterAnimation(element); // Prepare the spans
                        element.classList.add('letters-setup');
                        setTimeout(() => {
                             element.classList.add('is-revealing'); // Trigger the reveal
                             // console.log(`Added 'is-revealing' to ${element.id || element.tagName}`);
                        }, 10);
                    }
                } else {
                     const delay = parseInt(element.style.getPropertyValue('--animation-order') || '0') * config.animations.staggerDelay;
                     element.style.transitionDelay = `${delay}ms`;
                    element.classList.add('animated');
                    // console.log(`Added 'animated' to ${element.id || element.tagName}`);
                }
                observer.unobserve(element);
                // console.log(`Unobserved: ${element.id || element.tagName}`);
            }
        });
    }, observerOptions);

    if (animatedElements.length > 0) {
        animatedElements.forEach(el => {
            animationObserver.observe(el);
        });
        console.log(`Observing ${animatedElements.length} elements for scroll animations.`);
    }

    // --- *** NEW: Interactive Gradient Logic *** ---
    const handleHeroMouseMove = (event) => {
        // Make sure heroHighlightSpan is the correct, potentially recreated element
        if (!heroSection || !heroHighlightSpan) {
            // Attempt to re-select if it became null after setup
             if(heroSection) heroHighlightSpan = heroSection.querySelector('.hero h1 .highlight');
             if (!heroHighlightSpan) return; // Still not found, exit
        }

        if (rafId) {
            cancelAnimationFrame(rafId);
        }

        rafId = requestAnimationFrame(() => {
            const rect = heroSection.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

            heroHighlightSpan.style.setProperty('--mouse-x', x.toFixed(3));
            heroHighlightSpan.style.setProperty('--mouse-y', y.toFixed(3));
        });
    };

    // Add listener only if the necessary elements exist AND not on touch device
    if (heroSection && heroHighlightSpan && !isTouchDevice) {
         console.log("Initializing interactive hero gradient.");
        heroSection.addEventListener('mousemove', handleHeroMouseMove);
         heroSection.addEventListener('mouseleave', () => {
             if (rafId) cancelAnimationFrame(rafId);
             rafId = requestAnimationFrame(() => {
                // Ensure heroHighlightSpan is still valid
                if(heroHighlightSpan) {
                    heroHighlightSpan.style.setProperty('--mouse-x', 0.5);
                    heroHighlightSpan.style.setProperty('--mouse-y', 0.5);
                } else {
                     // Attempt re-selection on mouseleave if needed
                     const currentHighlight = heroSection?.querySelector('.hero h1 .highlight');
                     if (currentHighlight) {
                         currentHighlight.style.setProperty('--mouse-x', 0.5);
                         currentHighlight.style.setProperty('--mouse-y', 0.5);
                     }
                }
             });
         });
    } else if (!heroHighlightSpan) {
         console.warn("Hero highlight span (.hero h1 .highlight) not found initially. Interactive gradient disabled.");
    } else if (isTouchDevice) {
         console.log("Touch device detected. Interactive hero gradient disabled.");
         if (heroHighlightSpan) {
            heroHighlightSpan.style.setProperty('--mouse-x', 0.5);
            heroHighlightSpan.style.setProperty('--mouse-y', 0.2);
         }
    }

    // --- Event Listeners ---
    window.addEventListener('scroll', debounce(handleScroll, 50));
    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => moveSlider(-1));
        nextBtn.addEventListener('click', () => moveSlider(1));
    } else {
        console.error("Failed to attach listeners: Slider buttons not found.");
    }
    window.addEventListener('resize', debounce(() => {
        console.log("Window resized, recalculating slider dimensions...");
        if (initialLoadComplete && calculateCardWidthAndMargin() > 0) {
             setTrackPositionInstantly("resize");
        } else if (initialLoadComplete) {
             console.warn("Recalculation failed after resize.");
        }
    }, 250));

    // --- Initialize Components ---
    handleScroll();
    initializeInfiniteSlider();

    // --- Final Log ---
    console.log("JUSTAX Interface v2.20 (Hero Animation Update) Initialization Complete.");

}); // End DOMContentLoaded