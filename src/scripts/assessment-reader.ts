/** Chapter disclosures work without JavaScript; these controls offer continuous reading. */
export function initAssessmentReaders(root: Document = document) {
  for (const reader of root.querySelectorAll<HTMLElement>("[data-assessment-reader]")) {
    const chapters = reader.querySelectorAll<HTMLDetailsElement>("[data-assessment-chapter]");
    const controls = reader.querySelector<HTMLElement>("[data-assessment-controls]");
    if (!chapters.length || !controls) continue;
    controls.hidden = false;
    controls.querySelector("[data-assessment-expand]")?.addEventListener("click", () => {
      for (const chapter of chapters) chapter.open = true;
    });
    controls.querySelector("[data-assessment-collapse]")?.addEventListener("click", () => {
      for (const chapter of chapters) chapter.open = false;
    });
  }
}
