/* Shared helpers for the end-to-end suite.

   Not a spec file: Playwright's default testMatch only picks up *.spec.* and
   *.test.*, so this is imported, never run. */

/* The report opens with Summary and Step-by-step expanded and the four
   reference chapters folded, so the screen is readable on a phone instead of
   fourteen screens long. Tests that assert on content inside a folded chapter
   have to open it first, the same as a reader does — and a folded element
   reports its declared styles rather than its resolved ones, so measuring one
   while hidden silently measures the wrong thing. */
export async function expandChapters(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.chapter.collapsed').forEach((ch) => {
      ch.classList.remove('collapsed');
      const head = ch.querySelector('.ch-head');
      if (head) head.setAttribute('aria-expanded', 'true');
    });
  });
}
