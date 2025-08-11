document.addEventListener('DOMContentLoaded', () => {
    const mobileToggle = document.querySelector('.mobile-toggle');
    const mainNav = document.querySelector('.main-nav');
    const overlay = document.createElement('div'); // Create overlay dynamically
    overlay.classList.add('overlay');
    document.body.appendChild(overlay); // Append overlay to body

    if (mobileToggle && mainNav && overlay) {
        mobileToggle.addEventListener('click', () => {
            mainNav.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        overlay.addEventListener('click', () => {
            mainNav.classList.remove('active');
            overlay.classList.remove('active');
        });

        // Close menu when a nav link is clicked (optional, but good UX)
        mainNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('active');
                overlay.classList.remove('active');
            });
        });
    }
});