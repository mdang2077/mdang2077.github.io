/* ============================================================
   HUD — the hero pin rail and the run console.

   Phase 3 scope: apply state, animate nothing. Every transition
   here is instantaneous (bar the CSS colour transitions the pins
   already carry), which is deliberate — it proves the `ctf:state`
   plumbing end to end while leaving phase 4 nothing to do but add
   choreography on top of the same entry point.

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

export function initHud() {
  const rail = document.querySelector('[data-pin-rail]');
  const log = document.querySelector('[data-run-log]');
  const idleLine = log && log.querySelector('[data-run-log-idle]');

  if (!rail && !log) return;

  const pins = rail ? Array.from(rail.querySelectorAll('[data-pin]')) : [];

  /* Print order, not index order: the console is a transcript, so
     a visitor who solves 3 then 1 sees them in the order they did
     them. Phase 4's typewriter queues off this same array. */
  const printed = [];

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

  function renderLog(detail) {
    if (!log) return;

    /* Newly solved sections, appended in the order they arrived. */
    detail.solved.forEach((isSolved, i) => {
      if (!isSolved) return;
      if (printed.some((entry) => entry.key === i)) return;

      const row = ROWS[i] || { file: `section_${i}`, verb: 'opened' };
      const rank = printed.filter((entry) => entry.key !== 'bypass').length + 1;

      printed.push({
        key: i,
        el: line({
          mark: '[+] ',
          text: `${pad(row.file, FILE_COL)}${pad(row.verb, VERB_COL)}`,
          count: `${rank}/${detail.total}`,
        }),
      });
    });

    const hasBypassLine = printed.some((entry) => entry.key === 'bypass');

    if (detail.bypass && !hasBypassLine) {
      /* Marked transient: bypass is a shim, not a key, so phase 4
         removes this line again when bypass goes back off. Solve
         lines are permanent. */
      const el = line({
        mark: '[!] ',
        warn: true,
        text: `bypass enabled — ${detail.total} sections force-mounted, ${detail.count} solved`,
      });
      el.dataset.transient = '';
      printed.push({ key: 'bypass', el });
    } else if (!detail.bypass && hasBypassLine) {
      const i = printed.findIndex((entry) => entry.key === 'bypass');
      printed[i].el.remove();
      printed.splice(i, 1);
    }

    printed.forEach((entry) => {
      if (!entry.el.isConnected) log.append(entry.el);
    });

    /* The resting prompt shows only while nothing has run; once
       lines exist the cursor sits at the end of the last one. */
    if (idleLine) idleLine.hidden = printed.length > 0;

    printed.forEach((entry) => {
      const existing = entry.el.querySelector('.run-log-cursor');
      if (existing) existing.remove();
    });

    const last = printed[printed.length - 1];
    if (last) last.el.append(cursorEl());
  }

  function renderPins(detail) {
    pins.forEach((pin, i) => {
      const state = detail.solved[i] ? 'seated' : detail.bypass ? 'shim' : 'empty';
      if (pin.dataset.pinState !== state) pin.dataset.pinState = state;
    });
  }

  document.addEventListener('ctf:state', (event) => {
    renderPins(event.detail);
    renderLog(event.detail);
  });
}
