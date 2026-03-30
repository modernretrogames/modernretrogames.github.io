export class AudioManager {
    constructor() {
        this.ctx = null;
        this.volume = 0.5;
        this.enabled = true;
    }

    _ensureContext() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    play(soundName, options = {}) {
        if (!this.enabled) return;
        this._ensureContext();

        switch (soundName) {
            case 'fire': this._playFire(options); break;
            case 'explosion': this._playExplosion(options); break;
            case 'hit': this._playHit(options); break;
            case 'laser': this._playLaser(options); break;
            case 'alienLaser': this._playAlienLaser(options); break;
            case 'alienDeath': this._playAlienDeath(options); break;
            case 'powerup': this._playPowerup(options); break;
            case 'playerDeath': this._playPlayerDeath(options); break;
            case 'waveStart': this._playWaveStart(options); break;
            case 'missileLaunch': this._playMissileLaunch(options); break;
            case 'interceptDetonate': this._playInterceptDetonate(options); break;
            case 'warheadIncoming': this._playWarheadIncoming(options); break;
            case 'cityDestroyed': this._playCityDestroyed(options); break;
            case 'multiKill': this._playMultiKill(options); break;
        }
    }

    _playFire(options) {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const duration = 0.3;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200 * (options.pitch || 1), now);
        osc.frequency.exponentialRampToValueAtTime(60, now + duration);
        gain.gain.setValueAtTime(this.volume * 0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);

        const noise = this._createNoise(duration * 0.5);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(this.volume * 0.2, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.5);
        noise.connect(noiseGain).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + duration * 0.5);
    }

    _playExplosion(options) {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const radius = options.radius || 3;
        const duration = 0.3 + radius * 0.05;
        const baseFreq = Math.max(40, 120 - radius * 8);

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + duration);
        gain.gain.setValueAtTime(this.volume * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);

        const noise = this._createNoise(duration);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(this.volume * 0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        noise.connect(noiseGain).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + duration);
    }

    _playHit(options) {
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
        gain.gain.setValueAtTime(this.volume * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    _playLaser() {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
        gain.gain.setValueAtTime(this.volume * 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
    }

    _playAlienLaser() {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
        gain.gain.setValueAtTime(this.volume * 0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    _playAlienDeath() {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
        gain.gain.setValueAtTime(this.volume * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);

        const noise = this._createNoise(0.15);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(this.volume * 0.15, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        noise.connect(ng).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.15);
    }

    _playPowerup() {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            const t = now + i * 0.06;
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(this.volume * 0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.15);
        });
    }

    _playPlayerDeath() {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);
        gain.gain.setValueAtTime(this.volume * 0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);

        const noise = this._createNoise(0.4);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(this.volume * 0.3, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        noise.connect(ng).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.4);
    }

    _playWaveStart() {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const notes = [392, 523, 659, 784];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            const t = now + i * 0.1;
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(this.volume * 0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.25);
        });
    }

    _playMissileLaunch() {
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.4);
        gain.gain.setValueAtTime(this.volume * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(this.volume * 0.15, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);

        const noise = this._createNoise(0.3);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(this.volume * 0.25, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        noise.connect(ng).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.3);
    }

    _playInterceptDetonate() {
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(300, now);
        osc1.frequency.exponentialRampToValueAtTime(80, now + 0.4);
        gain1.gain.setValueAtTime(this.volume * 0.4, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc1.connect(gain1).connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.4);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(600, now);
        osc2.frequency.exponentialRampToValueAtTime(150, now + 0.3);
        gain2.gain.setValueAtTime(this.volume * 0.2, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc2.connect(gain2).connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.3);

        const noise = this._createNoise(0.35);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(this.volume * 0.3, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        noise.connect(ng).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.35);
    }

    _playWarheadIncoming() {
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.6);
        gain.gain.setValueAtTime(this.volume * 0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
    }

    _playCityDestroyed() {
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.8);
        gain.gain.setValueAtTime(this.volume * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.8);

        const noise = this._createNoise(0.6);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(this.volume * 0.4, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        noise.connect(ng).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.6);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(80, now + 0.1);
        osc2.frequency.exponentialRampToValueAtTime(25, now + 0.9);
        gain2.gain.setValueAtTime(this.volume * 0.25, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        osc2.connect(gain2).connect(ctx.destination);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.9);
    }

    _playMultiKill() {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const notes = [659, 784, 988, 1175];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            const t = now + i * 0.05;
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(this.volume * 0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.12);
        });
    }

    _createNoise(duration) {
        const ctx = this.ctx;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        return source;
    }
}
