// =====================================
// AstroSpell
// =====================================

// ---- Microphone / secure-page help ----
// Browsers only allow the microphone (and speech recognition) on https:// pages or on
// localhost. Opening the game from a phone via http://192.168.x.x:3001 is NOT secure, so
// "say start" silently does nothing. These messages make the problem visible.
let voiceNoticeTimer = null;

function hideVoiceNotice() {
  clearTimeout(voiceNoticeTimer);
  const el = document.getElementById('voice-notice');
  if (el) el.hidden = true;
}

// Shows a message at the top of the screen. It disappears after a few seconds (so it never
// covers the score for long) and can be dismissed by tapping it.
// If onTap is given, tapping runs it (e.g. "try the microphone again").
function showVoiceNotice(message, onTap) {
  let el = document.getElementById('voice-notice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'voice-notice';
    el.setAttribute('role', 'alert');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.cursor = 'pointer';
  el.onclick = () => {
    hideVoiceNotice();
    if (onTap) onTap();
  };
  el.hidden = false;
  clearTimeout(voiceNoticeTimer);
  voiceNoticeTimer = setTimeout(hideVoiceNotice, 10000);
}

document.addEventListener('speechRecognitionStart', hideVoiceNotice);

document.addEventListener('speechRecognitionError', (event) => {
  const error = event.detail;

  if (error === 'not-allowed' || error === 'service-not-allowed' || error === 'permission-denied') {
    if (!window.isSecureContext) {
      showVoiceNotice('MICROPHONE BLOCKED: THIS PAGE IS NOT SECURE (HTTP). OPEN THE GAME VIA HTTPS OR LOCALHOST. YOU CAN STILL TAP START.');
    } else {
      showVoiceNotice('MICROPHONE BLOCKED. ALLOW THE MICROPHONE FOR THIS SITE, THEN TAP HERE.', () => {
        if (window.startListening) startListening();
      });
    }
  } else if (error === 'network') {
    showVoiceNotice('VOICE RECOGNITION NEEDS AN INTERNET CONNECTION. CHECK YOUR CONNECTION.');
  } else if (error === 'audio-capture') {
    showVoiceNotice('NO MICROPHONE FOUND ON THIS DEVICE.');
  }
});

window.addEventListener('load', () => {
  if (!window.isSecureContext) {
    console.warn('This page is not a secure context, so the microphone is blocked. Use https:// or localhost.');
  }

  // Start the logging session. Level loading waits for this promise, so the server
  // can record which levels this player was given. It never rejects.
  window.sessionReady = (window.createGameSession ? window.createGameSession() : Promise.resolve(null))
    .then((sessionId) => {
      if (sessionId && window.logActivity) {
        window.logActivity('session_start', { source: 'page_load', session_id: sessionId });
      }
      return sessionId;
    })
    .catch(() => null);

  loadLoadingScreen();
});
