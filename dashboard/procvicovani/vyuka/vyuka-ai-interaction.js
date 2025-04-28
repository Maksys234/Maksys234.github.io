// Файл: procvicovani/vyuka/vyuka-ai-interaction.js
// Логика взаимодействия с AI Gemini, управление чатом, учебной сессией, парсинг ответов AI

// Получаем доступ к глобальному пространству имен
window.VyukaApp = window.VyukaApp || {};

(function(VyukaApp) { // Используем IIFE для локальной области видимости, передаем VyukaApp
	'use strict';

	try {
		// --- Constants & Configuration (AI Interaction Specific) ---
		// Добавляем конфигурацию для Gemini в существующий объект VyukaApp.config
        // Предполагаем, что VyukaApp.config уже создан в vyuka-core.js
		const config = VyukaApp.config = VyukaApp.config || {}; // Убедимся, что config существует
		config.GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // !!! Production: Use a secure method !!!
		config.GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;
		config.MAX_GEMINI_HISTORY_TURNS = 12; // Количество запоминаемых пар вопрос-ответ
        config.ACTION_SUGGEST_COMPLETION = "[ACTION:SUGGEST_COMPLETION]"; // Сигнал для предложения завершения

        // --- Topic Loading and Progress ---
        VyukaApp.loadNextUncompletedTopic = async () => {
			const state = VyukaApp.state;
			const ui = VyukaApp.ui;
			if (!state.currentUser || state.topicLoadInProgress || !state.supabase) return;

			state.topicLoadInProgress = true;
			VyukaApp.setLoadingState('currentTopic', true); // Indicate loading state
			state.currentTopic = null; // Reset current topic
            state.aiSuggestedCompletion = false; // Reset suggestion flag

			// Clear previous state
			if (ui.chatMessages) { ui.chatMessages.innerHTML = ''; } // Clear chat
            // Вызываем функцию из другого файла через VyukaApp
            if (typeof VyukaApp.clearWhiteboard === 'function') {
			    VyukaApp.clearWhiteboard(false); // Clear whiteboard without toast
            } else { console.error("Error: VyukaApp.clearWhiteboard not defined"); }
			state.geminiChatContext = []; // Clear Gemini context
            state.aiIsWaitingForAnswer = false; // Reset waiting state

			VyukaApp.manageUIState('loadingTopic'); // Update UI to show loading

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
					VyukaApp.manageUIState('noPlan'); // Handle no plan found
					return;
				}
				state.currentPlanId = plans[0].id;

				// 2. Find the next uncompleted activity in the plan
				const { data: activities, error: activityError } = await state.supabase
					.from('plan_activities')
					.select('id, title, description, topic_id')
					.eq('plan_id', state.currentPlanId)
					.eq('completed', false)
					.order('day_of_week') // Order by day
					.order('time_slot')   // Then by time slot within the day
					.limit(1);            // Get the very next one

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
							// Ignore 'PGRST116' (0 rows) error, just means no topic found
							if (topicError && topicError.code !== 'PGRST116') throw topicError;
							if (topic) {
								name = topic.name || name; // Prefer topic name if available
								desc = topic.description || desc; // Prefer topic desc
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
						topic_id: activity.topic_id // Store topic_id if available
					};

					// Update UI with the topic name
					if (ui.currentTopicDisplay) {
						ui.currentTopicDisplay.innerHTML = `Téma: <strong>${VyukaApp.sanitizeHTML(name)}</strong>`;
					}

					// 5. Start the AI learning session for this topic
					await VyukaApp.startLearningSession();

				} else {
					// No more uncompleted activities found
					console.log("All activities in the plan are completed.");
					VyukaApp.manageUIState('planComplete'); // Handle plan completion
				}

			} catch (error) {
				console.error('Error loading next topic:', error);
				VyukaApp.showToast(`Chyba načítání tématu: ${error.message}`, "error");
				VyukaApp.manageUIState('error', { errorMessage: error.message }); // Handle error state
			} finally {
				state.topicLoadInProgress = false;
				VyukaApp.setLoadingState('currentTopic', false); // Turn off loading indicator
			}
		};

        // --- VERSION 22: MODIFIED handleMarkTopicComplete with enhanced logging ---
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
				  return; // Prevent concurrent operations
			 }

			console.log(`[MarkComplete v22] Attempting to mark activity ID: ${state.currentTopic.activity_id} (${state.currentTopic.name}) as complete.`);
			state.topicLoadInProgress = true;
			state.aiSuggestedCompletion = false; // Reset suggestion flag
			VyukaApp.manageButtonStates(); // Disable buttons during operation

			try {
				console.log(`[MarkComplete v22] Preparing to update activity ID: ${state.currentTopic.activity_id} in plan ID: ${state.currentTopic.plan_id}`);
				console.log(`[MarkComplete v22] Points to award: ${config.POINTS_TOPIC_COMPLETE}`);

				// Mark activity as completed in the database
				const { error: updateError } = await state.supabase
					.from('plan_activities')
					.update({ completed: true, updated_at: new Date().toISOString() })
					.eq('id', state.currentTopic.activity_id); // Match the specific activity ID

				if (updateError) {
					 console.error(`[MarkComplete v22] Supabase update FAILED for activity ${state.currentTopic.activity_id}:`, updateError);
					 throw updateError; // Throw to be caught below
				}
                // *Explicit Success Log*
				console.log(`[MarkComplete v22] >>> DB UPDATE SUCCESS for activity ${state.currentTopic.activity_id} <<<`);

                // Award points (calling function defined elsewhere via VyukaApp)
                 if (typeof VyukaApp.awardPoints === 'function') {
				    await VyukaApp.awardPoints(config.POINTS_TOPIC_COMPLETE);
                 } else { console.error("Error: VyukaApp.awardPoints not defined."); }

				// Check achievements (calling function defined elsewhere via VyukaApp)
				if (typeof VyukaApp.checkAndAwardAchievements === 'function') {
					await VyukaApp.checkAndAwardAchievements(state.currentUser.id);
				} else {
					console.warn("[MarkComplete v22] Achievement checking function not found.");
				}

				VyukaApp.showToast(`Téma "${state.currentTopic.name}" dokončeno! Přesměrovávám...`, "success", 2500);

				// Redirect after successful operations
                console.log("[MarkComplete v22] Scheduling redirect after success.");
				setTimeout(() => {
                     console.log("[MarkComplete v22] Redirecting now...");
                     window.location.href = '/dashboard/procvicovani/main.html';
                 }, 500); // Short delay

			} catch (error) {
				console.error(`[MarkComplete v22] CATCH BLOCK: Error during topic completion (Activity ID: ${state.currentTopic?.activity_id}):`, error);
				VyukaApp.showToast(`Chyba uložení dokončení tématu: ${error.message || 'Neznámá chyba'}`, "error", 6000);
				// Reset state on error
				state.topicLoadInProgress = false;
				VyukaApp.manageButtonStates(); // Re-enable buttons
			}
			// Removed finally block - success path redirects, error path handles state in catch
		};
        // --- END VERSION 22 MODIFICATION ---

        // --- Learning Session & Chat ---
        VyukaApp.startLearningSession = async () => {
			const state = VyukaApp.state;
			if (!state.currentTopic) return;

			// Generate a unique ID for this learning session
			state.currentSessionId = VyukaApp.generateSessionId();
			VyukaApp.clearInitialChatState(); // Remove "AI is ready" message

			VyukaApp.manageUIState('requestingExplanation'); // Update UI to show AI is working

			// Build the initial prompt for Gemini to start the topic
			const prompt = VyukaApp._buildInitialPrompt();

			// Send the prompt to Gemini
			await VyukaApp.sendToGemini(prompt);
		};

    	VyukaApp.requestContinue = async () => {
			const state = VyukaApp.state;
			console.log("[RequestContinue] Triggered. AI Waiting:", state.aiIsWaitingForAnswer, "AI Suggested Completion:", state.aiSuggestedCompletion);
			// Prevent interaction if AI is busy or no topic is loaded
			if (state.geminiIsThinking || !state.currentTopic) return;

            // If AI is waiting for an answer to a task, prompt user to answer first
			if (state.aiIsWaitingForAnswer) {
				VyukaApp.showToast("Nejprve odpovězte na úlohu v chatu.", "warning", 3000);
				console.warn("[RequestContinue] Blocked: AI is waiting for an answer.");
				return;
			}

            // If AI has suggested completion, guide user to use the modal
            if (state.aiSuggestedCompletion) {
                VyukaApp.showToast("AI navrhlo dokončení tématu. Pro dokončení použijte modální okno nebo požádejte AI o pokračování.", "info");
                return;
            }

			// Build the prompt for continuing the lesson
			const prompt = VyukaApp._buildContinuePrompt();

			// Send the prompt to Gemini
			await VyukaApp.sendToGemini(prompt);
		};

    	VyukaApp.addChatMessage = async (displayMessage, sender, saveToDb = true, timestamp = new Date(), ttsText = null, originalContent = null) => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;
			if (!ui.chatMessages) return;

			VyukaApp.clearInitialChatState(); // Remove initial greeting if present

			const id = `msg-${Date.now()}`; // Unique ID for the message element
			let avatarContent = sender === 'user'
				? VyukaApp.getInitials(state.currentProfile, state.currentUser?.email) // User initials or avatar
				: 'AI'; // Simple AI label

			const div = document.createElement('div');
			div.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`; // Add 'model' class for AI
			div.id = id;
			div.style.opacity = '0'; // Start hidden for animation

			const avatarDiv = `<div class="message-avatar">${avatarContent}</div>`;

			// Create message bubble
			const bubbleDiv = document.createElement('div');
			bubbleDiv.className = 'message-bubble';

			// Create content container inside bubble
			const bubbleContentDiv = document.createElement('div');
			bubbleContentDiv.className = 'message-bubble-content';

			// Render Markdown content into the container (using core function)
			VyukaApp.renderMarkdown(bubbleContentDiv, displayMessage, true); // isChat = true

			// Add TTS button for AI messages if supported
			if (sender === 'gemini' && state.speechSynthesisSupported) {
				const ttsButton = document.createElement('button');
				ttsButton.className = 'tts-listen-btn btn-tooltip';
				ttsButton.title = 'Poslechnout';
				ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
				const textForSpeech = ttsText || displayMessage; // Use specific TTS text if provided
                // ZMĚNA v features: Uložení textu pro TTS do data atributu
				ttsButton.dataset.textToSpeak = textForSpeech;
                // ZMĚNA v features: Přidání listeneru přímo zde
				ttsButton.addEventListener('click', (e) => {
					e.stopPropagation(); // Prevent bubbling
                    const buttonElement = e.currentTarget;
                    const text = buttonElement.dataset.textToSpeak;
                    if (text && typeof VyukaApp.speakText === 'function') {
					    VyukaApp.speakText(text); // V chatu není potřeba highlight
                    } else {
                        console.warn("No text found for TTS button in chat or speakText function missing.");
                    }
				});
				bubbleContentDiv.appendChild(ttsButton); // Add button next to text content
			}

			bubbleDiv.appendChild(bubbleContentDiv); // Add content to bubble

			const timeDiv = `<div class="message-timestamp">${VyukaApp.formatTimestamp(timestamp)}</div>`;

			// Combine elements
			div.innerHTML = avatarDiv + bubbleDiv.outerHTML + timeDiv; // Insert bubble HTML

			ui.chatMessages.appendChild(div);

			// Trigger MathJax for the new message if needed
			if (window.MathJax && typeof window.MathJax.typesetPromise === 'function' && (displayMessage.includes('$') || displayMessage.includes('\\'))) {
                console.log(`[MathJax v19] Queueing typeset for chat message bubble: ${id}`);
				setTimeout(() => {
					window.MathJax.typesetPromise([bubbleContentDiv])
						.then(() => console.log(`[MathJax v19] Typeset successful for chat bubble ${id}`))
						.catch((err) => console.error(`[MathJax v19] Typeset error for chat bubble ${id}: ${err.message}`));
				}, 0);
			}

			// Scroll to the new message
			div.scrollIntoView({ behavior: 'smooth', block: 'end' });

			// Fade in animation
			requestAnimationFrame(() => { div.style.opacity = '1'; });

			// Re-initialize tooltips if any were added (like the TTS button)
			VyukaApp.initTooltips();

			// Save to database if enabled and all required data is present
			const contentToSave = originalContent !== null ? originalContent : displayMessage;
			if (saveToDb && state.supabase && state.currentUser && state.currentTopic && state.currentSessionId) {
				try {
					await state.supabase.from('chat_history').insert({
						user_id: state.currentUser.id,
						session_id: state.currentSessionId,
						topic_id: state.currentTopic.topic_id, // Store topic_id
						topic_name: state.currentTopic.name, // Store topic name for context
						role: sender === 'gemini' ? 'model' : 'user',
						content: contentToSave // Save original or display content
					});
				} catch (e) {
					console.error("Chat save error:", e);
					VyukaApp.showToast("Chyba ukládání chatu.", "error");
				}
			}
            VyukaApp.manageButtonStates(); // Update UI state
		};

        VyukaApp.addThinkingIndicator = () => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;
			// Don't add multiple indicators
			if (state.thinkingIndicatorId || !ui.chatMessages) return;

			VyukaApp.clearInitialChatState(); // Clear welcome message if present

			const id = `thinking-${Date.now()}`;
			const div = document.createElement('div');
			div.className = 'chat-message model'; // Style as an AI message
			div.id = id;
			// Simplified HTML for the thinking indicator
			div.innerHTML = `
				<div class="message-avatar">AI</div>
				<div class="message-thinking-indicator">
					<span class="typing-dot"></span>
					<span class="typing-dot"></span>
					<span class="typing-dot"></span>
				</div>
			`;
			ui.chatMessages.appendChild(div);
			div.scrollIntoView({ behavior: 'smooth', block: 'end' }); // Scroll to show it
			state.thinkingIndicatorId = id; // Store the ID to remove it later
            VyukaApp.manageButtonStates(); // Update button states
		};

    	VyukaApp.removeThinkingIndicator = () => {
			const state = VyukaApp.state;
			if (state.thinkingIndicatorId) {
				document.getElementById(state.thinkingIndicatorId)?.remove(); // Remove the element
				state.thinkingIndicatorId = null; // Clear the stored ID
			}
		};

    	VyukaApp.updateGeminiThinkingState = (isThinking) => {
			const state = VyukaApp.state;
			const ui = VyukaApp.ui;
			state.geminiIsThinking = isThinking;

			// Update global chat loading state
			VyukaApp.setLoadingState('chat', isThinking);

			// Toggle thinking class on the AI avatar corner indicator
			ui.aiAvatarCorner?.classList.toggle('thinking', isThinking);
            // If stopping thinking, also ensure speaking indicator is removed
            if (!isThinking) ui.aiAvatarCorner?.classList.remove('speaking');

			// Add or remove the visual "..." thinking indicator in the chat
			if (isThinking) {
				VyukaApp.addThinkingIndicator();
			} else {
				VyukaApp.removeThinkingIndicator();
			}

            // Buttons like Send, Continue, Mic should be updated based on this state
            // VyukaApp.manageButtonStates(); // This is called within setLoadingState
		};

    	VyukaApp.handleSendMessage = async () => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;
			const text = ui.chatInput?.value.trim();

			// Prevent sending if: no text, AI is busy, no topic loaded, or STT is active
			if (!text || state.geminiIsThinking || !state.currentTopic || state.isListening) return;

            state.lastInteractionTime = Date.now(); // Update last interaction time
            state.aiSuggestedCompletion = false; // User interaction cancels AI suggestion

            // If AI was waiting for an answer, reset the flag as the user has now answered
            if (state.aiIsWaitingForAnswer) {
                console.log("[HandleSend] Resetting aiIsWaitingForAnswer state.");
                state.aiIsWaitingForAnswer = false;
                VyukaApp.manageUIState('learning'); // Reset UI from waiting state
            }

			// Clear input and resize textarea
			if (ui.chatInput) {
				ui.chatInput.value = '';
				VyukaApp.autoResizeTextarea();
			}

			// Add user message to chat UI and DB (saveToDb=true)
			await VyukaApp.addChatMessage(text, 'user', true, new Date(), null, text);

			// Add user message to Gemini context history
			state.geminiChatContext.push({ role: "user", parts: [{ text }] });

			// Update UI to show AI is thinking
			VyukaApp.updateGeminiThinkingState(true);

			// Build the appropriate prompt for Gemini based on context
			let promptForGemini = VyukaApp._buildChatInteractionPrompt(text);

			// Send the prompt to Gemini API
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

			// Clear chat UI and show initial state
			if (ui.chatMessages) {
				ui.chatMessages.innerHTML = `
					<div class="initial-chat-interface">
						<div class="ai-greeting-avatar"><i class="fas fa-robot"></i></div>
						<h3 class="initial-chat-title">AI Tutor Justax je připraven</h3>
						<p class="initial-chat-message">Chat vymazán. Čekám na načtení tématu nebo vaši zprávu.</p>
						<div class="initial-chat-status"><span class="status-dot online"></span> Online</div>
					</div>`;
			}

			// Clear internal state
			state.geminiChatContext = []; // Reset Gemini context

			VyukaApp.showToast("Historie chatu vymazána.", "info");

			// Delete history from database for this session
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
             VyukaApp.manageButtonStates(); // Update UI states (e.g., disable clear/save buttons)
		};

    	VyukaApp.saveChatToPDF = async () => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;

			// Check if there's anything to save
			if (!ui.chatMessages || ui.chatMessages.children.length === 0 || !!ui.chatMessages.querySelector('.initial-chat-interface')) {
				VyukaApp.showToast("Není co uložit.", "warning");
				return;
			}

			// Check if html2pdf library is loaded
			if (typeof html2pdf === 'undefined') {
				VyukaApp.showToast("Chyba: PDF knihovna nenalezena.", "error");
				console.error("html2pdf library is not loaded!");
				return;
			}

			VyukaApp.showToast("Generuji PDF...", "info", 4000); // Indicate progress

			// Create a temporary element to hold the content for PDF generation
			const elementToExport = document.createElement('div');
			elementToExport.style.padding = "15mm"; // Add padding for PDF margins

			// Add basic styles and header to the PDF content
			elementToExport.innerHTML = `
				<style>
					body { font-family: 'Poppins', sans-serif; font-size: 10pt; line-height: 1.5; color: #333; }
					.chat-message { margin-bottom: 12px; max-width: 90%; page-break-inside: avoid; }
					.user { margin-left: 10%; }
					.model { margin-right: 10%; }
					.message-bubble { display: inline-block; padding: 8px 14px; border-radius: 15px; background-color: #e9ecef; }
					.user .message-bubble { background-color: #d1e7dd; } /* Light green for user */
					.message-timestamp { font-size: 8pt; color: #6c757d; margin-top: 4px; display: block; }
					.user .message-timestamp { text-align: right; }
					h1 { font-size: 16pt; color: #0d6efd; text-align: center; margin-bottom: 5px; }
					p.subtitle { font-size: 9pt; color: #6c757d; text-align: center; margin: 0 0 15px 0; }
					hr { border: 0; border-top: 1px solid #ccc; margin: 15px 0; }
					/* Hide elements not needed in PDF */
					.tts-listen-btn { display: none; }
                    .message-avatar { display: none; } /* Hide avatars in PDF */
                    /* MathJax styling for PDF */
                    mjx-math { font-size: 1em; }
                    pre { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 0.8em; border-radius: 6px; overflow-x: auto; font-size: 0.9em; white-space: pre-wrap; word-wrap: break-word; }
                    code { background-color: #e9ecef; padding: 0.1em 0.3em; border-radius: 3px; }
                    pre code { background: none; padding: 0; }
				</style>
				<h1>Chat s AI Tutorem - ${VyukaApp.sanitizeHTML(state.currentTopic?.name || 'Neznámé téma')}</h1>
				<p class="subtitle">Vygenerováno: ${new Date().toLocaleString('cs-CZ')}</p>
				<hr>
			`;

			// Clone and append chat messages to the export element
			Array.from(ui.chatMessages.children).forEach(msgElement => {
				if (msgElement.classList.contains('chat-message') && !msgElement.id.startsWith('thinking-')) {
					const clone = msgElement.cloneNode(true);
					clone.querySelector('.message-avatar')?.remove();
					clone.querySelector('.tts-listen-btn')?.remove();
					elementToExport.appendChild(clone);
				}
			});

			// Generate filename
			const filename = `chat-${state.currentTopic?.name?.replace(/[^a-z0-9]/gi, '_') || 'vyuka'}-${Date.now()}.pdf`;

			// Configure html2pdf
			const pdfOptions = {
				margin: 15, // Margins in mm
				filename: filename,
				image: { type: 'jpeg', quality: 0.95 },
				html2canvas: { scale: 2, useCORS: true, logging: false },
				jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
			};

			// Generate and save the PDF
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
			console.log("[ParseGemini v19] Raw input:", rawText ? rawText.substring(0, 150) + "..." : "EMPTY");
			const config = VyukaApp.config;
			const boardMarker = "[BOARD_MARKDOWN]:";
			const ttsMarker = "[TTS_COMMENTARY]:";
			const actionMarker = config.ACTION_SUGGEST_COMPLETION; // "[ACTION:SUGGEST_COMPLETION]"

            // Regex to capture content after markers, handling optional code blocks
            // Updated regex to be less strict about space after marker and handle potential ```markdown labels
			const boardRegex = /\[BOARD_MARKDOWN]:\s*(?:```(?:markdown)?\s*([\s\S]*?)\s*```|([\s\S]*?))(?=\s*\[TTS_COMMENTARY]:|\s*\[BOARD_MARKDOWN]:|\s*\[ACTION:SUGGEST_COMPLETION]|$)/i;
            const ttsRegex = /\[TTS_COMMENTARY]:\s*(?:```\s*([\s\S]*?)\s*```|([\s\S]*?))(?=\s*\[BOARD_MARKDOWN]:|\s*\[TTS_COMMENTARY]:|\s*\[ACTION:SUGGEST_COMPLETION]|$)/i;
            const actionRegex = /(\[ACTION:SUGGEST_COMPLETION])/i; // Simple detection is enough

			let remainingText = rawText || "";
			let boardMarkdown = "";
			let ttsCommentary = "";
			let actionSignal = null;

			// 1. Check for Action Signal FIRST
			const actionMatch = remainingText.match(actionRegex);
			if (actionMatch) {
				actionSignal = 'SUGGEST_COMPLETION';
				remainingText = remainingText.replace(actionMatch[0], "").trim(); // Remove the action signal
				console.log(`[ParseGemini v19] Found action signal: ${actionSignal}`);
				// If ONLY the action signal was present, return immediately
				if (remainingText.length === 0) {
					return { boardMarkdown: "", ttsCommentary: "", chatText: "", actionSignal };
				}
			}

			// 2. Extract Board Markdown
			const boardMatch = remainingText.match(boardRegex);
            console.log("[ParseGemini v19] Board Regex Match:", boardMatch);
			if (boardMatch) {
                // Group 1 is content within triple backticks, Group 2 is content without backticks
				boardMarkdown = (boardMatch[1] || boardMatch[2] || "").trim();
                console.log(`[ParseGemini v19] Extracted Board Content (Raw): "${boardMarkdown.substring(0,70)}..."`);
				// Remove the entire matched section including the marker
                remainingText = remainingText.replace(boardMatch[0], "").trim();
				console.log(`[ParseGemini v19] Found board content. Length: ${boardMarkdown.length}`);
                 // Clean potential leading "markdown" keyword if it's likely just a label
                 if (boardMarkdown.toLowerCase().startsWith('markdown')) {
                    const potentialNewlineIndex = boardMarkdown.indexOf('\n');
                    if (potentialNewlineIndex !== -1 && potentialNewlineIndex < 15) { // If 'markdown' is on its own line or close to start
                        boardMarkdown = boardMarkdown.substring(potentialNewlineIndex + 1).trim();
                        console.warn("[ParseGemini v19] Cleaned leading 'markdown' word.");
                    } else if (boardMarkdown.length < 15) { // If the whole content is just 'markdown' or very short
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
                // Remove the entire matched section including the marker
				remainingText = remainingText.replace(ttsMatch[0], "").trim();
				console.log(`[ParseGemini v19] Found TTS content. Length: ${ttsCommentary.length}`);
			} else {
                 console.log(`[ParseGemini v19] Marker "${ttsMarker}" not found or malformed.`);
            }

			// 4. The rest is chat text (clean potential leftover markers/backticks)
			let chatText = remainingText
				.replace(/```(markdown)?\s*|\s*```/g, '') // Remove leftover backticks/markdown hints
                .replace(/\[BOARD_MARKDOWN]:/gi, '') // Remove markers if regex failed partially
                .replace(/\[TTS_COMMENTARY]:/gi, '')
                .replace(/\[ACTION:SUGGEST_COMPLETION]/gi, '') // Remove action marker if missed
                .trim();

            console.log("[ParseGemini v19] Result - Board:", boardMarkdown ? boardMarkdown.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini v19] Result - TTS:", ttsCommentary ? ttsCommentary.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini v19] Result - Chat:", chatText ? chatText.substring(0, 50) + "..." : "None");
            console.log("[ParseGemini v19] Result - Action:", actionSignal);

			return { boardMarkdown, ttsCommentary, chatText, actionSignal };
		};

        // ZMĚNA v features: Odebráno automatické spouštění TTS
    	VyukaApp.processGeminiResponse = (rawText, timestamp) => {
			const state = VyukaApp.state;
			VyukaApp.removeThinkingIndicator(); // Stop the "..." indicator
            state.lastInteractionTime = Date.now(); // Update interaction time

			console.log("[ProcessGemini v19] Processing Raw Response:", rawText ? rawText.substring(0, 100) + "..." : "Empty Response");

			if (!rawText) {
				VyukaApp.handleGeminiError("AI vrátilo prázdnou odpověď.", timestamp);
                VyukaApp.manageButtonStates(); // Ensure buttons are re-enabled
				return;
			}

			// Parse the raw text into structured parts
			const { boardMarkdown, ttsCommentary, chatText, actionSignal } = VyukaApp.parseGeminiResponse(rawText);

			let aiResponded = false; // Flag to track if AI provided any usable content

			// Clean chat text (remove potential artifacts - use helper from ui-features)
            let cleanedChatText = "";
             if (typeof VyukaApp.cleanChatMessage === 'function') {
                 cleanedChatText = VyukaApp.cleanChatMessage(chatText);
             } else {
                 cleanedChatText = chatText.trim(); // Fallback
                 console.warn("cleanChatMessage function not found, using basic trim.");
             }


            console.log(`[ProcessGemini v19] Parsed-> Board: ${!!boardMarkdown}, TTS: ${!!ttsCommentary}, Chat: ${!!cleanedChatText}, Action: ${actionSignal}`);

			// 1. Handle Action Signal (if present)
			if (actionSignal === 'SUGGEST_COMPLETION') {
                // Call function from ui-features
                 if (typeof VyukaApp.promptTopicCompletion === 'function') {
				    VyukaApp.promptTopicCompletion(); // Show the modal
                 } else { console.error("Error: VyukaApp.promptTopicCompletion not defined."); }
				aiResponded = true;
                VyukaApp.manageUIState('suggestedCompletion'); // Update UI state
			}

			// 2. Handle Whiteboard Content
			if (boardMarkdown) {
                // Call function from ui-features
                 if (typeof VyukaApp.appendToWhiteboard === 'function') {
				    VyukaApp.appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                 } else { console.error("Error: VyukaApp.appendToWhiteboard not defined."); }

				aiResponded = true;
                if (actionSignal !== 'SUGGEST_COMPLETION') {
                     state.aiIsWaitingForAnswer = false; // Board content usually doesn't require immediate answer
                }

                // Check if the board content contains a task for the user
                // (Unless completion was just suggested)
                if (actionSignal !== 'SUGGEST_COMPLETION') {
                    const lowerBoard = boardMarkdown.toLowerCase();
                    const taskKeywords = ['úloha k řešení', 'vyřešte tento příklad', 'zodpovězte následující', 'úkol:', 'otázka k procvičení'];
                    const taskHeaderRegex = /###\s*(úloha|příklad k řešení|úkol|otázka)/i;
                    const zadaniEndsWithQuestion = /\*\*zadání:\*\*[\s\S]*\?$/i;

                    if (taskKeywords.some(kw => lowerBoard.includes(kw)) || taskHeaderRegex.test(boardMarkdown) || zadaniEndsWithQuestion.test(boardMarkdown.replace(/\s+/g, ' '))) {
                        state.aiIsWaitingForAnswer = true;
                        console.log("[ProcessGemini v19] Task DETECTED on board, setting aiIsWaitingForAnswer = true.");
                    } else {
                         console.log("[ProcessGemini v19] No task detected on board.");
                    }
                }
			}

			// 3. Handle Chat Text
			if (cleanedChatText) {
				// If there was *only* TTS commentary (no board), use it for the chat message's TTS
                // ZMĚNA v features: Předání TTS textu do addChatMessage, ale nevolání speakText
				const ttsForChat = (!boardMarkdown && ttsCommentary && actionSignal !== 'SUGGEST_COMPLETION') ? ttsCommentary : null;
				VyukaApp.addChatMessage(cleanedChatText, 'gemini', true, timestamp, ttsForChat, chatText); // Save original chatText
				aiResponded = true;
			}

			// 4. Handle cases where AI response was empty or unusable
			if (!aiResponded && !actionSignal) {
                // ZMĚNA v features: Pokud nebylo nic jiného, a byl jen TTS komentář, přidej ho alespoň do chatu jako fallback
                if (ttsCommentary) {
                    VyukaApp.addChatMessage(`(Komentář k tabuli: ${ttsCommentary})`, 'gemini', true, timestamp, ttsCommentary, `(Komentář: ${ttsCommentary})`);
                     aiResponded = true;
                } else {
				    VyukaApp.addChatMessage("(AI neodpovědělo očekávaným formátem nebo odpověď byla prázdná)", 'gemini', false, timestamp, null, rawText || "(Prázdná/neplatná odpověď)");
				    console.warn("AI sent no usable content and no action signal.");
                }
                state.aiIsWaitingForAnswer = false; // Ensure user isn't stuck waiting
			}

            // 5. Update overall UI state based on final context
            if (state.aiIsWaitingForAnswer) {
                VyukaApp.manageUIState('waitingForAnswer');
            } else if (state.aiSuggestedCompletion) {
                 VyukaApp.manageUIState('suggestedCompletion');
            } else {
                VyukaApp.manageUIState('learning');
            }
		};

        // --- MODIFIED: _buildInitialPrompt (v22 - Removed optional chat message) ---
    	VyukaApp._buildInitialPrompt = () => {
			const state = VyukaApp.state;
            const config = VyukaApp.config;
			const level = state.currentProfile?.skill_level || 'středně pokročilá'; // Default skill level
			const topicName = state.currentTopic?.name || 'Neznámé téma'; // Current topic name

			return `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. Tvé vysvětlení musí být strukturované, přesné a profesionální.
Téma lekce: "${topicName}".
Cílová úroveň studenta: "${level}".

HLAVNÍ PRAVIDLA (DODRŽUJ VŽDY!):
1.  **Obsah na tabuli ([BOARD_MARKDOWN]):** Všechny klíčové informace (definice, věty, vzorce), **MINIMÁLNĚ DVA ŘEŠENÉ PŘÍKLADY (nejprve jednoduchý, pak složitější)** a ÚLOHY K ŘEŠENÍ MUSÍ být ve formátu Markdown zde. Tabule je HLAVNÍ výukový prostor. Používej $$...$$ pro matematiku.
2.  **Hlasový komentář ([TTS_COMMENTARY]):** Slouží pro DOPLŇUJÍCÍ hlasový komentář k obsahu na tabuli (shrnutí, kontext, důraz). NEOPAKUJ doslova text z tabule.
3.  **Chat (Text mimo značky):** Používej MINIMÁLNĚ. NIKDY v chatu nezadávej nové úlohy/příklady a nepiš zbytečné uvítací nebo ukončovací fráze.
4.  **Struktura a Náročnost:** Postupuj logicky: základy -> **VÍCE řešených příkladů (různá obtížnost)** -> **náročné ÚLOHY K ŘEŠENÍ úrovně přijímaček**. VŽDY zařaď nejprve řešené příklady, až POTOM úlohu k řešení studentem (vše na tabuli!). Používej RŮZNÉ typy úloh (výpočty, slovní úlohy, úlohy s více kroky, zlomky, parametry - pokud relevantní).
5.  **Interakce:**
    * Po zadání ÚLOHY K ŘEŠENÍ na tabuli, v [TTS_COMMENTARY] **JASNĚ uveď, že očekáváš odpověď** studenta v chatu. **NEPOKLÁDEJ další otázku v chatu.** Systém zablokuje tlačítko "Pokračuj".
    * Po běžném vysvětlení nebo řešeném příkladu **ABSOLUTNĚ NEČEKEJ na odpověď** a **STRIKTNĚ ZAKÁZÁNO ptát se "Je to jasné?"**, "Rozumíš?", "Pokračujeme?". Student sám klikne na "Pokračuj".
6.  **Fokus na Téma:** **STRIKTNĚ se drž tématu lekce: "${topicName}".** Nevysvětluj nesouvisející pokročilé koncepty, pokud nejsou PŘÍMOU součástí tohoto konkrétního tématu pro 9. třídu.
7.  **Navržení Dokončení Tématu:** Pokud usoudíš, že téma bylo dostatečně probráno (student odpovídá správně, byly probrány klíčové koncepty a typy příkladů), **místo dalšího obsahu nebo otázky**, pošli POUZE signál **${config.ACTION_SUGGEST_COMPLETION}**. Neposílej v tomto případě žádný další text ani značky [BOARD_MARKDOWN] / [TTS_COMMENTARY].

PRVNÍ KROK:
Začni se ZÁKLADNÍ DEFINICÍ nebo klíčovým konceptem tématu "${topicName}". Poskytni **alespoň JEDEN ŘEŠENÝ PŘÍKLAD** (jednoduchý). Nepiš žádný text do chatu.

POŽADOVANÝ FORMÁT ODPOVĚDI (pro první krok):
[BOARD_MARKDOWN]:
\`\`\`markdown
## ${topicName} - Základy

### [Krátký, výstižný podnadpis, např. Definice Lineární Rovnice]
(Zde napiš stručnou, přesnou definici nebo úvodní koncept. Použij **tučné písmo** pro termíny a $$...$$ pro matematiku.)

### První řešený příklad (Základní)
(Zde uveď první VELMI JEDNODUCHÝ řešený příklad ilustrující definici. Jasně odděl zadání a kroky řešení.)
**Zadání:** ...
**Řešení:**
* Krok 1: ... ($$...$$)
* Krok 2: ... ($$...$$)
* Výsledek: $$...$$
\`\`\`
[TTS_COMMENTARY]:
(Zde napiš hlasový komentář: Stručné představení tématu a shrnutí toho, co je na tabuli – definice a první příklad. Zdůrazni klíčový bod. NEPOKLÁDEJ OTÁZKU a nezdrav.)
`; // Removed optional chat message line
		};
        // --- END MODIFIED: _buildInitialPrompt ---

    	VyukaApp._buildContinuePrompt = () => {
			const state = VyukaApp.state;
            const config = VyukaApp.config;
			const level = state.currentProfile?.skill_level || 'středně pokročilá';
			const topicName = state.currentTopic?.name || 'Neznámé téma';

			return `Pokračuj ve výkladu tématu "${topicName}" pro studenta úrovně "${level}" připravujícího se na PŘIJÍMACÍ ZKOUŠKY 9. třídy. Naváž logicky na PŘEDCHOZÍ OBSAH NA TABULI.

HLAVNÍ PRAVIDLA (PŘIPOMENUTÍ!):
* Všechny NOVÉ informace, **VÍCE ŘEŠENÝCH PŘÍKLADŮ** a ÚLOHY K ŘEŠENÍ patří VÝHRADNĚ do [BOARD_MARKDOWN].
* [TTS_COMMENTARY] použij pro DOPLNĚNÍ k tabuli. NE text do chatu.
* STRIKTNĚ se drž tématu "${topicName}" a úrovně 9. třídy.
* Postupně ZVYŠUJ NÁROČNOST příkladů a úloh k úrovni přijímaček. **Vždy uveď dostatek řešených příkladů PŘED zadáním úlohy studentovi.**
* Po zadání ÚLOHY K ŘEŠENÍ na tabuli, v [TTS_COMMENTARY] **JASNĚ řekni, že čekáš odpověď** v chatu.
* Po teorii/řešeném příkladu **ABSOLUTNĚ NEČEKEJ na odpověď** a **STRIKTNĚ ZAKÁZÁNO ptát se "Je to jasné?", "Rozumíš?", "Pokračujeme?".**
* Pokud usoudíš, že téma je dostatečně probráno, **místo dalšího obsahu pošli POUZE signál ${config.ACTION_SUGGEST_COMPLETION}**.

DALŠÍ KROK: Vyber a vygeneruj JEDEN z následujících kroků (nebo navrhni dokončení):
A) Další část teorie/vysvětlení navazující na předchozí.
B) **Několik (alespoň 2) dalších ŘEŠENÝCH příkladů** (složitější než předchozí, může být i slovní úloha).
C) ÚLOHU K ŘEŠENÍ pro studenta (až PO dostatečném množství řešených příkladů; náročnost úrovně přijímaček).
D) Pokud je téma probráno -> pošli signál ${config.ACTION_SUGGEST_COMPLETION}.

POŽADOVANÝ FORMÁT ODPOVĚDI (Pokud NEPOSÍLÁŠ signál):
[BOARD_MARKDOWN]:
\`\`\`markdown
### [Nadpis další části / Řešené příklady (Typ) / Úloha k řešení (Typ)]
(Zde uveď text vysvětlení NEBO zadání a PODROBNÁ řešení příkladů NEBO POUZE ZADÁNÍ úlohy k řešení. Používej Markdown, $$...$$.)
\`\`\`
[TTS_COMMENTARY]:
(Zde napiš hlasový komentář k NOVÉMU obsahu. Pokud jsi zadal ÚLOHU K ŘEŠENÍ, **JASNĚ řekni:** "Nyní zkuste tuto úlohu vyřešit vy a napište mi výsledek/postup do chatu." Pokud jde o teorii/řešený příklad, stručně shrň hlavní myšlenku nebo upozorni na klíčový krok. **NEPOKLÁDEJ OTÁZKU.**)
`; // Removed optional chat message from here too
		};

        // --- MODIFIED: _buildChatInteractionPrompt (v22 - More explicit evaluation instruction) ---
    	VyukaApp._buildChatInteractionPrompt = (userText) => {
			const state = VyukaApp.state;
            const config = VyukaApp.config; // Included for consistency, may use later
			const level = state.currentProfile?.skill_level || 'středně pokročilá';
			const topicName = state.currentTopic?.name || 'Neznámé téma';

			let baseInstruction;

			if (state.aiIsWaitingForAnswer) {
				// Case 1: User is answering a task
				baseInstruction = `Student nyní poskytl odpověď na POSLEDNÍ úlohu zadanou na tabuli k tématu "${topicName}". Studentova odpověď je: "${userText}".

TVŮJ ÚKOL:
1.  **NEJPRVE ZCELA KONKRÉTNĚ vyhodnoť správnost TÉTO studentovy odpovědi ('${userText}')** vůči poslední úloze. Použij matematickou terminologii.
2.  Pokud je odpověď nesprávná nebo neúplná: **Jasně vysvětli chybu** a uveď správný postup nebo výsledek. Buď konstruktivní.
3.  Pokud je odpověď správná: **Krátce pochval (např. 'Správně!', 'Výborně!'). NEPOKLÁDEJ ŽÁDNÉ DALŠÍ OTÁZKY** (ani 'Chceš pokračovat?' apod.). Jen potvrď správnost.
4.  **V obou případech (správná i nesprávná odpověď): UKONČI svou odpověď ZDE.** Další krok zahájí student kliknutím na "Pokračuj". Nezačínej další výklad ani úlohu.`;
			} else {
				// Case 2: User is asking a question or making a comment
				baseInstruction = `Student položil otázku nebo komentář k probíranému tématu "${topicName}": "${userText}".
TVŮJ ÚKOL:
1.  **Odpověz stručně a PŘÍMO k dotazu studenta.** Využij kontext toho, co je aktuálně na TABULI.
2.  **NEVYSVĚTLUJ novou látku** ani nezadávej nové příklady v chatu. Odkazuj na tabuli nebo řekni, že to bude probráno dále.
3.  **Pokud studentův dotaz směřuje MIMO aktuální téma "${topicName}", jemně ho vrať zpět.**
4.  Udržuj profesionální, ale nápomocný tón (úroveň "${level}").
5.  **Na konci své odpovědi NEPOKLÁDEJ otázky typu "Stačí takto?", "Je to srozumitelnější?" apod. Odpověz POUZE na otázku a SKONČI.** Příklad POUZE přímé odpovědi: "Ano, tento krok je správný." NIC VÍC.`;
			}

			return `${baseInstruction}

PRAVIDLA CHATU (PŘIPOMENUTÍ): Odpovídej POUZE běžným textem do chatu. Nepoužívej [BOARD_MARKDOWN] ani [TTS_COMMENTARY]. Buď stručný a věcný.`;
		};
        // --- END MODIFIED: _buildChatInteractionPrompt ---

    	VyukaApp._buildGeminiPayloadContents = (userPrompt, isChatInteraction = false) => {
			const state = VyukaApp.state;
			const config = VyukaApp.config;
            const level = state.currentProfile?.skill_level || 'středně pokročilá';
			const topicName = state.currentTopic?.name || 'Neznámé téma';

			// System instruction remains consistent
            const systemInstruction = `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. VŽDY dodržuj tato pravidla:
1.  **Obsah na tabuli ([BOARD_MARKDOWN]):** Všechny definice, vzorce, vysvětlení, **VÍCE ŘEŠENÝCH PŘÍKLADŮ** a ÚLOHY K ŘEŠENÍ patří VÝHRADNĚ sem: \`\`\`markdown ... \`\`\`. Používej Markdown a $$...$$ pro matematiku. Příklady předchází úlohám.
2.  **Hlasový komentář ([TTS_COMMENTARY]):** Používej pro DOPLNĚNÍ k tabuli, NEOPAKUJ text doslova.
3.  **Chat (Text mimo značky):** Používej MINIMÁLNĚ. NIKDY v něm nezadávej nové úlohy/příklady. NEPIŠ pozdravy ani zbytečné fráze.
4.  **Struktura a Náročnost:** Postupuj logicky, zvyšuj náročnost úloh k úrovni PŘIJÍMACÍCH ZKOUŠEK 9. třídy. **Vždy dej VÍCE řešených příkladů PŘED úlohou pro studenta.**
5.  **Interakce:** Po zadání ÚLOHY K ŘEŠENÍ na tabuli, v [TTS_COMMENTARY] jasně řekni, že čekáš na odpověď studenta v chatu. V JINÝCH případech (teorie, řešené příklady) NEČEKEJ na odpověď a NEPOKLÁDEJ zbytečné dotazy ("Jasné?", "Pokračujeme?").
6.  **Fokus na Téma:** **STRIKTNĚ se drž tématu lekce: "${topicName}".** Nevysvětluj nesouvisející pokročilé koncepty.
7.  **Odpovědi v chatu:** Pokud student ODPOVÍDÁ na úlohu nebo POKLÁDÁ OTÁZKU, odpovídej POUZE textem do CHATU podle instrukcí v uživatelském promptu. Po správné odpovědi studenta JEN potvrď a UKONČI odpověď. **Když odpovídáš na otázku studenta, odpověz PŘÍMO a ihned SKONČI. NIKDY nekonči otázkami jako "Stačí takto?", "Je to jasné?" apod.**
8.  **Navržení Dokončení Tématu:** Když usoudíš, že téma je probráno, místo dalšího obsahu pošli **POUZE** signál **${config.ACTION_SUGGEST_COMPLETION}**.`;

			// Get the last N turns of the conversation history
			const history = state.geminiChatContext.slice(-config.MAX_GEMINI_HISTORY_TURNS * 2); // *2 for user+model turn

			// Construct the current user message
			const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] };

			// Combine system instruction, model's confirmation, history, and current message
			const contents = [
				// Initial system setup (always included)
				{ role: "user", parts: [{ text: systemInstruction }] },
				{ role: "model", parts: [{ text: `Rozumím. Budu se řídit pravidly. Výklad a úlohy budou na tabuli ve formátu [BOARD_MARKDOWN], přičemž dám více řešených příkladů před úlohami pro studenta. Komentář bude v [TTS_COMMENTARY]. Chat využiji minimálně nebo pro reakce na studentovy otázky/řešení. Nebudu psát zbytečné fráze. Budu se držet tématu "${topicName}" a zvyšovat náročnost pro úroveň 9. třídy. Nebudu pokládat zbytečné otázky. Pokud usoudím, že téma je probráno, pošlu signál ${config.ACTION_SUGGEST_COMPLETION}.` }] }, // Updated model confirmation
				// Recent conversation history
				...history,
				// The current user prompt
				currentUserMessage
			];

			return contents;
		};

    	VyukaApp.sendToGemini = async (prompt, isChatInteraction = false) => {
			const config = VyukaApp.config;
			const state = VyukaApp.state;

			// Pre-flight checks
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
			const timestamp = new Date(); // Record time before sending
			VyukaApp.updateGeminiThinkingState(true); // Update UI to show thinking

			// Build the payload
			const contents = VyukaApp._buildGeminiPayloadContents(prompt, isChatInteraction);
			const body = {
				contents,
				generationConfig: {
					temperature: 0.6, // Slightly creative but focused
					topP: 0.95,
					topK: 40,
					maxOutputTokens: 8192, // Max allowed for Flash
				},
				// Safety settings to block least harmful content
				safetySettings: [
					{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
					{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
					{ category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
					{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
				]
			};

			// Make the API call
			try {
				const response = await fetch(config.GEMINI_API_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});

				// Handle API errors (non-2xx responses)
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

				// Parse successful response
				const data = await response.json();
                console.log("[DEBUG] Raw Gemini Response Data:", JSON.stringify(data, null, 2)); // Log raw response

				// Check for prompt blocking (e.g., safety filters on input)
				if (data.promptFeedback?.blockReason) {
					throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}. Zkuste přeformulovat.`);
				}

				const candidate = data.candidates?.[0];
				if (!candidate) {
					throw new Error('AI neposkytlo platnou odpověď (no candidate).');
				}

                // Check for problematic finish reasons (other than STOP or MAX_TOKENS)
                if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
                     console.warn(`Gemini finishReason: ${candidate.finishReason}.`);
                     if (candidate.finishReason === 'SAFETY') {
                          throw new Error('Odpověď blokována bezpečnostním filtrem AI.');
                     }
                }

				const text = candidate.content?.parts?.[0]?.text;

                // Check if text is empty but finish reason wasn't STOP
                if (!text && candidate.finishReason !== 'STOP') {
                     if (candidate.finishReason === 'MAX_TOKENS') {
                          throw new Error('Odpověď AI byla příliš dlouhá (Max Tokens).');
                     } else {
                          throw new Error('AI vrátilo prázdnou odpověď (Důvod: '+(candidate.finishReason || 'Neznámý')+').');
                     }
                }

				// Add the interaction (user prompt + model response) to history
				state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] });
				state.geminiChatContext.push({ role: "model", parts: [{ text: text || "" }] }); // Add even if text is empty

				// Limit history size
				if (state.geminiChatContext.length > config.MAX_GEMINI_HISTORY_TURNS * 2 + 2) { // +2 for system prompt/response
					state.geminiChatContext.splice(2, state.geminiChatContext.length - (config.MAX_GEMINI_HISTORY_TURNS * 2 + 2));
				}

				// Process the received text
				VyukaApp.processGeminiResponse(text || "", timestamp);

			} catch (error) {
				console.error('Chyba komunikace s Gemini:', error);
                console.error('Error stack:', error.stack); // Log stack trace for debugging
				VyukaApp.showToast(`Chyba AI: ${error.message}`, "error");
				VyukaApp.handleGeminiError(error.message, timestamp); // Handle error display in UI
			} finally {
				VyukaApp.updateGeminiThinkingState(false); // Ensure thinking state is always turned off
			}
		};

    	VyukaApp.handleGeminiError = (msg, time) => {
			const state = VyukaApp.state;
			VyukaApp.removeThinkingIndicator(); // Remove thinking dots
			// Add an error message to the chat UI (don't save to DB)
			VyukaApp.addChatMessage(`Nastala chyba při komunikaci s AI: ${msg}`, 'gemini', false, time, null, `(Chyba: ${msg})`);
            state.aiIsWaitingForAnswer = false; // Ensure user isn't stuck waiting
            VyukaApp.manageUIState('learning'); // Reset UI state
		};


	} catch (e) {
		// Fatal error in AI interaction script
		console.error("FATAL SCRIPT ERROR (AI Interaction):", e);
		document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--accent-pink,#ff33a8);color:var(--white,#fff);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky (AI Interaction).</p><p style="margin-top:15px;"><a href="#" onclick="location.reload()" style="color:var(--accent-cyan,#00e0ff); text-decoration:underline; font-weight:bold;">Obnovit stránku</a></p><details style="margin-top: 20px; color: #f0f0f0;"><summary style="cursor:pointer; color: var(--white,#fff);">Detaily</summary><pre style="margin-top:10px;padding:15px;background:rgba(0, 0, 0, 0.4);border:1px solid rgba(255, 255, 255, 0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;max-height: 300px; overflow-y: auto; border-radius: 8px;">${e.message}\n${e.stack}</pre></details></div>`;
	}

})(window.VyukaApp); // Pass the namespace object to the IIFE