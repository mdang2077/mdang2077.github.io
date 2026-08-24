# v3 "CTF Edition, animated" — build plan

Derived from `CLAUDE_CODE_BRIEF.md` §9.6. Every phase ends at a working,
committable, deployable site. Branch: `feat/v3-motion`. Never commit to `main`.

## Phase status

| # | Phase | State |
|---|-------|-------|
| 0 | Asset pipeline + repo scaffolding | **done** |
| 1 | Restructure + tokens, zero visual change | **done** |
| 2 | Dark/light theme toggle | **done** |
| 3 | Hero name lockup + scroll shine | todo |
| 4 | Unlock choreography (GSAP Flip, entrance staggers) | todo |
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
