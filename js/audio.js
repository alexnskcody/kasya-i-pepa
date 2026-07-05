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
      // пул фолбэка разблокируется строго внутри жеста
      if (this.fallback && this._fbUnlock) this._fbUnlock();
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

    /* ═══ Фолбэк без Web Audio (например, iOS Lockdown Mode):
       звуки рендерятся математикой в WAV и играются пулом <audio>. ═══ */
    _installFallback() {
      this.fallback = true;
      const RATE = 16000;

      // кусочно-линейная огибающая [[t,v],...]
      const seg = (pts, t) => {
        if (t <= pts[0][0]) return pts[0][1];
        for (let i = 1; i < pts.length; i++) {
          if (t <= pts[i][0]) {
            const a = pts[i - 1], b = pts[i];
            return a[1] + (b[1] - a[1]) * ((t - a[0]) / Math.max(1e-6, b[0] - a[0]));
          }
        }
        return pts[pts.length - 1][1];
      };
      const buf = (dur) => new Float32Array(Math.max(1, Math.round(dur * RATE)));

      const tone = (out, o) => {
        let ph = 0;
        const off = Math.round((o.at || 0) * RATE);
        for (let i = 0; i + off < out.length; i++) {
          const t = i / RATE;
          const fr = seg(o.f, t) * (1 + (o.vib || 0) * Math.sin(2 * Math.PI * (o.vibHz || 6) * t));
          ph += fr / RATE;
          const p = ph - Math.floor(ph);
          const w = o.wave === 'saw' ? 2 * p - 1
            : o.wave === 'square' ? (p < 0.5 ? 1 : -1)
            : o.wave === 'triangle' ? (p < 0.5 ? 4 * p - 1 : 3 - 4 * p)
            : Math.sin(2 * Math.PI * ph);
          out[i + off] += w * seg(o.a, t);
        }
      };

      // шум через грубый резонансный полосовой фильтр
      const noise = (out, o) => {
        let lp1 = 0, lp2 = 0;
        const off = Math.round((o.at || 0) * RATE);
        for (let i = 0; i + off < out.length; i++) {
          const t = i / RATE;
          const k = Math.min(0.95, (seg(o.f, t) / RATE) * 6.28);
          const w = Math.random() * 2 - 1;
          lp1 += k * (w - lp1);
          lp2 += k * 0.35 * (lp1 - lp2);
          out[i + off] += (lp1 - lp2) * 3 * seg(o.a, t);
        }
      };

      /* рецепты (та же палитра, что в WebAudio-версии) */
      const meow = (fs, dur, amp, wave) => () => {
        const o = buf(dur);
        const f = fs.map((x, i) => [dur * i / (fs.length - 1), x]);
        tone(o, { wave: wave || 'saw', vib: 0.02, f, a: [[0, 0], [0.04, amp], [dur * 0.6, amp], [dur, 0]] });
        tone(o, { wave: 'triangle', f: f.map(p => [p[0], p[1] * 2]), a: [[0, 0], [0.04, amp * 0.35], [dur, 0]] });
        return o;
      };
      const R = {
        meow: meow([520, 760, 700, 480], 0.5, 0.26),
        mew: meow([640, 900, 820], 0.22, 0.2),
        angry: meow([430, 380, 330, 240], 0.42, 0.27),
        squeak: meow([880, 1240, 990], 0.16, 0.18),
        whine: () => { const o = buf(0.9); tone(o, { f: [[0, 620], [0.4, 1050], [0.85, 560]], a: [[0, 0], [0.15, 0.11], [0.6, 0.11], [0.9, 0]], vib: 0.012 }); return o; },
        snort: () => { const o = buf(0.16); noise(o, { f: [[0, 900], [0.16, 200]], a: [[0, 0], [0.01, 0.26], [0.16, 0]] }); return o; },
        pant: () => { const o = buf(0.3); noise(o, { f: [[0, 1400], [0.12, 900]], a: [[0, 0], [0.01, 0.09], [0.12, 0]] }); noise(o, { at: 0.18, f: [[0, 1100], [0.12, 800]], a: [[0, 0], [0.01, 0.08], [0.12, 0]] }); return o; },
        boing: () => { const o = buf(0.28); tone(o, { wave: 'triangle', f: [[0, 340], [0.24, 72]], a: [[0, 0], [0.01, 0.3], [0.26, 0]] }); tone(o, { f: [[0, 1300], [0.1, 340]], a: [[0, 0], [0.008, 0.14], [0.12, 0]] }); return o; },
        step: () => { const o = buf(0.05); noise(o, { f: [[0, 1600], [0.05, 1800]], a: [[0, 0], [0.005, 0.05], [0.045, 0]] }); return o; },
        crunch: () => { const o = buf(0.45); for (let i = 0; i < 3; i++) noise(o, { at: i * 0.13, f: [[0, 950], [0.06, 500]], a: [[0, 0], [0.008, 0.18], [0.06, 0]] }); return o; },
        lap: () => { const o = buf(0.5); for (let i = 0; i < 3; i++) { noise(o, { at: i * 0.15, f: [[0, 2100], [0.05, 1300]], a: [[0, 0], [0.008, 0.07], [0.05, 0]] }); tone(o, { at: i * 0.15 + 0.015, f: [[0, 760], [0.05, 430]], a: [[0, 0], [0.008, 0.045], [0.05, 0]] }); } return o; },
        nibble: () => { const o = buf(0.28); for (let i = 0; i < 2; i++) noise(o, { at: i * 0.16, f: [[0, 1400], [0.05, 800]], a: [[0, 0], [0.008, 0.09], [0.05, 0]] }); return o; },
        pop: () => { const o = buf(0.1); tone(o, { f: [[0, 520], [0.08, 90]], a: [[0, 0], [0.006, 0.24], [0.09, 0]] }); return o; },
        whoosh: () => { const o = buf(0.3); noise(o, { f: [[0, 350], [0.3, 2600]], a: [[0, 0], [0.05, 0.16], [0.3, 0]] }); return o; },
        snore: () => { const o = buf(1.6); tone(o, { f: [[0, 64], [0.5, 88], [1, 60]], a: [[0, 0], [0.4, 0.12], [1, 0]] }); noise(o, { at: 1.15, f: [[0, 600], [0.4, 250]], a: [[0, 0], [0.05, 0.05], [0.4, 0]] }); return o; },
        tweet: () => { const o = buf(0.34); [0, 0.14, 0.24].forEach((dt, i) => tone(o, { at: dt, f: [[0, 2300 + i * 300], [0.06, 3100 + i * 200]], a: [[0, 0], [0.01, 0.04], [0.07, 0]] })); return o; },
        rattle: () => { const o = buf(0.45); for (let i = 0; i < 5; i++) noise(o, { at: i * 0.07, f: [[0, 500 + Math.random() * 1500], [0.05, 400]], a: [[0, 0], [0.006, 0.12], [0.05, 0]] }); return o; },
        purr: () => {
          const o = buf(1.6);
          noise(o, { f: [[0, 420], [1.6, 420]], a: [[0, 0], [0.05, 0.16], [1.55, 0.16], [1.6, 0]] });
          for (let i = 0; i < o.length; i++) {
            const t = i / RATE;
            o[i] *= 0.55 + 0.45 * Math.sin(2 * Math.PI * 23 * t);
          }
          return o;
        },
      };
      const chimeR = (notes) => () => {
        const o = buf(0.6 + notes.length * 0.07);
        notes.forEach((fq, i) => {
          tone(o, { at: i * 0.07, f: [[0, fq]], a: [[0, 0], [0.01, 0.13], [0.5, 0]] });
          tone(o, { at: i * 0.07, f: [[0, fq * 2.01]], a: [[0, 0], [0.01, 0.045], [0.25, 0]] });
        });
        return o;
      };
      const barkR = (n, hi) => () => {
        const p = hi ? 1.22 : 1;
        const o = buf(0.14 + (n - 1) * 0.17);
        for (let i = 0; i < n; i++) {
          noise(o, { at: i * 0.17, f: [[0, 800 * p], [0.09, 350 * p]], a: [[0, 0], [0.008, 0.34], [0.09, 0]] });
          tone(o, { wave: 'square', at: i * 0.17, f: [[0, 175 * p], [0.1, 88 * p]], a: [[0, 0], [0.012, 0.24], [0.1, 0]] });
        }
        return o;
      };

      /* ── аудио-спрайт: ВСЕ звуки в одном файле, src никогда не меняется.
         iOS сбрасывает разблокировку <audio> при смене src — поэтому
         элементы разблокируются сразу со спрайтом и потом только
         перематываются. data:-URI выбран потому, что тихий data:-луп
         доказанно играет даже в Lockdown Mode. ── */
      const fanfareR = () => {
        const o = buf(1.2);
        [523, 659, 784, 1046, 784, 1046].forEach((fq, i) =>
          tone(o, { wave: 'triangle', at: i * 0.11, f: [[0, fq]], a: [[0, 0], [0.015, 0.18], [0.22, 0]] }));
        noise(o, { at: 0.5, f: [[0, 3000], [0.5, 6000]], a: [[0, 0], [0.05, 0.05], [0.5, 0]] });
        [1568, 2093, 2637].forEach((fq, i) =>
          tone(o, { at: 0.55 + i * 0.07, f: [[0, fq]], a: [[0, 0], [0.01, 0.12], [0.5, 0]] }));
        return o;
      };
      const DEFS = [
        ['meow', R.meow], ['mew', R.mew], ['angry', R.angry], ['squeak', R.squeak],
        ['whine', R.whine], ['snort', R.snort], ['pant', R.pant], ['boing', R.boing],
        ['step', R.step], ['crunch', R.crunch], ['lap', R.lap], ['nibble', R.nibble],
        ['pop', R.pop], ['whoosh', R.whoosh], ['snore', R.snore], ['tweet', R.tweet],
        ['rattle', R.rattle], ['purr', R.purr],
        ['bark1l', barkR(1, false)], ['bark1h', barkR(1, true)],
        ['bark2l', barkR(2, false)], ['bark2h', barkR(2, true)],
        ['chime_std', chimeR([1046, 1318, 1568])],
        ['chime_hello', chimeR([1046, 1568])],
        ['chime_mode', chimeR([784, 988])],
        ['chime_win', chimeR([1568, 2093, 2637])],
        ['fanfare', fanfareR],
      ];
      const GAP = 0.3;
      this._offsets = null;
      this._spriteURI = null;
      const buildSprite = () => {
        if (this._spriteURI) return;
        const parts = DEFS.map((d) => [d[0], d[1]()]);
        let total = Math.round(0.1 * RATE);
        parts.forEach((p) => { total += p[1].length + Math.round(GAP * RATE); });
        const all = new Float32Array(total);
        const offs = {};
        let pos = Math.round(0.05 * RATE);
        parts.forEach((p) => {
          all.set(p[1], pos);
          offs[p[0]] = [pos / RATE, p[1].length / RATE];
          pos += p[1].length + Math.round(GAP * RATE);
        });
        const n = all.length;
        const b = new ArrayBuffer(44 + n * 2);
        const v = new DataView(b);
        const wr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        wr(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true);
        v.setUint16(32, 2, true); v.setUint16(34, 16, true);
        wr(36, 'data'); v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) {
          const s = Math.max(-1, Math.min(1, all[i] * 0.85));
          v.setInt16(44 + i * 2, s * 32767, true);
        }
        const u8 = new Uint8Array(b);
        let bin = '';
        for (let i = 0; i < u8.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        }
        this._spriteURI = 'data:audio/wav;base64,' + btoa(bin);
        this._offsets = offs;
      };

      this._pool = [];
      this._fbUnlock = () => {
        if (this._pool.length) return;
        try { buildSprite(); } catch (e) { this._fbErr = 'build:' + e.message; return; }
        for (let i = 0; i < 5; i++) {
          const a = document.createElement('audio');
          a.setAttribute('playsinline', '');
          a.setAttribute('webkit-playsinline', '');
          a.preload = 'auto';
          a.src = this._spriteURI;
          const p = a.play(); // в жесте: элемент разблокируется сразу со спрайтом
          if (p && p.then) {
            p.then(() => { if (!a._ready) { a._ready = true; a.pause(); } })
              .catch((e) => { this._fbErr = 'unlock:' + (e && e.name); });
          }
          this._pool.push(a);
        }
        if (!this._hello) {
          this._hello = true;
          setTimeout(() => this.chime([1046, 1568]), 400);
        }
      };

      const play = (name) => {
        if (this.muted || !this._pool.length || !this._offsets) return null;
        const seg = this._offsets[name];
        if (!seg) return null;
        const a = this._pool.find((x) => x.paused && x !== this._purrEl);
        if (!a) return null;
        try {
          clearTimeout(a._stopT);
          a.currentTime = seg[0];
          const p = a.play();
          if (p && p.catch) p.catch((e) => { this._fbErr = 'play:' + (e && e.name); });
          a._stopT = setTimeout(() => { try { a.pause(); } catch (e2) {} }, seg[1] * 1000 + 80);
        } catch (e) {
          this._fbErr = 'seek:' + e.message;
          return null;
        }
        return a;
      };

      /* подмена публичных методов */
      this.meow = (kind) => { play(kind && ['mew', 'angry', 'squeak'].indexOf(kind) >= 0 ? kind : 'meow'); };
      this.bark = (n, pitch) => { play('bark' + (n === 2 ? 2 : 1) + ((pitch || 1) > 1.12 ? 'h' : 'l')); };
      this.whine = () => play('whine');
      this.snort = () => play('snort');
      this.pant = () => play('pant');
      this.boing = () => play('boing');
      this.step = () => play('step');
      this.crunch = () => play('crunch');
      this.lap = () => play('lap');
      this.nibble = () => play('nibble');
      this.pop = () => play('pop');
      this.whoosh = () => play('whoosh');
      this.snore = () => play('snore');
      this.tweet = () => play('tweet');
      this.rattle = () => play('rattle');
      this.chime = (notes) => {
        const f = (notes && notes[0]) || 1046;
        play(f < 900 ? 'chime_mode' : f > 1400 ? 'chime_win'
          : (notes && notes.length === 2 ? 'chime_hello' : 'chime_std'));
      };
      this.fanfare = () => play('fanfare');
      this.purrStart = () => {
        if (this._purrOn || !this._offsets) return;
        const seg = this._offsets.purr;
        const a = this._pool.find((x) => x.paused);
        if (!seg || !a) return;
        this._purrOn = true;
        this._purrEl = a;
        const cycle = () => {
          if (!this._purrOn) return;
          try {
            a.currentTime = seg[0];
            const p = a.play();
            if (p && p.catch) p.catch(() => {});
          } catch (e) { /* пропустим цикл */ }
        };
        cycle();
        this._purrIv = setInterval(cycle, (seg[1] - 0.12) * 1000);
      };
      this.purrStop = () => {
        this._purrOn = false;
        clearInterval(this._purrIv);
        if (this._purrEl) { try { this._purrEl.pause(); } catch (e) {} this._purrEl = null; }
      };
      this.resume = () => {};
    },

    init() {
      if (this.ctx || this.fallback) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        // Lockdown Mode / нет Web Audio: рендерим звуки в WAV сами
        this._installFallback();
        return;
      }
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
        AC: ('AudioContext' in window) || ('webkitAudioContext' in window),
        fb: this.fallback
          ? ('pool:' + (this._pool ? this._pool.length : 0) +
            ' спрайт:' + (this._spriteURI ? Math.round(this._spriteURI.length / 1024) + 'КБ' : 'нет') +
            (this._fbErr ? ' ERR:' + this._fbErr : ''))
          : 'выкл',
      };
    },

    setMuted(m) {
      this.muted = m;
      localStorage.setItem('mp_muted', m ? '1' : '0');
      if (this.master) this.master.gain.value = m ? 0 : 0.85;
      if (m && this.fallback) this.purrStop();
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
