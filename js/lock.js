/* ============================================================
   LOCK — orchestrator for the hero padlock.

   Owns three things and delegates the rest:

     1. which rendering is on screen — SVG always, WebGL as an
        upgrade painted over it;
     2. the scroll shine, as one normalised scalar shared by both
        paths;
     3. the lock's state machine, `setState(state, { animate })`.

   The SVG is not a degraded alternative that renders when WebGL
   fails. It is what the page ships, always, and it is already on
   screen and already correct before this module runs. Getting that
   backwards is what puts a hole in the page on slow connections.
   So there is no `try` at the feature level here: every WebGL
   branch is an addition, and every failure path is "do nothing".
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

  const svg = stage.querySelector('[data-lock-svg]');
  const spec = svg && svg.querySelector('[data-lock-spec]');
  const title = svg && svg.querySelector('[data-lock-title]');

  let state = 'locked';
  let scene = null;

  /* ── THE SHARED SCALAR ──────────────────────────────────────
     One value, two consumers: the SVG path writes a custom
     property and the specular gradient's centre; the WebGL path
     moves a real light. Nothing else writes either. */
  let p = prefersReducedMotion ? NEUTRAL : 0;

  function applyLight() {
    stage.style.setProperty('--p', p.toFixed(4));

    /* Gradient attributes do not resolve var(), so --p reaches the
       specular through JS. cx and fx move together: moving the
       focal point alone skews the gradient where we want to
       translate it. */
    if (spec) {
      const x = (0.1 + p * 0.8).toFixed(4);
      spec.setAttribute('cx', x);
      spec.setAttribute('fx', x);
    }

    if (scene) scene.setLight(p);
  }

  applyLight();

  /* ── STATE ──────────────────────────────────────────────────
     Three states, and the site can enter any of them without
     playing anything. Only a live solve animates. */
  function paintState(next) {
    const open = next !== 'locked';

    if (title) {
      title.textContent = open ? 'Padlock, unlocked' : 'Padlock, locked';
    }
    if (scene) {
      scene.canvas.setAttribute(
        'aria-label',
        open ? 'Padlock, unlocked' : 'Padlock, locked',
      );
    }

    /* The SVG unlock is a CSS transition on the shackle group. No
       pop, no tumbler turn — the sideways swing that makes the 3D
       version worth having cannot be faked here, and "the lock
       opened" is all the fallback owes anyone. */
    stage.style.setProperty('--shackle-rotate', open ? '-38deg' : '0deg');
    stage.style.setProperty('--shackle-lift', open ? '-14' : '0');
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

      /* Cross-fade only once a frame is actually on the canvas —
         fading to a blank canvas is the visible pop the shared
         sizing box exists to avoid. The SVG stays in the DOM (its
         <defs> are what the section badges draw from) but leaves
         the accessibility tree, so the lock is announced once. */
      scene.onReady(() => {
        /* setAttribute, not dataset.lock3d: the dataset key would
           serialise to data-lock3d and never match the stylesheet. */
        stage.setAttribute('data-lock-3d', 'on');
        if (svg) svg.setAttribute('aria-hidden', 'true');
      });

      document.addEventListener('theme:change', (event) => {
        scene.applyTheme(event.detail.theme);
      });
    } catch (e) {
      /* The SVG is already correct and already on screen. */
      if (scene) scene.destroy();
      scene = null;
    }
  }

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
