// dashboard/procvicovani/vyuka/vyukaApp.js
// Verze 3.9.6: Přidány importy a odstraněny odkazy na window.xxx

// Strict mode for better error handling
"use strict";

// --- Imports ---
// Importujeme все необходимые модули
import * as config from './config.js';
import { state } from './state.js';
import { ui } from './ui.js';
import * as utils from './utils.js';
import * as uiHelpers from './uiHelpers.js';
import * as supabaseService from './supabaseService.js';
import * as geminiService from './geminiService.js';
import * as speechService from './speechService.js';
import * as whiteboardController from './whiteboardController.js';
import * as chatController from './chatController.js';

// --- Constants ---
const VYUKA_APP_VERSION = "3.9.6"; // Version with imports

// --- Helper Functions (Логгирование) ---
const logInfo = (message, ...args) => console.log(`[INFO ${new Date().toLocaleTimeString()}] ${message}`, ...args);
const logDebug = (message, ...args) => console.log(`[DEBUG ${new Date().toLocaleTimeString()}] ${message}`, ...args); // Changed from console.debug
const logWarn = (message, ...args) => console.warn(`[WARN ${new Date().toLocaleTimeString()}] ${message}`, ...args);
const logError = (message, ...args) => console.error(`[ERROR ${new Date().toLocaleTimeString()}] ${message}`, ...args);

// --- Initialization Function ---
async function initializeApp() {
    logInfo(`🚀 [Init Vyuka v${VYUKA_APP_VERSION}] Starting App Initialization...`);

    try {
        // 1. Initialize Services (Supabase must be first for Auth)
        if (!supabaseService || !supabaseService.initialize()) {
            logError('[INIT] Supabase Service failed to initialize. Aborting.');
            // Použijeme uiHelpers pro zobrazení fatální chyby
            uiHelpers.showError("Nepodařilo se připojit k databázi. Aplikace nemůže pokračovat.", true);
            return; // Stop initialization
        }
        logDebug('[INIT] Supabase Initialized');

        // Initialize other services (check return values if they indicate success/failure)
        geminiService?.initialize();
        speechService?.setManageButtonStatesCallback(manageButtonStates); // Pass callback
        speechService?.initializeSpeechRecognition(); // Ensure STT init happens
        speechService?.loadVoices(); // Load TTS voices

        // 2. Check Authentication and Fetch Profile
        logDebug('[INIT] Checking auth session');
        uiHelpers.setLoadingState('user', true);

        // Session check is now handled by onAuthStateChange in supabaseService
        // We need to wait for the initial state to be potentially set
        await new Promise(resolve => setTimeout(resolve, 100)); // Short delay to allow auth state to potentially settle

        const currentUser = state.currentUser; // Get user from global state (set by auth listener)

        if (currentUser) {
            logInfo(`[INIT] User authenticated (ID: ${currentUser.id}). Fetching profile...`);
            const profile = await supabaseService.fetchUserProfile(currentUser.id);
            uiHelpers.setLoadingState('user', false);

            if (profile) {
                logInfo('[INIT] Profile fetched successfully.');
                state.currentProfile = profile; // Update global state
                updateUserInfoUI(); // Update UI with profile data
            } else {
                logError('[INIT] Failed to fetch profile for user:', currentUser.id);
                uiHelpers.showToast('Nepodařilo se načíst váš profil.', 'error');
                updateUserInfoUI(); // Update UI with default/guest state
            }
        } else {
            logWarn('[INIT] No active session found after check. Redirecting to login or showing public view.');
            uiHelpers.setLoadingState('user', false);
             // Redirect or show guest state
             // window.location.href = '/auth/index.html'; // Příklad
             uiHelpers.showToast('Prosím, přihlaste se pro pokračování.', 'info');
             updateUserInfoUI(); // Guest state
             // Disable features
             manageButtonStates(); // Update buttons for guest state
             return; // Stop if login required
        }

        // 3. Initialize Base UI (after knowing user state)
        logDebug('[INIT] Initializing base UI...');
        initializeUI(); // Setup theme, basic element states etc.

        // 4. Load Initial Data (Topic, Notifications etc.) - Only if authenticated
        if (state.currentUser) {
             logDebug('[INIT] Loading initial topic and notifications...');
             // Show combined loading indicator if needed
             // uiHelpers.setLoadingState('currentTopic', true);
             // uiHelpers.setLoadingState('notifications', true);

             const notificationsPromise = loadAndDisplayNotifications();
             const topicPromise = loadNextTopicFlow(); // Handles its own loading indicators

             await Promise.all([notificationsPromise, topicPromise]);

             // Loading indicators handled within the functions

        } else {
            logDebug("[INIT] Skipping initial data load (user not authenticated).");
            whiteboardController.clearWhiteboard();
            chatController.clearChat(); // Clear any potential leftover chat messages
            whiteboardController.appendToWhiteboard("<h1>Vítejte!</h1><p>Přihlaste se prosím pro zahájení výuky.</p>");
        }

        // 5. Final UI Polish
        utils.initTooltips(); // Initialize tooltips for all elements

    } catch (error) {
        logError('[INIT] Unexpected error during App Initialization:', error);
        uiHelpers.showError(`Došlo k závažné chybě při inicializaci: ${error.message}. Zkuste prosím obnovit stránku.`, true);
         uiHelpers.setLoadingState('all', false); // Reset all loaders on fatal error
    } finally {
        logDebug('[INIT] Finalizing initialization (finally block)...');
        uiHelpers.setLoadingState('all', false); // Ensure all loaders are off
        logInfo(`✅ [Init Vyuka v${VYUKA_APP_VERSION}] App Initialization Finished (finally block).`);
         // Hide initial page loader if used
         ui.initialLoader?.classList.add('hidden');
         setTimeout(() => { ui.initialLoader?.remove(); }, 500); // Remove after fade out
    }
}

// --- UI Initialization and Updates ---

function initializeUI() {
    logDebug('[UI Init] Initializing UI elements and handlers...');

    // Setup Theme toggle based on saved preference or system setting
    const savedTheme = localStorage.getItem('themeIsDark');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    state.isDarkMode = savedTheme !== null ? (savedTheme === 'true') : prefersDark;
    uiHelpers.updateTheme(); // Apply initial theme from state

    // Update static UI elements
    utils.updateCopyrightYear();

    // Setup Event Listeners
    setupEventListeners();

    // Set initial state for buttons etc.
    manageButtonStates();

    logInfo('[UI Init] UI Initialized successfully.');
}

function updateUserInfoUI() {
    const profile = state.currentProfile;
    const user = state.currentUser;
    const isAuthenticated = !!user; // Check if user object exists
    logDebug('[UI Update] Updating User Info Panel. Auth:', isAuthenticated);

    // Directly use ui object
    const nameElement = ui.sidebarName;
    const avatarElement = ui.sidebarAvatar;
    const logoutButton = ui.logoutButton; // Assuming you add this ID to your logout button

    if (isAuthenticated && profile && nameElement && avatarElement) {
        const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || user.email?.split('@')[0] || 'Pilot';
        nameElement.textContent = utils.sanitizeHTML(displayName);
        const initials = utils.getInitials(profile, user.email);
        avatarElement.innerHTML = profile.avatar_url ? `<img src="${profile.avatar_url}?t=${Date.now()}" alt="Avatar">` : initials; // Add cache busting
        if (logoutButton) logoutButton.style.display = 'inline-block'; // Show logout
    } else if (nameElement && avatarElement) {
        nameElement.textContent = 'Host';
        avatarElement.textContent = '?'; // Or initials '?'
        if (logoutButton) logoutButton.style.display = 'none'; // Hide logout
    }
    // Sidebar user info container visibility (assuming it exists)
    // const userInfoPanel = document.getElementById('user-info'); // Or use ui.userInfoPanel if defined
    // if (userInfoPanel) userInfoPanel.style.display = 'flex'; // Make sure panel is visible
}

function setupEventListeners() {
    logDebug('[SETUP] Setting up event listeners...');
    let listenerCount = 0;

    // Theme Toggle
    // Assume button exists with id="theme-toggle-button"
    const themeToggle = document.getElementById('theme-toggle-button');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            state.isDarkMode = !state.isDarkMode;
            uiHelpers.updateTheme();
            localStorage.setItem('themeIsDark', state.isDarkMode.toString());
            logDebug(`Theme toggled. Dark mode: ${state.isDarkMode}`);
        });
        listenerCount++;
    } else { logWarn("[SETUP] Theme toggle button not found."); }

    // Logout Button
    // Assuming button exists with id="logout-button" (added this ID in HTML)
    if (ui.logoutButton) {
        ui.logoutButton.addEventListener('click', async () => {
            logInfo('[ACTION] Logout button clicked.');
            const { error } = await supabaseService.signOut(); // Using imported service
            if (error) {
                logError('[Logout] Error signing out:', error);
                uiHelpers.showToast(`Chyba při odhlášení: ${error.message}`, 'error');
            } else {
                logInfo('[Logout] User signed out successfully.');
                state.currentUser = null; // Reset state
                state.currentProfile = null;
                updateUserInfoUI(); // Update UI to guest state
                window.location.href = '/auth/index.html'; // Redirect to login
            }
        });
        listenerCount++;
    } else { logWarn("[SETUP] Logout button (#logout-button) not found."); }

    // Chat Send Button & Enter Key
    if (ui.sendButton && ui.chatInput) {
        ui.sendButton.addEventListener('click', handleSendChatMessage);
        listenerCount++;
        ui.chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSendChatMessage();
            }
        });
        listenerCount++;
        // Auto-resize textarea on input
        ui.chatInput.addEventListener('input', () => utils.autoResizeTextarea(ui.chatInput));
        listenerCount++;

    } else { logWarn("[SETUP] Chat send button or input element not found."); }

    // Mic Button (Speech-to-Text)
    if (ui.micBtn) {
        ui.micBtn.addEventListener('click', speechService.handleMicClick); // Using handler from service
        listenerCount++;
    } else { logWarn("[SETUP] Mic button (#mic-btn) not found."); }

    // Stop TTS Button
    if (ui.stopSpeechBtn) {
        ui.stopSpeechBtn.addEventListener('click', speechService.stopSpeech);
        listenerCount++;
    } else { logWarn("[SETUP] Stop Speech button (#stop-speech-btn) not found."); }

    // Clear Whiteboard Button
    if (ui.clearBoardBtn) {
        ui.clearBoardBtn.addEventListener('click', () => {
            if (confirm("Opravdu chcete smazat obsah tabule?")) {
                 whiteboardController.clearWhiteboard(false); // false = don't show internal toast
                 uiHelpers.showToast("Tabule byla vymazána.", "info");
             }
        });
        listenerCount++;
    } else { logWarn("[SETUP] Clear Board button (#clear-board-btn) not found."); }

    // Continue/Complete Topic Button
    if (ui.continueBtn) {
        ui.continueBtn.addEventListener('click', handleCompleteTopic);
        listenerCount++;
    } else { logWarn("[SETUP] Continue button (#continue-btn) not found."); }

     // --- Event Delegation for Dynamic Content ---

     // Whiteboard TTS Buttons
     if (ui.whiteboardContent) {
         ui.whiteboardContent.addEventListener('click', (event) => {
             const ttsButton = event.target.closest('.tts-listen-btn');
             if (ttsButton && ttsButton.dataset.textToSpeak) {
                 const text = ttsButton.dataset.textToSpeak;
                 const chunkElement = ttsButton.closest('.whiteboard-chunk'); // Find parent chunk
                 logDebug(`[ACTION] Whiteboard TTS clicked. Text: ${text.substring(0, 50)}...`);
                 speechService.speakText(text, chunkElement); // Pass chunk element for potential highlighting
             }
         });
         listenerCount++;
     } else { logWarn("[SETUP] Whiteboard content element not found for delegation."); }

     // Chat TTS Buttons
     if (ui.chatMessages) {
         ui.chatMessages.addEventListener('click', (event) => {
             const ttsButton = event.target.closest('.tts-listen-btn');
             if (ttsButton && ttsButton.dataset.textToSpeak) {
                 const text = ttsButton.dataset.textToSpeak;
                 logDebug(`[ACTION] Chat TTS clicked. Text: ${text.substring(0, 50)}...`);
                 speechService.speakText(text); // No specific element to highlight in chat usually
             }
         });
         listenerCount++;
     } else { logWarn("[SETUP] Chat messages element not found for delegation."); }


    // --- Browser/Window Events ---
    window.addEventListener('online', utils.updateOnlineStatus);
    window.addEventListener('offline', utils.updateOnlineStatus);
    window.addEventListener('resize', utils.closeMenu); // Close mobile menu on resize if needed

    // Listener pro změnu preferencí schématu barev
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (localStorage.getItem('themeIsDark') === null) { // Only react if no manual toggle was used
            state.isDarkMode = event.matches;
            uiHelpers.updateTheme();
        }
    });
    listenerCount += 3; // For window listeners

    logInfo(`[SETUP] Event listeners setup complete. Total attached approx: ${listenerCount}`);
}

// --- Core Application Logic ---

/**
 * Updates the state of various buttons based on the application state.
 */
function manageButtonStates() {
    // Chat Send Button & Mic Button
    const canInteract = !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening;
    const inputHasText = ui.chatInput && ui.chatInput.value.trim().length > 0;

    if (ui.sendButton) {
        ui.sendButton.disabled = !canInteract || !inputHasText;
        // Change icon based on thinking state?
        ui.sendButton.innerHTML = state.geminiIsThinking
            ? '<i class="fas fa-spinner fa-spin"></i>'
            : '<i class="fas fa-paper-plane"></i>';
    }

    if (ui.micBtn) {
        ui.micBtn.disabled = state.geminiIsThinking || state.topicLoadInProgress || state.isSpeakingTTS; // Disable mic if system is busy or speaking
        ui.micBtn.classList.toggle('active-listening', state.isListening); // Add visual indicator if listening
        ui.micBtn.innerHTML = state.isListening ? '<i class="fas fa-stop-circle"></i>' : '<i class="fas fa-microphone"></i>';
        ui.micBtn.title = state.isListening ? 'Zastavit nahrávání' : (ui.micBtn.disabled ? 'Nahrávání nedostupné' : 'Hlasový vstup');
    }

    // Continue/Complete Topic Button
    if (ui.continueBtn) {
        // Enable when AI proposes completion AND is not currently thinking/loading
        ui.continueBtn.disabled = !state.aiProposedCompletion || state.geminiIsThinking || state.topicLoadInProgress;
        ui.continueBtn.style.display = state.currentTopic ? 'inline-flex' : 'none'; // Show only if a topic is loaded
    }

    // Stop TTS Button
    if (ui.stopSpeechBtn) {
        ui.stopSpeechBtn.style.display = state.isSpeakingTTS ? 'inline-flex' : 'none';
    }

     // Clear Board Button
     if (ui.clearBoardBtn) {
         ui.clearBoardBtn.disabled = state.geminiIsThinking || state.topicLoadInProgress; // Disable if AI is busy
     }

    // Chat Input (disable while thinking?)
    if(ui.chatInput) {
        ui.chatInput.disabled = state.geminiIsThinking || state.topicLoadInProgress;
        ui.chatInput.placeholder = state.geminiIsThinking
            ? "Čekejte na odpověď AI..."
            : (state.aiIsWaitingForAnswer ? "Odpovězte na otázku AI..." : "Vaše odpověď nebo otázka...");
    }
}


/**
 * Handles sending a user message from the chat input.
 */
async function handleSendChatMessage() {
    const messageText = ui.chatInput?.value.trim();
    logDebug(`[Chat] handleSendChatMessage called. Message: "${messageText}"`);

    if (!messageText) {
        logWarn('[Chat] Attempted to send empty message.');
        return;
    }

    if (state.geminiIsThinking || state.topicLoadInProgress) {
         logWarn('[Chat] User tried to send message while AI is busy.');
         uiHelpers.showToast("Počkejte prosím, AI stále zpracovává předchozí požadavek.", "warning");
         return;
    }

    // 1. Add user message to UI immediately
    chatController.addChatMessage(messageText, 'user', true); // Save user message to DB
    if (ui.chatInput) {
        ui.chatInput.value = ''; // Clear input field
        utils.autoResizeTextarea(ui.chatInput); // Resize after clearing
    }

    // 2. Set thinking state & update buttons
    state.geminiIsThinking = true;
    state.aiIsWaitingForAnswer = false; // User responded, AI is no longer waiting
    chatController.addThinkingIndicator();
    manageButtonStates(); // Update UI immediately

    // 3. Prepare history and send to AI
    const currentHistory = state.geminiChatContext || []; // Use state history
    const prompt = messageText;

    try {
        logDebug('[Chat] Sending message to Gemini...');
        const response = await geminiService.sendToGemini(prompt, currentHistory, true); // true for isChatInteraction
        logDebug('[Chat] Gemini response received:', response);

        // Remove thinking indicator regardless of success/failure
        const indicatorRemoved = chatController.removeThinkingIndicator();
         if (!indicatorRemoved) {
             logWarn("[Chat] Thinking indicator wasn't found/removed after API call.");
         }

        if (response && response.success && response.data) {
            const { boardContent, ttsText, chatText, codeBlock } = response.data;

            // Update chat history in appState *before* UI updates
            state.geminiChatContext.push({ role: 'user', parts: [{ text: prompt }] }); // Add user msg
            const aiResponseForHistory = chatText || boardContent || ttsText || codeBlock || "(AI poskytlo prázdnou odpověď)"; // Combine relevant parts for history
            state.geminiChatContext.push({ role: 'model', parts: [{ text: aiResponseForHistory }] });
            // Limit history size
             if (state.geminiChatContext.length > config.MAX_GEMINI_HISTORY_TURNS * 2) {
                 state.geminiChatContext = state.geminiChatContext.slice(-config.MAX_GEMINI_HISTORY_TURNS * 2);
                 logDebug("[Chat] Chat history pruned.");
             }

            // Render Board Content (if any)
            if (boardContent) {
                 logDebug('[Chat] Rendering board content received during chat.');
                 await renderBoardAndMath(boardContent); // Handles Markdown, Sanitize, MathJax
            }

            // Add AI Chat Message to UI (if any)
            if (chatText) {
                 chatController.addChatMessage(chatText, 'gemini', true, new Date(), ttsText || chatText); // Save and pass TTS text
                 // Simple check if AI response looks like a question
                 state.aiIsWaitingForAnswer = /\?$/.test(chatText.trim());
                 logDebug(`[State Change] aiIsWaitingForAnswer set to ${state.aiIsWaitingForAnswer} after chat response.`);
                 // Check for completion proposal (example keyword check)
                 if (/hotovo|dokončení|další téma|ukončit/i.test(chatText)) {
                     state.aiProposedCompletion = true;
                     logInfo("[State Change] AI proposed completion.");
                     // ManageButtonStates will handle enabling the continue button
                 } else {
                      state.aiProposedCompletion = false; // Reset if AI response isn't a completion proposal
                 }

            } else {
                 logDebug("[Chat] No explicit chat text received from AI for this interaction.");
                 state.aiIsWaitingForAnswer = false; // Assume AI isn't waiting if no chat text
                 state.aiProposedCompletion = false;
            }

             // Speak TTS (if enabled and text available) - use ttsText specifically
             const textToSpeak = ttsText || chatText; // Prefer specific TTS, fallback to chat
             if (textToSpeak && state.speechSynthesisSupported && state.isSpeakingAllowed) { // Use isSpeakingAllowed flag
                 await speechService.speakText(textToSpeak);
             }

        } else {
             logError('[Chat] Failed to get valid response from Gemini:', response ? response.error : 'No response');
             uiHelpers.showToast(`Chyba komunikace s AI: ${response?.error || 'Neznámá chyba.'}`, 'error');
             chatController.addChatMessage(`Nastala chyba: ${response?.error || 'Neznámá chyba.'}`, 'system');
             state.aiIsWaitingForAnswer = false; // Reset waiting state on error
             state.aiProposedCompletion = false;
        }

    } catch (error) {
        logError('[Chat] Error handling chat message:', error);
        uiHelpers.showToast('Neočekávaná chyba při odesílání zprávy.', 'error');
        chatController.addChatMessage('Došlo k neočekávané chybě.', 'system');
        chatController.removeThinkingIndicator(); // Ensure indicator removed on catch
        state.aiIsWaitingForAnswer = false; // Reset waiting state on error
        state.aiProposedCompletion = false;
    } finally {
        state.geminiIsThinking = false; // Ensure thinking state is reset
        manageButtonStates(); // Update UI after everything
        logDebug('[Chat] handleSendChatMessage finished (finally block).');
    }
}


/**
 * Renders content (Markdown/HTML) onto the whiteboard, handling MathJax.
 * Includes parsing Markdown and sanitizing HTML using utils.sanitizeHTML.
 * @param {string | null} boardContent Markdown/HTML content for the whiteboard.
 */
async function renderBoardAndMath(boardContent) {
    if (!boardContent || typeof boardContent !== 'string' || boardContent.trim() === '') {
        logWarn('[Render] renderBoardAndMath called with invalid or empty content.');
        return;
    }

    try {
        logDebug('[Render] Starting whiteboard rendering process...');
        // 1. Parse Markdown to HTML using 'marked' library
        let htmlContent = '';
        if (window.marked && typeof window.marked.parse === 'function') {
             htmlContent = window.marked.parse(boardContent);
        } else {
            logError('[Render] Marked library not found. Displaying raw content.');
            htmlContent = `<pre>${utils.sanitizeHTML(boardContent)}</pre>`; // Basic escape
        }

        // 2. Sanitize the generated HTML using utils.sanitizeHTML (DOMPurify wrapper)
        // This utils function should be configured to handle MathJax elements correctly.
        const sanitizedHtml = utils.sanitizeHTML(htmlContent);
         logDebug('[Render] Sanitized HTML length:', sanitizedHtml.length);
         if (htmlContent !== sanitizedHtml) {
             logDebug("[Render] Sanitization modified the HTML."); // Indicate if changes were made
         }

        // 3. Append the sanitized HTML to the whiteboard using the controller
        whiteboardController.appendToWhiteboard(sanitizedHtml); // Controller handles DOM insertion and MathJax queuing
        logDebug('[Render] Content passed to whiteboard controller for appending and MathJax processing.');

    } catch (error) {
        logError('[Render] Error processing or rendering board content:', error);
        whiteboardController.appendToWhiteboard(`<p class="error-message">Chyba při zobrazování obsahu na tabuli.</p><pre>${utils.sanitizeHTML(boardContent || '')}</pre>`);
    }
}


/**
 * Initiates the learning session for a given topic.
 * Fetches the initial explanation from AI and renders it.
 * @param {object} topic The topic object { activity_id, plan_id, name, description, user_id, topic_id }
 */
async function startLearningSession(topic) {
    if (!topic || !topic.activity_id || !topic.name) { // Check for necessary topic properties
        logError('[ACTION] startLearningSession called with invalid topic:', topic);
        uiHelpers.showToast("Nelze zahájit sezení: neplatné téma.", "error");
        // Display error on whiteboard
        whiteboardController.clearWhiteboard();
        whiteboardController.appendToWhiteboard("<p class='error-message'>Chyba: Informace o tématu jsou neúplné.</p>");
        return;
    }
    logInfo(`[ACTION] startLearningSession triggered for topic: ${topic.name} (Activity ID: ${topic.activity_id})`);

    state.geminiIsThinking = true; // Set thinking state
    state.aiIsWaitingForAnswer = false;
    state.aiProposedCompletion = false;
    state.currentTopic = topic; // Store current topic details
    state.geminiChatContext = []; // Clear history for new topic
    state.currentSessionId = utils.generateSessionId(); // Generate a new session ID
    logInfo(`[SESSION] New Session ID: ${state.currentSessionId}`);


    // Clear previous outputs
    whiteboardController.clearWhiteboard();
    chatController.clearChat();
    // uiHelpers.hideReplayButton(); // Hide replay button (handled by manageButtonStates now)

    // Update UI to show the current topic title
    if(ui.currentTopicDisplay) {
        ui.currentTopicDisplay.innerHTML = `Téma: <strong>${utils.sanitizeHTML(topic.name)}</strong>`;
    }
    manageButtonStates(); // Update button states (e.g., disable send/mic)

    try {
        logDebug(`[ACTION] startLearningSession: Calling sendToGemini (isChatInteraction=false)`);
        // Construct the initial prompt for Gemini
        const userLevel = state.currentProfile?.level || 'začátečník';
        const prompt = `Vysvětli ZÁKLADY tématu "${topic.name}" pro studenta úrovně ${userLevel}, který se připravuje na přijímací zkoušky na SŠ v ČR. Zaměř se na klíčové koncepty a uveď jeden jednoduchý příklad. Struktura ODPOVĚDI MUSÍ být: [BOARD_MARKDOWN] ... [TTS] ... [CHAT] ...`;

        const response = await geminiService.sendToGemini(prompt, [], false);
        logDebug('[ACTION] startLearningSession: Gemini response received:', response);

        // Remove thinking indicator AFTER getting response (if using one explicitly here)
        // chatController.removeThinkingIndicator();

        if (response && response.success && response.data) {
            const { boardContent, ttsText, chatText } = response.data;

            // Add AI response to history state
            const aiResponseForHistory = `${boardContent || ''}\n${ttsText || ''}\n${chatText || ''}`.trim();
            if (aiResponseForHistory) {
                state.geminiChatContext.push({ role: 'model', parts: [{ text: aiResponseForHistory }] });
            }

            // Render Board Content
            if (boardContent) {
                 await renderBoardAndMath(boardContent); // Handles Markdown, Sanitize, MathJax
            } else {
                 logWarning('[ACTION] No board content received from Gemini for initial explanation.');
                 whiteboardController.appendToWhiteboard("<p>AI neposkytla žádný obsah pro tabuli.</p>");
            }

            // Add initial AI Chat Message & update state
            if (chatText) {
                chatController.addChatMessage(chatText, 'gemini', true, new Date(), ttsText || chatText);
                state.aiIsWaitingForAnswer = /\?$/.test(chatText.trim());
            } else {
                 logDebug("[ACTION] No initial chat text received from AI.");
                 state.aiIsWaitingForAnswer = false;
                 // Optionally add a default message if both chat and tts are missing?
                 // if (!ttsText) chatController.addChatMessage('Můžeme začít.', 'gemini');
            }
            logDebug(`[STATE CHANGE] aiIsWaitingForAnswer set to ${state.aiIsWaitingForAnswer} (after initial explanation).`);

             // Speak TTS (if enabled and text available)
             const textToSpeak = ttsText || chatText;
             if (textToSpeak && state.speechSynthesisSupported && state.isSpeakingAllowed) { // Use flag
                 await speechService.speakText(textToSpeak);
             }

        } else {
            logError('[ACTION] Failed to get valid initial explanation from Gemini:', response ? response.error : 'No response');
            uiHelpers.showToast(`Chyba načítání vysvětlení: ${response?.error || 'Neznámá chyba.'}`, 'error');
            whiteboardController.appendToWhiteboard(`<p class="error-message">Nepodařilo se načíst vysvětlení od AI: ${utils.sanitizeHTML(response?.error || 'Neznámá chyba.')}</p>`);
            chatController.addChatMessage(`Nastala chyba při komunikaci s AI: ${utils.sanitizeHTML(response?.error || 'Neznámá chyba.')}`, 'system');
            state.aiIsWaitingForAnswer = false; // Reset waiting state on error
        }

    } catch (error) {
        logError('[ACTION] Error in startLearningSession execution:', error);
        uiHelpers.showToast('Neočekávaná chyba při zahájení sezení.', 'error');
        whiteboardController.appendToWhiteboard('<p class="error-message">Došlo k neočekávané chybě při přípravě výuky.</p>');
        chatController.addChatMessage('Došlo k neočekávané chybě.', 'system');
        state.aiIsWaitingForAnswer = false; // Ensure reset on error
    } finally {
        state.geminiIsThinking = false; // Reset thinking state
        manageButtonStates(); // Update UI after everything
        logDebug('[ACTION] startLearningSession finished (finally block).');
    }
}

/**
 * Flow to load the next uncompleted topic for the user.
 */
async function loadNextTopicFlow() {
    const userId = state.currentUser?.id;
    if (!userId) {
        logError("[Flow] Cannot load next topic: User ID is missing.");
        uiHelpers.showToast("Chyba: Uživatel není identifikován.", "error");
        whiteboardController.clearWhiteboard();
        whiteboardController.appendToWhiteboard("<p class='error-message'>Chyba při načítání tématu: Chybí ID uživatele.</p>");
        return;
    }

    logInfo(`[Flow] Loading next topic flow: STARTED.`);
    state.topicLoadInProgress = true;
    uiHelpers.setLoadingState('currentTopic', true);
    manageButtonStates(); // Disable buttons during load

    try {
        logDebug('[Flow] Calling loadNextUncompletedTopic...');
        const result = await supabaseService.loadNextUncompletedTopic(userId);
        logDebug('[Flow] loadNextUncompletedTopic result:', result);

        if (result.success && result.topic) {
            logInfo(`[Flow] Topic loaded: ${result.topic.name}. Starting session...`);
            // Reset state for the new topic BEFORE starting the session
             state.aiProposedCompletion = false;
             state.aiIsWaitingForAnswer = false;
             uiHelpers.setLoadingState('currentTopic', false); // Stop "loading topic" indicator
             await startLearningSession(result.topic); // Handles its own thinking indicator

        } else if (!result.success && result.reason === 'no_plan') {
             logInfo('[Flow] No active study plan found.');
             uiHelpers.showToast('Nebyl nalezen aktivní studijní plán.', 'info');
             whiteboardController.clearWhiteboard();
             whiteboardController.appendToWhiteboard("<h1>Žádný plán</h1><p>Nemáte aktivní studijní plán. Vytvořte si ho prosím v sekci 'Procvičování'.</p>");
             if(ui.currentTopicDisplay) ui.currentTopicDisplay.textContent = "Žádný aktivní plán";
             uiHelpers.setLoadingState('currentTopic', false);
             manageButtonStates(); // Update button states (likely disable continue/chat)

        } else if (!result.success && result.reason === 'plan_complete') {
            logInfo('[Flow] All topics in the current plan are completed.');
            uiHelpers.showToast('Gratulujeme! Dokončili jste všechny aktivity v plánu!', 'success');
            whiteboardController.clearWhiteboard();
            whiteboardController.appendToWhiteboard("<h1>Plán Dokončen!</h1><p>Výborně! Dokončili jste všechny naplánované aktivity.</p>");
             if(ui.currentTopicDisplay) ui.currentTopicDisplay.textContent = "Plán dokončen";
             uiHelpers.setLoadingState('currentTopic', false);
             manageButtonStates(); // Update button states

        } else { // Handle other load errors
            logError('[Flow] Error loading next topic:', result.message);
            uiHelpers.showToast(`Chyba při načítání tématu: ${result.message || 'Neznámá chyba'}`, 'error');
            whiteboardController.clearWhiteboard();
            whiteboardController.appendToWhiteboard(`<p class="error-message">Nepodařilo se načíst další téma: ${utils.sanitizeHTML(result.message || 'Neznámá chyba')}</p>`);
            if(ui.currentTopicDisplay) ui.currentTopicDisplay.textContent = "Chyba načítání";
            uiHelpers.setLoadingState('currentTopic', false);
            manageButtonStates(); // Update button states
        }
    } catch (error) {
        logError('[Flow] Unexpected error in loadNextTopicFlow:', error);
        uiHelpers.setLoadingState('currentTopic', false);
        uiHelpers.showToast('Neočekávaná chyba při načítání dalšího tématu.', 'error');
        whiteboardController.appendToWhiteboard('<p class="error-message">Došlo k neočekávané chybě při načítání tématu.</p>');
        manageButtonStates(); // Update button states
    } finally {
        state.topicLoadInProgress = false; // Ensure flag is reset
        logInfo(`[Flow] Loading next topic flow: FINISHED.`);
    }
}


/**
 * Handles the action when the user clicks the "Complete Topic" button.
 */
async function handleCompleteTopic() {
    const currentTopic = state.currentTopic;
    const userId = state.currentUser?.id;

    if (!currentTopic || !userId) {
        logWarn("[CompleteTopic] Cannot complete: No current topic or user.");
        uiHelpers.showToast("Chyba: Chybí informace o tématu nebo uživateli.", "error");
        return;
    }

    logInfo(`[ACTION] User initiated topic completion for: ${currentTopic.name} (Activity ID: ${currentTopic.activity_id})`);
    if (ui.continueBtn) { // Disable button immediately
        ui.continueBtn.disabled = true;
        ui.continueBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dokončuji...';
    }
    uiHelpers.setLoadingState('points', true); // Indicate points processing

    try {
        // 1. Mark the topic as complete in the database
        const markSuccess = await supabaseService.markTopicComplete(currentTopic.activity_id, userId);

        if (markSuccess) {
            logInfo(`[CompleteTopic] Activity ${currentTopic.activity_id} marked complete in DB.`);

            // 2. Award points for completion
            const pointsAwarded = config.POINTS_TOPIC_COMPLETE;
            const awardSuccess = await supabaseService.awardPoints(userId, pointsAwarded);

            if (awardSuccess) {
                logInfo(`[CompleteTopic] ${pointsAwarded} points awarded successfully.`);
                uiHelpers.showToast(`Téma "${currentTopic.name}" dokončeno!`, `Získáno ${pointsAwarded} bodů.`, 'success');
                // Update local profile points if needed (or rely on subsequent profile fetch)
                 if (state.currentProfile) { state.currentProfile.points = (state.currentProfile.points || 0) + pointsAwarded; updateUserInfoUI();}
            } else {
                logWarn(`[CompleteTopic] Topic marked complete, but points award failed.`);
                uiHelpers.showToast(`Téma "${currentTopic.name}" dokončeno!`, 'Chyba při přidělování bodů.', 'warning');
            }

            // 3. Clear current state and load the next topic
            state.currentTopic = null;
            state.aiProposedCompletion = false; // Reset flag
            if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám další...</span>';
            whiteboardController.clearWhiteboard();
            chatController.clearChat();
            await loadNextTopicFlow(); // Load the next one

        } else {
            logError(`[CompleteTopic] Failed to mark activity ${currentTopic.activity_id} as complete in DB.`);
            uiHelpers.showToast("Chyba při ukládání dokončení tématu.", "error");
            if (ui.continueBtn) { // Re-enable button on failure
                ui.continueBtn.disabled = false;
                ui.continueBtn.innerHTML = '<i class="fas fa-check-circle"></i> Dokončit Téma';
            }
        }
    } catch (error) {
        logError("[CompleteTopic] Unexpected error:", error);
        uiHelpers.showToast("Neočekávaná chyba při dokončování tématu.", "error");
        if (ui.continueBtn) { // Re-enable button on failure
            ui.continueBtn.disabled = false;
            ui.continueBtn.innerHTML = '<i class="fas fa-check-circle"></i> Dokončit Téma';
        }
    } finally {
         uiHelpers.setLoadingState('points', false); // Stop points loading indicator
         manageButtonStates(); // Ensure buttons reflect final state
         logInfo("[ACTION] handleCompleteTopic finished.");
    }
}



/**
 * Fetches and displays unread notifications.
 */
async function loadAndDisplayNotifications() {
    const userId = state.currentUser?.id;
    if (!userId) {
        logWarn("[Notifications] Cannot load notifications: User ID missing.");
        if(ui.notificationsList) ui.notificationsList.innerHTML = '<li>Nelze načíst (chybí uživatel).</li>';
        uiHelpers.updateNotificationBadge(0);
        return;
    }

    logDebug("[Notifications] Loading notifications...");
    uiHelpers.setLoadingState('notifications', true);

    try {
        // Use the service function
        const { unreadCount, notifications } = await supabaseService.fetchNotifications(userId, config.NOTIFICATION_FETCH_LIMIT);
        logDebug(`[Notifications] Fetched ${notifications.length} notifications. Total unread: ${unreadCount}`);
        displayNotifications(notifications, unreadCount); // Pass data to UI function
    } catch (error) {
         logError("[Notifications] Unexpected error fetching notifications via service:", error);
         uiHelpers.showToast("Neočekávaná chyba při načítání oznámení.", "error");
         displayNotifications([], 0, true); // Display error state
    } finally {
        uiHelpers.setLoadingState('notifications', false);
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
    // Use UI cache
    const listElement = ui.notificationsList;
    const noMsgElement = ui.noNotificationsMsg;
    const dropdownElement = ui.notificationsDropdown; // Assuming this is the container

    if (!listElement || !noMsgElement || !dropdownElement) {
        logWarn("[Notifications] Required notification UI elements not found.");
        return;
    }

    listElement.innerHTML = ''; // Clear previous

    if (isError) {
        listElement.innerHTML = '<li class="notification-item error-item">Chyba načítání.</li>';
        noMsgElement.style.display = 'none';
        listElement.style.display = 'block';
        uiHelpers.updateNotificationBadge(0, true); // Show error state
        return;
    }

    if (notifications && notifications.length > 0) {
        notifications.forEach(notif => {
             const visual = utils.activityVisuals[notif.type] || utils.activityVisuals.default; // Use utils map
             const isReadClass = notif.is_read ? 'is-read' : ''; // Should always be unread here, but check anyway
             const linkAttr = notif.link ? `data-link="${utils.sanitizeHTML(notif.link)}"` : '';

             const itemHTML = `
                 <div class="notification-item ${isReadClass}" data-id="${notif.id}" ${linkAttr}>
                     ${!notif.is_read ? '<span class="unread-dot"></span>' : ''}
                     <div class="notification-icon ${visual.class}">
                         <i class="fas ${visual.icon}"></i>
                     </div>
                     <div class="notification-content">
                         <div class="notification-title">${utils.sanitizeHTML(notif.title)}</div>
                         <div class="notification-message">${utils.sanitizeHTML(notif.message)}</div>
                         <div class="notification-time">${utils.formatRelativeTime(notif.created_at)}</div>
                     </div>
                 </div>`;
             listElement.insertAdjacentHTML('beforeend', itemHTML);
        });
        noMsgElement.style.display = 'none';
        listElement.style.display = 'block';
    } else {
        noMsgElement.style.display = 'block';
        listElement.style.display = 'none';
    }

    // Update badge and dropdown state
    uiHelpers.updateNotificationBadge(totalUnread);
    dropdownElement.classList.toggle('has-content', notifications && notifications.length > 0);
    if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = totalUnread === 0;
}


// --- Global Error Handling ---
window.addEventListener('error', (event) => {
    logError('[Global Error] Uncaught error:', event.message, event.error);
    // uiHelpers.showToast('Došlo k neočekávané globální chybě.', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    logError('[Global Rejection] Unhandled promise rejection:', event.reason);
    // uiHelpers.showToast('Došlo k neočekávané asynchronní chybě.', 'error');
});


// --- Application Start ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed. Starting Vyuka App...');
    initializeApp();
});

// POTŘEBA KONTROLY: Následující řádek způsobuje chybu "Invalid left-hand side in assignment"
// Pravděpodobně došlo k chybě při kopírování nebo úpravě.
// Tato řádka volá funkci, která je definována výše, což je samo o sobě v pořádku.
// Chyba musí být způsobena něčím *před* touto řádkou nebo chybějícím středníkem
// v předchozím výrazu, což mate parser. S přesunem na moduly a importy by se to
// mělo vyřešit, pokud byla chyba v dostupnosti proměnných/funkcí.
// Pokud chyba přetrvává i po úpravách na moduly, je třeba pečlivě zkontrolovat
// kód *před* touto řádkou v původním souboru, nebo kód uvnitř `initializeApp`.

// initializeApp(); // Původní volání zde - bude voláno z DOMContentLoaded