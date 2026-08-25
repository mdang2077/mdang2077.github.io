# v3 "CTF Edition, animated" — build plan

Derived from `CLAUDE_CODE_BRIEF.md` §9.6. Every phase ends at a working,
committable, deployable site. Branch: `feat/v3-motion`. Never commit to `main`.

## Phase status

| # | Phase | State |
|---|-------|-------|
| 0 | Asset pipeline + repo scaffolding | **done** |
| 1 | Restructure + tokens, zero visual change | **done** |
| 2 | Dark/light theme toggle | **done** |
| 3 | Hero lock — WebGL padlock, scroll shine, 3D unlock | **done** |
| 4 | Unlock system — run log + pin rail + hero lock + bypass relock | **done** |
| 5 | Section unlock — redraw scanline (`ANIMATIONS.md` effect A, then B) | **done** |
| 5b | Relock — in-place scramble on bypass off | todo |
| 6 | Approved extras | todo |
| 7 | Polish + full audit | todo |

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
  reveal.js           phase 5 — section stage: scanline swap + scramble
  lock.js             orchestrator — capability check, scroll scalar, lock state machine
  lock3d.js           the Three.js hero lock scene
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

## Phase 3 — the hero lock

One phase, one lock. The hero padlock is a **Three.js WebGL scene** and there is
no second rendering of it. Earlier drafts of this phase specified an SVG
padlock — first with a mask sweep, later with chrome gradients and a `--p`
lighting model — and both are gone from this plan. `LOCK_SPEC.md` remains the
authority on form and behaviour; where the shipped code and the spec disagree,
the code is right and the deviation is listed below.

**Status: done.** Built in `3ce01db`, `a9f2924`, `52b85f2`; §4's two remaining
changes landed after that. §4 is kept as the record of what was removed and why.

---

### 1. The lockup band

A full-width band between the topbar and the two-column shell, so
`MARTIN [lock] DANG` spans both columns. The sidebar's old `<h1>` is gone — the
lockup is the document's only `h1` and the name is not duplicated.

One token drives both sizes: `--hero-size` is the type size, `--lock-h` is
**1.725x** it (the spec's 1.5 plus a 1.15 bump made on sight), and the stage is
`--lock-h` divided by the 0.77 fill constant because the WebGL camera renders a
square frame the lock only partly fills. The stage translates up to sit the
lock's **body** on the type's optical centre — the shackle makes the object
top-heavy and box-centring leaves it floating.

**The band's two ends are deliberately not symmetric**, and the difference is
why the lockup used to sit visibly high in it. A transform does not affect
layout, so the top buys the translate back as padding; but the visible lock also
begins `0.1494 * --lock-h` below its own box's top, because the box is square
and the lock fills 77% of it. Netting those two against each other is exactly
the extra term on `padding-block-end`, and it is what puts the *visible* lock
and pins on the band's centre line rather than their layout boxes. Measured
94/95 at 1440, 45/46 at 320.

**`--hero-air` exists for one reason: the sweep is scrubbed across this band's
exit from the viewport, so a taller band is a longer, slower sweep.** It adds
roughly a quarter more scroll distance for the light to cross the metal — the
range measured 311px before it and 391px after, at 1440.

Two pieces of dead space sit between the lock's foot and the pins that no gap
token can see: the square box the lock fills only 77% of, and the upward
translate on top of it. Together they measured 50px against a 16px gap. A
negative `margin-bottom` on the stage cancels both, so `.hero-band`'s `gap` is
the distance you actually see. It lives on the stage rather than the pin rail so
that it vanishes with the stage — a `display: none` element applies no margins,
so the collapsed lockup needs no special case and no `:has()`.

---

### 2. The lock

`js/lock3d.js` owns the scene; `js/lock.js` orchestrates and owns the state
machine. Geometry derives from four constants (`BW`, `BH = BW*0.74`, `TUBE`,
`ARC`), so retuning means editing constants rather than scaling the group.

**The environment map is the material.** `MeshStandardMaterial` at
`metalness: 1` has nothing to reflect without one and renders flat and dark *no
matter how far light intensity is raised* — and raising it is the obvious wrong
instinct. The procedural studio env supplies the reflection, and **the vertical
bars are the mechanism**: a flat metal face mirrors them as the hard banding
that reads as polished chrome. Smooth them into a gradient and the lock is grey
plastic.

**Two environments, and this was a real discovery — keep it.** `makeStudioEnv`
takes a `fine` flag and builds two: a 26px repeating ramp for the body's flat
face, wide softboxes for the shackle's tube. The reason is angular coverage. A
flat face at this camera distance reflects only ~35° of the environment, about
50px of a 512px map, so wide bars leave it a mirror with nothing to mirror. The
tube is the opposite — its curvature sweeps the whole map in a few screen
pixels, so fine bars alias into ringing. One environment cannot serve both, so
each material carries its own.

**The scroll shine moves lights and one texture offset, nothing else:**

```js
key.position.x    = -6 + p * 12;
rim.position.x    =  6 - p * 12;
shineTex.offset.x = (0.5 - p) * 1.7;   // 1.7 carries the band fully off both edges
```

**The ScrollTrigger range is the lock's own life on screen**, and it took two
passes to get there. `LOCK_SPEC.md` §4 says `top bottom -> bottom top`, which
suits an element part way down the page; the hero is the *first* thing on the
page, so that range is ~70% consumed before the visitor scrolls a pixel and only
the tail of the sweep is ever visible. Measuring from the band's own top fixed
that but left a subtler version of the same problem — the sweep did not begin
until the band cleared the topbar, and it finished long after the lock itself had
gone, so the light barely moved while there was any metal to move across.

```js
start: 0,                      // the literal top of the page
end: 'bottom-=11.5% top',      // the lock's foot leaving the viewport
```

`0` is a scroll position, not a keyword: the light is hard left before the
visitor has touched anything. The `-=11.5%` is the slack under the lock inside
its own box — the box is square and the lock fills 77% of it, so `(1 - 0.77) / 2`
of its height sits below the lock's foot, and trimming it lands the end of the
sweep on metal rather than on empty canvas. Measured: `end` comes out at exactly
the lock's visible bottom, 342px at 1440 and 190px at 375, with progress linear
across the range and reversing on the way up. **No pin, no sticky** — the page
scrolls at normal speed throughout.

This is also what `--hero-air` buys: a taller band pushes the lock further down
the page, so the lock's foot leaves the viewport later and the sweep has further
to run.

**Idle** is a raised cosine starting and ending exactly on the scrub's resting
value, so the handover has nothing to jump from. First scroll input kills it
permanently: an ambient loop under a reader's cursor is noise.

**Battery.** The rAF loop is gated on an `IntersectionObserver` over the stage
and on `document.hidden`. The only idle motion is a 0.02-unit vertical float;
the lock never spins.

---

### 3. Approved deviations from `LOCK_SPEC.md`

Deliberate, approved, and **all of them belong in the commit message** so nobody
reads the spec later and "fixes" them back.

| # | Deviation | Why |
|---|---|---|
| 1 | **Both parts are chrome** — no dark-gunmetal body, despite §1 marking that locked | Reads better. Approved on sight. |
| 2 | **The tumbler and its key-turn beat are cut** | The keyhole is a hole in the body now, so there is nothing to rotate. Retires the spec's parenting bug entirely. |
| 3 | **The cast shadow is cut** | The `ShadowMaterial` floor earned nothing against a dark ground. |
| 4 | **The green emissive flash (beat 5) is cut** | The lock is neutral metal and signals state by *opening*. Also deletes the `Color.setStyle()` failure on our space-separated `hsl(h s l)` tokens — no emissive, nothing to parse. |
| 5 | **The lock opens once, when all three puzzles are complete** — not per challenge as §3 says | Firing a mechanism three times spends the payoff before it means anything. The pin rail carries per-solve feedback. |
| 6 | **No SVG fallback rendering** (§4) | User decision. `LOCK_SPEC.md` §6 requires one; we are not shipping it. |

**The unlock is three beats, not five**, with the spec's spacing preserved and
shifted 0.36s earlier so the mechanism starts on the first frame rather than
after the gap the key turn used to fill:

| # | Beat | Target | Value | Start | Duration | Ease |
|---|---|---|---|---|---|---|
| 1 | body recoils | `body.position.y` | `-0.04`, yoyo x1 | 0.00 | 0.07 | `power1.inOut` |
| 2 | shackle pops | `pivot.position.y` | `0.4` | 0.06 | 0.30 | `back.out(2.4)` |
| 3 | shackle swings | `pivot.rotation.y` | `-1.2` rad | 0.30 | 0.60 | `power3.out` |

Beat 3 is the payoff and the whole reason the lock is 3D: a `pivot` group at the
right leg with the shackle offset back inside it, so `rotation.y` swings it out
*sideways in depth*. `-1.2` rad (~69°) rather than the prototype's `-1.9`, which
put the shackle edge-on and read as a thin rod.

Relock reverses at `timeScale(1/0.7)` — mechanisms close faster and harder than
they open. Only bypass-off reaches it.

---

### 4. Remaining work

#### 4a. Delete the SVG lock — done

The WebGL lock is the only rendering. Everything belonging to the SVG hero lock
comes out of the codebase — not hidden, not gated, **removed**.

**One carve-out, and it is not optional.** All three section badges
`<use href="#lock-shackle-path">`, `#lock-body-path` and `#lock-keyhole-path`,
and those three shapes are declared inside the hero SVG's `<defs>`
(`index.html:95-97`). Deleting the hero SVG outright empties every badge.

Move exactly those three shapes into a standalone hidden sprite near the top of
`<body>`:

```html
<svg class="lock-sprite" width="0" height="0" aria-hidden="true" focusable="false">
  <defs>
    <path id="lock-shackle-path" .../>
    <rect id="lock-body-path"    .../>
    <path id="lock-keyhole-path" .../>
  </defs>
</svg>
```

That is shared badge geometry, not a lock rendering. Everything else goes.

**What to remove:**

| File | Remove |
|---|---|
| `index.html` | the whole `<svg class="lock-svg--hero">`: `<title>`, `#lock-ramp`, `#lock-spec`, `#lock-silhouette`, `#lock-body-clip`, the shackle group and its highlight paths, the body group, bevel, edge rects, the specular layer |
| `css/components.css` | `.lock-svg--hero`, the SVG material block (`.stop-*`, `.body-metal`, `.body-bevel`, `.body-edge-l/-r`, `.shackle-metal`, `.shackle-spec*`), and the `[data-lock-render="svg"]` rules |
| `js/lock.js` | the `spec` / `title` / `svg` lookups, the SVG branch of `applyLight()`, the `--shackle-rotate` and `--shackle-lift` painting, and the whole SVG-path fallback |
| `css/motion.css` | the CSS-only `--p` idle sweep (it existed to light the SVG without GSAP) |
| `css/noscript.css` | the `.lock-stage` lock rules |
| `css/tokens.css` | `@property --p` — nothing reads it once the SVG is gone; WebGL takes the scalar directly in JS |

**Audit rather than assume:** the metal tokens (`--metal-hi/-mid/-lo`) may be
referenced by the badge dress. Keep whatever the badges actually use and delete
the rest — check before cutting.

**Accepted consequence: with no WebGL, and with JS off, there is no lock.** No
old hardware fallback, no GPU-blocklist fallback, no no-JS lock. The stage
collapses and the lockup closes up to `MARTIN DANG` — with the grid in 4b an
empty middle column collapses on its own, so this reads as intentional rather
than as a hole. Contacts, identity and all content remain reachable in every one
of those cases, which is the constraint that actually matters.

Accessibility follows the canvas: `lock.js` already puts `role="img"` and a
state-tracking `aria-label` on it. With no canvas there is no lock and nothing
to announce, which is correct.

#### 4b. Put the lock on the page axis — done

Measured before the change at 1440px: page axis 720, lock centre **759.8** — off
by 39.8px. `MARTIN` is 238.8px against `DANG`'s 159.2px, and half that 79.6px
difference is exactly the 39.8px offset, so the diagnosis below was right on the
nose. After: lock centre 720, pin rail centre 720.

`.lockup` is a centred flex row of `MARTIN` + lock + `DANG`. The *row* is
centred, so the row's midpoint lands on the page axis — but `MARTIN` is two
glyphs wider than `DANG`, so the lock sits right of centre by half that
difference. At the 92px ceiling that is visible, not a hairline. The pin rail is
a separate child centred by the column, so it *is* on the axis — which is
exactly why the pins do not sit under the lock.

Give the words equal slots so the middle cell is the centre:

```css
.lockup {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: clamp(var(--space-3), 2.5vw, var(--space-6));
}
.lockup-word             { min-width: 0; white-space: nowrap; }
.lockup-word:first-child { text-align: right; }   /* MARTIN, toward the lock */
.lockup-word--accent     { text-align: left;  }   /* DANG,   toward the lock */
```

`1fr auto 1fr` states the intent directly: the middle column *is* the centre,
whatever the words weigh. The `1fr` slots absorb the difference and the
`text-align` keeps both words tucked against the lock rather than flung to the
margins.

**One trap, found by measuring rather than by looking.** The column has to be
stated explicitly on all three children (`grid-column: 1 / 2 / 3`). A
`display: none` grid item is removed from flow rather than leaving its track
empty, so with implicit placement `DANG` slides up into the middle cell the
moment the lock is absent — and the lockup goes *further* off-axis than before
the fix, in exactly the no-WebGL case this was supposed to make tidy. With the
placement pinned, the middle track collapses to zero on its own and the two
words close up symmetrically about the page centre, one gap either side of an
empty column.

**Mobile needed nothing.** Measured at 320 / 375 / 768: no word-to-lock
collision at any of them, no overflow, and the lock centred at every width
(160/160, 187/187.5, 384/384). The stacking fallback below was not built —
there is no width at which it fires.

**This centres the lock, not merely its box** — worth confirming rather than
assuming, since the stage is a square canvas the lock fills only ~77% of. The
scene is built symmetrically about `x = 0` with the camera on that axis, so
centring the stage centres the lock. Vertical centring is already handled by the
rig's `translateY`.

**The pins then align for free** — but say so in a comment. The alignment is
structural rather than coincidental, and if the lockup is ever made asymmetric
again the pins drift silently, which is a hard bug to see.

**Mobile:** at 320-375px the `1fr` slots can squeeze the words against the lock.
If they collide, collapse to one column and stack — the lock stays centred and
the pins still line up, so the degradation is clean.

---

### 5. Also shipped in this phase

**Phase-4 hooks, all inert.** `@property` registration for the accent channels
(they snap without it), `--dur-flight/-seat/-type`, `--z-flight` below the
topbar for the flight clone, the three-state pin CSS, the reserved four-line
console, and `ctf:state` — which `ctf.js` dispatches with
`{ solved[], count, total, bypass, reason, index }`. `hud.js` consumes it and
applies pin and log state *without animation*, so phase 4 adds choreography to
plumbing already proven end to end.

**Three fixes found while verifying.**

0. **`PMREMGenerator` leaked two GPU textures per theme toggle.**
   `fromEquirectangular()` returns a *render target*; disposing only its
   `.texture` leaves the target allocated. Ten toggles took
   `renderer.info.memory.textures` from 3 to 23. Holding the targets and
   disposing those holds it at 3.

1. `white-space: pre` was on the run-log container, where it also preserved the
   indentation between child elements and added phantom line boxes — the block
   measured 101px against its 84px reservation. Moved to the line.
2. `.main` had no width under 768px. `.layout` is `align-items: flex-start`, so
   in column direction children size to max-content on the cross axis; the main
   column took its widest child's intrinsic width (376px) and overflowed at
   320px, quietly clipped by `body { overflow-x: hidden }`. Pre-existing since
   phase 1.

**Contrast.** The run console does not use `--text-dim`: it measures 3.43:1 on
the inset fill in dark and 2.83:1 in light, and both the idle prompt and the
count column are real text. They use `--text-muted` (5.20:1 / 4.66:1).
`--text-dim` is still used by `.lock-icon.is-bypassed`, which has the same
problem and predates this phase — **flagged for phase 7**.

**On `animation-timeline: view()`.** Evaluated as the brief asked, not used.
GSAP is loaded for phase 4 regardless, so the native path buys nothing.

**Payload — measured.** First-load **transfer** is **314KB**: Three 149.9KB gz,
GSAP core 28.3KB gz, ScrollTrigger 17.9KB gz, the portrait 76.6KB, and 40.9KB gz
for all of the HTML, CSS and JS together. Web fonts are not in that figure.
Uncompressed the same set is 924KB, and Three is 603KB of it.

**The 600KB line holds against transfer and is blown by raw bytes**, so it is
recorded here as 600KB *transferred* — the number the constraint was always
about — leaving ~286KB of headroom. Deleting the SVG lock returned 0.8KB gz,
which is honestly nothing; it was worth doing for the second implementation it
removed, not for the bytes.

---

### 6. Verification

**That the SVG is gone (4a):**

- Grep the codebase for `lock-svg--hero`, `data-lock-render`, `--shackle-rotate`,
  `lock-ramp`, `lock-spec`, `lock-silhouette`. Only the sprite's three geometry
  ids should survive.
- **All three section badges still render** — the `<use>`/`<defs>` check, and the
  one thing most likely to break silently.
- Disable WebGL, and separately block the Three CDN: no console errors, no empty
  hole — the lockup closes to `MARTIN DANG`. Contacts, identity and content all
  still reachable.
- JS off entirely: same, plus content revealed and puzzle machinery hidden.

**Centring (4b):**

- A 1px ruler down the viewport centre bisects the lock's **body** and the middle
  pin. Before the change it bisects neither.
- 375 / 768 / 1440, plus 320 for word collision.
- After a solve the shackle swings in depth and the silhouette shifts — the body
  is the reference, not the silhouette.

**Unchanged behaviour, re-checked after both edits:**

- Metal reads as chrome in both themes; ten theme toggles leak no textures
  (`renderer.info.memory.textures`).
- Unlock plays once on the third solve, three beats as one motion, open shackle
  legible; relock faster and harder.
- Full scroll sweep across the hero's exit, reversing on the way up; the page
  never stops scrolling.
- Reduced motion: lights neutral at `p = 0.5`, no idle, no float, lock holds its
  *current* state rather than forcing open.
- No layout shift when the canvas arrives — the box is reserved.
- Screen reader: the lock is announced once, with correct state.

---

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

**Beats 1 and 3 are superseded by phase 5** — the block swap becomes the redraw
scanline of `ANIMATIONS.md` §1. Do not build them here, and do not load GSAP
Flip: phase 5 replaces both with a `clip-path` proxy tween that needs no plugin.
Phase 4 keeps the section reveal on today's display toggle and ships the other
five beats. See phase 5 §1.

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

Built and specified in **phase 3 §3** — three beats, fired once when
`data-solved` flips `false -> true` (the third solve, or bypass-on), reversed at
0.7x on bypass-off. `main.js` already wires it to `ctf:state`, and `reason:
'init'` never animates.

Phase 4's only job here is sequencing: the third pin's seat chains straight into
beat 1, with no gap.

---

### 5. Foundations — all shipped

Every hook phase 4 needs is already in place and proven: the `ctf:state` event
with `{ solved[], count, total, bypass, reason, index }`, `hud.js` applying pin
and log state without animation, the three-state pin CSS, the reserved four-line
console, `--dur-flight/-seat/-type`, `--z-flight` below the topbar, and
`@property` on the accent channels so the hue rotates instead of snapping.

Phase 4 adds choreography to plumbing that already works end to end.

---

### 6. Phase 4 build order

1. ~~Wire `hud.js` for real: pin state transitions and the console printer,
   still with no flights and no hero timeline. Solving now seats pins and
   prints lines.~~ **done**
2. ~~Add the flight clone and its guards.~~ **done**
3. ~~Build the hero unlock timeline in `animations.js`, triggered off
   `data-solved`. Verify play and reverse in isolation before wiring bypass.~~
   **done** — the timeline itself already shipped in phase 3, inside
   `lock3d.js` where the meshes are; `animations.js` owns *when* it plays.
4. ~~Wire the bypass staggered run and the relock reverse.~~ **done** — the
   `[!]` line prints, pins run left to right from 120ms in 90ms steps, and the
   hero lock opens at 300ms. Off reverses: lock first, pins right to left, the
   transient line fading before it leaves the DOM.
5. ~~Reduced-motion pass over all four, then the spam-toggle pass.~~ **done** —
   see §8 below. The bypass hold is skipped entirely under reduced motion: a
   delay with no motion in it is a stall, not choreography.

Each step ends deployable: an unfinished later step just means less motion, not
a broken page.

---


### 6b. Steps 1-2 notes

**The printer fast-forwards rather than queues.** Two solves in quick succession
must not make the second wait on the first's animation, so a new line finishes
the one in flight instantly and starts typing itself. Typing reveals characters
across the line's three coloured segments (`[+] `, the body, the count) by
slicing them in order, so the columns stay coloured while they appear.

**The cursor is moved, not recreated** — recreating it restarts the blink on
every keystroke. It sits on the line being typed, then on the last line printed.

**The flight is skipped, not faked, when nobody would see it:** no GSAP, reduced
motion, `document.hidden`, or a source with no box (its section still
collapsed). All four seat the pin immediately with the identical end state.

**A fifth guard was removed later** — the target pin being above the viewport.
The reasoning was that a flight to somewhere nobody can see is a flight nobody
watches. That is true of the landing and wrong about the launch, and the launch
is the half that happens where the visitor is looking. It was also the normal
case rather than an edge one: answering a challenge means scrolling down to the
input, which puts the hero off the top of the screen every time, so the guard
was cancelling the flight on almost every solve. It now flies regardless — up,
under the sticky topbar, and gone, which is what the pin lighting up means.

**A killed flight cannot strand its pin.** `clearFlights()` runs on every state
change, so a flight interrupted by the next solve never fires its `onComplete`.
The pin still seats, because every state change ends in `renderPins()` with the
real detail — the flight only ever *defers* the seat, it never owns it.

**Verified:** three solves in transcript order print `1/3 2/3 3/3` by print order
rather than section order; the console holds 84px in every state including
mid-type; one visible cursor at all times; the clone is `position: fixed` at
`z-index: 90` against the topbar's 100, so it passes underneath; no horizontal
overflow while a clone is in flight; ten bypass clicks leave `aria-pressed=false`
with no debris and no stacked transforms; earned pins survive bypass-off while
shims clear; and under reduced motion every path above collapses to the same
instant state with no flights and no typing.

Bypass still applies its state instantly — correct, just not yet choreographed.
That is step 4.

### 6c. Step 3 notes

**`animations.js` owns *when* the lock opens, not how.** The three beats stay in
`lock3d.js`, because they are transforms on meshes only that module can see.
What this step added is the sequencing rule from §4: on the run that completes
the set, the third pin's seat chains straight into beat 1.

Firing both off the same `ctf:state` event — which is what `main.js` did
before — opened the lock while the glyph was still in the air and before the pin
it was flying to had lit. The payoff landed ahead of the build-up. So `hud.js`
now dispatches **`hud:seated`** at the moment a solving pin seats, and
`animations.js` holds beat 1 until it arrives.

**The init order in `main.js` is now load-bearing, and it is commented as
such.** `initAnimations` must subscribe *before* `initHud`, because a solve
whose flight is skipped seats its pin **synchronously** inside the `ctf:state`
dispatch — subscribe the other way round and the seat announcement arrives
before `animations.js` knows it is waiting for one. Verified directly: with the
hero scrolled out of view, the third solve opens the lock on the same frame.

**The wait is a courtesy, never a dependency.** A 900ms fallback timer opens the
lock if the seat never arrives — no pin rail in the DOM, a hidden tab, a flight
killed mid-air. Any other state change calls `clearPending()`, so the timer can
never fire into a state it no longer applies to.

**Verified:** the lock holds `progress 0` through both earlier solves *and*
through the whole 520ms flight of the third, then plays 0 -> 0.56 -> 1.00 from
the instant the pin seats. Bypass-on plays it, bypass-off reverses it (and
visibly faster — `timeScale(1/0.7)`). Ten bypass clicks leave the timeline at
exactly 0.00 with `aria-pressed=false`. Under reduced motion it jumps 0 <-> 1
with no tweening. Bypass toggled while all three are genuinely solved changes
nothing, which is correct.

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
| ~~GSAP Flip pushes the bundle over budget~~ | Resolved by phase 5: the block swap moves to a `clip-path` proxy tween. Flip is not loaded at all |

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

## Phase 5 — section unlock: the redraw scanline (Effect A)

Spec: `ANIMATIONS.md` §1, §3, §4. That file is authoritative for the mechanism;
this section is only about how it lands in *this* codebase and in what order.

**Why it is its own phase and not a step of phase 4.** Phase 4 promised no new
markup and no layout change — it adds behavior to plumbing phase 3 drew. The
scanline breaks both promises: the challenge card and the revealed block have to
become two absolutely-positioned panes inside a height-tweened stage, which is a
structural change to all three sections. It also touches CSS that phase 4 never
opens (`.reveal` / `.challenge.is-hidden`). Separate phase, separate commit,
separate screenshot diff.

---

### 1. What this replaces

Today the swap is a display toggle: `ctf.js` puts `.is-hidden` on
`[data-challenge]` and `.is-visible` on `[data-reveal]`, and the block changes on
one frame. That is the whole of the section-level reveal — there is currently no
animation on it at all.

**Phase 4 §2 beats 1 and 3 are superseded by this phase.** Do not build them:

| Superseded | Was | Becomes |
|---|---|---|
| beat 1 — challenge collapses | GSAP Flip out, block flips into the space | the scanline's `locked` pane clipping closed downward |
| beat 3 — content staggers in | `[data-reveal]` children `y:8 -> 0`, 60ms stagger | the scanline's `content` pane clipping open downward, text resolving in the beam's wake |

Beats 2, 4, 5, 6 and 7 (lock tag flip, glyph flight, pin seat, log line, dot) are
unaffected and already shipped — they animate the hero and the status strip, not
the block.

**This drops GSAP Flip from the plan entirely.** Flip was the only plugin beyond
core + ScrollTrigger, and it was flagged as the bundle risk in §7. The scanline
needs no plugin — a proxy tween and `clip-path`. Do not load Flip in phase 4 just
to delete it here.

---

### 2. The stage

New markup, per section — the one structural change in this phase:

```html
<div class="stage" data-stage>
  <div class="pane pane-locked"  data-pane="locked">…existing form.challenge…</div>
  <div class="pane pane-content" data-pane="content">…existing div.reveal…</div>
</div>
```

`.stage { position:relative; overflow:hidden; }`, both panes
`position:absolute; inset:0 0 auto 0; width:100%`. The stage carries the height;
the panes never do.

**The no-JS and reduced-motion renders must survive this wrapper.** `noscript.css`
and the `:root:not([data-js="on"])` rules currently reach `.reveal` and
`.challenge` directly; with the panes absolutely positioned by default, a page
with no JS would collapse the stage to zero height. So absolute positioning is
applied by JS at init (`data-js="on"` + a `data-stage-ready` flag), never in the
static stylesheet. Static render = both panes in normal flow, bypassed and
readable, exactly as today.

---

### 3. Where it hooks in

New module `js/reveal.js`, owning the stage lifecycle: measure, state, timeline,
resize. `animations.js` stays the hero/status-strip choreographer; it should not
grow a second concern this size.

It listens on the same `ctf:state` event everything else does, and branches on
`reason`:

| `reason` | Behaviour |
|---|---|
| `solve` | play the composed timeline once for `detail.index` |
| `bypass` on | every still-locked section jumps to `unlocked`, no tween |
| `bypass` off | sections not in `solved[]` jump back to `locked`, no tween |
| `init` | apply state silently — never animates, same rule as everywhere else |

**Ordering against the flight.** The glyph flight in `hud.js` clones
`[data-lock]` and reads its `getBoundingClientRect()`. The scanline is tweening
the stage's height at that moment, which moves everything below it — including,
on sections 1 and 2, the hero pin the clone is flying *to*. §7's existing
mitigation covers it: recompute the target rect on completion and snap. Verify it
rather than assume it — this is the one place the two systems can collide.

---

### 4. Build order

1. ~~Wrap the three sections in stages, JS-applied positioning, no animation
   yet.~~ **done** — element-geometry diff against the previous commit is empty
   in both the locked and the bypassed render.
2. ~~`measure()` per `ANIMATIONS.md` §4~~ **done, simplified** — see §4b. The
   panes are in flow when measured, because they are in flow whenever they are
   not sweeping, so no temporary repositioning is needed.
3. ~~The scanline itself: proxy `v`, two `clip-path`s, the beam, the stage
   height. Solve-only.~~ **done** — ~1.18s end to end.
4. ~~The three-state model and the resize guard (`BUSY`)~~ **done, and the
   resize guard is gone with the bug it guarded.** See §4b.
5. ~~Reduced motion + a11y pass~~ **done** — `aria-busy` on the content pane for
   the length of the sweep, no third live region.
6. ~~Effect B — the scramble decrypt, driven from step 3's `onUpdate`~~ **built,
   then cut on request.** See §4c. There is no `textContent` writer left in
   `reveal.js`, so `ANIMATIONS.md` §2 and §3 are now unimplemented by decision
   rather than pending.

**On step 6.** The ask was Effect A. B is one step and stays last — but the hook
for it goes in with step 3, because §3's hard rule is that A and B share one
proxy. Running the scanline to completion and *then* starting a scramble is the
one implementation the spec explicitly rules out, and retrofitting the shared
proxy later means rewriting step 3. Leave the `targets` array and the
`t.top < beamY` check in place even while `scramble()` is a no-op.

---

### 4c. Requested changes to the shipped effect

Three, after seeing it on screen. All are decisions, not gaps:

- **Effect B is cut.** The scramble was built, composed through the scanline's
  proxy exactly as `ANIMATIONS.md` §3 requires, and then removed: the beam alone
  is the effect and the churn read as noise on top of it. §3's shared-proxy
  argument existed only to stop A and B reading as a queue, and with one effect
  there is no queue. Do not re-add it as "the spec says so" — the spec was
  followed, and the result was rejected on sight.
- **Every beat of the sweep is 1.5x the spec's**, ~1.77s rather than ~1.18s. At
  1.0s the beam crossed a short section faster than the eye tracks it. The four
  constants scale together or the beam fades out somewhere other than the end of
  its own travel.
- **Bypass sweeps.** `ANIMATIONS.md` §5 has it jumping straight to `unlocked`
  with no beam; it now runs the same sweep the solves do, staggered 80ms apart
  to match `PLAN.md` §3's bypass run. A section already `unlocked` is never
  swept, so bypass cannot replay a reveal somebody earned. **Bypass off is
  unchanged and stays instant** — going back is not a payoff and should not be
  paced like one.

---

### 4b. Deviation from `ANIMATIONS.md` §4 — panes are absolute only while sweeping

The spec keeps both panes absolutely positioned for the stage's whole life, with
the stage carrying a measured pixel height and a debounced resize handler
re-measuring behind a `BUSY` set.

Shipped instead: the panes go absolute *only during the sweep*, and a settled
stage has no inline height at all. A pinned height is wrong the moment anything
inside a pane changes size — and something does. Submitting a **wrong** answer
prints `// incorrect. try again.` into `.challenge-msg`, which grows the locked
pane inside an `overflow: hidden` stage measured before that message existed.
Late webfonts and a rotated phone are the same bug arriving by other routes.

Not pinning removes all three and takes the resize handler with it: there is no
stored height left to go stale. The busy set survives, doing the other half of
its job — stopping a second sweep starting on a section already sweeping.

`.pane` also carries no `display` of its own. `flow-root` was the obvious way to
keep a trailing margin from escaping it, and it made section 1 22px taller: that
margin escaped through `.reveal` and out of `.section` before this wrapper
existed, and has to go on escaping. An absolutely positioned box contains its
margins anyway, which is the only part of a pane's life measured to a pixel.

**§3's "one place the two systems can collide" does not arise in this layout.**
The concern was the stage's height tween moving the hero pin a glyph is flying
to. The pin rail is in the hero, *above* every section, so a section growing
cannot move it. Measured across a full sweep: the pin holds at `613,374` from
launch to seat while the stage grows 269 -> 288. No rect recomputation was
needed and none was added.

---

### 5. Landmines, carried from `ANIMATIONS.md` §4

- **Measure before, not during.** Both panes measured with the pane temporarily
  `position:relative` and the other `display:none`. Measuring while absolute
  returns the wrong height.
- **Resize must not clobber an in-flight transition.** Debounce ~180ms *and*
  guard with a `BUSY` set keyed by section; add on timeline start, remove on
  `onComplete` plus a safety timeout. Without both, rotating a phone mid-unlock
  snaps the section back to locked.
- **Three states, and two of them must be enterable with no animation.**
  `locked`, `unlocking`, `unlocked`. Bypass and a returning visitor land on
  `unlocked` instantly. Only a live solve animates. Same rule as `reason:'init'`.
- **One node, one writer.** The scanline owns `clip-path`, stage `height`, and
  the beam's `top`. The scramble owns `textContent` on leaf nodes only. Nothing
  writes both.
- **The beam colour is a token**, never a hex — it has to differ across themes.
  Reuse the "solved" accent the badges and `.challenge-msg.is-ok` already use.
- **Reduced motion is one guard checked once:** final text set directly, stage at
  `hC`, locked pane hidden, content shown, no beam. Fully readable end state.

---

### 6. Verification for phase 5

On top of the standing per-phase checks:

- Solve each section — the beam sweeps once, the block is content above it and
  challenge below it at every frame, and the height lands exactly on the
  content's natural height with no jump on completion.
- Solve section 1 while the page is scrolled so section 2 is visible — nothing
  below shifts after the tween settles.
- Resize / rotate mid-sweep — the section finishes correctly, does not snap back.
- Bypass on from cold, bypass off — instant both ways, no beam, no partial clip
  left on any pane (`clip-path` must be cleared, not left at `inset(0 0 0% 0)`).
- Solve one, bypass on, bypass off — the solved section stays open and unclipped.
- Reduced motion — every path above, instant, same end states, no beam in the DOM.
- JS disabled — both panes in normal flow, everything readable, no stage collapse.
- Keyboard-only — focus is never trapped inside a clipped pane; the content pane
  must not be reachable while it is still clipped closed.
- Screenshot diff of the settled `unlocked` state against phase 4's — identical.

---

## Phase 5b — relock: the in-place scramble

Approved from a live prototype after four alternatives were rejected. This is
the **relock** direction only. The unlock sweep from phase 5 is untouched.

### 1. This does not contradict §4c

§4c cut the scramble, and it stays cut **where it was cut**: layered on top of
the unlock beam, where the churn was noise competing with the sweep. That
judgement was about two effects fighting for the same moment.

The relock has no beam. The scramble is not on top of anything here — it *is*
the effect, and it is the only thing on screen. Different context, opposite
conclusion, both correct. Do not collapse the two.

### 2. What it replaces

Bypass off currently jumps bypass-only sections shut instantly (§4c, third
bullet). That stays right in spirit — going back is not a payoff — but instant
is not the same as *free*, and a section vanishing between frames reads as a
bug rather than a decision. ~900ms, and the reverse direction does the work of
saying "this is being undone."

Sections the visitor actually **solved never relock.** Only sections open purely
because of bypass close, exactly as today.

### 3. The rejected approach, so it is not rebuilt

The first prototype rendered a monospace glyph *silhouette* over the block: one
`<pre>`-style overlay whose line count and line lengths lerped from the content's
shape to the challenge card's, hiding the height change inside the illegible
middle.

It was rejected on sight, and the reason is structural, not tunable. A monospace
text blob is not the shape of a wrapped pill grid and it is not the shape of the
challenge card either, so it mismatched at **both** ends — glyphs appearing in a
silhouette the pills never had, then resolving into a silhouette the card never
had. **Never render a stand-in shape.** Every frame shows real DOM geometry.

### 4. The effect

Each leaf element scrambles **inside its own box**. Nothing is overlaid, nothing
is cloned, no intermediate element exists.

| t | Beat |
|---|---|
| 0.00–0.42 | every `.tg` and `.blk-t` in the content pane encrypts, right → left |
| 0.43–0.57 | blur-dip covers the pane exchange; stage height retimes here |
| 0.58–1.00 | every text leaf in the locked pane decrypts in, right → left |

**Three things carry it. All three are load-bearing:**

- **Length-preserving glyph strings.** The scrambled string is exactly as long as
  the original, so a pill's width never changes and the flex rows never rewrap.
  Losing this is the whole failure mode of the old approach arriving by a
  smaller door.
- **Right → left.** Phase 5's beam sweeps down and its decrypt runs left → right.
  Running the relock the other way is what makes it read as *undoing* rather than
  as a second, unrelated event. Both axes reverse or neither does.
- **The dip is short and covers the swap frame.** ~140ms of `blur(7px)` plus a
  45% dim, peaking exactly where the two panes exchange. Longer and it reads as
  a page load; absent and the pill grid visibly becomes a card.

```js
// length-preserving, eats inward from the right
function scrambleOut(el, u){                 // u 0 = plain, 1 = fully glyphed
  const t = el.dataset.txt, from = t.length - Math.floor(u * t.length);
  el.textContent = [...t].map((c,i) => (i >= from && c !== ' ') ? glyph() : c).join('');
}
function scrambleIn(el, u){                  // u 0 = fully glyphed, 1 = plain
  const t = el.dataset.txt, from = t.length - Math.floor(u * t.length);
  el.textContent = [...t].map((c,i) => (i >= from || c === ' ') ? c : glyph()).join('');
}
```

Cache `dataset.txt` on every leaf once, at setup. Reading `textContent` back
after a scramble has started returns glyphs and permanently corrupts the target.

### 5. Fits the shipped layout, not `ANIMATIONS.md`'s

Panes go absolute only for the duration of the relock and the stage carries no
inline height once settled — §4b's model, unchanged. The height retimes inside
the dip, so it needs no separate treatment and no `BUSY`-guarded resize handler.
The busy set still applies: a section already relocking does not start again.

### 6. Landmines

- **`textContent`, never `innerHTML`.** Rewriting per frame through `innerHTML`
  re-parses markup 60x/sec and would destroy every pill in the pane.
- **Scramble leaves only.** `.tg` and `.blk-t`, never `.tags` or `.blk` — writing
  `textContent` on a container deletes its children.
- **No dead frame at the midpoint.** Both prototype variants that staggered
  element exits had a gap where the old content had left and the new had not
  arrived. Here the dip covers it; if the dip is ever retimed, check the seam.
- **`aria-busy="true"`** on the stage for the duration; mid-flight glyphs are
  garbage to a screen reader. Announce `"skills section locked"` on the section's
  live region when it settles.
- **Reduced motion** skips all of it: restore every leaf's `dataset.txt`, swap
  the panes, done. Same end state, no dip, no scramble.

### 7. Verification

- Bypass on, bypass off — every bypass-only section relocks, no pill ever changes
  width mid-scramble, no row rewraps.
- Solve section 1, bypass on, bypass off — section 1 stays open and unscrambled.
- Scrub the timeline by hand at 0.42 / 0.50 / 0.58 — real geometry at all three,
  never a stand-in shape.
- Relock twice in a row without reloading — `dataset.txt` still intact, no
  glyphs baked into the DOM.
- Rotate a phone mid-relock — finishes correctly, no snap-back.
- Reduced motion, and JS disabled — both readable, both correct.
- Screenshot diff of the settled `locked` state against phase 4's — identical.


---

## Decisions carried from the brief (do not re-litigate)

- **The 400KB budget is superseded.** Raised to 600KB to admit Three.js, with
  the real figure to be measured and recorded in phase 3 §5. The brief's §8
  number is historical.

- Split files, no build step; ES modules; CDN with SRI + `defer`.
- GSAP-primary + native CSS. No motion.dev, no anime.js — three engines means
  three scroll listeners and ~110KB for effects GSAP already covers.
- Hand-authored inline SVG padlock — **section badges only**. The hero lock is
  WebGL and has no SVG rendering; see phase 3 §4a.
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
