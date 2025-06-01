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
    const MINIMUM_QUESTIONS_THRESHOLD = 1; 

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
        const learningGoal = profileData?.learning_goal || 'exam_prep';
        const currentTestConfig = testTypeConfigAll[learningGoal];
        const selectedTestTypeIdentifier = currentTestConfig?.identifier || learningGoal;

        console.log(`[Logic LoadQ ADAPTIVE] Načítání otázek pro: Cíl=${learningGoal}, Identifikátor=${selectedTestTypeIdentifier}, Ročník=${userGradeString || 'N/A'}`);

        let questionsToLoadCount = TOTAL_QUESTIONS_IN_TEST;
        if (currentTestConfig && currentTestConfig.questionsCount) {
            questionsToLoadCount = currentTestConfig.questionsCount;
        }
        console.log(`[Logic LoadQ ADAPTIVE] Počet otázek k načtení: ${questionsToLoadCount}`);

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
            .neq('question_type', 'construction');

        if (learningGoal === 'math_explore') {
            if (userGradeString) {
                baseQuery = baseQuery.in('source_exam_type', ['prijimacky', 'math_review'])
                                   .eq('target_grade', userGradeString);
            } else {
                baseQuery = baseQuery.in('source_exam_type', ['prijimacky', 'math_review']);
            }
        } else if (learningGoal === 'math_accelerate') {
            const currentUserGradeNumber = gradeToNumber[userGradeString];
            const gradesToFetch = [];
            if (userGradeString) gradesToFetch.push(userGradeString);
            if (currentUserGradeNumber) {
                const nextGradeString = numberToGrade[currentUserGradeNumber + 1];
                if (nextGradeString) gradesToFetch.push(nextGradeString);
            }
            if (gradesToFetch.length > 0) {
                baseQuery = baseQuery.in('source_exam_type', ['prijimacky', 'math_review'])
                                   .in('target_grade', gradesToFetch);
            } else {
                baseQuery = baseQuery.in('source_exam_type', ['prijimacky', 'math_review']);
            }
        } else { // exam_prep, math_review
            baseQuery = baseQuery.eq('source_exam_type', selectedTestTypeIdentifier);
            if (userGradeString) {
                 baseQuery = baseQuery.eq('target_grade', userGradeString);
            }
        }

        const { data: fetchedQuestions, error: fetchError } = await baseQuery;

        if (fetchError) {
            console.error(`[Logic LoadQ ADAPTIVE] Chyba při načítání otázek z DB pro ${selectedTestTypeIdentifier}:`, fetchError);
            return [];
        }

        if (!fetchedQuestions || fetchedQuestions.length === 0) {
            const specificGradeMessage = userGradeString ? `a ročník/y relevantní pro '${userGradeString}'` : "";
            const warningMessage = `V databázi nejsou žádné otázky pro test '${selectedTestTypeIdentifier}' ${specificGradeMessage} (kromě konstrukčních).`;
            console.warn(`[Logic LoadQ ADAPTIVE] ${warningMessage}`);
            return [];
        }
        let allQuestionsForProcessing = fetchedQuestions;
        console.log(`[Logic LoadQ ADAPTIVE] Načteno ${allQuestionsForProcessing.length} otázek odpovídajících základnímu filtru pro ${selectedTestTypeIdentifier}.`);

        let selectedQuestions = [];
        const selectedQuestionIds = new Set();

        if (learningGoal === 'math_review' || learningGoal === 'exam_prep') {
            console.log(`[Logic LoadQ ADAPTIVE] Aplikuji ADAPTIVNÍ výběr na základě sebehodnocení témat pro cíl: ${learningGoal}.`);
            const questionsByTopic = allQuestionsForProcessing.reduce((acc, q) => {
                const topicId = q.topic_id || 'unknown';
                if (!acc[topicId]) acc[topicId] = [];
                acc[topicId].push(q);
                return acc;
            }, {});

            // Seřadit témata podle hodnocení uživatele (od nejslabších) nebo podle výchozího pořadí, pokud hodnocení chybí
            const sortedTopicIds = Object.keys(questionsByTopic).sort((a, b) => {
                const ratingA = topicRatings[a]?.overall || 3; // Default to medium if not rated
                const ratingB = topicRatings[b]?.overall || 3;
                return ratingA - ratingB; // Ascending by rating (weakest first)
            });

            let questionsPerTopicTarget = Math.max(1, Math.floor(questionsToLoadCount / Math.max(1, sortedTopicIds.length)));
             // Pokud je málo témat s otázkami, navýšíme počet otázek na téma
            if (sortedTopicIds.length > 0 && sortedTopicIds.length < 4) {
                questionsPerTopicTarget = Math.ceil(questionsToLoadCount / Math.max(1, sortedTopicIds.length));
            }

            console.log(`[Logic LoadQ ADAPTIVE] Celkem témat s otázkami: ${sortedTopicIds.length}. Cílový počet otázek na téma: ${questionsPerTopicTarget}`);


            for (const topicId of sortedTopicIds) {
                if (selectedQuestions.length >= questionsToLoadCount) break;

                let availableQuestionsInTopic = questionsByTopic[topicId] || [];
                shuffleArray(availableQuestionsInTopic);
                const selfRating = topicRatings[topicId]?.overall || 3; // Default to medium

                // Definice cílů obtížnosti na základě sebehodnocení
                let difficultyTargets = [];
                if (selfRating <= 2) { // Uživatel se cítí slabý
                    difficultyTargets = [
                        { difficulty: 1, count: Math.ceil(questionsPerTopicTarget * 0.5) }, // 50% nejlehčí
                        { difficulty: 2, count: Math.ceil(questionsPerTopicTarget * 0.3) }, // 30% lehké
                        { difficulty: 3, count: Math.ceil(questionsPerTopicTarget * 0.2) }  // 20% střední
                    ];
                } else if (selfRating === 3) { // Střední
                    difficultyTargets = [
                        { difficulty: 2, count: Math.ceil(questionsPerTopicTarget * 0.3) },
                        { difficulty: 3, count: Math.ceil(questionsPerTopicTarget * 0.4) },
                        { difficulty: 4, count: Math.ceil(questionsPerTopicTarget * 0.3) }
                    ];
                } else { // Uživatel se cítí silný (4-5)
                    difficultyTargets = [
                        { difficulty: 3, count: Math.ceil(questionsPerTopicTarget * 0.2) },
                        { difficulty: 4, count: Math.ceil(questionsPerTopicTarget * 0.5) },
                        { difficulty: 5, count: Math.ceil(questionsPerTopicTarget * 0.3) }
                    ];
                }
                 console.log(`[Logic LoadQ ADAPTIVE] Pro Téma ID ${topicId} (Rating: ${selfRating}), cíle obtížnosti:`, difficultyTargets);

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
                // Pokud po cíleném výběru stále chybí otázky pro dané téma (do questionsPerTopicTarget), doplníme z jakékoliv obtížnosti v daném tématu
                let currentQuestionsFromTopic = selectedQuestions.filter(q => q.topic_id == topicId).length; // Musí být '==' kvůli typům
                const neededToFillTopic = Math.max(0, questionsPerTopicTarget - currentQuestionsFromTopic);

                if (neededToFillTopic > 0 && selectedQuestions.length < questionsToLoadCount) {
                     console.log(`[Logic LoadQ ADAPTIVE] Téma ${topicId}: Chybí ${neededToFillTopic} k naplnění cíle ${questionsPerTopicTarget}. Doplňuji...`);
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
                    const question = availableForDifficulty.shift();
                    if (question && question.id != null && !selectedQuestionIds.has(question.id)) {
                        selectedQuestions.push(question);
                        selectedQuestionIds.add(question.id);
                    }
                }
            });
        } else if (learningGoal === 'math_accelerate') {
            const currentUserGradeNum = gradeToNumber[userGradeString];
            const nextUserGradeString = currentUserGradeNum ? numberToGrade[currentUserGradeNum + 1] : null;

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

        // Doplnění otázek, pokud jich stále není dost (obecná logika)
        if (selectedQuestions.length < questionsToLoadCount) {
            console.log(`[Logic LoadQ ADAPTIVE] Doplňování. Aktuálně ${selectedQuestions.length}/${questionsToLoadCount}. Dostupné celkem: ${allQuestionsForProcessing.length}`);
            let remainingPool = allQuestionsForProcessing.filter(q => !selectedQuestionIds.has(q.id));
            shuffleArray(remainingPool);
            while (selectedQuestions.length < questionsToLoadCount && remainingPool.length > 0) {
                const question = remainingPool.shift();
                if (question && question.id != null) { // ID null check for safety
                    selectedQuestions.push(question);
                    selectedQuestionIds.add(question.id);
                }
            }
        }

        if (selectedQuestions.length > questionsToLoadCount) {
            shuffleArray(selectedQuestions);
            selectedQuestions = selectedQuestions.slice(0, questionsToLoadCount);
        }

        if (selectedQuestions.length === 0 && allQuestionsForProcessing.length > 0) {
             console.warn(`[Logic LoadQ ADAPTIVE] Po všech krocích nebyly vybrány žádné otázky pro ${selectedTestTypeIdentifier}, ale ${allQuestionsForProcessing.length} otázek bylo k dispozici. Beru náhodný vzorek.`);
             shuffleArray(allQuestionsForProcessing);
             selectedQuestions = allQuestionsForProcessing.slice(0, Math.min(questionsToLoadCount, allQuestionsForProcessing.length));
        }

        if (selectedQuestions.length === 0) {
            console.warn(`[Logic LoadQ ADAPTIVE] Po všech krocích nebyly vybrány žádné otázky pro ${selectedTestTypeIdentifier}. Vracím prázdné pole.`);
            return [];
        }
        console.log(`[Logic LoadQ ADAPTIVE] Finálně vybráno ${selectedQuestions.length} otázek pro ${selectedTestTypeIdentifier}.`);

        const formattedQuestions = selectedQuestions.map((question, index) => ({
            id: question.id,
            question_number: index + 1,
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
            source_exam_type: question.source_exam_type,
            target_grade: question.target_grade,
            answer_prefix: question.answer_prefix,
            answer_suffix: question.answer_suffix,
            maxScore: (question.question_type === 'multiple_choice' || question.question_type === 'numeric' || question.question_type === 'text') ? 1 : (question.maxScore || 1)
        }));

        const difficultyDistribution = formattedQuestions.reduce((acc, q) => {
            acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
            return acc;
        }, {});
        console.log(`[Logic LoadQ ADAPTIVE] Distribuce obtížností ve finálním testu (${selectedTestTypeIdentifier}):`, difficultyDistribution);
        const topicDistribution = formattedQuestions.reduce((acc, q) => {
            acc[q.topic_name] = (acc[q.topic_name] || 0) + 1;
            return acc;
        }, {});
        console.log(`[Logic LoadQ ADAPTIVE] Distribuce témat ve finálním testu (${selectedTestTypeIdentifier}):`, topicDistribution);

        return formattedQuestions;
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
                score: 0,
                max_score: maxScore,
                correctness: "skipped",
                reasoning: "Konstrukční úlohy se hodnotí manuálně nebo jsou dočasně přeskočeny.",
                error_analysis: null,
                feedback: "Postup pro konstrukční úlohy bude zkontrolován později.",
                is_equivalent: null
            };
        }

        console.log(`--- [Logic Check v10.2] Vyhodnocování Q#${currentQuestionIndex + 1} (Typ: ${questionType}, Max bodů: ${maxScore}) ---`);
        console.log(`   Otázka: ${questionText ? questionText.substring(0, 100) + '...' : 'N/A'}`);
        console.log(`   Správně (raw z DB): `, correctAnswerOrExplanation);
        console.log(`   Uživatel (raw z UI): `, userAnswer);

        let isSkippedOrEmpty = false;
        if (userAnswer === null || userAnswer === undefined) {
            isSkippedOrEmpty = true;
        } else if (typeof userAnswer === 'object' && userAnswer !== null) {
            isSkippedOrEmpty = Object.values(userAnswer).every(val => val === null || String(val).trim() === '');
        } else {
            isSkippedOrEmpty = String(userAnswer).trim() === "";
        }

        if (isSkippedOrEmpty) {
            return {
                score: 0,
                max_score: maxScore,
                correctness: "skipped",
                reasoning: "Odpověď nebyla poskytnuta nebo je prázdná.",
                error_analysis: null,
                feedback: "Příště zkuste odpovědět.",
                is_equivalent: null
            };
        }

        if (questionType === 'multiple_choice' && optionsForMC && typeof correctAnswerOrExplanation === 'string') {
            console.log(`[Logic v10.2 Q#${currentQuestionIndex + 1}] Lokální MC srovnání.`);
            const correctLetter = String(correctAnswerOrExplanation).trim().toUpperCase().charAt(0);
            const userLetter = String(userAnswer).trim().toUpperCase().charAt(0);
            const localComparisonResult = correctLetter === userLetter;
            const finalCorrectness = localComparisonResult ? 'correct' : 'incorrect';
            const finalScore = localComparisonResult ? maxScore : 0;
            let finalReasoning = localComparisonResult ? `Správně jste vybral(a) možnost ${correctLetter}.` : `Nesprávně. Správná možnost byla ${correctLetter}.`;

            const correctOptionIndex = correctLetter.charCodeAt(0) - 65;
            if (Array.isArray(optionsForMC) && optionsForMC[correctOptionIndex] !== undefined) {
                 finalReasoning += ` (${optionsForMC[correctOptionIndex]})`;
            }

            return { score: finalScore, max_score: maxScore, correctness: finalCorrectness, reasoning: finalReasoning, error_analysis: localComparisonResult ? null : "Vybrána nesprávná možnost.", feedback: localComparisonResult ? null : "Pečlivě si přečtěte všechny možnosti.", is_equivalent: null };
        } else if (['numeric', 'text', 'ano_ne'].includes(questionType) && typeof userAnswer !== 'object' && typeof correctAnswerOrExplanation === 'string') {
            const numericCheck = compareNumericAdvanced(userAnswer, correctAnswerOrExplanation);
            const textCheck = compareTextAdvanced(userAnswer, correctAnswerOrExplanation);
            let localComparisonResult = null;

            if (questionType === 'numeric') {
                localComparisonResult = numericCheck;
            } else { 
                localComparisonResult = textCheck;
            }

            if (localComparisonResult !== null) { 
                console.log(`[Logic v10.2 Q#${currentQuestionIndex + 1}] Lokální srovnání bylo JEDNOZNAČNÉ (${localComparisonResult}). Gemini se nevolá.`);
                const finalCorrectness = localComparisonResult ? 'correct' : 'incorrect';
                const finalScore = localComparisonResult ? maxScore : 0;
                return {
                    score: finalScore,
                    max_score: maxScore,
                    correctness: finalCorrectness,
                    reasoning: localComparisonResult ? "Odpověď je správná." : `Odpověď '${userAnswer}' není správná. Správná odpověď: '${correctAnswerOrExplanation}'.`,
                    error_analysis: localComparisonResult ? null : `Vaše odpověď se neshoduje se správnou.`,
                    feedback: localComparisonResult ? null : "Zkontrolujte svůj výpočet/odpověď.",
                    is_equivalent: localComparisonResult
                };
            }
            console.log(`[Logic v10.2 Q#${currentQuestionIndex + 1}] Lokální srovnání NENÍ JEDNOZNAČNÉ nebo selhalo. Volám Gemini.`);
        }

        const runFallbackCheck = (fallbackReason = "Automatické hodnocení selhalo. Použita záložní kontrola.") => {
            console.warn(`!!! [Logic Fallback v10.2] Používá se FALLBACK logika pro vyhodnocení Q#${currentQuestionIndex + 1} !!! Důvod:`, fallbackReason);
            let fallbackScore = 0; let fallbackCorrectness = "error"; let fallbackErrorAnalysis = "Chyba systému hodnocení."; let feedback = "Kontaktujte podporu, pokud problém přetrvává."; let isEquivalent = null;
            if (questionType === 'multiple_choice' && typeof correctAnswerOrExplanation === 'string') {
                const correctLetter = String(correctAnswerOrExplanation).trim().toUpperCase().charAt(0);
                const userLetter = String(userAnswer).trim().toUpperCase().charAt(0);
                isEquivalent = correctLetter === userLetter;
                fallbackCorrectness = isEquivalent ? "correct" : "incorrect";
                fallbackScore = isEquivalent ? maxScore : 0;
            } else {
                fallbackCorrectness = "error";
            }
            console.log(`[Logic Fallback v10.2 Výsledek] Skóre: ${fallbackScore}/${maxScore}, Správnost: ${fallbackCorrectness}, Ekvivalent: ${isEquivalent}`);
            return { score: fallbackScore, max_score: maxScore, correctness: fallbackCorrectness, reasoning: fallbackReason, error_analysis: fallbackErrorAnalysis, feedback: feedback, is_equivalent: isEquivalent };
        };

        if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR_') || GEMINI_API_KEY.length < 10) { return runFallbackCheck("Chybí platný Gemini API klíč."); }

        let prompt;
        const baseInstruction = `Jsi PŘÍSNÝ, DETAILNÍ a PŘESNÝ AI hodnotitel odpovědí z PŘIJÍMACÍCH ZKOUŠEK z matematiky/logiky pro 9. třídu ZŠ v ČR. Tvým úkolem je KOMPLEXNĚ posoudit odpověď studenta vůči správnému řešení/odpovědi v kontextu dané otázky. MUSÍŠ vrátit POUZE JSON objekt podle PŘESNĚ definované struktury. NEPŘIDÁVEJ žádný text PŘED nebo ZA JSON blok.
Při hodnocení numerických a algebraických odpovědí:
- **Ekvivalence formátu:** Považuj různé, ale matematicky SPRÁVNÉ formáty zápisu za ekvivalentní, POKUD otázka explicitně NEVYŽADUJE specifický formát. Například:
    - Zlomek \`3/2\` je ekvivalentní desetinnému číslu \`1.5\` (nebo \`1,5\`).
    - Algebraický výraz \`9/16a^2\` je ekvivalentní \`9/16a2\` nebo \`(9/16)*a^2\`. Zápis \`a2\` považuj za \`a^2\`, pokud z kontextu jasně nevyplývá, že jde o index.
    - Pro desetinná čísla akceptuj tečku \`.\` i čárku \`,\` jako desetinný oddělovač (např. \`-1.1\` je totéž co \`-1,1\`).
- **Tolerance mezer:** Ignoruj nadbytečné mezery kolem operátorů nebo čísel, pokud nemění matematický význam (např. \`x + 1\` vs \`x+1\`).
- **Důležité:** Pokud otázka explicitně NEŽÁDÁ odpověď v určitém formátu (např. 'Uveďte výsledek jako zlomek v základním tvaru'), pak jsou všechny matematicky správné a ekvivalentní formy odpovědi PLNĚ přijatelné a zaslouží si plný počet bodů, pokud jsou numericky správné.
Při zdůvodnění, pokud je odpověď studenta správná, ale v jiném formátu než \`SPRÁVNÁ ODPOVĚĎ/ŘEŠENÍ\`, uveď, že formát je alternativní, ale výsledek je správný.
Pro textové odpovědi (včetně ano/ne) buď tolerantní k velkým/malým písmenům, interpunkci na konci a mezerám, ale posuzuj jádro odpovědi.`;

        const outputStructure = `{ "score": number (0-${maxScore}, celé číslo), "max_score": ${maxScore}, "correctness": string ("correct" | "incorrect" | "partial"), "reasoning": string (DETAILNÍ zdůvodnění skóre a vysvětlení správného postupu/odpovědi v ČEŠTINĚ, včetně uznání ekvivalentních formátů), "error_analysis": string | null (KONKRÉTNÍ popis chyby studenta v ČEŠTINĚ; null pokud správně), "feedback": string | null (Krátká konstruktivní rada pro studenta v ČEŠTINĚ; null pokud správně), "is_equivalent": boolean | null (True, pokud je odpověď matematicky/logicky správná i přes jiný formát. False pokud je nesprávná. Null pro 'multiple_choice' nebo pokud nelze jednoznačně určit.) }`;
        const questionContext = `Kontext otázky: """${questionText}"""`;

        let formattedCorrectAnswer = correctAnswerOrExplanation;
        let formattedUserAnswer = userAnswer;

        if (typeof correctAnswerOrExplanation === 'object' && correctAnswerOrExplanation !== null) {
            formattedCorrectAnswer = JSON.stringify(correctAnswerOrExplanation);
        }
        if (typeof userAnswer === 'object' && userAnswer !== null) {
            formattedUserAnswer = JSON.stringify(userAnswer);
        }

        const inputData = `SPRÁVNÁ ODPOVĚĎ/ŘEŠENÍ: """${formattedCorrectAnswer}"""\nODPOVĚĎ STUDENTA: """${formattedUserAnswer}"""`;

        if (questionType === 'multiple_choice') {
            const optionsText = Array.isArray(optionsForMC) ? `Možnosti: ${optionsForMC.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('; ')}.` : "";
            prompt = `${baseInstruction} Typ otázky: Výběr z možností. Maximální skóre: ${maxScore}. ${questionContext} ${optionsText} ${inputData} ÚKOL: Porovnej POUZE PÍSMENO studentovy odpovědi (case-insensitive) se správným písmenem. SKÓRE: ${maxScore} (correct) POKUD se shoduje, jinak 0 (incorrect). "is_equivalent" = null. Zdůvodnění: Uveď správné písmeno a proč je daná možnost správná. Pokud špatně, uveď i proč je studentova volba špatná. Vrať POUZE JSON (${outputStructure}).`;
        } else {
             let multiPartInfo = "";
             if (typeof userAnswer === 'object' && userAnswer !== null && typeof correctAnswerOrExplanation === 'object' && correctAnswerOrExplanation !== null) {
                 multiPartInfo = "Toto je vícedílná odpověď, posuzuj každou část. Pořadí částí nemusí hrát roli (např. x=1, y=2 je ekvivalentní y=2, x=1).";
             }
            prompt = `${baseInstruction} Typ otázky: ${questionType === 'ano_ne' ? 'Ano/Ne' : (questionType === 'numeric' ? 'Numerická/Výpočetní' : 'Textová/Symbolická')}. ${multiPartInfo} Maximální skóre: ${maxScore}. ${questionContext} ${inputData} ÚKOL: Pečlivě posuď ekvivalenci a správnost. Vrať POUZE JSON (${outputStructure}).`;
        }

        try {
            console.log(`[Logic Gemini Call v10.2 Q#${currentQuestionIndex + 1}] Posílám požadavek do Gemini API... Prompt (start): ${prompt.substring(0,200)}...`);
            const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ] }) });
            if (!response.ok) { const errorBody = await response.text(); console.error(`[Logic Gemini Call v10.2 Q#${currentQuestionIndex + 1}] Chyba API (${response.status}):`, errorBody); throw new Error(`Chyba Gemini API (${response.status})`); }
            const data = await response.json();
            console.log(`[Logic Gemini Call v10.2 Q#${currentQuestionIndex + 1}] Surová odpověď:`, JSON.stringify(data));
            if (data.promptFeedback?.blockReason) { throw new Error(`Požadavek blokován AI filtrem: ${data.promptFeedback.blockReason}.`); }
            const candidate = data.candidates?.[0];
            if (!candidate) { const finishReason = data.candidates?.[0]?.finishReason; throw new Error(`AI neposkytlo kandidáta odpovědi. Důvod: ${finishReason || 'Neznámý'}.`); }
            if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) { if (candidate.finishReason === 'SAFETY') throw new Error('Odpověď blokována bezpečnostním filtrem AI.'); if (!candidate.content?.parts?.[0]?.text) { throw new Error(`Generování zastaveno: ${candidate.finishReason}.`); } }
            let resultJsonText = candidate.content?.parts?.[0]?.text;
            if (!resultJsonText) { throw new Error('AI vrátilo prázdnou odpověď.'); }
            const jsonMatch = resultJsonText.match(/```json\s*([\s\S]*?)\s*```/); if (jsonMatch && jsonMatch[1]) { resultJsonText = jsonMatch[1]; }
            console.log(`[Logic Gemini Call v10.2 Q#${currentQuestionIndex + 1}] Získaný text JSON (po očištění):`, resultJsonText);
            try {
                const geminiResult = JSON.parse(resultJsonText);
                console.log(`[Logic Gemini Call v10.2 Q#${currentQuestionIndex + 1}] Parsovaný výsledek JSON:`, geminiResult);
                if (typeof geminiResult.score !== 'number' || typeof geminiResult.correctness !== 'string' || typeof geminiResult.reasoning !== 'string') { return runFallbackCheck("Neúplná odpověď od AI (chybí klíčové pole)."); }
                const finalScore = Math.max(0, Math.min(maxScore, Math.round(geminiResult.score)));
                const finalCorrectness = ["correct", "incorrect", "partial"].includes(geminiResult.correctness) ? geminiResult.correctness : "incorrect";
                const finalResult = { score: finalScore, max_score: maxScore, correctness: finalCorrectness, reasoning: geminiResult.reasoning || "Nebylo poskytnuto žádné zdůvodnění.", error_analysis: geminiResult.error_analysis || null, feedback: geminiResult.feedback || null, is_equivalent: typeof geminiResult.is_equivalent === 'boolean' ? geminiResult.is_equivalent : null };
                console.log(`[Logic Gemini Call v10.2 Q#${currentQuestionIndex + 1}] Finální výsledek z Gemini:`, finalResult);
                return finalResult;
            } catch (parseError) { return runFallbackCheck(`Chyba při zpracování JSON odpovědi AI: ${parseError.message}`); }
        } catch (apiError) { return runFallbackCheck(`Chyba komunikace s AI: ${apiError.message}`); }
    }
    // --- END: Логика оценки ответов ---

    // --- START: Логика расчета и сохранения результатов ---
    function calculateFinalResultsLogic(userAnswers, questions) {
         let totalRawPointsAchieved = 0; let totalRawMaxPossiblePoints = 0; let correctCount = 0; let incorrectCount = 0; let partialCount = 0; let skippedCount = 0; let topicStats = {}; userAnswers.forEach((answer, index) => { if (!answer) { console.warn(`[Logic Calc v10.2] Chybí data odpovědi pro index ${index}.`); skippedCount++; return; } const topicKey = answer.topic_id || answer.topic_name || 'unknown'; const topicName = answer.topic_name || 'Neznámé téma'; if (!topicStats[topicKey]) { topicStats[topicKey] = { name: topicName, id: answer.topic_id, total_questions: 0, fully_correct: 0, points_achieved: 0, max_points: 0, score_percent: 0, strength: 'neutral' }; } topicStats[topicKey].total_questions++; topicStats[topicKey].max_points += answer.maxScore; totalRawMaxPossiblePoints += answer.maxScore; if (answer.correctness === "skipped") { skippedCount++; } else if (answer.correctness === "error") { incorrectCount++; } else { const awardedScore = answer.scoreAwarded ?? 0; totalRawPointsAchieved += awardedScore; topicStats[topicKey].points_achieved += awardedScore; if (answer.correctness === "correct") { correctCount++; topicStats[topicKey].fully_correct++; } else if (answer.correctness === "partial") { partialCount++; } else { incorrectCount++; } } }); Object.values(topicStats).forEach(stats => { stats.score_percent = stats.max_points > 0 ? Math.round((stats.points_achieved / stats.max_points) * 100) : 0; stats.strength = stats.score_percent >= 75 ? 'strength' : (stats.score_percent < 50 ? 'weakness' : 'neutral'); }); const totalApplicableQuestions = questions.length - skippedCount; const finalPercentage = totalRawMaxPossiblePoints > 0 ? Math.round((totalRawPointsAchieved / totalRawMaxPossiblePoints) * 100) : 0; const finalScoreOutOf50 = totalRawMaxPossiblePoints > 0 ? Math.round((totalRawPointsAchieved / totalRawMaxPossiblePoints) * 50) : 0; const resultsData = { totalQuestions: questions.length, correctAnswers: correctCount, incorrectAnswers: incorrectCount, partiallyCorrectAnswers: partialCount, skippedAnswers: skippedCount, evaluationErrors: userAnswers.filter(a => a?.correctness === 'error').length, score: finalScoreOutOf50, totalPointsAchieved: totalRawPointsAchieved, totalMaxPossiblePoints: totalRawMaxPossiblePoints, percentage: finalPercentage, topicResults: topicStats, timeSpent: null }; console.log("[Logic Calc v10.2] Finální výsledky vypočítány:", resultsData); return resultsData;
    }

    function generateDetailedAnalysisLogic(results, answers, questionsData) {
        const analysis = { summary: { score: results.score, total_points_achieved: results.totalPointsAchieved, total_max_possible_points: results.totalMaxPossiblePoints, percentage: results.percentage, time_spent_seconds: results.timeSpent, total_questions: results.totalQuestions, correct: results.correctAnswers, incorrect: results.incorrectAnswers, partial: results.partiallyCorrectAnswers, skipped: results.skippedAnswers, evaluation_errors: results.evaluationErrors, }, strengths: [], weaknesses: [], performance_by_topic: {}, performance_by_type: {}, performance_by_difficulty: {}, incorrectly_answered_details: [] }; for (const [topicKey, stats] of Object.entries(results.topicResults || {})) { analysis.performance_by_topic[stats.name] = { points_achieved: stats.points_achieved, max_points: stats.max_points, score_percent: stats.score_percent, total_questions: stats.total_questions, fully_correct: stats.fully_correct }; if (stats.strength === 'strength') analysis.strengths.push({ topic: stats.name, score: stats.score_percent }); else if (stats.strength === 'weakness') analysis.weaknesses.push({ topic: stats.name, score: stats.score_percent }); } analysis.strengths.sort((a, b) => b.score - a.score); analysis.weaknesses.sort((a, b) => a.score - b.score); answers.forEach((answer) => { if (!answer || answer.correctness === 'error') return; const qType = answer.question_type; const difficulty = answer.difficulty; const maxQScore = answer.maxScore; const awardedScore = answer.scoreAwarded ?? 0; if (!analysis.performance_by_type[qType]) analysis.performance_by_type[qType] = { points_achieved: 0, max_points: 0, count: 0 }; analysis.performance_by_type[qType].points_achieved += awardedScore; analysis.performance_by_type[qType].max_points += maxQScore; analysis.performance_by_type[qType].count++; if (difficulty !== null && difficulty !== undefined) { if (!analysis.performance_by_difficulty[difficulty]) analysis.performance_by_difficulty[difficulty] = { points_achieved: 0, max_points: 0, count: 0 }; analysis.performance_by_difficulty[difficulty].points_achieved += awardedScore; analysis.performance_by_difficulty[difficulty].max_points += maxQScore; analysis.performance_by_difficulty[difficulty].count++; } if (answer.correctness === 'incorrect' || answer.correctness === 'partial') { analysis.incorrectly_answered_details.push({ question_number: answer.question_number_in_test, question_text: answer.question_text, topic: answer.topic_name, type: answer.question_type, user_answer: answer.userAnswerValue, correct_answer: answer.correct_answer, score_awarded: awardedScore, max_score: maxQScore, explanation: answer.reasoning, error_identified: answer.error_analysis }); } }); if (results.score >= 43) analysis.overall_assessment = "Vynikající výkon!"; else if (results.score >= 33) analysis.overall_assessment = "Dobrý výkon, solidní základ."; else if (results.score >= 20) analysis.overall_assessment = "Průměrný výkon, zaměřte se na slabiny."; else analysis.overall_assessment = `Výkon ${results.score < 10 ? 'výrazně ' : ''}pod průměrem. Nutné opakování.`; if (results.score < SCORE_THRESHOLD_FOR_SAVING) analysis.overall_assessment += " Skóre je příliš nízké pro uložení a generování plánu."; analysis.recommendations = analysis.weaknesses.length > 0 ? [`Intenzivně se zaměřte na nejslabší témata: ${analysis.weaknesses.map(w => w.topic).slice(0, 2).join(', ')}.`] : ["Pokračujte v upevňování znalostí."]; if (analysis.incorrectly_answered_details.length > 3) analysis.recommendations.push(`Projděte si ${analysis.incorrectly_answered_details.length} otázek s nízkým nebo částečným skóre.`); console.log("[Logic Analysis v10.2] Vygenerována detailní analýza:", analysis); return analysis;
    }

    async function saveTestResultsLogic(supabase, currentUser, testResultsData, userAnswers, questions, testEndTime) {
         if (!currentUser || currentUser.id === 'PLACEHOLDER_USER_ID' || !supabase) { console.warn("[Logic Save v10.2] Neukládám: Chybí uživatel nebo Supabase."); return { success: false, error: "Uživatel není přihlášen." }; } if (testResultsData.score < SCORE_THRESHOLD_FOR_SAVING) { console.log(`[Logic Save v10.2] Skóre (${testResultsData.score}/50) < ${SCORE_THRESHOLD_FOR_SAVING}. Přeskakuji ukládání.`); return { success: false, error: `Skóre je příliš nízké (<${SCORE_THRESHOLD_FOR_SAVING}) pro uložení.` }; } console.log(`[Logic Save v10.2] Pokouším se uložit výsledky...`); let savedDiagnosticId = null; try { const detailedAnalysis = generateDetailedAnalysisLogic(testResultsData, userAnswers, questions); const answersToSave = userAnswers.map(a => ({ question_db_id: a.question_db_id, question_number_in_test: a.question_number_in_test, question_type: a.question_type, topic_id: a.topic_id, difficulty: a.difficulty, userAnswerValue: a.userAnswerValue, scoreAwarded: a.scoreAwarded, maxScore: a.maxScore, correctness: a.correctness, reasoning: a.reasoning, error_analysis: a.error_analysis, feedback: a.feedback, checked_by: a.checked_by })); const dataToSave = { user_id: currentUser.id, completed_at: testEndTime ? testEndTime.toISOString() : new Date().toISOString(), total_score: testResultsData.score, total_questions: testResultsData.totalQuestions, answers: answersToSave, topic_results: testResultsData.topicResults, analysis: detailedAnalysis, time_spent: testResultsData.timeSpent }; console.log("[Logic Save v10.2] Data k uložení:", dataToSave); const { data, error } = await supabase.from('user_diagnostics').insert(dataToSave).select('id').single(); if (error) throw error; savedDiagnosticId = data.id; console.log("[Logic Save v10.2] Diagnostika uložena, ID:", savedDiagnosticId); if (typeof window.VyukaApp?.checkAndAwardAchievements === 'function') { console.log('[Achievements v10.2] Triggering check after saving test results...'); window.VyukaApp.checkAndAwardAchievements(currentUser.id); } else { console.warn("[Achievements v10.2] Check function (window.VyukaApp.checkAndAwardAchievements) not found after saving test results."); } return { success: true, diagnosticId: savedDiagnosticId }; } catch (error) { console.error('[Logic Save v10.2] Chyba při ukládání:', error); return { success: false, error: `Nepodařilo se uložit výsledky: ${error.message}`, diagnosticId: savedDiagnosticId }; }
    }

    async function awardPointsLogic(supabase, currentUser, currentProfile, selectedTestType, testResultsData, testTypeConfig) {
        if (!selectedTestType || !testResultsData || !currentUser || !currentProfile || !supabase || !testTypeConfig) { console.warn("[Logic Points v10.2] Nelze vypočítat/uložit body: Chybí data.", {selectedTestType, testResultsData, currentUser, currentProfile, testTypeConfig}); return { success: false, awardedPoints: 0, newTotal: currentProfile?.points ?? 0, error: "Chybějící data pro výpočet bodů." }; } const config = testTypeConfig[selectedTestType]; if (!config) { console.warn(`[Logic Points v10.2] Neznámá konfigurace testu: ${selectedTestType}`); return { success: false, awardedPoints: 0, newTotal: currentProfile.points, error: `Neznámá konfigurace testu: ${selectedTestType}` }; } const multiplier = config.multiplier || 1.0; const totalPointsAchieved = testResultsData.totalPointsAchieved ?? 0; const totalMaxPossiblePoints = testResultsData.totalMaxPossiblePoints ?? 0; if (totalMaxPossiblePoints <= 0) { console.warn("[Logic Points v10.2] Maximální možný počet bodů je 0, nelze vypočítat procento."); return { success: true, awardedPoints: 0, newTotal: currentProfile.points }; } const percentageScore = totalPointsAchieved / totalMaxPossiblePoints; const calculatedPoints = Math.round(BASE_POINTS_FOR_100_PERCENT * percentageScore * multiplier); if (calculatedPoints <= 0) { console.log("[Logic Points v10.2] Nebyly získány žádné body (výpočet <= 0)."); return { success: true, awardedPoints: 0, newTotal: currentProfile.points }; } console.log(`[Logic Points v10.2] Výpočet: Base=${BASE_POINTS_FOR_100_PERCENT}, %Score=${percentageScore.toFixed(2)}, Multiplier=${multiplier} => Vypočítané body: ${calculatedPoints}`); const currentPoints = currentProfile.points || 0; const newPoints = currentPoints + calculatedPoints; try { const { error } = await supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (error) { throw error; } console.log(`[Logic Points v10.2] Body uživatele ${currentUser.id} aktualizovány na ${newPoints} (+${calculatedPoints})`); if (typeof window.VyukaApp?.checkAndAwardAchievements === 'function') { console.log('[Achievements v10.2] Triggering check after awarding points...'); window.VyukaApp.checkAndAwardAchievements(currentUser.id); } else { console.warn("[Achievements v10.2] Check function (window.VyukaApp.checkAndAwardAchievements) not found after awarding points."); } return { success: true, awardedPoints: calculatedPoints, newTotal: newPoints }; } catch (error) { console.error("[Logic Points v10.2] Chyba při aktualizaci bodů:", error); return { success: false, error: error.message, awardedPoints: 0, newTotal: currentPoints }; }
    }
    // --- END: Логика расчета и сохранения результатов ---

    // --- START: Проверка существующего теста ---
    async function checkExistingDiagnosticLogic(supabase, userId) {
         if (!userId || userId === 'PLACEHOLDER_USER_ID' || !supabase) { console.warn("[Logic Check v10.2] Kontrola testu přeskočena (není user/supabase)."); return false; } try { const { data: existingDiagnostic, error } = await supabase.from('user_diagnostics').select('id, completed_at').eq('user_id', userId).limit(1); if (error) { console.error("[Logic Check v10.2] Chyba při kontrole existujícího testu:", error); return false; } return existingDiagnostic && existingDiagnostic.length > 0; } catch (err) { console.error("[Logic Check v10.2] Neočekávaná chyba při kontrole testu:", err); return false; }
    }
    // --- END: Проверка существующего теста ---

    // --- START: Логика Уведомлений ---
    async function fetchNotificationsLogic(supabase, userId, limit = NOTIFICATION_FETCH_LIMIT) {
        if (!supabase || !userId) { console.error("[Notifications Logic v10.2] Chybí Supabase nebo ID uživatele."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications Logic v10.2] Načítání nepřečtených oznámení pro uživatele ${userId}`); try { const { data, error, count } = await supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) { throw error; } console.log(`[Notifications Logic v10.2] Načteno ${data?.length || 0} oznámení. Celkem nepřečtených: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications Logic v10.2] Výjimka při načítání oznámení:", error); return { unreadCount: 0, notifications: [] }; }
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
        fetchNotifications: fetchNotificationsLogic,
        SCORE_THRESHOLD_FOR_SAVING: SCORE_THRESHOLD_FOR_SAVING,
        compareNumericAdvanced: compareNumericAdvanced,
        compareTextAdvanced: compareTextAdvanced,
    };
    console.log("test1-logic.js loaded and TestLogic exposed (v_ADAPTIVE - 'math_explore' and 'math_accelerate' logic added - v28.5).");
    // --- END: Глобальный Экспорт ---

})(window);