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

export function initAnimations({ lock } = {}) {
  if (!lock) return;

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
       wait for, and step 4's staggered run will own its timing. */
    if (reason !== 'solve') {
      apply(open, { animate: true });
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
    if (event.detail.index !== pending.index) return;
    clearPending();
    lock.setState('unlocked', { animate: true });
  });
}
