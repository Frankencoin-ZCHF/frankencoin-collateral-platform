/** Deep links reveal their containing disclosures, including assessment sections and position lists. */
function revealHash() {
  let id: string;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  if (!id) return;
  const target =
    document.getElementById(id) ??
    Array.from(document.querySelectorAll<HTMLElement>("details[data-slug]")).find((el) => el.dataset.slug === id);
  if (!target) return;
  for (let parent: HTMLElement | null = target; parent; parent = parent.parentElement)
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  target.scrollIntoView({ block: "start" });
}
window.addEventListener("hashchange", revealHash);
revealHash();
