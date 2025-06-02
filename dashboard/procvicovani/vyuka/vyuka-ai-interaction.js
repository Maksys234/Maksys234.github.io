// Файл: procvicovani/vyuka/vyuka-ai-interaction.js
// Логика взаимодействия с AI Gemini, управление чатом, учебной сессией, парсинг ответов AI
// Версия v28: Oprava "Nevím", nový koncept finálního testu na tabuli s potvrzením.

window.VyukaApp = window.VyukaApp || {};

(function(VyukaApp) {
	'use strict';

	try {
		const config = VyukaApp.config = VyukaApp.config || {};
		config.GEMINI_API_KEY = config.GEMINI_API_KEY || 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs';
		config.GEMINI_API_URL = config.GEMINI_API_URL || `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;
		config.MAX_GEMINI_HISTORY_TURNS = config.MAX_GEMINI_HISTORY_TURNS || 12;
        config.ACTION_INITIATE_FINAL_QUIZ = "[ACTION:INITIATE_FINAL_QUIZ]";
        config.ACTION_SHOW_QUIZ_ON_BOARD = "[ACTION:SHOW_QUIZ_ON_BOARD]";
        config.ACTION_EVALUATE_BOARD_QUIZ = "[ACTION:EVALUATE_BOARD_QUIZ]"; // Pro vyhodnocení kvízu z tabule

        VyukaApp.loadNextUncompletedTopic = async () => {
			const state = VyukaApp.state;
			const ui = VyukaApp.ui;
			if (!state.currentUser || state.topicLoadInProgress || !state.supabase) return;

			state.topicLoadInProgress = true;
			VyukaApp.setLoadingState('currentTopic', true);
			state.currentTopic = null;
            state.finalQuizOffered = false;
            state.finalQuizActive = false;
            state.finalQuizAnswers = [];
            state.quizQuestionsForBoard = [];

			if (ui.chatMessages) { ui.chatMessages.innerHTML = ''; }
            if (typeof VyukaApp.clearWhiteboard === 'function') {
			    VyukaApp.clearWhiteboard(false);
            } else { console.error("Error: VyukaApp.clearWhiteboard not defined"); }
			state.geminiChatContext = [];
            state.aiIsWaitingForAnswer = false;

			VyukaApp.manageUIState('loadingTopic');

			try {
				const { data: plans, error: planError } = await state.supabase
					.from('study_plans')
					.select('id')
					.eq('user_id', state.currentUser.id)
					.eq('status', 'active')
					.limit(1);

				if (planError) throw planError;

				if (!plans || plans.length === 0) {
					console.log("No active study plan found.");
					VyukaApp.manageUIState('noPlan');
					return;
				}
				state.currentPlanId = plans[0].id;

				const { data: activities, error: activityError } = await state.supabase
					.from('plan_activities')
					.select('id, title, description, topic_id')
					.eq('plan_id', state.currentPlanId)
					.eq('completed', false)
					.order('day_of_week')
					.order('time_slot')
					.limit(1);

				if (activityError) throw activityError;

				if (activities && activities.length > 0) {
					const activity = activities[0];
					let name = activity.title || 'N/A';
					let desc = activity.description || '';

					if (activity.topic_id) {
						try {
							const { data: topic, error: topicError } = await state.supabase
								.from('exam_topics')
								.select('name, description')
								.eq('id', activity.topic_id)
								.single();
							if (topicError && topicError.code !== 'PGRST116') throw topicError;
							if (topic) {
								name = topic.name || name;
								desc = topic.description || desc;
							}
						} catch(e) {
							console.warn("Could not fetch topic details for activity:", e);
						}
					}

					state.currentTopic = {
						activity_id: activity.id,
						plan_id: state.currentPlanId,
						name: name,
						description: desc,
						user_id: state.currentUser.id,
						topic_id: activity.topic_id
					};

					if (ui.currentTopicDisplay) {
						ui.currentTopicDisplay.innerHTML = `Téma: <strong>${VyukaApp.sanitizeHTML(name)}</strong>`;
					}
                    if (ui.vyukaSubjectTitle) ui.vyukaSubjectTitle.textContent = "AI Tutor";
                    if (ui.vyukaTopicSubtitle) ui.vyukaTopicSubtitle.textContent = name;

					await VyukaApp.startLearningSession();

				} else {
					console.log("All activities in the plan are completed.");
					VyukaApp.manageUIState('planComplete');
				}

			} catch (error) {
				console.error('Error loading next topic:', error);
				VyukaApp.showToast(`Chyba načítání tématu: ${error.message}`, "error");
				VyukaApp.manageUIState('error', { errorMessage: error.message });
			} finally {
				state.topicLoadInProgress = false;
				VyukaApp.setLoadingState('currentTopic', false);
			}
		};

		VyukaApp.handleMarkTopicComplete = async (fromQuiz = false) => { // Přidán parametr fromQuiz
			const state = VyukaApp.state;
			const config = VyukaApp.config;
			const ui = VyukaApp.ui;

			if (!state.currentTopic || !state.currentTopic.activity_id) {
				 VyukaApp.showToast("Chyba: Chybí informace o aktuálním tématu.", "error"); return;
			}
			if (!state.supabase) {
				 VyukaApp.showToast("Chyba: Databáze není dostupná.", "error"); return;
			}
			if (state.topicLoadInProgress) return;

			console.log(`[MarkComplete v28] Attempting to mark activity ID: ${state.currentTopic.activity_id}`);
			state.topicLoadInProgress = true;
            state.finalQuizOffered = false;
            state.finalQuizActive = false;
			VyukaApp.manageButtonStates();

			try {
				const { error: updateError } = await state.supabase
					.from('plan_activities')
					.update({ completed: true, updated_at: new Date().toISOString() })
					.eq('id', state.currentTopic.activity_id);
				if (updateError) throw updateError;

                let pointsToAward = config.POINTS_TOPIC_COMPLETE;
                if (fromQuiz) { // Možná bonus za dokončení testem
                    pointsToAward += (config.POINTS_QUIZ_COMPLETION_BONUS || 10); // např. 10 bodů navíc
                }

                if (typeof VyukaApp.awardPoints === 'function') {
				    await VyukaApp.awardPoints(pointsToAward);
                } else { console.error("Error: VyukaApp.awardPoints not defined."); }

				if (typeof VyukaApp.checkAndAwardAchievements === 'function') {
					await VyukaApp.checkAndAwardAchievements(state.currentUser.id);
				}

				VyukaApp.showToast(`Téma "${state.currentTopic.name}" úspěšně dokončeno! ${fromQuiz ? '(Test splněn)' : ''} Přesměrovávám...`, "success", 3000);
				setTimeout(() => { window.location.href = '/dashboard/procvicovani/main.html'; }, fromQuiz ? 1000 : 500); // Kratší prodleva po kvízu
			} catch (error) {
				console.error(`[MarkComplete v28] CATCH BLOCK:`, error);
				VyukaApp.showToast(`Chyba uložení dokončení tématu: ${error.message || 'Neznámá chyba'}`, "error", 6000);
				state.topicLoadInProgress = false;
				VyukaApp.manageButtonStates();
			}
		};

        VyukaApp.startLearningSession = async () => {
			const state = VyukaApp.state;
			if (!state.currentTopic) return;
			state.currentSessionId = VyukaApp.generateSessionId();
			VyukaApp.clearInitialChatState();
			VyukaApp.manageUIState('requestingExplanation');
            if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.disabled = true;
			const prompt = VyukaApp._buildInitialPrompt();
			await VyukaApp.sendToGemini(prompt);
		};

    	VyukaApp.requestContinue = async () => {
			const state = VyukaApp.state;
			console.log("[RequestContinue v28] Triggered. AI Waiting:", state.aiIsWaitingForAnswer, "FinalQuizOffered:", state.finalQuizOffered, "Final Quiz Active:", state.finalQuizActive);

			if (state.geminiIsThinking || !state.currentTopic || state.finalQuizActive || state.finalQuizOffered) {
                VyukaApp.showToast("Počkejte prosím, AI zpracovává požadavek nebo byla nabídnuta/probíhá závěrečná fáze.", "info", 3000);
                return;
            }
			if (state.aiIsWaitingForAnswer) {
				VyukaApp.showToast("Nejprve odpovězte na úlohu v chatu.", "warning", 3000);
				return;
			}
            if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.disabled = true;
			const prompt = VyukaApp._buildContinuePrompt();
			await VyukaApp.sendToGemini(prompt);
		};

    	VyukaApp.addChatMessage = async (displayMessage, sender, saveToDb = true, timestamp = new Date(), ttsText = null, originalContent = null, quickReplies = null) => {
			const ui = VyukaApp.ui; const state = VyukaApp.state; if (!ui.chatMessages) return;
			VyukaApp.clearInitialChatState(); const id = `msg-${Date.now()}`; let avatarContent;
            if (sender === 'user') { avatarContent = VyukaApp.getInitials(state.currentProfile, state.currentUser?.email); if (state.currentProfile?.avatar_url) { let avatarUrl = state.currentProfile.avatar_url; if (!avatarUrl.startsWith('http') && avatarUrl.includes('/')) {} else { avatarUrl += (avatarUrl.includes('?') ? '&' : '?') + `t=${new Date().getTime()}`; } avatarContent = `<img src="${VyukaApp.sanitizeHTML(avatarUrl)}" alt="${VyukaApp.sanitizeHTML(avatarContent)}">`; }} else { avatarContent = '<i class="fas fa-robot"></i>'; }
			const div = document.createElement('div'); div.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`; div.id = id; div.style.opacity = '0';
			const avatarDiv = `<div class="message-avatar">${avatarContent}</div>`; const bubbleDiv = document.createElement('div'); bubbleDiv.className = 'message-bubble';
			const bubbleContentDiv = document.createElement('div'); bubbleContentDiv.className = 'message-bubble-content'; VyukaApp.renderMarkdown(bubbleContentDiv, displayMessage, true);
			if (sender === 'gemini' && state.speechSynthesisSupported) { const ttsButton = document.createElement('button'); ttsButton.className = 'tts-listen-btn btn-tooltip'; ttsButton.title = 'Poslechnout'; ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>'; const textForSpeech = ttsText || displayMessage; ttsButton.dataset.textToSpeak = textForSpeech; ttsButton.addEventListener('click', (e) => { e.stopPropagation(); const buttonElement = e.currentTarget; const text = buttonElement.dataset.textToSpeak; if (text && typeof VyukaApp.speakText === 'function') { VyukaApp.speakText(text); } }); bubbleContentDiv.appendChild(ttsButton); }
            if (quickReplies && quickReplies.length > 0) { const quickRepliesDiv = document.createElement('div'); quickRepliesDiv.className = 'quick-replies-container'; quickReplies.forEach(reply => { const button = document.createElement('button'); button.className = 'btn btn-secondary btn-sm quick-reply-btn'; button.textContent = reply.title; button.dataset.payload = reply.payload; button.dataset.action = "true"; quickRepliesDiv.appendChild(button); }); bubbleContentDiv.appendChild(quickRepliesDiv); } // Tlačítka se již nepřidávají zde, ale přes setupFeatureListeners
			bubbleDiv.appendChild(bubbleContentDiv); const timeDiv = `<div class="message-timestamp">${VyukaApp.formatTimestamp(timestamp)}</div>`; div.innerHTML = avatarDiv + bubbleDiv.outerHTML + timeDiv;
			ui.chatMessages.appendChild(div); if (window.MathJax && typeof window.MathJax.typesetPromise === 'function' && (displayMessage.includes('$') || displayMessage.includes('\\'))) { setTimeout(() => { window.MathJax.typesetPromise([bubbleContentDiv]).catch((err) => console.error(`[MathJax v28] Typeset error chat: ${err.message}`)); }, 0); }
			div.scrollIntoView({ behavior: 'smooth', block: 'end' }); requestAnimationFrame(() => { div.style.opacity = '1'; }); VyukaApp.initTooltips();
			const contentToSave = originalContent !== null ? originalContent : displayMessage; if (saveToDb && state.supabase && state.currentUser && state.currentTopic && state.currentSessionId) { try { await state.supabase.from('chat_history').insert({ user_id: state.currentUser.id, session_id: state.currentSessionId, topic_id: state.currentTopic.topic_id, topic_name: state.currentTopic.name, role: sender === 'gemini' ? 'model' : 'user', content: contentToSave }); } catch (e) { console.error("Chat save error:", e); VyukaApp.showToast("Chyba ukládání chatu.", "error"); } }
            VyukaApp.manageButtonStates();
		};

        VyukaApp.handleQuickReplyAction = async (actionPayload) => {
            const state = VyukaApp.state; const ui = VyukaApp.ui;
            console.log(`[QuickReply v28] Handling action: ${actionPayload}`);
             const allQuickReplyButtons = document.querySelectorAll('.quick-reply-btn');
             allQuickReplyButtons.forEach(btn => btn.disabled = true);

            if (actionPayload === 'ACTION_USER_ACCEPTS_QUIZ') {
                console.log("[QuickReply v28] User accepts final quiz.");
                if(typeof VyukaApp.clearCurrentChatSessionHistory === 'function') { VyukaApp.clearCurrentChatSessionHistory(); }
                state.finalQuizActive = true; state.finalQuizOffered = false; state.aiIsWaitingForAnswer = false;
                VyukaApp.manageUIState('requestingFinalQuiz');
                if(typeof VyukaApp.requestFinalQuizContent === 'function'){ await VyukaApp.requestFinalQuizContent(); }
                else { console.error("VyukaApp.requestFinalQuizContent is not defined"); VyukaApp.showToast("Chyba: Funkce pro vyžádání testu chybí.", "error");}
            } else if (actionPayload === 'ACTION_USER_DECLINES_QUIZ') {
                console.log("[QuickReply v28] User declines final quiz. Continuing lesson.");
                state.finalQuizOffered = false; state.finalQuizActive = false; state.aiIsWaitingForAnswer = false;
                VyukaApp.manageUIState('learning');
                if (typeof VyukaApp.addChatMessage === 'function') { VyukaApp.addChatMessage("Dobře, pokračujme ve výkladu. Klikni na 'Pokračovat' nebo polož otázku.", 'gemini'); }
                if(ui.continueBtn) { ui.continueBtn.style.display = 'inline-flex'; ui.continueBtn.disabled = false; }
            } else { console.warn("[QuickReply v28] Unknown action payload:", actionPayload); }
        };

        VyukaApp.addThinkingIndicator = () => { /* ... stejné ... */ };
    	VyukaApp.removeThinkingIndicator = () => { /* ... stejné ... */ };
    	VyukaApp.updateGeminiThinkingState = (isThinking) => { /* ... stejné ... */ };

    	VyukaApp.handleSendMessage = async () => {
			const ui = VyukaApp.ui; const state = VyukaApp.state; const text = ui.chatInput?.value.trim();
            if (state.geminiIsThinking || !state.currentTopic || state.isListening) { VyukaApp.showToast("AI přemýšlí, mikrofon nahrává, nebo není vybráno téma.", "info"); return; }
            if (!text && !state.finalQuizActive && !state.finalQuizOffered) { return; } // Pro normální chat vyžadujeme text
            if (state.finalQuizActive) { VyukaApp.showToast("Probíhá test na tabuli. Odpovědi vyplňujte tam.", "info"); return; } // Během testu na tabuli je chat blokován
            if (state.finalQuizOffered && !text) { // Pokud je nabídnut kvíz a uživatel nic nenapíše, neděláme nic (čekáme na klik na tlačítko)
                return;
            }

            state.lastInteractionTime = Date.now();
            // state.finalQuizOffered = false; // Neresetujeme zde, protože handleQuickReplyAction to řeší

            if (state.aiIsWaitingForAnswer && !state.finalQuizActive && !state.finalQuizOffered) {
                console.log("[HandleSend v28] Resetting aiIsWaitingForAnswer state (standard flow).");
                state.aiIsWaitingForAnswer = false;
            }
			if (ui.chatInput) { ui.chatInput.value = ''; VyukaApp.autoResizeTextarea(); }
			await VyukaApp.addChatMessage(text, 'user', true, new Date(), null, text);
			state.geminiChatContext.push({ role: "user", parts: [{ text }] });
			VyukaApp.updateGeminiThinkingState(true);
            if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.disabled = true;
			let promptForGemini = VyukaApp._buildChatInteractionPrompt(text);
			await VyukaApp.sendToGemini(promptForGemini, true);
		};

    	VyukaApp.confirmClearChat = () => { /* ... stejné ... */ };
    	VyukaApp.clearCurrentChatSessionHistory = async () => { /* ... stejné ... */ };
    	VyukaApp.saveChatToPDF = async () => { /* ... stejné ... */ };

        VyukaApp.parseGeminiResponse = (rawText) => { /* ... Zůstává stejná jako v27 ... */
            console.log("[ParseGemini v28] Raw input:", rawText ? rawText.substring(0, 150) + "..." : "EMPTY");
			const config = VyukaApp.config; const boardMarker = "[BOARD_MARKDOWN]:"; const ttsMarker = "[TTS_COMMENTARY]:";
            const actionInitiateFinalQuizMarker = config.ACTION_INITIATE_FINAL_QUIZ; const actionShowQuizOnBoardMarker = config.ACTION_SHOW_QUIZ_ON_BOARD;
			const boardRegex = /\[BOARD_MARKDOWN]:\s*(?:```(?:markdown)?\s*([\s\S]*?)\s*```|([\s\S]*?))(?=\s*\[TTS_COMMENTARY]:|\s*\[BOARD_MARKDOWN]:|\s*\[ACTION:INITIATE_FINAL_QUIZ]|\s*\[ACTION:SHOW_QUIZ_ON_BOARD]|$)/i;
            const ttsRegex = /\[TTS_COMMENTARY]:\s*(?:```\s*([\s\S]*?)\s*```|([\s\S]*?))(?=\s*\[BOARD_MARKDOWN]:|\s*\[TTS_COMMENTARY]:|\s*\[ACTION:INITIATE_FINAL_QUIZ]|\s*\[ACTION:SHOW_QUIZ_ON_BOARD]|$)/i;
            const actionQuizOfferRegex = /(\[ACTION:INITIATE_FINAL_QUIZ])/i; const actionShowQuizRegex = /(\[ACTION:SHOW_QUIZ_ON_BOARD])/i;
			let remainingText = rawText || ""; let boardMarkdown = ""; let ttsCommentary = ""; let actionSignal = null;
            const quizOfferMatch = remainingText.match(actionQuizOfferRegex); const showQuizMatch = remainingText.match(actionShowQuizRegex);
            if (quizOfferMatch) { actionSignal = 'INITIATE_FINAL_QUIZ'; remainingText = remainingText.replace(quizOfferMatch[0], "").trim();
            } else if (showQuizMatch) { actionSignal = 'SHOW_QUIZ_ON_BOARD'; remainingText = remainingText.replace(showQuizMatch[0], "").trim(); }
            if (actionSignal && remainingText.length === 0) { return { boardMarkdown: "", ttsCommentary: "", chatText: "", actionSignal };}
			const boardMatch = remainingText.match(boardRegex); if (boardMatch) { boardMarkdown = (boardMatch[1] || boardMatch[2] || "").trim(); remainingText = remainingText.replace(boardMatch[0], "").trim(); if (boardMarkdown.toLowerCase().startsWith('markdown')) { const nl = boardMarkdown.indexOf('\n'); if (nl !== -1 && nl < 15) { boardMarkdown = boardMarkdown.substring(nl + 1).trim(); } else if (boardMarkdown.length < 15) { boardMarkdown = ""; }} }
			const ttsMatch = remainingText.match(ttsRegex); if (ttsMatch) { ttsCommentary = (ttsMatch[1] || ttsMatch[2] || "").trim(); remainingText = remainingText.replace(ttsMatch[0], "").trim(); }
			let chatText = remainingText.replace(/```(markdown)?\s*|\s*```/g, '').replace(/\[BOARD_MARKDOWN]:/gi, '').replace(/\[TTS_COMMENTARY]:/gi, '').replace(/\[ACTION:INITIATE_FINAL_QUIZ]/gi, '').replace(/\[ACTION:SHOW_QUIZ_ON_BOARD]/gi, '').trim();
            console.log("[ParseGemini v28] Result - Board:", !!boardMarkdown, "TTS:", !!ttsCommentary, "Chat:", !!chatText, "Action:", actionSignal);
			return { boardMarkdown, ttsCommentary, chatText, actionSignal };
		};

    	VyukaApp.processGeminiResponse = async (rawText, timestamp) => {
			const state = VyukaApp.state; VyukaApp.removeThinkingIndicator(); state.lastInteractionTime = Date.now();
			console.log("[ProcessGemini v28] Processing Raw Response:", rawText ? rawText.substring(0, 100) + "..." : "Empty");
			if (!rawText) { VyukaApp.handleGeminiError("AI vrátilo prázdnou odpověď.", timestamp); VyukaApp.manageButtonStates(); return; }

			const { boardMarkdown, ttsCommentary, chatText, actionSignal } = VyukaApp.parseGeminiResponse(rawText);
			let aiResponded = false; let cleanedChatText = "";
            if (typeof VyukaApp.cleanChatMessage === 'function') { cleanedChatText = VyukaApp.cleanChatMessage(chatText); } else { cleanedChatText = chatText.trim(); }
            console.log(`[ProcessGemini v28] Parsed-> Board: ${!!boardMarkdown}, TTS: ${!!ttsCommentary}, Chat: ${!!cleanedChatText}, Action: ${actionSignal}`);

            if (actionSignal === 'INITIATE_FINAL_QUIZ') { // AI navrhuje kvíz
                console.log("[ProcessGemini v28] AI offers final quiz."); aiResponded = true; state.finalQuizOffered = true; state.aiIsWaitingForAnswer = true;
                if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.style.display = 'none';
                VyukaApp.addChatMessage("Výborně! Zdá se, že toto téma už máš v malíku. Chceš si dát krátký závěrečný test na ověření znalostí?", 'gemini', true, new Date(), null, null, [{ title: "Ano, spustit test!", payload: "ACTION_USER_ACCEPTS_QUIZ" }, { title: "Ne, díky.", payload: "ACTION_USER_DECLINES_QUIZ" }]);
                VyukaApp.manageUIState('quizOffered'); return;
            } else if (actionSignal === 'SHOW_QUIZ_ON_BOARD') { // AI posílá obsah kvízu pro tabuli
                console.log("[ProcessGemini v28] AI provides quiz content for board."); aiResponded = true;
                if (boardMarkdown) { await VyukaApp.renderQuizOnBoard(boardMarkdown); state.aiIsWaitingForAnswer = false; } // Po zobrazení kvízu nečekáme na chat, ale na odevzdání
                else { VyukaApp.handleGeminiError("AI neposkytlo obsah finálního testu pro tabuli.", timestamp); }
                VyukaApp.manageUIState('finalQuizInProgress'); return;
            } else if (actionSignal === config.ACTION_EVALUATE_BOARD_QUIZ) { // AI posílá vyhodnocení kvízu z tabule
                console.log("[ProcessGemini v28] AI provides quiz evaluation for board."); aiResponded = true;
                state.finalQuizActive = false; state.aiIsWaitingForAnswer = false;
                if (boardMarkdown) { VyukaApp.appendToWhiteboard(boardMarkdown, ttsCommentary || "Výsledky testu jsou na tabuli."); }
                if (cleanedChatText) { VyukaApp.addChatMessage(cleanedChatText, 'gemini', true, timestamp, ttsCommentary); }
                VyukaApp.showToast("Test vyhodnocen!", "Výsledky najdete na tabuli.", "success");
                // Zde nabídneme dokončení tématu nebo pokračování
                VyukaApp.addChatMessage("Chceš toto téma označit za dokončené, nebo se k němu ještě vrátit?", 'gemini', false, new Date(), null, null, [ { title: "Označit za dokončené", payload: "ACTION_USER_MARKS_COMPLETE_AFTER_QUIZ"}, { title: "Pokračovat ve výkladu", payload: "ACTION_USER_CONTINUES_AFTER_QUIZ"} ]);
                state.aiIsWaitingForAnswer = true; // Čekáme na rozhodnutí uživatele
                VyukaApp.manageUIState('quizEvaluated'); return;
            }

            // Běžné zpracování odpovědi
            if (boardMarkdown) {
                VyukaApp.appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); aiResponded = true;
                const taskKeywords = ['úloha k řešení', 'vyřešte tento příklad', 'zodpovězte následující', 'úkol:', 'otázka k procvičení'];
                const taskHeaderRegex = /###\s*(úloha|příklad k řešení|úkol|otázka)/i;
                const zadaniEndsWithQuestion = /\*\*zadání:\*\*[\s\S]*\?$/i;
                if (taskKeywords.some(kw => boardMarkdown.toLowerCase().includes(kw)) || taskHeaderRegex.test(boardMarkdown) || zadaniEndsWithQuestion.test(boardMarkdown.replace(/\s+/g, ' '))) {
                    state.aiIsWaitingForAnswer = true;
                } else { state.aiIsWaitingForAnswer = false; }
            }
            if (cleanedChatText) {
                const ttsForChat = (!boardMarkdown && ttsCommentary) ? ttsCommentary : null;
                VyukaApp.addChatMessage(cleanedChatText, 'gemini', true, timestamp, ttsForChat, chatText); aiResponded = true;
                if (!state.aiIsWaitingForAnswer) { state.aiIsWaitingForAnswer = /[\?؟]\s*$/.test(cleanedChatText.trim()); }
            }
            if (!aiResponded) { if (ttsCommentary) { VyukaApp.addChatMessage(`(Komentář k tabuli: ${ttsCommentary})`, 'gemini', true, timestamp, ttsCommentary); } else { VyukaApp.addChatMessage("(AI neodpovědělo očekávaným formátem nebo odpověď byla prázdná)", 'gemini', false, timestamp); } state.aiIsWaitingForAnswer = false; }
            VyukaApp.manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
		};

        VyukaApp.requestFinalQuizContent = async () => {
            const state = VyukaApp.state;
            console.log("[RequestFinalQuizContent v28] Requesting quiz content for board.");
            VyukaApp.updateGeminiThinkingState(true);
            const prompt = VyukaApp._buildFinalQuizPromptForBoard();
            await VyukaApp.sendToGemini(prompt, false);
        };

        VyukaApp.renderQuizOnBoard = async (quizMarkdownWithPlaceholders) => {
            console.log("[RenderQuizOnBoard v28] Rendering quiz on whiteboard with input fields.");
            const ui = VyukaApp.ui; const state = VyukaApp.state;
            if (!ui.whiteboardContent || !ui.whiteboardContainer) return;
            state.quizQuestionsForBoard = []; ui.whiteboardContent.innerHTML = '';

            // Vylepšený regex, který lépe zachytí otázku a její případné možnosti
            const questionRegex = /###\s*(Otázka\s*\d+)\s*\((Lehká|Středně těžká|Těžká)\)\s*-\s*Typ:\s*(.*?)\n([\s\S]*?)(?=(?:###\s*Otázka\s*\d+|$))/gi;
            let match; let questionIndex = 0;

            while ((match = questionRegex.exec(quizMarkdownWithPlaceholders)) !== null) {
                questionIndex++;
                const fullQuestionTitle = match[1]; // "Otázka X"
                const difficulty = match[2];
                const questionType = match[3].trim();
                let questionTextWithOptions = match[4].trim();

                // Odstraníme placeholder, pokud tam AI nějaký dalo, my si ho přidáme sami
                questionTextWithOptions = questionTextWithOptions.replace(/Vaše odpověď:\s*\[ODPOVĚĎ ZDE\]/gi, '').trim();
                questionTextWithOptions = questionTextWithOptions.replace(/Vaše volba \(A\/B\/C\):\s*\[ODPOVĚĎ ZDE\]/gi, '').trim();


                state.quizQuestionsForBoard.push({
                    id: questionIndex,
                    title: fullQuestionTitle,
                    difficulty: difficulty,
                    type: questionType,
                    textWithOptions: questionTextWithOptions, // Uložíme si původní text otázky s možnostmi
                    userAnswer: ''
                });

                const chunkDiv = document.createElement('div');
                chunkDiv.className = 'whiteboard-chunk quiz-question-item card'; // Přidána třída card pro lepší vzhled
                chunkDiv.id = `quiz-q-${questionIndex}`;

                const contentDiv = document.createElement('div');
                contentDiv.style.padding = "1rem"; // Vnitřní padding pro kartu otázky

                // Zobrazíme titul otázky
                const titleEl = document.createElement('h3');
                titleEl.innerHTML = `<i class="fas fa-question-circle" style="color:var(--vyuka-accent-secondary); margin-right:0.5em;"></i> ${fullQuestionTitle} <span class="quiz-difficulty-badge ${difficulty.toLowerCase().replace(/\s+/g, '-')}">${difficulty}</span> <span class="quiz-type-badge">${questionType}</span>`;
                contentDiv.appendChild(titleEl);

                // Zobrazíme text otázky a možnosti (už by měly být v markdownu)
                const questionTextDiv = document.createElement('div');
                VyukaApp.renderMarkdown(questionTextDiv, questionTextWithOptions, false);
                contentDiv.appendChild(questionTextDiv);

                const answerLabel = document.createElement('label');
                answerLabel.htmlFor = `quiz-answer-${questionIndex}`;
                answerLabel.textContent = "Vaše odpověď:";
                answerLabel.className = 'quiz-answer-label'; // Pro styling
                contentDiv.appendChild(answerLabel);

                let answerInput;
                if (questionType.toLowerCase() === 'multiple_choice') {
                    answerInput = document.createElement('select');
                    answerInput.className = 'quiz-answer-input form-control';
                    answerInput.dataset.questionId = questionIndex;
                    answerInput.id = `quiz-answer-${questionIndex}`;
                    // Zkusíme extrahovat možnosti, pokud jsou ve formátu A) ... B) ...
                    const optionRegex = /^[A-Z]\)\s*(.*)/gm;
                    let optMatch;
                    const defaultOption = document.createElement('option');
                    defaultOption.value = "";
                    defaultOption.textContent = "Vyberte možnost...";
                    answerInput.appendChild(defaultOption);
                    while((optMatch = optionRegex.exec(questionTextWithOptions)) !== null) {
                        const optionLetter = optMatch[0].charAt(0);
                        const optionTextPreview = optMatch[1].trim().substring(0,30) + (optMatch[1].trim().length > 30 ? "..." : "");
                        const optionEl = document.createElement('option');
                        optionEl.value = optionLetter;
                        optionEl.textContent = `${optionLetter}) ${optionTextPreview}`;
                        answerInput.appendChild(optionEl);
                    }
                    // Pokud regex nenašel možnosti, přidáme fallback pro ruční zadání
                    if (answerInput.options.length <= 1) {
                        answerInput = document.createElement('input');
                        answerInput.type = 'text';
                        answerInput.className = 'quiz-answer-input form-control';
                        answerInput.dataset.questionId = questionIndex;
                        answerInput.id = `quiz-answer-${questionIndex}`;
                        answerInput.placeholder = 'Napište písmeno odpovědi (A, B, C)...';
                    }

                } else {
                    answerInput = document.createElement('textarea');
                    answerInput.className = 'quiz-answer-input form-control';
                    answerInput.dataset.questionId = questionIndex;
                    answerInput.id = `quiz-answer-${questionIndex}`;
                    answerInput.placeholder = 'Napište svou odpověď zde...';
                    answerInput.rows = 2;
                }
                contentDiv.appendChild(answerInput);
                chunkDiv.appendChild(contentDiv);
                ui.whiteboardContent.appendChild(chunkDiv);
            }

            if (questionIndex === 0 && boardMarkdown) {
                VyukaApp.appendToWhiteboard(boardMarkdown, "Závěrečný test (chyba formátování otázek).");
                 VyukaApp.showToast("Chyba formátu testu", "AI neposkytlo test ve správném formátu pro interaktivní zobrazení.", "warning");
            }

            // Přidání tlačítka pro odevzdání testu, pokud existují otázky
            if (questionIndex > 0) {
                const existingSubmitBtn = document.getElementById('submit-quiz-btn');
                if (existingSubmitBtn) existingSubmitBtn.remove();

                const submitButton = document.createElement('button');
                submitButton.id = 'submit-quiz-btn';
                submitButton.className = 'btn btn-primary btn-lg';
                submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Odevzdat a Zkontrolovat Test';
                submitButton.style.marginTop = "1.5rem";
                submitButton.style.display = "block";
                submitButton.style.marginLeft = "auto";
                submitButton.style.marginRight = "auto";
                submitButton.addEventListener('click', VyukaApp.handleSubmitQuiz);
                ui.whiteboardContent.appendChild(submitButton); // Přidáme na konec tabule

                if (ui.continueBtn) ui.continueBtn.style.display = 'none';
                if (ui.clearBoardBtn) ui.clearBoardBtn.style.display = 'none';
                if (ui.stopSpeechBtn) ui.stopSpeechBtn.style.display = 'none';
            }


            if (typeof VyukaApp.triggerWhiteboardMathJax === 'function') VyukaApp.triggerWhiteboardMathJax();
            if (ui.whiteboardContainer) ui.whiteboardContainer.scrollTop = 0;
            console.log("[RenderQuizOnBoard v28] Quiz rendered with input fields.");
        };

        VyukaApp.handleSubmitQuiz = async () => {
            const state = VyukaApp.state;
            console.log("[SubmitQuiz v28] Submitting quiz answers.");
            state.quizQuestionsForBoard.forEach(q => {
                const inputElement = document.getElementById(`quiz-answer-${q.id}`);
                if (inputElement) { q.userAnswer = inputElement.value.trim(); }
            });
            VyukaApp.updateGeminiThinkingState(true);
            const prompt = VyukaApp._buildQuizEvaluationPrompt(state.quizQuestionsForBoard);
            await VyukaApp.sendToGemini(prompt, false);
            state.finalQuizActive = false; state.aiIsWaitingForAnswer = false;
            const submitBtn = document.getElementById('submit-quiz-btn');
            if (submitBtn) submitBtn.remove();
            if (VyukaApp.ui.vyukaLessonControls) VyukaApp.ui.vyukaLessonControls.style.justifyContent = 'flex-end';
            VyukaApp.manageUIState('quizEvaluating');
        };

        // --- PROMPTS ---
        VyukaApp._buildInitialPrompt = () => {
            const state = VyukaApp.state; const config = VyukaApp.config; const level = state.currentProfile?.skill_level || 'středně pokročilá'; const topicName = state.currentTopic?.name || 'Neznámé téma';
            return `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. Tvé vysvětlení musí být strukturované, přesné a profesionální. Téma lekce: "${topicName}". Cílová úroveň studenta: "${level}".
HLAVNÍ PRAVIDLA (NAPROSTO VŽDY DODRŽUJ!):
1.  **[BOARD_MARKDOWN]:** Veškerý výukový obsah (definice, věty, vzorce, **MINIMÁLNĚ DVA ŘEŠENÉ PŘÍKLADY**, úlohy k řešení, obsah finálního testu) patří VÝHRADNĚ sem. Formátuj pomocí Markdown a $$...$$ pro matematiku. Řešené příklady musí vždy PŘEDCHÁZET úlohám k řešení.
2.  **[TTS_COMMENTARY]:** Použij POUZE pro DOPLŇUJÍCÍ hlasový komentář k obsahu na tabuli. NEOPAKUJ doslova text z tabule.
3.  **Chat (Text mimo značky):** VYUŽÍVEJ MINIMÁLNĚ. NIKDY v chatu NEUVÁDĚJ nový výukový obsah (definice, příklady, úlohy). Použij chat POUZE pro HODNOCENÍ odpovědi studenta na úlohu NEBO pro VELMI krátkou PŘÍMOU odpověď na jeho otázku (pokud se nejedná o nové vysvětlení, které patří na tabuli), nebo pro nabídku finálního testu. NEPIŠ uvítací/ukončovací fráze.
4.  **Struktura a Náročnost:** Postupuj logicky od základů, postupně zvyšuj náročnost příkladů a úloh k úrovni přijímacích zkoušek. **VŽDY uveď VÍCE řešených příkladů PŘED zadáním úlohy studentovi.** Používej RŮZNÉ typy úloh.
5.  **Interakce se studentem:**
    * Po zadání ÚLOHY K ŘEŠENÍ v [BOARD_MARKDOWN], v [TTS_COMMENTARY] **JASNĚ** řekni, že očekáváš odpověď studenta v chatu. Nic víc. Systém deaktivuje tlačítko "Pokračovat".
    * Po vysvětlení teorie nebo řešeného příkladu (pokud student nepoložil otázku) **ABSOLUTNĚ NEČEKEJ na odpověď** a **STRIKTNĚ ZAKÁZÁNO ptát se "Je to jasné?", "Rozumíš?", "Pokračujeme?".** Student sám klikne na tlačítko "Pokračovat".
6.  **Fokus na Téma:** **STRIKTNĚ se drž tématu lekce: "${topicName}".** Nevysvětluj nesouvisející pokročilé koncepty, pokud nejsou PŘÍMOU součástí tohoto konkrétního tématu pro 9. třídu.
7.  **Navržení Dokončení Tématu (Nabídka Testu):** Pokud usoudíš, že téma bylo dostatečně probráno (student odpovídá správně, byly probrány klíčové koncepty a typy příkladů), **místo dalšího obsahu nebo otázky**, pošli **POUZE signál ${config.ACTION_INITIATE_FINAL_QUIZ}**. NIC JINÉHO. Systém pak studentovi nabídne test v chatu.
8.  **Generování Finálního Testu na Tabuli:** POKUD obdržíš explicitní požadavek **OBSAHUJÍCÍ frázi 'POŽADAVEK NA FINÁLNÍ TEST NA TABULI'**, vygeneruj 10 otázek (3 lehké, 2 střední, 5 těžkých) k tématu "${topicName}" POUZE do [BOARD_MARKDOWN]. Každá otázka musí mít jasně označené místo pro odpověď studenta, např. \`Vaše odpověď: [ODPOVĚĎ ZDE]\`. NEUVÁDĚJ správné odpovědi. Po vygenerování otázek vrať **POUZE signál ${config.ACTION_SHOW_QUIZ_ON_BOARD}** a NIC JINÉHO. NIKDY negeneruj obsah finálního testu sám od sebe bez tohoto explicitního promptu.
9.  **Vyhodnocení Finálního Testu z Tabule:** Pokud obdržíš prompt **OBSAHUJÍCÍ frázi 'VYHODNOCENÍ FINÁLNÍHO TESTU Z TABULE'** a seznam otázek s odpověďmi studenta, vyhodnoť KAŽDOU odpověď. Poskytni celkové skóre a stručnou zpětnou vazbu. Vše formátuj POUZE pro [BOARD_MARKDOWN]. Do [TTS_COMMENTARY] dej jen krátké shrnutí celkového výsledku. Do CHATU nic nepiš. Odpověď ukonči signálem ${config.ACTION_EVALUATE_BOARD_QUIZ}.
10. **Reflektivní Otázky (Mentor Mode):** Po vysvětlení konceptu nebo ukázkového příkladu na tabuli [BOARD_MARKDOWN] můžeš (ale nemusíš) do [TTS_COMMENTARY] nebo krátce do CHATU (pokud je to velmi krátké a přirozené) přidat otázku k zamyšlení pro studenta (např. "Jak bys to vysvětlil/a vlastními slovy?"). Pro tyto reflektivní otázky **NEPOUŽÍVEJ** v [TTS_COMMENTARY] frázi "čekám na odpověď".
PRVNÍ KROK: Začni se ZÁKLADNÍ DEFINICÍ tématu "${topicName}". Poskytni **alespoň JEDEN ŘEŠENÝ PŘÍKLAD** (jednoduchý). VŠE DEJ DO [BOARD_MARKDOWN]:. Přidej krátký [TTS_COMMENTARY]:. NEPIŠ nic do chatu.
POŽADOVANÝ FORMÁT ODPOVĚDI (pro první krok):
[BOARD_MARKDOWN]:
\`\`\`markdown
## ${topicName} - Základy
### [Krátký, výstižný podnadpis]
(Definice/úvodní koncept. **Tučně** termíny, $$...$$ matematika.)
### První řešený příklad (Základní)
**Zadání:** ...
**Řešení:** ...
\`\`\`
[TTS_COMMENTARY]: (Stručné představení tématu a shrnutí obsahu tabule. NEPOKLÁDEJ OTÁZKU.)`;
        };

    	VyukaApp._buildContinuePrompt = () => { /* Zůstává stejné jako v27 */
            const state = VyukaApp.state; const config = VyukaApp.config; const level = state.currentProfile?.skill_level || 'středně pokročilá'; const topicName = state.currentTopic?.name || 'Neznámé téma';
			return `Pokračuj ve výkladu tématu "${topicName}" pro studenta úrovně "${level}" (příprava na přijímačky 9. třídy). Naváž logicky na PŘEDCHOZÍ OBSAH NA TABULI.
HLAVNÍ PRAVIDLA (PŘIPOMENUTÍ!):
* Nové informace, **VÍCE ŘEŠENÝCH PŘÍKLADŮ**, ÚLOHY K ŘEŠENÍ patří VÝHRADNĚ do [BOARD_MARKDOWN].
* [TTS_COMMENTARY]: POUZE DOPLNĚNÍ. Chat (mimo značky): NE nový obsah.
* STRIKTNĚ se drž tématu "${topicName}". Zvyšuj náročnost. **Vždy ŘEŠENÉ příklady PŘED úlohou.**
* Po ÚLOZE v [BOARD_MARKDOWN], v [TTS_COMMENTARY] **JASNĚ řekni, že čekáš odpověď** v chatu.
* Po teorii/řešeném příkladu **NEČEKEJ** a **NEPOKLÁDEJ otázky**.
* **Reflektivní Otázky:** Můžeš přidat. Pro ně NEPOUŽÍVEJ v TTS "čekám na odpověď".
* Pokud je téma probráno -> pošli **POUZE signál ${config.ACTION_INITIATE_FINAL_QUIZ}**.
DALŠÍ KROK: Vyber JEDEN (nebo ${config.ACTION_INITIATE_FINAL_QUIZ}): A) Teorie, B) Řešené příklady, C) Úloha k řešení.
POŽADOVANÝ FORMÁT ODPOVĚDI (Pokud NEPOSÍLÁŠ ${config.ACTION_INITIATE_FINAL_QUIZ}):
[BOARD_MARKDOWN]:
\`\`\`markdown
### [Nadpis]
(Obsah...)
\`\`\`
[TTS_COMMENTARY]: (Komentář. Pokud ÚLOHA, řekni: "Nyní zkuste tuto úlohu vyřešit vy a napište mi výsledek/postup do chatu." Jinak stručně shrň.)`;
		};

        VyukaApp._buildFinalQuizPromptForBoard = () => { // Upraveno pro generování na tabuli
            const state = VyukaApp.state; const config = VyukaApp.config;
            const topicName = state.currentTopic?.name || 'Neznámé téma';
            return `Toto je POŽADAVEK NA FINÁLNÍ TEST NA TABULI.
Vygeneruj finální test k tématu "${topicName}" (10 otázek: 3 lehké, 2 střední, 5 těžkých).
Každá otázka MUSÍ být ve formátu, který umožní studentovi odpovědět přímo na tabuli.
Formátuj POUZE pro [BOARD_MARKDOWN].
Pro každou otázku uveď text otázky. Místo správné odpovědi uveď placeholder \`[ODPOVĚĎ ZDE]\`.
Začni s nadpisem "## Závěrečný Test na Tabuli: ${topicName}".
Po vygenerování otázek vrať POUZE signál ${config.ACTION_SHOW_QUIZ_ON_BOARD} a NIC JINÉHO.

Příklad struktury otázky v Markdownu:
### Otázka 1 (Lehká) - Typ: numeric
Řešte rovnici: $x + 5 = 12$.
Vaše odpověď: [ODPOVĚĎ ZDE]

### Otázka 2 (Lehká) - Typ: multiple_choice
Která z následujících možností je správná?
A) Možnost A
B) Možnost B
C) Možnost C
Vaše volba (A/B/C): [ODPOVĚĎ ZDE]

Po vypsání všech 10 otázek v tomto formátu ukonči odpověď POUZE signálem:
${config.ACTION_SHOW_QUIZ_ON_BOARD}
`;
        };

        VyukaApp._buildQuizEvaluationPrompt = (answeredQuestions) => { // Nový prompt pro vyhodnocení
            const state = VyukaApp.state; const config = VyukaApp.config;
            const topicName = state.currentTopic?.name || 'Neznámé téma';
            let questionsAndAnswersString = "Seznam otázek a odpovědí studenta:\n";
            answeredQuestions.forEach(q => {
                questionsAndAnswersString += `Otázka ${q.id} (${q.difficulty}, Typ: ${q.type}):\n${q.textWithOptions}\nStudentova odpověď: ${q.userAnswer || "(nezodpovězeno)"}\n---\n`;
            });

            return `Toto je POŽADAVEK NA VYHODNOCENÍ FINÁLNÍHO TESTU Z TABULE k tématu "${topicName}".
${questionsAndAnswersString}
TVŮJ ÚKOL:
1.  Pečlivě vyhodnoť KAŽDOU odpověď studenta. Uveď, zda je správná, nesprávná, nebo částečně správná.
2.  Ke KAŽDÉ otázce poskytni SPRÁVNOU odpověď nebo stručný postup řešení.
3.  Pokud byla odpověď studenta nesprávná nebo neúplná, napiš KRÁTKÝ komentář, kde udělal chybu.
4.  Na konci vypočítej CELKOVÉ SKÓRE (např. X z 10 správně) a napiš stručnou celkovou zpětnou vazbu k výkonu studenta.
5.  Všechny tyto informace (vyhodnocení každé otázky, správné odpovědi, komentáře k chybám, celkové skóre, závěrečná zpětná vazba) formátuj VÝHRADNĚ pro [BOARD_MARKDOWN]. Začni s nadpisem "## Výsledky Závěrečného Testu: ${topicName}".
6.  Do [TTS_COMMENTARY] dej jen VELMI krátké shrnutí celkového výsledku (např. "Test dokončen, výsledky jsou na tabuli. Celkově jsi získal X bodů z Y.") a informaci, že student může téma dokončit.
7.  Nic nepiš do CHATU.
8.  Na úplný konec celé tvé odpovědi přidej signál ${config.ACTION_EVALUATE_BOARD_QUIZ}.
`;
        };


    	VyukaApp._buildChatInteractionPrompt = (userText) => {
			const state = VyukaApp.state; const config = VyukaApp.config; const topicName = state.currentTopic?.name || 'Neznámé téma'; let baseInstruction;
            const isNevim = /\b(nevím|neviem|netuším|pomoc|nevim|nechapu|nerozumim|help|co s tim)\b/i.test(userText.toLowerCase());
            const isSimplerExplanationRequest = /\b(nerozumím|vysvětli jednodušeji|moc složité|полегче|jednodušeji|explain simpler|explain it simpler|i don't understand|too complicated)\b/i.test(userText.toLowerCase());
            const isSpecificQuestionAboutBoard = /\b(proč|jak|k čemu|co znamená|what does|why is|how did you get)\b/i.test(userText.toLowerCase()) && /\b(tabuli|tam|vzorec|krok|číslo|board|formula|step|number)\b/i.test(userText.toLowerCase());

            if (state.finalQuizActive) { baseInstruction = `Student je uprostřed finálního testu na tabuli a napsal do chatu: "${userText}". Řekni studentovi, že má odpovědi vyplňovat na tabuli a poté test odevzdat. NEPOKLÁDEJ ŽÁDNÉ OTÁZKY.`;
            } else if (state.finalQuizOffered) { baseInstruction = `AI nabídlo studentovi finální test. Student odpověděl: "${userText}". Pokud student souhlasí (např. "ano", "ok", "spustit"), nepiš nic do chatu, systém to zpracuje. Pokud odmítá nebo se ptá na něco jiného, odpověz krátce. NEPOKLÁDEJ DALŠÍ OTÁZKU.`;
            } else if (state.aiIsWaitingForAnswer) {
                if (isNevim) { baseInstruction = `Student odpověděl 'Nevím' na úlohu k tématu "${topicName}". Ukaž ŘEŠENÍ a VYSVĚTLENÍ úlohy na [BOARD_MARKDOWN]. Do [TTS_COMMENTARY] stručně shrň řešení. Do CHATU NAPIŠ POUZE: 'Řešení je na tabuli.' NEPOKLÁDEJ ŽÁDNOU DALŠÍ OTÁZKU.`;
                } else { baseInstruction = `Student poskytl odpověď na úlohu k tématu "${topicName}": "${userText}". ZCELA KONKRÉTNĚ vyhodnoť správnost odpovědi POUZE v CHATU. Pokud nesprávná, vysvětli chybu a uveď správný postup/výsledek. Pokud správná, krátce pochval. Odpověď v chatu NESMÍ obsahovat nový obsah. NAPROSTO NEPOKLÁDEJ ŽÁDNÉ DALŠÍ OTÁZKY. UKONČI svou odpověď.`; }
			} else {
                if (isSimplerExplanationRequest) { baseInstruction = `Student žádá o jednodušší vysvětlení ("${userText}"). Poskytni ZJEDNODUŠENÉ vysvětlení na [BOARD_MARKDOWN]. Do [TTS_COMMENTARY] stručně shrň. Do CHATU napiš POUZE: 'Dobře, zkusím to vysvětlit jednodušeji na tabuli.' NIC VÍC.`;
                } else if (isSpecificQuestionAboutBoard) { baseInstruction = `Student má otázku k OBSAHU NA TABULI: "${userText}". Odpověz. Pokud je odpověď delší, dej ji na [BOARD_MARKDOWN]. V [TTS_COMMENTARY] stručně shrň. Do CHATU napiš POUZE: 'Odpověď/Upřesnění je na tabuli.' NEBO (pokud velmi krátká odpověď) 'Krátká odpověď: [tvá krátká odpověď].' NIC VÍC.`;
                } else { baseInstruction = `Student položil otázku/komentář k tématu "${topicName}": "${userText}". Odpověz stručně a PŘÍMO k dotazu POUZE v CHATU. NEVYSVÊTLUJ novou látku. Pokud mimo téma, vrať zpět. NEPOKLÁDEJ otázky "Stačí takto?". IHNED SKONČI.`;}
			}
			return `${baseInstruction}\nPŘIPOMENUTÍ PRAVIDEL CHATU: Odpovídej POUZE běžným textem do chatu. Nepoužívej [BOARD_MARKDOWN] ani [TTS_COMMENTARY], pokud to není explicitně řečeno v ÚKOLU výše. Buď stručný a věcný.`;
		};

        VyukaApp._buildGeminiPayloadContents = (userPrompt, isChatInteraction = false) => { /* Zůstává stejné jako v27 */
			const state = VyukaApp.state; const config = VyukaApp.config; const topicName = state.currentTopic?.name || 'Neznámé téma';
            const systemInstruction = `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. NAPROSTO VŽDY dodržuj tato pravidla:
1.  **[BOARD_MARKDOWN]:** Veškerý výukový obsah (definice, vzorce, vysvětlení, **VÍCE ŘEŠENÝCH PŘÍKLADŮ**, úlohy k řešení, obsah finálního testu, vyhodnocení testu) patří VÝHRADNĚ sem: \`\`\`markdown ... \`\`\`.
2.  **[TTS_COMMENTARY]:** Použij POUZE pro DOPLNĚNÍ k tabuli.
3.  **Chat (Text mimo značky):** MINIMÁLNĚ. POUZE pro hodnocení odpovědi studenta NEBO VELMI krátkou PŘÍMOU odpověď na jeho otázku, nebo pro nabídku finálního testu. NIKDY nový výukový obsah.
4.  **Struktura a Náročnost:** Logicky, zvyšuj náročnost. **Vždy VÍCE řešených příkladů PŘED úlohou.**
5.  **Interakce:** Po ÚLOZE v [BOARD_MARKDOWN], v [TTS_COMMENTARY] **JASNĚ řekni, že čekáš odpověď** v chatu. Po teorii/řešeném příkladu **NEČEKEJ** a **NEPOKLÁDEJ otázky**.
6.  **Fokus na Téma:** STRIKTNĚ se drž tématu "${topicName}".
7.  **Odpovědi v chatu:** Pokud student ODPOVÍDÁ na úlohu nebo POKLÁDÁ OTÁZKU, odpovídej POUZE textem do CHATU podle instrukcí v uživatelském promptu. Po správné odpovědi studenta JEN potvrď a UKONČI odpověď. **Když odpovídáš na otázku studenta, odpověz PŘÍMO a ihned SKONČI.**
8.  **Reflektivní Otázky:** Můžeš přidat. Pro ně NEPOUŽÍVEJ v TTS "čekám na odpověď".
9.  **Navržení Dokončení Tématu:** Když je téma probráno, pošli **POUZE signál ${config.ACTION_INITIATE_FINAL_QUIZ}**.
10. **Finální Test na Tabuli:** POKUD obdržíš prompt **OBSAHUJÍCÍ frázi 'POŽADAVEK NA FINÁLNÍ TEST NA TABULI'**, vygeneruj 10 otázek (3L, 2S, 5T) K TÉMATU ("${topicName}") do [BOARD_MARKDOWN] s placeholderem \`[ODPOVĚĎ ZDE]\`. Po vygenerování otázek vrať POUZE signál ${config.ACTION_SHOW_QUIZ_ON_BOARD}.
11. **Vyhodnocení Finálního Testu z Tabule:** Pokud obdržíš prompt **OBSAHUJÍCÍ frázi 'VYHODNOCENÍ FINÁLNÍHO TESTU Z TABULE'** a seznam otázek s odpověďmi, vyhodnoť KAŽDOU odpověď. Poskytni celkové skóre a zpětnou vazbu do [BOARD_MARKDOWN]. Do [TTS_COMMENTARY] dej krátké shrnutí. Nic do CHATU. Odpověď ukonči signálem ${config.ACTION_EVALUATE_BOARD_QUIZ}.`;
            const modelConfirmation = `Rozumím. Dodržím pravidla. Obsah na [BOARD_MARKDOWN]. Komentář [TTS_COMMENTARY]. Chat minimálně. Držím se tématu "${topicName}". Navrhnu test signálem ${config.ACTION_INITIATE_FINAL_QUIZ}. Pokud dostanu "POŽADAVEK NA FINÁLNÍ TEST NA TABULI", vygeneruji otázky a pošlu ${config.ACTION_SHOW_QUIZ_ON_BOARD}. Pokud "VYHODNOCENÍ FINÁLNÍHO TESTU Z TABULE", vyhodnotím a pošlu ${config.ACTION_EVALUATE_BOARD_QUIZ}.`;
			const history = state.geminiChatContext.slice(-config.MAX_GEMINI_HISTORY_TURNS * 2); const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };
			return [{ role: "user", parts: [{ text: systemInstruction }] }, { role: "model", parts: [{ text: modelConfirmation }] }, ...history, currentUserMessage];
		};

    	VyukaApp.sendToGemini = async (prompt, isChatInteraction = false) => { /* Zůstává stejné jako v27 */
			const config = VyukaApp.config; const state = VyukaApp.state;
			if (!config.GEMINI_API_KEY || !config.GEMINI_API_KEY.startsWith('AIzaSy')) { VyukaApp.showToast("Chyba Konfigurace", "Chybí API klíč pro AI.", "error"); VyukaApp.updateGeminiThinkingState(false); return; }
            if (!state.currentTopic && !state.finalQuizActive && !state.finalQuizOffered ) { VyukaApp.showToast("Chyba", "Není vybráno téma nebo aktivní kvíz.", "error"); VyukaApp.updateGeminiThinkingState(false); return; }
			if (!navigator.onLine) { VyukaApp.showToast("Offline", "Nelze komunikovat s AI bez připojení.", "warning"); VyukaApp.updateGeminiThinkingState(false); return; }
			console.log(`Sending to Gemini (Chat: ${isChatInteraction}): "${prompt.substring(0, 120)}..."`);
			const timestamp = new Date(); VyukaApp.updateGeminiThinkingState(true);
			const contents = VyukaApp._buildGeminiPayloadContents(prompt, isChatInteraction);
			const body = { contents, generationConfig: { temperature: (state.finalQuizActive ? 0.3 : 0.55), topP: 0.95, topK: 40, maxOutputTokens: 8192, }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ] };
			try {
				const response = await fetch(config.GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
				if (!response.ok) { let errorText = `Chyba API (${response.status})`; try { const errData = await response.json(); errorText += `: ${errData?.error?.message || 'Neznámá chyba'}`; } catch (e) { errorText += `: ${await response.text()}`; } throw new Error(errorText); }
				const data = await response.json();
				if (data.promptFeedback?.blockReason) { throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}.`); }
				const candidate = data.candidates?.[0]; if (!candidate) { throw new Error('AI neposkytlo platnou odpověď (no candidate).'); }
                if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) { if (candidate.finishReason === 'SAFETY') throw new Error('Odpověď blokována bezpečnostním filtrem AI.'); if (!candidate.content?.parts?.[0]?.text) { throw new Error(`Generování zastaveno: ${candidate.finishReason}.`);}}
				const text = candidate.content?.parts?.[0]?.text;
                if (!text && candidate.finishReason !== 'STOP') { if (candidate.finishReason === 'MAX_TOKENS') { throw new Error('Odpověď AI byla příliš dlouhá (Max Tokens).'); } else { throw new Error('AI vrátilo prázdnou odpověď (Důvod: '+(candidate.finishReason || 'Neznámý')+').');}}
				state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] }); state.geminiChatContext.push({ role: "model", parts: [{ text: text || "" }] });
				if (state.geminiChatContext.length > config.MAX_GEMINI_HISTORY_TURNS * 2 + 2) { state.geminiChatContext.splice(2, state.geminiChatContext.length - (config.MAX_GEMINI_HISTORY_TURNS * 2 + 2)); }
				await VyukaApp.processGeminiResponse(text || "", timestamp);
			} catch (error) { console.error('Chyba komunikace s Gemini:', error); VyukaApp.showToast(`Chyba AI: ${error.message}`, "error"); VyukaApp.handleGeminiError(error.message, timestamp);
			} finally { VyukaApp.updateGeminiThinkingState(false); VyukaApp.manageButtonStates(); }
		};

    	VyukaApp.handleGeminiError = (msg, time) => { /* Zůstává stejné jako v27 */
			const state = VyukaApp.state; VyukaApp.removeThinkingIndicator(); VyukaApp.addChatMessage(`Nastala chyba při komunikaci s AI: ${msg}`, 'gemini', false, time, null, `(Chyba: ${msg})`);
            state.aiIsWaitingForAnswer = false; state.finalQuizActive = false; state.finalQuizOffered = false;
            VyukaApp.manageUIState('learning');
		};

	} catch (e) {
		console.error("FATAL SCRIPT ERROR (AI Interaction v28):", e);
		document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--vyuka-accent-error,#FF4757);color:var(--vyuka-text-primary,#E0E7FF);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky (AI Interaction).</p><p style="margin-top:15px;"><a href="#" onclick="location.reload()" style="color:var(--vyuka-accent-secondary,#00F5FF); text-decoration:underline; font-weight:bold;">Obnovit stránku</a></p><details style="margin-top:20px;color:#f0f0f0;"><summary style="cursor:pointer;color:var(--vyuka-text-primary,#E0E7FF);">Detaily</summary><pre style="margin-top:10px;padding:15px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;max-height:300px;overflow-y:auto;border-radius:8px;">${e.message}\n${e.stack}</pre></details></div>`;
	}
})(window.VyukaApp);