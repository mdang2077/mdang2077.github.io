/* ============================================================
   ENTRY POINT
   ============================================================ */

import { initCtf } from './ctf.js';
import { initTheme } from './theme.js';
import { initHud } from './hud.js';
import { initLock } from './lock.js';
import { initAnimations } from './animations.js';

/* Fallback gate for engines without `@media (scripting)`. Modern
   engines have already hidden the reveals before first paint. */
document.documentElement.dataset.js = 'on';

/* The one reduced-motion guard, checked once. Later phases import
   this rather than re-querying; when true they must not register
   scrubbed effects, entrance staggers, or ambient loops at all. */
export const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;

/* GSAP is a progressive enhancement, never a dependency. The two
   <script defer> tags in <head> run ahead of this module, so by
   here the library has either arrived or it never will. The
   attribute is what switches motion.css off its CSS-only
   fallback sweep. */
const gsap = window.gsap || null;
if (gsap) document.documentElement.dataset.gsap = 'on';

initTheme({ prefersReducedMotion });

/* ── INIT ORDER ─────────────────────────────────────────────
   Four listeners, and the order they subscribe in is load-bearing:

     initLock      creates the lock and hands out `setState`.
     initAnimations subscribes to `ctf:state` and `hud:seated`. It
                   must be before initHud, because a solve whose
                   glyph flight is skipped seats its pin
                   *synchronously* — so the seat announcement would
                   arrive before this module knew it was waiting.
     initHud       subscribes to `ctf:state`, and must be before
                   initCtf so it sees the first `reason: 'init'`.
     initCtf       dispatches that first event.

   Everything downstream is event-driven, so this is the only place
   the wiring has an order at all. */
export const lock = initLock({ prefersReducedMotion, gsap });

initAnimations({ lock, prefersReducedMotion });
initHud({ gsap, prefersReducedMotion });
initCtf();
