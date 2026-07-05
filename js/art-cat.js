/* ═══ CatArt — Кася, шоколадная бурма (аниме-чиби, SVG-позы) ═══
   Конвенции: персонаж смотрит ВПРАВО (+x), земля — y=0, якорь (0,0) под центром.
   Каждая анимируемая часть: <g transform="translate(пивот)"><g class="a-...">арт от (0,0)</g></g> */
(function () {
  const OUT = '#2a1a12';         // контур
  const BODY = 'url(#catBodyGrad)';
  const BELLY = 'url(#catBellyGrad)';
  const LEG = '#4a2b1b';
  const LEG_FAR = '#38200f';
  const PAW = '#2f1a0e';
  const TAIL = '#48291b';
  const TAIL_TIP = '#231208';
  const EAR_IN = '#c98b78';

  /* ── ухо: пивот у основания, кончик вверх-влево ── */
  const EAR = `
    <path d="M -16,4 C -22,-14 -12,-30 2,-36 C 13,-24 15,-6 10,6 Z"
      fill="${BODY}" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M -9,0 C -12,-12 -5,-22 3,-27 C 9,-18 10,-5 7,1 Z" fill="${EAR_IN}"/>`;

  function eye(x, mode, delay) {
    const open = `
      <g class="eye-open">
        <ellipse rx="11.5" ry="13" fill="#26150d"/>
        <circle r="10" fill="url(#catIris)"/>
        <g class="pupil"><ellipse rx="4.2" ry="7.8" fill="#140b07"/></g>
        <circle cx="3.6" cy="-4.2" r="3.2" fill="#fff" opacity="0.95"/>
        <circle cx="-3.4" cy="3.6" r="1.7" fill="#fff" opacity="0.7"/>
      </g>
      <path class="eye-happy" d="M -10,1 Q 0,-8.5 10,1" stroke="#26150d" stroke-width="3.6"
        fill="none" stroke-linecap="round"/>`;
    const closed = `<path d="M -10,-1 Q 0,6.5 10,-1" stroke="#26150d" stroke-width="3.6"
        fill="none" stroke-linecap="round"/>`;
    let inner;
    if (mode === 'closed') inner = closed;
    else if (mode === 'sly') inner = `<g style="transform:scaleY(0.55)">${open}</g>`;
    else inner = open;
    return `<g transform="translate(${x} -30)">
      <g class="a-blink" style="animation-delay:${delay}">${inner}</g></g>`;
  }

  function muzzle(happy) {
    return `
    <g transform="translate(0 -12)">
      <path d="M -5,-2 Q 0,-4.5 5,-2 Q 5,2 0,4.5 Q -5,2 -5,-2 Z" fill="#2b1712"/>
      <path d="M 0,4.5 L 0,9" stroke="#2b1712" stroke-width="2" stroke-linecap="round"/>
      <g class="mouth-idle" ${happy ? 'style="display:none"' : ''}>
        <path d="M -8,9 Q -4,13.5 0,9 Q 4,13.5 8,9" stroke="#2b1712" stroke-width="2.2"
          fill="none" stroke-linecap="round"/>
      </g>
      <g class="mouth-open">
        <ellipse cx="0" cy="14" rx="7" ry="9" fill="#6e2f3a" stroke="#2b1712" stroke-width="2"/>
        <ellipse cx="0" cy="18" rx="4.5" ry="4.5" fill="#e58a94"/>
      </g>
      <g class="mouth-happy" ${happy ? 'style="display:inline"' : ''}>
        <path d="M -9,8 Q 0,17 9,8" stroke="#2b1712" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </g>
    </g>`;
  }

  const WHISKERS = `
    <g stroke="#ffffff" stroke-width="2" opacity="0.72" fill="none" stroke-linecap="round">
      <path d="M -28,-14 q -18,-3 -32,1"/><path d="M -28,-9 q -18,1 -31,7"/>
      <path d="M -27,-4 q -14,6 -26,13"/>
      <path d="M 28,-14 q 18,-3 32,1"/><path d="M 28,-9 q 18,1 31,7"/>
      <path d="M 27,-4 q 14,6 26,13"/>
    </g>`;

  const BLUSH = `
    <ellipse cx="-27" cy="-8" rx="6" ry="3.5" fill="#e8967e" opacity="0.4"/>
    <ellipse cx="27" cy="-8" rx="6" ry="3.5" fill="#e8967e" opacity="0.4"/>`;

  const CHEEKS = `
    <path d="M -41,-20 l -8,4 l 8,5 M -42,-10 l -7,5 l 8,3" stroke="${OUT}" stroke-width="2"
      fill="${BODY}" stroke-linejoin="round"/>
    <path d="M 41,-20 l 8,4 l -8,5 M 42,-10 l 7,5 l -8,3" stroke="${OUT}" stroke-width="2"
      fill="${BODY}" stroke-linejoin="round"/>`;

  /* Голова: пивот — шея (0,0), центр головы (0,-34). */
  function head(o) {
    o = o || {};
    const eyes = o.eyes || 'open';
    const earStyle = o.earsBack ? 'style="transform:rotate(-34deg)"' : '';
    const earStyleR = o.earsBack ? 'style="transform:rotate(-34deg)"' : '';
    return `
    <g transform="translate(${o.x || 0} ${o.y || 0}) rotate(${o.tilt || 0})">
      <g class="head-in">
        <g transform="translate(-27 -62)"><g class="ear-in a-ear-twitch" ${earStyle}>${EAR}</g></g>
        <g transform="translate(27 -62) scale(-1 1)">
          <g class="ear-in ear-right a-ear-twitch" style="animation-delay:-3.4s" ${earStyleR}>${EAR}</g></g>
        <ellipse cx="0" cy="-34" rx="42" ry="38" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
        ${CHEEKS}
        <ellipse cx="0" cy="-26" rx="30" ry="24" fill="url(#catFaceGrad)" opacity="0.5"/>
        ${eye(-17, eyes, '-1.2s')}
        ${eye(17, eyes, '-1.23s')}
        ${muzzle(o.happyMouth)}
        ${WHISKERS}
        ${BLUSH}
      </g>
    </g>`;
  }

  /* сидячий корпус — общий для sit / groom */
  function sitBase() {
    return {
      tail: `<g transform="translate(30 -14)"><g class="a-tail-sway">
        <path d="M 0,0 C 20,4 34,-4 38,-22 C 40,-34 34,-44 24,-48" fill="none"
          stroke="${TAIL}" stroke-width="15" stroke-linecap="round"/>
        <path d="M 35,-28 C 35,-38 31,-45 24,-48" fill="none"
          stroke="${TAIL_TIP}" stroke-width="15" stroke-linecap="round"/>
      </g></g>`,
      haunch: `<ellipse cx="-2" cy="-40" rx="47" ry="42" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
        <ellipse cx="20" cy="-5" rx="17" ry="8" fill="#3a2013"/>`,
      legs: `
        <g><rect x="-2" y="-56" width="11" height="54" rx="5.5" fill="${LEG}" stroke="${OUT}" stroke-width="2"/>
        <ellipse cx="3.5" cy="-3" rx="9" ry="6" fill="${PAW}"/></g>
        <g><rect x="14" y="-56" width="11" height="54" rx="5.5" fill="${LEG}" stroke="${OUT}" stroke-width="2"/>
        <ellipse cx="19.5" cy="-3" rx="9" ry="6" fill="${PAW}"/></g>`,
    };
  }

  /* нога для ходьбы: пивот — бедро, нога вниз (0,0)→(0,44) */
  function walkLeg(color) {
    return `<path d="M -5.5,0 L -5.5,38 Q -5.5,44 0,44 Q 5.5,44 5.5,38 L 5.5,0 Z"
      fill="${color}" stroke="${OUT}" stroke-width="2"/>
      <ellipse cx="0" cy="42" rx="8" ry="5.5" fill="${PAW}"/>`;
  }

  const poses = {

    /* ── СИДИТ (как на фото у миски) ── */
    sit() {
      const b = sitBase();
      return `${b.tail}${b.haunch}
        <g class="a-breathe">
          <ellipse cx="8" cy="-78" rx="30" ry="40" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
          <ellipse cx="10" cy="-62" rx="17" ry="25" fill="${BELLY}"/>
          ${head({ x: 8, y: -106 })}
        </g>
        ${b.legs}`;
    },

    /* ── БУЛОЧКА ── */
    loaf() {
      return `
        <g transform="translate(38 -10)"><g class="a-tail-sway">
          <path d="M 0,0 C 10,6 2,10 -16,9 C -30,8 -38,4 -40,-2" fill="none"
            stroke="${TAIL}" stroke-width="13" stroke-linecap="round"/>
        </g></g>
        <g class="a-breathe">
          <ellipse cx="0" cy="-28" rx="51" ry="29" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
          <path d="M -46,-14 Q 0,-2 46,-14" stroke="#3a2013" stroke-width="3" fill="none" opacity="0.5"/>
          ${head({ x: 24, y: -50, happyMouth: true })}
        </g>`;
    },

    /* ── ИДЁТ / БЕЖИТ ── */
    walk() {
      return `<g class="a-lean">
        <g transform="translate(-24 -46)"><g class="ph-b">${walkLeg(LEG_FAR)}</g></g>
        <g transform="translate(34 -46)"><g class="ph-a">${walkLeg(LEG_FAR)}</g></g>
        <g transform="translate(-46 -66)"><g class="a-tail-sway">
          <path d="M 0,0 C -16,-8 -24,-24 -20,-42 C -18,-52 -12,-58 -4,-60" fill="none"
            stroke="${TAIL}" stroke-width="14" stroke-linecap="round"/>
          <path d="M -19,-46 C -16,-54 -10,-59 -4,-60" fill="none"
            stroke="${TAIL_TIP}" stroke-width="14" stroke-linecap="round"/>
        </g></g>
        <g class="a-walk-bob">
          <ellipse cx="0" cy="-56" rx="52" ry="29" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
          <ellipse cx="4" cy="-44" rx="33" ry="15" fill="${BELLY}" opacity="0.85"/>
          ${head({ x: 44, y: -74 })}
        </g>
        <g transform="translate(-34 -48)"><g class="ph-a">${walkLeg(LEG)}</g></g>
        <g transform="translate(24 -48)"><g class="ph-b">${walkLeg(LEG)}</g></g>
      </g>`;
    },

    /* ── КРАДЁТСЯ (перед бапом) ── */
    sneak() {
      const stub = (c) => `<path d="M -5,0 L -5,16 Q -5,21 0,21 Q 5,21 5,16 L 5,0 Z"
        fill="${c}" stroke="${OUT}" stroke-width="2"/><ellipse cx="0" cy="19" rx="7.5" ry="5" fill="${PAW}"/>`;
      return `
        <g transform="translate(-28 -22)"><g class="ph-b">${stub(LEG_FAR)}</g></g>
        <g transform="translate(40 -22)"><g class="ph-a">${stub(LEG_FAR)}</g></g>
        <g transform="translate(-56 -26)"><g class="a-tail-sway">
          <path d="M 0,0 C -14,-2 -24,-8 -28,-18" fill="none" stroke="${TAIL}"
            stroke-width="13" stroke-linecap="round"/>
        </g></g>
        <ellipse cx="0" cy="-26" rx="58" ry="21" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
        ${head({ x: 52, y: -34, eyes: 'sly' })}
        <g transform="translate(-40 -24)"><g class="ph-a">${stub(LEG)}</g></g>
        <g transform="translate(28 -24)"><g class="ph-b">${stub(LEG)}</g></g>`;
    },

    /* ── БАП! (замах лапой) ── */
    bop() {
      const stub = (c) => `<path d="M -5,0 L -5,16 Q -5,21 0,21 Q 5,21 5,16 L 5,0 Z"
        fill="${c}" stroke="${OUT}" stroke-width="2"/><ellipse cx="0" cy="19" rx="7.5" ry="5" fill="${PAW}"/>`;
      return `
        <g transform="translate(-28 -22)">${stub(LEG_FAR)}</g>
        <g transform="translate(40 -22)">${stub(LEG_FAR)}</g>
        <g transform="translate(-56 -28)"><g class="a-tail-fast">
          <path d="M 0,0 C -12,-8 -18,-22 -14,-38" fill="none" stroke="${TAIL}"
            stroke-width="13" stroke-linecap="round"/>
        </g></g>
        <ellipse cx="-4" cy="-28" rx="55" ry="22" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
        ${head({ x: 46, y: -40, eyes: 'open' })}
        <g transform="translate(52 -34)"><g class="a-bop">
          <path d="M -5.5,0 L -5.5,-30 Q -5.5,-38 0,-38 Q 5.5,-38 5.5,-30 L 5.5,0 Z"
            fill="${LEG}" stroke="${OUT}" stroke-width="2"/>
          <circle cx="0" cy="-38" r="9" fill="${PAW}"/>
        </g></g>
        <g transform="translate(24 -24)">${stub(LEG)}</g>`;
    },

    /* ── ВАЛЯЕТСЯ ПУЗОМ КВЕРХУ (фирменная поза с фото) ── */
    lieback() {
      const pawUp = (delay) => `<g class="a-wiggle" style="animation-delay:${delay}">
        <path d="M -5,0 L -5,-20 Q -5,-27 0,-27 Q 5,-27 5,-20 L 5,0 Z"
          fill="${LEG}" stroke="${OUT}" stroke-width="2"/>
        <circle cx="0" cy="-27" r="8" fill="${PAW}"/>
        <g fill="#b97e63" opacity="0.9">
          <circle cx="0" cy="-28" r="3"/><circle cx="-4" cy="-24" r="1.6"/>
          <circle cx="4" cy="-24" r="1.6"/>
        </g></g>`;
      return `
        <g transform="translate(46 -10)"><g class="a-tail-sway">
          <path d="M 0,0 C 14,4 28,2 36,-8" fill="none" stroke="${TAIL}"
            stroke-width="13" stroke-linecap="round"/>
          <path d="M 30,-3 C 34,-5 36,-8 36,-8" fill="none" stroke="${TAIL_TIP}"
            stroke-width="13" stroke-linecap="round"/>
        </g></g>
        <g class="a-breathe">
          <ellipse cx="0" cy="-26" rx="52" ry="27" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"
            transform="rotate(-4)"/>
          <ellipse cx="4" cy="-30" rx="34" ry="18" fill="${BELLY}" transform="rotate(-4)"/>
        </g>
        <g transform="translate(-25 -46)">${pawUp('0s')}</g>
        <g transform="translate(-7 -52)">${pawUp('-0.4s')}</g>
        <g transform="translate(13 -52)">${pawUp('-0.15s')}</g>
        <g transform="translate(29 -46)">${pawUp('-0.6s')}</g>
        ${head({ x: -52, y: -12, tilt: -74 })}`;
    },

    /* ── ВЫЛИЗЫВАЕТСЯ (как на фото, с язычком) ── */
    groom() {
      const b = sitBase();
      return `${b.tail}${b.haunch}
        <g class="a-breathe">
          <ellipse cx="8" cy="-78" rx="30" ry="40" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
          <ellipse cx="10" cy="-62" rx="17" ry="25" fill="${BELLY}"/>
          ${head({ x: 6, y: -98, tilt: 24, eyes: 'closed' })}
        </g>
        <g transform="translate(36 -60)"><g class="a-tongue-groom">
          <ellipse cx="0" cy="0" rx="5" ry="8" fill="#e58a94" stroke="#c96a78" stroke-width="1.5"/>
        </g></g>
        <g><rect x="-4" y="-56" width="11" height="54" rx="5.5" fill="${LEG}" stroke="${OUT}" stroke-width="2"/>
        <ellipse cx="1.5" cy="-3" rx="9" ry="6" fill="${PAW}"/></g>
        <g transform="translate(30 -46)"><g class="a-paw-groom">
          <path d="M -5.5,0 L -5.5,-32 Q -5.5,-40 0,-40 Q 5.5,-40 5.5,-32 L 5.5,0 Z"
            fill="${LEG}" stroke="${OUT}" stroke-width="2"/>
          <circle cx="0" cy="-40" r="8.5" fill="${PAW}"/>
        </g></g>`;
    },

    /* ── СПИТ КАЛАЧИКОМ ── */
    sleep() {
      return `
        <g class="a-breathe">
          <ellipse cx="0" cy="-27" rx="52" ry="28" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
          <path d="M 42,-10 C 30,2 -4,7 -30,-1 C -43,-6 -48,-14 -46,-22" fill="none"
            stroke="${TAIL}" stroke-width="14" stroke-linecap="round"/>
          <path d="M -40,-8 C -45,-12 -47,-17 -46,-22" fill="none"
            stroke="${TAIL_TIP}" stroke-width="14" stroke-linecap="round"/>
          <g transform="translate(-16 -30) scale(0.92)">${head({ eyes: 'closed', tilt: 10 })}</g>
        </g>`;
    },
  };

  /* иконка-мордочка для кнопок и сплэша */
  function faceIcon() {
    return `<svg viewBox="-66 -112 132 132" xmlns="http://www.w3.org/2000/svg">
      <g>${head({ happyMouth: true })}</g></svg>`;
  }

  window.CatArt = { poses, faceIcon, colors: { BODY: '#5b3a28' } };
})();
