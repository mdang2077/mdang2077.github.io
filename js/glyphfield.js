/* ============================================================
   GLYPH FIELD — the hero background.

   `ANIMATIONS.md` §7 (effect C) is authoritative for the
   constants, the mask, and the coupling; this file implements it.

   A fixed grid of monospace characters behind the lockup. The grid
   never moves. One cell rerolls its character per frame and flashes
   near-white for ~400ms before settling, so the field reads as a
   system under load rather than as data flowing past.

   The module owns one number the outside world may touch:
   `state.master`, a 0..1 multiplier on every cell's alpha. js/lock.js
   tweens it, and nothing else about the field is GSAP-driven.
   ============================================================ */

/* Both are locked values off the prototype's sliders, not defaults
   to tune. `ANIMATIONS.md` §7.2: at CHURN = 0.01 the reroll
   expression floors to one cell per frame, so a given cell changes
   about once every 24 seconds. If the field reads wrong on screen
   the lever is CHURN, never DENSITY. */
const DENSITY = 1.0;
const CHURN = 0.01;

/* Cell advance and type size. The font is the site's mono stack,
   read off the token rather than hardcoded. */
const CW = 15;
const CH = 25;
const FONT_PX = 13;

/* §7.7 asks for the cell count to be halved below 768px, by raising
   the advance rather than shrinking the type. That rule is written
   against "a 1440-cell grid on a phone", which is a grid this hero
   never builds: the band is ~197px tall at 390px wide, so the desktop
   advance already yields ~210 cells there. Halving *that* produced a
   scatter of ~110 characters — the sparse, arbitrary look §7.2 says
   dropping DENSITY causes, bought for no budget that was in danger.

   So the guard is the budget itself rather than the viewport: raise
   the advance only when a narrow viewport would actually build a
   grid over MOBILE_BUDGET, and only by enough to land on it. On a
   phone in portrait nothing changes; on a landscape phone or a small
   tablet, where the band grows, it engages. The type stays 13px
   either way, which is the part of §7.7 that matters. */
const MOBILE_BUDGET = 700;
const MOBILE_MAX = 768;

const FLASH_MS = 400;
const DPR_CAP = 2;

/* Hex, operators and brackets — ciphertext, not katakana. The site
   is a terminal, and the section challenges are hex and base64. */
const CHARS = '0123456789ABCDEF!<>/\\|=+-*#$%&_[]{}()^~?:;.,';

/* Horizontal falloff, then a gentler vertical one. This is the
   whole difference between atmospheric and noisy: at DENSITY = 1
   the name is unreadable without it at ANY opacity, which was
   tested rather than assumed. §7.3 carries the horizontal stops
   verbatim; the vertical pair only softens the band's own edges. */
const MASK_X = [
  [0.0, 1.0],
  [0.2, 0.55],
  [0.42, 0.0],
  [0.58, 0.0],
  [0.8, 0.55],
  [1.0, 1.0],
];
/* The vertical pair is short and lands on zero at both edges. It is
   not there to hide anything — it is there because the grid is cut
   by the band's box, and a half-drawn row of glyphs along a straight
   edge reads as a rendering bug rather than as a field. */
const MASK_Y = [
  [0.0, 0.0],
  [0.12, 1.0],
  [0.88, 1.0],
  [1.0, 0.0],
];

const noop = () => {};

/* Any CSS colour in, `#rrggbb` out: assigning to fillStyle and
   reading it back is the parser the platform already ships. */
function toRgb(value, fallback) {
  const probe = document.createElement('canvas').getContext('2d');
  probe.fillStyle = fallback;
  probe.fillStyle = value.trim() || fallback;
  const hex = probe.fillStyle;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

const mix = (c, t, k) => ({
  r: Math.round(c.r + (t.r - c.r) * k),
  g: Math.round(c.g + (t.g - c.g) * k),
  b: Math.round(c.b + (t.b - c.b) * k),
});

const rgba = (c, a) => `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;

export function initGlyphField({ prefersReducedMotion = false } = {}) {
  const canvas = document.querySelector('[data-glyph-field]');
  if (!canvas) {
    return {
      state: { master: 0 },
      draw: noop,
      reseed: noop,
      destroy: noop,
    };
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      state: { master: 0 },
      draw: noop,
      reseed: noop,
      destroy: noop,
    };
  }

  /* The one value the lock touches. */
  const state = { master: 1 };

  /* Three offscreen canvases and why each exists:

       base — every glyph at its own alpha, in the theme colour. A
              reroll repaints ONE cell of it, so the per-frame cost
              is a single drawImage instead of ~1440 fillText calls
              beside a live WebGL context.
       mask — the falloff, composited once per frame with
              destination-in rather than two gradient fills.

     Without the base cache this effect is the one thing in phase 5c
     that could actually cost frames. */
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d');
  const mask = document.createElement('canvas');
  const mctx = mask.getContext('2d');

  let dpr = 1;
  let w = 0;
  let h = 0;
  let cols = 0;
  let rows = 0;
  let cw = CW;
  let ch = CH;

  /* Parallel arrays, not objects: one allocation per rebuild and
     nothing per frame. */
  let chars = new Uint8Array(0);
  let alphas = new Float32Array(0);
  let flashAt = new Float64Array(0);
  let live = new Uint8Array(0);

  let font = `${FONT_PX}px ${
    getComputedStyle(document.documentElement)
      .getPropertyValue('--font-mono')
      .trim() || 'monospace'
  }`;

  let ink = { r: 0, g: 255, b: 136 };
  let flashInk = { r: 255, g: 255, b: 255 };

  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    /* `--field-ink` is the field's own colour, and the only reason it
       exists is that the two themes disagree about what this effect
       is made of. Dark resolves it to the solved/active green, per
       §7.6. Light cannot: see the token's note in css/tokens.css. */
    ink = toRgb(
      cs.getPropertyValue('--field-ink') || cs.getPropertyValue('--success'),
      '#00ff88',
    );
    /* §7.6 asks for a near-white tint on the freshly changed cell.
       Read literally that only works in the dark: near-white on
       paper would make a flashing glyph *vanish* into the ground
       rather than flash. What the rule means is "toward maximum
       contrast with the page", so the target is the page's own text
       colour — near-white on dark, near-black on paper — and the
       flash is a tint of the ink either way, not a second colour. */
    const target = toRgb(cs.getPropertyValue('--text'), '#ffffff');
    flashInk = mix(ink, target, 0.82);
    font = `${FONT_PX}px ${cs.getPropertyValue('--font-mono').trim() || 'monospace'}`;
  }

  /* ── THE TWO ALPHA RANGES ───────────────────────────────────
     Not one range with a swapped colour. Dark is §7.6's
     `0.22 + random*0.6` verbatim; light is lower because its ink
     (`--light-field-ink`) is dark on a light ground rather than
     bright on a dark one, and the same numbers there would put the
     field in front of the name instead of behind it. Both were
     chosen against the real page, in both themes. */
  const ALPHA = {
    dark: { floor: 0.22, range: 0.6 },
    light: { floor: 0.1, range: 0.22 },
  };

  const alphaScale = () =>
    document.documentElement.dataset.theme === 'light'
      ? ALPHA.light
      : ALPHA.dark;

  function seed() {
    const { floor, range } = alphaScale();
    for (let i = 0; i < chars.length; i += 1) {
      chars[i] = Math.floor(Math.random() * CHARS.length);
      alphas[i] = floor + Math.random() * range;
      /* DENSITY = 1.00 makes every cell live; the filter exists so
         the constant means what §7.2 says it means. */
      live[i] = Math.random() < DENSITY ? 1 : 0;
      flashAt[i] = -Infinity;
    }
  }

  function paintCell(i) {
    const col = i % cols;
    const row = (i - col) / cols;
    const x = col * cw;
    const y = row * ch;
    bctx.clearRect(x, y, cw, ch);
    if (!live[i]) return;
    bctx.fillStyle = rgba(ink, alphas[i]);
    bctx.fillText(CHARS[chars[i]], x, y + ch * 0.75);
  }

  function paintBase() {
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, w, h);
    bctx.font = font;
    bctx.textBaseline = 'alphabetic';
    for (let i = 0; i < chars.length; i += 1) paintCell(i);
  }

  function paintMask() {
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, w, h);

    const gx = mctx.createLinearGradient(0, 0, w, 0);
    MASK_X.forEach(([stop, a]) => gx.addColorStop(stop, `rgba(0, 0, 0, ${a})`));
    mctx.fillStyle = gx;
    mctx.fillRect(0, 0, w, h);

    const gy = mctx.createLinearGradient(0, 0, 0, h);
    MASK_Y.forEach(([stop, a]) => gy.addColorStop(stop, `rgba(0, 0, 0, ${a})`));
    mctx.globalCompositeOperation = 'destination-in';
    mctx.fillStyle = gy;
    mctx.fillRect(0, 0, w, h);
    mctx.globalCompositeOperation = 'source-over';
  }

  function build() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

    let spacing = 1;
    if (window.innerWidth < MOBILE_MAX) {
      const n = Math.ceil(w / CW) * Math.ceil(h / CH);
      if (n > MOBILE_BUDGET) spacing = Math.sqrt(n / MOBILE_BUDGET);
    }
    cw = CW * spacing;
    ch = CH * spacing;

    [canvas, base, mask].forEach((c) => {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    });

    cols = Math.max(1, Math.ceil(w / cw));
    rows = Math.max(1, Math.ceil(h / ch));
    const n = cols * rows;

    chars = new Uint8Array(n);
    alphas = new Float32Array(n);
    flashAt = new Float64Array(n);
    live = new Uint8Array(n);

    readTheme();
    seed();
    paintBase();
    paintMask();
  }

  /* One reroll per frame at the locked constants — §7.2's
     expression verbatim, so the arithmetic stays auditable against
     the spec rather than being pre-solved to `1`. */
  const rerollCount = () =>
    Math.max(1, Math.round(rows * cols * CHURN * 0.01));

  function churn(now) {
    const n = rerollCount();
    for (let k = 0; k < n; k += 1) {
      const i = Math.floor(Math.random() * chars.length);
      if (!live[i]) continue;
      chars[i] = Math.floor(Math.random() * CHARS.length);
      flashAt[i] = now;
      paintCell(i);
    }
  }

  function draw(now = performance.now()) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const m = state.master;
    if (m <= 0.002) return;

    ctx.globalAlpha = m;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* The flash. At most ~24 cells are inside the 400ms window at
       one reroll per frame, so this loop draws a handful of glyphs,
       not a field. */
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < flashAt.length; i += 1) {
      const age = now - flashAt[i];
      if (age < 0 || age > FLASH_MS) continue;
      const k = 1 - age / FLASH_MS;
      const col = i % cols;
      const row = (i - col) / cols;
      ctx.globalAlpha = m * k * 0.85;
      ctx.fillStyle = rgba(flashInk, 1);
      ctx.fillText(CHARS[chars[i]], col * cw, row * ch + ch * 0.75);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  build();
  draw();

  /* ── LOOP ───────────────────────────────────────────────────
     Gated on the hero being on screen and the tab foregrounded.
     The hero leaves the viewport within one scroll, and a field
     churning for a page nobody is looking at is pure battery.

     Under reduced motion there is no loop at all: one frame is
     drawn above and redrawn only when the lock moves `master`. */
  let running = !prefersReducedMotion;
  let visible = true;

  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  });
  io.observe(canvas);

  function tick(now) {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    if (state.master > 0.002) churn(now);
    draw(now);
  }

  if (running) requestAnimationFrame(tick);

  /* The grid is rebuilt on resize, never scaled — a stretched
     glyph grid reads as a stretched image. */
  let resizePending = false;
  function onResize() {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => {
      resizePending = false;
      build();
      draw();
    });
  }
  window.addEventListener('resize', onResize);

  function onThemeChange() {
    readTheme();
    seed();
    paintBase();
    draw();
  }
  document.addEventListener('theme:change', onThemeChange);

  /* display=swap means the first frames can land in the fallback
     mono. One repaint when JetBrains Mono arrives. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      readTheme();
      paintBase();
      draw();
    });
  }

  return {
    state,
    /* Redraw one frame. The paused paths — reduced motion, and the
       lock snapping between states without animating — call this
       instead of waiting for a loop that is not running. */
    draw: () => draw(),
    /* A relock is a NEW encryption, not the same one returning. */
    reseed: () => {
      seed();
      paintBase();
    },
    destroy() {
      running = false;
      io.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('theme:change', onThemeChange);
    },
  };
}
