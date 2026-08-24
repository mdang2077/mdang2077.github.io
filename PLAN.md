# v3 "CTF Edition, animated" — build plan

Derived from `CLAUDE_CODE_BRIEF.md` §9.6. Every phase ends at a working,
committable, deployable site. Branch: `feat/v3-motion`. Never commit to `main`.

## Phase status

| # | Phase | State |
|---|-------|-------|
| 0 | Asset pipeline + repo scaffolding | **done** |
| 1 | Restructure + tokens, zero visual change | **done** |
| 2 | Dark/light theme toggle | todo |
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
js/
  main.js             entry point, imports the rest
  ctf.js              challenge logic, unlock state, progress, bypass
  theme.js            phase 2 — dark/light toggle + persistence
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

### Light theme "paper terminal" (phase 2 — measured, not yet wired)

| Token | Value | Pair | Ratio | AA |
|---|---|---|---|---|
| `--bg` | `#f4f1ea` | — | — | — |
| `--text` | `#1a201c` | on `--bg` | 14.69:1 | pass |
| `--text-muted` | `#5a6b60` | on `--bg` | 5.02:1 | pass |
| `--accent` (locked) | `#c22626` | on `--bg` | 5.17:1 | pass |
| `--accent` (solved) | `#0a7d4a` | on `--bg` | 4.60:1 | pass |

Confirms the brief's suspicion: the dark accents cannot cross over. `#ff3333`
on paper is 3.22:1 and `#00ff88` is 1.19:1 — both unusable. Each theme needs
its own red and green.

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
- **Native CSS scroll-driven animation** (`animation-timeline: view()`) as an
  alternative to ScrollTrigger for the hero shine — evaluate in phase 3.
  ScrollTrigger stays the primary; native CSS only where a silent no-op is fine.
