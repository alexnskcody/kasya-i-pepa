/* ═══ Snd — синтезатор звуков на Web Audio (без файлов) ═══ */
(function () {
  const Snd = {
    ctx: null,
    master: null,
    muted: localStorage.getItem('mp_muted') === '1',
    _noiseBuf: null,
    _purr: null,

    /* iOS: WebAudio глушится переключателем беззвучного режима, пока
       аудиосессия в категории ambient. Зацикленный беззвучный <audio>
       переводит её в playback — звук работает даже с выключенным звонком. */
    _silentURI() {
      const rate = 8000, n = 6400; // ~0.8 c тишины — короткие лупы iOS может игнорировать
      const buf = new ArrayBuffer(44 + n * 2);
      const v = new DataView(buf);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      w(36, 'data'); v.setUint32(40, n * 2, true);
      let bin = '';
      const u8 = new Uint8Array(buf);
      for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
      return 'data:audio/wav;base64,' + btoa(bin);
    },

    unlock() {
      // iOS 17+: официальный способ не глохнуть от беззвучного переключателя
      try {
        if (navigator.audioSession && navigator.audioSession.type !== 'playback') {
          navigator.audioSession.type = 'playback';
        }
      } catch (e) { /* нет API — ниже фолбэк */ }
      if (!this._unlockEl) {
        const a = document.createElement('audio');
        a.setAttribute('playsinline', '');
        a.setAttribute('webkit-playsinline', '');
        a.loop = true;
        a.preload = 'auto';
        a.src = this._silentURI();
        a.style.display = 'none';
        if (document.body) document.body.appendChild(a);
        this._unlockEl = a;
      }
      // важно: сработает только внутри события с активацией (touchend/click)
      if (this._unlockEl.paused) {
        const p = this._unlockEl.play();
        if (p && p.catch) p.catch(() => {});
      }
      // классический «пинок» WebAudio пустым буфером внутри жеста
      if (this.ctx && !this._kicked) {
        try {
          const b = this.ctx.createBuffer(1, 1, 22050);
          const s = this.ctx.createBufferSource();
          s.buffer = b;
          s.connect(this.ctx.destination);
          s.start(0);
          this._kicked = true;
        } catch (e) { /* не критично */ }
      }
    },

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.2;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this._noiseBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        // розовато-коричневый шум — мягче белого
        const w = Math.random() * 2 - 1;
        last = (last + 0.04 * w) / 1.04;
        d[i] = last * 4.4;
      }
    },

    resume() {
      // iOS может перевести контекст и в 'interrupted'
      if (!this.ctx) return;
      if (this.ctx.state !== 'running') {
        const p = this.ctx.resume();
        if (p && p.then) {
          p.then(() => {
            // первый успешный запуск — короткий сигнал «звук включился»
            if (!this._hello) { this._hello = true; this.chime([1046, 1568]); }
          }).catch(() => {});
        }
      } else if (!this._hello) {
        this._hello = true;
      }
    },

    state() {
      return {
        ctx: this.ctx ? this.ctx.state : 'none',
        time: this.ctx ? this.ctx.currentTime.toFixed(1) : '-',
        rate: this.ctx ? this.ctx.sampleRate : '-',
        loop: this._unlockEl ? (this._unlockEl.paused ? 'paused' : 'PLAYING') : 'none',
        kick: !!this._kicked,
        session: (navigator.audioSession && navigator.audioSession.type) || 'нет API',
        muted: this.muted,
      };
    },

    setMuted(m) {
      this.muted = m;
      localStorage.setItem('mp_muted', m ? '1' : '0');
      if (this.master) this.master.gain.value = m ? 0 : 0.85;
    },

    _t() { return this.ctx.currentTime; },

    _env(gainNode, t0, a, peak, d, sustain = 0) {
      const g = gainNode.gain;
      g.setValueAtTime(0.0001, t0);
      g.linearRampToValueAtTime(peak, t0 + a);
      g.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + a + d);
    },

    _osc(type, freqPlan, t0, dur, gainPlan, dest) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      freqPlan(o.frequency, t0);
      gainPlan(g.gain, t0);
      o.connect(g).connect(dest || this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
      return { o, g };
    },

    _noise(t0, dur, filterType, f0, f1, peak, q = 1) {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      src.loop = true;
      const flt = this.ctx.createBiquadFilter();
      flt.type = filterType;
      flt.Q.value = q;
      flt.frequency.setValueAtTime(f0, t0);
      flt.frequency.exponentialRampToValueAtTime(Math.max(f1, 30), t0 + dur);
      const g = this.ctx.createGain();
      this._env(g, t0, 0.01, peak, dur - 0.01);
      src.connect(flt).connect(g).connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    },

    /* ── КОТ ── */
    meow(kind = 'meow') {
      if (!this.ctx) return;
      const t0 = this._t();
      const plans = {
        meow: { f: [520, 760, 700, 480], dur: 0.5, peak: 0.22 },
        mew: { f: [640, 900, 820], dur: 0.22, peak: 0.18 },
        angry: { f: [430, 380, 330, 240], dur: 0.42, peak: 0.24 },
        squeak: { f: [880, 1240, 990], dur: 0.16, peak: 0.16 },
      };
      const p = plans[kind] || plans.meow;
      const mkFreq = (mult) => (fp, t) => {
        fp.setValueAtTime(p.f[0] * mult, t);
        const step = p.dur / (p.f.length - 1);
        p.f.forEach((f, i) => { if (i) fp.exponentialRampToValueAtTime(f * mult, t + step * i); });
      };
      const mkGain = (peak) => (gp, t) => {
        gp.setValueAtTime(0.0001, t);
        gp.linearRampToValueAtTime(peak, t + 0.04);
        gp.setValueAtTime(peak, t + p.dur * 0.6);
        gp.exponentialRampToValueAtTime(0.0001, t + p.dur);
      };
      const band = this.ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 1.4;
      band.frequency.setValueAtTime(900, t0);
      band.frequency.exponentialRampToValueAtTime(650, t0 + p.dur);
      band.connect(this.master);
      this._osc('sawtooth', mkFreq(1), t0, p.dur, mkGain(p.peak), band);
      this._osc('sawtooth', mkFreq(1.006), t0, p.dur, mkGain(p.peak * 0.6), band);
      this._osc('triangle', mkFreq(2), t0, p.dur, mkGain(p.peak * 0.35), band);
    },

    purrStart() {
      if (!this.ctx || this._purr) return;
      const t0 = this._t();
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      src.loop = true;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = 420;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.16, t0 + 0.25);
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 23;
      const lfoG = this.ctx.createGain();
      lfoG.gain.value = 0.11;
      lfo.connect(lfoG).connect(g.gain);
      src.connect(flt).connect(g).connect(this.master);
      src.start(t0); lfo.start(t0);
      this._purr = { src, lfo, g };
    },

    purrStop() {
      if (!this._purr) return;
      const { src, lfo, g } = this._purr;
      const t0 = this._t();
      g.gain.cancelScheduledValues(t0);
      g.gain.setValueAtTime(g.gain.value, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      src.stop(t0 + 0.35); lfo.stop(t0 + 0.35);
      this._purr = null;
    },

    /* ── ПЁС ── */
    bark(n = 1, pitch = 1) {
      if (!this.ctx) return;
      for (let i = 0; i < n; i++) {
        const t0 = this._t() + i * 0.17;
        this._noise(t0, 0.09, 'bandpass', 800 * pitch, 350 * pitch, 0.3, 0.8);
        this._osc('square',
          (fp, t) => { fp.setValueAtTime(175 * pitch, t); fp.exponentialRampToValueAtTime(88 * pitch, t + 0.1); },
          t0, 0.1,
          (gp, t) => { gp.setValueAtTime(0.0001, t); gp.linearRampToValueAtTime(0.22, t + 0.012); gp.exponentialRampToValueAtTime(0.0001, t + 0.1); });
      }
    },

    whine() {
      if (!this.ctx) return;
      const t0 = this._t();
      this._osc('sine',
        (fp, t) => {
          fp.setValueAtTime(620, t);
          fp.linearRampToValueAtTime(1050, t + 0.4);
          fp.linearRampToValueAtTime(560, t + 0.85);
        },
        t0, 0.9,
        (gp, t) => {
          gp.setValueAtTime(0.0001, t);
          gp.linearRampToValueAtTime(0.09, t + 0.15);
          gp.setValueAtTime(0.09, t + 0.6);
          gp.exponentialRampToValueAtTime(0.0001, t + 0.9);
        });
    },

    snort() {
      if (!this.ctx) return;
      this._noise(this._t(), 0.16, 'lowpass', 900, 200, 0.22);
    },

    pant() {
      if (!this.ctx) return;
      const t0 = this._t();
      this._noise(t0, 0.12, 'bandpass', 1400, 900, 0.07, 0.5);
      this._noise(t0 + 0.18, 0.12, 'bandpass', 1100, 800, 0.06, 0.5);
    },

    /* ── ОБЩИЕ ── */
    boing() {
      if (!this.ctx) return;
      const t0 = this._t();
      this._osc('triangle',
        (fp, t) => { fp.setValueAtTime(340, t); fp.exponentialRampToValueAtTime(72, t + 0.24); },
        t0, 0.26,
        (gp, t) => { gp.setValueAtTime(0.0001, t); gp.linearRampToValueAtTime(0.26, t + 0.01); gp.exponentialRampToValueAtTime(0.0001, t + 0.26); });
      this._osc('sine',
        (fp, t) => { fp.setValueAtTime(1300, t); fp.exponentialRampToValueAtTime(340, t + 0.1); },
        t0, 0.12,
        (gp, t) => { gp.setValueAtTime(0.0001, t); gp.linearRampToValueAtTime(0.12, t + 0.008); gp.exponentialRampToValueAtTime(0.0001, t + 0.12); });
    },

    step() {
      if (!this.ctx) return;
      this._noise(this._t(), 0.045, 'highpass', 1300, 1800, 0.035);
    },

    crunch() {
      if (!this.ctx) return;
      for (let i = 0; i < 3; i++) {
        this._noise(this._t() + i * 0.13, 0.06, 'bandpass', 950, 500, 0.16, 1.2);
      }
    },

    lap() {
      if (!this.ctx) return;
      for (let i = 0; i < 3; i++) {
        const t0 = this._t() + i * 0.15;
        this._noise(t0, 0.05, 'bandpass', 2100, 1300, 0.055, 1.6);
        this._osc('sine',
          (fp, t) => { fp.setValueAtTime(760, t); fp.exponentialRampToValueAtTime(430, t + 0.05); },
          t0 + 0.015, 0.05,
          (gp, t) => { gp.setValueAtTime(0.0001, t); gp.linearRampToValueAtTime(0.035, t + 0.01); gp.exponentialRampToValueAtTime(0.0001, t + 0.05); });
      }
    },

    nibble() {
      if (!this.ctx) return;
      for (let i = 0; i < 2; i++) {
        this._noise(this._t() + i * 0.16, 0.05, 'bandpass', 1400, 800, 0.07, 1.6);
      }
    },

    pop() {
      if (!this.ctx) return;
      const t0 = this._t();
      this._osc('sine',
        (fp, t) => { fp.setValueAtTime(520, t); fp.exponentialRampToValueAtTime(90, t + 0.08); },
        t0, 0.09,
        (gp, t) => { gp.setValueAtTime(0.0001, t); gp.linearRampToValueAtTime(0.2, t + 0.006); gp.exponentialRampToValueAtTime(0.0001, t + 0.09); });
    },

    whoosh() {
      if (!this.ctx) return;
      this._noise(this._t(), 0.3, 'bandpass', 350, 2600, 0.14, 0.6);
    },

    chime(notes = [1046, 1318, 1568]) {
      if (!this.ctx) return;
      notes.forEach((f, i) => {
        const t0 = this._t() + i * 0.07;
        this._osc('sine',
          (fp, t) => fp.setValueAtTime(f, t),
          t0, 0.5,
          (gp, t) => { gp.setValueAtTime(0.0001, t); gp.linearRampToValueAtTime(0.12, t + 0.01); gp.exponentialRampToValueAtTime(0.0001, t + 0.5); });
        this._osc('sine',
          (fp, t) => fp.setValueAtTime(f * 2.01, t),
          t0, 0.25,
          (gp, t) => { gp.setValueAtTime(0.0001, t); gp.linearRampToValueAtTime(0.04, t + 0.01); gp.exponentialRampToValueAtTime(0.0001, t + 0.25); });
      });
    },

    fanfare() {
      if (!this.ctx) return;
      const seq = [523, 659, 784, 1046, 784, 1046];
      seq.forEach((f, i) => {
        const t0 = this._t() + i * 0.11;
        this._osc('triangle',
          (fp, t) => fp.setValueAtTime(f, t),
          t0, 0.22,
          (gp, t) => { gp.setValueAtTime(0.0001, t); gp.linearRampToValueAtTime(0.16, t + 0.015); gp.exponentialRampToValueAtTime(0.0001, t + 0.22); });
      });
      this._noise(this._t() + 0.5, 0.5, 'highpass', 3000, 6000, 0.05);
      this.chime([1568, 2093, 2637]);
    },

    snore() {
      if (!this.ctx) return;
      const t0 = this._t();
      this._osc('sine',
        (fp, t) => { fp.setValueAtTime(64, t); fp.linearRampToValueAtTime(88, t + 0.5); fp.linearRampToValueAtTime(60, t + 1); },
        t0, 1,
        (gp, t) => { gp.setValueAtTime(0.0001, t); gp.linearRampToValueAtTime(0.1, t + 0.4); gp.exponentialRampToValueAtTime(0.0001, t + 1); });
      this._noise(t0 + 1.15, 0.4, 'lowpass', 600, 250, 0.04);
    },

    tweet() {
      if (!this.ctx) return;
      const t0 = this._t();
      [0, 0.14, 0.24].forEach((dt, i) => {
        this._osc('sine',
          (fp, t) => { fp.setValueAtTime(2300 + i * 300, t); fp.exponentialRampToValueAtTime(3100 + i * 200, t + 0.06); },
          t0 + dt, 0.07,
          (gp, t) => { gp.setValueAtTime(0.0001, t); gp.linearRampToValueAtTime(0.035, t + 0.01); gp.exponentialRampToValueAtTime(0.0001, t + 0.07); });
      });
    },

    rattle() {
      if (!this.ctx) return;
      for (let i = 0; i < 5; i++) {
        this._noise(this._t() + i * 0.07, 0.05, 'bandpass', 500 + Math.random() * 1500, 400, 0.1, 2);
      }
    },
  };

  window.Snd = Snd;
})();
