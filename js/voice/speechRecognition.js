// =====================================
// Speech recognition (voice input)
// =====================================
// Fires a "speechTranscript" event on document:
//   detail = { text, interim, alternatives }
// Interim results can arrive many times; a FINAL result is delivered at most once
// per recognition session, so the same spoken letter is never counted twice.

let recognition = null;
let isListening = false;
let shouldKeepListening = false;
let hasMicrophoneAccess = false;
let restartTimer = null;
let consecutiveFailures = 0;
let unsupportedWarningShown = false;

const RESTART_DELAY_MS = 150;

function emit(name, detail) {
  document.dispatchEvent(new CustomEvent(name, detail === undefined ? undefined : { detail }));
}

function initializeSpeechRecognition() {
  if (!recognition) createRecognition();
}

function createRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (!unsupportedWarningShown) {
      unsupportedWarningShown = true;
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
    }
    return;
  }

  const rec = new SpeechRecognition();
  rec.lang = 'en-US';
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  recognition = rec;

  let finalDelivered = false;

  rec.onstart = () => {
    if (rec !== recognition) return;
    isListening = true;
    emit('speechRecognitionStart');
  };

  rec.onresult = (event) => {
    if (rec !== recognition) return; // an old, replaced recogniser

    // The game is talking: whatever the microphone hears is probably the game itself.
    // (The menu sets ttsGateBypass while it reads the guide so the player can say "stop".)
    if (window.isTtsSpeaking && window.isTtsSpeaking() && !window.ttsGateBypass) return;

    const result = event.results && event.results[event.results.length - 1];
    if (!result || !result[0]) return;
    const text = (result[0].transcript || '').trim();
    if (!text) return;

    const interim = !result.isFinal;
    if (!interim) {
      if (finalDelivered) return;
      finalDelivered = true;
      consecutiveFailures = 0;
    }

    const alternatives = [];
    for (let i = 0; i < result.length; i++) {
      const alt = (result[i].transcript || '').trim();
      if (alt) alternatives.push(alt);
    }
    emit('speechTranscript', { text, interim, alternatives });
  };

  rec.onerror = (event) => {
    if (rec !== recognition) return;
    isListening = false;
    const error = event.error;
    if (error === 'not-allowed' || error === 'service-not-allowed') {
      shouldKeepListening = false; // the player (or the browser) said no to the microphone
    } else if (error !== 'no-speech' && error !== 'aborted') {
      consecutiveFailures++;
    }
    emit('speechRecognitionError', error);
    // onend follows and handles the restart
  };

  rec.onend = () => {
    if (rec !== recognition) return;
    isListening = false;
    emit('speechRecognitionEnd');
    if (shouldKeepListening) scheduleRestart();
  };
}

function scheduleRestart() {
  clearTimeout(restartTimer);
  // Back off if the speech service keeps failing (for example no internet).
  const delay = Math.min(5000, RESTART_DELAY_MS * Math.pow(2, consecutiveFailures));
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (!shouldKeepListening || isListening) return;
    if (recognition) {
      try { recognition.abort(); } catch (e) {}
      recognition = null;
    }
    createRecognition();
    startInstance();
  }, delay);
}

function startInstance() {
  if (!recognition) return;
  try {
    recognition.start();
  } catch (error) {
    // "already started" is harmless; anything else is retried with back-off
    if (!(error && error.name === 'InvalidStateError')) {
      consecutiveFailures++;
      if (shouldKeepListening) scheduleRestart();
    }
  }
}

async function startListening() {
  if (!recognition) createRecognition();
  if (!recognition) return;

  shouldKeepListening = true;
  if (isListening) return;

  if (!hasMicrophoneAccess && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // We only needed the permission prompt. Release the microphone so it is not held open twice.
      stream.getTracks().forEach((track) => track.stop());
      hasMicrophoneAccess = true;
    } catch (err) {
      console.warn('Microphone permission denied or unavailable', err);
      shouldKeepListening = false;
      emit('speechRecognitionError', 'permission-denied');
      return;
    }
  }

  if (!shouldKeepListening) return; // stopListening() was called while we waited for permission
  if (!recognition) createRecognition();
  startInstance();
}

function stopListening() {
  shouldKeepListening = false;
  isListening = false;
  clearTimeout(restartTimer);
  restartTimer = null;
  if (recognition) {
    const old = recognition;
    recognition = null;
    try { old.abort(); } catch (e) {}
  }
}
