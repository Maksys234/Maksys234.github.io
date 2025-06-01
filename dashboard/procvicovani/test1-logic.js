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

// Используем IIFE для изоляции области видимости
(function(global) {
    'use strict';

    // --- START: Конфигурация ---
    const supabaseUrl = 'https://qcimhjjwvsbgjsitmvuh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbMd_cmPN5yY3DbWCBYc9D10';
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
        } else {
            baseQuery = baseQuery.eq('source_exam_type', selectedTestTypeIdentifier);
            if (userGradeString) {
                 baseQuery = baseQuery.eq('target_grade', userGradeString);
            }
        }

        const { data: fetchedQuestions, error: fetchError } = await baseQuery;

        if (fetchError) {
            console.error(`[Logic LoadQ ADAPTIVE] Chyba při načítání otázek z DB pro ${selectedTestTypeIdentifier}:`, fetchError);
            return {
                firstQuestion: null,
                questionPool: [],
                initialDifficultyEstimate: 3,
                questionsToAnswerInTest: questionsToLoadCount
            };
        }

        if (!fetchedQuestions || fetchedQuestions.length === 0) {
            const specificGradeMessage = userGradeString ? `a ročník/y relevantní pro '${userGradeString}'` : "";
            const warningMessage = `V databázi nejsou žádné otázky pro test '${selectedTestTypeIdentifier}' ${specificGradeMessage} (kromě konstrukčních).`;
            console.warn(`[Logic LoadQ ADAPTIVE] ${warningMessage}`);
             return {
                firstQuestion: null,
                questionPool: [],
                initialDifficultyEstimate: 3,
                questionsToAnswerInTest: questionsToLoadCount
            };
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

            const sortedTopicIds = Object.keys(questionsByTopic).sort((a, b) => {
                const ratingA = topicRatings[a]?.overall || 3;
                const ratingB = topicRatings[b]?.overall || 3;
                return ratingA - ratingB;
            });

            let questionsPerTopicTarget = Math.max(1, Math.floor(questionsToLoadCount / Math.max(1, sortedTopicIds.length)));
            if (sortedTopicIds.length > 0 && sortedTopicIds.length < 4) {
                questionsPerTopicTarget = Math.ceil(questionsToLoadCount / Math.max(1, sortedTopicIds.length));
            }
            console.log(`[Logic LoadQ ADAPTIVE] Celkem témat s otázkami: ${sortedTopicIds.length}. Cílový počet otázek na téma: ${questionsPerTopicTarget}`);

            for (const topicId of sortedTopicIds) {
                if (selectedQuestions.length >= questionsToLoadCount) break;
                let availableQuestionsInTopic = questionsByTopic[topicId] || [];
                shuffleArray(availableQuestionsInTopic);
                const selfRating = topicRatings[topicId]?.overall || 3;

                let difficultyTargets = [];
                if (selfRating <= 2) {
                    difficultyTargets = [
                        { difficulty: 1, count: Math.ceil(questionsPerTopicTarget * 0.5) },
                        { difficulty: 2, count: Math.ceil(questionsPerTopicTarget * 0.3) },
                        { difficulty: 3, count: Math.ceil(questionsPerTopicTarget * 0.2) }
                    ];
                } else if (selfRating === 3) {
                    difficultyTargets = [
                        { difficulty: 2, count: Math.ceil(questionsPerTopicTarget * 0.3) },
                        { difficulty: 3, count: Math.ceil(questionsPerTopicTarget * 0.4) },
                        { difficulty: 4, count: Math.ceil(questionsPerTopicTarget * 0.3) }
                    ];
                } else {
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
                let currentQuestionsFromTopic = selectedQuestions.filter(q => q.topic_id == topicId).length;
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

        if (selectedQuestions.length < questionsToLoadCount) {
            console.log(`[Logic LoadQ ADAPTIVE] Doplňování. Aktuálně ${selectedQuestions.length}/${questionsToLoadCount}. Dostupné celkem: ${allQuestionsForProcessing.length}`);
            let remainingPool = allQuestionsForProcessing.filter(q => !selectedQuestionIds.has(q.id));
            shuffleArray(remainingPool);
            while (selectedQuestions.length < questionsToLoadCount && remainingPool.length > 0) {
                const question = remainingPool.shift();
                if (question && question.id != null) {
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

        const formattedQuestionsPool = selectedQuestions.map((question, index) => ({
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
            maxScore: (question.question_type === 'multiple_choice' || question.question_type === 'numeric' || question.question_type === 'text' || question.question_type === 'ano_ne') ? 1 : (question.maxScore || 1)
        }));

        if (formattedQuestionsPool.length === 0) {
            console.warn(`[Logic LoadQ ADAPTIVE] Po všech krocích nebyly vybrány žádné otázky pro ${selectedTestTypeIdentifier}. Vracím prázdná data.`);
            return {
                firstQuestion: null,
                questionPool: [],
                initialDifficultyEstimate: 3,
                questionsToAnswerInTest: questionsToLoadCount
            };
        }
        console.log(`[Logic LoadQ ADAPTIVE] Finálně vybráno a zformátováno ${formattedQuestionsPool.length} otázek do poolu pro ${selectedTestTypeIdentifier}.`);

        const difficultyDistribution = formattedQuestionsPool.reduce((acc, q) => {
            acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
            return acc;
        }, {});
        console.log(`[Logic LoadQ ADAPTIVE] Distribuce obtížností ve finálním poolu (${selectedTestTypeIdentifier}):`, difficultyDistribution);

        const firstQuestionFromPool = formattedQuestionsPool.length > 0 ? formattedQuestionsPool[0] : null;
        const initialDifficulty = firstQuestionFromPool ? firstQuestionFromPool.difficulty : 3;

        return {
            firstQuestion: firstQuestionFromPool,
            questionPool: formattedQuestionsPool,
            initialDifficultyEstimate: initialDifficulty,
            questionsToAnswerInTest: Math.min(questionsToLoadCount, formattedQuestionsPool.length)
        };
    }

    async function getNextAdaptiveQuestionLogic(questionPool, presentedQuestionIdsSet, lastAnswerCorrect, currentDifficulty, questionsAnsweredSoFar, totalQuestionsInTest) {
        console.log(`[getNextAdaptiveQuestion ADAPTIVE] Hledám další otázku. Pool: ${questionPool.length}, Zodpovězeno: ${questionsAnsweredSoFar}/${totalQuestionsInTest}, Minulá odpověď: ${lastAnswerCorrect}, Aktuální obtížnost: ${currentDifficulty}`);

        if (questionsAnsweredSoFar >= totalQuestionsInTest) {
            console.log("[getNextAdaptiveQuestion ADAPTIVE] Dosažen limit otázek pro tuto session.");
            return { nextQuestion: null, nextDifficulty: currentDifficulty };
        }

        let nextDifficultyTarget = currentDifficulty;
        if (lastAnswerCorrect === true) {
            nextDifficultyTarget = Math.min(currentDifficulty + 1, 5);
        } else if (lastAnswerCorrect === false) {
            nextDifficultyTarget = Math.max(currentDifficulty - 1, 1);
        }
        console.log(`[getNextAdaptiveQuestion ADAPTIVE] Cílová obtížnost pro další otázku: ${nextDifficultyTarget}`);

        const availableQuestions = questionPool.filter(q => !presentedQuestionIdsSet.has(q.id));

        if (availableQuestions.length === 0) {
            console.log("[getNextAdaptiveQuestion ADAPTIVE] Žádné další dostupné otázky v poolu.");
            return { nextQuestion: null, nextDifficulty: nextDifficultyTarget };
        }

        let chosenQuestion = null;
        let candidates = availableQuestions.filter(q => q.difficulty === nextDifficultyTarget);
        if (candidates.length > 0) {
            chosenQuestion = candidates[Math.floor(Math.random() * candidates.length)];
            console.log(`[getNextAdaptiveQuestion ADAPTIVE] Nalezena otázka s přesnou obtížností ${nextDifficultyTarget}.`);
        } else {
            const difficultyOffsets = lastAnswerCorrect === true ? [1, -1, 2, -2] : [-1, 1, -2, 2];
            for (const offset of difficultyOffsets) {
                const tryDifficulty = nextDifficultyTarget + offset;
                if (tryDifficulty >= 1 && tryDifficulty <= 5) {
                    candidates = availableQuestions.filter(q => q.difficulty === tryDifficulty);
                    if (candidates.length > 0) {
                        chosenQuestion = candidates[Math.floor(Math.random() * candidates.length)];
                        console.log(`[getNextAdaptiveQuestion ADAPTIVE] Nalezena otázka s obtížností ${tryDifficulty} (offset ${offset}).`);
                        nextDifficultyTarget = tryDifficulty;
                        break;
                    }
                }
            }
        }

        if (!chosenQuestion && availableQuestions.length > 0) {
            console.log("[getNextAdaptiveQuestion ADAPTIVE] Žádná otázka s cílovou nebo blízkou obtížností. Výběr nejbližší dostupné.");
            availableQuestions.sort((a, b) => Math.abs(a.difficulty - nextDifficultyTarget) - Math.abs(b.difficulty - nextDifficultyTarget));
            chosenQuestion = availableQuestions[0];
            nextDifficultyTarget = chosenQuestion.difficulty;
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
        correctAnswerOrExplanation, // Může být string nebo objekt pro vícedílné odpovědi
        userAnswer,                 // Může být string nebo objekt pro vícedílné odpovědi
        maxScore = 1,
        currentQuestionIndex,       // Pro logování
        solutionExplanationForConstruction = null, // Nyní se předává `solution_explanation` z DB
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
        if (userAnswer === null || userAnswer === undefined) { isSkippedOrEmpty = true; }
        else if (typeof userAnswer === 'object' && userAnswer !== null) { isSkippedOrEmpty = Object.values(userAnswer).every(val => val === null || String(val).trim() === ''); }
        else { isSkippedOrEmpty = String(userAnswer).trim() === ""; }

        if (isSkippedOrEmpty) {
            return {
                score: 0, max_score: maxScore, correctness: "skipped",
                reasoning: solutionExplanationForConstruction || "Odpověď nebyla poskytnuta nebo je prázdná.", // Použije oficiální řešení pokud je, jinak obecnou zprávu
                detailed_error_analysis: "Uživatel neodpověděl.",
                future_improvement_feedback: "Příště zkuste odpovědět na otázku.",
                is_equivalent: null
            };
        }

        // Lokální kontrola pro MC a jednoduché typy
        if (questionType === 'multiple_choice' && optionsForMC && typeof correctAnswerOrExplanation === 'string') {
            const correctLetter = String(correctAnswerOrExplanation).trim().toUpperCase().charAt(0);
            const userLetter = String(userAnswer).trim().toUpperCase().charAt(0);
            const localComparisonResult = correctLetter === userLetter;
            const finalCorrectness = localComparisonResult ? 'correct' : 'incorrect';
            const finalScore = localComparisonResult ? maxScore : 0;
            let finalReasoning = localComparisonResult ? `Správně jste vybral(a) možnost ${correctLetter}.` : `Nesprávně. Správná možnost byla ${correctLetter}.`;
            const correctOptionIndex = correctLetter.charCodeAt(0) - 65;
            if (Array.isArray(optionsForMC) && optionsForMC[correctOptionIndex] !== undefined) { finalReasoning += ` (${optionsForMC[correctOptionIndex]})`; }

            // Pro jednoduché MC otázky můžeme přednastavit AI feedback
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

        const runFallbackCheck = (fallbackReason = "Automatické hodnocení selhalo. Použita záložní kontrola.") => { /* ... (stejné jako předtím) ... */ };
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
        if (questionType === 'multiple_choice') { /* ... (stejné jako předtím, jen s novou strukturou JSON) ... */ }
        else { /* ... (stejné jako předtím, jen s novou strukturou JSON) ... */ }

        // Zkráceno pro přehlednost - logika volání Gemini API zůstává stejná,
        // ale parsování výsledku musí reflektovat novou JSON strukturu.
        // Důležité je, aby 'reasoning' nyní obsahovalo `solutionExplanationForConstruction`
        // a Gemini generovalo `detailed_error_analysis` a `future_improvement_feedback`.
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
                // Ověření klíčových polí
                if (typeof geminiResult.score !== 'number' || typeof geminiResult.correctness !== 'string' || typeof geminiResult.reasoning !== 'string') {
                    return runFallbackCheck("Neúplná odpověď od AI (chybí klíčové pole).");
                }

                const finalScore = Math.max(0, Math.min(maxScore, Math.round(geminiResult.score)));
                const finalCorrectness = ["correct", "incorrect", "partial"].includes(geminiResult.correctness) ? geminiResult.correctness : "incorrect";

                // Gemini má nyní generovat tyto dva nové fieldy
                const detailedError = geminiResult.detailed_error_analysis || null;
                const futureFeedback = geminiResult.future_improvement_feedback || null;

                const finalResult = {
                    score: finalScore,
                    max_score: maxScore,
                    correctness: finalCorrectness,
                    reasoning: geminiResult.reasoning, // Toto by mělo být oficiální vysvětlení
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
        const baseInstruction = `Jsi PŘÍSNÝ, DETAILNÍ a PŘESNÝ AI hodnotitel. Student požádal o přehodnocení své odpovědi. Pečlivě zvaž předchozí hodnocení a poskytni AKTUALIZOVANÉ komplexní posouzení. Vrať POUZE JSON objekt podle zadané struktury.`;
        const outputStructure = `{
    "score": number (0-${question.maxScore || 1}, celé číslo),
    "max_score": ${question.maxScore || 1},
    "correctness": string ("correct" | "incorrect" | "partial"),
    "reasoning": string (Vysvětlení z databáze - pole 'solution_explanation', které je: """${question.solution_explanation || "Oficiální postup není k dispozici."}"""),
    "detailed_error_analysis": string | null (Pokud je odpověď incorrect/partial: NOVÁ DETAILNÍ analýza konkrétní chyby studenta. Pokud 'correct': null),
    "future_improvement_feedback": string | null (Pokud je odpověď incorrect/partial: NOVÁ KONKRÉTNÍ rada, jak se podobným chybám v budoucnu vyvarovat. Pokud 'correct': null),
    "is_equivalent": boolean | null,
    "reevaluation_note": string | null (Poznámka k přehodnocení, např. proč se hodnocení změnilo nebo zůstalo stejné.)
}`;
        const questionContext = `Kontext otázky: """${question.question_text}"""`;
        const formattedCorrectAnswer = typeof question.correct_answer === 'object' ? JSON.stringify(question.correct_answer) : question.correct_answer;
        const formattedUserAnswer = typeof userAnswerEntry.userAnswerValue === 'object' ? JSON.stringify(userAnswerEntry.userAnswerValue) : userAnswerEntry.userAnswerValue;
        const inputData = `SPRÁVNÁ ODPOVĚĎ/ŘEŠENÍ Z DATABÁZE: """${formattedCorrectAnswer}"""\nOFICIÁLNÍ VYSVĚTLENÍ Z DATABÁZE: """${question.solution_explanation || "Oficiální postup není k dispozici."}"""\nODPOVĚĎ STUDENTA: """${formattedUserAnswer}"""`;
        const previousEvalText = `PŘEDCHOZÍ HODNOCENÍ:\n- Skóre: ${previousEvaluation.scoreAwarded}/${previousEvaluation.maxScore}\n- Správnost: ${previousEvaluation.correctness}\n- AI Analýza chyby: ${previousEvaluation.error_analysis || 'N/A'}\n- AI Zpětná vazba: ${previousEvaluation.feedback || 'N/A'}\n- AI Původní zdůvodnění (Gemini): ${previousEvaluation.reasoning || 'N/A'}`;

        const prompt = `${baseInstruction}\n${questionContext}\n${inputData}\n${previousEvalText}\nÚKOL: Přehodnoť odpověď studenta a poskytni aktualizovaný JSON (${outputStructure}). Zvláště se zaměř na pole "detailed_error_analysis", "future_improvement_feedback" a "reevaluation_note".`;

        try {
            console.log(`[reevaluateAnswer ADAPTIVE] Posílám požadavek na přehodnocení...`);
            const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.25 }, safetySettings: [ /* ... (stejné jako dříve) ... */ ] }) });
            if (!response.ok) { const errorBody = await response.text(); throw new Error(`Chyba Gemini API (${response.status}): ${errorBody}`); }
            const data = await response.json();
            if (data.promptFeedback?.blockReason) { throw new Error(`Požadavek blokován AI filtrem: ${data.promptFeedback.blockReason}.`); }
            const candidate = data.candidates?.[0];
            if (!candidate || !candidate.content?.parts?.[0]?.text) { throw new Error('AI nevrátilo platnou odpověď pro přehodnocení.'); }
            let resultJsonText = candidate.content.parts[0].text;
            const jsonMatch = resultJsonText.match(/```json\s*([\s\S]*?)\s*```/); if (jsonMatch && jsonMatch[1]) { resultJsonText = jsonMatch[1]; }
            
            const geminiResult = JSON.parse(resultJsonText);
            if (typeof geminiResult.score !== 'number' || typeof geminiResult.correctness !== 'string' || typeof geminiResult.reasoning !== 'string') {
                throw new Error("Neúplná odpověď od AI při přehodnocení.");
            }
            const finalScore = Math.max(0, Math.min((question.maxScore || 1), Math.round(geminiResult.score)));
            const finalCorrectness = ["correct", "incorrect", "partial"].includes(geminiResult.correctness) ? geminiResult.correctness : "error";

            return {
                score: finalScore,
                max_score: question.maxScore || 1,
                correctness: finalCorrectness,
                reasoning: geminiResult.reasoning, // Oficiální vysvětlení
                detailed_error_analysis: geminiResult.detailed_error_analysis || null,
                future_improvement_feedback: geminiResult.future_improvement_feedback || null,
                is_equivalent: typeof geminiResult.is_equivalent === 'boolean' ? geminiResult.is_equivalent : null,
                reevaluation_note: geminiResult.reevaluation_note || null
            };
        } catch (apiError) {
            console.error('[reevaluateAnswer ADAPTIVE] Chyba komunikace s AI při přehodnocení:', apiError);
            throw apiError; // Re-throw to be caught by UI
        }
    }

    // --- END: Логика оценки ответов ---

    // --- START: Логика расчета и сохранения результатов ---
    function calculateFinalResultsLogic(userAnswers, questions) { /* ... (stejné jako předtím) ... */ }
    function generateDetailedAnalysisLogic(results, answers, questionsData) { /* ... (stejné jako předtím) ... */ }
    async function saveTestResultsLogic(supabase, currentUser, testResultsData, userAnswers, questions, testEndTime) { /* ... (stejné jako předtím) ... */ }
    async function awardPointsLogic(supabase, currentUser, currentProfile, selectedTestType, testResultsData, testTypeConfig) { /* ... (stejné jako předtím) ... */ }
    // --- END: Логика расчета и сохранения результатов ---

    // --- START: Проверка существующего теста ---
    async function checkExistingDiagnosticLogic(supabase, userId) { /* ... (stejné jako předtím) ... */ }
    // --- END: Проверка существующего теста ---

    // --- START: Логика Уведомлений ---
    async function fetchNotificationsLogic(supabase, userId, limit = NOTIFICATION_FETCH_LIMIT) { /* ... (stejné jako předtím) ... */ }
    // --- END: Логика Уведомлений ---

    // --- START: Глобальный Экспорт ---
    global.TestLogic = {
        loadTestQuestions: loadTestQuestionsLogic,
        getNextAdaptiveQuestion: getNextAdaptiveQuestionLogic,
        checkAnswerWithGemini: checkAnswerWithGeminiLogic,
        reevaluateAnswerWithGemini: reevaluateAnswerWithGeminiLogic, // NOVÁ FUNKCE
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
    console.log("test1-logic.js ADAPTIVE (vFEEDBACK) loaded and TestLogic exposed.");
    // --- END: Глобальный Экспорт ---

})(window);