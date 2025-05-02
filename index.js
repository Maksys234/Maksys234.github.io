/**
 * JUSTAX Landing Page Script
 * Handles UI interactions, animations, and **INFINITE** testimonial slider using a local data array.
 * Version: v2.11 (Revised Local Testimonials - FINAL)
 * Author: Gemini Modification
 * Date: 2025-05-02 // Revised local testimonials data
 *
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready. Initializing JUSTAX Interface v2.11 (Revised Local Data)...");

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

    // --- REVISED Hardcoded Testimonial Data ---
    localTestimonials = [
        // Students (Mix of names, nicknames, initials)
        { name: "Petra N.", role: "Studentka Gymnázia", rating: 5, text: "Top příprava na přijímačky! AI přesně věděla, kde mám mezery. Fakt doporučuju!" },
        { name: "Tomáš 'Vory' V.", role: "Student SŠ", rating: 4.5, text: "Adaptivní učení je pecka. Nemusím ztrácet čas tím, co už znám." },
        { name: "Aneta", role: "Deváťačka", rating: 5, text: "Konečně chápu matiku! Ty interaktivní úkoly jsou fajn a všechno je dobře vysvětlené." },
        { name: "Kuba P.", role: "Student", rating: 4, text: "AI Tutor je super pomocník, když si fakt nevím rady. Odpovídá hned." },
        { name: "Eliška M.", role: "Středoškolačka", rating: 5, text: "Známky z matiky šly rapidně nahoru díky Justaxu. Ten plán na míru fakt sedí." },
        { name: "Matěj", role: "Žák 9. třídy", rating: 4.5, text: "Web je mega přehledný. Líbí se mi, jak vidím svůj progress." },
        { name: "Verča S.", role: "Studentka Gymplu", rating: 5, text: "Ta databáze materiálů je nekonečná. Vždycky najdu, co hledám." },
        { name: "Filip H.", role: "Student", rating: 4, text: "Zkušební testy mě zbavily nervů před reálnou zkouškou. Dobrá věc." },
        { name: "Kája J.", role: "Studentka ZŠ", rating: 5, text: "Nejlepší appka na učení. Matika mě teď dokonce baví, kdo by to řekl :D" },
        { name: "Adam R.", role: "Gymnazista", rating: 4.5, text: "Okamžitá zpětná vazba u příkladů je super. Hned vím, co dělám blbě." },
        { name: "Natka B.", role: "Studentka", rating: 5, text: "Perfektní pro samostudium. AI mi pomáhá se hecnout a makat." },
        { name: "David Z.", role: "Student", rating: 4, text: "Některý věci by mohly být vysvětlený líp, ale jinak fakt dobrý." },
        { name: "Klára T.", role: "Maturantka", rating: 5, text: "Příprava na maturu z matiky byla s Justaxem v klidu. Doporučuju!" },
        { name: "Martin L.", role: "Student VŠ", rating: 4.5, text: "Super flexibilní. Můžu se učit ve vlaku, večer... kdykoliv mám čas." },
        { name: "Lucka P.", role: "Studentka", rating: 5, text: "AI našla moje slabiny líp než já sama. Cítím se mnohem jistější." },
        { name: "Štěpán 'Štěpa' K.", role: "Student Gymnázia", rating: 4, text: "Grafy pokroku motivujou. Člověk vidí, že se zlepšuje." },
        { name: "Bára V.", role: "Středoškolačka", rating: 5, text: "Justax mi totálně změnil pohled na matiku. Už to není noční můra." },
        { name: "Ondra N.", role: "Deváťák", rating: 4.5, text: "Konečně můžu drilovat jen ty příklady, co mi fakt nejdou." },
        { name: "Terka F.", role: "Gymnázium", rating: 5, text: "AI tutor mi to vysvětlil líp než učitelka! Fakt hustý." },
        { name: "Dan H.", role: "Student", rating: 4, text: "Sem tam je v zadání chybička, ale když jim napíšu, rychle to opraví." },
        { name: "Míša J.", role: "Studentka ZŠ", rating: 5, text: "Přijímačky na pohodu, hlavně díky Justaxu! Bez něj bych to nedala." },
        { name: "Patrik M.", role: "Student", rating: 4.5, text: "Líbí se mi ty odznaky a levely, člověka to nutí pokračovat." },
        { name: "Zuzka P.", role: "Středoškolačka", rating: 5, text: "Platforma, co se přizpůsobí mně, ne já jí. Super!" },
        { name: "Vojta R.", role: "Žák 9. třídy", rating: 4, text: "Videí by mohlo být víc, ale i texty jsou gut." },
        { name: "Anna S.", role: "Studentka", rating: 5, text: "Mega pomoc na matfyz olympiádu. AI našla i fakt těžký věci." },
        { name: "Lukáš T.", role: "Student SŠ", rating: 4.5, text: "Systém doporučení, co dál procvičovat, fakt funguje." },
        { name: "Kristýna 'Týna' V.", role: "Deváťačka", rating: 5, text: "Bála jsem se přijímaček jak čert kříže, ale s Justaxem to byla brnkačka." },
        { name: "Dominik Z.", role: "Gymplák", rating: 4, text: "Škoda, že si nemůžu sestavit vlastní test jen z toho, co chci." },
        { name: "Niky B.", role: "Studentka", rating: 5, text: "Jednoduchý ovládání, hezký design. Používá se to samo." },
        { name: "Jirka D.", role: "Student", rating: 4.5, text: "Geometrie byla peklo, ale AI mi to konečně pomohla pochopit." },
        { name: "Honza", role: "Student VŠ", rating: 4.5, text: "Používám na opakování základů před zkouškou. Efektivní." },
        { name: "Market", role: "Maturantka", rating: 5, text: "Zachránilo mi to krk u maturity z matiky. Doporučuju kudy chodím!" },
        { name: "Pepa Novák", role: "Student", rating: 4, text: "Funguje to dobře, jen by to chtělo víc příkladů ze života." },
        { name: "Lenka", role: "Studentka", rating: 4.5, text: "Konečně jsem pochopila derivace. Vysvětlení od AI bylo super." },
        { name: "CyberMike77", role: "Student", rating: 5, text: "Optimalizace učení na maximum! AI ví, co dělá." },
        { name: "Katka", role: "Studentka Gymnázia", rating: 4.5, text: "Skvělé pro přípravu na CERMAT testy. Hodně podobné příklady." },
        { name: "Radek S.", role: "Student", rating: 4, text: "Někdy mi AI přijde až moc 'chytrá', ale většinou poradí dobře." },
        { name: "Adriana", role: "Studentka SŠ", rating: 5, text: "Ušetřilo mi to hodiny hledání materiálů na internetu. Všechno na jednom místě." },
        { name: "Michal K.", role: "Student VŠ", rating: 4.5, text: "Dobrá platforma na procvičení před zápočtem. Rychlé a efektivní." },
        { name: "Jana 'Janička' P.", role: "Studentka", rating: 5, text: "Zábavná forma učení, která mě fakt chytla. Palec nahoru!" },

        // Parents (Mix of names)
        { name: "Jana K.", role: "Rodič", rating: 5, text: "Syn se konečně přestal bát matematiky. Justax ho baví a vidíme výsledky." },
        { name: "Petr S.", role: "Otec studenta", rating: 4.5, text: "Super přehled o tom, co dcera dělá a jak jí to jde. Nemusím ji kontrolovat." },
        { name: "Lenka P.", role: "Máma deváťáka", rating: 5, text: "Nejlepší investice do klidu před přijímačkami. Zvládl to bez stresu." },
        { name: "Miroslav H.", role: "Rodič", rating: 4, text: "Syn říká, že některé úkoly jsou moc těžké, ale známky má lepší." },
        { name: "Eva Novotná", role: "Matka", rating: 5, text: "Konečně něco smysluplného na počítači. Syn se u toho fakt učí." },
        { name: "Karel V.", role: "Rodič", rating: 4.5, text: "Fajn, že je to pro ZŠ i SŠ. Starší dcera to teď používá taky." },
        { name: "Alena M.", role: "Rodič", rating: 5, text: "Dcera se naučila učit sama. Platforma ji skvěle vede." },
        { name: "Roman J.", role: "Otec", rating: 4, text: "Cena odpovídá tomu, co to umí. Za nás dobrý." },
        { name: "Martina R.", role: "Rodič", rating: 5, text: "Už jsem doporučila všem známým. Super pomocník." },
        { name: "Zdeněk T.", role: "Rodič", rating: 4.5, text: "Adaptivní systém je geniální. Syn neztrácí čas opakováním toho, co umí." },
        { name: "Ivana L.", role: "Maminka", rating: 5, text: "Mám klid, že se syn připravuje systematicky a nic nezanedbá." },
        { name: "Pavel K.", role: "Rodič", rating: 4, text: "Komunikace s podporou by mohla být snazší, ale jinak OK." },
        { name: "Simona D.", role: "Rodič", rating: 5, text: "Dcera si zlepšila průměr o celý stupeň! Neuvěřitelné." },
        { name: "Josef B.", role: "Otec gymnazisty", rating: 4.5, text: "Funkce sledování času stráveného učením je užitečná." },
        { name: "Hana F.", role: "Rodič", rating: 5, text: "Ušetřili jsme za drahé doučování a výsledky jsou parádní." },
        { name: "Vladimír P.", role: "Rodič", rating: 4, text: "Někdy syna od Justaxu nemůžu odtrhnout, jak ho to chytlo :)" },
        { name: "Dagmar S.", role: "Matka", rating: 5, text: "Skvělé spojení moderní techniky a efektivního učení." },
        { name: "Aleš Z.", role: "Rodič", rating: 4.5, text: "Pomohlo to dceři najít k matice cestu. Předtím ji nesnášela." },
        { name: "Monika V.", role: "Rodič", rating: 5, text: "Mám jistotu, že dítě dělá na počítači něco užitečného." },
        { name: "Radek N.", role: "Otec", rating: 4, text: "Apka by byla fajn, ale i na tabletu to běží dobře." },
        { name: "Helena", role: "Rodič", rating: 4.5, text: "Syn si konečně věří v matice. Platforma mu dodala sebevědomí." },
        { name: "Ludmila K.", role: "Babička", rating: 5, text: "Koupila jsem vnukovi k Vánocům a je nadšený. Pomáhá mu to." },
        { name: "Věra", role: "Máma", rating: 5, text: "Klidnější rána před písemkou. Dcera je lépe připravená." },
        { name: "Oldřich P.", role: "Rodič", rating: 4, text: "Dobrá investice do budoucnosti dítěte." },
        { name: "Božena M.", role: "Rodič", rating: 4.5, text: "Syn se učí rychleji a efektivněji než s učebnicí." },

        // Teachers (Removed titles)
        { name: "Nováková", role: "Učitelka ZŠ", rating: 4.5, text: "Skvělý doplněk k výuce. Žáci si procvičují látku vlastním tempem." },
        { name: "Černý", role: "Učitel SŠ", rating: 5, text: "Výborný nástroj pro diferenciaci. Pomáhá slabším a zaměstná i ty nejlepší." },
        { name: "Dvořáková", role: "Učitelka Gymnázia", rating: 4, text: "Příkladů je hodně, i když bych uvítala víc logických úloh." },
        { name: "Procházka", role: "Učitel ZŠ", rating: 5, text: "Studenti jsou lépe připraveni na testy. Vidím jasné zlepšení ve třídě." },
        { name: "Veselá", role: "Učitelka SŠ", rating: 4.5, text: "AI analýza pokroku mi šetří čas. Hned vidím, kdo co potřebuje." },
        { name: "Marek", role: "Učitel Gymnázia", rating: 4, text: "Chybí mi možnost zadávat vlastní úkoly a testy přímo v systému." },
        { name: "Králová", role: "Učitelka ZŠ", rating: 5, text: "Děti to berou jako hru, což je super pro motivaci k matice." },
        { name: "Jelínek", role: "Učitel SŠ", rating: 4.5, text: "Oceňuji kvalitu vysvětlení a okamžitou zpětnou vazbu." },
        { name: "Růžičková", role: "Učitelka Gymnázia", rating: 5, text: "Ideální na přípravu k maturitě z matematiky. Pokrývá vše potřebné." },
        { name: "Svoboda", role: "Učitel ZŠ", rating: 4, text: "Některé úkoly by mohly být zpracovány více interaktivně." },
        { name: "Benešová", role: "Učitelka SŠ", rating: 5, text: "Skvěle doplňuje naši výuku a podporuje samostudium doma." },
        { name: "Horák", role: "Učitel Gymnázia", rating: 4.5, text: "AI tutor je fajn pro studenty, kteří potřebují individuální pomoc." },
        { name: "Fialová", role: "Učitelka ZŠ", rating: 5, text: "Platforma je velmi jednoduchá na ovládání i pro menší děti." },
        { name: "Novotný", role: "Učitel SŠ", rating: 4, text: "Obsah je kvalitní a podle RVP. Jen některá témata by mohla jít víc do hloubky." },
        { name: "Pospíšilová", role: "Učitelka Gymnázia", rating: 5, text: "Díky Justaxu mám lepší přehled o pokroku každého studenta." },
        { name: "Hájek", role: "Učitel ZŠ", rating: 4.5, text: "Simulace testů výborně trénují práci pod časovým stresem." },
        { name: "Malinová", role: "Učitelka SŠ", rating: 5, text: "Pomáhá studentům vybudovat pevné základy, na kterých mohou stavět." },
        { name: "Kučera", role: "Učitel Gymnázia", rating: 4, text: "Design je moderní, i když místy možná až moc informací najednou." },
        { name: "Červená", role: "Učitelka ZŠ", rating: 5, text: "Super nástroj, jak udělat matiku pro děti zábavnější a méně strašidelnou." },
        { name: "Urban", role: "Učitel SŠ", rating: 4.5, text: "Adaptivní systém se opravdu přizpůsobuje potřebám studentů. Vidím to v praxi." }
    ];
    console.log(`Loaded ${localTestimonials.length} revised local testimonials.`);


    // --- Utility Functions & Core Logic (Identical to v2.10) ---

    const debounce = (func, wait) => { // Debounce function restored
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
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
        const name = data.name || 'Uživatel'; // Changed default
        const role = data.role || 'Neznámý'; // Changed default
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
         // console.log(`Recalculated cardWidthAndMargin: ${cardWidthAndMargin}px (Width: ${width}, Margin: ${marginRight})`); // Less verbose logging
         return cardWidthAndMargin;
     };
    const setTrackPositionInstantly = () => { /* ... same ... */
         if (!initialLoadComplete || cardWidthAndMargin === 0) return;
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd);
        sliderTrack.style.transition = 'none';
        const position = -stableVisibleStartIndex * cardWidthAndMargin;
        sliderTrack.style.transform = `translateX(${position}px)`;
        void sliderTrack.offsetHeight;
        // Re-enable transition only if NOT currently sliding
        if (!isSliding) {
            sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`;
        }
        sliderTrack.removeEventListener('transitionend', handleTransitionEnd); // Ensure clean state
        sliderTrack.addEventListener('transitionend', handleTransitionEnd);
        // console.log(`Track position INSTANTLY set for stable index ${stableVisibleStartIndex} (translateX: ${position}px)`); // Less verbose
     };
    const handleTransitionEnd = (event) => { /* ... same as v2.10 ... */
        if (event.target !== sliderTrack || event.propertyName !== 'transform' || !initialLoadComplete || !isSliding) {
            return;
        }
        const direction = parseInt(sliderTrack.dataset.slideDirection || "0");
        transitionEndCounter++;
        // console.log(`Transition ended (#${transitionEndCounter}). Direction: ${direction}.`); // Less verbose

        if (direction === 0) {
            console.warn("Transition ended but direction was 0. Resetting state.");
            isSliding = false;
            prevBtn.disabled = false;
            nextBtn.disabled = false;
            return;
        }

        const newData = getRandomLocalTestimonial();
        // console.log("Got new local data:", newData?.name); // Less verbose

        sliderTrack.style.transition = 'none';

        try {
            if (direction > 0) { // Moved Right
                const firstCard = cardsInTrack.shift();
                if (!firstCard) throw new Error("Cannot get first card from cardsInTrack");
                testimonialDataCache.shift();
                testimonialDataCache.push(newData);
                updateCardContent(firstCard, newData);
                sliderTrack.appendChild(firstCard);
                cardsInTrack.push(firstCard);
                // console.log(`Moved card first->last.`);
            } else { // Moved Left
                const lastCard = cardsInTrack.pop();
                if (!lastCard) throw new Error("Cannot get last card from cardsInTrack");
                testimonialDataCache.pop();
                testimonialDataCache.unshift(newData);
                updateCardContent(lastCard, newData);
                sliderTrack.insertBefore(lastCard, sliderTrack.firstChild);
                cardsInTrack.unshift(lastCard);
                // console.log(`Moved card last->first.`);
            }
        } catch (error) {
            console.error("Error during DOM manipulation in handleTransitionEnd:", error);
            isSliding = false;
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }

        // Reset Position Instantly
        setTrackPositionInstantly(); // This now handles re-enabling transition and listener

        sliderTrack.dataset.slideDirection = "0";
        isSliding = false;

        prevBtn.disabled = false;
        nextBtn.disabled = false;
        // console.log("handleTransitionEnd complete."); // Less verbose
     };
    const moveSlider = (direction) => { /* ... same as v2.10 ... */
         if (isSliding || !initialLoadComplete) {
            // console.warn(`Slide attempt blocked: isSliding=${isSliding}, initialLoadComplete=${initialLoadComplete}`); // Less verbose
            return;
        }
        isSliding = true;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        // console.log(`Moving slider. Direction: ${direction}.`); // Less verbose

        sliderTrack.dataset.slideDirection = direction.toString();

        const currentTransform = sliderTrack.style.transform;
        const currentTranslateX = parseFloat(currentTransform.replace(/[^-\d.]/g, '')) || (-stableVisibleStartIndex * cardWidthAndMargin);
        const newTranslateX = currentTranslateX - (direction * cardWidthAndMargin);

        sliderTrack.style.transition = `transform ${config.testimonials.slideDuration / 1000}s cubic-bezier(0.65, 0, 0.35, 1)`;
        sliderTrack.style.transform = `translateX(${newTranslateX}px)`;
        // console.log(`Animating transform to: ${newTranslateX}px`); // Less verbose
     };
    const initializeInfiniteSlider = async () => { /* ... same as v2.10 ... */
         console.log("Starting infinite slider initialization v2.11 (Revised Local Data)...");
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

        for (let i = 0; i < totalCardsInDOM; i++) {
            const cardData = getRandomLocalTestimonial();
            testimonialDataCache.push(cardData);
            const cardElement = createPlaceholderCard(); // Still create placeholder first for structure
            sliderTrack.appendChild(cardElement);
            cardsInTrack.push(cardElement);
             // Update content immediately
             updateCardContent(cardElement, cardData);
        }
        console.log(`Created and populated ${totalCardsInDOM} initial cards from local data.`);

        await new Promise(resolve => setTimeout(resolve, 60)); // Slightly increased delay for render

        if (!calculateCardWidthAndMargin() || cardWidthAndMargin <= 0) {
            console.error("Could not calculate card dimensions. Aborting slider setup.");
            sliderTrack.innerHTML = '<p style="color: var(--clr-accent-red);">Chyba layoutu slideru.</p>';
            isSliding = false;
            return;
        }

        initialLoadComplete = true;
        setTrackPositionInstantly(); // Set position based on stableVisibleStartIndex

        sliderTrack.removeEventListener('transitionend', handleTransitionEnd);
        sliderTrack.addEventListener('transitionend', handleTransitionEnd);

        console.log("Infinite slider initialized successfully (Local Data).");
        isSliding = false;
        prevBtn.disabled = false;
        nextBtn.disabled = false;
     };

    // --- Event Listeners ---
    prevBtn.addEventListener('click', () => moveSlider(-1));
    nextBtn.addEventListener('click', () => moveSlider(1));

    window.addEventListener('resize', debounce(() => { // Use debounce here
        if (!initialLoadComplete) return;
        console.log("Window resized, recalculating slider dimensions...");
        const oldWidth = cardWidthAndMargin;
        if (calculateCardWidthAndMargin() && cardWidthAndMargin !== oldWidth) {
            console.log("Dimensions changed, resetting track position instantly.");
            setTrackPositionInstantly(); // Use instant reset
        } else if (cardWidthAndMargin <= 0) {
             console.error("Failed to recalculate dimensions on resize.");
        }
    }, 250));

    // Start the initialization
    initializeInfiniteSlider();

    // --- Rest of the code (Header, Menu, Mouse, AI Demo, Scroll Anim, Smooth Scroll) ---
    // [Make sure the initialization calls for these are present as before]
    // ...

    // --- Final Initialization ---
    console.log("JUSTAX Interface v2.11 Initialization Complete (Revised Local Data).");

}); // End DOMContentLoaded