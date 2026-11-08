// =====================================
// Gameplay Screen
// =====================================

let gameplaySpeechTranscriptHandler = null;

function setVoiceStatus(status, message){
    const statusIcon = document.getElementById('status-icon');
    const statusMessage = document.querySelector('.status-message');

    if(statusIcon){
        if(status === 'correct'){
            statusIcon.src = 'assets/ui/check.png';
        } else if(status === 'wrong'){
            statusIcon.src = 'assets/ui/wrong.png';
        } else if(status === 'listening' || status === 'unknown'){
            statusIcon.src = 'assets/ui/mic.png';
        }
    }
    if(statusMessage){
        statusMessage.textContent = message || 'Listening...';
    }
}

window.setVoiceStatus = setVoiceStatus;

function getHeartIcons(lives){
    const maxHearts = 3;
    const clamped = Math.max(0, Math.min(maxHearts, lives));
    let html = '';
    for(let i = 0; i < maxHearts; i++){
        html += `<img src="assets/ui/${i < clamped ? 'fullheart' : 'emptyheart'}.png" class="heart-icon" alt="heart">`;
    }
    return html;
}

window.getHeartIcons = getHeartIcons;

function isRepeatCommand(transcript){
    if(!transcript || typeof transcript !== 'string') return false;
    const normalized = transcript.trim().toLowerCase();
    return /\b(repeat|again|say it again|say again|repeat that)\b/.test(normalized);
}

// ---------- turning speech into a letter ----------

// NATO phonetic alphabet (plus the spellings speech recognition commonly returns).
const PHONETIC_LETTERS = {
    alpha:'A', alfa:'A', bravo:'B', charlie:'C', delta:'D', echo:'E', foxtrot:'F', golf:'G',
    hotel:'H', india:'I', juliet:'J', juliett:'J', kilo:'K', lima:'L', mike:'M', november:'N',
    oscar:'O', papa:'P', quebec:'Q', romeo:'R', sierra:'S', tango:'T', uniform:'U', victor:'V',
    whiskey:'W', whisky:'W', xray:'X', 'x-ray':'X', yankee:'Y', zulu:'Z'
};

// The plain letter names ("b", "see"). Used only as a fallback.
const LETTER_NAMES = {
    a:'A', b:'B', c:'C', d:'D', e:'E', f:'F', g:'G', h:'H', i:'I', j:'J', k:'K', l:'L', m:'M',
    n:'N', o:'O', p:'P', q:'Q', r:'R', s:'S', t:'T', u:'U', v:'V', w:'W', x:'X', y:'Y', z:'Z'
};

// How recognisers often write letter names.
const LETTER_HOMOPHONES = {
    see:'C', sea:'C', bee:'B', dee:'D', gee:'G', jay:'J', kay:'K', cue:'Q', queue:'Q',
    tea:'T', tee:'T', you:'U', why:'Y', pea:'P', pee:'P', eff:'F', ess:'S', ell:'L', aitch:'H'
};

function parseTranscriptToLetter(transcript){
    if(!transcript || typeof transcript !== 'string') return null;

    // Drop apostrophes first so "I'm" becomes "im" (not the letter I), then split.
    const normalized = transcript.trim().toLowerCase().replace(/'/g, '').replace(/[^a-z\s-]/g, ' ');
    const words = normalized.split(/\s+/).filter(Boolean);
    if(words.length === 0) return null;

    const make = (letter, word) => ({ letter, word });

    // "letter bravo" / "letter b"
    if(words[0] === 'letter' && words[1]){
        const w = words[1];
        if(PHONETIC_LETTERS[w]) return make(PHONETIC_LETTERS[w], w);
        if(LETTER_HOMOPHONES[w]) return make(LETTER_HOMOPHONES[w], w);
        if(LETTER_NAMES[w]) return make(LETTER_NAMES[w], w);
    }

    // "x ray" spoken as two words
    for(let i = 0; i < words.length - 1; i++){
        if(words[i] === 'x' && words[i + 1] === 'ray') return make('X', 'x-ray');
    }

    // 1) A phonetic word anywhere in the phrase is the most trustworthy signal.
    for(const w of words){
        if(PHONETIC_LETTERS[w]) return make(PHONETIC_LETTERS[w], w);
    }
    // 2) Common ways a recogniser writes a letter name.
    for(const w of words){
        if(LETTER_HOMOPHONES[w]) return make(LETTER_HOMOPHONES[w], w);
    }
    // 3) Bare single letters only when the player said very little, so ordinary
    //    words like "a" or "i" inside a sentence are not mistaken for answers.
    if(words.length <= 2){
        for(const w of words){
            if(LETTER_NAMES[w]) return make(LETTER_NAMES[w], w);
        }
    }

    return null;
}

window.parseTranscriptToLetter = parseTranscriptToLetter;

// Every NATO word found in the phrase, in the order spoken ("papa alpha" -> P, A).
function extractPhoneticWords(transcript){
    if(!transcript || typeof transcript !== 'string') return [];
    const words = transcript.trim().toLowerCase().replace(/'/g, '').replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean);
    const found = [];
    for(let i = 0; i < words.length; i++){
        const w = words[i];
        if(w === 'x' && words[i + 1] === 'ray'){ found.push({ letter: 'X', word: 'x-ray' }); i++; continue; }
        if(PHONETIC_LETTERS[w]) found.push({ letter: PHONETIC_LETTERS[w], word: w });
    }
    return found;
}

window.extractPhoneticWords = extractPhoneticWords;
// The NATO word for each letter, used to spot words that merely SOUND like the one we expect.
const NATO_WORD_FOR = {
    A:'alpha', B:'bravo', C:'charlie', D:'delta', E:'echo', F:'foxtrot', G:'golf', H:'hotel',
    I:'india', J:'juliet', K:'kilo', L:'lima', M:'mike', N:'november', O:'oscar', P:'papa',
    Q:'quebec', R:'romeo', S:'sierra', T:'tango', U:'uniform', V:'victor', W:'whiskey',
    X:'xray', Y:'yankee', Z:'zulu'
};

// How many single-letter changes turn word a into word b ("golf" -> "gulf" = 1).
function editDistance(a, b){
    const row = [];
    for(let j = 0; j <= b.length; j++) row[j] = j;
    for(let i = 1; i <= a.length; i++){
        let previous = row[0];
        row[0] = i;
        for(let j = 1; j <= b.length; j++){
            const temp = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
            previous = temp;
        }
    }
    return row[b.length];
}

// The recogniser often mishears the very word we are waiting for ("golf" -> "gulf" / "gold").
// If a heard word is almost the NATO word of the expected letter, count it as that letter.
function findSoundAlike(transcript){
    if(!transcript || !gameState.word) return null;
    const expected = gameState.word[gameState.currentLetterIndex];
    const target = NATO_WORD_FOR[expected];
    if(!target) return null;
    const maxDistance = target.length >= 6 ? 2 : 1;
    const tokens = transcript.toLowerCase().replace(/'/g, '').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((t) => t.length >= 3);
    for(const token of tokens){
        if(editDistance(token, target) <= maxDistance) return { letter: expected, word: token };
    }
    return null;
}

window.findSoundAlike = findSoundAlike;
// Which spoken phrase we are listening to, and how many of its words were already used.
let currentUtterance = { id: null, consumed: 0 };

function actOnSpokenLetter(item){
    const expectedLetter = gameState.word[gameState.currentLetterIndex];
    if(window.logSpokenWord){
        window.logSpokenWord(gameState.word, item.word, item.letter === expectedLetter, expectedLetter);
    }
    const statusMessage = document.querySelector('.status-message');
    if(statusMessage) statusMessage.textContent = `Spoken: ${item.word}`;

    // Each spoken word is its own answer, so saying the same letter twice in a row
    // (the O O in MOON) counts twice.
    try{
        destroyEnemy(item.letter, false);
    }catch(e){
        console.warn('Failed to process speech transcript', e);
    }
}

function handleGameplaySpeechTranscript(event){
    const detail = (event && event.detail) || {};
    const transcript = detail.text || '';
    const interim = !!detail.interim;
    const id = detail.id || null;

    // A new spoken phrase starts a new count (events without an id are always separate phrases).
    if(!id || currentUtterance.id !== id){
        currentUtterance = { id, consumed: 0 };
    }

    // FAST PATH: a complete phonetic word is unmistakable, so act the moment it appears in the
    // live transcript instead of waiting for the recogniser to finish the whole phrase.
    // This is what makes the shot (or the enemy's counter-attack) feel instant.
    const heard = extractPhoneticWords(transcript);
    if(heard.length > currentUtterance.consumed){
        const fresh = heard.slice(currentUtterance.consumed);
        currentUtterance.consumed = heard.length;
        for(const item of fresh){
            if(gameState.lives <= 0 || gameState.currentLetterIndex >= gameState.word.length) break;
            actOnSpokenLetter(item);
        }
        return;
    }
        // SOUNDS-LIKE: accept a word that is almost the one we are waiting for ("gulf" for "golf").
    // Words that are exactly another letter's NATO word were already handled above.
    if(heard.length === 0 && currentUtterance.consumed === 0 &&
       gameState.lives > 0 && gameState.currentLetterIndex < gameState.word.length){
        const near = findSoundAlike(transcript);
        if(near){
            currentUtterance.consumed = 1;
            actOnSpokenLetter(near);
            return;
        }
    }

    // Nothing usable yet: interim results only update the on-screen hint.
    if(interim){
        const statusMessage = document.querySelector('.status-message');
        const firstWord = (transcript || '').split(/\s+/).filter(Boolean)[0] || transcript;
        const hint = `Hearing: ${firstWord}`;
        if(statusMessage) statusMessage.textContent = hint;
        setVoiceStatus('listening', hint);
        return;
    }

    // ---- final result ----
    // Try what the recogniser thought it heard first, then its alternatives.
    const candidates = [transcript].concat(detail.alternatives || [])
        .filter((text, index, all) => text && all.indexOf(text) === index);

    if(candidates.some(isRepeatCommand)){
        const currentWord = gameState.word || (window.levelManager ? window.levelManager.getCurrentWord() : null);
        if(window.logActivity){
            window.logActivity('voice_repeat', { word: currentWord });
        }
        if(currentWord && window.speakText){
            window.speakText(`Spell the word ${currentWord}`);
            setVoiceStatus('listening', `Repeating: SPELL THE WORD ${currentWord}`);
        }
        return;
    }

    // Phonetic words in this phrase were already used by the fast path.
    if(currentUtterance.consumed > 0) return;

    // Otherwise accept plain letter names too ("bee", "see") and the recogniser's alternatives.
    let parsed = null;
    for(const candidate of candidates){
        parsed = parseTranscriptToLetter(candidate);
        if(parsed) break;
    }

    if(!parsed){
        setVoiceStatus('unknown', 'UNKNOWN WORD - USE PHONETIC ALPHABET');
        return;
    }

    if(gameState.lives <= 0 || gameState.currentLetterIndex >= gameState.word.length) return;
    currentUtterance.consumed = 1;
    actOnSpokenLetter(parsed);
}

function createGameplay(word, levelName = 'LEVEL 1'){

    // The background video is optional: if the file is missing the still image is shown instead.
    return `

    <section
        id="gameplay-screen"
        class="screen"
        style="background: url('assets/backgrounds/bg.jpeg') center center / cover no-repeat;">

        <video id="gameplay-video" autoplay muted loop playsinline preload="auto" aria-hidden="true">
            <source src="assets/backgrounds/game.mp4" type="video/mp4"
                onerror="this.parentElement.style.display='none'">
        </video>

        <header id="hud">

            <div class="hud-panel lives-panel">

                <div class="hud-title">LIVES</div>

                <div class="hud-value">${getHeartIcons(3)}</div>

            </div>

            <div class="hud-panel level-panel">

                <div class="hud-value">${levelName}</div>

            </div>

            <div class="hud-panel score-panel">

                <div class="hud-title">SCORE</div>

                <div class="hud-value">0</div>

            </div>

        </header>

        <main id="game-area">

            <div id="enemy-container"></div>

            <div id="player">

                <img
                    src="assets/player/spaceship.png"
                    id="player-ship"
                    alt="">

            </div>

        </main>

        <footer id="voice-status">
            <img id="status-icon" src="assets/ui/mic.png" class="status-icon" alt="status icon">
            <span class="status-message" role="status">Waiting for voice...</span>
        </footer>

    </section>

    `;

}

function loadGameplay(){

    if(window.stopSpeakText) window.stopSpeakText();

    const word = window.levelManager.getCurrentWord();
    if(!word){
        console.error('No word for the current wave - were the levels loaded?');
        return;
    }

    const levelName = window.levelManager.getLevelName() || `LEVEL ${window.levelManager.currentLevelId}`;
    const wave = window.levelManager.getCurrentWave();
    const waveId = wave ? wave.id : 1;
    const waveOrdinal = waveId === 1 ? 'FIRST WAVE' : (wave && wave.isBoss) ? 'FINAL WAVE' : waveId === 2 ? 'SECOND WAVE' : `WAVE ${waveId}`;
    changeScreen(createGameplay(word, levelName));

    if (window.logActivity){
        window.logActivity('gameplay_started', { level: window.levelManager.currentLevelId, wave: waveId, word });
    }
    if (window.logProgress){
        window.logProgress(window.levelManager.currentLevelId, waveId, 'started');
    }

    gameState.lives = 3;
    gameState.score = 0;
    gameState.mistakes = 0;
    gameState.currentLetterIndex = 0;
    gameState.word = word.toUpperCase();

    const scoreDisplay = document.querySelector('.score-panel .hud-value');
    if(scoreDisplay){
        scoreDisplay.textContent = '0';
    }

    spawnEnemies(word);

    // switch to gameplay or boss music depending on wave
    const musicTrack = wave && wave.isBoss ? 'boss' : 'game';
    if(window.audioManager && window.audioManager.play){
        try{ window.audioManager.play(musicTrack); }catch(e){}
    }

    if(window.initializeSpeechRecognition && window.startListening){
        // never stack two listeners if the screen is loaded twice
        unloadGameplayVoiceListener();
        initializeSpeechRecognition();
        startListening();
        gameplaySpeechTranscriptHandler = handleGameplaySpeechTranscript;
        document.addEventListener('speechTranscript', gameplaySpeechTranscriptHandler);
    }

    // speak level/wave/word instructions
    if(window.speakText){
        speakText(`${levelName}, ${waveOrdinal}, SPELL THE WORD ${word}`)
        .catch(()=>{});
    }

}

window.loadGameplay = loadGameplay;

function unloadGameplayVoiceListener(){
    if(gameplaySpeechTranscriptHandler){
        document.removeEventListener('speechTranscript', gameplaySpeechTranscriptHandler);
        gameplaySpeechTranscriptHandler = null;
    }
}

window.unloadGameplayVoiceListener = unloadGameplayVoiceListener;
