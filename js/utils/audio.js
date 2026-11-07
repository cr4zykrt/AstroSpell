// Audio manager supporting menu/loading/intro and gameplay tracks
(function(){
    const tracks = {
        menu: {
            src: 'assets/sounds/music/bgmusic.m4a',
            audio: null
        },
        game: {
            src: 'assets/sounds/music/gamemusic.m4a',
            audio: null
        },
        boss: {
            src: 'assets/sounds/music/boss.mp3',
            audio: null
        },
        victory: {
            src: 'assets/sounds/effects/victory.mp3',
            audio: null
        },
        gameover: {
            src: 'assets/sounds/effects/gameover.mp3',
            audio: null
        },
        congrats: {
            src: 'assets/sounds/music/congrats.mp3',
            audio: null
        }
    };

    Object.keys(tracks).forEach(key=>{
        const a = new Audio(tracks[key].src);
        // victory, gameover, and congrats should play once, not loop
        a.loop = (key === 'victory' || key === 'gameover' || key === 'congrats') ? false : true;
        a.preload = 'auto';
        a.volume = 0.6;
        tracks[key].audio = a;
    });

    let current = null;
    let pending = null;

    function _playTrack(name){
        if(!tracks[name]) return Promise.reject(new Error('unknown track'));
        if(current && current !== tracks[name].audio){
            try { current.pause(); } catch(e){}
            try { current.currentTime = 0; } catch(e){}
        }
        current = tracks[name].audio;
        return current.play();
    }

    function play(name){
        pending = name;
        const p = _playTrack(name);
        if(p && p.catch){
            return p.catch(()=>{
                if(name === 'victory' || name === 'gameover'){
                    console.warn(`Track '${name}' failed to play; falling back to 'game'.`);
                    return _playTrack('game').catch(()=>{});
                }
                // autoplay blocked — wait for user gesture
                return new Promise((resolve)=>{
                    const onGesture = ()=>{
                        _playTrack(name).then(()=>{
                            window.removeEventListener('click', onGesture);
                            window.removeEventListener('keydown', onGesture);
                            pending = null;
                            resolve();
                        }).catch(()=>{});
                    };
                    window.addEventListener('click', onGesture);
                    window.addEventListener('keydown', onGesture);
                });
            });
        }
        return p;
    }

    function pause(){ if(current) current.pause(); }
    function stop(){ if(current){ current.pause(); try{ current.currentTime = 0; }catch(e){} } current = null; }
    function setVolume(v){ Object.values(tracks).forEach(t=> t.audio.volume = Math.max(0, Math.min(1, v))); }
    function currentTrack(){
        if(!current) return null;
        return Object.keys(tracks).find(k=> tracks[k].audio === current) || null;
    }
    function playEffect(src){
        return new Promise((resolve) => {
            try {
                const effect = new Audio(src);
                effect.volume = 0.8;
                effect.addEventListener('ended', () => resolve());
                effect.addEventListener('error', () => resolve());
                const p = effect.play();
                if(p && p.catch){ p.catch(()=> resolve()); }
            } catch (e) {
                resolve();
            }
        });
    }

    window.audioManager = {
        play,
        pause,
        stop,
        setVolume,
        currentTrack,
        playEffect
    };

})();
