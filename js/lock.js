/* ============================================================
   LOCK — the hero padlock's specular sweep.

   The band is a real SVG mask sweep: a linear gradient painted
   on a rect that travels across the lock, clipped to the lock's
   own geometry by `mask="url(#lock-mask)"`. It never spills onto
   the background, which is the difference between light moving
   across metal and a CSS shimmer.

   Two drivers, and they take turns:
     - an ambient idle loop, so the effect is discoverable
       without scrolling;
     - a scroll scrub over the hero's scroll-out range, which
       cancels the idle loop on the first scroll input.

   Everything here is optional. With GSAP missing the module
   returns a no-op controller and motion.css runs a CSS-only
   ambient sweep instead; under reduced motion neither runs.
   ============================================================ */

/* viewBox x positions for the band's centre: fully clear of the
   left edge, and fully clear of the right. The rect is 16 units
   wide (25% of the lock's 64) and rotated 20 degrees, so it needs
   to overshoot both ends. */
const BAND_START = -34;
const BAND_END = 76;

const IDLE_INTENSITY = 0.35;
const IDLE_GAP = 5;
const BLOOM_MAX = 14;

const noop = () => {};
const NULL_CONTROLLER = { sweep: noop, stopIdle: noop, startIdle: noop };

export function initLock({ prefersReducedMotion, gsap } = {}) {
  const svg = document.querySelector('[data-lock-svg]');
  const shine = svg && svg.querySelector('[data-shine]');
  const band = svg && svg.querySelector('[data-shine-band]');

  if (!svg || !shine || !band || prefersReducedMotion || !gsap) {
    return NULL_CONTROLLER;
  }

  const hero = document.querySelector('.hero-band');

  /* The band's x is set as an *attribute*, never as a GSAP
     transform: GSAP writes SVG transforms to the CSS `transform`
     property, which replaces the element's transform attribute
     outright and would drop the 20-degree tilt. */
  const setBandX = (v) => band.setAttribute('x', String(v));
  /* Position and brightness are separate channels on purpose: the
     scrub owns position, the sweep owns brightness, so phase 4's
     unlock flash can raise brightness without disturbing wherever
     the scroll has settled the band. */
  const state = { intensity: 0, bloom: 0 };

  const applyLight = () => {
    shine.style.opacity = String(state.intensity);
    svg.style.setProperty('--lock-bloom', String(state.bloom));
  };

  const positionAt = (progress) =>
    setBandX(BAND_START + (BAND_END - BAND_START) * progress);

  positionAt(0);
  applyLight();

  /* ── IDLE AMBIENT LOOP ──────────────────────────────────────
     Cancellable and resumable, so the phase-4 unlock flash can
     take the stage without fighting a sweep already in flight. */
  const idle = gsap.timeline({ repeat: -1, repeatDelay: IDLE_GAP, paused: true });

  idle
    .fromTo(
      state,
      { intensity: 0, bloom: 0 },
      {
        intensity: IDLE_INTENSITY,
        bloom: BLOOM_MAX * IDLE_INTENSITY,
        duration: 0.7,
        ease: 'sine.in',
        onUpdate: applyLight,
      },
      0,
    )
    .to(
      state,
      {
        intensity: 0,
        bloom: 0,
        duration: 0.7,
        ease: 'sine.out',
        onUpdate: applyLight,
      },
      0.7,
    )
    .fromTo(
      band,
      { attr: { x: BAND_START } },
      { attr: { x: BAND_END }, duration: 1.4, ease: 'power1.inOut' },
      0,
    );

  let idleRunning = false;

  const startIdle = () => {
    if (idleRunning) return;
    idleRunning = true;
    idle.play(0);
  };

  const stopIdle = () => {
    if (!idleRunning) return;
    idleRunning = false;
    idle.pause();
  };

  /* ── SCROLL SCRUB ───────────────────────────────────────────
     The band tracks the hero's scroll-out, eased rather than
     snapped. `scrub: 0.6` is what stops it feeling nailed to the
     scrollbar. Registering this is conditional on ScrollTrigger
     actually being present — GSAP core alone is enough for the
     idle loop, so a half-blocked CDN still degrades gracefully. */
  const ScrollTrigger = window.ScrollTrigger;

  if (ScrollTrigger && hero) {
    gsap.registerPlugin(ScrollTrigger);

    const scrubbed = { p: 0 };

    gsap.to(scrubbed, {
      p: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.6,
        onEnter: stopIdle,
        onUpdate: (self) => {
          /* First scroll input hands control over from the idle
             loop. It does not come back on scroll-to-top: an
             ambient loop under a reader's cursor is noise. */
          if (self.progress > 0.001) stopIdle();
        },
      },
      onUpdate: () => {
        if (idleRunning) return;
        positionAt(scrubbed.p);
        /* Brightest with the band mid-lock, dark at both ends. */
        state.intensity = Math.sin(scrubbed.p * Math.PI) * 0.8;
        state.bloom = state.intensity * BLOOM_MAX;
        applyLight();
      },
    });
  }

  startIdle();

  /* ── IMPERATIVE SWEEP ───────────────────────────────────────
     Phase 4's unlock flash calls this. It suspends the idle loop
     for its duration and restores whatever was running after. */
  function sweep({ intensity = 1, duration = 0.7 } = {}) {
    const wasIdle = idleRunning;
    stopIdle();

    const tl = gsap.timeline({
      onComplete: () => {
        state.intensity = 0;
        state.bloom = 0;
        applyLight();
        if (wasIdle) startIdle();
      },
    });

    tl.fromTo(
      band,
      { attr: { x: BAND_START } },
      { attr: { x: BAND_END }, duration, ease: 'power2.inOut' },
      0,
    )
      .fromTo(
        state,
        { intensity: 0, bloom: 0 },
        {
          intensity,
          bloom: intensity * BLOOM_MAX,
          duration: duration / 2,
          ease: 'sine.in',
          onUpdate: applyLight,
        },
        0,
      )
      .to(
        state,
        {
          intensity: 0,
          bloom: 0,
          duration: duration / 2,
          ease: 'sine.out',
          onUpdate: applyLight,
        },
        duration / 2,
      );

    return tl;
  }

  return { sweep, stopIdle, startIdle };
}
