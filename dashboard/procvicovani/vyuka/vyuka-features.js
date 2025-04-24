// Файл: procvicovani/vyuka/vyuka-features.js
// Логика специфичных функций: Темы, Чат, Gemini, TTS/STT, Доска, Уведомления, Очки, Модальные окна, Достижения

// Получаем доступ к глобальному пространству имен
window.VyukaApp = window.VyukaApp || {};

(function(VyukaApp) { // Используем IIFE для локальной области видимости, передаем VyukaApp
	'use strict';

	// --- Constants & Configuration (Features) ---
	const config = VyukaApp.config; // Access core config
	config.GEMINI_API_KEY = 'AIzaSyDQboM6qtC_O2sqqpaKZZffNf2zk6HrhEs'; // !!! Production: Use a secure method !!!
	config.GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;
	config.MAX_GEMINI_HISTORY_TURNS = 12;
    config.ACTION_SUGGEST_COMPLETION = "[ACTION:SUGGEST_COMPLETION]";

    const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } };

    // --- Helper Functions (Feature Specific or relying on Core) ---
    const cleanChatMessage = (text) => { /* ... no changes ... */ if (typeof text !== 'string') return text; let cleanedText = text.replace(/``/g, ''); const lines = cleanedText.split('\n'); const filteredLines = lines.filter(line => { const trimmedLine = line.trim(); return trimmedLine !== '.' && trimmedLine !== '?'; }); cleanedText = filteredLines.join('\n'); if (cleanedText.trim() === "(Poslechněte si komentář)") { console.log("[Clean] Removing placeholder text."); return ""; } cleanedText = cleanedText.trim(); return cleanedText; };

    // --- TTS/STT Functions ---
    VyukaApp.loadVoices = () => { /* ... no changes ... */ const state = VyukaApp.state; if (!state.speechSynthesisSupported) return; try { const voices = window.speechSynthesis.getVoices(); if (!voices || voices.length === 0) { console.warn("No voices available yet."); setTimeout(VyukaApp.loadVoices, 100); return; } console.log('Available voices:', voices.length, voices.map(v=>({name:v.name, lang:v.lang}))); let preferredVoice = voices.find(voice => voice.lang === 'cs-CZ' && /female|žena|ženský|iveta|zuzana/i.test(voice.name)); if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang === 'cs-CZ'); if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang.startsWith('cs')); if (!preferredVoice) preferredVoice = voices.find(v => v.default) || voices[0]; state.czechVoice = preferredVoice; console.log("Selected voice:", state.czechVoice?.name, state.czechVoice?.lang); } catch (e) { console.error("Error loading voices:", e); state.czechVoice = null; } };
    VyukaApp.removeBoardHighlight = () => { /* ... no changes ... */ const state = VyukaApp.state; if (state.currentlyHighlightedChunk) { state.currentlyHighlightedChunk.classList.remove('speaking-highlight'); state.currentlyHighlightedChunk = null; } };
    VyukaApp.speakText = (text, targetChunkElement = null) => { /* ... no changes ... */ const state = VyukaApp.state; const ui = VyukaApp.ui; if (!state.speechSynthesisSupported) { VyukaApp.showToast("Syntéza řeči není podporována.", "warning"); return; } if (!text) { console.warn("TTS: No text provided."); return; } const plainText = text.replace(/<[^>]*>/g, ' ').replace(/[`*#_~[\]()]/g, '').replace(/\$\$(.*?)\$\$/g, 'matematický vzorec').replace(/\$(.*?)\$/g, 'vzorec').replace(/\s+/g, ' ').trim(); if (!plainText) { console.warn("TTS: Text empty after cleaning, skipping speech."); return; } window.speechSynthesis.cancel(); VyukaApp.removeBoardHighlight(); const utterance = new SpeechSynthesisUtterance(plainText); utterance.lang = 'cs-CZ'; utterance.rate = 0.9; utterance.pitch = 1.0; if (state.czechVoice) { utterance.voice = state.czechVoice; } else { VyukaApp.loadVoices(); if (state.czechVoice) { utterance.voice = state.czechVoice; } else { console.warn("Czech voice not found, using default."); } } utterance.onstart = () => { console.log("TTS started."); ui.aiAvatarCorner?.classList.add('speaking'); ui.boardSpeakingIndicator?.classList.add('active'); if (targetChunkElement) { targetChunkElement.classList.add('speaking-highlight'); state.currentlyHighlightedChunk = targetChunkElement; } VyukaApp.manageButtonStates(); }; utterance.onend = () => { console.log("TTS finished."); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); VyukaApp.removeBoardHighlight(); VyukaApp.manageButtonStates(); }; utterance.onerror = (event) => { console.error(`SpeechSynthesisUtterance.onerror -> Error: ${event.error}. Utterance text (start): ${plainText.substring(0, 50)}...`); let toastMessage = `Chyba při čtení: ${event.error}`; if (event.error === 'not-allowed') { toastMessage += ". Prosím, klikněte na stránku pro povolení zvuku."; } else if (event.error === 'interrupted') { console.warn("TTS interrupted, likely by new speech request."); return; } VyukaApp.showToast(toastMessage, 'error'); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); VyukaApp.removeBoardHighlight(); VyukaApp.manageButtonStates(); }; console.log(`TTS: Attempting to speak. Voice: ${utterance.voice?.name}, lang: ${utterance.lang}`); try { window.speechSynthesis.speak(utterance); } catch (speakError) { console.error("Error calling window.speechSynthesis.speak():", speakError); VyukaApp.showToast('Chyba spuštění hlasového výstupu.', 'error'); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); VyukaApp.removeBoardHighlight(); VyukaApp.manageButtonStates(); } };
    VyukaApp.stopSpeech = () => { /* ... no changes ... */ const state = VyukaApp.state; const ui = VyukaApp.ui; if (state.speechSynthesisSupported) { window.speechSynthesis.cancel(); ui.aiAvatarCorner?.classList.remove('speaking'); ui.boardSpeakingIndicator?.classList.remove('active'); VyukaApp.removeBoardHighlight(); console.log("Speech cancelled."); VyukaApp.manageButtonStates(); } };
    VyukaApp.initializeSpeechRecognition = () => { /* ... no changes ... */ const state = VyukaApp.state; const ui = VyukaApp.ui; if (!state.speechRecognitionSupported) { console.warn("Speech Recognition not supported."); if(ui.micBtn) { ui.micBtn.disabled = true; ui.micBtn.title = "Rozpoznávání řeči není podporováno"; } return; } const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; state.speechRecognition = new SpeechRecognition(); state.speechRecognition.lang = 'cs-CZ'; state.speechRecognition.interimResults = false; state.speechRecognition.maxAlternatives = 1; state.speechRecognition.continuous = false; state.speechRecognition.onresult = (event) => { const transcript = event.results[0][0].transcript; console.log('Speech recognized:', transcript); if (ui.chatInput) { ui.chatInput.value = transcript; VyukaApp.autoResizeTextarea(); } }; state.speechRecognition.onerror = (event) => { console.error('Speech recognition error:', event.error); let errorMsg = "Chyba rozpoznávání řeči"; if (event.error === 'no-speech') errorMsg = "Nerozpoznal jsem žádnou řeč."; else if (event.error === 'audio-capture') errorMsg = "Chyba mikrofonu."; else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { errorMsg = "Přístup k mikrofonu zamítnut."; if(ui.micBtn) ui.micBtn.disabled = true; } VyukaApp.showToast(errorMsg, 'error'); VyukaApp.stopListening(); }; state.speechRecognition.onend = () => { console.log('Speech recognition ended.'); VyukaApp.stopListening(); }; console.log("Speech Recognition initialized."); };
    VyukaApp.startListening = () => { /* ... no changes ... */ const state = VyukaApp.state; const ui = VyukaApp.ui; if (!state.speechRecognitionSupported || !state.speechRecognition || state.isListening) return; navigator.mediaDevices.getUserMedia({ audio: true }) .then(() => { try { state.speechRecognition.start(); state.isListening = true; ui.micBtn?.classList.add('listening'); if(ui.micBtn) ui.micBtn.title = "Zastavit hlasový vstup"; console.log('Speech recognition started.'); VyukaApp.manageButtonStates(); } catch (e) { console.error("Error starting speech recognition:", e); VyukaApp.showToast("Nepodařilo se spustit rozpoznávání.", "error"); VyukaApp.stopListening(); } }) .catch(err => { console.error("Microphone access denied:", err); VyukaApp.showToast("Přístup k mikrofonu je nutný pro hlasový vstup.", "warning"); if(ui.micBtn) ui.micBtn.disabled = true; VyukaApp.stopListening(); }); };
    VyukaApp.stopListening = () => { /* ... no changes ... */ const state = VyukaApp.state; const ui = VyukaApp.ui; if (!state.speechRecognitionSupported || !state.speechRecognition || !state.isListening) return; try { state.speechRecognition.stop(); } catch (e) {} finally { state.isListening = false; ui.micBtn?.classList.remove('listening'); if(ui.micBtn) ui.micBtn.title = "Zahájit hlasový vstup"; console.log('Speech recognition stopped.'); VyukaApp.manageButtonStates(); } };
    VyukaApp.handleMicClick = () => { /* ... no changes ... */ const state = VyukaApp.state; if (!state.speechRecognitionSupported) { VyukaApp.showToast("Rozpoznávání řeči není podporováno.", "warning"); return; } if (state.isListening) { VyukaApp.stopListening(); } else { VyukaApp.startListening(); } };

    // --- Whiteboard ---
    VyukaApp.clearWhiteboard = (showToastMsg = true) => { /* ... no changes ... */ const ui = VyukaApp.ui; const state = VyukaApp.state; if (!ui.whiteboardContent) return; ui.whiteboardContent.innerHTML = ''; state.boardContentHistory = []; console.log("Whiteboard cleared."); if (showToastMsg) VyukaApp.showToast('Vymazáno', "Tabule vymazána.", "info"); VyukaApp.manageButtonStates(); };
	VyukaApp.appendToWhiteboard = (markdownContent, commentaryText) => { /* ... no changes ... */ const ui = VyukaApp.ui; const state = VyukaApp.state; if (!ui.whiteboardContent || !ui.whiteboardContainer) return; const chunkDiv = document.createElement('div'); chunkDiv.className = 'whiteboard-chunk'; chunkDiv.style.opacity = '0'; const contentDiv = document.createElement('div'); const originalText = markdownContent || ''; VyukaApp.renderMarkdown(contentDiv, originalText, false); const ttsButton = document.createElement('button'); ttsButton.className = 'tts-listen-btn btn-tooltip'; ttsButton.title = 'Poslechnout komentář'; ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>'; const textForSpeech = commentaryText || originalText; ttsButton.dataset.textToSpeak = textForSpeech; if (state.speechSynthesisSupported) { ttsButton.addEventListener('click', (e) => { e.stopPropagation(); VyukaApp.speakText(textForSpeech, chunkDiv); }); chunkDiv.appendChild(ttsButton); } chunkDiv.appendChild(contentDiv); ui.whiteboardContent.appendChild(chunkDiv); state.boardContentHistory.push(originalText); console.log("Appended content to whiteboard."); if (typeof chunkDiv.scrollIntoView === 'function') { chunkDiv.scrollIntoView({ behavior: 'smooth', block: 'start' }); console.log("Scrolled to start of new whiteboard chunk."); } else { ui.whiteboardContainer.scrollTop = chunkDiv.offsetTop; console.warn("scrollIntoView not fully supported, using offsetTop fallback."); } VyukaApp.triggerWhiteboardMathJax(); VyukaApp.initTooltips(); VyukaApp.manageButtonStates(); requestAnimationFrame(() => { chunkDiv.style.opacity = '1'; }); };
    VyukaApp.triggerWhiteboardMathJax = () => { /* ... no changes ... */ const ui = VyukaApp.ui; if (ui.whiteboardContent && window.MathJax && typeof window.MathJax.typesetPromise === 'function') { console.log("[MathJax v19] Triggering global typeset for whiteboard..."); setTimeout(() => { window.MathJax.typesetPromise([ui.whiteboardContent]).then(() => console.log("[MathJax v19] Whiteboard typeset completed.")).catch(e => console.error("[MathJax v19] Whiteboard typeset error:", e)); }, 100); } else { if (!ui.whiteboardContent) console.warn("[MathJax v19] Whiteboard content element not found for typesetting."); if (!(window.MathJax && typeof window.MathJax.typesetPromise === 'function')) console.warn("[MathJax v19] MathJax or typesetPromise not available."); } };

    // --- Topic Loading and Progress ---
    VyukaApp.loadNextUncompletedTopic = async () => { /* ... no changes ... */ const state = VyukaApp.state; const ui = VyukaApp.ui; if (!state.currentUser || state.topicLoadInProgress || !state.supabase) return; state.topicLoadInProgress = true; VyukaApp.setLoadingState('currentTopic', true); state.currentTopic = null; state.aiSuggestedCompletion = false; if (ui.chatMessages) { ui.chatMessages.innerHTML = ''; } VyukaApp.clearWhiteboard(false); state.geminiChatContext = []; state.aiIsWaitingForAnswer = false; VyukaApp.manageUIState('loadingTopic'); try { const { data: plans, error: planError } = await state.supabase.from('study_plans').select('id').eq('user_id', state.currentUser.id).eq('status', 'active').limit(1); if (planError) throw planError; if (!plans || plans.length === 0) { VyukaApp.manageUIState('noPlan'); return; } state.currentPlanId = plans[0].id; const { data: activities, error: activityError } = await state.supabase.from('plan_activities').select('id, title, description, topic_id').eq('plan_id', state.currentPlanId).eq('completed', false).order('day_of_week').order('time_slot').limit(1); if (activityError) throw activityError; if (activities && activities.length > 0) { const activity = activities[0]; let name = activity.title || 'N/A'; let desc = activity.description || ''; if (activity.topic_id) { try { const { data: topic, error: topicError } = await state.supabase.from('exam_topics').select('name, description').eq('id', activity.topic_id).single(); if (topicError && topicError.code !== 'PGRST116') throw topicError; if (topic) { name = topic.name || name; desc = topic.description || desc; } } catch(e) { console.warn("Could not fetch topic details:", e); } } state.currentTopic = { activity_id: activity.id, plan_id: state.currentPlanId, name: name, description: desc, user_id: state.currentUser.id, topic_id: activity.topic_id }; if (ui.currentTopicDisplay) { ui.currentTopicDisplay.innerHTML = `Téma: <strong>${VyukaApp.sanitizeHTML(name)}</strong>`; } await VyukaApp.startLearningSession(); } else { VyukaApp.manageUIState('planComplete'); } } catch (error) { console.error('Error loading next topic:', error); VyukaApp.showToast(`Chyba načítání tématu: ${error.message}`, "error"); VyukaApp.manageUIState('error', { errorMessage: error.message }); } finally { state.topicLoadInProgress = false; VyukaApp.setLoadingState('currentTopic', false); } };
    VyukaApp.handleMarkTopicComplete = async () => {
		const state = VyukaApp.state;
		const config = VyukaApp.config;
		if (!state.currentTopic || !state.supabase || state.topicLoadInProgress) return;
		console.log(`[MarkComplete v19] Attempting to mark topic: ${state.currentTopic.activity_id} (${state.currentTopic.name})`);
		state.topicLoadInProgress = true;
        state.aiSuggestedCompletion = false; // Ensure this is reset
		VyukaApp.manageButtonStates();
		try {
			console.log(`[MarkComplete v19] Points to award: ${config.POINTS_TOPIC_COMPLETE}`);
			const { error } = await state.supabase.from('plan_activities').update({ completed: true, updated_at: new Date().toISOString() }).eq('id', state.currentTopic.activity_id);
			if (error) throw error;
			console.log("[MarkComplete v19] Activity marked as completed in DB.");

			await VyukaApp.awardPoints(config.POINTS_TOPIC_COMPLETE);

            // <<< ACHIEVEMENT TRIGGER POINT (AFTER awarding points) >>>
            if (typeof VyukaApp.checkAndAwardAchievements === 'function') {
                await VyukaApp.checkAndAwardAchievements(state.currentUser.id); // Check achievements after awarding points
            } else {
                console.warn("Achievement checking function (VyukaApp.checkAndAwardAchievements) not found.");
            }

			VyukaApp.showToast(`Téma "${state.currentTopic.name}" dokončeno!`, "success", 3000);
			await VyukaApp.loadNextUncompletedTopic();
		} catch (error) {
			console.error(`[MarkComplete v19] Error marking topic complete:`, error);
			VyukaApp.showToast("Chyba při označování tématu jako dokončeného.", "error");
			state.topicLoadInProgress = false;
			VyukaApp.manageButtonStates();
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
                state.currentProfile.points = newPoints; // Update local state immediately
                console.log(`[Points v19] User ${userId} points updated successfully in DB and state to ${newPoints}.`);
                VyukaApp.showToast('+', `${pointsValue} kreditů získáno!`, 'success', 3000);
                VyukaApp.updateUserInfoUI(); // Update UI
            } else {
                console.warn(`[Points v19] DB update discrepancy for user ${userId}. Expected ${newPoints}, got ${data?.points}. State NOT updated locally.`);
                VyukaApp.showToast('Varování', 'Nekonzistence při aktualizaci kreditů.', 'warning');
            }
		} catch (error) { console.error(`[Points v19] Exception updating user points for ${userId}:`, error); VyukaApp.showToast('Chyba', 'Nepodařilo se aktualizovat kredity.', 'error'); }
		finally { VyukaApp.setLoadingState('points', false); }
	};

    // --- Learning Session & Chat ---
    VyukaApp.startLearningSession = async () => { /* ... no changes ... */ const state = VyukaApp.state; if (!state.currentTopic) return; state.currentSessionId = VyukaApp.generateSessionId(); VyukaApp.clearInitialChatState(); VyukaApp.manageUIState('requestingExplanation'); const prompt = VyukaApp._buildInitialPrompt(); await VyukaApp.sendToGemini(prompt); };
	VyukaApp.requestContinue = async () => { /* ... no changes ... */ const state = VyukaApp.state; console.log("[RequestContinue] Triggered. AI Waiting:", state.aiIsWaitingForAnswer, "AI Suggested Completion:", state.aiSuggestedCompletion); if (state.geminiIsThinking || !state.currentTopic) return; if (state.aiIsWaitingForAnswer) { VyukaApp.showToast("Nejprve odpovězte na úlohu v chatu.", "warning", 3000); console.warn("[RequestContinue] Blocked: AI is waiting for an answer."); return; } if (state.aiSuggestedCompletion) { VyukaApp.showToast("AI navrhlo dokončení tématu. Pro dokončení použijte modální okno nebo požádejte AI o pokračování.", "info"); return; } const prompt = VyukaApp._buildContinuePrompt(); await VyukaApp.sendToGemini(prompt); };
	VyukaApp.addChatMessage = async (displayMessage, sender, saveToDb = true, timestamp = new Date(), ttsText = null, originalContent = null) => { /* ... no changes ... */ const ui = VyukaApp.ui; const state = VyukaApp.state; if (!ui.chatMessages) return; VyukaApp.clearInitialChatState(); const id = `msg-${Date.now()}`; let avatarContent = sender === 'user' ? VyukaApp.getInitials(state.currentProfile, state.currentUser?.email) : 'AI'; const div = document.createElement('div'); div.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`; div.id = id; div.style.opacity = '0'; const avatarDiv = `<div class="message-avatar">${avatarContent}</div>`; const bubbleDiv = document.createElement('div'); bubbleDiv.className = 'message-bubble'; const bubbleContentDiv = document.createElement('div'); bubbleContentDiv.className = 'message-bubble-content'; VyukaApp.renderMarkdown(bubbleContentDiv, displayMessage, true); if (sender === 'gemini' && state.speechSynthesisSupported) { const ttsButton = document.createElement('button'); ttsButton.className = 'tts-listen-btn btn-tooltip'; ttsButton.title = 'Poslechnout'; ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>'; const textForSpeech = ttsText || displayMessage; ttsButton.dataset.textToSpeak = textForSpeech; ttsButton.addEventListener('click', (e) => { e.stopPropagation(); VyukaApp.speakText(textForSpeech); }); bubbleContentDiv.appendChild(ttsButton); } bubbleDiv.appendChild(bubbleContentDiv); const timeDiv = `<div class="message-timestamp">${VyukaApp.formatTimestamp(timestamp)}</div>`; div.innerHTML = avatarDiv + bubbleDiv.outerHTML + timeDiv; ui.chatMessages.appendChild(div); if (window.MathJax && typeof window.MathJax.typesetPromise === 'function' && (displayMessage.includes('$') || displayMessage.includes('\\'))) { console.log(`[MathJax v19] Queueing typeset for chat message bubble: ${id}`); setTimeout(() => { window.MathJax.typesetPromise([bubbleContentDiv]).then(() => console.log(`[MathJax v19] Typeset successful for chat bubble ${id}`)).catch((err) => console.error(`[MathJax v19] Typeset error for chat bubble ${id}: ${err.message}`)); }, 0); } div.scrollIntoView({ behavior: 'smooth', block: 'end' }); requestAnimationFrame(() => { div.style.opacity = '1'; }); VyukaApp.initTooltips(); const contentToSave = originalContent !== null ? originalContent : displayMessage; if (saveToDb && state.supabase && state.currentUser && state.currentTopic && state.currentSessionId) { try { await state.supabase.from('chat_history').insert({ user_id: state.currentUser.id, session_id: state.currentSessionId, topic_id: state.currentTopic.topic_id, topic_name: state.currentTopic.name, role: sender === 'gemini' ? 'model' : 'user', content: contentToSave }); } catch (e) { console.error("Chat save error:", e); VyukaApp.showToast("Chyba ukládání chatu.", "error"); } } VyukaApp.manageButtonStates(); };
    VyukaApp.addThinkingIndicator = () => { /* ... no changes ... */ const ui = VyukaApp.ui; const state = VyukaApp.state; if (state.thinkingIndicatorId || !ui.chatMessages) return; VyukaApp.clearInitialChatState(); const id = `thinking-${Date.now()}`; const div = document.createElement('div'); div.className = 'chat-message model'; div.id = id; div.innerHTML = `<div class="message-avatar">AI</div><div class="message-thinking-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`; ui.chatMessages.appendChild(div); div.scrollIntoView({ behavior: 'smooth', block: 'end' }); state.thinkingIndicatorId = id; VyukaApp.manageButtonStates(); };
	VyukaApp.removeThinkingIndicator = () => { /* ... no changes ... */ const state = VyukaApp.state; if (state.thinkingIndicatorId) { document.getElementById(state.thinkingIndicatorId)?.remove(); state.thinkingIndicatorId = null; } };
	VyukaApp.updateGeminiThinkingState = (isThinking) => { /* ... no changes ... */ const state = VyukaApp.state; const ui = VyukaApp.ui; state.geminiIsThinking = isThinking; VyukaApp.setLoadingState('chat', isThinking); ui.aiAvatarCorner?.classList.toggle('thinking', isThinking); if (!isThinking) ui.aiAvatarCorner?.classList.remove('speaking'); if (isThinking) VyukaApp.addThinkingIndicator(); else VyukaApp.removeThinkingIndicator(); };
	VyukaApp.handleSendMessage = async () => { /* ... no changes ... */ const ui = VyukaApp.ui; const state = VyukaApp.state; const text = ui.chatInput?.value.trim(); if (!text || state.geminiIsThinking || !state.currentTopic || state.isListening) return; state.lastInteractionTime = Date.now(); state.aiSuggestedCompletion = false; if (state.aiIsWaitingForAnswer) { console.log("[HandleSend] Resetting aiIsWaitingForAnswer state."); state.aiIsWaitingForAnswer = false; VyukaApp.manageUIState('learning'); } if (ui.chatInput) { ui.chatInput.value = ''; VyukaApp.autoResizeTextarea(); } await VyukaApp.addChatMessage(text, 'user', true, new Date(), null, text); state.geminiChatContext.push({ role: "user", parts: [{ text }] }); VyukaApp.updateGeminiThinkingState(true); let promptForGemini = VyukaApp._buildChatInteractionPrompt(text); await VyukaApp.sendToGemini(promptForGemini, true); };
	VyukaApp.confirmClearChat = () => { /* ... no changes ... */ if (confirm("Opravdu vymazat historii této konverzace? Tato akce je nevratná.")) { VyukaApp.clearCurrentChatSessionHistory(); } };
	VyukaApp.clearCurrentChatSessionHistory = async () => { /* ... no changes ... */ const ui = VyukaApp.ui; const state = VyukaApp.state; if (ui.chatMessages) { ui.chatMessages.innerHTML = `<div class="initial-chat-interface"><div class="ai-greeting-avatar"><i class="fas fa-robot"></i></div><h3 class="initial-chat-title">AI Tutor Justax je připraven</h3><p class="initial-chat-message">Chat vymazán. Čekám na načtení tématu nebo vaši zprávu.</p><div class="initial-chat-status"><span class="status-dot online"></span> Online</div></div>`; } state.geminiChatContext = []; VyukaApp.showToast("Historie chatu vymazána.", "info"); if (state.supabase && state.currentUser && state.currentSessionId) { try { const { error } = await state.supabase.from('chat_history').delete().match({ user_id: state.currentUser.id, session_id: state.currentSessionId }); if (error) throw error; console.log(`Chat history deleted from DB for session: ${state.currentSessionId}`); } catch (e) { console.error("DB clear chat error:", e); VyukaApp.showToast("Chyba při mazání historie chatu z databáze.", "error"); } } VyukaApp.manageButtonStates(); };
	VyukaApp.saveChatToPDF = async () => { /* ... no changes ... */ const ui = VyukaApp.ui; const state = VyukaApp.state; if (!ui.chatMessages || ui.chatMessages.children.length === 0 || !!ui.chatMessages.querySelector('.initial-chat-interface')) { VyukaApp.showToast("Není co uložit.", "warning"); return; } if (typeof html2pdf === 'undefined') { VyukaApp.showToast("Chyba: PDF knihovna nenalezena.", "error"); return; } VyukaApp.showToast("Generuji PDF...", "info", 4000); const elementToExport = document.createElement('div'); elementToExport.style.padding="15mm"; elementToExport.innerHTML = `<style>body { font-family: 'Poppins', sans-serif; font-size: 10pt; line-height: 1.5; color: #333; } .chat-message { margin-bottom: 12px; max-width: 90%; page-break-inside: avoid; } .user { margin-left: 10%; } .model { margin-right: 10%; } .message-bubble { display: inline-block; padding: 8px 14px; border-radius: 15px; background-color: #e9ecef; } .user .message-bubble { background-color: #d1e7dd; } .message-timestamp { font-size: 8pt; color: #6c757d; margin-top: 4px; display: block; } .user .message-timestamp { text-align: right; } h1 { font-size: 16pt; color: #0d6efd; text-align: center; margin-bottom: 5px; } p.subtitle { font-size: 9pt; color: #6c757d; text-align: center; margin: 0 0 15px 0; } hr { border: 0; border-top: 1px solid #ccc; margin: 15px 0; } .tts-listen-btn { display: none; } mjx-math { font-size: 1em; } pre { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 0.8em; border-radius: 6px; overflow-x: auto; font-size: 0.9em; } code { background-color: #e9ecef; padding: 0.1em 0.3em; border-radius: 3px; } pre code { background: none; padding: 0; } .message-avatar { display: none; }</style><h1>Chat s AI Tutorem - ${VyukaApp.sanitizeHTML(state.currentTopic?.name || 'Neznámé téma')}</h1><p class="subtitle">Vygenerováno: ${new Date().toLocaleString('cs-CZ')}</p><hr>`; Array.from(ui.chatMessages.children).forEach(msgElement => { if (msgElement.classList.contains('chat-message') && !msgElement.id.startsWith('thinking-')) { const clone = msgElement.cloneNode(true); clone.querySelector('.message-avatar')?.remove(); clone.querySelector('.tts-listen-btn')?.remove(); clone.classList.add('msg'); if(msgElement.classList.contains('user')) clone.classList.add('user'); else clone.classList.add('model'); clone.querySelector('.message-bubble')?.classList.add('bubble'); clone.querySelector('.message-timestamp')?.classList.add('time'); elementToExport.appendChild(clone); } }); const filename = `chat-${state.currentTopic?.name?.replace(/[^a-z0-9]/gi, '_') || 'vyuka'}-${Date.now()}.pdf`; const pdfOptions = { margin: 15, filename: filename, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, logging: false }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }; try { await html2pdf().set(pdfOptions).from(elementToExport).save(); VyukaApp.showToast("Chat uložen jako PDF!", "success"); } catch (e) { console.error("PDF Generation Error:", e); VyukaApp.showToast("Chyba při generování PDF.", "error"); } };

    // --- Functions for Modal ---
    VyukaApp.showCompletionModal = () => { /* ... no changes ... */ const ui = VyukaApp.ui; if (ui.completionSuggestionOverlay) { ui.completionSuggestionOverlay.style.display = 'flex'; requestAnimationFrame(() => { ui.completionSuggestionOverlay.classList.add('visible'); }); console.log("[Modal] Showing completion suggestion modal."); } else { console.error("[Modal] Error: Completion suggestion overlay element not found!"); } };
    VyukaApp.hideCompletionModal = () => { /* ... no changes ... */ const ui = VyukaApp.ui; if (ui.completionSuggestionOverlay) { ui.completionSuggestionOverlay.classList.remove('visible'); setTimeout(() => { if (ui.completionSuggestionOverlay) ui.completionSuggestionOverlay.style.display = 'none'; }, 300); console.log("[Modal] Hiding completion suggestion modal."); } };
    VyukaApp.promptTopicCompletion = () => { /* ... no changes ... */ console.log("[CompletionPrompt v19] AI suggested topic completion. Showing modal."); VyukaApp.state.aiSuggestedCompletion = true; VyukaApp.manageButtonStates(); VyukaApp.showCompletionModal(); };
    VyukaApp.handleConfirmCompletion = () => { /* ... no changes ... */ console.log("[CompletionPrompt v19] User chose YES."); VyukaApp.hideCompletionModal(); VyukaApp.handleMarkTopicComplete(); };
    VyukaApp.handleDeclineCompletion = () => { /* ... no changes ... */ console.log("[CompletionPrompt v19] User chose NO or closed modal."); VyukaApp.hideCompletionModal(); VyukaApp.state.aiSuggestedCompletion = false; VyukaApp.showToast("Dobře, můžete pokračovat kliknutím na 'Pokračuj' nebo položením otázky.", "info", 5000); VyukaApp.manageButtonStates(); };
    VyukaApp.handleOverlayClick = (event) => { /* ... no changes ... */ const ui = VyukaApp.ui; if (event.target === ui.completionSuggestionOverlay) { VyukaApp.handleDeclineCompletion(); } };

    // --- Gemini Interaction & Parsing ---
    VyukaApp.parseGeminiResponse = (rawText) => { /* ... no changes ... */ console.log("[ParseGemini v19] Raw input:", rawText ? rawText.substring(0, 150) + "..." : "EMPTY"); const config = VyukaApp.config; const boardMarker = "[BOARD_MARKDOWN]:"; const ttsMarker = "[TTS_COMMENTARY]:"; const actionMarker = config.ACTION_SUGGEST_COMPLETION; const boardRegex = /(\[BOARD_MARKDOWN]:)\s*(?:markdown\s*)?(?:`{3}(?:markdown)?\s*([\s\S]*?)\s*`{3}|([\s\S]*?))(?=\s*\[TTS_COMMENTARY]:|\s*\[BOARD_MARKDOWN]:|\s*\[ACTION:SUGGEST_COMPLETION]:|$)/i; const ttsRegex = /(\[TTS_COMMENTARY]:)\s*(?:`{3}\s*([\s\S]*?)\s*`{3}|([\s\S]*?))(?=\s*\[BOARD_MARKDOWN]:|\s*\[TTS_COMMENTARY]:|\s*\[ACTION:SUGGEST_COMPLETION]:|$)/i; const actionRegex = /(\[ACTION:SUGGEST_COMPLETION])/i; let remainingText = rawText || ""; let boardMarkdown = ""; let ttsCommentary = ""; let actionSignal = null; const actionMatch = remainingText.match(actionRegex); if (actionMatch) { actionSignal = 'SUGGEST_COMPLETION'; remainingText = remainingText.replace(actionMatch[0], "").trim(); console.log(`[ParseGemini v19] Found action signal: ${actionSignal}`); if (remainingText.length === 0) { return { boardMarkdown: "", ttsCommentary: "", chatText: "", actionSignal }; } } const boardMatch = remainingText.match(boardRegex); console.log("[ParseGemini v19] Board Regex Match:", boardMatch); if (boardMatch) { boardMarkdown = (boardMatch[2] || boardMatch[3] || "").trim(); console.log(`[ParseGemini v19] Extracted Board Content (Raw): "${boardMarkdown.substring(0,70)}..."`); remainingText = remainingText.replace(boardMatch[0], ""); console.log(`[ParseGemini v19] Found board content. Length: ${boardMarkdown.length}`); if (boardMarkdown.toLowerCase().startsWith('markdown')) { const potentialNewlineIndex = boardMarkdown.indexOf('\n'); if (potentialNewlineIndex !== -1 && potentialNewlineIndex < 15) { boardMarkdown = boardMarkdown.substring(potentialNewlineIndex + 1).trim(); console.warn("[ParseGemini v19] Cleaned leading 'markdown' word."); } else if (boardMarkdown.length < 15) { boardMarkdown = ""; console.warn("[ParseGemini v19] Discarded short content starting with 'markdown'."); } } } else { console.log(`[ParseGemini v19] Marker "${boardMarker}" not found or malformed.`); } const ttsMatch = remainingText.match(ttsRegex); if (ttsMatch) { ttsCommentary = (ttsMatch[2] || ttsMatch[3] || "").trim(); remainingText = remainingText.replace(ttsMatch[0], ""); console.log(`[ParseGemini v19] Found TTS content. Length: ${ttsCommentary.length}`); } else { console.log(`[ParseGemini v19] Marker "${ttsMarker}" not found or malformed.`); } let chatText = remainingText.replace(/```(markdown)?\s*|\s*```/g, '').replace(/\[BOARD_MARKDOWN]:/gi, '').replace(/\[TTS_COMMENTARY]:/gi, '').replace(/\[ACTION:SUGGEST_COMPLETION]/gi, '').trim(); console.log("[ParseGemini v19] Result - Board:", boardMarkdown ? boardMarkdown.substring(0, 50) + "..." : "None"); console.log("[ParseGemini v19] Result - TTS:", ttsCommentary ? ttsCommentary.substring(0, 50) + "..." : "None"); console.log("[ParseGemini v19] Result - Chat:", chatText ? chatText.substring(0, 50) + "..." : "None"); console.log("[ParseGemini v19] Result - Action:", actionSignal); return { boardMarkdown, ttsCommentary, chatText, actionSignal }; };
	VyukaApp.processGeminiResponse = (rawText, timestamp) => { /* ... no changes ... */ const state = VyukaApp.state; VyukaApp.removeThinkingIndicator(); state.lastInteractionTime = Date.now(); console.log("[ProcessGemini v19] Processing Raw Response:", rawText ? rawText.substring(0, 100) + "..." : "Empty Response"); if (!rawText) { VyukaApp.handleGeminiError("AI vrátilo prázdnou odpověď.", timestamp); VyukaApp.manageButtonStates(); return; } const { boardMarkdown, ttsCommentary, chatText, actionSignal } = VyukaApp.parseGeminiResponse(rawText); let aiResponded = false; const cleanedChatText = cleanChatMessage(chatText); console.log(`[ProcessGemini v19] Parsed-> Board: ${!!boardMarkdown}, TTS: ${!!ttsCommentary}, Chat: ${!!cleanedChatText}, Action: ${actionSignal}`); if (actionSignal === 'SUGGEST_COMPLETION') { VyukaApp.promptTopicCompletion(); aiResponded = true; if (ttsCommentary) { VyukaApp.speakText(ttsCommentary); } VyukaApp.manageUIState('suggestedCompletion'); } if (boardMarkdown) { VyukaApp.appendToWhiteboard(boardMarkdown, ttsCommentary || boardMarkdown); if (ttsCommentary && actionSignal !== 'SUGGEST_COMPLETION') { VyukaApp.speakText(ttsCommentary); } aiResponded = true; if (actionSignal !== 'SUGGEST_COMPLETION') { state.aiIsWaitingForAnswer = false; } if (actionSignal !== 'SUGGEST_COMPLETION') { const lowerBoard = boardMarkdown.toLowerCase(); const taskKeywords = ['úloha k řešení', 'vyřešte tento příklad', 'zodpovězte následující', 'úkol:', 'otázka k procvičení']; const taskHeaderRegex = /###\s*(úloha|příklad k řešení|úkol|otázka)/i; const zadaniEndsWithQuestion = /\*\*zadání:\*\*[\s\S]*\?$/i; if (taskKeywords.some(kw => lowerBoard.includes(kw)) || taskHeaderRegex.test(boardMarkdown) || zadaniEndsWithQuestion.test(boardMarkdown.replace(/\s+/g, ' '))) { state.aiIsWaitingForAnswer = true; console.log("[ProcessGemini v19] Task DETECTED on board, setting aiIsWaitingForAnswer = true."); } else { console.log("[ProcessGemini v19] No task detected on board."); } } } if (cleanedChatText) { const ttsForChat = (!boardMarkdown && ttsCommentary && actionSignal !== 'SUGGEST_COMPLETION') ? ttsCommentary : null; VyukaApp.addChatMessage(cleanedChatText, 'gemini', true, timestamp, ttsForChat, chatText); aiResponded = true; } else if (ttsCommentary && !boardMarkdown && actionSignal !== 'SUGGEST_COMPLETION') { VyukaApp.speakText(ttsCommentary); aiResponded = true; } if (!aiResponded && !actionSignal) { VyukaApp.addChatMessage("(AI neodpovědělo očekávaným formátem nebo odpověď byla prázdná)", 'gemini', false, timestamp, null, rawText || "(Prázdná/neplatná odpověď)"); console.warn("AI sent no usable content and no action signal."); state.aiIsWaitingForAnswer = false; } if (state.aiIsWaitingForAnswer) { VyukaApp.manageUIState('waitingForAnswer'); } else if (state.aiSuggestedCompletion) { VyukaApp.manageUIState('suggestedCompletion'); } else { VyukaApp.manageUIState('learning'); } };
	VyukaApp._buildInitialPrompt = () => { /* ... no changes ... */ const state = VyukaApp.state; const config = VyukaApp.config; const level = state.currentProfile?.skill_level || 'středně pokročilá'; const topicName = state.currentTopic?.name || 'Neznámé téma'; return `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. Tvé vysvětlení musí být strukturované, přesné a profesionální. Téma lekce: "${topicName}". Cílová úroveň studenta: "${level}". HLAVNÍ PRAVIDLA (DODRŽUJ VŽDY!): 1.  **Obsah na tabuli ([BOARD_MARKDOWN]):** Všechny klíčové informace (definice, věty, vzorce), **MINIMÁLNĚ DVA ŘEŠENÉ PŘÍKLADY (nejprve jednoduchý, pak složitější)** a ÚLOHY K ŘEŠENÍ MUSÍ být ve formátu Markdown zde. Tabule je HLAVNÍ výukový prostor. Používej $$...$$ pro matematiku. 2.  **Hlasový komentář ([TTS_COMMENTARY]):** Slouží pro DOPLŇUJÍCÍ hlasový komentář k obsahu na tabuli (shrnutí, kontext, důraz). NEOPAKUJ doslova text z tabule. 3.  **Chat (Text mimo značky):** Používej MINIMÁLNĚ (pozdravy). NIKDY v chatu nezadávej nové úlohy/příklady. 4.  **Struktura a Náročnost:** Postupuj logicky: základy -> **VÍCE řešených příkladů (různá obtížnost)** -> **náročné ÚLOHY K ŘEŠENÍ úrovně přijímaček**. VŽDY zařaď nejprve řešené příklady, až POTOM úlohu k řešení studentem (vše na tabuli!). Používej RŮZNÉ typy úloh (výpočty, slovní úlohy, úlohy s více kroky, zlomky, parametry - pokud relevantní). 5.  **Interakce:** * Po zadání ÚLOHY K ŘEŠENÍ na tabuli, v [TTS_COMMENTARY] **JASNĚ uveď, že očekáváš odpověď** studenta v chatu. **NEPOKLÁDEJ další otázku v chatu.** Systém zablokuje tlačítko "Pokračuj". * Po běžném vysvětlení nebo řešeném příkladu **ABSOLUTNĚ NEČEKEJ na odpověď** a **STRIKTNĚ ZAKÁZÁNO ptát se "Je to jasné?"**, "Rozumíš?", "Pokračujeme?". Student sám klikne na "Pokračuj". 6.  **Fokus na Téma:** **STRIKTNĚ se drž tématu lekce: "${topicName}".** Nevysvětluj nesouvisející pokročilé koncepty, pokud nejsou PŘÍMOU součástí tohoto konkrétního tématu pro 9. třídu. 7.  **Navržení Dokončení Tématu:** Pokud usoudíš, že téma bylo dostatečně probráno (student odpovídá správně, byly probrány klíčové koncepty a typy příkladů), **místo dalšího obsahu nebo otázky**, pošli POUZE signál **${config.ACTION_SUGGEST_COMPLETION}**. Neposílej v tomto případě žádný další text ani značky [BOARD_MARKDOWN] / [TTS_COMMENTARY]. Systém se pak zeptá uživatele. PRVNÍ KROK: Začni se ZÁKLADNÍ DEFINICÍ nebo klíčovým konceptem tématu "${topicName}". Poskytni **alespoň JEDEN ŘEŠENÝ PŘÍKLAD** (jednoduchý). POŽADOVANÝ FORMÁT ODPOVĚDI (pro první krok): [BOARD_MARKDOWN]: \`\`\`markdown ## ${topicName} - Základy ### [Krátký, výstižný podnadpis, např. Definice Lineární Rovnice] (Zde napiš stručnou, přesnou definici nebo úvodní koncept. Použij **tučné písmo** pro termíny a $$...$$ pro matematiku.) ### První řešený příklad (Základní) (Zde uveď první VELMI JEDNODUCHÝ řešený příklad ilustrující definici. Jasně odděl zadání a kroky řešení.) **Zadání:** ... **Řešení:** * Krok 1: ... ($$...$$) * Krok 2: ... ($$...$$) * Výsledek: $$...$$ \`\`\` [TTS_COMMENTARY]: (Zde napiš hlasový komentář: Stručné přivítání, představení tématu a shrnutí toho, co je na tabuli – definice a první příklad. Zdůrazni klíčový bod. NEPOKLÁDEJ OTÁZKU.) (Text do chatu - VOLITELNÉ, velmi krátký, např. "Začněme.")`; };
	VyukaApp._buildContinuePrompt = () => { /* ... no changes ... */ const state = VyukaApp.state; const config = VyukaApp.config; const level = state.currentProfile?.skill_level || 'středně pokročilá'; const topicName = state.currentTopic?.name || 'Neznámé téma'; return `Pokračuj ve výkladu tématu "${topicName}" pro studenta úrovně "${level}" připravujícího se na PŘIJÍMACÍ ZKOUŠKY 9. třídy. Naváž logicky na PŘEDCHOZÍ OBSAH NA TABULI. HLAVNÍ PRAVIDLA (PŘIPOMENUTÍ!): * Všechny NOVÉ informace, **VÍCE ŘEŠENÝCH PŘÍKLADŮ** a ÚLOHY K ŘEŠENÍ patří VÝHRADNĚ do [BOARD_MARKDOWN]. * [TTS_COMMENTARY] použij pro DOPLNĚNÍ k tabuli. * STRIKTNĚ se drž tématu "${topicName}" a úrovně 9. třídy. * Postupně ZVYŠUJ NÁROČNOST příkladů a úloh k úrovni přijímaček. **Vždy uveď dostatek řešených příkladů PŘED zadáním úlohy studentovi.** * Po zadání ÚLOHY K ŘEŠENÍ na tabuli, v [TTS_COMMENTARY] **JASNĚ řekni, že čekáš odpověď** v chatu. * Po teorii/řešeném příkladu **ABSOLUTNĚ NEČEKEJ na odpověď** a **STRIKTNĚ ZAKÁZÁNO ptát se "Je to jasné?", "Rozumíš?", "Pokračujeme?".** * Pokud usoudíš, že téma je dostatečně probráno, **místo dalšího obsahu pošli POUZE signál ${config.ACTION_SUGGEST_COMPLETION}**. DALŠÍ KROK: Vyber a vygeneruj JEDEN z následujících kroků (nebo navrhni dokončení): A) Další část teorie/vysvětlení navazující na předchozí. B) **Několik (alespoň 2) dalších ŘEŠENÝCH příkladů** (složitější než předchozí, může být i slovní úloha). C) ÚLOHU K ŘEŠENÍ pro studenta (až PO dostatečném množství řešených příkladů; náročnost úrovně přijímaček). D) Pokud je téma probráno -> pošli signál ${config.ACTION_SUGGEST_COMPLETION}. POŽADOVANÝ FORMÁT ODPOVĚDI (Pokud NEPOSÍLÁŠ signál): [BOARD_MARKDOWN]: \`\`\`markdown ### [Nadpis další části / Řešené příklady (Typ) / Úloha k řešení (Typ)] (Zde uveď text vysvětlení NEBO zadání a PODROBNÁ řešení příkladů NEBO POUZE ZADÁNÍ úlohy k řešení. Používej Markdown, $$...$$.) \`\`\` [TTS_COMMENTARY]: (Zde napiš hlasový komentář k NOVÉMU obsahu. Pokud jsi zadal ÚLOHU K ŘEŠENÍ, **JASNĚ řekni:** "Nyní zkuste tuto úlohu vyřešit vy a napište mi výsledek/postup do chatu." Pokud jde o teorii/řešený příklad, stručně shrň hlavní myšlenku nebo upozorni na klíčový krok. **NEPOKLÁDEJ OTÁZKU.**) (Text do chatu - POUZE pokud NEZADÁVÁŠ úlohu k řešení, např. "Podíváme se na další typ.")`; };
	VyukaApp._buildChatInteractionPrompt = (userText) => { /* ... no changes ... */ const state = VyukaApp.state; const config = VyukaApp.config; const level = state.currentProfile?.skill_level || 'středně pokročilá'; const topicName = state.currentTopic?.name || 'Neznámé téma'; let baseInstruction; if (state.aiIsWaitingForAnswer) { baseInstruction = `Student odpověděl ("${userText}") na úlohu k tématu "${topicName}", která byla zadána na tabuli. TVŮJ ÚKOL: 1.  **Stručně a PŘESNĚ vyhodnoť správnost** studentovy odpovědi/postupu. Použij matematickou terminologii. 2.  Pokud je odpověď nesprávná nebo neúplná: **Jasně vysvětli chybu** a uveď správný postup nebo výsledek. Buď konstruktivní. 3.  Pokud je odpověď správná: **Krátce pochval (např. 'Správně!', 'Výborně!'). NEPOKLÁDEJ ŽÁDNÉ DALŠÍ OTÁZKY** (ani 'Chceš pokračovat?' apod.). Jen potvrď správnost. 4.  **V obou případech (správná i nesprávná odpověď): UKONČI svou odpověď ZDE.** Další krok zahájí student kliknutím na "Pokračuj".`; } else { baseInstruction = `Student položil otázku nebo komentář k probíranému tématu "${topicName}": "${userText}". TVŮJ ÚKOL: 1.  **Odpověz stručně a PŘÍMO k dotazu studenta.** Využij kontext toho, co je aktuálně na TABULI. 2.  **NEVYSVĚTLUJ novou látku** ani nezadávej nové příklady v chatu. Odkazuj na tabuli nebo řekni, že to bude probráno dále. 3.  **Pokud studentův dotaz směřuje MIMO aktuální téma "${topicName}", jemně ho vrať zpět.** 4.  Udržuj profesionální, ale nápomocný tón (úroveň "${level}"). 5.  **Na konci své odpovědi NEPOKLÁDEJ otázky typu "Stačí takto?", "Je to srozumitelnější?" apod. Odpověz POUZE na otázku a SKONČI.** Příklad POUZE přímé odpovědi: "Součet je 25 a rozdíl 7." NEBO "Ano, tento krok je správný." NIC VÍC.`; } return `${baseInstruction} PRAVIDLA CHATU (PŘIPOMENUTÍ): Odpovídej POUZE běžným textem do chatu. Nepoužívej [BOARD_MARKDOWN] ani [TTS_COMMENTARY]. Buď stručný a věcný.`; };
	VyukaApp._buildGeminiPayloadContents = (userPrompt, isChatInteraction = false) => { /* ... no changes ... */ const state = VyukaApp.state; const config = VyukaApp.config; const level = state.currentProfile?.skill_level || 'středně pokročilá'; const topicName = state.currentTopic?.name || 'Neznámé téma'; const systemInstruction = `Jsi expertní AI Tutor "Justax", specialista na přípravu na PŘIJÍMACÍ ZKOUŠKY z matematiky pro 9. třídu ZŠ v ČR. Komunikuješ v ČEŠTINĚ. VŽDY dodržuj tato pravidla: 1.  **Obsah na tabuli ([BOARD_MARKDOWN]):** Všechny definice, vzorce, vysvětlení, **VÍCE ŘEŠENÝCH PŘÍKLADŮ** a ÚLOHY K ŘEŠENÍ patří VÝHRADNĚ sem: \`\`\`markdown ... \`\`\`. Používej Markdown a $$...$$ pro matematiku. Příklady předchází úlohám. 2.  **Hlasový komentář ([TTS_COMMENTARY]):** Používej pro DOPLNĚNÍ k tabuli, NEOPAKUJ text doslova. 3.  **Chat (Text mimo značky):** Používej MINIMÁLNĚ. NIKDY v něm nezadávej nové úlohy/příklady. 4.  **Struktura a Náročnost:** Postupuj logicky, zvyšuj náročnost úloh k úrovni PŘIJÍMACÍCH ZKOUŠEK 9. třídy. **Vždy dej VÍCE řešených příkladů PŘED úlohou pro studenta.** 5.  **Interakce:** Po zadání ÚLOHY K ŘEŠENÍ na tabuli, v [TTS_COMMENTARY] jasně řekni, že čekáš na odpověď studenta v chatu. V JINÝCH případech (teorie, řešené příklady) NEČEKEJ na odpověď a NEPOKLÁDEJ zbytečné dotazy ("Jasné?", "Pokračujeme?"). 6.  **Fokus na Téma:** **STRIKTNĚ se drž tématu lekce: "${topicName}".** Nevysvětluj nesouvisející pokročilé koncepty. 7.  **Odpovědi v chatu:** Pokud student ODPOVÍDÁ na úlohu nebo POKLÁDÁ OTÁZKU, odpovídej POUZE textem do CHATU podle instrukcí v uživatelském promptu. Po správné odpovědi studenta JEN potvrď a UKONČI odpověď. **Když odpovídáš na otázku studenta, odpověz PŘÍMO a ihned SKONČI. NIKDY nekonči otázkami jako "Stačí takto?", "Je to jasné?" apod.** 8.  **Navržení Dokončení Tématu:** Když usoudíš, že téma je probráno, místo dalšího obsahu pošli **POUZE** signál **${config.ACTION_SUGGEST_COMPLETION}**.`; const history = state.geminiChatContext.slice(-config.MAX_GEMINI_HISTORY_TURNS * 2); const currentUserMessage = { role: "user", parts: [{ text: userPrompt }] }; const contents = [ { role: "user", parts: [{ text: systemInstruction }] }, { role: "model", parts: [{ text: `Rozumím. Budu se řídit pravidly. Výklad a úlohy budou na tabuli ve formátu [BOARD_MARKDOWN], přičemž dám více řešených příkladů před úlohami pro studenta. Komentář bude v [TTS_COMMENTARY]. Chat využiji minimálně nebo pro reakce na studentovy otázky/řešení. Budu se držet tématu "${topicName}" a zvyšovat náročnost pro úroveň 9. třídy. Nebudu pokládat zbytečné otázky. Pokud usoudím, že téma je probráno, pošlu signál ${config.ACTION_SUGGEST_COMPLETION}.` }] }, ...history, currentUserMessage ]; return contents; };
	VyukaApp.sendToGemini = async (prompt, isChatInteraction = false) => { /* ... no changes ... */ const config = VyukaApp.config; const state = VyukaApp.state; if (!config.GEMINI_API_KEY || !config.GEMINI_API_KEY.startsWith('AIzaSy')) { VyukaApp.showToast("Chyba Konfigurace", "Chybí API klíč pro AI.", "error"); VyukaApp.updateGeminiThinkingState(false); return; } if (!state.currentTopic) { VyukaApp.showToast("Chyba", "Není vybráno téma.", "error"); VyukaApp.updateGeminiThinkingState(false); return; } if (!navigator.onLine) { VyukaApp.showToast("Offline", "Nelze komunikovat s AI bez připojení.", "warning"); VyukaApp.updateGeminiThinkingState(false); return; } console.log(`Sending to Gemini (Chat Interaction: ${isChatInteraction}): "${prompt.substring(0, 80)}..."`); const timestamp = new Date(); VyukaApp.updateGeminiThinkingState(true); const contents = VyukaApp._buildGeminiPayloadContents(prompt, isChatInteraction); const body = { contents, generationConfig: { temperature: 0.6, topP: 0.95, topK: 40, maxOutputTokens: 8192 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ] }; try { const response = await fetch(config.GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!response.ok) { let errorText = `Chyba API (${response.status})`; try { const errData = await response.json(); errorText += `: ${errData?.error?.message || 'Neznámá chyba'}`; } catch (e) { errorText += `: ${await response.text()}`; } throw new Error(errorText); } const data = await response.json(); console.log("[DEBUG] Raw Gemini Response Data:", JSON.stringify(data, null, 2)); if (data.promptFeedback?.blockReason) { throw new Error(`Požadavek blokován: ${data.promptFeedback.blockReason}. Zkuste přeformulovat.`); } const candidate = data.candidates?.[0]; if (!candidate) { throw new Error('AI neposkytlo platnou odpověď (no candidate).'); } if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) { console.warn(`Gemini finishReason: ${candidate.finishReason}.`); if (candidate.finishReason === 'SAFETY') throw new Error('Odpověď blokována bezpečnostním filtrem AI.'); } const text = candidate.content?.parts?.[0]?.text; if (!text && candidate.finishReason !== 'STOP') { if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Odpověď AI byla příliš dlouhá (Max Tokens).'); else throw new Error('AI vrátilo prázdnou odpověď (Důvod: '+(candidate.finishReason || 'Neznámý')+').'); } state.geminiChatContext.push({ role: "user", parts: [{ text: prompt }] }); state.geminiChatContext.push({ role: "model", parts: [{ text: text || "" }] }); if (state.geminiChatContext.length > config.MAX_GEMINI_HISTORY_TURNS * 2 + 2) { state.geminiChatContext.splice(2, state.geminiChatContext.length - (config.MAX_GEMINI_HISTORY_TURNS * 2 + 2)); } VyukaApp.processGeminiResponse(text || "", timestamp); } catch (error) { console.error('Chyba komunikace s Gemini:', error); console.error('Error stack:', error.stack); VyukaApp.showToast(`Chyba AI: ${error.message}`, "error"); VyukaApp.handleGeminiError(error.message, timestamp); } finally { VyukaApp.updateGeminiThinkingState(false); } };
	VyukaApp.handleGeminiError = (msg, time) => { /* ... no changes ... */ const state = VyukaApp.state; VyukaApp.removeThinkingIndicator(); VyukaApp.addChatMessage(`Nastala chyba při komunikaci s AI: ${msg}`, 'gemini', false, time, null, `(Chyba: ${msg})`); state.aiIsWaitingForAnswer = false; VyukaApp.manageUIState('learning'); };

    // --- Notification Logic ---
    VyukaApp.fetchNotifications = async (userId, limit = VyukaApp.config.NOTIFICATION_FETCH_LIMIT) => { /* ... no changes ... */ const state = VyukaApp.state; if (!state.supabase || !userId) { console.error("[Notifications] Missing Supabase or User ID."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Fetching unread notifications for user ${userId}`); VyukaApp.setLoadingState('notifications', true); try { const { data, error, count } = await state.supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; console.log(`[Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); VyukaApp.showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } finally { VyukaApp.setLoadingState('notifications', false); } };
	VyukaApp.renderNotifications = (count, notifications) => { /* ... no changes ... */ const ui = VyukaApp.ui; console.log("[Render Notifications] Start, Count:", count, "Notifications:", notifications); if (!ui.notificationCount || !ui.notificationsList || !ui.noNotificationsMsg || !ui.markAllReadBtn) { console.error("[Render Notifications] Missing UI elements for notifications."); return; } ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); ui.notificationCount.classList.toggle('visible', count > 0); if (notifications && notifications.length > 0) { ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${VyukaApp.sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${VyukaApp.sanitizeHTML(n.title)}</div><div class="notification-message">${VyukaApp.sanitizeHTML(n.message)}</div><div class="notification-time">${VyukaApp.formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; ui.markAllReadBtn.disabled = count === 0; } else { ui.notificationsList.innerHTML = ''; ui.noNotificationsMsg.style.display = 'block'; ui.notificationsList.style.display = 'none'; ui.markAllReadBtn.disabled = true; } console.log("[Render Notifications] Finished rendering."); };
	VyukaApp.renderNotificationSkeletons = (count = 2) => { /* ... no changes ... */ const ui = VyukaApp.ui; if (!ui.notificationsList || !ui.noNotificationsMsg) return; let skeletonHTML = ''; for (let i = 0; i < count; i++) { skeletonHTML += `<div class="notification-item skeleton"><div class="notification-icon skeleton" style="background-color: var(--skeleton-bg);"></div><div class="notification-content"><div class="skeleton" style="height: 16px; width: 70%; margin-bottom: 6px;"></div><div class="skeleton" style="height: 12px; width: 90%;"></div><div class="skeleton" style="height: 10px; width: 40%; margin-top: 6px;"></div></div></div>`; } ui.notificationsList.innerHTML = skeletonHTML; ui.noNotificationsMsg.style.display = 'none'; ui.notificationsList.style.display = 'block'; };
	VyukaApp.markNotificationRead = async (notificationId) => { /* ... no changes ... */ const state = VyukaApp.state; console.log("[Notifications] Marking notification as read:", notificationId); if (!state.currentUser || !notificationId || !state.supabase) return false; try { const { error } = await state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[Notifications] Mark as read successful for ID:", notificationId); return true; } catch (error) { console.error("[Notifications] Mark as read error:", error); VyukaApp.showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } };
	VyukaApp.markAllNotificationsRead = async () => { /* ... no changes ... */ const state = VyukaApp.state; const ui = VyukaApp.ui; console.log("[Notifications] Marking all as read for user:", state.currentUser?.id); if (!state.currentUser || !ui.markAllReadBtn || !state.supabase) return; VyukaApp.setLoadingState('notifications', true); ui.markAllReadBtn.disabled = true; try { const { error } = await state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', state.currentUser.id).eq('is_read', false); if (error) throw error; console.log("[Notifications] Mark all as read successful in DB."); const { unreadCount, notifications } = await VyukaApp.fetchNotifications(state.currentUser.id, VyukaApp.config.NOTIFICATION_FETCH_LIMIT); VyukaApp.renderNotifications(unreadCount, notifications); VyukaApp.showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[Notifications] Mark all as read error:", error); VyukaApp.showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); const currentCount = parseInt(ui.notificationCount?.textContent?.replace('+', '') || '0'); ui.markAllReadBtn.disabled = currentCount === 0; } finally { VyukaApp.setLoadingState('notifications', false); } };

	// --- START: Achievement Logic (NEW) ---

	/**
	 * Checks if user profile data meets badge requirements.
	 * @param {object} profileData - User's profile data (points, level, streak_days, etc.).
	 * @param {object} requirements - Badge requirements object (e.g., { type: "points_earned", target: 1000 }).
	 * @returns {boolean} - True if requirements are met, false otherwise.
	 */
	VyukaApp.checkRequirements = (profileData, requirements) => {
		if (!profileData || !requirements || typeof requirements !== 'object') {
			console.warn("[Achievements CheckReq] Invalid input for checking requirements.", profileData, requirements);
			return false;
		}

		const reqType = requirements.type;
		const reqTarget = parseInt(requirements.target, 10);

		if (!reqType || isNaN(reqTarget)) {
			console.warn(`[Achievements CheckReq] Invalid requirement type or target:`, requirements);
			return false;
		}

		let currentValue = 0;
		try {
			switch (reqType) {
				case 'points_earned':
					currentValue = profileData.points ?? 0;
					break;
				case 'streak_days':
					currentValue = profileData.streak_days ?? 0;
					break;
				case 'exercises_completed': // Assumes 'completed_exercises' field exists in profiles
					currentValue = profileData.completed_exercises ?? 0;
					break;
				case 'level_reached':
					currentValue = profileData.level ?? 1;
					break;
				case 'tests_completed': // Assumes 'completed_tests' field exists in profiles
                    // Note: profiles table in schema dump didn't have completed_tests, but user_stats did.
                    // Using profileData first, then maybe currentUserStats if available globally?
                    // For simplicity now, assuming it might be added to profileData when fetched before calling this.
					currentValue = profileData.completed_tests ?? VyukaApp.state.currentUserStats?.completed_tests ?? 0; // Fallback to potentially fetched stats
					break;
				// Add other requirement types here (e.g., specific topic mastery)
				default:
					console.warn(`[Achievements CheckReq] Unknown requirement type: ${reqType}`);
					return false;
			}
			//console.log(`[Achievements CheckReq] Type: ${reqType}, Current: ${currentValue}, Target: ${reqTarget}`);
			return currentValue >= reqTarget;
		} catch (e) {
			console.error("[Achievements CheckReq] Error evaluating requirement:", e, requirements, profileData);
			return false;
		}
	};

	/**
	 * Awards a specific badge to the user.
	 * @param {string} userId - The ID of the user.
	 * @param {number} badgeId - The ID of the badge to award.
	 * @param {string} badgeTitle - The title of the badge (for notification).
	 * @param {number} pointsAwarded - Points to award with the badge (default 0).
	 */
	VyukaApp.awardBadge = async (userId, badgeId, badgeTitle, pointsAwarded = 0) => {
		const supabase = VyukaApp.state.supabase;
		if (!supabase || !userId || !badgeId) {
			console.error("[AwardBadge] Missing Supabase client, userId, or badgeId.");
			return;
		}
		console.log(`[AwardBadge] Attempting to award badge ${badgeId} (${badgeTitle}) to user ${userId}...`);

		try {
			// 1. Check if badge already awarded (double-check to prevent race conditions)
			const { data: existing, error: checkError } = await supabase
				.from('user_badges')
				.select('badge_id')
				.eq('user_id', userId)
				.eq('badge_id', badgeId)
				.limit(1);
			if (checkError) throw checkError;
			if (existing && existing.length > 0) {
				console.log(`[AwardBadge] Badge ${badgeId} already awarded to user ${userId}. Skipping.`);
				return; // Already awarded
			}

			// 2. Insert into user_badges
			const { error: insertError } = await supabase
				.from('user_badges')
				.insert({ user_id: userId, badge_id: badgeId });
			if (insertError) throw insertError;
			console.log(`[AwardBadge] Badge ${badgeId} inserted for user ${userId}.`);

			// 3. Update profile (badges_count and points) using fetch-then-update (as RPC is not confirmed)
			// Fetch current profile data first
			const { data: currentProfileData, error: fetchProfileError } = await supabase
				.from('profiles')
				.select('badges_count, points')
				.eq('id', userId)
				.single();

			if (fetchProfileError) {
				console.error("[AwardBadge] Error fetching current profile stats for update:", fetchProfileError);
				// Continue to notification, but log the failure
			} else if (currentProfileData) {
				const currentBadgeCount = currentProfileData.badges_count ?? 0;
				const currentPoints = currentProfileData.points ?? 0;
				const updates = {
					badges_count: currentBadgeCount + 1,
					updated_at: new Date().toISOString()
				};
				if (pointsAwarded > 0) {
					updates.points = currentPoints + pointsAwarded;
				}

				const { error: updateProfileError } = await supabase
					.from('profiles')
					.update(updates)
					.eq('id', userId);

				if (updateProfileError) {
					console.error("[AwardBadge] Error updating profile stats:", updateProfileError);
				} else {
					console.log(`[AwardBadge] Profile stats updated for user ${userId}: badges_count=${updates.badges_count}` + (updates.points ? `, points=${updates.points}` : ''));
                    // Update local state if profile object is available globally
                     if (VyukaApp.state.currentProfile && VyukaApp.state.currentProfile.id === userId) {
                         VyukaApp.state.currentProfile.badges_count = updates.badges_count;
                         if (updates.points) {
                              VyukaApp.state.currentProfile.points = updates.points;
                         }
                         VyukaApp.updateUserInfoUI(); // Update sidebar immediately
                     }
				}
			}

			// 4. Create Notification
			const notificationTitle = `🏆 Nový Odznak!`;
			const notificationMessage = `Získali jste odznak: "${badgeTitle}"! ${pointsAwarded > 0 ? `(+${pointsAwarded} kreditů)` : ''}`;
			const { error: notifyError } = await supabase
				.from('user_notifications')
				.insert({
					user_id: userId,
					title: notificationTitle,
					message: notificationMessage,
					type: 'badge',
					link: '/dashboard/oceneni.html' // Link to achievements page
				});
			if (notifyError) console.error("[AwardBadge] Error creating notification:", notifyError);
			else console.log(`[AwardBadge] Notification created for badge ${badgeId}`);

			// 5. Show Toast
			VyukaApp.showToast(notificationTitle, notificationMessage, 'success', 6000);

		} catch (error) {
			console.error(`[AwardBadge] Error awarding badge ${badgeId} to user ${userId}:`, error);
			// Avoid showing error toast here not to interrupt user flow unnecessarily
		}
	};

	/**
	 * Checks all unearned badges for a user and awards them if criteria are met.
	 * Should be called after significant user actions (test completion, exercise set completion, etc.).
	 * @param {string} userId - The ID of the user to check achievements for.
	 */
	VyukaApp.checkAndAwardAchievements = async (userId) => {
		const supabase = VyukaApp.state.supabase;
		if (!supabase || !userId) {
			console.error("[Achievements Check] Missing Supabase client or userId.");
			return;
		}
		console.log(`[Achievements Check] Starting check for user ${userId}...`);

		try {
			// 1. Fetch current user profile data (needed for requirement checks)
            // Select all fields potentially used in requirements
			const { data: profileData, error: profileError } = await supabase
				.from('profiles')
				.select('points, level, streak_days, completed_exercises, completed_tests') // Add other fields if needed by badges
				.eq('id', userId)
				.single();
			if (profileError) throw profileError;
			if (!profileData) throw new Error(`Profile data not found for user ${userId} during achievement check.`);

			// 2. Fetch all badge definitions
			const { data: allBadgesData, error: badgesError } = await supabase
				.from('badges')
				.select('id, title, requirements, points') // Include points for awarding
				.order('id');
			if (badgesError) throw badgesError;
			if (!allBadgesData || allBadgesData.length === 0) {
				console.log("[Achievements Check] No badge definitions found.");
				return; // No badges to check
			}

			// 3. Fetch user's earned badges
			const { data: earnedBadgesData, error: earnedError } = await supabase
				.from('user_badges')
				.select('badge_id')
				.eq('user_id', userId);
			if (earnedError) throw earnedError;
			const earnedBadgeIds = new Set((earnedBadgesData || []).map(b => b.badge_id));

			// 4. Filter unearned badges
			const unearnedBadges = allBadgesData.filter(b => !earnedBadgeIds.has(b.id));
			console.log(`[Achievements Check] Found ${unearnedBadges.length} unearned badges to check.`);

			if (unearnedBadges.length === 0) {
				console.log("[Achievements Check] No new badges to check.");
				return;
			}

			// 5. Check requirements for each unearned badge
			for (const badge of unearnedBadges) {
				if (VyukaApp.checkRequirements(profileData, badge.requirements)) {
					console.log(`[Achievements Check] Criteria MET for badge ID: ${badge.id} (${badge.title})! Triggering award...`);
					// Award the badge (don't wait for it to finish, let it run in background)
					VyukaApp.awardBadge(userId, badge.id, badge.title, badge.points || 0);
				}
			}

			console.log(`[Achievements Check] Finished checking for user ${userId}.`);

		} catch (error) {
			console.error("[Achievements Check] Error during check/award process:", error);
			// Avoid showing toast for background checks
		}
	};

	// --- END: Achievement Logic ---

	// --- Feature Specific Event Listeners ---
	VyukaApp.setupFeatureListeners = () => { /* ... existing listeners ... */ const ui = VyukaApp.ui; const state = VyukaApp.state; console.log("[SETUP Features] Setting up feature event listeners..."); if (ui.chatInput) { ui.chatInput.addEventListener('input', VyukaApp.autoResizeTextarea); ui.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); VyukaApp.handleSendMessage(); } }); } if (ui.sendButton) ui.sendButton.addEventListener('click', VyukaApp.handleSendMessage); if (ui.clearChatBtn) ui.clearChatBtn.addEventListener('click', VyukaApp.confirmClearChat); if (ui.saveChatBtn) ui.saveChatBtn.addEventListener('click', VyukaApp.saveChatToPDF); if (ui.micBtn) ui.micBtn.addEventListener('click', VyukaApp.handleMicClick); if (ui.continueBtn) ui.continueBtn.addEventListener('click', VyukaApp.requestContinue); if (ui.clearBoardBtn) ui.clearBoardBtn.addEventListener('click', () => VyukaApp.clearWhiteboard(true)); if (ui.stopSpeechBtn) ui.stopSpeechBtn.addEventListener('click', VyukaApp.stopSpeech); if (ui.chatMessages) { ui.chatMessages.addEventListener('click', (event) => { const button = event.target.closest('.tts-listen-btn'); if (button) { const text = button.dataset.textToSpeak; if (text) { VyukaApp.speakText(text); } else { console.warn("No text found for TTS button in chat."); } } }); } if (ui.notificationBell) { ui.notificationBell.addEventListener('click', (event) => { event.stopPropagation(); ui.notificationsDropdown?.classList.toggle('active'); }); } if (ui.markAllReadBtn) { ui.markAllReadBtn.addEventListener('click', VyukaApp.markAllNotificationsRead); } if (ui.notificationsList) { ui.notificationsList.addEventListener('click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await VyukaApp.markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = ui.notificationCount?.textContent?.replace('+', '') || '0'; const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); ui.notificationCount.classList.toggle('visible', newCount > 0); if (ui.markAllReadBtn) ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }); } if (ui.closeCompletionModalBtn) ui.closeCompletionModalBtn.addEventListener('click', VyukaApp.handleDeclineCompletion); if (ui.completionSuggestionOverlay) ui.completionSuggestionOverlay.addEventListener('click', VyukaApp.handleOverlayClick); if (ui.confirmCompleteBtn) ui.confirmCompleteBtn.addEventListener('click', VyukaApp.handleConfirmCompletion); if (ui.declineCompleteBtn) ui.declineCompleteBtn.addEventListener('click', VyukaApp.handleDeclineCompletion); console.log("[SETUP Features] Feature event listeners setup complete."); };

})(window.VyukaApp); // Pass the namespace object to the IIFE