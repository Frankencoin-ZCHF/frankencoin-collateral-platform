/**
 * Defers AG Grid: the SSR table is the immediate default; the interactive grid loads on
 * first interaction with the toolbar/table or, failing that, when the browser is idle.
 */

const grid = document.getElementById("collateral-grid");

if (grid) {
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    import("./collateral-grid").then((m) => m.mount());
  };

  const triggers = ["#grid-search", "[data-chip]", "#grid-export", "#grid-reset", "[data-grid-fallback]", "details > summary"];
  for (const sel of triggers) {
    document.querySelectorAll(sel).forEach((el) => {
      el.addEventListener("pointerenter", start, { once: true, passive: true });
      el.addEventListener("focusin", start, { once: true });
      el.addEventListener("click", start, { once: true });
    });
  }
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(start, { timeout: 4000 });
  else setTimeout(start, 2500);
}
