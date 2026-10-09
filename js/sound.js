/* Tiny 8-bit style sound effects generated with the Web Audio API (no audio files). */
window.RetroSound = (function () {
    'use strict';
    const STORAGE_KEY = 'battleship.sound';
    let ctx = null;
    let enabled = true;
    try { enabled = localStorage.getItem(STORAGE_KEY) !== 'off'; } catch (e) { /* storage unavailable */ }

    function audio() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function tone(c, freq, dur, opts) {
        const o = opts || {};
        const t = c.currentTime + (o.when || 0);
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = o.type || 'square';
        osc.frequency.setValueAtTime(freq, t);
        if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
        gain.gain.setValueAtTime(o.vol || 0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(c.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    function noise(c, dur, opts) {
        const o = opts || {};
        const t = c.currentTime + (o.when || 0);
        const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = c.createBufferSource();
        const gain = c.createGain();
        src.buffer = buffer;
        gain.gain.setValueAtTime(o.vol || 0.12, t);
        src.connect(gain).connect(c.destination);
        src.start(t);
    }

    const effects = {
        click: c => tone(c, 660, 0.04, { vol: 0.03 }),
        place: c => tone(c, 520, 0.07, { slideTo: 780 }),
        error: c => tone(c, 110, 0.18, { type: 'sawtooth', vol: 0.05 }),
        miss: c => tone(c, 420, 0.22, { type: 'triangle', slideTo: 90, vol: 0.09 }),
        hit: c => { noise(c, 0.3); tone(c, 180, 0.25, { slideTo: 50 }); },
        sunk: c => {
            noise(c, 0.5, { vol: 0.15 });
            [392, 330, 262, 196].forEach((f, i) => tone(c, f, 0.14, { when: 0.1 + i * 0.12 }));
        },
        win: c => [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(c, f, 0.16, { when: i * 0.11 })),
        lose: c => [392, 370, 349, 330, 196].forEach((f, i) => tone(c, f, 0.3, { when: i * 0.22, type: 'triangle', vol: 0.09 }))
    };

    return {
        play(name) {
            if (!enabled || !effects[name]) return;
            try {
                const c = audio();
                if (c) effects[name](c);
            } catch (e) { /* audio is optional */ }
        },
        isEnabled() { return enabled; },
        setEnabled(value) {
            enabled = !!value;
            try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
        }
    };
})();
