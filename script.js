// Basic UI interactions: hamburger menu, mobile close, join buttons, hero countdown
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
const mobileClose = document.getElementById('mobileClose');
const body = document.body;

// Toggle mobile menu
function openMobile() {
  mobileMenu.classList.add('open');
  mobileMenu.setAttribute('aria-hidden', 'false');
  hamburger.setAttribute('aria-expanded', 'true');
  body.style.overflow = 'hidden'; // prevent background scroll
}
function closeMobile() {
  mobileMenu.classList.remove('open');
  mobileMenu.setAttribute('aria-hidden', 'true');
  hamburger.setAttribute('aria-expanded', 'false');
  body.style.overflow = ''; // restore
}

hamburger?.addEventListener('click', openMobile);
mobileClose?.addEventListener('click', closeMobile);

// Close mobile menu when a link inside it is clicked
document.querySelectorAll('.mobile-links a').forEach(a => {
  a.addEventListener('click', () => {
    closeMobile();
  });
});

// Join button behavior (placeholder) — integrates with your own join logic later
document.addEventListener('click', (e) => {
  const target = e.target;
  if (target.classList && target.classList.contains('join-btn')) {
    e.preventDefault();
    // Simple check: if user not logged in -> go to login (you may replace with real auth check)
    if (window.location.pathname.includes('/auth')) {
      // already on auth page
    } else {
      // For now show a friendly toast / alert
      const name = target.closest('.card')?.querySelector('h3')?.textContent || document.querySelector('.preview-title')?.textContent || 'contest';
      alert(`Joining ${name.trim()} — contest flow will be handled by your backend.`);
    }
  }
});

// HERO COUNTDOWN: sample countdown to a future date (adjust targetDate as needed)
(function heroCountdown(){
  const el = document.getElementById('heroCountdown');
  if (!el) return;

  // target 10 minutes from now (demo). Replace with real server time / contest end time
  const targetDate = new Date(Date.now() + 10 * 60 * 1000);

  function update() {
    const now = new Date();
    let diff = Math.max(0, Math.floor((targetDate - now) / 1000));
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    diff %= 3600;
    const m = String(Math.floor(diff / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    el.textContent = `${h}:${m}:${s}`;
    if (h==='00' && m==='00' && s==='00') {
      // When ended - simple update
      el.textContent = '00:00:00';
      // Optionally change UI to "Ended" or refresh contest state
    }
  }

  update();
  setInterval(update, 1000);
})();

// Prevent focus outline removal for keyboard users (small accessibility nicety)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') document.documentElement.classList.remove('no-focus');
});
