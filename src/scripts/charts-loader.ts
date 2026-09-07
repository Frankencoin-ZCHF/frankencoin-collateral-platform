/**
 * Loads the ECharts runtime only when a chart container scrolls into view, so pages
 * without visible charts never pay for the library.
 */

const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-chart]"));

if (targets.length) {
  let loading: Promise<typeof import("./charts")> | null = null;
  const load = () => (loading ??= import("./charts"));

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        load().then((m) => m.mountCharts());
      }
    }, { rootMargin: "200px" });
    targets.forEach((t) => io.observe(t));
  } else {
    load().then((m) => m.mountCharts());
  }
}
