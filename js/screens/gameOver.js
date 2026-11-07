
function createGameOverScreen(){
	const hearts = '<img src="assets/ui/emptyheart.png" class="heart-icon" alt="heart"><img src="assets/ui/emptyheart.png" class="heart-icon" alt="heart"><img src="assets/ui/emptyheart.png" class="heart-icon" alt="heart">';
	return `
	<section id="gameover-screen" class="screen" style="background: url('assets/backgrounds/bg.jpeg') center center / cover no-repeat;">
		<h1 id="gameover-title">GAME OVER</h1>

		<div class="results-row">
			<div class="results-label">Score:</div>
			<div class="results-value">${gameState.score || 0}</div>
		</div>

		<div class="results-row">
			<div class="results-label">Hearts Lost:</div>
			<div class="results-value">${hearts}</div>
		</div>

		<div class="results-row">
			<div class="results-label">Mistakes:</div>
			<div class="results-value">${gameState.mistakes || 0}</div>
		</div>

		<p id="gameover-prompt">SAY RETRY TO TRY AGAIN</p>
	</section>
	`;
}

function loadGameOver(){
	if(window.stopSpeakText) window.stopSpeakText();
	if(window.logProgress){
		window.logProgress(window.levelManager.currentLevelId, window.levelManager.currentWaveId, 'failed');
	}
	if(window.logActivity){
		window.logActivity('game_over', {
			level: window.levelManager.currentLevelId,
			wave: window.levelManager.currentWaveId,
			score: gameState.score,
			mistakes: gameState.mistakes,
			lives: gameState.lives
		});
	}
	changeScreen(createGameOverScreen());

	// speak the game over prompt and stats
if(window.audioManager && window.audioManager.play){
        try{ window.audioManager.play('gameover'); }catch(e){}
    }
    if(window.speakText){
		const score = gameState.score || 0;
		const heartsLost = Math.max(0, 3 - Math.max(0, gameState.lives));
		const mistakes = gameState.mistakes || 0;
		speakText(`GAME OVER. SCORE ${score}. HEARTS LOST ${heartsLost}. MISTAKES ${mistakes}. SAY RETRY TO TRY AGAIN.`);
	}

	function handleGameOverSpeechTranscript(event){
		const transcript = event && event.detail && event.detail.text ? event.detail.text.toLowerCase().trim() : '';
		const interim = event && event.detail ? !!event.detail.interim : false;
		if(interim) return;
		if(transcript.includes('retry')){
			if(window.stopSpeakText) window.stopSpeakText();
			if(window.stopListening) window.stopListening();
			window.levelManager.setLevel(window.levelManager.currentLevelId, 1);
			if(gameOverSpeechTranscriptHandler){
				document.removeEventListener('speechTranscript', gameOverSpeechTranscriptHandler);
				gameOverSpeechTranscriptHandler = null;
			}
			loadGameplay();
		}
	}

	let gameOverSpeechTranscriptHandler = null;
	if(window.initializeSpeechRecognition && window.startListening){
		initializeSpeechRecognition();
		startListening();
		gameOverSpeechTranscriptHandler = handleGameOverSpeechTranscript;
		document.addEventListener('speechTranscript', gameOverSpeechTranscriptHandler);
	}
}

window.loadGameOver = loadGameOver;