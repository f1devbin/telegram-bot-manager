// Loaded synchronously in <head> to apply the saved theme before first paint.
(function () {
  try {
    var theme = localStorage.getItem('tbm.theme');
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  } catch (e) { /* storage unavailable */ }
})();
