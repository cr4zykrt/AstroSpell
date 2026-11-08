// =====================================
// Speech output (text-to-speech) helpers
// =====================================

let currentSpeechId = 0;
let speaking = false;
let speakingDeadline = 0; // safety net in case the browser never fires "end"
let speakTailUntil = 0;   // short pause after speech ends so the mic does not catch the echo

const TTS_TAIL_MS = 500;

// True while the game is talking (plus a short tail). The speech recogniser uses this to
// ignore the game's own voice - otherwise "say RETRY" would trigger RETRY by itself.
window.isTtsSpeaking = function () {
  const now = Date.now();
  return (speaking && now < speakingDeadline) || now < speakTailUntil;
};

function stopSpeakText() {
  currentSpeechId++;
  speaking = false;
  speakTailUntil = Date.now() + 200;
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch (e) {}
}

function speakText(text, opts = {}) {
  stopSpeakText();
  const speechId = ++currentSpeechId;

  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return; }

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = opts.lang || 'en-US';
    utter.rate = opts.rate || 1;
    utter.pitch = opts.pitch || 1;
    utter.volume = opts.volume !== undefined ? opts.volume : 1;

    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length) {
        const v = voices.find((v) => /en-?us/i.test(v.lang)) || voices[0];
        if (v) utter.voice = v;
      }
    };
    setVoice();
    window.speechSynthesis.onvoiceschanged = setVoice;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // Ignore late events from an utterance that was already replaced by a newer one.
      if (speechId === currentSpeechId) {
        speaking = false;
        speakTailUntil = Date.now() + TTS_TAIL_MS;
        try { document.dispatchEvent(new CustomEvent('speechSynthesisEnd')); } catch (e) {}
        resolve();
      } else {
        resolve();
      }
    };

    let started = false;
    utter.onstart = () => {
      started = true;
      if (speechId !== currentSpeechId) return;
      try { document.dispatchEvent(new CustomEvent('speechSynthesisStart')); } catch (e) {}
    };
    utter.onend = finish;
    utter.onerror = finish;

    // Some browsers occasionally never fire "end". Never let the game wait forever.
    // (About 13 characters a second, plus a safety margin.)
    const estimate = 1500 + String(text).length * 75;
    speaking = true;
    speakingDeadline = Date.now() + estimate;
    setTimeout(finish, estimate);

    // Phones block speech until the first tap, sometimes without any error. If speech has not
    // started after 2.5 seconds, give up (and cancel it) so the microphone is not left deaf.
    setTimeout(() => {
      if (!started && !done) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
        finish();
      }
    }, 2500);

    try {
      window.speechSynthesis.speak(utter);
    } catch (e) {
      finish();
    }
  });
}

function stopGuideSpeech() {
  stopSpeakText();
}

// expose globally
window.speakText = speakText;
window.stopSpeakText = stopSpeakText;
window.stopGuideSpeech = stopGuideSpeech;
