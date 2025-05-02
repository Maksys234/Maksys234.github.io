/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, and **INFINITE** testimonial slider using a local data array.
 * Version: v2.12 (Simplified Roles - FINAL)
 * Author: Gemini Modification
 * Date: 2025-05-02 // Removed teachers, simplified roles
 *
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.12 (Simplified Roles - Local Data)...");

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
            placeholderAvatarBaseUrl: 'https://placehold.co/100x100/',
            visibleCardsDesktop: 3,
            bufferCards: 2,
            slideDuration: 500 // Note: CSS duration is now 600ms, this value is only used internally if needed
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

    // --- REVISED Hardcoded Testimonial Data (Teachers Removed, Roles Simplified) ---
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
        { name: "Ludmila K.", role: "Rodič", rating: 5, text: "Koupila jsem vnukovi k Vánocům a je nadšený. Pomáhá mu to." }, // Assuming Babička = Rodič
        { name: "Věra", role: "Rodič", rating: 5, text: "Klidnější rána před písemkou. Dcera je lépe připravená." },
        { name: "Oldřich P.", role: "Rodič", rating: 4, text: "Dobrá investice do budoucnosti dítěte." },
        { name: "Božena M.", role: "Rodič", rating: 4.5, text: "Syn se učí rychleji a efektivněji než s učebnicí." }
    ];
    console.log(`Loaded ${localTestimonials.length} revised (Student/Rodič only) local testimonials.`);

    // --- Utility Functions & Core Logic (Identical to v2.10) ---

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
            <div class="testimonial-content"> <div class="testimonial-rating" aria-label="Hodnocení"></div> <blockquote class="testimonial-text"> <p class="testimonial-text-content"></p> </blockquote> </div>
            <div class="testimonial-author"> <div class="testimonial-avatar" role="img"></div> <div class="testimonial-author-info"> <div class="testimonial-name"></div> <div class="testimonial-role"></div> </div> </div>
        `;
        const ratingEl = cardElement.querySelector('.testimonial-rating');
        const textEl = cardElement.querySelector('.testimonial-text-content');
        const nameEl = cardElement.querySelector('.testimonial-name');
        const roleEl = cardElement.querySelector('.testimonial-role');
        const avatarEl = cardElement.querySelector('.testimonial-avatar');
        const name = data.name || 'Uživatel';
        const role = data.role || 'Neznámý'; // Use simplified role from data
        const rating = data.rating;
        const text = data.text || 'Chybí text recenze.';
        if (ratingEl) { ratingEl.innerHTML = generateStarsHTML(rating); ratingEl.setAttribute('aria-label', `Hodnocení: ${rating?.toFixed(1) || 0} z 5 hvězdiček`); }
        if (textEl) textEl.textContent = text;
        if (nameEl) nameEl.textContent = name;
        if (roleEl) roleEl.textContent = role; // Display the role (Student/Rodič)
        if (avatarEl) { const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '??'; const colors = getRandomColorPair(); const avatarUrl = `${config.testimonials.placeholderAvatarBaseUrl}${colors.bg}/${colors.text}/png?text=${encodeURIComponent(initials)}&font=poppins`; avatarEl.style.backgroundImage = `url('${avatarUrl}')`; avatarEl.setAttribute('aria-label', `Avatar ${name}`); }
     };
    const getRandomLocalTestimonial = () => {
        const currentCacheNames = new Set(testimonialDataCache.map(item => item?.name));
        let availableTestimonials = localTestimonials.filter(item => !currentCacheNames.has(item.name));
        if (availableTestimonials.length === 0) {
            console.warn("No unique testimonials available outside the current cache. Falling back to any random item.");
            availableTestimonials = localTestimonials;
        }
         // Ensure we don't crash if localTestimonials is empty for some reason
         if (availableTestimonials.length === 0) {
             return { name: "Chyba", text: "Žádné dostupné recenze.", rating: 0, role: "Systém" };
         }
        const randomIndex = Math.floor(Math.random() * availableTestimonials.length);
        return availableTestimonials[randomIndex];
     };
    const calculateCardWidthAndMargin = () => {
          const firstCard = sliderTrack.querySelector('.testimonial-card:not(.is-loading)');
         if (!firstCard) {
             const placeholderCard = sliderTrack.querySelector('.testimonial-card');
             if (!placeholderCard) return 0;
             const pStyle = window.getComputedStyle(placeholderCard);
             const pWidth = placeholderCard.offsetWidth;
             const pMarginRight = parseFloat(pStyle.marginRight) || 0; // Ensure default 0 if margin not set
             if (pWidth > 0) { cardWidthAndMargin = pWidth + pMarginRight; return cardWidthAndMargin; }
             return 0;
         }
         const style = window.getComputedStyle(firstCard);
         const width = firstCard.offsetWidth;
         const marginRight = parseFloat(style.marginRight) || 0; // Ensure default 0
         if (width === 0) { console.warn("calculateCardWidthAndMargin: First non-loading card has zero width."); return 0; }
         cardWidthAndMargin = width + marginRight;
         // console.log(`Recalculated cardWidthAndMargin: ${cardWidthAndMargin}px (Width: ${width}, Margin: ${marginRight})`);
         return cardWidthAndMargin;
     };
    const setTrackPositionInstantly = () => {
         if (!initialLoadComplete || cardWidthAndMargin === 0) return;
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd);
        sliderTrack.style.transition = 'none';
        const position = -stableVisibleStartIndex * cardWidthAndMargin;
        sliderTrack.style.transform = `translateX(${position}px)`;
        void sliderTrack.offsetHeight; // Force reflow
        // Only re-enable transition if not currently meant to be sliding (avoids race condition)
        if (!isSliding) {
            sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s ease-in-out`; // Use updated CSS timing
        }
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd); // Ensure clean
        sliderTrack.addEventListener('transitionend', handleTransitionEnd);
        // console.log(`Track position INSTANTLY set for stable index ${stableVisibleStartIndex} (translateX: ${position}px)`);
     };

    const handleTransitionEnd = (event) => {
        if (event.target !== sliderTrack || event.propertyName !== 'transform' || !initialLoadComplete || !isSliding) {
            return;
        }
        const direction = parseInt(sliderTrack.dataset.slideDirection || "0");
        transitionEndCounter++;
        // console.log(`Transition ended (#${transitionEndCounter}). Direction: ${direction}.`);

        if (direction === 0) {
            console.warn("Transition ended but direction was 0. Resetting state.");
            isSliding = false;
            prevBtn.disabled = false;
            nextBtn.disabled = false;
            // Explicitly re-enable transition here as well
            sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s ease-in-out`; // Use updated CSS timing
            return;
        }

        const newData = getRandomLocalTestimonial();

        // Disable transition for DOM manipulation
        sliderTrack.style.transition = 'none';

        try {
            if (direction > 0) { // Moved Right (Next button clicked)
                const firstCard = cardsInTrack.shift(); // Remove from beginning
                if (!firstCard) throw new Error("Cannot get first card");
                testimonialDataCache.shift(); // Remove corresponding data
                testimonialDataCache.push(newData); // Add new data to end
                updateCardContent(firstCard, newData); // Update the removed card
                sliderTrack.appendChild(firstCard); // Add to end of track
                cardsInTrack.push(firstCard); // Add to end of JS array
            } else { // Moved Left (Prev button clicked)
                const lastCard = cardsInTrack.pop(); // Remove from end
                if (!lastCard) throw new Error("Cannot get last card");
                testimonialDataCache.pop(); // Remove corresponding data
                testimonialDataCache.unshift(newData); // Add new data to beginning
                updateCardContent(lastCard, newData); // Update the removed card
                sliderTrack.insertBefore(lastCard, sliderTrack.firstChild); // Add to beginning of track
                cardsInTrack.unshift(lastCard); // Add to beginning of JS array
            }
        } catch (error) {
            console.error("Error during DOM manipulation in handleTransitionEnd:", error);
            // Try to recover state if possible, otherwise disable slider
             isSliding = false;
             prevBtn.disabled = true; // Disable buttons on error
             nextBtn.disabled = true;
             // Attempt to restore a visual state if possible
             setTrackPositionInstantly(); // Reset to stable index visually
             sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s ease-in-out`; // Re-enable transition
            return; // Stop execution here after error
        }

        // Reset position based on the stable buffer index *after* DOM manipulation
        setTrackPositionInstantly();

        // Re-enable transitions AFTER the instant position set + reflow
         void sliderTrack.offsetHeight; // Reflow might be needed again
         sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s ease-in-out`; // Use updated CSS timing

        sliderTrack.dataset.slideDirection = "0"; // Reset direction marker
        isSliding = false; // Allow new slides

        // Re-enable buttons
        prevBtn.disabled = false;
        nextBtn.disabled = false;
        // console.log("handleTransitionEnd complete.");
     };
    const moveSlider = (direction) => {
         if (isSliding || !initialLoadComplete) {
             console.warn(`Slide attempt blocked: isSliding=${isSliding}, initialLoadComplete=${initialLoadComplete}`);
             return;
        }
        isSliding = true;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        // console.log(`Moving slider. Direction: ${direction}.`);

        sliderTrack.dataset.slideDirection = direction.toString(); // Mark direction for transitionEnd

        // Ensure transition is enabled before transforming
        sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s ease-in-out`; // Use updated CSS timing

        const currentTransform = sliderTrack.style.transform;
        // Default to stable position if transform is not set or invalid
        const currentTranslateX = parseFloat(currentTransform.replace(/[^-\d.]/g, '')) || (-stableVisibleStartIndex * cardWidthAndMargin);
        const newTranslateX = currentTranslateX - (direction * cardWidthAndMargin);

        // Apply the smooth transform
        sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
        // console.log(`Animating transform to: ${newTranslateX}px`);
     };
    const initializeInfiniteSlider = async () => {
         console.log("Starting infinite slider initialization v2.12 (Simplified Roles)...");
        isSliding = true; // Block interactions during init
        initialLoadComplete = false;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        sliderTrack.innerHTML = ''; // Clear previous content
        testimonialDataCache = [];
        cardsInTrack = [];
        cardWidthAndMargin = 0;
        stableVisibleStartIndex = config.testimonials.bufferCards;

        if (localTestimonials.length === 0) {
            console.error("Local testimonial data is empty! Cannot initialize slider.");
            sliderTrack.innerHTML = `<p style="color: var(--clr-accent-red); padding: 20px; text-align: center;">Chyba: Chybí data pro recenze.</p>`;
             isSliding = false; // Unblock (though slider is unusable)
            return; // Stop initialization
        }
        const numVisible = config.testimonials.visibleCardsDesktop; // Assuming desktop for calculation base
        const numBuffer = config.testimonials.bufferCards;
        totalCardsInDOM = numVisible + 2 * numBuffer;
        console.log(`Initial setup: Visible=${numVisible}, Buffer=${numBuffer}, TotalInDOM=${totalCardsInDOM}, StableStartIdx=${stableVisibleStartIndex}`);

        if (localTestimonials.length < totalCardsInDOM) {
            console.warn(`Warning: Not enough unique testimonials (${localTestimonials.length}) to fill the initial track (${totalCardsInDOM}) without potential immediate reuse.`);
            // Consider allowing initialization anyway, as reuse might be acceptable.
        }

        // Create placeholder cards first
        for (let i = 0; i < totalCardsInDOM; i++) {
            const cardElement = createPlaceholderCard();
            sliderTrack.appendChild(cardElement);
            cardsInTrack.push(cardElement); // Add placeholder element to array
        }

        // Populate the data cache ensuring minimal immediate repeats if possible
        const initialDataIndices = new Set();
        while (testimonialDataCache.length < totalCardsInDOM && localTestimonials.length > 0) {
            let randomIndex = Math.floor(Math.random() * localTestimonials.length);
            // Simple attempt to avoid immediate duplicate names if enough unique ones exist
            let attempt = 0;
            while (testimonialDataCache.some(d => d.name === localTestimonials[randomIndex].name) && attempt < 5 && testimonialDataCache.length + localTestimonials.length > totalCardsInDOM ) {
                 randomIndex = Math.floor(Math.random() * localTestimonials.length);
                 attempt++;
             }
            testimonialDataCache.push(localTestimonials[randomIndex]);
        }
         // If still not enough, fill with potential duplicates
         while (testimonialDataCache.length < totalCardsInDOM && localTestimonials.length > 0) {
             testimonialDataCache.push(localTestimonials[Math.floor(Math.random() * localTestimonials.length)]);
         }

        // Update the placeholder cards with initial data
        cardsInTrack.forEach((card, index) => {
            if (testimonialDataCache[index]) {
                updateCardContent(card, testimonialDataCache[index]);
            } else {
                console.warn(`Missing data for card index ${index} during initial population.`);
                 updateCardContent(card, { name: "Chyba", text: "Data nenalezena.", rating: 0, role: "Systém" });
             }
        });

        console.log(`Created and populated ${cardsInTrack.length} initial cards from local data.`);

        // Wait briefly for cards to render before calculating dimensions
        await new Promise(resolve => setTimeout(resolve, 100)); // Increased delay slightly

        if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
            console.error("Could not calculate card dimensions after initial population. Aborting slider setup.");
            sliderTrack.innerHTML = '<p style="color: var(--clr-accent-red); padding: 20px; text-align: center;">Chyba layoutu slideru.</p>';
            isSliding = false;
            return;
        }

        // Set initial position without animation
        initialLoadComplete = true; // Mark as ready BEFORE setting position
        setTrackPositionInstantly(); // Position based on stable index

        // Add the transitionend listener *after* initial setup is complete
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd); // Clear any previous
        sliderTrack.addEventListener('transitionend', handleTransitionEnd);

        console.log("Infinite slider initialized successfully (Local Data).");
        isSliding = false; // Ready for user interaction
        prevBtn.disabled = false;
        nextBtn.disabled = false;
     };

    // --- Other Initializations (Header Scroll, Mobile Menu, etc.) ---

    // Header scroll effect
    const handleScroll = () => {
        if (header) {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }
         // Add active class to nav links based on scroll position
         const sections = document.querySelectorAll('main section[id]');
         let currentSectionId = '';
         sections.forEach(section => {
             const sectionTop = section.offsetTop;
             const sectionHeight = section.clientHeight;
             // Adjust trigger point (e.g., activate when section is 1/3 visible)
             if (window.scrollY >= sectionTop - window.innerHeight / 3) {
                 currentSectionId = section.getAttribute('id');
             }
         });

         const navItems = navLinks.querySelectorAll('.nav-item');
         navItems.forEach(item => {
             item.classList.remove('active');
              // Check if the item's href matches the current section ID
             if (item.getAttribute('href') === `#${currentSectionId}`) {
                 item.classList.add('active');
             }
         });
    };

    // Mobile Menu Toggle
    const toggleMenu = () => {
        if (hamburger && navLinks && menuOverlay && body && header) {
            const isActive = hamburger.classList.toggle('active');
            navLinks.classList.toggle('active', isActive);
            menuOverlay.classList.toggle('active', isActive);
            body.classList.toggle('no-scroll', isActive); // Prevent body scroll
            header.classList.toggle('menu-open', isActive); // Style header when menu is open
            hamburger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        }
    };

    // Close menu when clicking a link or overlay
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
            // Close menu only if a link inside was clicked
            if (e.target.classList.contains('nav-item') || e.target.closest('.mobile-auth-link')) {
                closeMenu();
            }
        });
    }

    // Mouse Follower
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

     // Check if touch device (basic check)
     const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    if (!isTouchDevice && follower && config.mouseFollower.enabled) {
        console.log("Initializing mouse follower.");
        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            follower.style.opacity = '1'; // Make visible on first move
        });

        // Hide follower if mouse leaves window
        document.addEventListener('mouseleave', () => {
             if (follower) follower.style.opacity = '0';
        });
         document.addEventListener('mouseenter', () => {
             if (follower) follower.style.opacity = '0.7'; // Restore default opacity
         });

        // Hover effect scaling
        document.querySelectorAll('a, button, .btn').forEach(el => {
            el.addEventListener('mouseenter', () => isHoveringInteractable = true);
            el.addEventListener('mouseleave', () => isHoveringInteractable = false);
        });
        requestAnimationFrame(updateFollower);
    } else if (follower) {
        follower.style.display = 'none'; // Hide follower completely on touch devices
        console.log("Mouse follower disabled (touch device or config).");
    }


    // Scroll Animations (Intersection Observer)
    const animatedElements = document.querySelectorAll('[data-animate], [data-animate-letters]');
    const observerOptions = {
        root: null, // viewport
        rootMargin: '0px',
        threshold: config.animations.scrollThreshold // Trigger when 15% visible
    };

    const animationObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                const element = entry.target;
                if (element.dataset.animateLetters !== undefined) {
                    // Handle letter animation
                    if (!element.classList.contains('letters-animating')) {
                         animateLetters(element);
                    }
                } else {
                     // Handle general fade/slide animation
                    element.classList.add('animated');
                 }
                 observer.unobserve(element); // Stop observing once animated
             }
        });
    }, observerOptions);

    if (animatedElements.length > 0) {
        animatedElements.forEach(el => {
             // Set initial animation order delay if defined
             const delay = parseInt(el.style.getPropertyValue('--animation-order') || '0') * config.animations.staggerDelay;
             el.style.transitionDelay = `${delay}ms`;
             animationObserver.observe(el);
         });
         console.log(`Observing ${animatedElements.length} elements for scroll animations.`);
     }

    // Function to animate letters
    const animateLetters = (element) => {
        const text = element.textContent;
         const highlightElement = element.querySelector('.highlight');
         const highlightText = highlightElement ? highlightElement.dataset.text || highlightElement.textContent : '';
        element.innerHTML = ''; // Clear original content

        let charIndex = 0;
        text.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char === ' ' ? '\u00A0' : char; // Use non-breaking space
            span.style.opacity = '0'; // Initially hidden
            span.style.display = 'inline-block'; // Needed for transform

            // Check if this character is part of the highlight
            if (highlightElement && text.includes(highlightText) && text.indexOf(highlightText) <= charIndex && charIndex < text.indexOf(highlightText) + highlightText.length) {
                 if (!element.querySelector('.highlight-wrapper')) {
                     const wrapper = document.createElement('span');
                     wrapper.className = 'highlight highlight-wrapper'; // Keep original class + add wrapper class
                     wrapper.dataset.text = highlightText; // Copy data-text
                     element.appendChild(wrapper);
                 }
                 element.querySelector('.highlight-wrapper').appendChild(span);
             } else {
                 element.appendChild(span);
             }

             // Apply animation with delay
             const delay = Math.random() * config.animations.letterRandomOffset + charIndex * config.animations.letterDelay;
             span.style.animation = `letter-pop-in 0.6s ${delay}ms forwards ease-out`;

            charIndex++;
        });
         element.classList.add('letters-animating'); // Mark as animating/animated
    };

    // Footer Year
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // --- AI Demo Simulation ---
    const aiDemoSteps = [
        { type: 'status', text: 'AI jádro aktivní. Monitoruji interakce...' },
        { type: 'status', text: 'Detekováno načtení dat o výkonu studenta ID: 734B' },
        { type: 'input', text: 'getUserPerformance("734B") --area=algebra --level=základní' },
        { type: 'process', text: 'Zpracování požadavku...', duration: 800, progress: 15 },
        { type: 'analysis', text: 'Analýza dat: Nalezeno 156 záznamů...' },
        { type: 'analysis', text: 'Identifikace slabých míst: Zlomky (úspěšnost 45%), Rovnice (úspěšnost 58%)' },
        { type: 'analysis', text: 'Silné stránky: Procenta (úspěšnost 92%)' },
        { type: 'process', text: 'Generování doporučení...', duration: 1200, progress: 40 },
        { type: 'output', text: 'Doporučení: 3x cvičení na sčítání zlomků, 2x cvičení na lineární rovnice.' },
        { type: 'input', text: 'generateAdaptivePlan("734B", ["zlomky", "rovnice"])' },
        { type: 'process', text: 'Vytváření personalizovaného plánu...', duration: 1500, progress: 75 },
        { type: 'output', text: 'Plán vygenerován: 5 kroků, odhadovaná doba 45 minut.' },
        { type: 'status', text: 'Aktualizace profilu studenta...' },
        { type: 'process', text: 'Synchronizace s databází...', duration: 600, progress: 90 },
        { type: 'status', text: 'Systém připraven pro další vstup.', progress: 100 }
    ];

    let currentAiStep = 0;
    let isAiDemoRunning = false;
    let aiDemoTimeout;

    // Function to add a line to the AI log
    const addAiLogLine = (text, type) => {
        if (!aiOutput) return;
        const line = document.createElement('div');
        line.className = `ai-log-line ${type}`;
        line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
        aiOutput.appendChild(line);
        // Auto-scroll to bottom
        aiOutput.scrollTop = aiOutput.scrollHeight;
    };

    // Function to simulate typing in the fake input
    const simulateTyping = (text, onComplete) => {
        if (!aiFakeInput) { onComplete(); return; }
        let index = 0;
        aiFakeInput.textContent = ''; // Clear previous
        const interval = setInterval(() => {
            if (index < text.length) {
                aiFakeInput.textContent += text.charAt(index);
                index++;
            } else {
                clearInterval(interval);
                if (onComplete) setTimeout(onComplete, 200); // Short pause after typing
            }
        }, config.aiDemo.typingSpeed);
    };

    // Function to update the progress bar
    const updateAiProgress = (percentage) => {
        if (aiProgressBar && aiProgressLabel) {
            aiProgressBar.style.width = `${percentage}%`;
            aiProgressBar.setAttribute('aria-valuenow', percentage);
            // Update label dynamically (optional, could be complex)
            // aiProgressLabel.textContent = `Průběh: ${percentage}%`;
        }
    };

     // Function to run a single step of the AI demo
     const runAiDemoStep = () => {
         if (currentAiStep >= aiDemoSteps.length || !aiOutput) {
             console.log("AI Demo finished or output element not found.");
             isAiDemoRunning = false;
             if(aiStatusIndicator) aiStatusIndicator.textContent = 'ČEKÁ';
             return; // End of demo
         }

         const step = aiDemoSteps[currentAiStep];
         const delay = config.aiDemo.stepBaseDelay + Math.random() * config.aiDemo.stepRandomDelay;

         if (step.type === 'input') {
             simulateTyping(step.text, () => {
                 addAiLogLine(`> ${step.text}`, step.type);
                 if (step.progress) updateAiProgress(step.progress);
                 if (aiProgressLabel) aiProgressLabel.textContent = step.text; // Update label for context
                 currentAiStep++;
                 aiDemoTimeout = setTimeout(runAiDemoStep, delay / 2); // Shorter delay after typing
             });
         } else {
             addAiLogLine(step.text, step.type);
             if (step.progress) updateAiProgress(step.progress);
             if (aiProgressLabel && step.type !== 'status') aiProgressLabel.textContent = step.text; // Update label
             currentAiStep++;
             aiDemoTimeout = setTimeout(runAiDemoStep, delay + (step.duration || 0));
         }
         if(aiStatusIndicator) aiStatusIndicator.textContent = 'ZPRACOVÁVÁ';
     };

     // Intersection Observer for AI Demo section
     const aiDemoObserver = new IntersectionObserver((entries) => {
         entries.forEach(entry => {
             if (config.aiDemo.enabled && entry.isIntersecting && !isAiDemoRunning) {
                 console.log("AI Demo section intersecting, starting simulation.");
                 isAiDemoRunning = true;
                 currentAiStep = 0; // Reset demo
                 if (aiOutput) aiOutput.innerHTML = ''; // Clear previous logs
                 updateAiProgress(0); // Reset progress bar
                 if (aiProgressLabel) aiProgressLabel.textContent = 'Inicializace...';
                 if (aiFakeInput) aiFakeInput.textContent = '';
                 runAiDemoStep(); // Start the demo
             } else if (!entry.isIntersecting && isAiDemoRunning) {
                 console.log("AI Demo section left viewport, pausing simulation.");
                 clearTimeout(aiDemoTimeout); // Pause demo
                 isAiDemoRunning = false;
                 if(aiStatusIndicator) aiStatusIndicator.textContent = 'POZASTAVENO';
             }
         });
     }, { threshold: 0.5 }); // Trigger when 50% visible

     if (demoSection && config.aiDemo.enabled) {
         aiDemoObserver.observe(demoSection);
     } else {
         console.log("AI Demo disabled or section not found.");
          if (aiProgressLabel) aiProgressLabel.textContent = 'AI Demo není aktivní';
          if (aiOutput) addAiLogLine('AI Demo je momentálně neaktivní.', 'status');
     }

    // Add scroll listener
    window.addEventListener('scroll', debounce(handleScroll, 50));
    handleScroll(); // Initial check

    // --- Initialize Components ---
    initializeInfiniteSlider(); // Initialize the slider

    // --- Final Log ---
    console.log("JUSTAX Interface v2.12 Initialization Complete (Simplified Roles - Local Data).");

}); // End DOMContentLoaded