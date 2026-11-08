// =====================================
// Audio manager
// =====================================
// Sound effects and the short music loops are decoded ONCE into memory and played with the
// Web Audio API. Compared with creating a new <audio> element for every sound, this means:
//   - effects play instantly (nothing is downloaded or decoded at the moment of the shot)
//   - many effects can overlap without cutting each other off
//   - music loops without a gap
//   - the phone's media-pause behaviour for <audio> elements (which can hit whenever the
//     microphone / speech service starts listening) no longer pauses the music
// If a file cannot be decoded, that one sound quietly falls back to a normal <audio> element.
//
// Public API (unchanged, plus playSfx): play(name), stop(), pause(), setVolume(v),
// currentTrack(), playEffect(src), playSfx(name), debug()

(function () {
    'use strict';

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    // Music and "jingle" tracks. `streamed` tracks are too long to keep in memory (3.5 minutes).
    const TRACKS = {
        menu:     { src: 'assets/sounds/music/bgmusic.m4a',    loop: true },
        game:     { src: 'assets/sounds/music/gamemusic.m4a',  loop: true },
        boss:     { src: 'assets/sounds/music/boss.mp3',       loop: true },
        victory:  { src: 'assets/sounds/effects/victory.mp3',  loop: false },
        gameover: { src: 'assets/sounds/effects/gameover.mp3', loop: false },
        congrats: { src: 'assets/sounds/music/congrats.mp3',   loop: false, streamed: true }
    };

    // Short sound effects.
    const EFFECTS = {
        explosion: { src: 'assets/sounds/effects/explosion.m4a', volume: 0.8 },
        enemyhit:  { src: 'assets/sounds/effects/enemyhit.mp3',  volume: 0.7 }
    };

    let musicVolume = 0.25;
    let ctx = null;
    const buffers = {};   // name -> decoded AudioBuffer
    const failed = {};    // name -> true when this browser could not decode the file
    const htmlAudio = {}; // name -> <audio> element (fallback / streamed tracks)

    let current = null;   // { name, kind: 'web' | 'html', source, gain, element }
    let wanted = null;    // the track the game wants right now (starts as soon as it is ready)

    try {
        if (AudioContextClass) ctx = new AudioContextClass({ latencyHint: 'interactive' });
    } catch (e) {
        ctx = null;
    }

    // ---------- loading ----------
    function decode(arrayBuffer) {
        return new Promise((resolve, reject) => ctx.decodeAudioData(arrayBuffer, resolve, reject));
    }

    function load(name, src, onDone) {
        if (!ctx) { failed[name] = true; if (onDone) onDone(name); return; }
        fetch(src)
            .then((response) => {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.arrayBuffer();
            })
            .then(decode)
            .then((buffer) => {
                buffers[name] = buffer;
                if (onDone) onDone(name);
            })
            .catch((error) => {
                failed[name] = true;
                console.warn(`Audio "${name}" could not be decoded, using a normal audio element instead:`, error && error.message);
                if (onDone) onDone(name);
            });
    }

    // The game asked for this track while it was still loading: start it now.
    function onTrackLoaded(name) {
        if (wanted === name && !current) startTrack(name);
    }

    Object.keys(TRACKS).forEach((name) => {
        if (!TRACKS[name].streamed) load(name, TRACKS[name].src, onTrackLoaded);
    });
    Object.keys(EFFECTS).forEach((name) => load(name, EFFECTS[name].src));

    // ---------- browsers only let sound start after a tap / key press ----------
    function unlock() {
        if (ctx && ctx.state !== 'running') {
            try { ctx.resume().catch(() => {}); } catch (e) {}
        }
    }
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach((type) => {
        window.addEventListener(type, unlock, { passive: true });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) unlock(); });
    // The speech service can interrupt audio on phones; make sure sound comes back afterwards.
    document.addEventListener('speechRecognitionEnd', unlock);
    document.addEventListener('speechRecognitionStart', unlock);

    // ---------- music ----------
    function getHtml(name) {
        if (!htmlAudio[name]) {
            const a = new Audio(TRACKS[name].src);
            a.loop = !!TRACKS[name].loop;
            a.preload = TRACKS[name].streamed ? 'none' : 'auto';
            htmlAudio[name] = a;
        }
        htmlAudio[name].volume = musicVolume;
        return htmlAudio[name];
    }

    function startHtml(name) {
        const element = getHtml(name);
        current = { name, kind: 'html', element };
        const attempt = () => element.play();

        let p;
        try { p = attempt(); } catch (e) { p = Promise.reject(e); }
        if (p && p.catch) {
            return p.catch(() => {
                // autoplay blocked: try again on the first tap / key press
                return new Promise((resolve) => {
                    const types = ['pointerdown', 'touchend', 'click', 'keydown'];
                    const cleanup = () => types.forEach((t) => window.removeEventListener(t, onGesture));
                    const onGesture = () => {
                        if (wanted !== name) { cleanup(); resolve(); return; }
                        try {
                            const retry = attempt();
                            (retry && retry.then ? retry : Promise.resolve())
                                .then(() => { cleanup(); resolve(); })
                                .catch(() => {});
                        } catch (e) {}
                    };
                    types.forEach((t) => window.addEventListener(t, onGesture));
                });
            });
        }
        return Promise.resolve();
    }

    function startWeb(name) {
        const track = TRACKS[name];
        const source = ctx.createBufferSource();
        source.buffer = buffers[name];
        source.loop = !!track.loop;
        const gain = ctx.createGain();
        gain.gain.value = musicVolume;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.onended = () => {
            if (current && current.source === source) current = null;
        };
        // If the context is still locked, this starts the moment it is unlocked.
        source.start(0);
        current = { name, kind: 'web', source, gain };
        unlock();
        return Promise.resolve();
    }

    function startTrack(name) {
        const track = TRACKS[name];
        if (!track) return Promise.reject(new Error('unknown track'));
        if (!track.streamed && ctx && buffers[name]) return startWeb(name);
        if (track.streamed || failed[name] || !ctx) return startHtml(name);
        return Promise.resolve(); // still decoding; onTrackLoaded() starts it
    }

    function stopCurrent() {
        if (!current) return;
        const old = current;
        current = null;
        if (old.kind === 'web') {
            try { old.source.onended = null; old.source.stop(); } catch (e) {}
            try { old.source.disconnect(); old.gain.disconnect(); } catch (e) {}
        } else if (old.element) {
            try { old.element.pause(); } catch (e) {}
            try { old.element.currentTime = 0; } catch (e) {}
        }
    }

    function play(name) {
        if (!TRACKS[name]) return Promise.reject(new Error('unknown track'));
        wanted = name;
        stopCurrent();
        return startTrack(name);
    }

    function stop() {
        wanted = null;
        stopCurrent();
    }

    function pause() {
        stop();
    }

    function setVolume(v) {
        musicVolume = Math.max(0, Math.min(1, v));
        if (current && current.kind === 'web') current.gain.gain.value = musicVolume;
        Object.keys(htmlAudio).forEach((name) => { htmlAudio[name].volume = musicVolume; });
    }

    function currentTrack() {
        return current ? current.name : null;
    }

    // ---------- sound effects ----------
    function playSfx(name) {
        const effect = EFFECTS[name];
        if (!effect) return;

        if (ctx && buffers[name]) {
            try {
                const source = ctx.createBufferSource();
                source.buffer = buffers[name];
                const gain = ctx.createGain();
                gain.gain.value = effect.volume;
                source.connect(gain);
                gain.connect(ctx.destination);
                source.start(0);
                if (ctx.state !== 'running') unlock();
                return;
            } catch (e) { /* fall through to the audio element */ }
        }

        // Not decoded yet (or this browser could not decode it): ordinary audio element.
        try {
            const element = new Audio(effect.src);
            element.volume = effect.volume;
            const p = element.play();
            if (p && p.catch) p.catch(() => {});
        } catch (e) {}
    }

    // Generic one-off effect by file path (kept for compatibility).
    function playEffect(src) {
        return new Promise((resolve) => {
            try {
                const effect = new Audio(src);
                effect.volume = 0.8;
                effect.addEventListener('ended', () => resolve());
                effect.addEventListener('error', () => resolve());
                const p = effect.play();
                if (p && p.catch) p.catch(() => resolve());
            } catch (e) {
                resolve();
            }
        });
    }

    // Handy in the browser console: audioManager.debug()
    function debug() {
        return {
            contextState: ctx ? ctx.state : 'no Web Audio support',
            decoded: Object.keys(buffers),
            fellBackToAudioElement: Object.keys(failed),
            playing: currentTrack(),
            wanted
        };
    }

    window.audioManager = { play, pause, stop, setVolume, currentTrack, playEffect, playSfx, debug };
})();
