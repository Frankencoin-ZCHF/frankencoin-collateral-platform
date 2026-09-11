/** Deep links reveal their containing disclosures, including assessment sections and position lists. */
function revealHash(hash = location.hash) {
  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return;
  }
  if (!id) return;
  const target =
    document.getElementById(id) ??
    document.getElementById(`assessment-${id}`) ??
    Array.from(document.querySelectorAll<HTMLElement>("details[data-slug]")).find((el) => el.dataset.slug === id);
  if (!target) return;
  for (let parent: HTMLElement | null = target; parent; parent = parent.parentElement)
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  target.scrollIntoView({ block: "start" });
}
window.addEventListener("hashchange", () => revealHash());
// Clicking the current chapter again must reopen it even when the hash is unchanged.
document.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
  if (link) revealHash(link.hash);
});
revealHash();
