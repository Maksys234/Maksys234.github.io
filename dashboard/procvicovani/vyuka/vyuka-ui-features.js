// Файл: procvicovani/vyuka/vyuka-ui-features.js
// Логика функций интерфейса: TTS/STT, Доска, Уведомления, Очки, Модальные окна, Достижения, Вспомогательные UI функции, Настройка слушателей событий
// Версия v28b: Odstraněny placeholder komentáře z neimplementovaných funkcí.

window.VyukaApp = window.VyukaApp || {};

(function(VyukaApp) {
	'use strict';

	try {
		const config = VyukaApp.config || {};
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

        const cleanChatMessage = (text) => {
			if (typeof text !== 'string') return text;
			let cleanedText = text.replace(/``/g, '');
			const lines = cleanedText.split('\n');
			const filteredLines = lines.filter(line => {
				const trimmedLine = line.trim();
				return trimmedLine !== '.' && trimmedLine !== '?';
			});
			cleanedText = filteredLines.join('\n');
			if (cleanedText.trim() === "(Poslechněte si komentář)") {
				console.log("[Clean] Removing placeholder text.");
				return "";
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
					console.warn("No voices available yet. Retrying or waiting for onvoiceschanged.");
					setTimeout(VyukaApp.loadVoices, 100);
					return;
				}
				console.log('Available voices:', voices.length, voices.map(v=>({name:v.name, lang:v.lang})));
				let preferredVoice = voices.find(voice => voice.lang === 'cs-CZ' && /female|žena|ženský|iveta|zuzana/i.test(voice.name));
				if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang === 'cs-CZ');
				if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang.startsWith('cs'));
				if (!preferredVoice) preferredVoice = voices.find(v => v.default) || voices[0];

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
			const plainText = text.replace(/<[^>]*>/g, ' ').replace(/[`*#_~\[\]\(\)]/g, '').replace(/\$\$(.*?)\$\$/g, 'matematický vzorec').replace(/\$(.*?)\$/g, 'vzorec').replace(/\s+/g, ' ').trim();
			if (!plainText) { console.warn("TTS: Text empty after cleaning, skipping speech."); return; }
			window.speechSynthesis.cancel(); VyukaApp.removeBoardHighlight();
			const utterance = new SpeechSynthesisUtterance(plainText); utterance.lang = 'cs-CZ'; utterance.rate = 0.9; utterance.pitch = 1.0;
			if (state.czechVoice) { utterance.voice = state.czechVoice; } else { VyukaApp.loadVoices(); if (state.czechVoice) { utterance.voice = state.czechVoice; } else { console.warn("Czech voice not found, using default."); } }
			utterance.onstart = () => { console.log("TTS started."); ui.aiAvatarCorner?.classList.add('speaking'); ui.boardSpeakingIndicator?.classList.add('active'); if (targetChunkElement) { targetChunkElement.classList.add('speaking-highlight'); state.currentlyHighlightedChunk = targetChunkElement; } if (typeof VyukaApp.manageButtonStates === 'function') VyukaApp.manageButtonStates(); };
			utterance.onend = () => { console.log("TTS finished."); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); VyukaApp.removeBoardHighlight(); if (typeof VyukaApp.manageButtonStates === 'function') VyukaApp.manageButtonStates(); };
			utterance.onerror = (event) => { console.error(`SpeechSynthesisUtterance.onerror -> Error: ${event.error}. Utterance text (start): ${plainText.substring(0, 50)}...`); let toastMessage = `Chyba při čtení: ${event.error}`; if (event.error === 'not-allowed') { toastMessage += ". Prosím, klikněte na stránku pro povolení zvuku."; } else if (event.error === 'interrupted') { console.warn("TTS interrupted, likely by new speech request."); return; } VyukaApp.showToast(toastMessage, 'error'); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); VyukaApp.removeBoardHighlight(); if (typeof VyukaApp.manageButtonStates === 'function') VyukaApp.manageButtonStates(); };
			console.log(`TTS: Attempting to speak. Voice: ${utterance.voice?.name}, lang: ${utterance.lang}`);
			try { window.speechSynthesis.speak(utterance); } catch (speakError) { console.error("Error calling window.speechSynthesis.speak():", speakError); VyukaApp.showToast('Chyba spuštění hlasového výstupu.', 'error'); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); VyukaApp.removeBoardHighlight(); if (typeof VyukaApp.manageButtonStates === 'function') VyukaApp.manageButtonStates(); }
		};

        VyukaApp.stopSpeech = () => {
			const state = VyukaApp.state; const ui = VyukaApp.ui;
			if (state.speechSynthesisSupported) { window.speechSynthesis.cancel(); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); VyukaApp.removeBoardHighlight(); console.log("Speech cancelled."); if (typeof VyukaApp.manageButtonStates === 'function') VyukaApp.manageButtonStates(); }
		};

        VyukaApp.initializeSpeechRecognition = () => {
			const state = VyukaApp.state; const ui = VyukaApp.ui;
			if (!state.speechRecognitionSupported) { console.warn("Speech Recognition not supported."); if(ui.micBtn) { ui.micBtn.disabled = true; ui.micBtn.title = "Rozpoznávání řeči není podporováno"; } return; }
			const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; state.speechRecognition = new SpeechRecognition(); state.speechRecognition.lang = 'cs-CZ'; state.speechRecognition.interimResults = false; state.speechRecognition.maxAlternatives = 1; state.speechRecognition.continuous = false;
			state.speechRecognition.onresult = (event) => { const transcript = event.results[0][0].transcript; console.log('Speech recognized:', transcript); if (ui.chatInput) { ui.chatInput.value = transcript; if (typeof VyukaApp.autoResizeTextarea === 'function') VyukaApp.autoResizeTextarea(); } };
			state.speechRecognition.onerror = (event) => { console.error('Speech recognition error:', event.error); let errorMsg = "Chyba rozpoznávání řeči"; if (event.error === 'no-speech') errorMsg = "Nerozpoznal jsem žádnou řeč."; else if (event.error === 'audio-capture') errorMsg = "Chyba mikrofonu."; else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { errorMsg = "Přístup k mikrofonu zamítnut."; if(ui.micBtn) ui.micBtn.disabled = true; } VyukaApp.showToast(errorMsg, 'error'); VyukaApp.stopListening(); };
			state.speechRecognition.onend = () => { console.log('Speech recognition ended.'); VyukaApp.stopListening(); }; console.log("Speech Recognition initialized.");
		};

        VyukaApp.startListening = () => {
			const state = VyukaApp.state; const ui = VyukaApp.ui; if (!state.speechRecognitionSupported || !state.speechRecognition || state.isListening) return;
			navigator.mediaDevices.getUserMedia({ audio: true })
				.then(() => { try { state.speechRecognition.start(); state.isListening = true; ui.micBtn?.classList.add('listening'); if(ui.micBtn) ui.micBtn.title = "Zastavit hlasový vstup"; console.log('Speech recognition started.'); if (typeof VyukaApp.manageButtonStates === 'function') VyukaApp.manageButtonStates(); } catch (e) { console.error("Error starting speech recognition:", e); VyukaApp.showToast("Nepodařilo se spustit rozpoznávání.", "error"); VyukaApp.stopListening(); }})
				.catch(err => { console.error("Microphone access denied:", err); VyukaApp.showToast("Přístup k mikrofonu je nutný pro hlasový vstup.", "warning"); if(ui.micBtn) ui.micBtn.disabled = true; VyukaApp.stopListening(); });
		};

        VyukaApp.stopListening = () => {
			const state = VyukaApp.state; const ui = VyukaApp.ui; if (!state.speechRecognitionSupported || !state.speechRecognition || !state.isListening) return;
			try { state.speechRecognition.stop(); } catch (e) { console.warn("Error stopping speech recognition (might be already stopped):", e); } finally { state.isListening = false; ui.micBtn?.classList.remove('listening'); if(ui.micBtn) ui.micBtn.title = "Zahájit hlasový vstup"; console.log('Speech recognition stopped or ensured stopped.'); if (typeof VyukaApp.manageButtonStates === 'function') VyukaApp.manageButtonStates(); }
		};

        VyukaApp.handleMicClick = () => {
			const state = VyukaApp.state; if (!state.speechRecognitionSupported) { VyukaApp.showToast("Rozpoznávání řeči není podporováno.", "warning"); return; }
			if (state.isListening) { VyukaApp.stopListening(); } else { VyukaApp.startListening(); }
		};

        // --- Whiteboard ---
        VyukaApp.clearWhiteboard = (showToastMsg = true) => {
			const ui = VyukaApp.ui; const state = VyukaApp.state;
			if (!ui.whiteboardContent) return;
			ui.whiteboardContent.innerHTML = ''; state.boardContentHistory = []; state.quizQuestionsForBoard = [];
			console.log("Whiteboard cleared (v28b).");
			if (showToastMsg && typeof VyukaApp.showToast === 'function') { VyukaApp.showToast('Tabule vymazána', 'Obsah tabule byl smazán.', 'info'); }
            const submitQuizBtn = document.getElementById('submit-quiz-btn'); if (submitQuizBtn) { submitQuizBtn.remove(); }
            if (ui.vyukaLessonControls) { if(ui.continueBtn) ui.continueBtn.style.display = 'inline-flex'; if(ui.clearBoardBtn) ui.clearBoardBtn.style.display = 'inline-flex'; if(ui.stopSpeechBtn) ui.stopSpeechBtn.style.display = 'inline-flex'; ui.vyukaLessonControls.style.justifyContent = 'flex-end'; }
			if (typeof VyukaApp.manageButtonStates === 'function') VyukaApp.manageButtonStates();
		};

    	VyukaApp.appendToWhiteboard = (markdownContent, commentaryText) => {
			const ui = VyukaApp.ui; const state = VyukaApp.state;
			if (!ui.whiteboardContent || !ui.whiteboardContainer) return;
			const chunkDiv = document.createElement('div'); chunkDiv.className = 'whiteboard-chunk'; chunkDiv.style.opacity = '0';
			const contentDiv = document.createElement('div'); const originalText = markdownContent || '';
            if (typeof VyukaApp.renderMarkdown === 'function') { VyukaApp.renderMarkdown(contentDiv, originalText, false); }
            const ttsButton = document.createElement('button'); ttsButton.className = 'tts-listen-btn btn-tooltip'; ttsButton.title = 'Poslechnout komentář'; ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>'; const textForSpeech = commentaryText || originalText; ttsButton.dataset.textToSpeak = textForSpeech;
            if (state.speechSynthesisSupported && textForSpeech.trim()) { ttsButton.addEventListener('click', (e) => { e.stopPropagation(); const buttonElement = e.currentTarget; const text = buttonElement.dataset.textToSpeak; const parentChunk = buttonElement.closest('.whiteboard-chunk'); if (text) { VyukaApp.speakText(text, parentChunk); } else { console.warn("No text found for TTS button in whiteboard chunk."); } }); chunkDiv.appendChild(ttsButton); }
            chunkDiv.appendChild(contentDiv); ui.whiteboardContent.appendChild(chunkDiv); state.boardContentHistory.push(originalText);
			console.log("Appended content to whiteboard (v28b).");
            if (typeof chunkDiv.scrollIntoView === 'function') { setTimeout(() => { chunkDiv.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100); } else { ui.whiteboardContainer.scrollTop = chunkDiv.offsetTop; console.warn("scrollIntoView not fully supported, using offsetTop fallback for whiteboard scroll."); }
			if (typeof VyukaApp.triggerWhiteboardMathJax === 'function') VyukaApp.triggerWhiteboardMathJax(); if (typeof VyukaApp.initTooltips === 'function') VyukaApp.initTooltips(); if (typeof VyukaApp.manageButtonStates === 'function') VyukaApp.manageButtonStates();
			requestAnimationFrame(() => { chunkDiv.style.opacity = '1'; });
		};

        VyukaApp.triggerWhiteboardMathJax = () => {
			const ui = VyukaApp.ui;
			if (ui.whiteboardContent && window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
				console.log("[MathJax v28b] Triggering global typeset for whiteboard...");
				setTimeout(() => { window.MathJax.typesetPromise([ui.whiteboardContent]).then(() => console.log("[MathJax v28b] Whiteboard typeset completed.")).catch(e => console.error("[MathJax v28b] Whiteboard typeset error:", e)); }, 100);
			} else { if (!ui.whiteboardContent) console.warn("[MathJax v28b] Whiteboard content element not found for typesetting."); if (!(window.MathJax && typeof window.MathJax.typesetPromise === 'function')) console.warn("[MathJax v28b] MathJax or typesetPromise not available."); }
		};

        // --- Points System ---
        VyukaApp.awardPoints = async (pointsValue) => {
            const state = VyukaApp.state; console.log(`[Points v28b] Attempting to award ${pointsValue} points.`);
            if (!state.currentUser || !state.currentUser.id) { console.warn("[Points v28b] Skipping point award: No current user ID."); return; } if (!state.currentProfile || !state.currentProfile.id) { console.warn("[Points v28b] Skipping point award: No current profile data."); VyukaApp.showToast('Profil nenalezen, body nelze připsat.', 'warning'); return; } if (!state.supabase) { console.warn("[Points v28b] Skipping point award: Supabase client not available."); return; } if (pointsValue <= 0) { console.log("[Points v28b] Skipping point award: Zero or negative points value."); return; }
            if (typeof VyukaApp.setLoadingState === 'function') VyukaApp.setLoadingState('points', true);
            const userId = state.currentUser.id; const currentPoints = state.currentProfile.points ?? 0; const newPoints = currentPoints + pointsValue;
            console.log(`[Points v28b] User: ${userId}, Current Points: ${currentPoints}, Awarding: ${pointsValue}, New Total: ${newPoints}`);
            try { const { data, error } = await state.supabase.from('profiles').update({ points: newPoints, updated_at: new Date().toISOString() }).eq('id', userId).select('points').single(); if (error) { console.error(`[Points v28b] Supabase update error for user ${userId}:`, error); throw error; }
                if (data && data.points === newPoints) { state.currentProfile.points = newPoints; console.log(`[Points v28b] User ${userId} points updated successfully in DB and state to ${newPoints}.`); if (typeof VyukaApp.showToast === 'function') VyukaApp.showToast('+', `${pointsValue} kreditů získáno!`, 'success', 3000); if (typeof VyukaApp.updateUserInfoUI === 'function') VyukaApp.updateUserInfoUI(); }
                else { console.warn(`[Points v28b] DB update discrepancy for user ${userId}. Expected ${newPoints}, got ${data?.points}. State NOT updated locally to prevent inconsistency.`); if (typeof VyukaApp.showToast === 'function') VyukaApp.showToast('Varování', 'Nekonzistence při aktualizaci kreditů. Zkuste obnovit stránku.', 'warning'); }
            } catch (error) { console.error(`[Points v28b] Exception updating user points for ${userId}:`, error); if (typeof VyukaApp.showToast === 'function') VyukaApp.showToast('Chyba', 'Nepodařilo se aktualizovat kredity.', 'error');
            } finally { if (typeof VyukaApp.setLoadingState === 'function') VyukaApp.setLoadingState('points', false); }
        };

        // --- Functions for Modal (DEPRECATED as per v27/v28 logic) ---
        VyukaApp.showCompletionModal = () => { console.warn("[CompletionModal DEPRECATED UI] showCompletionModal called. This flow is replaced by quiz offer."); };
        VyukaApp.hideCompletionModal = () => { console.warn("[CompletionModal DEPRECATED UI] hideCompletionModal called."); };
        VyukaApp.promptTopicCompletion = () => { console.warn("[promptTopicCompletion DEPRECATED UI] AI should offer final quiz instead via ACTION_INITIATE_FINAL_QUIZ.");};
        VyukaApp.handleConfirmCompletion = () => { console.warn("[handleConfirmCompletion DEPRECATED UI]"); VyukaApp.hideCompletionModal(); if (typeof VyukaApp.handleMarkTopicComplete === 'function') { VyukaApp.handleMarkTopicComplete(); }};
        VyukaApp.handleDeclineCompletion = () => { console.warn("[handleDeclineCompletion DEPRECATED UI]"); VyukaApp.hideCompletionModal(); if (typeof VyukaApp.showToast === 'function') VyukaApp.showToast("Dobře, můžete pokračovat ve výkladu.", "info", 5000); if (typeof VyukaApp.manageButtonStates === 'function') VyukaApp.manageButtonStates();};
        VyukaApp.handleOverlayClick = (event) => { if (VyukaApp.ui.completionSuggestionOverlay && event.target === VyukaApp.ui.completionSuggestionOverlay) { VyukaApp.handleDeclineCompletion(); }};

        // --- Achievement Logic (Not Implemented) ---
        VyukaApp.checkRequirements = (profileData, requirements) => { console.warn("[Achievements] checkRequirements not implemented."); return false; };
        VyukaApp.awardBadge = async (userId, badgeId, badgeTitle, pointsAwarded = 0) => { console.warn("[Achievements] awardBadge not implemented."); };
        VyukaApp.checkAndAwardAchievements = async (userId) => { console.warn("[Achievements] checkAndAwardAchievements not implemented."); };

        // --- Notification Logic (Basic Implementation / Placeholders) ---
        VyukaApp.fetchNotifications = async (userId, limit = VyukaApp.config?.NOTIFICATION_FETCH_LIMIT || 5) => {
            const state = VyukaApp.state; const ui = VyukaApp.ui;
            console.log(`[Notifications v28b] Fetching (basic) for user ${userId}`);
            if (typeof VyukaApp.setLoadingState === 'function') VyukaApp.setLoadingState('notifications', true);
            // This is a placeholder. In a real app, you'd fetch from Supabase.
            // For now, return empty to avoid errors.
            if(ui.noNotificationsMsg) ui.noNotificationsMsg.style.display = 'block';
            if(ui.notificationsList) ui.notificationsList.innerHTML = '';
            if(ui.notificationCount) { ui.notificationCount.textContent = ''; ui.notificationCount.classList.remove('visible');}
            if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = true;
            if (typeof VyukaApp.setLoadingState === 'function') VyukaApp.setLoadingState('notifications', false);
            return { unreadCount: 0, notifications: [] };
        };
    	VyukaApp.renderNotifications = (count, notifications) => {
            const ui = VyukaApp.ui;
            console.log("[Render Notifications v28b] Start, Count:", count, "Notifications:", notifications);
            if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications v28b] Missing UI elements for notifications."); return; }
            ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0);
            if (notifications && notifications.length > 0) {
                ui.notificationsList.innerHTML = notifications.map(n => {
                    const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${VyukaApp.sanitizeHTML(n.link)}"` : '';
                    return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr} title="Dvojklikem označíte jako přečtené"> ${!n.is_read ? '<span class="unread-dot"></span>' : ''} <div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div> <div class="notification-content"> <div class="notification-title">${VyukaApp.sanitizeHTML(n.title)}</div> <div class="notification-message">${VyukaApp.sanitizeHTML(n.message)}</div> <div class="notification-time">${VyukaApp.formatRelativeTime(n.created_at)}</div> </div> </div>`;
                }).join('');
                ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0;
            } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; }
            console.log("[Render Notifications v28b] Finished rendering.");
        };
    	VyukaApp.renderNotificationSkeletons = (count = 2) => {
            const ui = VyukaApp.ui; if (!ui.notificationsList || !ui.noNotificationsMsg) return;
            let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; }
            ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block';
        };
    	VyukaApp.markNotificationRead = async (notificationId) => {
            console.warn(`[Notifications v28b] markNotificationRead for ${notificationId} - basic implementation, does not persist to DB without Supabase logic.`);
            const item = VyukaApp.ui.notificationsList?.querySelector(`.notification-item[data-id="${notificationId}"]`);
            if (item && !item.classList.contains('is-read')) {
                item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove();
                const ui = VyukaApp.ui; const currentCountText = ui.notificationCount?.textContent?.replace('+', '') || '0'; const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1);
                if(ui.notificationCount) { ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); }
                if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0;
                return true; // Assume success for UI update
            }
            return false;
        };
    	VyukaApp.markAllNotificationsRead = async () => {
            console.warn("[Notifications v28b] markAllNotificationsRead - basic implementation, does not persist to DB without Supabase logic.");
            const ui = VyukaApp.ui; if (!ui.notificationsList) return;
            const unreadItems = ui.notificationsList.querySelectorAll('.notification-item:not(.is-read)');
            unreadItems.forEach(item => { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); });
            if(ui.notificationCount) { ui.notificationCount.textContent = ''; ui.notificationCount.classList.remove('visible'); }
            if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = true;
            VyukaApp.showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená (lokálně).', 'success');
        };

        VyukaApp.handleQuickReplyAction = async (actionPayload) => {
            const state = VyukaApp.state; const ui = VyukaApp.ui; console.log(`[QuickReply v28b UI] Handling action: ${actionPayload}`);
            const quickRepliesContainer = ui.chatMessages.querySelector('.quick-replies-container'); if (quickRepliesContainer) { quickRepliesContainer.remove(); }
            if (actionPayload === 'ACTION_USER_ACCEPTS_QUIZ') { console.log("[QuickReply v28b UI] User accepts final quiz."); if(typeof VyukaApp.clearCurrentChatSessionHistory === 'function') { VyukaApp.clearCurrentChatSessionHistory(); } state.finalQuizActive = true; state.finalQuizOffered = false; state.aiIsWaitingForAnswer = false; VyukaApp.manageUIState('requestingFinalQuiz'); if(typeof VyukaApp.requestFinalQuizContent === 'function'){ await VyukaApp.requestFinalQuizContent(); } else { console.error("VyukaApp.requestFinalQuizContent is not defined"); VyukaApp.showToast("Chyba: Funkce pro vyžádání testu chybí.", "error");}
            } else if (actionPayload === 'ACTION_USER_DECLINES_QUIZ') { console.log("[QuickReply v28b UI] User declines final quiz. Continuing lesson."); state.finalQuizOffered = false; state.finalQuizActive = false; state.aiIsWaitingForAnswer = false; VyukaApp.manageUIState('learning'); if (typeof VyukaApp.addChatMessage === 'function') { VyukaApp.addChatMessage("Dobře, pokračujme ve výkladu. Klikni na 'Pokračovat' nebo polož otázku.", 'gemini'); } if(ui.continueBtn) { ui.continueBtn.style.display = 'inline-flex'; ui.continueBtn.disabled = false; }
            } else if (actionPayload === 'ACTION_USER_MARKS_COMPLETE_AFTER_QUIZ') { console.log("[QuickReply v28b UI] User marks topic complete after quiz."); if (typeof VyukaApp.handleMarkTopicComplete === 'function') VyukaApp.handleMarkTopicComplete(true);
            } else if (actionPayload === 'ACTION_USER_CONTINUES_AFTER_QUIZ') { console.log("[QuickReply v28b UI] User continues lesson after quiz evaluation."); state.finalQuizActive = false; state.finalQuizOffered = false; state.aiIsWaitingForAnswer = false; VyukaApp.clearWhiteboard(true); VyukaApp.manageUIState('learning'); if (typeof VyukaApp.addChatMessage === 'function') { VyukaApp.addChatMessage("Dobře, k čemu by ses chtěl vrátit nebo co bychom mohli probrat dál k tomuto tématu?", 'gemini');} state.aiIsWaitingForAnswer = true; if(ui.continueBtn) ui.continueBtn.style.display = 'none';
            } else { console.warn("[QuickReply v28b UI] Unknown action payload:", actionPayload); }
            if (typeof VyukaApp.manageButtonStates === 'function') VyukaApp.manageButtonStates();
        };

		VyukaApp.setupFeatureListeners = () => {
			const ui = VyukaApp.ui; const state = VyukaApp.state;
			console.log("[SETUP UI Features v28b] Setting up UI/Feature event listeners...");
			if (ui.chatInput) { ui.chatInput.addEventListener('input', () => { if (typeof VyukaApp.autoResizeTextarea === 'function') VyukaApp.autoResizeTextarea(); }); ui.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (typeof VyukaApp.handleSendMessage === 'function') { VyukaApp.handleSendMessage(); } else { console.error("VyukaApp.handleSendMessage not found"); }} }); }
			if (ui.sendButton) { ui.sendButton.addEventListener('click', () => { if (typeof VyukaApp.handleSendMessage === 'function') { VyukaApp.handleSendMessage(); } else { console.error("VyukaApp.handleSendMessage not found"); } }); }
			if (ui.clearChatBtn) { ui.clearChatBtn.addEventListener('click', () => { if (typeof VyukaApp.confirmClearChat === 'function') { VyukaApp.confirmClearChat(); } else { console.error("VyukaApp.confirmClearChat not found"); } }); }
			if (ui.saveChatBtn) { ui.saveChatBtn.addEventListener('click', () => { if (typeof VyukaApp.saveChatToPDF === 'function') { VyukaApp.saveChatToPDF(); } else { console.error("VyukaApp.saveChatToPDF not found"); } }); }
			if (ui.micBtn) ui.micBtn.addEventListener('click', VyukaApp.handleMicClick);
			if (ui.stopSpeechBtn) ui.stopSpeechBtn.addEventListener('click', VyukaApp.stopSpeech);
			if (ui.continueBtn) { ui.continueBtn.addEventListener('click', () => { if (typeof VyukaApp.requestContinue === 'function') { VyukaApp.requestContinue(); } else { console.error("VyukaApp.requestContinue not found"); } }); }
			if (ui.clearBoardBtn) { ui.clearBoardBtn.addEventListener('click', () => VyukaApp.clearWhiteboard(true)); }
			if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); }
			if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', VyukaApp.markAllNotificationsRead); }
            if (ui.chatMessages) {
                ui.chatMessages.addEventListener('click', function(event) {
                    const targetButton = event.target.closest('.quick-reply-btn');
                    if (targetButton) {
                        event.preventDefault(); event.stopPropagation();
                        const payload = targetButton.dataset.payload;
                        console.log("[QuickReply Click UI v28b] Clicked, payload:", payload);
                        if (payload && typeof VyukaApp.handleQuickReplyAction === 'function') { VyukaApp.handleQuickReplyAction(payload); }
                        else if (payload && !targetButton.dataset.action) { if (ui.chatInput) { ui.chatInput.value = payload; if(typeof VyukaApp.autoResizeTextarea === 'function') VyukaApp.autoResizeTextarea(); } if (typeof VyukaApp.handleSendMessage === 'function') VyukaApp.handleSendMessage(); const repliesContainer = targetButton.closest('.quick-replies-container'); if (repliesContainer) repliesContainer.remove(); }
                    }
                });
            }
            const templateButtons = document.querySelectorAll('.template-btn'); templateButtons.forEach(button => { button.addEventListener('click', () => { const questionText = button.dataset.question; if (ui.chatInput && questionText) { ui.chatInput.value = questionText; VyukaApp.autoResizeTextarea(); VyukaApp.handleSendMessage(); } }); });
			console.log("[SETUP UI Features v28b] UI/Feature event listeners setup complete.");
		};

	} catch (e) {
		console.error("FATAL SCRIPT ERROR (UI Features v28b):", e);
		document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:var(--vyuka-accent-error,#FF4757);color:var(--vyuka-text-primary,#E0E7FF);padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA SYSTÉMU</h1><p>Nelze spustit modul výuky (UI Features).</p><p style="margin-top:15px;"><a href="#" onclick="location.reload()" style="color:var(--vyuka-accent-secondary,#00F5FF); text-decoration:underline; font-weight:bold;">Obnovit stránku</a></p><details style="margin-top: 20px; color: #f0f0f0;"><summary style="cursor:pointer; color: var(--vyuka-text-primary,#E0E7FF);">Detaily</summary><pre style="margin-top:10px;padding:15px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.2);font-size:0.8em;white-space:pre-wrap;text-align:left;max-height:300px; overflow-y:auto; border-radius:8px;">${e.message}\n${e.stack}</pre></details></div>`;
	}

})(window.VyukaApp);