/* ═══ main — загрузка, ввод, режимы, цикл ═══ */
(function () {
  const stage = document.getElementById('stage');
  const world = document.getElementById('world');

  /* мордочки на кнопках и сплэше */
  document.getElementById('face-cat').innerHTML = CatArt.faceIcon();
  document.getElementById('face-dog').innerHTML = DogArt.faceIcon();
  document.getElementById('splash-cat').innerHTML = CatArt.faceIcon();
  document.getElementById('splash-dog').innerHTML = DogArt.faceIcon();

  FX.init();

  /* питомцы */
  const cat = new Pet({
    id: 'cat', name: 'Кася', art: CatArt, base: 0.98,
    x: 500, y: 850, pose: 'sit', world,
    speedWalk: 112, speedRun: 320,
    heights: { sit: 165, loaf: 112, walk: 145, sneak: 88, bop: 98, lieback: 82, groom: 152, sleep: 78 },
  });
  const dog = new Pet({
    id: 'dog', name: 'Пепа', art: DogArt, base: 1.02,
    x: 706, y: 868, facing: -1, pose: 'sit', world,
    speedWalk: 96, speedRun: 305,
    heights: { sit: 172, beg: 198, walk: 152, sleep: 62, sniff: 104 },
  });

  /* интерфейс */
  const meterFill = document.getElementById('meter-fill');
  const meterBox = document.getElementById('meter');
  const btnAction = document.getElementById('btn-action');
  const btnBeg = document.getElementById('btn-beg');
  const btnTreat = document.getElementById('btn-treat');
  const btnSound = document.getElementById('btn-sound');

  /* тост-подсказка: HTML, переносит строки, не вылезает за экран */
  const hintEl = document.getElementById('hint');
  let hintT = null;
  function showHint(text) {
    hintEl.textContent = text;
    hintEl.classList.add('show');
    clearTimeout(hintT);
    hintT = setTimeout(() => hintEl.classList.remove('show'), 2600);
  }

  Director.init({
    cat, dog, world,
    onMeter(v) {
      meterFill.style.width = v + '%';
      meterBox.classList.toggle('full', v >= 100);
    },
    onHint: showHint,
  });

  /* видимая область (slice-кадрирование) */
  function updateVR() {
    let w = innerWidth, h = innerHeight;
    if (!w || !h) {
      const r = stage.getBoundingClientRect();
      w = r.width; h = r.height;
    }
    if (!w || !h) { w = 1200; h = 1200; }
    const sc = Math.max(w / 1200, h / 1200);
    const vw = w / sc, vh = h / sc;
    const y0 = (1200 - vh) / 2;
    // панели интерфейса не должны накрывать питомцев:
    // переводим их края из CSS-пикселей в координаты сцены
    let uiBot = y0 + vh;
    const bb = document.getElementById('bottombar');
    if (bb) {
      const r = bb.getBoundingClientRect();
      if (r.height > 0) uiBot = y0 + r.top / sc;
    }
    Director.vr = {
      x0: (1200 - vw) / 2, x1: (1200 + vw) / 2,
      y0, y1: y0 + vh,
      uiBot,
    };
  }
  updateVR();
  Director.refit();
  addEventListener('resize', () => { updateVR(); Director.refit(); });
  addEventListener('orientationchange', () => setTimeout(() => { updateVR(); Director.refit(); }, 250));
  // панель меняет высоту, когда появляются кнопки действий
  if (window.ResizeObserver) {
    new ResizeObserver(() => { updateVR(); Director.refit(); })
      .observe(document.getElementById('bottombar'));
  }

  /* координаты указателя в системе сцены */
  function toStage(evt) {
    const pt = stage.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const m = stage.getScreenCTM();
    if (!m) return { x: 600, y: 600 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  /* ═══ ввод ═══ */
  let lastPointer = null;
  let session = null; // {pet, started, moved, lastPt, t0}

  function pointerDown(evt) {
    Snd.init(); Snd.resume();
    const pt = toStage(evt);
    lastPointer = { x: pt.x, y: pt.y, t: Director.now };

    const petEl = evt.target.closest && evt.target.closest('.pet');
    if (petEl) {
      const pet = petEl.dataset.pet === 'cat' ? cat : dog;
      session = { pet, started: false, moved: 0, lastPt: pt, t0: performance.now() };
      return;
    }
    const ballEl = evt.target.closest && evt.target.closest('.ball-g');
    if (ballEl) { Director.ballTap(pt); return; }

    const c = Director.chase;
    if (c && c.phase === 'tussle' && c.cloudPos &&
        Math.hypot(pt.x - c.cloudPos.x, pt.y - c.cloudPos.y) < 190) {
      Director.tussleTap(pt);
      return;
    }
    // в режиме Каси тап по дивану/окну/когтеточке — залезть
    if (Director.mode === 'cat') {
      const spot = Director.spotAt(pt);
      if (spot && Director.climbCmd(spot)) {
        FX.ripple(pt.x, pt.y);
        return;
      }
    }
    if (pt.y > 630) Director.floorTap(pt);
  }

  function pointerMove(evt) {
    const pt = toStage(evt);
    lastPointer = { x: pt.x, y: pt.y, t: Director.now };
    if (!session) return;
    const d = Math.hypot(pt.x - session.lastPt.x, pt.y - session.lastPt.y);
    session.moved += d;
    session.lastPt = pt;
    if (!session.started && session.moved > 30) {
      session.started = true;
      Director.strokeStart(session.pet);
    }
    if (session.started) Director.strokeMove(session.pet, d, pt);
  }

  function pointerUp(evt) {
    if (!session) return;
    const pt = toStage(evt);
    if (session.started) {
      Director.strokeEnd(session.pet);
    } else if (performance.now() - session.t0 < 450) {
      Director.pokePet(session.pet, pt);
    }
    session = null;
  }

  // Любой тап будит звук. iOS даёт «активацию пользователя» только на
  // pointerup/touchend/click (НЕ на pointerdown от пальца!) — поэтому
  // слушаем всё; тихий <audio> снимает блокировку беззвучного переключателя.
  const wakeAudio = () => { Snd.init(); Snd.unlock(); Snd.resume(); };
  ['pointerdown', 'pointerup', 'touchend', 'click'].forEach((ev) =>
    addEventListener(ev, wakeAudio, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) Snd.resume();
  });

  // диагностика звука: открыть игру с ?debug=1
  if (/debug/.test(location.search)) {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;' +
      'background:rgba(0,0,0,.72);color:#7f7;font:12px/1.5 monospace;' +
      'padding:6px 9px;border-radius:8px;pointer-events:none;white-space:pre';
    document.body.appendChild(d);
    setInterval(() => {
      const s = Snd.state();
      d.textContent =
        'ctx:' + s.ctx + '  t:' + s.time + '  rate:' + s.rate +
        '\nloop:' + s.loop + '  kick:' + s.kick + '  muted:' + s.muted +
        '\nsession:' + s.session;
    }, 500);
  }

  stage.addEventListener('pointerdown', pointerDown);
  addEventListener('pointermove', pointerMove, { passive: true });
  addEventListener('pointerup', pointerUp);
  addEventListener('pointercancel', () => {
    if (session && session.started) Director.strokeEnd(session.pet);
    session = null;
  });
  addEventListener('contextmenu', (e) => e.preventDefault());

  /* ═══ кнопки ═══ */
  document.querySelectorAll('.mode-btn').forEach((b) => {
    b.addEventListener('click', () => {
      Snd.init(); Snd.resume();
      document.querySelectorAll('.mode-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      Director.setMode(b.dataset.mode);
      Snd.chime([784, 988]);
    });
  });

  btnAction.addEventListener('click', () => { Snd.resume(); Director.doAction(); });
  btnBeg.addEventListener('click', () => { Snd.resume(); Director.begPressed(); });
  btnTreat.addEventListener('click', () => {
    Snd.resume();
    if (!Director.giveTreat()) return;
  });

  function syncSoundBtn() {
    btnSound.textContent = Snd.muted ? '🔇' : '🔊';
    btnSound.classList.toggle('muted', Snd.muted);
  }
  btnSound.addEventListener('click', () => {
    Snd.init();
    Snd.setMuted(!Snd.muted);
    syncSoundBtn();
    if (!Snd.muted) { Snd.resume(); Snd.pop(); }
  });
  syncSoundBtn();

  const help = document.getElementById('help');
  document.getElementById('btn-help').addEventListener('click', () => help.classList.remove('hidden'));
  document.getElementById('btn-help-close').addEventListener('click', () => help.classList.add('hidden'));
  help.addEventListener('click', (e) => { if (e.target === help) help.classList.add('hidden'); });

  /* ═══ сплэш ═══ */
  const splash = document.getElementById('splash');
  function startGame() {
    Snd.init(); Snd.resume();
    if (splash.classList.contains('hidden')) return;
    splash.classList.add('hidden');
    Snd.fanfare();
    setTimeout(() => showHint('Потыкай питомцев! 🐾'), 600);
  }
  document.getElementById('btn-play').addEventListener('click', startGame);
  splash.addEventListener('pointerdown', (e) => {
    if (e.target.id !== 'btn-play') startGame();
  });

  /* ═══ цикл ═══ */
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (!isFinite(Director.vr.x0)) { updateVR(); Director.refit(); }
    Director.tick(dt, lastPointer);

    // контекстная кнопка действия
    const st = Director.actionState();
    if (st.visible) {
      btnAction.classList.remove('hidden');
      btnAction.textContent = st.label;
      btnAction.disabled = !st.enabled;
      btnAction.classList.toggle('attention', !!st.attention);
    } else {
      btnAction.classList.add('hidden');
    }
    btnBeg.classList.toggle('hidden', Director.mode !== 'dog');
    btnTreat.disabled = !!Director.treat || Director.celebrating;

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
