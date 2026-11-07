// =====================================
// Results Screen
// =====================================

function createResultsScreen(score, lives, levelName){
    const hearts = getHeartIcons(Math.max(0, lives));
    const heartsLost = Math.max(0, 3 - Math.max(0, lives));
    const performance = heartsLost === 0 ? 'Perfect' : 'Nice';
    const trophies = heartsLost === 0 ? 3 : 2;
    let trophyIcons = '';
    for(let i = 0; i < trophies; i++){
        trophyIcons += `<img src="assets/ui/trophy.png" class="trophy-icon" alt="trophy">`;
    }
    return `

    <section id="results-screen" class="screen">

        <h1 id="results-title">VICTORY</h1>

        <div class="results-row">
            <div class="results-label">Score:</div>
            <div class="results-value">${score}</div>
        </div>

        <div class="results-row">
            <div class="results-label">Mistakes:</div>
            <div class="results-value">${heartsLost}</div>
        </div>

        <div class="results-row">
            <div class="results-label">Hearts Remaining:</div>
            <div class="results-value">${hearts}</div>
        </div>

        <div class="results-row trophies-row">
            <div class="results-value">${trophyIcons} ${performance}</div>
        </div>

        <p id="results-prompt">SAY PROCEED TO CONTINUE TO ${levelName}</p>

    </section>

    `;
}

function createCompletionScreen(){
    return `

    <section id="completion-screen" class="screen">

        <h1 id="completion-title">CONGRATULATIONS</h1>

        <img src="assets/ui/trophy.png" id="completion-trophy" alt="trophy">

        <p id="completion-message">You completed all levels.</p>

        <p id="completion-prompt">Say EXIT to leave the game.</p>

    </section>

    `;
}

function loadCompletion(){
    if(window.stopSpeakText) window.stopSpeakText();
    if(window.stopListening) window.stopListening();
    if(window.unloadGameplayVoiceListener) window.unloadGameplayVoiceListener();
    if(window.logProgress){
        window.logProgress(window.levelManager.currentLevelId, window.levelManager.currentWaveId, 'completed');
    }
    if(window.logActivity){
        window.logActivity('game_completed', {
            level: window.levelManager.currentLevelId,
            wave: window.levelManager.currentWaveId,
            score: gameState.score,
            lives: gameState.lives
        });
    }
    changeScreen(createCompletionScreen());

    if(window.audioManager && window.audioManager.play){
        try{ window.audioManager.play('congrats'); }catch(e){}
    }

    if(window.speakText){
        speakText('Congratulations. You completed all levels. Say exit to leave the game.');
    }

    function handleCompletionSpeechTranscript(event){
        const transcript = event && event.detail && event.detail.text ? event.detail.text.toLowerCase().trim() : '';
        const interim = event && event.detail ? !!event.detail.interim : false;
        if(interim) return;
        if(transcript.includes('exit')){
            if(window.stopSpeakText) window.stopSpeakText();
            if(window.stopListening) window.stopListening();
            if(window.audioManager && window.audioManager.stop) window.audioManager.stop();
            if(resultsSpeechTranscriptHandler){
                document.removeEventListener('speechTranscript', resultsSpeechTranscriptHandler);
                resultsSpeechTranscriptHandler = null;
            }
            // Back to level 1 with a brand-new set of levels from the server.
            if(window.levelManager && window.levelManager.resetRun){
                window.levelManager.resetRun();
            } else if(window.levelManager && window.levelManager.setLevel){
                window.levelManager.setLevel(1, 1);
            }
            if(window.audioManager && window.audioManager.play){
                try{ window.audioManager.play('menu'); }catch(e){}
            }
            if(window.loadMenu) window.loadMenu();
        }
    }

    let resultsSpeechTranscriptHandler = null;
    if(window.initializeSpeechRecognition && window.startListening){
        initializeSpeechRecognition();
        startListening();
        resultsSpeechTranscriptHandler = handleCompletionSpeechTranscript;
        document.addEventListener('speechTranscript', resultsSpeechTranscriptHandler);
    }
}

function playFinalExplosionThenComplete(){
    if(window.stopSpeakText) window.stopSpeakText();
    if(window.stopListening) window.stopListening();
    if(window.unloadGameplayVoiceListener) window.unloadGameplayVoiceListener();
    if(window.audioManager && window.audioManager.stop){
        try{ window.audioManager.stop(); }catch(e){}
    }

    changeScreen(`
        <section id="final-explosion-screen" class="screen">
            <video id="final-explosion-video" autoplay playsinline preload="auto">
                <source src="assets/backgrounds/explode.mp4" type="video/mp4">
            </video>
        </section>
    `);

    const video = document.getElementById('final-explosion-video');
    if(video){
        video.addEventListener('ended', () => {
            loadCompletion();
        }, { once: true });
        video.play().catch(() => {
            setTimeout(loadCompletion, 1200);
        });
    } else {
        loadCompletion();
    }
}

function loadResults(){
    if(!window.levelManager.hasNextLevel()){
        playFinalExplosionThenComplete();
        return;
    }

    if(window.stopSpeakText) window.stopSpeakText();
    if(window.unloadGameplayVoiceListener) window.unloadGameplayVoiceListener();
    
    const levelName = `LEVEL ${window.levelManager.currentLevelId + 1}`;
    const score = gameState.score;
    const lives = gameState.lives;
    const heartsLost = Math.max(0, 3 - Math.max(0, lives));

    changeScreen(createResultsScreen(score, lives, levelName));

    if(window.audioManager && window.audioManager.play){
        try{ window.audioManager.play('victory'); }catch(e){}
    }
    if(window.speakText){
        const performance = heartsLost === 0 ? 'Perfect' : 'Nice';
        speakText(`LEVEL COMPLETE. SCORE ${score}. MISTAKES ${heartsLost}. HEARTS REMAINING ${lives}. PERFORMANCE ${performance}. SAY PROCEED TO CONTINUE TO ${levelName}.`);
    }

    function handleResultsSpeechTranscript(event){
        const transcript = event && event.detail && event.detail.text ? event.detail.text.toLowerCase().trim() : '';
        const interim = event && event.detail ? !!event.detail.interim : false;
        if(interim) return;
        if(transcript.includes('proceed')){
            if(window.stopSpeakText) window.stopSpeakText();
            if(window.stopListening) window.stopListening();
            if(window.levelManager.nextLevel()){
                if(resultsSpeechTranscriptHandler){
                    document.removeEventListener('speechTranscript', resultsSpeechTranscriptHandler);
                    resultsSpeechTranscriptHandler = null;
                }
                loadGameplay();
            }
        }
    }

    let resultsSpeechTranscriptHandler = null;
    if(window.initializeSpeechRecognition && window.startListening){
        initializeSpeechRecognition();
        startListening();
        resultsSpeechTranscriptHandler = handleResultsSpeechTranscript;
        document.addEventListener('speechTranscript', resultsSpeechTranscriptHandler);
    }
}

window.loadCompletion = loadCompletion;
window.loadResults = loadResults;
