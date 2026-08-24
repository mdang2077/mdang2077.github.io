# ideas.md — what happens after each *individual* CTF solve

> **DECIDED: 2 + 4** — the terminal run log plus the hero pin rail.
> Specced in `PLAN.md`, "Phase 3 -> 4: the unlock system". This file is kept
> as the record of what was considered and why the others were passed over.

Context: there are three sections, each with its own challenge and its own
category — `skills` / cryptography, `projects` / reverse engineering,
`extra puzzle` / forensics. Today, solving one just hides the challenge box,
swaps `[ locked ]` to `[ unlocked ]`, fills a progress dot, and shows the
content. The question is what the *moment* should feel like.

Separate from the **hero lock unlock**, which is already specced in `PLAN.md`
and fires only once, when all three are done (or bypass is on).

Everything below rides on the `ctf:state` CustomEvent that `ctf.js` will
dispatch (PLAN.md, phase 3 -> 4 handoff, item 6). All of them need a
reduced-motion path where the end state simply appears, and none of them can
affect the no-JS render, which is already fully unlocked.

---

## Idea 1 — The section unseals in place

The safe-door read. Same motion for all three sections.

- The challenge box collapses out of the way (GSAP Flip, so nothing jumps).
- The `[ locked ]` tag flips to `[ unlocked ]` with a small pop.
- The divider line in the section header runs left-to-right like a bolt sliding.
- The revealed content staggers up in a quick 60ms cascade.

**Feels like:** a lock disengaging. Clean, confident, over in under a second.

**For:** cheapest to build, impossible to get wrong, reads identically on the
first solve and the third. Reuses the Flip work phase 4 needs anyway.

**Against:** it is the expected answer. Nothing about it is memorable.

**Effort:** low.

---

## Idea 2 — Each solve prints a terminal receipt

A log line types itself out, and the lines accumulate down the page.

```
[+] skills.txt decrypted .......... 1/3
[+] projects.db restored .......... 2/3
[+] all keys recovered ............ 3/3
```

Third line hands off to the hero lock unlock.

**Feels like:** you are running a tool and it is reporting back to you.

**For:** hits the CTF identity harder than any amount of motion does, and it is
text — reduced motion just prints the line instantly, no special case. Also
gives the visitor a visible record of their own run.

**Against:** typewriter effects are a cliché of this exact genre. Needs to be
fast (~30ms/char, not 80) or it becomes something to wait through.

**Effort:** low.

---

## Idea 3 — Each section gets a payoff matched to its own puzzle category

Three different moments, one per discipline.

- **skills / cryptography** — the revealed text arrives scrambled and settles
  character-by-character into the real words. A short decrypt, ~500ms.
- **projects / reverse engineering** — the project cards flip in from edge-on,
  as if they had been disassembled and are being rebuilt.
- **extra / forensics** — the content develops in like a photograph: starts
  blurred and desaturated, resolves to sharp, while the PNG magic bytes fade out.

**Feels like:** the site actually understood which puzzle you just solved.

**For:** by far the most memorable. The one people would mention.

**Against:** three times the work, three times the tuning, three chances to
build something that jars. Real risk of reading as three unrelated sites
stapled together. The scramble effect in particular is easy to overcook.

**Effort:** high.

---

## Idea 4 — Each solve seats a pin in the hero lock

Three small pins (or tick marks) sit next to the hero lock, empty at first.

Solving a section flies a small glyph from that section's `[ unlocked ]` tag up
to the hero (GSAP Flip does this natively), and one pin seats with a click. The
third pin seats and the hero lock opens.

**Feels like:** you are picking a lock, one pin at a time.

**For:** turns three separate wins into one build-up. It is the only idea here
that makes the hero unlock feel *earned* rather than just triggered — the
header stops being decoration and becomes the scoreboard.

**Against:** if the hero is scrolled off-screen the flight is wasted motion —
needs a visibility check with a fallback that just seats the pin silently.
Slightly duplicates the existing 3-dot progress bar, so one of them may have to
go.

**Effort:** medium.

---

## Idea 5 — Each solve adds a line to the ID card

The payoff lands in the sidebar rather than in the section.

`user_info.txt` visibly gains fields as you go — `solves: 1/3`, then a
clearance level, then a final line on the third. Possibly a bonus reveal per
section too (a hidden fourth project, a `whoami` easter egg).

**Feels like:** your session profile filling in as you prove yourself.

**For:** ties the two columns together — right now the sidebar is inert while
all the action happens on the right. Very little motion, so nothing to tune.

**Against:** it is content authoring more than design; the effect is only as
good as the lines written. Easy to miss entirely if the visitor is looking at
the section they just solved, not the sidebar. Adding lines means the card
grows — needs reserved height to respect the zero-layout-shift rule.

**Effort:** low motion, medium writing.

---

## Idea 6 — Territory turns green, section by section

Each solved section's border and header go permanently green while the unsolved
ones stay red. A brief scanline sweep crosses the page on each solve. The green
territory spreads as you work down the page, and the hero is the last thing to
turn.

**Feels like:** taking over a system one process at a time.

**For:** dead cheap — the accent token already rotates red to green, this just
scopes it per-section instead of globally. Very legible at a glance.

**Against:** a full-page flicker is exactly the kind of thing that is charming
once and irritating the third time, and photosensitivity makes it a real
accessibility concern, not a stylistic one. Would have to be very subdued.
Also weakens the hero unlock, since the site has already gone green by then.

**Effort:** low.

---

## Notes on combining

These are not mutually exclusive, and the strongest version is probably a
base plus a layer:

- **1 + 2** — the safe reliable motion, with the terminal log giving it voice.
  Lowest risk, still has personality.
- **4 + 2** — the pin build-up plus the log line. Idea 4 supplies the
  escalation, idea 2 supplies the narration, and the hero unlock lands hardest.
  This is the recommendation if there is appetite for the medium effort.
- **3 alone** — only worth it if the per-discipline payoffs are the point.
  Do not layer anything else on top; it is already the loudest option.

Ideas 5 and 6 both work as quiet additions to any of the above, but 6 fights
the hero unlock for the same beat and should probably be dropped for that
reason alone.
