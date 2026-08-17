/*
 * Applies the stored theme before first paint, so a dark-mode user never sees
 * a white flash while the bundle loads.
 *
 * This lives in public/ and is loaded as a synchronous same-origin script
 * rather than inlined into index.html, which lets the Content-Security-Policy
 * forbid inline script entirely. It must stay in sync with the storage key in
 * src/hooks/use-theme.tsx.
 */
(function () {
  try {
    var stored = localStorage.getItem("bali-schools-theme");
    var dark =
      stored === "dark" ||
      ((!stored || stored === "system") &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {
    /* storage unavailable — fall back to the light default */
  }
})();
