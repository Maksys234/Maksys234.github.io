/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, and **INFINITE** testimonial slider using a local data array.
 * Version: v2.10 (Restored Debounce, Simplified Position Reset - FINAL ATTEMPT)
 * Author: Gemini Modification
 * Date: 2025-05-02 // Final attempt at stabilization
 *
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.10 (Stabilized v2 - Local Data)...");

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

    // --- Hardcoded Testimonial Data ---
    // [Existing ~100 testimonials remain here]
    localTestimonials = [
        { name: "Petra N.", role: "Studentka (Gymnázium)", rating: 5, text: "Skvělá příprava na přijímačky! AI mi přesně ukázala, co potřebuju dohnat. Doporučuji!" },
        { name: "Tomáš V.", role: "Student (SŠ)", rating: 4.5, text: "Adaptivní učení je super. Nemusím procházet to, co už umím. Ušetřilo mi to spoustu času." },
        { name: "Aneta K.", role: "Studentka (9. třída)", rating: 5, text: "Konečně chápu zlomky! Interaktivní cvičení jsou zábavná a vysvětlení jasná." },
        { name: "Jakub P.", role: "Student (Gymnázium)", rating: 4, text: "AI Tutor je fajn, když si nevím rady. Odpovídá rychle a srozumitelně." },
        { name: "Eliška M.", role: "Studentka (SŠ)", rating: 5, text: "Díky Justaxu jsem si výrazně zlepšila známky z matiky. Ten studijní plán na míru fakt funguje." },
        { name: "Matěj D.", role: "Student (9. třída)", rating: 4.5, text: "Platforma je přehledná a dobře se ovládá. Líbí se mi sledování pokroku." },
        { name: "Veronika S.", role: "Studentka (Gymnázium)", rating: 5, text: "Databanka znalostí je obrovská. Vždycky najdu, co potřebuju." },
        { name: "Filip H.", role: "Student (SŠ)", rating: 4, text: "Simulace testů mi pomohly zbavit se stresu před skutečnými zkouškami." },
        { name: "Karolína J.", role: "Studentka (9. třída)", rating: 5, text: "Nejlepší investice do vzdělání. Učení mě teď mnohem víc baví." },
        { name: "Adam R.", role: "Student (Gymnázium)", rating: 4.5, text: "Oceňuji okamžitou zpětnou vazbu u cvičení. Hned vím, kde dělám chybu." },
        { name: "Natálie B.", role: "Studentka (SŠ)", rating: 5, text: "Perfektní nástroj pro samostudium. AI mi pomáhá udržet motivaci." },
        { name: "David Z.", role: "Student (9. třída)", rating: 4, text: "Některá témata by mohla být vysvětlena podrobněji, ale celkově super." },
        { name: "Klára T.", role: "Studentka (Gymnázium)", rating: 5, text: "Příprava na maturitu z matematiky byla s Justaxem hračka. Doporučuji všem!" },
        { name: "Martin L.", role: "Student (SŠ)", rating: 4.5, text: "Flexibilita platformy je úžasná. Můžu se učit kdykoliv a kdekoliv." },
        { name: "Lucie P.", role: "Studentka (9. třída)", rating: 5, text: "AI mi pomohla najít slabiny, o kterých jsem ani nevěděla. Teď se cítím mnohem jistější." },
        { name: "Štěpán K.", role: "Student (Gymnázium)", rating: 4, text: "Grafické znázornění pokroku je motivující. Vidím, jak se zlepšuji." },
        { name: "Barbora V.", role: "Studentka (SŠ)", rating: 5, text: "Justax mi změnil pohled na matematiku. Už to není strašák." },
        { name: "Ondřej N.", role: "Student (9. třída)", rating: 4.5, text: "Super je, že můžu procvičovat konkrétní typy příkladů, které mi nejdou." },
        { name: "Tereza F.", role: "Studentka (Gymnázium)", rating: 5, text: "AI tutor mi vysvětlil složitou látku lépe než ve škole. Neuvěřitelné!" },
        { name: "Daniel H.", role: "Student (SŠ)", rating: 4, text: "Občas narazím na drobnou chybičku v zadání, ale podpora reaguje rychle." },
        { name: "Michaela J.", role: "Studentka (9. třída)", rating: 5, text: "Přijímačky jsem zvládla na jedničku, a to hlavně díky Justaxu!" },
        { name: "Patrik M.", role: "Student (Gymnázium)", rating: 4.5, text: "Líbí se mi gamifikační prvky, odznaky a žebříčky." },
        { name: "Zuzana P.", role: "Studentka (SŠ)", rating: 5, text: "Konečně platforma, která se přizpůsobí mému tempu. Žádný stres." },
        { name: "Vojtěch R.", role: "Student (9. třída)", rating: 4, text: "Mohlo by být více videí s vysvětlením, ale texty jsou kvalitní." },
        { name: "Anna S.", role: "Studentka (Gymnázium)", rating: 5, text: "Neocenitelná pomoc při přípravě na olympiádu. AI našla i pokročilá témata." },
        { name: "Lukáš T.", role: "Student (SŠ)", rating: 4.5, text: "Systém doporučení dalších cvičení je velmi efektivní." },
        { name: "Kristýna V.", role: "Studentka (9. třída)", rating: 5, text: "Měla jsem strach z přijímaček, ale s Justaxem jsem to dala s přehledem." },
        { name: "Dominik Z.", role: "Student (Gymnázium)", rating: 4, text: "Uvítal bych možnost vytvářet si vlastní testy z vybraných okruhů." },
        { name: "Nikola B.", role: "Studentka (SŠ)", rating: 5, text: "Intuitivní ovládání a moderní design. Radost používat." },
        { name: "Jiří D.", role: "Student (9. třída)", rating: 4.5, text: "AI mi pomohla pochopit geometrii, se kterou jsem vždycky bojoval." },
        { name: "Jana K.", role: "Rodič", rating: 5, text: "Syn se výrazně zlepšil v matematice. Platforma ho baví a motivuje." },
        { name: "Petr S.", role: "Rodič", rating: 4.5, text: "Oceňuji přehled o pokroku dcery. Vidím, na čem pracuje a jak jí to jde." },
        { name: "Lenka P.", role: "Rodič", rating: 5, text: "Investice, která se vyplatila. Dcera zvládla přijímačky bez stresu a doučování." },
        { name: "Miroslav H.", role: "Rodič", rating: 4, text: "Syn si občas stěžuje na přílišnou obtížnost některých úkolů, ale zlepšení je vidět." },
        { name: "Eva N.", role: "Rodič", rating: 5, text: "Konečně smysluplně strávený čas u počítače. Justax syna opravdu vzdělává." },
        { name: "Karel V.", role: "Rodič", rating: 4.5, text: "Líbí se mi, že platforma pokrývá látku pro ZŠ i SŠ. Využijeme ji déle." },
        { name: "Alena M.", role: "Rodič", rating: 5, text: "Dcera se učí samostatnosti a zodpovědnosti. Platforma ji vede krok za krokem." },
        { name: "Roman J.", role: "Rodič", rating: 4, text: "Cena je přiměřená kvalitě a rozsahu obsahu. Jsme spokojeni." },
        { name: "Martina R.", role: "Rodič", rating: 5, text: "Doporučila jsem Justax i dalším rodičům. Skvělý pomocník pro přípravu dětí." },
        { name: "Zdeněk T.", role: "Rodič", rating: 4.5, text: "Adaptivní systém je skvělý. Syn neplýtvá časem na to, co už umí." },
        { name: "Ivana L.", role: "Rodič", rating: 5, text: "Máme jistotu, že se syn připravuje systematicky a efektivně." },
        { name: "Pavel K.", role: "Rodič", rating: 4, text: "Uvítali bychom více možností pro komunikaci s podporou přímo v platformě." },
        { name: "Simona D.", role: "Rodič", rating: 5, text: "Dcera si zlepšila průměr o celý stupeň. Jsme nadšení!" },
        { name: "Josef B.", role: "Rodič", rating: 4.5, text: "Sledování času stráveného učením je užitečná funkce." },
        { name: "Hana F.", role: "Rodič", rating: 5, text: "Justax nám ušetřil peníze za drahé doučování. Výsledky jsou skvělé." },
        { name: "Vladimír P.", role: "Rodič", rating: 4, text: "Někdy je těžké syna od platformy odtrhnout, jak ho to baví." },
        { name: "Dagmar S.", role: "Rodič", rating: 5, text: "Perfektní kombinace moderní technologie a efektivního vzdělávání." },
        { name: "Aleš Z.", role: "Rodič", rating: 4.5, text: "Platforma pomohla dceři objevit zájem o matematiku." },
        { name: "Monika V.", role: "Rodič", rating: 5, text: "Bezpečná a kontrolovaná online aktivita pro naše dítě." },
        { name: "Radek N.", role: "Rodič", rating: 4, text: "Mohla by být i mobilní aplikace, ale webová verze funguje dobře i na tabletu." },
        { name: "Mgr. Nováková", role: "Učitelka (ZŠ)", rating: 4.5, text: "Využívám Justax jako doplněk k výuce. Studenti si mohou procvičovat látku svým tempem." },
        { name: "Ing. Černý", role: "Učitel (SŠ)", rating: 5, text: "Skvělý nástroj pro diferenciaci výuky. AI pomáhá slabším studentům a nabízí výzvy těm nadanějším." },
        { name: "Mgr. Dvořáková", role: "Učitelka (Gymnázium)", rating: 4, text: "Databanka příkladů je rozsáhlá, i když bych ocenila více úloh zaměřených na logické myšlení." },
        { name: "Bc. Procházka", role: "Učitel (ZŠ)", rating: 5, text: "Studenti jsou díky Justaxu lépe připraveni na testy. Vidím jasné zlepšení." },
        { name: "Mgr. Veselá", role: "Učitelka (SŠ)", rating: 4.5, text: "AI analýza pokroku jednotlivých studentů mi šetří čas při identifikaci problémových oblastí." },
        { name: "PaedDr. Marek", role: "Učitel (Gymnázium)", rating: 4, text: "Platforma by mohla nabízet více možností pro zadávání vlastních úkolů a testů." },
        { name: "Mgr. Králová", role: "Učitelka (ZŠ)", rating: 5, text: "Studenti vnímají učení přes Justax jako hru, což zvyšuje jejich motivaci." },
        { name: "Ing. Jelínek", role: "Učitel (SŠ)", rating: 4.5, text: "Oceňuji kvalitu vysvětlení a okamžitou zpětnou vazbu, kterou platforma poskytuje." },
        { name: "Mgr. Růžičková", role: "Učitelka (Gymnázium)", rating: 5, text: "Ideální pro přípravu studentů na státní maturitu z matematiky." },
        { name: "Mgr. Svoboda", role: "Učitel (ZŠ)", rating: 4, text: "Některé typy úloh by mohly být interaktivnější." },
        { name: "Mgr. Benešová", role: "Učitelka (SŠ)", rating: 5, text: "Justax skvěle doplňuje prezenční výuku a podporuje samostudium studentů." },
        { name: "Ing. Horák", role: "Učitel (Gymnázium)", rating: 4.5, text: "AI tutor je užitečný pomocník pro studenty, kteří potřebují individuální přístup." },
        { name: "Mgr. Fialová", role: "Učitelka (ZŠ)", rating: 5, text: "Platforma je velmi intuitivní i pro méně technicky zdatné studenty." },
        { name: "Bc. Novotný", role: "Učitel (SŠ)", rating: 4, text: "Obsah je kvalitní a odpovídá RVP. Jen bych přivítal širší pokrytí některých témat." },
        { name: "Mgr. Pospíšilová", role: "Učitelka (Gymnázium)", rating: 5, text: "Díky Justaxu mohu lépe sledovat individuální pokrok každého studenta ve třídě." },
        { name: "Ing. Hájek", role: "Učitel (ZŠ)", rating: 4.5, text: "Simulace testů jsou výborné pro nácvik práce pod časovým tlakem." },
        { name: "Mgr. Malinová", role: "Učitelka (SŠ)", rating: 5, text: "Platforma pomáhá studentům budovat pevné základy v matematice." },
        { name: "PaedDr. Kučera", role: "Učitel (Gymnázium)", rating: 4, text: "Grafické rozhraní je moderní, ale občas může působit trochu zahlcujícím dojmem." },
        { name: "Mgr. Červená", role: "Učitelka (ZŠ)", rating: 5, text: "Justax je skvělý nástroj, jak udělat matematiku pro děti zábavnější a přístupnější." },
        { name: "Ing. Urban", role: "Učitel (SŠ)", rating: 4.5, text: "Adaptivní systém skutečně funguje a přizpůsobuje se potřebám studentů." },
        { name: "Eva H.", role: "Studentka (SŠ)", rating: 4.5, text: "Konečně způsob, jak se učit matiku bez nudných učebnic. Interaktivita je klíč!" },
        { name: "Robert P.", role: "Rodič", rating: 5, text: "Syn si oblíbil AI tutora, ptá se ho na věci, na které se stydí zeptat ve škole." },
        { name: "Mgr. Sedláčková", role: "Učitelka (Gymnázium)", rating: 4.5, text: "Používám pro zadávání dobrovolných domácích úkolů, studenti to vítají." },
        { name: "Adéla N.", role: "Studentka (9. třída)", rating: 5, text: "Přehledné statistiky mi ukázaly, kde přesně ztrácím body. Super!" },
        { name: "Tomáš J.", role: "Student (SŠ)", rating: 4, text: "Někdy AI navrhne příliš těžké úkoly, ale dá se to přeskočit." },
        { name: "Jitka V.", role: "Rodič", rating: 5, text: "Dcera se připravovala na přijímačky jen s Justaxem a dostala se na vysněnou školu." },
        { name: "Filip K.", role: "Student (Gymnázium)", rating: 4.5, text: "Líbí se mi, jak AI vysvětluje postupy řešení krok za krokem." },
        { name: "Denisa M.", role: "Studentka (SŠ)", rating: 5, text: "Učení na maturitu bylo mnohem méně stresující díky plánu od Justaxu." },
        { name: "Václav S.", role: "Rodič", rating: 4.5, text: "Vidím, že syn tráví na platformě čas efektivně, ne jen prokrastinací." },
        { name: "Simona P.", role: "Studentka (9. třída)", rating: 5, text: "Díky procvičování na Justaxu se nebojím žádného testu z matiky." },
        { name: "Marek H.", role: "Student (Gymnázium)", rating: 4, text: "Design je cool, moderní. Příjemné prostředí pro učení." },
        { name: "Gabriela T.", role: "Rodič", rating: 5, text: "Nejlepší online vzdělávací nástroj, jaký jsme pro dceru našli." },
        { name: "Rostislav D.", role: "Student (SŠ)", rating: 4.5, text: "AI mi pomohla pochopit i velmi abstraktní matematické koncepty." },
        { name: "Lenka F.", role: "Studentka (Gymnázium)", rating: 5, text: "Systém odznaků a odměn mě motivuje pokračovat dál." },
        { name: "Stanislav R.", role: "Rodič", rating: 4.5, text: "Syn používá Justax denně a jeho výsledky ve škole jdou nahoru." },
        { name: "Beáta J.", role: "Studentka (SŠ)", rating: 5, text: "Skvělé vysvětlení funkcí a grafů, konečně tomu rozumím!" },
        { name: "Alexandr V.", role: "Student (Gymnázium)", rating: 4, text: "Trochu mi chybí možnost soutěžit s kamarády." },
        { name: "Iveta K.", role: "Rodič", rating: 5, text: "Justax nám ušetřil spoustu času a nervů s domácími úkoly." },
        { name: "Richard N.", role: "Student (SŠ)", rating: 4.5, text: "Platforma funguje spolehlivě, bez technických problémů." },
        { name: "Vendula M.", role: "Studentka (9. třída)", rating: 5, text: "Díky Justaxu jsem si opravila známku z matematiky z trojky na jedničku!" },
        { name: "Dalibor P.", role: "Rodič", rating: 4.5, text: "Líbí se nám podrobná analýza chyb, kterou AI poskytuje." },
        { name: "Sára T.", role: "Studentka (Gymnázium)", rating: 5, text: "Justax je můj hlavní nástroj pro přípravu na matematickou olympiádu." },
        { name: "Bohumil S.", role: "Student (SŠ)", rating: 4, text: "Občas bych uvítal více textových alternativ k videím." },
        { name: "Viktorie H.", role: "Studentka (9. třída)", rating: 5, text: "Neuměla jsem si představit, že mě matika může bavit. Justax to dokázal." },
        { name: "Luděk R.", role: "Rodič", rating: 4.5, text: "Cena za roční předplatné je velmi rozumná vzhledem k možnostem." },
        { name: "Hedvika D.", role: "Studentka (SŠ)", rating: 5, text: "Platforma mi pomohla zorganizovat si učení a dodržovat studijní plán." },
        { name: "Radim J.", role: "Student (Gymnázium)", rating: 4.5, text: "AI je skvělá v identifikaci mých slabých míst a doporučení cvičení." },
        { name: "Alice K.", role: "Studentka (9. třída)", rating: 5, text: "Stoprocentně doporučuji všem, kdo bojují s matematikou!" }
    ];
    console.log(`Loaded ${localTestimonials.length} local testimonials.`);

    // --- Utility Functions & Core Logic ---

    // --- NEW: Added Debounce function back ---
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

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
    const updateCardContent = (cardElement, testimonialData) => { /* ... same ... */
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
        const name = data.name || 'AI Uživatel';
        const role = data.role || 'Student';
        const rating = data.rating;
        const text = data.text || 'Chybí text recenze.';
        if (ratingEl) { ratingEl.innerHTML = generateStarsHTML(rating); ratingEl.setAttribute('aria-label', `Hodnocení: ${rating?.toFixed(1) || 0} z 5 hvězdiček`); }
        if (textEl) textEl.textContent = text;
        if (nameEl) nameEl.textContent = name;
        if (roleEl) roleEl.textContent = role;
        if (avatarEl) { const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '??'; const colors = getRandomColorPair(); const avatarUrl = `${config.testimonials.placeholderAvatarBaseUrl}${colors.bg}/${colors.text}/png?text=${encodeURIComponent(initials)}&font=poppins`; avatarEl.style.backgroundImage = `url('${avatarUrl}')`; avatarEl.setAttribute('aria-label', `Avatar ${name}`); }
    };
    const getRandomLocalTestimonial = () => { /* ... same ... */
        const currentCacheNames = new Set(testimonialDataCache.map(item => item?.name));
        let availableTestimonials = localTestimonials.filter(item => !currentCacheNames.has(item.name));

        // If filtering removed all options (e.g., cache is larger than unique items, unlikely here), use the full list
        if (availableTestimonials.length === 0) {
            console.warn("No unique testimonials available outside the current cache. Falling back to any random item.");
            availableTestimonials = localTestimonials;
        }

        const randomIndex = Math.floor(Math.random() * availableTestimonials.length);
        return availableTestimonials[randomIndex];
    };
    const calculateCardWidthAndMargin = () => { /* ... same ... */
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
                  // console.log(`Recalculated cardWidthAndMargin from placeholder: ${cardWidthAndMargin}px (Width: ${pWidth}, Margin: ${pMarginRight})`);
                  return cardWidthAndMargin;
             }
             return 0;
         }
         const style = window.getComputedStyle(firstCard);
         const width = firstCard.offsetWidth;
         const marginRight = parseFloat(style.marginRight);
         if (width === 0) {
             console.warn("calculateCardWidthAndMargin: First non-loading card has zero width.");
             return 0;
         }
         cardWidthAndMargin = width + marginRight;
         console.log(`Recalculated cardWidthAndMargin: ${cardWidthAndMargin}px (Width: ${width}, Margin: ${marginRight})`);
         return cardWidthAndMargin;
     };

    // --- Simplified and Stabilized Slider Logic ---

    // Sets the track position INSTANTLY based on the stable index
    const setTrackPositionInstantly = () => {
        if (!initialLoadComplete || cardWidthAndMargin === 0) return;

        // Temporarily remove the listener to prevent transitionend firing on instant set
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd);

        sliderTrack.style.transition = 'none'; // Disable animation
        const position = -stableVisibleStartIndex * cardWidthAndMargin;
        sliderTrack.style.transform = `translateX(${position}px)`;
        void sliderTrack.offsetHeight; // Force browser reflow

        // Re-add the listener AFTER the instant position set
        // Use { once: true } maybe? No, need it repeatedly.
        // Ensure no duplicates if somehow added before
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd);
        sliderTrack.addEventListener('transitionend', handleTransitionEnd);

        console.log(`Track position INSTANTLY set for stable index ${stableVisibleStartIndex} (translateX: ${position}px)`);
    };


    // Handles the end of the slide animation
    const handleTransitionEnd = (event) => {
         // Ensure the event fired on the track itself and for the transform property
        if (event.target !== sliderTrack || event.propertyName !== 'transform') {
            return;
        }
        // Prevent handling if slider not ready or if somehow called when not sliding
        if (!initialLoadComplete || !isSliding) {
             console.warn(`handleTransitionEnd skipped: initialLoadComplete=${initialLoadComplete}, isSliding=${isSliding}`);
             return;
        }

        const direction = parseInt(sliderTrack.dataset.slideDirection || "0");
        transitionEndCounter++;
        console.log(`Transition ended (#${transitionEndCounter}). Direction: ${direction}.`);

        if (direction === 0) {
            console.warn("Transition ended but direction was 0. Resetting state.");
            isSliding = false;
            prevBtn.disabled = false;
            nextBtn.disabled = false;
            return;
        }

        // Get the new data (instant from local array)
        const newData = getRandomLocalTestimonial();
        console.log("Got new local data:", newData?.name);

        // --- DOM Manipulation and Cache Update ---
        try {
            if (direction > 0) { // Moved Right (Next)
                const firstCard = cardsInTrack.shift(); // Remove first card from array
                if (!firstCard) throw new Error("Cannot get first card from cardsInTrack");

                testimonialDataCache.shift(); // Remove first data from cache
                testimonialDataCache.push(newData); // Add new data to end of cache
                updateCardContent(firstCard, newData); // Update the card's content BEFORE appending

                sliderTrack.appendChild(firstCard); // Add card to the end of DOM
                cardsInTrack.push(firstCard); // Add card back to the end of array
                console.log(`Moved card first->last.`);

            } else { // Moved Left (Prev)
                const lastCard = cardsInTrack.pop(); // Remove last card from array
                if (!lastCard) throw new Error("Cannot get last card from cardsInTrack");

                testimonialDataCache.pop(); // Remove last data from cache
                testimonialDataCache.unshift(newData); // Add new data to start of cache
                updateCardContent(lastCard, newData); // Update the card's content BEFORE inserting

                sliderTrack.insertBefore(lastCard, sliderTrack.firstChild); // Add card to the beginning of DOM
                cardsInTrack.unshift(lastCard); // Add card back to the beginning of array
                console.log(`Moved card last->first.`);
            }
        } catch (error) {
            console.error("Error during DOM manipulation in handleTransitionEnd:", error);
            // Attempt to recover state? Maybe just log and disable buttons to prevent further errors.
            isSliding = false; // Allow potential recovery attempt? Or keep disabled?
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return; // Stop processing this transition end
        }

        // --- Reset Position Instantly ---
        // After moving cards, reset the track's visual position back to the stable starting point
        setTrackPositionInstantly();

        // --- Finalize ---
        sliderTrack.dataset.slideDirection = "0"; // Reset direction state
        isSliding = false; // Allow next slide

        // Re-enable buttons
        prevBtn.disabled = false;
        nextBtn.disabled = false;
        console.log("handleTransitionEnd complete. Buttons enabled.");
    };


    // Moves the slider track visually
    const moveSlider = (direction) => {
        if (isSliding || !initialLoadComplete) {
            console.warn(`Slide attempt blocked: isSliding=${isSliding}, initialLoadComplete=${initialLoadComplete}`);
            return;
        }
        isSliding = true;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        console.log(`Moving slider. Direction: ${direction}.`);

        // --- Start the visual slide animation ---
        sliderTrack.dataset.slideDirection = direction.toString(); // Store direction

        // Calculate target position based on stable index and direction
        // We slide one card width from the current stable position
        const targetIndex = stableVisibleStartIndex + direction;
        const newTranslateX = -targetIndex * cardWidthAndMargin;

        // Ensure transition is set
        sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`;
        sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
        console.log(`Animating transform to show index ${targetIndex} (translateX: ${newTranslateX}px)`);

        // handleTransitionEnd will fire after animation to reposition and update
    };

    // Initializes the slider using local data
    const initializeInfiniteSlider = async () => {
        console.log("Starting infinite slider initialization v2.10 (Local Data)...");
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
            console.error("Local testimonial data is empty! Cannot initialize slider.");
            sliderTrack.innerHTML = `<p style="color: var(--clr-accent-red);">Chyba: Chybí data pro recenze.</p>`;
             isSliding = false;
            return;
        }

        const numVisible = config.testimonials.visibleCardsDesktop;
        const numBuffer = config.testimonials.bufferCards;
        totalCardsInDOM = numVisible + 2 * numBuffer;

        console.log(`Initial setup: Visible=${numVisible}, Buffer=${numBuffer}, TotalInDOM=${totalCardsInDOM}, StableStartIdx=${stableVisibleStartIndex}`);

        // 1. Create cards and fill cache with initial random data
        for (let i = 0; i < totalCardsInDOM; i++) {
            const cardData = getRandomLocalTestimonial();
            testimonialDataCache.push(cardData);
            const cardElement = createPlaceholderCard();
            sliderTrack.appendChild(cardElement);
            cardsInTrack.push(cardElement);
             // Update content immediately, no need for placeholders if data is local
             updateCardContent(cardElement, cardData);
        }
        console.log(`Created and populated ${totalCardsInDOM} initial cards from local data.`);

        // 2. Calculate dimensions (wait for render)
        // Give browser a moment to render the populated cards
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
        // await new Promise(resolve => requestAnimationFrame(resolve)); // Alternative: wait for next frame

        if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
            console.error("Could not calculate card dimensions. Aborting slider setup.");
            sliderTrack.innerHTML = '<p style="color: var(--clr-accent-red);">Chyba layoutu slideru.</p>';
            isSliding = false;
            return;
        }

        // 3. Set initial position and finalize
        initialLoadComplete = true;
        setTrackPositionInstantly(); // Set position based on stableVisibleStartIndex

        // 4. Add event listener (ensure it's added only once)
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd);
        sliderTrack.addEventListener('transitionend', handleTransitionEnd);

        console.log("Infinite slider initialized successfully (Local Data).");
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
        const oldWidth = cardWidthAndMargin;
        if (calculateCardWidthAndMargin() && cardWidthAndMargin !== oldWidth) {
            console.log("Dimensions changed, resetting track position instantly.");
            // Reset position based on new width and the stable index
            setTrackPositionInstantly();
        } else if (cardWidthAndMargin <= 0) {
             console.error("Failed to recalculate dimensions on resize.");
        }
    }, 250)); // Use the restored debounce function

    // Start the initialization
    initializeInfiniteSlider();


    // --- Final Initialization ---
    console.log("JUSTAX Interface v2.10 Initialization Complete (Stabilized v2 - Local Data).");

}); // End DOMContentLoaded