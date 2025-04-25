// Файл: test1-logic.js
// Содержит основную логику для загрузки теста, оценки ответов, сохранения результатов и загрузки уведомлений.
// Версия: v4 - Исправлена ошибка VyukaApp, улучшено сравнение ano/ne

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

	// --- START: Вспомогательные функции ---
	function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[array[i], array[j]] = [array[j], array[i]]; } return array; }

	// Helper function to normalize and compare numeric values, including fractions and mixed numbers.
    function compareNumericAdvanced(val1, val2, tolerance = 0.001) {
        if (val1 === null || val1 === undefined || val2 === null || val2 === undefined) return null; // Cannot compare if null/undefined

        const normalize = (v) => {
            if (typeof v === 'number') return v;
            if (typeof v !== 'string') return NaN;

            let str = String(v).trim() // Ensure it's a string and trim whitespace
                           .replace(',', '.') // Standardize decimal separator
                           .replace(/\s+/g, '') // Remove internal spaces (e.g., "3 140")
                           .replace(/kč|czk|%|cm|m|kg|g|°/gi, '') // Remove common units/symbols
                           .trim(); // Trim again after replacements

            // Handle fractions (e.g., "3/2")
            if (str.includes('/') && !str.includes(' ') && !isNaN(parseFloat(str.split('/')[0])) && !isNaN(parseFloat(str.split('/')[1])) && parseFloat(str.split('/')[1]) !== 0) {
                 const parts = str.split('/');
                 const num = parseFloat(parts[0]);
                 const den = parseFloat(parts[1]);
                 if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
             }

            // Handle mixed numbers (e.g., "1 1/2" or "-2 3/4") - Adjusted regex
            const mixedMatch = str.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
             if (mixedMatch) {
                 const whole = parseFloat(mixedMatch[1]);
                 const num = parseFloat(mixedMatch[2]);
                 const den = parseFloat(mixedMatch[3]);
                 if (!isNaN(whole) && !isNaN(num) && !isNaN(den) && den !== 0) {
                     const sign = whole < 0 ? -1 : 1;
                     return whole + sign * (num / den);
                 }
             }

            // Handle regular numbers (including decimals)
            return parseFloat(str); // Returns NaN if parsing fails
        };

        const num1 = normalize(val1);
        const num2 = normalize(val2);

        console.log(`[compareNumeric] Porovnávám normalizované: ${num1} vs ${num2}`);

        if (isNaN(num1) || isNaN(num2)) {
            // Fallback: If both are strings and cannot be parsed as numbers, do a case-insensitive text comparison.
            if (typeof val1 === 'string' && typeof val2 === 'string' && String(val1).trim().toLowerCase() === String(val2).trim().toLowerCase()) {
                 console.log("[compareNumeric] Shoda jako text (po selhání numerického parsování).");
                 return true;
             }
             console.log("[compareNumeric] Nelze porovnat numericky (NaN nebo nekompatibilní typy).");
             return null; // Indicate comparison failure
         }

        // Perform numeric comparison with tolerance
        const areEquivalent = Math.abs(num1 - num2) < tolerance;
        console.log(`[compareNumeric] Numerický výsledek (tolerance ${tolerance}): ${areEquivalent}`);
        return areEquivalent;
    }

    // Helper function to compare text, focusing on core "ano"/"ne" meaning.
	function compareTextAdvanced(val1, val2) {
		if (val1 === null || val1 === undefined || val2 === null || val2 === undefined) return false;

		const normalize = (v) => {
			let str = String(v).trim().toLowerCase()
						   // Remove leading list markers (a., 1), etc. + optional equals sign
						   .replace(/^[a-z0-9][\.\)\s]*=*\s*/, '')
						   // Remove extra text often added by Cermat like "(Neplatný text)"
						   .replace(/\(.*\)/, '')
						   // Remove trailing punctuation
						   .replace(/[.,!?;:]+$/, '')
						   .trim();
			// Extract only the first word if it's 'ano' or 'ne'
			if (str.startsWith('ano') || str.startsWith('ne')) {
				return str.split(/[\s\.\(]/)[0];
			}
			// For other text, return the processed string
			return str;
		};

		const norm1 = normalize(val1);
		const norm2 = normalize(val2);

		console.log(`[compareText v2] Porovnávám normalizované: '${norm1}' vs '${norm2}'`);
		const areEquivalent = norm1 === norm2;
		console.log(`[compareText v2] Výsledek: ${areEquivalent}`);
		return areEquivalent;
	}
	// --- END: Вспомогательные функции ---

	// --- START: Логика загрузки вопросов ---
	async function loadTestQuestionsLogic(supabase, testType, testTypeConfig) {
        if (!supabase) throw new Error("Supabase client není inicializován.");
        if (!testType || !testTypeConfig[testType]) throw new Error(`Neznámý typ testu: ${testType}`);

        const config = testTypeConfig[testType];
        const questionCount = config.questionsCount;
        console.log(`[Logic] Načítání ${questionCount} otázek pro typ: ${testType}...`);

        const { data: allQuestions, error: fetchError } = await supabase
            .from('exam_questions')
            .select(`
                id, question_text, question_type, options, correct_answer,
                solution_explanation, topic_id, subtopic_id, difficulty, image_url,
                source_year, source_exam_type,
                topic:topic_id ( id, name ),
                subtopic:subtopic_id ( id, name )
            `); // Select all for now, will shuffle and slice

        if (fetchError) {
            console.error("[Logic] Chyba při načítání otázek:", fetchError);
            throw new Error(`Chyba databáze při načítání otázek: ${fetchError.message}`);
        }

        if (!allQuestions || allQuestions.length === 0) {
            console.error("[Logic] Databáze nevrátila žádné otázky.");
            throw new Error("V databázi nejsou žádné otázky pro tento test.");
        }

        console.log(`[Logic] Celkem načteno ${allQuestions.length} otázek z DB.`);
        const shuffledQuestions = shuffleArray([...allQuestions]); // Shuffle a copy
        const selectedQuestions = shuffledQuestions.slice(0, questionCount);

        if (selectedQuestions.length < questionCount) {
            console.warn(`[Logic] Nalezeno pouze ${selectedQuestions.length} otázek, požadováno ${questionCount}.`);
            if(selectedQuestions.length === 0) throw new Error("Nepodařilo se načíst žádné relevantní otázky.");
        }

        const formattedQuestions = selectedQuestions.map((q, index) => ({
            id: q.id,
            question_number: index + 1,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options,
            correct_answer: q.correct_answer,
            solution_explanation: q.solution_explanation || "Oficiální postup není k dispozici.",
            topic_id: q.topic_id,
            topic_name: q.topic ? q.topic.name : "Neznámé téma",
            subtopic_id: q.subtopic_id,
            subtopic_name: q.subtopic ? q.subtopic.name : "",
            difficulty: q.difficulty,
            image_url: q.image_url,
            source_year: q.source_year,
            source_exam_type: q.source_exam_type
        }));

        console.log("[Logic] Vybrané a formátované otázky:", formattedQuestions.length);
        return formattedQuestions;
    }
	// --- END: Логика загрузки вопросов ---

	// --- START: Логика оценки ответов (Gemini) ---
	async function checkAnswerWithGeminiLogic(questionType, questionText, correctAnswerOrExplanation, userAnswer, maxScore = 1, currentQuestionIndex) {
        console.log(`--- [Logic] Vyhodnocování Q#${currentQuestionIndex + 1} (Typ: ${questionType}, Max bodů: ${maxScore}) ---`);
        console.log(`   Otázka: ${String(questionText).substring(0, 100)}...`); // Ensure string conversion
        console.log(`   Správně: `, correctAnswerOrExplanation);
        console.log(`   Uživatel: `, userAnswer);

        const defaultResult = {
            score: 0,
            max_score: maxScore,
            correctness: "skipped",
            reasoning: "Odpověď nebyla poskytnuta nebo je prázdná.",
            error_analysis: null,
            feedback: null,
            is_equivalent: null
        };

        // Handle skipped/empty answers
        if (userAnswer === null || String(userAnswer).trim() === "") {
            console.log("   Odpověď prázdná. Vracím výchozí výsledek.");
            return defaultResult;
        }

        // If not skipped, default to incorrect unless proven otherwise
        defaultResult.correctness = "incorrect";
        defaultResult.reasoning = "Automatické hodnocení selhalo (fallback)."; // Default reasoning for errors/fallbacks

        // --- Fallback Logic Definition ---
        const runFallbackCheck = () => {
            console.warn(`!!! [Logic Fallback Q#${currentQuestionIndex + 1}] Používá se FALLBACK logika pro vyhodnocení !!!`);
            let fallbackScore = 0;
            let fallbackCorrectness = "incorrect";
            let fallbackReasoning = "Automatické hodnocení selhalo. Použita základní kontrola.";
            let isEquivalent = null;

            try {
                if (questionType === 'multiple_choice') {
                    // Normalize both correct and user answers by taking the first letter
                    const correctLetter = String(correctAnswerOrExplanation).trim().toUpperCase().charAt(0);
                    const userLetter = String(userAnswer).trim().toUpperCase().charAt(0);
                    isEquivalent = correctLetter === userLetter;
                    if (isEquivalent) {
                        fallbackScore = maxScore;
                        fallbackCorrectness = "correct";
                        fallbackReasoning = "Odpověď (písmeno) se shoduje se správnou možností.";
                    } else {
                        fallbackReasoning = `Nesprávně zvolená možnost. Správná odpověď je ${correctLetter}.`;
                    }
                } else if (questionType === 'ano_ne') {
                    // Use compareTextAdvanced for flexible ano/ne check
                    isEquivalent = compareTextAdvanced(userAnswer, correctAnswerOrExplanation);
                    if (isEquivalent === true) {
                        fallbackScore = maxScore;
                        fallbackCorrectness = "correct";
                        fallbackReasoning = "Odpověď Ano/Ne je správná.";
                    } else {
                        // No partial credit for ano/ne
                        fallbackReasoning = `Odpověď Ano/Ne je nesprávná. Správně je ${correctAnswerOrExplanation}.`;
                    }
                } else if (['numeric', 'text'].includes(questionType)) {
                    // Prioritize numeric comparison if possible
                    const numericComparison = compareNumericAdvanced(userAnswer, correctAnswerOrExplanation);
                    if (numericComparison === true) { // Strict true check
                        isEquivalent = true;
                        fallbackScore = maxScore;
                        fallbackCorrectness = "correct";
                        fallbackReasoning = "Odpověď je numericky/logicky ekvivalentní správné odpovědi.";
                    } else {
                        // Fallback to text comparison if numeric failed or not applicable
                        const textComparison = compareTextAdvanced(userAnswer, correctAnswerOrExplanation);
                         if (textComparison === true) {
                            isEquivalent = true; // Mark as equivalent even if format differs slightly
                            fallbackScore = maxScore;
                            fallbackCorrectness = "correct";
                            fallbackReasoning = "Odpověď se textově shoduje (po normalizaci).";
                         } else {
                            isEquivalent = false;
                             fallbackReasoning = "Odpověď není numericky ani textově ekvivalentní.";
                             // Consider partial score for text type if there's some overlap? (More complex)
                             // For now, stick to incorrect if not equivalent.
                         }
                    }
                } else if (questionType === 'construction') {
                    isEquivalent = false; // Cannot easily determine equivalence for constructions
                    // Basic check: Award partial if description seems substantial
                    fallbackScore = (String(userAnswer).trim().length > 15) ? Math.min(1, maxScore) : 0;
                    fallbackCorrectness = fallbackScore > 0 ? "partial" : "incorrect";
                    fallbackReasoning = "Základní fallback hodnocení pro popis konstrukce (kontrola délky). Detailní hodnocení selhalo.";
                }
            } catch (e) {
                console.error(`[Logic Fallback Q#${currentQuestionIndex + 1}] Chyba při fallback porovnání:`, e);
                fallbackScore = 0;
                fallbackCorrectness = "error"; // Specific error state
                fallbackReasoning = "Chyba při záložním hodnocení.";
                isEquivalent = null;
            }

            console.log(`[Logic Fallback Výsledek Q#${currentQuestionIndex + 1}] Skóre: ${fallbackScore}/${maxScore}, Správnost: ${fallbackCorrectness}, Ekvivalent: ${isEquivalent}`);
            return {
                score: fallbackScore,
                max_score: maxScore,
                correctness: fallbackCorrectness,
                reasoning: fallbackReasoning,
                error_analysis: fallbackCorrectness === 'error' ? 'Chyba fallback logiky' : (fallbackCorrectness === 'incorrect' ? 'Neshoda s výsledkem' : null),
                feedback: fallbackCorrectness !== 'correct' ? "Pro detailní hodnocení zkuste znovu, pokud problém přetrvává, kontaktujte podporu." : null,
                is_equivalent: isEquivalent
            };
        };
        // --- End Fallback Logic Definition ---

        // Check for API Key before attempting call
        if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR_') || GEMINI_API_KEY.length < 10) {
            console.warn(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Chybí platný Gemini API klíč. Používám fallback.`);
            return runFallbackCheck();
        }

        let prompt;
        const baseInstruction = `Jsi PŘÍSNÝ a DETAILNÍ AI hodnotitel odpovědí z PŘIJÍMACÍCH ZKOUŠEK z matematiky/logiky pro 9. třídu ZŠ v ČR. Tvým úkolem je komplexně posoudit odpověď studenta vůči správnému řešení/odpovědi v kontextu dané otázky. MUSÍŠ vrátit POUZE JSON objekt podle PŘESNĚ definované struktury. NEPŘIDÁVEJ žádný text mimo JSON.`;
        const outputStructure = `{ "score": number (0-${maxScore}, celé číslo), "max_score": ${maxScore}, "correctness": string ("correct" | "incorrect" | "partial" | "skipped"), "reasoning": string (DETAILNÍ zdůvodnění skóre a vysvětlení správného postupu/odpovědi v ČEŠTINĚ), "error_analysis": string | null (KONKRÉTNÍ popis chyby studenta v ČEŠTINĚ - např. "chyba ve výpočtu", "nepochopení pojmu", "špatný vzorec", "chybějící krok", "formální chyba"; null pokud správně), "feedback": string | null (Krátká konstruktivní rada pro studenta v ČEŠTINĚ, na co si dát pozor nebo co procvičit; null pokud správně), "is_equivalent": boolean | null (Pouze pro typy 'numeric', 'text', 'ano_ne'. True, pokud je odpověď uživatele matematicky/logicky správná i přes jiný formát. Null pro jiné typy nebo pokud nelze určit.) }`;
        const questionContext = `Kontext otázky: """${questionText}"""`;
        const inputData = `SPRÁVNÁ ODPOVĚĎ/ŘEŠENÍ: """${correctAnswerOrExplanation}"""\nODPOVĚĎ STUDENTA: """${userAnswer}"""`;

        if (questionType === 'construction') {
            prompt = `${baseInstruction} Typ otázky: Popis konstrukce. Maximální skóre: ${maxScore}. ${questionContext} PRAVIDLA HODNOCENÍ (PŘÍSNĚ DODRŽUJ): 1. Identifikuj KLÍČOVÉ kroky v oficiálním postupu. 2. Posuď, zda popis studenta obsahuje VŠECHNY klíčové kroky ve SPRÁVNÉM logickém pořadí. 3. Skóre: - ${maxScore} bodů (correct): Popis kompletní, věcně správný, logicky seřazený. - 1 bod (partial): Hlavní myšlenka správná, ALE chybí JEDEN méně podstatný krok NEBO obsahuje JEDNU či DVĚ menší nepřesnosti/nejasnosti. - 0 bodů (incorrect): Zásadně chybný, chybí VÍCE kroků, špatné pořadí, VÍCE chyb, nesrozumitelný. 4. Zdůvodnění: PODROBNĚ vysvětli, proč bylo skóre uděleno, které kroky chybí/jsou špatně. 5. Error Analysis: Popiš KONKRÉTNÍ chyby (např. "chybí kružnice k nalezení bodu C", "špatné pořadí kroků", "nejednoznačný popis"). 6. Feedback: Navrhni, na co se zaměřit (např. "procvičit konstrukci osy úhlu", "dbát na přesný popis kroků"). ${inputData} ÚKOL: Pečlivě porovnej. Vrať POUZE JSON objekt podle této struktury: ${outputStructure}`;
        } else if (questionType === 'multiple_choice') {
            prompt = `${baseInstruction} Typ otázky: Výběr z možností. Maximální skóre: ${maxScore}. ${questionContext} PRAVIDLA: Porovnej POUZE PÍSMENO na začátku odpovědi studenta (case-insensitive) se správným písmenem. SKÓRE: ${maxScore} bodů (correct) POKUD se normalizované písmeno shoduje, jinak 0 (incorrect). Zdůvodnění: Uveď správné písmeno a proč je daná možnost správná (stručně). Pokud je odpověď špatně, uveď i proč je špatně. Error Analysis: Pokud špatně, uveď "vybrána nesprávná možnost". Feedback: Pokud špatně, navrhni "pečlivě číst všechny možnosti" nebo podobně. ${inputData} ÚKOL: Vrať POUZE JSON objekt podle této struktury: ${outputStructure}`;
        } else { // Handles numeric, text, ano_ne
            // Modified prompt for ano_ne to emphasize core meaning
            const typeSpecificInstruction = questionType === 'ano_ne'
                ? `Typ otázky: Ano/Ne. Maximální skóre: ${maxScore}. ${questionContext} PRAVIDLA: 1. Ekvivalence (is_equivalent): Posuď, zda odpověď studenta vyjadřuje SPRÁVNOU ANO/NE odpověď, i když je formát jiný (např. "A. ano", "Ne.", "ANO (s vysvětlením)"). Ignoruj velká/malá písmena a okolní text. Zaměř se na jádro ano/ne. 2. Skóre: ${maxScore} bodů (correct) POKUD je jádro odpovědi správné ano/ne, jinak 0 (incorrect). 3. Zdůvodnění: Vysvětli, proč je tvrzení pravdivé/nepravdivé. Uveď, zda byla odpověď uznána jako ekvivalentní. 4. Error Analysis: Pokud incorrect, uveď "nesprávná odpověď ano/ne". 5. Feedback: Pokud incorrect, navrhni "zkontrolovat zadání/výpočet". ${inputData} ÚKOL: Posuď shodu jádra ANO/NE. Vrať POUZE JSON objekt podle této struktury: ${outputStructure}`
                : `${baseInstruction} Typ otázky: ${questionType === 'numeric' ? 'Numerická/Výpočetní' : 'Textová/Symbolická'}. Maximální skóre: ${maxScore}. ${questionContext} PRAVIDLA: 1. Ekvivalence (is_equivalent): MUSÍŠ posoudit, zda je odpověď studenta MATEMATICKY/LOGICKY ekvivalentní správné odpovědi, i když formát může být jiný (např. zlomek vs desetinné číslo, jednotky, pořadí u množin, drobné překlepy neovlivňující význam). Buď flexibilní u čísel. Přísnější u textu/symbolů. 2. Skóre: ${maxScore} bodů (correct) POKUD je ekvivalentní, jinak 0 (incorrect). 3. Zdůvodnění: Vysvětli, proč je/není odpověď správná a jaký je správný výsledek/postup. Uveď, zda byla odpověď uznána jako ekvivalentní. 4. Error Analysis: Pokud incorrect, KONKRÉTNĚ popiš chybu (např. "chyba ve výpočtu", "špatná jednotka", "nesprávný termín", "překlep měnící význam"). 5. Feedback: Pokud incorrect, navrhni co zlepšit (např. "zkontrolovat znaménka", "převádět jednotky", "naučit se definici"). ${inputData} ÚKOL: Posuď ekvivalenci a správnost. Vrať POUZE JSON objekt podle této struktury: ${outputStructure}`;
            prompt = typeSpecificInstruction;
        }

        try {
            console.log(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Posílám požadavek...`);
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.15, // Lower temp for more deterministic evaluation
                        responseMimeType: "application/json"
                    },
                    safetySettings: [ // Keep safety settings
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

            // Check finish reason, allow STOP and potentially MAX_TOKENS (though max_tokens might truncate JSON)
            if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
                console.warn(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Finish Reason: ${candidate.finishReason}.`);
                if (candidate.finishReason === 'SAFETY') {
                    throw new Error('Odpověď blokována bezpečnostním filtrem AI.');
                }
                // Could potentially return fallback here for other non-STOP reasons
                // return runFallbackCheck();
            }

            const resultJsonText = candidate.content?.parts?.[0]?.text;
            if (!resultJsonText) { throw new Error('AI vrátilo prázdnou odpověď.'); }
            console.log(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Získaný text JSON:`, resultJsonText);

            try {
                const result = JSON.parse(resultJsonText);
                console.log(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Parsovaný výsledek JSON:`, result);

                // Validate core fields
                if (typeof result.score !== 'number' || typeof result.correctness !== 'string' || typeof result.reasoning !== 'string') {
                    console.warn(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Chybí povinné klíče v JSON. Používám fallback.`, result);
                    return runFallbackCheck();
                }

                // Validate score range
                const potentialScore = Math.round(result.score);
                if (potentialScore < 0 || potentialScore > maxScore) {
                    console.warn(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Neplatné skóre ${potentialScore} (max ${maxScore}). Používám fallback.`);
                    return runFallbackCheck();
                }

                // Validate correctness value
                const validCorrectness = ["correct", "incorrect", "partial", "skipped"];
                const finalCorrectness = validCorrectness.includes(result.correctness) ? result.correctness : "incorrect"; // Default to incorrect if invalid

                // Validate boolean/null for is_equivalent
                let finalIsEquivalent = null;
                if (['numeric', 'text', 'ano_ne'].includes(questionType)) {
                    finalIsEquivalent = typeof result.is_equivalent === 'boolean' ? result.is_equivalent : null;
                }

                return {
                    score: potentialScore,
                    max_score: maxScore,
                    correctness: finalCorrectness,
                    reasoning: result.reasoning || "Nebylo poskytnuto žádné zdůvodnění.",
                    error_analysis: result.error_analysis || null,
                    feedback: result.feedback || null,
                    is_equivalent: finalIsEquivalent
                };

            } catch (e) {
                console.error(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Nepodařilo se parsovat JSON:`, e, "Odpověď:", resultJsonText);
                return runFallbackCheck(); // Use fallback if JSON parsing fails
            }
        } catch (error) {
            console.error(`[Logic Gemini Call Q#${currentQuestionIndex + 1}] Selhalo volání API:`, error);
            return runFallbackCheck(); // Use fallback if API call fails
        }
    }
	// --- END: Логика оценки ответов ---

	// --- START: Логика расчета и сохранения результатов ---
	function calculateFinalResultsLogic(userAnswers, questions) {
        let totalRawPointsAchieved = 0;
        let totalRawMaxPossiblePoints = 0;
        let correctCount = 0;
        let incorrectCount = 0;
        let partialCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let topicStats = {};

        userAnswers.forEach((answer, index) => {
            if (!answer) {
                console.warn(`[Logic Calc] Chybí data odpovědi pro index ${index}.`);
                skippedCount++;
                return;
            }

            const q = questions[index]; // Corresponding question data
            const topicKey = answer.topic_id || answer.topic_name || 'unknown';
            const topicName = answer.topic_name || 'Neznámé téma';
            const maxQScore = answer.maxScore;

            // Initialize topic stats if not present
            if (!topicStats[topicKey]) {
                topicStats[topicKey] = {
                    name: topicName,
                    id: answer.topic_id,
                    total_questions: 0,
                    fully_correct: 0,
                    points_achieved: 0,
                    max_points: 0,
                    score_percent: 0,
                    strength: 'neutral'
                };
            }

            topicStats[topicKey].total_questions++;
            topicStats[topicKey].max_points += maxQScore;
            totalRawMaxPossiblePoints += maxQScore;

            switch (answer.correctness) {
                case "skipped":
                    skippedCount++;
                    break;
                case "error":
                    errorCount++;
                    incorrectCount++; // Treat evaluation errors as incorrect for scoring
                    break;
                case "correct":
                    totalRawPointsAchieved += answer.scoreAwarded ?? 0;
                    topicStats[topicKey].points_achieved += answer.scoreAwarded ?? 0;
                    correctCount++;
                    topicStats[topicKey].fully_correct++;
                    break;
                case "partial":
                    totalRawPointsAchieved += answer.scoreAwarded ?? 0;
                    topicStats[topicKey].points_achieved += answer.scoreAwarded ?? 0;
                    partialCount++;
                    break;
                case "incorrect":
                    totalRawPointsAchieved += answer.scoreAwarded ?? 0; // Usually 0, but just in case
                    topicStats[topicKey].points_achieved += answer.scoreAwarded ?? 0;
                    incorrectCount++;
                    break;
                default:
                    console.warn(`[Logic Calc] Neznámý stav 'correctness': ${answer.correctness} pro Q#${index+1}`);
                    skippedCount++; // Treat unknown as skipped for calculation
            }
        });

        // Calculate percentage and strength for each topic
        Object.values(topicStats).forEach(stats => {
            stats.score_percent = stats.max_points > 0 ? Math.round((stats.points_achieved / stats.max_points) * 100) : 0;
            stats.strength = stats.score_percent >= 75 ? 'strength' : (stats.score_percent < 50 ? 'weakness' : 'neutral');
        });

        // Calculate overall percentage based on *answered* questions (excluding skipped and errors for percentage)
        const totalAnsweredQuestions = questions.length - skippedCount - errorCount;
        const finalPercentage = totalAnsweredQuestions > 0 ? Math.round((correctCount / totalAnsweredQuestions) * 100) : 0;

        // Calculate final score out of 50 based on points achieved vs max possible points
        const finalScoreOutOf50 = totalRawMaxPossiblePoints > 0 ? Math.round((totalRawPointsAchieved / totalRawMaxPossiblePoints) * 50) : 0;

        const resultsData = {
            totalQuestions: questions.length,
            correctAnswers: correctCount,
            incorrectAnswers: incorrectCount,
            partiallyCorrectAnswers: partialCount,
            skippedAnswers: skippedCount,
            evaluationErrors: errorCount,
            score: finalScoreOutOf50, // Score out of 50
            totalPointsAchieved: totalRawPointsAchieved,
            totalMaxPossiblePoints: totalRawMaxPossiblePoints,
            percentage: finalPercentage, // Percentage based on answered questions
            topicResults: topicStats
        };
        console.log("[Logic] Finální výsledky vypočítány:", resultsData);
        return resultsData;
    }

    function generateDetailedAnalysisLogic(results, answers, questionsData) {
        // This function seems okay, no changes needed based on the user request.
        // It calculates stats based on the evaluated 'results' object.
        const analysis = {
            summary: {
                score: results.score,
                total_points_achieved: results.totalPointsAchieved,
                total_max_possible_points: results.totalMaxPossiblePoints,
                percentage: results.percentage,
                time_spent_seconds: results.timeSpent,
                total_questions: results.totalQuestions,
                correct: results.correctAnswers,
                incorrect: results.incorrectAnswers,
                partial: results.partiallyCorrectAnswers,
                skipped: results.skippedAnswers,
                evaluation_errors: results.evaluationErrors,
            },
            strengths: [], weaknesses: [],
            performance_by_topic: {}, performance_by_type: {}, performance_by_difficulty: {},
            incorrectly_answered_details: []
        };

        for (const [topicKey, stats] of Object.entries(results.topicResults || {})) {
             analysis.performance_by_topic[stats.name] = {
                 points_achieved: stats.points_achieved,
                 max_points: stats.max_points,
                 score_percent: stats.score_percent,
                 total_questions: stats.total_questions,
                 fully_correct: stats.fully_correct
             };
             if (stats.strength === 'strength') analysis.strengths.push({ topic: stats.name, score: stats.score_percent });
             else if (stats.strength === 'weakness') analysis.weaknesses.push({ topic: stats.name, score: stats.score_percent });
         }
         analysis.strengths.sort((a, b) => b.score - a.score);
         analysis.weaknesses.sort((a, b) => a.score - b.score);

        answers.forEach((answer) => {
             if (!answer || answer.correctness === 'error') return;
             const qType = answer.question_type;
             const difficulty = answer.difficulty;
             const maxQScore = answer.maxScore;
             const awardedScore = answer.scoreAwarded ?? 0;

             if (!analysis.performance_by_type[qType]) analysis.performance_by_type[qType] = { points_achieved: 0, max_points: 0, count: 0 };
             analysis.performance_by_type[qType].points_achieved += awardedScore;
             analysis.performance_by_type[qType].max_points += maxQScore;
             analysis.performance_by_type[qType].count++;

             if (difficulty !== null && difficulty !== undefined) {
                 if (!analysis.performance_by_difficulty[difficulty]) analysis.performance_by_difficulty[difficulty] = { points_achieved: 0, max_points: 0, count: 0 };
                 analysis.performance_by_difficulty[difficulty].points_achieved += awardedScore;
                 analysis.performance_by_difficulty[difficulty].max_points += maxQScore;
                 analysis.performance_by_difficulty[difficulty].count++;
             }

             if (answer.correctness === 'incorrect' || answer.correctness === 'partial') {
                 analysis.incorrectly_answered_details.push({
                     question_number: answer.question_number_in_test,
                     question_text: answer.question_text,
                     topic: answer.topic_name,
                     type: answer.question_type,
                     user_answer: answer.userAnswerValue,
                     correct_answer: answer.correct_answer,
                     score_awarded: awardedScore,
                     max_score: maxQScore,
                     explanation: answer.reasoning,
                     error_identified: answer.error_analysis
                 });
             }
         });

        // Generate overall assessment based on score out of 50
         if (results.score >= 43) analysis.overall_assessment = "Vynikající výkon!";
         else if (results.score >= 33) analysis.overall_assessment = "Dobrý výkon, solidní základ.";
         else if (results.score >= 20) analysis.overall_assessment = "Průměrný výkon, zaměřte se na slabiny.";
         else analysis.overall_assessment = `Výkon ${results.score < 10 ? 'výrazně ' : ''}pod průměrem. Nutné opakování.`;

        // Append saving threshold message if applicable
         if (results.score < SCORE_THRESHOLD_FOR_SAVING) {
            analysis.overall_assessment += ` Skóre je příliš nízké (<${SCORE_THRESHOLD_FOR_SAVING}) pro uložení a generování plánu.`;
         }

        // Generate recommendations based on weaknesses
         analysis.recommendations = analysis.weaknesses.length > 0
             ? [`Intenzivně se zaměřte na nejslabší témata: ${analysis.weaknesses.map(w => w.topic).slice(0, 2).join(', ')}.`]
             : ["Pokračujte v upevňování znalostí."];
         if (analysis.incorrectly_answered_details.length > 3) {
            analysis.recommendations.push(`Projděte si ${analysis.incorrectly_answered_details.length} otázek s nízkým nebo částečným skóre.`);
         }

        console.log("[Logic Analysis] Vygenerována detailní analýza:", analysis);
        return analysis;
    }

	async function saveTestResultsLogic(supabase, currentUser, testResultsData, userAnswers, questions, testEndTime) {
		// FIX: Check for VyukaApp existence before trying to use it.
		if (!currentUser || currentUser.id === 'PLACEHOLDER_USER_ID' || !supabase) {
			console.warn("[Logic Save] Neukládám: Chybí uživatel nebo Supabase.");
			return { success: false, error: "Uživatel není přihlášen." };
		}

		if (testResultsData.score < SCORE_THRESHOLD_FOR_SAVING) {
			console.log(`[Logic Save] Skóre (${testResultsData.score}/50) < ${SCORE_THRESHOLD_FOR_SAVING}. Přeskakuji ukládání.`);
			return { success: false, error: `Skóre je příliš nízké (<${SCORE_THRESHOLD_FOR_SAVING}) pro uložení.` };
		}

		console.log(`[Logic Save] Pokouším se uložit výsledky...`);
		let savedDiagnosticId = null;

		try {
			// 1. Generate detailed analysis
			const detailedAnalysis = generateDetailedAnalysisLogic(testResultsData, userAnswers, questions);

			// 2. Prepare data for Supabase
			const answersToSave = userAnswers.map(a => ({
				question_db_id: a.question_db_id, // Use DB ID if available
				question_number_in_test: a.question_number_in_test,
				question_type: a.question_type,
				topic_id: a.topic_id,
				difficulty: a.difficulty,
				userAnswerValue: a.userAnswerValue,
				scoreAwarded: a.scoreAwarded,
				maxScore: a.maxScore,
				correctness: a.correctness,
				reasoning: a.reasoning,
				error_analysis: a.error_analysis,
				feedback: a.feedback,
				checked_by: a.checked_by // 'gemini_scored', 'fallback_scored', 'skipped', 'error'
			}));

			const dataToSave = {
				user_id: currentUser.id,
				completed_at: testEndTime ? testEndTime.toISOString() : new Date().toISOString(),
				total_score: testResultsData.score, // Store score out of 50
				total_questions: testResultsData.totalQuestions,
				answers: answersToSave,
				topic_results: testResultsData.topicResults,
				analysis: detailedAnalysis, // Store the generated analysis
				time_spent: testResultsData.timeSpent
			};
			console.log("[Logic Save] Data k uložení:", dataToSave);

			// 3. Insert into Supabase
			const { data, error } = await supabase
				.from('user_diagnostics')
				.insert(dataToSave)
				.select('id') // Select the ID of the newly created record
				.single(); // Expect a single record

			if (error) throw error;

			savedDiagnosticId = data.id;
			console.log("[Logic Save] Diagnostika uložena, ID:", savedDiagnosticId);

			// 4. --- FIX for VyukaApp ReferenceError ---
			// Attempt to trigger achievements ONLY if VyukaApp is defined.
			if (typeof VyukaApp !== 'undefined' && typeof VyukaApp.checkAndAwardAchievements === 'function') {
				console.log('[Achievements] Triggering check after saving test results...');
				// Run async without await to avoid blocking the return if it fails
				VyukaApp.checkAndAwardAchievements(currentUser.id).catch(err => {
					console.error("[Achievements] Background check failed after saving test:", err);
					// Log the error, but don't make the overall save fail
				});
			} else {
				console.warn("[Achievements] Check function (VyukaApp.checkAndAwardAchievements) not found or VyukaApp is not defined. Skipping achievement check.");
			}
			// --- End FIX ---

			return { success: true, diagnosticId: savedDiagnosticId };

		} catch (error) {
			console.error('[Logic Save] Chyba při ukládání:', error);
			return { success: false, error: `Nepodařilo se uložit výsledky: ${error.message}`, diagnosticId: savedDiagnosticId };
		}
	}

    async function awardPointsLogic(supabase, currentUser, currentProfile, selectedTestType, testResultsData, testTypeConfig) {
         // This function seems okay, no changes needed based on user request.
         if (!selectedTestType || !testResultsData || testResultsData.totalQuestions <= 0 || !currentUser || !currentProfile || !supabase) { console.warn("[Logic Points] Nelze vypočítat/uložit body: Chybí data."); return { success: false, awardedPoints: 0, newTotal: currentProfile?.points ?? 0 }; }
         const config = testTypeConfig[selectedTestType];
         if (!config) { console.warn(`[Logic Points] Neznámá konfigurace testu: ${selectedTestType}`); return { success: false, awardedPoints: 0, newTotal: currentProfile.points }; }
         const n = config.multiplier; const r = testResultsData.correctAnswers; const t = testResultsData.totalQuestions;
         if (t === 0) { console.warn("[Logic Points] Počet otázek je 0."); return { success: true, awardedPoints: 0, newTotal: currentProfile.points }; }
         const calculatedPoints = Math.round(n * (r / t) * 10);
         if (calculatedPoints <= 0) { console.log("[Logic Points] Nebyly získány žádné body."); return { success: true, awardedPoints: 0, newTotal: currentProfile.points }; }
         console.log(`[Logic Points] Vypočítané body: ${calculatedPoints} (n=${n}, r=${r}, t=${t})`);
         const currentPoints = currentProfile.points || 0; const newPoints = currentPoints + calculatedPoints;
         try {
             const { error } = await supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', currentUser.id);
             if (error) throw error;
             console.log(`[Logic Points] Body uživatele ${currentUser.id} aktualizovány na ${newPoints} (+${calculatedPoints})`);

             // --- FIX for VyukaApp ReferenceError ---
             if (typeof VyukaApp !== 'undefined' && typeof VyukaApp.checkAndAwardAchievements === 'function') {
                 console.log('[Achievements] Triggering check after awarding points...');
                 VyukaApp.checkAndAwardAchievements(currentUser.id).catch(err => console.error("[Achievements] Background check failed after points award:", err));
             } else {
                 console.warn("[Achievements] Check function (VyukaApp.checkAndAwardAchievements) not found or VyukaApp is not defined. Skipping achievement check after points.");
             }
             // --- End FIX ---

             return { success: true, awardedPoints: calculatedPoints, newTotal: newPoints };
         } catch (error) { console.error("[Logic Points] Chyba při aktualizaci bodů:", error); return { success: false, error: error.message, awardedPoints: 0, newTotal: currentPoints }; }
    }
	// --- END: Логика расчета и сохранения результатов ---

	// --- START: Проверка существующего теста ---
	async function checkExistingDiagnosticLogic(supabase, userId) {
        // This function seems okay, no changes needed based on user request.
        if (!userId || userId === 'PLACEHOLDER_USER_ID' || !supabase) {
            console.warn("[Logic Check] Kontrola testu přeskočena (není user/supabase).");
            return false; // Cannot check without user/supabase
        }
        try {
            const { data: existingDiagnostic, error } = await supabase
                .from('user_diagnostics')
                .select('id, completed_at') // Only need to know if one exists
                .eq('user_id', userId)
                .limit(1);

            if (error) {
                console.error("[Logic Check] Chyba při kontrole existujícího testu:", error);
                return false; // Assume no test if DB check fails
            }
            return existingDiagnostic && existingDiagnostic.length > 0;
        } catch (err) {
            console.error("[Logic Check] Neočekávaná chyba při kontrole testu:", err);
            return false; // Assume no test on unexpected error
        }
    }
	// --- END: Проверка существующего теста ---

	// --- START: Логика Уведомлений ---
	async function fetchNotificationsLogic(supabase, userId, limit = NOTIFICATION_FETCH_LIMIT) {
        // This function seems okay, no changes needed based on user request.
        if (!supabase || !userId) {
            console.error("[Notifications Logic] Chybí Supabase nebo ID uživatele.");
            return { unreadCount: 0, notifications: [] };
        }
        console.log(`[Notifications Logic] Načítání nepřečtených oznámení pro uživatele ${userId}`);
        try {
            const { data, error, count } = await supabase
                .from('user_notifications')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            console.log(`[Notifications Logic] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`);
            return { unreadCount: count ?? 0, notifications: data || [] };
        } catch (error) {
            console.error("[Notifications Logic] Výjimka při načítání oznámení:", error);
            // Return empty on error, don't throw, so the UI part can handle it
            return { unreadCount: 0, notifications: [] };
        }
    }
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
		SCORE_THRESHOLD_FOR_SAVING: SCORE_THRESHOLD_FOR_SAVING // Экспорт константы
	};
	console.log("test1-logic.js loaded and TestLogic exposed (v4 - Saving Fix + Comparison Fix).");
	// --- END: Глобальный Экспорт ---

})(window); // Передаем глобальный объект window в IIFE