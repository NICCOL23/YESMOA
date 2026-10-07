(() => {
  const menu = document.querySelector('.nav-menu');
  if (!menu) return;
  const links = [...menu.querySelectorAll('a')];
  function update() {
    let current;
    if (document.querySelector('.catalog-dialog[open]')) {
      current = links.find(link => link.hasAttribute('data-open-catalog'));
    } else if (document.querySelector('.defect-dialog[open]')) {
      current = links.find(link => link.hasAttribute('data-open-price-modal'));
    } else if (document.querySelector('.security-dialog[open]')) {
      current = links.find(link => link.getAttribute('href') === '#security-title');
    } else {
      const hash = location.hash.startsWith('#requests') ? '#requests' : location.hash;
      current = links.find(link => link.getAttribute('href') === hash);
    }
    links.forEach(link => {
      if (link === current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }
  // Modal clicks keep the underlying route. Restore that route's selection on close.
  document.addEventListener('click', () => queueMicrotask(update));
  document.addEventListener('close', update, true);
  window.addEventListener('hashchange', update);
  new MutationObserver(update).observe(document.body, {
    subtree: true, attributes: true, attributeFilter: ['open']
  });
  update();
})();
