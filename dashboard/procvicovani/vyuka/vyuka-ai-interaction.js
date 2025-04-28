// Файл: procvicovani/vyuka/vyuka-ai-interaction.js
// Логика взаимодействия с AI Gemini, управление чатом, учебной сессией, парсинг ответов AI
// Версия с улучшенными промптами и проверкой ответа

// Получаем доступ к глобальному пространству имен
window.VyukaApp = window.VyukaApp || {};

(function(VyukaApp) { // Используем IIFE для локальной области видимости, передаем VyukaApp
	'use strict';

	try {
		// --- Constants & Configuration (AI Interaction Specific) ---
		const config = VyukaApp.config = VyukaApp.config || {};
		config.GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // !!! Production: Use a secure method !!!
		config.GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;
		config.MAX_GEMINI_HISTORY_TURNS = 12;
        config.ACTION_SUGGEST_COMPLETION = "[ACTION:SUGGEST_COMPLETION]";

        // --- Topic Loading and Progress ---
        VyukaApp.loadNextUncompletedTopic = async () => {
			const state = VyukaApp.state;
			const ui = VyukaApp.ui;
			if (!state.currentUser || state.topicLoadInProgress || !state.supabase) return;

			state.topicLoadInProgress = true;
			VyukaApp.setLoadingState('currentTopic', true);
			state.currentTopic = null;
            state.aiSuggestedCompletion = false;

			if (ui.chatMessages) { ui.chatMessages.innerHTML = ''; }
            if (typeof VyukaApp.clearWhiteboard === 'function') {
			    VyukaApp.clearWhiteboard(false);
            } else { console.error("Error: VyukaApp.clearWhiteboard not defined"); }
			state.geminiChatContext = [];
            state.aiIsWaitingForAnswer = false;

			VyukaApp.manageUIState('loadingTopic');

			try {
				// 1. Find the active study plan
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

				// 2. Find the next uncompleted activity in the plan
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

					// 3. Optionally fetch more topic details if topic_id exists
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
							console.warn("Could not fetch topic details:", e);
						}
					}

					// 4. Set the current topic state
					state.currentTopic = {
						activity_id: activity.id,
						plan_id: state.currentPlanId,
						name: name,
						description: desc,
						user_id: state.currentUser.id,
						topic_id: activity.topic_id
					};

					// Update UI with the topic name
					if (ui.currentTopicDisplay) {
						ui.currentTopicDisplay.innerHTML = `Téma: <strong>${VyukaApp.sanitizeHTML(name)}</strong>`;
					}

					// 5. Start the AI learning session for this topic
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

		VyukaApp.handleMarkTopicComplete = async () => {
			const state = VyukaApp.state;
			const config = VyukaApp.config;
			const ui = VyukaApp.ui;

			if (!state.currentTopic || !state.currentTopic.activity_id) {
				 console.error("[MarkComplete v22] Error: Missing currentTopic or activity_id in state.", state.currentTopic);
				 VyukaApp.showToast("Chyba: Chybí informace o aktuálním tématu.", "error");
				 return;
			}
			if (!state.supabase) {
				 console.error("[MarkComplete v22] Error: Supabase client not available.");
				 VyukaApp.showToast("Chyba: Databáze není dostupná.", "error");
				 return;
			}
			 if (state.topicLoadInProgress) {
				  console.warn("[MarkComplete v22] Blocked: Topic operation already in progress.");
				  return;
			 }

			console.log(`[MarkComplete v22] Attempting to mark activity ID: ${state.currentTopic.activity_id} (${state.currentTopic.name}) as complete.`);
			state.topicLoadInProgress = true;
			state.aiSuggestedCompletion = false;
			VyukaApp.manageButtonStates();

			try {
				console.log(`[MarkComplete v22] Preparing to update activity ID: ${state.currentTopic.activity_id} in plan ID: ${state.currentTopic.plan_id}`);
				console.log(`[MarkComplete v22] Points to award: ${config.POINTS_TOPIC_COMPLETE}`);

				const { error: updateError } = await state.supabase
					.from('plan_activities')
					.update({ completed: true, updated_at: new Date().toISOString() })
					.eq('id', state.currentTopic.activity_id);

				if (updateError) {
					 console.error(`[MarkComplete v22] Supabase update FAILED for activity ${state.currentTopic.activity_id}:`, updateError);
					 throw updateError;
				}
				console.log(`[MarkComplete v22] >>> DB UPDATE SUCCESS for activity ${state.currentTopic.activity_id} <<<`);

                 if (typeof VyukaApp.awardPoints === 'function') {
				    await VyukaApp.awardPoints(config.POINTS_TOPIC_COMPLETE);
                 } else { console.error("Error: VyukaApp.awardPoints not defined."); }

				if (typeof VyukaApp.checkAndAwardAchievements === 'function') {
					await VyukaApp.checkAndAwardAchievements(state.currentUser.id);
				} else {
					console.warn("[MarkComplete v22] Achievement checking function not found.");
				}

				VyukaApp.showToast(`Téma "${state.currentTopic.name}" dokončeno! Přesměrovávám...`, "success", 2500);

                console.log("[MarkComplete v22] Scheduling redirect after success.");
				setTimeout(() => {
                     console.log("[MarkComplete v22] Redirecting now...");
                     window.location.href = '/dashboard/procvicovani/main.html';
                 }, 500);

			} catch (error) {
				console.error(`[MarkComplete v22] CATCH BLOCK: Error during topic completion (Activity ID: ${state.currentTopic?.activity_id}):`, error);
				VyukaApp.showToast(`Chyba uložení dokončení tématu: ${error.message || 'Neznámá chyba'}`, "error", 6000);
				state.topicLoadInProgress = false;
				VyukaApp.manageButtonStates();
			}
		};

        // --- Learning Session & Chat ---
        VyukaApp.startLearningSession = async () => {
			const state = VyukaApp.state;
			if (!state.currentTopic) return;

			state.currentSessionId = VyukaApp.generateSessionId();
			VyukaApp.clearInitialChatState();

			VyukaApp.manageUIState('requestingExplanation');

			const prompt = VyukaApp._buildInitialPrompt();
			await VyukaApp.sendToGemini(prompt);
		};

    	VyukaApp.requestContinue = async () => {
			const state = VyukaApp.state;
			console.log("[RequestContinue] Triggered. AI Waiting:", state.aiIsWaitingForAnswer, "AI Suggested Completion:", state.aiSuggestedCompletion);
			if (state.geminiIsThinking || !state.currentTopic) return;

			if (state.aiIsWaitingForAnswer) {
				VyukaApp.showToast("Nejprve odpovězte na úlohu v chatu.", "warning", 3000);
				console.warn("[RequestContinue] Blocked: AI is waiting for an answer.");
				return;
			}

            if (state.aiSuggestedCompletion) {
                VyukaApp.showToast("AI navrhlo dokončení tématu. Pro dokončení použijte modální okno nebo požádejte AI o pokračování.", "info");
                return;
            }

			const prompt = VyukaApp._buildContinuePrompt();
			await VyukaApp.sendToGemini(prompt);
		};

    	VyukaApp.addChatMessage = async (displayMessage, sender, saveToDb = true, timestamp = new Date(), ttsText = null, originalContent = null) => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;
			if (!ui.chatMessages) return;

			VyukaApp.clearInitialChatState();

			const id = `msg-${Date.now()}`;
			let avatarContent = sender === 'user'
				? VyukaApp.getInitials(state.currentProfile, state.currentUser?.email)
				: 'AI';

			const div = document.createElement('div');
			div.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`;
			div.id = id;
			div.style.opacity = '0';

			const avatarDiv = `<div class="message-avatar">${avatarContent}</div>`;

			const bubbleDiv = document.createElement('div');
			bubbleDiv.className = 'message-bubble';

			const bubbleContentDiv = document.createElement('div');
			bubbleContentDiv.className = 'message-bubble-content';

            // Use renderMarkdown (now modified in core)
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
					    VyukaApp.speakText(text);
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

            // MathJax triggering (kept from before)
			if (window.MathJax && typeof window.MathJax.typesetPromise === 'function' && (displayMessage.includes('$') || displayMessage.includes('\\'))) {
                console.log(`[MathJax v19] Queueing typeset for chat message bubble: ${id}`);
				setTimeout(() => {
					window.MathJax.typesetPromise([bubbleContentDiv])
						.then(() => console.log(`[MathJax v19] Typeset successful for chat bubble ${id}`))
						.catch((err) => console.error(`[MathJax v19] Typeset error for chat bubble ${id}: ${err.message}`));
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

        VyukaApp.addThinkingIndicator = () => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;
			if (state.thinkingIndicatorId || !ui.chatMessages) return;

			VyukaApp.clearInitialChatState();

			const id = `thinking-${Date.now()}`;
			const div = document.createElement('div');
			div.className = 'chat-message model';
			div.id = id;
			div.innerHTML = `
				<div class="message-avatar">AI</div>
				<div class="message-thinking-indicator">
					<span class="typing-dot"></span>
					<span class="typing-dot"></span>
					<span class="typing-dot"></span>
				</div>
			`;
			ui.chatMessages.appendChild(div);
			div.scrollIntoView({ behavior: 'smooth', block: 'end' });
			state.thinkingIndicatorId = id;
            VyukaApp.manageButtonStates();
		};

    	VyukaApp.removeThinkingIndicator = () => {
			const state = VyukaApp.state;
			if (state.thinkingIndicatorId) {
				document.getElementById(state.thinkingIndicatorId)?.remove();
				state.thinkingIndicatorId = null;
			}
		};

    	VyukaApp.updateGeminiThinkingState = (isThinking) => {
			const state = VyukaApp.state;
			const ui = VyukaApp.ui;
			state.geminiIsThinking = isThinking;
			VyukaApp.setLoadingState('chat', isThinking);
			ui.aiAvatarCorner?.classList.toggle('thinking', isThinking);
            if (!isThinking) ui.aiAvatarCorner?.classList.remove('speaking');

			if (isThinking) {
				VyukaApp.addThinkingIndicator();
			} else {
				VyukaApp.removeThinkingIndicator();
			}
		};

    	VyukaApp.handleSendMessage = async () => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;
			const text = ui.chatInput?.value.trim();

			if (!text || state.geminiIsThinking || !state.currentTopic || state.isListening) return;

            state.lastInteractionTime = Date.now();
            state.aiSuggestedCompletion = false;

            if (state.aiIsWaitingForAnswer) {
                console.log("[HandleSend] Resetting aiIsWaitingForAnswer state.");
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
			let promptForGemini = VyukaApp._buildChatInteractionPrompt(text);
			await VyukaApp.sendToGemini(promptForGemini, true); // isChatInteraction = true
		};

    	VyukaApp.confirmClearChat = () => {
			if (confirm("Opravdu vymazat historii této konverzace? Tato akce je nevratná.")) {
				VyukaApp.clearCurrentChatSessionHistory();
			}
		};

    	VyukaApp.clearCurrentChatSessionHistory = async () => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;

			if (ui.chatMessages) {
				ui.chatMessages.innerHTML = `
					<div class="initial-chat-interface">
						<div class="ai-greeting-avatar"><i class="fas fa-robot"></i></div>
						<h3 class="initial-chat-title">AI Tutor Justax je připraven</h3>
						<p class="initial-chat-message">Chat vymazán. Čekám na načtení tématu nebo vaši zprávu.</p>
						<div class="initial-chat-status"><span class="status-dot online"></span> Online</div>
					</div>`;
			}
			state.geminiChatContext = [];
			VyukaApp.showToast("Historie chatu vymazána.", "info");

			if (state.supabase && state.currentUser && state.currentSessionId) {
				try {
					const { error } = await state.supabase
						.from('chat_history')
						.delete()
						.match({ user_id: state.currentUser.id, session_id: state.currentSessionId });

					if (error) throw error;
					console.log(`Chat history deleted from DB for session: ${state.currentSessionId}`);
				} catch (e) {
					console.error("DB clear chat error:", e);
					VyukaApp.showToast("Chyba při mazání historie chatu z databáze.", "error");
				}
			}
             VyukaApp.manageButtonStates();
		};

    	VyukaApp.saveChatToPDF = async () => {
			// Keep the original function from vyuka-features.js here
            const ui = VyukaApp.ui;
			const state = VyukaApp.state;

			if (!ui.chatMessages || ui.chatMessages.children.length === 0 || !!ui.chatMessages.querySelector('.initial-chat-interface')) {
				VyukaApp.showToast("Není co uložit.", "warning");
				return;
			}
			if (typeof html2pdf === 'undefined') {
				VyukaApp.showToast("Chyba: PDF knihovna nenalezena.", "error");
				console.error("html2pdf library is not loaded!");
				return;
			}
			VyukaApp.showToast("Generuji PDF...", "info", 4000);

			const elementToExport = document.createElement('div');
			elementToExport.style.padding = "15mm";
			elementToExport.innerHTML = `
				<style>
					body { font-family: 'Poppins', sans-serif; font-size: 10pt; line-height: 1.5; color: #333; }
					.chat-message { margin-bottom: 12px; max-width: 90%; page-break-inside: avoid; }
					.user { margin-left: 10%; }
					.model { margin-right: 10%; }
					.message-bubble { display: inline-block; padding: 8px 14px; border-radius: 15px; background-color: #e9ecef; word-wrap: break-word; } /* Added word-wrap */
					.user .message-bubble { background-color: #d1e7dd; }
					.message-timestamp { font-size: 8pt; color: #6c757d; margin-top: 4px; display: block; }
					.user .message-timestamp { text-align: right; }
					h1 { font-size: 16pt; color: #0d6efd; text-align: center; margin-bottom: 5px; }
					p.subtitle { font-size: 9pt; color: #6c757d; text-align: center; margin: 0 0 15px 0; }
					hr { border: 0; border-top: 1px solid #ccc; margin: 15px 0; }
					.tts-listen-btn, .message-avatar { display: none; }
                    mjx-math { font-size: 1em; }
                    pre { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 0.8em; border-radius: 6px; overflow-x: auto; font-size: 0.9em; white-space: pre-wrap; word-wrap: break-word; }
                    /* Simplified code style */
                    code { font-family: monospace; font-size: 0.9em; }
                    .message-bubble pre code { background: none; padding: 0; } /* Reset code inside pre */
                    .message-bubble code:not(pre code) { background-color: #e9ecef; padding: 0.1em 0.3em; border-radius: 3px; }
                    h1, h2, h3 { margin-top: 0.8em; margin-bottom: 0.4em; font-weight: bold; }
                    h1 {font-size: 1.4em;} h2 {font-size: 1.2em;} h3 {font-size: 1.1em;}
                    blockquote { border-left: 3px solid #ccc; padding-left: 10px; margin-left: 5px; color: #555; font-style: italic; }
				</style>
				<h1>Chat s AI Tutorem - ${VyukaApp.sanitizeHTML(state.currentTopic?.name || 'Neznámé téma')}</h1>
				<p class="subtitle">Vygenerováno: ${new Date().toLocaleString('cs-CZ')}</p>
				<hr>
			`;

			Array.from(ui.chatMessages.children).forEach(msgElement => {
				if (msgElement.classList.contains('chat-message') && !msgElement.id.startsWith('thinking-')) {
					const clone = msgElement.cloneNode(true);
					clone.querySelector('.message-avatar')?.remove();
					clone.querySelector('.tts-listen-btn')?.remove();
                    // Simply append the cleaned clone
					elementToExport.appendChild(clone);
				}
			});

			const filename = `chat-${state.currentTopic?.name?.replace(/[^a-z0-9]/gi, '_') || 'vyuka'}-${Date.now()}.pdf`;
			const pdfOptions = {
				margin: 15,
				filename: filename,
				image: { type: 'jpeg', quality: 0.95 },
				html2canvas: { scale: 2, useCORS: true, logging: false },
				jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
			};

			try {
				await html2pdf().set(pdfOptions).from(elementToExport).save();
				VyukaApp.showToast("Chat uložen jako PDF!", "success");
			} catch (e) {
				console.error("PDF Generation Error:", e);
				VyukaApp.showToast("Chyba při generování PDF.", "error");
			}
		};

        // --- Gemini Interaction & Parsing ---
        VyukaApp.parseGeminiResponse = (rawText) => {
			// Keep the function from the previous version here
            console.log("[ParseGemini v19] Raw input:", rawText ? rawText.substring(0, 150) + "..." : "EMPTY");
			const config = VyukaApp.config;
			const boardMarker = "[BOARD_MARKDOWN]:";
			const ttsMarker = "[TTS_COMMENTARY]:";
			const actionMarker = config.ACTION_SUGGEST_COMPLETION;

			const boardRegex = /\[BOARD_MARKDOWN]:\s*(?:```(?:markdown)?\s*([\s\S]*?)\s*```|([\s\S]*?))(?=\s*\[TTS_COMMENTARY]:|\s*\[BOARD_MARKDOWN]:|\s*\[ACTION:SUGGEST_COMPLETION]|$)/i;
            const ttsRegex = /\[TTS_COMMENTARY]:\s*(?:```\s*([\s\S]*?)\s*```|([\s\S]*?))(?=\s*\[BOARD_MARKDOWN]:|\s*\[TTS_COMMENTARY]:|\s*\[ACTION:SUGGEST_COMPLETION]|$)/i;
            const actionRegex = /(\[ACTION:SUGGEST_COMPLETION])/i;

			let remainingText = rawText || "";
			let boardMarkdown = "";
			let ttsCommentary = "";
			let actionSignal = null;

			// 1. Check for Action Signal FIRST
			const actionMatch = remainingText.match(actionRegex);
			if (actionMatch) {
				actionSignal = 'SUGGEST_COMPLETION';
				remainingText = remainingText.replace(actionMatch[0], "").trim();
				console.log(`[ParseGemini v19] Found action signal: ${actionSignal}`);
				if (remainingText.length === 0) {
					return { boardMarkdown: "", ttsCommentary: "", chatText: "", actionSignal };
				}
			}

			// 2. Extract Board Markdown
			const boardMatch = remainingText.match(boardRegex);
            console.log("[ParseGemini v19] Board Regex Match:", boardMatch);
			if (boardMatch) {
				boardMarkdown = (boardMatch[1] || boardMatch[2] || "").trim();
                console.log(`[ParseGemini v19] Extracted Board Content (Raw): "${boardMarkdown.substring(0,70)}..."`);
                remainingText = remainingText.replace(boardMatch[0], "").trim();
				console.log(`[ParseGemini v19] Found board content. Length: ${boardMarkdown.length}`);
                 if (boardMarkdown.toLowerCase().startsWith('markdown')) {
                    const potentialNewlineIndex = boardMarkdown.indexOf('\n');
                    if (potentialNewlineIndex !== -1 && potentialNewlineIndex < 15) {
                        boardMarkdown = boardMarkdown.substring(potentialNewlineIndex + 1).trim();
                        console.warn("[ParseGemini v19] Cleaned leading 'markdown' word.");
                    } else if (boardMarkdown.length < 15) {
                         boardMarkdown = "";
                         console.warn("[ParseGemini v19] Discarded short content starting with 'markdown'.");
                     }
                }
			} else {
                 console.log(`[ParseGemini v19] Marker "${boardMarker}" not found or malformed.`);
            }

			// 3. Extract TTS Commentary
			const ttsMatch = remainingText.match(ttsRegex);
			if (ttsMatch) {
				ttsCommentary = (ttsMatch[1] || ttsMatch[2] || "").trim();
				remainingText = remainingText.replace(ttsMatch[0], "").trim();
				console.log(`[ParseGemini v19] Found TTS content. Length: ${ttsCommentary.length}`);
			} else {
                 console.log(`[ParseGemini v19] Marker "${ttsMarker}" not found or malformed.`);
            }

			// 4. The rest is chat text
			let chatText = remainingText
				.replace(/```(markdown)?\s*|\s*```/g, '')
                .replace(/\[BOARD_MARKDOWN]:/gi, '')
                .replace(/\[TTS_COMMENTARY]:/gi, '')
                .replace(/\[ACTION:SUGGEST_COMPLETION]/gi, '')
                .trim();

            console.log("[ParseGemini v19] Result - Board:", boardMarkdown ? boardMarkdown.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini v19] Result - TTS:", ttsCommentary ? ttsCommentary.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini v19] Result - Chat:", chatText ? chatText.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini v19] Result - Action:", actionSignal);

			return { boardMarkdown, ttsCommentary, chatText, actionSignal };
		};

    	VyukaApp.processGeminiResponse = (rawText, timestamp) => {
            // *** ADDED Check for board-like content in chatText ***
			const state = VyukaApp.state;
			VyukaApp.removeThinkingIndicator();
            state.lastInteractionTime = Date.now();

			console.log("[ProcessGemini v23] Processing Raw Response:", rawText ? rawText.substring(0, 100) + "..." : "Empty Response");

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
             } else {
                 cleanedChatText = chatText.trim();
                 console.warn("cleanChatMessage function not found, using basic trim.");
             }

            // *** Check for board content mistakenly placed in chat ***
            const boardIndicators = ['##', '###', '**Zadání:**', '**Řešení:**', '$$']; // Basic indicators
            if (cleanedChatText && boardIndicators.some(indicator => cleanedChatText.includes(indicator))) {
                console.warn("[ProcessGemini v23] Detected board-like content in chatText. Overriding.", cleanedChatText.substring(0,100));
                cleanedChatText = "(AI odpověď obsahuje neočekávaný formát obsahu pro chat. Zkuste prosím 'Pokračuj' nebo položte otázku znovu.)";
                // Don't set aiResponded = true here yet, let normal flow handle it
            }
            // *** End Check ***

            console.log(`[ProcessGemini v23] Parsed-> Board: ${!!boardMarkdown}, TTS: ${!!ttsCommentary}, Chat: ${!!cleanedChatText}, Action: ${actionSignal}`);

			// 1. Handle Action Signal
			if (actionSignal === 'SUGGEST_COMPLETION') {
                 if (typeof VyukaApp.promptTopicCompletion === 'function') {
				    VyukaApp.promptTopicCompletion();
                 } else { console.error("Error: VyukaApp.promptTopicCompletion not defined."); }
				aiResponded = true;
                VyukaApp.manageUIState('suggestedCompletion');
			}

			// 2. Handle Whiteboard Content
			if (boardMarkdown) {
                 if (typeof VyukaApp.appendToWhiteboard === 'function') {
				    VyukaApp.appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                 } else { console.error("Error: VyukaApp.appendToWhiteboard not defined."); }
				aiResponded = true;
                if (actionSignal !== 'SUGGEST_COMPLETION') {
                     state.aiIsWaitingForAnswer = false;
                }

                if (actionSignal !== 'SUGGEST_COMPLETION') {
                    const lowerBoard = boardMarkdown.toLowerCase();
                    const taskKeywords = ['úloha k řešení', 'vyřešte tento příklad', 'zodpovězte následující', 'úkol:', 'otázka k procvičení'];
                    const taskHeaderRegex = /###\s*(úloha|příklad k řešení|úkol|otázka)/i;
                    const zadaniEndsWithQuestion = /\*\*zadání:\*\*[\s\S]*\?$/i;
                    if (taskKeywords.some(kw => lowerBoard.includes(kw)) || taskHeaderRegex.test(boardMarkdown) || zadaniEndsWithQuestion.test(boardMarkdown.replace(/\s+/g, ' '))) {
                        state.aiIsWaitingForAnswer = true;
                        console.log("[ProcessGemini v23] Task DETECTED on board, setting aiIsWaitingForAnswer = true.");
                    } else {
                         console.log("[ProcessGemini v23] No task detected on board.");
                    }
                }
			}

			// 3. Handle Chat Text
			if (cleanedChatText) {
				const ttsForChat = (!boardMarkdown && ttsCommentary && actionSignal !== 'SUGGEST_COMPLETION') ? ttsCommentary : null;
				VyukaApp.addChatMessage(cleanedChatText, 'gemini', true, timestamp, ttsForChat, chatText); // Save original (uncleaned) chatText
				aiResponded = true;
			}

			// 4. Handle unusable response
			if (!aiResponded && !actionSignal) {
                if (ttsCommentary) { // If only TTS was provided
                    VyukaApp.addChatMessage(`(Komentář k tabuli: ${ttsCommentary})`, 'gemini', true, timestamp, ttsCommentary, `(Komentář: ${ttsCommentary})`);
                     aiResponded = true;
                } else { // Truly empty/unusable
				    VyukaApp.addChatMessage("(AI neodpovědělo očekávaným formátem nebo odpověď byla prázdná)", 'gemini', false, timestamp, null, rawText || "(Prázdná/neplatná odpověď)");
				    console.warn("AI sent no usable content and no action signal.");
                }
                state.aiIsWaitingForAnswer = false;
			}

            // 5. Update UI state
            if (state.aiIsWaitingForAnswer) {
                VyukaApp.manageUIState('waitingForAnswer');
            } else if (state.aiSuggestedCompletion) {
                 VyukaApp.manageUIState('suggestedCompletion');
            } else {
                VyukaApp.manageUIState('learning');
            }
		};

        // --- MODIFIED: Prompts (v23 - Stricter formatting rules) ---
    	VyukaApp._buildInitialPrompt = () => {
			const state = VyukaApp.state;
            const config = VyukaApp.config;
			const level = state.currentProfile?.skill_level || 'středně pokročilá';
			const topicName = state.currentTopic?.name || 'Neznámé téma';

			return `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. Tvé vysvětlení musí být strukturované, přesné a profesionální.
Téma lekce: "${topicName}".
Cílová úroveň studenta: "${level}".

HLAVNÍ PRAVIDLA (DODRŽUJ NAPROSTO VŽDY!):
1.  **Obsah na tabuli ([BOARD_MARKDOWN]):** Všechny klíčové informace (definice, věty, vzorce), **MINIMÁLNĚ DVA ŘEŠENÉ PŘÍKLADY (různá obtížnost)** a ÚLOHY K ŘEŠENÍ patří VÝHRADNĚ A POUZE do tohoto bloku, začínajícího značkou '[BOARD_MARKDOWN]:'. Používej Markdown a $$...$$ pro matematiku. Vždy uveď řešené příklady PŘED zadáním úkolu studentovi.
2.  **Hlasový komentář ([TTS_COMMENTARY]):** Slouží POUZE pro DOPLŇUJÍCÍ hlasový komentář k obsahu na tabuli. NEOPAKUJ doslova text z tabule. Začíná značkou '[TTS_COMMENTARY]:'.
3.  **Chat (Text mimo značky):** VYUŽÍVEJ MINIMÁLNĚ. NIKDY v chatu NEUVÁDĚJ nové definice, příklady, úlohy ani vysvětlení látky. Použij chat POUZE pro HODNOCENÍ odpovědi studenta nebo VELMI krátkou PŘÍMOU odpověď na jeho otázku. NEPIŠ uvítací/ukončovací fráze.
4.  **Struktura a Náročnost:** Postupuj logicky, zvyšuj náročnost k úrovni přijímaček. VŽDY dej více řešených příkladů PŘED úlohou. Používej RŮZNÉ typy úloh.
5.  **Interakce:**
    * Po zadání ÚLOHY K ŘEŠENÍ v [BOARD_MARKDOWN], uveď v [TTS_COMMENTARY] **JASNĚ**, že čekáš odpověď v chatu. NIC VÍC.
    * Po teorii/řešeném příkladu **NEČEKEJ na odpověď** a **NEPOKLÁDEJ otázky** typu "Je to jasné?", "Pokračujeme?".
6.  **Fokus na Téma:** **STRIKTNĚ se drž tématu lekce: "${topicName}".**
7.  **Navržení Dokončení Tématu:** Pokud je téma probráno, **místo dalšího obsahu** pošli **POUZE** signál **${config.ACTION_SUGGEST_COMPLETION}**. NIC JINÉHO.

PRVNÍ KROK:
Začni se ZÁKLADNÍ DEFINICÍ tématu "${topicName}". Poskytni **alespoň JEDEN ŘEŠENÝ PŘÍKLAD** (jednoduchý). VŠE DEJ DO [BOARD_MARKDOWN]:. Přidej krátký [TTS_COMMENTARY]:. NEPIŠ nic do chatu.

POŽADOVANÝ FORMÁT ODPOVĚDI (pro první krok):
[BOARD_MARKDOWN]:
\`\`\`markdown
## ${topicName} - Základy

### [Krátký, výstižný podnadpis]
(Zde definice/úvodní koncept. **Tučně** termíny, $$...$$ matematika.)

### První řešený příklad (Základní)
**Zadání:** ...
**Řešení:**
* Krok 1: ... ($$...$$)
* Krok 2: ... ($$...$$)
* Výsledek: $$...$$
\`\`\`
[TTS_COMMENTARY]:
(Zde hlasový komentář: Stručné představení tématu a shrnutí obsahu tabule. NEPOKLÁDEJ OTÁZKU a nezdrav.)
`;
		};

    	VyukaApp._buildContinuePrompt = () => {
			const state = VyukaApp.state;
            const config = VyukaApp.config;
			const level = state.currentProfile?.skill_level || 'středně pokročilá';
			const topicName = state.currentTopic?.name || 'Neznámé téma';

			return `Pokračuj ve výkladu tématu "${topicName}" pro studenta úrovně "${level}". Naváž logicky na PŘEDCHOZÍ OBSAH NA TABULI.

HLAVNÍ PRAVIDLA (PŘIPOMENUTÍ!):
* Všechny NOVÉ informace, **VÍCE ŘEŠENÝCH PŘÍKLADŮ** a ÚLOHY K ŘEŠENÍ patří VÝHRADNĚ A POUZE do bloku [BOARD_MARKDOWN]:.
* [TTS_COMMENTARY]: použij POUZE pro DOPLNĚNÍ k tabuli.
* Chat (mimo značky): NEPOUŽÍVEJ pro nový obsah.
* STRIKTNĚ se drž tématu "${topicName}" a úrovně 9. třídy.
* Zvyšuj náročnost. **Vždy ŘEŠENÉ příklady PŘED úlohou pro studenta.**
* Po zadání ÚLOHY v [BOARD_MARKDOWN], v [TTS_COMMENTARY] **JASNĚ řekni, že čekáš odpověď** v chatu. NIC VÍC.
* Po teorii/řešeném příkladu **NEČEKEJ** a **NEPOKLÁDEJ otázky**.
* Pokud je téma probráno -> pošli **POUZE** signál **${config.ACTION_SUGGEST_COMPLETION}**.

DALŠÍ KROK: Vyber a vygeneruj JEDEN z následujících kroků (nebo navrhni dokončení):
A) Další část teorie/vysvětlení navazující na předchozí -> do [BOARD_MARKDOWN].
B) **Několik (alespoň 2) dalších ŘEŠENÝCH příkladů** (složitější) -> do [BOARD_MARKDOWN].
C) ÚLOHU K ŘEŠENÍ pro studenta (úroveň přijímaček) -> do [BOARD_MARKDOWN] (až PO dostatku řešených).
D) Pokud je téma probráno -> pošli signál ${config.ACTION_SUGGEST_COMPLETION}.

POŽADOVANÝ FORMÁT ODPOVĚDI (Pokud NEPOSÍLÁŠ signál):
[BOARD_MARKDOWN]:
\`\`\`markdown
### [Nadpis další části / Řešené příklady (Typ) / Úloha k řešení (Typ)]
(Zde text vysvětlení NEBO zadání a PODROBNÁ řešení příkladů NEBO POUZE ZADÁNÍ úlohy k řešení. Používej Markdown, $$...$$.)
\`\`\`
[TTS_COMMENTARY]:
(Zde hlasový komentář k NOVÉMU obsahu. Pokud jsi zadal ÚLOHU, **JASNĚ řekni:** "Nyní zkuste tuto úlohu vyřešit vy a napište mi výsledek/postup do chatu." Pokud jde o teorii/řešený příklad, stručně shrň. **NEPOKLÁDEJ OTÁZKU.**)
`;
		};

    	VyukaApp._buildChatInteractionPrompt = (userText) => {
			const state = VyukaApp.state;
            const config = VyukaApp.config;
			const level = state.currentProfile?.skill_level || 'středně pokročilá';
			const topicName = state.currentTopic?.name || 'Neznámé téma';

			let baseInstruction;

			if (state.aiIsWaitingForAnswer) {
				// Case 1: User is answering a task
				baseInstruction = `Student nyní poskytl odpověď na POSLEDNÍ úlohu zadanou na tabuli k tématu "${topicName}". Studentova odpověď je: "${userText}".

TVŮJ ÚKOL (ODPOVĚĎ POUZE DO CHATU - MIMO ZNAČKY!):
1.  **NEJPRVE ZCELA KONKRÉTNĚ vyhodnoť správnost TÉTO studentovy odpovědi ('${userText}')** vůči poslední úloze.
2.  Pokud je nesprávná/neúplná: **Jasně vysvětli chybu** a uveď správný postup/výsledek.
3.  Pokud je správná: **Krátce pochval (např. 'Správně!', 'Výborně!').**
4.  **Tato odpověď v chatu NESMÍ obsahovat nové definice, příklady ani zadání úloh.**
5.  **NAPROSTO NEPOKLÁDEJ ŽÁDNÉ DALŠÍ OTÁZKY** (ani 'Chceš pokračovat?').
6.  **UKONČI svou odpověď ZDE.** Další krok zahájí student kliknutím na "Pokračuj".`;
			} else {
				// Case 2: User is asking a question or making a comment
				baseInstruction = `Student položil otázku nebo komentář k probíranému tématu "${topicName}": "${userText}".

TVŮJ ÚKOL (ODPOVĚĎ POUZE DO CHATU - MIMO ZNAČKY!):
1.  **Odpověz stručně a PŘÍMO k dotazu studenta.** Využij kontext tabule.
2.  **NEVYSVĚTLUJ novou látku** ani nezadávej nové příklady/úlohy v chatu.
3.  **Pokud dotaz směřuje MIMO aktuální téma "${topicName}", jemně ho vrať zpět.**
4.  **Tato odpověď v chatu NESMÍ obsahovat nové definice, příklady ani zadání úloh.**
5.  **Na konci své odpovědi NEPOKLÁDEJ otázky typu "Stačí takto?", "Je to srozumitelnější?". Odpověz POUZE na otázku a IHNED SKONČI.**`;
			}

			return `${baseInstruction}

PŘIPOMENUTÍ PRAVIDEL CHATU: Odpovídej POUZE běžným textem (mimo značky). Nepoužívej [BOARD_MARKDOWN] ani [TTS_COMMENTARY]. Buď stručný a věcný.`;
		};
        // --- END MODIFIED: Prompts (v23) ---

    	VyukaApp._buildGeminiPayloadContents = (userPrompt, isChatInteraction = false) => {
            // --- MODIFIED: System Instruction (v23 - Stricter) ---
			const state = VyukaApp.state;
			const config = VyukaApp.config;
            const level = state.currentProfile?.skill_level || 'středně pokročilá';
			const topicName = state.currentTopic?.name || 'Neznámé téma';

            const systemInstruction = `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. NAPROSTO VŽDY dodržuj tato pravidla:
1.  **[BOARD_MARKDOWN]:** Všechny definice, vzorce, vysvětlení, **VÍCE ŘEŠENÝCH PŘÍKLADŮ** a ÚLOHY K ŘEŠENÍ patří VÝHRADNĚ A POUZE sem: \`\`\`markdown ... \`\`\`. Používej Markdown a $$...$$ pro matematiku. Řešené příklady PŘED úlohami pro studenta.
2.  **[TTS_COMMENTARY]:** Použij POUZE pro DOPLNĚNÍ k tabuli, NEOPAKUJ text doslova.
3.  **Chat (Text mimo značky):** Použij MINIMÁLNĚ, POUZE pro HODNOCENÍ odpovědi studenta nebo VELMI krátkou PŘÍMOU odpověď na jeho otázku. NIKDY v chatu neuváděj nové definice, příklady, úlohy, vysvětlení. NEPIŠ pozdravy ani fráze.
4.  **Struktura a Náročnost:** Postupuj logicky, zvyšuj náročnost úloh k úrovni PŘIJÍMAČEK 9. třídy. **Vždy VÍCE řešených příkladů PŘED úlohou pro studenta.**
5.  **Interakce:** Po zadání ÚLOHY v [BOARD_MARKDOWN], v [TTS_COMMENTARY] JASNĚ řekni, že čekáš odpověď v chatu. V JINÝCH případech (teorie, řešené příklady) NEČEKEJ na odpověď a NEPOKLÁDEJ otázky ("Jasné?", "Pokračujeme?").
6.  **Fokus na Téma:** **STRIKTNĚ se drž tématu lekce: "${topicName}".**
7.  **Odpovědi v chatu:** Pokud student ODPOVÍDÁ na úlohu nebo POKLÁDÁ OTÁZKU, odpovídej POUZE textem do CHATU podle instrukcí v uživatelském promptu. Po správné odpovědi JEN potvrď a UKONČI. Po přímé odpovědi na otázku IHNED SKONČI. **NIKDY nekonči otázkami jako "Stačí takto?" apod.**
8.  **Navržení Dokončení Tématu:** Když je téma probráno, místo dalšího obsahu pošli **POUZE** signál **${config.ACTION_SUGGEST_COMPLETION}**.`;
            // --- END MODIFIED: System Instruction (v23) ---

			const history = state.geminiChatContext.slice(-config.MAX_GEMINI_HISTORY_TURNS * 2);
			const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };
			const contents = [
				{ role: "user", parts: [{ text: systemInstruction }] },
                // --- MODIFIED: Model Confirmation (v23 - Stricter) ---
				{ role: "model", parts: [{ text: `Rozumím. Budu striktně dodržovat pravidla. Obsah pro tabuli pouze v [BOARD_MARKDOWN]:. Komentář pouze v [TTS_COMMENTARY]:. Chat (mimo značky) jen pro hodnocení nebo velmi krátkou přímou odpověď na otázku, bez nového obsahu a zbytečných frází či otázek. Budu se držet tématu "${topicName}" a úrovně 9. třídy. Pokud bude téma probráno, pošlu pouze signál ${config.ACTION_SUGGEST_COMPLETION}.` }] },
                // --- END MODIFIED: Model Confirmation (v23) ---
				...history,
				currentUserMessage
			];
			return contents;
		};

    	VyukaApp.sendToGemini = async (prompt, isChatInteraction = false) => {
            // Keep the existing fetch logic, payload structure, and error handling
			const config = VyukaApp.config;
			const state = VyukaApp.state;

			if (!config.GEMINI_API_KEY || !config.GEMINI_API_KEY.startsWith('AIzaSy')) {
				VyukaApp.showToast("Chyba Konfigurace", "Chybí API klíč pro AI.", "error");
				VyukaApp.updateGeminiThinkingState(false);
				return;
			}
			if (!state.currentTopic) {
				VyukaApp.showToast("Chyba", "Není vybráno téma.", "error");
				VyukaApp.updateGeminiThinkingState(false);
				return;
			}
			if (!navigator.onLine) {
				VyukaApp.showToast("Offline", "Nelze komunikovat s AI bez připojení.", "warning");
				VyukaApp.updateGeminiThinkingState(false);
				return;
			}

			console.log(`Sending to Gemini (Chat Interaction: ${isChatInteraction}): "${prompt.substring(0, 80)}..."`);
			const timestamp = new Date();
			VyukaApp.updateGeminiThinkingState(true);

			const contents = VyukaApp._buildGeminiPayloadContents(prompt, isChatInteraction);
			const body = {
				contents,
				generationConfig: {
					temperature: 0.6,
					topP: 0.95,
					topK: 40,
					maxOutputTokens: 8192,
				},
				safetySettings: [
					{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
					{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
					{ category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
					{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
				]
			};

			try {
				const response = await fetch(config.GEMINI_API_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});

				if (!response.ok) {
					let errorText = `Chyba API (${response.status})`;
					try {
						const errData = await response.json();
						errorText += `: ${errData?.error?.message || 'Neznámá chyba'}`;
					} catch (e) {
						errorText += `: ${await response.text()}`;
					}
					throw new Error(errorText);
				}

				const data = await response.json();
                console.log("[DEBUG] Raw Gemini Response Data:", JSON.stringify(data, null, 2));

				if (data.promptFeedback?.blockReason) {
					throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}. Zkuste přeformulovat.`);
				}

				const candidate = data.candidates?.[0];
				if (!candidate) {
					throw new Error('AI neposkytlo platnou odpověď (no candidate).');
				}

                if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
                     console.warn(`Gemini finishReason: ${candidate.finishReason}.`);
                     if (candidate.finishReason === 'SAFETY') {
                          throw new Error('Odpověď blokována bezpečnostním filtrem AI.');
                     }
                }

				const text = candidate.content?.parts?.[0]?.text;

                if (!text && candidate.finishReason !== 'STOP') {
                     if (candidate.finishReason === 'MAX_TOKENS') {
                          throw new Error('Odpověď AI byla příliš dlouhá (Max Tokens).');
                     } else {
                          throw new Error('AI vrátilo prázdnou odpověď (Důvod: '+(candidate.finishReason || 'Neznámý')+').');
                     }
                }

				state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] });
				state.geminiChatContext.push({ role: "model", parts: [{ text: text || "" }] });

				if (state.geminiChatContext.length > config.MAX_GEMINI_HISTORY_TURNS * 2 + 2) {
					state.geminiChatContext.splice(2, state.geminiChatContext.length - (config.MAX_GEMINI_HISTORY_TURNS * 2 + 2));
				}

				VyukaApp.processGeminiResponse(text || "", timestamp);

			} catch (error) {
				console.error('Chyba komunikace s Gemini:', error);
                console.error('Error stack:', error.stack);
				VyukaApp.showToast(`Chyba AI: ${error.message}`, "error");
				VyukaApp.handleGeminiError(error.message, timestamp);
			} finally {
				VyukaApp.updateGeminiThinkingState(false);
			}
		};

    	VyukaApp.handleGeminiError = (msg, time) => {
			const state = VyukaApp.state;
			VyukaApp.removeThinkingIndicator();
			VyukaApp.addChatMessage(`Nastala chyba při komunikaci s AI: ${msg}`, 'gemini', false, time, null, `(Chyba: ${msg})`);
            state.aiIsWaitingForAnswer = false;
            VyukaApp.manageUIState('learning');
		};


	} catch (e) {
		console.error("FATAL SCRIPT ERROR (AI Interaction):", e);
		document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--accent-pink,#ff33a8);color:var(--white,#fff);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky (AI Interaction).</p><p style="margin-top:15px;"><a href="#" onclick="location.reload()" style="color:var(--accent-cyan,#00e0ff); text-decoration:underline; font-weight:bold;">Obnovit stránku</a></p><details style="margin-top: 20px; color: #f0f0f0;"><summary style="cursor:pointer; color: var(--white,#fff);">Detaily</summary><pre style="margin-top:10px;padding:15px;background:rgba(0, 0, 0, 0.4);border:1px solid rgba(255, 255, 255, 0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;max-height: 300px; overflow-y: auto; border-radius: 8px;">${e.message}\n${e.stack}</pre></details></div>`;
	}

})(window.VyukaApp);