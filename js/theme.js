/* ============================================================
   THEME — dark/light toggle and persistence.

   Two states, in precedence order:
     1. an explicit choice, kept in localStorage
     2. anything else -> dark

   The OS preference is not an input. Dark is the room this site is
   authored in, so every visitor lands in it and leaves by choosing
   to; `prefers-color-scheme` is not consulted here or in the inline
   <head> script, and nothing re-themes underneath a visitor who has
   not touched the toggle.

   The inline script in <head> resolves the above into an explicit
   `data-theme` before first paint. This module takes over from
   whatever it decided; it never re-resolves on load, so it cannot
   disagree with what the visitor already sees.
   ============================================================ */

const STORAGE_KEY = 'theme';

/* Every storage touch is wrapped: Safari private mode throws on
   write, and embedded/blocked contexts throw on read. Reading is
   the <head> script's job, so this module only ever writes. */
function writeStored(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* Choice applies for this page view only. */
  }
}

const activeTheme = () =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

/* Read the duration from the token rather than restating it here,
   so css and js cannot drift apart. */
function tokenMs(name, fallback) {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith('ms') ? n : n * 1000;
}

/* Origin for the circular wipe: the centre of the toggle, with a
   radius long enough to reach the furthest corner. These feed the
   keyframes only — they are not theme tokens, so setting them
   inline cannot fight the stylesheet. */
function setRevealOrigin(button) {
  const rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
  const style = document.documentElement.style;
  style.setProperty('--theme-origin-x', `${x}px`);
  style.setProperty('--theme-origin-y', `${y}px`);
  style.setProperty('--theme-origin-r', `${radius}px`);
}

export function initTheme({ prefersReducedMotion = false } = {}) {
  const button = document.querySelector('[data-theme-toggle]');
  const valueEl = document.querySelector('[data-theme-value]');
  const swapMs = tokenMs('--dur-theme', 350);

  function paint(theme) {
    document.documentElement.dataset.theme = theme;
    if (valueEl) valueEl.textContent = theme;
    if (button) {
      const next = theme === 'dark' ? 'light' : 'dark';
      button.setAttribute('aria-label', `Switch to ${next} theme`);
    }

    /* The counterpart to `ctf:state`. Everything CSS-driven
       re-themes from the attribute alone; the WebGL lock cannot,
       because its materials and environment map live outside the
       cascade. This is the one outbound edge of this module. */
    document.dispatchEvent(
      new CustomEvent('theme:change', { detail: { theme } }),
    );
  }

  function crossfade(theme) {
    const root = document.documentElement;
    root.classList.add('is-theme-switching');
    paint(theme);
    window.setTimeout(() => root.classList.remove('is-theme-switching'), swapMs);
  }

  function apply(theme, { animate }) {
    if (!animate) {
      paint(theme);
      return;
    }

    if (typeof document.startViewTransition === 'function') {
      let painted = false;
      const once = () => {
        if (painted) return;
        painted = true;
        paint(theme);
      };
      try {
        document.startViewTransition(once);
        /* The update callback runs at the browser's next rendering
           opportunity, which never arrives in a backgrounded tab or
           when a transition is already in flight. Never let the
           visitor's click be swallowed: if the callback has not fired
           by the time a plain crossfade would have finished, apply the
           theme directly. `once` makes the later call a no-op. */
        window.setTimeout(once, swapMs);
        return;
      } catch {
        /* Fall through to the crossfade below. */
      }
    }

    crossfade(theme);
  }

  paint(activeTheme());

  if (!button) return;

  button.addEventListener('click', () => {
    const next = activeTheme() === 'dark' ? 'light' : 'dark';
    writeStored(next);
    if (!prefersReducedMotion) setRevealOrigin(button);
    apply(next, { animate: !prefersReducedMotion });
  });
}
