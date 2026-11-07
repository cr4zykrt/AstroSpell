// =====================================
// Loading Screen
// =====================================

function createLoadingScreen(){

    return `

    <section
        id="loading-screen"
        class="screen">

        <video id="loading-video" autoplay muted loop playsinline preload="auto" aria-hidden="true">
            <source src="assets/backgrounds/loading.mp4" type="video/mp4">
        </video>

        <div id="loading-exhaust" aria-hidden="true"></div>
        <div id="loading-spaceship" aria-hidden="true"></div>

        <p id="loading-subtitle">

            Voice-Controlled Educational Space Shooter

        </p>

        <div id="loading-bar">
            <div id="loading-fill"></div>
        </div>

        <p id="loading-percent">

            0%

        </p>

    </section>

    `;

}

function loadLoadingScreen(){

    changeScreen(createLoadingScreen());

    let progress = 0;

    const fill = document.getElementById("loading-fill");
    const percent = document.getElementById("loading-percent");
    const exhaustContainer = document.getElementById('loading-exhaust');

    // Lightweight exhaust particle system (behind the ship)
    let _exhaustParticles = [];
    let _exhaustRAF = null;
    let _lastExhaustTime = performance.now();
    let _spawnAcc = 0;
    // Long comet-like trail config: more particles, longer life, higher spawn rate
    const EXHAUST_MAX = 1400;
    const EXHAUST_BASE_RATE = 220; // particles/sec
    const EXHAUST_TTL = 6800; // ms — long-lived particles for extended tail
    const STREAK_CHANCE = 0.14; // chance to spawn a long streak per particle spawn
    const STREAK_TTL = 12000; // ms for long streaks

    function getNozzlePos(){
        const ship = document.getElementById('loading-spaceship');
        const screen = document.getElementById('loading-screen');
        if(!ship || !screen) return {x: window.innerWidth*0.15, y: window.innerHeight*0.5};
        const s = ship.getBoundingClientRect();
        const c = screen.getBoundingClientRect();
        // nozzle at right side (since ship points right)
        const x = s.right - c.left - 6;
        const y = s.top - c.top + s.height * 0.52;
        return {x, y};
    }

    function spawnExhaust(x,y,thrust){
        if(!exhaustContainer) return;
        if(_exhaustParticles.length >= EXHAUST_MAX) return;
        const el = document.createElement('div');
        el.className = 'exhaust-particle';
        const base = 6 + Math.random()*10;
        const size = base + thrust * 14;
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.left = (x - size/2) + 'px';
        el.style.top = (y - size/2) + 'px';
        el.style.opacity = '1';
        el.style.transform = 'translateZ(0)';
        exhaustContainer.appendChild(el);

        const angle = Math.PI + (Math.random()-0.5)*0.9; // emit backwards
        const speed = 0.2 + Math.random()*1.2 + thrust*1.6;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed + 0.2;
        const ttl = EXHAUST_TTL + Math.random()*1200;

        _exhaustParticles.push({el, x, y, vx, vy, life:0, ttl, size, type: 'plasma'});

        // Occasionally spawn drifting dust to extend the tail
        if(Math.random() < 0.32){
            spawnDust(x, y);
        }

        // occasionally spawn long streaks that form the comet tail
        if(Math.random() < STREAK_CHANCE){
            spawnStreak(x, y, thrust, angle);
        }
    }

    function spawnStreak(x,y,thrust,angle){
        if(!exhaustContainer) return;
        if(_exhaustParticles.length >= EXHAUST_MAX) return;
        // compute streak length relative to ship size (4-6x ship height)
        const ship = document.getElementById('loading-spaceship');
        const srect = ship ? ship.getBoundingClientRect() : {height: 120};
        const baseLen = Math.max(220, srect.height * (4 + Math.random()*2));

        // create layered streak elements: core, feather, vapor
        const core = document.createElement('div');
        core.className = 'exhaust-streak exhaust-streak-core exhaust-pulse';
        const feather = document.createElement('div');
        feather.className = 'exhaust-streak exhaust-streak-feather';
        const vapor = document.createElement('div');
        vapor.className = 'exhaust-streak exhaust-streak-vapor streak-motion-blur';

        const thickness = 6 + Math.random()*10;
        const coreLen = baseLen * (0.85 + Math.random()*0.2);
        const featherLen = baseLen * (0.95 + Math.random()*0.25);
        const vaporLen = baseLen * (1.05 + Math.random()*0.4);

        [core, feather, vapor].forEach((el, idx) => {
            let w = thickness * (1 - idx*0.15);
            let h = [coreLen, featherLen, vaporLen][idx];
            el.style.width = (w) + 'px';
            el.style.height = (h) + 'px';
            el.style.left = (x - w/2) + 'px';
            el.style.top = (y - 6) + 'px';
            el.style.opacity = (1 - idx*0.12).toString();
            const jitter = (Math.random()-0.5)*6;
            const deg = (angle * 180/Math.PI) + 90 + jitter;
            el.style.transform = `translateZ(0) rotate(${deg}deg)`;
            exhaustContainer.appendChild(el);
        });

        // tiny wisps that detach
        const wispCount = Math.random() < 0.55 ? 1 + Math.floor(Math.random()*3) : 0;
        const wisps = [];
        for(let i=0;i<wispCount;i++){
            const w = document.createElement('div');
            w.className = 'exhaust-wisp';
            const sz = 4 + Math.random()*8;
            w.style.width = sz + 'px';
            w.style.height = sz + 'px';
            w.style.left = (x + (Math.random()-0.3)*18) + 'px';
            w.style.top = (y + (Math.random()-0.3)*18) + 'px';
            w.style.opacity = '0.95';
            exhaustContainer.appendChild(w);
            wisps.push(w);
        }

        // add to particle list as a grouped streak entry
        const speed = 0.05 + Math.random()*0.3 + thrust*0.35;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const ttl = STREAK_TTL + Math.random()*4000;
        _exhaustParticles.push({el: core, x, y, vx, vy, life:0, ttl, size: coreLen, type:'streak', parts: {core, feather, vapor, wisps}});
    }

    function spawnDust(x,y){
        if(!exhaustContainer) return;
        if(_exhaustParticles.length >= EXHAUST_MAX) return;
        const d = document.createElement('div');
        d.className = 'exhaust-dust';
        const sz = 4 + Math.random()*8;
        d.style.width = sz + 'px';
        d.style.height = sz + 'px';
        d.style.left = (x - sz/2) + 'px';
        d.style.top = (y - sz/2) + 'px';
        d.style.opacity = '0.9';
        exhaustContainer.appendChild(d);

        // dust drifts slower and lives longer
        const angle = Math.PI + (Math.random()-0.5)*1.6;
        const speed = 0.1 + Math.random()*0.6;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed + 0.1;
        const ttl = 2800 + Math.random()*2200;
        _exhaustParticles.push({el: d, x, y, vx, vy, life:0, ttl, size: sz, type: 'dust'});
    }

    function updateExhaust(dt){
        const t = performance.now()/1000;
        const thrustPulse = (Math.sin(t*6)+1)/2*0.6 + 0.4; // 0.4-1.0
        const spawnRate = EXHAUST_BASE_RATE * (0.5 + thrustPulse*0.8);
        _spawnAcc += spawnRate * dt/1000;
        const nozzle = getNozzlePos();
        while(_spawnAcc > 1){
            spawnExhaust(nozzle.x + (Math.random()-0.5)*6, nozzle.y + (Math.random()-0.5)*6, thrustPulse);
            _spawnAcc -= 1;
        }

        for(let i=_exhaustParticles.length-1;i>=0;i--){
            const p = _exhaustParticles[i];
            p.life += dt;
            // turbulence
            // turbulence scaled by particle type
            if(p.type === 'plasma'){
                // stronger turbulence and movement for long tail
                p.vx += (Math.random()-0.5)*0.14;
                p.vy += 0.06 + (Math.random()-0.5)*0.06;
                p.x += p.vx * dt * 1.2;
                p.y += p.vy * dt * 1.2;
                const r = p.life / p.ttl;
                const scale = 1 + r*3.4; // grow to form wispy extended tail
                const opacity = Math.max(0, 1 - r*0.6); // fade gradually
                p.el.style.left = (p.x - p.size*scale/2) + 'px';
                p.el.style.top = (p.y - p.size*scale/2) + 'px';
                p.el.style.transform = `scale(${scale}) rotate(${(p.vx*50).toFixed(2)}deg)`;
                p.el.style.opacity = (opacity*0.95).toString();
                p.el.style.filter = `blur(${Math.min(20, r*18)}px)`;
            } else if(p.type === 'dust'){
                // dust drifts out slowly to extend the tail
                p.vx += (Math.random()-0.5)*0.04;
                p.vy += (Math.random()-0.5)*0.04 + 0.02;
                p.x += p.vx * dt * 0.9;
                p.y += p.vy * dt * 0.9;
                const r = p.life / p.ttl;
                const scale = 1 + r*1.8;
                const opacity = Math.max(0, 0.95 - r*0.5);
                p.el.style.left = (p.x - p.size*scale/2) + 'px';
                p.el.style.top = (p.y - p.size*scale/2) + 'px';
                p.el.style.transform = `scale(${scale})`;
                p.el.style.opacity = (opacity).toString();
                p.el.style.filter = `blur(${Math.min(10, r*10)}px)`;
            } else if(p.type === 'streak'){
                // streak slowly drifts and fades, stretching into the tail
                p.vx += (Math.random()-0.5)*0.03;
                p.vy += (Math.random()-0.5)*0.03 + 0.01;
                p.x += p.vx * dt * 0.6;
                p.y += p.vy * dt * 0.6;
                const r = p.life / p.ttl;
                const opacity = Math.max(0, 0.98 - r*0.72);
                const lenScale = Math.max(0.55, 1 - r*0.28);
                // update core, feather, vapor positions
                try{
                    const parts = p.parts;
                    if(parts){
                        const core = parts.core;
                        const feather = parts.feather;
                        const vapor = parts.vapor;
                        const wisps = parts.wisps || [];
                        const baseLeft = (p.x - (parseFloat(core.style.width)||6)/2);
                        const baseTop = (p.y - 6);
                        const angleDeg = (Math.atan2(p.vy,p.vx)*180/Math.PI)+90;
                        core.style.left = baseLeft + 'px';
                        core.style.top = baseTop + 'px';
                        core.style.transform = `translateZ(0) rotate(${angleDeg}deg) scaleY(${lenScale})`;
                        core.style.opacity = (opacity).toString();

                        feather.style.left = (baseLeft - 2) + 'px';
                        feather.style.top = (baseTop + 2) + 'px';
                        feather.style.transform = `translateZ(0) rotate(${angleDeg + (Math.random()-0.5)*6}deg) scaleY(${Math.max(0.6,lenScale*0.96)})`;
                        feather.style.opacity = (opacity*0.85).toString();

                        vapor.style.left = (baseLeft - 4) + 'px';
                        vapor.style.top = (baseTop + 6) + 'px';
                        vapor.style.transform = `translateZ(0) rotate(${angleDeg + (Math.random()-0.5)*10}deg) scaleY(${Math.max(0.5,lenScale*0.9)})`;
                        vapor.style.opacity = (opacity*0.7).toString();

                        // update wisps to detach and swirl
                        for(let wi=wisps.length-1;wi>=0;wi--){
                            const w = wisps[wi];
                            if(!w) continue;
                            // small orbiting motion
                            const ox = Math.cos((p.life/600)+wi) * (8 + wi*4);
                            const oy = Math.sin((p.life/700)+wi) * (6 + wi*3);
                            w.style.left = (p.x + ox + (Math.random()-0.5)*2) + 'px';
                            w.style.top = (p.y + oy + (Math.random()-0.5)*2) + 'px';
                            w.style.opacity = Math.max(0, 0.95 - r*0.9 - wi*0.08).toString();
                            // gradually scale down
                            w.style.transform = `scale(${Math.max(0.3, 1 - r*0.6)})`;
                        }
                    }
                }catch(e){}
                // subtle extra blur as it ages
                if(p.parts && p.parts.core){
                    p.parts.core.style.filter = `blur(${Math.min(24, r*18)}px)`;
                }
            }
            if(p.life >= p.ttl){
                // smooth fade-out to avoid popping; mark parts to fade and remove after transition
                try{
                    if(p.parts){
                        const parts = p.parts;
                        [parts.core, parts.feather, parts.vapor].forEach(pe=>{ if(pe){ pe.classList.add('exhaust-fade-out'); }});
                        (parts.wisps||[]).forEach(w=>{ if(w){ w.classList.add('exhaust-fade-out'); } });
                        // schedule removal after fade transition (match CSS 1200ms)
                        setTimeout(()=>{
                            try{ if(parts.core) parts.core.remove(); }catch(e){}
                            try{ if(parts.feather) parts.feather.remove(); }catch(e){}
                            try{ if(parts.vapor) parts.vapor.remove(); }catch(e){}
                            try{ (parts.wisps||[]).forEach(w=>{ if(w) w.remove(); }); }catch(e){}
                        }, 1300);
                    } else {
                        try{ p.el.remove(); }catch(e){}
                    }
                }catch(e){}
                _exhaustParticles.splice(i,1);
            }
        }
    }

    let _exhaustErrors = 0;
    function _exhaustLoop(now){
        const dt = Math.min(40, now - _lastExhaustTime);
        _lastExhaustTime = now;
        try{
            updateExhaust(dt);
        }catch(e){
            // a decorative effect must never break loading
            if(++_exhaustErrors >= 3){
                console.warn('Exhaust effect disabled after repeated errors:', e);
                _exhaustRAF = null;
                return;
            }
        }
        _exhaustRAF = requestAnimationFrame(_exhaustLoop);
    }

    function startLoadingExhaust(){
        if(!exhaustContainer) return;
        _lastExhaustTime = performance.now();
        _spawnAcc = 0;
        if(_exhaustRAF) cancelAnimationFrame(_exhaustRAF);
        _exhaustRAF = requestAnimationFrame(_exhaustLoop);
    }

    function stopLoadingExhaust(){
        if(_exhaustRAF) cancelAnimationFrame(_exhaustRAF);
        _exhaustRAF = null;
        _exhaustParticles.forEach(p=>{ try{ p.el.remove(); }catch(e){} });
        _exhaustParticles = [];
        if(exhaustContainer) exhaustContainer.innerHTML = '';
    }

    // The exhaust trail must start AFTER the variables above are declared
    // (starting it earlier threw an error that was silently swallowed).

    // ---- Load the levels from the API while the bar fills ----
    let levelsReady = false;

    function showLoadError(message){
        const screen = document.getElementById('loading-screen');
        if(!screen) return;
        let el = document.getElementById('loading-error');
        if(!el){
            el = document.createElement('p');
            el.id = 'loading-error';
            el.setAttribute('role', 'alert');
            screen.appendChild(el);
        }
        el.textContent = message;
    }

    function clearLoadError(){
        const el = document.getElementById('loading-error');
        if(el) el.remove();
    }

    async function fetchLevelsWithRetry(){
        // keep trying every 3 seconds until the server answers (or the screen is gone)
        while(document.getElementById('loading-screen')){
            try{
                await window.levelManager.loadLevels();
                levelsReady = true;
                clearLoadError();
                return;
            }catch(error){
                console.warn('Could not load levels:', error);
                showLoadError('CANNOT REACH THE GAME SERVER. RETRYING...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
    fetchLevelsWithRetry();

    // The bar fills to 90% on its own, then waits for the levels before finishing.
    const timer = setInterval(()=>{

        const cap = levelsReady ? 100 : 90;
        if(progress < cap) progress++;

        fill.style.width = progress + "%";
        percent.textContent = progress + "%";

        if(progress >= 100){
            clearInterval(timer);
            setTimeout(goToMenu, 400);
        }

    },20);

    // Browsers only allow sound and speech after the player has pressed a key or tapped.
    // So we ask for that here, then start the menu music and voice.
    function goToMenu(){
        try{ stopLoadingExhaust(); }catch(e){}
        if(window.audioManager && window.audioManager.play){
            try{ window.audioManager.play('menu'); }catch(e){}
        }
        loadMenu();
    }

}
