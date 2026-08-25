/* ============================================================
   ANIMATIONS — orchestration between the CTF state and the lock.

   This module owns *when* the hero lock opens, not how. The three
   unlock beats live in js/lock3d.js, because they are transforms
   on meshes only that module can see; everything here decides
   which state the lock should be in and what should have finished
   before it gets there.

   The rule it exists to enforce: on the run that completes the
   set, the third pin's seat chains straight into beat 1, with no
   gap. Firing both off the same `ctf:state` event would open the
   lock while the glyph was still in the air and before the pin it
   is flying to had lit — the payoff landing before the build-up.
   ============================================================ */

/* If the seat never arrives — no pin rail in the DOM, a hidden
   tab, a flight killed mid-air — the lock still opens. The wait is
   a courtesy to the choreography, never a dependency of it. */
const SEAT_TIMEOUT = 900;

/* Bypass has no seat to chain off, so its hold is a plain delay:
   long enough for the `[!]` line to be printing and the pin run to
   have started (hud.js opens that at 120ms and steps 90ms), so the
   lock is the last thing to move rather than the first. Off is not
   delayed — a switch thrown back should answer immediately. */
const BYPASS_DELAY = 300;

export function initAnimations({ lock, prefersReducedMotion = false } = {}) {
  if (!lock) return;

  /* One holder for both kinds of wait — a solve's seat and a
     bypass's delay — because they are mutually exclusive and any
     new state change cancels whichever is outstanding. Two timers
     would mean two ways to be half-cancelled. */
  let pending = null;

  function clearPending() {
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pending = null;
  }

  function apply(open, { animate }) {
    clearPending();
    lock.setState(open ? 'unlocked' : 'locked', { animate });
  }

  document.addEventListener('ctf:state', (event) => {
    const { count, total, bypass, reason, index } = event.detail;
    const open = bypass || count === total;

    /* A page that loads bypassed must arrive already open rather
       than playing a mechanism nobody triggered. */
    if (reason === 'init') {
      apply(open, { animate: false });
      return;
    }

    /* Bypass is a switch, not a solve: there is no pin flight to
       wait for, so the hold is a fixed delay rather than a cue.
       Only opening waits — and only when there is motion to be late
       for. Under reduced motion the delay would be a pause with
       nothing happening in it. */
    if (reason !== 'solve') {
      clearPending();

      if (!open || prefersReducedMotion) {
        apply(open, { animate: true });
        return;
      }

      pending = {
        index: null,
        timer: window.setTimeout(() => {
          pending = null;
          lock.setState('unlocked', { animate: true });
        }, BYPASS_DELAY),
      };
      return;
    }

    /* A solve that does not complete the set changes nothing about
       the lock. It stays visibly, stubbornly shut through the first
       two, which is what makes the third one land. */
    if (!open) {
      clearPending();
      return;
    }

    /* The completing solve. Hold beat 1 until the pin that finishes
       the set has seated. */
    clearPending();
    pending = {
      index,
      timer: window.setTimeout(() => {
        pending = null;
        lock.setState('unlocked', { animate: true });
      }, SEAT_TIMEOUT),
    };
  });

  /* Dispatched by js/hud.js the moment a solving pin seats — after
     the glyph lands, or immediately when the flight was skipped.
     hud.js is initialised *after* this module precisely so that a
     skipped flight's synchronous seat still finds `pending` set. */
  document.addEventListener('hud:seated', (event) => {
    if (!pending) return;
    /* A bypass hold carries a null index and no seat can match it,
       so it runs its delay out rather than being cut short by a
       solve's pin landing. */
    if (event.detail.index !== pending.index) return;
    clearPending();
    lock.setState('unlocked', { animate: true });
  });
}
