// =====================================
// Main Menu
// =====================================

const MENU_VOICE_PROMPT = "Welcome to AstroSpell. To begin, say 'Start'. To hear the user guide, say 'Guide'. To learn the phonetic alphabet, say 'Phonetic'.";
const MENU_GUIDE_TEXT = "AstroSpell is an educational space-themed shooting game designed for visually impaired users. The game combines spelling practice with voice-controlled gameplay, where players must correctly spell announced words by speaking each letter using the phonetic alphabet in sequence. Enemy letters appear on the screen as armed targets. When the player speaks the correct letter, it shoots and destroys the corresponding enemy. However, if the player speaks an incorrect letter, the enemy letters attack the spaceship and reduce its health. The game features multiple levels with increasing difficulty.";
const MENU_PHONETIC_TEXT = "A - Alpha. B - Bravo. C - Charlie. D - Delta. E - Echo. F - Foxtrot. G - Golf. H - Hotel. I - India. J - Juliett. K - Kilo. L - Lima. M - Mike. N - November. O - Oscar. P - Papa. Q - Quebec. R - Romeo. S - Sierra. T - Tango. U - Uniform. V - Victor. W - Whiskey. X - X-ray. Y - Yankee. Z - Zulu.";

function renderMenuTitle(text){
    return text.split('').map(letter => `
            <span class="menu-title-letter">${letter}</span>
        `).join('');
}

function createMenu(){

    return `

    <section
        id="menu-screen"
        class="screen">

        <video id="menu-video" autoplay muted loop playsinline preload="auto" aria-hidden="true">
            <source src="assets/backgrounds/menu.mp4" type="video/mp4">
        </video>

        <h1 id="menu-title">
            ${renderMenuTitle('ASTROSPELL')}
        </h1>

        <div id="menu-spaceship" aria-hidden="true"></div>

        <p id="press-space">

            SAY START TO ENTER THE GAME
        </p>

    </section>

    `;

}

let menuSpeechTranscriptHandler = null;
let menuSpeechActive = false;
let currentMenuNarration = null; // null | 'menuPrompt' | 'guide' | 'phonetic'

function normalizeMenuTranscript(text){
    return (text || '')
        .toLowerCase()
        .replace(/\b(?:please|open|show)\b/g, '')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getStopCommand(transcript){
    const normalized = normalizeMenuTranscript(transcript);
    if (!normalized) return false;
    return /\bstop\b/.test(normalized);
}

function getMenuCommand(transcript){
    const normalized = normalizeMenuTranscript(transcript);
    if (!normalized) return null;
    if (/\bstart\b/.test(normalized)) return 'start';
    if (/\bguide\b/.test(normalized)) return 'guide';
    if (/\bphonetic\b/.test(normalized)) return 'phonetic';
    return null;
}

async function speakMenuPrompt(){
    if (!window.speakText) return;
    currentMenuNarration = 'menuPrompt';
    menuSpeechActive = true;
    await speakText(MENU_VOICE_PROMPT);
    menuSpeechActive = false;
    currentMenuNarration = null;
}

async function speakGuideThenReturn(){
    if (!window.speakText) return;
    currentMenuNarration = 'guide';
    menuSpeechActive = true;
    window.ttsGateBypass = true; // let the player say "stop" while this is read out
    await speakText(MENU_GUIDE_TEXT);
    window.ttsGateBypass = false;
    menuSpeechActive = false;
    currentMenuNarration = null;
    await speakMenuPrompt();
}

async function speakPhoneticThenReturn(){
    if (!window.speakText) return;
    currentMenuNarration = 'phonetic';
    menuSpeechActive = true;
    window.ttsGateBypass = true; // let the player say "stop" while this is read out
    await speakText(MENU_PHONETIC_TEXT);
    window.ttsGateBypass = false;
    menuSpeechActive = false;
    currentMenuNarration = null;
    await speakMenuPrompt();
}

function stopMenuVoice(){
    window.ttsGateBypass = false;
    if (window.stopSpeakText) window.stopSpeakText();
    menuSpeechActive = false;
    currentMenuNarration = null;
}

async function handleMenuSpeechTranscript(event){
    if (!event || !event.detail) return;
    const transcript = event.detail.text || '';
    const interim = !!event.detail.interim;
    if (interim) return;

    const isStop = getStopCommand(transcript);
    const command = getMenuCommand(transcript);

    if (currentMenuNarration === 'guide' || currentMenuNarration === 'phonetic'){
        if (isStop){
            stopMenuVoice();
            setTimeout(() => {
                speakMenuPrompt().then(() => {
                    if (window.startListening) startListening();
                });
            }, 1000);
            return;
        }
        return; // ignore other commands while narration is playing
    }

    if (menuSpeechActive) return;
    if (!command) return;

    if (command === 'start'){
        if (window.logActivity){
            window.logActivity('menu_command', { command: 'start' });
        }

        if (menuSpeechTranscriptHandler){
            document.removeEventListener('speechTranscript', menuSpeechTranscriptHandler);
            menuSpeechTranscriptHandler = null;
        }
        stopMenuVoice();
        if (window.levelManager && window.levelManager.whenReady){
            await window.levelManager.whenReady();
        }
        loadGameplay();
        return;
    }

    if (command === 'guide'){
        if (window.logActivity){
            window.logActivity('menu_command', { command: 'guide' });
        }
        stopMenuVoice();
        speakGuideThenReturn();
        return;
    }

    if (command === 'phonetic'){
        if (window.logActivity){
            window.logActivity('menu_command', { command: 'phonetic' });
        }
        stopMenuVoice();
        speakPhoneticThenReturn();
        return;
    }
}

function startMenuVoiceListener(){
    if (!window.initializeSpeechRecognition || !window.startListening) return;
    initializeSpeechRecognition();
    if (menuSpeechTranscriptHandler){
        document.removeEventListener('speechTranscript', menuSpeechTranscriptHandler);
    }
    menuSpeechTranscriptHandler = handleMenuSpeechTranscript;
    document.addEventListener('speechTranscript', menuSpeechTranscriptHandler);
}

function loadMenu(){

    changeScreen(createMenu());
    if (window.logActivity){
        window.logActivity('menu_screen_viewed', { screen: 'menu' });
    }

    if (window.initializeSpeechRecognition && window.startListening){
        initializeSpeechRecognition();
        startMenuVoiceListener();
        speakMenuPrompt().then(() => {
            if (window.startListening) startListening();
        });
    } else if (window.speakText){
        speakText(MENU_VOICE_PROMPT);
    }
}

window.loadMenu = loadMenu;