// Файл: test1-logic.js
// Содержит основную логику для загрузки теста, оценки ответов, сохранения результатов и загрузки уведомлений.
// FIX v2: Улучшено сравнение числовых и текстовых ответов, уточнены инструкции для Gemini.
// FIX v4: Переписана compareTextAdvanced для поиска ключевых слов "ano"/"ne".
// FIX v5: Добавлена проверка уникальности вопросов в loadTestQuestionsLogic и дальнейшее улучшение compareTextAdvanced.

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
     * Расширенное сравнение числовых значений, включая дроби и десятичные дроби.
     * @param {string|number|null} value1 Первое значение
     * @param {string|number|null} value2 Второе значение
     * @param {number} tolerance Допустимая погрешность
     * @returns {boolean|null} true если эквивалентны, false если не эквивалентны, null если сравнение невозможно.
     */
     function compareNumericAdvanced(value1, value2, tolerance = NUMERIC_TOLERANCE) {
         if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) {
             return null; // Не можем сравнить, если одно из значений null/undefined
         }

         // Внутренняя функция для преобразования значения в число
         const normalizeAndEvaluate = (inputValue) => {
             if (typeof inputValue === 'number') {
                 return inputValue; // Если уже число, возвращаем как есть
             }
             if (typeof inputValue !== 'string') {
                 return NaN; // Если не строка и не число, не можем обработать
             }

             // 1. Предварительная обработка строки:
             //    - Убираем пробелы в начале/конце
             //    - Заменяем запятую на точку
             //    - Удаляем множественные пробелы внутри
             //    - Удаляем единицы измерения (Kč, %, и т.д.)
             let processedString = inputValue.trim().replace(',', '.').replace(/\s+/g, '').replace(/kč|czk|%/gi, '').trim();

             // 2. Проверка на формат простой дроби (например, "1/2", "-3/4")
             const fractionRegex = /^(-?)(\d+)\/(\d+)$/;
             const fractionMatch = processedString.match(fractionRegex);
             if (fractionMatch) {
                 const signMultiplier = fractionMatch[1] === '-' ? -1 : 1;
                 const numerator = parseFloat(fractionMatch[2]);
                 const denominator = parseFloat(fractionMatch[3]);
                 // Проверяем, что числитель и знаменатель - числа, и знаменатель не ноль
                 if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                     return signMultiplier * (numerator / denominator);
                 }
             }

             // 3. Проверка на формат смешанной дроби (например, "1 1/2", "-2 3/4")
             const mixedFractionRegex = /^(-?)(\d+)\s+(\d+)\/(\d+)$/; // Ожидаем пробел между целой и дробной частью
             const mixedMatch = processedString.match(mixedFractionRegex);
             if (mixedMatch) {
                 const signMultiplier = mixedMatch[1] === '-' ? -1 : 1;
                 const wholePart = parseFloat(mixedMatch[2]);
                 const numerator = parseFloat(mixedMatch[3]);
                 const denominator = parseFloat(mixedMatch[4]);
                 // Проверяем валидность всех частей
                 if (!isNaN(wholePart) && !isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                     // Важно правильно обработать знак для отрицательных чисел
                     return signMultiplier * (wholePart + (numerator / denominator));
                 }
             }

             // 4. Если это не дробь, пытаемся преобразовать строку в число напрямую
             const floatValue = parseFloat(processedString);

             // 5. Если не удалось преобразовать в число (результат NaN),
             //    и оба исходных значения были строками, возможно, это текстовый ответ.
             //    Возвращаем null, чтобы сигнализировать о необходимости текстового сравнения.
             if (isNaN(floatValue) && typeof value1 === 'string' && typeof value2 === 'string') {
                 return null;
             }

             // Возвращаем полученное число или NaN
             return floatValue;
         };

         // Преобразуем оба входных значения
         const number1 = normalizeAndEvaluate(value1);
         const number2 = normalizeAndEvaluate(value2);

         console.log(`[compareNumeric] Porovnávám vyhodnocené: ${number1} vs ${number2}`);

         // Если одно из значений не является числом (null из normalizeAndEvaluate или NaN),
         // то числовое сравнение невозможно.
         if (number1 === null || number2 === null || isNaN(number1) || isNaN(number2)) {
             console.log("[compareNumeric] Alespoň jedna hodnota není platné číslo pro srovnání.");
             return null;
         }

         // Сравниваем полученные числа с учетом допуска (tolerance)
         const difference = Math.abs(number1 - number2);
         const areEquivalent = difference < tolerance;

         console.log(`[compareNumeric] Rozdíl: ${difference}, Tolerance: ${tolerance}, Výsledek: ${areEquivalent}`);
         return areEquivalent;
     }

    /**
     * НОВАЯ ВЕРСИЯ (v5): Сравнение текстовых значений с извлечением ключевых слов "ano"/"ne" и агрессивной нормализацией.
     * @param {string|null} value1 Первое значение (например, ответ студента)
     * @param {string|null} value2 Второе значение (например, правильный ответ)
     * @returns {boolean} true если эквивалентны, false иначе.
     */
     function compareTextAdvanced(value1, value2) {
         // Начальная проверка на null или undefined
         if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) {
             return false;
         }

         // Функция для максимальной очистки и извлечения ключевого слова
         const normalizeAndExtract = (inputValue) => {
             // 1. Преобразование в строку и нижний регистр
             let processedString = String(inputValue).toLowerCase();

             // 2. Агрессивное удаление знаков пунктуации и пробелов в начале/конце
             //    Удаляем точки, запятые, скобки, двоеточия, пробелы, неразрывные пробелы (\u00A0)
             //    с начала и конца строки.
             processedString = processedString.replace(/^[\s.,():\u00A0]+|[\s.,():\u00A0]+$/g, '');

              // 3. Удаляем стандартные префиксы вариантов ответа (A., B), C:, D.) и т.п.
             processedString = processedString.replace(/^[a-zřčšžýáíéúůťďňě]\s*[\.\)\:]*\s*/, '');

             // 4. Снова убираем пробелы/пунктуацию, которые могли остаться после удаления префикса
              processedString = processedString.replace(/^[\s.,():\u00A0]+|[\s.,():\u00A0]+$/g, '');

             // 5. Нормализация ключевых слов "ano" / "ne"
             if (processedString === 'ano' || processedString === 'a') {
                 return 'ano';
             }
             if (processedString === 'ne' || processedString === 'n') {
                 return 'ne';
             }

             // 6. Если это не "ano"/"ne", возвращаем максимально очищенную строку
             return processedString;
         };

         // Применяем очистку к обоим значениям
         const normalized1 = normalizeAndExtract(value1);
         const normalized2 = normalizeAndExtract(value2);

         // Выводим в консоль для отладки
         console.log(`[compareText v5] Porovnávám normalizované: '${normalized1}' vs '${normalized2}'`);

         // Сравниваем очищенные строки
         const areEquivalent = (normalized1 === normalized2);

         // Выводим результат сравнения в консоль
         console.log(`[compareText v5] Výsledek: ${areEquivalent}`);
         return areEquivalent;
     }
    // --- END: Вспомогательные функции ---

    // --- START: Логика загрузки вопросов ---
    /**
     * Загружает вопросы для теста, обеспечивая уникальность в рамках одного теста.
     * @param {object} supabase - Клиент Supabase.
     * @param {string} testType - Тип теста ('quick', 'full', 'absolute').
     * @param {object} testTypeConfig - Конфигурация типов тестов.
     * @returns {Promise<Array>} Массив отформатированных уникальных вопросов.
     */
    async function loadTestQuestionsLogic(supabase, testType, testTypeConfig) {
        if (!supabase) {
            throw new Error("Supabase client není inicializován.");
        }
        if (!testType || !testTypeConfig[testType]) {
            throw new Error(`Neznámý typ testu: ${testType}`);
        }
        const config = testTypeConfig[testType];
        const questionCount = config.questionsCount; // Требуемое количество вопросов
        console.log(`[Logic] Načítání ${questionCount} unikátních otázek pro typ: ${testType}...`);

        // 1. Запрашиваем ВСЕ вопросы из базы
        const { data: allQuestions, error: fetchError } = await supabase
            .from('exam_questions')
            .select(`
                id, question_text, question_type, options, correct_answer,
                solution_explanation, topic_id, subtopic_id, difficulty,
                image_url, source_year, source_exam_type,
                topic:topic_id ( id, name ),
                subtopic:subtopic_id ( id, name )
            `);

        if (fetchError) {
            // Если произошла ошибка при запросе, выбрасываем ее
            throw fetchError;
        }
        if (!allQuestions || allQuestions.length === 0) {
            // Если база данных не вернула вопросов
            throw new Error("V databázi nejsou žádné otázky pro tento test.");
        }

        // 2. Перемешиваем полученный массив вопросов
        const shuffledQuestions = shuffleArray(allQuestions);

        // 3. Выбираем УНИКАЛЬНЫЕ вопросы до достижения нужного количества
        const selectedQuestions = [];
        const selectedIds = new Set(); // Используем Set для быстрой проверки уникальности ID

        for (const question of shuffledQuestions) {
            // Если уже набрали нужное количество, выходим из цикла
            if (selectedQuestions.length >= questionCount) {
                break;
            }
            // Если вопрос с таким ID еще не был добавлен
            if (!selectedIds.has(question.id)) {
                selectedIds.add(question.id); // Добавляем ID в набор выбранных
                selectedQuestions.push(question); // Добавляем вопрос в результат
            }
        }

        // Проверяем, удалось ли набрать достаточное количество УНИКАЛЬНЫХ вопросов
        if (selectedQuestions.length < questionCount) {
            console.warn(`[Logic] Nalezeno pouze ${selectedQuestions.length} unikátních otázek, požadováno ${questionCount}. Používám ${selectedQuestions.length}.`);
            if (selectedQuestions.length === 0) {
                // Это маловероятно, если allQuestions не пустой, но на всякий случай
                throw new Error("Nepodařilo se vybrat žádné unikátní otázky.");
            }
        }

        // 4. Форматируем выбранные уникальные вопросы
        const formattedQuestions = selectedQuestions.map((question, index) => ({
            id: question.id, // ID из базы
            question_number: index + 1, // Порядковый номер в тесте
            question_text: question.question_text,
            question_type: question.question_type,
            options: question.options,
            correct_answer: question.correct_answer,
            solution_explanation: question.solution_explanation || "Oficiální postup není k dispozici.",
            topic_id: question.topic_id,
            topic_name: question.topic ? question.topic.name : "Neznámé téma",
            subtopic_id: question.subtopic_id,
            subtopic_name: question.subtopic ? question.subtopic.name : "",
            difficulty: question.difficulty,
            image_url: question.image_url,
            source_year: question.source_year,
            source_exam_type: question.source_exam_type
        }));

        console.log(`[Logic] Vybráno ${formattedQuestions.length} unikátních otázek:`, formattedQuestions);
        return formattedQuestions; // Возвращаем массив уникальных отформатированных вопросов
    }
    // --- END: Логика загрузки вопросов ---

    // --- START: Логика оценки ответов (Gemini) ---
    async function checkAnswerWithGeminiLogic(questionType, questionText, correctAnswerOrExplanation, userAnswer, maxScore = 1, currentQuestionIndex) {
         console.log(`--- [Logic v5] Vyhodnocování Q#${currentQuestionIndex + 1} (Typ: ${questionType}, Max bodů: ${maxScore}) ---`);
         console.log(`   Otázka: ${questionText ? questionText.substring(0, 100) + '...' : 'N/A'}`);
         console.log(`   Správně: `, correctAnswerOrExplanation);
         console.log(`   Uživatel: `, userAnswer);

         const defaultResult = {
             score: 0,
             max_score: maxScore,
             correctness: "skipped",
             reasoning: "Odpověď nebyla poskytnuta nebo je prázdná.",
             error_analysis: null,
             feedback: "Příště zkuste odpovědět.",
             is_equivalent: null
         };

         if (userAnswer === null || userAnswer === undefined || String(userAnswer).trim() === "") {
             console.log("   Odpověď prázdná. Vracím výchozí výsledek.");
             return defaultResult;
         }

         // Устанавливаем базовое состояние "неправильно" для fallback
         defaultResult.correctness = "incorrect";
         defaultResult.reasoning = "Automatické hodnocení selhalo (fallback).";

         // Fallback логика
         const runFallbackCheck = () => {
             console.warn("!!! [Logic Fallback] Používá se FALLBACK logika pro vyhodnocení !!!");
             let fallbackScore = 0;
             let fallbackCorrectness = "incorrect";
             let fallbackReasoning = "Automatické hodnocení selhalo. Použita základní kontrola.";
             let isEquivalent = null;

             try {
                 if (questionType === 'multiple_choice') {
                     // Fallback для multiple choice: сравнение букв (оставляем как есть)
                     const correctLetter = String(correctAnswerOrExplanation).trim().toUpperCase().charAt(0);
                     const userLetter = String(userAnswer).trim().toUpperCase().charAt(0);
                     isEquivalent = correctLetter === userLetter;
                     if (isEquivalent) {
                         fallbackScore = maxScore;
                         fallbackCorrectness = "correct";
                         fallbackReasoning = "Odpověď (písmeno) se shoduje se správnou možností.";
                     } else {
                         fallbackReasoning = "Odpověď (písmeno) se neshoduje se správnou možností.";
                     }
                 } else if (['numeric', 'text', 'ano_ne'].includes(questionType)) {
                     // Fallback для других типов: используем УЛУЧШЕННОЕ сравнение
                     const numericComparison = compareNumericAdvanced(userAnswer, correctAnswerOrExplanation);
                     if (numericComparison === true) { // Явное совпадение чисел
                         isEquivalent = true;
                         fallbackScore = maxScore;
                         fallbackCorrectness = "correct";
                         fallbackReasoning = "Odpověď je numericky ekvivalentní správné odpovědi (fallback).";
                     } else { // Если не числа или не совпали, пробуем текст с НОВОЙ функцией
                         isEquivalent = compareTextAdvanced(userAnswer, correctAnswerOrExplanation); // Используем v5 функцию
                         if (isEquivalent) {
                             fallbackScore = maxScore;
                             fallbackCorrectness = "correct";
                             fallbackReasoning = "Odpověď se textově shoduje (po normalizaci v5) (fallback)."; // Указываем версию
                         } else {
                             fallbackReasoning = "Odpověď se neshoduje se správnou odpovědí (ani numericky, ani textově v5) (fallback).";
                         }
                     }
                 } else if (questionType === 'construction') {
                     // Fallback для конструкции: дать 1 балл, если ответ не пустой (минимальная попытка)
                     isEquivalent = false;
                     fallbackScore = (String(userAnswer).trim().length > 10) ? Math.min(1, maxScore) : 0;
                     fallbackCorrectness = fallbackScore > 0 ? "partial" : "incorrect";
                     fallbackReasoning = "Základní fallback hodnocení pro popis konstrukce (kontrola délky).";
                 }
             } catch (error) {
                 console.error("[Logic Fallback] Chyba při fallback porovnání:", error);
                 fallbackScore = 0;
                 fallbackCorrectness = "error";
                 fallbackReasoning = "Chyba při záložním hodnocení.";
                 isEquivalent = false;
             }

             console.log(`[Logic Fallback Výsledek] Skóre: ${fallbackScore}/${maxScore}, Správnost: ${fallbackCorrectness}, Ekvivalent: ${isEquivalent}`);
             return {
                 score: fallbackScore,
                 max_score: maxScore,
                 correctness: fallbackCorrectness,
                 reasoning: fallbackReasoning,
                 error_analysis: null,
                 feedback: "Pro detailní hodnocení zkuste znovu, pokud problém přetrvává, kontaktujte podporu.",
                 is_equivalent: isEquivalent
             };
         };

         // Проверка API ключа
         if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR_') || GEMINI_API_KEY.length < 10) {
             console.warn("[Logic Gemini] Chybí platný Gemini API klíč. Používám fallback.");
             return runFallbackCheck();
         }

         // --- Формирование промпта для Gemini (остается как в v4) ---
         let prompt;
          const baseInstruction = `Jsi PŘÍSNÝ a DETAILNÍ AI hodnotitel odpovědí z PŘIJÍMACÍCH ZKOUŠEK z matematiky/logiky pro 9. třídu ZŠ v ČR. Tvým úkolem je komplexně posoudit odpověď studenta vůči správnému řešení/odpovědi v kontextu dané otázky. MUSÍŠ vrátit POUZE JSON objekt podle PŘESNĚ definované struktury. NEPŘIDÁVEJ žádný text mimo JSON. Buď si VĚDOM toho, že odpovědi mohou být MATEMATICKY ekvivalentní i přes jiný formát (např. zlomek vs. desetinné číslo).`;
          const outputStructure = `{ "score": number (0-${maxScore}, celé číslo), "max_score": ${maxScore}, "correctness": string ("correct" | "incorrect" | "partial" | "skipped"), "reasoning": string (DETAILNÍ zdůvodnění skóre a vysvětlení správného postupu/odpovědi v ČEŠTINĚ, včetně uznání ekvivalentních formátů), "error_analysis": string | null (KONKRÉTNÍ popis chyby studenta v ČEŠTINĚ - např. "chyba ve výpočtu", "nepochopení pojmu", "špatný vzorec", "chybějící krok", "formální chyba", "odpověď je matematicky správná, ale formát neodpovídá"; null pokud správně), "feedback": string | null (Krátká konstruktivní rada pro studenta v ČEŠTINĚ, na co si dát pozor nebo co procvičit; null pokud správně), "is_equivalent": boolean | null (Pouze pro typy 'numeric', 'text', 'ano_ne'. True, pokud je odpověď uživatele matematicky/logicky správná i přes jiný formát. False pokud je nesprávná. Null pro jiné typy nebo pokud nelze určit.) }`;
         const questionContext = `Kontext otázky: """${questionText}"""`;
         const inputData = `SPRÁVNÁ ODPOVĚĎ/ŘEŠENÍ: """${correctAnswerOrExplanation}"""\nODPOVĚĎ STUDENTA: """${userAnswer}"""`;

         if (questionType === 'construction') {
             prompt = `${baseInstruction} Typ otázky: Popis konstrukce. Maximální skóre: ${maxScore}. ${questionContext} PRAVIDLA HODNOCENÍ (PŘÍSNĚ DODRŽUJ): 1. Identifikuj KLÍČOVÉ kroky v oficiálním postupu. 2. Posuď, zda popis studenta obsahuje VŠECHNY klíčové kroky ve SPRÁVNÉM logickém pořadí. 3. Skóre: - ${maxScore} bodů (correct): Popis kompletní, věcně správný, logicky seřazený. - 1 bod (partial): Hlavní myšlenka správná, ALE chybí JEDEN méně podstatný krok NEBO obsahuje JEDNU či DVĚ menší nepřesnosti/nejasnosti. - 0 bodů (incorrect): Zásadně chybný, chybí VÍCE kroků, špatné pořadí, VÍCE chyb, nesrozumitelný. 4. Zdůvodnění: PODROBNĚ vysvětli, proč bylo skóre uděleno, které kroky chybí/jsou špatně. 5. Error Analysis: Popiš KONKRÉTNÍ chyby (např. "chybí kružnice k nalezení bodu C", "špatné pořadí kroků", "nejednoznačný popis"). 6. Feedback: Navrhni, na co se zaměřit (např. "procvičit konstrukci osy úhlu", "dbát na přesný popis kroků"). ${inputData} ÚKOL: Pečlivě porovnej. Vrať POUZE JSON objekt podle této struktury: ${outputStructure}`;
         } else if (questionType === 'multiple_choice') {
              prompt = `${baseInstruction} Typ otázky: Výběr z možností. Maximální skóre: ${maxScore}. ${questionContext} PRAVIDLA: Porovnej POUZE PÍSMENO na začátku odpovědi studenta (case-insensitive) se správným písmenem. SKÓRE: ${maxScore} bodů (correct) POKUD se normalizované písmeno shoduje, jinak 0 (incorrect). Zdůvodnění: Uveď správné písmeno a proč je daná možnost správná (stručně). Pokud je odpověď špatně, uveď i proč je špatně. Error Analysis: Pokud špatně, uveď "vybrána nesprávná možnost". Feedback: Pokud špatně, navrhni "pečlivě číst všechny možnosti" nebo podobně. ${inputData} ÚKOL: Vrať POUZE JSON objekt podle této struktury: ${outputStructure}`;
         } else { // numeric, text, ano_ne
              prompt = `${baseInstruction} Typ otázky: ${questionType === 'ano_ne' ? 'Ano/Ne' : (questionType === 'numeric' ? 'Numerická/Výpočetní' : 'Textová/Symbolická')}. Maximální skóre: ${maxScore}. ${questionContext} PRAVIDLA:
1.  **Ekvivalence (is_equivalent):** NEJDŘÍVE posuď, zda je odpověď studenta MATEMATICKY/LOGICKY ekvivalentní správné odpovědi, i když formát může být jiný. Buď FLEXIBILNÍ:
    * Numerické: Uznávej desetinná čísla vs. zlomky (např. "-1.1" == "-11/10"), toleruj drobné rozdíly v zaokrouhlení (např. 3.14 vs 3.141), ignoruj jednotky, pokud nejsou explicitně požadovány.
    * Ano/Ne: Porovnávej case-insensitive "ano"/"ne", ignoruj případné úvodní znaky (např. "A. ano" == "ano").
    * Text/Symbolické: Buď přísnější, ale ignoruj velká/malá písmena a mezery na začátku/konci.
    * Nastav "is_equivalent" na true/false.
2.  **Skóre:** ${maxScore} bodů (correct) POKUD is_equivalent=true, jinak 0 (incorrect).
3.  **Zdůvodnění:** Vysvětli, PROČ je/není odpověď správná a jaký je správný výsledek/postup. VŽDY ZMIŇ, zda byla odpověď uznána jako ekvivalentní i přes jiný formát.
4.  **Error Analysis:** Pokud incorrect, KONKRÉTNĚ popiš chybu (např. "chyba ve výpočtu", "nesprávná odpověď ano/ne", "špatná jednotka", "formální chyba"). Pokud je odpověď matematicky správná, ale formátově špatná (a is_equivalent=true), uveď "formální chyba" nebo "neshodný formát".
5.  **Feedback:** Pokud incorrect, navrhni co zlepšit (např. "zkontrolovat znaménka", "převádět jednotky", "dbát na formát odpovědi"). Pokud correct, ale jiný formát, můžeš dát tip "příště použijte formát X".
${inputData}
ÚKOL: Pečlivě posuď ekvivalenci a správnost. Vrať POUZE JSON objekt podle této struktury: ${outputStructure}`;
         }
         // --- Конец Формирования Промпта ---

         // --- Вызов API Gemini и обработка ответа (остается как в v4) ---
         try {
             console.log(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Posílám požadavek...`);
             const response = await fetch(GEMINI_API_URL, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     contents: [{ parts: [{ text: prompt }] }],
                     generationConfig: {
                         temperature: 0.1,
                     },
                     safetySettings: [
                         { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                         { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                         { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                         { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                     ]
                 })
             });

             if (!response.ok) {
                 const errorBody = await response.text();
                 console.error(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Chyba API:`, response.status, errorBody);
                 throw new Error(`Chyba Gemini API (${response.status})`);
             }

             const data = await response.json();
             console.log(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Surová odpověď:`, JSON.stringify(data));

             if (data.promptFeedback?.blockReason) {
                 throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}.`);
             }
             const candidate = data.candidates?.[0];
             if (!candidate) {
                 throw new Error('AI neposkytlo kandidáta odpovědi.');
             }

             if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
                 console.warn(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Finish Reason: ${candidate.finishReason}.`);
                 if (candidate.finishReason === 'SAFETY') {
                     throw new Error('Odpověď blokována bezpečnostním filtrem AI.');
                 }
                  if (!candidate.content?.parts?.[0]?.text) {
                       throw new Error(`Generování zastaveno: ${candidate.finishReason}.`);
                  }
             }

             let resultJsonText = candidate.content?.parts?.[0]?.text;

             if (!resultJsonText) {
                 throw new Error('AI vrátilo prázdnou odpověď.');
             }

              const jsonMatch = resultJsonText.match(/```json\s*([\s\S]*?)\s*```/);
              if (jsonMatch && jsonMatch[1]) {
                  resultJsonText = jsonMatch[1];
              }

             console.log(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Získaný text JSON (po očištění):`, resultJsonText);

             try {
                 const result = JSON.parse(resultJsonText);
                 console.log(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Parsovaný výsledek JSON:`, result);

                 if (typeof result.score !== 'number' || typeof result.correctness !== 'string' || typeof result.reasoning !== 'string') {
                     console.warn(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Chybí povinné klíče v JSON. Používám fallback.`, result);
                     return runFallbackCheck();
                 }
                 const potentialScore = Math.round(result.score);
                 if (potentialScore < 0 || potentialScore > maxScore) {
                     console.warn(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Neplatné skóre ${potentialScore} (max ${maxScore}). Používám fallback.`);
                     return runFallbackCheck();
                 }

                 let finalCorrectness = ["correct", "incorrect", "partial", "skipped"].includes(result.correctness) ? result.correctness : "incorrect";
                 if (questionType !== 'construction' && typeof result.is_equivalent === 'boolean') {
                     if (result.is_equivalent === true && finalCorrectness !== "correct") {
                         console.warn(`[Logic Gemini] Oprava 'correctness': is_equivalent=true, ale correctness bylo ${finalCorrectness}. Nastavuji na 'correct'.`);
                         finalCorrectness = "correct";
                     } else if (result.is_equivalent === false && finalCorrectness === "correct") {
                         console.warn(`[Logic Gemini] Oprava 'correctness': is_equivalent=false, ale correctness bylo ${finalCorrectness}. Nastavuji na 'incorrect'.`);
                         finalCorrectness = "incorrect";
                     }
                 }

                 return {
                     score: potentialScore,
                     max_score: maxScore,
                     correctness: finalCorrectness,
                     reasoning: result.reasoning || "Nebylo poskytnuto žádné zdůvodnění.",
                     error_analysis: result.error_analysis || null,
                     feedback: result.feedback || null,
                     is_equivalent: typeof result.is_equivalent === 'boolean' ? result.is_equivalent : null
                 };
             } catch (parseError) {
                 console.error(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Nepodařilo se parsovat JSON:`, parseError, "Odpověď:", resultJsonText);
                 return runFallbackCheck();
             }

         } catch (apiError) {
             console.error(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Selhalo volání API:`, apiError);
             return runFallbackCheck();
         }
         // --- Конец Вызова API Gemini ---
     }
    // --- END: Логика оценки ответов ---

    // --- START: Логика расчета и сохранения результатов ---
    function calculateFinalResultsLogic(userAnswers, questions) {
        // ... (код этой функции остается без изменений, как в v4) ...
        let totalRawPointsAchieved = 0;
        let totalRawMaxPossiblePoints = 0;
        let correctCount = 0;
        let incorrectCount = 0;
        let partialCount = 0;
        let skippedCount = 0;
        let topicStats = {};

        userAnswers.forEach((answer, index) => {
            if (!answer) {
                console.warn(`[Logic Calc] Chybí data odpovědi pro index ${index}.`);
                skippedCount++;
                return;
            }
            const topicKey = answer.topic_id || answer.topic_name || 'unknown';
            const topicName = answer.topic_name || 'Neznámé téma';
            if (!topicStats[topicKey]) {
                topicStats[topicKey] = { name: topicName, id: answer.topic_id, total_questions: 0, fully_correct: 0, points_achieved: 0, max_points: 0, score_percent: 0, strength: 'neutral' };
            }
            topicStats[topicKey].total_questions++;
            topicStats[topicKey].max_points += answer.maxScore;
            totalRawMaxPossiblePoints += answer.maxScore;
            if (answer.correctness === "skipped") { skippedCount++; }
            else if (answer.correctness === "error") { incorrectCount++; }
            else {
                const awardedScore = answer.scoreAwarded ?? 0;
                totalRawPointsAchieved += awardedScore;
                topicStats[topicKey].points_achieved += awardedScore;
                if (answer.correctness === "correct") { correctCount++; topicStats[topicKey].fully_correct++; }
                else if (answer.correctness === "partial") { partialCount++; }
                else { incorrectCount++; }
            }
        });
        Object.values(topicStats).forEach(stats => {
            stats.score_percent = stats.max_points > 0 ? Math.round((stats.points_achieved / stats.max_points) * 100) : 0;
            stats.strength = stats.score_percent >= 75 ? 'strength' : (stats.score_percent < 50 ? 'weakness' : 'neutral');
        });
        const totalApplicableQuestions = questions.length - skippedCount;
        const finalPercentage = totalApplicableQuestions > 0 ? Math.round((correctCount / totalApplicableQuestions) * 100) : 0;
        const finalScoreOutOf50 = totalRawMaxPossiblePoints > 0 ? Math.round((totalRawPointsAchieved / totalRawMaxPossiblePoints) * 50) : 0;
        const resultsData = { totalQuestions: questions.length, correctAnswers: correctCount, incorrectAnswers: incorrectCount, partiallyCorrectAnswers: partialCount, skippedAnswers: skippedCount, evaluationErrors: userAnswers.filter(a => a?.correctness === 'error').length, score: finalScoreOutOf50, totalPointsAchieved: totalRawPointsAchieved, totalMaxPossiblePoints: totalRawMaxPossiblePoints, percentage: finalPercentage, topicResults: topicStats };
        console.log("[Logic] Finální výsledky vypočítány:", resultsData);
        return resultsData;
    }

    function generateDetailedAnalysisLogic(results, answers, questionsData) {
        // ... (код этой функции остается без изменений, как в v4) ...
        const analysis = { summary: { score: results.score, total_points_achieved: results.totalPointsAchieved, total_max_possible_points: results.totalMaxPossiblePoints, percentage: results.percentage, time_spent_seconds: results.timeSpent, total_questions: results.totalQuestions, correct: results.correctAnswers, incorrect: results.incorrectAnswers, partial: results.partiallyCorrectAnswers, skipped: results.skippedAnswers, evaluation_errors: results.evaluationErrors, }, strengths: [], weaknesses: [], performance_by_topic: {}, performance_by_type: {}, performance_by_difficulty: {}, incorrectly_answered_details: [] };
        for (const [topicKey, stats] of Object.entries(results.topicResults || {})) { analysis.performance_by_topic[stats.name] = { points_achieved: stats.points_achieved, max_points: stats.max_points, score_percent: stats.score_percent, total_questions: stats.total_questions, fully_correct: stats.fully_correct }; if (stats.strength === 'strength') analysis.strengths.push({ topic: stats.name, score: stats.score_percent }); else if (stats.strength === 'weakness') analysis.weaknesses.push({ topic: stats.name, score: stats.score_percent }); } analysis.strengths.sort((a, b) => b.score - a.score); analysis.weaknesses.sort((a, b) => a.score - b.score); answers.forEach((answer) => { if (!answer || answer.correctness === 'error') return; const qType = answer.question_type; const difficulty = answer.difficulty; const maxQScore = answer.maxScore; const awardedScore = answer.scoreAwarded ?? 0; if (!analysis.performance_by_type[qType]) analysis.performance_by_type[qType] = { points_achieved: 0, max_points: 0, count: 0 }; analysis.performance_by_type[qType].points_achieved += awardedScore; analysis.performance_by_type[qType].max_points += maxQScore; analysis.performance_by_type[qType].count++; if (difficulty !== null && difficulty !== undefined) { if (!analysis.performance_by_difficulty[difficulty]) analysis.performance_by_difficulty[difficulty] = { points_achieved: 0, max_points: 0, count: 0 }; analysis.performance_by_difficulty[difficulty].points_achieved += awardedScore; analysis.performance_by_difficulty[difficulty].max_points += maxQScore; analysis.performance_by_difficulty[difficulty].count++; } if (answer.correctness === 'incorrect' || answer.correctness === 'partial') { analysis.incorrectly_answered_details.push({ question_number: answer.question_number_in_test, question_text: answer.question_text, topic: answer.topic_name, type: answer.question_type, user_answer: answer.userAnswerValue, correct_answer: answer.correct_answer, score_awarded: awardedScore, max_score: maxQScore, explanation: answer.reasoning, error_identified: answer.error_analysis }); } }); if (results.score >= 43) analysis.overall_assessment = "Vynikající výkon!"; else if (results.score >= 33) analysis.overall_assessment = "Dobrý výkon, solidní základ."; else if (results.score >= 20) analysis.overall_assessment = "Průměrný výkon, zaměřte se na slabiny."; else analysis.overall_assessment = `Výkon ${results.score < 10 ? 'výrazně ' : ''}pod průměrem. Nutné opakování.`; if (results.score < SCORE_THRESHOLD_FOR_SAVING) analysis.overall_assessment += " Skóre je příliš nízké pro uložení a generování plánu."; analysis.recommendations = analysis.weaknesses.length > 0 ? [`Intenzivně se zaměřte na nejslabší témata: ${analysis.weaknesses.map(w => w.topic).slice(0, 2).join(', ')}.`] : ["Pokračujte v upevňování znalostí."]; if (analysis.incorrectly_answered_details.length > 3) analysis.recommendations.push(`Projděte si ${analysis.incorrectly_answered_details.length} otázek s nízkým nebo částečným skóre.`); console.log("[Logic Analysis] Vygenerována detailní analýza:", analysis); return analysis;
    }

    async function saveTestResultsLogic(supabase, currentUser, testResultsData, userAnswers, questions, testEndTime) {
        // ... (код этой функции остается без изменений, как в v4) ...
        if (!currentUser || currentUser.id === 'PLACEHOLDER_USER_ID' || !supabase) { console.warn("[Logic Save] Neukládám: Chybí uživatel nebo Supabase."); return { success: false, error: "Uživatel není přihlášen." }; } if (testResultsData.score < SCORE_THRESHOLD_FOR_SAVING) { console.log(`[Logic Save] Skóre (${testResultsData.score}/50) < ${SCORE_THRESHOLD_FOR_SAVING}. Přeskakuji ukládání.`); return { success: false, error: `Skóre je příliš nízké (<${SCORE_THRESHOLD_FOR_SAVING}) pro uložení.` }; } console.log(`[Logic Save] Pokouším se uložit výsledky...`); let savedDiagnosticId = null; try { const detailedAnalysis = generateDetailedAnalysisLogic(testResultsData, userAnswers, questions); const answersToSave = userAnswers.map(a => ({ question_db_id: a.question_db_id, question_number_in_test: a.question_number_in_test, question_type: a.question_type, topic_id: a.topic_id, difficulty: a.difficulty, userAnswerValue: a.userAnswerValue, scoreAwarded: a.scoreAwarded, maxScore: a.maxScore, correctness: a.correctness, reasoning: a.reasoning, error_analysis: a.error_analysis, feedback: a.feedback, checked_by: a.checked_by })); const dataToSave = { user_id: currentUser.id, completed_at: testEndTime ? testEndTime.toISOString() : new Date().toISOString(), total_score: testResultsData.score, total_questions: testResultsData.totalQuestions, answers: answersToSave, topic_results: testResultsData.topicResults, analysis: detailedAnalysis, time_spent: testResultsData.timeSpent }; console.log("[Logic Save] Data k uložení:", dataToSave); const { data, error } = await supabase.from('user_diagnostics').insert(dataToSave).select('id').single(); if (error) throw error; savedDiagnosticId = data.id; console.log("[Logic Save] Diagnostika uložena, ID:", savedDiagnosticId); if (typeof window.VyukaApp?.checkAndAwardAchievements === 'function') { console.log('[Achievements] Triggering check after saving test results...'); window.VyukaApp.checkAndAwardAchievements(currentUser.id); } else { console.warn("[Achievements] Check function (window.VyukaApp.checkAndAwardAchievements) not found after saving test results."); } return { success: true, diagnosticId: savedDiagnosticId }; } catch (error) { console.error('[Logic Save] Chyba při ukládání:', error); return { success: false, error: `Nepodařilo se uložit výsledky: ${error.message}`, diagnosticId: savedDiagnosticId }; }
    }

    async function awardPointsLogic(supabase, currentUser, currentProfile, selectedTestType, testResultsData, testTypeConfig) {
        // ... (код этой функции остается без изменений, как в v4) ...
        if (!selectedTestType || !testResultsData || testResultsData.totalQuestions <= 0 || !currentUser || !currentProfile || !supabase) { console.warn("[Logic Points] Nelze vypočítat/uložit body: Chybí data."); return { success: false, awardedPoints: 0, newTotal: currentProfile?.points ?? 0 }; } const config = testTypeConfig[selectedTestType]; if (!config) { console.warn(`[Logic Points] Neznámá konfigurace testu: ${selectedTestType}`); return { success: false, awardedPoints: 0, newTotal: currentProfile.points }; } const multiplier = config.multiplier; const correctAnswers = testResultsData.correctAnswers; const totalQuestions = testResultsData.totalQuestions; if (totalQuestions === 0) { console.warn("[Logic Points] Počet otázek je 0, nelze vypočítat body."); return { success: true, awardedPoints: 0, newTotal: currentProfile.points }; } const calculatedPoints = Math.round(multiplier * (correctAnswers / totalQuestions) * 10); if (calculatedPoints <= 0) { console.log("[Logic Points] Nebyly získány žádné body."); return { success: true, awardedPoints: 0, newTotal: currentProfile.points }; } console.log(`[Logic Points] Vypočítané body: ${calculatedPoints} (multiplier=${multiplier}, correct=${correctAnswers}, total=${totalQuestions})`); const currentPoints = currentProfile.points || 0; const newPoints = currentPoints + calculatedPoints; try { const { error } = await supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (error) { throw error; } console.log(`[Logic Points] Body uživatele ${currentUser.id} aktualizovány na ${newPoints} (+${calculatedPoints})`); if (typeof window.VyukaApp?.checkAndAwardAchievements === 'function') { console.log('[Achievements] Triggering check after awarding points...'); window.VyukaApp.checkAndAwardAchievements(currentUser.id); } else { console.warn("[Achievements] Check function (window.VyukaApp.checkAndAwardAchievements) not found after awarding points."); } return { success: true, awardedPoints: calculatedPoints, newTotal: newPoints }; } catch (error) { console.error("[Logic Points] Chyba při aktualizaci bodů:", error); return { success: false, error: error.message, awardedPoints: 0, newTotal: currentPoints }; }
    }
    // --- END: Логика расчета и сохранения результатов ---

    // --- START: Проверка существующего теста ---
    async function checkExistingDiagnosticLogic(supabase, userId) {
        // ... (код этой функции остается без изменений, как в v4) ...
        if (!userId || userId === 'PLACEHOLDER_USER_ID' || !supabase) { console.warn("[Logic Check] Kontrola testu přeskočena (není user/supabase)."); return false; } try { const { data: existingDiagnostic, error } = await supabase.from('user_diagnostics').select('id, completed_at').eq('user_id', userId).limit(1); if (error) { console.error("[Logic Check] Chyba při kontrole existujícího testu:", error); return false; } return existingDiagnostic && existingDiagnostic.length > 0; } catch (err) { console.error("[Logic Check] Neočekávaná chyba při kontrole testu:", err); return false; }
    }
    // --- END: Проверка существующего теста ---

    // --- START: Логика Уведомлений ---
    async function fetchNotificationsLogic(supabase, userId, limit = NOTIFICATION_FETCH_LIMIT) {
        // ... (код этой функции остается без изменений, как в v4) ...
        if (!supabase || !userId) { console.error("[Notifications Logic] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications Logic] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) { throw error; } console.log(`[Notifications Logic] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications Logic] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; }
    }
    // --- END: Логика Уведомлений ---


    // --- START: Глобальный Экспорт ---
    // Экспортируем функции и константы в глобальное пространство имен
    global.TestLogic = {
        loadTestQuestions: loadTestQuestionsLogic,
        checkAnswerWithGemini: checkAnswerWithGeminiLogic,
        calculateFinalResults: calculateFinalResultsLogic,
        generateDetailedAnalysis: generateDetailedAnalysisLogic,
        saveTestResults: saveTestResultsLogic,
        awardPoints: awardPointsLogic,
        checkExistingDiagnostic: checkExistingDiagnosticLogic,
        fetchNotifications: fetchNotificationsLogic,
        SCORE_THRESHOLD_FOR_SAVING: SCORE_THRESHOLD_FOR_SAVING,
        compareNumericAdvanced: compareNumericAdvanced,
        compareTextAdvanced: compareTextAdvanced, // Обновленная функция v5
    };
    console.log("test1-logic.js loaded and TestLogic exposed (v5 - Unique Questions + Text Compare Fix).");
    // --- END: Глобальный Экспорт ---

})(window); // Передаем глобальный объект (window в браузере)