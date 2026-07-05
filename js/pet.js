/* ═══ Pet — живой персонаж: позы, движение, взгляд, реплики ═══ */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const DEPTH_Y0 = 660, DEPTH_Y1 = 1010, S0 = 0.78, S1 = 1.14;

  class Pet {
    constructor(cfg) {
      this.id = cfg.id;
      this.name = cfg.name;
      this.art = cfg.art;
      this.base = cfg.base || 1;
      this.heights = cfg.heights || {};
      this.x = cfg.x; this.y = cfg.y;
      this.facing = cfg.facing || 1;
      this.speedWalk = cfg.speedWalk || 105;
      this.speedRun = cfg.speedRun || 300;
      this.target = null;
      this.onArrive = null;
      this.running = false;
      this.busy = false;          // директор занят этим питомцем (сценка)
      this.controlled = false;    // управляется игроком
      this.lookTarget = null;
      this._pupil = { x: 0, y: 0 };
      this._stepAcc = 0;
      this._talkT = null;
      this.scaleOverride = null;  // для когтеточки

      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'pet');
      g.dataset.pet = this.id;
      g.innerHTML = `
        <ellipse class="pet-shadow" cx="0" cy="-3" rx="54" ry="13" fill="url(#softShadow)"/>
        <g class="flip"><g class="jumper"><g class="slot"></g></g></g>
        <ellipse class="hit" cx="0" cy="-78" rx="82" ry="98" fill="transparent"/>`;
      cfg.world.appendChild(g);
      this.el = g;
      this.flipEl = g.querySelector('.flip');
      this.jumper = g.querySelector('.jumper');
      this.slot = g.querySelector('.slot');
      this.pose = null;
      this.setPose(cfg.pose || 'sit');
      this.setFacing(this.facing, true);
      this.applyTransform();
    }

    scale() {
      if (this.scaleOverride) return this.scaleOverride;
      const t = Math.max(0, Math.min(1, (this.y - DEPTH_Y0) / (DEPTH_Y1 - DEPTH_Y0)));
      return this.base * (S0 + (S1 - S0) * t);
    }

    applyTransform() {
      this.el.setAttribute('transform',
        `translate(${this.x.toFixed(1)} ${this.y.toFixed(1)}) scale(${this.scale().toFixed(3)})`);
    }

    setPose(name, opts) {
      if (this.pose === name && !opts) return;
      this.pose = name;
      const fn = this.art.poses[name];
      this.slot.innerHTML = fn ? fn(opts) : '';
      this.pupils = Array.prototype.slice.call(this.slot.querySelectorAll('.pupil'));
    }

    setFacing(f, force) {
      if (f !== this.facing || force) {
        this.facing = f;
        this.flipEl.setAttribute('transform', `scale(${f} 1)`);
      }
    }

    moveTo(x, y, opts) {
      opts = opts || {};
      this.target = { x, y };
      this.onArrive = opts.cb || null;
      this.running = !!opts.run;
      if (this.pose !== (opts.pose || 'walk')) this.setPose(opts.pose || 'walk');
      this.el.classList.add('moving');
      this.el.classList.toggle('running', this.running);
    }

    stopMove() {
      this.target = null;
      this.running = false;
      this.el.classList.remove('moving', 'running');
    }

    update(dt, look) {
      if (this.target) {
        const dx = this.target.x - this.x, dy = this.target.y - this.y;
        const d = Math.hypot(dx, dy);
        const st = (this.running ? this.speedRun : this.speedWalk) * dt;
        if (d <= st || d < 1) {
          this.x = this.target.x; this.y = this.target.y;
          const cb = this.onArrive;
          this.stopMove();
          this.onArrive = null;
          if (cb) cb();
        } else {
          this.x += (dx / d) * st;
          this.y += (dy / d) * st;
          if (Math.abs(dx) > 6) this.setFacing(dx > 0 ? 1 : -1);
          this._stepAcc += st;
          const thr = this.running ? 46 : 64;
          if (this._stepAcc > thr) {
            this._stepAcc = 0;
            if (window.Snd && Snd.ctx) Snd.step();
            if (this.running) FX.dust(this.x - this.facing * 42, this.y - 4);
          }
        }
        this.applyTransform();
      }

      // зрачки следят за целью (пальцем/другим питомцем)
      const lt = look || this.lookTarget;
      let tx = 0, ty = 0;
      if (lt) {
        const cx = this.x, cy = this.y - 110 * this.scale();
        tx = Math.max(-1, Math.min(1, (lt.x - cx) / 260)) * 4.6 * this.facing;
        ty = Math.max(-0.7, Math.min(1, (lt.y - cy) / 260)) * 3.4;
      }
      const k = Math.min(1, dt * 7);
      this._pupil.x += (tx - this._pupil.x) * k;
      this._pupil.y += (ty - this._pupil.y) * k;
      if (this.pupils && this.pupils.length) {
        const t = `translate(${this._pupil.x.toFixed(2)} ${this._pupil.y.toFixed(2)})`;
        for (let i = 0; i < this.pupils.length; i++) this.pupils[i].setAttribute('transform', t);
      }
    }

    headPoint() {
      const h = (this.heights[this.pose] != null ? this.heights[this.pose] : 150);
      return { x: this.x, y: this.y - h * this.scale() };
    }

    say(text, ms) {
      ms = ms || 900;
      const hp = this.headPoint();
      FX.bubble(hp.x, hp.y - 26, text, ms);
      this.talk(Math.min(ms, 650));
    }

    talk(ms) {
      this.el.classList.add('talking');
      clearTimeout(this._talkT);
      this._talkT = setTimeout(() => this.el.classList.remove('talking'), ms || 500);
    }

    _retrigger(el, cls) {
      el.classList.remove(cls);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add(cls)));
    }

    squash() { this._retrigger(this.slot, 'a-squash'); }
    hop() { this._retrigger(this.jumper, 'a-hop'); }

    setHappy(b) { this.el.classList.toggle('happy', b); }
    setPetting(b) { this.el.classList.toggle('petting', b); }
    setEarsBack(b) { this.el.classList.toggle('ears-back', b); }
    setTailWag(b) { this.el.classList.toggle('tail-wag', b); }
    setPlead(b) { this.el.classList.toggle('plead', b); }
    setSleeping(b) { this.el.classList.toggle('sleeping', b); }
    setHidden(b) { this.el.style.display = b ? 'none' : ''; }
  }

  window.Pet = Pet;
})();
