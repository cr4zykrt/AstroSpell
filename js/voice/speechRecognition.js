// =====================================
// Speech recognition (voice input)
// =====================================
// Fires a "speechTranscript" event on document:
//   detail = { text, interim, alternatives, id }
// Interim results can arrive many times; a FINAL result is delivered at most once
// per recognition session, so the same spoken letter is never counted twice.
//
// Add ?debug to the address (e.g. http://192.168.1.5:3001/?debug) to see a live timing
// panel: what the microphone / speech service is doing and how long each step takes.

let recognition = null;
let isListening = false;
let shouldKeepListening = false;
let hasMicrophoneAccess = false;
let restartTimer = null;
let stuckTimer = null;
let consecutiveFailures = 0;
let unsupportedWarningShown = false;
let sessionCounter = 0;

const RESTART_DELAY_MS = 150;
const STUCK_SESSION_MS = 12000; // a session with no activity for this long is restarted

const DEBUG_SPEECH = typeof location !== 'undefined' && /[?&]debug\b/.test(location.search);
const debugLines = [];

function speechDebug(label) {
  if (!DEBUG_SPEECH || typeof document === 'undefined' || !document.body) return;
  let panel = document.getElementById('speech-debug');
  if (!panel) {
    panel = document.createElement('pre');
    panel.id = 'speech-debug';
    panel.style.cssText = 'position:fixed;left:6px;top:calc(96px + env(safe-area-inset-top,0px));margin:0;padding:6px 8px;' +
      'max-width:92vw;background:rgba(0,0,0,0.72);color:#9ff;font:11px/1.35 monospace;border-radius:8px;' +
      'z-index:2000;pointer-events:none;white-space:pre-wrap;';
    document.body.appendChild(panel);
  }
  debugLines.push(`${(performance.now() / 1000).toFixed(2)}s  ${label}`);
  if (debugLines.length > 10) debugLines.shift();
  panel.textContent = debugLines.join('\n');
}

function emit(name, detail) {
  document.dispatchEvent(new CustomEvent(name, detail === undefined ? undefined : { detail }));
}

function initializeSpeechRecognition() {
  if (!recognition) createRecognition();
}

function armStuckTimer(rec) {
  clearTimeout(stuckTimer);
  stuckTimer = setTimeout(() => {
    if (rec === recognition && shouldKeepListening) {
      speechDebug('session stuck -> restarting');
      // Do not wait for the hung session to report back: forget it (its late events are
      // ignored) and start a fresh one.
      recognition = null;
      isListening = false;
      try { rec.abort(); } catch (e) {}
      scheduleRestart();
    }
  }, STUCK_SESSION_MS);
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

  const sessionNo = ++sessionCounter;
  let finalDelivered = false;

  if (DEBUG_SPEECH && rec.addEventListener) {
    ['audiostart', 'soundstart', 'speechstart', 'speechend', 'soundend', 'audioend'].forEach((name) => {
      rec.addEventListener(name, () => speechDebug(`#${sessionNo} ${name}`));
    });
  }

  rec.onstart = () => {
    if (rec !== recognition) return;
    isListening = true;
    armStuckTimer(rec);
    speechDebug(`#${sessionNo} listening`);
    emit('speechRecognitionStart');
  };

  rec.onresult = (event) => {
    if (rec !== recognition) return; // an old, replaced recogniser
    armStuckTimer(rec);

    // The game is talking: whatever the microphone hears is probably the game itself.
    // (The menu sets ttsGateBypass while it reads the guide so the player can say "stop".)
    if (window.isTtsSpeaking && window.isTtsSpeaking() && !window.ttsGateBypass) {
      speechDebug('ignored: the game is speaking');
      return;
    }

    const resultIndex = event.results ? event.results.length - 1 : 0;
    const result = event.results && event.results[resultIndex];
    if (!result || !result[0]) return;
    const text = (result[0].transcript || '').trim();
    if (!text) return;

    const interim = !result.isFinal;
    if (!interim) {
      if (finalDelivered) return;
      finalDelivered = true;
      consecutiveFailures = 0;
    }
    speechDebug(`${interim ? 'hearing' : 'FINAL  '} "${text.slice(0, 28)}"`);

    const alternatives = [];
    for (let i = 0; i < result.length; i++) {
      const alt = (result[i].transcript || '').trim();
      if (alt) alternatives.push(alt);
    }
    // `id` is the same for every update of one spoken phrase (interim ... final), so the game
    // can react to the first update and ignore the rest.
    emit('speechTranscript', { text, interim, alternatives, id: `${sessionNo}:${resultIndex}` });
  };

  rec.onerror = (event) => {
    if (rec !== recognition) return;
    isListening = false;
    const error = event.error;
    speechDebug(`ERROR ${error}`);
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
    clearTimeout(stuckTimer);
    speechDebug(`#${sessionNo} ended`);
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
  clearTimeout(stuckTimer);
  restartTimer = null;
  if (recognition) {
    const old = recognition;
    recognition = null;
    try { old.abort(); } catch (e) {}
  }
}
