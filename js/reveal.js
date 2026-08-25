/* ============================================================
   REVEAL — the section unlock stage.

   Spec: `ANIMATIONS.md` §1 (effect A) and §4 (shared
   requirements). This module is the whole of the block swap;
   `animations.js` stays the hero/status-strip choreographer and
   does not grow this concern.

   What it owns, and nothing else writes any of it:

     the `hidden` attribute on both panes
     `clip-path` on both panes
     the stage's inline `height`, and only while sweeping
     the beam's `top`
     `textContent` on the text leaves of both panes, and only
       while relocking
     `filter` and `opacity` on both panes, likewise
     `aria-busy` on the stage, likewise
     each section's `[data-relock-live]` announcement

   ctf.js goes on writing its display classes on `.challenge` /
   `.reveal`; the stylesheet neutralises them inside a ready stage,
   so they are the no-stage fallback rather than a second opinion.

   ── TWO DEVIATIONS FROM THE SPEC, BOTH REQUESTED ────────────
   1. NO EFFECT B. `ANIMATIONS.md` §2 and §3 have the revealed text
      resolving out of scrambled ciphertext in the beam's wake,
      composed through the same proxy. Built, seen, and cut: the
      beam alone is the effect, and the churn was noise on top of
      it. §3's shared-proxy argument only ever existed to stop the
      two reading as a queue — with one effect there is no queue,
      and no `textContent` writer in the unlock direction.

      Phase 5b brings the scramble back for the *relock* only, and
      that is not a reversal of this. What was cut was churn layered
      on top of the beam. The relock has no beam: there is nothing
      for the scramble to compete with, because it is the whole of
      the effect. See `PLAN.md` §5b.1.

   2. BYPASS SWEEPS. §5 has bypass jumping straight to `unlocked`
      with no beam. It now runs the same sweep the solves do, three
      of them staggered, because a switch that opens three sections
      is still worth watching. Bypass *off* is unchanged and stays
      instant — going back is not a payoff and should not be paced
      like one.

   ── AND ONE THAT IS NOT ─────────────────────────────────────
   `ANIMATIONS.md` §4 has both panes absolutely positioned for the
   whole of the stage's life, the stage carrying a measured pixel
   height, and a debounced resize handler re-measuring behind a
   busy set.

   Here the panes go absolute *only during the sweep*. Settled, the
   visible pane is in normal flow and the stage has no inline
   height at all. The reason is not tidiness: a pinned height is
   wrong the moment anything inside the pane changes size, and
   something does — submitting a wrong answer prints
   `// incorrect. try again.` into `.challenge-msg`, which grows
   the locked pane inside a stage that is `overflow: hidden` at a
   height measured before the message existed. Late-loading webfonts
   and a rotated phone are the same bug arriving by other routes.

   Not pinning removes all three, and takes the resize handler with
   them: there is no stored height left to go stale, so there is
   nothing for a resize to clobber and nothing to guard. What the
   busy set still does is stop a second sweep starting on a section
   already sweeping. A resize *during* a sweep leaves that sweep
   tweening toward a height measured a moment earlier, and it lands
   on the real one anyway, because completion drops back to auto.
   ============================================================ */

/* Effect A, `ANIMATIONS.md` §1, every beat of it a half longer
   than the spec's. ~1.77s end to end. It was already slower than a
   UI transition on purpose — it is the payoff for solving
   something — and at 1.0s the beam still crossed a short section
   faster than the eye tracks it. Scale these together or the beam
   fades out somewhere other than the end of its own travel. */
const SWEEP = 1.5;
const BEAM_IN = 0.15;
const BEAM_OUT = 0.3;
const SWEEP_START = 0.09;
/* How far before the sweep ends the beam starts leaving, so it is
   gone as it lands rather than blinking out after it. */
const BEAM_OUT_LEAD = 0.165;

/* Bypass opens every locked section at once, which without this is
   three beams running in lockstep — one gesture read three times.
   The stagger from `PLAN.md` §3's bypass run, so the page has one
   idea of what "all at once, but sequenced" means. */
const BYPASS_STAGGER = 0.08;

/* A sweep that never finishes must not leave a section clipped
   shut. Backgrounding the tab stops the frames, so this is what
   guarantees the end state to anyone who leaves and comes back. */
const SAFETY = (SWEEP + BEAM_OUT + 1) * 1000;

/* ── THE RELOCK, `PLAN.md` §5b ───────────────────────────────
   Bypass off, and only bypass off. Every fraction below is a
   fraction of RELOCK, so the beat table in the plan can be read
   straight off these names:

     0.00 - 0.42   the content pane encrypts, right -> left
     0.43 - 0.57   the blur dip, with the pane swap and the height
                   change buried inside it
     0.58 - 1.00   the locked pane decrypts in, right -> left

   Right -> left is load-bearing. The unlock beam sweeps down and
   its decrypt ran left -> right; running this one the other way is
   what makes it read as the first one being undone rather than as
   a second, unrelated event. Both axes reverse or neither does. */
const RELOCK = 0.9;
const OUT_END = 0.42;
const DIP_IN = 0.43;
const SWAP = 0.5;
const DIP_OUT = 0.57;
const IN_START = 0.58;

/* The dip is ~126ms of this, peaking exactly on the swap frame.
   Longer and it reads as a page load; absent and the pill grid is
   visibly seen becoming a challenge card. */
const DIP_BLUR = 7;
const DIP_DIM = 0.45;

const RELOCK_SAFETY = (RELOCK + 1) * 1000;

/* `ANIMATIONS.md` §2's alphabet, unchanged — the page has one idea
   of what ciphertext looks like. */
const GLYPH = '!<>-_\\/[]{}\u2014=+*^?#%01ABCDEF';
const glyph = () => GLYPH[(Math.random() * GLYPH.length) | 0];

/* Length-preserving, both of them, and that is the whole reason
   the effect can run inside real geometry instead of over a
   stand-in for it: the string a pill is showing is always exactly
   as long as the one it will end on, so no pill changes width and
   no flex row rewraps. Spaces never scramble, for the same reason.

   `u` runs 0 -> 1 in both. Out: 0 is plain, 1 is fully glyphed,
   eating inward from the right. In: the reverse, resolving from
   the right. */
function scrambleOut(target, u) {
  const t = target.el.dataset.txt;
  const from = t.length - Math.floor(u * t.length);
  target.write(
    [...t].map((c, i) => (i >= from && c !== ' ' ? glyph() : c)).join(''),
  );
}

function scrambleIn(target, u) {
  const t = target.el.dataset.txt;
  const from = t.length - Math.floor(u * t.length);
  target.write(
    [...t].map((c, i) => (i >= from || c === ' ' ? c : glyph())).join(''),
  );
}

/* Leaves only. Writing `textContent` on a container replaces its
   children with a string, so one wrong selector here deletes every
   pill in the pane. An element with no element children cannot be
   that mistake.

   Empty ones are skipped because there is nothing to scramble, and
   `.visually-hidden` ones because scrambling text nobody can see
   buys nothing and hands a screen reader garbage. */
function leaves(pane) {
  return Array.from(pane.querySelectorAll('*')).filter(
    (el) =>
      !el.firstElementChild &&
      !el.classList.contains('visually-hidden') &&
      el.textContent.trim() !== '',
  );
}

/* A target is anything in the pane showing a string, which is the
   text leaves plus one thing that is not a text node at all: the
   answer input's placeholder. It is the only English left on the
   card once the rest is ciphertext, and one legible line in the
   middle of a decrypt is exactly the seam the effect is trying not
   to have. The indirection exists for that one case; an element is
   never both, because an input's `textContent` is empty and so it
   never reaches `leaves`. */
function targets(pane) {
  const list = leaves(pane).map((el) => ({
    el,
    read: () => el.textContent,
    write: (v) => {
      el.textContent = v;
    },
  }));

  pane.querySelectorAll('[placeholder]').forEach((el) => {
    list.push({
      el,
      read: () => el.placeholder,
      write: (v) => {
        el.placeholder = v;
      },
    });
  });

  return list;
}

/* Read the real string once, while it is still real. After this,
   what these elements are showing is glyphs, and reading it back
   would bake them in permanently. */
function cache(list) {
  list.forEach((t) => {
    t.el.dataset.txt = t.read();
  });
  return list;
}

function restore(list) {
  list.forEach((t) => {
    if (t.el.dataset.txt !== undefined) t.write(t.el.dataset.txt);
  });
}

export function initReveal({ gsap = null, prefersReducedMotion = false } = {}) {
  const stages = Array.from(document.querySelectorAll('[data-stage]'));
  if (!stages.length) return;

  /* Motion is the enhancement, state is the guarantee — the same
     split hud.js makes. Without GSAP, or under reduced motion,
     every route below lands on an identical end state with no
     tween and no beam. */
  const animate = !!gsap && !prefersReducedMotion;

  const items = stages
    .map((stage, index) => {
      /* The name comes off the heading the section already points
         at with `aria-labelledby`, so the announcement cannot drift
         from the visible title the way a second copy of the string
         in here would. */
      const section = stage.closest('[data-section]');
      const heading =
        section && document.getElementById(section.getAttribute('aria-labelledby'));

      return {
        index,
        stage,
        locked: stage.querySelector('[data-pane="locked"]'),
        content: stage.querySelector('[data-pane="content"]'),
        live: section && section.querySelector('[data-relock-live]'),
        name: heading ? heading.textContent.trim() : '',
        state: 'locked',
        tl: null,
        safety: null,
        /* Every target a relock is currently holding glyphed.
           Non-null only in flight, and what `stop` restores from. */
        leaves: null,
      };
    })
    .filter((item) => item.locked && item.content);

  if (!items.length) return;

  /* Sections with a sweep in flight. Membership is what makes a
     second solve of the same section, or a bypass landing mid-
     sweep, tear the first one down instead of racing it. */
  const busy = new Set();

  /* ── STATE, WITHOUT ANIMATION ───────────────────────────────
     §4's state model. `locked` and `unlocked` are both enterable
     flat, because a bypass and a returning visitor arrive at them
     without having watched anything happen. Every reduced-motion
     path collapses to this function too. */
  function paint(item, state) {
    const was = item.state;
    item.state = state;
    const open = state === 'unlocked';

    /* Only the edge into `locked`, so the announcement is the news
       that the section shut rather than a running commentary. `init`
       enters `locked` from `locked` and says nothing, which is what
       stops a page load announcing three closed sections.

       Nothing else on the page carries this: bypass off leaves the
       "n / 3 unlocked" label untouched, since the solved count has
       not changed, and the badge's "[ locked ]" is not live. */
    if (item.live) {
      item.live.textContent =
        state === 'locked' && was !== 'locked' ? `${item.name} section locked` : '';
    }

    item.stage.removeAttribute('data-sweeping');
    item.stage.style.height = '';

    item.locked.hidden = open;
    item.content.hidden = !open;

    /* Cleared, not parked at `inset(0 0 0% 0)`: a clip-path left
       on an element is a compositing layer left behind, and 0% is
       not identical to `none` for a box with a shadow. */
    item.locked.style.clipPath = '';
    item.content.style.clipPath = '';
  }

  /* ── MEASUREMENT ────────────────────────────────────────────
     Called once, at the start of a sweep, and never stored. The
     locked pane is already in flow and visible, so it measures
     itself; the content pane is `hidden`, so it is shown for the
     length of one synchronous block. Nothing paints in between —
     the browser cannot render mid-script — so the reveal is not
     visible even though it is real. */
  function measure(item) {
    /* Whichever pane is hidden is shown for the length of one
       synchronous read. Symmetrical because the relock measures
       from the other side: there the content pane is the visible
       one and the locked pane is the one that has to be un-hidden.

       Each pane is measured in flow, so a trailing margin collapses
       out of it exactly as it does in the settled layout — which is
       the height the stage has to land on. The absolutely
       positioned pane will be that margin taller while sweeping,
       and the difference is empty space at the bottom of a box that
       is clipped there anyway. */
    const h = (pane) => {
      const wasHidden = pane.hidden;
      pane.hidden = false;
      const height = pane.offsetHeight;
      pane.hidden = wasHidden;
      return height;
    };

    return { hL: h(item.locked), hC: h(item.content) };
  }

  /* Tear a sweep down and leave nothing of it behind. Safe to call
     on an item that is not sweeping. */
  function stop(item) {
    if (item.tl) {
      item.tl.kill();
      item.tl = null;
    }
    if (item.safety) {
      window.clearTimeout(item.safety);
      item.safety = null;
    }
    const beam = item.stage.querySelector('.beam');
    if (beam) beam.remove();

    /* Plain text back on every leaf before anything else can read
       it. A relock torn down mid-flight — bypass thrown straight
       back on, the safety timer firing — must not leave glyphs in
       the DOM, and must not leave `dataset.txt` as the only copy of
       the real string. */
    if (item.leaves) {
      restore(item.leaves);
      item.leaves = null;
    }

    item.stage.removeAttribute('aria-busy');
    item.locked.style.filter = '';
    item.content.style.filter = '';
    item.locked.style.opacity = '';
    item.content.style.opacity = '';

    busy.delete(item);
  }

  /* ── THE SWEEP ──────────────────────────────────────────────
     One proxy drives both clip-paths and the beam, so the three
     cannot drift apart: the beam is exactly the seam between the
     pane closing above it and the one opening below.

     The stage's height is the one thing on a tween of its own. It
     runs the same window and the same ease, but it is a layout
     property, and driving it from the proxy would put a style
     write and a layout read in the same frame.

     `delay` is bypass's stagger. It elapses with the stage already
     rigged — height pinned, panes absolute, content clipped fully
     shut — which is pixel-identical to the locked state it is
     still showing, so the wait is invisible. */
  function sweep(item, delay = 0) {
    const { stage, locked, content } = item;
    const { hL, hC } = measure(item);
    const hMax = Math.max(hL, hC);

    item.state = 'unlocking';
    busy.add(item);

    /* Pin the height first, then take the panes out of flow, so
       the stage never passes through a frame with no content in it
       to hold it open. */
    stage.style.height = `${hL}px`;
    stage.dataset.sweeping = '';

    locked.hidden = false;
    content.hidden = false;
    /* No `aria-busy` here, deliberately. The spec asks for it, but
       its reason was that scrambling text is garbage mid-flight —
       and nothing scrambles any more. The content is final and
       correct from the first frame and merely clipped, which is a
       visual state; hiding it from assistive tech for the length
       of the sweep would take it away for no benefit. */
    content.style.clipPath = 'inset(0 0 100% 0)';
    locked.style.clipPath = 'inset(0% 0 0 0)';

    const beam = document.createElement('i');
    beam.className = 'beam';
    beam.setAttribute('aria-hidden', 'true');
    stage.append(beam);

    const p = { v: 0 };

    item.tl = gsap.timeline({
      delay,
      onComplete: () => {
        stop(item);
        paint(item, 'unlocked');
      },
    });

    item.tl
      .to(beam, { opacity: 1, duration: BEAM_IN }, 0)
      .to(
        p,
        {
          v: 1,
          duration: SWEEP,
          ease: 'power2.inOut',
          onUpdate: () => {
            content.style.clipPath = `inset(0 0 ${(1 - p.v) * 100}% 0)`;
            locked.style.clipPath = `inset(${p.v * 100}% 0 0 0)`;
            beam.style.top = `${p.v * hMax}px`;
          },
        },
        SWEEP_START,
      )
      .to(stage, { height: hC, duration: SWEEP, ease: 'power2.inOut' }, SWEEP_START)
      .to(beam, { opacity: 0, duration: BEAM_OUT }, SWEEP_START + SWEEP - BEAM_OUT_LEAD);

    /* The end state is a promise, not a side effect of frames
       arriving. A backgrounded tab stops the timeline where it
       stands; this is what settles it anyway. */
    item.safety = window.setTimeout(() => {
      if (!busy.has(item)) return;
      stop(item);
      paint(item, 'unlocked');
    }, SAFETY + delay * 1000);
  }

  /* ── THE RELOCK ─────────────────────────────────────────────
     `PLAN.md` §5b. The unlock's opposite in every axis, and it
     shares none of its machinery: no beam, no clip-path, nothing
     overlaid, nothing cloned, no intermediate element. Each leaf
     scrambles inside its own box, so every frame is real DOM
     geometry rather than a stand-in for it — which is exactly what
     the rejected first prototype got wrong.

     The two panes still trade places, and that swap is the one
     frame the effect cannot show honestly: a pill grid becoming a
     challenge card in a single tick reads as a glitch however
     slowly the rest of it runs. So it happens inside the dip, and
     the stage's height change is timed to the same window for the
     same reason. */
  function relock(item, from = 0) {
    const { stage, locked, content } = item;
    const { hL, hC } = measure(item);

    item.state = 'relocking';
    busy.add(item);

    /* Cached here rather than once at setup, and this is the only
       safe moment for it: the busy set guarantees no relock is in
       flight, so nothing is glyphed, and ctf.js may have written
       `// incorrect. try again.` into the challenge message since
       the last time this ran. Read now, never read again until
       this relock has settled. */
    const outLeaves = cache(targets(content));
    const inLeaves = cache(targets(locked));
    item.leaves = outLeaves.concat(inLeaves);

    /* Pin the height the stage is already at before the panes leave
       flow, so it never passes through a frame with nothing in it
       to hold it open. */
    stage.style.height = `${hC}px`;
    stage.dataset.sweeping = '';

    /* Rigged explicitly rather than assumed, because this is also
       the entry point for a section caught mid-sweep, which arrives
       with both panes showing and both of them clipped. Written
       every time: a settled section already holds these values. */
    locked.hidden = true;
    content.hidden = false;
    locked.style.clipPath = '';
    content.style.clipPath = '';

    /* Mid-flight glyphs are garbage to a screen reader, and unlike
       the sweep — where the content is final from the first frame
       and merely clipped — here it genuinely is not text yet. */
    stage.setAttribute('aria-busy', 'true');

    /* Ciphertext before it is ever on screen. One plain frame at
       the swap would give the ending away 400ms early. */
    inLeaves.forEach((t) => scrambleIn(t, 0));

    const out = { v: 0 };
    const dip = { v: 0 };
    const churn = { v: 0 };
    const inn = { v: 0 };

    /* On the panes rather than on the stage: the stage clips, and a
       filter applied there would bleed its blur out past the clip
       and over the section header. */
    const paintDip = () => {
      const f = dip.v ? `blur(${(dip.v * DIP_BLUR).toFixed(2)}px)` : '';
      const o = dip.v ? String(1 - dip.v * DIP_DIM) : '';
      locked.style.filter = f;
      content.style.filter = f;
      locked.style.opacity = o;
      content.style.opacity = o;
    };

    item.tl = gsap.timeline({
      onComplete: () => {
        stop(item);
        paint(item, 'locked');
      },
    });

    /* `from` is the seek at the bottom of this function, and it is
       non-zero only for a section caught mid-sweep. Seeking to the
       dip renders the encrypt at its end, so the pane it snaps to
       is full of ciphertext rather than full of readable text —
       which is what lets the snap pass as the encryption finishing
       rather than as the reveal it interrupted completing in a
       single frame. Less was shown, so there is less to undo. */

    item.tl
      /* Linear, both scrambles. An eased wipe reads as a thing
         being animated; a steady one reads as a thing being
         processed, which is what this is pretending to be. */
      .to(
        out,
        {
          v: 1,
          duration: RELOCK * OUT_END,
          ease: 'none',
          onUpdate: () => outLeaves.forEach((t) => scrambleOut(t, out.v)),
        },
        0,
      )
      .to(
        dip,
        {
          v: 1,
          duration: RELOCK * (SWAP - DIP_IN),
          ease: 'power2.in',
          onUpdate: paintDip,
        },
        RELOCK * DIP_IN,
      )
      .to(
        dip,
        {
          v: 0,
          duration: RELOCK * (DIP_OUT - SWAP),
          ease: 'power2.out',
          onUpdate: paintDip,
        },
        RELOCK * SWAP,
      )
      /* Height and swap both inside the dip, so §4b still holds:
         the stage carries an inline height only while it is
         moving, and drops back to auto the moment it settles. */
      .to(
        stage,
        {
          height: hL,
          duration: RELOCK * (DIP_OUT - DIP_IN),
          ease: 'power2.inOut',
        },
        RELOCK * DIP_IN,
      )
      .call(
        () => {
          content.hidden = true;
          locked.hidden = false;
        },
        null,
        RELOCK * SWAP,
      )
      /* The swapped-in pane holds at fully glyphed for ~70ms before
         it starts resolving. This tween's only job is to keep
         re-rolling those glyphs across that gap: frozen ciphertext
         under a clearing blur looks like a dropped frame. */
      .to(
        churn,
        {
          v: 1,
          duration: RELOCK * (IN_START - SWAP),
          ease: 'none',
          onUpdate: () => inLeaves.forEach((t) => scrambleIn(t, 0)),
        },
        RELOCK * SWAP,
      )
      .to(
        inn,
        {
          v: 1,
          duration: RELOCK * (1 - IN_START),
          ease: 'none',
          onUpdate: () => inLeaves.forEach((t) => scrambleIn(t, inn.v)),
        },
        RELOCK * IN_START,
      );

    if (from) item.tl.time(RELOCK * from);

    /* Same guarantee the sweep makes, and it matters more here:
       a relock stopped by a backgrounded tab would leave glyphs
       frozen in the DOM, not merely a clipped pane. */
    item.safety = window.setTimeout(() => {
      if (!busy.has(item)) return;
      stop(item);
      paint(item, 'locked');
    }, RELOCK_SAFETY);
  }

  /* ── ENTRY ──────────────────────────────────────────────────
     The same `ctf:state` every other module listens to. Two routes
     animate — a live solve, and bypass being switched on — and
     everything else is a flat jump: `reason: 'init'`, bypass going
     back off, and any section already open.

     A section that is already `unlocked` is never swept. That is
     what stops bypass replaying the reveal of a section somebody
     earned a minute ago, and it is the same test that stops a
     second solve of one section re-running it. */
  document.addEventListener('ctf:state', (event) => {
    const detail = event.detail;

    /* Counts only the sections this event actually opens, so the
       stagger has no gaps in it when one of the three was already
       solved before the switch was thrown. */
    let step = 0;

    items.forEach((item) => {
      const open = detail.solved[item.index] || detail.bypass;
      const shut = item.state !== 'unlocked';

      const solving =
        detail.reason === 'solve' && detail.index === item.index && shut;
      const bypassing = detail.reason === 'bypass-on' && open && shut;

      if ((solving || bypassing) && animate) {
        stop(item);
        sweep(item, bypassing ? step++ * BYPASS_STAGGER : 0);
        return;
      }

      /* The relock. `!open` is the whole of the "solved sections
         never relock" rule — a solved section is open whatever
         bypass is doing, so this is false for it and it falls
         through to the no-op below.

         A section still sweeping open relocks too, and that is the
         common case rather than the edge one: the sweep runs for
         ~1.9s, and throwing a switch back within two seconds of
         throwing it is what anyone does while they are looking at
         what the switch does. It was dropped shut flat here at
         first — "it was never fully open, so it gets no payoff-
         shaped undo" — which sounded principled and in practice
         meant the effect did not exist for the way the button is
         actually used. It starts from the dip instead. */
      const midSweep = item.state === 'unlocking';
      const relocking =
        detail.reason === 'bypass-off' &&
        !open &&
        (item.state === 'unlocked' || midSweep);

      if (relocking && animate) {
        stop(item);
        relock(item, midSweep ? DIP_IN : 0);
        return;
      }

      const target = open ? 'unlocked' : 'locked';
      if (item.state === target && !busy.has(item)) return;

      stop(item);
      paint(item, target);
    });
  });

  /* Ready last. The attribute is what lets the stylesheet start
     hiding panes, so nothing is hidden until this module is in a
     position to show it again. */
  items.forEach((item) => {
    item.stage.dataset.stageReady = '';
    paint(item, item.state);
  });
}
