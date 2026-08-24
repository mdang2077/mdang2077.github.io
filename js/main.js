/* ============================================================
   ENTRY POINT
   ============================================================ */

import { initCtf } from './ctf.js';
import { initTheme } from './theme.js';

/* Fallback gate for engines without `@media (scripting)`. Modern
   engines have already hidden the reveals before first paint. */
document.documentElement.dataset.js = 'on';

/* The one reduced-motion guard, checked once. Later phases import
   this rather than re-querying; when true they must not register
   scrubbed effects, entrance staggers, or ambient loops at all. */
export const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;

initTheme({ prefersReducedMotion });
initCtf();
