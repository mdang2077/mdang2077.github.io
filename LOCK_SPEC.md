# Lock Spec — hero padlock

Companion to `CLAUDE_CODE_BRIEF.md` §5. **This document and `PLAN.md` are both authoritative.** Where either conflicts with the brief, the brief loses.

### Authority — which file wins

The two authoritative documents own different questions, so most conflicts are not real conflicts:

| Question | Owner |
|---|---|
| What the lock *is* — technology, form, geometry, size, materials, lighting model, unlock choreography | **this file** |
| How it gets *built and integrated* — phase order, what ships when, triggers and site state, budgets, fallback sequencing, deviations | **`PLAN.md`** |

Where they genuinely disagree on the same question, **`PLAN.md` wins**, because it is the later document and it records decisions made after this spec was written. Every such divergence is called out here inline and argued in `PLAN.md` — a bare contradiction with no note on either side is a bug in the documents, not a licence to pick one.

Below both files sits `lock-combined-prototype.html`: the verified render, with the geometry, environment-map and tumbler-parenting fixes already applied. **Where the prototype and this spec's prose disagree on a measured value, the prototype wins** (see §1, the camera).

**Live divergences, all resolved in `PLAN.md`'s favour:**

| # | This spec says | Decided | Where |
|---|---|---|---|
| 1 | camera `(0, 0.35, 4.6)` (§1) | `fov 35, position (0, 0.30, 5.3)`, target `(0, 0.30, 0)` — the prototype's values, which the 0.77 fill constant was measured against | `PLAN.md` §3 |
| 2 | unlock fires when *a* challenge is solved (§3) | fires **once**, on `data-solved` flipping `false -> true` — third solve or bypass-on | `PLAN.md` §7 |
| 3 | beat 5 flashes `shell.emissive` green, read from theme tokens (§3, §9) | **beat 5 is cut.** The lock is neutral metal and signals state by opening; nothing about it is tinted by the accent | `PLAN.md` §7 |

---

## 0. Decision — the hero lock is real 3D (Three.js)

Two working prototypes define this feature, both in the repo root. **Read and run both before writing any code.**

| File | Contributes |
|---|---|
| `lock-unlock-prototype.html` | The padlock itself and the **unlock animation**. Three.js + GSAP. |
| `lock-light-prototype.html` | The **scroll-driven lighting model** — one normalised scalar `p` relights the whole object. |
| `lock-combined-prototype.html` | **All three at once**, verified rendering: chrome material + scroll light sweep + unlock, in both themes, with the fixes below already applied. Start here. |

The unlock prototype settles the technology question. Its payoff beat — the shackle **swinging out sideways on `rotation.y`**, pivoting on the right leg — is genuinely three-dimensional and cannot be faked in SVG. Once the hero lock is a WebGL object, the lighting model should drive a real light rather than CSS gradients.

**Consequence:** the hero lock is a Three.js scene. SVG is still used, but only for the small per-section lock badges (§7).

### Decisions already made — do not re-litigate

| Decision | Status |
|---|---|
| Hero lock is a Three.js WebGL scene | **Locked** |
| The 3D unlock animation (§3), including the sideways `rotation.y` shackle swing | **Locked — approved** |
| The light animation is a **scroll-driven shine sweep** across the lock (§4) | **Locked** |
| Body finish is **dark gunmetal**, shackle is polished chrome (§1) | **Locked** |
| Lock renders at 1.5× the hero name type size (§2) | **Locked** |

**This costs real budget. See §8 before committing.**

---

## 1. Form and style

Visual reference: a 3D-rendered polished-chrome padlock (stock image, watermarked — **the raster must never be used**). The unlock prototype's geometry already matches it closely. Match the *material* to the reference:

- **Two distinct finishes, deliberately.** The shackle is **polished mirror chrome**; the body is **dark gunmetal** — matte-ish, low-key, absorbing rather than mirroring. This contrast is the design, not a shortfall against the reference image. **Do not raise the body toward mirror chrome.** Values from `lock-combined-prototype.html`:
  ```js
  steel = { color: 0xdfe5ee, metalness: 1.00, roughness: 0.10 }   // shackle — mirror
  shell = { color: 0x171b21, metalness: 0.94, roughness: 0.19 }   // body — dark gunmetal
  ```
  The body's darkness comes from its near-black base `color`, not from low metalness — it still needs high metalness to catch the environment's edge banding, or it flattens into plastic.
- **Extreme value range.** Near-black shadows against blown-out white speculars, very little mid-tone. That hard contrast is what reads as *chrome* rather than grey plastic. Lower `roughness` before raising light intensity.
- **Squarish body, thick tubular shackle.** Heavy and machined — not a thin icon, not a rounded app-icon padlock.
- **Beveled body edges.** The prototype's `ExtrudeGeometry` bevel (`bevelThickness 0.07`, `bevelSize 0.07`, `bevelSegments 4`) produces the bright chamfer line seen in the reference. Non-optional — without it the body reads as a plain rounded box.
- **Keyhole cut** reading as a dark recess, with light catching its edge.
- **Head-on camera, no orbit.** ~~`fov 35`, `position (0, 0.35, 4.6)`~~ — **superseded, see the authority table above.** Use `lock-combined-prototype.html`: `fov 35`, `position (0, 0.30, 5.3)`, looking at `(0, 0.30, 0)`. The 0.77 fill constant in §2 was measured against that camera; take both from the same source or the lock comes out the wrong size. The lock never spins idly; the only idle motion is the faint vertical float.

### An environment map is REQUIRED

`MeshStandardMaterial` with high `metalness` has **nothing to reflect** without an environment map, so metal renders flat and dark no matter how many lights you add. This is the single biggest gap between the standalone unlock prototype and the reference image, and it is not fixable by raising light intensity.

`lock-combined-prototype.html` builds one procedurally — no asset, no extra dependency:

- A 512×256 canvas: vertical gradient sky (bright top → near-black floor).
- **Vertical bright bars** painted across it, with hard near-black gaps between them.
- Fed through `THREE.PMREMGenerator.fromEquirectangular()` and assigned to `scene.environment`.

The vertical bars are the mechanism: a flat metal face reflects them as the hard bright/dark **vertical banding** that reads as polished chrome in the reference. Without the bars you get a smooth gradient, which reads as plastic.

Lights then only need to carry shadow and rim definition — drop `key` to ~1.5 and `hemi` to ~0.25, and let the environment do the material work. Rebuild the env on theme change; the light theme needs a brighter floor and warmer bars.

**Proportions** measured from the reference image, for verification against the prototype:

| Ratio to body width | Reference | Prototype |
|---|---|---|
| Body height | 0.74 | 0.84 |
| Shackle outer width | 0.83 | 0.79 |
| Shackle height above body | 0.77 | 0.68 |
| Tube thickness | 0.14 | 0.15 |

The standalone unlock prototype is close but not exact — its body is too tall and its shackle too short. `lock-combined-prototype.html` **already fixes this**: it derives all geometry from the reference ratios (`BW`, `BH = BW*0.74`, `ARC`, `TUBE`), so retuning means changing `BW` and the ratio constants in one place rather than scaling the group.

---

## 2. Size — 1.5× the hero name

**The lock renders at 1.5× the hero name's type size.** It is the largest element in the hero and should dominate it.

```css
.hero { --hero-size: clamp(2.5rem, 7vw, 5rem); }   /* the MARTIN / DANG type size */
#lock-stage { height: calc(1.5 * var(--hero-size)); width: auto; aspect-ratio: 1; }
```

- Both values derive from one token, so the ratio holds at every breakpoint.
- The canvas is square but the lock only fills ~77% of it, so sizing the *canvas* to 1.5× yields a lock that looks about 1.15×. `lock-combined-prototype.html` corrects for this: `width: calc(1.5 * var(--hero-size) / 0.77)`. If you change the camera `fov` or `z`, that 0.77 constant changes with it.
- `font-size` ≠ visual cap height, so **check optically in the browser** and nudge the multiplier. 1.5 is the spec; your eye is the tiebreaker.
- Centre the lock's **body** on the type's optical centre, not the canvas box — the shackle makes the object top-heavy and box-centring makes it look like it's floating.

---

## 3. Unlock animation — approved, build this

Taken directly from `lock-unlock-prototype.html` and confirmed by the user. ~~Fires when a CTF challenge is solved.~~ **Superseded:** fires exactly once, when all three are complete — `data-solved` going `false -> true` (`PLAN.md` §7). ~1.6s total. **This is the specified behaviour — implement it, don't substitute a simpler reveal.**

| # | Beat | Target | Value | Start | Duration | Ease |
|---|---|---|---|---|---|---|
| 1 | Tumbler turns | `tumbler.rotation.z` | `-π/2` | 0.00 | 0.42 | `power2.inOut` |
| 2 | Body recoils | `body.position.y` | `-0.39`, yoyo ×1 | 0.36 | 0.07 | `power1.inOut` |
| 3 | Shackle pops | `pivot.position.y` | `0.4` | 0.42 | 0.30 | `back.out(2.4)` |
| 4 | Shackle swings | `pivot.rotation.y` | `-1.9` rad | 0.66 | 0.60 | `power3.out` |
| ~~5~~ | ~~Confirmation pulse~~ — **CUT**, see authority table | `shell.emissive` | green → 0 | 0.70 | 0.15 + 0.70 | `power2.out` |

**Tuning note on beat 4:** at `-1.9` rad (~109°) the shackle ends up nearly perpendicular to the camera, so it reads edge-on as a thin rod rather than as an open shackle — confirmed in render. Consider `-1.1` to `-1.3` rad (63–75°): enough to unmistakably read as 3D depth, while the open shackle stays legible. Check in the browser and pick.

**The three things that make it work — preserve all of them:**

- **The pivot trick.** A `pivot` group sits at the right leg (`x = 0.5`) with the shackle offset back (`x = -0.5`) inside it. Rotating `pivot.rotation.y` swings the shackle out *sideways in depth*. This is the payoff and the entire reason the lock is 3D. Do not rewrite it as a Z-rotation.
- **Beat overlap.** Each beat starts before the previous ends (0.36 into a 0.42, 0.42 into a 0.48, 0.66 into a 0.72). The mechanism reads as one continuous action, not five queued steps. Keep the absolute start times.
- ~~**The emissive pulse ties to site state.**~~ **Void — beat 5 is cut** (`PLAN.md` §7). The lock carries no accent colour in either state, so there is no token to read and no `Color.setStyle()` parse of our space-separated `hsl(h s l)` values to get wrong. The site still turns green on solve everywhere else; the lock stays chrome.

**Relock**, if a section can re-lock: reverse at 0.7× with `power2.in`. Mechanisms close faster and harder than they open.

### Bug in the prototype — fix it

`tumbler` is a sibling of `body`, both positioned at `y = -0.35`. Beat 2 animates `body.position.y` but not the tumbler, so **the keyhole detaches from the body during the recoil**. Parent the tumbler to the body (or to a shared group) so they move together.

---

## 4. Light animation — scroll-driven shine sweep

**What this is:** a shine that travels across the lock **as the visitor scrolls**. Scroll position is the only input. It runs continuously whether the lock is locked or unlocked, and it is entirely independent of the unlock.

**What this is not:** it is *not* a lighting effect that fires when the lock opens. The unlock animation (§3) drives no lights at all.

### The model

`lock-light-prototype.html` establishes it: a single normalised value `p` runs 0 → 1 as the hero crosses the viewport. `0` = light hard left, `1` = light hard right. Everything derives from that one scalar, so the object relights **coherently** — this is a moving light source, not a highlight sliding across a static image.

In 3D it gets simpler and better, because you move the actual light and let the renderer do the rest:

```js
gsap.registerPlugin(ScrollTrigger);

const state = { p: 0 };
gsap.to(state, {
  p: 1,
  ease: 'none',
  scrollTrigger: {
    trigger: '#hero',
    start: 'top bottom',   // p=0 as the hero enters the bottom of the viewport
    end: 'bottom top',     // p=1 as it exits the top — one pass = one sweep
    scrub: 0.5,            // smoothing only
    // NO pin, NO sticky — the page must never stop scrolling
  },
  onUpdate() {
    key.position.x = -6 + state.p * 12;   // key light travels left → right
    rim.position.x =  6 - state.p * 12;   // rim light travels opposite
  }
});
```

The travelling specular on the chrome shackle, the shifting shade on the gunmetal body, the flipping lit edge, and the swinging cast shadow all follow for free from the renderer. That is the payoff for doing it in 3D rather than faking gradients — and it is why the environment map (§1) matters so much here: the shine is the environment's bright bars sweeping across the metal as the light moves.

**Non-negotiable:** no `pin`, no `position: sticky` on the hero. The page scrolls at normal speed throughout. Hijacking scroll to play an animation is the failure mode this design specifically avoids — the CSS prototype's comments say so twice, for good reason.

**Idle:** the faint vertical float (`sin(t / 1400) * 0.02`) stays. No idle rotation. At rest at the top of the page, sweep the key light once every ~5s at ~35% amplitude so the shine is discoverable without scrolling; cancel it on first scroll input and hand over to the scrub.

### Strict separation from the unlock

| System | Writes to | Triggered by |
|---|---|---|
| Shine sweep (§4) | `key.position.x`, `rim.position.x` | scroll position, continuously |
| Unlock (§3) | mesh transforms (no `emissive` — beat 5 cut) | all three solved, or bypass-on; once |

They must never touch the same property. If the unlock timeline moves a light, or the scrub moves a mesh, the two will fight on every scroll event.

One consequence worth expecting: if a visitor solves a challenge mid-scroll, the shackle will relight as it swings — because the renderer is lighting a moving object, not because anything authored it. That is correct and desirable; do not try to freeze the lights during the unlock.

---

## 5. State model

The lock has three states, and the site must be able to enter any of them without playing an animation:

| State | When | Visual |
|---|---|---|
| `locked` | default | shackle seated, tumbler upright |
| `unlocking` | challenge solved | the §3 timeline plays once |
| `unlocked` | after solve, after bypass, or on page load with saved progress | shackle up and swung open, tumbler turned |

A returning visitor with saved progress, or one who hits `[ skip puzzles ]`, must land on `unlocked` **instantly** — `tl.progress(1)`, no playback. Only a live solve plays the timeline.

---

## 6. Fallback — required, not optional

WebGL can be unavailable (old hardware, blocked contexts, GPU blocklists, some privacy configs). The hero must not be a blank square.

```js
function hasWebGL() {
  try { return !!document.createElement('canvas').getContext('webgl'); }
  catch (e) { return false; }
}
```

If false — or if Three.js fails to load from CDN — render the **SVG lock** (§7) at hero size instead, lit with the CSS `--p` model from `lock-light-prototype.html`. That prototype is not throwaway; it *is* the fallback path. Unlock degrades to a CSS transition on the SVG shackle.

Load Three.js with `defer` and build the hero so the SVG shows first and is replaced on successful init — never the other way round, or slow connections get a hole in the page.

---

## 7. Section lock badges stay SVG

The per-section `[ locked ]` / `[ unlocked ]` badges are **not** WebGL. One canvas in the hero is the budget; four is not. Use a small inline SVG padlock — same silhouette, flat, no attempt at chrome — that opens with a simple CSS/GSAP shackle rotation. It should read as the hero lock's schematic sibling, not a shrunken copy.

---

## 8. Costs and risks — read before committing

Honest accounting. These are real and the brief's constraints don't currently accommodate them.

- **Bundle size.** `three.min.js` r128 is roughly 600KB raw / ~150KB gzipped. The brief's §8 budget is **400KB total first load**. Three.js alone plus GSAP plus fonts will exceed it. Either raise the budget deliberately, or lazy-load Three only when the hero is near the viewport and ship the SVG first. **Decide this explicitly — do not silently blow the budget.**
- **Three r128 is from 2021.** If anyone bumps the version, `renderer.outputEncoding` and `THREE.sRGBEncoding` are **removed** in r152+ (replaced by `outputColorSpace` / `SRGBColorSpace`) and the scene will render washed out. Pin r128 with SRI, or port those two lines and test.
- **Mobile performance.** A WebGL context with `PCFSoftShadowMap` at 1024² and `pixelRatio` up to 2 is real GPU work on a phone. Drop shadow map to 512 and cap `pixelRatio` at 1.5 below 768px. Measure on an actual device, not a simulator.
- **Battery.** The `requestAnimationFrame` loop runs forever for a 0.02-unit float. Pause it when the hero is off-screen (`IntersectionObserver`) and on `visibilitychange`.
- **Accessibility.** A `<canvas>` is invisible to screen readers. Give it `role="img"` and an `aria-label` that tracks state, and put the real unlock announcement in an `aria-live` region on the section — not on the canvas.
- **`prefers-reduced-motion`.** The prototype's `tl.progress(1)` is right for a demo but wrong for the site: it would show every lock already open. Correct behaviour is *snap to the current state without tweening* — `progress(0)` when locked, `progress(1)` when unlocked — plus kill the ScrollTriggers and park the key light at neutral (`p = 0.5`).
- **Theme.** The prototype is tuned for `#0b0c0f`. On the paper-terminal light theme, `HemisphereLight`'s ground colour, the `ShadowMaterial` opacity, and the rim light's blue will all need separate values, or the lock will look like a black hole punched in the page. Drive them from the theme tokens on toggle.

---

## 9. Constraints

- **Both prototypes are reference, not drop-in.** Port them into the module structure (`js/lock.js`), don't paste them into `index.html`.
- **Never use the stock raster.** It is watermarked and licensed.
- **Preserve the pivot-at-the-right-leg trick** and the beat overlap timings exactly.
- **No pin, no sticky.** Stated again because it's the easiest thing to get wrong.
- **Shadow opacity and light colours come from theme tokens.** No hardcoded hex in `lock.js`. (~~Emissive green~~ — beat 5 is cut; the lock has no accent colour.)
- **`scene.environment` must be rebuilt on theme toggle**, not just the lights. It carries most of the material's appearance.
- **The gunmetal body must stay dark in light theme too.** It lightens only enough to separate from the paper ground (~`0x424953`) — it never becomes a mirror. The shackle/body contrast is the design in both themes.
