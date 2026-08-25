/* ============================================================
   REVEAL — the section unlock stage.

   Spec: `ANIMATIONS.md` §1 (effect A), §3 (how A and B compose),
   §4 (the shared requirements). This module is the whole of the
   block swap; `animations.js` stays the hero/status-strip
   choreographer and does not grow this concern.

   What it owns, and nothing else writes any of it:

     the `hidden` attribute on both panes
     `clip-path` on both panes
     the stage's inline `height`, and only while sweeping
     the beam's `top`
     `textContent` on the leaf text nodes it collected

   That list is `ANIMATIONS.md` §3's hard rule made concrete: the
   scanline writes geometry, the scramble writes text, and neither
   touches the other's property. ctf.js goes on writing its display
   classes on `.challenge` / `.reveal`; the stylesheet neutralises
   them inside a ready stage, so they are the no-stage fallback
   rather than a second opinion.

   ── ONE DEVIATION FROM THE SPEC, AND WHY ────────────────────
   `ANIMATIONS.md` §4 has both panes absolutely positioned for the
   whole of the stage's life, the stage carrying a measured pixel
   height, and a debounced resize handler re-measuring — guarded by
   a busy set, because re-measuring mid-sweep snaps the section
   back to locked.

   Here the panes go absolute *only during the sweep*. Settled, the
   visible pane is in normal flow and the stage has no inline
   height at all. The reason is not tidiness: a pinned height is
   wrong the moment anything inside the pane changes size, and
   something does — submitting a wrong answer prints
   `// incorrect. try again.` into `.challenge-msg`, which grows
   the locked pane inside a stage that is `overflow: hidden` at a
   height measured before the message existed. Late-loading webfonts
   and a rotated phone are the same bug arriving by other routes.

   Not pinning removes all three, and takes the resize handler with
   them: there is no stored height left to go stale, so there is
   nothing for a resize to clobber and nothing to guard. What the
   busy set still does is stop a second sweep starting on a section
   already sweeping. A resize *during* a sweep leaves that sweep
   tweening toward a height measured a moment earlier, and it lands
   on the real one anyway, because completion drops back to auto.
   ============================================================ */

/* Effect A, `ANIMATIONS.md` §1. Deliberately slower than a UI
   transition: it is the payoff for solving something, and the beam
   has to read as a scan rather than a flash. */
const SWEEP = 1.0;
const BEAM_IN = 0.1;
const BEAM_OUT = 0.2;
const SWEEP_START = 0.06;

/* Effect B, §2. Short, because each one starts in the beam's wake
   and has to resolve before the eye follows the beam down. */
const SCRAMBLE = 0.35;
const GLYPH = '!<>-_\\/[]{}—=+*^?#%01ABCDEF';

/* A sweep that never finishes must not leave a section clipped
   shut. Backgrounding the tab stops the frames, so this is what
   guarantees the end state to anyone who leaves and comes back. */
const SAFETY = (SWEEP + BEAM_OUT + 1) * 1000;

/* Text long enough to be worth decrypting. Under this a scramble
   reads as a flicker rather than as a decode. */
const MIN_SCRAMBLE = 3;

const randomGlyph = () => GLYPH[(Math.random() * GLYPH.length) | 0];

/* The innermost text-bearing nodes, per §2 — an element with no
   element children. Scrambling a container would rewrite its
   markup as a string sixty times a second and destroy everything
   nested inside it. */
function leafText(root) {
  const out = [];
  const walk = (el) => {
    const children = Array.from(el.children);
    if (!children.length) {
      const text = el.textContent;
      if (text && text.trim().length >= MIN_SCRAMBLE) out.push({ el, text });
      return;
    }
    children.forEach(walk);
  };
  walk(root);
  return out;
}

export function initReveal({ gsap = null, prefersReducedMotion = false } = {}) {
  const stages = Array.from(document.querySelectorAll('[data-stage]'));
  if (!stages.length) return;

  /* Motion is the enhancement, state is the guarantee — the same
     split hud.js makes. Without GSAP, or under reduced motion,
     every route below lands on an identical end state with no
     tween, no beam, and no scramble. */
  const animate = !!gsap && !prefersReducedMotion;

  const items = stages
    .map((stage, index) => ({
      index,
      stage,
      locked: stage.querySelector('[data-pane="locked"]'),
      content: stage.querySelector('[data-pane="content"]'),
      state: 'locked',
      tl: null,
      safety: null,
    }))
    .filter((item) => item.locked && item.content);

  if (!items.length) return;

  /* Sections with a sweep in flight. Membership is what makes a
     second solve of the same section, or a bypass landing mid-
     sweep, tear the first one down instead of racing it. */
  const busy = new Set();

  /* ── STATE, WITHOUT ANIMATION ───────────────────────────────
     §4's state model. `locked` and `unlocked` are both enterable
     flat, because a bypass and a returning visitor arrive at them
     without having watched anything happen. Every reduced-motion
     path collapses to this function too. */
  function paint(item, state) {
    item.state = state;
    const open = state === 'unlocked';

    item.stage.removeAttribute('data-sweeping');
    item.stage.style.height = '';

    item.locked.hidden = open;
    item.content.hidden = !open;

    /* Cleared, not parked at `inset(0 0 0% 0)`: a clip-path left
       on an element is a compositing layer left behind, and 0% is
       not identical to `none` for a box with a shadow. */
    item.locked.style.clipPath = '';
    item.content.style.clipPath = '';
    item.content.removeAttribute('aria-busy');
  }

  /* ── MEASUREMENT ────────────────────────────────────────────
     Called once, at the start of a sweep, and never stored. The
     locked pane is already in flow and visible, so it measures
     itself; the content pane is `hidden`, so it is shown for the
     length of one synchronous block. Nothing paints in between —
     the browser cannot render mid-script — so the reveal is not
     visible even though it is real. */
  function measure(item) {
    /* Both panes are in flow at this instant, so a trailing margin
       collapses out of them exactly as it does in the settled
       layout — which is the height the stage has to land on. The
       absolutely positioned pane will be that margin taller during
       the sweep, and the difference is empty space at the bottom
       of a box that is clipped there anyway. */
    const hL = item.locked.offsetHeight;

    const wasHidden = item.content.hidden;
    item.content.hidden = false;
    const hC = item.content.offsetHeight;
    item.content.hidden = wasHidden;

    return { hL, hC };
  }

  /* §2: whitespace never scrambles, so the text keeps its shape.
     Every glyph is one monospace cell wide, so a churning line
     cannot rewrap and shift what is under it. */
  function scramble(target) {
    const { el, text } = target;
    const p = { v: 0 };

    return gsap.to(p, {
      v: 1,
      duration: SCRAMBLE,
      ease: 'power2.out',
      onUpdate: () => {
        const cut = Math.floor(p.v * text.length);
        let out = '';
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          out += i < cut || ch === '\n' || ch === ' ' ? ch : randomGlyph();
        }
        el.textContent = out;
      },
      onComplete: () => {
        el.textContent = text;
      },
    });
  }

  /* Tear a sweep down and leave nothing of it behind. Safe to call
     on an item that is not sweeping. */
  function stop(item) {
    if (item.tl) {
      item.tl.kill();
      item.tl = null;
    }
    if (item.safety) {
      window.clearTimeout(item.safety);
      item.safety = null;
    }
    if (item.targets) {
      item.targets.forEach((t) => {
        if (t.tween) t.tween.kill();
        t.el.textContent = t.text;
      });
      item.targets = null;
    }
    const beam = item.stage.querySelector('.beam');
    if (beam) beam.remove();
    busy.delete(item);
  }

  /* ── THE SWEEP ──────────────────────────────────────────────
     One proxy drives the two clip-paths, the beam, and which text
     has started resolving. §3's whole argument is that a scanline
     followed by a scramble reads as two animations queued back to
     back; sharing the proxy is what makes the beam look like it is
     *doing* the decryption rather than announcing it.

     The stage's height is the one thing on a tween of its own. It
     runs the same window and the same ease, but it is a layout
     property, and driving it from the proxy would put a style
     write and a layout read in the same frame. */
  function sweep(item) {
    const { stage, locked, content } = item;
    const { hL, hC } = measure(item);
    const hMax = Math.max(hL, hC);

    item.state = 'unlocking';
    busy.add(item);

    /* Pin the height first, then take the panes out of flow, so
       the stage never passes through a frame with no content in it
       to hold it open. */
    stage.style.height = `${hL}px`;
    stage.dataset.sweeping = '';

    locked.hidden = false;
    content.hidden = false;
    /* Churning text is garbage to a screen reader. The section's
       own aria-live regions have already announced the solve, so
       muting the pane for the length of the sweep costs nothing. */
    content.setAttribute('aria-busy', 'true');
    content.style.clipPath = 'inset(0 0 100% 0)';
    locked.style.clipPath = 'inset(0% 0 0 0)';

    const beam = document.createElement('i');
    beam.className = 'beam';
    beam.setAttribute('aria-hidden', 'true');
    stage.append(beam);

    /* Captured now, while the pane is laid out and still. Reading
       offsetTop inside onUpdate would be a forced layout per
       element per frame. */
    item.targets = leafText(content).map((t) => ({
      ...t,
      top: t.el.offsetTop,
      started: false,
      tween: null,
    }));

    const p = { v: 0 };

    item.tl = gsap.timeline({
      onComplete: () => {
        stop(item);
        paint(item, 'unlocked');
      },
    });

    item.tl
      .to(beam, { opacity: 1, duration: BEAM_IN }, 0)
      .to(
        p,
        {
          v: 1,
          duration: SWEEP,
          ease: 'power2.inOut',
          onUpdate: () => {
            const beamY = p.v * hMax;
            content.style.clipPath = `inset(0 0 ${(1 - p.v) * 100}% 0)`;
            locked.style.clipPath = `inset(${p.v * 100}% 0 0 0)`;
            beam.style.top = `${beamY}px`;

            /* Effect B, started in the beam's wake. The wake is
               also what staggers them: §4 asks for a cap on
               concurrent scrambles and this is it, for free. */
            item.targets.forEach((t) => {
              if (t.started || t.top >= beamY) return;
              t.started = true;
              t.tween = scramble(t);
            });
          },
        },
        SWEEP_START,
      )
      .to(stage, { height: hC, duration: SWEEP, ease: 'power2.inOut' }, SWEEP_START)
      .to(beam, { opacity: 0, duration: BEAM_OUT }, SWEEP_START + SWEEP - 0.11);

    /* The end state is a promise, not a side effect of frames
       arriving. A backgrounded tab stops the timeline where it
       stands; this is what settles it anyway. */
    item.safety = window.setTimeout(() => {
      if (!busy.has(item)) return;
      stop(item);
      paint(item, 'unlocked');
    }, SAFETY);
  }

  /* ── ENTRY ──────────────────────────────────────────────────
     The same `ctf:state` every other module listens to. Only a
     live solve of a still-locked section animates; every other
     route in is a flat jump, which is the rule `reason: 'init'`
     established and bypass inherits. */
  document.addEventListener('ctf:state', (event) => {
    const detail = event.detail;

    items.forEach((item) => {
      const open = detail.solved[item.index] || detail.bypass;

      const solving =
        detail.reason === 'solve' &&
        detail.index === item.index &&
        item.state !== 'unlocked';

      if (solving && animate) {
        stop(item);
        sweep(item);
        return;
      }

      const target = open ? 'unlocked' : 'locked';
      if (item.state === target && !busy.has(item)) return;

      stop(item);
      paint(item, target);
    });
  });

  /* Ready last. The attribute is what lets the stylesheet start
     hiding panes, so nothing is hidden until this module is in a
     position to show it again. */
  items.forEach((item) => {
    item.stage.dataset.stageReady = '';
    paint(item, item.state);
  });
}
