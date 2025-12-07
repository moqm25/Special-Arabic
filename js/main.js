// Shared UI interactions: nav active state, mobile toggle, and small page load animation.
document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('.nav-link');
  const navToggle = document.querySelector('.nav-toggle');
  const navLinksContainer = document.querySelector('.nav-links');

  // Highlight active nav link based on current page.
  const current = window.location.pathname.split('/').pop() || 'index.html';
  navLinks.forEach(link => {
    if (link.getAttribute('href') === current) {
      link.classList.add('active');
    }
  });

  // Mobile nav toggle.
  if (navToggle && navLinksContainer) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinksContainer.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navLinksContainer.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Subtle fade-in class for progressive reveal.
  document.body.classList.add('page-loaded');
});
