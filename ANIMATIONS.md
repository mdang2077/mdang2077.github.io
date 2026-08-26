# Animations Spec — section unlock and hero field

Companion to `CLAUDE_CODE_BRIEF.md` and `LOCK_SPEC.md`. Scheduled as **phase 5** in `PLAN.md`, which carries the build order and the integration notes. This file is authoritative for what happens **when a CTF challenge is solved and a section opens**. The hero padlock is covered separately in `LOCK_SPEC.md`.

---

## 0. The chosen effects

| # | Effect | Scope | Library |
|---|---|---|---|
| **A** | **Redraw scanline** | the block swap — challenge card → content | GSAP |
| **B** | **Scramble decrypt** | the text inside the revealed content | GSAP |
| **C** | **Hero glyph field** | the hero background, behind the lockup | canvas + GSAP |

> **Status note.** Effect B was built for the unlock, reviewed on screen, and **cut** — see `PLAN.md` §5 4c. It survives as the *relock* effect (`PLAN.md` phase 5b), where no beam competes with it. §1–§3 below remain the reference for the scramble mechanics; they are not an instruction to re-add B to the unlock.

All three were selected from live prototypes after reviewing 20+ alternatives. **Do not substitute a simpler fade** — these are the specified behaviours.

**A and B are not two separate animations.** §3 describes how they compose into one motion. C is independent: it lives in the hero and is driven by lock state, not by any section (§7).

---

## 1. Effect A — Redraw scanline (the block swap)

### What it does

A glowing horizontal beam sweeps down the section. **Above the beam the block is already the unlocked content; below it, still the challenge card.** Like a CRT repainting the region one line at a time.

This is the same visual language as the hero lock's scroll light sweep (`LOCK_SPEC.md` §4), which is why it was chosen — the site reads as one system rather than a pile of effects.

### The mechanism

Two panes stacked absolutely in an `overflow:hidden` stage. One proxy value `v` (0 → 1) drives four things at once:

- `content` clip-path opens downward — `inset(0 0 ${(1-v)*100}% 0)`
- `locked` clip-path closes downward — `inset(${v*100}% 0 0 0)`
- the beam's `top` rides the boundary — `v * hMax`
- the stage `height` tweens `hLocked → hContent`

```js
function unlockSection(stage){
  const { locked, content, hL, hC } = measure(stage);
  const beam = stage.appendChild(makeBeam());
  const p = { v: 0 }, hMax = Math.max(hL, hC);

  gsap.set(content, { visibility:'visible', opacity:1, clipPath:'inset(0 0 100% 0)' });

  return gsap.timeline({ onComplete(){ beam.remove(); gsap.set(content,{clipPath:'none'}); } })
    .to(beam, { opacity:1, duration:0.10 }, 0)
    .to(p, {
      v: 1, duration: 1.0, ease: 'power2.inOut',
      onUpdate(){
        gsap.set(content, { clipPath:`inset(0 0 ${(1-p.v)*100}% 0)` });
        gsap.set(locked,  { clipPath:`inset(${p.v*100}% 0 0 0)` });
        gsap.set(beam,    { top: p.v * hMax });
      }
    }, 0.06)
    .to(stage, { height: hC, duration: 1.0, ease:'power2.inOut' }, 0.06)
    .to(beam, { opacity:0, duration:0.20 }, 0.95);
}
```

### The beam

```css
.beam{
  position:absolute; left:-3%; width:106%; height:2px;
  opacity:0; z-index:6; pointer-events:none;
  background:linear-gradient(90deg, transparent, var(--ok), transparent);
  box-shadow:0 0 12px 3px color-mix(in srgb, var(--ok) 40%, transparent);
}
```

Colour comes from the theme's "solved" token, never a hardcoded hex — it must differ between dark and light themes.

### Timing

Total ~1.15s. Slower than a typical UI transition, deliberately: it is the payoff for solving a puzzle, and the beam needs to be readable as a *scan*, not a flash.

---

## 2. Effect B — Scramble decrypt (the text)

### What it does

Text renders as churning ciphertext glyphs, then resolves to plaintext left → right. The canonical decryption read.

### The mechanism

A proxy tweens 0 → 1. Characters left of the cursor are resolved; everything right of it re-randomises every frame. Whitespace and newlines never scramble, so the text keeps its shape and nothing reflows.

```js
const GLYPH = '!<>-_\\/[]{}—=+*^?#%01ABCDEF';

function scramble(el, finalText, duration = 1.2){
  const p = { v: 0 };
  return gsap.to(p, {
    v: 1, duration, ease: 'power2.out',
    onUpdate(){
      const cut = Math.floor(p.v * finalText.length);
      let out = '';
      for (let i = 0; i < finalText.length; i++){
        const ch = finalText[i];
        out += (i < cut || ch === '\n' || ch === ' ')
          ? ch
          : GLYPH[(Math.random() * GLYPH.length) | 0];
      }
      el.textContent = out;
    },
    onComplete(){ el.textContent = finalText; }
  });
}
```

### Notes

- **Hand-rolled on purpose.** GSAP ships `ScrambleTextPlugin` (free since the Webflow acquisition) which does this in one line, but cdnjs hosting for it is unreliable. This version has zero plugin dependency. If the plugin loads cleanly, using it instead is fine — the visual spec is unchanged.
- **`textContent`, never `innerHTML`.** The scrambler rewrites the string every frame; going through `innerHTML` would re-parse markup 60×/sec and destroy any nested elements.
- **The element must be a leaf.** Scramble the innermost text-bearing node (a `.tg` pill's label, a `.blk-t` heading), never a container.
- Requires `white-space: pre-wrap` on multi-line targets or the newlines collapse.

---

## 3. How A and B compose — required reading

The naive approach — run the scanline, then run the scramble — reads as two animations queued back to back, ~2.3s of a visitor waiting. Don't do that.

**Drive both from the same proxy.** The scanline's `v` already represents "how far down the block has been redrawn." Use it to decide which text elements have resolved:

- Before the run, capture each text element's `offsetTop` within the content pane, and its final string.
- On every `onUpdate`, any element whose `offsetTop` is **above** the beam starts its scramble; elements below stay untouched (still clipped, so invisible anyway).
- Each element's scramble is short — ~350ms — so it resolves shortly after the beam clears it.

The result: **text decrypts in the beam's wake.** One gesture, ~1.2s total, and the two effects explain each other — the beam isn't just revealing, it's *doing the decryption*.

```js
// inside the scanline's onUpdate
const beamY = p.v * hMax;
targets.forEach(t => {
  if (!t.started && t.top < beamY){
    t.started = true;
    scramble(t.el, t.text, 0.35);
  }
});
```

**Hard rule:** a given DOM node is written by exactly one of the two effects. The scanline owns `clip-path`, `height`, and the beam's `top`. The scramble owns `textContent` on leaf nodes. If both ever touch the same property the frames will fight.

---

## 4. Shared requirements

These apply to the composed animation as a whole. Several were found by breaking the prototypes — do not skip them.

### Height measurement

Both panes must be measured **before** the transition, with the pane temporarily `position: relative` and the other `display: none`. Measuring while absolutely positioned returns the wrong height.

```js
function measure(stage){
  const locked = stage.querySelector('.locked'), content = stage.querySelector('.content');
  gsap.set([locked, content], { position:'relative' });
  gsap.set(content, { display:'none' });   const hL = locked.offsetHeight;
  gsap.set(locked,  { display:'none' });
  gsap.set(content, { display:'block' });  const hC = content.offsetHeight;
  gsap.set([locked, content], { position:'absolute', display:'block' });
  return { locked, content, hL, hC };
}
```

### Resize must not clobber an in-flight transition — real bug

Re-measuring on `resize` wipes any running animation. A visitor rotating a phone or dragging a window mid-unlock snaps back to locked. Debounce the handler **and** guard it with a busy set:

```js
const BUSY = new Set();
let rz;
addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(() => sections.forEach(n => {
    if (!BUSY.has(n)) { measure(n); reset(n); }
  }), 180);
});
```

Add the section id to `BUSY` when the timeline starts, remove it on `onComplete` (plus a safety timeout).

### State model

Three states, and the site must be able to enter any of them **without playing an animation**:

| State | When | Behaviour |
|---|---|---|
| `locked` | default | challenge card shown, stage at `hL` |
| `unlocking` | challenge solved live | the composed timeline plays once |
| `unlocked` | saved progress, or `[ skip puzzles ]` | jump straight to end state, no tween |

A returning visitor, or one who hits bypass, must land on `unlocked` **instantly**. Only a live solve animates.

### `prefers-reduced-motion`

One guard, checked once. Kill the timeline, set `textContent` to the final strings directly, set the stage to `hC`, hide the locked pane, show the content. No beam, no scramble, no tween — and the section must be fully readable and complete.

### Accessibility

- The scrambling text is garbage to a screen reader mid-flight. Mark the content pane `aria-busy="true"` during the transition and remove it on completion, or render the final text into an offscreen `aria-live` region and mark the animating copy `aria-hidden`.
- Announce the state change (`"skills section unlocked"`) on the section's live region, not on the animating nodes.

### Performance

- The scanline writes `clip-path` on two elements per frame. Fine for three sections; do not extend this pattern to dozens of elements.
- The scramble rewrites `textContent` per frame per element. Cap concurrent scrambles — the beam's wake naturally staggers them, which is another reason the composed version beats running them separately.

---

## 5. Where these are used

| Location | Effect |
|---|---|
| Section unlock (skills, projects, extra) | A + B composed, per §3 |
| `[ skip puzzles ]` bypass | neither — jump to `unlocked` instantly |
| Returning visitor with saved progress | neither — jump to `unlocked` instantly |
| Hero padlock | not covered here — see `LOCK_SPEC.md` |

---

## 6. Library policy

**GSAP only for these two effects.** Reasons, in order:

1. Both must animate `height` — a layout property. Motion is built on the Web Animations API and optimised for transform/opacity; height animation runs against its grain. GSAP treats all properties equally.
2. These are multi-beat timelines with overlapping tweens at absolute offsets. GSAP timelines express that directly; Motion has no equivalent primitive.
3. Both need per-frame `onUpdate` with arbitrary DOM writes. GSAP proxy tweens exist for exactly this.
4. GSAP + ScrollTrigger is already loaded for the hero lock. Adding anime.js and Motion would mean three animation loops, three easing vocabularies, and ~40–50KB more against a budget Three.js has already strained.

anime.js and Motion were evaluated and are not used. This is a decision, not an oversight — do not "modernise" it.

---

## 7. Effect C — hero glyph field

A field of glyphs behind the hero lockup. Present while the site is **locked**,
clears when the hero lock opens, returns on relock.

Selected from a live prototype against a moving-stream variant. The moving
version was rejected: motion in a hero background competes with the type, and
compensating by dimming it costs the effect you wanted in the first place.

### 1. What it is

A fixed grid of monospace characters. **The grid never moves.** A small number
of cells reroll their character each frame, and the character that just changed
flashes brighter for ~400ms before settling. It reads as a system under load
rather than as data flowing past.

### 2. Locked constants

Both were chosen off the prototype's sliders and are **not** defaults to tune.

| Constant | Value | Note |
|---|---|---|
| `DENSITY` | `1.00` | every cell in the grid renders — the prototype's maximum |
| `CHURN` | `0.01` | the prototype's minimum — as close to still as the control goes |
| `CW` / `CH` | `15px` / `25px` | cell advance, horizontal and vertical |
| font | `13px` JetBrains Mono | the site's mono stack |

```js
const rerolls = Math.max(1, Math.round(rows * cols * CHURN * 0.010));
```

**What those numbers actually produce.** On a ~1400px hero the grid is about
96 x 15 = **1440 cells**. At `CHURN = 0.01` that expression floors to **one
reroll per frame** — 60 characters a second, so any given cell changes roughly
**once every 24 seconds**. That is the intent: a dense, nearly still wall that is
unmistakably alive if you watch one spot and completely calm if you do not.

**Consequence to accept, not fix.** At full density with near-zero churn the
field is closer to a *texture* than an animation. If it reads as flat noise on
screen, the first lever is `CHURN`, not `DENSITY` — density is what makes it feel
like a wall of ciphertext, and dropping it is what made the prototype look sparse
and arbitrary. Do not raise churn past ~0.05 without asking; the chosen value
exists so the hero stays quiet.

### 3. The mask is load-bearing

A horizontal falloff drives the field to **zero opacity across the middle ~40%**
of the hero, plus a gentler vertical falloff at the top and bottom edges.

```js
// applied with globalCompositeOperation = 'destination-in', after drawing
0.00 -> 1.00   0.20 -> 0.55   0.42 -> 0.00
0.58 -> 0.00   0.80 -> 0.55   1.00 -> 1.00
```

Without it the name is unreadable **at any opacity** — tested, not assumed. The
mask is the whole difference between atmospheric and noisy, and it is the reason
`DENSITY = 1.00` is survivable at all.

### 4. Canvas, not DOM

One `<canvas>`, absolutely positioned, `z-index: 0`. Never a grid of spans: 1440
nodes repainting every frame beside a live WebGL context is not a tradeoff worth
having.

Layer order inside the hero, bottom to top:

```
hero background
canvas  (the field)          z-index 0
scanline overlay             z-index 1, pointer-events none
name / lock / progress dots  z-index 2
```

Cap `devicePixelRatio` at 2. Rebuild the grid on resize; do not scale it.

### 5. Coupling to the lock

**The lock causes the field to clear.** Not the reverse, and not in parallel —
fire them on the same frame and they read as two unrelated things.

| t | Beat |
|---|---|
| 0ms | hero lock unlock timeline begins (`LOCK_SPEC.md` §3) |
| 120ms | field starts clearing: `master` 1 -> 0, 850ms, `power2.inOut` |

On relock the field **reseeds before fading back in** — a fresh set of characters,
not the ones that left. It is a new encryption, not the same one returning.
`master` 0 -> 1 over 600ms, `power2.out`, starting 100ms into the relock.

`master` is a plain number multiplied into every cell's alpha. It is the only
thing the lock touches; nothing else about the field is animated by GSAP.

### 6. Theme

Glyph colour comes from the "solved/active" green token, per-cell alpha
`0.22 + random*0.6`. Freshly changed cells draw in a near-white tint instead.
No hardcoded hex.

**The light theme needs its own values and has not been designed.** Green at low
alpha on a warm off-white ground will be either invisible or dirty. Treat this as
open work, not a token swap.

### 7. Performance and access

- Pause the rAF loop when the hero leaves the viewport (`IntersectionObserver`)
  and on `visibilitychange`. The hero scrolls away almost immediately; a field
  animating for a page nobody is looking at is pure battery cost.
- Below 768px, halve the cell count by raising `CW`/`CH` rather than shrinking
  the font. A 1440-cell grid on a phone is the wrong budget.
- Measure with the WebGL lock running. These two are the only continuously
  animating things on the page and they share a frame.
- `aria-hidden="true"` on the canvas. It is decoration and must never reach a
  screen reader as 1440 random characters.
- **`prefers-reduced-motion`:** render exactly one frame and stop. No rAF loop,
  no churn, no flashes. The field still appears and still clears with the lock,
  it simply does not move.
