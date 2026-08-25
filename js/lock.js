/* ============================================================
   LOCK — orchestrator for the hero padlock.

   Owns three things and delegates the rest:

     1. whether there is a lock at all — WebGL or nothing;
     2. the scroll shine, as one normalised scalar;
     3. the lock's state machine, `setState(state, { animate })`.

   There is no second rendering. If Three never loads, the GPU is
   blocklisted, or init throws, the stage is marked and collapses,
   and the lockup closes up to MARTIN DANG. That is a deliberate
   trade against `LOCK_SPEC.md` §6, which requires an SVG fallback:
   every piece of content on the page stays reachable in all of
   those cases, which is the constraint that actually matters, and
   a half-convincing flat padlock next to the real one was not
   worth the code it took.
   ============================================================ */

import { createLockScene } from './lock3d.js';

/* 0 = light hard left, 1 = hard right. One pass through the
   viewport is one sweep. */
const IDLE_AMPLITUDE = 0.175;
const IDLE_PERIOD = 5;
const NEUTRAL = 0.5;

const noop = () => {};

function hasWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl');
  } catch (e) {
    return false;
  }
}

const activeTheme = () =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

export function initLock({ prefersReducedMotion = false, gsap = null } = {}) {
  const stage = document.querySelector('[data-lock-stage]');
  if (!stage) return { setState: noop, destroy: noop };

  /* The band, not the lock, is what the sweep is measured against.
     See the trigger below. */
  const hero = stage.closest('.hero-band') || stage;

  let state = 'locked';
  let scene = null;

  /* ── THE SCALAR ─────────────────────────────────────────────
     0 puts the light hard left, 1 hard right. One value, one
     consumer, one write path: nothing else moves a light. */
  let p = prefersReducedMotion ? NEUTRAL : 0;

  function applyLight() {
    if (scene) scene.setLight(p);
  }

  /* ── STATE ──────────────────────────────────────────────────
     Three states, and the site can enter any of them without
     playing anything. Only a live solve animates. */
  /* A canvas is invisible to assistive tech, so the state lives on
     its aria-label. The announcement itself stays on the section —
     the progress role=status label and the .challenge-msg regions
     already carry it, and a third would announce one solve three
     times. With no canvas there is no lock and nothing to
     announce, which is correct. */
  function paintState(next) {
    if (!scene) return;
    scene.canvas.setAttribute(
      'aria-label',
      next === 'locked' ? 'Padlock, locked' : 'Padlock, unlocked',
    );
  }

  function setState(next, { animate = false } = {}) {
    if (next !== 'locked' && next !== 'unlocked') return;
    const previous = state;
    state = next;
    paintState(next);

    if (!scene) return;

    const tl = scene.timeline;
    const playable = animate && !prefersReducedMotion && previous !== next;

    if (!playable) {
      tl.progress(next === 'unlocked' ? 1 : 0).pause();
      return;
    }

    if (next === 'unlocked') {
      tl.timeScale(1).play();
    } else {
      /* Mechanisms close faster and harder than they open. Only
         bypass-off ever gets here; a real solve is never undone. */
      tl.timeScale(1 / 0.7).reverse();
    }
  }

  paintState(state);

  /* ── DRIVERS ────────────────────────────────────────────────
     Both need GSAP. Without it motion.css runs a CSS-only idle
     pass on the same registered property, so the fallback of the
     fallback is still a lit, moving lock. */
  let idleRunning = false;
  let idleTween = null;
  const scrubbed = { p: 0 };

  if (gsap && !prefersReducedMotion) {
    const ScrollTrigger = window.ScrollTrigger;

    if (ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);

      gsap.to(scrubbed, {
        p: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: hero,
          /* LOCK_SPEC §3 has `top bottom` -> `bottom top`, which is
             right for an element somewhere down the page and wrong
             for this one. The hero is the first thing on the page,
             so that range is already ~70% consumed before the
             visitor has scrolled a pixel — they would only ever see
             the tail of the sweep.

             Measuring from the band's own top instead means the
             full left-to-right pass happens over the hero's exit,
             and runs right-to-left on the way back up, which is
             what the scrub does for free. */
          start: 'top top',
          end: 'bottom top',
          /* Smoothing only. No pin, no sticky: the page scrolls at
             normal speed throughout. Hijacking scroll to play an
             animation is the failure mode this design avoids. */
          scrub: 0.5,
          onUpdate: (self) => {
            /* First scroll input hands control to the scrub. It
               does not come back on scroll-to-top: an ambient loop
               under a reader's cursor is noise. */
            if (self.progress > 0.001 && idleRunning) stopIdle();
          },
        },
        onUpdate: () => {
          if (idleRunning) return;
          p = scrubbed.p;
          applyLight();
        },
      });

      /* The hero sits at the top of the page, so on load the
         trigger is already partway through its range and p rests
         near the middle rather than at 0. Force it to be computed
         before the idle loop reads it, or the idle oscillates
         around the wrong centre and visibly jumps the moment the
         scrub takes over. */
      ScrollTrigger.refresh();
    }

    startIdle();
  }

  function startIdle() {
    if (idleRunning || !gsap) return;
    idleRunning = true;

    /* One pass out and back, starting and ending exactly where the
       scrub is resting — a raised cosine rather than a sine, so
       there is no step at either end and the handover to the scrub
       has nothing to jump from. At the top of the page the resting
       value is 0, so this is the light leaving the far left and
       coming back. */
    const rest = scrubbed.p;
    const swing = { t: 0 };

    idleTween = gsap.to(swing, {
      t: 1,
      duration: IDLE_PERIOD,
      ease: 'none',
      repeat: -1,
      onUpdate: () => {
        const eased = (1 - Math.cos(swing.t * Math.PI * 2)) / 2;
        p = Math.min(1, rest + eased * IDLE_AMPLITUDE * 2);
        applyLight();
      },
    });
  }

  function stopIdle() {
    if (!idleRunning) return;
    idleRunning = false;
    if (idleTween) idleTween.kill();
    idleTween = null;

    /* Hand back to the scrub's own value rather than freezing
       mid-swing, so the takeover has nothing to jump from. */
    p = scrubbed.p;
    applyLight();
  }

  /* ── THE WEBGL UPGRADE ──────────────────────────────────────
     Everything above is already a working hero. This adds to it,
     and any failure leaves it exactly as it was. */
  const THREE = window.THREE;

  if (THREE && gsap && hasWebGL()) {
    try {
      scene = createLockScene({
        THREE,
        gsap,
        stage,
        theme: activeTheme(),
        prefersReducedMotion,
      });

      scene.timeline.progress(state === 'unlocked' ? 1 : 0).pause();
      scene.setLight(p);
      paintState(state);

      /* Fade in only once a frame is actually on the canvas —
         fading up a blank one is the visible pop the reserved box
         exists to avoid.

         setAttribute, not dataset.lock3d: the dataset key would
         serialise to data-lock3d and never match the stylesheet. */
      scene.onReady(() => stage.setAttribute('data-lock-3d', 'on'));

      document.addEventListener('theme:change', (event) => {
        scene.applyTheme(event.detail.theme);
      });
    } catch (e) {
      if (scene) scene.destroy();
      scene = null;
    }
  }

  /* Nothing is coming. Collapse the stage rather than leaving a
     reserved square of empty page where a lock should be. */
  if (!scene) stage.setAttribute('data-lock-3d', 'off');

  return {
    setState,
    getState: () => state,
    is3D: () => !!scene,
    destroy: () => {
      if (scene) scene.destroy();
      scene = null;
    },
  };
}
