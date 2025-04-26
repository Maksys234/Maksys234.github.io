// File: dashboard/ai_math_tutor.js
// Logic for AI Math Tutor page (chat interface, placeholders for AI/WebRTC)

window.AIMathTutorApp = window.AIMathTutorApp || {};

(function(App) {
    'use strict';

    // --- Configuration ---
    App.config = {
        SUPABASE_URL: 'https://qcimhjjwvsbgjsitmvuh.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaW1oamp3dnNiZ2pzaXRtdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1ODA5MjYsImV4cCI6MjA1ODE1NjkyNn0.OimvRtbXuIUkaIwveOvqbMd_cmPN5yY3DbWCBYc9D10',
        // IMPORTANT: Replace with the URL of your deployed Supabase Edge Function for AI interaction
        AI_FUNCTION_URL: 'YOUR_SUPABASE_EDGE_FUNCTION_URL_HERE/ai-math-tutor',
        // Example - replace with your actual function URL
        // AI_FUNCTION_URL: 'https://qcimhjjwvsbgjsitmvuh.supabase.co/functions/v1/ai-math-tutor',
        NOTIFICATION_FETCH_LIMIT: 5,
    };

    // --- DOM Elements Cache ---
    App.ui = {
        initialLoader: document.getElementById('initial-loader'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        offlineBanner: document.getElementById('offline-banner'),
        sidebar: document.getElementById('sidebar'),
        mainMobileMenuToggle: document.getElementById('main-mobile-menu-toggle'),
        sidebarCloseToggle: document.getElementById('sidebar-close-toggle'),
        sidebarAvatar: document.getElementById('sidebar-avatar'),
        sidebarName: document.getElementById('sidebar-name'),
        currentYearSidebar: document.getElementById('currentYearSidebar'),
        dashboardHeader: document.querySelector('.dashboard-header'),
        notificationBell: document.getElementById('notification-bell'),
        notificationCount: document.getElementById('notification-count'),
        notificationsDropdown: document.getElementById('notifications-dropdown'),
        notificationsList: document.getElementById('notifications-list'),
        noNotificationsMsg: document.getElementById('no-notifications-msg'),
        markAllReadBtn: document.getElementById('mark-all-read'),
        mainContent: document.getElementById('main-content'),
        chatMessages: document.getElementById('chat-messages'),
        chatInput: document.getElementById('chat-input'),
        sendButton: document.getElementById('send-button'),
        micBtn: document.getElementById('mic-btn'),
        timerDisplay: document.getElementById('timer-display'),
        endSessionBtn: document.getElementById('end-session-btn'),
        toastContainer: document.getElementById('toast-container'),
        globalError: document.getElementById('global-error'),
        dashboardFooter: document.querySelector('.dashboard-footer'),
        currentYearFooter: document.getElementById('currentYearFooter'),
        mouseFollower: document.getElementById('mouse-follower'),
        // Placeholders for features not yet implemented
        videoCallPlaceholder: document.getElementById('video-call-placeholder'),
        assessmentPlaceholder: document.getElementById('assessment-placeholder'),
    };

    // --- Global State ---
    App.state = {
         supabase: null, currentUser: null, currentProfile: null,
         mathTutorSessionId: null, // Unique ID for this tutor session
         chatHistory: [], // Simple array to store chat for context [{ role: 'user'/'model', content: '...' }]
         isThinking: false, thinkingIndicatorId: null,
         isListening: false, // For STT
         speechRecognition: null, speechRecognitionSupported: ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
         currentQuestion: null, // To store the current math question context
         timerInterval: null, timeElapsed: 0, // For answer timer
         isLoading: { user: false, chat: false, notifications: false }
     };

    // --- Helper Functions (Adapted from vyuka-core.js / profile.js) ---
    App.showToast = (title, message, type = 'info', duration = 4500) => { /* ... (same as in profile.js) ... */ if (!App.ui.toastContainer) return; try { const toastId = `toast-${Date.now()}`; const toastElement = document.createElement('div'); toastElement.className = `toast ${type}`; toastElement.id = toastId; toastElement.setAttribute('role', 'alert'); toastElement.setAttribute('aria-live', 'assertive'); toastElement.innerHTML = `<i class="toast-icon"></i><div class="toast-content">${title ? `<div class="toast-title">${App.sanitizeHTML(title)}</div>` : ''}<div class="toast-message">${App.sanitizeHTML(message)}</div></div><button type="button" class="toast-close" aria-label="Zavřít">&times;</button>`; const icon = toastElement.querySelector('.toast-icon'); icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`; toastElement.querySelector('.toast-close').addEventListener('click', () => { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); }); App.ui.toastContainer.appendChild(toastElement); requestAnimationFrame(() => { toastElement.classList.add('show'); }); setTimeout(() => { if (toastElement.parentElement) { toastElement.classList.remove('show'); setTimeout(() => toastElement.remove(), 400); } }, duration); } catch (e) { console.error("Chyba při zobrazování toastu:", e); } };
    App.sanitizeHTML = (str) => { const temp = document.createElement('div'); temp.textContent = str || ''; return temp.innerHTML; };
    App.getInitials = (profileData, email) => { /* ... (same as in profile.js) ... */ if (!profileData && !email) return '?'; const avatarUrl = profileData?.avatar_url; if (avatarUrl) { return `<img src="${App.sanitizeHTML(avatarUrl)}" alt="User Avatar">`; } else { let initials = ''; if (profileData?.first_name) initials += profileData.first_name[0]; if (profileData?.last_name) initials += profileData.last_name[0]; if (initials) return initials.toUpperCase(); if (profileData?.username) return profileData.username[0].toUpperCase(); if (email) return email[0].toUpperCase(); return 'U'; } };
    App.formatTimestamp = (d = new Date()) => d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    App.openMenu = () => { App.ui.sidebar?.classList.add('active'); App.ui.sidebarOverlay?.classList.add('active'); };
    App.closeMenu = () => { App.ui.sidebar?.classList.remove('active'); App.ui.sidebarOverlay?.classList.remove('active'); };
    App.autoResizeTextarea = () => { /* ... (same as in vyuka-features.js) ... */ const textarea = App.ui.chatInput; if (!textarea) return; textarea.style.height = 'auto'; const scrollHeight = textarea.scrollHeight; const maxHeight = 115; /* Максимальная высота textarea */ textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`; textarea.style.overflowY = scrollHeight > maxHeight ? 'scroll' : 'hidden'; };
    App.initTooltips = () => { try { if (window.jQuery?.fn.tooltipster) { window.jQuery('.btn-tooltip:not(.tooltipstered)').tooltipster({ theme: 'tooltipster-shadow', animation: 'fade', delay: 150, side: 'top' }); } } catch (e) { console.error("Tooltipster init error:", e); } };
    App.updateOnlineStatus = () => { if (App.ui.offlineBanner) App.ui.offlineBanner.style.display = navigator.onLine ? 'none' : 'block'; };
    App.updateCopyrightYear = () => { const year = new Date().getFullYear(); if (App.ui.currentYearSidebar) App.ui.currentYearSidebar.textContent = year; if (App.ui.currentYearFooter) App.ui.currentYearFooter.textContent = year; };
    App.initMouseFollower = () => { /* ... (same logic as vyuka-core.js) ... */ const follower = App.ui.mouseFollower; if (!follower || window.innerWidth <= 576) return; let hasMoved = false; const updatePosition = (event) => { if (!hasMoved) { document.body.classList.add('mouse-has-moved'); hasMoved = true; } requestAnimationFrame(() => { follower.style.left = `${event.clientX}px`; follower.style.top = `${event.clientY}px`; }); }; window.addEventListener('mousemove', updatePosition, { passive: true }); document.body.addEventListener('mouseleave', () => { if (hasMoved) follower.style.opacity = '0'; }); document.body.addEventListener('mouseenter', () => { if (hasMoved) follower.style.opacity = '1'; }); window.addEventListener('touchstart', () => { if(follower) follower.style.display = 'none'; }, { passive: true, once: true }); };
    App.initHeaderScrollDetection = () => { /* ... (same logic as vyuka-core.js) ... */ let lastScrollY = window.scrollY; const mainEl = App.ui.mainContent; if (!mainEl) return; mainEl.addEventListener('scroll', () => { const currentScrollY = mainEl.scrollTop; document.body.classList.toggle('scrolled', currentScrollY > 10); lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; }, { passive: true }); if (mainEl.scrollTop > 10) document.body.classList.add('scrolled'); };
    App.clearInitialChatState = () => { /* ... (same logic as vyuka-core.js) ... */ const ui = App.ui; const initialElement = ui.chatMessages?.querySelector('.initial-chat-interface'); if (initialElement) { initialElement.remove(); console.log("Initial chat state cleared."); } };
    App.setLoadingState = (sectionKey, isLoadingFlag) => { /* ... Basic button disabling based on state ... */
        App.state.isLoading[sectionKey] = isLoadingFlag;
        console.log(`[SetLoading] ${sectionKey}: ${isLoadingFlag}`);
        // Basic example: disable send button when chat is loading
        if (sectionKey === 'chat' && App.ui.sendButton) {
            App.ui.sendButton.disabled = isLoadingFlag || App.state.isThinking;
            App.ui.sendButton.innerHTML = App.state.isThinking ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
        }
        if(App.ui.chatInput) App.ui.chatInput.disabled = App.state.isThinking || App.state.isListening;
        if(App.ui.micBtn) App.ui.micBtn.disabled = App.state.isThinking || !App.state.speechRecognitionSupported;

        // Add more specific UI updates for loading states as needed
    };
    App.updateUserInfoUI = (profileData, userData) => { /* ... (Adapt from profile.js to update sidebar) ... */ if (App.ui.sidebarName && App.ui.sidebarAvatar) { if (userData && profileData) { const displayName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || profileData.username || userData.email?.split('@')[0] || 'Pilot'; App.ui.sidebarName.textContent = App.sanitizeHTML(displayName); App.ui.sidebarAvatar.innerHTML = App.getInitials(profileData, userData.email); } else { App.ui.sidebarName.textContent = 'Nepřihlášen'; App.ui.sidebarAvatar.textContent = '?'; } } };
    // --- END Helper Functions ---

    // --- START Chat UI Functions (Adapted from vyuka-features.js) ---
    App.addChatMessage = (displayMessage, sender, timestamp = new Date()) => {
        const ui = App.ui;
        if (!ui.chatMessages) return;
        App.clearInitialChatState();

        const id = `msg-${Date.now()}`;
        let avatarContent = sender === 'user' ? App.getInitials(App.state.currentProfile, App.state.currentUser?.email) : '<i class="fas fa-calculator"></i>'; // Math Tutor Icon

        const div = document.createElement('div');
        div.className = `chat-message ${sender === 'model' ? 'model' : sender}`; // Add 'model' class for AI
        div.id = id;
        div.style.opacity = '0'; // Start hidden for animation

        const avatarDiv = `<div class="message-avatar">${avatarContent}</div>`;
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        const bubbleContentDiv = document.createElement('div');
        bubbleContentDiv.className = 'message-bubble-content';

        // Render Markdown/MathJax
        App.renderMarkdownMath(bubbleContentDiv, displayMessage);

        bubbleDiv.appendChild(bubbleContentDiv);
        const timeDiv = `<div class="message-timestamp">${App.formatTimestamp(timestamp)}</div>`;
        div.innerHTML = avatarDiv + bubbleDiv.outerHTML + timeDiv;
        ui.chatMessages.appendChild(div);

        // Scroll to the new message
        div.scrollIntoView({ behavior: 'smooth', block: 'end' });
        requestAnimationFrame(() => { div.style.opacity = '1'; }); // Fade in
        App.initTooltips();
    };

    App.renderMarkdownMath = (container, text) => {
        if (!container) return;
        const rawText = text || '';
        try {
            // Render Markdown first
            if (typeof marked !== 'undefined') {
                marked.setOptions({ gfm: true, breaks: true, sanitize: false }); // Allow HTML for MathJax
                container.innerHTML = marked.parse(rawText);
            } else {
                console.warn("Marked library not loaded. Displaying raw text.");
                container.textContent = rawText; // Display raw text if Marked is missing
            }

            // Then typeset MathJax within the container
            if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
                 // Check for potential MathJax delimiters before queueing
                 if (rawText.includes('$') || rawText.includes('\\')) {
                    console.log("[Math Render] Queueing MathJax typeset.");
                    // Use timeout 0 to ensure DOM is updated before typesetting
                    setTimeout(() => {
                        window.MathJax.typesetPromise([container])
                            .then(() => console.log("[Math Render] Typeset complete."))
                            .catch(err => console.error("[Math Render] MathJax typeset error:", err));
                    }, 0);
                } else {
                     console.log("[Math Render] No MathJax delimiters found, skipping typeset.");
                }
            } else {
                 if (rawText.includes('$') || rawText.includes('\\')) {
                    console.warn("[Math Render] MathJax not ready or typesetPromise unavailable.");
                 }
            }
        } catch (e) {
            console.error("Markdown/MathJax rendering error:", e);
            container.innerHTML = `<p style="color:var(--accent-pink);">Chyba zobrazení obsahu.</p><pre><code>${App.sanitizeHTML(rawText)}</code></pre>`;
        }
    };


    App.addThinkingIndicator = () => { /* ... (same as vyuka-features.js, use math icon) ... */ const ui = App.ui; const state = App.state; if (state.thinkingIndicatorId || !ui.chatMessages) return; App.clearInitialChatState(); const id = `thinking-${Date.now()}`; const div = document.createElement('div'); div.className = 'chat-message model'; div.id = id; div.innerHTML = `<div class="message-avatar"><i class="fas fa-calculator"></i></div><div class="message-thinking-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`; ui.chatMessages.appendChild(div); div.scrollIntoView({ behavior: 'smooth', block: 'end' }); state.thinkingIndicatorId = id; App.setLoadingState('chat', true); };
    App.removeThinkingIndicator = () => { /* ... (same as vyuka-features.js) ... */ const state = App.state; if (state.thinkingIndicatorId) { document.getElementById(state.thinkingIndicatorId)?.remove(); state.thinkingIndicatorId = null; } App.setLoadingState('chat', false); };
    App.updateThinkingState = (isThinking) => { App.state.isThinking = isThinking; if (isThinking) App.addThinkingIndicator(); else App.removeThinkingIndicator(); };

    // --- END Chat UI Functions ---

    // --- START Speech Recognition (STT - Adapted from vyuka-features.js) ---
    App.initializeSpeechRecognition = () => {
        const state = App.state;
        const ui = App.ui;
        if (!state.speechRecognitionSupported) {
            console.warn("Speech Recognition not supported.");
            if(ui.micBtn) { ui.micBtn.disabled = true; ui.micBtn.title = "Rozpoznávání řeči není podporováno"; }
            return;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        state.speechRecognition = new SpeechRecognition();
        state.speechRecognition.lang = 'cs-CZ'; state.speechRecognition.interimResults = false; state.speechRecognition.maxAlternatives = 1; state.speechRecognition.continuous = false;
        state.speechRecognition.onresult = (event) => { const transcript = event.results[0][0].transcript; console.log('Speech recognized:', transcript); if (ui.chatInput) { ui.chatInput.value = transcript; App.autoResizeTextarea(); } };
        state.speechRecognition.onerror = (event) => { console.error('Speech recognition error:', event.error); let errorMsg = "Chyba rozpoznávání řeči"; if (event.error === 'no-speech') errorMsg = "Nerozpoznal jsem řeč."; else if (event.error === 'audio-capture') errorMsg = "Chyba mikrofonu."; else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { errorMsg = "Přístup k mikrofonu zamítnut."; if(ui.micBtn) ui.micBtn.disabled = true; } App.showToast(errorMsg, 'error'); App.stopListening(); };
        state.speechRecognition.onend = () => { console.log('Speech recognition ended.'); App.stopListening(); };
        console.log("Speech Recognition initialized.");
    };
    App.startListening = () => { /* ... (Adapted - uses App namespace) ... */ const state = App.state; const ui = App.ui; if (!state.speechRecognitionSupported || !state.speechRecognition || state.isListening) return; navigator.mediaDevices.getUserMedia({ audio: true }).then(() => { try { state.speechRecognition.start(); state.isListening = true; ui.micBtn?.classList.add('listening'); if(ui.micBtn) ui.micBtn.title = "Zastavit hlasový vstup"; console.log('Speech recognition started.'); App.setLoadingState('chat', false); // Ensure send button is enabled/disabled correctly based on listening state } catch (e) { console.error("Error starting speech recognition:", e); App.showToast("Nepodařilo se spustit rozpoznávání.", "error"); App.stopListening(); } }).catch(err => { console.error("Microphone access denied:", err); App.showToast("Přístup k mikrofonu je nutný.", "warning"); if(ui.micBtn) ui.micBtn.disabled = true; App.stopListening(); });};
    App.stopListening = () => { /* ... (Adapted - uses App namespace) ... */ const state = App.state; const ui = App.ui; if (!state.speechRecognitionSupported || !state.speechRecognition || !state.isListening) return; try { state.speechRecognition.stop(); } catch (e) { /* ignore */ } finally { state.isListening = false; ui.micBtn?.classList.remove('listening'); if(ui.micBtn) ui.micBtn.title = "Zahájit hlasový vstup"; console.log('Speech recognition stopped.'); App.setLoadingState('chat', false); } };
    App.handleMicClick = () => { /* ... (Adapted - uses App namespace) ... */ const state = App.state; if (!state.speechRecognitionSupported) { App.showToast("Rozpoznávání řeči není podporováno.", "warning"); return; } if (state.isListening) { App.stopListening(); } else { App.startListening(); } };
    // --- END Speech Recognition ---

    // --- START AI Interaction Logic ---
    App.sendMessageToTutor = async () => {
        const ui = App.ui;
        const state = App.state;
        const userMessage = ui.chatInput?.value.trim();

        if (!userMessage || state.isThinking) return;
        if (App.config.AI_FUNCTION_URL === 'YOUR_SUPABASE_EDGE_FUNCTION_URL_HERE/ai-math-tutor') {
             App.showToast('Chyba Konfigurace', 'URL Supabase funkce pro AI není nastavena v ai_math_tutor.js!', 'error', 10000);
             return;
         }

        App.updateThinkingState(true);
        App.addChatMessage(userMessage, 'user'); // Display user message

        // Add to local history for context
        state.chatHistory.push({ role: 'user', content: userMessage });
        if (state.chatHistory.length > 10) state.chatHistory.shift(); // Keep last ~5 interactions

        if (ui.chatInput) { ui.chatInput.value = ''; App.autoResizeTextarea(); } // Clear input

        // --- !!! BACKEND CALL PLACEHOLDER !!! ---
        try {
            console.log("[AI Tutor] Sending request to backend function...");
            const requestBody = {
                userId: state.currentUser?.id,
                profile: state.currentProfile, // Send grade, level etc.
                sessionId: state.mathTutorSessionId,
                message: userMessage,
                history: state.chatHistory.slice(-6) // Send recent history
            };
            console.log("[AI Tutor] Request Body:", JSON.stringify(requestBody).substring(0, 200) + "..."); // Log snippet

            // ** IMPORTANT: Replace fetch with secure call to your Supabase Edge Function **
            // You MUST create an Edge Function in Supabase to handle the Gemini API call securely.
            const response = await fetch(App.config.AI_FUNCTION_URL, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     // Pass the Supabase Auth token for user authentication in the Edge Function
                     'Authorization': `Bearer ${state.supabase?.auth.session()?.access_token}`,
                 },
                 body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`Backend Error (${response.status}): ${errorData.message || 'Neznámá chyba funkce'}`);
            }

            const aiResponse = await response.json(); // Expecting { response: "AI message text" } or similar

            if (aiResponse && aiResponse.response) {
                const aiMessage = aiResponse.response;
                console.log("[AI Tutor] Received response:", aiMessage.substring(0, 100) + "...");
                App.addChatMessage(aiMessage, 'model');
                state.chatHistory.push({ role: 'model', content: aiMessage });
                 if (state.chatHistory.length > 10) state.chatHistory.shift(); // Trim history again
            } else {
                 throw new Error("Neplatná odpověď z backend funkce.");
            }

        } catch (error) {
            console.error("[AI Tutor] Error interacting with backend:", error);
            App.showToast('Chyba AI', `Komunikace s AI selhala: ${error.message}`, 'error');
            App.addChatMessage(`_(Chyba komunikace s AI: ${error.message})_`, 'model'); // Show error in chat
        } finally {
            App.updateThinkingState(false);
        }
        // --- !!! END BACKEND CALL PLACEHOLDER !!! ---
    };

     App.startTutorSession = async () => {
         const state = App.state;
         if (!state.currentUser || state.isThinking) return;
         if (App.config.AI_FUNCTION_URL === 'YOUR_SUPABASE_EDGE_FUNCTION_URL_HERE/ai-math-tutor') {
              App.showToast('Chyba Konfigurace', 'URL Supabase funkce pro AI není nastavena v ai_math_tutor.js!', 'error', 10000);
              return;
          }

         App.updateThinkingState(true);
         App.clearInitialChatState(); // Clear "ready" message
         state.mathTutorSessionId = `math_${Date.now()}`; // Generate session ID
         state.chatHistory = []; // Reset history for new session

         App.addChatMessage("Zahajuji hodnocení... Jaké téma z matematiky byste chtěl(a) dnes procvičit nebo si nechat ověřit?", 'model');
         App.updateThinkingState(false); // Ready for user input

          // --- OPTIONAL: Send initial prompt to AI via backend to get the *first* question ---
         /*
         try {
             console.log("[AI Tutor] Sending initial request to backend function...");
              const requestBody = {
                  userId: state.currentUser?.id,
                  profile: state.currentProfile,
                  sessionId: state.mathTutorSessionId,
                  action: 'start_assessment', // Signal to backend to start
                  history: []
              };
             const response = await fetch(App.config.AI_FUNCTION_URL, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${state.supabase?.auth.session()?.access_token}`,
                 },
                 body: JSON.stringify(requestBody)
             });
              if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ message: response.statusText }));
                 throw new Error(`Backend Error (${response.status}): ${errorData.message || 'Neznámá chyba funkce'}`);
              }
              const aiResponse = await response.json();
              if (aiResponse && aiResponse.response) {
                 App.addChatMessage(aiResponse.response, 'model');
                 state.chatHistory.push({ role: 'model', content: aiResponse.response });
             } else {
                  throw new Error("Neplatná odpověď z backend funkce.");
             }
          } catch (error) {
              console.error("[AI Tutor] Error starting session:", error);
              App.showToast('Chyba AI', `Zahájení selhalo: ${error.message}`, 'error');
              App.addChatMessage(`_(Chyba zahájení: ${error.message})_`, 'model');
          } finally {
              App.updateThinkingState(false);
          }
          */
         // --- END OPTIONAL ---
     };


    // --- END AI Interaction Logic ---

    // --- START Notifications ---
     App.fetchNotifications = async (userId, limit = 5) => { /* ... (Adapted from profile.js) ... */ if (!App.state.supabase || !userId) { console.error("[Notifications] Missing Supabase or User ID."); return { unreadCount: 0, notifications: [] }; } console.log(`[Notifications] Fetching unread notifications for user ${userId}`); App.setLoadingState('notifications', true); try { const { data, error, count } = await App.state.supabase.from('user_notifications').select('*', { count: 'exact' }).eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(limit); if (error) throw error; console.log(`[Notifications] Fetched ${data?.length || 0} notifications. Total unread: ${count}`); return { unreadCount: count ?? 0, notifications: data || [] }; } catch (error) { console.error("[Notifications] Exception fetching notifications:", error); App.showToast('Chyba', 'Nepodařilo se načíst oznámení.', 'error'); return { unreadCount: 0, notifications: [] }; } finally { App.setLoadingState('notifications', false); } };
     App.renderNotifications = (count, notifications) => { /* ... (Adapted from profile.js) ... */ console.log("[Render Notifications UI] Start, Count:", count, "Notifications:", notifications); if (!App.ui.notificationCount || !App.ui.notificationsList || !App.ui.noNotificationsMsg || !App.ui.markAllReadBtn) { console.error("[Render Notifications UI] Missing UI elements."); return; } App.ui.notificationCount.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : ''); App.ui.notificationCount.classList.toggle('visible', count > 0); const activityVisuals = { test: { icon: 'fa-vial', class: 'test' }, exercise: { icon: 'fa-pencil-alt', class: 'exercise' }, badge: { icon: 'fa-medal', class: 'badge' }, diagnostic: { icon: 'fa-clipboard-check', class: 'diagnostic' }, lesson: { icon: 'fa-book-open', class: 'lesson' }, plan_generated: { icon: 'fa-calendar-alt', class: 'plan_generated' }, level_up: { icon: 'fa-level-up-alt', class: 'level_up' }, other: { icon: 'fa-info-circle', class: 'other' }, default: { icon: 'fa-check-circle', class: 'default' } }; if (notifications && notifications.length > 0) { App.ui.notificationsList.innerHTML = notifications.map(n => { const visual = activityVisuals[n.type?.toLowerCase()] || activityVisuals.default; const isReadClass = n.is_read ? 'is-read' : ''; const linkAttr = n.link ? `data-link="${App.sanitizeHTML(n.link)}"` : ''; return `<div class="notification-item ${isReadClass}" data-id="${n.id}" ${linkAttr}>${!n.is_read ? '<span class="unread-dot"></span>' : ''}<div class="notification-icon ${visual.class}"><i class="fas ${visual.icon}"></i></div><div class="notification-content"><div class="notification-title">${App.sanitizeHTML(n.title)}</div><div class="notification-message">${App.sanitizeHTML(n.message)}</div><div class="notification-time">${App.formatRelativeTime(n.created_at)}</div></div></div>`; }).join(''); App.ui.noNotificationsMsg.style.display = 'none'; App.ui.notificationsList.style.display = 'block'; App.ui.markAllReadBtn.disabled = count === 0; } else { App.ui.notificationsList.innerHTML = ''; App.ui.noNotificationsMsg.style.display = 'block'; App.ui.notificationsList.style.display = 'none'; App.ui.markAllReadBtn.disabled = true; } App.ui.notificationsList.closest('.notifications-dropdown-wrapper')?.classList.toggle('has-content', notifications && notifications.length > 0); console.log("[Render Notifications UI] Finished rendering."); };
     App.markNotificationRead = async (notificationId) => { /* ... (Adapted from profile.js) ... */ console.log("[FUNC] markNotificationRead: Marking ID:", notificationId); if (!App.state.currentUser || !notificationId) return false; try { const { error } = await App.state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', App.state.currentUser.id).eq('id', notificationId); if (error) throw error; console.log("[FUNC] markNotificationRead: Success for ID:", notificationId); return true; } catch (error) { console.error("[FUNC] markNotificationRead: Error:", error); App.showToast('Chyba', 'Nepodařilo se označit oznámení jako přečtené.', 'error'); return false; } };
     App.markAllNotificationsRead = async () => { /* ... (Adapted from profile.js) ... */ console.log("[FUNC] markAllNotificationsRead: Start for user:", App.state.currentUser?.id); if (!App.state.currentUser || !App.ui.markAllReadBtn) return; App.setLoadingState('notifications', true); try { const { error } = await App.state.supabase.from('user_notifications').update({ is_read: true }).eq('user_id', App.state.currentUser.id).eq('is_read', false); if (error) throw error; console.log("[FUNC] markAllNotificationsRead: DB update successful"); const { unreadCount, notifications } = await App.fetchNotifications(App.state.currentUser.id, App.config.NOTIFICATION_FETCH_LIMIT); App.renderNotifications(unreadCount, notifications); App.showToast('SIGNÁLY VYMAZÁNY', 'Všechna oznámení byla označena jako přečtená.', 'success'); } catch (error) { console.error("[FUNC] markAllNotificationsRead: Error:", error); App.showToast('CHYBA PŘENOSU', 'Nepodařilo se označit všechna oznámení.', 'error'); } finally { App.setLoadingState('notifications', false); } };
     App.formatRelativeTime = (timestamp) => { /* ... (same as profile.js) ... */ if (!timestamp) return ''; try { const now = new Date(); const date = new Date(timestamp); if (isNaN(date.getTime())) return '-'; const diffMs = now - date; const diffSec = Math.round(diffMs / 1000); const diffMin = Math.round(diffSec / 60); const diffHour = Math.round(diffMin / 60); const diffDay = Math.round(diffHour / 24); const diffWeek = Math.round(diffDay / 7); if (diffSec < 60) return 'Nyní'; if (diffMin < 60) return `Před ${diffMin} min`; if (diffHour < 24) return `Před ${diffHour} hod`; if (diffDay === 1) return `Včera`; if (diffDay < 7) return `Před ${diffDay} dny`; if (diffWeek <= 4) return `Před ${diffWeek} týdny`; return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { console.error("Chyba formátování času:", e, "Timestamp:", timestamp); return '-'; } }
    // --- END Notifications ---

    // --- START Timer Logic ---
    App.startAnswerTimer = (durationSeconds = 60) => {
        clearInterval(App.state.timerInterval);
        App.state.timeElapsed = 0;
        if (App.ui.timerDisplay) App.ui.timerDisplay.textContent = `Čas: ${App.formatTime(durationSeconds)}`;
        App.state.timerInterval = setInterval(() => {
            App.state.timeElapsed++;
            const timeRemaining = Math.max(0, durationSeconds - App.state.timeElapsed);
            if (App.ui.timerDisplay) App.ui.timerDisplay.textContent = `Čas: ${App.formatTime(timeRemaining)}`;
            if (timeRemaining <= 0) {
                clearInterval(App.state.timerInterval);
                App.handleTimeout();
            }
        }, 1000);
    };
    App.stopAnswerTimer = () => { clearInterval(App.state.timerInterval); App.state.timerInterval = null; if (App.ui.timerDisplay) App.ui.timerDisplay.textContent = `Časovač`; };
    App.formatTime = (seconds) => { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; };
    App.handleTimeout = () => { App.showToast("Čas vypršel!", "warning"); App.addChatMessage("_Čas na odpověď vypršel. Přeskočeno._", "model"); // TODO: Send timeout info to AI backend?
    };
    // --- END Timer Logic ---

    // --- START Initialization and Event Listeners ---
    App.setupEventListeners = () => {
        console.log("[SETUP] Setting up AI Math Tutor event listeners...");
        // Basic UI
        App.ui.mainMobileMenuToggle?.addEventListener('click', App.openMenu);
        App.ui.sidebarCloseToggle?.addEventListener('click', App.closeMenu);
        App.ui.sidebarOverlay?.addEventListener('click', App.closeMenu);
        document.querySelectorAll('.sidebar-link').forEach(link => link.addEventListener('click', () => { if (window.innerWidth <= 992) App.closeMenu(); }));
        window.addEventListener('online', App.updateOnlineStatus);
        window.addEventListener('offline', App.updateOnlineStatus);
        App.updateOnlineStatus();
        // Chat
        App.ui.chatInput?.addEventListener('input', App.autoResizeTextarea);
        App.ui.chatInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); App.sendMessageToTutor(); } });
        App.ui.sendButton?.addEventListener('click', App.sendMessageToTutor);
        // STT
        App.ui.micBtn?.addEventListener('click', App.handleMicClick);
        // Session End
        App.ui.endSessionBtn?.addEventListener('click', () => { if (confirm("Opravdu ukončit toto hodnocení?")) { /* TODO: Add end session logic */ App.stopAnswerTimer(); App.showToast("Hodnocení ukončeno.", "info"); /* Redirect or reset UI */ window.location.href = '/dashboard/procvicovani/main.html'; } });
         // Notifications
         App.ui.notificationBell?.addEventListener('click', (event) => { event.stopPropagation(); App.ui.notificationsDropdown?.classList.toggle('active'); });
         App.ui.markAllReadBtn?.addEventListener('click', App.markAllNotificationsRead);
         if (App.ui.notificationsList) { App.ui.notificationsList.addEventListener('click', async (event) => { const item = event.target.closest('.notification-item'); if (item) { const notificationId = item.dataset.id; const link = item.dataset.link; const isRead = item.classList.contains('is-read'); if (!isRead && notificationId) { const success = await App.markNotificationRead(notificationId); if (success) { item.classList.add('is-read'); item.querySelector('.unread-dot')?.remove(); const currentCountText = App.ui.notificationCount.textContent.replace('+', ''); const currentCount = parseInt(currentCountText) || 0; const newCount = Math.max(0, currentCount - 1); App.ui.notificationCount.textContent = newCount > 9 ? '9+' : (newCount > 0 ? String(newCount) : ''); App.ui.notificationCount.classList.toggle('visible', newCount > 0); App.ui.markAllReadBtn.disabled = newCount === 0; } } if (link) window.location.href = link; } }); }
         document.addEventListener('click', (event) => { if (App.ui.notificationsDropdown?.classList.contains('active') && !App.ui.notificationsDropdown.contains(event.target) && !App.ui.notificationBell?.contains(event.target)) { App.ui.notificationsDropdown.classList.remove('active'); } });
        console.log("[SETUP] Event listeners set.");
    };

    App.initialize = async () => {
        console.log("🚀 [Init AI Math Tutor] Starting...");
        if (!App.config.SUPABASE_URL || !App.config.SUPABASE_ANON_KEY) { App.showToast('Chyba: Chybí konfigurace Supabase!', 'error'); return; }
        App.state.supabase = supabase.createClient(App.config.SUPABASE_URL, App.config.SUPABASE_ANON_KEY);

        App.setupEventListeners(); // Set up basic listeners early

        if (App.ui.initialLoader) App.ui.initialLoader.style.display = 'flex';
        if (App.ui.mainContent) App.ui.mainContent.style.display = 'none';

        try {
            const { data: { session }, error: sessionError } = await App.state.supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!session || !session.user) { window.location.href = '/auth/index.html'; return; }
            App.state.currentUser = session.user;

            // Fetch profile
            App.setLoadingState('user', true);
            const { data: profileData, error: profileError } = await App.state.supabase.from('profiles').select('*').eq('id', App.state.currentUser.id).single();
            if (profileError || !profileData) throw profileError || new Error("Profil nenalezen.");
            App.state.currentProfile = profileData;
            App.updateUserInfoUI(App.state.currentProfile, App.state.currentUser);
            App.setLoadingState('user', false);

            // Fetch initial notifications
            App.setLoadingState('notifications', true);
             const { unreadCount, notifications } = await App.fetchNotifications(App.state.currentUser.id, App.config.NOTIFICATION_FETCH_LIMIT);
             App.renderNotifications(unreadCount, notifications);
            App.setLoadingState('notifications', false);

            App.initializeSpeechRecognition(); // Init STT
            App.initMouseFollower();
            App.initHeaderScrollDetection();
            App.updateCopyrightYear();
            App.initTooltips();

            if (App.ui.initialLoader) App.ui.initialLoader.classList.add('hidden');
            if (App.ui.mainContent) { App.ui.mainContent.style.display = 'block'; requestAnimationFrame(() => App.ui.mainContent.classList.add('loaded')); }

            // Start the actual tutor session
             await App.startTutorSession();

            console.log("✅ [Init AI Math Tutor] Page initialized.");

        } catch (error) {
            console.error("❌ [Init AI Math Tutor] Critical error:", error);
            if(App.ui.initialLoader) App.ui.initialLoader.innerHTML = `<p style="color:var(--accent-pink)">Chyba načítání: ${error.message}. Obnovte stránku.</p>`;
            if (App.ui.mainContent) App.ui.mainContent.style.display = 'none';
        }
    };
    // --- END Initialization ---

    // --- START THE APP ---
    document.addEventListener('DOMContentLoaded', App.initialize);

})(window.AIMathTutorApp); // Pass the namespace object