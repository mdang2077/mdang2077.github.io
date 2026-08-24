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

export const lock = initLock({ prefersReducedMotion, gsap });
