/** Specialist grid is only requested when its disclosure is opened. Basic browsing stays light. */
const section = document.getElementById("advanced-grid") as HTMLDetailsElement | null;
if (section) {
  let started = false;
  async function load() {
    if (!section?.open || started) return;
    started = true;
    const status = document.getElementById("advanced-grid-status");
    if (status) status.textContent = "Loading advanced table…";
    try {
      (await import("./collateral-grid")).mount();
      section.querySelectorAll<HTMLInputElement | HTMLButtonElement>("[disabled]").forEach((el) => {
        el.disabled = false;
      });
      if (status) status.hidden = true;
    } catch {
      started = false;
      if (status)
        status.textContent =
          "The advanced table could not be loaded. Close and reopen this section to retry. The asset overview remains available.";
    }
  }
  section.addEventListener("toggle", load);
  void load();
}
