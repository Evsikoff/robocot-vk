(function () {
  function removeElements(selector) {
    document.querySelectorAll(selector).forEach((el) => {
      if (el) {
        el.remove();
      }
    });
  }

  function removeNavItems() {
    document
      .querySelectorAll('nav._8578b a[href="/kodedager"], nav._8578b button._54d8a, nav._8578b button._6ba2f')
      .forEach((el) => el.remove());
  }

  function removeCookieBanner() {
    removeElements('._30648');
  }

  function removeEventInfo() {
    removeElements('.fe408');
  }

  function removeEquinorLogo() {
    document.querySelectorAll('svg._08ab7').forEach((el) => {
      const target = el.closest('button, div, span') || el;
      if (target) {
        target.remove();
      }
    });
  }

  function clean() {
    removeNavItems();
    removeCookieBanner();
    removeEventInfo();
    removeEquinorLogo();
  }

  const observer = new MutationObserver(clean);

  function init() {
    clean();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }
})();
