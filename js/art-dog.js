/* ═══ DogArt — Пепа, чёрный цвергшнауцер (аниме-чиби, SVG-позы) ═══
   Те же конвенции, что и у кота: смотрит вправо, земля y=0, пивоты в (0,0) обёрток. */
(function () {
  const OUT = '#1c1b22';
  const BODY = 'url(#dogBodyGrad)';
  const FLUFF = 'url(#dogFluffGrad)';
  const FLUFF_HI = '#55535f';
  const LEG = '#34333d';
  const LEG_FAR = '#232229';
  const PAW = '#1e1d24';
  const TONGUE = '#e66a75';

  /* ухо-конвертик, пивот сверху, кончик падает вниз-вперёд */
  const EAR = `
    <path d="M -12,-2 C -19,3 -21,15 -14,26 C -4,30 8,24 10,11 C 11,3 6,-3 -3,-4 Z"
      fill="${FLUFF}" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M -10,2 C -13,10 -11,18 -7,22" stroke="#121116" stroke-width="2.5" fill="none" opacity="0.6"/>`;

  function eye(x, mode, delay) {
    const open = `
      <g class="eye-open">
        <circle r="9.5" fill="#191619" stroke="#453931" stroke-width="1.6"/>
        <g class="pupil"><circle r="4.6" fill="#000"/></g>
        <circle cx="3.2" cy="-3.2" r="3.4" fill="#fff" opacity="0.98"/>
        <circle cx="-2.8" cy="3" r="1.8" fill="#fff" opacity="0.75"/>
      </g>
      <path class="eye-happy" d="M -9,1 Q 0,-7.5 9,1" stroke="#191619" stroke-width="3.4"
        fill="none" stroke-linecap="round"/>`;
    const closed = `<path d="M -9,-1 Q 0,5.5 9,-1" stroke="#191619" stroke-width="3.4"
        fill="none" stroke-linecap="round"/>`;
    return `<g transform="translate(${x} -42)">
      <g class="a-blink" style="animation-delay:${delay}">${mode === 'closed' ? closed : open}</g></g>`;
  }

  function brow(x, right) {
    return `<g transform="translate(${x} -56)${right ? ' scale(-1 1)' : ''}">
      <g class="brow-in ${right ? 'brow-right' : ''}">
        <path d="M -12,2 Q -14,-4 -7,-6 Q 3,-9 11,-4 Q 14,0 10,3 Q 1,6 -7,5 Z"
          fill="${FLUFF_HI}" stroke="${OUT}" stroke-width="1.8"/>
        <path d="M -9,-1 q 8,-4 17,-1" stroke="#6a6875" stroke-width="1.6" fill="none"/>
      </g></g>`;
  }

  /* борода + нос + рот */
  function beardMuzzle(o) {
    const blep = o.blep ? `<ellipse cx="4" cy="-8" rx="4.5" ry="6" fill="${TONGUE}"
      stroke="#c14f5c" stroke-width="1.4"/>` : '';
    return `
    <g transform="translate(0 0)">
      <path d="M -28,-34 C -33,-14 -24,6 0,10 C 24,6 33,-14 28,-34 Q 0,-42 -28,-34 Z"
        fill="${FLUFF}" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M -19,-2 q 4,7 9,2 q 4,6 9,1 q 5,5 10,0 q 5,4 9,-3"
        stroke="#121116" stroke-width="2.4" fill="none" opacity="0.55" stroke-linecap="round"/>
      <path d="M -14,-30 q 2,10 -1,18 M 0,-28 q 1,10 0,20 M 14,-30 q -2,10 1,18"
        stroke="#6a6875" stroke-width="1.8" fill="none" opacity="0.7"/>
      <ellipse cx="0" cy="-30" rx="8.5" ry="7" fill="#141317" stroke="${OUT}" stroke-width="1.6"/>
      <circle cx="2.6" cy="-32" r="2.4" fill="#fff" opacity="0.9"/>
      <g class="mouth-idle">
        <path d="M -6,-18 Q 0,-13.5 6,-18" stroke="#121116" stroke-width="2.2"
          fill="none" stroke-linecap="round"/>
      </g>
      <g class="mouth-open">
        <ellipse cx="0" cy="-13" rx="8" ry="8.5" fill="#5e2731" stroke="#121116" stroke-width="2"/>
        <ellipse cx="0" cy="-9" rx="5" ry="5" fill="${TONGUE}"/>
      </g>
      <g class="mouth-happy">
        <path d="M -10,-19 Q 0,-9 10,-19" stroke="#121116" stroke-width="2.4"
          fill="none" stroke-linecap="round"/>
        <path d="M -1,-14 Q 0,-2 1,-14 Z" fill="none"/>
        <ellipse cx="1" cy="-6" rx="5.5" ry="8" fill="${TONGUE}" stroke="#c14f5c" stroke-width="1.4"/>
      </g>
      ${blep}
    </g>`;
  }

  /* Голова: пивот — шея (0,0), центр (0,-36). */
  function head(o) {
    o = o || {};
    const eyes = o.eyes || 'open';
    return `
    <g transform="translate(${o.x || 0} ${o.y || 0}) rotate(${o.tilt || 0})">
      <g class="head-in ${o.tiltAnim ? 'a-head-tilt' : ''}">
        <ellipse cx="0" cy="-36" rx="40" ry="37" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
        <path d="M -28,-64 q 7,-9 15,-3 q 5,-9 13,-3 q 6,-8 14,-1"
          stroke="${FLUFF_HI}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <g transform="translate(-33 -60)"><g class="ear-in a-ear-flop">${EAR}</g></g>
        <g transform="translate(33 -60) scale(-1 1)">
          <g class="ear-in ear-right a-ear-flop" style="animation-delay:-0.11s">${EAR}</g></g>
        ${brow(-16)}${brow(16, true)}
        ${eye(-15, eyes, '-2.1s')}
        ${eye(15, eyes, '-2.13s')}
        <!-- зебровый ошейник, как на фото (борода свисает поверх) -->
        ${o.noCollar ? '' : `<g transform="translate(0 2)">
          <rect x="-30" y="-6" width="60" height="12" rx="6" fill="#26252c" stroke="${OUT}" stroke-width="1.6"/>
          <path d="M -22,-6 l -3,12 M -13,-6 l -3,12 M -4,-6 l -3,12 M 24,-6 l -3,12 M 15,-6 l -3,12 M 6,-6 l -3,12"
            stroke="#f3f0e8" stroke-width="3.6" stroke-linecap="round"/>
        </g>`}
        ${beardMuzzle(o)}
      </g>
    </g>`;
  }

  /* нога с «штанишками», пивот — бедро */
  function walkLeg(color, fluffCol) {
    return `<path d="M -6,0 L -6,38 Q -6,45 0,45 Q 6,45 6,38 L 6,0 Z"
      fill="${color}" stroke="${OUT}" stroke-width="2"/>
      <ellipse cx="0" cy="43" rx="8.5" ry="6" fill="${PAW}"/>
      <path d="M -9,6 Q -11,20 -6,26 Q 0,31 6,26 Q 11,20 9,6 Q 0,0 -9,6 Z"
        fill="${fluffCol || FLUFF}" stroke="${OUT}" stroke-width="1.8" opacity="0.96"/>`;
  }

  /* хвост-морковка, пивот у основания */
  function tail(cls) {
    return `<g class="tail-anim ${cls || 'a-tail-sway'}">
      <path d="M -6,2 L 0,-28 L 10,-24 L 7,4 Z" fill="${LEG}" stroke="${OUT}"
        stroke-width="2.2" stroke-linejoin="round"/>
    </g>`;
  }

  const chestFluff = (x, y) => `
    <path d="M ${x},${y} q -7,9 -1,18 q -7,8 -1,17 q -6,8 0,16"
      stroke="${FLUFF_HI}" stroke-width="4.5" fill="none" stroke-linecap="round" opacity="0.85"/>`;

  const poses = {

    /* ── СИДИТ И СМОТРИТ (просящий взгляд — фирменное) ── */
    sit(o) {
      o = o || {};
      return `
        <g transform="translate(-38 -32)">${tail(o.wag ? 'a-tail-wag' : 'a-tail-sway')}</g>
        <ellipse cx="-6" cy="-38" rx="46" ry="40" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
        <path d="M -40,-16 q 6,10 13,2 q 6,9 13,2 q 6,8 13,1"
          stroke="#121116" stroke-width="2.4" fill="none" opacity="0.4"/>
        <ellipse cx="22" cy="-5" rx="17" ry="8" fill="${PAW}"/>
        <g class="a-breathe">
          <ellipse cx="8" cy="-80" rx="29" ry="42" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
          ${chestFluff(16, -104)}
          ${head({ x: 8, y: -112, tiltAnim: o.tiltAnim !== false })}
        </g>
        <g><rect x="-2" y="-58" width="12" height="56" rx="6" fill="${LEG}" stroke="${OUT}" stroke-width="2"/>
          <ellipse cx="4" cy="-3" rx="9.5" ry="6.5" fill="${PAW}"/>
          <path d="M -6,-40 Q -8,-26 -3,-20 Q 4,-15 10,-20 Q 15,-26 13,-40 Q 4,-46 -6,-40 Z"
            fill="${FLUFF}" stroke="${OUT}" stroke-width="1.8"/></g>
        <g><rect x="16" y="-58" width="12" height="56" rx="6" fill="${LEG}" stroke="${OUT}" stroke-width="2"/>
          <ellipse cx="22" cy="-3" rx="9.5" ry="6.5" fill="${PAW}"/>
          <path d="M 12,-40 Q 10,-26 15,-20 Q 22,-15 28,-20 Q 33,-26 31,-40 Q 22,-46 12,-40 Z"
            fill="${FLUFF}" stroke="${OUT}" stroke-width="1.8"/></g>`;
    },

    /* ── СЛУЖИТ (лапки вверх, как на фото у ноги хозяйки) ── */
    beg() {
      const pawUp = (delay) => `<g class="a-beg-paws" style="animation-delay:${delay}">
        <path d="M -5,0 L -5,-22 Q -5,-29 0,-29 Q 5,-29 5,-22 L 5,0 Z"
          fill="${LEG}" stroke="${OUT}" stroke-width="2" transform="rotate(-16)"/>
        <circle cx="7" cy="-28" r="8" fill="${PAW}"/></g>`;
      return `<g class="a-beg-bounce">
        <g transform="translate(-32 -26)">${tail('a-tail-wag')}</g>
        <ellipse cx="0" cy="-32" rx="44" ry="34" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
        <ellipse cx="-20" cy="-4" rx="15" ry="7.5" fill="${PAW}"/>
        <ellipse cx="20" cy="-4" rx="15" ry="7.5" fill="${PAW}"/>
        <ellipse cx="2" cy="-86" rx="28" ry="44" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
        ${chestFluff(10, -110)}
        <g transform="translate(-10 -98)">${pawUp('0s')}</g>
        <g transform="translate(18 -96)">${pawUp('-0.4s')}</g>
        ${head({ x: 2, y: -142, tiltAnim: true })}
      </g>`;
    },

    /* ── ИДЁТ / БЕЖИТ ── */
    walk() {
      return `<g class="a-lean">
        <g transform="translate(-26 -50)"><g class="ph-b">${walkLeg(LEG_FAR, '#2b2a33')}</g></g>
        <g transform="translate(36 -50)"><g class="ph-a">${walkLeg(LEG_FAR, '#2b2a33')}</g></g>
        <g transform="translate(-50 -66)">${tail('a-tail-sway')}</g>
        <g class="a-walk-bob">
          <ellipse cx="0" cy="-60" rx="54" ry="31" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
          <path d="M -44,-40 q 7,12 14,2 q 7,11 14,1 q 7,11 14,1 q 7,10 14,0 q 7,9 13,-1 L 46,-52 L -44,-52 Z"
            fill="${FLUFF}" opacity="0.9"/>
          ${head({ x: 46, y: -94 })}
        </g>
        <g transform="translate(-36 -52)"><g class="ph-a">${walkLeg(LEG)}</g></g>
        <g transform="translate(26 -52)"><g class="ph-b">${walkLeg(LEG)}</g></g>
      </g>`;
    },

    /* ── СПИТ ПЛАШМЯ НА БОКУ (как на ковре с фото) ── */
    sleep() {
      return `
        <g transform="translate(-56 -12)">${tail('')}</g>
        <g class="a-breathe">
          <ellipse cx="0" cy="-21" rx="58" ry="23" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
          <path d="M -40,-36 q 8,6 16,1 q 8,6 16,1 q 8,6 16,1 q 8,5 15,0"
            stroke="${FLUFF_HI}" stroke-width="3.5" fill="none" opacity="0.5"/>
        </g>
        <g transform="translate(34 -10)">
          <rect x="0" y="-6" width="34" height="11" rx="5.5" fill="${LEG}" stroke="${OUT}" stroke-width="2"/>
          <circle cx="34" cy="-0.5" r="7" fill="${PAW}"/>
        </g>
        <g transform="translate(30 -22)">
          <rect x="0" y="-6" width="30" height="11" rx="5.5" fill="${LEG_FAR}" stroke="${OUT}" stroke-width="2"/>
          <circle cx="30" cy="-0.5" r="7" fill="${PAW}"/>
        </g>
        <g transform="translate(-52 -4) scale(0.94)">${head({ eyes: 'closed', tilt: -18, blep: true })}</g>`;
    },

    /* ── НЮХАЕТ ПОЛ ── */
    sniff() {
      return `
        <g transform="translate(-26 -50)"><g class="ph-b">${walkLeg(LEG_FAR, '#2b2a33')}</g></g>
        <g transform="translate(36 -50)"><g class="ph-a">${walkLeg(LEG_FAR, '#2b2a33')}</g></g>
        <g transform="translate(-50 -64)">${tail('a-tail-wag')}</g>
        <ellipse cx="0" cy="-58" rx="54" ry="31" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
        <path d="M -44,-38 q 7,12 14,2 q 7,11 14,1 q 7,11 14,1 q 7,10 14,0 q 7,9 13,-1 L 46,-50 L -44,-50 Z"
          fill="${FLUFF}" opacity="0.9"/>
        <g transform="translate(52 -46) rotate(44)">
          <g class="head-in">
            <ellipse cx="0" cy="-36" rx="40" ry="37" fill="${BODY}" stroke="${OUT}" stroke-width="2.5"/>
            <g transform="translate(-33 -60)"><g class="ear-in a-ear-flop">${EAR}</g></g>
            <g transform="translate(33 -60) scale(-1 1)"><g class="ear-in ear-right a-ear-flop">${EAR}</g></g>
            ${brow(-16)}${brow(16, true)}
            ${eye(-15, 'open', '-2.1s')}
            ${eye(15, 'open', '-2.13s')}
            <g class="a-sniff">${beardMuzzle({})}</g>
            <g transform="translate(0 -4)">
              <rect x="-26" y="-6" width="52" height="13" rx="6.5" fill="#26252c" stroke="${OUT}" stroke-width="1.6"/>
              <path d="M -18,-6 l -4,13 M -8,-6 l -4,13 M 2,-6 l -4,13 M 12,-6 l -4,13 M 21,-6 l -4,13"
                stroke="#f3f0e8" stroke-width="4" stroke-linecap="round"/>
            </g>
          </g>
        </g>
        <g transform="translate(-36 -52)"><g class="ph-a">${walkLeg(LEG)}</g></g>
        <g transform="translate(26 -52)"><g class="ph-b">${walkLeg(LEG)}</g></g>`;
    },
  };

  function faceIcon() {
    return `<svg viewBox="-66 -114 132 132" xmlns="http://www.w3.org/2000/svg">
      <g>${head({ noCollar: true })}</g></svg>`;
  }

  window.DogArt = { poses, faceIcon, colors: { BODY: '#33323c' } };
})();
