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
  lock.js             phase 3 — hero lock shine controller
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

Unchanged from the earlier spec, and now the payoff of the pin rail rather than
a standalone event.

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

- Split files, no build step; ES modules; CDN with SRI + `defer`.
- GSAP-primary + native CSS. No motion.dev, no anime.js — three engines means
  three scroll listeners and ~110KB for effects GSAP already covers.
- Hand-authored inline SVG padlock; shine via `<linearGradient>` + `<mask>`.
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
