// Файл: test1-logic.js
// Содержит основную логику для загрузки теста, оценки ответов, сохранения результатов и загрузки уведомлений.
// FIX v2: Улучшено сравнение числовых и текстовых ответов, уточнены инструкции для Gemini.
// FIX v4: Переписана compareTextAdvanced для поиска ключевых слов "ano"/"ne".
// FIX v5: Добавлена проверка уникальности вопросов в loadTestQuestionsLogic и дальнейшее улучшение compareTextAdvanced.
// FIX v6: Усилена нормализация в compareTextAdvanced, добавлена проверка на дубликаты ID при загрузке.
// FIX v7: Отключены вопросы типа 'construction', переделана логика начисления кредитов (awardPointsLogic), еще усилена compareTextAdvanced.
// FIX v8: Переработан checkAnswerWithGeminiLogic для приоритета локального сравнения text/ano_ne, добавлено логгирование типов выбранных вопросов.
// FIX v9: Улучшена числовая компарация в compareNumericAdvanced для большей устойчивости k různým formátům čísel a přidány dodatečné logy pro trasování vyhodnocení.

// Используем IIFE для изоляции области видимости
(function(global) {
    'use strict';

    // --- START: Конфигурация ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    // !!! ВНИМАНИЕ: Ключ API раскрыт в клиентском коде. В продакшене переместите на безопасный бэкенд/переменную окружения!
    const GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // Используйте реальный ключ
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const SCORE_THRESHOLD_FOR_SAVING = 5; // Минимальное количество баллов для сохранения и генерации плана
    const NOTIFICATION_FETCH_LIMIT = 5; // Лимит уведомлений для загрузки
    const NUMERIC_TOLERANCE = 0.001; // Допуск для сравнения чисел с плавающей точкой
    const BASE_POINTS_FOR_100_PERCENT = 30; // Базовое количество кредитов за 100% результат теста

    // --- START: Вспомогательные функции ---
    function shuffleArray(array) {
        // Алгоритм Фишера-Йетса для перемешивания массива
        for (let index = array.length - 1; index > 0; index--) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            // Обмен элементов
            [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
        }
        return array;
    }

    /**
     * Расширенное сравнение числовых значений (v9 - Улучшено парсинг)
     */
     function compareNumericAdvanced(value1, value2, tolerance = NUMERIC_TOLERANCE) {
         console.log(`[compareNumeric v9] Porovnávám (surové): '${value1}' vs '${value2}', tolerance: ${tolerance}`);
         if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) {
             console.log("[compareNumeric v9] Alespoň jedna hodnota je null/undefined. Výsledek: null.");
             return null;
         }

         const normalizeAndEvaluate = (inputValue) => {
             if (typeof inputValue === 'number') { return inputValue; }
             if (typeof inputValue !== 'string') { return NaN; }

             // Krok 1: Předčištění - odstranění běžných nečíselných symbolů na okrajích a normalizace oddělovačů
             let processedString = inputValue.trim()
                 .replace(/\s+/g, '') // Odstraní všechny mezery
                 .replace(/kč|czk|korun|eur|usd|cm|m|km|mm|l|ml|kg|g|%/gi, '') // Odstraní jednotky a %
                 .replace(/[\.,]+$/, '') // Odstraní tečky/čárky na konci, které by mohly být interpunkce
                 .replace(',', '.'); // Normalizuje čárku na tečku

             // Krok 2: Speciální parsery pro zlomky a smíšená čísla
             const fractionRegex = /^(-?)(\d+)\/(\d+)$/; // Např. -3/4, 5/2
             const fractionMatch = processedString.match(fractionRegex);
             if (fractionMatch) {
                 const signMultiplier = fractionMatch[1] === '-' ? -1 : 1;
                 const numerator = parseFloat(fractionMatch[2]);
                 const denominator = parseFloat(fractionMatch[3]);
                 if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                     console.log(`[compareNumeric v9] Parsuji zlomek: ${processedString} -> ${signMultiplier * (numerator / denominator)}`);
                     return signMultiplier * (numerator / denominator);
                 }
             }

             const mixedFractionRegex = /^(-?)(\d+)\s+(\d+)\/(\d+)$/; // Např. -2 1/2 (po odstranění mezer už nebude mít mezeru) - tento regex by už neměl fungovat po .replace(/\s+/g, '')
             // Zkusíme alternativní regex pro smíšená čísla, pokud mezery byly odstraněny (např. 2+1/2 nebo 2a1/2 by mohlo být zadáno)
             // Pro jednoduchost a robustnost se po odstranění mezer spoléháme na float nebo složitější parsery, pokud by bylo potřeba podporovat 2_1/2 formát bez mezer.
             // Současná normalizace to převede na "2.5" pokud je tam tečka, nebo "21/2" pokud je lomítko bez tečky. "21/2" se pak zkusí jako zlomek.

             // Krok 3: Pokus o standardní float parsování
             const floatValue = parseFloat(processedString);
             if (!isNaN(floatValue)) {
                 console.log(`[compareNumeric v9] Parsuji float: '${processedString}' -> ${floatValue}`);
                 return floatValue;
             }

             // Krok 4: Pokud float selže, zkusíme odstranit VŠECHNY nečíselné znaky kromě tečky a znaménka a zkusit znovu (pro případy jako "1,234.56" nebo "číslo: -5")
             let aggressiveProcessedString = inputValue.trim()
                 .replace(/\s+/g, '') // Odstraní všechny mezery
                 .replace(',', '.'); // Normalizuje čárku na tečku

             // Odstranit vše kromě číslic, teček, a znaménka na začátku
             aggressiveProcessedString = aggressiveProcessedString
                .replace(/^[^\d\-+]+/, '') // Remove non-numeric/non-sign at start
                .replace(/[^\d\.]+$/, ''); // Remove non-numeric/non-dot at end

             // Speciální ošetření pro znaménko uprostřed nebo více znamének/teček
             const signMatch = aggressiveProcessedString.match(/[\-+]+\d/);
             if (signMatch && signMatch.index > 0) { aggressiveProcessedString = aggressiveProcessedString.substring(signMatch.index); } // Keep sign if it precedes a digit
             aggressiveProcessedString = aggressiveProcessedString.replace(/[^\d\.\-+]/g, ''); // Remove any remaining invalid chars


             const aggressiveFloatValue = parseFloat(aggressiveProcessedString);
              if (!isNaN(aggressiveFloatValue)) {
                  console.log(`[compareNumeric v9] Parsuji AGRESIVNĚ float: '${aggressiveProcessedString}' -> ${aggressiveFloatValue}`);
                  return aggressiveFloatValue;
              }


             console.warn(`[compareNumeric v9] Nepodařilo se parsovat hodnotu jako číslo: '${inputValue}' (Zpracováno: '${processedString}')`);
             return NaN; // Pokud vše selže
         };

         const number1 = normalizeAndEvaluate(value1);
         const number2 = normalizeAndEvaluate(value2);

         console.log(`[compareNumeric v9] Porovnávám vyhodnocené: ${number1} vs ${number2}`);

         // Pokud se ani jedno nepodařilo parsovat jako číslo, nelze provést číselné srovnání
         if (isNaN(number1) || isNaN(number2)) {
             console.log("[compareNumeric v9] Alespoň jedna vyhodnocená hodnota není platné číslo (NaN). Vracím null.");
             return null;
         }

         const difference = Math.abs(number1 - number2);
         const areEquivalent = difference < tolerance;

         console.log(`[compareNumeric v9] Rozdíl: ${difference}, Tolerance: ${tolerance}, Výsledek: ${areEquivalent}`);
         return areEquivalent;
     }


    /**
     * НОВАЯ ВЕРСИЯ (v8) - Улучшенное сравнение текста для "ano"/"ne" с учетом символов и пробелов.
     */
     /**
      * Pokročilé porovnání textových odpovědí s důrazem na varianty "ano"/"ne".
      * Vylepšeno pro ignorování nadbytečného textu a interpunkce kolem klíčových slov.
      * @param {string|number|null} value1 Uživatelská odpověď.
      * @param {string|number|null} value2 Správná odpověď.
      * @returns {boolean} True, pokud jsou odpovědi ekvivalentní, jinak false.
      */
     function compareTextAdvanced(value1, value2) {
         console.log(`[compareText v8] Porovnávám: '${value1}' vs '${value2}'`);
         if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) {
             console.log("[compareText v8] Alespoň jedna hodnota je null/undefined. Výsledek: false.");
             return false;
         }

         const normalizeAndExtractKeyword = (inputValue) => {
             if (typeof inputValue !== 'string' && typeof inputValue !== 'number') { return null; }
             let processedString = String(inputValue).toLowerCase().trim();

             // Check specifically for "ano" or "ne" allowing variations and surrounding text/punctuation
             // Remove leading/trailing punctuation and whitespace
             processedString = processedString.replace(/^[^a-zčšžřďťňýáíéúů\s]+|[^a-zčšžřďťňýáíéúů\s]+$/g, '');
             processedString = processedString.trim();

             // Use word boundary (\b) to ensure 'ano' matches "ano." but not "vanoce"
             if (/\bano\b/.test(processedString) || processedString === 'a') { return 'ano'; }
             if (/\bne\b/.test(processedString) || processedString === 'n') { return 'ne'; }

             // Fallback to a more general normalization if "ano"/"ne" not found
             processedString = processedString.replace(/\s+/g, ''); // Remove all whitespace
             processedString = processedString.replace(/[^a-zčšžřďťňýáíéúů0-9]/g, ''); // Remove non-alphanumeric (keeping Czech chars)

             console.log(`[compareText v8] Normalizovaná/Extrahovaná klíčová slova: '${processedString}'`);
             return processedString;
         };

         const normalized1 = normalizeAndExtractKeyword(value1);
         const normalized2 = normalizeAndExtractKeyword(value2);

         const areEquivalent = (normalized1 !== null && normalized2 !== null && normalized1 === normalized2 && normalized1 !== ''); // Ensure not empty string match

         console.log(`[compareText v8] Normalizované 1: '${normalized1}', Normalizované 2: '${normalized2}'. Výsledek: ${areEquivalent}`);
         return areEquivalent;
     }
    // --- END: Вспомогательные функции ---

    // --- START: Логика загрузки вопросов ---
    /**
     * Загружает вопросы для теста, обеспечивая уникальность и исключая тип 'construction'.
     */
    async function loadTestQuestionsLogic(supabase, testType, testTypeConfig) {
        if (!supabase) { throw new Error("Supabase client není inicializován."); }
        if (!testType || !testTypeConfig[testType]) { throw new Error(`Neznámý typ testu: ${testType}`); }
        const config = testTypeConfig[testType];
        const questionCount = config.questionsCount;
        console.log(`[Logic v8] Načítání ${questionCount} unikátních otázek (kromě 'construction') pro typ: ${testType}...`);

        // 1. Запрос к базе данных с фильтром
        const { data: allQuestions, error: fetchError } = await supabase
            .from('exam_questions')
            .select(`
                id, question_text, question_type, options, correct_answer,
                solution_explanation, topic_id, subtopic_id, difficulty,
                image_url, source_year, source_exam_type,
                topic:topic_id ( id, name ),
                subtopic:subtopic_id ( id, name )
            `)
            .neq('question_type', 'construction'); // <-- ФИЛЬТР ЗДЕСЬ

        if (fetchError) { throw fetchError; }
        if (!allQuestions || allQuestions.length === 0) { throw new Error("V databázi nejsou žádné otázky (kromě konstrukčních) pro tento test."); }
        console.log(`[Logic v8] Načteno ${allQuestions.length} otázek (před kontrolou duplikátů ID a výběrem).`);

        // --- Проверка на дубликаты ID в исходных данных ---
        const initialIds = allQuestions.map(q => q.id);
        const uniqueInitialIds = new Set(initialIds);
        if (initialIds.length !== uniqueInitialIds.size) { console.warn(`[Logic v8] POZOR: Data načtená z databáze (po filtraci) obsahují ${initialIds.length - uniqueInitialIds.size} duplicitních ID otázek! Zkontrolujte data v tabulce 'exam_questions'.`); }

        // 2. Перемешивание
        const shuffledQuestions = shuffleArray(allQuestions);

        // 3. Выбор уникальных
        const selectedQuestions = [];
        const selectedIds = new Set();
        for (const question of shuffledQuestions) {
            if (selectedQuestions.length >= questionCount) { break; }
            if (question.id !== null && question.id !== undefined && !selectedIds.has(question.id)) {
                selectedIds.add(question.id);
                selectedQuestions.push(question);
            } else if (question.id === null || question.id === undefined) { console.warn("[Logic v8] Přeskakuji otázku bez ID:", question); }
        }

        if (selectedQuestions.length < questionCount) { console.warn(`[Logic v8] Nalezeno pouze ${selectedQuestions.length} unikátních otázek (kromě 'construction'), požadováno ${questionCount}. Používám ${selectedQuestions.length}.`); if (selectedQuestions.length === 0) { throw new Error("Nepodařilo se vybrat žádné unikátní otázky (kromě konstrukčních)."); } }

        // 4. Форматирование
        const formattedQuestions = selectedQuestions.map((question, index) => ({
            id: question.id, question_number: index + 1, question_text: question.question_text, question_type: question.question_type, options: question.options, correct_answer: question.correct_answer, solution_explanation: question.solution_explanation || "Oficiální postup není k dispozici.", topic_id: question.topic_id, topic_name: question.topic ? question.topic.name : "Neznámé téma", subtopic_id: question.subtopic_id, subtopic_name: question.subtopic ? question.subtopic.name : "", difficulty: question.difficulty, image_url: question.image_url, source_year: question.source_year, source_exam_type: question.source_exam_type
        }));

        // --- ЛОГГИРОВАНИЕ ТИПОВ ВЫБРАННЫХ ВОПРОСОВ ---
        const selectedTypes = formattedQuestions.map(q => q.question_type);
        console.log(`[Logic v8] Typy vybraných ${formattedQuestions.length} otázek:`, selectedTypes);
        if (selectedTypes.includes('construction')) { console.error("[Logic v8] KRITICKÁ CHYBA: Otázka typu 'construction' pronikla do finálního výběru navzdory filtru!"); }
        // --- КОНЕЦ ЛОГГИРОВАНИЯ ---


        console.log(`[Logic v8] Vybráno ${formattedQuestions.length} unikátních otázek (bez 'construction').`);
        return formattedQuestions;
    }
    // --- END: Логика загрузки вопросов ---

    // --- START: Логика оценки ответов (Gemini) ---
    /**
     * НОВАЯ ЛОГИКА (v9): Приоритет локального сравнения для text/ano_ne и улучшенное числовое сравнение.
     */
    async function checkAnswerWithGeminiLogic(questionType, questionText, correctAnswerOrExplanation, userAnswer, maxScore = 1, currentQuestionIndex) {
        // Пропускаем 'construction' сразу
        if (questionType === 'construction') {
            console.warn(`[Logic Check v9] Otázka typu 'construction' (ID: ${currentQuestionIndex+1}) detekována. Vracím 'skipped'.`);
            return { score: 0, max_score: maxScore, correctness: "skipped", reasoning: "Konstrukční úlohy jsou dočasně přeskočeny.", error_analysis: null, feedback: null, is_equivalent: null };
        }

         console.log(`--- [Logic v9] Vyhodnocování Q#${currentQuestionIndex + 1} (Typ: ${questionType}, Max bodů: ${maxScore}) ---`);
         console.log(`   Otázka: ${questionText ? questionText.substring(0, 100) + '...' : 'N/A'}`);
         console.log(`   Správně: `, correctAnswerOrExplanation);
         console.log(`   Uživatel: `, userAnswer);

         // Базовый результат, если ответ пустой
         if (userAnswer === null || userAnswer === undefined || String(userAnswer).trim() === "") {
             console.log("   Odpověď prázdná. Vracím výchozí výsledek (skipped).");
             return { score: 0, max_score: maxScore, correctness: "skipped", reasoning: "Odpověď nebyla poskytnuta nebo je prázdná.", error_analysis: null, feedback: "Příště zkuste odpovědět.", is_equivalent: null };
         }

         // --- Локальное сравнение для text, numeric и ano_ne ---
         // Приоритет локального сравнения для text/ano_ne и numeric
         if (['text', 'numeric', 'ano_ne'].includes(questionType)) {
             console.log(`[Logic v9 Q#${currentQuestionIndex + 1}] Provádím lokální srovnání pro typ '${questionType}'...`);
             const numericCheck = compareNumericAdvanced(userAnswer, correctAnswerOrExplanation);
             const textCheck = compareTextAdvanced(userAnswer, correctAnswerOrExplanation); // Používá v8 logiku pro ano/ne a text

             let localComparisonResult = null; // true = shoda, false = neshoda, null = nelze lokálně určit

             if (questionType === 'numeric') {
                 if (numericCheck !== null) { // compareNumericAdvanced vrátí null jen pokud nelze parsovat ani jedno
                     localComparisonResult = numericCheck;
                     console.log(`[Logic v9 Q#${currentQuestionIndex + 1}] Lokální NUMERICKÉ srovnání: ${localComparisonResult}`);
                 } else {
                     console.log(`[Logic v9 Q#${currentQuestionIndex + 1}] Lokální NUMERICKÉ srovnání: NELZE PROVÉST.`);
                 }
             } else if (questionType === 'text' || questionType === 'ano_ne') {
                  if (textCheck !== null) { // compareTextAdvanced vrátí null jen pokud nelze parsovat ani jedno
                     localComparisonResult = textCheck;
                     console.log(`[Logic v9 Q#${currentQuestionIndex + 1}] Lokální TEXTOVÉ/ANO-NE srovnání: ${localComparisonResult}`);
                 } else {
                      console.log(`[Logic v9 Q#${currentQuestionIndex + 1}] Lokální TEXTOVÉ/ANO-NE srovnání: NELZE PROVÉST.`);
                 }
             }

             // Pokud lokální srovnání dalo JEDNOZNAČNÝ výsledek (true nebo false)
             if (localComparisonResult !== null) {
                 console.log(`[Logic v9 Q#${currentQuestionIndex + 1}] Lokální srovnání je JEDNOZNAČNÉ. Vracím výsledek bez Gemini.`);
                 const finalCorrectness = localComparisonResult ? 'correct' : 'incorrect';
                 const finalScore = localComparisonResult ? maxScore : 0;
                 const finalReasoning = localComparisonResult ? "Odpověď je správná." : "Odpověď není správná."; // Základní zdůvodnění
                 const finalErrorAnalysis = localComparisonResult ? null : `Odpověď '${userAnswer}' se neshoduje se správnou odpovědí '${correctAnswerOrExplanation}'.`;
                 const finalFeedback = localComparisonResult ? null : "Zkontrolujte svůj výpočet/odpověď.";

                 return {
                     score: finalScore,
                     max_score: maxScore,
                     correctness: finalCorrectness,
                     reasoning: finalReasoning,
                     error_analysis: finalErrorAnalysis,
                     feedback: finalFeedback,
                     is_equivalent: localComparisonResult // is_equivalent je stejné jako výsledek lokálního srovnání
                 };
             } else {
                  console.log(`[Logic v9 Q#${currentQuestionIndex + 1}] Lokální srovnání NENÍ JEDNOZNAČNÉ (nebo nelze provést). Pokračuji s Gemini.`);
             }
         }
          // Pro 'multiple_choice' VŽDY použijeme Fallback, pokud není lokálně zkontrolováno výše
          // Pro ostatní typy ('text', 'numeric', 'ano_ne'), pokud lokální srovnání selhalo, použijeme Gemini.


         // --- Fallback логика (если Gemini сбойнет ИЛИ для multiple_choice) ---
         const runFallbackCheck = (fallbackReason = "Automatické hodnocení selhalo. Použita záložní kontrola.") => {
             console.warn("!!! [Logic Fallback v9] Používá se FALLBACK logika pro vyhodnocení !!! Důvod:", fallbackReason);
             let fallbackScore = 0;
             let fallbackCorrectness = "incorrect";
             let fallbackErrorAnalysis = "Chyba systému hodnocení.";
             let feedback = "Kontaktujte podporu, pokud problém přetrvává.";
             let isEquivalent = null;

             // Pro Multiple choice zkusíme základní porovnání písmen
             if (questionType === 'multiple_choice') {
                 try {
                     const correctLetter = String(correctAnswerOrExplanation).trim().toUpperCase().charAt(0);
                     const userLetter = String(userAnswer).trim().toUpperCase().charAt(0);
                     isEquivalent = correctLetter === userLetter;
                     fallbackCorrectness = isEquivalent ? "correct" : "incorrect";
                     fallbackScore = isEquivalent ? maxScore : 0;
                     fallbackReason = isEquivalent ? "Záložní hodnocení: Písmeno odpovědi se shoduje." : "Záložní hodnocení: Písmeno odpovědi se neshoduje.";
                     feedback = isEquivalent ? null : "Zkontrolujte, zda jste vybrali správné písmeno.";
                 } catch (e) {
                     console.error("[Logic Fallback v9] Chyba při fallback MC porovnání:", e);
                     fallbackCorrectness = "error";
                     fallbackReason = "Chyba při záložním hodnocení MC.";
                     feedback = "Kontaktujte podporu.";
                 }
             } else {
                  // Pro ostatní typy, pokud jsme zde, znamená to, že lokální srovnání selhalo/bylo nejednoznačné
                  // Nemůžeme spolehlivě určit správnost bez Gemini, takže vracíme 'error'
                  fallbackCorrectness = "error";
                  fallbackReason = fallbackReason; // Použijeme důvod, proč jsme ve fallbacku
                  feedback = "Hodnocení selhalo. Zkuste to znovu nebo kontaktujte podporu.";
             }

             console.log(`[Logic Fallback v9 Výsledek] Skóre: ${fallbackScore}/${maxScore}, Správnost: ${fallbackCorrectness}, Ekvivalent: ${isEquivalent}`);
             return { score: fallbackScore, max_score: maxScore, correctness: fallbackCorrectness, reasoning: fallbackReason, error_analysis: fallbackErrorAnalysis, feedback: feedback, is_equivalent: isEquivalent };
         };


         // Проверка API ключа - pokud jsme zde, znamená to, že lokální srovnání nebylo jednoznačné nebo je to MC
         if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR_') || GEMINI_API_KEY.length < 10) {
             console.warn("[Logic Gemini v9] Chybí platný Gemini API klíč. Používám fallback.");
             return runFallbackCheck("Chybí API klíč.");
         }

         // --- Формирование промпта для Gemini ---
         let prompt;
         // Инструкции для Gemini - акцент на гибкость и формат JSON
         const baseInstruction = `Jsi PŘÍSNÝ, DETAILNÍ a PŘESNÝ AI hodnotitel odpovědí z PŘIJÍMACÍCH ZKOUŠEK z matematiky/logiky pro 9. třídu ZŠ v ČR. Tvým úkolem je KOMPLEXNĚ posoudit odpověď studenta vůči správnému řešení/odpovědi v kontextu dané otázky. MUSÍŠ vrátit POUZE JSON objekt podle PŘESNĚ definované struktury. NEPŘIDÁVEJ žádný text PŘED nebo ZA JSON blok. Buď si VĚDOM toho, že odpovědi mohou být MATEMATICKY ekvivalentní i přes jiný formát (např. zlomek vs. desetinné číslo, různé formáty zápisu výrazů). Pro textové odpovědi (včetně ano/ne) buď tolerantní k interpunkci a mezerám, ale jádru odpovědi.`;
         const outputStructure = `{ "score": number (0-${maxScore}, celé číslo), "max_score": ${maxScore}, "correctness": string ("correct" | "incorrect" | "partial"), "reasoning": string (DETAILNÍ zdůvodnění skóre a vysvětlení správného postupu/odpovědi v ČEŠTINĚ, včetně uznání ekvivalentních formátů), "error_analysis": string | null (KONKRÉTNÍ popis chyby studenta v ČEŠTINĚ - např. "chyba ve výpočtu", "nepochopení pojmu", "špatný vzorec", "chybějící krok", "formální chyba", "odpověď je matematicky správná, ale formát neodpovídá"; null pokud správně), "feedback": string | null (Krátká konstruktivní rada pro studenta v ČEŠTINĚ, na co si dát pozor nebo co procvičit; null pokud správně), "is_equivalent": boolean | null (Pouze pro typy 'numeric', 'text', 'ano_ne'. True, pokud je odpověď uživatele matematicky/logicky správná i přes jiný formát. False pokud je nesprávná. Null pro 'multiple_choice' nebo pokud nelze určit.) }`; // Přidán typ partial a is_equivalent

         const questionContext = `Kontext otázky: """${questionText}"""`;
         const inputData = `SPRÁVNÁ ODPOVĚĎ/ŘEŠENÍ: """${correctAnswerOrExplanation}"""\nODPOVĚĎ STUDENTA: """${userAnswer}"""`;

         if (questionType === 'multiple_choice') {
             // Pro MC primárně porovnáme písmeno. Gemini požádáme o zdůvodnění správné a chybné odpovědi.
             prompt = `${baseInstruction} Typ otázky: Výběr z možností. Maximální skóre: ${maxScore}. ${questionContext} PRAVIDLA: Porovnej POUZE PÍSMENO na začátku odpovědi studenta (case-insensitive) se správným písmenem. Ignoruj text za písmenem. SKÓRE: ${maxScore} bodů (correct) POKUD se normalizované písmeno shoduje, jinak 0 (incorrect). "is_equivalent" by mělo být null. Zdůvodnění: Uveď správné písmeno a proč je daná možnost správná (stručně). Pokud je odpověď špatně, uveď i proč je špatně. Error Analysis: Pokud špatně, uveď "vybrána nesprávná možnost". Feedback: Pokud špatně, navrhni "pečlivě číst všechny možnosti" nebo podobně. ${inputData} ÚKOL: Vrať POUZE JSON objekt podle této struktury: ${outputStructure}`;
         } else { // numeric, text, ano_ne - zde Gemini potřebujeme pro komplexnější posouzení než lokální srovnání
             prompt = `${baseInstruction} Typ otázky: ${questionType === 'ano_ne' ? 'Ano/Ne' : (questionType === 'numeric' ? 'Numerická/Výpočetní' : 'Textová/Symbolická')}. Maximální skóre: ${maxScore}. ${questionContext} PRAVIDLA:
1.  **Ekvivalence (is_equivalent):** NEJDŘÍVE posuď, zda je odpověď studenta MATEMATICKY/LOGICKY ekvivalentní správné odpovědi, i když formát může být jiný. Buď FLEXIBILNÍ:
    * Numerické: Uznávej desetinná čísla vs. zlomky (např. "-1.1" == "-11/10"), toleruj drobné rozdíly v zaokrouhlení (např. 3.14 vs 3.141), ignoruj jednotky, pokud nejsou explicitně požadovány.
    * Ano/Ne: Porovnávej case-insensitive "ano"/"ne", ignoruj případné úvodní znaky (např. "A. ano" == "ano").
    * Text/Symbolické: Buď přísnější, ale ignoruj velká/malá písmena a mezery na začátku/konci.
    * Nastav "is_equivalent" na true/false.
2.  **Skóre a Správnost:** ${maxScore} bodů (correct) POKUD is_equivalent=true. 0 bodů (incorrect) POKUD is_equivalent=false. Nelze udělit částečné skóre ("partial").
3.  **Zdůvodnění:** Vysvětli, PROČ je/není odpověď správná a jaký je správný výsledek/postup. VŽDY ZMIŇ, zda byla odpověď uznána jako ekvivalentní i přes jiný formát.
4.  **Error Analysis:** Pokud incorrect, KONKRÉTNĚ popiš chybu (např. "chyba ve výpočtu", "nesprávná odpověď ano/ne", "špatná jednotka", "formální chyba"). Pokud je odpověď matematicky správná, ale formátově špatná (a is_equivalent=true), uveď "formální chyba" nebo "neshodný formát".
5.  **Feedback:** Pokud incorrect, navrhni co zlepšit (např. "zkontrolovat znaménka", "převádět jednotky", "dbát na formát odpovědi"). Pokud correct, ale jiný formát, můžeš dát tip "příště použijte formát X".
${inputData}
ÚKOL: Pečlivě posuď ekvivalenci a správnost. Vrať POUZE JSON objekt podle této struktury: ${outputStructure}`;
         }

         // --- Вызов API Gemini и обработка ответа ---
         try {
             console.log(`[Logic Gemini Call v9 Q#${currentQuestionIndex + 1}] Posílám požadavek do Gemini API...`);
             const response = await fetch(GEMINI_API_URL, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     contents: [{ parts: [{ text: prompt }] }],
                     generationConfig: { temperature: 0.1 }, // Nízká teplota pro přesnost
                     safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ]
                 })
             });

             if (!response.ok) { const errorBody = await response.text(); console.error(`[Logic Gemini Call v9 Q#${currentQuestionIndex + 1}] Chyba API (${response.status}):`, errorBody); throw new Error(`Chyba Gemini API (${response.status})`); }
             const data = await response.json();
             console.log(`[Logic Gemini Call v9 Q#${currentQuestionIndex + 1}] Surová odpověď:`, JSON.stringify(data));
             if (data.promptFeedback?.blockReason) { throw new Error(`Požadavek blokován AI filtrem: ${data.promptFeedback.blockReason}.`); }
             const candidate = data.candidates?.[0];
             if (!candidate) {
                  const finishReason = data.candidates?.[0]?.finishReason;
                 throw new Error(`AI neposkytlo kandidáta odpovědi. Důvod: ${finishReason || 'Neznámý'}.`);
             }
             if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) { console.warn(`[Logic Gemini Call v9 Q#${currentQuestionIndex + 1}] Finish Reason: ${candidate.finishReason}.`); if (candidate.finishReason === 'SAFETY') throw new Error('Odpověď blokována bezpečnostním filtrem AI.'); if (!candidate.content?.parts?.[0]?.text) { throw new Error(`Generování zastaveno: ${candidate.finishReason}.`); } }
             let resultJsonText = candidate.content?.parts?.[0]?.text;
             if (!resultJsonText) { throw new Error('AI vrátilo prázdnou odpověď.'); }
             // Najdeme JSON blok
             const jsonMatch = resultJsonText.match(/```json\s*([\s\S]*?)\s*```/);
             if (jsonMatch && jsonMatch[1]) { resultJsonText = jsonMatch[1]; }
             console.log(`[Logic Gemini Call v9 Q#${currentQuestionIndex + 1}] Získaný text JSON (po očištění):`, resultJsonText);

             try {
                 const geminiResult = JSON.parse(resultJsonText);
                 console.log(`[Logic Gemini Call v9 Q#${currentQuestionIndex + 1}] Parsovaný výsledek JSON:`, geminiResult);

                 // --- Validace a určení finálního výsledku z Gemini ---
                 let finalScore = 0;
                 let finalCorrectness = "incorrect"; // Výchozí stav
                 let finalIsEquivalent = typeof geminiResult.is_equivalent === 'boolean' ? geminiResult.is_equivalent : null;

                 // Základní validace povinných polí z Gemini
                 if (typeof geminiResult.score !== 'number' || typeof geminiResult.correctness !== 'string' || typeof geminiResult.reasoning !== 'string') {
                      console.warn(`[Logic Gemini Call v9 Q#${currentQuestionIndex + 1}] Chybí povinné klíče v JSON od Gemini. Používám fallback.`);
                      return runFallbackCheck("Neúplná odpověď od AI.");
                 }

                 // Určení skóre a správnosti na základě Geminiho hodnocení
                 const geminiScore = Math.round(geminiResult.score);
                 if (geminiScore < 0 || geminiScore > maxScore) {
                      console.warn(`[Logic Gemini Call v9 Q#${currentQuestionIndex + 1}] Neplatné skóre ${geminiScore} od Gemini (mimo rozsah). Používám fallback.`);
                      return runFallbackCheck("Neplatné skóre od AI.");
                 }

                 finalScore = geminiScore;
                 finalCorrectness = ["correct", "incorrect", "partial"].includes(geminiResult.correctness) ? geminiResult.correctness : "incorrect"; // Povolíme partial

                 // Dodatečná kontrola is_equivalent vs correctness (priorita is_equivalent pro binary ano/ne/numeric/text)
                 if (finalIsEquivalent !== null) {
                      if (finalIsEquivalent === true && finalCorrectness !== "correct") {
                          console.warn(`[Logic Gemini v9] Oprava 'correctness' na základě Gemini is_equivalent=true: původní ${finalCorrectness} -> 'correct'.`);
                          finalCorrectness = "correct";
                          finalScore = maxScore; // Pokud ekvivalentní, plné body
                      } else if (finalIsEquivalent === false && finalCorrectness === "correct") {
                          console.warn(`[Logic Gemini v9] Oprava 'correctness' na základě Gemini is_equivalent=false: původní ${finalCorrectness} -> 'incorrect'.`);
                          finalCorrectness = "incorrect";
                          finalScore = 0;
                      }
                 }

                 // Pro multiple_choice is_equivalent by mělo být null. Pokud není, ignorujeme ho.
                 if (questionType === 'multiple_choice' && finalIsEquivalent !== null) {
                      console.warn(`[Logic Gemini v9] Ignoruji is_equivalent pro multiple_choice typ.`);
                      finalIsEquivalent = null;
                 }


                 // --- Sestavení finálního výsledku ---
                 const finalResult = {
                     score: finalScore,
                     max_score: maxScore,
                     correctness: finalCorrectness,
                     reasoning: geminiResult.reasoning || "Nebylo poskytnuto žádné zdůvodnění.",
                     error_analysis: geminiResult.error_analysis || null,
                     feedback: geminiResult.feedback || null,
                     is_equivalent: finalIsEquivalent
                 };
                 console.log(`[Logic Gemini Call v9 Q#${currentQuestionIndex + 1}] Finální výsledek z Gemini:`, finalResult);
                 return finalResult;

             } catch (parseError) {
                 console.error(`[Logic Gemini Call v9 Q#${currentQuestionIndex + 1}] Nepodařilo se parsovat JSON:`, parseError, "Surová odpověď Gemini:", resultJsonText);
                 return runFallbackCheck("Chyba při zpracování odpovědi AI.");
             }
         } catch (apiError) {
             console.error(`[Logic Gemini Call v9 Q#${currentQuestionIndex + 1}] Selhalo volání API:`, apiError);
             return runFallbackCheck("Chyba komunikace s AI.");
         }
         // --- Конец Вызова API Gemini ---
     }

    // --- START: Логика расчета и сохранения результатов ---
    function calculateFinalResultsLogic(userAnswers, questions) {
        // ... (код этой функции остается без изменений, как в v7/v8) ...
         let totalRawPointsAchieved = 0; let totalRawMaxPossiblePoints = 0; let correctCount = 0; let incorrectCount = 0; let partialCount = 0; let skippedCount = 0; let topicStats = {};
        userAnswers.forEach((answer, index) => {
            if (!answer) { console.warn(`[Logic Calc v8] Chybí data odpovědi pro index ${index}.`); skippedCount++; return; }
            const topicKey = answer.topic_id || answer.topic_name || 'unknown'; const topicName = answer.topic_name || 'Neznámé téma';
            if (!topicStats[topicKey]) { topicStats[topicKey] = { name: topicName, id: answer.topic_id, total_questions: 0, fully_correct: 0, points_achieved: 0, max_points: 0, score_percent: 0, strength: 'neutral' }; }
            topicStats[topicKey].total_questions++; topicStats[topicKey].max_points += answer.maxScore; totalRawMaxPossiblePoints += answer.maxScore;
            if (answer.correctness === "skipped") { skippedCount++; }
            else if (answer.correctness === "error") { incorrectCount++; } // Chyba hodnocení se počítá jako incorrect pro účely sumáře
            else { const awardedScore = answer.scoreAwarded ?? 0; totalRawPointsAchieved += awardedScore; topicStats[topicKey].points_achieved += awardedScore; if (answer.correctness === "correct") { correctCount++; topicStats[topicKey].fully_correct++; } else if (answer.correctness === "partial") { partialCount++; } else { incorrectCount++; } }
        });
        Object.values(topicStats).forEach(stats => { stats.score_percent = stats.max_points > 0 ? Math.round((stats.points_achieved / stats.max_points) * 100) : 0; stats.strength = stats.score_percent >= 75 ? 'strength' : (stats.score_percent < 50 ? 'weakness' : 'neutral'); });
        const totalApplicableQuestions = questions.length - skippedCount; const finalPercentage = totalRawMaxPossiblePoints > 0 ? Math.round((totalRawPointsAchieved / totalRawMaxPossiblePoints) * 100) : 0; // Procento počítáme z bodů
        const finalScoreOutOf50 = totalRawMaxPossiblePoints > 0 ? Math.round((totalRawPointsAchieved / totalRawMaxPossiblePoints) * 50) : 0;
        const resultsData = { totalQuestions: questions.length, correctAnswers: correctCount, incorrectAnswers: incorrectCount, partiallyCorrectAnswers: partialCount, skippedAnswers: skippedCount, evaluationErrors: userAnswers.filter(a => a?.correctness === 'error').length, score: finalScoreOutOf50, totalPointsAchieved: totalRawPointsAchieved, totalMaxPossiblePoints: totalRawMaxPossiblePoints, percentage: finalPercentage, topicResults: topicStats, timeSpent: null }; // Time is added in UI
        console.log("[Logic Calc v8] Finální výsledky vypočítány:", resultsData); return resultsData;
    }

    function generateDetailedAnalysisLogic(results, answers, questionsData) {
        // ... (код этой функции остается без изменений, как в v7/v8) ...
        const analysis = { summary: { score: results.score, total_points_achieved: results.totalPointsAchieved, total_max_possible_points: results.totalMaxPossiblePoints, percentage: results.percentage, time_spent_seconds: results.timeSpent, total_questions: results.totalQuestions, correct: results.correctAnswers, incorrect: results.incorrectAnswers, partial: results.partiallyCorrectAnswers, skipped: results.skippedAnswers, evaluation_errors: results.evaluationErrors, }, strengths: [], weaknesses: [], performance_by_topic: {}, performance_by_type: {}, performance_by_difficulty: {}, incorrectly_answered_details: [] };
        for (const [topicKey, stats] of Object.entries(results.topicResults || {})) { analysis.performance_by_topic[stats.name] = { points_achieved: stats.points_achieved, max_points: stats.max_points, score_percent: stats.score_percent, total_questions: stats.total_questions, fully_correct: stats.fully_correct }; if (stats.strength === 'strength') analysis.strengths.push({ topic: stats.name, score: stats.score_percent }); else if (stats.strength === 'weakness') analysis.weaknesses.push({ topic: stats.name, score: stats.score_percent }); } analysis.strengths.sort((a, b) => b.score - a.score); analysis.weaknesses.sort((a, b) => a.score - b.score); answers.forEach((answer) => { if (!answer || answer.correctness === 'error') return; const qType = answer.question_type; const difficulty = answer.difficulty; const maxQScore = answer.maxScore; const awardedScore = answer.scoreAwarded ?? 0; if (!analysis.performance_by_type[qType]) analysis.performance_by_type[qType] = { points_achieved: 0, max_points: 0, count: 0 }; analysis.performance_by_type[qType].points_achieved += awardedScore; analysis.performance_by_type[qType].max_points += maxQScore; analysis.performance_by_type[qType].count++; if (difficulty !== null && difficulty !== undefined) { if (!analysis.performance_by_difficulty[difficulty]) analysis.performance_by_difficulty[difficulty] = { points_achieved: 0, max_points: 0, count: 0 }; analysis.performance_by_difficulty[difficulty].points_achieved += awardedScore; analysis.performance_by_difficulty[difficulty].max_points += maxQScore; analysis.performance_by_difficulty[difficulty].count++; } if (answer.correctness === 'incorrect' || answer.correctness === 'partial') { analysis.incorrectly_answered_details.push({ question_number: answer.question_number_in_test, question_text: answer.question_text, topic: answer.topic_name, type: answer.question_type, user_answer: answer.userAnswerValue, correct_answer: answer.correct_answer, score_awarded: awardedScore, max_score: maxQScore, explanation: answer.reasoning, error_identified: answer.error_analysis }); } }); if (results.score >= 43) analysis.overall_assessment = "Vynikající výkon!"; else if (results.score >= 33) analysis.overall_assessment = "Dobrý výkon, solidní základ."; else if (results.score >= 20) analysis.overall_assessment = "Průměrný výkon, zaměřte se na slabiny."; else analysis.overall_assessment = `Výkon ${results.score < 10 ? 'výrazně ' : ''}pod průměrem. Nutné opakování.`; if (results.score < SCORE_THRESHOLD_FOR_SAVING) analysis.overall_assessment += " Skóre je příliš nízké pro uložení a generování plánu."; analysis.recommendations = analysis.weaknesses.length > 0 ? [`Intenzivně se zaměřte na nejslabší témata: ${analysis.weaknesses.map(w => w.topic).slice(0, 2).join(', ')}.`] : ["Pokračujte v upevňování znalostí."]; if (analysis.incorrectly_answered_details.length > 3) analysis.recommendations.push(`Projděte si ${analysis.incorrectly_answered_details.length} otázek s nízkým nebo částečným skóre.`); console.log("[Logic Analysis v8] Vygenerována detailní analýza:", analysis); return analysis;
    }

    async function saveTestResultsLogic(supabase, currentUser, testResultsData, userAnswers, questions, testEndTime) {
        // ... (код этой функции остается без изменений, как в v7/v8) ...
         if (!currentUser || currentUser.id === 'PLACEHOLDER_USER_ID' || !supabase) { console.warn("[Logic Save v8] Neukládám: Chybí uživatel nebo Supabase."); return { success: false, error: "Uživatel není přihlášen." }; } if (testResultsData.score < SCORE_THRESHOLD_FOR_SAVING) { console.log(`[Logic Save v8] Skóre (${testResultsData.score}/50) < ${SCORE_THRESHOLD_FOR_SAVING}. Přeskakuji ukládání.`); return { success: false, error: `Skóre je příliš nízké (<${SCORE_THRESHOLD_FOR_SAVING}) pro uložení.` }; } console.log(`[Logic Save v8] Pokouším se uložit výsledky...`); let savedDiagnosticId = null; try { const detailedAnalysis = generateDetailedAnalysisLogic(testResultsData, userAnswers, questions); const answersToSave = userAnswers.map(a => ({ question_db_id: a.question_db_id, question_number_in_test: a.question_number_in_test, question_type: a.question_type, topic_id: a.topic_id, difficulty: a.difficulty, userAnswerValue: a.userAnswerValue, scoreAwarded: a.scoreAwarded, maxScore: a.maxScore, correctness: a.correctness, reasoning: a.reasoning, error_analysis: a.error_analysis, feedback: a.feedback, checked_by: a.checked_by })); const dataToSave = { user_id: currentUser.id, completed_at: testEndTime ? testEndTime.toISOString() : new Date().toISOString(), total_score: testResultsData.score, total_questions: testResultsData.totalQuestions, answers: answersToSave, topic_results: testResultsData.topicResults, analysis: detailedAnalysis, time_spent: testResultsData.timeSpent }; console.log("[Logic Save v8] Data k uložení:", dataToSave); const { data, error } = await supabase.from('user_diagnostics').insert(dataToSave).select('id').single(); if (error) throw error; savedDiagnosticId = data.id; console.log("[Logic Save v8] Diagnostika uložena, ID:", savedDiagnosticId); if (typeof window.VyukaApp?.checkAndAwardAchievements === 'function') { console.log('[Achievements v8] Triggering check after saving test results...'); window.VyukaApp.checkAndAwardAchievements(currentUser.id); } else { console.warn("[Achievements v8] Check function (window.VyukaApp.checkAndAwardAchievements) not found after saving test results."); } return { success: true, diagnosticId: savedDiagnosticId }; } catch (error) { console.error('[Logic Save v8] Chyba při ukládání:', error); return { success: false, error: `Nepodařilo se uložit výsledky: ${error.message}`, diagnosticId: savedDiagnosticId }; }
    }

    /**
     * НОВАЯ ЛОГИКА (v7): Начисляет кредиты на основе % набранных баллов.
     */
    async function awardPointsLogic(supabase, currentUser, currentProfile, selectedTestType, testResultsData, testTypeConfig) {
        // ... (код этой функции остается без изменений, как в v7/v8) ...
        if (!selectedTestType || !testResultsData || !currentUser || !currentProfile || !supabase || !testTypeConfig) { console.warn("[Logic Points v8] Nelze vypočítat/uložit body: Chybí data.", {selectedTestType, testResultsData, currentUser, currentProfile, testTypeConfig}); return { success: false, awardedPoints: 0, newTotal: currentProfile?.points ?? 0, error: "Chybějící data pro výpočet bodů." }; } const config = testTypeConfig[selectedTestType]; if (!config) { console.warn(`[Logic Points v8] Neznámá konfigurace testu: ${selectedTestType}`); return { success: false, awardedPoints: 0, newTotal: currentProfile.points, error: `Neznámá konfigurace testu: ${selectedTestType}` }; } const multiplier = config.multiplier || 1.0; const totalPointsAchieved = testResultsData.totalPointsAchieved ?? 0; const totalMaxPossiblePoints = testResultsData.totalMaxPossiblePoints ?? 0; if (totalMaxPossiblePoints <= 0) { console.warn("[Logic Points v8] Maximální možný počet bodů je 0, nelze vypočítat procento."); return { success: true, awardedPoints: 0, newTotal: currentProfile.points }; } const percentageScore = totalPointsAchieved / totalMaxPossiblePoints; const calculatedPoints = Math.round(BASE_POINTS_FOR_100_PERCENT * percentageScore * multiplier); if (calculatedPoints <= 0) { console.log("[Logic Points v8] Nebyly získány žádné body (výpočet <= 0)."); return { success: true, awardedPoints: 0, newTotal: currentProfile.points }; } console.log(`[Logic Points v8] Výpočet: Base=${BASE_POINTS_FOR_100_PERCENT}, %Score=${percentageScore.toFixed(2)}, Multiplier=${multiplier} => Vypočítané body: ${calculatedPoints}`); const currentPoints = currentProfile.points || 0; const newPoints = currentPoints + calculatedPoints; try { const { error } = await supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (error) { throw error; } console.log(`[Logic Points v8] Body uživatele ${currentUser.id} aktualizovány na ${newPoints} (+${calculatedPoints})`); if (typeof window.VyukaApp?.checkAndAwardAchievements === 'function') { console.log('[Achievements v8] Triggering check after awarding points...'); window.VyukaApp.checkAndAwardAchievements(currentUser.id); } else { console.warn("[Achievements v8] Check function (window.VyukaApp.checkAndAwardAchievements) not found after awarding points."); } return { success: true, awardedPoints: calculatedPoints, newTotal: newPoints }; } catch (error) { console.error("[Logic Points v8] Chyba při aktualizaci bodů:", error); return { success: false, error: error.message, awardedPoints: 0, newTotal: currentPoints }; }
    }
    // --- END: Логика расчета и сохранения результатов ---

    // --- START: Проверка существующего теста ---
    async function checkExistingDiagnosticLogic(supabase, userId) {
        // ... (код этой функции остается без изменений, как в v7/v8) ...
         if (!userId || userId === 'PLACEHOLDER_USER_ID' || !supabase) { console.warn("[Logic Check v8] Kontrola testu přeskočena (není user/supabase)."); return false; } try { const { data: existingDiagnostic, error } = await supabase.from('user_diagnostics').select('id, completed_at').eq('user_id', userId).limit(1); if (error) { console.error("[Logic Check v8] Chyba při kontrole existujícího testu:", error); return false; } return existingDiagnostic && existingDiagnostic.length > 0; } catch (err) { console.error("[Logic Check v8] Neočekávaná chyba při kontrole testu:", err); return false; }
    }
    // --- END: Проверка существующего теста ---

    // --- START: Логика Уведомлений ---
    async function fetchNotificationsLogic(supabase, userId, limit = NOTIFICATION_FETCH_LIMIT) {
        // ... (код этой функции остается без изменений, как в v7/v8) ...
        if (!supabase || !userId) { console.error("[Notifications Logic v8] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications Logic v8] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) { throw error; } console.log(`[Notifications Logic v8] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications Logic v8] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; }
    }
    // --- END: Логика Уведомлений ---


    // --- START: Глобальный Экспорт ---
    // Экспортируем функции и константы в глобальное пространство имен
    global.TestLogic = {
        loadTestQuestions: loadTestQuestionsLogic, // v8
        checkAnswerWithGemini: checkAnswerWithGeminiLogic, // v9
        calculateFinalResults: calculateFinalResultsLogic, // v8 (no change)
        generateDetailedAnalysis: generateDetailedAnalysisLogic, // v8 (no change)
        saveTestResults: saveTestResultsLogic, // v8 (no change)
        awardPoints: awardPointsLogic, // v8 - New logic!
        checkExistingDiagnostic: checkExistingDiagnosticLogic, // v8 (no change)
        fetchNotifications: fetchNotificationsLogic, // v8 (no change)
        SCORE_THRESHOLD_FOR_SAVING: SCORE_THRESHOLD_FOR_SAVING,
        compareNumericAdvanced: compareNumericAdvanced, // v9 - New logic!
        compareTextAdvanced: compareTextAdvanced, // v8 - New logic!
    };
    console.log("test1-logic.js loaded and TestLogic exposed (v9 - Improved Numeric Compare + Construction Filter Check + Points Fix + Unique Check).");
    // --- END: Глобальный Экспорт ---

})(window); // Передаем глобальный объект (window в браузере)