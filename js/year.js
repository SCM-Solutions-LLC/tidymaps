/* Keeps the footer's copyright year current.

   The year is written into the markup as well, so a reader with JavaScript off
   — or one reading a saved copy — still sees a real year rather than an empty
   line. This only replaces it when the clock says something different, which
   is the whole point: six pages carried a hard-coded 2026 that nobody would
   remember to bump on January 1.

   A classic script, not a module: the legal pages load no JavaScript at all
   otherwise, and this needs no imports. */
(function () {
  var year = String(new Date().getFullYear());
  var slots = document.querySelectorAll('[data-year]');
  for (var i = 0; i < slots.length; i++) {
    if (slots[i].textContent !== year) slots[i].textContent = year;
  }
})();
