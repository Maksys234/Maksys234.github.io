// Файл: procvicovani/vyuka/vyuka-ai-interaction.js
// Логика взаимодействия с AI Gemini, управление чатом, учебной сессией, парсинг ответов AI
// Версия v25: Исправлена ошибка в sendToGemini, уточнена логика кнопки "Продолжить".

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
        config.ACTION_SUGGEST_COMPLETION = "[ACTION:SUGGEST_COMPLETION]";
        config.ACTION_INITIATE_FINAL_QUIZ = "[ACTION:INITIATE_FINAL_QUIZ]";

        // --- Topic Loading and Progress ---
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
							console.warn("Could not fetch topic details:", e);
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

		VyukaApp.handleMarkTopicComplete = async () => {
			const state = VyukaApp.state;
			const config = VyukaApp.config;
			const ui = VyukaApp.ui;

			if (!state.currentTopic || !state.currentTopic.activity_id) {
				 console.error("[MarkComplete v25] Error: Missing currentTopic or activity_id in state.", state.currentTopic);
				 VyukaApp.showToast("Chyba: Chybí informace o aktuálním tématu.", "error");
				 return;
			}
			if (!state.supabase) {
				 console.error("[MarkComplete v25] Error: Supabase client not available.");
				 VyukaApp.showToast("Chyba: Databáze není dostupná.", "error");
				 return;
			}
			 if (state.topicLoadInProgress) {
				  console.warn("[MarkComplete v25] Blocked: Topic operation already in progress.");
				  return;
			 }

			console.log(`[MarkComplete v25] Attempting to mark activity ID: ${state.currentTopic.activity_id} (${state.currentTopic.name}) as complete.`);
			state.topicLoadInProgress = true;
			state.aiSuggestedCompletion = false;
            state.finalQuizActive = false;
			VyukaApp.manageButtonStates();

			try {
				console.log(`[MarkComplete v25] Preparing to update activity ID: ${state.currentTopic.activity_id} in plan ID: ${state.currentTopic.plan_id}`);
				console.log(`[MarkComplete v25] Points to award: ${config.POINTS_TOPIC_COMPLETE}`);

				const { error: updateError } = await state.supabase
					.from('plan_activities')
					.update({ completed: true, updated_at: new Date().toISOString() })
					.eq('id', state.currentTopic.activity_id);

				if (updateError) {
					 console.error(`[MarkComplete v25] Supabase update FAILED for activity ${state.currentTopic.activity_id}:`, updateError);
					 throw updateError;
				}
				console.log(`[MarkComplete v25] >>> DB UPDATE SUCCESS for activity ${state.currentTopic.activity_id} <<<`);

                 if (typeof VyukaApp.awardPoints === 'function') {
				    await VyukaApp.awardPoints(config.POINTS_TOPIC_COMPLETE);
                 } else { console.error("Error: VyukaApp.awardPoints not defined."); }

				if (typeof VyukaApp.checkAndAwardAchievements === 'function') {
					await VyukaApp.checkAndAwardAchievements(state.currentUser.id);
				} else {
					console.warn("[MarkComplete v25] Achievement checking function not found.");
				}

				VyukaApp.showToast(`Téma "${state.currentTopic.name}" dokončeno! Přesměrovávám...`, "success", 2500);

                console.log("[MarkComplete v25] Scheduling redirect after success.");
				setTimeout(() => {
                     console.log("[MarkComplete v25] Redirecting now...");
                     window.location.href = '/dashboard/procvicovani/main.html';
                 }, 500);

			} catch (error) {
				console.error(`[MarkComplete v25] CATCH BLOCK: Error during topic completion (Activity ID: ${state.currentTopic?.activity_id}):`, error);
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
			console.log("[RequestContinue v25] Triggered. AI Waiting:", state.aiIsWaitingForAnswer, "AI Suggested Completion:", state.aiSuggestedCompletion, "Final Quiz Active:", state.finalQuizActive);

			if (state.geminiIsThinking || !state.currentTopic || state.finalQuizActive) {
                VyukaApp.showToast("Počkejte prosím, nebo dokončete aktuální test.", "info", 3000);
                return;
            }

			if (state.aiIsWaitingForAnswer) {
				VyukaApp.showToast("Nejprve odpovězte na úlohu v chatu.", "warning", 3000);
				console.warn("[RequestContinue v25] Blocked: AI is waiting for an answer.");
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
                    if (!avatarUrl.startsWith('http') && avatarUrl.includes('/')) {
                    } else {
                        avatarUrl += (avatarUrl.includes('?') ? '&' : '?') + `t=${new Date().getTime()}`;
                    }
                    avatarContent = `<img src="${VyukaApp.sanitizeHTML(avatarUrl)}" alt="${VyukaApp.sanitizeHTML(avatarContent)}">`;
                }
            } else {
                avatarContent = '<i class="fas fa-robot"></i>';
            }

			const div = document.createElement('div');
			div.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`;
			div.id = id;
			div.style.opacity = '0';

			const avatarDiv = `<div class="message-avatar">${avatarContent}</div>`;
			const bubbleDiv = document.createElement('div');
			bubbleDiv.className = 'message-bubble';
			const bubbleContentDiv = document.createElement('div');
			bubbleContentDiv.className = 'message-bubble-content';

			VyukaApp.renderMarkdown(bubbleContentDiv, displayMessage, true);

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

			if (window.MathJax && typeof window.MathJax.typesetPromise === 'function' && (displayMessage.includes('$') || displayMessage.includes('\\'))) {
                console.log(`[MathJax v25] Queueing typeset for chat message bubble: ${id}`);
				setTimeout(() => {
					window.MathJax.typesetPromise([bubbleContentDiv])
						.then(() => console.log(`[MathJax v25] Typeset successful for chat bubble ${id}`))
						.catch((err) => console.error(`[MathJax v25] Typeset error for chat bubble ${id}: ${err.message}`));
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

        VyukaApp.addThinkingIndicator = () => { /* ... stejné jako předtím ... */ };
    	VyukaApp.removeThinkingIndicator = () => { /* ... stejné jako předtím ... */ };
    	VyukaApp.updateGeminiThinkingState = (isThinking) => { /* ... stejné jako předtím ... */ };

    	VyukaApp.handleSendMessage = async () => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;
			const text = ui.chatInput?.value.trim();

			if (!text || state.geminiIsThinking || !state.currentTopic || state.isListening || state.finalQuizActive) {
                if (state.finalQuizActive) VyukaApp.showToast("Probíhá finální test. Není možné posílat zprávy.", "info");
                return;
            }

            state.lastInteractionTime = Date.now();
            state.aiSuggestedCompletion = false;

            if (state.aiIsWaitingForAnswer) {
                console.log("[HandleSend v25] Resetting aiIsWaitingForAnswer state.");
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

    	VyukaApp.confirmClearChat = () => { /* ... stejné jako předtím ... */ };
    	VyukaApp.clearCurrentChatSessionHistory = async () => { /* ... stejné jako předtím ... */ };
    	VyukaApp.saveChatToPDF = async () => { /* ... stejné jako předtím ... */ };

        VyukaApp.parseGeminiResponse = (rawText) => {
            console.log("[ParseGemini v25] Raw input:", rawText ? rawText.substring(0, 150) + "..." : "EMPTY");
			const config = VyukaApp.config;
			const boardMarker = "[BOARD_MARKDOWN]:";
			const ttsMarker = "[TTS_COMMENTARY]:";
			const actionSuggestCompletionMarker = config.ACTION_SUGGEST_COMPLETION;
            const actionInitiateFinalQuizMarker = config.ACTION_INITIATE_FINAL_QUIZ;

			const boardRegex = /\[BOARD_MARKDOWN]:\s*(?:```(?:markdown)?\s*([\s\S]*?)\s*```|([\s\S]*?))(?=\s*\[TTS_COMMENTARY]:|\s*\[BOARD_MARKDOWN]:|\s*\[ACTION:SUGGEST_COMPLETION]|\s*\[ACTION:INITIATE_FINAL_QUIZ]|$)/i;
            const ttsRegex = /\[TTS_COMMENTARY]:\s*(?:```\s*([\s\S]*?)\s*```|([\s\S]*?))(?=\s*\[BOARD_MARKDOWN]:|\s*\[TTS_COMMENTARY]:|\s*\[ACTION:SUGGEST_COMPLETION]|\s*\[ACTION:INITIATE_FINAL_QUIZ]|$)/i;
            const actionSuggestRegex = /(\[ACTION:SUGGEST_COMPLETION])/i;
            const actionQuizRegex = /(\[ACTION:INITIATE_FINAL_QUIZ])/i;

			let remainingText = rawText || "";
			let boardMarkdown = "";
			let ttsCommentary = "";
			let actionSignal = null;

            const quizMatch = remainingText.match(actionQuizRegex);
            if (quizMatch) {
                actionSignal = 'INITIATE_FINAL_QUIZ';
                remainingText = remainingText.replace(quizMatch[0], "").trim();
                console.log(`[ParseGemini v25] Found action signal: ${actionSignal}`);
                if (remainingText.length === 0) {
					return { boardMarkdown: "", ttsCommentary: "", chatText: "", actionSignal };
				}
            } else {
			    const suggestMatch = remainingText.match(actionSuggestRegex);
			    if (suggestMatch) {
				    actionSignal = 'SUGGEST_COMPLETION';
				    remainingText = remainingText.replace(suggestMatch[0], "").trim();
				    console.log(`[ParseGemini v25] Found action signal: ${actionSignal}`);
				    if (remainingText.length === 0) {
					    return { boardMarkdown: "", ttsCommentary: "", chatText: "", actionSignal };
				    }
			    }
            }

			const boardMatch = remainingText.match(boardRegex);
			if (boardMatch) {
				boardMarkdown = (boardMatch[1] || boardMatch[2] || "").trim();
                remainingText = remainingText.replace(boardMatch[0], "").trim();
				console.log(`[ParseGemini v25] Found board content. Length: ${boardMarkdown.length}`);
                 if (boardMarkdown.toLowerCase().startsWith('markdown')) { /* ... čištění 'markdown' ... */ }
			} else {
                 console.log(`[ParseGemini v25] Marker "${boardMarker}" not found or malformed.`);
            }

			const ttsMatch = remainingText.match(ttsRegex);
			if (ttsMatch) {
				ttsCommentary = (ttsMatch[1] || ttsMatch[2] || "").trim();
				remainingText = remainingText.replace(ttsMatch[0], "").trim();
				console.log(`[ParseGemini v25] Found TTS content. Length: ${ttsCommentary.length}`);
			} else {
                 console.log(`[ParseGemini v25] Marker "${ttsMarker}" not found or malformed.`);
            }

			let chatText = remainingText
				.replace(/```(markdown)?\s*|\s*```/g, '')
                .replace(/\[BOARD_MARKDOWN]:/gi, '')
                .replace(/\[TTS_COMMENTARY]:/gi, '')
                .replace(/\[ACTION:SUGGEST_COMPLETION]/gi, '')
                .replace(/\[ACTION:INITIATE_FINAL_QUIZ]/gi, '')
                .trim();

            console.log("[ParseGemini v25] Result - Board:", boardMarkdown ? boardMarkdown.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini v25] Result - TTS:", ttsCommentary ? ttsCommentary.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini v25] Result - Chat:", chatText ? chatText.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini v25] Result - Action:", actionSignal);

			return { boardMarkdown, ttsCommentary, chatText, actionSignal };
		};

    	VyukaApp.processGeminiResponse = async (rawText, timestamp) => {
			const state = VyukaApp.state;
			VyukaApp.removeThinkingIndicator();
            state.lastInteractionTime = Date.now();

			console.log("[ProcessGemini v25] Processing Raw Response:", rawText ? rawText.substring(0, 100) + "..." : "Empty Response");

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

            console.log(`[ProcessGemini v25] Parsed-> Board: ${!!boardMarkdown}, TTS: ${!!ttsCommentary}, Chat: ${!!cleanedChatText}, Action: ${actionSignal}`);

            if (actionSignal === 'SUGGEST_COMPLETION') {
                 if (typeof VyukaApp.promptTopicCompletion === 'function') {
				    VyukaApp.promptTopicCompletion();
                 } else { console.error("Error: VyukaApp.promptTopicCompletion not defined."); }
				aiResponded = true;
                VyukaApp.manageUIState('suggestedCompletion');
            } else if (actionSignal === 'INITIATE_FINAL_QUIZ') {
                console.log("[ProcessGemini v25] AI initiated final quiz. Requesting quiz content...");
                aiResponded = true;
                state.finalQuizActive = true;
                if (VyukaApp.ui.continueBtn) VyukaApp.ui.continueBtn.disabled = true;
                await VyukaApp.requestFinalQuiz();
            }

			if (boardMarkdown) {
                 if (typeof VyukaApp.appendToWhiteboard === 'function') {
				    VyukaApp.appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                 } else { console.error("Error: VyukaApp.appendToWhiteboard not defined."); }
				aiResponded = true;
                if (actionSignal !== 'SUGGEST_COMPLETION' && actionSignal !== 'INITIATE_FINAL_QUIZ') {
                     state.aiIsWaitingForAnswer = false;
                }

                if (actionSignal !== 'SUGGEST_COMPLETION' && actionSignal !== 'INITIATE_FINAL_QUIZ') {
                    const lowerBoard = boardMarkdown.toLowerCase();
                    const taskKeywords = ['úloha k řešení', 'vyřešte tento příklad', 'zodpovězte následující', 'úkol:', 'otázka k procvičení'];
                    const taskHeaderRegex = /###\s*(úloha|příklad k řešení|úkol|otázka)/i;
                    const zadaniEndsWithQuestion = /\*\*zadání:\*\*[\s\S]*\?$/i;
                    if (taskKeywords.some(kw => lowerBoard.includes(kw)) || taskHeaderRegex.test(boardMarkdown) || zadaniEndsWithQuestion.test(boardMarkdown.replace(/\s+/g, ' '))) {
                        state.aiIsWaitingForAnswer = true;
                        console.log("[ProcessGemini v25] Task DETECTED on board, setting aiIsWaitingForAnswer = true.");
                    } else {
                         console.log("[ProcessGemini v25] No task detected on board.");
                    }
                }
			}

			if (cleanedChatText) {
				const ttsForChat = (!boardMarkdown && ttsCommentary && actionSignal !== 'SUGGEST_COMPLETION' && actionSignal !== 'INITIATE_FINAL_QUIZ') ? ttsCommentary : null;
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

            if (state.finalQuizActive) {
                VyukaApp.manageUIState('finalQuizInProgress');
            } else if (state.aiIsWaitingForAnswer) {
                VyukaApp.manageUIState('waitingForAnswer');
            } else if (state.aiSuggestedCompletion) {
                 VyukaApp.manageUIState('suggestedCompletion');
            } else {
                VyukaApp.manageUIState('learning');
            }
            // Button state management moved to VyukaApp.manageButtonStates() which is called in sendToGemini->finally or after other actions
		};

        VyukaApp.requestFinalQuiz = async () => {
            const state = VyukaApp.state;
            console.log("[RequestFinalQuiz v25] Requesting final quiz for topic:", state.currentTopic?.name);
            VyukaApp.updateGeminiThinkingState(true);
            const prompt = VyukaApp._buildFinalQuizPrompt();
            await VyukaApp.sendToGemini(prompt, false, true);
        };

        VyukaApp._buildInitialPrompt = () => { /* ... stejné jako v předchozí verzi v24 ... */
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
    * Po zadání ÚLOHY K ŘEŠENÍ v [BOARD_MARKDOWN], uveď v [TTS_COMMENTARY] **JASNĚ**, že čekáš odpověď v chatu. NIC VÍC. Klávesa "Pokračovat" bude pro uživatele deaktivována.
    * Po teorii/řešeném příkladu **NEČEKEJ na odpověď** a **NEPOKLÁDEJ otázky** typu "Je to jasné?", "Pokračujeme?". Uživatel použije tlačítko "Pokračovat".
6.  **Fokus na Téma:** **STRIKTNĚ se drž tématu lekce: "${topicName}".**
7.  **Navržení Dokončení Tématu:** Pokud usoudíš, že téma je dostatečně probráno (student odpovídá správně, byly probrány klíčové koncepty a typy příkladů), **místo dalšího obsahu nebo otázky**, pošli POUZE signál **${config.ACTION_INITIATE_FINAL_QUIZ}**. Neposílej v tomto případě žádný další text ani značky [BOARD_MARKDOWN] / [TTS_COMMENTARY]. Systém pak vyžádá finální test.
8.  **Finální Test:** POKUD obdržíš explicitní požadavek na finální test (bude v uživatelském promptu), vygeneruj 10 otázek (5 těžkých, 2 střední, 3 lehké) K TOMUTO TÉMATU ("${topicName}"). Formátuj je pro [BOARD_MARKDOWN]. Neposílej žádný [TTS_COMMENTARY] ani chat.

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

    	VyukaApp._buildContinuePrompt = () => { /* ... stejné jako v předchozí verzi v24 ... */
            const state = VyukaApp.state;
            const config = VyukaApp.config;
			const level = state.currentProfile?.skill_level || 'středně pokročilá';
			const topicName = state.currentTopic?.name || 'Neznámé téma';

			return `Pokračuj ve výkladu tématu "${topicName}" pro studenta úrovně "${level}" připravujícího se na PŘIJÍMACÍ ZKOUŠKY 9. třídy. Naváž logicky na PŘEDCHOZÍ OBSAH NA TABULI.

HLAVNÍ PRAVIDLA (PŘIPOMENUTÍ!):
* Všechny NOVÉ informace, **VÍCE ŘEŠENÝCH PŘÍKLADŮ** a ÚLOHY K ŘEŠENÍ patří VÝHRADNĚ A POUZE do bloku [BOARD_MARKDOWN]:.
* [TTS_COMMENTARY]: použij POUZE pro DOPLNĚNÍ k tabuli.
* Chat (mimo značky): NEPOUŽÍVEJ pro nový obsah.
* STRIKTNĚ se drž tématu "${topicName}" a úrovně 9. třídy.
* Zvyšuj náročnost. **Vždy ŘEŠENÉ příklady PŘED úlohou pro studenta.**
* Po zadání ÚLOHY v [BOARD_MARKDOWN], v [TTS_COMMENTARY] **JASNĚ řekni, že čekáš odpověď** v chatu. Klávesa "Pokračovat" bude deaktivována.
* Po teorii/řešeném příkladu **NEČEKEJ** a **NEPOKLÁDEJ otázky**. Uživatel použije tlačítko "Pokračovat".
* Pokud je téma probráno -> pošli **POUZE** signál **${config.ACTION_INITIATE_FINAL_QUIZ}**. Neposílej ${config.ACTION_SUGGEST_COMPLETION}.

DALŠÍ KROK: Vyber a vygeneruj JEDEN z následujících kroků (nebo navrhni dokončení testem):
A) Další část teorie/vysvětlení navazující na předchozí -> do [BOARD_MARKDOWN].
B) **Několik (alespoň 2) dalších ŘEŠENÝCH příkladů** (složitější) -> do [BOARD_MARKDOWN].
C) ÚLOHU K ŘEŠENÍ pro studenta (úroveň přijímaček) -> do [BOARD_MARKDOWN] (až PO dostatku řešených).
D) Pokud je téma probráno -> pošli signál ${config.ACTION_INITIATE_FINAL_QUIZ}.

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

        VyukaApp._buildFinalQuizPrompt = () => { /* ... stejné jako v předchozí verzi v24 ... */
            const state = VyukaApp.state;
            const topicName = state.currentTopic?.name || 'Neznámé téma';
            const level = state.currentProfile?.skill_level || 'středně pokročilá';

            return `Student si myslí, že probral téma "${topicName}" dostatečně. Vygeneruj prosím FINÁLNÍ TEST pro ověření znalostí tohoto tématu.
Požadovaná struktura testu:
- Celkem 10 otázek.
- 3 lehké otázky (difficulty 1-2/5)
- 2 středně těžké otázky (difficulty 3/5)
- 5 těžkých otázek (difficulty 4-5/5)

Všechny otázky musí být K TOMUTO KONKRÉTNÍMU TÉMATU: "${topicName}".
U každé otázky uveď její typ (např. multiple_choice, numeric, text) a správnou odpověď.
Celý test formátuj POUZE pro výstup do [BOARD_MARKDOWN]:. NEPOUŽÍVEJ [TTS_COMMENTARY] ani text do chatu. Začni s nadpisem "## Závěrečný Test: ${topicName}".

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

    	VyukaApp._buildChatInteractionPrompt = (userText) => { /* ... stejné jako v předchozí verzi v24 ... */
			const state = VyukaApp.state;
            const config = VyukaApp.config;
			const level = state.currentProfile?.skill_level || 'středně pokročilá';
			const topicName = state.currentTopic?.name || 'Neznámé téma';
            let baseInstruction;

            if (state.finalQuizActive) {
                baseInstruction = `Student odpovídá na otázku z FINÁLNÍHO TESTU k tématu "${topicName}". Studentova odpověď na poslední otázku je: "${userText}".

TVŮJ ÚKOL (ODPOVĚĎ POUZE DO CHATU):
1.  Stručně vyhodnoť odpověď studenta.
2.  Pokud je nesprávná, poskytni krátké navedení nebo vysvětlení.
3.  NEPOKLÁDEJ ŽÁDNÉ DALŠÍ OTÁZKY. Jen potvrď/oprav odpověď. Počkej na další odpověď studenta na další otázku testu.
4.  Až student odpoví na všech 10 otázek testu, vyhodnoť poslední odpověď a pak místo dalšího textu pošli signál ${config.ACTION_SUGGEST_COMPLETION}.`;
            } else if (state.aiIsWaitingForAnswer) {
				baseInstruction = `Student nyní poskytl odpověď na POSLEDNÍ úlohu zadanou na tabuli k tématu "${topicName}". Studentova odpověď je: "${userText}".
TVŮJ ÚKOL (ODPOVĚĎ POUZE DO CHATU - MIMO ZNAČKY!):
1.  **NEJPRVE ZCELA KONKRÉTNĚ vyhodnoť správnost TÉTO studentovy odpovědi ('${userText}')** vůči poslední úloze.
2.  Pokud je nesprávná/neúplná: **Jasně vysvětli chybu** a uveď správný postup/výsledek.
3.  Pokud je správná: **Krátce pochval (např. 'Správně!', 'Výborně!').**
4.  **Tato odpověď v chatu NESMÍ obsahovat nové definice, příklady ani zadání úloh.**
5.  **NAPROSTO NEPOKLÁDEJ ŽÁDNÉ DALŠÍ OTÁZKY.** Po tvé odpovědi bude uživateli aktivována klávesa "Pokračovat".
6.  **UKONČI svou odpověď ZDE.** Další krok zahájí student.`;
			} else {
				baseInstruction = `Student položil otázku nebo komentář k probíranému tématu "${topicName}": "${userText}".
TVŮJ ÚKOL (ODPOVĚĎ POUZE DO CHATU - MIMO ZNAČKY!):
1.  **Odpověz stručně a PŘÍMO k dotazu studenta.** Využij kontext tabule.
2.  **NEVYSVĚTLUJ novou látku** ani nezadávej nové příklady/úlohy v chatu.
3.  **Pokud dotaz směřuje MIMO aktuální téma "${topicName}", jemně ho vrať zpět.**
4.  **Tato odpověď v chatu NESMÍ obsahovat nové definice, příklady ani zadání úloh.**
5.  **Na konci své odpovědi NEPOKLÁDEJ otázky typu "Stačí takto?", "Je to srozumitelnější?". Odpověz POUZE na otázku a IHNED SKONČI.** Po tvé odpovědi bude uživateli aktivována klávesa "Pokračovat".`;
			}

			return `${baseInstruction}
PŘIPOMENUTÍ PRAVIDEL CHATU: Odpovídej POUZE běžným textem (mimo značky). Nepoužívej [BOARD_MARKDOWN] ani [TTS_COMMENTARY]. Buď stručný a věcný.`;
		};

    	VyukaApp._buildGeminiPayloadContents = (userPrompt, isChatInteraction = false, isFinalQuizRequest = false) => { /* ... stejné jako v předchozí verzi v24 ... */
			const state = VyukaApp.state;
			const config = VyukaApp.config;
            const level = state.currentProfile?.skill_level || 'středně pokročilá';
			const topicName = state.currentTopic?.name || 'Neznámé téma';
            let systemInstruction = `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. NAPROSTO VŽDY dodržuj tato pravidla:
1.  **[BOARD_MARKDOWN]:** Všechny definice, vzorce, vysvětlení, **VÍCE ŘEŠENÝCH PŘÍKLADŮ** a ÚLOHY K ŘEŠENÍ patří VÝHRADNĚ A POUZE sem: \`\`\`markdown ... \`\`\`. Používej Markdown a $$...$$ pro matematiku. Řešené příklady PŘED úlohami pro studenta.
2.  **[TTS_COMMENTARY]:** Použij POUZE pro DOPLNĚNÍ k tabuli, NEOPAKUJ text doslova.
3.  **Chat (Text mimo značky):** Použij MINIMÁLNĚ, POUZE pro HODNOCENÍ odpovědi studenta nebo VELMI krátkou PŘÍMOU odpověď na jeho otázku. NIKDY v chatu neuváděj nové definice, příklady, úlohy, vysvětlení. NEPIŠ pozdravy ani fráze. Po tvé odpovědi v chatu bude uživateli automaticky aktivována klávesa "Pokračovat" (pokud nejde o otázku od tebe nebo finální test).
4.  **Struktura a Náročnost:** Postupuj logicky, zvyšuj náročnost úloh k úrovni PŘIJÍMAČEK 9. třídy. **Vždy VÍCE řešených příkladů PŘED úlohou pro studenta.**
5.  **Interakce:** Po zadání ÚLOHY v [BOARD_MARKDOWN], v [TTS_COMMENTARY] JASNĚ řekni, že čekáš odpověď v chatu. V JINÝCH případech (teorie, řešené příklady) NEČEKEJ na odpověď a NEPOKLÁDEJ otázky ("Jasné?", "Pokračujeme?").
6.  **Fokus na Téma:** **STRIKTNĚ se drž tématu lekce: "${topicName}".**
7.  **Odpovědi v chatu:** Pokud student ODPOVÍDÁ na úlohu nebo POKLÁDÁ OTÁZKU, odpovídej POUZE textem do CHATU podle instrukcí v uživatelském promptu. Po správné odpovědi JEN potvrď a UKONČI. Po přímé odpovědi na otázku IHNED SKONČI. **NIKDY nekonči otázkami jako "Stačí takto?" apod.**
8.  **Navržení Dokončení Tématu:** Když je téma probráno, místo dalšího obsahu pošli **POUZE** signál **${config.ACTION_INITIATE_FINAL_QUIZ}**. Systém pak automaticky vyžádá finální test.
9.  **Finální Test:** POKUD obdržíš explicitní požadavek na finální test (bude v uživatelském promptu), vygeneruj 10 otázek (5 těžkých, 2 střední, 3 lehké) K TOMUTO TÉMATU ("${topicName}"). Formátuj je pro [BOARD_MARKDOWN]. NEPOUŽÍVEJ [TTS_COMMENTARY] ani text do chatu. Po vygenerování testu v [BOARD_MARKDOWN] NIC DALŠÍHO NEDĚLEJ, nepiš do chatu, nečekej na odpověď. Student bude odpovídat na otázky testu postupně v chatu. Ty budeš hodnotit každou odpověď zvlášť.`;

            let modelConfirmation = `Rozumím. Budu striktně dodržovat pravidla. Obsah pro tabuli pouze v [BOARD_MARKDOWN]:. Komentář pouze v [TTS_COMMENTARY]:. Chat (mimo značky) jen pro hodnocení nebo velmi krátkou přímou odpověď na otázku, bez nového obsahu a zbytečných frází či otázek. Budu se držet tématu "${topicName}" a úrovně 9. třídy. Nebudu pokládat zbytečné otázky. Pokud bude téma probráno, pošlu signál ${config.ACTION_INITIATE_FINAL_QUIZ}. Pokud budu požádán o finální test, dodám ho v [BOARD_MARKDOWN].`;

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
            let requestError = null; // Store potential error

			if (!config.GEMINI_API_KEY || !config.GEMINI_API_KEY.startsWith('AIzaSy')) {
				VyukaApp.showToast("Chyba Konfigurace", "Chybí API klíč pro AI.", "error");
				VyukaApp.updateGeminiThinkingState(false);
				return;
			}
			// ... (zbytek kontrol zůstává stejný) ...
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

			console.log(`Sending to Gemini (Chat: ${isChatInteraction}, QuizReq: ${isFinalQuizRequest}): "${prompt.substring(0, 80)}..."`);
			const timestamp = new Date();
			VyukaApp.updateGeminiThinkingState(true);

			const contents = VyukaApp._buildGeminiPayloadContents(prompt, isChatInteraction, isFinalQuizRequest);
			const body = {
				contents,
				generationConfig: {
					temperature: isFinalQuizRequest ? 0.4 : 0.6,
					topP: 0.95,
					topK: 40,
					maxOutputTokens: 8192,
				},
				safetySettings: [ /* ... stejné jako předtím ... */ ]
			};

			try {
				const response = await fetch(config.GEMINI_API_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});

				if (!response.ok) { /* ... zpracování chyby ... */ }
				const data = await response.json();
                console.log("[DEBUG v25] Raw Gemini Response Data:", JSON.stringify(data, null, 2));

				if (data.promptFeedback?.blockReason) { /* ... zpracování chyby ... */ }
				const candidate = data.candidates?.[0];
				if (!candidate) { /* ... zpracování chyby ... */ }
                if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) { /* ... zpracování chyby ... */ }
				const text = candidate.content?.parts?.[0]?.text;
                if (!text && candidate.finishReason !== 'STOP') { /* ... zpracování chyby ... */ }

				state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] });
				state.geminiChatContext.push({ role: "model", parts: [{ text: text || "" }] });

				if (state.geminiChatContext.length > config.MAX_GEMINI_HISTORY_TURNS * 2 + 2) {
					state.geminiChatContext.splice(2, state.geminiChatContext.length - (config.MAX_GEMINI_HISTORY_TURNS * 2 + 2));
				}
				await VyukaApp.processGeminiResponse(text || "", timestamp);

			} catch (error) { // 'error' je zde definováno
                requestError = error; // Uložíme chybu
				console.error('Chyba komunikace s Gemini:', error);
                console.error('Error stack:', error.stack);
				VyukaApp.showToast(`Chyba AI: ${error.message}`, "error");
				VyukaApp.handleGeminiError(error.message, timestamp);
			} finally {
				VyukaApp.updateGeminiThinkingState(false);
                // Volání manageButtonStates se postará o logiku tlačítka "Pokračovat"
                // na základě aktuálního stavu (aiIsWaitingForAnswer, finalQuizActive, geminiIsThinking atd.)
                VyukaApp.manageButtonStates();
			}
		};

    	VyukaApp.handleGeminiError = (msg, time) => {
			const state = VyukaApp.state;
			VyukaApp.removeThinkingIndicator();
			VyukaApp.addChatMessage(`Nastala chyba při komunikaci s AI: ${msg}`, 'gemini', false, time, null, `(Chyba: ${msg})`);
            state.aiIsWaitingForAnswer = false;
            state.finalQuizActive = false;
            VyukaApp.manageUIState('learning'); // Reset UI state
            // VyukaApp.manageButtonStates() se volá v finally bloku sendToGemini
		};

	} catch (e) {
		console.error("FATAL SCRIPT ERROR (AI Interaction v25):", e);
		document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--vyuka-accent-error,#FF4757);color:var(--vyuka-text-primary,#E0E7FF);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky (AI Interaction).</p><p style="margin-top:15px;"><a href="#" onclick="location.reload()" style="color:var(--vyuka-accent-secondary,#00F5FF); text-decoration:underline; font-weight:bold;">Obnovit stránku</a></p><details style="margin-top: 20px; color: #f0f0f0;"><summary style="cursor:pointer; color: var(--vyuka-text-primary,#E0E7FF);">Detaily</summary><pre style="margin-top:10px;padding:15px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;max-height:300px; overflow-y:auto; border-radius:8px;">${e.message}\n${e.stack}</pre></details></div>`;
	}

})(window.VyukaApp);