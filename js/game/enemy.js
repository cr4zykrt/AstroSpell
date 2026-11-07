// =====================================
// Enemy System
// =====================================
let enemies = [];
let gameState = {
    currentWaveIndex: 0,
    lives: 3,
    score: 0,
    mistakes: 0,
    word: ""
};

// Spawn enemies from a word
function spawnEnemies(word){

    enemies = [];
    gameState.word = word.toUpperCase();
    gameState.currentLetterIndex = 0;

    const container = document.getElementById("enemy-container");

    container.innerHTML = "";

    const letters = word.split("");
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight;

    const yLocal = Math.max(180, Math.floor(height * 0.22));
    const yPct = Math.min(45, Math.round((yLocal / height) * 100));

    // Long words: shrink the sprites to fit and zig-zag the letters over two rows
    // so a 16-letter word does not overlap itself. Left-to-right order is unchanged.
    const slot = width / (letters.length + 1);
    const stagger = letters.length > 8;
    const size = Math.max(48, Math.min(120, stagger ? slot * 1.8 : slot * 0.95));
    container.style.setProperty('--enemy-size', Math.round(size) + 'px');

    letters.forEach((letter, index) => {
        const xPct = letters.length > 1 ? ((index + 1) / (letters.length + 1)) * 100 : 50;
        const rowOffset = stagger ? (index % 2 === 0 ? -7 : 9) : 0;
        createEnemy(letter, xPct, yPct + rowOffset);
    });

}

function createEnemy(letter, x, y){

    const container =
        document.getElementById("enemy-container");

    const enemy =
        document.createElement("div");

    enemy.className = "enemy";

    enemy.style.left = x + "%";

    enemy.style.top = y + "%";

    enemy.innerHTML = `

        <img
            src="assets/enemies/enemy.png"
            class="enemy-image">

        <span class="enemy-letter">

            ${letter.toUpperCase()}

        </span>

    `;

    container.appendChild(enemy);

    enemies.push({

        letter,

        element:enemy,

        alive:true

    });

}

function shootAtEnemy(targetElement){
    const ship = document.getElementById("player-ship");
    const gameArea = document.getElementById("game-area");
    if(!ship || !gameArea || !targetElement) return;

    const bullet = document.createElement("div");
    bullet.className = "bullet";
    gameArea.appendChild(bullet);

    const shipRect = ship.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const areaRect = gameArea.getBoundingClientRect();

    const startX = shipRect.left - areaRect.left + shipRect.width / 2 - 5;
    const startY = shipRect.top - areaRect.top + shipRect.height / 2 - 10;
    const endX = targetRect.left - areaRect.left + targetRect.width / 2 - 5;
    const endY = targetRect.top - areaRect.top + targetRect.height / 2 - 10;

    bullet.style.left = startX + "px";
    bullet.style.top = startY + "px";

    requestAnimationFrame(() => {
        bullet.style.transform = `translate(${endX - startX}px, ${endY - startY}px)`;
        bullet.style.opacity = "0";
    });

    setTimeout(() => {
        bullet.remove();
    }, 180);
}

function enemyAttackShip(sourceElement){
    const ship = document.getElementById("player-ship");
    const gameArea = document.getElementById("game-area");
    if(!ship || !gameArea || !sourceElement) return;
    // create a beam that stretches from the enemy to the ship
    const beam = document.createElement('div');
    beam.className = 'enemy-beam';
    gameArea.appendChild(beam);

    const sourceRect = sourceElement.getBoundingClientRect();
    const shipRect = ship.getBoundingClientRect();
    const areaRect = gameArea.getBoundingClientRect();
    
    // beam visual size
    const beamHeight = 6;

    // Aim from the bottom (gun) of the enemy sprite rather than its center
    const sx = sourceRect.left - areaRect.left + sourceRect.width / 2;
    // place y near bottom of the enemy element (approx. gun position)
    const sy = sourceRect.top - areaRect.top + sourceRect.height - 10;
    const tx = shipRect.left - areaRect.left + shipRect.width / 2;
    const ty = shipRect.top - areaRect.top + shipRect.height / 2;

    // defensive fallback if values are invalid
    if(!isFinite(sx) || !isFinite(sy) || !isFinite(tx) || !isFinite(ty)){
        console.warn('Invalid beam coordinates, aborting attack', {sx,sy,tx,ty, sourceRect, shipRect, areaRect});
        try{ beam.remove(); }catch(e){}
        return;
    }

    const dx = tx - sx;
    const dy = ty - sy;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    beam.style.width = length + 'px';
    beam.style.height = beamHeight + 'px';
    beam.style.left = sx + 'px';
    beam.style.top = (sy - beamHeight / 2) + 'px';
    beam.style.transform = `rotate(${angle}deg) scaleX(0)`;
    beam.style.transformOrigin = 'left center';
    beam.style.opacity = '0.0';

    // force layout then animate
    requestAnimationFrame(() => {
        beam.style.transition = 'transform 0.22s ease-out, opacity 0.22s ease-out';
        beam.style.opacity = '1';
        beam.style.transform = `rotate(${angle}deg) scaleX(1)`;
    });

    // remove beam after animation and trigger ship hit animation
    setTimeout(() => {
        try{ beam.style.opacity = '0'; }catch(e){}
        setTimeout(() => { try{ beam.remove(); }catch(e){} }, 180);
        try{
            ship.classList.add('ship-hit');
            setTimeout(()=> ship.classList.remove('ship-hit'), 360);
        }catch(e){}
        try{ playEnemyHitSound(); }catch(e){}
    }, 260);
}

function playExplosionSound(){
    try{
        const audio = new Audio('assets/sounds/effects/explosion.m4a');
        audio.volume = 0.8;
        audio.play().catch(()=>{});
    }catch(e){}
}

function playEnemyHitSound(){
    try{
        const audio = new Audio('assets/sounds/effects/enemyhit.mp3');
        audio.volume = 0.7;
        audio.play().catch(()=>{});
    }catch(e){}
}

function findAliveEnemyByLetter(letter){
    const target = enemies.find(e => e.alive && e.letter.toUpperCase() === letter.toUpperCase());
    return target || null;
}

function getNextAliveEnemy(){
    return enemies.find(e => e.alive) || null;
}

function destroyEnemy(letter, isInterim = false){
    if(gameState.lives <= 0) return false;

    const spokenLetter = letter.toUpperCase();
    const expectedLetter = gameState.word[gameState.currentLetterIndex];
    console.log('destroyEnemy called:', { spokenLetter, expectedLetter, currentIndex: gameState.currentLetterIndex });
    const targetExpected = findAliveEnemyByLetter(expectedLetter);
    const targetSpoken = findAliveEnemyByLetter(spokenLetter);
    const targetEnemy = targetExpected || targetSpoken || getNextAliveEnemy();

    // Interim transcripts should never act as final input.
    if(isInterim){
        console.log('Ignoring interim transcript for', spokenLetter);
        return false;
    }

    if(spokenLetter !== expectedLetter){
        console.log('Wrong letter: attackSource:', (targetSpoken && targetSpoken.letter) || null);
        gameState.lives--;
        gameState.mistakes++;
        const livesDisplay = document.querySelector('.lives-panel .hud-value');
        if(livesDisplay){
            livesDisplay.innerHTML = getHeartIcons(gameState.lives);
        }
        if(gameState.lives <= 0){
            try{ if(window.unloadGameplayVoiceListener) window.unloadGameplayVoiceListener(); }catch(e){}
            try{ if(window.stopListening) stopListening(); }catch(e){}
            try{ if(window.audioManager && window.audioManager.stop) window.audioManager.stop(); }catch(e){}
            try{ if(window.loadGameOver) window.loadGameOver(); }catch(e){}
            return false;
        }
        if(window.setVoiceStatus){ window.setVoiceStatus('wrong', 'WRONG'); }
        // Wrong answer: the currently expected enemy should attack, falling back to the spoken enemy or another alive enemy.
        const attackSource = targetExpected || targetSpoken || getNextAliveEnemy();
        if(attackSource && attackSource.alive){
            console.log('enemyAttackShip from:', attackSource.letter);
            enemyAttackShip(attackSource.element);
            attackSource.element.classList.add('enemy-fired');
            setTimeout(()=>{
                try{ attackSource.element.classList.remove('enemy-fired'); }catch(e){}
            }, 400);
        }
        return true;
    }

    // Correct answer: destroy the expected enemy (or fallback)
    if(!targetExpected && !targetSpoken && (!targetEnemy || !targetEnemy.alive)){
        return;
    }

    const destroyTarget = targetExpected || targetSpoken || targetEnemy;
    console.log('Correct letter: destroyTarget:', (destroyTarget && destroyTarget.letter) || null);
    if(!destroyTarget || !destroyTarget.alive) return false;

    destroyTarget.alive = false;
    gameState.currentLetterIndex++;
    gameState.score++;
    const scoreDisplay = document.querySelector('.score-panel .hud-value');
    if(scoreDisplay){
        scoreDisplay.textContent = gameState.score;
    }

    shootAtEnemy(destroyTarget.element);
    playExplosionSound();
    destroyTarget.element.innerHTML = `
        <img
            src="assets/enemies/enemyexplosion.png"
            class="enemy-image">
    `;
    destroyTarget.element.classList.add("enemy-exploded");
    setTimeout(() => {
        if(destroyTarget.element && destroyTarget.element.parentNode){
            destroyTarget.element.parentNode.removeChild(destroyTarget.element);
        }
    }, 180);

    if(window.setVoiceStatus){ window.setVoiceStatus('correct', `${spokenLetter} correct!`); }

    const remaining = enemies.filter(e => e.alive);
    if(remaining.length === 0){
        if(window.unloadGameplayVoiceListener) {
            try { window.unloadGameplayVoiceListener(); } catch(e){}
        }
        handleWaveComplete();
    }
    return true;
}

// Speak a message, then run `next` - even if speech is unavailable or fails.
function speakThen(text, next){
    if(window.speakText){
        try{
            const promise = speakText(text);
            if(promise && typeof promise.then === 'function'){
                promise.then(next).catch(next);
                return;
            }
        }catch(e){}
    }
    next();
}

function handleWaveComplete(){
    const lm = window.levelManager;
    const level = lm.getCurrentLevel();
    const wave = lm.getCurrentWave();
    if(!level || !wave) return;

    if(window.logProgress){
        window.logProgress(lm.currentLevelId, wave.id, 'completed');
    }
    if(window.logActivity){
        window.logActivity('wave_completed', { level: lm.currentLevelId, wave: wave.id, word: wave.word });
    }

    // Waves are numbered 1..n, so the next wave sits at index `currentWaveId`.
    const next = level.waves[lm.currentWaveId];

    if(!wave.isBoss && next){
        const label = next.isBoss ? 'Final wave' : 'Next wave';
        speakThen(`${label}. Spell the word ${next.word.toUpperCase()}.`, () => loadNextWave(false));
        return;
    }

    // Boss wave (or the last wave of the level) finished: show the results screen.
    setTimeout(() => {
        speakThen('BOSS WAVE COMPLETE!', () => {
            if(window.unloadGameplayVoiceListener) window.unloadGameplayVoiceListener();
            if(window.loadResults) window.loadResults();
        });
    }, 300);
}

function loadNextWave(announce = true){
    if(window.levelManager && window.levelManager.nextWave){
        window.levelManager.nextWave();
        const wave = window.levelManager.getCurrentWave ? window.levelManager.getCurrentWave() : null;
        const word = window.levelManager.getCurrentWord();
        const container = document.getElementById("enemy-container");
        if(container) container.innerHTML = "";

        // Reset word tracking for the next wave
        gameState.word = word ? word.toUpperCase() : "";
        gameState.currentLetterIndex = 0;

        spawnEnemies(word);

        // Restore gameplay speech listening for the new wave
        if(window.unloadGameplayVoiceListener){
            try { window.unloadGameplayVoiceListener(); } catch (e) {}
        }
        if(window.initializeSpeechRecognition && window.startListening){
            initializeSpeechRecognition();
            startListening();
            gameplaySpeechTranscriptHandler = handleGameplaySpeechTranscript;
            document.addEventListener('speechTranscript', gameplaySpeechTranscriptHandler);
            if(window.setVoiceStatus) window.setVoiceStatus('listening', 'Listening...');
        }

        if(window.audioManager && window.audioManager.play){
            try{
                const musicTrack = wave && wave.isBoss ? 'boss' : 'game';
                window.audioManager.play(musicTrack);
            }catch(e){}
        }
        if(wave && window.logProgress){
            window.logProgress(window.levelManager.currentLevelId, wave.id, 'started');
        }
        if(announce && window.speakText){
            speakText(`SPELL THE WORD ${word}`);
        }
    }
}

