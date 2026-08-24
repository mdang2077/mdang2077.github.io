# Claude Code Brief — mdang2077.github.io v3 ("CTF Edition, animated")

> **Mode: PLAN FIRST.** Do not write implementation code until the plan below is produced and approved. Enter plan mode, read the existing site, then output the plan described in §10.

---

## 1. Context

**Repo:** `/Users/mdang/Coding/mdang2077.github.io` — a GitHub Pages personal site.

**Current state:** one 31KB `index.html` with inline `<style>` and inline `<script>`. Assets: `IMG_8288.JPG` (portrait), `CS_Resume.pdf`.

Current structure:
- Sticky topbar: `> mdang@portfolio` (left) / `v2.0 :: ctf_edition` (right)
- Two-column `.layout`: 376px left sidebar (portrait, hero name, `user_info.txt` ID card, contact links) + scrollable `.main`
- `.main` holds: CTF explainer + BYPASS button → 3-dot progress bar → 3 gated sections (skills / projects / extra puzzle) → footer
- Gating: answers live in `const answers = ['security is cool','17','png']` in plaintext; `check()` / `unlock()` / `toggleBypass()`; unlocking all 3 (or bypassing) flips `--accent` from red `#ff3333` to green `#00ff88`
- Aesthetic: JetBrains Mono + VT323, near-black greens, SVG noise grain (`body::before`), CRT scanlines (`body::after`), red glow shadows

**Constraints:** static GitHub Pages, no server. Nothing may require a build step (see §3).

---

**Visual references in the repo root:**
- `wireframe.svg` — simplified wireframe of the target layout in both themes. Proportion and hierarchy only; type, colour, and spacing are still open.
- `LOCK_SPEC.md` — **authoritative** spec for the hero padlock: form, size, material, the `--p` scroll-lighting model, and the unlock animation. Where it conflicts with §5 below, LOCK_SPEC.md wins.
- `lock-combined-prototype.html` — **start here.** All three systems working together (chrome material, scroll light sweep, unlock) in both themes, verified rendering.
- `lock-unlock-prototype.html` — the original Three.js unlock prototype.
- `lock-light-prototype.html` — working prototype of the **scroll-driven lighting model**, and the required no-WebGL fallback path.

---

## 2. Goals

1. Add a **cinematic but tasteful** layer of motion — scroll-driven, entrance, hover, and state-transition animation — without turning the site into a demo reel.
2. **Clean up the whole UI/design system.** The current CSS is ad-hoc: magic numbers, inline styles in HTML, duplicated glow values, one giant `transition` selector list. Rebuild it on real tokens.
3. Keep and strengthen the **cybersecurity / CTF identity**. The puzzles and the "skip puzzles" escape hatch are core, not decoration.
4. Keep **user info and contacts persistently visible** — never gated behind a puzzle, never buried below the fold on mobile.
5. Add the **hero name lockup** and its **scroll-driven shine** (§5).
6. Add a **dark/light toggle** in the topbar (§6).

**Non-goals:** a blog, a CMS, a framework (no React/Vue/Svelte), analytics, tracking.

---

## 3. Decided technical direction (do not re-litigate these)

| Decision | Choice |
|---|---|
| Structure | **Split files, no build step.** `index.html` + `css/` + `js/` as native ES modules. Libraries via CDN with SRI + `defer`. GitHub Pages serves it verbatim. |
| Animation stack | **GSAP-primary + native CSS.** GSAP became 100% free (all plugins — ScrollTrigger, SplitText, ScrollSmoother, MorphSVG, DrawSVG, Flip, Observer) under Webflow. One library, one easing vocabulary. Use plain CSS transitions/keyframes for cheap hover and state work — do **not** route every micro-interaction through JS. |
| Light theme | **"Paper terminal."** Warm off-white ground, dark ink text, accent hue preserved. Not a mechanical inversion. |
| Lock asset | **Hand-authored inline SVG padlock**, shine driven by a gradient + `<mask>`. No raster image. |

**Do not** add `motion.dev` or `anime.js`. They were considered and rejected — mixing three engines means three scroll listeners, three easing curves, and ~110KB for effects GSAP already covers. Note this tradeoff in the plan and move on.

---

## 4. Proposed file layout (adjust in the plan if you have a better one)

```
index.html
assets/
  portrait.jpg          # renamed from IMG_8288.JPG, re-encoded (see §9)
  CS_Resume.pdf
  favicon.svg
css/
  tokens.css            # :root design tokens, both themes
  base.css              # reset, typography, grain/scanline layers
  layout.css            # topbar, two-column shell, responsive
  components.css        # cards, tags, buttons, inputs, progress, lock icons
  motion.css            # keyframes, reduced-motion overrides
js/
  main.js               # entry, imports the rest
  theme.js              # dark/light toggle + persistence
  ctf.js                # challenge logic, unlock state, progress
  animations.js         # GSAP timelines + ScrollTrigger registrations
  lock.js               # hero lock shine controller
```

Every `<style>`/`<script>` block and every inline `style="..."` attribute currently in `index.html` must be gone. The HTML should be readable as semantic structure alone.

---

## 5. Hero name lockup + scroll shine (headline feature)

**Placement:** directly under the topbar, above/ahead of everything else — a full-width hero band spanning both columns, not inside the 376px sidebar. The existing sidebar `<h1>Martin <span>Dang</span></h1>` should be removed or demoted so the name isn't duplicated.

**Composition:** `MARTIN [🔒] DANG` — the padlock sits between the two words as a typographic element, optically aligned to cap-height, roughly matching the x-height-to-cap proportions of the surrounding VT323 (or a better display face — see §7, Type hierarchy).

**The lock SVG — build it by hand, not from an icon set:**
- Shackle + body as separate paths so they can be animated independently later
- Body has a keyhole cut, a subtle bevel (two-stop gradient), and a 1px inner stroke so it reads as machined metal, not a flat glyph
- Stroke/fill driven by `currentColor` and CSS custom properties so it re-themes for free
- Target ≤ 3KB inline

**The shine:**
- A `<linearGradient>` "specular band" — transparent → accent-tinted white → transparent, ~18–25% of the lock's width, angled ~20° off vertical
- Applied through a `<mask>` (or a second clipped rect with `mix-blend-mode: screen`) so it only lights the lock's own geometry and never spills onto the background
- **Scroll-linked, not time-linked.** `gsap.to()` on the gradient's `x1/x2` (or a `translateX` on the masked group), driven by `ScrollTrigger` with `scrub: 0.6` so it eases rather than snapping to the scroll position. Band travels left edge → right edge across the hero's scroll-out range (`start: 'top top'`, `end: 'bottom top'` on the hero, roughly one viewport of scroll).
- **Also idle:** when the page is at rest at the top, a slow ambient sweep every ~5s at ~35% intensity, so the effect is discoverable without scrolling. Scroll-scrub takes over and cancels the idle loop on first scroll input.
- Pair the sweep with a synchronized `filter: drop-shadow()` bloom on the lock (peak intensity when the band is centered) so the light feels emitted, not painted on.

**Do not** implement this with `background-position` on a text gradient. It must be a real SVG mask sweep — that's the difference between "CSS shimmer" and "light moving across metal."

**Evaluate and report on:** whether CSS scroll-driven animations (`animation-timeline: view()`) could carry this instead of ScrollTrigger. They're full in Chrome/Edge, partial in Safari 17+, in development in Firefox. GSAP's ScrollTrigger is the safe primary; propose native CSS only where a silent no-op degradation is acceptable.

---

## 6. Dark/light toggle

- Lives in the topbar, **right side**, next to (or replacing part of) the `v2.0 :: ctf_edition` text. Keep it terminal-flavored — e.g. `[ ☾ ]` / `[ ☀ ]` or a literal `--theme=dark` / `--theme=light` flag string rather than a generic pill switch.
- Implementation: `data-theme="dark" | "light"` on `<html>`; **all** colors defined as tokens in `css/tokens.css`; no color literal anywhere else in the codebase.
- Three-state logic: explicit choice persists to `localStorage`; absent a choice, follow `prefers-color-scheme`. Wrap every storage read/write in `try/catch`.
- **No flash of wrong theme.** A tiny blocking inline script in `<head>` sets `data-theme` before first paint. This is the *one* permitted inline script — call it out explicitly in the plan.
- Transition the swap: ~350ms crossfade on background/text/border tokens. Consider a View Transitions API circular reveal from the toggle button (Chrome/Edge/Safari 17+, Firefox partial as of early 2026) with a plain crossfade fallback — spec it as a progressive enhancement, not a dependency.
- **Critical:** the CTF "solved" state currently mutates `--accent` to green via `document.documentElement.style.setProperty`. Inline styles beat the theme stylesheet. Refactor to a **state class or `data-solved` attribute** on `<html>` so theme and solve-state compose cleanly instead of fighting. Both themes need their own red *and* green accent values with adequate contrast on their own ground.

---

## 7. UI/design cleanup mandate

Audit and fix, at minimum:

- **Tokens.** Replace ad-hoc values with a real scale: spacing (4px base), type scale, radii, border widths, elevation/glow levels, motion durations + easing curves. `--glow` / `--glow-sm` are doing too much work — derive them from the accent hue.
- **Inline styles.** ~8 places in the HTML carry `style="..."` (contact section header, the access_granted box, message divs). All must move to classes.
- **The mega-transition selector.** That 12-line comma-separated `transition:` rule at the top is unmaintainable. Scope transitions to the components that need them.
- **Type hierarchy.** VT323 at 44px next to JetBrains Mono at 12px is a big jump with nothing between. Establish real intermediate steps.
- **Vertical rhythm.** `.section { margin-bottom: 56px }` is arbitrary; base spacing on the scale.
- **Mobile.** Below 768px everything collapses to one column and the sidebar stacks on top — meaning a visitor sees portrait + ID card + contacts before any content. Reconsider: probably hero lockup → compact identity strip → content, with full contacts repeated in the footer.
- **Focus states.** Currently only `.challenge-input` has a visible focus style. Every interactive element needs a visible, theme-aware focus ring.
- **Semantics.** `<div class="topbar">` → `<header>`; challenge blocks → `<form>` so Enter works natively (the current `onkeydown` hack goes away); `<button>` for the bypass toggle already correct; add `aria-live` on the challenge result messages; `role="status"` on the progress bar.
- **Dead code.** `.ctf-stats` / `.stat-card` / `.stat-val` are fully styled but no markup uses them. Either delete outright or flag them for the UI decisions the user is settling separately — do not silently carry them forward.
- **Remove all `onclick=` / `onkeydown=` attributes** in favor of listeners in `js/`.

---

## 8. Non-negotiables

- **`prefers-reduced-motion: reduce` must be honored globally.** One guard, checked once, that disables scrub effects, entrance staggers, the boot sequence, and the idle shine — leaving instant, complete, fully usable content. Not an afterthought; design it into `js/animations.js` from the start.
- **Zero layout shift.** Everything animates on `transform` / `opacity` / `filter`. Never animate `height`, `top`, `width`, or `margin` in a scroll-linked context (use GSAP Flip for the unlock collapse).
- **Contacts and identity are never gated.** GitHub, LinkedIn, resume, and `user_info.txt` render for a visitor who solves nothing, bypasses nothing, and has JS disabled.
- **Progressive enhancement.** With JS off or a CDN blocked, the page must still render legibly and all content must be reachable — the bypass path should be the default no-JS state, not a locked wall.
- **Portrait asset.** `IMG_8288.JPG` is 720KB for a ~300px display width. Re-encode to WebP at 2× display size with a JPEG fallback, add explicit `width`/`height`, `loading="eager"`, `decoding="async"`. Target <80KB.
- **Budget.** Total transfer under 400KB on first load. Report GSAP's actual cost (core + only the plugins used) in the plan. Load plugins individually — do not pull the whole bundle. **This budget conflicts with the Three.js hero lock** (`LOCK_SPEC.md` §0) — Three alone is ~150KB gzipped. Surface the conflict in the plan and propose a resolution (raise the budget, or lazy-load Three behind the SVG fallback); do not silently exceed it.
- **Accessibility.** WCAG AA contrast in *both* themes for every token pair — verify the green `#00ff88` and red `#ff3333` accents on the paper-terminal ground specifically; they will likely need adjustment. Full keyboard operability. `aria-live` on challenge feedback.
- **Preserve all existing content verbatim:** three challenges and their answers (`security is cool`, `17`, `png`), all skill tags, all three project cards with descriptions and links, the EQTY Lab internship link, the ID card fields, the footer.

---

## 9. Deliverable — what to produce now

**Do not write implementation code yet.** Produce a plan containing:

1. **Findings** — a short audit of the current `index.html`: what's structurally sound and worth keeping, what's technical debt. Be specific and cite line numbers.
2. **Final file tree** with a one-line purpose per file.
3. **The token system** — the actual proposed `:root` values for both themes, as a table with contrast ratios for every text/background pair.
4. **Animation inventory** — every animation as a row: trigger, target, properties, duration/easing, library or plain CSS, reduced-motion fallback. This is the core artifact; make it complete enough to implement from directly.
5. **The lock SVG spec** — structure, gradient stops, mask geometry, and exactly how the sweep is parameterized.
6. **Phased build order** — phases that each end at a working, committable, deployable site. Suggested shape: (1) restructure + tokens + zero visual change, (2) theme toggle, (3) hero lockup + shine, (4) unlock choreography, (5) approved extras, (6) polish + audit. Never leave `main` broken.
7. **Risks** — what could go wrong (CDN blocked, Safari mask/`backdrop-filter` quirks, ScrollTrigger + sticky topbar interaction, VT323 metrics vs. the SVG lock's optical alignment, scroll-jank on low-end mobile) and the mitigation for each.
8. **Verification plan** — how each phase gets checked: Lighthouse targets, contrast checks in both themes, keyboard-only pass, reduced-motion pass, JS-disabled pass, real-device mobile check, screenshot diffs before/after.

**Ask before assuming.** If anything in §5 or §6 is ambiguous, ask rather than guessing — this is the user's personal site and taste calls are theirs.

**Git hygiene:** branch off `main` (e.g. `feat/v3-motion`); one commit per phase; never commit directly to `main`.
