/* ============================================================
   REVEAL — the section unlock stage.

   Spec: `ANIMATIONS.md` §1 (effect A) and §4 (shared
   requirements). This module is the whole of the block swap;
   `animations.js` stays the hero/status-strip choreographer and
   does not grow this concern.

   What it owns, and nothing else writes any of it:

     the `hidden` attribute on both panes
     `clip-path` on both panes
     the stage's inline `height`, and only while sweeping
     the beam's `top`

   ctf.js goes on writing its display classes on `.challenge` /
   `.reveal`; the stylesheet neutralises them inside a ready stage,
   so they are the no-stage fallback rather than a second opinion.

   ── TWO DEVIATIONS FROM THE SPEC, BOTH REQUESTED ────────────
   1. NO EFFECT B. `ANIMATIONS.md` §2 and §3 have the revealed text
      resolving out of scrambled ciphertext in the beam's wake,
      composed through the same proxy. Built, seen, and cut: the
      beam alone is the effect, and the churn was noise on top of
      it. §3's shared-proxy argument only ever existed to stop the
      two reading as a queue — with one effect there is no queue,
      and no `textContent` writer left in this module.

   2. BYPASS SWEEPS. §5 has bypass jumping straight to `unlocked`
      with no beam. It now runs the same sweep the solves do, three
      of them staggered, because a switch that opens three sections
      is still worth watching. Bypass *off* is unchanged and stays
      instant — going back is not a payoff and should not be paced
      like one.

   ── AND ONE THAT IS NOT ─────────────────────────────────────
   `ANIMATIONS.md` §4 has both panes absolutely positioned for the
   whole of the stage's life, the stage carrying a measured pixel
   height, and a debounced resize handler re-measuring behind a
   busy set.

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

/* Effect A, `ANIMATIONS.md` §1, every beat of it a half longer
   than the spec's. ~1.77s end to end. It was already slower than a
   UI transition on purpose — it is the payoff for solving
   something — and at 1.0s the beam still crossed a short section
   faster than the eye tracks it. Scale these together or the beam
   fades out somewhere other than the end of its own travel. */
const SWEEP = 1.5;
const BEAM_IN = 0.15;
const BEAM_OUT = 0.3;
const SWEEP_START = 0.09;
/* How far before the sweep ends the beam starts leaving, so it is
   gone as it lands rather than blinking out after it. */
const BEAM_OUT_LEAD = 0.165;

/* Bypass opens every locked section at once, which without this is
   three beams running in lockstep — one gesture read three times.
   The stagger from `PLAN.md` §3's bypass run, so the page has one
   idea of what "all at once, but sequenced" means. */
const BYPASS_STAGGER = 0.08;

/* A sweep that never finishes must not leave a section clipped
   shut. Backgrounding the tab stops the frames, so this is what
   guarantees the end state to anyone who leaves and comes back. */
const SAFETY = (SWEEP + BEAM_OUT + 1) * 1000;

export function initReveal({ gsap = null, prefersReducedMotion = false } = {}) {
  const stages = Array.from(document.querySelectorAll('[data-stage]'));
  if (!stages.length) return;

  /* Motion is the enhancement, state is the guarantee — the same
     split hud.js makes. Without GSAP, or under reduced motion,
     every route below lands on an identical end state with no
     tween and no beam. */
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
    const beam = item.stage.querySelector('.beam');
    if (beam) beam.remove();
    busy.delete(item);
  }

  /* ── THE SWEEP ──────────────────────────────────────────────
     One proxy drives both clip-paths and the beam, so the three
     cannot drift apart: the beam is exactly the seam between the
     pane closing above it and the one opening below.

     The stage's height is the one thing on a tween of its own. It
     runs the same window and the same ease, but it is a layout
     property, and driving it from the proxy would put a style
     write and a layout read in the same frame.

     `delay` is bypass's stagger. It elapses with the stage already
     rigged — height pinned, panes absolute, content clipped fully
     shut — which is pixel-identical to the locked state it is
     still showing, so the wait is invisible. */
  function sweep(item, delay = 0) {
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
    /* No `aria-busy` here, deliberately. The spec asks for it, but
       its reason was that scrambling text is garbage mid-flight —
       and nothing scrambles any more. The content is final and
       correct from the first frame and merely clipped, which is a
       visual state; hiding it from assistive tech for the length
       of the sweep would take it away for no benefit. */
    content.style.clipPath = 'inset(0 0 100% 0)';
    locked.style.clipPath = 'inset(0% 0 0 0)';

    const beam = document.createElement('i');
    beam.className = 'beam';
    beam.setAttribute('aria-hidden', 'true');
    stage.append(beam);

    const p = { v: 0 };

    item.tl = gsap.timeline({
      delay,
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
            content.style.clipPath = `inset(0 0 ${(1 - p.v) * 100}% 0)`;
            locked.style.clipPath = `inset(${p.v * 100}% 0 0 0)`;
            beam.style.top = `${p.v * hMax}px`;
          },
        },
        SWEEP_START,
      )
      .to(stage, { height: hC, duration: SWEEP, ease: 'power2.inOut' }, SWEEP_START)
      .to(beam, { opacity: 0, duration: BEAM_OUT }, SWEEP_START + SWEEP - BEAM_OUT_LEAD);

    /* The end state is a promise, not a side effect of frames
       arriving. A backgrounded tab stops the timeline where it
       stands; this is what settles it anyway. */
    item.safety = window.setTimeout(() => {
      if (!busy.has(item)) return;
      stop(item);
      paint(item, 'unlocked');
    }, SAFETY + delay * 1000);
  }

  /* ── ENTRY ──────────────────────────────────────────────────
     The same `ctf:state` every other module listens to. Two routes
     animate — a live solve, and bypass being switched on — and
     everything else is a flat jump: `reason: 'init'`, bypass going
     back off, and any section already open.

     A section that is already `unlocked` is never swept. That is
     what stops bypass replaying the reveal of a section somebody
     earned a minute ago, and it is the same test that stops a
     second solve of one section re-running it. */
  document.addEventListener('ctf:state', (event) => {
    const detail = event.detail;

    /* Counts only the sections this event actually opens, so the
       stagger has no gaps in it when one of the three was already
       solved before the switch was thrown. */
    let step = 0;

    items.forEach((item) => {
      const open = detail.solved[item.index] || detail.bypass;
      const shut = item.state !== 'unlocked';

      const solving =
        detail.reason === 'solve' && detail.index === item.index && shut;
      const bypassing = detail.reason === 'bypass-on' && open && shut;

      if ((solving || bypassing) && animate) {
        stop(item);
        sweep(item, bypassing ? step++ * BYPASS_STAGGER : 0);
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
