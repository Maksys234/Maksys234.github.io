// Файл: procvicovani/vyuka/vyuka-ai-interaction.js
// Логика взаимодействия с AI Gemini, управление чатом, учебной сессией, парсинг ответов AI
// Версия v28: Oprava "Nevím", nový koncept finálního testu na tabuli s potvrzením.
// Версия v29 (Revolutionary Platform Update 1): Přidány nové bloky pro strukturovanější odpovědi AI: [KEY_CONCEPTS], [DETAILED_EXPLANATION], [EXAMPLES]
// Версия v29.2 (Revolutionary Platform Update 3): Oprava logiky processGeminiResponse, aby se zabránilo duplicitnímu výpisu TTS do chatu.

window.VyukaApp = window.VyukaApp || {};

(function(VyukaApp) {
	'use strict';

	try {
		const config = VyukaApp.config = VyukaApp.config || {};
		config.GEMINI_API_KEY = config.GEMINI_API_KEY || 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // Store securely
		config.GEMINI_API_URL = config.GEMINI_API_URL || `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;
		config.MAX_GEMINI_HISTORY_TURNS = config.MAX_GEMINI_HISTORY_TURNS || 12;
        config.ACTION_INITIATE_FINAL_QUIZ = "[ACTION:INITIATE_FINAL_QUIZ]";
        config.ACTION_SHOW_QUIZ_ON_BOARD = "[ACTION:SHOW_QUIZ_ON_BOARD]";
        config.ACTION_EVALUATE_BOARD_QUIZ = "[ACTION:EVALUATE_BOARD_QUIZ]";

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
					.order('created_at', { ascending: false })
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
                    let subject = 'Matematika';

					if (activity.topic_id) {
						try {
							const { data: topic, error: topicError } = await state.supabase
								.from('exam_topics')
								.select('name, description, subject')
								.eq('id', activity.topic_id)
								.single();
							if (topicError && topicError.code !== 'PGRST116') throw topicError;
							if (topic) {
								name = topic.name || name;
								desc = topic.description || desc;
                                subject = topic.subject || subject;
							}
						} catch(e) {
							console.warn("Could not fetch topic details for activity:", e);
						}
					}

					state.currentTopic = {
						activity_id: activity.id,
						plan_id: state.currentPlanId,
						name: name,
                        subject: subject,
						description: desc,
						user_id: state.currentUser.id,
						topic_id: activity.topic_id
					};

					if (ui.currentTopicDisplay) {
						ui.currentTopicDisplay.innerHTML = `Téma: <strong>${VyukaApp.sanitizeHTML(name)}</strong>`;
					}
                    if (ui.vyukaSubjectTitle) ui.vyukaSubjectTitle.textContent = VyukaApp.sanitizeHTML(subject);
                    if (ui.vyukaTopicSubtitle) ui.vyukaTopicSubtitle.textContent = VyukaApp.sanitizeHTML(name);

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

		VyukaApp.handleMarkTopicComplete = async (fromQuiz = false) => {
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
                if (fromQuiz) {
                    pointsToAward += (config.POINTS_QUIZ_COMPLETION_BONUS || 10);
                }

                if (typeof VyukaApp.awardPoints === 'function') {
				    await VyukaApp.awardPoints(pointsToAward);
                } else { console.error("Error: VyukaApp.awardPoints not defined."); }

				if (typeof VyukaApp.checkAndAwardAchievements === 'function') {
					await VyukaApp.checkAndAwardAchievements(state.currentUser.id);
				}

				VyukaApp.showToast(`Téma "${state.currentTopic.name}" úspěšně dokončeno! ${fromQuiz ? '(Test splněn)' : ''} Přesměrovávám...`, "success", 3000);
				setTimeout(() => { window.location.href = '/dashboard/procvicovani/main.html'; }, fromQuiz ? 1000 : 500);
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
			if (typeof VyukaApp.clearInitialChatState === 'function') VyukaApp.clearInitialChatState();
			VyukaApp.manageUIState('requestingExplanation');
            if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.disabled = true;
			const prompt = VyukaApp._buildInitialPrompt();
			await VyukaApp.sendToGemini(prompt);
		};

    	VyukaApp.requestContinue = async () => {
			const state = VyukaApp.state;
			console.log("[RequestContinue v29.2] Triggered. AI Waiting:", state.aiIsWaitingForAnswer, "FinalQuizOffered:", state.finalQuizOffered, "Final Quiz Active:", state.finalQuizActive);

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
			if (typeof VyukaApp.clearInitialChatState === 'function') VyukaApp.clearInitialChatState(); const id = `msg-${Date.now()}`; let avatarContent;
            if (sender === 'user') { avatarContent = VyukaApp.getInitials(state.currentProfile, state.currentUser?.email); if (state.currentProfile?.avatar_url) { let avatarUrl = state.currentProfile.avatar_url; if (!avatarUrl.startsWith('http') && avatarUrl.includes('/')) {} else { avatarUrl += (avatarUrl.includes('?') ? '&' : '?') + `t=${new Date().getTime()}`; } avatarContent = `<img src="${VyukaApp.sanitizeHTML(avatarUrl)}" alt="${VyukaApp.sanitizeHTML(avatarContent)}">`; }} else { avatarContent = '<i class="fas fa-robot"></i>'; }
			const div = document.createElement('div'); div.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`; div.id = id; div.style.opacity = '0';
			const avatarDiv = `<div class="message-avatar">${avatarContent}</div>`; const bubbleDiv = document.createElement('div'); bubbleDiv.className = 'message-bubble';
			const bubbleContentDiv = document.createElement('div'); bubbleContentDiv.className = 'message-bubble-content'; VyukaApp.renderMarkdown(bubbleContentDiv, displayMessage, true);
			if (sender === 'gemini' && state.speechSynthesisSupported) { const ttsButton = document.createElement('button'); ttsButton.className = 'tts-listen-btn btn-tooltip'; ttsButton.title = 'Poslechnout'; ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>'; const textForSpeech = ttsText || displayMessage; ttsButton.dataset.textToSpeak = textForSpeech; ttsButton.addEventListener('click', (e) => { e.stopPropagation(); const buttonElement = e.currentTarget; const text = buttonElement.dataset.textToSpeak; if (text && typeof VyukaApp.speakText === 'function') { VyukaApp.speakText(text); } }); bubbleContentDiv.appendChild(ttsButton); }
            if (quickReplies && quickReplies.length > 0) { const quickRepliesDiv = document.createElement('div'); quickRepliesDiv.className = 'quick-replies-container'; quickReplies.forEach(reply => { const button = document.createElement('button'); button.className = 'btn btn-secondary btn-sm quick-reply-btn'; button.textContent = reply.title; button.dataset.payload = reply.payload; button.dataset.action = "true"; quickRepliesDiv.appendChild(button); }); bubbleContentDiv.appendChild(quickRepliesDiv); }
			bubbleDiv.appendChild(bubbleContentDiv); const timeDiv = `<div class="message-timestamp">${VyukaApp.formatTimestamp(timestamp)}</div>`; div.innerHTML = avatarDiv + bubbleDiv.outerHTML + timeDiv;
			ui.chatMessages.appendChild(div); if (window.MathJax && typeof window.MathJax.typesetPromise === 'function' && (displayMessage.includes('$') || displayMessage.includes('\\'))) { setTimeout(() => { window.MathJax.typesetPromise([bubbleContentDiv]).catch((err) => console.error(`[MathJax v29.2 Chat] Typeset error: ${err.message}`)); }, 0); }
			div.scrollIntoView({ behavior: 'smooth', block: 'end' }); requestAnimationFrame(() => { div.style.opacity = '1'; }); if (typeof VyukaApp.initTooltips === 'function') VyukaApp.initTooltips();
			const contentToSave = originalContent !== null ? originalContent : displayMessage; if (saveToDb && state.supabase && state.currentUser && state.currentTopic && state.currentSessionId) { try { await state.supabase.from('chat_history').insert({ user_id: state.currentUser.id, session_id: state.currentSessionId, topic_id: state.currentTopic.topic_id, topic_name: state.currentTopic.name, role: sender === 'gemini' ? 'model' : 'user', content: contentToSave }); } catch (e) { console.error("Chat save error:", e); VyukaApp.showToast("Chyba ukládání chatu.", "error"); } }
            VyukaApp.manageButtonStates();
		};

        VyukaApp.handleQuickReplyAction = async (actionPayload) => {
            const state = VyukaApp.state; const ui = VyukaApp.ui;
            console.log(`[QuickReply v29.2 AI] Handling action: ${actionPayload}`);
             const allQuickReplyButtons = document.querySelectorAll('.quick-reply-btn');
             allQuickReplyButtons.forEach(btn => {btn.disabled = true; btn.style.opacity="0.5";});

            if (actionPayload === 'ACTION_USER_ACCEPTS_QUIZ') {
                console.log("[QuickReply v29.2 AI] User accepts final quiz.");
                if(typeof VyukaApp.clearCurrentChatSessionHistory === 'function') { VyukaApp.clearCurrentChatSessionHistory(); }
                state.finalQuizActive = true; state.finalQuizOffered = false; state.aiIsWaitingForAnswer = false;
                VyukaApp.manageUIState('requestingFinalQuiz');
                if(typeof VyukaApp.requestFinalQuizContent === 'function'){ await VyukaApp.requestFinalQuizContent(); }
                else { console.error("VyukaApp.requestFinalQuizContent is not defined"); VyukaApp.showToast("Chyba: Funkce pro vyžádání testu chybí.", "error");}
            } else if (actionPayload === 'ACTION_USER_DECLINES_QUIZ') {
                console.log("[QuickReply v29.2 AI] User declines final quiz. Continuing lesson.");
                state.finalQuizOffered = false; state.finalQuizActive = false; state.aiIsWaitingForAnswer = false;
                VyukaApp.manageUIState('learning');
                if (typeof VyukaApp.addChatMessage === 'function') { VyukaApp.addChatMessage("Dobře, pokračujme ve výkladu. Klikni na 'Pokračovat' nebo polož otázku.", 'gemini'); }
                if(ui.continueBtn) { ui.continueBtn.style.display = 'inline-flex'; ui.continueBtn.disabled = false; }
            } else if (actionPayload === 'ACTION_USER_MARKS_COMPLETE_AFTER_QUIZ') {
                console.log("[QuickReply v29.2 AI] User marks topic complete after quiz.");
                if (typeof VyukaApp.handleMarkTopicComplete === 'function') VyukaApp.handleMarkTopicComplete(true);
            } else if (actionPayload === 'ACTION_USER_CONTINUES_AFTER_QUIZ') {
                console.log("[QuickReply v29.2 AI] User continues lesson after quiz evaluation.");
                state.finalQuizActive = false; state.finalQuizOffered = false; state.aiIsWaitingForAnswer = false;
                if(typeof VyukaApp.clearWhiteboard === 'function') VyukaApp.clearWhiteboard(true);
                VyukaApp.manageUIState('learning');
                if (typeof VyukaApp.addChatMessage === 'function') { VyukaApp.addChatMessage("Dobře, k čemu by ses chtěl vrátit nebo co bychom mohli probrat dál k tomuto tématu?", 'gemini');}
                state.aiIsWaitingForAnswer = true;
                if(ui.continueBtn) ui.continueBtn.style.display = 'none';
            } else { console.warn("[QuickReply v29.2 AI] Unknown action payload:", actionPayload); }
             VyukaApp.manageButtonStates();
        };

        VyukaApp.addThinkingIndicator = () => { const ui = VyukaApp.ui; const state = VyukaApp.state; if (state.thinkingIndicatorId || !ui.chatMessages) return; if (typeof VyukaApp.clearInitialChatState === 'function') VyukaApp.clearInitialChatState(); const id = `thinking-${Date.now()}`; const div = document.createElement('div'); div.className = 'chat-message model'; div.id = id; div.innerHTML = ` <div class="message-avatar"><i class="fas fa-robot"></i></div> <div class="message-thinking-indicator"> <span class="typing-dot"></span> <span class="typing-dot"></span> <span class="typing-dot"></span> </div> `; ui.chatMessages.appendChild(div); div.scrollIntoView({ behavior: 'smooth', block: 'end' }); state.thinkingIndicatorId = id; VyukaApp.manageButtonStates(); };
    	VyukaApp.removeThinkingIndicator = () => { const state = VyukaApp.state; if (state.thinkingIndicatorId) { document.getElementById(state.thinkingIndicatorId)?.remove(); state.thinkingIndicatorId = null; } };
    	VyukaApp.updateGeminiThinkingState = (isThinking) => { const state = VyukaApp.state; const ui = VyukaApp.ui; state.geminiIsThinking = isThinking; VyukaApp.setLoadingState('chat', isThinking); ui.aiAvatarCorner?.classList.toggle('thinking', isThinking); if (!isThinking) ui.aiAvatarCorner?.classList.remove('speaking'); if (isThinking) { VyukaApp.addThinkingIndicator(); } else { VyukaApp.removeThinkingIndicator(); } };

    	VyukaApp.handleSendMessage = async () => {
			const ui = VyukaApp.ui; const state = VyukaApp.state; const text = ui.chatInput?.value.trim();
            if (state.geminiIsThinking || !state.currentTopic || state.isListening) { VyukaApp.showToast("AI přemýšlí, mikrofon nahrává, nebo není vybráno téma.", "info"); return; }
            if (!text && !state.finalQuizActive && !state.finalQuizOffered) { return; }
            if (state.finalQuizActive) { VyukaApp.showToast("Probíhá test na tabuli. Odpovědi vyplňujte tam.", "info"); return; }
            if (state.finalQuizOffered && !text) { return; }

            state.lastInteractionTime = Date.now();
            if (state.aiIsWaitingForAnswer && !state.finalQuizActive && !state.finalQuizOffered) {
                console.log("[HandleSend v29.2 AI] Resetting aiIsWaitingForAnswer state (standard flow).");
                state.aiIsWaitingForAnswer = false;
            }
			if (ui.chatInput) { ui.chatInput.value = ''; if (typeof VyukaApp.autoResizeTextarea === 'function') VyukaApp.autoResizeTextarea(); }
			await VyukaApp.addChatMessage(text, 'user', true, new Date(), null, text);
			state.geminiChatContext.push({ role: "user", parts: [{ text }] });
			VyukaApp.updateGeminiThinkingState(true);
            if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.disabled = true;
			let promptForGemini = VyukaApp._buildChatInteractionPrompt(text);
			await VyukaApp.sendToGemini(promptForGemini, true);
		};

    	VyukaApp.confirmClearChat = () => { if (confirm("Opravdu vymazat historii této konverzace? Tato akce je nevratná.")) { if (typeof VyukaApp.clearCurrentChatSessionHistory === 'function') VyukaApp.clearCurrentChatSessionHistory(); } };
    	VyukaApp.clearCurrentChatSessionHistory = async () => { const ui = VyukaApp.ui; const state = VyukaApp.state; if (ui.chatMessages) { ui.chatMessages.innerHTML = ` <div class="initial-chat-interface"> <div class="ai-greeting-avatar"><i class="fas fa-robot"></i></div> <h3 class="initial-chat-title">AI Tutor Justax je připraven</h3> <p class="initial-chat-message">Chat vymazán. Čekám na načtení tématu nebo vaši zprávu.</p> <div class="initial-chat-status"><span class="status-dot online"></span> Online</div> </div>`; } state.geminiChatContext = []; VyukaApp.showToast("Historie chatu vymazána.", "info"); if (state.supabase && state.currentUser && state.currentSessionId) { try { const { error } = await state.supabase.from('chat_history').delete().match({ user_id: state.currentUser.id, session_id: state.currentSessionId }); if (error) throw error; console.log(`Chat history deleted from DB for session: ${state.currentSessionId}`); } catch (e) { console.error("DB clear chat error:", e); VyukaApp.showToast("Chyba při mazání historie chatu z databáze.", "error"); } } VyukaApp.manageButtonStates(); };
    	VyukaApp.saveChatToPDF = async () => { const ui = VyukaApp.ui; const state = VyukaApp.state; if (!ui.chatMessages || ui.chatMessages.children.length === 0 || !!ui.chatMessages.querySelector('.initial-chat-interface')) { VyukaApp.showToast("Není co uložit.", "warning"); return; } if (typeof html2pdf === 'undefined') { VyukaApp.showToast("Chyba: PDF knihovna nenalezena.", "error"); console.error("html2pdf library is not loaded!"); return; } VyukaApp.showToast("Generuji PDF...", "info", 4000); const elementToExport = document.createElement('div'); elementToExport.style.padding = "15mm"; elementToExport.innerHTML = ` <style> body { font-family: 'Poppins', sans-serif; font-size: 10pt; line-height: 1.5; color: #333; } .chat-message { margin-bottom: 12px; max-width: 90%; page-break-inside: avoid; } .user { margin-left: 10%; } .model { margin-right: 10%; } .message-bubble { display: inline-block; padding: 8px 14px; border-radius: 15px; background-color: #e9ecef; } .user .message-bubble { background-color: #d1e7dd; } .message-timestamp { font-size: 8pt; color: #6c757d; margin-top: 4px; display: block; } .user .message-timestamp { text-align: right; } h1 { font-size: 16pt; color: #0d6efd; text-align: center; margin-bottom: 5px; } p.subtitle { font-size: 9pt; color: #6c757d; text-align: center; margin: 0 0 15px 0; } hr { border: 0; border-top: 1px solid #ccc; margin: 15px 0; } .tts-listen-btn, .message-avatar { display: none; } mjx-math { font-size: 1em; } pre { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 0.8em; border-radius: 6px; overflow-x: auto; font-size: 0.9em; white-space: pre-wrap; word-wrap: break-word; } code { background-color: #e9ecef; padding: 0.1em 0.3em; border-radius: 3px; } pre code { background: none; padding: 0; } </style> <h1>Chat s AI Tutorem - ${VyukaApp.sanitizeHTML(state.currentTopic?.name || 'Neznámé téma')}</h1> <p class="subtitle">Vygenerováno: ${new Date().toLocaleString('cs-CZ')}</p> <hr> `; Array.from(ui.chatMessages.children).forEach(msgElement => { if (msgElement.classList.contains('chat-message') && !msgElement.id.startsWith('thinking-')) { const clone = msgElement.cloneNode(true); clone.querySelector('.message-avatar')?.remove(); clone.querySelector('.tts-listen-btn')?.remove(); elementToExport.appendChild(clone); } }); const filename = `chat-${state.currentTopic?.name?.replace(/[^a-z0-9]/gi, '_') || 'vyuka'}-${Date.now()}.pdf`; const pdfOptions = { margin: 15, filename: filename, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, logging: false }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }; try { await html2pdf().set(pdfOptions).from(elementToExport).save(); VyukaApp.showToast("Chat uložen jako PDF!", "success"); } catch (e) { console.error("PDF Generation Error:", e); VyukaApp.showToast("Chyba při generování PDF.", "error"); } };

        VyukaApp.parseGeminiResponse = (rawText) => {
            console.log("[ParseGemini v29.2] Raw input:", rawText ? rawText.substring(0, 150) + "..." : "EMPTY");
			const config = VyukaApp.config;
            const boardMarkerLegacy = "[BOARD_MARKDOWN]:";
            const keyConceptsMarker = "[KEY_CONCEPTS]:";
            const detailedExplanationMarker = "[DETAILED_EXPLANATION]:";
            const examplesMarker = "[EXAMPLES]:";
			const ttsMarker = "[TTS_COMMENTARY]:";
            const actionInitiateFinalQuizMarker = config.ACTION_INITIATE_FINAL_QUIZ;
            const actionShowQuizOnBoardMarker = config.ACTION_SHOW_QUIZ_ON_BOARD;
            const actionEvaluateBoardQuizMarker = config.ACTION_EVALUATE_BOARD_QUIZ;

            const createRegex = (marker) => new RegExp(`${marker.replace(/[[\]]/g, '\\[$&\\]')}\\s*(?:\`\`\`(?:markdown)?\\s*([\\s\\S]*?)\\s*\`\`\`|([\\s\\S]*?))(?=\\s*\\[KEY_CONCEPTS]:|\\s*\\[DETAILED_EXPLANATION]:|\\s*\\[EXAMPLES]:|\\s*\\[BOARD_MARKDOWN]:|\\s*\\[TTS_COMMENTARY]:|\\s*\\[ACTION:INITIATE_FINAL_QUIZ]|\\s*\\[ACTION:SHOW_QUIZ_ON_BOARD]|\\s*\\[ACTION:EVALUATE_BOARD_QUIZ]|$)`, 'i');

            const boardRegexLegacy = createRegex(boardMarkerLegacy);
            const keyConceptsRegex = createRegex(keyConceptsMarker);
            const detailedExplanationRegex = createRegex(detailedExplanationMarker);
            const examplesRegex = createRegex(examplesMarker);
			const ttsRegex = createRegex(ttsMarker);

            const actionQuizOfferRegex = new RegExp(`(${actionInitiateFinalQuizMarker.replace(/[[\]]/g, '\\[$&\\]')})`, 'i');
            const actionShowQuizRegex = new RegExp(`(${actionShowQuizOnBoardMarker.replace(/[[\]]/g, '\\[$&\\]')})`, 'i');
            const actionEvaluateQuizRegex = new RegExp(`(${actionEvaluateBoardQuizMarker.replace(/[[\]]/g, '\\[$&\\]')})`, 'i');

			let remainingText = rawText || "";
            let keyConcepts = "";
            let detailedExplanation = "";
            let examples = "";
			let ttsCommentary = "";
			let actionSignal = null;
            let legacyBoardMarkdown = "";

            const extractContent = (text, regex) => {
                const match = text.match(regex);
                if (match) {
                    let content = (match[1] || match[2] || "").trim();
                    if (content.toLowerCase().startsWith('markdown')) {
                        const nl = content.indexOf('\n');
                        if (nl !== -1 && nl < 15) content = content.substring(nl + 1).trim();
                        else if (content.length < 15) content = "";
                    }
                    return { content, remaining: text.replace(match[0], "").trim() };
                }
                return { content: "", remaining: text };
            };

            if (remainingText.match(actionQuizOfferRegex)) { actionSignal = 'INITIATE_FINAL_QUIZ'; remainingText = remainingText.replace(actionQuizOfferRegex, "").trim(); }
            else if (remainingText.match(actionShowQuizRegex)) { actionSignal = 'SHOW_QUIZ_ON_BOARD'; remainingText = remainingText.replace(actionShowQuizRegex, "").trim(); }
            else if (remainingText.match(actionEvaluateQuizRegex)) { actionSignal = 'EVALUATE_BOARD_QUIZ'; remainingText = remainingText.replace(actionEvaluateQuizRegex, "").trim(); }

            if (actionSignal && remainingText.length === 0) {
                return { keyConcepts, detailedExplanation, examples, ttsCommentary, chatText: "", actionSignal, legacyBoardMarkdown };
            }

            let extractionResult;
            extractionResult = extractContent(remainingText, keyConceptsRegex); keyConcepts = extractionResult.content; remainingText = extractionResult.remaining;
            extractionResult = extractContent(remainingText, detailedExplanationRegex); detailedExplanation = extractionResult.content; remainingText = extractionResult.remaining;
            extractionResult = extractContent(remainingText, examplesRegex); examples = extractionResult.content; remainingText = extractionResult.remaining;
            extractionResult = extractContent(remainingText, ttsRegex); ttsCommentary = extractionResult.content; remainingText = extractionResult.remaining;

            if (!keyConcepts && !detailedExplanation && !examples && remainingText.match(boardRegexLegacy)) {
                extractionResult = extractContent(remainingText, boardRegexLegacy);
                legacyBoardMarkdown = extractionResult.content;
                remainingText = extractionResult.remaining;
                console.log("[ParseGemini v29.2] Found and used legacy [BOARD_MARKDOWN].");
            }

			let chatText = remainingText
				.replace(/```(markdown)?\s*|\s*```/g, '')
                .replace(/\[KEY_CONCEPTS]:|\[DETAILED_EXPLANATION]:|\[EXAMPLES]:|\[BOARD_MARKDOWN]:|\[TTS_COMMENTARY]:|\[ACTION:INITIATE_FINAL_QUIZ]|\[ACTION:SHOW_QUIZ_ON_BOARD]|\[ACTION:EVALUATE_BOARD_QUIZ]/gi, '')
                .trim();

            console.log("[ParseGemini v29.2] Results - KC:", !!keyConcepts, "DE:", !!detailedExplanation, "EX:", !!examples, "TTS:", !!ttsCommentary, "Chat:", !!chatText, "Action:", actionSignal, "LegacyBoard:", !!legacyBoardMarkdown);
			return { keyConcepts, detailedExplanation, examples, ttsCommentary, chatText, actionSignal, legacyBoardMarkdown };
		};

    	VyukaApp.processGeminiResponse = async (rawText, timestamp) => {
			const state = VyukaApp.state; VyukaApp.removeThinkingIndicator(); state.lastInteractionTime = Date.now();
			console.log("[ProcessGemini v29.2] Processing Raw Response:", rawText ? rawText.substring(0, 100) + "..." : "Empty");
			if (!rawText) { VyukaApp.handleGeminiError("AI vrátilo prázdnou odpověď.", timestamp); VyukaApp.manageButtonStates(); return; }

			const { keyConcepts, detailedExplanation, examples, ttsCommentary, chatText, actionSignal, legacyBoardMarkdown } = VyukaApp.parseGeminiResponse(rawText);
			let aiRespondedToBoard = false; // Flag for content added to board
            let aiRespondedToChat = false; // Flag for content added to chat
			let cleanedChatText = "";
            if (typeof VyukaApp.cleanChatMessage === 'function') { cleanedChatText = VyukaApp.cleanChatMessage(chatText); } else { cleanedChatText = chatText.trim(); }
            console.log(`[ProcessGemini v29.2] Parsed-> KC: ${!!keyConcepts}, DE: ${!!detailedExplanation}, EX: ${!!examples}, TTS: ${!!ttsCommentary}, Chat: ${!!cleanedChatText}, Action: ${actionSignal}, LegacyBoard: ${!!legacyBoardMarkdown}`);

            if (actionSignal === 'INITIATE_FINAL_QUIZ') {
                console.log("[ProcessGemini v29.2] AI offers final quiz."); aiRespondedToChat = true; state.finalQuizOffered = true; state.aiIsWaitingForAnswer = true;
                if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.style.display = 'none';
                VyukaApp.addChatMessage("Výborně! Zdá se, že toto téma už máš v malíku. Chceš si dát krátký závěrečný test na ověření znalostí?", 'gemini', true, new Date(), null, null, [{ title: "Ano, spustit test!", payload: "ACTION_USER_ACCEPTS_QUIZ" }, { title: "Ne, díky.", payload: "ACTION_USER_DECLINES_QUIZ" }]);
                VyukaApp.manageUIState('quizOffered'); return;
            } else if (actionSignal === 'SHOW_QUIZ_ON_BOARD') {
                console.log("[ProcessGemini v29.2] AI provides quiz content for board."); aiRespondedToBoard = true;
                const boardContentForQuiz = detailedExplanation || keyConcepts || examples || legacyBoardMarkdown;
                if (boardContentForQuiz) { await VyukaApp.renderQuizOnBoard(boardContentForQuiz); state.aiIsWaitingForAnswer = false; }
                else { VyukaApp.handleGeminiError("AI neposkytlo obsah finálního testu pro tabuli.", timestamp); }
                VyukaApp.manageUIState('finalQuizInProgress'); return;
            } else if (actionSignal === config.ACTION_EVALUATE_BOARD_QUIZ) {
                console.log("[ProcessGemini v29.2] AI provides quiz evaluation for board.");
                state.finalQuizActive = false; state.aiIsWaitingForAnswer = false;
                const boardContentForEval = detailedExplanation || keyConcepts || examples || legacyBoardMarkdown;
                if (boardContentForEval) { VyukaApp.appendToWhiteboard({ type: 'detailed_explanation', content: boardContentForEval }, ttsCommentary || "Výsledky testu jsou na tabuli."); aiRespondedToBoard = true; }
                if (cleanedChatText) { VyukaApp.addChatMessage(cleanedChatText, 'gemini', true, timestamp, ttsCommentary); aiRespondedToChat = true; }
                else if (ttsCommentary && !boardContentForEval) { // If only TTS, add it to chat as fallback
                     VyukaApp.addChatMessage(`(Komentář k vyhodnocení: ${ttsCommentary})`, 'gemini', true, timestamp, ttsCommentary, `(Komentář: ${ttsCommentary})`);
                     aiRespondedToChat = true;
                }
                VyukaApp.showToast("Test vyhodnocen!", "Výsledky najdete na tabuli.", "success");
                VyukaApp.addChatMessage("Chceš toto téma označit za dokončené, nebo se k němu ještě vrátit?", 'gemini', false, new Date(), null, null, [ { title: "Označit za dokončené", payload: "ACTION_USER_MARKS_COMPLETE_AFTER_QUIZ"}, { title: "Pokračovat ve výkladu", payload: "ACTION_USER_CONTINUES_AFTER_QUIZ"} ]);
                state.aiIsWaitingForAnswer = true;
                VyukaApp.manageUIState('quizEvaluated'); return;
            }

            if (keyConcepts) { VyukaApp.appendToWhiteboard({ type: 'key_concepts', content: keyConcepts }, ttsCommentary || keyConcepts); aiRespondedToBoard = true; }
            if (detailedExplanation) { VyukaApp.appendToWhiteboard({ type: 'detailed_explanation', content: detailedExplanation }, ttsCommentary || detailedExplanation); aiRespondedToBoard = true; }
            if (examples) { VyukaApp.appendToWhiteboard({ type: 'examples', content: examples }, ttsCommentary || examples); aiRespondedToBoard = true; }
            if (legacyBoardMarkdown && !keyConcepts && !detailedExplanation && !examples) {
                VyukaApp.appendToWhiteboard({ type: 'detailed_explanation', content: legacyBoardMarkdown }, ttsCommentary || legacyBoardMarkdown); aiRespondedToBoard = true;
            }

            if (aiRespondedToBoard) {
                const taskKeywords = ['úloha k řešení', 'vyřešte tento příklad', 'zodpovězte následující', 'úkol:', 'otázka k procvičení'];
                const anyBoardContent = keyConcepts + detailedExplanation + examples + legacyBoardMarkdown;
                const taskHeaderRegex = /###\s*(úloha|příklad k řešení|úkol|otázka)/i;
                const zadaniEndsWithQuestion = /\*\*zadání:\*\*[\s\S]*\?$/i;
                if (taskKeywords.some(kw => anyBoardContent.toLowerCase().includes(kw)) || taskHeaderRegex.test(anyBoardContent) || zadaniEndsWithQuestion.test(anyBoardContent.replace(/\s+/g, ' '))) {
                    state.aiIsWaitingForAnswer = true;
                } else { state.aiIsWaitingForAnswer = false; }
            }

            // Přidat do chatu POUZE pokud cleanedChatText má obsah A ZÁROVEŇ není identický s ttsCommentary (abychom neměli duplicitu)
            // NEBO pokud nebyl žádný obsah na tabuli, ale máme ttsCommentary (fallback pro hlasový komentář bez vizuálu)
            let chatMessageTextForTTS = null;
            if (cleanedChatText && cleanedChatText.toLowerCase() !== ttsCommentary?.toLowerCase()) {
                chatMessageTextForTTS = ttsCommentary; // Použijeme původní TTS text pro tlačítko, i když chat je trochu jiný
                VyukaApp.addChatMessage(cleanedChatText, 'gemini', true, timestamp, chatMessageTextForTTS, chatText); // original chatText for DB
                aiRespondedToChat = true;
            } else if (!aiRespondedToBoard && ttsCommentary) { // Pokud nic na tabuli, ale je TTS, dáme ho do chatu
                // Zde by `cleanedChatText` měl být prázdný nebo identický s `ttsCommentary`, pokud AI dodrželo instrukce
                // Pokud `cleanedChatText` je prázdný, použijeme `ttsCommentary` pro zobrazení i TTS.
                const messageToDisplayInChat = cleanedChatText || `(Komentář: ${ttsCommentary})`;
                VyukaApp.addChatMessage(messageToDisplayInChat, 'gemini', true, timestamp, ttsCommentary, ttsCommentary);
                aiRespondedToChat = true;
            }


            if (!aiRespondedToBoard && !aiRespondedToChat) {
                VyukaApp.addChatMessage("(AI neodpovědělo očekávaným formátem nebo odpověď byla prázdná)", 'gemini', false, timestamp);
                state.aiIsWaitingForAnswer = false;
            }

            if (!state.aiIsWaitingForAnswer && aiRespondedToChat) { // Pokud AI odpovědělo do chatu a nečeká na odpověď na úlohu
                 state.aiIsWaitingForAnswer = /[\?؟]\s*$/.test(cleanedChatText.trim()); // Zkontroluje, zda chat končí otázkou
            }

            if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.disabled = state.aiIsWaitingForAnswer || state.geminiIsThinking;
            VyukaApp.manageUIState(state.aiIsWaitingForAnswer ? 'waitingForAnswer' : 'learning');
		};

        VyukaApp.requestFinalQuizContent = async () => {
            const state = VyukaApp.state;
            console.log("[RequestFinalQuizContent v29.2 AI] Requesting quiz content for board.");
            VyukaApp.updateGeminiThinkingState(true);
            const prompt = VyukaApp._buildFinalQuizPromptForBoard();
            await VyukaApp.sendToGemini(prompt, false);
        };

        VyukaApp.renderQuizOnBoard = async (quizMarkdownWithPlaceholders) => {
            console.log("[RenderQuizOnBoard v29.2 AI] Rendering quiz on whiteboard with input fields.");
            const ui = VyukaApp.ui; const state = VyukaApp.state;
            if (!ui.whiteboardContent || !ui.whiteboardContainer) return;
            state.quizQuestionsForBoard = []; if(typeof VyukaApp.clearWhiteboard === 'function') VyukaApp.clearWhiteboard(false);

            const questionRegex = /###\s*(Otázka\s*\d+)\s*\((Lehká|Středně těžká|Těžká)\)\s*-\s*Typ:\s*(.*?)\n([\s\S]*?)(?=(?:###\s*Otázka\s*\d+|$|\[TTS_COMMENTARY]:|\[CHAT_MESSAGE]:))/gi;
            let match; let questionIndex = 0;

            while ((match = questionRegex.exec(quizMarkdownWithPlaceholders)) !== null) {
                questionIndex++;
                const fullQuestionTitle = match[1]; const difficulty = match[2]; const questionType = match[3].trim();
                let questionTextWithOptions = match[4].trim().replace(/Vaše odpověď:\s*\[ODPOVĚĎ ZDE\]/gi, '').replace(/Vaše volba \(A\/B\/C\):\s*\[ODPOVĚĎ ZDE\]/gi, '').trim();

                state.quizQuestionsForBoard.push({ id: questionIndex, title: fullQuestionTitle, difficulty: difficulty, type: questionType, textWithOptions: questionTextWithOptions, userAnswer: '' });
                const chunkDiv = document.createElement('div'); chunkDiv.className = 'whiteboard-chunk quiz-question-item card'; chunkDiv.id = `quiz-q-${questionIndex}`;
                const contentDiv = document.createElement('div'); contentDiv.style.padding = "1rem";
                const titleEl = document.createElement('h3'); titleEl.innerHTML = `<i class="fas fa-question-circle" style="color:var(--vyuka-accent-secondary); margin-right:0.5em;"></i> ${fullQuestionTitle} <span class="quiz-difficulty-badge ${difficulty.toLowerCase().replace(/\s+/g, '-')}">${difficulty}</span> <span class="quiz-type-badge">${questionType}</span>`; contentDiv.appendChild(titleEl);
                const questionTextDiv = document.createElement('div'); VyukaApp.renderMarkdown(questionTextDiv, questionTextWithOptions, false); contentDiv.appendChild(questionTextDiv);
                const answerLabel = document.createElement('label'); answerLabel.htmlFor = `quiz-answer-${questionIndex}`; answerLabel.textContent = "Vaše odpověď:"; answerLabel.className = 'quiz-answer-label'; contentDiv.appendChild(answerLabel);
                let answerInput;
                if (questionType.toLowerCase() === 'multiple_choice') {
                    answerInput = document.createElement('select'); answerInput.className = 'quiz-answer-input form-control'; answerInput.dataset.questionId = questionIndex; answerInput.id = `quiz-answer-${questionIndex}`;
                    const optionRegex = /^[A-Z]\)\s*(.*)/gm; let optMatch; const defaultOption = document.createElement('option'); defaultOption.value = ""; defaultOption.textContent = "Vyberte možnost..."; answerInput.appendChild(defaultOption);
                    while((optMatch = optionRegex.exec(questionTextWithOptions)) !== null) { const optionLetter = optMatch[0].charAt(0); const optionTextPreview = optMatch[1].trim().substring(0,30) + (optMatch[1].trim().length > 30 ? "..." : ""); const optionEl = document.createElement('option'); optionEl.value = optionLetter; optionEl.textContent = `${optionLetter}) ${optionTextPreview}`; answerInput.appendChild(optionEl); }
                    if (answerInput.options.length <= 1) { answerInput = document.createElement('input'); answerInput.type = 'text'; answerInput.className = 'quiz-answer-input form-control'; answerInput.dataset.questionId = questionIndex; answerInput.id = `quiz-answer-${questionIndex}`; answerInput.placeholder = 'Napište písmeno odpovědi (A, B, C)...';}
                } else { answerInput = document.createElement('textarea'); answerInput.className = 'quiz-answer-input form-control'; answerInput.dataset.questionId = questionIndex; answerInput.id = `quiz-answer-${questionIndex}`; answerInput.placeholder = 'Napište svou odpověď zde...'; answerInput.rows = 2; }
                contentDiv.appendChild(answerInput); chunkDiv.appendChild(contentDiv); ui.whiteboardContent.appendChild(chunkDiv);
            }
            if (questionIndex === 0 && quizMarkdownWithPlaceholders) { VyukaApp.appendToWhiteboard({type: 'detailed_explanation', content: quizMarkdownWithPlaceholders }, "Závěrečný test (chyba formátování otázek)."); VyukaApp.showToast("Chyba formátu testu", "AI neposkytlo test ve správném formátu.", "warning"); }
            if (questionIndex > 0) {
                const existingSubmitBtn = document.getElementById('submit-quiz-btn'); if (existingSubmitBtn) existingSubmitBtn.remove();
                const submitButton = document.createElement('button'); submitButton.id = 'submit-quiz-btn'; submitButton.className = 'btn btn-primary btn-lg'; submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Odevzdat a Zkontrolovat Test'; submitButton.style.cssText = "margin-top: 1.5rem; display: block; margin-left: auto; margin-right: auto;";
                submitButton.addEventListener('click', VyukaApp.handleSubmitQuiz); ui.whiteboardContent.appendChild(submitButton);
                if (ui.continueBtn) ui.continueBtn.style.display = 'none'; if (ui.clearBoardBtn) ui.clearBoardBtn.style.display = 'none'; if (ui.stopSpeechBtn) ui.stopSpeechBtn.style.display = 'none';
                if (ui.vyukaLessonControls) ui.vyukaLessonControls.style.justifyContent = 'center';
            }
            if (typeof VyukaApp.triggerWhiteboardMathJax === 'function') VyukaApp.triggerWhiteboardMathJax(); if (ui.whiteboardContainer) ui.whiteboardContainer.scrollTop = 0;
            console.log("[RenderQuizOnBoard v29.2 AI] Quiz rendered with input fields.");
        };

        VyukaApp.handleSubmitQuiz = async () => {
            const state = VyukaApp.state;
            console.log("[SubmitQuiz v29.2 AI] Submitting quiz answers.");
            state.quizQuestionsForBoard.forEach(q => { const inputElement = document.getElementById(`quiz-answer-${q.id}`); if (inputElement) { q.userAnswer = inputElement.value.trim(); } });
            VyukaApp.updateGeminiThinkingState(true);
            const prompt = VyukaApp._buildQuizEvaluationPrompt(state.quizQuestionsForBoard);
            await VyukaApp.sendToGemini(prompt, false);
            state.finalQuizActive = false; state.aiIsWaitingForAnswer = false;
            const submitBtn = document.getElementById('submit-quiz-btn'); if (submitBtn) submitBtn.remove();
            if (VyukaApp.ui.vyukaLessonControls) VyukaApp.ui.vyukaLessonControls.style.justifyContent = 'flex-end';
             if (VyukaApp.ui.clearBoardBtn) VyukaApp.ui.clearBoardBtn.style.display = 'inline-flex';
             if (VyukaApp.ui.stopSpeechBtn) VyukaApp.ui.stopSpeechBtn.style.display = 'inline-flex';
            VyukaApp.manageUIState('quizEvaluating');
        };

        // --- PROMPTS ---
        VyukaApp._buildInitialPrompt = () => {
            const state = VyukaApp.state; const config = VyukaApp.config; const level = state.currentProfile?.skill_level || 'středně pokročilá'; const topicName = state.currentTopic?.name || 'Neznámé téma';
            return `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. Tvé vysvětlení musí být strukturované, přesné a profesionální. Téma lekce: "${topicName}". Cílová úroveň studenta: "${level}".
HLAVNÍ PRAVIDLA (NAPROSTO VŽDY DODRŽUJ!):
1.  **Struktura odpovědi na tabuli:** VŽDY strukturuj odpověď do bloků. Dostupné bloky:
    * \`[KEY_CONCEPTS]:\` Stručné klíčové body, definice, věty. Použij odrážky.
    * \`[DETAILED_EXPLANATION]:\` Hlavní, podrobnější výklad tématu.
    * \`[EXAMPLES]:\` Několik (MINIMÁLNĚ DVA) řešených příkladů (od jednoduchých po složitější). Jasně odděl zadání, postup a výsledek.
    * POKUD zadáváš ÚLOHU K ŘEŠENÍ studentovi, musí být v bloku \`[EXAMPLES]:\` nebo \`[DETAILED_EXPLANATION]:\`.
    Formátuj obsah bloků pomocí Markdown a $$...$$ pro matematiku.
2.  **[TTS_COMMENTARY]:** Použij POUZE pro DOPLŇUJÍCÍ hlasový komentář k obsahu na tabuli. NEOPAKUJ doslova text z tabule.
3.  **Chat (Text mimo značky):** VYUŽÍVEJ MINIMÁLNĚ. NIKDY v chatu NEUVÁDĚJ nový výukový obsah. Pokud je AI odpověď pouze hlasový komentář bez vizuálního obsahu na tabuli, můžeš dát do chatu velmi krátkou informaci, že komentář je dostupný k poslechu, např. "(Poslechněte si komentář)".
4.  **Postup a Náročnost:** Logicky od základů, zvyšuj náročnost příkladů k úrovni přijímaček. **VŽDY uveď VÍCE řešených příkladů PŘED úlohou pro studenta.**
5.  **Interakce:** Po ÚLOZE K ŘEŠENÍ na tabuli, v [TTS_COMMENTARY] **JASNĚ** řekni, že očekáváš odpověď studenta v chatu. Po teorii/řešeném příkladu **NEČEKEJ na odpověď** a **NEPOKLÁDEJ zbytečné otázky**.
6.  **Fokus na Téma:** STRIKTNĚ se drž tématu: "${topicName}".
7.  **Navržení Testu:** Pokud téma bylo dostatečně probráno, pošli **POUZE signál ${config.ACTION_INITIATE_FINAL_QUIZ}**.
8.  **Generování Testu na Tabuli:** POKUD obdržíš prompt obsahující 'POŽADAVEK NA FINÁLNÍ TEST NA TABULI', vygeneruj 10 otázek (3L, 2S, 5T) k tématu "${topicName}" POUZE do bloku \`[DETAILED_EXPLANATION]:\`. Každá otázka musí mít placeholder \`[ODPOVĚĎ ZDE]\`. Vrať POUZE signál ${config.ACTION_SHOW_QUIZ_ON_BOARD}.
9.  **Vyhodnocení Testu z Tabule:** Pokud obdržíš prompt obsahující 'VYHODNOCENÍ FINÁLNÍHO TESTU Z TABULE' a odpovědi studenta, vyhodnoť KAŽDOU odpověď. Poskytni skóre a zpětnou vazbu do bloku \`[DETAILED_EXPLANATION]:\`. Do [TTS_COMMENTARY] dej krátké shrnutí. Odpověď ukonči signálem ${config.ACTION_EVALUATE_BOARD_QUIZ}.
10. **Reflektivní Otázky:** Můžeš přidat do [TTS_COMMENTARY] nebo krátce do CHATU. Pro ně NEPOUŽÍVEJ v TTS "čekám na odpověď".

PRVNÍ KROK: Začni se ZÁKLADNÍ DEFINICÍ tématu "${topicName}" v bloku \`[KEY_CONCEPTS]:\`. Poté poskytni PODROBNĚJŠÍ VYSVĚTLENÍ v bloku \`[DETAILED_EXPLANATION]:\`. Nakonec uveď **alespoň JEDEN ŘEŠENÝ PŘÍKLAD** (jednoduchý) v bloku \`[EXAMPLES]:\`. Přidej krátký [TTS_COMMENTARY]:.

POŽADOVANÝ FORMÁT ODPOVĚDI (pro první krok):
[KEY_CONCEPTS]:
\`\`\`markdown
- Klíčový koncept 1...
- Klíčový koncept 2...
\`\`\`
[DETAILED_EXPLANATION]:
\`\`\`markdown
## ${topicName} - Základy
(Zde podrobnější vysvětlení základů, principů, atd. Použij **tučné písmo** pro termíny a $$...$$ pro matematiku.)
\`\`\`
[EXAMPLES]:
\`\`\`markdown
### První řešený příklad (Základní)
**Zadání:** ...
**Řešení:**
* Krok 1: ... ($$...$$)
* Krok 2: ... ($$...$$)
* Výsledek: $$...$$
\`\`\`
[TTS_COMMENTARY]: (Stručné představení tématu a shrnutí toho, co je na tabuli – definice, vysvětlení a první příklad. Zdůrazni klíčový bod. NEPOKLÁDEJ OTÁZKU a nezdrav.)`;
        };

    	VyukaApp._buildContinuePrompt = () => {
            const state = VyukaApp.state; const config = VyukaApp.config; const level = state.currentProfile?.skill_level || 'středně pokročilá'; const topicName = state.currentTopic?.name || 'Neznámé téma';
			return `Pokračuj ve výkladu tématu "${topicName}" pro studenta úrovně "${level}" (příprava na přijímačky 9. třídy). Naváž logicky na PŘEDCHOZÍ OBSAH NA TABULI.
HLAVNÍ PRAVIDLA (PŘIPOMENUTÍ!):
* **Struktura odpovědi na tabuli:** VŽDY strukturuj odpověď do bloků: \`[KEY_CONCEPTS]:\`, \`[DETAILED_EXPLANATION]:\`, \`[EXAMPLES]:\`. Všechny NOVÉ informace, **VÍCE ŘEŠENÝCH PŘÍKLADŮ**, ÚLOHY K ŘEŠENÍ patří VÝHRADNĚ do těchto bloků.
* [TTS_COMMENTARY]: POUZE DOPLNĚNÍ. Chat (mimo značky): NE nový obsah. Pokud je AI odpověď pouze hlasový komentář bez vizuálního obsahu na tabuli, můžeš dát do chatu velmi krátkou informaci, že komentář je dostupný k poslechu, např. "(Poslechněte si komentář)".
* STRIKTNĚ se drž tématu "${topicName}". Zvyšuj náročnost. **Vždy ŘEŠENÉ příklady PŘED úlohou.**
* Po ÚLOZE K ŘEŠENÍ, v [TTS_COMMENTARY] **JASNĚ řekni, že čekáš odpověď** v chatu.
* Po teorii/řešeném příkladu **NEČEKEJ** a **NEPOKLÁDEJ otázky**.
* **Reflektivní Otázky:** Můžeš přidat. Pro ně NEPOUŽÍVEJ v TTS "čekám na odpověď".
* Pokud je téma probráno -> pošli **POUZE signál ${config.ACTION_INITIATE_FINAL_QUIZ}**.

DALŠÍ KROK: Vyber JEDEN z následujících kroků (nebo navrhni dokončení):
A)  Další část teorie/vysvětlení navazující na předchozí (použij \`[KEY_CONCEPTS]:\` a/nebo \`[DETAILED_EXPLANATION]:\`).
B)  **Několik (alespoň 2) dalších ŘEŠENÝCH příkladů** v bloku \`[EXAMPLES]:\` (složitější než předchozí, může být i slovní úloha).
C)  ÚLOHU K ŘEŠENÍ pro studenta v bloku \`[EXAMPLES]:\` (až PO dostatečném množství řešených příkladů; náročnost úrovně přijímaček).
D)  Pokud je téma probráno -> pošli signál ${config.ACTION_INITIATE_FINAL_QUIZ}.

POŽADOVANÝ FORMÁT ODPOVĚDI (Pokud NEPOSÍLÁŠ ${config.ACTION_INITIATE_FINAL_QUIZ}, POUŽIJ VHODNÉ BLOKY):
[KEY_CONCEPTS]:
\`\`\`markdown
(Pokud relevantní pro tento krok)
\`\`\`
[DETAILED_EXPLANATION]:
\`\`\`markdown
(Pokud relevantní pro tento krok)
\`\`\`
[EXAMPLES]:
\`\`\`markdown
(Pokud relevantní pro tento krok, např. řešené příklady nebo úloha k řešení)
\`\`\`
[TTS_COMMENTARY]: (Komentář k NOVÉMU obsahu. Pokud ÚLOHA, řekni: "Nyní zkuste tuto úlohu vyřešit vy a napište mi výsledek/postup do chatu." Jinak stručně shrň.)`;
		};

        VyukaApp._buildFinalQuizPromptForBoard = () => {
            const state = VyukaApp.state; const config = VyukaApp.config; const topicName = state.currentTopic?.name || 'Neznámé téma';
            return `Toto je POŽADAVEK NA FINÁLNÍ TEST NA TABULI.
Vygeneruj finální test k tématu "${topicName}" (10 otázek: 3 lehké, 2 střední, 5 těžkých).
Každá otázka MUSÍ být ve formátu, který umožní studentovi odpovědět přímo na tabuli.
Formátuj POUZE pro blok \`[DETAILED_EXPLANATION]:\`.
Pro každou otázku uveď text otázky. Místo správné odpovědi uveď placeholder \`[ODPOVĚĎ ZDE]\`.
Začni s nadpisem "## Závěrečný Test na Tabuli: ${topicName}" UVNITŘ bloku \`[DETAILED_EXPLANATION]:\`.
Po vygenerování otázek vrať POUZE signál ${config.ACTION_SHOW_QUIZ_ON_BOARD} a NIC JINÉHO.

Příklad struktury otázky v Markdownu UVNITŘ \`[DETAILED_EXPLANATION]:\`:
[DETAILED_EXPLANATION]:
\`\`\`markdown
## Závěrečný Test na Tabuli: ${topicName}

### Otázka 1 (Lehká) - Typ: numeric
Řešte rovnici: $x + 5 = 12$.
Vaše odpověď: [ODPOVĚĎ ZDE]

### Otázka 2 (Lehká) - Typ: multiple_choice
Která z následujících možností je správná?
A) Možnost A
B) Možnost B
C) Možnost C
Vaše volba (A/B/C): [ODPOVĚĎ ZDE]
... (dalších 8 otázek)
\`\`\`
Po vypsání všech 10 otázek v tomto formátu ukonči odpověď POUZE signálem:
${config.ACTION_SHOW_QUIZ_ON_BOARD}
`;
        };

        VyukaApp._buildQuizEvaluationPrompt = (answeredQuestions) => {
            const state = VyukaApp.state; const config = VyukaApp.config; const topicName = state.currentTopic?.name || 'Neznámé téma';
            let questionsAndAnswersString = "Seznam otázek a odpovědí studenta:\n";
            answeredQuestions.forEach(q => { questionsAndAnswersString += `Otázka ${q.id} (${q.difficulty}, Typ: ${q.type}):\n${q.textWithOptions}\nStudentova odpověď: ${q.userAnswer || "(nezodpovězeno)"}\n---\n`; });

            return `Toto je POŽADAVEK NA VYHODNOCENÍ FINÁLNÍHO TESTU Z TABULE k tématu "${topicName}".
${questionsAndAnswersString}
TVŮJ ÚKOL:
1.  Pečlivě vyhodnoť KAŽDOU odpověď studenta. Uveď, zda je správná, nesprávná, nebo částečně správná.
2.  Ke KAŽDÉ otázce poskytni SPRÁVNOU odpověď nebo stručný postup řešení.
3.  Pokud byla odpověď studenta nesprávná nebo neúplná, napiš KRÁTKÝ komentář, kde udělal chybu.
4.  Na konci vypočítej CELKOVÉ SKÓRE (např. X z 10 správně) a napiš stručnou celkovou zpětnou vazbu k výkonu studenta.
5.  Všechny tyto informace formátuj VÝHRADNĚ pro blok \`[DETAILED_EXPLANATION]:\`. Začni s nadpisem "## Výsledky Závěrečného Testu: ${topicName}".
6.  Do [TTS_COMMENTARY] dej jen VELMI krátké shrnutí celkového výsledku a informaci, že student může téma dokončit.
7.  Nic nepiš do CHATU.
8.  Na úplný konec celé tvé odpovědi přidej signál ${config.ACTION_EVALUATE_BOARD_QUIZ}.`;
        };


    	VyukaApp._buildChatInteractionPrompt = (userText) => {
			const state = VyukaApp.state; const config = VyukaApp.config; const topicName = state.currentTopic?.name || 'Neznámé téma'; let baseInstruction;
            const isNevim = /\b(nevím|neviem|netuším|pomoc|nevim|nechapu|nerozumim|help|co s tim)\b/i.test(userText.toLowerCase());
            const isSimplerExplanationRequest = /\b(nerozumím|vysvětli jednodušeji|moc složité|полегче|jednodušeji|explain simpler|explain it simpler|i don't understand|too complicated)\b/i.test(userText.toLowerCase());
            const isSpecificQuestionAboutBoard = /\b(proč|jak|k čemu|co znamená|what does|why is|how did you get)\b/i.test(userText.toLowerCase()) && /\b(tabuli|tam|vzorec|krok|číslo|board|formula|step|number)\b/i.test(userText.toLowerCase());

            if (state.finalQuizActive) { baseInstruction = `Student je uprostřed finálního testu na tabuli a napsal do chatu: "${userText}". Řekni studentovi, že má odpovědi vyplňovat na tabuli a poté test odevzdat. NEPOKLÁDEJ ŽÁDNÉ OTÁZKY.`;
            } else if (state.finalQuizOffered) { baseInstruction = `AI nabídlo studentovi finální test. Student odpověděl: "${userText}". Pokud student souhlasí (např. "ano", "ok", "spustit"), nepiš nic do chatu, systém to zpracuje. Pokud odmítá nebo se ptá na něco jiného, odpověz krátce. NEPOKLÁDEJ DALŠÍ OTÁZKU.`;
            } else if (state.aiIsWaitingForAnswer) {
                if (isNevim) { baseInstruction = `Student odpověděl 'Nevím' na úlohu k tématu "${topicName}". Ukaž ŘEŠENÍ a VYSVĚTLENÍ úlohy v bloku \`[DETAILED_EXPLANATION]:\`. Do [TTS_COMMENTARY] stručně shrň řešení. Do CHATU NAPIŠ POUZE: 'Řešení je na tabuli.' NEPOKLÁDEJ ŽÁDNOU DALŠÍ OTÁZKU.`;
                } else { baseInstruction = `Student poskytl odpověď na úlohu k tématu "${topicName}": "${userText}". ZCELA KONKRÉTNĚ vyhodnoť správnost odpovědi POUZE v CHATU. Pokud nesprávná, vysvětli chybu a uveď správný postup/výsledek. Pokud správná, krátce pochval. Odpověď v chatu NESMÍ obsahovat nový obsah. NAPROSTO NEPOKLÁDEJ ŽÁDNÉ DALŠÍ OTÁZKY. UKONČI svou odpověď.`; }
			} else {
                if (isSimplerExplanationRequest) { baseInstruction = `Student žádá o jednodušší vysvětlení ("${userText}"). Poskytni ZJEDNODUŠENÉ vysvětlení v blocích \`[KEY_CONCEPTS]:\` a/nebo \`[DETAILED_EXPLANATION]:\`. Do [TTS_COMMENTARY] stručně shrň. Do CHATU napiš POUZE: 'Dobře, zkusím to vysvětlit jednodušeji na tabuli.' NIC VÍC.`;
                } else if (isSpecificQuestionAboutBoard) { baseInstruction = `Student má otázku k OBSAHU NA TABULI: "${userText}". Odpověz. Pokud je odpověď delší, dej ji do bloku \`[DETAILED_EXPLANATION]:\`. V [TTS_COMMENTARY] stručně shrň. Do CHATU napiš POUZE: 'Odpověď/Upřesnění je na tabuli.' NEBO (pokud velmi krátká odpověď) 'Krátká odpověď: [tvá krátká odpověď].' NIC VÍC.`;
                } else { baseInstruction = `Student položil otázku/komentář k tématu "${topicName}": "${userText}". Odpověz stručně a PŘÍMO k dotazu POUZE v CHATU. NEVYSVÊTLUJ novou látku. Pokud mimo téma, vrať zpět. NEPOKLÁDEJ otázky "Stačí takto?". IHNED SKONČI.`;}
			}
			return `${baseInstruction}\nPŘIPOMENUTÍ PRAVIDEL CHATU: Odpovídej POUZE běžným textem do chatu. Nepoužívej bloky tabule, pokud to není explicitně řečeno v ÚKOLU výše. Buď stručný a věcný.`;
		};

        VyukaApp._buildGeminiPayloadContents = (userPrompt, isChatInteraction = false) => {
			const state = VyukaApp.state; const config = VyukaApp.config; const topicName = state.currentTopic?.name || 'Neznámé téma';
            const systemInstruction = `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. NAPROSTO VŽDY dodržuj tato pravidla:
1.  **Struktura odpovědi na tabuli:** VŽDY strukturuj odpověď do bloků: \`[KEY_CONCEPTS]:\`, \`[DETAILED_EXPLANATION]:\`, \`[EXAMPLES]:\`. Veškerý výukový obsah patří VÝHRADNĚ sem.
2.  **[TTS_COMMENTARY]:** Použij POUZE pro DOPLNĚNÍ k tabuli.
3.  **Chat (Text mimo značky):** MINIMÁLNĚ. POUZE pro hodnocení odpovědi studenta NEBO VELMI krátkou PŘÍMOU odpověď na jeho otázku, nebo pro nabídku finálního testu. NIKDY nový výukový obsah. Pokud je AI odpověď pouze hlasový komentář bez vizuálního obsahu na tabuli, můžeš dát do chatu velmi krátkou informaci, že komentář je dostupný k poslechu, např. "(Poslechněte si komentář)".
4.  **Struktura a Náročnost:** Logicky, zvyšuj náročnost. **Vždy VÍCE řešených příkladů PŘED úlohou.**
5.  **Interakce:** Po ÚLOZE v některém z bloků tabule, v [TTS_COMMENTARY] **JASNĚ řekni, že čekáš odpověď** v chatu. Po teorii/řešeném příkladu **NEČEKEJ** a **NEPOKLÁDEJ otázky**.
6.  **Fokus na Téma:** STRIKTNĚ se drž tématu "${topicName}".
7.  **Odpovědi v chatu:** Pokud student ODPOVÍDÁ na úlohu nebo POKLÁDÁ OTÁZKU, odpovídej POUZE textem do CHATU podle instrukcí v uživatelském promptu. Po správné odpovědi studenta JEN potvrď a UKONČI odpověď. **Když odpovídáš na otázku studenta, odpověz PŘÍMO a ihned SKONČI.**
8.  **Reflektivní Otázky:** Můžeš přidat. Pro ně NEPOUŽÍVEJ v TTS "čekám na odpověď".
9.  **Navržení Dokončení Tématu:** Když je téma probráno, pošli **POUZE signál ${config.ACTION_INITIATE_FINAL_QUIZ}**.
10. **Finální Test na Tabuli:** POKUD obdržíš prompt **OBSAHUJÍCÍ frázi 'POŽADAVEK NA FINÁLNÍ TEST NA TABULI'**, vygeneruj 10 otázek (3L, 2S, 5T) K TÉMATU ("${topicName}") do bloku \`[DETAILED_EXPLANATION]:\` s placeholderem \`[ODPOVĚĎ ZDE]\`. Po vygenerování otázek vrať POUZE signál ${config.ACTION_SHOW_QUIZ_ON_BOARD}.
11. **Vyhodnocení Finálního Testu z Tabule:** Pokud obdržíš prompt **OBSAHUJÍCÍ frázi 'VYHODNOCENÍ FINÁLNÍHO TESTU Z TABULE'** a seznam otázek s odpověďmi, vyhodnoť KAŽDOU odpověď. Poskytni celkové skóre a zpětnou vazbu do bloku \`[DETAILED_EXPLANATION]:\`. Do [TTS_COMMENTARY] dej krátké shrnutí. Nic do CHATU. Odpověď ukonči signálem ${config.ACTION_EVALUATE_BOARD_QUIZ}.`;
            const modelConfirmation = `Rozumím. Dodržím pravidla. Obsah na tabuli bude strukturován do bloků [KEY_CONCEPTS]:, [DETAILED_EXPLANATION]:, [EXAMPLES]:. Komentář [TTS_COMMENTARY]. Chat minimálně. Držím se tématu "${topicName}". Navrhnu test signálem ${config.ACTION_INITIATE_FINAL_QUIZ}. Pokud dostanu "POŽADAVEK NA FINÁLNÍ TEST NA TABULI", vygeneruji otázky do [DETAILED_EXPLANATION]: a pošlu ${config.ACTION_SHOW_QUIZ_ON_BOARD}. Pokud "VYHODNOCENÍ FINÁLNÍHO TESTU Z TABULE", vyhodnotím do [DETAILED_EXPLANATION]: a pošlu ${config.ACTION_EVALUATE_BOARD_QUIZ}.`;
			const history = state.geminiChatContext.slice(-config.MAX_GEMINI_HISTORY_TURNS * 2); const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };
			return [{ role: "user", parts: [{ text: systemInstruction }] }, { role: "model", parts: [{ text: modelConfirmation }] }, ...history, currentUserMessage];
		};

    	VyukaApp.sendToGemini = async (prompt, isChatInteraction = false) => {
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

    	VyukaApp.handleGeminiError = (msg, time) => {
			const state = VyukaApp.state; VyukaApp.removeThinkingIndicator(); VyukaApp.addChatMessage(`Nastala chyba při komunikaci s AI: ${msg}`, 'gemini', false, time, null, `(Chyba: ${msg})`);
            state.aiIsWaitingForAnswer = false; state.finalQuizActive = false; state.finalQuizOffered = false;
            if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.disabled = false;
            VyukaApp.manageUIState('learning');
		};

	} catch (e) {
		console.error("FATAL SCRIPT ERROR (AI Interaction v29.2 - Revolutionary Update):", e);
		document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--vyuka-accent-error,#FF4757);color:var(--vyuka-text-primary,#E0E7FF);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky (AI Interaction).</p><p style="margin-top:15px;"><a href="#" onclick="location.reload()" style="color:var(--vyuka-accent-secondary,#00F5FF); text-decoration:underline; font-weight:bold;">Obnovit stránku</a></p><details style="margin-top:20px;color:#f0f0f0;"><summary style="cursor:pointer;color:var(--vyuka-text-primary,#E0E7FF);">Detaily</summary><pre style="margin-top:10px;padding:15px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;max-height:300px; overflow-y:auto; border-radius:8px;">${e.message}\n${e.stack}</pre></details></div>`;
	}
})(window.VyukaApp);