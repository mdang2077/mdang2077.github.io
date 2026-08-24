/* ============================================================
   ENTRY POINT
   ============================================================ */

import { initCtf } from './ctf.js';
import { initTheme } from './theme.js';
import { initHud } from './hud.js';
import { initLock } from './lock.js';

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

/* HUD listens for `ctf:state`, so it must be subscribed before
   initCtf() fires its first `reason: 'init'` event. */
initHud();
initCtf();

/* The hero lock. The SVG in the markup is already correct before
   this runs; initLock adds the scroll shine and, where WebGL and
   Three are both available, paints the 3D scene over the top.
   Phase 4 drives it through lock.setState(). */
export const lock = initLock({ prefersReducedMotion, gsap });

/* The lock opens exactly once, when every section is open — the
   third solve, or bypass-on. It deliberately stays shut through
   the first two solves: three pins seating one by one is the
   build-up, and a lock that opens on challenge one has nothing
   left to say on challenge three. The pin rail and the run console
   carry the per-solve feedback.

   `reason: 'init'` never animates: a page that loads bypassed must
   arrive already open rather than playing a mechanism nobody
   triggered. Phase 4 takes this over when it sequences the pin
   seat straight into the lock's first beat. */
document.addEventListener('ctf:state', (event) => {
  const { count, total, bypass, reason } = event.detail;
  const open = bypass || count === total;
  lock.setState(open ? 'unlocked' : 'locked', { animate: reason !== 'init' });
});
