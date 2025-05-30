// Файл: procvicovani/vyuka/vyuka-ui-features.js
// Логика функций интерфейса: TTS/STT, Доска, Уведомления, Очки, Модальные окна, Достижения, Вспомогательные UI функции, Настройка слушателей событий
// UPDATE: Added double-click functionality to mark notifications as read and hide them.

// Получаем доступ к глобальному пространству имен
window.VyukaApp = window.VyukaApp || {};

(function(VyukaApp) { // Используем IIFE для локальной области видимости, передаем VyukaApp
	'use strict';

	try {
		// --- Constants & Configuration (Accessing Core) ---
		// Используем VyukaApp.config, который должен быть определен в vyuka-core.js
        const activityVisuals = {
            test: { icon: 'fa-vial', class: 'test' },
            exercise: { icon: 'fa-pencil-alt', class: 'exercise' },
            badge: { icon: 'fa-medal', class: 'badge' },
            diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' },
            lesson: { icon: 'fa-book-open', class: 'lesson' },
            plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' },
            level_up: { icon: 'fa-level-up-alt', class: 'level_up' },
            other: { icon: 'fa-info-circle', class: 'other' },
            default: { icon: 'fa-check-circle', class: 'default' }
        };

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

        // ZMĚNA v features: Přidán аргумент targetChunkElement pro zvýraznění
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
                // ZMĚNA v features: Zvýraznění konkrétního bloku, pokud je předán
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
			if (showToastMsg) VyukaApp.showToast('Tabule vymazána', 'Obsah tabule byl smazán.', 'info'); // Updated toast
			VyukaApp.manageButtonStates(); // Update button states (e.g., disable clear if empty)
		};

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
			const textForSpeech = commentaryText || originalText;
			ttsButton.dataset.textToSpeak = textForSpeech;

			if (state.speechSynthesisSupported && textForSpeech.trim()) {
				ttsButton.addEventListener('click', (e) => {
					e.stopPropagation();
                    const buttonElement = e.currentTarget;
                    const text = buttonElement.dataset.textToSpeak;
                    const parentChunk = buttonElement.closest('.whiteboard-chunk');
                    if (text) {
					    VyukaApp.speakText(text, parentChunk);
                    } else {
                        console.warn("No text found for TTS button in whiteboard chunk.");
                    }
				});
				chunkDiv.appendChild(ttsButton);
			}

			chunkDiv.appendChild(contentDiv);
			ui.whiteboardContent.appendChild(chunkDiv);

			state.boardContentHistory.push(originalText);
			console.log("Appended content to whiteboard.");

            if (typeof chunkDiv.scrollIntoView === 'function') {
                setTimeout(() => {
                    chunkDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            } else {
                ui.whiteboardContainer.scrollTop = chunkDiv.offsetTop;
                 console.warn("scrollIntoView not fully supported, using offsetTop fallback.");
            }

			VyukaApp.triggerWhiteboardMathJax();
			VyukaApp.initTooltips();
			VyukaApp.manageButtonStates();
			requestAnimationFrame(() => { chunkDiv.style.opacity = '1'; });
		};

        VyukaApp.triggerWhiteboardMathJax = () => {
			const ui = VyukaApp.ui;
			if (ui.whiteboardContent && window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
				console.log("[MathJax v19] Triggering global typeset for whiteboard...");
				setTimeout(() => {
					window.MathJax.typesetPromise([ui.whiteboardContent])
						.then(() => console.log("[MathJax v19] Whiteboard typeset completed."))
						.catch(e => console.error("[MathJax v19] Whiteboard typeset error:", e));
				}, 100);
			} else {
				if (!ui.whiteboardContent) console.warn("[MathJax v19] Whiteboard content element not found for typesetting.");
				if (!(window.MathJax && typeof window.MathJax.typesetPromise === 'function')) console.warn("[MathJax v19] MathJax or typesetPromise not available.");
			}
		};

        // --- Points System ---
        VyukaApp.awardPoints = async (pointsValue) => {
            const state = VyukaApp.state;
            console.log(`[Points v19] Attempting to award ${pointsValue} points.`);
            if (!state.currentUser || !state.currentUser.id) { console.warn("[Points v19] Skipping: No current user ID."); return; }
            if (!state.currentProfile || !state.currentProfile.id) { console.warn("[Points v19] Skipping: No current profile data."); VyukaApp.showToast('Profil nenalezen, body nelze připsat.', 'warning'); return; }
            if (!state.supabase) { console.warn("[Points v19] Skipping: Supabase client not available."); return; }
            if (pointsValue <= 0) { console.log("[Points v19] Skipping: Zero or negative points value."); return; }
            VyukaApp.setLoadingState('points', true);
            const userId = state.currentUser.id;
            const currentPoints = state.currentProfile.points ?? 0;
            const newPoints = currentPoints + pointsValue;
            console.log(`[Points v19] User: ${userId}, Current Points: ${currentPoints}, Awarding: ${pointsValue}, New Total: ${newPoints}`);
            try {
                const { data, error } = await state.supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', userId).select('points').single();
                if (error) { console.error(`[Points v19] Supabase update error for user ${userId}:`, error); throw error; }
                if (data && data.points === newPoints) {
                    state.currentProfile.points = newPoints;
                    console.log(`[Points v19] User ${userId} points updated successfully in DB and state to ${newPoints}.`);
                    VyukaApp.showToast('+', `${pointsValue} kreditů získáno!`, 'success', 3000);
                    VyukaApp.updateUserInfoUI();
                } else {
                    console.warn(`[Points v19] DB update discrepancy for user ${userId}. Expected ${newPoints}, got ${data?.points}. State NOT updated locally.`);
                    VyukaApp.showToast('Varování', 'Nekonzistence při aktualizaci kreditů.', 'warning');
                }
            } catch (error) { console.error(`[Points v19] Exception updating user points for ${userId}:`, error); VyukaApp.showToast('Chyba', 'Nepodařilo se aktualizovat kredity.', 'error');
            } finally { VyukaApp.setLoadingState('points', false); }
        };

        // --- Functions for Modal ---
        VyukaApp.showCompletionModal = () => {
			const ui = VyukaApp.ui;
			if (ui.completionSuggestionOverlay) {
				ui.completionSuggestionOverlay.style.display = 'flex';
				requestAnimationFrame(() => { ui.completionSuggestionOverlay.classList.add('visible'); });
				console.log("[Modal] Showing completion suggestion modal.");
			} else { console.error("[Modal] Error: Completion suggestion overlay element not found!"); }
		};
        VyukaApp.hideCompletionModal = () => {
			const ui = VyukaApp.ui;
			if (ui.completionSuggestionOverlay) {
				ui.completionSuggestionOverlay.classList.remove('visible');
				setTimeout(() => { if (ui.completionSuggestionOverlay) ui.completionSuggestionOverlay.style.display = 'none'; }, 300);
				console.log("[Modal] Hiding completion suggestion modal.");
			}
		};
        VyukaApp.promptTopicCompletion = () => {
			console.log("[CompletionPrompt v19] AI suggested topic completion. Showing modal.");
			VyukaApp.state.aiSuggestedCompletion = true;
			VyukaApp.manageButtonStates();
			VyukaApp.showCompletionModal();
		};
        VyukaApp.handleConfirmCompletion = () => {
			console.log("[CompletionPrompt v19] User chose YES.");
			VyukaApp.hideCompletionModal();
            if (typeof VyukaApp.handleMarkTopicComplete === 'function') { VyukaApp.handleMarkTopicComplete(); }
            else { console.error("ERROR: VyukaApp.handleMarkTopicComplete is not defined!"); VyukaApp.showToast("Chyba: Funkce pro dokončení tématu nenalezena.", "error"); }
		};
        VyukaApp.handleDeclineCompletion = () => {
			console.log("[CompletionPrompt v19] User chose NO or closed modal.");
			VyukaApp.hideCompletionModal();
			VyukaApp.state.aiSuggestedCompletion = false;
			VyukaApp.showToast("Dobře, můžete pokračovat kliknutím na 'Pokračuj' nebo položením otázky.", "info", 5000);
			VyukaApp.manageButtonStates();
		};
        VyukaApp.handleOverlayClick = (event) => {
			const ui = VyukaApp.ui;
			if (event.target === ui.completionSuggestionOverlay) { VyukaApp.handleDeclineCompletion(); }
		};

        // --- Achievement Logic ---
        VyukaApp.checkRequirements = (profileData, requirements) => { /* ... (same as vyuka-features.js) ... */ if (!profileData || !requirements || typeof requirements !== 'object') { console.warn("[Achievements CheckReq] Invalid input for checking requirements.", profileData, requirements); return false; } const reqType = requirements.type; const reqTarget = parseInt(requirements.target, 10); if (!reqType || isNaN(reqTarget)) { console.warn(`[Achievements CheckReq] Invalid requirement type or target:`, requirements); return false; } let currentValue = 0; try { switch (reqType) { case 'points_earned': currentValue = profileData.points ?? 0; break; case 'streak_days': currentValue = profileData.streak_days ?? 0; break; case 'exercises_completed': currentValue = profileData.completed_exercises ?? 0; break; case 'level_reached': currentValue = profileData.level ?? 1; break; default: console.warn(`[Achievements CheckReq] Unknown requirement type: ${reqType}`); return false; } return currentValue >= reqTarget; } catch (e) { console.error("[Achievements CheckReq] Error evaluating requirement:", e, requirements, profileData); return false; } };
        VyukaApp.awardBadge = async (userId, badgeId, badgeTitle, pointsAwarded = 0) => { /* ... (same as vyuka-features.js) ... */ const supabase = VyukaApp.state.supabase; if (!supabase || !userId || !badgeId) { console.error("[AwardBadge] Missing Supabase client, userId, or badgeId."); return; } console.log(`[AwardBadge] Attempting to award badge ${badgeId} (${badgeTitle}) to user ${userId}...`); try { const { data: existing, error: checkError } = await supabase.from('user_badges').select('badge_id').eq('user_id', userId).eq('badge_id', badgeId).limit(1); if (checkError) throw checkError; if (existing && existing.length > 0) { console.log(`[AwardBadge] Badge ${badgeId} already awarded to user ${userId}. Skipping.`); return; } const { error: insertError } = await supabase.from('user_badges').insert({ user_id: userId, badge_id: badgeId }); if (insertError) throw insertError; console.log(`[AwardBadge] Badge ${badgeId} inserted for user ${userId}.`); const { data: currentProfileData, error: fetchProfileError } = await supabase.from('profiles').select('badges_count, points').eq('id', userId).single(); if (fetchProfileError) { console.error("[AwardBadge] Error fetching current profile stats for update:", fetchProfileError); } else if (currentProfileData) { const currentBadgeCount = currentProfileData.badges_count ?? 0; const currentPoints = currentProfileData.points ?? 0; const updates = { badges_count: currentBadgeCount + 1, updated_at: new Date().toISOString() }; if (pointsAwarded > 0) { updates.points = currentPoints + pointsAwarded; } const { error: updateProfileError } = await supabase.from('profiles').update(updates).eq('id', userId); if (updateProfileError) { console.error("[AwardBadge] Error updating profile stats:", updateProfileError); } else { console.log(`[AwardBadge] Profile stats updated for user ${userId}: badges_count=${updates.badges_count}` + (updates.points ? `, points=${updates.points}` : '')); if (VyukaApp.state.currentProfile && VyukaApp.state.currentProfile.id === userId) { VyukaApp.state.currentProfile.badges_count = updates.badges_count; if (updates.points) { VyukaApp.state.currentProfile.points = updates.points; } VyukaApp.updateUserInfoUI(); } } } const notificationTitle = `🏆 Nový Odznak!`; const notificationMessage = `Získali jste odznak: "${badgeTitle}"! ${pointsAwarded > 0 ? `(+${pointsAwarded} kreditů)` : ''}`; const { error: notifyError } = await supabase.from('user_notifications').insert({ user_id: userId, title: notificationTitle, message: notificationMessage, type: 'badge', link: '/dashboard/oceneni.html' }); if (notifyError) console.error("[AwardBadge] Error creating notification:", notifyError); else console.log(`[AwardBadge] Notification created for badge ${badgeId}`); VyukaApp.showToast(notificationTitle, notificationMessage, 'success', 6000); } catch (error) { console.error(`[AwardBadge] Error awarding badge ${badgeId} to user ${userId}:`, error); } };
        VyukaApp.checkAndAwardAchievements = async (userId) => { /* ... (same as vyuka-features.js) ... */ const supabase = VyukaApp.state.supabase; if (!supabase || !userId) { console.error("[Achievements Check] Missing Supabase client or userId."); return; } console.log(`[Achievements Check] Starting check for user ${userId}...`); try { const { data: profileData, error: profileError } = await supabase .from('profiles') .select('points, level, streak_days, completed_exercises') .eq('id', userId) .single(); if (profileError) { console.error(`[Achievements Check] Supabase profile fetch error for user ${userId}:`, profileError); if (profileError.code === '42703') { console.error(`[Achievements Check] POTENTIAL ISSUE: Query tried to access a non-existent column. Check the SELECT statement.`); } throw profileError; } if (!profileData) throw new Error(`Profile data not found for user ${userId} during achievement check.`); const { data: allBadgesData, error: badgesError } = await supabase.from('badges').select('id, title, requirements, points').order('id'); if (badgesError) throw badgesError; if (!allBadgesData || allBadgesData.length === 0) { console.log("[Achievements Check] No badge definitions found."); return; } const { data: earnedBadgesData, error: earnedError } = await supabase.from('user_badges').select('badge_id').eq('user_id', userId); if (earnedError) throw earnedError; const earnedBadgeIds = new Set((earnedBadgesData || []).map(b => b.badge_id)); const unearnedBadges = allBadgesData.filter(b => !earnedBadgeIds.has(b.id)); console.log(`[Achievements Check] Found ${unearnedBadges.length} unearned badges to check.`); if (unearnedBadges.length === 0) { console.log("[Achievements Check] No new badges to check."); return; } for (const badge of unearnedBadges) { if (VyukaApp.checkRequirements(profileData, badge.requirements)) { console.log(`[Achievements Check] Criteria MET for badge ID: ${badge.id} (${badge.title})! Triggering award...`); await VyukaApp.awardBadge(userId, badge.id, badge.title, badge.points || 0); } } console.log(`[Achievements Check] Finished checking for user ${userId}.`); } catch (error) { console.error(`[Achievements Check] Error during check/award process for user ${userId}:`, error); } };
        // --- END Achievement Logic ---

        // --- Notification Logic ---
        VyukaApp.fetchNotifications = async (userId, limit = VyukaApp.config.NOTIFICATION_FETCH_LIMIT) => { const state = VyukaApp.state; if (!state.supabase || !userId) { console.error("[Notifications] Missing Supabase or User ID."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Fetching unread notifications for user ${userId}`); VyukaApp.setLoadingState('notifications', true); try { const { data, error, count } = await state.supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; console.log(`[Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); VyukaApp.showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } finally { VyukaApp.setLoadingState('notifications', false); } };
    	VyukaApp.renderNotifications = (count, notifications) => {
            const ui = VyukaApp.ui;
            const state = VyukaApp.state; // Access state
            console.log("[Render Notifications] Start, Count:", count, "Notifications:", notifications);
            if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) {
                console.error("[Render Notifications] Missing UI elements for notifications.");
                return;
            }
            ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '');
            ui.notificationCount.classList.toggle('visible', count > 0);

            if (notifications && notifications.length > 0) {
                ui.notificationsList.innerHTML = notifications.map(n => {
                    const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default;
                    const isReadClass = n.is_read ? 'is-read' : '';
                    const linkAttr = n.link ? `data-link="${VyukaApp.sanitizeHTML(n.link)}"` : '';

                    // START: New action button for individual mark as read (placeholder, if needed in HTML)
                    // Actual event listener will be on the item itself via dblclick
                    const actionButtonHTML = ''; // Removed explicit button, dblclick handles it
                    // END: New action button

                    return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr} title="Dvojklikem označíte jako přečtené">
                                ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
                                <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div>
                                <div class="notification-content">
                                    <div class="notification-title">${VyukaApp.sanitizeHTML(n.title)}</div>
                                    <div class="notification-message">${VyukaApp.sanitizeHTML(n.message)}</div>
                                    <div class="notification-time">${VyukaApp.formatRelativeTime(n.created_at)}</div>
                                </div>
                                ${actionButtonHTML}
                            </div>`;
                }).join('');
                ui.noNotificationsMsg.style.display = 'none';
                ui.notificationsList.style.display = 'block';
                ui.markAllReadBtn.disabled = count === 0;
            } else {
                ui.notificationsList.innerHTML = '';
                ui.noNotificationsMsg.style.display = 'block';
                ui.notificationsList.style.display = 'none';
                ui.markAllReadBtn.disabled = true;
            }
            console.log("[Render Notifications] Finished rendering.");
        };
    	VyukaApp.renderNotificationSkeletons = (count = 2) => { const ui = VyukaApp.ui; if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; };
    	VyukaApp.markNotificationRead = async (notificationId) => { const state = VyukaApp.state; console.log("[Notifications] Marking notification as read:", notificationId); if (!state.currentUser || !notificationId || !state.supabase) return false; try { const { error } = await state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[Notifications] Mark as read successful for ID:", notificationId); return true; } catch (error) { console.error("[Notifications] Mark as read error:", error); VyukaApp.showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } };
    	VyukaApp.markAllNotificationsRead = async () => { const state = VyukaApp.state; const ui = VyukaApp.ui; console.log("[Notifications] Marking all as read for user:", state.currentUser?.id); if (!state.currentUser || !ui.markAllReadBtn || !state.supabase) return; VyukaApp.setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; try { const { error } = await state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('is_read', false); if (error) throw error; console.log("[Notifications] Mark all as read successful in DB."); const { unreadCount, notifications } = await VyukaApp.fetchNotifications(state.currentUser.id, VyukaApp.config.NOTIFICATION_FETCH_LIMIT); VyukaApp.renderNotifications(unreadCount, notifications); VyukaApp.showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[Notifications] Mark all as read error:", error); VyukaApp.showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentCount === 0; } finally { VyukaApp.setLoadingState('notifications', false); } };

		// --- Feature Specific Event Listeners ---
		VyukaApp.setupFeatureListeners = () => {
			const ui = VyukaApp.ui;
            const state = VyukaApp.state; // Potřebujeme state pro přístup k Supabase
			console.log("[SETUP UI Features] Setting up UI/Feature event listeners...");

			// Chat Listeners
			if (ui.chatInput) {
                ui.chatInput.addEventListener('input', VyukaApp.autoResizeTextarea);
                ui.chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (typeof VyukaApp.handleSendMessage === 'function') { VyukaApp.handleSendMessage(); }
                        else { console.error("VyukaApp.handleSendMessage not found"); }
                    }
                });
            }
			if (ui.sendButton) {
                ui.sendButton.addEventListener('click', () => {
                     if (typeof VyukaApp.handleSendMessage === 'function') { VyukaApp.handleSendMessage(); }
                     else { console.error("VyukaApp.handleSendMessage not found"); }
                 });
             }
			if (ui.clearChatBtn) {
                 ui.clearChatBtn.addEventListener('click', () => {
                     if (typeof VyukaApp.confirmClearChat === 'function') { VyukaApp.confirmClearChat(); }
                     else { console.error("VyukaApp.confirmClearChat not found"); }
                 });
             }
			if (ui.saveChatBtn) {
                 ui.saveChatBtn.addEventListener('click', () => {
                     if (typeof VyukaApp.saveChatToPDF === 'function') { VyukaApp.saveChatToPDF(); }
                     else { console.error("VyukaApp.saveChatToPDF not found"); }
                 });
             }

			// STT/TTS Listeners
			if (ui.micBtn) ui.micBtn.addEventListener('click', VyukaApp.handleMicClick);
			if (ui.stopSpeechBtn) ui.stopSpeechBtn.addEventListener('click', VyukaApp.stopSpeech);

			// Learning Flow Listeners
			if (ui.continueBtn) {
                ui.continueBtn.addEventListener('click', () => {
                    if (typeof VyukaApp.requestContinue === 'function') { VyukaApp.requestContinue(); }
                    else { console.error("VyukaApp.requestContinue not found"); }
                });
            }
			if (ui.clearBoardBtn) ui.clearBoardBtn.addEventListener('click', () => VyukaApp.clearWhiteboard(true));

			// Notification Listeners
			if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
			if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', VyukaApp.markAllNotificationsRead); }

            // START: Modified Notification Click Listener & Added Double-Click Listener
            if (ui.notificationsList) {
                // Single click listener (remains mostly the same, but we won't mark as read here anymore if dblclick does it)
                ui.notificationsList.addEventListener('click', async (event) => {
                    const item = event.target.closest('.notification-item');
                    if (item) {
                        const link = item.dataset.link;
                        const notificationId = item.dataset.id; // Keep for potential direct action
                        const isRead = item.classList.contains('is-read');

                        // Action for single click: If there's a link, navigate.
                        // Marking as read is now primarily handled by double-click.
                        // However, if a user single-clicks an unread item with a link,
                        // it might be good to mark it as read too. Let's keep that.
                        if (!isRead && notificationId && link) {
                            const success = await VyukaApp.markNotificationRead(notificationId);
                            if (success) {
                                item.classList.add('is-read');
                                item.querySelector('.unread-dot')?.remove();
                                // Update count and button state
                                const currentCountText = ui.notificationCount?.textContent?.replace('+', '') || '0';
                                const currentCount = parseInt(currentCountText) || 0;
                                const newCount = Math.max(0, currentCount - 1);
                                if (ui.notificationCount) {
                                    ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                                    ui.notificationCount.classList.toggle('visible', newCount > 0);
                                }
                                if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0;
                            }
                        }
                        if (link) {
                            window.location.href = link;
                            ui.notificationsDropdown?.classList.remove('active'); // Close dropdown on navigation
                        }
                    }
                });

                // Double-click listener for marking as read and hiding
                ui.notificationsList.addEventListener('dblclick', async (event) => {
                    const item = event.target.closest('.notification-item');
                    if (item) {
                        const notificationId = item.dataset.id;
                        if (!notificationId || !state.supabase) return; // No ID or Supabase, do nothing

                        const wasInitiallyUnread = !item.classList.contains('is-read');
                        console.log(`[DBLCLICK] Notification ID: ${notificationId}, Was initially unread: ${wasInitiallyUnread}`);

                        // Attempt to mark as read in DB (important if it wasn't already)
                        const markSuccess = await VyukaApp.markNotificationRead(notificationId);

                        if (markSuccess) { // Only proceed if DB update was successful
                            item.classList.add('is-read'); // Ensure it has the read class visually
                            item.querySelector('.unread-dot')?.remove();
                            
                            item.classList.add('hiding'); // Add class to trigger CSS animation

                            // Animation duration - should match CSS animation
                            const animationDuration = 500; // milliseconds

                            setTimeout(() => {
                                item.remove();
                                // Update count only if it was initially unread and successfully marked
                                if (wasInitiallyUnread) {
                                    const currentCountText = ui.notificationCount?.textContent?.replace('+', '') || '0';
                                    const currentCount = parseInt(currentCountText) || 0;
                                    const newCount = Math.max(0, currentCount - 1);
                                    
                                    if (ui.notificationCount) {
                                        ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : '');
                                        ui.notificationCount.classList.toggle('visible', newCount > 0);
                                    }
                                    if (ui.markAllReadBtn) {
                                        // Re-fetch total unread count to be absolutely sure for the button state
                                        // This is a bit heavy, but safest if multiple actions happen quickly
                                        VyukaApp.fetchNotifications(state.currentUser.id, VyukaApp.config.NOTIFICATION_FETCH_LIMIT)
                                            .then(({ unreadCount: updatedTotalUnread }) => {
                                                if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = updatedTotalUnread === 0;
                                            });
                                    }
                                }
                            }, animationDuration);
                        } else {
                            // DB update failed, don't hide, show error
                            console.warn(`[DBLCLICK] Failed to mark notification ${notificationId} as read in DB. Not hiding.`);
                            // Toast is already shown by markNotificationRead on failure
                        }
                    }
                });
            }
            // END: Modified Notification Click Listener & Added Double-Click Listener


            // Modal Listeners
            if (ui.closeCompletionModalBtn) ui.closeCompletionModalBtn.addEventListener('click', VyukaApp.handleDeclineCompletion);
            if (ui.completionSuggestionOverlay) ui.completionSuggestionOverlay.addEventListener('click', VyukaApp.handleOverlayClick);
            if (ui.confirmCompleteBtn) ui.confirmCompleteBtn.addEventListener('click', VyukaApp.handleConfirmCompletion);
            if (ui.declineCompleteBtn) ui.declineCompleteBtn.addEventListener('click', VyukaApp.handleDeclineCompletion);
			console.log("[SETUP UI Features] UI/Feature event listeners setup complete.");
		};

	} catch (e) {
		// Fatal error in UI feature script
		console.error("FATAL SCRIPT ERROR (UI Features):", e);
		document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--accent-pink,#ff33a8);color:var(--white,#fff);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky (UI Features).</p><p style="margin-top:15px;"><a href="#" onclick="location.reload()" style="color:var(--accent-cyan,#00e0ff); text-decoration:underline; font-weight:bold;">Obnovit stránku</a></p><details style="margin-top: 20px; color: #f0f0f0;"><summary style="cursor:pointer; color: var(--white,#fff);">Detaily</summary><pre style="margin-top:10px;padding:15px;background:rgba(0, 0, 0, 0.4);border:1px solid rgba(255, 255, 255, 0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;max-height: 300px; overflow-y: auto; border-radius: 8px;">${e.message}\n${e.stack}</pre></details></div>`;
	}

})(window.VyukaApp); // Pass the namespace object to the IIFE

// --- START: List of functions in this file ---
// cleanChatMessage
// loadVoices
// removeBoardHighlight
// speakText
// stopSpeech
// initializeSpeechRecognition
// startListening
// stopListening
// handleMicClick
// clearWhiteboard
// appendToWhiteboard
// triggerWhiteboardMathJax
// awardPoints
// showCompletionModal
// hideCompletionModal
// promptTopicCompletion
// handleConfirmCompletion
// handleDeclineCompletion
// handleOverlayClick
// checkRequirements
// awardBadge
// checkAndAwardAchievements
// fetchNotifications
// renderNotifications
// renderNotificationSkeletons
// markNotificationRead
// markAllNotificationsRead
// setupFeatureListeners
// --- END: List of functions in this file ---