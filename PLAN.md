# v3 "CTF Edition, animated" — build plan

Derived from `CLAUDE_CODE_BRIEF.md` §9.6. Every phase ends at a working,
committable, deployable site. Branch: `feat/v3-motion`. Never commit to `main`.

## Phase status

| # | Phase | State |
|---|-------|-------|
| 0 | Asset pipeline + repo scaffolding | **done** |
| 1 | Restructure + tokens, zero visual change | **done** |
| 2 | Dark/light theme toggle | **done** |
| 3 | Hero name lockup + scroll shine (must ship the phase-4 hooks below) | **done** |
| 3R-a | **Lock rebuild (SVG)** — new geometry, metal tokens, `--p` lighting, badges | **done** |
| 3R-b | **Lock upgrade (WebGL)** — Three.js scene, 3D unlock, scroll shine | **done** |
| 4 | Unlock system — run log + pin rail + hero lock + bypass relock | todo |
| 5 | Approved extras | todo |
| 6 | Polish + full audit | todo |

## File tree

```
index.html            semantic structure only — no <style>, no inline style=, no on* attributes
PLAN.md               this file
assets/
  portrait.jpg        525x700, q62, 74KB (was IMG_8288.JPG @ 704KB)
  CS_Resume.pdf       unchanged
  favicon.svg         terminal-prompt glyph, theme-aware via prefers-color-scheme
css/
  tokens.css          all design tokens, both themes, both accent states
  base.css            reset, typography, grain + scanline layers
  layout.css          header, two-column shell, responsive
  components.css      cards, tags, buttons, inputs, progress, locks, socials, footer
  motion.css          keyframes + prefers-reduced-motion overrides
  noscript.css        loaded only from <noscript>: the bypassed no-JS state
js/
  main.js             entry point, imports the rest
  ctf.js              challenge logic, unlock state, progress, bypass
  theme.js            dark/light toggle, persistence, view-transition reveal
  animations.js       phase 4 — GSAP timelines + ScrollTrigger
  lock.js             orchestrator — capability check, path selection, SVG --p controller
  lock3d.js           phase 3R-b — the Three.js hero lock scene
  hud.js              phase 3 markup / phase 4 behavior — run log + hero pins
```

## Token system

Tokens live only in `css/tokens.css`. No color literal anywhere else.
Accent is expressed as HSL channels so every glow derives from the hue rather
than being hand-written:

```
--accent-h/-s/-l  ->  --accent: hsl(h s l)
--glow-lg/-md/-sm ->  hsl(h s l / 0.15 | 0.08 | 0.04)
```

Solve state is `<html data-solved="true">`, **not** an inline style, so it
composes with `data-theme` instead of overriding it.

### Dark theme (shipped in phase 1, values preserved verbatim from v2)

| Token | Value | Pair | Ratio | AA |
|---|---|---|---|---|
| `--text` | `#d4e8dc` | on `--bg` | 15.34:1 | pass |
| `--text-muted` | `#4a6358` | on `--surface-1` | **2.89:1** | **FAIL** |
| `--accent` (locked) | `#ff3333` | on `--bg` | 5.41:1 | pass |
| `--accent` (solved) | `#00ff88` | on `--bg` | 14.67:1 | pass |
| `--warn` | `#ffcc00` | on `--bg` | 13.01:1 | pass |
| `--amber` | `#e6a817` | on `--surface-1` | 8.97:1 | pass |

`--text-muted` carries almost all body copy and fails AA at 2.89:1. It is
preserved as-is in phase 1 because phase 1 is defined as a zero-visual-change
refactor that must be reviewable by screenshot diff. **Fix in phase 2**, where
both palettes get tuned together: `#6b8a7c` measures 4.99:1 on `--surface-1`.

### Light theme "paper terminal" (shipped in phase 2)

| Token | Value | Pair | Ratio | AA |
|---|---|---|---|---|
| `--light-bg` | `#f4f1ea` | — | — | — |
| `--light-text` | `#1a201c` | on `--bg` | 14.69:1 | pass |
| `--light-text-muted` | `#55655b` | on `--bg` | 5.48:1 | pass |
| `--light-locked` | `hsl(0 71% 42%)` = `#b71f1f` | on `--bg` | 5.77:1 | pass |
| `--light-solved` | `hsl(152 90% 23%)` = `#066f3e` | on `--bg` | 5.56:1 | pass |
| `--light-warn` | `#7d5c0a` | on `--surface-1` | 5.13:1 | pass |
| `--light-amber` | `#785709` | on `--surface-1` | 5.53:1 | pass |

This confirms the brief's suspicion: the dark accents cannot cross over.
`#ff3333` on paper is 3.22:1 and `#00ff88` is 1.19:1 — both unusable. Each
theme carries its own red and green. The solved hue is 152 in both themes, so
the red-to-green rotation reads the same; only the lightness differs.

Two things deliberately do **not** invert. CRT text bloom goes to
`transparent` in light, because a coloured halo on a light ground reads as
smudge rather than emission. And `--surface-inset` — the code block and input
fill — is `--bg` in dark but *darker* than the card in light, so those fields
still read as recessed on paper.

## Phase 1 notes

**Verification.** v2 and v3 were rendered headless at 1440x2400 and their
computed geometry and styles diffed element by element. Every probed element —
topbar, logo, sidebar, photo, hero name, ID card, contacts, explainer, bypass
button, progress, challenge box, input, submit button — came back IDENTICAL in
position, size, colour, shadow, spacing and type, with two exceptions:

1. `.challenge-msg` now reserves its line (`min-height: 1lh`), making each
   challenge box 19px taller and the page 56px longer. Deliberate: it stops the
   form shifting when feedback appears, per the zero-layout-shift rule.
2. Display text gained `'JetBrains Mono'` as an intermediate fallback before
   `monospace`. No effect while VT323 loads; better if it does not.

A 37-assertion functional suite covers solve, wrong answer, bypass on/off,
accent state, and markup hygiene. All pass. The no-JS render was verified with
JavaScript blocked at the profile level: all content revealed, all puzzle
machinery hidden, contacts and identity intact.

**Payload (phase 1).** 123KB of own assets on first load, against the 400KB budget —
leaving roughly 190KB of headroom for GSAP core + ScrollTrigger in phases 3-4.

**Removed as dead code.** `.ctf-stats`, `.stat-card`, `.stat-label`,
`.stat-val`, `.stat-val.placeholder` — fully styled in v2, never used by any
markup. Also `.tag.accent`, whose declarations were identical to `.tag`, so
dropping the modifier changes nothing visually.

**Gating mechanism.** Three layers, so no engine gets a broken page:
`@media (scripting: enabled)` hides reveals before first paint (no flash);
`:root[data-js="on"]` covers engines without that media feature; `<noscript>`
loads `noscript.css`, which is what actually guarantees the no-JS bypass state.

## Phase 2 notes

**Theme resolution.** Three states: an explicit choice in `localStorage`, else
`prefers-color-scheme`, else dark. The one permitted inline script resolves
this into `data-theme` on `<html>` before first paint, so there is no flash;
`tokens.css` still carries a `prefers-color-scheme` block so state 2 stays
correct when that script never runs. Every storage touch is wrapped in
try/catch — Safari private mode throws on write, embedded contexts on read.
While no explicit choice is stored, a `matchMedia` listener follows OS changes
live.

**Composition.** Theme and solve-state are separate attributes on `<html>`
(`data-theme`, `data-solved`) and compose cleanly: solving in light theme
rotates the accent to that theme's green, not the dark one. Verified.

**Swap animation.** Where `startViewTransition` exists the new theme wipes in
as a circle growing from the toggle; elsewhere a 350ms crossfade class is
added for the duration of the swap and then removed, so nothing carries a
permanent global transition. Both are skipped under reduced motion, in JS and
again in CSS. The view-transition path has a safety net: its update callback
runs at the browser's next rendering opportunity, which never arrives in a
backgrounded tab, so a timer applies the theme directly if the callback has
not fired. This was a real failure found in testing, not a hypothetical.

**Accessibility fix.** `--text-muted` in dark went `#4a6358` -> `#6b8a7c`,
taking it from 2.89:1 to 4.99:1. This is the one intentional change to the
dark theme's appearance; everything else diffed IDENTICAL against phase 1.

**Verification.** 66 foreground/background pairs — 33 per theme, parsed out of
the shipped `tokens.css` rather than a draft — all meet AA, including every
surface the semi-transparent id-card and sticky topbar composite over. 24
theme assertions and 38 functional assertions pass. Dark was diffed
element-by-element against phase 1: identical but for `--text-muted`.

## Phase 3 notes

**The lockup.** A full-width band between the topbar and the two-column
shell, so `MARTIN [lock] DANG` spans both columns. The sidebar's `<h1>` is
gone — the lockup is now the document's only `h1`, and the name is not
duplicated. The lock is sized to `0.98em` and nudged `0.055em` down so its
body aligns to VT323's cap band rather than the baseline.

**The lock SVG.** Hand-authored, 64x92 viewBox, ~1.6KB of markup. Shackle and
body live in separate `<g>`s; every shape is declared once under an id and
re-used by `<use>`, including inside the shine mask — so the mask tracks the
shackle when phase 4 opens it, instead of drifting away from it. The hinge pin
is viewBox (46, 48), written into both the SVG and `.lock-shackle-group`.
`transform-box: view-box` keeps that origin in viewBox units, which is the
only reason the number is readable. 16 units of empty viewBox sit above the
shackle's resting arc, enough for the specced -32deg swing plus the 3px lift.

**The shine is a real mask sweep.** A 16-unit-wide gradient band (25% of the
lock's width, tilted 20deg) travels across a rect that is masked by the lock's
own geometry, so light never touches the background. Its x is set as an SVG
*attribute*, never as a GSAP transform: GSAP writes SVG transforms to the CSS
`transform` property, which replaces the element's transform attribute
outright and would silently drop the tilt.

**Scroll vs. idle.** ScrollTrigger scrubs the band across the hero's
scroll-out at `scrub: 0.6`; before any scroll, an ambient loop sweeps every 5s
at 35% intensity so the effect is discoverable at rest. First scroll input
cancels the idle loop and it does not return. `sweep({ intensity, duration })`
is exported for phase 4's unlock flash, and suspends/restores the idle loop
around itself.

**On `animation-timeline: view()`.** Evaluated as the brief asked, and not
used. It could carry the scroll link, but the effect here is not a silent
no-op when it degrades: with no fallback the band parks at one end and the
lock reads as permanently half-lit, which is worse than no shine. GSAP is
already loaded for phase 4 regardless, so the native path buys nothing.

**Degradation.** GSAP is a progressive enhancement, never a dependency.
`main.js` stamps `data-gsap="on"` only once `window.gsap` is confirmed; absent
that, `motion.css` runs a CSS-only ambient sweep and the page is otherwise
identical. Verified by resolving `cdn.jsdelivr.net` into a dead port.

**Phase-4 hooks, all shipped inert.** `@property` registration for the accent
channels (they snap without it), `--dur-flight/-seat/-type`, `--z-flight`
below the topbar for the flight clone, the three-state pin CSS, the reserved
four-line console, and `ctf:state` — which `ctf.js` now dispatches with
`{ solved[], count, total, bypass, reason, index }`. `hud.js` consumes it and
applies pin and log state *without animation*, so phase 4 adds choreography to
plumbing that is already proven end to end.

**Two fixes found while verifying.**

1. `white-space: pre` was on the run-log container, where it also preserved
   the indentation between child elements and added phantom line boxes — the
   block measured 101px against its 84px reservation. Moved to the line.
2. `.main` had no width under 768px. `.layout` is `align-items: flex-start`,
   so in column direction children size to max-content on the cross axis; the
   main column took its widest child's intrinsic width (376px) and overflowed
   at 320px, quietly clipped by `body { overflow-x: hidden }`. Pre-existing
   since phase 1.

**Contrast.** The run console does not use `--text-dim`: it measures 3.43:1 on
the inset fill in dark and 2.83:1 in light, and both the idle prompt and the
count column are real text. They use `--text-muted` (5.20:1 / 4.66:1).
`--text-dim` is still used by `.lock-icon.is-bypassed`, which has the same
problem and predates this phase — **flagged for phase 6**.

**Verification.** 44 assertions pass in the default pass and 47 under
`--force-prefers-reduced-motion` (three extra assert the band never moves, the
shine stays at zero opacity, and the bloom filter is `none`). They cover
markup hygiene, the hinge origin and transform-box, pin seating and shimming,
log print order, transient-line removal, the reserved height holding at 84px
across every state, ten-click bypass spam, the accent rotation, and the idle
sweep actually moving the band. No-JS was rendered with every script stripped
and `noscript.css` linked directly: content revealed, lock open, accent green,
pin rail and status strip hidden. Zero horizontal overflow at 320px and 390px.

**Payload.** GSAP core + ScrollTrigger cost 116.6KB raw / 45.3KB gzipped,
loaded as two individual files rather than the bundle. Total first load is
~240KB raw against the 400KB budget. Flip, if phase 4 needs it, still fits.

## Phase 3R — the hero lock becomes a real object

`LOCK_SPEC.md` and this file are **both authoritative** — the spec owns what the
lock *is* (technology, form, geometry, materials, lighting, choreography), this
file owns how it gets *built and integrated* (phase order, triggers, site state,
budgets, fallback sequencing). On a genuine same-question conflict this file
wins, as the later document; every divergence is listed in the spec's authority
table and argued here. The spec has changed the technology, not just the
artwork. **The hero lock is now a Three.js WebGL scene.** The previous draft of
this phase — a hand-authored SVG padlock lit by CSS gradients — is not
discarded, but it is demoted: it becomes the fallback path and the source of
the per-section badges.

Three prototypes in the repo root. `lock-combined-prototype.html` is the one
that matters — it is the verified render with the geometry, environment map and
tumbler-parenting fixes already applied. **Where it and the spec text disagree,
the combined prototype wins** (see §3, the camera trap).

### Decisions locked by the spec — do not re-litigate

| Decision | Status |
|---|---|
| Hero lock is a Three.js WebGL scene | locked |
| 3D unlock, including the sideways `rotation.y` shackle swing | locked, approved |
| Light animation is a scroll-driven shine sweep, independent of the unlock | locked |
| Body is dark gunmetal, shackle is polished chrome | **overridden** — both are chrome, see 3R notes |
| Lock renders at 1.5x the hero name type size | locked |
| Lock opens once, when all three puzzles are complete | locked (§5, our deviation) |

---

### 0. Budget — DECIDED: raise it

`three.min.js` r128 is ~600KB raw, ~150KB gzipped. The brief's §8 budget of
**400KB total first load** cannot hold it. **The budget is raised deliberately
rather than worked around.**

The deferred-load dance (ship SVG, fetch Three on idle, swap it in later) is
dropped. Three loads with a normal `defer`d CDN tag alongside GSAP.

**This costs nothing in money.** GitHub Pages is free regardless of page weight,
and the CDN serves Three, so it never touches the repo's bandwidth. The cost is
load *time* on slow connections, and that is the trade being accepted.

**Set the new budget at 600KB** and **measure the real number during 3R-b and
report it** — the 400KB figure was a real constraint that shaped phases 1-3
(the portrait went 704KB -> 74KB because of it), so replacing it with a
guess would waste that work. Measure, write it down, and hold the new line.

**What this does *not* change: the SVG lock still ships first.** Spec §6 still
requires it, because WebGL can be unavailable for reasons that have nothing to
do with download speed — old hardware, GPU blocklists, blocked contexts,
privacy configs. The SVG is in the HTML, Three initialises after it, and the
canvas swaps in. Raising the budget makes that swap fast and near-invisible; it
does not remove it.

---

### 1. Architecture — the fallback is the base layer, not a branch

This is the single most important structural idea in the phase, and getting it
backwards produces the failure mode §6 warns about (a hole in the page on slow
connections).

**The SVG lock is not a degraded alternative that renders when WebGL fails. It
is what the page ships, always. WebGL is an upgrade painted over it.**

That gives a clean split into two sub-phases, each independently deployable:

| | Ships | Ends at |
|---|---|---|
| **3R-a** | the SVG lock: new geometry, metal tokens, `--p` scroll lighting, section badges | a complete working hero with a scroll-lit lock. Deployable on its own. |
| **3R-b** | the Three.js scene, deferred load, cross-fade swap, theme sync, state API | the headline feature, layered on top |

If 3R-b is never built, or fails at runtime, or the CDN is blocked, or the GPU
is blocklisted — the page is still correct. Nothing needs a `try` around it at
the feature level, because there is no state in which the hero is empty.

---

### 2. Phase 3R-a — the SVG lock

Most of this was already planned; it survives with its ambition scaled to its
new job. The fallback's target is "reads as metal, relights with scroll, nobody
thinks it is broken" — not "matches the WebGL render".

**Geometry.** `viewBox` `0 0 64 92` -> **`0 0 180 264`**. Every number in the
current SVG, `components.css` and `lock.js` is dead.

```
body      rect  x=10 y=136 w=160 h=118 rx=10
bevel     rect  x=16 y=142 w=148 h=106 rx=7      stroke only, no fill
shackle   path  M 34.5 150 V 79.5 A 55.5 55.5 0 0 1 145.5 79.5 V 150
                stroke-width=22  stroke-linecap=butt  fill=none
keyhole   circle cx=90 cy=175.6 r=15.5  + tapered slot 11 -> 26 wide, to y=221.8
```

Load-bearing details: `stroke-linecap="butt"` not `round` (machined ends, and
the legs run 14 units into the body so the cuts never show); the bevel rect is
what makes the body read as chamfered metal rather than a rounded rectangle;
the keyhole cuts through to `--bg`.

**Lighting — a reduced `--p` model, deliberately.** The prototype's four-layer
stack (specular + warm wash + shade + sign-flipping edges) was specced when the
SVG *was* the hero lock. It is now a fallback, so build three layers, not four:

1. the base body ramp — a static `<linearGradient>` with the §6 abrupt stops,
   `0% hi · 6% mid · 18% lo · 55% lo · 68% mid · 88% hi · 100% mid`. **The jumps
   are the chrome**; anyone smoothing them has made grey plastic.
2. one specular `<radialGradient>`, `fx = 0.1 + p * 0.8`, set in JS —
   gradient attributes cannot read `var()`.
3. the sign-flipping edge highlights, which are the cheapest and most
   convincing part of the whole model:
   ```css
   .body-edge-l { opacity: clamp(0, calc((0.5 - var(--p)) * 2), 1); }
   .body-edge-r { opacity: clamp(0, calc((var(--p) - 0.5) * 2), 1); }
   ```
   The lit edge *becoming* the shadowed edge as light crosses is what reads as
   a lit object rather than a texture.

Dropped from the earlier draft: the warm diffuse wash and the animated cast
shadow. They are the two layers with the worst effort-to-visibility ratio on a
path most visitors never see.

**`--p` is registered** (`@property --p { syntax: '<number>'; inherits: true }`)
and driven by the same ScrollTrigger described in §4 — the SVG path writes
`--p`, the WebGL path moves lights, from one shared scalar.

**Metal tokens** in `tokens.css`, both themes, so the SVG re-themes with no JS:

| Token | Dark | Light | Note |
|---|---|---|---|
| `--metal-hi` | `#f4f7f5` | `#e9e5dc` | soft off-white on paper |
| `--metal-mid` | `#7d8a84` | `#58605b` | light ~30% down from dark |
| `--metal-lo` | `#0d1512` | `#3a3f3c` | warm dark grey on paper, **never black** |

Light-theme risk: `--metal-hi` sits close to `--light-bg`, so the silhouette
dissolves wherever the ramp peaks. Mitigation: a hairline outer contour at
`--metal-lo`, opacity ~0.5, **light theme only** — in dark it would read as an
outline on an object that should be defined by its own values.

**Section badges (spec §7).** Same paths, different dress. One SVG asset, two
classes: `.lock-svg--hero` gets the gradients and `--p`; `.lock-svg--badge` is
flat single-colour, keeps the existing accent/amber/`--text-dim` states, and
opens with a plain CSS `rotate` on the shackle group. It should read as the
hero lock's schematic sibling, not a shrunken copy. **One canvas in the hero is
the budget; four is not.**

**Unlock degrade.** On the SVG path the unlock is a CSS transition on the
shackle group — `rotate(-38deg)` about `145.5 150`, the hinge pin at the base
of the right leg. No pop, no tumbler turn. It reads as "the lock opened", which
is all the fallback owes anyone.

**Sizing** — shared with 3R-b, see §3.

---

### 3. Phase 3R-b — the WebGL scene

Port `lock-combined-prototype.html` into `js/lock3d.js`. **Port, do not paste** —
it is reference, not a drop-in, and it must live in the module structure.

**Loading.** A normal `defer`red CDN `<script>` with `integrity` and
`crossOrigin`, alongside GSAP — no dynamic injection, no idle callback (see §0).
r128 is a classic global build, so it lands on `window.THREE`; `lock.js` reads
it rather than importing it. On success, init the scene, cross-fade the canvas
in over ~200ms, and remove the SVG from the accessibility tree. On any failure —
no WebGL, script error, CDN blocked — do nothing at all; the SVG is already
correct and already on screen.

```js
function hasWebGL() {
  try { return !!document.createElement('canvas').getContext('webgl'); }
  catch (e) { return false; }
}
```

**The environment map is required, and it is the whole material.**
`MeshStandardMaterial` at `metalness: 1` has nothing to reflect without one, so
metal renders flat and dark *no matter how many lights are added*. This is the
gap between the standalone prototype and the reference image, and it cannot be
closed by raising light intensity.

The combined prototype builds one procedurally — 512x256 canvas, vertical
gradient sky, **vertical bright bars with hard near-black gaps**, through
`PMREMGenerator.fromEquirectangular()`. The bars are the mechanism: a flat metal
face reflects them as the hard vertical banding that reads as polished chrome.
Without the bars it is a smooth gradient, which reads as plastic. Lights then
only carry shadow and rim definition — `key` ~1.5, `hemi` ~0.25.

**Materials — two finishes, and the contrast is the design:**

```js
steel = { color: 0xdfe5ee, metalness: 1.00, roughness: 0.10 }   // shackle — mirror
shell = { color: 0x171b21, metalness: 0.94, roughness: 0.19 }   // body — dark gunmetal
```

Do not raise the body toward mirror chrome. Its darkness comes from the
near-black base colour, not from low metalness — it still needs high metalness
to catch the environment's banding or it flattens into plastic.

**Geometry derives from the reference ratios**, as the combined prototype does:
`BW`, `BH = BW*0.74`, `ARC`, `TUBE`. Retuning means changing constants in one
place rather than scaling the group. The body is `ExtrudeGeometry` with
`bevelThickness 0.07 / bevelSize 0.07 / bevelSegments 4` — that bevel is the
bright chamfer line from the reference and is non-optional.

**Camera — DECIDED: use `lock-combined-prototype.html`'s values,
`fov 35, position (0, 0.30, 5.3)`, looking at `(0, 0.30, 0)`.**

The spec's §1 text says `(0, 0.35, 4.6)` and disagrees. Two reasons the
prototype wins: it is the most recent working implementation, and spec §0 names
it the verified render. Critically, **the 0.77 fill constant in the sizing
formula was measured against the prototype's camera** — taking the camera from
one source and the constant from the other yields a lock of the wrong size and
a long confusing afternoon. If the camera is ever retuned, re-measure 0.77 in
the same sitting.

**Sizing.** The canvas is square and the lock fills only ~77% of it, so sizing
the canvas to 1.5x yields a lock that looks about 1.15x. Correct for it:

```css
.hero-band  { --hero-size: clamp(var(--display-md), 9vw, 92px); }
.lockup     { font-size: var(--hero-size); }
#lock-stage { width: calc(1.5 * var(--hero-size) / 0.77); aspect-ratio: 1; flex: none; }
```

Keep the existing clamp values — they are tuned for this site — but move them
into `--hero-size` so both numbers derive from one token and the ratio holds at
every breakpoint. Both the canvas and the SVG fallback use this box, so the swap
does not resize anything.

**Centre the body, not the box.** The shackle makes the object top-heavy and
box-centring makes it float above the type. Nudge with a CSS `translateY` on the
stage rather than moving the camera target — moving the target changes the 0.77
constant. Verify optically; the spec is explicit that 1.5 and this offset are a
starting point and your eye is the tiebreaker.

**Two things this breaks**, both fixed in the same commit:

1. `.hero-band` has `overflow: hidden` and will clip the lock once the stage
   translates up. Confirm what that rule was guarding (probably the grain layer)
   and scope it there instead.
2. Headroom: `padding-block-start: calc(0.25 * var(--lock-h) + var(--space-8))`,
   derived from the same token so it tracks at every breakpoint.

**Render loop and battery.** The `requestAnimationFrame` loop otherwise runs
forever for a 0.02-unit float. Gate it on an `IntersectionObserver` over the
stage *and* on `document.hidden`. The idle float stays; there is no idle
rotation — the lock never spins.

**Mobile.** Shadow map down to 512 and `pixelRatio` capped at 1.5 below 768px.
`PCFSoftShadowMap` at 1024² with `pixelRatio` 2 is real GPU work on a phone.
Measure on an actual device, not a simulator.

**Version pin.** r128 with SRI. If anyone bumps it: `renderer.outputEncoding`
and `THREE.sRGBEncoding` were **removed in r152+** (now `outputColorSpace` /
`SRGBColorSpace`) and the scene renders washed out. Two lines, but silent.

---

### 4. The scroll shine — one scalar, two implementations

**What it is:** a shine that travels across the lock as the visitor scrolls.
Scroll position is the only input. It runs continuously, locked or unlocked,
and is **entirely independent of the unlock**.

**What it is not:** a lighting effect that fires when the lock opens. The unlock
timeline drives no lights at all.

One `p` runs 0 -> 1 as the hero crosses the viewport. `0` = light hard left,
`1` = hard right. Both paths consume the same scalar:

| Path | `onUpdate` writes |
|---|---|
| WebGL | `key.position.x = -6 + p * 12`, `rim.position.x = 6 - p * 12` |
| SVG | `--p` on the rig, plus the specular gradient's `fx` |

In 3D the travelling specular, the shifting shade, the flipping lit edge and the
swinging cast shadow all follow **for free** from the renderer moving a real
light. That is the payoff for doing it in 3D instead of faking gradients — and
it is why the environment map matters so much, because the shine *is* the
environment's bright bars sweeping across the metal.

```js
scrollTrigger: { trigger: '#hero', start: 'top bottom', end: 'bottom top', scrub: 0.5 }
```

**No pin. No sticky.** Stated three times in the spec and once more here,
because `.hero-band` is at the top of the page and pinning it is the obvious
wrong move. The page scrolls at normal speed throughout.

**Idle oscillates around the scrub's resting value, not around 0.5.** The hero
sits at the top of the page, so on load the trigger is already partway through
its range and `p` rests near the middle. An idle loop swinging around a
hardcoded 0.5 will visibly jump the moment the scrub takes over. Read the
resting `p` and oscillate `+/-0.175` around *that*, one pass per ~5s, cancelled
on first scroll input.

**Strict separation from the unlock:**

| System | Writes to | Triggered by |
|---|---|---|
| Shine sweep | `key.position.x`, `rim.position.x` (or `--p`) | scroll, continuously |
| Unlock | mesh transforms only | a solved state, once |

Never the same property. Expect one consequence and do not "fix" it: if the
state flips mid-scroll, the shackle relights as it swings, because the renderer
is lighting a moving object. That is correct and desirable — do not freeze the
lights during the unlock.

---

### 5. The unlock animation

From `lock-unlock-prototype.html`, confirmed by the user, ~1.6s. **Implement
this; do not substitute a simpler reveal.** Absolute start times are part of the
design — each beat begins before the last ends, so it reads as one continuous
mechanism rather than four queued steps.

| # | Beat | Target | Value | Start | Duration | Ease |
|---|---|---|---|---|---|---|
| 2 | body recoils | `body.position.y` | `-0.39`, yoyo x1 | 0.36 | 0.07 | `power1.inOut` |
| 3 | shackle pops | `pivot.position.y` | `0.4` | 0.42 | 0.30 | `back.out(2.4)` |
| 4 | shackle swings | `pivot.rotation.y` | see below | 0.66 | 0.60 | `power3.out` |

**The pivot trick is the entire reason the lock is 3D.** A `pivot` group sits at
the right leg (`x = ARC`) with the shackle offset back (`x = -ARC`) inside it.
Rotating `pivot.rotation.y` swings the shackle out *sideways in depth*. Do not
rewrite it as a Z-rotation; that is the SVG fallback's version, and it is the
version that looks like a cartoon.

**Beat 4 needs a call.** The prototype's `-1.9` rad (~109°) puts the shackle
nearly perpendicular to camera, where it reads edge-on as a thin rod rather than
an open shackle — confirmed in render. **Use `-1.2` rad (~69°)** as the starting
value, in the spec's suggested 63-75° band: unmistakable 3D depth while the open
shackle stays legible. Check both in the browser and pick.

**The tumbler bug is already fixed in the combined prototype — keep it fixed.**
In the standalone version `tumbler` is a sibling of `body`, so beat 2 moves the
body and the keyhole detaches during the recoil. The tumbler must be parented to
the body.

**Beat 5 is CUT.** `LOCK_SPEC.md` §3 has a fifth beat that flashes the body
green (`shell.emissive`, green -> 0). **Remove it.** The lock does not flash
red or green — it is a neutral metal object and it signals state by *opening*,
which is the stronger signal and is consistent with it having been pulled out of
the accent system entirely.

This is the second deliberate deviation from the spec, alongside the trigger
below. It also deletes spec §9's "emissive green comes from theme tokens"
constraint and the `Color.setStyle()` parsing problem that came with it — Three
r128 cannot parse our space-separated `hsl(h s l)` tokens, and with no emissive
there is nothing to parse. **Note both deviations in the commit message.**

The site still turns green on solve: `DANG`, the pins, the badges, the borders
and glows all rotate. The lock stays chrome throughout.

**Trigger — DECIDED. The lock opens exactly once, when all three puzzles are
complete.** It fires on `data-solved` flipping `false -> true`: the third solve,
or bypass-on. Nothing else opens it.

This is the one deliberate deviation on a trigger question, and it is recorded
in the spec's authority table. Its §3 says the unlock fires "when a CTF challenge is solved",
singular. We are not doing that: firing a 1.6s four-beat mechanism three times
spends the payoff twice before it means anything, and a lock that opens on
challenge one has nothing left to say on challenge three. **Note the deviation
in the commit message** so nobody reads §3 later and "fixes" it back.

**The pin rail stays exactly as built**, and is now the only thing carrying
per-solve feedback:

| Event | Hero lock | Pin rail | Run console |
|---|---|---|---|
| solve 1 | nothing | pin 0 seats | `[+] skills.txt decrypted 1/3` |
| solve 2 | nothing | pin 1 seats | `[+] projects.db restored 2/3` |
| solve 3 | **plays, all four beats** | pin 2 seats | `[+] flag.png carved 3/3` |
| bypass on | **plays, all four beats** | unsolved pins go `shim` | `[!] bypass enabled` |
| bypass off | **relocks** | shims clear, seated pins stay | transient line removed |

Three pins seating one by one is the build-up; the lock opening is the payoff.
The lock stays visibly shut through the first two solves, which is what makes
the third land. On the third solve the pin-seat beat chains straight into beat 1
— no gap. Under bypass the staggered run reaches the lock at ~300ms.

**Relock:** reverse at 0.7x with `power2.in`. Mechanisms close faster and harder
than they open. Only bypass-off ever triggers it; a real solve is never undone.

---

### 6. State model

Three states, and the site must be able to enter **any** of them without playing
an animation:

| State | When | Visual |
|---|---|---|
| `locked` | default | shackle seated, tumbler upright |
| `unlocked` | after solve, after bypass | shackle up and swung open, tumbler turned |
| `unlocking` | the transition | the §5 timeline plays once |

The API is `setState(state, { animate })`. `animate: false` is `tl.progress(0)`
or `tl.progress(1)` with no playback. **Only a live solve animates.**

**One discrepancy to flag rather than silently resolve.** The spec's §5 lists
"on page load with saved progress" as a route into `unlocked`. This site does
not persist solve state — that is deliberate, and PLAN's phase 4 verification
asserts it ("reload comes back locked"). So that branch is currently
unreachable. Build the API anyway; it costs nothing and phase 5 may add
persistence. **Do not add persistence as a side effect of implementing the
state model.**

---

### 7. Theme sync

`theme.js` currently owns the theme and nothing listens. Add the counterpart to
`ctf:state`: a `theme:change` CustomEvent on `document` carrying the resolved
theme. `lock.js` subscribes.

**`scene.environment` must be rebuilt on toggle, not just the lights** — it
carries most of the material's appearance, and a dark studio env on the paper
theme is most of what would make the lock look like a hole punched in the page.
Dispose the old one; `PMREMGenerator` output is a GPU texture and leaks
otherwise.

Values from the combined prototype:

| | Dark | Light |
|---|---|---|
| `hemi.groundColor` | `0x0a0b0e` | `0xd8d3c4` |
| `hemi.intensity` | 0.25 | 0.55 |
| `rim.color` | `0x9fc4ff` | `0xffe9c4` |
| `shell.color` | `0x171b21` | `0x424953` |
| `steel.color` | `0xdfe5ee` | `0xf0f3f7` |
| `floorMat.opacity` | 0.42 | 0.20 |
| env floor / bars | dark, cool | brighter floor, warmer bars |

**The gunmetal body stays dark in light theme.** It lightens only enough to
separate from the paper ground (`0x424953`) — it never becomes a mirror. The
shackle/body contrast is the design in both themes.

These belong in `tokens.css` as lock tokens read by `lock3d.js`, not as hex
literals in JS. No hardcoded colour in the lock module. Note that with beat 5
cut there is no accent colour anywhere in the lock — these are all neutral
metal and lighting values.

---

### 8. Reduced motion and accessibility

**Reduced motion.** The prototype's `tl.progress(1)` is right for a demo and
wrong for the site — it would show every lock already open. Correct behaviour is
**snap to the current state without tweening**: `progress(0)` when locked,
`progress(1)` when unlocked, kill the ScrollTriggers, and park the lights
neutral (`p = 0.5`, `key.position.x = rim.position.x = 0`). The idle float goes
too.

**Accessibility.** A `<canvas>` is invisible to assistive tech. `role="img"`
plus an `aria-label` that tracks state ("Padlock, locked" / "Padlock,
unlocked"), updated on the same event that plays the timeline. **The real
announcement goes in an `aria-live` region on the section, not on the canvas** —
and we already have two (`.challenge-msg`, the progress `role="status"`), so the
lock adds none. When the canvas swaps in, the SVG must leave the accessibility
tree so the lock is not announced twice.

---

### 9. Risks

| Risk | Mitigation |
|---|---|
| Page weight | Budget raised to 600KB deliberately (§0); measure the real figure during 3R-b and report it |
| Metal renders flat and dark | The env map, with vertical bars. Not fixable with light intensity |
| Someone bumps Three past r152 | Pin r128 + SRI; `outputEncoding`/`sRGBEncoding` removed, renders washed out |
| Spec camera vs prototype camera | Use the prototype's `(0, 0.30, 5.3)`; the 0.77 constant was measured against it |
| Shackle reads as a thin rod when open | Beat 4 at `-1.2` rad, not `-1.9`; verify in browser |
| Phone GPU / battery | Shadow map 512, `pixelRatio` 1.5 below 768px, rAF gated on IntersectionObserver + `document.hidden` |
| Lock looks like a hole on paper theme | Rebuild `scene.environment` on toggle, not just lights; body lightens to `0x424953` |
| Visible pop when the canvas replaces the SVG | Shared sizing box, shared silhouette, ~200ms cross-fade. Fast now that Three is not deferred, but still present |
| PMREM texture leak on repeated theme toggles | Dispose the previous environment before assigning |
| `.hero-band { overflow: hidden }` clips the lock | Scope that rule to whatever it was actually guarding |

---

### 10. Files

| File | Change |
|---|---|
| `index.html` | hero lock SVG replaced (new geometry); `#lock-stage` wrapper wrapping both SVG and canvas; section badges swapped to the new SVG; `<title>`/`aria-label` state-tracking |
| `css/tokens.css` | `@property --p`; metal tokens both themes; lock 3D colour tokens; `--shine-intensity` / `--lock-bloom` removed |
| `css/components.css` | `.hero-lock` rules replaced; `--hero-size` + `#lock-stage` sizing; `.lock-svg--hero` / `--badge` dress; `.hero-band` overflow + padding |
| `css/motion.css` | `lock-shine-sweep` / `lock-shine-fade` / `[data-shine-band]` deleted; reduced-motion block rewritten |
| `js/lock.js` | rewritten as orchestrator — capability check, deferred Three load, path selection, `setState()`, SVG `--p` controller |
| `js/lock3d.js` | **new** — the Three.js scene, ported from the combined prototype |
| `js/theme.js` | dispatch `theme:change` |
| `js/animations.js` | phase 4; consumes the lock's `setState()` rather than owning the timeline |

Unchanged: `ctf.js`, `hud.js` state plumbing, the pin rail, the run console,
everything in phases 1 and 2.

---

### 11. Verification

**3R-a, on its own, with WebGL disabled:**

- Silhouette holds in both themes at `--p` = 0, 0.5, 1 (set by hand in devtools).
- Edge highlights actually swap sides crossing 0.5. If not, the `clamp()` signs
  are backwards and the model is inert.
- The body ramp still bands — screenshot it and confirm hard value jumps.
- Section badges read as schematic siblings, and still show locked / unlocked /
  bypassed states correctly.

**3R-b:**

- Metal reads as chrome, not grey plastic — the env map is the test.
- Shackle mirror vs body gunmetal contrast is visible in both themes.
- Optical size check at 375 / 768 / 1440: dominant but not comic, **body**
  centred on the type at all three.
- Nothing clips at the top of the hero band.
- Unlock plays once, all four beats overlapping into one motion; the open
  shackle reads as open, not as a rod. No colour flash at any point.
- Relock reverses faster and harder than the open.
- Solve mid-scroll: shackle relights as it swings, nothing stutters, no fight
  between scrub and timeline.
- Theme toggle mid-scene: env rebuilds, no leak across ten toggles (watch
  `renderer.info.memory.textures`).
- Scroll fast through the hero: **the page never stops scrolling.**
- Off-screen and backgrounded: rAF loop actually stops (breakpoint or a counter).
- Phone, real device: frame rate and battery, not a simulator.

**Both paths:**

- Reduced motion: lights neutral, no scrub, no float, lock at its *current*
  state — locked stays locked.
- Block the Three CDN: SVG stays, no console errors, no empty box.
- Throttle to slow 3G: SVG is visible from first paint; the canvas swap, when it
  lands, does not shift layout. This is the case option B makes worse — look at
  it honestly before shipping.
- Screen reader: the lock is announced once, with correct state, and the swap
  does not produce two.
- Budget: measure real first-load transfer, confirm it is under the new 600KB
  line, and write the number into this plan.

---

## Phase 3R notes

Both sub-phases shipped in one commit. The SVG hero lock, the metal tokens, the
`--p` scroll lighting and the section badges are 3R-a; the Three.js scene, the
theme sync and the state machine are 3R-b.

**Budget — measured, as §0 required.** First-load *transfer*, which is what a
visitor actually waits for, is **314KB**: Three 150KB gz, GSAP core 28KB gz,
ScrollTrigger 18KB gz, the portrait 75KB, and 42KB gz for all of the HTML, CSS
and JS together. Web fonts are not in that figure. Uncompressed the same set is
926KB, and Three is 603KB of it. **The 600KB line holds against transfer and is
blown by raw bytes**, so the line is recorded as 600KB *transferred* — that is
the number the constraint was always about, and it leaves ~285KB of headroom.

**The two deviations from `LOCK_SPEC.md`, both deliberate:**

1. **The lock opens once, when all three puzzles are complete** — the third
   solve or bypass-on, on `data-solved` flipping. The spec's §3 fires it per
   challenge. Firing a 1.6s four-beat mechanism three times spends the payoff
   twice before it means anything.
2. **Beat 5 is cut.** The spec flashes the body green on unlock. The lock is a
   neutral metal object and signals state by opening, which is the stronger
   signal and consistent with it having been pulled out of the accent system.
   This also deletes the spec §9 constraint that the emissive colour come from
   a theme token, and with it the fact that Three r128 cannot parse our
   space-separated `hsl(h s l)` values.

**A third deviation, added after looking at it on screen.** `LOCK_SPEC.md` §1
locks the body as dark gunmetal and says explicitly not to raise it toward
mirror chrome. Built that way, the body's flat face came back as one untextured
tone — it read as plastic beside the SVG lock's hard mirror banding, and the
SVG's material was the one worth keeping. **Both parts are now polished chrome**,
separated by tone rather than by finish: the shackle is the brighter of the two.

Getting the banding onto the body needed one non-obvious thing. **The body and
the shackle carry their own environment maps**, because no single one serves
both. A flat face at this camera reflects only ~35 degrees of the environment —
about 50px of a 512px equirect — so the prototype's 26-74px softboxes left the
body inside a single bar, a mirror with nothing to mirror. The tube is the
opposite case: its curvature sweeps the whole map in a few screen pixels, so
bars fine enough to band the body alias into ringing on the shackle. The body
reflects a 26px repeating ramp built from the SVG lock's own stop sequence; the
shackle keeps the wide softboxes. The tube also went from 22 radial segments to
36, since its own faceting showed against the finer pattern.

**Three more changes, made after looking at it on screen.**

- **The keyhole is a hole in the body's own extruded shape**, cutting through to
  the page exactly as the SVG lock's does, with the extrude bevel wrapping the
  cut to give the drilled edge its bright rim. The path has to be inflated by
  `bevelSize` on every side, because the bevel eats that much off a hole: cut at
  the spec's own numbers the circle closes to a pinhole and the slot pinches
  shut. This deletes the separate tumbler mesh, and with it **beat 1, the key
  turn** - there is nothing left to rotate. The remaining three beats keep their
  spacing exactly, shifted 0.36s earlier so the mechanism starts on the first
  frame instead of after the gap the key turn used to fill.
- **The cast shadow is gone**, along with the shadow map and the shadow-catcher
  plane. That also takes `PCFSoftShadowMap` off the phone GPU budget.
- **The scroll range is measured from the hero band's top, not the lock's
  bottom.** `LOCK_SPEC.md` (3) specifies `top bottom` -> `bottom top`, which is
  right for an element somewhere down the page and wrong for the first thing on
  it: that range is already ~70% consumed before the visitor scrolls a pixel, so
  they would only ever see the tail of the sweep. Measured from the band's top
  the full pass happens over the hero's exit - left to right scrolling down,
  right to left scrolling back up, which the scrub gives for free.

Also decided in the build: **beat 4 swings to -1.2 rad**, not the prototype's
-1.9, where the shackle reads edge-on as a rod.

**The travelling shine needed a hybrid, and the reason is worth keeping.** The
two halves of the lock respond to a moving light completely differently. The
shackle is a tube: its normals sweep a wide range, so moving the key light
slides a highlight along it exactly as `lock-light-prototype.html` describes.
The body's front face is flat and faces the camera - every point on it shares a
normal, so a moving light barely touches it. What that face shows is the
environment, and an environment map is fixed in world space with no way to
rotate it in Three r128. So the face gets the prototype's own answer instead: a
soft specular band, additively blended, travelling across it on a texture
offset. It is built from the body's own `Shape`, so it is clipped to the
silhouette *and* to the keyhole for free - the same rule the SVG lock's mask
enforces, that light never spills past the metal.

**Three bugs found while building, all fixed:**

- **The keyhole was buried inside the body.** `ExtrudeGeometry` adds
  `bevelThickness` to *each* face, so a centred body's front sits at
  `BD/2 + BEVEL`, not `BD/2`. The combined prototype has the same line and the
  same defect; it is subtle enough there to miss.
- **`stage.dataset.lock3d` serialises to `data-lock3d`,** which never matches a
  `[data-lock-3d="on"]` selector — the canvas rendered correctly and stayed at
  `opacity: 0` behind a perfectly good SVG. `setAttribute` instead.
- **SVG gradient stops cannot take a token from a presentation attribute.**
  `stop-color="var(--metal-hi)"` does not resolve; presentation attributes are
  not the cascade. The stops carry classes and the colour comes from CSS.

**Incidental fixes, both pre-existing:** the badge is wider than the bare
`[ locked ]` text it replaced and pushed the longest section header 13px past a
320px viewport, so `.section-header` wraps below 768px; and `.lock-icon.is-bypassed`
used `--text-dim` (3.43:1 dark, 2.83:1 light — both below AA), which is gone with
the class, the bypassed badge now using the same amber as the run console's
bypass line.

**Verified.** SVG path with WebGL unavailable: ramp bands hard, edge highlights
swap sides across `p = 0.5` (measured 0/0.19 either side), silhouette holds in
both themes. WebGL path under software rendering: canvas swaps in, chrome
shackle against gunmetal body reads correctly in both themes, keyhole visible.
Bypass drives the whole chain end to end — lock state, `<title>`, canvas
`aria-label`, SVG out of the a11y tree, all three badges, pins, run console.
Reduced motion parks `--p` at 0.5 and leaves the lock shut. No horizontal
overflow at 320px or 390px.

**Not verified here, and worth a real browser:** GSAP's ticker barely advances
under headless virtual time, so the unlock timeline only ever reached 0.7%
progress in automation. The four beats and the relock need a real look.


## Phase 3 -> 4: the unlock system

**Chosen direction: `ideas.md` 2 + 4 — the terminal run log plus the hero pin
rail.** Idea 4 supplies the escalation (three pins seat, one per solve, and the
hero lock opens on the third), idea 2 supplies the narration (a console prints
a line for each). The hero lock stops being decoration and becomes the
scoreboard.

Phase 3 draws every piece of this and leaves it inert. Phase 4 only adds
behavior, so phase 4 introduces **no new markup and no layout change**.

---

### 1. The pieces

**The hero pin rail.** Three small pins sit beside the hero lock, part of the
`MARTIN [lock] DANG` lockup rather than an add-on. Three states:

| State | Meaning | Look |
|---|---|---|
| `empty` | not yet solved | hollow, `--text-muted`, no glow |
| `seated` | solved, permanent | filled, `--accent`, small glow |
| `shim` | open via bypass, temporary | dashed outline, `--amber` |

The `shim` state matters: bypassing opens the lock on a shim, not on a key, and
the hero says so. It reuses the amber that `.lock-icon.is-bypassed` already
uses, so bypass reads the same everywhere on the page.

**The run console.** A terminal block directly under the existing progress row —
together they form one status strip. Lines accumulate:

```
[+] skills.txt      decrypted   1/3
[+] projects.db     restored    2/3
[+] flag.png        carved      3/3_
```

At rest it shows `> awaiting input_` with the existing `blink-dot` cursor, so
the reserved space reads as an idle console rather than dead air. Once lines
exist the resting prompt is gone and the cursor sits at the end of the last
line.

**Height is reserved for four lines and never changes.** Four is the maximum:
three solve lines, or two solve lines plus the bypass line. Growing the block
would push the sections down, which the zero-layout-shift rule forbids.

**The console is `aria-hidden="true"`.** It is a visual echo of things already
announced — `// access granted` in each `.challenge-msg` (`aria-live="polite"`)
and the `n / 3 unlocked` label (`role="status"`). A third live region on the
same event means the same solve announced three times.

**The three progress dots stay.** They and the pins are redundant on purpose:
the pins live in the hero and are scrolled away by the time anyone is solving
challenge 2 or 3, and the dots sit next to the work. If that redundancy still
grates once it is on screen, cut the dots, not the pins.

---

### 2. What happens on an individual solve

Fires on `ctf:state` with `reason: 'solve'`. Roughly 900ms end to end, and
nothing in it blocks reading the content that just appeared.

| # | Beat | Target | Properties | Timing |
|---|---|---|---|---|
| 1 | challenge collapses | `[data-challenge]` | GSAP Flip out; revealed block flips into the space | 300ms, `power2.inOut` |
| 2 | lock tag flips | `[data-lock]` | `[ locked ]` -> `[ unlocked ]`, scale pop 1 -> 1.12 -> 1 | 200ms, `back.out(2)` |
| 3 | content staggers in | `[data-reveal]` children | `y: 8 -> 0`, `opacity: 0 -> 1`, 60ms stagger | 350ms, `--ease-out` |
| 4 | glyph flies to the hero | cloned `[data-lock]` | see below | 520ms, starts at beat 2 |
| 5 | pin seats | `[data-pin="i"]` | `empty -> seated`, scale 0.6 -> 1.15 -> 1 | 180ms, `back.out(2.2)`, on flight arrival |
| 6 | log line prints | console | types at 28ms/char | ~600ms, starts with beat 4 |
| 7 | dot fills | `[data-dot]` | existing `is-done` | unchanged |

**The flight (beat 4).** Clone the `[ unlocked ]` tag, `position: fixed`, tween
from the source `getBoundingClientRect()` to the target pin's. Two tweens, not
one: `x` linear, `y` on `power2.in`. That gives an arc for free — no MotionPath
plugin, nothing added to the budget. The clone's `z-index` sits **below** the
sticky topbar so it passes underneath rather than over it. Remove the clone on
arrival and hand off to beat 5.

**Guards on the flight.** Skip it and seat the pin directly when the hero pin
is off-screen (`rect.bottom < 0`), when `document.hidden`, or under reduced
motion. A glyph flying to somewhere nobody is looking is wasted motion, and a
tab that never renders never fires the completion callback.

**On the third solve**, beat 5 chains straight into the hero lock unlock
timeline in section 4 below.

---

### 3. The bypass toggle — required, and it is a real toggle

The `[ skip puzzles ]` button stays exactly where it is. Nobody is ever forced
to solve anything, and the no-JS render remains fully bypassed by default.

**Bypass ON fires the whole unlock at once** — but *at once* means a tight
staggered run, not three separate 900ms choreographies stacked on the same
frame. Roughly 1.0s total:

| t | Beat |
|---|---|
| 0ms | all three sections reveal, 80ms stagger between them |
| 0ms | the `[!]` bypass log line prints at 3x speed |
| 120ms | pins run left to right, 90ms apart: unsolved -> `shim`, already-solved stay `seated` |
| 300ms | the hero lock unlock timeline plays |

**No glyph flights on bypass.** Three clones launching from three sections that
are mostly off-screen is noise. The pins simply snap with their seat pop.

**Bypass OFF relocks, and it is a genuine reverse**, ~600ms: the hero lock
timeline `.reverse()`s, pins un-seat right to left, the transient log line
fades out and is removed from the DOM, and any section that was open only
because of bypass re-hides via Flip.

**Earned state survives relocking.** Sections in `solved[]` stay open, their
pins stay `seated`, and their log lines stay printed. Only bypass-supplied
state comes back off. If all three were genuinely solved, toggling bypass off
changes nothing visible — which is correct.

**The log distinguishes earned from skipped.** Solve lines are permanent.
The bypass line is marked `data-transient` and removed on toggle off:

```
[!] bypass enabled — 3 sections force-mounted, 0 solved
```

**Spam-safe.** One module-level timeline per concern, `.play()` / `.reverse()`
on the same instance rather than a new one per click; every pin tween uses
`overwrite: 'auto'`; in-flight clones are tracked in a `Set` and killed on any
state change. Toggling the button ten times in two seconds must leave the page
in the state the button says it is in.

**Reduced motion.** Everything applies instantly, no stagger, no typing, no
flights. The end state is identical.

**Optional, decide when it is on screen:** under bypass the counter still reads
`0 / 3 unlocked` while the whole page is open. That is honest but reads oddly.
Appending `· bypass` to the label would fix it; it is a one-line change and is
not part of the phase 4 scope unless asked for.

---

### 4. The hero lock unlock

> **Superseded by phase 3R §7.** The beat table below is the pre-`LOCK_SPEC.md`
> version and is kept only for the trigger and reduced-motion rules, which still
> hold. Use the four-beat table in phase 3R for the animation itself.

**Trigger.** `document.documentElement.dataset.solved` flips `false -> true` —
the third solve, or bypass on. Reversible when bypass goes back off.

| # | Beat | Target | Properties | Timing |
|---|---|---|---|---|
| 1 | tumbler catch | lock body `<g>` | `rotate` +/-1.5deg, twice | 120ms, `power1.inOut` |
| 2 | shackle opens | shackle `<g>` | `rotate: -32 -> settle -28`, `y: -3` | 380ms, `back.out(1.4)` |
| 3 | accent rotates | `:root` | `--accent-h` 0 -> 152 | 500ms, concurrent with 2 |
| 4 | specular flash | shine mask | one full sweep at 100% + `drop-shadow` bloom peak | 700ms, starts with 2 |
| 5 | settle | whole lock | body drops 1px, everything rests | 150ms |

`data-solved` keeps its shipped two-state behavior — green under bypass as well
as under a real solve. The earned-versus-shimmed distinction is carried by the
pins, in amber, which is additive and does not disturb anything phase 2 verified.

**Reduced motion.** No rotation, no flash. The lock swaps straight to open and
the accent uses the existing 350ms crossfade.

**Zero layout shift.** The shackle rotates inside the SVG viewBox. The hero
band's height never changes.

---

### 5. Phase 3 foundation checklist

Not optional. Each is cheap while drawing the lockup and expensive to retrofit.

**Lock geometry**

1. Shackle in its own `<g>`, body in its own `<g>` — the transform goes on the
   group, so separate paths alone are not enough.
2. `transform-box: fill-box` plus an explicit `transform-origin` on the shackle
   group at the hinge pin (base of the right leg, where it enters the body).
   Write the coordinate into an SVG comment; phase 4 should not re-derive it.
3. Reserve ~8 user units of empty viewBox above the shackle's resting arc, or a
   -32deg rotation plus a 3px lift clips.

**Tokens and properties**

4. Register the accent channels with `@property` in `tokens.css` — `--accent-h`
   as `<number>`, `inherits: true`. Unregistered custom properties do not
   interpolate, so without this the hue snaps instead of rotating.
5. Add the new motion tokens alongside the existing `--dur-*` set:
   `--dur-flight: 520ms`, `--dur-seat: 180ms`, `--dur-type: 28ms`.
   GSAP-side eases (`back.out`, `power2.in`) stay in JS — they have no CSS
   equivalent and do not belong in `tokens.css`.

**State plumbing**

6. `ctf.js` dispatches instead of being read from. At the end of `render()`:
   `document.dispatchEvent(new CustomEvent('ctf:state', { detail: { solved, total, bypass, reason, index } }))`
   where `reason` is `'init' | 'solve' | 'bypass-on' | 'bypass-off'` and
   `index` is the section that changed, or `null`. **`reason: 'init'` must
   apply state without animating** — this is what stops the whole choreography
   firing on page load.
7. `lock.js` exposes an imperative `sweep({ intensity, duration })`, and its
   idle ambient loop is cancellable and resumable, so the unlock flash does not
   fight the 5s idle sweep or the scroll scrub.

**Markup shipped empty**

8. The pin rail: three pins in the hero lockup, `[data-pin="0..2"]`, rendered
   in `empty` state. Phase 3 also ships the CSS for `seated` and `shim` —
   verifiable by hand-setting `data-pin-state` in devtools — but never sets them.
9. The run console: the block, its four-line reserved height, the resting
   `> awaiting input_` line, the blinking cursor, `aria-hidden="true"`. Empty of
   behavior. Grouped with the existing `.progress` row into one status strip.
10. `js/hud.js` exists and exports `initHud()`, called from `main.js` after
    `initCtf()`. In phase 3 it is a no-op stub that only listens for
    `ctf:state` and applies pin/log state **without animation** — which means
    phase 3 already proves the event plumbing works end to end.

---

### 6. Phase 4 build order

1. Wire `hud.js` for real: pin state transitions and the console printer,
   still with no flights and no hero timeline. Solving now seats pins and
   prints lines.
2. Add the flight clone and its guards.
3. Build the hero unlock timeline in `animations.js`, triggered off
   `data-solved`. Verify play and reverse in isolation before wiring bypass.
4. Wire the bypass staggered run and the relock reverse.
5. Reduced-motion pass over all four, then the spam-toggle pass.

Each step ends deployable: an unfinished later step just means less motion, not
a broken page.

---

### 7. Risks specific to this system

| Risk | Mitigation |
|---|---|
| Flight clone lands on the wrong spot after a scroll mid-flight | Recompute the target rect on completion and snap; the seat pop hides the correction |
| Flight passes over the sticky topbar and looks wrong | Clone's `z-index` sits below the topbar's, deliberately |
| Rapid bypass toggling leaves half-reversed state | Single reusable timeline per concern, `overwrite: 'auto'`, clone `Set` killed on every state change |
| Console typing still running when the next solve arrives | Printer queues; a new line waits, or fast-forwards the current one to complete |
| Four reserved console lines look like dead air on first load | The resting `> awaiting input_` prompt plus blinking cursor makes the empty state intentional |
| Three `aria-live` regions announcing one solve | Console is `aria-hidden`; the existing two regions are unchanged |
| Pins and dots read as duplicated progress | Accepted for now — different scroll positions. Reassess on screen; cut the dots if it grates |
| GSAP Flip pushes the bundle over budget | Flip is the only plugin beyond core + ScrollTrigger; measure at step 1 of phase 4 against the ~190KB headroom and fall back to a plain height-free crossfade if it is tight |

---

### 8. Verification for phase 4

On top of the standing per-phase checks (contrast in both themes, keyboard-only,
reduced-motion, JS-disabled, screenshot diff):

- Solve all three in order — pins seat left to right, three log lines, hero
  opens on the third.
- Solve one, bypass on, bypass off — the solved section stays open, its pin
  stays `seated`, its log line stays; the other two relock and their pins clear.
- Bypass on with zero solves, then off — the page returns exactly to first-load
  state, transient log line removed from the DOM.
- Toggle bypass ten times rapidly — final state matches the button label.
- Solve a challenge with the hero scrolled off-screen — no flight, pin seated,
  no console errors.
- Solve with the tab backgrounded, then return — state is correct, nothing
  stuck mid-tween.
- Reduced motion — all of the above, instant, same end states.
- Reload after any of it — nothing persists, and the page comes back locked
  with the console at rest. (Solve state is intentionally not stored.)

## Decisions carried from the brief (do not re-litigate)

- **The 400KB budget is superseded.** Raised to 600KB in phase 3R §0 to admit
  Three.js, with the real figure to be measured during 3R-b. The brief's §8
  number is historical.

- Split files, no build step; ES modules; CDN with SRI + `defer`.
- GSAP-primary + native CSS. No motion.dev, no anime.js — three engines means
  three scroll listeners and ~110KB for effects GSAP already covers.
- Hand-authored inline SVG padlock — now the fallback path and the section
  badges only; the hero lock is WebGL (phase 3R, per `LOCK_SPEC.md` §0).
- Exactly one inline script permitted: the pre-paint `data-theme` setter (phase 2).

## Open items

- **WebP portrait.** No local encoder (`cwebp`, ImageMagick, PIL all absent;
  `sips` has no WebP export). Shipped an optimized JPEG instead: 704KB -> 74KB.
  Installing `webp` would allow a `<picture>` source at roughly half again.
- **Test harness.** The contrast audit, the 38 functional assertions and the
  24 theme assertions live in the scratchpad, not the repo, so they are lost
  between sessions. Worth committing under `tests/` if they should persist.
- **Native CSS scroll-driven animation** (`animation-timeline: view()`) as an
  alternative to ScrollTrigger for the hero shine — evaluate in phase 3.
  ScrollTrigger stays the primary; native CSS only where a silent no-op is fine.
