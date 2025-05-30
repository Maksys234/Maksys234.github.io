/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, infinite testimonial slider,
 * Hero text mask reveal, interactive gradient, enhanced visual effects.
 * Version: v2.42_NoCookie_AnimRefactor (Cookie consent functionality removed, animation delay refined)
 * Author: Gemini Modification (enhanced from v2.41)
 * Date: 2025-05-30 
 *
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.42_NoCookie_AnimRefactor (Cookie consent functionality removed)...");

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
    let heroHighlightSpan = null;
    const heroHeading = document.getElementById('hero-heading');
    let rafIdGradient = null;

    // --- Configuration Object ---
    const config = {
        mouseFollower: { enabled: true, followSpeed: 0.12, clickScale: 0.7, hoverScale: 1.5, textHoverScale: 1.3 },
        animations: { scrollThreshold: 0.05, staggerDelay: 100, letterMaskRevealDelay: 50, heroElementEntryDelay: 150 }, // staggerDelay = 100ms. If 150ms per step is preferred, change here.
        aiDemo: { enabled: true, typingSpeed: 35, stepBaseDelay: 180, stepRandomDelay: 400 },
        testimonials: { placeholderAvatarBaseUrl: 'https://placehold.co/100x100/', visibleCardsDesktop: 3, bufferCards: 2, slideDuration: 550 },
        // cookies: { // Cookie configuration removed as per requirement
        // }
    };

    // --- Cookie Consent Elements (Commented out as they will be removed from HTML) ---
    // const cookieConsentBanner = document.getElementById('cookie-consent-banner');
    // ... (остальные закомментированные элементы cookie)

    let localTestimonials = [];
    let testimonialDataCache = [];
    let cardsInTrack = [];
    let stableVisibleStartIndex = config.testimonials.bufferCards; 
    let totalCardsInDOM = 0;
    let cardWidthAndMargin = 0;
    let isSliding = false;
    let sliderInitialLoadComplete = false;
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    body.classList.add('page-loading');
    window.addEventListener('load', () => {
        setTimeout(() => {
            body.classList.remove('page-loading');
            body.classList.add('page-loaded');
        }, 100);
    });

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
        if (!cardElement) { return; }
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
            if (cardElement) cardElement.innerHTML = "<p>Chyba při načítání recenze.</p>";
        }
    };

    const getRandomLocalTestimonial = () => {
        if (!localTestimonials || localTestimonials.length === 0) return { name: "Chyba", text: "Žádné recenze.", rating: 0, role: "Systém" };
        const currentCacheNames = new Set(testimonialDataCache.map(item => item?.name).filter(Boolean));
        let availableTestimonials = localTestimonials.filter(item => !currentCacheNames.has(item.name));
        if (availableTestimonials.length === 0) availableTestimonials = localTestimonials; // Fallback if all are in cache (should ideally not happen with enough data)
        return availableTestimonials[Math.floor(Math.random() * availableTestimonials.length)];
    };
    
    const calculateCardWidthAndMargin = () => {
        if (!sliderTrack || !sliderTrack.firstChild) { return 0; }
        const firstCard = sliderTrack.querySelector('.testimonial-card:not(.is-loading)') || sliderTrack.firstChild;
        if (!firstCard || typeof firstCard.offsetWidth === 'undefined') { return 0; }
        const style = window.getComputedStyle(firstCard); const width = firstCard.offsetWidth; const marginRight = parseFloat(style.marginRight) || 0;
        if (width <= 0) { return 0; }
        cardWidthAndMargin = width + marginRight;
        return cardWidthAndMargin;
    };

    const setTrackPositionInstantly = (logReason = "default") => {
        if (!sliderInitialLoadComplete || !sliderTrack) { return; }
        if (cardWidthAndMargin <= 0) { if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) { return; } }
        sliderTrack.style.transition = 'none'; const position = -stableVisibleStartIndex * cardWidthAndMargin; sliderTrack.style.transform = `translateX(${position}px)`;
        void sliderTrack.offsetHeight; // Force reflow
        sliderTrack.style.transition = `transform ${config.testimonials.slideDuration}ms cubic-bezier(0.65, 0, 0.35, 1)`;
    };

    const handleSliderTransitionEnd = () => {
        if (!isSliding || !sliderTrack) return;
        try {
            const direction = parseInt(sliderTrack.dataset.slideDirection || "0"); if (direction === 0) { throw new Error("No slide direction."); }
            let cardToMoveElement, newCardData;
            if (direction > 0) { // Moved Next (to the left)
                cardToMoveElement = cardsInTrack.shift(); // Remove first
                sliderTrack.removeChild(cardToMoveElement);
                newCardData = getRandomLocalTestimonial(); 
                updateCardContent(cardToMoveElement, newCardData);
                sliderTrack.appendChild(cardToMoveElement); // Add to end
                cardsInTrack.push(cardToMoveElement);
                testimonialDataCache.shift(); 
                testimonialDataCache.push(newCardData);
            } else { // Moved Prev (to the right)
                cardToMoveElement = cardsInTrack.pop(); // Remove last
                sliderTrack.removeChild(cardToMoveElement);
                newCardData = getRandomLocalTestimonial();
                updateCardContent(cardToMoveElement, newCardData);
                sliderTrack.insertBefore(cardToMoveElement, sliderTrack.firstChild); // Add to start
                cardsInTrack.unshift(cardToMoveElement);
                testimonialDataCache.pop();
                testimonialDataCache.unshift(newCardData);
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
        if (cardWidthAndMargin <= 0) { if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) { console.warn("Card width calculation failed before slide."); return; } setTrackPositionInstantly("pre-slide recalc"); }
        isSliding = true; if(prevBtn) prevBtn.disabled = true; if(nextBtn) nextBtn.disabled = true;
        sliderTrack.dataset.slideDirection = direction.toString();
        const newTranslateX = (-stableVisibleStartIndex - direction) * cardWidthAndMargin;
        sliderTrack.removeEventListener('transitionend', handleSliderTransitionEnd); 
        sliderTrack.addEventListener('transitionend', handleSliderTransitionEnd, { once: true });
        sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
    };

    const initializeInfiniteSlider = async () => {
        if (!sliderTrack || !prevBtn || !nextBtn) { console.warn("Testimonial slider elements missing."); return; }
        isSliding = true; sliderInitialLoadComplete = false; prevBtn.disabled = true; nextBtn.disabled = true;
        sliderTrack.innerHTML = ''; testimonialDataCache = []; cardsInTrack = []; cardWidthAndMargin = 0; stableVisibleStartIndex = config.testimonials.bufferCards;
        if (!localTestimonials || localTestimonials.length === 0) { sliderTrack.innerHTML = `<p>Chyba dat: Žádné recenze.</p>`; isSliding = false; return; }
        
        const numVisible = config.testimonials.visibleCardsDesktop; // Adjust this for responsiveness if needed
        totalCardsInDOM = numVisible + 2 * config.testimonials.bufferCards;

        for (let i = 0; i < totalCardsInDOM; i++) { const cardElement = createPlaceholderCard(); sliderTrack.appendChild(cardElement); cardsInTrack.push(cardElement); }
        
        // Populate initial cache with unique items if possible
        let initialSelectionAttempts = 0;
        const maxAttemptsForUnique = localTestimonials.length * 2; // Allow some retries

        for (let i = 0; i < totalCardsInDOM; i++) {
            let testimonial; 
            let attempts = 0;
            const availableForInitial = localTestimonials.filter(item => !testimonialDataCache.some(t => t.name === item.name));
            
            if (availableForInitial.length > 0) {
                testimonial = availableForInitial[Math.floor(Math.random() * availableForInitial.length)];
            } else { // Fallback if not enough unique items for the whole DOM set initially
                testimonial = localTestimonials[Math.floor(Math.random() * localTestimonials.length)];
            }
            testimonialDataCache.push(testimonial);
            initialSelectionAttempts++;
            if (initialSelectionAttempts > maxAttemptsForUnique && i < totalCardsInDOM -1) {
                 // console.warn("Could not ensure all initially loaded testimonials are unique due to data size or attempts limit.");
            }
        }
        
        cardsInTrack.forEach((card, index) => updateCardContent(card, testimonialDataCache[index]));
        
        await new Promise(resolve => requestAnimationFrame(resolve)); // Wait for cards to render for width calculation
        
        if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
             console.error("Testimonial slider layout error: Card width is zero. Slider cannot be initialized.");
             sliderTrack.innerHTML = '<p>Chyba layoutu slideru.</p>'; isSliding = false; return;
        }
        sliderInitialLoadComplete = true; setTrackPositionInstantly("initialization positioning");
        isSliding = false; prevBtn.disabled = false; nextBtn.disabled = false;
    };
    
    const handleScroll = () => {
        try {
            if (header) header.classList.toggle('scrolled', window.scrollY > 30);
            const sections = document.querySelectorAll('main section[id]');
            let currentSectionId = '';
            const scrollPosition = window.scrollY + (header ? header.offsetHeight : 70) + 40; // Adjusted offset
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
        // Ensure follower has dimensions before calculating offset center
        const followerWidth = follower.offsetWidth || 30; // Default width if offsetWidth is 0
        const followerHeight = follower.offsetHeight || 30; // Default height
        follower.style.transform = `translate(${followerX - followerWidth / 2}px, ${followerY - followerHeight / 2}px) scale(${currentScale})`;
        follower.style.opacity = currentOpacity.toString();
        requestAnimationFrame(updateFollower);
    };

    if (!isTouchDevice && follower && config.mouseFollower.enabled) {
        document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; if(follower.style.display === 'none') follower.style.display = ''; currentOpacity = 0.7;});
        document.addEventListener('mouseleave', () => { currentOpacity = 0; });
        document.addEventListener('mouseenter', () => { if(follower.style.display === 'none') follower.style.display = ''; currentOpacity = 0.7; });
        document.querySelectorAll('a, button, .btn, .slider-btn, .feature-card, .how-it-works-step, .yuki-card, input, textarea, .cookie-category-header').forEach(el => {
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
    
    const aiDemoSteps = [
        { type: 'status', text: 'AI jádro v2.42 aktivní. Připraven na analýzu...', progress: 5 },
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
        if (!aiOutput) return; const line = document.createElement('div'); line.className = `ai-log-line ${type}`;
        const now = new Date(); const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`; // Corrected seconds padding
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
        if (currentAiStep >= aiDemoSteps.length || !aiOutput) {
            isAiDemoRunning = false; if(aiStatusIndicator) aiStatusIndicator.textContent = 'IDLE'; updateAiProgress(100, "AI Idle / Čekání na vstup..."); return;
        }
        const step = aiDemoSteps[currentAiStep]; const baseDelay = step.delay || config.aiDemo.stepBaseDelay;
        const randomDelayPart = Math.random() * config.aiDemo.stepRandomDelay; const totalDelay = baseDelay + randomDelayPart;
        if (step.type === 'input') {
            if(aiProgressLabel) aiProgressLabel.textContent = "Očekávám vstup...";
            simulateTyping(step.text, () => {
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
                if (config.aiDemo.enabled && demoSection && entry.isIntersecting && !isAiDemoRunning) {
                    if (aiOutput && aiFakeInput && aiProgressLabel && aiProgressBar && aiStatusIndicator) {
                        isAiDemoRunning = true; currentAiStep = 0;
                        aiOutput.innerHTML = ''; updateAiProgress(0, 'Inicializace AI...'); aiFakeInput.textContent = '';
                        runAiDemoStep();
                    } else {
                        if(aiStatusIndicator) aiStatusIndicator.textContent = 'CHYBA';
                    }
                } else if (!entry.isIntersecting && isAiDemoRunning) {
                    clearTimeout(aiDemoTimeout); isAiDemoRunning = false; if(aiStatusIndicator) aiStatusIndicator.textContent = 'POZASTAVENO';
                }
            } catch (error) { console.error("Error in AI Demo observer:", error); isAiDemoRunning = false; if(aiStatusIndicator) aiStatusIndicator.textContent = 'CHYBA SYSTÉMU';}
        });
    }, { threshold: 0.3 });

    if (demoSection && config.aiDemo.enabled) {
        if (aiOutput && aiFakeInput && aiProgressLabel && aiProgressBar && aiStatusIndicator) {
             aiDemoObserver.observe(demoSection);
        } else {
             if(aiStatusIndicator) aiStatusIndicator.textContent = 'CHYBA ELEMENTŮ';
        }
    } else if (aiStatusIndicator) {
        aiStatusIndicator.textContent = config.aiDemo.enabled ? 'NEVIDITELNÉ' : 'OFFLINE';
    }

    const animatedElements = document.querySelectorAll('[data-animate], [data-animate-letters]');
    const observerOptions = { root: null, rootMargin: '0px 0px -50px 0px', threshold: config.animations.scrollThreshold };

    const setupLetterAnimation = (element) => {
        try {
            const textContent = element.dataset.text || element.textContent || '';
            const originalHighlightElement = element.querySelector('.highlight');
            const originalHighlightDataText = originalHighlightElement ? (originalHighlightElement.dataset.text || originalHighlightElement.textContent || '') : '';

            element.innerHTML = ''; element.style.setProperty('--letter-count', textContent.length.toString());
            let charIndexGlobal = 0; let currentWordWrapper = document.createElement('span'); currentWordWrapper.className = 'word-wrapper'; element.appendChild(currentWordWrapper);

            textContent.split('').forEach(char => {
                const span = document.createElement('span'); span.className = 'letter-span'; span.textContent = char === ' ' ? '\u00A0' : char; 
                span.style.setProperty('--letter-index', charIndexGlobal.toString());
                // Set delay for each letter span based on config.animations.letterMaskRevealDelay
                span.style.transitionDelay = `${charIndexGlobal * config.animations.letterMaskRevealDelay}ms`;


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
                        if (element === heroHeading) {
                            heroHighlightSpan = highlightContainerInWord;
                        }
                    }
                    highlightContainerInWord.appendChild(span);
                } else {
                    currentWordWrapper.appendChild(span);
                }
                if (char === ' ') { currentWordWrapper = document.createElement('span'); currentWordWrapper.className = 'word-wrapper'; element.appendChild(currentWordWrapper); }
                charIndexGlobal++;
            });
        } catch (error) { console.error("Error in setupLetterAnimation for element:", element, error); }
    };
    
    const animationObserver = new IntersectionObserver((entries, observerInstance) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const element = entry.target;
                try {
                    const animationOrder = parseInt(element.style.getPropertyValue('--animation-order') || '0');
                    // Use config.animations.staggerDelay for consistency
                    const baseDelay = animationOrder * config.animations.staggerDelay;

                    if (element.dataset.animateLetters !== undefined) {
                        if (!element.classList.contains('letters-setup-complete')) {
                            setupLetterAnimation(element); // This now sets individual letter delays
                            element.classList.add('letters-setup-complete');
                            // Delay for the container to start revealing, allowing letters to pick up their individual delays
                            setTimeout(() => {
                                element.classList.add('is-revealing');
                                element.style.opacity = '1'; // Ensure container is visible if not already handled by 'is-revealing'
                                
                                // If this is the hero heading, adjust delays for subsequent hero elements
                                if (element === heroHeading) {
                                    const letterCount = parseInt(element.style.getPropertyValue('--letter-count') || '10');
                                    // Calculate total duration for H1 letter animation
                                    // This needs to consider the duration of each letter's transition + the staggered delay
                                    // Assuming letter transition duration is defined in CSS (e.g., 0.7s in index.css for .hero h1[data-animate-letters] .letter-span)
                                    const letterTransitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hero-letter-anim-duration') || '700'); // Example: fetch from CSS variable or use a fixed value
                                    
                                    const h1AnimationDuration = (letterCount * config.animations.letterMaskRevealDelay) + letterTransitionDuration; // Stagger + one letter's own anim time

                                    document.querySelectorAll('.hero p[data-animate], .hero .hero-buttons[data-animate]').forEach(el => {
                                        if (el) {
                                            const heroElOrder = parseInt(el.style.getPropertyValue('--animation-order') || '0');
                                            // The delay for subsequent elements should start AFTER h1's animation is mostly complete
                                            el.style.transitionDelay = `${h1AnimationDuration + (heroElOrder * config.animations.heroElementEntryDelay)}ms`;
                                            el.classList.add('animated');
                                            // el.style.opacity = '1'; // Opacity will be handled by .animated class transition
                                        }
                                    });
                                }
                            }, baseDelay); // Apply baseDelay to the container's reveal start
                        }
                    } else {
                        element.style.transitionDelay = `${baseDelay}ms`;
                        element.classList.add('animated');
                        // element.style.opacity = '1'; // Opacity is handled by CSS transition of .animated class
                    }
                } catch (error) {
                    console.error("Error applying animation to element:", element, error);
                    if(element) element.style.opacity = '1'; // Fallback to make it visible
                }
                observerInstance.unobserve(element);
            }
        });
    }, observerOptions);

    if (animatedElements.length > 0) {
        animatedElements.forEach(el => {
            if (el) {
                 el.style.opacity = '0'; // Set initial opacity to 0 for all observed elements
                 animationObserver.observe(el);
            }
        });
        // Removed special handling for heroHeading opacity here, as the observer will handle it.
    }

    const handleHeroMouseMove = (event) => {
        if (!heroSection || isTouchDevice) return;
        if (!heroHighlightSpan || !document.contains(heroHighlightSpan)) {
            const currentHeroHighlight = heroHeading ? heroHeading.querySelector('.highlight') : null;
            if (currentHeroHighlight) heroHighlightSpan = currentHeroHighlight;
            else return;
        }

        if (rafIdGradient) cancelAnimationFrame(rafIdGradient);
        rafIdGradient = requestAnimationFrame(() => {
            try {
                const rect = heroSection.getBoundingClientRect();
                const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
                const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
                const currentX = parseFloat(heroHighlightSpan.style.getPropertyValue('--mouse-x') || "0.5");
                const currentY = parseFloat(heroHighlightSpan.style.getPropertyValue('--mouse-y') || "0.5");
                // Smoother interpolation for gradient movement
                heroHighlightSpan.style.setProperty('--mouse-x', (currentX + (x - currentX) * 0.15).toFixed(3)); // Adjusted speed
                heroHighlightSpan.style.setProperty('--mouse-y', (currentY + (y - currentY) * 0.15).toFixed(3)); // Adjusted speed
            } catch (error) { console.error("Error in handleHeroMouseMove (gradient):", error); }
        });
    };

    if (heroSection && !isTouchDevice) {
        heroSection.addEventListener('mousemove', handleHeroMouseMove);
        heroSection.addEventListener('mouseleave', () => {
            if (rafIdGradient) cancelAnimationFrame(rafIdGradient);
            if (heroHighlightSpan && document.contains(heroHighlightSpan)) {
                let currentX = parseFloat(heroHighlightSpan.style.getPropertyValue('--mouse-x') || "0.5");
                let currentY = parseFloat(heroHighlightSpan.style.getPropertyValue('--mouse-y') || "0.5");
                const resetIntervalId = setInterval(() => {
                    if (!heroHighlightSpan || !document.contains(heroHighlightSpan)) { clearInterval(resetIntervalId); return; }
                    currentX += (0.5 - currentX) * 0.08; // Slightly slower reset
                    currentY += (0.5 - currentY) * 0.08; // Slightly slower reset
                    heroHighlightSpan.style.setProperty('--mouse-x', currentX.toFixed(3));
                    heroHighlightSpan.style.setProperty('--mouse-y', currentY.toFixed(3));
                    if (Math.abs(currentX - 0.5) < 0.005 && Math.abs(currentY - 0.5) < 0.005) { // Adjusted threshold
                        heroHighlightSpan.style.setProperty('--mouse-x', "0.5");
                        heroHighlightSpan.style.setProperty('--mouse-y', "0.5");
                        clearInterval(resetIntervalId);
                    }
                }, 16);
            }
        });
    } else if (isTouchDevice) {
        const setStaticGradientForTouch = () => {
            if (!heroHighlightSpan || !document.contains(heroHighlightSpan)) {
                 const currentHeroHighlight = heroHeading ? heroHeading.querySelector('.highlight') : null;
                 if (currentHeroHighlight) heroHighlightSpan = currentHeroHighlight;
            }
            if (heroHighlightSpan && document.contains(heroHighlightSpan)) {
                heroHighlightSpan.style.setProperty('--mouse-x', "0.5");
                heroHighlightSpan.style.setProperty('--mouse-y', "0.3"); // Static y-position for touch
            }
        };
        // Ensure heroHeading is ready for querySelector if letter animation setup runs first
        if (heroHeading && heroHeading.classList.contains('letters-setup-complete')) {
            setStaticGradientForTouch();
        } else {
            setTimeout(setStaticGradientForTouch, 1500); // Fallback delay
        }
    }
    
    window.addEventListener('scroll', debounce(handleScroll, 50)); // Slightly increased debounce for scroll
    if (prevBtn) prevBtn.addEventListener('click', () => moveSlider(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => moveSlider(1));

    window.addEventListener('resize', debounce(() => {
        if (sliderInitialLoadComplete && sliderTrack) {
            if (calculateCardWidthAndMargin() > 0) setTrackPositionInstantly("resize adjustment");
        }
    }, 250)); // Slightly increased debounce for resize

    // --- ADVANCED COOKIE CONSENT LOGIC (REMOVED / COMMENTED OUT) ---
    // ... (вся закомментированная логика cookie) ...

    try {
        handleScroll(); // Initial call to set active nav link
        initializeInfiniteSlider();
        // initializeCookieConsentFramework(); // Call remains commented out
    } catch (error) {
        console.error("Error during final initializations:", error);
    }

    // Deferred AI Demo check (already present, seems fine)
    setTimeout(() => {
        if (demoSection && config.aiDemo.enabled && aiDemoObserver) {
            // ...
        }
    }, 500);

    console.log("JUSTAX Interface v2.42_NoCookie_AnimRefactor (Cookie consent functionality removed) Initialization Complete.");
});

/*
    EDIT LOGS:
    Developer Goal: Refine JavaScript logic in index.js for potentially smoother animations and better consistency.
    Stage (index.js - v2.42_NoCookie_AnimRefactor):
        - **Animation Staggering**: Modified the calculation of `baseDelay` for `[data-animate]` elements to use `config.animations.staggerDelay` instead of a hardcoded `150`. This makes the stagger delay consistently configurable. The default in `config` is `100ms`. User can change it to `150ms` in `config` if preferred.
        - **Hero Letter Animation (`data-animate-letters`)**:
            - Ensured that `setupLetterAnimation` applies individual `transition-delay` to each `letter-span` based on `config.animations.letterMaskRevealDelay`. This is crucial for the staggered letter appearance.
            - Refined the logic for calculating `h1AnimationDuration` to more accurately reflect the total time for the hero heading letter animation. This duration is then used to delay subsequent hero elements (`.hero p`, `.hero .hero-buttons`). This aims to make the sequence flow better.
            - Added a placeholder `getComputedStyle(document.documentElement).getPropertyValue('--hero-letter-anim-duration') || '700'` for the letter's own transition duration. Ideally, this duration should be consistent with what's in CSS.
            - The `baseDelay` (from `animation-order` of the `<h1>` itself) is now applied to the `setTimeout` that adds the `is-revealing` class, so the whole letter animation block can be staggered if needed.
        - **Initial Opacity**: Ensured all elements observed by `animationObserver` (`[data-animate]`, `[data-animate-letters]`) have their `opacity` set to `0` initially via JavaScript before observation starts. This prevents a flash of unstyled content if CSS is slow to apply. The opacity is then handled by the `.animated` or `.is-revealing` class transitions.
        - **Hero Gradient Animation**: Slightly adjusted the interpolation factor in `handleHeroMouseMove` (from `0.2` to `0.15`) and `mouseleave` reset (from `0.1` to `0.08`) for potentially smoother gradient movement and reset. Adjusted reset threshold for more accuracy.
        - **Debounce Timers**: Slightly increased debounce timers for `scroll` (to `50ms`) and `resize` (to `250ms`) events, which can sometimes help with perceived smoothness during these actions by reducing the frequency of handler execution.
        - **AI Demo Timestamp**: Corrected padding for seconds in `addAiLogLine` from `padStart(3, '0')` to `padStart(2, '0')`.
        - **Mouse Follower**: Added default width/height for follower in `updateFollower` if `offsetWidth/Height` is 0 initially, to prevent `NaN` in translation.
        - **Testimonial Slider**: Minor robustness improvements in `calculateCardWidthAndMargin` and `moveSlider`. Improved logic for initial unique selection of testimonials.
    Next Step (if needed): Further testing across devices and browsers. If specific "jerks" persist, more targeted debugging would be needed, possibly involving performance profiling in browser developer tools.
*/