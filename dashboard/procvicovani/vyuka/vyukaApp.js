// dashboard/procvicovani/vyuka/vyukaApp.js

// Strict mode for better error handling
"use strict";

// --- Global App State and Configuration --- (Assuming these are loaded globally before this script)
// const config = window.appConfig;
// const appState = window.appState;
// const ui = window.uiElements;
// const utils = window.utils;
// const uiHelpers = window.uiHelpers;
// const supabaseService = window.supabaseService;
// const geminiService = window.geminiService;
// const speechService = window.speechService;
// const whiteboardController = window.whiteboardController;
// const chatController = window.chatController;

// --- Constants ---
const VYUKA_APP_VERSION = "3.9.5"; // Version with DOMPurify integration attempt


// --- Initialization Function ---
async function initializeApp() {
    logInfo(`🚀 [Init Vyuka v${VYUKA_APP_VERSION}] Starting App Initialization...`);

    try {
        // 1. Initialize Services (Supabase must be first for Auth)
        if (!supabaseService || !supabaseService.initialize()) {
            logError('[INIT] Supabase Service failed to initialize. Aborting.');
            uiHelpers.showFatalError("Nepodařilo se připojit k databázi. Aplikace nemůže pokračovat.");
            return; // Stop initialization
        }
        logDebug('[INIT] Supabase Initialized');

        // Initialize other services (check return values if they indicate success/failure)
        geminiService?.initialize(); // Assuming initialize exists and returns bool/void
        speechService?.initialize(uiHelpers.manageButtonStates); // Pass callback
        whiteboardController?.initialize();
        chatController?.initialize();
        utils?.initialize(); // Assuming utils might have init steps

        // 2. Check Authentication and Fetch Profile
        logDebug('[INIT] Checking auth session');
        uiHelpers.setLoading('user', true); // Show loading indicator for user profile
        const session = await supabaseService.checkSession(); // Check existing session

        if (session?.user) {
            logInfo(`[INIT] User authenticated (ID: ${session.user.id}). Fetching profile...`);
            appState.set('userId', session.user.id);
            const profileResult = await supabaseService.getUserProfile(session.user.id);
            uiHelpers.setLoading('user', false); // Hide loading indicator

            if (profileResult.success && profileResult.data) {
                logInfo('[INIT] Profile fetched successfully.');
                appState.updateUserProfile(profileResult.data); // Update global state
                updateUserInfoUI(); // Update UI with profile data
            } else {
                logError('[INIT] Failed to fetch profile:', profileResult.error);
                // Handle profile fetch error - maybe show guest view or error message
                uiHelpers.showToast('Nepodařilo se načíst váš profil.', 'error');
                updateUserInfoUI(); // Update UI with default/guest state
            }
        } else {
            logWarn('[INIT] No active session found. Redirecting to login or showing public view.');
            uiHelpers.setLoading('user', false);
            // Redirect to login page or show a limited view
            // window.location.href = '/login.html'; // Example redirect
             uiHelpers.showToast('Prosím, přihlaste se pro pokračování.', 'info');
             updateUserInfoUI(); // Update UI with guest state
             // Disable features requiring authentication
             uiHelpers.disableAuthenticatedFeatures();
             return; // Stop further initialization if login is required
        }


        // 3. Initialize Base UI (after knowing user state)
        logDebug('[INIT] Initializing base UI...');
        initializeUI(); // Setup theme, basic element states etc.

        // 4. Load Initial Data (Topic, Notifications etc.) - Only if authenticated
        if (appState.get('isAuthenticated')) {
             logDebug('[INIT] Loading initial topic and notifications...');
             uiHelpers.setLoading('currentTopic', true);
             uiHelpers.setLoading('notifications', true);

             // Fetch notifications and current topic concurrently
             const notificationsPromise = loadAndDisplayNotifications();
             const topicPromise = loadNextTopicFlow(); // This now handles the entire flow

             // Wait for both to complete
             await Promise.all([notificationsPromise, topicPromise]);

             uiHelpers.setLoading('currentTopic', false); // Loading indicator handled within loadNextTopicFlow
             uiHelpers.setLoading('notifications', false); // Already handled by loadAndDisplayNotifications

        } else {
            logDebug("[INIT] Skipping initial data load (user not authenticated).");
            // Optionally display a message on the whiteboard or chat
             whiteboardController.clearWhiteboard();
             whiteboardController.appendToWhiteboard("<h1>Vítejte!</h1><p>Přihlaste se prosím pro zahájení výuky.</p>");
        }


    } catch (error) {
        logError('[INIT] Unexpected error during App Initialization:', error);
        uiHelpers.showFatalError(`Došlo k závažné chybě při inicializaci: ${error.message}. Zkuste prosím obnovit stránku.`);
         // Fallback UI state
         uiHelpers.setLoading('user', false);
         uiHelpers.setLoading('currentTopic', false);
         uiHelpers.setLoading('notifications', false);
    } finally {
        logDebug('[INIT] Finalizing initialization (finally block)...');
        // Ensure all loading indicators are off, regardless of success/failure within try block
        uiHelpers.setLoading('user', false);
        uiHelpers.setLoading('currentTopic', false);
        uiHelpers.setLoading('notifications', false);
        // Any other final cleanup or setup
        logInfo(`✅ [Init Vyuka v${VYUKA_APP_VERSION}] App Initialization Finished (finally block).`);
    }
}

// --- UI Initialization and Updates ---

function initializeUI() {
    logDebug('[UI Init] Initializing UI elements and handlers...');

    // Cache UI elements if not already done by ui.js
    ui.cacheElements();

    // Setup Theme toggle based on saved preference or system setting
     const savedTheme = localStorage.getItem('themeIsDark');
     const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
     const initialDarkMode = savedTheme !== null ? (savedTheme === 'true') : prefersDark;
     appState.set('isDarkMode', initialDarkMode);
     uiHelpers.updateTheme(initialDarkMode); // Apply initial theme

    // Update static UI elements if needed (e.g., version number)
    // ui.appVersionElement.textContent = `v${VYUKA_APP_VERSION}`;

     // Setup Event Listeners
     setupEventListeners();

    // Initialize Chat and Whiteboard specific UI if needed
    chatController.initializeUI(); // e.g., display welcome message
    whiteboardController.initializeUI(); // e.g., clear board

    // Initialize Speech Service UI (button states)
    speechService.updateMicButtonState('idle'); // Initial state
    speechService.updateTTSButtonsState(appState.get('isTTSEnabled'), false); // Initial TTS state

    logInfo('[UI Init] UI Initialized successfully.');
}

function updateUserInfoUI() {
    const profile = appState.get('userProfile');
    const isAuthenticated = appState.get('isAuthenticated');
    logDebug('[UI Update] Updating User Info Panel. Auth:', isAuthenticated);

    if (isAuthenticated && profile) {
        // Safely access properties, providing defaults
        const displayName = profile.username || profile.email || 'Uživatel';
        const displayEmail = profile.email || 'Email není k dispozici';
        const avatarUrl = profile.avatar_url || 'assets/default-avatar.png'; // Provide a path to a default avatar

        // Use utils.sanitizeHTML for text content to prevent XSS if profile data could be malicious
        ui.userNameElement.textContent = utils.sanitizeHTML(displayName); // Use basic sanitize for text
        ui.userEmailElement.textContent = utils.sanitizeHTML(displayEmail);
        if (ui.userAvatarElement) {
            ui.userAvatarElement.src = avatarUrl; // URL is generally safe for src, but ensure it's from a trusted source (Supabase)
            ui.userAvatarElement.alt = `Avatar uživatele ${utils.sanitizeHTML(displayName)}`;
        }
        // Show elements relevant only to logged-in users
        ui.logoutButton?.style.display = ''; // Show logout button
        // Enable features
        uiHelpers.enableAuthenticatedFeatures();

    } else {
        // Guest or loading state
        ui.userNameElement.textContent = 'Host';
        ui.userEmailElement.textContent = 'Nepřihlášen';
         if (ui.userAvatarElement) {
             ui.userAvatarElement.src = 'assets/default-avatar.png'; // Default avatar
             ui.userAvatarElement.alt = 'Výchozí avatar hosta';
         }
         // Hide elements relevant only to logged-in users
         ui.logoutButton?.style.display = 'none'; // Hide logout button
         // Disable features requiring auth
         uiHelpers.disableAuthenticatedFeatures();
    }
     // Ensure the user info container itself is visible
     ui.userInfoContainer?.style.display = ''; // Or manage visibility as needed
}


function setupEventListeners() {
    logDebug('[SETUP] Setting up event listeners...');
    let listenerCount = 0;

    // Theme Toggle
    if (ui.themeToggleButton) {
        ui.themeToggleButton.addEventListener('click', () => {
            const newDarkModeState = !appState.get('isDarkMode');
            appState.set('isDarkMode', newDarkModeState);
            uiHelpers.updateTheme(newDarkModeState);
            localStorage.setItem('themeIsDark', newDarkModeState.toString());
            logDebug(`Theme toggled. Dark mode: ${newDarkModeState}`);
        });
        listenerCount++;
    } else { logWarning("[SETUP] Theme toggle button not found."); }

    // Logout Button
    if (ui.logoutButton) {
        ui.logoutButton.addEventListener('click', async () => {
            logInfo('[ACTION] Logout button clicked.');
            const { error } = await supabaseService.signOut();
            if (error) {
                logError('[Logout] Error signing out:', error);
                uiHelpers.showToast(`Chyba při odhlášení: ${error.message}`, 'error');
            } else {
                logInfo('[Logout] User signed out successfully.');
                appState.resetUserState(); // Clear user state
                updateUserInfoUI(); // Update UI to guest state
                // Optionally redirect to login or show logged-out content
                 // window.location.href = '/login.html';
                 whiteboardController.clearWhiteboard();
                 chatController.clearChat();
                 whiteboardController.appendToWhiteboard("<h1>Odhlášeno</h1><p>Byli jste úspěšně odhlášeni.</p>");
                 uiHelpers.disableAuthenticatedFeatures();
                 uiHelpers.showToast('Byli jste odhlášeni.', 'success');
            }
        });
        listenerCount++;
    } else { logWarning("[SETUP] Logout button not found."); }

    // Chat Send Button
    if (ui.sendChatButton && ui.chatInputElement) {
        ui.sendChatButton.addEventListener('click', handleSendChatMessage);
        listenerCount++;
        // Allow sending with Enter key in textarea
        ui.chatInputElement.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault(); // Prevent newline in textarea
                handleSendChatMessage();
            }
        });
        listenerCount++;
    } else { logWarning("[SETUP] Chat send button or input element not found."); }

    // Speech-to-Text Button
    if (ui.sttButton) {
        ui.sttButton.addEventListener('click', () => {
            logDebug('[ACTION] STT button clicked.');
            if (appState.get('isRecognizingSpeech')) {
                speechService.stopRecognition();
            } else {
                speechService.startRecognition(
                    (transcript) => { // onResult callback
                        ui.chatInputElement.value = transcript; // Fill textarea with result
                    },
                    (error) => { // onError callback
                        logError('[STT] Recognition error:', error);
                        uiHelpers.showToast(`Chyba rozpoznávání řeči: ${error}`, 'error');
                    },
                    () => { // onEnd callback
                        logDebug('[STT] Recognition ended.');
                        // State is handled internally by speechService via manageButtonStates
                    }
                );
            }
        });
        listenerCount++;
    } else { logWarning("[SETUP] STT button not found."); }


    // TTS Toggle Button
    if (ui.toggleTtsButton) {
        ui.toggleTtsButton.addEventListener('click', () => {
            const newState = !appState.get('isTTSEnabled');
            appState.set('isTTSEnabled', newState);
            speechService.updateTTSButtonsState(newState, speechService.isSpeaking()); // Update button appearance
             logDebug(`[ACTION] TTS Toggled. Enabled: ${newState}`);
             uiHelpers.showToast(`Hlasový výstup ${newState ? 'zapnut' : 'vypnut'}.`, 'info');
             if (!newState && speechService.isSpeaking()) {
                 speechService.stopTTS(); // Stop speaking if TTS is disabled
             }
        });
        listenerCount++;
    } else { logWarning("[SETUP] TTS toggle button not found."); }


    // Replay TTS Button
    if (ui.replayTtsButton) {
        ui.replayTtsButton.addEventListener('click', () => {
             const lastUtterance = appState.get('lastSpokenUtterance');
             logDebug(`[ACTION] Replay TTS button clicked. Last utterance exists: ${!!lastUtterance}`);
             if (lastUtterance) {
                 // Ensure TTS is enabled before replaying, or temporarily enable?
                 // For simplicity, let's just play if it exists, assuming user wants it.
                 if (!appState.get('isTTSEnabled')) {
                     logWarning("[TTS Replay] Replaying even though TTS is currently disabled.");
                 }
                 speechService.speakText(lastUtterance); // Replay the last text
             } else {
                 uiHelpers.showToast("Není co přehrát.", "info");
             }
        });
        listenerCount++;
    } else { logWarning("[SETUP] Replay TTS button not found."); }

    // Add more listeners as needed for other UI elements (sidebar links, modals, etc.)

    // Example: Listener for dynamically added elements (using event delegation)
    // ui.notificationsList?.addEventListener('click', (event) => {
    //     if (event.target && event.target.matches('li.notification-item')) {
    //         const notificationId = event.target.dataset.id;
    //         handleNotificationClick(notificationId);
    //     }
    // });
    // listenerCount++;


    logInfo(`[SETUP] Event listeners setup complete. Total attached approx: ${listenerCount}`);
}

// --- Core Application Logic ---

/**
 * Handles sending a user message from the chat input.
 */
async function handleSendChatMessage() {
    const messageText = ui.chatInputElement.value.trim();
    logDebug(`[Chat] handleSendChatMessage called. Message: "${messageText}"`);

    if (!messageText) {
        logWarning('[Chat] Attempted to send empty message.');
        return; // Don't send empty messages
    }

    if (appState.get('isThinking')) {
         logWarning('[Chat] User tried to send message while AI is thinking.');
         uiHelpers.showToast("Počkejte prosím, AI stále zpracovává předchozí požadavek.", "warning");
         return;
    }

    // 1. Add user message to UI immediately
    chatController.addChatMessage('user', messageText);
    ui.chatInputElement.value = ''; // Clear input field

    // 2. Set thinking state
    uiHelpers.setIsThinking(true);
    appState.set('isThinking', true);
    appState.set('aiIsWaitingForAnswer', false); // AI is no longer waiting once user sends

    // 3. Prepare history and send to AI
    const currentHistory = appState.get('chatHistory');
    const prompt = messageText; // The user's message is the new prompt

    try {
        logDebug('[Chat] Sending message to Gemini...');
        const response = await geminiService.sendToGemini(prompt, currentHistory, true); // true for isChatInteraction
        logDebug('[Chat] Gemini response received:', response);

        if (response && response.success && response.data) {
            const { boardContent, ttsText, chatText } = response.data;

            // Update chat history in appState *before* UI updates
            appState.addMessageToHistory('user', messageText); // Add user msg to state history
             if (chatText || ttsText) { // If AI provided any response text (chat or TTS)
                 const aiResponseText = chatText || ttsText; // Prefer chatText if available for history
                 appState.addMessageToHistory('model', aiResponseText);
             }


            // Render Board Content (if any) - Use the updated render function
            if (boardContent) {
                // Optional: Decide if chat messages should clear or append to the whiteboard
                // whiteboardController.clearWhiteboard(); // Option 1: Clear board for new explanation
                 logDebug('[Chat] Rendering board content received during chat.');
                 await renderBoardAndMath(boardContent); // Use the same rendering function
            }

             // Add AI Chat Message to UI (if any)
             if (chatText) {
                 chatController.addChatMessage('ai', chatText);
             } else {
                  logDebug("[Chat] No explicit chat text received from AI for this interaction.");
                  // Optionally add a generic "Okay" or similar if no chat text but TTS/Board was provided?
                  // chatController.addChatMessage('ai', 'Rozumím.');
             }


             // Speak TTS (if enabled and text available)
             if (ttsText && appState.get('isTTSEnabled')) {
                 await speechService.speakText(ttsText);
                 appState.set('lastSpokenUtterance', ttsText); // Save for replay
                 uiHelpers.showReplayButton(); // Show replay button after successful TTS
             } else if (!ttsText) {
                 appState.set('lastSpokenUtterance', null); // No TTS this time
                 uiHelpers.hideReplayButton();
             }

            // Update state based on AI response (e.g., did AI ask a question?)
            // This logic might need refinement based on how Gemini indicates it's waiting
            const aiIsNowWaiting = chatText ? chatText.includes('?') : false; // Simple check for now
            appState.set('aiIsWaitingForAnswer', aiIsNowWaiting);
            logDebug(`[STATE CHANGE] aiIsWaitingForAnswer set to ${aiIsNowWaiting} after chat response.`);


        } else {
             logError('[Chat] Failed to get valid response from Gemini:', response ? response.error : 'No response');
             uiHelpers.showToast(`Chyba komunikace s AI: ${response?.error || 'Neznámá chyba.'}`, 'error');
             chatController.addChatMessage('system', `Nastala chyba: ${response?.error || 'Neznámá chyba.'}`);
             // Add user message back to history state if API call failed?
             // Or maybe just leave it out to avoid inconsistency.
        }

    } catch (error) {
        logError('[Chat] Error handling chat message:', error);
        uiHelpers.showToast('Neočekávaná chyba při odesílání zprávy.', 'error');
        chatController.addChatMessage('system', 'Došlo k neočekávané chybě.');
    } finally {
        // Ensure thinking state is reset
        uiHelpers.setIsThinking(false);
        appState.set('isThinking', false);
        logDebug('[Chat] handleSendChatMessage finished (finally block).');
    }
}

/**
 * Renders content (Markdown/HTML) onto the whiteboard, handling MathJax.
 * Includes parsing Markdown and sanitizing HTML.
 * @param {string | null} boardContent Markdown/HTML content for the whiteboard.
 */
async function renderBoardAndMath(boardContent) {
    if (!boardContent || typeof boardContent !== 'string' || boardContent.trim() === '') {
        logWarning('[Render] renderBoardAndMath called with invalid or empty content.');
        // Optionally clear the board or display a message
        // whiteboardController.appendToWhiteboard("<p>Žádný obsah k zobrazení.</p>");
        return;
    }

    try {
        logDebug('[Render] Starting rendering process...');
        // 1. Parse Markdown to HTML using 'marked' library
        let htmlContent = '';
        if (window.marked && typeof window.marked.parse === 'function') {
             htmlContent = window.marked.parse(boardContent);
             // logDebug('[Render] Raw HTML from marked:', htmlContent.substring(0, 200) + '...');
        } else {
            logError('[Render] Marked library not found or parse function missing. Displaying raw content.');
            // Fallback: Display raw content safely escaped (using utils.sanitizeHTML for safety)
            htmlContent = `<pre>${utils.sanitizeHTML(boardContent)}</pre>`;
        }

        // 2. Sanitize the generated HTML using DOMPurify (RECOMMENDED)
        let sanitizedHtml = htmlContent; // Default to parsed HTML if DOMPurify fails
        if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
            try {
                // Basic configuration allowing standard HTML + MathJax elements if needed (adjust)
                 sanitizedHtml = window.DOMPurify.sanitize(htmlContent, {
                     USE_PROFILES: { html: true }, // Allow common HTML tags
                     // FOR_MATHML: true, // Uncomment if using MathML output from MathJax
                     // ADD_TAGS: ['mjx-container', 'math', 'mi', 'mo', 'mn', 'mrow', 'msup', 'msub', 'mfrac', 'msqrt', 'mtext'], // Add MathJax/MathML tags if needed
                     // ADD_ATTR: ['class', 'style', 'xmlns', 'display', 'mathvariant'] // Add common MathJax/MathML attributes
                 });
                 logDebug('[Render] Sanitized HTML length:', sanitizedHtml.length);
            } catch (sanitizeError) {
                 logError('[Render] DOMPurify sanitization failed:', sanitizeError);
                 // Fallback to original HTML (less safe) or display an error
                 // sanitizedHtml = htmlContent; // Less safe fallback
                 sanitizedHtml = `<p class="error-message">Chyba při bezpečnostním zpracování obsahu.</p><pre>${utils.sanitizeHTML(boardContent)}</pre>`;
            }

        } else {
            logWarning('[Render] DOMPurify library not loaded. Skipping HTML sanitization. THIS IS INSECURE!');
            // DO NOT RENDER unsanitized HTML directly if the source isn't 100% trusted.
            // Option 1: Display escaped original content
            // sanitizedHtml = `<pre>${utils.sanitizeHTML(boardContent)}</pre>`;
            // Option 2: Display the HTML but warn the user (still insecure)
             sanitizedHtml = `<div class="warning-message">Varování: Obsah není bezpečnostně ověřen.</div>${htmlContent}`;
             // Option 3: Refuse to render (safest if DOMPurify is expected)
             // sanitizedHtml = `<p class="error-message">Chyba: Bezpečnostní knihovna DOMPurify není načtena. Obsah nelze zobrazit.</p>`;
        }

        // 3. Append the sanitized HTML to the whiteboard
        // The whiteboardController should handle the actual DOM insertion and MathJax queuing.
        whiteboardController.appendToWhiteboard(sanitizedHtml);
        logDebug('[Render] Content appended to whiteboard controller.');

    } catch (error) {
        logError('[Render] Error processing or rendering board content:', error);
        // Display error message on the whiteboard
        whiteboardController.appendToWhiteboard(`<p class="error-message">Chyba při zobrazování obsahu na tabuli.</p><pre>${utils.sanitizeHTML(boardContent || '')}</pre>`);
    }
}


/**
 * Initiates the learning session for a given topic.
 * Fetches the initial explanation from AI and renders it.
 * @param {object} topic The topic object { id, title, subject_id, ... }
 */
async function startLearningSession(topic) {
    if (!topic || !topic.id || !topic.title) {
        logError('[ACTION] startLearningSession called with invalid topic:', topic);
        uiHelpers.showToast("Nelze zahájit sezení: neplatné téma.", "error");
        return;
    }
    logInfo(`[ACTION] startLearningSession triggered for topic: ${topic.title} (ID: ${topic.id})`);

    uiHelpers.setIsThinking(true);
    appState.set('isThinking', true);
    appState.set('aiIsWaitingForAnswer', false); // Reset waiting state
    appState.set('aiProposedCompletion', false); // Reset completion state
    appState.set('currentTopicId', topic.id); // Store current topic ID
    appState.clearChatHistory(); // Start fresh history for new topic

    // Clear previous outputs
    whiteboardController.clearWhiteboard();
    chatController.clearChat();
    uiHelpers.hideReplayButton(); // Hide replay button for new session

    // Update UI to show the current topic title
    ui.currentTopicTitleElement.textContent = utils.sanitizeHTML(topic.title); // Sanitize topic title

    try {
        logDebug(`[ACTION] startLearningSession: Calling sendToGemini (isChatInteraction=false)`);
        // Construct the initial prompt for Gemini
        const userLevel = appState.get('userProfile')?.level || 'začátečník'; // Get user level or default
        const prompt = `Vysvětli ZÁKLADY tématu "${topic.title}" na úrovni ${userLevel}. Vysvětlení musí být vhodné pro studenta připravujícího se na přijímací zkoušky na střední školu v České republice. Struktura odpovědi musí být: [BOARD_MARKDOWN] ... [TTS] ... [CHAT] ... Kde [BOARD_MARKDOWN] obsahuje vysvětlení ve formátu Markdown s MathJax vzorci (např. $ax+b=c$), [TTS] obsahuje text pro hlasový výstup (shrnutí nebo úvod) a [CHAT] obsahuje úvodní zprávu nebo otázku pro studenta (může být prázdné nebo 'None').`;

        const response = await geminiService.sendToGemini(prompt, [], false); // false for isChatInteraction
        logDebug('[ACTION] startLearningSession: Gemini response received:', response);

        if (response && response.success && response.data) {
            const { boardContent, ttsText, chatText } = response.data;

            // Add AI response to history (important for context in subsequent turns)
            // We might store the full response text, or just the relevant parts
            const aiResponseForHistory = `${boardContent || ''}\n${ttsText || ''}\n${chatText || ''}`.trim();
             if(aiResponseForHistory) {
                appState.addMessageToHistory('model', aiResponseForHistory);
             }

            // Render Board Content using the updated function
            if (boardContent) {
                 await renderBoardAndMath(boardContent); // Handles Markdown parsing, sanitizing, and MathJax
            } else {
                 logWarning('[ACTION] No board content received from Gemini for initial explanation.');
                 whiteboardController.appendToWhiteboard("<p>AI neposkytla žádný obsah pro tabuli.</p>");
            }

            // Add initial AI Chat Message to UI (if any)
            if (chatText) {
                chatController.addChatMessage('ai', chatText);
                appState.set('aiIsWaitingForAnswer', chatText.includes('?')); // Simple check if AI asks a question
            } else {
                 logDebug("[ACTION] No initial chat text received from AI.");
                 appState.set('aiIsWaitingForAnswer', false); // AI is not waiting if no chat message
                 // Optionally add a default message if both chat and tts are missing?
                 // if (!ttsText) chatController.addChatMessage('ai', 'Můžeme začít.');
            }

            // Speak TTS (if enabled and text available)
            if (ttsText && appState.get('isTTSEnabled')) {
                await speechService.speakText(ttsText);
                appState.set('lastSpokenUtterance', ttsText); // Save for replay
                 uiHelpers.showReplayButton();
            } else {
                 appState.set('lastSpokenUtterance', null); // Clear last utterance if none spoken
                 uiHelpers.hideReplayButton();
            }

            logDebug(`[STATE CHANGE] aiIsWaitingForAnswer set to ${appState.get('aiIsWaitingForAnswer')} (after initial explanation).`);

        } else {
            logError('[ACTION] Failed to get valid initial explanation from Gemini:', response ? response.error : 'No response');
            uiHelpers.showToast(`Chyba načítání vysvětlení: ${response?.error || 'Neznámá chyba.'}`, 'error');
            whiteboardController.appendToWhiteboard(`<p class="error-message">Nepodařilo se načíst vysvětlení od AI: ${utils.sanitizeHTML(response?.error || 'Neznámá chyba.')}</p>`);
            chatController.addChatMessage('system', `Nastala chyba při komunikaci s AI: ${utils.sanitizeHTML(response?.error || 'Neznámá chyba.')}`);
        }

    } catch (error) {
        logError('[ACTION] Error in startLearningSession execution:', error);
        uiHelpers.showToast('Neočekávaná chyba při zahájení sezení.', 'error');
        whiteboardController.appendToWhiteboard('<p class="error-message">Došlo k neočekávané chybě při přípravě výuky.</p>');
        chatController.addChatMessage('system', 'Došlo k neočekávané chybě.');
        // Ensure UI reflects that we are not waiting for AI even if error occurred mid-process
        appState.set('aiIsWaitingForAnswer', false);
    } finally {
        logDebug('[ACTION] startLearningSession: Entering finally block.');
        // Reset thinking state ONLY after all async operations (render, TTS) should have reasonably completed
        uiHelpers.setIsThinking(false);
        appState.set('isThinking', false);
        logDebug('[ACTION] startLearningSession: Setting isThinking=false in finally.');
        logDebug('[ACTION] startLearningSession: Exiting finally block.');
    }
}


/**
 * Flow to load the next uncompleted topic for the user.
 * Handles fetching the topic and initiating the learning session.
 */
async function loadNextTopicFlow() {
    const userId = appState.get('userId');
    if (!userId) {
        logError("[Flow] Cannot load next topic: User ID is missing.");
        uiHelpers.showToast("Chyba: Uživatel není identifikován.", "error");
        // Display error on whiteboard?
         whiteboardController.clearWhiteboard();
         whiteboardController.appendToWhiteboard("<p class='error-message'>Chyba při načítání tématu: Chybí ID uživatele.</p>");
        return; // Cannot proceed
    }

    logInfo(`[Flow] Loading next topic flow: STARTED. Setting topicLoadInProgress=true`);
    appState.set('topicLoadInProgress', true); // Prevent concurrent loads

    // Reset states that might be leftover from previous topic/error
    appState.set('aiIsWaitingForAnswer', false);
    appState.set('aiProposedCompletion', false);
    appState.set('isThinking', false); // Ensure thinking is false before starting load
    uiHelpers.setIsThinking(false);

    try {
        uiHelpers.setLoading('currentTopic', true); // Show loading indicator for topic section
        logDebug('[Flow] Calling loadNextUncompletedTopic...');
        const result = await supabaseService.loadNextUncompletedTopic(userId);
        logDebug('[Flow] loadNextUncompletedTopic result:', result);

        if (result.success && result.topic) {
            logInfo(`[Flow] Topic loaded successfully: ${result.topic.title}. Resetting topicLoadInProgress=false. Starting learning session...`);
            appState.set('currentTopic', result.topic); // Store the loaded topic
            appState.set('topicLoadInProgress', false);
            uiHelpers.setLoading('currentTopic', false); // Hide loading indicator *before* starting session

            // --- Initiate the learning session with the loaded topic ---
            await startLearningSession(result.topic); // Make sure startLearningSession handles its own errors gracefully

        } else if (result.success && !result.topic) {
            // No more topics available
            logInfo('[Flow] No more uncompleted topics found for the user.');
            appState.set('currentTopic', null);
            appState.set('topicLoadInProgress', false);
            uiHelpers.setLoading('currentTopic', false);
            uiHelpers.showToast('Gratulujeme! Dokončili jste všechna dostupná témata.', 'success');
            // Update UI to show completion state
            ui.currentTopicTitleElement.textContent = 'Všechna témata dokončena';
            whiteboardController.clearWhiteboard();
            chatController.clearChat();
            whiteboardController.appendToWhiteboard('<h1>Výborně!</h1><p>Dokončili jste všechna dostupná témata v tomto kurzu.</p>');
            // Optionally, disable chat input, etc.
            uiHelpers.disableInteraction();

        } else {
            // Error loading topic
            logError('[Flow] Error loading next topic:', result.error);
            appState.set('currentTopic', null);
            appState.set('topicLoadInProgress', false);
            uiHelpers.setLoading('currentTopic', false);
            uiHelpers.showToast(`Chyba při načítání tématu: ${result.error || 'Neznámá chyba'}`, 'error');
            // Update UI to show error state
            ui.currentTopicTitleElement.textContent = 'Chyba načítání';
            whiteboardController.clearWhiteboard();
            chatController.clearChat();
            whiteboardController.appendToWhiteboard(`<p class="error-message">Nepodařilo se načíst další téma: ${utils.sanitizeHTML(result.error || 'Neznámá chyba')}</p>`);
        }
    } catch (error) {
        logError('[Flow] Unexpected error in loadNextTopicFlow:', error);
        appState.set('topicLoadInProgress', false);
        uiHelpers.setLoading('currentTopic', false);
        uiHelpers.showToast('Neočekávaná chyba při načítání dalšího tématu.', 'error');
        whiteboardController.appendToWhiteboard('<p class="error-message">Došlo k neočekávané chybě při načítání tématu.</p>');
    } finally {
         logInfo(`[Flow] Loading next topic flow: FINISHED (finally block). topicLoadInProgress=${appState.get('topicLoadInProgress')}`);
         // Ensure loading indicator is always turned off in finally, just in case
         uiHelpers.setLoading('currentTopic', false);
         // Reset thinking state again, as startLearningSession might have its own try/finally
         uiHelpers.setIsThinking(false);
         appState.set('isThinking', false);
    }
}


/**
 * Fetches and displays unread notifications.
 */
async function loadAndDisplayNotifications() {
    const userId = appState.get('userId');
    if (!userId) {
        logWarn("[Notifications] Cannot load notifications: User ID missing.");
        return;
    }

    logDebug("[Notifications] Loading notifications...");
    uiHelpers.setLoading('notifications', true);

    try {
        const result = await supabaseService.getUnreadNotifications(userId, 5); // Limit to 5 recent

        if (result.success) {
             logDebug(`[Notifications] Fetched ${result.data.length} notifications. Total unread (from result): ${result.totalUnread}`);
             appState.set('notifications', result.data);
             appState.set('unreadNotificationCount', result.totalUnread); // Store count if provided by service
             displayNotifications(result.data, result.totalUnread);
        } else {
             logError("[Notifications] Failed to fetch notifications:", result.error);
             uiHelpers.showToast("Chyba při načítání oznámení.", "error");
             displayNotifications([], 0, true); // Display error state
        }
    } catch (error) {
         logError("[Notifications] Unexpected error fetching notifications:", error);
         uiHelpers.showToast("Neočekávaná chyba při načítání oznámení.", "error");
         displayNotifications([], 0, true); // Display error state
    } finally {
        uiHelpers.setLoading('notifications', false);
        logDebug("[Notifications] Notification loading finished.");
    }
}

/**
 * Updates the UI to display notifications.
 * @param {Array} notifications Array of notification objects.
 * @param {number} totalUnread Total count of unread notifications.
 * @param {boolean} [isError=false] Indicates if there was an error loading.
 */
function displayNotifications(notifications, totalUnread, isError = false) {
    const listElement = ui.notificationsList;
    if (!listElement) {
        logWarning("[Notifications] Notification list element not found in UI cache.");
        return;
    }

    listElement.innerHTML = ''; // Clear previous notifications

    if (isError) {
        const li = document.createElement('li');
        li.textContent = 'Chyba načítání oznámení.';
        li.classList.add('error-message');
        listElement.appendChild(li);
        // Update badge or indicator for error?
        uiHelpers.updateNotificationBadge(0, true); // Show error state in badge
        return;
    }

    if (notifications && notifications.length > 0) {
        notifications.forEach(notif => {
            const li = document.createElement('li');
            li.classList.add('notification-item');
            li.dataset.id = notif.id; // Store ID for potential click handling
            // Sanitize content before displaying
            li.textContent = utils.sanitizeHTML(notif.message || 'Bez obsahu'); // Example: Display message
            // Optionally add timestamp or icon
            // const time = document.createElement('span');
            // time.classList.add('timestamp');
            // time.textContent = new Date(notif.created_at).toLocaleTimeString();
            // li.appendChild(time);
            listElement.appendChild(li);
        });
         // Add a "show all" link if totalUnread > displayed count?
         if (totalUnread > notifications.length) {
             const showAllLi = document.createElement('li');
             const showAllLink = document.createElement('a');
             showAllLink.href = "#"; // Or link to notifications page
             showAllLink.textContent = `Zobrazit všech ${totalUnread} oznámení...`;
             showAllLink.addEventListener('click', (e) => {
                 e.preventDefault();
                 // handleShowAllNotifications(); // Function to navigate or load all
                 logInfo("Show all notifications clicked (handler not implemented).");
                 uiHelpers.showToast("Funkce 'Zobrazit vše' zatím není implementována.", "info");
             });
             showAllLi.appendChild(showAllLink);
             listElement.appendChild(showAllLi);
         }

    } else {
        const li = document.createElement('li');
        li.textContent = 'Žádná nová oznámení.';
        listElement.appendChild(li);
    }

    // Update notification badge/indicator
    uiHelpers.updateNotificationBadge(totalUnread);
}


// --- Global Error Handling ---
window.addEventListener('error', (event) => {
    logError('[Global Error] Uncaught error:', event.message, event.error);
    // Avoid showing generic toast for handled Supabase/Gemini errors if possible
    // uiHelpers.showToast('Došlo k neočekávané globální chybě.', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    logError('[Global Rejection] Unhandled promise rejection:', event.reason);
    // uiHelpers.showToast('Došlo k neočekávané asynchronní chybě.', 'error');
});


// --- Application Start ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed. Starting Vyuka App...');
    initializeApp(); // Start the application initialization process
});