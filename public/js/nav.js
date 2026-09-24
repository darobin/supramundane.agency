// Collapse the top navigation behind a burger on small screens.
(() => {
  const nav = document.querySelector('nav.site-nav');
  const button = nav && nav.querySelector('.burger');
  if (!nav || !button) return;
  nav.classList.add('js');
  button.hidden = false;
  const set = (open) => {
    nav.classList.toggle('open', open);
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', () => set(!nav.classList.contains('open')));
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
})();
