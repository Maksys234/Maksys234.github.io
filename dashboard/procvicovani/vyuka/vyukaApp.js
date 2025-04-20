// dashboard/procvicovani/vyuka/vyukaApp.js
// Verze 3.9.7: Opraven název volání funkce initializeSupabase.

// Strict mode for better error handling
"use strict";

// --- Imports ---
import * as config from './config.js';
import { state } from './state.js';
import { ui } from './ui.js';
import * as utils from './utils.js';
import * as uiHelpers from './uiHelpers.js';
import * as supabaseService from './supabaseService.js'; // <<< Импорт сервиса
import * as geminiService from './geminiService.js';
import * as speechService from './speechService.js';
import * as whiteboardController from './whiteboardController.js';
import * as chatController from './chatController.js';

// --- Constants ---
const VYUKA_APP_VERSION = "3.9.7"; // Version with supabase fix

// --- Helper Functions (Логгирование) ---
const logInfo = (message, ...args) => console.log(`[INFO ${new Date().toLocaleTimeString()}] ${message}`, ...args);
const logDebug = (message, ...args) => console.log(`[DEBUG ${new Date().toLocaleTimeString()}] ${message}`, ...args);
const logWarn = (message, ...args) => console.warn(`[WARN ${new Date().toLocaleTimeString()}] ${message}`, ...args);
const logError = (message, ...args) => console.error(`[ERROR ${new Date().toLocaleTimeString()}] ${message}`, ...args);

// --- Initialization Function ---
async function initializeApp() {
    logInfo(`🚀 [Init Vyuka v${VYUKA_APP_VERSION}] Starting App Initialization...`);

    try {
        // 1. Initialize Services (Supabase must be first for Auth)
        // <<< ИСПРАВЛЕНИЕ: Используем правильное имя функции initializeSupabase >>>
        if (!supabaseService || !supabaseService.initializeSupabase()) {
            logError('[INIT] Supabase Service failed to initialize. Aborting.');
            uiHelpers.showError("Nepodařilo se připojit k databázi. Aplikace nemůže pokračovat.", true);
            return; // Stop initialization
        }
        logDebug('[INIT] Supabase Initialized');

        // Initialize other services
        geminiService?.initialize();
        speechService?.setManageButtonStatesCallback(manageButtonStates);
        speechService?.initializeSpeechRecognition();
        speechService?.loadVoices();

        // 2. Check Authentication and Fetch Profile
        logDebug('[INIT] Checking auth session');
        uiHelpers.setLoadingState('user', true);

        // Wait briefly for auth state listener to potentially run
        await new Promise(resolve => setTimeout(resolve, 150));

        const currentUser = state.currentUser;

        if (currentUser) {
            logInfo(`[INIT] User authenticated (ID: ${currentUser.id}). Fetching profile...`);
            const profile = await supabaseService.fetchUserProfile(currentUser.id);
            uiHelpers.setLoadingState('user', false);

            if (profile) {
                logInfo('[INIT] Profile fetched successfully.');
                state.currentProfile = profile;
                updateUserInfoUI();
            } else {
                logError('[INIT] Failed to fetch profile for user:', currentUser.id);
                uiHelpers.showToast('Nepodařilo se načíst váš profil.', 'error');
                updateUserInfoUI();
            }
        } else {
            logWarn('[INIT] No active session found after check. Redirecting or showing guest view.');
            uiHelpers.setLoadingState('user', false);
             uiHelpers.showToast('Prosím, přihlaste se pro pokračování.', 'info');
             updateUserInfoUI();
             manageButtonStates();
             // Optional: Redirect to login
             // window.location.href = '/auth/index.html';
             return;
        }

        // 3. Initialize Base UI
        logDebug('[INIT] Initializing base UI...');
        initializeUI();

        // 4. Load Initial Data (Topic, Notifications etc.) - Only if authenticated
        if (state.currentUser) {
             logDebug('[INIT] Loading initial topic and notifications...');
             const notificationsPromise = loadAndDisplayNotifications();
             const topicPromise = loadNextTopicFlow();
             await Promise.all([notificationsPromise, topicPromise]);
        } else {
            logDebug("[INIT] Skipping initial data load (user not authenticated).");
            whiteboardController.clearWhiteboard();
            chatController.clearChat();
            whiteboardController.appendToWhiteboard("<h1>Vítejte!</h1><p>Přihlaste se prosím pro zahájení výuky.</p>");
        }

        // 5. Final UI Polish
        utils.initTooltips();

    } catch (error) {
        logError('[INIT] Unexpected error during App Initialization:', error);
        uiHelpers.showError(`Došlo k závažné chybě při inicializaci: ${error.message}. Zkuste prosím obnovit stránku.`, true);
         uiHelpers.setLoadingState('all', false);
    } finally {
        logDebug('[INIT] Finalizing initialization (finally block)...');
        uiHelpers.setLoadingState('all', false);
        logInfo(`✅ [Init Vyuka v${VYUKA_APP_VERSION}] App Initialization Finished (finally block).`);
         const initialLoader = document.getElementById('initial-loader');
         if(initialLoader) {
             initialLoader.classList.add('hidden');
             setTimeout(() => { initialLoader.remove(); }, 500);
         }
    }
}

// --- UI Initialization and Updates ---

function initializeUI() {
    logDebug('[UI Init] Initializing UI elements and handlers...');
    const savedTheme = localStorage.getItem('themeIsDark');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    state.isDarkMode = savedTheme !== null ? (savedTheme === 'true') : prefersDark;
    uiHelpers.updateTheme();
    utils.updateCopyrightYear();
    setupEventListeners();
    manageButtonStates();
    logInfo('[UI Init] UI Initialized successfully.');
}

function updateUserInfoUI() {
    const profile = state.currentProfile;
    const user = state.currentUser;
    const isAuthenticated = !!user;
    logDebug('[UI Update] Updating User Info Panel. Auth:', isAuthenticated);

    const nameElement = ui.sidebarName; // Using cached element from ui.js
    const avatarElement = ui.sidebarAvatar; // Using cached element
    const logoutButton = ui.logoutButton; // Using cached element

    if (isAuthenticated && profile && nameElement && avatarElement) {
        const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || user.email?.split('@')[0] || 'Pilot';
        nameElement.textContent = utils.sanitizeHTML(displayName);
        const initials = utils.getInitials(profile, user.email);
        // Check avatar_url and ensure path is correct
        const avatarSrc = profile.avatar_url || 'assets/default-avatar.png'; // Default path
        avatarElement.innerHTML = `<img src="${avatarSrc}?t=${Date.now()}" alt="Avatar" onerror="this.onerror=null; this.src='default-avatar.png';">`; // Add fallback
        if (logoutButton) logoutButton.style.display = 'inline-block';
    } else if (nameElement && avatarElement) {
        nameElement.textContent = 'Host';
        avatarElement.textContent = '?';
        if (logoutButton) logoutButton.style.display = 'none';
    }
    // Ensure user info panel itself is visible
    const userInfoPanel = document.getElementById('user-info');
    if (userInfoPanel) userInfoPanel.style.display = 'flex'; // Make sure panel is visible
}


function setupEventListeners() {
    logDebug('[SETUP] Setting up event listeners...');
    let listenerCount = 0;

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

    if (ui.logoutButton) {
        ui.logoutButton.addEventListener('click', async () => {
            logInfo('[ACTION] Logout button clicked.');
             // Use correct exported function name
            const { error } = await supabaseService.signOutSupabase(); // Assuming signOutSupabase is exported
            if (error) {
                logError('[Logout] Error signing out:', error);
                uiHelpers.showToast(`Chyba při odhlášení: ${error.message}`, 'error');
            } else {
                logInfo('[Logout] User signed out successfully.');
                state.currentUser = null;
                state.currentProfile = null;
                updateUserInfoUI();
                window.location.href = '/auth/index.html';
            }
        });
        listenerCount++;
    } else { logWarn("[SETUP] Logout button (#logout-button) not found."); }

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
        ui.chatInput.addEventListener('input', () => utils.autoResizeTextarea(ui.chatInput));
        listenerCount++;
    } else { logWarn("[SETUP] Chat send button or input element not found."); }

    if (ui.micBtn) {
        ui.micBtn.addEventListener('click', speechService.handleMicClick);
        listenerCount++;
    } else { logWarn("[SETUP] Mic button (#speech-to-text-button) not found."); }

    if (ui.stopSpeechBtn) {
        ui.stopSpeechBtn.addEventListener('click', speechService.stopSpeech);
        listenerCount++;
    } else { logWarn("[SETUP] Stop Speech button (#stop-speech-btn) not found."); }

    if (ui.clearBoardBtn) {
        ui.clearBoardBtn.addEventListener('click', () => {
            if (confirm("Opravdu chcete smazat obsah tabule?")) {
                 whiteboardController.clearWhiteboard(false);
                 uiHelpers.showToast("Tabule byla vymazána.", "info");
             }
        });
        listenerCount++;
    } else { logWarn("[SETUP] Clear Board button (#clear-board-btn) not found."); }

    if (ui.continueBtn) {
        ui.continueBtn.addEventListener('click', handleCompleteTopic);
        listenerCount++;
    } else { logWarn("[SETUP] Continue button (#continue-btn) not found."); }

     if (ui.whiteboardContent) {
         ui.whiteboardContent.addEventListener('click', (event) => {
             const ttsButton = event.target.closest('.tts-listen-btn');
             if (ttsButton && ttsButton.dataset.textToSpeak) {
                 const text = ttsButton.dataset.textToSpeak;
                 const chunkElement = ttsButton.closest('.whiteboard-chunk');
                 logDebug(`[ACTION] Whiteboard TTS clicked.`);
                 speechService.speakText(text, chunkElement);
             }
         });
         listenerCount++;
     } else { logWarn("[SETUP] Whiteboard content element not found for delegation."); }

     if (ui.chatMessages) {
         ui.chatMessages.addEventListener('click', (event) => {
             const ttsButton = event.target.closest('.tts-listen-btn');
             if (ttsButton && ttsButton.dataset.textToSpeak) {
                 const text = ttsButton.dataset.textToSpeak;
                 logDebug(`[ACTION] Chat TTS clicked.`);
                 speechService.speakText(text);
             }
         });
         listenerCount++;
     } else { logWarn("[SETUP] Chat messages element not found for delegation."); }

    window.addEventListener('online', utils.updateOnlineStatus);
    window.addEventListener('offline', utils.updateOnlineStatus);
    window.addEventListener('resize', utils.closeMenu);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (localStorage.getItem('themeIsDark') === null) {
            state.isDarkMode = event.matches;
            uiHelpers.updateTheme();
        }
    });
    listenerCount += 4;

    logInfo(`[SETUP] Event listeners setup complete. Approx: ${listenerCount}`);
}

// --- Core Application Logic ---

function manageButtonStates() {
    const canInteract = !state.geminiIsThinking && !state.topicLoadInProgress && !state.isListening;
    const inputHasText = ui.chatInput && ui.chatInput.value.trim().length > 0;
    const isMicDisabled = state.geminiIsThinking || state.topicLoadInProgress || state.isSpeakingTTS; // Corrected logic

    if (ui.sendButton) {
        ui.sendButton.disabled = !canInteract || !inputHasText;
        ui.sendButton.innerHTML = state.geminiIsThinking
            ? '<i class="fas fa-spinner fa-spin"></i>'
            : '<i class="fas fa-paper-plane"></i>';
    }

    if (ui.micBtn) {
        ui.micBtn.disabled = isMicDisabled; // Set disabled state
        ui.micBtn.classList.toggle('active-listening', state.isListening);
        ui.micBtn.innerHTML = state.isListening ? '<i class="fas fa-stop-circle"></i>' : '<i class="fas fa-microphone"></i>';
        ui.micBtn.title = state.isListening ? 'Zastavit nahrávání' : (isMicDisabled ? 'Nahrávání nedostupné' : 'Hlasový vstup');
    }

    if (ui.continueBtn) {
        ui.continueBtn.disabled = !state.aiProposedCompletion || state.geminiIsThinking || state.topicLoadInProgress;
        ui.continueBtn.style.display = state.currentTopic ? 'inline-flex' : 'none';
    }

    if (ui.stopSpeechBtn) {
        ui.stopSpeechBtn.style.display = state.isSpeakingTTS ? 'inline-flex' : 'none';
    }

     if (ui.clearBoardBtn) {
         ui.clearBoardBtn.disabled = state.geminiIsThinking || state.topicLoadInProgress;
     }

    if(ui.chatInput) {
        ui.chatInput.disabled = state.geminiIsThinking || state.topicLoadInProgress;
        ui.chatInput.placeholder = state.geminiIsThinking
            ? "Čekejte na odpověď AI..."
            : (state.aiIsWaitingForAnswer ? "Odpovězte na otázku AI..." : "Vaše odpověď nebo otázka...");
    }
}


async function handleSendChatMessage() {
    const messageText = ui.chatInput?.value.trim();
    logDebug(`[Chat] handleSendChatMessage called. Message: "${messageText ? messageText.substring(0,30)+'...' : ''}"`);

    if (!messageText) {
        logWarn('[Chat] Attempted to send empty message.');
        return;
    }

    if (state.geminiIsThinking || state.topicLoadInProgress) {
         logWarn('[Chat] User tried to send message while AI is busy.');
         uiHelpers.showToast("Počkejte prosím, AI stále zpracovává předchozí požadavek.", "warning");
         return;
    }

    // Add user message to UI & save
    chatController.addChatMessage(messageText, 'user', true); // True = save to DB
    if (ui.chatInput) {
        ui.chatInput.value = '';
        utils.autoResizeTextarea(ui.chatInput);
    }

    // Set thinking state & update UI
    state.geminiIsThinking = true;
    state.aiIsWaitingForAnswer = false;
    chatController.addThinkingIndicator();
    manageButtonStates();

    // Prepare history and send to AI
    const currentHistory = state.geminiChatContext || [];
    const prompt = messageText;

    try {
        logDebug('[Chat] Sending message to Gemini...');
        const response = await geminiService.sendToGemini(prompt, currentHistory, true);
        logDebug('[Chat] Gemini response received:', !!response?.data);

        const indicatorRemoved = chatController.removeThinkingIndicator();
         if (!indicatorRemoved) logWarn("[Chat] Thinking indicator not found/removed after API call.");

        if (response && response.success && response.data) {
            const { boardContent, ttsText, chatText } = response.data;

            // Update chat history state
            state.geminiChatContext.push({ role: 'user', parts: [{ text: prompt }] });
            const aiResponseForHistory = chatText || boardContent || ttsText || "(Prázdná odpověď)";
            state.geminiChatContext.push({ role: 'model', parts: [{ text: aiResponseForHistory }] });
            if (state.geminiChatContext.length > (config.MAX_GEMINI_HISTORY_TURNS || 10) * 2) {
                 state.geminiChatContext = state.geminiChatContext.slice(-(config.MAX_GEMINI_HISTORY_TURNS || 10) * 2);
                 logDebug("[Chat] Chat history pruned.");
             }

            // Render Board Content (if any)
            if (boardContent) {
                 logDebug('[Chat] Rendering board content received...');
                 await renderBoardAndMath(boardContent);
            }

            // Add AI Chat Message & update state
            if (chatText) {
                 chatController.addChatMessage(chatText, 'gemini', true, new Date(), ttsText || chatText);
                 state.aiIsWaitingForAnswer = /\?$/.test(chatText.trim());
                 logDebug(`[State Change] aiIsWaitingForAnswer: ${state.aiIsWaitingForAnswer}`);
                 // Check for completion proposal more robustly
                 const completionKeywords = ['hotovo', 'dokončení', 'další téma', 'ukončit', 'pokračovat dál', 'můžeme přejít', 'chcete přejít'];
                 if (completionKeywords.some(keyword => chatText.toLowerCase().includes(keyword))) {
                     state.aiProposedCompletion = true;
                     logInfo("[State Change] AI proposed completion.");
                 } else {
                      state.aiProposedCompletion = false;
                 }
            } else {
                 logDebug("[Chat] No explicit chat text received.");
                 state.aiIsWaitingForAnswer = false;
                 state.aiProposedCompletion = false;
            }

             // Speak TTS (if enabled and text available)
             const textToSpeak = ttsText || chatText;
             // Use a flag for allowing speech, controllable by user/settings (assuming state.isSpeakingAllowed)
             const allowSpeech = true; // Replace with actual state check if you add a toggle
             if (textToSpeak && state.speechSynthesisSupported && allowSpeech) {
                 logDebug("[TTS] Attempting to speak response.");
                 await speechService.speakText(textToSpeak);
             } else {
                 logDebug(`[TTS] Skipped speaking (Text: ${!!textToSpeak}, Supported: ${state.speechSynthesisSupported}, Allowed: ${allowSpeech})`);
             }

        } else {
             logError('[Chat] Failed to get valid response from Gemini:', response ? response.error : 'No response');
             uiHelpers.showToast(`Chyba komunikace s AI: ${response?.error || 'Neznámá chyba.'}`, 'error');
             chatController.addChatMessage(`Nastala chyba: ${response?.error || 'Neznámá chyba.'}`, 'system');
             state.aiIsWaitingForAnswer = false;
             state.aiProposedCompletion = false;
        }

    } catch (error) {
        logError('[Chat] Error handling chat message:', error);
        uiHelpers.showToast('Neočekávaná chyba při odesílání zprávy.', 'error');
        chatController.addChatMessage('Došlo k neočekávané chybě.', 'system');
        chatController.removeThinkingIndicator();
        state.aiIsWaitingForAnswer = false;
        state.aiProposedCompletion = false;
    } finally {
        state.geminiIsThinking = false;
        manageButtonStates();
        logDebug('[Chat] handleSendChatMessage finished.');
    }
}


async function renderBoardAndMath(boardContent) {
    if (!boardContent || typeof boardContent !== 'string' || boardContent.trim() === '') {
        logWarn('[Render] renderBoardAndMath called with invalid content.');
        return;
    }
    try {
        logDebug('[Render] Starting whiteboard rendering...');
        let htmlContent = '';
        if (window.marked?.parse) { htmlContent = window.marked.parse(boardContent); }
        else { logError('[Render] Marked library not found.'); htmlContent = `<pre>${utils.sanitizeHTML(boardContent)}</pre>`; }

        const sanitizedHtml = utils.sanitizeHTML(htmlContent);
         logDebug('[Render] Sanitized HTML length:', sanitizedHtml.length);

        whiteboardController.appendToWhiteboard(sanitizedHtml);
        logDebug('[Render] Content passed to whiteboard controller.');

    } catch (error) {
        logError('[Render] Error processing/rendering board content:', error);
        whiteboardController.appendToWhiteboard(`<p class="error-message">Chyba zobrazení.</p><pre>${utils.sanitizeHTML(boardContent || '')}</pre>`);
    }
}


async function startLearningSession(topic) {
    if (!topic || !topic.activity_id || !topic.name) {
        logError('[ACTION] startLearningSession invalid topic:', topic);
        uiHelpers.showToast("Nelze zahájit: neplatné téma.", "error");
        whiteboardController.clearWhiteboard();
        whiteboardController.appendToWhiteboard("<p class='error-message'>Chyba: Téma neúplné.</p>");
        return;
    }
    logInfo(`[ACTION] Starting session for topic: ${topic.name} (Activity ID: ${topic.activity_id})`);

    state.geminiIsThinking = true;
    state.aiIsWaitingForAnswer = false;
    state.aiProposedCompletion = false;
    state.currentTopic = topic;
    state.geminiChatContext = [];
    state.currentSessionId = utils.generateSessionId();
    logInfo(`[SESSION] New ID: ${state.currentSessionId}`);

    whiteboardController.clearWhiteboard();
    chatController.clearChat();
    if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = `Téma: <strong>${utils.sanitizeHTML(topic.name)}</strong>`;
    manageButtonStates();

    try {
        logDebug(`[ACTION] Calling Gemini for initial explanation...`);
        const userLevel = state.currentProfile?.level || 'začátečník';
        const prompt = `Vysvětli ZÁKLADY tématu "${topic.name}" pro studenta úrovně ${userLevel} (příprava SŠ). Uveď jeden jednoduchý příklad. Struktura: [BOARD_MARKDOWN] ... [TTS] ... [CHAT] ...`;

        const response = await geminiService.sendToGemini(prompt, [], false);
        logDebug('[ACTION] Initial Gemini response:', !!response?.data);

        if (response?.success && response.data) {
            const { boardContent, ttsText, chatText } = response.data;

            const aiResponseForHistory = `${boardContent || ''}\n${ttsText || ''}\n${chatText || ''}`.trim();
            if (aiResponseForHistory) state.geminiChatContext.push({ role: 'model', parts: [{ text: aiResponseForHistory }] });

            if (boardContent) await renderBoardAndMath(boardContent);
            else whiteboardController.appendToWhiteboard("<p>AI neposkytla obsah pro tabuli.</p>");

            if (chatText) {
                chatController.addChatMessage(chatText, 'gemini', true, new Date(), ttsText || chatText);
                state.aiIsWaitingForAnswer = /\?$/.test(chatText.trim());
            } else {
                 logDebug("[ACTION] No initial chat text received.");
                 state.aiIsWaitingForAnswer = false;
            }
            logDebug(`[STATE] aiIsWaitingForAnswer: ${state.aiIsWaitingForAnswer}`);

             const textToSpeak = ttsText || chatText;
             const allowSpeech = true; // Use state flag later
             if (textToSpeak && state.speechSynthesisSupported && allowSpeech) {
                 await speechService.speakText(textToSpeak);
             }

        } else {
            logError('[ACTION] Failed to get initial explanation:', response?.error);
            uiHelpers.showToast(`Chyba načítání: ${response?.error || 'Neznámá chyba.'}`, 'error');
            whiteboardController.appendToWhiteboard(`<p class="error-message">Nepodařilo se načíst vysvětlení: ${utils.sanitizeHTML(response?.error || 'N/A')}</p>`);
            chatController.addChatMessage(`Chyba komunikace s AI: ${utils.sanitizeHTML(response?.error || 'N/A')}`, 'system');
            state.aiIsWaitingForAnswer = false;
        }

    } catch (error) {
        logError('[ACTION] Error in startLearningSession:', error);
        uiHelpers.showToast('Neočekávaná chyba při zahájení.', 'error');
        whiteboardController.appendToWhiteboard('<p class="error-message">Neočekávaná chyba.</p>');
        chatController.addChatMessage('Neočekávaná chyba.', 'system');
        state.aiIsWaitingForAnswer = false;
    } finally {
        state.geminiIsThinking = false;
        manageButtonStates();
        logDebug('[ACTION] startLearningSession finished.');
    }
}


async function loadNextTopicFlow() {
    const userId = state.currentUser?.id;
    if (!userId) {
        logError("[Flow] Cannot load topic: User ID missing.");
        uiHelpers.showToast("Chyba: Uživatel není identifikován.", "error");
        whiteboardController.clearWhiteboard();
        whiteboardController.appendToWhiteboard("<p class='error-message'>Chyba: Chybí ID uživatele.</p>");
        return;
    }
    logInfo(`[Flow] Loading next topic flow started.`);
    state.topicLoadInProgress = true;
    uiHelpers.setLoadingState('currentTopic', true); // Show loading state
    manageButtonStates();

    try {
        logDebug('[Flow] Calling supabaseService.loadNextUncompletedTopic...');
        // Use correct exported name
        const result = await supabaseService.loadNextUncompletedTopic(userId);
        logDebug('[Flow] loadNextUncompletedTopic result:', result);

        if (result.success && result.topic) {
            logInfo(`[Flow] Topic loaded: ${result.topic.name}. Starting session...`);
             state.aiProposedCompletion = false; // Reset flags for new topic
             state.aiIsWaitingForAnswer = false;
             uiHelpers.setLoadingState('currentTopic', false); // Hide indicator
             await startLearningSession(result.topic); // Start session

        } else if (!result.success && result.reason === 'no_plan') {
             logInfo('[Flow] No active study plan found.');
             uiHelpers.showToast('Nebyl nalezen aktivní studijní plán.', 'info');
             whiteboardController.clearWhiteboard();
             whiteboardController.appendToWhiteboard("<h1>Žádný plán</h1><p>Nemáte aktivní studijní plán. Vytvořte si ho v sekci 'Procvičování'.</p>");
             if(ui.currentTopicDisplay) ui.currentTopicDisplay.textContent = "Žádný aktivní plán";
             uiHelpers.setLoadingState('currentTopic', false);

        } else if (!result.success && result.reason === 'plan_complete') {
            logInfo('[Flow] All topics in the current plan are completed.');
            uiHelpers.showToast('Gratulujeme! Všechny aktivity v plánu dokončeny!', 'success');
            whiteboardController.clearWhiteboard();
            whiteboardController.appendToWhiteboard("<h1>Plán Dokončen!</h1><p>Výborně! Můžete vytvořit nový plán.</p>");
             if(ui.currentTopicDisplay) ui.currentTopicDisplay.textContent = "Plán dokončen";
             uiHelpers.setLoadingState('currentTopic', false);

        } else { // Other errors
            logError('[Flow] Error loading next topic:', result.message || result.error);
            uiHelpers.showToast(`Chyba načítání tématu: ${result.message || result.error || 'Neznámá chyba'}`, 'error');
            whiteboardController.clearWhiteboard();
            whiteboardController.appendToWhiteboard(`<p class="error-message">Chyba načítání: ${utils.sanitizeHTML(result.message || result.error || 'N/A')}</p>`);
            if(ui.currentTopicDisplay) ui.currentTopicDisplay.textContent = "Chyba načítání";
            uiHelpers.setLoadingState('currentTopic', false);
        }
    } catch (error) {
        logError('[Flow] Unexpected error in loadNextTopicFlow:', error);
        uiHelpers.setLoadingState('currentTopic', false);
        uiHelpers.showToast('Neočekávaná chyba při načítání.', 'error');
        whiteboardController.appendToWhiteboard('<p class="error-message">Neočekávaná chyba.</p>');
    } finally {
        state.topicLoadInProgress = false;
        manageButtonStates(); // Update buttons after loading attempt
        logInfo(`[Flow] Loading next topic flow finished.`);
    }
}


async function handleCompleteTopic() {
    const currentTopic = state.currentTopic;
    const userId = state.currentUser?.id;
    if (!currentTopic || !userId) {
        logWarn("[CompleteTopic] Cannot complete: Missing data.");
        uiHelpers.showToast("Chyba: Chybí informace.", "error");
        return;
    }
    logInfo(`[ACTION] Completing topic: ${currentTopic.name} (Activity ID: ${currentTopic.activity_id})`);
    if (ui.continueBtn) { ui.continueBtn.disabled = true; ui.continueBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dokončuji...'; }
    uiHelpers.setLoadingState('points', true);

    try {
        const markSuccess = await supabaseService.markTopicComplete(currentTopic.activity_id, userId);
        if (markSuccess) {
            logInfo(`[CompleteTopic] Activity ${currentTopic.activity_id} marked complete.`);
            const pointsAwarded = config.POINTS_TOPIC_COMPLETE || 10; // Use config or default
            const awardSuccess = await supabaseService.awardPoints(userId, pointsAwarded);
            if (awardSuccess) {
                logInfo(`[CompleteTopic] ${pointsAwarded} points awarded.`);
                uiHelpers.showToast(`Téma "${currentTopic.name}" dokončeno! (+${pointsAwarded} bodů)`, 'success');
                 if (state.currentProfile) { state.currentProfile.points = (state.currentProfile.points || 0) + pointsAwarded; updateUserInfoUI();}
            } else {
                logWarn(`[CompleteTopic] Points award failed.`);
                uiHelpers.showToast(`Téma "${currentTopic.name}" dokončeno!`, 'Chyba při přidělování bodů.', 'warning');
            }
            // Clear state and load next
            state.currentTopic = null;
            state.aiProposedCompletion = false;
            if(ui.currentTopicDisplay) ui.currentTopicDisplay.innerHTML = '<span class="placeholder"><i class="fas fa-spinner fa-spin"></i> Načítám další...</span>';
            whiteboardController.clearWhiteboard();
            chatController.clearChat();
            await loadNextTopicFlow();
        } else {
            logError(`[CompleteTopic] Failed to mark complete in DB.`);
            uiHelpers.showToast("Chyba při ukládání dokončení.", "error");
            if (ui.continueBtn) { ui.continueBtn.disabled = false; ui.continueBtn.innerHTML = '<i class="fas fa-check-circle"></i> Dokončit Téma'; }
        }
    } catch (error) {
        logError("[CompleteTopic] Unexpected error:", error);
        uiHelpers.showToast("Neočekávaná chyba při dokončování.", "error");
        if (ui.continueBtn) { ui.continueBtn.disabled = false; ui.continueBtn.innerHTML = '<i class="fas fa-check-circle"></i> Dokončit Téma'; }
    } finally {
         uiHelpers.setLoadingState('points', false);
         manageButtonStates();
         logInfo("[ACTION] handleCompleteTopic finished.");
    }
}


async function loadAndDisplayNotifications() {
    const userId = state.currentUser?.id;
    if (!userId) {
        logWarn("[Notifications] Cannot load: User ID missing.");
        if(ui.notificationsList) ui.notificationsList.innerHTML = '<li>Nelze načíst.</li>';
        uiHelpers.updateNotificationBadge(0); // Assuming this helper exists
        return;
    }
    logDebug("[Notifications] Loading...");
    uiHelpers.setLoadingState('notifications', true);
    try {
        const { unreadCount, notifications } = await supabaseService.fetchNotifications(userId, config.NOTIFICATION_FETCH_LIMIT || 5);
        logDebug(`[Notifications] Fetched ${notifications.length}, unread: ${unreadCount}`);
        displayNotifications(notifications, unreadCount);
    } catch (error) {
         logError("[Notifications] Error fetching via service:", error);
         uiHelpers.showToast("Chyba načítání oznámení.", "error");
         displayNotifications([], 0, true);
    } finally {
        uiHelpers.setLoadingState('notifications', false);
        logDebug("[Notifications] Loading finished.");
    }
}


function displayNotifications(notifications, totalUnread, isError = false) {
    const listElement = ui.notificationsList;
    const noMsgElement = ui.noNotificationsMsg;
    const dropdownElement = ui.notificationsDropdown;

    if (!listElement || !noMsgElement || !dropdownElement) {
        logWarn("[Notifications] UI elements missing.");
        return;
    }
    listElement.innerHTML = '';

    if (isError) {
        listElement.innerHTML = '<li class="notification-item error-item">Chyba načítání.</li>';
        noMsgElement.style.display = 'none';
        listElement.style.display = 'block';
        uiHelpers.updateNotificationBadge(0, true);
        return;
    }

    if (notifications?.length > 0) {
        notifications.forEach(notif => {
             const visual = utils.activityVisuals?.[notif.type] || utils.activityVisuals?.default || { class: 'info', icon: 'fa-info-circle' }; // Safe access
             const isReadClass = notif.is_read ? 'is-read' : '';
             const linkAttr = notif.link ? `data-link="${utils.sanitizeHTML(notif.link)}"` : '';
             const itemHTML = `
                 <div class="notification-item ${isReadClass}" data-id="${notif.id}" ${linkAttr}>
                     ${!notif.is_read ? '<span class="unread-dot"></span>' : ''}
                     <div class="notification-icon ${visual.class}"> <i class="fas ${visual.icon}"></i> </div>
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

    uiHelpers.updateNotificationBadge(totalUnread);
    dropdownElement.classList.toggle('has-content', notifications?.length > 0);
    if(ui.markAllReadBtn) ui.markAllReadBtn.disabled = totalUnread === 0;
}

// --- Global Error Handling ---
window.addEventListener('error', (event) => { logError('[Global Error]', event.message, event.error); });
window.addEventListener('unhandledrejection', (event) => { logError('[Global Rejection]', event.reason); });

// --- Application Start ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded. Starting Vyuka App...');
    initializeApp();
});