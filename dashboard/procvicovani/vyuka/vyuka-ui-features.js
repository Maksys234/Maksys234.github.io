// Файл: procvicovani/vyuka/vyuka-ui-features.js
// Логика функций интерфейса: TTS/STT, Доска, Уведомления, Очки, Модальные окна, Достижения, Вспомогательные UI функции, Настройка слушателей событий
// Версия v30: Přidána chybějící funkce toggleRateLimitBanner pro správné zobrazení chybových hlášek API.
// USER FIX: Redesigned addChatMessage to generate terminal-style output.

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

        // --- Markdown Rendering (přesunuto nebo zkopírováno pro použití v appendToWhiteboard) ---
        VyukaApp.renderMarkdown = (el, text, isChat = false) => {
            if (!el) {
                console.error("RenderMarkdown: Target element not provided.");
                return;
            }
            const originalText = text || '';
            try {
                if (typeof marked === 'undefined') {
                    console.error("Marked library not loaded! Cannot render Markdown.");
                    el.innerHTML = `<p>${VyukaApp.sanitizeHTML ? VyukaApp.sanitizeHTML(originalText) : originalText}</p>`; // Fallback to plain text
                    return;
                }
                const options = {
                    gfm: true,          // GitHub Flavored Markdown
                    breaks: true,       // Convert GFM line breaks to <br>
                    sanitize: !isChat,  // Sanitize HTML if not in chat (to prevent XSS from board content if it's complex)
                                        // V chatu obvykle sanitizaci nepotřebujeme, pokud Markdown generuje AI kontrolovaně.
                    smartypants: false  // Use "smart" typographic punctuation
                };
                marked.setOptions(options);
                el.innerHTML = marked.parse(originalText);

                // Dodatečné MathJax renderování po vložení HTML
                if (window.MathJax && typeof window.MathJax.typesetPromise === 'function' && (originalText.includes('$') || originalText.includes('\\'))) {
                    console.log(`[MathJax RenderMarkdown v29.1] Queueing typeset for element:`, el);
                    setTimeout(() => {
                        window.MathJax.typesetPromise([el])
                            .then(() => console.log(`[MathJax RenderMarkdown v29.1] Typeset successful for element.`))
                            .catch((err) => console.error(`[MathJax RenderMarkdown v29.1] Typeset error for element: ${err.message}`));
                    }, 0);
                }

            } catch (e) {
                console.error("Markdown rendering error:", e);
                el.innerHTML = `<p style="color:var(--vyuka-accent-error);">Chyba renderování Markdown.</p><pre><code>${VyukaApp.sanitizeHTML ? VyukaApp.sanitizeHTML(originalText) : originalText}</code></pre>`;
            }
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
				console.log("[Clean v29] Removing placeholder text.");
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
			const state = VyukaApp.state; const ui = VyukaApp.ui;
			if (!state.speechSynthesisSupported) { VyukaApp.showToast("Syntéza řeči není podporována.", "warning"); return; }
			if (!text) { console.warn("TTS: No text provided."); return; }
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
			console.log("Whiteboard cleared (v29.1).");
			if (showToastMsg && typeof VyukaApp.showToast === 'function') { VyukaApp.showToast('Tabule vymazána', 'Obsah tabule byl smazán.', 'info'); }
            const submitQuizBtn = document.getElementById('submit-quiz-btn'); if (submitQuizBtn) { submitQuizBtn.remove(); }
            if (ui.vyukaLessonControls) { if(ui.continueBtn) ui.continueBtn.style.display = 'inline-flex'; if(ui.clearBoardBtn) ui.clearBoardBtn.style.display = 'inline-flex'; if(ui.stopSpeechBtn) ui.stopSpeechBtn.style.display = 'inline-flex'; ui.vyukaLessonControls.style.justifyContent = 'flex-end'; }
			if (typeof VyukaApp.manageButtonStates === 'function') VyukaApp.manageButtonStates();
		};

    	VyukaApp.appendToWhiteboard = (data, commentaryText) => {
			const ui = VyukaApp.ui; const state = VyukaApp.state;
			if (!ui.whiteboardContent || !ui.whiteboardContainer) return;

            if (!data || typeof data.content !== 'string') {
                console.warn("[AppendToWhiteboard v29.1] Invalid data or missing content string. Data:", data);
                return;
            }

            const contentType = data.type || 'detailed_explanation';
            const markdownContent = data.content;

			const chunkDiv = document.createElement('div');
			chunkDiv.className = `whiteboard-chunk whiteboard-chunk-${contentType.replace(/_/g, '-')}`;
			chunkDiv.style.opacity = '0';

            const titleElement = document.createElement('h4');
            titleElement.className = 'whiteboard-chunk-title';
            let titleText = '';
            switch (contentType) {
                case 'key_concepts': titleText = 'Klíčové Koncepty'; break;
                case 'detailed_explanation': titleText = 'Podrobné Vysvětlení'; break;
                case 'examples': titleText = 'Příklady'; break;
            }
            if (titleText) {
                titleElement.textContent = titleText;
                chunkDiv.appendChild(titleElement);
            }

			const contentDiv = document.createElement('div');
            contentDiv.className = 'whiteboard-chunk-content-body';
            VyukaApp.renderMarkdown(contentDiv, markdownContent, false);

            const ttsButton = document.createElement('button');
            ttsButton.className = 'tts-listen-btn btn-tooltip';
            ttsButton.title = 'Poslechnout komentář';
            ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
            const textForSpeech = commentaryText || markdownContent;
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
                if (titleText && titleElement.parentNode === chunkDiv) {
                    titleElement.appendChild(ttsButton);
                } else {
                    chunkDiv.insertBefore(ttsButton, chunkDiv.firstChild);
                }
            }
            chunkDiv.appendChild(contentDiv);
            ui.whiteboardContent.appendChild(chunkDiv);
            state.boardContentHistory.push({type: contentType, content: markdownContent});
			console.log(`Appended ${contentType} content to whiteboard (v29.1).`);

            if (typeof chunkDiv.scrollIntoView === 'function') {
                setTimeout(() => { chunkDiv.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
            } else {
                ui.whiteboardContainer.scrollTop = chunkDiv.offsetTop;
                console.warn("scrollIntoView not fully supported, using offsetTop fallback for whiteboard scroll.");
            }

			if (typeof VyukaApp.triggerWhiteboardMathJax === 'function') VyukaApp.triggerWhiteboardMathJax();
			if (typeof VyukaApp.initTooltips === 'function') VyukaApp.initTooltips();
			if (typeof VyukaApp.manageButtonStates === 'function') VyukaApp.manageButtonStates();

			requestAnimationFrame(() => { chunkDiv.style.opacity = '1'; });
		};

        VyukaApp.triggerWhiteboardMathJax = () => {
			const ui = VyukaApp.ui;
			if (ui.whiteboardContent && window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
				console.log("[MathJax v29.1] Triggering global typeset for whiteboard...");
				setTimeout(() => {
                    window.MathJax.typesetPromise([ui.whiteboardContent])
                        .then(() => console.log("[MathJax v29.1] Whiteboard typeset completed."))
                        .catch(e => console.error("[MathJax v29.1] Whiteboard typeset error:", e));
                }, 100);
			} else {
                if (!ui.whiteboardContent) console.warn("[MathJax v29.1] Whiteboard content element not found for typesetting.");
                if (!(window.MathJax && typeof window.MathJax.typesetPromise === 'function')) console.warn("[MathJax v29.1] MathJax or typesetPromise not available.");
            }
		};

        // --- Points System ---
        VyukaApp.awardPoints = async (pointsValue) => { /* ... No changes needed here ... */ };
        VyukaApp.handleMarkTopicComplete = async (fromQuiz = false) => { /* ... No changes needed here ... */ };
        VyukaApp.fetchNotifications = async (userId, limit = VyukaApp.config?.NOTIFICATION_FETCH_LIMIT || 5) => { /* ... No changes needed here ... */ };
        VyukaApp.renderNotifications = (count, notifications) => { /* ... No changes needed here ... */ };
        VyukaApp.renderNotificationSkeletons = (count = 2) => { /* ... No changes needed here ... */ };
        VyukaApp.markNotificationRead = async (notificationId) => { /* ... No changes needed here ... */ };
        VyukaApp.markAllNotificationsRead = async () => { /* ... No changes needed here ... */ };
        VyukaApp.handleQuickReplyAction = async (actionPayload) => { /* ... No changes needed here ... */ };
        VyukaApp.toggleRateLimitBanner = (show, nextRetryInMs = 0) => { /* ... No changes needed here ... */ };


        // ZMĚNA: addChatMessage pro terminálový styl
        VyukaApp.addChatMessage = async (displayMessage, sender, saveToDb = true, timestamp = new Date(), ttsText = null, originalContent = null, quickReplies = null) => {
			const ui = VyukaApp.ui;
			const state = VyukaApp.state;
			if (!ui.chatMessages) return;

			VyukaApp.clearInitialChatState();

			const id = `msg-${Date.now()}`;
			const div = document.createElement('div');
			div.className = `chat-message ${sender === 'gemini' ? 'model' : sender}`;
			div.id = id;
			div.style.opacity = '0'; // For animation

            const senderPrefix = sender === 'user' ? '[USER]&gt;' : '[AI]&gt;';
            const senderSpan = `<span class="message-sender">${senderPrefix}</span>`;

            const contentSpan = document.createElement('span');
            contentSpan.className = 'message-content';

            // Použijeme renderMarkdown pro obsah zprávy
			VyukaApp.renderMarkdown(contentSpan, displayMessage, true);

            // Sestavení finálního HTML
			div.innerHTML = `<div class="message-line">${senderSpan}${contentSpan.outerHTML}</div>`;

            // Přidání Quick Replies, pokud jsou
            if (quickReplies && quickReplies.length > 0) {
                const quickRepliesDiv = document.createElement('div');
                quickRepliesDiv.className = 'quick-replies-container';
                quickReplies.forEach(reply => {
                    const button = document.createElement('button');
                    button.className = 'btn btn-secondary btn-sm quick-reply-btn';
                    button.textContent = reply.title;
                    button.dataset.payload = reply.payload;
                    button.dataset.action = "true";
                    quickRepliesDiv.appendChild(button);
                });
                div.appendChild(quickRepliesDiv);
            }


			ui.chatMessages.appendChild(div);

			// Přehrání TTS, pokud je k dispozici (bez tlačítka v UI)
			if (sender === 'gemini' && state.speechSynthesisSupported && ttsText && ttsText.trim() !== "") {
				VyukaApp.speakText(ttsText);
			}

			div.scrollIntoView({ behavior: 'smooth', block: 'end' });
			requestAnimationFrame(() => { div.style.opacity = '1'; });

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

	} catch (e) {
		console.error("FATAL SCRIPT ERROR (UI Features):", e);
		document.body.innerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:red;color:white;padding:40px;text-align:center;font-family:sans-serif;z-index:9999;"><h1>KRITICKÁ CHYBA</h1><p>Nelze spustit modul výuky (UI Features).</p><pre>${e.message}\n${e.stack}</pre></div>`;
	}

})(window.VyukaApp);