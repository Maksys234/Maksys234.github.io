/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, and **INFINITE** testimonial slider using a local data array.
 * Version: v2.13 (Czech AI Demo + Testimonial Text Check)
 * Author: Gemini Modification
 * Date: 2025-05-02 // Updated AI Demo, added text logging
 *
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.13 (Czech AI Demo)...");

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
        // --- AI Demo Config ---
        aiDemo: {
            enabled: true,
            typingSpeed: 45, // Slightly adjusted speed
            stepBaseDelay: 250, // Base delay between steps
            stepRandomDelay: 500 // Random additional delay
        },
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

    // --- Hardcoded Testimonial Data (Simplified Roles) ---
    // [~70+ Testimonials from v2.12]
    localTestimonials = [
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
    console.log(`Loaded ${localTestimonials.length} revised (Student/Rodič only) local testimonials.`);

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
            <div class="testimonial-content"> <div class="testimonial-rating" aria-label="Hodnocení"></div> <blockquote class="testimonial-text"> <p class="testimonial-text-content"></p> </blockquote> </div>
            <div class="testimonial-author"> <div class="testimonial-avatar" role="img"></div> <div class="testimonial-author-info"> <div class="testimonial-name"></div> <div class="testimonial-role"></div> </div> </div>
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

        // --- Logging for text issue ---
        if (!text || text.trim() === '') {
            console.warn(`updateCardContent: Empty text received for card. Name: ${name}, Role: ${role}`);
        }
        // --- End Logging ---

        if (ratingEl) { ratingEl.innerHTML = generateStarsHTML(rating); ratingEl.setAttribute('aria-label', `Hodnocení: ${rating?.toFixed(1) || 0} z 5 hvězdiček`); }
        if (textEl) textEl.textContent = text; // Assign text here
        if (nameEl) nameEl.textContent = name;
        if (roleEl) roleEl.textContent = role;
        if (avatarEl) { const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '??'; const colors = getRandomColorPair(); const avatarUrl = `${config.testimonials.placeholderAvatarBaseUrl}${colors.bg}/${colors.text}/png?text=${encodeURIComponent(initials)}&font=poppins`; avatarEl.style.backgroundImage = `url('${avatarUrl}')`; avatarEl.setAttribute('aria-label', `Avatar ${name}`); }
     };
    const getRandomLocalTestimonial = () => {
        const currentCacheNames = new Set(testimonialDataCache.map(item => item?.name));
        let availableTestimonials = localTestimonials.filter(item => !currentCacheNames.has(item.name));
        if (availableTestimonials.length === 0) {
            console.warn("No unique testimonials available outside the current cache. Falling back to any random item.");
            availableTestimonials = localTestimonials;
        }
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
             const pMarginRight = parseFloat(pStyle.marginRight) || 0;
             if (pWidth > 0) { cardWidthAndMargin = pWidth + pMarginRight; return cardWidthAndMargin; }
             return 0;
         }
         const style = window.getComputedStyle(firstCard);
         const width = firstCard.offsetWidth;
         const marginRight = parseFloat(style.marginRight) || 0;
         if (width === 0) { console.warn("calculateCardWidthAndMargin: First non-loading card has zero width."); return 0; }
         cardWidthAndMargin = width + marginRight;
         return cardWidthAndMargin;
     };
    const setTrackPositionInstantly = () => {
         if (!initialLoadComplete || cardWidthAndMargin === 0) return;
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd);
        sliderTrack.style.transition = 'none';
        const position = -stableVisibleStartIndex * cardWidthAndMargin;
        sliderTrack.style.transform = `translateX(${position}px)`;
        void sliderTrack.offsetHeight;
        if (!isSliding) {
            sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`;
        }
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd);
        sliderTrack.addEventListener('transitionend', handleTransitionEnd);
     };
    const handleTransitionEnd = (event) => {
        if (event.target !== sliderTrack || event.propertyName !== 'transform' || !initialLoadComplete || !isSliding) {
            return;
        }
        const direction = parseInt(sliderTrack.dataset.slideDirection || "0");
        transitionEndCounter++;
        if (direction === 0) {
            console.warn(`Transition ended (#${transitionEndCounter}) but direction was 0. Resetting state.`);
            isSliding = false;
            prevBtn.disabled = false;
            nextBtn.disabled = false;
            return;
        }
        const newData = getRandomLocalTestimonial();
        sliderTrack.style.transition = 'none';
        try {
            if (direction > 0) { // Moved Right
                const firstCard = cardsInTrack.shift();
                if (!firstCard) throw new Error("Cannot get first card");
                testimonialDataCache.shift();
                testimonialDataCache.push(newData);
                updateCardContent(firstCard, newData);
                sliderTrack.appendChild(firstCard);
                cardsInTrack.push(firstCard);
            } else { // Moved Left
                const lastCard = cardsInTrack.pop();
                if (!lastCard) throw new Error("Cannot get last card");
                testimonialDataCache.pop();
                testimonialDataCache.unshift(newData);
                updateCardContent(lastCard, newData);
                sliderTrack.insertBefore(lastCard, sliderTrack.firstChild);
                cardsInTrack.unshift(lastCard);
            }
        } catch (error) {
            console.error("Error during DOM manipulation in handleTransitionEnd:", error);
            isSliding = false;
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }
        setTrackPositionInstantly();
        sliderTrack.dataset.slideDirection = "0";
        isSliding = false;
        prevBtn.disabled = false;
        nextBtn.disabled = false;
     };
    const moveSlider = (direction) => {
         if (isSliding || !initialLoadComplete) { return; }
        isSliding = true;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        sliderTrack.dataset.slideDirection = direction.toString();
        const currentTransform = sliderTrack.style.transform;
        const currentTranslateX = parseFloat(currentTransform.replace(/[^-\d.]/g, '')) || (-stableVisibleStartIndex * cardWidthAndMargin);
        const newTranslateX = currentTranslateX - (direction * cardWidthAndMargin);
        sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`;
        sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
     };
    const initializeInfiniteSlider = async () => {
         console.log("Starting infinite slider initialization v2.12...");
        isSliding = true;
        initialLoadComplete = false;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        sliderTrack.innerHTML = '';
        testimonialDataCache = [];
        cardsInTrack = [];
        cardWidthAndMargin = 0;
        stableVisibleStartIndex = config.testimonials.bufferCards;

        if (localTestimonials.length === 0) {
            console.error("Local testimonial data is empty!");
            sliderTrack.innerHTML = `<p style="color: var(--clr-accent-red);">Chyba: Chybí data pro recenze.</p>`;
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
            const cardData = getRandomLocalTestimonial();
            testimonialDataCache.push(cardData);
            const cardElement = createPlaceholderCard();
            sliderTrack.appendChild(cardElement);
            cardsInTrack.push(cardElement);
            updateCardContent(cardElement, cardData);
        }
        console.log(`Created and populated ${totalCardsInDOM} initial cards from local data.`);

        await new Promise(resolve => setTimeout(resolve, 60));

        if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
            console.error("Could not calculate card dimensions. Aborting slider setup.");
            sliderTrack.innerHTML = '<p style="color: var(--clr-accent-red);">Chyba layoutu slideru.</p>';
            isSliding = false;
            return;
        }

        initialLoadComplete = true;
        setTrackPositionInstantly();

        sliderTrack.removeEventListener('transitionend', handleTransitionEnd);
        sliderTrack.addEventListener('transitionend', handleTransitionEnd);

        console.log("Infinite slider initialized successfully (Local Data).");
        isSliding = false;
        prevBtn.disabled = false;
        nextBtn.disabled = false;
     };

    // --- AI Demo Simulation (REVISED for Czech & 9th Grade Topic) ---
    if (config.aiDemo.enabled && demoSection && aiOutput && aiProgressBar && aiProgressLabel && aiFakeInput && aiStatusIndicator) {
        let currentTextIndex = 0;
        let currentProgress = 0;
        let demoIsRunning = false;
        let demoTimeoutId = null;

        // --- NEW Czech Demo Texts (Linear Equations Example) ---
        const demoTexts = [
            { text: "Inicializace systému Justax AI...", type: "status", delay: 500 },
            { text: "Načítání kognitivního jádra v21...", type: "status" },
            { text: "Připojování k databázi znalostí (Algebra)...", type: "status" },
            { text: "Požadavek přijat: Vysvětlit 'Lineární rovnice' (9. třída)", type: "input", inputSpeed: 50 },
            { text: "Analyzuji profil studenta: 'Lucie_P'", type: "process" },
            { text: "Identifikuji klíčové koncepty: neznámá, koeficient, ekvivalentní úpravy...", type: "analysis", progressText: "Analýza konceptů" },
            { text: "Detekuji časté chyby: nesprávné převádění členů, znaménkové chyby.", type: "warning", progressText: "Detekce chyb" },
            { text: "Generuji vysvětlení...", type: "process", progressText: "Generování..." },
            { text: "Lineární rovnice je rovnost se dvěma výrazy, kde neznámá (obvykle 'x') je v první mocnině.", type: "output" },
            { text: "Cílem je najít hodnotu neznámé, pro kterou rovnost platí.", type: "output" },
            { text: "Používáme ekvivalentní úpravy (přičítání/odčítání stejného čísla k oběma stranám, násobení/dělení nenulovým číslem).", type: "output", delay: 400 },
            { text: "Příklad: 3x + 5 = 11", type: "input", inputSpeed: 40 },
            { text: "Krok 1: Odečteme 5 od obou stran.", type: "process", progressText: "Řešení příkladu" },
            { text: "   3x + 5 - 5 = 11 - 5", type: "output" },
            { text: "   3x = 6", type: "output" },
            { text: "Krok 2: Vydělíme obě strany 3.", type: "process" },
            { text: "   3x / 3 = 6 / 3", type: "output" },
            { text: "   x = 2", type: "output" },
            { text: "Zkouška: Dosadíme x=2 do původní rovnice: 3*(2) + 5 = 6 + 5 = 11. Platí.", type: "analysis", progressText: "Ověření" },
            { text: "Navrhuji interaktivní cvičení na ekvivalentní úpravy...", type: "process", progressText: "Návrh cvičení" },
            { text: "Vysvětlení kompletní. Připraveno k procvičování.", type: "status", delay: 500, final: true },
        ];
        // --- End NEW Demo Texts ---

        const progressIncrement = 100 / (demoTexts.length - 1 || 1);
        const typeText = (element, text, speed) => new Promise((resolve) => {
             let i = 0; element.textContent = ''; const intervalId = setInterval(() => { if (i < text.length) { element.textContent += text.charAt(i); i++; } else { clearInterval(intervalId); resolve(); } }, speed);
         });
        const runAIDemoStep = async () => {
             if (currentTextIndex >= demoTexts.length || !demoIsRunning) { aiStatusIndicator.textContent = "NEAKTIVNÍ"; aiProgressLabel.textContent = currentTextIndex >= demoTexts.length ? "Zpracování dokončeno" : "Simulace zastavena"; if(currentTextIndex >= demoTexts.length) aiProgressBar.style.width = '100%'; demoIsRunning = false; if (demoTimeoutId) clearTimeout(demoTimeoutId); return; }
             const item = demoTexts[currentTextIndex];
             const logLine = document.createElement('p');
             logLine.classList.add('ai-log-line', item.type || 'status');
             logLine.setAttribute('role', 'logitem');
             aiStatusIndicator.textContent = item.progressText || "ZPRACOVÁVÁM";
             if (item.type === 'input') {
                 aiFakeInput.parentElement?.classList.add('typing');
                 await typeText(aiFakeInput, item.text, item.inputSpeed || config.aiDemo.typingSpeed);
                 await new Promise(resolve => setTimeout(resolve, 300));
                 logLine.textContent = `> ${item.text}`;
                 aiFakeInput.textContent = '';
                 aiFakeInput.parentElement?.classList.remove('typing');
             } else {
                 await typeText(logLine, item.text, config.aiDemo.typingSpeed);
             }
             aiOutput.appendChild(logLine);
             aiOutput.scrollTo({ top: aiOutput.scrollHeight, behavior: 'smooth' });
             if (currentTextIndex > 0 || demoTexts.length === 1) currentProgress += progressIncrement;
             const displayProgress = Math.min(currentProgress, 100);
             aiProgressBar.style.width = `${displayProgress}%`;
             aiProgressBar.setAttribute('aria-valuenow', Math.round(displayProgress));
             aiProgressLabel.textContent = `${item.progressText || item.type.toUpperCase() || 'STATUS'} // ${item.text.substring(0, 35)}...`;
             currentTextIndex++;
             const delay = (item.delay || 0) + config.aiDemo.stepBaseDelay + Math.random() * config.aiDemo.stepRandomDelay;
             if (demoIsRunning) demoTimeoutId = setTimeout(runAIDemoStep, delay);
         };
        const startDemo = () => {
             if (demoIsRunning) return;
             console.log("AI Demo section intersecting, starting simulation...");
             demoIsRunning = true;
             aiOutput.innerHTML = '';
             aiFakeInput.textContent = '';
             aiProgressBar.style.width = '0%';
             aiProgressBar.setAttribute('aria-valuenow', '0');
             aiStatusIndicator.textContent = "INICIALIZACE";
             aiProgressLabel.textContent = "Inicializace // Čekání...";
             currentTextIndex = 0;
             currentProgress = 0;
             if (demoTimeoutId) clearTimeout(demoTimeoutId);
             runAIDemoStep();
         };
        const stopDemo = () => {
             if (!demoIsRunning) return;
             console.log("AI Demo section out of view, stopping simulation.");
             demoIsRunning = false;
             if (demoTimeoutId) clearTimeout(demoTimeoutId);
             aiStatusIndicator.textContent = "POZASTAVENO";
             aiProgressLabel.textContent = "Simulace pozastavena // Posuňte se dolů pro pokračování";
        };
        const demoObserver = new IntersectionObserver((entries) => entries.forEach(entry => { if (entry.isIntersecting) startDemo(); else stopDemo(); }), { threshold: 0.5 });
        if (demoSection) demoObserver.observe(demoSection);
        console.log("AI Demo observer attached.");
    } else console.warn("AI Demo elements or section not found, or demo disabled in config.");

    // --- Event Listeners & Initializations ---
    // [Header, Menu, Mouse, Scroll Anim, Smooth Scroll initializations remain the same]
    // ...
    initializeInfiniteSlider(); // Initialize the slider

    // --- Final Log ---
    console.log("JUSTAX Interface v2.12 Initialization Complete (Simplified Roles - Local Data).");

}); // End DOMContentLoaded