// Add the real storefront URL here when it is available. Leave empty to keep
// shop links hidden and show the truthful availability message instead.
const STOREFRONT_URL = '';

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-nav');

if (menuButton && navigation) {
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
    navigation.classList.toggle('is-open', !isOpen);
  });

  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open navigation');
      navigation.classList.remove('is-open');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open navigation');
      navigation.classList.remove('is-open');
      menuButton.focus();
    }
  });
}

const storefrontLinks = document.querySelectorAll('[data-storefront-link]');
const storefrontSection = document.querySelector('[data-storefront-section]');
const storefrontNote = document.querySelector('[data-storefront-note]');

if (STOREFRONT_URL) {
  storefrontLinks.forEach((link) => {
    link.href = STOREFRONT_URL;
    link.hidden = false;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
  if (storefrontSection) storefrontSection.hidden = false;
  if (storefrontNote) storefrontNote.hidden = true;
}

const year = document.querySelector('#current-year');
if (year) year.textContent = String(new Date().getFullYear());
