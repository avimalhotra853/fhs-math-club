/* Navigation follows the visible section; motion is optional and never gates content. */
(() => {
  const links = [...document.querySelectorAll('.header nav a')];
  const header = document.querySelector('.header');
  const toggle = document.querySelector('.menu-toggle');
  function closeMenu(returnFocus = false) {
    const wasOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation menu');
    header.classList.remove('menu-open');
    if (returnFocus && wasOpen) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    header.classList.toggle('menu-open', open);
  });
  links.forEach(link => link.addEventListener('click', () => closeMenu()));
  document.addEventListener('pointerdown', event => { if (!header.contains(event.target)) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(true); });
  matchMedia('(max-width: 550px)').addEventListener('change', () => closeMenu());
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach(link => {
        const current = link.hash === '#' + entry.target.id;
        link.classList.toggle('is-current', current);
        if (current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-10% 0px -65% 0px', threshold: 0 });
  document.querySelectorAll('main > section[id]').forEach(section => observer.observe(section));
})();
