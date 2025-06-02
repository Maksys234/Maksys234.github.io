// Файл: test1-logic.js
// Содержит основную логику для загрузки теста, оценки ответов, сохранения результатов и загрузки уведомлений.
// Версия v10.1: Исправлена синтаксическая ошибка 'Unexpected token async'.
// Обновлено для поддержки answer_prefix, answer_suffix и многочастных ответов при оценке.
// VERZE 10.2: Vylepšený Gemini prompt pro lepší rozpoznávání ekvivalentních odpovědí.
// VERZE 10.3 (POŽADAVEK UŽIVATELE): Přidána logika pro výběr otázek dle ročníku a sebehodnocení témat.
// VERZE 10.4 (POŽADAVEK UŽIVATELE): Upraveno vracení prázdného pole místo chyby při nedostatku otázek.
// VERZE 10.5 (POŽADAVEK UŽIVATELE): Test se spustí i s 0 otázkami; MINIMUM_QUESTIONS_THRESHOLD se použije pro logiku "smysluplnosti" testu, nikoliv pro jeho spuštění.
// VERZE K ÚPRAVĚ: Odstranění sloupce source_year
// VERZE PRO UŽIVATELE (Implementace 'math_explore' a základ 'math_accelerate') - Aktualizace 28.5.2025
// VERZE S ADAPTIVNÍM VÝBĚREM OTÁZEK (dle profilu) - Tato verze
// VERZE (FIX ADAPTIVE RETURN): Opraveno vracení dat z loadTestQuestionsLogic pro adaptivní test.
// VERZE (POŽADAVEK UŽIVATELE 2 - Přehodnotit, Nevím, Feedback): Přidána logika pro Přehodnotit, Nevím, vylepšený feedback.
// VERZE (POŽADAVEK UŽIVATELE 3 - Oprava "Nevím" a Přehodnocení Gemini): Implementace požadavků.

// Используем IIFE для изоляции области видимости
(function(global) {
    'use strict';

    // --- START: Конфигурация ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10';
    const GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // !!! Безопасность: Переместить на бэкенд !!!
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const SCORE_THRESHOLD_FOR_SAVING = 5;
    const NUMERIC_TOLERANCE = 0.001;
    const BASE_POINTS_FOR_100_PERCENT = 30;
    const NOTIFICATION_FETCH_LIMIT = 5;
    const DEFAULT_QUESTIONS_PER_TOPIC = 3;
    const TOTAL_QUESTIONS_IN_TEST = 30;
    const MINIMUM_QUESTIONS_THRESHOLD = 1; // Kolik otázek musí být, aby se test spustil

    const MATH_EXPLORE_DIFFICULTY_DISTRIBUTION = {
        1: 0.15, 2: 0.20, 3: 0.40, 4: 0.15, 5: 0.10
    };

    const MATH_ACCELERATE_PHASE1_CONFIG = {
        currentGradeDifficultQuestions: 7,
        nextGradeQuestions: 5,
        minDifficultyCurrent: 4,
        minDifficultyNext: 2,
        maxDifficultyNext: 4
    };

    const gradeToNumber = {
        'zs5': 5, 'zs6': 6, 'zs7': 7, 'zs8': 8, 'zs9': 9,
        'ss1': 10, 'ss2': 11, 'ss3': 12, 'ss4': 13
    };
    const numberToGrade = {
        5: 'zs5', 6: 'zs6', 7: 'zs7', 8: 'zs8', 9: 'zs9',
        10: 'ss1', 11: 'ss2', 12: 'ss3', 13: 'ss4'
    };
    // --- END: Конфигурация ---

    // --- START: Вспомогательные функции ---
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function compareNumericAdvanced(value1, value2, tolerance = NUMERIC_TOLERANCE) {
         console.log(`[compareNumeric v10.2] Porovnávám (surové): '${value1}' vs '${value2}', tolerance: ${tolerance}`);
         if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) {
             console.log("[compareNumeric v10.2] Alespoň jedna hodnota je null/undefined. Výsledek: null.");
             return null;
         }
         const normalizeAndEvaluate = (inputValue) => {
            if (typeof inputValue === 'number') { return inputValue; }
            if (typeof inputValue !== 'string') { return NaN; }
            let processedString = inputValue.trim()
                .replace(/\s+/g, '')
                .replace(/(kč|czk|korun|eur|usd|cm|m|km|mm|l|ml|kg|g|%|stupňů|manažerů|způsobů|lidí|ks|stran|cm2|cm3|hodin|minut)$/gi, '')
                .replace(/[\.,]+$/, '')
                .replace(',', '.');

            const fractionRegex = /^(-?)(\d+)\/(\d+)$/;
            const fractionMatch = processedString.match(fractionRegex);
            if (fractionMatch) {
                const signMultiplier = fractionMatch[1] === '-' ? -1 : 1;
                const numerator = parseFloat(fractionMatch[2]);
                const denominator = parseFloat(fractionMatch[3]);
                if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                    console.log(`[compareNumeric v10.2] Parsuji zlomek: ${processedString} -> ${signMultiplier * (numerator / denominator)}`);
                    return signMultiplier * (numerator / denominator);
                }
            }
            const floatValue = parseFloat(processedString);
            if (!isNaN(floatValue)) {
                console.log(`[compareNumeric v10.2] Parsuji float: '${processedString}' -> ${floatValue}`);
                return floatValue;
            }
            let aggressiveProcessedString = inputValue.trim().replace(/\s+/g, '').replace(',', '.');
            aggressiveProcessedString = aggressiveProcessedString.replace(/[^\d.\-+eE]/g, (match, offset, original) => {
                if ((match.toLowerCase() === 'e') && (offset > 0 && /\d/.test(original[offset-1])) && (offset < original.length - 1 && /[\-+]?\d/.test(original.substring(offset+1)))) {
                    return match;
                }
                return '';
            });

            if (!aggressiveProcessedString.toLowerCase().includes('e')) {
                 const signMatch = aggressiveProcessedString.match(/^([\-+]*)/);
                 if (signMatch && signMatch[0]) {
                    const signPart = signMatch[0].length > 1 ? signMatch[0][0] : signMatch[0];
                    aggressiveProcessedString = signPart + aggressiveProcessedString.substring(signMatch[0].length).replace(/[\-+]/g, '');
                 }
            }

            const aggressiveFloatValue = parseFloat(aggressiveProcessedString);
            if (!isNaN(aggressiveFloatValue)) {
                console.log(`[compareNumeric v10.2] Parsuji AGRESIVNĚ float: Vstup: '${inputValue}', Zpracováno: '${aggressiveProcessedString}' -> ${aggressiveFloatValue}`);
                return aggressiveFloatValue;
            }
            console.warn(`[compareNumeric v10.2] Nepodařilo se parsovat hodnotu jako číslo: '${inputValue}' (Zpracováno: '${processedString}', Agresivně: '${aggressiveProcessedString}')`);
            return NaN;
        };
         const number1 = normalizeAndEvaluate(value1);
         const number2 = normalizeAndEvaluate(value2);
         console.log(`[compareNumeric v10.2] Porovnávám vyhodnocené: ${number1} vs ${number2}`);
         if (isNaN(number1) || isNaN(number2)) {
             console.log("[compareNumeric v10.2] Alespoň jedna vyhodnocená hodnota není platné číslo (NaN). Vracím null.");
             return null;
         }
         const difference = Math.abs(number1 - number2);
         const areEquivalent = difference < tolerance;
         console.log(`[compareNumeric v10.2] Rozdíl: ${difference}, Tolerance: ${tolerance}, Výsledek: ${areEquivalent}`);
         return areEquivalent;
    }

    function compareTextAdvanced(value1, value2) {
        console.log(`[compareText v10.2] Porovnávám: '${value1}' vs '${value2}'`);
        if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) { console.log("[compareText v10.2] Alespoň jedna hodnota je null/undefined. Výsledek: false."); return false; }

        const normalizeString = (inputValue) => {
            if (typeof inputValue !== 'string' && typeof inputValue !== 'number') { return null; }
            let processedString = String(inputValue).toLowerCase().trim();
            processedString = processedString.replace(/\s+/g, ' ');
            processedString = processedString.replace(/[\.,;:!?]+$/, '');
            if (/\b(ano|áno|a)\b/.test(processedString) || processedString === 'a') return 'ano';
            if (/\b(ne|n)\b/.test(processedString) || processedString === 'n') return 'ne';
            processedString = processedString.replace(/\s*([+\-*/=()^])\s*/g, '$1');
            processedString = processedString.replace(/([a-zA-Z])([0-9]+)(?![\^a-zA-Z0-9.])/g, '$1^$2');

            console.log(`[compareText v10.2] Normalizováno na: '${processedString}'`);
            return processedString;
        };
        const normalized1 = normalizeString(value1);
        const normalized2 = normalizeString(value2);

        if (normalized1 === null || normalized2 === null) return false;

        const areEquivalent = (normalized1 === normalized2 && normalized1 !== '');

        console.log(`[compareText v10.2] Normalizované 1: '${normalized1}', Normalizované 2: '${normalized2}'. Výsledek: ${areEquivalent}`);
        return areEquivalent;
    }
    // --- END: Вспомогательные функции ---

    // --- START: Логика загрузки вопросов (UPRAVENO pro adaptivní výběr na základě profilu) ---
    async function loadTestQuestionsLogic(supabase, profileData, testTypeConfigAll) {
        if (!supabase) { throw new Error("Supabase client není inicializován."); }
        if (!profileData) { throw new Error("Chybí data profilu uživatele."); }

        const userGradeString = profileData?.preferences?.goal_details?.grade || profileData?.target_grade;
        const topicRatings = profileData?.preferences?.goal_details?.topic_ratings || {};
        const learningGoal = profileData?.learning_goal || 'exam_prep'; // Výchozí cíl, pokud není nastaven
        const currentTestConfig = testTypeConfigAll[learningGoal];
        const selectedTestTypeIdentifier = currentTestConfig?.identifier || learningGoal; // Použijeme identifikátor z konfigurace nebo klíč cíle

        console.log(`[Logic LoadQ ADAPTIVE] Načítání otázek pro: Cíl=${learningGoal}, Identifikátor=${selectedTestTypeIdentifier}, Ročník=${userGradeString || 'N/A'}`);

        let questionsToLoadCount = TOTAL_QUESTIONS_IN_TEST;
        if (currentTestConfig && currentTestConfig.questionsCount) {
            questionsToLoadCount = currentTestConfig.questionsCount;
        }
        console.log(`[Logic LoadQ ADAPTIVE] Počet otázek k načtení: ${questionsToLoadCount}`);

        // Sestavení základního dotazu
        let baseQuery = supabase
            .from('exam_questions')
            .select(`
                id, question_text, question_type, options, correct_answer,
                solution_explanation, topic_id, subtopic_id, difficulty,
                image_url, source_exam_type, target_grade,
                answer_prefix, answer_suffix,
                topic:topic_id ( id, name ),
                subtopic:subtopic_id ( id, name )
            `)
            .neq('question_type', 'construction'); // Ignorujeme konstrukční úlohy

        // Aplikace filtrů na základě studijního cíle
        if (learningGoal === 'math_explore') {
            // Pro "Volné prozkoumávání" můžeme chtít širší záběr, pokud není specifikován ročník
            if (userGradeString) {
                baseQuery = baseQuery.in('source_exam_type', ['prijimacky', 'math_review']) // Příklady typů pro prozkoumávání
                                   .eq('target_grade', userGradeString);
            } else {
                // Pokud ročník není specifikován, můžeme načíst širší sadu nebo omezit jinak
                baseQuery = baseQuery.in('source_exam_type', ['prijimacky', 'math_review']);
            }
        } else if (learningGoal === 'math_accelerate') {
            const currentUserGradeNumber = gradeToNumber[userGradeString];
            const gradesToFetch = [];
            if (userGradeString) gradesToFetch.push(userGradeString); // Aktuální ročník
            if (currentUserGradeNumber) {
                const nextGradeString = numberToGrade[currentUserGradeNumber + 1];
                if (nextGradeString) gradesToFetch.push(nextGradeString); // Následující ročník
            }

            if (gradesToFetch.length > 0) {
                baseQuery = baseQuery.in('source_exam_type', ['prijimacky', 'math_review']) // Může být relevantní
                                   .in('target_grade', gradesToFetch);
            } else {
                // Fallback, pokud nelze určit ročníky
                baseQuery = baseQuery.in('source_exam_type', ['prijimacky', 'math_review']);
            }
        } else { // Pro exam_prep a math_review (pokud je to výchozí nebo explicitně nastaveno)
            baseQuery = baseQuery.eq('source_exam_type', selectedTestTypeIdentifier);
            if (userGradeString) { // Pokud je ročník specifikován, filtrujeme
                 baseQuery = baseQuery.eq('target_grade', userGradeString);
            }
        }

        // Načtení otázek
        const { data: fetchedQuestions, error: fetchError } = await baseQuery;

        if (fetchError) {
            console.error(`[Logic LoadQ ADAPTIVE] Chyba při načítání otázek z DB pro ${selectedTestTypeIdentifier}:`, fetchError);
            return {
                firstQuestion: null,
                questionPool: [],
                initialDifficultyEstimate: 3, // Výchozí obtížnost
                questionsToAnswerInTest: questionsToLoadCount // Požadovaný počet
            };
        }

        if (!fetchedQuestions || fetchedQuestions.length === 0) {
            const specificGradeMessage = userGradeString ? `a ročník/y relevantní pro '${userGradeString}'` : "";
            const warningMessage = `V databázi nejsou žádné otázky pro test '${selectedTestTypeIdentifier}' ${specificGradeMessage} (kromě konstrukčních).`;
            console.warn(`[Logic LoadQ ADAPTIVE] ${warningMessage}`);
             // Vrátíme prázdné pole, pokud nejsou žádné otázky, ale UI to musí správně zpracovat
             return {
                firstQuestion: null,
                questionPool: [],
                initialDifficultyEstimate: 3,
                questionsToAnswerInTest: questionsToLoadCount
            };
        }
        // Všechny otázky, které prošly základním filtrem
        let allQuestionsForProcessing = fetchedQuestions;
        console.log(`[Logic LoadQ ADAPTIVE] Načteno ${allQuestionsForProcessing.length} otázek odpovídajících základnímu filtru pro ${selectedTestTypeIdentifier}.`);

        // Nyní provedeme sofistikovanější výběr na základě cíle
        let selectedQuestions = [];
        const selectedQuestionIds = new Set(); // Pro sledování již vybraných ID

        if (learningGoal === 'math_review' || learningGoal === 'exam_prep') {
            console.log(`[Logic LoadQ ADAPTIVE] Aplikuji ADAPTIVNÍ výběr na základě sebehodnocení témat pro cíl: ${learningGoal}.`);
            // 1. Rozdělíme otázky podle témat
            const questionsByTopic = allQuestionsForProcessing.reduce((acc, q) => {
                const topicId = q.topic_id || 'unknown'; // Pokud otázka nemá topic_id, zařadíme ji pod 'unknown'
                if (!acc[topicId]) acc[topicId] = [];
                acc[topicId].push(q);
                return acc;
            }, {});

            // 2. Seřadíme témata podle hodnocení uživatele (od nejhoršího)
            const sortedTopicIds = Object.keys(questionsByTopic).sort((a, b) => {
                const ratingA = topicRatings[a]?.overall || 3; // Výchozí hodnocení 3, pokud není
                const ratingB = topicRatings[b]?.overall || 3;
                return ratingA - ratingB; // Vzestupně - od nejhoršího hodnocení
            });

            // 3. Určíme, kolik otázek na téma zhruba chceme
            let questionsPerTopicTarget = Math.max(1, Math.floor(questionsToLoadCount / Math.max(1, sortedTopicIds.length)));
             // Pokud máme málo témat s otázkami, zvýšíme počet otázek na téma
            if (sortedTopicIds.length > 0 && sortedTopicIds.length < 4) { // Např. pokud máme jen 1-3 témata
                questionsPerTopicTarget = Math.ceil(questionsToLoadCount / Math.max(1, sortedTopicIds.length));
            }
            console.log(`[Logic LoadQ ADAPTIVE] Celkem témat s otázkami: ${sortedTopicIds.length}. Cílový počet otázek na téma: ${questionsPerTopicTarget}`);


            // 4. Iterujeme přes seřazená témata a vybíráme otázky
            for (const topicId of sortedTopicIds) {
                if (selectedQuestions.length >= questionsToLoadCount) break;

                let availableQuestionsInTopic = questionsByTopic[topicId] || [];
                shuffleArray(availableQuestionsInTopic); // Náhodné pořadí v rámci tématu

                const selfRating = topicRatings[topicId]?.overall || 3;

                // Definujeme rozložení obtížností na základě sebehodnocení
                let difficultyTargets = [];
                if (selfRating <= 2) { // Slabé téma
                    difficultyTargets = [
                        { difficulty: 1, count: Math.ceil(questionsPerTopicTarget * 0.5) }, // Více lehkých
                        { difficulty: 2, count: Math.ceil(questionsPerTopicTarget * 0.3) },
                        { difficulty: 3, count: Math.ceil(questionsPerTopicTarget * 0.2) }
                    ];
                } else if (selfRating === 3) { // Střední téma
                    difficultyTargets = [
                        { difficulty: 2, count: Math.ceil(questionsPerTopicTarget * 0.3) },
                        { difficulty: 3, count: Math.ceil(questionsPerTopicTarget * 0.4) }, // Více středních
                        { difficulty: 4, count: Math.ceil(questionsPerTopicTarget * 0.3) }
                    ];
                } else { // Silné téma
                    difficultyTargets = [
                        { difficulty: 3, count: Math.ceil(questionsPerTopicTarget * 0.2) },
                        { difficulty: 4, count: Math.ceil(questionsPerTopicTarget * 0.5) }, // Více těžších
                        { difficulty: 5, count: Math.ceil(questionsPerTopicTarget * 0.3) }
                    ];
                }
                 console.log(`[Logic LoadQ ADAPTIVE] Pro Téma ID ${topicId} (Rating: ${selfRating}), cíle obtížnosti:`, difficultyTargets);

                // Vybíráme otázky podle cílové obtížnosti
                for (const target of difficultyTargets) {
                    if (selectedQuestions.length >= questionsToLoadCount) break;
                    const questionsAtDifficulty = availableQuestionsInTopic.filter(q => q.difficulty === target.difficulty && !selectedQuestionIds.has(q.id));
                    const questionsToAddCount = Math.min(target.count, questionsAtDifficulty.length);

                    for (let i = 0; i < questionsToAddCount; i++) {
                        if (selectedQuestions.length >= questionsToLoadCount) break;
                        const question = questionsAtDifficulty[i];
                        selectedQuestions.push(question);
                        selectedQuestionIds.add(question.id);
                    }
                }
                // Pokud stále nemáme dostatek otázek z tohoto tématu, doplníme z ostatních obtížností
                let currentQuestionsFromTopic = selectedQuestions.filter(q => q.topic_id == topicId).length; // == protože topicId může být string
                const neededToFillTopic = Math.max(0, questionsPerTopicTarget - currentQuestionsFromTopic);

                if (neededToFillTopic > 0 && selectedQuestions.length < questionsToLoadCount) {
                     console.log(`[Logic LoadQ ADAPTIVE] Téma ${topicId}: Chybí ${neededToFillTopic} k naplnění cíle ${questionsPerTopicTarget}. Doplňuji z ostatních obtížností...`);
                    const remainingInTopic = availableQuestionsInTopic.filter(q => !selectedQuestionIds.has(q.id));
                    const questionsToActuallyAdd = Math.min(neededToFillTopic, remainingInTopic.length, questionsToLoadCount - selectedQuestions.length);
                    for (let i = 0; i < questionsToActuallyAdd; i++) {
                         selectedQuestions.push(remainingInTopic[i]);
                         selectedQuestionIds.add(remainingInTopic[i].id);
                    }
                }
            }
            console.log(`[Logic LoadQ ADAPTIVE] Po adaptivním výběru na základě témat: ${selectedQuestions.length} otázek.`);
        } else if (learningGoal === 'math_explore') {
            // Pro volné prozkoumávání vybereme náhodně s ohledem na distribuci obtížnosti
            const questionsByDifficulty = { 1: [], 2: [], 3: [], 4: [], 5: [] };
            allQuestionsForProcessing.forEach(q => {
                const diff = q.difficulty;
                if (diff >= 1 && diff <= 5) {
                    if (!questionsByDifficulty[diff]) questionsByDifficulty[diff] = [];
                    questionsByDifficulty[diff].push(q);
                }
            });

            Object.keys(MATH_EXPLORE_DIFFICULTY_DISTRIBUTION).forEach(difficultyLevelStr => {
                const difficultyLevel = parseInt(difficultyLevelStr, 10);
                const targetPercentage = MATH_EXPLORE_DIFFICULTY_DISTRIBUTION[difficultyLevel];
                const targetCount = Math.round(questionsToLoadCount * targetPercentage);

                let availableForDifficulty = questionsByDifficulty[difficultyLevel] || [];
                shuffleArray(availableForDifficulty);

                for (let i = 0; i < targetCount && availableForDifficulty.length > 0; i++) {
                    if (selectedQuestions.length >= questionsToLoadCount) break;
                    const question = availableForDifficulty.shift(); // Vezmeme a odstraníme
                    if (question && question.id != null && !selectedQuestionIds.has(question.id)) {
                        selectedQuestions.push(question);
                        selectedQuestionIds.add(question.id);
                    }
                }
            });
        } else if (learningGoal === 'math_accelerate') {
            // Pro učení napřed
            const currentUserGradeNum = gradeToNumber[userGradeString];
            const nextUserGradeString = currentUserGradeNum ? numberToGrade[currentUserGradeNum + 1] : null;

            // Otázky z aktuálního ročníku, vyšší obtížnost
            let currentGradeHard = allQuestionsForProcessing.filter(q =>
                q.target_grade === userGradeString &&
                q.difficulty >= MATH_ACCELERATE_PHASE1_CONFIG.minDifficultyCurrent
            );
            shuffleArray(currentGradeHard);
            currentGradeHard.slice(0, MATH_ACCELERATE_PHASE1_CONFIG.currentGradeDifficultQuestions).forEach(q => {
                if (q && q.id != null && !selectedQuestionIds.has(q.id)) {
                     selectedQuestions.push(q);
                     selectedQuestionIds.add(q.id);
                }
            });

            // Otázky z následujícího ročníku, střední obtížnost
            if (nextUserGradeString) {
                let nextGradeSuitable = allQuestionsForProcessing.filter(q =>
                    q.target_grade === nextUserGradeString &&
                    q.difficulty >= MATH_ACCELERATE_PHASE1_CONFIG.minDifficultyNext &&
                    q.difficulty <= MATH_ACCELERATE_PHASE1_CONFIG.maxDifficultyNext
                );
                shuffleArray(nextGradeSuitable);
                nextGradeSuitable.slice(0, MATH_ACCELERATE_PHASE1_CONFIG.nextGradeQuestions).forEach(q => {
                     if (selectedQuestions.length < questionsToLoadCount && q && q.id != null && !selectedQuestionIds.has(q.id)) {
                         selectedQuestions.push(q);
                         selectedQuestionIds.add(q.id);
                     }
                });
            }
        }
        // Fallback: Pokud po specifické logice nemáme dost otázek, doplníme náhodně
        if (selectedQuestions.length < questionsToLoadCount) {
            console.log(`[Logic LoadQ ADAPTIVE] Doplňování otázek do plného počtu. Aktuálně ${selectedQuestions.length}/${questionsToLoadCount}. Dostupné celkem (po úvodním filtru): ${allQuestionsForProcessing.length}`);
            let remainingPool = allQuestionsForProcessing.filter(q => !selectedQuestionIds.has(q.id));
            shuffleArray(remainingPool); // Zamícháme zbývající
            while (selectedQuestions.length < questionsToLoadCount && remainingPool.length > 0) {
                const question = remainingPool.shift(); // Vezmeme další náhodnou
                if (question && question.id != null) { // Ujistíme se, že otázka má ID
                    selectedQuestions.push(question);
                    selectedQuestionIds.add(question.id);
                }
            }
        }

        // Pokud máme více otázek, než potřebujeme (např. z kombinace témat)
        if (selectedQuestions.length > questionsToLoadCount) {
            shuffleArray(selectedQuestions); // Zamícháme a vezmeme prvních N
            selectedQuestions = selectedQuestions.slice(0, questionsToLoadCount);
        }

        // Poslední záchrana: pokud stále nemáme otázky, ale v původním poolu byly
        if (selectedQuestions.length === 0 && allQuestionsForProcessing.length > 0) {
             console.warn(`[Logic LoadQ ADAPTIVE] Po všech krocích nebyly vybrány žádné otázky pro ${selectedTestTypeIdentifier}, ale ${allQuestionsForProcessing.length} otázek bylo k dispozici. Beru náhodný vzorek z původně načtených.`);
             shuffleArray(allQuestionsForProcessing);
             selectedQuestions = allQuestionsForProcessing.slice(0, Math.min(questionsToLoadCount, allQuestionsForProcessing.length));
        }


        // Finální formátování a příprava
        const formattedQuestionsPool = selectedQuestions.map((question, index) => ({
            id: question.id,
            question_number: index + 1, // Pořadové číslo v rámci tohoto testu
            question_text: question.question_text,
            question_type: question.question_type,
            options: question.options,
            correct_answer: question.correct_answer,
            solution_explanation: question.solution_explanation || "Oficiální postup není k dispozici.",
            topic_id: question.topic_id,
            topic_name: question.topic ? question.topic.name : "Neznámé téma",
            subtopic_id: question.subtopic_id,
            subtopic_name: question.subtopic ? question.subtopic.name : "", // Pokud subtopic není, prázdný string
            difficulty: question.difficulty,
            image_url: question.image_url,
            source_exam_type: question.source_exam_type,
            target_grade: question.target_grade, // Důležité pro logiku 'math_accelerate'
            answer_prefix: question.answer_prefix, // Nové pole
            answer_suffix: question.answer_suffix, // Nové pole
            maxScore: (question.question_type === 'multiple_choice' || question.question_type === 'numeric' || question.question_type === 'text' || question.question_type === 'ano_ne') ? 1 : (question.maxScore || 1) // Výchozí max skóre
        }));

        // Kontrola, zda máme nějaké otázky
        if (formattedQuestionsPool.length === 0) {
            console.warn(`[Logic LoadQ ADAPTIVE] Po všech krocích nebyly vybrány žádné otázky pro ${selectedTestTypeIdentifier}. Vracím prázdná data.`);
            return {
                firstQuestion: null,
                questionPool: [],
                initialDifficultyEstimate: 3,
                questionsToAnswerInTest: questionsToLoadCount // Požadovaný počet, i když je pool prázdný
            };
        }
        console.log(`[Logic LoadQ ADAPTIVE] Finálně vybráno a zformátováno ${formattedQuestionsPool.length} otázek do poolu pro ${selectedTestTypeIdentifier}.`);

        // Log distribuce obtížnosti
        const difficultyDistribution = formattedQuestionsPool.reduce((acc, q) => {
            acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
            return acc;
        }, {});
        console.log(`[Logic LoadQ ADAPTIVE] Distribuce obtížností ve finálním poolu (${selectedTestTypeIdentifier}):`, difficultyDistribution);

        // Výběr první otázky a počáteční obtížnosti pro adaptivní logiku
        const firstQuestionFromPool = formattedQuestionsPool.length > 0 ? formattedQuestionsPool[0] : null;
        const initialDifficulty = firstQuestionFromPool ? firstQuestionFromPool.difficulty : 3; // Výchozí, pokud je pool prázdný

        return {
            firstQuestion: firstQuestionFromPool,
            questionPool: formattedQuestionsPool,
            initialDifficultyEstimate: initialDifficulty,
            questionsToAnswerInTest: Math.min(questionsToLoadCount, formattedQuestionsPool.length) // Skutečný počet otázek v testu
        };
    }

    async function getNextAdaptiveQuestionLogic(questionPool, presentedQuestionIdsSet, lastAnswerCorrect, currentDifficulty, questionsAnsweredSoFar, totalQuestionsInTest) {
        console.log(`[getNextAdaptiveQuestion ADAPTIVE] Hledám další otázku. Pool: ${questionPool.length}, Zodpovězeno: ${questionsAnsweredSoFar}/${totalQuestionsInTest}, Minulá odpověď: ${lastAnswerCorrect}, Aktuální obtížnost: ${currentDifficulty}`);

        // Zkontrolujeme, zda jsme již nedosáhli maximálního počtu otázek pro tuto session
        if (questionsAnsweredSoFar >= totalQuestionsInTest) {
            console.log("[getNextAdaptiveQuestion ADAPTIVE] Dosažen limit otázek pro tuto session.");
            return { nextQuestion: null, nextDifficulty: currentDifficulty }; // Žádná další otázka
        }

        let nextDifficultyTarget = currentDifficulty;
        // Upravíme cílovou obtížnost na základě poslední odpovědi
        if (lastAnswerCorrect === true) {
            nextDifficultyTarget = Math.min(currentDifficulty + 1, 5); // Zvýšíme, max 5
        } else if (lastAnswerCorrect === false) {
            nextDifficultyTarget = Math.max(currentDifficulty - 1, 1); // Snížíme, min 1
        }
        // Pokud lastAnswerCorrect je null (např. první otázka), obtížnost se nemění

        console.log(`[getNextAdaptiveQuestion ADAPTIVE] Cílová obtížnost pro další otázku: ${nextDifficultyTarget}`);

        // Filtrujeme otázky, které ještě nebyly položeny
        const availableQuestions = questionPool.filter(q => !presentedQuestionIdsSet.has(q.id));

        if (availableQuestions.length === 0) {
            console.log("[getNextAdaptiveQuestion ADAPTIVE] Žádné další dostupné otázky v poolu.");
            return { nextQuestion: null, nextDifficulty: nextDifficultyTarget }; // Žádná další otázka
        }

        let chosenQuestion = null;

        // 1. Pokusíme se najít otázku s přesnou cílovou obtížností
        let candidates = availableQuestions.filter(q => q.difficulty === nextDifficultyTarget);
        if (candidates.length > 0) {
            chosenQuestion = candidates[Math.floor(Math.random() * candidates.length)]; // Náhodný výběr
            console.log(`[getNextAdaptiveQuestion ADAPTIVE] Nalezena otázka s přesnou obtížností ${nextDifficultyTarget}.`);
        } else {
            // 2. Pokud ne, hledáme s offsetem (preferujeme bližší obtížnosti)
            const difficultyOffsets = lastAnswerCorrect === true ? [1, -1, 2, -2] : [-1, 1, -2, 2]; // Preferujeme směr adaptace

            for (const offset of difficultyOffsets) {
                const tryDifficulty = nextDifficultyTarget + offset;
                if (tryDifficulty >= 1 && tryDifficulty <= 5) { // V rámci platného rozsahu
                    candidates = availableQuestions.filter(q => q.difficulty === tryDifficulty);
                    if (candidates.length > 0) {
                        chosenQuestion = candidates[Math.floor(Math.random() * candidates.length)];
                        console.log(`[getNextAdaptiveQuestion ADAPTIVE] Nalezena otázka s obtížností ${tryDifficulty} (offset ${offset}).`);
                        nextDifficultyTarget = tryDifficulty; // Aktualizujeme cílovou obtížnost na skutečně vybranou
                        break;
                    }
                }
            }
        }

        // 3. Pokud stále nic, vezmeme nejbližší dostupnou obtížnost (fallback)
        if (!chosenQuestion && availableQuestions.length > 0) {
            console.log("[getNextAdaptiveQuestion ADAPTIVE] Žádná otázka s cílovou nebo blízkou obtížností. Výběr nejbližší dostupné.");
            availableQuestions.sort((a, b) => Math.abs(a.difficulty - nextDifficultyTarget) - Math.abs(b.difficulty - nextDifficultyTarget));
            chosenQuestion = availableQuestions[0];
            nextDifficultyTarget = chosenQuestion.difficulty; // Aktualizujeme
        }

        if (chosenQuestion) {
             console.log(`[getNextAdaptiveQuestion ADAPTIVE] Vybrána otázka ID: ${chosenQuestion.id}, Obtížnost: ${chosenQuestion.difficulty}. Nová cílová obtížnost pro UI: ${nextDifficultyTarget}`);
        } else {
            console.log("[getNextAdaptiveQuestion ADAPTIVE] Nepodařilo se vybrat žádnou další otázku.");
        }
        return { nextQuestion: chosenQuestion, nextDifficulty: nextDifficultyTarget };
    }
    // --- END: Логика загрузки вопросов ---

    // --- START: Логика оценки ответов (Gemini) ---
    async function checkAnswerWithGeminiLogic(
        questionType,
        questionText,
        correctAnswerOrExplanation,
        userAnswer,
        maxScore = 1,
        currentQuestionIndex,
        solutionExplanationForConstruction = null,
        optionsForMC = null
    ) {
        if (questionType === 'construction') {
            return {
                score: 0, max_score: maxScore, correctness: "skipped",
                reasoning: solutionExplanationForConstruction || "Konstrukční úlohy vyžadují manuální kontrolu nebo specifické vyhodnocení.",
                detailed_error_analysis: null, future_improvement_feedback: null,
                is_equivalent: null
            };
        }

        console.log(`--- [Logic Check ADAPTIVE vFEEDBACK] Vyhodnocování Q (pořadí v testu ${currentQuestionIndex + 1}) (Typ: ${questionType}, Max bodů: ${maxScore}) ---`);
        console.log(`   Otázka: ${questionText ? questionText.substring(0, 100) + '...' : 'N/A'}`);
        console.log(`   Správně (raw z DB): `, correctAnswerOrExplanation);
        console.log(`   Uživatel (raw z UI): `, userAnswer);

        let isSkippedOrEmpty = false;
        if (userAnswer === null || userAnswer === undefined || userAnswer === "SKIPPED_BY_USER") { isSkippedOrEmpty = true; }
        else if (typeof userAnswer === 'object' && userAnswer !== null) { isSkippedOrEmpty = Object.values(userAnswer).every(val => val === null || String(val).trim() === ''); }
        else { isSkippedOrEmpty = String(userAnswer).trim() === ""; }

        if (isSkippedOrEmpty) {
            return {
                score: 0, max_score: maxScore, correctness: "skipped",
                reasoning: solutionExplanationForConstruction || (userAnswer === "SKIPPED_BY_USER" ? "Uživatel otázku přeskočil." : "Odpověď nebyla poskytnuta nebo je prázdná."),
                detailed_error_analysis: userAnswer === "SKIPPED_BY_USER" ? "Uživatel otázku přeskočil." : "Uživatel neodpověděl.",
                future_improvement_feedback: "Příště zkuste odpovědět na otázku.",
                is_equivalent: null
            };
        }

        if (questionType === 'multiple_choice' && optionsForMC && typeof correctAnswerOrExplanation === 'string') {
            const correctLetter = String(correctAnswerOrExplanation).trim().toUpperCase().charAt(0);
            const userLetter = String(userAnswer).trim().toUpperCase().charAt(0);
            const localComparisonResult = correctLetter === userLetter;
            const finalCorrectness = localComparisonResult ? 'correct' : 'incorrect';
            const finalScore = localComparisonResult ? maxScore : 0;
            let finalReasoning = localComparisonResult ? `Správně jste vybral(a) možnost ${correctLetter}.` : `Nesprávně. Správná možnost byla ${correctLetter}.`;
            const correctOptionIndex = correctLetter.charCodeAt(0) - 65;
            if (Array.isArray(optionsForMC) && optionsForMC[correctOptionIndex] !== undefined) { finalReasoning += ` (${optionsForMC[correctOptionIndex]})`; }
            const detailedError = localComparisonResult ? null : "Byla vybrána nesprávná možnost.";
            const futureFeedback = localComparisonResult ? null : "Při výběru odpovědi pečlivě zvažte všechny možnosti a související koncepty.";
            return { score: finalScore, max_score: maxScore, correctness: finalCorrectness, reasoning: finalReasoning, detailed_error_analysis: detailedError, future_improvement_feedback: futureFeedback, is_equivalent: null };
        } else if (['numeric', 'text', 'ano_ne'].includes(questionType) && typeof userAnswer !== 'object' && typeof correctAnswerOrExplanation === 'string') {
            const numericCheck = compareNumericAdvanced(userAnswer, correctAnswerOrExplanation);
            const textCheck = compareTextAdvanced(userAnswer, correctAnswerOrExplanation);
            let localComparisonResult = (questionType === 'numeric') ? numericCheck : textCheck;

            if (localComparisonResult !== null) {
                console.log(`[Logic ADAPTIVE Q (pořadí ${currentQuestionIndex + 1})] Lokální srovnání bylo JEDNOZNAČNÉ (${localComparisonResult}). Gemini se nevolá.`);
                const finalCorrectness = localComparisonResult ? 'correct' : 'incorrect';
                const finalScore = localComparisonResult ? maxScore : 0;
                const detailedError = localComparisonResult ? null : `Vaše odpověď '${userAnswer}' se neshoduje se správnou odpovědí '${correctAnswerOrExplanation}'.`;
                const futureFeedback = localComparisonResult ? null : "Zkontrolujte svůj výpočet nebo zadaný text.";
                return {
                    score: finalScore, max_score: maxScore, correctness: finalCorrectness,
                    reasoning: solutionExplanationForConstruction || (localComparisonResult ? "Odpověď je správná." : `Odpověď '${userAnswer}' není správná. Správná odpověď: '${correctAnswerOrExplanation}'.`),
                    detailed_error_analysis: detailedError, future_improvement_feedback: futureFeedback,
                    is_equivalent: localComparisonResult
                };
            }
            console.log(`[Logic ADAPTIVE Q (pořadí ${currentQuestionIndex + 1})] Lokální srovnání NENÍ JEDNOZNAČNÉ. Volám Gemini.`);
        }

        const runFallbackCheck = (fallbackReason = "Automatické hodnocení selhalo. Použita záložní kontrola.") => {
            console.warn(`[Logic Check Fallback] Důvod: ${fallbackReason}`);
            let score = 0; let correctness = "incorrect"; let isEquivalent = false;
            if (questionType === 'numeric') { isEquivalent = compareNumericAdvanced(userAnswer, correctAnswerOrExplanation, 0.01) === true; } // Mírnější tolerance pro fallback
            else { isEquivalent = compareTextAdvanced(userAnswer, correctAnswerOrExplanation) === true; }
            if (isEquivalent) { score = maxScore; correctness = "correct"; }
            return { score: score, max_score: maxScore, correctness: correctness, reasoning: solutionExplanationForConstruction || "Oficiální postup není k dispozici. Hodnoceno záložní metodou.", detailed_error_analysis: isEquivalent ? null : "Záložní kontrola vyhodnotila odpověď jako nesprávnou.", future_improvement_feedback: isEquivalent ? null : "Zkuste odpověď přeformulovat nebo zkontrolovat výpočet.", is_equivalent: isEquivalent };
        };
        if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR_') || GEMINI_API_KEY.length < 10) { return runFallbackCheck("Chybí platný Gemini API klíč."); }

        const baseInstruction = `Jsi PŘÍSNÝ, DETAILNÍ a PŘESNÝ AI hodnotitel odpovědí z PŘIJÍMACÍCH ZKOUŠEK z matematiky/logiky pro 9. třídu ZŠ v ČR. Tvým úkolem je KOMPLEXNĚ posoudit odpověď studenta vůči správnému řešení/odpovědi v kontextu dané otázky. MUSÍŠ vrátit POUZE JSON objekt podle PŘESNĚ definované struktury. NEPŘIDÁVEJ žádný text PŘED nebo ZA JSON blok.
Při hodnocení numerických a algebraických odpovědí:
- **Ekvivalence formátu:** Považuj různé, ale matematicky SPRÁVNÉ formáty zápisu za ekvivalentní, POKUD otázka explicitně NEVYŽADUJE specifický formát. Například:
    - Zlomek \`3/2\` je ekvivalentní desetinnému číslu \`1.5\` (nebo \`1,5\`).
    - Algebraický výraz \`9/16a^2\` je ekvivalentní \`9/16a2\` nebo \`(9/16)*a^2\`. Zápis \`a2\` považuj za \`a^2\`.
    - Pro desetinná čísla akceptuj tečku \`.\` i čárku \`,\` jako desetinný oddělovač.
- **Tolerance mezer:** Ignoruj nadbytečné mezery.
- **DŮLEŽITÉ:** Pokud otázka explicitně NEŽÁDÁ odpověď v určitém formátu, všechny matematicky správné a ekvivalentní formy jsou PLNĚ přijatelné.
Při zdůvodnění, pokud je odpověď studenta správná, ale v jiném formátu než \`SPRÁVNÁ ODPOVĚĎ/ŘEŠENÍ\`, uveď, že formát je alternativní, ale výsledek je správný.
Pro textové odpovědi (včetně ano/ne) buď tolerantní k velkým/malým písmenům, interpunkci na konci a mezerám, ale posuzuj jádro odpovědi.`;

        const outputStructure = `{
    "score": number (0-${maxScore}, celé číslo, např. 0, 1, ... ${maxScore}),
    "max_score": ${maxScore},
    "correctness": string ("correct" | "incorrect" | "partial"),
    "reasoning": string (Vysvětlení z databáze - pole 'solution_explanation'. Pokud je prázdné, uveď "Oficiální postup není k dispozici."),
    "detailed_error_analysis": string | null (Pokud je odpověď incorrect/partial: DETAILNÍ analýza konkrétní chyby studenta, např. 'Student udělal chybu v kroku 2 při sčítání zlomků.' nebo 'Zapomenutý minus.' nebo 'Výpočet je správný, ale chybí jednotky.'. Pokud 'correct': null),
    "future_improvement_feedback": string | null (Pokud je odpověď incorrect/partial: KONKRÉTNÍ rada, jak se podobným chybám v budoucnu vyvarovat, např. 'Při práci se zlomky vždy zkontrolujte společného jmenovatele.' nebo 'Dávejte pozor na znaménka při násobení.'. Pokud 'correct': null),
    "is_equivalent": boolean | null (True, pokud je odpověď studenta matematicky/logicky správná i přes jiný formát než v 'correct_answer'. False pokud je nesprávná. Null pro 'multiple_choice' nebo pokud nelze jednoznačně určit.)
}`;
        const questionContext = `Kontext otázky: """${questionText}"""`;
        let formattedCorrectAnswer = correctAnswerOrExplanation;
        let formattedUserAnswer = userAnswer;
        if (typeof correctAnswerOrExplanation === 'object' && correctAnswerOrExplanation !== null) { formattedCorrectAnswer = JSON.stringify(correctAnswerOrExplanation); }
        if (typeof userAnswer === 'object' && userAnswer !== null) { formattedUserAnswer = JSON.stringify(userAnswer); }
        const inputData = `SPRÁVNÁ ODPOVĚĎ/ŘEŠENÍ Z DATABÁZE (použij jako primární referenci): """${formattedCorrectAnswer}"""\nOFICIÁLNÍ VYSVĚTLENÍ Z DATABÁZE (použij pro pole 'reasoning'): """${solutionExplanationForConstruction || "Oficiální postup není k dispozici."}"""\nODPOVĚĎ STUDENTA: """${formattedUserAnswer}"""`;

        let prompt;
        if (questionType === 'multiple_choice') {
             let optionsString = "";
             if (optionsForMC && Array.isArray(optionsForMC)) {
                 optionsString = "Dostupné možnosti:\n" + optionsForMC.map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt}`).join("\n");
             }
             prompt = `${baseInstruction}\n${questionContext}\n${optionsString}\n${inputData}\nÚKOL: Vyhodnoť odpověď studenta a vrať POUZE JSON (${outputStructure}). Zaměř se na správnost výběru.`;
        } else {
            prompt = `${baseInstruction}\n${questionContext}\n${inputData}\nÚKOL: Vyhodnoť odpověď studenta a vrať POUZE JSON (${outputStructure}).`;
        }

        try {
            const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ] }) });
            if (!response.ok) { const errorBody = await response.text(); console.error(`[Logic Gemini Call ADAPTIVE Q (pořadí ${currentQuestionIndex + 1})] Chyba API (${response.status}):`, errorBody); throw new Error(`Chyba Gemini API (${response.status})`); }
            const data = await response.json();
            console.log(`[Logic Gemini Call ADAPTIVE Q (pořadí ${currentQuestionIndex + 1})] Surová odpověď:`, JSON.stringify(data));
            if (data.promptFeedback?.blockReason) { throw new Error(`Požadavek blokován AI filtrem: ${data.promptFeedback.blockReason}.`); }
            const candidate = data.candidates?.[0];
            if (!candidate) { const finishReason = data.candidates?.[0]?.finishReason; throw new Error(`AI neposkytlo kandidáta odpovědi. Důvod: ${finishReason || 'Neznámý'}.`); }
            if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) { if (candidate.finishReason === 'SAFETY') throw new Error('Odpověď blokována bezpečnostním filtrem AI.'); if (!candidate.content?.parts?.[0]?.text) { throw new Error(`Generování zastaveno: ${candidate.finishReason}.`); } }
            let resultJsonText = candidate.content?.parts?.[0]?.text;
            if (!resultJsonText) { throw new Error('AI vrátilo prázdnou odpověď.'); }
            const jsonMatch = resultJsonText.match(/```json\s*([\s\S]*?)\s*```/); if (jsonMatch && jsonMatch[1]) { resultJsonText = jsonMatch[1]; }
            console.log(`[Logic Gemini Call ADAPTIVE Q (pořadí ${currentQuestionIndex + 1})] Získaný JSON (po očištění):`, resultJsonText);

            try {
                const geminiResult = JSON.parse(resultJsonText);
                console.log(`[Logic Gemini Call ADAPTIVE Q (pořadí ${currentQuestionIndex + 1})] Parsovaný JSON:`, geminiResult);
                if (typeof geminiResult.score !== 'number' || typeof geminiResult.correctness !== 'string' || typeof geminiResult.reasoning !== 'string') {
                    return runFallbackCheck("Neúplná odpověď od AI (chybí klíčové pole).");
                }

                const finalScore = Math.max(0, Math.min(maxScore, Math.round(geminiResult.score)));
                const finalCorrectness = ["correct", "incorrect", "partial"].includes(geminiResult.correctness) ? geminiResult.correctness : "incorrect";
                const detailedError = geminiResult.detailed_error_analysis || null;
                const futureFeedback = geminiResult.future_improvement_feedback || null;

                const finalResult = {
                    score: finalScore,
                    max_score: maxScore,
                    correctness: finalCorrectness,
                    reasoning: geminiResult.reasoning,
                    detailed_error_analysis: detailedError,
                    future_improvement_feedback: futureFeedback,
                    is_equivalent: typeof geminiResult.is_equivalent === 'boolean' ? geminiResult.is_equivalent : null
                };
                console.log(`[Logic Gemini Call ADAPTIVE Q (pořadí ${currentQuestionIndex + 1})] Finální výsledek:`, finalResult);
                return finalResult;
            } catch (parseError) { return runFallbackCheck(`Chyba při zpracování JSON odpovědi AI: ${parseError.message}`); }
        } catch (apiError) { return runFallbackCheck(`Chyba komunikace s AI: ${apiError.message}`); }
    }

    async function reevaluateAnswerWithGeminiLogic(question, userAnswerEntry, previousEvaluation, supabaseInstance) {
        if (!supabaseInstance) { throw new Error("Supabase client není inicializován pro přehodnocení."); }
        if (!question || !userAnswerEntry || !previousEvaluation) { throw new Error("Chybí data pro přehodnocení."); }

        console.log(`[reevaluateAnswer ADAPTIVE] Přehodnocování otázky ID: ${question.id}`);
        // Použijeme oficiální vysvětlení z databáze (question.solution_explanation) jako základ pro "reasoning"
        const baseReasoning = question.solution_explanation || "Oficiální postup není k dispozici.";

        const baseInstruction = `Jsi PŘÍSNÝ, DETAILNÍ a PŘESNÝ AI hodnotitel. Student požádal o přehodnocení své odpovědi na otázku z PŘIJÍMACÍCH ZKOUŠEK z matematiky/logiky pro 9. třídu ZŠ v ČR. Pečlivě zvaž předchozí hodnocení a poskytni AKTUALIZOVANÉ komplexní posouzení. Vrať POUZE JSON objekt podle zadané struktury. NEPŘIDÁVEJ žádný text PŘED nebo ZA JSON blok.
Při hodnocení numerických a algebraických odpovědí buď EXTRÉMNĚ PEČLIVÝ ohledně ekvivalence formátů, pokud otázka explicitně nevyžaduje konkrétní formát. Např. 3/2 = 1.5 = 1,5.
Pro textové odpovědi buď tolerantní k velkým/malým písmenům, interpunkci a mezerám, ale posuzuj jádro.`;

        const outputStructure = `{
    "score": number (0-${question.maxScore || 1}, celé číslo),
    "max_score": ${question.maxScore || 1},
    "correctness": string ("correct" | "incorrect" | "partial"),
    "reasoning": string ("${baseReasoning.replace(/"/g, '\\"')}" - TOTO JE OFICIÁLNÍ VYSVĚTLENÍ z databáze, NEMĚŇ HO, pokud není absolutně nutné pro objasnění PŘEHODNOCENÍ. Můžeš ho ale doplnit o kontext přehodnocení v "reevaluation_note".),
    "detailed_error_analysis": string | null (Pokud je odpověď incorrect/partial: NOVÁ DETAILNÍ analýza konkrétní chyby studenta. Může být podobná předchozí, pokud je stále platná. Pokud 'correct': null),
    "future_improvement_feedback": string | null (Pokud je odpověď incorrect/partial: NOVÁ KONKRÉTNÍ rada. Může být podobná předchozí. Pokud 'correct': null),
    "is_equivalent": boolean | null (True, pokud je odpověď studenta matematicky/logicky správná i přes jiný formát. False, pokud je nesprávná. Null pro 'multiple_choice' nebo pokud nelze jednoznačně určit.),
    "reevaluation_note": string | null (DŮLEŽITÉ: Stručná poznámka vysvětlující, proč se hodnocení změnilo, nebo proč zůstalo stejné i po přehodnocení, např. 'Původní hodnocení bylo příliš striktní ohledně formátu, odpověď je matematicky správná.' nebo 'Původní hodnocení bylo správné, chyba studenta přetrvává v...' nebo 'Nyní uznáno jako částečně správné, protože...')
}`;
        const questionContext = `Kontext otázky: """${question.question_text}"""`;
        const formattedCorrectAnswer = typeof question.correct_answer === 'object' ? JSON.stringify(question.correct_answer) : question.correct_answer;
        const formattedUserAnswer = typeof userAnswerEntry.userAnswerValue === 'object' ? JSON.stringify(userAnswerEntry.userAnswerValue) : userAnswerEntry.userAnswerValue;
        const inputData = `SPRÁVNÁ ODPOVĚĎ/ŘEŠENÍ Z DATABÁZE: """${formattedCorrectAnswer}"""\nODPOVĚĎ STUDENTA: """${formattedUserAnswer}"""`;
        const previousEvalText = `PŘEDCHOZÍ HODNOCENÍ:\n- Skóre: ${previousEvaluation.scoreAwarded}/${previousEvaluation.maxScore}\n- Správnost: ${previousEvaluation.correctness}\n- Předchozí analýza chyby (AI): ${previousEvaluation.error_analysis || 'N/A'}\n- Předchozí zpětná vazba (AI): ${previousEvaluation.feedback || 'N/A'}\n- Předchozí zdůvodnění (AI): ${previousEvaluation.reasoning || 'N/A'}`;

        const prompt = `${baseInstruction}\n${questionContext}\n${inputData}\n${previousEvalText}\nÚKOL: Pečlivě přehodnoť odpověď studenta. Vrať POUZE JSON (${outputStructure}). Zaměř se na pole "detailed_error_analysis", "future_improvement_feedback", "score", "correctness" a "reevaluation_note". Pole "reasoning" by mělo primárně obsahovat oficiální vysvětlení z databáze.`;

        try {
            console.log(`[reevaluateAnswer ADAPTIVE] Posílám požadavek na přehodnocení... Prompt (začátek): ${prompt.substring(0,200)}`);
            const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.25 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ] }) });
            if (!response.ok) { const errorBody = await response.text(); throw new Error(`Chyba Gemini API (${response.status}): ${errorBody}`); }
            const data = await response.json();
            if (data.promptFeedback?.blockReason) { throw new Error(`Požadavek blokován AI filtrem: ${data.promptFeedback.blockReason}.`); }
            const candidate = data.candidates?.[0];
            if (!candidate || !candidate.content?.parts?.[0]?.text) { throw new Error('AI nevrátilo platnou odpověď pro přehodnocení.'); }
            let resultJsonText = candidate.content.parts[0].text;
            const jsonMatch = resultJsonText.match(/```json\s*([\s\S]*?)\s*```/); if (jsonMatch && jsonMatch[1]) { resultJsonText = jsonMatch[1]; }

            const geminiResult = JSON.parse(resultJsonText);
            console.log("[reevaluateAnswer ADAPTIVE] Gemini výsledek přehodnocení:", geminiResult);

            if (typeof geminiResult.score !== 'number' || typeof geminiResult.correctness !== 'string' || typeof geminiResult.reasoning !== 'string') {
                throw new Error("Neúplná odpověď od AI při přehodnocení (chybí score, correctness nebo reasoning).");
            }
            const finalScore = Math.max(0, Math.min((question.maxScore || 1), Math.round(geminiResult.score)));
            const finalCorrectness = ["correct", "incorrect", "partial"].includes(geminiResult.correctness) ? geminiResult.correctness : "error";

            return {
                score: finalScore,
                max_score: question.maxScore || 1,
                correctness: finalCorrectness,
                reasoning: geminiResult.reasoning, // Mělo by obsahovat původní db explanation
                detailed_error_analysis: geminiResult.detailed_error_analysis || null,
                future_improvement_feedback: geminiResult.future_improvement_feedback || null,
                is_equivalent: typeof geminiResult.is_equivalent === 'boolean' ? geminiResult.is_equivalent : null,
                reevaluation_note: geminiResult.reevaluation_note || "Přehodnoceno AI." // Default note
            };
        } catch (apiError) {
            console.error('[reevaluateAnswer ADAPTIVE] Chyba komunikace s AI při přehodnocení:', apiError);
            throw apiError;
        }
    }

    // --- END: Логика оценки ответов ---

    // --- START: Логика расчета и сохранения результатов ---
    function calculateFinalResultsLogic(userAnswers, questions) {
        let totalScore = 0;
        let totalMaxPossibleScore = 0;
        let correctAnswers = 0;
        let incorrectAnswers = 0;
        let partiallyCorrectAnswers = 0;
        let skippedAnswers = 0;
        let evaluationErrors = 0;
        const topicResults = {};

        userAnswers.forEach(answer => {
            const questionData = questions.find(q => q.id === answer.question_db_id || q.question_db_id === answer.question_db_id); // Handle if questions array is different
            const maxScoreForQuestion = answer.maxScore || 1;
            totalMaxPossibleScore += maxScoreForQuestion;
            totalScore += answer.scoreAwarded || 0;

            const topicName = answer.topic_name || "Neznámé téma";
            if (!topicResults[topicName]) {
                topicResults[topicName] = {
                    name: topicName, total_questions: 0, correct: 0, incorrect: 0, partial: 0, skipped: 0, points_achieved: 0, max_points: 0,
                    icon: topicIcons[topicName] || topicIcons.default // Přidání ikony
                };
            }
            topicResults[topicName].total_questions++;
            topicResults[topicName].max_points += maxScoreForQuestion;
            topicResults[topicName].points_achieved += answer.scoreAwarded || 0;

            switch (answer.correctness) {
                case "correct": correctAnswers++; topicResults[topicName].correct++; break;
                case "partial": partiallyCorrectAnswers++; topicResults[topicName].partial++; break;
                case "incorrect": incorrectAnswers++; topicResults[topicName].incorrect++; break;
                case "skipped": skippedAnswers++; topicResults[topicName].skipped++; break;
                case "error": default: evaluationErrors++; topicResults[topicName].incorrect++; break; // Počítáme chybu jako nesprávnou
            }
        });

        Object.values(topicResults).forEach(topic => {
            topic.score_percent = topic.max_points > 0 ? Math.round((topic.points_achieved / topic.max_points) * 100) : 0;
            if (topic.score_percent >= 75) topic.strength = 'strength';
            else if (topic.score_percent < 40) topic.strength = 'weakness';
            else topic.strength = 'neutral';
        });

        const percentage = totalMaxPossibleScore > 0 ? Math.round((totalScore / totalMaxPossibleScore) * 100) : 0;
        const totalAnswered = userAnswers.length - skippedAnswers - evaluationErrors;

        return {
            score: totalScore,
            maxScore: totalMaxPossibleScore,
            percentage: percentage,
            correctAnswers: correctAnswers,
            incorrectAnswers: incorrectAnswers,
            partiallyCorrectAnswers: partiallyCorrectAnswers,
            skippedAnswers: skippedAnswers,
            totalAnswered: totalAnswered,
            evaluationErrors: evaluationErrors,
            topicResults: topicResults,
            answers: userAnswers // Přidáváme všechny odpovědi pro uložení a review
        };
    }
    function generateDetailedAnalysisLogic(results, answers, questionsData) { /* ... (stejné jako předtím) ... */ }
    async function saveTestResultsLogic(supabase, currentUser, testResultsData, userAnswers, questions, testEndTime) { /* ... (stejné jako předtím) ... */ }
    async function awardPointsLogic(supabase, currentUser, currentProfile, selectedTestType, testResultsData, testTypeConfig) { /* ... (stejné jako předtím) ... */ }
    // --- END: Логика расчета и сохранения результатов ---

    // --- START: Проверка существующего теста ---
    async function checkExistingDiagnosticLogic(supabase, userId) { /* ... (stejné jako předtím) ... */ }
    // --- END: Проверка существующего теста ---

    // --- START: Логика Уведомлений ---
    async function fetchNotificationsLogic(supabase, userId, limit = NOTIFICATION_FETCH_LIMIT) { if (!supabase || !userId) { console.error("[NotificationsLogic] Missing Supabase client or User ID."); return { unreadCount: 0, notifications: [] }; } try { const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[NotificationsLogic] Exception fetching notifications:", error); return { unreadCount: 0, notifications: [] }; } }
    // --- END: Логика Уведомлений ---

    // --- START: Глобальный Экспорт ---
    global.TestLogic = {
        loadTestQuestions: loadTestQuestionsLogic,
        getNextAdaptiveQuestion: getNextAdaptiveQuestionLogic,
        checkAnswerWithGemini: checkAnswerWithGeminiLogic,
        reevaluateAnswerWithGemini: reevaluateAnswerWithGeminiLogic,
        calculateFinalResults: calculateFinalResultsLogic,
        generateDetailedAnalysis: generateDetailedAnalysisLogic,
        saveTestResults: saveTestResultsLogic,
        awardPoints: awardPointsLogic,
        checkExistingDiagnostic: checkExistingDiagnosticLogic,
        fetchNotifications: fetchNotificationsLogic,
        SCORE_THRESHOLD_FOR_SAVING: SCORE_THRESHOLD_FOR_SAVING,
        compareNumericAdvanced: compareNumericAdvanced,
        compareTextAdvanced: compareTextAdvanced,
    };
    console.log("test1-logic.js ADAPTIVE (vFEEDBACK + Skip/Re-evaluate) loaded and TestLogic exposed.");
    // --- END: Глобальный Экспорт ---

})(window);