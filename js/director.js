/* ═══ Director — идл-ИИ, реакции, сценарий погони, мячик, вкусняшки, дружбометр ═══ */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const TREE = { x: 780, baseY: 782, perchY: 458 };

  const Director = {
    cat: null, dog: null, world: null,
    mode: 'both',
    vr: { x0: 80, y0: 80, x1: 1120, y1: 1120 },   // видимая область (обновляет main)
    now: 0,
    chase: null,
    nextTease: 8,          // скоро после старта — сразу показать фишку
    meter: 0,
    meterCb: null,
    celebrating: false,
    _cool: {},
    _idle: {},
    _stroke: {},
    _ambientT: 12,
    ball: null,
    treat: null,
    _catBatCd: 0,
    _fetchCd: 0,

    init(opts) {
      this.cat = opts.cat;
      this.dog = opts.dog;
      this.world = opts.world;
      this.meterCb = opts.onMeter;
      this.hintCb = opts.onHint || function () {};
      this._idle[this.cat.id] = { until: 1.2, kind: null, cleanup: null };
      this._idle[this.dog.id] = { until: 2.0, kind: null, cleanup: null };
      this._makeBall();
    },

    /* ── границы пола (не заходит под панели интерфейса) ── */
    floorRect() {
      const uiBot = (this.vr.uiBot != null ? this.vr.uiBot : this.vr.y1);
      const y0 = Math.max(676, this.vr.y0 + 60);
      let y1 = Math.min(1000, this.vr.y1 - 60, uiBot - 34);
      if (y1 < y0 + 40) y1 = y0 + 40; // страховка на крошечных экранах
      return {
        x0: this.vr.x0 + 80,
        x1: this.vr.x1 - 80,
        y0, y1,
      };
    },
    randFloor(pad) {
      const f = this.floorRect();
      pad = pad || 0;
      return { x: rand(f.x0 + pad, f.x1 - pad), y: rand(f.y0, f.y1) };
    },
    clampFloor(p) {
      const f = this.floorRect();
      return { x: clamp(p.x, f.x0, f.x1), y: clamp(p.y, f.y0, f.y1) };
    },

    /* после поворота экрана возвращаем всех в видимую зону */
    refit() {
      const f = this.floorRect();
      [this.cat, this.dog].forEach((p) => {
        if (p.busy || this._climb || this._dropAnim) return;
        if (p.y > 640 && (p.x < f.x0 || p.x > f.x1 || p.y < f.y0 || p.y > f.y1)) {
          const c = this.clampFloor({ x: p.x, y: p.y });
          p.x = c.x; p.y = c.y;
          p.applyTransform();
        }
      });
      if (this.ball && !this.ball.carrier) {
        const c = this.clampFloor({ x: this.ball.x, y: this.ball.y });
        this.ball.x = c.x; this.ball.y = c.y;
        this._ballPlace();
      }
    },

    /* ═══ ГЛАВНЫЙ ТИК ═══ */
    tick(dt, pointer) {
      this.now += dt;
      this._catBatCd -= dt; this._fetchCd -= dt;

      this._tickChase(dt);
      this._tickIdle(this.cat, dt);
      this._tickIdle(this.dog, dt);
      this._tickBall(dt);
      this._tickAmbient(dt);

      // взгляды
      const pointerFresh = pointer && (this.now - pointer.t < 3);
      const dogLook = pointerFresh ? pointer : { x: 600, y: 1180 };
      const catLook = pointerFresh ? pointer :
        (Math.sin(this.now * 0.23) > 0 ? this.dog.headPoint() : null);
      this.cat.update(dt, this.cat.busy ? null : catLook);
      this.dog.update(dt, this.dog.busy ? null : dogLook);

      this._zSort();
    },

    /* ═══ ИДЛЫ ═══ */
    _tickIdle(pet, dt) {
      const st = this._idle[pet.id];
      if (pet.busy || pet.controlled) return;
      st.until -= dt;
      if (st.until > 0) return;
      this._cleanupIdle(pet);
      pet === this.cat ? this._catIdle(pet, st) : this._dogIdle(pet, st);
    },

    _cleanupIdle(pet) {
      const st = this._idle[pet.id];
      if (st.cleanup) { st.cleanup(); st.cleanup = null; }
      pet.setSleeping(false);
      pet.setPlead(false);
      pet.setTailWag(false);
    },

    _pick(list) {
      let sum = 0;
      for (const it of list) sum += it.w;
      let r = Math.random() * sum;
      for (const it of list) { r -= it.w; if (r <= 0) return it; }
      return list[0];
    },

    _sleepIdle(pet, st, dur) {
      pet.setPose('sleep');
      pet.setSleeping(true);
      st.kind = 'sleep';
      st.until = dur;
      const zzz = FX.zzzStart(() => {
        const hp = pet.headPoint();
        return { x: hp.x + 30, y: hp.y - 10 };
      });
      const snIv = setInterval(() => Snd.snore(), 3400);
      st.cleanup = () => { zzz.stop(); clearInterval(snIv); };
    },

    _catIdle(pet, st) {
      const prev = st.kind;
      const opts = [
        { k: 'sit', w: 2.4 }, { k: 'loaf', w: 1.6 }, { k: 'groom', w: 2.2 },
        { k: 'lieback', w: 2.2 }, { k: 'sleep', w: 1.3 }, { k: 'wander', w: 2.6 },
      ].filter(o => o.k !== prev);
      const k = this._pick(opts).k;
      st.kind = k;
      if (k === 'wander') {
        const p = this.randFloor(20);
        st.until = 99;
        pet.moveTo(p.x, p.y, { cb: () => { st.until = 0.3; } });
      } else if (k === 'sleep') {
        this._sleepIdle(pet, st, rand(11, 17));
      } else {
        pet.setPose(k);
        st.until = rand(4.5, 8);
        if (k === 'groom') st.until = rand(4, 6.5);
      }
    },

    _dogIdle(pet, st) {
      const prev = st.kind;
      const opts = [
        { k: 'watch', w: 3.4 }, { k: 'beg', w: 0.9 }, { k: 'sleep', w: 2.2 },
        { k: 'sniff', w: 2.4 }, { k: 'wander', w: 1.5 },
      ].filter(o => o.k !== prev);
      const k = this._pick(opts).k;
      st.kind = k;
      if (k === 'watch') {
        // сидит и смотрит на игрока просящим взглядом
        pet.setPose('sit');
        pet.setPlead(true);
        st.until = rand(6, 9.5);
        const t1 = setTimeout(() => {
          if (st.kind === 'watch') {
            Snd.whine();
            const hp = pet.headPoint();
            FX.sparkle(hp.x + 20, hp.y, 3, '#cfe8ff');
          }
        }, rand(1500, 3500));
        st.cleanup = () => clearTimeout(t1);
      } else if (k === 'beg') {
        pet.setPose('beg');
        pet.setPlead(true);
        Snd.whine();
        st.until = rand(3.5, 5.5);
      } else if (k === 'sleep') {
        this._sleepIdle(pet, st, rand(10, 16));
      } else if (k === 'sniff') {
        const p = this.randFloor(20);
        st.until = 99;
        pet.moveTo(p.x, p.y, { pose: 'sniff', cb: () => { st.until = 0.2; } });
        pet.el.classList.remove('running');
        const snIv = setInterval(() => { if (Math.random() < 0.5) Snd.snort(); }, 1700);
        st.cleanup = () => clearInterval(snIv);
      } else {
        const p = this.randFloor(20);
        st.until = 99;
        pet.moveTo(p.x, p.y, { cb: () => { st.until = 0.3; } });
      }
    },

    _wake(pet) {
      this._cleanupIdle(pet);
      this._idle[pet.id].kind = null;
      this._idle[pet.id].until = 1.2;
      pet.setPose('sit');
    },

    /* ═══ РЕАКЦИИ НА ИГРОКА ═══ */
    pokePet(pet, pt) {
      FX.ripple(pt.x, pt.y);
      if (this.chase && this.chase.phase === 'tussle') { this.tussleTap(pt); return; }
      this.addMeter('poke', 2);
      pet._pokes = (pet._pokes || []).filter(t => this.now - t < 2.4);
      pet._pokes.push(this.now);
      const spam = pet._pokes.length >= 4;

      const wasAsleep = this._idle[pet.id].kind === 'sleep' && !pet.busy && !pet.controlled;
      if (wasAsleep) {
        this._wake(pet);
        pet.hop();
        const hp = pet.headPoint();
        FX.exclaim(hp.x + 30, hp.y - 10);
        pet === this.cat ? Snd.meow('angry') : Snd.bark(1, 1.3);
        return;
      }

      pet.squash();
      if (pet === this.cat) {
        if (spam && !pet.busy && !pet.controlled) {
          pet.setEarsBack(true);
          pet.say('Мя!', 700);
          Snd.meow('angry');
          const p = this.randFloor(30);
          pet._pokes = [];
          const idle = this._idle[pet.id];
          idle.kind = 'flee'; idle.until = 99;
          pet.moveTo(p.x, p.y, { run: true, cb: () => { pet.setEarsBack(false); idle.until = 0.4; } });
        } else {
          Snd.meow(Math.random() < 0.5 ? 'mew' : 'meow');
          pet.talk(400);
          if (Math.random() < 0.45) FX.hearts(pt.x, pt.y - 20, 2);
        }
      } else {
        Snd.bark(Math.random() < 0.4 ? 2 : 1);
        pet.talk(350);
        pet.setTailWag(true);
        clearTimeout(pet._wagT);
        pet._wagT = setTimeout(() => { if (this._idle[pet.id].kind !== 'beg') pet.setTailWag(false); }, 1800);
        if (spam) {
          pet._pokes = [];
          pet._retrigger(pet.jumper, 'a-spin-happy');
          pet.setHappy(true);
          clearTimeout(pet._hapT);
          pet._hapT = setTimeout(() => pet.setHappy(false), 1600);
          FX.hearts(pt.x, pt.y - 30, 4);
          Snd.bark(2, 1.15);
        } else if (Math.random() < 0.5) {
          FX.hearts(pt.x, pt.y - 20, 2);
        }
      }
    },

    strokeStart(pet) {
      const s = this._stroke[pet.id] = this._stroke[pet.id] || {};
      s.on = true; s.acc = 0;
      pet.setPetting(true);
      if (pet === this.cat) Snd.purrStart();
      else { pet.setHappy(true); pet.setTailWag(true); }
    },
    strokeMove(pet, d, pt) {
      const s = this._stroke[pet.id];
      if (!s || !s.on) return;
      s.acc += d;
      if (s.acc > 130) {
        s.acc = 0;
        FX.hearts(pt.x, pt.y - 26, 2);
        this.addMeter('stroke', 1.5);
        if (pet === this.dog && Math.random() < 0.5) Snd.pant();
      }
    },
    strokeEnd(pet) {
      const s = this._stroke[pet.id];
      if (!s || !s.on) return;
      s.on = false;
      pet.setPetting(false);
      if (pet === this.cat) Snd.purrStop();
      else {
        pet.setHappy(false);
        if (this._idle[pet.id].kind !== 'beg') pet.setTailWag(false);
      }
    },

    /* ═══ ПОГОНЯ ═══ */
    teaseReady() {
      return !this.chase && !this.celebrating &&
        !this.cat.busy && !this.dog.busy &&
        this.treatEaterIsnt(this.cat) && this.treatEaterIsnt(this.dog);
    },
    treatEaterIsnt(pet) { return !(this.treat && this.treat.eater === pet); },

    startTease(playerIsCat) {
      if (!this.teaseReady()) return;
      this._cleanupIdle(this.cat); this._cleanupIdle(this.dog);
      this.cat.busy = true;
      this.dog.busy = this.mode !== 'dog';
      this.chase = { phase: playerIsCat ? 'bop' : 'approach', t: 0, taps: 0 };
      if (playerIsCat) {
        this._doBop();
      } else {
        const side = this.cat.x < this.dog.x ? -1 : 1;
        const goal = this.clampFloor({ x: this.dog.x + side * 118, y: this.dog.y + 4 });
        const hp = this.cat.headPoint();
        FX.bubble(hp.x, hp.y - 10, '…', 800);
        this.cat.moveTo(goal.x, goal.y, {
          pose: 'sneak',
          cb: () => { if (this.chase && this.chase.phase === 'approach') this._doBop(); },
        });
        this.cat.el.classList.remove('running');
      }
    },

    _doBop() {
      const c = this.chase; if (!c) return;
      c.phase = 'bop'; c.t = 0;
      this.cat.stopMove(); this.dog.stopMove();
      this.cat.setFacing(this.dog.x > this.cat.x ? 1 : -1);
      this.cat.setPose('bop');
      const wasAsleep = this._idle[this.dog.id].kind === 'sleep';
      setTimeout(() => {
        if (!this.chase) return;
        Snd.boing();
        const hp = this.dog.headPoint();
        FX.stars(hp.x, hp.y + 20, 5);
        FX.exclaim(hp.x + 34, hp.y - 6, '?!');
        this.cat.say('Мя!', 550);
        Snd.meow('squeak');
        if (wasAsleep) this._cleanupIdle(this.dog);
        this._idle[this.dog.id].kind = null;
        this.dog.setPose('sit');
        this.dog.hop();
        Snd.bark(1, 1.25);
      }, 300);
      setTimeout(() => { if (this.chase) this._startFlee(); }, 900);
    },

    _startFlee() {
      const c = this.chase; if (!c) return;
      c.phase = 'chase'; c.t = 0;
      c.playerCat = this.mode === 'cat';
      c.playerDog = this.mode === 'dog';
      document.getElementById('speedlines').classList.remove('hidden');
      this.cat.setEarsBack(true);
      this.dog.setTailWag(false);
      if (c.playerDog) {
        this.hintCb('Лови Касю! 🐾');
        Snd.bark(2);
      } else {
        Snd.bark(2);
      }
      if (!c.playerCat) this._fleeHop(true);
    },

    _fleeHop(first) {
      // кот-ИИ выбирает точку подальше от пса
      const c = this.chase; if (!c || c.phase !== 'chase') return;
      const f = this.floorRect();
      let best = null, bestScore = -1;
      for (let i = 0; i < 7; i++) {
        const p = { x: rand(f.x0, f.x1), y: rand(f.y0, f.y1) };
        const dDog = dist(p, this.dog);
        const dCat = dist(p, this.cat);
        const score = dDog - dCat * 0.4 + (first ? 0 : rand(0, 120));
        if (score > bestScore) { bestScore = score; best = p; }
      }
      this.cat.moveTo(best.x, best.y, { run: true, cb: () => this._fleeHop(false) });
      if (Math.random() < 0.45) { Snd.meow('mew'); }
    },

    _tickChase(dt) {
      const c = this.chase; if (!c) return;
      c.t += dt;

      if (c.phase === 'approach') {
        // в режиме пса игрок может убегать — кот перенацеливается
        if (this.mode === 'dog' && this.now - (c.appRe || 0) > 0.5) {
          c.appRe = this.now;
          const side = this.cat.x < this.dog.x ? -1 : 1;
          const goal = this.clampFloor({ x: this.dog.x + side * 118, y: this.dog.y + 4 });
          this.cat.moveTo(goal.x, goal.y, {
            pose: 'sneak',
            cb: () => {
              if (this.chase && this.chase.phase === 'approach' &&
                  dist(this.cat, this.dog) < 210) this._doBop();
            },
          });
        }
        if (c.t > 7) this._doBop();
        return;
      }

      if (c.phase === 'chase') {
        // пёс-ИИ догоняет (в режиме пса догоняет игрок сам)
        if (!c.playerDog) {
          const d = dist(this.cat, this.dog);
          this.dog.speedRun = clamp(305 + (d - 170) * 0.9, 260, 440);
          if (!this.dog.target || this.now - (c.dogRe || 0) > 0.25) {
            c.dogRe = this.now;
            const t = this.clampFloor({ x: this.cat.x, y: this.cat.y });
            this.dog.moveTo(t.x, t.y, { run: true });
          }
          if (Math.random() < dt * 0.7) Snd.bark(1, 1 + Math.random() * 0.2);
        }
        const d = dist(this.cat, this.dog);
        // игрок-кот добежал до когтеточки — спасся!
        if (c.playerCat && Math.hypot(this.cat.x - TREE.x, this.cat.y - TREE.baseY) < 100) {
          this._escape(true);
          return;
        }
        if (d < 80 && c.t > 0.8) this._startTussle();
        else if (!c.playerCat && !c.playerDog && c.t > 9) this._startTussle(); // страховка
      }

      if (c.phase === 'tussle') {
        const dur = 2.4 + Math.min(2, (c.taps || 0) * 0.18);
        if (c.t > dur) this._escape(false);
      }
    },

    _startTussle() {
      const c = this.chase; if (!c || c.phase === 'tussle') return;
      c.phase = 'tussle'; c.t = 0; c.taps = 0;
      this.cat.stopMove(); this.dog.stopMove();
      const mid = this.clampFloor({
        x: (this.cat.x + this.dog.x) / 2,
        y: Math.max(this.cat.y, this.dog.y),
      });
      c.cloudPos = mid;
      this.cat.setHidden(true); this.dog.setHidden(true);
      document.getElementById('speedlines').classList.add('hidden');
      c.cloud = FX.tussleCloud(mid.x, mid.y - 40);
      Snd.rattle();
      c.rattleIv = setInterval(() => {
        Snd.rattle();
        Math.random() < 0.5 ? Snd.meow('squeak') : Snd.bark(1, 1.3);
      }, 700);
      if (c.playerDog) this.hintCb('Тапай по облаку! 💥');
      this.addMeter('chase', 8);
    },

    tussleTap(pt) {
      const c = this.chase; if (!c || c.phase !== 'tussle') return;
      c.taps++;
      FX.stars(pt.x, pt.y, 3);
      Snd.meow('squeak');
      this.addMeter('tussletap', 1);
    },

    _escape(reachedTree) {
      const c = this.chase; if (!c) return;
      if (c.rattleIv) clearInterval(c.rattleIv);
      if (c.cloud) { c.cloud.end(); c.cloud = null; }
      document.getElementById('speedlines').classList.add('hidden');
      const from = c.cloudPos || { x: this.cat.x, y: this.cat.y };
      this.cat.setHidden(false); this.dog.setHidden(false);
      this.chase = { phase: 'escape', t: 0 };

      if (!reachedTree) {
        this.cat.x = from.x - 30; this.cat.y = from.y;
        this.dog.x = clamp(from.x + 40, this.floorRect().x0, this.floorRect().x1);
        this.dog.y = from.y;
        this.cat.applyTransform(); this.dog.applyTransform();
      }
      Snd.meow('angry');
      Snd.whoosh();

      // кот взлетает на когтеточку
      const base = this.clampFloor({ x: TREE.x, y: TREE.baseY });
      this.cat.setEarsBack(true);
      this.cat.speedRun = 430;
      this.cat.moveTo(base.x, base.y, {
        run: true,
        cb: () => {
          // «прыжок» на платформу
          FX.dust(TREE.x, TREE.baseY - 6);
          Snd.whoosh();
          const climb = { t: 0, y0: this.cat.y };
          this._climb = climb;
          this.cat.busy = true;
        },
      });

      // пёс подбегает к дереву и гордо виляет
      if (this.mode !== 'dog') {
        setTimeout(() => {
          const p = this.clampFloor({ x: TREE.x - 90, y: TREE.baseY + 10 });
          this.dog.moveTo(p.x, p.y, {
            run: true,
            cb: () => {
              this.dog.setPose('sit');
              this.dog.setFacing(1);
              this.dog.setTailWag(true);
              Snd.bark(2);
              this.dog.say('Гав!', 700);
              setTimeout(() => {
                this.dog.setTailWag(false);
                this.dog.busy = false;
                this._idle[this.dog.id].until = 0.5;
              }, 2600);
            },
          });
        }, 500);
      } else {
        this.hintCb('Кася удрала на когтеточку! 😸');
      }

      this.addMeter('chaseEnd', 8);
      this.nextTease = this.now + (this.mode === 'dog' ? rand(12, 24) : rand(20, 42));
    },

    _tickClimb(dt) {
      if (!this._climb) return;
      const cl = this._climb;
      cl.t += dt;
      const k = Math.min(1, cl.t / 0.55);
      const ease = 1 - Math.pow(1 - k, 3);
      this.cat.y = cl.y0 + (TREE.perchY - cl.y0) * ease;
      this.cat.x = TREE.x;
      this.cat.applyTransform();
      if (k >= 1) {
        this._climb = null;
        this.cat.setEarsBack(false);
        this.cat.speedRun = 320;
        this.cat.setPose('groom');
        FX.sparkle(TREE.x, TREE.perchY - 90, 6);
        Snd.chime();
        if (this.chase && this.chase.playerCat) {
          FX.confetti(24);
          this.addMeter('treeWin', 10);
        }
        this.chase = null;
        // посидит на дереве и спрыгнет
        setTimeout(() => this._perchDone(), rand(4500, 8000));
      }
    },

    _perchDone() {
      if (this._climb) return;
      const down = this.clampFloor({ x: TREE.x - 60, y: TREE.baseY + 16 });
      const drop = { t: 0, x0: this.cat.x, y0: this.cat.y, x1: down.x, y1: down.y };
      this._dropAnim = drop;
      Snd.whoosh();
    },

    _tickDrop(dt) {
      if (!this._dropAnim) return;
      const d = this._dropAnim;
      d.t += dt;
      const k = Math.min(1, d.t / 0.45);
      this.cat.x = d.x0 + (d.x1 - d.x0) * k;
      this.cat.y = d.y0 + (d.y1 - d.y0) * (k * k); // ускоряется вниз
      this.cat.applyTransform();
      if (k >= 1) {
        this._dropAnim = null;
        FX.dust(this.cat.x, this.cat.y - 4);
        Snd.pop();
        this.cat.squash();
        this.cat.busy = false;
        this.cat.setPose('sit');
        this._idle[this.cat.id].until = rand(1, 3);
      }
    },

    abortChase() {
      const c = this.chase;
      if (c) {
        if (c.rattleIv) clearInterval(c.rattleIv);
        if (c.cloud) c.cloud.end();
        document.getElementById('speedlines').classList.add('hidden');
        this.cat.setHidden(false); this.dog.setHidden(false);
      }
      this.chase = null;
      this._climb = null;
      this._dropAnim = null;
      if (this.ball && this.ball.carrier) {
        const p = this.ball.carrier;
        this.ball.carrier = null;
        this.ball.x = p.x + p.facing * 46;
        this.ball.y = p.y;
      }
      this.cat.busy = false; this.dog.busy = false;
      this.cat.setEarsBack(false);
      this.cat.stopMove(); this.dog.stopMove();
      this.cat.speedRun = 320; this.dog.speedRun = 305;
      if (this.cat.y < 660) { this.cat.y = 700; this.cat.x = TREE.x - 60; this.cat.applyTransform(); }
      this.cat.setPose('sit'); this.dog.setPose('sit');
      this._idle[this.cat.id].until = 1;
      this._idle[this.dog.id].until = 1.5;
    },

    /* ═══ МЯЧИК ═══ */
    _makeBall() {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'ball-g');
      g.innerHTML = `
        <ellipse cx="0" cy="4" rx="30" ry="9" fill="url(#softShadow)"/>
        <g class="ball-spin">
          <circle r="26" fill="#ff6b6b" stroke="#d94f57" stroke-width="3"/>
          <path d="M -25.5,-5 A 26,26 0 0 1 25.5,-5 A 34,20 0 0 0 -25.5,-5 Z" fill="#fff" opacity="0.92"/>
          <path d="M -25.5,5 A 26,26 0 0 0 25.5,5 A 34,20 0 0 1 -25.5,5 Z" fill="#ffd166" opacity="0.95"/>
          <circle cx="-8" cy="-12" r="5" fill="#fff" opacity="0.75"/>
        </g>`;
      this.world.appendChild(g);
      this.ball = { el: g, spin: g.querySelector('.ball-spin'), x: 470, y: 906, vx: 0, vy: 0, ang: 0, carrier: null };
      this._ballPlace();
    },
    _ballPlace() {
      const b = this.ball;
      b.el.setAttribute('transform', `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) scale(${(0.72 + (b.y - 660) / 350 * 0.4).toFixed(3)})`);
      b.spin.setAttribute('transform', `rotate(${b.ang.toFixed(1)} 0 -22) translate(0 -22)`);
    },

    ballTap(pt) {
      const b = this.ball;
      if (b.carrier) return;
      let dx = b.x - pt.x, dy = (b.y - 20) - pt.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      const pow = rand(360, 520);
      b.vx = dx * pow;
      b.vy = dy * pow * 0.35 + rand(-40, 40);
      Snd.pop();
      FX.ripple(pt.x, pt.y);
      this.addMeter('ball', 2);
      // пёс-ИИ бежит за мячом
      if (this.mode !== 'dog' && !this.dog.busy && !this.dog.controlled && this._fetchCd <= 0) {
        this._fetchCd = 3;
        this._startFetch();
      }
    },

    _startFetch() {
      const dog = this.dog;
      this._cleanupIdle(dog);
      dog.busy = true;
      const chaseBall = () => {
        if (!dog.busy) return;
        const b = this.ball;
        const sp = Math.hypot(b.vx, b.vy);
        const d = Math.hypot(dog.x - b.x, dog.y - b.y);
        if (d < 74 && sp < 90) {
          b.carrier = dog;
          b.vx = b.vy = 0;
          Snd.bark(1);
          const drop = this.clampFloor({ x: 600 + rand(-60, 60), y: this.floorRect().y1 - 10 });
          dog.moveTo(drop.x, drop.y, {
            run: true,
            cb: () => {
              b.carrier = null;
              b.x = dog.x + dog.facing * 60 * dog.scale();
              b.y = dog.y - 6;
              b.vx = dog.facing * 90; b.vy = 30;
              dog.setPose('sit');
              dog.setTailWag(true);
              dog.setHappy(true);
              dog.say('Гав!', 700);
              Snd.bark(2);
              FX.hearts(dog.x, dog.y - 140 * dog.scale(), 4);
              this.addMeter('fetch', 5);
              setTimeout(() => {
                dog.setTailWag(false); dog.setHappy(false);
                dog.busy = false;
                this._idle[dog.id].until = 1;
              }, 2200);
            },
          });
        } else {
          const t = this.clampFloor({ x: b.x, y: Math.max(b.y, 680) });
          dog.moveTo(t.x, t.y, { run: true });
          setTimeout(chaseBall, 280);
        }
      };
      chaseBall();
    },

    _tickBall(dt) {
      const b = this.ball;
      if (b.carrier) {
        const p = b.carrier;
        b.x = p.x + p.facing * 58 * p.scale();
        b.y = p.y - 52 * p.scale();
        this._ballPlace();
        return;
      }
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 2) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        const fr = Math.max(0, 1 - 1.7 * dt);
        b.vx *= fr; b.vy *= fr;
        b.ang += b.vx * dt * 1.9;
        const f = this.floorRect();
        if (b.x < f.x0) { b.x = f.x0; b.vx = Math.abs(b.vx) * 0.72; Snd.pop(); }
        if (b.x > f.x1) { b.x = f.x1; b.vx = -Math.abs(b.vx) * 0.72; Snd.pop(); }
        if (b.y < f.y0) { b.y = f.y0; b.vy = Math.abs(b.vy) * 0.72; }
        if (b.y > f.y1) { b.y = f.y1; b.vy = -Math.abs(b.vy) * 0.72; }
        this._ballPlace();

        // кот подкарауливает мяч
        if (sp > 120 && this._catBatCd <= 0 && !this.cat.busy && !this.cat.controlled &&
            Math.hypot(this.cat.x - b.x, this.cat.y - b.y) < 150) {
          this._catBatCd = 5;
          this._cleanupIdle(this.cat);
          const idle = this._idle[this.cat.id];
          idle.kind = 'bat'; idle.until = 99;
          this.cat.moveTo(b.x, b.y, {
            run: true,
            cb: () => {
              this.cat.setPose('bop');
              b.vx = rand(-1, 1) * 380;
              b.vy = rand(-0.6, 0.6) * 200;
              Snd.meow('mew'); Snd.pop();
              FX.stars(b.x, b.y - 20, 3);
              this.addMeter('catbat', 3);
              setTimeout(() => { idle.until = 0.6; }, 550);
            },
          });
        }
      }
    },

    /* ═══ ВКУСНЯШКА ═══ */
    giveTreat() {
      if (this.treat) return false;
      const p = this.randFloor(60);
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${p.x} ${p.y})`);
      g.innerHTML = `
        <ellipse cx="0" cy="2" rx="20" ry="6" fill="url(#softShadow)"/>
        <g class="fx-bubble">
          <circle cy="-12" r="16" fill="#e8b56b" stroke="#c78f47" stroke-width="3"/>
          <circle cx="-5" cy="-16" r="2.6" fill="#8a5a2b"/>
          <circle cx="5" cy="-10" r="2.6" fill="#8a5a2b"/>
          <circle cx="2" cy="-19" r="2.2" fill="#8a5a2b"/>
        </g>`;
      this.world.appendChild(g);
      Snd.pop();
      this.treat = { x: p.x, y: p.y, el: g, eater: null };

      // ближайший свободный питомец бежит к угощению
      const options = [this.cat, this.dog].filter(pt => !pt.busy && !(this.chase));
      if (!options.length) { setTimeout(() => this._treatGone(), 6000); return true; }
      options.sort((a, b) => dist(a, p) - dist(b, p));
      // питомец игрока получает угощение первым — он его и просил!
      const hero = this.mode === 'cat' ? this.cat : this.mode === 'dog' ? this.dog : null;
      const eater = hero && options.includes(hero) ? hero : options[0];
      const wasBeg = eater === this.dog && this._idle[eater.id].kind === 'beg';
      this._cleanupIdle(eater);
      eater.busy = true;
      this.treat.eater = eater;
      const other = eater === this.cat ? this.dog : this.cat;
      if (!other.busy && !other.controlled) other.lookTarget = { x: p.x, y: p.y };

      eater.moveTo(p.x + (eater.x < p.x ? -44 : 44), p.y, {
        run: dist(eater, p) > 320,
        cb: () => {
          eater.setFacing(p.x > eater.x ? 1 : -1);
          eater.setPose('sit');
          Snd.crunch();
          setTimeout(() => {
            if (this.treat) { this.treat.el.remove(); this.treat = null; }
            FX.hearts(p.x, p.y - 40, wasBeg ? 7 : 3, wasBeg);
            this.addMeter('treat', wasBeg ? 10 : 6);
            if (eater === this.dog) {
              eater.setHappy(true); eater.setTailWag(true);
              if (wasBeg) { eater._retrigger(eater.jumper, 'a-spin-happy'); Snd.fanfare(); }
              else Snd.bark(1);
              setTimeout(() => { eater.setHappy(false); eater.setTailWag(false); }, 1600);
            } else {
              Snd.meow('mew');
            }
            eater.busy = false;
            other.lookTarget = null;
            this._idle[eater.id].until = 0.8;
          }, 900);
        },
      });
      return true;
    },
    _treatGone() {
      if (this.treat && !this.treat.eater) { this.treat.el.remove(); this.treat = null; }
    },

    /* ═══ КНОПКИ ДЕЙСТВИЙ ═══ */
    actionState() {
      if (this.mode === 'cat') {
        const near = dist(this.cat, this.dog) < 190;
        return {
          label: '😼 БАП!',
          visible: true,
          enabled: near && this.teaseReady() && !this.cat.busy,
          attention: near && this.teaseReady(),
        };
      }
      if (this.mode === 'dog') {
        return { label: '🐶 ГАВ!', visible: true, enabled: !this.dog.busy || (this.chase && this.chase.phase === 'chase') };
      }
      return { visible: false };
    },

    doAction() {
      if (this.mode === 'cat') {
        if (this.actionState().enabled) this.startTease(true);
      } else if (this.mode === 'dog') {
        Snd.bark(2);
        this.dog.say('Гав!', 600);
        this.dog.setTailWag(true);
        clearTimeout(this.dog._wagT);
        this.dog._wagT = setTimeout(() => this.dog.setTailWag(false), 1500);
        if (!this.chase && !this.cat.busy && dist(this.cat, this.dog) < 300) {
          // кот фыркает и отпрыгивает
          this._cleanupIdle(this.cat);
          const idle = this._idle[this.cat.id];
          idle.kind = 'scared'; idle.until = 99;
          this.cat.hop();
          this.cat.setEarsBack(true);
          Snd.meow('angry');
          const away = this.clampFloor({
            x: this.cat.x + (this.cat.x < this.dog.x ? -1 : 1) * 240,
            y: this.cat.y + rand(-60, 60),
          });
          this.cat.moveTo(away.x, away.y, {
            run: true,
            cb: () => { this.cat.setEarsBack(false); idle.until = 0.5; },
          });
          this.addMeter('bark', 2);
        }
      }
    },

    begPressed() {
      if (this.mode !== 'dog' || this.dog.busy) return;
      this._cleanupIdle(this.dog);
      const idle = this._idle[this.dog.id];
      idle.kind = 'beg'; idle.until = 3.2;
      this.dog.stopMove();
      this.dog.setPose('beg');
      this.dog.setPlead(true);
      Snd.whine();
      const hp = this.dog.headPoint();
      FX.sparkle(hp.x, hp.y - 10, 4, '#cfe8ff');
      this.addMeter('beg', 2);
    },

    /* ═══ УПРАВЛЕНИЕ ИГРОКОМ ═══ */
    setMode(m) {
      if (m === this.mode) return;
      this.abortChase();
      this._cleanupIdle(this.cat); this._cleanupIdle(this.dog);
      this.cat.controlled = m === 'cat';
      this.dog.controlled = m === 'dog';
      this.mode = m;
      this._idle[this.cat.id].until = 0.6;
      this._idle[this.dog.id].until = 1.0;
      if (m === 'cat') this.hintCb('Ты — Кася! Подкрадись к Пепе и жми БАП! 😼');
      else if (m === 'dog') this.hintCb('Ты — Пепа! Тапай по полу, чтобы бегать 🐾');
      this.nextTease = this.now + (m === 'dog' ? rand(6, 12) : rand(16, 30));
    },

    floorTap(pt) {
      const p = this.clampFloor(pt);
      const hero = this.mode === 'cat' ? this.cat : this.mode === 'dog' ? this.dog : null;
      if (!hero) return;
      if (hero.busy && !(this.chase && this.chase.phase === 'chase')) return;
      const far = dist(hero, p) > 300;
      const inChase = this.chase && this.chase.phase === 'chase';
      hero.moveTo(p.x, p.y, {
        run: far || inChase,
        cb: () => {
          if (!inChase) {
            hero.setPose('sit');
            if (hero === this.dog && this.chase == null) {
              const d = dist(this.cat, this.dog);
              if (d < 150 && !this.cat.busy) {
                // пёс подошёл — кот дружелюбно трётся
                FX.hearts((this.cat.x + this.dog.x) / 2, this.cat.y - 120, 3);
                this.addMeter('near', 2);
              }
            }
          }
        },
      });
      FX.ripple(p.x, p.y);
    },

    /* ═══ ДРУЖБОМЕТР ═══ */
    addMeter(src, v) {
      const t = this._cool[src] || 0;
      const gaps = { poke: 0.8, stroke: 0.4, tussletap: 0.25, ball: 1.2, near: 4 };
      if (this.now - t < (gaps[src] || 0.5)) return;
      this._cool[src] = this.now;
      if (this.celebrating) return;
      this.meter = clamp(this.meter + v, 0, 100);
      this.meterCb && this.meterCb(this.meter);
      if (this.meter >= 100) this._celebrate();
    },

    _celebrate() {
      this.celebrating = true;
      this.abortChase();
      if (this.treat) { this.treat.el.remove(); this.treat = null; }
      this._cleanupIdle(this.cat); this._cleanupIdle(this.dog);
      this.cat.busy = this.dog.busy = true;
      const cy = clamp(880, this.floorRect().y0, this.floorRect().y1);
      const cx = clamp(600, this.floorRect().x0 + 80, this.floorRect().x1 - 80);
      let arrived = 0;
      const done = () => {
        arrived++;
        if (arrived < 2) return;
        this.cat.setFacing(1); this.dog.setFacing(-1);
        this.cat.setPose('sit'); this.dog.setPose('sit');
        this.cat.squash(); this.dog.squash();
        this.cat.setHappy(true); this.dog.setHappy(true);
        this.dog.setTailWag(true);
        FX.bigHeart(cx, cy - 190);
        FX.confetti(46);
        FX.hearts(cx, cy - 120, 8, true);
        Snd.fanfare();
        Snd.purrStart();
        setTimeout(() => {
          Snd.purrStop();
          this.cat.setHappy(false); this.dog.setHappy(false);
          this.dog.setTailWag(false);
          this.cat.busy = this.dog.busy = false;
          this.cat.controlled = this.mode === 'cat';
          this.dog.controlled = this.mode === 'dog';
          this.meter = 0;
          this.meterCb && this.meterCb(0);
          this.celebrating = false;
          this._idle[this.cat.id].until = 1;
          this._idle[this.dog.id].until = 1.5;
        }, 3000);
      };
      this.cat.moveTo(cx - 62, cy, { run: true, cb: done });
      this.dog.moveTo(cx + 62, cy, { run: true, cb: done });
    },

    /* ═══ ФОН ═══ */
    _tickAmbient(dt) {
      this._ambientT -= dt;
      if (this._ambientT <= 0) {
        this._ambientT = rand(16, 34);
        Snd.tweet();
      }
      // авто-приставание кота
      if (this.mode !== 'cat' && this.now > this.nextTease && this.teaseReady()) {
        this.nextTease = this.now + 60; // защита от повторного входа
        this.startTease(false);
      }
      this._tickClimb(dt);
      this._tickDrop(dt);
    },

    _zSort() {
      const items = [
        { el: this.cat.el, y: this.cat.y },
        { el: this.dog.el, y: this.dog.y },
        { el: this.ball.el, y: this.ball.y },
      ];
      if (this.treat) items.push({ el: this.treat.el, y: this.treat.y });
      items.sort((a, b) => a.y - b.y);
      const els = items.map((i) => i.el);
      let same = true;
      for (let i = 0; i < els.length; i++) {
        if (this.world.children[i] !== els[i]) { same = false; break; }
      }
      if (!same) els.forEach((el) => this.world.appendChild(el));
    },
  };

  window.Director = Director;
})();
