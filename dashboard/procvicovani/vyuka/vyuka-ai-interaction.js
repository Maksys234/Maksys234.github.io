// Файл: procvicovani/vyuka/vyuka-ai-interaction.js
// Логика взаимодействия с AI Gemini, управление чатом, учебной сессией, парсинг ответов AI
// Версия v26: Vylepšená logika pro chat vs. tabule, reakce na "Nevím", oprava finálního testu.

// Получаем доступ к глобальному пространству имен
window.VyukaApp = window.VyukaApp || {};

(function(VyukaApp) { // Используем IIFE для локальной области видимости, передаем VyukaApp
	'use strict';

	try {
		// --- Constants & Configuration (AI Interaction Specific) ---
		const config = VyukaApp.config = VyukaApp.config || {}; // Ensure config exists
		config.GEMINI_API_KEY = config.GEMINI_API_KEY || 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // Use existing or default
		config.GEMINI_API_URL = config.GEMINI_API_URL || `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;
		config.MAX_GEMINI_HISTORY_TURNS = config.MAX_GEMINI_HISTORY_TURNS || 12;
        config.ACTION_SUGGEST_COMPLETION = "[ACTION:SUGGEST_COMPLETION]"; // Deprecated, use INITIATE_FINAL_QUIZ
        config.ACTION_INITIATE_FINAL_QUIZ = "[ACTION:INITIATE_FINAL_QUIZ]";

        // --- Topic Loading and Progress ---
        // Funkce VyukaApp.loadNextUncompletedTopic zůstává stejná jako ve verzi v25
        VyukaApp.loadNextUncompletedTopic = async () => {
			const state = VyukaApp.state;
			const ui = VyukaApp.ui;
			if (!state.currentUser || state.topicLoadInProgress || !state.supabase) return;

			state.topicLoadInProgress = true;
			VyukaApp.setLoadingState('currentTopic', true);
			state.currentTopic = null;
            state.aiSuggestedCompletion = false;
            state.finalQuizActive = false;
            state.finalQuizAnswers = [];

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
					.select('id, title, description, topic_id') // Assuming topic_id is directly in plan_activities
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

					if (activity.topic_id) { // If activity has a direct topic_id
						try {
							const { data: topic, error: topicError } = await state.supabase
								.from('exam_topics') // Assuming a table 'exam_topics' exists
								.select('name, description')
								.eq('id', activity.topic_id)
								.single();
							if (topicError && topicError.code !== 'PGRST116') throw topicError;
							if (topic) {
								name = topic.name || name; // Prefer name from exam_topics
								desc = topic.description || desc; // Prefer description from exam_topics
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
						topic_id: activity.topic_id // Store the topic_id if available
					};

					if (ui.currentTopicDisplay) {
						ui.currentTopicDisplay.innerHTML = `Téma: <strong>${VyukaApp.sanitizeHTML(name)}</strong>`;
					}
                    if (ui.vyukaSubjectTitle) ui.vyukaSubjectTitle.textContent = "AI Tutor"; // Or dynamic subject
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

        // Funkce VyukaApp.handleMarkTopicComplete zůstává stejná jako ve verzi v25
		VyukaApp.handleMarkTopicComplete = async () => {
			const state = VyukaApp.state;
			const config = VyukaApp.config;
			const ui = VyukaApp.ui;

			if (!state.currentTopic || !state.currentTopic.activity_id) {
				 console.error("[MarkComplete v26] Error: Missing currentTopic or activity_id in state.", state.currentTopic);
				 VyukaApp.showToast("Chyba: Chybí informace o aktuálním tématu.", "error");
				 return;
			}
			if (!state.supabase) {
				 console.error("[MarkComplete v26] Error: Supabase client not available.");
				 VyukaApp.showToast("Chyba: Databáze není dostupná.", "error");
				 return;
			}
			 if (state.topicLoadInProgress) {
				  console.warn("[MarkComplete v26] Blocked: Topic operation already in progress.");
				  return;
			 }

			console.log(`[MarkComplete v26] Attempting to mark activity ID: ${state.currentTopic.activity_id} (${state.currentTopic.name}) as complete.`);
			state.topicLoadInProgress = true;
			state.aiSuggestedCompletion = false;
            state.finalQuizActive = false;
			VyukaApp.manageButtonStates();

			try {
				console.log(`[MarkComplete v26] Preparing to update activity ID: ${state.currentTopic.activity_id} in plan ID: ${state.currentTopic.plan_id}`);
				console.log(`[MarkComplete v26] Points to award: ${config.POINTS_TOPIC_COMPLETE}`);

				const { error: updateError } = await state.supabase
					.from('plan_activities')
					.update({ completed: true, updated_at: new Date().toISOString() })
					.eq('id', state.currentTopic.activity_id);

				if (updateError) {
					 console.error(`[MarkComplete v26] Supabase update FAILED for activity ${state.currentTopic.activity_id}:`, updateError);
					 throw updateError;
				}
				console.log(`[MarkComplete v26] >>> DB UPDATE SUCCESS for activity ${state.currentTopic.activity_id} <<<`);

                 if (typeof VyukaApp.awardPoints === 'function') {
				    await VyukaApp.awardPoints(config.POINTS_TOPIC_COMPLETE);
                 } else { console.error("Error: VyukaApp.awardPoints not defined."); }

				if (typeof VyukaApp.checkAndAwardAchievements === 'function') {
					await VyukaApp.checkAndAwardAchievements(state.currentUser.id);
				} else {
					console.warn("[MarkComplete v26] Achievement checking function not found.");
				}

				VyukaApp.showToast(`Téma "${state.currentTopic.name}" dokončeno! Přesměrovávám...`, "success", 2500);

                console.log("[MarkComplete v26] Scheduling redirect after success.");
				setTimeout(() => {
                     console.log("[MarkComplete v26] Redirecting now...");
                     window.location.href = '/dashboard/procvicovani/main.html'; // Nebo jinam, pokud je potřeba
                 }, 500);

			} catch (error) {
				console.error(`[MarkComplete v26] CATCH BLOCK: Error during topic completion (Activity ID: ${state.currentTopic?.activity_id}):`, error);
				VyukaApp.showToast(`Chyba uložení dokončení tématu: ${error.message || 'Neznámá chyba'}`, "error", 6000);
				state.topicLoadInProgress = false;
				VyukaApp.manageButtonStates();
			}
		};

        // Funkce VyukaApp.startLearningSession zůstává stejná jako ve verzi v25
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

        // Funkce VyukaApp.requestContinue zůstává stejná jako ve verzi v25
    	VyukaApp.requestContinue = async () => {
			const state = VyukaApp.state;
			console.log("[RequestContinue v26] Triggered. AI Waiting:", state.aiIsWaitingForAnswer, "AI Suggested Completion:", state.aiSuggestedCompletion, "Final Quiz Active:", state.finalQuizActive);

			if (state.geminiIsThinking || !state.currentTopic || state.finalQuizActive) {
                VyukaApp.showToast("Počkejte prosím, nebo dokončete aktuální test.", "info", 3000);
                return;
            }

			if (state.aiIsWaitingForAnswer) {
				VyukaApp.showToast("Nejprve odpovězte na úlohu v chatu.", "warning", 3000);
				console.warn("[RequestContinue v26] Blocked: AI is waiting for an answer.");
				return;
			}

            if (state.aiSuggestedCompletion) {
                VyukaApp.showToast("AI navrhlo dokončení tématu. Pro dokončení použijte modální okno nebo požádejte AI o pokračování.", "info");
                return;
            }
            if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.disabled = true;

			const prompt = VyukaApp._buildContinuePrompt();
			await VyukaApp.sendToGemini(prompt);
		};

        // Funkce VyukaApp.addChatMessage zůstává stejná jako ve verzi v25
    	VyukaApp.addChatMessage = async (displayMessage, sender, saveToDb = true, timestamp = new Date(), ttsText = null, originalContent = null) => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;
			if (!ui.chatMessages) return;

			VyukaApp.clearInitialChatState();

			const id = `msg-${Date.now()}`;
			let avatarContent;
            if (sender === 'user') {
                avatarContent = VyukaApp.getInitials(state.currentProfile, state.currentUser?.email);
                if (state.currentProfile?.avatar_url) {
                    let avatarUrl = state.currentProfile.avatar_url;
                    // Check if it's an internal path (no domain) or an external URL
                    if (!avatarUrl.startsWith('http') && avatarUrl.includes('/')) {
                        // Internal path, use as is
                    } else {
                        // External path, add timestamp for cache busting
                        avatarUrl += (avatarUrl.includes('?') ? '&' : '?') + `t=${new Date().getTime()}`;
                    }
                    avatarContent = `<img src="${VyukaApp.sanitizeHTML(avatarUrl)}" alt="${VyukaApp.sanitizeHTML(avatarContent)}">`;
                }
            } else { // AI
                avatarContent = '<i class="fas fa-robot"></i>';
            }

			const div = document.createElement('div');
			div.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`;
			div.id = id;
			div.style.opacity = '0'; // For fade-in effect

			const avatarDiv = `<div class="message-avatar">${avatarContent}</div>`;
			const bubbleDiv = document.createElement('div');
			bubbleDiv.className = 'message-bubble';
			const bubbleContentDiv = document.createElement('div');
			bubbleContentDiv.className = 'message-bubble-content';

			VyukaApp.renderMarkdown(bubbleContentDiv, displayMessage, true); // isChat = true

			if (sender === 'gemini' && state.speechSynthesisSupported) {
				const ttsButton = document.createElement('button');
				ttsButton.className = 'tts-listen-btn btn-tooltip';
				ttsButton.title = 'Poslechnout';
				ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
				const textForSpeech = ttsText || displayMessage;
				ttsButton.dataset.textToSpeak = textForSpeech;
				ttsButton.addEventListener('click', (e) => {
					e.stopPropagation();
                    const buttonElement = e.currentTarget;
                    const text = buttonElement.dataset.textToSpeak;
                    if (text && typeof VyukaApp.speakText === 'function') {
					    VyukaApp.speakText(text); // No targetChunkElement for chat messages
                    } else {
                        console.warn("No text found for TTS button in chat or speakText function missing.");
                    }
				});
				bubbleContentDiv.appendChild(ttsButton);
			}

			bubbleDiv.appendChild(bubbleContentDiv);
			const timeDiv = `<div class="message-timestamp">${VyukaApp.formatTimestamp(timestamp)}</div>`;
			div.innerHTML = avatarDiv + bubbleDiv.outerHTML + timeDiv;
			ui.chatMessages.appendChild(div);

			if (window.MathJax && typeof window.MathJax.typesetPromise === 'function' && (displayMessage.includes('$') || displayMessage.includes('\\'))) {
                console.log(`[MathJax v26] Queueing typeset for chat message bubble: ${id}`);
				setTimeout(() => {
					window.MathJax.typesetPromise([bubbleContentDiv])
						.then(() => console.log(`[MathJax v26] Typeset successful for chat bubble ${id}`))
						.catch((err) => console.error(`[MathJax v26] Typeset error for chat bubble ${id}: ${err.message}`));
				}, 0);
			}

			div.scrollIntoView({ behavior: 'smooth', block: 'end' });
			requestAnimationFrame(() => { div.style.opacity = '1'; });
			VyukaApp.initTooltips();

			const contentToSave = originalContent !== null ? originalContent : displayMessage;
			if (saveToDb && state.supabase && state.currentUser && state.currentTopic && state.currentSessionId) {
				try {
					await state.supabase.from('chat_history').insert({
						user_id: state.currentUser.id,
						session_id: state.currentSessionId,
						topic_id: state.currentTopic.topic_id,
						topic_name: state.currentTopic.name,
						role: sender === 'gemini' ? 'model' : 'user',
						content: contentToSave
					});
				} catch (e) {
					console.error("Chat save error:", e);
					VyukaApp.showToast("Chyba ukládání chatu.", "error");
				}
			}
            VyukaApp.manageButtonStates();
		};

        // Funkce VyukaApp.addThinkingIndicator, removeThinkingIndicator, updateGeminiThinkingState zůstávají stejné jako ve verzi v25
        VyukaApp.addThinkingIndicator = () => { const ui = VyukaApp.ui; const state = VyukaApp.state; if (state.thinkingIndicatorId || !ui.chatMessages) return; VyukaApp.clearInitialChatState(); const id = `thinking-${Date.now()}`; const div = document.createElement('div'); div.className = 'chat-message model'; div.id = id; div.innerHTML = ` <div class="message-avatar"><i class="fas fa-robot"></i></div> <div class="message-thinking-indicator"> <span class="typing-dot"></span> <span class="typing-dot"></span> <span class="typing-dot"></span> </div> `; ui.chatMessages.appendChild(div); div.scrollIntoView({ behavior: 'smooth', block: 'end' }); state.thinkingIndicatorId = id; VyukaApp.manageButtonStates(); };
    	VyukaApp.removeThinkingIndicator = () => { const state = VyukaApp.state; if (state.thinkingIndicatorId) { document.getElementById(state.thinkingIndicatorId)?.remove(); state.thinkingIndicatorId = null; } };
    	VyukaApp.updateGeminiThinkingState = (isThinking) => { const state = VyukaApp.state; const ui = VyukaApp.ui; state.geminiIsThinking = isThinking; VyukaApp.setLoadingState('chat', isThinking); ui.aiAvatarCorner?.classList.toggle('thinking', isThinking); if (!isThinking) ui.aiAvatarCorner?.classList.remove('speaking'); if (isThinking) { VyukaApp.addThinkingIndicator(); } else { VyukaApp.removeThinkingIndicator(); } };

        // Funkce VyukaApp.handleSendMessage zůstává stejná jako ve verzi v25
    	VyukaApp.handleSendMessage = async () => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;
			const text = ui.chatInput?.value.trim();

			if (!text || state.geminiIsThinking || !state.currentTopic || state.isListening ) { // finalQuizActive kontrola je nyní v manageButtonStates pro chatInput
                if (state.finalQuizActive && text) {
                     // Pokud je aktivní finální test a je nějaký text, dovolíme odeslání odpovědi na test
                } else if (state.finalQuizActive) {
                     VyukaApp.showToast("Probíhá finální test. Odpovězte na otázku.", "info"); return;
                } else if (!text) {
                     return; // Tiché ukončení, pokud není text a není to odpověď na test
                } else {
                     VyukaApp.showToast("AI přemýšlí nebo není vybráno téma.", "info"); return;
                }
            }

            state.lastInteractionTime = Date.now();
            state.aiSuggestedCompletion = false; // User interaction resets this

            if (state.aiIsWaitingForAnswer && !state.finalQuizActive) { // Reset only if not in final quiz
                console.log("[HandleSend v26] Resetting aiIsWaitingForAnswer state.");
                state.aiIsWaitingForAnswer = false;
                VyukaApp.manageUIState('learning');
            }

			if (ui.chatInput) {
				ui.chatInput.value = '';
				VyukaApp.autoResizeTextarea();
			}

			await VyukaApp.addChatMessage(text, 'user', true, new Date(), null, text);
			state.geminiChatContext.push({ role: "user", parts: [{ text }] });
			VyukaApp.updateGeminiThinkingState(true);
            if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.disabled = true;

			let promptForGemini = VyukaApp._buildChatInteractionPrompt(text);
			await VyukaApp.sendToGemini(promptForGemini, true);
		};

        // Funkce VyukaApp.confirmClearChat, clearCurrentChatSessionHistory, saveChatToPDF zůstávají stejné jako ve verzi v25
    	VyukaApp.confirmClearChat = () => { if (confirm("Opravdu vymazat historii této konverzace? Tato akce je nevratná.")) { VyukaApp.clearCurrentChatSessionHistory(); } };
    	VyukaApp.clearCurrentChatSessionHistory = async () => { const ui = VyukaApp.ui; const state = VyukaApp.state; if (ui.chatMessages) { ui.chatMessages.innerHTML = ` <div class="initial-chat-interface"><div class="ai-greeting-avatar"><i class="fas fa-robot"></i></div><h3 class="initial-chat-title">AI Tutor Justax je připraven</h3><p class="initial-chat-message">Chat vymazán. Čekám na načtení tématu nebo vaši zprávu.</p><div class="initial-chat-status"><span class="status-dot online"></span> Online</div></div>`; } state.geminiChatContext = []; VyukaApp.showToast("Historie chatu vymazána.", "info"); if (state.supabase && state.currentUser && state.currentSessionId) { try { const { error } = await state.supabase.from('chat_history').delete().match({ user_id: state.currentUser.id, session_id: state.currentSessionId }); if (error) throw error; console.log(`Chat history deleted from DB for session: ${state.currentSessionId}`); } catch (e) { console.error("DB clear chat error:", e); VyukaApp.showToast("Chyba při mazání historie chatu z databáze.", "error"); } } VyukaApp.manageButtonStates(); };
    	VyukaApp.saveChatToPDF = async () => { const ui = VyukaApp.ui; const state = VyukaApp.state; if (!ui.chatMessages || ui.chatMessages.children.length === 0 || !!ui.chatMessages.querySelector('.initial-chat-interface')) { VyukaApp.showToast("Není co uložit.", "warning"); return; } if (typeof html2pdf === 'undefined') { VyukaApp.showToast("Chyba: PDF knihovna nenalezena.", "error"); console.error("html2pdf library is not loaded!"); return; } VyukaApp.showToast("Generuji PDF...", "info", 4000); const elementToExport = document.createElement('div'); elementToExport.style.padding = "15mm"; elementToExport.innerHTML = ` <style> body { font-family: 'Poppins', sans-serif; font-size: 10pt; line-height: 1.5; color: #333; } .chat-message { margin-bottom: 12px; max-width: 90%; page-break-inside: avoid; } .user { margin-left: 10%; } .model { margin-right: 10%; } .message-bubble { display: inline-block; padding: 8px 14px; border-radius: 15px; background-color: #e9ecef; } .user .message-bubble { background-color: #d1e7dd; } .message-timestamp { font-size: 8pt; color: #6c757d; margin-top: 4px; display: block; } .user .message-timestamp { text-align: right; } h1 { font-size: 16pt; color: #0d6efd; text-align: center; margin-bottom: 5px; } p.subtitle { font-size: 9pt; color: #6c757d; text-align: center; margin: 0 0 15px 0; } hr { border: 0; border-top: 1px solid #ccc; margin: 15px 0; } .tts-listen-btn { display: none; } .message-avatar { display: none; } mjx-math { font-size: 1em; } pre { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 0.8em; border-radius: 6px; overflow-x: auto; font-size: 0.9em; white-space: pre-wrap; word-wrap: break-word; } code { background-color: #e9ecef; padding: 0.1em 0.3em; border-radius: 3px; } pre code { background: none; padding: 0; } </style> <h1>Chat s AI Tutorem - ${VyukaApp.sanitizeHTML(state.currentTopic?.name || 'Neznámé téma')}</h1> <p class="subtitle">Vygenerováno: ${new Date().toLocaleString('cs-CZ')}</p> <hr> `; Array.from(ui.chatMessages.children).forEach(msgElement => { if (msgElement.classList.contains('chat-message') && !msgElement.id.startsWith('thinking-')) { const clone = msgElement.cloneNode(true); clone.querySelector('.message-avatar')?.remove(); clone.querySelector('.tts-listen-btn')?.remove(); elementToExport.appendChild(clone); } }); const filename = `chat-${state.currentTopic?.name?.replace(/[^a-z0-9]/gi, '_') || 'vyuka'}-${Date.now()}.pdf`; const pdfOptions = { margin: 15, filename: filename, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, logging: false }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }; try { await html2pdf().set(pdfOptions).from(elementToExport).save(); VyukaApp.showToast("Chat uložen jako PDF!", "success"); } catch (e) { console.error("PDF Generation Error:", e); VyukaApp.showToast("Chyba při generování PDF.", "error"); } };

        // Funkce VyukaApp.parseGeminiResponse zůstává stejná jako ve verzi v25
        VyukaApp.parseGeminiResponse = (rawText) => {
            console.log("[ParseGemini v26] Raw input:", rawText ? rawText.substring(0, 150) + "..." : "EMPTY");
			const config = VyukaApp.config;
			const boardMarker = "[BOARD_MARKDOWN]:";
			const ttsMarker = "[TTS_COMMENTARY]:";
			// const actionSuggestCompletionMarker = config.ACTION_SUGGEST_COMPLETION; // Deprecated
            const actionInitiateFinalQuizMarker = config.ACTION_INITIATE_FINAL_QUIZ;

            // Combined regex to find markers and their content (non-greedy)
			const boardRegex = /\[BOARD_MARKDOWN]:\s*(?:```(?:markdown)?\s*([\s\S]*?)\s*```|([\s\S]*?))(?=\s*\[TTS_COMMENTARY]:|\s*\[BOARD_MARKDOWN]:|\s*\[ACTION:INITIATE_FINAL_QUIZ]|$)/i;
            const ttsRegex = /\[TTS_COMMENTARY]:\s*(?:```\s*([\s\S]*?)\s*```|([\s\S]*?))(?=\s*\[BOARD_MARKDOWN]:|\s*\[TTS_COMMENTARY]:|\s*\[ACTION:INITIATE_FINAL_QUIZ]|$)/i;
            const actionQuizRegex = /(\[ACTION:INITIATE_FINAL_QUIZ])/i;

			let remainingText = rawText || "";
			let boardMarkdown = "";
			let ttsCommentary = "";
			let actionSignal = null;

            // 1. Check for ACTION_INITIATE_FINAL_QUIZ first
            const quizMatch = remainingText.match(actionQuizRegex);
            if (quizMatch) {
                actionSignal = 'INITIATE_FINAL_QUIZ';
                remainingText = remainingText.replace(quizMatch[0], "").trim();
                console.log(`[ParseGemini v26] Found action signal: ${actionSignal}`);
                // If ONLY the action signal was present, return immediately
                if (remainingText.length === 0) {
					return { boardMarkdown: "", ttsCommentary: "", chatText: "", actionSignal };
				}
            }
            // Deprecated ACTION_SUGGEST_COMPLETION - remove or keep if legacy AI models might send it.
            // For now, let's assume it's fully replaced by INITIATE_FINAL_QUIZ.

			// 2. Extract Board Markdown
			const boardMatch = remainingText.match(boardRegex);
			if (boardMatch) {
				boardMarkdown = (boardMatch[1] || boardMatch[2] || "").trim(); // Group 1 for ```markdown ... ```, Group 2 for ...
                remainingText = remainingText.replace(boardMatch[0], "").trim();
				console.log(`[ParseGemini v26] Found board content. Length: ${boardMarkdown.length}`);
                 if (boardMarkdown.toLowerCase().startsWith('markdown')) {
                    const potentialNewlineIndex = boardMarkdown.indexOf('\n');
                    if (potentialNewlineIndex !== -1 && potentialNewlineIndex < 15) {
                        boardMarkdown = boardMarkdown.substring(potentialNewlineIndex + 1).trim();
                    } else if (boardMarkdown.length < 15) {
                         boardMarkdown = "";
                     }
                }
			}

			// 3. Extract TTS Commentary
			const ttsMatch = remainingText.match(ttsRegex);
			if (ttsMatch) {
				ttsCommentary = (ttsMatch[1] || ttsMatch[2] || "").trim();
				remainingText = remainingText.replace(ttsMatch[0], "").trim();
				console.log(`[ParseGemini v26] Found TTS content. Length: ${ttsCommentary.length}`);
			}

			// 4. The rest is chat text
			let chatText = remainingText
				.replace(/```(markdown)?\s*|\s*```/g, '')
                .replace(/\[BOARD_MARKDOWN]:/gi, '')
                .replace(/\[TTS_COMMENTARY]:/gi, '')
                .replace(/\[ACTION:INITIATE_FINAL_QUIZ]/gi, '') // Clean this too
                .trim();

            console.log("[ParseGemini v26] Result - Board:", boardMarkdown ? boardMarkdown.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini v26] Result - TTS:", ttsCommentary ? ttsCommentary.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini v26] Result - Chat:", chatText ? chatText.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini v26] Result - Action:", actionSignal);

			return { boardMarkdown, ttsCommentary, chatText, actionSignal };
		};

        // Funkce VyukaApp.processGeminiResponse zůstává stejná jako ve verzi v25
    	VyukaApp.processGeminiResponse = async (rawText, timestamp) => {
			const state = VyukaApp.state;
			VyukaApp.removeThinkingIndicator();
            state.lastInteractionTime = Date.now();

			console.log("[ProcessGemini v26] Processing Raw Response:", rawText ? rawText.substring(0, 100) + "..." : "Empty Response");

			if (!rawText) {
				VyukaApp.handleGeminiError("AI vrátilo prázdnou odpověď.", timestamp);
                VyukaApp.manageButtonStates();
				return;
			}

			const { boardMarkdown, ttsCommentary, chatText, actionSignal } = VyukaApp.parseGeminiResponse(rawText);
			let aiResponded = false;
            let cleanedChatText = "";
             if (typeof VyukaApp.cleanChatMessage === 'function') { 
                 cleanedChatText = VyukaApp.cleanChatMessage(chatText);
             } else { cleanedChatText = chatText.trim(); }

            console.log(`[ProcessGemini v26] Parsed-> Board: ${!!boardMarkdown}, TTS: ${!!ttsCommentary}, Chat: ${!!cleanedChatText}, Action: ${actionSignal}`);

            if (actionSignal === 'INITIATE_FINAL_QUIZ') {
                console.log("[ProcessGemini v26] AI initiated final quiz. Requesting quiz content...");
                aiResponded = true;
                state.finalQuizActive = true; // Set quiz active BEFORE requesting content
                // state.aiIsWaitingForAnswer is handled by manageUIState or after quiz display
                if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.disabled = true; // Explicitly disable here
                await VyukaApp.requestFinalQuiz(); // This will send a new prompt for quiz content
            }

			if (boardMarkdown) {
                 if (typeof VyukaApp.appendToWhiteboard === 'function') {
				    VyukaApp.appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                 } else { console.error("Error: VyukaApp.appendToWhiteboard not defined."); }
				aiResponded = true;
                
                if (actionSignal !== 'INITIATE_FINAL_QUIZ') { // Only set waiting if not a quiz action
                    const lowerBoard = boardMarkdown.toLowerCase();
                    const taskKeywords = ['úloha k řešení', 'vyřešte tento příklad', 'zodpovězte následující', 'úkol:', 'otázka k procvičení'];
                    const taskHeaderRegex = /###\s*(úloha|příklad k řešení|úkol|otázka)/i;
                    const zadaniEndsWithQuestion = /\*\*zadání:\*\*[\s\S]*\?$/i;
                    if (taskKeywords.some(kw => lowerBoard.includes(kw)) || taskHeaderRegex.test(boardMarkdown) || zadaniEndsWithQuestion.test(boardMarkdown.replace(/\s+/g, ' '))) {
                        state.aiIsWaitingForAnswer = true;
                        console.log("[ProcessGemini v26] Task DETECTED on board, setting aiIsWaitingForAnswer = true.");
                    } else {
                         state.aiIsWaitingForAnswer = false;
                         console.log("[ProcessGemini v26] No task detected on board, aiIsWaitingForAnswer = false.");
                    }
                }
			}

			if (cleanedChatText) {
				const ttsForChat = (!boardMarkdown && ttsCommentary && actionSignal !== 'INITIATE_FINAL_QUIZ') ? ttsCommentary : null;
				VyukaApp.addChatMessage(cleanedChatText, 'gemini', true, timestamp, ttsForChat, chatText);
				aiResponded = true;
			}

			if (!aiResponded && !actionSignal) {
                if (ttsCommentary) {
                    VyukaApp.addChatMessage(`(Komentář k tabuli: ${ttsCommentary})`, 'gemini', true, timestamp, ttsCommentary, `(Komentář: ${ttsCommentary})`);
                     aiResponded = true;
                } else {
				    VyukaApp.addChatMessage("(AI neodpovědělo očekávaným formátem nebo odpověď byla prázdná)", 'gemini', false, timestamp, null, rawText || "(Prázdná/neplatná odpověď)");
				    console.warn("AI sent no usable content and no action signal.");
                }
                state.aiIsWaitingForAnswer = false;
			}

            if (state.finalQuizActive && actionSignal !== 'INITIATE_FINAL_QUIZ') { // If quiz is active and this wasn't the signal to start it (i.e., this is the quiz content)
                VyukaApp.manageUIState('finalQuizInProgress');
                state.aiIsWaitingForAnswer = true; // Now AI waits for quiz answers
            } else if (state.aiIsWaitingForAnswer) {
                VyukaApp.manageUIState('waitingForAnswer');
            } else if (state.aiSuggestedCompletion) { // This state is deprecated but keep for now
                 VyukaApp.manageUIState('suggestedCompletion');
            } else if (actionSignal !== 'INITIATE_FINAL_QUIZ') { // If no quiz is active and no other state applies
                VyukaApp.manageUIState('learning');
            }
		};

        // Funkce VyukaApp.requestFinalQuiz zůstává stejná jako ve verzi v25
        VyukaApp.requestFinalQuiz = async () => {
            const state = VyukaApp.state;
            console.log("[RequestFinalQuiz v26] Requesting final quiz for topic:", state.currentTopic?.name);
            VyukaApp.updateGeminiThinkingState(true); // AI is thinking
            const prompt = VyukaApp._buildFinalQuizPrompt();
            // isFinalQuizRequest = true to use the specific model confirmation and context building
            await VyukaApp.sendToGemini(prompt, false, true); // isChatInteraction = false, isFinalQuizRequest = true
        };

        // --- PROMPTS (UPDATED for Mentor Mode, simplified "Nevím", refined quiz logic) ---
        VyukaApp._buildInitialPrompt = () => {
            const state = VyukaApp.state;
            const config = VyukaApp.config;
            const level = state.currentProfile?.skill_level || 'středně pokročilá';
            const topicName = state.currentTopic?.name || 'Neznámé téma';

            return `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. Tvé vysvětlení musí být strukturované, přesné a profesionální.
Téma lekce: "${topicName}".
Cílová úroveň studenta: "${level}".

HLAVNÍ PRAVIDLA (DODRŽUJ NAPROSTO VŽDY!):
1.  **Obsah na tabuli ([BOARD_MARKDOWN]):** Veškerý výukový obsah (definice, věty, vzorce, **MINIMÁLNĚ DVA ŘEŠENÉ PŘÍKLADY**, úlohy k řešení) patří VÝHRADNĚ sem. Používej Markdown a $$...$$ pro matematiku. Řešené příklady PŘED úlohami.
2.  **Hlasový komentář ([TTS_COMMENTARY]):** POUZE DOPLŇUJÍCÍ komentář k tabuli. NEOPAKUJ text z tabule.
3.  **Chat (Text mimo značky):** MINIMÁLNĚ. NIKDY nový obsah. JEN pro hodnocení odpovědi studenta NEBO VELMI krátkou PŘÍMOU odpověď na otázku.
4.  **Struktura a Náročnost:** Logicky, zvyšuj náročnost k úrovni přijímaček. VŽDY více řešených příkladů PŘED úlohou.
5.  **Interakce:**
    * Po zadání ÚLOHY K ŘEŠENÍ v [BOARD_MARKDOWN], v [TTS_COMMENTARY] **JASNĚ** řekni, že čekáš odpověď v chatu. Nic víc.
    * Po teorii/řešeném příkladu **NEČEKEJ na odpověď** a **NEPOKLÁDEJ otázky** ("Jasné?", "Pokračujeme?"). Student použije "Pokračovat".
6.  **Fokus na Téma:** STRIKTNĚ se drž tématu "${topicName}".
7.  **Navržení Dokončení Tématu:** Pokud je téma probráno (student odpovídá správně, klíčové koncepty a typy příkladů probrány), pošli **POUZE signál ${config.ACTION_INITIATE_FINAL_QUIZ}**. NIC JINÉHO. Systém pak vyžádá finální test.
8.  **Finální Test:** POKUD obdržíš explicitní požadavek "POŽADAVEK NA FINÁLNÍ TEST", vygeneruj 10 otázek (5 těžkých, 2 střední, 3 lehké) K TÉMATU ("${topicName}") do [BOARD_MARKDOWN]. Po vygenerování testu NIC DALŠÍHO NEDĚLEJ.
9.  **Reflektivní Otázky (Mentor Mode):** Po vysvětlení na tabuli můžeš do [TTS_COMMENTARY] nebo krátce do CHATU přidat otázku k zamyšlení. Pro ně NEPOUŽÍVEJ v TTS "čekám na odpověď".

PRVNÍ KROK:
Začni se ZÁKLADNÍ DEFINICÍ tématu "${topicName}". Poskytni **alespoň JEDEN ŘEŠENÝ PŘÍKLAD** (jednoduchý). VŠE DEJ DO [BOARD_MARKDOWN]:. Přidej krátký [TTS_COMMENTARY]:. NEPIŠ nic do chatu.

POŽADOVANÝ FORMÁT ODPOVĚDI (pro první krok):
[BOARD_MARKDOWN]:
\`\`\`markdown
## ${topicName} - Základy
### [Krátký, výstižný podnadpis]
(Definice/úvodní koncept. **Tučně** termíny, $$...$$ matematika.)
### První řešený příklad (Základní)
**Zadání:** ...
**Řešení:**
* Krok 1: ... ($$...$$)
* Krok 2: ... ($$...$$)
* Výsledek: $$...$$
\`\`\`
[TTS_COMMENTARY]:
(Stručné představení tématu a shrnutí obsahu tabule. NEPOKLÁDEJ OTÁZKU.)
`;
        };

    	VyukaApp._buildContinuePrompt = () => {
            const state = VyukaApp.state;
            const config = VyukaApp.config;
			const level = state.currentProfile?.skill_level || 'středně pokročilá';
			const topicName = state.currentTopic?.name || 'Neznámé téma';

			return `Pokračuj ve výkladu tématu "${topicName}" pro studenta úrovně "${level}" (příprava na přijímačky 9. třídy). Naváž logicky na PŘEDCHOZÍ OBSAH NA TABULI.

HLAVNÍ PRAVIDLA (PŘIPOMENUTÍ!):
* Všechny NOVÉ informace, **VÍCE ŘEŠENÝCH PŘÍKLADŮ** a ÚLOHY K ŘEŠENÍ patří VÝHRADNĚ do [BOARD_MARKDOWN].
* [TTS_COMMENTARY]: použij POUZE pro DOPLNĚNÍ k tabuli.
* Chat (mimo značky): NEPOUŽÍVEJ pro nový obsah.
* STRIKTNĚ se drž tématu "${topicName}".
* Zvyšuj náročnost. **Vždy ŘEŠENÉ příklady PŘED úlohou pro studenta.**
* Po zadání ÚLOHY v [BOARD_MARKDOWN], v [TTS_COMMENTARY] **JASNĚ řekni, že čekáš odpověď** v chatu.
* Po teorii/řešeném příkladu **NEČEKEJ** a **NEPOKLÁDEJ otázky**. Student použije "Pokračovat".
* **Reflektivní Otázky (Mentor Mode):** Můžeš přidat krátkou otázku k zamyšlení. Pro ně NEPOUŽÍVEJ v [TTS_COMMENTARY] frázi "čekám na odpověď".
* Pokud je téma probráno -> pošli **POUZE** signál **${config.ACTION_INITIATE_FINAL_QUIZ}**.

DALŠÍ KROK: Vyber JEDEN z následujících (nebo ${config.ACTION_INITIATE_FINAL_QUIZ}):
A) Další část teorie/vysvětlení -> do [BOARD_MARKDOWN].
B) **Několik (alespoň 2) dalších ŘEŠENÝCH příkladů** (složitější) -> do [BOARD_MARKDOWN].
C) ÚLOHU K ŘEŠENÍ pro studenta (úroveň přijímaček, až PO dostatku řešených) -> do [BOARD_MARKDOWN].

POŽADOVANÝ FORMÁT ODPOVĚDI (Pokud NEPOSÍLÁŠ signál ${config.ACTION_INITIATE_FINAL_QUIZ}):
[BOARD_MARKDOWN]:
\`\`\`markdown
### [Nadpis další části / Řešené příklady (Typ) / Úloha k řešení (Typ)]
(Text vysvětlení NEBO zadání a PODROBNÁ řešení příkladů NEBO POUZE ZADÁNÍ úlohy k řešení.)
\`\`\`
[TTS_COMMENTARY]:
(Hlasový komentář. Pokud ÚLOHA, **řekni:** "Nyní zkuste tuto úlohu vyřešit vy a napište mi výsledek/postup do chatu." Jinak stručně shrň. **NEPOKLÁDEJ OTÁZKU typu 'Je to jasné?'.**)
`;
		};

        VyukaApp._buildFinalQuizPrompt = () => {
            const state = VyukaApp.state;
            const topicName = state.currentTopic?.name || 'Neznámé téma';

            return `Toto je POŽADAVEK NA FINÁLNÍ TEST.
Student dokončil probírání tématu "${topicName}". Vygeneruj FINÁLNÍ TEST pro ověření znalostí tohoto tématu.
Požadovaná struktura testu:
- Celkem 10 otázek.
- 3 lehké otázky (obtížnost 1-2/5)
- 2 středně těžké otázky (obtížnost 3/5)
- 5 těžkých otázek (obtížnost 4-5/5)
Všechny otázky musí být K TOMUTO KONKRÉTNÍMU TÉMATU: "${topicName}".
U každé otázky uveď její typ (např. multiple_choice, numeric, text) a správnou odpověď.
Celý test formátuj POUZE pro výstup do [BOARD_MARKDOWN]:. NEPOUŽÍVEJ [TTS_COMMENTARY] ani text do chatu. Začni s nadpisem "## Závěrečný Test: ${topicName}".
Po vygenerování testu v [BOARD_MARKDOWN] NIC DALŠÍHO NEDĚLEJ, nepiš do chatu, nečekej na odpověď. Student bude odpovídat na otázky testu postupně v chatu. Ty budeš hodnotit každou odpověď zvlášť.
Příklad formátu otázky v Markdownu (přizpůsob podle typu otázky):
### Otázka 1 (Lehká) - Typ: multiple_choice
Text otázky...
A) Možnost A
B) Možnost B
C) Možnost C
**Správná odpověď:** B

### Otázka X (Těžká) - Typ: numeric
Text otázky...
**Správná odpověď:** 42
`;
        };

    	VyukaApp._buildChatInteractionPrompt = (userText) => {
			const state = VyukaApp.state;
            const config = VyukaApp.config;
			const topicName = state.currentTopic?.name || 'Neznámé téma';
            let baseInstruction;

            const isNevim = /\b(nevím|neviem|netuším|pomoc|nevim|nechapu|nerozumim|help|co s tim)\b/i.test(userText.toLowerCase());

            if (state.finalQuizActive) {
                baseInstruction = `Student odpovídá na otázku z FINÁLNÍHO TESTU k tématu "${topicName}". Studentova odpověď na poslední otázku testu je: "${userText}".
TVŮJ ÚKOL (ODPOVĚĎ POUZE DO CHATU):
1.  Stručně vyhodnoť odpověď studenta.
2.  Pokud je nesprávná, poskytni krátké navedení nebo vysvětlení.
3.  NEPOKLÁDEJ ŽÁDNÉ DALŠÍ OTÁZKY. Jen potvrď/oprav odpověď. Počkej na odpověď studenta na DALŠÍ otázku testu.
4.  Až student odpoví na VŠECH 10 otázek testu, vyhodnoť poslední odpověď a pak místo dalšího textu pošli signál ${config.ACTION_INITIATE_FINAL_QUIZ} (protože původní signál znamenal jen to, že AI je připraveno dát test, nyní finální signál znamená že test je opravdu u konce).`;
            } else if (state.aiIsWaitingForAnswer) {
                if (isNevim) {
                    baseInstruction = `Student odpověděl 'Nevím' (nebo podobně) na POSLEDNÍ úlohu zadanou na tabuli k tématu "${topicName}".
TVŮJ ÚKOL:
1.  Ukaž ŘEŠENÍ a PODROBNÉ VYSVĚTLENÍ této úlohy na [BOARD_MARKDOWN].
2.  Do [TTS_COMMENTARY] stručně shrň řešení.
3.  Do CHATU (mimo značky) NAPIŠ POUZE: 'Řešení je na tabuli.'
4.  NEPOKLÁDEJ ŽÁDNOU DALŠÍ OTÁZKU V CHATU. Po tvé odpovědi bude uživateli AKTIVOVÁNA klávesa "Pokračovat". UKONČI svou odpověď.`;
                } else {
                    baseInstruction = `Student poskytl odpověď na POSLEDNÍ úlohu zadanou na tabuli k tématu "${topicName}". Studentova odpověď je: "${userText}".
TVŮJ ÚKOL (ODPOVĚĎ POUZE DO CHATU):
1.  **NEJPRVE ZCELA KONKRÉTNĚ vyhodnoť správnost TÉTO studentovy odpovědi ('${userText}')**.
2.  Pokud je nesprávná/neúplná: **Jasně vysvětli chybu** a uveď správný postup/výsledek.
3.  Pokud je správná: **Krátce pochval (např. 'Správně!', 'Výborně!').**
4.  **Tato odpověď v chatu NESMÍ obsahovat nové definice, příklady ani zadání úloh.**
5.  **NAPROSTO NEPOKLÁDEJ ŽÁDNÉ DALŠÍ OTÁZKY.** Po tvé odpovědi bude uživateli aktivována klávesa "Pokračovat".
6.  **UKONČI svou odpověď ZDE.** Další krok zahájí student.`;
                }
			} else { // User asks a general question or for simpler explanation
                const isSimplerExplanationRequest = /\b(nerozumím|vysvětli jednodušeji|moc složité|полегче|jednodušeji|explain simpler|explain it simpler|i don't understand|too complicated)\b/i.test(userText.toLowerCase());
                const isSpecificQuestionAboutBoard = /\b(proč|jak|k čemu|co znamená|what does|why is|how did you get)\b/i.test(userText.toLowerCase()) && /\b(tabuli|tam|vzorec|krok|číslo|board|formula|step|number)\b/i.test(userText.toLowerCase());

                if (isSimplerExplanationRequest) {
                    baseInstruction = `Student žádá o jednodušší vysvětlení AKTUALNÍHO obsahu na tabuli nebo posledního konceptu. Student napsal: "${userText}".
TVŮJ ÚKOL:
1.  Poskytni ZJEDNODUŠENÉ vysvětlení daného konceptu/příkladu na [BOARD_MARKDOWN].
2.  Do [TTS_COMMENTARY] stručně shrň toto zjednodušené vysvětlení.
3.  Do CHATU napiš POUZE: 'Dobře, zkusím to vysvětlit jednodušeji na tabuli.' NIC VÍC.
4.  Po tvé odpovědi bude uživateli aktivována klávesa "Pokračovat".`;
                } else if (isSpecificQuestionAboutBoard) {
                     baseInstruction = `Student má konkrétní otázku k OBSAHU NA TABULI: "${userText}".
TVŮJ ÚKOL:
1.  Odpověz na otázku PŘÍMO. Pokud je odpověď delší nebo vyžaduje nový příklad/doplnění, dej ji na [BOARD_MARKDOWN] jako doplňující sekci k aktuálnímu tématu.
2.  V [TTS_COMMENTARY] stručně shrň odpověď/upřesnění.
3.  Do CHATU napiš POUZE: 'Odpověď/Upřesnění je na tabuli.' NEBO (pokud je odpověď VELMI krátká a vejde se do chatu bez nového obsahu) 'Krátká odpověď na tvou otázku: [tvá krátká odpověď].'
4.  NIC VÍC. Po tvé odpovědi bude uživateli aktivována klávesa "Pokračovat".`;
                } else { // General comment or question not fitting above
                    baseInstruction = `Student položil otázku nebo komentář k probíranému tématu "${topicName}": "${userText}".
TVŮJ ÚKOL (ODPOVĚĎ POUZE DO CHATU):
1.  **Odpověz stručně a PŘÍMO k dotazu/komentáři studenta.** Využij kontext toho, co je aktuálně na TABULI.
2.  **NEVYSVĚTLUJ novou látku** ani nezadávej nové příklady/úlohy v chatu.
3.  **Pokud dotaz směřuje MIMO aktuální téma "${topicName}", jemně ho vrať zpět.**
4.  **Tato odpověď v chatu NESMÍ obsahovat nové definice, příklady ani zadání úloh.**
5.  **Na konci své odpovědi NEPOKLÁDEJ otázky typu "Stačí takto?". Odpověz POUZE na otázku/komentář a IHNED SKONČI.** Po tvé odpovědi bude uživateli aktivována klávesa "Pokračovat".`;
                }
			}
			return `${baseInstruction}

PŘIPOMENUTÍ PRAVIDEL CHATU: Odpovídej POUZE běžným textem do chatu. Nepoužívej [BOARD_MARKDOWN] ani [TTS_COMMENTARY]. Buď stručný a věcný.`;
		};

        VyukaApp._buildGeminiPayloadContents = (userPrompt, isChatInteraction = false, isFinalQuizRequest = false) => {
			const state = VyukaApp.state;
			const config = VyukaApp.config;
			const topicName = state.currentTopic?.name || 'Neznámé téma';
            // SYSTEM INSTRUCTION - POSÍLENO PRAVIDLO O FINÁLNÍM TESTU
            const systemInstruction = `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. NAPROSTO VŽDY dodržuj tato pravidla:
1.  **[BOARD_MARKDOWN]:** Veškerý výukový obsah (definice, vzorce, vysvětlení, **VÍCE ŘEŠENÝCH PŘÍKLADŮ**, úlohy k řešení) patří VÝHRADNĚ sem: \`\`\`markdown ... \`\`\`. Používej Markdown a $$...$$ pro matematiku. Řešené příklady PŘED úlohami.
2.  **[TTS_COMMENTARY]:** Použij POUZE pro DOPLNĚNÍ k tabuli, NEOPAKUJ text doslova.
3.  **Chat (Text mimo značky):** Použij MINIMÁLNĚ. POUZE pro hodnocení odpovědi studenta NEBO VELMI krátkou PŘÍMOU odpověď na otázku (pokud se nejedná o nové vysvětlení, které patří na tabuli). NIKDY nový výukový obsah. NEPIŠ pozdravy ani zbytečné fráze.
4.  **Struktura a Náročnost:** Postupuj logicky, zvyšuj náročnost úloh k úrovni PŘIJÍMAČEK 9. třídy. **Vždy VÍCE řešených příkladů PŘED úlohou pro studenta.**
5.  **Interakce:**
    * Po zadání ÚLOHY K ŘEŠENÍ na tabuli, v [TTS_COMMENTARY] **JASNĚ řekni, že čekáš na odpověď studenta v chatu.** Nic víc.
    * Po teorii/řešeném příkladu (pokud student nepoložil otázku) **NEČEKEJ na odpověď** a **NEPOKLÁDEJ otázky** ("Jasné?", "Pokračujeme?"). Student použije "Pokračovat".
6.  **Fokus na Téma:** **STRIKTNĚ se drž tématu lekce: "${topicName}".**
7.  **Odpovědi v chatu:** Pokud student ODPOVÍDÁ na úlohu nebo POKLÁDÁ OTÁZKU, odpovídej POUZE textem do CHATU podle instrukcí v uživatelském promptu. Po správné odpovědi studenta JEN potvrď a UKONČI odpověď. **Když odpovídáš na otázku studenta, odpověz PŘÍMO a ihned SKONČI. NIKDY nekonči otázkami jako "Stačí takto?".**
8.  **Reflektivní Otázky (Mentor Mode):** Po vysvětlení na tabuli můžeš do [TTS_COMMENTARY] nebo krátce do CHATU přidat otázku k zamyšlení. Pro ně NEPOUŽÍVEJ v TTS "čekám na odpověď".
9.  **Navržení Dokončení Tématu:** Když je téma probráno (student odpovídá správně, klíčové koncepty a typy příkladů probrány), pošli **POUZE signál ${config.ACTION_INITIATE_FINAL_QUIZ}**. NIC JINÉHO. Systém pak vyžádá finální test.
10. **Finální Test:** POKUD obdržíš explicitní požadavek **IDENTIFIKOVANÝ jako 'POŽADAVEK NA FINÁLNÍ TEST'**, vygeneruj 10 otázek (5 těžkých, 2 střední, 3 lehké) K TÉMATU ("${topicName}") do [BOARD_MARKDOWN]. Po vygenerování testu NIC DALŠÍHO NEDĚLEJ. V opačném případě NIKDY negeneruj obsah finálního testu sám od sebe.`;

            let modelConfirmation = `Rozumím. Budu striktně dodržovat pravidla. Obsah pro tabuli pouze v [BOARD_MARKDOWN]:. Komentář pouze v [TTS_COMMENTARY]:. Chat (mimo značky) jen pro hodnocení nebo velmi krátkou přímou odpověď na otázku. Budu se držet tématu "${topicName}" a zvyšovat náročnost pro úroveň 9. třídy. Nebudu pokládat zbytečné otázky. Mohu položit reflektivní otázku, na kterou student nemusí explicitně odpovídat. Pokud usoudím, že téma je probráno, pošlu signál ${config.ACTION_INITIATE_FINAL_QUIZ}. Pokud budu explicitně požádán o finální test pomocí fráze "POŽADAVEK NA FINÁLNÍ TEST", dodám ho v [BOARD_MARKDOWN] a nic víc.`;
            if (isFinalQuizRequest) {
                 modelConfirmation = `Rozumím. Připravuji finální test k tématu "${topicName}" s 10 otázkami (5 těžkých, 2 střední, 3 lehké) ve formátu [BOARD_MARKDOWN]. Nebudu poskytovat [TTS_COMMENTARY] ani text do chatu.`;
            }

			const history = state.geminiChatContext.slice(-config.MAX_GEMINI_HISTORY_TURNS * 2);
			const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };
			const contents = [
				{ role: "user", parts: [{ text: systemInstruction }] },
				{ role: "model", parts: [{ text: modelConfirmation }] },
				...history,
				currentUserMessage
			];
			return contents;
		};

    	VyukaApp.sendToGemini = async (prompt, isChatInteraction = false, isFinalQuizRequest = false) => {
			const config = VyukaApp.config;
			const state = VyukaApp.state;
            let requestError = null;

			if (!config.GEMINI_API_KEY || !config.GEMINI_API_KEY.startsWith('AIzaSy')) { VyukaApp.showToast("Chyba Konfigurace", "Chybí API klíč pro AI.", "error"); VyukaApp.updateGeminiThinkingState(false); return; }
            if (!state.currentTopic) { VyukaApp.showToast("Chyba", "Není vybráno téma.", "error"); VyukaApp.updateGeminiThinkingState(false); return; }
			if (!navigator.onLine) { VyukaApp.showToast("Offline", "Nelze komunikovat s AI bez připojení.", "warning"); VyukaApp.updateGeminiThinkingState(false); return; }

			console.log(`Sending to Gemini (Chat: ${isChatInteraction}, QuizReq: ${isFinalQuizRequest}): "${prompt.substring(0, 80)}..."`);
			const timestamp = new Date();
			VyukaApp.updateGeminiThinkingState(true);

			const contents = VyukaApp._buildGeminiPayloadContents(prompt, isChatInteraction, isFinalQuizRequest);
			const body = {
				contents,
				generationConfig: { temperature: isFinalQuizRequest ? 0.3 : 0.55, topP: 0.95, topK: 40, maxOutputTokens: 8192, },
				safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ]
			};

			try {
				const response = await fetch(config.GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
				if (!response.ok) { let errorText = `Chyba API (${response.status})`; try { const errData = await response.json(); errorText += `: ${errData?.error?.message || 'Neznámá chyba'}`; } catch (e) { errorText += `: ${await response.text()}`; } throw new Error(errorText); }
				const data = await response.json();
                console.log("[DEBUG v26] Raw Gemini Response Data:", JSON.stringify(data, null, 2));
				if (data.promptFeedback?.blockReason) { throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}.`); }
				const candidate = data.candidates?.[0];
				if (!candidate) { throw new Error('AI neposkytlo platnou odpověď (no candidate).'); }
                if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) { if (candidate.finishReason === 'SAFETY') throw new Error('Odpověď blokována bezpečnostním filtrem AI.'); if (!candidate.content?.parts?.[0]?.text) { throw new Error(`Generování zastaveno: ${candidate.finishReason}.`);} }
				const text = candidate.content?.parts?.[0]?.text;
                if (!text && candidate.finishReason !== 'STOP') { if (candidate.finishReason === 'MAX_TOKENS') { throw new Error('Odpověď AI byla příliš dlouhá (Max Tokens).'); } else { throw new Error('AI vrátilo prázdnou odpověď (Důvod: '+(candidate.finishReason || 'Neznámý')+').');}}
				state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] });
				state.geminiChatContext.push({ role: "model", parts: [{ text: text || "" }] });
				if (state.geminiChatContext.length > config.MAX_GEMINI_HISTORY_TURNS * 2 + 2) { state.geminiChatContext.splice(2, state.geminiChatContext.length - (config.MAX_GEMINI_HISTORY_TURNS * 2 + 2)); }
				await VyukaApp.processGeminiResponse(text || "", timestamp, isFinalQuizRequest); // Přidán isFinalQuizRequest
			} catch (error) {
                requestError = error; console.error('Chyba komunikace s Gemini:', error); console.error('Error stack:', error.stack); VyukaApp.showToast(`Chyba AI: ${error.message}`, "error"); VyukaApp.handleGeminiError(error.message, timestamp);
			} finally { VyukaApp.updateGeminiThinkingState(false); VyukaApp.manageButtonStates(); }
		};

        // Změněno processGeminiResponse pro lepší handling finálního testu
        VyukaApp.processGeminiResponse = async (rawText, timestamp, wasFinalQuizRequest = false) => {
            const state = VyukaApp.state;
            VyukaApp.removeThinkingIndicator();
            state.lastInteractionTime = Date.now();
            console.log(`[ProcessGemini v26] Processing (wasFinalQuizRequest: ${wasFinalQuizRequest}):`, rawText ? rawText.substring(0, 100) + "..." : "Empty");

            if (!rawText && !wasFinalQuizRequest) { // Pokud to není odpověď na žádost o test a je prázdná
                VyukaApp.handleGeminiError("AI vrátilo prázdnou odpověď.", timestamp);
                VyukaApp.manageButtonStates();
                return;
            }

            const { boardMarkdown, ttsCommentary, chatText, actionSignal } = VyukaApp.parseGeminiResponse(rawText);
            let aiResponded = false;
            let cleanedChatText = "";
            if (typeof VyukaApp.cleanChatMessage === 'function') { cleanedChatText = VyukaApp.cleanChatMessage(chatText); }
            else { cleanedChatText = chatText.trim(); }

            console.log(`[ProcessGemini v26] Parsed-> Board: ${!!boardMarkdown}, TTS: ${!!ttsCommentary}, Chat: ${!!cleanedChatText}, Action: ${actionSignal}`);

            if (actionSignal === 'INITIATE_FINAL_QUIZ') {
                console.log("[ProcessGemini v26] AI initiated final quiz. Requesting quiz content...");
                aiResponded = true;
                state.finalQuizActive = true;
                state.aiIsWaitingForAnswer = false; // AI zatím nečeká na odpověď na kvízovou otázku
                if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.style.display = 'none'; // Skryjeme Pokračovat
                VyukaApp.manageUIState('requestingFinalQuiz'); // UI ukáže, že se načítá test
                await VyukaApp.requestFinalQuiz(); // Pošle prompt pro generování obsahu testu
                return; // Zde končíme zpracování této odpovědi, čekáme na obsah testu
            }

            if (wasFinalQuizRequest) { // Toto je odpověď na náš požadavek na finální test
                console.log("[ProcessGemini v26] Processing AI's response containing final quiz content.");
                if (boardMarkdown) {
                    if (typeof VyukaApp.appendToWhiteboard === 'function') {
                        VyukaApp.appendToWhiteboard(boardMarkdown, "Závěrečný test je připraven na tabuli. Odpovězte na první otázku do chatu.");
                    }
                    aiResponded = true;
                    state.aiIsWaitingForAnswer = true; // Nyní AI čeká na odpověď na první kvízovou otázku
                    VyukaApp.manageUIState('finalQuizInProgress');
                } else {
                    console.error("[ProcessGemini v26] AI did not provide board markdown for the final quiz!");
                    VyukaApp.handleGeminiError("AI neposkytlo obsah finálního testu.", timestamp);
                }
            } else { // Běžné zpracování odpovědi (ne finální test)
                if (boardMarkdown) {
                    if (typeof VyukaApp.appendToWhiteboard === 'function') {
                        VyukaApp.appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                    }
                    aiResponded = true;
                    const lowerBoard = boardMarkdown.toLowerCase();
                    const taskKeywords = ['úloha k řešení', 'vyřešte tento příklad', 'zodpovězte následující', 'úkol:', 'otázka k procvičení'];
                    const taskHeaderRegex = /###\s*(úloha|příklad k řešení|úkol|otázka)/i;
                    const zadaniEndsWithQuestion = /\*\*zadání:\*\*[\s\S]*\?$/i;
                    if (taskKeywords.some(kw => lowerBoard.includes(kw)) || taskHeaderRegex.test(boardMarkdown) || zadaniEndsWithQuestion.test(boardMarkdown.replace(/\s+/g, ' '))) {
                        state.aiIsWaitingForAnswer = true;
                        console.log("[ProcessGemini v26] Task DETECTED on board, setting aiIsWaitingForAnswer = true.");
                    } else {
                        state.aiIsWaitingForAnswer = false;
                        console.log("[ProcessGemini v26] No task detected on board, aiIsWaitingForAnswer = false.");
                    }
                }

                if (cleanedChatText) {
                    const ttsForChat = (!boardMarkdown && ttsCommentary) ? ttsCommentary : null;
                    VyukaApp.addChatMessage(cleanedChatText, 'gemini', true, timestamp, ttsForChat, chatText);
                    aiResponded = true;
                }

                if (!aiResponded) {
                    if (ttsCommentary) {
                        VyukaApp.addChatMessage(`(Komentář k tabuli: ${ttsCommentary})`, 'gemini', true, timestamp, ttsCommentary, `(Komentář: ${ttsCommentary})`);
                    } else {
                        VyukaApp.addChatMessage("(AI neodpovědělo očekávaným formátem nebo odpověď byla prázdná)", 'gemini', false, timestamp, null, rawText || "(Prázdná/neplatná odpověď)");
                        console.warn("AI sent no usable content and no action signal.");
                    }
                    state.aiIsWaitingForAnswer = false;
                }

                if (state.aiIsWaitingForAnswer) {
                    VyukaApp.manageUIState('waitingForAnswer');
                } else {
                    VyukaApp.manageUIState('learning');
                }
            }
        };


    	VyukaApp.handleGeminiError = (msg, time) => {
			const state = VyukaApp.state;
			VyukaApp.removeThinkingIndicator();
			VyukaApp.addChatMessage(`Nastala chyba při komunikaci s AI: ${msg}`, 'gemini', false, time, null, `(Chyba: ${msg})`);
            state.aiIsWaitingForAnswer = false; // Ujistíme se, že nečekáme na odpověď
            state.finalQuizActive = false; // Pro jistotu vypneme quiz mode
            VyukaApp.manageUIState('learning'); // Vrátíme se do běžného stavu učení
		};

	} catch (e) {
		console.error("FATAL SCRIPT ERROR (AI Interaction v26):", e);
		document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--vyuka-accent-error,#FF4757);color:var(--vyuka-text-primary,#E0E7FF);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky (AI Interaction).</p><p style="margin-top:15px;"><a href="#" onclick="location.reload()" style="color:var(--vyuka-accent-secondary,#00F5FF); text-decoration:underline; font-weight:bold;">Obnovit stránku</a></p><details style="margin-top: 20px; color: #f0f0f0;"><summary style="cursor:pointer; color: var(--vyuka-text-primary,#E0E7FF);">Detaily</summary><pre style="margin-top:10px;padding:15px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;max-height:300px; overflow-y:auto; border-radius:8px;">${e.message}\n${e.stack}</pre></details></div>`;
	}

})(window.VyukaApp);