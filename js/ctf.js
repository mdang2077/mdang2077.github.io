/* ============================================================
   CTF — challenge logic, unlock state, progress, bypass.

   State lives in one place and is applied by a single idempotent
   render(). v2 mutated the DOM imperatively from three different
   handlers and kept a separate counter that could drift; this
   derives everything from `solved` and `bypass`.
   ============================================================ */

const ANSWERS = ['security is cool', '17', 'png'];

const WRONG_SHAKE_MS = 400;

export function initCtf() {
  const sections = Array.from(document.querySelectorAll('[data-section]'))
    .map((el) => ({
      el,
      challenge: el.querySelector('[data-challenge]'),
      input: el.querySelector('[data-answer]'),
      msg: el.querySelector('[data-msg]'),
      lock: el.querySelector('[data-lock]'),
      badge: el.querySelector('[data-lock-badge]'),
      reveal: el.querySelector('[data-reveal]'),
    }))
    .filter((s) => s.challenge && s.input && s.reveal);

  if (!sections.length) return;

  const dots = Array.from(document.querySelectorAll('[data-dot]'));
  const progressLabel = document.querySelector('[data-progress-label]');
  const bypassBtn = document.querySelector('[data-bypass]');

  const solved = sections.map(() => false);
  let bypass = false;

  const solvedCount = () => solved.filter(Boolean).length;

  /* The single outbound edge of this module. Everything that
     wants to react to unlock state — the hero pin rail, the run
     console, phase 4's timelines — listens for this instead of
     reading ctf.js's internals.

     `reason: 'init'` must apply state without animating: it is
     what stops the whole choreography firing on page load. */
  function announce(reason, index) {
    document.dispatchEvent(
      new CustomEvent('ctf:state', {
        detail: {
          solved: solved.slice(),
          count: solvedCount(),
          total: sections.length,
          bypass,
          reason,
          index: index === undefined ? null : index,
        },
      }),
    );
  }

  function render(reason = 'init', index = null) {
    sections.forEach((section, i) => {
      const isOpen = solved[i] || bypass;

      section.challenge.classList.toggle('is-hidden', isOpen);
      section.reveal.classList.toggle('is-visible', isOpen);

      /* State goes on the badge as an attribute rather than as a
         className on the label: the label is now a sibling of the
         badge's SVG, and writing className there would style the
         wrong element while textContent would wipe the drawing. */
      if (section.lock) {
        section.lock.textContent = solved[i]
          ? '[ unlocked ]'
          : bypass
            ? '[ bypassed ]'
            : '[ locked ]';
      }

      if (section.badge) {
        section.badge.dataset.lockState = solved[i]
          ? 'unlocked'
          : bypass
            ? 'bypassed'
            : 'locked';
      }

      if (dots[i]) dots[i].classList.toggle('is-done', solved[i]);
    });

    const count = solvedCount();

    if (progressLabel) {
      progressLabel.textContent = `${count} / ${sections.length} unlocked`;
    }

    if (bypassBtn) {
      bypassBtn.textContent = bypass ? '[ enable CTFs ]' : '[ skip CTFs ]';
      bypassBtn.setAttribute('aria-pressed', String(bypass));
    }

    /* An attribute, not an inline style — so it composes with the
       theme attribute (phase 2) instead of overriding it. */
    document.documentElement.dataset.solved =
      bypass || count === sections.length ? 'true' : 'false';

    announce(reason, index);
  }

  function submit(section, index) {
    const value = section.input.value.trim().toLowerCase();

    if (value === ANSWERS[index]) {
      solved[index] = true;
      if (section.msg) {
        section.msg.textContent = '// access granted';
        section.msg.className = 'challenge-msg is-ok';
      }
      render('solve', index);
      return;
    }

    if (section.msg) {
      section.msg.textContent = '// incorrect. try again.';
      section.msg.className = 'challenge-msg is-fail';
    }
    section.input.classList.add('is-wrong');
    window.setTimeout(
      () => section.input.classList.remove('is-wrong'),
      WRONG_SHAKE_MS,
    );
  }

  sections.forEach((section, i) => {
    /* A real <form>, so Enter submits natively — the v2 onkeydown
       hack is gone. */
    section.challenge.addEventListener('submit', (event) => {
      event.preventDefault();
      submit(section, i);
    });
  });

  if (bypassBtn) {
    bypassBtn.addEventListener('click', () => {
      bypass = !bypass;
      render(bypass ? 'bypass-on' : 'bypass-off');
    });
  }

  render('init');
}
