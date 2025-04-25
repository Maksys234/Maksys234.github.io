// Файл: test1-logic.js
// Содержит основную логику для загрузки теста, оценки ответов, сохранения результатов и загрузки уведомлений.
// FIX v2: Улучшено сравнение числовых и текстовых ответов, уточнены инструкции для Gemini.

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
    function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[array[i], array[j]] = [array[j], array[i]]; } return array; }

    /**
     * Расширенное сравнение числовых значений, включая дроби и десятичные дроби.
     * @param {string|number|null} val1 Первое значение
     * @param {string|number|null} val2 Второе значение
     * @param {number} tolerance Допустимая погрешность
     * @returns {boolean|null} true если эквивалентны, false если не эквивалентны, null если сравнение невозможно.
     */
     function compareNumericAdvanced(val1, val2, tolerance = NUMERIC_TOLERANCE) {
         if (val1 === null || val1 === undefined || val2 === null || val2 === undefined) return null;

         const normalizeAndEvaluate = (v) => {
             if (typeof v === 'number') return v;
             if (typeof v !== 'string') return NaN;

             let str = v.trim().replace(',', '.').replace(/\s+/g, '').replace(/kč|czk|%/gi, '').trim();

             // Простая дробь (включая отрицательные)
             const fractionMatch = str.match(/^(-?)(\d+)\/(\d+)$/);
             if (fractionMatch) {
                 const sign = fractionMatch[1] === '-' ? -1 : 1;
                 const num = parseFloat(fractionMatch[2]);
                 const den = parseFloat(fractionMatch[3]);
                 if (!isNaN(num) && !isNaN(den) && den !== 0) return sign * (num / den);
             }

             // Смешанная дробь (включая отрицательные)
             const mixedMatch = str.match(/^(-?)(\d+)\s+(\d+)\/(\d+)$/);
              if (mixedMatch) {
                  const sign = mixedMatch[1] === '-' ? -1 : 1;
                  const whole = parseFloat(mixedMatch[2]);
                  const num = parseFloat(mixedMatch[3]);
                  const den = parseFloat(mixedMatch[4]);
                  if (!isNaN(whole) && !isNaN(num) && !isNaN(den) && den !== 0) {
                      // Для отрицательных смешанных дробей, например -1 1/2 должно быть -1.5
                      return sign * (whole + (num / den));
                  }
              }

             // Обычное число с плавающей точкой или целое число
             const floatVal = parseFloat(str);
              // Если парсинг не удался, но строка может быть текстовым ответом (например, "nelze určit")
              if (isNaN(floatVal) && typeof val1 === 'string' && typeof val2 === 'string') {
                  // Возвращаем null, чтобы указать на необходимость текстового сравнения
                  return null;
              }
             return floatVal;
         };

         const num1 = normalizeAndEvaluate(val1);
         const num2 = normalizeAndEvaluate(val2);

         console.log(`[compareNumeric] Porovnávám vyhodnocené: ${num1} vs ${num2}`);

         if (num1 === null || num2 === null) { // Если одно из значений - текст
             console.log("[compareNumeric] Jedna z hodnot není čistě numerická, fallback na textové porovnání nutný.");
             return null;
         }
        if (isNaN(num1) || isNaN(num2)) {
             console.log("[compareNumeric] Nelze porovnat numericky (NaN).");
             return null; // Не можем сравнить как числа
         }

         const areEquivalent = Math.abs(num1 - num2) < tolerance;
         console.log(`[compareNumeric] Výsledek (tolerance ${tolerance}): ${areEquivalent}`);
         return areEquivalent;
     }


    /**
     * Расширенное сравнение текстовых значений, включая "ano/ne".
     * @param {string|null} val1 Первое значение
     * @param {string|null} val2 Второе значение
     * @returns {boolean} true если эквивалентны, false иначе.
     */
     function compareTextAdvanced(val1, val2) {
         if (val1 === null || val1 === undefined || val2 === null || val2 === undefined) return false;

         const normalize = (v) => {
             let str = String(v).trim().toLowerCase()
                 .replace(/^[a-zřčšžýáíéúůťďňě]\s*[\.\)\:]*\s*/, '') // Удалить начальную букву/пунктуацию (напр. "A. ", "B)", "C:")
                 .replace(/\.$/, '') // Удалить точку в конце
                 .trim();

             // Специальная обработка для ano/ne
             if (str === 'ano' || str === 'a') return 'ano';
             if (str === 'ne' || str === 'n') return 'ne';

             return str;
         };

         const norm1 = normalize(val1);
         const norm2 = normalize(val2);

         console.log(`[compareText] Porovnávám normalizované: '${norm1}' vs '${norm2}'`);

         // Прямое сравнение нормализованных строк
         const areEquivalent = norm1 === norm2;

         console.log(`[compareText] Výsledek: ${areEquivalent}`);
         return areEquivalent;
     }
    // --- END: Вспомогательные функции ---

    // --- START: Логика загрузки вопросов ---
    async function loadTestQuestionsLogic(supabase, testType, testTypeConfig) { if (!supabase) throw new Error("Supabase client není inicializován."); if (!testType || !testTypeConfig[testType]) throw new Error(`Neznámý typ testu: ${testType}`); const config = testTypeConfig[testType]; const questionCount = config.questionsCount; console.log(`[Logic] Načítání ${questionCount} otázek pro typ: ${testType}...`); const { data: allQuestions, error: fetchError } = await supabase .from('exam_questions') .select(` id, question_text, question_type, options, correct_answer, solution_explanation, topic_id, subtopic_id, difficulty, image_url, source_year, source_exam_type, topic:topic_id ( id, name ), subtopic:subtopic_id ( id, name ) `); if (fetchError) throw fetchError; if (!allQuestions || allQuestions.length === 0) throw new Error("V databázi nejsou žádné otázky pro tento test."); const shuffledQuestions = shuffleArray(allQuestions); const selectedQuestions = shuffledQuestions.slice(0, questionCount); if (selectedQuestions.length < questionCount) { console.warn(`[Logic] Nalezeno pouze ${selectedQuestions.length} otázek, požadováno ${questionCount}.`); if(selectedQuestions.length === 0) throw new Error("Nepodařilo se načíst žádné relevantní otázky."); } const formattedQuestions = selectedQuestions.map((q, index) => ({ id: q.id, question_number: index + 1, question_text: q.question_text, question_type: q.question_type, options: q.options, correct_answer: q.correct_answer, solution_explanation: q.solution_explanation || "Oficiální postup není k dispozici.", topic_id: q.topic_id, topic_name: q.topic ? q.topic.name : "Neznámé téma", subtopic_id: q.subtopic_id, subtopic_name: q.subtopic ? q.subtopic.name : "", difficulty: q.difficulty, image_url: q.image_url, source_year: q.source_year, source_exam_type: q.source_exam_type })); console.log("[Logic] Vybrané otázky:", formattedQuestions); return formattedQuestions; }
    // --- END: Логика загрузки вопросов ---

    // --- START: Логика оценки ответов (Gemini) ---
    async function checkAnswerWithGeminiLogic(questionType, questionText, correctAnswerOrExplanation, userAnswer, maxScore = 1, currentQuestionIndex) {
         console.log(`--- [Logic v2] Vyhodnocování Q#${currentQuestionIndex + 1} (Typ: ${questionType}, Max bodů: ${maxScore}) ---`);
         console.log(`   Otázka: ${questionText.substring(0, 100)}...`);
         console.log(`   Správně: `, correctAnswerOrExplanation);
         console.log(`   Uživatel: `, userAnswer);

         const defaultResult = { score: 0, max_score: maxScore, correctness: "skipped", reasoning: "Odpověď nebyla poskytnuta nebo je prázdná.", error_analysis: null, feedback: "Příště zkuste odpovědět.", is_equivalent: null };

         if (userAnswer === null || String(userAnswer).trim() === "") {
             console.log("   Odpověď prázdná. Vracím výchozí výsledek.");
             return defaultResult;
         }

         // Устанавливаем базовое состояние "неправильно" для fallback
         defaultResult.correctness = "incorrect";
         defaultResult.reasoning = "Automatické hodnocení selhalo (fallback).";

         // Fallback логика (без изменений)
         const runFallbackCheck = () => {
             console.warn("!!! [Logic Fallback] Používá se FALLBACK logika pro vyhodnocení !!!");
             let fallbackScore = 0;
             let fallbackCorrectness = "incorrect";
             let fallbackReasoning = "Automatické hodnocení selhalo. Použita základní kontrola.";
             let isEquivalent = null;

             try {
                 if (questionType === 'multiple_choice') {
                     const correctLetter = String(correctAnswerOrExplanation).trim().toUpperCase().charAt(0);
                     const userLetter = String(userAnswer).trim().toUpperCase().charAt(0);
                     isEquivalent = correctLetter === userLetter;
                     if (isEquivalent) { fallbackScore = maxScore; fallbackCorrectness = "correct"; fallbackReasoning = "Odpověď (písmeno) se shoduje se správnou možností."; }
                     else { fallbackReasoning = "Odpověď (písmeno) se neshoduje se správnou možností."; }
                 } else if (['numeric', 'text', 'ano_ne'].includes(questionType)) {
                     // Сначала пробуем числовое сравнение
                     const numericComparison = compareNumericAdvanced(userAnswer, correctAnswerOrExplanation);
                     if (numericComparison === true) { // Явное совпадение чисел
                         isEquivalent = true;
                         fallbackScore = maxScore;
                         fallbackCorrectness = "correct";
                         fallbackReasoning = "Odpověď je numericky ekvivalentní správné odpovědi.";
                     } else { // Если не числа или не совпали, пробуем текст
                         isEquivalent = compareTextAdvanced(userAnswer, correctAnswerOrExplanation);
                         if (isEquivalent) {
                             fallbackScore = maxScore;
                             fallbackCorrectness = "correct";
                             fallbackReasoning = "Odpověď se textově shoduje (po normalizaci).";
                         } else {
                             fallbackReasoning = "Odpověď se neshoduje se správnou odpovědí (ani numericky, ani textově).";
                         }
                     }
                 } else if (questionType === 'construction') {
                     isEquivalent = false;
                     fallbackScore = (String(userAnswer).trim().length > 10) ? Math.min(1, maxScore) : 0;
                     fallbackCorrectness = fallbackScore > 0 ? "partial" : "incorrect";
                     fallbackReasoning = "Základní fallback hodnocení pro popis konstrukce (kontrola délky).";
                 }
             } catch (e) {
                 console.error("[Logic Fallback] Chyba při fallback porovnání:", e);
                 fallbackScore = 0; fallbackCorrectness = "error"; fallbackReasoning = "Chyba při záložním hodnocení."; isEquivalent = false;
             }

             console.log(`[Logic Fallback Výsledek] Skóre: ${fallbackScore}/${maxScore}, Správnost: ${fallbackCorrectness}, Ekvivalent: ${isEquivalent}`);
             return {
                 score: fallbackScore, max_score: maxScore, correctness: fallbackCorrectness,
                 reasoning: fallbackReasoning, error_analysis: null,
                 feedback: "Pro detailní hodnocení zkuste znovu, pokud problém přetrvává, kontaktujte podporu.",
                 is_equivalent: isEquivalent
             };
         };

         // Проверка API ключа
         if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR_') || GEMINI_API_KEY.length < 10) {
             console.warn("[Logic Gemini] Chybí platný Gemini API klíč. Používám fallback.");
             return runFallbackCheck();
         }

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

         try {
             console.log(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Posílám požadavek...`);
             const response = await fetch(GEMINI_API_URL, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     contents: [{ parts: [{ text: prompt }] }],
                     generationConfig: {
                         temperature: 0.1, // Lower temperature for factual evaluation
                         //responseMimeType: "application/json" // Keep this if it works, remove if causes issues
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
             if (!candidate) { throw new Error('AI neposkytlo kandidáta odpovědi.'); }

             if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
                 console.warn(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Finish Reason: ${candidate.finishReason}.`);
                 if (candidate.finishReason === 'SAFETY') throw new Error('Odpověď blokována bezpečnostním filtrem AI.');
                  // Если не STOP, но есть контент, пытаемся обработать
                  if (!candidate.content?.parts?.[0]?.text) {
                       throw new Error(`Generování zastaveno: ${candidate.finishReason}.`);
                  }
             }

             let resultJsonText = candidate.content?.parts?.[0]?.text;

             if (!resultJsonText) { throw new Error('AI vrátilo prázdnou odpověď.'); }

              // Попытка очистить JSON от возможных артефактов ```json ... ```
              const jsonMatch = resultJsonText.match(/```json\s*([\s\S]*?)\s*```/);
              if (jsonMatch && jsonMatch[1]) {
                  resultJsonText = jsonMatch[1];
              }

             console.log(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Získaný text JSON (po očištění):`, resultJsonText);

             try {
                 const result = JSON.parse(resultJsonText);
                 console.log(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Parsovaný výsledek JSON:`, result);

                 // Валидация JSON ответа
                 if (typeof result.score !== 'number' || typeof result.correctness !== 'string' || typeof result.reasoning !== 'string') {
                     console.warn(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Chybí povinné klíče v JSON. Používám fallback.`, result);
                     return runFallbackCheck();
                 }
                 const potentialScore = Math.round(result.score);
                 if (potentialScore < 0 || potentialScore > maxScore) {
                     console.warn(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Neplatné skóre ${potentialScore} (max ${maxScore}). Používám fallback.`);
                     return runFallbackCheck();
                 }

                 // Корректировка correctness на основе is_equivalent (если это не construction)
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
             } catch (e) {
                 console.error(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Nepodařilo se parsovat JSON:`, e, "Odpověď:", resultJsonText);
                 return runFallbackCheck();
             }

         } catch (error) {
             console.error(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Selhalo volání API:`, error);
             return runFallbackCheck();
         }
     }
    // --- END: Логика оценки ответов ---

    // --- START: Логика расчета и сохранения результатов (без изменений) ---
    function calculateFinalResultsLogic(userAnswers, questions) { let totalRawPointsAchieved = 0; let totalRawMaxPossiblePoints = 0; let correctCount = 0; let incorrectCount = 0; let partialCount = 0; let skippedCount = 0; let topicStats = {}; userAnswers.forEach((answer, index) => { if (!answer) { console.warn(`[Logic Calc] Chybí data odpovědi pro index ${index}.`); skippedCount++; return; } const q = questions[index]; const topicKey = answer.topic_id || answer.topic_name || 'unknown'; const topicName = answer.topic_name || 'Neznámé téma'; if (!topicStats[topicKey]) { topicStats[topicKey] = { name: topicName, id: answer.topic_id, total_questions: 0, fully_correct: 0, points_achieved: 0, max_points: 0, score_percent: 0, strength: 'neutral' }; } topicStats[topicKey].total_questions++; topicStats[topicKey].max_points += answer.maxScore; totalRawMaxPossiblePoints += answer.maxScore; if (answer.correctness === "skipped") { skippedCount++; } else if (answer.correctness === "error") { incorrectCount++; } else { const awardedScore = answer.scoreAwarded ?? 0; totalRawPointsAchieved += awardedScore; topicStats[topicKey].points_achieved += awardedScore; if (answer.correctness === "correct") { correctCount++; topicStats[topicKey].fully_correct++; } else if (answer.correctness === "partial") { partialCount++; } else { incorrectCount++; } } }); Object.values(topicStats).forEach(stats => { stats.score_percent = stats.max_points > 0 ? Math.round((stats.points_achieved / stats.max_points) * 100) : 0; stats.strength = stats.score_percent >= 75 ? 'strength' : (stats.score_percent < 50 ? 'weakness' : 'neutral'); }); const totalApplicableQuestions = questions.length - skippedCount; const finalPercentage = totalApplicableQuestions > 0 ? Math.round((correctCount / totalApplicableQuestions) * 100) : 0; const finalScoreOutOf50 = totalRawMaxPossiblePoints > 0 ? Math.round((totalRawPointsAchieved / totalRawMaxPossiblePoints) * 50) : 0; const resultsData = { totalQuestions: questions.length, correctAnswers: correctCount, incorrectAnswers: incorrectCount, partiallyCorrectAnswers: partialCount, skippedAnswers: skippedCount, evaluationErrors: userAnswers.filter(a => a?.correctness === 'error').length, score: finalScoreOutOf50, totalPointsAchieved: totalRawPointsAchieved, totalMaxPossiblePoints: totalRawMaxPossiblePoints, percentage: finalPercentage, topicResults: topicStats }; console.log("[Logic] Finální výsledky vypočítány:", resultsData); return resultsData; }
    function generateDetailedAnalysisLogic(results, answers, questionsData) { const analysis = { summary: { score: results.score, total_points_achieved: results.totalPointsAchieved, total_max_possible_points: results.totalMaxPossiblePoints, percentage: results.percentage, time_spent_seconds: results.timeSpent, total_questions: results.totalQuestions, correct: results.correctAnswers, incorrect: results.incorrectAnswers, partial: results.partiallyCorrectAnswers, skipped: results.skippedAnswers, evaluation_errors: results.evaluationErrors, }, strengths: [], weaknesses: [], performance_by_topic: {}, performance_by_type: {}, performance_by_difficulty: {}, incorrectly_answered_details: [] }; for (const [topicKey, stats] of Object.entries(results.topicResults || {})) { analysis.performance_by_topic[stats.name] = { points_achieved: stats.points_achieved, max_points: stats.max_points, score_percent: stats.score_percent, total_questions: stats.total_questions, fully_correct: stats.fully_correct }; if (stats.strength === 'strength') analysis.strengths.push({ topic: stats.name, score: stats.score_percent }); else if (stats.strength === 'weakness') analysis.weaknesses.push({ topic: stats.name, score: stats.score_percent }); } analysis.strengths.sort((a, b) => b.score - a.score); analysis.weaknesses.sort((a, b) => a.score - b.score); answers.forEach((answer) => { if (!answer || answer.correctness === 'error') return; const qType = answer.question_type; const difficulty = answer.difficulty; const maxQScore = answer.maxScore; const awardedScore = answer.scoreAwarded ?? 0; if (!analysis.performance_by_type[qType]) analysis.performance_by_type[qType] = { points_achieved: 0, max_points: 0, count: 0 }; analysis.performance_by_type[qType].points_achieved += awardedScore; analysis.performance_by_type[qType].max_points += maxQScore; analysis.performance_by_type[qType].count++; if (difficulty !== null && difficulty !== undefined) { if (!analysis.performance_by_difficulty[difficulty]) analysis.performance_by_difficulty[difficulty] = { points_achieved: 0, max_points: 0, count: 0 }; analysis.performance_by_difficulty[difficulty].points_achieved += awardedScore; analysis.performance_by_difficulty[difficulty].max_points += maxQScore; analysis.performance_by_difficulty[difficulty].count++; } if (answer.correctness === 'incorrect' || answer.correctness === 'partial') { analysis.incorrectly_answered_details.push({ question_number: answer.question_number_in_test, question_text: answer.question_text, topic: answer.topic_name, type: answer.question_type, user_answer: answer.userAnswerValue, correct_answer: answer.correct_answer, score_awarded: awardedScore, max_score: maxQScore, explanation: answer.reasoning, error_identified: answer.error_analysis }); } }); if (results.score >= 43) analysis.overall_assessment = "Vynikající výkon!"; else if (results.score >= 33) analysis.overall_assessment = "Dobrý výkon, solidní základ."; else if (results.score >= 20) analysis.overall_assessment = "Průměrný výkon, zaměřte se na slabiny."; else analysis.overall_assessment = `Výkon ${results.score < 10 ? 'výrazně ' : ''}pod průměrem. Nutné opakování.`; if (results.score < SCORE_THRESHOLD_FOR_SAVING) analysis.overall_assessment += " Skóre je příliš nízké pro uložení a generování plánu."; analysis.recommendations = analysis.weaknesses.length > 0 ? [`Intenzivně se zaměřte na nejslabší témata: ${analysis.weaknesses.map(w => w.topic).slice(0, 2).join(', ')}.`] : ["Pokračujte v upevňování znalostí."]; if (analysis.incorrectly_answered_details.length > 3) analysis.recommendations.push(`Projděte si ${analysis.incorrectly_answered_details.length} otázek s nízkým nebo částečným skóre.`); console.log("[Logic Analysis] Vygenerována detailní analýza:", analysis); return analysis; }
    async function saveTestResultsLogic(supabase, currentUser, testResultsData, userAnswers, questions, testEndTime) { if (!currentUser || currentUser.id === 'PLACEHOLDER_USER_ID' || !supabase) { console.warn("[Logic Save] Neukládám: Chybí uživatel nebo Supabase."); return { success: false, error: "Uživatel není přihlášen." }; } if (testResultsData.score < SCORE_THRESHOLD_FOR_SAVING) { console.log(`[Logic Save] Skóre (${testResultsData.score}/50) < ${SCORE_THRESHOLD_FOR_SAVING}. Přeskakuji ukládání.`); return { success: false, error: `Skóre je příliš nízké (<${SCORE_THRESHOLD_FOR_SAVING}) pro uložení.` }; } console.log(`[Logic Save] Pokouším se uložit výsledky...`); let savedDiagnosticId = null; try { const detailedAnalysis = generateDetailedAnalysisLogic(testResultsData, userAnswers, questions); const answersToSave = userAnswers.map(a => ({ question_db_id: a.question_db_id, question_number_in_test: a.question_number_in_test, question_type: a.question_type, topic_id: a.topic_id, difficulty: a.difficulty, userAnswerValue: a.userAnswerValue, scoreAwarded: a.scoreAwarded, maxScore: a.maxScore, correctness: a.correctness, reasoning: a.reasoning, error_analysis: a.error_analysis, feedback: a.feedback, checked_by: a.checked_by })); const dataToSave = { user_id: currentUser.id, completed_at: testEndTime ? testEndTime.toISOString() : new Date().toISOString(), total_score: testResultsData.score, total_questions: testResultsData.totalQuestions, answers: answersToSave, topic_results: testResultsData.topicResults, analysis: detailedAnalysis, time_spent: testResultsData.timeSpent }; console.log("[Logic Save] Data k uložení:", dataToSave); const { data, error } = await supabase.from('user_diagnostics').insert(dataToSave).select('id').single(); if (error) throw error; savedDiagnosticId = data.id; console.log("[Logic Save] Diagnostika uložena, ID:", savedDiagnosticId); if (typeof VyukaApp?.checkAndAwardAchievements === 'function') { console.log('[Achievements] Triggering check after saving test results...'); VyukaApp.checkAndAwardAchievements(currentUser.id); } else { console.warn("[Achievements] Check function (VyukaApp.checkAndAwardAchievements) not found after saving test results."); } return { success: true, diagnosticId: savedDiagnosticId }; } catch (error) { console.error('[Logic Save] Chyba při ukládání:', error); return { success: false, error: `Nepodařilo se uložit výsledky: ${error.message}`, diagnosticId: savedDiagnosticId }; } }
    async function awardPointsLogic(supabase, currentUser, currentProfile, selectedTestType, testResultsData, testTypeConfig) { if (!selectedTestType || !testResultsData || testResultsData.totalQuestions <= 0 || !currentUser || !currentProfile || !supabase) { console.warn("[Logic Points] Nelze vypočítat/uložit body: Chybí data."); return; } const config = testTypeConfig[selectedTestType]; if (!config) { console.warn(`[Logic Points] Neznámá konfigurace testu: ${selectedTestType}`); return; } const n = config.multiplier; const r = testResultsData.correctAnswers; const t = testResultsData.totalQuestions; if (t === 0) { console.warn("[Logic Points] Počet otázek je 0."); return { success: true, awardedPoints: 0, newTotal: currentProfile.points }; } const calculatedPoints = Math.round(n * (r / t) * 10); if (calculatedPoints <= 0) { console.log("[Logic Points] Nebyly získány žádné body."); return { success: true, awardedPoints: 0, newTotal: currentProfile.points }; } console.log(`[Logic Points] Vypočítané body: ${calculatedPoints} (n=${n}, r=${r}, t=${t})`); const currentPoints = currentProfile.points || 0; const newPoints = currentPoints + calculatedPoints; try { const { error } = await supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (error) throw error; console.log(`[Logic Points] Body uživatele ${currentUser.id} aktualizovány na ${newPoints} (+${calculatedPoints})`); if (typeof VyukaApp?.checkAndAwardAchievements === 'function') { console.log('[Achievements] Triggering check after awarding points...'); VyukaApp.checkAndAwardAchievements(currentUser.id); } else { console.warn("[Achievements] Check function (VyukaApp.checkAndAwardAchievements) not found after awarding points."); } return { success: true, awardedPoints: calculatedPoints, newTotal: newPoints }; } catch (error) { console.error("[Logic Points] Chyba při aktualizaci bodů:", error); return { success: false, error: error.message, awardedPoints: 0, newTotal: currentPoints }; } }
    // --- END: Логика расчета и сохранения результатов ---

    // --- START: Проверка существующего теста (без изменений) ---
    async function checkExistingDiagnosticLogic(supabase, userId) { if (!userId || userId === 'PLACEHOLDER_USER_ID' || !supabase) { console.warn("[Logic Check] Kontrola testu přeskočena (není user/supabase)."); return false; } try { const { data: existingDiagnostic, error } = await supabase.from('user_diagnostics').select('id, completed_at').eq('user_id', userId).limit(1); if (error) { console.error("[Logic Check] Chyba při kontrole existujícího testu:", error); return false; } return existingDiagnostic && existingDiagnostic.length > 0; } catch (err) { console.error("[Logic Check] Neočekávaná chyba při kontrole testu:", err); return false; } }
    // --- END: Проверка существующего теста ---

    // --- START: Логика Уведомлений (без изменений) ---
    async function fetchNotificationsLogic(supabase, userId, limit = NOTIFICATION_FETCH_LIMIT) { if (!supabase || !userId) { console.error("[Notifications Logic] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications Logic] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await supabase .from('user_notifications') .select('*', { count: 'exact' }) .eq('user_id', userId) .eq('is_read', false) .order('created_at', { ascending: false }) .limit(limit); if (error) throw error; console.log(`[Notifications Logic] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications Logic] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; } }
    // --- END: Логика Уведомлений ---


    // --- START: Глобальный Экспорт ---
    global.TestLogic = {
        loadTestQuestions: loadTestQuestionsLogic,
        checkAnswerWithGemini: checkAnswerWithGeminiLogic,
        calculateFinalResults: calculateFinalResultsLogic,
        generateDetailedAnalysis: generateDetailedAnalysisLogic,
        saveTestResults: saveTestResultsLogic,
        awardPoints: awardPointsLogic,
        checkExistingDiagnostic: checkExistingDiagnosticLogic,
        fetchNotifications: fetchNotificationsLogic, // Экспорт новой функции
        SCORE_THRESHOLD_FOR_SAVING: SCORE_THRESHOLD_FOR_SAVING, // Экспорт константы
        compareNumericAdvanced: compareNumericAdvanced, // Экспорт для возможного использования в UI (хотя не рекомендуется)
        compareTextAdvanced: compareTextAdvanced, // Экспорт для возможного использования в UI (хотя не рекомендуется)
    };
    console.log("test1-logic.js loaded and TestLogic exposed (v3 - Achievement Triggers + Evaluation Fix).");
    // --- END: Глобальный Экспорт ---

})(window);