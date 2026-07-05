/* ═══ FX — частицы, пузыри реплик, облако потасовки (SVG) ═══ */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  let layer = null;

  const HEART_PATH = 'M0,4 C-1,-2 -9,-3 -9,3 C-9,8 -3,11 0,14 C3,11 9,8 9,3 C9,-3 1,-2 0,4 Z';
  const STAR_PATH = 'M0,-10 L2.6,-3 L10,-3 L4,1.6 L6.4,9 L0,4.6 L-6.4,9 L-4,1.6 L-10,-3 L-2.6,-3 Z';
  const SPARK_PATH = 'M0,-9 L1.8,-1.8 L9,0 L1.8,1.8 L0,9 L-1.8,1.8 L-9,0 L-1.8,-1.8 Z';

  function el(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function wrap(x, y, cls, style) {
    const w = el('g', { transform: `translate(${x} ${y})` });
    const inner = el('g', {});
    if (cls) inner.setAttribute('class', cls);
    if (style) inner.setAttribute('style', style);
    w.appendChild(inner);
    layer.appendChild(w);
    return { w, inner };
  }

  function autoRemove(node, ms) {
    setTimeout(() => node.remove(), ms);
  }

  const FX = {
    init() { layer = document.getElementById('fx-layer'); },

    hearts(x, y, n = 4, big = false) {
      const cols = ['#ff6fa0', '#ff8fb5', '#ffb3cd', '#ff5d8f'];
      for (let i = 0; i < n; i++) {
        const dx = (Math.random() - 0.5) * 70;
        const sx = (Math.random() - 0.5) * 60;
        const s = (big ? 1.6 : 1) * (0.8 + Math.random() * 0.7);
        const { w, inner } = wrap(x + dx, y - Math.random() * 30, 'fx-heart',
          `--sx:${sx}px; animation-delay:${i * 70}ms`);
        const p = el('path', { d: HEART_PATH, fill: cols[i % cols.length], transform: `scale(${s})` });
        p.setAttribute('stroke', '#fff');
        p.setAttribute('stroke-width', '1.2');
        inner.appendChild(p);
        autoRemove(w, 1400 + i * 70);
      }
    },

    stars(x, y, n = 6) {
      const cols = ['#ffd166', '#ffe28a', '#ff9f68', '#fff3b0'];
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
        const r = 55 + Math.random() * 45;
        const { w, inner } = wrap(x, y, 'fx-burst',
          `--dx:${Math.cos(a) * r}px; --dy:${Math.sin(a) * r - 20}px`);
        inner.appendChild(el('path', {
          d: STAR_PATH, fill: cols[i % cols.length],
          stroke: '#e8862a', 'stroke-width': '1', transform: `scale(${0.9 + Math.random() * 0.8})`,
        }));
        autoRemove(w, 800);
      }
    },

    dust(x, y) {
      for (let i = 0; i < 2; i++) {
        const { w, inner } = wrap(x + (Math.random() - 0.5) * 26, y - Math.random() * 8, 'fx-dust',
          `--dx:${(Math.random() - 0.5) * 50}px`);
        inner.appendChild(el('circle', { r: 8 + Math.random() * 7, fill: '#e9cfa8', opacity: 0.8 }));
        autoRemove(w, 700);
      }
    },

    sparkle(x, y, n = 5, color = '#fff3b0') {
      for (let i = 0; i < n; i++) {
        const { w, inner } = wrap(
          x + (Math.random() - 0.5) * 90,
          y - Math.random() * 90,
          'fx-sparkle', `animation-delay:${i * 90}ms`);
        inner.appendChild(el('path', {
          d: SPARK_PATH, fill: color, stroke: '#ffd166', 'stroke-width': '1',
          transform: `scale(${0.7 + Math.random() * 0.9})`,
        }));
        autoRemove(w, 1000 + i * 90);
      }
    },

    ripple(x, y) {
      const { w, inner } = wrap(x, y, 'fx-ripple');
      inner.appendChild(el('circle', { r: 30, fill: 'none', stroke: '#ffffff', 'stroke-width': 5, opacity: 0.9 }));
      autoRemove(w, 550);
    },

    zzzStart(getPos) {
      const iv = setInterval(() => {
        const p = getPos();
        if (!p) return;
        const { w, inner } = wrap(p.x, p.y, 'fx-zzz');
        const t = el('text', {
          'font-size': 30 + Math.random() * 14, 'font-weight': 900,
          fill: '#7f9bd1', stroke: '#fff', 'stroke-width': 1, 'paint-order': 'stroke',
        });
        t.textContent = 'Z';
        inner.appendChild(t);
        autoRemove(w, 2500);
      }, 900);
      return { stop: () => clearInterval(iv) };
    },

    bubble(x, y, text, ms = 900) {
      const { w, inner } = wrap(x, y, 'fx-bubble');
      const pad = 16;
      const t = el('text', {
        'font-size': 34, 'font-weight': 900, fill: '#6b3a1c',
        'text-anchor': 'middle', x: 0, y: -34,
        'font-family': 'inherit',
      });
      t.textContent = text;
      inner.appendChild(el('path', { d: 'M0,0 L-10,-16 L14,-16 Z', fill: '#fff' }));
      const bg = el('rect', { x: 0, y: 0, rx: 16, fill: '#fff', stroke: '#f0d9b8', 'stroke-width': 3 });
      inner.insertBefore(bg, t.nextSibling);
      inner.appendChild(t);
      layer.appendChild(w);
      // размер по тексту
      requestAnimationFrame(() => {
        try {
          const bb = t.getBBox();
          bg.setAttribute('x', bb.x - pad);
          bg.setAttribute('y', bb.y - pad * 0.6);
          bg.setAttribute('width', bb.width + pad * 2);
          bg.setAttribute('height', bb.height + pad * 1.2);
        } catch (e) { /* элемент мог исчезнуть */ }
      });
      setTimeout(() => inner.classList.add('out'), ms);
      autoRemove(w, ms + 250);
    },

    exclaim(x, y, txt = '?!') { this.bubble(x, y, txt, 750); },

    pop(x, y, color = '#fff') {
      const { w, inner } = wrap(x, y, 'fx-pop');
      inner.appendChild(el('circle', { r: 26, fill: 'none', stroke: color, 'stroke-width': 8, opacity: 0.85 }));
      autoRemove(w, 450);
    },

    bigHeart(x, y) {
      const { w, inner } = wrap(x, y, 'fx-bigheart');
      inner.appendChild(el('path', {
        d: HEART_PATH, fill: '#ff5d8f', stroke: '#fff', 'stroke-width': 1.6,
        transform: 'scale(5.5)',
      }));
      autoRemove(w, 1600);
    },

    confetti(n = 44) {
      const cols = ['#ff6fa0', '#ffd166', '#7fd4d4', '#9ee6b8', '#b79ded', '#ff9f68'];
      for (let i = 0; i < n; i++) {
        const x = Math.random() * 1200;
        const t = 1.9 + Math.random() * 1.1;
        const { w, inner } = wrap(x, -30 - Math.random() * 160, 'fx-confetti',
          `--dx:${(Math.random() - 0.5) * 260}px; --t:${t}s`);
        if (Math.random() < 0.5) {
          inner.appendChild(el('rect', {
            x: -7, y: -5, width: 14, height: 10, rx: 2,
            fill: cols[i % cols.length],
          }));
        } else {
          inner.appendChild(el('circle', { r: 6, fill: cols[i % cols.length] }));
        }
        autoRemove(w, t * 1000 + 200);
      }
    },

    /* Облако потасовки: пёс треплет кота — комично, торчат лапы и звёзды */
    tussleCloud(x, y) {
      const g = el('g', { transform: `translate(${x} ${y})` });
      const shake = el('g', { class: 'a-shake' });
      g.appendChild(shake);

      const puffs = el('g', { class: 'fx-cloud-puff' });
      [[-52, 6, 44], [0, -22, 56], [54, 4, 46], [18, 22, 42], [-24, 26, 40]].forEach(([px, py, r]) => {
        puffs.appendChild(el('ellipse', {
          cx: px, cy: py, rx: r, ry: r * 0.82,
          fill: '#ffffff', stroke: '#e8dcc8', 'stroke-width': 4,
        }));
      });
      shake.appendChild(puffs);

      const spin = el('g', { class: 'a-spin-slow' });
      // торчащие лапки кота и пса + звёзды
      const catPaw = el('g', { transform: 'translate(-58 -34)' });
      catPaw.appendChild(el('rect', { x: -8, y: -30, width: 16, height: 34, rx: 8, fill: '#5b3a28' }));
      catPaw.appendChild(el('circle', { cx: 0, cy: -32, r: 10, fill: '#48291b' }));
      const dogPaw = el('g', { transform: 'translate(58 30) rotate(180)' });
      dogPaw.appendChild(el('rect', { x: -9, y: -30, width: 18, height: 34, rx: 9, fill: '#33323c' }));
      dogPaw.appendChild(el('circle', { cx: 0, cy: -32, r: 11, fill: '#232229' }));
      spin.appendChild(catPaw);
      spin.appendChild(dogPaw);
      [[0, -66], [64, -14], [-66, 22]].forEach(([sx, sy]) => {
        spin.appendChild(el('path', {
          d: STAR_PATH, fill: '#ffd166', stroke: '#e8862a', 'stroke-width': 1,
          transform: `translate(${sx} ${sy}) scale(1.1)`,
        }));
      });
      shake.appendChild(spin);
      layer.appendChild(g);

      const burstIv = setInterval(() => {
        FX.stars(x + (Math.random() - 0.5) * 60, y - 20, 2);
      }, 380);

      return {
        node: g,
        end() {
          clearInterval(burstIv);
          FX.pop(x, y, '#ffd166');
          FX.stars(x, y, 8);
          g.remove();
        },
      };
    },
  };

  window.FX = FX;
})();
