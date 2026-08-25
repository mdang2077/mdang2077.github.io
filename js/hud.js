/* ============================================================
   HUD — the hero pin rail and the run console.

   Phase 4 steps 1 and 2: pins seat with a pop, the console types,
   and the section's padlock glyph flies to its pin. The hero lock
   timeline and the bypass staggered run are later steps; bypass
   still applies its state instantly here, which is correct, just
   not yet choreographed.

   Everything is a progressive enhancement over the phase 3
   behaviour. Without GSAP, or under reduced motion, every path
   below falls through to the same instant state application, and
   the end state is identical either way.

   The console is `aria-hidden` in the markup: it echoes state
   already announced by each challenge's aria-live message and by
   the role=status progress label. A third live region would
   announce a single solve three times.
   ============================================================ */

/* One row per section, in section order. The columns are padded
   to a fixed width so the log reads as aligned terminal output
   rather than ragged prose. */
const ROWS = [
  { file: 'skills.txt', verb: 'decrypted' },
  { file: 'projects.db', verb: 'restored' },
  { file: 'flag.png', verb: 'carved' },
];

const FILE_COL = 12;
const VERB_COL = 11;

const TYPE_PER_CHAR = 0.028;
/* Bypass is not a solve. Its line lands at 3x so it reads as a
   switch being thrown rather than a machine working. */
const BYPASS_SPEED = 3;

const SEAT_DURATION = 0.18;
const FLIGHT_DURATION = 0.52;

/* The bypass run. Pins go left to right on the way on and right to
   left on the way off, so the two directions read as the same
   mechanism running forwards and backwards rather than as two
   effects. The 120ms head start lets the `[!]` line begin printing
   first — the switch is thrown, *then* the pins answer it. */
const PIN_RUN_DELAY = 0.12;
const PIN_STAGGER = 0.09;

/* The transient bypass line leaves by fading rather than by
   vanishing: a line disappearing between frames reads as a bug in
   a block whose height is reserved and therefore does not move. */
const LINE_FADE = 0.2;

const pad = (value, width) => String(value).padEnd(width, ' ');

/* A block glyph rather than a styled box: an inline-block with a
   vertical-align would change the line box's height, and the run
   log's height is reserved to the pixel. */
function cursorEl() {
  const el = document.createElement('span');
  el.className = 'run-log-cursor';
  el.textContent = '█';
  return el;
}

export function initHud({ gsap = null, prefersReducedMotion = false } = {}) {
  const rail = document.querySelector('[data-pin-rail]');
  const log = document.querySelector('[data-run-log]');
  const idleLine = log && log.querySelector('[data-run-log-idle]');

  if (!rail && !log) return;

  const pins = rail ? Array.from(rail.querySelectorAll('[data-pin]')) : [];
  const badges = Array.from(document.querySelectorAll('[data-lock-badge]'));

  /* Motion is the enhancement; state is the guarantee. One flag
     decides which, checked here rather than at every call site. */
  const animate = !!gsap && !prefersReducedMotion;

  /* Print order, not index order: the console is a transcript, so
     a visitor who solves 3 then 1 sees them in the order they did
     them. */
  const printed = [];

  /* ── THE PRINTER ────────────────────────────────────────────
     One queue, one tween at a time. If a second line arrives while
     the first is still typing, the first is fast-forwarded rather
     than queued behind a delay nobody asked for — a solve should
     never wait on the previous solve's animation. */
  const queue = [];
  let typing = null;

  function segmentsOf(el) {
    return Array.from(el.childNodes)
      .filter((node) => node.nodeType === 1 || node.nodeType === 3)
      .map((node) => ({ node, full: node.textContent }));
  }

  function reveal(segments, count) {
    let left = count;
    segments.forEach(({ node, full }) => {
      const take = Math.max(0, Math.min(full.length, left));
      if (node.textContent !== full.slice(0, take)) {
        node.textContent = full.slice(0, take);
      }
      left -= full.length;
    });
  }

  function finishTyping() {
    if (!typing) return;
    typing.tween.kill();
    reveal(typing.segments, typing.total);
    typing = null;
  }

  function pump() {
    if (typing || !queue.length) return;

    const { entry, speed } = queue.shift();
    const segments = segmentsOf(entry.el);
    const total = segments.reduce((n, s) => n + s.full.length, 0);

    if (!animate) {
      reveal(segments, total);
      placeCursor();
      pump();
      return;
    }

    reveal(segments, 0);
    placeCursor(entry.el);

    const state = { n: 0 };
    const tween = gsap.to(state, {
      n: total,
      duration: (total * TYPE_PER_CHAR) / speed,
      ease: 'none',
      onUpdate: () => reveal(segments, Math.round(state.n)),
      onComplete: () => {
        typing = null;
        placeCursor();
        pump();
      },
    });

    typing = { tween, segments, total };
  }

  function enqueue(entry, speed = 1) {
    /* The line is in the DOM immediately either way — its height is
       part of the reserved block, and only its text is withheld. */
    finishTyping();
    queue.push({ entry, speed });
    pump();
  }

  /* ── LINES ──────────────────────────────────────────────────── */
  function line({ mark, warn, text, count }) {
    const el = document.createElement('p');
    el.className = 'run-log-line' + (warn ? ' run-log-line--warn' : '');

    const markEl = document.createElement('span');
    markEl.className = 'run-log-mark';
    markEl.textContent = mark;

    const body = document.createTextNode(text);

    el.append(markEl, body);

    if (count) {
      const countEl = document.createElement('span');
      countEl.className = 'run-log-count';
      countEl.textContent = count;
      el.append(countEl);
    }

    return el;
  }

  /* The cursor sits on the line being typed, or on the last line
     printed. It is moved rather than recreated so the blink does
     not restart on every keystroke. */
  function placeCursor(onEl) {
    if (!log) return;

    const target = onEl || (printed.length ? printed[printed.length - 1].el : null);

    printed.forEach((entry) => {
      if (entry.el === target) return;
      const stray = entry.el.querySelector('.run-log-cursor');
      if (stray) stray.remove();
    });

    if (target && !target.querySelector('.run-log-cursor')) {
      target.append(cursorEl());
    }
  }

  /* A line on its way out. Spam-toggling must not leave two bypass
     lines in a block whose height is reserved for four, so the next
     write flushes it rather than waiting for the fade. */
  let fading = null;

  function flushFade() {
    if (!fading) return;
    fading.tween.kill();
    fading.el.remove();
    fading = null;
  }

  function renderLog(detail) {
    if (!log) return;

    flushFade();

    /* Newly solved sections, appended in the order they arrived. */
    detail.solved.forEach((isSolved, i) => {
      if (!isSolved) return;
      if (printed.some((entry) => entry.key === i)) return;

      const row = ROWS[i] || { file: `section_${i}`, verb: 'opened' };
      const rank = printed.filter((entry) => entry.key !== 'bypass').length + 1;

      const entry = {
        key: i,
        el: line({
          mark: '[+] ',
          text: `${pad(row.file, FILE_COL)}${pad(row.verb, VERB_COL)}`,
          count: `${rank}/${detail.total}`,
        }),
      };

      printed.push(entry);
      log.append(entry.el);
      enqueue(entry);
    });

    const hasBypassLine = printed.some((entry) => entry.key === 'bypass');

    if (detail.bypass && !hasBypassLine) {
      /* Marked transient: bypass is a shim, not a key, so it is
         removed again when bypass goes back off. Solve lines are
         permanent. */
      const entry = {
        key: 'bypass',
        el: line({
          mark: '[!] ',
          warn: true,
          text: `bypass enabled — ${detail.total} sections force-mounted, ${detail.count} solved`,
        }),
      };
      entry.el.dataset.transient = '';

      printed.push(entry);
      log.append(entry.el);
      enqueue(entry, BYPASS_SPEED);
    } else if (!detail.bypass && hasBypassLine) {
      const i = printed.findIndex((entry) => entry.key === 'bypass');
      const entry = printed[i];
      if (typing && entry.el.contains(typing.segments[0].node)) finishTyping();

      /* Out of `printed` immediately, out of the DOM when the fade
         ends. It is already gone as far as every other reader is
         concerned — the cursor, the rank count, the idle prompt —
         and only the pixels are still leaving. */
      printed.splice(i, 1);
      placeCursor();

      if (!animate) {
        entry.el.remove();
        return;
      }

      fading = {
        el: entry.el,
        tween: gsap.to(entry.el, {
          opacity: 0,
          duration: LINE_FADE,
          onComplete: () => {
            fading = null;
            entry.el.remove();
          },
        }),
      };
    }

    /* The resting prompt shows only while nothing has run. */
    if (idleLine) idleLine.hidden = printed.length > 0;
  }

  /* ── PINS ───────────────────────────────────────────────────── */
  function setPin(pin, state, { pop }) {
    if (pin.dataset.pinState === state) return;
    pin.dataset.pinState = state;

    if (!pop || !animate) return;

    /* overwrite: 'auto' rather than a fresh tween per click — a
       visitor spamming bypass must not stack transforms. */
    gsap.fromTo(
      pin,
      { scale: 0.6 },
      {
        scale: 1,
        duration: SEAT_DURATION,
        ease: 'back.out(2.2)',
        overwrite: 'auto',
      },
    );
  }

  const pinStateFor = (detail, i) =>
    detail.solved[i] ? 'seated' : detail.bypass ? 'shim' : 'empty';

  function renderPins(detail, { popIndex }) {
    pins.forEach((pin, i) => {
      setPin(pin, pinStateFor(detail, i), { pop: i === popIndex });
    });
  }

  /* ── THE BYPASS RUN ─────────────────────────────────────────
     One reusable timeline, killed and rebuilt on every state
     change rather than stacked. A run that is killed half way
     leaves pins in a stale state for exactly as long as it takes
     the *next* run to reach them — and the next run always writes
     every pin, so no kill can strand one. That is the property
     that makes spamming the button safe: the end state is a
     function of the last event, never of how many are in flight.

     Pins already `seated` are not touched. setPin returns early on
     a state it is already in, so an earned pin sits still while the
     shims run past it, which is the whole point of having two
     states for "open". */
  let pinRun = null;

  function clearPinRun() {
    if (!pinRun) return;
    pinRun.kill();
    pinRun = null;
  }

  function runPins(detail, { reverse }) {
    if (!animate) {
      renderPins(detail, { popIndex: -1 });
      return;
    }

    const order = pins.map((_, i) => i);
    if (reverse) order.reverse();

    pinRun = gsap.timeline({ onComplete: () => { pinRun = null; } });

    order.forEach((i, step) => {
      pinRun.call(
        () => setPin(pins[i], pinStateFor(detail, i), { pop: true }),
        null,
        PIN_RUN_DELAY + step * PIN_STAGGER,
      );
    });
  }

  /* ── THE FLIGHT ─────────────────────────────────────────────
     The section's padlock glyph is cloned, flown to its pin, and
     dropped there. Two tweens rather than one: x linear and y on
     `power2.in` gives an arc for free, with no MotionPath plugin
     and nothing added to the budget.

     Clones are tracked so any state change can kill them. A clone
     outliving the state it was launched for is how spam-toggling
     leaves debris on the page. */
  const inFlight = new Set();

  function clearFlights() {
    inFlight.forEach((flight) => {
      flight.tl.kill();
      flight.el.remove();
    });
    inFlight.clear();
  }

  function flyTo(index, onArrive) {
    const pin = pins[index];
    const badge = badges[index];
    const source = badge && (badge.querySelector('svg') || badge);

    if (!animate || !pin || !source || document.hidden) return false;

    const from = source.getBoundingClientRect();
    const to = pin.getBoundingClientRect();

    /* The only thing that cancels a flight is having nothing to
       launch: a glyph with no box, because its section is still
       collapsed.

       This used to also bail when the pin had scrolled above the
       viewport, on the reasoning that a flight to somewhere nobody
       can see is a flight nobody watches. True of the landing, and
       wrong about the launch — and the launch is the half that
       happens where the visitor is looking. Worse, it is the
       normal case rather than an edge one: answering a challenge
       means scrolling down to the input, which puts the hero off
       the top of the screen every time. The guard was skipping the
       flight almost always.

       So it flies regardless. With the pin above the viewport the
       glyph travels up, slides under the sticky topbar — its
       z-index sits below the topbar's for exactly this — and is
       gone. Which reads as sent upstairs, and is the truth: the
       pin it is flying to lights up when it lands. */
    if (!from.width) return false;

    const el = source.cloneNode(true);
    el.removeAttribute('id');
    el.classList.add('lock-flight');
    el.setAttribute('aria-hidden', 'true');
    el.style.left = `${from.left}px`;
    el.style.top = `${from.top}px`;
    el.style.width = `${from.width}px`;
    el.style.height = `${from.height}px`;
    document.body.append(el);

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);

    const flight = { el, tl: null };

    flight.tl = gsap.timeline({
      onComplete: () => {
        inFlight.delete(flight);
        el.remove();
        onArrive();
      },
    });

    flight.tl
      .to(el, { x: dx, duration: FLIGHT_DURATION, ease: 'none' }, 0)
      .to(el, { y: dy, duration: FLIGHT_DURATION, ease: 'power2.in' }, 0)
      .to(el, { scale: 0.35, opacity: 0.9, duration: FLIGHT_DURATION, ease: 'power2.in' }, 0);

    inFlight.add(flight);
    return true;
  }

  /* ── ENTRY ──────────────────────────────────────────────────── */
  document.addEventListener('ctf:state', (event) => {
    const detail = event.detail;

    /* Any state change invalidates whatever is mid-air. */
    clearFlights();
    clearPinRun();

    renderLog(detail);

    const solving = detail.reason === 'solve' && detail.index !== null;

    if (!solving) {
      /* Bypass is the only thing that arrives here with a run to
         play. `init` and anything else applies flat, because a page
         that loads bypassed must not play a mechanism nobody
         triggered — the same rule the hero lock follows. */
      if (detail.reason === 'bypass-on' || detail.reason === 'bypass-off') {
        runPins(detail, { reverse: detail.reason === 'bypass-off' });
      } else {
        renderPins(detail, { popIndex: -1 });
      }
      return;
    }

    /* The seat is the beat the hero lock chains off, so it is
       announced at the moment it happens rather than inferred from
       the state event — which fires a whole flight earlier. */
    const seat = () => {
      renderPins(detail, { popIndex: detail.index });
      document.dispatchEvent(
        new CustomEvent('hud:seated', { detail: { index: detail.index } }),
      );
    };

    /* On a solve the pin waits for the glyph: the flight is what
       explains why the pin lit up. If the flight is skipped — no
       GSAP, reduced motion, hidden tab, hero off-screen — the pin
       seats immediately instead, with the same end state. */
    if (flyTo(detail.index, seat)) {
      renderPins(
        { ...detail, solved: detail.solved.map((v, i) => (i === detail.index ? false : v)) },
        { popIndex: -1 },
      );
      return;
    }

    seat();
  });
}
