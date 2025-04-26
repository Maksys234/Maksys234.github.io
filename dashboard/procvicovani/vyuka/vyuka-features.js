// Файл: procvicovani/vyuka/vyuka-features.js
// Логика специфичных функций: Темы, Чат, Gemini, TTS/STT, Доска, Уведомления, Очки, Модальные окна, Достижения

// Получаем доступ к глобальному пространству имен
window.VyukaApp = window.VyukaApp || {};

(function(VyukaApp) { // Используем IIFE для локальной области видимости, передаем VyukaApp
	'use strict';

	try {
		// --- Constants & Configuration (Features) ---
		const config = VyukaApp.config; // Access core config
		config.GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // !!! Production: Use a secure method !!!
		config.GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;
		config.MAX_GEMINI_HISTORY_TURNS = 12;
        config.ACTION_SUGGEST_COMPLETION = "[ACTION:SUGGEST_COMPLETION]";

        const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

        // --- Helper Functions (Feature Specific or relying on Core) ---
        const cleanChatMessage = (text) => {
			if (typeof text !== 'string') return text;
			let cleanedText = text.replace(/``/g, '');
			const lines = cleanedText.split('\n');
			const filteredLines = lines.filter(line => {
				const trimmedLine = line.trim();
				return trimmedLine !== '.' && trimmedLine !== '?';
			});
			cleanedText = filteredLines.join('\n');
			// Specific check for Gemini's placeholder response
			if (cleanedText.trim() === "(Poslechněte si komentář)") {
				console.log("[Clean] Removing placeholder text.");
				return ""; // Return empty string instead of placeholder
			}
			cleanedText = cleanedText.trim();
			return cleanedText;
		};

        // --- TTS/STT Functions ---
        VyukaApp.loadVoices = () => {
			const state = VyukaApp.state;
			if (!state.speechSynthesisSupported) return;
			try {
				const voices = window.speechSynthesis.getVoices();
				if (!voices || voices.length === 0) {
					console.warn("No voices available yet.");
					// Attempt to reload voices if list is empty (some browsers load asynchronously)
					setTimeout(VyukaApp.loadVoices, 100);
					return;
				}
				console.log('Available voices:', voices.length, voices.map(v=>({name:v.name, lang:v.lang})));
				// Find preferred Czech voice
				let preferredVoice = voices.find(voice => voice.lang === 'cs-CZ' && /female|žena|ženský|iveta|zuzana/i.test(voice.name)); // Prefer female voices
				if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang === 'cs-CZ'); // Any Czech
				if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang.startsWith('cs')); // Any cs-*
				if (!preferredVoice) preferredVoice = voices.find(v => v.default) || voices[0]; // Default or first

				state.czechVoice = preferredVoice;
				console.log("Selected voice:", state.czechVoice?.name, state.czechVoice?.lang);
			} catch (e) {
				console.error("Error loading voices:", e);
				state.czechVoice = null;
			}
		};

        VyukaApp.removeBoardHighlight = () => {
			const state = VyukaApp.state;
			if (state.currentlyHighlightedChunk) {
				state.currentlyHighlightedChunk.classList.remove('speaking-highlight');
				state.currentlyHighlightedChunk = null;
			}
		};

        // ZMĚNA: Přidán argument targetChunkElement pro zvýraznění
        VyukaApp.speakText = (text, targetChunkElement = null) => {
			const state = VyukaApp.state;
			const ui = VyukaApp.ui;
			if (!state.speechSynthesisSupported) {
				VyukaApp.showToast("Syntéza řeči není podporována.", "warning");
				return;
			}
			if (!text) {
				console.warn("TTS: No text provided.");
				return;
			}

			// Clean text for speech synthesis (remove Markdown, MathJax, etc.)
			// *** SYNTAX ERROR FIXED HERE *** (escaped [], ())
			const plainText = text
				.replace(/<[^>]*>/g, ' ')        // Remove HTML tags
				.replace(/[`*#_~\[\]\(\)]/g, '') // Remove Markdown formatting chars - Escaped special chars
				.replace(/\$\$(.*?)\$\$/g, 'matematický vzorec') // Replace MathJax display math
				.replace(/\$(.*?)\$/g, 'vzorec') // Replace MathJax inline math
				.replace(/\s+/g, ' ')            // Normalize whitespace
				.trim();

			if (!plainText) {
				console.warn("TTS: Text empty after cleaning, skipping speech.");
				return;
			}

			// Cancel any ongoing speech
			window.speechSynthesis.cancel();
			VyukaApp.removeBoardHighlight(); // Remove previous highlight

			const utterance = new SpeechSynthesisUtterance(plainText);
			utterance.lang = 'cs-CZ';
			utterance.rate = 0.9; // Slightly slower for clarity
			utterance.pitch = 1.0;

			// Assign voice
			if (state.czechVoice) {
				utterance.voice = state.czechVoice;
			} else {
				// Try loading voices again if none selected yet
				VyukaApp.loadVoices();
				if (state.czechVoice) {
					utterance.voice = state.czechVoice;
				} else {
					console.warn("Czech voice not found, using default.");
				}
			}

			// Event handlers for the utterance
			utterance.onstart = () => {
				console.log("TTS started.");
				ui.aiAvatarCorner?.classList.add('speaking');
				ui.boardSpeakingIndicator?.classList.add('active');
                // ZMĚNA: Zvýraznění konkrétního bloku, pokud je předán
				if (targetChunkElement) {
					targetChunkElement.classList.add('speaking-highlight');
					state.currentlyHighlightedChunk = targetChunkElement;
				}
				VyukaApp.manageButtonStates(); // Update UI state
			};

			utterance.onend = () => {
				console.log("TTS finished.");
				ui.aiAvatarCorner?.classList.remove('speaking');
				ui.boardSpeakingIndicator?.classList.remove('active');
				VyukaApp.removeBoardHighlight();
				VyukaApp.manageButtonStates();
			};

			utterance.onerror = (event) => {
				console.error(`SpeechSynthesisUtterance.onerror -> Error: ${event.error}. Utterance text (start): ${plainText.substring(0, 50)}...`);
				let toastMessage = `Chyba při čtení: ${event.error}`;
				if (event.error === 'not-allowed') {
					toastMessage += ". Prosím, klikněte na stránku pro povolení zvuku.";
				} else if (event.error === 'interrupted') {
					// Often happens when user requests new speech quickly - not a critical error
					console.warn("TTS interrupted, likely by new speech request.");
					return; // Don't show error toast for simple interruptions
				}
				VyukaApp.showToast(toastMessage, 'error');
				// Ensure UI cleanup on error
				ui.aiAvatarCorner?.classList.remove('speaking');
				ui.boardSpeakingIndicator?.classList.remove('active');
				VyukaApp.removeBoardHighlight();
				VyukaApp.manageButtonStates();
			};

			console.log(`TTS: Attempting to speak. Voice: ${utterance.voice?.name}, lang: ${utterance.lang}`);
			try {
				window.speechSynthesis.speak(utterance);
			} catch (speakError) {
				console.error("Error calling window.speechSynthesis.speak():", speakError);
				VyukaApp.showToast('Chyba spuštění hlasového výstupu.', 'error');
				ui.aiAvatarCorner?.classList.remove('speaking');
				ui.boardSpeakingIndicator?.classList.remove('active');
				VyukaApp.removeBoardHighlight();
				VyukaApp.manageButtonStates();
			}
		};

        VyukaApp.stopSpeech = () => {
			const state = VyukaApp.state;
			const ui = VyukaApp.ui;
			if (state.speechSynthesisSupported) {
				window.speechSynthesis.cancel();
				// Clean up UI indicators immediately
				ui.aiAvatarCorner?.classList.remove('speaking');
				ui.boardSpeakingIndicator?.classList.remove('active');
				VyukaApp.removeBoardHighlight();
				console.log("Speech cancelled.");
				VyukaApp.manageButtonStates();
			}
		};

        VyukaApp.initializeSpeechRecognition = () => {
			const state = VyukaApp.state;
			const ui = VyukaApp.ui;
			if (!state.speechRecognitionSupported) {
				console.warn("Speech Recognition not supported.");
                if(ui.micBtn) {
                    ui.micBtn.disabled = true;
                    ui.micBtn.title = "Rozpoznávání řeči není podporováno";
                }
				return;
			}

			// Standard or webkit prefix
			const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
			state.speechRecognition = new SpeechRecognition();

			// Configuration
			state.speechRecognition.lang = 'cs-CZ';
			state.speechRecognition.interimResults = false; // Don't need interim results
			state.speechRecognition.maxAlternatives = 1; // Only need the best guess
			state.speechRecognition.continuous = false; // Stop after first utterance

			// Event Handlers
			state.speechRecognition.onresult = (event) => {
				const transcript = event.results[0][0].transcript;
				console.log('Speech recognized:', transcript);
				if (ui.chatInput) {
					ui.chatInput.value = transcript; // Populate the chat input
					VyukaApp.autoResizeTextarea(); // Adjust textarea size if needed
				}
			};

			state.speechRecognition.onerror = (event) => {
				console.error('Speech recognition error:', event.error);
				let errorMsg = "Chyba rozpoznávání řeči";
				if (event.error === 'no-speech') errorMsg = "Nerozpoznal jsem žádnou řeč.";
				else if (event.error === 'audio-capture') errorMsg = "Chyba mikrofonu.";
				else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
					errorMsg = "Přístup k mikrofonu zamítnut.";
					if(ui.micBtn) ui.micBtn.disabled = true; // Disable button if permission denied
				}
				VyukaApp.showToast(errorMsg, 'error');
				VyukaApp.stopListening(); // Ensure listening state is reset
			};

			state.speechRecognition.onend = () => {
				console.log('Speech recognition ended.');
				VyukaApp.stopListening(); // Clean up UI state
			};

			console.log("Speech Recognition initialized.");
		};

        VyukaApp.startListening = () => {
			const state = VyukaApp.state;
			const ui = VyukaApp.ui;
			if (!state.speechRecognitionSupported || !state.speechRecognition || state.isListening) return;

			// Check for microphone permission first
			navigator.mediaDevices.getUserMedia({ audio: true })
				.then(() => {
					// Permission granted, start recognition
					try {
						state.speechRecognition.start();
						state.isListening = true;
						ui.micBtn?.classList.add('listening');
                        if(ui.micBtn) ui.micBtn.title = "Zastavit hlasový vstup";
						console.log('Speech recognition started.');
						VyukaApp.manageButtonStates();
					} catch (e) {
						// Handle errors like recognition already started
						console.error("Error starting speech recognition:", e);
						VyukaApp.showToast("Nepodařilo se spustit rozpoznávání.", "error");
						VyukaApp.stopListening();
					}
				})
				.catch(err => {
					// Permission denied or other error
					console.error("Microphone access denied:", err);
					VyukaApp.showToast("Přístup k mikrofonu je nutný pro hlasový vstup.", "warning");
                    if(ui.micBtn) ui.micBtn.disabled = true; // Disable mic button if denied
					VyukaApp.stopListening(); // Ensure state is reset
				});
		};

        VyukaApp.stopListening = () => {
			const state = VyukaApp.state;
			const ui = VyukaApp.ui;
			if (!state.speechRecognitionSupported || !state.speechRecognition || !state.isListening) return;

			try {
				state.speechRecognition.stop(); // Attempt to stop
			} catch (e) {
				// Ignore errors if it's already stopped
			} finally {
				state.isListening = false;
				ui.micBtn?.classList.remove('listening');
                if(ui.micBtn) ui.micBtn.title = "Zahájit hlasový vstup";
				console.log('Speech recognition stopped.');
				VyukaApp.manageButtonStates();
			}
		};

        VyukaApp.handleMicClick = () => {
			const state = VyukaApp.state;
			if (!state.speechRecognitionSupported) {
				VyukaApp.showToast("Rozpoznávání řeči není podporováno.", "warning");
				return;
			}
			if (state.isListening) {
				VyukaApp.stopListening();
			} else {
				VyukaApp.startListening();
			}
		};

        // --- Whiteboard ---
        VyukaApp.clearWhiteboard = (showToastMsg = true) => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;
			if (!ui.whiteboardContent) return;
			ui.whiteboardContent.innerHTML = '';
			state.boardContentHistory = []; // Clear history as well
			console.log("Whiteboard cleared.");
			if (showToastMsg) VyukaApp.showToast('Vymazáno', "Tabule vymazána.", "info");
			VyukaApp.manageButtonStates(); // Update button states (e.g., disable clear if empty)
		};

        // ZMĚNA: Přidání TTS tlačítka a listeneru přímo zde
    	VyukaApp.appendToWhiteboard = (markdownContent, commentaryText) => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;
			if (!ui.whiteboardContent || !ui.whiteboardContainer) return;

			const chunkDiv = document.createElement('div');
			chunkDiv.className = 'whiteboard-chunk';
			chunkDiv.style.opacity = '0'; // Start hidden for fade-in effect

			const contentDiv = document.createElement('div');
			const originalText = markdownContent || ''; // Store original markdown

			// Render Markdown content
			VyukaApp.renderMarkdown(contentDiv, originalText, false); // isChat = false

			// Create and configure TTS button
			const ttsButton = document.createElement('button');
			ttsButton.className = 'tts-listen-btn btn-tooltip';
			ttsButton.title = 'Poslechnout komentář';
			ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
			// Use commentary if provided, otherwise use the original markdown text for speech
			const textForSpeech = commentaryText || originalText;
            // ZMĚNA: Uložení textu pro TTS do data atributu tlačítka
			ttsButton.dataset.textToSpeak = textForSpeech;

			if (state.speechSynthesisSupported && textForSpeech.trim()) {
                // ZMĚNA: Přidání listeneru přímo zde
				ttsButton.addEventListener('click', (e) => {
					e.stopPropagation(); // Prevent potential parent clicks
                    const buttonElement = e.currentTarget; // Get the button that was clicked
                    const text = buttonElement.dataset.textToSpeak;
                    const parentChunk = buttonElement.closest('.whiteboard-chunk'); // Find the parent chunk
                    if (text) {
					    VyukaApp.speakText(text, parentChunk); // Pass the chunk for highlighting
                    } else {
                        console.warn("No text found for TTS button in whiteboard chunk.");
                    }
				});
				chunkDiv.appendChild(ttsButton); // Add TTS button to the chunk
			}

			chunkDiv.appendChild(contentDiv); // Add rendered markdown content
			ui.whiteboardContent.appendChild(chunkDiv); // Add the chunk to the whiteboard

			state.boardContentHistory.push(originalText); // Store original markdown in history
			console.log("Appended content to whiteboard.");

			// Scroll to the new content
			// Use smooth scrolling if available
            if (typeof chunkDiv.scrollIntoView === 'function') {
                // Use a timeout to allow rendering before scrolling
                setTimeout(() => {
                    chunkDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    console.log("Scrolled to start of new whiteboard chunk.");
                }, 100); // Small delay
            } else {
                // Fallback for older browsers or environments where scrollIntoView might be limited
                ui.whiteboardContainer.scrollTop = chunkDiv.offsetTop;
                 console.warn("scrollIntoView not fully supported, using offsetTop fallback.");
            }

			// Retrigger MathJax for the whiteboard content
			VyukaApp.triggerWhiteboardMathJax();

			// Initialize tooltips for any new elements (like the TTS button)
			VyukaApp.initTooltips();

			// Update button states (e.g., enable clear button)
			VyukaApp.manageButtonStates();

			// Fade in the new chunk
			requestAnimationFrame(() => {
				chunkDiv.style.opacity = '1';
			});
		};

        VyukaApp.triggerWhiteboardMathJax = () => {
			const ui = VyukaApp.ui;
			if (ui.whiteboardContent && window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
				console.log("[MathJax v19] Triggering global typeset for whiteboard...");
				// Use a small timeout to ensure the DOM has updated before typesetting
				setTimeout(() => {
					window.MathJax.typesetPromise([ui.whiteboardContent])
						.then(() => console.log("[MathJax v19] Whiteboard typeset completed."))
						.catch(e => console.error("[MathJax v19] Whiteboard typeset error:", e));
				}, 100); // 100ms delay might be safer than 0
			} else {
				if (!ui.whiteboardContent) console.warn("[MathJax v19] Whiteboard content element not found for typesetting.");
				if (!(window.MathJax && typeof window.MathJax.typesetPromise === 'function')) console.warn("[MathJax v19] MathJax or typesetPromise not available.");
			}
		};

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
			VyukaApp.clearWhiteboard(false); // Clear whiteboard without toast
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

				// Award points
				await VyukaApp.awardPoints(config.POINTS_TOPIC_COMPLETE);

				// Check achievements
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


        // --- Points System ---
        VyukaApp.awardPoints = async (pointsValue) => {
            const state = VyukaApp.state;
            console.log(`[Points v19] Attempting to award ${pointsValue} points.`);
            if (!state.currentUser || !state.currentUser.id) {
                console.warn("[Points v19] Skipping: No current user ID.");
                return;
            }
            if (!state.currentProfile || !state.currentProfile.id) {
                console.warn("[Points v19] Skipping: No current profile data.");
                VyukaApp.showToast('Profil nenalezen, body nelze připsat.', 'warning');
                return;
            }
            if (!state.supabase) {
                console.warn("[Points v19] Skipping: Supabase client not available.");
                return;
            }
            if (pointsValue <= 0) {
                console.log("[Points v19] Skipping: Zero or negative points value.");
                return;
            }

            VyukaApp.setLoadingState('points', true); // Indicate points operation start
            const userId = state.currentUser.id;
            const currentPoints = state.currentProfile.points ?? 0;
            const newPoints = currentPoints + pointsValue;
            console.log(`[Points v19] User: ${userId}, Current Points: ${currentPoints}, Awarding: ${pointsValue}, New Total: ${newPoints}`);

            try {
                // Update points in the profiles table
                const { data, error } = await state.supabase
                    .from('profiles')
                    .update({ points: newPoints, updated_at: new Date().toISOString() })
                    .eq('id', userId)
                    .select('points') // Select the updated points to confirm
                    .single(); // Expect only one row to be updated

                if (error) {
                    console.error(`[Points v19] Supabase update error for user ${userId}:`, error);
                    throw error; // Rethrow the error to be caught below
                }

                // Verify the update was successful
                if (data && data.points === newPoints) {
                    // Update local state immediately for responsiveness
                    state.currentProfile.points = newPoints;
                    console.log(`[Points v19] User ${userId} points updated successfully in DB and state to ${newPoints}.`);
                    VyukaApp.showToast('+', `${pointsValue} kreditů získáno!`, 'success', 3000);
                    VyukaApp.updateUserInfoUI(); // Refresh UI elements displaying points/profile info
                } else {
                    // This case shouldn't normally happen if the update succeeded without error,
                    // but it's a safeguard against unexpected DB behavior.
                    console.warn(`[Points v19] DB update discrepancy for user ${userId}. Expected ${newPoints}, got ${data?.points}. State NOT updated locally.`);
                    VyukaApp.showToast('Varování', 'Nekonzistence při aktualizaci kreditů.', 'warning');
                }
            } catch (error) {
                // Handle exceptions during the update process
                console.error(`[Points v19] Exception updating user points for ${userId}:`, error);
                VyukaApp.showToast('Chyba', 'Nepodařilo se aktualizovat kredity.', 'error');
            } finally {
                VyukaApp.setLoadingState('points', false); // Indicate points operation end
            }
        };

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

			// Render Markdown content into the container
			VyukaApp.renderMarkdown(bubbleContentDiv, displayMessage, true); // isChat = true

			// Add TTS button for AI messages if supported
			if (sender === 'gemini' && state.speechSynthesisSupported) {
				const ttsButton = document.createElement('button');
				ttsButton.className = 'tts-listen-btn btn-tooltip';
				ttsButton.title = 'Poslechnout';
				ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
				const textForSpeech = ttsText || displayMessage; // Use specific TTS text if provided
                // ZMĚNA: Uložení textu pro TTS do data atributu
				ttsButton.dataset.textToSpeak = textForSpeech;
                // ZMĚNA: Přidání listeneru přímo zde
				ttsButton.addEventListener('click', (e) => {
					e.stopPropagation(); // Prevent bubbling
                    const buttonElement = e.currentTarget;
                    const text = buttonElement.dataset.textToSpeak;
                    if (text) {
					    VyukaApp.speakText(text); // V chatu není potřeba highlight
                    } else {
                        console.warn("No text found for TTS button in chat.");
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
			// Check for '$' or '\' which indicate potential MathJax content
			if (window.MathJax && typeof window.MathJax.typesetPromise === 'function' && (displayMessage.includes('$') || displayMessage.includes('\\'))) {
                console.log(`[MathJax v19] Queueing typeset for chat message bubble: ${id}`);
				// Use timeout 0 to queue the typesetting after the current JS execution cycle
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
				// Only include actual messages, not the thinking indicator or initial message
				if (msgElement.classList.contains('chat-message') && !msgElement.id.startsWith('thinking-')) {
					const clone = msgElement.cloneNode(true);
					// Remove elements not needed in PDF
					clone.querySelector('.message-avatar')?.remove();
					clone.querySelector('.tts-listen-btn')?.remove();
                    // Add simple classes for basic styling (already done in style tag above)
                    // clone.classList.add('msg');
                    // if(msgElement.classList.contains('user')) clone.classList.add('user');
                    // else clone.classList.add('model');
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

        // --- Functions for Modal ---
        VyukaApp.showCompletionModal = () => {
			const ui = VyukaApp.ui;
			if (ui.completionSuggestionOverlay) {
				ui.completionSuggestionOverlay.style.display = 'flex'; // Make overlay visible
				requestAnimationFrame(() => {
					// Add class after display is set to trigger transition
					ui.completionSuggestionOverlay.classList.add('visible');
				});
				console.log("[Modal] Showing completion suggestion modal.");
			} else {
				console.error("[Modal] Error: Completion suggestion overlay element not found!");
			}
		};

        VyukaApp.hideCompletionModal = () => {
			const ui = VyukaApp.ui;
			if (ui.completionSuggestionOverlay) {
				ui.completionSuggestionOverlay.classList.remove('visible'); // Start fade out animation
				// Wait for animation to finish before setting display: none
				setTimeout(() => {
					if (ui.completionSuggestionOverlay) ui.completionSuggestionOverlay.style.display = 'none';
				}, 300); // Match CSS transition duration (adjust if needed)
				console.log("[Modal] Hiding completion suggestion modal.");
			}
		};

        VyukaApp.promptTopicCompletion = () => {
			console.log("[CompletionPrompt v19] AI suggested topic completion. Showing modal.");
			VyukaApp.state.aiSuggestedCompletion = true; // Set flag
			VyukaApp.manageButtonStates(); // Update button states (disable Continue)
			VyukaApp.showCompletionModal(); // Show the modal dialog
		};

        VyukaApp.handleConfirmCompletion = () => {
			console.log("[CompletionPrompt v19] User chose YES.");
			VyukaApp.hideCompletionModal(); // Close the modal
			VyukaApp.handleMarkTopicComplete(); // Trigger the topic completion logic
		};

        VyukaApp.handleDeclineCompletion = () => {
			console.log("[CompletionPrompt v19] User chose NO or closed modal.");
			VyukaApp.hideCompletionModal(); // Close the modal
			VyukaApp.state.aiSuggestedCompletion = false; // Reset the flag
			// Inform user they can continue manually
			VyukaApp.showToast("Dobře, můžete pokračovat kliknutím na 'Pokračuj' nebo položením otázky.", "info", 5000);
			VyukaApp.manageButtonStates(); // Re-enable Continue button etc.
		};

        VyukaApp.handleOverlayClick = (event) => {
			const ui = VyukaApp.ui;
			// If the click is directly on the overlay (not the modal content)
			if (event.target === ui.completionSuggestionOverlay) {
				VyukaApp.handleDeclineCompletion(); // Treat clicking outside as declining
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
			const boardRegex = /(\[BOARD_MARKDOWN]:)\s*(?:markdown\s*)?(?:`{3}(?:markdown)?\s*([\s\S]*?)\s*`{3}|([\s\S]*?))(?=\s*\[TTS_COMMENTARY]:|\s*\[BOARD_MARKDOWN]:|\s*\[ACTION:SUGGEST_COMPLETION]:|$)/i;
			const ttsRegex = /(\[TTS_COMMENTARY]:)\s*(?:`{3}\s*([\s\S]*?)\s*`{3}|([\s\S]*?))(?=\s*\[BOARD_MARKDOWN]:|\s*\[TTS_COMMENTARY]:|\s*\[ACTION:SUGGEST_COMPLETION]:|$)/i;
			const actionRegex = /(\[ACTION:SUGGEST_COMPLETION])/i;

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
				// Group 2 is content within triple backticks, Group 3 is content without backticks
				boardMarkdown = (boardMatch[2] || boardMatch[3] || "").trim();
                console.log(`[ParseGemini v19] Extracted Board Content (Raw): "${boardMarkdown.substring(0,70)}..."`);
				remainingText = remainingText.replace(boardMatch[0], ""); // Remove the matched board part
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
				ttsCommentary = (ttsMatch[2] || ttsMatch[3] || "").trim();
				remainingText = remainingText.replace(ttsMatch[0], ""); // Remove the matched TTS part
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

        // ZMĚNA: Odebráno automatické spouštění TTS
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

			// Clean chat text (remove potential artifacts)
            const cleanedChatText = cleanChatMessage(chatText);

            console.log(`[ProcessGemini v19] Parsed-> Board: ${!!boardMarkdown}, TTS: ${!!ttsCommentary}, Chat: ${!!cleanedChatText}, Action: ${actionSignal}`);

			// 1. Handle Action Signal (if present)
			if (actionSignal === 'SUGGEST_COMPLETION') {
				VyukaApp.promptTopicCompletion(); // Show the modal
				aiResponded = true;
                // ODEBRÁNO: Automatické spuštění TTS pro návrh dokončení
				// if (ttsCommentary) { VyukaApp.speakText(ttsCommentary); }
                VyukaApp.manageUIState('suggestedCompletion'); // Update UI state
			}

			// 2. Handle Whiteboard Content
			if (boardMarkdown) {
				// Append content to the whiteboard. Pass commentary for the TTS button.
                // ZMĚNA: Předání komentáře do appendToWhiteboard, ale nevolání speakText zde
				VyukaApp.appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown);
                // ODEBRÁNO: Automatické spuštění TTS pro obsah tabule
				// if (ttsCommentary && actionSignal !== 'SUGGEST_COMPLETION') {
				// 	VyukaApp.speakText(ttsCommentary);
				// }
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
                    // Check for common phrasing indicating a task or question ending with '?'
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
                // ZMĚNA: Předání TTS textu do addChatMessage, ale nevolání speakText
				const ttsForChat = (!boardMarkdown && ttsCommentary && actionSignal !== 'SUGGEST_COMPLETION') ? ttsCommentary : null;
				VyukaApp.addChatMessage(cleanedChatText, 'gemini', true, timestamp, ttsForChat, chatText); // Save original chatText
				aiResponded = true;
			}
			// 4. Handle TTS Commentary Only (if no board or chat text was generated, but TTS was)
            // ODEBRÁNO: Automatické přehrávání TTS, pokud bylo jediné
			// else if (ttsCommentary && !boardMarkdown && actionSignal !== 'SUGGEST_COMPLETION') {
			// 	VyukaApp.speakText(ttsCommentary); // Play the commentary
			// 	aiResponded = true;
			// }

			// 5. Handle cases where AI response was empty or unusable
			if (!aiResponded && !actionSignal) {
                // ZMĚNA: Pokud nebylo nic jiného, a byl jen TTS komentář, přidej ho alespoň do chatu jako fallback
                if (ttsCommentary) {
                    VyukaApp.addChatMessage(`(Komentář k tabuli: ${ttsCommentary})`, 'gemini', true, timestamp, ttsCommentary, `(Komentář: ${ttsCommentary})`);
                     aiResponded = true;
                } else {
				    VyukaApp.addChatMessage("(AI neodpovědělo očekávaným formátem nebo odpověď byla prázdná)", 'gemini', false, timestamp, null, rawText || "(Prázdná/neplatná odpověď)");
				    console.warn("AI sent no usable content and no action signal.");
                }
                state.aiIsWaitingForAnswer = false; // Ensure user isn't stuck waiting
			}

            // 6. Update overall UI state based on final context
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
						// Attempt to parse error details from the response body
						const errData = await response.json();
						errorText += `: ${errData?.error?.message || 'Neznámá chyba'}`;
					} catch (e) {
						// If body parsing fails, use the raw text
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
                     // Potentially handle other reasons like 'RECITATION', 'OTHER' if needed
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

        // --- Achievement Logic ---
        VyukaApp.checkRequirements = (profileData, requirements) => {
            if (!profileData || !requirements || typeof requirements !== 'object') { console.warn("[Achievements CheckReq] Invalid input for checking requirements.", profileData, requirements); return false; }
            const reqType = requirements.type; const reqTarget = parseInt(requirements.target, 10);
            if (!reqType || isNaN(reqTarget)) { console.warn(`[Achievements CheckReq] Invalid requirement type or target:`, requirements); return false; }
            let currentValue = 0;
            try {
                switch (reqType) {
                    case 'points_earned': currentValue = profileData.points ?? 0; break;
                    case 'streak_days': currentValue = profileData.streak_days ?? 0; break;
                    case 'exercises_completed': currentValue = profileData.completed_exercises ?? 0; break;
                    case 'level_reached': currentValue = profileData.level ?? 1; break;
                    // ZMĚNA: Odebráno completed_tests
                    // case 'tests_completed': currentValue = profileData.completed_tests ?? VyukaApp.state.currentUserStats?.completed_tests ?? 0; break;
                    default: console.warn(`[Achievements CheckReq] Unknown requirement type: ${reqType}`); return false;
                }
                return currentValue >= reqTarget;
            } catch (e) { console.error("[Achievements CheckReq] Error evaluating requirement:", e, requirements, profileData); return false; }
        };
        VyukaApp.awardBadge = async (userId, badgeId, badgeTitle, pointsAwarded = 0) => {
            const supabase = VyukaApp.state.supabase;
            if (!supabase || !userId || !badgeId) { console.error("[AwardBadge] Missing Supabase client, userId, or badgeId."); return; }
            console.log(`[AwardBadge] Attempting to award badge ${badgeId} (${badgeTitle}) to user ${userId}...`);
            try {
                const { data: existing, error: checkError } = await supabase.from('user_badges').select('badge_id').eq('user_id', userId).eq('badge_id', badgeId).limit(1);
                if (checkError) throw checkError;
                if (existing && existing.length > 0) { console.log(`[AwardBadge] Badge ${badgeId} already awarded to user ${userId}. Skipping.`); return; }
                const { error: insertError } = await supabase.from('user_badges').insert({ user_id: userId, badge_id: badgeId });
                if (insertError) throw insertError;
                console.log(`[AwardBadge] Badge ${badgeId} inserted for user ${userId}.`);
                const { data: currentProfileData, error: fetchProfileError } = await supabase.from('profiles').select('badges_count, points').eq('id', userId).single();
                if (fetchProfileError) { console.error("[AwardBadge] Error fetching current profile stats for update:", fetchProfileError); }
                else if (currentProfileData) {
                    const currentBadgeCount = currentProfileData.badges_count ?? 0;
                    const currentPoints = currentProfileData.points ?? 0;
                    const updates = { badges_count: currentBadgeCount + 1, updated_at: new Date().toISOString() };
                    if (pointsAwarded > 0) { updates.points = currentPoints + pointsAwarded; }
                    const { error: updateProfileError } = await supabase.from('profiles').update(updates).eq('id', userId);
                    if (updateProfileError) { console.error("[AwardBadge] Error updating profile stats:", updateProfileError); }
                    else { console.log(`[AwardBadge] Profile stats updated for user ${userId}: badges_count=${updates.badges_count}` + (updates.points ? `, points=${updates.points}` : '')); if (VyukaApp.state.currentProfile && VyukaApp.state.currentProfile.id === userId) { VyukaApp.state.currentProfile.badges_count = updates.badges_count; if (updates.points) { VyukaApp.state.currentProfile.points = updates.points; } VyukaApp.updateUserInfoUI(); } }
                }
                const notificationTitle = `🏆 Nový Odznak!`;
                const notificationMessage = `Získali jste odznak: "${badgeTitle}"! ${pointsAwarded > 0 ? `(+${pointsAwarded} kreditů)` : ''}`;
                const { error: notifyError } = await supabase.from('user_notifications').insert({ user_id: userId, title: notificationTitle, message: notificationMessage, type: 'badge', link: '/dashboard/oceneni.html' });
                if (notifyError) console.error("[AwardBadge] Error creating notification:", notifyError);
                else console.log(`[AwardBadge] Notification created for badge ${badgeId}`);
                VyukaApp.showToast(notificationTitle, notificationMessage, 'success', 6000);
            } catch (error) { console.error(`[AwardBadge] Error awarding badge ${badgeId} to user ${userId}:`, error); }
        };
        // ZMĚNA: Odebrán sloupec completed_tests z dotazu
        VyukaApp.checkAndAwardAchievements = async (userId) => {
            const supabase = VyukaApp.state.supabase;
            if (!supabase || !userId) { console.error("[Achievements Check] Missing Supabase client or userId."); return; }
            console.log(`[Achievements Check] Starting check for user ${userId}...`);
            try {
                // ZMĚNA: Odebráno completed_tests ze SELECT
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('points, level, streak_days, completed_exercises') // Odebráno completed_tests
                    .eq('id', userId)
                    .single();

                if (profileError) {
                     // ZMĚNA: Detailnější logování chyby profilu
                    console.error(`[Achievements Check] Supabase profile fetch error for user ${userId}:`, profileError);
                    // Pokud je chyba specifická 42703 (sloupec neexistuje), dej vědět
                    if (profileError.code === '42703') {
                         console.error(`[Achievements Check] POTENTIAL ISSUE: Query tried to access a non-existent column. Check the SELECT statement.`);
                    }
                    throw profileError;
                }

                if (!profileData) throw new Error(`Profile data not found for user ${userId} during achievement check.`);

                const { data: allBadgesData, error: badgesError } = await supabase.from('badges').select('id, title, requirements, points').order('id');
                if (badgesError) throw badgesError;
                if (!allBadgesData || allBadgesData.length === 0) { console.log("[Achievements Check] No badge definitions found."); return; }

                const { data: earnedBadgesData, error: earnedError } = await supabase.from('user_badges').select('badge_id').eq('user_id', userId);
                if (earnedError) throw earnedError;

                const earnedBadgeIds = new Set((earnedBadgesData || []).map(b => b.badge_id));
                const unearnedBadges = allBadgesData.filter(b => !earnedBadgeIds.has(b.id));
                console.log(`[Achievements Check] Found ${unearnedBadges.length} unearned badges to check.`);
                if (unearnedBadges.length === 0) { console.log("[Achievements Check] No new badges to check."); return; }

                for (const badge of unearnedBadges) {
                    // ZMĚNA: Předání profileData do checkRequirements
                    if (VyukaApp.checkRequirements(profileData, badge.requirements)) {
                         console.log(`[Achievements Check] Criteria MET for badge ID: ${badge.id} (${badge.title})! Triggering award...`);
                         // ZMĚNA: Předání userId, badgeId, badgeTitle, badge.points
                         await VyukaApp.awardBadge(userId, badge.id, badge.title, badge.points || 0);
                    }
                }
                console.log(`[Achievements Check] Finished checking for user ${userId}.`);
            } catch (error) {
                 // ZMĚNA: Detailnější logování obecné chyby
                 console.error(`[Achievements Check] Error during check/award process for user ${userId}:`, error);
                 // Zde by se nemělo zobrazovat toast uživateli, logování by mělo stačit
            }
        };
        // --- END Achievement Logic ---

        // --- Notification Logic ---
        VyukaApp.fetchNotifications = async (userId, limit = VyukaApp.config.NOTIFICATION_FETCH_LIMIT) => { /* ... Same as before ... */ const state = VyukaApp.state; if (!state.supabase || !userId) { console.error("[Notifications] Missing Supabase or User ID."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Fetching unread notifications for user ${userId}`); VyukaApp.setLoadingState('notifications', true); try { const { data, error, count } = await state.supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; console.log(`[Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); VyukaApp.showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } finally { VyukaApp.setLoadingState('notifications', false); } };
    	VyukaApp.renderNotifications = (count, notifications) => { /* ... Same as before ... */ const ui = VyukaApp.ui; console.log("[Render Notifications] Start, Count:", count, "Notifications:", notifications); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements for notifications."); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${VyukaApp.sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${VyukaApp.sanitizeHTML(n.title)}</div><div class="notification-message">${VyukaApp.sanitizeHTML(n.message)}</div><div class="notification-time">${VyukaApp.formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } console.log("[Render Notifications] Finished rendering."); };
    	VyukaApp.renderNotificationSkeletons = (count = 2) => { /* ... Same as before ... */ const ui = VyukaApp.ui; if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; };
    	VyukaApp.markNotificationRead = async (notificationId) => { /* ... Same as before ... */ const state = VyukaApp.state; console.log("[Notifications] Marking notification as read:", notificationId); if (!state.currentUser || !notificationId || !state.supabase) return false; try { const { error } = await state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[Notifications] Mark as read successful for ID:", notificationId); return true; } catch (error) { console.error("[Notifications] Mark as read error:", error); VyukaApp.showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } };
    	VyukaApp.markAllNotificationsRead = async () => { /* ... Same as before ... */ const state = VyukaApp.state; const ui = VyukaApp.ui; console.log("[Notifications] Marking all as read for user:", state.currentUser?.id); if (!state.currentUser || !ui.markAllReadBtn || !state.supabase) return; VyukaApp.setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; try { const { error } = await state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('is_read', false); if (error) throw error; console.log("[Notifications] Mark all as read successful in DB."); const { unreadCount, notifications } = await VyukaApp.fetchNotifications(state.currentUser.id, VyukaApp.config.NOTIFICATION_FETCH_LIMIT); VyukaApp.renderNotifications(unreadCount, notifications); VyukaApp.showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[Notifications] Mark all as read error:", error); VyukaApp.showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentCount === 0; } finally { VyukaApp.setLoadingState('notifications', false); } };

		// --- Feature Specific Event Listeners ---
        // ZMĚNA: Odebrány delegované listenery pro TTS, nyní jsou přímo v appendToWhiteboard a addChatMessage
		VyukaApp.setupFeatureListeners = () => {
			const ui = VyukaApp.ui;
			console.log("[SETUP Features] Setting up feature event listeners...");
			// Chat Listeners
			if (ui.chatInput) { ui.chatInput.addEventListener('input', VyukaApp.autoResizeTextarea); ui.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); VyukaApp.handleSendMessage(); } }); }
			if (ui.sendButton) ui.sendButton.addEventListener('click', VyukaApp.handleSendMessage);
			if (ui.clearChatBtn) ui.clearChatBtn.addEventListener('click', VyukaApp.confirmClearChat);
			if (ui.saveChatBtn) ui.saveChatBtn.addEventListener('click', VyukaApp.saveChatToPDF);
			// STT/TTS Listeners
			if (ui.micBtn) ui.micBtn.addEventListener('click', VyukaApp.handleMicClick);
			if (ui.stopSpeechBtn) ui.stopSpeechBtn.addEventListener('click', VyukaApp.stopSpeech);
            // ODEBRÁNO: Delegovaný listener pro TTS v chatu, nyní je v addChatMessage
			// if (ui.chatMessages) { ui.chatMessages.addEventListener('click', (event) => { /* ... listener logic ... */ }); }
            // ODEBRÁNO: Delegovaný listener pro TTS na tabuli, nyní je v appendToWhiteboard

			// Learning Flow Listeners
			if (ui.continueBtn) ui.continueBtn.addEventListener('click', VyukaApp.requestContinue);
			if (ui.clearBoardBtn) ui.clearBoardBtn.addEventListener('click', () => VyukaApp.clearWhiteboard(true));

			// Notification Listeners
			if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
			if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', VyukaApp.markAllNotificationsRead); }
			if (ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await VyukaApp.markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount?.textContent?.replace('+', '') || '0'; const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }); }
            // Modal Listeners
            if (ui.closeCompletionModalBtn) ui.closeCompletionModalBtn.addEventListener('click', VyukaApp.handleDeclineCompletion);
            if (ui.completionSuggestionOverlay) ui.completionSuggestionOverlay.addEventListener('click', VyukaApp.handleOverlayClick);
            if (ui.confirmCompleteBtn) ui.confirmCompleteBtn.addEventListener('click', VyukaApp.handleConfirmCompletion);
            if (ui.declineCompleteBtn) ui.declineCompleteBtn.addEventListener('click', VyukaApp.handleDeclineCompletion);
			console.log("[SETUP Features] Feature event listeners setup complete.");
		};

	} catch (e) {
		// Fatal error in feature script
		console.error("FATAL SCRIPT ERROR (Features):", e);
		// Display a user-friendly fatal error message
		document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--accent-pink,#ff33a8);color:var(--white,#fff);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky (Features).</p><p style="margin-top:15px;"><a href="#" onclick="location.reload()" style="color:var(--accent-cyan,#00e0ff); text-decoration:underline; font-weight:bold;">Obnovit stránku</a></p><details style="margin-top: 20px; color: #f0f0f0;"><summary style="cursor:pointer; color: var(--white,#fff);">Detaily</summary><pre style="margin-top:10px;padding:15px;background:rgba(0, 0, 0, 0.4);border:1px solid rgba(255, 255, 255, 0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;max-height: 300px; overflow-y: auto; border-radius: 8px;">${e.message}\n${e.stack}</pre></details></div>`;
	}

})(window.VyukaApp); // Pass the namespace object to the IIFE