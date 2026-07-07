// public/js/nav-toggle.js
// Shared hamburger-menu behavior for the three public headers
// (index.html, lakeview.html, hospital.html). Each page's nav has the
// same two ids/classes: #navToggle (button) and #primaryNav (the nav
// element itself, tagged with .primary-nav).
(function () {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('primaryNav');
  if (!toggle || !nav) return;

  function closeNav() {
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
    document.body.classList.remove('nav-open');
  }

  function openNav() {
    toggle.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    nav.classList.add('open');
    document.body.classList.add('nav-open');
  }

  toggle.addEventListener('click', () => {
    if (nav.classList.contains('open')) closeNav();
    else openNav();
  });

  // Tapping a link closes the menu (so anchor-jump links like #doctors
  // don't leave the overlay open on top of the section they scrolled to).
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeNav);
  });

  // Close if the viewport is resized back up past the mobile breakpoint,
  // so the nav doesn't get stuck open when rotating a tablet, etc.
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeNav();
  });
})();
